import type { Modifier } from './modifiers';
import { seedRng, type RngState } from './rng';
import { buildWorld, type ScenarioDef, type ScenarioRules } from './scenario';
import type { World } from './world';

/**
 * The whole simulation state. It must stay plain, serializable data
 * (no classes, functions or Maps) so it can be saved, sent over the network
 * and compared in tests.
 */
export interface GameState {
  readonly version: 1;
  readonly scenarioId: string;
  readonly rules: ScenarioRules;
  readonly seed: number;
  /** Number of ticks simulated so far. One tick is one in-game day. */
  readonly tick: number;
  readonly rng: RngState;
  readonly world: World;
  readonly modifiers: readonly Modifier[];
  readonly nextModifierId: number;
}

export function createGame(scenario: ScenarioDef, seed: number): GameState {
  const world = buildWorld(scenario);
  if (!world.countries[scenario.rules.playerCountry]) {
    throw new Error(`Player country "${scenario.rules.playerCountry}" is not in the scenario`);
  }
  return {
    version: 1,
    scenarioId: scenario.id,
    rules: scenario.rules,
    seed,
    tick: 0,
    rng: seedRng(seed),
    world,
    modifiers: [],
    nextModifierId: 1,
  };
}

/** Open or close a chokepoint. Event and decision effects will call this. */
export function setChokepointOpen(state: GameState, id: string, open: boolean): GameState {
  const chokepoint = state.world.chokepoints[id];
  if (!chokepoint) {
    throw new Error(`Unknown chokepoint "${id}"`);
  }
  return {
    ...state,
    world: {
      ...state.world,
      chokepoints: { ...state.world.chokepoints, [id]: { ...chokepoint, open } },
    },
  };
}
