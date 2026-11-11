# 04 · Screens — Buyer: the data contract

What this covers: every read, write and rule in the current `buyer.html` (6,168 lines), so the new Buyer front end (`src/apps/buyer`, `src/core/buyer`) can read and write the same database the same way.
Date: 2026-11-10
Status: **read from the code, not decided.** Every item gives its `buyer.html` line. The questions in §7 are for Kevin; until he answers, the new app does what `buyer.html` does today.

Read with: [`05-data.md`](05-data.md) (tables), [`06-offline-sync-push.md`](06-offline-sync-push.md), [`07-stack.md`](07-stack.md), `docs/decision-rights.md`, `src/core/supabase/` (how Sales does it).

---

## 0. How buyer.html talks to the database

| What | How | Line |
|---|---|---|
| Client | `supabase.createClient(OW_ENV.url, OW_ENV.anon)`: production on the Vercel and Capacitor hosts, staging everywhere else | 523–532 |
| `ow_patch_order` shim | Before 0165, a missing `ow_patch_order` is copied on the phone: read the row, merge `p_patch`, delete `p_drop`, write it back. **Drop it in the new app**: 0165 is on every database. | 539–554 |
| Paged read | `selectAll(table, keyCol='id', filter)`: `select('*', {count:'exact'}).eq('shop_id', shop)`, ordered by key, 1,000 a page, keyset paging (`gt(key, last)`) | 754–770 |
| Row → object | `rowToSupplier` 772, `rowToTrip` 774, `rowToPrice` 777, `rowToQuote` 782 (the payload spread over defaults), `rowToRestock` 5429, `rowToHandoff` 5430 | |
| Line ids | `withLineIds`: a line with no `lineId` gets `'L' + orderId + '-' + index`. It is kept once the order is written back. | 794–798 |
| Order writes | always `changeOrder(id, fn)`: re-read the row, apply `fn` to the fresh copy, then send only `ORDER_KEYS` through `ow_patch_order` | 2434–2459 |
| Snapshot | `localStorage['ow-buyer-snap:<uid>']` = `{shopId, shopName, role, at, data}`. Opened offline at boot. | 872–874, 1611–1650 |
| Realtime | **None.** No `channel()` and no `postgres_changes` anywhere. | — |

### 0a. Phone-only state (localStorage). The server never sees it.

| Key | What it holds | Line | Note |
|---|---|---|---|
| `ow-buyer-trip:<uid>:<shop>` | `tripDraft[tripId][idx] = {lineId, orderId, q, p}`: what came, before it is written | 3989–4007 | written to `collection_trips.lines` by `flushTrip` |
| `ow-buyer-pay:<uid>` (**not shop-scoped**) | `tripPay[tripId] = {amount, noReceipt, done, skip, own, oddOk, photo{path,at}}`; `tripPay['round:'+firstTripId].own` | 4105–4108 | `done` ("Done here") and `own` live only here until the hand-in |
| `ow-buyer-phones:<shop>` | a supplier phone the Buyer typed, `{sid: phone}` | 6018–6019 | `supplierPhone` reads it as a fallback (888) |
| `ow-buyer-prefs` | sound, big text | 691–693 | |

---

## 1. Reads

### 1a. At boot (`boot` 1611, `loadAll` 807)

| # | Source | Columns / filter | Kept as | Line |
|---|---|---|---|---|
| 1 | `auth.getUser()`, then `getSession()` when offline | — | `S.user` | 1613–1628 |
| 2 | `shop_members` | `select('shop_id, role, shops(name, created_at)').eq('user_id', uid)`. Roles let in: `buyer`, `owner`, `admin`, `manager` (`chooseShop`). | `S.shopId`, `S.role` | 1630–1641 |
| 3 | `suppliers` | `*` → id, name, phone, phone2, location, shop_no, notes, terms_days, stop_at_days, delivery_days | `suppliers` | 809, 772 |
| 4 | `products` | `*` → id, name, category, variants | `products` | 809, 829 |
| 5 | `prices` | `*` → id, product_id, variant_idx, supplier_id, wholesale, retail, date, unit, pack_unit, pack_qty, out_of_stock, out_of_stock_since, last_asked_at, tiers, confirmed_via, price_source | `prices` | 809, 777 |
| 6 | `stock` | `*`, keyed by `key` → `{key: qty}` | `stock` | 809, 824 |
| 7 | `stock_lots` | `*` → `{key: [{qty, cost}]}` (FIFO cost for "use our shelf") | `stockLots` | 809, 825 |
| 8 | `saved_quotes` | `*`, **every order the shop ever had** (paged) → `rowToQuote` | `savedQuotes` | 809, 782 |
| 9 | `collection_trips` | `*` → id, supplier_id, status, assigned_worker_id, created_at, assigned_at, accepted_at, collected_at, confirmed_at, note, lines, voided, cash_given, pay | `collectionTrips` | 810, 774 |
| 10 | `staff` | `*` → id, name, phone, role, unavailable, user_id | `staff` | 810, 828 |
| 11 | `purchase_invoices` | `*` → id, quote_id, date, and the payload spread (supplierId, items, amountPaid, voided, transport, credits) | `purchaseInvoices` (what we owe a supplier, for the score) | 810, 834 |
| 12 | `agents` | `*` → id, name, payment_term | `agents` (the prepay gate) | 810, 830 |
| 13 | `app_settings` | `select('presets').maybeSingle()`; uses `priceReview`, `supplierScore`, `supplierTieBand`, `buyHolds`, `reorderRules`, `restockCoverDays` | `preset*` | 811, 835–840 |
| 14 | `buyer_handoffs` | `*` → id, kind, for_role, ref, payload, status, created_by, created_at, done_at, cash_back | `handoffs` | 813, 5430 |
| 15 | `restock_buys` | `*` → id, product_id, variant_idx, qty, unit, supplier_id, price, status, trip_id, created_by, created_at, held_by, held_at, for_line | `restockBuys` | 813, 5429 |
| 16 | `store_asks` | `*`, `.eq('kind','restock').eq('status','sent')` → id, ref, payload, asked_by, asked_by_name, created_at | `storeAsks` | 800–806 |
| 17 | `supplier_answers` | `select('id, order_id, supplier_id, state, terms, changes, note, at')`, `at` in the last 14 days, `order('at')` | folded into orders (§3, W3) | 2473–2506 |

