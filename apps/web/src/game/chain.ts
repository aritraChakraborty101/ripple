/**
 * The supply chain as the player sees it: how many days of each good a
 * country holds, where every shipment is on its route, and how each well and
 * refinery is doing. Pure reads of the game state; nothing here changes it.
 */

import {
  demandOf,
  demandStat,
  effectiveStat,
  shortageStat,
  sortedIds,
  stockStat,
  type GameState,
} from '@ripple/engine';

/** Below this many days of cover, a stock is low. */
export const LOW_COVER_DAYS = 10;
/** A low stock counts as recovered again only at this many days, so a memo doesn't flicker. */
export const RECOVERED_COVER_DAYS = 15;

const isStocked = (game: GameState, resource: string) =>
  game.world.resources[resource]?.stocked !== undefined;

/** Units of a resource a country holds right now. */
export function stockOf(game: GameState, country: string, resource: string): number {
  return game.world.countries[country]?.stats[stockStat(resource)] ?? 0;
}

/** Yesterday's unmet demand: queues. */
export function shortageOf(game: GameState, country: string, resource: string): number {
  return game.world.countries[country]?.stats[shortageStat(resource)] ?? 0;
}

/**
 * Whole days a country's stock would last at today's use (its own demand plus
 * what its plants take in), or null when it uses none.
 */
export function coverDays(game: GameState, country: string, resource: string): number | null {
  const use = demandOf(game, country, resource);
  if (use <= 0) return null;
  return Math.trunc(stockOf(game, country, resource) / use);
}

/**
 * The stocked goods a country itself consumes (not only feeds a plant), the
 * ones its people queue for when they run out. In the first crisis: fuel.
 */
export function consumedGoods(game: GameState, country: string): string[] {
  return sortedIds(game.world.resources).filter(
    (r) =>
      isStocked(game, r) &&
      effectiveStat(game, { kind: 'country', id: country, stat: demandStat(r) }) > 0,
  );
}

/** The stocked goods a country normally holds any of: what it consumes and what its plants use. */
export function heldGoods(game: GameState, country: string): string[] {
  const normal = game.world.countries[country]?.normalStock ?? {};
  return sortedIds(game.world.resources).filter((r) => isStocked(game, r) && (normal[r] ?? 0) > 0);
}

// ---------------------------------------------------------------- Shipments

export interface ShipMark {
  /** Stable from the day it sets off to the day it lands, for animating. */
  readonly key: string;
  readonly link: string;
  readonly resource: string;
  readonly units: number;
  /** How far along the route, from 0 (just left) to 1 (arriving). */
  readonly progress: number;
}

/** Every shipment on its way, with how far it has come. */
export function shipMarks(game: GameState): ShipMark[] {
  const marks: ShipMark[] = [];
  for (const s of game.shipments) {
    const link = game.world.links[s.link];
    if (!link || link.days <= 0 || s.units <= 0) continue;
    const left = s.arrives - link.days;
    const progress = Math.min(1, Math.max(0, (game.tick - left) / link.days));
    marks.push({
      key: `${s.link}@${s.arrives}`,
      link: s.link,
      resource: link.resource,
      units: s.units,
      progress,
    });
  }
  return marks;
}

// ---------------------------------------------------------------- Plants

/**
 * - working: running at its normal rate;
 * - cut: running below its normal rate (a fire, a blowout, an output cut);
 * - starved: a refinery without a full day's input in stock;
 * - off: built for later, or out entirely.
 */
export type PlantStatus = 'working' | 'cut' | 'starved' | 'off';

export interface PlantMark {
  readonly id: string;
  readonly name: string;
  readonly country: string;
  /** A well makes from nothing; a refinery turns its input into its output. */
  readonly kind: 'well' | 'refinery';
  readonly status: PlantStatus;
  /** Units a day it can make right now. */
  readonly capacity: number;
  /** Units a day it makes when all is well. */
  readonly normal: number;
  /** One line for a tooltip or a screen reader. */
  readonly summary: string;
}

export function plantMarks(game: GameState, country?: string): PlantMark[] {
  const marks: PlantMark[] = [];
  for (const id of sortedIds(game.world.plants)) {
    const plant = game.world.plants[id]!;
    if (country !== undefined && plant.country !== country) continue;
    const normal = plant.stats['capacity'] ?? 0;
    const capacity = Math.max(0, effectiveStat(game, { kind: 'plant', id, stat: 'capacity' }));
    const kind = plant.input ? 'refinery' : 'well';
    const status: PlantStatus =
      normal <= 0 || capacity <= 0
        ? 'off'
        : capacity < normal
          ? 'cut'
          : plant.input && stockOf(game, plant.country, plant.input) < capacity
            ? 'starved'
            : 'working';
    const output = game.world.resources[plant.output]?.name.toLowerCase() ?? plant.output;
    const input = plant.input
      ? (game.world.resources[plant.input]?.name.toLowerCase() ?? plant.input)
      : '';
    const summary =
      status === 'off' && normal > 0
        ? `${plant.name}: shut`
        : status === 'off'
          ? `${plant.name}: not built yet`
          : status === 'cut'
            ? `${plant.name}: down to ${capacity} ${output} a day of ${normal}`
            : status === 'starved'
              ? `${plant.name}: idle for want of ${input}`
              : `${plant.name}: ${capacity} ${output} a day`;
    marks.push({
      id,
      name: plant.name,
      country: plant.country,
      kind,
      status,
      capacity,
      normal,
      summary,
    });
  }
  return marks;
}

/**
 * Refineries whose input has just fallen below a few days' worth: the
 * second ring of a closure, days after the first. Compares two states.
 */
export const RUNNING_LOW_DAYS = 3;

export function refineriesRunningLow(before: GameState, after: GameState): string[] {
  const out: string[] = [];
  for (const id of sortedIds(after.world.plants)) {
    const plant = after.world.plants[id]!;
    if (!plant.input) continue;
    const capacity = Math.max(0, effectiveStat(after, { kind: 'plant', id, stat: 'capacity' }));
    if (capacity <= 0) continue;
    const line = capacity * RUNNING_LOW_DAYS;
    const was = stockOf(before, plant.country, plant.input);
    const now = stockOf(after, plant.country, plant.input);
    if (was >= line && now < line) out.push(id);
  }
  return out;
}
