/**
 * The clearing house: the one place AI scores come from. Anything that needs
 * to know "how good is this action for this country right now?" asks here:
 * computer countries choosing what to do, the advisor's warnings, the
 * why-trace, the dev panel and the balance tool. Every answer carries the
 * breakdown that produced it.
 *
 * Pure: asking never changes the game.
 *
 *   value  = sum over goals of weight x need x drive   (ambition and tuning adjust weights)
 *   appeal = product of the considerations' curves      (with compensation)
 *   score  = value x appeal x odds of success x the action's tuning multiplier
 *
 * Doing nothing always scores the tuning's inertia; only actions that beat it
 * are worth taking.
 */

import { availabilityOf } from '../orders';
import type { DecisionDef } from '../rules';
import type { GameState } from '../state';
import { sortedIds } from '../world';
import { curveLabel, curveValue, FULL } from './curves';
import { currentAmbition, goalNeed, parseGoalId } from './goals';
import { measureLabel, readMeasure } from './measures';
import { bindDecision, bindRequires, isFor, targetsOf } from './templates';
import type { AiDef, Personality, Tuning } from './types';

/** The decision ID that stands for doing nothing in a ranking. */
export const NOTHING = 'nothing';

export interface ScoreQuery {
  readonly country: string;
  readonly decision: string;
  readonly target?: string;
}

/** One goal's share of an action's value. */
export interface GoalPart {
  readonly goal: string;
  /** After ambition and tuning, in hundredths (3500 = weight 35). */
  readonly weight: number;
  readonly need: number;
  readonly drive: number;
  /** weight x need x drive, in hundredths of a point. */
  readonly part: number;
}

/** One consideration's effect on an action's appeal. */
export interface AppealPart {
  readonly measure: string;
  readonly value: number;
  readonly curve: string;
  /** The curve's output, in basis points. */
  readonly factor: number;
  /** Applied after the others are combined (see `Consideration.gate`). */
  readonly gate?: boolean;
}

export interface ScoreReport {
  readonly country: string;
  readonly decision: string;
  readonly target?: string;
  readonly available: boolean;
  /** Why it is not available, when it is not. */
  readonly reason?: string;
  /** The country's current ambition, if any. */
  readonly ambition?: string;
  readonly goals: readonly GoalPart[];
  /** Sum of the goal parts, in hundredths of a point. */
  readonly value: number;
  readonly appeal: readonly AppealPart[];
  /** Combined appeal after compensation, in basis points. */
  readonly appealTotal: number;
  /** Odds of success, in basis points. */
  readonly odds: number;
  /** The action's tuning multiplier, in basis points. */
  readonly multiplier: number;
  /** In hundredths of a point. Doing nothing scores the inertia. */
  readonly score: number;
}

function aiOf(state: GameState): AiDef {
  const ai = state.defs.ai;
  if (!ai) throw new Error('This scenario has no AI definitions');
  return ai;
}

function personalityOf(state: GameState, country: string): Personality {
  const personality = aiOf(state).personalities[country];
  if (!personality) throw new Error(`"${country}" has no personality`);
  return personality;
}

/**
 * Multiplying many 0-to-1 factors drags a score down just for having more of
 * them. Each factor is lifted toward 1 in proportion to how many there are
 * (Dave Mark's compensation factor), so the number of checks stops mattering.
 */
function combineAppeal(factors: readonly number[], compensate: boolean): number {
  if (factors.length === 0) return FULL;
  const n = factors.length;
  let total = FULL;
  for (const f of factors) {
    let adjusted = f;
    if (compensate && n > 1) {
      // makeUp = (1 - f) * (1 - 1/n); adjusted = f + makeUp * f
      const makeUp = Math.trunc(((FULL - f) * (FULL - Math.trunc(FULL / n))) / FULL);
      adjusted = f + Math.trunc((makeUp * f) / FULL);
    }
    total = Math.trunc((total * adjusted) / FULL);
  }
  return total;
}

function goalWeight(tuning: Tuning, country: string, goalId: string, base: number): number {
  return tuning.countries[country]?.weights?.[goalId] ?? base;
}

