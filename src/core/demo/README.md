# The demo

The sample shop of `docs/canvas/sales-agent/FACTS.md`, in memory, behind the same `DataSource` the real books use (`src/core/datasource.ts`). Every Sales screen runs on it exactly as it will on the books, and the parity harness (`tools/parity/`) reaches every board through it.

Open it: `next/sales.html?demo`.

## Flags

Only what a tap cannot cause is a flag. Everything else is reached by tapping from Today.

| Address | What you get | Boards |
|---|---|---|
| `?demo` | Sat 17 Oct 2026, 10:41, Kampala. Grace Akello (Sales) is signed in. | almost all |
| `&offline=1` | No signal: reads come from the copy saved at 7:52, every write is refused as `offline` (the outbox keeps it), and the outbox starts with 2 kept writes ("2 not sent yet": Grace's two answers to Mukono, 10:40 and 10:41) | TD09, CU07, SL27, KC17, CH12 |
| `&clock=15:40` | Another time of day; the day and the data stay (a tab's `extra` file may change the data for its what-if) | TD07 |
| `&state=first-day` | A new salesperson's first day: 8:00, nothing of Grace's yet (no orders, payments or chats) | TD06 |
| `&state=empty` | Nothing live, nobody owes, no chats | CH06, OR04, CU06 |
| `&state=signed-elsewhere` | The login under the screen is Musa's (Store): the shell shows the signed-elsewhere state | TD10 |
| `&wa=off` | The shop's WhatsApp number is not connected: a receipt or statement cannot reach the customer | CU43 |
| `&state=loading` | The books never arrive: the skeletons stay | CH07, CU08 |
| `&as=ruth` | Another member of the team is signed in on this phone (Ruth, the Manager: her session's role is `manager`) | CH32, CH35 |
| `&fail=sale` | The next counter sale is lost on its way, as when the signal drops mid-send; the one after goes through | KC19 |
| `&listen=1` | The phone can listen: "Say it" in a chat starts listening and hears "Yes, it can come to the Ntinda site" (`HEARD` in `flags.ts`) until Stop. No tap can cause speech, so it is a flag | CH16 |

Flags combine: `?demo&offline=1&clock=15:40`.

## What is seeded (one file per entity, `seed/`)

| File | FACTS |
|---|---|
| `clock.ts` | §1: now 10:41, saved 7:52 |
| `people.ts` | §2: the team, presence at 10:41 (Brian typing to Kato, Faith away 2 h), the counter team |
| `customers.ts` | §3: the six cast customers, owed amounts, debt logs that age as FACTS says, rhythms, usuals |
| `background.ts` | §3: the other 32 of 38 (8 gone quiet, due Mon 1 · Tue 1 · Thu 2), their last orders, and Grace's other October invoices (#0512-#0514, 855,500) |
| `orders-live.ts` | §4.1-§4.2: the 12 live orders (+3,240,000), #0552's whole life |
| `orders-past.ts` | §4.3-§4.5: delivered this week (8 · 6,569,000), older bills, the counter's 6 sales today (412,000) |
| `items.ts` | §6: every item, price, shelf and aisle; the 12 aisles |
| `chats.ts` | §2, §3.3-§3.4, §5: the chats, their messages (the boards' words), Brian taking Okot J. |
| `money.ts` | §5: the cash book this month, promises, asks to Ruth and Esther, the goal, the shop's settings (Credit charge 3%) |
| `asks.ts` | §6: the four asks of Sourcing |
| `extra/<tab>.ts` | **each tab's own additions**, owned by that tab's builder |

`test/sales-core-demo.test.js` checks that the figures the boards draw come out of the seed by the app's own rules: 12 live · +3,240,000, the four stage tiles, Sold · October 12,480,000, Placed today 8 · 2,440,500, Money in today 1,044,000, 38 customers, 4 owe 1,910,000, Who's due 3, Gone quiet 8, Chats waiting 3 · oldest 12 m, and the writes below. If a board needs a figure the seed does not give, add the rows in your tab's `extra/<tab>.ts` and a check in your own test; never change another tab's file.

## Writes act like the server

| Write | Stands in for | Acts |
|---|---|---|
| `placeOrder` | `saved_quotes` insert (`sales.html:8718`) | takes the next number (**#0558** at 10:41), starts at Packing when all is on the shelf and nothing waits, else Checking; a typed price under cost is refused `OWCST` |
| `counterSale` | `counter_sale` (0136/0155) | placed, paid, delivered and invoiced at once; change for cash; a price under the shop's waits (`waiting: 'price'`) |
| `receivePayment` | `receive_payment` (0169) | a customer's bills oldest first (or the ticked ones); more than owed needs `change` or `deposit`, else `OWOVR`; Mobile and Bank need the transaction ID |
| `askBill`, `askCancel`, `askPaymentFix`, `recordPromise`, `askSourcing` | `invoice_asks`, (none yet), `payment_asks`, `payment_promises`, `sourcing_leads` | recorded, visible on the next read |
| `send`, `sendTemplate`, `sendImage`, `sendCatalog`, `media`, `note`, `take`, `give`, `markRead` | `wa-send` (`send`, `send-reply-template`, `send-image`, `send-catalog`, `media`), `wa_notes`, `take_conversation`, `hand_conversation` | a shut 24-hour window refuses a plain message or a picture; taking someone else's chat is refused; only your own customer is given, except by the Manager, whose give is a move (`moved`); `served` adds `servedBefore`, the year before the seeded thread |

Writes take 250 ms, so "Sending…" is seen. With `&offline=1` every write is refused as `offline`.

## Known gaps (FACTS that the seed does not make true yet)

- **This week in 4,884,000** (money in this week): the seed's week does not add up to it.
- **Nansana's 90,000 over** (OR15/OR16): her 560,000 is in the cash book and 470,000 of it cleared her bills; the 90,000 waits for Give change or Deposit, which the Orders tab models.
- **#0537** is seeded voided (so Nansana owes 0); OR23 draws it before Ruth voids it.
- **After-10:41 boards** (OR08, OR09, OR12, OR13: #0552 on the road and delivered, #0559 Lubowa at 13:50) need `&clock=` plus the Orders tab's own `extra` rows.
- **TD06** says "30 days left"; at Sat 17 Oct it is 14 (FACTS §1 gives 30 for Thu 1 Oct).
- The 32 background customers' names are the demo's own (not in `docs/canvas-cast.md`); costs are the shop's price less 25%.
