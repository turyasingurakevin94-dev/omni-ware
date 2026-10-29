# Sales ↔ Buyer handover (29 Oct 2026)

How an order moves between `sales.html` and `buyer.html`, what each side writes,
who is pushed, and the words each side shows. Read from the code at main
`44306748` and the migrations up to 0179. Line numbers are the files at that
commit.

## 1. The order's life

| Stage (`status`) | Sales shows (sales.html 4604) | Buyer shows (buyer.html 1013) | GLOSSARY |
|---|---|---|---|
| `draft` | **Checking** | Orders tab · "Checking" in words | Checking |
| `awaiting_goods` | **Buying** | on Plan the trip, the trip | Buying |
| `preparing` | Packing | Packing | Packing |
| `pending_delivery` | On the road | On the road | On the road |
| `completed` | Delivered | Delivered | Delivered |

Stage names agree. The line words under them do not (§4).

## 2. Sales → Buyer

| What | Field | Buyer told how |
|---|---|---|
| A new order to check | `saved_quotes` row, `status:'draft'`, `items[]` with `supplierId`, `price` (cost), `sellPrice`, `qty`, `unit` | **No push.** Shows on refresh in Orders and Today. |
| Client | `client.name/phone`, `customerId` | — |
| A selling price under the shop's | `items[].priceNote:'under'` | No push to Buyer; the Manager is pushed (`price.waits`, 0153). Buyer shows "Ruth must also say yes". |
| Credit | `creditCheck` | No push to Buyer. Buyer shows the Ruth fold. |
| Order moves to Buying | status → `awaiting_goods` | `order.buying` push (0131) — **to the Buyer** "An order needs buying". |

## 3. Buyer → Sales

| Buyer does | Field written | Push → who (migration) | Sales shows | Buyer says |
|---|---|---|---|---|
| Asks a supplier | `supplierConfirms[sid].askedAt` | none | "asking a supplier…" | "Asked · no reply yet" |
| Supplier says yes | `supplierConfirms[sid].state='confirmed'` | none to Sales | "found · 10:40" | "CONFIRMED" |
| Supplier says no | `state='problem'` | **none to Sales** | "not found yet" | "PROBLEM", "Doesn't have it" |
| Price went up | `price`, `priceWas`, `repricedAt`, `priceNote:'nomargin'` when over sell | `price.waits` → Manager; `price.decided` → salesperson after (0153) | "price up · waiting for Ruth" | "Above our selling price · Ruth decides" |
| Switched the item | `buyer_handoffs` `item_switch` | `item.switch` → salesperson (0134) | the switch on the order | "Grace is told · then X confirms it" |
| Removed a line | `droppedLines[]` + reason | `line.dropped` → salesperson (0136) | struck line on the order | "Removed · off X's bill" |
| Client waits / Sourcing finds | `items[].clientWaits` (no `supplierId`) | Sourcing request (0139); `sourcing.found` → Buyer (0144); **nothing to Sales** | "waiting for a supplier" | "WITH MOSES" / "CLIENT WAITS" |
| All suppliers yes | status `draft→awaiting_goods` (orderLeaveDraft) | `order.buying` → Buyer only | stage chip "Buying", line "being bought in" | "All confirmed · in Buying" |
| Trip came back short | `items[].receivedQty` < `qty` | `trip.short` → salesperson (0144) | "short · got 5 of 6" | "4 short · Kato" |
| Hand in; Store counts it in, order to Packing | status → `preparing` at the Store count | `trip.back` → Store (0150) | "Packing" | "Checked in · on the shelf" |

## 4. Mismatches

