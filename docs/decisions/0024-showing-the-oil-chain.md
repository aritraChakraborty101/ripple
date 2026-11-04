# 0024: Showing the oil chain

Status: accepted, November 2026

## Context

This is PR 4 of the oil chain design note, the last one. Records 0021 to 0023 built a supply chain that runs underneath the game. Until now the player could see only its prices. This PR shows the rest: the ships, the stocks, the plants, and the delay. It changes only the web app; the engine and the scenario are untouched.

## Decisions

### A pure read of the chain

`apps/web/src/game/chain.ts` reads the game state and changes nothing. It provides:

- **Days of cover:** a stock divided by daily use, where use includes what the country's plants take in.
- **Ship marks:** each shipment's position along its route, from 0 to 1.
- **Plant marks:** each well and refinery as _working_, _cut_ (running below normal), _starved_ (a refinery without a day's input) or _off_.
- **Refineries running low:** any refinery whose input stock has just fallen below three days' worth.

### On the map (Trade lens)

- **Ships.** Each shipment is a small dot on its route, amber when it is coming to you. Each dot keeps its key from departure to arrival, so it slides forward a step each day, with a CSS transition that is skipped under reduced motion. Ships use the same Bézier curves as the drawn routes. `map/layout.ts` now builds routes as pieces that can be sampled, and the paths it draws are unchanged (a test checks this). When a chokepoint closes, its routes empty out over one voyage.
- **Days of cover** replace "Sells …" under any country that uses fuel, for example "Fuel 20 days". The text is amber below 10 days, red below 5, and reads "Fuel run out" while there are queues. Kesh, which uses no fuel, still says what it sells.
- **Plant marks** under each country: a tower and tank for a refinery, an oil drop for wells. Grey means working, faded means starved or off, and red with a pulse means cut. Each has a tooltip, and the plants are included in the country's screen-reader label.
- The legend on the Trade lens explains ships, refineries and wells.

The **Unrest** lens adds "· queues" to a country while its people go without.

### Memos

Your own stocks are reported only when their state changes:

| Change                   | Severity                  | Headline                                |
| ------------------------ | ------------------------- | --------------------------------------- |
| ok → low (under 10 days) | warning                   | "Fuel stocks down to 9 days"            |
| → out (unmet demand)     | critical, pauses the game | "Queues at the pumps: fuel has run out" |
| → ok (back to 15 days)   | info                      | "Fuel stocks back to 15 days"           |

- The gap between 10 and 15 days stops a stock that hovers near the line from reporting every day.
- Crude reports too. Running out of it is only a warning ("the refinery at home stands idle"), because you can still buy fuel.
- A stock memo answers "Why?" with the stock's own why-trace.

**A plant cut at a supplier is urgent.** Any world event that cuts a plant at home, or in a country that ships you that plant's output on a route in use, is shown as critical. This applies whatever the event's own severity. So Corvan's refinery fire becomes urgent for you, while Kesh's blowout does not, because Kesh ships its crude to Thessa and Velmont. This rule lives in the news layer, so the scenario stays the same.

### The delayed ripple

Ripples now arrive in a sequence:

1. Rings at the strait the day it closes.
2. A quiet ring at each refinery country as its crude falls below three days' worth.
3. A quiet ring at home when your stocks run low.
4. A red ring when the pumps run dry.

In seed 7, the golden game, played idle:

| Day | What happens                |
| --- | --------------------------- |
| 185 | The strait closes           |
| 203 | Crude runs low at home      |
| 211 | Aldoria's refinery runs low |
| 221 | Thessa's refinery runs low  |
| 246 | Fuel runs low at home       |
| 262 | Queues at the pumps         |
| 304 | The leader falls            |

The delay is the story.

### Markets

The strip already listed crude and fuel. For stocked goods, its hint now explains that the price follows the world's stocks: it climbs for weeks after a cut and eases slowly afterwards.

## Consequences

- No engine, content or balance changes, and the golden game is unchanged.
- There are new alerts: running out of fuel, and a plant cut at a supplier. Both pause the game when auto-pause is on.
- The oil chain note is complete. Next: save and load, then v0.1.
