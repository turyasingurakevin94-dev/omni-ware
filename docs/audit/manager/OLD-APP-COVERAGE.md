# What the old Manager app could do, and where the new one does it (12 Nov 2026)

The switch rule: no decision or job the old app (`manager.html`, frozen) could do is lost.
Every `PAGE.*`, `SHEET.*` and `ACT.*` in `manager.html` is checked against the new app's **code**
(`src/apps/manager`, `src/core/manager`), not only the spec. A write counts as covered only when a
screen in `src/apps/manager` calls it (`act` / `answer` / `c.tap` / `c.slide`).

**Summary: 45 pages and sheets (36 PAGE, 9 SHEET), 161 acts, 5 tab buttons, 13 push kinds.**

| | Covered | Partly (gap in the LOST list) | Dropped on purpose | LOST |
|---|---|---|---|---|
| Pages and sheets (45) | 22 | 11 | 2 | 10 |
| Acts (161) | 93 | 0 | 13 | 55 |
| Tab buttons (5) | 4 | 0 | 1 | 0 |
| Push kinds opened (13) | 0 | 0 | 0 | 13 (one fix: L1) |

Of the 55 lost acts, 34 are jobs (L2 to L12 below) and 21 are views or settings (V1 to V9). L1 is the push routes.

Words: **Covered**: the new app does it (route · write). **Dropped**: removed on purpose, with the source.
**LOST**: the old app could do it and the new app can't, with no source that drops it.

Two more things, not losses but blockers: every **Nudge** in the new app goes through `nudge_person`
(migration 0184, not written), and refuses with MG-0184 until then (spec Q5: no WhatsApp fallback, the
switch waits for 0184). **Write `invoiceNow`** is in `WRITES` and in the source, but no screen calls it (L9).

---

## LOST: jobs (each would stop the switch)

