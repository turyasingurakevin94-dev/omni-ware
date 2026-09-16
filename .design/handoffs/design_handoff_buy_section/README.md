# Handoff: Buy section + Forecasts · Stock

## Overview

Three screens: the buying plan (which lives under **Insight › Forecasts › Stock**, not Buy), and the two
screens Buy actually keeps — **Sourcing** and **Suppliers**. They continue the pass documented in
`design_handoff_dashboard_today/` (Today), `design_handoff_quote_page/` (Quote) and
`design_handoff_sell_section/` (Invoices, Customers, Agents, Messages). The visual system is the same and
is restated below so this README stands alone.

One cut is argued here, and one is argued in `Rail.dc.html` and realised here:

| Screen | Absorbs / replaces | Net rail change |
| --- | --- | --- |
| Sourcing | nothing — but it keeps the quotes-for-a-stated-quantity block | Buy 3 → 2 via Compare → Pricing |
| Suppliers | **Creditors** (deleted, becomes the You owe lens) | one of the four cuts that take Money 8 → 4 |

Combined with the other three Money cuts settled in `Rail.dc.html` — Debtors → Customers, Consignment →
Inventory, and Money's Pricing screen joining the Catalogue Pricing row — Money ends at **4 rows**: Cash
book, Statements, Payroll & rent, Assets & loans. The financial statements keep their row.

## About the design files

The `.dc.html` files are **design references written as HTML** — prototypes of layout, copy and state. They
are not production code and must not be pasted into the app. Each is a canvas holding a 1440×900 desktop
console and a 390×844 phone, each a full recreation of the app shell, followed by a lilac card arguing that
screen's cut. Recreate them in the existing Omni-Ware codebase (`index.html`, its `renderX()` functions and
`tab-*` sections) using its established patterns. `support.js` is the prototype runtime; it has no role in
the implementation.

## Fidelity

**High fidelity** — colours, type, spacing, radii and copy are final. Two caveats: the data is **plausible
demo data** (wire every figure to its real source), and the frames are fixed-size (desktop fills its
viewport with a fixed rail and a fixed 390px detail column; the phone is a separate design, not a reflow).

---

## Where these screens live (read this first)

`resolveTab()` records merges the app has **already done**. Do not re-litigate them:

| Old door | Lands on | Lens |
| --- | --- | --- |
| `buying` (What to buy) | `forecasts` | `fcLens='stock'` |
| `purchase-invoices` | `invoices` | `invSide='buys'` |
| `chase` / `telling` | `followups` | `fupWhy='money'` / `'telling'` |
| `stock-movements` | `inventory` | `invLens='moves'` |
| `loans` | `assets` | — |

So the buying plan is **not** a Buy screen. It is the **Stock** lens of Forecasts, placed beside the **Cash**
lens it has to be judged against, with **The day** as the third lens. Buy holds `compare`, `sourcing`,
`suppliers` — choosing what to buy and from whom.

**Rail convention in these frames:** every rail draws the **final map**, settled in `Rail.dc.html` (the
authority if a frame disagrees): **Sell 6** (New quote, Order tracking, Invoices, Customers, Messages, Sales
agents), **Buy 2** (Sourcing, Suppliers), **Catalogue 4** (Products, Pricing, Inventory, What goes with
what), **Money 4** (Cash book, Statements, Payroll & rent, Assets & loans), **Insight 4** (Forecasts,
Analysis, Manager, Map), **Setup 3** — 23 rows plus Today, down from 33 plus Today. Implement the cuts and
the rail counts together, or a shut section's count will not match what is inside it.

Two things this supersedes. **Compare prices is absorbed by Pricing, not by Sourcing** — Pricing is one row in
Catalogue holding the markup rules, what you paid, the tiers and the rival prices (it absorbs Money's Pricing
screen and the Price registry as well), and comparing suppliers happens on a line's panel where the quantity
is known. Sourcing keeps its quotes-for-a-stated-quantity block, which is the same reading applied to a lead.
And **badges count obligations only**: Sourcing and Suppliers carry one; Forecasts does not, because a buy
plan is advice and a badge on advice teaches people to ignore badges.

---

## Design tokens

### Colour

