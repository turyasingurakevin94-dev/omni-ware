# Suggestions for Claude Design — what the Sell-section handoff does not draw

This paper is written to be fed back into Claude Design. It is the list of
screens, dialogs, popups and states that `design_handoff_sell_section/`
**references but never draws**, plus the migration path for the rest of the app.

The handoff draws four screens at two sizes each (1440×900 and 390×844) and is
pixel-specified. Building them surfaced the gaps below: every one is something a
row, a button or a sentence in the handoff promises, and which therefore has to
exist before the section is finished. Where the handoff already settles a
question, this paper does not re-open it — it only names what is missing and
what the missing thing has to satisfy.

Each item gives: **what triggers it**, **what it must contain**, **the states it
has**, and **the constraint it must not break**. The vocabulary is the card
idiom already specified in the handoff's README (warm ground `#f6f5f2`, navy
`#17223c`, coral `#ef4b39` fill-only / `#c2311f` text-safe, IBM Plex Sans +
Mono, the four state tints), which is implemented in the app as the `.om-`
layer. Nothing here needs a new token.

---

## 1. The dialogs every screen points at

The handoff's own rule is *"No modal for reading — modals only for destructive
confirmation."* That leaves two classes of thing undrawn: the small **entry**
dialogs (which are not reading and not destructive), and the **confirmations**.

### 1.1 Record a payment — the most-referenced undrawn thing

Reached from Invoices' detail panel, Customers' detail panel, and the Agents
settlement. Three entry points, one dialog.

- **Must contain:** which invoice (or which account, when opened from a
  customer), the amount still due as the anchor figure, the amount being paid,
  the date, the cash account it lands in, and a reference.
- **The arithmetic must be visible, not implied:** still due → amount paid →
  what remains, as three figures that update as the amount is typed. A payment
  dialog that shows only an input is the one place a shop most needs to see the
  subtraction.
- **States:** part payment (the common case — leaves a balance, row becomes
  `part`), settling exactly (row becomes `paid`), overpayment (must be refused
  or explicitly turned into a credit — say which, do not silently accept), and
  paying an already-settled invoice (refuse, and say it is settled).
- **Constraint:** every payment lands in the Cash Book. The dialog names the
  account it will land in *before* it is confirmed, because that entry is what
  the books are reconciled against.

### 1.2 Record a settlement (Agents)

Reached from the agent panel's caution block. The same shape as 1.1, with the
one rule the handoff is emphatic about: **the figure owed is at the shop price,
never the client price.** The dialog must show both — *"they collected
1,775,000 from their clients; 1,420,000 of that is yours"* — because the whole
class of error this screen exists to prevent is charging an agent their own
client price. Do not draw a single ambiguous "amount owed".

### 1.3 New customer

Top-bar secondary action on Customers. Name, phone, area, and the **credit
limit** — which is the field that matters, because the over-limit block on the
detail panel and the blocked-credit rule at the point of sale both read it. A
new customer with no limit set needs a stated default, visible in the form.

### 1.4 Invite an agent

Top-bar secondary action on Agents. Name, phone, and **terms** (`prepay` or
`credit`) — the pill the list's last column shows. If `credit`, it needs the
same limit question as 1.3.

### 1.5 Hold new orders (Agents) — destructive, so a confirmation

The handoff gives this as a secondary action beside `Record a settlement` and
never says what it does at the point of pressing. It stops an agent trading, so
it needs a confirmation that names the consequence: how many orders are open
right now, what happens to them, and whether the agent's app tells them why.
An agent who finds their app dead with no reason will phone the shop.

### 1.6 Void, and undo invoice — two confirmations, deliberately not one

The app already treats these as different acts and the confirmations must keep
them different, because they are not interchangeable:

- **Void** cancels the paper. Goods went, money already received stays in the
  Cash Book, the customer stops owing for it.
- **Undo invoice** says it should never have been raised. Stock returns to the
  shelf, payments and their Cash Book entries reverse, the purchase invoices it
  raised are removed, and the order returns to Order tracking.

Each confirmation must **enumerate what it is about to remove** — the figures
and the record counts, not a generic "are you sure". Voiding must re-sync the
customer's debt; after the Debtors cut there is one list to re-render rather
than two, and the confirmation is where that is now visible.

### 1.7 Broadcast (Messages)

