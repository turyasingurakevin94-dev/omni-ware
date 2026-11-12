# Sales app (`sales.html`): UX audit

*22 October 2026. Run against the real `sales.html` in `tools/sales-harness/` (the fake Supabase with the sample shop), with Playwright at 390×844. Every screen judged here was screenshotted and looked at. No app code was changed.*

**How it was tested**

- **The nine workflows** were walked end to end with real taps, typing and slides on visible elements. The tap counts below come from those runs.
- **A crawler** opened 28 starting points (the 5 tabs, 15 pages and 8 sheets). On each one it tapped every visible control, each in a fresh page, and recorded what changed: the screen, the sheet, a toast, a write, an RPC. That was **143 taps with 0 page errors.** Every tap flagged "no change" was then checked by hand (see area 3).
- **Offline**: the browser was cut mid-sale and then reconnected.
- **Contrast** was measured from the app's CSS tokens.
- **Decision rights**: each check was made against `docs/decision-rights.md`. The look was compared with the Sales design canvas.

Screenshots are in [`sales-ux-audit/`](sales-ux-audit/).

---

## Ratings

| # | Area | Score | Why, in one line |
|---|---|:-:|---|
| 1 | Premium look | **7 / 10** | One confident system (navy, cream and signal red, receipts on paper, mono figures) that matches the canvas. A few screens are over-decorated or thin, and the grey small print is too faint for daylight. |
| 2 | Shortest workflows | **8 / 10** | Most jobs take 3–7 taps, and the counter sale is excellent. The biggest saving left: the WhatsApp request is shown but not turned into lines. |
| 3 | Dead or unfinished controls | **8 / 10** | 143 taps produced no dead button and no error. What is left is a few rows that look tappable but are not, a disabled "PDF", and a self-contradicting "Open bills 0" card. |
| 4 | Ease of use for a busy seller | **7 / 10** | Strong error prevention: slide or double-tap, the cost floor, the 10× check, offline waiting, drafts kept, "Take back". It is let down by low contrast, small type, icon-only buttons and one duplicate-order trap. |
| 5 | Wording | **6 / 10** | Warm and plain in tone, but the same money goes by 7+ names, "client" and "customer" are mixed, stages are named two ways, and there are unit and plural slips. |

## Top 10 fixes (highest value first)

