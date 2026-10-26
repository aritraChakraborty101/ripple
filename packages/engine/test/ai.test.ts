import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TUNING,
  NOTHING,
  bindDecision,
  canIssue,
  createGame,
  curveValue,
  goalNeed,
  mergeTuning,
  parseGoalId,
  rank,
  score,
  urgency,
  type GameState,
  type ScoreReport,
} from '../src/index';
import { aiScenario, crisisScenario } from './ai-fixtures';

const peace = (): GameState => createGame(aiScenario, 1);
/** The crisis, ten days after the fees were raised. */
const crisis = (): GameState => ({
  ...createGame(crisisScenario, 1),
  tick: 10,
  lastIssued: { 'strait:raise_fees': 0 },
});

const byOption = (reports: readonly ScoreReport[]) =>
  Object.fromEntries(reports.map((r) => [r.target ? `${r.decision}:${r.target}` : r.decision, r]));

describe('curves', () => {
  it('rises and falls along a straight line, in either direction, clamped', () => {
    const rises = { type: 'rises' as const, from: -20, to: -60 };
    expect(curveValue(rises, 0)).toBe(0);
    expect(curveValue(rises, -20)).toBe(0);
    expect(curveValue(rises, -45)).toBe(6_250);
    expect(curveValue(rises, -80)).toBe(10_000);
    expect(curveValue({ type: 'falls', from: 40, to: 90 }, 65)).toBe(5_000);
  });

  it('peaks in the middle and steps at a threshold', () => {
    const peaks = { type: 'peaks' as const, from: 0, peak: 50, to: 100 };
    expect([0, 25, 50, 75, 100].map((v) => curveValue(peaks, v))).toEqual([
      0, 5_000, 10_000, 5_000, 0,
    ]);
    expect(curveValue({ type: 'step', at: 1 }, 0)).toBe(0);
    expect(curveValue({ type: 'step', at: 1 }, 1)).toBe(10_000);
  });
});

describe('goals and needs', () => {
  it('parses goal IDs and rejects malformed ones', () => {
    expect(parseGoalId('wealth')).toEqual({ kind: 'wealth' });
    expect(parseGoalId('ties(thessa)')).toEqual({ kind: 'ties', arg: 'thessa' });
    expect(parseGoalId('ties')).toBeNull();
    expect(parseGoalId('wealth(oil)')).toBeNull();
    expect(parseGoalId('glory')).toBeNull();
  });

  it('measures need as the gap to the aspiration, from 0 to 10000', () => {
    const state = peace();
    expect(goalNeed(state, 'strait', { id: 'wealth', weight: 35, aspire: 250 })).toBe(6_400);
    expect(goalNeed(state, 'strait', { id: 'ties(patron)', weight: 20, aspire: 60 })).toBe(5_833);
    expect(goalNeed(state, 'strait', { id: 'wealth', weight: 35, aspire: 50 })).toBe(0);
  });

  it('grows grievance as relations sour, and security with stronger countries only', () => {
    expect(goalNeed(peace(), 'strait', { id: 'grievance(home)', weight: 30 })).toBe(1_666);
    expect(goalNeed(crisis(), 'strait', { id: 'grievance(home)', weight: 30 })).toBe(7_500);
    // Home is stronger than strait, and relations are -45: insecure.
    expect(goalNeed(crisis(), 'strait', { id: 'security', weight: 10 })).toBe(7_500);
    // Nobody is stronger than patron.
    expect(goalNeed(crisis(), 'patron', { id: 'security', weight: 10 })).toBe(0);
  });
});

describe('templates', () => {
  it('binds self and target in costs, considerations and goals', () => {
    const court = aiScenario.decisions.find((d) => d.id === 'court')!;
    const bound = bindDecision(court, 'strait', 'patron');
    expect(bound.drives).toEqual({ 'ties(patron)': 2, standing: 1 });
    expect(bound.costs[0]).toMatchObject({ target: { kind: 'country', id: 'strait' } });
    expect(bound.consider![0]!.measure).toEqual({
      kind: 'relation',
      between: ['strait', 'patron'],
    });
  });
});

