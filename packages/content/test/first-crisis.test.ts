import { describe, expect, it } from 'vitest';
import {
  addModifier,
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
  goalNeed,
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
  it('files every player order with a ministry, for the cabinet', () => {
    const unfiled = scenario.decisions.filter((d) => d.for === undefined && !d.ministry);
    expect(unfiled.map((d) => d.id)).toEqual([]);
    expect(scenario.decisions.filter((d) => d.for !== undefined && d.ministry)).toEqual([]);
  });

  it('loads and validates', () => {
    expect(scenario.id).toBe('first_crisis');
    expect(scenario.rules.playerCountry).toBe('aldoria');
    expect(scenario.countries).toHaveLength(8);
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
    expect(price(year, 'crude')).toBe(7_300);
    expect(price(year, 'fuel')).toBe(9_500);
    expect(price(year, 'grain')).toBe(2_200);
    expect(price(year, 'steel')).toBe(6_500);
  });

  it('ripples: closing the South Strait raises crude, fuel and grain, but not steel', () => {
    const month = run(setChokepointOpen(createGame(quiet, 1), 'south_strait', false), 30);
    expect(price(month, 'crude')).toBeGreaterThan(7_300);
    expect(price(month, 'fuel')).toBeGreaterThan(9_500);
    // Orrin's grain to Veskar also sails through the strait.
    expect(price(month, 'grain')).toBeGreaterThan(2_200);
    expect(price(month, 'steel')).toBe(6_500);
  });

  it('matches the recorded market response to a 30-day closure (golden run)', () => {
    // If this changes, the market's behavior changed. Update deliberately.
    const month = run(setChokepointOpen(createGame(quiet, 1), 'south_strait', false), 30);
    expect({
      crude: price(month, 'crude'),
      fuel: price(month, 'fuel'),
      grain: price(month, 'grain'),
    }).toEqual({
      crude: 9_671, // 73.00 -> 96.71: 55 of 100 a day pass the strait, and crude stocks run down
      fuel: 10_071, // 95.00 -> 100.71: fuel stocks still hold after a month
      grain: 2_797, // 22.00 -> 27.97
    });
  });

  it('runs every budget at a small surplus while prices are normal, but Kesh', () => {
    const game = createGame(quiet, 1);
    for (const id of Object.keys(game.world.countries)) {
      const balance = monthlyBalance(game, id);
      if (id === 'kesh') {
        // Kesh alone runs a small deficit, which keeps it hungry.
        expect(balance).toBeLessThan(0);
        expect(balance).toBeGreaterThan(-1_000);
        continue;
      }
      expect(balance, id).toBeGreaterThan(0);
      expect(balance, id).toBeLessThan(2_000);
    }
  });

  it('turns a long closure into a monthly deficit, and costs Corvan its tolls', () => {
    const treasury = (state: GameState, id: string) =>
      effectiveStat(state, { kind: 'country', id, stat: 'treasury' });
    const calm = run(createGame(quiet, 1), 150);
    const closed = run(setChokepointOpen(createGame(quiet, 1), 'south_strait', false), 150);
    // Five months in, the tanks are dry and what fuel arrives is bought dear.
    // (A country that runs dry also buys less, so the treasury itself holds.)
    expect(monthlyBalance(closed, 'aldoria')).toBeLessThan(-3_000);
    // Corvan loses its tolls; its refinery's dear fuel sales to Aldoria only claw part of it back.
    expect(treasury(closed, 'corvan')).toBeLessThan(treasury(calm, 'corvan'));
  });

  it('turns a long closure into lower stability at home', () => {
    // Three months: the tanks run dry around day 80.
    const closed = run(setChokepointOpen(createGame(quiet, 1), 'south_strait', false), 90);
    const stability = effectiveStat(closed, { kind: 'country', id: 'aldoria', stat: 'stability' });
    expect(stability).toBeLessThan(35);
  });
});