| # | What the old app did | Old code | What it would take |
|---|---|---|---|
| L1 | **A tap on a push opened its decision** (13 kinds: price.waits and the counter sale, credit.ask, credit.hold, carton.ask, pick.short, agent.change, agent.cancel, order.delivered, invoice.held by code, trip.difference, trip.yard_note, stock.report, invoice.ask) | `pushOpen` 2300–2347 | The new app has no tap handler for a push. Only the demo's `?push=` opens `decide` (`shell/store.ts` openDemoPush); its comment names a `shell/pushes.ts` that does not exist. Add it as Sales has it (`src/apps/sales/shell/open-push.ts`): `pushNotificationActionPerformed` → `decide { id }`, and `payment.ask.decided` → `money/customer` (spec §2 "Push routes"). No write, no board: the routes are already drawn. |
| L2 | **Take a customer's payment**: who pays, how much (all · oldest bill), the method, the date (also earlier), a deposit or change when they pay over, a receipt, a 10 s hold, the slide, the done page with a WhatsApp receipt | `PAGE.pay` 4295, `SHEET.paywho` 3892, `SHEET.payok` 4376, `PAGE.paid` 4437; 13 acts | No write for `receive_payment` in `WRITES`, though data W36 says "same". Needs a write `receivePayment`, a route (e.g. `money/pay`, a sheet from the debtor) and a board to draw (AD). **Or Kevin drops it on purpose**: Sales and Accounts also hold `payment.receive` (decision-rights §2). |
| L3 | **Ask Esther to check a balance** that doesn't add up (kept with no signal, sent when back) | `ACT.mgaskbal` 3943 | No write for the `payment_asks` insert (data W37 says "same"). Needs a write `askBalance`, a place on `money/customer` (a state to draw), and L1's route for the answer `payment.ask.decided`. |
| L4 | **Margins: set any item's markup and the shop's default markup** (the thinnest first, steppers, Save) | `PAGE.margins` 5852, `ACT.mkstep` 5871, `ACT.mksave` 5872 | The new app sets a markup only on a `markup` card, and that card comes only from an ask that does not exist until 0184 (P-11 `markup.wanted`, `supabase/asks.ts:9`). There is no write for the default markup (`set_shop_preset defaultMarkup`). Needs a write `defaultMarkup`, a route (e.g. `money/margins`) and a board to draw. Decision-rights: `markup.set` is the Manager's. |
| L5 | **Edit a customer's name, phone and area** ("Fix the phone" from a look-alike) | `PAGE.custedit` 6095, `ACT['in:cefield']` 6124 | `money/limit` changes only the limit and terms (`setLimit`). Needs a write `editCustomer` (a `customers` update, data W31), the fields on `money/customer` or the limit sheet, and a board to draw. Decision-rights: `customer.edit`, "edit any customer's details (Manager)". |
| L6 | **Which account a refund comes from** (cash · MoMo · bank) on a void or a cancel with money | `ACT.vmacct` 5489 | `decide/kinds/after.tsx:47` always sends `account: 'cash'`. A MoMo or bank refund is booked out of the cash drawer: **the books go wrong**. day.md asked for "Refund cash · Refund MoMo · Refund bank · Keep as deposit"; spec §4 D-19 draws only "Refund · Deposit". No new write (`Money` already carries the account). Needs the chips as a state on the void and cancel cards. |
| L7 | **Move an order on yourself**: the next stage, mark this stage done, mark "supplier asked" | `PAGE.orderact` 3463; `ACT.oanext` 3534, `ACT.oadone` 3533, `ACT.oaasked` 3560; data W42 | No write. Data W42 says "same"; spec §4 D-31 lists only Nudge and Give it to. Needs a write `moveOn` (and `supplierAsked`), a button on `orders/order` and a board. **Or drop it on purpose** (handover D-31 has "Move it on yourself"; say so in day.md). |
| L8 | **Give a buying trip to another buyer** | `ACT.reassigntrip` 3195, `giveTrip` in `ACT.rgo` 3197 | `giveTo` (`supabase/write.ts:347`) gives a packing job or a delivery only. Needs `giveTo` to take a trip (or a `giveTrip` write) and the trip on `team/nudge` "Give it to". |
| L9 | **Invoice a delivered order now**, before the 24 h run | `ACT.invoice` 5194 | Spec §4 D-8: "**Invoice now** only on the order". The write `invoiceNow` exists (`source.ts`, `supabase/write.ts`) but no screen calls it. Needs the button on `orders/order` (a state to draw). |
| L10 | **A counter sale at cost asks a second yes** | `ACT.countersure` 4991 | Spec §4 D-4: "(at cost: asks again)". `decide/kinds/counter.tsx` has no second yes. Needs a state on the counter card. No new write. |
| L11 | **Reach any customer**: find an order or a customer by name, number or phone; open a look-alike pair or an old-books balance for a customer who owes nothing; set a limit for a new customer | `PAGE.search` 3360 (7 acts), `PAGE.lookalike` 5999, `PAGE.oldbooks` 6217 | `money/customer` opens only from a debtor, and debtors are only customers who owe more than 0 (`watch.ts:130`). Old books not entered yet, or a twin with nothing owed, can't be reached. Needs a "To check" list on Money (look-alikes · old books), or search (a route and a board). |
| L12 | **An opening balance with another figure**: type the amount, change "since", or "nothing owed" | `ACT['in:obamt']` 6255, `ACT['in:obsince']` 6262, `ACT.obnone` 6264 | `money/opening` confirms only the old books' figure and date (`Opening.tsx:37`). Needs a keypad and a date on the sheet. The write `opening` already takes both. Note data Q11 (SAL-020) is still open. |

## LOST: views and settings (watch only; Kevin may drop them)

| # | What | Old code | What it would take |
|---|---|---|---|
| V1 | The team's day: what each person sold today against the money they brought in | `PAGE.teamday` 2690, `ACT.allsales` | A section on Team or Money (board). Today and Team show the month, Money shows the shop's In today. |
| V2 | Delivered, day by day (today, the week, a day picked), paid against still owed | `PAGE.delivered` 2989, `ACT.delrange` · `delday` · `delall` | `orders/bill` shows only what is not billed yet. A route and a board. |
| V3 | No seller: sales invoiced with nobody's name on them, by month | `SHEET.noseller` 2541, `ACT.noseller` · `nsorder` | A row on Team (board). |
| V4 | Money filters: by area, and by age band | `ACT.marea` 3889, `ACT.mfilter` 3888 | Chips on Money (board). |
| V5 | Ended goals, and "use the suggested stage limits" | `ACT.goalsall` 5921, `ACT.trkeep` 5947 | A fold and a button on `team/goals`. |
| V6 | The month's margin, sold below cost, given away | `PAGE.margins` 5852, `ACT.bcall` 5825, `ACT.gvall` 5840 | Goes with L4's page. |
| V7 | Ask the owner for a login for someone who has none (WhatsApp) | `SHEET.nologin` 2551, `ACT.nologin` · `askloginsent` | A row on Team (board). |
| V8 | Big text and sound, switch shop, "which staff card is mine" when the login has no card | `ACT.pref` 6406, `ACT.switchshop` 6408, `ACT.iam` 6386 | Rows on `shell/you` (AD02 board). |
| V9 | The team reached its goal: the celebration screen with the chime and a WhatsApp share | `ACT.win` · `winplay` · `winclose` · `winshare` 6475 | A board, or drop it. |

