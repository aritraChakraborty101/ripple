import type { EngineEvent } from '../events';
import { chance } from '../rng';
import { boundDecision } from '../orders';
import { applyEffects } from '../rules';
import type { GameState } from '../state';
import type { System } from './types';

/** Resolves signed decisions whose time has come: success or failure, then effects. */
export const decisionSystem: System = {
  name: 'decisions',
  run(state) {
    const due = state.pending.filter((p) => p.dueTick <= state.tick);
    if (due.length === 0) return { state, events: [] };

    let current: GameState = {
      ...state,
      pending: state.pending.filter((p) => p.dueTick > state.tick),
    };
    const events: EngineEvent[] = [];

    for (const pending of due) {
      const raw = current.defs.decisions[pending.decision];
      if (!raw) continue;
      const def = boundDecision(raw, pending.by, pending.target);
      let success = true;
      if (def.chanceBp < 10_000) {
        const draw = chance(current.rng, def.chanceBp);
        current = { ...current, rng: draw.next };
        success = draw.value;
      }
      const source = {
        kind: 'decision' as const,
        id: def.id,
        tick: pending.issuedTick,
        by: pending.by,
        ...(pending.target !== undefined ? { target: pending.target } : {}),
      };
      current = applyEffects(current, success ? def.effects : def.failureEffects, source);
      events.push({
        kind: 'decision_resolved',
        tick: state.tick,
        decision: def.id,
        by: pending.by,
        ...(pending.target !== undefined ? { target: pending.target } : {}),
        issuedTick: pending.issuedTick,
        success,
      });
    }

    return { state: current, events };
  },
};
