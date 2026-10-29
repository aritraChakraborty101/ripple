import { describe, expect, it } from 'vitest';
import { ContentError, parseGuide } from '../src/index';
import { loadBuiltInGuide, loadBuiltInScenario } from '../src/load';

const scenario = loadBuiltInScenario('first-crisis');

function problemsOf(raw: { briefing?: unknown; advisor?: unknown }): string[] {
  try {
    parseGuide(raw, scenario, 'test');
  } catch (error) {
    if (error instanceof ContentError) return [...error.problems];
    throw error;
  }
  return [];
}

const tip = {
  id: 'oil_hurting',
  when: { stat: { target: 'resource.oil.price', above: 8760 } },
  text: 'Fuel is dear.',
  suggest: ['fuel_subsidy'],
};

describe('first-crisis guide', () => {
  const guide = loadBuiltInGuide('first-crisis', scenario);

  it('has a briefing that points at Corvan', () => {
    expect(guide.briefing?.title).toBe('You lead Aldoria');
    expect(guide.briefing?.focusCountry).toBe('corvan');
    expect(guide.briefing?.sections.length).toBeGreaterThanOrEqual(3);
  });

  it('has advisor tips that each suggest orders that exist', () => {
    expect(guide.tips.length).toBeGreaterThanOrEqual(6);
    const decisions = new Set(scenario.decisions.map((d) => d.id));
    for (const t of guide.tips) {
      for (const s of t.suggest) {
        expect(decisions.has(s.decision), `${t.id} suggests ${s.decision}`).toBe(true);
      }
    }
    const first = guide.tips.find((t) => t.id === 'corvan_slipping')!;
    expect(first.suggest).toEqual([
      { decision: 'envoy', target: 'corvan' },
      { decision: 'transit_fees' },
    ]);
  });
});

describe('guide validation', () => {
  it('converts tip conditions into engine conditions', () => {
    const guide = parseGuide({ advisor: [tip] }, scenario);
    expect(guide.tips[0]!.when).toEqual({
      type: 'stat',
      target: { kind: 'resource', id: 'oil', stat: 'price' },
      above: 8760,
    });
    expect(guide.briefing).toBeNull();
  });

  it('rejects chance, so tips can never change the game', () => {
    const risky = { ...tip, when: { all: [{ afterDay: 10 }, { chance: 500 }] } };
    expect(problemsOf({ advisor: [risky] })).toEqual([
      'advisor[0].when: Advisor tips cannot use chance; they must not affect the game',
    ]);
  });

  it('reports unknown orders, countries and stats', () => {
    const broken = {
      ...tip,
      when: { stat: { target: 'country.atlantis.stability', below: 10 } },
      suggest: ['nope'],
      country: 'atlantis',
    };
    expect(problemsOf({ advisor: [broken] })).toEqual([
      'advisor[0].suggest[0]: Unknown decision "nope"',
      'advisor[0].country: Unknown country "atlantis"',
      'advisor[0].when: Unknown country "atlantis"',
    ]);
  });

  it('checks whom a suggested order is aimed at', () => {
    const aimed = {
      ...tip,
      suggest: ['envoy', 'transit_fees>corvan', 'envoy>aldoria', 'tariff>corvan'],
    };
    expect(problemsOf({ advisor: [aimed] })).toEqual([
      'advisor[0].suggest[0]: Say whom "envoy" is aimed at, as envoy>country',
      'advisor[0].suggest[1]: "transit_fees" is not aimed at a country',
      'advisor[0].suggest[2]: "envoy" cannot be aimed at "aldoria"',
      'advisor[0].suggest[3]: "tariff" cannot be aimed at "corvan"',
    ]);
  });

  it('reports duplicate tips and a briefing pointing at an unknown country', () => {
    const briefing = {
      title: 'T',
      focusCountry: 'atlantis',
      sections: [{ heading: 'H', text: 'X' }],
    };
    expect(problemsOf({ briefing, advisor: [tip, tip] })).toEqual([
      'briefing.focusCountry: Unknown country "atlantis"',
      'advisor[1].id: Duplicate id "oil_hurting"',
    ]);
  });
});
