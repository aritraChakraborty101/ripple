/**
 * Shapes shared by the AI's building blocks. All numbers are integers:
 * needs, appeal and multipliers in basis points (10000 = 100%), and scores in
 * hundredths of a point (2500 = a score of 25).
 */

import type { StatRef } from '../modifiers';

/**
 * A goal's ID names what it measures, with its argument in brackets:
 * `wealth`, `standing`, `security`, `prices(oil)`, `ties(thessa)`,
 * `grievance(aldoria)`. Actions refer to goals by the same IDs, so an action
 * that drives `ties(target)` serves whichever country it is aimed at.
 */
export type GoalKind = 'wealth' | 'standing' | 'security' | 'prices' | 'ties' | 'grievance';

export interface GoalDef {
  readonly id: string;
  /** How much the country cares, out of the 100 its goals share. */
  readonly weight: number;
  /** Where the country wants the goal's measure to be. Unused by grievance and security. */
  readonly aspire?: number;
}

/** A long project: a goal and a target. While unmet, the goal counts more. */
export interface AmbitionDef {
  readonly id: string;
  readonly name: string;
  readonly goal: string;
  /** Met when the goal's measure reaches this value. */
  readonly target: number;
}

/** What a computer country wants. */
export interface Personality {
  readonly goals: readonly GoalDef[];
  /** In order: the first unmet one is the country's current ambition. */
  readonly ambitions: readonly AmbitionDef[];
}

/**
 * Something the AI can read from the state. Country IDs may be the
 * placeholders `self` and `target`, filled in when a template is bound.
 */
export type Measure =
  | { readonly kind: 'stat'; readonly ref: StatRef }
  | { readonly kind: 'relation'; readonly between: readonly [string, string] }
  /** Percent above (or below) the resource's normal price. */
  | { readonly kind: 'price'; readonly resource: string }
  /** 1 if the flag is set, 0 if not. */
  | { readonly kind: 'flag'; readonly flag: string }
  /** Today's day number, for actions that should build up over the opening months. */
  | { readonly kind: 'day' };

/**
 * Turns a measure into appeal from 0 to 10000 basis points.
 *   rises: 0 at `from`, full at `to` (either direction), straight line between.
 *   falls: full at `from`, 0 at `to`.
 *   peaks: 0 at `from`, full at `peak`, 0 again at `to`.
 *   step:  full at or above `at`, 0 below.
 */
export type Curve =
  | { readonly type: 'rises'; readonly from: number; readonly to: number }
  | { readonly type: 'falls'; readonly from: number; readonly to: number }
  | { readonly type: 'peaks'; readonly from: number; readonly peak: number; readonly to: number }
  | { readonly type: 'step'; readonly at: number };

export interface Consideration {
  readonly measure: Measure;
  readonly curve: Curve;
  /**
   * A gate multiplies the combined appeal instead of joining it, and does not
   * count toward compensation. So a check that is usually wide open (is there a
   * treaty?) changes nothing until it closes.
   */
  readonly gate?: boolean;
}

/** Knobs that change how strongly countries behave, without changing who they are. */
export interface Tuning {
  /** Doing nothing scores this, in hundredths of a point. Actions must beat it. */
  readonly inertia: number;
  /** How much less likely than the best option the others are picked; 0 always picks the best. Basis points. */
  readonly temperature: number;
  /** Multiplier on grievance goals, in basis points. */
  readonly hostility: number;
  /** Multiplier on ties goals, in basis points. */
  readonly cooperation: number;
  /** Multiplier on the goal of a country's current ambition, in basis points. */
  readonly ambitionBoost: number;
  /** Make up for multiplying many considerations, so actions with more checks are not punished. */
  readonly compensation: boolean;
  /** Daily chance of acting per point of urgency, in basis points (20 = 0.2% per point). */
  readonly attention: number;
  /** The most a country's daily chance of acting can be, in basis points. */
  readonly maxDailyChance: number;
  /** Multiplier on attention while a country is noticing something that touched it, in basis points. */
  readonly noticeBoost: number;
  /** How long noticing lasts, in days. */
  readonly noticeDays: number;
  /** Days a country rests after acting before it may act again. */
  readonly restDays: number;
  /** Per-country overrides of goal weights, by goal ID. */
  readonly countries: Readonly<
    Record<string, { readonly weights?: Readonly<Record<string, number>> }>
  >;
  /** Per-action switches and score multipliers (basis points). */
  readonly actions: Readonly<
    Record<string, { readonly enabled?: boolean; readonly scoreMultiplier?: number }>
  >;
}

/** Everything the AI needs from the scenario. */
export interface AiDef {
  readonly personalities: Readonly<Record<string, Personality>>;
  readonly tuning: Tuning;
}
