# Handoff: the rail, Inventory and Pricing

## Overview

Three pieces: **the rail** — the app's whole map, settled, and the authority if any other artboard disagrees
— and two Catalogue screens, **Inventory** and **Pricing**. It follows
`design_handoff_dashboard_today/` (Today), `design_handoff_quote_page/` (Quote),
`design_handoff_sell_section/` (Invoices, Customers, Agents, Messages) and `design_handoff_buy_section/`
(Forecasts · Stock, Sourcing, Suppliers). The visual system is the same and is restated below so this
README stands alone.

**Build the rail first.** Every other frame in every bundle draws it, and until it is right the frames
disagree with each other about which screens exist.

## About the design files

The `.dc.html` files are **design references written as HTML** — prototypes of layout, copy and state, not
production code. `Rail.dc.html` is two 236×900 artboards plus the membership table and the ten cut
arguments; the other two are a 1440×900 desktop console and a 390×844 phone each, with a lilac annotation
card. Recreate them in the existing Omni-Ware codebase (`index.html`, its `renderX()` functions and `tab-*`
sections). `support.js` is the prototype runtime; `image-slot.js` is a drag-and-drop photo placeholder used
only so the prototype can hold a dropped picture — neither belongs in the implementation.

## Fidelity

**High fidelity.** Colours, type, spacing and copy are final. The data is **plausible demo data** — wire
every figure to its real source. Desktop fills its viewport (fixed 236px rail, flexing content, fixed 390px
detail column); the phone is a separate design, not a reflow.

---

## 1 · The rail

**23 rows in six groups, plus Today — from 33 plus Today.** Ten rows are absorbed; each argument is on the
artboard in the three-part form (what is lost / what absorbs it / which words still reach it).

| Group | Rows | Shut header reads |
| --- | --- | --- |
| — | Today | — |
| **Se** Sell | New quote · Order tracking · Invoices · Customers · Messages · Sales agents | 6 |
| **Bu** Buy | Sourcing · Suppliers | 2 |
| **Ca** Catalogue | Products · Pricing · Inventory · What goes with what | 4 |
| **Mo** Money | Cash book · Statements · Payroll & rent · Assets & loans | 4 |
| **In** Insight | Forecasts · Analysis · Manager · Map | 4 |
| **Su** Setup | Staff · Worker view · The shop | 3 |

### The ten cuts

| Row | Lands on | Why |
| --- | --- | --- |
| Debtors | Customers, *Owing* lens | `renderDebtorsList()` and `renderCustomers()` must both run after every void or payment; when one is missed they disagree about one debt |
| Creditors | Suppliers, *You owe* lens | The same bug mirrored — `renderCreditorsList()` is `creditorTotalOwed(id)` mapped over suppliers |
| WhatsApp + Follow-ups | **Messages** | The list's only action is to open the box; the box's only content comes from the list |
| Compare prices | Pricing | Price is tiered, so a comparison with no quantity compares a figure nobody is charged |
| Pricing (Money) + Price registry | **one Pricing row** in Catalogue | One subject in two groups, and neither name said which held a markup |
| Media | Products, *Photos* lens | A photograph is a field on the record; a library cannot tell you which lines have none |
| Consignment | Inventory, *Consignment* lens | `consignTally` / `consignedOnShelf` already feed the shelf row |
| Sales analytics | Analysis, *Sales* lens | A sales cut of the same books Analysis already charts |
| Purchase analytics | Analysis, *Purchases* lens | The purchase cut of the same books |
| Fastener guide | The shop, and the quote's item picker | A conversion table is a reference, not a screen about money |

### Two earlier claims withdrawn — read this before deleting anything

- **Statements keeps its row.** It is the profit and loss, balance sheet and cash flow (keywords
  `profit loss balance sheet cash flow accounts`). The *customer* statement is a different thing, already
  rendered by `customerStatementBlockHTML()` inside the customer's record and built from the debt log rather
  than the invoices so credit sales are not counted twice. Invoices' **Send statement** action reaches that
  existing block; it absorbs no row.
