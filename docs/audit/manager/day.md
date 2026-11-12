# The Manager's day, rethought (12 Nov 2026)

Step 3 of `docs/audit/manager/GOAL.md`. The decisions and their words are in
`docs/audit/manager/handover.md` (D-1 … D-33, M-1 … M-38, the pushes P-1 …
P-13); this file is about the **day**: what Ruth does from the first push to the
last, which steps need to exist, and the shape the four tabs and the FAB give
it. Same method as `docs/audit/buyer/flow.md`. Counted from `manager.html` on
`claude/manager-round2`. `docs/decision-rights.md` stays as it is: nothing
here waits on the owner; the owner gets the log.

## The day, from first principles

Ruth's day is two things:

1. **A queue of decisions.** Somebody is waiting on each one: Grace with a
   customer on the phone, Musa with a truck at the gate, Denis at a supplier,
   Peter with his customer. The job is to see the ask, see the evidence, answer,
   and have the answer reach the asker in their own words. The queue's only
   order is *who has waited longest*, with "someone is standing there" (a
   counter sale, a truck waiting on "on credit?") first.
2. **Watching the shop.** Nobody is waiting, but Ruth must look: stuck orders,
   the team's goals, debtors, the stock's losses. Watching ends in a nudge, a
   hand-on, a chase or a rule (a limit, a goal), never in a queue of its own.

Everything else is the app's job: billing a delivered order, ending a goal,
telling the asker.

## Today: where each step lives

| Step | Where today (manager.html) | Taps |
|---|---|---|
| A push arrives | `pushOpen` (2300) routes 14 kinds to the page; `order.cancel.ask`, `store.extra`, `stock_count`, `payment.ask.decided` land on Today | 1 |
| Open the app | Today: hero (goal ring, Sales invoiced, Money in today), **Decide now** card with six tiles and "Start with the oldest" (4658-4673), Orders on the move, Needs you / Watch (2594-2655) | 1 |
| Find the decision | a tile, or "Start with the oldest", opens **PAGE.decide** (4683): Someone is waiting now · Orders waiting in Checking · After delivery · stock — a list, not the oldest | +1 |
| Open it | a row opens its page (price, approvals, creditask, invoices, shortpick, tripcount, writeoff, stocktake, return, void, cancelask, agentask, restock, dup) | +1 |
| See the evidence | on the page (the price ladder, the credit gauge, the line bars, the slip) | 0 |
| Answer | 1 button, or a stepper + Use this, or a slide; some ask a second step (limit → terms → go) | 1–4 |
| Back to the next | the page pops to Decide; the next row | +1 per decision |
| Watching | Today's featured stuck order, Needs you rows (stuck, nobody has it, taken twice, behind pace, over 30 days), the Orders tab with its stuck badge, Money (debtors, look alike, old books), Team | 1–3 each |
| Nudge | the red centre button, **Nudge** (navHTML 2380) → who → why → Open WhatsApp → send in WhatsApp | 5 |

Four tabs today: **Today · Team · [Nudge] · Orders · Money** (2375-2383). The
decisions have no tab: they are a card on Today and a page over it.

## Each step, asked three questions

