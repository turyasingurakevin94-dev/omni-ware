# Sales · Round 2: Core workflows   (brief received 24 Oct 2026, build sales.html 982,033 bytes, 23 Oct 2026 23:41 GMT)

Tested as sales (coursesug+2@gmail.com) on "Omni-ware (old records)", with writes blocked in the browser. Verified fixed and kept: SAL-002, -003, -004, -005, -006, -007, -008, -009, -014; below-cost price refused; under-shop price goes to the Manager; credit charge 3% on goods + charges; "To collect" leaves out amounts in question.

Canvas: v130, row "Sales round 2 · core workflows" (boards `R2QtyBack`, `R2CreditNoLimit`, `R2TestRecords`). The boards draw the sample shop (Ruth is the Manager there); the app names the shop's own Manager (Warren on live).

## What the code does today

| ID | Finding |
|---|---|
| SAL-015 | Two count boxes. The order line (`ACT['ch:lq']`, `sx/7_neworder.js:659`) keeps a 0 typed and shows round 1's "At least 1 · or remove the line"; the counter sale (`ACT['ch:ctq']`, `sx/9c_counter.js:249`) redraws with nothing said. Both act only on `change` (leaving the box, or Enter), so between typing and leaving, the box and the line disagree. |
| SAL-016 | Credit is held only when a customer would go **over** a limit that is set (`ow_gate_reason`, 0136; the Manager's `creditCase`; Sales' `creditHoldFor`). With no limit set, `limit > 0` is false and the order goes straight on with +3%. The pill shows a dot and "no limit" (read as "★ no limit"); `creditWhy` stays null. The server's hold already pushes the Manager (`credit.hold`, 0120) and the Manager's queue already reads it, so the fix is in the one gate. |
| SAL-018 | Nothing marks a record as a test. `moneyIn`, the goal (`nmInvoicesIn`) and Today count every receipt and invoice. |
| SAL-017 | `prices` (cost) and the lots load to the phone (`2_data.js` `selectAll('prices')`); a line's `price` is its cost; `quoteItemSellPrice`, the floor and the margin run on the phone. |

## Design changes (canvas)

| ID | Board(s) | Before → After | States drawn | Tokens/components used | New component? |
|---|---|---|---|---|---|
| SAL-015 | `R2QtyBack` | Before: −2 or 0 leaves "0" in the box, the line keeps 3 (28,500), nothing said. After: on leaving the box (Done, Enter, tap away) a count under 1 puts the box back to the line's count and shows "At least 1 — use the bin to remove it", with the bin ringed. The note goes after 4 s or on the next tap. The counter sale's count does the same. The bin removes the line with Undo for 10 s. **This replaces round 1's `R1QtyZero`** (which kept the 0 in a red box). | before, typing, after (snapped), default, counter, removed | line row, − box +, bin, amber note, Undo toast | No |
| SAL-016 | `R2CreditNoLimit` | Before: Credit +3% on a customer with no limit goes straight on. After: for a customer with no limit set, Cash/Credit takes its own row; Credit reads "No limit set · Ruth decides". Choosing it adds a line above the slide, "It waits in Checking for Ruth's yes · she is told now". Placed: the track says "waits in Checking for Ruth · credit, no limit set". The order's Credit gate waits on Ruth; her yes pushes Grace and the order moves on; "Cash first" holds it until paid. A customer within a set limit goes straight on, as now. | before, cash (default), credit chosen, placed, waiting, yes, cash first, within limit | dock, segmented pay, Manager face, gate chips, push, placed track | No (the pay row reuses the segmented control) |
| SAL-018 | `R2TestRecords` | Before: TESTQA payments count in money in, the month and the goal. After: test orders and payments stay in the lists, marked "TEST · not counted" (struck through, not added); Today says once "Test orders and payments are not counted"; a test order says "In no figure". | before, after, today, order | chip, money list, order head | No (the chip is the existing pill in grey) |
| SAL-017 | — | Server only (deferred, see below). | — | — | — |

## Code changes planned