- **There is no Commissions screen.** Commission belongs to the agent app. The *Supplier bonus* block on the
  Agents panel is new work worth doing, but it removes no row.

### Two rows deliberately kept

- **Order tracking.** Moving an order through quoted → packing → out is the one thing in Sell that is neither
  a document nor a list. A stage board folded into Quote would be a board inside the screen that creates its
  first stage. Its three counts appear as chips in the Invoices top bar: the board is where you *move* an
  order, the register where you read what it became.
- **What goes with what.** The weakest surviving row — its output is one signal, consumed by the buy plan and
  the Posting queue — but the pairings and their ratios are edited there, and a screen whose output is used
  elsewhere is not a screen that duplicates one.

### Rail specification

- `#17223c`, 236px, `flex: none`. A 30px `#ef4b39` logo tile (radius 9) with the shop name, then Today, then
  six collapsible groups. Sell open by default; the rest shut.
- **Items** 34px, radius 9, 13.5px/500 (600 active). Hover `rgba(255,255,255,.07)`; active
  `rgba(255,255,255,.13)` + white. Ink `#b9c2d6` at rest. Labels truncate with an ellipsis;
  **badges never shrink** (`flex: none`) — a clipped count is a wrong count, a clipped name is still a name.
- **Group headers** a 20px two-letter tile (radius 6, 9.5px/700), an uppercase 10.5px/700 heading at
  `letter-spacing: .12em` in `#7d89a5`, a mono 10px/600 count pushed right, and a chevron. Tiles:
  Se `#ffe3d6`/`#8f3009` · Bu `#e6e3ff`/`#4230a8` · Ca `#d9f2e6`/`#0b5e42` · Mo `#d7e8ff`/`#164a96` ·
  In `#ffdfe9`/`#8a2450` · Su `#f0eeea`/`#5f6a7d`.
- **A shut section still shows the row you are on** — artboard 1B has Sell shut reading 6 with Invoices still
  visible beneath it and 6px of air below, so the rail never loses your place.
- **Badges count obligations, never suggestions.** Exactly eight rows carry one: Today 8 · Order tracking 5
  (packed, not gone) · Invoices 4 (overdue) · Customers 11 (owing) · Messages 13 (words owed) · Sourcing 14
  (people waiting on an answer) · Suppliers 5 (bills due) · Pricing 14 (lines that would sell at cost).
  **Not** Inventory's under-floor lines or Forecasts' buy suggestions: those are the plan's advice, and a
  badge on advice teaches people to ignore badges. One treatment — `#c2311f` fill, white mono 11px, 19px tall,
  `min-width: 19px`.
- Every count is **derived** from the work, never stored. The rail is the complete map: nothing behind a
  hover, a menu or a "more" affordance, and every cut row needs its keywords rehomed plus an alias so old
  links still land (`resolveTab()` already does this for nine screens).
- The phone tab bar is untouched and identical on every screen: Today → `dashboard`, Sell → `quote`,
  Money → `cashbook`, Manager → `manager`, More. Anything cut from the rail stays reachable through More.

---

## 2 · Inventory — "On the shelf"

The shelf as a list with the money on it: quantity × cost, which is the figure that says what to count first.
Lenses: **The shelf** · **Movements** (already merged, `invLens='moves'`) · **Consignment** (this pass).

**Three rules the code keeps and the screen now shows:**

- **null is not zero.** A line with stock and no cost reads **cannot be valued**, never 0, and sorts **last**
  in the value sort — "nobody wrote down what it cost" and "worth nothing" are different facts, and the
  balance sheet already calls the first understated. A costed line with an empty shelf is worth exactly 0 and
  outranks the unknown one. `uncosted` is flagged only when there *is* stock: an empty shelf with no cost is
  an empty shelf, not a gap.
