# The buying flow, rethought (29 Oct 2026)

From the moment Sales saves an order to the moment the goods are handed in and
the salesperson knows. Baseline: one order, 3 lines, 2 suppliers, one stop
each, one trip. Counted from buyer.html at main `44306748`.

## Today: 26 taps, 6 pages

| # | Step | Taps | Page |
|---|---|---|---|
| 1 | Open the order from Orders | 1 | Orders → Check |
| 2 | Ask supplier A (Ask → pick way → send in WhatsApp → back → "I sent it") | 4 | Ask sheet |
| 3 | Ask supplier B | 4 | Ask sheet |
| 4 | A answers yes (open → They told me → Same price) | 3 | Answer sheet |
| 5 | B answers yes | 3 | Answer sheet |
| 6 | Plan the trip (Trips → Plan → tick stops → Ask for cash) | 4 | Plan |
| 7 | On the trip: per stop open → as planned → paid → done here | 4 + 3 | On the trip |
| 8 | Hand in (Hand in → slide) | 2 | Hand-in |
| | **Total** | **≈ 26** | |

## Each step, asked three questions

| Step | Needed? | Merge? | Can the app do it? | Result |
|---|---|---|---|---|
| Open the order | yes, but the work is per **supplier**, not per order | — | group asks by supplier on Today | the Today row *is* the ask |
| Ask A, ask B | yes | one message per supplier for **all** orders | app writes the message, opens WhatsApp, marks Asked on return | **1 tap per supplier** (navy "Ask" pill on the row) |
| "I sent it" | no | — | coming back from WhatsApp = sent; undo for 5 s | cut |
| Answer yes | yes | "Same price" is the common answer | one row with **Yes · same** / **No** / **New price** pills | **1 tap per supplier** |
| Order to Buying | no | — | already automatic when every supplier says yes | 0 |
| Plan the trip | yes, one decision: go now | ticking stops, cash ask | app proposes the round (all "yes" suppliers by area) and the cash; one slide sends the cash ask to Accounts | **1 slide** |
| Per stop: as planned / paid / done | yes, one fact: what came and what was paid | merge all three into one row per stop | default = as planned and paid as planned; only a difference needs typing | **1 tap per stop** ("Got it all") |
| Hand in | yes, irreversible | — | — | **1 slide** |
| Tell Sales | yes | — | pushes on short, no, switch, drop, price (§ handover) | 0 |

## Target: 7 taps + 2 slides, 3 pages

| # | Step | Taps |
|---|---|---|
| 1 | Today · Ask A (row pill) | 1 |
| 2 | Today · Ask B | 1 |
| 3 | Replies · A: Yes · same | 1 |
| 4 | Replies · B: Yes · same | 1 |
| 5 | Trip · slide "Send cash ask" | slide |
| 6 | Stop A · Got it all | 1 |
| 7 | Stop B · Got it all | 1 |
| 8 | Hand in · slide | slide |
| | **Total** | **6 taps + 2 slides = 8** (from 26) |

The **+ FAB** (red, centre) starts the trip from anywhere: it is the Agent app's
"start the one job" move. The two tabs are **Today** (asks and replies — the
work waiting on you) and **Suppliers**. Orders, Replies and the trip are views
reached from Today's On-the-move tiles, not separate tabs: same as the Agent's
Baskets / Sent / Packing / Out.

## What the Buyer no longer does

- Open each order to ask (asks are per supplier, across orders).
- Tell the app "I sent it".
- Say how the supplier told you (the ask already knows the way).
- Tick stops one by one (the round is proposed).
- Confirm "as planned" and "paid as planned" separately.

## Exceptions keep their own short path

| Exception | Path | Sales told |
|---|---|---|
| Supplier says no | Reply row → **No** → pick: other supplier (1) · client waits (1) · remove (slide) | `supplier.no` push (new, M4) |
| Price went up | Reply row → **New price** → type → done | `price.waits` → Manager, then `price.decided` → salesperson |
| Switched item | Reply row → **No** → Switch → search → pick | `item.switch` |
| Short at a stop | Stop row → **Short** → type what came | `trip.short` → salesperson |
