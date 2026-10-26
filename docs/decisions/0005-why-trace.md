# 0005: The why-trace

Status: accepted, October 2026

## Context

The idea behind Ripple is that small decisions spread outward. Players could see the end of a ripple (stability falling, oil getting dearer) but not the path it took, so the game felt random when it was not. The player should be able to click any number or crisis and follow it back to where it started.

## Decisions

- **The engine records causes as it runs.** `GameState.trace` (state version 3) holds:
  - `firings`: every world event that fired, with what scheduled it and a snapshot of why its trigger held at that moment.
  - `adjustments`: every permanent change to a stat (`adjust` effects), with its source.
  - `chokepointBy` and `flagBy`: who last opened or closed each chokepoint and set each flag.
- **Recording never changes the simulation.** All existing tests and golden games are unchanged, and a test checks that explaining never mutates state.
- **Explanations are computed on request, not stored.** `explainStat`, `explainEvent`, `explainChokepoint` and `explainTrigger` return a tree of `WhyNode`s. Live numbers are explained from the current state:
  - a stat breaks down into its modifiers and adjustments;
  - a price into market supply and demand, then the routes and chokepoints behind them;
  - stability into faction mood;
  - a faction's satisfaction into the prices that press on it.
- **Past events are explained from their snapshot.** The world has moved on since an event fired, so `explainEvent` returns the `because` tree recorded at the time, not one rebuilt from today's state.
- **Trees are bounded.** Explanations stop at `MAX_DEPTH` (9), and snapshots at `SNAPSHOT_DEPTH` (6). A loop or the depth limit marks the node `truncated`. Event nodes inside a tree are references, expanded only when the player opens them.
- **The interface shows one story, then the detail.** "The chain in short" follows the largest contribution at each step and drops the bookkeeping nodes (mood, pressure, system). It reads root cause first, for example: fishing dispute → relations with Corvan −60 → Corvan closes the South Strait → crude oil supply 35 a day against demand of 80 → crude oil +126% → workers' satisfaction 34 → stability 16. Below it, the full tree opens along that chain.
- **Asking why pauses the game**, so the answer does not change while it is being read.

## Consequences

- Saves will be larger, because the trace grows with the game: one firing record per event and one entry per adjustment. That is small at this scale. If it grows, old snapshots can be dropped or compacted without affecting the simulation.
- New effects must record their cause to show up in the trace. A system that changes stats in its own way explains those changes itself (see decision 0006), and a test fails if a system keeps a modifier it cannot explain.
