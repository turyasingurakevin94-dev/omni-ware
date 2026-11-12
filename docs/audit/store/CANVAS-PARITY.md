# Canvas parity — Store

The independent critics' check of the new Store app (`next/store.html`) against the approved canvas (`docs/canvas/store-agent/boards/`, 360 × 800), each board reached by **real taps from Today** in the demo seeded with the canvas's `FACTS.md`. Modelled on `docs/audit/sales/CANVAS-PARITY.md`. The builders' own records (`docs/audit/store/parity/<area>.md`) are claims; this file is the critics' verdict.

| How | Where |
|---|---|
| The taps and demo flags per board | `test/parity/store-<area>.json` |
| Board beside app, diff, % of pixels that differ (any channel > 24/255) | `npm run build:store && NODE_PATH=$(npm root -g) node tools/parity/run.cjs --tab store-<area>` → `docs/audit/store/parity/` |
| Rules a difference may rest on | `docs/spec/04-screens-store.md` §2a, §3 (Kevin's rulings), §4; `docs/spec/04-screens-store-routes.md` |

Each area critic checks per board: **shows** (content, words, figures, states as drawn), **links** (every control tapped in Playwright, landing route read from `sessionStorage['ow-store-view']`), **44px** targets, **11px** text, **contrast** ≥ 4.5:1 (computed styles, background composited up the tree), **clip** (`scrollWidth` ≤ 360, no clipped or unreachable text), and **no money**. A difference passes only as font/antialias noise, a demo figure that differs with a written reason, or one of Kevin's rulings. Each area owns its own section below; a critic adds or replaces only its own.

## Shelf

Critic run 2026-11-12 on `a9af4308` (origin/claude/store-build). 30 boards, `test/parity/store-shelf.json` unchanged (every tap reached its board). **5 pass, 25 fail.**

Accepted across the area (not failures): the tab badge 5/3 for the board's 7 (the shell's `next-job.ts`, TD's area); "every/due in 21 days" and the aisle bars (Q10); no "Print again" (Q21); "412 on shelf" for "412 pc on shelf" (§4.5, one figure); count time 9:21 for 9:20 (the books keep the send time); "Clout tacks" for "Clout nails" (written reason in the spec); a row that opens its item where the board links a stand-in (routes §3); Try again on the amber bar retries rather than opening SH26 (BRIEF: P27); the 360×40 dim strip above every sheet (`.sh-full-back`, the board's own 40 px strip, duplicated by the 44 px Close); the dimmed keypad/form while sending or kept (inactive controls, as drawn); 2–6 px row shifts from line-height. "1,153" and "3m" are counts and sizes, not money: **no money on any Shelf board.** `scrollWidth` is 360 on all 30.

