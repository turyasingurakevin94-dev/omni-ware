# Sales · Round 1: Data integrity   (brief received 23 Oct 2026, build Fri 23 Oct 2026 21:39 GMT, 955,451 bytes)

Canvas: https://claude.ai/code/artifact/9db8c76a-d77f-4312-a3c1-442d10005ea7, row "Sales round 1 · data integrity" (bottom of the canvas, version 129: paying over redrawn as change or deposit).
Migration: **0165** (the next free number; reserved in `docs/decision-rights.md` in Phase B, with the code).
Read-only checks for the live data: `docs/audit/sales/round-1-check.sql` (9 queries). They ran on a fresh database built from every migration, with the brief's cases seeded; each query found its case.
Do not regress (verified fine in the brief): no fractional or negative order totals; every customer balance equals its own debt log; no duplicate payment entries; no receipts on voided orders; discount clamped to 0..gross; uninvoiced unpriced lines show "to confirm".

The build on main is the same code (`sales.html` has not changed since 20:01); every finding below was re-checked against today's source.

## What was found

| ID | Root cause |
|---|---|
| SAL-010 | Nothing on the server checks that a payment's `cashTxnId` matches its cash row: no constraint, no trigger, no check in the guards (0122/0123/0138). The owner console (`index.html`) saves each table in a separate request and can fall back to a local row id (`localRowId`) when the id block is unavailable, so a payment can point at another device's row. Accounts' payment correction (`accounts.html` `payeditsave`) is about six separate requests. |
| SAL-011 | Customer money lives in three places that are kept in step by hand: `customers.debt`, `customer_debt_log`, and each invoice's `payload.debtCharged`. `receive_payment` (0140/0155) keeps them together, but legacy and other-app paths don't: the console's `reconcileCustomerDebts` rewrites `debt` with no log line on every load; Manager's `lowerDebtFor` is three separate writes; Accounts' correction moves `debtCharged` before `debt`. A payment recorded against the wrong invoice (Eddy: 540,000 on #408, not #390) leaves the balance right and the bills wrong. |
| SAL-007 | `quoteItemSellPrice` (`sx/3_domain.js:160`) returns the cost when a line has no `sellPrice` and no markup rule; the server's `ow_line_sell_price` does the same (`coalesce(s, buy)`, 0119). `ow_invoice_core` refuses unpriced lines (0139), so #541 was invoiced another way (the console's client-side invoice fallback, or before 0139). `nmInvoiceSales` → `goodsTotal` counts it in the goal. |
| SAL-002 | Every app calls `createClient(url, anon)` with no options (sales.html:3058 and the nine other apps), so all apps on one site share one saved sign-in (`sb-<ref>-auth-token`). Sales reads the session once at boot and never compares it again. |
| SAL-005 | New payments: cash over the bill is silently treated as change (`payChange`); mobile money or bank over a customer's debt is recorded as money in while `receive_payment` clamps the debt at 0 (`greatest(0, …)`), so the extra is in the cash book and nowhere else; over an order's balance is refused. `ow_invoice_core` sets `debtCharged := greatest(0, total − amount_paid)`, so an old overpayment disappears there too. The three old ones came from the console's `ip_save`, which has no cap. |
| SAL-012 | `amount_paid` is a column, `payments` is a list in the payload, and nothing keeps them equal. The console's `ip_save` allows any past date (hence 1 Aug on a 26 Aug order). |
| SAL-013 | A whole-payload rewrite lands between `receive_payment`'s two changes: it puts back an older payload without the new payment, while `amount_paid` stays raised. Sales itself does this in four places (`sx/5b_orders.js:343`, `:596`, `sx/8_pay.js:347`, `sx/9c_counter.js:440`: read the payload, write it all back); so do Manager (`changeOrder`, `obMove`, `lowerDebtFor`, void), Buyer (`changeOrder`) and Accounts (`invoiceSends`). The console's till sale (`tillCommitSale`) sets `amountPaid` with no payment entry at all. #484 (240,000 paid, no payments, receipt 22096 names it) is one of these. |
| SAL-014 | `moneyIn()` (`sx/5a_today.js:22`) takes every `type = 'receipt'`. A transfer between accounts is a `receipt` on the target account with `category = 'Account Transfer'` and a `transfer_id`. |
| SAL-006 | `addLine`, `setLineQty` and the totals take any number; the database has no check on `payload.items`. The price field already accepts digits only (`ACT['in:nwpv']`). A 0 line is legitimate after the Manager's "bill what went" short pick (`lineSettledOut`), so 0 must stay possible for the books but never be typed. |
| SAL-003 | `goodsTotal` multiplies without rounding each line; the server rounds only the order total. |
| SAL-004 | `quoteTotal` subtracts credit notes with no floor; nothing caps a credit note at the bill. |
| SAL-008 | `getFIFOUnitCost` (`sx/3_domain.js:80`) returns the first open lot's cost, whatever the quantity. |
| SAL-009 | `n0` rounds −0.4 to −0, and `(-0).toLocaleString()` is "-0". |

