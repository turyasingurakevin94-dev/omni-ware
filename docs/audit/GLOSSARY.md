# Omni-ware glossary

One word per concept, shared by every app (store, owner, sales, buyer, manager, accounts, sourcing). Read it before a round. Add to it; never fork it. When a round changes a word, update the row here and give the round in **Decided**.

Most rows come from the Store audit rounds (`docs/audit/store/`, mainly round 6, WORD-01..10). The Sales rows come from the Sales app reviews (`test/sales-app.test.js` pins them).

## Copy rules

- **Short plain words** for low-literacy users. One word per concept, everywhere.
- **People by name.** The display name the person chose, never a login or email handle.
- **Order numbers** as `#0550`.
- **No system words on screen.** Never SQL, function, migration or error-class words. A failure says what happened in plain words; a code may follow for Kevin.
- **Counted words through one helper** (`nOf()` in the Store): "1 item", "2 items", never "1 items". *(Store R2 · FLOW-07)*

## People

| Word | Means | Never | Decided |
|---|---|---|---|
| A person's name | The name they chose (`members`, Store R5 · PRIV-04). Otherwise their staff record's name, unless it looks like a login. Otherwise "Someone". One resolver: `personName()` in the Store. | the login handle; a stored name that differs from the one they chose | Store R6 · WORD-01 |
| You | The person holding the phone, in their own lists ("2 yours") | their own name in their own list | Store R6 · WORD-05 |
| Someone | A person whose name isn't known | a handle | Store R6 · WORD-01 |
| Customer | Who an order is for | client | Sales UX audit |
| Ruth (the Manager) | The person who decides: prices under the shop's price, credit, voids, returns. Named by their display name, not their role, on screen. | the owner, for day-to-day decisions | `docs/decision-rights.md` |

## Orders and goods

| Word | Means | Never | Decided |
|---|---|---|---|
| Order | Anything a customer buys, written down. Shown as `#0548`. | quote (on screen); "Quote for …" in stock history ("Order #0548 · Walk-in") | Store R6 · WORD-09 |
| Line | One item on an order | — | Round skill |
| Checking · Buying · Packing · On the road · Delivered | The order's stages, in that order | On road | Sales UX audit |
| To pack | Ready to pack now | counting "waiting on goods" in it | Store R6 · WORD-04 |
| Waiting on goods | Bought in for the order, not here yet ("+1 waiting" beside To pack) | to pack | Store R6 · WORD-04 |
| Delivered | Left the yard for good: at the door, or collected at the gate. "3 delivered today · 1 of them collected". | delivered and gone out counted differently | Store R6 · WORD-04 |
| Packed | The order is packed and checked | — | Round skill |
| Pack short | Pack fewer than the line asks (an amber choice) | a red button for a short pack | Store R4 · NAV-04 |
| Waits for the goods | A line that can't be packed yet (a grey, disabled button) | — | Store R4 |
| Hand over | Goods given to a collector at the gate | the shift change | Store R6 · WORD-02 |
| Pass the yard | The shift passed to a colleague; "End my shift" on You | hand over, handover | Store R6 · WORD-02 |
| Trip | A buying pickup; "trip · 3 suppliers" when it has several | round | Store R6 · WORD-08 |
| Delivery (supplier) | A supplier brings the goods to the yard | trip | Store R6 |
| Check-in | Counting a trip's goods into the yard. A difference is "Your check-in of Denis's trip". | a count (a count is of an aisle or an item) | Store R6 · WORD-06 |
| Counter sale | Pay and go, from our own shelf | — | Sales |
| Walk-in order | An order with no customer name; the shop packs it | — | Sales |
| Sell again | Start a new order from an old one | — | Sales UX audit |

## Stock

| Word | Means | Never | Decided |
|---|---|---|---|
| On the shelf / the shelf | The books less what has left for orders not invoiced yet | "books" next to a shelf figure ("The shelf has 3 kg", not "The books hold 3 kg") | Store R1 · DATA-04 |
| Books | Only where the real books are meant | — | Store R1 · DATA-04 |
| Left the shelf · not invoiced yet | The orders between the shelf and the books, listed on the item page | — | Store, before the loop |
| No aisle yet | A product with no category. It takes no aisle letter. | a letter, "Other" | Store R1 · DATA-05 |
| Count it again | Start a new count of a place that already has one waiting; it replaces the old one when it is sent | a second count beside the first | Store R1 · DATA-01 |
| Count it now | What an empty shelf offers instead of a loss report | a loss report off an empty shelf | Store R1 · DATA-03 |
| I miscounted | Fix the number typed at check-in | — | Store R2 · FLOW-06 |
| Units | Lower case, through one formatter (`unitSay()`): "1 ctn · 6 pcs" | "1 Ctn" and "1 ctn" on one screen | Store R6 · WORD-09 |
| Count in the unit you can see | A packed line is counted in the pack or the loose unit; the books keep the line's own unit | — | Store R2 · FLOW-01 |

## Money

