import { loadBuiltInGuide, loadBuiltInScenario } from '@ripple/content/node';
import { createGame, setChokepointOpen, type ScenarioDef } from '@ripple/engine';
import { describe, expect, it } from 'vitest';
import { afterSigning, newAdvisor, updateAdvisor } from '../src/game/advisor';
import {
  dismissAdvice,
  issueDecision,
  newSession,
  tickSession,
  type Session,
} from '../src/game/session';

const scenario = loadBuiltInScenario('first-crisis');
const guide = loadBuiltInGuide('first-crisis', scenario);
/** No world events and no computer countries acting, for tests that need a predictable world. */
const { ai, ...withoutAi } = scenario;
void ai;
const quiet: ScenarioDef = { ...withoutAi, events: [] };

function days(session: Session, count: number): Session {
  let current = session;
  for (let i = 0; i < count; i += 1) current = tickSession(current);
  return current;
}

describe('advisor', () => {
  it('stays quiet while nothing needs attention', () => {
    const session = days(newSession(quiet, 1, true, guide.tips), 60);
    expect(session.advisor.current).toBeNull();
    expect(session.advisor.shown).toEqual([]);
  });

  it('speaks up about Corvan after the customs slight in the opening weeks', () => {
    let session = newSession(scenario, 4, true, guide.tips);
    while (!session.advisor.current && session.game.tick < 120) session = tickSession(session);
    expect(session.advisor.current?.id).toBe('corvan_slipping');
    expect(session.advisor.current?.country).toBe('corvan');
  });

  it('shows one tip at a time, and each tip only once per game', () => {
    const closed = { ...newSession(quiet, 1, true, guide.tips) };
    let session: Session = {
      ...closed,
      game: setChokepointOpen(closed.game, 'south_strait', false),
    };
    session = days(session, 1);
    expect(session.advisor.current?.id).toBe('strait_closed');

    // Oil climbs past 20% while the first tip is still on screen: it waits.
    session = days(session, 10);
    expect(session.advisor.current?.id).toBe('strait_closed');

    session = days(dismissAdvice(session), 1);
    expect(session.advisor.current?.id).toBe('oil_hurting');
    session = days(dismissAdvice(session), 30);
    expect(session.advisor.shown.filter((id) => id === 'strait_closed')).toHaveLength(1);
  });

  it('puts the tip away when the player signs one of its orders', () => {
    let session: Session = newSession(quiet, 1, true, guide.tips);
    session = { ...session, game: setChokepointOpen(session.game, 'south_strait', false) };
    session = days(session, 1);
    expect(session.advisor.current?.id).toBe('strait_closed');
    session = issueDecision(session, 'release_reserves');
    expect(session.advisor.current).toBeNull();
  });

  it('skips a tip while none of its orders can be signed', () => {
    const game = createGame(quiet, 1);
    const onlyLift = guide.tips.filter((t) => t.id === 'thessa_angry');
    // Thessa is angry, but no tariff is in force, so there is nothing to lift.
    const angry = {
      ...game,
      world: {
        ...game.world,
        relations: {
          ...game.world.relations,
          aldoria__thessa: { ...game.world.relations.aldoria__thessa!, stats: { value: -40 } },
        },
      },
    };
    expect(updateAdvisor(newAdvisor(onlyLift), angry).current).toBeNull();
  });

  it('ignores signing an order the tip did not suggest', () => {
    const advisor = { ...newAdvisor(guide.tips), current: guide.tips[0]! };
    expect(afterSigning(advisor, 'tariff', 'thessa')).toBe(advisor);
    // The first tip suggests an envoy to Corvan; one to Orrin is not that.
    expect(afterSigning(advisor, 'envoy', 'orrin')).toBe(advisor);
    expect(afterSigning(advisor, 'envoy', 'corvan').current).toBeNull();
  });

  it('never changes the game', () => {
    const plain = days(newSession(scenario, 4), 400);
    const advised = days(newSession(scenario, 4, true, guide.tips), 400);
    expect(advised.game).toEqual(plain.game);
  });
});
