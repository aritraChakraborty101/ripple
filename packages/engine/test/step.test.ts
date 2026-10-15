import { describe, expect, it } from 'vitest';
import { createGame, run, step } from '../src/index';

describe('step', () => {
  it('advances exactly one tick', () => {
    const game = createGame(42);
    expect(step(game, []).state.tick).toBe(1);
  });

  it('does not mutate the input state', () => {
    const game = createGame(42);
    const snapshot = JSON.parse(JSON.stringify(game)) as typeof game;
    step(game, []);
    expect(game).toEqual(snapshot);
  });

  it('is deterministic: same seed and orders give the same world', () => {
    expect(run(createGame(42), 365)).toEqual(run(createGame(42), 365));
  });

  it('keeps the state plain, serializable data', () => {
    const state = run(createGame(42), 10);
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });
});
