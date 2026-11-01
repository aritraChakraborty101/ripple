import { describe, expect, it } from 'vitest';
import {
  MAX_TICKS_PER_FRAME,
  MS_PER_DAY_AT_1X,
  advanceClock,
  initialClock,
  stepSpeed,
  type ClockState,
} from '../src/game/clock';

const running: ClockState = { ...initialClock, paused: false };

describe('clock', () => {
  it('simulates nothing while paused', () => {
    expect(advanceClock(initialClock, 10_000).ticks).toBe(0);
  });

  it('runs one day every 2 seconds at 1x', () => {
    const half = advanceClock(running, MS_PER_DAY_AT_1X / 2);
    expect(half.ticks).toBe(0);
    expect(advanceClock(half.clock, MS_PER_DAY_AT_1X / 2).ticks).toBe(1);
  });

  it('carries leftover time between frames', () => {
    let clock = running;
    let ticks = 0;
    for (let i = 0; i < 125; i += 1) {
      const result = advanceClock(clock, 16);
      clock = result.clock;
      ticks += result.ticks;
    }
    // 125 frames x 16 ms = 2000 ms = exactly one day.
    expect(ticks).toBe(1);
  });

  it('runs faster at higher speeds', () => {
    expect(advanceClock({ ...running, speed: 5 }, 800).ticks).toBe(2);
  });

  it('does not fast-forward through long pauses such as a background tab', () => {
    const { ticks } = advanceClock({ ...running, speed: 5 }, 60_000);
    expect(ticks).toBeLessThanOrEqual(MAX_TICKS_PER_FRAME);
    expect(ticks).toBe(2); // capped at 1 s of real time
  });
});

describe('stepSpeed', () => {
  it('moves one speed at a time and stops at either end', () => {
    expect(stepSpeed(1, 1)).toBe(2);
    expect(stepSpeed(3, 1)).toBe(5);
    expect(stepSpeed(5, 1)).toBe(5);
    expect(stepSpeed(2, -1)).toBe(1);
    expect(stepSpeed(1, -1)).toBe(1);
  });
});
