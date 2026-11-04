import { loadBuiltInGuide, loadBuiltInScenario } from '@ripple/content/node';
import { setChokepointOpen } from '@ripple/engine';
import { describe, expect, it } from 'vitest';
import { dueNote, FIELD_NOTES } from '../src/game/fieldNotes';
import { LENSES } from '../src/game/lenses';
import { issueDecision, newSession, tickSession } from '../src/game/session';

const scenario = loadBuiltInScenario('first-crisis');
const guide = loadBuiltInGuide('first-crisis', scenario);

describe('field notes', () => {
  it('has nothing to say before anything has happened', () => {
    expect(dueNote(newSession(scenario, 7), new Set())).toBeNull();
  });

  it('explains orders the moment you sign one', () => {
    const signed = issueDecision(newSession(scenario, 7), 'envoy', 'corvan');
    expect(dueNote(signed, new Set())?.id).toBe('orders');
    // Once read, it is gone for good.
    expect(dueNote(signed, new Set(['orders']))).toBeNull();
  });

  it('puts the most pressing note first, and holds the everyday ones while first steps show', () => {
    const cut = {
      ...newSession(scenario, 7),
      game: setChokepointOpen(newSession(scenario, 7).game, 'south_strait', false),
    };
    const signed = issueDecision(cut, 'envoy', 'orrin');
    expect(dueNote(signed, new Set())?.id).toBe('route_cut');
    expect(dueNote(signed, new Set(['route_cut']))?.id).toBe('orders');
    expect(dueNote(signed, new Set(['route_cut']), true)).toBeNull();
  });

  it('meets every note in a game left alone, in the order the world brings them', () => {
    let session = newSession(scenario, 7, false, guide.tips);
    const seen = new Set<string>();
    const order: string[] = [];
    while (!session.game.outcome && session.game.tick < 400) {
      session = tickSession(session);
      const note = dueNote(session, seen);
      if (note) {
        seen.add(note.id);
        order.push(note.id);
      }
    }
    // Nothing is signed in an idle game, so the note on orders never comes.
    expect([...order].sort()).toEqual(
      FIELD_NOTES.map((n) => n.id)
        .filter((id) => id !== 'orders')
        .sort(),
    );
    expect(order.indexOf('route_cut')).toBeGreaterThan(order.indexOf('reports'));
  });

  it('keeps every note short enough to read at a glance', () => {
    for (const n of FIELD_NOTES) expect(n.text.length, n.id).toBeLessThanOrEqual(260);
  });
});

describe('lens guides', () => {
  it('tells you how to read every lens in one line', () => {
    for (const l of LENSES) {
      expect(l.guide.length, l.id).toBeGreaterThan(20);
      // One line in the gap between the docks.
      expect(l.guide.length, l.id).toBeLessThanOrEqual(90);
    }
  });
});
