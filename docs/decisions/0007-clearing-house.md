# 0007: Computer countries, part 1: the clearing house

Status: accepted, October 2026

## Context

The other countries should pursue their own goals, not only react to triggers (see the design note "Computer-run countries"). The work is split into three pull requests:

1. The clearing house and its building blocks, with no change to how the game plays. **This one.**
2. Computer countries acting, the content move from events to actions, and the news.
3. The dev panel, advisor warnings and ambitions in the UI.

## Decisions

- **One clearing house answers every scoring question.** `engine/src/ai/clearing-house.ts` exposes `score`, `rank`, `urgency` and `candidates`. Each is a pure function of the game state, and every answer is a `ScoreReport` with its full breakdown: goal parts, appeal, odds, tuning multiplier, ambition and availability. Computer countries, the advisor, the why-trace, the dev panel and the balance tool will all ask it, so they can never disagree.
- **Scores come from needs, so countries act on their own.** `value = sum of weight x need x drive`. A goal's need is the gap to the country's aspiration, so poor Corvan wants money in a calm world. `appeal` is the product of considerations (response curves), with Dave Mark's compensation factor so actions with more checks are not penalised for it. `score = value x appeal x odds x the action's tuning multiplier`. Doing nothing scores the inertia (25 by default).
- **Small files, one idea each:** `curves.ts`, `measures.ts` (the registry of what the AI can read), `goals.ts` (the goal vocabulary, needs and ambitions), `templates.ts` (`self` and `target` placeholders), `tuning.ts` (layered knobs) and `clearing-house.ts`.
- **Goal IDs carry their argument:** `wealth`, `ties(thessa)`, `grievance(aldoria)`, `prices(oil)`. An action that drives `ties(target)` serves whichever country it is aimed at, which is what makes templates work.
- **Knobs are added when code uses them.** This step has inertia, temperature, hostility, cooperation, ambition boost, compensation, per-country weights and per-action switches and multipliers. Attention, noticing and rest arrive with the planner in part 2. Unknown knobs in `ai-tuning.yaml` are rejected.
- **Content:**
  - `ai.yaml` holds personalities: goals with weights adding up to 100, aspirations, and ambitions.
  - `ai-tuning.yaml` holds named profiles in friendly units (an inertia of 25, a hostility of 1.5), converted to integers on load.
  - Decisions gain `for`, `targets`, `drives` and `consider`.
  - Validation checks every reference, allows `self` and `target` only in computer orders (and `target` only in templates), and reserves both as IDs.
- **Who may sign what:** `canIssue` uses `isFor`. Orders without `for` stay player-only, and computer orders are not the player's. The web app lists only the player's orders.
- **State version 4** carries `defs.ai`: the personalities and the tuning in force, chosen by `createGame(scenario, seed, { aiProfile, tuning })`.

## Consequences

- No behaviour change: `first-crisis` has personalities but no computer orders yet, so every country's best option is doing nothing. All earlier tests and golden games pass unchanged.
- The design note's worked examples are tests with exact numbers: Corvan in peacetime raises fees (100.8), and in the crisis closes the strait (73.8).
- Ambitions are stateless for now: a country's ambition is its first unmet one. Ambitions that need time ("oil high for 60 days") would need progress kept in state, so they wait for part 2.
- Cooldowns and "already under way" apply per action, not per target, so a country courting Thessa cannot court Veskar the same week. That is acceptable pacing for now.
