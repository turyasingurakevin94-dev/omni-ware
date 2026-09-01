---
name: ow-design
description: The house design system for Omni-Ware — exact tokens, component anatomy, the two-designs law, the meaning rules, and the harness commands for seeing a screen. Load this BEFORE drawing or building any screen in index.html, before adding any CSS, and before editing any test that pins a style. If you are converting a screen to the console vocabulary, designing a phone layout, or reviewing UI work, this is the authority.
---

# The Omni-Ware design system

This is a wholesale hardware shop in Uganda. One owner, a phone in a
yard in daylight, and a computer on a desk. Every figure on screen is
money that is really theirs. Nothing here is decoration.

**Read this whole file before you draw or build.** Then run
`node test/design-system.test.js` — it enforces mechanically most of
what follows, and it is not optional.

---

## 1. The two-designs law

**The desktop is a dense work console. The phone is its own thing. 820px
is a SWITCH between two designs, not a reflow of one.**

The owner rejected an earlier attempt in these words: *"wanting to fit
both on phone and desktop have made you design a very boring desktop
app… let it be slightly dense and professional."* They were right. A
layout that serves both serves neither.

| | Desktop (≥1024px) | Phone (≤820px) |
|---|---|---|
| body type | 13px | 15px |
| row padding | 10–12px | 14–16px |
| page padding | 24px | 16px |
| a queue | table-like rows, 44px, expand in place | cards, actions visible, thumb-sized |
| metrics | one 64px strip, hairline dividers | 2×2 in one card, hairline dividers |
| context | a 304px right rail | below the work |
| surfaces | bordered regions, radius 8, hairlines | cards, radius 8 |
| chrome | navy rail 220px + 54px top bar | navy 44px top bar + white 60px tab bar |

Duplicate what each needs. Do not reach for a middle.

---

## 2. Colour — the complete palette

**These 23 values are the entire palette. Never introduce a 24th.**

```
--ow-steel-950  #14171B   navy chrome, and --ow-ink-900
--ow-steel-800  #252A31
--ow-steel-400  #8A939C   and --ow-ink-400
--ow-steel-100  #DCE0E4
--ow-steel-050  #E9EBED   the page ground (--bg)
--ow-paper      #FFFFFF   panels, cards
--ow-paper-2    #F7F9FB   row hover
--ow-oxide      #B23A26   THE accent
--ow-oxide-deep #8E2C1C
--ow-oxide-light #C9573F
--ow-oxide-soft #F6E7E3   chip ground
--ow-verdigris  #1C6B58   good
--ow-verdigris-soft #E2EFEB
--ow-amber      #B0700A   caution
--ow-amber-soft #FBEFD9
--ow-amber-faint #FEFAF2
--ow-amber-ink  #7A4A02   dark ink FOR amber grounds — never on oxide
--ow-crimson    #7F1D1A   bad
--ow-crimson-soft #F7E4E2
--ow-ink-900    #14171B   body text
--ow-ink-600    #59626B   secondary text
--ow-ink-400    #8A939C   captions, labels, meta
--ow-rule       #CFD5DA   borders
--ow-rule-soft  #E3E7EA   hairlines
```

Rail-only, inside the navy sidebar: text `#C7CFD8`, section labels
`#7C8894`, hover `rgba(255,255,255,0.07)`.

The oxide was chosen deliberately: amber washed out in Ugandan sun and
oxide primer holds up. Do not "warm it up".

### The contrast rule

Every ink you put on a ground must clear **4.5:1** (3:1 at ≥20px or
≥14px bold). This app has already shipped `--accent-ink` (amber ink) on
an oxide fill — dark olive on red, the worst pairing on a phone in
daylight — and nothing caught it. The test computes this now.

### The meaning rules — the part a test cannot enforce

- **Colour only where it means something.** A device that marks
  everything marks nothing. Six card classes here once carried the same
  red left rail and it signalled precisely nothing; they were removed.
- **The accent appears ONCE per screen.** It is the one thing to do
  next. If you have two oxide elements, one of them is wrong.
- **A figure is a size, not a warning.** Money on a row is ink. Crimson
  is for the genuinely bad — behind target, overdue, a loss. Verdigris
  for the genuinely good. Everything else is ink.
- **Never invent a state colour.** good = verdigris, caution = amber,
  bad = crimson. There is no fourth.

---

## 3. Type

Loaded faces, and the only ones: **Inter** 400/500/600/700 (interface),
**Archivo Black** (page names only), **IBM Plex Mono** 400/500/600
(every figure).

