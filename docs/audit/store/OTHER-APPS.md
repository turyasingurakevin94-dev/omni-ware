# Changes other apps need (for their own sessions)

The Store redesign is design only, and it is built in the Store's own session. This list is what **other** apps' sessions must change so that every handover on the integration boards (`IB01Handovers`, `IB02StateWords`) reads the same on both sides. Nothing here is built by the Store session. IM-nn refers to `INTEGRATION.md` §3. The words below are the words the approved boards draw: the Store boards (`TD`, `PK`, `IN`, `SH`, `OU`) for the yard, the approved Sales boards (`docs/canvas/sales-agent/boards/`) for Sales.

## One decision that keeps this list short

**A packed pickup moves to `pending_delivery` (Ready to collect) the moment it is packed**, with no carrier, and the gate's hand-over then completes it. Sales (`src/core/orders.ts:138-140`) and the agent app (`agent.html:6199`) already read "Ready to collect" / "Ready · waiting at the shop" from exactly that state. So the fix for IM-03 is in the Store's own session, and Sales and the agent app need no change for the state itself, only for the words below. (The integration map suggested the other way round; this way touches fewer apps.)

## The database (one migration, in the Store's session)

The next free number after 0181, added to the reserved-number table in `docs/decision-rights.md` in the same commit. It adds the pushes below and the allow-list fields `deliverTo`, `deliverWhen`, `deliverPhone`, `counter`, `takenBack[].restocked`. Every push kind here is the one IB01 draws; nobody waits on a handover without one. Two handovers have no push on purpose because nobody waits on them: a counter sale (the yard reads it live as "Counter sale · out") and the shelf figure (both apps read "412 on shelf").

| Push (kind) | From → to | Words |
|---|---|---|
| `order.pick` on **insert** too | Sales → every yard phone | "New to pack · #0556 Nansana · they collect" (IM-10, IM-09) |
| `order.pick` (given) | Manager → that packer only | "Ruth gave you #0556 to pack" (IM-08) |
| `order.copy` | Manager → the yard | "#0557 is a copy · don't pack it" |
| `order.cancelled` to whoever holds it | Manager → packer, bay, driver, the salesperson | "Cancelled · put it back · #0530"; on a truck "#0534 cancelled · bring it back" (IM-11, IM-39) |
| `trip.back` (new title) | Buyer → the yard | "Denis's trip is back at the yard · 3 lines" (IM-25, IM-26) |
| `trip.checked` | Store → the Buyer | "Checked in · Denis's trip · 3 lines" |
| `trip.difference` (new title) | Store → Manager | "Musa's check-in of Denis's trip · 2 pc differ" |
| `trip.difference.decided` | Manager → the checker | "Ruth decided the 2 pc" (IM-23) |
| `order.all_in` | Store → the salesperson | "Ggaba's #0549 is all in · Packing" (with `order.pick` "New to pack · #0549 Ggaba" → the yard) |
| `trip.short` from the check-in | Store → the salesperson | "#0546 Lubowa · 18 of 20 came · pack 18" (IM-36) |
| `delivery.checked` | Store → Sourcing; the delivery note → Accounts | "Hima Cement · 100 bag came in" (torn bags go as `stock.report` "Hima Cement · 4 torn" → Ruth) |
| `store.ask.decided` on an extra | Manager → the checker, the Buyer, Accounts | "Ruth: keep it" (IM-17; Esther pays the supplier for it) |
| `store.restock` (new title) | Store → Buyer | "We need more · Gloss paint · about 10 tin"; answer `store.ask.decided` "On the restock list · next trip" |
| `pick.short` to the salesperson too | Store → Manager and the salesperson | "#0552 · 1 short · Ruth settles" |
| `pick.settled` | Manager → packer, salesperson | "Ruth settled #0552's short" (IM-37) |
| `order.packed` | Store → the salesperson | "Kato's #0552 is packed · bay 1" (IM-05) |
| `order.unpaid_at_gate` | Store → the salesperson (with `credit.ask` → Ruth) | "Kato's #0552 is packed · take the money" (IM-07) |
| `credit.ask` (new title) | Store → Manager | "Not paid yet · let it go on credit?" (IM-35; never "cash customer") |
| `order.ready` | Store → salesperson, agent, customer | "#0554 ready to collect · at the gate · code 0554" (IM-03, IM-04) |
| `order.out` | Store → salesperson, customer, agent | "#0552 on the road · Ssali"; hired: "#0552 on the road · Abudu (hired)" |
| `order.delivered` also to the salesperson and the agent | Store → Ruth, salesperson, agent | "#0552 delivered 14:05" / "#0555 collected 10:47" / "#0554 collected · Peter"; it carries the no-photo reason (IM-06, IM-30) |
| `order.back` | Store → Ruth, salesperson | "#0547 coming back · Ggaba closed" |
| `order.moved` | Manager → the yard | "Ruth marked #0538 delivered" (IM-29) |
| `stock.count.sent` → Ruth only | Store → Manager | "Your count of Wire nails 4" · 17 ctn" (IM-20; the owner gets the log) |
| `stock.count.decided` | Manager → the counter | "Ruth accepted your count" (IM-20) |
| `stock.recount` | Manager → the counter | "Ruth asked: count it again" (IM-20) |
| `return.coming` | Sales' return ask → the yard | "#0548 coming back · 2 bag" (IM-15) |
| `invoice.ask.decided` read by the yard | Manager → the yard, the salesperson | "Ruth took it back · 2 bag" (IM-14) |
| `store.handover` (new title) | Store → the colleague | "Musa passed you the yard"; back `store.ask.decided` "Okello has it" (IM-34) |

