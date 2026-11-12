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
