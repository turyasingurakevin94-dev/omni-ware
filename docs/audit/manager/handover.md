# The Manager's hand-offs (12 Nov 2026)

Step 2 of `docs/audit/manager/GOAL.md`: every decision that lands on the Manager,
who asks, what they send, how it reaches the Manager, the choices, what is
written, who is told and in which words. Read from the code on
`claude/manager-round2` (up to date with main): `manager.html` (6,483 lines),
`store.html`, `accounts.html`, the new Sales app (`src/apps/sales`, `src/core`)
and the new Buyer app (`src/apps/buyer`, `src/core/buyer`), the migrations up to
**0181**, `supabase/functions/notify-stock-count`, `docs/spec/06-offline-sync-push.md`
§6b and `test/phone-push.test.js` `KINDS`. Line numbers are the files on this
branch.

Built on `docs/audit/cross-app/ROUND-1.md` (X-1 the cancel ask, X-2 Needs a
supplier, X-3 names, X-4 Taken / Sales invoiced): those are not redone; where
they left a gap (the cancel push is not routed, the Buyer is not told) it is
listed below. Same structure as `docs/audit/buyer/handover.md`. People are the
sample shop of `docs/canvas-cast.md` (Grace sells, Ruth manages, Denis buys,
Musa packs, Esther holds the cash, Moses sources, Peter is an agent).

**How taps are counted (column "Taps today").** From the tap on the push when
`pushOpen` (manager.html:2300) routes that kind to the decision's page;
otherwise from the tap that opens the app (or the unrouted push, which lands on
Today): + the Decide-now tile (manager.html:4658, every tile but Credit and
Invoices opens the list) + the row + the answer. Typing digits is not counted;
a stepper press, a chip, a button, a confirm and a slide each count 1.
The new counts (from the push and from the app, kept apart) are in
`docs/audit/manager/day.md` "Totals".

---

## §1 Every decision the Manager makes

