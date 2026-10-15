import type { EngineEvent } from '../events';
import { effectiveStat } from '../modifiers';
import type { GameState } from '../state';
import { isLinkOpen, setBaseStat, sortedIds } from '../world';
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

export function marketDemand(state: GameState, resource: string): number {
  let demand = 0;
  for (const id of sortedIds(state.world.countries)) {
    demand += state.world.countries[id]!.demand[resource] ?? 0;
  }
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
};
