# Bug-report verification — reviewed commit `b5513c2`

Independent verification of the 2026-10-09 handoff (BUG-1 … BUG-10 and the dead-code candidate list).
**No application file was changed.** The only addition to the repository is this folder: probes and a
throwaway-database setup script. `npm test` does not pick it up (the runner reads `test/*.test.js` only).

HEAD was `b5513c2e53d40fe8a8d53c6cc11c7f51737e4d56`, identical to the reviewed commit, with a clean tree.
Baseline: `npm test` gives **380/380 test files passed** on Node 22.22.0.

## How the findings were exercised

| Layer | What runs | Notes |
|---|---|---|
| Edge handlers | Real `supabase/functions/*/index.ts`, types stripped by Node's `module.stripTypeScriptTypes`, run in a `vm` context with `createClient`/`fetch` injected (`loadfn.js`) | Only rewrite: the `npm:` import line and `export` keywords are removed. No business logic is copied. |
| In-memory double | `fakedb.js`: column projection, `count/head`, `->>` JSON filters, unique constraints, identity ids, max-rows cap, async per-request hooks | Hooks give deterministic barriers ("all N reads done before any write") and fault injection. |
| **Real database** | Postgres 16.15 with **all 108 migrations applied (0 failures)**, behind **PostgREST 12.2.3 with `db-max-rows = 1000`**, reached through supabase-js's own `PostgrestClient` (`realdb.js`, `setup-realdb.sh`) | Real triggers (`saved_quotes_keep_stage_log`, `sync_agent_id`, …), constraints and READ COMMITTED. Barriers and faults are injected at the HTTP layer. `current_agent_id`/`is_shop_admin` are answered by the harness, so no auth is attempted. |
| index.html | Real `loadData` (with its 13 transitive helpers and real top-level consts) and `addStockLotsDiffOps`, extracted with `test/_extract.js` | Run against the real PostgREST above. |

Provider HTTP (MTN) is mocked. No real charge, message, deployed migration or live login is involved, and all data is synthetic.

```bash
# in-memory probes (no setup needed)
node docs/verification/2026-10-09/bug1.js      # BUG-1
node docs/verification/2026-10-09/bug2_9.js    # BUG-2, BUG-9
node docs/verification/2026-10-09/momo.js      # BUG-5, BUG-6, BUG-8
node docs/verification/2026-10-09/pricing.js   # BUG-7, BUG-10
# real Postgres + PostgREST (as root; needs postgresql-16, curl, npm; uses /tmp/omni-verify)
bash docs/verification/2026-10-09/setup-realdb.sh
node docs/verification/2026-10-09/bug3_4.js    # BUG-3, BUG-4 (loader)
node docs/verification/2026-10-09/realfns.js   # BUG-1/2/5/6/8/9 re-run on real DB, BUG-4 claim + leaderboard
```

These are **probes**: they print the unsafe outcome and exit 0. They are not regression tests. A regression
test should assert the invariant, fail on `b5513c2`, and pass after the fix.

## Verdicts

