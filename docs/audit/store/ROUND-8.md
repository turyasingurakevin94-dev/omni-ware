# Store · Round 8: Accessibility (+ round 7 leftovers)   (brief received 23 Oct 2026, build 23 Oct 2026 21:58 UTC)

**Canvas:** https://claude.ai/artifact/LVsyQEintezbVH3qn4cSVi, row "Audit round 8 · accessibility" (bottom of the canvas, version 111).
- The Big text, play button, headings, Pack, Hand over and On the road boards are the real screens from the harness, with each planned change applied there as a prototype. `store.html` is not changed.
- The shop check board is drawn.

**Migration:** none.

**Do not regress (round 7):**
- whole units on Pack and Hand over;
- Pack lines opening at the ordered amount;
- 44 px controls;
- the type and radius tokens;
- the header;
- receipt tags;
- picture fallbacks;
- On the road stops and "(hired)".

## What was found

| ID | Root cause |
|---|---|
| STO-REL-11 | `boot()` reads `shop_members` once, right after `getUser()`. That read can go out before the stored session is restored or refreshed. Since 0164 a member reads only their own row, so the read comes back as **0 rows with no error** and goes straight to "This login has no shop". A reload has a fresh token, which is why it fixed it. An error that is not a network error was shown only as a toast. |
| STO-A11Y-01 | Big text works by rewriting `font-size:Npx` in the HTML (`bigText`) and in the style sheet (`bigSheet`). Round 7 moved the brief's screens onto `var(--t-…)`, which neither pattern matches, so Big text no longer changes them. |
| STO-UI-03 | Option A (room at the end) helps only after scrolling. At rest the floating button still rises 30 px over whatever sits above the bar. |
| STO-A11Y-02 | Section labels are `<span class="cv-sec">` and page titles are `<b>`, so nothing is a heading. The screen under an open page also stays in the accessibility tree, so a screen reader hears two screens. |
| STO-A11Y-03 | "1 of 2" on the Pack card is ink-2 text straight on the picture's tint, which measures 2.9:1. |
| STO-UI-10 | On the slip, the people picker wraps to 2 rows and the dark panel is tall, so on a shorter phone the receipt's last line ends up behind the panel. On the road, the order and "Mark delivered" share one row, so the order wraps character by character beside the button. |

## Design changes (canvas)

| ID | Board(s) | Before → After | States drawn | Tokens/components used | New component? |
|---|---|---|---|---|---|
| STO-REL-11 | `Store · Shop check · states` | **Before:** one failed read says "This login has no shop". **After:** "Checking your shop…" while the sign-in is restored and the shop is asked. If it can't be read: "Could not reach the shop", with Try again, a code and Sign out. "This login has no shop" appears only when the shop answers that there is none. | before, checking, could not reach, no shop | the sign-in card, the Try again button, the Could-not-load ring icon | No |
| STO-A11Y-01 | `Store · Big text · Today, Pack, Hand over` | **Before:** Big text on, nothing changes. **After:** every size a step up (12→15, 14→17, 16→20, 20→24, 28→34, 40→48: at least 1.2×). Today's legend wraps; Pack's "10 dozen" stays on one screen; long lines on Hand over give way with "…". Nothing is clipped at 360. | before, Today, Pack, Hand over | the type tokens | No |
| STO-UI-03 | `Store · Play button · at rest` | **Before:** at rest the button sits on bays 2 and 3. **A2:** the white bar grows up to the button's top, so the list loses 30 px. **B (recommended):** the button docks inside the bar, nothing above the bar is covered, and the same bar is used on every tab. | before, A2, B (Today), B (Stock) | nav bar, play button | No |
| STO-A11Y-02 | `Store · Headings · Today, Hand over` | **Today:** h1 is the greeting; h2 are "Next job", "Bays" and "Then". **Pages:** h1 is the page title; h2 is each section. Dashed outlines on the board show what a screen reader hears; nothing changes on screen. | Today, a page | — | No |
| STO-A11Y-03 | `Store · Pack · position label` | **Before:** "1 of 2" on the tint, 2.9:1. **After:** the same text on a white pill in ink-2, 5.5:1. | before, after | pill (as the Aisle pill) | No |
| STO-UI-10 | `Store · Hand over · 360`, `Store · On the road · 360` | **Hand over:** the picker becomes one scrolling row ("Munyarugero" in full), and the slip scrolls clear of the panel with 32 px to spare. **On the road:** the order sits on one line, with "Mark delivered" under it. | before, after (each) | picker, list rows, navy button | No |

## Code changes planned

