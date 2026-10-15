# @ripple/web

The browser client. In single player it runs the engine directly in the browser, so it needs no server.

```sh
pnpm --filter @ripple/web dev     # local dev server with hot reload
pnpm --filter @ripple/web build   # static site in apps/web/dist
```

## How it fits together

| Path                   | What it does                                                                  |
| ---------------------- | ----------------------------------------------------------------------------- |
| `src/game/scenario.ts` | Bundles the scenario's YAML files and validates them with `@ripple/content`   |
| `src/game/clock.ts`    | Turns real time into whole days (1 day = 2 s at 1×); pause and 1×, 2×, 3×, 5× |
| `src/game/session.ts`  | The running game: engine state, clock, dispatches and price history           |
| `src/game/news.ts`     | Turns world changes into dispatches, one per 10% price band crossed           |
| `src/game/store.ts`    | The animation loop and the store React subscribes to                          |
| `src/map/layout.ts`    | Map shapes and anchor points per country and chokepoint                       |
| `src/components/`      | Header and clock, map, markets, dispatches, temporary developer tools         |

The engine never sees real time. The clock decides how many days are due and calls the engine's pure `step()` once per day, so the browser game and a future server run the exact same simulation.

The developer tools panel (close or reopen the strait, restart) is temporary. Crises and decisions will happen inside the game in the next update.
