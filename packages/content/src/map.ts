/**
 * The map: how a scenario's world is drawn. A scenario folder's map.yaml gives
 * every country a shape and every chokepoint a position on a fixed canvas.
 *
 * Like the guide, the map is presentation, not simulation: the engine never
 * sees it. It lives with the scenario so that adding a country or a strait is
 * a content change, not a code change.
 *
 *   # map.yaml
 *   width: 900
 *   height: 520
 *   countries:
 *     aldoria:
 *       outline: [[120, 150], [300, 118], [360, 192]]
 *       anchor: [230, 236]
 *       label: [222, 214]
 *       labelSize: 20
 *   chokepoints:
 *     south_strait: [520, 356]
 */

import type { ScenarioDef } from '@ripple/engine';
import { z } from 'zod';
import { parseYaml } from './assemble';
import { ContentError, formatPath } from './schema';

const coordinate = z.number().int().nonnegative();
const pointSchema = z.tuple([coordinate, coordinate]);

const countryShapeSchema = z.strictObject({
  outline: z.array(pointSchema).min(3),
  anchor: pointSchema,
  label: pointSchema,
  labelSize: z.number().int().min(8).max(48),
});

export const mapSchema = z.strictObject({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  countries: z.record(z.string(), countryShapeSchema),
  chokepoints: z.record(z.string(), pointSchema).default({}),
});

export interface MapPoint {
  readonly x: number;
  readonly y: number;
}

export interface CountryShape {
  readonly outline: readonly MapPoint[];
  /** Where trade routes start and end. */
  readonly anchor: MapPoint;
  readonly label: MapPoint;
  readonly labelSize: number;
}

export interface ScenarioMap {
  readonly width: number;
  readonly height: number;
  readonly countries: Readonly<Record<string, CountryShape>>;
  readonly chokepoints: Readonly<Record<string, MapPoint>>;
}

const toPoint = ([x, y]: readonly [number, number]): MapPoint => ({ x, y });

/** Validate a map against the scenario it belongs to. */
export function parseMap(raw: unknown, scenario: ScenarioDef, source = 'map'): ScenarioMap {
  const result = mapSchema.safeParse(raw);
  if (!result.success) {
    throw new ContentError(
      source,
      result.error.issues.map((i) => `map.${formatPath(i.path) || '(root)'}: ${i.message}`),
    );
  }
  const map = result.data;
  const problems: string[] = [];

  const inside = (at: string, [x, y]: readonly [number, number]) => {
    if (x > map.width || y > map.height) {
      problems.push(`${at}: [${x}, ${y}] is outside the ${map.width} x ${map.height} map`);
    }
  };
  const checkCoverage = (
    section: string,
    noun: string,
    drawn: Record<string, unknown>,
    ids: string[],
  ) => {
    const known = new Set(ids);
    for (const id of ids) {
      if (!(id in drawn))
        problems.push(`map.${section}: "${id}" is in the scenario but not on the map`);
    }
    for (const id of Object.keys(drawn)) {
      if (!known.has(id)) problems.push(`map.${section}.${id}: Unknown ${noun} "${id}"`);
    }
  };

  checkCoverage(
    'countries',
    'country',
    map.countries,
    scenario.countries.map((c) => c.id),
  );
  checkCoverage(
    'chokepoints',
    'chokepoint',
    map.chokepoints,
    scenario.chokepoints.map((c) => c.id),
  );

  for (const [id, shape] of Object.entries(map.countries)) {
    shape.outline.forEach((p, i) => inside(`map.countries.${id}.outline[${i}]`, p));
    inside(`map.countries.${id}.anchor`, shape.anchor);
    inside(`map.countries.${id}.label`, shape.label);
  }
  for (const [id, point] of Object.entries(map.chokepoints)) {
    inside(`map.chokepoints.${id}`, point);
  }

  if (problems.length > 0) throw new ContentError(source, problems);

  const countries: Record<string, CountryShape> = {};
  for (const [id, shape] of Object.entries(map.countries)) {
    countries[id] = {
      outline: shape.outline.map(toPoint),
      anchor: toPoint(shape.anchor),
      label: toPoint(shape.label),
      labelSize: shape.labelSize,
    };
  }
  const chokepoints: Record<string, MapPoint> = {};
  for (const [id, point] of Object.entries(map.chokepoints)) chokepoints[id] = toPoint(point);

  return { width: map.width, height: map.height, countries, chokepoints };
}

/** Read and validate a scenario folder's map.yaml. Every scenario needs one. */
export function mapFromYaml(
  files: Readonly<Record<string, string>>,
  scenario: ScenarioDef,
  source = 'map',
): ScenarioMap {
  const text = files['map.yaml'];
  if (text === undefined) throw new ContentError(source, ['Missing map.yaml']);
  return parseMap(parseYaml(text, `${source}/map.yaml`), scenario, source);
}
