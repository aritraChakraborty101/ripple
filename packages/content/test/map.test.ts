import { describe, expect, it } from 'vitest';
import { ContentError, parseMap } from '../src/index';
import { loadBuiltInMap, loadBuiltInScenario } from '../src/load';

const scenario = loadBuiltInScenario('first-crisis');

const shape = {
  outline: [
    [0, 0],
    [10, 0],
    [10, 10],
  ],
  anchor: [5, 5],
  label: [5, 4],
  labelSize: 14,
};

/** A valid map for the first scenario: every country and chokepoint drawn. */
function fullMap(): Record<string, unknown> {
  const countries: Record<string, unknown> = {};
  for (const c of scenario.countries) countries[c.id] = shape;
  const chokepoints: Record<string, unknown> = {};
  for (const c of scenario.chokepoints) chokepoints[c.id] = [50, 50];
  return { width: 100, height: 100, countries, chokepoints };
}

function problemsOf(raw: unknown): string[] {
  try {
    parseMap(raw, scenario, 'test');
  } catch (error) {
    if (error instanceof ContentError) return [...error.problems];
    throw error;
  }
  return [];
}

describe('first-crisis map', () => {
  const map = loadBuiltInMap('first-crisis', scenario);

  it('draws every country and chokepoint in the scenario', () => {
    expect(Object.keys(map.countries).sort()).toEqual(scenario.countries.map((c) => c.id).sort());
    expect(Object.keys(map.chokepoints).sort()).toEqual(['narrows', 'south_strait']);
  });

  it('converts coordinates to points', () => {
    expect(map.width).toBe(1120);
    expect(map.chokepoints.south_strait).toEqual({ x: 520, y: 426 });
    expect(map.countries.aldoria!.anchor).toEqual({ x: 230, y: 306 });
    expect(map.countries.aldoria!.outline.length).toBe(6);
  });
});

describe('map validation', () => {
  it('accepts a map that draws everything', () => {
    expect(problemsOf(fullMap())).toEqual([]);
  });

  it('reports a country that is not drawn', () => {
    const raw = fullMap();
    delete (raw.countries as Record<string, unknown>).corvan;
    expect(problemsOf(raw)).toEqual([
      'map.countries: "corvan" is in the scenario but not on the map',
    ]);
  });

  it('reports a shape for a country that does not exist', () => {
    const raw = fullMap();
    (raw.countries as Record<string, unknown>).atlantis = shape;
    expect(problemsOf(raw)).toEqual(['map.countries.atlantis: Unknown country "atlantis"']);
  });

  it('reports a chokepoint that is not drawn', () => {
    const raw = { ...fullMap(), chokepoints: {} };
    expect(problemsOf(raw)).toEqual([
      'map.chokepoints: "south_strait" is in the scenario but not on the map',
      'map.chokepoints: "narrows" is in the scenario but not on the map',
    ]);
  });

  it('reports coordinates outside the canvas', () => {
    const raw = fullMap();
    (raw.chokepoints as Record<string, unknown>).south_strait = [150, 20];
    expect(problemsOf(raw)).toEqual([
      'map.chokepoints.south_strait: [150, 20] is outside the 100 x 100 map',
    ]);
  });

  it('rejects an outline with fewer than three corners', () => {
    const raw = fullMap();
    (raw.countries as Record<string, unknown>).aldoria = {
      ...shape,
      outline: [
        [0, 0],
        [1, 1],
      ],
    };
    expect(problemsOf(raw)[0]).toMatch(/^map\.countries\.aldoria\.outline/);
  });
});
