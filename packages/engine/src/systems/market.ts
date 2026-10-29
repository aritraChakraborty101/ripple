import type { EngineEvent } from '../events';
import { effectiveStat } from '../modifiers';
import type { GameState } from '../state';
import { demandStat, isLinkOpen, setBaseStat, sortedIds } from '../world';
import type { MarketWhy, WhyNode } from '../why';
import type { System } from './types';

/** Fraction of the gap to the target price closed each day, in basis points. */
export const PRICE_ADJUST_BP = 1_000;
/** Prices never fall below a quarter or rise above four times the base price. */
export const PRICE_FLOOR_DIVISOR = 4;
export const PRICE_CEILING_MULTIPLIER = 4;
/** A daily move of at least this many basis points emits a price_moved event. */
export const PRICE_EVENT_THRESHOLD_BP = 200;

/** Units per day reaching the world market: open routes only. */
export function marketSupply(state: GameState, resource: string): number {
  let supply = 0;
  for (const id of sortedIds(state.world.links)) {
    const link = state.world.links[id]!;
    if (link.resource !== resource || !isLinkOpen(state.world, link)) continue;
    supply += Math.max(0, effectiveStat(state, { kind: 'link', id, stat: 'capacity' }));
  }
  return supply;
}

/** Units a day a country wants of a resource: its `demand_<resource>` stat, never below zero. */
export function demandOf(state: GameState, country: string, resource: string): number {
  return Math.max(
    0,
    effectiveStat(state, { kind: 'country', id: country, stat: demandStat(resource) }),
  );
}

export function marketDemand(state: GameState, resource: string): number {
  let demand = 0;
  for (const id of sortedIds(state.world.countries)) demand += demandOf(state, id, resource);
  return demand;
}

/** The price the market drifts toward: base price scaled by demand over supply. */
export function targetPrice(basePrice: number, demand: number, supply: number): number {
  const floor = Math.trunc(basePrice / PRICE_FLOOR_DIVISOR);
  const ceiling = basePrice * PRICE_CEILING_MULTIPLIER;
  if (supply <= 0) return demand > 0 ? ceiling : basePrice;
  const raw = Math.trunc((basePrice * demand) / supply);
  return Math.min(ceiling, Math.max(floor, raw));
}

/**
 * Moves each resource's market price part of the way toward its target every
 * day, so shocks build over days instead of jumping. Modifiers (for example
 * "+15% from a crisis") apply on top of this base price when it is read.
 */
export const marketSystem: System = {
  name: 'market',
  run(state) {
    let world = state.world;
    const events: EngineEvent[] = [];

    for (const id of sortedIds(state.world.resources)) {
      const resource = state.world.resources[id]!;
      const price = resource.stats.price ?? resource.basePrice;
      const target = targetPrice(
        resource.basePrice,
        marketDemand(state, id),
        marketSupply(state, id),
      );
      const gap = target - price;
      let move = Math.trunc((gap * PRICE_ADJUST_BP) / 10_000);
      if (move === 0 && gap !== 0) move = Math.sign(gap);
      if (move === 0) continue;

      const next = price + move;
      world = setBaseStat(world, 'resource', id, 'price', next);
      if (Math.abs(move) * 10_000 >= price * PRICE_EVENT_THRESHOLD_BP) {
        events.push({ kind: 'price_moved', tick: state.tick, resource: id, from: price, to: next });
      }
    }

    return { state: world === state.world ? state : { ...state, world }, events };
  },

  /** A price's normal is its base price: where it sits when supply meets demand. */
  normalOf(state, ref) {
    if (ref.kind !== 'resource' || ref.stat !== 'price') return undefined;
    return state.world.resources[ref.id]?.basePrice;
  },

  /** Why a price has drifted: supply against demand, and each route carrying more or less than normal. */
  explain(state, request, context): MarketWhy | WhyNode {
    if (request.kind !== 'drift') return { type: 'system', id: 'market' };
    const resource = request.ref.id;
    const routes: { link: string; delta: number; cause: WhyNode }[] = [];
    for (const id of sortedIds(state.world.links)) {
      const link = state.world.links[id]!;
      if (link.resource !== resource) continue;
      const ref = { kind: 'link' as const, id, stat: 'capacity' };
      const normal = context.baseWithoutAdjustments(ref);
      const open = isLinkOpen(state.world, link);
      const now = open ? Math.max(0, effectiveStat(state, ref)) : 0;
      const delta = now - normal;
      if (delta === 0) continue;
      const closedAt = link.via.find((c) => state.world.chokepoints[c]?.open === false);
      const cause: WhyNode = open
        ? context.explainStat(ref)
        : closedAt
          ? context.explainChokepoint(closedAt)
          : context.explainEmbargo(link.from, link.to);
      routes.push({ link: id, delta, cause });
    }
    routes.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
    // Countries wanting more or less than they normally do, such as under rationing.
    const demands: { country: string; delta: number; cause: WhyNode }[] = [];
    for (const id of sortedIds(state.world.countries)) {
      const ref = { kind: 'country' as const, id, stat: demandStat(resource) };
      const delta = demandOf(state, id, resource) - context.baseWithoutAdjustments(ref);
      if (delta !== 0) demands.push({ country: id, delta, cause: context.explainStat(ref) });
    }
    demands.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
    return {
      type: 'market',
      resource,
      supply: marketSupply(state, resource),
      demand: marketDemand(state, resource),
      routes,
      demands,
    };
  },
};
