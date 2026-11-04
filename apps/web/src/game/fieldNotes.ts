/**
 * Field notes: one-time explanations, each shown the first time the thing it
 * explains happens in play, so the player learns the game while playing it
 * rather than all at once from the briefing. One note at a time; once the
 * player has read a note it never comes back, in this game or the next.
 * Every note is also listed in How to play.
 *
 * Presentation only: notes read the session and never change the game.
 */

import { effectiveStat } from '@ripple/engine';
import type { Session } from './session';

export interface FieldNote {
  readonly id: string;
  readonly title: string;
  readonly text: string;
  /** Shown even while the first steps are still on screen; the rest wait for them. */
  readonly pressing?: boolean;
  /** True once the thing this note explains has happened. */
  readonly when: (session: Session) => boolean;
}

const stability = (s: Session) =>
  effectiveStat(s.game, { kind: 'country', id: s.game.rules.playerCountry, stat: 'stability' });

/**
 * From the everyday to the pressing. When several are due at once, the most
 * pressing (the last) comes first, so an unread note about reports never holds
 * back the one about a cut route.
 */
export const FIELD_NOTES: readonly FieldNote[] = [
  {
    id: 'reports',
    title: 'Reports',
    text: 'News lands here, newest on top; the coloured dot says how serious it is. Click a report about a country to see it on the map, or ask why it happened.',
    when: (s) => s.dispatches.some((d) => d.source !== 'order'),
  },
  {
    id: 'orders',
    title: 'Orders take time',
    text: 'What you sign waits under Unfolding, bottom left, until it lands, and some orders can fail. Policies, such as tariffs, stay there until you lift them.',
    when: (s) => s.tallies.ordersSigned > 0,
  },
  {
    id: 'advisor',
    title: 'Your advisor',
    text: 'Advice appears when it matters, with the orders it suggests ready to sign. It is only advice: dismiss it if you see things differently.',
    when: (s) => s.advisor.current !== null,
  },
  {
    id: 'month',
    title: 'The month ends',
    text: 'Your treasury settles at each month’s end: imports out, exports and taxes in. Hover the Treasury meter for the sums, and click it to see why it moved.',
    when: (s) => s.game.tick >= 31,
  },
  {
    id: 'prices',
    title: 'Prices move',
    text: 'When supply falls short, prices climb, and each faction at home feels the goods it buys. Click a price, bottom left, to trace it back. The Prices lens (3) shows who sells what.',
    when: (s) => s.dispatches.some((d) => d.source === 'market'),
  },
  {
    id: 'intel',
    pressing: true,
    title: 'An intelligence warning',
    text: 'A neighbour is weighing a move against you. There is usually time: open the country to see what drives it, and better relations, a treaty or a firm answer can head it off. The Intelligence lens (5) shows who is planning what.',
    when: (s) => s.dispatches.some((d) => d.source === 'intel'),
  },
  {
    id: 'stability',
    pressing: true,
    title: 'Stability is slipping',
    text: 'Click your own country to see which faction is unhappy, and about what. If stability stays below 20 for 30 days you are ousted; the meter counts the days down once that starts.',
    when: (s) => stability(s) < 45,
  },
  {
    id: 'route_cut',
    pressing: true,
    title: 'A route is cut',
    text: 'Nothing runs out at once. Ships already past still arrive and stocks last a while, so the shortage bites in weeks. On the Trade lens (2), watch the ships thin out and the days of fuel fall: that is your time to act.',
    when: (s) => Object.values(s.game.world.chokepoints).some((c) => !c.open),
  },
];

/**
 * The note to show now: the most pressing one due that the player has not
 * read. While the first steps are on screen, only pressing notes are shown.
 */
export function dueNote(
  session: Session,
  seen: ReadonlySet<string>,
  stepsShowing = false,
): FieldNote | null {
  if (session.game.outcome) return null;
  for (let i = FIELD_NOTES.length - 1; i >= 0; i -= 1) {
    const note = FIELD_NOTES[i]!;
    if (stepsShowing && !note.pressing) continue;
    if (!seen.has(note.id) && note.when(session)) return note;
  }
  return null;
}
