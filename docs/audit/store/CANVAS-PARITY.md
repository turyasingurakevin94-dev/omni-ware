# Canvas parity — Store

The independent critics' check of the new Store app (`next/store.html`) against the approved canvas (`docs/canvas/store-agent/boards/`, 360 × 800), each board reached by **real taps from Today** in the demo seeded with the canvas's `FACTS.md`. Modelled on `docs/audit/sales/CANVAS-PARITY.md`. The builders' own records (`docs/audit/store/parity/<area>.md`) are claims; this file is the critics' verdict.

| How | Where |
|---|---|
| The taps and demo flags per board | `test/parity/store-<area>.json` |
| Board beside app, diff, % of pixels that differ (any channel > 24/255) | `npm run build:store && NODE_PATH=$(npm root -g) node tools/parity/run.cjs --tab store-<area>` → `docs/audit/store/parity/` |
| Rules a difference may rest on | `docs/spec/04-screens-store.md` §2a, §3 (Kevin's rulings), §4; `docs/spec/04-screens-store-routes.md` |

Each area critic checks per board: **shows** (content, words, figures, states as drawn), **links** (every control tapped in Playwright, landing route read from `sessionStorage['ow-store-view']`), **44px** targets, **11px** text, **contrast** ≥ 4.5:1 (computed styles, background composited up the tree), **clip** (`scrollWidth` ≤ 360, no clipped or unreachable text), and **no money**. A difference passes only as font/antialias noise, a demo figure that differs with a written reason, or one of Kevin's rulings. Each area owns its own section below; a critic adds or replaces only its own.

## Shelf

**Second critic run, 2026-11-12, on `6a95aa53` (the F1–F14 fixes). 30 boards, 30 pass, 0 fail.** The first run (on `a9af4308`) found 5 pass and 25 fail; its 14 failures are re-checked below.

Method: `npm run build:store`, then `tools/parity/run.cjs --tab store-shelf`, then every pair of images read by eye. Next, a Playwright replay of `test/parity/store-shelf.json` that measures computed styles: text size, contrast composited up the tree, every visible control's box, and `scrollWidth`. Last, every control each board draws is tapped in a fresh replay, and the landing is read from `sessionStorage['ow-store-view']`. The spec's taps are unchanged except SH41's last tap, which the fixer renamed "Back to Shelf" (the strip's new name). The redrawn boards (`docs/canvas/store-agent/review/SH-fixes.md`) were also measured.

Accepted across the area (not failures):
- **Kevin's rulings and the spec:**
  - the tab badge 5 or 3 where the board draws 7 (the shell's `next-job.ts`, Today's area);
  - "every / due in 21 days" and the aisle bars (Q10);
  - no "Print again" (Q21);
  - "412 on shelf" for "412 pc on shelf" (§4.5, one figure);
  - the count's time 9:21 for 9:20 (the books keep when it was sent);
  - "Clout tacks" for "Clout nails" (the written reason in the spec);
  - a row that opens its own item where the board links a stand-in (routes §3);
  - the amber bar's Try again retries rather than opening SH26 (BRIEF, P27);
  - "Counted · aisle F · Okello" on SH32 (the row form SH03 draws).
