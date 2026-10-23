# Round 1: Data integrity   (brief received 23 Oct 2026, build 23 Oct 2026 08:23 UTC)

Canvas: https://claude.ai/artifact/LVsyQEintezbVH3qn4cSVi, the row "Audit round 1 · data integrity" (bottom of the canvas).
Migration: **0161** (the next free number after 0160).
Do not regress: books vs shelf split, exact-match search ranking, the Take back confirm sheet (`rtback`), the loss unit cap.

## Design changes (canvas)

| ID | Board(s) | Before → After | States drawn | Tokens/components used | New component? |
|---|---|---|---|---|---|
| DATA-01 | `CountWaiting`, `CountOneRow` | Before: tapping Count on an aisle that is with Ruth shows a toast, or a second count goes out. With Ruth lists two rows for Aisle C. After: a sheet says "Aisle C is with Ruth" (who counted it, when, and a 3-step track). One primary button, "Count it again", and a secondary "See Joy's count". While counting, the dock carries the chip "Replaces Joy's Thu 9:45 count". The done screen shows old → new. With Ruth shows one row per aisle ("replaces Joy's Thu count"). | sheet (default), pressed, counting, sending, sent, sent but the old one was accepted first, offline. Error is the existing "It didn't reach Ruth" screen (`StockFailed`). | navy hero, bottom sheet, red primary pill, white secondary pill, the 3-step track from `CountStatus`, the count dock from `CountAisle`, `sentScreen` / `trackDone`, amber clock badge | No. The sheet uses the existing confirm-sheet pattern (`rtback`, `leave`). |
| DATA-02 | `ReturnUnits` | Before: "20 Ctn" on Returns and With Ruth, "1 Ctn" on the return form. After: "1 Ctn" on all three, through the same pack formatter. | One static state per place. This is a label change only. | list row, `.pv` qty pill (mono), chips | No |
| DATA-03 | `ReportEmptyShelf` (empty, pressed, picker) | Before: an item at 0 on the shelf can still be reported (1 at least). After: the search list tags it "0 · count first". Once picked, the How-many card becomes a dashed 0 ring ("Nothing on the shelf to lose · Count it first · then report what is missing") with the track count → report → Ruth. The one button is "Count it now". | empty (default), pressed, picker. Sending, success, offline and error are unchanged (`StockSent`, `StockFailed`). | navy hero with the item card, white card, dashed ring (the count-due look), red primary pill, track | No |
| DATA-04 | `ReportEmptyShelf` (capped), `CountStatus` (decide) | Before: "The books hold 3 kg · that is the most", "1 fewer than the books", "Counted against the books". After: "The shelf has 3 kg · that is the most", "1 fewer than the shelf", "Counted against the shelf". | capped; decide | the existing amber status line; `CountStatus` copy | No |
| DATA-05 | `CatalogueTidy` (left half: tiles and rows) | Before: hinges, handles and locks sit in "F · Furniture", and 3 items in "Q · Other". After: each item sits in its own aisle (K Hinges, J Handles, L Locks, O Runners). A product with no category shows a dashed "– No aisle yet" tile and chip, never a real letter. | before/after; the empty "No aisle yet" tile (0) | the aisle tiles from `Stock`, row chips, dashed outline (the empty look) | No |
| DATA-06 | `CatalogueTidy` (row 4) | Before: "Mulper hinges - Soft — Flat". After: "Mulper hinges Soft" with the size tag "Flat". One dash, the variant separator, and only between name and variant. | before/after | `.pv` tag | No |

## Code changes planned

