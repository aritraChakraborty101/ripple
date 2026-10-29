# 0014: A wider world, and the final balance pass

Status: accepted, October 2026

## Context

Step 5, the last step of the content pass design note. Steps 1–4 gave the player an economy and about fifty orders, but the world was still five countries and one problem. This step adds three countries, a fourth resource and a second chokepoint, so that a game can start from more than one kind of trouble. It ends with a balance pass against the note's targets.

## Decisions

### World

- **Three countries** (eight in all), each a new kind of problem, and none a repeat of an old one:
  - **Ilmar**, a small, rich island east of Thessa that makes the world's microchips. It fears Thessa and courts everyone else.
  - **Kesh**, a second oil exporter in the far south. Its crude can reach Aldoria overland, avoiding the strait, but its government is shaky: protests come and go, and below 30 stability the army may seize power, stopping its oil for four months and voiding its deals.
  - **Velmont**, a distant, wealthy power along the northern edge. It courts Aldoria, sends aid to Corvan, Kesh and Orrin, and warns Aldoria when it grows close to Thessa.
- **Microchips** (base price 150.00). Aldoria, Thessa, Velmont and Kesh buy them; Ilmar alone makes them. Aldoria's military weighs chips at 40% and industry at 15%; workers not at all. That gives Aldoria a crisis its workers ignore and its generals don't.
- **The Narrows**, held by Thessa between it and Ilmar, carries every chip except Thessa's own. Thessa takes a 5% toll. Thessa can search shipments there (chips to Aldoria at half rate for two months), or, once Corvan is in its orbit and the grudge is deep, close it, with a backstop event after three months. A typhoon can close it for ten days.
- **Routes.** 57 of the world's 100 units of oil a day pass the South Strait (56% in the old five-country map), now including some of Velmont's crude, so Velmont has a stake in the strait too.
- **Budgets** are recalibrated so every country runs a small surplus at normal prices (Aldoria +0.5 bn a month) except Kesh, at −0.3 bn, which keeps it hungry.
- **The map** widens to 1120 × 640: Velmont along the top, Ilmar east of the Narrows, Kesh in the south. Kesh was first drawn in the bottom-left corner, but that is where the advisor's card opens, so it moved.

### AI

- **Two new goals.** `balance` reads the monthly budget (need grows as it falls below aspire, full at 5 bn below). `supply(resource)` reads how much of world demand is met (full at half). Corvan, Thessa, Veskar and Orrin give `balance` part of their old `wealth` weight, so a closed strait now costs Corvan its tolls in a way it feels. Velmont weighs `supply(chips)`.
- **Honest drives.** Closing the strait or imposing sanctions serves `balance` negatively; reopening serves it positively.
- Personalities for the newcomers: Ilmar (security, ties to Velmont and Aldoria), Kesh (money and its budget, ambition "Stay afloat"), Velmont (standing, ties to Aldoria, a grudge against Thessa, ambition "A say in the region").

### Influence recovers

At each month's end, a country below its starting influence regains a point, recorded as an adjustment from the system `recovery` so the why panel names it. With eight orders spending influence (step 4), a resource that never came back made the late game a shrinking menu.

### Speed

- `sortedIds` caches each record's sorted keys in a `WeakMap`. World records are immutable and replaced on change, so the cache is always correct, and the array is typed read-only so nothing can change it.
- The `balance` goal reads revenue minus spending as the economy last kept it (at most a day old) instead of recomputing every trade line for every option scored.
- A simulated day now costs about 1.3 ms in crisis-heavy games with seven computer countries. The 400-game balance run takes about 9 minutes. Caching scores between days is the next lever if that matters.

### Balance tool

- Reports what caused each game's first critical crisis (a critical event or computer move), and closures of each chokepoint separately; it had been counting the Narrows' typhoons as strait closures.
- The steady player has a fuller Corvan playbook (broadcasts as relations cool, then envoys, then fees and aid), and makes deals and treaties with any friendly supplier, the newcomers included.

## Consequences

Balance over 200 games, standard profile, against the design note's targets:

| Measure                                               | Target           | Before (PR #15) | After                                                                        |
| ----------------------------------------------------- | ---------------- | --------------- | ---------------------------------------------------------------------------- |
| Idle player ousted                                    | 75–90%           | 79%             | 87%                                                                          |
| Earliest idle ousting                                 | day 150 or later | day 171         | day 161                                                                      |
| Steady player ousted                                  | 5% or less       | 1%              | 2%                                                                           |
| Distinct first-crisis causes, each 15%+ of idle games | 3 or more        | 1               | 3: the strait 49%, Kesh's coup 27%, Veskar's explosion 19% (the fab fire 7%) |
| Most-used order's share, steady player                | 25% or less      | 54%             | 19% (trade deals), then broadcasts and transit fees at 17% each              |

Tuning on the way there:

- The first version was far too gentle: idle players were ousted 12% of the time. Corvan's new budget goal reopened the strait within weeks. Removing it showed the world itself was gentler too, because less oil passed the strait. The fix was rerouting some oil through it, so its share went 50% → 60% (99% ousted, too harsh) → 55% (75%) → 57% (87%).
- Corvan's budget drives were cut to a nudge (closing −1, reopening +1). At −3/+3 they made closures short-lived; at −1/+1 Corvan still reopens sooner than it did, which was the design's intent.
- Kesh's coup needed protests strong enough to take stability below 30, and a lower daily chance once there, so it is a common first crisis but not the usual one.

Other consequences:

- **Golden game moved to seed 5.** Seed 3 now ends with the leader surviving (one of the 13% of idle games). In seed 5, Velmont courts Aldoria and Thessa pulls Corvan into a pact. Veskar's terminal explodes, a fishing dispute sours relations, and Corvan closes the strait on day 176. The army seizes power in Kesh on day 197, and the leader falls on day 230.
- The first-crisis measure only counts critical news. Thessa's searches in the Narrows, Ilmar's chip restrictions and the typhoon are warnings, so they shape games without being "the" crisis. With a provoked Thessa, the Narrows closes (0.1 a game in steady play).
- The content pass is complete. The interface pass comes next, from the design note's hooks table.
