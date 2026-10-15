import type { GameState } from './state';

/**
 * An order issued by a player or an AI. Real order types (dispatch envoy,
 * set tariff, ...) arrive with the decision system; this placeholder keeps
 * the step signature stable.
 */
export interface Order {
  readonly kind: string;
  readonly issuedBy: string;
}

/** Something notable that happened during a tick, for the log and the why-trace. */
export interface EngineEvent {
  readonly tick: number;
  readonly kind: string;
}

export interface StepResult {
  readonly state: GameState;
  readonly events: readonly EngineEvent[];
}

/**
 * Advance the world by exactly one tick. Pure: same input, same output.
 * Systems (economy, trade, stability, ...) will run here in a fixed order.
 */
export function step(state: GameState, orders: readonly Order[]): StepResult {
  void orders;
  return {
    state: { ...state, tick: state.tick + 1 },
    events: [],
  };
}

/** Run several ticks with no orders. Convenient for tests and tools. */
export function run(state: GameState, ticks: number): GameState {
  let current = state;
  for (let i = 0; i < ticks; i += 1) {
    current = step(current, []).state;
  }
  return current;
}
