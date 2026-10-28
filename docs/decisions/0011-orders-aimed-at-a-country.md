# 0011: Orders aimed at a country

Status: accepted, October 2026

## Context

The content pass adds about fourteen orders, and most of them are aimed at a country: a trade deal with someone, sanctions on someone, aid to someone. Written one per country, eight countries would turn 14 orders into over 80 cards. Computer countries already use templates (`self` and `target`, decision 0008); the player could not. This is step 2 of the content pass design note, and it adds no new kinds of content on purpose, so the plumbing can be reviewed on its own.

## Decisions

- **Player orders can be templates.** A player decision with `targets` (a list, or `others`) is bound like a computer order: `self` is the player, `target` the chosen country. `boundDecision` now binds any template, not only computer orders. Orders carry the target from signing to resolution, and so do modifier sources, so the why panel says "You signed: Send an envoy to Corvan".
- **Flags can carry the target.** `{self}` and `{target}` are bound inside flag names, in conditions, `setFlag`, `clearFlag` and `policyFlag`. A policy such as `tariff_on_{target}` can then be in force against several countries at once. `policiesInForce` returns each policy with its target, and `policyForFlag` lets the why panel name the policy behind a flag.
- **`endEffectsOf` in a template ends only what was done to the same target.** Lifting tariffs on Thessa must not lift tariffs on anyone else.
- **`perTarget: true` keeps cooldowns and "already under way" per target**, so an envoy to Corvan does not hold up one to Orrin. It is opt-in: computer templates keep one cooldown across targets, as before, so their balance does not move.
- **Availability takes a target.** `canIssue(state, id, by, target)`; without a target, a template answers whether it can be aimed at anyone at all, which is what the advisor needs.
- **Content:**
  - The two envoys become one template, "Send an envoy to {target}", aimed at any other country: 8 influence, about two weeks, 60% odds, +18 relations for four months. Thessa, Veskar and Orrin can now be courted too.
  - The Veskar envoy's real effect was a crude discount, not talks, so it stays its own order: "Ask Veskar for a crude discount". Merging it would have lost the player's main lever in an oil crisis.
  - Tariffs and lifting them become templates with the flag `tariff_on_{target}`, aimed only at Thessa for now. Tariffs on other suppliers wait for step 3, when tariff revenue will follow what Aldoria actually imports; a flat 3 bn a month from any country would be an exploit.
  - Thessa's retaliation now reads `tariff_on_thessa`.
- **The advisor** suggests an aimed order as `decision>target` (`envoy>corvan`); the guide checks that the target is one the order can reach.
- **The web app** shows one card per template with a row of country chips; busy or unavailable countries are dashed and say why on hover. A country's page and the advisor show the order already aimed at that country. Names, descriptions, reasons, headlines, chips under Unfolding and news fill in the country's name.

## Consequences

- The order list stays at nine cards while the envoy now reaches four countries. Step 3 adds trade, sanctions and aid as templates, so the cabinet grows by a handful of cards rather than dozens.
- Balance over 200 games: the idle player is unchanged (79% ousted, earliest day 171). The steady player is still never ousted; the strait closed in 40% of its games (was 37%). An envoy to Corvan now names Corvan as its target, so Corvan notices it like any order aimed at it, which nudges its attention.
- `{target}` in text is filled by the interface, not the engine, so the engine's reasons read "Tariffs on {target} are already in force" until the interface names the country.