| Step | Needed? | Merge? | Can the app do it? | Result |
|---|---|---|---|---|
| Push → Today for 4 kinds | no | — | route every kind to its card (M-1, M-2, M-3, M-16) | **1 tap from any push** |
| Decide now card → list → row | the list is needed for looking, not for deciding | the queue *is* the list, ordered by wait | the FAB opens the oldest decision itself, and each answer moves to the next | **Decide next** (FAB): 1 tap to the oldest; **0 taps to the next** |
| Six tiles (Prices, Credit, Invoices, Picks, Stock, Returns) | no as doors (a door per kind is a menu) | one queue strip by **who asks** (Sales · Store · Buyer · Accounts · Agents), each with its count and oldest age | — | one strip on Today, tap = filter the queue |
| Invoice a delivered order | no, it bills itself 24 h after delivery (decision-rights §3, `ow_invoice_due_orders`) | — | already does it; drop the `order.delivered` push (M-18) | **0** — only "can't bill itself" asks |
| Small invoice, given away, run skipped | yes, but each is the same card: "can't bill itself · why" | merge D-9, D-10, D-11 into one card with the answer for its why | the push names the why in words (M-34) | **2** |
| Credit: Release / Cash first / Keep held | two answers are enough | "Keep held" = no answer yet; "Old bill first" = Cash first with a reason | — | **On credit · Cash first** |
| Credit for a cash-only customer: limit → terms → go | yes, one fact: how much and how long | one chip row of suggested limits with terms in each ("500k · 14 d") | suggest the limit from the order (`limitChoices` 4108 already does) and the shop's usual terms | **1 tap** |
| Price: Set price → steppers → Use this | yes | the ladder's rungs (cost, Grace's, usual, shop's) are the answers | tap a rung to answer; the keypad only for another figure | **1 tap** |
| Price: tell the salesperson | yes | — | `price.decided` only when the price moved (M-27) | 0 |
| Short pick: pick → Bill | yes | the two options are the two buttons | — | **1 tap** |
| Trip difference + the Buyer's note: Seen + slide | yes, once | one answer closes both | — | **1 tap** (stock moves, no money: a tap with Undo, not a slide) |
| A yard note alone (no difference left) | no, nothing to decide | — | it goes in the trip's history and the log | **0** |
| Write-off: switches + slide | yes | default all on | add **Kept on the shelf** (M-5) | **1 slide** (money off the books) |
| Stock take: Stock tile → row → slide | yes | — | route the push (P-1) | **1 slide** |
| Return: qty, back/damaged, way, slide | yes | the ask already carries the lines and qty | default the way (off what they owe; cash back only on money paid) | **1 slide** |
| Void with money: Refund → account → Void → undo | yes | refund-and-account is one choice: **Refund cash · Refund MoMo · Refund bank · Keep as deposit** | — | **1 chip + 1 slide** |
| Cancel ask: Today → tile → row → Cancel | yes | — | route the push (M-1) | **1 slide** (2 with money) |
| Taken twice: row → pick → Void | yes | the row names which to keep (the later one is dropped by default) | cancel through `cancel_order` (M-20) | **1 slide** |
| Agent change: per line Agree, then Answer | yes | default all agreed | — | **1 tap** |
| Carton for the shelf | yes, when the Buyer asks | — | — | **1 tap** |
| Restock hold | rarely; nobody asks | in Orders, beside the restock list | — | **1 tap** |
| Customer edit + Tell Grace | yes | Save tells the salesperson by itself (`tell_customer_change`) | — | Save = told |
| Merge look-alikes | yes | pick + confirm → one slide naming who stays | — | **1 slide** |
| Goals: steppers + Save | yes, monthly | one suggested goal per person (last month's invoiced + the shop's growth) | `ow_end_targets` already ends them (0169); push the salesperson (P-10) | **1 tap** |
| Chase: row → debtor → WhatsApp → send | the chase is the salesperson's; Ruth's part is the nudge | the debtor row carries **Nudge {Grace}** | the nudge is a push with the words written (P-9) | **1 tap** |
| Stuck order: Nudge → who → why → WhatsApp → send | yes | the row names who holds it and the words | push, not WhatsApp (M-10) | **1 tap** |
| Markup of a new item | yes | — | push it (P-11); the card offers the shop's default | **1 tap** |

## The new shape

**Four tabs and one red move** (the Agent app's language,
`docs/audit/buyer/agent-design-language.md`: navy hero, warm body, one red
move; the Agent has two tabs + FAB, the Manager four):

```
 Today   Orders   ( Decide next • 7 )   Money   Team
```

### The FAB: Decide next

The red round button in the centre (64 px, the Agent's FAB) with a navy count
badge of everything waiting on Ruth. One tap opens **the oldest waiting
decision** as a full card: who asked (face, name, how long ago), what they
asked in their words, the evidence drawn (the ladder, the credit gauge, the line
bars, the slip), and the answers as buttons in the dock (a slide for the
irreversible money ones). Answering shows the answer in the asker's words with
Undo for 10 s ("Approved · Grace sees it"), then the next card slides in. The
queue is ordered by wait, with **someone standing there** first (a counter sale,
the truck waiting on "on credit?"). With nothing waiting the FAB shows a tick
and opens "Nothing waits · here is what to watch" (the three watch items of
Today). The Nudge moves onto the rows that need one and onto Team.

### Today: the queue and the watch

- **Hero (navy):** Sales invoiced this month against the shop's goal (the ring,
  as today), Money in today, and the queue as one bar coloured by who asks
  (Sales · Store · Buyer · Accounts · Agents) with the oldest wait. A tap on a
  colour opens Decide next filtered to that asker.