| Token | Hex | Use |
| --- | --- | --- |
| Ground | `#f6f5f2` | App background behind cards |
| Surface | `#ffffff` | Cards, top bar, list bodies |
| Surface sunken | `#faf9f6` | Table headers, group rows, footers |
| Surface inset | `#f7f6f3` | Small stat tiles, notes |
| Rule / inner / input | `#ecebe6` / `#f0eeea` / `#e2e0da` | Card borders / row dividers / inputs |
| Ink | `#1b2233` | Primary text |
| Ink secondary | `#535d70` | Secondary text (4.5:1 on every ground above) |
| Ink tertiary | `#5f6a7d` | `.lbl` labels, inactive icons |
| Ink quiet | `#b6bdca` | Chevrons |
| Navy | `#17223c` | Rail, panel headers, phone header |
| Coral | `#ef4b39` | **Fill and icon only, never text** — logo tile, active tab underline |
| Coral text-safe | `#c2311f` | Primary button, avatar fills, dots carrying white text |
| Coral pressed | `#a5291a` | Primary hover |
| Bad | `#ffe1dc` / `#b2301f` | Late, out of stock, thin margin, price rises |
| Bad card | `#fff1ec` / `#fadbd1` / `#7a4436` | Over-budget and unreliable KPI cards |
| Caution | `#fff3d9` / `#96600f` | Owed, held back, over limit |
| Caution card | `#fff8e8` / `#f4e3bd` / `#6b4a0d` | The "you owe" KPI and warning blocks |
| Good | `#e2f5ec` / `#0f7a56` | Picked, settled, margin, price falls |
| Good card | `#ecf8f2` / `#d3ebe0` / `#39544b` | Positive KPI cards |
| Studied | `#eaf1ff` / `#1d5bb8` | Neutral information; `#d7e8ff` bar fills |
| Manager / agent | `#e6e3ff` / `#4230a8`, bar `#8d7bd8`, ink-on-tint `#3a2f8f` | Holds, price drift, season |
| Annotation | `#f4f1ff` / `#e3ddfb` / `#40465a` | Hold band; cut cards (canvas only) |
| Selected row | `#f4f1ff` | Picked row |
| Neutral chip | `#f2f0ec` / `#535d70` | — |
| Empty bar track | `#f0eeea` | — |

Every ink clears 4.5:1 on its ground. `#ef4b39` never carries text.

### Type

**IBM Plex Sans** 400/500/600/700 for all UI; **IBM Plex Mono** 400/500/600 for every figure and identifier.
`.fig` is mandatory on numbers: `font-family:'IBM Plex Mono'; font-variant-numeric:tabular-nums;
font-weight:600; letter-spacing:-0.02em`.

Screen title 24/700 (`-0.02em`) · subtitle 13/400 `#535d70` · KPI figure 20/600 mono · panel figure 15–17/600
mono · card title 13.5/700 · row primary 13.5/600 · row secondary 11/400 · column header `.lbl` 10/600
uppercase `0.07em` · section label `.lbl` 10.5/600 `0.03em` · chip 11/600 · `.pill` mono 10.5/600 · rail item
13.5/500 (600 active) · rail group heading 10.5/700 uppercase `0.12em` · body 12–13/400 `line-height:1.55`
`text-wrap:pretty`. Minimum size 9.5px (tab-bar labels only).

### Spacing, radius, elevation

Page padding 22px · card padding 10–14px · row padding 9–10px 14px · gaps 12px between cards, 16px between
columns, 6–11px inside rows. Radius: cards 14, frames 18 (phone 26), buttons/inputs 8–11, chips 999,
thumbnails 8, bars 2–3. One elevation: `0 1px 2px rgba(23,34,60,.05)`. Fixed: top bar 58, rail 236 wide,
detail column 390 wide, phone tab bar 56, rail item 34, buttons 26/28/34/36/40, **phone targets ≥44**.

### Icons

Lucide, stroke 2 (2.2 at ≤15px, 2.4 for checks/crosses/menu), round caps and joins, `fill:none`, 12–19px.

---

## The app shell

### Desktop

Rail 236px navy (`flex:none`) → content column. Content: 58px top bar (breadcrumb `Section › Screen [› Lens]`,
36px search field max 400px with a natural-language placeholder and a `Ctrl K` cap, spacer, one secondary
action or status chip, 34px avatar) → title block (24/700 title + one line saying how the list is ordered) +
lens group on the right (`#efedE9` container, radius 10, 4px padding, 32px pills, active pill white with the
card shadow, each carrying a count chip) → KPI strip `repeat(4,minmax(0,1fr))` gap 12 → content row `flex:1`
gap 16: list card `flex:1;min-width:0` (header / column header / scroll body) and detail column
`width:390px;flex:none;overflow-y:auto` in which **every card carries `flex:none`** so the column scrolls
instead of squashing.

### Phone (a separate design, not a reflow)

