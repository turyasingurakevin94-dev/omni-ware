# Changes other apps need (for their own sessions)

The Store redesign is design only, and it is built in the Store's own session. This list is what **other** apps' sessions must change so that every handover on the integration boards (`IB01Handovers`, `IB02StateWords`) reads the same on both sides. Nothing here is built by the Store session. IM-nn refers to `INTEGRATION.md` §3.

## One decision that keeps this list short

**A packed pickup moves to `pending_delivery` (Ready to collect) the moment it is packed**, with no carrier, and the gate's hand-over then completes it. Sales (`src/core/orders.ts:138-140`) and the agent app (`agent.html:6199`) already read "Ready to collect" / "Ready · waiting at the shop" from exactly that state. So the fix for IM-03 is in the Store's own session, and Sales and the agent app need no change for it. (The integration map suggested the other way round; this way touches fewer apps.)

## The database (one migration, in the Store's session)

The next free number after 0181, added to the reserved-number table in `docs/decision-rights.md` in the same commit. It adds the pushes below and the allow-list fields `deliverTo`, `deliverWhen`, `deliverPhone`, `counter`, `takenBack[].restocked`. The `store.handover` text becomes "… passed you the yard" (IM-34).

| Push (proposed kind) | From → to | Words |
|---|---|---|
| `order.pick` on **insert** too | Sales → every yard phone | "New to pack · #0556 Nansana · they collect" (IM-10, IM-09) |
| `order.pick` (given) | Manager → that packer | "Ruth gave you #0552 · Kato" (IM-08) |
| `order.cancelled` to whoever holds it | Manager → packer, bay, driver | "#0550 cancelled · put it back" (IM-11, IM-39) |
| `order.packed` | Store → the salesperson | "Kato's #0552 is packed · bay 2" (IM-05) |
| `order.ready` | Store → salesperson, agent, customer | "#0556 ready to collect · bay 3" (IM-03, IM-04) |
| `order.unpaid` | Store → the salesperson (with `credit.ask` → Ruth) | "Kato's #0552 is packed · take the money" (IM-07, IM-35) |
| `order.out` | Store → salesperson, customer, agent | "#0552 on the road · Ssali" |
| `order.delivered` also to the salesperson | Store → Ruth, salesperson | "#0552 delivered 14:05" / "#0555 collected 10:44" (IM-06) |
| `order.back` | Store → Ruth, salesperson | "#0547 coming back · Ggaba closed" |
| `order.moved` | Manager → the yard | "Ruth marked #0550 delivered" (IM-29) |
| `pick.settled` | Manager → packer, salesperson | "Ruth settled #0552's short · bill what went" (IM-37) |
| `trip.difference.seen` | Manager → the checker | "Ruth saw your check-in of Denis's trip" (IM-23) |
| `stock.count` → Ruth only; `stock.count.decided` back | Store ↔ Manager | "Ruth accepted your count" / "Count Wire nails 4" again" (IM-20) |
| `return.coming` | Sales' return ask → the yard | "#0548 coming back · 2 bag" (IM-15) |
| `invoice.ask.decided` read by the yard | Manager → the yard | "Ruth took #0548 back · 2 bag to damaged" (IM-14) |

## Sales (`src/apps/sales`, and `sales.html` while it lives)
- IM-01/02: write `deliverTo` (place), `deliverWhen`, `deliverPhone` as separate keys through `place_order`; stop joining them into one string.
- IM-05: in Packing show "Packed · bay 2" once the yard has packed (read `pickingStatus='done'`), and "Not paid yet · Take payment" on a money hold; open the `order.packed` / `order.unpaid` pushes on the order.
- IM-06: "Delivered · collected 10:44" for a gate hand-over, not "At the door".
- IM-30: name the deliverer from `carrier`, drop `deliveredBy`; show "No photo · {reason}".
- IM-32: `heldOf` converts to shelf units like the Store.
- IM-33: `counter_sale` writes `deliveredAt` as ISO, and `counter: true` reaches the yard so a counter sale is never a yard collection (IM-31).
- A return asked raises `return.coming` to the yard (IM-15).

## Buyer (`buyer.html`)
- IM-25: "Musa checks it in" / "Back · check it in" / "Checked in" (buyer.html:3238, 3690, 4697, 4705); the hand-in push says "Denis's trip is at the gate", never "round" or "count it in".
- IM-36: a short trip line tells Sales and the yard the line's new quantity, so the yard packs what came.

## Manager (`manager.html`)
- IM-12: a return asked before the invoice is settled as an order change, not refused.
- IM-13: "Back on the shelf" per line defaults from the yard's Good / Damaged.
- IM-14: record `restocked` per line on the credit note; push the decision to the yard.
- IM-15/16: one-write credit note; restock waits for the yard's check-in.
- IM-17: a "Not on the list · keep it?" card answering `store.extra`.
- IM-18: show the yard's close (`store.closed`) as a log line.
- IM-20/21: the count push opens the count; Accept / Count it again are the Manager's only (the Store app stops showing them to manager logins); the decision pushes back.
- IM-22: "the shelf", not "books", on the stock take.
- IM-27: "On the road", never "On road".
- IM-28: the Packing clock stops at `pickingDoneAt` (packed is not stuck).
- IM-29: a stage moved by hand pushes `order.moved` to the yard; "Mark done" asks who delivered.
- IM-30: "No photo · {reason}" from `deliveredPhotoKind` / `deliveredNote`.
- IM-37: settling a short pick pushes `pick.settled`.
- IM-08: with the worker app, agree that an order given to a packer is that packer's until they release it.

## Accounts (`accounts.html`)
- Nothing new from the yard (the yard takes no money). `order.invoiced` 24 h after delivery already reaches Esther; keep it.

## Sourcing (`sourcing.html`)
- IM-19: a list of new items checked in at the yard (`store_asks` with `newItem`), and a push case for `store.new_item`.

## Owner (`owner.html`)
- IM-25: task label "Check in a trip at the yard".
- IM-27: "On the road"; "Ready to collect" for a packed pickup.
- IM-28: stuck Packing stops at `pickingDoneAt`.
- IM-20: the owner gets counts in the log, never the count push.

## Console (`index.html`)
- IM-24: no check-in from the console; a collected trip is read-only there.
- IM-27: the five shared stage words in `SQ_STATUSES`, `OT_LANE_NAME` and the floor panel (no "Step 3. Being Prepared", "Pending Delivery", "Completed").
- IM-18: the yard's close in the day report.

## Agent (`agent.html`) and client (`client.html`)
- IM-27: Buying is "Buying · getting your goods", not "Packing" (agent.html:7834); "On the road", not "On the way".
- Client: a pickup in `pending_delivery` reads "Ready to collect at the shop", never "It has left the shop".

## Worker app (`worker.html`)
- IM-08: the same rule as the Store for an order given to a packer (`awaiting_accept`). The Store app replaces the worker app for the yard; once the new Store is built, retire the worker app's packing screens.
