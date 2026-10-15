import type { EngineEvent } from './events';
import { applyOrders, type Order } from './orders';
import type { GameState } from './state';
import { SYSTEMS } from './systems';

export interface StepResult {
  readonly state: GameState;
  readonly events: readonly EngineEvent[];
}

/**
 * Sign the given orders, simulate the current day, then advance the clock by
 * one tick. Pure: the same state and orders always give the same result.
 * Once the game is over, nothing changes.
 */
export function step(state: GameState, orders: readonly Order[]): StepResult {
  if (state.outcome) return { state, events: [] };

  const signed = applyOrders(state, orders);
  let current = signed.state;
  const events: EngineEvent[] = [...signed.events];
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
