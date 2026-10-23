# Round 3: Reliability   (brief received 23 Oct 2026, build 23 Oct 2026 13:00 UTC)

Canvas: https://claude.ai/artifact/LVsyQEintezbVH3qn4cSVi, the row "Audit round 3 · reliability" (bottom of the canvas), plus `PackUnpack` updated.
Migration: **0162** (REL-08). 0161 is still to run (DATA-01, DATA-05/06).
Do not regress: 10 s undo, Unpack, the live hand-over label, the report/return outbox and `flushOutbox` retry, no double submit, the offline card, the hand-over name across reload, "I miscounted" both ways, plurals.

## Design changes (canvas)

| ID | Board(s) | Before → After | States drawn | Tokens/components used | New component? |
|---|---|---|---|---|---|
| REL-04 | `TodayWaiting` | Before: a queued report is invisible, offline says "Nothing is waiting to send", and online with failing writes still says "Live". After: one "Waiting to send" card, with a count badge, every item not yet on the books (reports, returns, picks, check-ins) with its time, and "Send now". The header pill reads "Not sent · 3" (amber) or "Offline · 3 waiting" instead of "Live". | failing (online, writes fail), offline, sending (spinners, "Sending…"), empty (card gone, "Live") | the offline card's look (cream ring, amber rows), the header pill (`cv-live`), the count badge (`cv-cnt`), navy secondary button | No: the offline card made general. |
| REL-05 | `SendStates` | Before: a green tick and "Sent · just now" under "Sending…". After: three looks. **Sending**: neutral spinner and "Sending", step 1 pending, Ruth faded, Undo. **Kept on this phone**: amber wifi-off, step 1 "Not sent yet · kept 9:41", "Today lists it under Waiting to send". **Sent**: green tick, only after the server's yes. The same for the return and delivery done screens. | sending, kept, sent | `sentScreen`, `trackDone`, `bigTick`, `cv-spin` | No |
| REL-06 | `PackUnpack` (updated) | Before: "Unpack #0576" sat at the bottom, where the pack screen's main button was. After: a small chip under "leave it on bay 2", at the top. Taps for 400 ms after any screen change are ignored (no visual change). | as Round 2, Unpack moved | chip on navy | No |
| REL-07 / REL-02 / REL-09 | `NotDone` | Before: a 5 s toast, and the hand-over form comes back empty. After: a bar under the header stays until it is done. **Not done · no signal** ("The name and the ticks are kept", Try again). **That did not save** ("Tell Kevin · code 0162/40001 · your work is kept", Try again). **Trying again…**. The ticks and "Peter Okello" stay filled in. | offline, error, retrying, none | status bar (as the report cap's amber line, card-sized), navy pill button | **Yes, the "Not done" bar**: one bar every write screen uses when a write fails. Reason: a toast vanishes and takes the reason with it. |
| REL-08 | `NotDone` (stale) | "Someone else just did this · Refreshed · Joy handed it over at 9:41" (blue, no retry). | stale | the same bar, blue = information | (the same component) |

## Code changes planned

| ID | Sev | File / function | Change (one line) | UI? | Acceptance check |
|---|---|---|---|---|---|
| REL-04 | P2 | `store.html`: `outbox()` → `waitingList()` (outbox rows from IndexedDB, kept in `S.ui.outboxRows` and refreshed by `outboxAdd`/`flushOutbox`, plus picks, check-ins and a count kept on the phone); `waitCard()` replaces `offlineCard()`; the header pill; `ACT.sendnow` (`flushOutbox`, `flushPicks`, the count retry) | One list of everything not yet on the books, shown whenever it isn't empty, online or not. | yes | Queue a report with writes failing: Today shows it within 1 s, and it goes when `flushOutbox` succeeds. |
| REL-05 | P2 | `store.html`: `sentScreen(o)` takes `o.state` 'sending' / 'kept' / 'sent'; `trackDone` step 1 follows it; `PAGE.report`, `rtDone`, `dvDone` pass it | No green until the server's yes. | yes | No tick or "Sent" before the server confirms, on report, return and delivery. |
| REL-06 | P2 | `store.html`: `render()` stamps `S.screenAt` when the top screen changes; the click handler ignores taps within 400 ms of it (Back included); `pkDone` Unpack chip at the top | Rapid taps can't fall through to the next screen. | yes | A rapid triple tap on any send ends on the success screen, then Today, and nothing else opens. |
| REL-07 | P2 | `store.html`: `ACT['slide:slgo']` (clear `slSave` only after the server's yes), `notDoneBar(where)` on slip, deliver, pack and unpack; `S.ui.notDone = { where, why, retry }`; `ACT.ndretry` runs the same write again | A failed write keeps every input and stays on screen until done. | yes | An offline hand-over keeps the name and ticks; Try again with signal completes it once. |
| REL-08 | P2 | `0162`: `store_patch_order(…, p_expect jsonb)` locks the row and refuses (`40001`, "Someone else just changed this order") when status, `pickingStatus`, `pickingDoneAt` or `carrier.at` differ from what the phone showed. `store.html`: `changeOrder(id, fn, seen)` sends what the screen showed (the local copy at the tap), also compares it before the write, and on a mismatch reloads that order and shows the blue bar. Falls back without `p_expect` until 0162 runs. | Last write never silently wins. | yes | Two tabs on one packed order: A hands over, then B taps Unpack and is refused with "Someone else just did this — refreshed". |
| REL-09 | P3 | `store.html`: `failSay` / `failWord` | Plain words: "That did not save · tell Kevin · code 0115/42883". A server sentence of our own ("The shelf has only 0 …", "More than that line can take back …") still shows as it is. The raw message goes to `console.warn`, never on screen. | yes (copy) | No SQL, function or migration words on screen (test greps the strings). |
| REL-02 | P3 | `store.html`: `slSave(id, { name, ticks })` / `slSaved` (reads the old plain-name form too) | Ticks survive a reload with the name. | no | Tick, type the name, reload: both are back. |
| DATA-01 (carried) | P1 | none: in 0161 | It runs with 0161. | no | One "sent" row for Aisle A after 0161. |

## Not changing / pushed back

| ID | Why |
|---|---|
| REL-07 (outbox for order writes) | Hand over, deliver, pack and unpack won't go into the outbox to replay later. A hand-over replayed an hour later can fight what happened at the gate since. Instead the work stays on screen with Try again. With REL-08, a retry that someone else overtook is refused, never applied twice. Counts already keep themselves and send on their own. |
| DATA-01, DATA-05/06 (carried) | Approved on 23 Oct and in 0161. The lists in `ROUND-1.md` haven't changed. Running 0161 resolves Aisle A and applies the moves and renames. |

## Risks

- **0162 changes a function every Store write uses.** It keeps the old signature's behaviour when `p_expect` is null, and the app retries without `p_expect` until 0162 is in, so the order of deploy doesn't matter.
- **Stale is now loud.** A phone that hasn't refreshed for a while and acts on an order someone else changed is refused and refreshed, where it used to overwrite. That is the point, but expect a few "Someone else just did this" bars in the first days.
- **The 400 ms tap guard** could swallow a genuinely quick second tap. 400 ms is below a deliberate tap, above a bounce.
- **"Tell Kevin"** uses the owner's display name from staff, else "the owner".

## Phase B result (filled after implementing)

Go-ahead 23 Oct.

| ID | Done? | What changed (function names) | How verified |
|---|---|---|---|
| REL-04 | yes | `outboxRefresh` (`S.ui.outboxRows`, after every `outboxAdd` and `flushOutbox`, and on first load), `waitingList`, `waitCard` (replaces the offline card when anything waits), the header pill "Not sent · N" / "Offline · N waiting" (`.cv-live.wait`), `ACT.sendnow`. | Harness: queue a report → Today shows "Not sent · 1" and the card with "Report · Wire nails 4" · 1 ctn damaged · 9:45" at once. `test/store-round3.test.js`. |
| REL-05 | yes | `stateDot`, `trackStep1`; `sentScreen` and `trackDone` take `state`. Report, the restock ask, the return, the count and the delivery pass sending / kept / sent; delivery reads "Delivering…" with a spinner until the yes. | Harness: the report after a triple tap shows "Sending…" (spinner, no tick). |
| REL-06 | yes | `render()` stamps `S.screenAt` when the view, the page on top, or a done screen (`data-done-screen` on every done screen) changes; the click handler ignores taps within 400 ms (sheets excepted); `unpackLink(q, 'chip')` at the top of Packed. | Harness: three taps 120 ms apart on "Send to Ruth" end on the report's Sending screen, and nothing else opens. |
| REL-07 | yes | `setNotDone`, `notDoneBar`, `movedWords`, `ACT.ndretry`; hand over (`slide:slgo`, which also drops the box's focus first), deliver (`slide:dvgo`) and pack (`pkFinish`, `ACT.pkfinish`) keep their work and show the bar; the name is cleared only after the server's yes. | Harness with writes failing: the slip shows "Not done · no signal · The name and the ticks are kept · Try again", with "Peter Okello" and 4 ticks still there. |
| REL-08 | yes | `0162` `store_patch_order(…, p_expect)`. `store.html`: `seenOf`, `seenDiffers`, `staleErr`, `isStale`, `keepOrder`, `refreshOrder`; `changeOrder(id, fn, seen)` and `changeOrderSnap` check first, send `p_expect`, and fall back without it before 0162. | Postgres: tab A hands over, tab B (still showing packed) is refused `40001 Someone else just changed this order.`, the row keeps A's hand-over, and a write without `p_expect` still goes. Harness: the blue "Someone else just did this · Refreshed · packed at 8:30". |
| REL-09 | yes | `failWord` (plain sentence of our own shown as it is; anything else "That did not save · tell Kevin · code …", raw message to `console.warn`), `failSay` (no "migration" words), `ownerWord`. | The test greps that "This needs migration" and the raw "Nothing was changed: " are gone. |
| REL-02 | yes | `slSave(id, ui)` keeps `{ name, ticks }`; `slSaved` reads it (and the old plain name); `slUI` restores both; `ACT.sltick` saves. | Harness: tick 4, type the name, writes fail, reload: the name and 4 ticks are back. |
| DATA-01 | no code | In 0161, still to run. | `test/store-round1.test.js`. |
