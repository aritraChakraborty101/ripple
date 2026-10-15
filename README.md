# Ripple (working title)

A pausable real-time geopolitics game. You lead one country in a living, fictional world, and small decisions ripple outward in ways you didn't intend.

Status: early development, playable. Crises arise on their own, you respond with orders, and you can be ousted.

## Repository layout

| Path               | What it is                                                         |
| ------------------ | ------------------------------------------------------------------ |
| `packages/engine`  | Pure, deterministic simulation: ticks, systems, seeded randomness  |
| `packages/content` | Countries, links, events and decisions as data, with their schemas |
| `apps/web`         | Browser client; runs the engine locally for single player          |
| `apps/server`      | Authoritative multiplayer server (later)                           |
| `tools`            | Developer scripts, including the balance report (`pnpm balance`)   |
| `docs`             | Design doc link and decision records                               |

The engine depends on nothing else in the repo. Both apps depend on the engine and content, never on each other.

## Getting started

Requires Node 22 and pnpm 10.

```sh
pnpm install
pnpm dev     # play in the browser at the address it prints
pnpm check   # typecheck, lint, format check and tests
```

## Determinism

The same seed and the same orders must always produce the same world. That is what makes saves, replays, the why-trace and multiplayer possible. In `packages/engine/src`, the linter blocks `Math.random()`, `Date.now()`, timers and browser or Node APIs, and a golden test pins the random sequence. See [decision 0001](docs/decisions/0001-monorepo-and-pure-engine.md).