| # | Fix | Where | Kind |
|:-:|---|---|---|
| 1 | **"Ask Sourcing" keeps the quantity.** Typing `12 tile adhesive` sends the name *"12 tile adhesive"* with **How many = 1**. The search had already read 12 as the count. | `ACT.srcask`, `sales.html:9350` → [61](sales-ux-audit/61-ask-sourcing.jpg) | Defect |
| 2 | **Don't offer "Take the order" when the customer already has one open.** Kato's hero card says *Wants to buy → Take the order* while #2402 (the same 40 sheets and 2 wheelbarrows) sits in Checking. The Chats list knows about it (it shows an "Order #2402 · Checking" chip), but Today and the new-order page don't. | `viewToday` hero (the `ask` card skips `chatLiveOrder`) → [01](sales-ux-audit/01-today.jpg), [81](sales-ux-audit/81-take-order-from-chat.jpg) | Defect (risk of a duplicate order) |
| 3 | **Make the small print readable in daylight.** `--ink3 #767F91` is 3.7:1 on the page background (it needs 4.5:1), and 185 rules use 9–11 px text. Use the existing `--ink2 #5F6980` (5.1:1) for the small text instead, and set a 12 px floor for anything a seller must read. | CSS tokens, everywhere | Accessibility |
| 4 | **Turn the WhatsApp request into lines.** "Take the order" opens with the message quoted and an empty order. The search already understands "40 sheets", so offer *+40 Iron sheet G28* and *+2 Wheelbarrow* as one-tap chips. That saves about 4 taps on the most common order. | new-order page → [81](sales-ux-audit/81-take-order-from-chat.jpg) | Workflow |
| 5 | **One name per money idea.** Today the same money is called *Owes*, *Billed, not paid*, *to collect*, *Outstanding balance*, *Left to pay*, *still owed*, *Open bills* and *Billed · owes*. Use **Owes** for a customer, **Left to pay** for one order, and **Bill** for an invoice everywhere. | Customers, customer page, Pay, Paid, Order | Wording |
| 6 | **Don't let the hero ring mean two things.** With no goal set, the ring beside "This month 7,965,996" shows *71%* = the share of orders gone out, which reads as goal progress. The Goal page meanwhile says *"Ruth hasn't set a sales goal yet"*, and it counts invoiced sales (4,999,996), not sold ones. With no goal, show "No goal yet" and a delivery bar instead. | Today hero → [01](sales-ux-audit/01-today.jpg), [99](sales-ux-audit/99-goal.jpg) | Clarity |
| 7 | **One source for "what they owe".** The customer page ages the debt from the debt log and says *Open bills 0 · 420,000 no date*. On the same data the Pay page lists *INV-2370 + INV-2380 + 4,002 not on a bill*, and its meter says *"pays 4,002 of 420,000 · owes 415,998 after"* while the slider records 420,000. The cause is the harness data (invoices with `debtCharged 0` and no debt-log rows), so check it with real data. Either way, two screens shouldn't reach the same figure from different sources. | customer page vs Pay → [40](sales-ux-audit/40-customer-kato.jpg), [41](sales-ux-audit/41-pay-all-owed.jpg) | Verify / robustness |
| 8 | **Label the icon-only buttons.** The bookmark is *Keep as draft*, the picture toggle is *Send a picture of the order*, *PDF* is the **statement**, and *Again* is **Sell again**. The rotated **NOT PAID** stamp is the only way into a payment from the order, and its "TAP TO TAKE PAYMENT" is 9 px. | new-order dock, customer page, order page → [13](sales-ux-audit/13-order-two-lines.jpg), [90](sales-ux-audit/90-order-delivered.jpg) | Learnability |
| 9 | **One customer page, one rule for the main button.** Kato gets *Owes + Open bills card + "Sell to Kato Construction"*. Kyaligonza (owes 0) gets *Billed · owes 0 + "Take a payment"* as the red main button. Nansana gets *"Sell them their usual"*. Pick a single layout, and drop the jargon chips *6/12 days* and *0/1 days*. | customer page → [40](sales-ux-audit/40-customer-kato.jpg), [43](sales-ux-audit/43-customer-kyaligonza.jpg), [44](sales-ux-audit/44-customer-nansana.jpg) | Consistency |
| 10 | **Item rows in Today's Find should do something.** "Hima cement 50kg · 120 on shelf · 35,500" looks like every other tappable row but does nothing. Tapping it should start a counter sale or add it to the open order. | `tdyfind` sheet → [71](sales-ux-audit/71-today-find-item.jpg) | Dead end |

---

## 1. Premium look: 7 / 10

**What works.** The app is one design system: a navy hero, cream ground, white cards with soft shadows, signal red for the one main action, and IBM Plex Mono for every figure. The **receipt-paper** motif (zig-zag edges, a "DRAFT" stamp) makes orders feel physical, and the **counter-done** and **payment-in** screens feel rewarding. The live screens follow the design canvas closely: the Today hero, "Needs you", the order-placed stage strip, the counter dock with "They gave / Change", and the void side-by-side.

**Weakest screens, worst first**