- **Layout and drawing:**
  - the 40 px strip above each sheet (`.sh-full-back`, the board's own 40 px strip; the 44 px Close does the same job);
  - dimmed keypad or form while sending, kept or failed (inactive controls, drawn the same on the board);
  - 2–6 px row shifts from line-height, and mono figures such as "10:41" in SH32's banner (font only);
  - the 11 s sent bar shot full where the board draws 60% (animation).
- **No money and no clipping:** "1,153" and "3m" are counts and sizes. No board shows money. `scrollWidth` is 360 on all 30.

The way-back strip is judged by the rule now in spec §4.9 ("Close goes to the board's place; the way back walks the stack"). Its name must be the screen really below, and it must land there. All 23 strips do: "Back to Roofing" lands on Aisle A, "Back to Find" on the search, "Back to Shelf" on Shelf, and "Back to the item" (SH23) on the item.

| Board | Route | Taps | Diff % | Shows | Links | 44px | 11px | Contrast | Clip | Verdict | Note |
|---|---|---|---|---|---|---|---|---|---|---|---|
| SH01 Shelf | `shelf` | 1 | 0.76 | ok | ok | ok | ok | ok | ok | pass | F1 fixed: `#B3BCD2` on the hero (5.83:1, field 4.60:1) |
| SH41 Shelf offline | `shelf` | 4 | 0.58 | ok | ok | ok | ok | ok | ok | pass | F1 fixed. Board only: its aisle names (11px `#5F6980` on the tiles) measure 4.43:1; the app's pass |
| SH06 Nothing needs a look | `shelf` | 1 | 0.28 | ok | ok | ok | ok | ok | ok | pass | F1 fixed; "due in 8 days" is Q10 |
| SH02 Find "nails" | `shelf/find` | 2 | 2.17 | ok | ok | ok | ok | ok | ok | pass | F2: Open → `shelf/count` with the waiting sheet (spec §4.5). F3: "Did you mean" scrolls (overflow-x auto, 489/360). #0549 → `in`. Orders 5 / All 9 accepted (#0534 and #0547 carry nails) |
| SH42 Find nothing | `shelf/find` | 2 | 0.41 | ok | ok | ok | ok | ok | ok | pass | |
| SH40 Scan | `shelf/scan` | 2 | 1.71 | ok | ok | ok | ok | ok | ok | pass | F4: A-3533 on board and app (`labelShort`, spec §4.5) |
| SH04 Aisle A | `shelf/aisle` | 2 | 5.28 | ok | ok | ok | ok | ok | ok | pass | |
| SH05 No aisle yet | `shelf/aisle` | 3 | 4.23 | ok | ok | ok | ok | ok | ok | pass | F5: Close → Shelf; "Back to Find" |
| SH03 Item | `shelf/item` | 3 | 6.53 | ok | ok | ok | ok | ok | ok | pass | F5: Close → Shelf; "Back to Roofing" |
| SH22 Ruth wrote off | `shelf/item` | 3 | 7.14 | ok | ok | ok | ok | ok | ok | pass | F6: the written-off part is tinted red |
| SH24 Ruth kept it | `shelf/item` | 3 | 6.82 | ok | ok | ok | ok | ok | ok | pass | |
| SH16 Count accepted | `shelf/item` | 3 | 0.24 | ok | ok | ok | ok | ok | ok | pass | F7: JM 11px. F8: 131 items |
| SH32 Denis answered | `shelf/item` | 3 | 0.83 | ok | ok | ok | ok | ok | ok | pass | F7: GA 11px. F9: "On the restock list · just now", head as drawn |
| SH10 Count | `shelf/count` | 5 | 0.05 | ok | ok | ok | ok | ok | ok | pass | Close → Shelf; "Back to Find" |
| SH19 Key pressed | `shelf/count` | 5 | 0.05 | ok | ok | ok | ok | ok | ok | pass | |
| SH11 Sending | `shelf/count` | 6 | 0.26 | ok | ok | ok | ok | ok | ok | pass | F10: no ring. F11: Undo 44px |
| SH12 Sent to Ruth | `shelf/count` | 6 | 0.2 | ok | ok | ok | ok | ok | ok | pass | |
| SH17 Not done | `shelf/count` | 6 | 0.02 | ok | ok | ok | ok | ok | ok | pass | F10: pad dimmed, no ring. F11: Try again 44px |
| SH18 Kept | `shelf/count` | 6 | 0.02 | ok | ok | ok | ok | ok | ok | pass | F10 |
| SH13 Count it again | `shelf/count` | 2 | 0.48 | ok | ok | ok | ok | ok | ok | pass | "Back to Shelf" (reached from Shelf) |
| SH15 A count is waiting | `shelf/count` | 3 | 0.51 | ok | ok | ok | ok | ok | ok | pass | F5: Close and Leave it with Ruth → the item. F12: `#5F6980`. Board only: its "Shelf" step label is still `#6B7480` (4.35:1); the app's passes |
| SH25 Someone else | `shelf/count` | 7 | 0.09 | ok | ok | ok | ok | ok | ok | pass | F5: Keep Okello's → the item. F10 |
| SH14 Aisle count | `shelf/count {aisle}` | 5 | 5.45 | ok | ok | ok | ok | ok | ok | pass | F13: the number field is 44px tall |
| SH20 Report | `shelf/report` | 2 | 1.31 | ok | ok | ok | ok | ok | ok | pass | F5: Close → the item. F11: pc/bundle 44px |
| SH21 Sent to Ruth | `shelf/report` | 3 | 0.3 | ok | ok | ok | ok | ok | ok | pass | |
| SH23 Nothing on the shelf | `shelf/report` | 4 | 6.25 | ok | ok | ok | ok | ok | ok | pass | F5: Close → Shelf; "Back to the item" |
| SH26 Not sent yet | `shelf/report` | 3 | 0.8 | ok | ok | ok | ok | ok* | ok | pass | F14: the notes are at full strength; F11 |
| SH27 Not done | `shelf/report` | 3 | 0.8 | ok | ok | ok | ok | ok* | ok | pass | F14, F11 |
| SH30 We need more | `shelf/ask` | 2 | 0.07 | ok | ok | ok | ok | ok | ok | pass | F12 |
| SH31 Sent to Denis | `shelf/ask` | 3 | 0.37 | ok | ok | ok | ok | ok | ok | pass | |

`ok*`: the only text under 4.5:1 is the locked form (opacity .55). Those are inactive controls, the board draws them the same, and the notes outside them now measure in full.

### Shelf failures and fixes

None in the app. The first run's F1–F14 are all fixed and verified (above).

Two leftovers on the canvas, both board-only. The app already passes on both, so neither is a parity failure:
- **SH15 board:** the waiting track's "Shelf" step label is 11px `#6B7480` on `#F7F5F2` (4.35:1). Make it `#5F6980`, as its "9:21" and "now" now are.
- **SH41 board:** the aisle tiles' category names (11px `#5F6980`, under the tile's offline wash) measure 4.43:1. Drop the wash on the names, or darken them to `#4F5970`.

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