Items 9–12 and 14–15 read as empty when the table is missing (`.catch(() => [])`). **Not read:** `sourcing_leads`, `customers`, `profiles`, `decision_log`, `push_outbox`, `invoice_asks`.

### 1b. On refresh

| When | What runs | Line |
|---|---|---|
| Every 45 s while visible and not dragging | `refreshLive`: `saved_quotes` with `liveQuoteFilter` (`status.neq.completed, invoiced.eq.false, voided.eq.true, invoiced_ts ≥ now−2 d`), merged over the copy (`mergeQuotes`); `collection_trips`, `buyer_handoffs` and `restock_buys` read **whole** and replaced; `store_asks`; then `readAppAnswers`. Only the newest refresh lands (`seq`). | 850–871, 1733 |
| Visible again after 30 s away | `loadAll` (everything) | 1735 |
| A push tapped | `loadAll`, then `pushOpen(data)` opens the screen for `order.buying`, `trip.cash.ready`, `restock.*`, `store.restock`, `trip.sent/taken/cancelled`, `carton.refused`, `supplier.answered`, `sourcing.found` | 1677, 1688–1708 |
| Before starting a round | `selectAll('collection_trips')` again, so a line just put on a trip is not sent twice | 3933–3934 |
| Every order write | the one row re-read (`changeOrder`) | 2436 |
| Every trip write | the one trip re-read (`flushTrip` 4013, `slide:take` 4388, hand-in 4512) | |
| Every 30 s | redraw only (the clocks), no read | 1734, 1738 |

---

## 2. The order and line fields the Buyer uses

### 2a. Order level (`saved_quotes`)

| Field | Read / written | Meaning | Line |
|---|---|---|---|
| `status` (column) | R / W | `draft` Checking · `awaiting_goods` Buying · `preparing` Packing · `pending_delivery` On the road · `completed` Delivered | 1012–1013 |
| `voided`, `invoiced`, `invoiced_ts` (columns) | R | an invoiced order leaves the board after 24 h (`quoteAgedOffBoard`) | 1018 |
| `client_name`, `amount_paid` (columns) | R | | 782 |
| `payload.items[]` | R / W | §2b | |
| `payload.supplierConfirms{sid}` | R / W | §2c | |
| `payload.droppedLines[]` | W (append) | `{productId, variantIdx, productName, unit, qty, sellPrice, agentSellPrice, at:<index>, reason, droppedAt, by}` | 1156, 2673 |
| `payload.stageEnteredAt`, `stageLog[]` | W | `{status, at, auto:true}` added on a move | 1021–1031 |
| `payload.shopConfirmedAt`, `shopConfirmedTerms` | W | an agent order's shop check, set when all its suppliers said yes | 1088–1092, 1122 |
| `payload.pickingStatus` | W | set to `done` when an order leaves Packing (never in practice from the Buyer) | 1024 |
| `payload.gateHeldMove` | R | the server's gate kept the order in Checking: `{why}` | 2457 |
| `takenBy`, `createdAt`/`savedAt`/`date`, `originAgentId`, `agentPaymentStatus`, `agentChange`, `agentCancel`, `creditCheck.decision`, `cancelledAt` | R | who to tell, age, the agent and Manager holds | 1014–1016, 1059–1087, 4825, 4840 |

`ORDER_KEYS` (the only payload keys the Buyer ever sends): `items, supplierConfirms, droppedLines, stageEnteredAt, stageLog, shopConfirmedAt, shopConfirmedTerms, pickingStatus` (2434).

### 2b. A line (`payload.items[i]`)

| Field | R/W | Meaning | Line |
|---|---|---|---|
| `lineId` | R (made if missing) | the line's identity in every write and on a trip line | 794 |
| `productId`, `variantIdx`, `productName` | R / W (switch item) | | 5398–5404 |
| `qty`, `unit`, `packUnit`, `packQty`, `qtyIn` (`'unit'`/`'pack'`) | R (W on switch item) | the quantity in the unit it was chosen in (`quoteLinePack`) | 969–1007 |
| `supplierId` | R / W | `'__stock__'` = our shelf; `''`/missing = nobody sells it | 1034 |
| `supplierName` | W | written beside `supplierId` | 1152 |
| `price` | R / W | **our cost each** (base unit); the supplier's terms are made from it | 1048 |
| `sellPrice`, `agentSellPrice` | R only | used only to test "costs more than it sells" (never shown) | 4838 |
| `priceWas` | W once | the cost before the first new price | 2906 |
| `repricedAt`, `repricedBy` | W | a supplier's new price taken; the trip buys at `price` | 2907, 1251 |
| `priceNote` | W `'nomargin'` | cost now over sell: waits for the Manager (`priceReview` set to null) | 2911 |
| `priceReview.state` | R | the Manager decided the price | 4839 |
| `clientWaits` | W `{at, by, via?:'sourcing'}` / deleted | the client waits; the server turns it into a Sourcing request (0139) | 5206–5212 |
| `switchedFrom` | W `{name, price, at, why, by}` | another item in its place | 5405 |
| `pickKept` | W `String(sid)` | the Buyer picked this supplier by hand: the recommendation leaves it alone | 2681, 5030, 5047 |
| `shelfAuto` | deleted | on "use our shelf" and when a supplier is found | 2678, 5174 |
| `receivedAt`, `receivedQty` | R | the yard counted it in (`receive_trip`) | 1035 |

