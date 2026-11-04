/**
 * Turns the world's changes into dispatches for the news feed.
 *
 * - Crises and other world events report their own headline.
 * - Your orders report when they are signed (if they take a while) and when
 *   they succeed or fail.
 * - Your budget reports a month only when it ends in deficit, so a calm game
 *   is not a monthly ledger.
 * - Prices are checked every day and reported only when they cross into a new
 *   10% band relative to normal, so a crisis produces a handful of market
 *   dispatches rather than one per day.
 */

import {
  effectiveStat,
  tradeItems,
  sortedIds,
  type EngineEvent,
  type GameState,
  type Severity,
  stockStat,
  type StatRef,
  type EventDef,
} from '@ripple/engine';
import {
  consumedGoods,
  coverDays,
  heldGoods,
  LOW_COVER_DAYS,
  RECOVERED_COVER_DAYS,
  shortageOf,
} from './chain';
import { fillNames, formatDate, formatMillions, formatPrice } from './format';

export type { Severity };

export type DispatchSource = 'world' | 'order' | 'market' | 'outcome' | 'intel' | 'supply';

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
  /** That country's name, when the tag says something else (such as "Intelligence"). */
  readonly place?: string;
  /** The world event behind this news, for asking why it happened. */
  readonly event?: string;
  /** The computer country's choice behind this news, for asking why it did it. */
  readonly choice?: { readonly decision: string; readonly country: string; readonly tick: number };
  /** The number behind this news (such as a stock), for asking why it moved. */
  readonly stat?: StatRef;
}

export const BAND_PERCENT = 10;
/** Orders shorter than this resolve almost at once, so only their result is reported. */
export const REPORT_SIGNING_FROM_DAYS = 3;

/** Which 10% band a price sits in relative to its base: 0 = normal, 2 = 20-29% up, -1 = 1-10% down. */
export function priceBand(price: number, basePrice: number): number {
  const pct = Math.trunc(((price - basePrice) * 100) / basePrice);
  return Math.trunc(pct / BAND_PERCENT);
}

/** How a stock of yours stands, for reporting only when that changes. */
export type StockLevel = 'ok' | 'low' | 'out';

export interface NewsState {
  readonly bands: Readonly<Record<string, number>>;
  /** Your stocks by resource; missing means ok. */
  readonly stocks: Readonly<Record<string, StockLevel>>;
  readonly nextId: number;
}

export const initialNews: NewsState = { bands: {}, stocks: {}, nextId: 1 };

/**
 * Where a stock of yours stands now, given where it stood. Low below
 * LOW_COVER_DAYS; out while anyone goes without; back to ok only at
 * RECOVERED_COVER_DAYS, so a stock hovering near the line reports once.
 */
export function stockLevel(state: GameState, resource: string, was: StockLevel): StockLevel {
  const player = state.rules.playerCountry;
  if (shortageOf(state, player, resource) > 0) return 'out';
  const days = coverDays(state, player, resource);
  if (days === null) return 'ok';
  if (days < LOW_COVER_DAYS) return was === 'out' ? 'out' : 'low';
  if (days >= RECOVERED_COVER_DAYS) return 'ok';
  return was === 'ok' ? 'ok' : 'low';
}

function stockDraft(
  state: GameState,
  resource: string,
  from: StockLevel,
  to: StockLevel,
  tick: number,
): DispatchDraft | null {
  const player = state.rules.playerCountry;
  const name = state.world.resources[resource]?.name ?? resource;
  const consumed = consumedGoods(state, player).includes(resource);
  const days = coverDays(state, player, resource) ?? 0;
  const base = {
    tick,
    tag: 'Home',
    source: 'supply' as const,
    country: player,
    stat: { kind: 'country' as const, id: player, stat: stockStat(resource) },
  };
  if (to === 'low' && from === 'ok') {
    return {
      ...base,
      severity: 'warning',
      headline: `${name} stocks down to ${days} ${days === 1 ? 'day' : 'days'}`,
      detail: consumed
        ? 'Ships are not bringing it in as fast as the country uses it. Ration it, release the reserve, or find another route.'
        : 'The refinery at home will stand idle when it runs out.',
    };
  }
  if (to === 'out') {
    if (from === 'out') return null;
    return consumed
      ? {
          ...base,
          severity: 'critical',
          headline: `Queues at the pumps: ${lowerFirst(name)} has run out`,
          detail: 'Every day without it angers workers and industry alike.',
        }
      : {
          ...base,
          severity: 'warning',
          headline: `${name} runs out: the refinery at home stands idle`,
          detail: 'More of the fuel you use must now be bought from abroad.',
        };
  }
  if (to === 'ok' && from !== 'ok') {
    return {
      ...base,
      severity: 'info',
      headline: `${name} stocks back to ${days} days`,
    };
  }
  return null;
}

/**
 * A world event that cuts a plant at home, or one in a country that ships
 * you what it makes (on a route in use, not a deal you have yet to sign), is urgent for you whatever its usual severity.
 */
