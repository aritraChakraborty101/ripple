import type { StatRef } from '../modifiers';
import { effectiveStat } from '../modifiers';
import type { GameState, Shipment } from '../state';
import type { StockWhy, WhyNode } from '../why';
import {
  demandStat,
  isLinkOpen,
  setBaseStat,
  shortageStat,
  sortedIds,
  stockStat,
  type World,
} from '../world';
import type { ExplainContext, System } from './types';

/**
 * A sender keeps this share of its own normal stock for itself and exports
 * only what is above it, in basis points. A refinery country serves itself first.
 */
export const KEEP_FOR_SELF_BP = 5_000;
/**
 * Wells stop pumping once crude piles up beyond this many days of their output:
 * with nowhere to send it, it stays in the ground.
 */
export const WELL_STORAGE_DAYS = 20;

const stockOf = (world: World, country: string, resource: string) =>
  world.countries[country]?.stats[stockStat(resource)] ?? 0;

function setStock(world: World, country: string, resource: string, units: number): World {
  return setBaseStat(world, 'country', country, stockStat(resource), units);
}

/** Units a day a plant can work right now: its capacity with modifiers, never below zero. */
export function plantCapacity(state: GameState, plant: string): number {
  return Math.max(0, effectiveStat(state, { kind: 'plant', id: plant, stat: 'capacity' }));
}

/** Units of a resource at sea or on the road, in total. */
export function inTransit(state: GameState, resource: string): number {
  let units = 0;
  for (const s of state.shipments) {
    if (state.world.links[s.link]?.resource === resource) units += s.units;
  }
  return units;
}

/**
 * What the world has on hand of a stocked resource: every country's stock, but
 * no more than its normal stock (crude piling up where nobody uses it helps no
 * one), plus everything at sea.
 */
export function usableSupply(state: GameState, resource: string): number {
  let units = inTransit(state, resource);
  for (const id of sortedIds(state.world.countries)) {
    const country = state.world.countries[id]!;
    units += Math.min(stockOf(state.world, id, resource), country.normalStock[resource] ?? 0);
  }
  return units;
}

/**
 * Goods moving through the chain, each day, for every stocked resource:
 *   1. shipments due today arrive in the receiver's stock;
 *   2. plants work: wells pump, refineries turn input into output;
 *   3. countries use what they need, and anything they cannot get is a shortage;
 *   4. routes send what the sender can spare, to arrive after the route's days.
 * A closed chokepoint or an embargo stops new shipments; goods already on the
 * way still arrive, so trouble reaches people late and lingers after it ends.
 */
