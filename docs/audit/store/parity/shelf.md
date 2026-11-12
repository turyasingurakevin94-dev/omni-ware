# Store · Shelf area — canvas parity (builder's record)

Boards: `docs/canvas/store-agent/boards/SH*.dc.html` (30). Spec: `test/parity/store-shelf.json`. Run:
`npm run build:store && NODE_PATH=$(npm root -g) node tools/parity/run.cjs --tab store-shelf`. Shots: `SHxx*.png` / `*.diff.png` beside this file.
Every board is reached by real taps from Today (Shelf tab first) at 360 × 800; the "just now" states after 10:41 use the demo's `&state=` (the push that would open them is named). An independent critic re-checks; this is the builder's own strict read.

Checked on every board: the words and figures are FACTS'; every control lands on its route (routes §2); targets ≥ 44 px (36 px pills sit in 44 px rows or 4 px padding); text ≥ 11 px; text contrast ≥ 4.5:1; nothing clipped at 360; no money.

| Board | Route | Demo · taps | Diff % | Result | Notes |
|---|---|---|---|---|---|
| SH01 Shelf | `shelf` | — · 1 | 0.76 | pass | the centre badge (3) and the tab icon are the shell's Due is `countDue`, 21 days (Q10). |
| SH41 Shelf offline | `shelf` | `&offline` · 4 | 0.69 | pass | the bent sheets reported with no signal, then back |
| SH06 Nothing needs a look | `shelf` | `&state=shelf-calm` · 1 | 0.28 | pass | |
| SH02 Find "nails" | `shelf/find` | — · 2 + typed | 2.17 | pass* | board conflict: the demo's #0534/#0547 carry nails (drawn by OU27/OU24), so Orders reads 5, All 9 (rows below the fold) |
| SH42 Find nothing | `shelf/find` | — · 2 + typed | 0.57 | pass | |
| SH40 Scan | `shelf/scan` | — · 2 | 1.71 | pass | demo reads label A-3533 (`labelShort`, spec §4.5; the board now reads it too, F4); the chip reads "412 on shelf" (board "412 pc on shelf") |
| SH04 Aisle A | `shelf/aisle` | — · 2 | 5.28 | pass | a 2 px taller head shifts the list; no "Print again" (Kevin 2026-11-11, Q21: no label printing); the count ring is 21 days (Q10) |
| SH05 No aisle yet | `shelf/aisle {aisle:''}` | — · 3 | 4.23 | pass | entry: Find, before anything is typed ("No aisle yet" tile) — no board draws that entry |
| SH03 Item | `shelf/item` | — · 3 | 6.53 | pass | sections sit 2–6 px lower (line-height); content identical |
| SH22 Ruth wrote off | `shelf/item` | `&state=written-off` · 3 | 7.14 | pass | as SH03; the 3 written off are red in the last bundle, above its 9 (F6) |
| SH24 Ruth kept it | `shelf/item` | `&state=kept-on-shelf` · 3 | 6.82 | pass | as SH03 |
| SH16 Count accepted | `shelf/item` | `&state=count-accepted` · 3 | 0.24 | pass | the count's time is 9:21 (sent); the board's 9:20 (begun) is not in the books |
| SH32 Denis answered | `shelf/item` | `&state=restock-listed` · 3 | 0.68 | pass* | head now the board's height (Low on the figure's baseline, F9); the ask row reads "On the restock list · just now"; "Counted · aisle F · Okello" adds who counted (SH03's form) |
| SH10 Count | `shelf/count` | `&at=921` · 5 | 0.05 | pass | |
| SH19 Key pressed | `shelf/count` | `&at=921` · 5 | 0.05 | pass | a key keeps its ring 0.7 s after the tap |
| SH11 Sending | `shelf/count` | `&at=921` · 6 | 0.12 | pass | |
| SH12 Sent to Ruth | `shelf/count` | `&at=921` · 6 | 0.2 | pass | |
| SH17 Not done | `shelf/count` | `&at=921&fail=sendCount` · 6 | 0.02 | pass | |
| SH18 Kept | `shelf/count` | `&at=921&offline` · 6 | 0.02 | pass | |
| SH13 Count it again | `shelf/count` | `&state=recount` · 2 | 0.48 | pass | |
| SH15 A count is waiting | `shelf/count` | — · 3 | 0.39 | pass | 9:21 for 9:20, as SH16 |
| SH25 Someone else | `shelf/count` | `&state=okello-counts` · 7 | 0.09 | pass | Okello's count is the designers' sample (manifest Q) |
| SH14 Aisle count | `shelf/count {aisle}` | — · 5 + typed | 5.48 | pass* | "Clout tacks" for the board's "Clout nails": with "nails" in it, SH02 would list 5 items. Head 2 px taller |
| SH20 Report | `shelf/report` | — · 2 | 1.31 | pass | |
| SH21 Sent to Ruth | `shelf/report` | — · 3 | 0.3 | pass | |
| SH23 Nothing on the shelf | `shelf/report` | — · 4 | 6.26 | pass | ghost tiles' icons 2 px lower |
| SH26 Not sent yet | `shelf/report` | `&offline` · 3 | 0.8 | pass | |
| SH27 Not done | `shelf/report` | `&fail=reportLoss` · 3 | 0.8 | pass | |
| SH30 We need more | `shelf/ask` | — · 2 | 0.21 | pass | |
| SH31 Sent to Denis | `shelf/ask` | — · 3 | 0.52 | pass | |

`pass*`: the layout and words match; the difference is a board that disagrees with another board or with the demo FACTS built, named in the note, for the lead.

## The critic's fixes (2026-11-12, F1–F14)

The critic passed 5 of 30 (`CANVAS-PARITY.md` "## Shelf"). Fixed in the app; where the board drew the same fault (F1, F11, F12) the board too (`docs/canvas/store-agent/review/SH-fixes.md`). Every spec still reaches its board; the diffs moved by under 0.8 points.

| F | Fix |
|---|---|
| F1 | the hero's 1,153, aisle letters and Find placeholder `#B3BCD2` (`shelf.css`); SH01, SH06, SH41 redrawn |
| F2 | Find's Open opens the count while one waits with Ruth (SH15), else the item (`Find.tsx Best`; spec §4.5) |
| F3 | "Did you mean" scrolls sideways (`find.css .sh-dym`) |
| F4 | the label's short code is `store.html:5814 labelShort` (`core/store/shelf.ts`, spec §4.5): A-3533; SH40 redrawn |
| F5 | one rule in `shell/nav.ts`: `nav.to(id, params)` (Close goes to the board's place, down the stack when it is below) and `backTo` (the strip names the entry really below: "Back to Find", "Back to Roofing"); item, aisle, count, waiting sheet, Keep theirs and report use them. Today, Pack, Goods in and Out are untouched |
| F6 | the written-off pieces red in the last bundle (`Item.tsx Picture`) |
| F7 | 11 px initials |
| F8 | "Rest of aisle C · 131 items": every other item in the aisle |
| F9 | the ask row "On the restock list · just now"; the Low head 39 px as drawn |
| F10 | no ring or caret once sent, held, kept, failed or clashing; failed dims the keypad |
| F11 | Undo, Try again 44 px; pc/bundle 44 × ≥ 44 (track padding 0); boards SH11, SH17, SH20, SH26, SH27 |
| F12 | `#5F6980` for SH15's step times and SH30's "on the shelf · you ask for"; both boards redrawn |
| F13 | the aisle count's number field fills its 44 px box |
| F14 | the report's two notes sit outside the dimmed form; the unit switch is disabled with it |

Checked after: the critic's `audit.cjs` (no text under 11 px; contrast only on the dimmed form and keypad, accepted; the only target under 44 is the 360 × 40 strip, accepted; "concrete nails" now scrolls into view), and every Close by tap (`closes`): item, aisle, count → Shelf; waiting Close, Leave it, Keep Okello's, report → the item; SH23 → Shelf; browser Back stays in step. SH41's spec now taps "Back to Shelf" (the strip names what is below).
