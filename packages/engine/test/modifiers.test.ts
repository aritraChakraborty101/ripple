import { describe, expect, it } from 'vitest';
import {
  addModifier,
  createGame,
  effectiveStat,
  run,
  statBreakdown,
  type StatRef,
} from '../src/index';
import { tinyScenario } from './fixtures';

const stability: StatRef = { kind: 'country', id: 'importer', stat: 'stability' };

describe('modifiers', () => {
  it('returns the base value when there are no modifiers', () => {
    const game = createGame(tinyScenario, 1);
    expect(effectiveStat(game, stability)).toBe(60);
  });

  it('applies flat amounts, then percentages', () => {
    let game = createGame(tinyScenario, 1);
    game = addModifier(game, {
      target: stability,
      op: 'add',
      amount: -6,
      source: { kind: 'event', id: 'fuel_costs', tick: 0 },
      expiresAt: null,
    });
    game = addModifier(game, {
      target: stability,
      op: 'pct',
      amount: -1_000,
      source: { kind: 'event', id: 'strike_threat', tick: 0 },
      expiresAt: null,
    });
    // (60 - 6) * 0.9 = 48.6, truncated to 48
    expect(effectiveStat(game, stability)).toBe(48);
  });

  it('records every contribution for the why-trace', () => {
    const game = addModifier(createGame(tinyScenario, 1), {
      target: stability,
      op: 'add',
      amount: -6,
      source: { kind: 'event', id: 'fuel_costs', tick: 3 },
      expiresAt: 63,
    });
    const breakdown = statBreakdown(game, stability);
    expect(breakdown.base).toBe(60);
    expect(breakdown.value).toBe(54);
    expect(breakdown.modifiers).toHaveLength(1);
    expect(breakdown.modifiers[0]!.source).toEqual({ kind: 'event', id: 'fuel_costs', tick: 3 });
  });

  it('only affects the stat it targets', () => {
    const game = addModifier(createGame(tinyScenario, 1), {
      target: stability,
      op: 'add',
      amount: -6,
      source: { kind: 'event', id: 'x', tick: 0 },
      expiresAt: null,
    });
    expect(effectiveStat(game, { kind: 'country', id: 'exporter', stat: 'stability' })).toBe(60);
    expect(effectiveStat(game, { kind: 'country', id: 'importer', stat: 'treasury' })).toBe(400);
  });

  it('treats a stat the entity does not have as zero, so content can add new stats', () => {
    const game = createGame(tinyScenario, 1);
    expect(effectiveStat(game, { kind: 'country', id: 'importer', stat: 'food_security' })).toBe(0);
  });

  it('expires at the start of its expiry tick and emits an event', () => {
    const game = addModifier(createGame(tinyScenario, 1), {
      target: stability,
      op: 'add',
      amount: -6,
      source: { kind: 'event', id: 'fuel_costs', tick: 0 },
      expiresAt: 5,
    });
    expect(effectiveStat(run(game, 5), stability)).toBe(54);
    expect(effectiveStat(run(game, 6), stability)).toBe(60);
  });

  it('rejects modifiers on unknown entities and non-integer amounts', () => {
    const game = createGame(tinyScenario, 1);
    const source = { kind: 'event' as const, id: 'x', tick: 0 };
    expect(() =>
      addModifier(game, {
        target: { kind: 'country', id: 'atlantis', stat: 'stability' },
        op: 'add',
        amount: 1,
        source,
        expiresAt: null,
      }),
    ).toThrow(/atlantis/);
    expect(() =>
      addModifier(game, { target: stability, op: 'add', amount: 1.5, source, expiresAt: null }),
    ).toThrow(/integers/);
  });
});
