# Manager app audit log

One entry per round, newest last. Each round's checklist is in `docs/audit/manager/ROUND-<N>.md`. The skill is `.claude/skills/omni-ware-round/SKILL.md`. Words shared with the other apps are in `docs/audit/GLOSSARY.md`.

Canvas: https://claude.ai/artifact/BifNESucDq7sMriL9jVNGf

## Round 1 · Data and money integrity (25 Oct 2026) · MGR-DATA-01..15, MGR-WORD-01

**What changed**
- **One balance, from the bills.** Every money screen shows opening balance + what the invoices still owe; a stored figure that disagrees says "Doesn't add up" and asks Esther.
- **Money can't drift.** A payment's receipt must match in amount, account and order, and can't be shared; cash is whole shillings; stock and its lots must agree at every commit (strict, Kevin 25 Oct), the console saves both in one call.
- **A void with money asks** Refund or Keep as deposit.
- **Free is a choice.** A 0 line needs "given away" with a reason, else To price; a bill under 1,000 gets a second look.
- **Losses and gaps are visible:** below cost, given away, no cost recorded, no seller, orders to price.
- **One order format, #0543.** Ended goals say reached or missed. Look-alike customers are merged by the Manager.

**Design decisions**
- Merging is the Manager's, through a new task `customer.merge` (Sales also holds customer.edit) (Kevin, 25 Oct).
- #0166 and #0148 are test data: marked test, no refund (Kevin, 25 Oct).
- Pricing has no default markup when 0 is saved; the screen says so instead of showing 25%.

**Deploy order**
1. `index.html` (console: stock and lots in one call once 0169 exists)
2. `supabase/migrations/0169_manager_money_integrity.sql`
3. At once, `docs/audit/manager/round-1-correct.sql` (prerequisites, REPORT, then the run); until it runs, a stock move on a drifted key is refused
4. `docs/audit/manager/round-1-check.sql`: queries 1, 2, 5, 7, 8, 9, 11 empty
5. `manager.html`, `accounts.html`

**Deferred**
- A push to the owner (the "link her login" ask goes by WhatsApp).
- A way to set a seller on an old invoice.
- Some Store and agent tests print failures but exit 0 (outside this round).
