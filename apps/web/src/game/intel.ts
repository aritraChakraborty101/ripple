/**
 * Intelligence: what the other countries want, and which harmful moves they
 * are close to making. Everything here asks the engine's clearing house, so
 * the warnings use the very scores the countries decide by. Reading never
 * changes the game.
 *
 * A move is harmful if its content gives it a warning or critical severity
 * (closing a strait, raising fees, cutting output). It is "being weighed" once
 * its score reaches WARN_AT of the inertia it must beat, or WARN_AT_FILE when
 * the player keeps an intelligence file on that country.
 */

import {
  FULL,
  computerCountries,
  effectiveStat,
  currentAmbition,
  goalMeasure,
  goalNeed,
  rank,
  type GameState,
  type ScoreReport,
} from '@ripple/engine';
import { fillNames } from './format';
import { goalLabel, motiveText } from './why';

/** A harmful move is reported once its score reaches this share of inertia, in basis points. */
export const WARN_AT = 8_000;
/** With an intelligence file open on a country, its moves are reported this much earlier. */
export const WARN_AT_FILE = 5_500;
/** The same warning is not repeated within this many days. */
export const REWARN_DAYS = 60;

export interface Brewing {
  readonly country: string;
  readonly decision: string;
  readonly target?: string;
  /** The move in words, such as "Close the South Strait". */
  readonly name: string;
  /** Its score and the inertia it must beat, in hundredths of a point. */
  readonly score: number;
  readonly inertia: number;
  /** What mostly drives it, such as "a grudge against Aldoria (need 75%)". */
  readonly motive: string | null;
}

/** Whether content marks a move as one that hurts. */
function isHarmful(game: GameState, decision: string): boolean {
  const severity = game.defs.decisions[decision]?.severity;
  return severity === 'warning' || severity === 'critical';
}

function toBrewing(game: GameState, r: ScoreReport): Brewing {
  const def = game.defs.decisions[r.decision]!;
  return {
    country: r.country,
    decision: r.decision,
    ...(r.target !== undefined ? { target: r.target } : {}),
    name: fillNames(def.name, game.world.countries, r.country, r.target),
    score: r.score,
    inertia: game.defs.ai!.tuning.inertia,
    motive: motiveText(game, r.goals),
  };
}

/**
 * Whether the player keeps an intelligence file on a country: the stat
 * `intel_<country>` on the player's country, raised for a while by the
 * intel_file order.
 */
export function hasFile(game: GameState, country: string): boolean {
  const me = game.rules.playerCountry;
  return effectiveStat(game, { kind: 'country', id: me, stat: `intel_${country}` }) > 0;
}

/** Each computer country's most tempting harmful move, if it is close to tipping over. Strongest first. */
export function brewing(game: GameState): Brewing[] {
  if (!game.defs.ai || game.outcome) return [];
  const { inertia } = game.defs.ai.tuning;
  const out: Brewing[] = [];
  for (const country of computerCountries(game)) {
    const share = hasFile(game, country) ? WARN_AT_FILE : WARN_AT;
    const threshold = Math.trunc((inertia * share) / FULL);
    const top = rank(game, country).find(
      (r) => r.available && isHarmful(game, r.decision) && r.score >= threshold,
    );
    if (top) out.push(toBrewing(game, top));
  }
  return out.sort((a, b) => b.score - a.score);
}

/** The key that identifies one warning, so it is not repeated too often. */
export function brewingKey(b: Brewing): string {
  return `${b.country}:${b.decision}${b.target ? `:${b.target}` : ''}`;
}

export interface Want {
  readonly goal: string;
  /** The goal in words, such as "closer ties with Thessa". */
  readonly label: string;
  /** 0 to 10000. */
  readonly need: number;
}

/** What a computer country wants most right now: its goals ordered by weight times need. */
export function wantsOf(game: GameState, country: string, limit = 3): Want[] {
  const personality = game.defs.ai?.personalities[country];
  if (!personality) return [];
  return personality.goals
    .map((g) => ({
      goal: g.id,
      label: goalLabel(game, g.id),
      need: goalNeed(game, country, g),
      weight: g.weight,
    }))
    .filter((w) => w.need > 0)
    .sort((a, b) => b.need * b.weight - a.need * a.weight)
    .slice(0, limit)
    .map(({ goal, label, need }) => ({ goal, label, need }));
}

export interface AmbitionView {
  readonly name: string;
  readonly current: number;
  readonly target: number;
}

/** A computer country's current ambition and how far along it is. */
export function ambitionOf(game: GameState, country: string): AmbitionView | null {
  const personality = game.defs.ai?.personalities[country];
  if (!personality) return null;
  const ambition = currentAmbition(game, country, personality);
  if (!ambition) return null;
  return {
    name: ambition.name,
    current: goalMeasure(game, country, ambition.goal),
    target: ambition.target,
  };
}

/** A need in words: how strongly a country feels it. */
export function needWord(need: number): string {
  if (need >= 6_600) return 'strongly';
  if (need >= 3_300) return 'somewhat';
  return 'a little';
}
