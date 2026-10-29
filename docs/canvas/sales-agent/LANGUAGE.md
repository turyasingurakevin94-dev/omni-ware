# The language: the agent app's design, codified for the Sales app

This file is the single source for every shared part. **Copy the snippets verbatim.** Change only the words, the numbers, the initials, the tint and the `href`. If a part you need is not here, build it from the tokens in section 1 and the rules in section 4, and say so in your manifest's `open_questions`.

The source is the live agent app (`agent.html`, its CSS from line 236) and Kevin's two phone photos. Where the agent canvas boards differ from the live app, the live app wins (section 6 lists every case).

**How every artboard is built** (the `/design` rules, as they apply here):

- One screen per file, root fixed at **360 × 800**, `$preview` 360 × 800, `<html lang="en">`, a `<title>` of a few words naming the screen.
- Keep `<script src="./support.js"></script>` exactly. Close every element, quote every attribute.
- Literal inline-styled markup only. Lay out groups with flex or grid and `gap`; a grid is `grid-template-columns: repeat(N, minmax(0, 1fr))`.
- Real elements: `<a href>` for anything that goes somewhere, `<button type="button">` for anything that acts, `<input>` inside a `<label>`. Never a `<div>` or `<span>` you tap. An `aria-label` on every icon-only control. Decorative SVG gets `aria-hidden="true"`. Never put a link or button inside another link or button: a row with its own button is a `<div>` holding two siblings (see P10).
- No fake status bar, no fake keyboard. The top 0 px of the artboard is the app's first pixel.
- Tap targets at least 44 × 44. Text at least 11 px. Text contrast at least 4.5:1 (the pairs in 1.1 are checked).

The file shell (copy as is, then put the root `<div>` inside `<x-dc>`):

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Today</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700;800&amp;family=IBM+Plex+Mono:wght@400;500;600&amp;display=swap" rel="stylesheet">
<style>
body{margin:0}
a{color:inherit;text-decoration:none}a:hover{color:inherit}
button{font-family:inherit;color:inherit}
@keyframes owPulse{0%{box-shadow:0 0 0 0 rgba(111,220,176,.6)}70%{box-shadow:0 0 0 7px rgba(111,220,176,0)}100%{box-shadow:0 0 0 0 rgba(111,220,176,0)}}
@keyframes owGlow{0%{box-shadow:0 0 0 0 rgba(111,220,176,.55)}70%{box-shadow:0 0 0 9px rgba(111,220,176,0)}100%{box-shadow:0 0 0 0 rgba(111,220,176,0)}}
@keyframes owGlowW{0%{box-shadow:0 0 0 0 rgba(245,178,107,.55)}70%{box-shadow:0 0 0 9px rgba(245,178,107,0)}100%{box-shadow:0 0 0 0 rgba(245,178,107,0)}}
@keyframes owNudge{0%,100%{transform:translateX(0)}50%{transform:translateX(6px)}}
@keyframes owShim{0%{background-position:100% 0}100%{background-position:-200% 0}}
</style>
</helmet>
<div style="width: 360px; height: 800px; position: relative; overflow: hidden; background: #F7F5F2; font-family: Figtree, system-ui, sans-serif; color: #1C2233">
  <!-- the screen -->
</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":360,"height":800}}'>
class Component extends DCLogic {
  renderVals() {
    return {};
  }
}
</script>
</body>
</html>
```

Sample shop (from `docs/canvas-cast.md`): **Mukasa Hardware**, Kampala, **Saturday 17 October 2026**. The salesperson holding the phone is **Grace Akello (GA)**; teammates Brian Ouma (BO), Faith Nambi (FN); Manager **Ruth** Nakato (RN), Accounts **Esther** Auma (EA), Sourcing **Moses** Lubega (ML), Store Musa Kiggundu (MK), drivers Ssali and Hassan. Customers: Kato Construction, Kyaligonza & Sons, Mukono Roofing, Lubowa Builders, Ggaba Stores, Nansana Hardware. Grace's October goal is **35,000,000**.

---

## 1. Tokens

### 1.1 Colour

| Token | Hex | Used for |
|---|---|---|
| `navy` | `#16203C` | Heads, the dock, the dark card, primary dark buttons, dark pills, the "on" chip |
| `navy-2` | `#243052` | Your own avatar on navy; the top stop of the navy tile gradient |
| `navy-3` | `#2A3350` | The ground behind a pushed sheet (the 40 px strip above it) |
| `navy-glow` | `#243A6B` | Highlight stop of a page head's radial |
| `navy-glow-2` | `#2B3866` | Highlight stop of the dark "Next move" card's radial |
| `ground` | `#F7F5F2` | Every light screen; the red +'s ring; stage tiles inside a white card |
| `panel` | `#FFFFFF` | Cards, rows, fields, the tab bar |
| `tile` | `#F1EEE8` | Icon squares, neutral chips, row dividers, the tile-coloured round buttons |
| `line` | `#E6E3DD` | Card hairlines (as `inset 0 0 0 1px`), the tab bar's top border |
| `dash` | `#C9C4BA` | Dashed outlines (the basket tile, a ghost card), the sheet grabber on light |
| `ink` | `#1C2233` | Text, the open line card's outline, the price field's outline |
| `ink-soft` | `#5F6980` | Secondary text on the warm ground and on white |
| `ink-faint` | `#6B7480` | Captions **on white only** (4.74:1). On `ground` it is 4.35:1 and fails: use `ink-soft` there |
| `oxide` (red) | `#C93A30` | The one move: the red +, the slide knob, a red pay button, "Cancel order". Pressed `#A82D24`. Soft `#FDE8E4` |
| `good` | `#0F6B43` | Done, in, confirmed, a positive amount on light. Soft `#E4F4EA` |
| `warn` | `#95530C` | Waiting on you, late, money to take, a count badge on the basket. Soft `#FDEEE1`, text on soft `#7A4A02` |
| `bad` | `#8E2A22` | Dropped, refused, gone quiet, the "Needs you" dot, the unread count. Soft `#FBE5E2` |
| `info` | `#1A5A8A` | The shop has it (Checking, Buying, Packing badges), "asked". Soft `#E3EEFB` |
| `mint` | `#6FDCB0` | On navy only: Live, done, now, money in, the + on a navy tile, a sent tick |
| `amber-on-navy` | `#F5B26B` | On navy only: waiting on you, late, due |
| `rose-on-navy` | `#F7A196` | On navy only: late days in the week strip, a loss |
| `on-navy` | `#B3BCD2` | Secondary text on navy (8.4:1) |
| `on-navy-2` | `#8D99B5` | Tertiary text on navy (5.6:1): UGX prefix, step labels not reached |
| `on-navy-off` | `#5F6A85` | Decoration only on navy (dots, row chevrons). Never text (2.98:1) |
| `chev` | `#9AA1AE` | Row chevrons on white. Decoration only, never text |

Soft fills on navy are white or a tone at low alpha: `rgba(255,255,255,.06)` glass, `.07` a tile, `.08` a field or segmented track, `.10` an icon button, `.12` a goal bar track, `.14` a done step tile, `rgba(111,220,176,.14)` a mint pill, `rgba(245,178,107,.16)` an amber pill.

**Avatar tints** (identity, never state; one person keeps one tint on every screen):

| Tint | Background | Initials | Given to |
|---|---|---|---|
| t0 blue | `#DCEAF8` | `#1A5A8A` | Kato Construction (KC) |
| t1 plum | `#F6E4F1` | `#7A3268` | Kyaligonza & Sons (KS), Faith Nambi (FN) |
| t2 teal | `#DDF1EE` | `#0E5E57` | Lubowa Builders (LB), Ruth Nakato (RN) |
| t3 indigo | `#E4E6FA` | `#3A3F9B` | Mukono Roofing (MR), Brian Ouma (BO) |
| t4 slate | `#E8EBF0` | `#3D4A5C` | Ggaba Stores (GS), Moses Lubega (ML), a walk-in (WI) |
| t5 sand | `#FDEEE1` | `#7A4A02` | Nansana Hardware (NH), Esther Auma (EA) |

Grace herself (the phone's owner) is `#243052` with white initials on navy, and `#16203C` with white initials on light.

### 1.2 Grounds and gradients

- **Today's hero**: flat `#16203C` (the live app; Kevin's photo).
- **A page head** (Chats, Orders, Customers): `radial-gradient(120% 90% at 100% 0%, #243A6B 0%, #16203C 60%)` with `box-shadow: 0 10px 30px rgba(22,32,60,.18)`.
- **The dark "Next move" card**: `radial-gradient(120% 90% at 100% 0%, #2B3866 0%, #16203C 58%)` with `box-shadow: 0 14px 30px rgba(22,32,60,.22)`.
- **A navy tile on light** (a usual tile, "All aisles"): `linear-gradient(160deg, #243052, #16203C)` with `box-shadow: 0 8px 18px rgba(22,32,60,.25)`.
- **An aisle square**: `linear-gradient(145deg, <soft> 0%, #FFFFFF 150%)` with `box-shadow: inset 0 0 0 1px rgba(0,0,0,.035)`.
- **The scrim behind a sheet**: `rgba(12,19,38,.72)` over the screen (drawn as `#2A3350` for the strip that shows above a full sheet).
- No other gradient. No gradient on text, buttons or the ground.

### 1.3 Shadows

| Name | Value | On |
|---|---|---|
| `hair` | `0 1px 2px rgba(22,32,60,.05), inset 0 0 0 1px #E6E3DD` | Every white card and row (the outline is an inset shadow, so it never shifts layout) |
| `lift` | `0 1px 2px rgba(22,32,60,.05), 0 6px 16px rgba(22,32,60,.06), inset 0 0 0 1px #E6E3DD` | The who pill; the usual card |
| `open` | `0 10px 26px rgba(22,32,60,.10), inset 0 0 0 1.5px #1C2233` | The line card being edited |
| `navy-tile` | `0 8px 18px rgba(22,32,60,.25)` | Navy tiles on light |
| `dark-card` | `0 14px 30px rgba(22,32,60,.22)` | The dark Next-move card; the Finish bar uses `0 10px 24px rgba(22,32,60,.22)` |
| `up` | `0 -8px 24px rgba(22,32,60,.18)` | The dock |
| `plus` | `0 6px 20px rgba(201,58,48,.35)` | The red + |
| `white-on-navy` | `0 6px 16px rgba(0,0,0,.25)` | The white add button on a navy head |
| `toast` | `0 10px 28px rgba(22,32,60,.25)` | A toast |

### 1.4 Radii

| Radius | On |
|---|---|
| 999 | Pills, chips, avatars, round buttons, the slide, the segmented control, bars |
| 28 | The bottom corners of Today's hero and of a page head (`0 0 28px 28px`) |
| 26 | The top corners of a sheet and of the dock (`26px 26px 0 0`) |
| 22 | The dark Next-move card |
| 20 | The usual card; a group card in a sheet; the 3-up action bar (joined) |
| 18 | A list group card (rows inside); the open line card; the glass row on a hero; the aisle tile |
| 16 | A single card or row card (line card, Needs-you row, money tile, who pill, basket chip, stage tile inside a card is 12) |
| 14 | Fields (search, price), buttons (block buttons, 56 px action tiles are 16), the Call square on the dark card |
| 12 | Icon tiles (38 to 42 px), stage tiles, the stepper, step tiles, tiles inside the dark card |
| 9 to 10 | Small item squares (30 to 34 px) |
| 8 | The earn chip (`+40,000`) and the counter code chip |

### 1.5 Spacing

- **Gutter**: 16 px left and right on every light screen (content is 328 px wide at 360). Heads use 20 px (Today's hero, a sheet's navy top) or 16 px (a page head).
- **Vertical rhythm**: 10 px between blocks on Today (`gap: 10px`), 12 px on the order (`gap: 12px`), 8 px between stacked line cards and Needs-you rows, 16 px between groups on a list page.
- **Section header**: `padding: 0 4px`; it sits 6 px further down than the block gap when it follows a card (`padding: 6px 4px 0`).
- **Inside a card**: 10 to 14 px padding; rows 10 to 12 px side padding inside a group card; row min-height 48 (compact act row), 58 to 66 (list row), 64 (customer row).
- **Bottom clearance**: content scrolls under nothing. A screen with the tab bar ends its content 100 px above the bottom (tab bar 84 + 16). A screen with the dock leaves the dock's height plus 16.

### 1.6 Type

Two families only. **Figtree** for words; **IBM Plex Mono** for every number a person reads as a number (money, counts, quantities, order numbers, times, percentages, codes). Mono always carries `font-variant-numeric: tabular-nums` and, at 16 px and up, a negative letter-spacing.

| Role | Family | Size / weight | Letter-spacing | Line height | Colour |
|---|---|---|---|---|---|
| Celebration title | Figtree | 30 / 700 | -.02em | 1.1 | white |
| Page head title | Figtree | 26 / 800 | -.02em | 1.1 | white |
| Stage word (track) | Figtree | 24 / 700 (28 on a big tile) | -.02em | 1 to 1.1 | white |
| Sheet title | Figtree | 22 / 700 | -.01em | 1.2 | ink |
| Greeting | Figtree | 20 / 700 | -.01em | 1.2 | white |
| Card hero name (dark card) | Figtree | 18 / 700 | -.01em | 1.2 | white |
| Section header | Figtree | 17 / 700 | 0 | 1.2 | ink |
| Sheet head name | Figtree | 16 to 17 / 700 | 0 | 1.2 | white |
| Primary button | Figtree | 15 to 16 / 700 | 0 | 1 | |
| Row title | Figtree | 14 / 700 (a list), 14 / 600 (an item line) | 0 | 1.25 | ink |
| Customer row name | Figtree | 15 / 700 | 0 | 1.25 | ink |
| Body, bubble text | Figtree | 14 / 500 | 0 | 1.4 | ink |
| Chip, pill, small button | Figtree | 13 / 700 | 0 | 1 | |
| Subline (words) | Figtree | 12 / 600 | 0 | 1.3 | ink-soft or a tone |
| Tab label | Figtree | 12 / 600, active 700 | 0 | 1 | ink-faint, active ink |
| Eyebrow | Figtree | 11 / 700, uppercase | .1em | 1 | on-navy (or ink-faint) |
| Caption, tile label, step label | Figtree | 11 / 600 | 0 | 1.25 | |
| Hero money | Mono | 38 / 600 | -.04em | 1 | white, with "UGX" Figtree 14 / 700 `#8D99B5` |
| Big money in a sheet head | Mono | 28 to 32 / 600 | -.03em | 1 | |
| Ring centre | Mono | 26 to 28 / 600 | -.04em | 1 | |
| Dock total | Mono | 22 / 600 | -.03em | 1 | white |
| Price field | Mono | 22 / 600 | -.02em | 1 | ink |
| Money tile, count | Mono | 18 / 600 | -.02em | 1 | |
| Row amount | Mono | 13 / 600 | -.02em | 1.2 | ink (or good) |
| Line subline ("40 bag × 33,500") | Mono | 12 / 400 | -.02em | 1.3 | ink-soft, the unit word stays Figtree |
| Mono subline ("ask the shop in one message") | Mono | 11 / 400 | -.02em | 1.3 | ink-faint on white |
| Count badge | Mono | 11 / 600 | 0 | 1 | white |

Money is written in full where someone acts on it ("1,250,000"), and may be shortened in a tile, a summary or a glass door the agent's way ("1.2M", "+146k", "35M").

---

## 2. Icons

### 2.1 Which family, where

The agent app uses two families, and they never mix inside one control.

1. **Stroke, 24 grid** (`viewBox="0 0 24 24"`, `fill="none"`, `stroke="currentColor"`, round caps and joins). This is the **interface**: tab bar, ×, back, chevrons, call, update, receipt, send, the dock's Pickup and Delivery, stage icons in tiles, rails and badges, the 3-up action tiles, ticks and crosses in discs, row actions (+, →), the pen, the bin, share, lock.
2. **Duotone, 256 grid** (Phosphor, `viewBox="0 0 256 256"`, filled, a 0.2-opacity under-layer). These are **things and places**: aisle and item icons (tinted per aisle), the Needs-you kind tiles (coins, store, hourglass, basket), section marks ("Often with" link, "You sell most" flame, "their usual" clock-arrow, bonus star), every **search field's** magnifier, the **aisles** button, the **basket** chip in the top bar, the **mic** inside a field, the WhatsApp disc on a customer row, the white add button on a page head.

A stroke icon is never filled, except the active tab (P20) and the flame on the hero's glass door.

**Sizes and stroke widths**

| Where | Box | Stroke |
|---|---|---|
| Tab bar | 24 | 1.8 |
| Red + | 28 | 2.4 |
| Action tile (Call / Update / Receipt), row icon in a 42 px tile | 20 | 1.8 to 2 |
| Icon button on navy or white (44 px) | 20 | 2 |
| Dock segment (Pickup, Delivery) | 18 to 20 | 1.8 |
| Stage step tile / rail now-dot | 16 | 2 to 2.2 |
| Stage tile on Today (beside the count) | 15 | 1.9 |
| Row chevron | 14 to 16 | 2.2 to 2.4 |
| Inside a pill or chip | 13 to 14 | 2.2 to 2.4 |
| Tick in a 24 px disc | 13 | 3.2 |
| × in a 24 px disc | 11 | 3.4 |
| Slide knob arrows | 22 | 2.4 |
| Duotone in an aisle square | 24 (40 px square), 26 (44 px), 22 (38 px) | — |
| Duotone in a Needs-you tile | 20 | — |
| Duotone search / aisles / basket in the top bar | 20 / 22 / 18 | — |

### 2.2 The stroke set (24 grid), copy-paste

Each is 20 px with stroke 1.8. Change only `width`, `height` and `stroke-width` per the size table in 2.1. `aria-hidden="true"` because a label always sits beside it or on its button.

- **today**: Tab: Today (sunrise). Active: fill the dome, see P16.
  `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 18a6 6 0 0 1 12 0z"/><path d="M3 18h18M12 4v3M4.9 8.9 7 11M19.1 8.9 17 11"/></svg>`
- **chats**: Tab: Chats (two bubbles). Active: fill the front bubble only.
  `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 4.5h13v9H8l-5 4z"/><path d="M17.5 8.5H21v11.5l-3.2-2.6H10.5v-2.9"/></svg>`
- **orders**: Tab: Orders; stage Packing (the box)
  `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5zM3.5 7.5 12 12l8.5-4.5M12 12v9"/></svg>`
- **customers**: Tab: Customers (two people). Active: fill the front person.
  `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.6 3.3-6 6.5-6s5.9 2.4 6.5 6z"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.3c2 .9 3.2 2.9 3.5 5.7"/></svg>`
- **plus**: The red +, add buttons (stroke 2.4 to 2.6)
  `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>`
- **minus**: Stepper fewer
  `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/></svg>`
- **search**: Search on a plain row (fields use the duotone search, see 2.3)
  `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/></svg>`
- **mic**: Say it (a field uses the filled mic, see 2.3)
  `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/></svg>`
- **grid**: Aisles
  `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/></svg>`
- **close**: The × (stroke 2.2 at 16 px)
  `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>`
- **back**: Back
  `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>`
- **chevron-right**: Row chevron (14 to 16 px, stroke 2.2 to 2.4)
  `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>`
- **chevron-down**: Show more / open
  `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>`
- **updown**: The who pill (swap customer)
  `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m8 9 4-4 4 4M8 15l4 4 4-4"/></svg>`
- **arrow-right**: Go / resume
  `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>`
- **slide**: The slide knob (stroke 2.4, white on red)
  `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 6 6 6-6 6M12 6l6 6-6 6"/></svg>`
- **phone**: Call
  `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/></svg>`
- **whatsapp**: WhatsApp (stroke). Rows use the duotone one, see 2.3
  `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20l1.3-3.9A8 8 0 1 1 8 18.8z"/><path d="M9 9.5c0 2.8 2.7 5.5 5.5 5.5l1.3-1.3-1.8-1-1 .8a4.3 4.3 0 0 1-2.3-2.3l.8-1-1-1.8z"/></svg>`
- **message**: Update / a message
  `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z"/></svg>`
- **send**: Send; stage Sent
  `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 3 3 10.5l7 2.5 2.5 7zM10 13 21 3"/></svg>`
- **basket**: Basket (an order not placed yet)
  `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 9h14l-1.5 10h-11zM9 9l3-5 3 5"/></svg>`
- **truck**: Delivery; stage On the road
  `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h11v10H3zM14 9h4l3 3v4h-7"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/></svg>`
- **store**: Pickup; the shop counter
  `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9l1.5-5h13L20 9M4 9v11h16V9M4 9h16M9 20v-6h6v6"/></svg>`
- **cash**: Cash
  `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2.5" y="6" width="19" height="12" rx="2"/><circle cx="12" cy="12" r="2.6"/><path d="M6 12h.01M18 12h.01"/></svg>`
- **mobile**: Mobile money (MTN, Airtel)
  `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="6.5" y="2.5" width="11" height="19" rx="2.5"/><path d="M10.5 18.5h3M10 7h4"/></svg>`
- **bank**: Bank
  `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 9.5 12 4l9 5.5M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20.5h18"/></svg>`
- **receipt**: Receipt / a bill
  `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6M9 16h3"/></svg>`
- **check**: Done, confirmed (stroke 3.2 inside a 24 px disc)
  `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7"/></svg>`
- **checking**: Stage Checking (clipboard tick)
  `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 4h6v3H9zM7 5.5H5V21h14V5.5h-2M9 14l2 2 4-4"/></svg>`
- **cart**: Stage Buying (the buyer is buying it in)
  `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 4h2.5l2.2 11h10.6l2-8H6.3"/><circle cx="9" cy="19" r="1.5"/><circle cx="17" cy="19" r="1.5"/></svg>`
- **delivered**: Stage Delivered (box with a tick)
  `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 7.5 12 3l8.5 4.5V12M3.5 7.5 12 12l8.5-4.5M12 12v9l-8.5-4.5v-9M15 18l2 2 4-4"/></svg>`
- **clock**: Time, due
  `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>`
- **hourglass**: Waiting
  `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 3h10M7 21h10M8 3v3.5a4 4 0 0 0 1.6 3.2L12 11.5l2.4-1.8A4 4 0 0 0 16 6.5V3M8 21v-3.5a4 4 0 0 1 1.6-3.2L12 12.5l2.4 1.8a4 4 0 0 1 1.6 3.2V21"/></svg>`
- **warning**: Warning
  `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4 2.8 19.5h18.4zM12 10v4M12 17h.01"/></svg>`
- **tag**: Price
  `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 12.2V4.5a1 1 0 0 1 1-1h7.7l8.3 8.3a1.5 1.5 0 0 1 0 2.1l-6.4 6.4a1.5 1.5 0 0 1-2.1 0z"/><circle cx="8" cy="8" r="1.4"/></svg>`
- **return**: Return (goods coming back)
  `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 14 4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3"/></svg>`
- **undo**: Undo, again, their usual
  `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v4h4"/></svg>`
- **person**: A person
  `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/></svg>`
- **person-plus**: New customer
  `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="10" cy="8" r="4"/><path d="M3 21c0-3.9 3.1-7 7-7 1.4 0 2.7.4 3.8 1.1M18 14v6M15 17h6"/></svg>`
- **filter**: Filter
  `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4"/></svg>`
- **sort**: Sort
  `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 4v16M4 17l3 3 3-3M17 20V4M14 7l3-3 3 3"/></svg>`
- **camera**: Photo
  `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h3l1.5-2.5h7L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.3"/></svg>`
- **spark**: New, suggested
  `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5c.6 4.2 2.3 5.9 6.5 6.5-4.2.6-5.9 2.3-6.5 6.5-.6-4.2-2.3-5.9-6.5-6.5 4.2-.6 5.9-2.3 6.5-6.5zM18.5 15.5v4M16.5 17.5h4"/></svg>`
- **pin**: Place, delivery address
  `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s7-6.5 7-11.5A7 7 0 1 0 5 9.5C5 14.5 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.4"/></svg>`
- **list**: A list
  `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01"/></svg>`
- **hand-over**: Hand over (give a customer to a teammate)
  `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 13.5h3l3-1.5h4.3a1.6 1.6 0 0 1 0 3.2H10"/><path d="M12.8 15.2h3.6l3.3-2.4a1.5 1.5 0 0 1 2 2.2l-4.4 4H8.5l-3-1.5h-3"/><path d="M14 4.5h6M17.5 2l2.5 2.5L17.5 7"/></svg>`
- **pen**: Edit
  `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3z"/><path d="M14.5 5.5l4 4"/></svg>`
- **trash**: Remove
  `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>`
- **share**: Share
  `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15V3M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/></svg>`
- **lock**: Locked, only you see it
  `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4.5" y="10.5" width="15" height="10" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/></svg>`
- **note**: Team note (never sent to the customer)
  `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 4h14v11l-5 5H5z"/><path d="M14 20v-5h5"/></svg>`
- **attach**: Attach
  `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 11.5l-8.2 8.2a5 5 0 0 1-7-7L13 4.5a3.3 3.3 0 0 1 4.7 4.7l-8 8a1.7 1.7 0 0 1-2.4-2.4l7.3-7.3"/></svg>`
- **backspace**: Keypad delete
  `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 5h12a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H8l-6-7z"/><path d="M12 9.5l5 5M17 9.5l-5 5"/></svg>`
- **offline**: No signal
  `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3l18 18M8.5 16.5a5 5 0 0 1 7 0M5 12.5a10 10 0 0 1 4.2-2.5M14.8 10a10 10 0 0 1 4.2 2.5M2 8.8a15 15 0 0 1 4.2-2.6M10.5 5.1A15 15 0 0 1 22 8.8M12 20h.01"/></svg>`
- **flag**: Goal
  `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5.5 21V3.5M5.5 4.5h11l-2 3.5 2 3.5h-11"/></svg>`
- **trophy**: Goal hit
  `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M9 20h6"/></svg>`
- **trend**: Going up, on the move
  `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 17 6-6 4 4 8-8M15 7h6v6"/></svg>`
- **bell**: Alerts
  `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10 21h4"/></svg>`
- **link**: Link
  `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>`
- **star**: Bonus / favourite
  `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/></svg>`
- **sign-out**: Sign out
  `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>`
- **calendar**: A date
  `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>`
- **void**: Void (a bill struck out)
  `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9.5 9.5l5 5M14.5 9.5l-5 5"/></svg>`

### 2.3 The duotone set (Phosphor, 256 grid), copy-paste

Filled with `currentColor`; the first path is the 0.2-opacity under-layer. Set the colour on the parent or replace `currentColor` with the hex.

- **ph-nav**: Directions
  `<svg width="20" height="20" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M248,121.58a15.76,15.76,0,0,1-11.29,15l-.2.06-78,21.84-21.84,78-.06.2a15.77,15.77,0,0,1-15,11.29h-.3a15.77,15.77,0,0,1-15.07-10.67L41,61.41a1,1,0,0,1-.05-.16A16,16,0,0,1,61.25,40.9l.16.05,175.92,65.26A15.78,15.78,0,0,1,248,121.58Z"/></svg>`
- **ph-coins**: Needs you: money to take
  `<svg width="20" height="20" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M240,132c0,19.88-35.82,36-80,36-19.6,0-37.56-3.17-51.47-8.44h0C146.76,156.85,176,142,176,124V96.72h0C212.52,100.06,240,114.58,240,132ZM176,84c0-19.88-35.82-36-80-36S16,64.12,16,84s35.82,36,80,36S176,103.88,176,84Z" opacity="0.2"/><path d="M184,89.57V84c0-25.08-37.83-44-88-44S8,58.92,8,84v40c0,20.89,26.25,37.49,64,42.46V172c0,25.08,37.83,44,88,44s88-18.92,88-44V132C248,111.3,222.58,94.68,184,89.57ZM232,132c0,13.22-30.79,28-72,28-3.73,0-7.43-.13-11.08-.37C170.49,151.77,184,139,184,124V105.74C213.87,110.19,232,122.27,232,132ZM72,150.25V126.46A183.74,183.74,0,0,0,96,128a183.74,183.74,0,0,0,24-1.54v23.79A163,163,0,0,1,96,152,163,163,0,0,1,72,150.25Zm96-40.32V124c0,8.39-12.41,17.4-32,22.87V123.5C148.91,120.37,159.84,115.71,168,109.93ZM96,56c41.21,0,72,14.78,72,28s-30.79,28-72,28S24,97.22,24,84,54.79,56,96,56ZM24,124V109.93c8.16,5.78,19.09,10.44,32,13.57v23.37C36.41,141.4,24,132.39,24,124Zm64,48v-4.17c2.63.1,5.29.17,8,.17,3.88,0,7.67-.13,11.39-.35A121.92,121.92,0,0,0,120,171.41v23.46C100.41,189.4,88,180.39,88,172Zm48,26.25V174.4a179.48,179.48,0,0,0,24,1.6,183.74,183.74,0,0,0,24-1.54v23.79a165.45,165.45,0,0,1-48,0Zm64-3.38V171.5c12.91-3.13,23.84-7.79,32-13.57V172C232,180.39,219.59,189.4,200,194.87Z"/></svg>`
- **ph-store**: Needs you: ready to collect / counter
  `<svg width="20" height="20" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M224,96v16a32,32,0,0,1-64,0V96H96v16a32,32,0,0,1-64,0V96L46.34,45.8A8,8,0,0,1,54,40H202a8,8,0,0,1,7.69,5.8Z" opacity="0.2"/><path d="M231.69,93.81,217.35,43.6A16.07,16.07,0,0,0,202,32H54A16.07,16.07,0,0,0,38.65,43.6L24.31,93.81A7.94,7.94,0,0,0,24,96v16a40,40,0,0,0,16,32v72a8,8,0,0,0,8,8H208a8,8,0,0,0,8-8V144a40,40,0,0,0,16-32V96A7.94,7.94,0,0,0,231.69,93.81ZM54,48H202l11.42,40H42.61Zm98,56v8a24,24,0,0,1-48,0v-8ZM51.06,132.2A24,24,0,0,1,40,112v-8H88v8a24,24,0,0,1-35.12,21.26A7.88,7.88,0,0,0,51.06,132.2ZM200,208H56V151.2a40.57,40.57,0,0,0,8,.8,40,40,0,0,0,32-16,40,40,0,0,0,64,0,40,40,0,0,0,32,16,40.57,40.57,0,0,0,8-.8Zm16-96a24,24,0,0,1-11.07,20.2,8.08,8.08,0,0,0-1.8,1.05A24,24,0,0,1,168,112v-8h48Z"/></svg>`
