import { describe, expect, it } from 'vitest';
import { ContentError, parseScenario } from '../src/index';

const valid = {
  id: 'mini',
  name: 'Mini',
  rules: {
    playerCountry: 'a',
    lengthYears: 5,
    ousting: { stat: 'stability', below: 20, forTicks: 30 },
  },
  countries: [
    {
      id: 'a',
      name: 'A',
      archetype: 'industrial_importer',
      stats: { stability: 60 },
      demand: { oil: 10 },
    },
    { id: 'b', name: 'B', archetype: 'resource_exporter', stats: { stability: 60 } },
  ],
  resources: [{ id: 'oil', name: 'Oil', basePrice: 7300 }],
  links: [{ id: 'oil_b_a', resource: 'oil', from: 'b', to: 'a', capacity: 10, via: ['strait'] }],
  chokepoints: [{ id: 'strait', name: 'Strait', controlledBy: 'b' }],
};

function problemsOf(raw: unknown): string[] {
  try {
    parseScenario(raw, 'test');
  } catch (error) {
    if (error instanceof ContentError) return [...error.problems];
    throw error;
  }
  return [];
}

describe('scenario schema', () => {
  it('accepts valid content and fills defaults', () => {
    const scenario = parseScenario(valid);
    expect(scenario.factions).toEqual([]);
    expect(scenario.countries[1]!.demand).toEqual({});
    expect(scenario.chokepoints[0]!.open).toBe(true);
  });

  it('reports unknown references with their path', () => {
    const broken = {
      ...valid,
      links: [{ id: 'oil_x_a', resource: 'gas', from: 'x', to: 'a', capacity: 10, via: ['canal'] }],
    };
    expect(problemsOf(broken)).toEqual([
      'links[0].resource: Unknown resource "gas"',
      'links[0].from: Unknown country "x"',
      'links[0].via[0]: Unknown chokepoint "canal"',
    ]);
  });

  it('reports duplicate ids', () => {
    const broken = { ...valid, resources: [...valid.resources, ...valid.resources] };
    expect(problemsOf(broken)).toContain('resources[1].id: Duplicate id "oil"');
  });

  it('rejects non-integer stats, so the simulation stays deterministic', () => {
    const broken = {
      ...valid,
      countries: [{ ...valid.countries[0], stats: { stability: 60.5 } }, valid.countries[1]],
    };
    expect(problemsOf(broken)[0]).toMatch(/^countries\[0\]\.stats\.stability:/);
  });

  it('rejects unknown fields, which usually means a typo', () => {
    const broken = { ...valid, resources: [{ id: 'oil', name: 'Oil', basePrise: 7300 }] };
    const problems = problemsOf(broken);
    expect(problems.some((p) => p.includes('basePrise'))).toBe(true);
  });

  it('rejects ids that are not lower_snake_case', () => {
    const broken = { ...valid, resources: [{ id: 'Crude Oil', name: 'Oil', basePrice: 7300 }] };
    expect(problemsOf(broken).some((p) => p.includes('lower_snake_case'))).toBe(true);
  });
});

