import type { EngineEvent } from './events';
import type { GameState } from './state';
import { SYSTEMS } from './systems';

/**
 * An order issued by a player or an AI. Real order types (dispatch envoy,
 * set tariff, ...) arrive with the decision system; this placeholder keeps
 * the step signature stable.
 */
export interface Order {
  readonly kind: string;
  readonly issuedBy: string;
}

export interface StepResult {
  readonly state: GameState;
  readonly events: readonly EngineEvent[];
}

/**
 * Simulate the current day, then advance the clock by one tick.
 * Pure: the same state and orders always give the same result.
 */
export function step(state: GameState, orders: readonly Order[]): StepResult {
  void orders;
  let current = state;
  const events: EngineEvent[] = [];
  for (const system of SYSTEMS) {
    const result = system.run(current);
    current = result.state;
    events.push(...result.events);
  }
  return { state: { ...current, tick: current.tick + 1 }, events };
}

/** Run several ticks with no orders. Convenient for tests and tools. */
export function run(state: GameState, ticks: number): GameState {
  let current = state;
  for (let i = 0; i < ticks; i += 1) {
    current = step(current, []).state;
  }
  return current;
}
