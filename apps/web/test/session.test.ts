import { loadBuiltInScenario } from '@ripple/content/node';
import { describe, expect, it } from 'vitest';
import { priceBand } from '../src/game/news';
import {
  devSetChokepoint,
  newSession,
  setPaused,
  tickSession,
  type Session,
} from '../src/game/session';
import { advanceSession } from '../src/game/session';

const scenario = loadBuiltInScenario('first-crisis');

function days(session: Session, count: number): Session {
  let current = session;
  for (let i = 0; i < count; i += 1) current = tickSession(current);
  return current;
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
    expect(days(newSession(scenario, 1), 60).dispatches).toEqual([]);
  });

  it('reports a strait closure and the price rises that follow, newest first', () => {
    const closed = devSetChokepoint(newSession(scenario, 1), 'south_strait', false);
    expect(closed.dispatches[0]!.headline).toBe('Corvan closes the South Strait');

    const later = days(closed, 30);
    const headlines = later.dispatches.map((d) => d.headline);
    expect(headlines.at(-1)).toBe('Corvan closes the South Strait');
    expect(headlines.some((h) => h.startsWith('Crude oil now'))).toBe(true);
    expect(headlines.some((h) => h.startsWith('Grain now'))).toBe(true);
    expect(headlines.some((h) => h.startsWith('Steel'))).toBe(false);
  });

  it('reports one dispatch per 10% band, not one per day', () => {
    const later = days(devSetChokepoint(newSession(scenario, 1), 'south_strait', false), 30);
    const oil = later.dispatches.filter((d) => d.headline.startsWith('Crude oil'));
    // 30 days take oil to +123%. Fast early moves can skip bands, so there are
    // at most 12 reports, far fewer than one per day.
    expect(oil.length).toBeGreaterThan(1);
    expect(oil.length).toBeLessThanOrEqual(12);
    // The newest report is the crossing into the 120-129% band.
    expect(oil[0]!.headline).toMatch(/^Crude oil now 12\d% above normal$/);
  });

  it('keeps a bounded price history for sparklines', () => {
    const later = days(newSession(scenario, 1), 200);
    expect(later.history.oil).toHaveLength(120);
  });

  it('only advances the world while running', () => {
    const paused = advanceSession(newSession(scenario, 1), 5_000);
    expect(paused.game.tick).toBe(0);
    const running = advanceSession(setPaused(newSession(scenario, 1), false), 1_000);
    expect(running.game.tick).toBe(0);
    expect(advanceSession(running, 1_000).game.tick).toBe(1);
  });
});
