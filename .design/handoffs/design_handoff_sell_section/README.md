# Handoff: Sell section redesign (Invoices · Customers · Agents · Messages)

## Overview

Four screens of the Omni-Ware admin, redesigned as one coherent section. They continue the pass that
produced `design_handoff_dashboard_today/` (Today) and `design_handoff_quote_page/` (Quote); the visual
system is the same and is restated in full below so this README stands alone.

The redesign does two things at once:

1. **Restyles** each screen onto the card idiom (IBM Plex, navy rail, warm ground, one coral accent,
   tints that mean something).
2. **Removes duplication.** One screen is proposed for deletion and one pair is merged. Each cut
   names what is lost, what absorbs it, and how the words people search by still reach the work. The
   cuts are the substance of the change — implementing only the restyle leaves the app with the same
   synchronisation bugs it has today.

| Screen | Absorbs / replaces | Net rail change |
| --- | --- | --- |
| Invoices | nothing — restyle only (see *Withdrawn*) | 0 |
| Customers | **Debtors** (deleted, becomes the Owing lens) | −1 |
| Agents | nothing — restyle only (see *Withdrawn*) | 0 |
| Messages | **WhatsApp + Follow-ups** (merged into one screen) | −1 |

Sell goes from 7 rail rows to **6**: New quote, Order tracking, Invoices, Customers, Messages, Sales agents.
Debtors leaves Money for the Customers *Owing* lens, so Money goes 8 → 7 here and 8 → 4 once the other
Money cuts in `Rail.dc.html` land.

### Withdrawn — two cuts an earlier draft of this README instructed

**Do not delete the financial statements.** The `Statements` row is the profit and loss, balance sheet and
cash flow (its keywords are `profit loss balance sheet cash flow accounts`). The *customer* statement this
README once described as absorbed already exists as `customerStatementBlockHTML()` inside the customer's
record, built from the debt log rather than the invoices so credit sales are not counted twice. Invoices'
**Send statement** action reaches that existing block from a sale; it absorbs no row.

**There is no Commissions screen.** Commission is the agent app's, reconciled by a test. The **Supplier
bonus** block on the agent panel is worth building — it gives an admin-side figure its first home — but it
absorbs nothing and removes no row. Agents is a restyle.

## About the design files

`Invoices.dc.html`, `Customers.dc.html`, `Agents.dc.html` and `Messages.dc.html` in this bundle are
**design references written as HTML** — prototypes of the intended look, layout and copy. They are not
production code and should not be pasted into the app.

Each file is a *canvas*: it contains two or three device frames side by side (a 1440×900 desktop console
and a 390×844 phone, plus a third frame on Messages), each frame a complete recreation of the app shell
around the screen, followed by a lilac annotation card arguing that screen's cut. The frames are fixed-size
mockups — the real implementation is fluid inside the same breakpoints.

The task is to **recreate these designs in the existing Omni-Ware codebase** (`index.html`, its
`renderX()` functions and `tab-*` sections) using its established patterns — not to introduce a framework.
Where this document says "the code already does X", that refers to the real repo, and those behaviours
should be preserved rather than rebuilt.

Open a file in a browser to inspect it. `support.js` is the runtime the prototypes need to render; it has
no role in the implementation.

## Fidelity

**High fidelity.** Colours, type, spacing, radii, copy and state chips are final and specified to the
value. Recreate them pixel-accurately with the codebase's existing markup conventions. Two caveats:

- The prototypes use **plausible demo data**. Every figure is illustrative; wire each to its real source.
- The frames are **fixed 1440×900 / 390×844**. The desktop layout should fill its viewport (the rail is
  fixed-width, the content column flexes, the detail column is fixed at 390px); the phone layout is a
  separate design, not a reflow — see *Responsive behaviour*.

---

## Design tokens

### Colour

