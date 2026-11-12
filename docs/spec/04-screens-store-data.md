# 04 · Screens — Store: the data contract

What this covers: every read, write, server function, push and phone-only state in the current `store.html` (6,296 lines), so the new Store front end (`src/apps/store`, `src/core/store`) reads and writes the same database the same way; then what the new app changes (§6), the tasks it holds (§7), what `store.html` does that no board draws (§8), and the questions (§9).
Date: 2026-11-11
Status: **read from the code, not decided.** Every item gives its `store.html` line (commit `57ef55fa`; the file is unchanged since audit round 10, `1bb6698d`). The questions in §9 are for Kevin; until he answers, the new app does what the canvas draws, and where the canvas is silent, what `store.html` does today.

Read with: [`04-screens-store.md`](04-screens-store.md), [`04-screens-store-routes.md`](04-screens-store-routes.md), [`05-data.md`](05-data.md) (tables), [`06-offline-sync-push.md`](06-offline-sync-push.md), `docs/decision-rights.md`, `docs/audit/store/OTHER-APPS.md` ("The database"), `docs/canvas/store-agent/boards/IB01Handovers.dc.html` (every handover's push and words), `src/core/supabase/` (how Sales and the Buyer do it).

---

## 0. How store.html talks to the database

| What | How | Line |
|---|---|---|
| Client | `sb`, the shared Supabase client (production on the Vercel and Capacitor hosts, staging elsewhere) | head of file |
| **The yard reads no table but its own** | Everything the day needs comes from one server function, `store_snapshot` (0164, 0166, 0168), every money key stripped in the database (`ow_strip_money`, `ow_store_payload`). A failed snapshot is said on screen ("Could not load the yard"), **never filled from direct reads** (PRIV-03) | 1167–1177 |
| Direct reads left | Only tables that carry no money: `stock` (fallback when the snapshot has no folded stock), `places`, `place_routes`, `road_names`, `shop_members` (own row), `stock_counts` (one open count of a place; a retry check) | §1c |
| Paged read | `selectCols(table, cols, keyCol, extra)`: only the columns asked, `.eq('shop_id', shop)`, keyset paging 1,000 a page (`gt(key, last)`) | 1091–1106 |
| Row → object | `rowToTrip` 1106, `rowToQuote` 1111 (the payload spread over defaults), `rowToReport` 1117, `rowToReturn` 1124, `rowToCount` 1153, `rowToAsk` 1167 | |
| **Order writes** | always `changeOrder(id, fn, seen)`: re-read the one order (`store_order`), apply `fn` to the fresh copy, refuse if it moved since the phone showed it, then send **only the keys this tap changed** through `store_patch_order` with `p_expect` | 2307–2338 |
| The stage moves the Store may make | `STORE_STATUS_MOVES`: `preparing → pending_delivery \| completed`, `pending_delivery → completed`; anything else is refused on the phone ("that order has moved on") and in the database (0164, 0173, 0178) | 2291, 2324 |
| Old-database fallbacks | `needs0115(e)` (2293) retries without `p_expect`, without `missing`, or with `store_snapshot` when `store_live` is missing (`S.noLive`, 1179). **Drop them in the new app**: 0162, 0166 and 0159 are on every database | 2293, 2329, 2582, 2597 |
| Snapshot on the phone | IndexedDB `ow-store`, store `snap`, key `ow-store-snap2:<uid>` = `{shopId, shopName, role, at, data}`; written 1.2 s after the last change; drawn at boot **before** the login is checked | 1292–1345, 1956 |
| Realtime | **None.** No `channel()` and no `postgres_changes`; a 45 s refresh (§1d) | — |
| Errors | `failWord` (1009): a network error "No connection — nothing was changed"; a clash "Someone else just did this — refreshed"; a sentence the database says on purpose (P0001, 22023, P0002) as it is; else "That did not save · tell {owner} · code {mig}/{code}". `failSay` (2294) adds the money gate (`OWCSH` → "Not paid yet · …") and RLS (42501 → "Your login cannot do this one") | 1003–1015, 2294 |

### 0a. Phone-only state. The server never sees it.

| Key | Where | What it holds | Line | Note |
|---|---|---|---|---|
| `ow-store-bundle` | localStorage | the native live update's staged page | 140–235 | the old native layer; the new app uses `src/native` |
| `ow-app-insets` | localStorage | the safe-area insets last measured | 102–116 | |
| `ow-store-prefs` | localStorage | `{sound, buzz, big, push}` | 1022–1024 | Big text lives here |
| `ow-shop:<uid>` / `ow-shop-ask` | localStorage / sessionStorage | the shop last picked; "ask me again" | 1892–1905, 1937 | two shops only |
| `ow-store-view:<shop>` | sessionStorage | the screen stack, so a reload reopens it | 2033–2037 | NAV-09 |
| `ow-store-picks:<uid>:<shop>` | localStorage | pick drafts `{orderId: {lineKey: {s, n, cur}}}`, sent 900 ms after the last tap and on `online` | 2341–2366, 5936 | `lineKey` = `L<lineId>`, else `I<index>` (1535) |
| `ow-store-seen:<uid>:<shop>` | localStorage | when Alerts was last opened (the bell's count) | 3248–3249, 3361 | WORD-10 |
| `ow-store-rc:<uid>:<shop>` | localStorage | the check-in draft `{id, ids, got, why, extras, at}` | 3717–3721 | one draft per trip |
| `ow-store-putback:<uid>:<shop>` | localStorage | `{orderId: ms}`: a cancelled order put back | 4342–4347 | store.html's only record of a put-back; the new app writes `putBack` on the order instead (0182, Q11, W28) |
| `ow-store-sl:<id>:<shop>` | localStorage | the gate's name and ticks `{name, ticks}` | 4595–4597 | REL-02 |
| `ow-store-count:<uid>:<shop>` | localStorage | the count draft (keys, counts, system, held, missing, sent, sendErr) | 5293–5294 | resent on `online` (5432) |
| `ow-store-labels:<shop>` | localStorage | which shelf labels were printed | 5821–5854 | |
| `ow-store-doorret:<uid>:<shop>` | localStorage | what stayed on the truck at the door, to check in as a return | 6004–6007 | |
| IndexedDB `ow-store` / `outbox` | IndexedDB | a report or a return kept with its photo blob `{id, kind, at, shopId, …}` | 1299–1325 | goes on `online` and after each refresh |
| `ow-store-snap:<uid>` (legacy) | localStorage + IndexedDB | removed at boot (could hold money) | 1336–1339 | |

`shopScoped(base)` (1943) appends `:<shopId>` and moves an unscoped key over once. Signing out removes every `ow-*-snap:` key (1932).

---

## 1. Reads

### 1a. At boot (`boot` 1950)

| # | Source | What | Line |
|---|---|---|---|
| 1 | `auth.getSession()`, then `getUser()` | the login; a 401/403 or a login error signs out, a network error keeps the copy | 1956–1983 |
| 2 | `shop_members` | `select('shop_id, role, shops(name, created_at)').eq('user_id', uid)`, three tries with a session refresh. Roles let in: **`store`, `owner`, `admin`, `manager`, `staff`** | 1868–1880, 2007 |
| 3 | the snapshot copy (IndexedDB) | drawn at once when there is one ("Offline — showing what you last saw") | 1956–1999 |
| 4 | `rpc('store_snapshot', {p_shop})` | the day (§1b) | 1172, 1198 |
| 5 | `stock` | `key,product_id,variant_idx,qty`, only when the snapshot did not fold the stock in | 1197–1201 |
| 6 | after the first paint: `places` (`name,lat,lng`), `place_routes` (`from_place,to_place,km,mins,line,locked_at`), `road_names` (`way_key,name`) | at most every 10 minutes (`loadSide`) | 1205–1218 |

### 1b. What the snapshot holds (`applyFresh` 1220)

Every key is the server's (`store_snapshot`, 0164 / 0166 / 0168); `store_live` is the same less what rarely changes (products, units, customers, agents, suppliers, presets).

| Key | Kept as | Fields the app uses |
|---|---|---|
| `orders` | `savedQuotes` (`rowToQuote`) | columns `id, status, invoiced, invoiced_ts, voided, date, client_name, client_phone`; the payload through the allow-list (§2) |
| `trips` | `collectionTrips` | `id, supplier_id, status, assigned_worker_id, created_at, assigned_at, accepted_at, collected_at, confirmed_at, note, lines, voided, yard_checked_at, yard_checked_by, yard_received_at, difference_accepted_at` |
| `products` | `products` | `id, name, category, image, variants` |
| `units` | `units` | `product_id, variant_idx, unit, pack_unit, pack_qty, pieces_per_unit` (a price row's units, no price) |
| `stock` | `stock` | `{key: qty}` (folded, 0166) |
| `log` | `stockLog` | stock history 28 days (the item's four weeks; type, delta, at, note) |
| `counted` | `lastCounted` | `{key: when last counted}` |
| `counts`, `reports`, `returns`, `asks` | as named | `stock_counts`, `stock_reports`, `invoice_asks` (the yard's returns), `store_asks`; each `null` when the table is missing |
| `staff` | `staff` | `id, name, phone, role, unavailable, user_id` |
| `customers` | `customers` | `id, name, phone, location` (no balance) |
| `agents` | `agents` | `id, name, terms` (`before` / `on_delivery`) |
| `suppliers` | `suppliers` | `id, name, location` |
| `holds` | `moneyHolds` | `{orderId: {decision}}` (`store_money_holds`, 0156/0164) |
| `managers` | `managerIds`, `buyerIds`, `sourcingIds` | user ids by role |
| `members` | `members` | `user_id, name, role` (0168) |
| `me` | `me` | `name, staff_id` |
| `presets` | `categories`, `locations`, `shopPlace`, `bays` | an allow-list of settings; `bays` 1–12, default 4 |

### 1c. One-row reads

| When | Read | Line |
|---|---|---|
| Before every order write | `rpc('store_order', {p_shop, p_id})` | 2309 |
| After a clash (`OWSTALE`) | `store_order` again, kept over the copy | 2306, 2331 |
| A count refused as a second one for its place (23505) | `stock_counts` `select('*').eq('status','sent').eq('place', place).limit(1)`, then replace it (§3, W20) | 2585–2587 |
| A count resent after a dropped signal | `stock_counts` `select('id').eq('counted_by', me).eq('aisle', aisle).gte('created_at', draft.at)` — did it arrive? | 5421 |

### 1d. Refresh

| When | What runs | Line |
|---|---|---|
| Every 45 s while visible and not dragging a slide | `refreshLive`: `rpc('store_live')` (0166), replacing orders, trips, holds, asks, counts, reports, returns, members, me and the stock; then `flushOutbox` | 1262–1286, 2045 |
| Visible again after 30 s away | `loadAll` (the whole snapshot) | 2047 |
| After a check-in | `refreshLive` | 2479 |
| A push tapped | `refreshLive`, then `pushOpen(data)` (§5b) | 2662–2663 |
| Every 30 s | redraw only (the clocks) | 2046 |
| `online` | the outbox, the pick drafts, a kept count | 1324, 5432, 5936 |

---

## 2. The order fields the Store reads and writes

`ow_store_payload` (0164) is the allow-list of what reaches a Store phone; `store_patch_order` (0164) the list of what it may write.

| Field | R / W | Meaning | Line |
|---|---|---|---|
| `status` (column) | R / W | `draft` Look only · `awaiting_goods` Waiting on goods · `preparing` To pack / Packing now / Packed · `pending_delivery` On the road (and Ready to collect, §6) · `completed` Delivered · `cancelled` | 1745 |
| `invoiced`, `invoiced_ts`, `voided` (columns) | R | off the board 24 h after the invoice | 1751 |
| `client_name`, `client_phone` (columns) | R | the collector's name and phone prefilled; "Walk-in" | 1753 |
| `items[]` | R; W `pickStatus`, `pickedQty` only | line keys `lineId, productId, productName, variantIdx, qty, unit, packQty, packUnit, supplierId, clientWaits, pickStatus, pickedQty, receivedAt, receivedQty, qtyIn` | 2327 |
| `assignedWorkerId`, `pickingAssignedAt`, `workerAcceptedAt`, `pickingStatus` (`in_progress` / `done`), `pickCursor`, `pickingDoneAt` | R / W | the claim and the pack | 2368–2398 |
| `bay` | R / W | 1–N | 2384, 4321 |
| `carrier` `{kind: staff \| hired \| client \| agent, name, what, phone, at, by, staffId?}`, `assignedDeliveryId` (staff id, `__carrier__`, `__agent__`, `__client__`) | R / W | who takes it | 2400–2405 |
| `stageEnteredAt`, `stageLog[]` `{status, at}` | R / W | written on every move (`setSavedQuoteStatus`) | 1754–1765 |
| `deliveredTo`, `deliveredAt` (ISO), `deliveredPhoto` (a storage path), `deliveredPhotoKind` (`note` / `none`; missing = at the door), `deliveredNote` (why no photo), `handoverCheckedAt` | R / W | the proof | 2416–2454 |
| `letGoAsk` `{at, by, byName, carrier, answer?}` | R / W | the Store's ask to let an unpaid order go on credit; the books keep it as `creditAsk` | 4797, 4805 |
| `letGo` `{decision, at}`, `agentSettled` | R | the Manager's answer (`creditCheck`), whether an agent paid | 4672 |
| `deliveryMode`, `deliveryAddress`, `customerId`, `originAgentId` | R | where it goes (today: the customer's location, §6 changes it) | 1515–1527 |
| `cancelledAt`, `cancelledByName`, `voidedAt` | R | called off | 4065, 4326 |
| `pickSettle` `{pick, at, lines[{idx, picked, ordered}]}`, `pickShortfallAckAt` | R | Ruth settled a short | 1540, 1549 |
| `takenBack[]` `{askId, voided, lines[{idx, qty}]}` | R | credit notes (the books' `creditNotes`) | 1128–1136 |
| `droppedLines[]` `{productId, productName, variantIdx, qty, unit, reason, droppedAt}` | R (0182) | a line Sales, the Manager or the Buyer took off: it leaves `items[]` for here (`dropLine`, `src/core/buyer/supabase/order.ts`); never its price. The yard draws it struck through after the order's own lines; it never writes it | — |
| `putBack` `{at, by, byName, lines[{idx, qty}]}` | R / W once (0182) | a called-off order's goods back on the shelf (W28) | — |
| `runDriver` | R | a driver planned for the run | 2852 |
| `takenBy`, `createdAt`, `savedAt`, `date` | R | age, backdated | 1477–1485 |

`ORDER_KEYS` (2289), the only payload keys the app compares and sends: `items, assignedWorkerId, assignedDeliveryId, pickingStatus, pickCursor, pickingAssignedAt, workerAcceptedAt, pickingDoneAt, bay, carrier, stageEnteredAt, stageLog, deliveredTo, deliveredAt, deliveredPhoto, deliveredPhotoKind, deliveredNote, handoverCheckedAt, letGoAsk`. A key set to `undefined` is sent as `null`, which the server deletes.

---

## 3. Writes, in the yard's flow order

"Patch" = `changeOrder` → `rpc('store_patch_order', {p_shop, p_id, p_patch, p_status, p_items, p_expect})`; `p_status` only when the status changed, `p_items` = every line as `{idx, lineId, pickStatus, pickedQty}`. "Held" = `heldWrite` (991): 10 s with Undo, at once when the app is hidden. The push column is what the database raises today (0120 onward); §6 lists what 0182 adds.

| # | Action | Call and what changes | Push today | Line |
|---|---|---|---|---|
| W1 | **Claim** (the first Packed) | patch `assignedWorkerId` (my staff id), `pickingAssignedAt` (kept if set), `workerAcceptedAt`, `pickingStatus: in_progress`, `pickCursor`; each unanswered line `pickStatus: pending`. Refused when someone else has it in progress | none | 4079–4087, 2368–2381 |
| W2 | **Packed / Pack short** (a line) | the draft first (`setPick`), sent 900 ms later (`flushPicks`): the line's `pickStatus` `done` (`pickedQty = qty`) or `short` (`pickedQty`), `pickCursor`. Only in `preparing` | `pick.short` to `pick.settle` (Manager) on a short (0120) | 2344–2366, 4202 |
| W3 | **Finish the pack** (the last line) | held 10 s; flushes the picks, then patch `pickingStatus: done`, `pickingDoneAt`, `bay`. Refused until every line is answered | none (§6: `order.packed`, `order.ready`, `order.unpaid_at_gate`) | 2384–2392, 4213–4221 |
| W4 | Change the bay | patch `bay` | none | 4319–4321 |
| W5 | **Unpack** | patch `pickingStatus: in_progress`, `pickingDoneAt: null`, `bay: null`; only packed, in the yard, no carrier | none | 2396–2397, 4301–4317 |
| W6 | Release (let go) | flush or drop the picks; patch delete `assignedWorkerId`, `workerAcceptedAt`, `pickingAssignedAt`, `pickingStatus`; with "put back" also every line's `pickStatus`, `pickedQty` and `pickCursor: 0` | none | 4089–4098, 4228–4238 |
| W7 | **Put back a cancelled order** | store.html: **nothing is written**, `ow-store-putback` on the phone (Q11). The new app: W28 (§6c) | — | 4343–4347 |
| W8 | **Load** (a run, or a driver at the slip) | held 10 s; per order: patch `carrier`, `assignedDeliveryId`, `pickingStatus: done`, `pickingDoneAt`, status `pending_delivery` (+ `stageEnteredAt`, `stageLog`). The money gate (0156, `saved_quotes_ow_money_gate`) refuses an unpaid cash order (`OWCSH`) | none (§6: `order.out`) | 2400–2413, 4537–4560 |
| W8a | Send the drop to a hired driver | WhatsApp opens with the list (`driverMessage`); nothing is written | — | 4563–4580 |
| W9 | **Hand over at the gate** (client, or agent by code) | held 10 s; patch (via W8 first if still `preparing`) `handoverCheckedAt`, `deliveredTo` (the name, ≤ 80), `deliveredAt`, status `completed` | `order.delivered` to `invoice.make` (0120); it invoices itself 24 h after (0119) | 2416–2425, 4698–4715, 5095–5105 |
| W10 | **Deliver at the door** | upload the photo (`delivery-photos`, `<shop>/<agentId \| shop>/<id>-<uuid>.jpg`, JPEG ≤ 1280 px, 0.82); patch `deliveredTo`, `deliveredAt`, `deliveredPhoto`, `deliveredPhotoKind` (`note` for a signed note; `none` with `deliveredNote` when there is no photo), status `completed`. Only from `pending_delivery` | `order.delivered` | 2427–2454, 5000–5015 |
| W10a | What stayed on the truck | kept on the phone (`ow-store-doorret`); Today's "Check #…'s return" sends it as W18 | — | 4932–4937, 6004–6008 |
| W11 | **Ask Ruth to let it go on credit** (a customer with a record only) | patch `letGoAsk {at, by, byName, carrier}` (the server stores `creditAsk`) | `credit.ask` to `credit.release` (0156) | 4795–4813 |
| W11a | Take the ask back | patch `letGoAsk: null` | none | 4796–4798 |
| W12 | Name a direction | `road_names` upsert `{shop_id, way_key, name ≤ 40}`, on conflict `shop_id,way_key` | none | 2541–2547, 4835 |
| W13 | Lock a road route | `fetch` router.project-osrm.org; `place_routes` insert `{shop_id, from_place, to_place, km, mins, line}` (a duplicate is fine) | none | 2614–2633 |
| W14 | **Check in a trip** (each stop of it) | held 10 s; per stop not yet received: `rpc('receive_trip', {p_shop, p_trip, p_lines: [{shop: counted, pack: shelfPackFor(line), why?}]})`. One call puts it on the shelf, moves orders all in from Buying to Packing, and carries a difference for the Manager (0124, 0157) | `trip.difference` to the Manager (0120) | 2457–2481, 3987–4013 |
| W15 | Not on the list / a new item | `store_asks` insert, one row each: `kind: 'extra', ref: tripId, asked_by, asked_by_name, payload {tripId, supplierId, key, productId, variantIdx, name, qty, unit, why, newItem?, photo?}`. Also what was "sent by mistake" over the bought count | `store.extra` (Manager, `trip.difference`); `store.new_item` (Sourcing, `product.edit`, 0159) | 2485–2491, 3995–4008 |
| W16 | **We need more** | held 10 s; `store_asks` insert `kind: 'restock', ref: key, payload {key, productId, variantIdx, name, qty, unit (the pack), when: 'out' \| 'low', shortFor: [orderIds]}` | `store.restock` (Buyer, `buy.restock`, 0157) | 2495–2501, 5632–5636 |
| W17 | **Report a loss** | held 10 s; photo to `delivery-photos/<shop>/reports/<uuid>.jpg`; `stock_reports` insert `{shop_id, key, product_id, variant_idx (text), name, qty, why: damaged \| lost \| stolen, photo_path, note, reported_by, reported_by_name}`. No signal: the outbox | `stock.report` (Manager, `stock.writeoff`) | 2504–2522, 5569–5583 |
| W18 | **A return at the gate** | held 10 s; photo to `.../returns/`; `rpc('store_return_ask', {p_shop, p_order, p_lines: [{idx, name, unit, qty, shown, condition: good \| damaged}], p_reason, p_note})` — the database prices it from the order (0159), caps it at what the line has left (0160), keeps the line's unit (0161). The photo path rides in the note. No signal: the outbox | `invoice.ask` (Manager) | 2528–2539, 6102–6118 |
| W18a | Take a return back | `rpc('withdraw_invoice_ask', {p_id})` (the asker's own) | none | 6088–6098 |
| W18b | Decline a return (manager logins only, `canCorrect`) | `rpc('decide_invoice_ask', {p_id, p_status: 'declined'})` | the answer to the asker | 6099–6101 |
| W19 | **Ride a trip**: tick a line onto the truck | `rpc('store_patch_trip', {p_shop, p_id, p_got: {lineIdx: qty \| null}, p_status: 'collecting'})` — the trip must still be this phone's; only `gotQty` and the status (0159) | none | 2552–2570, 6170–6177 |
| W19a | Hand in the ride | `store_patch_trip` `p_got: {}`, `p_status: 'collected'`, each stop; refused until every line is answered | `trip.back` to the yard (`stock.receive`) and `trip.cash` to Accounts, once per trip (0147) | 2571–2575, 6180–6185 |
| W20 | **Send a count** (spot or aisle) | held 10 s; `stock_counts` insert `{shop_id, aisle, counted_by, counted_by_name, lines: [{key, productId, variantIdx, name, counted, system, held}], missing?: [{key, productId, variantIdx, name}]}`. `aisle` is "Spot count · <name>" or "Aisle C · Fasteners"; the database sets `place` (0161). A second open count of the place (23505) → W20a | edge function `notify-stock-count` (a Database Webhook) "Stock take done" to owner, admin and manager logins | 2579–2592, 5414–5431 |
| W20a | Count it again (replace the waiting one) | `rpc('store_count_replace', {p_shop, p_old, p_aisle, p_lines, p_missing, p_name})` → `{replaced, old_status}`; anyone who counts may replace | as W20 | 2595–2603 |
| W21 | Accept / ask a recount (manager logins only) | held 10 s for accept; `rpc('accept_stock_count' \| 'ask_recount', {p_id})`; accept returns the stock after it (0142) | the answer to the counter | 2605–2612, 5911–5917 |
| W22 | **Pass the yard** | `store_asks` insert `kind: 'handover', ref: to.userId \|\| to.id, payload {toStaffId, toUserId, toName, orders: [ids], waiting, bays: [ids]}`; then per half-packed order a patch `assignedWorkerId: to.id`. **Not held** (Q17) | `store.handover` to that colleague (0157) | 6223–6235 |
| W22a | **I've got it** (the colleague) | `rpc('answer_store_ask', {p_id, p_status: 'accepted', p_note: null})` | `store.ask.decided` to the asker | 6245–6248 |
| W23 | **Close the yard** | held 10 s; `store_asks` insert `kind: 'close', ref: today (ISO), payload {out, trips, carries, shelved: [returnIds]}` | `store.closed` to the Manager (a log line) | 6282–6285 |
| W24 | My name | `rpc('set_my_name', {p_shop, p_name})` | none | 3184 |
| W25 | Alerts on | Capacitor `PushNotifications.register()`; `push_subscriptions` upsert `{shop_id, staff_id, user_id, fcm_token}` on conflict `fcm_token`. Needs a staff row and an install from build 2 | none | 2647–2664 |
| W26 | Sign in / out, reset | `signInWithPassword`, `resetPasswordForEmail` (redirect `/store.html`), `updateUser({password})`, `signOut` | — | 1832, 1842, 1858, 5927 |

### 3a. Storage

One bucket, `delivery-photos`, upload only (`contentType: image/jpeg`): door photos (2443), report and return photos (`uploadPhoto` 2504, folders `reports`, `returns`). The phone never reads a photo back from the bucket (the item and door thumbnails are the local blob).

---

## 4. Rules store.html works out (port once, into `src/core/store/`)

The screen rules are in `04-screens-store.md` §4, each with its line. The data rules the books depend on, port exactly:

| Function | Line | The rule |
|---|---|---|
| `stockKey` | 1700 | `productId`, or `productId::variantIdx` |
| `shelfPackFor` | 2464 | How many of the shelf's unit one of the line's is: the line's `packQty` when it is counted in the shelf's pack unit, else the unit row's `pack_qty`, else 1 (index.html `stockMoveOnRowUnit`) |
| `lineTakesShelf` / `orderHoldsShelf` | 1596 / 1597 | A line takes the shelf when it is ours (`__stock__`) or bought in and received; an order holds the shelf past Checking until invoiced, voided or cancelled |
| `heldForOrders` / `heldGone` / `stockItems` | 1617 / 1623 / 1637 | On the shelf = books − what has left for orders not invoiced (packed, out, delivered; a short at what was picked, unless settled as the full quantity); free to sell = books − held; never below 0 (`ow_held_gone`, 0142, the same rule) |
| `countsIntoLastCounted` | 1151 | An accepted count is the item counted, even when it matched (no stock log row, 0142) |
| `countPlace` | 1158 | `aisle:<category name>` for an aisle count, `item:<key>` for a spot count (as `ow_count_place`) |
| `tripRoundKey` / `roundsOf` | 1569 / 1570 | Trips with the same id stem (`TRIP-<stamp>-n`) and runner are one trip (`ow_trip_round`, 0147) |
| `tripLineGot` / `tripShortLines` | 1780 / 1782 | `gotQty` null = not answered; 0 is an answer; short = answered and under `qty` |
| `rcShareOf` | 3767 | A carton for one pack: the order takes its line's need, the rest goes to the shelf; an order out the gate or voided takes nothing |
| `quoteLinePack` / `lineQty` | 1702 / 1145 | Whole packs then the line's unit; `qtyIn: 'unit'` never shows packs |
| `moneyHold` / `loadAskOf` | 1502 / 1505 | Held only while in Packing today (§6 widens it to Ready to collect); an ask is open while it has `at` and no `answer` |
| `seenOf` / `seenDiffers` | 2301 / 2302 | `{status, pickingStatus, pickingDoneAt, carrierAt}`, compared as strings |

---

## 5. Pushes today

### 5a. The Store's writes raise

| Store action | Push kind | To (task) | Source |
|---|---|---|---|
| A short pick (W2) | `pick.short` | Manager (`pick.settle`) | 0120 |
| Handed over, delivered (W9, W10) | `order.delivered` | Manager (`invoice.make`) | 0120 |
| Check-in that differs (W14) | `trip.difference` | Manager | 0120, 0122 |
| Not on the list (W15) | `store.extra` | Manager (`trip.difference`) | 0157 |
| A new item (W15) | `store.new_item` | Sourcing (`product.edit`) | 0159 |
| We need more (W16) | `store.restock` | Buyer (`buy.restock`) | 0157 |
| Pass the yard (W22) | `store.handover` "… handed you the yard" | the colleague | 0157 |
| Close the yard (W23) | `store.closed` | Manager | 0157 |
| Let it go on credit (W11) | `credit.ask` | Manager (`credit.release`) | 0156 |
| A return (W18) | `invoice.ask` | Manager | 0123 |
| A loss (W17) | `stock.report` | Manager (`stock.writeoff`) | 0124 |
| A count (W20) | `notify-stock-count` (data `stock_count`) | owner, admin, manager logins | edge function |
| Hand in a ride (W19a) | `trip.back`, `trip.cash` | the yard (`stock.receive`), Accounts | 0147 |

### 5b. The Store opens (`pushOpen` 2666)

| Kind | Opens | Line |
|---|---|---|
| (no kind, `orderId`; `notify-worker`) | Pack if already yours, else Today; Load or Deliver if it moved on. **A tap never takes an order** | 2695–2702 |
| `trip.back` | that trip's check-in, else In | 2672–2675 |
| `trip.sent` | the ride | 2677 |
| `trip.taken`, `trip.cancelled` | Today | 2678 |
| `credit.ask.decided` | the gate slip (a pickup), else Load | 2680 |
| `job.given` | Deliver once on the road with this person, else Load | 2682–2683 |
| `store.handover` | Today (the "I've got it" card) | 2685 |
| `store.ask.decided` | the item (a restock), else With Ruth | 2686–2687 |
| `stock.report.decided` | the item | 2689–2693 |
| `stock_count` | `decide` (the manager logins' count page) | 2670 |
| `order.cancelled` | **no handler** (Today shows the put-back job anyway) | — |

The new app's map, kind by kind, is `04-screens-store-routes.md` §5.

---

## 6. What the new app changes

The database change is **one migration, 0182** (`supabase/migrations/0182_store_new_app.sql`, being written in the Store's build session; its row goes in `docs/decision-rights.md`'s reserved numbers in the same commit). It is the list in `docs/audit/store/OTHER-APPS.md` "The database", in the kinds and words of `IB01Handovers.dc.html`, plus two gaps the area builders found (11 Nov 2026): a dropped line reaches the yard (`droppedLines`) and a put-back is recorded on the order (W28). Every push is after the write and never stops it. Touches no money and no stock; no role, task or decision right changes.

### 6a. One decision: a packed pickup is Ready to collect

A packed pickup moves **Packing → On the road** (`pending_delivery`) with no carrier the moment it is packed (W3 sends `p_status: 'pending_delivery'` with `pickingStatus: 'done'` for a pickup), and the gate's hand-over (carrier client or agent) moves it on to Delivered (W9 from `pending_delivery`, already allowed). Sales (`src/core/orders.ts` `readyToCollect`) and the agent app already read that state. An order On the road with no carrier is Ready to collect only once it is packed (`ow_ready_to_collect`: `pending_delivery`, no carrier, `pickingStatus` done); one moved there unpacked is judged as loaded, money gate and all.

**The money gate moves to where the goods leave**: a delivery when it is loaded (as before), a pickup when it is handed over (or given a carrier). So "Ready to collect · Not paid yet · leaves when paid" (OU13) waits at the gate, and `store_money_holds` / `store_live` list a ready-to-collect order too. On the phone, `moneyHold` (1502) is no longer only `preparing`: it holds a ready-to-collect order as well (Q12).

### 6b. The allow-list

| Change | Where | For |
|---|---|---|
| `ow_store_payload` passes `deliverTo`, `deliverWhen`, `deliverPhone` | top keys | the pack card, To load and the drive read the order's own place, time and phone (IM-01, IM-02). The new app reads these and **never** the customer's `location` for an order that has them; an old order with none falls back as `orderDestination` (1521) does |
| … passes `counter` | top key | a counter sale is never a yard collection ("Counter sale · out", IM-31) |
| … passes `comingBack` `{why, at, by, byName}` | top key | "Coming back · Ggaba closed" (OU24) |
| … passes `takenBack[].restocked` (and a line's own) | each credit note | "Ruth took it back · 2 bag to damaged" / "Back on the shelf" (IM-14) |
| `store_patch_order` takes `comingBack` | `allowed` | OU24's slide writes it (W27 below) |
| … passes `droppedLines` (no `sellPrice`, `agentSellPrice`, `by`) | top key | a dropped line shows dropped on the real books ("Hinge · dropped · nobody has it"); the yard never writes it |
| … passes `putBack`; `store_patch_order` takes it on a **cancelled or voided** order only, its one write there | top key; its own branch | W28 below |

### 6c. New writes in the new app

| # | Action | Call | Push (0182) | Board |
|---|---|---|---|---|
| W3' | Finish the pack of a pickup | W3 with `p_status: 'pending_delivery'` | `order.ready` | PK07 |
| W27 | **Can't deliver · bring it back** | patch `comingBack {why, at, by, byName}` (stays On the road) | `order.back` | OU24 |
| W28 | **Put back** a cancelled order (PK10's red slide; OU27 bring it back) | `store_patch_order(p_patch: {putBack: {lines: [{idx, qty}]}})`, no `p_status`, `p_items` or `p_expect`. The server stamps `payload.putBack {at, by, byName, lines}` once (its own time and person; a second put-back keeps the first), on a cancelled or voided order only. **No stock line**: goods come off the books at the invoice (0119), so a cancelled order's never left them (0177) and a voided invoice's come back by the Manager's restock (0176); writing one would count them twice. Every phone then leaves it off the yard's day (`rows.ts`) | none (IB01 draws none) | PK10, OU27 |
| W22' | Pass the yard | W22, now held 10 s with Undo ("Take it back 10 s") | as W22 | TD14 |
| — | Accept / recount (W21), decline a return (W18b) | **not in the Store app** (IM-20/21): Ruth's, in her own app | — | — |

### 6d. The pushes (IB01's kinds and words)

"New" = the kind did not exist; "words" = the kind existed, its words change. To whom: "the yard" is whoever holds `order.pick` (the Store and a yard worker); "Ruth" is the task the Manager holds; the owner holds no `role_tasks` row, so he gets none (his is the log).

| Kind | When | To | Words | IB01 board | 0182 |
|---|---|---|---|---|---|
| `order.pick` | an order enters Packing (placed there, all in, or moved on), **on insert too** | the yard | "New to pack · #0556 Nansana · they collect" | PK01 (IM-09, IM-10) | new |
| `order.pick` | given to a packer (`awaiting_accept`) | that packer only | "Ruth gave you #0556 to pack" | PK08 (IM-08) | new |
| `order.copy` | an order marked a copy | the yard | "#0557 is a copy · don't pack it" | PK09 | **not in 0182**: no app marks an order a copy yet |
| `order.cancelled` | to whoever holds it | packer, bay, driver, the salesperson | "Cancelled · put it back · #0530"; on a truck "#0534 cancelled · bring it back" | PK10, OU27 (IM-11, IM-39) | widened |
| `trip.back` | a trip handed in | the yard | "Denis's trip is back at the yard · 3 lines" (never "round", "count it in", "at the gate") | IN02, TD02 (IM-25, IM-26) | words |
| `trip.checked` | checked in | the Buyer (`trip.plan`) | "Checked in · Denis's trip · 3 lines" | IN06 | new |
| `trip.difference` | the check-in differs | Ruth | "Musa's check-in of Denis's trip · 2 pc differ" | IN03, IN06 (IM-23) | words |
| `trip.difference.decided` | Ruth decides | the checker | "Ruth decided the 2 pc" | IN06, TD11 | new |
| `order.all_in` | Buying → Packing from the check-in | the salesperson (with `order.pick` "New to pack · #0549 Ggaba" to the yard) | "Ggaba's #0549 is all in · Packing" | IN06 | new |
| `trip.short` | a trip line came short | the salesperson | "#0546 Lubowa · 18 of 20 came · pack 18" | IN06 (IM-36) | **not in 0182** (the check-in's words; the Buyer's 0144 kind stays) |
| `store.extra` / `store.ask.decided` | not on the list; Ruth answers | Ruth; then the checker, the Buyer, and Accounts when kept | "Not on the list · Binding wire 20kg · keep it?" → "Ruth: keep it" (Esther pays Kiseka for it) | IN04, IN13 (IM-17) | words |
| `store.new_item` | a new item checked in | Sourcing | "A new item at the yard · with a photo" | IN04, SH42 (IM-19) | kept |
| `delivery.checked` (+ `stock.report`) | a supplier's delivery checked in | Sourcing (`supplier.edit`); Accounts (`bill.record`, the delivery note); torn ones as `stock.report` to Ruth | "Hima Cement · 100 bag came in"; "Hima Cement · 4 torn" | IN10–IN12 | new |
| `store.restock` / `store.ask.decided` | we need more; Denis answers | the Buyer; then the asker | "We need more · Gloss paint · about 10 tin" → "On the restock list · next trip" | SH30–SH32 | words |
| `trip.sent` (+ `trip.taken`, `trip.cancelled`), `trip.back` | Denis sends a storekeeper; the hand-in | the rider; then the yard (Okello checks it in) | "Denis sent you · Katwe Timber · 1 line" | TD03, IN30, IN32 | kept |
| `pick.short` | a line packed short | Ruth **and the salesperson** | "#0552 · 1 short · Ruth settles" | PK04, PK05 (IM-37) | widened |
| `pick.settled` | Ruth settles | the packer and the salesperson | "Ruth settled #0552's short" | PK05 (IM-37) | new |
| `order.packed` | packed, we deliver | the salesperson | "Kato's #0552 is packed · bay 1" | PK06 (IM-05, IM-28) | new |
| `order.unpaid_at_gate` (+ `credit.ask`) | packed with a money hold | the salesperson; `credit.ask` to Ruth (`credit.release`) | "Kato's #0552 is packed · take the money"; "Not paid yet · let it go on credit?" (never "cash customer") | PK06, OU01, OU13 (IM-07, IM-35) | new; words |
| `order.ready` | Ready to collect | the salesperson (the agent and a walk-in customer: not yet, below) | "#0554 ready to collect · at the gate · code 0554" | PK07, OU10 (IM-03, IM-04) | new |
| `order.out` | loaded | the salesperson | "#0552 on the road · Ssali"; hired "#0552 on the road · Abudu (hired)" | OU02, OU03, OU05 (IM-04, IM-27) | new |
| `order.delivered` | collected or delivered | Ruth (`invoice.make`) **and the salesperson** | "#0555 collected 10:47"; "#0554 collected · Peter"; "#0552 delivered 14:05"; "#0552 delivered · no photo" with the reason | OU10–OU12, OU21–OU23 (IM-06, IM-30) | widened |
| `order.invoiced` | 24 h after delivery | Accounts, the salesperson | "the bill by itself after 24 h" | OU22 | kept |
| `order.back` | can't deliver (W27) | Ruth (`order.assign`) and the salesperson | "#0547 coming back · Ggaba closed" | OU24 | new |
| `order.moved` | a stage the yard holds moved by someone outside the yard | the yard | "Ruth marked #0538 delivered" | TD10 (IM-29) | new |
| `stock.count.sent` | a count sent | **Ruth only** (`stock.correct`); the owner gets the log | "Your count of Wire nails 4" · 17 ctn" (0182 writes "Musa's count of …" for Ruth) | SH10, SH12 (IM-20) | new (replaces `notify-stock-count`) |
| `stock.count.decided` / `stock.recount` | Ruth decides | the counter | "Ruth accepted your count" / "Ruth asked: count it again" | SH13, SH16 (IM-20) | new |
| `stock.report` / `stock.report.decided` | a loss; Ruth decides | Ruth; then the reporter | "Iron sheet G28 · 3 pc bent · photo" → "Ruth wrote off 3 pc · bent" | SH20–SH22 | kept |
| `return.coming` | Sales asks a return | the yard | "#0548 coming back · 2 bag" | IN01, TD11 (IM-15) | new |
| `invoice.ask` / `invoice.ask.decided` | the return at the gate; Ruth decides | Ruth; then the yard and the salesperson | "#0548 · 2 bag damaged · photo"; "Ruth took it back · 2 bag" | IN20–IN22 (IM-12–IM-14) | words; widened |
| `store.handover` / `store.ask.decided` | pass the yard; "I've got it" | the colleague; then the asker | "Musa passed you the yard" → "Okello has it" | TD13–TD15 (IM-34) | words |
| `store.closed` | close the yard | Ruth (a log line, nothing to answer) | "The yard is closed" | TD16, TD17 (IM-18) | kept |

No push, on purpose (nobody waits): a counter sale (read live, "Counter sale · out") and the shelf figure (both apps read "412 on shelf").

**Not reached by 0182** (IB01 draws them; no channel yet): a push to the agent (Peter) or the customer (Kato) — `push_outbox` reaches shop members only, agents have their own phones' table. The boards' "Peter sees", "Kato sees" lines stay as drawn (what they see in their own app), not as a push the Store sends.

**Turn off with the switch**: the Database Webhooks for `notify-worker` and `notify-stock-count` still send their old pushes; they go off when the new app replaces `store.html` (the owner would otherwise still get counts).

### 6e. Words the Store itself changes (IB02's six cells)

| State | Old Store word | New Store word |
|---|---|---|
| To pack | To pack | To pack (and "Packing · nobody has it" in other apps) |
| Given to a packer | — | For you · Ruth's pick |
| Packed · we deliver | packed | Packed · Bay 1 |
| Ready to collect | At the gate · bay B | Ready to collect · Gate |
| Coming back | no such job | Coming back · bring it back |
| Cancelled | called off · packer only | Cancelled · put it back / Cancelled · bring it back |

Plus STORE-TODAY §4.4's leftovers: the ride's "morning round" and "Round handed in" (6142, 6152) → "trip"; Load's done "Handing over…" → "Loading…" ("Hand over" is the gate's); "Store lead" stays only as Musa's role line on You (TD12); "On the road", never "On the way".

---

## 7. The tasks the Store holds (`docs/decision-rights.md`)

| Task | Store | What it lets the yard do | Server check |
|---|---|---|---|
| `order.pick` | does | claim, pack, short, unpack, put back (W1–W7) | `store_patch_order` (0164) |
| `order.load` | does | load, choose the driver (W8) | stage rule (0173, 0178); money gate (0156) |
| `order.deliver` | does | hand over, deliver with proof (W9, W10, W27) | as above |
| `route.lock` | does | name a direction, lock a route (W12, W13) | — |
| `trip.checkin`, `stock.receive` | does | check in a trip or a delivery (W14, W15) | `receive_trip` (0124, 0157) |
| `trip.collect` | does (with the Buyer) | ride a trip, hand it in (W19) | `store_patch_trip` (0159) |
| `stock.count` | does | blind counts (W20) | `store_count_replace` (0161) |
| `stock.report` | does | report a loss (W17) | — |
| — (proposes) | `pick.settle`, `trip.difference`, `stock.correct`, `stock.writeoff`, `credit_note.raise`, `credit.release`, `order.cancel` | the Store sends; **Ruth decides** | — |
| — (proposes) | `buy.restock` | the Store asks; **Denis decides** | — |

Nothing waits on the owner: the count push goes to Ruth only; the owner reads the log.

---

## 8. What store.html does that no board draws

Each is kept as a rule (with its line) so nothing is lost; before any is built it is drawn as an AD board (`04-screens-store.md` §2), and one with no job in `FLOW.md` waits for Kevin.

| Feature | Line | Status |
|---|---|---|
| **Release** an order you started (ticks stay on the bay, or put back) | 4089, 4228 (`SHEET.pkrelease`) | not drawn; FLOW says the claim is automatic. AD candidate or drop: Kevin |
| **Shop picker** (a login in two shops) and **Switch shop** on You | 1897–1937, 5926 | not drawn; the shop has two shops in the picker (spec README). AD candidate |
| **Password reset** and set a new password | 1842, 1847–1862 | not drawn (TD20 draws sign-in only). AD candidate |
| **Shelf labels**: print Code 39 labels per aisle; the scanner reads `OW1:` codes | 5806–5866 | not drawn beyond SH40's scan and SH04's "labels" link. AD candidate |
| **The scanner's other modes** (pack, load, receive, agent) | 3638–3709, 4583 | SH40 draws shelf scan; IN02 links SH40 from the check-in. The load and pack modes: drop or AD |
| **Lock a road route** (OSRM) and the load map tiles | 2614–2633, 4372–4422 | OU31 draws naming a direction on the map; the route lock itself is not drawn |
| **Stock history** (four weeks, "Order #0548 · …") | 5256 | SH03 draws "what moved" |
| **Decide** (manager logins accept or recount) and **decline a return** | 5874, 6099 | removed from the Store app (IM-20/21, Q15) |
| **The bay sheet** ("Bay 3 is free · Look") | 3138 | the bays sit on Today; a free bay's tap is not drawn: drop, or AD |
| **Waiting to send → Remove** with a confirm | 3027–3038 | TD06 draws Remove; the confirm sheet is not drawn: AD |
| **"Leave Omni-ware?"** on Back from Today | 2209 | not drawn: AD (a sheet) |
| **My name** sheet (`set_my_name`) | 3166–3190 | TD12 draws You; the name sheet is not drawn: AD |
| **Sound and buzz** switches, the feel of each answer | 1025–1070, 5922 | TD12 draws Big text and Sign out; sound/buzz not drawn: Kevin |
| **Door returns**: what stays on the truck becomes a return checked at the gate | 4932, 6004 | OU24 draws the whole order coming back; a part-refused delivery is not drawn: AD |
| **Agent prepay gate** (an agent who pays first is not packed until settled) | 1772 | read as a rule (§4 of the screens chapter); no board shows the waiting state: AD if it happens |
| **Backdated orders** are left off To pack | 1480 | rule kept; no board: Kevin (what is a backdated order to the yard?) |

---

## 9. Open questions and places store.html disagrees with itself

| # | What | Line | Default |
|---|---|---|---|
| D1 | Count due after **21** days (`countDue`) but the aisle's freshness and "counted every **14** days" use 14 (`COUNT_DUE_DAYS`) | 5120, 5148 | one `countDue` at 21; the ring at 14 until Kevin (screens Q10) |
| D2 | A put-back is phone-only (`ow-store-putback`); another phone, Ruth and Grace never learn it was done | 4342–4347 | recorded on the order, `putBack` (0182, W28; screens Q11) |
| D3 | The money gate stops an unpaid pickup leaving Packing, so it can never be Ready to collect while unpaid; FACTS draws #0555 so | 0156; `moneyHold` 1502 | 0182 moves the gate to the hand-over (screens Q12) |
| D4 | "Can't deliver" has no write, only a toast | STORE-TODAY §4.4 | `comingBack` + `order.back` (0182; screens Q13) |
| D5 | The `notify-stock-count` push goes to the owner too | edge function | `stock.count.sent` to Ruth only; the webhook off at the switch |
| D6 | The `order.cancelled` push has no handler: the tap opens nothing special | 2666–2704 | `pack/put-back` or `out/road` (routes §5) |
| D7 | Pass the yard writes at once, no Undo | 6223 | held 10 s (screens Q17) |
| D8 | `orderDestination` reads the customer's `location` (or `deliveryAddress` for a shop delivery), not the order's own place | 1521–1526 | `deliverTo` when the order has it (0182 allow-list) |
| D9 | A hired driver's WhatsApp list is the only record of what he took; `carrier.phone` is stored but not the list | 4564 | as today |
| D10 | `loadSide` reads `places`, `place_routes`, `road_names` directly, outside the snapshot (no money, but a fourth way in) | 1205–1218 | as today |
| D11 | The return's photo path rides inside `note` ("photo: <path>"), not a column | 2532 | as today (the Manager app reads it there) |
| D12 | `myDrops` on a login with no staff row shows every drop to manager logins (`canCorrect`) | 2783 | a Store login with no staff row sees none; tell the person to ask for a staff row |
| D14 | No planned run time on an order (FACTS "Ssali 13:20", before the run is loaded) and no shop address or phone in the books (`store_snapshot` gives `shopName` only; FACTS "Kampala Road") | — | left out until Kevin says (screens Q25) |
| D13 | Roles let in include `owner`, `admin`, `manager` (and `staff`) | 2007 | they get in, look only (screens Q15) |

Dead code, do not port: the `needs0115` fallbacks (2293 and every caller); `S.noLive` (1179); the legacy snapshot key (1336); `whenSaid` (2768, the same as `whenAt`).
