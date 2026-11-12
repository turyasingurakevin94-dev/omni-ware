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
| Credit for a cash-only customer: limit → terms → go | yes, one fact: how much and how long | one chip row of suggested limits with terms in each ("1.5M · 14 d", "2M · 14 d", "3M · 30 d") | suggest the limit from the order (`limitChoices` 4108 already does) and the shop's usual terms | **1 tap** |
| Price: Set price → steppers → Use this | yes | the ladder's rungs (cost, Grace's, usual, shop's) are the answers | tap a rung to answer; the keypad only for another figure | **1 tap** |
| Price: tell the salesperson | yes | — | `price.decided` only when the price moved (M-27) | 0 |
| Short pick: pick → Bill | yes | the two options are the two buttons | — | **1 tap** |
| Trip difference + the Buyer's note: Seen + slide | yes, once | one answer closes both | — | **1 tap** (stock moves, no money: a tap with Undo, not a slide) |
| A yard note alone (no difference left) | no, nothing to decide | — | it goes in the trip's history and the log | **0** |
| Write-off: switches + slide | yes | default all on | add **Kept on the shelf** (M-30) | **1 slide** (money off the books) |
| Stock take: Stock tile → row → slide | yes | — | route the push (P-1) | **1 slide** |
| Return: qty, back/damaged, way, slide | yes | the ask already carries the lines and qty | default the way (off what they owe; cash back only on money paid) | **1 slide** |
| Void with money: Refund → account → Void → undo | yes | refund-and-account is one choice: **Refund cash · Refund MoMo · Refund bank · Keep as deposit** | — | **1 chip + 1 slide** |
| Cancel ask: Today → tile → row → Cancel | yes | — | route the push (M-1) | **1 tap** (Nothing paid: Undo 10 s, not a slide); with money **2** (still a slide) |
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
 Today   Orders   ( Decide next • 8 )   Money   Team
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
  order (**Give it to Moses** / **Nudge Denis** for #0554), the salesperson furthest behind
  pace (**Nudge Faith**), the customers over 30 days (**Nudge Grace**; Money for the rest).
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

## Two ways to one tap

Opening a page to press one button is the step most decisions can lose. Two
ways, used together:

1. **Answer on the row.** Every row in Today's Needs you and every card in the
   Decide-next queue carries its evidence in one line (the figure that decides
   it: "cost 27,000 · sells 26,000 · 10 pcs", "36 of 40 packed · 1,710,000",
   "would owe 3,690,000") and the **one safe answer** as a button on the row
   (Approve · Bill what went · On credit · Keep it · Take the check-in · Agreed
   · Shelf part OK …). One tap answers; Undo 10 s stays on the row. Opening the
   card is only for another answer (a rung on the ladder, Bill it all, Cash
   first) or a closer look. **From the app: 1 tap to open + 1 to answer.**
2. **Answer from the push.** The push carries the evidence in its title and
   body (an expanded Android notification shows 2–3 lines, so the evidence is
   read before the tap) and the same one safe answer as a **notification action
   button**. One tap answers from the lock screen; the notification turns into
   "Approved · Undo" for 10 s before anything is sent, and the app shows it
   with Undo when it next opens inside that window. The answer goes through
   one server function that re-checks the ask (someone else answered first →
   "Someone else just did this"). **From the push: 1 tap.**

**Never a notification action:** an irreversible money or books move — a
write-off, a credit note, a void, a refund, a stock take, a merge, an opening
balance, a cancel with money. They keep the slide on the card (or on the row). Their push
still carries the evidence and offers only the **safe "keep" answer** as an
action (Kept on the shelf · Kept as sold · Kept as billed · Count it again ·
Kept). What that needs is handover.md §6 (native changes) and §4 (the words
and the actions of each push).

## Every decision, the new path

"From the push" starts at the tap on the push (today: only when `pushOpen`
routes it; an unrouted push lands on Today and costs the app path). "From the
app" starts at the tap that opens the app: today + the Decide-now tile + the
row + the answer; new = the answer on the Needs-you row (or the FAB card) — or,
for a slide, the row's slide. "—" = no push exists for it (today) or none is
needed (new). Evidence costs no tap.

| ID | See the ask (push words or row) | Evidence (on the push / the row) | The answer (★ = notification action) | From the push: before → after | From the app: before → after |
|---|---|---|---|---|---|
| D-1 Under the shop's price | "Grace · Under the shop's price · #0555" | "Iron sheet G28 · 46,000, shop's 47,500 · cost 38,000 · 30 sht" | ★ **Approve 46,000** (rung or Shop's price on the card) | 2 → **1** | 4 → **2** |
| D-2 Price coming | "Brian · Price coming · #0553" | "Y12 rebar 12 m · 20 pcs · cost 31,000 + 25% = 38,750" | ★ **Set 38,750** | 4 → **1** | 6 → **2** |
| D-3 Price up | "Denis · Price up · #0552" | "Ridge cap 3 m · cost 27,000, sells 26,000 · 10 pcs" | ★ **Shop's price 33,750** (another rung on the card) | 5 → **1** | 7 → **2** |
| D-4 Counter sale | "Grace · At the counter · under the shop's price" | "Cement 50 kg · 10 bags at 40,000, shop's 42,500 · cost 34,000" | ★ **Approve 40,000** | 2 → **1** | 4 → **2** |
| D-5 On credit? (over / old bill) | "Grace · On credit? · Kyaligonza & Sons" | "Old bill 38 d (held at 21) · owes 2,310,000 · would owe 3,690,000" | ★ **On credit** (Cash first on the card) | 2 → **1** | 3 → **2** |
| D-6 On credit? (no limit set) | "Faith · On credit? · Mukono Roofing" | "No limit set · #0552 1,287,500 · would owe 2,501,500" | ★ **On credit · 3M · 30 d** | 5 → **1** | 6 → **2** |
| D-7 Not paid yet · on credit? | "Musa · Not paid yet · on credit? · #0551" | "Nansana Hardware · owes 0 · 1,240,000 · no limit set · 1st order on credit · truck waits" | ★ **On credit · load it · 1.5M · 14 d** (2M · 14 d, 3M · 30 d on the card) | 5 → **1** | 6 → **2** |
| D-8 Invoice | — (bills itself; Orders: "Delivered · bills itself in 18 h") | — | none (Invoice now, optional) | 2 → **0** | 3 → **0** |
| D-9 Only 567 · check it | "Can't bill itself · Only 567 · #0561" | "Walk-in · 1 line · 567 · Grace's counter sale" | ★ **Bill 567** | 3 → **1** | 4 → **2** |
| D-10 A line at 0 | "Can't bill itself · a line at 0 · #0563" | "Brian's · 2 packs Wall plugs at 0 · cost 3,000" | the why is a choice: on the card, **Given away · {why chip}** | 5 → **2** | 6 → **2** |
| D-11 run skipped | the underlying push (e.g. #0562 Mukono Roofing · Cement 425,000 · price coming) | — | the underlying answer | as D-1/2/12 | as D-1/2/12 |
| D-12 Packed short | "Musa · Packed short · #0550" | "Iron sheet G28 36 of 40 · bill 1,710,000 (full 1,900,000)" | ★ **Bill what went 1,710,000** | 2 → **1** | 4 → **2** |
| D-13 Check-in differs | "Musa · Check-in differs · Denis's trip" | "Owino Plumbing · PVC pipe 4 in 11 of 12 · −28,000 at cost" (Denis's early trip, back 09:10; + "Denis: 12 went on the truck at Owino.") | ★ **Take the check-in** | 2 → **1** | 4 → **2** |
| D-14 Denis's note alone | — (the trip's history) | — | none | 2 → **0** | 4 → **0** |
| D-15 Not on the list | "Musa · Not on the list · keep it?" | "2 bags Cement 50 kg on Denis's trip · Nakawa · 2 × 34,000 = 68,000 at cost" | ★ **Keep it** (It goes back on the card) | — (no screen) → **1** | — → **2** |
| D-16 Damaged · write off | "Musa · Damaged · 3 Cement 50 kg" | "on the shelf 26 → 23 · −102,000 at cost" | slide **Write off · 102,000** on the card; ★ only **Kept on the shelf** | 2 → **2** ✗ (kept: — → **1**) | 4 → **2** (the row's slide) |
| D-17 A count to check | "Musa · A count to check · Aisle B" | "12 items · 2 differ · net −12,000" | slide **Count taken**; ★ only **Count it again** | 4 → **2** | 4 → **2** |
| D-18 Return asked | "Brian · Return asked · #0547" | "5 Timber 2×4 · −56,250 · Lubowa owes 662,000 → 605,750" | slide **Credit note raised · 56,250**; ★ only **Kept as sold** | 2 → **2** ✗ (kept: 2 → **1**) | 4 → **2** |
| D-19 Void asked | "Esther · Void asked · #0545" | "Kato · 320,000 · entered twice with #0544 · 200,000 paid" (14:20) | slide **Voided · 320,000** (with money: chip, then slide); ★ only **Kept as billed** | 2 → **2** ✗ (with money 4 → **3**; kept 2 → **1**) | 4 → **2** (with money 6 → 3) |
| D-20 Cancel asked | "Grace · Cancel asked · #0556" | "Ggaba Stores · Checking · 430,000 · nothing paid · changed their mind" | tap **Cancelled** (Nothing paid · Undo 10 s); ★ only **Kept** | 4 → **2** | 4 → **2** |
| D-21 Taken twice? | — (the app spots it) | row: "Kato · #0544 & #0545 · same 320,000" | slide **Cancel #0545 · keep #0544** on the row | — | 4 → **2** |
| D-22 Peter asks: fewer | "Peter · asks for fewer · #0560" | "Mukono Roofing · Cement 20 → 12 · Y12 rebar 10 → 10 · 340,000 less · paid 300,000" (11:25) | ★ **Agree** (per-line keep on the card) | 2 → **1** | 4 → **2** |
| D-23 Restock: not yet | — | Orders → Stock row: "Cement 50 kg · 40 bags · 1,360,000 · 6 weeks left on the shelf" | **Not yet** on the row | — | 4 → **3** |
| D-24 A carton for the shelf? | "Denis · A carton for the shelf?" | "Wall plugs · 1 for the order, 199 for the shelf · 298,500 · ~14 months of selling" | ★ **Shelf part OK** (Order only on the card) | 2 → **1** | 4 → **2** |
| D-25 Limit and terms | — | Money → the customer: limit gauge, oldest bill | a limit chip, Save (Grace told by itself) | — | 8 → **5** |
| D-26 Look alike | — | Money card: the two records side by side | slide **Merge into Ggaba Stores** (Gaba Stores, same phone) | — | 6 → **4** |
| D-27 Opening balance | — | Money → old books: the figure, since when | slide **Opening balance · 290,000** | — | ≈6 → **4** |
| D-28 Promise (Ruth's) | — | Money → the debtor: promise dots | a day chip, Save | — | 6 → **4** |
| D-29 Goals | — | Team: last month per person, the suggested goal | **Use the suggested goals**, Save | — | 5 → **4** |
| D-30 Chase debtors | — | Today's watch row: "1 over 30 days · Kyaligonza & Sons · 2,310,000 · Grace's" | **Nudge Grace** on the row | — | 5 → **2** (app, Nudge Grace on the Today row; 3 through Money) |
| D-31 Stuck order | — | Today's watch row: "#0554 Lubowa · 2 h 40 m in Checking · 40 m over · Denis" | **Nudge Denis** / **Give it to Moses** on the row | — | 5 → **2** (give 2 → 2; assign 4 → 2) |
| D-32 Credit asked | "Esther · Credit asked · Ggaba Stores" | "limit 2M → 3,000,000 · 14 d · owes 1,615,000 · pays every 2 weeks" | ★ **Limit 3M · 14 d** | — (no path) → **1** | — → **2** |
| D-33 A new item to price | "Moses · A new item to price" | "PVC pipe 4 in · cost 28,000 · rivals 34,000–36,000" | ★ **Markup 25% · 35,000** | — (no push) → **1** | 7 → **2** |

**In the queue** (several waiting, which is most of the day): today each next
decision costs **2** (the row, then the answer, after the page pops back to the
list); with the row answers and Decide next it costs **1**.

## Totals

From the push: the 20 decisions that have a push today. From the app: the 30
decisions possible today. The primary answer of each.

| ID | Push before | Push after | App before | App after |
|---|---|---|---|---|
| D-1 | 2 | 1 | 4 | 2 |
| D-2 | 4 | 1 | 6 | 2 |
| D-3 | 5 | 1 | 7 | 2 |
| D-4 | 2 | 1 | 4 | 2 |
| D-5 | 2 | 1 | 3 | 2 |
| D-6 | 5 | 1 | 6 | 2 |
| D-7 | 5 | 1 | 6 | 2 |
| D-8 | 2 | 0 | 3 | 0 |
| D-9 | 3 | 1 | 4 | 2 |
| D-10 | 5 | 2 | 6 | 2 |
| D-12 | 2 | 1 | 4 | 2 |
| D-13 | 2 | 1 | 4 | 2 |
| D-14 | 2 | 0 | 4 | 0 |
| D-16 | 2 | **2** | 4 | 2 |
| D-17 | 4 | 2 | 4 | 2 |
| D-18 | 2 | **2** | 4 | 2 |
| D-19 | 2 | **2** | 4 | 2 |
| D-20 | 4 | 2 | 4 | 2 |
| D-21 | — | — | 4 | 2 |
| D-22 | 2 | 1 | 4 | 2 |
| D-23 | — | — | 4 | 3 |
| D-24 | 2 | 1 | 4 | 2 |
| D-25 | — | — | 8 | 5 |
| D-26 | — | — | 6 | 4 |
| D-27 | — | — | 6 | 4 |
| D-28 | — | — | 6 | 4 |
| D-29 | — | — | 5 | 4 |
| D-30 | — | — | 5 | 2 |
| D-31 | — | — | 5 | 2 |
| D-33 | — (no push) | 1 | 7 | 2 |
| **Sum** | **59** (20) | **24** (same 20) | **145** (30) | **68** (30) |
| D-15, D-16 kept, D-32 (not possible today) | — | 1 each | — | 2 each |
| Each next in the queue | 2 | — | 2 | 1 |

**Every decision drops from the app** (145 → 68). **From the push, 17 of 20
drop** (59 → 24). **Three do not**, by rule: **D-16 write-off, D-18 credit note,
D-19 void** stay 1 to open + 1 slide, because an irreversible money move never
gets a notification action. Their safe "keep" answer does drop to 1 from the
push (Kept on the shelf, Kept as sold, Kept as billed), and a void with money
drops 4 → 3. Making them 1 would need a slide on the notification itself,
which Android does not offer; not proposed.

Second choices that also drop: Set price (another figure) 5 → 3 (push, rung or
keypad, Use), Bill it all 3 → 2, Cash first 3 → 2 from the app, a check-in with the Buyer's note 3 → 1, a cancel with money 5 → 3,
Assign 4 → 2.

## Steps removed or automated

- **Removed:** opening a page to press one button (the one safe answer is on the row and on the push as a notification action); the four pushes that open Today instead of their ask (M-1, M-2,
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
  credit note, void, a cancel with money, merge, opening balance. Prices, credit, short
  picks, check-ins, extras, cartons, agents and a cancel with nothing paid are taps with Undo 10 s.
