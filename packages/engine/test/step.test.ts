import { describe, expect, it } from 'vitest';
import { createGame, run, step } from '../src/index';
import { tinyScenario } from './fixtures';

describe('step', () => {
  it('advances exactly one tick', () => {
    const game = createGame(tinyScenario, 42);
    expect(step(game, []).state.tick).toBe(1);
  });

  it('does not mutate the input state', () => {
    const game = createGame(tinyScenario, 42);
    const snapshot = JSON.parse(JSON.stringify(game)) as typeof game;
    step(game, []);
    expect(game).toEqual(snapshot);
  });

  it('is deterministic: same seed and orders give the same world', () => {
    expect(run(createGame(tinyScenario, 42), 360)).toEqual(run(createGame(tinyScenario, 42), 360));
  });

  it('keeps the state plain, serializable data', () => {
    const state = run(createGame(tinyScenario, 42), 10);
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });

  it('rejects a scenario whose player country does not exist', () => {
    const broken = { ...tinyScenario, rules: { ...tinyScenario.rules, playerCountry: 'nowhere' } };
    expect(() => createGame(broken, 1)).toThrow(/nowhere/);
  });

  it('rejects duplicate ids', () => {
    const broken = {
      ...tinyScenario,
      resources: [...tinyScenario.resources, ...tinyScenario.resources],
    };
    expect(() => createGame(broken, 1)).toThrow(/Duplicate resource/);
  });
});
