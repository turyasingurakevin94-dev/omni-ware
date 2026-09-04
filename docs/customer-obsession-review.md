# Does Omni-Ware obsess over the hardware shop's problems?

A review of this system against Jeff Bezos's stated bar for customer obsession,
using the shop's own operating problems as the test.

Two evidence bases sit under this document:

- **The bar.** Bezos's shareholder letters (2016 and 2017), taken from the
  primary texts. Verified quotes only; the passages people usually cite as
  his *test* for customer- versus competitor-obsession do not exist, and that
  is noted below rather than papered over.
- **The system.** This repository, read directly: 277 test files, ~4 MB of
  `index.html`, the Supabase schema, and the two satellite apps. Line
  references are to the tree at the time of writing.

---

## 1. What the bar actually is

Bezos does not define customer obsession as "be nice to customers". Four
things in the letters make it an operating discipline:

**It is one of four named defences, not a value.** *"Here's a starter pack of
essentials for Day 1 defense: customer obsession, a skeptical view of proxies,
the eager adoption of external trends, and high-velocity decision making."*
(2016 letter.) Each is a section with mechanics under it.

**The mechanism is permanent latent dissatisfaction.** *"Customers are always
beautifully, wonderfully dissatisfied, even when they report being happy and
business is great. Even when they don't yet know it, customers want something
better... No customer ever asked Amazon to create the Prime membership
program, but it sure turns out they wanted it."* (2016.) And: *"they are
divinely discontent. Their expectations are never static – they go up...
yesterday's 'wow' quickly becomes today's 'ordinary'."* (2017.)

The consequence he draws is the sharp one: holding your service level
constant is relative decline.

**The measurement discipline is explicitly anti-survey.** *"Market research
and customer surveys can become proxies for customers – something that's
especially dangerous when you're inventing and designing products. '55% of
beta testers report being satisfied with this feature. That is up from 47% in
the first survey.' That's hard to interpret and could unintentionally
mislead."* The substitute he names: *"They study and understand many
anecdotes rather than only the averages you'll find on surveys."*

**Decisions move at 70% of the information you wish you had**, with
"disagree and commit" and immediate escalation as the named tools.

**One correction worth making.** The widely-repeated line that Bezos gives a
*criterion* separating customer-obsessed from competitor-obsessed companies —
the "four centres of gravity" framing — did not survive checking against the
2016 letter. He describes the orientation; he does not supply a test. So the
honest bar here is behavioural: *does the work start from a customer problem
nobody reported, and does it get measured against whether the customer is
better off?*

A note on the market research behind this document: a broad web pass on East
African hardware-retail operating problems returned almost nothing verifiable.
What did survive is about payments — Sub-Saharan Africa's ~44 million MSMEs
are largely informal and transact predominantly in cash, and merchants have
two documented reasons to stay there: merchant discount rates of roughly
0.5–3% of transaction value on thin margins, and the tax visibility digital
records create, with KRA and URA already mining merchant payment data. That
finding matters for §4 below. Everything else about cement, iron sheets,
contractor credit and BOQ quoting is *unresearched externally* — but this
repository contains better primary evidence than any of those sources would
have: it cites a real shop's real figures throughout.

---

## 2. The verdict

**On the first two tests, this system clears the bar by a distance most
commercial software does not reach.** It is built by working backwards from
one real hardware shop's actual failures, it repeatedly invents things that
shop never asked for, and it holds itself to consequences rather than
features.

**On the third test — measurement, and the breadth of the anecdote base — it
does not clear the bar yet.** There is no instrumentation of any kind, no
channel by which the shop tells the builder anything, and the anecdote base
is one shop seen through one pair of eyes.

**And there is a fourth problem the bar exposes that is not about method at
all: the moments when the shop most needs the system are exactly the moments
it does not work** — no network, day one, and the day the shop grows past what
the system models.

---

## 3. What we have done

### 3.1 The work starts from real failures, with the money named

This is the strongest evidence in the repository, and it is unusual. The
tests do not describe features; they describe the failure that caused the
feature, in the shop's own figures.

