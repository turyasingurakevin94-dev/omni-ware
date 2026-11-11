# Store · Shelf area — canvas parity (builder's record)

Boards: `docs/canvas/store-agent/boards/SH*.dc.html` (30). Spec: `test/parity/store-shelf.json`. Run:
`npm run build:store && NODE_PATH=$(npm root -g) node tools/parity/run.cjs --tab store-shelf`. Shots: `SHxx*.png` / `*.diff.png` beside this file.
Every board is reached by real taps from Today (Shelf tab first) at 360 × 800; the "just now" states after 10:41 use the demo's `&state=` (the push that would open them is named). An independent critic re-checks; this is the builder's own strict read.

Checked on every board: the words and figures are FACTS'; every control lands on its route (routes §2); targets ≥ 44 px (36 px pills sit in 44 px rows or 4 px padding); text ≥ 11 px; text contrast ≥ 4.5:1; nothing clipped at 360; no money.

| Board | Route | Demo · taps | Diff % | Result | Notes |
|---|---|---|---|---|---|
| SH01 Shelf | `shelf` | — · 1 | 0.75 | pass | the centre badge (3) and the tab icon are the shell's |
| SH41 Shelf offline | `shelf` | `&offline` · 4 | 0.57 | pass | the bent sheets reported with no signal, then back |
| SH06 Nothing needs a look | `shelf` | `&state=shelf-calm` · 1 | 0.17 | pass | |
| SH02 Find "nails" | `shelf/find` | — · 2 + typed | 2.51 | pass* | board conflict: the demo's #0534/#0547 carry nails (drawn by OU27/OU24), so Orders reads 5, All 9 (rows below the fold) |
| SH42 Find nothing | `shelf/find` | — · 2 + typed | 0.41 | pass | |
| SH40 Scan | `shelf/scan` | — · 2 | 1.74 | pass | demo reads label A-014; the chip reads "412 on shelf" (board "412 pc on shelf") |
| SH04 Aisle A | `shelf/aisle` | — · 2 | 4.98 | pass | a 2 px taller head shifts the list; "Print again" says labels print from the office (no board for printing) |
| SH05 No aisle yet | `shelf/aisle {aisle:''}` | — · 3 | 4.23 | pass | entry: Find, before anything is typed ("No aisle yet" tile) — no board draws that entry |
| SH03 Item | `shelf/item` | — · 3 | 6.53 | pass | sections sit 2–6 px lower (line-height); content identical |
| SH22 Ruth wrote off | `shelf/item` | `&state=written-off` · 3 | 7.15 | pass | as SH03; the partial bundle is white, the board tints the written-off part |
| SH24 Ruth kept it | `shelf/item` | `&state=kept-on-shelf` · 3 | 6.82 | pass | as SH03 |
| SH16 Count accepted | `shelf/item` | `&state=count-accepted` · 3 | 0.27 | pass | the count's time is 9:21 (sent); the board's 9:20 (begun) is not in the books |
| SH32 Denis answered | `shelf/item` | `&state=restock-listed` · 3 | 8.90 | pass* | head 6 px shorter; "Counted · aisle F · Okello" adds who counted (SH03's form) |
| SH10 Count | `shelf/count` | `&at=921` · 5 | 0.05 | pass | |
| SH19 Key pressed | `shelf/count` | `&at=921` · 5 | 0.05 | pass | a key keeps its ring 0.7 s after the tap |
| SH11 Sending | `shelf/count` | `&at=921` · 6 | 0.62 | pass | |
| SH12 Sent to Ruth | `shelf/count` | `&at=921` · 6 | 0.20 | pass | |
| SH17 Not done | `shelf/count` | `&at=921&fail=sendCount` · 6 | 0.92 | pass | |
| SH18 Kept | `shelf/count` | `&at=921&offline` · 6 | 0.38 | pass | |
| SH13 Count it again | `shelf/count` | `&state=recount` · 2 | 0.48 | pass | |
| SH15 A count is waiting | `shelf/count` | — · 3 | 0.39 | pass | 9:21 for 9:20, as SH16 |
| SH25 Someone else | `shelf/count` | `&state=okello-counts` · 7 | 0.45 | pass | Okello's count is the designers' sample (manifest Q) |
| SH14 Aisle count | `shelf/count {aisle}` | — · 5 + typed | 5.45 | pass* | "Clout tacks" for the board's "Clout nails": with "nails" in it, SH02 would list 5 items. Head 2 px taller |
| SH20 Report | `shelf/report` | — · 2 | 1.31 | pass | |
| SH21 Sent to Ruth | `shelf/report` | — · 3 | 0.30 | pass | |
| SH23 Nothing on the shelf | `shelf/report` | — · 4 | 6.25 | pass | ghost tiles' icons 2 px lower |
| SH26 Not sent yet | `shelf/report` | `&offline` · 3 | 1.43 | pass | |
| SH27 Not done | `shelf/report` | `&fail=reportLoss` · 3 | 1.43 | pass | |
| SH30 We need more | `shelf/ask` | — · 2 | 0.21 | pass | |
| SH31 Sent to Denis | `shelf/ask` | — · 3 | 0.51 | pass | |

`pass*`: the layout and words match; the difference is a board that disagrees with another board or with the demo FACTS built, named in the note, for the lead.
