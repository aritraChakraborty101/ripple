# @ripple/web

The browser client. In single player it runs the engine directly in the browser, so it needs no server.

```sh
pnpm --filter @ripple/web dev     # local dev server with hot reload
pnpm --filter @ripple/web build   # static site in apps/web/dist
```

## How it fits together

| Path                          | What it does                                                                     |
| ----------------------------- | -------------------------------------------------------------------------------- |
| `src/game/scenario.ts`        | Bundles the scenario's YAML files and validates them with `@ripple/content`      |
| `src/game/clock.ts`           | Turns real time into whole days (1 day = 2 s at 1×); pause and 1×, 2×, 3×, 5×    |
| `src/game/session.ts`         | The running game: engine state, clock, dispatches, history, crisis alerts        |
| `src/game/news.ts`            | Turns world changes into dispatches; decides which ones are alerts               |
| `src/game/describe.ts`        | Plain-language costs, odds and moods; which orders concern which country         |
| `src/game/store.ts`           | The animation loop and the store React subscribes to                             |
| `src/map/layout.ts`           | Map shapes and anchor points per country and chokepoint                          |
| `src/components/Header`       | Top bar: treasury, influence, stability with ousting countdown, prices, clock    |
| `src/components/WorldMap`     | Clickable countries and strait, relation badges, routes, crisis pulses           |
| `src/components/MapDrawer`    | Details for the selection: relations, trade, news and the orders that concern it |
| `src/components/SidePanel`    | Tabs for News, Home and Relations; auto-pause setting                            |
| `src/components/Unfolding`    | Strip under the map: policies in force and orders under way                      |
| `src/components/CrisisBanner` | Interrupts with critical news and a "See what you can do" shortcut               |

The whole game fits on one screen: nothing scrolls except inside panels (below 960 px wide the panels stack).

The engine never sees real time. The clock decides how many days are due and calls the engine's pure `step()` once per day, so the browser game and a future server run the exact same simulation.