## Goods in

Critic run 2026-11-12 on `6a95aa53` (origin/claude/store-build). 29 boards. `test/parity/store-in.json` is unchanged: every tap reached its board, and the re-run diffs equal the builder's to 0.01. **11 pass, 18 fail.**

Accepted across the area (not failures):
- **The demo clock, and figures with a written reason.**
  - Times: 11:30 for 11:34 (IN06); 12:00 for 12:03 and 12:05 (IN10–IN15, IN12); 15:52 for Katwe Timber's 15:34 (IN31–IN35, because the demo taps Done at the hand-in clock); 11:02 for 11:03 (IN21).
  - Aisle B reads 118 → 218 for 120 → 220 (IN14, IN15): `shelf.ts` `onShelf`, after #0556's 2 bags were collected at 11:10.
  - IN40 reads "4 checked in today" for the board's 3. By FACTS §8, four arrivals are checked in by 17:30: the 10:05 trip, the 11:34 trip, the 12:00 Hima delivery and the Katwe ride. The board is one short.
- **The rail icons** are the shell's `RAIL`, as the Pack critic accepted.
- **Inactive controls dimmed as drawn:**
  - the off slide, "Count 2 more first" and "Waiting to send" (4.01:1);
  - IN16's tiles and chips while sending;
  - IN24's disabled "Not sent yet" (4.29:1);
  - IN10's 100-bag tile, which is 44×43 only while drawn pressed (scale .97).
