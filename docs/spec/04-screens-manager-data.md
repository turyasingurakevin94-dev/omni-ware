# 04 · Screens — Manager: the data contract

What this covers: every read and write the current `manager.html` (6,483 lines, frozen) makes, so the new Manager app (`src/apps/manager`, `src/core/manager`) reads and writes the same database the same way; per decision (D-1 … D-33 of `docs/audit/manager/handover.md` §1) the call the old app makes, the task the database checks, and what the new app calls instead; what waits on migration 0184 (§3); how two phones are kept from answering the same ask (§4); the questions (§5).
Date: 2026-11-12
Status: **read from the code, not decided.** Every item gives its `manager.html` line (branch `claude/manager-round2`) or its migration `file:line`, and the test that proves it, or "no test". Who decides is `docs/decision-rights.md` (binding). The questions in §5 are for Kevin; until he answers, the new app does what the canvas draws, and where the canvas is silent, what `manager.html` does today.

Read with: `docs/audit/manager/handover.md` (D-, M-, P- ids), `docs/audit/manager/day.md`, [`05-data.md`](05-data.md), [`06-offline-sync-push.md`](06-offline-sync-push.md), [`04-screens-store-data.md`](04-screens-store-data.md) (the same shape for the yard), `src/core/supabase/` (how Sales and the Buyer do it).

---

## 0. How manager.html talks to the database

| What | How | Line |
|---|---|---|
| Client | `sb`, the shared client (production on the Capacitor and Vercel hosts, staging elsewhere) | 907–915 |
| **The Manager sees money.** | It reads the shop's tables directly, every money column included (costs, margins, debts, the cash book). No server snapshot, no allow-list: the Manager holds `margin.see`, `credit.set`, `invoice.make`, `payment.receive` (decision-rights §2) | 1185–1272 |
| Paged read | `selectAll(table, key, filter)`: `select('*')`, `.eq('shop_id', shop)`, keyset paging 1,000 a page (`gt(key, last)`) | 1132–1148 |
| Row → object | `rowToQuote` 1153 (payload spread over defaults; `qa` test orders kept apart, 0167), `rowToTrip` 1159, `rowToHandoff` 1166, `rowToCancelAsk` 1171, `rowToPayAsk` 3912, `rowToTxn` 4347 | |
| **Order writes** | `changeOrder(id, fn, keys)`: re-read the one row (`saved_quotes` select), run `fn` on the fresh copy (`false` = "already decided", nothing sent), then `patchOrder` sends **only `keys`** through `rpc('ow_patch_order', {p_shop_id, p_id, p_patch, p_client_name: null, p_client_phone: null, p_drop, p_status})` (0165:463); a key set to `undefined` goes in `p_drop`. **No `p_expect`** (§4) | 2016–2038 |
| Server functions | `callFn(name, args)`: `sb.rpc`, throws the error | 4484–4488 |
| **The owner's log** | `logDecision(task, what, {amount, ref, before, after})` inserts `decision_log` **from the phone** (RLS 0123:647: `by = auth.uid()` and `has_task(task)`); a failed line never undoes the decision, it toasts | 4472–4480 |
| Old-database fallbacks | `owPaymentArgs` (920–946) re-does `ow_patch_order` by hand before 0165 and trims `receive_payment` args; `rpcMissing` (4483) turns a missing function into "needs the update". **Drop them in the new app**: 0165 and 0169 are on every database | 920–946, 4483 |
| Phone copy | `localStorage` `ow-manager-snap:<uid>` = `{shopId, shopName, role, at, data}`: **the whole books, money included**, written after every load and write; drawn at boot when the network fails | 1292–1294, 2242 |
| Realtime | **None.** A 45 s refresh (§1d) | 2354 |
| Errors | `failWord` (1060): a network error "No connection — nothing was changed. Try again with signal."; else "Nothing was changed: {the database's message}". The cancel page strips a leading code (`^[A-Z0-9]{5}: `, 5677) | 1059–1060 |

### 0a. Phone-only state

| Key | Where | What | Line |
|---|---|---|---|
| `ow-manager-snap:<uid>` | localStorage | the books (above) | 1292 |
| `ow-manager-prefs` | localStorage | `{sound, big}` | 1067 |
| `ow-manager-bundle` | localStorage | the native live update | 123 |
| `ow-manager-day:<uid>:<date>` (shop-scoped) | localStorage | today's moves and nudges, counted on the phone only | 3703–3704 |
| `ow_mgr_balask_q` | localStorage | "Ask Esther to check" rows kept with no signal, sent on `online` | 3915–3929 |
| `ow-manager-me`, `-recent`, `-loginask`, `-win` | localStorage | my staff card, recent orders, a login asked about, a goal's win shown | 1667, 3274, 2532, 6441 |

---

## 1. Reads

### 1a. At boot

| # | Read | Filter / columns | Why | Line |
|---|---|---|---|---|
| R1 | `auth.getSession()` / `getUser()` | — | the login | 2226–2239 |
| R2 | `shop_members` | `select('shop_id, role, shops(name, created_at)').eq('user_id', uid)`; roles let in **`manager`, `owner`, `admin`**; more than one shop → `chooseShop` | which shop | 2240–2251 |
| R3 | `role_tasks` | `select('*').eq('role', role)` (owner and admin hold `ALL_TASKS`, 2054) | `can(task)` greys every answer the login lacks | 2062–2074 |
| R4 | `staff` | `select('id').eq('user_id', uid)` before `push_subscriptions` upsert (W45) | the push token's staff id | 2278 |