Top-bar secondary action, and the handoff defines it in one clause — *"a post
sent once to a picked list"* — then never draws it. It needs:

- **The list picker**, which is the whole screen: who is being written to, and
  on what basis (a lens over customers — everyone, everyone owing, everyone who
  bought a given product, the three past buyers of an idle line).
- **The same mono box** as the single composer, with the same law: the box is
  what ships.
- **The count, stated plainly** before sending — *"this opens WhatsApp 23
  times"* — because the app cannot batch-send and must not look as if it can.
- **A per-recipient stamp**, or an explicit decision that a broadcast is
  stamped once for the whole run. The handoff's attribution loop depends on the
  stamp, so this cannot be left unanswered.

### 1.8 Sort (Customers) and the overflow menus

`Sort` sits on the Customers list header; an overflow `⋯` sits at the end of
Invoices' action row. Both are undrawn. They are menus, not modals — one
elevation, the handoff's card radius, and each item says what will happen.
Sort's options should be the orderings a shop actually asks in: oldest money
first (the default the Owing lens already uses), largest first, and by name.

---

## 2. Lenses that are named but never drawn

Each of these is a tab with a count in the drawn frames, and no drawn content.
They need rows, a group structure, and — the part most often missed — **an empty
state**.

| Screen | Undrawn lens | What it has to answer |
| --- | --- | --- |
| Invoices | **Voided 3** | A struck-through register. What was voided, when, by whom, and what it was worth. Kept, never deleted. |
| Customers | **Best 20** | Ranked by what? The handoff implies margin, not turnover — draw the distinction, because the biggest buyer is usually not the best one. |
| Customers | **Gone quiet 7** | Partially specified (*"bought 9.1m before, nothing in 90 days"*). Needs the row, and the reading: which of them went quiet **because** of a debt. |
| Agents | **Last month / Year** | Same grid, different window. The question is whether the waterfall and the KPIs re-scale, and whether "Owed to the shop" is period-scoped or always current. It should be always current — money owed is not a monthly fact. |
| Messages | **Sent 184** | The archive. Needs the reply state per row, and it is the source of the reply-rate figures the other panels quote. |
| Messages | **Waiting on a reply 21** | Drawn as a dimmed group inside the To-send list, but not as its own lens body. |

---

## 3. The states no frame shows

The app's own laws require these, and the handoff draws none of them. They are
the highest-value thing on this list, because a screen that is only drawn full
is a screen that will ship broken.

1. **Empty.** Each of the four screens, with nothing in it, naming the next
   action. *"No invoice is overdue."* is a different sentence from *"You have
   not raised an invoice yet"* and both need drawing. The rule is that not
   enough is an answer: an empty screen that says so and names what to do beats
   one that pretends.
2. **One row.** Grouped lists with a single row look wrong in a way that only
   shows when drawn — a group header, one row, and a subtotal that equals it.
3. **Failure.** A figure the screen cannot derive must say so rather than show
   zero. Draw the row that says *"the ledger and the balance disagree"* rather
   than a silent number — the `customerDebtDrift` check already has a
   check-passed chip drawn, so its failed twin is missing.