describe('who may sign what', () => {
  it('keeps player orders for the player and computer orders for their countries', () => {
    const state = peace();
    expect(canIssue(state, 'player_only', 'home')).toEqual({ ok: true });
    expect(canIssue(state, 'player_only', 'strait')).toMatchObject({ ok: false });
    expect(canIssue(state, 'raise_fees', 'strait')).toEqual({ ok: true });
    expect(canIssue(state, 'raise_fees', 'patron')).toMatchObject({ ok: false });
    expect(canIssue(state, 'raise_fees', 'home')).toEqual({
      ok: false,
      reason: 'That order is not yours to give.',
    });
  });
});

describe('the clearing house: worked examples from the design note', () => {
  it('peacetime: the poor transit state still wants to act, mostly to raise fees', () => {
    const options = byOption(rank(peace(), 'strait'));
    expect(options.raise_fees!.score).toBe(10_080); // 52.5 x 0.64 x 3 = 100.8
    expect(options['court:patron']!.score).toBe(3_233); // 20 x 0.58 x 2 + 15 x 0.6 = 32.3
    expect(options.detain!.score).toBe(1_399); // 30 x 0.17 + 9 = 14
    expect(options.close!.score).toBeLessThan(0); // lost fees outweigh the grudge
    expect(options[NOTHING]!.score).toBe(2_500);
    expect(rank(peace(), 'strait')[0]!.decision).toBe('raise_fees');
    expect(urgency(peace(), 'strait')).toBe(7_580);
  });

  it('crisis: with a grudge and a fuller treasury, closing the strait comes first', () => {
    const options = byOption(rank(crisis(), 'strait'));
    expect(options.close!.score).toBe(7_380); // 30 x 0.75 x 4 + 9 - 52.5 x 0.24 x 2 = 73.8
    expect(options.detain!.score).toBe(3_150);
    expect(options['court:patron']!.score).toBe(2_233);
    expect(options.raise_fees!.available).toBe(false);
    expect(options.raise_fees!.reason).toBe('Available again in 20 days.');
    const best = rank(crisis(), 'strait')[0]!;
    expect(best.decision).toBe('close');
  });

  it('explains every score with its parts', () => {
    const report = score(peace(), { country: 'strait', decision: 'raise_fees' });
    expect(report.ambition).toBe('strait_pays');
    expect(report.goals).toEqual([
      { goal: 'wealth', weight: 5_250, need: 6_400, drive: 3, part: 10_080 },
    ]);
    expect(report.value).toBe(10_080);
    expect(report.appealTotal).toBe(10_000);
    const court = score(peace(), { country: 'strait', decision: 'court', target: 'patron' });
    expect(court.appeal).toEqual([
      {
        measure: 'relation(strait, patron)',
        value: 25,
        curve: 'falls from 40 to 90',
        factor: 10_000,
      },
    ]);
  });

  it('ranks available options first, best first, with doing nothing among them', () => {
    const ranking = rank(crisis(), 'strait');
    const firstUnavailable = ranking.findIndex((r) => !r.available);
    expect(ranking.slice(firstUnavailable).every((r) => !r.available)).toBe(true);
    const available = ranking.slice(0, firstUnavailable).map((r) => r.score);
    expect(available).toEqual([...available].sort((a, b) => b - a));
    expect(ranking.some((r) => r.decision === NOTHING)).toBe(true);
  });

  it('never changes the game when asked', () => {
    const state = crisis();
    const before = JSON.stringify(state);
    rank(state, 'strait');
    urgency(state, 'patron');
    expect(JSON.stringify(state)).toBe(before);
  });
});

describe('ambitions', () => {
  it('stop boosting a goal once met', () => {
    const rich = createGame(
      {
        ...aiScenario,
        countries: aiScenario.countries.map((c) =>
          c.id === 'strait' ? { ...c, stats: { ...c.stats, treasury: 260 } } : c,
        ),
      },
      1,
    );
    const report = score(rich, { country: 'strait', decision: 'raise_fees' });
    expect(report.ambition).toBeUndefined();
    expect(report.score).toBe(0); // no need for money left
  });
});