### 1b. `loadAll` (1185): 26 reads in one `Promise.all`, after `ow_end_targets` (W43)

"All" = `selectAll`, every row of the shop. The new app needs the columns named; `select('*')` today.

| # | Table | Filter | Columns the new app needs | Used by | Line |
|---|---|---|---|---|---|
| R5 | `saved_quotes` | all (whole history) | `id, status, invoiced, invoiced_at, invoiced_ts, amount_paid, voided, date, client_name, client_phone, qa, payload` | every order decision (D-1…D-22, D-31); Orders; money totals | 1189 |
| R6 | `customers` | all | `id, name, phone, phone2, location, notes, debt, terms_days, credit_limit` | D-5/6/7, D-25…D-28, D-30 | 1188 |
| R7 | `customer_debt_log` | all | `id, customer_id, date, type, amount, note, cash_txn_id, quote_id` | debtor aging (D-30), statements | 1188 |
| R8 | `products` | all | `id, name, type, category, wholesale_/retail_markup_type/value, stock_*_markup_*, variant_attributes, variants` | prices (D-1…D-4), markups (D-33) | 1188 |
| R9 | `prices` | all | `id, product_id, variant_idx, supplier_id, wholesale, retail, unit, pack_unit, pack_qty, out_of_stock, tiers` | cost and the shop's price on a line | 1188 |
| R10 | `stock` | all (key `key`) | `key, qty` | write-off, counts, carton | 1189 |
| R11 | `stock_lots` | all | `key, qty, cost` | FIFO cost (`getFIFOUnitCost`) for a write-off line and a trip difference at cost | 1189 |
| R12 | `app_settings` | `select('presets')`, one row | `creditPct, defaultMarkup, chaseAfterDays (7), orderStageLimits, creditHold, shopAddress, shopPhone/waPhone` | D-29, D-33, hold days, stuck limits | 1190 |
| R13 | `cash_txns` | `date ≥` 35 days back or the 1st of the month, whichever is earlier (`cashFromISO`); `qa` dropped | `id, date, account, type, category, amount, description, time, quote_id, qa` | receipts on a debtor, the payment page | 1191 |
| R14 | `staff` | all | `id, name, phone, role, unavailable, user_id` | the team, D-31 give/nudge, names | 1192 |
| R15 | `collection_trips` | all | `id, supplier_id, status, assigned_worker_id, created_at, assigned_at, accepted_at, collected_at, confirmed_at, note, lines, voided, yard_checked_at, yard_checked_by, difference_accepted_at, cash_count` | D-13, D-31 trips, the cancel block | 1193 |
| R16 | `manager_notes` | `kind = 'target'`, `status in (open, ended)`, newest 100 | `id, date, body {who, metric, aim, from, to}, status` | D-29 goal rings | 1195 |
| R17 | `statements_sent` | newest 500 | `customer_id, sent_on` | D-30 "last statement" | 1196 |
| R18 | `payment_promises` | all | `id, customer_id, promised_on, made_on, amount` | D-28, D-30 | 1197 |
| R19 | `invoice_asks` | `status = 'sent'`, ≤ 200 | `id, quote_id, customer_id, kind (credit/void), lines, amount, reason, note, asked_by, asked_by_name, asked_role, status, created_at` | D-18, D-19 | 1200 |
| R20 | `stock_counts` | newest 40, any status | `id, aisle, counted_by, counted_by_name, lines[{counted, system}], status, created_at` (+ `place`, `missing`, 0159/0161) | D-17 | 1201 |
| R21 | `stock_reports` | `status = 'sent'`, ≤ 200 | `id, key, product_id, variant_idx, name, qty, why, note, reported_by, reported_by_name, status, created_at` (+ `photo_path`) | D-16 | 1202 |
| R22 | `restock_buys` | `status in (planned, held)`, ≤ 300 | `id, product_id, variant_idx, qty, unit, price, status, created_by, created_at, held_by, for_line` | D-23, D-24 | 1204 |
| R23 | `rival_prices` | all | `product_id, variant_idx, price` | the price page's "rivals" | 1205 |
| R24 | `buyer_handoffs` (`yardNotesQuery`) | `for_role = 'manager'`, `kind = 'yard_note'`, `status = 'open'`, ≤ 200 | `id, kind, for_role, ref, payload {tripId, words, lines[{name, you, yard}]}, status, created_by, created_at` | D-14 | 1165 |
| R25 | `payment_asks` | `created_at` in the last 60 days | `id, cash_txn_id, customer_id, quote_id, amount, kind, status, created_at` | "Ask Esther to check" sent / answered | 1209 |
| R26 | `fresh_starts` | `select('old_debts, confirmed, made_at')`, one row | as named | D-27 | 1211 |
| R27 | `decision_log` | `select('ref')`, `task = 'customer.edit'`, ≤ 500 | `ref.apart` | D-26: "Not the same" is not asked again | 1214 |
| R28 | `cancel_asks` (`cancelAsksQuery`) | `status = 'sent'`, ≤ 200 | `id, quote_id, why, note, amount, stage, asked_by, asked_by_name, status, created_at` | D-20 | 1170 |
| R29 | `shop_members` (`membersQuery`) | `select('user_id, role, display_name')` | as named | a salesperson with no staff card is named (X-3) | 1173 |

A read that fails reads as empty (`.then(r => r, () => ({data: []}))`), so an older database draws an empty list, never a broken app. Keep that only for tables that may be missing; a network error must say so.

