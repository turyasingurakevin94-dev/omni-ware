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

## Pack

Critic run 2026-11-12 on `6a95aa53` (origin/claude/store-build). The run covered 25 boards: the 22 Pack boards plus AD02, AD05 and AD06 (Unpack, "Added while building"). `test/parity/store-pack.json` is unchanged (every tap reached its board). **7 pass, 18 fail.**

Accepted across the area (not failures):
- **The item picture.** The demo's shelf has no photos, so the aisle's duotone stands in. It is about 3–4 % of a pack card.
- **The rail icons** are the shell's `RAIL`.
- **Figures corrected to the data** (spec §2a, FACTS §8):
  - #0552's line 2 is the wheelbarrows (2 pc) where PK04, PK05, PK16 and PK19 draw wire nails (2 ctn).
  - #0530 is cancelled at 10:38, where the boards say 10:41.
  - The demo's fail code is PK-502, for the boards' sample codes.
- **No per-line pick time** on PK15 and PK17: the books have no `pickedAt`.
- **The shared parts.** The P28 toast (max-content, no seconds on Undo) for the boards' full-width band on PK05, PK15 and AD05. The shared Not done card's 44 px × on AD06.
- **The demo clock.** The Undo ring starts at 10 s (boards 7 s), 10:41 for 10:42, 36m for 37 m.
- **PK07** is on #0556, not #0554, because #0554 is already at the gate in the demo. Bay 1 is #0552 (FACTS: "#0552 bay 1").
- **AD02's packer** is Okello and bay 3 is free, as the books have it. PK06 draws bay 3 free too.
- **AD05's Buying** is "skipped": #0530 has no Buying in the books. AD05 lists the order under To pack now (Q23).
- **PK13's Waiting on goods group** is not on the board, but the books hold it at that moment (PK01 draws it).
- **Stand-in links.** A row that opens #0556's pack where the board links PK01 as a stand-in (routes §3).
- **PK03's press.** The tool cannot hold a press. The `:active` rule is in `pack/card.css:49`.
- **Inactive controls, as drawn:**
  - Short and the amount tiles are dimmed while sending (PK16, PK18).
  - "Back online to finish", "Waits for the goods" and the blocked put-back slide are disabled, at 4.30:1.
- **The toast covers the back strip** for 10 s on PK05, PK15 and AD05. The board's toast covers it too.

**No money on any Pack board.** "39m", "36m", "0m" and "3m" are minutes and sizes, not money. On all 25 boards there is no text under 11 px, no target under 44 px, and `scrollWidth` is 360 (the stage chips scroll, `stagesheet.css:17`).

