# Round 5: Roles and privacy   (brief received 23 Oct 2026, build 23 Oct 2026 16:23 UTC)

Canvas: https://claude.ai/artifact/LVsyQEintezbVH3qn4cSVi, row "Audit round 5 · roles and privacy" (bottom of the canvas, version 97).
Migration: **0164** (functions and policies; no data changes). 0161, 0162 and 0163 are still to run.
Do not regress (round 4): a fraction stays one tag, the look-only order view, Buying rows open, typo search, chip counts, "Handing over…" until the yes, Back walks the screens.

## What was found (checked on a local copy of the database with every migration applied)

| ID | Root cause |
|---|---|
| PRIV-02 | `store_snapshot` (0160) calls `ow_money_hold(uuid, jsonb, numeric)`, which 0156 creates. The live database does not have it: 0156 was not run, or was rolled back (its ROLLBACK drops exactly that function). Locally, with 0156 applied, the snapshot works as the store role. |
| PRIV-03 | `noFn()` treats any "function does not exist" (42883) as "this shop has no store_snapshot yet" and falls back to direct reads. Here the missing function was inside the snapshot, so the app read the tables directly, row security returned nothing, and Today drew "The yard is clear". |
| PRIV-01 | Three leaks remain once the snapshot works. (1) `log.note` is passed through as typed ("counted in at 10,750 UGX per Kg"). (2) Key names that carry no money still match the acceptance search: `creditAsk`, `creditCheck`, `creditNotes`, `agentPaymentStatus`, `paymentTerm`, and a return's kind `"credit"`. (3) store.html still reads `agents`, `stock_counts`, `stock_reports`, `store_asks` and `shop_members` directly, so whatever those rows hold reaches `D()` unfiltered. The owner's full `saved_quotes` came from the owner's direct reads, which only happen because of the same fallback. |
| PRIV-04 | The name comes from the person's `staff` row (`staff.user_id`, linked by invite-worker). With the snapshot failing, the staff list fell back to a direct read the store role may not make, so no name was found. Separately, a login with no linked staff row has no name anywhere: `shop_members` has no name column. |
| PRIV-05 | Tested locally as the store role. **Holes:** the store role can **insert** a row into `saved_quotes` (row security only restricts what it *reads*), and it can read every `shop_members` row with its role. **Holds already:** it cannot update its own or anyone's role (0 rows), cannot update or delete `saved_quotes` directly (0 rows), and `accept_stock_count`, `ask_recount` and `decide_invoice_ask` check the Manager's task. |
| NAV-02 | Likely Chrome's "history manipulation intervention". Chrome skips history entries a page adds without a tap when the person presses Back. Round 4 re-adds the guard entry inside the `popstate` handler, which is not a tap, so the next Back skips it and leaves. The round 4 harness passed because Playwright's goBack does not apply that skip. |

## Design changes (canvas)

| ID | Board(s) | Before → After | States drawn | Tokens/components used | New component? |
|---|---|---|---|---|---|
| PRIV-03 | `LoadFailed` | Before: a failed load reads "The yard is clear · Nothing waits on you" and "No products on the books yet". After, on Today and Stock: "Could not load the yard" with Try again and "Still not loading? Tell Kevin · code 42883 · 4:23". The tiles show dashes, not 0s. The play button is grey. If the phone has a last copy: the red bar "Could not load the yard · Showing what this phone saw at 4:12 · code 42883" with Try again over the old jobs, faded. | before, Today failed, Stock failed, last copy kept, trying again | the empty-state card (red ring), the red Not done bar (round 3), navy Try again, stateDot spinner | No |
| PRIV-04 | `YourName` | Before: "Good evening," with a blank, and "The store · Store lead" on You. After: the greeting always has the name. With no name yet, the greeting has no comma, and one card says "Add your name · The team sees it on what you pack and count", with an Add button. You: tap the name (pencil) → "Your name" sheet with one field and Save. It shows how the name will read ("Shows as Musa…"). | named, no name yet, typing, saving, not saved (name kept), saved (You, plus "counted by Musa" / "taken by Musa") | Today hero, You hero, the confirm sheet, red Not done bar, list rows | No |

PRIV-01, PRIV-02, PRIV-05 and NAV-02 are logic-only: nothing new on screen. The existing "No prices, costs, payments or pay on this phone" line becomes true for every login.

## Code changes planned

