# 02 · Money

What this covers: every money rule the shop runs on (writing money, an order's totals, prices, cost, customers' debt, payments, the treasurer's books), each with its formula, where it lives today, and the test that proves it.
Date: 2026-10-28
Status: reviewed — Kevin's decisions are in §8

---

## 0. How to read this chapter

**Where the rules live today.** Every rule below exists in up to four places. The rebuild keeps one.

| Place | What it is | Lines |
|---|---|---|
| **Server** | SQL in `supabase/migrations/`. Wins over every app: it refuses or rewrites a bad write. | `0119` (prices, totals), `0165` + `0169` (money holds together), `0109`, `0139`, `0140`, `0141`, `0154`, `0156`, `0167` |
| **Phone money block** | One block written in `sales.html` and copied **word for word** into Manager, Accounts and Owner. | `sales.html:4281-4600`, `manager.html:1323-1482`, `accounts.html:1075-1165`, `owner.html:967-1044` |
| **Console** | `index.html`, the original rules. | spread across `index.html` |
| **`CONSOLE_BOOKS`** | The console's report rules, carried whole into a sealed scope. Used for P&L, balance sheet, cash flow, loans, assets, payroll. | `accounts.html:4091-5505`, `owner.html:1813-3225` |

> **Two rules in one app.** Accounts and Owner hold *both* the phone money block *and* `CONSOLE_BOOKS`. So in Accounts the customer screens total an order one way (`quoteTotal`) and the P&L another (`savedQuoteTotal`, the console's). See Q1–Q2.

**"Majority"** = the version most role apps use. **"Server"** = what the database enforces. Where they differ, it is listed in [§8 Open questions](#8-open-questions-for-kevin).

**Tests.** `test/*.test.js`. The "word for word" tests (`manager-app.test.js:56-65`, `accounts-app.test.js:254`) fail if the Manager's or Accounts' copy drifts from Sales'. **No test checks `owner.html`'s copy of the phone money block** (`owner-app.test.js` only checks one `CONSOLE_BOOKS` figure). That is why Owner has drifted. SQL tests (`*-db.test.js`, `audit-01xx.test.js`) only read the SQL text, unless `OW_PG` names a real database.

---

## 1. Writing money

| Rule | Formula | Where | Test |
|---|---|---|---|
| **Whole shillings on screen** (`n0`). This is what the phone apps really use: about 1,200 calls. | `Math.round(Number(n)\|\|0).toLocaleString('en-US')`. Sales adds `\|\|0` to stop `-0`. | `sales.html:3644`. Same body in buyer 566, store 863, manager 950, accounts 806, owner 712, sourcing 739 | `sales-app`, `manager-round1-money`, `store-round4`, `store-round6` |
| **`fmtUGX`**: amount plus currency | see the table below | 7 copies | No test pins the phone format. Index tests stub it. |
| **Short form** (`short`): 1.2M, 45k | n ≥ 1e6 → M; n ≥ 1e4 → k; else `n0` | `sales.html:3647` (5 versions: buyer/accounts add a space `' M'`, manager always uses 2 decimals and `'K'`, sourcing uses `k` from 1,000) | none directly |
| **Server writes money** (pushes) | `to_char(round(n), 'FM999,999,999,990')` | `0120_push_for_every_app.sql:172` `ow_money` | none |
| **Every cash line is whole shillings** | trigger rounds `cash_txns.amount` | `0169:858` `cash_txns_round_amount` | `manager-round1-db` |
| **Order lines whole shillings** | each line is `round(qty × price)` before adding (see §2) | `0165:73` | `sales-app` (SAL-003) |

`fmtUGX` today:

| Version | Output for 1000 / null / 1000.5 | Files |
|---|---|---|
| A | `1,000 UGX` / `0 UGX` / `1,000.5 UGX` (no rounding; `undefined` → `NaN UGX`) | buyer 607, store 903, manager 991, accounts 837, owner 737 (only called in buyer) |
| B | `UGX 1,000` / `UGX 0` / `UGX 1,001` | agent 4672 |
| C | `1,000 UGX` / *blank* / `1,000.5 UGX` | index 46808 |

**Rule for the rebuild (suggested):** one `money.js` writer: round to whole UGX, commas, `UGX` after, blank for empty (see Q3).

---

## 2. An order's totals

All read `saved_quotes.payload`: `items[]`, `charges[]`, `discount`, `credit {pct, days}`, `creditNotes[]`, plus the `amount_paid` column.

```
line price      = quoteItemSellPrice(it)                     (§3)
to confirm?     = linePriceToConfirm(it)                     no shop price yet → left out of every total
goods           = Σ over priced lines: round(max(0,qty) × max(0,line price))
charge          = percent: round(goods × v/100)  |  fixed: round(v)  |  v ≤ 0 → 0
charges         = Σ charge
gross           = goods + charges
cash total      = gross − min(max(0, discount), gross)
credit charge   = credit.pct > 0 ? round(cash total × pct/100) : 0
credited        = Σ amount of credit notes not voided
quote total     = max(0, cash total + credit charge − credited)
balance due     = max(0, quote total − amount_paid)
```

| Rule | Majority (phone money block) | Server | Tests |
|---|---|---|---|
| `linePriceToConfirm`: priced if `sellPrice > 0`, else needs a cost (`price > 0`) **and** a markup rule (`lineHasRule`) | `sales.html:4392`, `lineHasRule` 4385 (Sales = Manager = Accounts) | `0119:386` `ow_line_to_confirm`; `0169:322` adds "`sellPrice` 0 with `givenAway.why` is priced (at 0)" | `sales-app`, `manager-app`, `accounts-app`, `sales-round1-db` |
| `goodsTotal` | `sales.html:4566`: skips lines still to confirm, rounds each line | `0165:73` `ow_order_total`: same | `sales-app` (SAL-003, SAL-006), `manager-app`, `accounts-app` |
| `chargeAmount` / `chargesTotal` | `sales.html:4577-4578` | `0165:73` (same) | `manager-app`, `quote-totals`, 27 console tests |
| `cashTotal` | `sales.html:4579` | same, but the server also rounds the discount | `manager-app`, `quote-totals` |
| `creditTerms` / `creditCharge` | `sales.html:4580-4581` | same (`payload.credit.pct`) | `quote-totals`, `credit-terms`, `client-order-total` |
| **Credit notes** reduce the total; can't exceed the bill | in `quoteTotal` | `0165` money check refuses credit notes above the bill (`saved_quotes_zz_money_check`) | `sales-app` (SAL-004), `sales-round1-db` |
| `quoteTotal`: never below 0 | `sales.html:4582` | `0165:73`: `greatest(0, …)` | `sales-app`, `manager-app`, `manager-decide` |
| `balanceDue` | `sales.html:4594` (all 4 copies the same) | `0169:285` debt sync uses `max(0, round(total) − round(paid))` | `accounts-app`, `manager-app` |
| **Amount paid** = Σ `payload.payments[].amount`; each payment has its own receipt row in `cash_txns` with the same amount and order | written only by server functions (§6) | `0165` / `0169` `saved_quotes_zz_money_check` refuses anything else | `sales-round1-db`, `manager-round1-db` |
| `pricedView` / Manager `orderTotal`: the total of the priced lines only, plus a count of lines to confirm | `sales.html:4569`, `manager.html:1617` | `ow_order_total(…, p_known_only)` (now always known-only) | `sales-app`, `manager-app` |
| **Agent order total** (what the shop is owed) | edge function `agent-change-order/index.ts:69`: Σ sellPrice×qty **+ charges** | `0109:61` `order_shop_total`: Σ sellPrice×qty, **no charges** | `agent-change-order`, `money-write-guards` (no test of `order_shop_total`) |
| **Customer portal total** | `supabase/functions/client-portal/index.ts:241` `orderTotal` | — | `client-order-total` (checks it against the console; discount together with credit is not tested) |

**The console's own copy** (`index.html` `savedQuoteGoodsTotal` 63664, `savedQuoteCashTotal` 63823, `orderCreditCharge` 63832, `savedQuoteTotal` 63895, `invoiceBalanceDue` 65486) is the **0119** rule: it counts every line (a line with no rule at its cost), does not round lines, and can go below 0. `CONSOLE_BOOKS` in Accounts and Owner carries this copy (Q1). Tests: `quote-totals`, 55 `admin-*` tests.

**Who writes a price on a line:** `sellPrice` (typed), else the shop's price from the markup. A line's price can never be below 0, and a count can never be below 0 (`0165` money check, OWQTY). An invoiced line at 0 must carry `givenAway {why, by, at}` (`0169`).

---

## 3. Prices

### 3.1 The supplier's price row (`prices` table)

A row holds `retail`, `wholesale` (a pack's price, per unit), `packQty`, and `tiers[] {minQty, price}`.

```
tiers for retail    = tiers with packQty = 0 or minQty < packQty
tiers for wholesale = tiers with packQty > 0 and minQty ≥ packQty
tieredUnitPrice     = the price of the highest tier whose minQty ≤ qty, else the base column
purchasePriceAtQty  = natural side (qty ≥ packQty > 0 → wholesale, else retail);
                      if that side has no figure, the other side
```

| Rule | Majority | Server | Others | Tests |
|---|---|---|---|---|
| `tiersForKind` / `tieredUnitPrice` | `sales.html:4300-4301` (buyer 930/933, manager, accounts, owner) | `0119:275` `ow_tiered_unit_price` | index 59382/59388: **same behaviour**, only names differ | 38 tests incl. `admin-sell-price`, `agent-catalog` |
| `purchasePriceAtQty` | `sales.html:4310` | `0119:309` `ow_purchase_side` | index 59627: same | 31 tests |
| `productPriceRows`: a product's rows (per variant) | `sales.html:4289` (from the `IX()` index, variant read as a number) | `0119:327` `ow_line_row` (variant read as a number, oldest row first) | buyer 919 and index 55572 filter by strict `===` on `variantIdx`; index adds `sname`. Same rows unless a variant index is stored as text. | 40 tests |
| `rankedPriceRows`: rows in stock, cheapest wholesale, then cheapest retail | `sales.html:4291` (buyer 921, manager 1327) | — | index 59359: same | 38 tests |

### 3.2 Markup and the shop's price

```
markup rule (effectiveMarkupRule), first found with value > 0:
   variant's <kind>Markup  →  product's <kind>Markup  →  shop default (presets.defaultMarkup)
stock line (supplierId '__stock__') first tries stock<Kind>Markup on the variant, then the product
   (effectiveStockMarkupRule), then falls back to the rule above
side (sellSideFor): the side the supplier row priced at this qty; else natural side;
   if natural side has no rule and the other has, the other
applyRule: fixed  → cost + value   (wholesale with packQty: cost + value / packQty)
           percent→ cost × (1 + value/100)
shop's price (shopSellPrice) = round(applyRule(...)) — null with no cost or no rule
```

| Rule | Majority | Server | Others | Tests |
|---|---|---|---|---|
| `effectiveMarkupRule` | `sales.html:4340` (reads `D().presetDefaultMarkup`) | `0119:223` `ow_markup_rule` | sourcing 1259 reads `D().presets.defaultMarkup`; index 60256 `data.presetDefaultMarkup`. **Same behaviour**, different data shape. | 25 tests; no test on `ow_markup_rule` |
| `effectiveStockMarkupRule` | `sales.html:4352` | inside `ow_markup_rule(p_from_stock)` | index 60278: same | 18 tests |
| `sellSideFor` / `applyRule` | `sales.html:4325`, `4361` | `0119:338` `ow_sell_side`, `0119:263` `ow_apply_rule` | index 59651 / `suggestedSellingPrice` 117150: same maths | `admin-sell-price`, `manager-app`, `invoice-lines` |
| `quoteItemSellPrice`: `sellPrice` if typed; else the shop's price; **no product or no rule → 0** | `sales.html:4367` (manager 1403, accounts 1130) | `0119:359` `ow_line_sell_price` falls back to **cost**, but `0165` leaves those lines out of every total, so totals agree | owner 1022 and index 60005 fall back to **cost** (Q4) | `sales-app:153-167` (matches the console on priced lines), 57 tests |
| `shopSellPrice`, `lineCost` (cost = `it.price` if > 0) | `sales.html:4406-4407`, manager 4473-4474 | — | — | `sales-app`, `manager-decide`, `manager-round1-money` |
| `shopCreditPct`: the shop's default credit % (`presets.creditPct`, > 0 else 0) | `sales.html:4599`, manager 1482 | — | index 63801: same | `credit-terms`, `manager-policies` |

### 3.3 Who decides a price: "no sale below cost"

From `docs/decision-rights.md` § "The price decision":

```
below cost  → refused, always
cost ≤ price < shop's price → Sales proposes; the order waits in Checking for the Manager (price.approve)
price ≥ shop's price        → Sales decides, no wait
```

| Rule | Where | Server? | Tests |
|---|---|---|---|
| Sales can't type below cost (`priceTooLow`: `v < cost`) | `sales.html:4428` | **yes** (`0171`): a price a person types above 0 and under the line's cost is refused (OWCST), judged only when the price is new (new line, or a new figure on the same line, by `lineId`); writes with no login are judged at the bill | `sales-app`, `no-sale-below-cost-db` |
| Manager's Set price: floor is cost; at cost asks a second yes (`priceChip`) | `manager.html:4534` | the floor: **yes** (`0171`, as above) | `no-sale-below-cost-db` (the floor); the second yes: **no test** |
| Only `price.approve` writes `items[].priceReview` | — | `0119:539` guard (42501) | `shared-foundation-db` |
| An order leaves Checking only when no price waits (`ow_line_waits_price`) and credit doesn't hold it | — | `0119:452`, `0167:46` `ow_gate_reason` | `shared-foundation-db`, `audit-0136` |
| A line that comes to sell under cost (Buyer took a higher price) pushes the Manager | `lineBelowCost` `sales.html:4477`, manager 4482 | `0153:39` `ow_line_under_cost` pushes; the write is **not** refused (the cost moved, not the price); the gate does not hold it (journey Q1) | `sales-app`, `manager-round1-orders`, `no-sale-below-cost-db` (the write is kept) |
| A line selling under its cost is never billed, whoever invoices; a 0 or a line given away is `0169`'s (OWGIV) | — | `0171` `ow_line_sells_under_cost`, `saved_quotes_zz_cost_floor` (OWPRC: the hourly run sends it to `price.approve`) | `no-sale-below-cost-db` |
| A line with no shop price is never billed at cost | — | `0139:70` `ow_order_unpriced` → `ow_invoice_core` refuses (OWTPC) | `invoice-unpriced-db` |

---

## 4. Cost and margin

| Rule | Formula | Where | Tests |
|---|---|---|---|
| **Stock lots**: each stock key (`productId` or `productId::variantIdx`, `stockKey`) holds lots `{qty, cost, consign}`, oldest first | lots must add up to the stock at commit (OWLOT) | `0119:675` `ow_stock_move`; `0169` `ow_lots_add_up`; `0109` `replace_stock_lots` | `shared-foundation-db`, `admin-stock-lots`, `manager-round1-db` |
| **FIFO take on invoice**: a stock line takes the oldest lots first and records them on the line as `_stockTaken`, `_stockLots` | server is the truth | `0139:160-173` inside `ow_invoice_core` | `invoice-unpriced-db`, `shared-foundation-db` |
| **Cost of a sold line** (`invoiceLineCost`): bought-in = qty × price; from stock = lots' weighted cost, the rest at line price; units with no cost are flagged "estimated", never free | | `index.html:79107` (also in `CONSOLE_BOOKS`) | `accounting-basis` + 18 |
| **Expected unit cost before the sale** (`getFIFOUnitCost`) | Sales: weighted over the lots that `qty` would take; past the last lot, at the last lot's cost | `sales.html:4281` | `sales-app` (SAL-008) |
| | Buyer / Manager / console: **first open lot's cost** only (Q5) | buyer 917, manager 1323, index 112586 | `admin-stock-lots`, `consignment`, 21 tests (console) |
| **A counted surplus** takes the last known cost, never null | newest lot → newest restock/correction cost → lowest list price | `0143:38` `ow_last_known_cost` | `audit-0143` |
| **Margin** | `(price − cost) / price`; green ≥ 10 %, amber ≥ 5 %, red below | `manager.html:4521-4523` `marginOf`, `marginCol` | **no test** |
| **Price for a target margin** | `round(cost / (1 − target/100))` | `index.html:117210` `marginTargetPrice` | console tests |
| **Gross profit** (P&L) | Σ qty × `quoteItemSellPrice` − `invoiceLineCost`, less discount, less credit-note lines (and their cost if restocked) | `index.html:79152` `anInvoiceTotals` | `accounting-basis`, `credit-terms` + 13 |

---

## 5. Customers' debt

### 5.1 The balance

```
balance (books)  = opening + Σ over the customer's invoiced, not voided orders: max(0, round(total) − paid)
opening          = Σ customer_debt_log lines that name no order: charge +, anything else −
customers.debt   = the stored balance; the server keeps it in step (below)
```

| Rule | Where | Server | Tests |
|---|---|---|---|
| Balance from the books | `manager.html:1818` `custBalance` (+ `custOpening` 1814) | `0169:639` `ow_customer_balance` (same rule) | `manager-round1-money`, `manager-round1-db` |
| **The stored balance follows each invoice**: when what is due on an invoice changes, `customers.debt` moves by the difference and a `customer_debt_log` line is written ("Auto-sync — INV-0550"); `payload.debtCharged` = the invoice's share | — | `0169:285` `saved_quotes_sync_debt` (trigger `saved_quotes_zz_sync_debt`) | `sales-round1-db`, `manager-decide` (text) |
| A balance below 0 is a **deposit**; a new invoice uses it first | — | `0165` `ow_invoice_core`, `ow_deposit_in` (`0165:439`) | `sales-round1-db` (text); no test names `ow_deposit_in` |
| "Doesn't add up" warning (`custAddsUp`) | Sales `sales.html:7060`: only when the bills exceed the stored debt. Manager `manager.html:1821`: either way, opening included (Q6) | `0165` view `ow_balance_check` | `sales-app`, `manager-round1-money` |
| **Opening balance** (before these books), once, only before they trade | — | `0148` `set_opening_balance` (`debt.open`, Manager) | `fresh-start` |
| **Merging two customers** adds the balances | — | `0169` `merge_customers` (`customer.merge`) | `manager-round1-db` |

### 5.2 Walk-in customers are never debtors (0139)

```
generic name = lower(trim(name)) matches walk-in | walkin | cash (sale|customer|client) | counter (sale|customer)
               | customer | client | unknown | n/a | none | --- | ... | (empty)
```
A generic name is never matched to or created as a customer. Invoicing an order that still owes money with no real customer is refused (OWWLK) and goes back to the Manager. `0139:61` `ow_generic_client`. Test: `invoice-unpriced-db`. **No app has a copy of this rule**: the apps only learn of it from the server's refusal.

### 5.3 Ageing

```
open charges (custOpenCharges): walk the debt log oldest first;
   a charge opens; a payment first clears the charge with its quoteId, then the oldest open charges;
   a payment beyond all charges is credit and eats the next charge; keep charges with > 0.5 left
age   = days from the charge's date to today
bands = under 30 (0–29) | 30–60 (30–59) | 60–90 (60–89) | over 90 (90+)          (bandOf, BANDS)
no date / not in the log = "no date" = max(0, debt − Σ aged)
```

| Rule | Majority | Others | Tests |
|---|---|---|---|
| `custOpenCharges` | `sales.html:7329` (manager 1787, accounts 1224, owner 1103: all the same) | — | `sales-app`, `manager-app`, `accounts-app` |
| `bandOf` / `BANDS` | `sales.html:7350-7356` (accounts, owner) | manager 1855 `AGE_BANDS`: same bands, different name | `manager-app:70`, `debtors-aging` (console) |
| `custAging`: an undated charge goes to "no date" | `sales.html:7357` (manager 1857, accounts 1752) | owner 1440 ages it as 0 days (Q7) | `sales-app:733`; owner: **no test** |
| Manager, customers with no log: `custOwedAging` ages the bills instead | `manager.html:1876` | — | `manager-app` |

### 5.4 Credit limit, terms, holds

| Rule | Formula | Where | Server | Tests |
|---|---|---|---|---|
| Credit limit | `customers.credit_limit`; 0 = none (a cash customer) | `custLimit` `sales.html:6847` | `ow_gate_reason`, `ow_money_hold` | `manager-app` |
| Terms (days to pay) | `termsDays` on the customer, else `presets.chaseAfterDays` (default 7) | `custTerms` `sales.html:6835` | — | `accounts-app`, `manager-app` |
| Overdue | debt > 0 and oldest age > terms | `custOverdue` `sales.html:6846` | — | `manager-app` |
| Over limit | limit > 0 and debt > limit | `custOverLimit` `sales.html:6848` | — | `manager-app` |
| **Credit hold** on an order in Checking | **over**: debt + order's due > limit; **old**: oldest debt > hold days (`presets.creditHold.days`, default 21); **noLimit**: on credit terms with no limit | `creditHoldFor` `sales.html:4452`, `creditCase` `manager.html:1926` | `0167:46` `ow_gate_reason` checks **over** and **noLimit** only, not **old** (Q8) | `sales-app`, `manager-app`, `manager-round3-money`, `audit-0136` |
| Manager's answer `creditCheck.decision`: release / hold / cash first (held until paid) | | | `0167:64-67` | `shared-foundation-db` |
| **Money at the gate**: a packed order for a cash customer (no limit, or walk-in) can't leave unpaid unless the Manager released it | | — | `0164:49` `ow_money_hold`, `0156` trigger | `store-money-db`, `store-round5` |

### 5.5 Debtors list

| Name today | Means | Where |
|---|---|---|
| `debtors()` (Manager) | customers whose **books** balance > 0.5 (or stored debt > 0.5 that adds up), with their oldest age, **oldest first** | `manager.html:1889` |
| `debtors()` (Accounts, Owner) | customers whose **stored** `debt` > 0.5, unsorted | `accounts.html:1764`, `owner.html:1449` |

Same name, two lists, and they read two balances (Q9). Tests: `manager-app`, `accounts-app`.

### 5.6 Promises to pay

A ledger, never edited; a new promise is a new row (`0089_payment_promises.sql`). "Kept" is worked out from the debt log every time, never stored.

| Version | Kept when | Where | Tests |
|---|---|---|---|
| Sales | balance ≤ 0.5, **or** payments between made and promised days ≥ amount | `sales.html:7162` `custPromiseState` | **no test** |
| Manager | amount set: payments ≥ amount; **no amount: any payment** | `manager.html:1908` `promiseState` | `manager-app`, `debt-chase`, `payment-promises` (console) |

Otherwise "broken" once the promised day has passed, else "open". (Q10)

---

## 6. Payments

| Rule | What happens, in one transaction | Where | Tests |
|---|---|---|---|
| **Take a customer's payment** `receive_payment(shop, customer, amount, method, picks?, order?, ref?, over?, date?, label?)` | amount rounded; date never after today; **a customer's bills** oldest first (by invoice time), or the ticked ones in order; per bill one `cash_txns` receipt ('Debt Payment', 'INV-0550') + one `payments[]` entry; the debt follows (sync trigger); what is left lowers an older balance; more than owed needs `over` = `change` (only what is owed is money in) or `deposit` (all of it, balance below 0) else refused (OWOVR). **An order before its invoice**: paid against its priced total; a deposit needs a named customer (OWDEP). | `0169:103` (replaces 0140, 0155, 0165) | `audit-0140`, `manager-round1-db`, `manager-round1-money`, `manager-round3-money`, `payment-post` |
| **Payment plan on screen** (`payPlan`), the client-side preview of the above | same split; `over = left − max(0, debt)` | `sales.html:8926` (manager 1566, accounts 1353) | `sales-app:563-595`, `manager-app`, `accounts-app` |
| | Owner: `over = left − debt` (a deposit counts as more owed) (Q11) | `owner.html:1230` | **no test** |
| **Counter sale** (pay and go): invoice + payment + change in one write | | `0155:30` `counter_sale` (from `0136`) | `audit-0136`, `sales-app` |
| **Mobile money (agents)**: one pending prompt per order; a confirmed payment writes the 'momo' receipt and the order's payment once (`applied_at`) | | `0109:206` `apply_momo_payment` (receipt names the order since `0165`); edge functions `agent-initiate-momo-payment`, `check-momo-payment-status`, `mtn-/airtel-payment-webhook` | `audit-0138`, `money-write-guards` |
| **Agent credit** spent on an order: locked, re-checked, both sides written | | `0109:82` `use_agent_credit` | `agent-change-order`, `money-write-guards` |
| **Payment asks**: Sales/Manager ask Accounts to fix a payment (method, amount, bill, day; `0165` adds over, balance); nothing changes until Accounts corrects it | `rowToPayAsk` sales 3974 / manager 3887 / accounts 1440 (Accounts drops `decidedByName`, `decidedAt`: fields only) | `0130` `payment_asks`, `decide_payment_ask` (`0130:123`) | `sales-asks-db`, `audit-live-refresh` |
| **Correct a payment** (Accounts) | | `0165:492` `ow_correct_payment` (`payment.edit`) | `sales-round1-db` |
| **Paid over** after the fact → deposit or change | | `0165:587` `ow_settle_over` | `sales-round1-db` (text) |
| **Void with money**: refund (cash out, 'Refund') or deposit; a phone can't void an order holding money otherwise (OWVMN) | | `0169` `void_with_money`, `saved_quotes_void_money` | `manager-round1-db`, `manager-round1-money` |
| A receipt can't change amount, order or type on its own; one receipt is named by one payment only; account must match | | `0165` `cash_txns_zz_payment_check`, `0169` money check | `sales-round1-db`, `manager-round1-db` |

---

## 7. The treasurer's books (outline only, to be detailed)

Accounts runs everything finance (`docs/decision-rights.md` § "Money: the treasurer"). The reports are the console's, carried whole in `CONSOLE_BOOKS`.

**Writes: one server function each**

| Job | Server function | Task | Tests |
|---|---|---|---|
| Expense / other income / transfer / opening | plain `cash_txns` rows the app writes, not a server function: `addCash` `accounts.html:5547` (amount rounded); a transfer is two rows ('Account Transfer') in one insert, `accounts.html:6138`; guarded by `0123` `cash_txns_accounts_guard` | `cash.expense`, `cash.income`, `cash.transfer`, `day.open` | `accounts-app` |
| No line on a closed day | `0123:152` `cash_day_is_closed`; guard on insert too since `0143` | `day.close` | `audit-0143` |
| Daily close: count each account, close a day that agrees, book a shortage/overage | `cash_days` (`opening`, `actual`, `closed_at`); `0117`/`0123` guards | `day.count`, `day.close`, `variance.book` | `accounts-app`, `cashbook-control-centre` |
| Wages and rent | `0141:69` `pay_dues` (whole shillings) | `payroll.run` | `audit-0141`, `accounts-wages-whole` |
| Loan in / repaid | `0141:166` `receive_loan`, `0141:139` `repay_loan` | `loan.edit` | `audit-0141`, `accounts-app` |
| Asset bought / sold or gone | `0141:196` `buy_asset`, `0141:225` `dispose_asset` | `asset.edit` | `audit-0141`, `accounts-app` |
| Agent settled (cash in, claims paid) | `0141:259` `settle_agent` | `agent.pay` | `audit-0141`, `accounts-app` |
| Agent bonus commission claim = Σ `items[].bonusCommission` on the agent's completed, not voided orders dated that month, worked out on the server | edge `agent-claim-commission` | `agent.pay` | `agent-commission`, `earnings-commission` |
| Buyer paid back / trip cash taken back | `0154:59` `buyer_payback`, `0154:184` `buyer_cash_back` | `trip.cash` | `accounts-app` |
| Supplier bills (payables): open bills, due on the supplier's terms | `purchase_invoices`; `0138`/`0154` `purchase_invoices_born_paid` | `bill.record`, `bill.pay` | `accounts-app` |

**Reports: the formulas** (one copy: `index.html` = `accounts.html` `CONSOLE_BOOKS` = `owner.html` `CONSOLE_BOOKS`, unless noted)

| Formula | Rule in short | Where (index) | Tests |
|---|---|---|---|
| `cashOnHandFor(account, day)` | last anchor (a closed day's counted `actual` before the day, or an `opening` set on/before it) + money in − money out since | 57830 (+ `cashAnchorFor` 57792) | `cash-running-balance`, `balance-sheet-asat` + 8 |
| `incomeStatement` | revenue = sales + services + credit (`anInvoiceTotals`); gross = revenue − cost of sales − cost of services; operating = gross − opex − depreciation; net = operating + disposal gain − interest − loan fees; gross margin % = gross / revenue | 128535 | `financial-statements` + 9 |
| `payablesAsAt(day)` | today: all open bills + consignment owed. Past day: bills dated by then, less payments by then, + consignment | 128707 (accounts 5189) | `balance-sheet-asat` + 6 |
| | Owner 2911 counts only bills from **known suppliers** on a past day, and its `dashTotalCreditors` (3223) sums by supplier (Q12) | | **no test** |
| `balanceSheetAsAt(day)` | assets = cash + receivables + stock value + fixed assets (NBV) + dues prepaid; liabilities = payables + loans (principal + charges owed) + dues owed + accrued costs; equity = assets − liabilities | 128762 | `balance-sheet-asat`, `financial-statements` |
| `cashFlowStatement` | operating = trading in + debt collected + cash found − operating out − stock out; investing = asset sales − equipment; financing = borrowed + owner in − repaid − owner out | 128846 | `financial-statements`, `statement-drill-down` |
| `loanChargedTo(loan, day)` | interest and fees charged so far: paid + accrued unpaid + periods since the last repayment (flat or reducing) | 127706 | `loans`, `financial-statements` |
| `assetMonthlyCharge(asset, openingNBV)` | straight line `(cost − salvage)/lifeMonths`, or reducing balance `NBV × rate/12`; never below salvage | 127075 | `fixed-assets`, `loan-fees-and-financing` |
| `payrollPosition` | dues accrued vs paid, owed or prepaid as at a day | 104664 | `payroll-accrual`, `payroll-and-rent` |

The report formulas take their "today" from `todayISO()` in UTC; the phone apps use the phone's local date; the server uses `Africa/Kampala` (Q13).

---

## 8. Decided (Kevin, 2026-10-28)

The one rule for each disagreement. The shared core implements exactly
these; the old copies are not consulted again. **Server** = also becomes a
database rule (see `docs/rebuild.md`, "Backend fixes decided").

| # | Rule | Decided | Was (where the copies differed) |
|---|---|---|---|
| Q1 | Goods total | Skip lines whose price is still to confirm; round each line (= server `0165` `ow_order_total`) | owner.html:1037; console `savedQuoteGoodsTotal` (+ `CONSOLE_BOOKS` in Accounts and Owner) |
| Q2 | Order total | Never below 0 | owner.html:1043; console `savedQuoteTotal`; portal `orderTotal` |
| Q3 | Money on screen | **One writer**: `1,000 UGX`, whole shillings, blank when empty (replaces `n0` and `fmtUGX`) | agent `UGX 1,000`; index blank; 5 apps no rounding |
| Q4 | Sell price with no product or no markup rule | 0, shown as "price to confirm"; kept out of every total | owner 1022, index 60005 returned the cost |
| Q5 | FIFO cost | Weighted over the lots the quantity takes (Sales, SAL-008) | buyer 917, manager 1323, index 112586 used the first lot |
| Q6 | "Balance doesn't add up" | Checked both ways, with the opening balance (Manager's = `ow_customer_balance`, `0169`) | sales 7060 |
| Q7 | Aging a charge with no date | Under "no date", never "new" | owner 1440 |
| Q8 | Credit hold for old debt | **Hold at 21 days. Server:** `ow_gate_reason` holds a credit order when the oldest debt is past the hold days (default 21), as the apps already do | Sales `creditHoldFor`, Manager `creditCase` vs `ow_gate_reason` |
| Q9 | Debtors | Two lists, two names, both on the books balance: `debtorsByAge` (oldest first) and `customersOwing` | manager 1889 vs accounts 1764, owner 1449 |
| Q10 | Promise kept | Kept when the balance is cleared by the promised date, whatever amount was or wasn't named; a part payment keeps only a promise that named that amount (Sales' rule) | sales 7162 vs manager 1908 |
| Q11 | Pay plan "over" | `least(left, max(debt, 0))` (= server `receive_payment`) | owner 1230 |
| Q12 | Payables | Every open bill counts (Kevin's 20 Oct 2026 rule) | owner 2911, 3223 |
| Q13 | Today's date | Kampala date everywhere (= server `ow_today()`) | console UTC; phones local; supplier.html UTC+3 |
| Q14 | Agent order total | Goods + charges | `0109` `order_shop_total` counted goods only |
| Q15 | Portal total | The server's `ow_order_total`: the customer sees the shop's figure | `client-portal/index.ts:241` |
| Q16 | No sale below cost | **Server:** the database refuses a line priced below cost, except a line marked given away. **Built: `0171`** | only `priceTooLow` and the Manager's floor in the apps |
| Q17 | Rounding of discounts and credit notes | Round as the server does | apps did not round |

Differences found that are **names or format only** (no answer needed): `tieredUnitPrice`, `tiersForKind`, `purchasePriceAtQty`, `rankedPriceRows`, `chargeAmount`, `shopCreditPct`, `effectiveMarkupRule` (sourcing/index read the same setting under another key), `effectiveStockMarkupRule`, `bandOf`/`AGE_BANDS`, `stockKey`, `rowToPayAsk` (Accounts drops two display fields), `productPriceRows` (index adds a supplier name; strict vs number variant match).

---

## 9. Rules with no test

- `fmtUGX` in the phone apps (only stubbed in console tests); `short` (5 versions).
- Every **owner.html** money copy: `goodsTotal`, `quoteTotal`, `quoteItemSellPrice`, `custAging`, `payPlan`, `payablesAsAt`, `dashTotalCreditors`.
- `marginOf` / `marginCol` / `priceChip` (Manager's margin and at-cost floor).
- `custPromiseState` (Sales' promise rule).
- SQL: `order_shop_total`, `ow_markup_rule`, `ow_tiered_unit_price`, `ow_apply_rule`, `ow_line_under_cost`, `ow_deposit_in`, `ow_money` (only text checks for `saved_quotes_sync_debt` and `ow_settle_over`).
- Any SQL test that is a text check only, unless run with `OW_PG` (`sales-round1-db`, `manager-round1-db`, `store-money-db` and others).
- Portal total with a discount **and** credit together (`client-order-total` does not try it).
- No test proves the server's total equals the phone's for the same order (only `sales-app` compares Sales with the console, on priced lines).

## 10. Not verified here

- The treasurer's report formulas (§7) are listed from their function heads, not traced line by line; `incomeStatement`, `balanceSheetAsAt` and `cashFlowStatement` need their own section.
- Daily close details (`cash_days` columns, variance categories, reopen) and supplier payables ageing: outline only.
- `counter_sale`, `apply_momo_payment`, `settle_agent`, `buyer_payback` bodies were not read in full; rows above come from their headers.
- `agent.html`'s own totals (`orderTotal` 6778 uses the agent's prices `agentSellPrice`, the agent's margin) and the agent discount/margin rules: not covered; they belong with the agent chapter.
- `index.html` has more money functions than are listed here (about 600 `fmtUGX` calls); only the ones the role apps share were compared.