| Board | Route | Taps | Diff % | Shows | Links | 44px | 11px | Contrast | Clip | Verdict | Note |
|---|---|---|---|---|---|---|---|---|---|---|---|
| PK01 To pack | `pack` | 2 | 5.91 | ok | ok | ok | ok | **2.76 NH** | ok | fail | F7 |
| PK02 Pack | `pack/order` | 1 | 4.14 | ok | **strip** | ok | ok | ok | ok | fail | F1 |
| PK03 Pressed | `pack/order` | 1 | 8.57 | ok (rule) | **strip** | ok | ok | ok | ok | fail | F1 |
| PK18 Sending | `pack/order` | 2 | 4.14 | ok | **strip** | ok | ok | ok (disabled) | ok | fail | F1 |
| PK11 No signal | `pack/order` | 2 | 3.92 | **2 not sent** | **strip** | ok | ok | ok (disabled) | ok | fail | F1, F2 |
| PK12 Not saved | `pack/order` | 2 | 5.28 | ok | **strip** | ok | ok | ok | ok | fail | F1 |
| PK04 Pack short | `pack/order` | 2 | 1.96 | ok | ok | ok | ok | ok | ok | pass | |
| PK16 Short sending | `pack/order` | 3 | 1.5 | ok | ok | ok | ok | ok (dimmed, as drawn) | ok | pass | |
| PK19 Short not saved | `pack/order` | 3 | 3.6 | ok | ok | ok | ok | ok | ok | pass | |
| PK05 Short sent | `pack/order` | 3 | 2.48 | **strip tick** | **strip** | ok | ok | ok | ok | fail | F1, F5 |
| PK06 Packed | `pack/order` | 2 | 1.8 | ok | ok | ok | ok | **4.46 Next job** | ok | fail | F6 |
| PK07 Ready to collect | `pack/order` | 5 | 5.43 | ok (data) | ok | ok | ok | **4.46 Next job** | ok | fail | F6 |
| PK15 Unpack | `pack/order` | 3 | 1.24 | ok | **strip** | ok | ok | ok | ok | fail | F1 |
| PK08 For you | `pack` | 2 | 6.77 | ok | ok | ok | ok | **2.76 NH** | ok | fail | F7 |
| PK09 Look only | `pack/look` | 3 | 0.08 | ok | ok | ok | ok | ok | ok | pass | |
| PK13 Someone else | `pack` | 4 | 6.94 | ok | ok | ok | ok | **2.76 NH** | ok | fail | F7 |
| PK17 Okello's | `pack/look` | 5 | 2.09 | ok | ok | ok | ok | ok | ok | pass | |
| PK14 Empty | `pack` | 1 | 10.83 | **no helpers, 0 delivered** | **3 untested** | ok | ok | ok | ok | fail | F3 |
| PK20 Offline | `pack` | 2 | 6.57 | **Waiting card** | ok | ok | ok | **2.76 NH** | ok | fail | F4, F7 |
| PK21 Waits for the goods | `pack/order` | 3 | 6.95 | ok | ok | ok | ok | ok (disabled) | ok | pass | |
| PK10 Put it back | `pack/put-back` | 4 | 0.58 | ok | **strip** | ok | ok | ok (blocked slide) | ok | fail | F1 |
| PK22 Put back not saved | `pack/put-back` | 5 | 2.08 | ok | **strip** | ok | ok | ok | ok | fail | F1 |
| AD02 Unpack #0530 | `pack/order {unpack}` | 3 | 4.15 | ok (data) | **under the sheet** | ok | ok | ok | ok | fail | F9 |
| AD05 Unpacked | `pack/order {unpack}` | 4 | 6.89 | ok (data, Q23) | ok | ok | ok | ok | ok | pass | strip and Close → To pack, as labelled and drawn |
| AD06 Unpack not saved | `pack/order {unpack}` | 4 | 9.84 | ok | **under the sheet** | ok | ok | **2.08 After Unpack** | ok | fail | F8, F9 |

### Pack failures and fixes

Where the board draws the same fault (F6, F7, F8), the board is wrong too: fix the app and redraw the board in the same commit.

