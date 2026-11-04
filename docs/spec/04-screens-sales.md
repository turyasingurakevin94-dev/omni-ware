# 04 · Screens — Sales

What this covers: every screen of the Sales app, and the questions still open on them.
Date: 2026-10-29
Status: **screens decided** (the approved canvas). **Questions open** (§3): until Kevin answers, the new app builds what the canvas draws, which is the default listed beside each one.

---

## 1. The screens are the canvas

The approved canvas is "Sales — in the agent app's language" (https://claude.ai/artifact/SwqWmXv4c2KbB1zgErYsWQ). Its source is in [`docs/canvas/sales-agent/`](../canvas/sales-agent/README.md).
- It has 149 boards: 147 phone screens at 360 × 800, plus the two parts boards.
- Every board scored at least 8.5 out of 10 on fidelity, show-don't-tell, fewest steps, polish and Sales rules, in an independent audit on 29 Oct 2026 (`review/`).

| Tab | Prefix | Boards | Main flows (taps before → after) |
|---|---|---|---|
| Today | TD | 25 | 32 → 21 |
| Chats | CH | 19 | 36 → 26 |
| Sell (the red +) | SL | 31 | 91 → 40 |
| Counter | KC | 19 | 66 → 51 |
| Orders | OR | 25 | 51 → 46 |
| Customers | CU | 28 | 39 → 31 |
| Parts | Main, Main2 | 2 | — |

| Where the rest lives | File |
|---|---|
| The design language: parts P01–P29, the Sales-only parts S01–S10, and the tokens | `LANGUAGE.md` |
| The sample shop every board draws; the demo mode is seeded from it | `FACTS.md` |
| The rules each screen follows: links, words, money, 360 px, 44 px | `BRIEF.md` |

**Proof that the app matches.** [`docs/audit/sales/CANVAS-PARITY.md`](../audit/sales/CANVAS-PARITY.md) lists one row per board. Each row has:
- the board beside the app at 360 × 800, with the app reached by taps from Today;
- the difference between them;
- the verdict of an independent critic.

## 2. A screen the canvas does not draw

The app sometimes needs a state, sheet, error, empty view or step that the canvas does not draw. When it does:
- it is **drawn first** with `/design` on the same canvas, in the same language;
- it is then scored by the tab's critic, and needs at least 8.5 on every axis;
- only then is it built.

Nothing is improvised in code.

## 2a. Rules a board's figures follow

Where a board's sample figures disagree with `FACTS.md` and the seed, the board is corrected, not the data (the lead's ruling, 30 Oct 2026).

| Board | Rule | Where it lives | Source |
|---|---|---|---|
| CH33 · "Who served Kato this year" | Per person: the messages they sent in the customer's chat (`chat_served`), and the orders they took for this customer this year (`payload.takenBy`, not voided or cancelled), with the orders' total. Only the Sales team's order takers count orders: a Manager's order is never Sales' serving, even when she wrote in the chat (Ruth's #0498). Biggest total first; the bar is each total's share. | `src/core/chats.ts` `servedThisYear` | `sales.html:10455-10460` (PAGE.chatcust: `chat_served` messages, `takenBy` orders and totals, any role); the lead's ruling, 30 Oct 2026 (orders taken, Sales only); migration `0170` (`chat_served`) |
| CH21, CH34, CH36 · "Often with it" | P13's rule only: what came with "it" in this customer's orders when they have had it twice or more, else in mine; the top two by how many of those orders had each ("2 of 5"), less what the sheet shows already; the header says whose orders ("in Kato's orders", "in your orders"). On the sheet, "it" is the last of their usual ticked that they have had twice or more, else the first of their usual that they have, counted in their own orders. Searching, "it" is the item found first. Kato's sheets: Wheelbarrow, heavy duty 2 of 5, Tile glue 1 of 5 (CH21). The hinge Kato had once: in your orders, Iron sheet G28 and the wheelbarrow, 1 of 1 (CH34). An item with no price ("Price coming") is asked of the Manager from its own row: a team note "@Ruth the price of …? For Kato." | `src/core/often.ts` `oftenWith` (the one rule; Sell's P13 reads it too) | `agent.html:8890` oftenWith (theirs when twice or more, else mine; counts); `LANGUAGE.md` P13 (the top rows by count, "in Kato's orders"); the lead's ruling, 30 Oct 2026 (the top two only; CH34 opened on an item with no price; "For Kato") |
| CH08 · searching the chats | The search finds a chat by the person's name, the customer's name or the number (3 digits or more), and by **any message** in the chat, not only the last: every message the phone holds (the newest 500 across the shop, as `sales.html:4059` loadWA reads them; an older one needs a search on the server, not built). A hit shows the sentence that holds the word, marked, at its own time; the chats keep Mine's order. | `src/apps/sales/chats/List.tsx` `SearchView` | the lead's ruling, 30 Oct 2026 (every message); `sales.html:9922` (the old search: names and number only); CH01's field "Name, phone or what they said" |
| CH09 · a number with no chat | A typed number (9 digits or more) with a chat opens that chat; with none, "Message this number · opens WhatsApp" opens WhatsApp on this phone (`wa.me`), because the shop's number can only write to someone who wrote in the last 24 hours. A customer with no chat opens WhatsApp the same way. | `src/apps/sales/chats/NewChat.tsx` | `sales.html:9970-9977` (chatNewListHTML: "a new chat opens in WhatsApp on this phone"); open question Q11 |