describe('first-crisis full games', () => {
  it('plays out identically from the same seed', () => {
    const a = playIdle(7);
    const b = playIdle(7);
    expect(a.state).toEqual(b.state);
    expect(a.story).toEqual(b.story);
  });

  it('matches the recorded idle game for seed 7 (golden run)', () => {
    // If this changes, the scenario or the simulation changed. Update deliberately,
    // after checking `pnpm balance` still looks healthy.
    const { state, story } = playIdle(7);
    expect({ outcome: state.outcome, story: story.slice(0, 16) }).toEqual(GOLDEN_IDLE_SEED_7);
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
    // Fuel from Thessa's refinery is taxed too.
    expect(tradeItems(later, me, 'tariffs').map((i) => [i.resource, i.units])).toEqual([
      ['fuel', 15],
      ['steel', 25],
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
    // Relations at -60 from the start: Thessa's grudge, with months for it to build.
    const hostile: ScenarioDef = {
      ...scenario,
      relations: scenario.relations.map((r) =>
        r.between.includes('thessa') && r.between.includes('aldoria') ? { ...r, value: -60 } : r,
      ),
    };
    let sanctionedIn = 0;
    for (let seed = 1; seed <= 6; seed += 1) {
      let state = createGame(hostile, seed);
      while (!state.outcome && !state.flags.includes('sanctioned_by_thessa')) {
        state = step(state, []).state;
      }
      if (!state.flags.includes('sanctioned_by_thessa')) continue;
      sanctionedIn += 1;
      // Whatever happens next, the backstop is already set: eight months at most.
      const backstop = state.scheduled.find((e) => e.event === 'thessa_sanctions_collapse');
      expect(backstop?.dueTick).toBe(state.tick - 1 + 240);
    }
    expect(sanctionedIn).toBeGreaterThan(2);
  }, 20_000);

  it('rations fuel: less crude wanted, a cheaper price, a smaller bill, slower industry', () => {
    const me = 'aldoria';
    const ration = (state: GameState) =>
      step(state, [{ kind: 'decide', decision: 'ration_fuel', by: me }]).state;
    const closed = setChokepointOpen(createGame(quiet, 1), 'south_strait', false);
    const plain = run(closed, 60);
    const rationed = run(ration(closed), 60);
    expect(marketDemand(rationed, 'fuel')).toBe(92);
    expect(price(rationed, 'fuel')).toBeLessThan(price(plain, 'fuel'));
    const fuelBill = (state: GameState) =>
      tradeItems(state, me, 'imports').find((i) => i.resource === 'fuel')?.amount ?? 0;
    expect(fuelBill(rationed)).toBeLessThanOrEqual(fuelBill(plain));
    // The why-trace finds the order behind the lower demand.
    const why = explainStat(rationed, { kind: 'resource', id: 'fuel', stat: 'price' });
    const market = why.contributions.find((c) => c.cause.type === 'market')!.cause;
    if (market.type !== 'market') throw new Error('expected a market');
    expect(market.demands).toEqual([expect.objectContaining({ country: me, delta: -8 })]);
    const ended = step(rationed, [{ kind: 'decide', decision: 'end_rationing', by: me }]).state;
    expect(marketDemand(ended, 'fuel')).toBe(100);
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
    // Day 200, relations with Corvan at their worst: closing the strait appeals.
    const day200 = run(createGame(scenario, 1), 200);
    const game = {
      ...day200,
      modifiers: [
        ...day200.modifiers,
        {
          id: 'test_relation',
          target: { kind: 'relation' as const, id: 'aldoria__corvan', stat: 'value' },
          op: 'add' as const,
          amount: -100,
          source: { kind: 'event' as const, id: 'test', tick: 0 },
          expiresAt: null,
        },
      ],
    };
    expect(hostile(game)).toBeGreaterThan(0);
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

  it("makes the Narrows Thessa's lever on chips: Aldoria, Velmont and Kesh go short, Thessa does not", () => {
    const shut = run(setChokepointOpen(createGame(quiet, 1), 'narrows', false), 30);
    expect(price(shut, 'chips')).toBeGreaterThan(15_000 * 2);
    expect(marketSupply(shut, 'chips')).toBe(8);
    // The military feels chips most.
    const military = { kind: 'faction' as const, id: 'aldoria_military', stat: 'satisfaction' };
    expect(effectiveStat(shut, military)).toBeLessThan(58);
  });

  it('lets Kesh fall to a coup that stops its wells', () => {
    let coups = 0;
    for (let seed = 1; seed <= 20; seed += 1) {
      let state = createGame(scenario, seed);
      for (let day = 0; day < 360 && !state.outcome; day += 1) {
        const result = step(state, []);
        state = result.state;
        if (result.events.some((e) => e.kind === 'event_fired' && e.event === 'kesh_coup')) {
          coups += 1;
          expect(effectiveStat(state, { kind: 'plant', id: 'kesh_wells', stat: 'capacity' })).toBe(
            0,
          );
          break;
        }
      }
    }
    expect(coups).toBeGreaterThan(2);
  }, 20_000);

  it('expands the refinery at home twice at most, buying more crude each time', () => {
    const me = 'aldoria';
    const rich = createGame(quiet, 1);
    const refinery = (state: GameState) =>
      effectiveStat(state, { kind: 'plant', id: 'aldoria_refinery', stat: 'capacity' });
    const crude = (state: GameState) =>
      effectiveStat(state, { kind: 'link', id: 'crude_veskar_aldoria', stat: 'capacity' });
    const expand = (state: GameState) =>
      run(step(state, [{ kind: 'decide', decision: 'expand_refinery', by: me }]).state, 240);
    const once = expand(rich);
    expect(refinery(once)).toBe(30);
    expect(crude(once)).toBe(30);
    const twice = expand(once);
    expect(refinery(twice)).toBe(45);
    expect(canIssue(twice, 'expand_refinery', me).ok).toBe(false);
  });

  it('sends the tankers the long way round: slower, dearer, but past a closed strait', () => {
    const me = 'aldoria';
    const closed = setChokepointOpen(createGame(quiet, 1), 'south_strait', false);
    const stock = (state: GameState) => state.world.countries[me]!.stats.stock_crude ?? 0;
    const plain = run(closed, 60);
    const longWay = run(
      step(closed, [{ kind: 'decide', decision: 'long_way_round', by: me }]).state,
      60,
    );
    expect(stock(longWay)).toBeGreaterThan(stock(plain));
    expect(longWay.world.links.crude_veskar_aldoria_long!.stats.shipped).toBeGreaterThan(0);
    expect(monthlyBalance(longWay, me)).toBeLessThan(monthlyBalance(plain, me));
    const back = step(longWay, [{ kind: 'decide', decision: 'end_long_way_round', by: me }]).state;
    expect(back.flags).not.toContain('long_way_round');
    expect(
      effectiveStat(back, { kind: 'link', id: 'crude_veskar_aldoria_long', stat: 'capacity' }),
    ).toBe(0);
  });

  it("lets a fire at Thessa's refinery run fuel short without touching crude", () => {
    const fire = addModifier(createGame(quiet, 1), {
      target: { kind: 'plant', id: 'thessa_refinery', stat: 'capacity' },
      op: 'pct',
      amount: -7_500,
      source: { kind: 'event', id: 'thessa_refinery_fire', tick: 0 },
      expiresAt: 60,
    });
    const later = run(fire, 50);
    expect(price(later, 'fuel')).toBeGreaterThan(9_500);
    expect(price(later, 'crude')).toBeLessThanOrEqual(7_300);
  });

  it('recovers spent influence by a point a month, up to where it started', () => {
    const me = 'aldoria';
    const influence = (state: GameState) =>
      effectiveStat(state, { kind: 'country', id: me, stat: 'influence' });
    const sent = step(createGame(quiet, 1), [
      { kind: 'decide', decision: 'envoy', by: me, target: 'orrin' },
    ]).state;
    expect(influence(sent)).toBe(30);
    expect(influence(run(sent, 29))).toBe(31);
    expect(influence(run(sent, 400))).toBe(38);
  });

  it('gives Corvan a budget reason to reopen the strait: closing it costs its tolls', () => {
    const closed = run(setChokepointOpen(createGame(quiet, 1), 'south_strait', false), 31);
    const need = (state: GameState) => goalNeed(state, 'corvan', { id: 'balance', weight: 10 });
    // After a day, once the economy has counted Corvan's trade.
    expect(need(run(createGame(quiet, 1), 1))).toBe(0);
    expect(need(closed)).toBeGreaterThan(0);
    // Velmont, which buys chips through the Narrows, needs them once supply runs short.
    const short = run(setChokepointOpen(createGame(quiet, 1), 'narrows', false), 5);
    expect(goalNeed(short, 'velmont', { id: 'supply(chips)', weight: 15 })).toBe(10_000);
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

// Left alone, Aldoria is courted by Velmont and Orrin while Corvan tightens its
// customs checks. A fishing dispute on day 105 sets Corvan raising fees and
// detaining a tanker; Thessa pulls Corvan into a pact and Veskar cuts output.
// Corvan denounces Aldoria and closes the strait on day 185, protests break out
// in Kesh, fuel runs short at home, and the leader falls on day 304.
const GOLDEN_IDLE_SEED_7 = {
  outcome: { result: 'ousted', tick: 304 },
  story: [
    '6:velmont.court>aldoria',
    '13:orrin.court>aldoria',
    '14:corvan_customs_checks',
    '26:thessa.court>corvan',
    '105:fishing_dispute',
    '106:corvan.corvan_raise_fees',
    '114:thessa.thessa_corvan_pact',
    '119:corvan.corvan_detain_tanker',
    '119:veskar.veskar_cut_output',
    '139:kesh.kesh_raise_crude',
    '152:velmont.velmont_court_aldoria',
    '160:velmont.velmont_aid>kesh',
    '176:ilmar.ilmar_restrict_chips',
    '180:corvan.denounce_aldoria>aldoria',
    '185:corvan.corvan_close_strait',
    '190:kesh_protests',
  ],
};
