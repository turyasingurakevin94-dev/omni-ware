# Sales ↔ Buyer · Round 1: the handoff   (brief received 11 Nov 2026, builds next/sales.html 3af7730c6230 and buyer.html of 11 Nov 2026 11:17 GMT)

Cowork tested both apps read-only as Daphine (sales) and the Buyer. Verified working and kept: Daphine's orders reach the Buyer's Checking tagged "From Daphine"; the Buyer shows cost totals, never selling prices; Sales' Today and Orders show only the signed-in seller's orders.

Canvas: the Buyer canvas ([Buyer — Agent language](https://claude.ai/artifact/YDydRwAjmK6U3YsQhnjFz7), v50), new row "Cross-app round 1 · Sales ↔ Buyer handoff": boards `XR1Hold`, `XR1Today`, `XR1PriceComing`, `XR1SalesLines`, `XR1Goal`. Repo copies and renders: `docs/canvas/buyer/XR1*.dc.html`, `XR1*.png`. The boards draw the sample shop (`docs/canvas-cast.md`); the live cases are named on each board (#0604 Muyanja, #0606 Edging Lipping). All of it sits on the Buyer canvas, beside the handover board, so the five boards are in one place; the two Sales boards copy the Sales canvas's own parts (OR05, the P02 hero).

## What the code does today (checked in code, and with sample rows through the Buyer's real rules)

| ID | Finding |
|---|---|
| BUY-1 | `src/core/buyer/supabase/read.ts` reads no `cancel_asks` (0181), so `BOrder` has no idea of an ask. The Buyer's role can read the table already (0181's policy keeps out only `store` and `staff`), so no policy change is needed. `buy.ts runsToGo` takes every Buying or Packing order, so an order in Buying with an open ask goes on the next trip. 0177's `cancel_order` refuses a cancel during a live buying trip, so once it is bought, Ruth cannot cancel it until the trip is handed in. |
| BUY-2 | Run with rows shaped like the live data: a line with **no supplier** (`supplierId` empty, client not waiting) reads `toask` (`rules.ts lineState`). `tiles()` counts distinct `supplierId`s in that state, so `null` counts as one supplier: **To ask 1** plus the red badge. `askGroups()` skips lines with no supplier, so **Needs you shows 0, "Every supplier asked"**. `tiles().suppliers` leaves it out, so the hero says **"1 of 1 suppliers found"**. Today's section says **"3 orders"**, and the To ask tile opens **Orders** (counted in orders: To ask 2). That makes four counts in three units for one screen. |
| BUY-3 | Sales writes `priceAsk: true` with `priceNote` `nomargin` or `nocost` and no `sellPrice` (`core/orders.ts linePayload`). The Buyer's `priceWaits()` (`order.ts`) treats any price wait as Ruth's, so `ruthDecides` is set and `lineState` returns **`priceup`** before it looks at the supplier. Result: #0606's line reads **"Price up · Ruth decides"** although no price went up, it is **never in To ask, and nobody asks the supplier** (spec 04 Q10: Moses finds the cost, Ruth prices it, then Denis buys it). So the Buyer does see it, but as the wrong question. `priceAsk` itself is read nowhere. |
| SAL-1 | `core/supabase/rows.ts lineOf` reads no `supplierConfirms`. `orders/view.ts` marks a supplier line in Checking with a **green tick, "the supplier said yes"**, unless `state === 'waiting'`, which no reader sets. Every live supplier line therefore claims a yes that was never given: a false success, worse than "only Checking". Sales refreshes every 45 s (`shell/store.ts`), so a word the Buyer writes reaches Sales without a reload once it is read. |
| SAL-2 | `ui/Hero.tsx`: the sold part has `min-width: 8px` (`hero.css:21`), so 0% still draws a white dot at the bar's start, over "0%". The move is plain mint at .45 opacity and reads as progress. The same bar is written three times (Hero, `GoalStrip`, the scrolled top bar in `today/Today.tsx:103`). |
| — | Found while reading: the Buyer writes clock times as "09:40" (`hm` with `padStart`, twice: `orders/rules.ts:18`, `today/rules.ts:19`), against Kevin's decision #9 of 11 Nov ("9:50: the shared clock, the same in every new app"). Sales writes "9:40". SAL-1 needs one clock, so the fix is in this round (below). |

## Design changes (canvas)

| ID | Board(s) | Before → After | States drawn | Tokens/components used | New component? |
|---|---|---|---|---|---|
| BUY-1 | `XR1Hold` | Before: #0560 is To ask with its Ask and counted in Checking's 2,750,000. After: Orders puts a held order last, under an "On hold" divider, as a grey card with a grey strip, the pill **"Cancel asked · hold"** and Ruth's face ("Ruth decides"), and no act. It is out of Checking's count (2) and money (2,250,000), and the head shows a "1 on hold" chip. The order opens with one amber card ("Cancel asked · hold · Grace asked Ruth · 9:40 · why · Don't ask or buy. Ruth decides.") and its lines have no act. Today: not in To ask or To buy, and Ruth is in "Waiting on others" with the order number. Plan: one more chip in "Held off the trip". | default, pressed, disabled (a held line locked on a supplier's page), sending (the trip goes without it), error (server refusal + Refresh), success ×2 (Ruth kept it → back to To ask; Ruth cancelled → gone), offline, empty (only held orders: "Nothing to check"), and already on the trip (count starts at 0, "Cancel asked · don't buy") | order row, strip, Pill (warn), Avatar face, Notice, toast, Plan's held chips, Today's Waiting-on card | No. The pill is the existing soft pill in warn, and the "On hold" divider is a section label. |
| BUY-2 | `XR1Today` | Before: To ask 1 with a badge, "3 orders", "Every supplier asked", "1 of 1". After: **Today counts suppliers only** (Kevin's decision #2 stands). A line with no supplier counts as one supplier still to find ("1 of 2 suppliers found") and gets a **red "No supplier" row in Needs you with Pick**. That row opens the existing Not found sheet, with the price list's cheapest supplier first and Client waits. It is never in To ask. The section says "2 suppliers", not "3 orders". The **To ask tile scrolls to Needs you** (same screen, same count: one Ask row per supplier) and rings the first Ask row for 1 s. It no longer opens Orders, which keeps counting orders. On the trip counts stops, not lines. Needs you drops its number: its rows are jobs of two kinds (Ask a supplier; fix a line). | default, pressed (tile → scroll + ring), on the trip, offline, empty ("Every supplier asked" only when nothing is left to ask, pick or fix) | Today tiles, hero, Needs you rows (Not found row from Additions2), Not found sheet (Orders phone 3) | No. "No supplier" is a new word on the existing red fix row. |
| BUY-3 | `XR1PriceComing` | Before: #0561's line with no price reads "Price up · Ruth decides" and is never asked. After: it is asked like any line (To ask · Katwe, Ask on the row). A small amber tag **"Price coming · Ruth"** (Sales' own word) sits under the state word on the row, the order and the Sales line. Once Found, it stays in "Held off the trip" ("Edging lipping · Price coming") until Ruth prices it, then joins the plan in route order. "Price up" stays only for a cost over the selling price. | default, Price up (unchanged), success (Ruth priced → the tag goes), offline, the same line in Sales | soft pill (warn), Plan held chips, toast | No |
| SAL-1 | `XR1SalesLines` | Before (OR05 as built): a supplier line in Checking always shows the green tick "the supplier said yes". After: each supplier line carries **the Buyer's word as a pill in the Buyer's colours**: To ask · Asked · 9:40 · Found · 10:52 · Not found · No supplier · Price up (Ruth's face) · Client waits · Moses · Removed (struck). The mark follows the word (amber ring = asked, dashed = to ask, tick = found, red × = not found / no supplier). The check list's bar and "N of M" count Found lines. A new word flashes the line green once, with no reload and no jump. **No cost and no supplier name**: Found shows the time, never the price we pay. "Price coming" stays Sales' word beside the Buyer's. | default, no pressed state (a line is not a button, as now), success (live, flashes once), offline (Updating · saved), empty (all on our shelf: no Buyer word) | CheckList line, its word slot, Pill, Avatar face, Hero "Updating" | No. CheckList's word takes the shared tones (it has info and warn today; good, bad and neutral are added). |
| SAL-2 | `XR1Goal` | Before: at 0% an 8 px white dot sits over "0%" and the move is plain mint. After: **sold is solid** (white on navy, navy on white), **on the move is hatched mint**, with a 2 px gap between them. 0% draws no white. Above 0%, sold is at least 4 px, so 1% never looks like 0%. There are no new words: the "on the move" door below gets the same hatch swatch as its key. One part draws all three bars (hero, busy-day strip, scrolled top bar). Goal hit is unchanged. | before/after zoomed 2×, nothing sold, 36% + 9%, goal hit, busy day + scrolled, pressed, updating, tiny sale | Hero, GoalStrip, top bar, tokens (mint, navy) | Yes: **GoalBar** (`src/ui/GoalBar.tsx`). It replaces three copies of one bar; nothing is added. |

## Code changes planned

Severity order. One rule, one place: the line states, their words and their colours live in `src/core/buyer/rules.ts` (`lineState`, `WORD`, a new `TONE`), and both apps read them.

| ID | Sev | File / function | Change (one line) | UI? | Acceptance check |
|---|---|---|---|---|---|
| BUY-1 | High | `core/buyer/supabase/read.ts readRaw` | Also read `cancel_asks` with `status = 'sent'` (quiet: none before 0181) | no | The Buyer's books carry #0604's open ask |
| BUY-1 | High | `core/buyer/types.ts`, `supabase/rows.ts orderOf` | `BOrder.hold: { at, by, why } \| null` from the open ask (the asker's display name) | no | — |
| BUY-1 | High | `core/buyer/rules.ts liveOrders` | A held order is not live: `lineRefs`, `askGroups`, `replyRows`, `tiles`, `tripPlan`, `toBuy` all leave it out (one filter); new `heldOrders(b)` | no | With an open ask, To ask, the tiles, To buy and Checking's money exclude it |
| BUY-1 | High | `core/buyer/supabase/buy.ts runsToGo` | Skip an order with an open ask (runs are what trips are made from) | no | The order is never in a new trip's lines |
| BUY-1 | High | `apps/buyer/orders/rules.ts checking`, `List.tsx`, `Order.tsx`, `parts.tsx` | Held orders last, under "On hold", in the grey row with the pill and Ruth's face and no act; the order's amber hold card; its lines without acts; head count and money without them | yes | Board XR1Hold phones 2–3 |
| BUY-1 | High | `apps/buyer/today/rules.ts waitingOn` | Ruth waits on a hold: "Ruth · #0560 cancel" | yes | Board XR1Hold phone 4 |
| BUY-1 | High | `apps/buyer/suppliers/One.tsx`, `trip/StopCard.tsx` | A held line is locked on a supplier's page. On a trip already running, its count starts at 0 with "Cancel asked · don't buy" | yes | Board states Disabled and Already on the trip |
| BUY-1 | High | `core/buyer/demo` | One held order in `?demo&state=midday` (#0560 Nansana) | no | e2e reads it |
| BUY-2 | Medium | `core/buyer/types.ts`, `rules.ts lineState`, `WORD`, `tiles` | New state `nosupplier` ("No supplier"; a line with no supplier and no Client waits). `tiles.suppliers` adds one per such line. `ontrip` counts stops, not lines | no | Today: To ask = the Ask rows; hero "1 of 2" with the hinge |
| BUY-2 | Medium | `apps/buyer/today/Today.tsx`, `Rows.tsx`, `Tiles.tsx` | Fix rows: No supplier (Pick → `openNotFound`) beside Not found. The section says "N suppliers". Needs you loses its number. "Every supplier asked" only with no rows. The To ask tile scrolls to Needs you and rings the first Ask row | yes | Board XR1Today phones 2–3; the tile count equals the Ask rows |
| BUY-2 | Medium | `apps/buyer/orders/rules.ts` STRIP, RANK; `NotFound.tsx` | `nosupplier` in the strip and the rank (red, with Not found); the sheet's head says "No supplier" | yes | Board XR1Today phone 4 |
| BUY-3 | Medium | `core/buyer/supabase/rows.ts lineOf`, `types.ts` | `ruthDecides` only when the line has a selling price; new `BLine.priceComing` (a price wait with no selling price, priceAsk) | no | #0606 reads To ask, not Price up |
| BUY-3 | Medium | `core/buyer/rules.ts tripPlan` | A Found line with `priceComing` is held off the trip ("Price coming") | no | Plan holds it; the cash leaves it out |
| BUY-3 | Medium | `apps/buyer/orders/List.tsx`, `Order.tsx`, `today/Rows.tsx`, `trip/Plan.tsx` | The "Price coming · Ruth" tag on the row, the line, the Ask row's chip and the held chip | yes | Board XR1PriceComing |
| SAL-1 | Medium | `core/supabase/rows.ts orderOf` | Read the Buyer's state of each supplier line through the Buyer's own `orderOf` + `lineState` (by the line's place in `items[]`), plus the time it was asked or answered: `Line.buy: { state, at } \| null`. No copy of the rule | no | A line the Buyer marks Found reads `found` in Sales' books |
| SAL-1 | Medium | `core/buyer/rules.ts` (`TONE`), `apps/buyer/orders/rules.ts` (PILL, INK read `TONE`) | One table of tones for both apps. The Buyer's three colour tables keep their colours, read from it | no | The Buyer looks as before (buyer-e2e unchanged) |
| SAL-1 | Medium | `apps/sales/orders/view.ts` (the Checking branch), `ui/CheckList.tsx` (word tones good, bad, neutral) | A supplier line shows the Buyer's word and mark. The false "the supplier said yes" goes. Bar and "N of M" count Found. The line flashes once when its word changes | yes | Buyer marks a line Found → Sales' order shows "Found · 10:52" within one 45 s refresh, without a reload |
| SAL-1 | Low | `apps/buyer/orders/rules.ts:18`, `today/rules.ts:19` | Delete both `hm` copies and use the shared `clock` ("9:40", decision #9) | yes (times) | Both apps write "Asked · 9:40" |
| SAL-1 | Medium | `core/demo/seed` (Sales) | The demo's supplier lines carry Buyer words (#0552's Wheelbarrow: Asked · 9:40) | no | Sales e2e |
| SAL-2 | Low | new `ui/GoalBar.tsx` (+ css); `ui/Hero.tsx` (hero + GoalStrip); `apps/sales/today/Today.tsx:103` | One bar: sold solid (none at 0, at least 4 px above), a 2 px gap, the move hatched. The three copies use it. The door "on the move" gets the hatch swatch | yes | At 0% sold with 3.2M on the move: no white at the start, nothing over "0%" at 360 px |

## Server / SQL changes planned

Migration **0182** (the next free number; reserved in `docs/decision-rights.md` in the Phase B commit).

| ID | Migration / function / policy | Change | Test |
|---|---|---|---|
| BUY-1 | `0182` trigger `collection_trips_ow_hold` (before insert, or update of `lines`) | A trip line whose `orderId` has an open cancel ask (`cancel_asks.status = 'sent'`) and was not on the row before is refused: "#0604 is on hold: Ruth decides the cancel first" (OWHLD). Lines already on the row stay (an ask after the cash). No role, task or push changes | `test/cancel-hold-db.test.js` (OW_PG): as a buyer, a new trip with a held line is refused; after Ruth declines it is accepted; a running trip's row keeps its held line on update; as the owner's console (no login), not judged |

## Glossary changes

| Term | Meaning | Replaces |
|---|---|---|
| To ask · Asked · Found · Not found · No supplier · Price up · Client waits · Removed | A supplier line's state, the same word and colour in the Buyer and in Sales (`core/buyer/rules.ts` WORD, TONE) | Sales "Order in" with a tick in Checking; "the supplier said yes" before any yes |
| No supplier | A line nobody sells us yet, with the customer not waiting for Sourcing. The Buyer picks one (red row, Pick) | counting it as To ask |
| Cancel asked · hold | Sales asked the Manager to cancel; the Buyer does not ask or buy until Ruth decides | — |
| Price coming (on the Buyer's side) | The same word as Sales: the line has no selling price yet; the Buyer still asks; Ruth prices it before it is bought | "Price up" for a line with no price |
| On the move (hatched) | On the goal bar: placed, not delivered. Hatched, never solid | a solid mint fill |

## Not changing / pushed back

| ID | Why |
|---|---|
| SAL-1 "Found <price>" | The price on a Found line is our cost, and Sales never draws cost (`Line.cost`: "never drawn"; decision rights: the Manager prices). Found shows its time instead. |
| SAL-1 "Asked <supplier>" | Sales reads no supplier table, and the customer is told the state, not the supplier. "Asked · 9:40" is what the Buyer already shows as "Grace sees". Adding the name means one more read for a word Sales can't act on. Say if you want it. |
| SAL-1 "live" | No realtime channel. Sales already re-reads every 45 s and on a push, which meets "without reload". A quiet `supplier.found` push (handover.md §6) is still open for a later round. |
| BUY-1 pushes | Smallest version: no new push. The Buyer's 60 s refresh shows the hold, and the trip guard stops a mistake. **Option B** (one more trigger in 0182): push the Buyer "#0604 on hold" when the ask is made while it is in Checking or Buying, and "Ruth kept #0604" on a no. Your call. |
| BUY-1 on a running trip | The line stays on the stop with its count at 0 ("don't buy"). Ruth cancels after the hand-in, because 0177 refuses a cancel on a live trip and that is right. |
| BUY-3 'under' | A line Sales priced under the shop's price also reads "Price up · Ruth decides" on the Buyer. It is a price wait too, but not one with no price. It is left as it is this round; see the question below. |

## Questions for Kevin

1. **Pushes for a hold (BUY-1)**: none (smallest), or Option B (the Buyer told when a cancel is asked and when Ruth keeps the order)?
2. **A line Sales priced under the shop's price**: the Buyer calls it "Price up · Ruth decides" and does not ask its supplier. Same fix as BUY-3 (ask the supplier, tag "Ruth decides the price")?
3. The two canvases give **#0550** two different orders (Sales: a walk-in with a cancel asked; Buyer: Kato Construction). The new boards use fresh numbers (#0560–#0562) to avoid it. Fix the old boards when either canvas is next touched?

## Cost

| | |
|---|---|
| Screens | 0 new. A state on Orders (On hold), a row on Today (No supplier), a tag, a pill on Sales' check list |
| Files | about 22 edited and 1 new part (`GoalBar`); 2 `hm` copies and 3 bar copies removed |
| Migrations | 1 (0182, one trigger) |
| Tests | 1 new db test; additions to `buyer-core`, `buyer-supabase-rows`, `buyer-e2e`, `sales-app`/sales e2e |
| Makes harder later | A fifth line word for both apps to keep in step (`nosupplier`). The single `TONE` table makes that one edit |

## Kevin's answers (11 Nov 2026)

"go ahead, with the hold pushes, and fix question 2 too":
1. **Hold pushes: yes** (Option B). 0182 pushes the Buyer `order.hold` on the ask and `order.hold.kept` on the Manager's no; drawn on `XR1Hold` (two push states) before it was built.
2. **A line Sales priced under the shop's price: fixed the same way as BUY-3.** It is asked like any line, with the tag "Ruth decides the price"; a Found one waits off the trip until Ruth decides. One rule covers both (`rows.ts priceTagOf`): the Manager's "Price up" is now only a cost over the selling price. Drawn on `XR1PriceComing` (a second row of states) before it was built.
3. #0550 on the two older canvases: not touched (no answer given; still open).

## Changed while building (drawn again on the canvas, v52)

- **BUY-2, the way into Orders.** The To ask tile was Today's main door to the Checking list, so making it scroll left Orders with no door from Today. "On the move" now has a labelled door, **"Checking 3 ›"**, that opens Orders; its number is the list's number (orders), and the word on it keeps it from reading as a supplier count. The bare "3 orders" is gone. `XR1Today` phones 2, 3 and 5 redrawn.
- **BUY-1, where the hold count sits.** A "1 on hold" chip in the Orders head clipped the "#0550 Buying" chip at 360 px, so the count moved onto the "On hold 1" divider. A held line's tile shows the pause mark. On a supplier's page a held line is left out (it is never in an ask) rather than drawn locked. `XR1Hold` redrawn (phone 2, Disabled, Empty: "Nothing in Checking", the tab's own words).
- **The padded clock.** There were three copies of "09:40" (`orders/rules.ts`, `today/rules.ts`, `suppliers/parts.tsx`), not two. All three are gone and every Buyer time uses the shared `clock` ("9:40", decision #9).
- **The demo.** The three cases are their own demo state, `?demo&state=handoff`, so `midday` keeps the figures the older boards pin ("3 of 5 suppliers found").

## Phase B result

| ID | Done? | What changed | How verified |
|---|---|---|---|
| BUY-1 | yes | The Buyer reads open `cancel_asks` (`read.ts`). `BOrder.hold` (`rows.ts holdsOf`, the asker's display name). `liveOrders` leaves a held order out, so To ask, the tiles, To buy, the Plan and Checking's money all leave it out (one filter), and `runsToGo` never sees it (`booksOf`). Orders lists it last under "On hold N" (`orders/Held.tsx`: grey row, "Cancel asked · hold", Ruth's face, no act). The order opens on the amber hold card, with its lines without acts and "Grace sees: Cancel asked". Today puts Ruth in "Waiting on others" with "#0560 cancel". Plan shows a held row. On a running trip its lines start at 0, "Cancel asked · don't buy" (`StopCard`). A tapped push opens the order (`native.ts`). New icon `pause`. **0182**: `collection_trips_ow_hold` (OWHLD) and `cancel_asks_ow_push_buyer` (`order.hold`, `order.hold.kept`, to `trip.plan`, only in Checking or Buying) | `test/cancel-hold-db.test.js` on Postgres 16 (OW_PG): 23 cases as the buyer, Grace, Ruth and no login, plus 0182 run twice. `buyer-core` (handoff demo: held, out of To buy 3,500,000, not ready for Buying). `buyer-supabase-rows` (an open ask holds, a decided one doesn't; the books' planned trip drops it). At 360: Orders, the held order |
| BUY-2 | yes | New line state `nosupplier` "No supplier" (red) in `lineState`, `WORD`, `TONE` and the Orders strip and rank. `tiles()` counts suppliers only: On the trip counts stops, and a line with no supplier is one supplier still to find. Today: a red "No supplier · Pick ›" row (the Not found row), Pick opens the Not found sheet ("Use" the list's supplier, or Client waits). Needs you has no number. "Every supplier asked" shows only with nothing to ask, pick or fix. The To ask tile scrolls to Needs you and rings the first Ask row. The "Checking N ›" door opens Orders | `buyer-core`: the tile's To ask equals the Ask rows, "3 of 7" with the hinge. `buyer-e2e`: the Checking door opens Orders on All 3. At 360: Today, the Pick sheet |
| BUY-3 | yes | `BLine.priceTag` (`'coming'` for priceAsk or no selling price, `'decides'` for under the shop's price or no shop price; `rows.ts priceTagOf`). `ruthDecides` (Price up) only when the cost is over the selling price. A tagged line is asked as usual; Found waits in `tripPlan().held` and `readyForBuying` stays false. The tag "Price coming · Ruth" / "Ruth decides the price" shows on the Orders row, the order's line, the Plan's held lines and the Today trip card (`heldWord`, `priceTagWord`) | `buyer-supabase-rows`: priceAsk → coming, under → decides, cost over sell → none, decided → none; a priceAsk line reads To ask. `buyer-core`: #0561 To ask, Katwe in Needs you, Found → held "Price coming · Ruth", order stays in Checking. At 360: the order |
| SAL-1 | yes | `core/buyer/sales.ts buyerWords(row)`: the Buyer's own `orderOf` + `lineState`, state and time only (no cost, no supplier). Sales' `readBooks` puts it on `Line.buy`. `orders/view.ts buyPill`: in Checking a supplier line shows the Buyer's word as a pill in the Buyer's colours (one `TONE` table in `core/buyer/rules.ts`, which the Buyer's `PILL` now reads too) and the mark it means. The false "the supplier said yes" tick is gone. The bar is red for Not found and the summary counts Found. A changed word flashes the row green once (`Order.tsx flashed`; off with reduced motion). `CheckList` takes `pill` and `flash`. Demo #0551: "Asked · 9:40" | `buyer-supabase-rows`: buyerWords for To ask / Asked / Found / shelf / stale terms / past Buying, no cost or supplier. `sales-orders`: #0551's pill and ring, every word and colour, no tick without a word. `e2e:sales` 13/13. At 360: #0551 |
| SAL-2 | yes | New `ui/GoalBar.tsx` (P02c): sold solid (none at 0, at least 4 px above), a 2 px gap, the move hatched. Used by the hero, `GoalStrip` and the scrolled top bar, so the three copies are gone. The "on the move" door carries the hatch swatch as its key (`HeroDoor.swatch`) | At 360: Today 36% + hatch, first day 0% (nothing white), busy-day strip. `ui-parts`, `e2e:sales` |