export const supplySystem: System = {
  name: 'supply',
  run(state) {
    const stocked = sortedIds(state.world.resources).filter(
      (id) => state.world.resources[id]!.stocked,
    );
    if (stocked.length === 0) return { state, events: [] };
    let world = state.world;

    // 1. Arrivals.
    const waiting: Shipment[] = [];
    for (const shipment of state.shipments) {
      if (shipment.arrives > state.tick) {
        waiting.push(shipment);
        continue;
      }
      const link = world.links[shipment.link]!;
      world = setStock(
        world,
        link.to,
        link.resource,
        stockOf(world, link.to, link.resource) + shipment.units,
      );
    }

    // 2. Plants, in a stable order.
    for (const id of sortedIds(world.plants)) {
      const plant = world.plants[id]!;
      const capacity = plantCapacity(state, id);
      if (capacity === 0 || !world.resources[plant.output]?.stocked) continue;
      let made: number;
      if (plant.input) {
        made = Math.min(capacity, stockOf(world, plant.country, plant.input));
        world = setStock(
          world,
          plant.country,
          plant.input,
          stockOf(world, plant.country, plant.input) - made,
        );
      } else {
        const room = Math.max(
          0,
          capacity * WELL_STORAGE_DAYS - stockOf(world, plant.country, plant.output),
        );
        made = Math.min(capacity, room);
      }
      if (made > 0) {
        world = setStock(
          world,
          plant.country,
          plant.output,
          stockOf(world, plant.country, plant.output) + made,
        );
      }
    }

    // 3. Use, and shortage.
    for (const resource of stocked) {
      for (const id of sortedIds(world.countries)) {
        const wanted = Math.max(
          0,
          effectiveStat(state, { kind: 'country', id, stat: demandStat(resource) }),
        );
        const have = stockOf(world, id, resource);
        const used = Math.min(wanted, have);
        if (used > 0) world = setStock(world, id, resource, have - used);
        const short = wanted - used;
        if ((world.countries[id]!.stats[shortageStat(resource)] ?? 0) !== short) {
          world = setBaseStat(world, 'country', id, shortageStat(resource), short);
        }
      }
    }

    // 4. Shipping out. Each route records what it sent today (`shipped`), so the
    // why-trace can tell a cut route from a sender with nothing to spare.
    const sent: Shipment[] = [];
    for (const id of sortedIds(world.links)) {
      const link = world.links[id]!;
      if (!world.resources[link.resource]?.stocked) continue;
      const capacity = isLinkOpen(world, link)
        ? Math.max(0, effectiveStat(state, { kind: 'link', id, stat: 'capacity' }))
        : 0;
      const keep = Math.trunc(
        ((world.countries[link.from]?.normalStock[link.resource] ?? 0) * KEEP_FOR_SELF_BP) / 10_000,
      );
      const units = Math.min(
        capacity,
        Math.max(0, stockOf(world, link.from, link.resource) - keep),
      );
      if ((link.stats.shipped ?? 0) !== units)
        world = setBaseStat(world, 'link', id, 'shipped', units);
      if (units === 0) continue;
      world = setStock(
        world,
        link.from,
        link.resource,
        stockOf(world, link.from, link.resource) - units,
      );
      if (link.days === 0) {
        world = setStock(
          world,
          link.to,
          link.resource,
          stockOf(world, link.to, link.resource) + units,
        );
      } else {
        sent.push({ link: id, units, arrives: state.tick + link.days });
      }
    }

    return { state: { ...state, world, shipments: [...waiting, ...sent] }, events: [] };
  },

  /** A stock's normal is the country's normal stock; a shortage's normal is none. */
  normalOf(state, ref) {
    if (ref.kind !== 'country') return undefined;
    const country = state.world.countries[ref.id];
    if (!country) return undefined;
    for (const resource of sortedIds(country.normalStock)) {
      if (ref.stat === stockStat(resource)) return country.normalStock[resource];
      if (ref.stat === shortageStat(resource)) return 0;
    }
    return undefined;
  },

  /** Why a stock is low (or a shortage high): what arrives less than normal, and plants working less. */
  explain(state, request, context): WhyNode {
    if (request.kind !== 'drift' || request.ref.kind !== 'country')
      return { type: 'system', id: 'supply' };
    const country = request.ref.id;
    const resource = sortedIds(state.world.resources).find(
      (r) => request.ref.stat === stockStat(r) || request.ref.stat === shortageStat(r),
    );
    if (!resource) return { type: 'system', id: 'supply' };
    return explainStock(state, country, resource, context);
  },
};

function explainStock(
  state: GameState,
  country: string,
  resource: string,
  context: ExplainContext,
): StockWhy {
  const world = state.world;
  const routes: StockWhy['routes'][number][] = [];
  for (const id of sortedIds(world.links)) {
    const link = world.links[id]!;
    if (link.resource !== resource || link.to !== country) continue;
    const ref: StatRef = { kind: 'link', id, stat: 'capacity' };
    const normal = context.baseWithoutAdjustments(ref);
    const open = isLinkOpen(world, link);
    const capacity = open ? Math.max(0, effectiveStat(state, ref)) : 0;
    const shipped = link.stats.shipped ?? capacity;
    if (shipped === normal) continue;
    const closedAt = link.via.find((c) => world.chokepoints[c]?.open === false);
    // Cut, narrowed, or open but the sender has nothing to spare.
    const cause: WhyNode = !open
      ? closedAt
        ? context.explainChokepoint(closedAt)
        : context.explainEmbargo(link.from, link.to)
      : capacity !== normal
        ? context.explainStat(ref)
        : context.explainStat({ kind: 'country', id: link.from, stat: stockStat(resource) });
    routes.push({ link: id, delta: shipped - normal, days: link.days, cause });
  }
  routes.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  const plants: StockWhy['plants'][number][] = [];
  for (const id of sortedIds(world.plants)) {
    const plant = world.plants[id]!;
    if (plant.country !== country || plant.output !== resource) continue;
    const ref: StatRef = { kind: 'plant', id, stat: 'capacity' };
    const capacity = plantCapacity(state, id);
    const normal = context.baseWithoutAdjustments(ref);
    if (capacity !== normal) {
      plants.push({ plant: id, delta: capacity - normal, cause: context.explainStat(ref) });
    }
    // A plant starved of its input: say why the input is short.
    if (plant.input && stockOf(world, country, plant.input) < capacity) {
      plants.push({
        plant: id,
        delta: stockOf(world, country, plant.input) - capacity,
        cause: context.explainStat({ kind: 'country', id: country, stat: stockStat(plant.input) }),
      });
    }
  }

  return {
    type: 'stock',
    country,
    resource,
    stock: stockOf(world, country, resource),
    normal: world.countries[country]?.normalStock[resource] ?? 0,
    routes,
    plants,
  };
}
