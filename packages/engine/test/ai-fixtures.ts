import type { DecisionDef, ScenarioDef, StatRef } from '../src/index';

/**
 * A small world for AI tests, built to match the worked examples in the
 * computer-countries design note:
 *
 *   home    the player (an importer)
 *   strait  a poor transit state that controls the strait (Corvan's role)
 *   patron  a rising power the transit state wants as a friend (Thessa's role)
 */

export const homeStraitRef: StatRef = { kind: 'relation', id: 'home__strait', stat: 'value' };
export const straitTreasuryRef: StatRef = { kind: 'country', id: 'strait', stat: 'treasury' };

const order = (d: Partial<DecisionDef> & Pick<DecisionDef, 'id'>): DecisionDef => ({
  name: d.id,
  description: '',
  requires: null,
  costs: [],
  durationDays: 0,
  cooldownDays: 30,
  chanceBp: 10_000,
  effects: [],
  failureEffects: [],
  successHeadline: d.id,
  ...d,
});

export const aiScenario: ScenarioDef = {
  id: 'ai-test',
  name: 'AI test world',
  rules: {
    playerCountry: 'home',
    lengthYears: 5,
    ousting: { stat: 'stability', below: 20, forTicks: 30 },
  },
  countries: [
    {
      id: 'home',
      name: 'Home',
      archetype: 'industrial_importer',
      stats: { stability: 60, treasury: 400, influence: 40, military: 40 },
      demand: {},
    },
    {
      id: 'strait',
      name: 'Strait',
      archetype: 'transit_state',
      stats: { stability: 55, treasury: 90, influence: 20, military: 25 },
      demand: {},
    },
    {
      id: 'patron',
      name: 'Patron',
      archetype: 'rising_power',
      stats: { stability: 64, treasury: 610, influence: 45, military: 70 },
      demand: {},
    },
  ],
  factions: [],
  resources: [{ id: 'oil', name: 'Crude oil', basePrice: 7_300 }],
  links: [],
  chokepoints: [{ id: 'the_strait', name: 'The Strait', controlledBy: 'strait', open: true }],
  relations: [
    { between: ['home', 'strait'], value: -10 },
    { between: ['patron', 'strait'], value: 25 },
  ],
  events: [],
  decisions: [
    order({ id: 'player_only' }),
    order({ id: 'raise_fees', for: ['strait'], drives: { wealth: 3 } }),
    order({
      id: 'court',
      for: 'any',
      targets: 'others',
      drives: { 'ties(target)': 2, standing: 1 },
      consider: [
        {
          measure: { kind: 'relation', between: ['self', 'target'] },
          curve: { type: 'falls', from: 40, to: 90 },
        },
      ],
      costs: [
        { type: 'adjust', target: { kind: 'country', id: 'self', stat: 'influence' }, by: -5 },
      ],
    }),
    order({ id: 'detain', for: ['strait'], drives: { 'grievance(home)': 1, standing: 1 } }),
    order({
      id: 'close',
      for: ['strait'],
      requires: { type: 'chokepoint', id: 'the_strait', open: true },
      drives: { 'grievance(home)': 4, standing: 1, wealth: -2 },
    }),
  ],
  ai: {
    personalities: {
      strait: {
        goals: [
          { id: 'wealth', weight: 35, aspire: 250 },
          { id: 'grievance(home)', weight: 30 },
          { id: 'ties(patron)', weight: 20, aspire: 60 },
          { id: 'standing', weight: 15, aspire: 50 },
        ],
        ambitions: [
          { id: 'strait_pays', name: 'Make the strait pay', goal: 'wealth', target: 250 },
        ],
      },
      patron: {
        goals: [
          { id: 'standing', weight: 60, aspire: 80 },
          { id: 'ties(strait)', weight: 40, aspire: 70 },
        ],
        ambitions: [],
      },
    },
    profiles: {
      standard: {},
      aggressive: { inertia: 1_500, hostility: 15_000 },
    },
    defaultProfile: 'standard',
  },
};

/**
 * The crisis from the design note: relations with home at -45, the transit
 * state's treasury filled to 190 by fees, ties with its patron at 40, and
 * the fees just raised, so on cooldown.
 */
export const crisisScenario: ScenarioDef = {
  ...aiScenario,
  countries: aiScenario.countries.map((c) =>
    c.id === 'strait' ? { ...c, stats: { ...c.stats, treasury: 190 } } : c,
  ),
  relations: [
    { between: ['home', 'strait'], value: -45 },
    { between: ['patron', 'strait'], value: 40 },
  ],
};