| Screen | Problem | Improvement |
|---|---|---|
| **Add a customer** [20](sales-ux-audit/20-add-customer.jpg) | Four layers say the same thing: the title "Add them in three", a "0/3" counter, a preview card with checkboxes, and then the form. Two **info tiles** ("Cash to start · credit from Ruth", "A fresh order · drafts stay kept") look like buttons but do nothing. The number comes before the name. | Put the name first and the number second, keep the preview card but drop the 0/3 counter, and turn the tiles into one quiet line under the buttons. |
| **The aisles** [97](sales-ux-audit/97-aisles.jpg) | The category "icons" are two-letter initials (**RO, CE, NA, PA, TO**), and "NA" reads as *not applicable*. | Use real line icons (sheet, bag, nail, tin, spanner). The rest of the app already draws icons. |
| **Customer page** [40](sales-ux-audit/40-customer-kato.jpg) | Styled as a sheet (it has a drag handle) but it is a page. The "Open bills 0" card has an empty grey bar above the only figure. The "6/12 days" chip is unexplained. The layout changes from customer to customer (fix 9). | One layout: owes on the left, the credit bar, the bills as rows, then Promise and Take payment, and Sell as the main button. |
| **Today hero** [01](sales-ux-audit/01-today.jpg) | The ring's meaning changes (fix 6). "This month" and "Today" show the same figure in the harness. The first card ("Tell Kyaligonza the new price") wraps its title onto two lines *and* repeats "Tell them" as a pill and as the main button. Only about 2½ items fit above the + button, and the fourth card is half hidden under it. | Keep the first card compact (as in the canvas's Main: one big card, then slim rows), drop the duplicate pill, and leave bottom padding so the last row clears the + button. |
| **Order page stamp** [52](sales-ux-audit/52-order-checking.jpg) | A rotated rubber stamp is the payment button. It is clever, but its 9 px rotated text fails in daylight, and it doesn't look like a control. | Keep the stamp as decoration and put a real "Take payment · 1,858,000" button beside "Tell them". |
| **Order placed** [15](sales-ux-audit/15-order-placed.jpg) | Good, but the buttons fade in about 1 s after the confetti, so a fast tap lands on nothing. | Show the buttons at once and animate only the tick. |

**Consistency notes**

- **Closing** works three ways: a **✕** on the new order, a **‹** on the counter and in chats, and a ✕ plus a drag handle on page-sheets. Pick one rule: ‹ for a page, ✕ for a sheet.
- **The new-order dock** changes shape while you search. "Slide to place" becomes a grey "Review" button ([12](sales-ux-audit/12-search-40-sheets.jpg)) and then comes back. Keep one dock.
- **A toast** ("Kireka Hardware Ltd added") sits on top of the "+177,500" delta pill. Raise toasts above the dock.

## 2. Shortest workflows: 8 / 10

| Workflow | Path walked | Taps | Screens | Where to cut |
|---|---|:-:|:-:|---|
| Order for an existing customer | + → Lubowa → type "40 sheets" → Add → Usual chip → slide | **6** | 3 | Recent customers sit 4th in the sheet, under the WhatsApp card and "Due for their usual". Fix 4 cuts orders that come from a chat. |
| New customer, then sell | + → New customer → number → name → area → Save and sell → item → Add → slide | **9** | 4 | Fine. Typing the number first already catches duplicates. |
| Counter sale with change | + → Counter sale → Hima → +1 → Ridge caps → "100,000" → slide → **Give back 11,000** | **7** | 3 | Excellent. Optional: a long-press on + to open the counter directly (saves 1 tap, many times a day). |
| Take a payment on a bill | Customers → Kato → Take payment → slide | **4** | 3 | From Today's "Says they paid · Record" it is **2**. A part payment adds the typed amount. |
| Tell a customer their order is ready | Orders → Packing → order → Tell → slide → (send in WhatsApp) | **5 + 1** | 3 | Today has no "packed → tell them" item. It prompts only for *On the road* and *not found*. Add one when an order reaches Packing (or ready for collection). |
| Ask Sourcing for an item we don't sell | + → customer → type → "We don't sell it · ask Sourcing" → Send | **5** | 3 | **Only reachable inside an order or the counter.** "Asked of Sourcing" (on Me and Today) lists requests but has no "Ask for something" button, so a customer who only asks a question can't be logged. Also fix 1. |
| Find an order | Orders → search → type | **3** | 2 | Today's 🔍 finds orders too (2 taps). Show recent orders before anything is typed: the sheet is empty until you type ([70](sales-ux-audit/70-find-order.jpg)). |
| Reply to a WhatsApp chat | Chats → Kato → type → Send | **4** | 2 | A suggested reply chip fills the box in 1 tap. From Today's chat icon it is 3. |
| Void / credit-note request | Orders → Done today → order → Something wrong… → This invoice shouldn't exist → Ask Ruth | **6** | 3 | Clear and correct (Ruth decides, Accounts sees, Take back). A duplicate invoice could be offered on Today ("#2412 and #2413 look the same"), since the void sheet already finds the twin. |

