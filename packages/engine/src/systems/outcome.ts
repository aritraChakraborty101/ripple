import { effectiveStat } from '../modifiers';
import { lastDay } from '../state';
import type { System } from './types';

/**
 * Ends the game: the leader is ousted if stability stays below the threshold
 * for too long, and survives if they reach the end of the term. Runs last, so
 * it judges the day after everything else has happened.
 */
export const outcomeSystem: System = {
  name: 'outcome',
  run(state) {
    if (state.outcome) return { state, events: [] };
    const { playerCountry, ousting } = state.rules;
    const value = effectiveStat(state, { kind: 'country', id: playerCountry, stat: ousting.stat });
    const lowStabilityTicks = value < ousting.below ? state.lowStabilityTicks + 1 : 0;

    if (lowStabilityTicks >= ousting.forTicks) {
      const outcome = { result: 'ousted' as const, tick: state.tick };
      return {
        state: { ...state, lowStabilityTicks, outcome },
        events: [{ kind: 'game_over', tick: state.tick, result: 'ousted' }],
      };
    }
    if (state.tick + 1 >= lastDay(state)) {
      const outcome = { result: 'survived' as const, tick: state.tick };
      return {
        state: { ...state, lowStabilityTicks, outcome },
        events: [{ kind: 'game_over', tick: state.tick, result: 'survived' }],
      };
    }
    return {
      state:
        lowStabilityTicks === state.lowStabilityTicks ? state : { ...state, lowStabilityTicks },
      events: [],
    };
  },
};
