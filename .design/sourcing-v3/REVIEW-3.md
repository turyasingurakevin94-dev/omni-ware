# Sourcing mockups — design review, third pass

Independent third pass on the "Sourcing Engine" canvas after it was redrawn in the Store's
phone language, 23 Oct 2026. Report only: no artboard, tool or app file was changed.

**Source reviewed.** The live canvas, version `1792737450-e281`: 45 boards (44 phones and
the plan). Every file matches `.design/sourcing-v3/` at `e412bc3` on
`claude/sweet-mayer-sqtl88` byte for byte. Read against `docs/phone-design-language.md`
(§4–6 and the Sourcing section) on the same commit.

**How it was checked.**
- `tools/check.cjs`: all boards OK.
- Every board rendered with `tools/render.mjs`, normal and `FULL=1`, and looked at.
- A scripted audit of every rendered board for:
  - red action elements of 40 px or more;
  - buttons and links under 44 px;
  - text contrast against the real ground, gradients and translucent layers included;
  - glyphs, pronouns, roles in text, and figures outside the mono face;
  - a scrolling body.
- Six boards compared side by side with the Store canvas (`Today`, `Receive`, `Load`, the done screen).
- Every shared figure traced across boards.

## Verdict: not ready yet, but one short round away

The redraw is a big step up.
- Sourcing now looks like the Store: the head, the stat grid, the job card, the lists, the slide dock and the done screen with its track all match.
- Every flagship figure agrees on every board.
- The owner's decisions of 23 Oct are drawn correctly.
- One red per screen holds on all 45 boards.
- The average premium score is **4.4** (second pass: 3.9).

Two things should be fixed before sign-off:

1. **"n of 6" means different things on different boards** (B1). The passport is the core idea, so its count must mean one thing.
2. **The owner's rule 10 fails in shared pieces** (B2): touch targets under 44 px and grey text at 2.6:1, on about 20 boards. Each is one fix in `ow.py`.

Then there are 10 should-fix items (mostly figures that contradict each other on a few boards) and 8 polish items.

**Counts:** 2 blockers · 10 should-fix · 8 polish.

---

## 1. The guide's rules (§6), board by board

✓ = pass. Numbers in brackets refer to the findings below.

