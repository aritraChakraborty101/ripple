import { describe, expect, it } from 'vitest';
import {
  createGame,
  dailyChance,
  effectiveStat,
  explainChoice,
  isFree,
  notice,
  planOrders,
  run,
  step,
  type GameState,
} from '../src/index';
import { aiScenario, homeStraitRef, straitTreasuryRef } from './ai-fixtures';

const game = (tuning = {}) => createGame(aiScenario, 1, { tuning });

/** Let `days` pass with the player doing nothing. */
const days = (state: GameState, n: number) => run(state, n);

describe('the planner', () => {
  it('lets computer countries act on their own in a calm world', () => {
    const later = days(game(), 60);
    const strait = later.trace.choices.filter((c) => c.country === 'strait');
    expect(strait.length).toBeGreaterThan(0);
    expect(strait[0]!.decision).toBe('raise_fees');
    // Their orders really happen: fees fill the treasury and sour relations with home.
    expect(effectiveStat(later, straitTreasuryRef)).toBeGreaterThan(90);
    expect(effectiveStat(later, homeStraitRef)).toBeLessThan(-10);
  });

  it('plays out identically from the same seed', () => {
    expect(days(game(), 90)).toEqual(days(game(), 90));
  });

  it('signs templates against a target, and the effect reaches that country', () => {
    const later = days(game(), 120);
    const courting = later.trace.choices.find((c) => c.decision === 'court');
    expect(courting).toBeDefined();
    expect(courting!.target).toBeDefined();
    expect(
      later.modifiers.some((m) => m.source.id === 'court' && m.source.by === courting!.country),
    ).toBe(true);
  });

  it('records why each choice was made, with the stats behind it explained', () => {
    const later = days(game(), 60);
    const first = later.trace.choices.find((c) => c.decision === 'raise_fees')!;
    expect(first.ambition).toBe('strait_pays');
    expect(first.goals[0]).toMatchObject({ goal: 'wealth', drive: 3 });
    expect(first.because[0]).toMatchObject({ type: 'stat', ref: straitTreasuryRef });
    expect(explainChoice(later, 'raise_fees', first.tick, 'strait')).toBe(first);
  });

  it('acts at most once, then rests', () => {
    const later = days(game({ restDays: 20 }), 120);
    const ticks = later.trace.choices.filter((c) => c.country === 'strait').map((c) => c.tick);
    for (let i = 1; i < ticks.length; i += 1)
      expect(ticks[i]! - ticks[i - 1]!).toBeGreaterThanOrEqual(20);
  });

  it('does nothing when nothing beats inertia, without drawing randomness', () => {
    const calm = game({ inertia: 1_000_000 });
    const planned = planOrders(calm);
    expect(planned.orders).toEqual([]);
    expect(planned.state).toBe(calm);
  });

  it('always picks the best option at temperature 0', () => {
    const later = days(game({ temperature: 0, attention: 10_000, maxDailyChance: 10_000 }), 1);
    const first = later.trace.choices.find((c) => c.country === 'strait')!;
    expect(first.decision).toBe('raise_fees');
    expect(first.runnerUp?.decision).toBe('court');
  });
});

describe('attention', () => {
  it('turns urgency into a daily chance, boosted while noticing, capped', () => {
    const state = game();
    expect(dailyChance(state, 'strait', 7_580)).toBe(1_516); // 75.8 points x 0.2%
    const noticing = { ...state, attention: { strait: { lastActed: null, noticeUntil: 5 } } };
    expect(dailyChance(noticing, 'strait', 7_580)).toBe(4_548);
    expect(dailyChance(noticing, 'strait', 70_000)).toBe(5_000);
  });

  it('is busy while an order is under way, and free again after resting', () => {
    const state = game();
    expect(isFree(state, 'strait')).toBe(true);
    const rested = { ...state, tick: 10, attention: { strait: { lastActed: 8, noticeUntil: 0 } } };
    expect(isFree(rested, 'strait')).toBe(false);
    expect(isFree({ ...rested, tick: 13 }, 'strait')).toBe(true);
  });

  it('notices when one of its relations moves sharply', () => {
    const before = game();
    const insulted = step(before, []).state; // a quiet day changes nothing much
    const after = {
      ...before,
      world: {
        ...before.world,
        relations: {
          ...before.world.relations,
          home__strait: { ...before.world.relations.home__strait!, stats: { value: -30 } },
        },
      },
    };
    const noticed = notice(before, after, []);
    expect(noticed.attention.strait?.noticeUntil).toBe(before.tick + 7);
    expect(noticed.attention.patron).toBeUndefined();
    expect(insulted.tick).toBe(1);
  });
});
