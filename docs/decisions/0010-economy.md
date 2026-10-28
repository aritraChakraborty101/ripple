# 0010: The economy: budgets that feel prices

Status: accepted, October 2026

## Context

The content pass design note ("Ripple content pass: design note", 28 October 2026) puts the economy first: until money flows, the treasury is a pot that moves only when an order or event touches it, so spending has no lasting cost and price shocks never reach the budget. Every later order (trade deals, sanctions, aid, home policies) needs a budget to trade against.

## Decisions

- **One new system, `economy`** (`engine/src/systems/economy.ts`), runs after `society` and before `outcome`, so it reads the day's prices and moods and the outcome sees any debt penalty the same day. (The note placed it before `society`; after is more correct and changes nothing else.)
- **Budget lines are stats.** A country keeps a budget only if it declares `revenue` and `spending` stats, counted in millions a month: taxes and upkeep before trade. The system keeps four system modifiers on them, recalculated daily, exactly as `society` keeps `cost_of_living`:
  - `imports` on spending: everything the country consumes at the market price. Shortages are bought dear, so a closed strait raises the bill rather than shrinking it.
  - `exports` on revenue: what its open routes carry out, at the market price.
  - `transit` on revenue: a toll (a chokepoint's new `tollBp`) on the value of goods passing through chokepoints it holds.
  - `activity` on revenue: taxes move 0.5% per point of power-weighted faction satisfaction.
- **Monthly settlement.** Each day accrues revenue minus spending; on the last day of each month whole billions move into the treasury and the rest carries over. The treasury stays in integer billions, so no existing cost changes units. A `budget_settled` event reports each month.
- **Debt is not defeat.** Below zero, `fiscal_stress` takes 3 stability plus 1 per 10 bn of debt (up to 15), and 2 influence plus 1 per 20 bn (up to 10). Ousting remains the only way to lose.
- **Policies are running lines.** A tariff or subsidy is a `modify` on `revenue` or `spending`: with `days` for a fixed term, without for a policy that `endEffectsOf` lifts. No new effect kind.
  - The steel tariff now pays 3 bn a month while in force, instead of 35 bn once.
  - The fuel subsidy costs 13 bn a month for three months (39 bn), instead of 40 bn at signing.
  - Factory layoffs cut revenue by 2 bn a month for three months, instead of 15 bn once.
- **The why-trace** follows money like any other number. The treasury's normal is its starting value; the budget is a drift on top, explained as a `budget` node (bn settled over n months), then revenue and spending, then `trade` nodes per line (units a day and millions a month per resource), then prices, routes and chokepoints. One-off spending stays a separate, lasting adjustment. `activity` and `debt` nodes explain the other two lines.
- **Scale.** `TRADE_CENTS_PER_MILLION = 35`: 35 cents of goods a day is worth a million a month, so Aldoria's normal oil bill is about 8.3 bn a month. Each country is calibrated to a small surplus at normal prices; Aldoria's is about 0.5 bn a month. An earlier calibration at 2 bn a month left the steady player with a median 198 bn at the end of a game, so money stopped mattering.
- **The web app** shows the treasury with this month's balance ("+0.5 bn/mo") and a trend line, and clicking it opens the why panel. A month that ends in deficit is news, naming the dearest import; surplus months stay quiet. Order cards list running costs ("13 bn a month for 3 months").

## Consequences

- Balance over 200 games, standard profile:

  |                              | Before (PR #11) | After      |
  | ---------------------------- | --------------- | ---------- |
  | Idle player ousted           | 84%             | 79%        |
  | Earliest idle ousting        | day 174         | day 171    |
  | Steady player ousted         | 0%              | 0%         |
  | Idle median final treasury   | 397 bn          | 364 bn     |
  | Steady median final treasury | 22 bn           | 108 bn     |
  | Strait closed, idle / steady | 99% / 42%       | 100% / 37% |

- A 60-day closure of the South Strait costs Aldoria about 22 bn in the two months it settles, with more still accruing, and puts Corvan in deficit as its tolls vanish. Corvan's AI does not yet weigh that loss; the `balance` goal in a later PR will.
- The golden game (seed 3) changed: computer countries' treasuries now move, which shifts their wealth needs. Corvan keeps squeezing through fees and only closes the strait on day 421, after Thessa's second pact and nationalist rallies; the leader falls on day 492 (was 246). The story is longer and more political, and the aggregate outcomes barely moved.
- The balance run takes about 37% longer (2m46s against 2m01s) because of the extra modifier reads. Under the note's threshold for indexing modifiers, so `effectiveStat` stays as it is for now.
- `GameState` is version 7 with a `budgets` record.