| Board | One red | Lines, not cards | Nothing picked for others | Typed numbers | Names, no pronouns | No glyphs · figures mono | 44 px · 4.5:1 | 390×844, scrolls |
|---|---|---|---|---|---|---|---|---|
| Main (Today) | ✓ the + | ✓ walk card is the one job | ✓ | — | ✓ | figures in subtitles in Figtree (S7) | "One at a time" link 15 px tall (B2) | ✓ |
| Wanted | ✓ none | ✓ | ✗ "Set aside / Hunt it" drawn as a segmented control with Hunt it white (S6) | — | ✓ | ✓ | times `10:42` at 2.6:1 (B2) | ✓ |
| Hunt | ✓ slide | ✓ | ✓ none ticked | — | ✓ | ✓ | "or ask on the walk" 15 px tall (B2) | ✓ |
| Funnel | ✓ the + | ✓ | ✓ | — | ✓ | ✓ | lane chips 32 px, view switch 38 px (B2) | ✓ (chip row scrolls sideways) |
| Passport | ✓ Fix 2 gaps | ✓ | ✓ "Choose" | — | ✓ | ✓ | "Keep both" 34 px (B2) | ✓ |
| Verdict | ✓ disabled until picked | ✓ | ✓ nothing picked | — | ✓ | "31,000 under…" in Figtree (S7) | disabled label 2.1:1 (P1) | ✓ |
| PhotoGate | ✓ | ✓ | ✓ | — | ✓ | ✓ | item chip 33 px (B2) | camera, fixed ✓ |
| PackingGate | ✓ | ✓ | ✓ | ✓ typed boxes | ✓ | "= 50 boxes" in Figtree (S7) | ✓ | ✓ |
| SendToManager (and done) | ✓ slide | ✓ | ✓ | — | ✓ "With Ruth" | ✓ | ✓ | ✓ |
| ManagerItem | ✓ | ✓ | markup 25% preset is Ruth's own field ✓ | ✓ typed | ✓ | rival prices in Figtree (S7) | ✓ | ✓ |
| ManagerRule | ✓ | ✓ | ✓ | — | ✗ "the owner sees each one" (P4) | "at 25%" in Figtree | toggle 50×30, "Change" 26 px (B2) | ✓ |
| SentBack | ✓ | ✓ | ✓ | — | ✓ | ✓ | ✓ | ✓ |
| Live | ✓ | ✓ | ✓ | — | ✓ | ✓ | ✓ | ✓ |
| Capture | ✓ none (a sheet) | ✓ | ✓ | — | ✓ | ✓ | ✓ | ✓ |
| MarketRun | ✓ | ✓ | ✓ | — | ✓ | ✓ | "Mark … done" circles 32 px (B2) | ✓ |
| Visit | ✓ none | ✓ | ✓ | — | ✓ | coach lines in Figtree (S7) | "All the same · 3" 15 px; struck price 2.6:1 (B2) | ✓ |
| RivalRun | ✓ none | ✓ | ✓ | — | ✓ | "36,000 · 8 days ago" in Figtree (S7) | "All the same · 3" 15 px (B2) | ✓ |
| SupplierPrice | ✓ disabled | ✓ | ✓ have/don't unpicked | ✓ keypad | ✓ | ✓ | disabled label 2.1:1 (P1) | ✓ |
| QuickPrice | ✓ disabled | ✓ | ✓ unit and stock unpicked | ✓ keypad, 000 | ✓ | ✓ | "Same" 26 px; dates 2.6:1 (B2) | ✓ |
| Voice | ✓ | ✓ | ✓ | ✓ fields tap to fix | ✓ | ✓ | ✓ | ✓ |
| ReadPaper | ✓ | ✓ | ✓ | ✓ unsure figure typed | ✓ | read text in Figtree (S7) | tick boxes 28 px (B2) | ✓ |
| Search | ✓ none | ✓ | mode switch preset (a mode, fine) | — | ✓ | ✓ | ✓ | ✓ |
| NewItem | ✓ disabled | ✓ | ✓ | — | ✓ | ✓ | aisle chips 36 px (B2) | ✓ |
| PushBack | ✓ slide | ✓ | ✓ no counter picked | ✓ "Or type it" | ✓ | reasons in Figtree | reason chips 36 px (B2) | ✓ |
| Outbox | ✓ | ✓ | ✓ | — | ✓ | ✓ | times 2.6:1 (B2) | ✓ |
| Prices | ✓ the + | ✓ | ✓ | — | ✓ "Denis decides", "Ruth is told" | ✓ | tabs 40 px (B2) | ✓ |
| Proposals | ✓ none | ✓ | ✓ | — | ✓ | ✓ | buttons 38 px; struck price 2.6:1 (B2) | ✓ |
| Suppliers | ✓ the + | ✓ | sort preset (a view, fine) | — | ✓ | ✓ | sort chips 38 px (B2) | ✓ |
| Supplier (Owino) | ✓ | ✓ | ✓ | — | ✓ | "proposes 44,000" in Figtree (S7) | ✓ | ✓ |
| SupplierKiseka | ✓ | ✓ | ✓ | — | ✓ | as Owino (S7) | ✓ | ✓ |
| AskConfirm | ✓ slide | ✓ | ✓ none picked | — | ✓ | ✓ | "what Kiseka sees" 15 px (B2) | ✓ |
| SupplierConfirm | ✓ none (green) | card is the one job ✓ | ✓ | — | ✓ | ✓ | ✓ | supplier app, fixed; 15 px past the right edge (P7) |
| Deal | ✓ slide | ✓ | ✓ | — | ✓ "Denis decides" | ✓ | ✓ | ✓ |
| Twins | ✓ | ✓ | ✓ | — | ✓ | ✓ | ✓ | ✓ |
| NewSupplier | ✓ disabled | ✓ | ✓ credit unpicked | — | ✓ | ✓ | chips 36 px (B2) | ✓ |
| Profile | ✓ none | ✓ | ✓ | ✓ typed | ✓ | ✓ | toggle 50×30 (B2) | ✓ |
| NameAisle | ✓ | ✓ | aisle filled for you, drawn as Check ✓ | — | ✓ | ✓ | chips 36 px (B2) | ✓ |
| SuppliersGate | ✓ | ✓ | ✓ | ✓ typed | ✓ | "50+ 119,000" in Figtree (S7) | "Priced 2 days ago" 2.6:1 (B2) | ✓ |
| GapWalk | ✓ | ✓ | ✓ | — | ✓ | ✓ | ✓ | ✓ |
| Certify | ✓ | ✓ | hold filled for you, drawn as Check ✓ | — | ✓ "markup set by Ruth" | ✓ | ✓ | ✓ |
| PushActions | ✓ none | ✓ | ✓ | — | ✓ | ✓ | ✓ | lock screen, fixed ✓ |
| EmptyToday | ✓ (+ drawn navy) | ✓ | ✓ | — | ✓ | ✓ | ✓ | ✓ |
| ErrorState | ✓ the + | ✓ | ✓ | — | ✓ | ✓ | "Try again" 40 px (B2) | ✓ |
| LongNames | ✓ the + | ✓ | ✓ | — | ✓ | ✓ names cut, figures never | ✓ | ✓ |
| Plan (wide) | — | — | — | — | role labels beside names, fine | "→" typed arrows (P5) | — | 1760×1400 ✓ |

