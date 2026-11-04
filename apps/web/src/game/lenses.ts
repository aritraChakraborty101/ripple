/**
 * Map lenses: one question each, answered by recolouring the map. A lens
 * never opens a panel. Pure: (game, lens) in, how each country and route
 * looks out. The map draws whatever this returns.
 */

import { effectiveStat, isLinkOpen, relationId, sortedIds, type GameState } from '@ripple/engine';
import {
  consumedGoods,
  coverDays,
  LOW_COVER_DAYS,
  plantMarks,
  shortageOf,
  type PlantMark,
} from './chain';
import { relationTone, stabilityTone, type Tone } from './describe';
import { formatChange } from './format';
import { brewing } from './intel';

export type Lens = 'relations' | 'trade' | 'prices' | 'unrest' | 'intelligence';

/**
 * Each lens asks one question of the map, and says in a line how to read the
 * answer: shown under the lens bar.
 */
export const LENSES: readonly { id: Lens; label: string; question: string; guide: string }[] = [
  {
    id: 'relations',
    label: 'Relations',
    question: 'Who is with you, and who against?',
    guide: 'How each country feels about you, from −100 to 100. Red land is hostile.',
  },
  {
    id: 'trade',
    label: 'Trade',
    question: 'What flows where, and what you pay for it',
    guide: 'Dots are shipments, amber when bound for you. Under each country: days of fuel left.',
  },
  {
    id: 'prices',
    label: 'Prices',
    question: 'Which goods are dear, and who sells them',
    guide: 'Each seller shows its good against the normal price. Red routes carry dear goods.',
  },
  {
    id: 'unrest',
    label: 'Unrest',
    question: 'Which governments are shaky',
    guide: 'Stability from 0 to 100. Below 20 for a month, a government falls, yours too.',
  },
  {
    id: 'intelligence',
    label: 'Intelligence',
    question: 'What your files say others are weighing',
    guide: 'Red land is weighing a move against you. An intelligence file shows plans sooner.',
  },
];

/** Meaning, in the palette's terms; the map turns these into colours. */
export type Ink = 'you' | 'threat' | 'warning' | 'friend' | 'quiet' | 'faint';

export interface CountryLook {
  /** Fill: your own land, hostile or shaky land, or ordinary land. */
  readonly land: 'you' | 'threat' | 'warning' | 'plain';
  /** The line under the name. Empty to show nothing. */
  readonly note: string;
  readonly noteInk: Ink;
  /** Fade a country the lens has nothing to say about. */
  readonly dim: boolean;
  /** Wells and refineries to mark on the country, on the Trade lens. */
  readonly plants?: readonly PlantMark[];
}

export interface RouteLook {
  /** Stroke width in map units. */
  readonly width: number;
  readonly ink: Ink | 'route';
  /** 0 to 1. */
  readonly opacity: number;
}

export interface LensView {
  readonly countries: Readonly<Record<string, CountryLook>>;
  /** By link id. */
  readonly routes: Readonly<Record<string, RouteLook>>;
}

const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0');

function relationOf(game: GameState, id: string): number {
  return effectiveStat(game, {
    kind: 'relation',
    id: relationId(game.rules.playerCountry, id),
    stat: 'value',
  });
}

function stabilityOf(game: GameState, id: string): number {
  return effectiveStat(game, { kind: 'country', id, stat: game.rules.ousting.stat });
}

function priceChange(game: GameState, resource: string): number {
  const def = game.world.resources[resource];
  if (!def || def.basePrice === 0) return 0;
  const price = effectiveStat(game, { kind: 'resource', id: resource, stat: 'price' });
  return Math.round(((price - def.basePrice) * 100) / def.basePrice);
}

const toneInk = (tone: Tone): Ink =>
  tone === 'critical' ? 'threat' : tone === 'warning' ? 'warning' : 'quiet';

/** Routes as they look when the lens is not about trade: thin and quiet. */
function quietRoutes(game: GameState, opacity: number): Record<string, RouteLook> {
  const out: Record<string, RouteLook> = {};
  for (const id of sortedIds(game.world.links)) {
    const open = isLinkOpen(game.world, game.world.links[id]!);
    out[id] = open
      ? { width: 1.3, ink: 'route', opacity }
      : { width: 1.75, ink: 'threat', opacity: 1 };
  }
  return out;
}

/** A link's daily value: units a day at today's price, in cents. */
function linkValue(game: GameState, id: string): number {
  const link = game.world.links[id]!;
  const units = Math.max(0, effectiveStat(game, { kind: 'link', id, stat: 'capacity' }));
  const price = effectiveStat(game, { kind: 'resource', id: link.resource, stat: 'price' });
  return units * price;
}

/** What a country sells most of, by value, if anything. */
function mainExport(game: GameState, country: string): string | null {
  let best: string | null = null;
  let bestValue = 0;
  const byResource: Record<string, number> = {};
  for (const id of sortedIds(game.world.links)) {
    const link = game.world.links[id]!;
    if (link.from !== country) continue;
    byResource[link.resource] = (byResource[link.resource] ?? 0) + linkValue(game, id);
  }
  for (const [resource, value] of Object.entries(byResource)) {
    if (value > bestValue) {
      best = resource;
      bestValue = value;
    }
  }
  return best;
}

/** Anyone queuing for a good this country consumes. */
function queuing(game: GameState, country: string): boolean {
  return consumedGoods(game, country).some((r) => shortageOf(game, country, r) > 0);
}

/**
 * "Fuel 18 days" for the first stocked good a country consumes, inked by how
 * worrying it is; "Fuel run out" while people queue. Null if it holds none.
 */