| Word | Means | Never | Decided |
|---|---|---|---|
| Not paid yet | An order that can't leave until it is paid. One label on the bay, Today, Load and the slip. The one reason, only on the order: "Sales take the money before it leaves, or Ruth lets it go on credit." | waits on money; holds; cash customer | Store R6 · WORD-03 |
| Owes | What a customer owes the shop (one customer: "Owes"; the list: "Owe") | — | Sales UX audit |
| To collect | Money owed that Sales should collect | — | Sales UX audit |
| Take payment | Record money a customer paid | — | Sales |
| Deposit | Money a customer paid ahead and confirmed keeping; their next bill uses it first. "Deposit 50,000", green; a balance below 0. | on account; credit (credit is the Manager's pay-later); "-50,000" | Sales R1 · SAL-005 |
| Give change | The default when someone pays more than they owe: the extra goes back | keeping it quietly | Sales R1 · SAL-005 |
| Paid over | Paid more than the bill, before anyone settled it (change, or a deposit if the customer confirms); Accounts settles it | — | Sales R1 · SAL-005 |
| To price | A line with no selling price yet; nothing is owed on it until the Manager prices it ("2 lines to price · Ruth", "Priced so far") | billing it at cost | Sales R1 · SAL-007 |
| Doesn't add up | A customer's balance and their open bills disagree; Accounts checks it ("349,000 apart") | two figures with no word | Sales R1 · SAL-011 |
| Money on a phone | Shown only to the roles allowed to see it, enforced in SQL by role. The yard's phone gets no money at all. | hidden in the browser only | Store, before the loop (0159, 0160) |

## Time

| Word | Means | Never | Decided |
|---|---|---|---|
| How long | A duration: "41 m", "9 h 41 m", "2 days" (`howLong()`) | a clock time for a duration ("oldest 9:41") | Store R6 · WORD-07 |
| When | A moment: "15:20" today, "Thu 23:28" otherwise (`whenAt()`) | a clock time with no day when it isn't today | Store R6 · WORD-07 |
| Undo | 10 seconds, or until the screen changes, everywhere | 5 s in one place, 10 s in another | Store R2 · FLOW-02 |

## Sending and loading

| Word | Means | Never | Decided |
|---|---|---|---|
| Sending… | The write is on its way (a neutral spinner) | a green tick before the server says yes | Store R3 · REL-05 |
| Not sent yet / Kept on this phone | Kept in the outbox; it sends itself when there is signal (amber) | "Sent" | Store R3 · REL-05 |
| Sent | Only after the server's yes (green) | — | Store R3 · REL-05 |
| Waiting to send | The one list of what isn't on the books yet ("Not sent · N") | "Nothing is waiting" while something is | Store R3 · REL-04 |
| Not done | The bar that stays until the work is done: amber "no signal", red for a save that failed ("tell Kevin · code"), blue "Someone else just did this · Refreshed" | a 5 s toast; losing the work | Store R3 · REL-07 |
| Could not load the yard | A failed load, with Try again and a code | an empty yard, 0s, "No products" | Store R5 · PRIV-03 |
| Checking your shop… | Signed in; the phone is asking which shop this person works in | a blank screen; "This login has no shop" too early | Store R8 · REL-11 |
| Could not reach the shop | The shop could not be asked just now, with Try again, a code and Sign out | "This login has no shop" after a failed read | Store R8 · REL-11 |
| Updating… | Showing the copy saved on this phone while the fresh one comes; "Updating · saved 7:52" when that copy is more than 10 minutes old | "Live" before anything fresh has arrived | Store R9 · SPD-04 |
| Live | This session has loaded fresh data and the phone is online | — | Store R9 · SPD-04 |
| Update ready · Reload | A newer app has been downloaded; one tap switches to it. The next open uses it anyway | a silent change in the middle of a job | Store R9 · SPD-01 |
| Try again | Retry after a failure; the work is kept | — | Store R3 |
| Back online to sell | A slide that writes waits for the connection | — | Sales review 5 |

## Screens and navigation

| Word | Means | Never | Decided |
|---|---|---|---|
| Back | The app's one Back: a sheet, then the screen, then the tab | the browser leaving the app | Store R4 · NAV-02 |
| Leave Omni-ware? | Asked by Back on Today | leaving without asking | Store R4 · NAV-02 |
| Look only | An order this person can't act on, opened read-only, saying what it waits on | Pack on an order that isn't theirs to pack | Store R4 · NAV-04/05 |
| Did you mean | Nothing found offers the nearest shop words | a dead end | Store R4 · NAV-06/07 |
| Show 30 more | A long list draws 30 rows, then adds 30 a tap; the chips still count every match | a cap that hides rows | Store R9 · SPD-02 |
| Needs you | Today's list of jobs for this person | — | Sales, Store |
| For you · In the yard today | Alerts: only today's "for you" alerts are unread; opening Alerts reads them | counting others' routine check-ins as unread | Store R6 · WORD-10 |
| Signed in as someone else | Another login is under this app; nothing is saved until the app's own person signs in again | carrying on as the other login | Sales R1 · SAL-002 |
| Big text | You → Big text: every size one step up, at least 1.2×; controls 52 px; nothing clipped at 360 | a zoom that squeezes the layout | Store R8 · A11Y-01 |
| Asked of Sourcing | Requests for items the shop doesn't sell: Asked → Looking → Found → Priced → Listed | — | Sales |

## Not the same across apps yet

Fix these in the next round that touches each app.

| Where | Says now | Should say |
|---|---|---|
| Sales: the order stamp | "NOT PAID" / "PART PAID" | "Not paid yet" (Store R6 · WORD-03); a part-paid word still to agree |
| Database push `store.handover` (0157/0159) | "… handed you the yard" | "… passed you the yard" (needs a migration) |
