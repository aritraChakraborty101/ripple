/**
 * The registry of measures: everything the AI can read from the state. A new
 * kind of measure (military balance, say) is one entry here and one shape in
 * `Measure`; goals and considerations can then use it from content.
 */

import { effectiveStat, type StatRef } from '../modifiers';
import type { GameState } from '../state';
import { relationId } from '../world';
import type { Measure } from './types';

type Reader<K extends Measure['kind']> = (
  state: GameState,
  measure: Extract<Measure, { kind: K }>,
) => number;

const READERS: { readonly [K in Measure['kind']]: Reader<K> } = {
  stat: (state, m) => effectiveStat(state, m.ref),
  relation: (state, m) =>
    effectiveStat(state, {
      kind: 'relation',
      id: relationId(m.between[0], m.between[1]),
      stat: 'value',
    }),
  price: (state, m) => {
    const resource = state.world.resources[m.resource];
    if (!resource) throw new Error(`Unknown resource "${m.resource}"`);
    const price = effectiveStat(state, { kind: 'resource', id: m.resource, stat: 'price' });
    return Math.trunc(((price - resource.basePrice) * 100) / resource.basePrice);
  },
  flag: (state, m) => (state.flags.includes(m.flag) ? 1 : 0),
  day: (state) => state.tick,
};

/** Read a measure. Placeholders must already be bound. */
export function readMeasure(state: GameState, measure: Measure): number {
  return (READERS[measure.kind] as Reader<typeof measure.kind>)(state, measure as never);
}

/** How a measure reads in a report, such as "relation(aldoria, corvan)". */
export function measureLabel(measure: Measure): string {
  switch (measure.kind) {
    case 'stat':
      return `${measure.ref.kind}.${measure.ref.id}.${measure.ref.stat}`;
    case 'relation':
      return `relation(${measure.between[0]}, ${measure.between[1]})`;
    case 'price':
      return `price(${measure.resource})`;
    case 'flag':
      return `flag(${measure.flag})`;
    case 'day':
      return 'day';
  }
}

/** The stat behind a measure, so the why-trace can explain it; null for flags. */
export function measureRef(measure: Measure): StatRef | null {
  switch (measure.kind) {
    case 'stat':
      return measure.ref;
    case 'relation':
      return {
        kind: 'relation',
        id: relationId(measure.between[0], measure.between[1]),
        stat: 'value',
      };
    case 'price':
      return { kind: 'resource', id: measure.resource, stat: 'price' };
    case 'flag':
    case 'day':
      return null;
  }
}
