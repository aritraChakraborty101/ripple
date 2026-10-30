import { loadBuiltInScenario } from '@ripple/content/node';
import { createGame, setChokepointOpen, sortedIds } from '@ripple/engine';
import { describe, expect, it } from 'vitest';
import { LENSES, lensView } from '../src/game/lenses';

const game = createGame(loadBuiltInScenario('first-crisis'), 1);
const player = game.rules.playerCountry;

describe('lenses', () => {
  it('describes every country and every route in every lens', () => {
    for (const { id } of LENSES) {
      const view = lensView(game, id);
      expect(Object.keys(view.countries).sort()).toEqual([...sortedIds(game.world.countries)]);
      expect(Object.keys(view.routes).sort()).toEqual([...sortedIds(game.world.links)]);
      expect(view.countries[player]!.land).toBe('you');
    }
  });

  it('shows relations as signed numbers', () => {
    const view = lensView(game, 'relations');
    expect(view.countries.corvan!.note).toMatch(/^(−\d+|0|\+\d+)$/);
  });

  it('draws cut routes in red whatever the lens', () => {
    const closed = setChokepointOpen(game, 'south_strait', false);
    const through = sortedIds(closed.world.links).filter((id) =>
      closed.world.links[id]!.via.includes('south_strait'),
    );
    expect(through.length).toBeGreaterThan(0);
    for (const { id } of LENSES) {
      const view = lensView(closed, id);
      for (const link of through) expect(view.routes[link]!.ink).toBe('threat');
    }
  });

  it('sizes trade by value and colours what you buy', () => {
    const view = lensView(game, 'trade');
    const toYou = sortedIds(game.world.links).filter((id) => game.world.links[id]!.to === player);
    expect(toYou.length).toBeGreaterThan(0);
    for (const id of toYou) expect(view.routes[id]!.ink).toBe('you');
    const widths = Object.values(view.routes).map((r) => r.width);
    expect(Math.max(...widths)).toBeCloseTo(6);
    expect(view.countries.veskar!.note).toBe('Sells crude oil');
  });

  it('names what each exporter sells and how its price has moved', () => {
    expect(lensView(game, 'prices').countries.veskar!.note).toBe('Crude oil 0%');
  });

  it('reads stability in the unrest lens', () => {
    expect(lensView(game, 'unrest').countries[player]!.note).toMatch(/^Stability \d+$/);
  });

  it('dims countries you know nothing about in the intelligence lens', () => {
    const view = lensView(game, 'intelligence');
    const quiet = Object.entries(view.countries).filter(([id]) => id !== player);
    expect(quiet.every(([, look]) => (look.note === 'No file' ? look.dim : true))).toBe(true);
  });
});
