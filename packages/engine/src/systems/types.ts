import type { EngineEvent } from '../events';
import type { GameState } from '../state';

export interface SystemResult {
  readonly state: GameState;
  readonly events: readonly EngineEvent[];
}

/**
 * One mechanic of the simulation. Systems run in a fixed order every tick,
 * read and write the state, and emit events. They never call each other.
 * A new mechanic (stability, diplomacy, elections, ...) is one new system.
 */
export interface System {
  readonly name: string;
  run(state: GameState): SystemResult;
}
