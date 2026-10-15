import type { EngineEvent } from '../events';
import type { System } from './types';

/** Removes modifiers whose duration has run out. Runs first, so stats are current. */
export const modifierExpirySystem: System = {
  name: 'modifier-expiry',
  run(state) {
    const kept = [];
    const events: EngineEvent[] = [];
    for (const m of state.modifiers) {
      if (m.expiresAt !== null && m.expiresAt <= state.tick) {
        events.push({
          kind: 'modifier_expired',
          tick: state.tick,
          modifierId: m.id,
          source: m.source,
        });
      } else {
        kept.push(m);
      }
    }
    if (events.length === 0) {
      return { state, events };
    }
    return { state: { ...state, modifiers: kept }, events };
  },
};
