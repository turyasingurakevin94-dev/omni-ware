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
| `chats/new` | — | chats | CH05 |
| `sell` | — | sell | SL01 Who (the red +) |
| `sell/order` | `{ customer?, from?: 'chat' \| 'usual' \| 'again', chat?, items? }` | sell | SL03–SL27, SL30, SL31 |
| `sell/placed` | `{ id }` | sell | SL28, SL29 |
| `counter` | — | counter | KC01 |
| `counter/sold` | `{ id }` | counter | KC14–KC16 |
| `orders` | `{ stage? }` | orders | OR01–OR04 |
| `orders/order` | `{ id }` (e.g. 552 is Kato's #0552, OR07) | orders | OR05–OR26 |
| `customers` | `{ filter? }` | customers | CU01–CU08 |
| `customers/customer` | `{ id }` | customers | CU10–CU15 |
| `customers/new` | `{ phone?, name? }` | customers | CU20–CU23 |
| `customers/pay` | `{ customer, bills?: number[] }` | customers | CU30–CU36 |
| `customers/paid` | `{ id }` | customers | CU40–CU43 |

## Rules

- **Links follow the canvas's ruling** (`docs/canvas/sales-agent/BRIEF.md`, "Lead ruling · links").
  - A control opens THAT customer's or THAT order's own screen.
  - A list screen opens only for a list action.
- **Sheets are not routes.** A sheet opens with `sheet.open(...)` inside its own tab's code.
  - If another tab needs that tab's sheet, the owning tab exports a function from its `index.tsx` (for example `export function openSomethingWrong(id)`) and lists it below.

## Exported sheets

| Function | Owner | Boards |
|---|---|---|
| _(add as built)_ | | |
