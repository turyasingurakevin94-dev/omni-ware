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
