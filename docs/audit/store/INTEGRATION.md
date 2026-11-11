# Store integration map: every handover between the yard and the other apps

Written 11 Nov 2026 from the code on this branch. Sources: `store.html`, `sales.html`, `src/apps/sales` +
`src/core`, `buyer.html`, `manager.html`, `accounts.html`, `sourcing.html`, `owner.html`, `index.html`,
`worker.html` + `worker-www/shared-worker.js`, `agent.html`, `client.html`, `supabase/migrations`
(0115-0181), `supabase/functions/notify-worker`, `notify-stock-count`, `push-send`,
`docs/decision-rights.md`, `docs/audit/GLOSSARY.md`.

How the yard is wired: the Store reads only `store_snapshot` / `store_live` / `store_order`
(0164/0166), which pass an order's payload through the allow-list `ow_store_payload`
(0164:176). It writes orders only through `store_patch_order` (0159/0162, its own keys:
`store.html:2289`), trips through `receive_trip` and `store_patch_trip`, returns through
`store_return_ask`, and inserts `stock_counts`, `stock_reports`, `store_asks`, `place_routes`,
`road_names`. Pushes go out through `ow_push` (0120's outbox, `push-send`), except two older
Edge Functions driven by Database Webhooks: `notify-worker` (orders to pack) and
`notify-stock-count` (counts).

Line refs are `file:line` on this commit. Migrations are cited as `NNNN:line`.

---

## 1. Handovers, app by app

### 1.1 Sales (old `sales.html` and new `src/apps/sales`)

| Handover | Dir | Trigger | Push kind → recipient | Words the sender shows | Words the Store shows | Refs |
|---|---|---|---|---|---|---|
| An order to pack (from the shelf) | →Store | `saved_quotes` insert/update into `status='preparing'` (new Sales `place_order` with Packing; old sales.html insert; a Checking order released) | `notify-worker` "Next to pick" → every staff row role worker/store; **only on UPDATE**, an INSERT straight into Packing is skipped | old: "Packing", chip "X packing · n of m packed" / "Being packed"; new: "Packing", "{name} packing" / "Store packing" | "To pack" (Today tile, list), row "To pack"/"Packing"/"Joy's" | sales.html:4607, 5846; src/core/orders.ts:50-62, 74-85; src/apps/sales/orders/data.ts:141; notify-worker/index.ts:155, 186-189, 309; store.html:1488-1491, 5708 |
| Pickup vs delivery | →Store | new Sales writes `payload.deliverTo = "where · when · phone"` (null = pickup); old sales.html writes nothing; agents write `deliveryMode`/`deliveryAddress` | none | new: "pickup"/"delivery"; "At the gate" / place name; "The walk-in collects it" | Decided by `orderDestination()`: agent `deliveryAddress`, else **customer.location**, else `deliveryAddress` when `deliveryMode='shop_delivery'`. `deliverTo` is **not in the allow-list** and is never read | src/apps/sales/sell/model.ts:93-118; 0180:150-151; src/core/supabase/rows.ts:193; 0164:179-182; store.html:1494, 1520-1525 |
| Delivery time ("today afternoon", "tomorrow morning") | →Store | inside the `deliverTo` string only | none | new Sales chip "today afternoon" | nothing; Load is ordered by `pickingDoneAt` | src/apps/sales/sell/model.ts:23, 118; store.html:1495 |
| Packed, waiting at the gate (pickup) | Store→ | `pickingStatus='done'`, status stays `preparing` | none | new: still "{name} packing"; old: "X packing"; tell text "we are packing it now" | "At the gate · bay N" / "Packed · they collect" | store.html:2386-2392, 3091, 4481, 5707; sales.html:6319; src/apps/sales/orders/data.ts:141 |
| Ready to collect | Store→ | Sales expects `pending_delivery` + no `deliverTo`; the Store never puts a pickup in `pending_delivery` (gate hand-over goes `preparing → completed` in one write) | none | new: "Ready to collect" / "at the gate" (never reached for a Store-handled pickup) | — | src/core/orders.ts:138-140; src/apps/sales/orders/view.ts:75-83, 156-159; store.html:2416-2426 |
| Not paid yet, held at the gate | Store→ | `ow_money_hold` (0156/0164) keeps a cash customer's packed order in; the Store may ask the Manager (`payload.creditAsk`) | `credit.ask` → credit.release (Manager); answer `credit.ask.decided` → the Store asker. **Nothing to the salesperson**, who must take the money | new Sales: "Not paid yet" only in Checking (`heldFor`); in Packing nothing; old: "Being packed" | "Not paid yet" + "Sales take the money before it leaves, or Ruth lets it go on credit." | store.html:1498-1505, 4805; 0156:125-138; src/core/orders.ts:142-144 |
| Loaded, on the road | Store→ | `applyLoad`: `carrier`, `assignedDeliveryId` (staff id or `__carrier__`/`__agent__`/`__client__`), status `pending_delivery` | `job.given` → the driver only when the Manager gives it (0158); none to Sales | old: "X carrying · left 10:02" / "Hired transport"; new: "{name} driving", else **"Ready to collect"** | "On the road", "out now" | store.html:2399-2412; sales.html:5534, 5848-5849; src/apps/sales/orders/data.ts:142; src/core/supabase/rows.ts:181 |
| Delivered at the door (photo or reason) | Store→ | `completed`, `deliveredAt` (ISO), `deliveredTo`, `deliveredPhoto` or `deliveredPhotoKind`+`deliveredNote` | `order.delivered` → invoice.make (Manager), not Sales | old: "Delivered 14:20", "Photo by …" (reads `deliveredBy`, which nobody writes); new: "At the door 14:20" | "Delivered" (button and stage) | store.html:2437-2455; 0120:262; sales.html:5994; src/apps/sales/orders/view.ts:82 |
| Collected at the gate | Store→ | `handOver`: same write sets `pending_delivery` then `completed`, `handoverCheckedAt`, `deliveredTo` = collector | `order.delivered` → Manager | old: "It was delivered today at …"; new: "At the door …" | "collected" (part of delivered: "3 delivered today · 1 of them collected") | store.html:2416-2426, 3570-3587; sales.html:6323; src/apps/sales/orders/view.ts:82 |
| Counter sale | (bypasses the yard) | `counter_sale` writes `completed`, invoiced, `deliveredAt` as **ms number**, `counter: true` | none (quiet) | "Counter sale" | not told it is a counter sale (`counter` is not in the allow-list): counted as "delivered · collected" | 0136:103, 157-161; 0164:179-182; store.html:1507-1510, 3587 |
| Cancel | →Store | Sales `ask_cancel` → Manager `cancel_order` (status `cancelled`, voided) | `order.cancelled` "Called off · stop packing" → order.pick, only when it was packing or out; Sales gets its own `order.cancelled` | "Cancel asked" / "Order cancelled" | "#0550 is called off", put-back screen for the packer only | 0177:208-219; 0181; store.html:4065, 4322-4349, 2666-2700 |
| Return asked by Sales | →Manager (Store never in it) | `invoice_asks` kind credit (old sales.html; new orders/Wrong) | `invoice.ask` → Manager; decided → asker | "Return asked", "Credit note … Goes on their account" | nothing; the shelf rises if the Manager restocks | sales.html:6277; manager.html:5379-5400 |

### 1.2 Buyer (`buyer.html`; there is no `src/apps/buyer`)

| Handover | Dir | Trigger | Push kind → recipient | Buyer's words | Store's words | Refs |
|---|---|---|---|---|---|---|
| Trip/round handed in at the yard | →Store | `collection_trips.status='collected'` | `trip.back` "A trip is back — count it in" / "A round is back — count it in" → stock.receive (Store); `trip.cash` → Accounts | "back · yard", "at the yard · Musa counts it in", "Now waiting for the Store to count it in", "HANDED IN" | "Back at the yard", "At the gate", "Check in Denis's trip", "{name} is back at the yard · N lines for you to check in" | 0120:287-290; 0147:50-52; 0150:73-75; buyer.html:3148, 3238, 3690, 4680, 4697; store.html:2905, 3078, 3320, 3473 |
| Yard count puts goods on the shelf | Store→ | `receive_trip` (0157 v2): `yardQty` per line, stock + lots + stock_log at the yard's count, Buying→Packing for orders now whole, trip `confirmed` | `trip.difference` → Manager when yardQty ≠ gotQty (trigger on `yard_checked_at`); notify-worker "Next to pick" for orders that moved | "CHECKED IN", "{Musa} counted it in", "Counted in and on the shelf" | "Checked in", "Your check-in of Denis's trip" | store.html:2476; 0157 `receive_trip` (lines 46-178 of the function); 0120:292-296; buyer.html:4680-4705 |
| Why the count differs (Buyer's note) | Buyer→Manager | `buyer_handoffs` yard note | `trip.yard_note` → Manager | — | Store's own reason rides as `yardWhy` | 0151:178; manager.html:2311-2315 |
| Goods on the truck not on the list | Store→Manager (Buyer not in it) | `store_asks` kind `extra` | `store.extra` → trip.difference (Manager); `store.new_item` → product.edit (Sourcing) if `newItem` | — | "Not on the list · keep it?" | store.html:2489; 0157:134-136; 0159:338-345 |
| "We need more" (restock) | Store→Buyer | `store_asks` kind `restock` | `store.restock` "More wanted on the shelf" → buy.restock; answer `store.ask.decided` → asker | Buyer answers with `answer_store_ask` ("On the restock list · goes on the next trip") | "We need more"; answered on Alerts | store.html:2498; 0157:128-133; buyer.html:5749-5808; store.html:2690-2691 |
| Short goods from a trip | Buyer→Sales; Store implicit | line `receivedQty` < `qty` | `trip.short` → Sales | "Short from …" | nothing on the pack sheet: the line asks for the full `qty` (`quoteLineShortfall` is defined and never used) | 0144:86; store.html:1771 |
| Big carton kept off the trip | Buyer→Manager | `restock_buys.for_line`, held | `carton.ask` → Manager; `carton.refused` → Buyer | "Sold only in cartons of 24 · Ruth must OK" | the order sits in "Waiting on goods · not bought yet" with no reason | buyer.html:1219-1244, 3573-3581; 0151:53; 0158; store.html:3547-3551 |
| Store staff ride a trip | Buyer→Store | trip assigned to a Store person | `trip.sent` / `trip.taken` / `trip.cancelled` → the runner | — | "{Buyer} sent you to {supplier}"; ride screen | 0150:49, 64; store.html:2677-2679, 2555 |
| Stock held for orders | both read | each app computes `shelfAvailable` | — | "17 · 3 held for orders" | "12 on shelf", "Low · 3 held for orders" | buyer.html:1172-1194; store.html:1597-1617 |

### 1.3 Manager (`manager.html`)

| Handover | Dir | Trigger | Push kind → recipient | Manager's words | Store's words | Refs |
|---|---|---|---|---|---|---|
| Short pick to settle | Store→Manager | pack finished with a `pickStatus='short'` line | `pick.short` "A short pick to settle" → pick.settle; settle notifies nobody in the yard | "Billed what went" / "Billed the full quantity" (`pickSettle`) | waiting: "Short pick · #0550 …"; answered: "Ruth settled #0550's short pick" (Alerts only, on refresh) | 0120:244-247; manager.html:5202-5207; store.html:3289-3291 |
| "On credit?" for an unpaid packed order | Store→Manager→Store | `creditAsk` written through `store_patch_order` as `letGoAsk`; Manager writes `creditCheck` + `creditAsk.answer` | `credit.ask` "Not paid · let it go on credit?" (body: "… · cash customer. Credit or cash first?") → credit.release; `credit.ask.decided` "On credit · load it" / "Cash first · keep it" → asker | "SOMEONE IS WAITING NOW"; decision `release`/`cash` | "Not paid yet · let it go on credit?"; answers "Let it go on credit · load it" / "Keep it until it is paid" | store.html:1504, 3284-3288, 4805; manager.html:4078-4111, 4183-4188; 0156:125-138; 0164 `ow_store_payload` (letGo/letGoAsk) |
| Stock report → write-off | Store→Manager→Store | `stock_reports` insert; Manager `write_off_stock` | `stock.report` → stock.writeoff; `stock.report.decided` → reporter | "Write off" | "Damaged · …", "Ruth wrote off 3 …" / "kept … on the shelf" | store.html:2513; 0129:30; manager.html:5292-5316; 0131:150; store.html:2692-2696, 3273-3276 |
| Blind count → accept / recount | Store→Manager→Store | `stock_counts` insert (`system` = books less what left for orders) ; `accept_stock_count` / `ask_recount` | `notify-stock-count` "Stock take done" → **every owner, admin and manager login by role** (data kind `stock_count`); accept/recount push **nothing** back | "BLIND STOCK TAKE", "books 12 → counted 10", "agree with the books", "Accept the count" / "Recount N" | "Accepted your count" / "Asked for a recount" (Alerts, on refresh). Owner/admin/manager can also accept **in the Store app** | store.html:2578-2614, 5352, 1390, 5880-5914; notify-stock-count/index.ts:97-104; manager.html:5321-5340 |
| Trip check-in differs | Store→Manager | `yard_checked_at` with yardQty ≠ gotQty | `trip.difference` → Manager | "Seen" (`accept_trip_difference`) | answered "Ruth accepted your check-in" — shown at `confirmedAt` (the Store's own write) | 0120:292-296; manager.html:5221-5284; store.html:3297-3298 |
| Goods not on the list | Store→Manager | `store_asks` extra | `store.extra` → trip.difference | **no screen; manager.html never reads `store_asks`; pushOpen has no case** | "Not on the list · keep it?" waiting | store.html:3277-3280; 0157:134; manager.html:2280-2330 |
| Yard closed | Store→Manager | `store_asks` kind close | `store.closed` → role manager | **no screen** | "Close the yard" | store.html:6284; 0157:141-145 |
| Return asked at the gate | Store→Manager→Store | `store_return_ask` (priced in SQL; each line `condition` good/damaged) → `invoice_asks` credit | `invoice.ask` → credit_note.raise; `invoice.ask.decided` → asker (Store pushOpen has no case) | "RETURN · JOY ASKS", "Back on the shelf" toggle defaulted from the **reason text**; slide "Raise the credit note"; only on an **invoiced** order | "Return · #0548 …", answered "Raised the credit note" / "Kept it as sold" | store.html:2528-2537, 6001, 3266-3270; 0164 `store_return_ask`; manager.html:5350-5408 |
| Cancel | Manager→Store | `cancel_order` | `order.cancelled` → order.pick | "Cancel" | "#0550 is called off", put back | 0177:212-214; store.html:4322-4349 |
| Packer given / driver given | Manager→Store | `handToPacker` (`pickingStatus='awaiting_accept'`), `handToDriver` (`carrier.by='manager'`) | notify-worker "New order to prepare" → the packer; `job.given` "A delivery for you" → the driver | "ASSIGNED · Joy has #0550 now" | packer: no "awaiting_accept" state anywhere; shows "To pack" and anyone can take it; driver: opens Deliver | manager.html:1951-1966, 3413-3421; notify-worker/index.ts:180-182, 256; 0158:100; store.html:2368-2381, 2686-2687 |
| Stage moved by the Manager | Manager→Store | `obMove`: "Mark done" (→ completed, `deliveredAt`, no proof), next stage (Packing → On the road with no carrier), undo | `order.delivered` → invoice.make; nothing to the Store | "Mark done", "#0550 is delivered", "In Delivered today" | the order leaves To pack/Load with no word | manager.html:3456, 3470, 3501-3530 |
| Automatic invoice 24 h after delivery | DB→all | hourly run on `completed`, `coalesce(deliveredAt, stageEnteredAt)` ≤ now − 24 h | `order.invoiced` → Accounts, salesperson | "Ready to invoice · yours, or by itself after 24 hours" | the order leaves the board 24 h after `invoiced_ts` (`quoteAgedOffBoard`) | 0169:807-830; 0138:568-572; store.html:1750 |

### 1.4 Accounts (`accounts.html`)

| Handover | Dir | Trigger | Push | Accounts' words | Store's words | Refs |
|---|---|---|---|---|---|---|
| A trip back: count its cash | Buyer→Accounts (fires on the same `collected` write the Store reacts to) | `collection_trips.status='collected'` | `trip.cash` → trip.cash | trip cash count (`trip_cash_count`) | — | 0120:289; accounts.html:1442-1446, 6691-6695 |
| Money at the gate or door | none | The yard takes no money by design (0159); a cash customer's order cannot leave unpaid (0156) | — | — | "Not paid yet" | store.html:1498-1499; 0164 `saved_quotes_ow_money_gate` |
| Daily close | none | The Store's close (`store_asks` close) goes to role manager only | — | — | "Close the yard" | store.html:6284 |
| Agent paid on delivery | agent→Accounts | Store delivers an `on_delivery` agent's order; nothing marks money due | — | agent pay (`agent.pay`) | the Store sees `terms` only | store.html:1237, 1772-1776; agent.html:7845 |

Accounts and the Store share nothing directly; this is by design (no money on a yard phone).

### 1.5 Sourcing, Owner, console

| Handover | Dir | Trigger | Push | Their words | Store's words | Refs |
|---|---|---|---|---|---|---|
| New item checked in at the yard | Store→Sourcing | `store_asks` extra with `newItem` | `store.new_item` "A new item at the yard" → product.edit | **sourcing.html has no screen and no push case for it** | "Not on the list · keep it?" | 0159:342-345; sourcing.html (no match for `store_asks`/`new_item`) |
| Decision log (write-off, count accepted, credit note, pick settle) | Manager→Owner | `ow_log` from the Manager's writes; Store writes are not logged | owner digest 19:00 | Owner app log | — | manager.html:5207, 5400; 0120:401 |
| Stage words and stuck clocks | Owner reads | Owner `isStuck` on stage limits (Packing 120 min) | — | "Checking · Buying · Packing · **On road** · Done today"; task label "**Count a trip** at the yard" | Packed orders are not stuck in the yard's eyes | owner.html:3274, 3349, 3373-3384 |
| Console order board | console reads/writes | console moves stages, `saveDeliveredProof`, and checks in trips itself (`confirmCollectionTrip`, Buyer's `gotQty`) | — | "Step 3. Being Prepared", "Step 4. Pending Delivery", "Step 5. Completed"; lanes "Taken · Buying · Preparing · Out · Delivered"; "Waiting for a picker", "Being picked", "Out for delivery" | Store vocabulary | index.html:44866-44872, 68991, 84780-84795, 58954, 59284, 64284 |

### 1.6 Worker, agent, client

| Handover | Dir | Trigger | Push | Their words | Store's words | Refs |
|---|---|---|---|---|---|---|
| Worker app packs and loads | parallel to the Store | direct `saved_quotes` writes (`WORKER_OWNED_KEYS`), only move `preparing → pending_delivery`; uses `awaiting_accept` | notify-worker | "New order to prepare" (accept, pick) | the same orders as "To pack" | worker.html:770-799; worker-www/shared-worker.js:2313-2322 |
| Agent pickup | Store→agent | Store's agent hand-over (`agTry`, `handOver` kind agent) `preparing → completed` | none | agent: "Packing · Being packed now" until it is "Done · Collected"; "Ready · Waiting at the shop for you" and the Pickup row need `pending_delivery` (never seen) | "Agent" chip, "Handed to Paul · Their app shows #0550 as collected" | store.html:5065, 5101, 5707; agent.html:6199, 7835-7846 |
| Agent sees Buying | agent reads | `awaiting_goods` | — | "**Packing** · The shop is bringing some items in" | "Waiting on goods" | agent.html:7834; store.html:1492 |
| Client sees the stage | client reads | status | — | "With the shop · Getting your goods · Being prepared · On the way · Delivered"; "It has left the shop" | — | client.html:978-990 |

---

## 2. The order's state machine, word by word

Status column is `saved_quotes.status`; substate is in the payload.

| Status / substate | Sales old (`sales.html`) | Sales new (`src/apps/sales`) | Agent | Client | Store | Manager | Accounts | Owner | Console |
|---|---|---|---|---|---|---|---|---|---|
| `draft` | Checking | Checking (+ "Not paid yet" when held) | Checking / Confirmed / Pay now | With the shop | Checking (look only) | Checking | — | Checking | Step 1. Draft / Taken |
| `awaiting_goods` | Buying ("being bought in", "n of m in") | Buying ("n of m came") | **Packing** ("The shop is bringing some items in") | Getting your goods | Waiting on goods (+N beside To pack); "not bought yet" / "on the way · Denis" / "at the gate · check it in first" | Buying | — | Buying | Step 2. Awaiting Goods / Buying |
| `preparing`, nobody on it | Packing · "Being packed" | Packing · "Store packing" | Packing · "Being packed now" | Being prepared | To pack | Packing · "Nobody has it" | — | Packing | Step 3. Being Prepared / Waiting for a picker |
| `preparing`, `awaiting_accept` (Manager or worker app gave it) | "Joy packing" | "Joy packing" | "Joy is packing it" | Being prepared | **To pack** (no such state) | "With Joy" / "ASSIGNED" | — | Packing | Being picked |
| `preparing`, `in_progress` | "Joy packing · 2 of 5 packed" | "Joy packing" | "Joy is packing it" | Being prepared | Packing / "Joy's" / Packing now | With Joy | — | Packing | Being picked |
| `preparing`, `done`, delivery | "Joy packing · 5 of 5 packed" | "Joy packing" | "Joy is packing it" | Being prepared | Packed / On bay B | Packing (stuck after the limit) | — | Packing (stuck) | Being Prepared |
| `preparing`, `done`, pickup | as above; tell "we are packing it now" | as above | as above | Being prepared | **At the gate** · bay B / "Packed · they collect" | Packing | — | Packing | Being Prepared |
| `preparing`, `done`, money hold | as above | as above | — | Being prepared | **Not paid yet** | Credit ask (if asked) | — | Packing | Being Prepared |
| `preparing`, agent pickup, `done` | — | — | Packing · "Being packed now" | — | Agent | Packing | — | Packing | Being Prepared |
| `pending_delivery`, staff driver | On the road · "Ssali carrying · left 10:02" | On the road · "Ssali driving" | On the way · "Ssali is delivering" | On the way | On the road / out now | On the road ("On road" short) | — | **On road** | Step 4. Pending Delivery / Out for delivery |
| `pending_delivery`, hired / client's own | "Hired transport" / "Client's own person" | **"Ready to collect"** (no staff holder) | On the way · "Out for delivery" | On the way | On the road | On the road | — | On road | Out |
| `pending_delivery`, pickup | (transient; the Store never leaves it here) | Ready to collect · "at the gate" | Ready · "Waiting at the shop for you" | On the way · "It has left the shop" | — | — | — | — | — |
| `completed` at the door | Delivered 14:20 · "It was delivered today at 14:20" | Delivered · "At the door 14:20" | Done · Delivered | Delivered | Delivered (button too) | Delivered · "to bill" / "not invoiced yet" | — | Done today | Step 5. Completed / Delivered |
| `completed` collected at the gate | "It was delivered today at …" | "At the door …" | Done · Collected | Delivered | delivered · **collected** | Delivered | — | Done today | Completed |
| `completed` counter sale | (a sale) | (a sale) | — | — | **delivered · collected** (no collector) | Delivered | income | Done today | Completed |
| `completed`, invoiced (≥ 24 h) | Invoice #… | Bill #… | Done / Settle up | Delivered | gone from the board 24 h after invoicing | invoiced | invoice to send (`order.invoiced`) | in sales | Completed |
| `cancelled` (voided) | Cancelled | Cancelled | — | — | "#0550 is called off" (packer only) | Cancelled | refund/deposit if money | log | — |

Glossary verdict: Checking · Buying · Packing · On the road · Delivered are the shared words. "On road"
(Manager short label, Owner), "Pending Delivery", "Being Prepared", "Completed", "Out" (console) and
"Packing" for Buying (agent) break it. Customer-facing apps (client, agent) may keep their own
softer words, but they must map to the same states.

---

## 3. Mismatches

Severity: **H** a wrong action or a lost handover; **M** a wrong word or figure someone acts on;
**L** wording or dead code.

**IM-01 (H) Pickup or delivery is decided from different fields.**
Evidence: new Sales writes `payload.deliverTo` (null = pickup) — src/apps/sales/sell/model.ts:118,
0180:150-151; Sales reads `deliveryAddress || deliverTo` — src/core/supabase/rows.ts:193.
`ow_store_payload` does not pass `deliverTo` (0164:179-182). The Store's `orderDestination()` uses the
customer's `location`, else `deliveryAddress` only when `deliveryMode='shop_delivery'` (store.html:1521-1525).
Impact: a delivery to a customer with no saved location shows as "At the gate" and waits for a
collector; a pickup for a customer with a location goes to Load and a driver drives it.
Fix: one rule: `deliverTo` (or agent `deliveryAddress`) decides; customer.location only fills an
address the order already says to deliver. Add `deliverTo` to the allow-list and read it first.
Session: **Store** (migration + store.html), with **Sales** writing structured keys (IM-02).

**IM-02 (M) The delivery time and phone live inside a joined string.**
Evidence: `deliverTo = [where, "today afternoon", phone].join(' · ')` (src/apps/sales/sell/model.ts:93-118).
The Store has no due time; Load sorts by `pickingDoneAt` (store.html:1495).
Impact: the yard cannot plan the truck by when it is due; parsing a string breaks on a " · " in an address.
Fix: Sales writes `deliverTo` (place), `deliverWhen` ('today-pm'…), `deliverPhone`; the allow-list
passes them; the Store sorts Load and the bay map by due time and shows "due this afternoon".
Session: **Sales** (place_order input), **Store** (migration + Load).

**IM-03 (H) "Ready to collect" is never reached.**
Evidence: the Store keeps a packed pickup at `preparing` + `pickingStatus='done'` ("At the gate",
store.html:3091, 5707) and goes straight to `completed` at the hand-over (store.html:2416-2426,
5065). New Sales `readyToCollect` needs `stage==='road'` (src/core/orders.ts:138-140); the agent app's
"Ready · Waiting at the shop for you" and its pickup row need `pending_delivery`
(agent.html:6199, 7840); client says "It has left the shop" for `pending_delivery` (client.html:989).
Impact: Sales and agents keep telling customers "being packed" while the goods wait at the gate;
nobody is told to come.
Fix: one definition, "Ready at the gate" = `preparing` ∧ `pickingStatus='done'` ∧ pickup ∧ no money
hold. Sales (`readyToCollect`), agent (`orderStage`, pickup rows) and client read it. Add a push
`order.ready` to `takenBy` (and the agent) on that transition.
Session: **Sales**, **agent**, **client** change their rule; **Store** adds the push (migration).

**IM-04 (M) New Sales says "Ready to collect" for deliveries on hired transport.**
Evidence: src/apps/sales/orders/data.ts:142 returns "Ready to collect" for any `road` order with no
staff holder; `holderId` drops `__carrier__`/`__client__` (src/core/supabase/rows.ts:181).
Impact: a hired lorry on its way reads as waiting at the gate.
Fix: use `readyToCollect(o)` there; name the carrier ("Hired · Ssali") from `carrier`.
Session: **Sales**.

**IM-05 (M) Sales cannot see "Packed".**
Evidence: Store: Packed / On bay B / At the gate / Not paid yet (store.html:5707). New Sales
"{name} packing" (data.ts:141); old "Joy packing · 5 of 5 packed" (sales.html:5846) and the
customer text "everything is in and we are packing it now" (sales.html:6319, 6397).
Impact: Sales tells customers it is still being packed when it is waiting for the truck or for money.
Fix: Sales shows "Packed · waits for the truck" / "At the gate" / "Not paid yet" from `pickingStatus`.
Session: **Sales** (old and new).

**IM-06 (M) Collected at the gate is reported as "at the door".**
Evidence: Store says collected (GLOSSARY Delivered; store.html:3570-3587); new Sales "At the door 14:20"
(src/apps/sales/orders/view.ts:82); old Sales tells the customer "It was delivered today at …"
(sales.html:6323).
Fix: Sales reads `handoverCheckedAt` (or no destination) and says "Collected 14:20 by {deliveredTo}".
Session: **Sales**.

**IM-07 (H) "Not paid yet" at the gate tells the wrong people.**
Evidence: the money hold (0156, store.html:1502) says "Sales take the money before it leaves"
(store.html:1499), but no push reaches the salesperson: `credit.ask` goes to credit.release and
`credit.ask.decided` to the Store asker only (0156:125-138). New Sales flags "Not paid yet" only in
Checking (src/core/orders.ts:142-144); in Packing it shows nothing. When the Manager answers "cash
first", only the yard hears.
Impact: the customer waits at the gate; the one person who can take the money does not know.
Fix: push `order.unpaid_at_gate` to `takenBy` when a packed order has a money hold (and again on a
"cash" answer); Sales shows "Not paid yet · at the gate" with Take payment.
Session: **Store** (migration), **Sales** (show it).

**IM-08 (H) The Manager's choice of packer is ignored in the yard.**
Evidence: `handToPacker` sets `pickingStatus='awaiting_accept'` (manager.html:1955); the Store has no
`awaiting_accept` (0 matches); `takenBySomeoneElse` needs `in_progress` (store.html:1512) and
`takeOrder` refuses only `in_progress` (store.html:2371-2373), so any phone takes it as "To pack".
Impact: the person the Manager chose gets "New order to prepare", opens it, and finds someone else
already on it.
Fix: the Store shows "Ruth gave it to Joy" for `awaiting_accept`, and only that person (or a
Manager login) may take it; taking it moves it to `in_progress`.
Session: **Store**.

**IM-09 (M) The packing pushes do not speak the yard's words.**
Evidence: notify-worker "New order to prepare" and "Next to pick … the next free picker takes it"
(notify-worker/index.ts:256, 309); Store: "To pack", "Pack".
Fix: "To pack · #0550 · Mukasa · 5 items" and "Ruth gave you #0550 to pack".
Session: **Store** (the function serves the yard).

**IM-10 (H) An order placed straight into Packing rings nobody.**
Evidence: notify-worker skips anything but an UPDATE (notify-worker/index.ts:155); Sales places
shelf-only orders directly in Packing (src/core/orders.ts:50-62, 75; 0180).
Impact: the yard learns of the order only when someone opens the app (45-second refresh).
Fix: send the "to pack" push from an `ow_push` trigger on insert or update into `preparing`
(to_task `order.pick`), and retire notify-worker's queue path.
Session: **Store** (migration).

**IM-11 (H) A cancel reaches only the packer who had it open.**
Evidence: `order.cancelled` "Called off · stop packing" goes to order.pick (0177:212-214) but
`pushOpen` has no case for it (store.html:2666-2700). The put-back job exists only for orders
`in_progress` and assigned to this phone's person (store.html:4349); a cancelled order already
Packed on a bay or loaded on a truck gets no job. "Put back" is kept in localStorage only
(store.html:4342-4347).
Impact: packed goods for a cancelled order stay on the bay or go out on the truck.
Fix: pushOpen opens the put-back; put-back covers `done` and `pending_delivery` orders (bay → shelf,
truck → "bring it back"); the put-back is written (`store_patch_order` `putBackAt`) so the
Manager sees it was done.
Session: **Store**.

**IM-12 (H) The Store can ask a return the Manager cannot settle.**
Evidence: the Store's return list takes delivered orders of 30 days and, for drivers, orders on
the road (store.html:6001); `store_return_ask` does not ask for an invoice (0164). The Manager's
credit note throws "that invoice is voided or not raised" on an order not yet invoiced
(manager.html:5386).
Impact: a return asked in the first 24 hours (when returns are most likely) sits until the
automatic invoice, and one on the road never fits a credit note.
Fix: before the invoice, a return is a change to the order (fewer on the line, Manager's
`order.cancel`/line edit) not a credit note; the Store says "Not billed yet · Ruth takes it off the
order". Agree the path with the Manager session.
Session: **Manager** (accept a pre-invoice return), **Store** (word it).

**IM-13 (M) The Store's "damaged / can sell" per line is thrown away.**
Evidence: `store_return_ask` keeps each line's `condition` (0164); the Manager's "Back on the shelf"
default reads the reason text `/scratch|damag|broken/` (manager.html:5354). "Came back · some
damaged" turns every line off.
Fix: default each line from `condition`.
Session: **Manager**.

**IM-14 (M) The yard is not told what happened to the goods it took back.**
Evidence: `invoice.ask.decided` goes to the asker (0131:132) but Store pushOpen has no case;
`takenBack` gives the Store qty but not `restocked` (0164 allow-list). The Store says "Raised the
credit note" / "Kept it as sold" (store.html:3269); after "kept as sold" the goods are in the yard and
off the books, with no instruction.
Fix: pass `restocked` (per line) in `takenBack`; Store says "Back on the shelf" / "Put aside · not
for sale"; a declined return asks the yard to hand the goods back to Sales/the customer.
Session: **Store** (migration + words), **Manager** (record per line).

**IM-15 (H) A return raised by Sales puts stock on the shelf the yard never saw.**
Evidence: Sales asks credit notes (sales.html:6277; new orders Wrong); the Manager's credit note
restocks with `manager_stock_move` (manager.html:5398) and tells Accounts and Sales only
(decision-rights row `credit_note.raise`).
Impact: the shelf rises with nothing physically in the yard; the next count shows a loss.
Fix: a restock from a credit note is pending until the yard checks it in (a `store_asks` kind
`return_in`, pushed to stock.receive); or only a Store-asked return may restock.
Session: **Manager** + a migration (Store's number if the yard owns `return_in`).

**IM-16 (M) A credit note is three writes.**
Evidence: `changeOrder` (credit note), `manager_stock_move`, `decide_invoice_ask` in sequence
(manager.html:5379-5400).
Impact: a failure part-way leaves the Store's return "with Ruth" though credited, or stock back
with no note.
Fix: one function (`raise_credit_note`) like `cancel_order`.
Session: **Manager** (migration).

**IM-17 (H) "Not on the list · keep it?" has nobody to answer it.**
Evidence: `store.extra` → trip.difference (0157:134-136); manager.html never reads `store_asks` and
pushOpen has no case (manager.html:2280-2330); no other app reads it (only store.html, buyer.html).
Impact: the Store's ask waits forever; the goods sit in limbo.
Fix: Manager app: a "Not on the list" card in Decide (keep → shelf / send back), answering with
`answer_store_ask`; pushOpen case.
Session: **Manager**.

**IM-18 (L) The yard's close reaches no screen.**
Evidence: `store.closed` → role manager (0157:141-145); no app shows `store_asks` kind close.
Fix: Manager's day view shows "Yard closed 18:10 · 2 carried over"; the console's report reads it.
Session: **Manager** / console.

**IM-19 (M) "A new item at the yard" reaches Sourcing with no screen.**
Evidence: `store.new_item` → product.edit (0159:342-345); sourcing.html has no `store_asks`/`new_item`.
Fix: Sourcing lists new items from the yard (photo, name, qty) to add to what we sell.
Session: **Sourcing**.

**IM-20 (H) A recount is asked of nobody; a count rings the owner.**
Evidence: `ask_recount` and `accept_stock_count` push nothing (no `ow_push` in 0115/0142/0143);
the Store learns only on refresh (store.html:3262-3264). `notify-stock-count` pushes every owner,
admin and manager by role (notify-stock-count/index.ts:104), against "the owner gets a log, never a
queue"; its data kind `stock_count` has no case in the Manager app's pushOpen (manager.html:2280-2330).
Fix: an `ow_push` trigger on `stock_counts`: insert → `stock.count.sent` to `stock.correct`;
recount → `stock.recount` to the counter; accepted → `stock.count.decided` to the counter. Retire
notify-stock-count. Manager pushOpen opens the stock take.
Session: **Store** (migration), **Manager** (pushOpen).

**IM-21 (M) A count is accepted in two apps.**
Evidence: Store: owner/admin/manager see Accept / Recount in the yard app (store.html:1390, 2605,
5880); Manager app does the same (manager.html:5336-5339).
Fix: the yard app shows the count as "With Ruth" for everyone; the decision lives in the Manager app.
Session: **Store**.

**IM-22 (M) The count's expected figure is called "books".**
Evidence: the Store sends `system` = books less what left the shelf for orders not invoiced
(store.html:5352); the Manager shows "books 12 → counted 10", "agree with the books"
(manager.html:5325-5331). GLOSSARY: a shelf figure is never "books".
Fix: "shelf 12 → counted 10", "agree with the shelf".
Session: **Manager**.

**IM-23 (M) "Ruth accepted your check-in" before she has seen it.**
Evidence: `receive_trip` always sets `status='confirmed'`, `confirmed_at` (0157, function lines
172-175). The Store's waiting card needs `status !== 'confirmed'` (dead) and the answered card uses
`differenceAcceptedAt || confirmedAt` (store.html:3297-3298).
Fix: waiting = `yardCheckedBy` ∧ a difference ∧ no `differenceAcceptedAt`; answered only on
`differenceAcceptedAt`; and push `trip.difference.seen` to the checker when accepted.
Session: **Store** (+ the push in its migration).

**IM-24 (H) A trip can be checked in twice, at two counts.**
Evidence: the console's "Check in N lines" (`confirmCollectionTrip`, index.html:58954, 59284) puts the
Buyer's `gotQty` on the shelf; the Store's `receive_trip` then returns "already" (0157 function line 46).
decision-rights: "The Store's yard count (`yardQty`) is what puts the goods on the shelf".
Impact: no yard count, no difference push, the shelf at the Buyer's figure.
Fix: the console shows trips read-only ("At the yard · Musa checks it in").
Session: **console**.

**IM-25 (M) Check-in or count-in.**
Evidence: GLOSSARY Check-in ("never a count"). Buyer: "at the yard · Musa counts it in", "Now waiting
for the Store to count it in", "counted it in" (buyer.html:3238, 3690, 4697, 4705); push `trip.back`
"A trip is back — count it in" (0120:287, 0147:50, 0150:73); Owner's task label "Count a trip at the
yard" (owner.html:3274).
Fix: "Musa checks it in", "Back · check it in", "Check in a trip at the yard".
Session: **Buyer**, **Owner**, **Store** (the push title, migration).

**IM-26 (L) "At the gate" means two things in the yard.**
Evidence: trips back ("At the gate" stage, "at the gate · check it in first": store.html:3473, 3479,
3551) and packed pickups ("At the gate · bay B": store.html:3091, 5707). Sales uses it for pickups.
Fix: trips are "Back at the yard" (already used at store.html:3078); "At the gate" is only goods
waiting for a collector.
Session: **Store**.

**IM-27 (M) Stage words differ.**
Evidence: Manager short "On road" (manager.html:1606), Owner "On road" (owner.html:3374); console
"Step 3. Being Prepared", "Step 4. Pending Delivery", "Step 5. Completed", lanes "Taken/Preparing/Out"
(index.html:44866-44872, 68991, 84788); agent "Packing" for Buying (agent.html:7834).
Fix: the five glossary words everywhere staff read; agent says "Buying · the shop is bringing some
items in".
Session: **Manager**, **Owner**, **console**, **agent**.

**IM-28 (M) Packed orders count as stuck.**
Evidence: Owner and Manager clock Packing from `stageEnteredAt` against the Packing limit
(owner.html:3377-3383; manager.html:1633-1641); a packed order waiting at the gate, for money or for the
truck is "stuck Packing".
Fix: stop the Packing clock at `pickingDoneAt`; show "Packed · waits for the truck / collector /
money" with its own clock.
Session: **Manager**, **Owner**.

**IM-29 (H) The Manager moves orders round the yard without telling it.**
Evidence: "Mark done" sets Delivered from any stage with no proof (manager.html:3470, 3501-3507); the
next-stage arrow moves Packing → On the road with no carrier (manager.html:3510-3520); neither pushes
the Store. decision-rights: `order.load`, `order.deliver` are the Store's.
Impact: an order vanishes from To pack or Load mid-pack; a delivery with no photo or carrier.
Fix: the Manager may move an order only back, or forward with a reason that is pushed to the yard
(`order.moved` to order.pick/order.load); Delivered asks "who delivered it".
Session: **Manager**.

**IM-30 (M) The yard's "why no photo" is never shown; Sales reads a key nobody writes.**
Evidence: the Store writes `deliveredPhotoKind`/`deliveredNote` ("the Manager sees it on the order",
store.html:2436, 2449-2451); no other app reads them. The Manager flags "no photo" from
`deliveredPhoto` alone (manager.html:2937). Old Sales shows "Photo by …" from `deliveredBy`
(sales.html:5994), which no app writes.
Fix: Manager and Sales show "No photo · client said no"; Sales names the deliverer from `carrier.name`.
Session: **Manager**, **Sales**.

**IM-31 (M) Counter sales count as yard collections.**
Evidence: `counter_sale` writes `completed` + `deliveredAt` (0136:103, 157-161); `counter` is not in
the allow-list (0164:179-182); the Store's tiles count it as "delivered · collected" with no collector
and list it under Returns (store.html:1507-1510, 3587, 6001).
Fix: pass `counter` through the allow-list; the Store leaves counter sales out of "delivered" and
shows them as "Counter" where it lists them.
Session: **Store** (migration + store.html).

**IM-32 (M) "Held for orders" is a different number in new Sales.**
Evidence: new Sales `heldOf` adds raw `qty` (src/core/supabase/rows.ts:226-233); the Store
(`shelfPackFor`, store.html:1599-1617), old Sales (`lineShelfUnits`, sales.html:4252-4271) and the
Buyer (`shelfPackFor`, buyer.html:1173-1191) convert a carton line to shelf units. The Buyer picks the
shelf row by id/outOfStock, the Store by `units`.
Impact: new Sales can sell what the yard holds for a carton order.
Fix: one `ow_on_shelf` rule; new Sales converts like the others (ideally the snapshot carries the
held figure).
Session: **Sales** (new).

**IM-33 (L) `deliveredAt` has two formats.**
Evidence: Store and Manager write an ISO string (store.html:2422, 2449; manager.html:3503); `counter_sale`
writes ms (0136:157).
Fix: one format (ISO) in `counter_sale`.
Session: **Sales** (counter_sale migration).

**IM-34 (L) "Handed you the yard".**
Evidence: `store.handover` title "… handed you the yard" (0157:139, 0159:347); GLOSSARY: "passed you
the yard" (already on its open list).
Session: **Store** (migration).

**IM-35 (L) The credit-ask pushes use other words than the yard.**
Evidence: "Not paid · let it go on credit?", body "… · cash customer" (0156:125-128); answers "On
credit · load it" / "Cash first · keep it" (0156:133-136). Store: "Not paid yet · let it go on
credit?", "Let it go on credit · load it" / "Keep it until it is paid" (store.html:3286-3288).
GLOSSARY: "Not paid yet", never "cash customer".
Session: **Store** (migration).

**IM-36 (M) A short trip line is packed at the full quantity.**
Evidence: `quoteLineShortfall` is defined and never used (store.html:1771); the pack sheet asks for
`qty` though only `receivedQty` came; Sales already says "Short · 6 of 10" (sales.html:5958).
Impact: the packer hunts for goods that never came, then packs short and rings the Manager for a
short pick that was known since check-in.
Fix: the pack line says "6 came of 10 · pack 6" and the short is pre-filled.
Session: **Store**.

**IM-37 (L) Short pick settled: the packer is not told.**
Evidence: pick.settle tells Sales (decision-rights row); the yard sees "Ruth settled …" only on
refresh (store.html:3291).
Fix: push `pick.settled` to the packer when it changes what goes on the truck ("Bill what went"
on an order not yet loaded).
Session: **Store** (migration).

**IM-38 (L) Dead code calls the Manager's decision.**
Evidence: `ACT.rtdecline` calls `decide_invoice_ask(..., 'declined')` (store.html:6099-6101); nothing
renders `data-act="rtdecline"`.
Fix: remove it; returns are decided by the Manager.
Session: **Store**.

**IM-39 (L) The cancel's own word for the yard.**
Evidence: Sales and Manager say "Cancelled"; the yard says "called off" (store.html:4329, push
"Called off · stop packing", 0177:212). GLOSSARY has "cancel" as an order's word.
Fix: pick one ("Cancelled · put it back") and add it to the glossary.
Session: **Store** + glossary.

---

## 4. Changes other apps need

### Sales (old `sales.html` and new `src/apps/sales`)
- IM-01/02: write `deliverTo` (place), `deliverWhen`, `deliverPhone` as separate keys through `place_order`; stop joining them into one string.
- IM-03: `readyToCollect` = Packing + packed + pickup + no money hold (src/core/orders.ts:138); old sales.html tell text and stamp the same.
- IM-04: data.ts:142 uses `readyToCollect`; name hired/client carriers from `carrier`.
- IM-05: show Packed / At the gate / Not paid yet in Packing (data.ts:141, view.ts; sales.html:5846, 6319, 6397).
- IM-06: "Collected 14:20 by {name}" for gate hand-overs (view.ts:82; sales.html:6323).
- IM-07: show "Not paid yet · at the gate" with Take payment for packed orders on a money hold; open the new push.
- IM-30: drop `deliveredBy`; name the deliverer from `carrier`; show the no-photo reason.
- IM-32: new `heldOf` converts to shelf units like the Store and old Sales.
- IM-33: `counter_sale` writes `deliveredAt` as ISO.

### Buyer (`buyer.html`)
- IM-25: "checks it in" / "Back · check it in" / "Checked in" (buyer.html:3238, 3690, 4697, 4705).

### Manager (`manager.html`)
- IM-12: a return asked before the invoice is settled as an order change, not refused.
- IM-13: default "Back on the shelf" per line from the Store's `condition`.
- IM-14: record `restocked` per line on the credit note.
- IM-15/16: one-write credit note; restock waits for the yard's check-in.
- IM-17: a "Not on the list" card answering `store_asks` kind `extra`; pushOpen case `store.extra`.
- IM-18: show the yard's close (`store.closed`).
- IM-20: pushOpen cases for the count pushes (and `stock_count` until it is retired).
- IM-22: "shelf", not "books", on the stock take.
- IM-27: "On the road", not "On road".
- IM-28: Packing clock stops at `pickingDoneAt`.
- IM-29: no forward stage move round the yard without a reason pushed to the yard; Delivered asks who.
- IM-30: show "No photo · {reason}" from `deliveredPhotoKind`/`deliveredNote`.

### Sourcing (`sourcing.html`)
- IM-19: a list of new items checked in at the yard (`store_asks` with `newItem`), and a push case for `store.new_item`.

### Owner (`owner.html`)
- IM-25: task label "Check in a trip at the yard" (owner.html:3274).
- IM-27: "On the road" (owner.html:3374).
- IM-28: stuck Packing stops at `pickingDoneAt` (owner.html:3383).

### Console (`index.html`)
- IM-24: no check-in from the console; trips read-only once collected.
- IM-27: the five glossary stage words in `SQ_STATUSES`, `OT_LANE_NAME`, the floor panel.
- IM-18: the yard's close in the day report.

### Agent (`agent.html`) and client (`client.html`)
- IM-03: "Ready · waiting at the shop for you" and the pickup row from Packing + packed + agent pickup, not `pending_delivery` (agent.html:6199, 7835-7846); client says nothing about "left the shop" for a pickup.
- IM-27: Buying is not "Packing" (agent.html:7834).

### Worker app (`worker.html`)
- IM-08: whichever rule the Store adopts for `awaiting_accept`, the worker app and the Store must agree on who may take an order given to someone.

### Store's own session (for completeness)
IM-01, 02, 03 (push), 07 (push), 08, 09, 10, 11, 14, 20, 21, 23, 26, 31, 34, 35, 36, 37, 38, 39.
Every database change above needs one migration: the next free number after 0181, added to the
table in `docs/decision-rights.md` in the same commit (it records the new pushes: `order.ready`,
`order.unpaid_at_gate`, the count pushes, `trip.difference.seen`, `pick.settled`), and the allow-list
additions (`deliverTo`, `deliverWhen`, `deliverPhone`, `counter`, `takenBack[].restocked`).
