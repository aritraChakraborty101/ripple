# 0016: Briefing memos, and paper

Status: accepted, October 2026

## Context

PR 2 of the interface pass. In art direction D (record 0015), dark glass is for things you glance at and paper is for things you read and decide on. Crises arrived as a red banner over the map, the advisor as a dark card, the news as a wall of text and the why panel as a dark dialog.

## Decisions

- **Paper is a surface, not a component.** The `.paper` class (and every `.sheet` dialog) redefines the shared token names to ink on paper. Any component placed on paper, such as an order card inside a memo, reads correctly without knowing where it is.
- **Memos.** `Memo` is a paper card with a banner and a dismiss button. A crisis lands as an **Urgent** memo (red banner, serif headline, Respond and "Why did this happen?") at the top of the right column; the advisor's tip lands as an **advice** memo with its orders ready to sign. One memo is open at a time, and a crisis takes precedence over advice.
- **Urgent memos pause; reports never do.** This is the existing "Pause when a crisis breaks" setting, on by default, and it fires only for critical world events.
- **The pile.** The News tab becomes **Reports**: each dispatch is a paper slip with a top edge that marks a crisis in red, newest first, older ones slightly sunk. The first-steps checklist sits on top of the pile as a slip of its own.
- **Every dialog is paper**: the why panel, briefing, help, orders and game over. The why panel's short chain is now headed "How it came to this".
- Memos land with a short drop (360 ms), not at all when the player prefers reduced motion.

## Consequences

- The centred crisis banner is gone, so the map's middle is never covered.
- The right column is busier while the side panel still exists. PR 5 (the cabinet) moves orders out of it and retires the side panel.
