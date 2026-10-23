# Round 2: Core workflows   (brief received 23 Oct 2026, build 23 Oct 2026 09:29 UTC)

Canvas: https://claude.ai/artifact/LVsyQEintezbVH3qn4cSVi, the row "Audit round 2 · core workflows" (bottom of the canvas).
Migration: none new. DATA-01 is already in **0161**, which hasn't been run yet (see below).
Do not regress: "Count it again", return lines through the pack formatter, "The shelf has", "No aisle yet", blur commits check-in counts, over/under reasons, "record it as new", the delivery no-photo fallback, the check-in draft surviving a reload.

## Design changes (canvas)

| ID | Board(s) | Before → After | States drawn | Tokens/components used | New component? |
|---|---|---|---|---|---|
| FLOW-01 | `ReceiveCountUnit`, `PackUnits` | Before: the pill reads "20 Ctn" for 20 Dozen, "Denis bought 20" has no unit, the input has no unit, and the pack card reads "1 Ctns of 20". After: the counter has a Ctn / Dozen switch (the Report-a-loss unit switch), the input carries its unit, and "1 Ctn = 20 Dozen" shows under it. The pill reads "1 Ctn", "Denis bought 1 Ctn", the pack card "1 Ctn · 20 Dozen", the receipt "1 Ctn · 20 Dozen", and Gold screws "1 Bag · 20 Kg". | empty (count first), counted in Ctn, counted in Dozen, short (10 of 20 Dozen, amber) | check-in line, pill, `cv-pm` steppers, `cv-num`, the unit switch from `PAGE.report`, `rcBar` | No: the unit switch exists on Report a loss. |
| FLOW-02 | `PackUnpack` | Before: Undo is gone at about 5 s, and there is no way back once packed. After: Undo stays the full 10 s (shown at 7 s), then "Unpack #0576" sits under Next order. It opens a confirm sheet (bay 2 → To pack; "Your ticks stay, so you only fix the line that was wrong"). The order lands back in To pack as "yours", with "bay 2 is free". | undo at 7 s, packed (Unpack shown), confirm, sending ("Unpacking…"), offline ("No signal · nothing changed · it is still packed"), back in To pack | `sentScreen` / pack done, `undoBtn` ring, the confirm sheet (as `rtback`), bay tiles, `cv-row` list, status line | No: the confirm sheet is the `rtback` / `leave` pattern. |
| FLOW-05 | `TodayOneDraft` | Before: "Carry on checking in · 1/1" plus Next job "Check in Denis's trip" for the same trip. After: one card. The Next job reads "Carry on Denis's trip", with a "1 of 1 counted · Saved at 9:31" strip and the button "Carry on". The separate card shows only for a draft that isn't the next job. | before/after | `jobCard`, `resumeCard` ring, red primary pill | No |
| FLOW-06 | `ReceiveUnder` | Before: fewer than bought offers Never came / Torn or broken / Wrong brand. After: a 2×2 grid with "I miscounted · fix the number". Tapping it rings the number in green and focuses it ("Type the right number"), and the slide says "Fix the number first". | ask (default), never (chosen: Ruth's line and slide ready), miscount (number focused) | the reason buttons, `rcBar`, slide | No |
| FLOW-07 | `PackUnpack` (Next order "1 item"), `PackUnits` (pack card "1 Ctn · 20 Dozen") | "1 items" → "1 item"; "1 Ctns of 20" → "1 Ctn · 20 Dozen" | in the boards above | copy | No |

FLOW-03 and FLOW-04 change no layout: the label already reads the full name on the canvas (`Load`, `Handover`), and focus is behaviour. So no board.

## Code changes planned

| ID | Sev | File / function | Change (one line) | UI? | Acceptance check |
|---|---|---|---|---|---|
| FLOW-01 | P1 | `store.html`: new `lineLevels(l)` (pack unit and base unit, from the trip line's `packQty`/`packUnit`), `PAGE.receive` `line()` (unit switch, the input in the chosen unit, the pill and "bought" through `backText`), `in:rccount` / `rcstep` (typed × the unit's size → `ui.got` stays in the line's base unit), `rcBar` (in the chosen unit), `rcDone` / receipt lines through `backText` | Count in the unit you can see; the books keep the base unit. | yes | TRIP-MVKRPDZ6 Drawer Locks: check-in, pack and the receipt read 1 Ctn (= 20 Dozen). Typing 1 in Ctn records 20 Dozen, no shortage. Gold Screws reads its pack, not "1 Kg". |
| FLOW-01 | P1 | `store.html`: the `PAGE.pack` card sub | "From today's trip · 1 Ctn · 20 Dozen" (`backText` · the base qty). | yes | Matches `PackUnits`. |
| FLOW-02 | P2 | `store.html`: `heldWrite` | The default window goes from 4000 to 10000 ms, so every held write waits the full 10 s or until the next screen change (`flushHeld`). | no | Undo works at 7 s on Packed, Report, Return, Load, Hand over, Deliver. |
| FLOW-02 | P2 | `store.html`: the pack-done Undo | Reproduce the "gone at ~5 s" on Packed: it already asks for 10 s, so something sends it early. Suspects: a second `heldWrite` replacing `S.ui.held`, `visibilitychange`, or a navigation flush. Fix the cause and add a harness test that taps Undo at 7 s. | no | Undo at 7 s puts the last line back. |
| FLOW-02 | P2 | `store.html`: new `unpackOrder(id)` (through `changeOrder`: `pickingStatus` 'in_progress', `pickingDoneAt` and `bay` cleared; refused once loaded or out), `SHEET.unpack`, `ACT.unpack`, the "Unpack #…" link on pack done and on the bay's slip | Reopen a packed order while it is still in the yard. Ticks are kept. | yes | Unpack returns #0576 to To pack and frees bay 2. A loaded order offers no Unpack. |
| FLOW-03 | P2 | `store.html`: `ACT['in:slwho']`, the slide label, the "Checked together with" line (`data-live="slwho"` on both) | Patch both text nodes on every input, with no `render()`, so focus and caret stay. | yes (behaviour) | Typing "Peter Okello" shows it in full in the slide and the line, with focus kept. |
| FLOW-04 | P3 | `store.html`: `ACT.rcedit` (focus `#rc_in_<i>`), the "Extra on the truck" sheet (focus its search box), as `ACT.report` does | Focus lands in the field that just opened. | yes (behaviour) | Open, then type at once: the text lands in the field. |
| FLOW-05 | P3 | `store.html`: `resumeCard` (skip the draft that is the next job), the `jobCard` 'round' branch (a draft turns it into "Carry on … · n of m counted") | One entry per trip draft. | yes | One card per trip draft. |
| FLOW-06 | P3 | `store.html`: `WHY` gains `miscount` (as `WHY_OVER`); `ACT.rcwhy` on miscount focuses `#rc_in_<i>`; `whyOk` never accepts miscount (as over) | "I miscounted" both ways. | yes | Both directions offer it, and the number takes focus. |
| FLOW-07 | P3 | `store.html`: new `nOf(n, word)` (through `plural()`), used for "1 items", the pack sub and the other counted words found by a sweep | Singular and plural from one helper. | yes (copy) | A test greps for "1 items" and "Ctns of" patterns. |
| DATA-01 | P1 | none: already in `0161` | 0161 supersedes the older of every pair of waiting counts of one place, then adds the one-open index. The live database hasn't had 0161 run yet, which is why both rows are still "sent". | no | After 0161: `select count(*) from stock_counts where status = 'sent' and place = 'aisle:aluminum'` gives 1. |

## Not changing / pushed back

| ID | Why |
|---|---|
| DATA-01 | No new code: the one-off is in 0161, step 1, written for exactly these two rows (21 Oct → superseded, replaced by 23 Oct). It needs 0161 run. Until then the app's "Count it again" falls back to a plain new count, which is why the old rows stay "sent". |
| Round 1 DATA-05 / DATA-06 | Already approved on 23 Oct ("approved, replace on send, anyone can replace, go ahead"). The lists in `ROUND-1.md` are unchanged: 59 moves, 13 product renames, 4 variant renames, and 13 left in Furniture for now. They are in 0161 and run with it. |

## Risks

- **A longer Undo delays the write.** Load, Hand over and Deliver reach the server up to 10 s later than now. Leaving the screen or locking the phone still sends it at once (`flushHeld`, `visibilitychange`), so nothing waits on a pocketed phone.
- **Unpack after someone started loading.** Unpack is refused once the order has a carrier (loaded) or is out the gate. A load slip open on another phone at the same moment fails its own write with "it moved on".
- **The FLOW-01 unit switch remembers per line.** A draft saved before this build has counts in the base unit. They stay right, because the count is stored in the base unit whatever unit was typed.
- **0161 still not run.** Until it is, DATA-01 and the Round 1 data stay as they are on the live site.

## Questions for Kevin

1. **Unpack keeps the ticks** so the packer only fixes the wrong line (drawn). Or should it clear them all? (Keeping is recommended.)
2. **Unpack: who?** The plan lets anyone in the yard unpack, with the confirm sheet, while the order is still in the yard. OK?

## Phase B result (filled after implementing)

Go-ahead 23 Oct: keep the ticks, anyone can unpack.

| ID | Done? | What changed (function names) | How verified |
|---|---|---|---|
| FLOW-01 | yes | `lineLevels`, `rcLv`, `lvNum`, `btPair`, `rcF`, `ACT.rclv`; `PAGE.receive` `line()` (unit switch, the number box carries its unit, the "You counted 1 Ctn = 20 Dozen" line, the pill and "bought" through `backText`, the bar and reasons in the chosen unit); `ACT['in:rccount']` and `ACT.rcstep` keep the line's own unit; `rcToText`, `rcDone` and scan-to-tick (`SCAN_MODES.receive`, which had the same fault) read through `backText`; the pack card sub reads "1 Ctn · 20 Dozen". | Harness with a 20 Dozen / Ctn 20 line: typing 1 in Ctn turns the line green (20 Dozen, no shortage), and the pill reads "1 Ctn". `test/store-round2.test.js`. |
| FLOW-02 | yes | `heldWrite` waits at least 10 s. `canUnpack`, `unpackOrder`, `unpackLink` (pack done once Undo is over, and the order slip), `SHEET.unpack`, `ACT.unpack`, `ACT.unpackyes`, the To pack banner. | Harness: Undo still there at 7 s on Packed. After 10 s, Unpack opens the sheet. Confirming puts #0048 back to `in_progress` with bay and packed time cleared and ticks kept, lands on To pack with "is back in To pack · bay 2 is free". The early Undo didn't reproduce on Packed (it already asked 10 s). The other held writes, still on 4 s, were the likely cause. |
| FLOW-03 | yes | `ACT['in:slwho']` patches the slide label, its knob's label and `[data-live="slfoot"]` on every key; it renders only when the slide becomes ready, then puts focus back at the end. | Harness: typing "Peter Okello" keeps focus in the box. The slide reads "Slide to hand over to Peter" (first names, as everywhere), and the line reads "Checked together with Peter Okello". |
| FLOW-04 | yes | `focusSoon`; `ACT.rcedit` focuses the count box, `ACT.rcextra` the search box. | Harness: the active element after opening is `rc_in_<i>`. |
| FLOW-05 | yes | `resumeCard(j)` is skipped when the draft is the next job; the `jobCard` round branch becomes "Carry on …'s trip · n of m counted · Carry on". | Harness: Today shows one card. |
| FLOW-06 | yes | `WHY.miscount`; `whyOk` never keeps it; `ACT.rcwhy` sets `ui.fixing` and focuses the box; the green ring, "Type the right number" and "Fix the number first" on the slide. | Harness: 2×2 reasons, and the number takes focus. |
| FLOW-07 | yes | `nOf(n, word)`; "Next order · … · 1 item", "Picks for … of 1 item", "of 1 line/stop", "All 1 line checked", the count line, the pack card. | The test greps for "N items" and "of N lines/stops/items". |
| DATA-01 | no code | Already in 0161. It needs 0161 run on the live database. | `test/store-round1.test.js` (the Aisle A pair resolves to one). |
