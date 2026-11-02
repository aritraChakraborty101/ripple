# 0017: The ripple

Status: accepted, October 2026

## Context

PR 3 of the interface pass. The game is named for the butterfly effect, but consequences arrived only as text. The design note asks that every consequence be seen on the map before it is written down: rings from where it happened, a pulse along the routes it touches, then the memo.

## Decisions

- **Ripples come from the world, not from content.** `ripplesFor(before, after, dispatches)` in `src/game/ripples.ts` compares the world before and after each day (or signing):
  - a chokepoint closing spreads red rings, and reopening spreads blue ones;
  - a critical world event spreads red rings from its country, and a warning one quiet grey rings;
  - one of your orders aimed at a country spreads amber rings there when it takes effect. Its report now names that country, so the pile can also show it on the map.

  One ripple per place per batch, the most severe first. No content changes: any future event or chokepoint ripples for free.

- **The session keeps the last six** ripples, numbered, so the map can key them and retire each when its last ring ends. Nothing in the engine knows about them.
- **The animation.** Four rings, 170 ms apart, scale out from the place over 1.3 s. When a chokepoint changes, a short pulse then runs once along every route through it. Rings are scaled rather than resized, with a non-scaling stroke, so they stay thin. It plays whether or not the clock is paused, since a crisis usually pauses it.
- **Then the memo.** An urgent memo lands 650 ms after it is raised, once the rings are under way, so the eye goes to the map first.
- **Reduced motion.** One still ring marks the place and fades; no spreading, no pulse, no memo delay.

- **`?seed=5` in the address** replays one world for the first game, so a moment like this can be shown or checked again.

## Consequences

- The strait closing, the signature moment, now reads as an event on the map: red rings from the strait, red pulses along every oil route through it, then the urgent memo.
- Ripples are presentational and deterministic in what they show. Only when they play depends on real time.
