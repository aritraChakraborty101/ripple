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

function bindId(id: string, b: Binding): string {
  if (id === SELF) return b.self;
  if (id === TARGET) {
    if (b.target === undefined) throw new Error('This action needs a target');
    return b.target;
  }
  return id;
}

function bindRef(ref: StatRef, b: Binding): StatRef {
  if (ref.kind === 'relation') {
    const [x, y] = ref.id.split('__') as [string, string];
    return { ...ref, id: relationId(bindId(x, b), bindId(y, b)) };
  }
  return { ...ref, id: bindId(ref.id, b) };
}

function bindCondition(c: Condition, b: Binding): Condition {
  switch (c.type) {
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
    default:
      return m;
  }
}

/** `ties(target)` becomes `ties(thessa)`. */
export function bindGoalId(goalId: string, b: Binding): string {
  return goalId.replace(/\((self|target)\)$/, (_, p: string) => `(${bindId(p, b)})`);
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
