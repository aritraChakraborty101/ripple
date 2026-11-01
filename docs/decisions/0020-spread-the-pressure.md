# 0020: Spread the pressure beyond Corvan

Status: accepted, November 2026

## Context

After playing the interface pass, Aritra found that Corvan "has quite a lot of power". Measured over 40 two-year games, Corvan made 6.0 of about 9 harmful moves a game (65%) for an idle player, and 5.3 (about 55%) even for a player who kept talking to it. It moved first in 38 of 40 games. Ilmar, Kesh and Velmont made no harmful moves at all, and the Narrows were closed 1% of the time. The trouble came from one direction. Raising transit fees, Corvan's most frequent move, served only its wealth, so goodwill could not stop it.

## Decisions

- **Corvan's fee rises answer to you.** `corvan_raise_fees` now weighs relations with Aldoria (none at +25, full at −25), starts later in the year (day 45 to 150), and waits 180 days between rises, not 120. Transit fees, aid and talks now buy calm. The strait closure itself is unchanged: it is the game's signature moment, and talking to Corvan already prevents most closures.
- **Kesh squeezes when broke.** A new `kesh_raise_crude` (oil +6% for two months, Kesh +15 bn), driven by its wealth and balance and weighted by how empty its treasury is. It is not aimed at Aldoria, but Aldoria pays.
- **Ilmar uses its chips.** `ilmar_restrict_chips` served `standing`, a goal Ilmar does not have, so it never scored high enough to happen. It now serves wealth and security, follows chip prices instead of Ilmar's feud with Thessa, and waits 240 days, not 300.
- **Thessa searches the Narrows sooner** (from relations +5, full at −35).
- **Intelligence warns about the most severe move.** `brewing` used to report each country's highest-scoring harmful move, so a likely denunciation could hide a strait about to close. It now reports the most severe move near tipping over. Every strait closure in the first 16 seeds is now warned about first (15 of 16 before).
- **The balance tool reports who makes the trouble:** harmful moves (warning or critical news) by country, and how many a game. A new target: when the player deals with the country that threatens them, no one country makes more than 40% of the harmful moves.

## Results

Standard profile, 200 games each:

| Measure                             | Target   | Before (0014)                            | Now                                                     |
| ----------------------------------- | -------- | ---------------------------------------- | ------------------------------------------------------- |
| Idle ousted                         | 75–90%   | 87%                                      | 88%                                                     |
| Earliest idle ousting               | day 150+ | 161                                      | 155                                                     |
| Idle first-crisis causes at 15%+    | 3+       | strait 49%, Kesh coup 27%, explosion 19% | strait 53%, Kesh coup 29%, explosion 15%                |
| Steady ousted                       | ≤5%      | 2%                                       | 2%                                                      |
| Steady top order                    | ≤25%     | 19%                                      | trade deal 19%                                          |
| Steady harmful moves, largest share | ≤40%     | not measured                             | Kesh 29%, Veskar 25%, Corvan 17%, Thessa 15%, Ilmar 14% |
| Idle harmful moves, Corvan's share  | lower    | about 65% (40 games)                     | 48%                                                     |

An idle player still meets Corvan most, which is fair: ignoring a grudge lets it grow. A player who deals with Corvan now faces trouble from five countries.

## Consequences

- The golden game stays on seed 5, re-recorded: Corvan closes the strait on day 158 (was 176) and the leader falls on day 214 (was 230). Kesh raises its crude on day 108, alongside Corvan's first fee rise.
- Kesh raises its crude about seven times in a five-year steady game. If that reads as repetitive in play, a longer cooldown is the knob.