4. **Loading.** What the list is while its figures are still being computed.
5. **Truncated.** The handoff specifies overflow rows (*"five more about
   money"*, *"+9 agents"*) but only draws one. Draw the case where a group is
   almost entirely collapsed, and the case where the overflow row's subtotal is
   most of the group's.
6. **Over-limit at the point of sale.** The Customers panel promises *"New
   credit sales are blocked for this account until it comes under 2,000,000"*.
   The refusal itself — on the quote screen, at the moment of adding a credit
   sale — is not drawn, and it is a rule rather than a dismissible warning. It
   needs the figure that would clear it and the one action that clears it.

---

## 4. Things the handoff removes without drawing the replacement

### 4.1 The Purchases register

The README lists *purchase invoices → Invoices (`invSide='buys'`)* as a merge
**already done** and therefore not this pass's work. But the Invoices frame
replaces the Sales/Purchases lens pair with **Needs attention / All / Voided**,
and shows purchase invoices only as `PINV` pills on the sales row and as the
*Bought to fill it* block on the panel.

That loses a screen that is currently doing real work: the buying side's own
checks band — the same delivery billed twice, a line priced above anything ever
paid that supplier, a bill with no delivery behind it, money paid out beyond
what was billed — and the bill panel that shows a bill's lines against what the
same goods last cost from the same supplier.

**Suggestion:** draw either (a) a fourth Invoices lens for the buying side that
keeps the checks band in the new vocabulary, or (b) the bill's own detail panel,
reached by clicking a `PINV` pill, carrying those four checks. Option (b) is
more in the spirit of *one register, one piece of money* and needs one frame.
Whichever is chosen, the four checks must survive — a checking screen whose
silence cannot be read is worse than none.

### 4.2 Statements — reached, never drawn

Invoices' `Send statement` and Customers' `Send statement` both reach the
existing `customerStatementBlockHTML()`, built from the debt log so credit
sales are not counted twice. The handoff is explicit that this block already
exists and keeps its row. What is undrawn is the **send**: a statement is a
document, and sending it is the same WhatsApp hand-off as everything else on
Messages, which means it needs the box, the deep link and the stamp.

### 4.3 Setup — the two values Messages reads

The Posting lens reads a **cap** (3 a day) and a **send window** (9–11am), and
says both live in Setup. The Setup rows that hold them are not drawn.

### 4.4 Today — the unstamped-post row

*"Today shows one row while the day's post is unstamped, deep-linking into the
composer."* Undrawn. It is one row, and it needs the dot rule already specified
for the phone tab bar (read off the count Today already rendered, not reckoned
again).

---

## 5. What the settled rail map still needs on the screen side

The rail itself is **done** — `.design/briefs/rail-map.md` settles the map and the
navy column is built, Sell 6 with the badge on Order tracking. (That brief also
supersedes the Sell bundle's own frames, which draw Sell 5 with the badge on
Quote.) Two of the ten absorptions are implemented with this section: Debtors →
Customers, and WhatsApp + Follow-ups → Messages.

What is **not** drawn is the receiving end of the other absorptions. A rail row
disappearing is only half a cut; the screen that took the work needs a frame
showing where it went:

| Absorption | The undrawn screen-side work |
| --- | --- |
| Creditors → Suppliers | Suppliers needs the "who to pay first" lens, with the aging bar Customers uses |
| Compare prices → Pricing | Pricing needs the rival-price view |
| Money's Pricing + Price registry → one Pricing row | one screen out of two |
| Media → Products | the product record needs the photo wall |
| Consignment → Inventory | Inventory needs a consignment lens |
| Sales + Purchase analytics → Analysis | Analysis needs both, and a statement about what it does with each |
| Fastener guide → The shop | the shop screen needs the guide |

Each needs what the four in this bundle got: a frame at 1440, a frame at 390,
and the cut argued with what is lost, what absorbs it, and which searched-for
words still reach the work.

**One observation the rail brief raises and nobody has drawn:** `renderCreditorsList`
sits beside `renderDebtorsList` exactly as Suppliers sits beside Customers. The
Debtors argument — one list, two renderers, a synchronisation bug waiting —
applies to Creditors unchanged. If the Debtors cut is right, this one is too.

## 6. Sizes the handoff does not cover

The frames are 1440×900 and 390×844, and the README says the desktop should
fill its viewport while the phone is a separate design. Two gaps:

- **821–1023px.** The app switches design at 820px, so this band gets the
  desktop design at half its drawn width. The detail column is fixed at 390px
  and the rail at 236px, which leaves under 400px for a list whose widest grid
  is 58 + 190 + 108 + 112 + 76 plus gaps. Draw what gives way first: most
  likely the detail column becomes a drill-in rather than a column.
- **Above ~1700px.** The prose blocks need a measure or they run to 180
  characters. The card layer sets one at 76ch; confirm that is the intent.

---

## 7. The migration, and where it actually stands

The card idiom is already spreading, so this is a status rather than a proposal.
**Built:** the rail, and the Quote page. **Built by this section:** Invoices,
Customers, Messages and Sales agents. That leaves the rest of the app on the
console (steel/oxide, Inter, hairlines).

The order to continue in, because it follows the money and each step reuses what
the last one built:

1. **Today** and **Order tracking** — both have handoff bundles in
   `.design/handoffs/` already, and both are screens the Sell four link into.
   Doing these makes the whole Sell loop one language.
2. **Suppliers** and **Sourcing** (Buy) — the `design_handoff_buy_section`
   bundle exists, and they reuse the register, the grouped list and the detail
   panel almost unchanged from Invoices.
3. **Catalogue** — `design_handoff_catalogue_and_rail` exists; this is the
   largest group and needs the thumbnail and price-card work the Posting lens
   introduces.
4. **Cash book** and **Statements** (Money), which need the figure treatment and
   little else, and have no bundle yet.
5. **Insight** and **Setup** last, being the least-visited, and with no bundle
   yet.

Four of the six bundles that exist are unbuilt, and two sections — Money and
Insight — have no bundle at all. Those two are the gap worth filling next in
design, independent of everything above.

When the conversion completes, the console's `--ow-*` tokens go with the screens
they clothe and the app's colour count **falls** rather than rises, which is the
outcome `test/design-system.test.js` is written to reward. Until then the two
gates in that file read two disjoint slices of the stylesheet and neither can
drift into the other.

What should **not** happen is a partial conversion inside one screen. A screen is
on one system or the other.

---

## 8. Where the built screens knowingly differ from the frames

Found while building, not guessed at. Each is a decision with a reason; any of
them can be overruled, and the first two are the ones most worth a designer's
opinion.

### 8.1 The 58px top bar is the app's, not the screen's

The frames draw a white 58px bar carrying `Sell › Invoices`, the search field
with its `Ctrl K` cap, the stage chips and the avatar — and they draw it inside
the screen. **The app already draws a top bar above every screen.** Building the
frame's bar as part of Invoices produced two stacked bars with two breadcrumbs
and two search boxes; it was removed the moment it was looked at.

So the screen's own search sits in the register's card header, beside what it
filters, which is where this screen kept it before. **What is actually needed is
one conversion of the app's global bar to the card system, covering all four
Sell screens at once** — it is shared chrome, not screen work, and it needs to
keep the global search and the Manager door that the current bar carries and the
frame does not mention.

### 8.2 Money keeps its unit; the frames' figures are bare

Every figure in the frames is bare — `6,900,000`. Every figure in this app
carries `UGX`, the Quote screen included, and the house rule is figure, then
unit, then basis. Changing that is a decision about the whole app rather than
about these four screens, so the built screens keep the unit.

It costs layout: three figures carrying `UGX` do not fit a 390px detail panel at
the frame's 17px, so that row is 14px. **If the bare figure is wanted, it is a
one-line change here and the same change on Quote** — but it should be decided
once, for both.

The one place the unit is dropped is the phone's three-up header strip, where
three cells at 390px cannot each carry it. It is dropped for all three or none,
because a strip where one cell has a unit and two do not reads as three
different measures.

### 8.3 The register has no progress bar, so an overpayment has to be spoken

The console's row drew a payment bar from the clamped figure with the *true*
percentage printed beside it, so an invoice paid 150% read 150%. The card row
carries Invoiced and Still due instead — and **Still due reads `0` on an overpaid
invoice**, which is the screen hiding money.

The saying moved to a tinted note row under the row it belongs to, which also
carries the other two documents-that-disagree-with-themselves: a voided invoice
still holding money in the Cash Book, and an invoice whose items were never
priced. The frames draw none of the three. They are the app's *a failure must
name itself* law and they are not optional.

### 8.4 Four controls still have no home

Kept, hidden, because their handlers are live and the functions are real:

- **The seven date presets.** The frames draw no date control. The default moved
  from "Last 30 days" to all-time, because 30 days hides the 74-day overdue
  invoice the whole layout is built to put first.
- **Select-all and the bulk operations** (print selected, void selected, unvoid
  selected). Nothing in the card design selects rows.
- **Hide voided** — superseded by the Voided lens, which is better: the count is
  in the tab, so the register volunteers how many there are.
- **Print list.** Printing one document is on the panel's overflow menu; printing
  the filtered register has nowhere.

### 8.5 The phone register is a second layout from one call

The desktop grid is 344px of fixed columns before gaps and cannot be made to fit
390. The row builder emits both — five cells and a two-line block — from one
call off the same document, because the last time this screen hand-wrote two
templates they drifted and the phone card carried a rank the table numbered
differently. The phone drops the Invoiced column; on a phone the question is what
is still owed.

### 8.6 Customers: three blocks the frames do not draw, and one that eats a phone screen

Building Customers and deleting Debtors surfaced four things with no home in
the frame. The first three are kept because they are the app's own laws; the
fourth is a request.

- **The debt-drift banner.** A customer's stored balance can disagree with its
  own debt log. The banner names every account it happens to, says which figure
  is overstated and by how much, and offers two repairs — *trust the balance and
  write the missing entry*, or *trust the history and set the balance*. It came
  off Debtors and now sits above the register. **It needs a compact form**: at
  390px it currently fills the whole first screen and pushes the list, which is
  what the screen is for, below the fold. One line and a way in would be enough.
- **The credit-cost panel.** The rate the shop reckons its waiting at is set
  beside the figure it changes, which is this app's standing rule. It has no
  place in the frame and sits at the foot of the detail column.
- **Last payment, and how far through the current debt.** The register is six
  columns and the handoff specifies all six, so neither fits. Both moved to the
  panel. The progress figure is a bar whose width is the share paid, a dash when
  it cannot be measured, and **two differently-worded reasons** for that dash —
  a balance that contradicts its own history needs fixing; a balance with no
  dated charges behind it simply cannot be read. An empty bar would say *they
  have paid nothing*, which is a claim about somebody's conduct the records do
  not support.
- **The full account view is still the console.** The record with the statement
  of account — the sheet handed across the counter — steps in place of the book
  as it always did, reached from the panel now rather than from the row. It
  needs its own frame before it can be converted.

### 8.7 Two things the frames assume about the data

Both came up on Customers and will come up again:

- **The aging bar assumes four populated bands.** A band holding nothing is left
  off the bar entirely rather than drawn as a sliver of zero, and a band too
  small to see still carries a 14px floor so it can be pressed. Neither is in
  the frame.
- **A concentration figure needs more than one account.** *"Largest single debt,
  100% of the total"* is not a finding when it is also the only debt — it is the
  same number printed twice, so it is withheld. Equally, a shop with no
  customers has not *settled up*, it has not started, and being told the first
  on day one reads as the app misreading what it is looking at. Those are two
  different sentences and the frame draws neither.

### 8.8 One correction to the handoff's Debtors argument

The README says Debtors and Customers "must be called together after every void
or payment; when one is missed the two screens disagree". **Every one of the ten
call sites already called `renderCustomers` on the line directly above.** The
second renderer never added anything — the two lists could only ever disagree.
The cut removed a line, not logic, which makes the case for it stronger than the
handoff states, and the same reasoning applies unchanged to `renderCreditorsList`
beside Suppliers.

### 8.9 Agents: the frame's widths assume bare figures, and an agent can go negative

- **The money columns had to widen.** The handoff sizes them for bare figures;
  every figure here carries `UGX`, and at the frame's 92px `1,340,000 UGX` and
  `1,600,000 UGX` touched — two figures with no gap between them read as one
  wrong number. Same proportions, four columns wider. This is the third screen
  where the unit has cost layout (see §8.2); it is worth deciding once.
- **The card screens sit outside `main`'s gutter.** `main` pads 40px and the card
  layout brings the handoff's own 22px, so a card screen inside that padding is
  80px narrower than the frame it is drawn from — which is exactly how the
  register's last column fell off the end. Escaped with a negative margin, as
  the quote already does. At 390px `main` pads 16px, not 40, so the phone needs
  its own value; the first version dragged the whole screen 24px off both edges.
- **"They kept" can be negative, and the frame does draw that** — `−24,000` in
  bad ink with *sells under your price* on the row. What the frame does not draw
  is what it means for the waterfall: the agent's increment runs *backwards*
  from the client-paid total rather than forwards from the shop-billed one. It is
  drawn that way now, in bad ink rather than the agent violet, because a violet
  bar of the same length would read as margin they earned.
- **The settlement figure is the one the screen exists to protect.** The block
  states what they owe *at the shop price* and, beside it, what their clients
  actually paid — *"5,940,000, not the 7,463,077 their clients paid. Their
  margin is not yours to collect."* The frame's copy says this; it is repeated
  here because it is the error the whole screen is built to prevent and it must
  survive any future edit.

### 8.10 Three things kept on the console, on the Agents screen

None are drawn in the frame and all three are live:

- **The roster position and the attention band** above the register — how many
  of the roster is actually working, and who needs a decision today.
- **The credit decision.** Moving an agent to *pay on delivery* is a credit
  decision made from a dropdown, and it asks first, naming what they already owe
  and flagging an agent who has never sold. Declining puts the dropdown back.
  The frame draws the terms as a `prepay` / `credit` pill with no way to change
  them and no question attached.
- **Promotions and Claims**, the supplier-bonus machinery. The handoff says the
  bonus figure "has no admin-side home today" — it has two. The panel's Supplier
  bonus block summarises them rather than replacing them.

### 8.11 Messages: one screen where the app had two, and the hub the frame has no room for

WhatsApp and Follow-ups were never usable apart. Follow-ups is the list of people
the shop owes a word, already tagged with a reason, and its only act was to open
the box; WhatsApp is the box, and its only content came from that list. The nav
index had already recorded the confusion — the obvious search for the follow-up
queue was *"broadcast"*, which belonged to the other screen. They are one rail
row, one badge and one screen now, with three lenses: **Money**, **Telling**,
**Posting**. Both old doors still resolve, WhatsApp onto Posting, so a saved
last-tab cannot boot into a section that is gone.

What the frame draws, and what it does not:

- **The three-pip cap and the signal-ranked product rows of the Posting frame
  are not built yet.** Posting today is the WhatsApp post desk on the console,
  unchanged and live, under a card-system lens. It is the one frame in the Sell
  set still waiting for its screen.
- **The hub is a second working surface and the frame has no place for it.** The
  chase rules (*Chase after*, *Rest between*, beside *Quiet after*), the
  held-back accounts with their reasons, the register of every follow-up, *Add a
  follow-up*, and one client's long record — the invoice-by-invoice check, the
  optional lines, *Ring*, *Receive a payment*, *They promised to pay on…* — are
  all live and none of them is in the handoff. They open under the queue behind
  **Rules & register**, shut by default. That door is beside the note under the
  list rather than in the card header, because the phone hides that header and a
  door on one design only is not a door.
- **The hub's own queue column was deleted, not moved.** It walked the same
  ledger as the card list above it, so the screen drew every client twice with
  two independent selections. The record now follows whoever is picked on the
  card queue.
- **There are still two draft boxes on one screen** — the card panel's and the
  long record's — and that is the deviation most in need of a frame. They cannot
  say different things (both read `fupDrafts` for the owner's own wording and
  `fupTickState` for the lines), and both stamp through `recordFollowUpClient`
  with the same ticks. But one screen should have one box, and deciding which
  instruments belong on the card panel is a design question, not a code one.
- **The draft's width is measured, not claimed.** The two chips under the box
  read `14 chars wide` and `fits a phone` as literals — true of nothing. They
  are computed from the box on every keystroke now, against the app's own
  measurement of a WhatsApp bubble (≈26 monospace characters, which is why the
  quote sender builds its table to 22). Past that the chip says it *folds*.
- **The queue is a subset and says so.** Only who is past your terms today; what
  the whole book comes to, and how much of it is old, is **Customers → Owing**.
  A total worked out over this list would describe a slice of the shop. The note
  carries the queue's other rule with it — *one message per client, however many
  things they are waiting for* — which was a paragraph behind an "i" on the
  screen this one replaced.
- **Three facts came off the two dead headers** and are checked at their new
  addresses rather than taken on trust: *every figure counted live from the
  shop's own records* and *nothing leaves the shop until you press send* (a
  footnote under the post desk they govern), and *who is waiting, and how long
  the worst of them has waited* — the one line on the desk that rots, still
  written by the render, above the work, with the search that reaches every chat
  beside it.

### 8.12 Two faults in the shared card layer, found by looking at the screens

Both were in the layer the whole Sell set is built on, so both were wrong on
five screens at once:

- **`.om-screen` had `min-height:100%` against an auto-height `<main>`**, which
  is a flex *child* in a row and has no height to be a percentage of. It
  computed to nothing, so a short screen painted its warm ground for four
  hundred pixels and then stopped, leaving the console's grey under the rest.
  Measured from the viewport now, less the padding `main` takes at each width.
- **`.om-card-h` was hidden wholesale on the phone.** That rule is for the list
  card's header — the desktop's way in, which has its own phone equivalent above
  — but the side panel's cards wear the same class, so *Last word* and *What the
  message quotes* drew as unlabelled blocks. Scoped to the list.
- **A `<textarea>` is 20 columns wide until something says otherwise**, so the
  draft drew as a 180px ribbon in a 300px card and every message looked folded
  whether it was or not.
