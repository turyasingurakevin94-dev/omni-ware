# Store app audit log

One entry per round, newest last. Each round's checklist is in `docs/audit/store/ROUND-<N>.md`. The skill is `.claude/skills/omni-ware-round/SKILL.md`.

Canvas: https://claude.ai/artifact/LVsyQEintezbVH3qn4cSVi

## Before the loop (browser-test reports 1–4, Oct 2026)

These four test reports ran before the rounds were numbered by aspect. Round 1 of the loop starts after them.

| Report | Commit on main | What it fixed |
|---|---|---|
| 1 | `ca57111`, `f712d94`, `890d58e`, `d5e5220`, `27111b5` | Money off the yard's phones (0159). Snapshot cache in IndexedDB. Over/short reasons at check-in. New items at check-in. Return reasons. Partial counts. Wording. Screen-reader labels. |
| 2 (360px) | `01226bc` | Nothing cut off at 360px: name, size and colour on their own lines. No ghost of Today. One Back. |
| 3 | `5b4f567` | A loss report never multiplies on a unit switch. Damaged goods never go back to the shelf. One page per tap. Return Back goes to the right list. |
| 4 | `2195d87` | Allow-list for the yard's data (0160). Search puts the best match first. Delivered goods leave the shelf. Take back asks first. Outbox for reports and returns. Drafts kept for hand over. Driver phone check. |

### Design decisions already part of the language

- **No false success.** A send shows "Sending…", then "Report sent" or "Kept on this phone". On no signal, reports and returns go to the outbox (IndexedDB `ow-store` → `outbox`) and send themselves later.
- **No money on the phone.** The server filters by role: `ow_store_payload` is an allow-list, and `ow_strip_money` removes money by key.
- **"On the shelf"** is the books minus what has left for orders not invoiced yet. The item page lists those orders under "Left the shelf · not invoiced yet".
- **Destructive actions** (Take back) get a confirm sheet. The row then stays in place, marked "Taken back".
- **Forms that hold work** ask before leaving (`leaveGuard`). Hand over drafts survive a reload.
- **Search ranks** name, then alias, then a typo. A number only matches as written ("420" never matches 425).
- **Names.** Base name, size and colour sit on separate lines (`.pv` tags), never cut with "…". People's initials come from their full name.

## Open issues carried into round 1

- **Migration 0160 not yet run.** Run it on the database, then check the snapshot with a yard staff login, not the Owner login.
- **Data clean-up.**
  - Rename the "turyasingurakevin94" staff record.
  - ~~Warren to decline the duplicate "Aisle A · Aluminum" count.~~ 0161 supersedes the older one itself (round 1, DATA-01).
  - ~~Warren to decline Ken Bwaise's 20 Ctn return on #0494.~~ Corrected in round 1: it is 20 Box, the whole 1 Ctn, with the wrong unit label (DATA-02). Do not decline it for its size.
- **Sourcing data.** 76 of 145 products sit in "Furniture". "Aluminum" and "Aluminium" are both used.
- **Not yet tested by Cowork.** Check-in, and the pack lock.

## Round 1 · Data integrity (23 Oct 2026) · DATA-01..06 · migration 0161

Fixed: one waiting count per place (a count done again replaces it on send); a return reads in its order line's unit; no loss off an empty shelf; a write-off is never past the shelf and is logged per report; "shelf", not "books", next to a shelf figure; 59 products out of the Furniture catch-all; 17 names with one dash.

Now part of the language:
- **One open thing per place.** A second start of the same job opens a sheet saying who has the first one, and offers "Count it again". The new one replaces the old only when it is sent, and the done screen shows old → new.
- **A unit is the order line's.** Any quantity from an order line reads through `backText`, never through a unit stored beside it.
- **Count before loss.** An empty shelf offers "Count it now", not a report form. A count-due item never shows its figure, not even 0.
- **"Shelf" vs "books".** The shelf is books less what has left for orders not yet invoiced. "Books" only where the real books are meant.
- **Aisles by name.** A product with no category reads "No aisle yet" and takes no letter. Keys (counts) use the category name, never the letter.
- **No new category without saying which letters move.**

