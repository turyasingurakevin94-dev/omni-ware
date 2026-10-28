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
- [ ] **1. The spec** (`docs/spec/`). 01 and 02 decided 2026-10-28. From the existing system: the order's
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

## Backend fixes decided (2026-10-28)

Kevin's answers to the spec's questions (`docs/spec/01-order-journey.md` §5,
`docs/spec/02-money.md` §8) that make the **database** check a rule the apps
checked alone. They protect the books whichever app is in use, so they come
**before** the shared core. Each takes a migration number reserved in
`docs/decision-rights.md` and a test run against a real database (`OW_PG`).

- [x] Moving a stage needs `order.move`, and only to an allowed next stage (journey Q2) — `0173`, `test/stage-move-db.test.js`
- [x] The Checking gate checks suppliers' yes, lines with no supplier, agent prepay (journey Q1) and debt past the hold days (money Q8) — `0174`, `test/checking-gate-db.test.js`
- [x] `credit.release`, `pick.settle`, `credit_note.raise` checked on the writer (journey Q5); only `price.approve` changes a price decision (journey Q12) — `0175`, `test/manager-decisions-writer-db.test.js`
- [ ] A void and a credit note are each one database write (journey Q6)
- [ ] One "Cancel" by the Manager: `status = 'cancelled'`, stock put back, the Store and Sales pushed (journey Q7, Q8; builds the `order.cancel` row)
- [x] No line priced below cost, except given away (money Q16) — `0171`, `test/no-sale-below-cost-db.test.js`
- [x] Agent order total counts charges (money Q14) — `0172`, `test/agent-total-charges-db.test.js`

Everything else decided there is a front-end rule: the shared core builds it
once, and the old apps are not changed for it (they are frozen).

## Baseline (2026-10-28)

Source lines per app file: `index.html` 181,049 · `agent.html` 17,391 ·
`sales.html` 11,252 · `sourcing.html` 9,704 · `accounts.html` 7,039 ·
`manager.html` 6,398 · `store.html` 6,296 · `buyer.html` 6,168 ·
`owner.html` 4,333 · `client.html` 2,051 · `supplier.html` 1,663 ·
`worker.html` 1,196 · `shared-worker.js` 2,447 · `sourcing-console.js` 2,255.

## Log

- **2026-10-28** — Goal set. Phase 0 done: this file, CLAUDE.md rules, the size guard.
- **2026-10-28** — Plan changed to a new front end on the same database. Spec chapters 01 (the order's journey) and 02 (money) written from the code, checked, and decided by Kevin: 31 questions answered. The answers that need the database are listed under "Backend fixes decided".
- **2026-10-28** — First backend fix: no sale below cost (`0171`). Checked the old apps first: Sales and the Manager refuse a typed price under cost; a line also comes under cost when the Buyer takes a dearer supplier price, which they hold for the Manager. The database now refuses the first (OWCST) and never bills the second (OWPRC), until the Manager prices it or gives it away. Found on the way: the server's gate does not hold an untagged under-cost line in Checking (0153 only pushes) — left for the gate item (journey Q1).
- **2026-10-28** — Second backend fix: an agent order's total counts its charges (`0172`). `order_shop_total` counted goods only while its three edge-function twins count goods + charges, so on an order with a delivery fee mobile money marked it paid early and the agent's credit could not pay the fee (every plan refused as "changed"). Tested on a real database; the same test fails on the old rule.
- **2026-10-28** — Third backend fix: moving a stage needs its task (`0173`). Every move the apps make was traced to its task first: the Buyer leaves Checking with `supplier.confirm`, the Store moves with `stock.receive`, `order.load` and `order.deliver`, so `order.move` alone would have stopped them; each move takes `order.move` or that role's own task. Skips (other than the Manager's "mark done"), unknown stages and moves on invoiced or voided orders are refused.
- **2026-10-28** — Fourth backend fix: the Checking gate checks what only the Buyer app checked (`0174`). The Manager's "next" skipped suppliers' yes, lines with no supplier and agent prepay; now no app moves an order past them. Old debt (past 21 days) holds an order that adds to it as a credit hold, aged as the apps age it. Not added (not decided): the Buyer app's hold while an agent asks to change or cancel (`agentOrderOnHold`), and a line selling under its cost (found in fix 1; it is refused at the bill).
- **2026-10-28** — Fifth backend fix: the Manager's answers are checked on the writer (`0175`). Only the Manager app writes them today; no server function does. The Buyer app clears a price decision when a dearer supplier price leaves no margin; the database now does that itself (Kevin's Q12), and refuses any other change by anyone without `price.approve`, so the frozen Buyer app keeps working.
