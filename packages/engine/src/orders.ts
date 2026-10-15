/**
 * Orders are how players (and later computer countries) act on the world.
 * An order names a decision; signing it pays its costs now and schedules its
 * outcome for later. Orders are plain data, so a game can be replayed from its
 * seed and the list of orders with the tick each was given.
 */

import type { EngineEvent } from './events';
import { applyEffects, evaluate } from './rules';
import type { GameState } from './state';

export interface Order {
  readonly kind: 'decide';
  readonly decision: string;
  /** The country giving the order. */
  readonly by: string;
}

export type Availability = { readonly ok: true } | { readonly ok: false; readonly reason: string };

/** Whether a country can issue a decision right now, and if not, why. Pure. */
export function canIssue(state: GameState, decisionId: string, by: string): Availability {
  if (state.outcome) return { ok: false, reason: 'The game is over.' };
  const def = state.defs.decisions[decisionId];
  if (!def) return { ok: false, reason: `Unknown decision "${decisionId}".` };
  if (by !== state.rules.playerCountry) {
    return { ok: false, reason: 'Only the player issues decisions for now.' };
  }
  if (state.pending.some((p) => p.decision === decisionId)) {
    return { ok: false, reason: 'Already under way.' };
  }
  // Requirements first: "already in force" says more than a cooldown countdown.
  if (def.requires && !evaluate(state, def.requires).value) {
    return { ok: false, reason: def.unavailableText ?? 'Not possible right now.' };
  }
  const last = state.lastIssued[decisionId];
  if (last !== undefined && state.tick < last + def.cooldownDays) {
    const days = last + def.cooldownDays - state.tick;
    return { ok: false, reason: `Available again in ${days} ${days === 1 ? 'day' : 'days'}.` };
  }
  return { ok: true };
}

/**
 * Sign orders at the current tick, without advancing time: costs are paid and
 * outcomes scheduled. Invalid orders are rejected with an event, never thrown,
 * because they can arrive from a player at any moment.
 */
export function applyOrders(
  state: GameState,
  orders: readonly Order[],
): { state: GameState; events: EngineEvent[] } {
  let current = state;
  const events: EngineEvent[] = [];

  for (const order of orders) {
    const availability = canIssue(current, order.decision, order.by);
    if (!availability.ok) {
      events.push({
        kind: 'order_rejected',
        tick: current.tick,
        decision: order.decision,
        reason: availability.reason,
      });
      continue;
    }
    const def = current.defs.decisions[order.decision]!;
    const source = { kind: 'decision' as const, id: def.id, tick: current.tick };
    current = applyEffects(current, def.costs, source);

    const pendingId = `p${current.nextPendingId}`;
    const dueTick = current.tick + def.durationDays;
    current = {
      ...current,
      lastIssued: { ...current.lastIssued, [def.id]: current.tick },
      pending: [
        ...current.pending,
        { id: pendingId, decision: def.id, by: order.by, issuedTick: current.tick, dueTick },
      ],
      nextPendingId: current.nextPendingId + 1,
    };
    events.push({
      kind: 'decision_issued',
      tick: current.tick,
      decision: def.id,
      pendingId,
      dueTick,
    });
  }

  return { state: current, events };
}
