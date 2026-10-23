# Sourcing engine — design canvas (v3, round 4)

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

## Screens (36)

| Row | Artboards |
|---|---|
| The funnel | `Main` (Today), `Wanted` (sort the asks), `Hunt` (who to ask), `Funnel`, `Passport`, `Verdict`, `PhotoGate`, `PackingGate`, `SendToManager`, `ManagerItem` (Manager app), `SentBack`, `Live` |
| In the field | `Capture`, `NewItem`, `SupplierPrice`, `QuickPrice`, `Search`, `Visit`, `PushBack`, `Outbox` |
| Prices and suppliers | `Prices`, `Suppliers`, `Supplier` (Owino Plumbing), `Twins` (merge), `Profile`, `Proposals` |
| The rest | `NameAisle`, `SuppliersGate` (who sells it), `NewSupplier`, `Deal` (hoop iron: switch supplier), `RivalRun`, `SupplierKiseka`, `Certify` (iron sheet, a live top seller), `EmptyToday`, `ErrorState`, `LongNames` |

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

## Round 3: what was still to draw, now drawn

Each of these is now drawn and linked:

| Item | Where it is reached from |
|---|---|
| Name & aisle sheet (teach a name, the look-alike check) | the Passport |
| Suppliers gate (who sells it, two is the target, add a price) | the Passport |
| New-supplier form (snap the card, look-alike by phone) | the Suppliers list, Hunt it, Who sells it |
| Deal detail (hoop iron) | Today's deal card, the radar's Switch card, Kiseka's line |
| Rival run (two shops, the items worth checking at each) | Capture |
| Kiseka Steel's scorecard | the Suppliers list |
| Certify (iron sheet G28: sales line, thin room, verdict from sales) | Today, the Funnel's Top sellers |
| States: a new shop, loading failed, long names and big figures | (states, not reached from other screens) |

Two decisions are drawn into these screens:
- **The deal detail passes the deal to the Buyer** ("Pass to the Buyer"). Choosing which supplier to buy from is the Buyer's (`line.switch`, `buy.restock`), so Sourcing recommends rather than switches.
- **Certify waits on nobody** when the Manager has already set the markup.

## Still open

- **Scorecards.** Only Owino and Kiseka are drawn. The other four supplier rows in the list are not links.
- **Passports.** Only the wire mesh and the iron sheet have one. The other Funnel cards open their action, not a passport.
- **The deal radar's "Next step" card** (Namanve's 100+ price) opens the Suppliers list, not a deal page.
- **Wiring for the build:** the decision-rights rows, the migration and the push kinds (plan stage 1a).

## Round 4: the second review (REVIEW-2.md)

**The owner's decisions on the rights (review B1):**
- **The hold stays Sourcing's** (`product.edit`).
- **The Buyer decides the first batch** (`buy.restock`). Sourcing only suggests it: "Suggested batch 40", "≈40 suggested".
- **The Manager pins items to the agents' feed.** Sourcing asks from the Live board, and the Manager decides. This is a new task, `feed.pin`, in the build.
- **Kikuubo Hardware Mart and Nateete Builders' Centre** are the sample shop's rivals, now listed in `docs/canvas-cast.md`.

**What each finding became:**