### 2c. `supplierConfirms[sid]`

| Field | Values | Written by | Line |
|---|---|---|---|
| `state` | `pending` · `confirmed` · `problem` (read as `stale` when `terms` no longer match) | `setOrderSupplierConfirm` | 1110–1128 |
| `at` | ms of the answer | | 1119 |
| `askedAt` | ms of the ask (kept through a reset to pending) | `markOrderSupplierAsked` | 1130–1137 |
| `askedHow` | `wa` (default when missing) · `call` · `person` · `phone2` | | 1135, 6052 |
| `terms` | `productId:variantIdx:qty:round(price)` per line of this supplier, joined by `|`; set only on `confirmed` | `orderSupplierTerms` | 1046–1049 |
| `note` | `''`, `'said it on the phone'`, `'Said have all'`, `'Said some short: “…”'`, `'Said none'` | | 2491 |
| `by` | the user id, or `'supplier'` (supplier app) | | 1120, 2496 |
| `via` | `'phone'` (a new price given on the phone) | | 2915 |
| `short` | the supplier app's `changes` when it said short | | 2496 |
| `readyOn` | `YYYY-MM-DD`, the day they said it is ready (toggle) | `ACT.ready` | 2570–2581 |

### 2d. A trip line (`collection_trips.lines[i]`, made by `tripFromRun` 1355)

