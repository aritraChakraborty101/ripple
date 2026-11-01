# 0015: Art direction D, and the stage

Status: accepted, October 2026

## Context

After the content pass, the game read as "a glorified dashboard": the map sat in a card, everything else was tiles and lists, colour meant nothing, and consequences arrived as text. Five art directions were mocked up on one canvas, all showing the same moment (Corvan has just closed the strait). Aritra liked the desk (B) but found it too medieval, and the war room (A) promising but too cyberpunk. Two in-between directions followed; he chose **D, the Briefing Room**: a modern atlas at night with briefing papers landing on it.

The interface pass design note (claude.ai doc "Ripple interface pass: design note", approved 30 October 2026) plans five pull requests: the stage, memos, the ripple, lenses and the cabinet. This record covers the direction and the first of them.

## Decisions

- **Every colour means one thing.** All colours live in `apps/web/src/tokens.css`: amber `--you` for Aldoria and anything yours, red `--threat` for hostile, broken or falling, blue `--friend` for warm relations, a night sea with three coastal depth halos, and paper `#F5F3EF` for anything you read and decide on. The old token names stay as aliases until each component is rebuilt, so the whole interface speaks D from this PR on. Swapping direction later means editing one file.
- **Two typefaces, self-hosted.** Newsreader (variable) for headlines, names and big numbers; IBM Plex Sans for interface text, with tabular figures everywhere. Both come from `@fontsource` packages, so the game no longer depends on Google Fonts at runtime.
- **The map fills the screen.** The interface floats over it in corners: the nameplate and clock top left, the three meters top right, markets and orders under way bottom left, the briefing column on the right. The map keeps clear of them by inset, not by a box.
- **The map reads like an atlas.** Coastal halos, uppercase serif country names, a relation number under each name in its meaning's colour, and hostile countries filled red. Links that share a path and a state are drawn as one line (with every resource in its tooltip), which halves the number of lines.
- **The header is split** into `Nameplate`, `Meters` and `Markets`. Stability, Treasury and Influence are each one card with a big serif number and one plain line; each opens the why panel.
- **Speed on `+` and `−`.** These change speed without starting or stopping the clock. Number keys still pick speeds until lenses take them (PR 4 of the pass).
- **Desktop first**, from 1280 × 720. The old stacked layout below 960 px is removed; phones get their own design later.

## Consequences

- Crisis banner, advisor, side panel and drawer keep their content and logic but sit on dark glass in the new layout. PR 2 turns them into briefing memos.
- Fewer route lines makes the map calmer, but routes still start at each country's anchor. The Trade lens (PR 4) is where trade gets its proper picture.
