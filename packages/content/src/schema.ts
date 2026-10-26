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

import { GOAL_ARGUMENT, PLACEHOLDERS, parseGoalId, type ScenarioDef } from '@ripple/engine';
import { z } from 'zod';
import { aiFileSchema, tuningFileSchema } from './ai-schema';
import { toScenarioDef } from './convert';
import {
  conditionSchema,
  type RawConsideration,
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
    /** From ai.yaml: computer countries' personalities. */
    ai: aiFileSchema.optional(),
    /** From ai-tuning.yaml: named tuning profiles. */
    aiTuning: tuningFileSchema.optional(),
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

    // While checking a computer order, `self` (and `target`, for templates) stand for countries.
    let placeholders: ReadonlySet<string> = new Set();
    const need = (kind: keyof typeof known, path: Path, value: string) => {
      if (kind === 'country' && placeholders.has(value)) return;
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
      if (PLACEHOLDERS.includes(c.id)) {
        issue(['countries', i, 'id'], `"${c.id}" is reserved for computer orders`);
      }
    });

    /** A goal ID whose argument names a real country or resource (or an allowed placeholder). */
    const checkGoal = (path: Path, goal: string) => {
      const parsed = parseGoalId(goal);
      if (!parsed) {
        issue(path, `Unknown goal "${goal}"`);
        return;
      }
      const argKind = GOAL_ARGUMENT[parsed.kind];
      if (argKind && parsed.arg !== undefined) need(argKind, path, parsed.arg);
    };
    const checkConsideration = (path: Path, c: RawConsideration) => {
      if (c.stat !== undefined) needStat([...path, 'stat'], c.stat);
      if (c.relation !== undefined) needPair([...path, 'relation'], c.relation);
      if (c.price !== undefined) need('resource', [...path, 'price'], c.price);
    };
    const player = s.rules.playerCountry;
    const computer = new Set(Object.keys(s.ai?.personalities ?? {}));

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
      if (e.requires) checkCondition(['events', i, 'requires'], e.requires);
      e.effects.forEach((x, j) => checkEffect(['events', i, 'effects', j], x));
    });

    s.decisions.forEach((d, i) => {
      const at: Path = ['decisions', i];
      if (d.for === undefined) {
        for (const key of ['targets', 'drives', 'consider', 'severity', 'detail'] as const) {
          if (d[key] !== undefined)
            issue([...at, key], `Only computer orders (with "for") have ${key}`);
        }
      } else {
        if (d.drives === undefined) issue([...at, 'drives'], 'A computer order needs drives');
        if (d.for !== 'any') {
          d.for.forEach((c, j) => {
            need('country', [...at, 'for', j], c);
            if (c === player) issue([...at, 'for', j], 'The player signs orders without "for"');
            else if (known.country.has(c) && !computer.has(c)) {
              issue([...at, 'for', j], `"${c}" has no personality in ai.yaml`);
            }
          });
        }
        if (Array.isArray(d.targets))
          d.targets.forEach((c, j) => need('country', [...at, 'targets', j], c));
        placeholders = new Set(d.targets === undefined ? ['self'] : ['self', 'target']);
        for (const goal of Object.keys(d.drives ?? {})) checkGoal([...at, 'drives', goal], goal);
        d.consider?.forEach((c, j) => checkConsideration([...at, 'consider', j], c));
      }
      if (d.requires) checkCondition([...at, 'requires'], d.requires);
      d.costs.forEach((x, j) => checkEffect([...at, 'costs', j], x));
      d.effects.forEach((x, j) => checkEffect([...at, 'effects', j], x));
      d.failureEffects.forEach((x, j) => checkEffect([...at, 'failureEffects', j], x));
      placeholders = new Set();
    });

    for (const [country, personality] of Object.entries(s.ai?.personalities ?? {})) {
      const at: Path = ['ai', 'personalities', country];
      need('country', at, country);
      if (country === player)
        issue(at, 'The player has no personality; they decide for themselves');
      let total = 0;
      for (const [goal, def] of Object.entries(personality.goals)) {
        checkGoal([...at, 'goals', goal], goal);
        total += def.weight;
        const kind = parseGoalId(goal)?.kind;
        const needsAspire = kind !== undefined && kind !== 'grievance' && kind !== 'security';
        if (needsAspire && def.aspire === undefined) {
          issue([...at, 'goals', goal, 'aspire'], `A ${kind} goal needs an aspire value`);
        }
      }
      if (total !== 100) issue([...at, 'goals'], `Goal weights must add up to 100, not ${total}`);
      const seen = new Set<string>();
      personality.ambitions.forEach((a, j) => {
        if (seen.has(a.id)) issue([...at, 'ambitions', j, 'id'], `Duplicate id "${a.id}"`);
        seen.add(a.id);
        if (!(a.goal in personality.goals)) {
          issue([...at, 'ambitions', j, 'goal'], `"${a.goal}" is not one of ${country}'s goals`);
        }
      });
    }

    if (s.aiTuning) {
      if (!s.ai) issue(['aiTuning'], 'ai-tuning.yaml needs an ai.yaml beside it');
      if (!(s.aiTuning.default in s.aiTuning.profiles)) {
        issue(['aiTuning', 'default'], `Unknown profile "${s.aiTuning.default}"`);
      }
      for (const [name, profile] of Object.entries(s.aiTuning.profiles)) {
        const at: Path = ['aiTuning', 'profiles', name];
        for (const country of Object.keys(profile.countries ?? {})) {
          if (!computer.has(country))
            issue([...at, 'countries', country], `"${country}" has no personality`);
        }
        for (const action of Object.keys(profile.actions ?? {})) {
          need('decision', [...at, 'actions', action], action);
        }
      }
    }
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
