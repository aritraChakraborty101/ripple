/**
 * Turns the world's changes into dispatches for the news feed.
 *
 * - Crises and other world events report their own headline.
 * - Your orders report when they are signed (if they take a while) and when
 *   they succeed or fail.
 * - Prices are checked every day and reported only when they cross into a new
 *   10% band relative to normal, so a crisis produces a handful of market
 *   dispatches rather than one per day.
 */

import {
  effectiveStat,
  sortedIds,
  type EngineEvent,
  type GameState,
  type Severity,
} from '@ripple/engine';
import { formatDate, formatPrice } from './format';

export type { Severity };

export type DispatchSource = 'world' | 'order' | 'market' | 'outcome';

export interface Dispatch {
  readonly id: string;
  readonly tick: number;
  /** Who or what the dispatch is about: a country name, "Markets", "Home", "Your orders". */
  readonly tag: string;
  readonly severity: Severity;
  readonly headline: string;
  readonly detail?: string;
  readonly source: DispatchSource;
  /** The country the news concerns, when there is one, for linking to it on the map. */
  readonly country?: string;
}

export const BAND_PERCENT = 10;
/** Orders shorter than this resolve almost at once, so only their result is reported. */
export const REPORT_SIGNING_FROM_DAYS = 3;

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

/** The label shown for an event's tag: a country's name, or Home, Markets or World. */
export function tagLabel(state: GameState, tag: string): string {
  const country = state.world.countries[tag];
  if (country) return country.name;
  return tag.charAt(0).toUpperCase() + tag.slice(1);
}

type DispatchDraft = Omit<Dispatch, 'id'>;

function priceDraft(
  state: GameState,
  resourceId: string,
  price: number,
  band: number,
  tick: number,
): DispatchDraft {
  const resource = state.world.resources[resourceId]!;
  const pct = Math.round(((price - resource.basePrice) * 100) / resource.basePrice);
  if (band === 0) {
    return {
      tick,
      tag: 'Markets',
      severity: 'info',
      headline: `${resource.name} back near its normal price`,
      detail: `Now ${formatPrice(price)}.`,
      source: 'market',
    };
  }
  return {
    tick,
    tag: 'Markets',
    severity: pct >= 30 ? 'critical' : pct > 0 ? 'warning' : 'info',
    headline: `${resource.name} now ${Math.abs(pct)}% ${pct > 0 ? 'above' : 'below'} normal`,
    detail: `Trading at ${formatPrice(price)} against a normal ${formatPrice(resource.basePrice)}.`,
    source: 'market',
  };
}

function eventDraft(state: GameState, event: EngineEvent): DispatchDraft | null {
  switch (event.kind) {
    case 'event_fired': {
      const def = state.defs.events[event.event];
      if (!def) return null;
      return {
        tick: event.tick,
        tag: tagLabel(state, def.tag),
        severity: def.severity,
        headline: def.headline,
        ...(def.detail ? { detail: def.detail } : {}),
        source: 'world',
        ...(state.world.countries[def.tag] ? { country: def.tag } : {}),
      };
    }
    case 'decision_issued': {
      const def = state.defs.decisions[event.decision];
      if (!def || def.durationDays < REPORT_SIGNING_FROM_DAYS) return null;
      return {
        tick: event.tick,
        tag: 'Your orders',
        severity: 'info',
        headline: `Order signed: ${def.name}`,
        detail: `Outcome expected around ${formatDate(event.dueTick)}.`,
        source: 'order',
      };
    }
    case 'decision_resolved': {
      const def = state.defs.decisions[event.decision];
      if (!def) return null;
      return {
        tick: event.tick,
        tag: 'Your orders',
        severity: event.success ? 'info' : 'warning',
        headline: event.success
          ? def.successHeadline
          : (def.failureHeadline ?? `${def.name}: it did not work`),
        source: 'order',
      };
    }
    case 'game_over':
      return {
        tick: event.tick,
        tag: 'Home',
        severity: event.result === 'ousted' ? 'critical' : 'info',
        headline:
          event.result === 'ousted'
            ? 'The government falls after weeks of unrest'
            : 'Your term ends with the government still standing',
        source: 'outcome',
      };
    default:
      return null;
  }
}

/**
 * Dispatches for one simulated day (or one batch of orders), oldest first.
 * `state` is the state afterward; `tick` is the day the price check is dated.
 */
export function dispatchesFor(
  news: NewsState,
  events: readonly EngineEvent[],
  state: GameState,
  tick: number = Math.max(0, state.tick - 1),
): { news: NewsState; dispatches: Dispatch[] } {
  let bands = news.bands;
  let nextId = news.nextId;
  const dispatches: Dispatch[] = [];
  const push = (draft: DispatchDraft) => {
    dispatches.push({ ...draft, id: `d${nextId}` });
    nextId += 1;
  };

  for (const event of events) {
    const draft = eventDraft(state, event);
    if (draft) push(draft);
  }

  for (const id of sortedIds(state.world.resources)) {
    const resource = state.world.resources[id]!;
    const price = effectiveStat(state, { kind: 'resource', id, stat: 'price' });
    const band = priceBand(price, resource.basePrice);
    if (band === (bands[id] ?? 0)) continue;
    bands = { ...bands, [id]: band };
    push(priceDraft(state, id, price, band, tick));
  }

  return { news: { bands, nextId }, dispatches };
}

/** True for news that should interrupt the player: a critical world event. */
export function isAlert(dispatch: Dispatch): boolean {
  return dispatch.source === 'world' && dispatch.severity === 'critical';
}
