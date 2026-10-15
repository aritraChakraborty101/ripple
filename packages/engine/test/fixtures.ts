import type { ScenarioDef, StatRef } from '../src/index';

export const relationRef: StatRef = { kind: 'relation', id: 'exporter__importer', stat: 'value' };
export const treasuryRef: StatRef = { kind: 'country', id: 'importer', stat: 'treasury' };
export const stabilityRef: StatRef = { kind: 'country', id: 'importer', stat: 'stability' };

/**
 * A tiny world for engine tests: one importer, one exporter, one strait.
 * Oil supply equals demand (50 units), so the price starts in balance.
 *
 * The exporter closes the strait if relations fall below -40, and reopens it
 * 10 days later. The player can insult the exporter (relations -50) or send
 * an envoy (costs 20 treasury, 3 days, 50% chance of +30 relations).
 */
export const tinyScenario: ScenarioDef = {
  id: 'tiny',
  name: 'Tiny test world',
  rules: {
    playerCountry: 'importer',
    lengthYears: 5,
    ousting: { stat: 'stability', below: 20, forTicks: 30 },
  },
  countries: [
    {
      id: 'importer',
      name: 'Importer',
      archetype: 'industrial_importer',
      stats: { stability: 60, treasury: 400 },
      demand: { oil: 50 },
    },
    {
      id: 'exporter',
      name: 'Exporter',
      archetype: 'resource_exporter',
      stats: { stability: 60, treasury: 300 },
      demand: {},
    },
  ],
  factions: [
    {
      id: 'importer_workers',
      name: 'Workers',
      country: 'importer',
      stats: { satisfaction: 55, power: 10 },
      sensitivity: { oil: 10_000 },
    },
  ],
  resources: [{ id: 'oil', name: 'Crude oil', basePrice: 7_300 }],
  links: [
    {
      id: 'oil_by_sea',
      resource: 'oil',
      from: 'exporter',
      to: 'importer',
      capacity: 40,
      via: ['strait'],
    },
    { id: 'oil_by_pipe', resource: 'oil', from: 'exporter', to: 'importer', capacity: 10, via: [] },
  ],
  chokepoints: [{ id: 'strait', name: 'The Strait', controlledBy: 'exporter', open: true }],
  relations: [{ between: ['importer', 'exporter'], value: -10 }],
  events: [
    {
      id: 'strait_closes',
      tag: 'exporter',
      severity: 'critical',
      headline: 'Exporter closes the strait',
      trigger: {
        type: 'all',
        of: [
          { type: 'chokepoint', id: 'strait', open: true },
          { type: 'stat', target: relationRef, below: -40 },
        ],
      },
      once: false,
      cooldownDays: 0,
      effects: [
        { type: 'set_chokepoint', id: 'strait', open: false },
        { type: 'schedule', event: 'strait_reopens', inDays: 10 },
      ],
    },
    {
      id: 'strait_reopens',
      tag: 'exporter',
      severity: 'info',
      headline: 'Exporter reopens the strait',
      trigger: null,
      once: false,
      cooldownDays: 0,
      effects: [
        { type: 'set_chokepoint', id: 'strait', open: true },
        { type: 'adjust', target: relationRef, by: 60 },
      ],
    },
  ],
  decisions: [
    {
      id: 'insult',
      name: 'Insult the exporter',
      description: 'Feels good.',
      requires: null,
      costs: [],
      durationDays: 0,
      cooldownDays: 5,
      chanceBp: 10_000,
      effects: [{ type: 'adjust', target: relationRef, by: -50 }],
      failureEffects: [],
      successHeadline: 'Insult delivered',
    },
    {
      id: 'envoy',
      name: 'Send an envoy',
      description: 'Might help.',
      requires: { type: 'stat', target: treasuryRef, above: 19 },
      unavailableText: 'Needs 20 treasury.',
      costs: [{ type: 'adjust', target: treasuryRef, by: -20 }],
      durationDays: 3,
      cooldownDays: 0,
      chanceBp: 5_000,
      effects: [{ type: 'modify', target: relationRef, op: 'add', amount: 30, days: 20 }],
      failureEffects: [{ type: 'set_flag', flag: 'envoy_failed' }],
      successHeadline: 'Envoy succeeds',
      failureHeadline: 'Envoy fails',
    },
  ],
};
