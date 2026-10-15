import type { EngineEvent } from '../events';
import { applyEffects, evaluate, type EventDef } from '../rules';
import type { GameState } from '../state';
import { sortedIds } from '../world';
import type { System } from './types';

function fire(state: GameState, def: EventDef): GameState {
  const fired = applyEffects(state, def.effects, { kind: 'event', id: def.id, tick: state.tick });
  return { ...fired, lastFired: { ...fired.lastFired, [def.id]: state.tick } };
}

function onCooldown(state: GameState, def: EventDef): boolean {
  const last = state.lastFired[def.id];
  if (last === undefined) return false;
  return def.once || state.tick < last + def.cooldownDays;
}

/**
 * Fires events: first those scheduled for today (delayed consequences), then
 * any whose trigger holds. Events are checked in ID order so randomness is
 * consumed in a stable order.
 */
export const worldEventSystem: System = {
  name: 'world-events',
  run(state) {
    let current = state;
    const events: EngineEvent[] = [];

    const due = state.scheduled.filter((s) => s.dueTick <= state.tick);
    if (due.length > 0) {
      current = { ...current, scheduled: state.scheduled.filter((s) => s.dueTick > state.tick) };
      for (const item of due) {
        const def = current.defs.events[item.event];
        if (!def) continue;
        current = fire(current, def);
        events.push({ kind: 'event_fired', tick: state.tick, event: def.id, scheduled: true });
      }
    }

    for (const id of sortedIds(current.defs.events)) {
      const def = current.defs.events[id]!;
      if (!def.trigger || onCooldown(current, def)) continue;
      const result = evaluate(current, def.trigger);
      current = result.state;
      if (!result.value) continue;
      current = fire(current, def);
      events.push({ kind: 'event_fired', tick: state.tick, event: def.id, scheduled: false });
    }

    return { state: current, events };
  },
};
