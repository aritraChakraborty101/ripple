import { describe, expect, it } from 'vitest';
import {
  createGame,
  effectiveStat,
  marketDemand,
  marketSupply,
  run,
  setChokepointOpen,
  sortedIds,
  type GameState,
} from '@ripple/engine';
import { loadBuiltInScenario } from '../src/load';

const scenario = loadBuiltInScenario('first-crisis');
const price = (state: GameState, resource: string) =>
  effectiveStat(state, { kind: 'resource', id: resource, stat: 'price' });

describe('first-crisis scenario', () => {
  it('loads and validates', () => {
    expect(scenario.id).toBe('first_crisis');
    expect(scenario.rules.playerCountry).toBe('aldoria');
    expect(scenario.countries).toHaveLength(5);
  });

  it('starts with every market in balance', () => {
    const game = createGame(scenario, 1);
    for (const id of sortedIds(game.world.resources)) {
      expect(marketSupply(game, id), `supply of ${id}`).toBe(marketDemand(game, id));
    }
  });

  it('keeps prices stable for a year when nothing happens', () => {
    const year = run(createGame(scenario, 1), 360);
    expect(price(year, 'oil')).toBe(7_300);
    expect(price(year, 'grain')).toBe(2_200);
    expect(price(year, 'steel')).toBe(6_500);
  });

  it('ripples: closing the South Strait raises oil and grain, but not steel', () => {
    const closed = setChokepointOpen(createGame(scenario, 1), 'south_strait', false);
    const month = run(closed, 30);

    expect(price(month, 'oil')).toBeGreaterThan(7_300);
    // Orrin's grain to Veskar also sails through the strait.
    expect(price(month, 'grain')).toBeGreaterThan(2_200);
    expect(price(month, 'steel')).toBe(6_500);
  });

  it('matches the recorded outcome of a 30-day strait closure (golden run)', () => {
    // If this changes, the simulation's behavior changed. Update deliberately.
    const month = run(setChokepointOpen(createGame(scenario, 1), 'south_strait', false), 30);
    expect({ oil: price(month, 'oil'), grain: price(month, 'grain') }).toEqual({
      oil: GOLDEN_OIL_AFTER_30_DAYS,
      grain: GOLDEN_GRAIN_AFTER_30_DAYS,
    });
  });
});

// Prices in cents: oil 73.00 -> 162.83, grain 22.00 -> 30.39.
const GOLDEN_OIL_AFTER_30_DAYS = 16_283;
const GOLDEN_GRAIN_AFTER_30_DAYS = 3_039;
