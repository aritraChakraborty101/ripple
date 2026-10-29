import { describe, expect, it } from 'vitest';
import {
  applyEffect,
  bindDecision,
  createGame,
  effectiveStat,
  explainStat,
  isEmbargoed,
  marketSupply,
  run,
  score,
  step,
  type DecisionDef,
  type GameState,
  type MarketWhy,
  type ScenarioDef,
} from '../src/index';
import { aiScenario } from './ai-fixtures';
import { tinyScenario } from './fixtures';

const source = { kind: 'decision' as const, id: 'test', tick: 0, by: 'importer' };
const embargo = (state: GameState, by: string, against: string, active = true) =>
  applyEffect(state, { type: 'embargo', by, against, active }, source);

describe('embargoes', () => {
  it('cut every route between two countries, either way', () => {
    const game = createGame(tinyScenario, 1);
    expect(marketSupply(game, 'oil')).toBe(50);
    const cut = embargo(game, 'importer', 'exporter');
    expect(isEmbargoed(cut.world, 'exporter', 'importer')).toBe(true);
    // Both routes stop, the pipeline that avoids the strait included.
    expect(marketSupply(cut, 'oil')).toBe(0);
    expect(
      effectiveStat(run(cut, 20), { kind: 'resource', id: 'oil', stat: 'price' }),
    ).toBeGreaterThan(7_300);
  });

  it('stand until the side that imposed them lifts them', () => {
    const both = embargo(
      embargo(createGame(tinyScenario, 1), 'importer', 'exporter'),
      'exporter',
      'importer',
    );
    const oneLifted = embargo(both, 'importer', 'exporter', false);
    // The exporter's own embargo still stands.
    expect(isEmbargoed(oneLifted.world, 'importer', 'exporter')).toBe(true);
    expect(
      isEmbargoed(embargo(oneLifted, 'exporter', 'importer', false).world, 'importer', 'exporter'),
    ).toBe(false);
  });

  it('explain a short market by the embargo and the order behind it', () => {
    const cut = run(embargo(createGame(tinyScenario, 1), 'importer', 'exporter'), 5);
    const price = explainStat(cut, { kind: 'resource', id: 'oil', stat: 'price' });
    const market = price.contributions[0]!.cause as MarketWhy;
    expect(market.type).toBe('market');
    expect(market.routes[0]!.cause).toMatchObject({
      type: 'embargo',
      by: 'importer',
      against: 'exporter',
      active: true,
      changedBy: { type: 'decision', decision: 'test' },
    });
  });
});

describe('templates reaching named things', () => {
  const deal: DecisionDef = {
    id: 'deal',
    name: 'Deal with {target}',
    description: 'x',
    requires: { type: 'flag', flag: 'deal_{target}', set: false },
    costs: [],
    durationDays: 0,
    cooldownDays: 0,
    chanceBp: 10_000,
    effects: [
      {
        type: 'modify',
        target: { kind: 'link', id: 'route_{target}', stat: 'capacity' },
        op: 'add',
        amount: 5,
        days: null,
      },
      {
        type: 'modify',
        target: { kind: 'country', id: 'self', stat: 'tariff_{target}' },
        op: 'add',
        amount: 100,
        days: null,
      },
      { type: 'embargo', by: 'self', against: 'target', active: true },
      { type: 'end_effects', source: { kind: 'decision', id: 'aid' }, target: 'self' },
    ],
    failureEffects: [],
    successHeadline: 'x',
    targets: 'others',
  };

  it('bind {self} and {target} inside ids, stat names and flags', () => {
    const bound = bindDecision(deal, 'home', 'strait');
    expect(bound.requires).toEqual({ type: 'flag', flag: 'deal_strait', set: false });
    expect(bound.effects).toEqual([
      expect.objectContaining({ target: { kind: 'link', id: 'route_strait', stat: 'capacity' } }),
      expect.objectContaining({ target: { kind: 'country', id: 'home', stat: 'tariff_strait' } }),
      { type: 'embargo', by: 'home', against: 'strait', active: true },
      // A named target wins over the template's own.
      { type: 'end_effects', source: { kind: 'decision', id: 'aid' }, target: 'home' },
    ]);
  });
});

describe('gate considerations', () => {
  // `close` gains a treaty check that is usually open; as a gate it must change nothing.
  const withGate = (gate: boolean): ScenarioDef => ({
    ...aiScenario,
    decisions: aiScenario.decisions.map((d) =>
      d.id !== 'detain'
        ? d
        : {
            ...d,
            consider: [
              {
                measure: { kind: 'relation', between: ['home', 'strait'] },
                curve: { type: 'rises', from: 0, to: -40 },
              },
              {
                measure: { kind: 'flag', flag: 'treaty_with_{self}' },
                curve: { type: 'falls', from: 0, to: 2 },
                ...(gate ? { gate: true } : {}),
              },
            ],
          },
    ),
  });
  const appeal = (scenario: ScenarioDef, treaty = false) => {
    let game = createGame(scenario, 1);
    if (treaty) game = { ...game, flags: ['treaty_with_strait'] };
    return score(game, { country: 'strait', decision: 'detain' }).appealTotal;
  };
  const without: ScenarioDef = {
    ...aiScenario,
    decisions: aiScenario.decisions.map((d) =>
      d.id !== 'detain'
        ? d
        : {
            ...d,
            consider: [
              {
                measure: { kind: 'relation', between: ['home', 'strait'] },
                curve: { type: 'rises', from: 0, to: -40 },
              },
            ],
          },
    ),
  };

  it('leave the appeal alone while open', () => {
    expect(appeal(withGate(true))).toBe(appeal(without));
    // As an ordinary consideration, an open check lifts the others through compensation.
    expect(appeal(withGate(false))).toBeGreaterThan(appeal(without));
  });

  it('halve the appeal when the treaty is in force', () => {
    expect(appeal(withGate(true), true)).toBe(Math.trunc(appeal(without) / 2));
  });
});

describe('orders that run on the economy', () => {
  it('a step after an embargo, the exporter sells nothing to the importer', () => {
    const budgeted: ScenarioDef = {
      ...tinyScenario,
      countries: tinyScenario.countries.map((c) => ({
        ...c,
        stats: { ...c.stats, revenue: 10_000, spending: 10_000 },
      })),
    };
    const cut = step(embargo(createGame(budgeted, 1), 'importer', 'exporter'), []).state;
    const exports = cut.modifiers.filter((m) => m.source.id === 'exports');
    expect(exports).toEqual([]);
  });
});