| ID | Sev | File / function | Change (one line) | UI? | Acceptance check |
|---|---|---|---|---|---|
| PRIV-02 | P1 | `0164`: `ow_money_hold` (recreated as in 0156, `create or replace`) and `store_snapshot` | The snapshot works whether or not 0156 ran. A missing helper fails with a named error, never a silent half-load. | no | As store, Today shows the owner's jobs (#0550, #0566, #0576, #0546, #0574…) and Stock shows 145 products in their aisles. SQL test: `store_snapshot` runs as owner, admin, manager, store, staff, sales, buyer, accounts and sourcing, and refuses a non-member. |
| PRIV-03 | P1 | `store.html`: `storeSnapshotNow` (no fallback for anyone; `noFn` no longer decides it), `loadAll` / `refreshLive` set `S.loadErr = { code, at }`, a `loadFailCard()` on Today and Stock, the red bar over a kept copy, the grey play button, dashed tiles | Never "clear" or "No products" for a failed load. No direct table reads at all. | yes | Force `store_snapshot` to fail in the harness → the `LoadFailed` states, not "The yard is clear". Try again reloads. |
| PRIV-01 | P1 | `0164`: `store_snapshot` gives an allow-list per table (below); new `ow_strip_note(text)` takes money out of `stock_log` and trip notes; renamed keys at the boundary (`creditAsk` → `letGoAsk`, `creditCheck` → `letGo`, `creditNotes` → `takenBack`, `agentPaymentStatus` → `agentSettled`, `paymentTerm` → `agentTerms`); `store_order` and `store_patch_order` speak the same names. `store.html` reads only the snapshot and uses those names. | No money word reaches the phone. | no | As store: `JSON.stringify(D()).match(/price\|cost\|amount\|paid\|payment\|credit\|UGX/i)` is null. The same check runs in the SQL test on the snapshot JSON. |
| PRIV-04 | P2 | `0164`: `shop_members.display_name`, filled from the linked staff name; `ow_member_name(shop, user)` (staff name → display name → "The Store") used where the database writes a name; `set_my_name(shop, name)` (own row only); the snapshot gives `me` and `members` (names only). `invite-worker` writes `display_name`. `store.html`: `myName()`, the greeting, `takerOf`, You's name sheet. | Never a blank greeting or "The store" as a name. | yes | The store login shows its name on Today, You and "taken by" / "counted by". |
| PRIV-05 | P2 | `0164`: the restrictive policy "the yard writes through its functions" on INSERT/UPDATE/DELETE of every table the yard cannot read; `shop_members` restricted so a Store login reads only its own row (names come from the snapshot). New `test/store-round5.test.js` (SQL, run as each role). | The store role reads and writes only what it should. | no | The test proves a store login cannot insert/update/delete `saved_quotes`, cannot update any role, sees only its own `shop_members` row, and is refused by `decide_invoice_ask`, `accept_stock_count` and `ask_recount`. Results listed below after Phase B. |
| NAV-02 | P2 | `store.html`: one history entry per level opened by a tap (a tab other than Today, each pushed screen, each sheet), pushed inside the tap so Chrome never skips it; `popstate` runs `stBack`; Leave goes back past all of them. | Back never leaves without the sheet. | no (sheet exists) | Item → Back ×5 never leaves without "Leave Omni-ware?". To be checked on a phone too, since Playwright's Back does not skip entries the way Chrome's button does. |

### PRIV-01: what the snapshot returns (0164)

The same for every role that opens the Store app (owner, admin, manager, store, staff). The yard needs no money, so no role gets more on this phone.

