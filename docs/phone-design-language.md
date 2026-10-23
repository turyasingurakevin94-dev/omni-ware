# The phone design language: how the Store app's screens are drawn

The Store app (`store.html`) and its canvas (the "Store App Redesign" Design
canvas, https://claude.ai/artifact/LVsyQEintezbVH3qn4cSVi) share one look the
owner likes. This file says what that look is, exactly, so another app (Sourcing
first) can be drawn the same way. Copy the values; do not approximate them.

Read with: CLAUDE.md (visual-first), `docs/decision-rights.md` (who decides),
`.claude/skills/ow-design/SKILL.md` (the console's system: the desktop is a
different design; this file is the phone).

## 1. The idea in one breath

A navy head that carries the state of the screen as a picture, a warm paper
body that carries the work as lines, and one red action at the bottom. Every
figure is a shape before it is a number: a ring, a bar, a row of dots, a strip
of faces. Text names things; it does not explain them.

## 2. Colour tokens (as in `store.html` `:root`)

```
--bg        #F7F5F2   the warm paper the body sits on
--paper     #FFFFFF   lists and cards
--navy      #16203C   the head, dark docks, primary dark buttons
--navy2     #243052   raised navy (your own avatar, tiles on navy)
--ink       #1C2233   text            --ink2 #5F6980  secondary text
--rule      #E6E3DD   hairline round a list   --soft2 #EFECE6 row dividers
--red       #C93A30   THE one action (white text on it, 5.08:1)
--mint      #6FDCB0   good / live on navy (ticks, rings, "Live")
--amber     #F5B26B   waiting / caution on navy   --amberInk #95530C on paper
--amberSoft #FDEEE1   caution ground      --amberDeep #7A4A02 ink on it
--green     #0F6B43   good on paper       --greenSoft #E4F4EA
--crimson   #8E2A22   bad on paper        --crimsonSoft #FBE5E2
--indigo    #3A3F9B   buying / trips      --indigoSoft #E4E6FA
--navyInk   #B3BCD2   secondary text on navy   --navyInk2 #8D99B5 quieter
```

The head's ground is always the same gradient:
`radial-gradient(130% 90% at 50% 0%, #2B3866 0%, #16203C 65%)`.
A full-screen "done" page uses `radial-gradient(120% 70% at 50% 0%, #2B3866 0%, #16203C 60%)`.

People and categories get soft tints from a fixed set (pink #F6E4F1/#7A3268 for
the Manager, indigo for the Buyer, green, sky #DCEAF8/#1A5A8A, amber, teal
#DDF1EE/#0E5E57). A tint is identity, never status.

## 3. Type

- **Figtree** 400/500/600/700 for everything you read. Weights used: 600 for
  secondary, 700 for titles and buttons. Nothing else.
- **IBM Plex Mono** 500/600 for every figure (counts, times, order numbers
  `#0042`, "3/4"). Figures are mono so they line up and read as data.
- Sizes: 11 (labels under figures), 12 (subtitles), 13 (section heads, the head's
  centred title), 14 (row titles), 15–17 (buttons, names), 20–22 (a screen's
  big title), 26–40 (a hero figure). Letter-spacing −.01em on 20+.

## 4. The skeleton of every screen (390 wide, phone)

```
┌ navy head ─────────────────────────┐  .cv-hero  radius 0 0 32px 32px
│ (‹)      Small grey title       ( )│  .cv-top: 44px circles, 13px #B3BCD2 title
│ [picture of the state]             │  ring / tiles / bar / faces / route
└────────────────────────────────────┘
  Section head (13px, ink2)            .cv-sec
  ┌ white list, radius 22 ───────────┐  .cv-list: inset 0 0 0 1px #E6E3DD
  │ (icon) Title            right ›  │  .cv-row: 62px min, 12px gap
  │        subtitle                  │
  └──────────────────────────────────┘
  ... more sections ...
┌ dark dock (optional) ──────────────┐  navy, radius 28 28 0 0
│  one line of state  ·  quiet note  │
│ [ ≫  Slide to …               ]    │  or one red 58px pill button
└────────────────────────────────────┘
```

Padding: head `10px 16px 18–22px`; body `18px 16px 24px`; gaps 10px between
blocks, 6–8px inside grids. The safe area on top is padding inside the head
(`calc(10px + var(--safe-area-inset-top))`), so the head colour runs up under
the clock.

## 5. The pieces (copy from `store.html`, CSS names in brackets)

- **Head circle buttons** (`.cv-circ`): 44×44, radius 999, `rgba(255,255,255,.08)`
  on navy, an 18px stroke icon. A blank one keeps the title centred.
- **Stat strip on navy**: a 2–3 column grid, radius 18,
  `background: rgba(255,255,255,.06); box-shadow: inset 0 0 0 1px rgba(255,255,255,.07)`;
  each cell 60–66px tall: a mono 20–22px figure over an 11px #B3BCD2 label;
  cells divided by `box-shadow: -1px 0 0 rgba(255,255,255,.07)`. One cell may
  carry colour (mint = good, amber = waiting).
- **Ring** (progress or a part of a whole): SVG circle, stroke 5–9, track
  `rgba(255,255,255,.1)` on navy or `#EFECE6` on paper, round caps, the figure in
  mono in the middle (`3/4`, `20 bags`).
- **Lists, not cards** (`.cv-list` + `.cv-row`): one white rounded block holding
  rows; a row = 42px tinted icon or initials circle, title (14/700) over
  subtitle (12/600 ink2), and on the right a chip, a mono time, or a chevron.
  Rows that open something are `<button>`s.
- **The big job card** (`.cv-job`): navy, radius 22, a tag at top
  (`.cv-tag`, 26px pill with icon), a 22px title, a stat row (`.cv-stat`), and a
  white 58px pill button (`.cv-white`) at the bottom.
- **Chips** (`.cv-chip`): 28px pill, soft ground + its ink, 12/700.
- **Steppers**: `−` 40–44px circle on #F1EEE8, the figure in a 2px-navy-bordered
  box (typed or tapped), `+` circle in navy. Typing is always allowed.
- **Choice tiles** (reasons like Damaged / Lost / Stolen): a 3-up or 2-up grid
  of 64–84px tiles, white with `inset 0 0 0 1.5px #E6E3DD`; picked = navy ground,
  white text. Nothing is picked for you.
- **Segmented control** (`.cv-seg`): #F1EEE8 pill track, the picked one white
  with a soft shadow.
- **Toggles** (`.cv-tog` + `.cv-sw`): 50×30 track, green when on.
- **Slide to confirm** (`slideHTML`, `.st-slide`): on a dark dock, a 48px red
  knob with a double chevron and the label "Slide to …"; disabled reads what is
  missing ("Tick every line together"). Used for anything that leaves the yard
  or goes to someone else. After a slide: a 10-second **Undo** pill top-right.
- **Done screens** (`sentScreen`): full navy page, a 96px mint circle with a
  tick in two faint rings, a 26–28px title ("Return logged"), one grey line,
  a stat strip, and a **track** of three dots (done → who decides now → what
  follows), each with a name and a small word under it.
- **Faces**: initials circles (34–60px) in the person's tint; stacked with −8px
  overlap and a 2px navy ring; a ring of colour around one says its state.
- **Route / steps strip**: small squares and dots joined by 3px lines — done
  dots green with a tick, the current one white with a coloured ring that
  pulses, later ones hollow, the yard/shop as a navy rounded square.
- **Bottom sheets** (`.st-sheet`): paper ground, radius 26–28 on top, a
  40×5 grip, a 22px title with a 44px close circle, then the content.

## 6. Rules the owner holds to

1. **Show, don't explain.** If a sentence describes a quantity, draw it.
2. **One red thing per screen**, and it is the next move.
3. **Lines, not cards**, for lists. Cards only for the one job in focus.
4. **No scrollbars** (`scrollbar-width:none`), no emoji, stroke icons 1.8–2.4.
5. **Nothing picked by default** for a reason or a choice that someone else
   will act on.
6. **Every number field can be typed**, never only + and −.
7. **Names, not roles**: "With Ruth", "Denis's round", "Kevin bought 1".
   Use the person's name; never guess pronouns ("waiting on Ruth", not "her").
8. **Order numbers are `#0042`** in mono, everywhere.
9. **No money on a phone that is not for money** (the Store phone shows no
   prices, costs or payments; the database must not send them either).
10. Touch targets ≥ 44px; 4.5:1 contrast for every text colour.

## 7. How to work

1. Draw first, on a Design canvas (CLAUDE.md: mockups with /design), one board
   per screen and state, 390×844, `is_interactive`, `radius: 28`, in rows with a
   title note per row. Look at the Store canvas's rows for the pattern.
2. Use the sample shop in `docs/canvas-cast.md` for names and data.
3. Then build to the board, and compare a screenshot of the app with the board
   side by side before calling it done.
