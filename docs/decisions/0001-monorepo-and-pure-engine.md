# 0001: One TypeScript monorepo with a pure engine

Status: accepted, October 2026

## Context

The same simulation must run in the browser (free single player, no server) and on a server (authoritative multiplayer). Replays, saves and the why-trace all require that the same seed and orders always produce the same world.

## Decision

- One repository with pnpm workspaces: `packages/engine`, `packages/content`, `apps/web`, `apps/server`, `tools`.
- The engine is a pure TypeScript library. It never uses the browser, Node, the network, the real clock or `Math.random()`. ESLint enforces this in `packages/engine/src`.
- All randomness comes from a seeded generator whose state lives inside the game state.
- `web` and `server` depend on `engine` and `content`, never on each other.

## Consequences

- Single player can ship as a static site.
- Multiplayer reuses the engine unchanged.
- A golden test records a known random sequence; changing the generator is a deliberate, visible decision.
- If performance ever demands it, the engine can be rewritten (for example in Rust compiled to WebAssembly) behind the same interface.
