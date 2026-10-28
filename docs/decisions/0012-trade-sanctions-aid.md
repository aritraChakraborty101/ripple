# 0012: Trade, sanctions, aid and treaties

Status: accepted, October 2026

## Context

Step 3 of the content pass design note. The player could only answer one problem, oil through Corvan's strait. With the economy (0010) and orders aimed at a country (0011) in place, this step adds orders that trade one thing against another (money, influence, relations, prices) and computer countries that answer them.

## Decisions

### Engine

- **Embargoes.** A new effect, `embargo: { by, against, active }`. The world keeps embargoes as `by>against`, and `isLinkOpen` treats a route as cut while either side's embargo stands. Each side lifts only its own, so if Aldoria and Thessa both impose sanctions, trade resumes only when both have lifted. The market's why-trace names the embargo, and the order or event behind it, as the cause of a cut route.
- **Tariffs follow trade.** The economy keeps a fifth line, `tariffs`: each country's stat `tariff_<partner>` (basis points) is charged on the value of everything its open routes bring in from that partner. A tariff order is now just a modifier on that stat, so revenue rises with prices and stops under sanctions. The why-trace explains each tariff item by its rate, and the rate by the order that set it.
- **`{self}` and `{target}` inside names.** Templates can reach a stat, link or flag named after a country: `link.deal_{target}.capacity`, `country.self.tariff_{target}`, `treaty_with_{self}`. Content validation expands every such name over every country the template can be bound to, so a missing `deal_<country>` route is a load error, not a runtime one.
- **`endEffectsOf` can name whose effects end** (`target: self`), so Thessa can end the deal Aldoria signed with it.
- **`relation: { untilLifted: true }`**: a relation change that lasts until the order is lifted, for goodwill that belongs to a deal or an aid programme.
- **Gate considerations.** A consideration marked `gate: true` multiplies the appeal after the others combine and does not count toward their compensation. Without this, adding a usually-open check (is there a treaty?) made every hostile action about 7% more appealing, because compensation grows with the number of considerations. A gate changes nothing until it closes.
- **The planner scores only open options.** `rankOpen` checks availability (binding only `requires`) before scoring, in the same order as `rank`, so choices are identical. Without it, a simulated day took twice as long. The new templates aimed at Aldoria are closed most of the time. `rank` still scores everything for the AI dev panel.

### Content

| Order                                   | Kind                            | In short                                                                                                                                   |
| --------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Raise / lift tariffs on {target}        | Policy, Veskar, Orrin or Thessa | A 35% duty on what you buy from them; industry +5, workers −3, relations −30                                                               |
| Sign / end a trade deal with {target}   | Policy, Veskar, Orrin or Thessa | Needs relations of 20+, 10 influence, three weeks at 70%. Opens `deal_<country>` (+5 a day), relations +10 while it lasts                  |
| Impose / lift sanctions on {target}     | Policy, any country             | Embargo, their revenue −10% and stability −5, relations −40, ends any deal. Lifting costs 5 influence and 2 stability for a month          |
| Send emergency aid to {target}          | One-off, any country            | 25 bn: their treasury +25, stability +6 for three months, relations +8 for four                                                            |
| Fund / end an aid programme in {target} | Policy, any country             | 2 bn a month to them, relations +20 while it runs, −10 for four months when it ends                                                        |
| Offer / renounce a friendship treaty    | Policy, any country             | Needs relations of 50+ and 15 influence, a month at 65%. Relations +10 while it lasts; hostile moves by the partner lose half their appeal |

Computer countries answer:

- **Retaliatory duties** (any country under a tariff): Aldoria's import bill +1.5 bn a month for six months. Thessa keeps its own steel-specific answer too.
- **Ending a deal** and **renouncing a treaty** (any partner whose relations sour): only countries with a grudge against Aldoria do it.
- **Thessa's aid** to Corvan or Orrin, once it has money and the year is under way: a rival buying loyalty.
- **Thessa's sanctions** on Aldoria when relations fall below −40, after the first months. Like Corvan's closure, it is a choice with a backstop: Thessa lifts by choice once relations mend, and its own exporters force the sanctions open after eight months if it hasn't. Money alone will not do it: with Aldoria cut off, steel soars and Thessa's other sales earn nearly as much as before.
- **Treaty deterrence**: Corvan's tanker detentions and strait closure, Thessa's troops and sanctions, and anyone's denunciation all carry a treaty gate.

Two advisor tips: a deal when Orrin is friendly, and what to do when Thessa sanctions you.

### Interface

- Undo orders (lift, end, renounce) appear only when there is something to undo, and only for the countries it applies to. Each country's page stays at 6–9 orders.
- Cut routes say "Cut by sanctions" on the map and "Sanctions" on the country page. The why panel names embargoes, tariff rates ("Your tariff on Thessa 35%") and tariff revenue by partner.
- Fixed an existing bug: the why panel's marker for an order took the order card's `.decision` style and drew a large blob. Markers now use `kind-*` classes.

## Consequences

- Balance over 200 games, standard profile:

  |                              | Before (PR #13)       | After                 |
  | ---------------------------- | --------------------- | --------------------- |
  | Idle player ousted           | 79%, earliest day 171 | 79%, earliest day 171 |
  | Idle median day ousted       | 496                   | 560                   |
  | Steady player ousted         | 0%                    | 0%                    |
  | Steady: strait ever closed   | 40%                   | 12%                   |
  | Steady median final treasury | 107 bn                | 142 bn                |

- The steady player now signs deals with friends, sends emergency aid to Corvan when relations sour, and taxes Thessa when short. Aid to Corvan is what holds strait closures down: without it, 35% of its games still see one. A first version (20 bn for +15 relations for six months) was strictly better than transit fees, which fell to 4% closures, so aid was cut to 25 bn for +8 relations for four months. It now stacks with transit fees as a second lever, which seems right for a careful player.
- Transit fees are 55% of the steady player's orders, well above the note's target of 25% or less for step 5. That's a fact about the scripted player as much as the game; Kesh's cheap oil in step 5 should give it alternatives.
- The golden game (seed 3) changed because Thessa now weighs aid, which shifts its random draws. With Thessa's aid switched off, the game replays the old golden exactly. Corvan now closes the strait on day 753, and the leader falls on day 828.
- Speed: a simulated day costs about 460 µs, against 390 µs before, with 36 orders instead of 22. The full balance run takes 4m09s (was 2m46s), partly because idle games now last longer. The profile shows the planner dominating and `effectiveStat` at about 7%, so indexing modifiers by target, the note's plan for a slowdown, would not help. Caching scores between days is the lever if step 5 needs one.
- `GameState` is version 8 (embargoes in the world, `embargoBy` in the trace).
