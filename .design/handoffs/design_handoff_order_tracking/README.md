# Handoff: Order tracking redesign (board 1a + dialogs)

## Overview
A first-principles redesign of the Omni-Ware admin app's **Order tracking** screen, for a wholesale
hardware shop in Uganda. It replaces the old metric-strip + grouped-table screen with a **five-lane
stage board** that holds a busy day (54 live orders) without paging, a **needs-you queue** that
serves one decision at a time out of a backlog of 20, and **six dialogs** (order preview, buying
list, today's trip, delivery runs, announce, invoice).

The chosen direction is **1a — the card board**. Direction 1b (chip lanes + persistent drawer) was
explored and rejected; it is still in the design file for reference but must NOT be built.

## About the Design Files
The files in this bundle are **design references created in HTML** — prototypes showing intended
look and behaviour, not production code to copy. The task is to **recreate these designs in
omni-ware's existing environment**: `index.html`'s vanilla-JS render functions, the `.ow-*` CSS
layer, and the components named in `.claude/skills/ow-design/SKILL.md`. Prefer the existing
components over anything invented here; where this prototype hand-rolled markup (dialog shell,
stage track, lane), map it to `.ow-pan`, `.ow-q`, `.ow-lr`, `.btn` and friends, or add ONE new
namespaced component per SKILL.md §6 (every selector starts `.ow-`, no element selectors, nothing
on `body`, no new colour).

Read `.claude/skills/ow-design/SKILL.md` before writing any CSS. The three laws of the OW layer and
the meaning rules in §2 and §7 govern this screen; this prototype was written to obey them and its
review caught two violations (an off-palette backdrop, and three oxide elements in one dialog) that
you should not reintroduce.

## Fidelity
**High-fidelity.** Colours, type, spacing, copy and dialog anatomy are final and taken from the
house tokens. Recreate pixel-for-pixel at desktop widths using the codebase's own classes. Two
exceptions, deliberately unfinished:
- The goods photographs in the order preview are **placeholders** (dashed frame + camera glyph +
  caption). Real check-in photos come from the app's own upload path.
- The board was drawn at 1680 x 1000 (navy top bar 54px + rail 220px + content). It must work from
  1440 up; below 1024 the phone design is a separate screen and is NOT in scope (SKILL.md §1, the
  two-designs law).

## Screens / Views

### 1. Order tracking — the board (desktop, >=1024px)
**Purpose.** Five jobs, in this priority order: decide what needs me now; see where every order is;
push orders through stages fast; plan buying trips and delivery runs; answer a client who calls.

**Layout, top to bottom.**
- App chrome, unchanged: navy `#14171B` top bar 54px (brand mark 34x34 radius 9 oxide + "OMNI-WARE"
  Archivo Black 16.5px + crumb "Sell / Order tracking" 13px/600 with "Sell" in `#8E9BA8`/500 +
  spacer + 18px search icon `#C7CFD8`); navy rail 220px, padding 14px 10px 16px, gap 1px, items
  9px/12px, radius 8, 13.5px/500 `#C7CFD8`, active item oxide fill with 700 white label, badge
  mono 10.5px on `rgba(255,255,255,.14)` pill. Order tracking is the active item; its badge shows
  the needs-you count (20).
- Main region: `padding:22px 24px 24px`, ground `#E9EBED`, column flex, `gap:14px`, `overflow:hidden`.
- **Page header** (`.ow-ph`): "Order tracking" Archivo Black 19px, letter-spacing -.015em; a 17px
  round "i" bubble; sub 12px `#59626B` = "54 live · 20 need you, one at a time · 5 past their stage
  limit"; spacer; search field 280x28 (white, 1px `#CFD5DA`, radius 6, 14px icon, 12px placeholder
  "Client, order number or item"); ghost "New quote" 28px. Hairline `#CFD5DA` under, 12px below.
