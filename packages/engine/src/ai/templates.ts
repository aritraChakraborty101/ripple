/**
 * Templates: actions written once with the placeholders `self` (the country
 * acting) and `target` (the country it is aimed at), bound to real countries
 * when they are scored or signed. Adding a country then needs no new actions.
 */

import type { StatRef } from '../modifiers';
import type { Condition, DecisionDef, Effect } from '../rules';
import type { GameState } from '../state';
import { relationId, sortedIds } from '../world';
import type { Consideration, Measure } from './types';

export const SELF = 'self';
export const TARGET = 'target';
export const PLACEHOLDERS: readonly string[] = [SELF, TARGET];

interface Binding {
  readonly self: string;
  readonly target?: string;
}

/**
 * `{self}` and `{target}` inside a name: `deal_{target}` becomes `deal_orrin`.
 * Flags, link IDs and stat names use this, so one template can reach the
 * route, flag or stat that belongs to whichever country it is aimed at.
 */
function bindText(text: string, b: Binding): string {
  if (!text.includes('{')) return text;
  if (text.includes('{target}') && b.target === undefined) {
    throw new Error('This action needs a target');
  }
  return text.replaceAll('{self}', b.self).replaceAll('{target}', b.target ?? '');
}

function bindId(id: string, b: Binding): string {
  if (id === SELF) return b.self;
  if (id === TARGET) {
    if (b.target === undefined) throw new Error('This action needs a target');
    return b.target;
  }
  return bindText(id, b);
}

function bindRef(ref: StatRef, b: Binding): StatRef {
  if (ref.kind === 'relation') {
    const [x, y] = ref.id.split('__') as [string, string];
    return { ...ref, id: relationId(bindId(x, b), bindId(y, b)) };
  }
  return { ...ref, id: bindId(ref.id, b), stat: bindText(ref.stat, b) };
}

/**
 * Flag names in templates carry `{self}` and `{target}`, so one policy can be
 * in force against several countries at once: `tariff_on_{target}`.
 */
export function bindFlag(flag: string, b: Binding): string {
  // Unbound, a {target} flag stays as written, so a template can be listed before it is aimed.
  if (b.target === undefined) return flag.replaceAll('{self}', b.self);
  return bindText(flag, b);
}

function bindCondition(c: Condition, b: Binding): Condition {
  switch (c.type) {
    case 'flag':
      return { ...c, flag: bindFlag(c.flag, b) };
    case 'all':
    case 'any':
      return { ...c, of: c.of.map((x) => bindCondition(x, b)) };
    case 'not':
      return { ...c, condition: bindCondition(c.condition, b) };
    case 'stat':
      return { ...c, target: bindRef(c.target, b) };
    default:
      return c;
  }
}

function bindEffect(e: Effect, b: Binding): Effect {
  switch (e.type) {
    case 'modify':
    case 'adjust':
      return { ...e, target: bindRef(e.target, b) };
    case 'set_flag':
    case 'clear_flag':
      return { ...e, flag: bindFlag(e.flag, b) };
    case 'end_effects':
      // A template ends what the same kind of order did to the same target,
      // unless content names whose: `target: self` for a country undoing what
      // was done to it.
      if (e.target !== undefined) return { ...e, target: bindId(e.target, b) };
      return b.target === undefined ? e : { ...e, target: b.target };
    case 'embargo':
      return { ...e, by: bindId(e.by, b), against: bindId(e.against, b) };
    default:
      return e;
  }
}

function bindMeasure(m: Measure, b: Binding): Measure {
  switch (m.kind) {
    case 'stat':
      return { ...m, ref: bindRef(m.ref, b) };
    case 'relation':
      return { ...m, between: [bindId(m.between[0], b), bindId(m.between[1], b)] };
    case 'flag':
      return { ...m, flag: bindFlag(m.flag, b) };
    default:
      return m;
  }
}

/** `ties(target)` becomes `ties(thessa)`. */
export function bindGoalId(goalId: string, b: Binding): string {
  return goalId.replace(/\((self|target)\)$/, (_, p: string) => `(${bindId(p, b)})`);
}

/**
 * Only what decides whether the decision can be signed (`requires`, and the
 * policy flag) bound: enough for an availability check, and much cheaper than
 * binding everything for options that turn out to be closed.
 */
export function bindRequires(def: DecisionDef, self: string, target?: string): DecisionDef {
  const b: Binding = target === undefined ? { self } : { self, target };
  return {
    ...def,
    requires: def.requires ? bindCondition(def.requires, b) : null,
    ...(def.policyFlag !== undefined ? { policyFlag: bindFlag(def.policyFlag, b) } : {}),
  };
}

/** The decision with every placeholder replaced by a real country. */
export function bindDecision(def: DecisionDef, self: string, target?: string): DecisionDef {
  const b: Binding = target === undefined ? { self } : { self, target };
  const drives: Record<string, number> = {};
  for (const [goal, amount] of Object.entries(def.drives ?? {}))
    drives[bindGoalId(goal, b)] = amount;
  return {
    ...def,
    requires: def.requires ? bindCondition(def.requires, b) : null,
    costs: def.costs.map((e) => bindEffect(e, b)),
    effects: def.effects.map((e) => bindEffect(e, b)),
    failureEffects: def.failureEffects.map((e) => bindEffect(e, b)),
    ...(def.drives ? { drives } : {}),
    ...(def.policyFlag !== undefined ? { policyFlag: bindFlag(def.policyFlag, b) } : {}),
    ...(def.consider
      ? {
          consider: def.consider.map((c): Consideration => ({
            ...c,
            measure: bindMeasure(c.measure, b),
          })),
        }
      : {}),
  };
}

/** Whether a country may sign this decision at all. Missing `for` means the player only. */
export function isFor(state: GameState, def: DecisionDef, country: string): boolean {
  const player = state.rules.playerCountry;
  if (def.for === undefined) return country === player;
  if (country === player) return false;
  if (def.for === 'any') return state.defs.ai?.personalities[country] !== undefined;
  return def.for.includes(country);
}

/** The countries a decision can be aimed at by a given country; [undefined] if it takes no target. */
export function targetsOf(
  state: GameState,
  def: DecisionDef,
  country: string,
): readonly (string | undefined)[] {
  if (def.targets === undefined) return [undefined];
  const pool = def.targets === 'others' ? sortedIds(state.world.countries) : def.targets;
  return pool.filter((id) => id !== country);
}
