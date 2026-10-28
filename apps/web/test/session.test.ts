import { loadBuiltInScenario } from '@ripple/content/node';
import { effectiveStat, setChokepointOpen, type ScenarioDef } from '@ripple/engine';
import { describe, expect, it } from 'vitest';
import { decisionsConcerning, describeCosts, durationLabel, oddsLabel } from '../src/game/describe';
import { priceBand } from '../src/game/news';
import {
  advanceSession,
  dismissAlert,
  issueDecision,
  newSession,
  setPaused,
  tickSession,
  type Session,
} from '../src/game/session';

const scenario = loadBuiltInScenario('first-crisis');
/** No world events and no computer countries acting, for tests that need a predictable world. */
const { ai, ...withoutAi } = scenario;
void ai;
const quiet: ScenarioDef = { ...withoutAi, events: [] };

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

  it('reports a month that ends in deficit, naming the dearest import', () => {
    const later = days(closeStrait(newSession(quiet, 1)), 30);
    const deficit = later.dispatches.find((d) => d.headline.startsWith('The month ends'));
    expect(deficit).toMatchObject({ tag: 'Home', tick: 29 });
    expect(deficit!.headline).toMatch(/^The month ends [\d.]+ bn in deficit$/);
    expect(deficit!.detail).toMatch(/crude oil the most\.$/);
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
    // Every game opens with Corvan tightening customs checks in the first weeks.
    let session = newSession(scenario, 1);
    while (!session.dispatches.some((d) => d.tag === 'Corvan') && session.game.tick < 400) {
      session = tickSession(session);
    }
    const corvan = session.dispatches.find((d) => d.tag === 'Corvan')!;
    expect(corvan.headline).toBe('Corvan tightens customs checks on Aldorian ships');
    expect(corvan.severity).toBe('warning');
  });

  it('signs orders while paused: costs now, outcome later', () => {
    const session = issueDecision(newSession(quiet, 1), 'envoy', 'corvan');
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
      source: 'order',
    });

    const later = days(session, 15);
    expect(later.game.pending).toHaveLength(0);
    const result = later.dispatches.find(
      (d) => d.source === 'order' && !d.headline.startsWith('Order signed'),
    )!;
    expect(['Talks in Corvan ease tensions', 'Talks in Corvan break down']).toContain(
      result.headline,
    );
    expect(later.tallies.ordersSigned).toBe(1);
    expect(later.tallies.ordersSucceeded + later.tallies.ordersFailed).toBe(1);
  });

  it('ignores orders that are not allowed', () => {
    const once = issueDecision(newSession(quiet, 1), 'envoy', 'corvan');
    expect(issueDecision(once, 'envoy', 'corvan')).toBe(once);
    // An order aimed at a country needs its target.
    expect(issueDecision(once, 'envoy')).toBe(once);
  });

  it('keeps an envoy to one country from holding up an envoy to another', () => {
    const once = issueDecision(newSession(quiet, 1), 'envoy', 'corvan');
    const twice = issueDecision(once, 'envoy', 'orrin');
    expect(twice.game.pending.map((p) => p.target)).toEqual(['corvan', 'orrin']);
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
    // Seed 3, left alone, is ousted on day 492.
    let session = setPaused(newSession(scenario, 3), false);
    while (!session.game.outcome) session = tickSession(session);
    expect(session.game.outcome).toEqual({ result: 'ousted', tick: 492 });
    expect(session.clock.paused).toBe(true);
    expect(session.dispatches[0]!.headline).toBe('The government falls after weeks of unrest');
    expect(session.tallies.crises).toBeGreaterThan(0);
  });
});

describe('describing decisions', () => {
  const game = newSession(scenario, 1).game;

  it('lists what signing costs', () => {
    expect(describeCosts(game, game.defs.decisions.transit_fees!)).toEqual(['30 bn']);
    expect(describeCosts(game, game.defs.decisions.envoy!)).toEqual(['8 influence']);
    expect(describeCosts(game, game.defs.decisions.tariff!)).toEqual([]);
    expect(describeCosts(game, game.defs.decisions.fuel_subsidy!)).toEqual([
      '13 bn a month for 3 months',
    ]);
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

describe('crisis alerts', () => {
  /** Run seed 4 until its first critical world event (the strait closes). */
  function untilAlert(session: Session): Session {
    let current = setPaused(session, false);
    while (!current.alert && !current.game.outcome) current = tickSession(current);
    return current;
  }

  it('raises an alert for a critical world event and pauses the clock', () => {
    const session = untilAlert(newSession(scenario, 4));
    expect(session.alert).toMatchObject({
      source: 'world',
      severity: 'critical',
      country: 'corvan',
      headline: 'Corvan closes the South Strait to shipping',
    });
    expect(session.clock.paused).toBe(true);
  });

  it('keeps running when auto-pause is off', () => {
    const session = untilAlert(newSession(scenario, 4, false));
    expect(session.alert).not.toBeNull();
    expect(session.clock.paused).toBe(false);
  });

  it('stops simulating the rest of a fast frame once a crisis pauses the clock', () => {
    let session = setPaused(newSession(scenario, 4), false);
    // Advance in big real-time steps until the crisis lands mid-frame.
    while (!session.alert) session = advanceSession(session, 1_000);
    const day = session.game.tick;
    expect(advanceSession(session, 1_000).game.tick).toBe(day);
  });

  it('clears the alert when dismissed', () => {
    const session = untilAlert(newSession(scenario, 4));
    expect(dismissAlert(session).alert).toBeNull();
  });

  it('does not raise alerts for market news or orders', () => {
    const later = days(
      {
        ...newSession(quiet, 1),
        game: setChokepointOpen(newSession(quiet, 1).game, 'south_strait', false),
      },
      30,
    );
    expect(later.dispatches.some((d) => d.severity === 'critical')).toBe(true);
    expect(later.alert).toBeNull();
  });
});

describe('orders concerning a country', () => {
  const game = newSession(scenario, 1).game;
  const ids = (country: string) =>
    decisionsConcerning(game, country).map((c) =>
      c.target ? `${c.def.id}>${c.target}` : c.def.id,
    );

  it('finds the orders aimed at each country, or touching relations or routes with it', () => {
    expect(ids('corvan')).toEqual(['envoy>corvan', 'transit_fees']);
    expect(ids('thessa')).toEqual(['envoy>thessa', 'lift_tariff>thessa', 'tariff>thessa']);
    expect(ids('veskar')).toEqual(['envoy>veskar', 'overland_pipeline', 'veskar_discount']);
    expect(ids('orrin')).toEqual(['envoy>orrin']);
  });

  it('lists nothing for the player country, since almost everything touches it', () => {
    expect(ids('aldoria')).toEqual([]);
  });
});
