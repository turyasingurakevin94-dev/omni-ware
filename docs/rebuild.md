# The rebuild — standing goal

**A new front end, built cleanly from a written spec, on the database we
already have. Role by role, each new app replaces its old one only when it
is clearly better.** Kevin set this goal on 2026-10-28.

## Why this way

| Option | Verdict |
|---|---|
| Keep editing the old apps | Months of moving code around to end with the same screens. The old shape keeps pulling back. |
| Start over, database too | Throws away the part that is right (169 migrations, one-write money, decision rights in the database) and risks the shop's real books in a data move. |
| **New front end, same database** | Clean design from line one; the old tests and audit lessons carried over through the spec; the old app stays as a fallback. |

## Done looks like

| Measure | Today (2026-10-28) | Done |
|---|---|---|
| Biggest source file | `index.html`, 181,049 lines | under 1,000 (aim 200–500) |
| Phone role apps, all together | ~73,000 lines in 11 files | ~15,000–25,000 lines in small files |
| Functions copied into 2+ apps | 552 names, 13,679 duplicate lines | 0 — each rule lives once |
| Copies that disagree | 250 (35 touch money) | 0 — one rule, decided by Kevin where they differ |
| Where the rules are written | in the code, in six places | `docs/spec/`, one place, with the test that proves each |

## The rules

1. **One database.** The new apps use the same Supabase project, tables,
   server functions and decision rights. Never a copy. Database changes go
   through `supabase/migrations/` as now.
2. **Spec first.** `docs/spec/` says what the system does. Build to it. A rule
   found in old code that is not in the spec is added to the spec first.
3. **One role at a time.** The next role starts only when the last one has
   replaced its old app.
4. **The old app is frozen while its new one is built.** Urgent fixes only, no
   new features; otherwise everything is built twice.
5. **Leave alone what works and rarely changes**: Owner, Worker, Supplier, and
   the console for now.
6. **Small files.** No source file over 1,000 lines (aim 200–500).
   `test/file-size.test.js` guards it.
7. **Plan for the shop we have** (one business, two shops, a few dozen staff),
   not for scale nobody has.

## The phases

- [x] **0. Guardrails.** This file, CLAUDE.md pointing at it, the size guard,
      the baseline below.
- [ ] **1. The spec** (`docs/spec/`). From the existing system: the order's
      journey, money, roles, screens, data, offline and pushes. Kevin reviews
      each chapter.
- [ ] **2. The stack.** One page in the spec (chapter 07); Kevin approves.
      Leaning: TypeScript, Vite, Preact; Supabase and Capacitor stay.
- [ ] **3. The shared core.** Money (one rule each, Kevin's answers below),
      data and offline sync, log in, the screen parts. The old money tests are
      ported as its checks.
- [ ] **4. Role apps, one at a time**, to the approved canvases: Store first,
      then Sales, Buyer, Manager, Accounts. Each is tried on a preview link,
      then its role switches over; the old app stays one release as fallback.
- [ ] **5. Later, if ever:** Owner, Worker, Supplier, Agent, the console.

## Decisions waiting for Kevin

Copies that **behave differently**, found 2026-10-28. The shared core
(phase 3) needs one answer each. The rest of the 250 disagreements are checked the same way
when the money chapter is written; many only differ in names.

| Rule | Where they disagree | Suggested answer |
|---|---|---|
| `goodsTotal` — goods on an order | Owner counts lines whose price is still being confirmed, and does not round. Sales, Manager, Accounts skip them and round. | Sales' version everywhere |
| `quoteTotal` — what the order costs | Owner's can go below zero after credit notes. The others stop at 0. | Stop at 0 everywhere |
| `custAging` — how old a debt is | Owner counts a charge with no date as new (0 days). The others put it under "no date". | "No date" everywhere |
| `fmtUGX` — how money is written | `1,000 UGX` (5 apps), `UGX 1,000` (agent), blank for an empty value (console) | `1,000 UGX`, blank when empty |
| `debtors` | Same name, two meanings: Manager's list is sorted by oldest debt; Accounts' is anyone owing. | Keep both, under two names |

## Baseline (2026-10-28)

Source lines per app file: `index.html` 181,049 · `agent.html` 17,391 ·
`sales.html` 11,252 · `sourcing.html` 9,704 · `accounts.html` 7,039 ·
`manager.html` 6,398 · `store.html` 6,296 · `buyer.html` 6,168 ·
`owner.html` 4,333 · `client.html` 2,051 · `supplier.html` 1,663 ·
`worker.html` 1,196 · `shared-worker.js` 2,447 · `sourcing-console.js` 2,255.

## Log

- **2026-10-28** — Goal set. Phase 0 done: this file, CLAUDE.md rules, the size guard.