- **ph-hourglass**: Needs you: waiting too long
  `<svg width="20" height="20" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M180.92,88,128,128,74.67,88Z" opacity="0.2"/><path d="M200,75.64V40a16,16,0,0,0-16-16H72A16,16,0,0,0,56,40V76a16.07,16.07,0,0,0,6.4,12.8L114.67,128,62.4,167.2A16.07,16.07,0,0,0,56,180v36a16,16,0,0,0,16,16H184a16,16,0,0,0,16-16V180.36a16.09,16.09,0,0,0-6.35-12.77L141.27,128l52.38-39.59A16.09,16.09,0,0,0,200,75.64ZM72,40H184V75.64L178.23,80H77.33L72,76Zm56,78L98.67,96h58.4Zm56,98H72V180l48-36v24a8,8,0,0,0,16,0V144.08l48,36.28Z"/></svg>`
- **ph-whatsapp**: WhatsApp button on a customer row (green soft disc)
  `<svg width="20" height="20" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M128,32A96,96,0,0,0,44.89,176.07L32.42,213.46a8,8,0,0,0,10.12,10.12l37.39-12.47A96,96,0,1,0,128,32Zm24,152a80,80,0,0,1-80-80,32,32,0,0,1,32-32l16,32-12.32,18.47a48.19,48.19,0,0,0,25.85,25.85L152,136l32,16A32,32,0,0,1,152,184Z" opacity="0.2"/><path d="M187.58,144.84l-32-16a8,8,0,0,0-8,.5l-14.69,9.8a40.55,40.55,0,0,1-16-16l9.8-14.69a8,8,0,0,0,.5-8l-16-32A8,8,0,0,0,104,64a40,40,0,0,0-40,40,88.1,88.1,0,0,0,88,88,40,40,0,0,0,40-40A8,8,0,0,0,187.58,144.84ZM152,176a72.08,72.08,0,0,1-72-72A24,24,0,0,1,99.29,80.46l11.48,23L101,118a8,8,0,0,0-.73,7.51,56.47,56.47,0,0,0,30.15,30.15A8,8,0,0,0,138,155l14.62-9.74,23,11.48A24,24,0,0,1,152,176ZM128,24A104,104,0,0,0,36.18,176.88L24.83,210.93a16,16,0,0,0,20.24,20.24l34.05-11.35A104,104,0,1,0,128,24Zm0,192a87.87,87.87,0,0,1-44.06-11.81,8,8,0,0,0-6.54-.67L40,216,52.47,178.6a8,8,0,0,0-.66-6.54A88,88,0,1,1,128,216Z"/></svg>`
- **ph-broom**: Clear cold baskets
  `<svg width="20" height="20" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M192.8,165.12,43.93,105.57A110.88,110.88,0,0,1,61.47,82.38a8,8,0,0,1,8.67-1.81L95.52,90.85a16,16,0,0,0,20.82-9l21-53.1c4.15-10,15.47-15.33,25.63-11.53a20,20,0,0,1,11.51,26.39L153.13,96.71a16,16,0,0,0,8.93,20.75L187,127.3a8,8,0,0,1,5,7.43V152A104.58,104.58,0,0,0,192.8,165.12Z" opacity="0.2"/><path d="M235.5,216.81c-22.56-11-35.5-34.58-35.5-64.8V134.73a15.94,15.94,0,0,0-10.09-14.87L165,110a8,8,0,0,1-4.48-10.34l21.32-53a28,28,0,0,0-16.1-37,28.14,28.14,0,0,0-35.82,16,.61.61,0,0,0,0,.12L108.9,79a8,8,0,0,1-10.37,4.49L73.11,73.14A15.89,15.89,0,0,0,55.74,76.8C34.68,98.45,24,123.75,24,152a111.45,111.45,0,0,0,31.18,77.53A8,8,0,0,0,61,232H232a8,8,0,0,0,3.5-15.19ZM67.14,88l25.41,10.3a24,24,0,0,0,31.23-13.45l21-53c2.56-6.11,9.47-9.27,15.43-7a12,12,0,0,1,6.88,15.92L145.69,93.76a24,24,0,0,0,13.43,31.14L184,134.73V152c0,.33,0,.66,0,1L55.77,101.71A108.84,108.84,0,0,1,67.14,88Zm48,128a87.53,87.53,0,0,1-24.34-42,8,8,0,0,0-15.49,4,105.16,105.16,0,0,0,18.36,38H64.44A95.54,95.54,0,0,1,40,152a85.9,85.9,0,0,1,7.73-36.29l137.8,55.12c3,18,10.56,33.48,21.89,45.16Z"/></svg>`
- **ph-plane**: Sent moment
  `<svg width="20" height="20" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M223.69,42.18l-58.22,192a8,8,0,0,1-14.92,1.25L108,148,20.58,105.45a8,8,0,0,1,1.25-14.92l192-58.22A8,8,0,0,1,223.69,42.18Z" opacity="0.2"/><path d="M227.32,28.68a16,16,0,0,0-15.66-4.08l-.15,0L19.57,82.84a16,16,0,0,0-2.49,29.8L102,154l41.3,84.87A15.86,15.86,0,0,0,157.74,248q.69,0,1.38-.06a15.88,15.88,0,0,0,14-11.51l58.2-191.94c0-.05,0-.1,0-.15A16,16,0,0,0,227.32,28.68ZM157.83,231.85l-.05.14,0-.07-40.06-82.3,48-48a8,8,0,0,0-11.31-11.31l-48,48L24.08,98.25l-.07,0,.14,0L216,40Z"/></svg>`
- **ph-truck**: Delivery on a light card
  `<svg width="20" height="20" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M248,120v64a8,8,0,0,1-8,8H216a24,24,0,0,0-48,0H104a24,24,0,0,0-48,0H32a8,8,0,0,1-8-8V144H184V120Z" opacity="0.2"/><path d="M255.42,117l-14-35A15.93,15.93,0,0,0,226.58,72H192V64a8,8,0,0,0-8-8H32A16,16,0,0,0,16,72V184a16,16,0,0,0,16,16H49a32,32,0,0,0,62,0h50a32,32,0,0,0,62,0h17a16,16,0,0,0,16-16V120A7.94,7.94,0,0,0,255.42,117ZM192,88h34.58l9.6,24H192ZM32,72H176v64H32ZM80,208a16,16,0,1,1,16-16A16,16,0,0,1,80,208Zm81-24H111a32,32,0,0,0-62,0H32V152H176v12.31A32.11,32.11,0,0,0,161,184Zm31,24a16,16,0,1,1,16-16A16,16,0,0,1,192,208Zm48-24H223a32.06,32.06,0,0,0-31-24V128h48Z"/></svg>`
- **ph-stack**: Bundles
  `<svg width="20" height="20" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M224,80l-96,56L32,80l96-56Z" opacity="0.2"/><path d="M230.91,172A8,8,0,0,1,228,182.91l-96,56a8,8,0,0,1-8.06,0l-96-56A8,8,0,0,1,36,169.09l92,53.65,92-53.65A8,8,0,0,1,230.91,172ZM220,121.09l-92,53.65L36,121.09A8,8,0,0,0,28,134.91l96,56a8,8,0,0,0,8.06,0l96-56A8,8,0,1,0,220,121.09ZM24,80a8,8,0,0,1,4-6.91l96-56a8,8,0,0,1,8.06,0l96,56a8,8,0,0,1,0,13.82l-96,56a8,8,0,0,1-8.06,0l-96-56A8,8,0,0,1,24,80Zm23.88,0L128,126.74,208.12,80,128,33.26Z"/></svg>`
- **ph-link**: Section mark: "Often with"
  `<svg width="20" height="20" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M218.34,119.6,183.6,154.34a46.58,46.58,0,0,1-44.31,12.26c-.31.34-.62.67-.95,1L103.6,202.34A46.63,46.63,0,1,1,37.66,136.4L72.4,101.66A46.6,46.6,0,0,1,116.71,89.4c.31-.34.62-.67,1-1L152.4,53.66a46.63,46.63,0,0,1,65.94,65.94Z" opacity="0.2"/><path d="M240,88.23a54.43,54.43,0,0,1-16,37L189.25,160a54.27,54.27,0,0,1-38.63,16h-.05A54.63,54.63,0,0,1,96,119.84a8,8,0,0,1,16,.45A38.62,38.62,0,0,0,150.58,160h0a38.39,38.39,0,0,0,27.31-11.31l34.75-34.75a38.63,38.63,0,0,0-54.63-54.63l-11,11A8,8,0,0,1,135.7,59l11-11A54.65,54.65,0,0,1,224,48,54.86,54.86,0,0,1,240,88.23ZM109,185.66l-11,11A38.41,38.41,0,0,1,70.6,208h0a38.63,38.63,0,0,1-27.29-65.94L78,107.31A38.63,38.63,0,0,1,144,135.71a8,8,0,0,0,7.78,8.22H152a8,8,0,0,0,8-7.78A54.86,54.86,0,0,0,144,96a54.65,54.65,0,0,0-77.27,0L32,130.75A54.62,54.62,0,0,0,70.56,224h0a54.28,54.28,0,0,0,38.64-16l11-11A8,8,0,0,0,109,185.66Z"/></svg>`
- **ph-grid**: The aisles button beside search
  `<svg width="20" height="20" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M112,56v48a8,8,0,0,1-8,8H56a8,8,0,0,1-8-8V56a8,8,0,0,1,8-8h48A8,8,0,0,1,112,56Zm88-8H152a8,8,0,0,0-8,8v48a8,8,0,0,0,8,8h48a8,8,0,0,0,8-8V56A8,8,0,0,0,200,48Zm-96,96H56a8,8,0,0,0-8,8v48a8,8,0,0,0,8,8h48a8,8,0,0,0,8-8V152A8,8,0,0,0,104,144Zm96,0H152a8,8,0,0,0-8,8v48a8,8,0,0,0,8,8h48a8,8,0,0,0,8-8V152A8,8,0,0,0,200,144Z" opacity="0.2"/><path d="M200,136H152a16,16,0,0,0-16,16v48a16,16,0,0,0,16,16h48a16,16,0,0,0,16-16V152A16,16,0,0,0,200,136Zm0,64H152V152h48v48ZM104,40H56A16,16,0,0,0,40,56v48a16,16,0,0,0,16,16h48a16,16,0,0,0,16-16V56A16,16,0,0,0,104,40Zm0,64H56V56h48v48Zm96-64H152a16,16,0,0,0-16,16v48a16,16,0,0,0,16,16h48a16,16,0,0,0,16-16V56A16,16,0,0,0,200,40Zm0,64H152V56h48v48Zm-96,32H56a16,16,0,0,0-16,16v48a16,16,0,0,0,16,16h48a16,16,0,0,0,16-16V152A16,16,0,0,0,104,136Zm0,64H56V152h48v48Z"/></svg>`
- **ph-flame**: Section mark: "You sell most"; streak
  `<svg width="20" height="20" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M173.79,51.48a221.25,221.25,0,0,0-41.67-34.34,8,8,0,0,0-8.24,0A221.25,221.25,0,0,0,82.21,51.48C54.59,80.48,40,112.47,40,144a88,88,0,0,0,176,0C216,112.47,201.41,80.48,173.79,51.48ZM96,184c0-27.67,22.53-47.28,32-54.3,9.48,7,32,26.63,32,54.3a32,32,0,0,1-64,0Z"/></svg>`
- **ph-star**: Section mark: bonus, in a chip (filled)
  `<svg width="20" height="20" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M234.29,114.85l-45,38.83L203,211.75a16.4,16.4,0,0,1-24.5,17.82L128,198.49,77.47,229.57A16.4,16.4,0,0,1,53,211.75l13.76-58.07-45-38.83A16.46,16.46,0,0,1,31.08,86l59-4.76,22.76-55.08a16.36,16.36,0,0,1,30.27,0l22.75,55.08,59,4.76a16.46,16.46,0,0,1,9.37,28.86Z"/></svg>`
- **ph-clock**: Section mark: due
  `<svg width="20" height="20" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M224,128a96,96,0,1,1-96-96A96,96,0,0,1,224,128Z" opacity="0.2"/><path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm64-88a8,8,0,0,1-8,8H128a8,8,0,0,1-8-8V72a8,8,0,0,1,16,0v48h48A8,8,0,0,1,192,128Z"/></svg>`
- **ph-again**: Section mark: their usual
  `<svg width="20" height="20" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M216,128a88,88,0,1,1-88-88A88,88,0,0,1,216,128Z" opacity="0.2"/><path d="M136,80v43.47l36.12,21.67a8,8,0,0,1-8.24,13.72l-40-24A8,8,0,0,1,120,128V80a8,8,0,0,1,16,0Zm-8-48A95.44,95.44,0,0,0,60.08,60.15C52.81,67.51,46.35,74.59,40,82V64a8,8,0,0,0-16,0v40a8,8,0,0,0,8,8H72a8,8,0,0,0,0-16H49c7.15-8.42,14.27-16.35,22.39-24.57a80,80,0,1,1,1.66,114.75,8,8,0,1,0-11,11.64A96,96,0,1,0,128,32Z"/></svg>`
- **ph-basket**: Basket chip in the light top bar; empty slide knob
  `<svg width="20" height="20" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M232,88,216.93,201.06A8,8,0,0,1,209,208H47a8,8,0,0,1-7.93-6.94L24,88Z" opacity="0.2"/><path d="M136,120v56a8,8,0,0,1-16,0V120a8,8,0,0,1,16,0Zm36.84-.8-5.6,56A8,8,0,0,0,174.4,184a7.32,7.32,0,0,0,.81,0,8,8,0,0,0,7.95-7.2l5.6-56a8,8,0,0,0-15.92-1.6Zm-89.68,0a8,8,0,0,0-15.92,1.6l5.6,56a8,8,0,0,0,8,7.2,7.32,7.32,0,0,0,.81,0,8,8,0,0,0,7.16-8.76ZM239.93,89.06,224.86,202.12A16.06,16.06,0,0,1,209,216H47a16.06,16.06,0,0,1-15.86-13.88L16.07,89.06A8,8,0,0,1,24,80H68.37L122,18.73a8,8,0,0,1,12,0L187.63,80H232a8,8,0,0,1,7.93,9.06ZM89.63,80h76.74L128,36.15ZM222.86,96H33.14L47,200H209Z"/></svg>`
- **ph-check**: Tick inside a usual tile badge
  `<svg width="20" height="20" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M232.49,80.49l-128,128a12,12,0,0,1-17,0l-56-56a12,12,0,1,1,17-17L96,183,215.51,63.51a12,12,0,0,1,17,17Z"/></svg>`
- **ph-plus**: + inside a usual tile badge
  `<svg width="20" height="20" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M228,128a12,12,0,0,1-12,12H140v76a12,12,0,0,1-24,0V140H40a12,12,0,0,1,0-24h76V40a12,12,0,0,1,24,0v76h76A12,12,0,0,1,228,128Z"/></svg>`
- **ph-sparkle**: New customer mark; suggestions
  `<svg width="20" height="20" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M208,144a15.78,15.78,0,0,1-10.42,14.94L146,178l-19,51.62a15.92,15.92,0,0,1-29.88,0L78,178l-51.62-19a15.92,15.92,0,0,1,0-29.88L78,110l19-51.62a15.92,15.92,0,0,1,29.88,0L146,110l51.62,19A15.78,15.78,0,0,1,208,144ZM152,48h16V64a8,8,0,0,0,16,0V48h16a8,8,0,0,0,0-16H184V16a8,8,0,0,0-16,0V32H152a8,8,0,0,0,0,16Zm88,32h-8V72a8,8,0,0,0-16,0v8h-8a8,8,0,0,0,0,16h8v8a8,8,0,0,0,16,0V96h8a8,8,0,0,0,0-16Z"/></svg>`
- **ph-swap**: Inside the who pill
  `<svg width="20" height="20" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M184.49,167.51a12,12,0,0,1,0,17l-48,48a12,12,0,0,1-17,0l-48-48a12,12,0,0,1,17-17L128,207l39.51-39.52A12,12,0,0,1,184.49,167.51Zm-96-79L128,49l39.51,39.52a12,12,0,0,0,17-17l-48-48a12,12,0,0,0-17,0l-48,48a12,12,0,0,0,17,17Z"/></svg>`
- **ph-userPlus**: New customer on a navy page head
  `<svg width="20" height="20" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M168,100a60,60,0,1,1-60-60A60,60,0,0,1,168,100Z" opacity="0.2"/><path d="M256,136a8,8,0,0,1-8,8H232v16a8,8,0,0,1-16,0V144H200a8,8,0,0,1,0-16h16V112a8,8,0,0,1,16,0v16h16A8,8,0,0,1,256,136Zm-57.87,58.85a8,8,0,0,1-12.26,10.3C165.75,181.19,138.09,168,108,168s-57.75,13.19-77.87,37.15a8,8,0,0,1-12.25-10.3c14.94-17.78,33.52-30.41,54.17-37.17a68,68,0,1,1,71.9,0C164.6,164.44,183.18,177.07,198.13,194.85ZM108,152a52,52,0,1,0-52-52A52.06,52.06,0,0,0,108,152Z"/></svg>`
- **ph-arrowR**: Resume
  `<svg width="20" height="20" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M224.49,136.49l-72,72a12,12,0,0,1-17-17L187,140H40a12,12,0,0,1,0-24H187L135.51,64.48a12,12,0,0,1,17-17l72,72A12,12,0,0,1,224.49,136.49Z"/></svg>`
- **ph-checkCircle**: Done on a light card
  `<svg width="20" height="20" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm45.66,85.66-56,56a8,8,0,0,1-11.32,0l-24-24a8,8,0,0,1,11.32-11.32L112,148.69l50.34-50.35a8,8,0,0,1,11.32,11.32Z"/></svg>`
- **ph-search**: Every search field (light and navy)
  `<svg width="20" height="20" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M192,112a80,80,0,1,1-80-80A80,80,0,0,1,192,112Z" opacity="0.2"/><path d="M229.66,218.34,179.6,168.28a88.21,88.21,0,1,0-11.32,11.31l50.06,50.07a8,8,0,0,0,11.32-11.32ZM40,112a72,72,0,1,1,72,72A72.08,72.08,0,0,1,40,112Z"/></svg>`
- **ph-box**: Generic item with no aisle
  `<svg width="20" height="20" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M128,129.09V232a8,8,0,0,1-3.84-1l-88-48.18a8,8,0,0,1-4.16-7V80.18a8,8,0,0,1,.7-3.25Z" opacity="0.2"/><path d="M223.68,66.15,135.68,18a15.88,15.88,0,0,0-15.36,0l-88,48.17a16,16,0,0,0-8.32,14v95.64a16,16,0,0,0,8.32,14l88,48.17a15.88,15.88,0,0,0,15.36,0l88-48.17a16,16,0,0,0,8.32-14V80.18A16,16,0,0,0,223.68,66.15ZM128,32l80.34,44-29.77,16.3-80.35-44ZM128,120,47.66,76l33.9-18.56,80.34,44ZM40,90l80,43.78v85.79L40,175.82Zm176,85.78h0l-80,43.79V133.82l32-17.51V152a8,8,0,0,0,16,0V107.55L216,90v85.77Z"/></svg>`
- **ph-x**: × on the light top bar
  `<svg width="20" height="20" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M208.49,191.51a12,12,0,0,1-17,17L128,145,64.49,208.49a12,12,0,0,1-17-17L111,128,47.51,64.49a12,12,0,0,1,17-17L128,111l63.51-63.52a12,12,0,0,1,17,17L145,128Z"/></svg>`
- **ph-mic**: Mic inside a search field (white on a navy 36 px disc)
  `<svg width="20" height="20" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M80,128V64a48,48,0,0,1,96,0v64a48,48,0,0,1-96,0Zm128,0a8,8,0,0,0-16,0,64,64,0,0,1-128,0,8,8,0,0,0-16,0,80.11,80.11,0,0,0,72,79.6V240a8,8,0,0,0,16,0V207.6A80.11,80.11,0,0,0,208,128Z"/></svg>`
- **ph-play**: Play all (navy on mint 22 px disc, at 10 px)
  `<svg width="20" height="20" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M240,128a15.74,15.74,0,0,1-7.6,13.51L88.32,229.65a16,16,0,0,1-16.2.3A15.86,15.86,0,0,1,64,216.13V39.87a15.86,15.86,0,0,1,8.12-13.82,16,16,0,0,1,16.2.3L232.4,114.49A15.74,15.74,0,0,1,240,128Z"/></svg>`

### 2.4 Aisle icons (duotone, tinted per aisle)

An item with no photo shows its aisle's icon in its aisle's colours: the icon in `ink` on a square of `linear-gradient(145deg, <soft> 0%, #FFFFFF 150%)` with `box-shadow: inset 0 0 0 1px rgba(0,0,0,.035)`. The same aisle is the same colour on every screen.

- **roof** · ink `#1A5A8A` · soft `#DCEAF8`
  `<svg width="20" height="20" viewBox="0 0 256 256" fill="#1A5A8A" aria-hidden="true"><path d="M216,116.69V216H152V152H104v64H40V116.69l82.34-82.35a8,8,0,0,1,11.32,0Z" opacity="0.2"/><path d="M240,208H224V136l2.34,2.34A8,8,0,0,0,237.66,127L139.31,28.68a16,16,0,0,0-22.62,0L18.34,127a8,8,0,0,0,11.32,11.31L32,136v72H16a8,8,0,0,0,0,16H240a8,8,0,0,0,0-16ZM48,120l80-80,80,80v88H160V152a8,8,0,0,0-8-8H104a8,8,0,0,0-8,8v56H48Zm96,88H112V160h32Z"/></svg>`
- **cement** · ink `#5F6980` · soft `#EFECE6`
  `<svg width="20" height="20" viewBox="0 0 256 256" fill="#5F6980" aria-hidden="true"><path d="M128,129.09V232a8,8,0,0,1-3.84-1l-88-48.18a8,8,0,0,1-4.16-7V80.18a8,8,0,0,1,.7-3.25Z" opacity="0.2"/><path d="M223.68,66.15,135.68,18a15.88,15.88,0,0,0-15.36,0l-88,48.17a16,16,0,0,0-8.32,14v95.64a16,16,0,0,0,8.32,14l88,48.17a15.88,15.88,0,0,0,15.36,0l88-48.17a16,16,0,0,0,8.32-14V80.18A16,16,0,0,0,223.68,66.15ZM128,32l80.34,44-29.77,16.3-80.35-44ZM128,120,47.66,76l33.9-18.56,80.34,44ZM40,90l80,43.78v85.79L40,175.82Zm176,85.78h0l-80,43.79V133.82l32-17.51V152a8,8,0,0,0,16,0V107.55L216,90v85.77Z"/></svg>`
- **block** · ink `#8E4A22` · soft `#F6E6DC`
  `<svg width="20" height="20" viewBox="0 0 256 256" fill="#8E4A22" aria-hidden="true"><path d="M128,104H32V56h96Zm48,0v48H128v48h96V104Z" opacity="0.2"/><path d="M224,48H32a8,8,0,0,0-8,8V200a8,8,0,0,0,8,8H224a8,8,0,0,0,8-8V56A8,8,0,0,0,224,48ZM88,144V112h80v32Zm-48,0V112H72v32Zm144-32h32v32H184Zm32-16H136V64h80ZM120,64V96H40V64ZM40,160h80v32H40Zm96,32V160h80v32Z"/></svg>`
- **nail** · ink `#3A3F9B` · soft `#E4E6FA`
  `<svg width="20" height="20" viewBox="0 0 256 256" fill="#3A3F9B" aria-hidden="true"><path d="M219.84,73.16,131.84,25a8,8,0,0,0-7.68,0l-88,48.18a8,8,0,0,0-4.16,7v95.64a8,8,0,0,0,4.16,7l88,48.18a8,8,0,0,0,7.68,0l88-48.18a8,8,0,0,0,4.16-7V80.18A8,8,0,0,0,219.84,73.16ZM128,168a40,40,0,1,1,40-40A40,40,0,0,1,128,168Z" opacity="0.2"/><path d="M128,80a48,48,0,1,0,48,48A48.06,48.06,0,0,0,128,80Zm0,80a32,32,0,1,1,32-32A32,32,0,0,1,128,160Zm95.68-93.85L135.68,18a15.88,15.88,0,0,0-15.36,0l-88,48.17a16,16,0,0,0-8.32,14v95.64a16,16,0,0,0,8.32,14l88,48.17a15.88,15.88,0,0,0,15.36,0l88-48.17h0a16,16,0,0,0,8.32-14V80.18A16,16,0,0,0,223.68,66.15ZM128,224,40,175.82V80.18L128,32l88,48.17v95.63Z"/></svg>`
- **pipe** · ink `#0E6A6A` · soft `#DDF1F0`
  `<svg width="20" height="20" viewBox="0 0 256 256" fill="#0E6A6A" aria-hidden="true"><path d="M168,48v64H144a32,32,0,0,0-32,32v24H48V144a96,96,0,0,1,96-96Z" opacity="0.2"/><path d="M232,104H208V56h24a8,8,0,0,0,0-16H205.83A16,16,0,0,0,192,32H176a16,16,0,0,0-13.83,8H144A104.11,104.11,0,0,0,40,144v18.16A16,16,0,0,0,32,176v16a16,16,0,0,0,8,13.84V232a8,8,0,0,0,16,0V208h48v24a8,8,0,0,0,16,0V205.84A16,16,0,0,0,128,192V176a16,16,0,0,0-8-13.84V144a24,24,0,0,1,24-24h18.17A16,16,0,0,0,176,128h16a16,16,0,0,0,13.83-8H232a8,8,0,0,0,0-16ZM112,176v16H48V176Zm-8-32v16H56V144a88.1,88.1,0,0,1,88-88h16v48H144A40,40,0,0,0,104,144Zm72-32V48h16v63.8c0,.07,0,.13,0,.2Z"/></svg>`
- **sanit** · ink `#1A5A8A` · soft `#DCF0F8`
  `<svg width="20" height="20" viewBox="0 0 256 256" fill="#1A5A8A" aria-hidden="true"><path d="M167.92,222.87A8,8,0,0,1,160,232H96a8,8,0,0,1-7.92-9.13l4.34-30.36h0a88.21,88.21,0,0,0,71.14,0h0ZM184,32H72a8,8,0,0,0-8,8v72H192V40A8,8,0,0,0,184,32Z" opacity="0.2"/><path d="M120,64a8,8,0,0,1-8,8H96a8,8,0,0,1,0-16h16A8,8,0,0,1,120,64Zm52.32,133.14,3.52,24.6A16,16,0,0,1,160,240H96a16,16,0,0,1-15.84-18.26l3.52-24.6A96.09,96.09,0,0,1,32,112a8,8,0,0,1,8-8H56V40A16,16,0,0,1,72,24H184a16,16,0,0,1,16,16v64h16a8,8,0,0,1,8,8A96.09,96.09,0,0,1,172.32,197.14ZM72,104H184V40H72Zm85.07,99.5a96.15,96.15,0,0,1-58.14,0L96,224h64ZM207.6,120H48.4a80,80,0,0,0,159.2,0Z"/></svg>`
- **paint** · ink `#7A3268` · soft `#F6E4F1`
  `<svg width="20" height="20" viewBox="0 0 256 256" fill="#7A3268" aria-hidden="true"><path d="M208,64v64a8,8,0,0,1-8,8H48a8,8,0,0,1-8-8V64a8,8,0,0,1,8-8H200A8,8,0,0,1,208,64Z" opacity="0.2"/><path d="M232,88H216V64a16,16,0,0,0-16-16H48A16,16,0,0,0,32,64V88H16a8,8,0,0,0,0,16H32v24a16,16,0,0,0,16,16H200a16,16,0,0,0,16-16V104h16v50L131.6,182.65A16.07,16.07,0,0,0,120,198v34a8,8,0,0,0,16,0V198l100.4-28.68A16.07,16.07,0,0,0,248,154V104A16,16,0,0,0,232,88Zm-32,40H48V64H200v64Z"/></svg>`
- **electr** · ink `#95530C` · soft `#FDEEE1`
  `<svg width="20" height="20" viewBox="0 0 256 256" fill="#95530C" aria-hidden="true"><path d="M96,240l16-80L48,136,160,16,144,96l64,24Z" opacity="0.2"/><path d="M215.79,118.17a8,8,0,0,0-5-5.66L153.18,90.9l14.66-73.33a8,8,0,0,0-13.69-7l-112,120a8,8,0,0,0,3,13l57.63,21.61L88.16,238.43a8,8,0,0,0,13.69,7l112-120A8,8,0,0,0,215.79,118.17ZM109.37,214l10.47-52.38a8,8,0,0,0-5-9.06L62,132.71l84.62-90.66L136.16,94.43a8,8,0,0,0,5,9.06l52.8,19.8Z"/></svg>`
- **wood** · ink `#7A4A02` · soft `#F6EBD9`
  `<svg width="20" height="20" viewBox="0 0 256 256" fill="#7A4A02" aria-hidden="true"><path d="M240,136c0,35.35-17.91,64-40,64s-40-28.65-40-64,17.91-64,40-64S240,100.65,240,136Z" opacity="0.2"/><path d="M212,136a12,12,0,1,1-12-12A12,12,0,0,1,212,136Zm36,0c0,40.37-21.08,72-48,72H56c-26.92,0-48-31.63-48-72S29.08,64,56,64H92.69l37.65-37.66A8,8,0,0,1,136,24h32a8,8,0,0,1,0,16H139.31l-24,24H200C226.92,64,248,95.63,248,136ZM56,192H169.51a73.46,73.46,0,0,1-12.67-24H80a8,8,0,0,1,0-16h73.16A110.63,110.63,0,0,1,152,136c0-22.86,6.76-42.9,17.51-56H56c-12.47,0-23.55,13.26-28.8,32H104a8,8,0,0,1,0,16H24.35q-.34,3.93-.35,8C24,166.36,38.65,192,56,192Zm176-56c0-30.36-14.65-56-32-56s-32,25.64-32,56,14.65,56,32,56S232,166.36,232,136Z"/></svg>`
