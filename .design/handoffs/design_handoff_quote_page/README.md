# Handoff: Quote (1a · 1b · 1c)

## Overview

The quote screen — where a sale is built. Three artboards in `Quote.dc.html`:

| Id | What it is |
| --- | --- |
| **1a** | Console, building a quote · 1440 × 900 |
| **1b** | The same screen on its **Saved** lens · content area only, 1040 wide |
| **1c** | Phone · 390 × 844, compact |

It belongs with `design_handoff_dashboard_today/` (Today), `design_handoff_sell_section/`
(Invoices, Customers, Agents, Messages), `design_handoff_buy_section/` (Forecasts · Stock, Sourcing,
Suppliers) and `design_handoff_catalogue_and_rail/` (the rail, Inventory, Pricing). **The rail is specified
in that last bundle and is the authority** — Quote's rail here draws the same final map with New quote active.

`Quote page.dc.html` in this folder is the earlier *before / after* exploration, kept for reference only. The
design to build is `Quote.dc.html`.

## About the design files

`Quote.dc.html` is a **design reference written as HTML** — a prototype of layout, copy and state, not
production code. Recreate it in the existing Omni-Ware codebase (`index.html`, the `tab-quote` section and its
`renderQuoteItems()` / item-picker functions). `support.js` is the prototype runtime and has no role in the
implementation.

## Fidelity

**High fidelity** — colours, type, spacing, grid tracks and copy are final. The data is **plausible demo
data**; wire every figure to its real source. Desktop fills its viewport; the phone is a separate design, not
a reflow.

---

## The decisions this screen makes

1. **The arithmetic happens once, in the dock.** Client pays · Costs you · You keep + kept-% live in the
   72px footer and nowhere else. No running total in the table, no second subtotal above the actions — a
   figure computed twice is a figure that can disagree with itself.
2. **Charges and credit terms are document rows**, inside the same table as the goods, on a tinted ground
   (`#fbfaf8`) with the quantity and unit-price cells left empty. They are part of what the client pays, so
   they sit in the list that says what the client pays. They are not a side panel.
3. **One table, split by a rule.** The client side (Item · Qty · Price each · Line total) and the shop side
   (Buy from · Buy @ · Keep) are separated by a **1px `#dcdad4` divider as its own grid track**, which
   continues as `#f0eeea` through every row. Two tables would let the eye lose the line it is on; a colour
   change alone would not say *these figures are yours, those are the customer's*.
4. **Figures are editable in place.** Any value the user types carries a dotted underline
   (`text-decoration: underline dotted #b6bdca; text-underline-offset: 3px`) — quantity, price each, a
   charge's amount. The dotted rule is the affordance; nothing else in the app uses it.
5. **The screen suggests from history, never from a catalogue dump.** *Usually buys* chips under the search
   are this client's own repeat lines with their usual quantities; *Goes with it* is what was bought alongside,
   with the ratio stated ("4 of 5 orders").
6. **Saved quotes is a lens, not a screen.** Already merged in the app (`quote-saved` → `resolveTab` opens
   Quote on Saved). The lens row is Building · Saved · Sent.

---

## 1a · Console, building a quote

### Layout

Rail 236 → content column. Top bar 58px (breadcrumb `Sell › New quote`, search, actions, avatar). Then:

- **Client strip** — a card row split into cells by 1px rules: who the client is (name, phone, area), what
  they owe, and their last order. Each cell is a 10.5px `.lbl` over a mono figure.
- **Item card** — a 40px *Add item* field (placeholder `Add item — name, SKU or supplier code`, with a `/`
  key cap), the *Usually buys* chip row beneath it, then the table.
- **Right column, 310px** — four cards, top to bottom by urgency: **Cheaper elsewhere** (amber card,
  `#fff3d9` on `#f6e2b8`, naming the line, the supplier, the saving and *when it was last bought there*, with
  a one-press *Switch the supplier on line 2*), **Stock to cover it** (`1 short` chip; per line `qty / on
  hand`, the short line in bad ink with `order in`), **Goes with it**, **Last order**.
- **Dock, 72px** — the three figures, then `Send on WhatsApp`, an overflow, and `Save quote` in coral.

### The table

Grid tracks, exactly:

```
26px  minmax(200px,1fr)  68px  92px  100px  1px  108px  88px  52px
column-gap: 8px
```

`#` · Item · Qty · Price each · Line total · **divider** · Buy from · Buy @ · Keep.

- The item cell's floor is **200px** — a name is cut before a figure ever is. Second line carries the unit and
  the stock fact: `Ctn · 4 in stock`, or in caution ink `500 cheaper at Shafik Katwe`, or in bad ink
  `0 in stock · 1 to order in`.
- **Keep** is a chip per line: good `#e2f5ec`/`#0f7a56`, caution `#fff3d9`/`#96600f`. A thin line is visible
  without opening anything.
- **Line total** carries a 10.5px `UGX` suffix in `#5f6a7d`; the other money cells do not (the unit is stated
  once per row).
- Charge rows (`Transport · charge`, `Credit terms · +3% on 30 days`) use the same grid with empty cells, so
  the money column still lines up.
- The **add row** closes the table: a dashed 22px `+` tile, the sentence *Next item, a charge, or credit
  terms*, then chips — `Delivery 60,000`, `Urgent 5%`, `On credit +3%`, `Other` (dashed). The charge the shop
  adds most often is one press, not a form.

## 1b · The Saved lens

Same screen, same header and search; only the lens changes. Subtitle states the position:
*Eight quotes saved and not yet ordered · 6,240,000 waiting on a yes*. Lens row: Building (4 lines) ·
**Saved (8)** · Sent (12).