| ID | Sev | File / function | Change (one line) | UI? | Acceptance check |
|---|---|---|---|---|---|
| SAL-015 | Low | `sx/7_neworder.js` `ACT['ch:lq']`, `sx/9c_counter.js` `ACT['ch:ctq']`, a shared `qtyBack(it, el)` | A count under 1 (or not a number) puts the box back to the line's count and shows the note for 4 s (`aria-live`), the bin ringed; `NW.zero` and its red 0 go | yes | Type −2 or 0 and leave the box: it shows 3 again, the line is still 28,500, the note shows; on the counter too. Test: the box value after the change equals the line's count. |
| SAL-016 | Medium | `sx/3_domain.js` `creditHoldFor(c, amt, q)` | Also a hold when the order is on credit and the customer has no limit set (`noLimit`), the same rule as the server | yes | The order's Credit gate shows "Credit · Ruth" and waits. |
| SAL-016 | Medium | `sx/7_neworder.js` `nwDockHTML` | A customer with no limit: the pay choice on its own row, "No limit set · {Manager} decides", and the waiting line when Credit is chosen | yes | Board `R2CreditNoLimit`. |
| SAL-016 | Medium | `sx/7_neworder.js` `nwPlacedNote`, `sx/5b_orders.js` gate chip | "waits in Checking for {Manager} · credit, no limit set"; the chip's hint "No limit set · {Manager} decides" | yes | Placed page and order page as drawn. |
| SAL-016 | Medium | `manager.html` `creditCase`, its hold card and push line | A no-limit credit order is held; the card says "no limit set" (not "over their credit limit") | yes (one line of copy) | The Manager's queue lists it; Release and Cash first work as for an over-limit hold. |
| SAL-018 | Medium | `sx/5a_today.js` `moneyIn`, `sx/5c_numbers.js` `nmIsSale` / `nmInvoicesIn`, Today, the money list and order page; the same shared functions in `manager.html` and `accounts.html` (word for word), and Accounts' cash book totals and daily count (Kevin: not real money) | A test record (`qa`) is left out of every figure and marked "TEST · not counted" where it is listed | yes | After the flag: October collected and the goal exclude #554, #556, #562, #564, 22655 and 22656. |

## Server / SQL changes planned

Migration **0166** (Sales, sixth; reserved in `docs/decision-rights.md` in the same commit).

| ID | Migration / function / policy | Change | Test |
|---|---|---|---|
| SAL-016 | `ow_gate_reason` | An order on credit (`payload.credit.pct > 0`) for a customer with no limit set waits as `'credit'` until the Manager releases it ("cash first" holds until paid, as for over-limit). Over-limit is unchanged. | SQL as sales: a no-limit credit order can't leave Checking; as manager: release, and it moves; within-limit credit moves at once. |
| SAL-016 | the `credit.hold` push (0120 trigger) | Body: "{client} would owe {X} · no limit set" when there is no limit. | Same scenario: one push to the Manager, with that body. |
| SAL-018 | `saved_quotes.qa`, `cash_txns.qa` (boolean, default false); `customers.qa` | A test customer's orders, and their receipts, are marked by a trigger; so is a walk-in order named "TEST …" and a receipt whose ref starts "TESTQA". Nothing is deleted. | Scenario: a TEST customer's order and receipt get `qa`; a normal one doesn't. |
| Data | `docs/audit/sales/round-1-correct.sql` → **every fix a switch, all off** | Per the brief, nothing corrects itself: #484, the Deposit labels and C953 become switches like the others; new switches for the three paid-over orders (`'change'` or `'deposit'` each) and for marking the test records. | Seeded run: with every switch off nothing changes; each switch on changes only its case; a second run changes nothing. |

## Data corrections for Kevin's approval (nothing runs without it)

Run `docs/audit/sales/round-2-check.sql` on live first; queries 1 and 2 show the six customers bill by bill, query 3 lists the test records.

