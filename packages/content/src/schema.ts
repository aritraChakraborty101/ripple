/**
 * Schemas for scenario content. Content files are validated here before the
 * engine ever sees them, so a typo fails loudly with a readable path instead
 * of causing strange behavior mid-game.
 *
 * This module has no Node dependencies, so the browser can use it too.
 */

import type { ScenarioDef } from '@ripple/engine';
import { z } from 'zod';

/** Stable IDs: lower case letters, digits and underscores, starting with a letter. */
const id = z.string().regex(/^[a-z][a-z0-9_]*$/, 'IDs use lower_snake_case');
const int = z.int();
const nonNegativeInt = z.int().nonnegative();
const stats = z.record(id, int);

const archetype = z.enum([
  'industrial_importer',
  'resource_exporter',
  'transit_state',
  'rising_power',
]);

export const countrySchema = z.strictObject({
  id,
  name: z.string().min(1),
  archetype,
  stats,
  demand: z.record(id, nonNegativeInt).default({}),
});

export const factionSchema = z.strictObject({
  id,
  name: z.string().min(1),
  country: id,
  stats,
});

export const resourceSchema = z.strictObject({
  id,
  name: z.string().min(1),
  basePrice: z.int().positive(),
});

export const linkSchema = z.strictObject({
  id,
  resource: id,
  from: id,
  to: id,
  capacity: nonNegativeInt,
  via: z.array(id).default([]),
});

export const chokepointSchema = z.strictObject({
  id,
  name: z.string().min(1),
  controlledBy: id,
  open: z.boolean().default(true),
});

export const rulesSchema = z.strictObject({
  playerCountry: id,
  lengthYears: z.int().positive(),
  ousting: z.strictObject({
    stat: id,
    below: int,
    forTicks: z.int().positive(),
  }),
});

export const scenarioSchema = z
  .strictObject({
    id,
    name: z.string().min(1),
    rules: rulesSchema,
    countries: z.array(countrySchema).min(1),
    factions: z.array(factionSchema).default([]),
    resources: z.array(resourceSchema).default([]),
    links: z.array(linkSchema).default([]),
    chokepoints: z.array(chokepointSchema).default([]),
  })
  .superRefine((s, ctx) => {
    const issue = (path: (string | number)[], message: string) =>
      ctx.addIssue({ code: 'custom', path, message });

    const idsOf = (
      section: 'countries' | 'factions' | 'resources' | 'links' | 'chokepoints',
      items: readonly { id: string }[],
    ) => {
      const seen = new Set<string>();
      items.forEach((item, i) => {
        if (seen.has(item.id)) issue([section, i, 'id'], `Duplicate id "${item.id}"`);
        seen.add(item.id);
      });
      return seen;
    };

    const countries = idsOf('countries', s.countries);
    idsOf('factions', s.factions);
    const resources = idsOf('resources', s.resources);
    idsOf('links', s.links);
    const chokepoints = idsOf('chokepoints', s.chokepoints);

    const needCountry = (path: (string | number)[], value: string) => {
      if (!countries.has(value)) issue(path, `Unknown country "${value}"`);
    };

    needCountry(['rules', 'playerCountry'], s.rules.playerCountry);

    s.countries.forEach((c, i) => {
      for (const resource of Object.keys(c.demand)) {
        if (!resources.has(resource)) {
          issue(['countries', i, 'demand', resource], `Unknown resource "${resource}"`);
        }
      }
    });

    s.factions.forEach((f, i) => needCountry(['factions', i, 'country'], f.country));

    s.links.forEach((l, i) => {
      if (!resources.has(l.resource)) {
        issue(['links', i, 'resource'], `Unknown resource "${l.resource}"`);
      }
      needCountry(['links', i, 'from'], l.from);
      needCountry(['links', i, 'to'], l.to);
      if (l.from === l.to) issue(['links', i, 'to'], 'A link must connect two different countries');
      l.via.forEach((v, j) => {
        if (!chokepoints.has(v)) issue(['links', i, 'via', j], `Unknown chokepoint "${v}"`);
      });
    });

    s.chokepoints.forEach((c, i) =>
      needCountry(['chokepoints', i, 'controlledBy'], c.controlledBy),
    );
  });

export class ContentError extends Error {
  constructor(
    readonly source: string,
    readonly problems: readonly string[],
  ) {
    super(`Invalid content in ${source}:\n${problems.map((p) => `  - ${p}`).join('\n')}`);
    this.name = 'ContentError';
  }
}

function formatPath(path: readonly PropertyKey[]): string {
  return path
    .map((part, i) =>
      typeof part === 'number' ? `[${part}]` : `${i === 0 ? '' : '.'}${String(part)}`,
    )
    .join('');
}

/** Validate raw data (from YAML, JSON or code) into a scenario the engine accepts. */
export function parseScenario(raw: unknown, source = 'scenario'): ScenarioDef {
  const result = scenarioSchema.safeParse(raw);
  if (!result.success) {
    throw new ContentError(
      source,
      result.error.issues.map((i) => `${formatPath(i.path) || '(root)'}: ${i.message}`),
    );
  }
  // Assigning to ScenarioDef checks at compile time that the schema matches the engine's types.
  const scenario: ScenarioDef = result.data;
  return scenario;
}
