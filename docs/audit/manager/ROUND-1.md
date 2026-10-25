# Manager · Round 1: Data and money integrity   (brief received 25 Oct 2026 in two parts, build tested 25 Oct 2026 09:07 UTC)

Canvas: https://claude.ai/artifact/BifNESucDq7sMriL9jVNGf, row "Manager round 1 · data integrity" (boards named `Manager · <Screen> · <State>`, 360 px; the brief says phone only).
Migration: **0169** (the next free number; reserved in `docs/decision-rights.md` in Phase B, with the code).
Read-only checks for the live data: `docs/audit/manager/round-1-check.sql` (12 queries). They ran on a fresh database built from every migration (0001–0168) with the brief's cases seeded; each query found its case and nothing else (Sadat's opening balance and a key whose lots add up were not listed).
Verified fine in the brief (do not regress): the team goal pace, Money in today = 468,000, Decide now = 9 and its parts, every invoice's amountPaid = its payments.

## What was found

| ID | Root cause |
|---|---|
| MGR-DATA-01 | Sales round 1 (SAL-010) found the same thing and fixed the server: since **0165** a payment must name a receipt of the same amount and order (`saved_quotes_money_check`), and the Manager already writes money only through `receive_payment` and `ow_patch_order` (manager.html 3937, 1794). Two gaps remain: 0165 does not compare the **account** (a cash payment naming a momo receipt passes), and nothing stops **one receipt being named by two payments**. #0446 is in `docs/audit/sales/round-2-correct.sql` (`fix_446 := 'relink'`). **#0415 is new**: its 400,000 cash payment names 18965 (momo 500,000 "Debt Payment", no order). |
| MGR-DATA-02 | Also found by Sales (SAL-011): Ken, Hajat, Sadat and Sam are in `round-2-correct.sql` (`fix_resync`), Eddy too (`fix_c953`). Sales kept the stored balance and deferred a computed one "to a later round" (Kevin, 23 Oct) — this round. In the Manager, `debtors()` (manager.html 1682) keeps only `customers.debt > 0`, so a customer whose stored balance is wrong (Eddy, 0) never shows, and the chase card misses him. |
| MGR-DATA-03 | Every server stock move keeps lots in step (`ow_stock_move` 0119, the counts 0115/0142/0143, check-ins 0124/0136/0157, the Manager's 0122). The drift is history: the owner console saves `stock` and `stock_lots` as separate requests (index.html ~46313, `replace_stock_lots` for the lots only), so a failed or partial save leaves them apart, and nothing checks. |
| MGR-DATA-04 | `lineBelowCost` (round 4) catches lines not yet invoiced. Invoiced lines are history: neither the order page nor Margins flags them, and Margins (`monthLines`) shows only this month. |
| MGR-DATA-05 | `todayMoney()` sums `sumTotal(sold)`; an order with no prices adds 0 but still counts. |
| MGR-DATA-06 | Not a dead link: the legend draws each seller, then a separate "not linked" entry for sales on invoices that name no seller (the old-records import, `teamMonth().rest`). Side by side they read "Daphine · not linked". |
| MGR-WORD-01 | 24 places in manager.html build `Q-` + 4 digits; the glossary says `#0548` (Store R6 · WORD-09). |
| MGR-DATA-07 | The Manager's void (`void_sale_bills` 0122, and the round-3 duplicate void) sets `voided` and the debt to nothing, but a payment already taken stays on the order with no refund and no deposit. |
| MGR-DATA-08 | Two measures: Today uses `nmInvoiceSales` (every invoiced line, goods only); Margins (`monthLines`, manager.html ~5005) adds only lines with a known cost and a price, from `linePriceNow × qty`. The gap is the lines with no cost recorded (and any 0 lines). |
| MGR-DATA-09 | A line typed at 0 is a price (0 is a valid `sellPrice`); `ow_invoice_core` (0139) refuses only lines with no price at all, so #0541 went through. Sales R1 made "no price" never cost; an explicit 0 is still silent. |
| MGR-DATA-10 | Wages (Accounts' pay run) divide by days and write the raw result; `cash_txns.amount` is `numeric` with no rounding. |
| MGR-DATA-11 | Old payments typed with an earlier day. `round-2-correct.sql` (`fix_labels`) labels them "Deposit"; nothing warns at the time of paying. |
| MGR-DATA-12 | **Confirmed**: pricing uses **no** default when the saved value is 0 (`effectiveMarkupRule`, manager.html 1245–1255: a 0 value gives no rule, so such a line has no price). Margins shows 25% (`defaultMarkupPct()` falls back to 25), and the "Shop's price" quick price uses 25% too (`defaultMarkupPrice`, ~4346). So the screen and the price disagree. |
| MGR-DATA-13 | Customers are created freely by several apps; no phone check, no merge. |
| MGR-DATA-14 | Targets (`manager_notes` kind 'target') are closed only by hand; nothing ends them on their `to` day. |
| MGR-DATA-15 | No lower bound before billing. |

## Design changes (canvas)

All boards at 360 px, before and after, every state that applies. (Filled in with the board names when the canvas is published.)

| ID | Board(s) | Before → After | States drawn | Tokens/components used | New component? |
|---|---|---|---|---|---|
| MGR-DATA-02 | `Manager · Debtor · Doesn't add up`, `Manager · To collect · Computed` | Before: Ken "Owes 685,000" over bills of 1,034,000; Eddy missing from To collect. After: one figure from the bills ("Owes 1,034,000"); "Doesn't add up · Accounts checks it" with the two bars and "349,000 apart" until corrected; Sadat's 290,000 as an **Opening balance** line; Eddy listed at 540,000 and counted by the over-30 chase card | agrees, doesn't add up, asked (sent), corrected, opening balance | Sales `R1AddsUp` card (reused), debtor bill list, To collect row | No (reuses Sales) |
| MGR-DATA-04 | `Manager · Order · Below cost`, `Manager · Margins · Below cost` | Before: #0193, #0321, #0554 look normal. After: red "below cost" flag and the loss on the line; Margins "Sold below cost · 3 lines" group, each line opens its order | flagged, none | line flag chip, Margins group | No |
| MGR-DATA-05 | `Manager · Today · Sold today` | Before: "Sold today · 1 order · 0". After: "1 order · to price" | none sold, all priced, mixed, all to price | Today's day card | No |
| MGR-DATA-06 | `Manager · Today · Goal legend` | Before: "Daphine · not linked". After: sellers' chips, then a tappable "No seller · 11.2M" chip opening the invoices with no seller by month; a seller with no login reads "Daphine · no login" with "Ask Kevin to link her login" | all linked, no-seller, seller with no login, asked | legend chips, sheet | No |
| MGR-WORD-01 | `Manager · Order numbers` | `Q-0543` → `#0543` on rows, order header, search, pushes | — | — | No |
| MGR-DATA-07 | `Manager · Void · Money on it` | Before: void with 500,000 paid drops it silently. After: void asks **Refund** (cash out: account, amount) or **Keep as deposit** (green "Deposit", used first on the next bill); confirm disabled until chosen | choose, refund, deposit, sending, done + Undo 10 s, error | Void board, deposit chip (glossary) | No |
| MGR-DATA-08 | `Manager · Today & Margins · One sales figure` | Before: 12,980,897 vs 12,576,569. After: both "Sales invoiced · October · goods only"; Margins splits "costed 12,576,569 · no cost recorded 404,328" on a bar | — | figure + split bar | No |
| MGR-DATA-09 | `Manager · Invoice & Margins · Given away` | Before: 7 lines at 0 billed silently. After: each 0 line asks "Free · given away" + reason, or "To price"; refused without; order shows "Given away · reason"; Margins "Given away" group at cost | ask, chosen, refused, shown | line sheet, chips | No |
| MGR-DATA-11 | `Manager · Take payment · Before the order` | A date before the order's date warns "Before the order (28 Aug)" and records it as **Deposit**; the order lists "Deposit · 22 Aug" | normal, warned, recorded | pay screen, amber note | No |
| MGR-DATA-12 | `Manager · Margins · Default markup` | Before: "25%" while 0% is saved. After: the saved value, and when pricing falls back, says so | saved value, none saved | Margins head | No |
| MGR-DATA-13 | `Manager · Customers · Look alike` | A list to approve: merge (pick the name that stays; bills and balance move; confirm), not the same, fix the phone; customer edit's phone "10 digits, starting 07" | list, merge confirm, merged + Undo, not same, phone error | list rows, confirm sheet | No |
| MGR-DATA-14 | `Manager · Goals · Ended` | "Open" → "Ended · reached / missed · result" | reached, missed | goal row | No |
| MGR-DATA-15 | `Manager · Invoice · Very small` | "Only 567 · check it": Bill it / Fix the order | warned | confirm sheet | No |
| MGR-DATA-01, -03, -10 | — | Logic and server only; their visible effect is a correct figure | — | — | — |

## Code changes planned

All in `manager.html` unless named.

| ID | Sev | File / function | Change (one line) | UI? | Acceptance check |
|---|---|---|---|---|---|
| MGR-DATA-01 | P1 | none in the apps (Manager, Sales and Buyer already pay through `receive_payment`) | Server-side (0169) and the data correction. | no | Queries 1–2 return 0 rows. |
| MGR-DATA-02 | P1 | `custBalance(c)` = opening balance + each invoice's due (total − paid) − deposit; `debtors()`, the chase card (`needsYou`), To collect, the debtor sheet and the pay screen use it; `custAddsUp(c)` compares it with `customers.debt` and draws the card | One figure, from the bills; a stored figure that disagrees says so. | yes | Query 4 lists 0 customers after the correction; Eddy is in To collect and the chase count. |
| MGR-DATA-03 | P1 | none in the Manager (it moves stock only through server functions) | Server-side (0169) and the rebuild. | no | Query 5 returns 0 keys. |
| MGR-DATA-04 | P2 | `lineBelowCost` widened to invoiced lines for display; order page line flag + loss; Margins "Sold below cost" group (all months, newest first) | Every line sold under cost says so. | yes | #0193, #0321, #0554 show the flag (query 6). |
| MGR-DATA-05 | P2 | `todayMoney()` splits priced value from orders to price; the day card says "N to price" | Never a count beside a bare 0. | yes | #0578 reads "1 order · to price". |
| MGR-DATA-06 | P3 | `teamRingHTML` legend: "No seller · amount" chip + sheet; "no login" seller chip + "Ask Kevin" (push to the owner, WhatsApp when push is off) | No dead label. | yes | The legend reads as drawn. |
| MGR-WORD-01 | P3 | one helper `orderNo(id)` → `#0543`; the 24 `Q-` sites use it | One order format. | yes | grep finds no `Q-` + digits on screen. |
| MGR-DATA-07 | P1 | the void screens: a void with money asks Refund / Keep as deposit; calls `void_with_money` (0169) | A voided order never keeps money. | yes | Query 7 returns 0 rows after the correction. |
| MGR-DATA-08 | P2 | one `salesIn(from, to)` (goods only, invoiced, not test) used by Today and Margins; Margins draws the costed / no-cost split | One measure, labelled. | yes | Both screens show 12,980,897 for October. |
| MGR-DATA-09 | P2 | the price screens and invoice path: a 0 needs `givenAway: {why}`; Margins "Given away" group | Free is a choice, with a reason. | yes | The server refuses a 0 line without `givenAway` (0169 test). |
| MGR-DATA-10 | P2 | none in the Manager; `accounts.html` pay run rounds each amount (`Math.round`) | Whole shillings at write. | no | Query 8 returns 0 rows. |
| MGR-DATA-11 | P2 | pay screen: a day before the order warns and records `label: 'Deposit'` | No unlabelled early payment. | yes | Query 9 returns 0 rows after the correction. |
| MGR-DATA-12 | P2 | `defaultMarkupPct()` and `defaultMarkupPrice()` use the saved value; with none saved, Margins says pricing has no default, and the "Shop's price" quick price is hidden | The screen equals what pricing uses. | yes | Saved 0 → Margins shows 0%, no line priced at 25%. |
| MGR-DATA-13 | P3 | a "Look alike" list (from query 10's rules) with Merge / Not the same / Fix the phone; customer edit validates the phone | Kevin approves each merge. | yes | Esther ×2 merged on approval; 9-digit phone refused. |
| MGR-DATA-14 | P3 | the goal rows read `ended` targets with their result | Ended targets say so. | yes | Targets 35 and 46 read "Ended". |
| MGR-DATA-15 | P3 | the invoice screens ask before billing a total under 1,000 | A second look. | yes | #0572 asks "Only 567 · check it". |

## Server / SQL changes planned

One migration, **0169** (Manager round 1), safe to run twice, with ROLLBACK and CHECK AFTERWARDS blocks like 0165.

| ID | Migration / function / policy | Change | Test |
|---|---|---|---|
| MGR-DATA-01 | `saved_quotes_money_check` (0165) | Also refuses a payment whose receipt's **account** differs from the payment's method, and a receipt already named by another payment (any order). | SQL test as Manager, Sales, Accounts: each bad payment refused; a good one passes. |
| MGR-DATA-02 | view `ow_balance_check` (0165) kept; new `ow_customer_balance(p_shop, p_customer)` | The computed balance (opening + invoices due − deposit), the same rule as query 4, for any app to read. | SQL test: Ken 1,034,000; Sadat 290,000 (opening); Eddy 540,000. |
| MGR-DATA-03 | new `replace_stock_and_lots(p_shop, p_rows)`; constraint trigger `stock_lots_add_up` (deferred, per transaction) | Stock and its lots in one write for the console; at commit, any key changed in the transaction must have lots = stock, else refused. | SQL test: a stock change without its lots is refused; `ow_stock_move` passes. **Needs the console to switch to it in the same release** (else its saves fail). |
| MGR-DATA-07 | new `void_with_money(p_shop, p_order, p_choice, p_account)` | Void + refund (a `payment` cash row out, category 'Refund') or deposit (the customer's balance goes below 0 by the amount), one transaction; the plain void refuses an order with money on it. | SQL test as Manager: both choices; a plain void with money refused. |
| MGR-DATA-09 | `saved_quotes_money_check` | An invoiced line at 0 needs `givenAway.why`. | SQL test: refused without, accepted with. |
| MGR-DATA-10 | `cash_txns` before insert/update | Rounds `amount` to whole shillings. | SQL test: 386,666.67 stored as 386,667. |
| MGR-DATA-14 | `ow_end_targets(p_shop)` called by the hourly job | Closes targets past their `to` day with `body.result`. | SQL test: target 35 closed with its result. |
| MGR-DATA-15 | `ow_invoice_core` | Refuses a total under 1,000 unless `p_small_ok`. | SQL test. |

### One-off data correction (needs Kevin's choices)

`docs/audit/manager/round-1-correct.sql`, written in Phase B: REPORT first, then the switches, then the run (as Sales round 2).

| Case | Proposed | Kevin decides |
|---|---|---|
| Sales `round-1/2-correct.sql` (#0446, Ken, Hajat, Sadat, Sam, Eddy) | Run it first if it has not run: it already fixes those six | **Has it run on the live database?** (and 0165, 0167) |
| #0415 | The 400,000 cash payment gets its own cash receipt (cash, 22 Sep, 400,000, #0415); 18965 (momo 500,000 "Debt Payment") is unlinked and stays a debt payment of whoever paid it | Is 18965 Ken's debt payment, or someone else's? |
| 20 stock keys (P484::0 11→5, P258::0 10→5, P051::2 2→0, P311::2 3→0, P211::3 5→0, P094 10→0, + 14 more — query 5 lists them all) | Keep the **newest** layers that add up to the stock (the oldest goods left first); a key whose lots are short gets one layer at its last known cost | Agree with "newest layers stay"? |
| #0166 Muyanja (7,040,000 paid) and #0148 Adinan (500,000 paid) | — | Refund or keep as deposit, for each |
| 16804, 16805, 21597 (fractions) | Round to whole shillings; the 1-shilling adjustments listed in the report | OK |
| #0266, #0273, #0291, #0338, #0345, #0348 | Labelled "Deposit" (Sales round 2 `fix_labels` does this) | — |
| Esther ×2; Sarah - Dorcus / Dorcus' Customer; Henry Munene's phone | Listed in the app for Kevin to merge or fix | Each, in the app |
| Targets 35, 46 | Closed with their result | OK |

## Glossary changes

| Term | Meaning | Replaces |
|---|---|---|
| Opening balance | What a customer owed before these books; shown as its own line, never as a bill | (unlabelled debt) |
| Below cost | A line sold for less than it cost; red, with the loss | (nothing) |
| Given away | A line billed at 0 on purpose, with a reason; counted at cost in Margins | a silent 0 |
| No seller | Sales on invoices that name no salesperson (old records) | "not linked" |
| Refund | Money given back to a customer out of the cash book | — |

## Not changing / pushed back

| ID | Why |
|---|---|
| MGR-DATA-01 (app code) | The Manager already posts payment + receipt in one server function (`receive_payment`, one transaction since 0140/0165); only the server check widens. |
| MGR-DATA-06 ("link the staff record") | The label was the problem, not the link; linking a login stays the owner's (decision-rights: hiring). |

## Phase B result (filled after implementing)

| ID | Done? | What changed | How verified |
|---|---|---|---|