| ID | Verdict | Current file/line | Reproduction | Expected vs observed | Impact | Missing evidence |
|---|---|---|---|---|---|---|
| BUG-1 | **Confirmed** (mock + real PG) | `supabase/functions/agent-change-order/index.ts:165-206` (read 170, source write loop 179, rollback 200) | `bug1.js`, `realfns.js` | Source credit 100, two destinations, barrier after the credit read → **both return 200 `credited:100`**. Destinations paid 100 + 100; source `used` holds **one** entry (last writer wins). Rollback probe: X reads, Y completes, X's destination update fails → X's stale rollback sets `used:[]` while Y's 100 stays paid. It also reverts an unrelated payload edit (`note`). Sequential control is correct (second call is 409). | Money: credit spent twice, debit lost | None. No trigger or constraint guards `payload.agentCredit` (the 0107 trigger only merges `stageLog`). |
| BUG-2 | **Confirmed** (mock + real PG) | `supabase/functions/client-portal/index.ts:773-808` (read 780, hash 799, absolute write 802) | `bug2_9.js`, `realfns.js` | 8 concurrent wrong guesses → all 8 evaluated (401); `pin_attempts` ends at **1** (expected: ≤3 evaluated, ≥3 recorded). 7 wrong + **correct as the 8th concurrent guess → 200 and a session**. Correct PIN twice concurrently → **two 200s, two sessions**. Sequential control: 401,401,401,429,429. | Access control: 3-guess limit not enforced under concurrency; the PIN is not single-use | How wide the race window is in production depends on PBKDF2 (100k iter) latency and edge concurrency, which cannot be measured locally. No gateway or IP rate limit exists in the code or migrations. |
| BUG-3 | **Confirmed** (real PG) | `index.html:45163-45193` (DELETE 45176, INSERT 45186) | `setup-realdb.sh` then `bug3_4.js` | Lot `{P, qty 10, cost 100, consign SUP1}`, change to 9, INSERT fails → DB has **0 lots for P**; a second client's `loadData` sees none. The snapshot is not committed, and a same-tab retry restores `{9,100,SUP1}`. | Persisted records: FIFO cost and consignment ownership lost if the tab closes or another device saves first | None for the code path. The repair-by-retry depends on the tab staying open. |
| BUG-4 | **Confirmed** (real PostgREST, local `max_rows=1000`) | `index.html:43924-43993` (`sel` 43925, freshness 43989); `supabase/config.toml:18`; `agent-claim-commission/index.ts:83`; `agent-leaderboard/index.ts:95` | `bug3_4.js`, `realfns.js` | 1,001 `cash_txns` → **loaded 1,000**. PostgREST answers `206`, `Content-Range 0-999/1001`, and the loader ignores it. `booksRead` = fresh, no error. Two lots of key P straddling row 1,000 → 1 loaded. A following sale's rewrite **deletes the unloaded `{5 @ 120}` lot**. Claim: 1,000 July orders + 5 August orders × 100 bonus → August claim **400 "No bonus commission earned"**. Leaderboard: an agent's only completed order this month after 1,000 older orders → **amount 0, 0 orders**. | Wrong balances and reports; silent data loss on the next write; under-paid or refused commission claims | **Hosted** API row limit not checked (local config only). Unordered reads return arbitrary heap order, so *which* rows go missing varies. |
| BUG-5 | **Confirmed** (mock + real PG) | `supabase/functions/check-momo-payment-status/index.ts:159, 175-189`; apply at `:29-73` | `momo.js`, `realfns.js` | Provider SUCCESSFUL, order update fails → `status=successful` + warning, cash receipt inserted, order unpaid. **Second recheck returns `successful` without retrying.** Cash insert failing instead → no receipt, order unpaid, txn terminal. The webhooks only look at `pending` rows (`mtn-payment-webhook:60-65`), and the admin ledger flags only stuck-*pending* rows (`index.html:87072`). | Money: confirmed payment never reaches the order, or cash book and order disagree | None. The only protection is the one-off "check manually" warning string. |
| BUG-6 | **Confirmed** (mock + real PG) | `supabase/functions/agent-initiate-momo-payment/index.ts:272-320` | `momo.js`, `realfns.js` | Barrier after the pending lookup → **2 pending rows, 2 provider pushes of 100**, both 200. Sequential control reuses the row (`reused:true`, 1 push). Schema: only `external_reference unique` (0022), with no per-order active-attempt constraint in any migration. | Money: customer can be charged twice | Whether both prompts would be approved is a human factor. |
| BUG-8 | **Confirmed** (mock with projection + real PG) | `supabase/functions/agent-initiate-momo-payment/index.ts:235-251` | `momo.js`, `realfns.js` | `voided:true`, no `agentCancel`, `__stock__` line → **200, payment row, provider push**. The select is `id, status, payload, amount_paid` (no `voided`). Control: with `agentCancel` → 409. Reachable from the shop's own board: `removeOrder('cancel')` → `cancelSavedQuote` → `setInvoicesVoided` sets only `voided` (`index.html:65690-65706, 72590`). | Money: payment taken on a cancelled order | Concurrent-cancellation case not tested (it needs the fix's atomic reservation first). |
| BUG-7 | **Confirmed** (mock) | `supabase/functions/client-submit-order/index.ts:269-283`; portal `client-portal/index.ts:933-938`; same pattern at `:1151` (`advice`, read only, not executed) | `pricing.js` | Cost 100, default markup 50%. Control → 150. `app_settings` read fails → **200, order stored at 100 (= cost)**. Portal `price` with the same failure **shows 100, i.e. discloses supplier cost**. History read fails → portal showed remembered 120, **submit charged 150**. | Money: sells at cost; cost disclosure; charged ≠ shown | Real-PG run not needed: the defect is in handler control flow (the `error` is never destructured). |
| BUG-9 | **Confirmed** (mock + real PG) | `supabase/functions/client-portal/index.ts:810-829` | `bug2_9.js`, `realfns.js` | Session INSERT fails → **200 `ok:true` + token**; 0 sessions; PIN cleared; token → 401 "Sign in again"; PIN retry → 401. PIN-clear fails instead → 200 + session, but **the PIN stays live and a replay logs in again**. | Access: false success, burned PIN; or a reusable PIN | None. |
| BUG-10 | **Confirmed** (mock) | `client-submit-order/index.ts:160-179` (`>=` at 176, query 278-280); `client-portal/index.ts:405-424` (421, query 949-952) | `pricing.js` | Same-day orders, newest id 7 = 150, older id 6 = 100, read newest-first → **portal shows 100, submit charges and stores 100**. Different-day control → 150. The comment ("the later one in the list wins") matches the code but contradicts newest-first order. `test/client-portal-pricing.test.js` has no same-day case. | Money: older, lower negotiated price wins | Whether `id` order equals chronological order is assumed; ids can be client-assigned (`index.html:43910-43918`). |