describe('events and decisions', () => {
  const closes = {
    id: 'closes',
    tag: 'b',
    severity: 'critical',
    headline: 'B closes the strait',
    trigger: {
      all: [
        { chokepointOpen: 'strait' },
        { relation: { between: ['a', 'b'], below: -40 } },
        { chance: 300 },
      ],
    },
    effects: [
      { setChokepoint: { id: 'strait', open: false } },
      { schedule: { event: 'reopens', inDays: 60 } },
      { modify: { target: 'resource.oil.price', pct: 1000, days: 30 } },
    ],
  };
  const reopens = {
    id: 'reopens',
    tag: 'b',
    headline: 'B reopens the strait',
    effects: [{ setChokepoint: { id: 'strait', open: true } }],
  };
  const envoy = {
    id: 'envoy',
    name: 'Send an envoy',
    description: 'Talks.',
    requires: { stat: { target: 'country.a.influence', above: 7 } },
    costs: [{ adjust: { target: 'country.a.influence', by: -8 } }],
    durationDays: 14,
    chance: 6000,
    effects: [{ relation: { between: ['a', 'b'], by: 20, days: 120 } }],
    successHeadline: 'Talks succeed',
  };

  it('converts the YAML vocabulary into engine conditions and effects', () => {
    const scenario = parseScenario({ ...valid, events: [closes, reopens], decisions: [envoy] });
    expect(scenario.events[0]!.trigger).toEqual({
      type: 'all',
      of: [
        { type: 'chokepoint', id: 'strait', open: true },
        { type: 'stat', target: { kind: 'relation', id: 'a__b', stat: 'value' }, below: -40 },
        { type: 'chance', bp: 300 },
      ],
    });
    expect(scenario.events[0]!.effects[2]).toEqual({
      type: 'modify',
      target: { kind: 'resource', id: 'oil', stat: 'price' },
      op: 'pct',
      amount: 1000,
      days: 30,
    });
    expect(scenario.events[1]!.trigger).toBeNull();
    const decision = scenario.decisions[0]!;
    expect(decision.chanceBp).toBe(6000);
    expect(decision.effects[0]).toEqual({
      type: 'modify',
      target: { kind: 'relation', id: 'a__b', stat: 'value' },
      op: 'add',
      amount: 20,
      days: 120,
    });
  });

  it('treats a relation change without days as permanent', () => {
    const permanent = { ...envoy, effects: [{ relation: { between: ['a', 'b'], by: -30 } }] };
    const scenario = parseScenario({ ...valid, decisions: [permanent] });
    expect(scenario.decisions[0]!.effects[0]).toEqual({
      type: 'adjust',
      target: { kind: 'relation', id: 'a__b', stat: 'value' },
      by: -30,
    });
  });

  it('reports references to things that do not exist', () => {
    const broken = {
      ...closes,
      tag: 'nowhere',
      effects: [
        { schedule: { event: 'missing', inDays: 5 } },
        { adjust: { target: 'country.atlantis.treasury', by: 1 } },
      ],
    };
    expect(problemsOf({ ...valid, events: [broken] })).toEqual([
      'events[0].tag: Unknown country "nowhere"',
      'events[0].effects[0].schedule.event: Unknown event "missing"',
      'events[0].effects[1].adjust.target: Unknown country "atlantis"',
    ]);
  });

  it('ends the effects of decisions and events that exist', () => {
    const lift = {
      ...envoy,
      id: 'lift',
      effects: [{ endEffectsOf: { decision: 'envoy' } }, { endEffectsOf: { decision: 'nope' } }],
    };
    expect(problemsOf({ ...valid, decisions: [envoy, lift] })).toEqual([
      'decisions[1].effects[1].endEffectsOf.decision: Unknown decision "nope"',
    ]);
    const scenario = parseScenario({
      ...valid,
      decisions: [envoy, { ...lift, effects: [lift.effects[0]] }],
    });
    expect(scenario.decisions[1]!.effects[0]).toEqual({
      type: 'end_effects',
      source: { kind: 'decision', id: 'envoy' },
    });
  });

  it('needs exactly one of add or pct in a modify effect', () => {
    const broken = {
      ...reopens,
      effects: [{ modify: { target: 'country.a.stability', add: 1, pct: 100 } }],
    };
    expect(problemsOf({ ...valid, events: [broken] }).join('\n')).toMatch(
      /exactly one of add or pct/,
    );
  });

  it('rejects faction sensitivities that add up to more than 100%', () => {
    const faction = {
      id: 'workers',
      name: 'Workers',
      country: 'a',
      stats: { satisfaction: 50 },
      sensitivity: { oil: 8000, gas: 4000 },
    };
    const problems = problemsOf({ ...valid, factions: [faction] });
    expect(problems).toContain('factions[0].sensitivity.gas: Unknown resource "gas"');
    expect(problems).toContain(
      'factions[0].sensitivity: Sensitivities must add up to at most 10000',
    );
  });
});