| ID | Decision | Who asks (app · role · sample) | What they send | Reaches the Manager today | Manager's choices | What the app writes | Who is told · push · words → what the asker sees | Taps today |
|---|---|---|---|---|---|---|---|---|
| D-1 | **A price under the shop's** (at or above cost) | Sales (`sell/PriceSheet.tsx`, the order) · Grace | the line's `sellPrice`, `priceNote:'under'`, `priceBy`, `priceShop`, `priceAt` (decision-rights §3) on `place_order` | `price.waits` → task `price.approve`, "A price waits for you · Kato Construction — Roofing sheet at 200,000" (0120:219); routed to `PAGE.price` (2307-2313) | Approve · Set price (stepper ≥ cost) · Shop's price (4773-4775) | `items[].priceReview {state, price, was, qty, by, byName, at}` via `decidePrice` → `ow_patch_order` | Grace · `price.decided` "The Manager decided the price · Kato — tell them." (0120:237) — sent on Approve too → Sales "Tell them" on Today only when the price moved (`today/Tell.tsx`); the line reads "{Ruth} decides 1 price" until then (`orders/view.ts:85`) | Approve **2** (push, Approve) · Set **5** (push, Set price, 2 steps, Use this) |
| D-2 | **A line with no selling price, or no known cost** ("Price coming") | Sales (a line placed with no price, `priceAsk`, `src/core/orders.ts:69`) · Grace; Buyer (a `nocost` line) · Denis | the line with no `sellPrice` (or no `price`) | `price.waits` (0120:219), routed to `PAGE.pricenew` (2313) | Set the price (stepper / type, ≥ cost); for no cost: type the cost, then the price (`ACT.ncgo` 4933) | `priceReview` as D-1 (cost through `ACT.ncgo`, logged) | Grace · `price.decided` (0120:237) → "Tell them" | **4** (push, 2 steps, Set) |
| D-3 | **A price up past the sale** (the supplier's new cost is over the selling price) | Buyer (`replies/Price.tsx:127` "Save · Ruth decides") · Denis | `items[].price` (new cost), `priceWas`, `repricedAt`, `priceNote:'nomargin'` | `price.waits` "A price went up past the sale · Kato — Roofing sheet now costs 215,000, more than it sells at. Set the price." (0153:107); routed to `price` or `pricenew` | Set price (Approve is hidden below cost, 4775) · Shop's price | `priceReview` | Grace · `price.decided` "The Manager set a new price · … is now 230,000 each. Tell them." (0153:98); Buyer sees "Price up · Ruth decides" (`orders/rules.ts:139`) until the order moves | **5** (push, Set price, 2 steps, Use this) |
| D-4 | **A counter sale under the shop's price** (the customer is at the counter) | Sales counter (`counter/Ask.tsx`, "Ruth decides" step) · Grace | `counter_sale` waits with the line under the shop's price | `price.waits` "A counter sale waits for your price" (0120:219); routed to the `counter` sheet (2310) | Yes · Back to the shop's price · at cost asks a second yes (`ACT.countersure` 4991) | `priceReview`; `counter_sale` completes on the server | Grace · `price.decided` → Sales `counter/Wait.tsx:85` "Ruth decides first" turns to pay | **2** (push, Yes); 3 at cost |
| D-5 | **A credit hold**: over the limit, or owing past the hold days (21) | Sales (the order placed on credit) · Grace — the server holds it (`ow_gate_reason`, 0119/0174) | `credit:{days}` on the order, the customer's limit and old bills | `credit.hold` "An order waits on credit · Kato would owe 6,400,000 of a 5,000,000 limit" (0120:229, 0167 adds "· no limit set"); routed to `PAGE.approvals` (2320) | Keep held · Cash first / Old bill first · Release (4070) | `payload.creditCheck {decision, by, byName, at, over, ageDays, limit, withIt}` (`ACT.hdecide` 4078) | Grace · `credit.decided` "Credit released" / "Cash first … Tell them." (0131:81); **Keep held tells no one**. The new Sales app never reads `creditCheck`: the row reads "Not paid yet" with Take payment (`orders/data.ts:131`) | **2** (push, Release) |
| D-6 | **On credit for a customer with no limit set** (0167) | Sales · Grace | the order on credit; customer has no limit and no terms | `credit.hold` "… · no limit set" (0167:88); a cash-only customer routes to `PAGE.creditask` (2318) | Cash first · Let it go on credit → limit chip → terms chip → go (4166-4176) | `customers.credit_limit`, `terms_days` (`ckWriteCredit`, credit.set) + `creditCheck` + `creditAsk.answer` (`answerAsk` 4210) | Grace · `credit.decided` (0131:81); the salesperson who last sold to them · `customer.changed` "{customer} changed · Ruth: On credit: limit 500,000, 14 days" (0158:136, via `ceTell`) | Credit **5** (push, Let it go, limit, terms, go) · Cash first **2** |
| D-7 | **The Store asks "on credit?"** for a packed, unpaid order of a cash customer (0156) | Store (Load, `store.html` letGoAsk → `creditAsk`) · Musa | `payload.creditAsk {at, by, byName, carrier}` | `credit.ask` "Not paid · let it go on credit? · Musa has Ggaba Stores packed · owes 430,000 · cash customer. Credit or cash first?" (0156:125); routed to `creditask` (2318); pinned first on Today (`needsYou` 2597) | as D-6 | as D-6 | Musa · `credit.ask.decided` "On credit · load it" / "Cash first · keep it" (0156:134) → Store "Let it go on credit · load it" / "Keep it until it is paid" (store.html:3287); Grace · `credit.decided` | Credit **5** · Cash first **2** |
| D-8 | **Invoice a delivered order** (or let it bill itself 24 h after delivery) | the Store's Delivered (`order.deliver`) · Musa — nobody asks | `status:'completed'`, `deliveredAt` | `order.delivered` "Delivered — ready to invoice · Kato — it invoices itself 24 hours after delivery." (0120:262); routed to `PAGE.invoices` (2328) | Invoice (one) · Invoice all (5067) · do nothing (the hourly run bills it, `ow_invoice_due_orders`) | `invoice_order(shop, order)` (5191) | Esther · `order.invoiced` "Invoiced — send it" (0138:568); Grace · "Your order is invoiced · INV-0548 for Kato — 430,000 to collect" (0138:572) | **2** (push, Invoice); 0 if left to the run |
| D-9 | **A small invoice** (total under 1,000) | the hourly run (0169 OWSML) — nobody asks | the order | `invoice.held` "Delivered, not invoiced · Kato — {the database's error text}" (0169:833); routed to `invoices` (2334) | Bill it (10 s Undo) · Fix the order (`PAGE.smallinv` 5159-5189) | `invoice_order(…, p_small_ok)` | as D-8 | **3** (push, Invoice, Bill it) |
| D-10 | **Given away**: a line billed at 0 | Sales typed 0, or the run (0169 OWGIV) | the line at 0 | `invoice.held` with code OWGIV → routed to `invoices` (2334, OWGIV is not in the price branch) | per line: Free · given away + a why · or To price (`PAGE.givenaway` 5081) | `items[].givenAway {why}` then `invoice_order` | as D-8; "To price" goes to D-2 | **5** (push, Settle, Free, why, Invoice) |
| D-11 | **The run could not invoice** (a price or short pick waits) | the hourly run (0139) | the order and its code | `invoice.held` (0169:833); OWTPC/OWPRC → `price.waits` route, OWSHP → `pick.short` (2331-2333) | the underlying decision (D-1, D-2, D-12) | — | — | the underlying decision's taps |
| D-12 | **A short pick**: bill what went, or the full quantity | Store (pack short) · Musa | `items[].pickedQty` < `qty`, `pickingStatus:'done'` | `pick.short` "A short pick to settle · Kato — the shelf did not have it all. Bill what went, or the full quantity." (0120:244); routed to `PAGE.shortpick` (2326) | Bill what went · Bill the full quantity (5217) | `items[].qty` (went) or `pickShortfallAckAt` (full) + `pickSettle {pick, by, byName, at, lines}` (`ACT.spgo` 5223) | **No push.** The page says "{Grace} is told" (5216). Store shows the answer on With Ruth (store.html:3291); Sales sees the bill change on refresh | Went **2** (push, Bill) · Full **3** (push, pick, Bill) |
| D-13 | **A trip's check-in differs** from what the Buyer brought | Store (`receive_trip`, `yardQty`, `yardWhy` 0157) · Musa | `collection_trips.lines[].yardQty`, `yard_checked_at/by` | `trip.difference` "A trip came in short or over · From Kiseka Steel: the yard's count is not what the Buyer brought." (0150:83); routed to `PAGE.tripcount` (2335) | Accept the yard's count (slide, 5307) · Nudge Denis | `accept_trip_difference(p_trip_id)` (5311) | **No push.** The page says "{Denis} is told" (5306). Store shows "Ruth accepted your check-in" on With Ruth (store.html:3298) | **2** (push, slide); **3** with a Buyer's note (Seen + slide) |
| D-14 | **The Buyer's yard note** (why the trip differs) | Buyer · Denis (old buyer.html `passOn('yard_note')`; **the new Buyer app sends none**) | `buyer_handoffs` kind `yard_note` | `trip.yard_note` "Why the trip's count differs · From Kiseka Steel — Denis: …" (0151:178); routed to `tripcount` (2337-2341) | Seen (5269) — or closed with D-13's slide | `buyer_handoffs.status:'done'` (`closeYardNotes` 5257) | nobody | **2** (push, Seen) |
| D-15 | **Goods on the truck that were not on the list**: keep it? | Store (`rcextra`, store.html:2486) · Musa | `store_asks` kind `extra` {name, key, qty, unit, why, newItem} | `store.extra` "Not on the list · keep it? · Musa found 2 bags cement on the truck that was not on the list. Keep it or send it back?" (0159:338) → task `trip.difference`; **not routed, not read, not counted**: `loadAll` (1185) never reads `store_asks` | none in the app (`answer_store_ask` exists, 0157) | — | Musa would get `store.ask.decided` "Keep it" / "It goes back" (0159:352); today the Store's "Not on the list · … keep it?" waits on Ruth for good (store.html:3278) | **not possible** |
| D-16 | **Write off damaged, lost or stolen stock** (or keep it on the shelf) | Store (report a loss) · Musa | `stock_reports {key, qty, why, note}` | `stock.report` "Stock reported damaged · 3 roofing sheet — Musa" (0129:30); routed to `PAGE.writeoff` (2342) | Write off (slide; a switch per report, all on) (5334). **No "keep it on the shelf"**: an unticked report stays `sent` for ever | `write_off_stock(p_report_ids, p_lines, p_reason)` (5341) | Musa · `stock.report.decided` "Your report was decided · 3 roofing sheet written off by Ruth" (0131:150) → Store "Ruth wrote off 3 …" (store.html:3274). The Store also draws "Kept it on the shelf", which the Manager app can't send | Write off **2** (push, slide) · Keep **not possible** |
| D-17 | **Accept a stock take** (or ask for a recount) | Store (blind count) · Musa | `stock_counts {aisle, lines[counted, system]}` | `stock_count` from the `notify-stock-count` function "Stock take done · Aisle B · Musa counted 12 blind. 2 differ: …" (index.ts:96-116), to owner, admin and manager logins; **not routed** in manager.html (spec 06 §6b row "✗ in Manager") | Accept the count (slide) · Recount N (5360) | `accept_stock_count(p_id)` / `ask_recount(p_id)` (5363-5366) | **No push.** Store shows "Accepted your count" / "Asked for a recount" on With Ruth (store.html:3263) | **4** (push → Today, Stock tile, row, slide) |
| D-18 | **A return: raise a credit note** (or keep it as sold) | Sales (`orders/Wrong.tsx:150` "Ask Ruth for the credit note") · Grace; Store (`store_return_ask` 0159) · Musa; Accounts (`PAGE.propose`, accounts.html:6332) · Esther | `invoice_asks` kind `credit` {lines[idx, qty], amount, reason, note} | `invoice.ask` "An invoice to void or credit · Grace asks to credit INV-0548 · Kato · 84,000 — Damaged" (0131:123); routed to `PAGE.return` (2343-2347) | per line qty, back on the shelf or damaged, Off what they owe / Cash back; Raise the credit note (slide) · Decline the ask (5399) | `creditNotes[]` via `changeOrder` + `manager_stock_move` + `decide_invoice_ask(accepted)` (5410-5426) — the old path, not 0176's `raise_credit_note` | the asker · `invoice.ask.decided` "Your credit ask was decided · INV-0548 · Kato — credit note raised by Ruth." (0131:132) → Sales order; Store "Raised the credit note" / "Kept it as sold" (store.html:3269) but the Store's `pushOpen` does not route this kind. The page says "Accounts and Grace are told" (5397): Accounts is not | **2** (push, slide); 3 with Cash back |
| D-19 | **Void an invoice** (with its money: refund or deposit) | Sales (`orders/Wrong.tsx` "Cancel the bill") · Grace; Accounts (`PAGE.propose`) · Esther | `invoice_asks` kind `void` {amount, reason} | `invoice.ask` "… Grace asks to void INV-0548 …" (0131:123); routed to `PAGE.void` (2345) | why (Raised twice · Wrong customer · Order cancelled, 5443); with money: Refund (account) · Keep as deposit; Void (slide) · Keep it · decline (5513) | `void_with_money` (5486) or `voided` + `manager_stock_move` + `void_sale_bills` + `decide_invoice_ask` (`voidAskWrite` 5521-5547) — not 0176's `void_invoice` | the asker · `invoice.ask.decided` "… voided by Ruth." (0131:132). The page says "Accounts and Grace are told" (5511) | No money **2** (push, slide) · with money **4** (push, Refund, account, Void) |
| D-20 | **Sales asks to cancel** an order before it is invoiced (0181) | Sales (`orders/Change.tsx`) · Grace | `cancel_asks {quote_id, why, note, amount, stage}` via `ask_cancel` | `order.cancel.ask` "Cancel asked · Grace asks to cancel #0558 · Ggaba Stores · 430,000 — changed their mind" (0181:243) → task `order.cancel`; **not routed** (no `'order.cancel.ask'` in manager.html); counted in the Returns tile (4640, 4671) | Keep the order · Cancel #0558 (+ Refund / Deposit when paid) (5654) | `answer_cancel_ask(p_id, p_yes, p_note, p_choice, p_account)` → `cancel_order` (5669) | Yes: Grace · `order.cancelled` "Order cancelled · Ggaba Stores #0558 — Ruth cancelled it: …"; the yard · "Called off · stop packing" (0177:212-221). No: Grace · `order.cancel.ask.decided` "Not cancelled · #0558 — Ruth kept it." (0181:251) → Sales "Ruth kept the order" (`OrderParts.tsx:286`). **The Buyer is not pushed** though the page promises "Denis stops" (cancelask, 5646) | **4** (push → Today, Returns tile, row, Cancel); 5 with money |
| D-21 | **Taken twice?** two live orders for one customer close together | nobody — the app spots it (`obDupPairs` 3583) | — | no push; Today's Needs-you row "Taken twice? #0558 & #0559" (2655) | Keep both · pick the one to drop → Void it (+ money) (`PAGE.dup` 3632) | `obVoidDup` (3606): `cancelledAt` + `voidedBy` + `voided` written by the phone, **not `cancel_order`** | **nobody** (no `order.cancelled`, the yard and Grace are not pushed) | **4** (app, row, pick, Void) |
| D-22 | **An agent asks to change or cancel** | Agent app (`agent-change-order`) · Peter | `payload.agentChange {state:'asked', lines[to]}` or `agentCancel {reason}` | `agent.change` "An agent asks to change an order · … they ask for fewer." / `agent.cancel` (0120:250-258); routed to `PAGE.agentask` (2327) | per line Agree / Keep; Answer the agent · Agree to cancel / Keep the order (5597) | `agentChange.lines[].decision`, `agentCredit`, `agentCancel.agreed` (`ACT.agdo` 5600) — the cancel only flags the order (cross-app R1 "found in passing") | **No push.** The page and toast say "The agent and the buyer are told" (5596, 5616) | **2** (push, Answer) |
| D-23 | **Hold a restock line** ("not yet") | Buyer's restock list · Denis (old buyer.html; the new Buyer app has no restock screen, `src/core/buyer/supabase/read.ts:9`) | `restock_buys` status `planned` | no push (nothing asks; a link on Decide "Denis's restock list", 4725) | Not yet · Held · undo (5760) | `hold_restock_buy(p_id, p_hold)` (5772) | Denis · `restock.held` "The Manager held a restock line · Cement — not to buy for now." / `restock.released` (0136:547-552) → the new Buyer opens Today (`shell/native.ts:38`) | **4** (app, Decide, list link, Not yet) |
| D-24 | **A carton for the shelf**: the rest of a carton bought for one order | Buyer · Denis (old buyer.html `cartonGate`; **the new Buyer app asks none** — `buy.ts:92` only reads the answer) | `restock_buys` held, `for_line` | `carton.ask` "A carton to OK · Denis asks: 8 roofing sheet for the shelf, the rest of a carton bought for one order · 336,000." (0151:53); routed to `restock` (2324) | Refuse (buy only what the order needs) · Approve the shelf part (5724) | `hold_restock_buy(false)` / `refuse_restock_buy` (5735-5736) | Denis · `carton.refused` "Ruth said no to the carton" (0158:72); a yes is `restock.released` "The Manager let a restock line go ahead" | **2** (push, Approve) |
| D-25 | **Edit a customer**: limit, terms, details; tell Sales | the Manager (from a debtor); Sales and Accounts may only propose (decision-rights `credit.set`) — **no ask exists**: Accounts' "Void, credit note, limit, terms — Ruth · ask" (accounts.html:3254) offers void and credit note only; Sales shows "No limit set · Ruth decides" with nothing to tap (`customers/cust-head.tsx:128`) | — | no push | limit / terms steppers, phone, place; Save; Tell {Grace} (`PAGE.custedit` 6095, `ceask`) | `customers` row (credit.set / customer.edit guard, 0122) + `tell_customer_change` (6160) | Grace · `customer.changed` "{customer} changed · Ruth: …" (0158:136) → Sales customer page | **8** (app, Money, debtor, Limit and terms, 2 steps, Save, Tell) |
| D-26 | **Merge two records of one customer** | nobody (the app's look-alike rules) | — | no push; Money's "Look alike" card (3883, 5981) | Merge (pick the one kept, confirm, Undo 10 s) · Not the same · Fix the phone (`PAGE.lookalike` 5999) | `merge_customers(p_keep, p_drop)` (6040) | owner's log only | **6** (app, Money, card, keep, Merge, confirm) |
| D-27 | **An opening balance** after a fresh start | the fresh start (0148) — nobody asks | `fresh_starts.old_debts` | no push; Money's old-books card | per customer: confirm the amount and since (`PAGE.opening` 6233) | `set_opening_balance` (6270) | owner's log | ≈**6** (app, Money, card, customer, amount, Save) |
| D-28 | **A promise to pay** (recorded by the Manager; Sales and Accounts record theirs too) | Sales (`recordPromise`, `src/core/supabase/write.ts:164`) · Grace; or the Manager | `payment_promises {customer_id, promised_on, amount}` | no push (decision-rights `promise.record` Told: Manager) | — (the Manager's own: day, amount, Save, `PAGE.promise` 6281) | `payment_promises` insert (6307) | — | **6** (app, Money, debtor, Promise, day, Save) |
| D-29 | **Goals and stage limits**, and the hold days | the Manager | — | — | goal per person (steppers), stage limits, hold days; Save (`PAGE.teamrules` 5923) | `set_person_goal` (5951), `set_shop_preset` orderStageLimits / creditHold (5953-5954); `ow_end_targets` ends goals by itself (0169) | **No push** to the salesperson (decision-rights `goal.set` Told: the salesperson) | **5** (app, goal ring, 2 steps, Save) |
| D-30 | **Chase debtors** (bills over 30 days) | nobody (the app's aging) | — | no push; Today's "N customers with bills over 30 days · Chase" (2661) | open a debtor; WhatsApp, call, statement, promise, Take payment (`PAGE.debtor` 3981) | — | the customer, by WhatsApp | **5** (app, Chase, debtor, Nudge/WhatsApp, Open WhatsApp) |
| D-31 | **A stuck order**: give it on, assign it, nudge | nobody (stage limits, `isStuck` 1652) | — | no push; Today's featured card and rows (2617-2655), Orders' badge (2381) | Give it to {Musa} · Move it on yourself · See why · Assign (nobody has it) · Nudge (2619-2645) | `handToPacker` / `handToDriver` / `giveTrip` (1973-2040); the nudge is a WhatsApp link (3750) | packer: notify-worker; driver: `job.given` "A delivery for you" (0158:100); trip runner: `trip.sent` (0150). **A nudge is no push** (decision-rights §3: "A nudge is a push") | Give **2** (app, Give) · Assign **4** · Nudge **5** (app, Nudge, reason, Open WhatsApp, send) |
| D-32 | **A credit limit asked for** (Sales or Accounts propose, decision-rights `credit.set`) | Sales · Grace; Accounts · Esther | — | **no path** (see D-25) | — | — | — | **not possible** |
| D-33 | **Set the markup of a newly listed item** | Sourcing (lists the item, `product.edit`) · Moses | `products` insert with no markup | **no push** (decision-rights `product.edit` Told: Manager "to set the markup") | steppers on Margins; Save (`PAGE.margins` 5852, `ACT.mksave` 5872) | `set_product_markup` / `set_shop_preset defaultMarkup` (5876-5877) | owner's log | **7** (app, Money, Margins, item, 2 steps, Save) |

Asks the Manager makes of others (not the Manager's decisions; listed for the
answer path): "Ask Esther to check" a balance (`payment_asks` 'balance', 3905) →
`payment.ask.decided` (0130:162) comes back, **not routed** in `pushOpen`.

---

## §2 Mismatches

Each with the fix: the one agreed word (GLOSSARY where it exists, a new row
proposed in §3 otherwise).

### Hand-offs with no push, or a push that opens nothing

| # | Kind | What | Fix |
|---|---|---|---|
| M-1 | push not routed | `order.cancel.ask` (0181:243) is sent to `order.cancel`, but `pushOpen` (manager.html:2300-2350) has no branch for it: a tap lands on Today, 3 taps from the ask. Spec 06 §6b row 121 still says ✗. | Route to the cancel ask; `test/phone-push.test.js:76` KINDS.manager gains `order.cancel.ask`. |
| M-2 | no screen | `store.extra` (0159:338) reaches the Manager, but manager.html never reads `store_asks` (`loadAll` 1185-1272), never counts it (`decideCounts` 4640) and never routes it. The Store's "Not on the list · … keep it?" waits on Ruth for good (store.html:3278-3281). `answer_store_ask` (0157) is ready. | Manager reads open `store_asks` kind `extra`, answers **Keep it** / **It goes back** (the Store's words, 0159:352) through `answer_store_ask`. |
| M-3 | push not routed, wrong people | The stock take's push is the `notify-stock-count` function's kind `stock_count` (index.ts:116), to owner, admin and manager logins; manager.html does not route it (spec 06 §6b row 128) and spec 06 Q10 decided "Manager only" (06:177). | Replace with a database push `stock.count` to task `stock.correct` (§4 P-1), routed to the count; retire the function's webhook. |
| M-4 | answer not pushed | Accepting a count or asking a recount (`accept_stock_count`, `ask_recount`, 5363-5366) tells Musa nothing; the Store only finds "Accepted your count" / "Asked for a recount" on With Ruth (store.html:3263). | §4 P-2 `stock.count.decided` to the counter. |
| M-5 | answer not pushed, false promise | A short pick settled writes `pickSettle` (5223) and pushes no one; the page says "{Grace} is told" (5216). decision-rights `pick.settle` Told: Sales. | §4 P-3 `pick.settled` to the salesperson (and the packer). |
| M-6 | answer not pushed, false promise | A trip difference accepted (`accept_trip_difference`, 5311) pushes no one; the page says "{Denis} is told" (5306). decision-rights `trip.difference` Told: Buyer. | §4 P-4 `trip.difference.decided` to the trip's runner and the Store person who checked it in. |
| M-7 | answer not pushed, false promise | The return and void pages say "Accounts and Grace are told" (5397, 5511); only the asker gets `invoice.ask.decided` (0131:132). decision-rights Told: Accounts. | §4 P-6 `invoice.voided`, P-7 `credit_note.raised` to Accounts and the salesperson. |
| M-8 | answer not pushed, false promise | An agent's change or cancel decided pushes no one; manager.html says "The agent and the buyer are told" (5596, 5616). | §4 P-8 `agent.change.decided` to the Buyer (and the agent's app). |
| M-9 | answer not pushed | Cancel yes pushes the yard and the salesperson (0177:212-221), not the Buyer; the cancel page promises "{Denis} stops: off To ask and the trip" (cancelask). The Buyer's On hold just disappears. | §4 P-5: `order.cancelled` also to `trip.plan` when the order had bought-in lines. |
| M-10 | no push at all | A nudge is a WhatsApp link (3750); decision-rights §3: "A nudge is a push, no longer only a WhatsApp link". The FAB is "Nudge" (navHTML 2380). | §4 P-9 `team.nudge` (a function and its push; the task `team.nudge` already exists, 0116, decision-rights "Nudge someone"); the FAB becomes Decide next (day.md). |
| M-11 | no push | A goal set (`set_person_goal`, 5951) tells the salesperson nothing; decision-rights `goal.set` Told: the salesperson. | §4 P-10 `goal.set` (quiet). |
| M-12 | no push | A newly listed item reaches the Manager by no path; decision-rights `product.edit` Told: Manager (to set the markup). | §4 P-11 `markup.wanted`. |
| M-13 | no path at all | decision-rights `credit.set` "Proposes: Sales, Accounts". Accounts' button reads "Void, credit note, limit, terms — Ruth · ask" (accounts.html:3254) but its page offers only void and credit note (6300-6335); Sales' "No limit set · Ruth decides" (`cust-head.tsx:128`) has nothing to tap. | §4 P-12 `credit.limit.ask` (needs a small table, Kevin to approve); until then Accounts drops "limit, terms" from the label. |
| M-14 | answer not pushed | "Keep held" on a credit hold (4070) sends nothing (0131:81 pushes only release and cash), and the new Sales app never reads `creditCheck`: a held order reads **Not paid yet** with Take payment (`src/apps/sales/orders/data.ts:131`); a `credit.decided` push opens an order that says nothing about credit. | Drop "Keep held" (it is the same as not answering; §3); Sales reads `creditCheck` (§5 S-1). |
| M-15 | answer push not routed | The Store's return ask (`store_return_ask`, 0159) gets `invoice.ask.decided` back, but the Store's `pushOpen` (store.html:2666) has no branch for it and `test/phone-push.test.js:80` KINDS.store lacks it. | §5 ST-1. |
| M-16 | answer push not routed | The Manager's own "Ask Esther to check" (3905) is answered by `payment.ask.decided` (0130:162); manager.html does not route it. | Route to the customer's balance card. |
| M-17 | asker missing | The new Buyer app sends no carton ask (`restock_buys.for_line` is only read, `src/core/buyer/supabase/buy.ts:92-96`) and no yard note (no `passOn('yard_note')` in `src/core/buyer`); `restock.held/released` open Today (`shell/native.ts:38`). D-14 and D-24 wait on asks the live Buyer cannot make. | §5 B-3, B-4: the Buyer's trip gets the carton ask and the note; until then the Manager's tabs show them only when they exist. |
| M-18 | push for nothing that waits | `order.delivered` (0120:262) pushes the Manager for every delivery, though the server bills it by itself 24 h later (decision-rights §3); it waits on nobody. `invoice.held` already tells the Manager when one can't go. | Retire `order.delivered` (§4 changes): delivered orders show on Orders with "bills itself in 18 h". |

### One thing, two or more words

| # | What | Words today (file:line) | Agreed |
|---|---|---|---|
| M-19 | the cancel and its answers | Sales "Cancel asked" (`orders/data.ts:127`); Manager row "Cancel ask · Ggaba Stores" (manager.html:4705), eyebrow "CANCEL ASK · FROM GRACE", buttons "Keep the order" / "Cancel #0558" (5654); push answer titles "Called off" / "Not cancelled", body "{Ruth} **voided** it" / "kept it" (0181:251-256); 0177 "Called off · stop packing", "Order cancelled" (0177:212-218). | Ask **Cancel asked**; answers **Cancelled** / **Kept**. "Voided" only for an invoice (M-20). "Called off" goes. |
| M-20 | a cancel done as a void | "Taken twice?" (2655) voids a not-invoiced order on the phone (`obVoidDup` 3606-3616: `cancelledAt`, `voidedBy`, docLog "Voided · taken twice") outside `cancel_order`: no push to the yard or Grace; toast "#0559 voided · it leaves every list" (3676). Glossary: cancel before the invoice, void after (decision-rights §3). | **Cancel #0559 · keep #0558**, through `cancel_order` (0177) with why "Entered twice". |
| M-21 | why a bill goes | Manager "Raised twice" · "Wrong customer" · "Order cancelled" (VOID_WHY 5443); Sales "Entered twice" · "Wrong items or how many" (`Change.tsx:102`); Accounts "Returned" · "Damaged" · "Wrong price" · "Entered twice" (accounts.html:6322). | **Entered twice**, **Wrong customer**, **Wrong price**, **Damaged**, **Changed their mind**, **Something else** (one list, all three apps). |
| M-22 | a return | Sales "Return asked" (`data.ts:123`) **and** "Credit asked" (`view.ts:108`) for the same ask; push "An invoice to void or credit · Grace asks to credit INV-0548" (0131:123); Manager "Return · Kato" (4703), "RETURN · GRACE ASKS", "Decline the ask" (5399); Store "Return · #0548", answers "Raised the credit note" / "Kept it as sold" (store.html:3269); Accounts "Credit note" (6332). | Ask **Return asked**; answers **Credit note raised** / **Kept as sold** (the Store's, tidied). |
| M-23 | a void | Sales "Void asked" (`data.ts:124`); Manager "Void · Kato" (4704), "Keep it · decline" (5513); push "Your void ask was decided · … declined by Ruth" (0131:132). | Ask **Void asked**; answers **Voided** / **Kept as billed**. |
| M-24 | a credit hold | push "An order waits on credit" (0120:229); Manager "Needs a yes · 2 left", "ON HOLD IN CHECKING" (4041), "2 held for credit · over a limit · owing past 21 days" (4691), answers "Keep held" · "Cash first" / "Old bill first" · "Release" (4070); push answer "Credit released" / "Cash first" (0131:81); Sales "No limit set · Ruth decides" (`cust-head.tsx:128`, glossary) but nothing on the order (M-14). | Ask **On credit? · {Ruth} decides**, with the reason as a chip: **Over the limit** · **Old bill · 34 days** · **No limit set**. Answers **On credit** / **Cash first**. "Release", "Needs a yes", "Old bill first", "Keep held" go. |
| M-25 | the Store's "on credit?" | push "Not paid · let it go on credit?" (0156:125); Manager "Let it go on credit?" with "Cash first" / "Let it go on credit" (4183, 4176); push answer "On credit · load it" / "Cash first · keep it" (0156:134); Store "Let it go on credit · load it" / "Keep it until it is paid" (store.html:3287); glossary **Not paid yet**. | Ask **Not paid yet · on credit?**; answers **On credit · load it** / **Cash first · it stays** — the push, the Store and the Manager the same. |
| M-26 | a price waiting | push "A price waits for you" (0120:219) and "A price went up past the sale … Set the price." (0153:107); Manager eyebrow "PRICE TO APPROVE" / "COST WENT UP" (price page), tile "Prices"; Sales "{Ruth} decides 1 price" (`view.ts:85`), "Price coming" (glossary); Buyer "Price up · Ruth decides" (`orders/rules.ts:139`). | Three asks, each "· {Ruth} decides": **Under the shop's price**, **Price up**, **Price coming**. Answers **Approved** / **Price set · 205,000** / **Shop's price**. |
| M-27 | the price answer | push "The Manager decided the price … tell them." (0120:237) sent on Approve too, when there is nothing to tell; "The Manager set a new price" (0153:98) — a role word where the glossary says the person's name; Manager toast "Approved · Grace told" (4824). | Only when the price moved: **{Ruth} set a new price · Tell them**. Approve sends nothing to tell (the line just loses "Ruth decides"). |
| M-28 | a trip difference | Manager "TRIP COUNT DIFFERS", "Accept the yard's count", "yard counted" (5299, 5307), row "Trip count differs · Kiseka Steel" (4698); push "A trip came in short or over · … the yard's count is not what the Buyer brought." (0150:83); glossary **Check-in** ("a count is of an aisle or an item"; store.html:3298 "Your check-in of Denis's trip"). | Ask **{Musa}'s check-in differs**; answer **Take the check-in**. "Count" stays for the stock take only. |
| M-29 | a short pick | Manager "Short pick", "SHORT PICK · MUSA FOUND LESS", "Bill what went" / "Bill the full quantity" (5214, 5217); push "A short pick to settle … Bill what went, or the full quantity." (0120:244); Store's own action "Pack short" (glossary), its With-Ruth row "Short pick · #0548" (store.html:3290). | Ask **Packed short · {Ruth} decides the bill**; answers **Bill what went** / **Bill it all**. |
| M-30 | a loss report | Manager row "Damaged stock to write off" for every report, lost and stolen too (4700); push "Stock reported damaged" (0129:30); Store "Damaged · / Stolen · / Lost · {item}" (store.html:3274). | Ask **Damaged** / **Lost** / **Stolen · {item}**; answers **Written off** / **Kept on the shelf**. |
| M-31 | the carton | push "A carton to OK" (0151:53); Manager "A carton to OK" row (4701), buttons "Refuse" / "Approve the shelf part" (5724), stamps "SHELF OK" / "ORDER ONLY"; push answer "Ruth said no to the carton" (0158:72) and, for yes, "The Manager let a restock line go ahead" (0136:552). | Ask **A carton for the shelf? · {Ruth} decides**; answers **Shelf part OK** / **Order only**. |
| M-32 | the restock hold | Manager "Not yet" / "Held · undo" (5760); push "The Manager held a restock line … not to buy for now." / "… let a restock line go ahead" (0136:547-552). | **Not yet** / **Go ahead**, with Ruth's name. |
| M-33 | the invoice run | "SKIPPED BY THE NIGHT RUN" (5064), "The night run leaves such an order" (5150); decision-rights and 0139 "the hourly run"; push "it invoices itself 24 hours after delivery" (0120:262); invoices eyebrow "NOW, OR AUTO AT 24 H". | **Bills itself 24 h after delivery**; a skipped one is **Can't bill itself · {why}**. |
| M-34 | system words in a push | `invoice.held` body is the database's error text (`v_why := sqlerrm`, 0169:833), e.g. "OWTPC: a line has no selling price yet". Glossary copy rule: no system words. | Body by code: **Price coming · {Ruth} decides**, **Packed short**, **Only 567 · check it**, **A line at 0 · given away?** |
| M-35 | Checking named to the Manager | Sales "{Ruth} · checking" (`view.ts:85`) when nothing waits on Ruth; glossary (X-3): **{Buyer} asks the suppliers**, the Manager only when a price or credit waits. | "{Denis} asks the suppliers". |
| M-36 | Start with the oldest | Decide now's red button "Start with the oldest" (4673) opens the list, not the oldest decision. | The FAB **Decide next** opens the oldest itself (day.md). |
| M-37 | role words in pushes | "The Manager held a restock line" (0136:547), "The Manager decided the price" (0120:237), "The Manager set a new price" (0153:98), "the Manager" fallbacks where the decider is known. Glossary People: the display name. | `ow_first_name(shop, auth.uid())` in every Manager answer push. |
| M-38 | a state shown wrong | The cancel page's "packed" test is `q.status === 'out_for_delivery'` (cancelask, 5643); the stage is `pending_delivery` (glossary stages), so an order on the road reads "Nothing was packed". | `pending_delivery`. |

---

## §3 One agreed word per hand-off

The vocabulary the redesign uses. Every ask ends "· {Manager} decides" on the
asker's screen while it waits (Sales, Buyer and Store already do this:
`orders/data.ts:130`, `orders/rules.ts:139`, store.html With Ruth). Names are
display names (glossary People).

The push title is `{asker} · {ask word} · {#order}`, its body the evidence, and its one action the safe answer (§4, "Pushes that carry their evidence and their answer"); the same button sits on the Manager's Needs-you row.

| Hand-off | Ask word (asker's screen, Manager's row, push title) | Answer words (Manager's buttons = asker's screen = push title) | Push to the Manager | Push back |
|---|---|---|---|---|
| D-1 under the shop's price | **Under the shop's price** · Ruth decides | **Approved** · **Price set · 205,000** · **Shop's price** | `price.waits` | `price.decided` "Ruth set a new price · Tell them" — only when the price moved |
| D-2 no price / no cost | **Price coming** · Ruth decides | **Price set · 205,000** | `price.waits` | `price.decided` |
| D-3 price up | **Price up** · Ruth decides | **Price set** · **Shop's price** | `price.waits` | `price.decided` |
| D-4 counter sale | **At the counter · under the shop's price** | **Approved** · **Shop's price** | `price.waits` | `price.decided` |
| D-5, D-6 credit | **On credit?** · Ruth decides (chip: Over the limit · Old bill · 34 days · No limit set) | **On credit** · **Cash first** | `credit.hold` | `credit.decided` |
| D-7 the Store's ask | **Not paid yet · on credit?** | **On credit · load it** · **Cash first · it stays** | `credit.ask` | `credit.ask.decided` (Musa), `credit.decided` (Grace) |
| D-8 invoice | **Delivered · bills itself in 18 h** (no ask) | **Invoice now** | — (retire `order.delivered`) | `order.invoiced` |
| D-9, D-10, D-11 can't bill itself | **Can't bill itself** · {Only 567 · check it / A line at 0 · given away? / Price coming / Packed short} | **Bill it** · **Given away · {why}** · (the underlying answer) | `invoice.held` (words by code) | `order.invoiced` |
| D-12 short pick | **Packed short** · Ruth decides the bill | **Bill what went** · **Bill it all** | `pick.short` | **NEW** `pick.settled` |
| D-13, D-14 check-in | **Musa's check-in differs** (+ Denis's note) | **Take the check-in** | `trip.difference` (+ `trip.yard_note`) | **NEW** `trip.difference.decided` |
| D-15 extra on the truck | **Not on the list · keep it?** | **Keep it** · **It goes back** | `store.extra` | `store.ask.decided` |
| D-16 loss | **Damaged** / **Lost** / **Stolen** · {item} | **Written off** · **Kept on the shelf** | `stock.report` | `stock.report.decided` |
| D-17 stock take | **A count to check** · {Aisle B} | **Count taken** · **Count it again** | **NEW** `stock.count` | **NEW** `stock.count.decided` |
| D-18 return | **Return asked** · Ruth decides | **Credit note raised** · **Kept as sold** | `invoice.ask` | `invoice.ask.decided` (asker), **NEW** `credit_note.raised` (Accounts, Grace) |
| D-19 void | **Void asked** · Ruth decides | **Voided** · **Kept as billed** (with money: **Refund** · **Deposit**) | `invoice.ask` | `invoice.ask.decided` (asker), **NEW** `invoice.voided` (Accounts, Grace) |
| D-20 cancel | **Cancel asked** · Ruth decides | **Cancelled** · **Kept** | `order.cancel.ask` (route it) | `order.cancelled` (Grace, yard, **+ Buyer**), `order.cancel.ask.decided` (no) |
| D-21 taken twice | **Taken twice?** | **Cancel #0545 · keep #0544** · **Both are real** | — (the app spots it) | `order.cancelled` |
| D-22 agent | **Peter asks: fewer** / **Peter asks to cancel** | **Agreed** · **Kept** (per line) | `agent.change`, `agent.cancel` | **NEW** `agent.change.decided` |
| D-23 restock | (the Buyer's list) | **Not yet** · **Go ahead** | — | `restock.held`, `restock.released` |
| D-24 carton | **A carton for the shelf?** · Ruth decides | **Shelf part OK** · **Order only** | `carton.ask` | `restock.released` / `carton.refused` |
| D-25, D-32 limit | **Credit asked · {customer}** · Ruth decides | **Limit 500,000 · 14 days** · **Cash only** | **NEW** `credit.limit.ask` | **NEW** `credit.limit.ask.decided`; `customer.changed` |
| D-28 promise | **Promised · 500,000 · Fri** (no ask) | — | **NEW** `promise.made` (quiet) | — |
| D-29 goal | — | **Goal · 35,000,000** | — | **NEW** `goal.set` (quiet) |
| D-30, D-31 chase, stuck | — | **Nudge {Grace}** · **Give it to {Musa}** | — | **NEW** push `team.nudge` (task in 0116); `job.given`, `trip.sent` |
| D-33 markup | **A new item to price** · {item} | **Markup 25%** | **NEW** `markup.wanted` | — |

**Glossary rows to add** (`docs/audit/GLOSSARY.md`, Decided "Manager R2 · handover"):

| Word | Means | Never |
|---|---|---|
| … · {Manager} decides | The one tail every ask carries on the asker's screen while it waits | waiting for the Manager; with Ruth (as a status); Needs a yes |
| Under the shop's price · Price up | The two price asks besides Price coming | price to approve; cost went up |
| Approved · Price set · Shop's price | The three price answers | Release; decided |
| On credit? · On credit · Cash first | The credit ask and its two answers; the reason is a chip (Over the limit · Old bill · No limit set) | Needs a yes; Release; Keep held; Old bill first; held for credit |
| Packed short · Bill what went · Bill it all | The short pick: the Store's act, the Manager's two answers | short pick to settle; bill the full quantity |
| {Store}'s check-in differs · Take the check-in | A trip's check-in unlike the Buyer's; the Manager's answer | trip count; the yard's count; came in short or over |
| A count to check · Count taken · Count it again | A stock take and its answers | stock take done; accept the count; recount N |
| Written off · Kept on the shelf | The loss answers | dismissed |
| Return asked · Credit note raised · Kept as sold | The return | credit asked; decline the ask |
| Void asked · Voided · Kept as billed | The void | keep it · decline |
| Cancelled · Kept | The cancel answers | Called off; voided (for a cancel) |
| Entered twice | One of the shared reasons a bill or order goes | Raised twice; taken twice (as a reason) |
| Bills itself 24 h after delivery | The automatic invoice | night run; hourly run; auto at 24 h |
| Shelf part OK · Order only | The carton answers | Approve the shelf part; Refuse; said no to the carton |
| Not yet · Go ahead | The restock hold | held a restock line; let it go ahead |
| Decide next | The Manager's FAB: the oldest waiting decision | Start with the oldest (which opened a list) |

---

## §4 Pushes that don't exist yet: one migration after approval

**Number.** The Manager's reserved numbers are all used: 0122 (Manager), 0158
(Manager, the asks answered) and 0169 (Manager round 1, taken as the next free
number and reserved in its Phase B) — `docs/decision-rights.md` §5 table. None
is free. The highest migration on the branch is **0181**
(`supabase/migrations/0181_sales_cancel_ask.sql`), so this is **0182**, and it
**must be reserved** in that table before it is built (cross-app ROUND-1 also
named 0182 as "the next free number" but did not reserve it, as it needed no
migration). The table's footnote "the next number after 0127" is out of date.
New tables, functions and tasks also need their `test/decision-rights.test.js`
rows. No new task: every recipient below is an existing task or user.

Every push is written by `ow_push(shop, kind, title, body, to_user, to_task,
to_role, ref, dedupe)` in the same transaction, inside `begin … exception when
others` like 0131. `{Ruth}` = `ow_first_name(shop, auth.uid())`; `#0548` =
`'#' || lpad(id, 4, '0')`.

| # | Kind | Trigger | Recipient | Title | Body | Ref |
|---|---|---|---|---|---|---|
| P-1 | `stock.count` | `stock_counts` after insert, `status = 'sent'` (replaces `notify-stock-count`) | task `stock.correct` | `A count to check · {aisle}` | `{Musa} counted {12} items · {2} differ: Roofing sheet −2, Cement +1` (or `· all match`) | `{table:'stock_counts', id}` |
| P-2 | `stock.count.decided` | `stock_counts` after update, `old.status = 'sent'` and `new.status in ('accepted','recount')` | user `new.counted_by` | `Count taken · {aisle}` / `Count it again · {aisle}` | `{Ruth} took your count. The shelf now matches it.` / `{Ruth} asks for a new count of {2} items.` | `{table:'stock_counts', id}` |
| P-3 | `pick.settled` | `saved_quotes` after update, `payload ? 'pickSettle'` and its `at` is new | user `payload.takenBy`; and the packer (`staff.user_id` of `assignedWorkerId`) | `{Ruth} billed what went · #0550` / `{Ruth} billed it all · #0550` | `Kato Construction — 36 of 40 Iron sheet G28 · now 1,710,000. Tell them.` / `Kato Construction — 40 Iron sheet G28 billed in full.` | `{table:'saved_quotes', id}` |
| P-4 | `trip.difference.decided` | `collection_trips` after update, `difference_accepted_at` null → set | user of `assigned_worker_id` (the runner); user `yard_checked_by` | `{Ruth} took {Musa}'s check-in` | `{Denis}'s trip · Owino Plumbing — the shelf has the yard's 11 of 12.` | `{table:'collection_trips', id}` |
| P-5 | `order.cancelled` (to the Buyer; extends 0177's `cancel_order`) | inside `cancel_order`, when the order was in Checking or Buying with a line from a supplier not received | task `trip.plan` | `Cancelled · stop buying` | `#0556 · Ggaba Stores — {Ruth} cancelled it. Off To ask and the trip.` | `{table:'saved_quotes', id}` |
| P-6 | `invoice.voided` | `saved_quotes` after update, `invoiced and not old.voided and new.voided` | task `invoice.send` (Accounts); user `payload.takenBy` unless it is the asker | `Voided · #0545` | `Kato Construction · 320,000 — {Ruth}: entered twice.` + `· refund 200,000 cash` / `· 200,000 kept as a deposit` | `{table:'saved_quotes', id}` |
| P-7 | `credit_note.raised` | `saved_quotes` after update, `jsonb_array_length(payload->'creditNotes')` grows | task `invoice.send`; user `payload.takenBy` unless the asker | `Credit note raised · #0547` | `Lubowa Builders — 5 Timber 2×4 back · 56,250 off what they owe.` (or `· 56,250 to pay back`) | `{table:'saved_quotes', id}` |
| P-8 | `agent.change.decided` | `saved_quotes` after update, `agentChange.state` asked → agreed/declined, or `agentCancel.agreed`/`declined` set | task `trip.plan` when the order has a line from a supplier; the agent through the agent app (its own notice, `agent-nudge`) | `{Ruth} answered {Peter}` | `#0560 · {client} — 8 Cement 50 kg fewer. Buy only what is left.` / `#0560 — cancelled.` / `— kept as it is.` | `{table:'saved_quotes', id}` |
| P-9 | `team.nudge` | new function `nudge_person(p_shop uuid, p_to uuid, p_order bigint, p_words text)` (task `team.nudge`, already granted to the Manager in 0116 and in decision-rights "Nudge someone"), logs and pushes | user `p_to` | `{Ruth} nudged you` | `{the words}` e.g. `The Lubowa Builders order (#0554) has waited 2 h 40 m in Checking, 40 m over its limit. Can you sort it now?` | `{table:'saved_quotes', id}` or `{table:'staff', id}` |
| P-10 | `goal.set` (quiet: feed and badge, no sound) | `manager_notes` after insert or update, `kind = 'target'` and `body ? 'who'` and the aim changed | user `body.who` | `Your goal for {November}` | `{35,000,000} · {Ruth} set it` | `{table:'manager_notes', id}` |
| P-11 | `markup.wanted` | `products` after insert by a login holding `product.edit` and not `markup.set` | task `markup.set` | `A new item to price` | `{Moses} listed {PVC pipe 4 in} · set its markup` | `{table:'products', id}` |
| P-12 | `credit.limit.ask`, `credit.limit.ask.decided` | **needs a table** `customer_asks (id, shop_id, customer_id, kind 'limit', amount, days, why, asked_by, asked_by_name, status sent/accepted/declined/withdrawn, decided_by, created_at)` with `ask_credit_limit` (`quote.make` or `finance.see`) and `answer_credit_limit` (`credit.set`, writes the customer's limit and terms through the 0122 guard). Kevin approves the table first. | ask → task `credit.set`; answer → user `asked_by` | `Credit asked · {Ggaba Stores}` / `{Ruth} set {Ggaba}'s limit` · `{Ruth} kept {Ggaba} on cash` | `{Esther} asks 3,000,000 · 14 days — {why}` / `Limit 3,000,000 · 14 days.` | `{table:'customer_asks', id}` |
| P-13 | `promise.made` (quiet) | `payment_promises` after insert by a login without `credit.set` | task `credit.set` | `{Kato} promised 500,000 · Fri` | `{Grace} took the promise · they owe 1,034,000.` | `{table:'payment_promises', id}` |

**Changes to pushes that exist** (same migration, the words of §3):

| Kind | Now | Change |
|---|---|---|
| `price.decided` (0120:237, 0153:98) | sent on any answer, "The Manager decided the price … tell them." | send only when `priceReview.price` differs from what the line carried; title `{Ruth} set a new price`, body `{client} — {item} is now {205,000} each. Tell them.` |
| `price.waits` (0120:219, 0153:107) | "A price waits for you" / "A price went up past the sale" | `Under the shop's price · {client}` / `Price up · {client}` / `Price coming · {client}` / counter `At the counter · {item} at {200,000}` |
| `credit.hold` (0120:229, 0167) | "An order waits on credit" | `On credit? · {client}`, body with the chip: `over the limit · would owe 6,400,000 of 5,000,000` / `old bill · 34 days` / `no limit set` |
| `credit.ask` (0156:125) | "Not paid · let it go on credit?" | `Not paid yet · on credit?` |
| `credit.ask.decided` (0156:134) | "Cash first · keep it" | `Cash first · it stays` (body unchanged) |
| `pick.short` (0120:244) | "A short pick to settle" | `Packed short · {client}`, body `{Musa} packed 4 of 6 roofing sheets. Bill what went or bill it all?` |
| `trip.difference` (0150:83) | "A trip came in short or over" | `{Musa}'s check-in differs`, body `{Denis}'s trip · Owino Plumbing — 11 of 12 checked in.` |
| `stock.report` (0129:30) | "Stock reported damaged" | `{Damaged|Lost|Stolen} · {3} {roofing sheets}`, body `{Musa} reported it. Write it off?` |
| `invoice.held` (0169:833) | body = `sqlerrm` | body by code: OWTPC/OWPRC `Price coming · decide it to bill`, OWSHP `Packed short · decide the bill`, OWSML `Only {567} · check it`, OWGIV `A line at 0 · given away?`, else `Can't bill itself · open it` |
| `order.cancel.ask.decided` (0181:251) | "Called off" / "… voided it." | title `Cancelled` / `Kept`; body `#0556 · Ggaba Stores — {Ruth} cancelled it.` / `— {Ruth} kept it: {answer}`; invoiced first `Billed first · ask for a void` |
| `order.cancelled` (0177:212) | "Called off · stop packing" | `Cancelled · stop packing` |
| `restock.held`, `restock.released` (0136:547-552) | "The Manager held a restock line" | `{Ruth}: not yet · {item}` / `{Ruth}: go ahead · {item}` |
| `carton.refused` (0158:72) | "Ruth said no to the carton" | `Order only · {item}`, body `{Ruth}: buy only what the order needs. The 8 for the shelf stay unbought.` |
| `order.delivered` (0120:262) | pushed to `invoice.make` on every delivery | retire (drop the branch): it waits on nobody; the run bills it, `invoice.held` covers the ones it can't |
| `notify-stock-count` (function) | FCM straight to owner, admin, manager | retire the webhook once P-1 is live |

**Pushes that carry their evidence and their answer** (day.md "Two ways to one
tap"). The title names who asks and what; the body is the evidence (an expanded
notification shows 2–3 lines); the action is the one safe answer, sent through
`answer_from_push` (below) after a 10 s Undo on the notification. An
irreversible money or books move never gets an action; its push offers only the
safe "keep" answer. These words replace the titles and bodies above for the
same kinds. The ten that were at the floor (1 to open + 1 to answer) first:

| D | Kind | Title | Body (the evidence) | Action (`data.actions`) |
|---|---|---|---|---|
| D-1 | `price.waits` | `{Grace} · Under the shop's price · #0555` | `{Iron sheet G28} · {46,000}, shop's {47,500} · cost {38,000} · {30} sht` | `approve` **Approve 46,000** |
| D-4 | `price.waits` (counter) | `{Grace} · At the counter · under the shop's price` | `{Cement 50 kg} · {10} bags at {40,000}, shop's {42,500} · cost {34,000}` | `approve` **Approve 40,000** |
| D-5 | `credit.hold` | `{Grace} · On credit? · {Kyaligonza & Sons}` | `Old bill {38} d (held at {21}) · would owe {3,690,000}` | `credit` **On credit** |
| D-12 | `pick.short` | `{Musa} · Packed short · #0550` | `{Iron sheet G28} {36} of {40} · bill {1,710,000} (full {1,900,000})` | `went` **Bill what went 1,710,000** |
| D-13 | `trip.difference` | `{Musa} · Check-in differs · {Denis}'s trip` | `{Owino Plumbing} · {PVC pipe 4 in} {11} of {12} · {−28,000} at cost` + the Buyer's note when there is one | `take` **Take the check-in** |
| D-16 | `stock.report` | `{Musa} · {Damaged} · {3} {Cement 50 kg}` | `on the shelf {26} → {23} · {−102,000} at cost` | `keep` **Kept on the shelf** only (the write-off is a slide) |
| D-18 | `invoice.ask` (credit) | `{Brian} · Return asked · #0547` | `{5} {Timber 2×4} · {−56,250} · owes {662,000} → {605,750}` | `keep` **Kept as sold** only (the credit note is a slide) |
| D-19 | `invoice.ask` (void) | `{Esther} · Void asked · #0545` | `{Kato} · {320,000} · {entered twice}` + ` with #0544` when a twin exists · `nothing paid` / `{200,000} paid` | `keep` **Kept as billed** only (the void is a slide) |
| D-22 | `agent.change` | `{Peter} · asks for fewer · #0560` | `{Cement} {20} → {12} · {340,000} less · paid {300,000}` (first 2 lines, `+N more`) | `agree` **Agree** |
| D-24 | `carton.ask` | `{Denis} · A carton for the shelf?` | `{Wall plugs} · {1} for the order, {199} for the shelf · {298,500} · ~{14} months of selling` | `ok` **Shelf part OK** |

The other kinds with an action: D-2 `price.waits` (Price coming) **Set 38,750**
(cost + the item's markup, only when both are known); D-3 `price.waits` (Price
up) **Shop's price 33,750**; D-6 `credit.hold` (no limit set) **On credit · 2M
· 14 d** (the smallest of `limitChoices` that covers the order, the shop's usual terms); D-7
`credit.ask` **On credit · load it · 1.5M · 14 d** (the card also offers 2M · 14 d and 3M · 30 d); D-9 `invoice.held` (OWSML)
**Bill 567**; D-15 `store.extra` **Keep it**; D-17 `stock.count` **Count it
again** only; D-20 `order.cancel.ask` **Kept** only; D-32 `credit.limit.ask`
**Limit 3M · 14 d**; D-33 `markup.wanted` **Markup 25% · 35,000**. No
action: D-10 (the why is a choice), D-8 and D-14 (no push), and every slide.

**Also in 0182 for the actions:** `push_outbox.actions jsonb` (the answers the
push offers, `[{id, label}]`, written by the trigger beside the title);
`push_subscriptions.app_build int` (push-send sends `actions` only to a phone
whose shell can show them, build ≥ 3); and one function
`answer_from_push(p_outbox_id bigint, p_action text, p_key uuid)`: it reads the
outbox row, checks the caller is a recipient and holds the decision's task,
checks the ask is still open and unchanged since the push (else refused,
"Someone else just did this"), and calls the same function the app calls
(`decidePrice`'s write through `ow_patch_order`, `creditCheck`, `pickSettle`,
`accept_trip_difference`, `answer_store_ask`, `hold_restock_buy`,
`answer_cancel_ask(no)`, `decide_invoice_ask(declined)`, `write_off`'s keep =
`stock_reports.status 'dismissed'`, `ask_recount`, `answer_credit_limit`,
`set_product_markup`), idempotent on `p_key`. It writes the owner's log line
like the app's answer and carries `via: 'push'`. An action id the row does not
offer is refused, so a push can never carry a money move.

Each new or changed kind is added to `test/phone-push.test.js` `KINDS` (manager:
`order.cancel.ask`, `credit.ask`, `carton.ask`, `store.extra`, `stock.count`,
`markup.wanted`, `credit.limit.ask`, `payment.ask.decided`; sales: `pick.settled`,
`invoice.voided`, `credit_note.raised`, `team.nudge`, `goal.set`,
`credit.limit.ask.decided`; buyer: `trip.difference.decided`,
`agent.change.decided`, `order.cancelled`; store: `stock.count.decided`,
`trip.difference.decided`, `invoice.ask.decided`, `pick.settled`; accounts:
`invoice.voided`, `credit_note.raised`, `invoice.ask.decided`) and to spec 06
§6b.

---

## §5 What each other app needs (for their sessions; not built here)

### Sales (`src/apps/sales`, `src/core`; the old `sales.html` only where it is still served)

- **S-1** Read `payload.creditCheck` and the gate's credit reason in `src/core/supabase/rows.ts` `orderOf` (a `credit: {why: 'limit'|'age'|'nolimit', decision}`), and in `orders/data.ts` `rowStatus` (before "Not paid yet", line 131) say **On credit? · {Ruth} decides** with the chip; after the answer **On credit** / **Cash first · take payment**. `orders/Order.tsx` hides Take payment only while it waits (M-14).
- **S-2** `orders/view.ts:108` "Credit asked" → **Return asked** (M-22); the answers on the order (`OrderParts.tsx` AskSteps, 199-205) read **Credit note raised** / **Kept as sold**, **Voided** / **Kept as billed**.
- **S-3** `orders/OrderParts.tsx:286` "{Ruth} kept the order" → **Kept · {Ruth}: {her words}**; a yes reads **Cancelled** (M-19).
- **S-4** `orders/Change.tsx:102` and `orders/Wrong.tsx` reasons → the shared list (M-21): Entered twice, Wrong customer, Wrong price, Damaged, Changed their mind, Something else.
- **S-5** `orders/view.ts:85` "{Ruth} · checking" → **{Denis} asks the suppliers** (M-35).
- **S-6** `shell/pushes.ts` `PUSHES` (64-80): add `pick.settled`, `invoice.voided`, `credit_note.raised` (→ `order`), `team.nudge` (→ the order or Today), `goal.set` (→ `today` goal), `credit.limit.ask.decided` (→ the customer); `test/sales-push-routes.test.js` follows.
- **S-7** Today's Tell them (`today/Tell.tsx`) also lists a short pick billed as **Bill what went** (the customer gets fewer) from `pick.settled`.
- **S-8** `customers/cust-head.tsx:128` "No limit set · Ruth decides" becomes a tap: **Ask Ruth for credit** (amount, days, why) once P-12's table exists.
- **S-9** The price words of M-26 on the line (`orders/view.ts:126-127`): **Under the shop's price · Ruth decides**, **Price up · Ruth decides**, **Price coming · Ruth decides**.
- **S-10** Old `sales.html` `pushOpen` (4932): route the new kinds to the order, or retire the old app first.

### Buyer (`src/apps/buyer`, `src/core/buyer`)

- **B-1** `shell/native.ts` `pushRoute` (32-39): `trip.difference.decided` → the trip; `agent.change.decided` and `order.cancelled` → the order (or Orders when gone); `restock.held` / `restock.released` / `carton.refused` → the order the carton was for (`ref.orderId`), not Today.
- **B-2** Show **{Ruth} took {Musa}'s check-in** on the handed-in trip (read `difference_accepted_at` in `src/core/buyer/supabase/read.ts`).
- **B-3** The carton ask: the trip plan (`trip/Plan.tsx`) offers **A carton for the shelf? · Ruth decides** when `cartonWaits` (`buy.ts:92`) holds a line, writing the `restock_buys` row 0151 reads; answers **Shelf part OK** / **Order only** (M-17, M-31).
- **B-4** The yard note: on a trip whose check-in differs, **Tell Ruth why** (`passOn('yard_note', 'manager', …)`, `src/core/buyer/supabase/write.ts:205`), so D-14 has an asker again.
- **B-5** `orders/Order.tsx:104` On hold notice: after `order.cancelled`, the order leaves On hold with **Cancelled · {Ruth}**; after `order.cancel.ask.decided` (no) it goes back to its stage.

### Store (`store.html`)

- **ST-1** `pushOpen` (2666): route `invoice.ask.decided` (→ With Ruth, the return), `stock.count.decided` (→ the count; recount opens it to count again), `trip.difference.decided` and `pick.settled` (→ With Ruth); add them to `test/phone-push.test.js:80` KINDS.store (M-15).
- **ST-2** `ruthAsks` (3253-3300) words: the short pick row "Short pick · #0548" (3290) → **Packed short · #0548**; the credit answer "Keep it until it is paid" (3287) → **Cash first · it stays**; the count answers (3263) → **Count taken** / **Count it again**; the return answers (3269) → **Credit note raised** / **Kept as sold**; the report answers (3274) → **Written off** / **Kept on the shelf**; the check-in answer (3298) → **{Ruth} took your check-in**.
- **ST-3** Nothing to change for `store.extra` (the Store's words are the agreed ones); it starts getting answers once the Manager reads `store_asks` (M-2).

### Accounts (`accounts.html`)

- **A-1** `pushOpen` (2350): route `invoice.voided` (→ the refund to pay, or the customer), `credit_note.raised` (→ the customer's bills) and `invoice.ask.decided` (Accounts' own ask, → the customer); add them to KINDS.accounts.
- **A-2** The ask button (3254) "Void, credit note, limit, terms — Ruth · ask": drop "limit, terms" until P-12 exists, then add a third kind **Credit** on `PAGE.propose` (6300-6335) sending `customer_asks` (M-13).
- **A-3** Reasons on `PAGE.propose` (6322) → the shared list (M-21: Entered twice, Wrong customer, Wrong price, Damaged, Changed their mind, Something else); the pending card says **Void asked** / **Return asked · Ruth decides**.

### The Manager app itself (for the redesign; listed so nothing is lost)

Read `store_asks` (extra) and answer with `answer_store_ask`; route `order.cancel.ask`, `store.extra`, `stock.count`, `payment.ask.decided`; send the cancel of a twin through `cancel_order`; add **Kept on the shelf** to the write-off; use 0176's `void_invoice` and `raise_credit_note` (one write each) in place of the phone's multi-call paths (5410-5426, 5521-5547); fix `out_for_delivery` (5643); use only the §3 words; every "is told" on a done screen names only pushes that exist.

---

## §6 Native changes (the Manager's Android shell)

The Manager APK is `manager.html` inside a Capacitor 8 shell, `apps/manager`
(`capacitor.config.json`: `com.omniware.manager`, `@capacitor/push-notifications`
8.1), built by `.github/workflows/build-manager-app.yml` (`npx cap sync
android`, then `./gradlew assembleDebug` in `apps/manager/android`). The native
side is a bare `MainActivity extends BridgeActivity`
(`apps/manager/android/app/src/main/java/com/omniware/manager/MainActivity.java`);
today every push is drawn by the system from FCM's `notification` block
(`supabase/functions/push-send/index.ts:125`), which cannot carry action
buttons, and a tap only reaches `pushNotificationActionPerformed`
(manager.html:2286). What the notification actions need:

| # | Where | Change |
|---|---|---|
| N-1 | `supabase/functions/push-send/index.ts:108-125` | For a row with `actions` and a subscription with `app_build ≥ 3`: send a **data-only** message (no `notification` block) with `data.title`, `data.body`, `data.outboxId` (the `push_outbox.id`) and `data.actions` (the row's `[{id, label}]` as a JSON string), `android.priority: high`. Every other row and older phone: as today. |
| N-2 | `apps/manager/android/app/src/main/java/com/omniware/manager/` new `DecideMessagingService.java` | Extends the plugin's `com.capacitorjs.plugins.pushnotifications.MessagingService` (so the plugin keeps the token and the in-app events) and, for a data message with `title`, draws the notification itself: channel **Decisions** (high, sound), `NotificationCompat.BigTextStyle` with the body (the 2–3 lines of evidence), the tap opening `MainActivity` with the data (so `pushOpen` still opens the card), and one `addAction` per `data.actions` entry with a `PendingIntent` to N-3. |
| N-3 | new `DecideActionReceiver.java` | On an action: replaces the notification with "{label} · Undo" for 10 s (an Undo action cancels it); after 10 s enqueues a `WorkManager` job (network required) that calls `answer_from_push(p_outbox_id, p_action, p_key)` (§4) over HTTPS with the signed-in session; on success the notification becomes "{label} · Grace sees it" and auto-cancels; on a refusal it shows the server's words ("Someone else just did this") with a tap to open. With no signal the job waits (the outbox rule: kept, sent when there is signal). |
| N-4 | the session for N-3 | The web app's Supabase session lives in the WebView; the job needs it natively. `phonePush()` (manager.html:2273) passes the refresh token to a small native store (`EncryptedSharedPreferences`) through a tiny Capacitor plugin method (`DecideBridge.setSession`), cleared on sign-out; the job refreshes the access token itself. |
| N-5 | `manager.html` `phonePush` / `pushOpen` | Writes `app_build` with the token (`push_subscriptions`); on open reads the native queue (`DecideBridge.pending()`) and shows each answer made from a push in the last 10 s with **Undo** (an Undo after sending calls the decision's own undo: price back, credit back, pick back, `hold_restock_buy` back), and refreshes so the card is gone. The same answers are the row buttons of day.md. |
| N-6 | `apps/manager/android/app/src/main/AndroidManifest.xml` | Declares the service (`com.google.firebase.MESSAGING_EVENT`, replacing the plugin's), the receiver, `POST_NOTIFICATIONS`; `androidx.work:work-runtime` and `androidx.security:security-crypto` in `app/build.gradle`. |
| N-7 | `apps/manager/android/app/build.gradle` `versionCode` (2 today, line 10) | → 3, and `pushInstalled()` (manager.html:2269) keeps its `build ≥ 2` check for push and adds `≥ 3` for actions, so an older APK gets plain pushes. |
| N-8 | `.github/workflows/build-manager-app.yml` | No change of steps; its `paths` already cover `apps/manager/**`. iOS is not built by it: actions are Android only for now (an iPhone gets the evidence and opens the card). |
| N-9 | tests | `test/phone-push.test.js`: the manager's action kinds have an action only from the safe list (never write-off, credit note, void, refund, count taken, merge, opening balance, cancel); an SQL test of `answer_from_push` as Manager, Sales and Store (refused without the task, refused when stale, refused for an action id the row does not offer, once only per key). |

The same layer serves the other phone apps later (Sales' "Tell them", the
Store's "I've got it"); nothing here is Manager-only except the action list.