- **Two figures, each labelled as what it is.** The strip is the **whole shelf, unfiltered** — 48,600,000 "at
  what you paid", 192 lines on file, and it never moves when a filter does, because it is read against the
  balance sheet. The list header counts **what is listed** beneath it: 12 lines, 9,240,000. Two figures only
  contradict each other if both claim to be the same figure.
- **No tile ever reads 0.** A count that would be nought is replaced by the reading that makes it good news,
  so a healthy shelf never looks like a broken app.

**Layout.** Grid `34px minmax(0,1fr) 108px 104px 152px` — thumbnail, Line, Left, Cost each, Value here. Only
the name column flexes, so a name is cut before a figure ever is; the column header is a **sticky first child
inside the scroller** (not a sibling) so both grids resolve `1fr` against the same width and the money column
lines up with the label naming it. Floor, sales rate, days left and ownership live on the row's second line
(`under floor 60` pill, `2 of 5 Kirinya's` pill). Figures are mono + `tabular-nums`. 20 to a page; the pager
must describe the list under it (a filter that leaves 12 lines is one page, however long the shelf is).

**The repair drawer** is one amber line, hidden entirely when empty, and it states its own order: match cost
records to the shelf **first** (matching can leave new units uncosted behind it), then price the 14 lines with
stock and no cost, then photograph the 61 with no picture.

**Search** is two passes: strict substring first, then a word-start-anchored subsequence only when the strict
pass finds nothing (`sndppr` → sandpaper; three letters minimum; "rdr" must not match "truss head screws").
Hide-no-stock is on by default, and an empty result names the filter that emptied it rather than denying the
match.