| Finding | Done on the canvas |
|---|---|
| B1 rights | Batch wording is a suggestion everywhere, the Buyer decides it, and Live asks Ruth to pin |
| B2 tier cost | Kiseka has one price. Katwe's step (50+ 119,000) is out of a 40-sheet batch's reach, so the verdict stays 68 · Stock · 118,000 |
| S1 photo path | Capture's Photo opens the camera, whose item chip opens Search. Search has a "For: a rival price · a photo · a supplier price" switch, and its rows go to the matching screen |
| S2 clipped content | Today is 1,340 and the Funnel 1,520 |
| S3 coach | "A photo and a hold, and it is ready for the Manager" |
| S4 PushBack labels | "Was" hangs left of its dot and "Yours" right of it |
| S5 dead buttons | Each now changes state: PushBack send, Hunt ask, Verdict ask, Deal ask, NewSupplier card and contacts, ErrorState retry, Profile sign-out |
| S6 Proposals | New Proposals board, opened from Today's "Review 2" and Kiseka's "Review" |
| S7 averages | One mean of the six suppliers everywhere: cheapest 70, fills 90, fresh 83 |
| S8 screws | Katwe Fabricators (carton of 5,000) and Namanve Sheets (roofing screws by the 1,000); the Funnel says "2 prices" |
| S9 cut names | The tag moves to the second line on Visit and RivalRun; the name has the row's full width |
| S10 templates | The photo, packing and sent-back boards are titled as templates or examples |
| S11 pronoun | Named, no pronoun |
| S12 Packing tile | Opens the packing template |
| P1 | 15px stays: ow-design §1 sets the phone body at 15px |
| P2 | Radar figures are in the money face |
| P3 | "Send · 2 gaps" |
| P4 | "1 sent back" chip in Today's hero, beside "5 went live" |
| P5 | "about 16 days, counting none of the 40 as sure" |
| P6 | The agent's ask uses the Sell tint |
| P7 | Supplier rows show three labelled bars with figures |
| P8 | SendToManager, SentBack and Profile are 844; NewItem is 900 |
| P9 | "Manager app · from a push" |
| P10 | The wire mesh is "being priced" |

**Data this canvas assumes, added to the build's migration:**
- `supplier_visits`, written by a visit's Start and Finish, behind "since a visit" and "Plan a visit";
- `suppliers.delivery_days`;
- `suppliers.sells text[]`, replacing the "Sells:" lines in `notes`;
- `payload.counter` on `supplier_proposals`, shown in the supplier app.

PushBack's "We pay on time" is gone, because that is Accounts' data.

**After the third look.** The reviewer confirmed round 4 and asked for three last fixes, now done:
- **Visit:** the row wraps, so the Same price / New price buttons drop below the name, and "today's share" is no longer clipped. The age never breaks.
- **Rival run:** the same wrap, so the last-seen line shows in full.
- **Suppliers:** the board is 1,110 tall, so nothing is cut at the bottom.

## Round 5: easier to use (the owner asked "what else would make it easier?")

The person this serves is on foot in the market, with the phone in one hand and patchy signal. Round 5 removes four costs: typing every price, walking to a supplier only to hear "same price", opening the gates one at a time, and moving between two lists.

| Cost removed | What changed | Board |
|---|---|---|
| Taps at the counter | Swipe a row (right: same price, left: new). **All the same · N** confirms a stop at once. Every done row and every bulk action can be undone. | Visit, RivalRun |
| Typing | **Say it**: "Kiseka, wire mesh, one eighteen" fills the supplier, item, price and unit. A price equal to the last one saves as "Same price". | Voice (from Capture) |
| Typing a whole list | **Read a list**: a photo of their printed list, or a WhatsApp message shared into the app. Each line is matched to an item and shown against our last price. An unsure line is asked about, and a line we don't stock can start a hunt. | ReadPaper (from Capture) |
| Keypad work | A shillings keypad with a 000 key, the unit beside the figure, **Same** for the last price, and an Undo toast instead of a confirm dialog | QuickPrice, SupplierPrice |
| Trips for "same price" | **Ask Kiseka to confirm 5**: the five lines older than 30 days go to the supplier app, which already has Still the same / Changed. The answers come back as proposals, and the walk drops those lines. | AskConfirm, SupplierConfirm (from Today, Suppliers, Kiseka, the walk) |
| Two lists, one walk | **Today's walk**: suppliers and rival shops ordered by area (Kikuubo and Owino, then Nateete). Each stop shows its jobs, and the red button always names the next stop. | MarketRun (from Today, Capture) |
| Gates by hand | Packing and Name & aisle are **filled for you** (from Kiseka's price row and the askers' words), drawn dashed until kept. **Keep both** takes one tap. The hold is not pre-chosen, because confidence 67 is under 70. | Passport |
| Back and forth to the passport | **Fix 2 gaps** steps through Photo, then Hold, and ends on Send to Ruth | GapWalk |
| Opening the app | Push buttons: Kiseka answered → **Accept all 5**; the mesh went on sale → **Ask Ruth to pin it** | PushActions |
| Choosing what's next | **One at a time** on Today walks the Waiting list in order | Main |