Deferred:
- Stable stored aisle letters (letters still follow the sorted names).
- The 13 products left in Furniture: adhesives and sealants have no aisle, and 8 names are unclear (Elephant Jin Li, ELEPHANT King, Wrapping Film, chains, Axel Brade, Patra, Sail, Parker Engine).
- `manager-decisions-db`'s old 0159 failure.

## Round 2 · Core workflows (23 Oct 2026) · FLOW-01..07 · DATA-01 (no code: 0161)

Fixed: check-in counts in Ctn or Dozen and keeps the base unit; every held write waits 10 s; a packed order can be unpacked while still in the yard (ticks kept, bay freed); the hand-over name follows the typing; the counter and the extras sheet take the cursor; one Today card per trip draft; "I miscounted" both ways; singular and plural from one helper.

Now part of the language:
- **Count in the unit you can see.** Wherever a line comes in packs, the counter offers the pack and the loose unit. The books keep the line's own unit, and every figure reads back through `backText`.
- **Undo is 10 s everywhere,** or until the screen changes.
- **Undo, then a way back.** After the Undo window, a reversible step offers its own undo action ("Unpack #…") behind a confirm sheet.
- **A field that opens takes the cursor.**
- **One card per job.** A draft carries on inside its Next job card, not beside it.
- **Counted words** go through `nOf()`: never "1 items".

Deferred:
- Unpack from a delivery bay goes through the order slip, opened from order search, not from the bay tile (the bay opens the load run).
- 0161 still to run.

## Round 3 · Reliability (23 Oct 2026) · REL-02, REL-04..09 · migration 0162

Fixed: one "Waiting to send" list on Today with "Not sent · N" in the header; sending / kept / sent on every done screen; a 400 ms tap guard after each screen change, and Unpack up top; failed writes keep their work with a "Not done" bar and Try again; two phones on one order can't both win (0162); plain error words; the hand-over ticks kept with the name.

Now part of the language:
- **Three looks for a send:** a neutral spinner while it goes, amber "Not sent yet" when kept on the phone, and green only after the server's yes.
- **The "Not done" bar** (new component): amber for no signal, red for a save that failed ("tell Kevin · code"), blue for "Someone else just did this · Refreshed". It stays until the work is done, and the work stays with it.
- **Waiting to send** is the one place the phone admits what is not on the books yet.
- **A write says what the phone saw.** If the order moved, nothing is written, the order is refreshed, and the screen says so.
- **No SQL, function or migration words on screen,** ever.
- **A destructive button never sits where the last screen's main button was.**

Deferred:
- Order writes (hand over, deliver, pack, unpack) are not queued in the outbox. They wait on screen with Try again, by design.
- A kept report or return the server refuses for a reason other than signal is still dropped with a toast (it was before). Worth a look in a later round.
- 0161 and 0162 to run.

## Round 4 · Search and navigation (23 Oct 2026) · NAV-02..08, REL-05 · migration 0163

Fixed: a size like 1 1/4" stays one tag; phone and browser Back walk the app's own screens and ask "Leave Omni-ware?" on Today; a quote, an order waiting on goods and someone else's order open a look-only order view, never Pack; the red pack button only packs the full line ("Pack short · n of m" is amber, and a line not in yet "Waits for the goods"); "Handing over…" and "Packing #…" until the server says yes; every order row in Find opens something; "hindge", "4x20" and "silcone" find the right items, with "Did you mean" when nothing does; Find lists every match and shows chips only with a query; a long aisle keeps Back in a sticky bar with a "back to the top" button.

Now part of the language:
- **Back is the app's Back.** The phone's Back, the browser's Back, Escape and the on-screen Back all walk one stack: a sheet, then the screen, then the tab, then "Leave Omni-ware?".
- **Look only.** An order the yard can't act on opens one read-only view that says what it waits on, with "Look only · …" at the foot.
- **Red is the full job.** A short or partial answer is an amber-outlined choice; something that can't be done yet is a grey, disabled button that says what it waits for.
- **Nothing found is never a dead end.** It offers the nearest shop words, or the Try chips.
- **Counts are the rows.** A count on a chip is never more than what is listed.
- **A long list keeps its header.** Once the hero scrolls off, a compact navy bar with Back stays on top.