| Token | Hex | Use |
| --- | --- | --- |
| Ground | `#f6f5f2` | App background behind cards |
| Canvas ground | `#e8e7e2` | The design canvas only — not in the app |
| Surface | `#ffffff` | Cards, top bar, list bodies |
| Surface sunken | `#faf9f6` | Table headers, group rows, footers inside cards |
| Surface inset | `#f7f6f3` | Mono message boxes, small stat tiles |
| Rule | `#ecebe6` | Card borders, top-bar border |
| Rule inner | `#f0eeea` | Row dividers inside cards |
| Rule input | `#e2e0da` | Input and mono-box borders |
| Ink | `#1b2233` | Primary text |
| Ink secondary | `#535d70` | Secondary text, labels (meets 4.5:1 on all grounds above) |
| Ink tertiary | `#5f6a7d` | `.lbl` label class, inactive icons |
| Ink quiet | `#b6bdca` | Chevrons, decorative separators |
| Navy | `#17223c` | Rail, panel headers, phone header, price card |
| Navy hover | `#243354` | Dark button hover |
| Navy ink on dark | `#ffffff` / `#b9c2d6` / `#a8b2c7` | Text on navy (primary / icon / meta) |
| Coral | `#ef4b39` | **Fill and icon only, never text.** Logo tile, active tab underline, aging bars |
| Coral text-safe | `#c2311f` | Primary button, avatar fills, badge fills that carry white text (≈5.3–5.6:1) |
| Coral pressed | `#a5291a` | Primary button hover |
| Bad tint / ink | `#ffe1dc` / `#b2301f` | Overdue, unpaid, negative |
| Bad tint soft | `#fff1ec` / `#fadbd1` / `#7a4436` | Overdue KPI card fill / border / ink |
| Caution tint / ink | `#fff3d9` / `#96600f` | Part paid, over limit, behind, held |
| Caution card | `#fff8e8` / `#f4e3bd` / `#6b4a0d` | Warning block fill / border / ink |
| Good tint / ink | `#e2f5ec` / `#0f7a56` | Paid, settled, margin, send button |
| Good card | `#ecf8f2` / `#d3ebe0` / `#39544b` | Positive KPI card fill / border / ink |
| Studied tint / ink | `#eaf1ff` / `#1d5bb8` | Neutral information, "telling", biggest buyer |
| Studied card | `#d7e8ff` | Small bar charts |
| Agent tint / ink | `#e6e3ff` / `#4230a8` | Agent margin, "season starting"; bar `#8d7bd8` |
| Annotation | `#f4f1ff` / `#e3ddfb` / `#40465a` | The cut argument card (design canvas only) |
| Selected row | `#f4f1ff` | Picked row in a list |
| Link | `#1d55a8`, hover `#123c7d` | Anchors |

Neutral chip: `#f2f0ec` fill + `#535d70` ink. Empty bar track: `#f0eeea`. Dashed placeholder border: `#cdc9c0`.

**Contrast rule:** every ink clears 4.5:1 on its ground. `#ef4b39` never carries text — use `#c2311f`.

### Type

Two families, loaded from Google Fonts:

- **IBM Plex Sans** 400/500/600/700 — all prose and UI.
- **IBM Plex Mono** 400/500/600 — every figure, identifier and the message boxes.

The `.fig` class is mandatory on numbers: `font-family: 'IBM Plex Mono'; font-variant-numeric: tabular-nums;
font-weight: 600; letter-spacing: -0.02em`. Mono weight 400 is used only inside the message boxes
(`white-space: pre-wrap`, `line-height: 1.55`).

| Role | Size / weight | Notes |
| --- | --- | --- |
| Screen title | 24px / 700 | `letter-spacing: -0.02em` |
| Screen subtitle | 13px / 400 | `#535d70` |
| KPI figure | 20px / 600 mono | |
| Panel figure | 15–17px / 600 mono | |
| Card title | 13.5px / 700 | |
| Row primary | 13.5px / 600 | 13.5px / 400 for de-emphasised rows |
| Row secondary | 11px / 400 | `#535d70` |
| Row figure | 13–13.5px / 600 mono | |
| Column header (`.lbl`) | 10px / 600, `letter-spacing: 0.07em`, uppercase | |
| Section label (`.lbl`) | 10.5px / 600, `letter-spacing: 0.03em` | not uppercase |
| Chip | 11px / 600 | mono 10.5px for `.pill` |
| Rail item | 13.5px / 500 (600 when active) | |
| Rail group heading | 10.5px / 700, `letter-spacing: 0.12em`, uppercase | |
| Body / annotation | 12–13px / 400, `line-height: 1.55`, `text-wrap: pretty` | |

