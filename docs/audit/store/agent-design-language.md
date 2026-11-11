# The Agent app's language, for the Store redesign (addendum)

**Status:** reference for rebuilding `store.html` to look and behave like `agent.html`.
**Read first:** `docs/canvas/sales-agent/LANGUAGE.md`. It already sets out the agent app's language as tokens (§1), icons (§2), parts P01–P29 with copy-paste markup (§3), composition rules (§4) and conflicts (§6). That file is the source. This addendum does not repeat it. It adds four things: (a) which of its parts the Store reuses, (b) what the Store needs that it leaves out (states at 360 px, motion, the stage rail as the agent words it, taps per job), (c) checks against the live app, and (d) a checklist.

Checked on 2026-11-11 against `agent.html` (CSS lines 226–4468), using screenshots of the live app at **360 × 780** on a fake Supabase. The screenshots are in the scratchpad `agentshots/` folder (`s01-today`, `s03-sheet-packing`, `s04-track`, `s05-sheet-sent`, `t01-plus`, `t02-search`, `t05-client-sheet` (the Clients empty state), `t07-confirm`, `t08-offline`, `t09/t10/t11` toasts, `t12-sheet-out`).

---

## A. LANGUAGE.md parts the Store reuses

| Store need | Reuse | Notes for the Store |
|---|---|---|
| Ground, gutters, tokens | §1.1–1.6, P01 | Same hexes. `ink-faint #6B7480` goes on white only. On `#F7F5F2` use `#5F6980`. |
| Today head | P02 (flat `#16203C`, bottom radius 28) | Greeting 20/700, date plus the live pill, then one big mono figure. For the Store, that figure is the count of orders to pack, not money "yours". |
| A tab's root head | P03 / P04 | Radial `#243A6B → #16203C`. |
| Section heading row | P06 (`.ax-sec`: h2 17/700, count 13/600 `#5F6980`, padding `0 4px`) | "On the move", "Needs you" |
| Stage tiles | P07 (`.ax-tiles.busy`: 4-up, gap 8, tile ≥96 tall, radius 12, `#F7F5F2` in a white radius-16 card) | Store tiles: **To pack · Packing · To load · Out**, with faces and a need badge (22 px, mono 11/600, ring `0 0 0 2px #fff`) |
| "Needs you" by kind | P08 (`.ax-nk`: 60 tall, radius 16, 38 px tone square r12, title 14/700, mono sub 11, count mono 18/600, navy go pill 36 × 13/700) | Header: 8 px crimson dot + "Needs you" 17/700 + mono count |
| Navy feature card | P09 (radial `#2B3866`, radius 22, shadow `0 14px 30px rgba(22,32,60,.22)`, white pill button) | One "Next move" per screen |
| List card plus rows | P10 and §B2 below (the stage-sheet row) | |
| Avatars | P11 (t0–t5 tints, 40 / 32 sm / 52 lg, 14/12/17 px 700) | The tint comes from the id, so a person keeps it everywhere. It never shows state. |
| Bottom sheet | P17 plus §B1 below | |
| Where an order is | P18 (light rail), P19 money tiles, P20 check list | The Store ticks lines as they are picked, instead of as suppliers answer |
| Action tiles | P21 (`.ax-acts`: 56 tall, radius 14, icon 20 over 12/700) | |
| Success moment | P22 (full navy, mint 84 px disc, `axPop`) | "Packed", "Loaded" |
| Chips / pills | P23 | |
| Empty / skeleton | P24, P25 | **Use P24 everywhere.** The agent's own stage sheets do not (see §C). |
| Buttons | P26 | |
| Notice bar | P27 | |
| Toasts | P28 | |
| Tab bar and red + | P16 | Store: **Today · + · Shelf** (or the Store's second place). The + is 64 px border-box, lifted 26 px, with a 4 px `#F7F5F2` ring and shadow `0 6px 20px rgba(201,58,48,.35)`. |
| Slide to commit | P15 (`.ax-slide` 60 tall, 50 px red knob, commits at **85 %** of travel) | "Slide to mark packed · 6 lines", "Slide to hand over" |

## B. Parts LANGUAGE.md does not cover in full

### B1. The stage sheet ("Packing 7"), as the live app builds it

The Store's main list should copy this screen. It is a `.ax-sheet.full` that rises over Today (`s03`, `t12`).

- **Scrim**: `rgba(12,19,38,.72)` plus `backdrop-filter: blur(6px)`. It fades in over `.18s ease-out`.
- **Sheet**: ground `#F7F5F2`, top radius 26, height `100dvh − 24px − safe-top`, shadow `0 -8px 30px rgba(0,0,0,.35)`.
- **Navy top** (`.ax-bz-top`): padding `0 0 16px`.
  - **Grab bar**: 20 tall. The bar is 40 × 5, radius 999, `rgba(255,255,255,.25)`.
  - **Head** (`.ax-bz-h.lite`): padding `4px 16px 0`.
    - **Title**: 24/700, `-.02em`, line-height 1. The count is in mono 600 **in the stage tone**.
    - **Sub-line**: mono 12/600 `#B3BCD2`, for example "1,240,000 being packed".
    - **Close button**: 44 px round, `rgba(255,255,255,.1)`, white × at 20.
  - **Stage rail** (`.ax-bz-rail`): padding `14px 16px 0`. The steps this sheet covers sit in one band:
    - **Band**: `color-mix(tone 16%)` with a `1px color-mix(tone 35%)` inset, radius 999.
    - **Lit stops**: 28 px in the tone, navy icon at 14.
    - **Other stops**: 24 px navy with a `1.5px rgba(255,255,255,.2)` ring and the icon at 12 in `#8D99B5`.
    - **Line**: 2 px `rgba(255,255,255,.14)`.
    - **Labels**: 11/600 `#8D99B5`. Lit labels are 700 in the tone.
  - **Group chips** (`.ax-bz-chips`): 44 tall, radius 999, `rgba(255,255,255,.08)`, text `#E6E9F2` 13/700, an 8 px tone dot and a mono count. The "on" chip is white with navy text.
- **Body**: padding 16, gap 12.
  - **Search row** (`.ax-bz-q`): a 44 px field (radius 14, `inset 0 0 0 1px #E6E3DD`, icon 18, input 16 px so iOS does not zoom) and a 44 px sort button ("Oldest first" / "Newest first", 13/700 with an arrows icon). It appears only when there are rows to search.
  - **Group header** (`.ax-bg-h`): 32 tall, a 10 px tone dot, the label 14/700, the count in mono 12/600 `#6B7480`. On the right sits the group's sum (mono 13/600), a navy total pill (32 tall), or a 44 px act pill. For example, "Ask the shop about 3" uses the good tint, and "All 3 codes" is navy with a mint icon.
  - **List card** (`.ax-bg-list`): white, radius 18, shadow `0 1px 2px rgba(22,32,60,.05), inset 0 0 0 1px #E6E3DD`, padding `0 12px`.
  - **Row** (`.ax-br`): min-height 58, gap 10, divider `1px #F1EEE8`. From left to right:
    - avatar sm 32
    - name 14/700, ellipsis
    - mono sub-line 11 `#6B7480`: `#2401 · 3:33`
    - **age pill**: 22 tall, padding 0 7, mono 11/600, by tone (see §B3)
    - figure: mono 13/600, right-aligned
    - chevron: 14 px `#9AA1AE`. In its place there may be a **go pill** (36 tall, navy, 13/700; the pay version is `#FDEEE1` / `#7A4A02`) or a **code chip** (26 tall, radius 8, navy with mint mono 12).
  - **More**: after 4 rows a group folds. "Show 3 more ⌄" sits in a 44 px row, 13/700, with a top divider.
- **Stage tones on navy**:

  | Tone | Hex |
  |---|---|
  | Sent | `#F5B26B` |
  | Packing / On the way | `#8DA2D6` |
  | Out, Ready, Today | `#6FDCB0` |
  | Late (2+ days) | `#F08A7E` |

### B2. The order's own screen (Track sheet, `s04`)

Values below were measured with computed styles at 360 px.

- **Navy top**:
  - Avatar 40.
  - Name 17/700.
  - Mono sub-line `#2401 · 3:33` and a **live chip**: a mint dot plus "live" on `rgba(111,220,176,.14)`.
  - A 44 px glass × button.
  - Then a hairline `rgba(255,255,255,.08)`.
  - Then the **stage word** 24/700 at `-.02em`, with its sub-line 13/600 `#B3BCD2` on the same baseline, for example "Packing · Being packed now".
  - Then the **rail** (P18):
    - Done stops: 24 px `#22305A` with a mint tick (stroke 2.8).
    - The current stop: 34 px mint with the navy icon at 16, and `axGlow 2s infinite`. When it waits on the user, it is `#F5B26B` with `axGlowW`.
    - The mint line runs as far as the order has come.
    - Labels: the stage name 11/600, done ones in `#B3BCD2` and ones to come in `#8D99B5`. Under each, the time in mono 11/600, or "now". The current stage's name and "now" are mint 11/700.
- **Below the top**:
  - A money card: white, radius 16. Label 12/600 `#6B7480`, figure mono 20/600, a side chip mono 14/600 in the good tint, an 8 px navy split bar, and captions 11/600.
  - A receipt card with zig-zag top and bottom edges. Its header "WHAT CLIENT GETS" is 11/700 at `.12em` (1.32 px) tracking, uppercase, with a good chip "✓ 6" and a 44 px fold button.
  - Line rows: qty in mono plus unit 12/600 `#6B7480`, name 14/600, a green tick, amount mono 14/600.
  - A 2 px ink rule above "Total" (13/700), with the total in mono 17/600.
  - Then the P21 action tiles: label 13/700 and sub-line 11/600 `#6B7480` (Call · Tell Client · Receipt · Change "or cancel").

### B3. Status language (the agent's exact words)

- **Rail steps** (`orderSteps`):
  - Pays at the end: **Sent · Checked · Packing · On way · Done · Paid**.
  - Prepay: **Sent · Checked · Paid · Packing · On way · Done**.
  - Pickup orders say **Ready** instead of "On way", with the store icon instead of the truck.
  - The money step reads **"Pay shop"** until it is paid, and only then "Paid". A step never claims money moved before it did.
- **Stage words** (`orderStage`):

  | Stage | Words |
  |---|---|
  | Checking | sub "3 of 6 confirmed with the supplier" |
  | Pay now | — |
  | Confirmed | sub "Packing starts next" |
  | Packing | sub "Musa is packing it" / "Being packed now" / "The shop is bringing some items in" |
  | Ready | sub "Waiting at the shop for you" |
  | On the way | sub "Ssali is delivering" |
  | Settle up | sub "420,000 owed to the shop" |
  | Done | sub "Delivered" / "Collected" |
  | Cancelled | — |

- **Today tiles**: Basket(s) · Sent · Packing · Out. Tile dots and badges: warn = money waits on you, good = ready to collect, bad = packing 2+ days, cold `#5C6788` = basket untouched 14+ days.
- **Badge on any order row** (`.ax-badge`, 28 tall, 12/700, icon 14):

  | Badge | Look |
  |---|---|
  | `pay` | `#95530C` with white text: "Pay 1.2M" / "Settle 1.2M" |
  | `go` | `#0F6B43` with white text: "Collect" |
  | `shop` | `#E3EEFB` / `#1A5A8A`, for Checking / Confirmed / Packing / On the way |
  | `done` | `#F1EEE8` / `#6B7480` |
  | `off` | `#FBE5E2` / `#8E2A22`, for Cancelled |

- **Age pill** (`busyAge`): `12m`, `5h`, `3d`. Its tone comes from hours waited at that stage (`BUSY_WAIT`):

  | Stage | warn from | late from |
  |---|---|---|
  | sent | 3 h | 24 h |
  | packing | 24 h | 48 h |
  | out | 4 h | 24 h |

  Neutral `#F1EEE8` / `#5F6980`, warn `#FDEEE1` / `#7A4A02`, late `#FBE5E2` / `#8E2A22`.
- **Live dot**: 7 px mint with `axPulse 2s infinite` inside the hero pill "Live" (`rgba(255,255,255,.08)`, 12/600). When offline, the dot is `#F5B26B`, does not move, and the pill reads "Offline" (`t08`).

## C. States at 360 px (the live app)

| State | How it looks | Where |
|---|---|---|
| **Pressed** | `transform: scale(.97)` over `.12s ease`. Applies to tiles, `.btn`, rows (`.ax-oc`, `.ax-pickrow`), the payment method, glass buttons. Red goes to `#A82D24` (`.btn-accent:active`). Navy primary pressed is `#243052`. There is no tap highlight (`-webkit-tap-highlight-color: transparent`). | CSS lines 3092–3094 |
| **Focus** | `outline: 2px solid #C93A30; outline-offset: 2px` on `:focus-visible`. A search field gets a `1.5px #16203C` border plus a `0 0 0 4px rgba(22,32,60,.08)` halo. | `t02` |
| **Disabled** | `.btn[disabled]` opacity .45, default cursor. `.ax-act[aria-disabled]` opacity .4 with no pointer. The slide knob goes `#59627A` and stops nudging. | |
| **Empty dock** | Total = three 8 px dashed dots plus "0" in `#5C6788`. Track `rgba(255,255,255,.05)`. Knob holds a grey basket. Label 15/600 `#7F89A6` "Add an item to send". | `t01` |
| **Sending / busy** | The slide label becomes "Sending…", the knob stays at the end, the fill is `rgba(201,58,48,.35)`. Buttons read "One moment…" / "Sending…" and are `disabled`. Inline spinner `.ax-spin` is 12 px, `2px #E6E3DD` with the top in ink, `axSpin .8s linear infinite`. A loading pill reads "Getting the shop list". | `t01` |
| **Loading** | Skeleton blocks `.ax-sk` (radius 6, `#EDEAE4 → #F7F5F2`, `axShim 1.4s linear infinite`) drawn in the real layout: aisle tiles, product cards. | `t01` |
| **Success** | Toast: navy, a 28 px mint disc with a navy tick, 14/600, top-centre 14 px down, gone after 2.4 s (`t09`). A whole-screen moment for a send (P22, `axPlane` 3.4 s, then auto-continues on a 4.4 s fill bar). Haptic `success`. | |
| **Warn** | Toast `#FDEEE1` with a `1px #F3D3B0` border, `#7A4A02` 700 text, a `#95530C` disc with white "!" (`t10`). The tone is picked from the words: offline / paused / "Enter…" / "Choose…" give warn. | |
| **Error** | A white card **at the bottom**, above the tab bar or dock (it clears them by 12 px). Radius 20, `1.5px #E8B4AE` border, shadow `0 10px 28px rgba(142,42,34,.16)`. A 36 px `#8E2A22` disc, title 14/700 crimson, reason 13/500 `#5F6980` (it splits "Title: reason" at the colon), an optional 40 px red "Try again", a 44 px ×. It stays at least 8 s and has `role="alert"` (`t11`). | |
| **Offline** | Full-width bar above everything: `#FDEEE1`, 13/600 ink, wifi-off icon `#95530C`, padding `10px 16px`. Hero pill turns amber "Offline". Writes are blocked with a warn toast, and the slide says "Back online…". | `t08` |
| **Data suspect** | Same bar, the words "Couldn't confirm your latest orders just now…". | |
| **Paused** | Navy bar, white text, mint icon. | |
| **Staging** | Fixed strip at the bottom-left, z-index 899, `#C93A30` with white 600/11 text, radius `0 6px 0 0`: "STAGING — test data, not the real books". **It covers the left tab label at 360 px** (every screenshot). The Store should lift it above the tab bar or move it to the top. | |
| **Empty (list root)** | Clients (`t05`). (1) A ghost white card (radius 20) of 3 faded skeleton rows (opacity 1/.7/.4) under a white fade. (2) A 76 px navy-gradient icon tile (radius 24, mint icon 40, `axFloat 3s`). (3) Headline 20/700. (4) One line 14/500 `#5F6980`. (5) A 56 px navy primary (radius 16, mint icon). (6) Two 64 px secondary tiles: a white one and a good-tint one (`#EAF8F0` / `#BFE3CF`), each with an icon, a 13/700 title and an 11/600 sub-line. | |
| **Empty (stage sheet)** | Only a grey 26 px icon plus "Nothing here right now", 14 px `#5F6980` (`s05`). This is **weaker than P24**. The Store should use the full empty state here too: a ghost row card plus one next move. | |
| **Confirm** | A white sheet. Title 22/700 ("Sign out?"), one paragraph 15 `#5F6980`, then two equal 48 px buttons side by side: ghost "Stay signed in" and a crimson `#8E2A22` "Sign out" (`t07`). Prefer **Undo for 10 s** over confirming. Keep confirms for things that cannot be undone. | |

## D. Motion and feel

| Name | Duration and easing | Used for |
|---|---|---|
| `axUp` | `.24s cubic-bezier(.2,.8,.2,1)`, from Y+40 / opacity .4 | Sheet in |
| `axFade` | `.18s ease-out` | Scrim in |
| Drag to close | Pull down from the top 72 px, or from anywhere once scrolled to the top. Closes past ⅓ of the height or on a flick (> .6 px/ms and > 40 px), with `transform .22s cubic-bezier(.2,.8,.2,1)`. The scrim alpha follows the finger. | Sheets |
| Escape / Android back | Closes the top sheet first, then returns to Today, then minimises. | |
| Toast | Opacity `.2s`, transform `.25s cubic-bezier(.2,.8,.2,1)`, from Y−16 scale .96 | Top toasts. Error toasts come up from Y+16. |
| `axPulse 2s` | box-shadow ring | Live dot |
| `axGlow` / `axGlowW 2s` | box-shadow ring | The current rail stop |
| `axNudge 1.6s ease-in-out` | 6 px | The slide knob invites |
| Slide back | `.25s` | A slide let go short of the end |
| A tap on the slide without dragging | — | Toast "Slide the red button across to send" |
| Item to basket | WAAPI `1150ms cubic-bezier(.45,.05,.55,.95)` (`.ax-fly` 56 px tile) | Item lands in the basket, followed by `axBump .8s` on the bar and a mint "+1" chip (`axPlus1 1.9s`) |
| `axPop` | `.4s cubic-bezier(.2,1.4,.4,1)` | Success disc |
| `axTickPop` | `.7s cubic-bezier(.2,1.6,.4,1)` | A tick landing |
| `axShim 1.4s linear` | — | Skeleton |
| `axSpin .8s linear` | — | Spinner |
| `axFloat 3s` | — | Empty-state icon |

- **Haptics** (`window.owHaptic`, Capacitor only, silent elsewhere):
  - `tap`: light impact when something lands in the basket or a picker changes.
  - `success`: notification when an order is sent or paid, or a goal is hit.
  - No sounds.
- **Reduced motion**: a global `@media (prefers-reduced-motion: reduce){ *{animation:none !important; transition:none !important;} }`, plus local opt-outs. The Store should carry the same global rule.

## E. Taps per agent job (what the Store should match or beat)

| Job | Path in the agent app | Taps |
|---|---|---|
| See how everything is | Today: tiles with counts and faces, plus "Needs you" | **0** |
| Find an order | Stage tile → row. With many: tile → type in search → row. | **2** (3 with search) |
| See where an order is | Stage tile → row: the rail with times | **2** |
| Start an order for a regular | + → "Who's this for?" → client → their usual, "Add all" → slide | **4 + slide** |
| Start a walk-in order | + → type → + on the result → who → slide | **3 + typing + slide** |
| Pay the shop | Needs you "Pay the shop" → row → "Pay now" → method is prefilled from the phone number → Pay → PIN on the phone | **4** |
| Collect codes | Needs you "Ready to collect · Codes" → "All 3 codes" | **2** |
| Chase late packing | Needs you "Packing 2+ days · Ask" → "Ask the shop about 3", which opens WhatsApp | **2** |
| Add a client | Clients → "Add a client" → name and phone → "Save client" | **3** |

Patterns that keep the counts low:
- Act from the row.
- A slide, not a review page.
- Prefill (usual, method, amount).
- One sheet over where you were.
- Undo instead of confirm.

## F. Voice (seen in the live copy)

- Verb first, two or three words: "Pay", "Codes", "Ask", "Clear", "Add a client", "Save client", "Show 3 more", "Oldest first".
- State in plain words, with the number in mono: "8 live · 2 done", "Packing 2+ days", "3 of 6 confirmed with the supplier", "19 days left".
- Sub-lines are fragments joined by " · ": "#2401 · 3:33", "oldest 2d".
- Names over roles: "Musa is packing it", "Ssali is delivering".
- Section heads name the content: "On the move", "Needs you", "Next move", "What Kato gets".
- Errors are headline plus reason, and say what was kept: "Could not send: no signal", "Kept on this phone".
- Some live strings break the voice:
  - The offline sentence is long, with an ASCII "--".
  - The Packing sheet sub-line read "0 being packed" (it is the money total in mono, so it looks like a count).

  **Store**: keep the notice bar to one line, "No signal · 2 not sent yet", with a "Try again" pill (P27).

---

## Rules for the Store redesign

1. Build from `LANGUAGE.md` tokens and parts. Use no new colour unless it answers ground / state / action / category, and every text pair clears 4.5:1.
2. **Navy carries state and money, white carries work, red is the one move.** The red + and the slide are red. Nothing else is red unless it is a single irreversible step.
3. The Store has two places and a red +, with a **white tab bar 84 tall**. Today's head is a **flat navy hero** with bottom radius 28.
4. Today = the head, then "On the move" 4 stage tiles with counts and faces, then "Needs you" rows by kind (each with a count and one go pill), then one navy "Next move" card.
5. Everything about one order opens as a **full sheet** over where you were. A sheet has a grab bar, the title with its count in the stage tone, a mono sub-line, a 44 px glass ×, the **stage rail with the band**, then group chips.
6. Stage lists: group header (tone dot, label, mono count, sum or act pill), then a white radius-18 list card. Rows are 58 tall: avatar 32, name 14/700, mono `#id · time`, age pill, mono figure, then a chevron or a go pill. Fold after 4 rows.
7. Use the agent's rail words and order, with Store-side names from `docs/audit/GLOSSARY.md`. A step never claims what has not happened ("Pay shop" until paid).
8. Age pills tone by hours at the stage: neutral, then warn, then late. A colour is never the only carrier. Pair it with position, an icon or a count.
9. Every number is IBM Plex Mono with tabular figures. Words are Figtree 400–700. Body text at least 13, captions at least 11. Inputs are 16 px.
10. Tap targets are at least 44 px. Primary buttons are 56 px (48 inside a sheet pair). Pills are 36 visible inside 44.
11. States: press = scale .97 over .12s. Disabled = 45 %. Busy = the label says "Sending…" and the control locks. Success = navy toast plus haptic. Error = the bottom white card with "Try again". Offline = the amber bar plus an amber live pill.
12. Empty = the P24 / Clients pattern (ghost card, icon tile, headline, one line, one navy primary, two secondary tiles), **including inside stage sheets**. Loading = skeletons in the real layout, never a lone spinner.
13. Motion uses the durations in §D. Sheets can be dragged to close. Respect `prefers-reduced-motion` globally.
14. Commit packing, loading or handing over with **a slide (85 %)** or one button, then a success moment. Prefer **Undo 10 s** to confirm sheets.
15. Count the taps for each Store job (pack an order, report a short pick, load a trip, receive a trip, count a shelf) and aim for the agent's numbers: find in 2, act in 2–4.
16. Keep the staging strip off the tab labels at 360 px.