## 3. Open questions (Kevin)

Each row names the default being built until Kevin answers.

| # | Question | Default being built | Source |
|---|---|---|---|
| Q1 | Who connects the shop's WhatsApp number? No role in `decision-rights.md` holds this job. | CH06 shows "connected", with no name | `manifest/chats.json` |
| Q2 | May Sales change the delivery fee that the app fills in, or is that the Manager's call, like a price? | Sales may edit it (SL17) | `manifest/sell.json` |
| Q3 | Is loading charged per bag, at 20 bags × 500? Is anything else on the order loaded free? | Per bag (SL16) | `manifest/sell.json` |
| Q4 | What is the one word for an order not placed yet: "basket", "draft" or "Still open"? | "Still open" | `manifest/sell.json` |
| Q5 | May Sales edit the items while an order is in Checking? | No: greyed, "Ruth changes items in Checking" (OR17) | `manifest/orders.json` |
| Q6 | Is the transaction ID for a mobile money payment required? | Required (CU33). The old app treats it as optional. | `manifest/customers.json` |
| Q7 | Do counter sales count toward the salesperson's goal? | No ("Today at the counter", no ring) | `manifest/counter.json` |
| Q8 | May Sales see the searches that found nothing for them (TD20)? | Yes, their own searches only | `manifest/today.json` |
| Q9 | Should "To collect" (1,910,000, which includes 125,000 still being checked) be called "Owes"? | "To collect", with "Being checked" shown apart | `manifest/today.json` |
| Q10 | When an item is not in stock: Moses finds the cost, Ruth prices it at Checking, then Denis buys it. Is that order right? | That order ("Price coming") | `manifest/sell.json` |
| Q11 | How far apart may two identical orders be and still be the same order entered twice? Orders' rule allowed 10 minutes, Customers' and Today's 5. Should a copy also need the same invoiced state (Orders' rule did)? | One rule (`core/orders.ts` `twinOf`, `isCopy`): 5 minutes, the same person, customer and lines (and variant), both invoiced or both not. Every seeded pair is a minute apart, so no board moves. | `src/core/orders.ts`; the integration pass, 3 Nov |
| Q12 | Which notes does "They gave" offer? Two rules disagreed. FACTS' tender rule (the counter, KC03): the next 5,000 and the next 10,000 above the total (52,000 → 55,000 / 60,000; 420,000 → 425,000 / 430,000). Customers' Take payment drew the next half and whole of the leading place (420,000 → 450,000 / 500,000 on CU35-CU37), which fits a big debt paid in big notes. | FACTS' rule, in `core/money.ts` `likelyNotes`, on both screens. CU35, CU36, CU37, CU41 and CU42 are corrected to it: Kato gives 430,000 for 420,000, 10,000 over (was 500,000, 80,000 over). | `src/core/money.ts`; `Pay.tsx`'s `notesFor` (removed); the integration pass, 3 Nov |
| Q13 | A customer or number with no open chat: Grace writes from her own WhatsApp (`wa.me`, as today), or the shop sends its reply template from the shop's number (one way, as CH13 does for a shut chat)? | Her own WhatsApp, as today (CH09) | `sales.html:9970`; chats critic, 30 Oct |

Smaller notes from the designers are in each `manifest/<tab>.json` under `open_questions`. Examples:
- Mama Shine is not yet in `docs/canvas-cast.md`;
- counter tender notes start at the next likely note (52,000 → 55,000 / 60,000).

## 4. Rules the boards draw but do not state

Each rule is written once in code (the place is named) and comes from the source given. A board that disagrees with one of these is corrected to it.

### 4.1 Today

