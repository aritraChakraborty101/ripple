import { seedRng, type RngState } from './rng';

/**
 * The whole simulation state. It must stay plain, serializable data
 * (no classes, functions or Maps) so it can be saved, sent over the network
 * and compared in tests.
 */
export interface GameState {
  readonly version: 1;
  readonly seed: number;
  /** Number of ticks simulated so far. One tick is one in-game day. */
  readonly tick: number;
  readonly rng: RngState;
}

export function createGame(seed: number): GameState {
  return { version: 1, seed, tick: 0, rng: seedRng(seed) };
}
