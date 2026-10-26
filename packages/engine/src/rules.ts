/**
 * The vocabulary content uses to describe events and decisions: conditions
 * (when something can happen) and effects (what it does). Content combines
 * these small building blocks instead of needing new engine code per crisis.
 */

import { addModifier, effectiveStat, type ModifierSource, type StatRef } from './modifiers';
import type { Consideration } from './ai/types';
import { chance } from './rng';
import type { GameState } from './state';
import { getStatEntity, setBaseStat } from './world';

// ---------------------------------------------------------------------------
// Conditions

export type Condition =
  | { readonly type: 'all'; readonly of: readonly Condition[] }
  | { readonly type: 'any'; readonly of: readonly Condition[] }
  | { readonly type: 'not'; readonly condition: Condition }
  /** Compares a stat's effective value (with modifiers). Bounds are exclusive. */
  | {
      readonly type: 'stat';
      readonly target: StatRef;
      readonly above?: number;
      readonly below?: number;
    }
  | { readonly type: 'chokepoint'; readonly id: string; readonly open: boolean }
  | { readonly type: 'flag'; readonly flag: string; readonly set: boolean }
  /** True from this day (tick) onward. */
  | { readonly type: 'after_day'; readonly day: number }
  /** A random draw, in basis points (500 = 5%). Draws only if reached. */
  | { readonly type: 'chance'; readonly bp: number };

export interface Evaluation {
  readonly value: boolean;
  /** The state with the random generator advanced by any chance draws. */
  readonly state: GameState;
}

/**
 * Evaluate a condition. `all` and `any` short-circuit left to right, so put
 * chance draws last: they then consume randomness only when everything else holds.
 */
export function evaluate(state: GameState, condition: Condition): Evaluation {
  switch (condition.type) {
    case 'all': {
      let current = state;
      for (const part of condition.of) {
        const result = evaluate(current, part);
        current = result.state;
        if (!result.value) return { value: false, state: current };
      }
      return { value: true, state: current };
    }
    case 'any': {
      let current = state;
      for (const part of condition.of) {
        const result = evaluate(current, part);
        current = result.state;
        if (result.value) return { value: true, state: current };
      }
      return { value: false, state: current };
    }
    case 'not': {
      const result = evaluate(state, condition.condition);
      return { value: !result.value, state: result.state };
    }
    case 'stat': {
      const value = effectiveStat(state, condition.target);
      const above = condition.above === undefined || value > condition.above;
      const below = condition.below === undefined || value < condition.below;
      return { value: above && below, state };
    }
    case 'chokepoint': {
      const chokepoint = state.world.chokepoints[condition.id];
      if (!chokepoint) throw new Error(`Unknown chokepoint "${condition.id}"`);
      return { value: chokepoint.open === condition.open, state };
    }
    case 'flag':
      return { value: state.flags.includes(condition.flag) === condition.set, state };
    case 'after_day':
      return { value: state.tick >= condition.day, state };
    case 'chance': {
      const draw = chance(state.rng, condition.bp);
      return { value: draw.value, state: { ...state, rng: draw.next } };
    }
  }
}

// ---------------------------------------------------------------------------
// Effects

export type Effect =
  /** A temporary or permanent modifier. `days: null` means permanent. */
  | {
      readonly type: 'modify';
      readonly target: StatRef;
      readonly op: 'add' | 'pct';
      readonly amount: number;
      readonly days: number | null;
    }
  /** A permanent change to a stat's base value, such as spending treasury. */
  | { readonly type: 'adjust'; readonly target: StatRef; readonly by: number }
  | { readonly type: 'set_chokepoint'; readonly id: string; readonly open: boolean }
  /** Fire another event after a delay: the engine of delayed consequences. */
  | { readonly type: 'schedule'; readonly event: string; readonly inDays: number }
  | { readonly type: 'set_flag'; readonly flag: string }
  | { readonly type: 'clear_flag'; readonly flag: string }
  /**
   * Remove every modifier an earlier decision or event created, such as the
   * lingering boosts of a policy that is being reversed. Permanent base
   * changes (`adjust`) are history and stay.
   */
  | {
      readonly type: 'end_effects';
      readonly source: { readonly kind: 'decision' | 'event'; readonly id: string };
    };

export interface ScheduledEvent {
  readonly dueTick: number;
  readonly event: string;
  /** What scheduled it, for the why-trace. */
  readonly cause: ModifierSource;
}