## Design changes (canvas)

All boards are drawn at 360 px. Sales has no laptop layout: at 1280 the app is the same 404 px column, centred (checked in the harness). The 1280 board is drawn where width matters: the signed-in-elsewhere notice, because that problem happens in a laptop browser.

| ID | Board(s) | Before → After | States drawn | Tokens/components used | New component? |
|---|---|---|---|---|---|
| SAL-002 | `R1SignedElsewhere`, `R1SignedElsewhere1280` | Before: another app's sign-in turns Sales into that login's empty shop, silently. After: a sheet, "Signed in as someone else", shows both logins (this screen: Grace Akello · Sales; signed in now: the other email), says nothing is saved until Sales signs in again, and offers "Sign in again as Sales" (email filled in) or "Sign out". | before, notice, sending, error (wrong password), offline, success | sheet, face, list rows, red primary, ghost button, sign-in screen | No (the "who" rows reuse the list row) |
| SAL-005 (new payments) | `R1PayOver` | Before: 470,000 by mobile money on 420,000 owed; "their balance stops at 0" and 50,000 goes nowhere. After: the owed bar runs past its end in amber stripes; a card "50,000 more than Kato owes" with two choices, **Give 50,000 change** (chosen by default) and **Keep 50,000 as a deposit** (the customer confirms; their next bill uses it). The slide names the choice: "Slide to record 420,000 · 50,000 back" or "… 470,000 · 50,000 deposit". Paid shows "Owes now 0" and "Deposit 50,000". A walk-in can't keep a deposit until named ("Name them first"). | before, change (default), deposit, sending (choice locked), success, walk-in, offline, error | pay sheet, owed bar, radio cards, slide, Paid | No (radio card = the pay page's existing option rows) |
| SAL-005 (the three old ones) | `R1OldOver` | Before: #264 says PAID; the extra 25,000 is shown nowhere. After: the paper adds a "Paid over 25,000" row, and a card "25,000 not given back, not a deposit · Esther settles it: a deposit if Sadat confirms, else change" with "Ask Esther to settle it"; once sent, "Asked Esther · 25,000 over · waiting". | before, after, sent | receipt paper, ask row (as `XPay` / `CustResolve`) | No |
| SAL-007, SAL-006 (0 line) | `R1ToPrice` | Before: #0541's 7 unpriced lines are billed at cost; "NOT PAID · 705,000 TO PAY". After: the 7 read "to price" under "7 lines to price · Ruth"; the 0-count Glass Door Locks line is struck through, "not on the bill"; "Priced so far 1,021,330 · Paid 1,021,330 · Owed now 0"; "The total grows when Ruth prices them". Today: "Invoiced · October" drops by 705,000 and a chip names the order with lines to price. | order before/after, Today before/after | receipt paper, plum "to price" group, hero chip | No |
| SAL-011 | `R1AddsUp` | Before: Ken Bwaise "Owes 685,000" over four open bills that add up to 1,034,000, with no word. After, until corrected: "Doesn't add up · Accounts checks it" in the head; a card with two bars (his balance 685,000, his open bills 1,034,000), "349,000 apart", "Payments still go on the bills, oldest first", "Ask Esther to check". Sent: "Asked Esther · today 21:40". Corrected: one figure, "= the 4 open bills". | before, apart, sent, corrected | customer head, comparison bars, bills card | No |
| SAL-006 | `R1QtyZero` | A count typed as 0: the field rings red, "At least 1 · or remove the line", Done is disabled, Remove is beside it; removing gives Undo for 10 s (as the glossary says). | 0, normal, removed | line sheet, Undo toast | No |
| SAL-003, -004, -008, -009, -010, -012, -013, -014 | — | Logic or server only. Their only visible effect is a correct figure. | — | — | — |

