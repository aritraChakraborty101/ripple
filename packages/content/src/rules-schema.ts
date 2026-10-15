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
  once: z.boolean().default(false),
  cooldownDays: z.int().nonnegative().default(0),
  effects: z.array(effectSchema).min(1),
});

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
});

export const relationSchema = z.strictObject({
  between: pair,
  value: z.int().min(-100).max(100),
});
