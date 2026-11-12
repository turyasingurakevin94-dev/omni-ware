# Canvas parity — Store

The independent critics' check of the new Store app (`next/store.html`) against the approved canvas (`docs/canvas/store-agent/boards/`, 360 × 800), each board reached by **real taps from Today** in the demo seeded with the canvas's `FACTS.md`. Modelled on `docs/audit/sales/CANVAS-PARITY.md`. The builders' own records (`docs/audit/store/parity/<area>.md`) are claims; this file is the critics' verdict.

| How | Where |
|---|---|
| The taps and demo flags per board | `test/parity/store-<area>.json` |
| Board beside app, diff, % of pixels that differ (any channel > 24/255) | `npm run build:store && NODE_PATH=$(npm root -g) node tools/parity/run.cjs --tab store-<area>` → `docs/audit/store/parity/` |
| Rules a difference may rest on | `docs/spec/04-screens-store.md` §2a, §3 (Kevin's rulings), §4; `docs/spec/04-screens-store-routes.md` |

Each area critic checks per board: **shows** (content, words, figures, states as drawn), **links** (every control tapped in Playwright, landing route read from `sessionStorage['ow-store-view']`), **44px** targets, **11px** text, **contrast** ≥ 4.5:1 (computed styles, background composited up the tree), **clip** (`scrollWidth` ≤ 360, no clipped or unreachable text), and **no money**. A difference passes only as font/antialias noise, a demo figure that differs with a written reason, or one of Kevin's rulings. Each area owns its own section below; a critic adds or replaces only its own.

## Shelf

**Third critic run, 2026-11-12, on `bacd5c32` (the shared fixes from the other areas: `src/ui/pill.css`, `src/ui/sheet.css`, StageSheet's back strip, the demo states, howLong's "just now"; SH15 and SH41 redrawn). 30 boards, 30 pass, 0 fail.** I re-ran the spec and re-measured all 30. Three boards moved: SH32 (0.83 → 0.69), SH11 (0.26 → 0.12) and SH15 (0.51 → 0.39). All three are now closer to their boards, and nothing new differs. The strip names, links and measures are as on `6a95aa53`. Earlier runs: `a9af4308` found 5 pass and 25 fail; `6a95aa53` found 30 pass.

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
| SH41 Shelf offline | `shelf` | 4 | 0.58 | ok | ok | ok | ok | ok | ok | pass | F1 fixed. |
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
| SH32 Denis answered | `shelf/item` | 3 | 0.69 | ok | ok | ok | ok | ok | ok | pass | F7: GA 11px. F9: "On the restock list · just now", head as drawn |
| SH10 Count | `shelf/count` | 5 | 0.05 | ok | ok | ok | ok | ok | ok | pass | Close → Shelf; "Back to Find" |
| SH19 Key pressed | `shelf/count` | 5 | 0.05 | ok | ok | ok | ok | ok | ok | pass | |
| SH11 Sending | `shelf/count` | 6 | 0.12 | ok | ok | ok | ok | ok | ok | pass | F10: no ring. F11: Undo 44px |
| SH12 Sent to Ruth | `shelf/count` | 6 | 0.2 | ok | ok | ok | ok | ok | ok | pass | |
| SH17 Not done | `shelf/count` | 6 | 0.02 | ok | ok | ok | ok | ok | ok | pass | F10: pad dimmed, no ring. F11: Try again 44px |
| SH18 Kept | `shelf/count` | 6 | 0.02 | ok | ok | ok | ok | ok | ok | pass | F10 |
| SH13 Count it again | `shelf/count` | 2 | 0.48 | ok | ok | ok | ok | ok | ok | pass | "Back to Shelf" (reached from Shelf) |
| SH15 A count is waiting | `shelf/count` | 3 | 0.39 | ok | ok | ok | ok | ok | ok | pass | F5: Close and Leave it with Ruth → the item. F12: `#5F6980`. |
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

The two notes left on the canvas last run (SH15's "Shelf" step label and SH41's aisle names) are fixed on the redrawn boards. Both boards now measure clean.

## Pack

**Re-check 2026-11-12 on `bacd5c32`** (origin/claude/store-build, after the fixes to F1–F9). This re-check covers 25 boards: the 22 Pack boards plus AD02, AD05 and AD06 (Unpack, "Added while building"). `test/parity/store-pack.json` is unchanged and every tap reached its board. I looked at every board/app pair, measured each board, and tapped each control again. The first run, on `6a95aa53`, had 7 pass and 18 fail. **Now: 25 pass of 25** (PK07's F10 fixed in `9a05bfac` and re-run alone: "just now" whole, fits its tile, no clip).

| Fix | What it was | What the re-check found |
|---|---|---|
| F1 | Back strip | Fixed. `pack/order` reached from the red Next job reads "Back to Today" and lands on Today. `pack/put-back` reached from To pack reads "Back to To pack" and lands on To pack. Close still goes to the board's place (To pack, Today). |
| F2 | Not-sent count | Fixed. PK11 reads "1 not sent yet". |
| F3 | The empty yard | Fixed. PK14 now shows the board's helpers, and all three links land: → `in/checkin`, → `out/load`, → `out/gate {555}`. It says "1 delivered today". |
| F4 | Waiting group offline | Fixed. PK20 offline folds Waiting on goods to its head row ("Denis ~11:30 ›"), which opens the first waiting order. |
| F5 | Short line in the strip | Fixed. PK05's short line has its mint bar, a white label and no tick. |
| F6 | Contrast: "Next job" | Fixed in the app and on the boards. |
| F7 | Contrast: the copy's face | Fixed in the app and on the boards. |
| F8 | Contrast: "After Unpack" | Fixed in the app and on the boards. No text in the area is now under 4.5:1 except inactive controls. |
| F9 | The page under the Unpack sheet | Fixed. Tapping the scrim on AD02 or AD06 now does what Keep it packed does: the sheet closes and the app is back on PK06 (#0552 Packed). The bare #0530 page is never left open. |

Accepted across the area (not failures):
- **The item picture.** The demo's shelf has no photos, so the aisle's duotone stands in. It is about 3–4 % of a pack card.
- **The rail icons** are the shell's `RAIL`.
- **Figures corrected to the data** (spec §2a, FACTS §8):
  - #0552's line 2 is the wheelbarrows (2 pc), where PK04, PK05, PK16 and PK19 draw wire nails (2 ctn).
  - #0530 is cancelled at 10:38, where the boards say 10:41.
  - The demo's fail code is PK-502, for the boards' sample codes.
- **No per-line pick time** on PK15 or PK17: the books have no `pickedAt`.
- **The shared parts.** The P28 toast (max-content, no seconds on Undo) stands for the boards' full-width band on PK05, PK15 and AD05. The shared Not done card has a 44 px ×, which AD06 does not draw.
- **The demo clock.** The Undo ring starts at 10 s (boards 7 s), 10:41 for 10:42, 36m for 37 m.
- **PK07** is on #0556, not #0554, because #0554 is already at the gate in the demo. Bay 1 shows #0552 (FACTS: "#0552 bay 1").
- **AD02's packer** is Okello and bay 3 is free, as the books have it. PK06 draws bay 3 free too.
- **AD05's Buying** is "skipped": #0530 has no Buying in the books. AD05 lists the order under To pack now (Q23).
- **PK13's Waiting on goods group** is not on the board, but the books hold it at that moment (PK01 draws it).
- **PK14's chips.** The Packed chip reads 1 (#0552, packed on bay 1, waiting for the truck), where the board reads 0 beside "To load 1 → Ntinda". Spec §4.1 says Packed is `pickingStatus: done` in Packing, a delivery waiting for the truck on its bay, so it is the To load list. A board that disagrees with §4 is corrected to it, so the app is right and the board's 0 is the error.
- **PK14's helper tiles** are about 30 px shorter than the board draws them (52 vs 82 px). The words, figures and links are the same, and the tiles are still at least 44 px.
- **Stand-in links.** A row that opens #0556's pack where the board links PK01 as a stand-in (routes §3).
- **PK03's press.** The tool cannot hold a press. The `:active` rule is in `pack/card.css:49`.
- **Inactive controls, as drawn:**
  - Short and the amount tiles are dimmed while sending (PK16, PK18).
  - "Back online to finish", "Waits for the goods" and the blocked put-back slide are disabled, at 4.30:1.
- **The toast covers the back strip** for 10 s on PK05, PK15 and AD05. The board's toast covers it too.

**No money on any Pack board.** "39m", "36m", "3m" and "1 m" are minutes and sizes, not money. On all 25 boards there is no text under 11 px, no target under 44 px, and `scrollWidth` is 360 (the stage chips scroll, `stagesheet.css:17`).

| Board | Route | Taps | Diff % | Shows | Links | 44px | 11px | Contrast | Clip | Verdict | Note |
|---|---|---|---|---|---|---|---|---|---|---|---|
| PK01 To pack | `pack` | 2 | 5.91 | ok | ok | ok | ok | ok | ok | pass | F7 fixed |
| PK02 Pack | `pack/order` | 1 | 4.14 | ok | ok | ok | ok | ok | ok | pass | F1 fixed |
| PK03 Pressed | `pack/order` | 1 | 8.57 | ok (rule) | ok | ok | ok | ok | ok | pass | |
| PK18 Sending | `pack/order` | 2 | 4.14 | ok | ok | ok | ok | ok (disabled) | ok | pass | |
| PK11 No signal | `pack/order` | 2 | 3.91 | ok | ok | ok | ok | ok (disabled) | ok | pass | F2 fixed |
| PK12 Not saved | `pack/order` | 2 | 5.28 | ok | ok | ok | ok | ok | ok | pass | |
| PK04 Pack short | `pack/order` | 2 | 1.96 | ok | ok | ok | ok | ok | ok | pass | |
| PK16 Short sending | `pack/order` | 3 | 1.5 | ok | ok | ok | ok | ok (dimmed, as drawn) | ok | pass | |
| PK19 Short not saved | `pack/order` | 3 | 3.6 | ok | ok | ok | ok | ok | ok | pass | |
| PK05 Short sent | `pack/order` | 3 | 2.42 | ok | ok | ok | ok | ok | ok | pass | F5 fixed |
| PK06 Packed | `pack/order` | 2 | 1.81 | ok | ok | ok | ok | ok | ok | pass | F6 fixed |
| PK07 Ready to collect | `pack/order` | 5 | 5.54 | ok (data) | ok | ok | ok | ok | ok | pass | F10 fixed (`9a05bfac`) |
| PK15 Unpack | `pack/order` | 3 | 1.24 | ok | ok | ok | ok | ok | ok | pass | |
| PK08 For you | `pack` | 2 | 6.78 | ok | ok | ok | ok | ok | ok | pass | |
| PK09 Look only | `pack/look` | 3 | 0.08 | ok | ok | ok | ok | ok | ok | pass | |
| PK13 Someone else | `pack` | 4 | 6.94 | ok | ok | ok | ok | ok | ok | pass | |
| PK17 Okello's | `pack/look` | 5 | 2.09 | ok | ok | ok | ok | ok | ok | pass | |
| PK14 Empty | `pack` | 1 | 6.37 | ok (§4.1 Packed) | ok | ok | ok | ok | ok | pass | F3 fixed |
| PK20 Offline | `pack` | 2 | 5.72 | ok | ok | ok | ok | ok | ok | pass | F4 fixed |
| PK21 Waits for the goods | `pack/order` | 3 | 6.95 | ok | ok | ok | ok | ok (disabled) | ok | pass | |
| PK10 Put it back | `pack/put-back` | 4 | 0.58 | ok | ok | ok | ok | ok (blocked slide) | ok | pass | |
| PK22 Put back not saved | `pack/put-back` | 5 | 2.08 | ok | ok | ok | ok | ok | ok | pass | |
| AD02 Unpack #0530 | `pack/order {unpack}` | 3 | 4.13 | ok (data) | ok | ok | ok | ok | ok | pass | F9 fixed |
| AD05 Unpacked | `pack/order {unpack}` | 4 | 6.89 | ok (data, Q23) | ok | ok | ok | ok | ok | pass | |
| AD06 Unpack not saved | `pack/order {unpack}` | 4 | 10.08 | ok | ok | ok | ok | ok | ok | pass | F8, F9 fixed |

### Pack failures and fixes

None open. F10 (PK07: "justnow" because `Packed.tsx:106` stripped every space) is fixed in `9a05bfac`; the figure now reads "just now".

## Today

Critic re-run 2026-11-12 on `bacd5c32` (origin/claude/store-build, after the builders' T1–T27 fixes and `docs/canvas/store-agent/review/TD-fixes.md`). 33 boards. `test/parity/store-today.json` now has TD04's taps (set the return aside, Close) and reaches every board, TD18 and TD23 included. Every board link was replayed in Playwright, and the rest was measured in computed styles.

**25 pass, 8 fail.**

Measured on all 33:
- contrast ≥ 4.5:1 on every text;
- every control at least 44 px (Gate is now 57×44);
- no text under 11 px;
- `scrollWidth` 360;
- no money ("41 m" and "1 m" are durations).

The one ellipsis left, "#0538 · Nansana · Fri 1…" on TD10, is cut on the board too.

Re-checked by hand:
- TD33's press: `#A82D24` and `scale(.97)`.
- "Forgot password?" shows "Ask your manager for a new invite link" (Q21).
- TD07's tiles do nothing.
- TD21's tabs are `aria-disabled`.
- TD22's Open the copy opens Today "Updating · saved 7:52".
- You's ring and Out link to Today.
- TD05's Turn on alerts → `today/you` and Walk the shelf → `shelf`.

Accepted (not failures):
- **Recorded open questions.**
  - "Ssali 13:20" (TD01, TD08, TD33) and Kampala Road with the shop's call button (TD12) are left out by Q25. The boards still draw them; redraw them with Q25's default.
  - #0530's faces BO RN and "Brian takes it" follow FACTS (§2a).
  - TD32's #0552 first is Q20.
- **Choices with a correct written reason.**
  - "tried 3 times" is left out on TD07 and TD22 (§4.8). Redraw.
  - "Your manager sends you an invite link" on TD20, TD23 and TD31: nobody is known before sign-in. Redraw.
- **Demo figures.**
  - TD02's 8 done: the board's own To load 2 counts #0552.
  - Bay 4 (PK06).
  - Aisle C "sent 14:40" on TD16, TD19, TD27 and TD28 (FACTS §8 now says 14:40). The boards still say 16:40; correct them.
  - TD10/TD29's "1 · read" (FACTS lists one alert from Fri 16 Oct).
  - The demo clock's 10:41/17:30, where boards draw 10:42/17:42.
  - TD31's empty password.
- **Layout noise.** TD09's scroll offset, and TD11's cards 5–8 px taller.

**T7: is the new FACTS §8 sound? Mostly, with one contradiction.** Writing the demo's later moments into FACTS fills gaps FACTS left open, and TD03, TD04 and the close boards now agree with it. But the new 11:10 (#0556 collected) and 11:20 (#0547 delivered) rows are earlier than TD02's 11:32. At 11:32 the board **and** the app still show #0556 to pack ("then #0556", To pack 1 NH) and #0547 on the road (GS, "3 delivered today"). The reason is in `demo/moments.ts:80–85`: both are applied only in the 12:00 step. So FACTS now disagrees with TD02 and with the demo it was written from (G-T7 below). §2a says FACTS is the source the boards follow. Filling it from the demo is acceptable only where FACTS was silent, so these deliveries should also be listed as sample gaps in Q9, as Ruth's 17:30 answers were.

| Board | Route | Taps | Diff % | Shows | Links | 44px | 11px | Contrast | Clip | Verdict | Note |
|---|---|---|---|---|---|---|---|---|---|---|---|
| TD01 Today | `today` | 0 | 1.94 | ok (Q25) | ok | ok | ok | ok | ok | pass | board redraw: no 13:20 |
| TD09 Today scrolled | `today` | 1 | 13.69 | ok | ok | ok | ok | ok | ok | pass | scroll offset |
| TD33 Next job pressed | `today` | 0 | 2.81 | ok | ok | ok | ok | ok | ok | pass | press measured |
| TD02 Next is a check-in | `today` &at=1132 | 0 | 0.39 | **#0556 to pack, #0547 on the road after FACTS' 11:10/11:20** | ok | ok | ok | ok | ok | fail | G-T7 |
| TD03 Next is a ride | `today` &at=1510 | 0 | 0.83 | ok | ok | ok | ok | ok | ok | pass | |
| TD04 Calm | `today` &at=1730 | 3 | 1.04 | ok | ok | ok | ok | ok | ok | pass | |
| TD05 First day | `today` &state=first-day | 0 | 0.31 | ok | **red button: toast** | ok | ok | ok | ok | fail | G-T5 |
| TD06 Offline | `today` &offline&kept=1 | 0 | 7.11 | ok | ok | ok | ok | ok | ok | pass | |
| TD07 Load failed | `today` &fail=snapshot | 0 | 2.97 | ok | ok | ok | ok | ok | ok | pass | |
| TD08 Update ready | `today` &update=1 | 0 | 0.27 | ok (Q25) | ok | ok | ok | ok | ok | pass | |
| TD10 Alerts | `today/alerts` | 1 | 3.49 | ok | ok | ok | ok | ok | ok | pass | GA spaced |
| TD11 With Ruth | `today/with-ruth` | 2 | 13.27 | ok | ok | ok | ok | ok | ok | pass | |
| TD29 Alerts empty | `today/alerts` &state=empty | 1 | 2.65 | ok | ok | ok | ok | ok | ok | pass | "1 · read" (FACTS) |
| TD30 With Ruth empty | `today/with-ruth` &state=empty | 2 | 6.39 | ok | ok | ok | ok | ok | ok | pass | |
| TD12 You | `today/you` | 1 | 15.61 | ok (Q25) | ok | ok | ok | ok | ok | pass | |
| TD13 Pass the yard | `today/pass-yard` | 2 | 4.66 | ok | ok | ok | ok | ok | ok | pass | |
| TD18 Sending | `today/pass-yard` | 3 | 4.88 | ok | ok | ok | ok | ok | ok | pass | |
| TD14 Passing (held) | `today/pass-yard` | 3 | 9.13 | **MK face** | ok | ok | ok | ok | ok | fail | G-T14 |
| TD24 Nobody else | `today/pass-yard` &state=nobody | 2 | 4.03 | **knob icon** | ok | ok | ok | ok | ok | fail | G-T20 |
| TD26 Pass failed | `today/pass-yard` &fail=passYard | 3 | 5.04 | ok | ok | ok | ok | ok | ok | pass | |
| TD15 Musa passed you | `today` &as=okello&at=1043 | 0 | 0.61 | ok | ok | ok | ok | ok | ok | pass | |
| TD25 I've got it sending | `today` &as=okello&at=1043 | 1 | 0.9 | ok | ok | ok | ok | ok | ok | pass | |
| TD32 The yard is yours | `today` &as=okello&at=1043 | 1 | 3.55 | ok (Q20) | ok | ok | ok | ok | ok | pass | |
| TD28 Close, 3 of 4 | `today/close-yard` &at=1730 | 1 | 9.64 | **knob icon** | ok | ok | ok | ok | ok | fail | G-T20 |
| TD16 Close the yard | `today/close-yard` &at=1730 | 2 | 9.51 | ok | ok | ok | ok | ok | ok | pass | board: 14:40 |
| TD27 Close offline | `today/close-yard` &offline | 2 | 10.04 | **knob icon** | ok | ok | ok | ok | ok | fail | G-T20 |
| TD19 Close sending | `today/close-yard` &at=1730 | 3 | 9.68 | ok | ok | ok | ok | ok | ok | pass | |
| TD17 Closed | `today/close-yard` &at=1730 | 3 | 6.08 | ok | ok | ok | ok | ok | ok | pass | |
| TD20 Sign in | `shell/sign-in` &state=signed-out | 0 | 1.49 | ok | ok | ok | ok | ok | ok | pass | |
| TD31 Wrong password | `shell/sign-in` | 1 | 3.87 | ok | ok | ok | ok | ok | ok | pass | |
| TD23 Signing in | `shell/sign-in` | 1 | 7.59 | **busy button dark red** | ok | ok | ok | ok | ok | fail | G-T23 |
| TD21 Checking | `shell/checking` &state=loading | 0 | 7.7 | ok | ok | ok | ok | ok | ok | pass | |
| TD22 No reach | `shell/no-reach` &state=no-reach | 0 | 10.69 | **"saved 7:52"** | ok | ok | ok | ok | ok | fail | G-T22 |

### Today failures and fixes (re-run)

- **G-T7 · FACTS §8's 11:10 and 11:20 come before TD02's 11:32** (TD02). FACTS says #0556 was collected at 11:10 and #0547 delivered at 11:20. Both TD02 and the app at `&at=1132` still show #0556 To pack (NH, "then #0556") and #0547 on the road (GS, 3 delivered). That is because `src/core/store/demo/moments.ts:80–85` applies both only in the 1200 step. Fix one way or the other:
  - **(a) keep the board and the demo.** Move the two rows' times in FACTS §8 after 11:34 (for example #0556 collected 11:45, #0547 delivered 11:50), and give `deliver(...)` the same stamps in the 1200 step. TD03 and TD04 do not change.
  - **(b) keep the times.** Apply both in the 1130 step, and redraw TD02 (To pack 0, On the road 0, 5 delivered today, "then #0549").

  Either way, add the two deliveries and #0534's 10:58 to the §2a sample-gaps row (Q9) for Kevin.
- **G-T5 · the red button on the first day** (TD05). The board links it to `pack` (PK01, or the empty PK14). The app shows the toast "Nothing to do now" (`shell/App.tsx:30 startNext`). Fix: with no job, `startNext` opens `nav.push('pack')`, whose empty state says the same thing as a screen. Or, if the toast is the rule, write it in spec §4.9 and relink TD05's button (and any other board with no next job) to itself.
- **G-T14 · "you see" face** (TD14). `PassYard.tsx:94` draws Musa with `personFace(b.me)`: navy, white letters, ringed. The board draws the holder's slate face (`#E8EBF0`, `#3D4A5C` letters, 2 px navy ring), which is `yardFace` ("the holder slate, everywhere off Today's hero", `src/apps/store/README.md`). Fix: `avatarStyle({ ...yardFace(b, b.me), size: 24 })`.
- **G-T20 · the knob of a slide that cannot go** (TD24, TD27, TD28). The app now uses the shared locked slide, as asked (track, words and colour as drawn), but its knob shows the lock (TD24, TD28) and the no-signal icon (TD27). The board draws the grey knob with the slide's double chevron. This is the board's flaw: the shared part (Sales' KC07–KC18) draws the lock, and a lock says "cannot go" more plainly than the arrows. Fix: redraw the three boards' knobs with the lock and the no-signal icon, and record the rule in spec §4.8 (a slide that cannot go shows why on its knob). Do not add a chevron variant to `Slide.tsx`.
- **G-T22 · "saved 7:52"** (TD22). The board says "saved on this phone **7:52**", and it fits in the 160 px tile. `Boot.tsx:67` dropped "on this phone". Fix: `saved on this phone <span class="mono">{time}</span>`, as drawn.
- **G-T23 · the busy Sign in button turns dark red** (TD23). While signing in, `.st-si-go.busy` is `#A82D24`, the pressed red. The board keeps `#C93A30` with the spinner. Fix in `signin.css`: `.st-si-go.busy { background: var(--oxide) }` (the dim spinner already shows that it is busy).

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

## Out

Critic re-run 2026-11-12 on `bacd5c32` (origin/claude/store-build), after the builder fixed G1–G10. Boards: the 28 OU boards plus AD01, AD03 and AD04 (Someone new, "Added while building"), 31 in all. `test/parity/store-out.json` now reaches OU14 at `&at=930` and OU15 at `&at=1010` (by On the road's Ready chip), and every tap reaches its board. Each board's links were replayed by tapping the board's controls. The back strips, Close and the OU24 slide were also tapped one by one, and the landing was read from `sessionStorage['ow-store-view']`.

**30 of 31 pass. One fails: OU13 (G11, an undrawn gate state behind its Close).**

All ten round-1 failures are fixed:

| | Fix |
|---|---|
| G1 | The strips name the screen below and land on it ("Back to On the road" over the gate; "Back to the door" on Coming back). |
| G2 | The eyebrows are `#5F6980` in app and boards. |
| G3 | The grey Code pill is inactive while a hand-over is held or kept: a tap stays on the gate. |
| G4 | OU13's Close goes to the gate. |
| G5 | OU13 shows Buying and Packing skipped and the gate "ready", redrawn. Ask Ruth's disc is Ruth's teal (spec §2a ruling). OU24's now-stop shows the return arrow and 9:55. |
| G6 | OU14 and OU15 show their lists, and each row opens To load or To pack. OU14's Delivered tile is now a figure. |
| G7 | The gate is drawn under the code's scrim. |
| G8 | The cancel time is 10:38, and the put-back row is 304×45 and opens `pack/put-back`. |
| G9 | OU17 is redrawn with the "Who drives" label row; the diff went from 9.32% to 2.08%. |
| G10 | OU24's Close and slide go to On the road. |

Still accepted across the area:
- the run's now-stop "now" for 10:05 (P18);
- "saved 7:52" (FACTS §1);
- "arrived 14:05" (the demo clock is 14:05; FACTS gives 14:04–14:05);
- no Done chip (Q22);
- full progress bars (animation);
- disabled chips, "All on", "Who collects", the keypad and the Code pill while held, kept, failed or full (inactive, as drawn);
- the ghost rows (`aria-hidden`);
- AD03's focus ring;
- OU20's #0547 Delivered, which the board links to OU24 as a storyboard shortcut;
- OU30's Packed tile, which goes to To pack (`pack/order` needs an order);
- rows that sit a few px lower under 44 px hit areas. Examples: OU01 is 6–10 px lower below "Name it". OU27 is 8–14 px lower below the 45 px put-back row; the board still draws that row at 40, so redraw it to 44.

Some measurements are not counted:
- Text covered by a sheet or a scrim (Today under a stage sheet, the gate under the code sheet).
- 36 px pens: they have a 44 px `::after` hit area.
- Inputs: they sit inside 52–80 px `<label>` cards.

The money check flags only "3m", "32 m", "46 m", "50 m" and "318K". These are a length, minutes and a plate, so there is **no money on any Out board**. `scrollWidth` is 360 on all 31.

| Board | Route | Taps | Diff % | Shows | Links | 44px | 11px | Contrast | Clip | Verdict | Note |
|---|---|---|---|---|---|---|---|---|---|---|---|
| OU01 To load | `out/load` | 0 (push) | 6.72 | ok | ok | ok | ok | ok | ok | pass | |
| OU30 Nothing to load | `out/load` | 0 (push) | 9.88 | ok | ok | ok | ok | ok | ok | pass | reached as #0530 cancelled (written) |
| OU31 Name this direction | `out/load` + sheet | 1 | 6.27 | ok | ok | ok | ok | ok | ok | pass | G2 fixed |
| OU02 Load | `out/run` | 1 | 0.99 | ok | ok | ok | ok | ok | ok | pass | |
| OU03 A hired driver | `out/run` + sheet | 2 | 6.72 | ok | ok | ok | ok | ok | ok | pass | |
| AD01 Someone new | `out/run` + sheet | 3 | 0.37 | ok | ok | ok | ok | ok | ok | pass | |
| AD03 Someone new, filled | `out/run` + sheet | 6 | 0.58 | ok | ok | ok | ok | ok | ok | pass | Robert Kasozi: AD open question 1 |
| AD04 Not a mobile | `out/run` + sheet | 6 | 0.02 | ok | ok | ok | ok | ok | ok | pass | |
| OU17 Slide held | `out/run` | 2 | 2.08 | ok | ok | ok | ok | ok | ok | pass | G9 fixed (board redrawn) |
| OU04 Sending | `out/run` | 4 | 1.06 | ok | ok | ok | ok | ok | ok | pass | |
| OU05 On the road (end) | `out/run` | 2 | 0.47 | ok | ok | ok | ok | ok | ok | pass | |
| OU06 Not sent yet | `out/run` | 3 | 6.34 | ok | ok | ok | ok | ok | ok | pass | |
| OU07 Not saved | `out/run` | 3 | 6.38 | ok | ok | ok | ok | ok | ok | pass | |
| OU10 Ready to collect | `out/gate` | 2 | 4.98 | ok | ok | ok | ok | ok | ok | pass | G1 fixed: "Back to On the road" → On the road; Close → Today |
| OU08 Handing over | `out/gate` | 5 | 4.49 | ok | ok | ok | ok | ok | ok | pass | G1, G3 fixed |
| OU16 Gate offline | `out/gate` | 4 | 7.75 | ok | ok | ok | ok | ok | ok | pass | G1, G3 fixed |
| OU12 Handed over | `out/gate` | 3 | 0.58 | ok | ok | ok | ok | ok | ok | pass | |
| OU13 Not paid yet | `out/gate {id}` | 2 | 7.21 | ok | **Close → undrawn gate** | ok | ok | ok | ok | fail | G4, G5 fixed; G11 |
| OU15 Nobody to hand over | `out/gate` | 2 | 10.24 | ok | ok | ok | ok | ok | ok | pass | G1, G6 fixed (10:10; board redrawn "they collect", "To pack 2") |
| OU11 Peter's code | `out/gate-code` | 7 | 0.38 | ok | ok | ok | ok | ok | ok | pass | G2, G7 fixed |
| OU09 Wrong code | `out/gate-code` | 7 | 0.39 | ok | ok | ok | ok | ok | ok | pass | G2, G7 fixed |
| OU20 On the road | `out/road` | 1 | 7.35 | ok | ok | ok | ok | ok | ok | pass | |
| OU14 Nobody on the road | `out/road` | 1 | 11.19 | ok | ok | ok | ok | ok | ok | pass | G6 fixed (9:30; board redrawn "Next out", "To load 3"); the lower half sits 6–18 px low |
| OU25 Road offline | `out/road` | 5 | 7.02 | ok | ok | ok | ok | ok | ok | pass | |
| OU27 Cancelled on the truck | `out/road` | 1 | 9.66 | ok | ok | ok | ok | ok | ok | pass | G8 fixed; board's put-back row still 40 px (redraw) |
| OU21 At the door | `out/door` | 2 | 0.33 | ok | ok | ok | ok | ok | ok | pass | |
| OU26 Delivering | `out/door` | 5 | 0.59 | ok | ok | ok | ok | ok | ok | pass | |
| OU22 Delivered | `out/door` | 3 | 0.43 | ok | ok | ok | ok | ok | ok | pass | |
| OU23 Why no photo | `out/door` + sheet | 4 | 4.35 | ok | ok | ok | ok | ok | ok | pass | G2 fixed |
| OU28 Door not sent | `out/door` | 4 | 1.16 | ok | ok | ok | ok | ok | ok | pass | |
| OU24 Coming back | `out/cant-deliver` | 4 | 3.31 | ok | ok | ok | ok | ok | ok | pass | G5, G10 fixed: "Back to the door" → door; Close and slide → On the road |

### Out failures and fixes

- **G11 · OU13's Close lands on a gate state the canvas never drew, and it reads wrong** (the open point the builder flagged in `parity/out.md`). This is the one remaining fault.

  **What happens.** At 10:41 the walk-in #0555 is the only order at the gate, and it is Not paid yet. OU13's Close goes to `out/gate`, as the board links (OU10). The gate then shows:
  - the head "Ready to collect **1** · oldest 26 m" over the ghost and "**Nobody to hand over**". The count and the words contradict each other on one screen;
  - #0555 under "Next at the gate", with "packed 10:15 · 1 line" and a navy **Open**, but no "Not paid yet" pill. On the road's Ready row (OU20) shows that pill for the same order;
  - "Open" goes straight back to OU13.

  The link is right by nav's rule, but it is the board's Close assuming OU10's 10:47 state, where #0555 is paid. No board draws a gate where everything waiting is held by money.

  **Fix: canvas first.** Draw that state, OU10's layout with the held order as the top card (the GatePic lock, "Not paid yet" pill and the locked "Stays until paid" slide, as OU13's dock). The head's count then matches what is shown. Then build it in `Gate.tsx`: when every order at the gate is `moneyHeld`, render that card in place of the "Nobody to hand over" empty state. If the gate's Next row also stays, it needs the `NotPaid` pill, like `Road.tsx`'s Ready row.

  The smaller alternative is a lead ruling recorded in spec §2a. OU13's Close then stays on the screen below (On the road) and the board's link is changed to OU20. That avoids the undrawn state, but the gate still contradicts itself whenever someone opens it by the Ready chip at 10:41. So the gate state needs drawing either way.