| Rule | Where in code | Source |
|---|---|---|
| **Packing late.** An order 2 days or more in Packing is late. One late order shows on the Packing tile (the late dot) and on its own order. The Needs-you row is the batch ask ("ask Musa in one message"), so it appears only when 2 or more are late. | `today/data.ts` `packingLate`, `tiles`, `needs` | Lead ruling, 30 Oct 2026 |
| **Stage-tile faces.** Late orders first, then the newest. On the road: first out first (who arrives first). Each customer once. Up to three faces; past three orders, two faces and "+n" for the orders not shown. | `today/data.ts` `tiles` | Lead ruling, 30 Oct 2026 (TD01) |
| **Promises on To collect.** A promise shows when it is due today and still open, or when its day has passed and it was not kept. A promise for a later day is not shown there (it is on the customer's own screen). Kept, broken or open is worked out every time. | `today/data.ts` `promiseToShow`; `core/money.ts` `promiseState` | spec 02 §5.6 and Q10; lead ruling, 30 Oct 2026 |
| **A Take pays named bills.** Every Take opens `customers/pay` with the bills it pays. Past 21 days: the bills past the hold. With an order held for the money: every bill and that order. A charge that names no order (an opening balance) goes as `debt`, so a Take pays all it says. A bill Accounts is checking is never included (Ggaba: #0521 without the 125,000 of #0528). Play all runs the customers in order (`then`). | `core/owing.ts` `takeBills`; `today/data.ts` `takeOf` | Lead ruling, 30 Oct 2026; `ROUTES.md` |
| **Sells most.** The aisles with the most money sold this month so far, the most first. This counts the whole shop: every seller and the counter, invoiced orders only. On a month's first day, with nothing sold yet, last month's is used, and the label says "last month". | `today/data.ts` `sellsMost` | Lead ruling, 30 Oct 2026 (TD06, TD11) |
| **The shop's aisles.** Each aisle with how many products it holds (`Books.aisles`: products counted by category). Ordered by the money each sold this month, then by how many products. | `core/aisles.ts` `shopAisles`; `core/supabase/read.ts` `aislesOf` | FACTS §6 |
| **Aisles near a search that found nothing.** The aisle of the closest item comes first. Next come the aisles most often bought together with that item in the shop's orders. Then the shop's aisles, in the order above. | `core/aisles.ts` `nearAisles` (Today's Find, the Counter's Nothing called …) | Lead ruling, 30 Oct 2026 (TD14) |
| **An aisle open.** A tile or chip opens the aisle itself, never a word search: every item in it, the most sold first (its lines on orders not voided or cancelled), then by name. An item not priced yet is listed too, as "Price coming" (at the counter with no +1), so the count is the tile's (Roofing 86, FACTS). | `core/aisles.ts` `aisleItems`, `timesSold` (Sell's `sell/aisle`, the Counter's tiles and chips) | SL12; critic and lead, 4 Nov 2026 (KC01, KC21, KC25, KC26, KC28, KC29) |
| **An ask's aisle.** The aisle of its catalogue item: the ask's own item, or else the one item named like it. With no match it has no aisle; the aisle is never guessed from keywords. | `today/data.ts` `askAisle` | Lead ruling, 30 Oct 2026 |
| **Every ask opens.** Every ask of Sourcing opens its own screen (`today/asks { id }`), whatever its step. | `today/Asks.tsx`, `today/Ask.tsx` | Lead ruling, 30 Oct 2026 |
| **Every order row is a link** to its own order (`orders/order`). All order rows are one height: 49 px, or 65 px in Find. | `today/Day.tsx`, `today/Find.tsx` | Lead ruling, 30 Oct 2026 |
| **A send is never claimed if it did not happen.** If the customer has no chat, the app shows an error, and nothing is marked told. With no signal, the message is kept on the phone and the app says so. A photo goes only inside the 24-hour window: the reply template carries words only, and the toast says so. | `today/Tell.tsx` `sendTo`, `sentToast` | Lead ruling, 30 Oct 2026 (TD04, TD19, TD21, TD22) |
| **Alerts** are this phone's row in `push_subscriptions`. They are not a setting kept on the phone. The switch shows the real state, and when alerts cannot be on it says why. | `core/supabase/push.ts`; `today/local.ts` `setAlerts` | spec 06 §6a |

### 4.2 Who owes: one rule (`core/owing.ts`)

Today and Customers had two copies that disagreed (Today read the debt log, bill-named asks only; Customers read invoiced orders, and a balance ask checked every bill). The integration pass (3 Nov 2026) made one rule, the server's own (`ow_customer_balance`, 0169), and deleted both copies:

| | The rule | Code |
|---|---|---|
| What they owe | The opening balance (the debt log's lines that name no order: charges less everything else, as the server sums them) plus what each live invoice still owes (invoiced, not voided, total less paid); never below 0. A charge with no order still counts | `owingOf` |
| Their open bills | Those invoices, oldest first, and one **Opening balance** bill when the lines with no order still owe something. A Take names it `debt` in `customers/pay { bills }` (`takeBills`, `readBills`), so a Take pays all its label says | `owingOf`, `takeBills`, `readBills`, `billNo` |
| Being checked | An open ask to Accounts names the bill (`what: 'bill'`), or asks about the whole balance (`what: 'balance'`: every bill). A bill being checked is **shown apart**: it stays in what they owe (To collect 1,910,000 holds Ggaba's 125,000, Q9) but is never in a Take | `owingOf` (`checked`, `named`, `checkedIn`) |
| Apart | When the bills say more than the balance (money paid that named no bill) and Accounts checks the balance: the difference (Lubowa: bills 349,000, balance 0) | `owingOf` (`apart`) |
| Take now (Today) | The bills past the hold that nobody is checking | `take` |
| Can take (Customers) | What they owe less the bills an ask names | `canTake` |
| Oldest | The oldest open bill's age; past the hold when it is over the hold days | `age`, `pastHold`, `hold` |

Still apart from it: the credit hold at Checking (`money.ts` `creditHold`, spec 02 §5.4) ages the debt log (`oldestAge`), as the server's gate does (0174). In the sample shop both give the same days.

### 4.3 Rules the screens share

Each is written once in `src/core` and used by every tab that shows it.

| Rule | What it says | Source | Code |
|---|---|---|---|
| Last order | A customer's most recent order placed, not cancelled, voided, a test record or the copy of an order entered twice (Q11) | FACTS rule 1 | `core/customers.ts` `rhythm` |
| Due | Today is on or after last order + their usual gap ("every N days"). "Due today" at 0, "N days late" after | `sales.html:4674` (`r.due`) | `rhythm`, `dueWords` |
| Gone quiet | **More than twice** their gap since the last order (`since > every × 2`). A quiet customer is in its own group, never "Who's due" | `sales.html:4674` (`r.overdue`), `:6927` (`due && !overdue`) | `rhythm`, `dueCustomers` |
| Who's due order | The most owed first, then the most days late (Today lists the same people, the latest first) | KC04 (Mukono, Kyaligonza, Lubowa) | `dueCustomers`; Today, Chats (who is due soonest), Sell, Customers all read `rhythm` / `lastOrderOf` |
| Listening | One navy sheet (SL34): the mic, the waveform, what was heard, Say it again, one action. Today's Find hands the words to its search; Sell's Say it (SL10) holds the sheet to show what it understood | SL10, SL34 | `src/ui/Listen.tsx` `ListenSheet` |
| A count in a search | "2 paint", "paint 2" are 2 of paint; "forty sheets of G28" is 40 of G28 sheets; units are read ("20 kg wire nails 4\""); no count is 1. Said aloud, "and" splits the asks | KC02, SL08, SL10, SL15 | `core/find.ts` `readAsk`, `readSaid` (Sell's, which beat the counter's `readQuery`, 4 Nov) |
| Items a search finds | Items whose own name holds every word ("40 sheets" finds Iron sheet G28): the customer's own first, then this week's, then what fills the count best (on the shelf, order in, part, out). Only when no item's name does, the priced items of an aisle whose name holds them ("plumbing" lists the aisle; "paint" finds what is called paint: the lead's ruling, 4 Nov). The counter then keeps only what has a price | KC02, SL08 | `core/find.ts` `findItems` (and `closest`, `sameAsk`, `findCustomer`) |
| Often with | What came in the same orders as an item: across this customer's orders when they had it twice or more, else across mine (Today's Find, TD13: across the shop's, `me: null`); "4/5" is how many of the orders with the item had it | `agent.html:8890` (`oftenWith`) | `core/often.ts` `oftenWith` |
| The delivery fee | The shop's service with `kind: 'delivery'`, the one whose `area` is the customer's first; never guessed from a name (lead, 3 Nov; `sales.html:8351` guesses it from the name) | lead ruling | `core/services.ts` `deliveryFor` |
| A charge's amount | Percent: of the goods; fixed: its value; fixed with `per` ("bag"): its value for each one on the lines sold by that unit (Q3). No `per` or `kind`: a flat fee, as `sales.html` | `sales.html:8358`, Q3 | `core/services.ts` `serviceAmount` |
| The aisles offered | Five, by how many orders hold each aisle: the customer's own if one is chosen (the chips), else the seller's own (the tiles, SL03, SL31), then the shop's most-sold to fill | lead, 3 and 4 Nov (SL03, SL04, SL10, SL27, SL31, SL34) | `core/aisles.ts` `chipAisles` |
| Nothing called … | Every "Nothing called …" state shows three aisle tiles below the ask card: page content that may run under the dock. Their order is §4.1 "Aisles near a search that found nothing" | TD14; lead ruling, 4 Nov 2026 (KC21, KC25, KC26, KC28) | `core/aisles.ts` `nearAisles` |
| Likely notes | The next 5,000 and the next 10,000 above the total | FACTS tender rule | `core/money.ts` `likelyNotes` |

Open (Kevin): `test/sales-core-demo.test.js` counts gone quiet at **twice or more** (`>=`); `sales.html` at **more than twice** (`>`). The core follows `sales.html`; the sample shop gives 8 either way.
## 5. Rules the Orders screens follow (from the old app)

| Rule | Source | Built in |
|---|---|---|
| **Tell sends the order picture with the words as its caption** when "Order picture" is on and the chat's 24-hour window is open (one `wa-send` send-image, not two messages). The picture is drawn from the order's own lines: the shop's letterhead, ORDER #0552, each line with its state (not found struck, a new price beside the old one struck, "Price coming", "On the way"), then what is to pay. Never an invoice: Sales cannot raise one. With the window shut, the words go by SMS or open in WhatsApp typed (no picture). | `sales.html:6331-6410` (`ordDrawPicture`), `6474` (`waSendImage(conv.id, blob, text)`) | `src/apps/sales/orders/picture.ts`, `Tell.tsx` |
| **"Something else" to the Manager** is a team note on the customer's chat that mentions the Manager, so `wa_notes_push` (0170) pushes her. (The old app inserted an `'other'` invoice ask, which `invoice_asks` refuses; lead ruling 30 Oct: no migration.) | `sales.html:6221-6280`; 0170 | `Wrong.tsx` (OR26) |
| **Fix it on an owing bill asks Accounts.** A delivered, invoiced order with money paid on it and money still owed: the question is the money, so Fix it says "ask Esther" and opens the payment fix (one payment) or Which payment? (several). Any other delivered order opens Something wrong, and the Manager decides. | the canvas, OR24 (lead ruling 30 Oct) | `Order.tsx`, `view.ts` |
| **A paid-over payment** is the money a payment brought over what it cleared on its bills and its order. Sales asks Accounts to settle it as change (the default) or a deposit (`payment_asks` what `over`, 0165), and the choice is kept on the ask (`want`). | `sales.html:5745-5770` | `PaidOver.tsx` |
| **A return ask carries its lines.** Items coming back sends each line's place on the order, how many, its price and amount (`invoice_asks.lines` as `{idx, name, qty, price, amount}`), so the Manager reads which lines come back; the words go in `note` too ("Cement · Hima 50kg ×2"). The order screen and Tell read which line comes back from the ask's lines (else its note), never from the amount. | `sales.html:6279-6284` (`ordasksend`), `manager.html:5354` (reads `ask.lines` by `idx`); critic ruling 30 Oct (OR22) | `src/core/orders.ts` (`askLines`), `src/apps/sales/orders/data.ts` (`backLines`) |
| **A voided bill says so everywhere.** Its figure is struck with the bad-tone "Void" pill (LANGUAGE P23), it owes 0 with who voided it and when (`payload.voidedBy {by, at}`, 0176), there is no Take payment or Fix it, and Tell says it is struck out and nothing is owed; a copy entered twice names the bill that stands and what is left on it, and its picture says VOID, nothing owed. A number search for a voided copy lists the bill that stands beside it. | `supabase/migrations/0176_void_and_credit_note_one_write.sql` (voidedBy); critic ruling 30 Oct (OR29, OR30) | `src/apps/sales/orders/view.ts`, `msg.ts`, `picture.ts`, `data.ts` (`findOrders`) |
| **A stage an order went past is drawn skipped.** An order placed straight in Packing (all on our shelf) skips Checking and Buying; one Checking sends straight to Packing (both lines on our shelf, `0173` allows Checking → Packing) skips Buying. The rail shows the skipped disc and the word "skipped", never a borrowed time. A delivered order whose log lacks a stage takes the next stage's time instead. | `supabase/migrations/0173_stage_moves_need_their_task.sql`; critic ruling 3 Nov (OR11, OR31) | `src/apps/sales/orders/view.ts` |
