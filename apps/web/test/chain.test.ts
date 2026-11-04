import { loadBuiltInScenario } from '@ripple/content/node';
import {
  addModifier,
  createGame,
  setChokepointOpen,
  step,
  type GameState,
  type ScenarioDef,
} from '@ripple/engine';
import { describe, expect, it } from 'vitest';
import { coverDays, plantMarks, refineriesRunningLow, shipMarks } from '../src/game/chain';
import { coverNote, lensView } from '../src/game/lenses';
import { dispatchesFor, initialNews, isAlert, stockLevel, type Dispatch } from '../src/game/news';
import { ripplesFor } from '../src/game/ripples';
import { curveQuads, pointAlong, quadsPath, throughPath, throughQuads } from '../src/map/layout';

const scenario = loadBuiltInScenario('first-crisis');
const { ai, ...withoutAi } = scenario;
void ai;
const quiet: ScenarioDef = { ...withoutAi, events: [] };
const start = createGame(quiet, 1);

function days(game: GameState, count: number): GameState {
  let current = game;
  for (let i = 0; i < count; i += 1) current = step(current, []).state;
  return current;
}

/** A copy of the game with one country's stock of a good set by hand. */
function withStock(game: GameState, country: string, resource: string, units: number): GameState {
  const c = game.world.countries[country]!;
  return {
    ...game,
    world: {
      ...game.world,
      countries: {
        ...game.world.countries,
        [country]: { ...c, stats: { ...c.stats, [`stock_${resource}`]: units } },
      },
    },
  };
}

const fire = (game: GameState, plant: string) =>
  addModifier(game, {
    target: { kind: 'plant', id: plant, stat: 'capacity' },
    op: 'pct',
    amount: -7_500,
    source: { kind: 'event', id: 'thessa_refinery_fire', tick: game.tick },
    expiresAt: game.tick + 60,
  });

describe('route geometry', () => {
  it('draws the same paths as before', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 100, y: 40 },
      { x: 200, y: 0 },
    ];
    expect(quadsPath(throughQuads(points))).toBe(throughPath(points));
  });

  it('finds points along a route, from one end to the other', () => {
    const quads = curveQuads({ x: 0, y: 0 }, { x: 100, y: 0 }, 0);
    expect(pointAlong(quads, 0)).toEqual({ x: 0, y: 0 });
    expect(pointAlong(quads, 1)).toEqual({ x: 100, y: 0 });
    expect(pointAlong(quads, 0.5)!.x).toBeCloseTo(50);
    const through = throughQuads([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 200, y: 0 },
    ]);
    expect(pointAlong(through, 0.5)!.x).toBeCloseTo(100);
    expect(pointAlong([], 0.5)).toBeNull();
  });
});

describe('the chain as the player sees it', () => {
  it('counts days of cover from stock and daily use', () => {
    expect(coverDays(start, 'aldoria', 'fuel')).toBe(20);
    // Kesh only pumps crude; it uses no fuel.
    expect(coverDays(start, 'kesh', 'fuel')).toBeNull();
    expect(coverNote(start, 'aldoria')).toEqual({ text: 'Fuel 20 days', ink: 'quiet' });
    expect(coverNote(withStock(start, 'aldoria', 'fuel', 280), 'aldoria')!.ink).toBe('warning');
    expect(coverNote(withStock(start, 'aldoria', 'fuel', 80), 'aldoria')!.ink).toBe('threat');
  });

  it('moves each shipment along its route, day by day, until it lands', () => {
    const marks = shipMarks(start);
    expect(marks.length).toBeGreaterThan(40);
    for (const m of marks) expect(m.progress).toBeGreaterThanOrEqual(0);
    const next = shipMarks(days(start, 1));
    const later = marks.find((m) => m.progress < 0.5)!;
    const same = next.find((m) => m.key === later.key)!;
    expect(same.progress).toBeGreaterThan(later.progress);
  });

  it('empties the strait routes a voyage after the strait closes', () => {
    const closed = days(setChokepointOpen(start, 'south_strait', false), 14);
    const strait = shipMarks(closed).filter((m) => closed.world.links[m.link]!.via.length > 0);
    expect(strait).toEqual([]);
  });

  it('tells working, cut and starved plants apart', () => {
    const status = (game: GameState, id: string) =>
      plantMarks(game).find((p) => p.id === id)!.status;
    expect(status(start, 'thessa_refinery')).toBe('working');
    expect(status(fire(start, 'thessa_refinery'), 'thessa_refinery')).toBe('cut');
    expect(status(withStock(start, 'aldoria', 'crude', 3), 'aldoria_refinery')).toBe('starved');
    const veskar = plantMarks(start, 'veskar').map((p) => p.kind);
    expect(veskar.sort()).toEqual(['refinery', 'well']);
    expect(plantMarks(fire(start, 'thessa_refinery'), 'thessa')[0]!.summary).toMatch(
      /down to \d+ fuel a day of 45$/,
    );
  });

  it('puts plants and days of cover on the Trade lens, and queues on Unrest', () => {
    const trade = lensView(start, 'trade');
    expect(trade.countries['aldoria']!.note).toBe('Fuel 20 days');
    expect(trade.countries['kesh']!.note).toMatch(/^Sells crude/);
    expect(trade.countries['thessa']!.plants!.map((p) => p.kind)).toEqual(['refinery']);
    expect(trade.countries['orrin']!.plants).toBeUndefined();
    const queues = {
      ...start,
      world: {
        ...start.world,
        countries: {
          ...start.world.countries,
          aldoria: {
            ...start.world.countries['aldoria']!,
            stats: { ...start.world.countries['aldoria']!.stats, shortage_fuel: 12 },
          },
        },
      },
    };
    expect(lensView(queues, 'unrest').countries['aldoria']!.note).toMatch(/· queues$/);
    expect(lensView(queues, 'trade').countries['aldoria']!.note).toBe('Fuel run out');
  });
});

