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

/**
 * Cooldowns are kept per country, so Thessa courting someone does not stop
 * Corvan doing the same. A `perTarget` order keeps them per target as well.
 */
export function issuedKey(by: string, decision: string, target?: string): string {
  return target === undefined ? `${by}:${decision}` : `${by}:${decision}>${target}`;
}

/** The key a decision's cooldown is kept under for this country and target. */
function cooldownKey(def: DecisionDef, by: string, target?: string): string {
  return issuedKey(by, def.id, def.perTarget ? target : undefined);
}

/**
 * The decision as this country signs it: `self` and `target` placeholders
 * filled in, for computer orders and for any template. Other player orders are
 * returned as written.
 */
export function boundDecision(def: DecisionDef, by: string, target?: string): DecisionDef {
  return def.for === undefined && def.targets === undefined ? def : bindDecision(def, by, target);
}

/** Whether this country already has this order (for this target, if kept per target) pending. */
function isUnderWay(state: GameState, def: DecisionDef, by: string, target?: string): boolean {
  for (const p of state.pending) {
    if (p.decision === def.id && p.by === by && (!def.perTarget || p.target === target)) {
      return true;
    }
  }
  return false;
}

export type Availability = { readonly ok: true } | { readonly ok: false; readonly reason: string };

/**
 * Whether a country can issue a decision right now, and if not, why. Pure.
 * For a template, pass the target; without one, the answer is whether it can
 * be aimed at anyone at all (the first target that works, or the first reason).
 */
export function canIssue(
  state: GameState,
  decisionId: string,
  by: string,
  target?: string,
): Availability {
  const raw = state.defs.decisions[decisionId];
  if (!raw) return { ok: false, reason: `Unknown decision "${decisionId}".` };
  if (raw.targets === undefined) {
    return target === undefined
      ? availabilityOf(state, raw, by)
      : { ok: false, reason: 'This order takes no target.' };
  }
  const targets = targetsOf(state, raw, by);
  if (target !== undefined) {
    if (!targets.includes(target)) return { ok: false, reason: 'Not a valid target.' };
    return availabilityOf(state, boundDecision(raw, by, target), by, target);
  }
  let first: Availability | undefined;
  for (const t of targets) {
    const a = availabilityOf(state, boundDecision(raw, by, t), by, t);
    if (a.ok) return a;
    first ??= a;
  }
  return first ?? { ok: false, reason: 'There is no one to aim this at.' };
}

/**
 * The same checks for a decision definition, which may be a template already
 * bound to a target. The clearing house uses this for computer countries.
 */
export function availabilityOf(
  state: GameState,
  def: DecisionDef,
  by: string,
  target?: string,
): Availability {
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
  if (isUnderWay(state, def, by, target)) return { ok: false, reason: 'Already under way.' };
  // Requirements first: "already in force" says more than a cooldown countdown.
  if (def.requires && !evaluate(state, def.requires).value) {
    return { ok: false, reason: def.unavailableText ?? 'Not possible right now.' };
  }
  const last = state.lastIssued[cooldownKey(def, by, target)];
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
    const availability = availabilityOf(current, def, order.by, order.target);
    if (!availability.ok) {
      reject(availability.reason);
      continue;
    }
    const target = order.target !== undefined ? { target: order.target } : {};
    const source = {
      kind: 'decision' as const,
      id: def.id,
      tick: current.tick,
      by: order.by,
      ...target,
    };
    current = applyEffects(current, def.costs, source);

    const pendingId = `p${current.nextPendingId}`;
    const dueTick = current.tick + def.durationDays;
    current = {
      ...current,
      lastIssued: {
        ...current.lastIssued,
        [cooldownKey(def, order.by, order.target)]: current.tick,
      },
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
