import { createGame, rank, urgency } from '@ripple/engine';
import { describe, expect, it } from 'vitest';
import { ContentError, parseScenario } from '../src/index';
import { loadBuiltInScenario } from '../src/load';

/** A small valid scenario with one computer country and one computer order. */
function raw(): Record<string, unknown> {
  return {
    id: 'mini',
    name: 'Mini',
    rules: {
      playerCountry: 'home',
      lengthYears: 1,
      ousting: { stat: 'stability', below: 20, forTicks: 30 },
    },
    countries: [
      {
        id: 'home',
        name: 'Home',
        archetype: 'industrial_importer',
        stats: { stability: 60, treasury: 100, influence: 30 },
      },
      {
        id: 'away',
        name: 'Away',
        archetype: 'transit_state',
        stats: { stability: 60, treasury: 50, influence: 10 },
      },
    ],
    resources: [{ id: 'oil', name: 'Oil', basePrice: 7_300 }],
    decisions: [
      {
        id: 'court',
        name: '{self} courts {target}',
        description: 'Friendly overtures.',
        successHeadline: 'Courted',
        for: 'any',
        targets: 'others',
        drives: { 'ties(target)': 2, standing: 1 },
        consider: [{ relation: ['self', 'target'], falls: [40, 90] }],
        costs: [{ adjust: { target: 'country.self.influence', by: -5 } }],
        effects: [{ relation: { between: ['self', 'target'], by: 10, days: 90 } }],
      },
    ],
    ai: {
      personalities: {
        away: {
          goals: {
            wealth: { weight: 50, aspire: 200 },
            'ties(home)': { weight: 30, aspire: 60 },
            standing: { weight: 20, aspire: 40 },
          },
          ambitions: [{ id: 'rich', name: 'Get rich', goal: 'wealth', target: 200 }],
        },
      },
    },
    aiTuning: {
      default: 'standard',
      profiles: {
        standard: {},
        edgy: { inertia: 15, hostility: 1.5, actions: { court: { scoreMultiplier: 0.5 } } },
      },
    },
  };
}

function problemsOf(data: Record<string, unknown>): string[] {
  try {
    parseScenario(data, 'test');
  } catch (error) {
    if (error instanceof ContentError) return [...error.problems];
    throw error;
  }
  return [];
}