- **A purchase billed twice.** *"Save on the restock screen awaited a PINV
  number from the server and the button stayed live while it did, so a second
  press entered the whole purchase again. A shop found PINV-0143 and PINV-0144
  for the same twenty cartons that way."* The press is now guarded — and,
  because the bad bills are already on the books, duplicates are *found* by
  what a duplicate is (same supplier, same day, same lines at the same
  prices), and asked about rather than assumed.
  (`test/duplicate-purchase-invoices.test.js`, `test/stock-count-vs-unbuy.test.js`)

- **Dead stock, priced.** *"5,310,000 across 2,207 units, unsold for over 60
  days — more than twice the 2,608,644 this shop holds in cash... The Manager
  has advised exactly that for weeks. It is one of the 23 advised moves out of
  25 that were never acted on, and the reason was plain: `dashInventoryHealth`
  knew the TOTAL and threw the per-line detail away... Advice with no mechanism
  under it is advice nobody can act on."* (`test/dead-stock.test.js`)

- **Stale prices, measured on the live shop.** *"Measured on the live shop
  when this was written: 2 of 307 rows had ever been written by the automatic
  path."* And the design consequence: the question is not what is old but
  *what does being old cost.* (`test/price-registry-freshness.test.js`)

- **A misplaced zero.** *"In a currency where an ordinary transaction runs to
  six or seven digits, 2500000 and 250000 are one keystroke apart."* Fixed by
  digit grouping as you type and the amount written out in words underneath,
  like a cheque. (`test/till.test.js`)

That is working backwards, done properly. Every one of those is a problem the
shop was living with and had not filed as a feature request.

### 3.2 It solves the hardware trade's problems, not generic retail's

Mapped against what a hardware shop actually fights:

| The problem | What exists |
|---|---|
| Running out of the lines that matter | Buying plan with **measured** supplier lead times (median arrival-to-order, never from a single delivery) plus an owner-set floor for staples (`restock-levels`) |
| Money dead on the shelf | Dead-stock screen naming the lines *and* who has bought them before, derived from one reading shared with the dashboard (`dead-stock`) |
| Supplier prices creeping | Price watch built from purchase invoices, ranked by **money not percentage** — "a 2% rise on the thing bought every week costs more than a 40% rise on something bought once" (`supplier-price-watch`) |
| Being undercut up the road | Rival price sightings, ranked by what a month of *this shop's own sales* is worth at the rival's price (`rival-prices`, `market-verdict`) |
| Contractors who owe | Chase queue with grace, rest and a balance-that-adds-up rule; a **promise ledger** where a changed mind is a second promise and a broken one is a fact about the customer (`debt-chase`, `payment-promises`) |
| Can the shop afford this week's buying | Shortfall plan across three non-interchangeable cash accounts — "money in the bank does not buy cement from a yard that wants cash this morning" (`admin-shortfall-plan`) |
| Goods that arrive short | Short-delivery tracking that stops six undelivered units being recorded as the picker's short pick (`short-deliveries`) |
| Goods that are not ours | Consignment: no bill on receipt, the lot marker survives sale and un-invoice (`consignment`) |
| One customer or supplier carrying the shop | Concentration risk, with the counter-sale trap handled — a hundred anonymous walk-ins under one label would otherwise read as total dependence on one "customer" (`concentration-risk`) |
| The counter | Real invoiced sales from the till, so revenue, cost of sales, stock and margin become true at once (`counter-sale`) |
| Selling on WhatsApp | Inbox, catalogue, broadcasts, and a **draft-first** quote assistant — nothing sends itself, ambiguity goes to the human as a question |
| Two naming systems on one shelf | A fastener guide pinned two ways: physical properties *and* literal anchor rows, because a wrong number sells someone the wrong drill bit (`fastener-guide`) |
| Paper at the counter | 80mm thermal receipt whose every figure comes from the same functions the A5 copy and the WhatsApp message use (`thermal-receipt`) |

### 3.3 It invents things nobody asked for