---

## Every page and sheet

Status: C covered · P partly (its gap is in the LOST list) · D dropped on purpose · L lost.

| Old | What it does | D | New route · write | Status |
|---|---|---|---|---|
| PAGE.decide | the list of everything waiting, in groups | queue | `decide` (the + button, oldest first) and Today's Needs you; the list as a step is dropped (day.md "Removed": "the Decide list as a step") | C |
| PAGE.price | a price under the shop's, or up past the sale | D-1, D-3 | `decide` kind price · `price` | C |
| PAGE.pricenew | a line with no price, or no known cost | D-2, D-3 | `decide` kind price · `price`, `costAndPrice`, `askCost` | C |
| SHEET.counter | a counter sale under the shop's price | D-4 | `decide` kind counter · `price`; the second yes at cost is missing (L10) | P |
| PAGE.approvals | credit holds, one at a time | D-5 | `decide` kind credit · `credit` | C |
| PAGE.creditask | on credit for a cash customer, or the Store's "on credit?" | D-6, D-7 | `decide` kinds credit, storecredit · `credit`, `storeCredit` | C |
| PAGE.invoices | delivered orders to invoice, and the ones the run skipped | D-8, D-11 | `orders/bill` (To bill); Invoice now is missing (L9) | P |
| PAGE.smallinv | a bill under 1,000 | D-9 | `decide` kind bill and `orders/bill` · `billSmall` | C |
| PAGE.givenaway | a line at 0: free or to price | D-10 | `decide` kind given · `givenAway`, `priceAgain` | C |
| PAGE.shortpick | a short pick: bill what went or all | D-12 | `decide` kind short · `settlePick` | C |
| PAGE.tripcount | a trip's check-in differs, with the Buyer's note | D-13, D-14 | `decide` kind checkin · `takeCheckin` (closes the notes) | C |
| PAGE.writeoff | write off reported stock | D-16 | `decide` kind loss · `writeOff`, `keepOnShelf` | C |
| PAGE.stocktake | take a stock count, or count again | D-17 | `decide` kind count · `countTaken`, `countAgain` | C |
| PAGE.return | a credit note for a return | D-18 | `decide` kind return · `creditNote`, `keepSold` | C |
| PAGE.void | void an invoice, with its money | D-19 | `decide` kind void · `voidBill`, `keepBilled`; the refund account is always cash (L6) | P |
| PAGE.cancelask | Sales asks to cancel | D-20 | `decide` kind cancel · `cancel`, `keepOrder`; the refund account is always cash (L6) | P |
| PAGE.dup | taken twice? | D-21 | `orders/bill` Taken twice · `cancelTwin`, `bothReal` | C |
| PAGE.agentask | an agent asks to change or cancel | D-22 | `decide` kind agent · `agent` | C |
| PAGE.restock | the restock list and cartons | D-23, D-24 | `orders/stock` · `restock`; `decide` kind carton · `carton` | C |
| PAGE.margins | markups, the default markup, the month's margin, below cost, given away | D-33, watch | none (L4, V6) | L |
| PAGE.teamrules | goals, stage limits, hold days | D-29 | `team/goals` · `goals`, `stageLimits`, `holdDays` | C |
| PAGE.lookalike | every look-alike pair | D-26 | `money/customer` card, only for a debtor (L11) | P |
| PAGE.lamerge | pick the record kept | D-26 | `money/merge` · `merge`, `notSame` | C |
| SHEET.laconfirm | confirm the merge | D-26 | Dropped: day.md "Two ways to one tap", "pick + confirm → one slide" (the slide on `money/merge`) | D |
| PAGE.custedit | a customer's name, phone, area, limit, terms | D-25 | `money/limit` · `setLimit` (limit and terms); name, phone and area are missing (L5) | P |
| SHEET.cecheck | check the change, then tell Grace | D-25 | Dropped: day.md "Removed": "Tell Grace after a customer edit (Save tells)" | D |
| PAGE.oldbooks | old-books balances to confirm | D-27 | `money/customer` "Old books · Open", only for a debtor (L11) | P |
| PAGE.opening | one opening balance: amount and since | D-27 | `money/opening` · `opening`; the old books' figure only (L12) | P |
| PAGE.promise | a promise to pay | D-28 | `money/promise` · `promise` | C |
| PAGE.debtor | one debtor: bills, call, statement, nudge, promise, pay | D-30 | `money/debtor` · `nudge`, `promise` (Take payment: L2) | C |
| PAGE.pay | take a payment | other | none (L2) | L |
| SHEET.paywho | whose payment; Ask Esther to check | other | none (L2, L3) | L |
| SHEET.payok | confirm the payment | other | none (L2) | L |
| PAGE.paid | the payment done; WhatsApp receipt | other | none (L2) | L |
| PAGE.order | one order | watch | `orders/order` | C |
| PAGE.orderact | give it on, move it on, mark done, supplier asked | D-31 | give: `team/nudge`, `orders/stuck` · `giveTo`; the moves are missing (L7) | P |
| SHEET.reassign | give a packing job, a delivery or a trip | D-31 | `team/nudge` "Give it to" · `giveTo`; trips are missing (L8) | P |
| SHEET.nudge | nudge someone (who, why, WhatsApp) | D-30, D-31 | `team/nudge` · `nudge` (a push; needs 0184, spec Q5) | C |
| PAGE.person | one person | watch | `team/person` | C |
| PAGE.teamday | today: sold against money in, by person | watch | none (V1) | L |
| PAGE.delivered | delivered by day, paid against owed | watch | none (V2) | L |
| PAGE.search | find an order or a customer | other | none (L11) | L |
| SHEET.noseller | sales with no seller | watch | none (V3) | L |
| SHEET.nologin | ask the owner for a login | other | none (V7) | L |
| PAGE.me | You: doors, which card is mine, settings, switch shop, sign out | settings | `shell/you` (shop, pushes, Sign out); doors dropped (day.md "Removed": "the six tiles as doors"); the settings are missing (V8) | P |

