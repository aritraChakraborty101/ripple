/**
 * The YAML for computer countries: personalities (ai.yaml) and tuning
 * profiles (ai-tuning.yaml).
 *
 *   # ai.yaml
 *   personalities:
 *     corvan:
 *       goals:
 *         wealth: { weight: 35, aspire: 250 }
 *         grievance(aldoria): { weight: 30 }
 *       ambitions:
 *         - { id: strait_pays, name: Make the strait pay, goal: wealth, target: 250 }
 *
 *   # ai-tuning.yaml
 *   default: standard
 *   profiles:
 *     standard: {}
 *     aggressive: { inertia: 15, hostility: 1.5 }
 *
 * Tuning is written in friendly units (an inertia of 25, a hostility of 1.5)
 * and converted to the engine's integers when the scenario loads.
 */

import { z } from 'zod';
import { goalId, id } from './rules-schema';

const goalSchema = z.strictObject({
  weight: z.int().min(1).max(100),
  aspire: z.int().optional(),
});

const ambitionSchema = z.strictObject({
  id,
  name: z.string().min(1),
  goal: goalId,
  target: z.int(),
});

export const personalitySchema = z.strictObject({
  goals: z.record(goalId, goalSchema),
  ambitions: z.array(ambitionSchema).default([]),
});

export const aiFileSchema = z.strictObject({
  personalities: z.record(id, personalitySchema),
});

const factor = z.number().nonnegative();

/** One profile's knobs. Every knob is optional; missing ones keep the defaults. */
export const tuningProfileSchema = z.strictObject({
  /** Points an action must beat to be worth doing. Default 25. */
  inertia: factor.optional(),
  /** 0 always picks the best option; 1 is the default; higher is more surprising. */
  temperature: factor.optional(),
  /** Multiplier on grievance goals. Default 1. */
  hostility: factor.optional(),
  /** Multiplier on ties goals. Default 1. */
  cooperation: factor.optional(),
  /** Multiplier on a country's current ambition. Default 1.5. */
  ambitionBoost: factor.optional(),
  /** Make up for multiplying many considerations. Default true. */
  compensation: z.boolean().optional(),
  /** Daily chance of acting per point of urgency, in percent. Default 0.2. */
  attention: factor.optional(),
  /** The most a country's daily chance of acting can be, in percent. Default 50. */
  maxDailyChance: z.number().min(0).max(100).optional(),
  /** Multiplier on attention while a country notices something that touched it. Default 3. */
  noticeBoost: factor.optional(),
  /** Days noticing lasts. Default 7. */
  noticeDays: z.int().nonnegative().optional(),
  /** Days a country rests after acting. Default 5. */
  restDays: z.int().nonnegative().optional(),
  countries: z
    .record(id, z.strictObject({ weights: z.record(goalId, z.int().min(0).max(100)) }))
    .optional(),
  actions: z
    .record(
      id,
      z.strictObject({ enabled: z.boolean().optional(), scoreMultiplier: factor.optional() }),
    )
    .optional(),
});

export const tuningFileSchema = z.strictObject({
  default: id,
  profiles: z.record(id, tuningProfileSchema),
});

export type RawAiFile = z.infer<typeof aiFileSchema>;
export type RawTuningFile = z.infer<typeof tuningFileSchema>;
export type RawTuningProfile = z.infer<typeof tuningProfileSchema>;
