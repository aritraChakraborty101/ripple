# 0013: Propaganda, intelligence and home policies

Status: accepted, October 2026

## Context

Step 4 of the content pass design note. Steps 1–3 gave the player money and outward-facing tools (trade, sanctions, aid). This step adds the softer tools a government has: shaping opinion abroad, watching its rivals, and managing its own budget and people.

## Decisions

### Engine

- **Demand is a stat.** Each country's demand for a resource is the stat `demand_<resource>`, seeded from `countries.yaml`. The market and the import bill read it through `demandOf`, so rationing is an ordinary modifier. The market's why node gained `demands`: countries wanting more or less than normal, with the cause. The switch alone changed nothing: every test and the golden game passed before any content used it.
- No other engine changes. Intelligence files, unrest and covert moves are content on top of stats, gates and templates from steps 2–3.

### Content

| Order                                 | Kind                       | In short                                                                                                                                 |
| ------------------------------------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Broadcast into {target}               | Any country                | 10 influence, a month at 65%. Relations +10 for good; if exposed, −15 for four months                                                    |
| Rally the nation against {target}     | Any country, one at a time | 3 influence. Stability +6 and workers +4 for two months; relations −20 for good                                                          |
| Open an intelligence file on {target} | Any country                | 10 bn for four months: earlier warnings, its budget visible, and covert moves against you less tempting                                  |
| Stir unrest in {target}               | Any country                | 20 bn and 8 influence, six weeks at 55%. Their stability −15 for four months; if caught, relations −30 for good and stability −4 at home |
| Impose / end austerity                | Policy                     | Spending −3 bn a month; workers −8, industry −2                                                                                          |
| Fund / end public works               | Policy                     | Spending +3.5 bn a month; workers +5, industry +3. Not with austerity                                                                    |
| Raise / cut taxes                     | Policy                     | Revenue +10%; every faction −4                                                                                                           |
| Ration fuel / end rationing           | Policy                     | Aldoria's crude demand −8 a day (a fifth); industry −8, workers −3                                                                       |
| Refill the strategic reserve          | Once it has been used      | 50 bn and three months; the reserve can then be released again                                                                           |

- **Unrest matters for computer countries.** Their hostile moves (Corvan detaining tankers and closing the strait; Thessa's troops, sanctions and agitators) now carry a stability gate: a government shaken below its starting stability has less appetite for adventures abroad. The gates are open at normal stability, so they change nothing until something shakes a country.
- **Thessa funds agitators in Aldoria** when relations fall below −25 and the first months have passed. Workers −6 and stability −3 for three months. It is covert: if it fails, the news reports "Aldoria uncovers Thessan agents funding strikes" and Thessa loses standing. An intelligence file on Thessa halves its appetite for the move.
- **News reports a computer country's failure** when content gives it a failure headline. Until now, computer failures were always silent.
- Advisor: austerity joins the low-treasury tip, an intelligence file joins the angry-Thessa tip, and a new tip suggests rationing once crude has doubled.

### Interface

- **Intelligence files.** With a file open on a country, warnings of its harmful moves appear at 55% of the score it must beat instead of 80%, and its page shows its treasury and this month's balance. Without a file, the page says how to see them.
- The why panel names demand ("Your crude oil demand 32 a day"), intelligence files and the market's demand changes beside its supply changes.

## Consequences

- Balance over 200 games, standard profile:

  |                              | Before (PR #14)       | After                 |
  | ---------------------------- | --------------------- | --------------------- |
  | Idle player ousted           | 79%, earliest day 171 | 79%, earliest day 171 |
  | Steady player ousted         | 0%                    | 1%                    |
  | Steady: strait ever closed   | 12%                   | 13%                   |
  | Steady median final treasury | 142 bn                | 136 bn                |

  The idle player and the golden game are unchanged: the new computer move and the stability gates only come into play once the player provokes Thessa or shakes a government. When Aldoria taxes Thessa from day one, Thessa answers over two years with duties (1.3 a game), curbed steel (1.1), troops (0.4), agitators (0.2) and sanctions (0.1).

- The steady player rations fuel in deep oil crises, funds public works when the mood sours and money allows, and turns to austerity when broke. It does not open intelligence files: they change what a person sees, which a script cannot use. A first version that did spent about 45 bn a game on them, ending with 87 bn and 4% ousted.
- Influence is now spent by eight different orders and still never regenerates. This is the scarcest resource in the game; whether it should recover slowly is a question for the balance pass in step 5.
- A simulated day costs about 370–460 µs (machine noise); the balance run takes about 4 minutes.
