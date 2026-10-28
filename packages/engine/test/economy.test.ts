import { describe, expect, it } from 'vitest';
import {
  addModifier,
  budgetOf,
  createGame,
  effectiveStat,
  explainStat,
  monthlyBalance,
  run,
  setChokepointOpen,
  step,
  tradeItems,
  type ScenarioDef,
  type StatRef,
  type WhyNode,
} from '../src/index';
import { stabilityRef, tinyScenario, treasuryRef } from './fixtures';

/**
 * The tiny world with budgets. At normal prices the importer pays 10.428 bn a
 * month for its oil and nets exactly 3 bn; the exporter's sales and its 10%
 * toll on the strait just cover its upkeep.
 */
function budgeted(importer: { revenue?: number; treasury?: number } = {}): ScenarioDef {
  return {
    ...tinyScenario,
    countries: tinyScenario.countries.map((c) =>
      c.id === 'importer'
        ? {
            ...c,
            stats: {
              ...c.stats,
              influence: 30,
              treasury: importer.treasury ?? 400,
              revenue: importer.revenue ?? 13_428,
              spending: 0,
            },
          }
        : { ...c, stats: { ...c.stats, revenue: 0, spending: 11_262 } },
    ),
    chokepoints: tinyScenario.chokepoints.map((c) => ({ ...c, tollBp: 1_000 })),
  };
}

const exporterTreasury: StatRef = { kind: 'country', id: 'exporter', stat: 'treasury' };
const treasury = (state: Parameters<typeof effectiveStat>[0]) => effectiveStat(state, treasuryRef);

describe('economy: the monthly budget', () => {
  it('prices trade from routes and demand', () => {
    const game = createGame(budgeted(), 1);
    expect(tradeItems(game, 'importer', 'imports')).toEqual([
      { resource: 'oil', units: 50, amount: 10_428 },
    ]);
    expect(tradeItems(game, 'exporter', 'exports')).toEqual([
      { resource: 'oil', units: 50, amount: 10_428 },
    ]);
    // The toll applies only to the 40 units a day that pass through the strait.
    expect(tradeItems(game, 'exporter', 'transit')).toEqual([
      { resource: 'oil', units: 40, amount: 834 },
    ]);
  });

  it('settles into the treasury on the last day of each month', () => {
    const game = createGame(budgeted(), 1);
    expect(treasury(run(game, 29))).toBe(400);
    const settled = step(run(game, 29), []);
    expect(treasury(settled.state)).toBe(403);
    expect(settled.events).toContainEqual({
      kind: 'budget_settled',
      tick: 29,
      country: 'importer',
      millions: 3_000,
      bn: 3,
    });
    expect(treasury(run(game, 60))).toBe(406);
    expect(budgetOf(run(game, 60), 'importer')).toMatchObject({ settled: 6, months: 2 });
  });

  it('carries what does not make a whole billion to the next month', () => {
    const game = createGame(budgeted({ revenue: 13_928 }), 1); // 3.5 bn a month
    expect(treasury(run(game, 30))).toBe(403);
    expect(treasury(run(game, 60))).toBe(407);
  });

  it('leaves countries without a budget alone', () => {
    const later = run(createGame(tinyScenario, 1), 60);
    expect(treasury(later)).toBe(400);
    expect(later.budgets).toEqual({});
  });

  it('makes a closed strait cost the importer and the country that holds it', () => {
    const closed = run(setChokepointOpen(createGame(budgeted(), 1), 'strait', false), 60);
    expect(monthlyBalance(closed, 'importer')).toBeLessThan(-5_000);
    // The exporter sells less and collects no toll.
    expect(monthlyBalance(closed, 'exporter')).toBeLessThan(0);
    expect(treasury(closed)).toBeLessThan(400);
    expect(effectiveStat(closed, exporterTreasury)).toBeLessThan(300);
  });

  it('counts a policy as a running line in the budget', () => {
    const game = addModifier(createGame(budgeted(), 1), {
      target: { kind: 'country', id: 'importer', stat: 'spending' },
      op: 'add',
      amount: 2_000,
      source: { kind: 'decision', id: 'subsidy', tick: 0, by: 'importer' },
      expiresAt: null,
    });
    expect(monthlyBalance(game, 'importer')).toBe(1_000);
    expect(treasury(run(game, 30))).toBe(401);
  });
});

describe('economy: debt', () => {
  it('weighs on stability and influence once the treasury is below zero', () => {
    // No revenue: about 10.4 bn a month out, from a treasury of 5.
    const game = createGame(budgeted({ revenue: 0, treasury: 5 }), 1);
    expect(effectiveStat(run(game, 29), stabilityRef)).toBe(60);
    const inDebt = run(game, 30);
    expect(treasury(inDebt)).toBe(-5);
    expect(effectiveStat(inDebt, stabilityRef)).toBe(57);
    expect(effectiveStat(inDebt, { kind: 'country', id: 'importer', stat: 'influence' })).toBe(28);
  });
});

describe('economy: why', () => {
  it('explains a treasury through the budget, its imports and the oil price', () => {
    const closed = run(setChokepointOpen(createGame(budgeted(), 1), 'strait', false), 60);
    const why = explainStat(closed, treasuryRef);
    expect(why.normal).toBe(400);
    const budget = why.contributions.find((c) => c.cause.type === 'budget')!;
    expect(budget.effect).toBe(treasury(closed) - 400);
    if (budget.cause.type !== 'budget') throw new Error('expected a budget');
    expect(budget.cause.months).toBe(2);

    const imports = budget.cause.spending.contributions.find((c) => c.cause.type === 'trade')
      ?.cause as Extract<WhyNode, { type: 'trade' }>;
    expect(imports.line).toBe('imports');
    const oil = imports.items[0]!.cause;
    expect(oil).toMatchObject({ type: 'stat', ref: { kind: 'resource', id: 'oil' } });
  });

  it('keeps spending and the budget apart in the why-trace', () => {
    const game = createGame(budgeted(), 1);
    const signed = step(game, [{ kind: 'decide', decision: 'envoy', by: 'importer' }]).state;
    const later = run(signed, 40);
    const why = explainStat(later, treasuryRef);
    // The envoy's cost is a lasting adjustment; the month's surplus is the budget.
    expect(why.contributions.map((c) => [c.cause.type, c.effect])).toEqual(
      expect.arrayContaining([
        ['decision', -20],
        ['budget', 3],
      ]),
    );
    expect(treasury(later)).toBe(383);
  });
});
