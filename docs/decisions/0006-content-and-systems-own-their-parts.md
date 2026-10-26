# 0006: The map is content, and each system explains itself

Status: accepted, October 2026

## Context

Two things would have got in the way as soon as the world grows:

- **The map was code.** Country shapes and the strait's position lived in `apps/web/src/map/layout.ts`, so adding a country or a strait meant a code change in the web app, even though everything else about it was YAML.
- **Explanations were central.** The why-trace in `engine/src/why.ts` knew the market and society systems by name (`explainMarket`, `explainSystem`). Every new mechanic would have meant editing that file, and with ten systems it would become a tangle.

## Decisions

- **`map.yaml` lives with the scenario.** It holds the canvas size, each country's outline, route anchor and label position, and each chokepoint's position. `packages/content/src/map.ts` validates it against the scenario: every country and chokepoint must be drawn, nothing unknown may be, and every point must be on the canvas. The engine never sees it, like the guide. The web app's `map/layout.ts` keeps only the geometry helpers that turn the data into SVG paths.
- **Each system explains the changes it makes.** The `System` interface gains three optional parts:
  - `modifierIds`: the system modifiers it keeps with `setSystemModifier`, such as society's `cost_of_living` and `faction_mood`.
  - `normalOf(state, ref)`: for a stat whose base value it moves directly, the normal value. The market says a price's normal is its base price.
  - `explain(state, request, context)`: answers either "why is this modifier of yours what it is?" or "why has this stat drifted from normal?". The context lends it `explainStat`, `explainChokepoint` and `baseWithoutAdjustments`, already one level deeper, so depth limits and loop detection stay in one place.
- `why.ts` no longer knows any system by name. It asks the system that owns a modifier or a drift.
- A test runs a game and fails if any system modifier has no owner, or if an owner cannot explain it.

## Consequences

- Adding a country or a strait is pure content: its YAML entries plus its shape or position in `map.yaml`.
- A new mechanic is one file: its `run`, plus `modifierIds` or `normalOf` and `explain` if it changes stats in its own way. Nothing else changes for it to appear in the why panel.
- The why-trace's output is unchanged by this refactor; every existing test, including the golden games, passes as before.
