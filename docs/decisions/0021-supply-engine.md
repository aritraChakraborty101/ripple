# 0021: The supply engine

Status: accepted, November 2026

## Context

PR 1 of the oil chain design note (claude.ai doc "Ripple oil chain: design note", approved 2 November 2026). Oil was one resource with one world price, set every day by open route capacity against demand. It could not express time (tankers at sea), stocks, or processing (refineries), so a closure hit the same day and vanished the day it ended, and nothing could be built.

This PR adds the generic pieces. The first-crisis scenario does not use them yet, so the game plays exactly as before; PR 2 turns its oil into crude and fuel.

## Decisions

- **Stocked resources.** A resource with `stocked: { coverDays }` moves as goods. Others keep trading instantly by route capacity, so commodities can move over one at a time.
- **Stocks are country stats**: `stock_<resource>`, whole units, starting at `coverDays` of the country's own use (what it consumes plus what its plants use up). Effects can `adjust` them, so "release the reserve" can become real barrels. Each country also has a fixed `normalStock`.
- **Shipments.** A stocked route (`days` in links.yaml) sends what the sender can spare each day, up to its capacity, to arrive `days` later. A closed chokepoint or an embargo stops new shipments; goods already on the way still arrive. Every route starts with a full pipeline, so the world starts in balance. Each route records what it sent today as the stat `shipped`.
- **Senders serve themselves first.** A country exports only stock above half its normal stock (`KEEP_FOR_SELF_BP`).
- **Plants** (plants.yaml) are a new entity kind with a `capacity` stat: wells (no input) and refineries (input in, output out, one for one). A fire is an ordinary capacity modifier (`plant.<id>.capacity`). Wells stop pumping once 20 days of output pile up with nowhere to go.
- **The supply system** runs after world events and before the market: arrivals, plants, use, then shipping.
- **Shortage.** Demand a country cannot meet from stock is the stat `shortage_<resource>`. Factions feel it like a price rise of the same percentage, on top of the price.
- **Price.** One world price per good, as decided in the note. For a stocked resource the market's "supply" is the world's usable holdings (each country's stock up to its normal, plus everything at sea) against normal, scaled to a day's demand. Demand includes what plants use up. The price formula is unchanged: holdings at 80% of normal act like supply at 80% of demand. Crude stranded where nobody uses it does not count.
- **Why-trace.** A new `stock` node explains a stock or shortage: routes into the country delivering less than normal (cut, narrowed, or open with a sender that has nothing to spare), and the country's plants making less or starved of input. Market nodes for stocked resources list who holds less than normal, and living-cost nodes show shortages. So a queue at the pump traces back through the refiner's empty tanks to the strait.
- The economy pays exporters for what stocked routes actually shipped.
- Game state version 9: `shipments`, and `plants` in the world.

## Consequences

- Stocks and shipments are presentation-free numbers. The interface shows them in PR 4; until then the why panel already reads them.
- A per-country price and partial unit conversions (other than one for one) are left out on purpose; the note explains why.
