# 0009: Computer countries, part 3: the AI in the interface

Status: accepted, October 2026

## Context

Computer countries act on their own (decision 0008), and the why panel explains each choice after the fact. Two things were missing. Players could not see what their neighbours want before they act. And a developer could not watch or tune the AI while playing.

## Decisions

- **Intelligence warnings** (`apps/web/src/game/intel.ts`). Each day the session asks the clearing house for each computer country's most tempting harmful move. A move is harmful if its content severity is warning or critical. Once a harmful move's score reaches 80% of the inertia it must beat, the news reports it, for example "Corvan is weighing: Close the South Strait. Driven by a grudge against Aldoria (need 90%). It could happen any day." The same warning is not repeated within 60 days. Warnings live in the web session, not the engine: they read the game and never change it.
- **What a country wants** (`CountryMind`). The country panel shows its top goals in plain words with how strongly it feels them, its current ambition with progress, and any harmful move it is weighing. The Relations tab shows each country's ambition under its name.
- **The dev panel** (`?dev`, toggled with the backtick key) shows each computer country's ranked options against the inertia line, with full breakdowns (weight × need × drive, each consideration's curve, odds, tuning), plus urgency, today's chance of acting, resting and noticing, and recent choices. Knobs retune the AI live. The `?ai=` parameter picks a profile.
- **Retuning is recorded.** The engine's `retune(state, overrides)` merges the knobs and appends `{ tick, overrides }` to `state.tuningChanges` (state version 6), so a game stays reproducible from its seed, the player's orders and its tuning changes.
- **Template orders are named in the imperative** ("Court {target}", "Denounce {target}"), like every other order. Headlines keep `{self}` ("Corvan denounces Aldoria").

## Consequences

- In the golden game (seed 3), every move by Corvan was warned about 5 to 36 days ahead, including the strait closure. Warnings arrive about once a month, so the news stays readable.
- Warnings use the same scores the countries decide by, so they are never wrong about why. They can still be wrong about when, because acting is a daily roll.
- Next possible steps: suggesting the player's orders that would lower a weighed move's score, and showing each country's mood over time in the dev panel.