| Part | Fields |
|---|---|
| `orders` | `id, client_name, client_phone, date, status, invoiced, invoiced_ts, voided`, `payload` = only `agentSettled` (true/false), `assignedDeliveryId, assignedWorkerId, bay, cancelledAt, cancelledByName, carrier` (kind, name, phone, staffId, at), `client` (name, phone), `createdAt, customerId, date, deliveredAt, deliveredNote, deliveredPhoto, deliveredPhotoKind, deliveredTo, deliveryAddress, deliveryMode, handoverCheckedAt, letGo` (decision only), `letGoAsk` (at, by, byName), `originAgentId, pickCursor, pickShortfallAckAt, pickingAssignedAt, pickingDoneAt, pickingStatus, runDriver, savedAt, stageEnteredAt, stageLog, takenBy, voidedAt, workerAcceptedAt`, `items[]` = `lineId, productId, productName, variantIdx, qty, unit, packQty, packUnit, supplierId, clientWaits, pickStatus, pickedQty, receivedAt, receivedQty, qtyIn`, `takenBack[]` = `askId, voided, lines[idx, qty]`, `pickSettle` = `pick, at, lines[idx, picked, ordered]` |
| `trips` | `id, supplier_id, status, assigned_worker_id, created_at, assigned_at, accepted_at, collected_at, confirmed_at, note` (money taken out), `voided, yard_checked_at, yard_checked_by, yard_received_at, difference_accepted_at`, `lines[]` = `lineId, productId, productName, variantIdx, qty, qtyIn, unit, packQty, packUnit, orderId, gotQty, yardQty` |
| `products` | `id, name, category, image`, `variants[]` = `combo` only |
| `units` | `id, product_id, variant_idx, unit, pack_unit, pack_qty, pieces_per_unit` |
| `customers` | `id, name, phone, location` |
| `team` | `id, user_id, name, phone, unavailable, job` (the staff job the yard needs: store, delivery, manager, buyer, sales, other) |
| `members` | `user_id, name` (names only; no login roles) |
| `managers` | user ids of the Manager, Buyer and Sourcing logins (so "With Ruth" and the asks name the right person) |
| `me` | `name, staff_id` |
| `agents` | `id, name, agentTerms` ("before" / "on_delivery") |
| `suppliers` | `id, name, location` |
| `settings` | `categories, locations, shopLocation, shopAddress, bays` |
| `log` | `id, key, type, delta, qty_after, date, at, note` (money taken out: "counted in at 10,750 UGX per Kg" → "counted in") |
| `counted` | item key → when it was last counted |
| `counts`, `reports`, `asks` | the yard's own rows, as today, through the same money strip |
| `returns` | `id, quote_id, lines[idx, name, unit, qty, shown, condition], reason, note, asked_by, asked_by_name, status, decided_at, created_at` |
| `holds` | order id → `{ decision }` (which packed orders wait on money; no amounts) |

Read directly by the app, still: `stock` (key, qty), `places`, `place_routes`, `road_names` and the push sign-up. None of them hold money.

## Not changing / pushed back

| ID | Why |
|---|---|
| PRIV-01 (worker.html) | The old worker login (`staff`) still reads orders directly in **worker.html**, as 0159 chose. When a `staff` login opens store.html, it now gets the snapshot like everyone else. Closing worker.html's reads is a change to another app. |
| PRIV-05 ("names only") | The yard still needs to know who the Manager and the drivers are. It gets a job word per person on the team (store, delivery, manager…), not the login roles table. |
| NAV-08 | Built in round 4 for the aisle list (sticky bar, back to the top). If Cowork means another long list, please name it for the next round. |
| NAV-09 | New in this brief's "still open" list, with no details yet: remove a waiting item, and restore the screen on reload. It belongs to a later round. |
| DATA-01, DATA-05/06 | These ride on 0161, which is written and approved but not yet run on the live database. |

## Risks

- **Owner and Manager on the Store app lose the fallback.** If the snapshot fails for them, they now see "Could not load the yard" too, not a money-full direct read. That is the point, but it means 0164 must be run before this build goes live.
- **Renamed keys.** The phone's names (`letGoAsk`, `letGo`, `takenBack`, `agentSettled`, `agentTerms`) exist only between the snapshot and store.html. The database keeps `creditAsk` and the others, so the Manager and Sales apps are untouched. `store_patch_order` maps `letGoAsk` back to `creditAsk`.
- **The write policy is deny by default for the yard**, like 0159's read policy. A table the yard writes to directly must be on the open list (stock, counts, reports, its asks, places, roads, push), or that write fails. The SQL test covers each one.
- **The NAV-02 cause is my reading of Chrome's behaviour.** The harness cannot reproduce it, so it needs one check on a real phone.

## Questions for Kevin

