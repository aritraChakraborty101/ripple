# 0003: Events, decisions and stability

Status: accepted, October 2026

## Context

The world simulated markets but nothing happened in it unless a test forced it, and the player could not act. The game needed crises that arise from the world's state, a way for the player to respond, and stakes.

## Decisions

- **A small rules vocabulary.** Content describes events and decisions with conditions (`all`, `any`, `not`, stat bounds, relations, chokepoints, flags, `afterDay`, `chance`) and effects (`modify`, `adjust`, `relation`, `setChokepoint`, `schedule`, `setFlag`, `clearFlag`). New crises are new YAML entries; the engine only grows when a genuinely new building block is needed.
- **Relations are entities with stats.** One relation per pair of countries, with a `value` stat. Modifiers and the why-trace therefore work on diplomacy exactly as on prices.
- **Events fire on their own.** Each day, scheduled events fire first, then every event whose trigger holds, in ID order. `chance` draws come last in a trigger so randomness is only consumed when everything else holds. `schedule` gives delayed consequences (a closed strait reopens 75 days later).
- **Decisions are orders.** Signing pays costs at once and schedules the outcome; success can be a chance. Orders are validated with a reason (`Already under way.`, `Needs 40 bn in the treasury.`) and rejected without throwing, because they arrive from players at any moment. The browser signs orders while paused through `applyOrders`, without advancing time.
- **Prices become feelings, feelings become stability.** Each faction weighs the prices it cares about (its `sensitivity`); its satisfaction falls with that weighted pressure. Stability moves with the factions' change in satisfaction, weighted by their power. Both are system modifiers recalculated daily, so the chain _closed strait → dear oil → unhappy workers → lower stability_ is visible in the modifiers.
- **Ousting and survival.** The leader is ousted after 30 consecutive days with stability below 20, and survives by reaching the end of the 5-year term. Once the game is over, `step` changes nothing.
- **A balance tool.** `pnpm balance` plays hundreds of complete games with an idle player and a rule-of-thumb player and summarizes how often each is ousted, how often the strait closes, and how money and stability end up.

## Tuning at the time of writing (200 games)

| Player | Ousted | Strait closed at least once | Final treasury (median) |
| ------ | ------ | --------------------------- | ----------------------- |
| Idle   | ~90%   | ~97%                        | ~400 bn                 |
| Steady | ~0%    | ~54%                        | ~20 bn                  |

The steady bot reacts instantly and perfectly, which a human won't, so this is a reasonable starting difficulty. Expect it to change after playtesting; the golden tests make each change deliberate.
