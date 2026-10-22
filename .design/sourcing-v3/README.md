# Sourcing engine — design canvas (v3, round 2)

These are the phone mockups for the Sourcing app, rebuilt from first principles and then
revised against the independent review in `REVIEW.md`. Each `*.dc.html` file is one
artboard, and `canvas.json` lays them out. The live canvas is the "Sourcing Engine"
design artifact. Nothing here is loaded by any app.

**The core idea: no item goes on sale until its passport is complete.** The passport has
six gates, in this order on every screen:

| Gate | Done when | Whose |
|---|---|---|
| Photo | a square photo passes the on-phone check (sharp, light, size; background is advice only) | Sourcing |
| Packing | how we sell it is set, and every supplier's own pack divides into it | Sourcing |
| Suppliers | at least one priced supplier (two or more is the target) | Sourcing |
| Verdict | stock / per order / consign is chosen. Consign stays open until the supplier agrees | Sourcing |
| Name & aisle | set | Sourcing |
| Markup | the Manager prices it, and it goes live in the same write | Manager |

## Screens (25)

| Row | Artboards |
|---|---|
| The funnel | `Main` (Today), `Wanted` (sort the asks), `Hunt` (who to ask), `Funnel`, `Passport`, `Verdict`, `PhotoGate`, `PackingGate`, `SendToManager`, `ManagerItem` (Manager app), `SentBack`, `Live` |
| In the field | `Capture`, `NewItem`, `SupplierPrice`, `QuickPrice`, `Search`, `Visit`, `PushBack`, `Outbox` |
| Prices and suppliers | `Prices`, `Suppliers`, `Supplier` (Owino Plumbing), `Twins` (merge), `Profile` |

## The Sourcing score (review B2)

The score uses cost, rivals and demand only, never a shelf price or a markup, so Sourcing
can compute it for a draft that has no price yet.

