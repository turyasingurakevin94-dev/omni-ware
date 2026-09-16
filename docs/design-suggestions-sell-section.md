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
sent once to a picked list"* — then never draws it.

**Today the button opens the console's existing broadcast composer**, on the
Posting lens, which already carries the one thing a broadcast most needs: the
arithmetic of whether it is worth sending at all, against the free Status post.
That composer is the console's, not the card system's, and it has no list
picker. What the drawn screen needs:

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
| Messages | ~~**Sent 184**~~ | **Built** (§8.14). Read from the follow-up ledger, newest first, with a panel breaking it down by reason. It cannot be the source of the reply-rate figures the other panels quote, for the reason §8.14 gives: a debt chase leaves one stamp per debtor, not a history. |
| Messages | ~~**Waiting on a reply 21**~~ | **Built** (§8.14). Its own lens, longest wait first, with the panel saying what silence costs — and saying plainly that a row here means somebody pressed *It was sent*, not that WhatsApp delivered anything. |

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

Where these stand now that both lenses are built:

- **The cap is a real setting** — `presetWaPostsPerDay`, persisted with the
  other presets, defaulting to 3 — because the panel's own sentence says it is
  one and a constant would have made that a lie. **It still has no field on
  Setup.** One number, one row, and the sentence already written for it.
- **The send window is not a setting and should not become one.** The frame
  reads *"9–11am · replies twice as likely as afternoons"* — a finding, not a
  preference — so it is computed from the inbox and says **Not yet** until
  twelve sends are on record there. What Setup could usefully hold instead is a
  quiet window: hours the shop does *not* want a message drafted for.

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

### 8.13 The Posting lens (frame 1c), and what the books could not supply

The lens is built. What the frame draws and the app now draws with it: the
title that follows the lens (*What to post today*, with the nominated count, the
cap and how many roll over), the four tiles (*Picked for today* with one pip per
slot, *Sold after a post*, *Signal that sells best*, *Held back*), the queue
(rank, thumbnail, product, the signal it is here for, cover, what you keep, the
pick), the *Held back* group, the panel (the navy price card, the mono caption
box, the width chips, *Shorter*, *Swap product*, *Open WhatsApp with this*, and
*It was posted* / *It was not*), *Which signals actually sell*, and
*Today's picks*.

Everything on it comes from machinery that was already there —
`waPostCandidates` nominates and gives each survivor a list of reasons that are
sentences the owner can check; `waPostOutcomes` and `waLiftTable` read what
posting has actually done. Three things were added because the frame asks
questions the code could not answer:

- **`waMoneyAfterPosts`** — the frame's *Sold after a post* is money and the
  record only knew units. It is the same before/after comparison over the same
  window, valued at the SELL price on each line, so a product whose price has
  moved since is counted at what it actually fetched.
- **`waSignalScoreboard`** — the lift table keeps a median per reason, which
  answers *how much*. The frame asks *how often*, and those are different
  questions: one post that moved forty units and five that moved none has a
  healthy median and a terrible record.
- **A daily cap that is a setting.** The frame's panel says *"Three a day is
  the cap, set in Setup"* — there was no such setting, so `WA_PICK_COUNT` (six,
  and about the swap pool, not the day) would have had to stand in and the copy
  would have been a lie. `presetWaPostsPerDay` exists now and persists with the
  other presets. **It still needs a field on the Setup screen**; until it has
  one, the sentence is true but the door it names is not there.

Knowing deviations, each for a reason:

- **No struck-through old price on the card.** The frame shows `34,500` beside a
  struck `37,000`. What the picker knows fell is the SUPPLIER COST — its own
  reason reads *"costs the shop 8% less than last time"* — and this shop's rule,
  which the mutation suite enforces, is that nothing carrying a supplier cost
  leaves the building. There is no previous SELL price on file to strike
  through. The card says **New lower price** in words instead, which is what
  `waCaption` has always done. **To draw the frame honestly, the price book
  needs to keep a customer-price history.** That is the single most valuable
  thing this frame asks for.
