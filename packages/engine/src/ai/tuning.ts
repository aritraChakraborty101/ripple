/**
 * The tuning layer: knobs between what countries are (their personalities, in
 * content) and how strongly they behave. Layers apply in order, each one
 * overriding the last: the defaults here, the scenario's chosen profile, then
 * any overrides passed in for a test.
 *
 * Knobs are added when code uses them, so every knob here does something.
 */

import type { GameState } from '../state';
import type { Tuning } from './types';

export const DEFAULT_TUNING: Tuning = {
  inertia: 2_500,
  temperature: 10_000,
  hostility: 10_000,
  cooperation: 10_000,
  ambitionBoost: 15_000,
  compensation: true,
  attention: 20,
  maxDailyChance: 5_000,
  noticeBoost: 30_000,
  noticeDays: 7,
  restDays: 5,
  countries: {},
  actions: {},
};

/** A partial set of knobs, as a profile or a test writes it. */
export type TuningOverrides = Partial<Omit<Tuning, 'countries' | 'actions'>> & {
  readonly countries?: Tuning['countries'];
  readonly actions?: Tuning['actions'];
};

/** Apply layers of overrides in order. Per-country and per-action settings merge key by key. */
export function mergeTuning(base: Tuning, ...layers: readonly TuningOverrides[]): Tuning {
  let merged = base;
  for (const layer of layers) {
    const countries = { ...merged.countries };
    for (const [id, c] of Object.entries(layer.countries ?? {})) {
      countries[id] = {
        ...countries[id],
        ...c,
        weights: { ...countries[id]?.weights, ...c.weights },
      };
    }
    const actions = { ...merged.actions };
    for (const [id, a] of Object.entries(layer.actions ?? {})) {
      actions[id] = { ...actions[id], ...a };
    }
    merged = { ...merged, ...layer, countries, actions };
  }
  return merged;
}

/** A change to the knobs made during a game, kept so the game can be replayed exactly. */
export interface TuningChange {
  readonly tick: number;
  readonly overrides: TuningOverrides;
}

/**
 * Change the AI's knobs mid-game, for experiments such as the dev panel. The
 * change is recorded in `tuningChanges`, so a game stays reproducible from its
 * seed, the player's orders and these changes.
 */
export function retune(state: GameState, overrides: TuningOverrides): GameState {
  const ai = state.defs.ai;
  if (!ai) throw new Error('This scenario has no AI to tune');
  return {
    ...state,
    defs: { ...state.defs, ai: { ...ai, tuning: mergeTuning(ai.tuning, overrides) } },
    tuningChanges: [...state.tuningChanges, { tick: state.tick, overrides }],
  };
}
