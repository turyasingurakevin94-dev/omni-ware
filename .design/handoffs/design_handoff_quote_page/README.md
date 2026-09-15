# Handoff: New quote page — desktop 1c + phone 3a/3b/3c (supersedes 1d–1g)

> **Update, 15 Sep 2026 — phone density.** The shipped phone screen was judged too sparse (≈190px of chrome before the first item, ≈200px per line). Turn 3 of the mockup (`3a`, `3b`, `3c`) replaces the phone spec in §"Phone — 1d–1g" below. Implement **3a** as the default list, **3b** as the expanded (editing) state of a line, and **3c** as the add-item sheet. The desktop spec (1c) is unchanged. The phone chrome rules from `test/quote-page-layout.test.js` §8 still apply.

> **Update 2, 15 Sep 2026 — turn 4 (4a, 4b, 4c).** Three targeted changes on top of turn 3. Apply them exactly; everything else in the turn-3 spec stands.
>
> **A. Search becomes its own field (4a).** The search row is no longer a hairline row inside the list. Render it as a field: `margin: 10px 16px 8px`, height 44px, `1px solid --ow-rule`, radius 8, white fill, padding 0 12px, magnifier 16px ink-400, placeholder "Add item — name, SKU or supplier code" 14px ink-600. Focus: border `--ow-steel-950`, typed text ink-900/500, a right-aligned "N results" 12px ink-400. The list then starts at its own column header (28px, paper-2) with nothing touching it.
>
> **B. Quote / Details tabs (4a, 4b).** Directly under the search field, a two-tab bar `margin: 0 16px`, `border-bottom: 1px solid --ow-rule`, two equal cells 40px tall, 13px/600. Inactive cell ink-600; active cell ink-900 with a 2px `--ow-steel-950` underline sitting on the rule (`margin-bottom:-1px`). Each label carries a count chip (mono 11px/600 ink-600, `--ow-steel-050` fill, radius 4, padding 1px 5px): "Quote **2**" = item lines; "Details **4**" = number of detail sections with content. Details also shows a 6px amber dot (`--ow-amber-ink`) when any section has a warning (a cheaper supplier exists, or stock can't cover a line). State: `quoteTab: 'quote' | 'details'`, default `quote`, persisted per session; adding an item always switches back to `quote`.
> - **Quote tab** = the turn-3 list (column header, line rows, charge rows, add row). Nothing else.
> - **Details tab** = the four rail panels that previously rendered under the list on the phone, moved here:
>   1. Client facts strip — grid `repeat(3,auto) minmax(0,1fr)`, gap 18px, padding 8px 16px, paper-2, hairline below. Cells ORDERS / OWED NOW / LAST ORDER: label 10px/600 uppercase .08em ink-600 over mono 13px/500 (unit 10px ink-400); the fourth cell is right-aligned "26 days ago" 12px ink-600. Data from `renderQuoteClientHistory`.
>   2. Sections, each `border-bottom: 1px solid --ow-rule-soft`: header 34px, paper-2, padding 0 16px, 10.5px/600 uppercase .07em ink-600, count at right in mono 10.5px/500 ("1 of 2", "2 lines", "20 Aug"). Body rows `.rf`: padding 9px 16px, hairline between rows, left 13px ink-900 truncating, right mono 13px/600. Prose bodies 13px ink-600, padding 9px 16px 11px.
>      - CHEAPER ELSEWHERE · "1 of 2": row "G-MAN Bow Saw · Shafik Katwe" (supplier ink-600) → "−500 / Bundle" in `--ow-amber-ink`.
>      - STOCK TO COVER IT · "2 lines": "Soft Close Mulper — Half Bend" → "1 / 4"; short lines in `--ow-crimson` with the unit-sized suffix "order in" ("0 / 1 order in").
>      - GOES WITH IT: prose "Nothing written down for these lines yet." when empty.
>      - LAST ORDER · date: "Soft Close Mulper · 1 Ctn" → "125,000".
>   The shop strip and the dock stay visible on both tabs.
> - Remove the standalone "Cheaper elsewhere" card and any other rail panel from the phone body.
>
> **C. Search results dropdown (4c).** Anchored under the search field (`left/right: 16px`), white, `1px solid --ow-rule`, radius 8, `--ow-lift`, `overflow:hidden`. Each result is a grid `36px minmax(0,1fr) auto`, column gap 10, row gap 2, padding 8px 12px, min-height 56px, hairline between results:
> - Col 1: 36px thumbnail (existing placeholder), spans both rows.
> - Row 1: name 14px/600 **on one line**, `overflow:hidden; text-overflow:ellipsis; white-space:nowrap`, the matched substring wrapped in `<mark>` (`--ow-amber-soft` fill, radius 2, no colour change). Right: one stock pill 18px 11px (`.pill` neutral "not counted", `.pill.bad` crimson "out of stock", `.pill.good` when counted and in stock).
> - Row 2 (spans cols 2–3): meta 12px ink-600, one truncating line: `29,000 / Pcs · no markup rule · Mahogany · A06B177` — the price mono 12px/500 ink-900; category and SKU after it, matches highlighted the same way. Do not render the SKU, category or "cost …" as separate lines, and never wrap the name.
> - Footer row 40px centred 12px ink-600: "4 more · keep typing to narrow". Show at most 3–5 results before the footer.
> - Fix from the screenshot: the current dropdown stacks SKU, name, pill, price and category as five wrapping lines with overlapping text; the grid above replaces that entirely.
>
> Tests: add assertions that on the phone the search field is a sibling of the list (not a child), that `.q-tabbar` exists with two cells, that `#q_rail`-style panels are inside the Details pane only, and that a search result row contains exactly one `.nm` line and one `.sb` line.

## Phone — condensed (turn 3, ≤820px, 14px body) — THIS REPLACES 1d–1g

Frame 390 × 844. Paper ground (`--ow-paper`), hairlines `--ow-rule-soft` between rows, no card padding, no page title block. Vertical budget: bar 48 · client 44 · search 44 · header 28 · lines 54 each · charge 44 · add 44 · shop strip 36 · dock 64 · tabs 56.

**Top bar** `.q-phbar` — 48px, `--ow-steel-950`. OW mark 26px oxide radius 7; title "New quote" 16px/600 white with "Sell" 12px `#AEB7C0` 8px after; right: document icon (client copy), ⋯ icon; both 22px stroke 1.8 `#C7CFD8`. **Remove** the 26px "New quote" heading, the subtitle, the "i" bubble and the "Order tracking" link from the phone body — order tracking lives under ⋯.

**Client row** — 44px, `--ow-paper-2`, hairline below, padding 0 16px. "Jackson" 14px/600 · phone mono 12px ink-600 · spacer · "12 orders · owes 0" 12px ink-600 · chevron 14px ink-400. Empty state reads "Who is it for?" 14px ink-600 with the chevron. Tap opens the client picker/fields as today.

**Search row** — 44px, hairline below, padding 0 16px: magnifier 16px ink-400, placeholder "Add item — name, SKU or supplier code" 14px ink-600.

**Column header** — 28px, `--ow-paper-2`, hairline below, grid `22px minmax(0,1fr) auto`, gap 8: "", "ITEM", "LINE TOTAL" 10.5px/600 uppercase .07em ink-600.

**Line row (3a, default)** `.q-line` — grid `22px minmax(0,1fr) auto`, column gap 8, row gap 1, padding 8px 16px, min-height 54px, hairline below.
- Col 1: number mono 11px ink-400, spans both rows, top-aligned.
- Row 1: name 14px/600 truncating (`overflow:hidden;text-overflow:ellipsis;white-space:nowrap`); line total mono 14px/600 `-.02em` tabular, unit "UGX" 11px ink-400, right-aligned, nowrap.
- Row 2 (spans cols 2–3): meta 12px ink-600 in one line — `1 Ctn` × `265,000` · spacer · supplier ("Roto Industry", truncating). Qty and price are **tap targets** styled mono 12px/500 ink-900 with `text-decoration: underline dotted --ow-ink-400; text-underline-offset: 3px`. Tapping either expands the row to the 3b state; tapping elsewhere on the row opens the item sheet (3c) for that line. Swipe-left or long-press exposes remove (no visible × in the row).

**Line row, expanded (3b)** — same grid, min-height 78px. Row 1 as above, but supplier moves onto the name line as "· Roto Industry" 12px/400 ink-600. Row 2 becomes a controls strip, gap 6, margin-top 5:
- Stepper: 32px tall, 1px `--ow-rule`, radius 6; − and + cells 32×32 ink-600 16px; centre cell min-width 44 mono 14px/500 with unit 11px Inter ink-600 ("1 Ctn"), hairline dividers.
- "×" mono 13px ink-400.
- Price field: `flex:1`, 32px, 1px `--ow-rule`, radius 6, padding 0 10px, mono 14px/500, right hint "each" 11px ink-400 nowrap (`flex:none`). Focused: border `--ow-steel-950`, hint becomes "rec." when a recommended price exists and differs.
Only one row is expanded at a time; tapping the total or outside collapses it. Optional setting: "always show controls" keeps every row in the 3b state.

**Charge row** — grid as line row, min-height 44px, padding 6px 16px. Gutter empty; name 14px/500 ("Transport") with "charge" 12px ink-600 after; amount at right as dotted-underlined mono 14px/500 (3a) or as a 112px price field with "UGX" hint (3b). Credit terms render as a charge row "Credit terms · +3%".

**Add row** — 44px, padding 0 16px, hairline below, single line, horizontal scroll with a 36px white fade on the right edge (`linear-gradient(90deg, rgba(255,255,255,0), #fff)`): dashed `.q-add-icon` 20px, then `.sug` chips 24px tall, 12px, 1px `--ow-rule-soft`, pill: "Delivery **60,000**", "Urgent **5%**", "On credit **+3%**", dashed "Other". Keep `id="q_add_row_btn"` on the +.

**Shop strip** (replaces the "› Shop side · N lines" disclosure) — 36px, `--ow-paper-2`, hairline top, padding 0 16px, 12px ink-600: "Shop side · costs you **435,500** · you keep **29,000**" (figures mono 12px, costs ink-600/500, keep ink-900/600) + margin pill 18px + chevron 14px right. Tap toggles `q-shop-open`: each line row gains a third meta line "Buy @ Roto Industry 265,000 · 0% nothing kept" (12px, pill readings as before) and the strip's chevron flips. Default closed; persist per session.

**Dock** `.q-stickybar` — one row, 64px, paper, 1px `--ow-rule` top, padding 0 16px, gap 8: label "CLIENT PAYS · 4 LINES" 10px/600 uppercase .09em ink-600 over mono 20px/600 "464,500 UGX" nowrap; spacer; WhatsApp icon button 42×42 1px `--ow-rule` radius 7; "Save quote" `.qbar-save` 42px, 0 18px, radius 7, 14px/700 oxide. The ⋯ button leaves the dock (it's in the top bar). No second deck.

**Tab bar** — 56px (was 60), labels 10.5px, icons 21px. Otherwise unchanged.

**Add-item sheet (3c)** — bottom sheet, radius 14 top, `--ow-lift`, padding 8px 16px 14px, over a 35% steel-950 scrim; designed to fit without scrolling at 844px:
- Grab handle 36×4 steel-100.
- Title row: product name 17px/700, × 16px ink-400 at right. Meta one line 12px ink-600: "Furniture › Bow Saw · 10 Pcs / Bundle · wholesale **+10,000**" (rule figure mono 12px ink-900). Drop the separate Category / Packaging / Price-rule lines.
- Row 1, two columns (`auto minmax(0,1fr)`, gap 10): QUANTITY — 40×44 steppers and a 92px centred 44px field mono 17px with unit + chevron (unit picker); SELL PRICE EACH — 44px field mono 17px, hint "UGX", focused border steel-950. Labels 10.5px/600 uppercase .09em ink-600. Remove the helper sentence ("What the client pays per Pcs…"); put it in the field's `aria-describedby` only.
- RECOMMENDED — one two-cell strip, 1px `--ow-rule` radius 8, cells padding 8px 12px divided by a hairline: "WHOLESALE · USING" 10.5px uppercase with 13px box icon over mono 15px/600 "105,000 / Bundle" (unit 11px ink-400), selected cell `--ow-steel-050` fill; "RETAIL" over "No rule set" mono 15px/500 ink-400. Tapping a cell writes its price into the field.
- BUY FROM — 40px rows, 1px `--ow-rule-soft` radius 8, gap 6, padding 0 12px, 13px: pill "BEST"/"2ND" 18px · name 600 (`flex:1; min-width:0; ellipsis`) · mono 13px/500 ink-600 "95,000 / Bundle" nowrap · check 16px on the selected row (border steel-950).
- Summary strip `--ow-steel-050` radius 8, padding 10px 14px: "This line · you keep 1,000 · 10%" 13px (keep part 400 ink-600) · mono 17px/600 "10,500 UGX".
- "Add to quote" 46px, 15px/700, radius 7, oxide, margin-top 10. Same primary as Save.

**Type on the phone (turn 3)**: body 14; meta 12; labels 10–10.5 uppercase; figures mono 14 in rows, 20 in the dock, 17 in the sheet; title 16 in the bar. Tap targets stay ≥ 44px tall for rows and buttons; the 32px in-row controls sit inside a 78px row whose full height is the hit area for the nearest control.

**Tests to revisit**: §8 assertions on `.qp-says-value` 19px (now 20px) and the disclosure text "Shop side · N lines" (now the strip). Add assertions: phone body has no `h1.ow-ph-t`; line rows ≤ 54px collapsed; dock is one row ≤ 64px.

---

## Original brief (desktop 1c still current; phone 1d–1g superseded by turn 3 above)

## Overview
Redesign of the Omni-Ware **New quote** tab (`index.html`, `#tab-quote`). The page is used live on a phone call: search → quantity → say a sell price → next item. Four changes on desktop, plus the phone's own design:

1. **Charges and credit terms are rows of the document**, not two chrome bands under the table. One add-row offers the next item, a charge, or credit terms.
2. **The arithmetic lives once, in the sticky bar** (client pays · costs you · you keep). The table has no foot.
3. **Client facts fold into the header band** (client, phone, date, orders, owed now, last order). Usual-buys become a chip row inside the items panel. The right rail is one panel with hairline-separated sections.
4. **Bar buttons keep their words on desktop** (Send on WhatsApp, ⋯, Save quote).

Phone (≤820px): item cards, client folded to one line, Save bar above the tab bar, **shop margin behind a tap** on the bar, item stage as a bottom sheet.

## About the design files
`Quote page.dc.html` is a **design reference built in HTML** — a static mockup, not production code. Recreate it inside `index.html` using the existing `.ow-*` layer, the `.btn` family and the quote page's own `q-*` classes. Do not paste the mockup markup in.

Open the mockup in a browser (needs `support.js` beside it). Use **1c** (desktop) and **turn 3: 3a, 3b, 3c** (phone). 1d–1g show the earlier, sparser phone — keep only their behaviours (empty state copy, shop-side reveal, disabled Save at 0) at the new density. Ignore 1a (before), 1b, and turn 2 (2a/2b are alternative themes, not chosen).

## Fidelity
**High-fidelity.** Colours, type, spacing and grid are lifted from the repo's own house system (`.claude/skills/ow-design/SKILL.md`, `.design/charges-row/_base.css`). Recreate pixel-close, but every value must come from the existing tokens — no new colour, no new font size off the ramp, no new button family.

## Constraints from the codebase (read before touching anything)
- `.claude/skills/ow-design/SKILL.md` is the authority: 23-colour palette, the two-designs law (820px is a switch), accent once per screen, mono tabular figures for money, hairlines not shadows, truncation rules.
- `test/quote-page-layout.test.js` pins the current page shape. Several assertions will have to change — treat each as a decision to argue in the commit, per §9 of the skill. Known collisions:
  - §3 pins icon-only bar buttons with `aria-label`/`title` and no words. 1c gives "Send on WhatsApp" its label on desktop; the phone keeps icon-only. Keep `id="q_print_quote_btn"`, `id="q_whatsapp_btn"`, `id="q_more_btn"`, `id="q_save_btn"`, `class="qbar-save"`.
  - §5/§6 pin `#q_client_history` as the band's last cell and `#q_client_usual` directly after the band. 1c moves usual-buys inside the items panel under the search; `#q_client_history` content becomes the Orders / Owed now / Last order cells.
  - §6 pins `renderQuoteItems` rendering `.q-foot` rows. 1c removes the foot; `renderQuoteFinbar` becomes the only place totals render.
  - §8 (phone) rules are all still true: `.q-stickybar` above the bottom nav, `.qp-says-value` 19px nowrap, pill dropped on phone, `#q_print_quote_btn` hidden on phone with the ⋯ proxy.
- Also run `test/quote-totals.test.js`, `test/quote-line-as-chosen.test.js`, `test/design-system.test.js`, `test/section-structure.test.js`, then `npm test`.

## Screens

### Desktop — 1c (≥1024px, 13px body)
Page padding 24px on `--ow-steel-050`. Two-column `.ow-grid`: `minmax(0,1fr) 304px`, gap 16px.

**Page header `.ow-ph`** — "New quote" in Archivo Black 19px, the "i" bubble, sub "Build the order live, on the call." 12px ink-600. Right: "Order tracking" link with the document icon, 13px/600. Hairline `--ow-rule` under it, 14px below.

**Header band `.ow-cb`** — one bordered row (`1px solid --ow-rule-soft`, radius 8, paper), cells divided by hairlines, each cell padding 9px 14px. Label 11px/600 uppercase .09em ink-600; value 15px/500. Cells, left to right (flex ratios): Client 1.4 ("Jackson" + phone in mono 13px ink-600 after it), Date .8 (mono "14 Sep 2026"), Orders .6 (mono "12"), Owed now .8 (mono "0 UGX", unit at .82em ink-400), Last order 1.3 (mono "230,000 UGX · yesterday"). Client, date stay editable ghost inputs (`.ow-gi`); the last three are read-only facts from the books — rendered by `renderQuoteClientHistory` into these cells.

**Items panel `.ow-pan.q-doc`**
- Search row: 11px 14px padding, magnifier 15px, placeholder "Add item — search name, SKU or supplier code…", `kbd` "/" at right (mono 11px, hairline border, radius 4).
- Usual-buys row (new, replaces the card strip): padding 8px 12px, hairline below, label "USUALLY BUYS" 11px/600 .07em ink-600, then `.sug` chips (12px, pill, 1px `--ow-rule-soft`, 2px 8px) "Black Screws 8* **7 Box**" etc., last chip dashed "+3". Overflow hidden, single line, chips `flex:none; white-space:nowrap`. Clicking a chip = the existing usual-buys add.
- Table `.ow-tbl`: existing eight tracks `30px minmax(0,1fr) 88px 116px minmax(112px,auto) 156px 88px 76px`, gap 8px, row padding 6px 12px, min-height 42px, hairline `--ow-rule-soft` between rows. Header 11px/600 uppercase .06em. Shop-side divider `.q-shop-first` (1px `--ow-rule`) starts at the Supplier column and runs the full height of every row.
- Item row: number in mono 11px; name 13px/600 truncating; sub-line 12px ink-600 "Ctn · 25 in stock"; qty ghost input + unit 11px; price ghost input; line total mono 13px/600 with unit .82em ink-400; supplier text; buy @ ghost input; margin pill 18px mono 11px (`.q-margin-pill`, `.warn` amber for thin, `.good` verdigris ≥ threshold, neutral steel otherwise — same readings as `renderQuoteFinbar`'s pill).
- **Charge row** (new): same eight tracks. Gutter empty, name 500 weight ("Transport"), sub "Charge", qty empty, price = ghost input for the amount, line total = the amount, supplier/buy/margin empty. Percent charges show "Rate 5%" in the price cell and the computed figure in line total. Remove control appears in the gutter on hover.
- **Add row** (replaces the three add rows): min-height 44px, dashed `.q-add-icon` in the gutter, text "Next item, a charge, or credit terms" 12px ink-600, then chips: the shop's named charges with usual amounts ("Delivery **60,000**", "Urgent **5%**"), and "On credit **+3%**". Clicking a charge chip appends a charge row; "On credit" toggles the credit terms line (rendered as a charge-style row "Credit terms · +3%" with its computed amount). Keep `id="q_add_row_btn"` on the + icon.
- **No foot.** The table ends at the add row. Empty state `.q-empty-doc` unchanged.

**Rail** — one `.ow-pan`, sections separated by `.ow-pan-h` headers (34px, paper-2, 11px uppercase) with hairline tops: "Cheaper elsewhere · 0 of 1" + one 12px line; "Stock to cover it · 2 lines" + `.rf` rows (name truncating left, mono "25 / 25" right); "Goes with it" + line; "Last order · 14 Sept" + `.rf` row. Same data sources as today's four panels.

**Sticky bar `.q-stickybar`** — fixed, paper, 1px `--ow-rule` top, height 64px, padding 0 24px. Three figure groups separated by hairlines (`--ow-rule-soft`, 22px padding each side):
- CLIENT PAYS 11px label + mono 22px/600 "439,000 UGX" (`#q_finbar`).
- COSTS YOU + mono 15px/500 ink-600.
- YOU KEEP + mono 15px/600 + the margin pill. Figure colour takes the pill's reading (good/warn/danger/quiet), by class.
- Actions right-aligned, gap 8px: "Send on WhatsApp" `.qbar-btn` with label (40px min, 1px `--ow-rule`, radius 7, 13px/600), ⋯ icon button 40×40, "Save quote" `.qbar-save` (oxide fill, white, 14px/700, 0 18px). Client copy and Clear stay in the ⋯ menu. Oxide appears only on Save.
- All labels and button text `white-space:nowrap`.

### Phone — 1d–1g (≤820px, 15px body)
Chrome: navy 44px top bar (`--ow-steel-950`, OW mark oxide 26px radius 7, "Sell" 14px/600, document icon right), white 60px tab bar (Today / Sell / Money / Manager / More; active is filled). Page padding 12px 16px.

**Client line** (folded band): 48px, paper, hairline, radius 8, "Jackson" 15px/600, phone mono 12px ink-600, date/orders right, chevron. Tap expands to editable fields.

**Search**: 48px, 1px `--ow-rule`, radius 8, 15px, "Add item…". Focus border `--ow-steel-950`.

**1d Empty**: `.ph-list` with a centred message — "Nothing on the quote yet" 16px/600, then "Search above to add the first item, or take one of Jackson's usuals." 14px ink-600 — followed by three usual-buys rows (30px thumb, name 15px/600, "Last: 7 Box · yesterday" 12px, 36px dashed + target) and "5 more usuals" 13px centred. Dock shows CLIENT PAYS "0 UGX" in ink-400 and a disabled Save (`--ow-steel-100` fill, ink-600 text).

**1e Building**: item cards 14px 16px padding, hairline between: number mono 12px, name 15px/600 truncating, sub "Ctn · Karddia" 12px, 44px × remove target. Rows (gap 9px): QTY / PRICE EACH as boxed inputs `.ph-gi` (1px `--ow-steel-100`, radius 4, mono 14px/500, min-width 96px, right-aligned), LINE TOTAL mono 14px/600. **Charge card** is one line: name 500 weight, "Charge" sub, amount input at right. Then "Add a charge or credit terms" 40px row with dashed + and 38px chips (Delivery 60,000 · Urgent 5% · On credit +3% · Other dashed), chips `white-space:nowrap`.
Dock (`.q-stickybar`, above the tab bar): CLIENT PAYS label + 19px mono figure, WhatsApp 44px icon button, "Save quote" oxide 44px. Under it a 13px ink-600 disclosure "› Shop side · 3 lines".

**1f Shop side revealed** (tap on the disclosure): each card grows a hairline-separated block — "Buy @ Karddia  250,000" and "Margin" pill (22px, 12px text: "0% · nothing kept" amber / "13% · 24,000 UGX" verdigris). Dock adds a two-cell hairline box above the figure: COSTS YOU mono 15px/500 ink-600 · YOU KEEP mono 15px/600 + pill "6%". Disclosure flips to "⌄ Shop side". State persists per session; default closed.

**1g Item stage** (bottom sheet over a 35% steel-950 scrim, radius 14 top, `--ow-lift`): "‹ Back to search" 13px; product name 18px/700; meta 13px ink-600 "Sold by the Ctn · 24 in stock · last sold at 92,000". Fields (labels 11px uppercase .09em): QUANTITY = 44px − / + steppers and a 48px centred mono 18px field with unit; SELL PRICE PER CTN (UGX) = 48px field, focus border steel-950, right hint "rec. 92,000" 13px nowrap, helper "What the client pays per Ctn. The buy cost is recorded on its own."; BUY FROM = radio-like rows 11px 12px, selected has 1px steel-950 border and a check, secondary text ink-600. Summary strip steel-050 radius 8: "This line" 14px/600 · mono 18px "184,000 UGX". Disclosure "Show what you keep ›" 13px ink-600 (margin behind a tap). "Add to quote" oxide, 48px, 16px/700 — same `.qbar-save` primary as Save.

## Interactions & behaviour
- Enter in search picks the top suggestion (unchanged). `/` focuses search (unchanged).
- Charge chip → appends charge row, focus lands in its amount input. Credit chip → toggles the terms line; totals re-run.
- Editing qty / price / buy @ re-renders `renderQuoteFinbar` only (the bar is the single totals surface).
- Phone "Shop side" disclosure toggles a body class (e.g. `q-shop-open`) that reveals the per-card block and the dock's two-cell box.
- Focus rings steel-950 (never oxide). Hover on a row shows ghost-input borders `--ow-steel-100`.
- Clear still confirms. Nothing sends itself — WhatsApp opens the existing draft flow.

## State
Existing quote state (items, charges, credit terms, client) is unchanged. New: `shopSideOpen` (phone, boolean, session), usual-buys chip overflow count.

## Design tokens (from the house system — do not add)
Colours: steel-950 #14171B · steel-100 #DCE0E4 · steel-050 #E9EBED · paper #FFFFFF · paper-2 #F7F9FB · oxide #B23A26 · oxide-deep #8E2C1C · oxide-soft #F6E7E3 · verdigris #1C6B58 / soft #E2EFEB · amber-soft #FBEFD9 / amber-ink #7A4A02 · crimson #7F1D1A / soft #F7E4E2 · ink-900 #14171B · ink-600 #59626B · ink-400 #8A939C · rule #CFD5DA · rule-soft #E3E7EA.
Type: Inter 400/500/600/700; Archivo Black (page names); IBM Plex Mono 400/500/600 for every figure with `font-variant-numeric:tabular-nums; letter-spacing:-.02em`. Sizes 11 / 12 / 13 / 14 / 15 / 19 / 22 / 26; desktop page name 19, phone 26.
Space: 2 4 6 8 10 12 16 20 24 32. Radius 4 / 6 / 8 / pill. Tap 44px. One elevation `--ow-lift` for the sheet only.

## Assets
Icons are existing house marks (24 viewBox, stroke 1.8, round caps): search, document, WhatsApp bubble, ⋯, +, ×, chevrons, check, save. Usual-buys thumbnails come from product images with the existing placeholder.

## Files
- `Quote page.dc.html` — the mockup canvas (turn 4: **4a/4b/4c, chosen — search field, Quote/Details tabs, results dropdown**; turn 3: **3a/3b/3c phone, chosen**; turn 1: 1a before, 1b alt, **1c desktop chosen**, 1d–1g earlier phone; turn 2: not chosen). Requires `support.js` beside it. The `_ds/industry…/styles.css` link is only for turn 2 and can 404 harmlessly.
- `support.js` — runtime for the mockup file.
- Repo references: `.claude/skills/ow-design/SKILL.md`, `.design/charges-row/*` (charge-as-row argument), `test/quote-page-layout.test.js`.