- **steel** · ink `#3D4A5C` · soft `#E8EBF0`
  `<svg width="20" height="20" viewBox="0 0 256 256" fill="#3D4A5C" aria-hidden="true"><path d="M112,48V208a8,8,0,0,1-8,8H64a8,8,0,0,1-8-8V48a8,8,0,0,1,8-8h40A8,8,0,0,1,112,48Zm80-8H152a8,8,0,0,0-8,8V208a8,8,0,0,0,8,8h40a8,8,0,0,0,8-8V48A8,8,0,0,0,192,40Z" opacity="0.2"/><path d="M104,32H64A16,16,0,0,0,48,48V208a16,16,0,0,0,16,16h40a16,16,0,0,0,16-16V48A16,16,0,0,0,104,32Zm0,176H64V48h40ZM192,32H152a16,16,0,0,0-16,16V208a16,16,0,0,0,16,16h40a16,16,0,0,0,16-16V48A16,16,0,0,0,192,32Zm0,176H152V48h40Z"/></svg>`
- **door** · ink `#0F6B43` · soft `#E4F4EA`
  `<svg width="20" height="20" viewBox="0 0 256 256" fill="#0F6B43" aria-hidden="true"><path d="M200,40V224H56V40a8,8,0,0,1,8-8H192A8,8,0,0,1,200,40Z" opacity="0.2"/><path d="M232,216H208V40a16,16,0,0,0-16-16H64A16,16,0,0,0,48,40V216H24a8,8,0,0,0,0,16H232a8,8,0,0,0,0-16ZM64,40H192V216H64Zm104,92a12,12,0,1,1-12-12A12,12,0,0,1,168,132Z"/></svg>`
- **glue** · ink `#5B4B8A` · soft `#ECE7F7`
  `<svg width="20" height="20" viewBox="0 0 256 256" fill="#5B4B8A" aria-hidden="true"><path d="M208,144a80,80,0,0,1-160,0c0-72,80-128,80-128S208,72,208,144Z" opacity="0.2"/><path d="M174,47.75a254.19,254.19,0,0,0-41.45-38.3,8,8,0,0,0-9.18,0A254.19,254.19,0,0,0,82,47.75C54.51,79.32,40,112.6,40,144a88,88,0,0,0,176,0C216,112.6,201.49,79.32,174,47.75ZM128,216a72.08,72.08,0,0,1-72-72c0-57.23,55.47-105,72-118,16.53,13,72,60.75,72,118A72.08,72.08,0,0,1,128,216Zm55.89-62.66a57.6,57.6,0,0,1-46.56,46.55A8.75,8.75,0,0,1,136,200a8,8,0,0,1-1.32-15.89c16.57-2.79,30.63-16.85,33.44-33.45a8,8,0,0,1,15.78,2.68Z"/></svg>`
- **tile** · ink `#0E5E57` · soft `#DDF1EE`
  `<svg width="20" height="20" viewBox="0 0 256 256" fill="#0E5E57" aria-hidden="true"><path d="M208,56V200a8,8,0,0,1-8,8H56a8,8,0,0,1-8-8V56a8,8,0,0,1,8-8H200A8,8,0,0,1,208,56Z" opacity="0.2"/><path d="M200,40H56A16,16,0,0,0,40,56V200a16,16,0,0,0,16,16H200a16,16,0,0,0,16-16V56A16,16,0,0,0,200,40Zm0,80H136V56h64ZM120,56v64H56V56ZM56,136h64v64H56Zm144,64H136V136h64v64Z"/></svg>`
- **tool** · ink `#8E2A22` · soft `#FBE5E2`
  `<svg width="20" height="20" viewBox="0 0 256 256" fill="#8E2A22" aria-hidden="true"><path d="M245.66,129,217,157.66a8,8,0,0,1-11.3,0L168.1,120l-28,28-32-32,28-28L80,31.78a87.81,87.81,0,0,1,98.31,18l67.35,67.89A8,8,0,0,1,245.66,129Z" opacity="0.2"/><path d="M251.34,112,183.88,44.08a96.1,96.1,0,0,0-135.77,0l-.09.09L34.25,58.4A8,8,0,0,0,45.74,69.53L59.47,55.35a79.92,79.92,0,0,1,18.71-13.9L124.68,88l-96,96a16,16,0,0,0,0,22.63l20.69,20.69a16,16,0,0,0,22.63,0l96-96,14.34,14.34h0L200,163.3a16,16,0,0,0,22.63,0l28.69-28.69A16,16,0,0,0,251.34,112ZM60.68,216,40,195.31l68-68L128.68,148ZM162.34,114.32,140,136.67,119.31,116l22.35-22.35a8,8,0,0,0,0-11.32L94.32,35a80,80,0,0,1,78.23,20.41l44.22,44.51L188,128.66l-14.34-14.34A8,8,0,0,0,162.34,114.32Zm49,37.66-12-12L228,111.25l12,12Z"/></svg>`
- **fallback** · ink `#5F6980` · soft `#EFECE6`
  `<svg width="20" height="20" viewBox="0 0 256 256" fill="#5F6980" aria-hidden="true"><path d="M128,129.09V232a8,8,0,0,1-3.84-1l-88-48.16a8,8,0,0,1-4.16-7V80.2a8,8,0,0,1,.7-3.27Z" opacity="0.2"/><path d="M223.68,66.15,135.68,18h0a15.88,15.88,0,0,0-15.36,0l-88,48.17a16,16,0,0,0-8.32,14v95.64a16,16,0,0,0,8.32,14l88,48.17a15.88,15.88,0,0,0,15.36,0l88-48.17a16,16,0,0,0,8.32-14V80.18A16,16,0,0,0,223.68,66.15ZM128,32h0l80.34,44L128,120,47.66,76ZM40,90l80,43.78v85.79L40,175.82Zm96,129.57V133.82L216,90v85.78Z"/></svg>`

---

## 3. Parts

Each part has its anatomy, its sizes and the snippet. Words in the snippets are Sales words (GLOSSARY.md). Numbers add up.

### P01 · Screen ground and gutters

Root: 360 × 800, `#F7F5F2`, Figtree, ink `#1C2233` (the file shell above). The body column under a head:

```html
<main style="padding: 18px 16px 100px; display: flex; flex-direction: column; gap: 10px">
  <!-- section header, card, section header, card … -->
</main>
```

- 16 px gutters. `gap: 10px` on Today and lists, `12px` on the order, `16px` between groups on a list page.
- Bottom padding 100 px with the tab bar, dock height + 16 with the dock. Nothing sits under the bar, the dock or the red +.
- A screen is filled to its bottom edge with real content (section 4.2).

### P02 · Today's navy hero

Anatomy, top to bottom: greeting with the date and Live, your avatar with its mint ring (opens You); the eyebrow with the month and the big money figure (opens Your day); the goal bar with its two labels (opens Goal); the glass row of two doors (optional). Padding `14px 20px 18px`, gap 16, bottom corners 28. Height at 360 with the glass row: 286 px; without it: 212 px.

The Sales hero shows what Grace **sold** this month, never earnings. The mint part of the bar is what is on the move (placed, not yet delivered): it would land inside the month.

```html
<header style="background: #16203C; border-radius: 0 0 28px 28px; padding: 14px 20px 18px; display: flex; flex-direction: column; gap: 16px; color: #FFFFFF">
  <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px">
    <div style="display: flex; flex-direction: column; gap: 3px; min-width: 0">
      <span style="font-size: 20px; font-weight: 700; letter-spacing: -.01em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">Good morning, Grace</span>
      <span style="display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 600; color: #B3BCD2">Sat 17 Oct<span aria-hidden="true" style="width: 3px; height: 3px; border-radius: 999px; background: #5F6A85"></span><span style="display: flex; align-items: center; gap: 5px; color: #6FDCB0"><span aria-hidden="true" style="width: 7px; height: 7px; border-radius: 999px; background: #6FDCB0; animation: owPulse 2s infinite"></span>Live</span></span>
    </div>
    <a href="TD18You.dc.html" aria-label="You: your account and this phone" style="width: 46px; height: 46px; flex: none; border-radius: 999px; background: #243052; box-shadow: 0 0 0 2px #16203C, 0 0 0 4px rgba(111,220,176,.55); color: #FFFFFF; font-size: 15px; font-weight: 700; display: flex; align-items: center; justify-content: center">GA</a>
  </div>
  <a href="TD16DaySold.dc.html" aria-label="Sold in October: 12,480,000. Open your day." style="display: flex; flex-direction: column; gap: 6px; min-height: 44px">
    <span style="display: flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: #B3BCD2">Sold · October<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="opacity:.7"><path d="m9 6 6 6-6 6"/></svg></span>
    <span style="display: flex; align-items: baseline; gap: 8px"><span style="font-size: 14px; font-weight: 700; color: #8D99B5">UGX</span><span style="font-family: 'IBM Plex Mono', monospace; font-variant-numeric: tabular-nums; font-size: 38px; font-weight: 600; letter-spacing: -.04em; line-height: 1">12,480,000</span></span>
  </a>
  <a href="TD15Goal.dc.html" aria-label="Goal: 36 percent of 35 million, 14 days left" style="display: flex; flex-direction: column; gap: 9px; min-height: 44px; justify-content: center">
    <span aria-hidden="true" style="display: flex; height: 8px; border-radius: 999px; background: rgba(255,255,255,.12); overflow: hidden"><span style="display: block; width: 36%; min-width: 8px; height: 100%; border-radius: 999px; background: #FFFFFF"></span><span style="display: block; width: 9%; height: 100%; border-radius: 0 999px 999px 0; background: rgba(111,220,176,.45)"></span></span>
    <span style="display: flex; justify-content: space-between; align-items: center; gap: 10px; font-size: 13px; font-weight: 600; color: #B3BCD2"><span><b style="font-family: 'IBM Plex Mono', monospace; font-weight: 600; color: #FFFFFF">36%</b> of your <span style="font-family: 'IBM Plex Mono', monospace">35M</span> goal</span><span style="display: flex; align-items: center; gap: 5px">14 days left<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="opacity:.7"><path d="m9 6 6 6-6 6"/></svg></span></span>
  </a>
  <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); border-radius: 18px; background: rgba(255,255,255,.06); box-shadow: inset 0 0 0 1px rgba(255,255,255,.06); overflow: hidden">
    <a href="OR01Orders.dc.html" style="min-height: 56px; padding: 10px 12px 10px 14px; display: flex; align-items: center; gap: 10px; min-width: 0">
      <span style="width: 36px; height: 36px; flex: none; border-radius: 12px; background: rgba(111,220,176,.14); color: #6FDCB0; display: flex; align-items: center; justify-content: center"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 17 6-6 4 4 8-8M15 7h6v6"/></svg></span>
      <span style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px"><span style="font-family: 'IBM Plex Mono', monospace; font-size: 16px; font-weight: 600; color: #6FDCB0">+3.2M</span><span style="font-size: 11px; font-weight: 600; color: #B3BCD2; white-space: nowrap">on the move</span></span>
      <span style="display: flex; color: #5F6A85"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg></span>
    </a>
    <a href="TD05ToCollect.dc.html" style="min-height: 56px; padding: 10px 12px 10px 14px; display: flex; align-items: center; gap: 10px; min-width: 0; border-left: 1px solid rgba(255,255,255,.08)">
      <span style="width: 36px; height: 36px; flex: none; border-radius: 12px; background: rgba(245,178,107,.14); color: #F5B26B; display: flex; align-items: center; justify-content: center"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2.5" y="6" width="19" height="12" rx="2"/><circle cx="12" cy="12" r="2.6"/><path d="M6 12h.01M18 12h.01"/></svg></span>
      <span style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px"><span style="font-family: 'IBM Plex Mono', monospace; font-size: 16px; font-weight: 600; color: #F5B26B">1.9M</span><span style="font-size: 11px; font-weight: 600; color: #B3BCD2; white-space: nowrap">to collect</span></span>
      <span style="display: flex; color: #5F6A85"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg></span>
    </a>
  </div>
</header>
```

States: **Updating** replaces Live with `#F5B26B` dot and words "Updating · saved 7:52"; **Not sent yet** see P27. **Goal hit**: the bar fills white to 100% with a mint over-run segment and the left label becomes `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M9 20h6"/></svg> Goal hit · +1.2M over` in `#6FDCB0`. **No goal yet**: the bar is replaced by `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5.5 21V3.5M5.5 4.5h11l-2 3.5 2 3.5h-11"/></svg> Ruth sets your goal` in `#B3BCD2` (the Manager sets goals).

### P02b · The goal ring (Goal sheet, Your day, Goal hit)

The ring is the goal at a glance where the goal is the subject. 120 px, track 10 px `rgba(255,255,255,.08)`, done arc white with round caps, on-the-move arc `#6FDCB0` at 40% opacity after it, inner disc `rgba(255,255,255,.04)`. Circumference at r 50 is 314.2.

```html
<a href="TD15Goal.dc.html" aria-label="Goal: 36 percent, 14 days left" style="position: relative; width: 120px; height: 120px; flex: none; display: block; color: #FFFFFF">
  <svg width="120" height="120" viewBox="0 0 120 120" aria-hidden="true">
    <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="10"></circle>
    <circle cx="60" cy="60" r="50" fill="none" stroke="#6FDCB0" stroke-opacity=".4" stroke-width="10" stroke-dasharray="28.3 314.2" stroke-dashoffset="-113.1" transform="rotate(-90 60 60)"></circle>
    <circle cx="60" cy="60" r="50" fill="none" stroke="#FFFFFF" stroke-width="10" stroke-linecap="round" stroke-dasharray="113.1 314.2" transform="rotate(-90 60 60)"></circle>
    <circle cx="60" cy="60" r="38" fill="rgba(255,255,255,.04)"></circle>
  </svg>
  <span style="position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px"><span style="font-family: 'IBM Plex Mono', monospace; font-size: 26px; font-weight: 600; letter-spacing: -.04em; line-height: 1">36%</span><span style="font-size: 11px; font-weight: 600; color: #B3BCD2">of goal</span></span>
</a>
```

Goal hit: the done arc becomes `#6FDCB0` full circle, the centre a 64 px disc `rgba(111,220,176,.16)` holding `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#6FDCB0" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M9 20h6"/></svg>` and "Goal hit" 13/700 mint.

### P03 · A page head (a tab's root: Chats, Orders, Customers)

As built: OR01Orders (stage bar), CU01Customers (owed bar), CU03CustomersDue (week strip).

The radial navy head, 26/800 title with its mono count in mint, glass icon buttons and one white add button, then one line of the page's picture (a stat, a bar or a week strip), then the search field on navy. Padding `18px 16px 18px`, gap 16, bottom corners 28.

```html
<header style="background: radial-gradient(120% 90% at 100% 0%, #243A6B 0%, #16203C 60%); color: #FFFFFF; padding: 18px 16px 18px; border-radius: 0 0 28px 28px; display: flex; flex-direction: column; gap: 16px; box-shadow: 0 10px 30px rgba(22,32,60,.18)">
  <div style="display: flex; align-items: center; gap: 10px">
    <h1 style="flex: 1; margin: 0; display: flex; align-items: baseline; gap: 8px; font-size: 26px; font-weight: 800; letter-spacing: -.02em">Customers<span style="font-family: 'IBM Plex Mono', monospace; font-variant-numeric: tabular-nums; font-size: 16px; font-weight: 600; color: #6FDCB0">38</span></h1>
    <a href="CU01Customers.dc.html" aria-label="Share the shop's price list" style="width: 44px; height: 44px; flex: none; border-radius: 999px; background: rgba(255,255,255,.10); color: #FFFFFF; display: flex; align-items: center; justify-content: center"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15V3M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/></svg></a>
    <a href="CU20NewCustomer.dc.html" aria-label="New customer" style="width: 44px; height: 44px; flex: none; border-radius: 999px; background: #FFFFFF; color: #16203C; display: flex; align-items: center; justify-content: center; box-shadow: 0 6px 16px rgba(0,0,0,.25)"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="10" cy="8" r="4"/><path d="M3 21c0-3.9 3.1-7 7-7 1.4 0 2.7.4 3.8 1.1M18 14v6M15 17h6"/></svg></a>
  </div>
  <!-- the page's one picture: P03a, P03b or P03c -->
  <label style="display: flex; align-items: center; gap: 10px; height: 46px; padding: 0 14px; border-radius: 14px; background: rgba(255,255,255,.08); box-shadow: inset 0 0 0 1px rgba(255,255,255,.10)"><svg width="19" height="19" viewBox="0 0 256 256" fill="#B3BCD2" aria-hidden="true"><path d="M192,112a80,80,0,1,1-80-80A80,80,0,0,1,192,112Z" opacity="0.2"/><path d="M229.66,218.34,179.6,168.28a88.21,88.21,0,1,0-11.32,11.31l50.06,50.07a8,8,0,0,0,11.32-11.32ZM40,112a72,72,0,1,1,72,72A72.08,72.08,0,0,1,40,112Z"/></svg><input type="search" placeholder="Name, phone or place" aria-label="Find a customer" style="flex: 1; min-width: 0; border: none; outline: none; background: transparent; font-family: inherit; font-size: 15px; color: #FFFFFF"></label>
</header>
```

The placeholder text colour on navy is `#8D99B5`; a literal mock shows it as a `<span>` in that colour inside the label instead of an empty input when the canvas needs it visible.

**P03a · the stat line** (Customers: what is owed):

```html
<div style="display: flex; align-items: flex-end; justify-content: space-between; gap: 12px">
  <span style="display: flex; flex-direction: column; gap: 4px"><span style="font-size: 12px; font-weight: 600; color: #B3BCD2">Owed to the shop · your customers</span>
    <span style="display: flex; align-items: baseline; gap: 6px"><span style="font-size: 12px; font-weight: 700; color: #8D99B5">UGX</span><span style="font-family: 'IBM Plex Mono', monospace; font-variant-numeric: tabular-nums; font-size: 28px; font-weight: 600; letter-spacing: -.01em; line-height: 1">1,910,000</span></span></span>
  <span style="padding: 3px 8px; border-radius: 999px; background: rgba(245,178,107,.16); color: #F5B26B; font-size: 12px; font-weight: 700">4 owe</span>
</div>
```

**P03b · the stage bar** (Orders: how many at each stage, as one segmented bar with a legend). Segment widths are the counts.

```html
<div style="display: flex; flex-direction: column; gap: 8px" role="img" aria-label="20 orders: 3 checking, 2 buying, 4 packing, 3 on the road, 8 delivered this week">
  <span style="display: flex; gap: 3px; height: 8px"><span style="flex: 3; border-radius: 999px; background: #F5B26B"></span><span style="flex: 2; border-radius: 999px; background: #9DB7E0"></span><span style="flex: 4; border-radius: 999px; background: #7FA2D6"></span><span style="flex: 3; border-radius: 999px; background: #6FDCB0"></span><span style="flex: 8; border-radius: 999px; background: rgba(255,255,255,.22)"></span></span>
  <span style="display: flex; justify-content: space-between; gap: 6px; font-size: 11px; font-weight: 700; color: #B3BCD2"><span style="color: #F5B26B">3 checking</span><span>2 buying</span><span>4 packing</span><span style="color: #6FDCB0">3 road</span><span>8 done</span></span>
</div>
```

(In the legend "road" is the short of "On the road" only where width forces it; anywhere else write the stage in full.)

**P03c · the week strip** (Customers: who is due, the week ahead). Copy the agent's seven columns: each 74 px box `rgba(255,255,255,.06)`, radius 14, the count in mono 17/600 at the top, the face dots (12 px, tinted, `box-shadow: 0 0 0 2px #16203C`, overlap -4 px) at the bottom, the day name 11/700 `#8D99B5` under it. Late column: box `rgba(240,138,126,.16)` with `inset 0 0 0 1px rgba(240,138,126,.35)`, text `#F7A196`. Today column: `rgba(245,178,107,.16)` with `inset 0 0 0 1.5px #F5B26B`, text `#F5B26B`. Selected day: box `#FFFFFF`, count `#16203C`. An empty day shows "·" at `rgba(255,255,255,.28)`. Each column is a `<button type="button">` with `aria-label="Today: 2 due"`.

### P04 · The compact navy head of a pushed screen (one order, one customer, one chat)

Everything about **one** thing comes up as a full sheet over the screen it came from. The 40 px strip above it is the screen behind under the scrim (drawn `#2A3350`) and is itself the way back. The sheet is `#F7F5F2` with top corners 26; its navy top holds the grabber, the head row, and then the thing's picture (the track P17, the money split, the chat's order chip).

```html
<div style="width: 360px; height: 800px; position: relative; overflow: hidden; background: #2A3350; font-family: Figtree, system-ui, sans-serif; color: #1C2233">
  <a href="OR01Orders.dc.html" aria-label="Back to Orders" style="position: absolute; inset: 0 0 auto 0; height: 40px; display: block"></a>
  <div style="position: absolute; left: 0; right: 0; bottom: 0; top: 40px; background: #F7F5F2; border-radius: 26px 26px 0 0; overflow: hidden; display: flex; flex-direction: column">
    <div style="background: #16203C; color: #FFFFFF; padding: 10px 20px 20px; display: flex; flex-direction: column; gap: 16px">
      <span aria-hidden="true" style="align-self: center; width: 40px; height: 5px; border-radius: 999px; background: rgba(255,255,255,.22)"></span>
      <div style="display: flex; align-items: center; gap: 12px">
        <span aria-hidden="true" style="width: 44px; height: 44px; flex: none; border-radius: 999px; background: #DCEAF8; color: #1A5A8A; font-size: 15px; font-weight: 700; display: flex; align-items: center; justify-content: center">KC</span>
        <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px">
          <span style="font-size: 16px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">Kato Construction</span>
          <span style="font-family: 'IBM Plex Mono', monospace; font-variant-numeric: tabular-nums; font-size: 12px; color: #B3BCD2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">#0552 · today 9:14</span>
        </div>
        <a href="tel:0772418220" aria-label="Call Kato Construction" style="width: 44px; height: 44px; flex: none; border-radius: 999px; background: rgba(111,220,176,.14); color: #6FDCB0; display: flex; align-items: center; justify-content: center"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/></svg></a>
        <a href="OR01Orders.dc.html" aria-label="Close" style="width: 44px; height: 44px; flex: none; border-radius: 999px; background: rgba(255,255,255,.08); color: #FFFFFF; display: flex; align-items: center; justify-content: center"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></a>
      </div>
      <!-- the picture: P17 track, or the money split S06, or a one-line strip -->
    </div>
    <div style="padding: 14px 16px 18px; display: flex; flex-direction: column; gap: 10px; flex: 1">
      <!-- cards; the last group sits at the bottom with margin-top: auto -->
    </div>
  </div>
</div>
```

The agent's head pill reads "Shop" with a phone; Sales calls the **customer**, so the pill is the round mint Call button above (44 px, never under). A sheet that is about one customer puts their usual cadence or what they owe as the sub-line instead of the order number.

### P05 · The light top bar while building an order

Row 1: the × circle (44, white, hairline), the **who pill** (flex 1, 52 tall), the **basket chip** for each other order still open (52 tall, avatar with an amber ring, the duotone basket, an amber count). Row 2: search (48 tall, radius 14) with the mic, and the aisles button (48 square). Padding `14px 16px 0`, gap 12 (rows), 8 (items).

Empty who pill (no customer yet): dashed `1.5px #5F6980`, transparent, person icon, "Who is it for?". Filled: white with `lift` shadow, avatar 38, name 15/700, a sub-line 12/600 with a tone dot (`#0F6B43` regular) or a spark ("New customer").

```html
<div style="padding: 14px 16px 0; display: flex; flex-direction: column; gap: 12px">
  <div style="display: flex; align-items: center; gap: 8px">
    <a href="TD01Today.dc.html" aria-label="Close the order" style="width: 44px; height: 44px; flex: none; border-radius: 999px; background: #FFFFFF; box-shadow: inset 0 0 0 1px #E6E3DD; color: #1C2233; display: flex; align-items: center; justify-content: center"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></a>
    <a href="SL01Who.dc.html" style="flex: 1; min-width: 0; height: 52px; border-radius: 16px; border: 1.5px dashed #5F6980; box-sizing: border-box; display: flex; align-items: center; gap: 10px; padding: 0 12px 0 14px; color: #1C2233"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/></svg><span style="flex: 1; min-width: 0; font-size: 15px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">Who is it for?</span><svg width="18" height="18" viewBox="0 0 256 256" fill="#5F6980" aria-hidden="true"><path d="M184.49,167.51a12,12,0,0,1,0,17l-48,48a12,12,0,0,1-17,0l-48-48a12,12,0,0,1,17-17L128,207l39.51-39.52A12,12,0,0,1,184.49,167.51Zm-96-79L128,49l39.51,39.52a12,12,0,0,0,17-17l-48-48a12,12,0,0,0-17,0l-48,48a12,12,0,0,0,17,17Z"/></svg></a>
    <button type="button" aria-label="Open order for Kyaligonza and Sons, 2 items" style="border: none; padding: 0; font-family: inherit; position: relative; height: 52px; flex: none; padding: 0 10px 0 7px; border-radius: 16px; background: #FFFFFF; box-shadow: 0 1px 2px rgba(22,32,60,.05), inset 0 0 0 1px #E6E3DD; display: flex; align-items: center; gap: 6px">
      <span aria-hidden="true" style="width: 34px; height: 34px; border-radius: 999px; background: #F6E4F1; color: #7A3268; font-size: 12px; font-weight: 700; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 0 2px #FFFFFF, 0 0 0 3.5px #95530C">KS</span>
      <svg width="18" height="18" viewBox="0 0 256 256" fill="#5F6980" aria-hidden="true"><path d="M232,88,216.93,201.06A8,8,0,0,1,209,208H47a8,8,0,0,1-7.93-6.94L24,88Z" opacity="0.2"/><path d="M136,120v56a8,8,0,0,1-16,0V120a8,8,0,0,1,16,0Zm36.84-.8-5.6,56A8,8,0,0,0,174.4,184a7.32,7.32,0,0,0,.81,0,8,8,0,0,0,7.95-7.2l5.6-56a8,8,0,0,0-15.92-1.6Zm-89.68,0a8,8,0,0,0-15.92,1.6l5.6,56a8,8,0,0,0,8,7.2,7.32,7.32,0,0,0,.81,0,8,8,0,0,0,7.16-8.76ZM239.93,89.06,224.86,202.12A16.06,16.06,0,0,1,209,216H47a16.06,16.06,0,0,1-15.86-13.88L16.07,89.06A8,8,0,0,1,24,80H68.37L122,18.73a8,8,0,0,1,12,0L187.63,80H232a8,8,0,0,1,7.93,9.06ZM89.63,80h76.74L128,36.15ZM222.86,96H33.14L47,200H209Z"/></svg>
      <span aria-hidden="true" style="position: absolute; top: -5px; right: -5px; min-width: 20px; height: 20px; padding: 0 5px; box-sizing: border-box; border-radius: 999px; background: #95530C; color: #FFFFFF; font-family: 'IBM Plex Mono', monospace; font-size: 11px; font-weight: 600; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 0 2px #F7F5F2">2</span>
    </button>
  </div>
  <div style="display: flex; gap: 8px">
    <label style="flex: 1; min-width: 0; display: flex; align-items: center; gap: 10px; height: 48px; padding: 0 6px 0 14px; border-radius: 14px; background: #FFFFFF; box-shadow: 0 1px 2px rgba(22,32,60,.05), inset 0 0 0 1px #E6E3DD"><svg width="20" height="20" viewBox="0 0 256 256" fill="#1C2233" aria-hidden="true"><path d="M192,112a80,80,0,1,1-80-80A80,80,0,0,1,192,112Z" opacity="0.2"/><path d="M229.66,218.34,179.6,168.28a88.21,88.21,0,1,0-11.32,11.31l50.06,50.07a8,8,0,0,0,11.32-11.32ZM40,112a72,72,0,1,1,72,72A72.08,72.08,0,0,1,40,112Z"/></svg><input type="search" placeholder="Add an item" aria-label="Add an item: type its name" style="flex: 1; min-width: 0; height: 100%; border: none; outline: none; background: transparent; font-family: inherit; font-size: 16px; color: #1C2233"><button type="button" aria-label="Say it" style="width: 36px; height: 36px; flex: none; border: none; padding: 0; border-radius: 999px; background: #16203C; color: #FFFFFF; display: flex; align-items: center; justify-content: center"><svg width="18" height="18" viewBox="0 0 256 256" fill="#FFFFFF" aria-hidden="true"><path d="M80,128V64a48,48,0,0,1,96,0v64a48,48,0,0,1-96,0Zm128,0a8,8,0,0,0-16,0,64,64,0,0,1-128,0,8,8,0,0,0-16,0,80.11,80.11,0,0,0,72,79.6V240a8,8,0,0,0,16,0V207.6A80.11,80.11,0,0,0,208,128Z"/></svg></button></label>
    <a href="SL11Aisles.dc.html" aria-label="Browse the aisles" style="width: 48px; height: 48px; flex: none; border-radius: 14px; background: #FFFFFF; box-shadow: 0 1px 2px rgba(22,32,60,.05), inset 0 0 0 1px #E6E3DD; display: flex; align-items: center; justify-content: center"><svg width="22" height="22" viewBox="0 0 256 256" fill="#1C2233" aria-hidden="true"><path d="M112,56v48a8,8,0,0,1-8,8H56a8,8,0,0,1-8-8V56a8,8,0,0,1,8-8h48A8,8,0,0,1,112,56Zm88-8H152a8,8,0,0,0-8,8v48a8,8,0,0,0,8,8h48a8,8,0,0,0,8-8V56A8,8,0,0,0,200,48Zm-96,96H56a8,8,0,0,0-8,8v48a8,8,0,0,0,8,8h48a8,8,0,0,0,8-8V152A8,8,0,0,0,104,144Zm96,0H152a8,8,0,0,0-8,8v48a8,8,0,0,0,8,8h48a8,8,0,0,0,8-8V152A8,8,0,0,0,200,144Z" opacity="0.2"/><path d="M200,136H152a16,16,0,0,0-16,16v48a16,16,0,0,0,16,16h48a16,16,0,0,0,16-16V152A16,16,0,0,0,200,136Zm0,64H152V152h48v48ZM104,40H56A16,16,0,0,0,40,56v48a16,16,0,0,0,16,16h48a16,16,0,0,0,16-16V56A16,16,0,0,0,104,40Zm0,64H56V56h48v48Zm96-64H152a16,16,0,0,0-16,16v48a16,16,0,0,0,16,16h48a16,16,0,0,0,16-16V56A16,16,0,0,0,200,40Zm0,64H152V56h48v48Zm-96,32H56a16,16,0,0,0-16,16v48a16,16,0,0,0,16,16h48a16,16,0,0,0,16-16V152A16,16,0,0,0,104,136Zm0,64H56V152h48v48Z"/></svg></a>
  </div>
</div>
```

