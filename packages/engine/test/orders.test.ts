import { describe, expect, it } from 'vitest';
import {
  applyOrders,
  canIssue,
  createGame,
  effectiveStat,
  run,
  step,
  type Order,
} from '../src/index';
import { relationRef, tinyScenario, treasuryRef } from './fixtures';

const envoy: Order = { kind: 'decide', decision: 'envoy', by: 'importer' };
const insult: Order = { kind: 'decide', decision: 'insult', by: 'importer' };

describe('orders', () => {
  it('pays costs immediately and schedules the outcome', () => {
    const { state, events } = applyOrders(createGame(tinyScenario, 1), [envoy]);
    expect(effectiveStat(state, treasuryRef)).toBe(380);
    expect(state.pending).toEqual([
      { id: 'p1', decision: 'envoy', by: 'importer', issuedTick: 0, dueTick: 3 },
    ]);
    expect(events).toEqual([
      {
        kind: 'decision_issued',
        tick: 0,
        decision: 'envoy',
        by: 'importer',
        pendingId: 'p1',
        dueTick: 3,
      },
    ]);
  });

  it('resolves on the due day with success or failure effects', () => {
    let state = applyOrders(createGame(tinyScenario, 1), [envoy]).state;
    let resolved = null;
    for (let day = 0; day < 4 && !resolved; day += 1) {
      const result = step(state, []);
      state = result.state;
      resolved = result.events.find((e) => e.kind === 'decision_resolved') ?? null;
    }
    expect(resolved).toMatchObject({ kind: 'decision_resolved', tick: 3, decision: 'envoy' });
    expect(state.pending).toEqual([]);
    const success = resolved!.kind === 'decision_resolved' && resolved!.success;
    if (success) expect(effectiveStat(state, relationRef)).toBe(20);
    else expect(state.flags).toContain('envoy_failed');
  });

  it('gives both outcomes across different seeds (50% chance)', () => {
    const outcomes = new Set<boolean>();
    for (let seed = 1; seed <= 20; seed += 1) {
      const state = run(applyOrders(createGame(tinyScenario, seed), [envoy]).state, 4);
      outcomes.add(!state.flags.includes('envoy_failed'));
    }
    expect([...outcomes].sort()).toEqual([false, true]);
  });

  it('refuses a decision already under way', () => {
    const state = applyOrders(createGame(tinyScenario, 1), [envoy]).state;
    expect(canIssue(state, 'envoy', 'importer')).toEqual({
      ok: false,
      reason: 'Already under way.',
    });
    const { events } = applyOrders(state, [envoy]);
    expect(events[0]).toMatchObject({ kind: 'order_rejected', reason: 'Already under way.' });
  });

  it('enforces cooldowns', () => {
    const issued = step(createGame(tinyScenario, 1), [insult]).state;
    expect(canIssue(issued, 'insult', 'importer')).toEqual({
      ok: false,
      reason: 'Available again in 4 days.',
    });
    expect(canIssue(run(issued, 4), 'insult', 'importer')).toEqual({ ok: true });
  });

  it('checks requirements and explains them', () => {
    let state = createGame(tinyScenario, 1);
    for (let i = 0; i < 20; i += 1) state = run(applyOrders(state, [envoy]).state, 4);
    expect(effectiveStat(state, treasuryRef)).toBe(0);
    expect(canIssue(state, 'envoy', 'importer')).toEqual({
      ok: false,
      reason: 'Needs 20 treasury.',
    });
  });

  it('rejects unknown decisions and other countries without throwing', () => {
    const game = createGame(tinyScenario, 1);
    expect(canIssue(game, 'nope', 'importer').ok).toBe(false);
    expect(canIssue(game, 'envoy', 'exporter').ok).toBe(false);
  });
});