| ID | Sev | File / function | Change (one line) | UI? | Acceptance check |
|---|---|---|---|---|---|
| STO-REL-11 | P2 | `store.html` `boot()` + new `readMembers()` + `authScreen('checking' / 'unreachable')` | Wait for the session, and refresh it if it is missing or about to expire. Show "Checking your shop…" unless the last copy is already on screen. Read `shop_members` up to 3 times with back-off. An error becomes "Could not reach the shop · Try again" (or the kept copy when offline). 0 rows gets one session refresh and one more read before "This login has no shop". | yes | In the harness, a first `shop_members` read that is delayed, fails, or comes back empty under a stale token ends on Retry or the shop, never on "no shop". A login with no membership still sees "This login has no shop". |
| STO-A11Y-01 | P2 | `store.html` CSS `html.big{--t-12:15px;--t-14:17px;--t-16:20px;--t-20:24px;--t-28:34px;--t-40:48px}`; `bigText` and `bigSheet` stay for the screens not yet on the scale; the 44 px controls become 52 px under `html.big` | Big text scales the tokens. | yes | With Big text on, every text on Today, Pack, Hand over, Stock, Find and the item page is at least 1.2× its normal size, and a harness check finds nothing clipped at 360. |
| STO-UI-03 | P2 | `store.html` CSS `.st-nav.cv-nav .st-go` (option B: docked, 60 px, no rise, badge on the button), or option A2 (a taller bar); `--nav-room` follows the bar | Nothing above the bar is ever under the button. | yes | The harness overlap check (any text or control whose box meets the button above the bar's top edge) reports nothing on Today, Stock, Find, Returns, Alerts and the aisle lists, at rest and scrolled. |
| STO-A11Y-02 | P2 | `store.html`: page titles (`cv-top b` and each page's title span) get `role="heading" aria-level="1"`, Today's greeting is the h1, `.cv-sec` and `.cv-h b` get `role="heading" aria-level="2"`, and the screen under an open page or sheet gets `inert` | One h1 per screen, h2 per section, no visual change. | no (semantics) | The harness counts exactly one level-1 heading on every screen (views and pages), and every section label is level 2. |
| STO-A11Y-03 | P3 | `store.html` `PAGE.pack` card: "1 of 2" on a white pill in ink-2 | 5.5:1. | yes | Contrast of "1 of 2" ≥ 4.5:1 on every tint. |
| STO-UI-10 | P3 | `store.html` `PAGE.slip`: the picker is one row of 76 px tiles that scrolls (no wrap), and the slip's scroller keeps `--s-32` at its end; `PAGE.onroad` `drv`: each stop row wraps, with the order filling the line and the button under it | Fits at 360. | yes | At 360 × 640, the slip's last line scrolls clear of the panel, the picker is one row, and no On the road order wraps beside its button. |

## Server / SQL changes planned

| ID | Migration / function / policy | Change | Test |
|---|---|---|---|
| — | none | STO-REL-11 is on the phone: it waits for the session and reads `shop_members` again. The own-row policy (0164) stays. | — |

## Glossary changes

| Term | Meaning | Replaces |
|---|---|---|
| Checking your shop… | Signed in; the phone is asking which shop this person works in | a blank screen, or "This login has no shop" too early |
| Could not reach the shop | The shop could not be asked just now. It comes with Try again, a code and Sign out | "This login has no shop" after a failed read |
| Big text | You → Big text: every size one step up (at least 1.2×); nothing clipped at 360 | — |

## Not changing / pushed back

| ID | Why |
|---|---|
| STO-UI-03 (option A) | Kevin chose A in round 7. Cowork reopened it because at rest it still covers. B and A2 are both drawn; B is recommended (Q1). |
| NAV-08 | Still open: the aisle has a sticky header; the other long lists are not named. |
| NAV-09 | Still open: removing a waiting item, and restoring the screen on reload. These belong to the reliability or navigation follow-up, not to accessibility. |

## Questions for Kevin

1. **The play button:** dock it inside the bar (B, recommended), or keep it floating and grow the white bar up to its top (A2)? Either one passes the at-rest check; A2 gives up 30 px of list on every screen.
2. **Big text sizes:** the brief suggested 12→14 and 16→19, but those are below 1.2×. The plan uses 12→15, 14→17, 16→20, 20→24, 28→34 and 40→48 so that every size is at least 1.2×. Is that OK?

## Phase B result (filled after implementing)

| ID | Done? | What changed | How verified |
|---|---|---|---|
| STO-REL-11 | | | |
| STO-A11Y-01 | | | |
| STO-UI-03 | | | |
| STO-A11Y-02 | | | |
| STO-A11Y-03 | | | |
| STO-UI-10 | | | |