### 1c. One-row reads

| When | Read | Line |
|---|---|---|
| Before every order write | `saved_quotes` `select('*').eq('id', id).maybeSingle()` (`changeOrder`, `obMove`, `obVoidDup`, `voidAskWrite`) | 2028, 3424, 3607, 5530 |
| Before giving a trip | `collection_trips` the one trip; refused unless `open`/`assigned` and not voided | 2042–2044 |

### 1d. Refresh

| When | What runs | Line |
|---|---|---|
| Every 45 s while visible, not dragging, not paying | `refreshLive`: `saved_quotes` through `liveQuoteFilter` (`status ≠ completed` **or** not invoiced **or** voided **or** invoiced in the last 2 days, merged over the copy), all `collection_trips`, R24, R28 | 1276–1290, 2354 |
| Visible again after 30 s away | `loadAll` | 2356 |
| A push tapped | `loadAll`, then `pushOpen(data)` | 2286, 2300 |
| After most writes | `loadAll` (write-off, count, credit note, void, goals, merge, invoice) | 5342, 5363, 5430, 5548, 5955, 6042, 5139 |
| Every 60 s | redraw only | 2355 |

**`refreshLive` misses** R19 invoice asks, R20 counts, R21 reports, R22 restock lines, R25 payment asks and R6 customers' debt: a new return, count, loss or carton shows only on the next full load (a push tap, or coming back after 30 s). The new app's live read takes every queue a decision reads (§1f).

### 1e. Missing today: `store_asks` (D-15, M-2)

`loadAll` never reads `store_asks`, so the Store's "Not on the list · keep it?" waits for good (handover M-2). The new app reads:

| # | Table | Filter | Columns | RLS |
|---|---|---|---|---|
| R30 | `store_asks` | `kind = 'extra'`, `status = 'sent'` | `id, kind, ref (trip id), payload {tripId, supplierId, key, productId, variantIdx, name, qty, unit, why, newItem, photo}, asked_by, asked_by_name, status, created_at` | members read (0157:72); the shape is old/store.html `sendExtras` (2488–2493) |

Counted in Decide and routed from `store.extra` (§3). Test: `store-asks.test.js` (the SQL), no test of a Manager read.

### 1f. One server snapshot, later (noted, not designed)

`loadAll` is 26 round trips and the whole order history on every full load. Like the Store's `store_snapshot` / `store_live` (0164, 0166), it could become one function for the day and one for what changes all day (orders in play, trips, and every queue: R19–R22, R24, R25, R28, R30, customers' debt). Not in 0184 unless Kevin asks.

### 1g. Privacy

