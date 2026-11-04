# 0025: Onboarding for a bigger game

Status: accepted, November 2026

## Context

The briefing, the first-steps checklist and How to play were written when the game was a map, a few meters and a list of orders. Since then the game has gained:

- five lenses;
- the cabinet with its ministries;
- the why panel;
- intelligence warnings;
- neighbours with goals and ambitions;
- an oil chain with ships, stocks, refineries and a delay.

A new player was told about almost none of this. Aritra asked for the tutorial to be revisited before anyone else plays.

## Decisions

Teach in three layers, each where the player already looks, all in the game's own style of paper sheets and memos. There is no overlay tour, because a tour fights a real-time game and is forgotten once it is clicked through.

### 1. A paged briefing

The briefing is now five short pages with Back, Next, page dots and arrow keys, instead of one long sheet:

1. Your country
2. How you win or lose (now naming the three factions)
3. How trouble travels
4. Your neighbours
5. How to act

The schema gains two optional figures per page. Both are validated, and an unknown country is a content error.

- **`chain`**: steps of cause and effect, each with an optional note on timing, drawn as a vertical line of dots. Page 3 draws the strait closure: day one, then tankers stop arriving within a week or two, stocks run down over about three weeks, prices climb, factions turn on you, and stability falls. The delay is the lesson.
- **`cast`**: a who's-who with one line per country. Page 4 introduces all seven neighbours, and a test checks that none is missing.

"Skip the briefing" is on the first page.

### 2. Seven first steps

The checklist grows from four steps to seven. It adds the three tools a player would otherwise never find: the Trade lens (key 2), asking why (clicking a meter or a price), and the Cabinet (D). Each step still ticks itself off and shows "2 of 7".

### 3. Field notes

Field notes are one-time explanations, each shown the first time the thing it explains happens in play. There are eight:

1. Reports
2. Orders take time
3. Your advisor
4. The month ends
5. Prices move
6. An intelligence warning
7. Stability is slipping
8. A route is cut

How they behave:

- A note sits on top of the reports pile with "Got it" and "No more notes", one at a time. Once read, it never returns.
- When several are due at once, the most pressing comes first. An unread note about reports never holds back the one about a cut route.
- While the first steps are still on screen, only the three pressing notes appear (intelligence, stability, a cut route), so the opening isn't crowded.
- Every note is also listed in How to play.

### Lens guides

Each lens now has a guide line under its question saying how to read it. For example, Trade says: "Dots are shipments, amber when bound for you. Under each country: days of fuel left." Each guide fits on one line (90 characters or fewer, checked by a test).

### How to play

- It explains the oil chain and lists every lens with its guide.
- It includes the field notes and the arrow keys for the briefing.
- "Show first steps and notes again" resets both.

### Returning players

The pref keys carry a version (`briefing.v2.seen`, `steps.v2.*`, `notes.v1.*`), so anyone who played before sees the new briefing and steps once.

### Fixes found on the way

- The markets strip grew past its dock when prices rose and ran under the lens bar. It now always fits the dock: five equal tiles, with the change wrapping under the price.
- The map legend moved up to clear the lens guide line.
- The empty reports pile no longer says "Press play" once the clock is running.

## Consequences

- No engine or balance changes. The guide stays presentation only.
- New text lives in `briefing.yaml` (content) and in `game/fieldNotes.ts` and `game/lenses.ts` (web). The field notes are specific to the first crisis for now. A second scenario would move them into content, as the advisor tips already are.