- **No product strapline.** The frame's card reads *"30 gauge · 3 metre · per
  piece"* under the name. A product has a name and a unit; the middle of that
  sentence has nowhere to come from.
- **Two signals in the frame have no source**: *goes together* (bought with iron
  sheets on 18 of last 21 orders) and *season starting* (rains start late Sep,
  sold 3× as much last October). Both are real and both are computable — the
  first from co-occurrence in `savedQuotes`, the second from the same sales
  history by month — but neither exists today, so no row can wear them.
- **A reason with fewer than four ripe posts behind it does not get to be the
  best one.** Sorted on ratio alone a signal tried once, and followed once by a
  sale, beats one that is three of four. The tile reads **Too early** and names
  what is missing; the panel still lists the thin ones, greyed, saying *too few
  to say*, because hiding them would be a different lie.
- **What went out today stays on the list.** The picker rests a product for a
  fortnight once it is stamped, which is right for tomorrow's nomination and
  wrong for the next thirty seconds: a row that vanishes the moment you stamp it
  reads as *that did not work*. Today's posts are drawn at the top, out of the
  record rather than the picker, under **Posted today**.
- **The inbox and the record are behind a door**, as the queue's hub is: people
  waiting and answered today, what the system is answering on its own, the words
  it has learned, the whole argument behind the order (*Why this order* scrolls
  to it), the paid broadcast and its arithmetic, and the channel's health. None
  is in the frame; all are live.

### 8.14 The outbox (frame 1a), and the one place the handoff contradicts itself

**The handoff draws the lens group two different ways.** In 1a it is *To send ·
Waiting on a reply · Sent*; in 1c and on the 1c phone it is *Money · Telling ·
Posting*. Only one of them can be the control, because 1a's own list is already
grouped **Money**, **Telling them something**, **Waiting on a reply** — a lens
that repeated the grouping would be a control that does nothing.

The build takes the states, with Posting joined to them because 1c puts it there
and the rail has one row for all of this: **To send · Waiting on a reply · Sent ·
Posting**. Nothing is lost — *To send* is exactly 1c's Money plus Telling, and
those two counts are on the group headers where 1a puts them. The two old doors
(*Chase debts*, *Worth telling*) open the outbox **focused** on the group each of
those screens used to be, and the list says so with the way back to all of it.
**If a later frame settles this, the lens group is one line and the grouping is
another; they are independent.**

What the frame asks for that the books could not supply, and what was done:

- **"Chases that got paid — 31%, 57 of 184 sent, 4.2 days to the money."** Not
  derivable. `presetDebtChases` holds ONE stamp per debtor, the latest, and
  prunes it the moment they pay, so there is no chase history to divide. The
  tile asks the same question of the people standing chased *now* — how many
  have paid anything since, and how long it took on the middle case — and says
  so in the panel. **To draw the frame, a chase needs to be an append-only row
  (customer, date, amount asked) rather than a single stamp.** That is the
  second-most valuable thing these frames ask for, after the price history in
  §8.13.
- **"Best hour to send — 9–11am, replies twice as likely as afternoons."** Only
  half-derivable. The inbox is the only place this app can see a reply, and a
  send that went out as a WhatsApp deep link left no record there. It is
  computed from outbound inbox messages that got an inbound reply inside a day,
  and below twelve such messages the tile reads **Not yet** and says how many
  are on record rather than crowning an hour off three.
- **"6th chase"** on the panel header. The code was already claiming this, off a
  field called `chasedCount` that nothing has ever written — so the chip never
  drew, which is the only reason no shop was ever shown an invented ordinal. It
  says what the books do know instead: when the last ask went, or how many named
  days have come and gone.