- **Metric strip**, one white bordered region (radius 8, border `#E3E7EA`), `padding:10px 16px`,
  tiles separated by 1px `#E3E7EA` verticals, gap 26: Live 54 · Cash to buy in 2,180,000 UGX ·
  Past stage limit 5 (crimson `#7F1D1A`) · To invoice 18. Labels 11px/600 `#59626B` .09em uppercase;
  values IBM Plex Mono 22px/500, letter-spacing -.03em, line-height 1.1; unit at .55em `#8A939C`.
  Right cell, 440px fixed: "Today's trip & runs" label, two ghost buttons (Plan trip, Runs) 24px,
  then two lines of 12px copy — the trip with its cash to carry, and "6 orders out on 2 runs ·
  nothing overdue". This cell replaces the old 304px right rail entirely.
- **Needs-you queue** (white region, `padding:11px 14px 13px`, gap 8). Header row: "Needs you"
  13px/600; count in mono 12px/600 **oxide**; 12px `#8A939C` "A queue, longest waiting first. One at
  a time; the rest wait their turn."; right side a stepper — position "1 of 20" mono 11px, a 26x24
  back button, and a "Next" button 24px with a chevron. Body is a row, gap 10:
  - **Current decision card**, flex 1, 1px **oxide** border, radius 8, `padding:12px 14px`: client
    16px/600; meta mono 11px `#8A939C` "#360 · Trade Center · 19h 04m" (truncates); the decision in
    13px `#59626B`, line-height 1.45, max-width 76ch; right column holds money mono 14px/600 and two
    buttons — a ghost secondary (Hold / Announce / Reassign / Call client, varies per item) and the
    **one oxide primary** whose label is the decision itself (Buying list, Move on, Draft the chase,
    Decide price, Split order, Let it through, Release cash, Plan trip, Confirm cost, Set a date...).
  - **"Behind it"** panel, 300px, 1px `#E3E7EA`, radius 8: uppercase label, then the next two in the
    queue as one-liners (client, mono order no., mono age tinted by age), and at the bottom
    "+17 more behind · open the Waiting-on-you list".
- **The board**, flex 1, white region radius 8 border `#E3E7EA`, `overflow:hidden`,
  `display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); grid-template-rows:minmax(0,1fr)`.
  The row constraint matters: without it the auto row sizes to content and the lanes clip
  unreachably. Each lane is `display:flex; flex-direction:column; min-width:0; min-height:0;
  overflow:hidden`, separated by a 1px `#E3E7EA` left border.
  - Lane header: `padding:10px 12px`, background `#F7F9FB`, hairline under. Name 11px/600 .09em
    uppercase; count mono 14px/600 -.02em; optional ghost action 22px on the right (Buying list on
    Buying, Runs on Out, Invoice on Delivered); then the lane's rule in 11px `#8A939C`:
    - Taken — "Suppliers answer, then it moves itself."
    - Buying — "Moves on when the last line is checked in."
    - Preparing — "You pack it, then mark it out."
    - Out — "The run closes it on delivery."
    - Delivered — "0 of 18 invoiced. Today only; older sit in Money."
  - Lane body: `padding:10px`, column flex gap 8, `overflow:hidden auto` (never `overflow-y` alone —
    it resolves the other axis to auto and adds a stray horizontal bar), each card `flex:none`.
  - **Order card**: white, 1px `#E3E7EA`, radius 8, `padding:9px 10px`, gap 5, hover `#F7F9FB`.
    Line 1: client 13px/600 (truncates with the three declarations + `min-width:0`) and money mono
    12px/600 -.02em, `flex:none`, `nowrap` — **money never truncates, the name gives way**.
    Line 2: mono order no., then "place · lines" (truncates), then age mono 11px, tinted
    `#8A939C` under 6h, `#B0700A` 6-12h, `#7F1D1A` over 12h. Line 3 (optional): who has it,
    11px `#59626B`, truncates. A card that is in the needs-you queue also carries a "Needs you"
    tag (11px/600 `#8E2C1C` on `#F6E7E3`) and its highlight treatment (below).
  - Delivered lane ends with "+12 earlier today" 11px/600 `#59626B`.

**Card counts as drawn** (mock data): Taken 9, Buying 14, Preparing 7, Out 6, Delivered 18 (6 shown).