## Code changes planned

Severity: High = P1, Medium = P2, Low = P3. All in `sx/*.js` (assembled into `sales.html`).

| ID | Sev | File / function | Change (one line) | UI? | Acceptance check |
|---|---|---|---|---|---|
| SAL-010 | P1 | none in Sales (it already writes money only through `receive_payment` / `counter_sale`) | The fix is server-side (0165). Sales shows the rare refusal in the existing "Not recorded" bar. | no | Test: a payment whose cash row disagrees is refused by the database. |
| SAL-011 | P1 | `sx/6_customers.js`: new `custAddsUp(c)` (balance vs opening + open bills), the `R1AddsUp` card and head band; "Ask Esther to check" through `payment_asks` (`what: 'balance'`) | Never two disagreeing figures without saying so. | yes | Ken's page in the harness shows the card; a customer whose figures agree shows nothing new. |
| SAL-007 | P1 | `sx/3_domain.js`: `quoteItemSellPrice` returns `null` (never cost) when there is no price and no rule; `goodsTotal`, `quoteTotal`, `balanceDue`, `orderDue` count priced lines only, for invoiced orders too; `sx/5b_orders.js` the "to price" group on the paper; `sx/5c_numbers.js` `nmInvoiceSales` priced value only; `sx/5a_today.js` the goal chip | Never fall back to cost; the goal counts priced value. | yes | #541 shows 7 lines to price and owes 0; the goal drops by 705,000. Every caller of `quoteItemSellPrice` checked for `null`. |
| SAL-002 | P1 | `sx/1_core.js`: `createClient(url, anon, { auth: { storageKey: 'ow-sales-auth' } })`, carrying the old shared session over once if it is a Sales login of this shop; `sx/4_shell.js`: `owWatchLogin()` on `onAuthStateChange`, `visibilitychange` and `focus` compares the session's user with `S.user`; on a difference, `S.loginLost` blocks every write (one check in the slide handler and in `payRpc`/`sb.rpc` wrappers) and shows the `R1SignedElsewhere` sheet | Sales keeps its own sign-in; a swap is caught and nothing is written. | yes | App A as role 1, app B as role 2, back to A: the notice, and no write lands as role 2 (harness with two stub users). |
| SAL-005 | P2 | `sx/8_pay.js`: `payView` keeps `over`; new `a.over` ('change' by default, or 'deposit' when the customer confirms; a walk-in must be named first); the card, the slide label and Paid's "Deposit"; `payRpc` sends `p_over`; `sx/5b_orders.js` the "Paid over" row and the ask (`what: 'over'`) | Ask every time; record the answer. | yes | The three old orders show their overpayment; a new overpayment can't be recorded without a choice. |
| SAL-012 | P2 | none in Sales | Server-side (0165) and the data correction. | no | Query 2 lists 0 orders. |
| SAL-013 | P3 | `sx/5b_orders.js:343`, `:596`, `sx/8_pay.js:347`, `sx/9c_counter.js:440`: the four read-then-rewrite updates call `ow_patch_order` with only the keys they change | Sales never writes back a stale payload. | no | Test: the four call sites send a patch, never the whole payload. |
| SAL-014 | P2 | `sx/5a_today.js`: `moneyIn()` skips `category === 'Account Transfer'` and rows with a `transferId`; `rowToTxn` carries both | Transfers are never money in. | no | October collected excludes the two 1,000 moves. |
| SAL-006 | P2 | `sx/7_neworder.js`: `addLine`, `setLineQty`, `makeLine` refuse qty ≤ 0; the line sheet's 0 state (`R1QtyZero`); `sx/3_domain.js`: a line with qty ≤ 0 is off the bill everywhere (`lineSettledOut` widened) | qty > 0 when typed, ≥ 0 in the books. | yes | qty −3 and price −500 can't reach a total; #541's 0 line is struck through. |
| SAL-003 | P3 | `sx/3_domain.js`: each line total `Math.round(qty × price)` before summing | Whole UGX at every step. | no | 1.5×333 + 1,001 + 2.5% + 999.6 → a whole number, the same as the server. |
| SAL-004 | P3 | `sx/3_domain.js`: `quoteTotal` floors at 0 | A credit note never makes a bill negative. | no | The −5,000 case shows 0. |
| SAL-008 | P3 | `sx/3_domain.js`: `getFIFOUnitCost(pid, vi, qty)` weights the lots the quantity uses, oldest first; callers pass the line's qty | The cost floor matches what the stock really cost. | no | 5 from 3 @ 1,000 + 10 @ 1,200 = 5,400 (1,080 each). |
| SAL-009 | P3 | `sx/1_core.js`: `n0` turns −0 into 0 | Never "-0". | no | `n0(-0.4)` is "0". |

