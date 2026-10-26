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
/** No world events and no computer countries acting, for tests that need a predictable world. */
const { ai, ...withoutAi } = scenario;
void ai;
const quiet: ScenarioDef = { ...withoutAi, events: [] };

const price = (state: GameState, resource: string) =>
  effectiveStat(state, { kind: 'resource', id: resource, stat: 'price' });

/**
 * Play a game with the player doing nothing. The story is every world event
 * and every computer country's successful order, in order, as "day:what".
 */
function playIdle(seed: number): { state: GameState; story: string[] } {
  let state = createGame(scenario, seed);
  const story: string[] = [];
  while (!state.outcome) {
    const result = step(state, []);
    state = result.state;
    for (const e of result.events) {
      if (e.kind === 'event_fired') story.push(`${e.tick}:${e.event}`);
      if (e.kind === 'decision_resolved' && e.success) {
        story.push(`${e.tick}:${e.by}.${e.decision}${e.target ? `>${e.target}` : ''}`);
      }
    }
  }
  return { state, story };
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
    expect(a.story).toEqual(b.story);
  });

  it('matches the recorded idle game for seed 3 (golden run)', () => {
    // If this changes, the scenario or the simulation changed. Update deliberately,
    // after checking `pnpm balance` still looks healthy.
    const { state, story } = playIdle(3);
    expect({ outcome: state.outcome, story: story.slice(0, 10) }).toEqual(GOLDEN_IDLE_SEED_3);
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

  it('gives Thessa a reason to answer a steel tariff in kind', () => {
    let seedsWithAnswer = 0;
    for (let seed = 1; seed <= 20; seed += 1) {
      let state = step(createGame(scenario, seed), [
        { kind: 'decide', decision: 'steel_tariff', by: 'aldoria' },
      ]).state;
      for (let day = 0; day < 360 && !state.outcome; day += 1) state = step(state, []).state;
      if (state.trace.choices.some((c) => c.decision === 'thessa_curb_steel')) seedsWithAnswer += 1;
    }
    expect(seedsWithAnswer).toBeGreaterThan(0);
  });
});

// Left alone, Aldoria is squeezed by every neighbour: Corvan raises transit
// fees, a fishing dispute sours relations, Corvan detains a tanker and
// denounces Aldoria, Veskar cuts output, Thessa offers Corvan a pact, and Corvan
// closes the strait on day 176. The leader falls on day 246.
const GOLDEN_IDLE_SEED_3 = {
  outcome: { result: 'ousted', tick: 246 },
  story: [
    '16:corvan_customs_checks',
    '30:orrin.court>aldoria',
    '39:thessa.court>corvan',
    '45:corvan.corvan_raise_fees',
    '87:fishing_dispute',
    '111:corvan.corvan_detain_tanker',
    '116:corvan.denounce_aldoria>aldoria',
    '120:veskar.veskar_cut_output',
    '140:thessa.thessa_corvan_pact',
    '176:corvan.corvan_close_strait',
  ],
};
