import { describe, expect, it } from 'vitest';
import {
  createGame,
  effectiveStat,
  run,
  step,
  type EngineEvent,
  type GameState,
} from '../src/index';
import { relationRef, tinyScenario } from './fixtures';

function stepWith(
  state: GameState,
  decision?: string,
): { state: GameState; events: readonly EngineEvent[] } {
  return step(state, decision ? [{ kind: 'decide', decision, by: 'importer' }] : []);
}

describe('world events', () => {
  it('stay quiet while their trigger does not hold', () => {
    const quiet = run(createGame(tinyScenario, 1), 60);
    expect(quiet.lastFired).toEqual({});
    expect(quiet.world.chokepoints.strait!.open).toBe(true);
  });

  it('fire when the trigger holds: an insult closes the strait the same day', () => {
    const { state, events } = stepWith(createGame(tinyScenario, 1), 'insult');
    expect(events.map((e) => e.kind)).toEqual([
      'decision_issued',
      'decision_resolved',
      'event_fired',
      'price_moved',
    ]);
    expect(events).toContainEqual({
      kind: 'event_fired',
      tick: 0,
      event: 'strait_closes',
      scheduled: false,
    });
    expect(state.world.chokepoints.strait!.open).toBe(false);
    expect(state.lastFired.strait_closes).toBe(0);
  });

  it('fire scheduled consequences on their due day', () => {
    let state = stepWith(createGame(tinyScenario, 1), 'insult').state;
    let reopened: EngineEvent | undefined;
    for (let day = 1; day <= 10 && !reopened; day += 1) {
      const result = stepWith(state);
      state = result.state;
      reopened = result.events.find(
        (e) => e.kind === 'event_fired' && e.event === 'strait_reopens',
      );
    }
    expect(reopened).toEqual({
      kind: 'event_fired',
      tick: 10,
      event: 'strait_reopens',
      scheduled: true,
    });
    expect(state.world.chokepoints.strait!.open).toBe(true);
    expect(effectiveStat(state, relationRef)).toBe(0);
    expect(state.scheduled).toEqual([]);
  });

  it('record the cause of each effect for the why-trace', () => {
    const state = stepWith(createGame(tinyScenario, 1), 'insult').state;
    expect(state.scheduled[0]!.cause).toEqual({ kind: 'event', id: 'strait_closes', tick: 0 });
  });
});