function hitsYourSupply(state: GameState, def: EventDef): boolean {
  const player = state.rules.playerCountry;
  return def.effects.some((e) => {
    if (e.type !== 'modify' || e.target.kind !== 'plant' || e.amount >= 0) return false;
    const plant = state.world.plants[e.target.id];
    if (!plant) return false;
    if (plant.country === player) return true;
    return sortedIds(state.world.links).some((id) => {
      const link = state.world.links[id]!;
      return (
        link.from === plant.country &&
        link.to === player &&
        link.resource === plant.output &&
        effectiveStat(state, { kind: 'link', id, stat: 'capacity' }) > 0
      );
    });
  });
}

/** The label shown for an event's tag: a country's name, or Home, Markets or World. */
export function tagLabel(state: GameState, tag: string): string {
  const country = state.world.countries[tag];
  if (country) return country.name;
  return tag.charAt(0).toUpperCase() + tag.slice(1);
}

type DispatchDraft = Omit<Dispatch, 'id'>;

const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);

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
        severity: hitsYourSupply(state, def) ? 'critical' : def.severity,
        headline: def.headline,
        ...(def.detail ? { detail: def.detail } : {}),
        source: 'world',
        event: def.id,
        ...(state.world.countries[def.tag] ? { country: def.tag } : {}),
      };
    }
    case 'decision_issued': {
      // Computer countries' orders are reported when they take effect.
      if (event.by !== state.rules.playerCountry) return null;
      const def = state.defs.decisions[event.decision];
      if (!def || def.durationDays < REPORT_SIGNING_FROM_DAYS) return null;
      const name = fillNames(def.name, state.world.countries, event.by, event.target);
      return {
        tick: event.tick,
        tag: 'Your orders',
        severity: 'info',
        headline: `Order signed: ${name}`,
        detail: `Outcome expected around ${formatDate(event.dueTick)}.`,
        source: 'order',
      };
    }
    case 'decision_resolved': {
      const def = state.defs.decisions[event.decision];
      if (!def) return null;
      if (event.by !== state.rules.playerCountry) {
        // A computer country acted: world news about that country. A failure is news
        // only when content gives it a headline (a covert move that was caught).
        if (!event.success && !def.failureHeadline) return null;
        const fill = (text: string) =>
          fillNames(text, state.world.countries, event.by, event.target);
        if (!event.success) {
          return {
            tick: event.tick,
            tag: tagLabel(state, event.by),
            severity: 'info',
            headline: fill(def.failureHeadline!),
            source: 'world',
            country: event.by,
            choice: { decision: def.id, country: event.by, tick: event.issuedTick },
          };
        }
        return {
          tick: event.tick,
          tag: tagLabel(state, event.by),
          severity: def.severity ?? 'info',
          headline: fill(def.successHeadline),
          ...(def.detail ? { detail: fill(def.detail) } : {}),
          source: 'world',
          country: event.by,
          choice: { decision: def.id, country: event.by, tick: event.issuedTick },
        };
      }
      const fillMine = (text: string) =>
        fillNames(text, state.world.countries, event.by, event.target);
      return {
        tick: event.tick,
        tag: 'Your orders',
        severity: event.success ? 'info' : 'warning',
        headline: fillMine(
          event.success
            ? def.successHeadline
            : (def.failureHeadline ?? `${def.name}: it did not work`),
        ),
        source: 'order',
        ...(event.target && state.world.countries[event.target] ? { country: event.target } : {}),
      };
    }
    case 'budget_settled': {
      if (event.country !== state.rules.playerCountry || event.millions >= 0) return null;
      const imports = tradeItems(state, event.country, 'imports');
      const dearest = [...imports].sort((a, b) => b.amount - a.amount)[0];
      const total = imports.reduce((sum, i) => sum + i.amount, 0);
      const name = dearest ? (state.world.resources[dearest.resource]?.name ?? '') : '';
      return {
        tick: event.tick,
        tag: 'Home',
        severity: event.millions <= -5_000 ? 'critical' : 'warning',
        headline: `The month ends ${formatMillions(-event.millions)} in deficit`,
        detail: dearest
          ? `Imports now cost ${formatMillions(total)} a month, ${lowerFirst(name)} the most.`
          : 'Spending ran ahead of revenue.',
        source: 'outcome',
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
  let stocks = news.stocks;
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

  for (const id of heldGoods(state, state.rules.playerCountry)) {
    const was = stocks[id] ?? 'ok';
    const now = stockLevel(state, id, was);
    if (now === was) continue;
    stocks = { ...stocks, [id]: now };
    const draft = stockDraft(state, id, was, now, tick);
    if (draft) push(draft);
  }

  return { news: { bands, stocks, nextId }, dispatches };
}

/** True for news that should interrupt the player: a critical world event, or running out at home. */
export function isAlert(dispatch: Dispatch): boolean {
  return (
    (dispatch.source === 'world' || dispatch.source === 'supply') &&
    dispatch.severity === 'critical'
  );
}
