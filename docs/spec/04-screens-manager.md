# 04 · Screens — Manager

What this covers: every screen of the new Manager app (`src/apps/manager`, `src/core/manager`), the route ids, the decision queue, each decision D-1 … D-33 from ask to answer, the rules the boards draw, the screens still to draw, and the questions open.
Date: 2026-11-12
Status: **screens decided** (the approved canvas, Kevin 12 Nov 2026: "implement this design as it is"; "Yes, I approve it"). **Questions open** (§7): until Kevin answers, the app builds the default named beside each one.

Read with: [`04-screens-manager-data.md`](04-screens-manager-data.md) (every read and write), [`01-order-journey.md`](01-order-journey.md), [`02-money.md`](02-money.md), [`06-offline-sync-push.md`](06-offline-sync-push.md), [`07-stack.md`](07-stack.md), `docs/decision-rights.md` (binding), `docs/audit/GLOSSARY.md`, and the three Manager papers this chapter is built from: `docs/audit/manager/handover.md` (who asks, what is written, who is told, the words, the pushes), `docs/audit/manager/day.md` (the day and the taps), `docs/audit/manager/GOAL.md`.

---

## 1. The screens are the canvas

The approved canvas is "Manager — Agent language" (https://claude.ai/artifact/TgJSJfvHJskZw293Vzd2qW). Its source is `docs/canvas/manager/` (`*.dc.html`, the renders in `png/`, the generators in `tools/`, the shared figures in `BRIEF.md`).
- **11 boards**: 3 summary boards (Main: every hand-off · Flow: the day, taps before → after · Scores) and 8 screen boards, each 4 phones at 360 × 780 and 8 state cards.
- An independent review scored all 36 pages, from the renders. After 4 rounds they average 8.66, against the Agent app's 8.37, with none below (`docs/canvas/manager/review/round-4.md`).
- The words check found all 33 hand-offs on the decisions board and no forbidden words on any screen (`review/words-check.md`).

| Board | Pages (row 1) | States (row 2) | Route ids (§2) |
|---|---|---|---|
| `Today` | 1 Today 09:40 · 2 Decide next 1 of 8 · 3 Answered, the next slides in · 4 All decided | default, pressed, disabled, sending (a row answer); success (Undo 8); error (Try again); offline (1 waiting to send); empty (Nothing waits on you, the + a tick); the push with its action; the push Undo 10 s | `today`, `decide`, `decide/done` |
| `Orders` | 1 Orders by stage · 2 One order #0552 · 3 Stuck · 4 To bill 10:05 | the push (Can't bill itself · Only 567); pressed, disabled (Price coming, no cost · Taken twice, #0545 invoiced); sending (Nudging); success (Nudged · Undo); error (Not sent · Someone else just did this); offline; empty (Nothing stuck · nothing to bill) | `orders`, `orders/order`, `orders/stuck`, `orders/bill` |
| `Money` | 1 Money · 2 One debtor · 3 A promise · 4 Customer Ggaba Stores | Nudge on the card (default, pressed); merge (disabled until one is ticked, sending, success with Undo); opening balance slide; error (promise not saved · merge not done); offline; empty (Nobody owes) | `money`, `money/debtor`, `money/promise`, `money/customer` |
| `Team` | 1 Team · 2 One person (sheet) · 3 Goals and limits · 4 Nudge Denis (sheet) | the move on the row; pressed → Nudged with Undo; disabled (Give it to: only Denis buys · Nothing to save); sending; success (November set · the quiet push); error; offline; empty (Joy holds nothing) | `team`, `team/person`, `team/goals`, `team/nudge` |
| `DecidePrice` | D-1 Under the shop's price · D-4 At the counter · D-3 Price up · D-2 Price coming | D-33 A new item to price; pressed; disabled (no known cost → Ask Denis; under cost → Use waits); sending from the push; success Undo 10 s; error; offline; empty (Every price decided) | `decide` kinds `price`, `counter`, `markup` |
| `DecideOrders` | D-12 Packed short · D-20 Cancel asked · D-18 Return asked · D-19 Void asked, with money · D-10 A line at 0 · D-22 Peter asks: fewer | from the push; pressed; disabled (the knob grey until refund or deposit is picked); sending; success; error; offline; empty (All decided); the push of a slide decision (Kept only) | `decide` kinds `short`, `cancel`, `return`, `void`, `given`, `agent` |
| `DecideStock` | D-16 Damaged · D-24 A carton for the shelf? · D-13 + D-14 Check-in differs · D-15 Not on the list | D-17 A count to check; D-23 Denis's restock list (pressed); disabled (nothing picked); sending (the slide went); success (Undo, the note closes); error (Someone else just did this); offline (a slide waits for signal); empty; three pushes on the lock screen | `decide` kinds `loss`, `carton`, `checkin`, `extra`, `count`; `orders/stock` |
| `MoneyCredit` | D-5 Credit hold · D-6 No limit set · D-7 The Store asks · D-32 Credit asked | the push; pressed; disabled (limit cleared → "Pick a limit to load it"); sending; success Undo 10 s; error (Not sent · Someone else just did this); offline; empty (Nothing waits on credit) | `decide` kinds `credit`, `storecredit`, `limit` |

**Proof that the app matches.** `docs/audit/manager/CANVAS-PARITY.md` (written as each tab is built) has one row per page and per state:
- the board's crop beside the app at 360 px, reached by real taps from Today on `next/manager.html?demo`;
- a verdict from an independent reviewer who drives the built app, scored on the canvas's five measures (Consistency · Taps · Glance · Polish · In step);
- a gap is fixed before the next tab starts (GOAL.md build goal, HOW 6).

## 2. The routes

One id per page. `kind`: **tab** (the bar shows), **pushed** (Back walks the stack), **sheet** (rises from the bottom over the page under it, a grab bar, ✕ closes). A route belongs to one folder, `src/apps/manager/<area>/`, which registers it in its own `index.tsx`.

### Shell (`shell`)

| Id | Params | Kind | Boards |
|---|---|---|---|
| `shell/sign-in` | — | full screen | **to draw** (AD01, §5) |
| `shell/no-reach` | — | full screen | **to draw** (AD01, §5) |
| `shell/you` | — | sheet (from the RN disc) | **to draw** (AD02, §5) |

The bar (Agent `.ax-tabbar`, widened to four): **Today · Orders · the red + · Money · Team**, grid `1fr 1fr 96px 1fr 1fr`. The red + is not a route. It opens `decide` at the head of the queue. Its navy badge counts the decisions waiting on the Manager (8 at 09:40). With nothing waiting it shows a tick and opens `decide/done` (Today empty state, DecideStock empty).

### Today (`today`)

| Id | Params | Kind | Boards |
|---|---|---|---|
| `today` | — | tab | Today p1. States: default, offline, empty |

### Decide (`decide`): the one sheet the red + opens

| Id | Params | Kind | Boards |
|---|---|---|---|
| `decide` | `{ id?, asker? }` (`id`: open this decision, from a push or a row; `asker`: the queue filtered to one asker, from a colour of Today's queue bar) | full-height sheet over the page under it | Today p2–p3; every Decide board page; their states |
| `decide/done` | — | in the same sheet | Today p4 (All decided · Today's answers · Back to Today); DecideOrders empty |

A decision sheet has one shape (§3.2). Its **kind** chooses the evidence and the dock: `price` (D-1, D-2, D-3), `counter` (D-4), `markup` (D-33), `credit` (D-5, D-6), `storecredit` (D-7), `limit` (D-32), `bill` (D-9, D-11 when nothing underneath), `given` (D-10), `short` (D-12), `checkin` (D-13, D-14), `extra` (D-15), `loss` (D-16), `count` (D-17), `return` (D-18), `void` (D-19), `cancel` (D-20), `twins` (D-21), `agent` (D-22), `carton` (D-24).

### Orders (`orders`)

| Id | Params | Kind | Boards |
|---|---|---|---|
| `orders` | `{ filter?: 'all' \| 'stuck' \| 'ruth' }` | tab | Orders p1 (All 10 · Stuck 1 · Ruth decides 5); states: pressed, sending, success, error, offline |
| `orders/order` | `{ id }` | pushed | Orders p2 (#0552: the track, Waits on Ruth with the answer in place, Lines) |
| `orders/stuck` | — | pushed | Orders p3 (Stuck 1: the stage tiles with Checking lit, #0554 with its clock, who holds it, Nudge Denis, Give it to Moses) |
| `orders/bill` | — | pushed | Orders p4 (To bill 5: Can't bill itself · Taken twice? · Bills itself); states: the push, disabled, error, empty |
| `orders/stock` | — | pushed | **to draw** (AD05: Denis's restock list; only its row is drawn, DecideStock "pressed · D-23") |

### Money (`money`)

| Id | Params | Kind | Boards |
|---|---|---|---|
| `money` | — | tab | Money p1 (In today · To collect with the age bands · the debtors); states: default, pressed, offline, empty |
| `money/debtor` | `{ customer }` | pushed | Money p2 (Owes · Bills · Promises · Chase; dock Nudge Grace · Promise) |
| `money/promise` | `{ customer }` | sheet | Money p3 (How much · Which day · Their promises · If kept; dock Promised · 2,310,000 · Mon 19) |
| `money/customer` | `{ customer }` | pushed | Money p4 (Ggaba Stores: the limit bar, Credit asked in place, Limit now · Change, Look alike · Open, Old books · Open) |
| `money/limit` | `{ customer }` | sheet | **to draw** (AD03: the Change behind "Limit now", D-25) |
| `money/merge` | `{ keep, drop }` | sheet | **to draw** (AD04: the Look alike · Open sheet; the dock is drawn in Money's states: Pick the one to keep · Merging · Merged · Undo) |
| `money/opening` | `{ customer }` | sheet | **to draw** (AD04: the Old books · Open sheet; the dock is drawn, Opening balance · 290,000 slide) |

### Team (`team`)

| Id | Params | Kind | Boards |
|---|---|---|---|
| `team` | — | tab | Team p1 (the shop's goal · Sales with pace · Everyone else · Joy is free · Give it to Joy) |
| `team/person` | `{ staff }` | sheet | Team p2 (Faith: her goal, Holds now, Her customers owe, Her pace; dock Nudge Faith) |
| `team/goals` | — | pushed | Team p3 (Goals and limits: the shop's goal, Each person, Next month, Stage limits, Credit hold line) |
| `team/nudge` | `{ staff, order? }` | sheet | Team p4 (Denis: Nudge · Give it to, About, Denis gets (the words, Change), dock Nudge Denis) |

**Push routes.** Every push kind for the Manager opens the decision it is about: `decide { id }`. A push for something already decided opens the sheet on "Someone else just did this", naming who and the answer (MoneyCredit error). A watch push opens its page: `payment.ask.decided` → `money/customer`; `team.*` → `team`. The full list of kinds is in handover.md §4 and in the data chapter. The demo's `&push=<kind>:<id>` opens the app the way a tapped push would.

## 3. The queue and the decision sheet

### 3.1 What waits on the Manager, and in which order

One list, the **queue**, built by one rule (`src/core/manager/queue.ts`). It feeds the + badge, Today's Needs you, the Decide sheet's "n of N", the Ruth decides filter on Orders and the colours of the queue bar.

| Rule | Source |
|---|---|
| A decision is in the queue while its ask is open and nobody has answered it. Answered by anyone (this phone, another manager phone, a push action) means it leaves the queue on the next read | handover §1; day.md "the queue" |
| **Order: someone standing there first** (D-4 a counter sale; D-7 a truck waits on "on credit?"), then **who has waited longest**. On the sample day: 1 Musa · Not paid yet · on credit? (25 m, the truck) · 2 Brian · Return asked (3 h) · 3 Denis · Price up (2 h 10) · 4 Musa · Damaged (1 h 30) · 5 Grace · Under the shop's price (1 h 05) · 6 Grace · Cancel asked (50 m) · 7 Musa · Packed short (40 m) · 8 Denis · A carton for the shelf? (15 m) | day.md; Today p1 and the "n of 8" heads of every Decide board |
| The asker is the person who asked, by display name, with their role ("From Musa · Store"). Nothing asks for D-9, D-10, D-11 or D-21 (the app spots them): the asker is the order's salesperson ("From Brian · Sales") | handover §3; DecideOrders p5 |
| The age is from the ask's own time (`created_at`, `payload.creditAsk.at`, the line's `priceAt` …), never from when the app read it: "1 h 05", "25 m", "3 h" | Today p1 |
| Not in the queue: D-8 (bills itself 24 h after delivery: Orders → To bill), D-14 alone (a Buyer's note with no difference left goes to the trip's history), D-23 (nobody asks: Orders → Denis's restock list), D-25 to D-31 (the Manager starts them: Money and Team), D-33 until P-11 exists (then a `markup` card) | day.md "Steps removed" |
| The queue bar on Today's hero is the queue coloured by who asks (Sales · Store · Buyer · Accounts · Agents) with the oldest wait. A colour opens `decide { asker }` | day.md "Today" |

### 3.2 One sheet for every decision

Drawn on Today p2 and on every Decide board. The parts, top to bottom:

| Part | What it shows | Source |
|---|---|---|
| Head (navy) | ✕ · "n of N" with the progress dashes · next › (skips without answering). Avatar · "From {asker} · {role}" · age chip (clock, amber past an hour) · "Asked {hh:mm} · #0555 {customer}" · the ask word as the title (handover §3) · one chip with the reason ("No limit set", "Old bill · 38 days", "Nothing paid", "−1,000 under cost") | Today p2; DecidePrice p1 |
| Evidence (white cards) | Drawn, never a paragraph: the price scale, the credit gauge, the line bars, the slip, the shelf tiles, the carton bar. One figure that decides it in mono | each Decide board |
| NEXT | A dashed row naming the next decision ("NEXT · Brian · Return asked · #0547 · 3 h") | Today p2 |
| Dock (navy) | "{who} see(s) {the answer word}" with the bell when a push goes · the total and the gain where money moves · **one primary answer** · one secondary in outline. A reversible answer is a white pill (a tap, Undo 10 s); an irreversible one is the red-knob slide (§3.3) | BRIEF "Dock rule" |

After an answer: a navy strip "{answer} · {#order} · {who} see it" with **Undo 10** counting down; at 0 the write goes; the next card slides in by itself (Today p3). The last answer opens `decide/done`: "All decided · 0 waiting", the eight answers coloured by asker, **Today's answers** (what the Manager decided and what the app did by itself: "08:30 Billed itself · #0546 · 24 h after delivery"), and **Back to Today**, the same end button on every flow (Today p4).

### 3.3 Tap or slide

| A **tap** with Undo 10 s (reversible) | A **slide** (money or books that can't be undone) |
|---|---|
| Approved · Price set · Shop's price · Markup · On credit · Cash first · On credit · load it · Limit … · Bill what went · Bill it all · Bill it · Given away · Take the check-in · Keep it · It goes back · Shelf part OK · Order only · Not yet · Go ahead · Agreed · Kept · Cancelled (nothing paid) · every "Kept …" · Count it again · Nudge · Give it to · Promised · goals | Written off · Count taken · Credit note raised · Voided · a cancel with money · Merge into … · Opening balance |

A slide has no Undo: it shows its result, and the asker is told. It needs signal: offline it reads "Write off needs signal" and waits (DecideStock offline). A tap made offline is kept and sent when the signal is back (Today offline: "No signal · it sends when back", the row reads "Waits"). Source: day.md "Kept as a slide"; handover §3; DecideStock and DecideOrders states.

### 3.4 Answer on the row, answer from the push

- **On the row.** Today's Needs you row and Orders' rows carry the asker, the ask in a few words, the evidence in mono 11, the age, and **the one safe answer as a navy pill**. A slide decision's pill is **Open**, which opens the sheet; a row never slides. Its line under the row reads "{asker} sees: {answer}". Taps: open the app + the pill = 2. Source: Today p1; day.md "Two ways to one tap".
- **From the push.** The push title is `{asker} · {ask word} · {#order}`. Its body is the evidence in 2–3 lines. Its one action is the safe answer. Never a slide: a slide decision's push offers only its "Kept …" answer, plus Open (Today push; DecideStock lock screen). The action needs the native shell (handover §6) and migration 0184 (`answer_from_push`). Until both are live, a tap on the push opens `decide { id }`: 2 taps.

## 4. Every decision, ask to answer

The words are handover §3, and only those (`src/core/manager/words.ts` holds them once). "Taps" counts from the app (open + answer) and from the push, as in day.md. Writes are named as in the data chapter.

| D | Ask (title) · from | Evidence drawn | Answers (primary · second) | Who is told · what they see | Taps app · push |
|---|---|---|---|---|---|
| 1 | Under the shop's price · Grace (Sales) | the scale: cost 38,000 · Grace 46,000 · shop's 47,500, "never under cost" hatched; Gain a sht 8,000 · Under the shop's −1,500 · On 30 sht −45,000; the line total | **Approved · 46,000** · Shop's price · 47,500 · **Price set** (another price, keypad, ≥ cost; under cost "Use" waits) | Grace sees Approved; a push only when the price moved: "Ruth set a new price · Tell them" | 2 · 1 |
| 2 | Price coming · Brian (or Denis, no cost) | Cost from Denis · Katwe 31,000; +25% = 38,750; Gain a pcs · Markup · On 20 pcs | **Price set · 38,750** (cost + the item's markup) · another price. With no known cost: Cost ? · **Ask Denis**; Price set waits | Brian sees Price set | 2 · 1 |
| 3 | Price up · Denis (Buyer), for Faith's order | Cost 24,000 → 27,000 · sells 26,000 · −1,000 under cost; rungs Sells · Same gain 29,000 · Shop's 33,750; Mukono pays +77,500 | **Shop's price · 33,750** · Price set · 29,000 (same gain) | Faith · Denis see Shop's price | 2 · 1 |
| 4 | At the counter · under the shop's price · Grace | Cement 10 bags at 40,000 · shop's 42,500 · cost 34,000; "Paying now · cash" | **Approved · 40,000** · Shop's price · 42,500 (at cost: asks again) | Grace sees Approved; her counter screen turns to pay | 2 · 1 |
| 5 | On credit? · Grace · chip Over the limit / Old bill · 38 days | Would owe 3,690,000 = owes 2,310,000 + #0555 1,380,000; Oldest bill 38 d against "held from 21 d", promise dots; the bills | **On credit · 1,380,000** · Cash first | Grace sees On credit / Cash first | 2 · 1 |
| 6 | On credit? · Faith · chip No limit set | Would owe 2,501,500 against the chosen limit; oldest bill 12 d; the order; Limit none | a limit chip (the smallest that covers, picked) then **On credit · 1,287,500** · Cash first | Faith sees On credit; the customer gets the limit and terms (`customer.changed` to the salesperson) | 2 · 1 |
| 7 | Not paid yet · on credit? · Musa (Store) | the truck clock "25 min · Truck waits · Ssali"; Would owe 1,240,000 against the limit; Owes 0 · 1st order on credit · Cash customer | chips 1.5M · 14 d (picked) · 2M · 14 d · 3M · 30 d, then **On credit · load it · 1,240,000** · **Cash first · it stays**. No chip: "Pick a limit to load it" (disabled) | Musa · Grace see On credit · load it | 2 · 1 |
| 8 | Delivered · bills itself in 18 h (no ask) | To bill: "#0548 Kato Construction · Fri 16:10 · Ssali · in 6 h 05 m" with the ring | none; **Invoice now** only on the order | Grace sees Invoiced; Esther gets `order.invoiced` | 0 · 0 |
| 9 | Can't bill itself · Only 567 · check it | Walk-in · 1 line · typed 567 · Grace's counter sale | **Bill it** (Undo 10) · Open | Grace sees Invoiced | 2 · 1 |
| 10 | Can't bill itself · a line at 0 · Brian | Wall plugs · 2 at 0 · at cost 2 × 1,500 = 3,000; On the books sells 0 · given away 3,000 | a why: Sample · Goodwill · Replacement · Other, then **Given away · Goodwill** · Bill it (→ D-2) | Brian sees Given away · Goodwill | 2 · 2 |
| 11 | Can't bill itself · Price coming / Packed short | the underlying decision | the underlying answer (Orders p4: Mukono Roofing · Price coming → **Price set · 42,500**) | as the underlying | as D-2 / D-12 |
| 12 | Packed short · Musa | 36 of 40 sht packed (the sheet grid, 4 short dashed); Bill what went 36 × 47,500 = 1,710,000; Bill it all 40 × 47,500 = 1,900,000 | **Bill what went · 1,710,000** · Bill it all · 1,900,000 | Musa · Grace see Bill what went | 2 · 1 |
| 13 | {Musa}'s check-in differs · Musa | line by line Denis · Musa (PVC pipe 4 in 12 · 11 −1 · −28,000; Owino Plumbing · 28,000 each); Denis's note "12 went on the truck at Owino." · "Closes with the check-in" | **Take the check-in · −28,000** · Nudge Denis | Musa · Denis see "Ruth took Musa's check-in" | 2 · 1 |
| 14 | Denis's note | inside D-13 | closes with D-13; alone it goes to the trip's history | — | 0 · 0 |
| 15 | Not on the list · keep it? · Musa | On the truck 20 + 2 dashed; Nakawa Cement Depot · 34,000 a bag; tiles Keep it +2 · 68,000 / It goes back 2 · to Nakawa, next trip | **Keep it · 68,000** · It goes back | Musa sees Keep it | 2 · 1 |
| 16 | Damaged / Lost / Stolen · Cement 50 kg · Musa | the photo; on the shelf 26 → 23 with the bag tiles; a switch per report (on); −102,000 at cost; "In the owner's log · at cost" | slide **Written off · 102,000** · Kept on the shelf. Nothing switched on: "Pick what to write off" | Musa sees Written off | 2 · 2 (Kept: 1) |
| 17 | A count to check · Aisle B · Musa | the count's tiles (match green, differ amber), net −12,000; each line differing: Timber 2×4 30 → 28 −18,000 · Wall plugs 40 → 44 +6,000 | slide **Count taken** · Count it again | Musa sees Count taken / Count it again | 2 · 2 |
| 18 | Return asked · Brian | the reason quote; the line with a stepper (5) · 5 × 11,250 = −56,250; Back on the shelf · Off what they owe · Change; Lubowa owes 662,000 → 605,750 | slide **Credit note raised · 56,250** · Kept as sold | Brian · Esther see Credit note raised | 2 · 2 (Kept: 1) |
| 19 | Void asked · Esther | Entered twice: #0544 Stays = #0545 Void (same total · same day); Paid on #0545 200,000; Kato owes 878,000 → 558,000 ("with Refund instead: 758,000") | chips **Refund 200,000** · **Deposit 200,000**, then slide **Voided · 320,000** · Kept as billed. With money and no chip: knob grey, "Pick refund or deposit" | Esther · Grace see Voided | 2 · 2 (money: 3) |
| 20 | Cancel asked · Grace · chip Nothing paid | the reason quote; where #0556 is (the stage dots, since 08:20); 0 Packed · 0 Paid · 430,000 Order; Who stops: Denis off To ask · Musa nothing to unpack | **Cancelled · #0556** (a tap, Undo 10, nothing paid; with money it is a slide with Refund · Deposit as D-19) · Kept | Grace · Denis · Musa see Cancelled | 2 · 2 |
| 21 | Taken twice? (the app spots it) | Kato · 320,000 · #0544 = #0545 · 200,000 paid | **Open** → slide **Cancel #0545 · keep #0544** · Both are real. #0545 invoiced: disabled "Billed first · ask for a void" | Grace and the yard: Cancelled | 2 · — |
| 22 | Peter asks: fewer (or to cancel) · Peter (Agent) | per line Agreed / Kept (Cement 50 kg 20 → 12 · −340,000); Cement on #0560 850,000 → 510,000; "Peter gets back 0 · 300,000 paid stays on it · 510,000 is more" | **Agreed · −340,000** · Kept | Peter · Denis see Agreed | 2 · 1 |
| 23 | Denis's restock list (no ask) | Cement 50 kg · 40 · 1,360,000 · 6 weeks left | **Not yet** · Go ahead (on the row) | Denis sees Not yet / Go ahead | 3 · — |
| 24 | A carton for the shelf? · Denis | the carton bar 200 packs: 1 for the order · 199 for the shelf; Lasts ~14 months of selling (Oct 2026 → Dec 2027); tiles Shelf part OK 199 · 298,500 / Order only 1 · 1,500 | **Shelf part OK · 298,500** · Order only · 1,500 | Denis sees Shelf part OK | 2 · 1 |
| 25 | (Money · the customer) | Limit now 2,000,000 · 14 days | **Change** → the limit sheet (AD03); Save tells the salesperson | Grace: `customer.changed` | 5 · — |
| 26 | Look alike · Same phone (Money · the customer) | Ggaba Stores 0772 418 330 · 6 orders 1,615,000 / Gaba Stores 1 order 0; tick the one kept | slide **Merge into Ggaba Stores** (grey until one is ticked) | the owner's log | 4 · — |
| 27 | Old books · since 1 Oct · 290,000 | the figure and since when | slide **Opening balance · 290,000** | the owner's log | 4 · — |
| 28 | Promise (Money · a debtor) | How much (All 2,310,000 · Oldest bill 1,450,000 · Part); Which day (Sat 17 … Fri 23, Pick a day later); Their promises (1 kept · 2 broken); If kept · Mon 19 | **Promised · 2,310,000 · Mon 19** (Undo 10) | Grace sees Promised · Mon 19 | 4 · — |
| 29 | Goals and limits (Team) | the shop's goal split by person (adds up to 105M); each person −/+ ; Next month · Goals · 105M; stage limits (2 h · 1 d · 2 h · 4 h, 1 over); credit hold line 21 d (Lubowa 25 d · Kyaligonza 38 d past it) | **Goals · 105M** (one tap saves all; Undo 10) | each salesperson: "Your goal for November" (quiet) | 4 · — |
| 30 | Chase (Today's watch, Money) | Kyaligonza & Sons 2,310,000 · oldest 9 Sep · 38 d · Held | **Nudge Grace** (on the row and the card) | Grace sees "Ruth nudged you" | 2 · — |
| 31 | Stuck · Faith behind (Today's watch, Orders, Team) | #0554 2 h 40 m in Checking · limit 2 h · 40 m over · Denis holds it; Faith −2.09M | **Nudge Denis** · **Give it to Moses** · Nudge Faith · Give it to Joy | the person nudged: "Ruth nudged you" + the words | 2 · — |
| 32 | Credit asked · Esther (Accounts) | Would owe with #0553 2,390,000 against now 2M / asked 3M; At 2M · now 390,000 over · #0553 waits / At 3M · asked 610,000 left · #0553 goes; oldest bill 16 d; terms 14 days · same; "Pays every 2 weeks" | **Limit 3,000,000 · 14 days** · Cash only | Esther · Grace see Limit 3,000,000 · 14 days | 2 · 1 |
| 33 | A new item to price · Moses (Sourcing) | the scale: cost 28,000 · +25% 35,000 · rivals 34–36k | **Markup 25% · 35,000** | Moses sees Markup 25% | 2 · 1 |

## 5. Pages the canvas does not draw yet

The rule (build goal, HOW 3; Kevin 12 Nov 2026): **stop, draw it on the same canvas in the Agent language** (`docs/audit/buyer/agent-design-language.md`) as a board prefixed **AD**, have an independent reviewer score it at or above the Agent app from the render, then build it. Never improvise a screen in code. Each comes from a job in day.md or a state the shell needs. None is a new feature.

| AD | Page | Why it is needed | Drawn from |
|---|---|---|---|
| AD01 | Sign in (default, signing in, wrong email or password, no signal) · Could not reach the shop (Try again, open the copy) · the first load | no app opens without it | the Buyer's `Gate.dc.html`, the Store's TD20–TD23 |
| AD02 | You (the RN disc): name, shop, pushes on this phone, sign out | sign out and the push switch need a place | the Store's TD12 |
| AD03 | Change the limit and terms (D-25): limit chips and terms, Save (the salesperson told) | Money p4's **Change** opens it | Money p4, MoneyCredit chips |
| AD04 | Look alike (D-26) and Old books (D-27) sheets: the two records side by side, tick the one kept, the slide; the opening balance, since when, the slide | Money p4's two **Open** buttons; their docks are drawn, the sheets are not | Money states (merge, opening balance) |
| AD05 | Denis's restock list (D-23): the planned lines, each with Not yet / Go ahead | Orders · Stock; only one row is drawn (DecideStock "pressed") | DecideStock D-23 row |

Each is added to this table's board column and to §2 in the same commit as its board.

## 6. Rules the boards draw

Each rule lives once in `src/core/manager/` (the file named). A board figure that disagrees with the rule is corrected, not the rule (the Store's lead ruling).

| Rule | Where | Source |
|---|---|---|
| **Never under cost.** A price under the line's cost is refused, except a line given away (D-10). The keypad's Use waits under cost and says "under 38,000" | `price.ts` | 0171; decision-rights §1 |
| **The shop's price** is cost × (1 + the item's markup), else the shop's default markup; "Same gain" is the old gain a piece on the new cost | `price.ts` | `manager.html` price page; DecidePrice D-3 |
| **Would owe** = what the customer owes now + this order's total. The credit gauge marks the limit; the hatch is this order | `credit.ts` | MoneyCredit |
| **Held for credit**: over the limit, owing past the hold days (21, `presets.creditHold`), or no limit set | `credit.ts` | 0119/0174 `ow_gate_reason`; 0167 |
| **Limit choices**: three chips from the ladder 500k · 1M · 1.5M · 2M · 3M · 5M · 10M — the smallest that covers what they would owe (picked), then the next two. Terms: the customer's own, else 14 d under 3M and 30 d from 3M | `credit.ts` | `manager.html:4119–4121`; MoneyCredit D-7 (1.5M · 2M · 3M). D-6's board draws 2M · 3M · 5M; 2M cannot cover 2,501,500, so the app shows 3M · 5M · 10M (Q4) |
| **Stuck**: longer in a stage than its limit (`presets.orderStageLimits`, else 2 h Checking · 1 d Buying · 2 h Packing · 4 h On the road). The clock runs from the stage's own time | `stuck.ts` | `manager.html:1639–1653` |
| **Taken twice?**: two live orders of one customer (or one phone), made within 4 h, same lines or same total, not marked "Both are real" | `twins.ts` | `manager.html:3580–3600` |
| **Bills itself 24 h after delivery**; the countdown "in 6 h 05 m" from `deliveredAt`. Can't bill itself names its why by code: OWSML Only 567 · check it · OWGIV A line at 0 · given away? · OWTPC/OWPRC Price coming · OWSHP Packed short | `bill.ts` | 0139; 0169 |
| **Pace**: the day of the month (17.57 of 31 at 09:40) over the month; ahead / behind = invoiced − goal × pace; "a day" = what is left ÷ the days left. One pace for everyone | `team.ts` | BRIEF "Team" |
| **Age bands** of what is owed: under 7 d · 8–21 d · 22–30 d · over 30 d, by the oldest unpaid bill; "held at 21 d" marked | `owing.ts` (shared, `src/core/owing.ts`) | Money p1 |
| **Money In today** is cash + mobile money + bank received today, test payments left out | `money.ts` | `manager.html` cashTxns (0167 SAL-018) |
| **A stage's clock runs from the stage's own time**: #0556 has been in Checking since 08:20, so its row reads 1 h 20 m at 09:40 (Orders p1 drew 0 h 50 m, the time since its cancel ask; the board is corrected) | `watch.ts stageMins` | build review round 2 |
| **A slide has no Undo** (§3.3), the merge too: Money's merge success drew "Undo 10", but no write can unmerge two customers, so the result shows without Undo | `money/Merge.tsx` | build review round 2 |
| **A refund goes back the way it was paid** (the order's payments: the account most of it came in by; cash when not known) | `decide/kinds/after.tsx moneyOf`; `supabase/rows.ts mostPaidBy` | OLD-APP-COVERAGE L6 |
| **People by display name** (`staff.name`, tidied), never the email; Ruth's own name in every answer; order numbers #0550 (`orderNo`) | `src/core/names.ts` | GLOSSARY People |

## 7. Open questions (Kevin)

Each names the default built until Kevin answers.

| # | Question | Default being built | Source |
|---|---|---|---|
| Q1 | **D-32 Credit asked needs a new table** (`customer_asks`, P-12). Approve it? | Built into 0184 behind your yes; until then the `limit` card never appears (nothing can ask) and Accounts drops "limit, terms" from its button | handover §4 P-12; GOAL "Waiting on Kevin" |
| Q2 | **Answers from the notification** need a new Android shell build (handover §6) | The web app is built first. A push opens the decision (2 taps); the actions come with the shell build | handover §6 |
| Q3 | **Suggested goals** (day.md: "last month's invoiced + the shop's growth") have no rule written | "Next month · Goals" copies this month's goals (35M · 30M · 30M · 10M = 105M), as Team p3 draws | day.md D-29; Team p3 |
| Q4 | **D-6's limit chips**: the board draws 2M · 3M · 5M; 2M cannot cover what Mukono would owe (2,501,500) | The rule (§6): 3M · 5M · 10M, 3M picked | MoneyCredit p2; `manager.html:4121` |
| Q5 | **A nudge before 0184 is live** (`nudge_person` is new) | The switch to the new app waits for 0184 to be live: no WhatsApp fallback (that would be a second way) | handover M-10, P-9 |
| Q6 | **The pace**: the boards draw "day 17.6 of 31" (0.5667 = 17 of 30, so Grace's pace 19,833,000). No clock gives that | Today counts as a day sold: day 17 of 31 (0.548): Grace's pace 19,193,548, the shop's 57,580,645, ahead 3,529,355. The Team and Today figures follow the rule | BRIEF "Team"; `watch.ts pace` |
| Q8 | **A slide decision from the app**: day.md counts the write-off and the credit note at 2 from the app ("the row's slide"); Today p1 draws their row pill as **Open** (Open + the slide), so one opened alone costs 3 with the tap that opens the app | As drawn: Open + slide. In the queue it is still within day.md: the eight of 09:40 take 11 taps from the app against the board's 16 (`test/e2e/manager-flows.cjs taps`) | day.md D-16, D-18; Today p1 |
| Q7 | **Taken twice?** sits on Orders → To bill (Orders p4, the + showing 2 at 10:05), not in the queue | Not in the queue or the + badge; shown on To bill with Open → the slide | Orders p4 |