## 3. Dead or unfinished controls: 8 / 10

The crawl tapped all 143 visible controls on 28 starting points: **no page errors, no click that threw, no missing handler.** Every `data-act` in the markup has a handler, except `back`, `closesheet` and `tab`, which the global click handler deals with. Each "no change" the crawl flagged was checked and is benign: a tab that was already selected, a minimum quantity, "Tell Ggaba" handing over to WhatsApp, a suggestion written into the text box, or "Save" refusing an empty name with *"Type their name"*.

What is left:

| Screen → control | What happens | Improvement |
|---|---|---|
| Today 🔍 → an **item** row | Nothing; it isn't a button ([71](sales-ux-audit/71-today-find-item.jpg)) | Fix 10. |
| Customer (owes 0) → **PDF** | Disabled, with no reason given ([43](sales-ux-audit/43-customer-kyaligonza.jpg)) | Hide it, or say "Nothing to put on a statement". |
| Customer → **Open bills 0** card | It shows an amount owed under a count of 0 ([40](sales-ux-audit/40-customer-kato.jpg), [44](sales-ux-audit/44-customer-nansana.jpg)) | Fix 7. |
| Add a customer → **"Cash to start" / "A fresh order"** tiles | They look like buttons but do nothing | Make them text. |
| Order placed → **Next sale / Open the order / Today** | Faint and not ready to tap for about 1 s | Show them at once. |
| Statement sheet | It lets you send a statement showing **Balance due 0** while the customer owes 420,000 (it does warn) ([45](sales-ux-audit/45-statement.jpg)) | Hold "Send" until Accounts settles the mismatch, or ask a second time. |

## 4. Ease of use for a busy seller: 7 / 10

**Strong**

- **Error prevention.** A single tap on a slide only nudges and says *"Double-tap or slide"* ([35](sales-ux-audit/35-slide-one-tap.jpg)). Below cost is refused (*"Too low — that's under what it costs the shop"*, [96](sales-ux-audit/96-price-under-cost.jpg)). Under the shop's price says *"Ruth, your manager, decides — the order waits in Checking"* ([95](sales-ux-audit/95-price-under-shop.jpg)). A price 10× the shop's asks *"Yes, 355,000 / Make it 35,500"*. Leaving a half-built order keeps it (*"Lubowa's order is kept · carry on from the + button"*).
- **Offline** ([34](sales-ux-audit/34-counter-offline.jpg)). A banner reads *"No connection · prices from 18:42 · lines kept"*, and the slider reads *"Back online to sell"*. Nothing is queued blind, and it recovers by itself.
- **Feedback.** Toasts name who was asked (*"Sent to Moses — you'll see it in Asked of Sourcing"*). The payment-in and counter-done screens show the change and the receipt. Asks carry *"Take back"*.
- **Decision rights are respected everywhere tested.** Sales proposes and the Manager (Ruth) decides prices, voids and credit. Accounts sees money questions. Nothing waits on the owner. The Me page shows the locks: *"Prices under the shop's, credit and invoicing: Ruth decides"*.

**Weak**

