/**
 * Modifiers: every change to a stat is stored with its source and duration
 * instead of overwriting the number. This is what makes temporary effects
 * stack cleanly and what powers the why-trace.
 *
 *   effective = (base + sum of "add" modifiers) * (10000 + sum of "pct" basis points) / 10000
 *
 * All values are integers; the percent step truncates toward zero.
 */

import type { GameState } from './state';
import { getStatEntity, type StatEntityKind } from './world';

export interface StatRef {
  readonly kind: StatEntityKind;
  readonly id: string;
  readonly stat: string;
}

export interface ModifierSource {
  readonly kind: 'event' | 'decision' | 'system' | 'scenario';
  readonly id: string;
  /** Tick at which the source created this modifier. */
  readonly tick: number;
}

export interface Modifier {
  readonly id: string;
  readonly target: StatRef;
  /** "add": a flat integer amount. "pct": basis points, so 1500 = +15%. */
  readonly op: 'add' | 'pct';
  readonly amount: number;
  readonly source: ModifierSource;
  /** The modifier is removed at the start of this tick. Null means permanent. */
  readonly expiresAt: number | null;
}

export type NewModifier = Omit<Modifier, 'id'>;

export function addModifier(state: GameState, modifier: NewModifier): GameState {
  if (!Number.isInteger(modifier.amount)) {
    throw new Error(`Modifier amounts must be integers, got ${modifier.amount}`);
  }
  getStatEntity(state.world, modifier.target.kind, modifier.target.id); // throws if unknown
  const id = `m${state.nextModifierId}`;
  return {
    ...state,
    modifiers: [...state.modifiers, { ...modifier, id }],
    nextModifierId: state.nextModifierId + 1,
  };
}

function sameTarget(a: StatRef, b: StatRef): boolean {
  return a.kind === b.kind && a.id === b.id && a.stat === b.stat;
}

export interface StatBreakdown {
  readonly target: StatRef;
  readonly base: number;
  readonly modifiers: readonly Modifier[];
  readonly value: number;
}

/** The effective value of a stat and everything that contributed to it. */
export function statBreakdown(state: GameState, target: StatRef): StatBreakdown {
  const entity = getStatEntity(state.world, target.kind, target.id);
  const base = entity.stats[target.stat] ?? 0;
  const modifiers = state.modifiers.filter((m) => sameTarget(m.target, target));

  let added = base;
  let percent = 0;
  for (const m of modifiers) {
    if (m.op === 'add') added += m.amount;
    else percent += m.amount;
  }
  const value = Math.trunc((added * (10_000 + percent)) / 10_000);
  return { target, base, modifiers, value };
}

export function effectiveStat(state: GameState, target: StatRef): number {
  return statBreakdown(state, target).value;
}
