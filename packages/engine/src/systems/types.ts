import type { EngineEvent } from '../events';
import type { StatRef } from '../modifiers';
import type { GameState } from '../state';
import type { ChokepointWhy, StatWhy, WhyNode } from '../why';

export interface SystemResult {
  readonly state: GameState;
  readonly events: readonly EngineEvent[];
}

/** What the why-trace asks a system to explain. */
export type ExplainRequest =
  /** A system modifier this system keeps on `ref` (see `modifierIds`). */
  | { readonly kind: 'modifier'; readonly id: string; readonly ref: StatRef }
  /** How far this system has moved `ref`'s base value away from its normal (see `normalOf`). */
  | { readonly kind: 'drift'; readonly ref: StatRef; readonly amount: number };

/** Tools the why-trace lends a system while it explains, already one level deeper. */
export interface ExplainContext {
  /** Explain another stat, following its causes further. */
  explainStat(ref: StatRef): StatWhy;
  explainChokepoint(id: string): ChokepointWhy;
  /** A stat's base value without permanent adjustments: what it was before anything was spent or changed for good. */
  baseWithoutAdjustments(ref: StatRef): number;
}

/**
 * One mechanic of the simulation. Systems run in a fixed order every tick,
 * read and write the state, and emit events. They never call each other.
 * A new mechanic (stability, diplomacy, elections, ...) is one new system.
 *
 * A system that changes stats in its own way also explains those changes, so
 * a mechanic and its explanation live in the same file:
 *   - `modifierIds` and `explain` for system modifiers it keeps (setSystemModifier);
 *   - `normalOf` and `explain` for base values it moves directly, such as prices.
 */
export interface System {
  readonly name: string;
  run(state: GameState): SystemResult;
  /** IDs of the system modifiers this system keeps, so the why-trace knows whom to ask. */
  readonly modifierIds?: readonly string[];
  /** For a stat whose base value this system moves directly: its normal value. Undefined otherwise. */
  normalOf?(state: GameState, ref: StatRef): number | undefined;
  /** Explain one of this system's modifiers, or a drift it caused. */
  explain?(state: GameState, request: ExplainRequest, context: ExplainContext): WhyNode;
}