- **F1 · the back strip does not go to the screen below** (PK02, PK03, PK18, PK11, PK12, PK05, PK15, PK10, PK22). nav.ts's rule (and Shelf F5): Close goes to the board's place, the strip to the real screen below, named by `backTo`. Measured:
  - `pack/order` reached by the red Next job (stack Today → #0552): the strip reads "Back to To pack" and `toSheet` replaces the top with To pack. The screen below is Today.
  - `pack/put-back` reached from To pack's red row (stack Today → To pack → #0530): the strip reads "Back to Today" and calls `nav.home()`. The screen below is To pack.

  Fix: `Pack.tsx:144,150` and `Packed.tsx:162`: `onBack={() => nav.back()} backLabel={backTo.value}`; `PutBack.tsx:48,87` the same. Close stays as it is (`toSheet` → To pack, `nav.home()` → Today, the boards' places). From To pack (PK09, PK17, PK21) nothing changes: the screen below is To pack.
- **F2 · "2 not sent yet" for one packed line** (PK11). The board says **1**. With no signal the last line keeps two writes, `pick` and the `finishPack` kept behind it, and `pack/parts.tsx:94 TopNotice` counts writes, not what Musa did. The dock already says the finish waits ("Back online to finish"). Fix: in `TopNotice`, leave out a kept `finishPack` whose order also has a kept `pick` (`keptPack` in `core/store/outbox.ts:57` already pairs them).
- **F3 · the empty yard is not the board's moment** (PK14). The board draws nothing to pack while the yard still has work: "Check in Denis's trip · ~11:30", To load 1, At the gate 1 #0555, "Next to pack #0549 Ggaba · Buying", and "1 delivered today". `&state=empty` empties the whole yard, so `ToPackEmpty.tsx:37–60` never draws its helpers, three of the board's links (→ IN02, OU01, OU10) cannot be tapped, and the head says "0 delivered today". Fix: make `&state=empty` (`core/store/demo/flags.ts`) empty only To pack, For you and Packing now (#0556, #0557, #0552 packed or gone), keeping Denis's trip, #0530 on To load, #0555 at the gate, #0549 in Buying and one delivery. Then check the three links.
- **F4 · No signal: the Waiting group is a card, not a row** (PK20). Offline, the board folds Waiting on goods to its head row, "Waiting on goods 2 · Denis ~11:30 ›" (→ PK21). The app draws the full #0549 · #0546 card as on PK01. No written reason. Fix: in `ToPack.tsx`, when `!online` draw the Waiting group as one head row with Denis's due time, linking to the first waiting order. Or the lead corrects PK20 to PK01's card in spec §2a. Do not leave it unrecorded.
- **F5 · the short line is ticked in the head's strip** (PK05). The board draws the line just packed short with a mint bar but its label white and bold, no tick ("C · Wire nails"), because it is short, not packed. `head.tsx:43` gives `short` the same tick as `done`, and the label goes soft. Fix: tick `done` only; draw `short` with the mint bar and the white 700 label, no tick.
- **F6 · "Next job" at 4.46:1** (PK06, PK07), the board as drawn too. The 11 px label `.mo-next-t > span` (`moment.css:55`) is `var(--on-navy-2)` `#8D99B5` on the next-job card (`rgba(255,255,255,.08)` over navy). Fix: `#B3BCD2` (the hero's secondary, as Shelf F1). Redraw PK06 and PK07.
- **F7 · the copy's dimmed face at 2.76:1** (PK01, PK08, PK13, PK20), the board as drawn too (`opacity: .6`). `.pk-face.dim { opacity: .6 }` (`pack.css:55`) fades the 12 px "NH" on the #0557 row. The row still opens Look only, so its words must read. Fix: drop the opacity. Show the copy with the slate holder face (`yardFace`), whose ink is at full strength; the red "Don't pack" pill already says it is the copy. Redraw the four boards.
- **F8 · the failed unpack dims "After Unpack"** (AD06), the board as drawn too (`opacity: .5`). `.ad-after.dim` (`unpack.css:12`) brings "After Unpack · Undo for 10 s" to 2.08:1, "Brian sees: Packing again" to 3.17:1, and "BO" to 2.37:1. That is still what Unpack will do on Try again, so it is information, not an inactive control. Fix: do not add `.dim` in the failed state. Redraw AD06 without the 0.5.
- **F9 · the page under the Unpack sheet** (AD02, AD06). A tap on the dim head (the scrim) closes the sheet and leaves #0530's Packed page (`Unpack.tsx:96–98`). That page's strip reads only "Back", and its Close calls `nav.back()` to #0552's Packed moment. The board links both to TD01. Fix: `Unpack.tsx:96` `backLabel={backTo.value}` ("Back to the order"); `Unpack.tsx:98` `onClose={() => nav.home()}` (the board's place, Today). Better still, a scrim tap does what the sheet's Close does (`keep`, → PK06), so the bare #0530 page, which no board draws, is never left open.

## Today

Critic run 2026-11-12 on `6a95aa53` (origin/claude/store-build). 33 boards. `test/parity/store-today.json` is unchanged in the commit. Every tap reached its board except TD04 (below), TD18 and TD23. Every board link was replayed in Playwright (landing route read from `sessionStorage['ow-store-view']`); the rest was measured in computed styles. **4 pass, 29 fail.**

Accepted across the area (not failures):
- #0530's faces BO RN and "Brian takes it": FACTS says Brian placed #0530 (§2a: the board is corrected).
- TD02's 8 done: the board's own To load 2 counts #0552 as packed.
- "tried 3 times" left out on TD07 and TD22: §4.8, the app says only what is true. Redraw the boards.
- TD20/TD31 "Your manager sends you an invite link": nobody is known before sign-in. Redraw.
- TD28's Bay 4: PK06 draws four bays (§2a).
- TD32's #0552 first: Q20.
- The demo clock's 10:41/17:30 where a board draws 10:42/17:42.
- TD31's empty password: the demo refuses only an empty one.
- TD10's "1 · read" for 7: older days are not in FACTS.
- TD09's scroll offset and head shadow.
- TD11's cards 5–8 px taller each (line-height).

TD33's pressed red is right: `#A82D24`, measured under a held mouse. Times such as "41 m" are durations, not money: **no money on any Today board.** `scrollWidth` is 360 on all 33, and no text is under 11 px.

**Spec tap corrected (not committed, per the brief).** TD04 is the calm Today after the return is set aside. Its steps on `&at=1730` should be `[{"tap":{"sel":".st-job-act"}},{"tap":"It's set aside"},{"tap":"Close"}]`. With them the card reads **4 of 4** with the tick, as drawn (diff 1.67 %), and the builder's "3 of 4" note falls away.

| Board | Route | Taps | Diff % | Shows | Links | 44px | 11px | Contrast | Clip | Verdict | Note |
|---|---|---|---|---|---|---|---|---|---|---|---|
| TD01 Today | `today` | 0 | 1.91 | **no "13:20"** | ok | ok | ok | **3.21, 4.46** | ok | fail | T1, T2, T6 |
| TD09 Today scrolled | `today` | 1 | 13.7 | ok | ok | ok | ok | ok | ok | pass | scroll offset, head shadow |
| TD33 Next job pressed | `today` | 0 | 3.02 | **no scale .97, no "13:20"** | ok | ok | ok | **3.21, 4.46** | ok | fail | T1, T2, T6, T23 |
| TD02 Next is a check-in | `today` &at=1132 | 0 | 0.58 | **bell 2** | ok | ok | ok | **3.21** | ok | fail | T1, T8 |
| TD03 Next is a ride | `today` &at=1510 | 0 | 2.03 | **3 left · 16 done · 0 later, road 0, bell 2, "0 m", tile face** | ok | ok | ok | **3.21** | ok | fail | T1, T7, T8, T9 |
| TD04 Calm | `today` &at=1730 | 3* | 1.67 | **21 done, 9 delivered, 3 with Ruth, bell 2** | ok | ok | ok | ok | ok | fail | T7, T8, T10 |
| TD05 First day | `today` &state=first-day | 0 | 27.97 | **a Today with a count job, no Get going** | **red button → count** | ok | ok | ok | ok | fail | T11 |
| TD06 Offline | `today` &offline&kept=1 | 0 | 7.11 | ok | ok | ok | ok | **4.46** | ok | fail | T2 |
| TD07 Load failed | `today` &fail=snapshot | 0 | 2.97 | ok | **tiles open sheets** | ok | ok | ok | ok | fail | T12 |
| TD08 Update ready | `today` &update=1 | 0 | 0.27 | **no "13:20"** | ok | ok | ok | **3.21, 4.46** | ok | fail | T1, T2, T6 |
| TD10 Alerts | `today/alerts` | 1 | 3.51 | **GA hidden** | ok | ok | ok | **3.89** | **3 lines cut** | fail | T1, T13, T14 |
| TD11 With Ruth | `today/with-ruth` | 2 | 13.27 | ok | ok | **Gate 57×36** | ok | ok | ok | fail | T15 |
| TD29 Alerts empty | `today/alerts` &state=empty | 1 | 2.34 | **no "Fri 16 Oct · 6 · read"** | ok | ok | ok | **3.89** | ok | fail | T1, T16 |
| TD30 With Ruth empty | `today/with-ruth` &state=empty | 2 | 6.52 | **box icon** | ok | ok | ok | ok | **title cut** | fail | T17 |
| TD12 You | `today/you` | 1 | 15.58 | **no Kampala Road, no call** | **ring, Out** | ok | ok | **3.17** | ok | fail | T1, T6, T18 |
| TD13 Pass the yard | `today/pass-yard` | 2 | 4.66 | ok | ok | ok | ok | ok | ok | pass | |
| TD18 Sending | `today/pass-yard` | 2 | 10.91 | **not reached** | ok | ok | ok | ok | ok | fail | T19 |
| TD14 Sent to Okello | `today/pass-yard` | 3 | 8.54 | **"Sent" while held** | ok | ok | ok | ok | ok | fail | T19 |
| TD24 Nobody else | `today/pass-yard` &state=nobody | 2 | 4.02 | **slide off drawn live** | ok | ok | ok | **4.35** | ok | fail | T20, T21 |
| TD26 Pass failed | `today/pass-yard` &fail=passYard | 3 | 5.04 | ok | ok | ok | ok | ok | ok | pass | |
| TD15 Musa passed you | `today` &as=okello&at=1043 | 0 | 0.62 | **bell 2** | ok | ok | ok | **3.21** | ok | fail | T1, T8 |
| TD25 I've got it sending | `today` &as=okello&at=1043 | 1 | 0.91 | **bell 2** | ok | ok | ok | **3.21** | ok | fail | T1, T8 |
| TD32 The yard is yours | `today` &as=okello&at=1043 | 1 | 3.64 | **bell 2** | ok | ok | ok | **3.21, 4.46** | ok | fail | T1, T2, T8 |
| TD28 Close, 3 of 4 | `today/close-yard` &at=1730 | 1 | 9.62 | **slide off drawn live, 9 out** | ok | ok | ok | ok | ok | fail | T7, T20 |
| TD16 Close the yard | `today/close-yard` &at=1730 | 2 | 9.51 | **9 out, one name for 3 with Ruth** | ok | ok | ok | ok | ok | fail | T7, T10 |
| TD27 Close offline | `today/close-yard` &offline | 2 | 10.01 | **slide off drawn live, 9 out** | ok | ok | ok | ok | ok | fail | T7, T20 |
| TD19 Close sending | `today/close-yard` &at=1730 | 3 | 9.72 | **9 out** | ok | ok | ok | **1.24** | ok | fail | T7, T22 |
| TD17 Closed | `today/close-yard` &at=1730 | 3 | 6.08 | ok | ok | ok | ok | ok | ok | pass | |
| TD20 Sign in | `shell/sign-in` &state=signed-out | 0 | 1.49 | ok | **Forgot password: nothing** | ok | ok | ok | ok | fail | T24 |
| TD31 Wrong password | `shell/sign-in` | 1 | 3.87 | ok | **Forgot password: nothing** | ok | ok | ok | ok | fail | T24 |
| TD23 Signing in | `shell/sign-in` | 1 | 64.65 | **not reached** | **Forgot password: nothing** | ok | ok | ok | ok | fail | T24, T25 |
| TD21 Checking | `shell/checking` &state=loading | 0 | 12.43 | **Next job skeleton** | **Shelf tab inert** | ok | ok | ok | ok | fail | T26 |
| TD22 No reach | `shell/no-reach` &state=no-reach | 0 | 10.75 | **no "7:52", nothing waiting** | **Open the copy → Not loaded** | ok | ok | **4.35** | ok | fail | T21, T27 |

\*TD04 with the corrected taps above. The committed spec (0 taps) shows "3 of 4" and the MK ring (2.46 %).

### Today failures and fixes

Where the board draws the same fault (T1, T2, T15), the board is wrong too: fix the app and redraw the board in the same commit.

- **T1 · `--on-navy-2` (#8D99B5) as text on navy, 3.17–3.89:1.** Measured:
  - the Next job tiles' second line ("Iron sheet", "#0549", "one stop", "count") and the struck dropped line ("10 pair"): 3.21:1, `today.css:77–78` (`.st-jt-v.strike`, `.st-jt-s`);
  - You's stat lines ("Denis · 10:05", "#0555", "2 Ssali · 1 gate"): 3.17:1, `you.css:16`;
  - Alerts' "9:00" and "10:00" ticks: 3.89:1, `alerts.css:9`.

  The boards draw the same #8D99B5. Fix: `var(--on-navy)` (#B3BCD2: 4.82:1 on the tile, 4.75:1 on You's figures, 5.83:1 on the hero), as Shelf F1. Redraw TD01–03, TD08, TD10, TD12, TD15, TD25, TD29, TD32 and TD33.
- **T2 · the blue tag "Packing now · yours" at 4.46:1** (12 px bold, #A9BCEB on `rgba(141,162,214,.18)` over the card). This is the shared `src/ui/pill.css:36 .ow-npill.n-blue`, and the board draws it the same. Fix: #B8C8F0 (5.05:1), and redraw the boards' tag.
- **T6 · FACTS figures left out, with no recorded reason:**
  - TD01, TD08, TD33: "Ssali **13:20**" (FACTS: "Ssali leaves 13:20");
  - TD12: "Open · **Kampala Road**" and the shop's call button (FACTS: "Mukasa Hardware, Kampala Road").

  The builder's reason (the books keep no run time and no shop address) is true, but it is written only in `parity/today.md`. Fix: either write both gaps into spec §3 as open questions (and data §9), with the default "left out", or carry the data (the run's time on the order's carrier; the shop's address and phone in `side`) and draw it in `cards.tsx` and `You.tsx`.
- **T7 · the demo invents moments FACTS does not have.** In `src/core/store/demo/moments.ts`, step 1130 delivers #0534 at 10:58, and step 1200 delivers #0547 at 11:20 and collects #0556 at 11:10. FACTS §8 names none of these, and TD03 still draws NH on the road at 15:10. The result:
  - TD03 shows 3 jobs left · 16 done · 0 later · On the road 0, where the board draws 4 · 12 · 1 · 1 (NH);
  - TD04, TD16, TD19, TD27 and TD28 show 9 out and 21 done, where the board draws 8 and 18.

  Fix: remove those three deliveries from `moments.ts`, or add them to FACTS §8 with their times and redraw the counts on TD03, TD04 and the close boards. §2a does not allow the two to disagree.
- **T8 · the bell is always 2.** The board draws:
  - 1 at 11:32 and at 15:10 (TD02, TD03);
  - none at 17:30 (TD04);
  - 1 on Okello's phone, "Musa passed you the yard" (TD15, TD25);
  - none once he has the yard (TD32).

  Fix in the demo (`moments.ts`, `coming.ts alerts()`): each later moment marks the 10:41 pushes read, and `&as=okello` gets Okello's own alerts (the pass push), not Musa's. `bellCount` (`alerts-model.ts`) needs no change.
- **T9 · "Denis sent you · 0 m"** (TD03). Spec §4.7 says under a minute is "just now", but `src/core/time.ts:66 howLong` returns "0 m". Fix it there, in one place: `if (mins < 1) return 'just now'`. The board says "1 m" from 15:09, while the demo sends at 15:10 (FACTS §8), so after the fix the app reads "just now" and the board should say the same. The third tile also differs: the board draws #0559's LB face, the app a box. Fix the ride tiles in `cards.tsx` to use `customerFace`, as the board does.
- **T10 · "3 with Ruth" on the Close card, and one name on the sheet** (TD04, TD16). Today's card counts `n` = 3, where the board draws 1. The close sheet's row says only "Aisle C count with Ruth" while it carries 3: in `shift.ts:99–100`, `what` names the newest count even when n > 1. Fixes:
  - in `closeChecks`, name the count only when `n === 1`; otherwise say "`n` asks with Ruth";
  - for the demo, decide whether the 9:21 Wire nails count and #0557's cancel are answered by 17:30. FACTS does not say, so add them to §2a's sample-gaps row (Q9) and match the board.
- **T11 · TD05 is not reached: Joy's first day draws an ordinary Today** ("1 jobs left", a Count · aisle C Next job, the red button opening `shelf/count`). `Today.tsx:41 firstDay` requires no jobs, but on empty books aisle C's 21-day count (Q10) is a job. Fix one of two ways, and write the rule in spec §4.6:
  - the first-day rule keys on the person (no job ever done, joined today), not on an empty yard;
  - or, if it stays "nothing of the yard yet", the `first-day` seed (`moments.ts:134` and `:176`) marks every aisle counted.

  Then the board's Get going, its links (Turn on alerts → `today/you`, Walk the shelf → `shelf`) and the call to Musa can be checked.
- **T12 · the not-loaded tiles open stage sheets** (TD07). The board links the four dashed tiles to Today, so they do nothing. In the app, tapping "To pack: not loaded yet" opens `pack` over a yard that has not loaded. Fix the failed state in `Today.tsx`/`frame.tsx`: render the tiles as plain elements (no `nav.push`), as drawn.
- **T13 · Grace's face hidden on the Alerts timeline** (TD10). At true scale GA (10:02) sits under DO (10:05). The board spaces them apart (GA at x 216, DO at 248). Fix in `Alerts.tsx`'s timeline: push a mark right until it is at least 30 px from the one before.
- **T14 · Alerts rows cut** (TD10). "New to pack · they coll…", "Ruth marked it deliver…" and "1 line · Denis · 10:…" end in an ellipsis. Two causes:
  - the title is 700 in the app and 600 on the board (`alerts.css:24 .st-al-t > span:first-child`);
  - the chip is 4 px wider than the board's (`pill.css:32`: gap 6 and padding 10, where the board uses gap 4 and padding 9).

  Fix: `font-weight: 600` on the title, and the board's chip spacing on this card (scoped to `.st-al`).
- **T15 · "Gate" is 57×36** (TD11, `alerts.css:79 .st-rcard-act`). The board wraps its 36 px pill in a 44 px link. Fix: a 44 px tall button with the 36 px pill drawn inside it. The visible pill can stay 36 px.
- **T16 · no older alerts on the empty board** (TD29). The board keeps "Fri 16 Oct · 6 · read" (collapsed, → `today/alerts`), but `moments.ts:135` empties `b.alerts` for `&state=empty`. Fix: keep the older read alerts in the empty seed, so the collapsed row and its tap can be checked.
- **T17 · the answered aisle count** (TD30, `WithRuth.tsx:41`). The app draws the `orders` box, where the board draws the aisle's own icon (Roofing: the house). Its title "Count · aisle A · Roofi…" is cut, where the board shows it whole. Fix: use the aisle's category icon (as Today's tiles do), and let the answered row's title wrap to two lines instead of ending in an ellipsis.
- **T18 · You's figures** (TD12). The board links the day ring ("Your day: 5 of 12 jobs done") and all three stats to Today. The app links Checked in and Packed, but not Out (a plain element) and not the ring. Fix in `You.tsx`: make Out and the ring the same link as the other two.
- **T19 · Pass the yard says "Sent" before it is sent** (TD14, TD18). After the slide, the app goes straight to "Sent to Okello · 10:41 · his phone buzzed" while the write is still held for 10 s (Q17), and TD26 shows it can still fail after that. Spec §4.8 says never show a tick before the server's yes, and TD18's "Sending…" is never shown. Fix in `PassYard.tsx`:
  - during the hold, show TD14's screen with true words ("Passing to Okello… · Take it back 10 s", no tick, step 1 "Sends in 10 s");
  - when the hold ends, show TD18's Sending… dock;
  - show "Sent" only on the server's yes.

  The lead also redraws TD14's held state, because the board draws the screen after the send.
- **T20 · a slide that cannot go is drawn live** (TD24 "Pick who takes the yard", TD27 "Back online to close", TD28 "Set the return aside first"). The board draws the quiet track (`rgba(255,255,255,.05)` with a 1 px ring) and the words in #9AA3BC at weight 600. The app draws the normal track with white 700 words; only its knob is grey. Fix: in `PassYard.tsx:108` and `CloseYard.tsx:107–108`, use the shared locked slide that already draws this (`Slide.tsx`'s `ow-lslide quiet`, `slide.css:19–21`), not `<Slide state="blocked|offline">`.
- **T21 · `--ink-faint` on the ground, 4.35:1.** TD24's "a colleague with a yard login shows here" (`frame.css:43 .st-nobody span`) and TD22's "code ST-101" (`signin.css:61`). The boards draw #5F6980. Fix: `var(--ink-soft)`, as the token's own comment says.
- **T22 · "Sending…" in dark ink on the red fill, 1.24:1** (TD19). `slide.css .ow-sslide-l` sets no colour, so it takes the dock's ink. The board draws it white. Fix: `.ow-sslide { color: #FFFFFF; }`.
- **T23 · the pressed red button keeps its size** (TD33). The colour is right, but the board also draws `scale(.97)`. Fix: `.ow-plus:active { transform: scale(.97) }` in `src/ui/tabbar.css`. The shared P16 is drawn with the same press; if Sales' canvas disagrees, list it as an open question rather than choosing.
- **T24 · "Forgot password?" does nothing** (TD20, TD31, TD23). `SignIn.tsx:58` calls `toast.show`, but `shell/App.tsx:62–64` renders the login, checking and no-reach phases without `<ToastHost />`. So Q21's words, "Ask your manager for a new invite link", never show. Fix: render `<ToastHost />` (and `<SheetHost />`) in those three branches.
- **T25 · TD23 cannot be reached.** The demo signs in at once, so "Signing in…" shows for one frame. Fix: make the demo's `signIn` wait about 1.5 s (or add a `&slow=1` flag), and shoot it in the spec.
- **T26 · Checking** (TD21). The Next job skeleton does not match the board:
  - the board draws a 228 px flat navy card with the tag and from pills, an 84 px ring, three 58 px tiles, and the lock line 16 px lower;
  - the app (`Boot.tsx`) draws a 210 px gradient card with a thin bar and a smaller ring.

  Fix: match the board's shapes. Also, the board links Today and Shelf in the tab bar, but in the checking phase the app's tabs do nothing (`App.tsx:63`). Either mark them `aria-disabled` and have the lead correct TD21's links, or let Shelf open.
- **T27 · No reach** (TD22). Four differences:
  - "Open the copy" says "saved on this phone" without the board's **7:52**;
  - tapping it opens Today "Not loaded" (TD07), because the `no-reach` demo has no saved copy;
  - "Work kept" says "nothing waiting" where the board draws "2 waiting to send";
  - "Work kept" is not a link, where the board draws one.

  Fix: the `no-reach` seed keeps the 7:52 copy and the two kept writes, as `&offline&kept=1` does. `Boot.tsx:67` prints the copy's time and shows "Open the copy" only when a copy exists. "Work kept" opens Today's Waiting to send.