**Weights: 400 / 500 / 600 / 700. Nothing else.** 650 and 800 appear in
the legacy file and are *not loaded* — the browser fakes them, which is
why some headings look muddy. Never add one.

**Sizes are on the ramp**, named by pixel value:

```
--ow-t-11  11px   captions, meta, basis lines
--ow-t-12  12px   secondary
--ow-t-13  13px   desktop body, table cells
--ow-t-14  14px   list-row primary
--ow-t-16  16px
--ow-t-20  20px   phone page name
--ow-t-28  28px
19px  desktop page name (Archivo Black, .ow-ph-t)
26px  phone page name (Archivo Black)
```

Line heights: `--ow-lh-tight 1.2` / `-snug 1.35` / `-normal 1.5`.

**Never add a half-pixel size.** The legacy file has 33 font sizes in
half-pixel steps; that is the disease. A handful of deliberate 10.5 /
11.5 / 12.5 survive inside old components — do not create more.

### Money is a component, not a span

Any figure the shop could act on carries, always:

```css
font-family:'IBM Plex Mono',ui-monospace,Menlo,monospace;
font-variant-numeric:tabular-nums;
letter-spacing:-.02em;
```

Figure, then unit, then basis — in that fixed relationship. Right-aligned
in every table. Tabular so columns line up; a column of money that does
not line up is unreadable at a glance, which is the only way it is read.

---

## 4. Space, radius, elevation

```
space   2 4 6 8 10 12 16 20 24 32     (--ow-sp-*)  even steps only
radius  --ow-r-sm 4 · --ow-r 6 · --ow-r-lg 8 · --ow-r-pill 999
lift    --ow-lift  0 4px 16px rgba(15,20,25,.14)   ONE elevation
tap     --ow-tap 44px
measure --ow-measure 76ch
```

**Depth is hairlines, not shadows.** `--ow-lift` is for things that
genuinely float — a menu, a search result. A card does not float.

**Every prose block gets a measure.** On a 1660px screen an unmeasured
paragraph runs 180 characters and is unreadable. This was the single
worst thing about the app before the console.

---

## 5. The components

Use these. Do not hand-roll a variant.

- `.ow-ph` / `.ow-ph-t` / `.ow-ph-sub` / `.ow-ph-help` / `.ow-ph-sp` —
  the page header. Name, one line of what it is, a hairline, the
  screen's own action on the right. The longer explanation goes in
  `.ow-ph-help`, which `foldPageInstructions` moves behind the "i"
  bubble. **The sub is never folded** — on Today it is the reading time,
  and hiding that would conceal the one thing that goes stale.
- `.ow-pan` / `.ow-pan-h` / `.ow-pan-t` / `.ow-pan-n` — the bordered
  region and its 34px header.
- `.ow-strip` / `.ow-mt` / `.ow-mt-l` / `.ow-mt-v` / `.ow-mt-s` — the
  metric strip. One row on desktop, 2×2 on the phone, hairline dividers,
  **no per-tile borders**.
- `.ow-q` / `.ow-q-r` / `.ow-q-x` / `.ow-q-card` — the work queue. The
  desktop row and the phone card are emitted from ONE call so they can
  never say different things.
- `.ow-cp` (+ `.ow-mg` / `.ow-bad` / `.ow-warn` / `.ow-good`) — chips.
- `.ow-sr` — the dense side row.
- `.ow-empty` — the empty state.
- `.ow-grid` / `.ow-side` / `.ow-stack` / `.ow-rec` — layout.
- `.btn` / `.btn-accent` / `.btn-ghost`, plus `.btn.ow-sm` — buttons.

### No fourteenth button family

There are already thirteen in the legacy file. A new one is not a fix,
it is another one. The console uses the existing `.btn` family and one
size modifier on it.

### Text that will not fit — the truncation rule

A shop's real data is longer than the box you drew for it. "Ssekitoleko
Hardware", "Kato Construction Ltd", "Iron sheets — G28, 3m box profile".
Three rules, and they came out of a fan-out where three separate agents
produced the same fault:

1. **An `<input>` cannot ellipsis.** It clips its value mid-glyph, with
   no marker, no tooltip, and no way to read the rest without clicking
   in. So a value that can exceed its box must NOT sit in a bare input:
   size the field for the longest realistic value, or render it as text
   until it is focused. This bit the quote screen's ghost inputs, where
   "Mulongo Hardware" showed as "Mulongo Hardwar" — which reads as a
   different supplier, not as a truncation.