function scoreBound(
  state: GameState,
  country: string,
  def: DecisionDef,
  target: string | undefined,
): ScoreReport {
  const ai = aiOf(state);
  const { tuning } = ai;
  const personality = personalityOf(state, country);
  const bound = bindDecision(def, country, target);
  const ambition = currentAmbition(state, country, personality);

  // Value: how much the action moves the country toward what it needs.
  const goals: GoalPart[] = [];
  for (const goal of personality.goals) {
    const drive = bound.drives?.[goal.id] ?? 0;
    if (drive === 0) continue;
    let weight = goalWeight(tuning, country, goal.id, goal.weight) * 100;
    if (ambition?.goal === goal.id) weight = Math.trunc((weight * tuning.ambitionBoost) / FULL);
    const kind = parseGoalId(goal.id)?.kind;
    if (kind === 'grievance') weight = Math.trunc((weight * tuning.hostility) / FULL);
    if (kind === 'ties') weight = Math.trunc((weight * tuning.cooperation) / FULL);
    const need = goalNeed(state, country, goal);
    goals.push({
      goal: goal.id,
      weight,
      need,
      drive,
      part: Math.trunc((weight * need * drive) / FULL),
    });
  }
  const value = goals.reduce((sum, g) => sum + g.part, 0);

  // Appeal: how well the moment suits it.
  const appeal: AppealPart[] = (bound.consider ?? []).map((c) => {
    const measured = readMeasure(state, c.measure);
    return {
      measure: measureLabel(c.measure),
      value: measured,
      curve: curveLabel(c.curve),
      factor: curveValue(c.curve, measured),
      ...(c.gate ? { gate: true } : {}),
    };
  });
  const appealTotal = appeal
    .filter((a) => a.gate)
    .reduce(
      (total, a) => Math.trunc((total * a.factor) / FULL),
      combineAppeal(
        appeal.filter((a) => !a.gate).map((a) => a.factor),
        tuning.compensation,
      ),
    );

  const actionTuning = tuning.actions[def.id];
  const multiplier = actionTuning?.scoreMultiplier ?? FULL;
  let score = Math.trunc((value * appealTotal) / FULL);
  score = Math.trunc((score * def.chanceBp) / FULL);
  score = Math.trunc((score * multiplier) / FULL);

  const availability =
    actionTuning?.enabled === false
      ? { ok: false as const, reason: 'Switched off by tuning.' }
      : availabilityOf(state, bound, country, target);

  return {
    country,
    decision: def.id,
    ...(target !== undefined ? { target } : {}),
    available: availability.ok,
    ...(availability.ok ? {} : { reason: availability.reason }),
    ...(ambition ? { ambition: ambition.id } : {}),
    goals,
    value,
    appeal,
    appealTotal,
    odds: def.chanceBp,
    multiplier,
    score,
  };
}

function nothingReport(state: GameState, country: string): ScoreReport {
  const ambition = currentAmbition(state, country, personalityOf(state, country));
  return {
    country,
    decision: NOTHING,
    available: true,
    ...(ambition ? { ambition: ambition.id } : {}),
    goals: [],
    value: 0,
    appeal: [],
    appealTotal: FULL,
    odds: FULL,
    multiplier: FULL,
    score: aiOf(state).tuning.inertia,
  };
}

/** Score one action for one country, aimed at a target if it is a template. */
export function score(state: GameState, query: ScoreQuery): ScoreReport {
  if (query.decision === NOTHING) return nothingReport(state, query.country);
  const def = state.defs.decisions[query.decision];
  if (!def) throw new Error(`Unknown decision "${query.decision}"`);
  if (!isFor(state, def, query.country)) {
    throw new Error(`"${query.country}" cannot sign "${query.decision}"`);
  }
  if (def.targets !== undefined && query.target === undefined) {
    throw new Error(`"${query.decision}" needs a target`);
  }
  return scoreBound(state, query.country, def, query.target);
}

/** Every action and target a country could consider, in a stable order. */
export function candidates(state: GameState, country: string): ScoreQuery[] {
  const out: ScoreQuery[] = [];
  for (const id of sortedIds(state.defs.decisions)) {
    const def = state.defs.decisions[id]!;
    if (!isFor(state, def, country)) continue;
    for (const target of targetsOf(state, def, country)) {
      out.push(
        target === undefined ? { country, decision: id } : { country, decision: id, target },
      );
    }
  }
  return out;
}

/**
 * Every option a country has, doing nothing included: available ones first,
 * best score first; unavailable ones after, with their reasons.
 */
export function rank(state: GameState, country: string): ScoreReport[] {
  const reports = [
    nothingReport(state, country),
    ...candidates(state, country).map((q) => score(state, q)),
  ];
  const order = (r: ScoreReport) => (r.available ? 0 : 1);
  // A stable sort keeps the candidate order for ties, so rankings are deterministic.
  return reports.sort((a, b) => order(a) - order(b) || b.score - a.score);
}

/** Whether an option is open to its country right now, checked without scoring it. */
function isOpen(state: GameState, query: ScoreQuery): boolean {
  const def = state.defs.decisions[query.decision];
  if (!def) return false;
  if (aiOf(state).tuning.actions[def.id]?.enabled === false) return false;
  const bound = bindRequires(def, query.country, query.target);
  return availabilityOf(state, bound, query.country, query.target).ok;
}

/**
 * The options a country can take right now, scored, best first: `rank`
 * without the options that are closed and without doing nothing. The planner
 * runs this every day for every country, so closed options (most templates
 * aimed at Aldoria, most of the time) are skipped before they are scored. Same
 * order as `rank`, so choices do not change.
 */
export function rankOpen(state: GameState, country: string): ScoreReport[] {
  return candidates(state, country)
    .filter((q) => isOpen(state, q))
    .map((q) => score(state, q))
    .sort((a, b) => b.score - a.score);
}

/** How far the best available option beats doing nothing, in hundredths of a point; 0 if none does. */
export function urgency(state: GameState, country: string): number {
  const best = rank(state, country)[0]!;
  return Math.max(0, best.score - aiOf(state).tuning.inertia);
}

/** The countries the AI plays: those with a personality, in ID order. */
export function computerCountries(state: GameState): readonly string[] {
  return state.defs.ai ? sortedIds(state.defs.ai.personalities) : [];
}