**The cut here is a judgement, not a page.** The below-floor queue and the buy plan rank the same lines off
the same `restockRiskRows()` — one by days left, one by shillings earned. Inventory **counts** them ("7 lines
· 3 already on the buy plan") and hands the ordering to Forecasts · Stock, because a floor cannot see cash,
lead times or what is already coming.

---

## 3 · Pricing — the pricing book

One row absorbing **Price registry**, Money's **Pricing** and **Compare prices**. Lenses: **The rules** ·
**What you paid** · **Rivals** · **Thin & dead**.

**What the screen is for.** A shop keeps four markup rules per line — retail and wholesale, each with a
stock-book twin for goods off its own shelf — and a variant's own values override the product's. The quantity
picks the side: at or above `packQty` earns wholesale.

**Three things it says that no figure in the app said before:**

- **A side with no rule sells at cost.** 14 lines are one loose sale away from it. Three ELEPHANT King cartons
  went out at 300,000 — the shop's own cost — because there was no retail rule and no pack quantity, while a
  10,000 wholesale markup sat on file. The panel shows what the same sale would fetch with a rule (336,000) and
  what four cartons make on the wholesale side.
- **A fixed wholesale markup is per pack.** +6,000 on a carton of twelve is **+500 a tin**. Print the
  per-unit figure wherever a fixed wholesale rule appears — the same number read the wrong way is twelve times
  the price.
- **Inheritance is drawn, not hidden.** A mono *italic* `#535d70` figure means the line is using the product's
  or the supplier-book's rule; an upright coloured figure means it sets its own. So the G28 · 3m variant's 10%
  reads as the exception it is. Never render an inherited value in a grey too light to read — it is data, not
  decoration.

**Layout.** Grid `34px minmax(0,1fr) 88px 104px 120px 60px` — thumbnail, Product, Retail, Wholesale,
**Own goods r·w** (the two stock-book rules in one cell), Pack. Sticky header inside the scroller, as
Inventory. `not set` renders in `#96600f` — amber, because it is a gap rather than a failure. Variant rows are
indented with a 24px marker tile and inherit everything they do not override. Groups: **Would sell at cost**
(14, with a tail row for the 11 not drawn) then **Priced by a rule** (178, tail = 178 minus the products the
frame draws).

**Selling below cost is said, not stopped.** `sellBelowCostClause` names both figures, the loss per unit and
the loss over the line, folded into the picker's single toast rather than a second one — and the price is saved
exactly as typed. The panel's *Sold under cost, last 30 days* block exists because a quote shows only a total
profit, and a total cannot say which line went under. Two of those nine were deliberate clearances; the
cartons were the rule gap, and nobody chose them.

---

## Design tokens

**Colour.** Ground `#f6f5f2` · surface `#ffffff` · sunken `#faf9f6` · inset `#f7f6f3` · rules `#ecebe6` /
`#f0eeea` / `#e2e0da` · ink `#1b2233` · secondary `#535d70` · tertiary `#5f6a7d` · quiet `#b6bdca` · navy
`#17223c` · coral `#ef4b39` (**fill and icon only, never text**) · coral text-safe `#c2311f` (hover `#a5291a`).
Meaning tints: bad `#ffe1dc`/`#b2301f` (cards `#fff1ec`/`#fadbd1`/`#7a4436`) · caution `#fff3d9`/`#96600f`
(cards `#fff8e8`/`#f4e3bd`/`#6b4a0d`) · good `#e2f5ec`/`#0f7a56` (cards `#ecf8f2`/`#d3ebe0`/`#39544b`) ·
studied `#eaf1ff`/`#1d5bb8` · consignment and Manager `#e6e3ff`/`#4230a8` · neutral chip `#f2f0ec`/`#535d70` ·
selected row `#f4f1ff` · annotation `#f4f1ff`/`#e3ddfb`/`#40465a`. Every ink clears 4.5:1 on its ground.

**Type.** IBM Plex Sans 400/500/600/700; IBM Plex Mono 400/500/600 for every figure and identifier
(`font-variant-numeric: tabular-nums`, `letter-spacing: -0.02em`, weight 600). Screen title 24/700 · subtitle
13/400 · KPI figure 20/600 mono · card title 13.5/700 · row primary 13.5/600 · row secondary 11/400 · column
header 10/600 uppercase `.07em` · section label 10.5/600 · chip 11/600 · pill mono 10.5/600 · rail item
13.5/500 · body 12–13/400 `line-height:1.55` `text-wrap:pretty`. Minimum 9.5px (tab-bar labels).

**Spacing.** Page 22px · card 10–14px · row 9–10px 14px · gaps 12px between cards, 16px between columns.
Radius: cards 14 · frames 18 (phone 26) · buttons/inputs 8–11 · chips 999 · thumbnails 7–9 · bars 2–3. One
elevation: `0 1px 2px rgba(23,34,60,.05)`. Fixed: top bar 58 · rail 236 · detail column 390 · phone tab bar 56
· rail item 34 · buttons 26/28/34/36/40 · **phone targets ≥44**.

**Icons** Lucide, stroke 2 (2.2 ≤15px, 2.4 for checks/crosses/menu), round caps, `fill:none`, 12–19px.

---

## State

Per screen: the active lens, the selected row id, per-column scroll, and the page (clamped — a filter can
shrink the list under the page you are on, and every control that changes *what* is listed returns to page 1).
Everything else is derived and must never be stored twice: group subtotals, shelf value, uncosted and
below-floor counts, days left at the actual sales rate, the four resolved markup rules, the per-unit figure for
a fixed pack markup, the suggested shelf price, and every rail badge.

## Files

| File | Contents |
| --- | --- |
| `Rail.dc.html` | 1A Sell expanded · 1B Catalogue expanded · membership table · the ten cut arguments · withdrawn claims |
| `Inventory.dc.html` | 1A desktop · 1B phone · cut argument (one ranking of what is running out) |
| `Pricing.dc.html` | 1A desktop · 1B phone · cut argument (three screens about price become one) |
| `image-slot.js`, `support.js` | Prototype only |

## Suggested order of work

1. **The rail**, with the keyword rehoming and `resolveTab()` aliases for all ten cut rows — every other
   screen in every bundle draws it.
2. **Pricing**, since the rule-gap figure is money leaking today and the badge belongs on the rail from the start.
3. **Inventory**, whose below-floor count links into Forecasts · Stock rather than ranking a buy itself.