**Summary:**
- One red per screen passes on all 45 boards.
- Nothing is picked by default on any choice someone else acts on, except Wanted's look (S6).
- There are no pronouns. One role is used in place of a name (P4).
- Rule 10 fails in shared pieces (B2).
- Figures in subtitles are mostly not in the mono face (S7).

## 2. The skeleton and pieces against the Store canvas (§4–5)

Compared side by side: Sourcing Today with Store Today, Visit with Load, Send to Ruth's done state with the Store's slid states, and Funnel, Passport and Prices with Receive and Stock.

| Piece | Match | Note |
|---|---|---|
| Navy head, radial gradient, radius 0 0 32 32 | ✓ | identical |
| Head circles, 44 px | ✓ | |
| Stat grid on navy (ring plus 2×2 tiles) | ✓ | the Store marks one live tile white; Sourcing doesn't need to |
| Next job card with a white 58 px pill | ✓ | "Today's walk" is the Store's "Check in Denis's trip" |
| Lists, 62 px rows with tinted icons or faces | ✓ | |
| Dark dock with Slide to … | ✓ | disabled text says what is missing ("Pick who to ask first") ✓ |
| Done screen: mint circle in rings, stat strip, three-dot track, Undo top right | ✓ | Send to Ruth: Sent → Ruth (pulsing) → On sale ✓ |
| Tab bar with the raised + | ✓ | navy + when the red is elsewhere (EmptyToday) ✓ |
| Steppers with a typed box | ✓ | |
| Choice tiles, nothing picked | ✓ | Verdict, QuickPrice, NewSupplier |

The pieces are the Store's own. Two Sourcing pieces were inherited, and one other is drawn inconsistently:
- The toggle (50×30) and the chips (28–36 px) are under 44 px. That comes from the Store's pieces as specified in §5, so the guide itself conflicts with rule 10 (B2).
- The "filled for you" checks are counted as done on some boards and not on others (B1).

## 3. Blockers

### B1 · "n of 6" means different things on different boards
- **Wire mesh:**
  - Passport, "Six checks": **1 of 6 done**. Supply is the only one done; Packing and Name are "Check, filled for you".
  - The Funnel ring and GapWalk: **3/6**.
  - ManagerItem: "5 of 6 checks".
- **Iron sheet:**
  - Certify, "Filled from what it already sells": **5 of 6**.
  - Today's row "Iron sheet G28 · certify": **4/6**.

