import { describe, expect, it } from 'vitest';
import {
  canIssue,
  createGame,
  policiesInForce,
  effectiveStat,
  marketDemand,
  marketSupply,
  run,
  setChokepointOpen,
  sortedIds,
  step,
  type GameState,
  type ScenarioDef,
} from '@ripple/engine';
import { loadBuiltInScenario } from '../src/load';

const scenario = loadBuiltInScenario('first-crisis');
/** The same world with no events, to test market mechanics in isolation. */
const quiet: ScenarioDef = { ...scenario, events: [] };

const price = (state: GameState, resource: string) =>
  effectiveStat(state, { kind: 'resource', id: resource, stat: 'price' });

function playIdle(seed: number): { state: GameState; fired: string[] } {
  let state = createGame(scenario, seed);
  const fired: string[] = [];
  while (!state.outcome) {
    const result = step(state, []);
    state = result.state;
    for (const e of result.events) if (e.kind === 'event_fired') fired.push(e.event);
  }
  return { state, fired };
}

describe('first-crisis scenario', () => {
  it('loads and validates', () => {
    expect(scenario.id).toBe('first_crisis');
    expect(scenario.rules.playerCountry).toBe('aldoria');
    expect(scenario.countries).toHaveLength(5);
    expect(scenario.decisions.length).toBeGreaterThanOrEqual(8);
    expect(scenario.events.length).toBeGreaterThanOrEqual(10);
  });

  it('starts with every market in balance', () => {
    const game = createGame(scenario, 1);
    for (const id of sortedIds(game.world.resources)) {
      expect(marketSupply(game, id), `supply of ${id}`).toBe(marketDemand(game, id));
    }
  });

  it('keeps prices stable for a year when no events fire', () => {
    const year = run(createGame(quiet, 1), 360);
    expect(price(year, 'oil')).toBe(7_300);
    expect(price(year, 'grain')).toBe(2_200);
    expect(price(year, 'steel')).toBe(6_500);
  });

  it('ripples: closing the South Strait raises oil and grain, but not steel', () => {
    const month = run(setChokepointOpen(createGame(quiet, 1), 'south_strait', false), 30);
    expect(price(month, 'oil')).toBeGreaterThan(7_300);
    // Orrin's grain to Veskar also sails through the strait.
    expect(price(month, 'grain')).toBeGreaterThan(2_200);
    expect(price(month, 'steel')).toBe(6_500);
  });

  it('matches the recorded market response to a 30-day closure (golden run)', () => {
    // If this changes, the market's behavior changed. Update deliberately.
    const month = run(setChokepointOpen(createGame(quiet, 1), 'south_strait', false), 30);
    expect({ oil: price(month, 'oil'), grain: price(month, 'grain') }).toEqual({
      oil: 16_283, // 73.00 -> 162.83
      grain: 3_039, // 22.00 -> 30.39
    });
  });

  it('turns a long closure into lower stability at home', () => {
    const closed = run(setChokepointOpen(createGame(quiet, 1), 'south_strait', false), 60);
    const stability = effectiveStat(closed, { kind: 'country', id: 'aldoria', stat: 'stability' });
    expect(stability).toBeLessThan(45);
  });
});

describe('first-crisis full games', () => {
  it('plays out identically from the same seed', () => {
    const a = playIdle(7);
    const b = playIdle(7);
    expect(a.state).toEqual(b.state);
    expect(a.fired).toEqual(b.fired);
  });

  it('matches the recorded idle game for seed 4 (golden run)', () => {
    // If this changes, the scenario or the simulation changed. Update deliberately,
    // after checking `pnpm balance` still looks healthy.
    const { state, fired } = playIdle(4);
    expect({ outcome: state.outcome, firstEvents: fired.slice(0, 5) }).toEqual(GOLDEN_IDLE_SEED_4);
  });

  it('lets the player lift steel tariffs, at a price', () => {
    const me = 'aldoria';
    const thessa = { kind: 'relation' as const, id: 'aldoria__thessa', stat: 'value' };
    const industry = { kind: 'faction' as const, id: 'aldoria_industry', stat: 'satisfaction' };
    const decide = (decision: string) => [{ kind: 'decide' as const, decision, by: me }];

    const quietGame = createGame(quiet, 1);
    expect(canIssue(quietGame, 'lift_steel_tariff', me)).toEqual({
      ok: false,
      reason: 'No steel tariffs are in force.',
    });

    const raised = step(quietGame, decide('steel_tariff')).state;
    expect(policiesInForce(raised).map((d) => d.id)).toEqual(['steel_tariff']);
    expect(effectiveStat(raised, thessa)).toBe(-25);
    expect(effectiveStat(raised, industry)).toBe(63);
    expect(canIssue(raised, 'steel_tariff', me)).toEqual({
      ok: false,
      reason: 'Tariffs on Thessa are already in force.',
    });

    const lifted = step(raised, decide('lift_steel_tariff')).state;
    expect(policiesInForce(lifted)).toEqual([]);
    expect(lifted.flags).not.toContain('steel_tariff_active');
    // Half the goodwill comes back; industry loses its boost and grumbles for a while.
    expect(effectiveStat(lifted, thessa)).toBe(-10);
    expect(effectiveStat(lifted, industry)).toBe(50);
    expect(lifted.modifiers.some((m) => m.source.id === 'steel_tariff')).toBe(false);
    // The revenue already raised is kept.
    expect(effectiveStat(lifted, { kind: 'country', id: me, stat: 'treasury' })).toBe(447);
  });

  it('can turn a steel tariff into trouble with Corvan through Thessa', () => {
    let seedsWithChain = 0;
    for (let seed = 1; seed <= 20; seed += 1) {
      let state = step(createGame(scenario, seed), [
        { kind: 'decide', decision: 'steel_tariff', by: 'aldoria' },
      ]).state;
      const fired = new Set<string>();
      for (let day = 0; day < 360 && !state.outcome; day += 1) {
        const result = step(state, []);
        state = result.state;
        for (const e of result.events) if (e.kind === 'event_fired') fired.add(e.event);
      }
      if (fired.has('thessa_courts_corvan')) seedsWithChain += 1;
    }
    expect(seedsWithChain).toBeGreaterThan(0);
  });
});

// A customs slight, a fishing dispute, a detained tanker and nationalist
// rallies sour relations until Corvan closes the strait; with no response, the
// leader falls on day 273.
const GOLDEN_IDLE_SEED_4 = {
  outcome: { result: 'ousted', tick: 273 },
  firstEvents: [
    'corvan_customs_checks',
    'fishing_dispute',
    'tanker_detained',
    'corvan_nationalists',
    'corvan_closes_strait',
  ],
};
