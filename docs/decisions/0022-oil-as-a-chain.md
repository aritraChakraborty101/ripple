# 0022: Oil as a chain

Status: accepted, November 2026

## Context

PR 2 of the oil chain design note. Record 0021 added the supply engine; this record turns the first-crisis scenario's oil into crude and fuel, and records the engine changes that playing a real scenario showed were needed.

## Decisions

### The chain in content

- **Two goods.** `crude` (base price 73.00) and `fuel` (95.00), both stocked with 20 days of cover. `oil` is gone.
- **Plants** (plants.yaml). Wells: Veskar 95 a day and Kesh 30, each with spare capacity for deals and the pipeline. Refineries: Thessa 45, Aldoria 15, Corvan 15, Velmont 15, Veskar 10.
- **Crude routes**, 100 a day in all. 55 of them pass the South Strait: Aldoria's 15, Thessa's 33 from Veskar and Velmont's 7. Corvan's 15 come straight across from Veskar, so closing the strait spares Corvan's own refinery. Kesh's 20 go overland to Thessa and Velmont. Transit takes 3 to 12 days.
- **Fuel routes.** Aldoria refines 15 and buys 25: 15 from Thessa and 10 from Corvan, overland. Veskar's small refinery serves Orrin and Ilmar by sea, through the strait.
- **Factions weigh fuel** where they weighed oil. Countries' demand is fuel.
- **Rewired orders and events:**
  - Veskar's discount lowers fuel by 7%.
  - The reserve release puts 400 units of fuel (ten days) into Aldoria's tanks.
  - Rationing cuts fuel demand.
  - The pipeline and the Veskar and Kesh deals are crude routes; extra crude fills Aldoria's tanks as a buffer.
  - Veskar's output cut, the terminal explosion and Kesh's coup act on the wells.
  - Price moves that used to hit oil (Corvan's fees, Kesh's and Veskar's price rises) now hit fuel.
  - The AI's `prices(oil)` goal reads crude.
- **Budgets** are recalibrated so every country's monthly balance at normal prices is exactly what it was.
- The briefing and advisor explain the delay: tankers already past the strait still arrive, and Aldoria holds about three weeks of fuel.

### Engine changes found while doing it

- **Wells pump to need:** enough to hold their country's normal stock plus a day's load for every open route out. Spare capacity stays in the ground until a deal or pipeline needs it. With the strait shut, crude stays in the ground instead of piling up.
- **Flows steer stocks back to normal** (`SURGE_BP`, 50%). A route to a country below normal, and a plant whose country is below normal in what it makes, run up to 50% above capacity; above normal, 50% below. Without the headroom, emptied tanks never refilled and prices stayed at the ceiling forever after a crisis. Without the slowdown, refills overshot into a lasting glut. Levels are read from the start of each day, so a normal day stays exactly normal.
- **Buyers stop at full tanks**, twice their normal stock (`FULL_TANKS_MULTIPLE`). Prices count stock up to full tanks, so a refinery fire shows as a crude glut, not a shortage.
- **Imports of stocked goods** are paid for as they are shipped, and tariffs apply to what is shipped. A country that runs dry buys less, and pays dearly for what it does get.
- **Shortage weighs half** a price rise of the same size, on top of the price (`SHORTAGE_WEIGHT_BP`).
- **Stocked prices follow the square root** of holdings against normal: holdings at a quarter of normal double the price rather than quadrupling it (`isqrt`, exact integers). Stocks are a buffer, and traders know more is on the way. With the straight ratio, prices hit the ceiling as tanks emptied, and idle players were ousted in 97–98% of games even with shortage at half weight.

## Results

Standard profile, 100 games each (the 200-game runs before the last two changes agreed):

| Measure                             | Target   | Before (oil, record 0020)                | Now                                                             |
| ----------------------------------- | -------- | ---------------------------------------- | --------------------------------------------------------------- |
| Idle ousted                         | 75–90%   | 88%                                      | 87%                                                             |
| Earliest idle ousting               | day 150+ | 155                                      | 222                                                             |
| Idle first-crisis causes at 15%+    | 3+       | strait 53%, Kesh coup 29%, explosion 15% | strait 60%, Kesh coup 24%, explosion 13% (two clear, one close) |
| Steady ousted                       | ≤5%      | 2%                                       | 0%                                                              |
| Steady player runs out of fuel      | ≤10%     | —                                        | 0%                                                              |
| Steady top order                    | ≤25%     | 19%                                      | trade deal 20%                                                  |
| Steady harmful moves, largest share | ≤40%     | Kesh 29%                                 | Kesh 28%                                                        |

Two of the design note's new targets are not met, and are noted honestly rather than tuned around:

- **Idle players run out of fuel in 99% of games** (target 30–60%). An idle player nearly always meets a long closure, and every long closure empties the tanks. The target assumed shorter closures.
- **Time to the fuel price peak.** In a 120-day closure, fuel keeps rising until the strait reopens and peaks about ten days after: tankers already at sea stop arriving. The 15–35 day target only fits short closures; the property that matters is that fuel moves little for the first month, which holds (+6% at day 30). After reopening, fuel is back within 10% of normal in about 55 days (target 30–60).

The golden game moves to **seed 4**: a fishing dispute on day 74, Corvan closes the strait on day 160, and the leader falls on day 260. That's a hundred days of tanks running down, where the old model took about fifty.

## Consequences

- A strait closure now unfolds over time. Crude climbs at once, but fuel moves little for a month. Aldoria's tanks run dry about eleven weeks in. After the strait reopens, prices take about two months to settle.
- **A country that runs dry buys less**, so a closure now costs stability more than money. Aldoria's monthly deficit in a long closure reaches about 4 bn, not the 10+ bn it was, and the treasury barely moves. If money becomes too easy in crises, PR 3's orders (the reserve, the long way round) are where to add cost.
- Corvan's refinery keeps selling to Aldoria through a closure. That's a reason to keep Corvan sweet even when the strait is shut.
- The interface still shows crude and fuel as ordinary prices. PR 4 shows stocks, ships and refineries.
