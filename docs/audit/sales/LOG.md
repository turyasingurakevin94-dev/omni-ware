# Sales app audit log

One entry per round, newest last. Each round's checklist is in `docs/audit/sales/ROUND-<N>.md`. The skill is `.claude/skills/omni-ware-round/SKILL.md`. Words shared with the other apps are in `docs/audit/GLOSSARY.md`.

Canvas: https://claude.ai/code/artifact/9db8c76a-d77f-4312-a3c1-442d10005ea7 (round 1 boards: `R1SignedElsewhere`, `R1SignedElsewhere1280`, `R1PayOver`, `R1OldOver`, `R1ToPrice`, `R1AddsUp`, `R1QtyZero`, canvas v129)

## Round 1 · Data integrity (23 Oct 2026) · SAL-002..014

**What changed**
- **One write per payment, checked by the server** (0165). A payment needs its receipt, paid is the sum of the payments, a count or price is never below 0, credit notes never exceed the bill, and a stale copy of an order can't wipe a payment (`ow_patch_order`).
- **Paying over is a choice.** Change by default; a deposit only when a named customer confirms. A deposit shows as "Deposit", green, and the next bill uses it first.
- **To price.** A line nobody priced is in no total; the order and Today say so.
- **Doesn't add up.** A balance that disagrees with its bills says so, and asks Esther to check it.
- **Sales keeps its own sign-in**, and stops writing the moment another login is under it.
- Manager, Buyer, Accounts and the console write through the same functions.

**Design decisions**
- The stored balance stays; the server keeps it in step with each invoice (`saved_quotes_zz_sync_debt`). A computed balance comes in a later round (Kevin, 23 Oct).
- Money beyond what is owed is never assumed: the person taking it chooses, there and then (Kevin, 23 Oct).
- The correction of old rows is one guarded script, with the choices that need Kevin as switches.

**Deploy order**
1. `supabase/migrations/0165_sales_money_holds_together.sql`
2. `docs/audit/sales/round-1-correct.sql` (REPORT first, then the switches, then the run)
3. The apps: `sales.html`, `manager.html`, `buyer.html`, `accounts.html`, `index.html`, and the `check-momo-payment-status` function

**Deferred**
- The console prices a line nobody priced at cost on its own screens (its next round).
- Taking an invoice back from the console (now the Manager's; the console's path is refused when it would drop a payment).
- The Manager listing invoiced orders with lines to price (next Manager round).
- The other apps' shared sign-in (each app's own round).
- Boards for the Manager and Accounts over-payment cards.

## Round 2 · Core workflows (24 Oct 2026) · SAL-015, SAL-016, SAL-018 (SAL-017 to round 5)

**What changed**
- **A count that can't be goes back.** A count under 1 in the order line or the counter sale puts the box back to the line and says "At least 1 — use the bin to remove it". Replaces round 1's red 0.
- **Credit with no limit set is the Manager's yes.** The order waits in Checking; the Manager is pushed; Release moves it on, Cash first holds it until paid. Within a set limit, nothing changes.
- **Test records stay out of every figure.** Marked test (a "TEST …" name or a TESTQA ref), kept and listed, never counted: not sales, not money in, not the goal, not the cash book.

**Design decisions**
- The test mark is set by the server, never by hand on the phone, and nothing is deleted (Kevin, 24 Oct: keep the test data; it was never cash).
- The reopened data items are one script with Kevin's choices as switches: `round-2-correct.sql`.

**Deploy order**
1. `supabase/migrations/0165_sales_money_holds_together.sql` (if not yet run), then `0167_sales_credit_and_test_records.sql`
2. `docs/audit/sales/round-2-correct.sql` (REPORT first, then the run)
3. The apps: `sales.html`, `manager.html`, `accounts.html`, `index.html`

**Deferred**
- SAL-017 (cost on the sales phone) to round 5, Roles and privacy.

## Round 3 · Core workflows, on the new app (10–12 Nov 2026) · SAL-015, SAL-019, SAL-021..026 (SAL-020 open)

**What changed**
- **A count stays at least 1.** − at 1 leaves 1, greyed, and says to use the bin; the line and the total never show a count that isn't on screen (SL14).
- **Which shop?** A sign-in that opens more than one shop asks which, once; kept on the phone until sign-out (TD28).
- **A link keeps its colour after a tap.** A stuck touch hover turned white link-buttons ink on navy ("New customer", "Add · 153,000").
- **A line's Undo goes with its order**, never over another tab. "1 item", not "1 items".
- Stuck writes (SAL-021) and the price keypad's still keys (SAL-023) were built by cross-app round 1 on main; this round drew the canvas to them.

**Design decisions**
- The missing orders were not the app: Kevin restored a 25 Aug backup in the owner console between 5 and 10 Nov, which deleted every newer row on the server. The books need restoring from a Supabase backup before rounds can be checked on live data.
- SAL-020 is Kevin's: 0165 (balance is the truth) and 0169 `ow_customer_balance` (log + bills) disagree, and on the restored data the log names no orders.

**Deferred**
- SAL-020 and SAL-011 (Kevin's choice of rule), SAL-024 (re-check on restored data), SAL-010/012/013/018 (re-check on restored data), SAL-017 (round 5).