- **Stand-in links**: IN01's "A supplier turned up" opens the listed delivery. IN10 and IN11's "Stack it in aisle B" open `shelf/aisle` (aisle B) where the board links SH01 (routes §3).
- The contrast hits under IN01's sheet ("Packing now · yours", 3.21:1) are Today's rows under the scrim, not on screen.
- **No money on any Goods-in board**: "3m" is a sheet length. `scrollWidth` is 360 on all 29, and no text is under 11 px.

| Board | Route | Taps | Diff % | Shows | Links | 44px | 11px | Contrast | Clip | Verdict | Note |
|---|---|---|---|---|---|---|---|---|---|---|---|
| IN01 Coming in | `in` | 1 | 9.54 | **head** | ok | ok | ok | ok | ok | fail (board) | G1 |
| IN40 Nothing coming | `in` | 1 | 8.88 | **head** | **Ask Denis** | ok | ok | ok | ok | fail | G1, G2 |
| IN02 Check-in | `in/checkin` | 3 | 1.27 | ok | ok | ok | ok | ok | ok | pass | pressed "1 tin" is the tap's moment |
| IN03 A line differs | `in/checkin` | 6 | 0.04 | ok | ok | ok | ok | ok | ok | pass | |
| IN04 Not on the list | sheet | 7 | 3.56 | ok | ok | ok | ok | ok | ok | pass | 2 px offsets |
| IN16 Extra sending | sheet | 8 | 3.64 | ok | ok | ok | ok | ok | ok | pass | dimmed as drawn |
| IN05 Sending | `in/checkin` | 6 | 3.08 | ok | **Scan** | ok | ok | ok | ok | fail | G3 |
| IN06 Checked in | `in/checkin` | 6 | 2.19 | **no Undo** | ok | ok | ok | ok | ok | fail | G4 |
| IN07 No signal | `in/checkin` | 6 | 2.49 | **saved 7:52, dimmed extra** | **Scan, Not on the list** | ok | ok | **2.68** | ok | fail | G3, G5 |
| IN08 Not done | `in/checkin` | 6 | 2.58 | ok | ok | ok | ok | ok | ok | pass | Try again 40 drawn in a 44 target |
| IN09 Someone else | `in/checkin` | 6 | 2.19 | ok | **Close** | ok | ok | ok | ok | fail | G6 |
| IN13 Ruth: keep it | `in/checkin` (push) | 0 | 0.46 | ok | ok | ok | ok | ok | ok | pass | |
| IN10 Delivery | `in/delivery` | 3 | 1.31 | **Torn?** | **Close, back** | ok | ok | ok | **sub** | fail | G6, G7, G8 |
| IN11 Some torn | `in/delivery` | 7 | 0.74 | **Torn bags wraps** | **Close, back** | ok | ok | ok | **sub** | fail | G6, G8, G9 |
| IN14 Delivery sending | `in/delivery` | 3 | 2.52 | **dimmed extra** | **Close, back** | ok | ok | ok | **sub** | fail | G3, G6, G8 |
| IN15 Delivery no signal | `in/delivery` | 3 | 2.53 | **saved 7:52, dimmed extra** | **Close, back, Not on the list** | ok | ok | **2.68** | **sub** | fail | G3, G5, G6, G8 |
| IN12 Delivery done | `in/delivery` | 3 | 9.04 | **no Undo, bag row** | ok | ok | ok | ok | ok | fail | G4, G9 |
| IN20 Return | `in/return` | 3 | 19.38 | **chips wrap** | ok | ok | ok | **"kept" 1.86** | ok | fail | G10, G11 |
| IN23 Return sending | `in/return` | 4 | 17.74 | **chips wrap, whole card dimmed** | ok | ok | ok | **2.30–4.27** | ok | fail | G10, G11, G12 |
| IN21 Sent to Ruth | `in/return` | 4 | 5.34 | ok | ok | ok | ok | ok | ok | pass | bar full after 10 s (animation) |
| IN24 Return no signal | `in/return` | 4 | 19.02 | **chips wrap** | ok | ok | ok | **"kept" 1.86** | ok | fail | G10, G11 |
| IN25 Return not done | `in/return` | 4 | 23.0 | **chips wrap, "Grace sees" under the red bar** | ok | ok | ok | **"kept" 1.86** | ok | fail | G10, G11 |
| IN22 Ruth took it back | `in/return` (push) | 0 | 0.26 | **gate 11:03, bold sub** | ok | ok | ok | ok | ok | fail | G13 |
| IN30 Ride | `in/ride` | 2 | 0.65 | ok | ok | ok | ok | ok | ok | pass | |
| IN31 Hand in | `in/ride` | 3 | 0.76 | ok | ok | ok | ok | ok | ok | pass | |
| IN34 Hand-in sending | `in/ride` | 4 | 0.85 | ok | ok | ok | ok | ok | ok | pass | |
| IN33 Ride no signal | `in/ride` | 3 | 0.86 | **saved 7:52** | ok | ok | ok | ok | ok | fail | G5 |
| IN35 Hand-in not done | `in/ride` | 4 | 1.08 | ok | ok | ok | ok | ok | ok | pass | |
| IN32 Handed in | `in/ride` | 4 | 6.0 | **no Undo** | ok | ok | ok | ok | ok | fail | G4 |

