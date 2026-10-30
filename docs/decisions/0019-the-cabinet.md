# 0019: The cabinet, and the side panel retires

Status: accepted, October 2026

## Context

PR 5, the last of the interface pass. Orders lived in one long dialog of about thirty cards, and the right side still held a tabbed side panel (news, home, relations) from before art direction D. The design note asks for a full-screen cabinet, filed by ministry, with orders aimed at a country picked on the map.

## Decisions

- **Ministries live in content.** Each player order in `decisions.yaml` has `ministry: foreign | trade | treasury | interior | intelligence`. It is optional in the schema and ignored by the rules (`DecisionDef.ministry`, presentation only). A content test checks that every player order is filed and no computer order is. A new order says where it belongs, in the same place it says everything else.
- **The cabinet** (`Cabinet`, logic in `src/game/cabinet.ts`) is a paper sheet over the dimmed map: ministries down the left, each with its brief and "N of M ready", and that ministry's orders in a two-column grid. Undo orders appear only where they apply.
- **Aim on the map.** An order aimed at a country can still be aimed with its country chips, or with "Choose on the map": the cabinet closes, a banner names the order, countries it can reach get a dashed amber outline, and the rest fade. One click signs it; Esc or Cancel backs out.
- **The cabinet button** sits bottom right, as paper: "Cabinet · N orders to sign". `D` still opens it.
- **The side panel retires.** The right column is now memos on top, the pile of reports below, and the cabinet button. The Relations tab is replaced by the Relations lens. The Home tab moves to your own country's page: click Aldoria (first steps and the advisor say so). "Pause when a crisis breaks" and "New game" move into the help sheet, under "This game".

## Consequences

- With PR 5, every piece of the design note's plan is built: the stage, memos, the ripple, lenses and the cabinet.
- The briefing and the advisor's "stability sliding" tip are reworded for the new screen.
- `Relations.tsx`, `SidePanel.tsx` and `DecisionsDialog.tsx` are gone.