2. **Truncation is three declarations, never two.**
   `overflow:hidden; text-overflow:ellipsis; white-space:nowrap` — all
   three or none. `nowrap` plus `hidden` without `ellipsis` is a hard
   cut with no sign that anything was removed. And a truncating element
   inside a flex or grid parent needs **`min-width:0`**, or it refuses to
   shrink and pushes its neighbours out of the box instead. Carry the
   full value in a `title` so the pointer can still read it.

3. **Money never truncates.** In any table the figure columns are sized
   to their content and the text columns give way. A clipped figure is
   not a shortened figure, it is a WRONG figure — "1,240,00" is a
   tenth of "1,240,000" and looks entirely plausible. If something must
   be cut, cut the name.

### Icons

24 viewBox, `fill:none`, `stroke:currentColor`, **stroke-width 1.8**,
round caps and joins. 16px in dense rows, 18–20px in lists, 22–23px in
the phone tab bar.

**Never emoji.** Draw the mark. In the phone tab bar, **the active state
is FILLED and the inactive state is stroked** — a shape change reads at
a glance where a colour change alone does not.

Draw marks that mean something in this shop rather than borrowing a
generic set. The tab bar's five: a sunrise (Today), a price tag (Sell),
a note with a coin (Money), a bubble speaking in figures (Manager), a
stack of sheets (More).

---

## 6. The three laws of the OW layer

These protect specific tests. Breaking one turns eight test files into
liars.

1. **No existing declaration is rewritten to use a token.** Eight files
   compare raw declaration text through `winningDeclaration`.
2. **No element selector, and nothing on `body`.** The app sets no base
   font-size or line-height, so every unstyled element in 41 screens
   inherits the UA default. Adding one restyles the whole app in a
   commit. Every selector in the layer starts `.ow-` and stays there —
   a rule that must reach outside the namespace lives beside the code it
   couples to, not in the layer.
3. **No new colour**, per §2.

---

## 7. The rules that are about meaning

The app has permanent laws, enforced by tests, that the interface must
not contradict:

- **Derived, never invented.** Every figure comes from the books. If a
  screen shows a number it cannot derive, it says so instead.
- **Nothing sends itself.** Every send, order and payment is an owner
  tap. A screen must never look like it already acted.
- **A failure must name itself.** No silent empty state where something
  went wrong — say what failed.
- **Named rather than dropped.** Truncating a list says how many were
  cut. Missing data is reported, not treated as zero.
- **Not enough is an answer.** An empty screen that says "nothing yet"
  and names the next action beats a screen that pretends.

Copy follows: a control says what will happen ("Draft the chase", not
"Submit"). An empty state names the next action. Errors say what went
wrong and how to fix it.

---

## 8. Seeing your work — the harness

You cannot judge a screen you have not looked at. The app boots locally
with a stubbed database:

```bash
D=/tmp/claude-0/-home-user-omni-ware/<session>/scratchpad
mkdir -p $D/harness
cp index.html shared-worker.js manifest.json $D/harness/
# stub.js supplies window.supabase and window.L; see the scratchpad copy
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 node seedshot.js harness <tab> ...
```

The harness must, for every screen you touch:

1. **boot with no page errors** — `scriptRan: true` and an empty
   `pageerrors` list;
2. **seed demo data** (`data = seedData(); renderAll()`) so the screen
   has content;
3. **screenshot at 1440 and at 390**, and you must LOOK at both;
4. **pass the structure check** — 41 sections, all direct children of
   `main`, none opening below the fold.

A screen that renders correctly but sits 1,100px down the page is a real
defect this project shipped. Only the structure check catches it.

---

## 9. Before you say you are done

Run, in this order, and paste the results:

```bash
node test/design-system.test.js          # the ratchet
node test/section-structure.test.js      # div balance
npm test > out 2>&1; echo $?             # exit 0, NEVER piped
```

Then extract the inline script and `node --check` it. Then answer the
rubric:

1. **What reads first**, and why is that right for this screen?
2. **What does the owner do here, and in how many taps?** Compare with
   before.
3. **Where is the accent, and is it used once?**
4. **Empty, one row, two hundred rows** — screenshot the empty one.
5. **At 390px in one hand** — is the primary action in the thumb zone?
6. **What did you NOT convert, and why?**
7. **Which tests pin this screen, and what did you change?** A test
   edited to pass is a decision to be argued, never a patch. Say what
   the old assertion meant, why it stopped being true, and what the new
   one means.

A report that says "done" is worth nothing.