| Board | Route | Taps | Diff % | Shows | Links | 44px | 11px | Contrast | Clip | Verdict | Note |
|---|---|---|---|---|---|---|---|---|---|---|---|
| SH01 Shelf | `shelf` | 1 | 0.75 | ok | ok | ok | ok | **3.07–3.89** | ok | fail | F1 |
| SH41 Shelf offline | `shelf` | 4 | 0.58 | ok | ok | ok | ok | **3.07–3.89** | ok | fail | F1 |
| SH06 Nothing needs a look | `shelf` | 1 | 0.28 | ok | ok | ok | ok | **3.07–3.89** | ok | fail | F1 ("due in 8 days" is Q10) |
| SH02 Find "nails" | `shelf/find` | 2 | 2.17 | ok | **Open** | ok | ok | ok | **chip row** | fail | F2, F3 (Orders 5/All 9 accepted: #0534, #0547 carry nails) |
| SH42 Find nothing | `shelf/find` | 2 | 0.41 | ok | ok | ok | ok | ok | ok | pass | Roof paint row opens its item (routes §3) |
| SH40 Scan | `shelf/scan` | 2 | 1.74 | **A-001** | ok | ok | ok | ok | ok | fail | F4 |
| SH04 Aisle A | `shelf/aisle` | 2 | 5.28 | ok | ok | ok | ok | ok | ok | pass | Q10 ring, Q21 no Print again; G30 row opens its item |
| SH05 No aisle yet | `shelf/aisle` | 3 | 4.23 | ok | **Close, back** | ok | ok | ok | ok | fail | F5 |
| SH03 Item | `shelf/item` | 3 | 6.53 | ok | **Close, back** | ok | ok | ok | ok | fail | F5 |
| SH22 Ruth wrote off | `shelf/item` | 3 | 7.15 | **bundle tint** | **Close, back** | ok | ok | ok | ok | fail | F5, F6 |
| SH24 Ruth kept it | `shelf/item` | 3 | 6.82 | ok | **Close, back** | ok | ok | ok | ok | fail | F5 |
| SH16 Count accepted | `shelf/item` | 3 | 0.27 | **130 items** | **Close, back** | ok | **10px JM** | ok | ok | fail | F5, F7, F8 |
| SH32 Denis answered | `shelf/item` | 3 | 8.9 | **row** | **Close, back** | ok | **10px GA** | ok | **ellipsis** | fail | F5, F7, F9 |
| SH10 Count | `shelf/count` | 5 | 0.05 | ok | **back** | ok | ok | ok | ok | fail | F5 |
| SH19 Key pressed | `shelf/count` | 5 | 0.05 | ok | **back** | ok | ok | ok | ok | fail | F5 |
| SH11 Sending | `shelf/count` | 6 | 0.62 | **ring** | **back** | **Undo 40** | ok | ok | ok | fail | F5, F10, F11 |
| SH12 Sent to Ruth | `shelf/count` | 6 | 0.2 | ok | ok | ok | ok | ok | ok | pass | bar full after 11 s (animation) |
| SH17 Not done | `shelf/count` | 6 | 0.92 | **pad, ring** | **back** | **Try again 40** | ok | ok | ok | fail | F5, F10, F11 |
| SH18 Kept | `shelf/count` | 6 | 0.38 | **ring** | **back** | ok | ok | ok | ok | fail | F5, F10 |
| SH13 Count it again | `shelf/count` | 2 | 0.6 | ok | **back** | ok | ok | ok | ok | fail | F5 |
| SH15 A count is waiting | `shelf/count` | 3 | 0.39 | ok | **Close, Leave, back** | ok | ok | **4.35** | ok | fail | F5, F12 |
| SH25 Someone else | `shelf/count` | 7 | 0.45 | **ring** | **Keep Okello's, back** | ok | ok | ok | ok | fail | F5, F10 |
| SH14 Aisle count | `shelf/count {aisle}` | 5 | 5.45 | ok | ok | **input 44×20** | ok | ok | ok | fail | F13 |
| SH20 Report | `shelf/report` | 2 | 1.58 | ok | **Close, back** | **pc/bundle 38** | ok | ok | ok | fail | F5, F11 |
| SH21 Sent to Ruth | `shelf/report` | 3 | 0.43 | ok | ok | ok | ok | ok | ok | pass | |
| SH23 Nothing on the shelf | `shelf/report` | 4 | 6.26 | ok | **Close, back** | ok | ok | ok | ok | fail | F5 |
| SH26 Not sent yet | `shelf/report` | 3 | 1.43 | **dimmed notes** | **Close, back** | **pc/bundle 38** | ok | **2.1–2.3** | ok | fail | F5, F11, F14 |
| SH27 Not done | `shelf/report` | 3 | 1.43 | **dimmed notes** | **Close, back** | **pc/bundle 38, Try again 40** | ok | **2.1–2.3** | ok | fail | F5, F11, F14 |
| SH30 We need more | `shelf/ask` | 2 | 0.07 | ok | ok | ok | ok | **4.35** | ok | fail | F12 |
| SH31 Sent to Denis | `shelf/ask` | 3 | 0.37 | ok | ok | ok | ok | ok | ok | pass | bar full after 11 s (animation) |

### Shelf failures and fixes

Where the board draws the same fault (F1, F11, F12), the board is wrong too: fix the app and redraw the board in the same commit.

- **F1 · contrast on the Shelf hero** (SH01, SH06, SH41). The aisle letters under the bars (`.sh-bar > b`, 11px) and the "1,153" beside the title (`.sh-phead h1 .mono`) are `#8D99B5` on the hero's navy (3.89:1). The Find placeholder (`.sh-findlink > span`) is 3.07:1. Fix in `src/apps/store/shelf/shelf.css` lines 7, 19, 23–24: use `#B3BCD2`, the hero's own secondary (5.83:1 on the hero, 4.60:1 on the search field). Leave aisle C's red as it is.
- **F2 · Find "Open" link** (SH02). The board links the top card's **Open** to SH15 (the count already waiting). The app opens `shelf/item {key:'p-wn4'}`. Either point `Find.tsx`'s Open at `shelf/count {key}` (it opens with the waiting sheet, SH15), or have the lead correct the board to SH03 and record it in spec §2a. Do not change it silently.
- **F3 · "Did you mean" chips cut off** (SH02). `.sh-dym` (`find.css:16`) is `overflow: hidden`, so the third chip, "concrete nails", sits at x 343–473 and cannot be reached. The board shows the row peeking off the edge, which means it scrolls. Fix: `overflow-x: auto; scrollbar-width: none; scroll-snap-type: x proximity`.
- **F4 · scanner label code** (SH40). The board's label reads **A-014**. The app reads **A-001** because `Scan.tsx:28 labelOf` numbers by the item's index in its aisle, a rule that is in neither the spec nor FACTS. The file's own comment (line 7) says A-014. Fix: put FACTS' code on the demo item (or a `labelCode` in the seed). If the numbering rule should stay, write it into spec §4.5 first.
- **F5 · sheets close to the wrong place, and the back strip's name is wrong.** Every sheet's Close and back strip call `nav.back()`, so they land on whatever opened the sheet. The board draws a fixed place, and the strip's aria-label names that place even when it is not below. Measured:
  - Item, reached via the aisle (SH03, SH22, SH24): "Back to Shelf" and Close land on Aisle A. The board draws SH01.
  - Item, reached via Find (SH16, SH32): both land on Find. The board draws SH01.
  - No aisle yet (SH05): both land on Find. The board draws SH01.
  - Count, via Find (SH10, SH19, SH11, SH17, SH18): "Back to the item" lands on Find. The board draws SH03. Close is right (→ Shelf).
  - SH13: "Back to the item" lands on Shelf.
  - SH15: the sheet's Close and "Leave it with Ruth" land on Find. The board draws SH03.
  - SH25: "Keep Okello's" lands on Find. The board draws SH03.
  - Report from Shelf (SH20, SH26, SH27): Close and "Back to the item" land on Shelf. The board draws SH03.
  - SH23: "Back to Shelf" and Close land on the item. The board draws SH01.

  Fix:
  - `Item.tsx:98` and `Aisle.tsx:76,125`: Close calls `nav.tab('shelf')`, as `Count.tsx:89` already does.
  - `Report.tsx:153`: Close calls `nav.replace('shelf/item', { key: it.key })`. When the shelf is empty (SH23), it calls `nav.tab('shelf')`.
  - `Count.tsx:32,33,113` (waiting sheet Close, Leave it with Ruth, Keep Okello's): call `nav.replace('shelf/item', { key: it.key })`.
  - `parts.tsx:70 ItemSheet`: the back strip keeps `nav.back()`, but its `label` names the screen actually below. Read it from `stack` in `shell/nav.ts` ("Back to Find", "Back to aisle A", …), never a fixed "Back to Shelf" or "Back to the item".
- **F6 · written-off part not tinted** (SH22). The board tints the partial bundle block (the 3 written off) red, from `#F7A196` to white. The app draws it plain white and grey. Fix in `Item.tsx`'s `Picture`: when the item's last decided report was a write-off "just now", draw the removed pieces in the last block with the board's red tint.
- **F7 · 10px avatar initials** (SH16 "JM", SH32 "GA"). `Item.tsx:145` and `:153` pass `font={10}`. The board draws 11px. Fix: `font={11}`.
- **F8 · "Rest of aisle C · 130 items"** (SH16). The board says **131** (132 − this one). `Item.tsx:100` counts only the items that are `countDue`, which drops one more without any written reason. Fix: count the aisle's other items (`aisle.items.length - 1`), or name the excluded item and why in the spec note for SH16.
- **F9 · Denis's ask row clipped, and the head is short** (SH32). The What moved row reads "On the restock list · next tri…" (`.sh-mv-t` ellipsis, `parts.css:31`). The board draws "On the restock list · just now". The "next trip" belongs to the banner, which already says it. Fix: in `Moved` / `shelf.ts:125`, show the answer's first part plus the time for an ask row. The Low head is also 6 px shorter than the board: match `item.css` to the board's 12 px gap above "on the shelf · about 10 on the next trip".
- **F10 · the chosen count field keeps its ring after Send** (SH11, SH17, SH18, SH25). Once sent, held, kept, failed or clashing, the board draws both fields without the dark ring and caret. In the failed state (SH17) the board also dims the keypad. Fix in `Count.tsx`: add `'failed'` to `busy` (line 63), and pass `active={busy || clash ? -1 : active}` to `<Levels>` (line 104).
- **F11 · targets under 44 px**, the board as drawn too:
  - Undo pill, 86×40 (`parts.css:45 .sh-undo button`).
  - Try again, 91×40 (`parts.css:60 .sh-fail-t button`).
  - pc/bundle, 43×38 and 65×38 (`report.css:30 .sh-rp-unit > button`).

  Fix: height 44 on all three, and padding 0 on `.sh-rp-unit` (or keep the 3 px track and make it 50 high). Redraw the three on the canvas.
- **F12 · 11px grey at 4.35:1** on `#F7F5F2`:
  - SH15's step times "9:21 · now" (`count.css:70 .sh-track-s`).
  - SH30's "on the shelf · you ask for 10" (`ask.css:10 .sh-ask-l`).

  Fix: `#5F6980` (5.05:1). Redraw the boards the same.
- **F13 · the aisle-count number field is 44×20** (SH14). `aislecount.css:39` makes the input 20 px tall inside the 44 px `.sh-box`, and a tap beside it does not focus it. Fix: `.sh-box label { flex: 1; height: 44px; align-items: center }` and `.sh-box input { height: 44px }`.
- **F14 · the kept or failed report dims its notes** (SH26, SH27). `Report.tsx:99` puts `.dim` (opacity .55, `report.css:12`) on the whole form, so "Set the 3 aside, away from the good bundles" (2.13:1) and "Ruth decides: write it off or keep it · Undo for 10 s" (2.19:1) fade. The board keeps both at full strength. Fix: render `.sh-rp-note` and `.sh-rp-ruth` (lines 127–128) after the dimmed `div`, not inside it. Also give the unit buttons `disabled={off}` like the other form controls.