Navy header (title row, then a 3-up figure strip in `rgba(255,255,255,.07)` radius 10 with one cell tinted
when it is the bad one, then the lens row as three 34px tabs, active white 700 with a 2px `#ef4b39` bottom
border) → scroll body `flex:1;min-height:0` → optional action footer → **tab bar**.

**Tab bar — fixed membership, identical on every screen** (`MMS_BAR_TABS` / `<nav class="mobile-bottomnav">`):
**Today** → `dashboard`, **Sell** → `quote`, **Money** → `cashbook`, **Manager** → `manager`, **More**.
Never swap a slot for the screen on display. The lit slot is the open screen when it is one of the five and
**More** on every other screen — which is the case for all three screens here. Lit item: icon in a 38×22
`#ffe1dc` pill with a `#c2311f` 9.5/700 label (in the app a filled icon variant swaps in). Today carries a
7px `#c2311f` dot when something waits, read off the count Today already rendered.

### Shared patterns

Grouped lists with a `.grow` header (`#faf9f6`, rules top and bottom, state chip, bold count, the group's own
subtotal right) — **a subtotal must equal the rows beneath it**; label any headline that means something
narrower. Settled/covered rows dim to `opacity:.6–.75` rather than disappearing. Group tails collapse into
one row carrying their own subtotal. Row click paints `#f4f1ff` and fills the detail column; hover `#faf9f6`.
Every text cell is `min-width:0` + ellipsis; figures are `white-space:nowrap` and never truncate. Detail
rhythm: navy header (identity + state) → figures → evidence → actions.

---

## Screen 1 — Forecasts · Stock ("What to buy")

**File:** `Forecasts - Stock (what to buy).dc.html`. Breadcrumb `Insight › Forecasts › Stock`. Lens group is
**Stock · Cash · The day**; the plan's own sub-control (**The plan / On the way / Held**) sits in the list
card header, not in the lens row.

**Purpose.** What the shelf will need, against what the cash line can carry.

- **The rank is shillings earned in 30 days, not margin** (`purchasePlan`). Cement at 11% kept outranks
  binding wire at 38% because it earned 1,240,000 against 420,000. Never re-sort by percentage.
- **The kept share sits on every row** (`buyKeptPct` via `buyLineFacts`), flagged `bad` when thin — and
  **withheld** when the books cannot support it: nothing sold, a loss, or more than half the month's cost
  estimated. Never guess it; simply omit the fact.
- Row facts are a wrapping row of `label + mono value` pairs: `sold 412 bags · earned 1,240,000 · kept 11%`,
  plus `cost fell 8%`, `ran out 4 days ago`, `goes with iron sheets` where they apply.
- Grid `26px minmax(170px,1fr) 148px 132px 92px`: rank · line and what it did · Left · runs out (bad ink when
  cover ≤ 3 days, with `lead N`) · Buy (quantity + supplier @ unit) · Cost + the action button.
- **The tier prompt** is an inset row under the line: "150 bags takes the price to 27,400 — 90,000 saved, one
  week more stock", with a `Take 150` button (`buyNextTier` / `buyTierWorthIt`).
- **A hold argues, it never hides** (`buyHoldFor`). The held line **keeps its rank and its Buy it button**,
  and the hold band sits **above** the buy instruction — underneath it reads as a footnote to a decision
  already taken. Band: `#f4f1ff` on `#e3ddfb`, radius 11, a pause glyph in `#5b46d6`, **On hold** in
  `#3a2f8f`, `The Manager · today`, the manager's sentence verbatim in quotes, and two actions —
  `Fix the price` (opens the price-rule editor) and `Lift it`. A hold **lifts when the pricing rule changes**,
  not when a supplier's cost moves (a cost rise shifts the price without repricing anything); it **runs out**
  after 30 days; its ending is news for 7 days, then forgotten. The panel states that rule in words.
- **Not on the plan** group: lines already ordered stay visible, dimmed, saying what is coming and when — the
  plan subtracts them before recommending (`buyOrdersOnTheWay`).
- Detail column: **Today's basket** (navy header with the total; lines grouped per supplier, one order each;
  then Safe to spend, a two-segment bar, and the over-budget sentence naming the line whose cover could wait)
  → **On the way** (late first, with the learned-lead-time explanation) → **Answered last week** (a lifted
  hold quoted from its own record, with the before and after prices).
- KPIs: Safe to spend `5,000,000` ("30 days ahead · tightest 11 Oct at 780,000" — `cashAhead`) · This basket
  `8,860,000` (bad tint, "3,860,000 more than is safe") · Already on the way `2,140,000` ("3 orders · taken
  off the plan already") · Collecting would pay for `3,050,000` (good tint, naming the debtors —
  `collectToBuy`).