### 2. The dialogs
All six share one anatomy: centred over the board on a scrim of `rgba(20,23,27,.55)` (steel-950 at
55%) — not an opaque slab; white paper, radius 8, `box-shadow:0 4px 16px rgba(15,20,25,.14)`
(`--ow-lift`), `overflow:hidden`; a **44px header** (background `#F7F9FB`, hairline under) holding
title 14px/600, a mono 12px `#59626B` sub-line of counts, a spacer, optional ghost action, and a
16px close X; body in hairline-separated blocks; a **footer** (background `#F7F9FB`, hairline over,
`padding:12px 14px`) with 11px `#8A939C` explanatory copy on the left and the actions on the right,
of which **exactly one is the oxide primary**.

**2a Order preview — 900px wide.** Opens from any card; this is also the answer when a client rings.
Header: "Jackson" + "#357 · Ndeeba · 1 line" + a neutral chip "Preparing · 3h 02m in this stage".
Blocks:
1. **Stage track** — a 5-column grid, each step a 14px dot plus a 2px connector: done steps
   verdigris `#1C6B58`; the current step an **ink** `#14171B` dot with a 3px `#DCE0E4` ring and a
   `#14171B` 700 label (filled vs hollow carries "current", not colour — the accent is reserved for
   the action); future steps hollow, 1px `#CFD5DA`, labels `#8A939C`. Under each: 12px name and mono
   11px time ("Mon 08:12", "now · since 12:05", "run 2, 15:30", "not yet"). Then one 12px line:
   who has it and whether the promised day still holds.
2. **What to tell the client** — on `#FEFAF2`: label 11px/600 `#7A4A02` uppercase, then a 13px
   sentence built from the books (goods in, being packed, on the afternoon run, arriving today,
   nothing owed before delivery), and the **oxide** "Send the client an update" 34px.
3. **Body row** — left column (flex 1, `padding:14px 18px`, gap 14): "The lines" (verdigris check
   box, item name truncating, mono qty, mono money, plus an 11px check-in note); "How it got here"
   (mono 76px time gutter + 12px event, four rows, last one ink); "Goods, as checked in" (two
   150x104 dashed placeholders with a camera glyph and captions "Check-in photo / Wasswa, 12:05"
   and "Packed load / not taken yet"). Right column 270px on `#F7F9FB`, hairline left: Money —
   Client pays 250,000 / Cost, as bought 196,500 / rule / **Margin 53,500** in verdigris, with
   "21.4% on the quote. Cost is what the buyer paid at Karddia, not the list price."; then
   "Not invoiced" and one line saying nothing is owed until delivery.
4. Footer: "Nothing here sends itself. Moving it on marks it packed and puts it on run 2." +
   Hold or cancel / Announce / **Mark it out on run 2** (ink-bordered 700, because the oxide in this
   dialog is already spent on Send the client an update).