describe('stock memos', () => {
  it('reports a stock running low only once while it hovers near the line', () => {
    expect(stockLevel(start, 'fuel', 'ok')).toBe('ok');
    const low = withStock(start, 'aldoria', 'fuel', 9 * 40);
    expect(stockLevel(low, 'fuel', 'ok')).toBe('low');
    const twelve = withStock(start, 'aldoria', 'fuel', 12 * 40);
    expect(stockLevel(twelve, 'fuel', 'low')).toBe('low');
    expect(stockLevel(twelve, 'fuel', 'ok')).toBe('ok');
    expect(stockLevel(start, 'fuel', 'low')).toBe('ok');
  });

  it('walks you through a closure: crude low, fuel low, then queues at the pumps', () => {
    let game = setChokepointOpen(start, 'south_strait', false);
    let news = initialNews;
    const all: Dispatch[] = [];
    for (let i = 0; i < 160; i += 1) {
      const result = step(game, []);
      game = result.state;
      const out = dispatchesFor(news, result.events, game);
      news = out.news;
      all.push(...out.dispatches.filter((d) => d.source === 'supply'));
    }
    const headlines = all.map((d) => d.headline);
    expect(headlines[0]).toMatch(/^Crude oil stocks down to \d days$/);
    const fuelLow = headlines.findIndex((h) => /^Fuel stocks down to/.test(h));
    const queues = headlines.indexOf('Queues at the pumps: fuel has run out');
    expect(fuelLow).toBeGreaterThan(0);
    expect(queues).toBeGreaterThan(fuelLow);
    const out = all[queues]!;
    expect(isAlert(out)).toBe(true);
    expect(out.stat).toEqual({ kind: 'country', id: 'aldoria', stat: 'stock_fuel' });
    // Each step is reported once, not every day.
    expect(new Set(headlines.filter((h) => h.startsWith('Queues'))).size).toBe(1);
    expect(headlines.filter((h) => h.startsWith('Queues')).length).toBeLessThanOrEqual(2);
  });

  it("makes a fire urgent when it hits a refinery you buy from, but not one you don't", () => {
    const game = createGame(scenario, 1);
    const fired = (event: string) =>
      dispatchesFor(
        initialNews,
        [{ kind: 'event_fired', tick: 1, event, scheduled: false }],
        game,
        1,
      ).dispatches[0]!;
    // Corvan's fire is only a warning in the scenario, but Corvan sells you fuel.
    expect(game.defs.events['corvan_refinery_fire']!.severity).toBe('warning');
    expect(fired('corvan_refinery_fire').severity).toBe('critical');
    // Kesh's wells ship crude to Thessa and Velmont, not to you.
    expect(fired('kesh_well_blowout').severity).toBe('warning');
  });
});

describe('the delayed ripple', () => {
  it("rings at a refinery's country when its crude falls below a few days' worth", () => {
    const full = start;
    const low = withStock(start, 'thessa', 'crude', 40);
    expect(refineriesRunningLow(full, low)).toEqual(['thessa_refinery']);
    expect(refineriesRunningLow(low, low)).toEqual([]);
    expect(ripplesFor(full, low, [])).toEqual([
      { at: { kind: 'country', id: 'thessa' }, tone: 'quiet' },
    ]);
  });

  it('rings at home, as a threat, when the pumps run dry', () => {
    const drafts = ripplesFor(start, start, [
      {
        id: 'd',
        tick: 0,
        tag: 'Home',
        severity: 'critical',
        headline: 'Queues at the pumps: fuel has run out',
        source: 'supply',
        country: 'aldoria',
      },
    ]);
    expect(drafts).toEqual([{ at: { kind: 'country', id: 'aldoria' }, tone: 'threat' }]);
  });
});
