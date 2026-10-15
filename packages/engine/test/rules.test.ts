import { describe, expect, it } from 'vitest';
import {
  applyEffect,
  createGame,
  effectiveStat,
  evaluate,
  relationId,
  type Condition,
} from '../src/index';
import { relationRef, tinyScenario, treasuryRef } from './fixtures';

const game = () => createGame(tinyScenario, 7);
const source = { kind: 'event' as const, id: 'test', tick: 0 };

describe('relations', () => {
  it('creates one relation per pair of countries, in either order', () => {
    expect(relationId('importer', 'exporter')).toBe('exporter__importer');
    expect(relationId('exporter', 'importer')).toBe('exporter__importer');
    expect(Object.keys(game().world.relations)).toEqual(['exporter__importer']);
    expect(effectiveStat(game(), relationRef)).toBe(-10);
  });
});

describe('conditions', () => {
  it('compares stats with exclusive bounds', () => {
    const below = (n: number): Condition => ({ type: 'stat', target: relationRef, below: n });
    expect(evaluate(game(), below(-9)).value).toBe(true);
    expect(evaluate(game(), below(-10)).value).toBe(false);
    expect(evaluate(game(), { type: 'stat', target: treasuryRef, above: 399 }).value).toBe(true);
  });

  it('combines with all, any and not', () => {
    const yes: Condition = { type: 'after_day', day: 0 };
    const no: Condition = { type: 'after_day', day: 5 };
    expect(evaluate(game(), { type: 'all', of: [yes, no] }).value).toBe(false);
    expect(evaluate(game(), { type: 'any', of: [no, yes] }).value).toBe(true);
    expect(evaluate(game(), { type: 'not', condition: no }).value).toBe(true);
  });

  it('checks chokepoints and flags', () => {
    expect(evaluate(game(), { type: 'chokepoint', id: 'strait', open: true }).value).toBe(true);
    expect(evaluate(game(), { type: 'flag', flag: 'x', set: false }).value).toBe(true);
    const flagged = applyEffect(game(), { type: 'set_flag', flag: 'x' }, source);
    expect(evaluate(flagged, { type: 'flag', flag: 'x', set: true }).value).toBe(true);
  });

  it('advances the random generator only when a chance is reached', () => {
    const start = game();
    const skipped = evaluate(start, {
      type: 'all',
      of: [
        { type: 'after_day', day: 99 },
        { type: 'chance', bp: 5_000 },
      ],
    });
    expect(skipped.state.rng).toBe(start.rng);
    const drawn = evaluate(start, { type: 'chance', bp: 5_000 });
    expect(drawn.state.rng).not.toBe(start.rng);
  });
});

describe('effects', () => {
  it('adjusts base values permanently', () => {
    const spent = applyEffect(game(), { type: 'adjust', target: treasuryRef, by: -40 }, source);
    expect(effectiveStat(spent, treasuryRef)).toBe(360);
    expect(spent.modifiers).toHaveLength(0);
  });

  it('adds modifiers that expire after the given days', () => {
    const modified = applyEffect(
      game(),
      { type: 'modify', target: relationRef, op: 'add', amount: 30, days: 20 },
      source,
    );
    expect(effectiveStat(modified, relationRef)).toBe(20);
    expect(modified.modifiers[0]!.expiresAt).toBe(20);
    expect(modified.modifiers[0]!.source).toEqual(source);
  });

  it('schedules events and rejects unknown ones', () => {
    const scheduled = applyEffect(
      game(),
      { type: 'schedule', event: 'strait_reopens', inDays: 10 },
      source,
    );
    expect(scheduled.scheduled).toEqual([{ dueTick: 10, event: 'strait_reopens', cause: source }]);
    expect(() =>
      applyEffect(game(), { type: 'schedule', event: 'nope', inDays: 1 }, source),
    ).toThrow(/nope/);
  });

  it('keeps flags sorted and unique', () => {
    let state = game();
    for (const flag of ['b', 'a', 'b']) {
      state = applyEffect(state, { type: 'set_flag', flag }, source);
    }
    expect(state.flags).toEqual(['a', 'b']);
    expect(applyEffect(state, { type: 'clear_flag', flag: 'a' }, source).flags).toEqual(['b']);
  });
});
