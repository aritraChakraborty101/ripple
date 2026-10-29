import { loadBuiltInScenario } from '@ripple/content/node';
import { describe, expect, it } from 'vitest';
import {
  ambitionOf,
  brewing,
  brewingKey,
  hasFile,
  needWord,
  REWARN_DAYS,
  wantsOf,
} from '../src/game/intel';
import {
  issueDecision,
  newSession,
  retuneSession,
  tickSession,
  type Session,
} from '../src/game/session';

const scenario = loadBuiltInScenario('first-crisis');

function playTo(session: Session, tick: number): Session {
  let current = session;
  while (current.game.tick < tick && !current.game.outcome) current = tickSession(current);
  return current;
}

describe('what countries want', () => {
  const game = newSession(scenario, 3).game;

  it('shows a poor Corvan wanting money, and its ambition with progress', () => {
    const wants = wantsOf(game, 'corvan');
    expect(wants[0]!.label).toBe('money');
    expect(needWord(wants[0]!.need)).toBe('somewhat');
    expect(ambitionOf(game, 'corvan')).toEqual({
      name: 'Make the strait pay',
      current: 90,
      target: 250,
    });
  });

  it('has nothing to say about the player', () => {
    expect(wantsOf(game, 'aldoria')).toEqual([]);
    expect(ambitionOf(game, 'aldoria')).toBeNull();
  });
});

describe('intelligence', () => {
  it('is quiet in the calm opening', () => {
    expect(brewing(newSession(scenario, 3).game)).toEqual([]);
  });

  it('warns before Corvan closes the strait in the golden game', () => {
    // Seed 5, the golden game: Corvan closes the strait on day 176.
    const session = playTo(newSession(scenario, 5), 176);
    const warnings = session.dispatches.filter((d) => d.source === 'intel');
    expect(warnings.some((d) => d.headline === 'Corvan is weighing: Close the South Strait')).toBe(
      true,
    );
    const warning = warnings.find((d) => d.headline.endsWith('Close the South Strait'))!;
    expect(warning.tag).toBe('Intelligence');
    expect(warning.country).toBe('corvan');
    expect(warning.detail).toMatch(/^Driven by a grudge against Aldoria/);
  });

  it('does not repeat a warning within the waiting period', () => {
    const session = playTo(newSession(scenario, 5), 230);
    const byKey = new Map<string, number[]>();
    for (const d of session.dispatches.filter((x) => x.source === 'intel')) {
      byKey.set(d.headline, [...(byKey.get(d.headline) ?? []), d.tick]);
    }
    for (const ticks of byKey.values()) {
      const sorted = [...ticks].sort((a, b) => a - b);
      for (let i = 1; i < sorted.length; i += 1) {
        expect(sorted[i]! - sorted[i - 1]!).toBeGreaterThanOrEqual(REWARN_DAYS);
      }
    }
    expect(Object.keys(session.warned).length).toBeGreaterThan(0);
  });

  it('identifies each warning by country, move and target', () => {
    expect(
      brewingKey({
        country: 'corvan',
        decision: 'denounce_aldoria',
        target: 'aldoria',
        name: '',
        score: 0,
        inertia: 0,
        motive: null,
      }),
    ).toBe('corvan:denounce_aldoria:aldoria');
  });
});

describe('tuning from the browser', () => {
  it('starts a game with a chosen profile', () => {
    expect(
      newSession(scenario, 1, true, [], { aiProfile: 'aggressive' }).game.defs.ai!.tuning.inertia,
    ).toBe(1_500);
  });

  it('retunes mid-game and records the change', () => {
    const session = retuneSession(playTo(newSession(scenario, 1), 5), { hostility: 20_000 });
    expect(session.game.defs.ai!.tuning.hostility).toBe(20_000);
    expect(session.game.tuningChanges).toEqual([{ tick: 5, overrides: { hostility: 20_000 } }]);
  });
});

describe('intelligence files', () => {
  it('warn earlier about a watched country, and only while the file is open', () => {
    // Look for a day when Corvan is weighing a harmful move too faintly to report,
    // and check that the same day with a file open on Corvan reports it.
    let session = newSession(scenario, 3);
    let found = false;
    for (let day = 0; day < 400 && !found; day += 1) {
      const plain = tickSession(session);
      const filed = tickSession(issueDecision(session, 'intel_file', 'corvan'));
      const warns = (s: Session) => brewing(s.game).some((b) => b.country === 'corvan');
      if (hasFile(filed.game, 'corvan') && !warns(plain) && warns(filed)) found = true;
      session = plain;
    }
    expect(found).toBe(true);
    expect(hasFile(session.game, 'corvan')).toBe(false);
  });
});