Deferred:
- The rest of the round 4 brief after NAV-08 (it arrived cut off), and NAV-01 if there was one.
- Find has no paging; "e" lists every match. Fine on the test phones; page it if an old phone is slow.
- 0161, 0162 and 0163 to run.

## Round 5 · Roles and privacy (23 Oct 2026) · PRIV-01..05, NAV-02 (reopened) · migration 0164

Fixed: the snapshot works again (0156's money hold brought back with it); a failed load says "Could not load the yard" with Try again and a code, on every tab, and the app never falls back to reading tables directly; no money word reaches the phone for any login (notes stripped, the money hold renamed, settings an allow-list, everything the yard reads in one snapshot); every member has a name, set on invite and changeable on You; a Store login writes only through its functions and reads only its own membership; Back adds one history entry per screen as it is tapped, so Chrome no longer skips it.

Now part of the language:
- **A failed load is never an empty yard.** No "clear", no 0s, no "No products": dashes, a grey play button and "Could not load the yard". If the phone has a last copy, the red bar sits over it, faded.
- **One way in.** The Store app reads only `store_snapshot`, for every login, the owner too. No money, so no fallback.
- **The phone has its own words for the money hold** (`letGoAsk`, `letGo`, `takenBack`, `agentSettled`, `terms`). The books keep theirs. A write sends only what the tap changed.
- **Every person has a name.** The greeting has no comma until there is one; Today asks once; the avatar is "?" until then.
- **The yard writes through its functions,** deny by default, like its reads.

Deferred:
- `worker.html` (the old `staff` login) still reads orders directly.
- `test/store-money-db.test.js`'s database scenario writes orders directly as the store role, which 0159 already stopped. It needs rewriting through `store_patch_order`.
- NAV-08 on lists other than the aisle (name them), and NAV-09 (no details yet).
- ~~To run on live: 0156 → 0160 → 0161 → 0162 → 0163 → 0164.~~ All applied by Kevin, 23 Oct 2026. DATA-05 checked on live the same day: all 59 of 0161's product moves landed.

## Round 6 · Wording and consistency (23 Oct 2026) · WORD-01..10 · no migration

Fixed: a person is named one way on every screen, the name they chose and never a login handle ("Someone" if none); the shift is passed, goods are handed over; an unpaid order says "Not paid yet" everywhere with one reason on the order; Today's numbers equal the screens they open; With Ruth shows every yard ask with who sent it; a trip difference is a check-in; durations and times have one format each; a trip is never a round; stock history names the order; units are lower case; the bell counts only what needs you, and opening Alerts reads it.

Now part of the language (the glossary in `docs/audit/store/ROUND-6.md`, now kept in `docs/audit/GLOSSARY.md`):
- **One resolver for names.** `personName()` for everyone; `nameEveryone()` when the snapshot lands. No screen reads a staff record's name raw.
- **One label, one reason.** `NOT_PAID` ("Not paid yet") on the bay, Today, Load and the slip; `notPaidWhy()` only on the order.
- **One definition per count.** `counts()`: to pack is ready now; waiting on goods beside it; delivered includes collected.
- **How long is `howLong()`, when is `whenAt()`.** Never a duration as a clock; never a clock time from another day without the day.
- **Units through `unitSay()`.** Always lower case.
- **The bell is what needs you.** Only today's "for you" alerts are unread; opening Alerts reads them.

Deferred:
- The `store.handover` push text ("handed you the yard") needs a migration.
- NAV-08 on lists other than the aisle (name them), and NAV-09 (no details yet).
- `test/store-money-db.test.js` database scenario (as round 5), and `test/manager-decisions-db.test.js`'s "store: count a trip" step, which writes a trip directly as the store role, which 0164 now refuses (it should go through `store_patch_trip`). Both fail the same way without this round's changes.

