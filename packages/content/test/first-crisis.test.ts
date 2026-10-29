import { describe, expect, it } from 'vitest';
import {
  canIssue,
  createGame,
  policiesInForce,
  relationId,
  tradeItems,
  effectiveStat,
  marketDemand,
  marketSupply,
  monthlyBalance,
  explainStat,
  score,
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

  it('runs every budget at a small surplus while prices are normal', () => {
    const game = createGame(quiet, 1);
    for (const id of Object.keys(game.world.countries)) {
      const balance = monthlyBalance(game, id);
      expect(balance, id).toBeGreaterThan(0);
      expect(balance, id).toBeLessThan(2_000);
    }
  });

  it('turns a long closure into a drained treasury, and costs Corvan its tolls', () => {
    const treasury = (state: GameState, id: string) =>
      effectiveStat(state, { kind: 'country', id, stat: 'treasury' });
    const calm = run(createGame(quiet, 1), 90);
    const closed = run(setChokepointOpen(createGame(quiet, 1), 'south_strait', false), 90);
    // Three months of dear oil cost Aldoria tens of billions.
    expect(treasury(calm, 'aldoria') - treasury(closed, 'aldoria')).toBeGreaterThan(25);
    expect(monthlyBalance(closed, 'aldoria')).toBeLessThan(-5_000);
    // Corvan earns nothing from a strait nobody can sail through.
    expect(monthlyBalance(closed, 'corvan')).toBeLessThan(0);
    expect(treasury(closed, 'corvan')).toBeLessThan(treasury(calm, 'corvan'));
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
    expect({ outcome: state.outcome, story: story.slice(0, 16) }).toEqual(GOLDEN_IDLE_SEED_3);
  });

  it('lets the player lift tariffs on Thessa, at a price', () => {
    const me = 'aldoria';
    const thessa = { kind: 'relation' as const, id: 'aldoria__thessa', stat: 'value' };
    const industry = { kind: 'faction' as const, id: 'aldoria_industry', stat: 'satisfaction' };
    const decide = (decision: string) => [
      { kind: 'decide' as const, decision, by: me, target: 'thessa' },
    ];

    const quietGame = createGame(quiet, 1);
    expect(canIssue(quietGame, 'lift_tariff', me, 'thessa')).toEqual({
      ok: false,
      reason: 'No tariffs on {target} are in force.',
    });

    const raised = step(quietGame, decide('tariff')).state;
    expect(raised.flags).toContain('tariff_on_thessa');
    expect(policiesInForce(raised).map((p) => [p.def.id, p.target])).toEqual([
      ['tariff', 'thessa'],
    ]);
    expect(effectiveStat(raised, thessa)).toBe(-25);
    expect(effectiveStat(raised, industry)).toBe(60);
    expect(canIssue(raised, 'tariff', me, 'thessa')).toEqual({
      ok: false,
      reason: 'Tariffs on {target} are already in force.',
    });

    const lifted = step(raised, decide('lift_tariff')).state;
    expect(policiesInForce(lifted)).toEqual([]);
    expect(lifted.flags).not.toContain('tariff_on_thessa');
    // Half the goodwill comes back; industry loses its boost and grumbles for a while.
    expect(effectiveStat(lifted, thessa)).toBe(-10);
    expect(effectiveStat(lifted, industry)).toBe(50);
    expect(lifted.modifiers.some((m) => m.source.id === 'tariff')).toBe(false);
    // The tariff is a 35% duty on what Aldoria buys from Thessa, collected every month.
    const rate = (state: GameState) =>
      effectiveStat(state, { kind: 'country', id: me, stat: 'tariff_thessa' });
    expect(rate(raised)).toBe(3500);
    expect(rate(lifted)).toBe(0);
    const later = run(raised, 1);
    expect(tradeItems(later, me, 'tariffs')).toEqual([
      { resource: 'steel', partner: 'thessa', units: 25, amount: 1624 },
    ]);
  });

  it('sends one envoy template to any neighbour, each with its own cooldown', () => {
    const me = 'aldoria';
    const send = (state: GameState, target: string) =>
      step(state, [{ kind: 'decide', decision: 'envoy', by: me, target }]).state;
    const game = createGame(quiet, 1);
    expect(canIssue(game, 'envoy', me)).toEqual({ ok: true });
    expect(canIssue(game, 'envoy', me, 'aldoria')).toEqual({
      ok: false,
      reason: 'Not a valid target.',
    });

    const toCorvan = send(game, 'corvan');
    expect(canIssue(toCorvan, 'envoy', me, 'corvan')).toEqual({
      ok: false,
      reason: 'Already under way.',
    });
    expect(canIssue(toCorvan, 'envoy', me, 'thessa')).toEqual({ ok: true });

    // Two weeks later the talks end; relations with Corvan alone have moved.
    const later = run(send(toCorvan, 'thessa'), 14);
    const relation = (other: string) =>
      effectiveStat(later, { kind: 'relation', id: relationId(me, other), stat: 'value' });
    expect([relation('corvan'), relation('thessa')]).not.toEqual([-10, 5]);
    expect(relation('veskar')).toBe(10);
    expect(canIssue(later, 'envoy', me, 'corvan').ok).toBe(false); // cooling down
  });

  it('opens a deal route, eases prices, and closes it when either side ends the deal', () => {
    const me = 'aldoria';
    const decide = (decision: string, target: string) => [
      { kind: 'decide' as const, decision, by: me, target },
    ];
    const grain = (state: GameState) => price(state, 'grain');
    const route = { kind: 'link' as const, id: 'deal_orrin', stat: 'capacity' };
    const game = createGame(quiet, 1);
    // Relations with Orrin start at 30, enough for talks.
    let state = step(game, decide('trade_deal', 'orrin')).state;
    // Talks take three weeks; play on until they succeed (the seed decides).
    for (let tries = 0; !state.flags.includes('deal_with_orrin') && tries < 10; tries += 1) {
      state = run(state, 21);
      if (!state.flags.includes('deal_with_orrin')) {
        state = run(state, 120);
        state = step(state, decide('trade_deal', 'orrin')).state;
      }
    }
    expect(state.flags).toContain('deal_with_orrin');
    expect(effectiveStat(state, route)).toBe(5);
    expect(grain(run(state, 60))).toBeLessThan(2_200);

    const ended = step(state, decide('end_deal', 'orrin')).state;
    expect(effectiveStat(ended, route)).toBe(0);
    expect(ended.flags).not.toContain('deal_with_orrin');
  });

  it('makes sanctions on a supplier hurt both sides, until lifted', () => {
    const me = 'aldoria';
    const order = (decision: string) => [
      { kind: 'decide' as const, decision, by: me, target: 'thessa' },
    ];
    const treasury = (state: GameState, id: string) =>
      effectiveStat(state, { kind: 'country', id, stat: 'treasury' });
    const calm = run(createGame(quiet, 1), 90);
    const sanctioned = run(step(createGame(quiet, 1), order('sanction')).state, 89);
    // No Thessan steel reaches Aldoria, so steel soars for everyone.
    expect(price(sanctioned, 'steel')).toBeGreaterThan(6_500 * 2);
    // Thessa loses its sales and a tenth of its revenue; Aldoria pays dearly for steel.
    expect(treasury(sanctioned, 'thessa')).toBeLessThan(treasury(calm, 'thessa'));
    expect(treasury(sanctioned, 'aldoria')).toBeLessThan(treasury(calm, 'aldoria'));

    const lifted = step(sanctioned, order('lift_sanctions')).state;
    expect(lifted.world.embargoes).toEqual([]);
    expect(lifted.modifiers.some((m) => m.source.id === 'sanction')).toBe(false);
  });

  it('runs an aid programme as a monthly line, and gives offence when it ends', () => {
    const me = 'aldoria';
    const order = (decision: string) => [
      { kind: 'decide' as const, decision, by: me, target: 'corvan' },
    ];
    const corvan = { kind: 'relation' as const, id: 'aldoria__corvan', stat: 'value' };
    const aiding = step(createGame(quiet, 1), order('aid_programme')).state;
    expect(effectiveStat(aiding, corvan)).toBe(10);
    expect(monthlyBalance(aiding, 'corvan') - monthlyBalance(createGame(quiet, 1), 'corvan')).toBe(
      2_000,
    );
    const ended = step(aiding, order('end_aid')).state;
    expect(effectiveStat(ended, corvan)).toBe(-20);
  });

  it('lets Thessa sanction Aldoria when relations collapse, and never for good', () => {
    // Relations at -60 from the start: Thessa's grudge, with a year for it to build.
    const hostile: ScenarioDef = {
      ...scenario,
      relations: scenario.relations.map((r) =>
        r.between.includes('thessa') && r.between.includes('aldoria') ? { ...r, value: -60 } : r,
      ),
    };
    let sanctionedIn = 0;
    let liftedIn = 0;
    for (let seed = 1; seed <= 10; seed += 1) {
      let state = createGame(hostile, seed);
      let wasSanctioned = false;
      for (let day = 0; day < 720 && !state.outcome; day += 1) {
        state = step(state, []).state;
        if (state.flags.includes('sanctioned_by_thessa')) wasSanctioned = true;
        else if (wasSanctioned) break;
      }
      if (wasSanctioned) sanctionedIn += 1;
      if (wasSanctioned && !state.flags.includes('sanctioned_by_thessa')) liftedIn += 1;
    }
    expect(sanctionedIn).toBeGreaterThan(0);
    expect(liftedIn).toBeGreaterThan(0);
  });

  it('rations fuel: less crude wanted, a cheaper price, a smaller bill, slower industry', () => {
    const me = 'aldoria';
    const ration = (state: GameState) =>
      step(state, [{ kind: 'decide', decision: 'ration_fuel', by: me }]).state;
    const closed = setChokepointOpen(createGame(quiet, 1), 'south_strait', false);
    const plain = run(closed, 60);
    const rationed = run(ration(closed), 60);
    expect(marketDemand(rationed, 'oil')).toBe(72);
    expect(price(rationed, 'oil')).toBeLessThan(price(plain, 'oil'));
    const oilBill = (state: GameState) =>
      tradeItems(state, me, 'imports').find((i) => i.resource === 'oil')!.amount;
    expect(oilBill(rationed)).toBeLessThan(oilBill(plain));
    // The why-trace finds the order behind the lower demand.
    const why = explainStat(rationed, { kind: 'resource', id: 'oil', stat: 'price' });
    const market = why.contributions.find((c) => c.cause.type === 'market')!.cause;
    if (market.type !== 'market') throw new Error('expected a market');
    expect(market.demands).toEqual([expect.objectContaining({ country: me, delta: -8 })]);
    const ended = step(rationed, [{ kind: 'decide', decision: 'end_rationing', by: me }]).state;
    expect(marketDemand(ended, 'oil')).toBe(80);
  });

  it('runs austerity and public works as monthly lines, never both at once', () => {
    const me = 'aldoria';
    const sign = (state: GameState, decision: string) =>
      step(state, [{ kind: 'decide', decision, by: me }]).state;
    const game = createGame(quiet, 1);
    const base = monthlyBalance(game, me);
    const cut = sign(game, 'austerity');
    expect(monthlyBalance(cut, me)).toBeGreaterThan(base + 2_000);
    expect(canIssue(cut, 'public_works', me).ok).toBe(false);
    const spent = sign(game, 'public_works');
    expect(monthlyBalance(spent, me)).toBeLessThan(base - 2_000);
    const workers = { kind: 'faction' as const, id: 'aldoria_workers', stat: 'satisfaction' };
    expect(effectiveStat(spent, workers)).toBeGreaterThan(effectiveStat(cut, workers));
  });

  it('lets the reserve be released again once refilled', () => {
    const me = 'aldoria';
    const sign = (state: GameState, decision: string) =>
      step(state, [{ kind: 'decide', decision, by: me }]).state;
    const released = sign(createGame(quiet, 1), 'release_reserves');
    expect(canIssue(released, 'release_reserves', me).ok).toBe(false);
    const refilling = sign(released, 'refill_reserve');
    expect(canIssue(refilling, 'refill_reserve', me).ok).toBe(false);
    expect(canIssue(run(refilling, 90), 'release_reserves', me).ok).toBe(true);
  });

  it('opens an intelligence file for four months, and Thessa grows warier of covert moves', () => {
    const me = 'aldoria';
    const file = (state: GameState) =>
      effectiveStat(state, { kind: 'country', id: me, stat: 'intel_thessa' });
    const opened = step(createGame(scenario, 1), [
      { kind: 'decide', decision: 'intel_file', by: me, target: 'thessa' },
    ]).state;
    expect(file(opened)).toBe(1);
    expect(canIssue(opened, 'intel_file', me, 'thessa').ok).toBe(false);
    expect(file(run(opened, 120))).toBe(0);
    // A gate on Thessa's agitators halves their appeal while the file is open.
    const report = score(opened, { country: 'thessa', decision: 'thessa_fund_agitators' });
    expect(report.appeal.find((a) => a.measure === 'country.aldoria.intel_thessa')).toMatchObject({
      factor: 5_000,
      gate: true,
    });
  });

  it('weakens a government with unrest, which dulls its appetite for hostile moves', () => {
    const me = 'aldoria';
    const hostile = (state: GameState) =>
      score(state, { country: 'corvan', decision: 'corvan_close_strait' }).appealTotal;
    const game = run(createGame(scenario, 1), 200);
    const shaken = {
      ...game,
      modifiers: [
        ...game.modifiers,
        {
          id: 'test',
          target: { kind: 'country' as const, id: 'corvan', stat: 'stability' },
          op: 'add' as const,
          amount: -15,
          source: { kind: 'decision' as const, id: 'stir_unrest', tick: 0, by: me },
          expiresAt: null,
        },
      ],
    };
    expect(hostile(shaken)).toBeLessThan(hostile(game));
  });

  it('gives Thessa a reason to answer a steel tariff in kind', () => {
    let seedsWithAnswer = 0;
    for (let seed = 1; seed <= 20; seed += 1) {
      let state = step(createGame(scenario, seed), [
        { kind: 'decide', decision: 'tariff', by: 'aldoria', target: 'thessa' },
      ]).state;
      for (let day = 0; day < 360 && !state.outcome; day += 1) state = step(state, []).state;
      if (state.trace.choices.some((c) => c.decision === 'thessa_curb_steel')) seedsWithAnswer += 1;
    }
    expect(seedsWithAnswer).toBeGreaterThan(0);
    // Twenty one-year games: a simulation, so it gets more time than a unit test.
  }, 20_000);
});

// Left alone, Aldoria is squeezed by every neighbour: Corvan raises transit
// fees, a fishing dispute sours relations, Corvan detains a tanker and
// denounces Aldoria, Veskar cuts output, and Thessa offers Corvan a pact. Corvan
// keeps squeezing through fees for two years; a second pact, a terminal
// explosion and nationalist rallies tip it, and it closes the strait on day 753.
// Strikes, layoffs and a drought follow, and the leader falls on day 828.
const GOLDEN_IDLE_SEED_3 = {
  outcome: { result: 'ousted', tick: 828 },
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
    '183:corvan.corvan_raise_fees',
    '225:corvan_nationalists',
    '243:corvan.corvan_detain_tanker',
    '263:orrin_bumper_harvest',
    '290:corvan.denounce_aldoria>aldoria',
    '316:corvan.corvan_raise_fees',
    '420:veskar.veskar_cut_output',
  ],
};