Minimum type size anywhere: 9.5px (tab-bar labels and the price card's eyebrow only).

### Spacing, radius, elevation

- Page padding 22px; card padding 10–14px; row padding 9px 14px; group row 8px 14px.
- Gaps: 12px between cards, 16px between columns, 6–10px inside rows.
- Radius: cards 14px, frames 18px (phone 26px), buttons/inputs 9–11px, chips 999px, thumbnails 8px, bars 2–3px.
- One elevation only: `0 1px 2px rgba(23,34,60,.05)` on cards. Frames in the canvas carry
  `0 18px 40px rgba(23,34,60,.16)` — that is canvas presentation, not app chrome.
- Fixed heights: top bar 58px, rail 236px wide, detail column 390px wide, phone tab bar 56px,
  rail item 34px, top-bar input 36px, buttons 26/28/34/36/40px, phone touch targets **44px minimum**.

### Icons

Lucide, stroke `2` (2.2 at ≤15px, 2.4–2.6 for checks and crosses), `stroke-linecap/linejoin: round`,
`fill: none`, sized 12–19px. Inline SVG in the prototypes; use the codebase's icon mechanism.

---

## The app shell (identical on all four screens)

### Desktop

```
┌──────────┬────────────────────────────────────────────────┐
│ rail     │ top bar 58px                                   │
│ 236px    ├────────────────────────────────────────────────┤
│ navy     │ title block + lens group     (padding 18/22)   │
│          │ KPI strip: 4 equal cards, gap 12               │
│          ├──────────────────────────────┬─────────────────┤
│          │ primary list card (flex:1)   │ detail 390px    │
└──────────┴──────────────────────────────┴─────────────────┘
```

- **Rail convention.** Every frame draws the **final map**, settled in `Rail.dc.html` (the authority if a frame
  disagrees): **Sell 6** (New quote, Order tracking, Invoices, Customers, Messages, Sales agents), **Buy 2**
  (Sourcing, Suppliers), **Catalogue 4** (Products, Pricing, Inventory, What goes with what), **Money 4**
  (Cash book, Statements, Payroll & rent, Assets & loans), **Insight 4** (Forecasts, Analysis, Manager, Map),
  **Setup 3** — 23 rows plus Today, down from 33 plus Today. Ten rows are absorbed, each argued in
  `Rail.dc.html`: Debtors → Customers, Creditors → Suppliers, WhatsApp + Follow-ups → Messages, Compare
  prices → Pricing, Money's Pricing + Price registry → one Pricing row, Media → Products, Consignment →
  Inventory, Sales and Purchase analytics → Analysis, Fastener guide → The shop. **Two earlier claims are
  withdrawn:** Statements is the profit and loss, balance sheet and cash flow and **keeps its row** (the
  customer statement already lives in the customer's record, built from the debt log so credit sales are not
  counted twice), and there is **no Commissions screen** — the Supplier bonus block on the agent panel is new
  work, not a merge. **Badges count obligations only:** Today, Order tracking, Invoices, Customers, Messages,
  Sourcing, Suppliers, Pricing. Not Inventory's under-floor lines or Forecasts' buy suggestions — those are
  advice, and a badge on advice teaches people to ignore badges. Several merges are **already done in the
  app** and are not this pass's work: purchase invoices → Invoices (`invSide='buys'`), Chase debts and Worth
  telling → Follow-ups, Stock movements → Inventory (`invLens='moves'`), Loans → Assets, What to buy →
  Forecasts (`fcLens='stock'`).
- **Rail** (`#17223c`, 236px, `flex: none`): 30px coral logo tile + shop name; then `Today` with a
  `#c2311f` count badge; then collapsible groups (Sell expanded, Buy / Catalogue / Money / Insight / Setup
  collapsed with a 2-letter tile, an uppercase heading, a mono count and a chevron). Items are 34px,
  radius 9px; hover `rgba(255,255,255,.07)`, active `rgba(255,255,255,.13)` + white 600. The rail is the
  complete map — nothing hidden behind a menu. Item labels truncate with ellipsis; badges never shrink.
- **Top bar** (58px, white, 1px `#ecebe6` bottom): breadcrumb (`Sell › <Screen>`, 12.5px `#535d70` + 14px
  600 ink), then a 36px search field (max 400px, `#f4f3f0`, radius 10px) whose placeholder names what can
  be searched *including a natural-language example*, with a `Ctrl K` key cap; then a spacer, then the
  screen's one secondary action or a small status chip; then a 34px `#17223c` avatar.
- **Title block**: 24px/700 title + one 13px `#535d70` line that says how the list is ordered. On the
  right, the lens group: `#efedE9` container, radius 10px, 4px padding, 32px pills; the active pill is
  white with the card shadow; each pill carries a count chip.
- **KPI strip**: four cards, `repeat(4, minmax(0,1fr))`, gap 12. Card = 10.5px label, 20px mono figure,
  11.5px sub-line that adds a second fact rather than repeating the figure. At most one card is tinted bad
  and one tinted good.
- **Content row**: `flex: 1; gap: 16`. Left card `flex: 1; min-width: 0`, internally
  `header / column header / scroll body`. Right column `width: 390px; flex: none; overflow-y: auto`, and
  **every card inside it carries `flex: none`** so the column scrolls instead of squashing the cards.

### Phone (390×844) — a separate design, not a reflow

Four stacked children, summing to 844:

1. **Navy header** (`flex: none`): title row, then a 3-up figure strip in `rgba(255,255,255,.07)` (radius 10px,
   one cell tinted when it is the bad one), then the lens row as three underlined tabs (34px, active =
   white 700 + 2px `#ef4b39` bottom border).
2. **Scroll body** (`flex: 1; min-height: 0`, white): the list as grouped rows.
3. Optional **action footer** (`flex: none`, `#faf9f6`): the primary action at 44–48px.
4. **Tab bar** (`flex: none`, 56px, white, 1px top rule) — **fixed membership, identical on every screen**,
   read from `MMS_BAR_TABS` / `<nav class="mobile-bottomnav">`: **Today** → `dashboard`, **Sell** →
   `quote` (the act, not the archive), **Money** → `cashbook`, **Manager** → `manager`, **More**. Never
   swap a slot for the screen on display. The lit slot is the open screen when it is one of the five, and
   **More** on every other screen — which is the case for all four screens in this bundle. The lit item's
   icon sits in a 38×22 `#ffe1dc` pill with a `#c2311f` 9.5px/700 label (in the app, a filled icon variant
   swaps in — a colour change alone is a poor active state at arm's length). Today carries a 7px `#c2311f`
   dot when something is waiting, read off the count Today already rendered rather than reckoned again.
   **Every phone frame keeps this bar, including drill-ins.**

Phone rows are 2-line grids (`minmax(0,1fr) auto`, `column-gap: 10px`, `row-gap: 2–3px`) with the name and
figure on line 1 and the identifiers and age on line 2; `min-height: 44px`. Never a horizontal scroller.

### Shared patterns

- **Grouped lists.** Rows are grouped by the state that decides attention, each group preceded by a
  `.grow` header: `#faf9f6`, rules top and bottom, a state chip, a bold count, and the group's own
  subtotal on the right. **A group subtotal must equal the rows beneath it**; if a headline figure means
  something narrower, label it (`8,900,000 riding on them · 6,900,000 of it overdue`).
- **Settled rows** are dimmed (`opacity: .62–.7`) rather than hidden.
- **Overflow rows** collapse the tail of a group into one row ("five more about money", "+9 agents") with
  its own subtotal.
- **Row selection** paints `#f4f1ff` and drives the detail column. Hover `#faf9f6`.
- **Truncation.** Every text cell is `min-width: 0` + `overflow: hidden; text-overflow: ellipsis;
  white-space: nowrap`; figures are `white-space: nowrap` and never truncate.
- **Detail column rhythm.** Navy header (identity + state) → figures → evidence → actions. The primary
  action is `#c2311f` (or `#0f7a56` for a WhatsApp hand-off); secondary is white with a `#dcdad4` border.

---

## Screen 1 — Invoices

**Purpose.** Read what was billed and what was bought to fill it, in the order the money needs attention.
**Kept decision:** a sale and the purchase invoices raised against it are one piece of money and share one
register.

### Desktop

- Top bar: search placeholder `Invoice no., customer, supplier or amount`; right side carries three
  order-stage chips — `12 quoted` (studied), `5 packing` (caution), `3 out` (good).
- Lenses: **Needs attention 18** (default) · All 159 · Voided 3.
- KPIs: Overdue `6,900,000` (bad tint, "4 invoices · oldest 74 days") · Open, not yet due `16,750,000`
  ("14 invoices · 23,650,000 owed in all") · You owe on bills `11,200,000` ("9 bills · 3,400,000 due this
  week") · Settled this month `31,480,000` (good tint, "38 invoices · 4.2 days to settle on average").
- List card header: "Money in and money out", then a legend — `bought for it:` followed by a green `paid`
  pill and an amber `owed` pill.
- Grid: `58px minmax(190px,1fr) 108px 112px 76px`, `column-gap: 10px`.
  Columns: Date (mono 11.5/500) · Customer · bought for it · Invoiced · Still due · State.
- Row line 2 holds the purchase-invoice pills: `.pill` mono 10.5px, green `PINV-0099` when paid, amber
  `PINV-0098 · 95,000` when still owed, strikethrough neutral when voided.
- Groups: Overdue 4 (`6,900,000 · oldest 74 days`) → Open 14 (`16,750,000 · nothing overdue`) →
  Settled 14 Sept (`6 invoices · 2,900,000 collected`, rows dimmed).
- Detail panel: navy header with mono `INV-0175`, an `Overdue 74 days` chip, a print icon, the customer and
  `raised 3 Jul · due 2 Aug`; then Invoiced / Paid / Still due as three columns; then the line items
  (`.drow`, 12.5px, figure right); then a `#faf9f6` block **Bought to fill it** listing each `PINV` with
  supplier, quantity and cost, closing with **You kept** `1,215,000` and a `50%` chip; then actions —
  `Draft the chase` (coral, WhatsApp icon), `Record a payment`, overflow.
- Below it: **This customer's account** (owes in all / bought 2 years, plus one sentence of payment
  history, and a `Send statement` link) — this reaches the existing customer-statement block from a sale. Then **The record**: three
  timestamped lines (raised from quote, goods checked in, fell due + chases since).

### Phone

Header figure strip = Overdue 6.9M (tinted) / Open 16.75M / You owe 11.2M; tabs Needs you 18 / All 159 /
Voided 3. Rows carry the customer, the still-due figure in bad ink, the `INV` number with its `PINV` pills,
and the age. The picked invoice appears as a card at the end of the list on a `#f6f5f2` inset: navy header,
three figures (Invoiced / Still due / You kept %), then two 44px actions.


---

## Screen 2 — Customers

**Purpose.** One list of the people who buy from you, ranked by what they owe and how long they have owed
it. Chasing is a lens on that list, not a second screen.

### Desktop

- Search placeholder: `Name, phone, or "owes over 1m"`. Secondary action: `New customer`.
- Lenses: **Owing 11** (default when the rail badge is non-zero) · All 142 · Best 20 · Gone quiet 7.
- KPIs: **Owed to you** `23,650,000` (bad tint) with a 4-segment aging bar
  (`#c2311f` 29% / `#ef4b39` 23% / `#f6a68c` 19% / `#e4c9bf` 29%) labelled `74d · 49d · 30d · under 30d` ·
  **Ask these three first** `8,380,000` ("35% of the debt sits with 3 of 142") · **Credit out beyond limit**
  `2 accounts` (caution ink, naming both) · **Pay without chasing** `86` (good tint, "settle inside 7 days,
  every time").
- List card header: "Who to ask first — oldest money, largest first", with a Sort button.
- Grid: `30px minmax(180px,1fr) 104px 88px 132px 66px`.
  Columns: avatar · Customer · Owes · Oldest · How they pay · Ask.
- **Avatar** `.av`: 30px circle, 11px/700 initials, tint+deep-ink pair matching the row's state
  (`#ffe1dc/#b2301f`, `#fff3d9/#96600f`, `#eaf1ff/#1d5bb8`, `#f2f0ec/#535d70`). On navy headers use
  `#c2311f` + white.
- **How they pay** is a 3-segment 6px bar (`#0f7a56` on time / `#f0b323` late / `#c2311f` very late) with a
  10.5px caption ("late on 4 of 10", "pays in pieces", "no history yet" over a flat `#dedbd4` bar).
- **Ask** ranks the chase: `1st` is `#c2311f` + white, `2nd` bad tint, `3rd`/`4th` neutral, `—` when not owing.
- Groups: Past due 4 (`9,020,000`) → Owing, still in time 7 (`14,630,000`) → Gone quiet 7 ("bought 9.1m
  before, nothing in 90 days", rows at `opacity: .7`).
- Detail panel: navy header (32px avatar, name, "customer since …", phone and area chips); Owes now /
  Credit limit / Bought 2 yrs; then a caution card when over limit — **"1,330,000 over the limit. New credit
  sales are blocked for this account until it comes under 2,000,000."**; then **What the debt is made of**
  (each invoice, its age, its balance) closing with **Ledger agrees with the balance · checked** — the
  `customerDebtDrift` check, surfaced; then actions: `Draft the chase` (coral), `Send statement`,
  `Record a payment`.
- Then **What they buy, and what it earns**: You kept 12 months `1,910,000` / 18% margin against a 24% shop
  average, three product rows (share of spend + margin), and the reading: *cement is 62% of what they take
  and the thinnest thing you sell; a 3% rise on cement alone would put this account at the shop average.*
- Then **Last five months**: five bars, the two most recent flat `#f0eeea`, with the reading: *they stopped
  buying when the July invoice fell due — the debt is the reason for the quiet, not a coincidence.*

### Phone

Header: one `Owed to you 23,650,000` block with the aging bar (last segment `rgba(255,255,255,.22)` on navy)
and the line "9.02m of it past due · 35% sits with three accounts"; tabs Owing / All / Quiet. Rows: avatar,
name, `over limit` / `5 chases` pill + age, the owed figure, the pay-history caption, and a 36px green
WhatsApp square for the three to ask first. Picked customer as a card: Owes / Limit / Margin, then
`Draft the chase` + `Statement` at 44px.

### The cut: Debtors

`renderCustomers()` and `renderDebtorsList()` must be called together after every void or payment; when one
is missed the two screens disagree about the same debt. A debtor is a customer with a balance — one list,
two renderers, and a synchronisation bug waiting.

- **Lost:** nothing. Debtors ranked by amount alone; the Owing lens ranks by age then amount (the order a
  shop actually asks in) and keeps the aging bar at the top.
- **Absorbed by:** the **Owing** lens, on by default when the badge is non-zero; the drift check moves onto
  the customer panel where it can be seen.
- **Search:** `debtors`, `who owes me`, `aging`, `receivables`, `credit` → Customers;
  `resolveTab('debtors')` opens it with the Owing lens armed.

---

## Screen 3 — Agents

**Purpose.** An agent order line carries four prices — `price` (your supplier cost), `sellPrice` (what the
shop is owed), `agentSellPrice` (what the agent charges their client) and `bonusCommission` (supplier-funded,
snapshotted at submit). One row therefore holds three different profits. The screen shows all three and what
the agent actually owes you.

**The identity the code guarantees:** `client pays − shop is owed = the agent's margin`. Never mix the two
totals; never charge an agent their client price.

### Desktop

- Search placeholder: `Agent, order no., or "owes the shop"`. Secondary action: `Invite an agent`.
- Lenses: **This month** · Last month · Year.
- KPIs: Sold through agents `18,420,000` ("63 orders · 31% of everything you sold") · **You kept**
  `2,310,000` (good tint, "12.5% · shop counter runs 24%") · They kept `4,680,000` ("their own margin, not
  your cost") · **Owed to the shop** `1,940,000` (caution card, "2 agents behind · at the shop price, not
  theirs").
- List header carries the standing clarification chip: *margin is yours · commission is theirs*.
- Grid: `30px minmax(160px,1fr) 100px 92px 92px 104px 58px`.
  Columns: avatar · Agent · Shop billed · You kept · They kept · Owes you · Terms.
  `They kept` goes bad-ink negative when an agent sells under your price (`−24,000`), flagged on the row as
  `sells under your price`. Terms is a `prepay` (good) or `credit` (neutral) pill.
- Groups: Behind on settlement 2 (`1,940,000 owed`) → Settled up 12 ("prepay or paid on delivery").
- Detail panel — **the waterfall** is the centrepiece. Five rows, `76px minmax(0,1fr) 92px`, 9px bars, all on
  **one denominator: client paid = 100%**:

  | Row | Bar | Colour | Figure |
  | --- | --- | --- | --- |
  | Your cost | `width: 70%` | `#dedbd4` | 4,928,000 |
  | You kept | `width: 10.1%; margin-left: 70%` | `#0f7a56` | 712,000 |
  | Shop billed | `width: 80%` | `#17223c` | 5,640,000 |
  | They kept | `width: 20%; margin-left: 80%` | `#8d7bd8` | 1,410,000 |
  | Client paid | `width: 100%` | `#4230a8` | 7,050,000 |

  Increments are offset so each starts where its base ends. **Never draw different totals at the same
  length** — compute every width from the client-paid total.
- Then the caution block: **Owes the shop 1,420,000** — "At your price on 6 delivered orders, not the
  1,775,000 their clients paid. Their margin is not yours to collect." Actions: `Record a settlement`
  (coral), `Hold new orders`.
- Then **Supplier bonus, July**: Shown as earned `148,000` / Claimable `148,000` / Not yet counted `36,000`,
  with a `screen agrees with payout` check chip, and the rule in words: *a bonus counts once the order is
  completed, and it is the supplier's money, never yours.* This surfaces a figure that has no admin-side home today; it absorbs no screen.
- Then **Which lines they sell** (share of orders + margin per line) with the lever: *their round is mostly
  cement, which is why your 12.6% here sits under the counter's 24% — selling them fittings would move it
  more than raising cement would.* Then **Orders through them**: five bars, the current month in `#1d5bb8`,
  with: *selling more every month while settling slower each time.*

### Phone

Header strip: SOLD 18.42M / YOU KEPT 12.5% / OWED YOU 1.94M (last cell tinted `rgba(240,179,35,.16)` with
`#f6dfab` label); tabs Month / Last / Year. Rows are 2-line grids with the avatar spanning both rows
(`grid-row: span 2`). Picked agent card carries the same waterfall at `62px minmax(0,1fr) 84px`, minus the
Shop billed row, then the owed strip and two 44px actions.


---

## Screen 4 — Messages (WhatsApp + Follow-ups merged)

**Purpose.** Every word the shop owes someone, and the box it is written in. Three lenses: **Money**,
**Telling**, **Posting**.

**The constraint that shapes everything:** the app **cannot see WhatsApp**. Sending opens a deep link with
whatever is in the box, so the box — not a template — is the truth, and afterwards the owner stamps
*it was sent* / *it was not*. Nothing is recorded until they do. Do not fake a delivery state, do not
disable the draft, and do not send the app's version instead of the edited one.

### Money and Telling lenses (frames 1a / 1b)

- Search placeholder: `Name, number, or what the message is about`. Secondary action: `Broadcast`.
- Lenses: **To send 13** · Waiting on a reply 21 · Sent 184.
- KPIs: About money `9` (bad tint, "8,900,000 riding on them · 6,900,000 of it overdue") · Telling someone
  something `4` ("3 stock offers · 1 delivery promise") · **Chases that got paid** `31%` (good tint, "57 of
  184 sent · 4.2 days to the money") · **Best hour to send** `9–11am` ("replies twice as likely as
  afternoons").
- Grid: `30px minmax(160px,1fr) 96px 96px 74px`.
  Columns: avatar · Who, and what about · At stake · Last word · State.
  *Last word* names who spoke last and when (`you, 2 Sep` / `them, 28 Aug` / `never`) — the single most
  useful column on the screen. State is `draft` (bad tint), `due`, or `sent` (good).
- Groups: **Money** 9 to write (`8,900,000`) → **Telling them something** 4 to write ("no money at stake")
  → **Waiting on a reply** 21 sent ("oldest 11 days", dimmed).
- Detail panel: navy header (avatar, name, number, what it is about, an `Nth chase` chip); then
  **What will be sent** with the hint *edit it — the box is what ships*; then the **mono box**
  (`#f7f6f3`, 1px `#e2e0da`, radius 11px, mono 400 12px/1.55, `white-space: pre-wrap`) containing the real
  message — greeting, the invoice's lines as a **14-character-wide mono table**, the due total, the ask for a
  date, and the shop's sign-off; then `14 chars wide` / `fits a phone` pills and `Shorter` / `Firmer` tone
  buttons.
- Footer: a full-width **`Open WhatsApp with this`** button in `#0f7a56`, then the stamp card — an
  eye-off icon, the sentence *"The app cannot see WhatsApp. When you come back, say whether it went —
  nothing is recorded until you do."*, and two buttons, `It was sent` (green check) / `It was not` (red cross).
- Then **What happened the last five times**: dated attempts with `silent` / `promised` pills, and the
  judgement in words: *two promises and then silence — messages have stopped working on this account; a call
  or a visit is the next lever, and the screen will not pretend otherwise.*
- Then **What gets answered**, from 184 sent messages: with the lines itemised **38%**, just the amount
  **19%**, asking for a date **44%** — *both are in the draft above.*

Phone (1b): navy header with a back chevron, avatar, name, `INV-0175 · 74 days · 6th chase`, a `1 of 13`
chip and an `AT STAKE` strip; body = the mono box at 11.5px (re-wrapped to 34 columns) + tone buttons + the
last-five history; footer = a 48px green send button, the one-line honesty note, and two 44px stamp squares;
then the tab bar.

### Posting lens (frame 1c) — the daily post

Per-product, driven by a recommendation over signals. **Not a scheduled item and not its own screen** — it is
the third lens, because the composer, the hand-off and the stamp already live here. A post is a message with a
product attached instead of an invoice.

- Breadcrumb `Sell › Messages › Posting`; the top bar's right side carries a `sends 9–11am` chip.
- Title: *What to post today* — "14 products nominated · ranked by the signal, capped at three a day · you
  pick, the rest roll over".
- KPIs: **Picked for today** — three 26×8 pips (filled `#0f7a56`, empty `#e2e0da`) + `2 of 3`, "one slot left ·
  12 roll to tomorrow" · **Sold after a post** `4,180,000` (good tint, "22 posts · within 3 days of the
  stamp") · **Signal that sells best** `Price cut` ("6 of 7 moved · idle stock, 2 of 8") · **Held back** `31`
  ("too little stock to fill an order").
- Grid: `26px 38px minmax(150px,1fr) 118px 78px 76px 64px`.
  Columns: rank · 38px thumbnail (radius 8px; Lucide glyph on a tint when there is no photo) · Product +
  the evidence in words · **Why it is here** · Cover · You keep · Pick.
- **Signals** (the sort key and the headline): `price cut` (good) · `idle stock` (caution) ·
  `goes together` (studied) · `season starting` (agent tint) · `margin 38%` (good). Each row's second line
  states the evidence — *"Kampala Steel dropped to 27,500 · 8% under August"*, *"bought with iron sheets on
  18 of last 21 orders"*, *"rains start late Sep · sold 3× as much last October"*.
- **The stock gate is a rule, not a filter.** A `Held back` group lists products that cannot be filled:
  *"Cement 50kg · 3 days of cover · posting it would sell what you cannot deliver"*, row at `opacity: .6`,
  `low stock` chip, Pick replaced by the word `held`.
- Picked rows paint `#f4f1ff` (first) / `#f7f6f3` (subsequent) and swap the Pick button for a `picked` chip
  (`#0f7a56` + white).
- Composer: navy header (product, `post 1 of 2 picked · price cut`, a `no photo` chip); then
  **What will be posted** — the **price card**, which is the no-photo fallback and is built from the product
  record alone:

  > navy `#17223c` block, radius 11px inside a `#e2e0da` border · 10px/700 eyebrow `#a8b2c7` with the shop
  > name, `letter-spacing: .14em`, uppercase · 19px/700 white product name · 12px `#b9c2d6` spec line
  > (gauge · length · unit) · 26px mono new price beside the old one struck through in `#a8b2c7` ·
  > a `#c2311f` cover chip (`21 days of stock`) and the shop's phone and area

  Below it a `#f7f6f3` strip: *"No photo on this product — a price card is used instead"* + `Add one`.
  When a photo exists it replaces the card and the caption is unchanged.
- Then the mono caption box (was / now prices, quantity on hand, where to collect, sign-off) and
  `Shorter` / `Add a photo` / `Swap product`.
- Footer: the same green `Open WhatsApp with this` and the same two stamps, with the reason restated:
  *"The app cannot see what you post. Stamping it is what lets the next three days of sales be read against
  it."* — `It was posted` / `It was not`.
- Then **Which signals actually sell** — price cut 6 of 7, goes together 4 of 6, season starting 1 of 2,
  idle stock 2 of 8, over 22 stamped posts in 90 days, with the consequence: *idle stock almost never moves
  on a post alone — those need the three past buyers told directly.* **This panel is the reason the stamp is
  worth the friction.**
- Then **Today's picks** — the three slots, the third an empty dashed square, and the cap in words:
  *three a day is the cap, set in Setup; more than that and the posts start competing with each other.*

Phone (1c): navy header with the count and a `9–11am` chip, the three lens tabs with Posting active; body =
the price card, a `price cut · 6 of 7 such posts sold` chip, the mono caption, `Shorter` / `Swap product`,
then **Next in the queue** on a `#faf9f6` inset (each row 44px, `picked` chip or a 36px `Pick` button,
`rolls over` for the rest) and the held-back line; footer = 48px green send + two 44px stamps; then the tab bar.

### The cut: WhatsApp + Follow-ups → Messages

Follow-ups is the list of people you owe a word, already tagged with a reason (`fupWhy`); WhatsApp is the box.
Neither is usable alone — the list's only action is to open the box, and the box's only content comes from the
list. The nav index already records the resulting confusion: the obvious search for Follow-ups is "broadcast",
which belongs to WhatsApp.

- **Lost:** nothing. Broadcast becomes the top-bar button (a post sent once to a picked list); a template is
  what the box is pre-filled with.
- **Absorbed by:** one screen, one rail row, one badge — `navBadgeFollowUps` already counts the whole thing.
- **Search:** `whatsapp`, `broadcast`, `chase`, `remind`, `follow up`, `message` all land on Messages; the
  existing aliases `'chase' → fupWhy money` and `'telling' → fupWhy telling` become the group they scroll to.
- **Badge rule (deliberate):** the badge counts words you owe a person (9 + 4 = 13) and **excludes the 14
  nominations**. A nomination is the algorithm's suggestion, not an obligation; a badge that rises because the
  queue grew trains people to ignore it. The Posting lens carries its own count.

Where the daily post appears elsewhere: **Today** shows one row while the day's post is unstamped, deep-linking
into the composer. **Setup** holds the cap (3) and the send window (9–11am). No new rail row.

---

## Interactions & behaviour

- **Lens switch** re-sorts and re-groups the same list in place; it never navigates. The lens belongs in the
  URL/tab state so `resolveTab()` aliases can arm one directly (`debtors` → Customers/Owing,
  `chase`/`telling` → Messages groups). Note there is no `statements` or `commissions` alias to add:
  Statements keeps its own row, and no Commissions screen ever existed.
- **Row click** selects and fills the detail column; selection survives a lens switch when the row is still
  present. No modal for reading — modals only for destructive confirmation.
- **Detail column** is independently scrollable; its cards never compress (`flex: none`).
- **WhatsApp hand-off**: build the message from the box's *current* contents → open the deep link → on return,
  show the stamp prompt. `It was sent` records the attempt, advances the chase count and moves the row to
  *Waiting on a reply*; `It was not` leaves the row exactly as it was. Until stamped, nothing is recorded.
- **Posting**: `Pick` adds to today's slots up to the cap (3) and the Pick control becomes a `picked` chip;
  unpicked rows roll to tomorrow without losing their rank. Held-back products cannot be picked at all.
  After a post is stamped, attribute sales of that product within 3 days to it and feed the
  *Which signals actually sell* panel.
- **Blocked credit**: when a customer is over their limit, new credit sales are refused at the point of sale
  and the panel says so with the figure that would clear it. This is a rule, not a warning to dismiss.
- **Voiding** must re-sync the customer's debt and re-render both the register and the customer list (the
  merge removes the second renderer, so this becomes one call).
- Hover states as tokenised above; `:focus-visible` gets a 2px accent outline at 2px offset. No animation
  beyond 120–160ms colour/background transitions.

## State

Per screen: the active lens, the selected row id, and the scroll position of each column. Messages adds the
draft body per recipient (dirty until sent or discarded), the pending-stamp flag, today's picked product ids,
and the queue's roll-over date. Derived — never stored twice — are the group subtotals, the aging buckets, the
per-customer and per-agent margin, the waterfall widths, the reply-rate and signal-to-sale rates, and the
`Ask` rank. Everything derived must be computed from the rows on screen so a subtotal can never disagree with
its rows.

## Assets

No images. All icons are Lucide, inline. Fonts from Google Fonts (IBM Plex Sans, IBM Plex Mono). Product
thumbnails in the Posting lens are 38px tinted squares with a Lucide glyph when a product has no photo — the
price card is the designed fallback, so imagery is never required.

## Files

| File | Contents |
| --- | --- |
| `Invoices.dc.html` | 1a desktop, 1b phone, restyle; Send statement reaches the existing block |
| `Customers.dc.html` | 1a desktop, 1b phone, cut argument (Debtors) |
| `Agents.dc.html` | 1a desktop, 1b phone, restyle; Supplier bonus block is new work |
| `Messages.dc.html` | 1a desktop, 1b phone, 1c Posting lens (desktop + phone), cut argument (the merge) |
| `support.js` | Prototype runtime only — not part of the implementation |

Prior handoffs in the same system: `design_handoff_dashboard_today/` (Today, and the token README this one
restates) and `design_handoff_quote_page/` (Quote, including the Saved-quotes merge).

## Suggested order of work

1. The shell — rail groups, top bar, lens group, KPI strip, the phone tab bar — shared by all four screens.
2. Invoices (the register and the purchase-invoice pills are reused by everything downstream).
3. Customers, deleting Debtors and folding its aliases in.
4. Agents, with the four-price waterfall and the settlement rule.
5. Messages: merge WhatsApp and Follow-ups first, then add the Posting lens once the stamp exists — the
   attribution loop depends on it.