## The tab bar and the push routes

| Old | What it does | New | Status |
|---|---|---|---|
| tab Today | Today | `today` | C |
| tab Team | Team | `team` | C |
| tab Orders (stuck badge) | Orders | `orders` (badge of what waits on you) | C |
| tab Money | Money | `money` | C |
| Nudge (red centre button) | nudge someone | Dropped: handover M-10 and day.md "The FAB: Decide next" (the + opens `decide`; Nudge moves onto the rows and Team) | D |
| pushOpen, 13 kinds | a tap on a push opens its page | none: no tap handler in the new app (L1) | L |

## Every act

Status: C covered · D dropped on purpose · L lost (see the L or V row).

| Line | Act | What it does | D | New route · write | Status |
|---|---|---|---|---|---|
| 2427 | push | open a page | other | `nav.push` | C |
| 2549 | noseller | open No seller | watch | none (V3) | L |
| 2550 | nsorder | an order from No seller | watch | none (V3) | L |
| 2564 | nologin | open "no login" | other | none (V7) | L |
| 2565 | askloginsent | ask the owner for a login (WhatsApp) | other | none (V7) | L |
| 2775 | allsales | show every salesperson on the team's day | watch | none (V1) | L |
| 2820 | givejob | give a job to someone | D-31 | `team/nudge` · `giveTo` | C |
| 2980 | show | filter a person's list | watch | `team/person` | C |
| 2981 | fold | fold a section | watch | `team/person` | C |
| 3026 | delrange | Delivered: today, week, a day | watch | none (V2) | L |
| 3027 | delday | Delivered: pick a day | watch | none (V2) | L |
| 3028 | delall | Delivered: show all | watch | none (V2) | L |
| 3194 | reassign | open Give it to for an order | D-31 | `team/nudge` | C |
| 3195 | reassigntrip | give a buying trip | D-31 | none (L8) | L |
| 3196 | rpick | pick who gets it | D-31 | `team/nudge` | C |
| 3197 | rgo | send the give | D-31 | `team/nudge` · `giveTo` | C |
| 3213 | handover | give on the row in one tap | D-31 | `orders/stuck`, `team` · `giveTo` | C |
| 3265 | obundo | undo a give | D-31 | Undo 10 on the held answer | C |
| 3373 | obsearch | open search | other | none (L11) | L |
| 3374 | in:srch | type the search | other | none (L11) | L |
| 3375 | obstab | search tab: all · orders · customers | other | none (L11) | L |
| 3376 | obsmore | show older results | other | none (L11) | L |
| 3377 | obsclr | clear the search | other | none (L11) | L |
| 3378 | obsrecent | a recent search | other | none (L11) | L |
| 3379 | obsgo | open a result | other | none (L11) | L |
| 3380 | objump | jump to a tab with its filter | other | the tabs; `orders { filter }` | C |
| 3515 | orderact | open an order's moves | D-31 | `orders/order` | C |
| 3516 | oapick | pick who gets it | D-31 | `team/nudge` | C |
| 3517 | oatoday | back to Today | other | Back | C |
| 3518 | oagive | give it on | D-31 | `team/nudge` · `giveTo` | C |
| 3533 | oadone | mark the stage done yourself | D-31 | none (L7) | L |
| 3534 | oanext | move it to the next stage yourself | D-31 | none (L7) | L |
| 3550 | oaundo | undo a move or a give | D-31 | the give: Undo 10; the move goes with L7 | C |
| 3560 | oaasked | mark the supplier asked | D-31 | none (L7) | L |
| 3665 | duppick | pick the twin to drop | D-21 | `orders/bill` (the later one by default) | C |
| 3666 | dupkeep | both are real | D-21 | `orders/bill` · `bothReal` | C |
| 3680 | dupvoid | drop the twin | D-21 | `orders/bill` · `cancelTwin` (through `cancel_order`, M-20) | C |
| 3691 | dupretry | try again | D-21 | the store's Try again | C |
| 3692 | dupundo | undo "both are real" | D-21 | Undo 10 | C |
| 3754 | nudge | open the nudge sheet | D-31 | `team/nudge` | C |
| 3755 | npick | pick who | D-31 | `team/nudge` | C |
| 3756 | nwhy | pick what about | D-31 | `team/nudge` About | C |
| 3757 | in:nmsg | type the words | D-31 | `team/nudge` Change | C |
| 3764 | nsent | sent in WhatsApp | D-31 | Dropped: handover M-10, spec Q5 (a push, not WhatsApp) | D |
| 3885 | mside | Money: owed or in | watch | `money` (both on one screen) | C |
| 3886 | chase | Today → the debtors over 30 days | D-30 | `today` Watch → `money` | C |
| 3888 | mfilter | Money: filter by age | watch | none (V4) | L |
| 3889 | marea | Money: filter by area | watch | none (V4) | L |
| 3890 | mall | Money: show every debtor | watch | `money` (the whole list) | C |
| 3897 | takepay | take a payment | other | none (L2) | L |
| 3898 | paywho | pick whose payment | other | none (L2) | L |
| 3943 | mgaskbal | ask Esther to check a balance | other | none (L3) | L |
| 4076 | hpick | pick a credit hold | D-5 | `decide` (n of N) | C |
| 4077 | hnext | the next hold | D-5 | `decide` next › | C |
| 4078 | hdecide | release, cash first, keep held | D-5 | `decide` credit · `credit`; Keep held and Old bill first dropped (handover M-14, spec data Q6, day.md "Removed") | C |
| 4190 | ckcredit | step to "on credit" | D-6, D-7 | Dropped: day.md "Removed": "the limit → terms → go steps (one chip)" | D |
| 4191 | ckback | step back | D-6, D-7 | Dropped: same | D |
| 4192 | cklim | a limit chip | D-6, D-7 | `decide` credit, storecredit (LimitChips) | C |
| 4193 | ckterm | a terms chip | D-6, D-7 | Dropped: the terms ride in the limit chip (day.md, spec §4 D-7) | D |
| 4195 | in:cklim | type a limit | D-6, D-7 | Dropped: day.md "one chip row of suggested limits" | D |
| 4216 | ckgo | on credit | D-6, D-7 | `decide` · `credit`, `storeCredit` | C |
| 4231 | ckcash | cash first | D-6, D-7 | `decide` · `credit`, `storeCredit` (no) | C |
| 4244 | ckundo | undo | D-6, D-7 | Undo 10 | C |
| 4291 | in:paydate | the payment's date | other | none (L2) | L |
| 4292 | payearly | paid earlier, or a deposit | other | none (L2) | L |
| 4349 | in:payamt | type the amount | other | none (L2) | L |
| 4359 | paymode | all or oldest bill | other | none (L2) | L |
| 4360 | paymethod | cash, MoMo, bank | other | none (L2) | L |
| 4361 | payreceipt | send a receipt | other | none (L2) | L |
| 4374 | payover | paid over: deposit or change | other | none (L2) | L |
| 4385 | payask | open the confirm | other | none (L2) | L |
| 4386 | payyes | confirm (held 10 s) | other | none (L2) | L |
| 4399 | payundo | undo the payment | other | none (L2) | L |
| 4406 | slide:pay | the payment slide | other | none (L2) | L |
| 4795 | pline | pick a line | D-1…D-3 | one `decide` card per line | C |
| 4797 | pstep | price stepper | D-1…D-3 | Dropped: day.md "Removed": "Set price → steppers → Use this (a rung is the answer)" | D |
| 4798 | in:ptype | type a price | D-1…D-3 | `decide` price keypad · `price` | C |
| 4806 | ppreset | a rung (cost, asked, usual, shop's) | D-1…D-3 | `decide` price rungs · `price` | C |
| 4810 | pdecide | approve, set, shop's price | D-1, D-3 | `decide` · `price` | C |
| 4828 | pcostno | back off a price under cost | D-1…D-3 | the keypad's Use waits under cost | C |
| 4904 | pnset | set several lines' prices | D-3 | one `decide` card per line · `price` | C |
| 4933 | ncgo | the cost, then the price | D-2 | `decide` · `costAndPrice` | C |
| 4956 | costask | ask the Buyer for the cost | D-2 | `decide` · `askCost` | C |
| 4981 | counter | open the counter sale | D-4 | `decide` kind counter | C |
| 4991 | countersure | at cost: the second yes | D-4 | none (L10) | L |
| 5109 | gaset | per line: free or to price | D-10 | `decide` given | C |
| 5110 | gawhy | why it is free | D-10 | `decide` given (Sample · Goodwill · Replacement · Other) | C |
| 5111 | in:gatext | type the why for Other | D-10 | `decide` given: Other has no typed words | C |
| 5112 | gaall | show every line | D-10 | `decide` given | C |
| 5129 | gasend | save | D-10 | `decide` · `givenAway`, `priceAgain` | C |
| 5177 | sibill | bill it | D-9 | `decide` bill, `orders/bill` · `billSmall` | C |
| 5188 | siundo | undo | D-9 | Undo 10 | C |
| 5189 | sifix | fix the order | D-9 | `decide` bill Open → `orders/order` | C |
| 5194 | invoice | invoice one now | D-8 | none (L9; spec §4 D-8 keeps "Invoice now" on the order) | L |
| 5195 | invoiceall | invoice all | D-8 | Dropped: day.md "Automated" (bills itself 24 h after delivery), handover M-18 | D |
| 5222 | sppick | bill what went or all | D-12 | `decide` short (two buttons) | C |
| 5223 | spgo | settle it | D-12 | `decide` · `settlePick` | C |
| 5282 | yardseen | Seen on a yard note | D-14 | Dropped: day.md "Removed": "Seen on a yard note (it closes with the check-in)"; `takeCheckin` closes it | D |
| 5309 | slide:tripok | take the check-in | D-13 | `decide` checkin · `takeCheckin` (a tap now, day.md) | C |
| 5336 | wotoggle | a switch per report | D-16 | `decide` loss switches | C |
| 5337 | slide:writeoff | write off | D-16 | `decide` · `writeOff` | C |
| 5362 | slide:count | take the count | D-17 | `decide` · `countTaken` | C |
| 5365 | recount | count again | D-17 | `decide` · `countAgain` | C |
| 5401 | rtq | how many come back | D-18 | `decide` return stepper | C |
| 5402 | rtback | back on the shelf or damaged | D-18 | `decide` return Change | C |
| 5403 | rtway | off what they owe or cash back | D-18 | `decide` return Change | C |
| 5406 | slide:credit | raise the credit note | D-18 | `decide` · `creditNote` | C |
| 5434 | askno | decline a return or a void | D-18, D-19 | `decide` · `keepSold`, `keepBilled` | C |
| 5488 | vmpick | refund or deposit | D-19 | `decide` void, cancel chips | C |
| 5489 | vmacct | which account the refund leaves | D-19, D-20 | none: always cash (L6) | L |
| 5497 | vmundo | undo a void with money | D-19 | Dropped: spec §3.3 (a slide has no Undo) | D |
| 5515 | vdwhy | why the bill goes | D-19 | `decide` void sends the ask's own reason (spec §4 D-19) | C |
| 5516 | slide:void | void | D-19 | `decide` · `voidBill` | C |
| 5561 | vmvoid | confirm the void with money | D-19 | Dropped: day.md "Removed": "the confirm step of a void with money" | D |
| 5599 | agkeep | agree or keep a line | D-22 | `decide` agent | C |
| 5600 | agdo | answer the agent | D-22 | `decide` · `agent` | C |
| 5620 | agnocancel | keep the order (no to a cancel) | D-22 | `decide` agent Kept · `agent` | C |
| 5682 | cxyes | cancel | D-20 | `decide` · `cancel` | C |
| 5683 | cxno | keep the order | D-20 | `decide` · `keepOrder` | C |
| 5746 | ctnyes | the carton's shelf part OK | D-24 | `decide` · `carton` | C |
| 5747 | ctnno | order only | D-24 | `decide` · `carton` (no) | C |
| 5748 | ctnundo | undo | D-24 | Undo 10 | C |
| 5771 | rshold | not yet · go ahead | D-23 | `orders/stock` · `restock` | C |
| 5825 | bcall | every line sold below cost | watch | none (V6) | L |
| 5840 | gvall | every line given away | watch | none (V6) | L |
| 5871 | mkstep | a markup stepper (an item or the default) | D-33 | none (L4) | L |
| 5872 | mksave | save the markups | D-33 | none (L4) | L |
| 5921 | goalsall | every ended goal | watch | none (V5) | L |
| 5942 | trstep | a goal or limit stepper | D-29 | `team/goals` | C |
| 5947 | trkeep | use the suggested stage limits | D-29 | none (V5) | L |
| 5948 | trsave | save goals and limits | D-29 | `team/goals` · `goals`, `stageLimits`, `holdDays` | C |
| 6016 | lakeep | the record kept | D-26 | `money/merge` | C |
| 6017 | laask | open the confirm | D-26 | Dropped: day.md (pick + confirm → one slide) | D |
| 6054 | lamerge | merge | D-26 | `money/merge` · `merge` | C |
| 6056 | laapart | not the same | D-26 | `money/merge` · `notSame` | C |
| 6058 | laretry | try again | D-26 | the store's Try again | C |
| 6121 | cestep | limit stepper | D-25 | `money/limit` chips | C |
| 6122 | ceset | terms | D-25 | `money/limit` terms | C |
| 6124 | in:cefield | name, phone, area | D-25 | none (L5) | L |
| 6126 | ceask | open the check and tell | D-25 | Dropped: day.md "Removed" ("Tell Grace": Save tells) | D |
| 6173 | cesave | save | D-25 | `money/limit` · `setLimit` (limit and terms) | C |
| 6187 | ceundo | undo | D-25 | Undo 10 | C |
| 6255 | in:obamt | type the opening amount | D-27 | none (L12) | L |
| 6262 | in:obsince | the date since | D-27 | none (L12) | L |
| 6263 | obsame | the old books' figure | D-27 | `money/opening` (the only figure) | C |
| 6264 | obnone | nothing owed | D-27 | none (L12) | L |
| 6265 | obsave | save | D-27 | `money/opening` · `opening` | C |
| 6297 | prday | the day | D-28 | `money/promise` | C |
| 6298 | pramt | how much | D-28 | `money/promise` (All · Oldest bill · Part) | C |
| 6299 | in:prdate | a day later | D-28 | `money/promise` Pick a day later | C |
| 6300 | in:pramtx | another amount | D-28 | `money/promise` Part | C |
| 6302 | prsave | save | D-28 | `money/promise` · `promise` | C |
| 6386 | iam | which staff card is mine | settings | none (V8) | L |
| 6403 | door | a door on You | settings | Dropped: day.md "Removed": "the six tiles as doors" | D |
| 6406 | pref | big text, sound | settings | none (V8) | L |
| 6408 | switchshop | switch shop | settings | none (V8) | L |
| 6409 | signout | sign out | settings | `shell/you` Sign out | C |
| 6475 | win | the goal-reached screen | other | none (V9) | L |
| 6476 | winplay | play the chime | other | none (V9) | L |
| 6477 | winclose | close it | other | none (V9) | L |
| 6478 | winshare | share it | other | none (V9) | L |
