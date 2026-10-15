import type { ScenarioDef } from '../src/index';

/**
 * A tiny world for engine tests: one importer, one exporter, one strait.
 * Oil supply equals demand (50 units), so the price starts in balance.
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
    { id: 'importer_workers', name: 'Workers', country: 'importer', stats: { satisfaction: 55 } },
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
};