The mic disc is 36 visible inside a 48 px field (the field is the target around it). Placeholder colour `#6B7480`. Focused field: `border: 1.5px solid #16203C; box-shadow: 0 0 0 4px rgba(22,32,60,.08)`, and the mic gives way to a 40 px `#F1EEE8` clear button with `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#5F6980" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>`.

The filled who pill:

```html
<a href="SL01Who.dc.html" aria-label="Kato Construction. Change customer" style="flex: 1; min-width: 0; height: 52px; border-radius: 16px; background: #FFFFFF; box-shadow: 0 1px 2px rgba(22,32,60,.05), 0 6px 16px rgba(22,32,60,.06), inset 0 0 0 1px #E6E3DD; display: flex; align-items: center; gap: 10px; padding: 0 12px 0 7px; color: #1C2233">
  <span aria-hidden="true" style="width: 38px; height: 38px; flex: none; border-radius: 999px; background: #DCEAF8; color: #1A5A8A; font-size: 13px; font-weight: 700; display: flex; align-items: center; justify-content: center">KC</span>
  <span style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px"><span style="font-size: 15px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">Kato Construction</span><span style="display: flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 600; color: #5F6980; white-space: nowrap; overflow: hidden"><span aria-hidden="true" style="width: 6px; height: 6px; flex: none; border-radius: 999px; background: #0F6B43"></span>Every 10 days · owes 420k</span></span>
  <svg width="18" height="18" viewBox="0 0 256 256" fill="#5F6980" aria-hidden="true"><path d="M184.49,167.51a12,12,0,0,1,0,17l-48,48a12,12,0,0,1-17,0l-48-48a12,12,0,0,1,17-17L128,207l39.51-39.52A12,12,0,0,1,184.49,167.51Zm-96-79L128,49l39.51,39.52a12,12,0,0,0,17-17l-48-48a12,12,0,0,0-17,0l-48,48a12,12,0,0,0,17,17Z"/></svg>
</a>
```

### P06 · Section header

Title 17/700 left, meta right (mono 13 `#5F6980`, or a pill, or a dark Play-all pill). `padding: 0 4px`; after a card `padding: 6px 4px 0`.

```html
<div style="display: flex; align-items: baseline; justify-content: space-between; gap: 10px; padding: 0 4px">
  <h2 style="margin: 0; font-size: 17px; font-weight: 700">On the move</h2>
  <span style="font-family: 'IBM Plex Mono', monospace; font-variant-numeric: tabular-nums; font-size: 13px; color: #5F6980">12 live · 8 done</span>
</div>
```

"Needs you" carries an 8 px `#8E2A22` dot before it and the count after it:

```html
<div style="display: flex; align-items: center; gap: 8px; padding: 6px 4px 0">
  <span aria-hidden="true" style="width: 8px; height: 8px; flex: none; border-radius: 999px; background: #8E2A22"></span>
  <h2 style="flex: 1; margin: 0; font-size: 17px; font-weight: 700">Needs you</h2>
  <span style="font-family: 'IBM Plex Mono', monospace; font-size: 13px; font-weight: 600; color: #5F6980">7</span>
</div>
```

The Play-all pill (right of "Next move"): navy pill 36 visible, a 44 px target via 4 px padding on its link.

```html
<a href="TD03TodayNext.dc.html" aria-label="Play all 4, 6.1 million" style="padding: 4px 0; display: flex">
  <span style="height: 36px; padding: 0 12px 0 7px; border-radius: 999px; background: #16203C; color: #FFFFFF; display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 700; white-space: nowrap"><span aria-hidden="true" style="width: 22px; height: 22px; border-radius: 999px; background: #6FDCB0; display: flex; align-items: center; justify-content: center"><svg width="10" height="10" viewBox="0 0 256 256" fill="#16203C" aria-hidden="true"><path d="M240,128a15.74,15.74,0,0,1-7.6,13.51L88.32,229.65a16,16,0,0,1-16.2.3A15.86,15.86,0,0,1,64,216.13V39.87a15.86,15.86,0,0,1,8.12-13.82,16,16,0,0,1,16.2.3L232.4,114.49A15.74,15.74,0,0,1,240,128Z"/></svg></span>Play all 4<b style="font-family: 'IBM Plex Mono', monospace; font-size: 12px; font-weight: 600; color: #6FDCB0">6.1M</b></span>
</a>
```

A list group's header inside a page (14/700, a 10 px tone dot, a mono count, a sum at the right):

```html
<div style="display: flex; align-items: center; gap: 8px; min-height: 32px; padding: 0 2px">
  <span aria-hidden="true" style="width: 10px; height: 10px; flex: none; border-radius: 999px; background: #F5B26B"></span>
  <span style="font-size: 14px; font-weight: 700">Checking</span>
  <span style="flex: 1; font-family: 'IBM Plex Mono', monospace; font-size: 12px; font-weight: 600; color: #5F6980">3</span>
  <span style="font-family: 'IBM Plex Mono', monospace; font-size: 13px; font-weight: 600">542,000</span>
</div>
```

### P07 · "On the move" stage tiles

A white card (`hair`, radius 16, padding 10, gap 6) holding a 4-up grid of tiles (gap 6), then act rows for the orders that wait on Grace. Tile: 92 tall, radius 12, `#F7F5F2`; the stage icon (15, stroke 1.9) beside the count (mono 18/600); the label 11/600 `#5F6980`; a face stack of up to 3 (24 px, 11/700, border 2px `#F7F5F2`, overlap -6, "+n" in mono 11 `#5F6980`).

Marks, top right: a **dot** (8 px at 7/7) says the stage holds something of a kind: `#95530C` money to take, `#0F6B43` ready, `#8E2A22` late. A **need badge** (22 px at -6/-6, mono 11/600 white, ring `0 0 0 2px #FFFFFF`) says how many of them need Grace, in the same tone. A **zero** tile has no faces and its count in `#5F6980`.

The Sales stages on Today are the four live ones: **Checking · Buying · Packing · On the road**. Delivered is counted in the header meta ("8 done"). Orders not placed yet are counted on the red +'s badge, not here.

```html
<div style="background: #FFFFFF; border-radius: 16px; box-shadow: 0 1px 2px rgba(22,32,60,.05), inset 0 0 0 1px #E6E3DD; padding: 10px; display: flex; flex-direction: column; gap: 6px">
  <div style="display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px">
    <a href="OR01Orders.dc.html" aria-label="3 checking, 1 needs you" style="position: relative; height: 92px; border-radius: 12px; background: #F7F5F2; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; color: #1C2233">
      <span aria-hidden="true" style="position: absolute; top: -6px; right: -6px; min-width: 22px; height: 22px; padding: 0 6px; box-sizing: border-box; border-radius: 999px; background: #95530C; color: #FFFFFF; font-family: 'IBM Plex Mono', monospace; font-size: 11px; font-weight: 600; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 0 2px #FFFFFF">1</span>
      <span style="display: flex; align-items: center; gap: 5px"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 4h6v3H9zM7 5.5H5V21h14V5.5h-2M9 14l2 2 4-4"/></svg><span style="font-family: 'IBM Plex Mono', monospace; font-size: 18px; font-weight: 600">3</span></span>
      <span style="font-size: 11px; font-weight: 600; color: #5F6980">Checking</span>
      <span aria-hidden="true" style="display: flex"><span style="width: 24px; height: 24px; box-sizing: border-box; border-radius: 999px; border: 2px solid #F7F5F2; background: #DCEAF8; color: #1A5A8A; font-size: 11px; font-weight: 700; letter-spacing: -.04em; display: flex; align-items: center; justify-content: center">KC</span><span style="width: 24px; height: 24px; box-sizing: border-box; border-radius: 999px; border: 2px solid #F7F5F2; background: #E4E6FA; color: #3A3F9B; font-size: 11px; font-weight: 700; letter-spacing: -.04em; display: flex; align-items: center; justify-content: center; margin-left: -6px">MR</span><span style="width: 24px; height: 24px; box-sizing: border-box; border-radius: 999px; border: 2px solid #F7F5F2; background: #E8EBF0; color: #3D4A5C; font-size: 11px; font-weight: 700; letter-spacing: -.04em; display: flex; align-items: center; justify-content: center; margin-left: -6px">WI</span></span>
    </a>
    <a href="OR01Orders.dc.html" aria-label="2 buying" style="position: relative; height: 92px; border-radius: 12px; background: #F7F5F2; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; color: #1C2233">
      <span style="display: flex; align-items: center; gap: 5px"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 4h2.5l2.2 11h10.6l2-8H6.3"/><circle cx="9" cy="19" r="1.5"/><circle cx="17" cy="19" r="1.5"/></svg><span style="font-family: 'IBM Plex Mono', monospace; font-size: 18px; font-weight: 600">2</span></span>
      <span style="font-size: 11px; font-weight: 600; color: #5F6980">Buying</span>
      <span aria-hidden="true" style="display: flex"><span style="width: 24px; height: 24px; box-sizing: border-box; border-radius: 999px; border: 2px solid #F7F5F2; background: #E8EBF0; color: #3D4A5C; font-size: 11px; font-weight: 700; letter-spacing: -.04em; display: flex; align-items: center; justify-content: center">GS</span><span style="width: 24px; height: 24px; box-sizing: border-box; border-radius: 999px; border: 2px solid #F7F5F2; background: #DDF1EE; color: #0E5E57; font-size: 11px; font-weight: 700; letter-spacing: -.04em; display: flex; align-items: center; justify-content: center; margin-left: -6px">LB</span></span>
    </a>
    <a href="OR01Orders.dc.html" aria-label="4 packing, 1 late" style="position: relative; height: 92px; border-radius: 12px; background: #F7F5F2; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; color: #1C2233">
      <span aria-hidden="true" style="position: absolute; top: 7px; right: 7px; width: 8px; height: 8px; border-radius: 999px; background: #8E2A22"></span>
      <span style="display: flex; align-items: center; gap: 5px"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5zM3.5 7.5 12 12l8.5-4.5M12 12v9"/></svg><span style="font-family: 'IBM Plex Mono', monospace; font-size: 18px; font-weight: 600">4</span></span>
      <span style="font-size: 11px; font-weight: 600; color: #5F6980">Packing</span>
      <span aria-hidden="true" style="display: flex; align-items: center"><span style="width: 24px; height: 24px; box-sizing: border-box; border-radius: 999px; border: 2px solid #F7F5F2; background: #F6E4F1; color: #7A3268; font-size: 11px; font-weight: 700; letter-spacing: -.04em; display: flex; align-items: center; justify-content: center">KS</span><span style="width: 24px; height: 24px; box-sizing: border-box; border-radius: 999px; border: 2px solid #F7F5F2; background: #FDEEE1; color: #7A4A02; font-size: 11px; font-weight: 700; letter-spacing: -.04em; display: flex; align-items: center; justify-content: center; margin-left: -6px">NH</span><span style="margin-left: 3px; font-family: 'IBM Plex Mono', monospace; font-size: 11px; font-weight: 600; color: #5F6980">+2</span></span>
    </a>
    <a href="OR01Orders.dc.html" aria-label="3 on the road, 1 ready to collect" style="position: relative; height: 92px; border-radius: 12px; background: #F7F5F2; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; color: #1C2233">
      <span aria-hidden="true" style="position: absolute; top: 7px; right: 7px; width: 8px; height: 8px; border-radius: 999px; background: #0F6B43"></span>
      <span style="display: flex; align-items: center; gap: 5px"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h11v10H3zM14 9h4l3 3v4h-7"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/></svg><span style="font-family: 'IBM Plex Mono', monospace; font-size: 18px; font-weight: 600">3</span></span>
      <span style="font-size: 11px; font-weight: 600; color: #5F6980">On the road</span>
      <span aria-hidden="true" style="display: flex"><span style="width: 24px; height: 24px; box-sizing: border-box; border-radius: 999px; border: 2px solid #F7F5F2; background: #DCEAF8; color: #1A5A8A; font-size: 11px; font-weight: 700; letter-spacing: -.04em; display: flex; align-items: center; justify-content: center">KC</span><span style="width: 24px; height: 24px; box-sizing: border-box; border-radius: 999px; border: 2px solid #F7F5F2; background: #E8EBF0; color: #3D4A5C; font-size: 11px; font-weight: 700; letter-spacing: -.04em; display: flex; align-items: center; justify-content: center; margin-left: -6px">GS</span><span style="width: 24px; height: 24px; box-sizing: border-box; border-radius: 999px; border: 2px solid #F7F5F2; background: #E8EBF0; color: #3D4A5C; font-size: 11px; font-weight: 700; letter-spacing: -.04em; display: flex; align-items: center; justify-content: center; margin-left: -6px">WI</span></span>
    </a>
  </div>
  <a href="SL30Mukono.dc.html" style="display: flex; align-items: center; gap: 10px; min-height: 48px; padding: 0 2px">
    <span aria-hidden="true" style="width: 32px; height: 32px; flex: none; border-radius: 999px; background: #E4E6FA; color: #3A3F9B; font-size: 12px; font-weight: 700; display: flex; align-items: center; justify-content: center">MR</span>
    <span style="flex: 1; min-width: 0; font-size: 14px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">Mukono Roofing</span>
    <span style="flex: none; display: flex; align-items: center; gap: 5px; height: 32px; padding: 0 12px; border-radius: 999px; background: #FDEEE1; color: #7A4A02; font-size: 13px; font-weight: 700">Take <span style="font-family: 'IBM Plex Mono', monospace; font-weight: 600">1.1M</span></span>
    <span aria-hidden="true" style="display: flex; color: #9AA1AE"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg></span>
  </a>
</div>
```