**Figures kept true:**
- Kiseka has 31 lines priced and 26 fresh, so 5 are old.
- Flat bar goes from 28,000 to 29,000.
- Today's walk is 19 jobs: Owino 7, Kikuubo 5, Kiseka 3, Nateete 4.
- Stock cash is 118,000 × 40 = 4,720,000.
- Namanve's G28 is 34,200, with 33,500 at 100 or more (the radar's 700).

**Decision rights unchanged:**
- Asking a supplier to confirm and accepting the answers sit under `price.list` (Sourcing).
- The filled-in tiles and the hold are still Sourcing's to keep.
- Pinning to the agents' feed is still Ruth's (`feed.pin`).

**What the build needs for this:**
- An `area` on suppliers and on rival shops, for the walk.
- A push kind `price.confirm` to the supplier app, carrying the price ids. The supplier app's check flow opens on those lines first. Each ask is logged, which is what "answers 9 of 10 asks in a day" counts.
- Voice through the `@capgo/capacitor-speech-recognition` plugin that the Sourcing APK already bundles, reusing `nativeSpeech()` from agent.html. A small parser maps "one eighteen" to 118,000 against the last price's size.
- `api/sourcing-read.js`: Claude vision reads the photo or text into lines, matched against our item names (`item_names`). It needs signal; offline, the photo waits in the outbox.
- An Android share target in the Sourcing APK, for WhatsApp.
- Notification actions (categories) in the APK for Accept all and Ask Ruth.
- Undo instead of confirm: each capture waits a few seconds in the outbox before it is sent.

## Build decisions (23 Oct)

The owner reviewed ways to build this better and faster, and took three:

1. **Unfinished items stay as leads, never in the products list.**
   - The six checks live on the sourcing lead (`sourcing_leads`).
   - When the Manager prices it, the database creates the product and its prices in one step.
   - A guard stops products being created any other way.
   - The console's "new product" and the assistant become "start a lead".
   - No selling path needs a draft filter, so nothing unfinished can go on sale.
2. **Certifying is mostly automatic.** Items already selling fill packing, suppliers, name and aisle from their own data. The hold comes from 90 days of sales, and is set automatically when confidence is 70 or more. What is left, mostly photos, is a list ordered by sales.
3. **The Manager's standing price rule.**
   - The Manager can set: "put a new item on sale at the default markup when it stays under the cheapest rival with Strong room".
   - Matching items go live at once with a log line, and the Manager can change the price within 24 hours.
   - Everything else waits for the Manager.

## Redrawn in the shared phone language (23 Oct)

The owner asked for the Store app's look on Sourcing (`docs/phone-design-language.md`). Every board was redrawn to it:
- 390 × 844, radius 28, the gradient head with a centred grey title;
- lists as lines, one red thing per screen;
- slide to hand work to someone else, then a done screen with a three-dot track;
- names, not roles (Ruth, Denis);
- nothing picked for you;
- every number can be typed.

The canvas now opens on a wide plan board, as the Store's does, with four rows of screens under it.

**Built from code, not by hand.** `tools/ow.py` holds the pieces, lifted from the Store canvas. `tools/boards/<Board>.py` builds each board. Run `python3 tools/build.py <Board>` from this folder's copy of the canvas to rebuild one.

**What changed besides the look:**
- **Nothing pre-picked:** the price screens (have it, unit, stock), Hunt's suppliers, Ask Kiseka's lines, the verdict's hold, New item's aisle and who asked, and the new supplier's credit days now start empty. The button says what is missing.
- **Typing:** the steppers (packing, markup, prices a day) take typed figures.
- **Done screens:** Send to Ruth, Push back, the deal (pass to Denis), Ask Kiseka and Fix the gaps each end on a done screen with a 10-second Undo.
- **Certify:** the five checks it fills from what it already sells are shown, with the photo left (owner's decision of 23 Oct).
- **Today's "Waiting on you":** back to lines, each keeping its small picture.

Screenshot one artboard: `node .design/shot.mjs .design/sourcing-v3/Main.dc.html`. Holes stay unfilled; it shows layout only.
