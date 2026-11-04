# Routes: the contract between tabs

A screen in one tab opens a screen in another tab only through the ids below. Each id belongs to one tab; that tab's builder registers it in its own `index.tsx`. To add a cross-tab entry, add a row here in the same commit.

| Id | Params | Owner | Canvas boards (the default state first) |
|---|---|---|---|
| `today` | — | today | TD01 (TD02–TD10 are its states) |
| `today/to-collect` | — | today | TD05 |
| `today/find` | `{ q? }` | today | TD11–TD14 |
| `today/goal` | — | today | TD15 |
| `today/day` | `{ view?: 'placed' \| 'money' }` | today | TD16, TD17, TD25 |
| `today/you` | — | today | TD18 |
| `today/asks` | `{ id? }` | today | TD19–TD24 |
| `today/signed-elsewhere` | — | today | TD10 (the shell uses it) |
| `chats` | `{ filter?: 'mine' \| 'waiting' \| 'new' \| 'team' }` | chats | CH01–CH07 |
| `chats/chat` | `{ id }` (a conversation id; demo ids match FACTS) | chats | CH10–CH33 |
| `chats/new` | `{ q? }` (`q`: what was typed in the Chats search, CH18's "Not here?") | chats | CH05, CH09, CH19 |
| `sell` | `{ items?, aisle?, then?: 'ask' }`: `items` and `aisle` carry on to the order once the customer is picked (Today's "Put X on an order", "Or open an aisle", "Sells most"); `then: 'ask'` comes back to Ask Moses with the customer picked: `openAsk({ customerId })` (what was typed is kept) | sell | SL01 Who (the red +) |
| `sell/order` | `{ customer?, from?: 'chat' \| 'usual' \| 'again', chat?, items?, aisle?, draft? }`: `customer: ''` is a walk-in; `items` a JSON string of `[{ itemId, qty, price? }]` put in the order (Counter's "Order in", KC07/KC18; Today's "Start Kato's order with…", "Start their order" with the quantity chosen); `aisle` opens the order at that aisle (SL12; Today's "Sells most" / "Or open an aisle"); `draft` an order still open; `chat` the conversation it came from (Today's "Reply to Lubowa") (CH14's Start order sends `{ from: 'chat', chat, items }`, with no prices) | sell | SL03–SL27, SL30, SL31 |
| `sell/aisle` | `{ aisle, group? }`, or a shelf `{ group: 'usual' \| 'new' \| 'most' }` | sell | SL12 |
| `sell/placed` | `{ id }` | sell | SL28, SL29 |
| `counter` | — | counter | KC01 |
| `counter/sold` | `{ id }` | counter | KC14–KC16 |
| `counter/wait` | `{ id }` (the counter sale waiting for the Manager's price) | counter | KC11 |
| `counter/receipt` | `{ id }` | counter | KC16 |
| `orders` | `{ stage?, q? }` (`q`: the Find query, written into the params whenever the list is left, `''` once cleared, so Back lands on the search, OR29 → OR30, or on the full list) | orders | OR01–OR04, OR30 |
| `orders/order` | `{ id }` (e.g. 552 is Kato's #0552, OR07) | orders | OR05–OR13, OR22 (OR10–OR26 are its sheets) |
| `orders/paid-over` | `{ payment }` (a cash-book id; 9002 is Nansana's 560,000) | orders | OR15, OR16 |
| `orders/receipt` | `{ id }` (an order id: its Receipt tile, OR05–OR33) | orders | OR34 (prices final), OR35 (as it stands), OR36 (voided, chat shut), OR37 (paid, a walk-in with no number) |
| `customers` | `{ filter?: 'owe' \| 'due' \| 'quiet' \| 'all', q?, pick? }` (`pick`: an order id; the row tapped becomes who owes its rest, CU34) | customers | CU01–CU09 (CU09: the Quiet chip) |
| `customers/customer` | `{ id }` | customers | CU10–CU17 (CU16: nothing owed; CU17: past the hold) |
| `customers/new` | `{ phone?, name?, chat? }` (`chat`: the conversation it comes from, CH14) | customers | CU20–CU23 |
| `customers/pay` | `{ customer, bills?: string, then?: string }` (bills: order ids joined by commas, "544" or "531,544", never a bill Accounts is checking; it may name a live order held for the money, and `debt` for a charge that names no order, such as an opening balance), or `{ order }` for a walk-in's order before its invoice (CU34); `{ customer, order }` from an order's own Take payment pays that order alone (its bill once invoiced, else the order); `{ customer, fix, paid }` opens a refused kept payment again to fix it (`fix`: its outbox id, `paid`: its Paid entry; CU46); `then`: the customer ids to take next, joined by commas: once paid, open `customers/pay` for the next (Today's Play all) | customers | CU37 (all, cash), CU30–CU36 |
| `customers/paid` | `{ id }` | customers | CU40–CU47 (CU44: not sent yet, no signal; CU45: Try again, still no signal; CU46: refused; CU47: thrown away) |

## Rules

- **Links follow the canvas's ruling** (`docs/canvas/sales-agent/BRIEF.md`, "Lead ruling · links").
  - A control opens THAT customer's or THAT order's own screen.
  - A list screen opens only for a list action.
- **A tapped push opens a route here**, never a screen of its own: the one map is `shell/pushes.ts` (push kind → id and params, from the push's data), opened by `shell/open-push.ts`; `test/sales-push-routes.test.js` checks every id it opens is in this table.
- **Sheets are not routes.** A sheet opens with `sheet.open(...)` inside its own tab's code.
  - If another tab needs that tab's sheet, the owning tab exports a function from its `index.tsx` (for example `export function openSomethingWrong(id)`) and lists it below.

## Exported sheets

Every tab but Today is its own file, loaded when first opened (docs/spec/07-stack.md §4). So another tab calls these through `callTab` (`shell/tabs.ts`), never by importing the owning tab's files (the build refuses that): `callTab('orders', 'openTwice', id)` loads Orders first if it is not here yet. A route id (`nav.push`) of a tab not loaded yet shows the loading state and then the screen. Today's own exports may be imported directly: Today is in the page.

| Function | Owner | Boards |
|---|---|---|
| `openAsk({ name?, qty?, customerId?, chatId?, quote? })` | today | TD23, TD24 (Ask Moses for something we don't sell; a chat can pass what they said; after `sell { then: 'ask' }`, only `customerId`: what was typed comes back) |
| `openTell(i)` | today | TD04 (the i-th thing to tell: a new price here, an item that came in opens `today/asks { id }`) |
| _(add as built)_ | | |
| `openTell(orderId)` | orders | OR10, OR11 (over the order on screen) |
| `openChange(orderId)` | orders | OR17 → OR18; a live copy entered twice goes to OR19 |
| `openTwice(orderId)` | orders | OR19 (live), OR23 (invoiced): either order of the pair; TD16's copy row |
| `openWrong(orderId)` | orders | OR20 "Something wrong" → OR21, OR24 → OR25, OR26; an invoiced copy goes to OR23 |

A sheet opens over whatever is on screen; to show it over its order, `nav.push('orders/order', { id })` first, then call it.