The Manager is the clearest case. It is not a dashboard: it opens the day with
what is off course, proposes at most two moves and at most two weekly targets
argued from the books, places pricing "holds" that are arguments rather than
locks and expire in thirty days, asks the owner at most three questions the
books cannot answer, and then — the part that matters — **is scored against
its own past advice.** `track_record` reads the whole journal and reports, per
thing advised, how often the owner did it and how much money followed, with
each occasion closed at the next time the same thing was advised so a payment
is never counted twice. Advice given three times and never acted on is
surfaced as *advice not landing*, and restating it a fourth time in different
words is explicitly forbidden.

That is closer to Bezos's anecdote discipline than any dashboard is. It is
also the answer to "how would we know we helped".

### 3.4 It respects the physical conditions of the trade

- 44px minimum on everything pressable in the worker app, stated as a reason
  and then enforced by a test over every control in the file: *"pressed with
  one hand, often a dirty one, by someone who has not stopped walking."*
- Two agents on one phone: the quote draft is stamped with who wrote it and
  cleared on sign-out, after the previous agent's baskets and a customer's
  typed address were being handed to the next person to sign in.
- Locations are a preset, not a text box, because "Ntinda", "ntinda" and
  " Ntinda " silently split a delivery run in half — and adding one is still
  one keystroke, so nobody is sent to a settings screen.
- The customer's phone number never reaches the thermal receipt, because a
  receipt gets filed in somebody else's shop.
- The WhatsApp drafting endpoint physically cannot reach a cost, a supplier,
  a stock count or a margin — the fence is structural, not prompted.

### 3.5 It refuses to let the books lie

`stock-cashbook-invariants`, `admin-invariants-property`, `accounting-basis`,
`debtor-balance-reconciliation`, `statements-trust`, `uncosted-stock`. A shop
whose numbers are wrong is worse off than one with no system, and this
repository treats that as the primary risk. `uncosted-stock` states the whole
ethic in a line: *"Naming a problem without a door out of it is only half the
job."*

---

## 4. Where it falls short of the bar

These are ordered by how much a real hardware shop would feel them.

### 4.1 It does not work when the network does not — for the owner

No service worker is registered anywhere. `index.html` and `worker.html` have
no offline story at all; `agent.html` has a read-only cached snapshot and an
explicit decision *not* to queue writes (agent.html:1944).

The surfaces the owner needs when the power or the data is out are exactly
the till, the quote screen and the cash book. A shop that cannot record a
counter sale during a blackout goes back to the notebook, and the notebook
never gets typed up. This is the single largest gap between the system's
ambition and its behaviour on a bad Tuesday in Kampala.

### 4.2 Day one is entirely the customer's problem

There is no import of any kind — no CSV, no spreadsheet, no paste-a-list. A
shop with 300–3,000 lines types them one at a time. The empty states say
"add one in the Products tab" and stop there. The price registry's own note
records 307 rows on the live shop, each of them presumably typed.

The first week is where every one of these systems is abandoned, and it is
the least designed week in the product.

### 4.3 There is no customer voice and no instrumentation

Zero telemetry. No error reporting. No in-app way for the shop to tell the
builder that a screen is wrong. (The "Report a problem" buttons at
index.html:27691 are about a follow-up with a *customer*, not about the app.)

Bezos's substitute for surveys is many anecdotes, inspected. We have deep
anecdotes from one shop, reaching us through the builder's own eyes. That is
a real strength — it is why §3.1 exists — but it is n=1 and unmeasured, and
it cannot tell us which of the 41 destinations in the rail the owner has
never once opened.

### 4.4 The shop's own customer is barely served

Almost everything here faces the owner. The contractor who owes 4,000,000 gets
a chase message and a printed statement, and has no way to see their own
balance, their own quote history, or what is on the van today. The public
catalogue is the only customer-facing surface and it is read-only.

Whose customer are we obsessing over? A hardware shop's competitive weapon is
being the one whose customers do not have to ring to find out.

### 4.5 The shop cannot ask a customer for money

