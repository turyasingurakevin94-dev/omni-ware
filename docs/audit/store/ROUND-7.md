# Round 7: Premium UI at 360px   (brief received 23 Oct 2026, build 23 Oct 2026 20:56 UTC)

Canvas: https://claude.ai/artifact/LVsyQEintezbVH3qn4cSVi, row "Audit round 7 · premium at 360" (bottom of the canvas, version 106).
Migration: none planned (see the #0494 note at the end).
Do not regress (round 6): names by member, "End my shift", "Not paid yet", shared counts, With Ruth lists every waiting ask, the quiet bell, "Order #…" in stock history, durations vs clock times, lower-case units.

Reproduced in the harness before planning, with a new `#r7` fixture: #0574's 10 Dozen with 20 Dozen to a Ctn and its count due, #0566's 19 Box at the gate, a hired driver, the shop "Omni-ware (old records)". Every item below was seen at 360 px.

## What was found

| ID | Root cause |
|---|---|
| STO-UI-01 | A line sold "by the pack" (`qtyIn: 'pack'`) makes `quoteLinePack` return `whole: true` with `packs = qty / packQty`, even when that is not a whole number (10 / 20 = 0.5). `quoteLineCountPer` then counts in cartons, and `quoteLineCount` divides: "0.5 ctn", "0.95 ctn". Pack (card, counter, button), Hand over (the slip), the delivery receipt and the collect receipt all print through `quoteLineCount`. The card's "per pack" line is built from `quoteLineCount(it, 1).unit` (already the carton), so it reads "20 ctn to a Ctn". Round 2's FLOW-01 fixed check-in only (`lineLevels`). |
| STO-UI-02 | `pkPick` opens a line at `floor(shelf / per) × per`. With per = 20 and 14 dozen on the books that is 0, so Pack opens at 0. The hint then says "short" and the main button becomes "Pack short · 0 of 0.5". A count-due item's shelf figure is the one we trust least, yet it decides the default. |
| STO-UI-03 | The play button sits 26 px above the bar (`.st-nav .st-go { margin-top: -26px }`, plus a 4 px ring). `#st_app` keeps 132 px free at the end, which helps only once you have scrolled to the bottom. At rest the button covers whatever is at that height: bays 2 and 3 on Today, the 4th "Needs a look" row, the last On the road card, Returns' 4th row. |
| STO-UI-04 | Measured at 360: Find's input 138×21 inside a 48 px box, Clear 32×32, filter chips 34 tall, the item page's Aisle pill 67×32, Pack's "See Aisle" pill 38 (and 34 on the next card), Returns' search input 278×21. |
| STO-UI-05 | No scale. On the eight screens of this brief the harness counts these values. **Font sizes:** 11, 12, 13, 14, 15, 16, 17, 18, 20, 22, 24, 28 and 40. **Gaps:** 1–22 px (13 values). **Radii:** 23 across the file. **Shadows:** 179 variants. Store has a few colour variables (`--navy`, `--ink2`, `--red`…), but most colours are written inline. |
| STO-UI-06 | The header's second line is a wrapping flex row of "day · shop · yard" with a dot separator after each item, then the status. At 360 a long shop name wraps after a dot, and "Live" lands alone on the next line. The "to pack" tile puts "+1 waiting" on the number's line at 11 px. |
| STO-UI-07 | The slip prints `S.shopName` in capitals at 11 px with .14em letter-spacing, two lines allowed. It prints `fullName(it)` as one string, so a variant like `2"` wraps alone. The people picker is one row of up to five 60 px tiles, with names cut by an ellipsis ("Munyar…"). |
| STO-UI-08 | `thumbOf` picks a drawing by words in the name (`KINDS`); anything else gets the cube. A product with a photo URL that fails to load shows an empty beige tile, because `<img>` has no fallback. Silicone, saws, locks and screws have no drawing. |
| STO-UI-09 | On the road's `stepDots` draws a home block, a line and one dot per stop still out. A driver with one or two stops shows "home ——— ○", which says nothing. A hired driver gets the same round avatar as staff, only "· hired" after the name. |

## Design changes (canvas)

| ID | Board(s) | Before → After | States drawn | Tokens/components used | New component? |
|---|---|---|---|---|---|
| STO-UI-05 | `Scale` | The scale, drawn first. **Type:** 12 / 14 / 16 / 20 / 28 / 40 with weights; figures in Plex Mono. **Radius:** 8 / 14 / 22 / pill. **Shadow:** card / raised / sheet. **Space:** 4 / 8 / 12 / 16 / 24 / 32. **Tap:** 44. **Colour:** the 18 colours in use, named. | one | all | Yes: the scale itself, as CSS variables. |
| STO-UI-01 / 02 | `PackWholeUnits` | Before: "0.5 ctn", "20 ctn to a Ctn", opens at 0, "Pack short" main. After, count due: "10 dozen", "20 dozen to a ctn · off our shelf", opens at 10 with an amber "Count due · count as you pick", red "Packed · 10 dozen". After, a carton and some: "1 ctn + 4 box", counter in box, "Packed · 1 ctn + 4 box". | before, count due, mixed | Pack card, stepper, amber pill, red button | No |
| STO-UI-01 / 07 | `HandOverWhole` | Before: "0.95 ctn", "OMNI-WARE (OLD / RECORDS)", name wraps mid-variant, "Munyar…". After at the gate: "19 box"; the shop on one line ("OMNI-WARE"); the name with its variant as tags (as Stock does); the picker 3 to a row with first names in full (2 lines at most). After, the delivery and collect receipts: the same formatter ("1 ctn + 4 box", "10 dozen", "19 box"). | before, after, receipts | slip, tags (`.pv`), picker | No |
| STO-UI-03 | `PlayButtonRoom` | **Before:** at rest, the button sits on content. **Option A:** keep the floating button and add bottom room equal to bar + button + 16 px. This helps only once you have scrolled to the end; at rest it still covers. **Option B (chosen):** dock the button inside the white bar (60 px in a 76 px bar, count badge on it). Nothing scrolls under it, and every screen keeps room equal to the bar + 16 px. | before, A, B | nav bar, play button | No |
| STO-UI-04 | `TapTargets44` | Before (red rings): field 21 px, Clear 32, chips 34 in two rows, Aisle 32 and 38. After: the whole 48 px box is the field; Clear has a 44 px hit area; the chips are 44 px tall and scroll on one line; both Aisle pills are 44 px. Dashed outlines show the hit areas. | before, after (focused field) | search box, chips, pills | No |
| STO-UI-06 | `TodayHeader360` | Before: wraps, ends on "·", "Live" alone; the tile is cramped. After: "Sat 17 Oct · Omni-ware (old records)" on one line, giving way with "…"; the status as a pill (Live / Offline / Not sent · 2); the tile shows "1", then "to pack", then "+1 waiting" on its own line. | before, after, the pill's 3 states | hero, pill | No |
| STO-UI-08 | `PictureFallback` | Before: blank tiles, cubes, photos and drawings mixed. After: a photo when there is one, else a drawing for the category on its tint. New drawings for locks, fixings, tools, and glue and sealant join bags and roofing. A photo that fails to load falls back to the drawing. | before, after, the drawing set | thumb, category tints | No (new drawings in the existing set) |
| STO-UI-09 | `OnTheRoadStops` | Before: a line with one dot; staff Abudu and hired Abudu look alike. After: a segmented bar, "1 of 3 stops done", with the stop already done listed at its time; a hired driver reads "Abudu (hired)" with a square, dashed amber avatar. | before, after | segmented bar, avatar | No |

## Code changes planned

| ID | Sev | File / function | Change (one line) | UI? | Acceptance check |
|---|---|---|---|---|---|
| STO-UI-01 | P1 | `store.html`: `quoteLinePack` (whole packs only when `qty` is a whole number of packs), a new `lineQty(it, n)` that returns the levels ("1 ctn + 4 box") through `backText`/`lineLevels`, used by `PAGE.pack` (card, counter, button), `PAGE.slip`, the delivery receipt and the collect receipt; the card's sub reads `${packQty} ${unit} to a ${packUnit}` | One formatter: whole packs, then the rest in the line's unit. | yes | #0574 reads "10 dozen" and "20 dozen to a ctn"; #0566 reads "19 box". A harness grep finds no `0.` quantity on any screen. |
| STO-UI-02 | P2 | `store.html`: `pkPick` opens a count-due line (and, if Kevin agrees in Q2, every line) at the ordered quantity; the shelf figure becomes a hint ("Count due · count as you pick", or "The shelf shows 6 · count what you pick") | The packer counts; the books only hint. | yes | Opening #0574 shows "Packed · 10 dozen" as the main action; "Pack short" appears only after the count is lowered. |
| STO-UI-03 | P2 | `store.html` CSS: `.st-nav .st-go` docked (no negative margin, 60 px, badge on the button); `--dock-h: 76px`; `#st_app` and every `.cv-body` / page scroller keep `calc(var(--dock-h) + 16px + safe area)` at the end | Nothing under the play button. | yes | With no scrolling, on Today, Stock, Find, On the road and Returns, no text or control's box overlaps the play button. A harness check measures this. |
| STO-UI-04 | P2 | `store.html`: Find and Returns search (the input fills the 48 px box), Clear (44 hit area around a 28 px circle), filter chips (44 tall, one scrolling row), the item page's Aisle pill and Pack's Aisle pill (44 tall) | 44 × 44 everywhere. | yes | A harness check of every button, input and `[data-act]` on Today, Stock, Find, Item, Pack, Hand over, Returns and On the road reports none under 44 px. |
| STO-UI-05 | P2 | `store.html` `:root`: `--t-12…40`, `--w-…`, `--r-8/14/22/pill`, `--sh-card/raised/sheet`, `--s-4…32`, `--c-*` (the 18 named colours). The eight screens' inline values are replaced by them, following the mapping below. | One scale, used on this brief's screens. | yes | A harness check of computed styles on the eight screens finds only token values (sizes, radii, gaps, shadows). The replaced values are listed in the Phase B result. |
| STO-UI-06 | P3 | `store.html` `viewToday`: the date and shop as one ellipsis line, the status a pill beside it (`flex: none`); the tile's `extra` on its own line under the label | Never ends on a dot. | yes | At 360 with "Omni-ware (old records)", the line is one line and the pill sits beside it. |
| STO-UI-07 | P3 | `store.html` `PAGE.slip`: `shopShort()` (the name without a bracketed part, one line, ellipsis); lines as `lineName(it).base` plus tags; the picker in rows of 3 with names on up to 2 lines | Fits at 360. | yes | "OMNI-WARE" on one line; `2"` is a tag; "Munyarugero" shows in full. |
| STO-UI-08 | P3 | `store.html` `kindOf(name, category)`: name first, then category; new drawings `lock`, `fix`, `tool`, `tube` in `THUMB` and `ART`; `<img onerror>` swaps to the drawing | Never a blank tile. | yes | Silicone, G-MAN Bow Saw, ELEPHANT and a broken photo URL all show a drawing. |
| STO-UI-09 | P3 | `store.html` `PAGE.onroad` `drv()`: a segmented bar plus "N of M stops done" in place of `stepDots`; a hired driver gets "(hired)" and a square, dashed amber avatar | The line means something. | yes | Hassan "1 of 3 stops done"; Abudu (hired) is told apart from staff at a glance. |

### The mapping (STO-UI-05), applied only to the eight screens

| Property | Was | Becomes |
|---|---|---|
| font-size | 11, 13 (meta, labels, chips) | 12 |
| font-size | 13 (row titles, small buttons), 15 (body) | 14 |
| font-size | 15, 17 (buttons, the leading row) | 16 |
| font-size | 18, 22, 24 (titles, tile figures) | 20 |
| font-size | 26, 28 (hero figures) | 28 |
| font-size | 40, 44 (the one big figure) | 40 |
| font-weight | 400, 500, 600, 700 | 600 (body, figures), 700 (titles, buttons) |
| border-radius | 6, 7, 9, 10 | 8 |
| border-radius | 11, 12, 13, 14, 16 | 14 |
| border-radius | 18, 20, 24, 28, 30 | 22 |
| border-radius | 999 | pill |
| gap / padding | 1, 2, 3, 5 | 4 |
| gap / padding | 6, 10 | 8 |
| gap / padding | 10, 14 | 12 |
| gap / padding | 14, 18 | 16 |
| gap / padding | 20, 22 | 24 |
| box-shadow | card variants (hairline + soft) | `--sh-card` |
| box-shadow | buttons, the open card, floating | `--sh-raised` |
| box-shadow | docks, sheets | `--sh-sheet` |
| box-shadow | selection rings (`inset 0 0 0 2px`) | `--ring` (not an elevation) |

## Not changing / pushed back

| ID | Why |
|---|---|
| STO-UI-01 ("10 Dozen", "19 Box") | Units stay lower case ("10 dozen", "19 box", "1 ctn + 4 box"), as Kevin approved in round 6 (WORD-09). |
| STO-UI-03 option A | Drawn and not chosen. Room at the end helps only once you scroll there; at rest the button still covers content. |
| STO-UI-05 (the rest of the app) | Only the eight screens this brief names move to the scale now. The other screens keep their values until later rounds, as the brief asks. |
| NAV-08 | Still open: the aisle has a sticky header (round 4); the other long lists are not named yet. |
| NAV-09 | Now described: removing a waiting item, and restoring the screen on reload. It is not part of this round's aspect, so it goes to the reliability or navigation follow-up. |
| DATA-05 | Closed in round 6: Kevin ran the check and all 59 of 0161's moves landed. |
| #0494 "Someone" | Needs the facts first. Please run `docs/audit/store/round-7-0494-check.sql` (read-only). It shows the name stored with the return, the sender's membership, chosen name, staff record and login name. If the sender is a member with a name on their login but none chosen, a small migration can add that name as a fallback in `ow_member_name`, and it would take a reserved row in decision-rights. If the stored name is a handle and nothing else names them, "Someone" is right. |

## Risks

- **Docking the play button changes the bar on every screen.** It stays the one red action, in the same place, now inside the bar. The count badge moves onto the button.
- **Opening a line at the ordered quantity** (Q2) means a packer who does not look will tap "Packed" for goods that are not there. The hint names the shelf figure, and the counter is one tap away.
- **The scale changes many small sizes at once** on eight screens. Each screen is checked at 360 and at desktop width before and after, and the round 6 wording tests stay green.
- **Category drawings** depend on the categories being right. Round 1's clean-up (0161) and DATA-05 make that likely; a product with no category keeps the cube.

## Questions for Kevin

1. **The play button:** dock it inside the bar (option B), as drawn?
2. **Opening a line in Pack:** at the ordered quantity for every line, with the shelf figure as a hint? Or only for count-due lines, as the brief says (others keep opening at what the shelf shows)?
3. **The receipt's shop name:** drop the bracketed part ("Omni-ware (old records)" → "OMNI-WARE")? Or show the whole name on one line with "…"?

## Phase B result (filled after implementing)

| ID | Done? | What changed (function names) | How verified |
|---|---|---|---|
| STO-UI-01 | | | |
| STO-UI-02 | | | |
| STO-UI-03 | | | |
| STO-UI-04 | | | |
| STO-UI-05 | | | |
| STO-UI-06 | | | |
| STO-UI-07 | | | |
| STO-UI-08 | | | |
| STO-UI-09 | | | |
