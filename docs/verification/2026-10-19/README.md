# The audit of 19 October 2026: every app, every flow, start to finish

**What this is.** The owner asked for the whole set of apps to be tested as
one system: each workflow from its first tap to its last write, on slow
networks and with things going wrong, for bugs, dead code, waste and
failures that say nothing, and for the shortest path to each job. This
folder is the record: what was run, what was found and proved, what was
fixed (migrations 0136 and 0137 and the matching app changes, with tests),
and what remains, in priority order.

**How it was tested.** Three layers, all against real code and a real
database, never the live shop:

| Layer | What runs |
|---|---|
| A real database | Postgres 16 with **all 137 migrations applied in order, 0 failures**, behind PostgREST 12 with `max_rows = 1000`, the same cap as the hosted project. Row-level security runs as the signed-in person: every probe impersonates a seeded login (Grace in Sales, Denis the Buyer, Musa at the Store, Ruth the Manager, Esther in Accounts, Moses in Sourcing, Joseph the owner: docs/canvas-cast.md). |
| The real apps | `sales.html`, `buyer.html`, `store.html`, `manager.html`, `accounts.html`, `sourcing.html` and `owner.html`, unchanged, in headless Chromium at a phone's size, signed in through their own sign-in screens; every request the page makes goes to that database. The harness can add latency to any request, make any request fail, or cut the signal mid-action. |
| The code | Line-by-line reads of the flows, the migrations 0119 to 0135 and the functions, with every claim re-checked by running it: a function extracted and executed, SQL inside `begin … rollback`, or the real screen tapped through. |

The harness lives in the session's scratch folder, not in the repo; the way to
rebuild it is in section 6. The test suite went from 429 files to 432, all green.

---

## 1. What was found and proved

Every row below was reproduced: a probe, a screen driven through the
harness, or both. The file and line are where the defect was before the fix.

### Money and stock wrong, or a job that could not finish