Mobile money collection exists (MTN and Airtel, with webhooks and
double-charge guards), but it is wired **only for agents paying the shop**
(`agent-initiate-momo-payment`). A walk-in or a debtor cannot be sent a
payment request; the till can only *record* that Mobile Money arrived.

The external research makes this sharper than it looks: merchants across the
region stay on cash partly because a registered till costs 0.5–3% and creates
tax visibility. So the honest version of this feature is not "add a till" — it
is a debtor-chase message that carries a payment request the contractor taps,
which is collections, not point-of-sale, and does not change the shop's tax
posture.

### 4.6 Success takes the customer out of the system

Three things a shop does when it is doing well are not modelled:

- **Crossing the VAT threshold.** There is no VAT handling beyond a footer
  line on the printed catalogue ("Retail prices, VAT as applicable",
  index.html:44500) and no URA EFRIS e-invoicing. A shop that grows on this
  system must leave it to stay compliant.
- **Opening a second branch.** Locations are delivery clusters, not stock
  locations. There is no per-branch stock, no transfer between branches.
- **Taking goods back.** No credit note, no customer return, no restocking
  path. Wrong-size fittings, damaged sheets and over-ordered cement come back
  across a hardware counter every week. The system has accounting undo
  (voiding, un-invoicing) but no *commercial* return.

### 4.7 The recent work is craft, not new customer ground

The last thirty commits are re-drawings — Debtors, Creditors, Consignment,
Follow-ups, Payroll, Staff, Analysis, each "drawn as the console it always
was" and then built. The craft is genuinely high and several of those commits
fix real usability failures ("A dropdown inside its own label cannot be opened
with a mouse").

But none of them opened a problem the shop could not previously solve. Against
"divinely discontent", a stretch of pure re-drawing is the thing to notice:
expectations went up while the frontier stayed still.

---

## 5. What to do next

Ranked by how much the shop would feel it.

**1. Make the till and the quote screen work offline.** A service worker, a
cached shell, and a write queue for the two or three actions whose correctness
does not depend on a live server read (a cash receipt, a counter sale from
already-loaded stock, a stock count). Not a general offline mode — the agent
app's reasoning for refusing one is right — but a scoped one for writes whose
truth does not expire.

**2. Build a first-week path.** Paste-a-list product import, a starter
hardware catalogue (cement, sheets, bars, fasteners, paint, plumbing,
electrical) with units and pack sizes already correct, and a first-run route
that gets a shop to its first real quote in an hour instead of a fortnight.

**3. Instrument, and open a line back.** Which of the 41 destinations get
opened, which alerts get acted on, where saves fail — plus one in-app "this is
wrong" button that reaches the builder with the screen and the state attached.
Not a satisfaction survey; Bezos is explicit about why that is the wrong
instrument. Anecdotes, at volume, with the state attached.

**4. Put a payment request inside the chase.** The chase message already names
the invoices. Give it a tappable MTN/Airtel request and record the result
against the promise ledger, so a kept promise and a collected shilling are the
same event.

**5. Give the shop's customer a door.** A signed link per customer showing
their balance, their statement, their open quotes and what is out for delivery
— read-only, no login, revocable. It is small, and it is the thing that makes
the shop the one contractors prefer.

**6. Returns and credit notes**, wired to stock and the debt ledger the way
`counter-sale` wired the till to revenue.

**7. Then the growth path**: per-branch stock with transfers, and VAT/EFRIS,
in that order — the second only when a shop is actually about to cross the
threshold. Both are "do not lose the customer by succeeding" work, not
day-one work.

**8. Widen the anecdote base to three shops.** Everything in §3.1 came from
one. A second and a third will contradict it somewhere, and that contradiction
is the most valuable information this project could acquire.

---

## 6. The one-line answer

Judged on method, this system is more customer-obsessed than almost anything
in its category: it works backwards from a named failure with the money
attached, it invents what the shop never asked for, and it scores its own
advice. Judged on Bezos's whole bar it has two holes — it is not measured, and
it stops working precisely when the shop needs it most (no network, day one,
and the day the shop grows). Close the offline gap and the first-week gap,
open a line back from the shop, and it clears the bar on every count.
