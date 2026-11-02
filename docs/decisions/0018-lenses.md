# 0018: Map lenses

Status: accepted, October 2026

## Context

PR 4 of the interface pass. The map showed one thing (relations with you), and everything else lived in lists. The design note's hooks table names a lens for every system: Relations, Trade, Prices, Unrest and Intelligence.

## Decisions

- **A lens recolours the map and never opens a panel.** `lensView(game, lens)` in `src/game/lenses.ts` is pure. For each country it returns a land colour, a short note under the name and whether to dim it; for each link, a width, a colour and an opacity. The map draws whatever comes back, so a new lens is one function.
- **What each lens answers:**

  | Lens         | Question                                  | Countries                                                   | Routes                                                   |
  | ------------ | ----------------------------------------- | ----------------------------------------------------------- | -------------------------------------------------------- |
  | Relations    | Who is with you, and who against?         | Relation number; hostile land red                           | Quiet                                                    |
  | Trade        | What flows where, and what you pay for it | What each sells most of                                     | Width by value a day; amber into Aldoria, blue out of it |
  | Prices       | Which goods are dear, and who sells them  | Each exporter's main good and its price change              | Amber at +10%, red at +30%                               |
  | Unrest       | Which governments are shaky               | Each country's stability; shaky land rust, falling land red | Faint                                                    |
  | Intelligence | What your files say others are weighing   | "Weighing: …" in red, "File open" or "No file" (dimmed)     | Faint                                                    |

  A cut route is dashed red in every lens.

- **Rust for "uneasy".** The Unrest lens needed a colour for uneasy-but-not-falling that isn't Aldoria's amber, so tokens gain `--shaky`.
- **Keys 1–5 pick lenses**, as agreed in the design note. Speed is on `+` and `−` (record 0015), and the help lists both.
- **The lens bar** sits bottom centre, in the gap between the left dock and the right column, with the current lens's question in italics above it. The left dock is narrowed to 410 px to make room.

## Consequences

- Trade finally has a picture: the oil lines through the strait into Aldoria are visibly the thickest, which is the game's whole premise.
- The Intelligence lens runs the AI's rankings for every country, so it is computed only when the game changes, not every frame.