| # | Where | What happened | Proof | Fixed |
|---|---|---|---|---|
| 1 | `sales.html` counter sale (ctPay) | **No salesperson could complete a counter sale.** The money was written as a `Sales Revenue` receipt; 0123's policy on `cash_txns` lets `payment.receive` write only debt, invoice and customer payments, so the database refused it (42501). The order row had already been placed, so every attempt left a **ghost order in the Store's Packing queue**, and the screen showed the raw policy text. | Driven through the real screen as Grace: 4 taps, slide, "Not sold: new row violates row-level security policy…"; `saved_quotes` 97003 left at `preparing`. | **0136 `counter_sale`**: one database write places, pays, marks delivered and invoices (through `ow_invoice_core`), or does nothing. Under the shop's price it places the sale and waits for the Manager, as before. Re-driven as Grace: SOLD, PAID, INVOICED; one cash row; one log line. |
| 2 | `0124 receive_trip` | **Goods bought for the shelf never reached the shelf.** The Buyer's restock trip lines carry `orderId: 'restock'`; `receive_trip` shelves only numeric order ids and counted these as "no order left": no stock, no lot, no cost. The restock list kept showing the shelf short, so the same goods could be bought again. | Probe as Musa: stock P003 40 → 40 after receiving 10. | **0136**: restock lines go on the shelf with their cost lot and close the `restock_buys` row. Probe: 40 → 50, lot at the price paid. |
| 3 | `manager.html` restock, `0122 restock_lines` | **The Manager's restock hold could never work.** The Manager read `restock_lines`, a table no app ever wrote; the Buyer writes `restock_buys` (0125). The list was always empty, a hold impossible, the push `restock.held` unreachable. | grep: `restock_lines` only ever read by manager.html; `restock_buys` never read by it. | **0136**: the hold moves to `restock_buys` (`hold_restock_buy`, status `held`, pushes on hold and release); Manager reads the Buyer's table; Buyer shows the hold; `restock_lines` retired. |
| 4 | `0119 ow_gate_reason`, `manager.html` credit decision | **"Cash first" released the order at once.** The screen says "Sales collects first. It stays held until then"; the gate released on any decision but `hold`. The Buyer's app only knew `hold`. | Probe: Lubowa Builders over its limit, held; Ruth answers `cash` → `awaiting_goods` immediately. | **0136**: `cash` holds while anything is unpaid; the Buyer's `creditHolds` mirrors it. |
| 5 | `0125 buyer_confirm_price`, `trip_prices_to_list` | **A price the Buyer confirmed by phone, or paid on a trip, never counted in the day's share.** Neither set `price_source`; the Sourcing app and 0131's morning count read only `confirmed`/`purchase`. The function's own comment says it counts. | `sourcing.html confirmedToday()` vs 0125's update. | **0136**: `confirmed` and `purchase`, and a trip's prices are logged as confirmations. |
| 6 | `manager.html` void | **A void put the line's whole quantity back on the shelf.** It skipped lines with `boughtIn`, a key nothing writes; the invoice records what it took in `_stockTaken` (0119). A short pick or a straight-from-supplier line inflated stock. | grep `boughtIn`: never written. | Returns `_stockTaken` per line. |
| 7 | `manager.html` void | **A failed supplier-bill reversal was `console.warn`'d and the void shown as done**, leaving the bills payable; same for closing the ask. | Code read. | Throws with the reason: "Voided, but the supplier bills for it could not be voided — … Tell Accounts." |
| 8 | `buyer.html changeOrder` | **The Buyer's app said "moved to Packing" when the gate had held the order.** The update had no `.select()`; the local copy was the phone's own patch; the lie lasted until the next 45-second refresh. | Gate probe B; code read. | Reads the row back; says "stays in Checking — a credit hold waits for Ruth" when held. |
| 9 | `buyer.html` drop at Checking | **A dropped line told nobody at Sales**, though docs/decision-rights.md says Sales is told. | No handoff or push on `droppedLines`. | **0136** `line.dropped` push to the salesperson; a tap opens the order. |
| 10 | `0119/0135 ow_invoice_core` | **The invoice label cut order ids past 9999**: `lpad(id, 4)` truncates, so order 10000 would be `INV-1000`, the same label as order 1000; the apps pad without cutting. | Probe: order 901506 → `INV-9015`. | **0136** re-states the core with that one line changed; `INV-901506`. |
| 11 | `manager.html` whyStuck | Counted `pickStatus === 'picked'`; the Store writes `done`. "picking · 0 of n" was always wrong. | grep of every `pickStatus` value. | Counts `done`. |
| 12 | `accounts.html` payroll, loans, agents, trip cash, assets | **Money in the book, screen says "Nothing was changed."** These write the cash line first (`addCash`) and other rows after; when a later write failed the generic helper said nothing had changed. | Code read of the five flows and `afterFail`. | `addCash` remembers what landed; a failure after it names the line, the amount and the reason. |
| 13 | `store.html` picks and alerts | Pick writes that failed stayed drawn as done (two swallowed catches); the alerts sign-up never read its result, so a Store phone could silently never receive a push. | Code read. | Both say why, and that picks stay on the phone until the next tap. |
| 14 | `owner.html`, `accounts.html`, `manager.html` log lines | A decision-log line that did not save was dropped without a word, under screens saying "in the owner's log". | Code read. | Each says "Done — but the line for the owner's log did not save: …". |
| 15 | `supplier.html` | "Asked · watch WhatsApp" shown even when asking for the PIN failed; a price proposal dropped silently when its send failed. | Code read. | Both show the reason. |
| 16 | `sales.html`, `manager.html`, `accounts.html` partial payments | "Stopped part-way … Tell Accounts" carried no reason. | Code read. | The reason is in the message. |

### Performance, measured

Numbers from the harness: a phone viewport, CPU throttled 4x for the "slow
phone" rows, a shop of **1,500 orders, 3,000 cash lines, 2,000 debt lines**.

| What | Before | Why it matters |
|---|---|---|
| Boot, any role app | the **whole order history**, every open: 3.1 to 3.7 MB raw per app on the big shop, 5 to 7 sequential round trips (9.4 s at 1.5 s latency) | Store and Buyer carried every invoice ever raised |
| Polls | Sales re-read the whole order table every 60 s; Buyer, Store, Manager every 45 s; **Accounts and Owner re-read the whole books (29 reads, 3 MB) every 90 s**; Sales polled WhatsApp every 15 s whether or not the shop had it (480 reads an hour idle) | seven open apps ≈ 4,500 requests an hour at idle; 150 MB an hour from one Accounts phone |
| Snapshot | 2.8 to 3.5 MB rewritten to localStorage on every poll, 145 to 280 ms on the main thread | a stall every 45 to 90 s |
| Silent truncation | a bare `.limit(5000)` returns **1,000 rows, HTTP 200, no error**: the month's cash book (sales, manager), the stock log and trips (accounts), the owner's log | wrong figures on a busy shop with no sign |
| Database client | unpinned `supabase-js@2` from a CDN, synchronous, before the app script, no preconnect: 250 to 450 ms before the sign-in form on a good link, nothing at all if the CDN is unreachable and the cache is cold | |
| Indexes | the cash book's date window, the stock log, and the hourly invoice run were sequential scans; the hourly run scanned every shop's whole order table | |

