/**
 * Goals and needs: why a country acts on its own. Each goal reads one measure
 * from the state; its need is how far that measure is from where the country
 * wants it, from 0 to 10000 basis points. Needs exist in a calm world too, so
 * countries have reasons to act before anything goes wrong.
 */

import type { StatRef } from '../modifiers';
import type { GameState } from '../state';
import { effectiveStat } from '../modifiers';
import { marketDemand, marketSupply } from '../systems';
import { sortedIds } from '../world';
import { FULL } from './curves';
import { measureRef, readMeasure } from './measures';
import type { AmbitionDef, GoalDef, GoalKind, Personality } from './types';

/** Relations this bad make grievance (and insecurity) a full need. */
export const GRIEVANCE_FULL = 60;
/** A monthly result this far below where a country wants it (millions) is a full need. */
export const BALANCE_FULL = 5_000;
/** A supply this many points below where a country wants it (percent of demand) is a full need. */
export const SUPPLY_FULL = 50;

export const GOAL_KINDS: readonly GoalKind[] = [
  'wealth',
  'standing',
  'security',
  'prices',
  'ties',
  'grievance',
  'balance',
  'supply',
];

/** Goals that take an argument in brackets, and what kind of thing it names. */
export const GOAL_ARGUMENT: Readonly<Partial<Record<GoalKind, 'country' | 'resource'>>> = {
  prices: 'resource',
  supply: 'resource',
  ties: 'country',
  grievance: 'country',
};

export interface ParsedGoal {
  readonly kind: GoalKind;
  readonly arg?: string;
}

/** Split a goal ID such as `ties(thessa)` into its kind and argument. Null if malformed. */
export function parseGoalId(id: string): ParsedGoal | null {
  const match = /^([a-z]+)(?:\(([a-z][a-z0-9_]*)\))?$/.exec(id);
  if (!match) return null;
  const kind = match[1] as GoalKind;
  if (!GOAL_KINDS.includes(kind)) return null;
  const arg = match[2];
  const needsArg = GOAL_ARGUMENT[kind] !== undefined;
  if (needsArg !== (arg !== undefined)) return null;
  return arg === undefined ? { kind } : { kind, arg };
}

const clampNeed = (value: number) => Math.min(FULL, Math.max(0, value));

/** The number a goal is about, read from the state for one country. */
export function goalMeasure(state: GameState, country: string, goalId: string): number {
  const goal = parseGoalId(goalId);
  if (!goal) throw new Error(`Malformed goal "${goalId}"`);
  switch (goal.kind) {
    case 'wealth':
      return readMeasure(state, {
        kind: 'stat',
        ref: { kind: 'country', id: country, stat: 'treasury' },
      });
    case 'standing':
      return readMeasure(state, {
        kind: 'stat',
        ref: { kind: 'country', id: country, stat: 'influence' },
      });
    case 'prices':
      return readMeasure(state, { kind: 'price', resource: goal.arg! });
    case 'ties':
    case 'grievance':
      return readMeasure(state, { kind: 'relation', between: [country, goal.arg!] });
    case 'security':
      return worstRelationWithStronger(state, country);
    case 'balance':
      // This month's rate, revenue minus spending in millions a month, as the
      // economy last kept it: at most a day old, and cheap to read.
      return (
        effectiveStat(state, { kind: 'country', id: country, stat: 'revenue' }) -
        effectiveStat(state, { kind: 'country', id: country, stat: 'spending' })
      );
    case 'supply':
      // How much of the world's demand for a resource is being met, in percent.
      return supplyPercent(state, goal.arg!);
  }
}

/** Supply over demand for a resource, in percent; 100 when nobody wants any. */
export function supplyPercent(state: GameState, resource: string): number {
  const demand = marketDemand(state, resource);
  if (demand <= 0) return 100;
  return Math.trunc((marketSupply(state, resource) * 100) / demand);
}

/** Its worst relation with any country that has a bigger military; 0 if none is bigger. */
function worstRelationWithStronger(state: GameState, country: string): number {
  const military = (id: string) => state.world.countries[id]?.stats.military ?? 0;
  let worst = 0;
  for (const other of sortedIds(state.world.countries)) {
    if (other === country || military(other) <= military(country)) continue;
    worst = Math.min(worst, readMeasure(state, { kind: 'relation', between: [country, other] }));
  }
  return worst;
}

/** How much a country needs a goal right now, from 0 to 10000. */
export function goalNeed(state: GameState, country: string, goal: GoalDef): number {
  const parsed = parseGoalId(goal.id);
  if (!parsed) throw new Error(`Malformed goal "${goal.id}"`);
  const value = goalMeasure(state, country, goal.id);
  if (parsed.kind === 'grievance' || parsed.kind === 'security') {
    // Grows as relations sour: none at 0 or better, full at -GRIEVANCE_FULL.
    return clampNeed(Math.trunc((-value * FULL) / GRIEVANCE_FULL));
  }
  if (parsed.kind === 'balance') {
    // Grows as the budget falls short of where the country wants it (0 by default).
    return clampNeed(Math.trunc((((goal.aspire ?? 0) - value) * FULL) / BALANCE_FULL));
  }
  if (parsed.kind === 'supply') {
    // Grows as supply falls short of demand (or of what the country aspires to).
    return clampNeed(Math.trunc((((goal.aspire ?? 100) - value) * FULL) / SUPPLY_FULL));
  }
  const aspire = goal.aspire ?? 0;
  if (aspire <= 0) return value < aspire ? FULL : 0;
  return clampNeed(Math.trunc(((aspire - value) * FULL) / aspire));
}

/** The first ambition not yet met, if any. */
export function currentAmbition(
  state: GameState,
  country: string,
  personality: Personality,
): AmbitionDef | undefined {
  return personality.ambitions.find((a) => goalMeasure(state, country, a.goal) < a.target);
}

/** The stat a goal reads, so the why-trace can explain it; null for security, which reads several. */
export function goalRef(country: string, goalId: string): StatRef | null {
  const goal = parseGoalId(goalId);
  if (!goal) throw new Error(`Malformed goal "${goalId}"`);
  switch (goal.kind) {
    case 'wealth':
      return { kind: 'country', id: country, stat: 'treasury' };
    case 'standing':
      return { kind: 'country', id: country, stat: 'influence' };
    case 'prices':
      return measureRef({ kind: 'price', resource: goal.arg! });
    case 'ties':
    case 'grievance':
      return measureRef({ kind: 'relation', between: [country, goal.arg!] });
    case 'supply':
      return measureRef({ kind: 'price', resource: goal.arg! });
    case 'security':
    case 'balance':
      return null;
  }
}