## Server / SQL changes planned

One migration, **0165** (Sales round 1), safe to run twice, with a ROLLBACK block and a CHECK AFTERWARDS block, like 0156.

| ID | Migration / function / policy | Change | Test |
|---|---|---|---|
| SAL-010, SAL-012 | trigger `saved_quotes_money_check` (before insert or update) | Refuses: a payment with amount ≤ 0; a payment whose `cashTxnId` names a cash row with another amount, another order, or that is not a receipt; `amount_paid` ≠ the sum of `payments` (only when either changes, so old rows can still be corrected). A payment with no `cashTxnId` is allowed only as agent credit (`creditFrom`) or from a deposit (`fromDeposit`). | `test/sales-round1-db.test.js`, as the owner, Accounts, Manager and Sales: each wrong write refused, each right one through. |
| SAL-010 | trigger `cash_txns_payment_check` (before update) | A receipt that a payment points to can't change its amount, order or type on its own. | Same test. |
| SAL-010, SAL-012 | new `ow_correct_payment(p_shop, p_order, p_payment_id, p_amount, p_date, p_account, p_move_to)` | One transaction for Accounts' payment correction (amount, day, method, or move to another bill / to a deposit): the payment, the cash row, `amount_paid`, `debtCharged`, the debt and its log, together. | Same test, as Accounts. |
| SAL-013 | new `ow_patch_order(p_shop, p_id, p_patch jsonb)` | Merges only the keys it is given (`client`, `items`, `customerId`) under a row lock, never `payments`, `debtCharged`, `creditNotes` or `amount_paid`. | Same test: a payment added between a read and a patch survives. |
| SAL-005 | `receive_payment`: new `p_over text` ('change' / 'deposit') | Over an order's balance or a customer's debt, it refuses without `p_over`. With 'change', only what is owed is money in. With 'deposit', all of it is money in and the extra is the customer's deposit (needs a customer). | Same test: 470,000 on 420,000 both ways; no `p_over` refused. |
| SAL-005, SAL-011 | a deposit = a balance below 0 | `receive_payment` and `ow_invoice_core` stop clamping at 0. `ow_invoice_core` uses a deposit first, as a payment `{fromDeposit: true}`. | Same test: an invoice after a 50,000 deposit opens 50,000 paid. |
| SAL-007 | `ow_line_sell_price`, `ow_order_total`, `ow_invoice_due_orders` | No price and no rule → no price (null), never cost; the hourly invoice skips an order with lines to price and leaves it for the Manager. | Same test: #541's shape totals 1,021,330; an order with a line to price is not auto-invoiced. |
| SAL-006 | `saved_quotes_money_check` | Every line: qty ≥ 0, `price` ≥ 0, `sellPrice` null or ≥ 0. | Same test. |
| SAL-003 | `ow_order_total` | Rounds each line to whole UGX before summing, as the app does. | Same test: the brief's 2,538.5 case. |
| SAL-004 | `saved_quotes_money_check` | Credit notes add up to no more than the bill. | Same test. |
| SAL-005, SAL-011 | `payment_asks` | `what` adds `'over'` and `'balance'`; `cash_txn_id` may be null for `'balance'`. | Same test, as Sales. |
| SAL-011 | view `ow_balance_check` (owner, Manager and Accounts read it) | Query 5 as a view: books vs opening + open invoices, one row per customer that doesn't add up. | Same test: 0 rows after the scenario. |
| SAL-002 | none | Sign-in is per app in the browser; nothing on the server. | — |

