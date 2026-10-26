/**
 * Noticing: countries react quickly to what touches them and drift slowly
 * otherwise. At the end of each day, a computer country starts noticing (its
 * attention is boosted for a few days) when:
 *   - an event about it fired,
 *   - an order it signed resolved, or an order aimed at it was signed or resolved,
 *   - one of its relations moved by NOTICE_RELATION_CHANGE or more during the day.
 */

import type { EngineEvent } from '../events';
import { effectiveStat } from '../modifiers';
import type { GameState } from '../state';
import { relationId, sortedIds } from '../world';
import { computerCountries } from './clearing-house';
import { FRESH_ATTENTION } from './plan';

export const NOTICE_RELATION_CHANGE = 10;

function relationsOf(state: GameState, country: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const other of sortedIds(state.world.countries)) {
    if (other === country) continue;
    out[other] = effectiveStat(state, {
      kind: 'relation',
      id: relationId(country, other),
      stat: 'value',
    });
  }
  return out;
}

function touchedBy(state: GameState, country: string, events: readonly EngineEvent[]): boolean {
  return events.some((e) => {
    if (e.kind === 'event_fired') return state.defs.events[e.event]?.tag === country;
    if (e.kind === 'decision_resolved') return e.by === country || e.target === country;
    if (e.kind === 'decision_issued') return e.target === country;
    return false;
  });
}

/** Mark the countries that noticed something today. `before` is the state at the start of the day. */
export function notice(
  before: GameState,
  after: GameState,
  events: readonly EngineEvent[],
): GameState {
  if (!after.defs.ai) return after;
  const until = after.tick + after.defs.ai.tuning.noticeDays;
  let attention = after.attention;
  for (const country of computerCountries(after)) {
    let touched = touchedBy(after, country, events);
    if (!touched) {
      const was = relationsOf(before, country);
      const now = relationsOf(after, country);
      touched = Object.keys(now).some(
        (other) => Math.abs(now[other]! - (was[other] ?? 0)) >= NOTICE_RELATION_CHANGE,
      );
    }
    if (touched) {
      attention = {
        ...attention,
        [country]: { ...(attention[country] ?? FRESH_ATTENTION), noticeUntil: until },
      };
    }
  }
  return attention === after.attention ? after : { ...after, attention };
}