describe('tuning', () => {
  it('merges layers, per country and per action key by key', () => {
    const merged = mergeTuning(
      DEFAULT_TUNING,
      { inertia: 1_000, actions: { close: { enabled: false } } },
      {
        actions: { close: { scoreMultiplier: 5_000 } },
        countries: { strait: { weights: { wealth: 10 } } },
      },
    );
    expect(merged.inertia).toBe(1_000);
    expect(merged.hostility).toBe(10_000);
    expect(merged.actions.close).toEqual({ enabled: false, scoreMultiplier: 5_000 });
    expect(merged.countries.strait!.weights).toEqual({ wealth: 10 });
  });

  it('applies the chosen profile and test overrides when a game starts', () => {
    expect(createGame(aiScenario, 1).defs.ai!.tuning.inertia).toBe(2_500);
    const aggressive = createGame(aiScenario, 1, { aiProfile: 'aggressive' });
    expect(aggressive.defs.ai!.tuning.inertia).toBe(1_500);
    expect(
      createGame(aiScenario, 1, { aiProfile: 'aggressive', tuning: { inertia: 9 } }).defs.ai!.tuning
        .inertia,
    ).toBe(9);
    expect(() => createGame(aiScenario, 1, { aiProfile: 'nope' })).toThrow('Unknown AI profile');
  });

  it('turns hostility up or down without touching the personality', () => {
    const angry = {
      ...crisis(),
      defs: {
        ...crisis().defs,
        ai: { ...crisis().defs.ai!, tuning: mergeTuning(DEFAULT_TUNING, { hostility: 15_000 }) },
      },
    };
    expect(score(angry, { country: 'strait', decision: 'close' }).score).toBeGreaterThan(
      score(crisis(), { country: 'strait', decision: 'close' }).score,
    );
  });

  it('can switch an action off or scale it', () => {
    const tuned = (actions: Record<string, { enabled?: boolean; scoreMultiplier?: number }>) => ({
      ...crisis(),
      defs: {
        ...crisis().defs,
        ai: { ...crisis().defs.ai!, tuning: mergeTuning(DEFAULT_TUNING, { actions }) },
      },
    });
    const off = score(tuned({ close: { enabled: false } }), {
      country: 'strait',
      decision: 'close',
    });
    expect(off).toMatchObject({ available: false, reason: 'Switched off by tuning.' });
    const half = score(tuned({ close: { scoreMultiplier: 5_000 } }), {
      country: 'strait',
      decision: 'close',
    });
    expect(half.score).toBe(3_690);
  });

  it('compensates for the number of considerations', () => {
    const withChecks = (compensation: boolean) => {
      const state = crisis();
      const court = state.defs.decisions.court!;
      const half = {
        measure: { kind: 'relation' as const, between: ['self', 'target'] as const },
        curve: { type: 'falls' as const, from: 15, to: 65 },
      };
      return {
        ...state,
        defs: {
          ...state.defs,
          decisions: { ...state.defs.decisions, court: { ...court, consider: [half, half, half] } },
          ai: { ...state.defs.ai!, tuning: mergeTuning(DEFAULT_TUNING, { compensation }) },
        },
      };
    };
    // Relation 40 sits halfway down each curve: three factors of 0.5.
    const plain = score(withChecks(false), {
      country: 'strait',
      decision: 'court',
      target: 'patron',
    });
    const compensated = score(withChecks(true), {
      country: 'strait',
      decision: 'court',
      target: 'patron',
    });
    expect(plain.appealTotal).toBe(1_250); // 0.5 x 0.5 x 0.5
    expect(compensated.appealTotal).toBeGreaterThan(plain.appealTotal);
    expect(compensated.appealTotal).toBeLessThan(5_000);
  });
});