The guide says a filled-for-you check "is never drawn as done", yet the Funnel's 3/6 counts both. The passport is the core idea of the app, so "n of 6" must mean one thing everywhere.

**Fix.** Count only what a person has kept, and show the checks waiting for a look separately:
- the ring's striped arcs already draw them;
- the figure could read "1/6 · 2 to check";
- or count "kept + filled" and say so on the Passport.

Then align the mesh (Funnel, GapWalk, Passport) and the iron sheet (Today, Certify).

### B2 · The owner's rule 10 fails in shared pieces: 44 px targets and 4.5:1 text
- **Under 44 px**, found by the audit:
  - choice and aisle chips at 36 px (NameAisle, NewItem, NewSupplier, PushBack);
  - Funnel lane chips at 32 px and its view switch at 38 px;
  - tabs and sort chips at 38–40 px (Prices, Suppliers, Search, ReadPaper);
  - Proposals' Accept / Not now / Push back at 38 px;
  - toggles at 50×30 (Profile, ManagerRule);
  - "Same" (26 px) and "Change" (26 px);
  - MarketRun's "Mark … done" circles (32 px) and ReadPaper's tick boxes (28 px);
  - text links 15 px tall: "One at a time", "or ask on the walk", "what Kiseka sees", "All the same · 3";
  - "Keep both" at 34 px; the PhotoGate item chip at 33 px; "Try again" at 40 px.
- **Under 4.5:1:**
  - 11–13 px secondary grey at **2.6:1**: the times in Wanted and Outbox, QuickPrice's dates, SuppliersGate's "Priced 2 days ago", and the struck-out old prices in Visit and Proposals.

**Fix, once in `tools/ow.py`:**
- Give every tappable chip, toggle, tick and text link a 44 px hit area. Padding or an invisible `::before` keeps the drawn size.
- Move the faint grey to `#5F6980` (5.5:1 on white).
- Add both checks to `check.cjs` so they stay fixed.
- Note in the guide that §5's chip and toggle sizes are drawn sizes, not hit areas.

## 4. Should-fix

| # | Board | Finding (evidence) | Fix |
|---|---|---|---|
| S1 | ManagerRule | The wire mesh is listed under "Did not fit the rule: **Asked to consign** · waits for you". Everywhere else the hold is **Stock** (Verdict, Passport, ManagerItem "Moses chose Stock") | Make the reason the real one ("Room 31,000 above the rule's line", or whatever the rule tests), or use an item that was asked to consign |
| S2 | ManagerRule | The states contradict each other. The rule toggle is **Off** ("each new item waits for you"), the head says **0 on sale by the rule**, and yet "By the rule this week" lists three items with countdown rings ("20h", "9h", "hours left") | Draw one state. If the rule is off, there are no countdowns. If it is on, the toggle is on and the head counts them |
| S3 | MarketRun, SupplierKiseka, Main | Kiseka is stop 3 on today's walk (2 wanted, 1 photo). The same screen says "Off the walk: Kiseka Steel has 5 old prices · ask them in the supplier app". Kiseka's scorecard's red action is "Put Kiseka on the next walk". So Moses is at Kiseka today but asks the 5 old prices by app, and plans another trip | Fold the 5 old prices into the Kiseka stop ("8 jobs"), or take Kiseka off today's walk; change the scorecard's action to match ("On today's walk · stop 3") |
| S4 | Supplier, SupplierKiseka | "12 d since a visit", "2 d since a visit", the walk itself, and "Put Kiseka on the next walk" need a record of visits. None exists (no `supplier_visits`, no walk table) | Name the table in the Sourcing migration plan (walk stops, visited_at), or say "since a price was taken there" (from `prices.date`) |
| S5 | Outbox | "They send **by themselves** when the phone is back online". ow-design §7: "Nothing sends itself" (round 4 had "It goes up when you have signal") | "They go up when the phone has signal". Capture already says "it sends when there is signal" |
| S6 | Wanted | Each ask's "Set aside / Hunt it" pair is drawn as a segmented control with **Hunt it** white, so it reads as already picked (rule 5) | Draw two separate buttons: Set aside outlined, Hunt it navy |
| S7 | 15 boards | Money and counts in subtitles are in Figtree, not the mono face, against §3 ("every figure"). Examples: Today "Katwe is 1,500 a roll cheaper"; ManagerItem "Kikuubo 149,000 · Nateete 152,000"; RivalRun "36,000 · 8 days ago"; Supplier "proposes 44,000"; SuppliersGate "50+ 119,000"; Verdict "31,000 under …"; Visit's coach lines; ReadPaper's read lines | Have `ow.py`'s subtitle helper wrap figures in the mono span |
| S8 | `docs/decision-rights.md` | The owner's decisions of 23 Oct are on the canvas but not in the binding file. The file has no row for: the hold (Sourcing), the first batch (Denis decides, Sourcing suggests), pinning to the agents' feed (Ruth), Ruth's standing price rule, and "unfinished items stay as leads". CLAUDE.md: `test/decision-rights.test.js` fails if the migrations and the file disagree | Add the rows and reserve the Sourcing v3 migration number before the build starts |
| S9 | ManagerRule | The rule puts items on sale after a countdown with no tap. That is the owner's choice, but it needs to say whose decision it is and what Ruth can still stop | Show "Ruth's rule since 23 Oct" in the head, and a one-tap "Hold this one" on each countdown row |
| S10 | Visit, RivalRun | "Swipe a row: right for the same price, left for a new one" explains in words what the two buttons already show (rule 1) | Drop the sentence, or keep one small swipe icon on the section head |