| Part | Weight | 0–100 |
|---|---|---|
| Demand | 30 | `askers×11 + (wait ≥ 14 ? 12 : wait ≥ 7 ? 6 : 0) + min(15, qty/10)` (the console's rule) |
| Room | 30 | `(cheapest rival in stock − cost) / cost ÷ 0.30 × 100` |
| Competition | 10 | `90 − 18 × rivals in stock + 10 × rivals out` (the console's rule) |
| Supply | 15 | 2+ priced 85, 1 priced 55, 1 known 30, none 5; −40 if every minimum order is above demand |
| Cash back | 15 | `100 − 3 × (days to sell the first batch − 7)` |

Bands follow the console: 70 and up = stock it; 55 to 69 = a small first batch; 40 to 54 = per order; under 40 = don't.

The hold uses the console's `holdRec`:
- **Consign** when the batch takes over 21 days to sell, cash is over 2M, and there are 10 or more orders with that supplier.
- **Per order** when the supplier delivers in 2 days or less and fewer than 5 people asked.
- **Stock** otherwise.

A consigned unit costs 6% more, and the passport, the ladder and the room all switch to that cost.

**Room bands:** strong is 20% of cost or more, fair is 10–20%, thin is under 10%.

**The wire mesh worked through:**

| Part | Score | Why |
|---|---|---|
| Demand | 43 | 3 askers, 40 sheets, waiting 9 days |
| Room | 88 | 31,000 under Kikuubo's 149,000 is 26% of the 118,000 cost |
| Competition | 54 | 2 rivals in stock |
| Supply | 85 | 2 suppliers priced |
| Cash back | 73 | about 16 days to sell |
| **Score** | **68** | a small first batch |

Confidence is 67. The hold is **Stock**: 16 days is under 21, and Kiseka takes 3 days to deliver. Consigning would cost 125,100 a sheet, leaving room of 23,900 (fair).

## What happened to each finding in REVIEW.md

| Finding | Done on the canvas |
|---|---|
| B1 the verdict | 68 · Stock · confidence 67 · ≈16 days, the same figures on Passport, Verdict, ManagerItem and the coach |
| B2 the margin leak | The cost-only score above. "Room" is the only margin-like figure Sourcing sees. The radar's Y12 card shows the rival's price and the room, never our price |
| B3 the consignment cost | Passport switches the cost, ladder and room for Consign. Verdict shows all three holds side by side. Consign waits for "They agreed". ManagerItem prices off the chosen hold's cost |
| B4 rights and schema | Drawn: Send to the Manager (push to Ruth) and Sent back (her reason). **Still to build:** the `docs/decision-rights.md` rows, the migration, and the push kinds, in the build (plan stage 1a) |
| B5 navigation | Every card and tile has its own target or is plainly not a link. The Suppliers tab opens a list. Capture, Visit and the Passport tiles go to the right screens |
| S1 static passport | The ring, count, gap line and dock follow the gates and the chosen hold |
| S2 hidden content | Bottom padding sits clear of every dock and tab bar |
| S3 three reds | Card buttons are navy. Red is the + and the one dock action per screen |
| S4 lanes | "Sent back" and "Live this week" lanes. Each lane says how many more it holds |
| S5 funnel legend | Six pips per card, in the legend's order; the photo thumbnail shows when there is one; one gate string per item everywhere |
| S6 packing | Each supplier's own pack is checked. The button stays off and names who doesn't fit. The drawing follows the steppers |
| S7 next moves | Three cards for "3 today" |
| S8 Y12 | Rival price and room only, "The Manager is told" |
| S9 visit progress | All 7 jobs count. "Today's share" only on the two rows that are in it. The dock is "Done here · N left" until all are done |
| S10 accept / push back | Accept says what happens next. Push back is its own sheet. A price drop gets "Not now" in place of Push back |
| S11 colour roles | Amber `#95530C` for gaps. Score bars use state colours only. Rivals are plum everywhere, suppliers indigo |
| S12 contrast | No faded text. `#6B7480` replaces `#767F91` |
| S13 names | "For Ruth" is now "For the Manager". **Open:** the two rival shops are still invented; the owner adds real rivals to `docs/canvas-cast.md` |
| S14 wishes | Movers say "What we paid, against last month". Sparklines say "what we paid, last 6 buys". "None of our suppliers lists it". "Start a visit" is a list sorted by today's jobs, not location. "Saved on this phone first. It goes up when you have signal." Fill rate says "since 1 Sep". Talking points date the rival price |
| P1 glyphs | Drawn icons for the steppers, the backspace and the up/down arrows. The ★ is now "Recommended" |
| P2 type ramp | 11/12/13/14/15/16/20/28 only; 44 for the one big figure on QuickPrice |
| P3 money | Figures in prose are in the money face |
| P4 photo | One size line, pass marks with no raw numbers, a torch button, a working Retake |
| P5 Manager | Labels hang away from each other, cost and our price above the line and the rival below; shorter facts; "Send it back" goes to Sent back |
| P6 rival price | Full shop name, working pickers and units, a visible "Do they have it?", the last three readings here |
| P7 supplier | Hero shows "since a visit"; Call is a phone link; Compare opens Twins; terms and days can be edited; each sparkline has a last-price dot |
| P8 | "4/6 today" |
| P9 safe areas | Not shown on mockups; the build pads every bar by `--safe-b` |
| P10 shot.mjs | Reads `width: 390px` with spaces; no `.app` needed |
| P11 | ManagerItem is titled "later that day"; PhotoGate is interactive |

## Still to draw

- **Sheets:**
  - Name & aisle sheet (with item twins, 0152)
  - Suppliers-gate sheet
  - New-supplier form
  - Deal detail
  - Rival run (several shops in a row)
- **States:** empty, error and long-name.
- **Other suppliers' scorecards:** the Suppliers list links only Owino's.
- **Certify:** it reuses the passport, which is drawn for the wire mesh only.

Screenshot one artboard: `node .design/shot.mjs .design/sourcing-v3/Main.dc.html`. Holes stay unfilled; it shows layout only.