| ID | Sev | File / function | Change (one line) | UI? | Acceptance check |
|---|---|---|---|---|---|
| DATA-01 | P1 | `0161`: `stock_counts` | Add status `superseded` and the columns `place`, `replaces`, `superseded_at`. A trigger fills `place` (`aisle:<category>` or `item:<key>`), keyed by the category name, not the letter. Backfill `place`, supersede the older of any two waiting counts of the same place, then add a partial unique index, one `sent` per (shop, place). | no | A second insert of a `sent` count for the same place fails with 23505. The existing Aisle A pair: the 21 Oct count reads `superseded`, and only the 23 Oct one is waiting. |
| DATA-01 | P1 | `0161`: `store_count_replace(p_old, p_aisle, p_lines, p_missing)` | One transaction: if the old count is still `sent`, mark it superseded and insert the new one (`replaces` = old). If the old one was decided meanwhile, insert the new one as a plain count. Returns the row and `replaced: true/false`. | no | Test: replace → old `superseded`, new `sent`. Replace after accept → `replaced:false`, new `sent`. |
| DATA-01 | P1 | `0161`: `accept_stock_count`, `ask_recount` | Refuse a superseded count: "A newer count replaced this one." | no | Test: accepting the superseded row raises. Accepting the new row writes the stock. |
| DATA-01 | P1 | `store.html`: `ACT.count`, new `SHEET.ctwait`, `ACT.ctagain` | A waiting count of the same aisle, or of the same item for a spot count, opens the sheet, not a toast. "Count it again" starts a count with `ct.replaces`. | yes | Board `CountWaiting`. The second tap on Count opens the sheet. Nothing is sent until Send. |
| DATA-01 | P1 | `store.html`: `PAGE.count` dock, `sendCountOnce`, `sendCount`, `PAGE.countresults` | The dock chip shows "Replaces …". Sending goes through `store_count_replace`. A 23505 on a plain send (someone else's count landed first) reopens the sheet, and the count stays on the phone. The done line says replaced, or "accepted first". | yes | The states on `CountWaiting`. The offline path keeps the replace and sends it later. |
| DATA-01 | P1 | `store.html`: `ruthAsks` | Superseded counts never show, waiting or answered. A count that replaced one says so in its sub line. | yes | Board `CountOneRow`: one row for Aisle C. |
| DATA-02 | P2 | `store.html`: `returnLineWords` | When the order line exists, always render `backText(it, l.qty)`. Ignore the stored `shown` and `unit`, so old rows read right too. | yes (label) | #0494 reads "1 Ctn" on Returns, With Ruth and the form. |
| DATA-02 | P2 | `0161`: `store_return_ask` | The line's `unit` always comes from the order line (`it->>'unit'`), never from the phone. | no | Test: a pack-unit line saves base qty plus the base unit (20, Box). |
| DATA-02 | P2 | `0161`: one-off | For every credit ask whose line `unit` differs from its order line's unit, set `unit` to the order line's and drop `shown`. The qty was always in the line unit: the price is qty × line price. | no | #0494's ask reads `{qty: 20, unit: "Box"}`. |
| DATA-03 | P2 | `0161`: `write_off_stock` | Refuse a write-off bigger than the shelf (books less what has left for orders not invoiced, `ow_held_gone`): "The shelf has only X · count it first." Write one `stock_log` row per report, `type 'writeoff'`, with the report id in the note. | no | Test: a write-off on a 0 shelf raises. A write-off of 2 off 5 writes one row (delta −2, `qty_after` 3, "report <id>"). The `qty_after` chain holds. |
| DATA-03 | P2 | `store.html`: `PAGE.report`, `rpMax`, `ACT.rpsend`, the picker | A shelf of 0 shows the empty card and "Count it now" (opens `ACT.count` for that item). Send is not offered. The picker tags 0-shelf items "0 · count first". | yes | Board `ReportEmptyShelf`. Reporting on a 0-shelf item shows the count-first state. |
| DATA-03 | P2 | `manager.html`: the write-off error | Show the server's "count it first" message as it is. | yes (Manager) | The Manager sees the reason, not a generic failure. |
| DATA-04 | P3 | `store.html`: the report cap, `PAGE.decide`, comments | "The books hold" → "The shelf has". "More than the books hold" → "More than the shelf has". "fewer than / differ from the books", "All match the books", "Counted against the books", "· books 3 ctn" → "the shelf". "Books" stays only where the number is `x.books`, or the figure is not shown at all ("The books stay off this phone"). | yes (copy) | `grep` shows no "books" next to a shelf figure. |
| DATA-05 | P2 | `0161`: one-off product moves | Move each product to the aisle in the approved table below. Run only after the table is approved. | no | Every hinge, handle, lock and runner sits in its own aisle. 0 products have no category. |
| DATA-05 | P2 | `store.html`: `aisleListNow`, `aisleOf`, `stockItems` | A product with no category gets `{ name: 'No aisle yet', letter: '–', none: true }`, outside the letter sequence. Rows and picks say "No aisle yet". It is never counted as an aisle. | yes | Board `CatalogueTidy`. With one uncategorised product, its row reads "No aisle yet". |
| DATA-06 | P3 | `0161`: one-off renames | Rename the approved names (" - " → " ", a space before "("). The variant separator " — " is untouched. | no | No product shows both separators. |

### DATA-05 / DATA-06: the exact moves (waiting for the live list)

This session can't read the live products, so the mapping isn't invented here. `docs/audit/round-1-preview.sql` is **read-only**: it lists every product in Furniture or with no category, with the aisle the name rules propose, plus every name with " - " or a bracket without a space and the proposed new name. Paste its results back and they go here as the table you approve.

The name rules it uses:

| A name containing | goes to |
|---|---|
| hinge | Hinges |
| handle, knob, pull | Handles |
| padlock, lock, latch, cylinder | Locks |
| runner, drawer slide | Runners |
| anything else (wall plugs, tapes, Sanding Sealer, Brackets, Masasi 15pairs) | **you name the aisle** |

"Plumbing" has no products, so it shows no tile. It needs no change.

## Not changing / pushed back

| ID | Why |
|---|---|
| DATA-03 | No `stock_log` row will be back-filled for the 19 Oct write-off. The shelf was already 0, so nothing moved and the `qty_after` chain is consistent as it stands. A made-up "−1" would break it, and a zero row added now would sit out of order in the chain. The decision is already in the Manager's log ("Wrote off nothing (the shelf was already empty)"). From now on a write-off past the shelf is refused, so this can't recur. |
| DATA-02 | This is the label only: the amount (20 × 11,500) and the qty were right. **Correction to the log:** Ken Bwaise's #0494 return is 20 Box, the whole 1 Ctn bought, not 20 Ctn. It should not be declined for its size. |

## Risks

- **Aisle letters move with the categories.** Letters come from the sorted category names. If a move empties Furniture, or a product lands in an empty category ("Plumbing"), every aisle after it changes letter, and so do the printed shelf labels. The approved table must keep every existing category non-empty, or say which letters move. Keying the one-count rule on the category name, not "Aisle A", means a letter change can't break it. Stable stored letters could be a later round.
- **The unique index needs the duplicate cleared first.** 0161 supersedes older duplicates before it creates the index. If a third waiting count lands between those steps, the index creation fails and the migration rolls back whole. It is safe to run again.
- **Older phones** still on the last build insert counts directly. After 0161 their second count is refused with 23505 and shows the generic "It didn't reach Ruth" with Retry, until they update (about 30 minutes).
- **The Manager app** must hide `superseded` counts. If it shows every status, the old count reappears there as "superseded". Checked in Phase B.
- **`write_off_stock` now refuses** where it used to quietly write off nothing. A Manager writing off old reports on empty shelves will see "count it first". That is intended.

## Questions for Kevin

1. **DATA-05/06:** run `docs/audit/round-1-preview.sql` and paste the results, or approve the rule table above and name the aisle for wall plugs, tapes, Sanding Sealer, Brackets and Masasi 15pairs.
2. **DATA-01:** a count done again replaces the waiting one *when it is sent*, not when it is started, so walking away leaves Ruth with the old count. OK? (Recommended.)
3. **DATA-01:** may anyone in the yard replace a colleague's waiting count (Musa replacing Joy's), or only the person who counted it? The plan says anyone with `stock.count`, and the sheet names whose count it replaces.

## Phase B result (filled after implementing)

| ID | Done? | What changed (function names) | How verified |
|---|---|---|---|
| DATA-01 | | | |
| DATA-02 | | | |
| DATA-03 | | | |
| DATA-04 | | | |
| DATA-05 | | | |
| DATA-06 | | | |