**2b Buying list — 980px.** Header "Buying list · Monday" + "2 stops · 9 items · 14 orders waiting"
+ ghost "Send to the buyer". First block is an **amber warning** (`#FBEFD9` on `#EBD9B4`, ink
`#7A4A02`, 16px triangle glyph): "3 lines are on no trip — Karddia (#360), Bbosa Steel (#350),
Tendo (#362). Nobody buys them until they are on a stop." + "Add them to a stop". Then per stop a
`#F7F9FB` group header (stop name uppercase, suppliers and who buys, right-aligned "Cash for this
stop" + mono total) and rows on the grid
`34px minmax(0,1fr) 150px 110px 120px 92px` = check-in box / item / supplier / for order / cost /
qty, 9px 14px, hairline under, hover `#F7F9FB`. Checked rows carry the verdigris tick. Ends with
"+4 more items on these two stops". Footer: Cash to carry 2,180,000 UGX as a 20px mono figure,
"2 of 9 items checked in. Orders move themselves as their last line comes in — no order here is
moved by this dialog.", ghost "Add a line", oxide **"Check in 2 items"**.

**2c Today's trip — 760px.** Header "Plan today's trip" + "2 stops · 9 items · leaves 13:30". Each
stop a bordered row (radius 8, `padding:11px 12px`): drag glyph, a 22px ink circle with the stop
number, name 14px/600, 12px detail (suppliers, item and order counts, who buys), and right-aligned
mono cash with an 11px "cash" caption. Then a dashed `#FEFAF2` row naming the 3 lines on no stop with
"Add a stop". Footer: Cash to carry 20px mono, "Planned by place from every order past Taken. Drag a
stop to change the order of the round.", oxide **"Save the plan"**.

**2d Delivery runs — 800px.** Header "Delivery runs · Monday" + "2 runs · 6 orders out". Per run a
`#F7F9FB` group header (Run 1 · Kizito, departure and places, order count, mono load value) and rows
on `minmax(0,1fr) 150px 120px 120px` = client + mono order no. / place / mono money / a ghost action
("Delivered" for a run that is out, "Move run" for one that has not left). Footer: "Marking an order
delivered closes it on this run and puts it in Delivered, not invoiced. A run with nothing left
closes itself." + ghost "Add a run" + oxide **"Close run 1"**.

**2e Announce to the group — 620px.** Header "Announce · Jackson #357". Body: a "To" row with a
`#E9EBED` chip "Yard group · 6 people" and a ghost "Add Wasswa"; the drafted message in a
`#F7F9FB` box (1px `#CFD5DA`, radius 6, 13px/1.5) written from the order — lines, the run it is on,
what the client owes; then 11px "Written from the order... nothing is sent until you press send."
Footer: ghost "Copy the text" + oxide **"Send to the group"** with a 15px WhatsApp glyph.

**2f Invoice the delivered — 760px.** Header "Invoice · delivered today" + "18 orders · 3 picked" +
ghost "Pick all 18". Rows on `34px minmax(0,1fr) 120px 130px 130px` = pick box / client + mono order
no. / delivered time / mono invoice total / terms ("14 days", "30 days", "on delivery"). Ends with
"+14 more delivered today". Footer: "Picked" 2,690,000 UGX as a 20px mono figure, "Each invoice is
drawn from the order's own lines and the client's terms. Two of the three go to Debtors on 14 and 30
days.", oxide **"Draw 3 invoices"**.

## Interactions & Behavior
- **Needs-you queue.** `qIndex` into a queue sorted longest-waiting-first. "Next" advances; the back
  arrow steps back; clicking an item in "Behind it" jumps to it. In the prototype the primary action
  also advances — **open decision for the team**: auto-advance after acting, or hold on the order so
  the owner sees it moved. Pick one and say so in the UI copy.
- **Highlight needs-you orders in the lanes.** Orders in the queue are marked on their lane card.
  Three treatments were built; **Oxide edge** is the chosen default: 1px `#B23A26` border. The others
  were "Tinted fill" (`#F6E7E3` on `#E3C8C1`) and "Left bar" (3px `#B23A26` left border). Ship one.
- **Lane sort.** Longest waiting (default) or largest money, applied to every lane at once.
- **Mute the Delivered lane.** Optional 0.55 opacity on that lane; the prototype's default is muted.
- **Cards open the preview dialog (2a).** Column and lane actions open 2b/2d/2f; the strip's Plan
  trip and Runs open 2c/2d. Escape and the header X close; the scrim closes on click.
- **Nothing sends itself** (SKILL.md §7). Every send, move, invoice and cash release is an owner
  action. No dialog may look like it already acted; "Check in 2 items", "Draw 3 invoices" and
  "Close run 1" all name what will happen and how many.
- **Hover.** Cards and rows to `#F7F9FB`; ghost buttons to `#F7F9FB`; the oxide primary to
  `#8E2C1C`. Focus must be the house `:focus-visible` ring, not the browser default.
- **Empty, one, two hundred.** Lanes scroll independently; a lane with nothing must say what would
  put an order there (e.g. "Nothing preparing. Orders arrive here when the last line is checked
  in."), never a blank column. Named-rather-than-dropped applies to the "+N more" tails.

## State Management
- `orders` — client, order no., place, amount, line count, lines-to-buy, who has it, stage,
  `stageSince`, age in hours (derived), `needsDecision` + its reason and its two action labels.
- `needsQueue` — the orders needing a decision, sorted by age; `qIndex` is the only UI state the
  board itself holds.
- `laneSort` ('waiting' | 'money'), `highlightNeeds` (bool), `highlightTreatment`, `dimDelivered`.
- `openDialog` — null | preview | buyingList | trip | runs | announce | invoice, plus the order or
  stop it was opened on.
- Every figure must be derived from the books, never invented (SKILL.md §7). Age, cash to carry,
  margin, "0 of 18 invoiced" and the stage-limit count are all computed; if one cannot be derived,
  the screen says so instead of showing a number.

## Design Tokens
Use the existing `.ow-*` token block (`.design/customers/_chrome.css` has the canonical copy). Nothing
outside the 23 palette values — the review of this prototype caught one off-palette hex and it was
removed.
- Ink/chrome: `#14171B`, `#252A31`, `#8A939C`, `#DCE0E4`, `#E9EBED` (ground), `#FFFFFF`, `#F7F9FB`.
- Accent: oxide `#B23A26`, deep `#8E2C1C`, light `#C9573F`, soft `#F6E7E3`. **Once per screen and once
  per dialog.**
- States: verdigris `#1C6B58` / soft `#E2EFEB`; amber `#B0700A` / soft `#FBEFD9` / faint `#FEFAF2` /
  ink `#7A4A02` (amber ink only on amber grounds, never on oxide); crimson `#7F1D1A` / soft `#F7E4E2`.
- Text: `#14171B` body, `#59626B` secondary, `#8A939C` meta. Rules: `#CFD5DA`, hairlines `#E3E7EA`.
  Rail-only: text `#C7CFD8`, section labels `#7C8894`, hover `rgba(255,255,255,.07)`.
- Type: Inter 400/500/600/700 interface; Archivo Black page names only (19px desktop); IBM Plex Mono
  400/500/600 for every figure, with `font-variant-numeric:tabular-nums` and `letter-spacing:-.02em`.
  Sizes on the ramp: 11 / 12 / 13 / 14 / 16 / 20 / 22. No half-pixel sizes, no weight outside the four.
- Space 2 4 6 8 10 12 16 20 24 32. Radius 4 / 6 / 8 / pill. One elevation: `0 4px 16px rgba(15,20,25,.14)`.
- Tap target 44px; prose measure 76ch. Icons: 24 viewBox, `fill:none`, `stroke:currentColor`,
  stroke-width 1.8, round caps — 16px in dense rows, 18px in the rail.
- Scrim for dialogs: `rgba(20,23,27,.55)`.

## Assets
- No image assets. Icons are inline SVG at stroke 1.8; the rail icons are the app's existing set,
  lifted from `.design/agents/_rail.html` (including the Order-tracking tick-in-a-box mark).
- The two goods photographs in 2a are placeholders. Wire them to the real check-in photo upload;
  frame 150x104, radius 6, with the photographer and time as the caption.
- Fonts load from Google Fonts in the prototype; the app already loads Inter, Archivo Black and IBM
  Plex Mono — use the app's loader.

## Files
- `Order tracking.dc.html` — the design. Turn 2 (top of file) is the six dialogs 2a-2f; turn 1 below
  it holds **1a — the board to build** and 1b, the rejected alternative. Ids are visible badges.
- `support.js` — the prototype's runtime. Not for production.
- Repo files this was grounded in, and which the implementation should follow:
  `.claude/skills/ow-design/SKILL.md`, `.design/customers/_chrome.css`, `.design/agents/_rail.html`.

## Before you say you are done
Run the harness and the rubric in SKILL.md §8-9: boot with no page errors, seed demo data,
screenshot at 1440 **and** look at it, pass the section-structure check, and answer — what reads
first; what the owner does here and in how many taps; where the accent is and whether it is used
once; empty / one row / two hundred rows; which tests pin this screen and what changed.
