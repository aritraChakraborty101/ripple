/**
 * The tuning layer: knobs between what countries are (their personalities, in
 * content) and how strongly they behave. Layers apply in order, each one
 * overriding the last: the defaults here, the scenario's chosen profile, then
 * any overrides passed in for a test.
 *
 * Knobs are added when code uses them, so every knob here does something.
 */

import type { Tuning } from './types';

export const DEFAULT_TUNING: Tuning = {
  inertia: 2_500,
  temperature: 10_000,
  hostility: 10_000,
  cooperation: 10_000,
  ambitionBoost: 15_000,
  compensation: true,
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