- **The roll-up row** ("+5 five more about money · all under 700,000 · none past
  30 days") is built: a group past five rows keeps its first four and rolls the
  rest into one row carrying their **total**, their worst figure and their oldest
  age, which opens on a press. Summarising, not hiding.

Knowing deviations:

- **The search and the Broadcast button stay in the card header**, where the
  frame puts them in the app's top bar. That bar is shared by all 41 screens and
  is not a screen's to furnish; the Quote screen set the precedent.
- **"Select many" is not built.** The frame draws the control and not what it
  does. The only bulk action this screen could honestly offer is *stamp several
  as sent* — a bulk **send** is impossible (a WhatsApp deep link opens one chat)
  and would in any case be the one thing this app must never look like it did.
  **The frame needs to say what Select many selects for.**
- **No multi-recipient row.** The frame has *"3× Three past buyers of PVC
  conduit"* — one row standing for three people. The hub groups by customer
  precisely so that one person gets one message; a row that is three people
  needs a different unit of work and a different stamp, and that is a design
  decision rather than a rendering one.
- **The state chip never reads "sent" in the outbox.** Every row there is owed a
  word *now*; a row saying "sent" in a list of things to write contradicts the
  list it is in. What has gone is what the Waiting and Sent lenses are for.

### 8.15 The fidelity pass, and one fault that was on every card screen

Read back against the frames after the shared layer had changed underneath them.
Four things were wrong and are fixed:

- **The card header swallowed its last control.** `.om-card-h` was `nowrap`, so
  when the title, the note, the search and two buttons ran past the card's width
  the last button simply vanished past the edge — no ellipsis, no marker, no way
  to know a control had ever been there. It wraps now, the way the console's
  `.btn-row` already did. The three headers that were wrapping were then trimmed
  to fit on one line, each by dropping something said twice (the agent count is
  on the two group rows immediately below it; the terms are in the TERMS column
  and in the chip beside the title).
- **Three search fields had collapsed to a bare magnifier**, on Invoices,
  Customers and Agents, for the same reason Messages' had: `flex:1` with a zero
  basis against a `flex:1` spacer leaves no width to grow into. Each has a real
  basis now.
- **The Invoices panel's customer block** is the frame's shape: *Send statement*
  as an action in the card header, and two figures side by side — what they owe
  against what they are worth — rather than a column of label-and-value rows.
  The credit limit is not in the frame and is kept, as a line rather than a
  third tile: a limit is a rule, not a figure of the same kind as the two above.
- **The Agents panel was missing the sentence under the waterfall.** The bars say
  *where* the money went; the frame's line says *whose* it was — two markups sit
  on one order, the shop's on its own cost and the agent's on top of the shop's
  price, and the owner's actual question is which of the two is bigger. It is
  derived from the same five figures the bars are drawn from, so the words and
  the lengths cannot disagree, and an agent selling under the shop's price gets
  its own sentence rather than being described as a share of a gap that does not
  exist.

Deviations left standing on these three, all for the same reason: **the search
and the primary button stay in each card's header**, where the frames put them
in the app's top bar. That bar is shared by all 41 screens and is not a screen's
to furnish — the Quote screen set the precedent — and it is what makes these
headers tight. If the top bar is ever made per-screen, all four card screens get
a line of width back.

### 8.16 The second tab, deleted — and the lens question settled

The second Messages handoff (`design_handoff_messages_held_back/`) covers the
tab turn 1 never touched, and its finding is that **the tab is not a screen**: it
held a group, a setting and an archive, and each belongs somewhere already on
the register. Building it meant deleting the tab bar, not restyling it.

**It also settles §8.14's open question, the other way round.** Turn 1 drew the
lens group as states (*To send · Waiting on a reply · Sent*) in 1a and as reasons
(*Money · Telling · Posting*) in 1c; this one says plainly that *"held back and
sent are groups in this list"*. So the lenses are the reasons again and the
states are groups under them — and that is the right way round for a reason
worth writing down: **Money, Telling and Posting are three different jobs**
(collecting, telling, selling) and a person opens the screen already knowing
which one they are doing, whereas *held back* and *sent* are not jobs, they are
what has happened to a message, and that is readable on the row it is on. The
lens answers the question you bring; the grouping answers the one the screen
raises.

What was built:

- **Held back is a group above the list, and only when it has rows.** Empty, it
  is one line offering the action — never a titled band with a count of nought
  announcing that it is empty.
- **An owner-driven hold is new machinery.** Three engines already held people
  back for their own reasons (a debtor who named a day, one asked recently, one
  whose balance does not agree with its own history); those are *rules*. This is
  a fourth and a different kind of thing: a *decision*, which the books cannot
  know. It takes a reason and a day it lifts, because a hold with neither is how
  a client is quietly never chased again. It is filtered inside
  `followUpHubRows`, not in the screen, so the queue and the **rail badge**
  cannot disagree about the same person.
- **Three figure cards with the zero rule.** Five tiles of which four read `0`
  became three, one of which deliberately carries **no figure at all** — a `0`
  on *Everything else is clear* would put back exactly what it was made to
  remove. And an obligation is counted **once**: the old *To message 1* and
  *Money 1* were the same message.
- **Quiet after moved to the list card's header**, beside the list it changes.
- **The register is the Sent group**, behind a *Show sent* link, with the closing
  line that says where the record is.

Deviations, each for a reason:

- **The two chase rules ride in Quiet after's menu.** The handoff names only
  Quiet after and says nothing about *Chase after* and *Rest between*; once the
  tab is gone those two have no other home, and they are the same class of thing
  — the numbers that decide who is in this list. Each now carries the sentence
  that says what it does, which the old bare fields did not: *"Quiet after"* with
  a number and no explanation is a setting nobody can change with any confidence.
  **A frame for this menu is the smallest thing this handoff still needs.**
- **"Chases that got paid — 31%, 57 of 184 sent"** is still not derivable, for
  the reason §8.14 gives: one chase stamp per debtor, pruned on payment. The card
  asks the same question of the people standing chased now.
- **The measurement followed the record, not the tab.** *Did it work* — the reply
  and conversion rates, the "money is not counted and here is why" row, the
  missing-table warning — was the register's own rail. The register is a group
  now and a group has no rail, so it takes the panel while the Sent group is open
  and nothing is picked, which is the moment somebody is asking *did any of this
  work* rather than *what do I write to this person*. **It is console markup
  inside a card column and wants a frame.**
- **Two small things the deleted pane held have no home and are not rebuilt:**
  the per-item **tick lines** (which optional lines go into a combined message —
  the frame's draft is fixed, so the frame does not need them) and the **in-app
  preview of a telling's picture**. The two picture *acts* — share it, save it —
  are on the Telling panel, so the owner still gets the image; what they cannot
  do is look at it first.
- **The phone is a second screen, not a reflow.** Frame 2b is a *detail* view:
  pick somebody and the recipient fills the screen — back chevron, avatar, name,
  `0782432454 · first ask`, a `1 of 1` chip and an AT STAKE strip on the navy —
  with the list behind the chevron. That is the two-designs law doing its actual
  job: the desktop shows the list and the recipient side by side because it has
  the width, the phone shows one at a time because it does not. Built. The
  panel's own navy header and its repeated *Owes* figure are hidden there, since
  the screen's head already carries both.
- **The AT STAKE strip introduces no colour.** The frame paints it
  `rgba(239,75,57,.18)` over the navy, which is the coral at 18% over the navy
  and nothing else, so it is `color-mix`ed from the two tokens it is made of
  rather than added to a palette that is closed at 73.
### 8.17 The deletion pass

`renderFollowUpsContact`, `renderFollowUpsAll` and `renderFollowUpSummary` drew
the second tab. Once the tab went, nothing called them. They are **deleted**
now, in a pass of their own rather than in the same commit as the redesign,
because a dozen assertions across six test files pinned behaviour that had
moved and each one needed re-verifying at its new address. Code nothing calls
is code the next reader has to prove is dead before they can change anything
near it.

Gone with them, and only theirs: `fupSetHTML`, `fupHeldPanelHTML`, `fupRowHay`,
`fupRowLenses`, `fupRowValue`, `fupDaysQuiet`, `fupCp`, `fupDay`, `fupRowChip`,
`followUpStatePill`, `followUpWaUrl` and the `fupAwaiting` state — plus 63
unworn `.fup-*` rules and the whole follow-ups phone block, which sized a pane
that no longer exists. `briefWhyHTML`'s `{fold:true}` disposition went too: its
only emitter of `fup-see-why` was the deleted pane. The shadow ceiling in the
ratchet fell 54 → 53 as a result; it may only fall.

What the pass *found*, which is the reason a deletion is worth doing as its own
piece of work rather than as a tidy-up:

- **Two real acts had been dropped, not re-homed.** A held row for somebody who
  named a day, or who is inside the rest period, carries an act that the
  conversation itself produces — *name a different day*, *ask again today*. The
  retired Chase screen did these with browser `prompt()`s in a band; the
  redesign lost them. They are back as `msgHeldActHTML` + `msgHeldFormHTML`,
  inline on the row, which is where a hold belongs: it argues with a row, so it
  lives next to it. `payment-promises.test.js` exists to protect exactly this.
- **Send was offered to a client with no phone number.** The pane withheld it
  and said so in three places; the redesign drew it unconditionally, so a
  phoneless account got a button that opened `wa.me/` with nothing in it and
  failed inside WhatsApp, where this screen cannot see it. Withheld again now,
  with the gap named where the button would be — the contact line in caution
  ink, the phone's own head, and the note in the send block.
- **Two accent buttons could share a screen.** A held row's form and the
  panel's could both be open, putting two coral confirms on one screen saying
  two different things. Opening either now closes the other.
- **A held row's act read as a third line of grey.** `.om-btn-g` is background
  none and ink-3, on a group already painted at `.68` opacity. `.om-btn-s` is
  the same quiet button with an edge, and on the phone it is a full tap target:
  the row was already 44 tall, the button inside it was not.

Each re-pointed assertion carries its own argument in the test file — what the
old one meant, why it stopped being true, and what the new one means. The
three that moved furthest:

- **The state pill** (`Waiting · Not told · Told · Closed`) was three lines of
  derivation over `followUpReasons`, `followUpLastContact` and `closedAt`.
  Membership of the queue *is* the state now, so the assertions go to those
  engines directly — which is where the rule always lived.
- **The five-tile strip** is the three figure cards, and the "figures and filter
  cannot drift" claim is stronger than it was: they were two call sites of one
  shared reading, and they are now one array computed once per render.
- **The prefix rule** (`fup-` or the layer's, nothing else) now applies to what
  still renders `fup-` markup — the follow-up list modal, its add-results rows
  and the measurement panel. The three screens that would have introduced a
  stray family are the three that no longer exist.

### 8.18 The WhatsApp connection, and the three artboards it came with

The third handoff (`design_handoff_messages_whatsapp_link/`) covers the one area
of Messages the first two left alone: **The inbox & the record**, whose entire
content, until a number is linked, is the fact that no number is linked. Its
finding — **an unbuilt feature does not get a place in a working screen** — is the
same one §8.14's zero rule made about a tile, applied to a quarter of a desk.

What it replaced, stated so the next reader knows what was wrong with it: the area
said *"nothing to show"* three times (a line above the band, the band's own
`NOT CONNECTED` heading, and the sentence inside it), tabulated three absences as
`none · none · not available` in a house style that elsewhere refuses to print a
`0`, and offered **Check the connection** as its primary act — for a connection
nobody had made.

**Built, all three artboards:**

- **3a — the card, in Setup › The shop.** The kept sentence at the top, above the
  decision rather than below it; *What linking would turn on* as three lines in
  the future tense with dashed, unfilled tiles; an action footer carrying `Link
  the number` in the coral with the cost beside it and `Send the steps to someone`
  on the right; the padlock promise below the card, not inside it. On linking the
  chip fills with the number, the tiles fill ground-and-glyph together, and the
  copy switches to the present tense.
- **3b — the phone.** Each intention line a thumb tall, and the two acts full
  width at the frame's own heights, the link at 48 and the hand-off at 44, with
  the cost line centred between them.
- **3c — the one line it leaves in Messages.** At the foot of the register, on the
  sunken ground, below the last group: the message glyph, the sentence, and a 30px
  `Link WhatsApp`. Not a lens, not a tab, not a band announcing a void — and gone
  the moment the number is linked.

**The two figures the frame's lines carry are derived, and one of them could not
be.** The browsable count reads `waCatalogItems()`, the same function the sync
itself pushes from, so the card and the push cannot disagree. *"A price change to
the 24 people who buy that line"* cannot be read off the chat list — there **is**
no chat list until the number is linked, and a figure that needs the thing being
argued for is the absence-table fault wearing a number instead of a word. It is
counted from the shop's own invoices instead: distinct customers per product,
largest wins, and `null` rather than a `1` when the books cannot answer, which the
line then says in words.

**Deviations, each for a reason:**

- **The card is a 2026 card on a console screen.** Setup › The shop has not been
  redesigned: it is thirty `.ow-pan` folds with a search over them. The frame
  draws this card at 1040 wide under a breadcrumb `Setup › The shop › WhatsApp`,
  which is a *page*, and building it in the console's vocabulary would have thrown
  away the one thing the handoff calls final. So it is the card, verbatim, at the
  head of *The shop itself*, with `data-find` so the page's own search still
  reaches it — and a visible seam until that page gets a frame.
  **Setup › The shop is the page this most wants next.**
- **3b is the card's phone form, not a full-screen detail.** The frame's phone
  artboard has a navy header with a back chevron and a fixed footer, which is a
  *page* again. Here the card is a section of one, so what carries over is the
  part that is about the hand rather than about the page. Same deviation as above,
  and it resolves with it.
- **The technical steps are handed over AND still reachable.** The handoff is right
  that a disclosure requires the person who does the work to be sitting at this
  screen, which is exactly who is not there — so `Send the steps to someone`
  composes them and opens WhatsApp's own contact picker, with no recipient, on
  purpose. But somebody still has to type a Phone number ID at this computer. So
  `Link the number` **opens the flow** rather than starting an automated one: the
  numbered steps and the four fields, drawn on first opening (it asks the server
  four questions, and a panel nobody has opened should ask nothing), each field
  saving as it is filled, which is what makes it resumable by whoever comes back.
  `Check the connection` lives at the foot of that flow, where something has been
  attempted.
- **The Inbox lens is named but not drawn, so it is not built.** The handoff says
  a fourth lens appears beside Money, Telling and Posting when the number is
  linked; no artboard draws it, and it also says *nothing in Messages' three
  lenses changes*. Those two cannot both hold, because the inbox this app already
  has lives behind the Posting lens's own door — a lens would have to take it from
  there. Building an undrawn screen on speculation is the thing this handoff opens
  by warning against. **The Inbox lens is the other frame this wants**, and the
  question it has to settle is what the Posting door keeps: the post's own
  argument and what it learned are Posting's, the waiting/answered/answering
  panels and the channel's health are the inbox's.

**Two faults the pass found on the way through:**

- **A dead poller that read as a live one.** A 12-second interval refreshed the
  inbox, guarded by `currentActiveTab !== 'whatsapp'` — a tab name that stopped
  existing when WhatsApp and Follow-ups became Messages. The guard was therefore
  true on every tick, so the interval cleared itself immediately and had refreshed
  nothing since; the assertion that pinned it went on passing because it read the
  guard rather than the effect. The handoff settles it from the other side — the
  register must not poll a connection it does not need — so the interval, its
  constant and its handle are deleted, and what is checked now is their absence.
- **A door onto one grey sentence.** With the connection gone, the Posting lens's
  *The inbox & the record* door opened onto a single line saying the number was
  not linked — the same fault, in miniature. The door is not drawn at all until
  there is something behind it.

### 8.19 The Telling lens, and the ranking that runs the other way

The fourth handoff (`design_handoff_messages_telling/`) specifies **Telling** as
its own view. It existed as a chip on the lens row and a group inside the
register, and it borrowed the register's everything — title, cards, row template
— which put an `AT STAKE` column and a debt chip over a list where nothing is
owed, and left the ranking column blank on every row.

**The finding it forced.** Telling ranks on the *opposite* of what Money ranks
on. On Money a message left unsent gets **more** urgent every day, because the
debt is still there tomorrow. Here it gets **less** worth sending, because the
reason expires: goods somebody asked for are news for a day, a delivery is news
until the van arrives, a price cut is news only while the price holds. So the
column that ranks this list is **Good until**, the sort is soonest-to-go-stale
first, and **there is no value column at all**.

That last one is a decision, not an omission, and it is the one most likely to
be undone by somebody who thinks a list of messages ought to say what each is
worth. One of the three kinds — *a delivery is on today's run* — **earns no
order whatever**. It prevents a phone call. Ranked by what it might sell it
comes last for ever, which is exactly wrong: its entire worth is that it is true
today and worthless tomorrow, and that is what Good until measures and an amount
cannot. The test file pins the absence of the column against the grid itself
rather than against a comment.

**Built:** 4a and 4b in full — the three cards (the third carrying no figure,
because the best reason to speak is a phrase), the five-track list with the
message in miniature under each name, the evidence pill that answers *why me*,
the **Better posted** band, the seven-day **No longer worth saying** group, and
the two readings below the list rather than in a right rail. On the phone it is
one card per reason with a thumb-sized act, emitted from the same call as the
desktop row.

**The three kinds, each derived from its own condition** — nobody adds a row here
by hand: a follow-up the client took out themselves for something that has since
landed; an order on the board with status `pending_delivery`; a line the customer
book's own queue says they are due, which becomes *back in stock* when the shelf
shows a crossing inside the last fortnight.

**The routing rule is computed.** A fact about a **product** goes to Posting; a
fact about a **person** stays a word. A price cut is a product fact however few
people it suits, so it appears under Better posted, dimmed, with its place in the
posting queue where the action would be. That is what sets Telling to three and
the badge to money-plus-telling.

**The debtor rule, reconciled rather than overridden.** The handoff says a person
with money owed is *flagged, not excluded*. The app's own picture queue holds a
debtor back, and is right to: somebody being asked for money does not also get a
picture of cement, they get the statement. Both survive, because the case the
handoff draws is a **product-level** fact — which is never sent to that person at
all. So a held-back client appears here **only** for a reason that routes away
from them, with what they owe in the caution ink; their person-level reasons stay
held and are not drawn.

**The sweep needs a stamp, and that is the one thing on this lens that is not
read from the books.** Every other figure is derived when somebody looks. This
one cannot be: the condition that made a reason true is precisely what has gone.
So `presetTellSeen` stamps each live row as the screen draws it, pruned on read
at seven days — the same shape and the same rules as the chase stamps.

**Deviations, each for a reason:**

- **Two tracks are wider than the frame**, for the reason every other register
  here is wider. The frame's 96px *Next* holds a button; this column also holds
  "1st in the queue", a pill of words that is cut at 96 with nothing to say it
  was. And the frame's 168px *Why them* holds "they owe 2,410,000"; every figure
  in this app carries UGX, and `they owe 3,330,000 U…` is not a shortened figure,
  it is a wrong one.
- **The row carries two forms of one truth.** `fact` is the message in miniature
  for a column that has the name above it and a header over each part; `say` is
  the sentence the draft uses, for somebody holding a phone with neither. Same
  split a follow-up reason makes between `short` and `text`.
- **"Asked twice, 16d ago" is counted from two ledgers** — the client's own
  follow-up list and the requests on a sourcing lead — because an ask taken at
  the counter and an ask taken in a chat are the same ask to the person who made
  it.

**Found on the way through:** the Money lens's **To message** card counted every
hub row, which was right while Telling was a lens over those same rows and wrong
the moment it stopped being one — it read 3 over a list of 1. A figure and the
rows beneath it disagreeing about the same thing is the Debtors bug this app was
rebuilt to remove. It counts the money queue now, and the card beside it names
the words the Telling lens holds, so *everything else is clear* is never said
over three unsent messages.
