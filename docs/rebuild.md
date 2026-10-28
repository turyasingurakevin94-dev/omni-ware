# The rebuild — standing goal

**Same apps, same screens, same books. Built from small files, with every
shared rule in one place.** Every session reads this before touching app
code and leaves the code a little smaller than it found it.

Kevin set this goal on 2026-10-28. It is not a feature: nothing the shop
sees changes unless Kevin approves a change by name.

---

## Done looks like

| Measure | Today (2026-10-28) | Done |
|---|---|---|
| Biggest source file | `index.html`, 181,049 lines | under 1,000 (aim 200–500) |
| Role app source (e.g. `store.html`) | 4,333–17,391 lines in one file | a 100–300 line shell + the screens it uses |
| Functions copied into 2+ apps | 552 names, 13,679 duplicate lines | 0 — each lives once in `core/` or `flow/` |
| Copies that disagree | 250 (35 touch money) | 0 — one rule, decided by Kevin where they differ |
| Files one task has to read | one 6,000–180,000 line file | 3–6 small files |
| Tests | 478 files | same tests, still green, plus the size guard |

## The design

**Small files in the source, one file on the phone.** Each phone app ships
one HTML file: its APK build copies only that page (`apps/<app>/scripts/build-www.js`),
the live update fetches only that page, the service workers cache only
that page, and 470 tests read functions straight out of it. So the shipped
file stays, and becomes a **built** file:

```
src/
  core/            one copy, used by every app
    money.js         UGX, balances, credit, aging, markup, totals
    data.js          Supabase, the offline queue, sync
    auth.js          log in, shop picker, role
    ui/              header, sheet, slide, tiles, icons, tokens (CSS)
    words.js         the glossary, in code
  flow/            the order's journey, one folder per stage, one file per screen
    orders/  buying/  yard/  delivery/  payments/  customers/
  apps/            thin: which tabs and screens each role gets
    store/  sales/  buyer/  manager/  accounts/  owner/  sourcing/ ...

tools/build-apps.js     src/apps/<app>/ + what it uses  →  <app>.html
```

- `<app>.html` keeps its name, its place and its single-file shape. Nothing
  downstream changes: APK builds, live updates, service workers, Vercel,
  tests.
- A built file starts with `GENERATED from src/ — do not edit`. A test
  rebuilds every app and fails if a built file differs from its source, so
  an edit made to the wrong file cannot slip through.
- No bundler and no framework. The build stitches files together in a
  fixed order, nothing more. Plain JS, as now.

## The phases

Each step is its own small change: tests green before and after, merged
to main the same day, and no screen or total changes unless Kevin has
approved that difference.

- [x] **0. Guardrails.** This file, CLAUDE.md pointing at it, the size
      guard (`test/file-size.test.js`), the baseline below.
- [ ] **1. The build step, on one app.** `tools/build-apps.js` plus the
      "built file matches its source" test. Pilot: `owner.html` (smallest
      role app). First cut is mechanical: split into files that rebuild it
      **byte for byte**, so nothing can change.
- [ ] **2. `core/money.js`.** Kevin decides each disagreement (below), then
      one copy serves every app. The money tests prove the totals.
- [ ] **3. The rest of `core/`.** UI kit, data and sync, log in, words.
- [ ] **4. Each role app, screen by screen.** Each app moves to the build step
      once, then shrinks during its normal rounds: a screen a round touches
      moves into `flow/` in the same change.
- [ ] **5. The console (`index.html`)**, page by page. Biggest, so last.

## Decisions waiting for Kevin

Copies that **behave differently**, found 2026-10-28. Phase 2 needs one
answer each. The rest of the 250 disagreements are checked the same way
when their phase comes; many only differ in names.

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
