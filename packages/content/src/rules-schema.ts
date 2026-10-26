/**
 * The YAML vocabulary for conditions and effects. Each condition or effect is
 * a mapping with exactly one key that names it:
 *
 *   trigger:
 *     all:
 *       - chokepointOpen: south_strait
 *       - relation: { between: [aldoria, corvan], below: -35 }
 *       - chance: 300            # basis points: 300 = 3% per day
 *
 *   effects:
 *     - setChokepoint: { id: south_strait, open: false }
 *     - modify: { target: resource.oil.price, pct: 1000, days: 30 }
 *     - adjust: { target: country.aldoria.treasury, by: -40 }
 *     - relation: { between: [aldoria, corvan], by: 20, days: 180 }
 *     - schedule: { event: corvan_reopens_strait, inDays: 60 }
 *     - setFlag: reserves_used
 *
 * Stat targets are written as "kind.id.stat", for example country.aldoria.stability.
 */

import { z } from 'zod';

export const id = z.string().regex(/^[a-z][a-z0-9_]*$/, 'IDs use lower_snake_case');
const int = z.int();
const basisPoints = z.int().min(0).max(10_000);

export const statPath = z
  .string()
  .regex(
    /^(country|faction|resource|link)\.[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$/,
    'Stat targets look like country.aldoria.stability',
  );

const pair = z.tuple([id, id]);

export type RawCondition =
  | { all: RawCondition[] }
  | { any: RawCondition[] }
  | { not: RawCondition }
  | { stat: { target: string; above?: number | undefined; below?: number | undefined } }
  | {
      relation: {
        between: [string, string];
        above?: number | undefined;
        below?: number | undefined;
      };
    }
  | { chokepointOpen: string }
  | { chokepointClosed: string }
  | { flag: string }
  | { noFlag: string }
  | { afterDay: number }
  | { chance: number };

const bounds = { above: int.optional(), below: int.optional() };

export const conditionSchema: z.ZodType<RawCondition> = z.lazy(() =>
  z.union([
    z.strictObject({ all: z.array(conditionSchema).min(1) }),
    z.strictObject({ any: z.array(conditionSchema).min(1) }),
    z.strictObject({ not: conditionSchema }),
    z.strictObject({ stat: z.strictObject({ target: statPath, ...bounds }) }),
    z.strictObject({ relation: z.strictObject({ between: pair, ...bounds }) }),
    z.strictObject({ chokepointOpen: id }),
    z.strictObject({ chokepointClosed: id }),
    z.strictObject({ flag: id }),
    z.strictObject({ noFlag: id }),
    z.strictObject({ afterDay: z.int().nonnegative() }),
    z.strictObject({ chance: basisPoints }),
  ]),
);

const days = z.int().positive();

export const effectSchema = z.union([
  z.strictObject({
    modify: z
      .strictObject({
        target: statPath,
        add: int.optional(),
        pct: int.optional(),
        days: days.optional(),
      })
      .refine((m) => (m.add === undefined) !== (m.pct === undefined), {
        message: 'A modify effect needs exactly one of add or pct',
      }),
  }),
  z.strictObject({ adjust: z.strictObject({ target: statPath, by: int }) }),
  z.strictObject({ relation: z.strictObject({ between: pair, by: int, days: days.optional() }) }),
  z.strictObject({ setChokepoint: z.strictObject({ id, open: z.boolean() }) }),
  z.strictObject({ schedule: z.strictObject({ event: id, inDays: days }) }),
  z.strictObject({ setFlag: id }),
  z.strictObject({ clearFlag: id }),
  // Remove the lingering modifiers of an earlier decision or event.
  z.strictObject({
    endEffectsOf: z.union([z.strictObject({ decision: id }), z.strictObject({ event: id })]),
  }),
]);

export type RawEffect = z.infer<typeof effectSchema>;

export const eventSchema = z.strictObject({
  id,
  /** A country ID, or home, markets or world. */
  tag: id,
  severity: z.enum(['critical', 'warning', 'info']).default('info'),
  headline: z.string().min(1),
  detail: z.string().min(1).optional(),
  trigger: conditionSchema.optional(),
  /** Must hold for the event to fire, whether triggered or scheduled. */
  requires: conditionSchema.optional(),
  once: z.boolean().default(false),
  cooldownDays: z.int().nonnegative().default(0),
  effects: z.array(effectSchema).min(1),
});

/**
 * A goal ID: `wealth`, `standing`, `security`, `prices(oil)`, `ties(thessa)`,
 * `grievance(aldoria)`. In computer orders, `ties(target)` names the target's goal.
 */
export const goalId = z
  .string()
  .regex(/^[a-z]+(\([a-z][a-z0-9_]*\))?$/, 'Goals look like wealth or ties(thessa)');

const MEASURE_KEYS = ['stat', 'relation', 'price', 'flag', 'day'] as const;
const CURVE_KEYS = ['rises', 'falls', 'peaks', 'step'] as const;

/**
 * One consideration of a computer order: a measure and a curve, one key each.
 *   - relation: [self, target]
 *     falls: [40, 90]        # full appeal at 40, none at 90
 */
export const considerationSchema = z
  .strictObject({
    stat: statPath.optional(),
    relation: pair.optional(),
    price: id.optional(),
    flag: id.optional(),
    /** The day number: `day: true` with a curve, such as `rises: [30, 90]`. */
    day: z.literal(true).optional(),
    rises: z.tuple([int, int]).optional(),
    falls: z.tuple([int, int]).optional(),
    peaks: z.tuple([int, int, int]).optional(),
    step: int.optional(),
  })
  .refine((c) => MEASURE_KEYS.filter((k) => c[k] !== undefined).length === 1, {
    message: 'A consideration needs exactly one of stat, relation, price, flag or day',
  })
  .refine((c) => CURVE_KEYS.filter((k) => c[k] !== undefined).length === 1, {
    message: 'A consideration needs exactly one of rises, falls, peaks or step',
  });

export type RawConsideration = z.infer<typeof considerationSchema>;

export const decisionSchema = z.strictObject({
  id,
  name: z.string().min(1),
  description: z.string().min(1),
  requires: conditionSchema.optional(),
  unavailableText: z.string().min(1).optional(),
  costs: z.array(effectSchema).default([]),
  durationDays: z.int().nonnegative().default(0),
  cooldownDays: z.int().nonnegative().default(0),
  chance: basisPoints.default(10_000),
  effects: z.array(effectSchema).default([]),
  failureEffects: z.array(effectSchema).default([]),
  successHeadline: z.string().min(1),
  failureHeadline: z.string().min(1).optional(),
  /** For policies: the flag set while the policy is in force. */
  policyFlag: id.optional(),
  // --- Computer orders only
  /** How the news reports it. Default info. */
  severity: z.enum(['critical', 'warning', 'info']).optional(),
  /** A line of detail for the news. */
  detail: z.string().min(1).optional(),
  /** Who may sign it: these countries, or any computer country. Missing: the player. */
  for: z.union([z.literal('any'), z.array(id).min(1)]).optional(),
  /** Makes it a template, aimed at each of these countries in turn, or every other one. */
  targets: z.union([z.literal('others'), z.array(id).min(1)]).optional(),
  /** Which goals it moves, from -5 to 5. */
  drives: z.record(goalId, z.int().min(-5).max(5)).optional(),
  consider: z.array(considerationSchema).optional(),
});

export const relationSchema = z.strictObject({
  between: pair,
  value: z.int().min(-100).max(100),
});