The dashed tile (the agent's Basket) is kept for one Sales use only: an empty stage that is coming (the empty state, P24). Dashed: `background: transparent; border: 1.5px dashed #C9C4BA; box-sizing: border-box`.

### P08 · The "Needs you" row

One row per **kind** of job, never per order: a 38 px icon tile (radius 12, tone soft, duotone icon 20 in the tone), the title 14/700, a mono subline 11 `#6B7480`, the count mono 18/600 in the tone, and a dark pill (36 tall, navy, 13/700) naming the act. The whole row is the link (min-height 60), so the pill is not a separate target.

```html
<a href="OR01Orders.dc.html" style="display: flex; align-items: center; gap: 12px; min-height: 60px; padding: 0 8px 0 10px; border-radius: 16px; background: #FFFFFF; box-shadow: 0 1px 2px rgba(22,32,60,.05), inset 0 0 0 1px #E6E3DD; color: #1C2233">
  <span aria-hidden="true" style="width: 38px; height: 38px; flex: none; border-radius: 12px; background: #FBE5E2; color: #8E2A22; display: flex; align-items: center; justify-content: center"><svg width="20" height="20" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M180.92,88,128,128,74.67,88Z" opacity="0.2"/><path d="M200,75.64V40a16,16,0,0,0-16-16H72A16,16,0,0,0,56,40V76a16.07,16.07,0,0,0,6.4,12.8L114.67,128,62.4,167.2A16.07,16.07,0,0,0,56,180v36a16,16,0,0,0,16,16H184a16,16,0,0,0,16-16V180.36a16.09,16.09,0,0,0-6.35-12.77L141.27,128l52.38-39.59A16.09,16.09,0,0,0,200,75.64ZM72,40H184V75.64L178.23,80H77.33L72,76Zm56,78L98.67,96h58.4Zm56,98H72V180l48-36v24a8,8,0,0,0,16,0V144.08l48,36.28Z"/></svg></span>
  <span style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px"><span style="font-size: 14px; font-weight: 700">Packing 2+ days</span><span style="font-family: 'IBM Plex Mono', monospace; font-size: 11px; color: #6B7480; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">ask Musa in one message</span></span>
  <b style="font-family: 'IBM Plex Mono', monospace; font-size: 18px; font-weight: 600; color: #8E2A22">1</b>
  <span style="flex: none; height: 36px; padding: 0 12px; border-radius: 999px; background: #16203C; color: #FFFFFF; font-size: 13px; font-weight: 700; display: flex; align-items: center">Ask</span>
</a>
```

Kinds and tones for Sales: **Take payment** (coins, warn `#FDEEE1` / `#95530C`, count `#7A4A02`, pill "Take"); **Tell them** a price changed (tag in stroke 20 on info `#E3EEFB` / `#1A5A8A`, pill "Tell"); **Ready to collect** (store, good `#E4F4EA` / `#0F6B43`, pill "Codes"); **Packing 2+ days** (hourglass, bad, pill "Ask"); **Chats waiting** (whatsapp duotone, good, pill "Reply"); **Not sent yet** (offline stroke, warn, pill "Send"). Order: money first, then customers waiting, then the shop.

### P09 · The dark "Next move" card

As built: TD03TodayNext.

The best play, large, on the radial navy. Top: a tone tag (26 tall) and "1 of 4" mono 12 `#8D99B5`. Middle: the **dial** (84 px: an inner white ring for the rhythm, an outer amber arc for the days past it, the avatar inside) beside the name 18/700 and the big mono figure in amber. Then the usual as three glass tiles (58 tall). Foot: the label and value, a 48 px Call square, a white 48 px "Order usual" button.

```html
<div style="position: relative; border-radius: 22px; background: radial-gradient(120% 90% at 100% 0%, #2B3866 0%, #16203C 58%); color: #FFFFFF; padding: 16px; display: flex; flex-direction: column; gap: 14px; box-shadow: 0 14px 30px rgba(22,32,60,.22); overflow: hidden">
  <div style="display: flex; align-items: center; justify-content: space-between">
    <span style="display: flex; align-items: center; gap: 6px; height: 26px; padding: 0 10px; border-radius: 999px; background: rgba(245,178,107,.16); color: #F5B26B; font-size: 12px; font-weight: 700"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>Due for their usual</span>
    <span style="font-family: 'IBM Plex Mono', monospace; font-size: 12px; color: #8D99B5">1 of 4</span>
  </div>
  <div style="display: flex; align-items: center; gap: 14px">
    <span aria-hidden="true" style="position: relative; width: 84px; height: 84px; flex: none">
      <svg width="84" height="84" viewBox="0 0 84 84" style="position: absolute; inset: 0"><circle cx="42" cy="42" r="30" fill="none" stroke="rgba(255,255,255,.12)" stroke-width="5"></circle><circle cx="42" cy="42" r="30" fill="none" stroke="#FFFFFF" stroke-width="5" stroke-dasharray="188.5 188.5" transform="rotate(-90 42 42)"></circle><circle cx="42" cy="42" r="37" fill="none" stroke="#F5B26B" stroke-width="5" stroke-linecap="round" stroke-dasharray="66.4 232.5" transform="rotate(-90 42 42)"></circle></svg>
      <span style="position: absolute; inset: 17px; border-radius: 999px; background: #F6E4F1; color: #7A3268; font-size: 16px; font-weight: 700; display: flex; align-items: center; justify-content: center">KS</span>
    </span>
    <span style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px">
      <span style="font-size: 18px; font-weight: 700; letter-spacing: -.01em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">Kyaligonza &amp; Sons</span>
      <span style="display: flex; align-items: baseline; gap: 6px"><span style="font-family: 'IBM Plex Mono', monospace; font-size: 22px; font-weight: 600; color: #F5B26B; letter-spacing: -.02em">+4 days</span><span style="font-size: 12px; font-weight: 600; color: #B3BCD2">past their rhythm</span></span>
      <span style="display: flex; align-items: center; gap: 10px; font-size: 11px; font-weight: 600; color: #B3BCD2"><span style="display: flex; align-items: center; gap: 5px"><span aria-hidden="true" style="width: 8px; height: 8px; border-radius: 999px; background: #FFFFFF"></span>every 14 days</span><span style="display: flex; align-items: center; gap: 5px"><span aria-hidden="true" style="width: 8px; height: 8px; border-radius: 999px; background: #F5B26B"></span>late</span></span>
    </span>
  </div>
  <div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px">
    <span style="height: 58px; border-radius: 12px; background: rgba(255,255,255,.07); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; color: #DDE3F0"><svg width="18" height="18" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M128,129.09V232a8,8,0,0,1-3.84-1l-88-48.18a8,8,0,0,1-4.16-7V80.18a8,8,0,0,1,.7-3.25Z" opacity="0.2"/><path d="M223.68,66.15,135.68,18a15.88,15.88,0,0,0-15.36,0l-88,48.17a16,16,0,0,0-8.32,14v95.64a16,16,0,0,0,8.32,14l88,48.17a15.88,15.88,0,0,0,15.36,0l88-48.17a16,16,0,0,0,8.32-14V80.18A16,16,0,0,0,223.68,66.15ZM128,32l80.34,44-29.77,16.3-80.35-44ZM128,120,47.66,76l33.9-18.56,80.34,44ZM40,90l80,43.78v85.79L40,175.82Zm176,85.78h0l-80,43.79V133.82l32-17.51V152a8,8,0,0,0,16,0V107.55L216,90v85.77Z"/></svg><span style="font-family: 'IBM Plex Mono', monospace; font-size: 12px; font-weight: 500; color: #FFFFFF">40 bag</span></span>
    <span style="height: 58px; border-radius: 12px; background: rgba(255,255,255,.07); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; color: #DDE3F0"><svg width="18" height="18" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M216,116.69V216H152V152H104v64H40V116.69l82.34-82.35a8,8,0,0,1,11.32,0Z" opacity="0.2"/><path d="M240,208H224V136l2.34,2.34A8,8,0,0,0,237.66,127L139.31,28.68a16,16,0,0,0-22.62,0L18.34,127a8,8,0,0,0,11.32,11.31L32,136v72H16a8,8,0,0,0,0,16H240a8,8,0,0,0,0-16ZM48,120l80-80,80,80v88H160V152a8,8,0,0,0-8-8H104a8,8,0,0,0-8,8v56H48Zm96,88H112V160h32Z"/></svg><span style="font-family: 'IBM Plex Mono', monospace; font-size: 12px; font-weight: 500; color: #FFFFFF">30 pc</span></span>
    <span style="height: 58px; border-radius: 12px; background: rgba(255,255,255,.07); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; color: #DDE3F0"><svg width="18" height="18" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M219.84,73.16,131.84,25a8,8,0,0,0-7.68,0l-88,48.18a8,8,0,0,0-4.16,7v95.64a8,8,0,0,0,4.16,7l88,48.18a8,8,0,0,0,7.68,0l88-48.18a8,8,0,0,0,4.16-7V80.18A8,8,0,0,0,219.84,73.16ZM128,168a40,40,0,1,1,40-40A40,40,0,0,1,128,168Z" opacity="0.2"/><path d="M128,80a48,48,0,1,0,48,48A48.06,48.06,0,0,0,128,80Zm0,80a32,32,0,1,1,32-32A32,32,0,0,1,128,160Zm95.68-93.85L135.68,18a15.88,15.88,0,0,0-15.36,0l-88,48.17a16,16,0,0,0-8.32,14v95.64a16,16,0,0,0,8.32,14l88,48.17a15.88,15.88,0,0,0,15.36,0l88-48.17h0a16,16,0,0,0,8.32-14V80.18A16,16,0,0,0,223.68,66.15ZM128,224,40,175.82V80.18L128,32l88,48.17v95.63Z"/></svg><span style="font-family: 'IBM Plex Mono', monospace; font-size: 12px; font-weight: 500; color: #FFFFFF">2 ctn</span></span>
  </div>
  <div style="display: flex; align-items: center; gap: 10px">
    <span style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px"><span style="font-size: 11px; font-weight: 600; color: #B3BCD2">Their usual</span><span style="font-family: 'IBM Plex Mono', monospace; font-size: 22px; font-weight: 600; color: #FFFFFF; letter-spacing: -.02em">2,672,000</span></span>
    <a href="tel:+256772000105" aria-label="Call Kyaligonza and Sons" style="width: 48px; height: 48px; flex: none; border-radius: 14px; background: rgba(255,255,255,.1); color: #FFFFFF; display: flex; align-items: center; justify-content: center"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/></svg></a>
    <button type="button" style="border: none; padding: 0; font-family: inherit; text-align: left; height: 48px; padding: 0 16px; border-radius: 14px; background: #FFFFFF; color: #16203C; font-size: 15px; font-weight: 700; display: flex; align-items: center; gap: 6px; flex: none">Order usual<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg></button>
  </div>
</div>
```

Sales has no "You earn": the foot shows the usual's value in white. Mint is kept for money that came in.

The "Then" list under it is a group card of 66 px rows (P10b).

### P10 · The customer row with its due ring

The ring (44 box, r 20, stroke 3, track `#EFECE6`) fills as their usual gap runs out: `#0F6B43` due, `#95530C` late, `#8E2A22` gone quiet (full), `#9AA1AE` early. The avatar sits inset 6 px, 12/700. Name 15/700, a subline 12/700 in the ring's tone (or 12/600 `#5F6980` when nothing is due). Right: what they owe (mono 13/600, "owes" 11/600 `#6B7480` under it) and a 44 px WhatsApp disc. Rows are 64 tall inside a group card (radius 18, padding `0 12px`), split by `1px #F1EEE8`. The row is a `<div>`: the main part is one link, the WhatsApp disc is a sibling link.

```html
<div style="background: #FFFFFF; border-radius: 18px; box-shadow: 0 1px 2px rgba(22,32,60,.05), inset 0 0 0 1px #E6E3DD; padding: 0 12px; display: flex; flex-direction: column">
  <div style="display: flex; align-items: center; gap: 10px; min-height: 64px; border-bottom: 1px solid #F1EEE8">
    <button type="button" style="border: none; padding: 0; font-family: inherit; background: transparent; color: inherit; text-align: left; flex: 1; min-width: 0; display: flex; align-items: center; gap: 11px; min-height: 64px">
      <span aria-hidden="true" style="position: relative; width: 44px; height: 44px; flex: none"><svg width="44" height="44" viewBox="0 0 44 44" style="position: absolute; inset: 0"><circle cx="22" cy="22" r="20" fill="none" stroke="#EFECE6" stroke-width="3"></circle><circle cx="22" cy="22" r="20" fill="none" stroke="#95530C" stroke-width="3" stroke-linecap="round" stroke-dasharray="125.7 125.7" transform="rotate(-90 22 22)"></circle></svg><span style="position: absolute; inset: 6px; border-radius: 999px; background: #F6E4F1; color: #7A3268; font-size: 12px; font-weight: 700; display: flex; align-items: center; justify-content: center">KS</span></span>
      <span style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px"><span style="font-size: 15px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">Kyaligonza &amp; Sons</span><span style="font-size: 12px; font-weight: 700; color: #95530C; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">4 days late · every 14 days</span></span>
      <span style="display: flex; flex-direction: column; align-items: flex-end; gap: 1px; flex: none"><span style="font-family: 'IBM Plex Mono', monospace; font-variant-numeric: tabular-nums; font-size: 13px; font-weight: 600">420k</span><span style="font-size: 11px; font-weight: 600; color: #6B7480">owes</span></span>
    </button>
    <button type="button" aria-label="WhatsApp Kyaligonza and Sons" style="border: none; padding: 0; font-family: inherit; width: 44px; height: 44px; flex: none; border-radius: 999px; background: #E4F4EA; display: flex; align-items: center; justify-content: center"><svg width="19" height="19" viewBox="0 0 256 256" fill="#0F6B43" aria-hidden="true"><path d="M128,32A96,96,0,0,0,44.89,176.07L32.42,213.46a8,8,0,0,0,10.12,10.12l37.39-12.47A96,96,0,1,0,128,32Zm24,152a80,80,0,0,1-80-80,32,32,0,0,1,32-32l16,32-12.32,18.47a48.19,48.19,0,0,0,25.85,25.85L152,136l32,16A32,32,0,0,1,152,184Z" opacity="0.2"/><path d="M187.58,144.84l-32-16a8,8,0,0,0-8,.5l-14.69,9.8a40.55,40.55,0,0,1-16-16l9.8-14.69a8,8,0,0,0,.5-8l-16-32A8,8,0,0,0,104,64a40,40,0,0,0-40,40,88.1,88.1,0,0,0,88,88,40,40,0,0,0,40-40A8,8,0,0,0,187.58,144.84ZM152,176a72.08,72.08,0,0,1-72-72A24,24,0,0,1,99.29,80.46l11.48,23L101,118a8,8,0,0,0-.73,7.51,56.47,56.47,0,0,0,30.15,30.15A8,8,0,0,0,138,155l14.62-9.74,23,11.48A24,24,0,0,1,152,176ZM128,24A104,104,0,0,0,36.18,176.88L24.83,210.93a16,16,0,0,0,20.24,20.24l34.05-11.35A104,104,0,1,0,128,24Zm0,192a87.87,87.87,0,0,1-44.06-11.81,8,8,0,0,0-6.54-.67L40,216,52.47,178.6a8,8,0,0,0-.66-6.54A88,88,0,1,1,128,216Z"/></svg></button>
  </div>
  <!-- next row; the last row has no border-bottom -->
</div>
```

**P10b · the compact act row** (66 tall, a 42 px icon tile or ring avatar, a 40 px square action on the right; used for "Then", asks, chats waiting):

```html
<div style="display: flex; align-items: center; gap: 12px; min-height: 66px; border-bottom: 1px solid #F1EEE8">
  <span aria-hidden="true" style="width: 42px; height: 42px; flex: none; border-radius: 12px; background: #E3EEFB; color: #1A5A8A; display: flex; align-items: center; justify-content: center"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z"/></svg></span>
  <span style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px"><span style="font-size: 14px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">Lubowa Builders <span style="font-weight: 600; color: #6B7480">· asked</span></span><span style="font-size: 12px; font-weight: 600; color: #5F6980; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">“G28 iron sheets, 60 pcs?”</span></span>
  <button type="button" aria-label="Reply to Lubowa Builders" style="border: none; padding: 0; font-family: inherit; width: 44px; height: 44px; flex: none; border-radius: 12px; background: #16203C; color: #FFFFFF; display: flex; align-items: center; justify-content: center"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20l1.3-3.9A8 8 0 1 1 8 18.8z"/><path d="M9 9.5c0 2.8 2.7 5.5 5.5 5.5l1.3-1.3-1.8-1-1 .8a4.3 4.3 0 0 1-2.3-2.3l.8-1-1-1.8z"/></svg></button>
</div>
```

The square action is navy for the row's own next step, `#F1EEE8` with ink for a secondary add. (The agent draws it 40; Sales draws it 44.)

### P11 · Avatars

- **xs** 24 (face stacks): 11/700, letter-spacing -.04em, border 2px of the ground behind.
- **sm** 32 (act rows): 12/700. **md** 38 to 40 (who pill, lists): 13/700. **ring** 44 (P10). **lg** 44 to 52 (sheet heads): 15 to 17/700. **dial** 84 (P09).
- Two letters, the person's display name's initials. A walk-in is "WI" in t4. A teammate in a chat or hand-over list uses their tint from 1.1.
- **Faces as dots** (dense strips): 12 px tinted discs with a 2px ring of the ground, overlap -4 (week strip) or 18 px with -7 (a stage card's footer).
- Grace's own avatar on navy: `#243052`, white, with `box-shadow: 0 0 0 2px #16203C, 0 0 0 4px rgba(111,220,176,.55)`.

### P12 · The order line card

Closed: white, radius 16, `hair`, padding `10px 12px`; the item square 40 (radius 12, aisle tint, duotone 24) or the item's photo (`object-fit: cover` in the same square); the name 14/600 (one line, ellipsis); the subline mono 12 `#5F6980` "1 ctn × 160,000" with the unit word in Figtree; at the right one chip. The line's own amount goes in the chip only when there is nothing more important to say.

```html
<button type="button" style="border: none; padding: 0; font-family: inherit; text-align: left; width: 100%; background: #FFFFFF; border-radius: 16px; box-shadow: 0 1px 2px rgba(22,32,60,.05), inset 0 0 0 1px #E6E3DD; padding: 10px 12px; display: flex; align-items: center; gap: 10px; color: #1C2233">
  <span aria-hidden="true" style="width: 40px; height: 40px; flex: none; border-radius: 12px; background: linear-gradient(145deg, #EFECE6 0%, #FFFFFF 150%); box-shadow: inset 0 0 0 1px rgba(0,0,0,.035); display: flex; align-items: center; justify-content: center"><svg width="24" height="24" viewBox="0 0 256 256" fill="#5F6980" aria-hidden="true"><path d="M128,129.09V232a8,8,0,0,1-3.84-1l-88-48.18a8,8,0,0,1-4.16-7V80.18a8,8,0,0,1,.7-3.25Z" opacity="0.2"/><path d="M223.68,66.15,135.68,18a15.88,15.88,0,0,0-15.36,0l-88,48.17a16,16,0,0,0-8.32,14v95.64a16,16,0,0,0,8.32,14l88,48.17a15.88,15.88,0,0,0,15.36,0l88-48.17a16,16,0,0,0,8.32-14V80.18A16,16,0,0,0,223.68,66.15ZM128,32l80.34,44-29.77,16.3-80.35-44ZM128,120,47.66,76l33.9-18.56,80.34,44ZM40,90l80,43.78v85.79L40,175.82Zm176,85.78h0l-80,43.79V133.82l32-17.51V152a8,8,0,0,0,16,0V107.55L216,90v85.77Z"/></svg></span>
  <span style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px"><span style="font-size: 14px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">Cement · Hima 50kg</span><span style="font-family: 'IBM Plex Mono', monospace; font-variant-numeric: tabular-nums; font-size: 12px; color: #5F6980">40 <span style="font-family: Figtree, sans-serif">bag</span> × 33,500</span></span>
  <span style="flex: none; font-family: 'IBM Plex Mono', monospace; font-variant-numeric: tabular-nums; font-size: 13px; font-weight: 600; color: #1C2233; background: #F1EEE8; padding: 5px 8px; border-radius: 8px">1,340,000</span>
</button>
```

The chip, by what the line needs to say (one only, in this order of importance):

| Chip | Look |
|---|---|
| Out (can't be had) | `#FBE5E2` / `#8E2A22`, 12/700 Figtree "Out" |
| Price coming | `#FDEEE1` / `#7A4A02`, 12/700 "Price coming" |
| Under the shop's price | `#FDEEE1` / `#7A4A02`, mono "−1,500" with `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 12.2V4.5a1 1 0 0 1 1-1h7.7l8.3 8.3a1.5 1.5 0 0 1 0 2.1l-6.4 6.4a1.5 1.5 0 0 1-2.1 0z"/><circle cx="8" cy="8" r="1.4"/></svg>` |
| Order in | `#E3EEFB` / `#1A5A8A`, 12/700 "Order in" |
| 12 on shelf (low) | `#F1EEE8` / `#5F6980`, mono "12 on shelf" |
| The line's amount | `#F1EEE8` / ink, mono (above) |

**Open** (the line being edited): radius 18, `open` shadow, padding 12, gap 14; under the head row: the stepper (P12b), then the price field (S03). Below the shop's price shows the line's chip in amber and one line `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg> Under the shop's price · Ruth says yes before it is packed` 12/600 `#7A4A02`.

**P12b · the stepper**: `#F7F5F2` track, radius 12, 44 tall; minus and plus are 44 × 44 buttons (stroke 18, 2.2); the number mono 16/600 with the unit Figtree 12 `#5F6980`.

```html
<div style="display: flex; align-items: center; border-radius: 12px; background: #F7F5F2; height: 44px">
  <button type="button" aria-label="Fewer" style="width: 44px; height: 44px; border: none; background: transparent; padding: 0; display: flex; align-items: center; justify-content: center; color: #1C2233"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/></svg></button>
  <span style="min-width: 54px; text-align: center; font-family: 'IBM Plex Mono', monospace; font-size: 16px; font-weight: 600">40<span style="font-family: Figtree, sans-serif; font-size: 12px; color: #5F6980; margin-left: 3px">bag</span></span>
  <button type="button" aria-label="More" style="width: 44px; height: 44px; border: none; background: transparent; padding: 0; display: flex; align-items: center; justify-content: center; color: #1C2233"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></button>
</div>
```

### P13 · "Often with" suggestion card

Header: the duotone link icon in teal `#0E6A6A` (18), "Often with Iron sheet G28" 15/700, and "in Kato's orders" 12/600 `#5F6980` at the right. Each card: 64 tall, radius 16, `hair`; the aisle square 44 (duotone 26); the name 14/600; a 4 px bar in the aisle's ink with "7/14" mono 11 (how many of their orders had it); the price mono 13/600 with "per pc" 11/600 under it; a 44 px navy round +.

```html
<div style="display: flex; align-items: center; gap: 8px; padding: 6px 2px 0">
  <svg width="18" height="18" viewBox="0 0 256 256" fill="#0E6A6A" aria-hidden="true"><path d="M218.34,119.6,183.6,154.34a46.58,46.58,0,0,1-44.31,12.26c-.31.34-.62.67-.95,1L103.6,202.34A46.63,46.63,0,1,1,37.66,136.4L72.4,101.66A46.6,46.6,0,0,1,116.71,89.4c.31-.34.62-.67,1-1L152.4,53.66a46.63,46.63,0,0,1,65.94,65.94Z" opacity="0.2"/><path d="M240,88.23a54.43,54.43,0,0,1-16,37L189.25,160a54.27,54.27,0,0,1-38.63,16h-.05A54.63,54.63,0,0,1,96,119.84a8,8,0,0,1,16,.45A38.62,38.62,0,0,0,150.58,160h0a38.39,38.39,0,0,0,27.31-11.31l34.75-34.75a38.63,38.63,0,0,0-54.63-54.63l-11,11A8,8,0,0,1,135.7,59l11-11A54.65,54.65,0,0,1,224,48,54.86,54.86,0,0,1,240,88.23ZM109,185.66l-11,11A38.41,38.41,0,0,1,70.6,208h0a38.63,38.63,0,0,1-27.29-65.94L78,107.31A38.63,38.63,0,0,1,144,135.71a8,8,0,0,0,7.78,8.22H152a8,8,0,0,0,8-7.78A54.86,54.86,0,0,0,144,96a54.65,54.65,0,0,0-77.27,0L32,130.75A54.62,54.62,0,0,0,70.56,224h0a54.28,54.28,0,0,0,38.64-16l11-11A8,8,0,0,0,109,185.66Z"/></svg>
  <h2 style="flex: 1; margin: 0; font-size: 15px; font-weight: 700">Often with Iron sheet G28</h2>
  <span style="font-size: 12px; font-weight: 600; color: #5F6980">in Kato's orders</span>
</div>
<div style="display: flex; align-items: center; gap: 12px; min-height: 64px; padding: 0 8px 0 10px; border-radius: 16px; background: #FFFFFF; box-shadow: 0 1px 2px rgba(22,32,60,.05), inset 0 0 0 1px #E6E3DD">
  <span aria-hidden="true" style="width: 44px; height: 44px; flex: none; border-radius: 12px; background: linear-gradient(145deg, #DCEAF8 0%, #FFFFFF 150%); box-shadow: inset 0 0 0 1px rgba(0,0,0,.035); display: flex; align-items: center; justify-content: center"><svg width="26" height="26" viewBox="0 0 256 256" fill="#1A5A8A" aria-hidden="true"><path d="M216,116.69V216H152V152H104v64H40V116.69l82.34-82.35a8,8,0,0,1,11.32,0Z" opacity="0.2"/><path d="M240,208H224V136l2.34,2.34A8,8,0,0,0,237.66,127L139.31,28.68a16,16,0,0,0-22.62,0L18.34,127a8,8,0,0,0,11.32,11.31L32,136v72H16a8,8,0,0,0,0,16H240a8,8,0,0,0,0-16ZM48,120l80-80,80,80v88H160V152a8,8,0,0,0-8-8H104a8,8,0,0,0-8,8v56H48Zm96,88H112V160h32Z"/></svg></span>
  <span style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 6px"><span style="font-size: 14px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">Ridge cap G28</span><span style="display: flex; align-items: center; gap: 6px"><span aria-hidden="true" style="flex: 1; height: 4px; border-radius: 999px; background: #F1EEE8; overflow: hidden"><span style="display: block; width: 50%; height: 100%; border-radius: 999px; background: #1A5A8A"></span></span><b style="font-family: 'IBM Plex Mono', monospace; font-size: 11px; font-weight: 600; color: #5F6980">7/14</b></span></span>
  <span style="display: flex; flex-direction: column; align-items: flex-end; line-height: 1.15"><b style="font-family: 'IBM Plex Mono', monospace; font-size: 13px; font-weight: 600">18,000</b><small style="font-size: 11px; font-weight: 600; color: #6B7480">per pc</small></span>
  <button type="button" aria-label="Add Ridge cap G28" style="width: 44px; height: 44px; flex: none; border: none; padding: 0; border-radius: 999px; background: #16203C; color: #FFFFFF; display: flex; align-items: center; justify-content: center"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></button>
</div>
```

### P14 · Aisle chips and aisle tiles

**Chip** (a scroll row that bleeds past the gutter: `margin: 0 -16px; padding: 4px 16px; overflow-x: auto`): 44 tall, white, hairline, radius 999, the aisle's duotone 18 in its ink, 13/700.

```html
<div style="display: flex; gap: 8px; overflow-x: auto; margin: 0 -16px; padding: 4px 16px">
  <a href="SL12Aisle.dc.html" style="flex: none; height: 44px; padding: 0 14px 0 10px; border-radius: 999px; background: #FFFFFF; box-shadow: inset 0 0 0 1px #E6E3DD; font-size: 13px; font-weight: 700; color: #1C2233; display: flex; align-items: center; gap: 6px"><svg width="18" height="18" viewBox="0 0 256 256" fill="#8E2A22" aria-hidden="true"><path d="M245.66,129,217,157.66a8,8,0,0,1-11.3,0L168.1,120l-28,28-32-32,28-28L80,31.78a87.81,87.81,0,0,1,98.31,18l67.35,67.89A8,8,0,0,1,245.66,129Z" opacity="0.2"/><path d="M251.34,112,183.88,44.08a96.1,96.1,0,0,0-135.77,0l-.09.09L34.25,58.4A8,8,0,0,0,45.74,69.53L59.47,55.35a79.92,79.92,0,0,1,18.71-13.9L124.68,88l-96,96a16,16,0,0,0,0,22.63l20.69,20.69a16,16,0,0,0,22.63,0l96-96,14.34,14.34h0L200,163.3a16,16,0,0,0,22.63,0l28.69-28.69A16,16,0,0,0,251.34,112ZM60.68,216,40,195.31l68-68L128.68,148ZM162.34,114.32,140,136.67,119.31,116l22.35-22.35a8,8,0,0,0,0-11.32L94.32,35a80,80,0,0,1,78.23,20.41l44.22,44.51L188,128.66l-14.34-14.34A8,8,0,0,0,162.34,114.32Zm49,37.66-12-12L228,111.25l12,12Z"/></svg>Tools</a>
  <a href="SL12Aisle.dc.html" style="flex: none; height: 44px; padding: 0 14px 0 10px; border-radius: 999px; background: #FFFFFF; box-shadow: inset 0 0 0 1px #E6E3DD; font-size: 13px; font-weight: 700; color: #1C2233; display: flex; align-items: center; gap: 6px"><svg width="18" height="18" viewBox="0 0 256 256" fill="#0F6B43" aria-hidden="true"><path d="M200,40V224H56V40a8,8,0,0,1,8-8H192A8,8,0,0,1,200,40Z" opacity="0.2"/><path d="M232,216H208V40a16,16,0,0,0-16-16H64A16,16,0,0,0,48,40V216H24a8,8,0,0,0,0,16H232a8,8,0,0,0,0-16ZM64,40H192V216H64Zm104,92a12,12,0,1,1-12-12A12,12,0,0,1,168,132Z"/></svg>Doors &amp; locks</a>
  <a href="SL12Aisle.dc.html" style="flex: none; height: 44px; padding: 0 14px 0 10px; border-radius: 999px; background: #FFFFFF; box-shadow: inset 0 0 0 1px #E6E3DD; font-size: 13px; font-weight: 700; color: #1C2233; display: flex; align-items: center; gap: 6px"><svg width="18" height="18" viewBox="0 0 256 256" fill="#1A5A8A" aria-hidden="true"><path d="M216,116.69V216H152V152H104v64H40V116.69l82.34-82.35a8,8,0,0,1,11.32,0Z" opacity="0.2"/><path d="M240,208H224V136l2.34,2.34A8,8,0,0,0,237.66,127L139.31,28.68a16,16,0,0,0-22.62,0L18.34,127a8,8,0,0,0,11.32,11.31L32,136v72H16a8,8,0,0,0,0,16H240a8,8,0,0,0,0-16ZM48,120l80-80,80,80v88H160V152a8,8,0,0,0-8-8H104a8,8,0,0,0-8,8v56H48Zm96,88H112V160h32Z"/></svg>Roofing</a>
</div>
```

**Tile** (3-up grid, gap 8): 92 tall, radius 18, `hair`, padding `11px 12px`, the square 38 (radius 12) top-left, the name 13/700 and the count mono 11 `#6B7480` bottom-left. The last tile "All aisles" is the navy tile gradient with white text and `#B3BCD2` count.

### P15 · The dark dock

The order's footing: how it gets there, what it comes to, and the one move. Navy, top corners 26, `up` shadow, padding `16px 16px 22px`, gap 14. Row 1: the segmented control and the total. Row 2: the slide.

Segmented: track `rgba(255,255,255,.08)` padding 3; the on segment white with navy icon and word, 40 tall; the off segment is the icon only (44 wide), `#B3BCD2`. The pair is a radio group.

The total mono 22/600 white; the sub-line mono 13/600 under it. Sales sub-lines: mint `#6FDCB0` when something good is true ("all on the shelf", "deposit 50,000 used"), amber `#F5B26B` for "1 price coming", `#F7A196` for "owes 420,000 already".

```html
<div style="position: absolute; left: 0; right: 0; bottom: 0; background: #16203C; border-radius: 26px 26px 0 0; padding: 16px 16px 22px; display: flex; flex-direction: column; gap: 14px; box-shadow: 0 -8px 24px rgba(22,32,60,.18); color: #FFFFFF">
  <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px">
    <div role="radiogroup" aria-label="How it gets there" style="display: flex; padding: 3px; border-radius: 999px; background: rgba(255,255,255,.08)">
      <button type="button" role="radio" aria-checked="true" style="height: 40px; padding: 0 12px; border-radius: 999px; border: none; background: #FFFFFF; color: #16203C; font-size: 13px; font-weight: 700; display: flex; align-items: center; gap: 6px"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9l1.5-5h13L20 9M4 9v11h16V9M4 9h16M9 20v-6h6v6"/></svg>Pickup</button>
      <button type="button" role="radio" aria-checked="false" aria-label="Delivery" style="height: 40px; width: 44px; border-radius: 999px; border: none; background: transparent; color: #B3BCD2; display: flex; align-items: center; justify-content: center; padding: 0"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h11v10H3zM14 9h4l3 3v4h-7"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/></svg></button>
    </div>
    <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 2px">
      <span style="font-family: 'IBM Plex Mono', monospace; font-variant-numeric: tabular-nums; font-size: 22px; font-weight: 600; letter-spacing: -.03em">1,750,000</span>
      <span style="font-family: 'IBM Plex Mono', monospace; font-size: 13px; font-weight: 600; color: #F5B26B">1 price coming</span>
    </div>
  </div>
  <button type="button" style="position: relative; height: 60px; border-radius: 999px; border: none; background: rgba(255,255,255,.08); display: flex; align-items: center; padding: 5px; box-sizing: border-box; width: 100%; color: #FFFFFF">
    <span aria-hidden="true" style="width: 50px; height: 50px; flex: none; border-radius: 999px; background: #C93A30; display: flex; align-items: center; justify-content: center; animation: owNudge 1.6s ease-in-out infinite"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 6 6 6-6 6M12 6l6 6-6 6"/></svg></span>
    <span style="position: absolute; left: 0; right: 0; text-align: center; font-size: 16px; font-weight: 700; padding: 0 60px">Slide to place · 3 items</span>
  </button>
</div>
```

The dock is 158 px tall (with the 22 px foot). States:

- **Nothing in it**: the total becomes three 8 px dashed dots and a `#5C6788` "0"; the track `rgba(255,255,255,.05)` with `inset 0 0 0 1px rgba(255,255,255,.08)`; the knob `rgba(255,255,255,.08)` holding the duotone basket 22 in `#5C6788`; the label 15/600 `#7F89A6` "Add an item to place".
- **No customer**: knob `#59627A` (no nudge), label "Pick a customer to place".
- **Sending…**: the fill `rgba(201,58,48,.35)` runs the width, the knob at the right end, label "Sending…".
- **Offline**: knob `#59627A`, label "Back online to sell", and the notice bar (P31) above the dock.
- Labels by flow: "Slide to place · 3 items" (an order), "Slide to sell · 52,000" (a counter sale), "Slide to record 420,000" (a payment).
- **Delivery**: a 48 px field row appears above row 1: `rgba(255,255,255,.08)`, radius 14, pin icon `#B3BCD2`, white text "Plot 12, Ntinda Rd".

### P16 · The white tab bar and the red +

84 tall, white, `border-top: 1px solid #E6E3DD`, padding-top 8. Tabs 52 tall, icon 24 over the label 12; inactive `#6B7480` 600, active ink 700 with the icon **filled** (the part marked `fill="none"` stays a line). The red + is 64 (box-sizing border-box), lifted 26 px above the bar, `#C93A30`, a 4 px ring of `#F7F5F2`, the `plus` shadow; its badge is navy 22 px with a 2 px `#F7F5F2` ring, counting **orders not placed yet** (baskets).

**The agent bar (Today · + · Clients)**, kept for reference:

```html
<nav aria-label="Main" style="position: absolute; left: 0; right: 0; bottom: 0; height: 84px; background: #FFFFFF; border-top: 1px solid #E6E3DD; display: grid; grid-template-columns: 1fr 96px 1fr; align-items: start; padding-top: 8px; box-sizing: border-box">
  <a href="TD01Today.dc.html" aria-current="page" style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; height: 52px; color: #1C2233; font-size: 12px; font-weight: 700"><svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 18a6 6 0 0 1 12 0z"/><path d="M3 18h18M12 4v3M4.9 8.9 7 11M19.1 8.9 17 11" fill="none"/></svg>Today</a>
  <a href="SL01Who.dc.html" aria-label="New order" style="position: relative; justify-self: center; margin-top: -26px; width: 64px; height: 64px; box-sizing: border-box; border-radius: 999px; background: #C93A30; color: #FFFFFF; display: flex; align-items: center; justify-content: center; box-shadow: 0 6px 20px rgba(201,58,48,.35); border: 4px solid #F7F5F2"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></a>
  <a href="CU01Customers.dc.html" style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; height: 52px; color: #6B7480; font-size: 12px; font-weight: 600"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.6 3.3-6 6.5-6s5.9 2.4 6.5 6z"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.3c2 .9 3.2 2.9 3.5 5.7" fill="none"/></svg>Clients</a>
</nav>
```

**The Sales bar (Today · Chats · + · Orders · Customers)**, the same parts, five columns: `1fr 1fr 96px 1fr 1fr` (66 px per tab at 360). The Chats tab carries the unread count (crimson, mono 11, white ring) at its icon's top right. Copy it exactly; move `aria-current="page"`, the 700 weight, the ink colour and the `on` icon to the tab you are on.

```html
<nav aria-label="Main" style="position: absolute; left: 0; right: 0; bottom: 0; height: 84px; background: #FFFFFF; border-top: 1px solid #E6E3DD; display: grid; grid-template-columns: 1fr 1fr 96px 1fr 1fr; align-items: start; padding-top: 8px; box-sizing: border-box">
  <a href="TD01Today.dc.html" aria-current="page" style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; height: 52px; color: #1C2233; font-size: 12px; font-weight: 700"><svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 18a6 6 0 0 1 12 0z"/><path d="M3 18h18M12 4v3M4.9 8.9 7 11M19.1 8.9 17 11" fill="none"/></svg>Today</a>
  <a href="CH01Chats.dc.html" aria-label="Chats, 3 waiting" style="position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; height: 52px; color: #6B7480; font-size: 12px; font-weight: 600"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 4.5h13v9H8l-5 4z"/><path d="M17.5 8.5H21v11.5l-3.2-2.6H10.5v-2.9" fill="none"/></svg>Chats<span aria-hidden="true" style="position: absolute; top: 2px; left: calc(50% + 6px); min-width: 18px; height: 18px; padding: 0 5px; box-sizing: border-box; border-radius: 999px; background: #8E2A22; color: #FFFFFF; font-family: 'IBM Plex Mono', monospace; font-size: 11px; font-weight: 600; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 0 2px #FFFFFF">3</span></a>
  <a href="SL01Who.dc.html" aria-label="New sale, 2 not placed yet" style="position: relative; justify-self: center; margin-top: -26px; width: 64px; height: 64px; box-sizing: border-box; border-radius: 999px; background: #C93A30; color: #FFFFFF; display: flex; align-items: center; justify-content: center; box-shadow: 0 6px 20px rgba(201,58,48,.35); border: 4px solid #F7F5F2"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg><span aria-hidden="true" style="position: absolute; top: -4px; right: -4px; min-width: 22px; height: 22px; padding: 0 6px; box-sizing: border-box; border-radius: 999px; background: #16203C; color: #FFFFFF; font-size: 12px; font-weight: 700; display: flex; align-items: center; justify-content: center; border: 2px solid #F7F5F2">2</span></a>
  <a href="OR01Orders.dc.html" style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; height: 52px; color: #6B7480; font-size: 12px; font-weight: 600"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5z"/><path d="M3.5 7.5 12 12l8.5-4.5M12 12v9" fill="none"/></svg>Orders</a>
  <a href="CU01Customers.dc.html" style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; height: 52px; color: #6B7480; font-size: 12px; font-weight: 600"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.6 3.3-6 6.5-6s5.9 2.4 6.5 6z"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.3c2 .9 3.2 2.9 3.5 5.7" fill="none"/></svg>Customers</a>
</nav>
```

The four tab icons, on and off (paste the one you need):

- Today on: `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 18a6 6 0 0 1 12 0z"/><path d="M3 18h18M12 4v3M4.9 8.9 7 11M19.1 8.9 17 11" fill="none"/></svg>` · off: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 18a6 6 0 0 1 12 0z"/><path d="M3 18h18M12 4v3M4.9 8.9 7 11M19.1 8.9 17 11" fill="none"/></svg>`
- Chats on: `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 4.5h13v9H8l-5 4z"/><path d="M17.5 8.5H21v11.5l-3.2-2.6H10.5v-2.9" fill="none"/></svg>` · off: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 4.5h13v9H8l-5 4z"/><path d="M17.5 8.5H21v11.5l-3.2-2.6H10.5v-2.9" fill="none"/></svg>`
- Orders on: `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5z"/><path d="M3.5 7.5 12 12l8.5-4.5M12 12v9" fill="none" stroke="#FFFFFF"/></svg>` · off: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5z"/><path d="M3.5 7.5 12 12l8.5-4.5M12 12v9" fill="none"/></svg>`
- Customers on: `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.6 3.3-6 6.5-6s5.9 2.4 6.5 6z"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.3c2 .9 3.2 2.9 3.5 5.7" fill="none"/></svg>` · off: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.6 3.3-6 6.5-6s5.9 2.4 6.5 6z"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.3c2 .9 3.2 2.9 3.5 5.7" fill="none"/></svg>`

The red + (with the white-ring badge) stays the same on every tab and on Today. It is hidden on screens that have the dock, a full sheet, or the chat composer.

### P17 · The bottom sheet over navy

A sheet comes up over the screen it came from; the screen shows through the scrim above it. Two kinds:

- **Light sheet** (a choice, a form): `#FFFFFF` or `#F7F5F2`, top corners 26, grabber 40 × 5 `#C9C4BA` at the top (in a 24 px band), title 22/700 left with a 44 px × on `#F1EEE8` right, padding `12px 20px 4px` for the title row, body `16px`, footer with one button at the bottom.
- **Full sheet** (one thing): P04.

```html
<div style="width: 360px; height: 800px; position: relative; overflow: hidden; background: #2A3350; font-family: Figtree, system-ui, sans-serif; color: #1C2233">
  <!-- optional: the screen behind, dimmed, drawn under the strip -->
  <div style="position: absolute; left: 0; right: 0; bottom: 0; top: 300px; background: #FFFFFF; border-radius: 26px 26px 0 0; display: flex; flex-direction: column; box-shadow: 0 -8px 30px rgba(0,0,0,.35)">
    <span aria-hidden="true" style="align-self: center; width: 40px; height: 5px; margin-top: 10px; border-radius: 999px; background: #C9C4BA"></span>
    <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 20px 4px">
      <h2 style="margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -.01em">Who is it for?</h2>
      <a href="OR07Packing.dc.html" aria-label="Close" style="width: 44px; height: 44px; flex: none; border-radius: 999px; background: #F1EEE8; color: #1C2233; display: flex; align-items: center; justify-content: center"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></a>
    </div>
    <div style="padding: 16px; display: flex; flex-direction: column; gap: 12px; flex: 1">
      <!-- content; the one button last, margin-top: auto -->
    </div>
  </div>
</div>
```

When the screen behind matters (it usually does: "the way back is the thing you were on"), draw it at full size first and put `<div aria-hidden="true" style="position: absolute; inset: 0; background: rgba(12,19,38,.72)"></div>` over it, then the sheet.

An eyebrow above a sheet title names what it is about: `ORDER #0552 · KATO CONSTRUCTION` 11/700, letter-spacing .08em, `#6B7480`, then the title 21/700.

### P18 · The track head (where an order is)

The live agent's track: on the sheet's navy top, under a hairline `rgba(255,255,255,.08)`, the **stage word** 24/700 with its sub-line 13/600 `#B3BCD2` on the same baseline; then **one rail**: a 2 px line `rgba(255,255,255,.14)` with the mint part as far as the order has come; done stops 24 px `#22305A` with a mint tick; the stop it is on 34 px mint (`#F5B26B` when it waits on Grace) with its icon and the glow; stops to come 24 px navy with a `1.5px rgba(255,255,255,.2)` ring and the stage icon in `#8D99B5`. Under each, the stage name 11/600 and when it happened (mono) or "now".

Sales has five stages: **Checking · Buying · Packing · On the road · Delivered**. The line runs from 10% to 90% of the width; with five, the mint width for "Packing" is 40% of the width (2 of 4 gaps).

```html
<div style="display: flex; flex-direction: column; gap: 12px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,.08)">
  <div style="display: flex; align-items: baseline; flex-wrap: wrap; gap: 4px 10px"><span style="font-size: 24px; font-weight: 700; letter-spacing: -.02em; line-height: 1.1">Packing</span><span style="font-size: 13px; font-weight: 600; color: #B3BCD2">Musa · since 10:05</span></div>
  <div role="img" aria-label="Packing: step 3 of 5" style="display: flex; flex-direction: column; gap: 6px">
    <div style="position: relative; height: 34px; display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); align-items: center">
      <span aria-hidden="true" style="position: absolute; top: 16px; left: 10%; right: 10%; height: 2px; border-radius: 999px; background: rgba(255,255,255,.14)"></span>
      <span aria-hidden="true" style="position: absolute; top: 16px; left: 10%; width: 40%; height: 2px; border-radius: 999px; background: #6FDCB0"></span>
      <span style="position: relative; justify-self: center; width: 24px; height: 24px; border-radius: 999px; background: #22305A; box-shadow: 0 0 0 3px #16203C; color: #6FDCB0; display: flex; align-items: center; justify-content: center"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7"/></svg></span>
      <span style="position: relative; justify-self: center; width: 24px; height: 24px; border-radius: 999px; background: #22305A; box-shadow: 0 0 0 3px #16203C; color: #6FDCB0; display: flex; align-items: center; justify-content: center"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7"/></svg></span>
      <span style="position: relative; justify-self: center; width: 34px; height: 34px; border-radius: 999px; background: #6FDCB0; color: #16203C; display: flex; align-items: center; justify-content: center; animation: owGlow 2s infinite"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5zM3.5 7.5 12 12l8.5-4.5M12 12v9"/></svg></span>
      <span style="position: relative; justify-self: center; width: 24px; height: 24px; border-radius: 999px; background: #16203C; box-shadow: inset 0 0 0 1.5px rgba(255,255,255,.2), 0 0 0 3px #16203C; color: #8D99B5; display: flex; align-items: center; justify-content: center"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h11v10H3zM14 9h4l3 3v4h-7"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/></svg></span>
      <span style="position: relative; justify-self: center; width: 24px; height: 24px; border-radius: 999px; background: #16203C; box-shadow: inset 0 0 0 1.5px rgba(255,255,255,.2), 0 0 0 3px #16203C; color: #8D99B5; display: flex; align-items: center; justify-content: center"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 7.5 12 3l8.5 4.5V12M3.5 7.5 12 12l8.5-4.5M12 12v9l-8.5-4.5v-9M15 18l2 2 4-4"/></svg></span>
    </div>
    <div style="display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); font-size: 11px; font-weight: 600; text-align: center; line-height: 1.25; color: #8D99B5">
      <span style="display: flex; flex-direction: column; align-items: center; gap: 1px; color: #B3BCD2"><b style="font-weight: inherit">Checking</b><em style="font-style: normal; font-family: 'IBM Plex Mono', monospace; color: #8D99B5">9:14</em></span>
      <span style="display: flex; flex-direction: column; align-items: center; gap: 1px; color: #B3BCD2"><b style="font-weight: inherit">Buying</b><em style="font-style: normal; font-family: 'IBM Plex Mono', monospace; color: #8D99B5">9:31</em></span>
      <span style="display: flex; flex-direction: column; align-items: center; gap: 1px; color: #6FDCB0; font-weight: 700"><b style="font-weight: inherit">Packing</b><em style="font-style: normal">now</em></span>
      <span style="display: flex; flex-direction: column; align-items: center; gap: 1px"><b style="font-weight: inherit; white-space: nowrap">On the road</b><em style="font-style: normal; min-height: 14px"></em></span>
      <span style="display: flex; flex-direction: column; align-items: center; gap: 1px"><b style="font-weight: inherit">Delivered</b><em style="font-style: normal; min-height: 14px"></em></span>
    </div>
  </div>
</div>
```

Waits on Grace (e.g. Checking with "Not paid yet", Ruth to say yes on a price): the now-stop is `#F5B26B` with `owGlowW`, its label `#F5B26B`. Done: every stop ticked, the line full, the stage word "Delivered" and the sub-line "Collected 11:42" or "At the door 11:42".

**P18b · the small stage dots on a light card** (an order row in Orders, one per order): five 28 px circles; done = navy disc with a white tick; now = 2px navy ring on `#E8EBF0` (amber ring on `#FDEEE1` when it waits on Grace, green ring on `#E4F4EA` when ready); to come = `1.5px dashed #CFCAC1` with the icon in `#B5B0A6`; labels 11/600 under each (`#5F6980` done, ink 700 now, `#6B7480` to come).

An order in **Orders** is a row in its stage group: see **S09** (as built on OR01). The small dots above are for an order shown on its own light card (a customer's orders).

### P19 · The 2-up money tiles

Two tiles, gap 10. Left white with hairline: the key 12/600 `#5F6980`, the value mono 18/600, an optional struck-through old value mono 11 `#6B7480`. Right in a tone soft, key 12/700 and value in the tone.

```html
<div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px">
  <div style="background: #FFFFFF; border-radius: 16px; box-shadow: inset 0 0 0 1px #E6E3DD; padding: 12px 14px; display: flex; flex-direction: column; gap: 4px">
    <span style="font-size: 12px; font-weight: 600; color: #5F6980">Kato pays</span>
    <span style="font-family: 'IBM Plex Mono', monospace; font-variant-numeric: tabular-nums; font-size: 18px; font-weight: 600; letter-spacing: -.02em">1,810,000</span>
    <span style="font-size: 11px; font-weight: 600; color: #6B7480">2 lines</span>
  </div>
  <div style="background: #FDEEE1; border-radius: 16px; padding: 12px 14px; display: flex; flex-direction: column; gap: 4px">
    <span style="font-size: 12px; font-weight: 700; color: #7A4A02">Not paid yet</span>
    <span style="font-family: 'IBM Plex Mono', monospace; font-variant-numeric: tabular-nums; font-size: 18px; font-weight: 600; letter-spacing: -.02em; color: #7A4A02">1,810,000</span>
    <span style="font-size: 11px; font-weight: 600; color: #7A4A02">leaves when paid</span>
  </div>
</div>
```

As built on OR07Packing (#0552 at 10:41). Right-tile tones for Sales: **Paid** good soft, "Paid" / amount; **Not paid yet** warn soft; **Deposit** good soft "Deposit 50,000"; **Being checked** info soft `#E3EEFB` / `#1A5A8A`; **Owes** warn soft.

### P20 · The item check list ("What Kato gets")

A white card, radius 16, hairline, padding `4px 14px`. Header row 40 tall: "What Kato gets" 13/700 `#5F6980`, then count chips (good "✓ 2", bad "× 1": 12/700, padding `3px 8px`, radius 999, stroke icon 11 at 3.2). Item rows 52 tall: a 34 px square (radius 9, `#F1EEE8`, stroke icon 17 `#5F6980`, or the aisle tint), the name 14/600, mono subline "40 bag · 1,340,000", and the mark (24 px disc): **confirmed** `#0F6B43` + white tick; **waiting** `2px dashed #C9C4BA`; **checking** a 2.5 px `#F5B26B` ring with a transparent top (spinner, with "checking" 11/700 `#7A4A02` before it); **dropped** `#8E2A22` + white ×, the name and subline struck through in `#6B7480`; **short** `#FDEEE1` disc with "32/60" mono 11 `#7A4A02` before it.

```html
<div style="background: #FFFFFF; border-radius: 16px; box-shadow: inset 0 0 0 1px #E6E3DD; padding: 4px 14px; display: flex; flex-direction: column">
  <div style="display: flex; align-items: center; gap: 8px; min-height: 40px; border-bottom: 1px solid #EFECE6">
    <span style="flex: 1; font-size: 13px; font-weight: 700; color: #5F6980">What Kato gets</span>
    <span style="display: flex; align-items: center; gap: 8px"><span aria-hidden="true" style="display: flex; gap: 3px"><span style="width: 18px; height: 6px; border-radius: 999px; background: #0F6B43"></span><span style="width: 18px; height: 6px; border-radius: 999px; background: #F5B26B"></span></span><span style="font-family: 'IBM Plex Mono', monospace; font-size: 12px; font-weight: 600; color: #0F6B43">1 of 2 packed</span></span>
  </div>
  <div style="display: flex; align-items: center; gap: 10px; min-height: 52px; border-bottom: 1px solid #EFECE6">
    <span aria-hidden="true" style="width: 34px; height: 34px; flex: none; border-radius: 9px; background: linear-gradient(145deg, #DCEAF8 0%, #FFFFFF 150%); box-shadow: inset 0 0 0 1px rgba(0,0,0,.035); display: flex; align-items: center; justify-content: center"><svg width="20" height="20" viewBox="0 0 256 256" fill="#1A5A8A" aria-hidden="true"><path d="M216,116.69V216H152V152H104v64H40V116.69l82.34-82.35a8,8,0,0,1,11.32,0Z" opacity="0.2"/><path d="M240,208H224V136l2.34,2.34A8,8,0,0,0,237.66,127L139.31,28.68a16,16,0,0,0-22.62,0L18.34,127a8,8,0,0,0,11.32,11.31L32,136v72H16a8,8,0,0,0,0,16H240a8,8,0,0,0,0-16ZM48,120l80-80,80,80v88H160V152a8,8,0,0,0-8-8H104a8,8,0,0,0-8,8v56H48Zm96,88H112V160h32Z"/></svg></span>
    <span style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px"><span style="font-size: 14px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">Iron sheet G28 · 3m</span><span style="font-family: 'IBM Plex Mono', monospace; font-variant-numeric: tabular-nums; font-size: 12px">40 <span style="font-family: Figtree, sans-serif">pc</span> · 1,520,000</span></span>
    <span style="display: flex; align-items: center; gap: 6px; flex: none"><span style="font-size: 11px; font-family: 'IBM Plex Mono', monospace; font-weight: 600; color: #6B7480">10:30</span><span role="img" aria-label="Packed at 10:30" style="width: 24px; height: 24px; flex: none; border-radius: 999px; background: #0F6B43; color: #FFFFFF; display: flex; align-items: center; justify-content: center"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7"/></svg></span></span>
  </div>
  <div style="display: flex; align-items: center; gap: 10px; min-height: 52px; border-bottom: 1px solid #EFECE6">
    <span aria-hidden="true" style="width: 34px; height: 34px; flex: none; border-radius: 9px; background: linear-gradient(145deg, #FBE5E2 0%, #FFFFFF 150%); box-shadow: inset 0 0 0 1px rgba(0,0,0,.035); display: flex; align-items: center; justify-content: center"><svg width="20" height="20" viewBox="0 0 256 256" fill="#8E2A22" aria-hidden="true"><path d="M245.66,129,217,157.66a8,8,0,0,1-11.3,0L168.1,120l-28,28-32-32,28-28L80,31.78a87.81,87.81,0,0,1,98.31,18l67.35,67.89A8,8,0,0,1,245.66,129Z" opacity="0.2"/><path d="M251.34,112,183.88,44.08a96.1,96.1,0,0,0-135.77,0l-.09.09L34.25,58.4A8,8,0,0,0,45.74,69.53L59.47,55.35a79.92,79.92,0,0,1,18.71-13.9L124.68,88l-96,96a16,16,0,0,0,0,22.63l20.69,20.69a16,16,0,0,0,22.63,0l96-96,14.34,14.34h0L200,163.3a16,16,0,0,0,22.63,0l28.69-28.69A16,16,0,0,0,251.34,112ZM60.68,216,40,195.31l68-68L128.68,148ZM162.34,114.32,140,136.67,119.31,116l22.35-22.35a8,8,0,0,0,0-11.32L94.32,35a80,80,0,0,1,78.23,20.41l44.22,44.51L188,128.66l-14.34-14.34A8,8,0,0,0,162.34,114.32Zm49,37.66-12-12L228,111.25l12,12Z"/></svg></span>
    <span style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px"><span style="font-size: 14px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">Wheelbarrow, heavy duty</span><span style="font-family: 'IBM Plex Mono', monospace; font-variant-numeric: tabular-nums; font-size: 12px">2 <span style="font-family: Figtree, sans-serif">pc</span> · 290,000</span></span>
    <span style="display: flex; align-items: center; gap: 6px; flex: none"><span style="font-size: 11px; font-weight: 700; color: #7A4A02">packing</span><span role="img" aria-label="Packing now" style="width: 24px; height: 24px; flex: none; border-radius: 999px; border: 2.5px solid #F5B26B; border-top-color: transparent; box-sizing: border-box"></span></span>
  </div>
  <div style="display: flex; align-items: center; gap: 10px; min-height: 52px">
    <span aria-hidden="true" style="width: 34px; height: 34px; flex: none; border-radius: 9px; background: #FBE5E2; display: flex; align-items: center; justify-content: center"><svg width="20" height="20" viewBox="0 0 256 256" fill="#8E2A22" aria-hidden="true"><path d="M200,40V224H56V40a8,8,0,0,1,8-8H192A8,8,0,0,1,200,40Z" opacity="0.2"/><path d="M232,216H208V40a16,16,0,0,0-16-16H64A16,16,0,0,0,48,40V216H24a8,8,0,0,0,0,16H232a8,8,0,0,0,0-16ZM64,40H192V216H64Zm104,92a12,12,0,1,1-12-12A12,12,0,0,1,168,132Z"/></svg></span>
    <span style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px"><span style="font-size: 14px; font-weight: 600; color: #6B7480; text-decoration: line-through; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">Soft close hinge · flat</span><span style="font-family: 'IBM Plex Mono', monospace; font-size: 12px; color: #6B7480; text-decoration: line-through">10 <span style="font-family: Figtree, sans-serif">pair</span> · not found</span></span>
    <span role="img" aria-label="Not found" style="width: 24px; height: 24px; flex: none; border-radius: 999px; background: #8E2A22; color: #FFFFFF; display: flex; align-items: center; justify-content: center"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></span>
  </div>
</div>
```

The snippet is as built on OR07Packing (#0552 at 10:41: one line packed at 10:30, one packing, one dropped). The receipt slip variant (the agent's "What Mukasa gets" with zig-zag edges) is used for **Placed** and **Receipt** only.

### P21 · The 3-up action tiles

**Joined bar** (the live agent, preferred on an order or a customer): one white card radius 20, three equal buttons split by `1px #F1EEE8`; each a 42 px tinted disc (call `#E4E6FA`/`#3A3F9B`, tell `#E4F4EA`/`#0F6B43`, receipt `#DCEAF8`/`#1A5A8A`, change `#FDEEE1`/`#7A4A02`) over the label 13/700 and a sub 11/600 `#6B7480`.

```html
<div style="display: flex; background: #FFFFFF; border-radius: 20px; box-shadow: inset 0 0 0 1px #E6E3DD; overflow: hidden">
  <a href="tel:0772418220" style="flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 12px 4px 10px; text-align: center; color: #1C2233">
    <span aria-hidden="true" style="width: 42px; height: 42px; border-radius: 999px; background: #E4E6FA; color: #3A3F9B; display: flex; align-items: center; justify-content: center; margin-bottom: 2px"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/></svg></span>
    <span style="font-size: 13px; font-weight: 700">Call</span><span style="font-size: 11px; font-weight: 600; color: #6B7480">Kato</span>
  </a>
  <a href="OR10Tell.dc.html" style="flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 12px 4px 10px; text-align: center; color: #1C2233; border-left: 1px solid #F1EEE8">
    <span aria-hidden="true" style="width: 42px; height: 42px; border-radius: 999px; background: #E4F4EA; color: #0F6B43; display: flex; align-items: center; justify-content: center; margin-bottom: 2px"><svg width="19" height="19" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M128,32A96,96,0,0,0,44.89,176.07L32.42,213.46a8,8,0,0,0,10.12,10.12l37.39-12.47A96,96,0,1,0,128,32Zm24,152a80,80,0,0,1-80-80,32,32,0,0,1,32-32l16,32-12.32,18.47a48.19,48.19,0,0,0,25.85,25.85L152,136l32,16A32,32,0,0,1,152,184Z" opacity="0.2"/><path d="M187.58,144.84l-32-16a8,8,0,0,0-8,.5l-14.69,9.8a40.55,40.55,0,0,1-16-16l9.8-14.69a8,8,0,0,0,.5-8l-16-32A8,8,0,0,0,104,64a40,40,0,0,0-40,40,88.1,88.1,0,0,0,88,88,40,40,0,0,0,40-40A8,8,0,0,0,187.58,144.84ZM152,176a72.08,72.08,0,0,1-72-72A24,24,0,0,1,99.29,80.46l11.48,23L101,118a8,8,0,0,0-.73,7.51,56.47,56.47,0,0,0,30.15,30.15A8,8,0,0,0,138,155l14.62-9.74,23,11.48A24,24,0,0,1,152,176ZM128,24A104,104,0,0,0,36.18,176.88L24.83,210.93a16,16,0,0,0,20.24,20.24l34.05-11.35A104,104,0,1,0,128,24Zm0,192a87.87,87.87,0,0,1-44.06-11.81,8,8,0,0,0-6.54-.67L40,216,52.47,178.6a8,8,0,0,0-.66-6.54A88,88,0,1,1,128,216Z"/></svg></span>
    <span style="font-size: 13px; font-weight: 700">Tell them</span><span style="font-size: 11px; font-weight: 600; color: #6B7480">it's packing</span>
  </a>
  <a href="OR07Packing.dc.html" style="flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 12px 4px 10px; text-align: center; color: #1C2233; border-left: 1px solid #F1EEE8">
    <span aria-hidden="true" style="width: 42px; height: 42px; border-radius: 999px; background: #DCEAF8; color: #1A5A8A; display: flex; align-items: center; justify-content: center; margin-bottom: 2px"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6M9 16h3"/></svg></span>
    <span style="font-size: 13px; font-weight: 700">Receipt</span><span style="font-size: 11px; font-weight: 600; color: #6B7480">1,810,000</span>
  </a>
</div>
```

**Separate tiles** (the canvas Track; use when a fourth act, "Something wrong", joins): 56 tall, radius 16, white hairline, icon 20 over label 12/700, grid of 3 or 4, gap 8.

### P22 · The full-screen "Sent" moment

As built: SL28Placed ("Placed"), CU40Paid ("Paid"), KC14Sold ("Sold").

Navy ground, no tab bar. Top right a 44 px glass ×. Centre at 30%: the tick (96 px mint disc, navy tick 46 at 2.8, a faint 3 px mint ring around it), the title 30/700 white, the who-chip (40 tall, `rgba(255,255,255,.08)`, avatar 30, name 14/600, mono amount 13 `#B3BCD2`). Then "What happens next" as a glass card of steps (40 px squares, the first in mint). Bottom: one white button with the next move, and a 4 px mint progress bar that returns to Today by itself. Sales words: **"Placed"** for an order, **"Sold"** for a counter sale, **"Paid"** for a payment.

```html
<div style="width: 360px; height: 800px; position: relative; overflow: hidden; background: #16203C; font-family: Figtree, system-ui, sans-serif; color: #FFFFFF">
  <div style="position: absolute; inset: 0; padding: 16px 20px 24px; display: flex; flex-direction: column; gap: 22px">
    <div style="display: flex; justify-content: flex-end"><a href="TD01Today.dc.html" aria-label="Close" style="width: 44px; height: 44px; border-radius: 999px; background: rgba(255,255,255,.08); color: #FFFFFF; display: flex; align-items: center; justify-content: center"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></a></div>
    <div style="display: flex; flex-direction: column; align-items: center; gap: 14px; text-align: center; padding-top: 40px">
      <span aria-hidden="true" style="width: 96px; height: 96px; border-radius: 999px; background: #6FDCB0; color: #16203C; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 0 10px rgba(111,220,176,.12)"><svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7"/></svg></span>
      <h1 style="margin: 6px 0 0; font-size: 30px; font-weight: 700; letter-spacing: -.02em">Placed</h1>
      <span style="display: flex; align-items: center; gap: 8px; height: 40px; padding: 0 14px 0 5px; border-radius: 999px; background: rgba(255,255,255,.08)"><span aria-hidden="true" style="width: 30px; height: 30px; border-radius: 999px; background: #DCEAF8; color: #1A5A8A; font-size: 11px; font-weight: 700; display: flex; align-items: center; justify-content: center">KC</span><span style="font-size: 14px; font-weight: 600">Kato Construction</span><span style="font-family: 'IBM Plex Mono', monospace; font-size: 13px; color: #B3BCD2">#0552 · 1,750,000</span></span>
    </div>
    <!-- "What happens next" glass card, then: -->
    <div style="margin-top: auto; display: flex; flex-direction: column; gap: 14px">
      <a href="TD01Today.dc.html" style="height: 56px; border-radius: 14px; background: #FFFFFF; color: #16203C; font-size: 16px; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 8px">Back to Today</a>
      <span aria-hidden="true" style="display: block; height: 4px; border-radius: 999px; background: rgba(255,255,255,.1); overflow: hidden"><span style="display: block; width: 60%; height: 100%; border-radius: 999px; background: #6FDCB0"></span></span>
    </div>
  </div>
</div>
```

The end-of-flow rule: one button, one label, the same on every such screen: **"Back to Today"**. A second, quieter move ("Sell again", "Tell Kato") is a glass pill above it, never a second big button.

The "What happens next" card: `rgba(255,255,255,.06)`, radius 20, padding 16; eyebrow 12/700 .06em uppercase `#B3BCD2`; each step a 40 px square (radius 12, `rgba(255,255,255,.1)`, icon 20 `#B3BCD2`; the current one mint with navy icon), the step 15/600 white and its sub 12/600 `#B3BCD2` (mint on the current one), joined by a 2 × 14 px `rgba(255,255,255,.14)` line at x 19.

### P23 · Chips and status pills

| Kind | Height | Look | Use |
|---|---|---|---|
| **Filter chip** off | 44 | white, `inset 0 0 0 1px #E6E3DD`, 13/700 ink, mono count 600 at .7 opacity | Narrow a list (Sales draws 44; the agent's are 36) |
| **Filter chip** on | 44 | `#16203C`, white | The chosen filter |
| **Status pill** good | 30 (24 small) | `#E4F4EA` / `#0F6B43`, 13/700 (12 small) | Paid, Delivered, In |
| **Status pill** caution | 30 / 24 | `#FDEEE1` / `#7A4A02` | Not paid yet, Price coming, Owes |
| **Status pill** bad | 30 / 24 | `#FBE5E2` / `#8E2A22` | Out, Dropped, Void |
| **Status pill** info | 28 | `#E3EEFB` / `#1A5A8A` with a stage icon 14 | Checking, Buying, Packing, On the road |
| **Status pill** neutral | 30 / 24 | `#F1EEE8` / `#5F6980` | Done, quiet, a count |
| **Status pill** dark | 32 | `#16203C` / white, a mint icon | A total with weight ("9.6M to take") |
| **Action pill** (in a row) | 32 visible | tone soft + tone ink, 13/700, mono amount | "Take 1.1M", "Collect" |
| **On-navy pill** | 26 to 28 | `rgba(111,220,176,.16)` / mint, or `rgba(245,178,107,.16)` / `#F5B26B`, or `rgba(255,255,255,.1)` / `#DDE3F0` | Tags on the dark card and heads |
| **Earn chip** (mono) | 26 | `#E4F4EA` / `#0F6B43`, radius 8, padding `5px 8px` | A positive amount on a line |
| **Code chip** | 26 | `#16203C` / mint mono 12, radius 8 | A pickup code |

Status pills:

```html
<span style="display: inline-flex; align-items: center; gap: 5px; height: 28px; padding: 0 10px 0 8px; border-radius: 999px; background: #E3EEFB; color: #1A5A8A; font-size: 12px; font-weight: 700; white-space: nowrap"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 4h6v3H9zM7 5.5H5V21h14V5.5h-2M9 14l2 2 4-4"/></svg>Checking</span>
<span style="display: inline-flex; align-items: center; gap: 5px; height: 24px; padding: 0 8px; border-radius: 999px; background: #FDEEE1; color: #7A4A02; font-size: 12px; font-weight: 700; white-space: nowrap">Not paid yet</span>
<span style="display: inline-flex; align-items: center; gap: 5px; height: 24px; padding: 0 8px; border-radius: 999px; background: #E4F4EA; color: #0F6B43; font-size: 12px; font-weight: 700; white-space: nowrap"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7"/></svg>Paid</span>
<span style="display: inline-flex; align-items: center; gap: 5px; height: 24px; padding: 0 8px; border-radius: 999px; background: #FBE5E2; color: #8E2A22; font-size: 12px; font-weight: 700; white-space: nowrap">Out</span>
<span style="display: inline-flex; align-items: center; gap: 5px; height: 24px; padding: 0 8px; border-radius: 999px; background: #F1EEE8; color: #5F6980; font-size: 12px; font-weight: 700; white-space: nowrap">Delivered</span>
<span style="display: inline-flex; align-items: center; gap: 6px; height: 32px; padding: 0 11px; border-radius: 999px; background: #16203C; color: #FFFFFF; font-size: 12px; font-weight: 700; white-space: nowrap"><svg width="14" height="14" viewBox="0 0 256 256" fill="#F5B26B" aria-hidden="true"><path d="M240,132c0,19.88-35.82,36-80,36-19.6,0-37.56-3.17-51.47-8.44h0C146.76,156.85,176,142,176,124V96.72h0C212.52,100.06,240,114.58,240,132ZM176,84c0-19.88-35.82-36-80-36S16,64.12,16,84s35.82,36,80,36S176,103.88,176,84Z" opacity="0.2"/><path d="M184,89.57V84c0-25.08-37.83-44-88-44S8,58.92,8,84v40c0,20.89,26.25,37.49,64,42.46V172c0,25.08,37.83,44,88,44s88-18.92,88-44V132C248,111.3,222.58,94.68,184,89.57ZM232,132c0,13.22-30.79,28-72,28-3.73,0-7.43-.13-11.08-.37C170.49,151.77,184,139,184,124V105.74C213.87,110.19,232,122.27,232,132ZM72,150.25V126.46A183.74,183.74,0,0,0,96,128a183.74,183.74,0,0,0,24-1.54v23.79A163,163,0,0,1,96,152,163,163,0,0,1,72,150.25Zm96-40.32V124c0,8.39-12.41,17.4-32,22.87V123.5C148.91,120.37,159.84,115.71,168,109.93ZM96,56c41.21,0,72,14.78,72,28s-30.79,28-72,28S24,97.22,24,84,54.79,56,96,56ZM24,124V109.93c8.16,5.78,19.09,10.44,32,13.57v23.37C36.41,141.4,24,132.39,24,124Zm64,48v-4.17c2.63.1,5.29.17,8,.17,3.88,0,7.67-.13,11.39-.35A121.92,121.92,0,0,0,120,171.41v23.46C100.41,189.4,88,180.39,88,172Zm48,26.25V174.4a179.48,179.48,0,0,0,24,1.6,183.74,183.74,0,0,0,24-1.54v23.79a165.45,165.45,0,0,1-48,0Zm64-3.38V171.5c12.91-3.13,23.84-7.79,32-13.57V172C232,180.39,219.59,189.4,200,194.87Z"/></svg><b style="font-family: 'IBM Plex Mono', monospace; font-weight: 600">1.9M</b></span>
```

A filter chip row:

```html
<div role="group" aria-label="Show" style="display: flex; align-items: center; gap: 6px; overflow-x: auto; margin: 0 -16px; padding: 0 16px">
  <button type="button" aria-pressed="true" style="flex: none; height: 44px; padding: 0 14px; border-radius: 999px; border: none; background: #16203C; color: #FFFFFF; font-size: 13px; font-weight: 700; display: flex; align-items: center; gap: 6px">All<b style="font-family: 'IBM Plex Mono', monospace; font-weight: 600; opacity: .7">20</b></button>
  <button type="button" aria-pressed="false" style="flex: none; height: 44px; padding: 0 14px; border-radius: 999px; border: none; background: #FFFFFF; box-shadow: inset 0 0 0 1px #E6E3DD; color: #1C2233; font-size: 13px; font-weight: 700; display: flex; align-items: center; gap: 6px"><span aria-hidden="true" style="width: 8px; height: 8px; border-radius: 999px; background: #F5B26B"></span>Checking<b style="font-family: 'IBM Plex Mono', monospace; font-weight: 600; opacity: .7">3</b></button>
</div>
```

### P24 · The empty state, the agent's way

As built: OR04Empty, CH06ChatsEmpty, CU06CustomersNobodyOwes.

Never a blank screen with a sentence. Show a **ghost of what is coming** (the real layout, drawn dashed or faint, with the shapes of what will fill it), then **a checklist of the first moves** (one done, the next one live), then **one way in** (a navy block button).

The ghost card is the real card drawn as an outline: `border: 1.5px dashed #C9C4BA`, transparent, its tiles as dashed outlines (`#D8D3C9`), icons and labels in `#5F6980` (on the warm ground grey text is never lighter). Its header 14/700 `#5F6980` with the right meta "fills as you sell" 12/600 `#5F6980`. No hatching, no washes.

```html
<div style="border: 1.5px dashed #C9C4BA; border-radius: 16px; padding: 10px; display: flex; flex-direction: column; gap: 8px">
  <div style="display: flex; justify-content: space-between; padding: 2px 4px"><span style="font-size: 14px; font-weight: 700; color: #5F6980">On the move</span><span style="font-size: 12px; font-weight: 600; color: #5F6980">fills as you sell</span></div>
  <div aria-hidden="true" style="display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px">
    <span style="height: 72px; border-radius: 12px; border: 1.5px dashed #D8D3C9; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; color: #5F6980; font-size: 11px; font-weight: 600"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 4h6v3H9zM7 5.5H5V21h14V5.5h-2M9 14l2 2 4-4"/></svg>Checking</span>
    <span style="height: 72px; border-radius: 12px; border: 1.5px dashed #D8D3C9; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; color: #5F6980; font-size: 11px; font-weight: 600"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 4h2.5l2.2 11h10.6l2-8H6.3"/><circle cx="9" cy="19" r="1.5"/><circle cx="17" cy="19" r="1.5"/></svg>Buying</span>
    <span style="height: 72px; border-radius: 12px; border: 1.5px dashed #D8D3C9; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; color: #5F6980; font-size: 11px; font-weight: 600"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5zM3.5 7.5 12 12l8.5-4.5M12 12v9"/></svg>Packing</span>
    <span style="height: 72px; border-radius: 12px; border: 1.5px dashed #D8D3C9; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; color: #5F6980; font-size: 11px; font-weight: 600"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h11v10H3zM14 9h4l3 3v4h-7"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/></svg>On the road</span>
  </div>
</div>
```

The checklist ("Get going", with "1 of 3" in mono 13/600 `#0F6B43`): a white group card, rows 60 tall; a done row has a 30 px `#0F6B43` disc with a white tick and its title struck through in `#6B7480` with "done today" under; an open row has a 30 px disc with a `1.5px #C9C4BA` ring and the step's icon in `#5F6980`, title 14/700, sub 12/600 `#6B7480`, and a chevron.

The one way in, a navy block button (P26).

### P25 · Skeleton loading

As built: CU08CustomersLoading, CH07ChatsLoading.

Draw the real layout with shimmer blocks where text and figures will be. A block: `border-radius: 6px; background: linear-gradient(90deg, #EDEAE4 0%, #F7F5F2 40%, #EDEAE4 80%); background-size: 300% 100%; animation: owShim 1.4s linear infinite`. On white cards the same. Tiles keep their real size (an aisle tile skeleton is a 92 px white card with a 38 px block and two lines at 70% and 40%). A small "Getting the shop list" pill with a 14 px ring spinner (`2px solid #C9C4BA`, top transparent) sits at the section header's right. The dock stays (empty state); the head stays (real greeting, figures as blocks).

```html
<span aria-hidden="true" style="display: block; height: 11px; width: 70%; border-radius: 6px; background: linear-gradient(90deg, #EDEAE4 0%, #F7F5F2 40%, #EDEAE4 80%); background-size: 300% 100%; animation: owShim 1.4s linear infinite"></span>
```

On navy: `linear-gradient(90deg, rgba(255,255,255,.06) 0%, rgba(255,255,255,.14) 40%, rgba(255,255,255,.06) 80%)`.

### P26 · Primary buttons, and when red

| Button | Look | When |
|---|---|---|
| **Navy block** | `#16203C`, white 16/700, 56 tall, radius 14 (or 18 for the Finish bar), icon 18 left | The screen's one step that is not money: "Send to Ruth", "Add a customer", "Save", "Give to Brian" |
| **Red block** | `#C93A30`, white 16/700, 56 tall, radius 14, icon 18 | Only when the act commits money or cannot be undone **and** a slide does not fit: "Take 420,000" in a payment sheet, "Cancel order" (in the pair "Keep order" / "Cancel order") |
| **The slide** | P15 | Committing an order, a counter sale, a payment. The slide is the default for money |
| **White on navy** | `#FFFFFF`, `#16203C` 15 to 16/700, 48 to 56 tall, radius 14 | The one move on a navy surface (dark card, Sent) |
| **Ghost** | white, `inset 0 0 0 1px #E6E3DD`, ink 15/700, 52 tall, radius 14 | The quiet second choice beside a primary ("Keep order", "Send as SMS") |
| **WhatsApp green** | `#0F6B43`, white 16/700, 56 tall, radius 14, the duotone WhatsApp 20 | Sending a message out of the app ("Send on WhatsApp") |

Rule: **one primary per screen**. Navy is the default primary. Red is the one move that commits money or ends something, and it appears at most once per screen; when the screen has the red + or a slide, no red block appears on it. Pressed: navy `#243052`, red `#A82D24`. Disabled: 45% opacity and no shadow. Sending: the label becomes "Sending…" with a 16 px white ring spinner, the button keeps its colour.

```html
<a href="CU20NewCustomer.dc.html" style="height: 56px; border-radius: 14px; background: #16203C; color: #FFFFFF; font-size: 16px; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 8px"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="10" cy="8" r="4"/><path d="M3 21c0-3.9 3.1-7 7-7 1.4 0 2.7.4 3.8 1.1M18 14v6M15 17h6"/></svg>Add a customer</a>
<button type="button" style="height: 56px; width: 100%; border: none; border-radius: 14px; background: #C93A30; color: #FFFFFF; font-size: 16px; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 8px"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2.5" y="6" width="19" height="12" rx="2"/><circle cx="12" cy="12" r="2.6"/><path d="M6 12h.01M18 12h.01"/></svg>Take 420,000</button>
```

**The Finish bar** (end of a done order, navy 58 tall, radius 18, a mint tick, the label, and a mint glass chip at the right):

```html
<a href="TD01Today.dc.html" style="min-height: 58px; border-radius: 18px; background: #16203C; color: #FFFFFF; display: flex; align-items: center; gap: 12px; padding: 0 8px 0 18px; box-shadow: 0 10px 24px rgba(22,32,60,.22)"><span style="display: flex; color: #6FDCB0"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7"/></svg></span><span style="flex: 1; font-size: 16px; font-weight: 700">Finish</span><span style="height: 42px; padding: 0 12px; border-radius: 12px; background: rgba(111,220,176,.16); color: #6FDCB0; display: flex; align-items: center; font-family: 'IBM Plex Mono', monospace; font-size: 14px; font-weight: 600">Paid 1,810,000</span></a>
```

### P27 · The notice bar (offline, updating, paused)

A full-width bar directly under the head (or above the dock when the dock is the subject): 44 tall minimum, padding `10px 16px`, 13/600, icon 18.

- **Offline / Not sent yet**: `#FDEEE1`, ink text, the offline icon in `#95530C`: "No signal · 2 not sent yet, kept on this phone". Right: a 32 px pill "Try again" `#FFFFFF` / `#7A4A02` (in a 44 px link).
- **Someone else just did this**: `#E3EEFB`, `#1A5A8A` text and icon (undo): "Someone else just did this · Refreshed".
- **Paused**: `#16203C`, white text, a mint pause icon.

```html
<div role="status" style="display: flex; align-items: center; gap: 10px; min-height: 44px; padding: 10px 16px; background: #FDEEE1; color: #1C2233; font-size: 13px; font-weight: 600; line-height: 1.35">
  <span style="display: flex; color: #95530C"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3l18 18M8.5 16.5a5 5 0 0 1 7 0M5 12.5a10 10 0 0 1 4.2-2.5M14.8 10a10 10 0 0 1 4.2 2.5M2 8.8a15 15 0 0 1 4.2-2.6M10.5 5.1A15 15 0 0 1 22 8.8M12 20h.01"/></svg></span>
  <span style="flex: 1">No signal · <b style="font-family: 'IBM Plex Mono', monospace; font-weight: 600">2</b> not sent yet</span>
  <button type="button" style="border: none; padding: 0; font-family: inherit; padding: 6px 0; display: flex"><span style="height: 32px; padding: 0 12px; border-radius: 999px; background: #FFFFFF; color: #7A4A02; font-size: 13px; font-weight: 700; display: flex; align-items: center">Try again</span></button>
</div>
```

### P28 · Toasts

Top centre, 14 px under the top edge, width max-content up to 328, 44 tall minimum, radius 24, padding `8px 18px 8px 8px`, 14/600, navy, a 28 px mint disc with a navy tick (15 at 3). **Warn**: `#FDEEE1` with `1px #F3D3B0` border, `#7A4A02` text 700, the disc `#95530C` with white !. **Undo** variant: a toast with a 44 px "Undo" button in mint at the right (10 seconds); the toast is then 60 px tall. **Error** (bottom, above the tab bar or dock): white card, radius 20, `1.5px solid #E8B4AE`, a 36 px `#8E2A22` disc, title 14/700 `#8E2A22`, sub 13/500 `#5F6980`, a 40 px red "Try again" and a 44 px ×.

```html
<div role="status" style="position: absolute; top: 14px; left: 50%; transform: translateX(-50%); display: flex; align-items: center; gap: 10px; min-height: 44px; padding: 8px 8px 8px 8px; border-radius: 24px; background: #16203C; color: #FFFFFF; font-size: 14px; font-weight: 600; line-height: 1.3; box-shadow: 0 10px 28px rgba(22,32,60,.25); white-space: nowrap">
  <span aria-hidden="true" style="width: 28px; height: 28px; flex: none; border-radius: 999px; background: #6FDCB0; color: #16203C; display: flex; align-items: center; justify-content: center"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7"/></svg></span>
  <span>Added 40 bags</span>
  <button type="button" style="height: 44px; padding: 0 14px; border: none; border-radius: 999px; background: rgba(255,255,255,.1); color: #6FDCB0; font-size: 13px; font-weight: 700">Undo</button>
</div>
```

### P29 · The usual card (a regular customer's usual, on the order)

White, radius 20, `lift`, padding 12, gap 10. Header: a 32 px `#F1EEE8` square with the duotone again icon 18, "Kato's usual" 14/700 with a 4 px segmented bar under it (one segment per item, `#0F6B43` for each already in), "2/3" mono 13/600 `#0F6B43`. Kato's usual is Cement ("every order"), Iron sheet ("5 of 7") and Wire nails 4" ("3 of 7"). Then up to four tiles (92 tall, radius 16): **in** = white with `inset 0 0 0 1.5px #0F6B43`, the aisle square 40, the name 12/700, "every order" 11/600 `#0F6B43`, a 20 px green tick badge; **to add** = the navy tile with the item's icon in a 36 px glass square, name 12/700 white, "×2" mono 11 `#6FDCB0`, a 22 px mint + badge. A usual of one item is one 76 px navy row with a 52 px square, the name 15/700, "×40 bag · 1,340,000" mono 12 mint and a 44 px mint + disc. All in: a 44 px `#E4F4EA` bar, `<svg width="18" height="18" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm45.66,85.66-56,56a8,8,0,0,1-11.32,0l-24-24a8,8,0,0,1,11.32-11.32L112,148.69l50.34-50.35a8,8,0,0,1,11.32,11.32Z"/></svg>` "Kato's usual is in" 14/700 `#0F6B43`.

(Badge text sizes on tiles are 11 px minimum in Sales; the agent canvas has 10 px there.)

---

## 4. Composition rules

### 4.1 Measures

- Gutter 16. Card padding 10 (a tile card), 12 (a line, a usual card), 14 (a money tile, a list card's sides 12 to 14), 16 (a dark card, a sheet body).
- Gaps: 6 inside a tile grid, 8 between stacked rows and chips, 10 between blocks on Today, 12 on the order and inside sheets, 14 to 16 inside heads and the dark card, 16 between groups on a list page.
- Radii by size: the bigger the surface, the rounder (8 chip → 12 tile → 16 card → 18 group → 20 usual / action bar → 22 dark card → 26 sheet and dock → 28 head).
- A white card always has the `hair` shadow (inset outline). Never a 1 px CSS border on a white card except `.ax-card`-style where the agent uses it (money tiles, the check list); both read the same.
- Rows: 48 (act row in a card), 52 (check list), 58 to 60 (Needs you), 64 (customer, "Often with"), 66 (Then, chats).

### 4.2 Filling the screen to the bottom

The agent never leaves a hole. In order of preference:

1. **The next thing down the day.** Today runs hero → On the move → Needs you → Next move (the dark card) → Then (a list) to the tab bar. A list page runs head → chips → groups (each with a header, a sum and "Show 6 more") to the bar.
2. **Pin the acts to the bottom** of a sheet: `margin-top: auto` on the action bar / the one button, so the space between is the content's own breathing room, not a gap in the middle (Track: money tiles and check list up top, Call · Tell · Receipt at the foot).
3. **The dock owns the bottom** of the order: line cards, "Often with", aisle chips and "You sell most" fill above it.
4. **Something useful, quietly**: "Often with", "You sell most" (a horizontal shelf of 148 × 226 cards), "Who gets you there" (customers who would close the goal), a map strip on a delivery.
5. A true empty state uses the ghost + checklist + one way in (P24), never a lone sentence.

Check every board at 360 × 800 for: text under the tab bar, the dock or the red + (the red + rises 26 px above the bar at the centre: keep the last 110 px of the centre column free of text).

### 4.3 Show, don't tell (the techniques)

| Technique | Example in the agent | Sales use |
|---|---|---|
| A **ring** that fills | The due ring around a client's avatar; the goal ring | Due ring on every customer; the goal ring on Goal |
| A **bar** with a second tone | The goal bar's white "earned" plus mint "on the move"; "Pay shop / you keep" split bar | Goal bar; "Being checked" money split (S06) |
| A **segmented bar** | "Kato's usual" 2 of 3 in; "Packing 30" coloured by age | Orders head stage bar (P03b); how many lines confirmed |
| **Tiles with counts** | On the move: Basket 1 · Sent 1 · Packing 1 · Out 2 | On the move by stage (P07) |
| A **face stack** | Who is in each stage, as tinted initials | Who is in each stage; who is due on a day |
| **Dots and badges** | An amber dot = money waits; a numbered badge = how many need you | Same tones, same places |
| **Step tiles / a rail** | Sent → Checked → Paid → Packing → Ready → Done with times | Checking → Buying → Packing → On the road → Delivered |
| **Day blocks** | A block per day since their last order, amber past their rhythm | One customer's rhythm (S08 reuse) |
| **The week strip** | Late · Today · Fri … with counts and face dots | Customers who are due this week |
| **Struck-through old value** | 4,004,000 crossed beside 3,620,000 | A price changed, a line dropped, a payment corrected |
| **Tone for state, tint for identity** | Amber means you, green means done, blue means the shop; avatar colours never mean state | Same |
| **A tick per line** | Each line ticked as its supplier answers | Each line ticked as the Buyer confirms it |
| **A map strip** | "Arrives ~11:40", the van on the route | On the road |

One line of words only where a picture cannot carry it, and it says the next step ("Ruth says yes before it is packed").

### 4.4 Cutting steps (the patterns)

| Pattern | Agent | Sales |
|---|---|---|
| **Resume** | "Still open" baskets first in "Who's buying?" (Sales: "Who is it for?"), a Resume button on each | Orders not placed yet first in "Who is it for?"; the red + badge counts them |
| **Act from the row** | "Pay 1.2M", "Collect", "Say hi", "+", "→" on the row itself | "Take 1.1M", "Reply", "Tell", "+" on the row; no detour through a detail screen |
| **Slide** | One slide sends the order; no review page ("this is the review") | Slide to place / sell / record |
| **Prefill** | The usual drops in as tiles; last price and shop price one tap away; "Read as ×40 cement" from speech | Their usual; the shop's price prefilled; the amount owed prefilled in Take payment; "Exact" for cash |
| **Play all** | "Play all 6 · +71k" walks every next move one after another | Play all: every customer to call or tell, one after another |
| **Undo, not confirm** | Removing a line shows Undo for 10 s | Same, everywhere (GLOSSARY: 10 seconds) |
| **One sheet, not a page** | Track, Client, Money come up over where you were | One order, one customer, one chat |
| **Say it** | The mic reads "forty bags of cement and two cartons of four inch nails" | Same on the order and the counter |

### 4.5 Where red goes, where navy goes

- **Red** `#C93A30`: the red + (always), the slide knob, at most one red block per screen for the money step or an ending (Cancel order). A red count is never used: counts that need you are crimson `#8E2A22` (dark) or warn `#95530C`.
- **Navy** `#16203C`: every head and the dock (state and money), the dark card (the best play), the primary block button, the dark round + on a suggestion, the "on" filter chip, the dark act pill in a Needs-you row, toasts.
- **White** carries work (cards, rows, fields). **Mint** only on navy. **Amber** means "you". **Green** means done or money in. **Blue** means the shop has it.

### 4.6 The voice

- Verb first, two or three words: "Order usual", "Take payment", "Tell them", "Ask Musa", "Say hi", "Resume", "Collect", "Play all 4".
- State in plain words, sentence case, with the number in mono: "Packing 2+ days", "4 days late · every 14 days", "Due today", "2 of 3 came".
- Sub-lines are fragments joined by " · ", never sentences: "#0552 · today 9:14", "40 bag × 33,500".
- Names, not roles: "Ruth says yes", "Esther checks it", "Musa is packing", "Ssali is on the road".
- Section heads are questions answered by the content: "On the move", "Needs you", "Next move", "Then", "Who's due", "What Kato gets".
- Sales words from GLOSSARY.md replace the agent's: **customer** (not client), **place** an order (the agent's "send"), **Take payment**, **Give change**, **Deposit**, **Not paid yet**, **Owes**, **To collect**, **Price coming**, **Being checked**, **Not sent yet**, **Try again**, **Back online to sell**, the stages **Checking · Buying · Packing · On the road · Delivered**, **Hand over**, **Sell again**, **Counter sale**, **Walk-in order**. Order numbers `#0552`. No "yours", no earnings: Sales earns no commission.

---

## 5. Sales ↔ agent mapping

### 5.1 Each Sales screen family and the agent part it reuses

| Sales family | Reuse (parts) | Agent source | Sales wording |
|---|---|---|---|
| **Today** | P02 hero (sold, goal bar, glass: on the move · to collect), P06, P07 stage tiles (4 live stages), P08 Needs you, P09 dark card, P10b Then, P16 Sales bar | Today, TodayBusy, live photo | "Sold · October", "Needs you", "Next move", "Then" |
| **Find** (search everything from Today) | P05 search row (no who pill: a back + the field), P20-style result group cards, P14 aisle tiles, P23 chips "All 6 · Customers 2 · Orders 1 · Items 3" | Find, FindGrouped, FindNone, FindRecent | "Did you mean", "Nothing called …" |
| **Goal** | P02b ring (large, 200 px dial on navy sheet top), P19 tiles, "Who gets you there" list (P10 rows with "+amount" to goal), P26 navy button for nothing (goal is set by Ruth: no "Set" button) | Goal, GoalMilestone, GoalDone | "Ruth set 35M for October" |
| **Your day** | Money sheet: P04 head with a month switcher pill, the big figure, P19 tiles; a line chart card ("The month so far"); P10b list of orders on their way | Money, MoneyPro | "Sold", "On the move", "To collect"; never "Yours" |
| **You / profile** | Profile: navy sheet top with the 84 px ring avatar, three glass stats (October · Standing · Streak → for Sales: Sold · Orders · Customers), shop card, toggle tiles, Sign out ghost | Profile | "Signed in as Grace Akello" (display name, never the email) |
| **Asked of Sourcing** | P10b rows with a 5-step P18b dot row (Asked → Looking → Found → Priced → Listed), P23 info pills; the "Ask the shop to stock it" navy card from FindNone | FindNone, PackResults | "Asked of Sourcing", Moses by name |
| **Chats list** | P03 page head (title Chats, count, a stat line "3 waiting · oldest 12 m"), P23 chips (All · Waiting · Mine · Team), P10 rows with a time and an unread count in place of the amount | Clients (asked rows), ClientsPro | "Waiting", "Reply" |
| **One chat** | P04 head (avatar, name, "Grace's customer · owes 420k", Call), an open-order chip under it, then S01 bubbles and composer | Update (bubble), ShopContact | "Team note", "Not sent yet" |
| **Hand over** | P17 light sheet "Give Kato to…", S04 person picker, a note field, P26 navy "Give to Brian" | ClientPick (rows with a choice) | "Hand over" (verb on the button: "Give to Brian") |
| **New sale / who is it for** | P17 sheet "Who is it for?" (ClientPick): search, "Still open" resume rows, "Who's due" ring rows, a navy "New customer" button; plus a **Counter sale** row and a **Walk-in order** row at the top | ClientPick | "Who is it for?", "Counter sale", "Walk-in order" |
| **The order** | P05 top bar, P29 usual, P12 lines (+P12b stepper, S03 price keypad), P13 Often with, P14 chips and tiles, P15 dock with the slide; credit as a P19 tile on the line card or dock sub-line; short stock as the chip "12 on shelf" and a P08-style warn row "10 short · Order in the rest" | Order, OrderUsualOne, OrderNew, FindQty, FindStock | "Slide to place · 3 items", "Price coming", "Order in", "No limit set · Ruth decides" |
| **Placed** | P22 "Placed" moment with the receipt slip (P20 slip variant) and "What happens next" (Checking → Buying → Packing) | Sent, MoveSent, ThankYou | "Placed", "Back to Today" |
| **Counter sale** | P05 top bar with a "Counter sale" pill in place of the who pill, P12 lines, the dock with S02 cash control inside it, "Slide to sell · 52,000" | Order + MukasaPay | "Counter sale", "They gave", "Give change" |
| **Orders by stage** | P03 head with the P03b stage bar, S05 stage filter, S09 stage groups (header, sum, rows) (avatar 40, name 14/700, "#0552 · today 9:14" mono 11, an age chip, the amount mono 13/600, a P23 action pill or chevron) and P18b dots on an opened card | MoveSent, MovePacking, MoveOut, PackingBusy, SentBusy | stages in full |
| **One order** (Checking / Buying / Packing / On the road / Delivered) | P04 + P18 track, P19 money tiles, P20 check list, P21 joined actions (Call · Tell them · Receipt, + "Something wrong"), map strip on the road, Finish bar when delivered | Track1–5, DelOnWay, DelDone, NansubugaReady | "Ruth says yes", "Ssali · on the road", "Delivered" |
| **Tell them** | P17 light sheet "Tell Kato" with a P23 segment of three reasons, the message as an S01 outgoing bubble on the chat ground, a toggle "Attach receipt", P26 WhatsApp green + ghost "Send as SMS" | Update, WinBack | "Tell them" |
| **Something wrong** (return, void, payment wrong) | P17 light sheet "Something wrong · #0548" with the S07 picker, then the matching form; one red block "Ask Ruth" / "Ask Esther" | ChangeOpen, ChangeAsk, ChangeCancel | "Ask Ruth for the credit note", "Ask Esther to correct it" |
| **Customers list** | P03 head (stat line or week strip), P23 chips (All · Owe · Due · Quiet · New), P10 rows grouped "Reach out today" / "Coming up" / "Everyone" | ClientsPro, Clients2, QuietClients | "Owe", "Due", "Quiet" |
| **One customer** | Client sheet: P04 head with an 84 px ring avatar, day blocks (S08), three glass stats (Owes · Usual · Orders), "Their usual" tiles, recent orders with P23 pills, a red "Order their usual" | Client | "Owes", "Order their usual", "Take payment" as a P21 tile |
| **New customer** | P17 sheet: name and phone fields (labels 12/700 `#5F6980`, fields 52 tall radius 14 white hairline, focus `1.5px #16203C`), kind as a 3-way segment (Contractor · Reseller · Retail), P26 navy "Add customer" | ClientsEmpty "From contacts / Share your link" cards | "Kind: Contractor, Reseller, Retail" (Ruth changes it later) |
| **Take payment, Paid** | P04 head "Take payment · Kato Construction", the amount as a big mono field with "All 420,000 / Other" chips, S02 method picker (Cash · Mobile · Bank), bills it pays as P20-style rows with checkboxes, dock with "Slide to record 420,000"; Paid = P22 "Paid" | MukasaPay, Pay buttons | "Take payment", "Give change", "Deposit", "Paid over" |
| **Being checked** | P04 head, S06 money split, the bills as rows, a P17 sheet "What does Ggaba say?" with two radio cards, P26 red "Ask Esther" | (new) | "Being checked · Esther checks it" |

### 5.2 Sales-only parts, in the agent's voice

#### S01 · Chat bubbles and composer

The chat is a pushed sheet (P04): the `#2A3350` strip, then the sheet with top corners 26 and the chat ground `#EDE7DD`. Its navy head is the P04 head row with two glass chips under it: whose chat it is ("Grace's" with the reassign arrows, opens Hand over) and the open order ("#0552 · Packing"). Under the head, a 34 px `#E4F4EA` strip when a teammate is typing.

```html
<div style="background: #16203C; color: #FFFFFF; padding: 10px 16px 16px; display: flex; flex-direction: column; gap: 12px">
  <span aria-hidden="true" style="align-self: center; width: 40px; height: 5px; border-radius: 999px; background: rgba(255,255,255,.22)"></span>
  <div style="display: flex; align-items: center; gap: 10px">
    <a href="CU10Customer.dc.html" style="flex: 1; min-width: 0; display: flex; align-items: center; gap: 12px; min-height: 44px"><span aria-hidden="true" style="width: 44px; height: 44px; flex: none; border-radius: 999px; background: #DCEAF8; color: #1A5A8A; font-size: 15px; font-weight: 700; display: flex; align-items: center; justify-content: center">KC</span><span style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px"><span style="font-size: 16px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">Kato Construction</span><span style="font-size: 12px; font-weight: 600; color: #B3BCD2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">Owes <b style="font-family: 'IBM Plex Mono', monospace; font-variant-numeric: tabular-nums; font-weight: 600; color: #F5B26B">420k</b> · every 10 days</span></span></a>
    <a href="tel:0772418220" aria-label="Call Kato Construction" style="width: 44px; height: 44px; flex: none; border-radius: 999px; background: rgba(111,220,176,.14); color: #6FDCB0; display: flex; align-items: center; justify-content: center"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/></svg></a>
    <a href="CH01Chats.dc.html" aria-label="Close" style="width: 44px; height: 44px; flex: none; border-radius: 999px; background: rgba(255,255,255,.08); color: #FFFFFF; display: flex; align-items: center; justify-content: center"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></a>
  </div>
  <div style="display: flex; align-items: center; gap: 8px"><a href="CH30HandOver.dc.html" aria-label="Grace's. Give Kato to a teammate" style="flex: none; padding: 6px 0; display: flex"><span style="height: 32px; padding: 0 10px 0 8px; border-radius: 999px; background: rgba(255,255,255,.10); color: #FFFFFF; font-size: 13px; font-weight: 700; display: flex; align-items: center; gap: 6px; white-space: nowrap; overflow: hidden"><span aria-hidden="true" style="width: 22px; height: 22px; flex: none; border-radius: 999px; background: #16203C; color: #FFFFFF; font-size: 11px; font-weight: 700; letter-spacing: -.04em; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 0 1.5px rgba(255,255,255,.35)">GA</span>Grace's<span style="display: flex; color: #B3BCD2"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 7h12l-3.5-3.5M17 17H5l3.5 3.5"/></svg></span></span></a><a href="OR07Packing.dc.html" aria-label="Order #0552, Packing. Open it" style="flex: none; padding: 6px 0; display: flex"><span style="height: 32px; padding: 0 10px 0 8px; border-radius: 999px; background: rgba(255,255,255,.10); color: #FFFFFF; font-size: 13px; font-weight: 700; display: flex; align-items: center; gap: 6px; white-space: nowrap; overflow: hidden"><span style="display: flex; color: #F5B26B"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5zM3.5 7.5 12 12l8.5-4.5M12 12v9"/></svg></span><span style="font-family: 'IBM Plex Mono', monospace; font-variant-numeric: tabular-nums; font-weight: 600">#0552</span><span style="color: #B3BCD2">·</span>Packing<span style="display: flex; color: #B3BCD2"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg></span></span></a></div>
</div>
<div role="status" style="display: flex; align-items: center; gap: 8px; min-height: 34px; padding: 0 16px; background: #E4F4EA; color: #0F6B43; font-size: 13px; font-weight: 700"><span aria-hidden="true" style="width: 22px; height: 22px; flex: none; border-radius: 999px; background: #E4E6FA; color: #3A3F9B; font-size: 11px; font-weight: 700; letter-spacing: -.04em; display: flex; align-items: center; justify-content: center">BO</span><span style="flex: 1">Brian is typing a reply</span><span aria-hidden="true" style="display: flex; gap: 3px"><i style="width: 5px; height: 5px; border-radius: 999px; background: #0F6B43"></i><i style="width: 5px; height: 5px; border-radius: 999px; background: #0F6B43; opacity: .6"></i><i style="width: 5px; height: 5px; border-radius: 999px; background: #0F6B43; opacity: .3"></i></span></div>
```

The chat ground is `#EDE7DD` (warm, darker than the screen ground, like the agent's Update preview). Bubbles: max 82% wide, padding `10px 12px`, 14/500 line height 1.4, time mono 11 at the bottom right.

- **Theirs**: `#FFFFFF`, radius `4px 16px 16px 16px`, left.
- **Ours**: `#DDF6D2`, radius `16px 4px 16px 16px`, right; the sender's first name 12/700 `#0F6B43` on top (each reply carries its sender); the time and a double tick (`#1A5A8A` when read).
- **Team note** (never sent to the customer): `#FDEEE1` with `inset 0 0 0 1px #F3D3B0`, radius 16, full width minus 24; a `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 4h14v11l-5 5H5z"/><path d="M14 20v-5h5"/></svg>` and "Grace · team note" 12/700 `#7A4A02`; text ink.
- **System line** (centred pill): `rgba(255,255,255,.7)`, 12/600 `#5F6980`, 28 tall, "Ruth gave Kato to Grace".
- **Not sent yet**: the bubble at 70% with a `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>` and "Not sent yet" 11/700 `#7A4A02` under it.

Composer (bottom, 72 tall, white, `border-top: 1px solid #E6E3DD`, padding `10px 12px`): a 44 px `#FDEEE1` note toggle, the field (44 tall, radius 22, `#F7F5F2`, placeholder "Message Kato" `#6B7480`, an attach icon inside right), and a 44 px send disc: navy with the send icon when there is text, `#0F6B43` mic when empty.

```html
<div style="display: flex; flex-direction: column; gap: 8px; padding: 12px 12px 8px; background: #EDE7DD">
  <span style="align-self: center; height: 28px; padding: 0 12px; border-radius: 999px; background: rgba(255,255,255,.7); color: #5F6980; font-size: 12px; font-weight: 600; display: flex; align-items: center">Today</span>
  <div style="align-self: flex-start; max-width: 82%; padding: 10px 12px 6px; border-radius: 4px 16px 16px 16px; background: #FFFFFF; font-size: 14px; font-weight: 500; line-height: 1.4; display: flex; flex-direction: column; gap: 2px">Can you do 40 iron sheets G28 by Friday? Also 2 wheelbarrows.<span style="align-self: flex-end; font-family: 'IBM Plex Mono', monospace; font-size: 11px; color: #6B7480">9:02</span></div>
  <div style="align-self: flex-end; max-width: 82%; padding: 8px 12px 6px; border-radius: 16px 4px 16px 16px; background: #DDF6D2; font-size: 14px; font-weight: 500; line-height: 1.4; display: flex; flex-direction: column; gap: 2px"><span style="font-size: 12px; font-weight: 700; color: #0F6B43">Grace</span>Yes Kato. Sending the price now.<span style="align-self: flex-end; display: flex; align-items: center; gap: 3px; font-family: 'IBM Plex Mono', monospace; font-size: 11px; color: #5F6980">9:06<span style="display: flex; color: #1A5A8A"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7"/></svg></span></span></div>
  <div style="margin: 0 12px; padding: 10px 12px; border-radius: 16px; background: #FDEEE1; box-shadow: inset 0 0 0 1px #F3D3B0; display: flex; flex-direction: column; gap: 4px"><span style="display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 700; color: #7A4A02"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 4h14v11l-5 5H5z"/><path d="M14 20v-5h5"/></svg>Grace · team note</span><span style="font-size: 14px; font-weight: 500; line-height: 1.4">Brian, #0552 leaves only when Kato pays 1,810,000.</span></div>
</div>
<div style="display: flex; align-items: center; gap: 8px; padding: 10px 12px; background: #FFFFFF; border-top: 1px solid #E6E3DD">
  <button type="button" aria-label="Write a team note" style="width: 44px; height: 44px; flex: none; border: none; padding: 0; border-radius: 999px; background: #FDEEE1; color: #7A4A02; display: flex; align-items: center; justify-content: center"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 4h14v11l-5 5H5z"/><path d="M14 20v-5h5"/></svg></button>
  <label style="flex: 1; min-width: 0; height: 44px; border-radius: 22px; background: #F7F5F2; display: flex; align-items: center; gap: 8px; padding: 0 12px 0 16px"><input type="text" placeholder="Message Kato" aria-label="Message Kato Construction" style="flex: 1; min-width: 0; border: none; outline: none; background: transparent; font-family: inherit; font-size: 15px; color: #1C2233"><span style="display: flex; color: #5F6980"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 11.5l-8.2 8.2a5 5 0 0 1-7-7L13 4.5a3.3 3.3 0 0 1 4.7 4.7l-8 8a1.7 1.7 0 0 1-2.4-2.4l7.3-7.3"/></svg></span></label>
  <button type="button" aria-label="Send" style="width: 44px; height: 44px; flex: none; border: none; padding: 0; border-radius: 999px; background: #16203C; color: #FFFFFF; display: flex; align-items: center; justify-content: center"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 3 3 10.5l7 2.5 2.5 7zM10 13 21 3"/></svg></button>
</div>
```


#### S02 · Payment method picker and the cash "They gave / Give change" control

On light (Take payment): a 3-way segmented card, 52 tall, white hairline, radius 14, padding 4; each segment 44 tall radius 10, icon 18 + word 14/700; on = navy with white, off = transparent `#5F6980`. Mobile money asks for the transaction ID only then (a P19-style white row "Transaction ID" + mono value). In the **dock** (counter sale) the same control sits on navy: track `rgba(255,255,255,.08)`, on = white with navy.

```html
<div role="radiogroup" aria-label="How they paid" style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 4px; padding: 4px; border-radius: 14px; background: #FFFFFF; box-shadow: inset 0 0 0 1px #E6E3DD">
  <button type="button" role="radio" aria-checked="true" style="height: 44px; border: none; border-radius: 10px; background: #16203C; color: #FFFFFF; font-size: 14px; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 6px"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2.5" y="6" width="19" height="12" rx="2"/><circle cx="12" cy="12" r="2.6"/><path d="M6 12h.01M18 12h.01"/></svg>Cash</button>
  <button type="button" role="radio" aria-checked="false" style="height: 44px; border: none; border-radius: 10px; background: transparent; color: #5F6980; font-size: 14px; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 6px"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="6.5" y="2.5" width="11" height="19" rx="2.5"/><path d="M10.5 18.5h3M10 7h4"/></svg>Mobile</button>
  <button type="button" role="radio" aria-checked="false" style="height: 44px; border: none; border-radius: 10px; background: transparent; color: #5F6980; font-size: 14px; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 6px"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 9.5 12 4l9 5.5M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20.5h18"/></svg>Bank</button>
</div>
```

**They gave / Give change** (cash only, inside the navy dock, above the slide): a label row "They gave" 12/600 `#B3BCD2`; three 48 px tiles (`Exact` 14/700, then the two likely notes rounded up, mono 15/600), the chosen one white with navy text, the others `rgba(255,255,255,.08)` white; a typed amount opens the keypad (S03). Under it the change as a two-sided row: "Give change" 13/600 `#B3BCD2` and the amount mono 26/600 `#6FDCB0`. When they gave more and want to keep it: a 32 px glass pill "Keep as deposit" beside it (the customer confirms, GLOSSARY "Deposit").

```html
<div style="display: flex; flex-direction: column; gap: 8px">
  <span style="font-size: 12px; font-weight: 600; color: #B3BCD2">They gave</span>
  <div role="radiogroup" aria-label="They gave" style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px">
    <button type="button" role="radio" aria-checked="false" style="height: 48px; border: none; border-radius: 12px; background: rgba(255,255,255,.08); color: #FFFFFF; font-size: 14px; font-weight: 700">Exact</button>
    <button type="button" role="radio" aria-checked="true" style="height: 48px; border: none; border-radius: 12px; background: #FFFFFF; color: #16203C; font-family: 'IBM Plex Mono', monospace; font-size: 15px; font-weight: 600">55,000</button>
    <button type="button" role="radio" aria-checked="false" style="height: 48px; border: none; border-radius: 12px; background: rgba(255,255,255,.08); color: #FFFFFF; font-family: 'IBM Plex Mono', monospace; font-size: 15px; font-weight: 600">60,000</button>
  </div>
  <div style="display: flex; align-items: baseline; justify-content: space-between; padding-top: 2px"><span style="font-size: 13px; font-weight: 600; color: #B3BCD2">Give change</span><span style="font-family: 'IBM Plex Mono', monospace; font-size: 26px; font-weight: 600; letter-spacing: -.03em; color: #6FDCB0">3,000</span></div>
</div>
```

#### S03 · The price change keypad

A light sheet "Price · Iron sheet G28". At the top the **ladder** (where this price sits, shown not told): a 6 px track from cost to the shop's price with two ticks, the cost end hatched `#FBE5E2` (never shown as a number to Sales: the end is labelled "cost" only), a 20 px navy marker for the typed price; under it "shop 38,000" mono 12 at its tick. Then the price field (P12 open line's field: 60 tall, `2px solid #1C2233`, radius 14, key "Their price, each" 11/700, value mono 22/600) and the outcome row "40 sheets come to ~~1,520,000~~ → 1,460,000" mono. Below the shop's price: a `#FDEEE1` row with a clock: "Under the shop's price. Ruth says yes before it is packed." Then the keypad: a 3 × 4 grid of 56 px keys (radius 14, white hairline, mono 22/600; "000" key; the backspace icon), and the button pair "Keep 38,000" (ghost) / "Use 36,500" (navy; red is reserved).

```html
<div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px">
  <button type="button" style="height: 56px; border: none; border-radius: 14px; background: #FFFFFF; box-shadow: inset 0 0 0 1px #E6E3DD; font-family: 'IBM Plex Mono', monospace; font-size: 22px; font-weight: 600; color: #1C2233">1</button>
  <button type="button" style="height: 56px; border: none; border-radius: 14px; background: #FFFFFF; box-shadow: inset 0 0 0 1px #E6E3DD; font-family: 'IBM Plex Mono', monospace; font-size: 22px; font-weight: 600; color: #1C2233">2</button>
  <button type="button" style="height: 56px; border: none; border-radius: 14px; background: #FFFFFF; box-shadow: inset 0 0 0 1px #E6E3DD; font-family: 'IBM Plex Mono', monospace; font-size: 22px; font-weight: 600; color: #1C2233">3</button>
  <!-- 4 5 6, 7 8 9, then: -->
  <button type="button" style="height: 56px; border: none; border-radius: 14px; background: #F1EEE8; font-family: 'IBM Plex Mono', monospace; font-size: 18px; font-weight: 600; color: #1C2233">000</button>
  <button type="button" style="height: 56px; border: none; border-radius: 14px; background: #FFFFFF; box-shadow: inset 0 0 0 1px #E6E3DD; font-family: 'IBM Plex Mono', monospace; font-size: 22px; font-weight: 600; color: #1C2233">0</button>
  <button type="button" aria-label="Delete" style="height: 56px; border: none; border-radius: 14px; background: #F1EEE8; color: #1C2233; display: flex; align-items: center; justify-content: center"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 5h12a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H8l-6-7z"/><path d="M12 9.5l5 5M17 9.5l-5 5"/></svg></button>
</div>
```

The ladder:

```html
<div role="img" aria-label="36,500 is under the shop's price of 38,000" style="display: flex; flex-direction: column; gap: 6px; padding: 4px 2px">
  <div style="position: relative; height: 20px">
    <span style="position: absolute; left: 0; right: 0; top: 7px; height: 6px; border-radius: 999px; background: linear-gradient(90deg, #FBE5E2 0 18%, #FDEEE1 18% 72%, #E4F4EA 72% 100%)"></span>
    <span style="position: absolute; left: 72%; top: 2px; width: 2px; height: 16px; border-radius: 2px; background: #1C2233"></span>
    <span style="position: absolute; left: calc(66% - 10px); top: 0; width: 20px; height: 20px; border-radius: 999px; background: #16203C; box-shadow: 0 0 0 3px #FFFFFF"></span>
  </div>
  <div style="position: relative; height: 14px; font-size: 11px; font-weight: 600; color: #5F6980"><span style="position: absolute; left: 0">cost</span><span style="position: absolute; left: 72%; transform: translateX(-50%); font-family: 'IBM Plex Mono', monospace">shop 38,000</span></div>
</div>
```

(The bands are flat colour stops, not a wash: red-soft below cost, amber-soft up to the shop's price, green-soft above.)

#### S04 · The hand-over person picker

A group card of teammates, 60 px rows: avatar 40 in their tint, the name 15/700, a load line 12/600 `#6B7480` "9 chats · none waiting", and on the right a **load bar** (48 × 6, `#F1EEE8` track, fill `#0F6B43` light load / `#95530C` heavy) and a 24 px radio (`2px solid #C9C4BA`; on = navy disc with a white tick). Each avatar carries an 11 px presence dot at its bottom right (`#0F6B43` on, `#C9C4BA` away, with a 2 px white ring); an away teammate says "away" in the line. Grace's own row is first, at full strength, with her navy avatar, "You" in the line and a `#F1EEE8` "has it" chip in place of the radio (it cannot be picked). Under the card: "A note for Brian" 12/700 `#5F6980` and a 2-line field; at the foot the navy block `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 13.5h3l3-1.5h4.3a1.6 1.6 0 0 1 0 3.2H10"/><path d="M12.8 15.2h3.6l3.3-2.4a1.5 1.5 0 0 1 2 2.2l-4.4 4H8.5l-3-1.5h-3"/><path d="M14 4.5h6M17.5 2l2.5 2.5L17.5 7"/></svg> Give to Brian`.

```html
<label style="position: relative; display: flex; align-items: center; gap: 12px; min-height: 60px; border-bottom: 1px solid #F1EEE8; cursor: pointer">
  <span style="position: relative; display: flex"><span aria-hidden="true" style="width: 40px; height: 40px; flex: none; border-radius: 999px; background: #E4E6FA; color: #3A3F9B; font-size: 13px; font-weight: 700; display: flex; align-items: center; justify-content: center">BO</span><span aria-hidden="true" style="position: absolute; right: -1px; bottom: -1px; width: 11px; height: 11px; border-radius: 999px; background: #0F6B43; box-shadow: 0 0 0 2px #FFFFFF"></span></span>
  <span style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px"><span style="font-size: 15px; font-weight: 700">Brian Ouma</span><span style="font-size: 12px; font-weight: 600; color: #6B7480">9 chats · none waiting</span></span>
  <span aria-hidden="true" style="width: 48px; height: 6px; border-radius: 999px; flex: none; background: #F1EEE8; overflow: hidden"><span style="display: block; width: 30%; height: 100%; border-radius: 999px; background: #0F6B43"></span></span>
  <input type="radio" name="to" checked aria-label="Brian Ouma" style="position: absolute; opacity: 0; width: 1px; height: 1px">
  <span aria-hidden="true" style="width: 24px; height: 24px; flex: none; border-radius: 999px; background: #16203C; color: #FFFFFF; display: flex; align-items: center; justify-content: center"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7"/></svg></span>
</label>
```

Grace's own row:

```html
<label style="position: relative; display: flex; align-items: center; gap: 12px; min-height: 60px; border-bottom: 1px solid #F1EEE8; cursor: pointer">
  <span style="position: relative; display: flex"><span aria-hidden="true" style="width: 40px; height: 40px; flex: none; border-radius: 999px; background: #16203C; color: #FFFFFF; font-size: 13px; font-weight: 700; display: flex; align-items: center; justify-content: center">GA</span><span aria-hidden="true" style="position: absolute; right: -1px; bottom: -1px; width: 11px; height: 11px; border-radius: 999px; background: #0F6B43; box-shadow: 0 0 0 2px #FFFFFF"></span></span>
  <span style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px"><span style="font-size: 15px; font-weight: 700">Grace Akello</span><span style="font-size: 12px; font-weight: 600; color: #6B7480">You · 6 chats · 2 waiting</span></span>
  <span aria-hidden="true" style="width: 48px; height: 6px; flex: none; border-radius: 999px; background: #F1EEE8; overflow: hidden"><span style="display: block; width: 33%; height: 100%; border-radius: 999px; background: #95530C"></span></span>
  <input type="radio" name="to" disabled aria-label="Grace Akello" style="position: absolute; opacity: 0; width: 1px; height: 1px">
  <span style="height: 24px; padding: 0 8px; border-radius: 999px; background: #F1EEE8; font-size: 12px; font-weight: 700; color: #5F6980; display: flex; align-items: center">has it</span>
</label>
```

#### S05 · The stage filter for orders

The Orders page head carries the P03b stage bar; under the head, the P23 chip row is the stage filter, each chip with its stage's **tone dot** (Checking `#F5B26B` — it often waits on Grace or Ruth; Buying `#9DB7E0`; Packing `#7FA2D6`; On the road `#6FDCB0`; Delivered `#C9C4BA`) and its count. "All" first. The chosen chip is navy. The groups below follow the same order and dots (P06 list header). A stage with nothing in it keeps its chip at 60% with "0".

Dot colours here are identity of the stage (always with the word), so they need not pass contrast as text.

#### S06 · The "Being checked" money split

What a customer owes, split into what Sales should collect and what Esther is checking, as one bar and two tiles. On a P04 navy top: "Owes" 12/600 `#B3BCD2`, the total mono 32/600; a 10 px bar in two parts (amber `#F5B26B` "to collect", info `#9DB7E0` hatched "being checked": `repeating-linear-gradient(135deg, #9DB7E0 0 4px, #7FA2D6 4px 8px)`); under it two glass tiles: "To collect 165,000" (amber mono) and "Being checked 125,000" (`#9DB7E0` mono) with "Esther checks it" 11/600 and her 22 px avatar.

```html
<div style="display: flex; flex-direction: column; gap: 10px">
  <span style="display: flex; flex-direction: column; gap: 4px"><span style="font-size: 12px; font-weight: 600; color: #B3BCD2">Owes</span><span style="font-family: 'IBM Plex Mono', monospace; font-variant-numeric: tabular-nums; font-size: 32px; font-weight: 600; letter-spacing: -.03em; line-height: 1">290,000</span></span>
  <span role="img" aria-label="165,000 to collect, 125,000 being checked" style="display: flex; gap: 3px; height: 10px"><span style="flex: 165; border-radius: 999px; background: #F5B26B"></span><span style="flex: 125; border-radius: 999px; background: repeating-linear-gradient(135deg, #9DB7E0 0 4px, #7FA2D6 4px 8px)"></span></span>
  <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px">
    <a href="CU11CustomerChecked.dc.html" style="padding: 10px 12px; border-radius: 14px; background: rgba(255,255,255,.07); display: flex; flex-direction: column; gap: 3px"><span style="font-size: 11px; font-weight: 600; color: #B3BCD2">To collect</span><span style="font-family: 'IBM Plex Mono', monospace; font-size: 17px; font-weight: 600; color: #F5B26B">165,000</span></a>
    <a href="CU12BillChecked.dc.html" style="padding: 10px 12px; border-radius: 14px; background: rgba(255,255,255,.07); display: flex; flex-direction: column; gap: 3px"><span style="font-size: 11px; font-weight: 600; color: #B3BCD2">Being checked</span><span style="font-family: 'IBM Plex Mono', monospace; font-size: 17px; font-weight: 600; color: #9DB7E0">125,000</span><span style="display: flex; align-items: center; gap: 5px; font-size: 11px; font-weight: 600; color: #B3BCD2"><span aria-hidden="true" style="width: 22px; height: 22px; border-radius: 999px; background: #FDEEE1; color: #7A4A02; font-size: 11px; font-weight: 700; letter-spacing: -.04em; display: flex; align-items: center; justify-content: center">EA</span>Esther checks it</span></a>
  </div>
</div>
```

(`#9DB7E0` on navy is 7.4:1.)

#### S07 · The return / void picker ("Something wrong")

A light sheet with the eyebrow `ORDER #0548 · GGABA STORES` and the title "Something wrong". On an order the act tile that opens this sheet says **"Fix it"** (OR09, OR20, OR22); the sheet title stays "Something wrong". Three **reason cards** (P08 anatomy, 64 tall, an icon tile 42 in a tone, the title 15/700, the sub 12/600 `#6B7480` saying who decides, a chevron): **Items coming back** (return, info) "Ruth gives the credit note"; **Cancel the bill** (void, bad) "Ruth decides"; **Payment recorded wrong** (cash, warn) "Esther corrects it". Above them, the order's state as the P18b dots so the person sees what is still possible (a Delivered order cannot be cancelled, only returned: that card is at 50% with "Delivered · use a return").

The return form that follows: each line a P20 row with a 24 px checkbox (navy when ticked) and a P12b stepper "2 of 3"; "Why" as three 44 px P23 chips (Wrong size · Damaged · Not needed), "Credit to give back" with the mono amount 22/600, and one red block "Ask Ruth for the credit note".

```html
<a href="OR21Return.dc.html" style="display: flex; align-items: center; gap: 12px; min-height: 64px; padding: 0 10px 0 12px; border-radius: 16px; background: #FFFFFF; box-shadow: 0 1px 2px rgba(22,32,60,.05), inset 0 0 0 1px #E6E3DD; color: #1C2233">
  <span aria-hidden="true" style="width: 42px; height: 42px; flex: none; border-radius: 12px; background: #E3EEFB; color: #1A5A8A; display: flex; align-items: center; justify-content: center"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 14 4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3"/></svg></span>
  <span style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px"><span style="font-size: 15px; font-weight: 700">Items coming back</span><span style="font-size: 12px; font-weight: 600; color: #6B7480">Ruth gives the credit note</span></span>
  <span aria-hidden="true" style="display: flex; color: #9AA1AE"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg></span>
</a>
```

Void card: tile `#FBE5E2` / `#8E2A22` with the void icon, "Cancel the bill", "Ruth decides". Payment card: tile `#FDEEE1` / `#95530C` with the cash icon, "Payment recorded wrong", "Esther corrects it". The "recorded → should be" form shows the two figures side by side: the recorded one struck through in a white tile, a chevron, the right one in a tile with `2px solid #16203C`.

#### S08 · Day blocks (one customer's rhythm)

Reused from the agent's Client sheet: a row of 18 px blocks (2 px gap, radius 4), one per day since their last order: `#D5D9E2` inside their rhythm, a 2 × 26 px ink bar where it ran out, `#F5B26B` (on navy) / `#95530C` (on light) for each day past it, dashed outlines for days still ahead. Labels 11/600 under: the last order date, "due 13 Oct", "today" in the tone. The sample is Kyaligonza (FACTS 3.2).

```html
<div style="background: #FFFFFF; border-radius: 16px; box-shadow: inset 0 0 0 1px #E6E3DD; padding: 12px 14px; display: flex; flex-direction: column; gap: 8px">
  <div style="display: flex; justify-content: space-between; align-items: center"><span style="font-size: 13px; font-weight: 700">Kyaligonza · every 14 days</span><span style="height: 24px; padding: 0 8px; border-radius: 999px; background: #FDEEE1; color: #7A4A02; font-size: 12px; font-weight: 700; display: flex; align-items: center">4 days late</span></div>
  <div role="img" aria-label="Last order Tue 29 Sep, due Tue 13 Oct, 4 days late" style="display: flex; align-items: center; gap: 2px">
    <!-- one 18 px block per day: fourteen in rhythm, the due bar, four late -->
    <span style="flex: 1; height: 18px; border-radius: 4px; background: #D5D9E2"></span><span style="flex: 1; height: 18px; border-radius: 4px; background: #D5D9E2"></span><span style="flex: 1; height: 18px; border-radius: 4px; background: #D5D9E2"></span><span style="flex: 1; height: 18px; border-radius: 4px; background: #D5D9E2"></span><span style="flex: 1; height: 18px; border-radius: 4px; background: #D5D9E2"></span><span style="flex: 1; height: 18px; border-radius: 4px; background: #D5D9E2"></span><span style="flex: 1; height: 18px; border-radius: 4px; background: #D5D9E2"></span><span style="flex: 1; height: 18px; border-radius: 4px; background: #D5D9E2"></span><span style="flex: 1; height: 18px; border-radius: 4px; background: #D5D9E2"></span><span style="flex: 1; height: 18px; border-radius: 4px; background: #D5D9E2"></span><span style="flex: 1; height: 18px; border-radius: 4px; background: #D5D9E2"></span><span style="flex: 1; height: 18px; border-radius: 4px; background: #D5D9E2"></span><span style="flex: 1; height: 18px; border-radius: 4px; background: #D5D9E2"></span><span style="flex: 1; height: 18px; border-radius: 4px; background: #D5D9E2"></span><span style="width: 2px; height: 26px; margin: 0 1px; flex: none; border-radius: 999px; background: #1C2233"></span><span style="flex: 1; height: 18px; border-radius: 4px; background: #95530C"></span><span style="flex: 1; height: 18px; border-radius: 4px; background: #95530C"></span><span style="flex: 1; height: 18px; border-radius: 4px; background: #95530C"></span><span style="flex: 1; height: 18px; border-radius: 4px; background: #95530C"></span>
  </div>
  <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: 600; color: #6B7480"><span>29 Sep</span><span>due 13 Oct</span><span style="color: #7A4A02">today</span></div>
</div>
```


#### S09 · A stage group in Orders (as built: OR01Orders)

The group is the stage, so its rows carry no stage dots. The header: a 10 px stage dot, the stage 14/700, the count mono 12 `#5F6980`, the sum mono 13/600 at the right. Each row (64 tall, in a group card, split by `1px #F1EEE8`): the 40 px avatar, the name 15/700, the order number mono 11 with one status line (who decides with their 20 px face, Not paid yet, Cancel asked), the amount mono and, at the right, the time placed or the one act ("Take 1.1M" opens that customer's own board).

```html
<div style="display: flex; flex-direction: column; gap: 8px">
<div style="display: flex; align-items: center; gap: 8px; min-height: 32px; padding: 0 2px">
  <span aria-hidden="true" style="width: 10px; height: 10px; flex: none; border-radius: 999px; background: #F5B26B"></span>
  <span style="font-size: 14px; font-weight: 700">Checking</span>
  <span style="flex: 1; font-family: 'IBM Plex Mono', monospace; font-size: 12px; font-weight: 600; color: #5F6980">3</span>
  <span style="font-family: 'IBM Plex Mono', monospace; font-size: 13px; font-weight: 600">542,000</span>
</div>
<div style="background: #FFFFFF; border-radius: 18px; box-shadow: 0 1px 2px rgba(22,32,60,.05), inset 0 0 0 1px #E6E3DD; padding: 0 12px; display: flex; flex-direction: column"><div style="display: flex; align-items: center; gap: 8px;"><button type="button" style="border: none; background: transparent; margin: 0; padding: 0; font-family: inherit; text-align: inherit; flex: 1; min-width: 0; display: flex; align-items: center; gap: 10px; min-height: 62px; color: #1C2233"><span aria-hidden="true" style="width: 40px; height: 40px; flex: none; border-radius: 999px; background: #DCEAF8; color: #1A5A8A; font-size: 13px; font-weight: 700; display: flex; align-items: center; justify-content: center">KC</span><span style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px"><span style="font-size: 14px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">Kato Construction</span><span style="display: flex; align-items: center; gap: 6px; min-width: 0; font-family: 'IBM Plex Mono', monospace; font-variant-numeric: tabular-nums; font-size: 11px; color: #5F6980; white-space: nowrap">#0553<span aria-hidden="true">·</span><span style="display: flex; align-items: center; gap: 4px; min-width: 0"><span aria-hidden="true" style="width: 18px; height: 18px; flex: none; border-radius: 999px; background: #DDF1EE; color: #0E5E57; font-size: 11px; font-weight: 700; letter-spacing: -.04em; display: flex; align-items: center; justify-content: center">RN</span><span style="font-family: Figtree, sans-serif; font-size: 12px; font-weight: 700; color: #1A5A8A; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">Ruth decides</span></span></span></span><span style="flex: none; display: flex; flex-direction: column; align-items: flex-end; gap: 3px"><span style="font-family: 'IBM Plex Mono', monospace; font-variant-numeric: tabular-nums; font-size: 13px; font-weight: 600; letter-spacing: -.02em">170,000</span><span style="font-family: 'IBM Plex Mono', monospace; font-size: 11px; color: #5F6980">10:16</span></span><span aria-hidden="true" style="display: flex; color: #9AA1AE"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg></span></button></div><div style="display: flex; align-items: center; gap: 8px; border-top: 1px solid #F1EEE8;"><button type="button" style="border: none; background: transparent; margin: 0; padding: 0; font-family: inherit; text-align: inherit; flex: 1; min-width: 0; display: flex; align-items: center; gap: 10px; min-height: 62px; color: #1C2233"><span aria-hidden="true" style="width: 40px; height: 40px; flex: none; border-radius: 999px; background: #E4E6FA; color: #3A3F9B; font-size: 13px; font-weight: 700; display: flex; align-items: center; justify-content: center">MR</span><span style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px"><span style="font-size: 14px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">Mukono Roofing</span><span style="display: flex; align-items: center; gap: 6px; min-width: 0; font-family: 'IBM Plex Mono', monospace; font-variant-numeric: tabular-nums; font-size: 11px; color: #5F6980; white-space: nowrap">#0551<span aria-hidden="true">·</span><span style="font-family: Figtree, sans-serif; font-size: 12px; font-weight: 700; color: #7A4A02; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">Not paid yet</span></span></span></button><div style="flex: none; display: flex; flex-direction: column; align-items: flex-end; padding-top: 4px"><span style="font-family: 'IBM Plex Mono', monospace; font-variant-numeric: tabular-nums; font-size: 13px; font-weight: 600; letter-spacing: -.02em; line-height: 16px">320,000</span><button type="button" aria-label="Take payment from Mukono Roofing, 1,100,000" style="border: none; background: transparent; margin: 0; padding: 0; font-family: inherit; text-align: inherit; padding: 7px 0 7px; display: flex; flex: none"><span style="height: 30px; padding: 0 12px; border-radius: 999px; background: #FDEEE1; color: #7A4A02; font-size: 13px; font-weight: 700; display: flex; align-items: center; gap: 5px">Take <span style="font-family: 'IBM Plex Mono', monospace; font-weight: 600">1.1M</span></span></button></div></div><div style="display: flex; align-items: center; gap: 8px; border-top: 1px solid #F1EEE8;"><button type="button" style="border: none; background: transparent; margin: 0; padding: 0; font-family: inherit; text-align: inherit; flex: 1; min-width: 0; display: flex; align-items: center; gap: 10px; min-height: 62px; color: #1C2233"><span aria-hidden="true" style="width: 40px; height: 40px; flex: none; border-radius: 999px; background: #E8EBF0; color: #3D4A5C; font-size: 13px; font-weight: 700; display: flex; align-items: center; justify-content: center">WI</span><span style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px"><span style="font-size: 14px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">Walk-in</span><span style="display: flex; align-items: center; gap: 6px; min-width: 0; font-family: 'IBM Plex Mono', monospace; font-variant-numeric: tabular-nums; font-size: 11px; color: #5F6980; white-space: nowrap">#0550<span aria-hidden="true">·</span><span style="display: flex; align-items: center; gap: 4px; min-width: 0"><span aria-hidden="true" style="width: 18px; height: 18px; flex: none; border-radius: 999px; background: #DDF1EE; color: #0E5E57; font-size: 11px; font-weight: 700; letter-spacing: -.04em; display: flex; align-items: center; justify-content: center">RN</span><span style="font-family: Figtree, sans-serif; font-size: 12px; font-weight: 700; color: #1A5A8A; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">Cancel asked</span></span></span></span><span style="flex: none; display: flex; flex-direction: column; align-items: flex-end; gap: 3px"><span style="font-family: 'IBM Plex Mono', monospace; font-variant-numeric: tabular-nums; font-size: 13px; font-weight: 600; letter-spacing: -.02em">52,000</span><span style="font-family: 'IBM Plex Mono', monospace; font-size: 11px; color: #5F6980">9:02</span></span><span aria-hidden="true" style="display: flex; color: #9AA1AE"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg></span></button></div></div>
</div>
```

#### S10 · The bill being checked, side by side (as built: CU12BillChecked)

The two figures that may be the same money, as two tiles joined by "=": the open bill on warn soft, the payment on good soft. Under it, the customer's answer as two radio cards and one navy "Send to Esther".

```html
<div role="img" aria-label="This bill, 125,000 open from 17 Aug, matches order #0264, 125,000 paid in cash the same day" style="display: grid; grid-template-columns: minmax(0, 1fr) 34px minmax(0, 1fr); align-items: center; gap: 6px">
    <span style="padding: 10px 12px; border-radius: 14px; background: #FDEEE1; display: flex; flex-direction: column; gap: 3px"><span style="font-size: 11px; font-weight: 700; color: #7A4A02">#0528 · open</span><b style="font-family: 'IBM Plex Mono', monospace; font-variant-numeric: tabular-nums; font-size: 18px; font-weight: 600; color: #7A4A02">125,000</b><span style="font-size: 11px; font-weight: 600; color: #7A4A02">billed 17 Aug</span></span>
    <span style="width: 34px; height: 34px; border-radius: 999px; background: #F1EEE8; font-family: 'IBM Plex Mono', monospace; font-variant-numeric: tabular-nums; font-size: 17px; font-weight: 600; display: flex; align-items: center; justify-content: center">=</span>
    <span style="padding: 10px 12px; border-radius: 14px; background: #E4F4EA; display: flex; flex-direction: column; gap: 3px"><span style="font-size: 11px; font-weight: 700; color: #0F6B43">paid in cash</span><b style="font-family: 'IBM Plex Mono', monospace; font-variant-numeric: tabular-nums; font-size: 18px; font-weight: 600; color: #0F6B43">125,000</b><span style="font-size: 11px; font-weight: 600; color: #0F6B43">receipt · 17 Aug</span></span>
  </div>
```


---

## 6. Where the agent app disagrees with itself, and what we use

| Where | The two versions | We use |
|---|---|---|
| Today's hero | Canvas Today: a 136 px goal **ring** beside the money. Live app and Kevin's photo: money above a full-width **goal bar** | **The bar** on Today (P02). The ring only where the goal is the subject (Goal, goal hit) |
| Track head | Canvas Track and DelDone: a 56 px status tile + six **step tiles** with times. Live app and Track1–5: the stage word + one **rail** of dots | **The rail** (P18), with five Sales stages |
| Search icon | Live Find and Clients: stroke magnifier. Live Order and canvas Clients/Order: duotone | **Duotone** in every field |
| × on the order bar | Live: stroke. Canvas: duotone | **Stroke** (it is interface) |
| Grey text on the warm ground | Canvas uses `#6B7480` (4.35:1) and `#767F91` (4.0:1) on `#F7F5F2` and white | `#5F6980` on the ground, `#6B7480` on white only |
| "Late" colour | Canvas ClientsPro: `#E5675B` text (3.5:1). Live: warn | **Warn** `#95530C` for late; crimson `#8E2A22` for gone quiet |
| Basket count badge | Canvas `#C27A12` (3.4:1). Live `#95530C` | **`#95530C`** |
| Tap targets | Live: × and Shop on a sheet head 40, filter chips 36, Play all 36, row squares 40 | **44** everywhere (36 visible pills sit inside a 44 px link) |
| Small type | Canvas: 9 px initials in face stacks, 10 px on usual tiles | **11 px** minimum (live CSS uses 24 px faces with 11 px) |
| The red + | Live CSS: 64 px border-box. Canvas: 64 + 4 px border (72) | **64 border-box** (the photo) |
| Hero radius | Canvas Today 32; live 28 | **28** |
| Navy page head | Live Clients: radial `#243A6B`; dark card radial `#2B3866`; Today flat | Today **flat**, page heads `#243A6B`, the dark card `#2B3866` |
| End-of-flow buttons | Sent: one button; Sorry: red + glass + text link | **One button, "Back to Today"**, an optional glass pill above |
| Money wording | "+98,000 yours", "You earn" everywhere | **Never** in Sales: no commission. The mint line carries good news about the order itself |
| Tile names | Agent: Basket · Sent · Packing · Out | Sales: Checking · Buying · Packing · On the road (Delivered in the meta) |
| The "needs you" left bar on an order row (`::before` 4 px amber stripe) | Live CSS only | **Not used** (a left-border accent reads as a trope); the age chip and the action pill carry it |

STATUS: READY
