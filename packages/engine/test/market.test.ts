import { describe, expect, it } from 'vitest';
import {
  addModifier,
  createGame,
  effectiveStat,
  marketSupply,
  run,
  setChokepointOpen,
  step,
  targetPrice,
  type GameState,
} from '../src/index';
import { tinyScenario } from './fixtures';

const oilPrice = (state: GameState) =>
  effectiveStat(state, { kind: 'resource', id: 'oil', stat: 'price' });

describe('market', () => {
  it('stays at the base price when supply meets demand', () => {
    expect(oilPrice(run(createGame(tinyScenario, 1), 90))).toBe(7_300);
  });

  it('cuts supply from routes through a closed chokepoint', () => {
    const closed = setChokepointOpen(createGame(tinyScenario, 1), 'strait', false);
    expect(marketSupply(closed, 'oil')).toBe(10);
  });

  it('raises prices gradually after a strait closes, then settles at the capped target', () => {
    const closed = setChokepointOpen(createGame(tinyScenario, 1), 'strait', false);
    const day1 = oilPrice(run(closed, 1));
    const day10 = oilPrice(run(closed, 10));
    const day120 = oilPrice(run(closed, 120));

    expect(day1).toBeGreaterThan(7_300);
    expect(day10).toBeGreaterThan(day1);
    // Demand 50 over supply 10 would be 5x; the ceiling caps it at 4x.
    expect(day120).toBe(targetPrice(7_300, 50, 10));
    expect(day120).toBe(29_200);
  });

  it('drifts back toward the base price once the strait reopens', () => {
    const crisis = run(setChokepointOpen(createGame(tinyScenario, 1), 'strait', false), 30);
    const reopened = setChokepointOpen(crisis, 'strait', true);
    expect(oilPrice(run(reopened, 30))).toBeLessThan(oilPrice(crisis));
    expect(oilPrice(run(reopened, 200))).toBe(7_300);
  });

  it('reports large daily moves as price_moved events', () => {
    const closed = setChokepointOpen(createGame(tinyScenario, 1), 'strait', false);
    const { events } = step(closed, []);
    expect(events).toContainEqual(
      expect.objectContaining({ kind: 'price_moved', resource: 'oil', from: 7_300 }),
    );
  });

  it('lets a capacity modifier act like a sanction on one route', () => {
    const game = addModifier(createGame(tinyScenario, 1), {
      target: { kind: 'link', id: 'oil_by_sea', stat: 'capacity' },
      op: 'pct',
      amount: -5_000,
      source: { kind: 'decision', id: 'sanction', tick: 0 },
      expiresAt: null,
    });
    expect(marketSupply(game, 'oil')).toBe(30);
    expect(oilPrice(run(game, 60))).toBeGreaterThan(7_300);
  });

  it('applies price modifiers on top of the market price', () => {
    const game = addModifier(createGame(tinyScenario, 1), {
      target: { kind: 'resource', id: 'oil', stat: 'price' },
      op: 'pct',
      amount: 1_500,
      source: { kind: 'event', id: 'panic_buying', tick: 0 },
      expiresAt: 60,
    });
    expect(oilPrice(game)).toBe(8_395);
    expect(oilPrice(run(game, 61))).toBe(7_300);
  });
});
