import { describe, expect, it } from 'vitest';
import { TICKS_PER_YEAR, dateOf, ticksFor } from '../src/index';

describe('calendar', () => {
  it('has 360-day years', () => {
    expect(TICKS_PER_YEAR).toBe(360);
  });

  it('converts ticks to dates', () => {
    expect(dateOf(0)).toEqual({ year: 1, month: 1, day: 1 });
    expect(dateOf(29)).toEqual({ year: 1, month: 1, day: 30 });
    expect(dateOf(30)).toEqual({ year: 1, month: 2, day: 1 });
    expect(dateOf(359)).toEqual({ year: 1, month: 12, day: 30 });
    expect(dateOf(360)).toEqual({ year: 2, month: 1, day: 1 });
  });

  it('converts durations to ticks', () => {
    expect(ticksFor({ years: 5 })).toBe(1_800);
    expect(ticksFor({ months: 2, days: 3 })).toBe(63);
  });
});
