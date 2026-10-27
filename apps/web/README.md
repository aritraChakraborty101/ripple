# @ripple/web

The browser client. In single player it runs the engine directly in the browser, so it needs no server.

```sh
pnpm --filter @ripple/web dev     # local dev server with hot reload
pnpm --filter @ripple/web build   # static site in apps/web/dist
```

## How it fits together

| Path                          | What it does                                                                      |
| ----------------------------- | --------------------------------------------------------------------------------- |
| `src/game/scenario.ts`        | Bundles the scenario's YAML files and validates them with `@ripple/content`       |
| `src/game/clock.ts`           | Turns real time into whole days (1 day = 2 s at 1×); pause and 1×, 2×, 3×, 5×     |
| `src/game/session.ts`         | The running game: engine state, clock, dispatches, history, crisis alerts         |
| `src/game/news.ts`            | Turns world changes into dispatches; decides which ones are alerts                |
| `src/game/describe.ts`        | Plain-language costs, odds and moods; which orders concern which country          |
| `src/game/store.ts`           | The animation loop and the store React subscribes to                              |
| `src/map/layout.ts`           | Turns the scenario's `map.yaml` into SVG paths (outlines, curved routes)          |
| `src/components/Header`       | Top bar: treasury, influence, stability with ousting countdown, prices, clock     |
| `src/components/WorldMap`     | Clickable countries and strait, relation badges, routes, crisis pulses            |
| `src/components/MapDrawer`    | Details for the selection: relations, trade, news and the orders that concern it  |
| `src/components/SidePanel`    | Tabs for News, Home and Relations; auto-pause setting                             |
| `src/components/Unfolding`    | Strip under the map: policies in force and orders under way                       |
| `src/components/CrisisBanner` | Interrupts with critical news and a "See what you can do" shortcut                |
| `src/game/advisor.ts`         | Picks which advisor tip to show; never changes the game                           |
| `src/game/prefs.ts`           | Remembers per-browser things (briefing seen, first steps) when storage allows     |
| `src/components/Briefing…`    | Opening briefing, first-steps checklist, advisor card, How to play, hints         |
| `src/game/why.ts`             | Turns the engine's explanations into labels, the main chain and the questions     |
| `src/components/WhyDialog`    | The why-trace: the chain in short, then everything that contributed, as a tree    |
| `src/game/intel.ts`           | Asks the clearing house what neighbours want and which harmful moves are close    |
| `src/components/CountryMind`  | "What Corvan wants": goals, current ambition, and any harmful move it is weighing |
| `src/components/DevPanel`     | The AI dev panel: live scores with breakdowns, recent choices, knobs              |

The whole game fits on one screen: nothing scrolls except inside panels (below 960 px wide the panels stack).

The engine never sees real time. The clock decides how many days are due and calls the engine's pure `step()` once per day, so the browser game and a future server run the exact same simulation.

## Developer options

Add these to the address:

- `?dev` opens the **AI dev panel**. Toggle it with the backtick key. It shows:
  - every computer country's options as the clearing house scores them, against the inertia line, and with full breakdowns on click;
  - each country's urgency, its chance of acting today, and whether it is resting or noticing something;
  - the most recent choices;
  - knobs that retune the AI live. Changes are recorded in the game, so it stays reproducible.
- `?ai=aggressive` (or `passive`, `standard`) starts games with that tuning profile. The dev panel can also switch profiles, which starts a new game.
