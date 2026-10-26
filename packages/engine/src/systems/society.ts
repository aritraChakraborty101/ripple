import { effectiveStat, setSystemModifier } from '../modifiers';
import type { GameState } from '../state';
import { sortedIds } from '../world';
import type { MoodWhy, PressureWhy, WhyNode } from '../why';
import type { System } from './types';

/** Satisfaction lost per percentage point of weighted price pressure. */
export const PRESSURE_PER_SATISFACTION = 4;
/** Relief from cheap goods is capped, so falling prices can't buy endless goodwill. */
export const MAX_RELIEF = 5;
/** Stability points per point of satisfaction change, per unit of faction power, divided by this. */
export const MOOD_DIVISOR = 50;

/**
 * How much prices weigh on a faction: each resource's percent above its normal
 * price, weighted by the faction's sensitivity (basis points).
 */
export function pricePressure(state: GameState, factionId: string): number {
  const faction = state.world.factions[factionId];
  if (!faction) throw new Error(`Unknown faction "${factionId}"`);
  let weighted = 0;
  for (const resourceId of sortedIds(faction.sensitivity)) {
    const resource = state.world.resources[resourceId];
    if (!resource) continue;
    const price = effectiveStat(state, { kind: 'resource', id: resourceId, stat: 'price' });
    const pct = Math.max(
      -50,
      Math.trunc(((price - resource.basePrice) * 100) / resource.basePrice),
    );
    weighted += pct * (faction.sensitivity[resourceId] ?? 0);
  }
  return Math.trunc(weighted / 10_000);
}

/**
 * Prices become feelings, and feelings become stability:
 *   1. Each faction's satisfaction falls as the goods it cares about get dearer
 *      (a "cost of living" modifier, recalculated daily).
 *   2. Each country's stability moves with its factions' satisfaction relative
 *      to where they started, weighted by their power ("faction mood").
 * Both are ordinary modifiers, so the why-trace can follow the chain.
 */
export const societySystem: System = {
  name: 'society',
  run(state) {
    let current = state;

    for (const id of sortedIds(state.world.factions)) {
      const pressure = pricePressure(current, id);
      const amount = Math.min(MAX_RELIEF, -Math.trunc(pressure / PRESSURE_PER_SATISFACTION));
      current = setSystemModifier(
        current,
        'cost_of_living',
        { kind: 'faction', id, stat: 'satisfaction' },
        amount,
      );
    }

    const moodByCountry: Record<string, number> = {};
    for (const id of sortedIds(current.world.factions)) {
      const faction = current.world.factions[id]!;
      const base = faction.stats.satisfaction ?? 50;
      const now = effectiveStat(current, { kind: 'faction', id, stat: 'satisfaction' });
      const power = faction.stats.power ?? 0;
      moodByCountry[faction.country] =
        (moodByCountry[faction.country] ?? 0) + Math.trunc(((now - base) * power) / MOOD_DIVISOR);
    }
    for (const countryId of sortedIds(moodByCountry)) {
      current = setSystemModifier(
        current,
        'faction_mood',
        { kind: 'country', id: countryId, stat: 'stability' },
        moodByCountry[countryId]!,
      );
    }

    return { state: current, events: [] };
  },

  modifierIds: ['cost_of_living', 'faction_mood'],

  explain(state, request, context): WhyNode {
    const { ref } = request;
    if (request.kind === 'modifier' && request.id === 'cost_of_living' && ref.kind === 'faction') {
      // Which prices weigh on this faction, and how much.
      const faction = state.world.factions[ref.id]!;
      const prices: PressureWhy['prices'][number][] = [];
      for (const resource of sortedIds(faction.sensitivity)) {
        const def = state.world.resources[resource];
        if (!def) continue;
        const priceRef = { kind: 'resource' as const, id: resource, stat: 'price' };
        const price = effectiveStat(state, priceRef);
        const percent = Math.trunc(((price - def.basePrice) * 100) / def.basePrice);
        if (percent === 0) continue;
        prices.push({
          resource,
          weightBp: faction.sensitivity[resource] ?? 0,
          percent,
          cause: context.explainStat(priceRef),
        });
      }
      prices.sort((a, b) => Math.abs(b.percent * b.weightBp) - Math.abs(a.percent * a.weightBp));
      return { type: 'pressure', faction: ref.id, prices };
    }

    if (request.kind === 'modifier' && request.id === 'faction_mood' && ref.kind === 'country') {
      // How each faction's change in mood moves the country's stability.
      const factions: MoodWhy['factions'][number][] = [];
      for (const fid of sortedIds(state.world.factions)) {
        const faction = state.world.factions[fid]!;
        if (faction.country !== ref.id) continue;
        const satisfactionRef = { kind: 'faction' as const, id: fid, stat: 'satisfaction' };
        const change = effectiveStat(state, satisfactionRef) - (faction.stats.satisfaction ?? 50);
        if (change === 0) continue;
        factions.push({
          faction: fid,
          change,
          effect: Math.trunc((change * (faction.stats.power ?? 0)) / MOOD_DIVISOR),
          cause: context.explainStat(satisfactionRef),
        });
      }
      factions.sort((a, b) => Math.abs(b.effect) - Math.abs(a.effect));
      return { type: 'mood', country: ref.id, factions };
    }

    return { type: 'system', id: request.kind === 'modifier' ? request.id : 'society' };
  },
};
