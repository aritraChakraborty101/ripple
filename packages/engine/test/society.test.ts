import { describe, expect, it } from 'vitest';
import {
  addModifier,
  createGame,
  effectiveStat,
  pricePressure,
  run,
  setChokepointOpen,
  statBreakdown,
  step,
  type ScenarioDef,
} from '../src/index';
import { stabilityRef, tinyScenario } from './fixtures';

const satisfaction = { kind: 'faction' as const, id: 'importer_workers', stat: 'satisfaction' };

describe('society', () => {
  it('feels nothing while prices are normal', () => {
    const calm = run(createGame(tinyScenario, 1), 30);
    expect(pricePressure(calm, 'importer_workers')).toBe(0);
    expect(effectiveStat(calm, satisfaction)).toBe(55);
    expect(effectiveStat(calm, stabilityRef)).toBe(60);
  });

  it('turns dear oil into lower satisfaction and lower stability', () => {
    const crisis = run(setChokepointOpen(createGame(tinyScenario, 1), 'strait', false), 30);
    expect(pricePressure(crisis, 'importer_workers')).toBeGreaterThan(100);
    expect(effectiveStat(crisis, satisfaction)).toBeLessThan(55);
    expect(effectiveStat(crisis, stabilityRef)).toBeLessThan(60);
  });

  it('explains the stability drop through modifiers', () => {
    const crisis = run(setChokepointOpen(createGame(tinyScenario, 1), 'strait', false), 30);
    const stability = statBreakdown(crisis, stabilityRef);
    expect(stability.modifiers.map((m) => m.source.id)).toEqual(['faction_mood']);
    const mood = statBreakdown(crisis, satisfaction);
    expect(mood.modifiers.map((m) => m.source.id)).toEqual(['cost_of_living']);
  });

  it('keeps one system modifier per stat instead of stacking them', () => {
    const crisis = run(setChokepointOpen(createGame(tinyScenario, 1), 'strait', false), 60);
    const systemModifiers = crisis.modifiers.filter((m) => m.source.kind === 'system');
    expect(systemModifiers).toHaveLength(2);
  });

  it('caps the goodwill from cheap prices', () => {
    const cheap = addModifier(createGame(tinyScenario, 1), {
      target: { kind: 'resource', id: 'oil', stat: 'price' },
      op: 'pct',
      amount: -5_000,
      source: { kind: 'event', id: 'glut', tick: 0 },
      expiresAt: null,
    });
    expect(effectiveStat(step(cheap, []).state, satisfaction)).toBe(60);
  });
});

describe('outcome', () => {
  it('ousts the leader after 30 days below the threshold', () => {
    const fragile: ScenarioDef = {
      ...tinyScenario,
      countries: tinyScenario.countries.map((c) =>
        c.id === 'importer' ? { ...c, stats: { ...c.stats, stability: 19 } } : c,
      ),
    };
    let state = createGame(fragile, 1);
    for (let i = 0; i < 29; i += 1) state = step(state, []).state;
    expect(state.outcome).toBeNull();
    expect(state.lowStabilityTicks).toBe(29);
    const last = step(state, []);
    expect(last.state.outcome).toEqual({ result: 'ousted', tick: 29 });
    expect(last.events).toContainEqual({ kind: 'game_over', tick: 29, result: 'ousted' });
  });

  it('stops the world once the game is over', () => {
    const fragile: ScenarioDef = {
      ...tinyScenario,
      countries: tinyScenario.countries.map((c) =>
        c.id === 'importer' ? { ...c, stats: { ...c.stats, stability: 0 } } : c,
      ),
    };
    const over = run(createGame(fragile, 1), 40);
    expect(over.outcome?.result).toBe('ousted');
    expect(over.tick).toBe(30);
    expect(step(over, []).state).toBe(over);
  });

  it('declares survival at the end of the term', () => {
    const short: ScenarioDef = {
      ...tinyScenario,
      rules: { ...tinyScenario.rules, lengthYears: 1 },
    };
    const done = run(createGame(short, 1), 400);
    expect(done.outcome).toEqual({ result: 'survived', tick: 359 });
    expect(done.tick).toBe(360);
  });
});
