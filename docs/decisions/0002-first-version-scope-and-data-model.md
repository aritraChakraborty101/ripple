# 0002: First-version scope and data model

Status: accepted, October 2026

## Scope decisions

| Decision           | Chosen                                                                                  |
| ------------------ | --------------------------------------------------------------------------------------- |
| How a game ends    | Archetype goals over a fixed period; the leader is ousted if domestic support collapses |
| Time scale         | 1 tick = 1 day on a 360-day calendar (12 × 30); a game lasts 5 years (1,800 ticks)      |
| Player country     | Aldoria, a fixed industrial importer                                                    |
| Companies          | Later; v1 has countries and domestic factions only                                      |
| Computer countries | Scripted reactions first, goal-driven AI in phase 4                                     |
| Unreliable news    | Later; v1 news is accurate                                                              |
| Setting            | Fictional, with recognizable analogues                                                  |
| Working title      | Ripple                                                                                  |

## Data model decisions

- **Stats are open-ended integer maps** (`stats: { stability: 61, ... }`), not fixed fields. Content can add a stat without engine changes; a stat an entity lacks reads as 0.
- **All numbers are integers.** Prices are in cents, percentages in basis points (1500 = 15%). Integer math is identical in every JavaScript engine, which keeps the simulation deterministic.
- **Modifiers never overwrite values.** Each one records its target, amount, source and expiry. The effective value is `(base + adds) × (10000 + pct) / 10000`, truncated. Every value can be traced back to its causes.
- **Systems run in a fixed order** each tick and never call each other: modifier expiry, then market. New mechanics are new systems.
- **Markets drift, not jump.** Each day a price closes 10% of the gap to its target (base × demand ÷ supply), capped between ¼ and 4× the base price. Shocks build over days, which leaves the player time to react.
- **Content is split by section** (countries.yaml, links.yaml, ...) and validated with Zod, including cross-references, before the engine sees it. The engine only depends on the `ScenarioDef` type, so it never depends on the content package.

## Consequences

- Closing the South Strait in the first scenario raises oil and, through Orrin's grain route, grain prices, without either being scripted. Ripples come from structure, not special cases.
- Price tuning (speed, caps) is a first guess and will change during playtesting; golden tests make every change deliberate.