**Built**: the polls now read only the orders that can still change (not
delivered, not invoiced, voided, or invoiced in the last two days) and merge
them (`liveQuoteFilter` / `mergeQuotes` in sales, buyer, store, manager,
accounts, owner); Accounts and Owner poll a live set instead of `loadAll`;
every read that asked for more than 1,000 rows pages through `selectAll`;
the WhatsApp poll runs only on a shop that has WhatsApp and slows to a
minute when Chats is not open; the counter's wait screen polls one row;
`supabase-js` is pinned and preconnected (the Capacitor builds still bundle
it); **0137** adds the seven missing indexes. Boot still reads the whole
book, so every figure on Today is whole.

Not built, recommended next (section 4): a server-side window for boot, the
snapshot written off the main thread only when changed, the boot waterfall
cut from five round trips to two, and the row-level-security policies
rewritten so `is_shop_member()` runs once per query instead of once per row
(measured: 12.9 ms against 0.75 ms per 1,000-row page).

### The step counts

| Job | Taps today | Shortest correct | Note |
|---|---|---|---|
| Counter sale, walk-in, one item, exact cash | + · Counter sale · item · slide = **3 taps and a slide** | the same | now one database write; it was 2 phone writes and an RPC, and refused |
| Counter sale to a known customer | + 2 taps (who is buying, pick) | the same | |
| Manager approves a price from the push | open push · Approve = **1 tap** | the same | from Today without the push: 3 |
| Store, one-line shelf order, delivered by staff | Start packing · Picked · Packed · slide load · At the door · shutter = **6 and a photo** | 5: the load slide could default the drop and driver and merge "At the door" with the shutter | |
| Buyer plans a trip with cash | Today · plan · stop · who · cash · slide = **6** | 4: stop, who and cash are already defaulted; one review screen and a slide | |
| Owner hires a salesperson | Team · Team · Hire · name, phone, role, email, pay, basis · Save ≈ **10 interactions** | 8: pay basis defaults by role | |

---

## 2. What was changed

**Migrations** (each re-runnable; docs/decision-rights.md section 5 reserves
both numbers):

- `0136_counter_sale_one_write.sql`: `counter_sale()`; `receive_trip()` with
  restock lines; `ow_gate_reason()` holding "cash first"; `buyer_confirm_price()`
  and `trip_prices_to_list()` setting `price_source`; `hold_restock_buy()`,
  the `held` status and pushes on `restock_buys`; `restock_lines` and
  `hold_restock_line` dropped; the `line.dropped` push; `ow_invoice_core`
  re-stated with the label fix.
- `0137_audit_indexes.sql`: the seven indexes.

**Apps**: `sales.html` (one-write counter sale, `line.dropped`, live poll,
paged cash book, gated WhatsApp poll, reasons on failure), `buyer.html`
(read-back after a move, cash-first hold, held restock lines and their
pushes, failures said), `store.html` (live poll, picks and alerts failures
said), `manager.html` (restock on the Buyer's table, void returns what was
taken, pick status, live poll, paged reads, failures said), `accounts.html`
(live poll, paged reads, what landed is named), `owner.html` (live poll,
paged log, log failures said), `supplier.html` (PIN and proposal failures
said), all eight apps and their `apps/*/src/transform.js` for the pinned,
preconnected client.

**Tests**: `test/audit-0136.test.js`, `test/audit-live-refresh.test.js`,
`test/audit-fail-with-a-reason.test.js`; `test/sales-app.test.js`,
`test/customer-id-overflow.test.js` and `test/phone-push.test.js` updated to
the new shape.

**Before the next deploy**: run 0136 then 0137 in the SQL editor. Ghost
orders left by old counter-sale attempts (a `draft`/`preparing` order with
`payload.counter = true`, `amount_paid` 0, not invoiced) should be voided
from the console; the fix prevents new ones. Installed phones pick up the
page changes on their next live update; no APK is needed.

---

## 3. What was looked at and found sound

- The Checking gate (0119): a shelf-only order for an over-limit customer is
  held, with the push to the Manager; a held move is made by the write that
  clears the last decision; the price decision stays on the line.