export function applyEffect(state: GameState, effect: Effect, source: ModifierSource): GameState {
  switch (effect.type) {
    case 'modify':
      return addModifier(state, {
        target: effect.target,
        op: effect.op,
        amount: effect.amount,
        source,
        expiresAt: effect.days === null ? null : state.tick + effect.days,
      });
    case 'adjust': {
      const { kind, id, stat } = effect.target;
      const base = getStatEntity(state.world, kind, id).stats[stat] ?? 0;
      return {
        ...state,
        world: setBaseStat(state.world, kind, id, stat, base + effect.by),
        trace: {
          ...state.trace,
          adjustments: [
            ...state.trace.adjustments,
            { target: effect.target, by: effect.by, source },
          ],
        },
      };
    }
    case 'set_chokepoint': {
      const chokepoint = state.world.chokepoints[effect.id];
      if (!chokepoint) throw new Error(`Unknown chokepoint "${effect.id}"`);
      if (chokepoint.open === effect.open) return state;
      return {
        ...state,
        trace: {
          ...state.trace,
          chokepointBy: { ...state.trace.chokepointBy, [effect.id]: source },
        },
        world: {
          ...state.world,
          chokepoints: {
            ...state.world.chokepoints,
            [effect.id]: { ...chokepoint, open: effect.open },
          },
        },
      };
    }
    case 'schedule':
      if (!state.defs.events[effect.event]) throw new Error(`Unknown event "${effect.event}"`);
      return {
        ...state,
        scheduled: [
          ...state.scheduled,
          { dueTick: state.tick + effect.inDays, event: effect.event, cause: source },
        ],
      };
    case 'set_flag':
      return state.flags.includes(effect.flag)
        ? state
        : {
            ...state,
            flags: [...state.flags, effect.flag].sort(),
            trace: { ...state.trace, flagBy: { ...state.trace.flagBy, [effect.flag]: source } },
          };
    case 'clear_flag': {
      if (!state.flags.includes(effect.flag)) return state;
      const flagBy = { ...state.trace.flagBy };
      delete flagBy[effect.flag];
      return {
        ...state,
        flags: state.flags.filter((f) => f !== effect.flag),
        trace: { ...state.trace, flagBy },
      };
    }
    case 'end_effects': {
      const { kind, id } = effect.source;
      const kept = state.modifiers.filter((m) => !(m.source.kind === kind && m.source.id === id));
      return kept.length === state.modifiers.length ? state : { ...state, modifiers: kept };
    }
  }
}

export function applyEffects(
  state: GameState,
  effects: readonly Effect[],
  source: ModifierSource,
): GameState {
  let current = state;
  for (const effect of effects) {
    current = applyEffect(current, effect, source);
  }
  return current;
}

// ---------------------------------------------------------------------------
// Definitions written in content

export type Severity = 'critical' | 'warning' | 'info';

/** Something that can happen in the world, on its own or when scheduled. */
export interface EventDef {
  readonly id: string;
  /** Who the news is about: a country ID, or "home", "markets" or "world". */
  readonly tag: string;
  readonly severity: Severity;
  readonly headline: string;
  readonly detail?: string;
  /** Checked every day. Null means the event only fires when scheduled. */
  readonly trigger: Condition | null;
  /** Fire at most once per game. */
  readonly once: boolean;
  /** Minimum days between two firings. */
  readonly cooldownDays: number;
  readonly effects: readonly Effect[];
}

/** An order the player can issue. */
export interface DecisionDef {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  /** Null means always available (apart from cooldown and being under way). */
  readonly requires: Condition | null;
  /** Shown when `requires` is not met. */
  readonly unavailableText?: string;
  /** Paid immediately when the order is signed. */
  readonly costs: readonly Effect[];
  /** Days until the outcome. 0 resolves the same day. */
  readonly durationDays: number;
  readonly cooldownDays: number;
  /** Chance of success in basis points; 10000 is certain. */
  readonly chanceBp: number;
  readonly effects: readonly Effect[];
  readonly failureEffects: readonly Effect[];
  readonly successHeadline: string;
  readonly failureHeadline?: string;
  /**
   * For policies: the flag that is set while this decision's policy is in
   * force (the decision's effects set it, a reversing decision clears it).
   * Lets the UI list what the player currently has in force.
   */
  readonly policyFlag?: string;

  // --- For computer countries (see ai/). Player decisions leave these out.

  /** Who may sign it: missing means the player; otherwise these countries, or "any" computer country. */
  readonly for?: readonly string[] | 'any';
  /** Makes it a template: one candidate per target country. "others" means every other country. */
  readonly targets?: 'others' | readonly string[];
  /** Which goals it moves, by goal ID, from -5 to 5. `ties(target)` names the target's goal. */
  readonly drives?: Readonly<Record<string, number>>;
  /** How the situation changes its appeal. */
  readonly consider?: readonly Consideration[];
}

/** Decisions whose policy is currently in force, in ID order. */
export function policiesInForce(state: GameState): DecisionDef[] {
  return Object.keys(state.defs.decisions)
    .sort()
    .map((id) => state.defs.decisions[id]!)
    .filter((d) => d.policyFlag !== undefined && state.flags.includes(d.policyFlag));
}