## 5. Polish

| # | Board | Finding | Fix |
|---|---|---|---|
| P1 | Verdict, SupplierPrice, QuickPrice, NewItem, NewSupplier | The disabled red pill's label ("Pick how we hold it") is 2.1:1. It is the line that says what is missing, so it has to be read | Darker label on the faded pill, or the Store's disabled slide style |
| P2 | Prices | "+2.0% iron sheet cost". Round 4 had iron sheet **down** 2.0%, and ReadPaper reads Namanve's G28 as "same". Check the direction | One direction, from the same purchase data |
| P3 | Live | "Denis Okello · Buyer · decides the first batc…" is cut | "Denis · first batch" |
| P4 | ManagerRule | "the owner sees each one in the log" uses a role (rule 7) | "Joseph sees each one in the log" |
| P5 | Plan | Typed "→" arrows in the cards ("one slide → with Ruth") | Drawn arrows, or a middle dot |
| P6 | canvas.json | Row titles sit 200 px above their rows (2704 for a row at 2904); the Design type asks for at least 223 | Move each title 30 px up |
| P7 | SupplierConfirm | Content runs 15 px past the right edge (`render.mjs` reports maxR 405) | Trim the card's shadow or its width |
| P8 | Funnel | The lane chips scroll sideways with no cue past "Hunting 6" | Fade the right edge, as the Store does |

## 6. Earlier checks, in one pass

**Navigation.** `check.cjs`: every link resolves, heights match and every handler runs. The audit found no dead buttons on the main path. The template boards are titled as templates (PhotoGate: wire mesh; PackingGate: screws; SentBack: door hinge). ✓

**Figures across screens.** All but the ✗ rows agree:

| Figure | Boards | Result |
|---|---|---|
| Mesh 118,000 / 149,000 / room 31,000 (Strong) | Passport, Verdict, ManagerItem, Voice, SuppliersGate, SupplierKiseka | ✓ |
| Verdict 68 · confidence 67 · Stock (small first batch) · consign 125,100 / 23,900 | Passport, Verdict, ManagerItem | ✓ (ManagerRule ✗, S1) |
| Hoop iron 1,500 × 140 = 210,000; 23,500 against 22,000 | Main, Prices, Deal, SupplierKiseka | ✓ |
| Namanve 700 × 260 = 182,000; G28 34,200, 100+ 33,500 | Prices, ReadPaper, Certify | ✓ |
| Radar 392,000 | Prices | ✓ |
| Kiseka: 31 lines, 26 fresh, 5 old (oldest 52 d), 14 orders, about 3 days | SupplierKiseka, Suppliers, AskConfirm, Main, Deal, PushActions | ✓ |
| Owino: 22 orders, 24 lines, fill 41 of 44 | Supplier, Visit, PushBack, Twins, Suppliers | ✓ |
| The walk: 19 jobs = 7 (Owino) + 5 (Kikuubo) + 3 (Kiseka) + 4 (Nateete); 4 stops, 2 areas, 15 + 4 | Main, Capture, MarketRun | ✓ (S3: Kiseka also "off the walk") |
| Today's share 4/6 · 78% fresh (312 of 400) | Main, Prices | ✓ |
| Iron sheet 260 a month, room 1,300 (Thin) | Certify, Prices, RivalRun | ✓ |
| Funnel 30 = 1 + 9 + 6 + 4 + 3 + 2 + 5; Today 9 wanted · 6 hunting · 2 with Ruth · 5 went live | Funnel, Main | ✓ |
| On sale at 18:10, 147,500, 3 customers told, 40 sheets | Live, PushActions, ManagerItem | ✓ |
| n of 6 (mesh, iron sheet) | Passport, Funnel, GapWalk, Main, Certify | ✗ B1 |

**Wording.** Names, not roles, hold everywhere except P4. The hand-offs read the same way each time: "Slide to send to Ruth", "Slide to ask Kiseka", "Slide to pass it to Denis". One regression is S5.

**Decision rights.** The screens match the owner's 23 Oct decisions:

| Decision | Where it shows |
|---|---|
| Sourcing chooses the hold | Verdict; ManagerItem "Moses chose Stock" |
| Denis decides the first batch, Sourcing only suggests it | ManagerItem "Denis decides the first batch · ≈40 suggested"; Live |
| Ruth pins items to the agents' feed | Live "Ask Ruth to pin it", "Ruth decides" |
| Denis decides who we buy from | Deal "Slide to pass it to Denis" |
| Accepting a supplier's rise tells Ruth (0153) | Proposals |
| Unfinished items stay as leads | Passport tag "Quoted" |
| Certify fills five checks from sales and price data | Certify |

What is still missing is recording these decisions in `docs/decision-rights.md` (S8).

**Claims the data can't back yet.**
- Visits and the walk: no table records them (S4).
- The supplier app being asked to confirm prices (AskConfirm, PushActions "Accept all 5"): `supplier_proposals` only holds what a supplier sends. A shop-initiated ask, and "answers 9 of 10 asks within a day", need a new request kind.
- Voice and the read of a printed list: both need a recognition service. The boards say honestly that they need signal.
- Lock-screen action buttons: work on Android web push and Capacitor. On iOS web push they are limited, so plan an "Open" fallback.

**Regressions in the redraw.**
- The faint grey is back at 2.6:1 (B2).
- Figures in subtitles are no longer mono (S7).
- The Outbox wording (S5).

Everything else from round 4 survived, including the Visit row fix: names now get the full width, and the "today's share" tag is on its own line.

## 7. Premium score per board

| Score | Boards |
|---|---|
| **5** (19) | Main, Passport, Verdict, Hunt, PhotoGate, SendToManager, ManagerItem, Live, Capture, QuickPrice, Voice, ReadPaper, PushBack, Prices, AskConfirm, Deal, Certify, PushActions, ErrorState |
| **4** (25) | Wanted (S6), Funnel (B1, P8), PackingGate, SentBack, MarketRun (S3), Visit (S10), RivalRun, SupplierPrice, Search, NewItem, Outbox (S5), Proposals, Suppliers, Supplier (S4), SupplierKiseka (S3), SupplierConfirm, Twins, NewSupplier, Profile, NameAisle, SuppliersGate, GapWalk (B1), EmptyToday, LongNames, Plan |
| **3** (1) | ManagerRule (S1, S2: two contradictions on one board) |

**Average 4.4** (second pass 3.9, first pass 3.5). The best of the canvas (Today, the Passport, the Verdict, Send to Ruth's done screen, Voice, ReadPaper) is as polished as the Store canvas it copies.
