/**
 * Map lenses: one question each, answered by recolouring the map. A lens
 * never opens a panel. Pure: (game, lens) in, how each country and route
 * looks out. The map draws whatever this returns.
 */

import { effectiveStat, isLinkOpen, relationId, sortedIds, type GameState } from '@ripple/engine';
import { relationTone, stabilityTone, type Tone } from './describe';
import { formatChange } from './format';
import { brewing } from './intel';

export type Lens = 'relations' | 'trade' | 'prices' | 'unrest' | 'intelligence';

export const LENSES: readonly { id: Lens; label: string; question: string }[] = [
  { id: 'relations', label: 'Relations', question: 'Who is with you, and who against?' },
  { id: 'trade', label: 'Trade', question: 'What flows where, and what you pay for it' },
  { id: 'prices', label: 'Prices', question: 'Which goods are dear, and who sells them' },
  { id: 'unrest', label: 'Unrest', question: 'Which governments are shaky' },
  {
    id: 'intelligence',
    label: 'Intelligence',
    question: 'What your files say others are weighing',
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
      const sells = mainExport(game, id);
      const name = sells ? game.world.resources[sells]!.name : '';
      countries[id] = {
        land: id === player ? 'you' : 'plain',
        note:
          id === player
            ? 'You buy (amber), sell (blue)'
            : name
              ? `Sells ${name.toLowerCase()}`
              : '',
        noteInk: id === player ? 'you' : 'quiet',
        dim: false,
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
        note: `Stability ${value}`,
        noteInk: toneInk(tone),
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
