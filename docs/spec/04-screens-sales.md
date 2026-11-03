# 04 · Screens — Sales

What this covers: every screen of the Sales app, and the questions still open on them.
Date: 2026-10-29
Status: **screens decided** (the approved canvas). **Ten questions open** (§3): until Kevin answers, the new app builds what the canvas draws, which is the default listed beside each one.

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
| **A Take pays named bills.** Every Take opens `customers/pay` with the bills it pays. Past 21 days: the bills past the hold. With an order held for the money: every bill and that order. A bill Accounts is checking is never included (Ggaba: #0521 without the 125,000 of #0528). Play all runs the customers in order (`then`). | `today/data.ts` `takeOf` | Lead ruling, 30 Oct 2026; `ROUTES.md` |
| **Sells most.** The aisles with the most money sold this month so far, the most first. This counts the whole shop: every seller and the counter, invoiced orders only. On a month's first day, with nothing sold yet, last month's is used, and the label says "last month". | `today/data.ts` `sellsMost` | Lead ruling, 30 Oct 2026 (TD06, TD11) |
| **The shop's aisles.** Each aisle with how many products it holds (`Books.aisles`: products counted by category). Ordered by the money each sold this month, then by how many products. | `today/data.ts` `shopAisles`; `core/supabase/read.ts` `aislesOf` | FACTS §6 |
| **Aisles near a search that found nothing.** The aisle of the closest item comes first. Next come the aisles most often bought together with that item in the shop's orders. Then the shop's aisles, in the order above. | `today/FindItems.tsx` `nearAisles` | Lead ruling, 30 Oct 2026 (TD14) |
| **An ask's aisle.** The aisle of its catalogue item: the ask's own item, or else the one item named like it. With no match it has no aisle; the aisle is never guessed from keywords. | `today/data.ts` `askAisle` | Lead ruling, 30 Oct 2026 |
| **Every ask opens.** Every ask of Sourcing opens its own screen (`today/asks { id }`), whatever its step. | `today/Asks.tsx`, `today/Ask.tsx` | Lead ruling, 30 Oct 2026 |
| **Every order row is a link** to its own order (`orders/order`). All order rows are one height: 49 px, or 65 px in Find. | `today/Day.tsx`, `today/Find.tsx` | Lead ruling, 30 Oct 2026 |
| **A send is never claimed if it did not happen.** If the customer has no chat, the app shows an error, and nothing is marked told. With no signal, the message is kept on the phone and the app says so. A photo goes only inside the 24-hour window: the reply template carries words only, and the toast says so. | `today/Tell.tsx` `sendTo`, `sentToast` | Lead ruling, 30 Oct 2026 (TD04, TD19, TD21, TD22) |
| **Alerts** are this phone's row in `push_subscriptions`. They are not a setting kept on the phone. The switch shows the real state, and when alerts cannot be on it says why. | `core/supabase/push.ts`; `today/local.ts` `setAlerts` | spec 06 §6a |

### 4.2 Open: two copies of "who owes" (Kevin)

Today and Customers both answer "what does this customer owe, bill by bill, and what is being checked". The two copies disagree, so neither has been picked:

| | Today (`core/owing.ts` `owedBy`) | Customers (`customers/data.ts` `billsOf`, `moneyOf`) |
|---|---|---|
| Where the bills come from | The debt log, payments clearing the named bill and then the oldest (`openCharges`, spec 02 §5.3) | Invoiced orders with something left on them (`orderOwes`) |
| Which bills are being checked | Only a bill an ask names (`what: 'bill'`) | That, plus every bill when an ask is on the whole balance (`what: 'balance'`) |
| What can be taken now | Bills past the hold that nobody is checking | All they owe, less the bills an ask names |

Until Kevin answers, each tab keeps its own copy. The one he picks moves into `core/owing.ts`, and the other copy is deleted.

## 5. Rules the Orders screens follow (from the old app)

| Rule | Source | Built in |
|---|---|---|
| **Tell sends the order picture with the words as its caption** when "Order picture" is on and the chat's 24-hour window is open (one `wa-send` send-image, not two messages). The picture is drawn from the order's own lines: the shop's letterhead, ORDER #0552, each line with its state (not found struck, a new price beside the old one struck, "Price coming", "On the way"), then what is to pay. Never an invoice: Sales cannot raise one. With the window shut, the words go by SMS or open in WhatsApp typed (no picture). | `sales.html:6331-6410` (`ordDrawPicture`), `6474` (`waSendImage(conv.id, blob, text)`) | `src/apps/sales/orders/picture.ts`, `Tell.tsx` |
| **"Something else" to the Manager** is a team note on the customer's chat that mentions the Manager, so `wa_notes_push` (0170) pushes her. (The old app inserted an `'other'` invoice ask, which `invoice_asks` refuses; lead ruling 30 Oct: no migration.) | `sales.html:6221-6280`; 0170 | `Wrong.tsx` (OR26) |
| **Fix it on an owing bill asks Accounts.** A delivered, invoiced order with money paid on it and money still owed: the question is the money, so Fix it says "ask Esther" and opens the payment fix (one payment) or Which payment? (several). Any other delivered order opens Something wrong, and the Manager decides. | the canvas, OR24 (lead ruling 30 Oct) | `Order.tsx`, `view.ts` |
| **A paid-over payment** is the money a payment brought over what it cleared on its bills and its order. Sales asks Accounts to settle it as change (the default) or a deposit (`payment_asks` what `over`, 0165), and the choice is kept on the ask (`want`). | `sales.html:5745-5770` | `PaidOver.tsx` |
| **A return ask carries its lines.** Items coming back sends each line's place on the order, how many, its price and amount (`invoice_asks.lines` as `{idx, name, qty, price, amount}`), so the Manager reads which lines come back; the words go in `note` too ("Cement · Hima 50kg ×2"). The order screen and Tell read which line comes back from the ask's lines (else its note), never from the amount. | `sales.html:6279-6284` (`ordasksend`), `manager.html:5354` (reads `ask.lines` by `idx`); critic ruling 30 Oct (OR22) | `src/core/orders.ts` (`askLines`), `src/apps/sales/orders/data.ts` (`backLines`) |
| **A voided bill says so everywhere.** Its figure is struck with the bad-tone "Void" pill (LANGUAGE P23), it owes 0 with who voided it and when (`payload.voidedBy {by, at}`, 0176), there is no Take payment or Fix it, and Tell says it is struck out and nothing is owed; a copy entered twice names the bill that stands and what is left on it, and its picture says VOID, nothing owed. A number search for a voided copy lists the bill that stands beside it. | `supabase/migrations/0176_void_and_credit_note_one_write.sql` (voidedBy); critic ruling 30 Oct (OR29, OR30) | `src/apps/sales/orders/view.ts`, `msg.ts`, `picture.ts`, `data.ts` (`findOrders`) |
