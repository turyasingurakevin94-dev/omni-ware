# Store app audit log

One entry per round, newest last. Each round's checklist is in `docs/audit/ROUND-<N>.md`. The skill is `.claude/skills/omni-ware-round/SKILL.md`.

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
