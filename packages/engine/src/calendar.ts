/**
 * One tick is one in-game day. The calendar has 12 months of 30 days, so a
 * year is 360 ticks and dates stay simple integer arithmetic.
 */

export const DAYS_PER_MONTH = 30;
export const MONTHS_PER_YEAR = 12;
export const TICKS_PER_YEAR = DAYS_PER_MONTH * MONTHS_PER_YEAR;

export interface GameDate {
  /** Starts at 1. */
  readonly year: number;
  /** 1 to 12. */
  readonly month: number;
  /** 1 to 30. */
  readonly day: number;
}

export function dateOf(tick: number): GameDate {
  if (!Number.isInteger(tick) || tick < 0) {
    throw new Error(`Tick must be a non-negative integer, got ${tick}`);
  }
  const dayOfYear = tick % TICKS_PER_YEAR;
  return {
    year: Math.floor(tick / TICKS_PER_YEAR) + 1,
    month: Math.floor(dayOfYear / DAYS_PER_MONTH) + 1,
    day: (dayOfYear % DAYS_PER_MONTH) + 1,
  };
}

export function ticksFor(duration: { years?: number; months?: number; days?: number }): number {
  return (
    (duration.years ?? 0) * TICKS_PER_YEAR +
    (duration.months ?? 0) * DAYS_PER_MONTH +
    (duration.days ?? 0)
  );
}