Table columns: **Client · Value · Waiting · You keep · Next**. *Waiting* is how long since it was sent, which
is the column that decides what to do; *Next* is the action the row earned (chase, convert, let go). Ranked by
what is at stake, not by date.

## 1c · Phone

Five stacked children, summing to 844: navy header (title + client + tabs **Building · Saved · Details**) →
40px search on white → scrolling line list → 64px action dock → 56px tab bar.

- **Rows are two-line grids** `20px minmax(0,1fr) auto`: index, name, line total on line 1; `qty × price` and
  the supplier or stock fact on line 2. Editable figures keep the dotted underline.
- **The focused line expands in place** (`#fbfaf8`): a 32px −/+ stepper showing `2 Bdl`, a `×`, then a price
  field with a navy 1px border. No modal, no separate edit screen — the line you are changing stays where it
  was in the list.
- **Charges** appear as their own rows, as on desktop.
- **The shop side collapses to one strip**: *Shop side · costs you 467,500 · you keep 51,620* with the 10%
  chip and a chevron. On a phone the margin is a fact you check, not a column you scan.
- **Dock**: *Client pays · 5 lines* with the mono total, a 44px WhatsApp button and `Save quote`.
- **Tab bar** is the fixed five — Today · Sell · Money · Manager · More — and **Sell is the lit slot here**,
  because the Sell slot *is* `quote`. On every screen that is not one of the five, More is lit instead.

---

## Interactions & behaviour

- **Add item** → search by name, SKU or supplier code; picking a line appends it with the client's usual
  quantity when there is one. The picker folds every warning into **one** toast (out of stock, below cost) —
  two toasts in a row means only the second is read.
- **Selling below cost is said, not stopped.** `sellBelowCostClause` names both figures, the loss per unit and
  the loss over the line; the price is saved exactly as typed. The warning never overrules the person typing.
- **The quantity picks the markup side**: at or above `packQty` earns the wholesale rule, and a *fixed*
  wholesale markup is per pack — divide by `packQty` for the per-unit figure. A line off the shop's own shelf
  asks the stock book first. Full rules in `design_handoff_catalogue_and_rail/README.md` (Pricing).
- **Cheaper elsewhere** offers the switch; it never reprices silently. **Stock to cover it** never blocks a
  quote — it states what will have to be ordered in.
- **Save quote** keeps it on the Saved lens; **Send on WhatsApp** hands off to a deep link the app cannot see,
  so the send is stamped afterwards (the Messages pattern in `design_handoff_sell_section/`).
- Hover states as tokenised; `:focus-visible` a 2px accent outline at 2px offset; no animation beyond
  120–160ms colour transitions.

## State

The draft quote (client, lines, charges, credit terms), the focused line and which of its cells is being
edited, the active lens, and the item-picker query. Everything else is derived and must not be stored twice:
line totals, the three dock figures, the kept-%, the cheaper-elsewhere comparison, stock coverage, and the
*usually buys* and *goes with it* suggestions.

---

## Design tokens

**Colour.** Ground `#f6f5f2` · surface `#ffffff` · sunken `#faf9f6` · charge-row tint `#fbfaf8` · rules
`#ecebe6` / `#f0eeea` / `#e2e0da` / divider `#dcdad4` · ink `#1b2233` · secondary `#5f6a7d` · quiet `#b6bdca`
· navy `#17223c` · coral `#ef4b39` (**fill and icon only, never text**) · coral text-safe `#c2311f`
(hover `#a5291a`). Meaning tints: bad `#ffe1dc`/`#b2301f` · caution `#fff3d9`/`#96600f` (card border
`#f6e2b8`, tile `#ffeccd`, ink on tint `#6b5a33`) · good `#e2f5ec`/`#0f7a56` · neutral chip
`#f2f0ec`/`#5f6a7d`. Every ink clears 4.5:1 on its ground.

**Type.** IBM Plex Sans 400/500/600/700; IBM Plex Mono 400/500/600 for every figure
(`font-variant-numeric: tabular-nums`, `letter-spacing: -0.02em`). Dock total 22px mono (20px on phone) ·
screen title 24/700 · card title 13.5/700 · row primary 13.5/600 · row secondary 11.5/400 · column header
10/600 uppercase `.07em` (9.5px on phone) · `.lbl` 10.5/600 · chip 11/600 · unit suffix 10.5/500.

**Spacing.** Page 22px · card 11–14px · row 8px 14px · gaps 12px between cards, 16–22px between columns.
Radius: cards 14 · frames 18 (phone 26) · inputs 10 · buttons 9–10 · steppers 7 · chips 999. One elevation:
`0 1px 2px rgba(23,34,60,.05)`. Fixed: top bar 58 · rail 236 · right column 310 · dock 72 (phone 64) · phone
tab bar 56 · add-item field 40 · dock buttons 42 (phone 44) · **phone targets ≥44**.

**Icons** Lucide, stroke 2 (2.2–2.4 at small sizes), round caps, `fill:none`, 12–19px.

## Files

| File | Contents |
| --- | --- |
| `Quote.dc.html` | 1a console · 1b Saved lens · 1c phone |
| `Rail.dc.html` | The rail, for reference — specified in `design_handoff_catalogue_and_rail/` |
| `Quote page.dc.html` | The earlier before/after exploration. Reference only |
| `support.js` | Prototype runtime only |

## Suggested order of work

1. **The table** — the grid tracks, the divider track, and charges as rows. Everything else hangs off it.
2. **The dock**, as the single home of the arithmetic.
3. **The right column**, in the order given: cheaper elsewhere, stock coverage, goes with it, last order.
4. **The phone**, including the in-place stepper and the collapsed shop-side strip.
5. **The Saved lens** last — it is the same list with a different sort and one extra column.