1. **0156 on live:** please run `select proname from pg_proc where proname in ('ow_money_hold', 'ow_order_total', 'store_money_holds');`. If `ow_money_hold` is missing, the server-side money gate on loading (0156's trigger) is missing too. 0164 brings back the function and the trigger together. OK?
2. **The Store app shows no money to anyone, owner included** (one snapshot for every login, no fallback). OK, or should the owner keep direct reads on this app?
3. **Your name:** the name lives in the staff row when there is one (the invite already sets it), else in a new `shop_members.display_name`. Each person can change only their own, from You. OK?

## Phase B result (filled after implementing)

| ID | Done? | What changed (function names) | How verified |
|---|---|---|---|
| PRIV-02 | Yes | `0164`: `ow_money_hold`, `store_money_holds` and the gate trigger from 0156 again (it stops with a named error if 0119's `ow_order_total` is missing). | SQL test: `store_snapshot` loads as owner, admin, manager, sales, store, staff, buyer, accounts and sourcing; someone outside the shop gets 42501. |
| PRIV-03 | Yes | `storeSnapshotNow` (throws; no fallback), `loadAll` and `refreshLive` read only the snapshot, `S.loadErr` / `loadErrOf`, `blankData`, `loadFailCard`, `loadBar`, `ACT.loadretry`, dashed tiles, grey play button, "Not loaded yet" on Stock. The direct-read helpers are gone (`selectAll`, `moneyHoldsNow`, `storeAsksNow`, `mergeQuotes`, `checkInTrip`, `changeTrip`, `noFn` and the direct order and return writes). The phone's cache moved to `ow-store-snap2`, and the old copy is deleted unread. | Harness `#r5fail` at 360 and 1280: Today and Stock show "Could not load the yard · code 42883", never "The yard is clear" or "No products". Try again loads 12 products. A failed refresh over a kept copy shows the red bar over the faded jobs. |
| PRIV-01 | Yes | `0164`: `ow_strip_note`, `ow_store_row`, `ow_store_payload` with the phone's names, the settings allow-list, and agents, counts, reports, asks, members, managers and me in the snapshot. `store.html`: `letGoAsk`, `letGo`, `takenBack`, `agentSettled`, `terms`. `changeOrderSnap` now sends only the keys the tap changed, so the phone's copy of the ask never overwrites the books' copy. | SQL test: no `price/cost/amount/paid/payment/credit/UGX` in the snapshot as any role. "counted in at 10,750 UGX per Kg" → "counted in". Harness: the same search over `JSON.stringify(D())` finds nothing. |
| PRIV-04 | Yes | `0164`: `shop_members.display_name` (filled from the staff name or the login's own name), `ow_member_name` (own choice → staff record → "The Store"), `set_my_name` (own row only, 2–60 letters, never an email), and `store_count_replace` / `store_return_ask` write names through it. `invite-worker` sets `display_name`. `store.html`: `myName` and `hasOwnName` read the snapshot's `me`, `takerOf` falls back to `members`, plus `nameCard`, `SHEET.myname` and `ACT.mnsave`. The avatar shows "?" until there is a name. | SQL test: Joy (no staff record) starts with no name, an email is refused, she sets "Joy Namata", and her return carries it. Harness `#r5noname`: "Good morning" with no comma, the Add your name card, the sheet, then "Musa Kiggundu" on You. |
| PRIV-05 | Yes | `0164`: "the yard writes through its functions" (restrictive INSERT/UPDATE/DELETE on every shop table except the yard's own: counts, reports, asks, places, roads, push sign-up, and `shop_members`, which keeps its own rules), and "the yard sees only itself" on `shop_members`. | See the results below. |
| NAV-02 | Yes | `navDepth`, `navCur` and `navArm` push one entry per level as the tap is handled. An in-app Back steps history back too (`navIgnore`). `popstate` runs `stBack`, and on Today opens "Leave Omni-ware?". | Harness: item → Find → Stock → Today → "Leave Omni-ware?" on four Backs, and only the fifth leaves, with the sheet already showing. An in-app Back takes history from 2 to 1. Chrome's skip only shows on a real phone: **Cowork please check Back ×5 on the phone.** |

### PRIV-05 results (test/store-round5.test.js on PostgreSQL 16, as the store role)

| Try | Result |
|---|---|
| Read `shop_members` | 1 row (its own) |
| Update its own role to owner | 0 rows |
| Update the Manager's role | 0 rows |
| Insert an order into `saved_quotes` | refused, 42501 (it was written before 0164) |
| Update / delete an order directly | 0 rows |
| Insert a customer | refused, 42501 |
| `decide_invoice_ask` | refused, 42501 |
| `accept_stock_count` | refused, 42501 |
| `ask_recount` | refused, 42501 |
| Insert its own loss report and restock ask | written (its own tables stay open) |
| `store_patch_order` with `letGoAsk` | written as `creditAsk` |

### Different from the plan

- The snapshot keeps the key `staff` with the staff record's `role` (the job: store, delivery, manager…), not a new `team`/`job` key, so nothing else had to change. It still reads no login roles.
- Trip lines and product variants go through the money strip (`ow_strip_money`), not a new allow-list. Their keys were too varied to pin safely this round, and the strip already removes every money key in them.
- The name a person types (`display_name`) wins over the staff record's, and the staff record itself is left alone (it belongs to payroll).
- `test/store-money-db.test.js`'s database scenario (run only with `OW_PG`) fails before and after this round: it updates orders directly as the store role, which row security has stopped since 0159. Left as it is; noted below.

### Run order on the live database

Checked on the live database on 23 Oct 2026: 0156, 0160 and 0161–0164 had not been run (everything they build on, 0115–0159, was there). Run, in this order:
**0156 → 0160 → 0161 → 0162 → 0163 → 0164**, then deploy `store.html` and the `invite-worker` function. invite-worker writes `display_name`, so it must go after 0164.
Tried on a copy built like live (0001–0159 without 0156): all six apply cleanly, and the round 5 scenario passes on the result.
