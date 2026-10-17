/**
 * Schemas for scenario content. Content files are validated here before the
 * engine ever sees them, so a typo fails loudly with a readable path instead
 * of causing strange behavior mid-game.
 *
 * Validation runs in two passes: the shape of each file (Zod), then every
 * reference between files (does that country, route or event exist?).
 *
 * This module has no Node dependencies, so the browser can use it too.
 */

import type { ScenarioDef } from '@ripple/engine';
import { z } from 'zod';
import { toScenarioDef } from './convert';
import {
  conditionSchema,
  decisionSchema,
  eventSchema,
  id,
  relationSchema,
  type RawCondition,
  type RawEffect,
} from './rules-schema';

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
  sensitivity: z.record(id, z.int().min(0).max(10_000)).default({}),
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

/** Tags for news that is not about one country. */
export const GENERAL_TAGS = ['home', 'markets', 'world'] as const;

type Path = (string | number)[];

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
    relations: z.array(relationSchema).default([]),
    events: z.array(eventSchema).default([]),
    decisions: z.array(decisionSchema).default([]),
  })
  .superRefine((s, ctx) => {
    const issue = (path: Path, message: string) => ctx.addIssue({ code: 'custom', path, message });

    const idsOf = (section: string, items: readonly { id: string }[]) => {
      const seen = new Set<string>();
      items.forEach((item, i) => {
        if (seen.has(item.id)) issue([section, i, 'id'], `Duplicate id "${item.id}"`);
        seen.add(item.id);
      });
      return seen;
    };

    const known = {
      country: idsOf('countries', s.countries),
      faction: idsOf('factions', s.factions),
      resource: idsOf('resources', s.resources),
      link: idsOf('links', s.links),
      chokepoint: idsOf('chokepoints', s.chokepoints),
      event: idsOf('events', s.events),
      decision: idsOf('decisions', s.decisions),
    };

    const need = (kind: keyof typeof known, path: Path, value: string) => {
      if (!known[kind].has(value)) issue(path, `Unknown ${kind} "${value}"`);
    };
    const needPair = (path: Path, [a, b]: readonly [string, string]) => {
      need('country', [...path, 0], a);
      need('country', [...path, 1], b);
      if (a === b) issue(path, 'A relation needs two different countries');
    };
    const needStat = (path: Path, target: string) => {
      const [kind, entity] = target.split('.') as [keyof typeof known, string];
      need(kind, path, entity);
    };

    const checkCondition = (path: Path, c: RawCondition): void => {
      if ('all' in c) c.all.forEach((x, i) => checkCondition([...path, 'all', i], x));
      else if ('any' in c) c.any.forEach((x, i) => checkCondition([...path, 'any', i], x));
      else if ('not' in c) checkCondition([...path, 'not'], c.not);
      else if ('stat' in c) needStat([...path, 'stat', 'target'], c.stat.target);
      else if ('relation' in c) needPair([...path, 'relation', 'between'], c.relation.between);
      else if ('chokepointOpen' in c)
        need('chokepoint', [...path, 'chokepointOpen'], c.chokepointOpen);
      else if ('chokepointClosed' in c) {
        need('chokepoint', [...path, 'chokepointClosed'], c.chokepointClosed);
      }
    };
    const checkEffect = (path: Path, e: RawEffect): void => {
      if ('modify' in e) needStat([...path, 'modify', 'target'], e.modify.target);
      else if ('adjust' in e) needStat([...path, 'adjust', 'target'], e.adjust.target);
      else if ('relation' in e) needPair([...path, 'relation', 'between'], e.relation.between);
      else if ('setChokepoint' in e)
        need('chokepoint', [...path, 'setChokepoint', 'id'], e.setChokepoint.id);
      else if ('schedule' in e) need('event', [...path, 'schedule', 'event'], e.schedule.event);
      else if ('endEffectsOf' in e) {
        const ref = e.endEffectsOf;
        if ('decision' in ref)
          need('decision', [...path, 'endEffectsOf', 'decision'], ref.decision);
        else need('event', [...path, 'endEffectsOf', 'event'], ref.event);
      }
    };

    need('country', ['rules', 'playerCountry'], s.rules.playerCountry);

    s.countries.forEach((c, i) => {
      for (const resource of Object.keys(c.demand)) {
        need('resource', ['countries', i, 'demand', resource], resource);
      }
    });

    s.factions.forEach((f, i) => {
      need('country', ['factions', i, 'country'], f.country);
      let total = 0;
      for (const [resource, weight] of Object.entries(f.sensitivity)) {
        need('resource', ['factions', i, 'sensitivity', resource], resource);
        total += weight;
      }
      if (total > 10_000) {
        issue(['factions', i, 'sensitivity'], 'Sensitivities must add up to at most 10000');
      }
    });

    s.links.forEach((l, i) => {
      need('resource', ['links', i, 'resource'], l.resource);
      need('country', ['links', i, 'from'], l.from);
      need('country', ['links', i, 'to'], l.to);
      if (l.from === l.to) issue(['links', i, 'to'], 'A link must connect two different countries');
      l.via.forEach((v, j) => need('chokepoint', ['links', i, 'via', j], v));
    });

    s.chokepoints.forEach((c, i) =>
      need('country', ['chokepoints', i, 'controlledBy'], c.controlledBy),
    );

    s.relations.forEach((r, i) => needPair(['relations', i, 'between'], r.between));

    s.events.forEach((e, i) => {
      if (!(GENERAL_TAGS as readonly string[]).includes(e.tag)) {
        need('country', ['events', i, 'tag'], e.tag);
      }
      if (e.trigger) checkCondition(['events', i, 'trigger'], e.trigger);
      e.effects.forEach((x, j) => checkEffect(['events', i, 'effects', j], x));
    });

    s.decisions.forEach((d, i) => {
      if (d.requires) checkCondition(['decisions', i, 'requires'], d.requires);
      d.costs.forEach((x, j) => checkEffect(['decisions', i, 'costs', j], x));
      d.effects.forEach((x, j) => checkEffect(['decisions', i, 'effects', j], x));
      d.failureEffects.forEach((x, j) => checkEffect(['decisions', i, 'failureEffects', j], x));
    });
  });

export type RawScenario = z.infer<typeof scenarioSchema>;

export { conditionSchema, decisionSchema, eventSchema, relationSchema };

export class ContentError extends Error {
  constructor(
    readonly source: string,
    readonly problems: readonly string[],
  ) {
    super(`Invalid content in ${source}:\n${problems.map((p) => `  - ${p}`).join('\n')}`);
    this.name = 'ContentError';
  }
}

export function formatPath(path: readonly PropertyKey[]): string {
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
  return toScenarioDef(result.data);
}