### Goods in failures and fixes

- **G1 · two heads for one stage sheet** (IN01, IN40), the board's flaw. IN01 and IN40 draw their own head: a 24 px strip, a square foot, a taller rail, and on IN40 "nothing coming" beside the title. PK01 and OU01 draw the shared `shell/StageSheet.tsx` head (40 px strip, rounded foot), which the app uses everywhere. The builder chose PK01's silently. Keep the app as it is. Redraw IN01's and IN40's heads as PK01's, and record in spec §2a that the stage sheet has one head (PK01).
- **G2 · "Ask Denis for more" opens Find** (IN40). The board links SH30 (`shelf/ask`). The app opens `shelf/find`, because an ask needs an item. This is not in the spec. Either have the lead relink the board to SH02 and record it in routes §3, or open `shelf/ask` with an item picker. Do not leave it unrecorded.
- **G3 · dead or dimmed head buttons while sending or kept.**
  - `Checkin.tsx:136` and `Delivery.tsx:101` ignore the Scan tap when `locked`, but the button still looks live. IN05 and IN07 link it to SH40.
  - `Checkin.tsx:140` and `Delivery.tsx:104` disable "Not on the list" (2.68:1) when kept. IN07 and IN15 draw it at full strength and live. While sending (IN14), the board draws it live, but IN05 draws it dimmed.
  - Fix: let Scan and Not on the list work while kept (the extra waits in the outbox, as the return does). Disable both while sending, with the `disabled` attribute rather than a silent guard. Redraw IN14 dimmed, the same as IN05.
- **G4 · no Undo after a check-in** (IN06, IN12, IN32). All three boards draw "Undo 10 s" with its bar, and spec §4.9 says that every write that moves goods waits at least 10 s with Undo (`core/store/held.ts`). The builder's reason is that "no write takes a check-in back", but the fix is to hold the write, not to undo it. Fix: send the check-in, the delivery and the ride hand-in through `held.ts`, as the return already is (`Return.tsx:126`). Show the Undo chip in `CheckedIn.tsx` and the Ride end screen. If this cannot be built, it is an open question for Kevin in §3, not a pass.
- **G5 · "Updating · saved 7:52"** (IN07, IN15, IN33). `Checkin.tsx:125`, `Delivery.tsx:90` and `Ride.tsx:158` pass `b.at`, the time the books on the phone were last read. The boards draw when this work was kept: 11:33, 12:04, 15:52. "Saved 7:52" tells the yard that their count was saved four hours ago. Fix: pass the outbox entry's time (the slide's time).
- **G6 · Close and the back strip** (IN09, IN10, IN11, IN14, IN15).
  - IN10–IN15 are reached from Today's Next job, so the strip, which reads "Back to Coming in", lands on Today, and so does Close (`Delivery.tsx:101 nav.back()`). The board links both to IN01.
  - IN09's Close lands on Coming in. The board links it to TD01.
  - Fix: Delivery's Close calls `nav.tab('in')`. IN09's Close calls `nav.tab('today')`, labelled "Close: back to Today". The strip keeps `nav.back()`, but its label names the screen actually below (as Shelf F5).