## Screen 2 — Sourcing

**Purpose.** Demand the shop could not serve. Title: *Asked for, not stocked*.

- **One line per item however it was spelled** — `findSourcingLeadByText` folds "malper hinges" onto the same
  lead; `add_sourcing_lead` returns `already_on_queue` rather than creating a second. The panel shows the
  spellings as pills on the navy header.
- **Ranked by distinct askers, not asks** (`leadDistinctAskers`), so one persistent customer cannot look like
  demand. The ask column reads `asks · people` (`7 · 5`).
- Grid `26px minmax(180px,1fr) 104px 118px 116px 76px`: rank · item and who asked · asks · people · best
  quote (+ "N quotes in") · last asked (+ "first asked Nd") · action.
- **Who asked** is an overlapping avatar cluster: 22px circles, `border:1.5px solid #fff`, `margin-left:-7px`,
  tail as `+2`, with one line of the most telling fact beside it ("Okello asked twice", "two asked through
  agents").
- **The judgement, drawn as groups:** *Real demand* — three or more different people asked; *Asked once or
  twice* — worth an answer, not a shelf; *Settled* — stocked, or answered "we do not carry it". Both open
  groups stay on screen: the shop may know something about the one customer that the count does not.
- Actions escalate with evidence: `Stock it` (dark) when quotes are in, `Get quotes` (coral) when none are,
  `Open` otherwise.
- Detail column: **Quotes in hand** — *for a stated quantity* (20 Box, the amount you would buy), best marked
  with a `best` pill on a good-tint row, the others as the percentage more they want; then the shelf price at
  the shop's own rule ("18,500 at 30% is 24,100") and who the askers are → **Who asked, and when** (dated,
  names verbatim, remainder marked "earlier · 3 more asks · …") → **What this queue has been worth** (6 lines
  stocked, 2,180,000 sold since, 26% kept).
- KPIs: Waiting on an answer `28 asks` (bad tint, "14 items · 17 of the asks came this month") · Asked three
  times or more `4 items` · Waiting on a quote `9 items` · Stocked from this queue `6 lines` (good tint,
  "2,180,000 sold since · 90 days").
- Phone leads with a **capture row** — "Someone just asked for something" on `#f4f1ff` — because this screen
  is filled at the counter.

### The cut: Compare prices → Pricing (not Sourcing)

The plan line has already ranked suppliers *for the quantity it recommends* and named the next rung on that
supplier's ladder; Sourcing picks a supplier for a line that has a quantity; the price-rule editor already
argues shelf cost against the cheapest quote. A standalone compare screen re-does that reading **without a
quantity** — and price is tiered, so it compares a number nobody will pay.

- **Lost:** a side-by-side table of every supplier's price for one product. It returns as *Quotes in hand*.
- **Absorbed by:** the **Pricing** row in Catalogue, which holds the markup rules, what you paid, the tiers
  and the rival prices; plus the plan line and the price-rule editor. All of them know the quantity. Sourcing
  keeps its own quotes-for-a-stated-quantity block, which is the same reading applied to a lead.
- **Search:** `compare`, `cheapest`, `price list`, `quotes`, `rivals` → Pricing; `resolveTab('compare')` opens
  it asking for a quantity first (same pattern as `'buying'` → Forecasts/Stock).

## Screen 3 — Suppliers

**Purpose.** Who you buy from: what you owe them, whether they keep the lead time they promise, and which way
their prices have moved. Lenses: **You owe** (default) · All 23 · Unreliable.

- Grid `30px minmax(170px,1fr) 104px 96px 104px 96px 60px`: avatar (30px **rounded square**, radius 9 — a
  supplier is an organisation, not a person; customers and agents use circles) · supplier · You owe · This
  week · **Says · keeps** · Prices · action.
- **Says · keeps** is the promised lead time against the one they hold (`supplierLeadTimes` /
  `supplierLeadDays`): `4d → 8d` with the kept figure in bad ink when it is worse, and a 10.5px caption of
  the evidence ("late 6, 8, 9 days", "kept 11 of 12", "never late"). **This is the figure the buy plan uses.**
- **Prices** is six-month drift, signed and coloured: `−8%` good, `+6%` caution, `+15%` bad, `flat` neutral.
- Groups: *Late delivering, and owed* first (one supplier, 900,000) → *Owed, delivering fine* (four,
  10,300,000) → *Nothing owed* (18, with the tail row noting Kisenyi quoted 11% under Roto and has never been
  bought from).
