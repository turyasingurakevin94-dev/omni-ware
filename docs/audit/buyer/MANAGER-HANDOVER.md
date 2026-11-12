# Buyer · Ruth's answers (the Manager handover, B-1 … B-5)   (asked 12 Nov 2026 by the Manager session; Kevin: "3" — draw all, then build)

Source: `docs/audit/manager/handover.md` §5 "Buyer" on branch `claude/manager-round2`, and its migration
`supabase/migrations/0184_manager_pushes.sql` (tested on Postgres, **not yet run live**: until it is, the new
pushes below never arrive; everything here still works on the data the Buyer reads).

Words: the Manager's §3 (one agreed word per hand-off) and `docs/audit/GLOSSARY.md`. People by display name
(the canvas cast: Ruth the Manager, Musa the Store, Denis the Buyer, Grace in Sales, Peter an agent).

## What each one is

| ID | Today | After | Data | Board |
|---|---|---|---|---|
| B-1 | A tapped Ruth push opens Today (or nothing) | `trip.difference.decided` → the trip; `agent.change.decided`, `order.cancelled` → the order (Orders when it is gone); `restock.held`, `restock.released`, `carton.refused` → **the trip plan**, where the carton's card is (the board's call: the Manager's note said the order; the answer is acted on in the plan) | push data | `R2Answers` (the routing key) |
| B-2 | A handed-in trip whose check-in differed says nothing more | The handed-in trip shows **Ruth took Musa's check-in** (with when) once `difference_accepted_at` is set | `collection_trips.difference_accepted_at`, `yard_checked_by` | `R2Answers` |
| B-3 | A carton far bigger than the order is never asked about (the new app only reads the answer, `buy.ts` `cartonWaits`) | On the trip plan, a line whose supplier sells only whole cartons, with the shelf part over 10 × the order, shows **A carton for the shelf? · Ruth decides** with the order part and the shelf part as one bar; **Ask Ruth** writes the `restock_buys` row 0151 reads (`status 'held'`, `for_line = orderId:lineId`, qty = the shelf part); then **Waiting · Ruth**; her answer: **Shelf part OK** (the carton joins the stop) or **Order only** (only the order's part is bought; if that supplier sells only whole cartons, the line is Not found → another supplier, as any line — **question for Kevin**: is that right, or should Order only mean something else?) | `restock_buys` (0151; its trigger sends `carton.ask` to the Manager) | `R2Answers` |
| B-4 | The Buyer cannot answer a check-in that differs (old app had it) | On a handed-in trip whose check-in differs: **Tell Ruth why** → a sheet: Musa's count ≠ yours per line, three reasons (**{Supplier} loaded {n} · I counted wrong** / **It fell off or broke on the road** / **I don't know**), Send → `passOn('yard_note', 'manager', …)`; then **Sent · Ruth decides** | `collection_trips.lines[].yardQty`; `buyer_handoffs` kind `yard_note` | `R2Answers` |
| B-5 | After Ruth cancels, the On hold order just disappears | The order leaves On hold and reads **Cancelled · Ruth** (stop buying: off To ask and the trip); after Ruth keeps it (`order.cancel.ask.decided`, no) it goes back to its stage | `saved_quotes.voided` / cancel_asks status | `R2Answers` |

States drawn for each: default, pressed, sending, success, error, offline (and for B-3: asking, waiting, Shelf part OK, Order only).

## Code changes planned

| ID | File / function | Change |
|---|---|---|
| B-1 | `src/apps/buyer/shell/native.ts` `pushRoute` | The routes above; a test for each kind |
| B-2 | `src/core/buyer/supabase/rows.ts` (+ types), `src/apps/buyer/trip/Done.tsx` | Read `difference_accepted_at` / `yard_checked_by`; show the line |
| B-3 | `src/core/buyer/rules.ts` (`cartonAsk(line)` from the run), `source.ts` + demo + `supabase/trip.ts` (`askCarton(orderId, lineId)` insert into `restock_buys`), `trip/PlanStop.tsx` | The card and its states; the stop's total adds the shelf part only after Shelf part OK |
| B-4 | `source.ts` + demo + `supabase/write.ts` (`yardNote(tripId, why)` = `passOn('yard_note', 'manager', …)`), new `trip/YardNote.tsx`, `trip/Done.tsx` | The sheet and Sent state |
| B-5 | `src/core/buyer/supabase/rows.ts` (`cancelled`), `orders/rules.ts` `holdOf`, `orders/Order.tsx` | Cancelled · Ruth; back to its stage when kept |

## Not changing

| What | Why |
|---|---|
| The Buyer's `shell/nav.ts` and `shell/Gate.tsx` onto the new shared `src/ui/stack.ts` / `src/ui/Gate.tsx` (the Manager session's note) | One rule, one place says yes, but nav.ts carries the BUY-01 fix that just shipped; moving it is its own careful step once the shared one has the same guard. Listed for the next Buyer round. |
| Running 0184 on live | The Manager session's migration; Kevin applies it. |