`orderId` (a number, or `'restock'`) · `lineId` (the order line, or the `restock_buys.id`) · `productId`, `variantIdx`, `productName`, `unit`, `packUnit`, `packQty`, `qtyIn`, `clientName` · `qty` (whole packs when the supplier sells no less) · `expectedPrice` · `gotQty` (null = not answered, 0 is an answer) · `gotPrice` · `yardQty` (the Store's, read only).

### 2e. `collection_trips.pay` (0151), written at the hand-in

`{own, amount, receipt: 'photo'|'none', photoPath?, at}` (`stopPay` 4411). Not on a supplier delivery.

---

## 3. Writes, in the buyer's flow order

Every order write goes through `changeOrder` → `rpc('ow_patch_order', {p_shop_id, p_id, p_patch, p_client_name:null, p_client_phone:null, p_drop, p_status})`. `p_status` is sent only when the status changed. Triggers on `saved_quotes` run on every such write; the table says which fires. "Gate" = `ow_gate_reason` (0174) in the `saved_quotes` triggers: a move out of Checking it holds comes back as `gateHeldMove`. "Stage" = `saved_quotes_stage_move` (0173/0178): leaving Checking needs `order.move` or `supplier.confirm`.

| # | Action | Call and what changes | Push / trigger | Line |
|---|---|---|---|---|
| W1 | **Ask a supplier** (all their lines on every order, one WhatsApp) | WhatsApp opens (`askAllMessage`); then the "Did you send it?" sheet → `ACT.sentyes`: for every order with this supplier still To ask, `changeOrder` → `markOrderSupplierAsked(q, sid, how)` (`askedAt`, `askedHow`). A call or a visit opens "What did they say?" (W2–W4). | none | 6037–6070 |
| W1b | Ask one supplier for one order ("They told me", `toldsay`) | `markOrderSupplierAsked(q, sid, how)`, then W2/W3/W4 | none | 2416–2424 |
| W1c | Chase (after 30 min) | WhatsApp opens with the same message; **nothing is written** (`askedAt` is not stamped again) | none | 2765 |
| W2 | **Yes, same price** | `ACT.answer(qid, sid,'yes')`: waits 6 s with Undo (`UNDO_MS`), flushed when the app is hidden; then `answerNow` → `changeOrder` → `setOrderSupplierConfirm(q, sid, 'confirmed', '')`. Writes `supplierConfirms[sid]`; on an agent order, `shopConfirmedAt/Terms`; when it is the last yes, `orderLeaveDraft` (W9). Answers are queued one after another (`answerChain`). | W9's when it moves | 2526–2562 |
| W3 | **Supplier app answer** (fold) | `readAppAnswers` on every load: the newest answer per order and supplier, used when the order is in Checking, the supplier still has lines on it, nothing newer was recorded and `terms` match. → `setOrderSupplierConfirm(q, sid, confirmed|problem, note, {by:'supplier', at, short})`. | `supplier.answered` fired already on the `supplier_answers` insert (0133, `supplier.confirm`) | 2473–2506 |
| W4 | **New price** (Price changed) | `ACT.pgo` → `changeOrder`: `priceWas` (once), `price = each`, `repricedAt`, `repricedBy`; if over `sellPrice` → `priceNote='nomargin'`, `priceReview=null`; then `setOrderSupplierConfirm(…,'confirmed','said it on the phone',{via:'phone'})`. Then `rpc('buyer_confirm_price', {p_shop_id, p_price_id, p_wholesale: each, p_qty: line qty})` on that supplier's price row, if there is one. Same keyed price = W2. | `price.waits` to the Manager when a line now sells under cost (0153 `saved_quotes_ow_price_up`); later `price.decided` to the salesperson. `buyer_confirm_price` writes `prices` (date today, `price_source='confirmed'`, `confirmed_via='phone'`) + `decision_log` (`price.confirm`) → `prices_ow_push` `price.changed` to each open order's taker when the list price moved (0138) | 2894–2932 |
| W5 | **No / out of stock** | `ACT.answer(…,'no')` → `setOrderSupplierConfirm(q, sid, 'problem', '')`; then the Problem screen | none | 2423, 2551 |
| W5a | Undo an answer back to pending | `setOrderSupplierConfirm(q, sid, 'pending')`: keeps `askedAt`, clears the rest | none | 1115–1117 |
| W6 | **Another supplier** (Problem → pick, and "switch and ask" in one tap) | `ACT.pdo`: `setLineSupplier` (`supplierId`, `supplierName`), `price = alt.unit`, `pickKept = sid`; with the WhatsApp tap, `markOrderSupplierAsked(q, alt)`. Also "Why this supplier" → `whyuse` (`price = round(row.purchasePrice)`, `pickKept`) and `whykeep` (`pickKept` only). | none (Sales sees the line move) | 2659–2700, 5025–5054 |
| W6a | **Use our shelf** | `supplierId='__stock__'`, `price` = FIFO lot cost × need ÷ qty when there is a lot, delete `shelfAuto`, `agentShelfConfirm`, then `orderLeaveDraft` | W9's | 2674–2679 |
| W6b | **Found for a line nobody sold** (`findpick`) | `supplierId`, `supplierName`, `price = round(purchasePrice)`; delete `clientWaits`, `shelfAuto` | none | 5163–5181 |
| W6c | **Auto-follow the better pick** (no tap) | `followPicks` after **every render**: for a line still To ask, not `pickKept`, not on a trip, where `pickReason` names a better supplier → `setLineSupplier`, `price = round(purchasePrice)` | none | 4919–4945 |
| W7 | **Switch item** | `ACT.swapgo`: `productId`, `variantIdx`, `productName`, `unit`, `packUnit`, `packQty`, `supplierId`, `supplierName`, `price`; delete `priceReview`, `clientWaits`; `switchedFrom`. Then `buyer_handoffs` insert `item_switch` for `sales`, ref = orderId, payload `{orderId, client, lineId, from, to, why, priceWas, priceNow, supplierId}`. | `item.switch` to the order's salesperson, else Sales (0134 `buyer_handoffs_ow_push3`) | 5391–5416 |
| W8 | **Remove line** (needs 2+ lines) | splice from `items`; append to `droppedLines` with `reason` ("Nobody has it" / "Too dear" / "Client said no"), `droppedAt`, `by`; then `orderLeaveDraft`. Also `dropNoneLine` for a line with no supplier. | `line.dropped` to the taker (0136 `saved_quotes_ow_push3`); a Sourcing request from `droppedLines` (0126) → `sourcing.dropped` | 2668–2673, 5183–5202 |
| W8a | **Client waits** (→ Sourcing) | `nonewait`: a line with no supplier gets `clientWaits = {at, by, via?:'sourcing'}` (undo deletes it); then `orderLeaveDraft` | 0139 `saved_quotes_waiting_to_sourcing` makes a `sourcing_leads` request (`droppedBy` = by) → `sourcing.dropped`; when Sourcing finds it, `sourcing.found` to that Buyer (0144) | 5202–5219 |
| W9 | **Order leaves Checking** (`orderLeaveDraft`) | inside the same `changeOrder` as W2/W3/W4/W6a/W8/W8a: `status` → `awaiting_goods` when a bought-in line is not received, else `preparing`; `stageEnteredAt`, `stageLog += {status, at, auto:true}`; `p_status` sent | Stage check (`supplier.confirm`); gate may hold it (`gateHeldMove`); entering `awaiting_goods` fires `order.buying` (0131 `saved_quotes_ow_push2`, task `trip.plan`) | 1094–1105, 2447–2458 |
| W10 | Ready day | toggles `supplierConfirms[sid].readyOn` | none | 2570–2581 |
| W11 | **Carton OK ask** (a pack over 10× the sale) | `restock_buys` insert `{id:uuid, product_id, variant_idx, qty: shelf part, unit, supplier_id, price, status:'held', for_line: 'orderId:lineId', created_by}` | `carton.ask` to the Manager (0151 `restock_buys_ow_ask`, `restock.hold`); a no is `carton.refused` (0158) | 3573–3584 |
| W12 | **Cash ask to Accounts** (Plan) | close the old open ask (`status='withdrawn'`), then `buyer_handoffs` insert `trip_cash` for `accounts`, ref `'round:'+uuid8`, payload `{supplierId, supplierIds, supplier, stops, amount, for, v:2}`. On a trip already out (`tcashask`) the payload adds `roundOf`, `round`. | `trip.cash.ask` to Accounts; Accounts' done → `trip.cash.ready` to the Buyer (0131 `buyer_handoffs_ow_push2`) | 3861–3876, 4481–4490 |
| W13 | **Plan the trip / round** (`slide:trip`) | refuses unless cash is handed over, or the Buyer goes on their own money, or the supplier delivers. One `collection_trips` insert per stop: `{id:'TRIP-<base36>[-n]', shop_id, supplier_id, status, assigned_worker_id, created_at (1 ms apart), assigned_at, accepted_at, collected_at:null, confirmed_at:null, note:null, lines, voided:false, cash_given}`. Status: `collecting` for me or the supplier (`__supplier__`), `assigned` for someone else, `open` for nobody. Cash split by each stop's plan, the rest on the last. Then `restock_buys` → `on_trip`, `trip_id` (W21). The cash ask's payload gets `round: <stem>` (update). Own money: `tripPay['round:'+id].own = true` (phone only). | `trip.sent` to the runner (0150), none for me or the supplier | 3938–3980 |
| W13a | Take an open trip's lines into this stop | `dropStop(x,'Taken into a new trip')`; undo sets `voided:false, note:null` | none | 3613–3631 |
| W13b | Give a late trip to someone else / cancel it | `update {assigned_worker_id, status:'assigned', assigned_at, accepted_at:null}`; cancel = `dropStop(x,'Cancelled: not taken')`; undo resets | `trip.sent` to the new runner, `trip.taken` to the old (0150); `trip.cancelled` (note starts "Cancelled") | 3736–3763 |
| W14 | Take a trip sent to me (`slide:take`) | re-read; `open` → `{status:'collecting', assigned_worker_id: me, assigned_at, accepted_at}`; `assigned` → `{status:'collecting', accepted_at}` | none | 4384–4398 |
| W15 | **On the trip, per line**: as planned / short / undo / price paid | `setGot` keeps it on the phone; `flushTrip` 1.5 s later (and when back online): re-read the trip (only while `collecting`), set `lines[i].gotQty` and `gotPrice` (blank = `expectedPrice`), `update({lines})`. "Short" takes one pack (or one unit) off each tap. | none | 3998–4036, 4336–4352 |
| W16 | **Paid at a stop** (amount, receipt photo or none) | phone only (`tripPay`) | none | 4290–4302 |
| W17 | **Done here** (`markStopDone`) | `flushTrip`; `stopReadyWhy` must be empty; the receipt photo goes up to storage `bill-photos/<shop>/<uuid>.<ext>`; `tripPay[id].done` (phone only) | none | 4433–4439 |
| W17u | **Undo a stop just done** (new app, TripOn.dc.html Success "Undo 5"; buyer.html has none) | `tripPay[id].done` and `.amount` cleared on the phone; what came stays on the lines as a draft; refused once the stop is `collected` | none | — |
| W17a | A stop off the round (`stopdrop`) | `dropStop`: the stop's `cash_given` is added to a stop that stays; `update {voided:true, note, cash_given:0}`; its restock lines `{status:'planned', trip_id:null}` | none | 4455–4480 |
| W18 | **Hand in** (`slide:handin`) | each stop going in: `flushTrip`, re-read, check `stopReadyWhy`; stops not reached → `dropStop(…,'Left for a later trip')`; then each stop `update {status:'collected', collected_at: now (one time for all), lines (a short line's gotPrice nulled when it equals expectedPrice), pay}`; then per stop W19, W21 (`collected`), `sendReceipt` (W20); `pay.photoPath` added once the photo is up; then W18a. | `trip.back` (Store, `stock.receive`) + `trip.cash` (Accounts) **once per round** (0147/0150, round = id stem); `trip.short` to each order's salesperson for a short line (0144) | 4496–4555 |
| W18a | **Own money / pay back** | if the round went on the Buyer's money: `buyer_handoffs` insert `own_money` for `accounts`, ref `'round:'+stem`, payload `{buyer, round, amount, stops:[{tripId, supplier, amount, receipt}]}`, once per round | `trip.own_money` to Accounts (0151); Accounts pays with `buyer_payback` (0154) | 4412–4417 |
| W19 | **Prices paid to the list** | `rpc('trip_prices_to_list', {p_shop_id, p_trip_id})` per stop | `prices_ow_push` `price.changed` where a list price moved | 4557–4565 |
| W20 | **Receipt to Accounts** | `buyer_handoffs` insert `paper_bill` for `accounts`, ref supplierId, payload `{ownMoney?, supplierId, supplier, billNo:'', total, planned, photoPath, takenAt, tripId, receipt:true, termsDays}`. No photo, no bill (0151). A paper bill from a supplier's page: same kind, with `billNo`, `tripId` of their last trip. | `bill.paper` to Accounts (0134, `bill.record`) | 4316–4325, 5519–5537 |
| W20a | Yard count differs: say why (**broken today**, §7 #11) | `buyer_handoffs` insert `yard_note` for `manager`, ref tripId, payload `{tripId, supplierId, why, words, lines:[{lineId, orderId, productId, name, you, yard}]}`; withdraw = W24 | `trip.yard_note` (0134, `trip.difference`) | 4607–4620 |
| W21 | **Restock buys** | add from the list (`rsgo`): insert `{id, product_id, variant_idx, qty, unit, supplier_id, price, status:'planned', created_by}`; take off (`rsoff`): `status:'cancelled'`; on a trip: `{status:'on_trip', trip_id}`; handed in: `status:'collected'` | none on `planned` (the `restock_buys_ow_ask` push is for `held` with `for_line` only) | 5913–5932, 5904–5909, 5947–5956 |
| W21a | **A yard ask** (Store 0157) | after 6 s Undo: on add, insert a `planned` restock buy at `recommendedRow`; then `rpc('answer_store_ask', {p_id, p_status:'accepted'|'declined', p_note})` | `store.ask.decided` to the asker (0157) | 5785–5810 |
| W22 | **Price confirm** (Prices to confirm) | after 6 s Undo: `rpc('buyer_confirm_price', {p_shop_id, p_price_id, p_wholesale: new or null for "still the price", p_qty: units})` | `decision_log` `price.confirm`; `price.changed` when it moved | 3409–3431 |
| W23 | **Suggest a fix to Sourcing** | `buyer_handoffs` insert `sourcing_fix` for `sourcing`, ref supplierId, payload `{supplierId, supplier, how, fixes:[{tab, item, priceId, field, label, was, now, packUnit?, packQty?}], tidy?}`. Also "back in stock" (field `status`), "may be the same supplier" (`tidy:true`). | `sourcing.fix` to Sourcing (0134, `price.list`) | 5650–5657, 3432–3439, 6129–6135 |
| W23a | **Supplier phone** | saved on the phone (`ow-buyer-phones`), then a `sourcing_fix` `{tab:'sup', field:'phone', was:'', now}`; removing it withdraws the hand-off | `sourcing.fix` | 6089–6096, 3290 |
| W24 | Withdraw any hand-off | `buyer_handoffs.update({status:'withdrawn'})` | none (guard: 0125/0151 `buyer_handoffs_guard`) | 5432–5437 |
| W25 | Put me on the team (owner with no staff row) | `rpc('next_entity_id', {p_kind:'staff', p_prefix:'ST', p_pad:3, p_floor})`, then `staff` insert `{id, name, phone:'', role:'buyer', user_id}` | none | 3886–3901 |
| W26 | This phone gets pushes | `staff` select id, then `push_subscriptions.upsert({shop_id, staff_id, user_id, fcm_token}, {onConflict:'fcm_token'})` | — | 1663–1686 |

---

## 4. Rules buyer.html works out (port once, into `src/core/buyer/`)

### 4a. Prices and suppliers

| Function | Line | In → out | The rule |
|---|---|---|---|
| `rankedPriceRows` | 921 | product, variant → rows | Rows not out of stock, by wholesale, then retail (missing = ∞). |
| `priceSideFor` / `purchasePriceAtQty` | 932 / 942 | row, qty → each | Wholesale from one pack up (`qty ≥ packQty`), else retail; the other side when that one is empty; tiers by `minQty` (`tieredUnitPrice` 933). |
| `rankedPurchaseRowsAtQty` | 949 | product, variant, qty → rows + `purchasePrice` | The rows above ranked by the price at this quantity. |
| `ipLineOutlay` | 956 | row, qty → `{units, rate, cash, forcedPack, packQty}` | A supplier with no retail price sells whole packs only: the quantity rounds up to whole packs (`forcedPack`). |
| `confirmedBest` | 1247 | order, line, qty → row or null | Only when the line's own supplier said yes: buy there at the agreed price (`repricedAt` and `price > 0`), else their row's price, else the line's `price`. |
| `lineRank` / `lineAlternatives` | 1445 / 1462 | line → rank of N; the next 3 cheapest | |
| `supplierRecord` / `supplierScore` | 4857 / 4878 | sid → 0–100 | Weights from `presets.supplierScore` (default filled 30, reply 20, fresh 20, full 15, owed 15); a part with no record scores 50. Reply: 100 − (median minutes − 15) × 80/165, kept between 10 and 100. |
| `pickReason` / `recommendedRow` | 4888 / 4908 | line → words / row | Cheapest first; inside the tie band (`presets.supplierTieBand`, default 2 %) a supplier whose score is more than 2 points higher wins. |
| `priceAgeDays`, `priceStaleDays`, `askPriceAge` | 1399, 1400, 6140 | | Stale after `presets.priceReview.staleDays` (default 90). An ask mentions price age after min(stale, 30) days. |
| `shareToday` / `confirmedToday` | 3007 / 2999 | → `{per, done}` | Per day = `priceReview.perDay`, else `targetPerPeriod/26`, else 6. Counts rows dated today with `price_source` `confirmed`/`purchase` or any `confirmed_via`. |

### 4b. Checking

| Function | Line | The rule |
|---|---|---|
| `orderSupplierGroups` | 1041 | The order's lines by supplier, skipping `__stock__` and lines with no supplier. |
| `orderSupplierTerms` | 1046 | `productId:variantIdx:qty:round(price)` joined by `|`. It must match the server's `ow_supplier_terms` (0174) exactly. |
| `orderSupplierConfirmState` | 1050 | `confirmed` with old terms reads as `stale`; no record reads as `pending`. |
| `answerOf` | 1407 | The buyer's word: `yes` · `no` (problem) · `again` (stale) · `asking` (askedAt) · `new`. A yes still inside its 6 s Undo already reads as yes. |
| `orderDraftReady` | 1056 | Every supplier group `confirmed` on the current terms. |
| `orderLeaveDraft` (the Checking gate) | 1094 | Leaves Checking only when every supplier said yes **and** it is not a prepay agent order to check or pay, no agent change or cancel is open, no Manager price waits (`priceWaits`: `priceNote` in `under/nomargin/nocost` with no `priceReview.state`), no credit hold (`creditHolds`: decision `hold`, or `cash` while unpaid), and no line with no supplier and no `clientWaits` (`noneOpen`). Then **Buying** if any bought-in line is not received, else **Packing**. |
| `holdOf` / `orderHoldReason` | 2347 / 2357 | One reason, in this order: undecided line (you) · price (Manager) · credit · agent change · agent to pay · price went up (told). |
| `checkOrders` | 1420 | Orders in `draft`, not voided, cancelled or aged off, with a supplier group; ones with a "no" first, then oldest. |
| `askingSuppliers` | 1431 | One row per supplier still `asking`/`again`/`new`, every order that waits on them, oldest ask first. |
| `CHASE_AFTER = 30` | 6051 | **The late-ask rule**: a WhatsApp ask can be chased after 30 minutes; before that the button waits. A call or a visit is never chased. |
| `shelfFor` | 1209 | "Use our shelf" is offered when the free shelf (`shelfAvailable` minus `shelfSpoken`) covers the whole line in the shelf's own unit. |
| `shelfAvailable` / `heldForOrders` | 1192 / 1183 | Stock less what live orders past Checking take off the shelf (rule A, shared with Sales and Store). |
| `cartonGate` | 1223 | A forced pack whose shelf part is over 10× the sale needs the Manager's OK (`restock_buys` held → planned/cancelled). |

### 4c. Buying and the trip

| Function | Line | The rule |
|---|---|---|
| `beingPreparedOrders` | 1297 | Orders in `awaiting_goods` or `preparing`, not voided, not aged off. |
| `orderPurchaseLines` | 1256 | Each bought-in line: where to buy (`confirmedBest`, else the cheapest row), qty (whole packs, or `receivedQty` once in), what is still out (`shortfall` once received), `lineCost = unitCost × outstanding`, `carton`. |
| `buyingListRuns` | 1298 | Lines with a cost > 0 and no carton waiting, by supplier, biggest total first. |
| `runsToGo` | 1336 | The runs, plus planned restock buys on a checked price (`restockRunLines` 5938) less goods already back at the yard after the buy was planned, less any line on a live trip (`lineIsOnATrip`). **What makes an order ready for Buying is W9; what puts its line on a trip is this.** |
| `tripsCoveringLine` | 1323 | A live trip (not voided, not `confirmed`) with this order and lineId; a trip line with no lineId matches the same product and variant on the same order. |
| `roundAreas` / `roundOrder` | 1456 / 1467 | The area is the part of a supplier's `location` (split on commas) that another stop shares, else its last part, else "Other". Areas with the most to buy first, then each area's stops biggest first. |
| `planSel` | 3473 | The stops ticked (all by default, at least one). Phone only. |
| `cashStep` / `roundUp` | 3448 / 3445 | The cash sheet offers the plan and the plan rounded up to 50k / 100k. |
| Cash split | 3946–3950 | Each stop gets its plan from the handover; whatever is left goes on the last stop. |
| `tripFromRun` | 1355 | A trip line per run line; `status` as in W13; id `TRIP-<base36 now>`. |
| `tripRound` / `roundStops` | 4039 / 4049 | **A round = trips with the same runner created within 2 s of each other**, in creation order. `tripRoundStem` (4081) is the id with `-n` cut off; the server's `ow_trip_round` (0147) does the same. |
| `roundCashH` / `roundHandover` | 4082 / 4093 | The round's `trip_cash` hand-off: `payload.round == stem`, else the old match (`roundOf`, same day and supplier). It is cash in hand only when its `status` is `done`. |
| `roundCash` | 4096 | Cash in hand at this stop = handed over − what the stops done so far paid. |
| `tripShortLines` (**the short rule**) | 1321 | A line is short when `gotQty` is answered and `< qty`. 0 is an answer. |
| `tripLinePaid` / `tripPlanFor` | 1382 / 4063 | Paid = got × (gotPrice, else expectedPrice). A stop's plan counts an unanswered line in full. |
| `paidShares` (new app, `src/core/buyer/rules.ts`) | — | The new page takes one amount per stop, not a price per line. A stop's payment is shared over its lines by what came at cost (got × expectedPrice), in whole shillings adding up exactly; each line's `gotPrice` = its share ÷ got, written at Done here (`supabase/trip.ts pricedLines`). So got × gotPrice adds up to what was paid, and Hand in's per-order figure (`handIn().byOrder`) is the books' order cost. Review 2026-11-11 F1: #0550 2,018,000, not 2,048,000. |
| `stopReadyWhy` | 4419 | A stop can be left when every line is answered, cash was handed over or the round is on own money, an amount is typed, there is a photo or "no receipt", and the amount is within 30 % of the plan unless confirmed with a photo (`payOdd` 4405). Nothing came = done as it is. |
| `tripPaidAt` | 4075 | The receipt's total, else the typed amount, else the lines. |
| Hand-in totals (`PAGE.done`) | 4644–4652 | Paid = Σ `tripPaidAt`; planned = Σ `tripPlanned`; **cash back = handover amount − paid** (none on own money). |
| `handInOf` | 4635 | The stops handed in together: same round, `collected_at` within 10 s. |
| `outGroups` (late trip) | 3659 | A runner's trip is late when nothing on it is loaded and it was made before today; a supplier delivery is late after its `delivery_days` (at least 1) with goods still to come. |

### 4d. Today and the shelf

| Function | Line | What it counts |
|---|---|---|
| `flowNow` | 5981 | `toAsk` (suppliers with an order not yet asked), `asked`, `runs` (`runsToGo`), `out` (live trips `open/assigned/collecting`), `back` (`collected`), `cash` (Σ runs). |
| `todayJobs` | 1987 | In order: orders with a "no" · my trips `collecting`/`assigned` (one per round) · suppliers to ask, the oldest order first · suppliers asked · runs not still asking · restock rows that must be bought now. |
| `viewToday` tiles | 1934–1940 | Problems = Σ "no" on Checking; asked; out; to go; my round's stops done. |
| `myMonthFull` | 4743 | My trips handed in this month: lines in full ÷ lines. |
| `cashToCarry` | 1470 | Runs + live trips' plan less paid (not supplier deliveries). |
| `restockRows` / `restockKind` | 5713 / 6153 | Items sold off the shelf in 30 days or with a reorder rule; need = (cover + lead) × rate − shelf − coming, rounded to whole packs; `tight` when the days left + days coming − lead ≤ 2. |

---

## 5. The tasks the Buyer holds (`docs/decision-rights.md`)

| Task | Buyer | What it lets the Buyer do in buyer.html | Server check |
|---|---|---|---|
| `supplier.confirm` | decides | W1–W5, W9 (leave Checking) | stage move (0173) |
| `line.reprice` | decides | W4 | — (Manager told: `price.waits`) |
| `line.switch` | decides | W6, W6a–c, W7 | — |
| `line.drop` | decides | W8, W8a | — |
| `trip.plan` | decides | W11–W13 | `order.buying` push target |
| `trip.collect` (Buyer, Store) | decides | W13b–W18 | — |
| `buy.restock` | decides | W21, W21a | — |
| `price.confirm` (Sourcing, Buyer) | decides | W4's list update, W22 | `buyer_confirm_price` (0138) |
| `price.approve` | proposes | `priceNote='nomargin'` (W4) | gate |
| `bill.record` | proposes | W20 | — |
| `trip.cash` | proposes | W12, W18a | — |
| `stock.receive` | proposes | **not the Buyer's**: the Store counts it in (`receive_trip`) | — |
| `trip.difference` | told / proposes | W20a | — |
| `supplier.edit`, `price.list`, `product.edit` | propose | W23, W23a | — |
| `restock.hold` | told | reads `held`; asks with W11 | — |

`buyer.html` never calls `has_task`; it lets in `buyer`, `owner`, `admin` and `manager` logins (1640) and leaves the checks to the server.

---

## 6. Where the new data layer differs from buyer.html (already, in `src/core/buyer/`)

- `source.ts` names a line by `idx`; buyer.html names it by `lineId` everywhere (order writes, trip lines, `for_line`). A line's index moves when another line is removed (W8), so writes must use `lineId`.
- `source.ts` has one `trip`; the database has one `collection_trips` row per stop, grouped into a round by the 2 s rule (§4c).
- `rules.ts` `ROUTE` is a fixed list of markets; buyer.html works out areas from each supplier's `location` (`roundAreas`).
- `askSourcing(item)` has no order; buyer.html only asks Sourcing through a line (`clientWaits`, W8a) or a `sourcing_fix` (W23).
- Sales' `patchOrder` (`src/core/supabase/write.ts:40`) sends neither `p_drop` nor `p_status`; the Buyer needs both (W9, a dropped key).

## 7. Open questions and places buyer.html disagrees with itself

| # | What | Where | Default until Kevin answers |
|---|---|---|---|
| 1 | **Auto-switch with no tap.** `followPicks` moves To-ask lines to the "better pick" after every redraw. Is that the Buyer's decision (`line.switch`) made by the phone? Two open phones can both do it. | 4919–4945 | keep, once per line and target (`followTried`) |
| 2 | **The client's hold is not the server's.** `creditHolds` reads only `creditCheck.decision`; the server (0174) also holds on the credit limit, a credit with no limit, and an old debt past the hold days. The phone says "moved" and the server keeps it (`gateHeldMove`); `heldToast` then names only credit or price, so `suppliers`/`unsourced`/`prepay` read as "a price waits". | 4840, 2510, 0174 | trust `gateHeldMove.why`; word all five |
| 3 | **"Done here", own money and the amount paid live only on the phone** (`tripPay`, a key not scoped to the shop) until the hand-in. A lost phone or a second phone loses them. | 4105–4108 | as today; ask Kevin whether `pay` should be written at "Done here" |
| 4 | **A round is "same runner, created within 2 s".** Two rounds started by two phones for one runner in the same 2 s would merge. The server's `ow_trip_round` uses the id stem instead. | 4039, 4049 | use the id stem (`tripRoundStem`) |
| 5 | Order number: `orderNo` writes `Q-0550`; CLAUDE.md says `#0550`. | 1020 | `#0550` |
| 6 | Dead code: `ACT.asked` (2564) is never wired up; in `pgo`, `a.phone` is always true, so "Re-priced — slide right when they confirm" (2927) never shows; in `sendReceipt` the no-photo `paper_bill` (4321) comes after `if (!P.photo) return true`. | | do not port |
| 7 | A chase does not stamp `askedAt` again, so "waiting 2 h" keeps counting from the first ask. | 2765 | as today |
| 8 | `orderSupplierTerms` writes qty with JS `String(n)` and the server writes `trim_scale(numeric)`; a qty like `1e-7` or `2.50` stored as text could differ, and a yes would read as stale on one side only. | 1048, 0174 | match the server: numbers, no trailing zeros |
| 9 | All of `saved_quotes`, `collection_trips`, `buyer_handoffs` and `restock_buys` are read whole on every boot or refresh. `05-data.md` §6 asks for windows. | 809–813, 862 | the live filter for orders; windows for the rest |
| 10 | `shelfFor` declines a line whose unit is not the shelf's own; `shelfPackFor` (rule A) converts a pack line. One shelf, two rules. | 1209 vs 1173 | Kevin |
| 11 | **The yard note never sends.** `ACT.yardsend` is defined twice: the yard ask's (5811) replaces the trip's (4607), so the Yard screen's "Send to the Manager" (4603) finds no `data-id` and does nothing. No `yard_note` is written from this app. | 4607, 5811 | the new app sends it (W20a) |
