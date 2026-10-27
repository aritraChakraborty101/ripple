import { DEFAULT_TUNING, mergeTuning, type TuningChange, type TuningOverrides } from './ai/tuning';
import type { AttentionState } from './ai/plan';
import type { AiDef } from './ai/types';
import type { Modifier } from './modifiers';
import { seedRng, type RngState } from './rng';
import type { DecisionDef, EventDef, ScheduledEvent } from './rules';
import { buildWorld, byId, type ScenarioDef, type ScenarioRules } from './scenario';
import { emptyTrace, type Trace } from './why';
import type { World } from './world';

/** A decision the player has signed whose outcome is not yet known. */
export interface PendingDecision {
  readonly id: string;
  readonly decision: string;
  readonly by: string;
  /** For templates: the country it is aimed at. */
  readonly target?: string;
  readonly issuedTick: number;
  readonly dueTick: number;
}

export interface GameOutcome {
  /** "ousted": stability collapsed. "survived": the leader saw out the full term. */
  readonly result: 'ousted' | 'survived';
  readonly tick: number;
}

/**
 * The whole simulation state. It must stay plain, serializable data
 * (no classes, functions or Maps) so it can be saved, sent over the network
 * and compared in tests.
 */
export interface GameState {
  readonly version: 6;
  readonly scenarioId: string;
  readonly rules: ScenarioRules;
  /** Event and decision definitions from the scenario, by ID. */
  readonly defs: {
    readonly events: Readonly<Record<string, EventDef>>;
    readonly decisions: Readonly<Record<string, DecisionDef>>;
    /** Personalities and the tuning in force. Null when no country acts on its own. */
    readonly ai: AiDef | null;
  };
  readonly seed: number;
  /** Number of ticks simulated so far. One tick is one in-game day. */
  readonly tick: number;
  readonly rng: RngState;
  readonly world: World;
  readonly modifiers: readonly Modifier[];
  readonly nextModifierId: number;
  /** Named facts set by effects, such as "reserves_used". Kept sorted. */
  readonly flags: readonly string[];
  /** Tick each event last fired. */
  readonly lastFired: Readonly<Record<string, number>>;
  /** Events waiting to fire, in the order they were scheduled. */
  readonly scheduled: readonly ScheduledEvent[];
  /** Tick each decision was last issued, by country (keys from `issuedKey`). */
  readonly lastIssued: Readonly<Record<string, number>>;
  readonly pending: readonly PendingDecision[];
  readonly nextPendingId: number;
  /** Consecutive days the player's stability has been under the ousting threshold. */
  readonly lowStabilityTicks: number;
  /** Null while the game is running. */
  readonly outcome: GameOutcome | null;
  /** Causal records for the why-trace: what fired and why, and what changed what. */
  readonly trace: Trace;
  /** Each computer country's attention: when it last acted, and whether it is noticing something. */
  readonly attention: Readonly<Record<string, AttentionState>>;
  /** Knob changes made during the game (see `retune`), in order. */
  readonly tuningChanges: readonly TuningChange[];
}

export interface GameOptions {
  /** Which of the scenario's tuning profiles to use; its default if missing. */
  readonly aiProfile?: string;
  /** Extra tuning on top of the profile, for tests and experiments. */
  readonly tuning?: TuningOverrides;
}

function aiFor(scenario: ScenarioDef, options: GameOptions): AiDef | null {
  if (!scenario.ai) return null;
  const name = options.aiProfile ?? scenario.ai.defaultProfile;
  const profile = scenario.ai.profiles[name];
  if (!profile) throw new Error(`Unknown AI profile "${name}"`);
  return {
    personalities: scenario.ai.personalities,
    tuning: mergeTuning(DEFAULT_TUNING, profile, options.tuning ?? {}),
  };
}

export function createGame(
  scenario: ScenarioDef,
  seed: number,
  options: GameOptions = {},
): GameState {
  const world = buildWorld(scenario);
  if (!world.countries[scenario.rules.playerCountry]) {
    throw new Error(`Player country "${scenario.rules.playerCountry}" is not in the scenario`);
  }
  return {
    version: 6,
    scenarioId: scenario.id,
    rules: scenario.rules,
    defs: {
      events: byId('event', scenario.events),
      decisions: byId('decision', scenario.decisions),
      ai: aiFor(scenario, options),
    },
    seed,
    tick: 0,
    rng: seedRng(seed),
    world,
    modifiers: [],
    nextModifierId: 1,
    flags: [],
    lastFired: {},
    scheduled: [],
    lastIssued: {},
    pending: [],
    nextPendingId: 1,
    lowStabilityTicks: 0,
    outcome: null,
    trace: emptyTrace,
    attention: {},
    tuningChanges: [],
  };
}

/** Open or close a chokepoint directly. Mainly for tests and tools. */
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

/** The day the game ends if the leader is not ousted first. */
export function lastDay(state: GameState): number {
  return state.rules.lengthYears * 360;
}
