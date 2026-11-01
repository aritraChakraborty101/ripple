import { loadBuiltInScenario } from '@ripple/content/node';
import { createGame, setChokepointOpen } from '@ripple/engine';
import { describe, expect, it } from 'vitest';
import type { Dispatch } from '../src/game/news';
import { addRipples, MAX_RIPPLES, ripplesFor } from '../src/game/ripples';

const game = createGame(loadBuiltInScenario('first-crisis'), 1);

const dispatch = (over: Partial<Dispatch>): Dispatch => ({
  id: 'd',
  tick: 0,
  tag: 'Corvan',
  severity: 'info',
  headline: 'Something happens',
  source: 'world',
  ...over,
});

describe('ripples', () => {
  it('spreads from a chokepoint when it closes, and again when it reopens', () => {
    const closed = setChokepointOpen(game, 'south_strait', false);
    expect(ripplesFor(game, closed, [])).toEqual([
      { at: { kind: 'chokepoint', id: 'south_strait' }, tone: 'threat' },
    ]);
    expect(ripplesFor(closed, game, [])).toEqual([
      { at: { kind: 'chokepoint', id: 'south_strait' }, tone: 'friend' },
    ]);
  });

  it('marks critical world news as a threat and quiet news not at all', () => {
    const drafts = ripplesFor(game, game, [
      dispatch({ country: 'thessa', severity: 'info' }),
      dispatch({ country: 'kesh', severity: 'critical' }),
      dispatch({ country: 'veskar', severity: 'warning' }),
    ]);
    expect(drafts).toEqual([
      { at: { kind: 'country', id: 'kesh' }, tone: 'threat' },
      { at: { kind: 'country', id: 'veskar' }, tone: 'quiet' },
    ]);
  });

  it('marks your order taking effect in a country as yours, once per place', () => {
    const drafts = ripplesFor(game, game, [
      dispatch({ source: 'order', country: 'orrin', tag: 'Your orders' }),
      dispatch({ source: 'world', country: 'orrin', severity: 'warning' }),
      dispatch({ source: 'order', tag: 'Your orders' }),
    ]);
    expect(drafts).toEqual([{ at: { kind: 'country', id: 'orrin' }, tone: 'you' }]);
  });

  it('numbers ripples on and keeps only the newest few', () => {
    const one = { at: { kind: 'country' as const, id: 'kesh' }, tone: 'threat' as const };
    let ripples = addRipples([], [one, one]);
    expect(ripples.map((r) => r.id)).toEqual([1, 2]);
    for (let i = 0; i < 5; i += 1) ripples = addRipples(ripples, [one]);
    expect(ripples).toHaveLength(MAX_RIPPLES);
    expect(ripples.at(-1)!.id).toBe(7);
    expect(addRipples(ripples, [])).toBe(ripples);
  });
});