## Sales (`src/apps/sales`, and `sales.html` while it lives)
- IM-01/02: write `deliverTo` (place), `deliverWhen`, `deliverPhone` as separate keys through `place_order`; stop joining them into one string.
- IM-05: in Packing show **"Packing"** while nobody has it (never "Store packing"), **"Packing · Musa"** once he has it, **"Packed · bay 1"** once the yard has packed (`pickingStatus='done'`), and **"Not paid yet · leaves when paid · Take payment"** on a money hold; open the `order.packed` / `order.unpaid_at_gate` pushes on the order.
- IM-03: a packed pickup reads **"Ready to collect · at the gate"** (OR38).
- IM-04: a hired lorry reads **"On the road · Abudu (hired)"**, never "Ready to collect".
- IM-06: a gate hand-over reads **"Delivered · collected"**, never "At the door"; a door delivery stays "Delivered · At the door 14:05" (OR09).
- IM-30: name the deliverer from `carrier`, drop `deliveredBy`; show **"No photo · Kato said no"**.
- IM-36: a short trip line reads **"Short · 18 of 20"**.
- A copy order Ruth is cancelling reads **"Packing · copy"** (PK09), and the yard gets `order.copy`.
- A short pick reads **"1 short · Ruth settles"**; a return the yard checked reads **"Taken back · 2 bag"**; a delivery that comes back reads **"Coming back · Ggaba closed"**.
- IM-32: `heldOf` converts to shelf units like the Store, so both show "412 on shelf".
- IM-33: `counter_sale` writes `deliveredAt` as ISO, and `counter: true` reaches the yard so a counter sale is never a yard collection (IM-31).
- A return asked raises `return.coming` to the yard (IM-15).

## Buyer (`buyer.html`)
- IM-25/26: "Back at the yard · Musa checks it in" / "Checked in" (buyer.html:3238, 3690, 4697, 4705); the hand-in push says "Denis's trip is back at the yard · 3 lines", never "round", "count it in" or "at the gate" ("at the gate" is only for orders waiting to be collected and returns). "Checked in" comes from `trip.checked`.
- IM-36: a short trip line tells Sales and the yard the line's new quantity, so the yard packs what came.
- The restock answer reads "On the restock list · next trip".
- A trip a storekeeper rides reads **"Buying · Musa rides it"**, then "Handed in" (never "On the way", which the glossary keeps off goods coming in).

