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
