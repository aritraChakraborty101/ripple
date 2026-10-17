# 0004: Onboarding through play

Status: accepted, October 2026

## Context

A first playtester opened the game and did not know what to do: no goal was stated, nothing pointed at a first move, and the first crisis could take months of game time to arrive.

## Decisions

- **Teach through play, not a tutorial.** Five small layers instead of one long walkthrough:
  1. An opening **briefing** (who you are, how you win or lose, your weak spot, how to act), shown once per browser and available again from How to play.
  2. A **first-steps checklist** (press play, click the focus country, sign an order, open Home) that ticks itself off as the player does each thing. The play button pulses and the focus country is ringed until the relevant step is done.
  3. An **advisor** whose tips appear when their condition holds, with the recommended orders ready to sign in the tip itself.
  4. **Hints** on every top-bar number and a one-page **How to play** reference (`?`).
  5. A **gentler opening**: a mild customs slight from Corvan in the first weeks, and the first real dispute no earlier than day 45.
- **The guide is content, not code.** `briefing.yaml` and `advisor.yaml` live with the scenario and are validated against it (orders, countries and stats must exist).
- **The guide never changes the game.** Tips cannot use `chance`, the state returned when evaluating a tip is discarded, and a test plays 400 days with and without the advisor and requires identical game states.
- **Per-browser memory is a convenience.** Whether the briefing was seen and which first steps are done are stored in `localStorage` when available; the game behaves the same without it.

## Consequences

- The earliest an idle player is ousted moved from about day 89 to about day 157 (200 simulated games), so new players have time to learn the screen.
- The recorded golden game moved from seed 1 to seed 4, which now tells the full Corvan story: customs slight, fishing dispute, detained tanker, nationalist rallies, strait closure, ousted on day 273.