| ID | Case | Recommendation | Switch |
|---|---|---|---|
| SAL-010 | #446 Baker: 5,000 points at cash 20166 (Mulongo, 871,500, no order) | Look for a 5,000 receipt of 5 Oct for Baker (the REPORT lists them). Found: relink. Not found: **you say** whether it was paid (record a receipt) or not (remove it). | `fix_446` = `'relink'` / `'record'` / `'remove'` |
| SAL-012 | #226 Jackson: payments 6,200,000, paid 4,600,000 | **Remove the copy.** Receipts 15544 (1 Aug) and 11385 (26 Aug) are the same 1,600,000 "Payment — INV-0226"; every other Jackson order is paid in full. Esther then reverses receipt 15544 in the cash book with a correction dated today. | `fix_226 = 'remove'` |
| SAL-013 | #484 Kadomola: paid 240,000, no payment; receipt 22096 names it | **Link** the payment to receipt 22096. | `fix_484` |
| SAL-005 | #264 +25,000, #301 +10,000, #360 +15,000 paid over | **You say, per order:** change given, or a deposit the customer confirmed. | `fix_264`, `fix_301`, `fix_360` = `'change'` / `'deposit'` |
| SAL-011 | C953 Eddy: 0 vs #390 540,000 | **Move** his 540,000 of 16 Oct from #408 to #390 (#408 stays paid). | `fix_c953` |
| SAL-011 | C1005 Ken Bwaise: 685,000 vs 1,034,000 | Query 1 shows which bill carries less than it says is due. If no payment of his is missing from the bills, **set each bill's share to what it says is due** (balance becomes 1,034,000). | `fix_resync` (the four below too) |
| SAL-011 | C979 Hajat @Faluk: 19,000 vs 280,000 | The same as Ken. | `fix_resync` |
| SAL-011 | C110 Sadat: 290,000 vs 0 | If query 2 shows a 290,000 old-book line (no order), it is his opening balance: **no change**. If not, a bill was paid without lowering him: resync. | `fix_resync` |
| SAL-011 | C114 Ssendawula Sam: 20,000 vs 0 | The same as Sadat. | `fix_resync` |
| SAL-011 | C925 Ambrose FEKO: 255,000 vs 85,000 | Three 85,000 charges on 28–29 Sep: if two are copies, **remove them** (balance 85,000). | `fix_c925` |
| — | 12 payments dated before their order (query 9) | **Label "Deposit"**, nothing moves. | `fix_labels` |
| SAL-018 | TEST Claude QA: orders #554 (paid 1,000), #556 (paid 51,000), #562; walk-in #564; receipts 22655 (1,000, TESTQA123) and 22656 (11,500, TESTQA456) | **Mark as test** (kept, not deleted, out of every figure). | `fix_test` |

## Glossary changes

| Term | Meaning | Replaces |
|---|---|---|
| No limit set · {Manager} decides | A customer with no credit limit can still buy on credit, but only with the Manager's yes; the order waits in Checking | "★ no limit" |
| Test · not counted | A QA record: kept and listed, in no figure | — |
| At least 1 — use the bin to remove it | What a count under 1 says; the box goes back to the line | "At least 1 · or remove the line" (round 1) |

## Not changing / pushed back

| ID | Why |
|---|---|
| SAL-017 | It is round 5's aspect (Roles and privacy) and the brief logs it now. Doing it means the phone never prices a line itself: every sell price, the floor and the margin come from the server (a sell-price list without cost, a `price_check` call returning ok / too low / needs the Manager), and a line stops carrying its cost. That touches every price on the order, counter and pay screens, so it gets its own round. **Plan for round 5:** a `sales_prices` view (sell price per item, supplier and unit, no cost), `ow_price_check`, cost columns refused to sales by policy, the line's cost filled by the server on save. |
| Within-limit credit | Unchanged: straight through, as the brief asks. |

## Questions for Kevin

1. **Test records (SAL-018) and your standing rule "don't touch the test data".** The plan keeps every test record and only marks it "test" so no figure counts it. Is marking them all right? And from now on, should any customer named "TEST …" (and any walk-in named "TEST …", any ref "TESTQA…") be test automatically?
2. **Were the TESTQA payments real money?** If not, Accounts' cash book should leave them out too (the daily count never had them). If they were, they stay in the cash book and only the sales figures drop them.
3. **SAL-017 in round 5:** agreed, or do you want it in this round?
4. **The corrections:** for each switch above, "yes", "no" or the choice (#446, #264, #301, #360).

## Kevin's answers (24 Oct 2026)

1. **Test records:** yes — they are kept and marked test, out of every figure; from now on a customer or walk-in named "TEST …", and a ref starting "TESTQA", is test automatically.
2. **Real money?** No — the TESTQA payments were never cash, so Accounts' cash book leaves them out too.
3. **SAL-017:** round 5, as planned.
4. **The corrections:** to confirm (#446's choice, the three paid-over orders, the other switches).

## Phase B result (filled after implementing)

| ID | Done? | What changed | How verified |
|---|---|---|---|