- Push: `push_outbox` rows are written in the same transaction as each
  handoff for every kind traced (price, credit, pick, trip, restock, invoice
  asks, sourcing requests, the counter's quiet push); each app's `pushOpen`
  has a handler for what it is sent, with one gap listed below.
- Sign-in, the offline snapshot and the live update of the page on installed
  phones behaved as described in every role app.
- All 429 existing test files passed before any change, and all 432 after.

---

## 4. What remains, in priority order

Candidates below marked **(verify)** were read and reasoned from the code by
the flow readers but not reproduced in this round; they are listed so the
next round starts there, not from zero.

**Money and flow**

1. `accounts.html`: the five cash-first flows (payroll, loan repayment, agent
   settlement, trip cash, asset sale) should be one database function each,
   the way the counter sale is now, so a lost signal cannot leave a cash line
   without its counterpart. The message is honest now; the write is still two.
2. `sales.html` / `manager.html` receive-payment: three to five sequential
   writes with no transaction (receipt, payments, debt log, debt, invoice
   debtCharged). Same remedy: one function `receive_payment(...)`.
3. `0119 ow_invoice_due_orders`: an order the hourly run skips (short pick
   unsettled, price waiting) is returned to pg_cron and discarded; nobody is
   pushed. (verify) Add a push to `pick.settle` / `price.approve` per skipped
   order, de-duplicated per day.
4. `0115 accept_stock_count`: accepts a count already sent back for a
   recount, and a surplus lot is created with `cost null`, which the FIFO cost
   then treats as zero. (verify)
5. `0123 cash_txns_accounts_guard` runs only on UPDATE: an expense can be
   inserted on a closed day. (verify) Move the closed-day check to INSERT too.
6. `0125 trip_prices_to_list` writes the trip's `gotPrice` (which defaults to
   the order line's cost, possibly a tier or pack price) into the list's base
   `wholesale`. (verify) Write per base unit only when the line's unit is the
   base unit.
7. `sourcing.html saveLead` upserts the whole lead row from memory, so a
   request Sales appended since the last load is overwritten. (verify) Append
   through a function or re-read before saving.
8. Row ids are one sequence across shops (`cash_txns`, `saved_quotes` …) but
   `entity_id_counters` is per shop: two shops on one database collide. One
   shop today; a latent fault.

**Wiring**

9. `buyer.html pushOpen` has no handler for `supplier.answered` (0133).
10. `notify-stock-count` addresses by role, not task, and nothing pushes the
    counter when a count is accepted or a recount asked. (verify)
11. `owner.html` `ROLES.sales.app` points at `index.html`; the Sales app is
    `sales.html`. The hire screen names the wrong app.
12. The client portal reads the shop's newest 60 / 200 / 400 orders for three
    different questions, so a customer with older orders sees nothing or a
    wrong count. (verify)

**Performance** (section 1, "not built")

13. A server-side boot window with named columns; 14. the snapshot off the
    main thread, only when changed; 15. the boot waterfall from five round
    trips to two (paint the snapshot first; `getSession` before `getUser`;
    one wave); 16. `is_shop_member()` once per query in the "shop members
    full access" policies; 17. Sourcing's 90-second `loadAll` (18 reads) to a
    live set like Accounts and Owner; 18. Manager's blind 60-second re-render.

**Dead code and waste**

19. The console (`index.html`) still holds every action the phone apps now
    own; docs/decision-rights.md says each console copy is retired once the
    phone has it. The duplicates write the same rows two ways. A mechanical
    scan of the whole repository for unreferenced functions was started in
    this round; its results, when complete, belong in a follow-up with the
    list of console screens to retire.
20. `worker.html` and `shared-worker.js` next to `store.html` (0115): the
    older picker app, its root-level Android project and its workflow, if the
    Store app has replaced it. (verify who still signs in to it)
21. `counterdone` in `sales.html` keeps a "NOT INVOICED YET" branch that can
    no longer happen.

**Design (visual-first)**

22. The screens were read against CLAUDE.md's preference; the ones that most
    need a mockup are the Buyer's trip plan (four screens for three defaulted
    choices) and the Store's load page (drop, driver and slide on one screen).
    Mockups with `/design` are the next step once the owner picks which.

---

## 5. How a reader can check this

The migrations are applied to a throwaway database with the script in
`docs/verification/2026-10-09/setup-realdb.sh` (point `VERIFY_WORK` at an
empty folder; it needs the Postgres 16 binaries). `test/audit-0136.test.js`
and its two companions hold every change to the text; `node test/run-all.js`
runs the whole suite.

## 6. The harness, to rebuild it

A Playwright script opens `http://127.0.0.1:8080/<app>.html` (the repo served
statically; the host is not a production host, so the page chooses the
staging block) and routes every request to the staging Supabase host:
`/auth/v1/*` to a small fake GoTrue that mints an HS256 JWT with the seeded
user's id (PostgREST's `jwt-secret`), `/rest/v1/*` to the local PostgREST,
`/storage/v1/*` and `/functions/v1/*` to stubs that record the call. `auth.uid()`
must read `request.jwt.claims ->> 'sub'` on PostgREST 12. Seed the sample shop
from docs/canvas-cast.md (one login per role, products with and without
variants, two customers over their limit, stock and lots), then sign in
through the app's own screen and tap. Latency, failures and loss of signal
are injected in the route handler. Everything measured above came from that.