1. **Daylight legibility**: fix 3. Grey text at 3.7:1, a lot of 9–11 px caps, and mono figures at 11 px.
2. **Icon-only controls** (fix 8). A new seller can't guess the bookmark, the picture toggle or "PDF".
3. **Duplicate-order trap** (fix 2).
4. **The unit is shown as "pc" or "piece" for everything.** Cement shows *"5 pcs"* and *"5 piece = 170,000"* ([95](sales-ux-audit/95-price-under-shop.jpg)), iron sheets show *pc* on the order but *sheet* in search, and search says *"120 pieces on shelf"* for bags. Use the product's unit, with correct plurals.
5. **Ambiguous day chips** on Promise: `T 22 · F 23 · S 24 · S 25 · M 26 · T 27 · W 28` ([46](sales-ux-audit/46-promise.jpg)). The two S's and two T's look alike in daylight. Use *Sat* and *Sun*.
6. **Telling the customer twice.** When Ruth changes a price on an order that is also ready, there are two separate messages ("the new price", then "ready"). Fold the price change into the status message.

## 5. Wording: 6 / 10

The tone is consistently warm, plain and second-person ("Nice one, Grace", "Ruth decides", "you'll see what's found"). The problems are naming drift:

| Concept | Names in use (where) | Use |
|---|---|---|
| Money a customer owes | *Owes* (customer page), *Billed, not paid* (Customers header), *Billed · owe 3* (filter), *to collect* (area rows), *Outstanding balance* (Paid), *Left to pay* (Pay), *still owed* (messages), *Open bills* (customer page), *Billed · owes* (Kyaligonza) | **Owes** / **Left to pay** |
| The person buying | *Customer* (tab, search, sheets) vs **Client** (*"Client name or order number"*, *"Type a client's name or an order number"* in Find an order) | **Customer** |
| Taking money | *Take payment* (Kato), *Take a payment* (Kyaligonza, order), *Record* (Today), *Slide to record* | **Take payment** on buttons, **Record** only on the slide |
| Stage 4 | *On road* (Orders chip, the step list) vs *On the road* (stage label, aria) | **On the road** |
| Last stage | *Done today* (Orders chip) vs *Delivered* (badges) | **Delivered today** |
| Selling again | *Sell to Kato Construction*, *+ Sell*, *Sell them their usual*, *Again*, *Sell to … again* | **Sell** + the customer's first name |
| Statement | *PDF* (button) vs *Statement* (chat chip, sheet) | **Statement** |
| The buyer | Ruth and Moses are named, but the Buyer is *"the buyer is on it"* / *"With the Buyer"*, never *Denis* | Name Denis, as the others are |
| Opaque labels | *6/12 days*, *0/1 days* (customer), *Names a day* (chat tag), *Read as ×40 sheets* (search), *Whole-shop figures* (Me, which then shows 7.97M as if it were Grace's) | Spell them out, or drop them |
| Grammar and units | *"5 piece = 170,000"*, *"120 pieces on shelf"* for cement bags, *"1 line · 1 item"* | Use the product unit, with plurals |

---

## What the fake data can't show (not judged)

- **Cash / Credit on an order.** The harness sets `creditPct 0`, so the toggle (with *"Credit · no limit"*) never draws.
- **Sent WhatsApp messages.** The stub doesn't store them, so a sent reply disappears. That's the stub, not the app.
- **Money in after a counter sale.** The stub's `counter_sale` writes no cash line, so Today's *"420,000 in"* didn't move after an 89,000 cash sale ([33](sales-ux-audit/33-today-after-counter.jpg)). Confirm this against the real RPC.
- Push notifications, haptics, camera and photo proof, the native share sheet, a Manager's answer arriving, a supplier's price rising, a short pick, multi-variant products, and a goal that has been set.

**Harness data that should be fixed so later audits are trustworthy**

- The names don't match `docs/canvas-cast.md`: *Grace Namubiru (GN)* instead of Grace Akello (GA), *Roofings Ltd / Nsubuga Tools* instead of the cast's suppliers, and Kyaligonza placed in Mukono.
- Every order's `createdAt` is "2 hours ago", so *This month = Today*, and orders from 4 and 16 October show under **Done today** ([98](sales-ux-audit/98-day.jpg)).
- Invoiced orders have `debtCharged: 0` and there are no `customer_debt_log` rows. This is what produces the disagreement in fix 7.

## Screenshot index

| | | | |
|---|---|---|---|
| [01 Today](sales-ux-audit/01-today.jpg) | [02 Orders](sales-ux-audit/02-orders.jpg) | [03 Customers](sales-ux-audit/03-customers.jpg) | [04 Chats](sales-ux-audit/04-chats.jpg) |
| [05 Me](sales-ux-audit/05-me.jpg) | [10 Who is it for](sales-ux-audit/10-plus-who-for.jpg) | [11 New order](sales-ux-audit/11-new-order-empty.jpg) | [12 "40 sheets"](sales-ux-audit/12-search-40-sheets.jpg) |
| [13 Two lines](sales-ux-audit/13-order-two-lines.jpg) | [14 Line open](sales-ux-audit/14-line-open.jpg) | [15 Placed](sales-ux-audit/15-order-placed.jpg) | [20 Add customer](sales-ux-audit/20-add-customer.jpg) |
| [21 Filled](sales-ux-audit/21-add-customer-filled.jpg) | [30 Counter](sales-ux-audit/30-counter-empty.jpg) | [31 Change](sales-ux-audit/31-counter-change.jpg) | [32 Sold](sales-ux-audit/32-counter-done.jpg) |
| [33 Today after](sales-ux-audit/33-today-after-counter.jpg) | [34 Offline](sales-ux-audit/34-counter-offline.jpg) | [35 One tap](sales-ux-audit/35-slide-one-tap.jpg) | [40 Kato](sales-ux-audit/40-customer-kato.jpg) |
| [41 Pay](sales-ux-audit/41-pay-all-owed.jpg) | [42 Paid](sales-ux-audit/42-paid.jpg) | [43 Kyaligonza](sales-ux-audit/43-customer-kyaligonza.jpg) | [44 Nansana](sales-ux-audit/44-customer-nansana.jpg) |
| [45 Statement](sales-ux-audit/45-statement.jpg) | [46 Promise](sales-ux-audit/46-promise.jpg) | [47 Pay from order](sales-ux-audit/47-pay-from-order.jpg) | [50 Packing](sales-ux-audit/50-order-packing.jpg) |
| [51 Tell](sales-ux-audit/51-tell-sheet.jpg) | [52 Checking](sales-ux-audit/52-order-checking.jpg) | [60 Nothing found](sales-ux-audit/60-search-nothing.jpg) | [61 Ask Sourcing](sales-ux-audit/61-ask-sourcing.jpg) |
| [62 Asked of Sourcing](sales-ux-audit/62-asked-of-sourcing.jpg) | [70 Find order](sales-ux-audit/70-find-order.jpg) | [71 Find item](sales-ux-audit/71-today-find-item.jpg) | [80 Chat](sales-ux-audit/80-chat.jpg) |
| [81 From chat](sales-ux-audit/81-take-order-from-chat.jpg) | [90 Delivered](sales-ux-audit/90-order-delivered.jpg) | [91 Void](sales-ux-audit/91-void-ask.jpg) | [92 Asked](sales-ux-audit/92-void-asked.jpg) |
| [95 Under shop](sales-ux-audit/95-price-under-shop.jpg) | [96 Under cost](sales-ux-audit/96-price-under-cost.jpg) | [97 Aisles](sales-ux-audit/97-aisles.jpg) | [98 Day](sales-ux-audit/98-day.jpg) |
| [99 Goal](sales-ux-audit/99-goal.jpg) | | | |