## Manager (`manager.html`)
- IM-08: a packer given an order reads **"With Musa"**; agree with the worker app that an order given to a packer is that packer's until they release it.
- IM-23: the difference card reads **"Musa's check-in of Denis's trip · decide the 2 pc"**, and deciding pushes `trip.difference.decided` (no bare "Seen").
- IM-12: a return asked before the bill is not refused: it reads **"Not billed yet · settle it once the bill is out"** in Ruth's own app (Sales OR21 says "Ruth gives it once the bill is out"), keeps the yard's Good / Damaged per line, and becomes the credit note when the automatic bill goes out.
- IM-13: "Back on the shelf" per line defaults from the yard's Good / Damaged ("Credit note · per line Good or Damaged").
- IM-14: record `restocked` per line on the credit note; push the decision to the yard.
- IM-15/16: one-write credit note; restock waits for the yard's check-in.
- IM-17: a "Not on the list · keep it?" card answering `store.extra`: "Keep it · the shelf" / "Send it back · Kiseka"; the answer (`store.ask.decided`) also reaches Denis and Esther, who pays Kiseka for a kept extra.
- IM-18: show the yard's close (`store.closed`) as a log line, "The yard is closed".
- IM-20/21: the count push opens the count, "shelf 18 → counted 17"; **Accept the count / Count it again** are the Manager's only (the Store app stops showing them to manager logins); the decision pushes back.
- IM-22: "the shelf", not "books", on the stock take.
- IM-27: "On the road", never "On road".
- IM-28: the Packing clock stops at `pickingDoneAt`: a packed order reads **"Packed · waits for the truck"**, not stuck.
- IM-29: a stage moved by hand pushes `order.moved` to the yard; "Mark done" asks who delivered it.
- IM-30: "No photo · {reason}" from `deliveredPhotoKind` / `deliveredNote`; a door delivery with a photo reads "Delivered · photo", a gate one "Delivered · collected".
- IM-35: the credit ask reads "Not paid yet · let it go on credit?", never "cash customer".
- IM-37: settling a short pick ("Bill what went / Bill the full quantity") pushes `pick.settled`.
- New states: **"Ready to collect"**, **"Coming back · Ggaba closed"**, **"Counter sale"** (not "Delivered").
- Cancel: her button stays **"Cancel"**; `order.cancelled` reaches whoever holds the order (packer, bay, driver) and the salesperson, on a truck too.

## Accounts (`accounts.html`)
- Nothing new from the yard (the yard takes no money). `order.invoiced` 24 h after delivery already reaches Esther ("Invoice to send"); keep it.
- The supplier's delivery note arrives with `delivery.checked`; a counter sale is **"Counter sale · income"** (was "income").
- A kept extra (`store.ask.decided` "Ruth: keep it") tells Esther to pay the supplier for it (IN13: "pays Kiseka for it").

## Sourcing (`sourcing.html`)
- IM-19: a list of new items checked in at the yard (`store_asks` with `newItem`), and a push case for `store.new_item` ("A new item at the yard · list it").
- `delivery.checked`: "Came in · 100 bag · 4 torn".

## Owner (`owner.html`)
- IM-25: task label "Check in a trip at the yard".
- IM-27: "On the road", never "On road"; "Ready to collect" for a packed pickup; "Packed", "Not paid yet" and "Coming back" where it showed "Packing" or "On road".
- **"Delivered today"**, not "Done today" (the glossary's stage word, as the yard's "1 delivered today"); a counter sale is **"Counter sale"**, never "Delivered today" (IM-31).
- IM-28: stuck Packing stops at `pickingDoneAt`.
- IM-20: the owner gets counts in the log, never the count push.

## Console (`index.html`)
- IM-24: no check-in from the console; a collected trip is read-only there.
- IM-27: the shared words in `SQ_STATUSES`, `OT_LANE_NAME` and the floor panel: Checking · Buying · Packing · Packed · Not paid yet · Ready to collect · On the road · Coming back · Delivered · Delivered · collected · Counter sale · Delivered · invoiced · Cancelled (no "Step 3. Being Prepared", "Pending Delivery", "Completed", "Out", "Being picked").
- IM-18: the yard's close in the day report.

## Agent (`agent.html`) and client (`client.html`)
- IM-27: Buying is "Buying · getting your goods", not "Packing" (agent.html:7834); "On the road · Ssali", not "On the way".
- Agent: "Being packed now" / "Musa is packing it" / "Packed" / "Not paid yet" / **"Ready to collect"** (PK07: "Peter sees: Ready to collect") / "Coming back to the shop" / "Delivered" / **"Delivered · collected"** (OU11), never "Done · Delivered" or "Done · Collected"; an invoiced order reads **"Delivered · settle up"**, not "Done · Settle up".
- Client: a pickup in `pending_delivery` reads **"Ready to collect at the shop"**, never "It has left the shop"; a delivery that comes back reads "Coming back to the shop".

## Worker app (`worker.html`)
- IM-08: the same rule as the Store for an order given to a packer (`awaiting_accept`). The Store app replaces the worker app for the yard; once the new Store is built, retire the worker app's packing screens.
