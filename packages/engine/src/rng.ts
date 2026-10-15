/**
 * Seeded pseudo-random number generator (mulberry32).
 *
 * The state is a single unsigned 32-bit integer stored inside the game state,
 * so every random draw is reproducible from the seed. All arithmetic uses
 * integer operations (Math.imul, bit shifts), which give identical results in
 * every JavaScript engine. Never use Math.random() in the engine.
 *
 * Functions are pure: they return the drawn value and the next state.
 */

export type RngState = number;

export interface Draw<T> {
  readonly value: T;
  readonly next: RngState;
}

/** Create an RNG state from any integer seed. */
export function seedRng(seed: number): RngState {
  if (!Number.isInteger(seed)) {
    throw new Error(`Seed must be an integer, got ${seed}`);
  }
  return seed >>> 0;
}

/** Draw an unsigned 32-bit integer. */
export function nextU32(state: RngState): Draw<number> {
  const next = (state + 0x6d2b79f5) >>> 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return { value: (t ^ (t >>> 14)) >>> 0, next };
}

const TWO_POW_32 = 0x1_0000_0000;

/** Draw an integer in [min, max], both inclusive. */
export function nextInt(state: RngState, min: number, max: number): Draw<number> {
  if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) {
    throw new Error(`Invalid range [${min}, ${max}]`);
  }
  const range = max - min + 1;
  if (range > TWO_POW_32) {
    throw new Error(`Range too large: ${range}`);
  }
  // Rejection sampling removes modulo bias.
  const limit = TWO_POW_32 - (TWO_POW_32 % range);
  let current = state;
  for (;;) {
    const draw = nextU32(current);
    current = draw.next;
    if (draw.value < limit) {
      return { value: min + (draw.value % range), next: current };
    }
  }
}

/**
 * Return true with the given probability, expressed in basis points
 * (1 bp = 0.01%, so 500 = 5%). Integer probabilities keep content files exact.
 */
export function chance(state: RngState, basisPoints: number): Draw<boolean> {
  if (!Number.isInteger(basisPoints) || basisPoints < 0 || basisPoints > 10_000) {
    throw new Error(`Chance must be an integer between 0 and 10000 bp, got ${basisPoints}`);
  }
  const draw = nextInt(state, 0, 9_999);
  return { value: draw.value < basisPoints, next: draw.next };
}
