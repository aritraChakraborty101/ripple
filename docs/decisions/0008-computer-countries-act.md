# 0008: Computer countries, part 2: they act

Status: accepted, October 2026

## Context

Part 1 (decision 0007) built the clearing house, which scores what each computer country could do. This part lets the countries act on those scores. It also turns the eight world events that were really other countries' choices into choices.

## Decisions

- **The planner runs at the start of each day** (`engine/src/ai/plan.ts`), before any orders are signed. For each computer country, in ID order:
  1. Skip it if it has an order under way, or rested fewer than `restDays` since acting.
  2. Keep the options that beat inertia.
  3. Roll the daily chance: urgency × attention, capped at `maxDailyChance`.
  4. Pick one option, weighted by how far it beats inertia. `temperature` scales the other options against the best.

  The pick becomes an ordinary order, signed by `applyOrders` after the player's, so computer countries pay costs, wait out cooldowns and can fail like the player. A country with nothing worth doing draws no randomness.

- **Noticing** (`ai/attention.ts`): after the day's systems run, a country's attention is boosted for `noticeDays` if something touched it: an event about it, an order it signed or one aimed at it, or a relation moving by 10 or more.
- **Every choice is recorded** in `trace.choices`: goal parts, appeal, ambition, score, runner-up, and `because`, which snapshots the stats behind its goals and considerations. In the why panel, a closed strait now leads to "Corvan closes the South Strait to shipping", with the note "Corvan's choice: driven by a grudge against Aldoria (need 90%)", and then on to the stats behind it.
- **Orders gained a target and a `by`.**
  - Templates are bound with `self` and `target` when signed and again when resolved.
  - Pending decisions keep their target.
  - Cooldowns are kept per country (`issuedKey`), so Thessa courting someone does not stop Corvan.
  - Decision events and modifier sources carry the country that signed them.
- **Content:**
  - `actions.yaml` holds the computer orders: courting and denouncing templates, plus moves specific to Corvan, Thessa, Veskar and Orrin. Severity and detail make them news.
  - Seven event-shaped choices left `events.yaml`.
  - Corvan's reopening of the strait is now both a choice and a backstop: the closure schedules a forced reopening after 120 days, and the event's new `requires` stops it firing if Corvan already reopened by choice.
- **A new measure, `day`**, lets hostile and destabilising moves build up over the opening months, so new players still get a calm start. It was one entry in the measure registry, as designed.
- **Drives must be honest.** Moves that serve standing raise influence; friendly moves leave lasting relation changes. Otherwise a need could never be met and a country would repeat the same move forever. This was the main lesson from balancing: early versions had Thessa courting someone 13 times a game.
- **The web app** reports computer orders as world news tagged with the country. Critical ones (closing the strait) raise the crisis alert. The news links to "Why did Corvan do this?", and only the player's orders count in the end-of-game tallies.

## Consequences

- Balance over 200 games with the standard profile (inertia 22):

  |                             | Idle player           | Steady player |
  | --------------------------- | --------------------- | ------------- |
  | Ousted                      | 84%, earliest day 174 | 0%            |
  | Strait closed at least once | 99%                   | 42%           |

  Before this change the idle player was ousted in about 93% of games, earliest day 157, and the steady player's strait closed in 53%.

- The profiles give a difficulty gradient: `passive` ousts about half of idle players, and `aggressive` nearly all.
- The golden game moved from seed 4, which now survives because its neighbours' needs get met, to seed 3. Seed 3 tells a story involving all four neighbours, ending with the leader ousted on day 246.
- Still open for part 3: the dev panel, ambitions shown to the player, and advisor warnings when a hostile move is close.
