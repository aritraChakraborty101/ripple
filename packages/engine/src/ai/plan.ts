/**
 * The planner: each day, every computer country decides whether to act and
 * what to do. There are no fixed turns. A country's chance of acting today
 * rises with how much its best option beats doing nothing (its urgency) and
 * with its attention, which spikes when something touches it.
 *
 *   1. Skip a country that has an order under way, or is resting after acting.
 *   2. Ask the clearing house for its options; keep those that beat inertia.
 *   3. Roll the daily chance: urgency x attention, capped.
 *   4. Pick one option, weighted by how far it beats inertia (temperature
 *      scales the others against the best).
 *   5. Return it as an order, and record why it was chosen.
 *
 * Every roll uses the game's seeded generator, in country order, so the same
 * seed and the same player orders always give the same choices. A country with
 * nothing worth doing draws nothing.
 */

import { boundDecision, type Order } from '../orders';
import { chance, nextInt } from '../rng';
import type { GameState } from '../state';
import { explainStat, SNAPSHOT_DEPTH, type ChoiceRecord, type WhyNode } from '../why';
import { computerCountries, rankOpen, type ScoreReport } from './clearing-house';
import { FULL } from './curves';
import { goalRef } from './goals';
import { measureRef } from './measures';

/** A computer country's attention, kept in the game state. */
export interface AttentionState {
  /** The day it last acted, or null. */
  readonly lastActed: number | null;
  /** It is noticing something until this day: attention is boosted. */
  readonly noticeUntil: number;
}

export const FRESH_ATTENTION: AttentionState = { lastActed: null, noticeUntil: 0 };

export interface Plan {
  /** The state with the generator advanced, choices recorded and attention updated. */
  readonly state: GameState;
  readonly orders: readonly Order[];
}

function attentionOf(state: GameState, country: string): AttentionState {
  return state.attention[country] ?? FRESH_ATTENTION;
}

/** The daily chance of acting, in basis points. */
export function dailyChance(state: GameState, country: string, urgency: number): number {
  const tuning = state.defs.ai!.tuning;
  let attention = tuning.attention;
  if (attentionOf(state, country).noticeUntil > state.tick) {
    attention = Math.trunc((attention * tuning.noticeBoost) / FULL);
  }
  // Urgency is in hundredths of a point; attention is basis points per point.
  return Math.min(tuning.maxDailyChance, Math.trunc((urgency * attention) / 100));
}

/** Whether a country may act today at all: nothing under way, and not resting. */
export function isFree(state: GameState, country: string): boolean {
  if (state.pending.some((p) => p.by === country)) return false;
  const { lastActed } = attentionOf(state, country);
  return lastActed === null || state.tick >= lastActed + state.defs.ai!.tuning.restDays;
}

/** The options worth taking: available, not doing nothing, and above inertia, best first. */
export function worthTaking(state: GameState, country: string): ScoreReport[] {
  const inertia = state.defs.ai!.tuning.inertia;
  return rankOpen(state, country).filter((r) => r.available && r.score > inertia);
}

/** The stats behind a choice's goals and considerations, explained now, biggest part first. */
function reasonsFor(state: GameState, report: ScoreReport): WhyNode[] {
  const raw = state.defs.decisions[report.decision]!;
  const def = boundDecision(raw, report.country, report.target);
  const refs = [
    ...[...report.goals]
      .filter((g) => g.part > 0)
      .sort((a, b) => b.part - a.part)
      .map((g) => goalRef(report.country, g.goal)),
    ...(def.consider ?? []).map((c) => measureRef(c.measure)),
  ];
  const seen = new Set<string>();
  const because: WhyNode[] = [];
  for (const ref of refs) {
    if (!ref) continue;
    const key = `${ref.kind}.${ref.id}.${ref.stat}`;
    if (seen.has(key)) continue;
    seen.add(key);
    because.push(explainStat(state, ref, SNAPSHOT_DEPTH));
  }
  return because;
}

function pick(
  state: GameState,
  options: readonly ScoreReport[],
): { state: GameState; index: number } {
  const { inertia, temperature } = state.defs.ai!.tuning;
  const weights = options.map((o, i) => {
    const above = o.score - inertia;
    return i === 0 ? above : Math.trunc((above * temperature) / FULL);
  });
  const total = weights.reduce((sum, w) => sum + w, 0);
  if (options.length === 1 || total <= weights[0]!) return { state, index: 0 };
  const draw = nextInt(state.rng, 0, total - 1);
  let index = 0;
  for (let rest = draw.value; rest >= weights[index]!; index += 1) rest -= weights[index]!;
  return { state: { ...state, rng: draw.next }, index };
}

/** Decide what every computer country does today. */
export function planOrders(state: GameState): Plan {
  if (!state.defs.ai) return { state, orders: [] };
  let current = state;
  const orders: Order[] = [];

  for (const country of computerCountries(state)) {
    if (!isFree(current, country)) continue;
    const options = worthTaking(current, country);
    if (options.length === 0) continue;

    const urgency = options[0]!.score - current.defs.ai!.tuning.inertia;
    const odds = dailyChance(current, country, urgency);
    if (odds <= 0) continue;
    const roll = chance(current.rng, odds);
    current = { ...current, rng: roll.next };
    if (!roll.value) continue;

    const picked = pick(current, options);
    current = picked.state;
    const chosen = options[picked.index]!;
    const runnerUp = options.find((_, i) => i !== picked.index);

    const record: ChoiceRecord = {
      country,
      decision: chosen.decision,
      ...(chosen.target !== undefined ? { target: chosen.target } : {}),
      tick: current.tick,
      score: chosen.score,
      ...(chosen.ambition !== undefined ? { ambition: chosen.ambition } : {}),
      goals: chosen.goals,
      appeal: chosen.appeal,
      runnerUp: runnerUp
        ? {
            decision: runnerUp.decision,
            ...(runnerUp.target !== undefined ? { target: runnerUp.target } : {}),
            score: runnerUp.score,
          }
        : null,
      because: reasonsFor(current, chosen),
    };
    current = {
      ...current,
      trace: { ...current.trace, choices: [...current.trace.choices, record] },
      attention: {
        ...current.attention,
        [country]: { ...attentionOf(current, country), lastActed: current.tick },
      },
    };
    orders.push({
      kind: 'decide',
      decision: chosen.decision,
      by: country,
      ...(chosen.target !== undefined ? { target: chosen.target } : {}),
    });
  }

  return { state: current, orders };
}