- **G7 · "Torn?" is not on the board** (IN10). The app adds `.in-anytorn` (`Delivery.tsx:122`), which pushes "Tap the stacks of 10 you see" onto two lines. No board draws the way from IN10 to IN11, and that gap is the board's. Draw "Torn?" on IN10 first (canvas first), with the hint kept to one line: drop "you see", or put Torn? on the hint's row.
- **G8 · the delivery head is cut off**, the board as drawn too (IN10, IN11, IN14, IN15). The sub "at the yard 12:00 · 1 line" is 187 px in a 152 px box and shows as "at the yard 12:00 · …". The section head already says "1 line · refill". Fix: the sub reads "at the yard 12:00". Redraw the four boards.
- **G9 · bag rows** (IN11, IN12). The board overlaps the torn bags by −8 px. The app spaces them out, so "Torn bags" wraps to two lines. Fix: `in.css:269 .in-torn-bags > * + * { margin-left: -8px }`. IN12's five bags sit 10 px lower and narrower than on the board: match `CheckedIn` "Where it went" to the board's art size.
- **G10 · the return head's chips** (IN20, IN23, IN24, IN25). See the note below.
- **G11 · "kept" at 1.86:1** (IN20, IN23–IN25), the board as drawn too. `return.css:7 .rt-unit { opacity: .45 }` fades the word with the picture. The word says what happens to the bag, so it is not an inactive label. Fix: put the .45 on `.rt-pic` only, and leave `.rt-w` at `--ink-soft` (5.0:1). Redraw the boards.
- **G12 · sending dims too much** (IN23). `return.css:3` sets the whole `.in-card` to .6, so "Cement · Hima 50kg" (4.27), "Grace asked" (2.47), "Set aside · never back on the shelf" (3.26) and the Wood glue row (2.30) all fall below 4.5. The board dims only the bag strip, the Good/Damaged switch and the camera button. Fix: `.rt-form.locked .rt-units, .rt-form.locked [role=radiogroup], .rt-form.locked .nl-cam { opacity: .45 }`, and nothing else.
- **G13 · Ruth's answer** (IN22).
  - `Return.tsx:195` stamps "At the gate" with the ask's `createdAt`, so it always equals Sent (11:03). The board, and the app's own IN20, say 11:02. Fix: carry `gateAt` in `askOf` and show it.
  - `in.css:223` makes "2 bag · back wall" 12 px bold mono. The board draws 11 px regular mono. Fix: limit that rule to `span + span:not(.mono)`.

**On the return head's chips (G10).** The board does not fit, in its own font either. With `nowrap`, the chips run 20–348 in a row that ends at 340, 8 px too far. The board hides this only because its sheet has `overflow: hidden`. Wrapping does stop the clip, but it costs the body 36 px. On IN25 that pushes "Grace sees Return asked" under the red bar, and it is the whole 18–23 % diff.

A better fix keeps the board's one row: shorten the first chip to **"From Grace · Fri 15:40"** (`Return.tsx:135`, drop "asked"). The card just below already says "Grace asked 2 of 3 bag". The chip then reads like the other heads ("From Denis · Buyer"). Measured at 360 px, the two chips end at x ≈ 317 of 340, which leaves room for the phone's wider Figtree (+15 px). Keep `flex-wrap` in `.in-head-chips` only as the fallback for a long name. Redraw IN20, IN23, IN24 and IN25 with the shorter chip in the same commit.

The other options are worse:
- a scrolling chip row hides who brought the return;
- an ellipsis on the first chip cuts off the time;
- tighter padding saves about 6 px, which is not enough.