- **Someone is waiting now:** the counter sale and the truck, pinned, with the
  ring of how long they have stood there.
- **Watch:** three rows at most, each ending in its one move: the oldest stuck
  order (**Give it to Musa** / **Nudge Musa**), the salesperson furthest behind
  pace (**Nudge Grace**), the customers over 30 days (**See them** → Money).
- **Today's answers:** what Ruth decided and what the app did by itself
  (billed 6 orders, ended Brian's goal), the log in one list.

### Orders: the pipeline and the yard

- The five stages as tiles (Checking · Buying · Packing · On the road ·
  Delivered) with counts and the stuck badge; a row per order says who holds it
  and what it waits on, in the shared words (Needs a supplier, Price coming ·
  Ruth decides, Cancel asked …).
- Decisions that live here: D-1 to D-4 prices, D-5 to D-7 credit, D-8 to D-11
  "bills itself in 18 h" / "can't bill itself", D-12 packed short, D-20 cancel
  asked, D-21 taken twice, D-22 agents.
- **Stock** segment: D-13/D-14 check-ins, D-15 not on the list, D-16 losses,
  D-17 counts, D-23 restock list, D-24 cartons.

### Money: who owes, what changes a bill

- Debtors as aging bars (the bands of today), each row with Nudge {seller};
  promises as dots (kept, broken, due); customers over their limit.
- Decisions that live here: D-18 returns, D-19 voids, D-25/D-32 limits and
  credit asks, D-26 look-alikes, D-27 opening balances, D-28 promises, D-33
  markups (Margins).

### Team: the people

- Each person: face, goal ring and pace, who is in, what they hold now
  (packing, on the road, a trip), and **Nudge** / **Give a job**.
- Decisions that live here: D-29 goals (one suggested goal per person),
  stage limits and the hold days, D-31 assign and nudge.

## Every decision, the new path

"Open" is the tap on the push (or the FAB when it is next in the queue);
"Answer" is what Ruth taps; evidence costs no tap (it is on the card).

| ID | See the ask | See the evidence | Answer | Taps before → after |
|---|---|---|---|---|
| D-1 Under the shop's price | push `price.waits` → the card: "Grace · Kato · Roofing sheet at 200,000 · Under the shop's price" | the ladder: cost 168,000 · Grace's 200,000 · usual 205,000 · shop's 210,000, each with its margin | tap **Approved** (or a rung: **Price set · 205,000**, **Shop's price**) | 2 → **2** (Set price 5 → 2; another figure 3) |
| D-2 Price coming | push → card "Price coming · 3 m roofing sheet" | the cost (or "no cost: type it"), the shop's markup, what Kato usually pays | tap **Price set · 210,000** (cost + markup, the suggested rung) | 4 → **2** |
| D-3 Price up | push → card "Price up · now costs 215,000, sells at 200,000" | was · sells · new cost bars, the loss per line | tap **Shop's price · 269,000** or a rung | 5 → **2** |
| D-4 Counter sale | push → card pinned "At the counter · Grace · 1:20" | shop's price struck, Grace's price, margin | tap **Approved** / **Shop's price** | 2 → **2** |
| D-5 On credit? (limit or old bill) | push `credit.hold` → card with the chip **Over the limit** / **Old bill · 34 days** | the limit gauge and oldest-bill ring (as today), promises dots, "usually pays in 18 d" | tap **On credit** / **Cash first** | 2 → **2** |
| D-6 On credit? (no limit set) | push → card, chip **No limit set** | the order, what they have bought before, NEW badge | tap one chip **On credit · 500k · 14 d** (or **Cash first**) | 5 → **2** |
| D-7 Not paid yet · on credit? (the Store) | push `credit.ask` → card pinned "Musa · the truck waits" | as D-6 | tap **On credit · load it · 500k · 14 d** / **Cash first · it stays** | 5 → **2** |
| D-8 Invoice | nothing to see: Orders shows "Delivered · bills itself in 18 h" | — | none (optional **Invoice now**, 2) | 2 → **0** |
| D-9 Only 567 · check it | push `invoice.held` → card "Can't bill itself · Only 567" | the slip | tap **Bill it** (or Fix the order) | 3 → **2** |
| D-10 A line at 0 | push → card "Can't bill itself · a line at 0" | the line, its cost | tap **Given away · {why chip}** (or **Price coming**) | 5 → **2** |
| D-11 Run skipped (price, short pick) | the underlying card | — | the underlying answer | +0 (as today) |
| D-12 Packed short | push `pick.short` → card "Musa packed 4 of 6" | the line bars, both bills side by side | tap **Bill what went · 184,000** / **Bill it all · 276,000** | 2 → **2** (bill it all 3 → 2) |
| D-13 Check-in differs | push `trip.difference` → card "Musa's check-in of Denis's trip" (+ Denis's note on it) | per line Denis → yard bars, the difference at cost, the trip cash | tap **Take the check-in** (Undo 10 s) | 2 → **2** (with a note 3 → 2) |
| D-14 Denis's note alone | in the trip's history, no card | — | none | 2 → **0** |
| D-15 Not on the list · keep it? | push `store.extra` → card "Musa · 2 bags cement on the truck" | on the shelf now, last price paid, any order short of it | tap **Keep it** / **It goes back** | not possible → **2** |
| D-16 Damaged · 3 roofing sheets | push `stock.report` → card | the item, its shelf, the cost of the loss | slide **Write off · 504,000** / tap **Kept on the shelf** | 2 → **2** (kept: not possible → 2) |
| D-17 A count to check | push `stock.count` (P-1) → card "Musa · Aisle B · 2 differ" | the grid of agree/differ, net at cost | slide **Count taken** / tap **Count it again** | 4 → **2** |
| D-18 Return asked | push `invoice.ask` → card "Grace · 2 roofing sheets back · damaged" | the slip with the lines, "owes 1,034,000 → 950,000" | slide **Credit note raised · 84,000** / tap **Kept as sold** | 2 → **2** |
| D-19 Void asked | push → card "Esther · INV-0548 · entered twice" | the twin bill beside it, what they owe before → after, money paid | with money: chip **Refund cash** / **Keep as deposit**; slide **Voided · 430,000**; or tap **Kept as billed** | 2 → **2** (with money 4 → 3) |
| D-20 Cancel asked | push `order.cancel.ask` (routed) → card "Grace · #0558 · changed their mind" | stage, lines, money paid, "Musa puts back what was packed · Denis stops · Grace is told" | slide **Cancelled** / tap **Kept** | 4 → **2** |
| D-21 Taken twice? | the FAB queue (no asker) | the two slips side by side, minutes apart | slide **Cancel #0559 · keep #0558** / tap **Both are real** | 4 → **3** (app, FAB, slide) |
| D-22 Peter asks: fewer | push `agent.change` → card | each line before → after, the credit it leaves | tap **Agreed** (each line defaults to agreed; tap a line to keep it) | 2 → **2** |
| D-23 Restock: not yet | Orders → Stock → the restock list | weeks of shelf left per line | tap **Not yet** | 4 → **3** (app, Orders, Not yet) |
| D-24 A carton for the shelf? | push `carton.ask` → card | the order's part and the shelf's part, the cash | tap **Shelf part OK** / **Order only** | 2 → **2** |
| D-25 A customer's limit and terms | Money → the customer | owes, limit gauge, oldest bill, promises | tap a limit chip; **Save** (Grace told by itself) | 8 → **5** (app, Money, customer, chip, Save) |
| D-26 Look alike | Money → the look-alike card | the two records side by side, their bills | slide **Merge into Kato Construction** / tap **Not the same** | 6 → **4** |
| D-27 Opening balance | Money → old books → the customer | the old book's figure, since when | slide **Opening balance · 290,000** | ≈6 → **4** |
| D-28 Promise (Ruth's own) | Money → the debtor | dots of past promises | tap a day chip (amount defaults to what is owed); **Save** | 6 → **4** |
| D-29 Goals | Team | last month's invoiced per person, the suggested goal | tap **Use the suggested goals**; Save | 5 → **4** (app, Team, Use, Save) |
| D-30 Chase debtors | Today's watch row or Money | aging bars | tap **Nudge Grace** on the row (words written, P-9) | 5 → **3** (app, Money, Nudge) |
| D-31 Stuck order | Today's watch row | who holds it, over its limit by how much | tap **Give it to Musa** / **Nudge Musa** | nudge 5 → **2** (give 2 → 2; assign 4 → 2) |
| D-32 Credit asked (Grace / Esther) | push `credit.limit.ask` (P-12) → card | as D-25 | tap **Limit 500,000 · 14 d** / **Cash only** | not possible → **2** |
| D-33 A new item to price | push `markup.wanted` (P-11) → card | cost, rivals' prices, the shop's default markup | tap **Markup 25%** (or step) | 7 → **2** |

**In the queue** (several waiting, which is most of the day): today each next
decision costs **2** (the row, then the answer, after the page pops back to the
list); with Decide next it costs **1** (the answer; the next card comes by
itself).

## Totals

The primary answer of each decision; "—" = not possible today.

| ID | Today | New | | ID | Today | New |
|---|---|---|---|---|---|---|
| D-1 | 2 | 2 | | D-18 | 2 | 2 |
| D-2 | 4 | 2 | | D-19 | 2 | 2 |
| D-3 | 5 | 2 | | D-20 | 4 | 2 |
| D-4 | 2 | 2 | | D-21 | 4 | 3 |
| D-5 | 2 | 2 | | D-22 | 2 | 2 |
| D-6 | 5 | 2 | | D-23 | 4 | 3 |
| D-7 | 5 | 2 | | D-24 | 2 | 2 |
| D-8 | 2 | 0 | | D-25 | 8 | 5 |
| D-9 | 3 | 2 | | D-26 | 6 | 4 |
| D-10 | 5 | 2 | | D-27 | 6 | 4 |
| D-12 | 2 | 2 | | D-28 | 6 | 4 |
| D-13 | 2 | 2 | | D-29 | 5 | 4 |
| D-14 | 2 | 0 | | D-30 | 5 | 3 |
| D-16 | 2 | 2 | | D-31 | 5 | 2 |
| D-17 | 4 | 2 | | D-33 | 7 | 2 |
| **30 decisions** | | | | **Sum** | **115** | **70** |
| D-15, D-16 kept, D-32 | — | 2 each (6) | | Each next in the queue | 2 | 1 |

Second choices that also drop: Set price 5 → 2, Bill it all 3 → 2, a check-in
with the Buyer's note 3 → 2, a void with money 4 → 3, a cancel with money 5 → 3,
Assign 4 → 2.

**Not fewer, at the floor (1 to open + 1 to answer from the push):** D-1
Approve, D-4, D-5, D-12 went, D-13, D-16, D-18, D-19, D-22, D-24. These gain
only in the queue (2 → 1 each next) and from the app (4 → 2 with the FAB in
place of tile + row). A push that answers from the notification itself would
make them 1, but the evidence would not be seen: not proposed.

## Steps removed or automated

- **Removed:** the four pushes that open Today instead of their ask (M-1, M-2,
  M-3, M-16); the six tiles as doors and the Decide list as a step (the FAB
  opens the oldest; the list stays for looking); "Back to the next row" (the
  next card comes by itself); "Keep held" and "Old bill first" (two credit
  answers); the limit → terms → go steps (one chip); Set price → steppers →
  Use this (a rung is the answer); "Seen" on a yard note (it closes with the
  check-in, or goes to the trip's history); the confirm step of a void with
  money (the refund chip names the account); "Tell Grace" after a customer edit
  (Save tells); WhatsApp for a nudge (a push with the words written).
- **Automated:** the invoice 24 h after delivery, with no push to the Manager
  (it waits on nobody; `invoice.held` only when it can't); goals ended on their
  day (`ow_end_targets`, already) and a suggested goal per person; the asker
  told in their own words for every answer (P-2 … P-8, P-10); `price.decided`
  only when the price moved; the twin order cancelled through `cancel_order`
  so the yard and Grace are told; a check-in note closed with its check-in;
  the next decision offered by itself.
- **Kept as a slide** (irreversible money or books): write-off, stock take,
  credit note, void, cancel, merge, opening balance. Prices, credit, short
  picks, check-ins, extras, cartons and agents are taps with Undo 10 s.