| # | Kind | What | Sev |
|---|---|---|---|
| M1 | word | Sales line words "shop checks for supplier", "being bought in" (sales.html 4632, 4637) are on GLOSSARY's **Never** list (line 58: use "Order in"). Buyer says "To ask". | high |
| M2 | word | One state, four words: Sales "found" · Buyer "CONFIRMED" / "Has it · same price" / "confirmed 10:40". GLOSSARY has no entry. | high |
| M3 | word | Sales "not found yet" · Buyer "PROBLEM" / "out of stock" / "Doesn't have it". | high |
| M4 | no push | A supplier's **no** reaches nobody in Sales; the salesperson only sees it on refresh, though the client is waiting. | high |
| M5 | no push | A line the **client waits** for (Sourcing) tells Sales nothing; Sales shows "waiting for a supplier" with no who or when. | med |
| M6 | dead push | `trip.short` pushes the salesperson, but `pushOpen` in sales.html (4932) does not route it: the tap opens Today, not the order. | med |
| M7 | promise | Buyer copy "Grace is told" / "Grace tells them" appears on actions with **no** push to Grace (asks, supplier answers, client waits). Only switch, drop, short and price really push. | high |
| M8 | missing state | Sales has no "Buying · 1 of 2 stops" or "on a trip" line state; the client hears "being bought in" until the Store counts it. | low |
| M9 | step twice | The Buyer types the supplier's new price; the Manager then types the client price; Sales sees only "waiting for Ruth" — fine — but Buyer's "Price changed" sheet asks how they told you again (already known from the ask). | low |
| M10 | word | Buyer "Remove line" / "Remove from order" / "Drop · off bill" (three words for one act); Sales shows a struck line with the reason. | med |
| M11 | no push | An order arriving in Checking does not push the Buyer (only Buying does). Today is the only door. | med |
| M12 | word | Buyer "Orders" tab vs Sales "Orders" with stage chips — same word, different meaning of the list (Buyer: only Checking). | low |

## 5. Changes Sales would need (for the Sales session — not built here)

1. Replace "shop checks for supplier" → "Order in · being checked" and "being bought in" → "Order in · being bought" (or the GLOSSARY's agreed word), M1.
2. Use the shared words for a supplier's answer: **Found** / **Not found** on both sides (Buyer changes its own; Sales keeps "found"), M2–M3.
3. Route `trip.short` in `pushOpen` to the order, M6.
4. Open a new `supplier.no` (or reuse `line.dropped`-style) push in `pushOpen` once a migration sends it, M4.
5. Show "Sourcing is finding it · Moses" for a line the client waits for, M5.
6. Show **Switched** as its own line word (from the Orders board).
7. Show **Ruth decides** on a line whose new cost is above Grace's selling price (from the Orders board).
8. An ask by phone or in person shows **Asked · 10:40** the same as one sent on WhatsApp (from the Today board).
9. A line moved to another supplier after a **Not found** goes back to **To ask**; Sales shows that word again (from the Replies board).
10. A supplier price that came in **under** the selling price stays **Found**, no push; Sales shows the new cost quietly (from the Replies board).
11. Show **On the trip** on a line once the cash ask is sent (read the trip state; no push, nobody waits), M8 (from the trip boards).

### Open question for Kevin
- An order that comes back **complete** pushes nobody in Sales (only `trip.short` does); Grace sees **Packing** after the Store counts it in. Nobody waits on her, so by the push rule no push is needed. Say if you want one.

## 6. The agreed design (the handover board on the canvas)

Every one of the 13 hand-offs carries a push and one word used by both apps.
The Buyer boards already use only these words (none of CONFIRMED, PROBLEM,
"round", "being bought in", "shop checks for supplier" remain). Sales reaches
the same words through the list in §5.

New pushes, one migration (number from docs/decision-rights.md when built):

| Push | To | Sound | Why |
|---|---|---|---|
| `order.check` | Buyer | yes | a new order waits on the Buyer (M11) |
| `supplier.no` | salesperson | yes | the client must hear (M4) |
| `sourcing.waits` | salesperson | yes | the client waits, Moses is finding it (M5) |
| `line.asked` | salesperson | quiet | the line moved to Asked |
| `supplier.found` | salesperson | quiet | the line is Found |
| `trip.started` | salesperson | quiet | the line is On the trip (M8) |

Quiet = into the salesperson's feed and badge, no sound; nobody waits on it.
