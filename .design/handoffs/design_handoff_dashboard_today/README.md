# Handoff: Today (admin dashboard) — redesign

## Overview

`Today` is the front door of the Omni-Ware admin app (`index.html`, tab id `dashboard`) — the
screen the shop owner opens each morning. The redesign does three things the current screen does
not:

1. **One ranked list instead of two.** Today currently draws the Manager's moves
   (`#dash_mgrQueue`) and the app's own watch (`#dash_actionList`) as two lists ranked two
   different ways, so the front door has to be read twice. The redesign keeps them in the same
   reading order and the same visual family — numbered moves first (`01`, `02`, `03`, in
   `mgrMoveOrder`'s order), then the watch beneath as denser rows — while keeping them in
   **separate containers** so the watch can never be sorted into the moves (see
   `test/today-queue.test.js`).
2. **A money strip that states a position**, not five unrelated figures. Each figure carries its
   basis on the line below it (cash → months of cover, debt → aging split, margin → the profit and
   revenue it came from).
3. **Every alert carries its arithmetic.** Each watch row names both ends of the comparison
   ("10,000 on 1 May, 13,000 now · across 9 invoices") so it can be checked rather than believed.

An insight rail on the right adds three derivations the screen did not have: gross margin by
product, sold-by-week seasonality, and yesterday's four money movements.

## About the design files

The files in this bundle are **design references created in HTML** — prototypes showing intended
look, content and behaviour. They are **not production code to copy**.

The target codebase is a single-file vanilla-JS app (`index.html` with an inline `<script>`,
`shared-worker.js`, no build step) governed by `.claude/skills/ow-design/SKILL.md`. The task is to
**recreate this design inside that environment**, using its own patterns:

- Markup rendered by the existing render functions (`renderDashboard`, `renderTodayPlan`,
  `mgrQueueRowHTML`, `dashAlerts`) writing into the existing section `#tab-dashboard`.
- Styling added as new `.ow-*` classes in the OW layer, obeying the three laws in SKILL.md §6:
  no existing declaration rewritten to use a token, no element selectors and nothing on `body`,
  and — **note the conflict below** — no new colour.
- Figures through the money component (IBM Plex Mono, `font-variant-numeric: tabular-nums`,
  `letter-spacing:-.02em`, right-aligned in tables, never truncated).

**One decision needs the owner's sign-off before implementation.** SKILL.md §2 fixes the palette at
23 values (navy/oxide/verdigris/amber/crimson) and says never introduce a 24th. This redesign was
made at the owner's explicit instruction to drop that palette in favour of a card idiom with a
tinted colour per kind of money. Implementing it therefore means **replacing the colour section of
SKILL.md**, not sneaking colours past it. Either:

- **(a)** adopt the palette below as the new §2 and update `test/design-system.test.js`'s palette
  ratchet in the same commit, with the contrast table as the justification; or
- **(b)** keep the existing 23 values and re-map: navy chrome stays, oxide becomes the single
  accent, and the tints come from `--ow-oxide-soft` / `--ow-verdigris-soft` / `--ow-amber-soft` /
  `--ow-crimson-soft`, which already exist. The layout, hierarchy and copy in this design work
  unchanged under (b); only the five card tints and the violet "Manager" mark change.

Do not ship a mixture of the two.

## Fidelity

**High-fidelity.** Colours, type sizes, weights, radii, spacing and copy are final and measured.
Recreate pixel-for-pixel at 1440×900 (desktop) and 390×844 (phone), then let both reflow per the
two-designs law.

## Screens / views

The design file contains one screen drawn twice. Per SKILL.md §1, **820px is a switch between two
designs, not a reflow of one** — build them as two markup paths from one data call, the way
`.ow-q` already emits `ow-q-r` (desktop row) and `ow-q-card` (phone card) from a single function.

### 1. Today — desktop console (`#2a` in the design file, 1440×900)

**Purpose.** Read what needs doing, and start the first thing, without leaving the screen.

**Layout.** Two columns at the top level: a 236px fixed navigation rail and the work area.
The work area is a 58px top bar, then a scrolling body with 20px 22px 24px padding. Inside the
body: page header row, a five-up metric grid, then a two-column split — work column (`flex:1`,
`min-width:0`) and a 326px insight rail, 16px gap, both top-aligned.

#### 1.1 Navigation rail (236px, `#17223c`)

- Brand row: 16px 14px 10px padding; 30px × 30px `#ef4b39` square, radius 9px, white
  house/warehouse Lucide glyph at 17px; beside it the app name (14.5px/700, `#fff`,
  `letter-spacing:-0.01em`) over the shop name (11px, `#a8b2c7`, truncating).
- Scrolling list: 6px 10px 14px padding. Every row is 34px tall, radius 9px, 10px gap,
  13.5px/500 `#b9c2d6`, icon 17px at Lucide stroke-width 2. Hover `rgba(255,255,255,.07)` +
  `#fff`. Active row `rgba(255,255,255,.13)`, 600 weight, `#fff`.
- Section headings carry a 20px × 20px rounded chip (radius 6px) with the section's two-letter
  abbreviation at 9.5px/700, then the section name at 10.5px/700, `letter-spacing:0.12em`,
  uppercase, `#7d89a5`. The six sections and their chips:

  | Section | Chip fill | Chip ink | Destinations (rail order) |
  | --- | --- | --- | --- |
  | (none) | — | — | Today |
  | Sell | `#ffe3d6` | `#8f3009` | Quote · Saved quotes · Invoices · Customers · Agents · WhatsApp · Follow-ups |
  | Buy | `#e6e3ff` | `#4230a8` | Compare prices · Sourcing · Suppliers |
  | Catalogue | `#d9f2e6` | `#0b5e42` | Products · Prices · Inventory · Media |
  | Money | `#d7e8ff` | `#164a96` | Cash book · Debtors · Creditors · Statements |
  | Insight | `#ffdfe9` | `#8a2450` | Sales analytics · Map · Forecasts |

  The design file shows the rail abridged to fit one screenshot. **The real rail is the complete
  map** — every destination in `test/admin-nav.test.js`'s `EVERY_TAB`, including Fasteners, Payroll
  & rent, Assets & loans, Purchase analytics, Staff, Worker view and The shop. Nothing may go
  behind a hover or a click; sections may fold, and a folded section must still show its count
  (`data-n`) and the row you are on.
- Counts: quiet counts (Saved quotes 8, Invoices 20) are Plex Mono 11px/600 `#a8b2c7`. Counts that
  mean "something wants you" are pill chips, 19px tall, radius 999px, 11px/600 — Follow-ups and
  Debtors `#ffe1dc`/`#b2301f`, Inventory `#ffeccd`/`#96600f`, Today `#c2311f` on white text.
  Keep `setNavBadge`'s rule: a badge is drawn only when its number is > 0.
- Foot: sits **outside** the scroll box, `flex-shrink:0`, separated by a
  `1px solid rgba(255,255,255,.09)` rule; holds Sign out.

#### 1.2 Top bar (58px, white, `1px solid #ecebe6` bottom)

Left to right, 16px gap, 0 22px padding: breadcrumb ("Start" 12.5px `#5f6a7d` → chevron `#b6bdca`
→ "Today" 14px/600); search field (`flex:1`, max 400px, 36px tall, radius 10px, `#f4f3f0` on
`#ecebe6`, 15px search glyph, 13px placeholder `#5f6a7d`, and a `Ctrl K` key cap — 10.5px/600,
white, `1px solid #e2e0da`, radius 6px); spacer; three order-stage chips (22px, radius 999px,
11px/600, figure in Plex Mono 12px) — quoted `#eaf1ff`/`#1d5bb8`, packing `#fff3d9`/`#96600f`,
out `#e2f5ec`/`#0f7a56`; a 34px round `#17223c` avatar with white 12px/700 initials.

The chips replace the current `.order-status-bar`. Keep its behaviour: the **labels** give way
first below 1400px, the counts are never dropped, and each count carries
`title="${name}: ${count}"`.

#### 1.3 Page header

"Good morning, Kevin" at 24px/700, `letter-spacing:-0.02em`, with a 13px `#5f6a7d` sub:
"Monday 15 September · read at 07:42 · eight things want you today". The reading time is never
folded (SKILL.md §5). Actions right: **New quote** (secondary, 38px, radius 9px, white on
`#dcdad4`, 13.5px/600, plus glyph) and **Work the list** (primary, 38px, `#ef4b39`, white,
check glyph). The primary is the only accent-filled control on the screen.

#### 1.4 Metric strip — five cards, 12px gap, radius 14px, 13px 14px padding

Each card: a 26px rounded icon chip (radius 8px) beside an 11px/600 label `#5f6a7d`; the figure at
Plex Mono 22px/600 `#17223c`; an 11.5px `#5f6a7d` basis line.

| Card | Fill | Border | Icon chip | Figure | Basis |
| --- | --- | --- | --- | --- | --- |
| Cash on hand | `#eef4ff` | `#dce8fb` | `#d7e6ff` / `#1d5bb8` | 8,420,000 | 2 accounts · 2.4 months of cover |
| Owed to you | `#fff1ec` | `#fadbd1` | `#ffdfd5` / `#b2301f` | 23,650,000 | 9 customers · **6,900,000 over 60 days** (`#b2301f`, 600) |
| You owe | `#fff` | `#ecebe6` | `#f0eeea` / `#5f6a7d` | 11,200,000 | 4 suppliers · 3,400,000 due this week |
| Margin · 7 days | `#ecf8f2` | `#d3ebe0` | `#cfeadd` / `#0f7a56` | 18.6% + `−1.4 pts` chip | 4,380,000 profit on 23,500,000 sold |
| Stock on the shelf | `#f4f1ff` | `#e3ddfb` | `#e5dffd` / `#5b46d6` | 41,300,000 | 3,100,000 unsold past 120 days |

The debt card carries an aging bar under the figure: 6px tall, radius 999px, 2px gaps, three
segments — 0–30 days `#c7d3e8` 42%, 31–60 `#f0a98f` 29%, 60+ `#ef4b39` 29%. Widths come from the
real aging split.

Runway must keep using the corrected `dashMonthlyBurn` (divided by the history that exists, not by
an assumed 90 days) — `test/dashboard-numbers.test.js` pins this.

#### 1.5 The moves — three cards

White, radius 14px, `1px solid #ecebe6`, `0 1px 2px rgba(23,34,60,.05)`, 16px padding, and a
**3px left border**: `#5b46d6` when the move is actionable now, `#c7c3de` when it waits on another
move. Header row: a "Manager" chip (`#ece8ff` / `#5b46d6`, message glyph) — the marker
`mgrQueueRowHTML` already emits as `.ow-cp.ow-mg` — then the position in Plex Mono 11.5px
(`01 of 08`), an optional "waits on 01" chip (`#f2f0ec` / `#5f6a7d`) for a declared `after`
dependency, then right-aligned worth: 10.5px/600 label over a Plex Mono 18px figure. Money that is
a gain is `#0f7a56` and signed (`+1,180,000`); money tied up or at risk is plain ink.

Title 16.5px/600, `line-height:1.35`. Reasoning 13px `#5f6a7d`, `max-width:74ch`, `text-wrap:pretty`.
Actions 36px, 9px gap: the screen's one live action per move, a secondary door, then a right-aligned
ghost "How this was worked out" (`#5f6a7d`, chevron) that folds the derivation — never permanently
in the way. A move already done shows a `Done` chip and stops offering to be done again.

The three moves as drawn (demo data):

1. *Ask Mulongo Hardware for a deposit before the next delivery* — tied up 3,330,000, 44 days;
   "Five chases since 2 August produced nothing, and they have taken two deliveries on credit
   since." Actions: **Draft the chase** (primary, WhatsApp glyph) · Open Mulongo.
2. *Raise iron sheets G28 by 4% — you are still selling at May's cost* — margin a month
   +1,180,000; "Kampala Steel billed 13,000 a sheet on 20 July against 10,000 on 1 May. The shelf
   price has not moved since April." Action: **Open prices** (dark `#17223c`).
3. *Order 40 boxes of G28 before Friday* — waits on 01, sales at risk 7,400,000; "Six days of
   cover at the last four weeks' rate. The order needs 9,600,000 against 8,420,000 held — the
   Mulongo deposit covers the gap." Action: Open forecasts.

Copy law: a control says what will happen ("Draft the chase", never "Submit"), and nothing sends
itself — every send is an owner tap.

#### 1.6 The watch — one card, five rows

Card padding 6px 8px 8px; header "What the books flagged" 14.5px/700 with a 12px `#5f6a7d` note
("arithmetic, not advice · five of five shown"). Rows: 12px 14px padding, radius 11px, 13px gap,
hover `#faf9f6`; a 32px rounded icon chip (radius 9px) tinted by severity — bad `#ffe1dc`/`#b2301f`,
caution `#fff3d9`/`#96600f`, neutral-informational `#eaf1ff`/`#1d5bb8` or `#f0eeea`/`#5f6a7d`; a
13.5px/600 first line and an 11.5px `#5f6a7d` second line carrying the arithmetic; a right-aligned
figure (Plex Mono 15px) or a chip when the figure is a judgement ("5,780,000 short", "−8 pts"); a
16px `#b6bdca` chevron.

The five rows: oldest debt (Nakawa Traders, 74 days, 2,410,000) · stock running out
(7 lines in 10 days, 14,200,000 to refill against 8,420,000 held, 5,780,000 short) · supplier cost
rise (Kampala Steel +30%) · agent margin (Nsubuga 11% vs 19%, 344,000 commission) · dead stock
(3,100,000 over 120 days).

**Nothing in this list is suppressed** — a move about Mulongo and an alert about Mulongo may both
appear. A duplicate row is visible and harmless; a wrong suppression is invisible.

#### 1.7 Insight rail (326px)

- **Where the profit came from** — white card, 15px 16px. Title 14px/700, 11.5px `#5f6a7d` sub
  ("Last 30 days · gross margin"). Four product rows: name 12.5px/600 (truncating, `min-width:0`),
  Plex Mono 12.5px money, then a margin-% chip — good `#e2f5ec`/`#0f7a56`, thin `#fff3d9`/`#96600f`,
  neutral `#f2f0ec`/`#5f6a7d`. Under each, a 7px radius-999px bar on `#f0eeea`, width proportional
  to the largest, in a violet ramp `#5b46d6` → `#7a68e0` → `#9a8ceb` → `#bcb2f2`. A final
  rule-separated line names what was **not** listed ("54 other lines · 3,260,000") — truncating a
  list says how many were cut.
- **Sold by week** — `#ecf8f2` on `#d3ebe0`. Title with a "best of 12" chip (`#cfeadd`/`#0b5e42`).
  Twelve bars, 76px tall, 5px gap, `border-radius:4px 4px 0 0`, deepening green
  `#c3e2d3` → `#0f7a56`. Axis captions 10.5px/600 `#39544b`. One sentence of reading beneath.
- **Yesterday** — white card; 2×2 of 11px-radius tiles, 9px gap: Sold `#f7f6f3`, Collected
  `#ecf8f2` (figure `#0f7a56`), Paid out `#f7f6f3`, New debt `#fff1ec` (figure `#b2301f`).

### 2. Today — phone (`#2b`, 390×844, compact)

Compact by explicit request: the same content, less air.

- **Header (`#17223c`, 10px 12px 12px, `flex:none`).** 24px brand square; "Today" 14px/700 beside
  an 11px `#a8b2c7` timestamp; an "8 to do" chip (`#c2311f`, white); 18px search glyph.
  Below, **one 4-across figure strip** in a `rgba(255,255,255,.07)` block, radius 10px, cells
  divided by `1px solid rgba(255,255,255,.09)`, 7px 9px padding: label 9.5px/600, figure Plex Mono
  13.5px white with the unit suffix (`M`, `%`) at 9.5px in the label colour. Debt cell tinted
  `rgba(239,75,57,.18)`, margin cell `rgba(26,143,102,.22)`. One 10.5px meta line carries the
  detail the cells dropped: "2.4 months of cover · 6.9M over 60 days · margin −1.4 pts".
  Abbreviated money (`8.42M`) is used **only** in this strip, where the full figure is one tap
  away; everywhere else the figure is written in full. A clipped or rounded figure in a list would
  be a wrong figure.
- **Body (10px padding, 8px between cards).** Move cards 10px 11px padding, title 14.5px/600, one
  11.5px `#5f6a7d` reason line, and the worth as an inline chip in the header row rather than a
  block. Watch rows 8px padding, 26px icon chips, 13px/600 first line, 11px second line.
  Yesterday reduces to two tiles (Sold, Collected).
- **Every action is ≥44px** and sits in the thumb zone: the primary is a full-width 44px button
  with the door beside it as a 46px square icon button.
- **Tab bar 56px**, white, `1px solid #ecebe6` top. Five destinations — Today, Sell, Money,
  Manager, More. The active state is a **filled** glyph inside a 38×22px `#ffe1dc` pill with a
  9.5px/700 `#c2311f` label; inactive are stroked 19px glyphs with 9.5px/600 `#5f6a7d` labels.
  A shape change, not only a colour change. Tabs are the four in `MMS_BAR_TABS` plus More, and the
  More sheet is generated from the rail index (`mmsRenderDestinations`) — never a second
  hand-kept list.

## Interactions & behaviour

- **Row click** anywhere on a watch row opens its screen; the chevron is affordance only.
  Each move's buttons are explicit doors (`goToTab`) — Mulongo → Debtors, prices → Prices,
  forecasts → Forecasts (stock lens). Old tab keys must keep resolving through `resolveTab`.
- **"How this was worked out"** toggles the derivation under the move (the existing `.ow-q-x` /
  `.ow-q-why` fold). Collapsed by default.
- **"Work the list"** focuses move 01 and steps to the next incomplete move after each action; it
  does not perform anything by itself.
- **Search**: `Ctrl/Cmd + K` focuses the field; results rank a name match above a keyword match;
  picking a result clears the box, closes the list and blurs the field **before** navigating;
  Escape clears first and gives up the field only on a second press.
- **Hover** on rail rows, watch rows and buttons as tabulated above; `:focus-visible` gets a 2px
  accent outline at 2px offset on every interactive element — never the browser default.
- **Nav position**: the row you are on is scrolled into view when it is not
  (`block:'nearest'`); the rail's section headings are sticky per section.
- **Empty, one row, two hundred rows.** With nothing to do, the list says so and names the next
  action ("Nothing wants you this morning. Last read 07:42." + New quote) — never a blank panel.
  With two hundred, the watch caps and says how many were cut. A derivation that failed says what
  failed rather than rendering as zero.
- **Responsive**: 820px switches designs. Above it, the metric grid drops to three-up then two-up
  as width allows; the insight rail moves below the work column under ~1200px. The order chips shed
  labels at 1400px.

## State management

Read-only screen; all state is derived from the books. What it needs:

| State | Source | Notes |
| --- | --- | --- |
| Manager moves + order | `renderTodayPlan` → `mgrMoveOrder(rows)` | resolves `after` dependencies; **never re-sorted by the screen** |
| Move outcome / done | `deriveMoveOutcome`, `status` | a done move shows `Done` and stops offering the action |
| Watch alerts | `dashAlerts()` | drawn in full; no dedupe |
| Cash, burn, runway | `dashCashTxnsInRange`, `dashMonthlyBurn` | burn ÷ history that exists |
| Debt + aging | `debAllRows`, `collectableDebts`, `debtChaseRows` | badge counts every debtor with debt > 0, not the filtered list |
| Creditors | `purchaseInvoicesForOrder` chain | due-this-week window |
| Margin 7d, profit by product | sales analytics derivation | gross margin; name the lines not listed |
| Stock value, dead stock, shortfall | `stockAgeRows()` → `dashInventoryHealth` | **one shelf walk**, read by card and screen alike |
| Supplier cost rise | `supplierPriceWatch` / `supplierPriceSeries` | movement from invoices only, never the price registry |
| Agent margin | agent commission/margin derivation | |
| Order stage counts | `updateOrderStatusBar` | also feeds `setNavBadge('navBadgeOrders')` |
| Fold state per rail section | `NAV_FOLD_DEFAULT` + remembered by section name | Sell, Buy, Money, Insight open at rest |

Every count shown twice must be read from one reckoning (the phone sheet reads the rail's own
badge). Two reckonings that disagree give the owner no way to know which is true.

## Design tokens

```
/* ground + ink */
--bg            #f6f5f2   app ground        --canvas-edge   #e8e7e2
--surface       #ffffff   cards             --surface-2     #f7f6f3  inner tiles
--hairline      #ecebe6   card borders      --rule          #f0eeea  inner rules
--field         #f4f3f0   inputs            --field-edge    #e2e0da
--ink           #1b2233   body              --ink-2         #5f6a7d  labels, meta (4.9:1 on white)
--ink-3         #b6bdca   icon-only chrome (never text)
--row-hover     #faf9f6

/* chrome */
--navy          #17223c   rail, phone header, dark buttons
--navy-hover    #243354
--rail-ink      #b9c2d6   --rail-ink-2 #a8b2c7   --rail-head #7d89a5
--rail-hover    rgba(255,255,255,.07)   --rail-active rgba(255,255,255,.13)

/* accent — the one thing to do next */
--accent        #ef4b39   --accent-hover #d93c2b   --accent-ink #c2311f (on light: text, badges)

/* meaning: bad / caution / good / studied */
--bad-fill      #fff1ec   --bad-chip #ffe1dc   --bad-ink #b2301f
--warn-fill     #fff3d9   --warn-chip #ffeccd  --warn-ink #96600f
--good-fill     #ecf8f2   --good-chip #cfeadd  --good-ink #0f7a56  --good-ink-strong #0b5e42
--info-fill     #eef4ff   --info-chip #eaf1ff  --info-ink #1d5bb8
--study-fill    #f4f1ff   --study-chip #ece8ff --study-ink #5b46d6   (Manager mark, value bars)
--neutral-chip  #f2f0ec   --neutral-ink #5f6a7d

/* chart ramps */
green  #c3e2d3 #a9d7c2 #71bfa0 #3f9f7c #1a8f66 #0f7a56
violet #5b46d6 #7a68e0 #9a8ceb #bcb2f2
aging  #c7d3e8 (0–30) · #f0a98f (31–60) · #ef4b39 (60+)

/* type — IBM Plex Sans 400/500/600/700, IBM Plex Mono 500/600 for every figure */
9.5 10.5 11 11.5 12 12.5 13 13.5 14 14.5 15 16.5 17 22 24   (px; no half steps beyond these)
figures: 'IBM Plex Mono'; font-variant-numeric:tabular-nums; letter-spacing:-0.02em; weight 600
headings: -0.01em to -0.02em tracking; labels 600 with 0.03em; section heads 700 / 0.12em / upper
line-height: 1.2 tight · 1.25–1.35 titles · 1.55 prose · prose max-width 74ch

/* space, radius, elevation */
space   2 3 4 5 6 7 8 9 10 11 12 13 14 16 18 20 22 24
radius  6 chip-square · 8 icon-chip · 9 button · 10 field · 11 inner tile · 14 card · 18 frame · 999 pill
shadow  card 0 1px 2px rgba(23,34,60,.05)   floating 0 18px 40px rgba(23,34,60,.16)
tap     44px minimum on the phone
rail 236px · top bar 58px · insight rail 326px · phone tab bar 56px · phone header ~120px
```

**Contrast.** Every text colour here clears 4.5:1 on the grounds it is used on (`--ink-2` 4.9:1 on
white and on all five tints; `--accent-ink` 5.3:1; `--good-ink-strong` on `--good-chip` 4.6:1).
`--accent` (`#ef4b39`, 3.66:1 on white) is a **fill and icon colour only** — never text. The app
has already shipped one failure of exactly this kind (amber ink on an oxide fill); keep the ratchet
in `test/design-system.test.js` computing this.

## Assets

- **Icons — Lucide** (https://lucide.dev), 24 viewBox, `fill:none`, `stroke:currentColor`,
  stroke-width 2, round caps and joins. 14–17px in rails and rows, 19–20px in the phone tab bar.
  Used: sunrise, tag, bookmark, file-text, users, package, message-circle, inbox, bar-chart-3,
  search, store, layout-grid, list, layers, image, credit-card, trending-up, trending-down,
  line-chart, map-pin, activity, log-out, clock, calendar, message-square, chevron-right,
  chevron-down, arrow-right, plus, check, menu, external-link, warehouse.
  **No emoji** anywhere. The current app's icons are hand-drawn at stroke-width 1.8; this design
  standardises on Lucide at 2 — if the rest of the app stays at 1.8, follow the app, not this file.
- **Fonts** — IBM Plex Sans 400/500/600/700 and IBM Plex Mono 500/600, Google Fonts. Self-host
  alongside the existing faces rather than adding a network dependency to a shop on a slow link.
  Note this **replaces** Inter/Archivo Black in SKILL.md §3 and is part of the same
  sign-off decision as the palette.
- **No images.** Every graphic is CSS or inline SVG.
- All figures are plausible demo data for a Ugandan wholesale hardware shop (UGX). Wire to the real
  derivations before review; do not ship the numbers.

## Files

| File | What it is |
| --- | --- |
| `Dashboard.dc.html` | **The design.** Desktop `#2a` and compact phone `#2b`, side by side. Open in a browser. |
| `Dashboard v1 Modernist.dc.html` | An earlier direction on a flat, ink-and-rules system. Kept for reference; same content model, no card tints. |
| `support.js` | Runtime the two HTML files need to render. Not part of the implementation. |

Repo files this was built against (`turyasingurakevin94-dev/omni-ware@main`):
`test/today-queue.test.js` (the two tiers and their order), `test/dashboard-numbers.test.js`
(burn, runway, cost rise, inventory value), `test/dashboard-alerts.test.js` (alert identity),
`test/admin-nav.test.js` (the rail is the complete map; phone sheet parity),
`.claude/skills/ow-design/SKILL.md` (the laws this design keeps and the two sections it asks to
replace).

## Before you say it is done

The app's own rubric (SKILL.md §9), which this design should be reviewed against:

1. What reads first, and why is that right for this screen?
2. What does the owner do here, and in how many taps? Compare with before.
3. Where is the accent, and is it used once?
4. Empty, one row, two hundred rows — screenshot the empty one.
5. At 390px in one hand — is the primary action in the thumb zone?
6. What did you not convert, and why?
7. Which tests pin this screen, and what did you change? A test edited to pass is a decision to be
   argued, never a patch.
