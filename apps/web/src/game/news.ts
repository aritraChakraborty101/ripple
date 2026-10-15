/**
 * Turns the world's changes into dispatches for the news feed.
 *
 * Prices are checked every day and reported only when they cross into a new
 * 10% band relative to their normal level, so a crisis produces a handful of
 * dispatches rather than one per day. (The engine's price_moved events only
 * fire on large daily moves, so slow climbs would go unreported otherwise.)
 */

import { effectiveStat, sortedIds, type EngineEvent, type GameState } from '@ripple/engine';
import { formatPrice } from './format';

export type Severity = 'critical' | 'warning' | 'info';

export interface Dispatch {
  readonly id: string;
  readonly tick: number;
  /** Who or what the dispatch is about: a country name, "Markets", "Home". */
  readonly tag: string;
  readonly severity: Severity;
  readonly headline: string;
  readonly detail?: string;
}

export const BAND_PERCENT = 10;

/** Which 10% band a price sits in relative to its base: 0 = normal, 2 = 20-29% up, -1 = 1-10% down. */
export function priceBand(price: number, basePrice: number): number {
  const pct = Math.trunc(((price - basePrice) * 100) / basePrice);
  return Math.trunc(pct / BAND_PERCENT);
}

export interface NewsState {
  readonly bands: Readonly<Record<string, number>>;
  readonly nextId: number;
}

export const initialNews: NewsState = { bands: {}, nextId: 1 };

function priceDispatch(
  state: GameState,
  resourceId: string,
  price: number,
  band: number,
  tick: number,
  id: string,
): Dispatch {
  const resource = state.world.resources[resourceId]!;
  const pct = Math.round(((price - resource.basePrice) * 100) / resource.basePrice);
  if (band === 0) {
    return {
      id,
      tick,
      tag: 'Markets',
      severity: 'info',
      headline: `${resource.name} back near its normal price`,
      detail: `Now ${formatPrice(price)}.`,
    };
  }
  const direction = pct > 0 ? 'above' : 'below';
  return {
    id,
    tick,
    tag: 'Markets',
    severity: pct >= 30 ? 'critical' : pct > 0 ? 'warning' : 'info',
    headline: `${resource.name} now ${Math.abs(pct)}% ${direction} normal`,
    detail: `Trading at ${formatPrice(price)} against a normal ${formatPrice(resource.basePrice)}.`,
  };
}

/**
 * Dispatches for one simulated day. `state` is the state after the day and
 * `tick` the day that was simulated. Engine events are accepted for the event
 * kinds still to come (crises, decisions), which will become dispatches too.
 */
export function dispatchesFor(
  news: NewsState,
  events: readonly EngineEvent[],
  state: GameState,
  tick: number = state.tick - 1,
): { news: NewsState; dispatches: Dispatch[] } {
  void events;
  let bands = news.bands;
  let nextId = news.nextId;
  const dispatches: Dispatch[] = [];

  for (const id of sortedIds(state.world.resources)) {
    const resource = state.world.resources[id]!;
    const price = effectiveStat(state, { kind: 'resource', id, stat: 'price' });
    const band = priceBand(price, resource.basePrice);
    if (band === (bands[id] ?? 0)) continue;
    bands = { ...bands, [id]: band };
    dispatches.push(priceDispatch(state, id, price, band, tick, `d${nextId}`));
    nextId += 1;
  }

  return { news: { bands, nextId }, dispatches };
}

/** A dispatch for something that happened outside the engine's events, such as a dev action. */
export function customDispatch(
  news: NewsState,
  dispatch: Omit<Dispatch, 'id'>,
): { news: NewsState; dispatch: Dispatch } {
  return {
    news: { ...news, nextId: news.nextId + 1 },
    dispatch: { ...dispatch, id: `d${news.nextId}` },
  };
}