- Detail column: **open bills oldest first** with the line "a payment fills them in this order" and a primary
  button naming the exact amount (`Pay 995,000` = the two oldest) — this is `allocateCreditorPayment`, so the
  button must not silently pay something else → **What they have been charging**: a six-bar monthly chart
  whose heights are **proportional to the price series** (100,000 → 115,000 is a 1.15 ratio: 43 · 43 · 45 ·
  45 · 47 · 50 px; the last two months carry the emphasis fill `#8d7bd8`), the chip naming the prices rather
  than only the percentage, then per-line drift rows → **Delivery record**: a single full bar and `14 of 14`,
  with the reading that the argument against this supplier is the price, never the delivery, and the lead time
  the plan uses.
- KPIs: You owe `11,200,000` (caution card, "9 bills · 3,400,000 due this week") · Spent with them, 12 months
  `73,000,000` ("two of the 23 take 77% of it") · Do not keep their word `3 of 23` (bad tint, "2 of them on
  this lens") · Prices moved your way `2 suppliers` (good tint, "Kampala Steel −8% · one line worth
  repricing").

### The cut: Creditors

`admin-delete-guards.test.js` says it outright — *the Creditors List is built by mapping suppliers* — and the
balance it shows is `creditorTotalOwed(id)`, read off the same purchase invoices this screen reads. Two
renderings of one figure, and the app has been bitten: deleting a supplier left Creditors totalling nothing
while the bill stood, which is why `deleteSupplier` refuses while anything is owed.

- **Lost:** nothing. Creditors ranked by amount; the You owe lens groups by whether they are also late
  delivering, which is the only thing that changes what you do about a bill.
- **Absorbed by:** this screen, with the oldest-first bill list and `allocateCreditorPayment` behind Pay.
- **Search:** `creditors`, `who you owe`, `payables`, `bills`, `supplier balance` → Suppliers (the label keeps
  its own word, per the rail's rule-9 note); `resolveTab('analytics-creditors')` opens the You owe lens.

---

## Interactions & behaviour

- **Lens switch** re-sorts and re-groups in place, never navigates, and belongs in tab state so aliases can
  arm one directly.
- **Row click** selects and fills the detail column; selection survives a lens switch when the row is still
  present. Modals only for destructive confirmation.
- **Basket**: adding a line merges it into that supplier's order (`buyLineMerge`), one order per supplier; the
  total is measured against `cashAhead().safeToSpend`, not the balance. Over budget is stated with the line
  whose cover could wait — a warning, not a block.
- **Holds**: `Fix the price` opens the price-rule editor; `Lift it` overrules; `Buy it` always works. Endings
  are swept before the plan is drawn so a repricing shows on **this** render.
- **Sourcing**: `Get quotes` records candidate quotes against a quantity; `Stock it` creates the product with
  the shelf price the rule suggests, and the lead moves to Settled carrying what it has sold since.
- **Paying a supplier** allocates oldest-first and re-renders the register; a supplier owed anything cannot be
  deleted.
- Hover states as tokenised; `:focus-visible` a 2px accent outline at 2px offset; no animation beyond
  120–160ms colour transitions.

## State

Per screen: active lens, selected row id, per-column scroll. Stock adds the basket (line → quantity →
supplier), the plan's sub-lens, and the budget mode. Sourcing adds the open lead and its candidate quantity.
Suppliers adds the payment allocation preview. Derived — never stored twice — are every group subtotal, the
kept share, tier savings, lead-time learning, price drift, distinct askers, and payment allocation. All of it
must be computed from the rows on screen so a subtotal can never disagree with its rows.

## Assets

No images. Lucide icons inline. Fonts from Google Fonts (IBM Plex Sans, IBM Plex Mono).

## Files

| File | Contents |
| --- | --- |
| `Forecasts - Stock (what to buy).dc.html` | 1a desktop, 1b phone, cut argument (Compare, argued from the plan's side) |
| `Sourcing.dc.html` | 1a desktop, 1b phone, where the Compare cut lands |
| `Suppliers.dc.html` | 1a desktop, 1b phone, cut argument (Creditors) |
| `support.js` | Prototype runtime only |

Prior handoffs: `design_handoff_dashboard_today/`, `design_handoff_quote_page/`,
`design_handoff_sell_section/`.

## Suggested order of work

1. Suppliers first — `says · keeps` feeds the plan's lead times, and the Creditors cut is self-contained.
2. Sourcing, deleting Compare and folding its aliases in.
3. Forecasts · Stock last: it consumes both (learned lead times, supplier quotes) and needs the cash lens
   beside it.