**Cross-app, needed in this round** (the checks above would otherwise refuse their writes):
- `accounts.html`: `payeditsave` calls `ow_correct_payment` (same screen, one call), and the "Asks" list shows the two new kinds ("paid over", "balance").
- `index.html` (owner console): the cash-row edit and `ip_save` go through `ow_correct_payment` / `receive_payment`; the client-side invoice fallback is removed.
- `manager.html`, `buyer.html`: `changeOrder` and the other whole-payload writes call `ow_patch_order`.

## Data corrections (need Kevin's approval; nothing runs without it)

Run `docs/audit/sales/round-1-check.sql` on live first: it lists every case, not only the brief's. In Phase B I'll write one correction script from what the queries return. It runs once, as the owner, writes a line per change to the owner's log, and has a CHECK AFTERWARDS block (queries 1–5 return 0 rows).

| Case | What the data says | Proposed fix |
|---|---|---|
| #446 Baker (SAL-010) | 5,000 on 5 Oct points at cash 20166 ("Payment — Mulongo", 871,500, no order). | Look for a 5,000 receipt on 5 Oct for Baker / #446. If found, relink to it. If not, the 5,000 has no cash behind it: Accounts records it (if it was paid) or it is taken off the order (if it wasn't). **Kevin says which.** |
| #226 Jackson (SAL-012) | Payments add up to 6,200,000 on 4,600,000; the extra 1,600,000 is dated 1 Aug (cash 15544), before the order. | If cash 15544 belongs to another order, move it there; if it is a second copy of a real payment, take it off. **Kevin confirms.** |
| #484 Kadomola (SAL-013) | `amount_paid` 240,000, no payments; receipt 22096 (9 Oct, 240,000) names the order. | Add the payment entry linked to 22096. |
| #264, #301, #360 (SAL-005) | 25,000 + 10,000 + 15,000 paid over. | Esther settles each (Kevin's answer 2): a deposit if the customer confirms it, otherwise change given back (a cash payment out). |
| C953 Eddy (SAL-011) | Balance 0; #390 shows 540,000 due; his 540,000 (16 Oct) sits on #408. | Move the payment from #408 to #390, if #408 is otherwise paid. |
| C1005 Ken Bwaise | 685,000 vs 1,034,000 open (#321 #342 #413 #423). | If 349,000 of his payments sit unlinked to any bill, put them on the oldest bills; otherwise the bills are right and the balance is raised to 1,034,000. |
| C979 Hajat @Faluk | 19,000 vs #344 280,000. | The same check as Ken. |
| C110 Sadat | 290,000 vs 0 open. | If it is an old-book balance, it stays as his opening balance (no change); if a bill was paid without lowering the balance, lower it. |
| C114 Ssendawula Sam | 20,000 vs 0 open. | The same as Sadat. |
| C925 Ambrose FEKO | 255,000 vs 85,000; three 85,000 charges on 28–29 Sep. | If two are copies, remove them (balance 85,000). **Kevin confirms.** |

## Glossary changes

| Term | Meaning | Replaces |
|---|---|---|
| Deposit | Money a customer paid ahead, kept because they confirmed it; no bill has used it yet. Their next bill uses it first. Shown as "Deposit 50,000" (green), never as a negative balance. | "credit" or "on account" for this meaning (credit stays the Manager's buy-now-pay-later) |
| Paid over | Paid more than the bill, before anyone has settled it (change, or a deposit if the customer confirms) | — |
| To price | A line with no selling price yet; nothing is owed on it until the Manager prices it | billing it "at cost" |
| Doesn't add up | A customer's balance and their open bills disagree; Accounts checks it | two figures with no word |
| Signed in as someone else | Another sign-in replaced this app's; nothing is saved until the app's own login signs in again | — |

## Not changing / pushed back

| ID | Why |
|---|---|
| SAL-001 | Not reproduced (empty catalogue). Most likely the sign-in swap of SAL-002, which this round fixes. |
| SAL-011 "one source of truth" | This round makes every money write one transaction, adds the checks, and shows a gap when there is one. Making the balance a figure the database computes (instead of a stored one) changes every app at once; proposed for a later round, after the corrections. **Kevin decides.** |
| SAL-007 "an order with unpriced lines can't be invoiced" | Already true on the server since 0139 (`ow_invoice_core` refuses). This round closes the console's client-side way round it and the hourly job skips such orders. |
| The Manager pricing #541's 7 lines | The Manager app has to list invoiced orders with lines to price. That is the Manager's screen, not Sales': it goes to the next Manager round (Sales shows "Ruth prices them" until then). |
| The other apps' shared sign-in | Sales gets its own sign-in now; the other apps still share theirs until their own rounds. |

## Risks

- **Old phones.** A Sales phone still on the last build that pays over an order or a debt is refused by 0165 ("Say: change or deposit") until it updates. Nothing is recorded wrongly.
- **Other apps' writes refused.** Until the cross-app changes above land in the same deploy, an Accounts payment correction or a console cash edit would be refused. They ship together.
- **A negative balance in other apps.** Owner, Manager and Accounts may show "-50,000" where Sales shows "Deposit 50,000". Part of the cross-app list.
- **Everyone signs in to Sales once more** after the new sign-in key, unless their old session is a Sales login of the shop (carried over).

## Questions for Kevin (answered 23 Oct 2026)

1. **Payments dated before their order: deposits?** *"Make it a choice one makes when they are receiving that extra payment."* Money beyond what is owed is never assumed: the person taking it chooses, there and then (the `R1PayOver` card). The 13 old early payments stay on their orders and are labelled "Deposit" in the payment list; query 9 is a list, not a fault list.
2. **On account?** *"An overpayment should be confirmed as deposit first, otherwise return change."* So the word is **Deposit**, not "on account", and change is the default. A deposit is kept only when the customer confirms it (a walk-in must be named first). The boards were redrawn to say so (canvas v129).
3. **Cross-app in this round:** yes. `accounts.html`, `index.html`, `manager.html` and `buyer.html` change as listed.
4. **The data corrections:** approved. The correction script is written in Phase B from what the check queries return on live, and runs once as the owner with a line per change in the owner's log.
5. **One source of truth:** yes. The stored balance is kept by the server now; a computed balance comes in a later round.

## Phase B result (filled after implementing)

| ID | Done? | What changed | How verified |
|---|---|---|---|
