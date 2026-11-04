# 0023: Oil orders and events

Status: accepted, November 2026

## Context

PR 3 of the oil chain design note. Records 0021 and 0022 built the supply engine and made oil a crude and fuel chain. This record gives the player and the world things to do with that chain: orders that change the plants and routes, and events that break them.

## Decisions

### New orders for the player

- **Expand the refinery at home** (Interior). Costs 150 bn and takes 240 days. Each expansion adds 15 a day of refining capacity and 15 a day of crude on the Veskar route. It can be done twice, taking Aldoria from 15 to 45, which is as big as Thessa. It is a long-term answer to depending on Thessa and Corvan for fuel.
- **Send the tankers the long way round** (Trade). This is a policy. It reroutes Aldoria's Veskar crude around the strait: 18 days instead of 8, and 3 bn a month extra while it lasts. When the strait closes, the crude keeps arriving, but late. _End the long route_ sends the tankers back.

### New moves for the computer countries

- **Thessa curbs fuel sales to Aldoria.** Thessa does this when relations sour and the game is old enough. It cuts the Thessa to Aldoria fuel route by 60% for 90 days. It is weighed against the treaty and Thessa's own stability, like Thessa's other hostile moves.

### New events

| Event                     | When                          | Effect                               |
| ------------------------- | ----------------------------- | ------------------------------------ |
| Fire at Thessa's refinery | after day 120, rare, critical | refinery at 25% for 60 days          |
| Fire at Corvan's refinery | rare, warning                 | refinery out for 42 days             |
| Collision in the strait   | after day 60, only while open | strait routes at half for 10 days    |
| Storm season              | after day 200                 | sea routes at two thirds for 30 days |
| Blowout at Kesh's wells   | after day 90                  | Kesh's wells out for 42 days         |

A fire hits fuel without touching crude, so the two goods can now move apart.

**Storm season cuts capacity instead of adding days**, unlike the note. A link's `days` is fixed when the world is built, because the pipelines fill from it. Cutting capacity by a third is what a slower voyage does to deliveries per day, so the effect on supply is the same.

### Advisor

- When the strait closes, the advisor now suggests the long way round first, then the reserve and the pipeline.
- A new tip fires when Aldoria's fuel stock falls below 300, about a week. It suggests the reserve and rationing.
- A new tip fires when Thessa's refinery is down. It suggests rationing and expanding the home refinery.

### Balance

There are 100 games of each kind.

|                 | Idle                   | Steady          |
| --------------- | ---------------------- | --------------- |
| Ousted          | 89% (earliest day 218) | 2%              |
| Ran out of fuel | 98%                    | 0%              |
| Top order       | (none)                 | trade deal, 17% |
| Expand refinery | (none)                 | 4%              |
| Long way round  | (none)                 | 3%              |

Steady play now uses the new orders. It takes the long route when the strait closes and expands the refinery once it can afford to. Harmful moves are spread out: Thessa 25%, Kesh 25%, Veskar 20%, Corvan 18%, Ilmar 12%. All targets in the note are met.

### New golden game

Seed 4 now survives to day 478, too long for a test to play through. The golden game moves to **seed 7**:

1. A fishing dispute on day 105.
2. Corvan closes the strait on day 185.
3. The idle leader falls on day 304.

The story still runs from the fishing boats to the strait to fuel to stability, so the why-trace test keeps its chain. Seed 4 stays in the advisor tests, which only need its opening weeks.

## Consequences

- The orders and events are content only; there is no engine change in this PR.
- Nothing shows ships, stocks or refineries on the map yet. That is PR 4.