/**
 * Change one part of the valid scenario. Tests reach deep into the raw data to
 * break it on purpose, so the data is loosely typed here.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = Record<string, any>;
function withChange(change: (r: Loose) => void): string[] {
  const r = raw();
  change(r as Loose);
  return problemsOf(r);
}

describe('first-crisis personalities', () => {
  const scenario = loadBuiltInScenario('first-crisis');

  it('loads four computer countries and three tuning profiles', () => {
    expect(Object.keys(scenario.ai!.personalities).sort()).toEqual([
      'corvan',
      'orrin',
      'thessa',
      'veskar',
    ]);
    expect(Object.keys(scenario.ai!.profiles).sort()).toEqual([
      'aggressive',
      'passive',
      'standard',
    ]);
    expect(scenario.ai!.defaultProfile).toBe('standard');
  });

  it('converts friendly tuning units to the engine integers', () => {
    expect(scenario.ai!.profiles.aggressive).toEqual({
      inertia: 1_500,
      hostility: 15_000,
      temperature: 5_000,
    });
    expect(createGame(scenario, 1, { aiProfile: 'passive' }).defs.ai!.tuning.inertia).toBe(4_000);
  });

  it('has no computer orders yet, so every country prefers doing nothing', () => {
    const state = createGame(scenario, 1);
    for (const country of ['corvan', 'thessa', 'veskar', 'orrin']) {
      expect(rank(state, country).map((r) => r.decision)).toEqual(['nothing']);
      expect(urgency(state, country)).toBe(0);
    }
  });
});

describe('computer orders in YAML', () => {
  it('accepts a template and converts every field', () => {
    expect(problemsOf(raw())).toEqual([]);
    const scenario = parseScenario(raw(), 'test');
    const court = scenario.decisions[0]!;
    expect(court.for).toBe('any');
    expect(court.targets).toBe('others');
    expect(court.drives).toEqual({ 'ties(target)': 2, standing: 1 });
    expect(court.consider).toEqual([
      {
        measure: { kind: 'relation', between: ['self', 'target'] },
        curve: { type: 'falls', from: 40, to: 90 },
      },
    ]);
    expect(scenario.ai!.profiles.edgy).toEqual({
      inertia: 1_500,
      hostility: 15_000,
      actions: { court: { scoreMultiplier: 5_000 } },
    });
  });

  it('scores the template with the clearing house', () => {
    const state = createGame(parseScenario(raw(), 'test'), 1);
    const options = rank(state, 'away');
    expect(options.map((r) => `${r.decision}${r.target ? `:${r.target}` : ''}`)).toEqual([
      'court:home',
      'nothing',
    ]);
  });

  it('needs drives, and keeps AI fields off player orders', () => {
    expect(withChange((r) => delete r.decisions[0].drives)).toEqual([
      'decisions[0].drives: A computer order needs drives',
    ]);
    expect(
      withChange((r) => {
        delete r.decisions[0].for;
        delete r.decisions[0].targets;
        delete r.decisions[0].consider;
        r.decisions[0].costs = [];
        r.decisions[0].effects = [];
      }),
    ).toEqual(['decisions[0].drives: Only computer orders (with "for") have drives']);
  });

  it('checks who an order is for', () => {
    expect(withChange((r) => (r.decisions[0].for = ['home']))).toContain(
      'decisions[0].for[0]: The player signs orders without "for"',
    );
    expect(withChange((r) => (r.decisions[0].for = ['nowhere']))).toContain(
      'decisions[0].for[0]: Unknown country "nowhere"',
    );
  });

  it('allows target only in templates', () => {
    expect(withChange((r) => delete r.decisions[0].targets)).toEqual([
      'decisions[0].drives.ties(target): Unknown country "target"',
      'decisions[0].consider[0].relation[1]: Unknown country "target"',
      'decisions[0].effects[0].relation.between[1]: Unknown country "target"',
    ]);
  });

  it('rejects malformed goals and considerations', () => {
    expect(withChange((r) => (r.decisions[0].drives = { glory: 2 }))).toEqual([
      'decisions[0].drives.glory: Unknown goal "glory"',
    ]);
    expect(
      withChange((r) => (r.decisions[0].consider = [{ price: 'oil', flag: 'x', step: 1 }]))[0],
    ).toMatch(/exactly one of stat, relation, price or flag/);
  });

  it('reserves self and target as country IDs', () => {
    expect(
      withChange((r) =>
        r.countries.push({ id: 'self', name: 'Self', archetype: 'transit_state', stats: {} }),
      ),
    ).toContain('countries[2].id: "self" is reserved for computer orders');
  });
});

describe('personalities in YAML', () => {
  it('needs weights that add up to 100', () => {
    expect(withChange((r) => (r.ai.personalities.away.goals.wealth.weight = 40))).toEqual([
      'ai.personalities.away.goals: Goal weights must add up to 100, not 90',
    ]);
  });

  it('needs an aspiration for goals that have one', () => {
    expect(withChange((r) => delete r.ai.personalities.away.goals.wealth.aspire)).toEqual([
      'ai.personalities.away.goals.wealth.aspire: A wealth goal needs an aspire value',
    ]);
  });

  it('ties ambitions to the country own goals', () => {
    expect(withChange((r) => (r.ai.personalities.away.ambitions[0].goal = 'security'))).toEqual([
      'ai.personalities.away.ambitions[0].goal: "security" is not one of away\'s goals',
    ]);
  });

  it('gives the player no personality and checks goal arguments', () => {
    expect(
      withChange((r) => {
        r.ai.personalities.home = { goals: { 'ties(atlantis)': { weight: 100, aspire: 10 } } };
      }),
    ).toEqual([
      'ai.personalities.home: The player has no personality; they decide for themselves',
      'ai.personalities.home.goals.ties(atlantis): Unknown country "atlantis"',
    ]);
  });
});

describe('tuning profiles in YAML', () => {
  it('needs the default profile to exist and actions to be real', () => {
    expect(withChange((r) => (r.aiTuning.default = 'calm'))).toEqual([
      'aiTuning.default: Unknown profile "calm"',
    ]);
    expect(
      withChange((r) => (r.aiTuning.profiles.edgy.actions = { fly: { enabled: false } })),
    ).toEqual(['aiTuning.profiles.edgy.actions.fly: Unknown decision "fly"']);
  });

  it('rejects knobs that do not exist yet', () => {
    expect(withChange((r) => (r.aiTuning.profiles.edgy.attention = 0.4))[0]).toMatch(
      /^aiTuning\.profiles\.edgy/,
    );
  });
});