export function coverNote(game: GameState, country: string): { text: string; ink: Ink } | null {
  const good = consumedGoods(game, country)[0];
  if (!good) return null;
  const name = game.world.resources[good]!.name;
  if (shortageOf(game, country, good) > 0) return { text: `${name} run out`, ink: 'threat' };
  const days = coverDays(game, country, good);
  if (days === null) return null;
  return {
    text: `${name} ${days} ${days === 1 ? 'day' : 'days'}`,
    ink: days < LOW_COVER_DAYS / 2 ? 'threat' : days < LOW_COVER_DAYS ? 'warning' : 'quiet',
  };
}

export function lensView(game: GameState, lens: Lens): LensView {
  const player = game.rules.playerCountry;
  const countries: Record<string, CountryLook> = {};
  const ids = sortedIds(game.world.countries);

  if (lens === 'relations') {
    for (const id of ids) {
      if (id === player) {
        countries[id] = { land: 'you', note: 'You', noteInk: 'you', dim: false };
        continue;
      }
      const value = relationOf(game, id);
      const tone = relationTone(value);
      countries[id] = {
        land: tone === 'critical' ? 'threat' : 'plain',
        note: signed(value),
        noteInk: tone === 'calm' ? (value >= 15 ? 'friend' : 'faint') : toneInk(tone),
        dim: false,
      };
    }
    return { countries, routes: quietRoutes(game, 0.6) };
  }

  if (lens === 'trade') {
    const routes: Record<string, RouteLook> = {};
    const values = sortedIds(game.world.links).map((id) => linkValue(game, id));
    const top = Math.max(1, ...values);
    for (const id of sortedIds(game.world.links)) {
      const link = game.world.links[id]!;
      const open = isLinkOpen(game.world, link);
      if (!open) {
        routes[id] = { width: 2, ink: 'threat', opacity: 1 };
        continue;
      }
      const share = linkValue(game, id) / top;
      const mine = link.to === player ? 'you' : link.from === player ? 'friend' : 'route';
      routes[id] = {
        width: 1 + share * 5,
        ink: mine,
        opacity: mine === 'route' ? 0.35 + share * 0.4 : 0.9,
      };
    }
    for (const id of ids) {
      const cover = coverNote(game, id);
      const sells = mainExport(game, id);
      const name = sells ? game.world.resources[sells]!.name : '';
      const plants = plantMarks(game, id);
      countries[id] = {
        land: id === player ? 'you' : 'plain',
        note: cover ? cover.text : name ? `Sells ${name.toLowerCase()}` : '',
        noteInk: cover && cover.ink !== 'quiet' ? cover.ink : id === player ? 'you' : 'quiet',
        dim: false,
        ...(plants.length > 0 ? { plants } : {}),
      };
    }
    return { countries, routes };
  }

  if (lens === 'prices') {
    const routes: Record<string, RouteLook> = {};
    for (const id of sortedIds(game.world.links)) {
      const link = game.world.links[id]!;
      const change = priceChange(game, link.resource);
      const open = isLinkOpen(game.world, link);
      routes[id] = !open
        ? { width: 1.75, ink: 'threat', opacity: 1 }
        : change >= 30
          ? { width: 2.2, ink: 'threat', opacity: 0.85 }
          : change >= 10
            ? { width: 1.8, ink: 'warning', opacity: 0.85 }
            : { width: 1.1, ink: 'route', opacity: 0.25 };
    }
    for (const id of ids) {
      const sells = mainExport(game, id);
      if (!sells) {
        countries[id] = {
          land: id === player ? 'you' : 'plain',
          note: '',
          noteInk: 'faint',
          dim: id !== player,
        };
        continue;
      }
      const change = priceChange(game, sells);
      const def = game.world.resources[sells]!;
      const price = effectiveStat(game, { kind: 'resource', id: sells, stat: 'price' });
      countries[id] = {
        land: id === player ? 'you' : 'plain',
        note: `${def.name} ${formatChange(price, def.basePrice)}`,
        noteInk: change >= 30 ? 'threat' : change >= 10 ? 'warning' : 'quiet',
        dim: false,
      };
    }
    return { countries, routes };
  }

  if (lens === 'unrest') {
    const below = game.rules.ousting.below;
    for (const id of ids) {
      const value = stabilityOf(game, id);
      const tone = stabilityTone(value, below);
      countries[id] = {
        land:
          id === player
            ? 'you'
            : tone === 'critical'
              ? 'threat'
              : tone === 'warning'
                ? 'warning'
                : 'plain',
        note: `Stability ${value}${queuing(game, id) ? ' · queues' : ''}`,
        noteInk: queuing(game, id) && tone === 'calm' ? 'warning' : toneInk(tone),
        dim: false,
      };
    }
    return { countries, routes: quietRoutes(game, 0.18) };
  }

  // Intelligence: who you have files on, and what anyone is weighing.
  const weighing = new Map<string, string>();
  for (const b of brewing(game)) if (!weighing.has(b.country)) weighing.set(b.country, b.name);
  for (const id of ids) {
    if (id === player) {
      countries[id] = { land: 'you', note: 'You', noteInk: 'you', dim: false };
      continue;
    }
    const file = effectiveStat(game, { kind: 'country', id: player, stat: `intel_${id}` }) > 0;
    const plan = weighing.get(id);
    countries[id] = {
      land: plan ? 'threat' : 'plain',
      note: plan ? `Weighing: ${plan}` : file ? 'File open, nothing brewing' : 'No file',
      noteInk: plan ? 'threat' : file ? 'friend' : 'faint',
      dim: !plan && !file,
    };
  }
  return { countries, routes: quietRoutes(game, 0.15) };
}