Rejected or not reproduced: **none**. Already fixed: **none**. Additional observations made during verification are
included in the rows above: BUG-1 rollback clobbering unrelated payload fields, BUG-7 cost disclosure in the
portal, BUG-7's third copy in `advice`, and BUG-9 leaving a reusable PIN.

## Dead-code candidates

Every one of the 117 has exactly **one production occurrence**: its own top-level declaration at the claimed line.
There are 0 hits in other pages, `sourcing-console.js`, `shared-worker.js`, `worker-www/`, `supabase/` and `android/`.

No dynamic path reaches any candidate:
- index.html, `sourcing-console.js` and `shared-worker.js` contain no `window[…]`, `globalThis[…]`, `eval`, `Function(`, string timers or templated call names.
- Computed dispatch (`OT_DIALOGS[…]`, `ofLookup`, `owsvMount`) resolves only against literal object or scope names.
- Android's `MainActivity` is an empty `BridgeActivity` with no `evaluateJavascript`.

As an empirical check, all 117 bodies were removed from a `git archive` copy. The inline script still parses, and the 36 test files that then fail all read source text (`extractFunction` or regex). None of them reaches a live caller.

- **High confidence, dead (70):** the 67 with no test mention, plus `invBillChip`, `stLine` and `mgrUnusualReading`, whose test mentions are stubs or "not called" assertions.
- **Medium confidence (47):** pinned only by tests of the obsolete helper, so those tests need editing on removal.
- **Four tests are false-green for the live screen:**
  - `wa-draft-function.test.js:351` (bold preview): `waWaMarkupHTML` is never called.
  - `admin-purchase-correction.test.js:501`: the Correct-bill buttons exist only in dead `piOpenBodyHTML`.
  - `invoice-progress.test.js` (150%): the live register uses a clamped `.inv-pb`.
  - `order-lifecycle-links.test.js:186`: it matches dead code at index.html:76709.
- **Removal cascades:** removing the 117 orphans 22 more functions (e.g. `sourcingState`, `stTrendMonths`, `otCardHTML`).
- **`deleteProduct` (index.html:109102) is already dead.** Its second "occurrence" is a comment, so the literal scan missed it.

Replacement traces:
- **Sourcing:** nav `data-tab="sourcing"` → `goToTab` → `renderSourcing` (index.html:167113), a one-line delegate to `renderSourcingConsole` (sourcing-console.js:2245). The old `sourcing*HTML/SVG` family is unreachable.
- `fmtUGXPerUnitPack` → `fmtPriceCompactPack`.
- `mpSetTab` → the `[data-mpsrc]` rail handler.
- `invProgressCell` and `invStatusChip` → inline in `renderInvoices`.
- `generateNextProductId` → `fillIssuedId` / `issueEntityId`.
- `statementsTrend` and `stTrendChartHTML` → `shModel`.

Nothing was removed.

## Proposed fix order (hypotheses, not implemented)

1. **BUG-6 + BUG-8:** one `reserve_momo_attempt(order_id, …)` RPC. It locks the order row (`FOR UPDATE`), refuses `voided`, `agentCancel` and paid orders, and returns any active attempt; add a partial unique index on `(order_id) where status='pending'`.
2. **BUG-5:** an `apply_momo_payment(payment_id)` RPC. It runs in one transaction, links the cash receipt uniquely by payment id, and keeps `applied_at` separate from provider `status`. Recheck and the webhooks retry until `applied_at` is set.
3. **BUG-1:** a `use_agent_credit(dest, …)` RPC that locks source and destination rows in id order, recomputes available credit inside the transaction and writes both. Drop the client-side rollback.
4. **BUG-2 + BUG-9:** a `verify_pin_attempt` RPC. It increments `pin_attempts` atomically (`UPDATE … RETURNING`) *before* hashing and is bound to the PIN version. On success it clears the PIN and inserts the session in one transaction, and returns the token only after commit.
5. **BUG-3:** a `replace_stock_lots(keys, rows)` RPC (delete + insert in one transaction), ideally with a version check.
6. **BUG-4:** paginate with a stable `order('id')` + `range()` loop, compare against `count=exact` (or `Content-Range`), and mark the books partial and refuse saves on a mismatch. Move the claim and leaderboard sums into SQL with the month filter in the query. Add 1,000/1,001 boundary tests.
7. **BUG-7:** check every pricing read's `error` (submit, `price`, `catalogue`, `advice`) and refuse rather than price.
8. **BUG-10:** keep the first value seen per key when walking newest-first, or compare `(date, id)`. Add a same-day test to both copies.