The Manager may see money (decision-rights §1 row 2, `margin.see`). Two places go past what a decision needs; both are §5 questions: the cash book (R13, Accounts' book) and the books kept unencrypted in `localStorage` (§0).

---

## 2. Writes, one per decision

"Patch {keys}" = `changeOrder(id, fn, [keys])` → `ow_patch_order` (§0). "Held N s" = written only when an Undo window runs out; Undo sends nothing. "Checked" = what the database refuses without the task. "New app" = what the new app calls; "same" where nothing better exists.

### 2a. Prices (D-1 … D-4)

| W | D | Old call (what is written) | Line | Checked | New app | Test |
|---|---|---|---|---|---|---|
| W1 | D-1, D-3 | `decidePrice(qid, idx, how)`: patch {`items`}; the line gets `priceReview {state: 'approved'\|'changed', price, was, qty, by, byName, at}` and, unless approve, `sellPrice`. Refused on the phone when the line no longer waits (`lineWaitsPrice`) or under cost | 4614–4637, `ACT.pdecide` 4810 | `price.approve` on any `priceReview` change (0175 trigger `saved_quotes_ow_a_decisions`); a typed price under cost OWCST (0171:96) | same (no function exists); §4 Q1 | `manager-decisions-writer-db.test.js`, `no-sale-below-cost-db.test.js` |
| W2 | D-1 Undo | `undoPrices`: patch {`items`}, each line's `sellPrice` and `priceReview` put back, only if the line still carries the price set; a log line "Undid" | 4600–4608 | as W1 | same | no test |
| W3 | D-3 several lines | `ACT.pnset`: W1 once per line (one write each) | 4904–4917 | as W1 | same | no test |
| W4 | D-2 no cost | `ACT.ncgo`: patch {`items`}: `price` (the cost), `costBy {by, byName, at, source: 'manager'}`, `sellPrice` (cost + markup when the old price is under it), `priceReview` | 4933–4954 | as W1 | same | no test |
| W5 | D-2 ask the Buyer | `ACT.costask`: patch {`costAsked {at, by}`} (no push) | 4956–4958 | none | same, or drop (§5 Q12) | no test |
| W6 | D-4 counter | `counterAnswer` → W1 `approve` / `shop`; at cost a second yes first. `counter_sale` completes on Sales' side | 4982–4991 | as W1 | same | no test |

### 2b. Credit (D-5 … D-7)

| W | D | Old call | Line | Checked | New app | Test |
|---|---|---|---|---|---|---|
| W7 | D-5 | `ACT.hdecide`: patch {`creditCheck {decision: 'release'\|'cash'\|'hold', by, byName, at, over, ageDays, limit, withIt}`}; refused on the phone once the order has left `draft` | 4078–4090 | `credit.release` on any `creditCheck` change (0175) | same; handover M-14 drops `hold` (§5 Q6) | `manager-decisions-writer-db.test.js` |
| W8 | D-6, D-7 on credit | `ACT.ckgo`: **two writes**: `customers` update `{credit_limit, terms_days}` (`ckWriteCredit` 4202), then `answerAsk` patch {`creditCheck {…, ask: true, limit, terms, withIt}`, `creditAsk.answer {decision: 'credit'\|'cash', by, byName, at, …}`} (4208); a log line; `tell_customer_change` (W33) | 4216–4229 | `credit.set` on limit and terms (`customers_sales_guard` 0122:166, logs it); RLS update needs `customer.edit` or `payment.receive` (0117:92); `credit.release` (0175) | same; §5 Q5 (not one write) | `manager-decisions-db.test.js` (guard) |
| W9 | D-6, D-7 cash first | `ACT.ckcash`: `answerAsk(id, 'cash')` | 4231–4242 | `credit.release` | same | no test |
| W10 | D-6/7 Undo | `ACT.ckundo`: the customer's limit and terms back, then patch {`creditCheck`, `creditAsk`} back | 4244–4256 | as W8 | same | no test |

### 2c. Invoices (D-8 … D-11)

| W | D | Old call | Line | Checked | New app | Test |
|---|---|---|---|---|---|---|
| W11 | D-8 | `invoice_order(p_shop_id, p_quote_id)` (0119:967); "Invoice all" loops it | 5190–5195 | `invoice.make`; refusals OWTPC, OWPRC, OWSHP, OWWLK, OWGIV (§4) | same | `shared-foundation-db.test.js`, `invoice-unpriced-db.test.js` |
| W12 | D-9 small bill | the phone's `smallBill` (< 1,000, 5153) sends Invoice to the Small-bill page; **Bill it** is held 10 s (`SI_WAIT`), then W11. `invoice_order` has **no** small-bill parameter: OWSML is raised only by the 24-hour run (0169:821) | 5152–5188 | as W11 | same; §5 Q2 | `manager-round1-db.test.js` (OWSML in the run) |
| W13 | D-10 given away | `saveGivenAway`: patch {`items`}: per line `givenAway {why, by, at}`, or back to price (`sellPrice: null`, `priceBy`, `priceNote`, `priceAt`, `priceAsk: true`); a log line under `price.approve`; then W11 | 5115–5128, `ACT.gasend` 5129 | **no writer check** on `givenAway` (0175 checks `priceReview` only); OWGIV at the invoice when a line at 0 has no `givenAway.why` (0169:381) | same | `manager-round1-db.test.js` |
| — | D-11 | nothing of its own: the underlying W1, W4 or W14 | — | — | — | — |

### 2d. The yard (D-12 … D-17)

| W | D | Old call | Line | Checked | New app | Test |
|---|---|---|---|---|---|---|
| W14 | D-12 | `ACT.spgo`: patch {`items`, `pickShortfallAckAt`, `pickSettle`}: **went** each short line's `qty = picked`; **full** `pickShortfallAckAt = ms`; both `pickSettle {pick, by, byName, at, lines[{idx, ordered, picked}]}` | 5223–5237 | `pick.settle` (0175) | same | `manager-decisions-writer-db.test.js` |
| W15 | D-13 | `accept_trip_difference(p_trip_id text)` (0122:701), then W16 for the trip's notes | 5309–5315 | `trip.difference`; a second answer returns `{already: true}` | same | `manager-decisions-db.test.js` |
| W16 | D-14 | `closeYardNotes` / `ACT.yardseen`: `buyer_handoffs` update `{status: 'done'}` per open note; zero rows back = "not switched on" | 5272–5285 | RLS: `yard_note` needs `trip.difference` (0151:82) | same | no test |
| W17 | D-15 | **none** (§1e) | — | — | `answer_store_ask(p_id, p_status 'accepted'\|'declined', p_note)` (0157:84): Keep it / It goes back. **Moves no stock** (§5 Q4) | `store-asks.test.js` |
| W18 | D-16 write off | `ACT['slide:writeoff']`: `write_off_stock(p_shop_id, p_report_ids, p_lines [{key, productId, variantIdx, name, delta < 0, cost, report}], p_reason)` (0161:214) | 5337–5345 | `stock.writeoff`; "One of those reports is decided already" | same | `manager-decisions-db.test.js` |
| W19 | D-16 keep | **none** (an unticked report stays `sent`) | — | — | `dismiss_stock_report(p_id)` (0122:915): status `dismissed`, logged, pushes `stock.report.decided` to the reporter (0131:149). A direct update is **not** allowed: `stock_reports` has no update policy (0122:863) | `manager-decisions-db.test.js` |
| W20 | D-17 take | `ACT['slide:count']`: `accept_stock_count(p_id)` (0143:48) | 5362–5364 | `stock.correct`; already accepted returns `{already: true}`; a count sent back for a recount 22023 | same | `stock-count-once-db.test.js`, `audit-0143.test.js` |
| W21 | D-17 again | `ACT.recount`: `ask_recount(p_id)` (0115:195): only `where status = 'sent'`, else nothing, no error | 5365–5367 | `stock.correct` | same | `store-round5.test.js` |

### 2e. Returns, voids, cancels (D-18 … D-22)

| W | D | Old call | Line | Checked | New app | Test |
|---|---|---|---|---|---|---|
| W22 | D-18 | `ACT['slide:credit']`: **four calls**: `next_row_id_blocks` (`row:credit_note`), patch {`creditNotes`, `docLog`} (note `{id, no, date, reason, lines[{idx, qty, price, name}], amount, restocked, refund?, askId, by, byName}`), `manager_stock_move(p_shop_id, p_lines, 'reversal', p_note, 'credit_note.raise')` when back on the shelf, `decide_invoice_ask(p_id, 'accepted')`; a log line | 5406–5432 | `credit_note.raise` on `creditNotes` (0175); OWCRN (0169:454) | **`raise_credit_note(p_shop_id, p_order, p_lines [{idx, qty, restock}], p_reason, p_cash_back, p_ask)`** (0176:118), one write | `void-credit-one-write-db.test.js` |
| W23 | D-18, D-19 no | `ACT.askno`: `decide_invoice_ask(p_id, 'declined')` (0122:563) | 5434–5436 | `invoice.void` (void) / `credit_note.raise` (credit) | same | `manager-decisions-db.test.js` |
| W24 | D-19 | `voidAskWrite`: the why (`voidedBy {by, byName, at, why, askId}`, `docLog`) by patch, then **either** `void_with_money(p_shop_id, p_order, p_choice, p_account)` (0169:556, money paid) **or** a direct `saved_quotes.update({voided: true})`; `manager_stock_move` of `_stockTaken` when the why restocks (`VOID_WHY` 5443: twice and cancel yes, wrong customer no); `void_sale_bills(p_shop_id, p_quote_id)`; `decide_invoice_ask`. With money held 10 s (`VM_WAIT`) | 5516–5549, 5561–5570 | `invoice.void` (void guard 0122:217, 0169:502); OWVMN money with no choice | **`void_invoice(p_shop_id, p_order, p_why, p_restock, p_choice, p_account, p_ask)`** (0176:58), one write | `void-credit-one-write-db.test.js` |
| W25 | D-20 | `cxAnswer`: `answer_cancel_ask(p_id, p_yes, p_note: null, p_choice, p_account)` (0181:164); a yes runs `cancel_order` inside | 5663–5683 | `order.cancel`; "That ask is {status} already." 22023 | same; send `p_note` (§5 Q9) | `cancel-ask-db.test.js` |
| W26 | D-21 both real | `ACT.dupkeep`: patch {`dupOkWith`} on the newer order; Undo removes it (3692–3699) | 3666–3671 | none on the database; the phone asks `invoice.void` | same; which task (§5 Q7) | `manager-round3-orders.test.js` |
| W27 | D-21 drop one | `obVoidDup` after a 6 s hold (`OB_VOID_WAIT` 3580; 10 s with money): patch {`cancelledAt`, `voidedBy {…, why: 'duplicate', keeps}`, `docLog`}, then `void_with_money` or a direct `voided: true`. No status, no push | 3606–3630, 3673–3690 | void guard `invoice.void` or `order.cancel` (0122, 0177) | **`cancel_order(p_shop_id, p_order, p_why 'Entered twice', p_choice, p_account)`** (0177:149) (handover M-20) | `cancel-db.test.js` |
| W28 | D-22 | `ACT.agdo`: patch {`items` (qty to `to`, or the line removed), `agentChange` (`lines[].decision, decidedAt`, `state`, `decidedAt`), `agentCancel` (`agreed`, `decidedAt`, `by`), `agentCredit`}; `ACT.agnocancel` patch {`agentCancel {declined, closed, decidedAt, by}`} | 5600–5624 | none of its own (0175 judges `priceReview` only); a void with `agentCancel` passes on `agent.change` (0122:242) | same; an agreed cancel only flags the order (§5 Q8) | `agent-change-order.test.js` |

### 2f. Buying (D-23, D-24)

| W | D | Old call | Line | Checked | New app | Test |
|---|---|---|---|---|---|---|
| W29 | D-23 | `ACT.rshold`: `hold_restock_buy(p_id, p_hold)` (0136:507); Undo = the same call the other way | 5771–5773 | `restock.hold`; OWRST when the line is not planned/held | same | `audit-0136.test.js` |
| W30 | D-24 | `cartonDecide`, held 6 s (`CTN_UNDO_MS` 5706): yes `hold_restock_buy(p_id, false)`, no `refuse_restock_buy(p_id)` (0158:43) | 5728–5748 | `restock.hold`; OWRST | same | `manager-round4-asks.test.js` (reads the code) |

### 2g. Customers and money (D-25 … D-28, D-30)

| W | D | Old call | Line | Checked | New app | Test |
|---|---|---|---|---|---|---|
| W31 | D-25 | `ceWrite`: `customers` update `{name, phone, location, credit_limit, terms_days}` (only what changed); a log line for details; Undo (`ACT.ceundo` 6187) writes the old values the same way | 6139–6156, 6173 | RLS `customer.edit` (0117:92); limit and terms `credit.set` (0122:166) | same | `manager-round3-team.test.js` (reads the code) |
| W32 | D-26 | `laSend`, held 10 s (`LA_HOLD_MS`): `merge_customers(p_shop_id, p_keep, p_drop)` (0169:659); "Not the same" = a `decision_log` line `customer.edit`, `ref.apart` | 6027–6050 | `customer.merge` | same | `manager-round1-db.test.js` |
| W33 | D-6, D-25 | `ceTell`: `tell_customer_change(p_shop_id, p_customer_id, p_to, p_what)` (0158:114), to the salesperson who last sold to them; pushes `customer.changed` | 6158–6162 | `customer.edit` or `credit.set` | same | `manager-round3-team.test.js` |
| W34 | D-27 | `ACT.obsave`: `set_opening_balance(p_shop_id, p_customer_id, p_amount, p_since)` (0148:304) | 6265–6275 | `debt.open` (or admin) | same; §5 Q11 | `fresh-start.test.js` |
| W35 | D-28 | `ACT.prsave`: `next_row_id_blocks` (`row:payment_promise`), insert `payment_promises {shop_id, id, customer_id, promised_on, made_on, amount, note}`, a log line | 6302–6312 | RLS `promise.record` (0121:60) | same | `payment-promises.test.js` |
| W36 | D-30 pay | `slide:pay` after its Undo window: `receive_payment(p_shop_id, p_customer_id, p_amount, p_method, p_picks, p_order_id, p_ref, p_over, p_date, p_label)` (0169:103); the app sends no `p_ref` | 4406–4430 | `payment.receive` (0169:147); OWOVR, OWDEP | same | `manager-round1-db.test.js` |
| W37 | — | "Ask Esther to check": insert `payment_asks` (kind `balance`), queued offline | 3915–3929 | RLS 0130 | same | `manager-round1-money.test.js` |

### 2h. The team (D-29, D-31, D-33)

| W | D | Old call | Line | Checked | New app | Test |
|---|---|---|---|---|---|---|
| W38 | D-29 goal | `ACT.trsave`: `set_person_goal(p_shop_id, p_who, p_aim, p_from, p_to)` (0122:949) per person, this month | 5948–5957 | `goal.set` | same | `manager-decisions-db.test.js` |
| W39 | D-29 limits, hold days | `set_shop_preset(p_shop_id, p_key, p_value)` (0122:277): `orderStageLimits`, `creditHold {days}` | 5953–5954 | per key: `team.limits`, `credit.set` (`defaultMarkup` `markup.set`) | same | `manager-decisions-db.test.js` |
| W40 | D-33 | `ACT.mksave`: `set_product_markup(p_shop_id, p_product_id, p_fields {wholesaleMarkupType, wholesaleMarkupValue})` (0122:357) or `set_shop_preset('defaultMarkup', …)` | 5872–5880 | `markup.set` | same | `manager-decisions-db.test.js` |
| W41 | D-31 give | `ACT.rgo` / `ACT.handover` / `obGive`: packer patch {PACK_KEYS: `assignedWorkerId`, `pickingStatus: 'awaiting_accept'`, `pickingAssignedAt`, picks reset} (`handToPacker` 1973); driver patch {`assignedDeliveryId`, `carrier {kind: 'staff', name, at, by: 'manager'}`} (1982); a trip: `collection_trips` update `{assigned_worker_id, status: 'assigned', assigned_at, accepted_at: null}` (`giveTrip` 2040). Undo `obUngive` 3447 | 3197–3222, 3438–3446 | trips: any member (RLS 0070:65); pushes `order.pick` to the packer (0183:483), `job.given` (0158), `trip.sent` (0183:677) | same | `manager-round3-team.test.js` |
| W42 | D-31 move on | `obMove`: patch {`stageEnteredAt`, `stageLog`, `pickingStatus`, `pickingDoneAt`, `deliveredAt`} with `p_status`; Undo moves it back | 3423–3437, 3525–3557 | the stage's task (0173, 0178); the Checking gate holds a move back (`gateHeldMove`, 0119) | same | `manager-move-rows.test.js` |
| — | D-31 supplier asked | `ACT.oaasked`: patch {`supplierConfirms[s].askedAt`} | 3560–3570 | `order.move` on the phone only | same | no test |
| — | D-31 nudge | **no write**: a WhatsApp link (`SHEET.nudge` 3734, `waComposeUrl` 987), counted in `ow-manager-day` (3764) | 3734–3764 | — | §3 | no test |
| W43 | load | `ow_end_targets(p_shop_id)` (0169:738) at most every 30 min | 1180–1184 | — | drop: it also runs hourly on the server (0169) | `manager-round1-db.test.js` |
| W44 | every log line | `decision_log` insert (§0) | 4472–4480 | `has_task(task)` (0123:647) | §5 Q10 | no test |
| W45 | push | `push_subscriptions` upsert `{shop_id, staff_id, user_id, fcm_token}` on `fcm_token` | 2279 | — | `src/native` (handover N-5 adds `app_build`) | `manager-native-app.test.js` |

D-32 (a limit asked for) has no write: no ask exists (§3). D-30 chase has no write besides W35–W37.

**Count:** 30 reads (R1–R30, R30 new); 45 writes (W1–W45; W17 and W19 new calls) plus three unnumbered patches (D-31 supplier asked, the nudge's none, D-11's none).

---

## 3. What waits on migration 0184

0184 is reserved (decision-rights §5, 12 Nov 2026) and **not written**. Before reading handover §4 as missing, note that **0183 (the Store's, in the repo; the Store app switched on it 12 Nov, `docs/rebuild.md` Log — confirm it is live) already sends four of its pushes**, under its own kinds and words (§5 Q3).

| Handover | Kind | Today | Until 0184, the app |
|---|---|---|---|
| P-1 | `stock.count` | **0183 sends `stock.count.sent`** to `stock.correct` only (0183:826) | routes `stock.count.sent` (and the old function's `stock_count`) to the count |
| P-2 | `stock.count.decided` | **0183 sends `stock.count.decided` and `stock.recount`** to the counter (0183:831, 835) | nothing; the done screen may say "{Musa} is told" |
| P-3 | `pick.settled` | **0183 sends it** to the packer and the salesperson (0183:502, 505) | the done screen may say "{Grace} is told" |
| P-4 | `trip.difference.decided` | **0183 sends it to the checker only** (0183:715), not the trip's runner | says "{Musa} is told", never "{Denis}" |
| — | `store.ask.decided` | 0183 sends the extra's answer to the Store, the Buyer and (kept) Accounts (0183:789–799) | W17 works today |
| P-5 | `order.cancelled` to the Buyer | 0183 tells the yard, a holder without `order.pick` and the salesperson (0183:447–457); not the Buyer | the cancel page drops "{Denis} stops" |
| P-6, P-7 | `invoice.voided`, `credit_note.raised` | only the asker gets `invoice.ask.decided` (0131:132; 0183:886) | the done screen names only the asker (M-7) |
| P-8 | `agent.change.decided` | none | "In the owner's log" only; no "the agent and the buyer are told" (M-8) |
| P-9 | `team.nudge` via `nudge_person(p_shop, p_to, p_order, p_words)` | **no function** (only the task, 0116:51) | the WhatsApp link, as today. decision-rights §3 says "A nudge is a push, no longer only a WhatsApp link": whether the new app may ship with the link is §5 Q13 |
| P-10 | `goal.set` (quiet) | none | the salesperson sees it on their next load |
| P-11 | `markup.wanted` | none | Margins lists items with no markup (R8) |
| P-12 | `credit.limit.ask` + table `customer_asks` | **no table** (Kevin approves it first) | D-32 not possible; the Manager sets limits from the customer (W31) |
| P-13 | `promise.made` (quiet) | none | promises show from R18 on the next load |
| actions | `push_outbox.actions`, `push_subscriptions.app_build`, `answer_from_push(p_outbox_id, p_action, p_key)` | **none** | every push opens its card; every answer is made in the app |
| words | the changed titles and bodies (handover §4 second table) | old words (0120, 0131, 0153, 0156, 0158, 0169) | the app's own screens use §3 words; pushes keep the old until 0184 |
| retire | `order.delivered` to `invoice.make`, the `notify-stock-count` webhook | still sent | route `order.delivered` to Orders' delivered row |

Routes the new app needs today, whatever 0184 does: `order.cancel.ask` (0181:243), `store.extra` (0183:764), `stock.count.sent` (0183:826), `payment.ask.decided` (0130:162), `invoice.held` with its `code` (OWTPC/OWPRC/OWGIV → the price, OWSHP → the short pick, OWSML → the small bill; 0169:833), besides the kinds `pushOpen` routes (2300–2350). Test: `test/phone-push.test.js` `KINDS.manager`.

---

## 4. Two phones, one ask

### 4a. How the old app avoids answering twice

| Path | Guard | Gap |
|---|---|---|
| Order decisions (W1–W14, W26–W28, W41–W42) | re-read the row, `fn` returns `false` when it is no longer open (`lineWaitsPrice`, `status !== 'draft'`, `pickShortfallAckAt` set, `agentChange.state !== 'asked'`) → "that line has changed or been decided already" | **no `p_expect`**: `ow_patch_order` (0165:463) merges whatever arrives. Between the re-read and the write another phone's answer is overwritten, and `items` goes whole, so a Store pick tick written in between is lost. The Store's own path has `p_expect` (`store_patch_order`, OWSTALE 0162:50, 0183:289); the Manager's has none (§5 Q1) |
| Asks with a function | the function locks the row (`for update`) and checks `status = 'sent'` | some refuse, some quietly succeed (below) |
| Held answers (W12, W24, W27, W30, W32, W36) | nothing goes for 6–10 s; a second hold fires the first | a held write is lost if the app is closed before it runs |

| Function | Already answered |
|---|---|
| `answer_cancel_ask` (0181:180), `decide_invoice_ask` (0122:580), `ow_open_ask` in `void_invoice` / `raise_credit_note` (0176:54), `dismiss_stock_report` (0122:927), `write_off_stock` (0161:240) | **refused**: "That ask is {status} already." / "That report is {status} already." / "One of those reports is decided already" |
| `cancel_order` (0177:176), `void_invoice` (0176:80) | refused: "{#0558} is called off already." / "This order is voided already." (22023) |
| `hold_restock_buy` (0136:523), `refuse_restock_buy` (0158:61) | refused OWRST |
| `accept_trip_difference` (0122:731), `accept_stock_count` (0143:70), `answer_store_ask` (0157:92) | **quietly ok**: `{ok: true, already: true}` |
| `ask_recount` (0115:208) | updates nothing, says nothing |

The new app says "Someone else just did this" (the Store's words, `04-screens-store-data.md` §0) for every refusal above and for every `already: true`, and refreshes.

### 4b. Refusals the screens must word

| Code | Raised by | Means | Line |
|---|---|---|---|
| `42501` + "(task)" | every guard and function | this login lacks the task | 0175, 0176, 0177, 0181 … |
| `22023` | functions, on purpose | a plain sentence to show as it is ("Say why it is voided.", "Pick at least one line.") | 0176:77, 0177:172 |
| `P0002` | functions | gone ("This order is no longer in the books.") | 0165:483, 0176:79 |
| `OWCST` | price guard | a typed price under cost: "… can't sell at … — it costs … each. Never below cost." | 0171:96 |
| `OWPRC` | invoice, guard | a price still waits for the Manager | 0119:827, 0171:106 |
| `OWTPC` | invoice | a line has no selling price yet | 0139:145 |
| `OWSHP` | invoice | a short pick is not settled | 0119:824 |
| `OWGIV` | invoice guard | a line at 0 with no "given away" why | 0169:381 |
| `OWSML` | the 24-hour run only | under 1,000: the Manager checks it | 0169:821 |
| `OWWLK` | invoice | a generic name ("Walk-in") would become a debtor | 0139:269 |
| `OWVMN` | void, cancel | money was paid: refund or deposit first | 0169:482, 0177:123 |
| `OWDEP`, `OWOVR`, `OWPAY` | payments, void money | no customer for a deposit; paid over; a payment's receipt wrong | 0165:327–331, 0169:405–443 |
| `OWCRN` | order money guard | credit notes over the bill | 0169:454 |
| `OWSTG` | stage guard | a stage move not allowed (voided, invoiced, from–to) | 0173:86–108, 0178:52–82 |
| `OWRST` | restock | the line has moved on | 0136:523, 0158:61 |
| `OWLOT` | stock guard | stock and its lots disagree | 0169:890 |
| `42501` hint `OWCSH` | money gate | not paid, cash customer (the Store's; the Manager answers it with W8/W9) | 0156:99, 0183:236 |
| `40001` hint `OWSTALE` | `store_patch_order` only | the Manager's path never raises it today | 0162:50 |

---

## 5. Open questions for Kevin

Not decided here. The default is what the new app does until he answers.

| # | Question | Where | Default |
|---|---|---|---|
| Q1 | The Manager's order writes have no stale check (§4a). Add `p_expect` to `ow_patch_order`, or one function per decision (price, credit, short pick), or keep the re-read? | 0165:463; 2027–2038 | keep the re-read; list it for 0184 |
| Q2 | Handover D-9 says `invoice_order(…, p_small_ok)`; no such parameter exists (0119:967). The small-bill check is the phone's (`smallBill` 5153), so any other app bills 567 without a look. Keep it phone-only, or move it into `invoice_order`? | handover §1 D-9; 5153 | phone-only, as today |
| Q3 | 0183 already sends handover P-1…P-4 under other kinds and words: `stock.count.sent` (P-1 says `stock.count`), `stock.count.decided` + `stock.recount` (P-2: one kind, "Count taken" / "Count it again"; 0183: "Ruth accepted your count" / "Ruth asked: count it again"), `trip.difference.decided` to the checker only (P-4: also the runner; 0183: "Ruth decided the 2 pc", P-4: "Ruth took Musa's check-in"). Which kinds and words win; is 0183 live? | 0183:715, 826–835; handover §4 | 0183's kinds; handover's words in 0184 |
| Q4 | A kept extra (Keep it) moves no stock and adds no cost: `answer_store_ask` only sets the status (0157:108); 0183 tells Accounts to pay the supplier. Who puts it on the shelf and in the books? | 0157:84; old/store.html 2486 | answer only; ask Kevin before building |
| Q5 | "On credit" is two writes (the customer's limit, then the order); a lost signal leaves the limit raised and the order held. One function? | 4223–4224 | as today, the order write retried |
| Q6 | "Keep held" (`creditCheck.decision 'hold'`): handover M-14 drops it; 0175's header still names "Hold". Drop? | 4070; 0175:13 | drop (handover) |
| Q7 | "Both are real" (`dupOkWith`) and "Taken twice" are gated on the phone by `invoice.void` (3667, 3681); a cancel is `order.cancel`. Which task gates them? | 3666–3690 | `order.cancel` |
| Q8 | Agreeing to an agent's cancel only sets `agentCancel.agreed` (5605): the order is not cancelled, the Store is not told. Should it go through `cancel_order`? | 5600–5624 | ask; until then as today |
| Q9 | `answer_cancel_ask` takes `p_note`, the app sends `null` (5669); handover's Kept answer shows "{Ruth}: {her words}". Add the words? | 5669; handover §4 | send the words when typed |
| Q10 | Price, credit, short-pick, agent, detail and promise decisions are logged by the phone (W44), after the write; the functions log their own. A lost signal loses the line. Move them to the server? | 4472 | phone, as today |
| Q11 | The opening balance (W34): `docs/rebuild.md` (Sales round 3) lists SAL-020: 0165 and 0169 give two rules for an opening balance. W34 waits on that answer. | rebuild.md Log 12 Nov | as today |
| Q12 | "Ask the Buyer for the cost" writes `costAsked` (4957) and pushes no one. Keep, or make it a push? | 4956 | keep the write; no promise on screen |
| Q13 | The nudge: decision-rights §3 says it is a push; there is no function until 0184 (P-9). Ship the WhatsApp link meanwhile? | 3734–3764 | the link, labelled "WhatsApp" |
| Q14 | The Manager reads the cash book (R13, 35 days), which is Accounts'. Needed for receipts on a debtor only? | 1191 | read only what a debtor's page shows |
| Q15 | The phone keeps the whole books, money included, in `localStorage` (1292). The Store moved to IndexedDB with no money (0164). The new Manager app: IndexedDB, and how much? | 1292–1294 | IndexedDB, orders in play and the queues only |
| Q16 | The cancel page reads a packed order as `status === 'out_for_delivery'` (5643); the stage is `pending_delivery` (handover M-38). Fixed in the new app; noted as old-app code that disagrees with the database. | 5643 | `pending_delivery` |
