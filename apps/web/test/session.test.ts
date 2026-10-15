import { loadBuiltInScenario } from '@ripple/content/node';
import { effectiveStat, setChokepointOpen, type ScenarioDef } from '@ripple/engine';
import { describe, expect, it } from 'vitest';
import { describeCosts, durationLabel, oddsLabel } from '../src/game/describe';
import { priceBand } from '../src/game/news';
import {
  advanceSession,
  issueDecision,
  newSession,
  setPaused,
  tickSession,
  type Session,
} from '../src/game/session';

const scenario = loadBuiltInScenario('first-crisis');
/** No world events, for tests that need a predictable world. */
const quiet: ScenarioDef = { ...scenario, events: [] };

function days(session: Session, count: number): Session {
  let current = session;
  for (let i = 0; i < count; i += 1) current = tickSession(current);
  return current;
}

function closeStrait(session: Session): Session {
  return { ...session, game: setChokepointOpen(session.game, 'south_strait', false) };
}

describe('price bands', () => {
  it('groups prices into 10% steps around the base', () => {
    expect(priceBand(7_300, 7_300)).toBe(0);
    expect(priceBand(8_000, 7_300)).toBe(0); // +9%
    expect(priceBand(8_100, 7_300)).toBe(1); // +10%
    expect(priceBand(16_283, 7_300)).toBe(12);
    expect(priceBand(6_500, 7_300)).toBe(-1); // -10%
  });
});

describe('session', () => {
  it('starts paused on day 0 with a quiet feed', () => {
    const session = newSession(scenario, 1);
    expect(session.clock.paused).toBe(true);
    expect(session.game.tick).toBe(0);
    expect(session.dispatches).toEqual([]);
  });

  it('stays quiet when nothing happens', () => {
    expect(days(newSession(quiet, 1), 60).dispatches).toEqual([]);
  });

  it('reports price rises after a closure, one dispatch per band crossed', () => {
    const later = days(closeStrait(newSession(quiet, 1)), 30);
    const oil = later.dispatches.filter((d) => d.headline.startsWith('Crude oil'));
    expect(oil.length).toBeGreaterThan(1);
    expect(oil.length).toBeLessThanOrEqual(12);
    expect(oil[0]!.headline).toMatch(/^Crude oil now 12\d% above normal$/);
    expect(later.dispatches.some((d) => d.headline.startsWith('Grain now'))).toBe(true);
    expect(later.dispatches.some((d) => d.headline.startsWith('Steel'))).toBe(false);
  });

  it('reports world events with their own headline and country', () => {
    // Seed 1 sees a fishing dispute with Corvan early on.
    let session = newSession(scenario, 1);
    while (!session.dispatches.some((d) => d.tag === 'Corvan') && session.game.tick < 400) {
      session = tickSession(session);
    }
    const corvan = session.dispatches.find((d) => d.tag === 'Corvan')!;
    expect(corvan.headline).toBe('Corvan protests Aldorian fishing boats near the strait');
    expect(corvan.severity).toBe('warning');
  });

  it('signs orders while paused: costs now, outcome later', () => {
    const session = issueDecision(newSession(quiet, 1), 'envoy_corvan');
    const influence = effectiveStat(session.game, {
      kind: 'country',
      id: 'aldoria',
      stat: 'influence',
    });
    expect(influence).toBe(30);
    expect(session.game.tick).toBe(0);
    expect(session.game.pending).toHaveLength(1);
    expect(session.dispatches[0]).toMatchObject({
      tag: 'Your orders',
      headline: 'Order signed: Send an envoy to Corvan',
      mine: true,
    });

    const later = days(session, 15);
    expect(later.game.pending).toHaveLength(0);
    const result = later.dispatches.find((d) => d.mine && !d.headline.startsWith('Order signed'))!;
    expect(['Talks in Corvan ease tensions', 'Talks in Corvan break down']).toContain(
      result.headline,
    );
    expect(later.tallies.ordersSigned).toBe(1);
    expect(later.tallies.ordersSucceeded + later.tallies.ordersFailed).toBe(1);
  });

  it('ignores orders that are not allowed', () => {
    const once = issueDecision(newSession(quiet, 1), 'envoy_corvan');
    expect(issueDecision(once, 'envoy_corvan')).toBe(once);
  });

  it('keeps a bounded price history for sparklines', () => {
    expect(days(newSession(quiet, 1), 200).history.oil).toHaveLength(120);
  });

  it('only advances the world while running, and stops at the end', () => {
    const paused = advanceSession(newSession(quiet, 1), 5_000);
    expect(paused.game.tick).toBe(0);
    const running = advanceSession(setPaused(newSession(quiet, 1), false), 1_000);
    expect(running.game.tick).toBe(0);
    expect(advanceSession(running, 1_000).game.tick).toBe(1);
  });

  it('pauses the clock and reports when the game ends', () => {
    // Seed 1, left alone, is ousted on day 278.
    let session = setPaused(newSession(scenario, 1), false);
    while (!session.game.outcome) session = tickSession(session);
    expect(session.game.outcome).toEqual({ result: 'ousted', tick: 278 });
    expect(session.clock.paused).toBe(true);
    expect(session.dispatches[0]!.headline).toBe('The government falls after weeks of unrest');
    expect(session.tallies.crises).toBeGreaterThan(0);
  });
});

describe('describing decisions', () => {
  const game = newSession(scenario, 1).game;

  it('lists what signing costs', () => {
    expect(describeCosts(game, game.defs.decisions.fuel_subsidy!)).toEqual(['40 bn']);
    expect(describeCosts(game, game.defs.decisions.envoy_corvan!)).toEqual(['8 influence']);
    expect(describeCosts(game, game.defs.decisions.steel_tariff!)).toEqual([]);
  });

  it('speaks in rough durations and odds', () => {
    expect(durationLabel(0)).toBe('Immediate');
    expect(durationLabel(14)).toBe('About 14 days');
    expect(durationLabel(120)).toBe('About 4 months');
    expect(oddsLabel(10_000)).toBeNull();
    expect(oddsLabel(6_000)).toBe('Good odds');
    expect(oddsLabel(5_500)).toBe('About even');
  });
});
