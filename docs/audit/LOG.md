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
  - Warren to decline the duplicate "Aisle A · Aluminum" count.
  - Warren to decline Ken Bwaise's 20 Ctn return on #0494, raised against 1 Ctn bought.
- **Sourcing data.** 76 of 145 products sit in "Furniture". "Aluminum" and "Aluminium" are both used.
- **Not yet tested by Cowork.** Check-in, and the pack lock.
