/**
 * Orders are how players (and later computer countries) act on the world.
 * An order names a decision; signing it pays its costs now and schedules its
 * outcome for later. Orders are plain data, so a game can be replayed from its
 * seed and the list of orders with the tick each was given.
 */

import { bindDecision, isFor, targetsOf } from './ai/templates';
import type { EngineEvent } from './events';
import { applyEffects, evaluate, type DecisionDef } from './rules';
import type { GameState } from './state';

export interface Order {
  readonly kind: 'decide';
  readonly decision: string;
  /** The country giving the order. */
  readonly by: string;
  /** For templates: the country the order is aimed at. */
  readonly target?: string;
}

/** Cooldowns are kept per country, so Thessa courting someone does not stop Corvan doing the same. */
export function issuedKey(by: string, decision: string): string {
  return `${by}:${decision}`;
}

/**
 * The decision as this country signs it: a computer order's `self` and
 * `target` placeholders filled in. Player orders are returned as written.
 */
export function boundDecision(def: DecisionDef, by: string, target?: string): DecisionDef {
  return def.for === undefined ? def : bindDecision(def, by, target);
}

export type Availability = { readonly ok: true } | { readonly ok: false; readonly reason: string };

/** Whether a country can issue a decision right now, and if not, why. Pure. */
export function canIssue(state: GameState, decisionId: string, by: string): Availability {
  const def = state.defs.decisions[decisionId];
  if (!def) return { ok: false, reason: `Unknown decision "${decisionId}".` };
  return availabilityOf(state, def, by);
}

/**
 * The same checks for a decision definition, which may be a template already
 * bound to a target. The clearing house uses this for computer countries.
 */
export function availabilityOf(state: GameState, def: DecisionDef, by: string): Availability {
  if (state.outcome) return { ok: false, reason: 'The game is over.' };
  if (!isFor(state, def, by)) {
    return {
      ok: false,
      reason:
        by === state.rules.playerCountry
          ? 'That order is not yours to give.'
          : 'Only the player gives this order.',
    };
  }
  if (state.pending.some((p) => p.decision === def.id && p.by === by)) {
    return { ok: false, reason: 'Already under way.' };
  }
  // Requirements first: "already in force" says more than a cooldown countdown.
  if (def.requires && !evaluate(state, def.requires).value) {
    return { ok: false, reason: def.unavailableText ?? 'Not possible right now.' };
  }
  const last = state.lastIssued[issuedKey(by, def.id)];
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
    const reject = (reason: string) =>
      events.push({ kind: 'order_rejected', tick: current.tick, decision: order.decision, reason });
    const raw = current.defs.decisions[order.decision];
    if (!raw) {
      reject(`Unknown decision "${order.decision}".`);
      continue;
    }
    if (raw.targets !== undefined) {
      if (order.target === undefined || !targetsOf(current, raw, order.by).includes(order.target)) {
        reject('This order needs a valid target.');
        continue;
      }
    } else if (order.target !== undefined) {
      reject('This order takes no target.');
      continue;
    }
    const def = boundDecision(raw, order.by, order.target);
    const availability = availabilityOf(current, def, order.by);
    if (!availability.ok) {
      reject(availability.reason);
      continue;
    }
    const target = order.target !== undefined ? { target: order.target } : {};
    const source = { kind: 'decision' as const, id: def.id, tick: current.tick, by: order.by };
    current = applyEffects(current, def.costs, source);

    const pendingId = `p${current.nextPendingId}`;
    const dueTick = current.tick + def.durationDays;
    current = {
      ...current,
      lastIssued: { ...current.lastIssued, [issuedKey(order.by, def.id)]: current.tick },
      pending: [
        ...current.pending,
        {
          id: pendingId,
          decision: def.id,
          by: order.by,
          ...target,
          issuedTick: current.tick,
          dueTick,
        },
      ],
      nextPendingId: current.nextPendingId + 1,
    };
    events.push({
      kind: 'decision_issued',
      tick: current.tick,
      decision: def.id,
      by: order.by,
      ...target,
      pendingId,
      dueTick,
    });
  }

  return { state: current, events };
}
