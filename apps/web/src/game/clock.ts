/**
 * Turns real time into engine ticks (fixed timestep). The engine never sees
 * real time: the clock only decides how many whole days to simulate.
 *
 * At 1x a day lasts 2 seconds, so a 5-year game (1,800 days) is about an hour.
 */

export const SPEEDS = [1, 2, 3, 5] as const;
export type Speed = (typeof SPEEDS)[number];

export const MS_PER_DAY_AT_1X = 2_000;
/** Ignore long gaps (a backgrounded tab) instead of fast-forwarding through them. */
export const MAX_FRAME_MS = 1_000;
/** Never simulate more than this many days in one frame. */
export const MAX_TICKS_PER_FRAME = 10;

export interface ClockState {
  readonly paused: boolean;
  readonly speed: Speed;
  /** Real milliseconds accumulated toward the next day. */
  readonly carryMs: number;
}

/** The next speed up (+1) or down (−1), stopping at either end. */
export function stepSpeed(speed: Speed, direction: 1 | -1): Speed {
  const index = SPEEDS.indexOf(speed) + direction;
  return SPEEDS[Math.max(0, Math.min(SPEEDS.length - 1, index))]!;
}

export const initialClock: ClockState = { paused: true, speed: 1, carryMs: 0 };

export function msPerDay(speed: Speed): number {
  return MS_PER_DAY_AT_1X / speed;
}

/** Feed real elapsed time in; get the number of days to simulate out. */
export function advanceClock(
  clock: ClockState,
  elapsedMs: number,
): { clock: ClockState; ticks: number } {
  if (clock.paused) {
    return { clock: clock.carryMs === 0 ? clock : { ...clock, carryMs: 0 }, ticks: 0 };
  }
  const total = clock.carryMs + Math.min(Math.max(elapsedMs, 0), MAX_FRAME_MS);
  const perDay = msPerDay(clock.speed);
  const ticks = Math.min(Math.floor(total / perDay), MAX_TICKS_PER_FRAME);
  const carryMs = ticks === MAX_TICKS_PER_FRAME ? 0 : total - ticks * perDay;
  return { clock: { ...clock, carryMs }, ticks };
}

/** How far through the current day we are, 0 to 1, for smooth progress display. */
export function dayProgress(clock: ClockState): number {
  return Math.min(1, clock.carryMs / msPerDay(clock.speed));
}
