# Sourcing mockups — design review

Independent review of the "Sourcing Engine" design canvas (v3), 22 Oct 2026.
Report only: no artboard or app file was changed.

**Source reviewed.** The live canvas (version `1792691680-fc3f`). It is byte-identical
to the snapshot in this folder, so every quote below can be checked here.

**How it was read.** Every `<a href>` and `onClick` was traced. Every figure was
recomputed against `sourcing-console.js`, `index.html` and `supabase/migrations/`.
Every artboard was rendered with its holes filled (a small renderer that runs each
`renderVals()`) and looked at. `.design/shot.mjs` cannot render these artboards
(see P10).

**Verdict.** The design idea is strong. The passport, the cost ladder, the visit
list and the supplier scorecard are the best Sourcing screens so far. It is **not
ready to sign off**, for five reasons:

1. The flagship verdict ("Consign, 65") does not follow from the engine's own rules.
2. The score is built on the markup, which Sourcing must not see.
3. Consignment changes the cost, and the Manager's screen ignores that.
4. The decision rights and the schema have no home yet for the verdict or for a draft item.
5. Most paths out of the main screens land on the wrong artboard or do nothing.

Counts: **5 blockers · 14 should-fix · 11 polish.**

---

## Blockers

### B1 · Passport — the "Consign" recommendation and its figures do not follow from the console's rules
**Evidence.** The Passport shows `65` · `Consign` · `confidence 58` · `Days to sell it ≈ 26`. Recomputed with `sourcing-console.js`:

| Part | Console rule | Recomputed | Mockup |
|---|---|---|---|
| Demand (w25) | `askers*11 + wait≥7?6 + min(15,qty/10)` (l.1269) = 33+6+4 | **43** | 43 ✓ |
| Margin (w25), renamed "Room" | `(shelf−cost)/cost / 0.3` at the 25% default = 0.25/0.3 | **83** | 80 |
| Price vs rivals (w20) | `50 + (149,000−147,500)/149,000×400` (l.1275) | **54** | 72 ✗ |
| Competition (w10) | `90 − 2 in stock × 18` | **54** | 54 ✓ |
| Supply (w10) | 2 priced → 85 | **85** | 85 ✓ |
| Cash payback (w10) | `100 − 4,720,000/50,000 + 0.25×60` (l.1283) | **21** | 61 ✗ |
| **Score** | weighted | **58** → band "Stock a small first batch" (55–69) | 65 |
| Confidence (l.743) | 2 fresh quotes → 70, 2 rivals → 70, 3 buyers → 60 (+10 if one is a regular) | **67** (70) | 58 ✗ |

The weighted sum of the mockup's own six bars is 65.15, so the 65 is self-consistent. It does not come from the engine.

**The hold is the bigger problem.** `holdRec` (l.1446) returns `consign` only when `((cash > 2M && daysSell > 21) || daysSell > 45) && supOrders >= 10`. Cash (4,720,000 = 118,000 × 40) and the 14 orders pass. Days to sell does not. The passport says 40 sheets were asked in 9 days, which is about 4.4 a day. `daysSell = round((batch − committed)/perDay) + 7` (l.1369) is therefore at most 40/4.4 + 7 ≈ **16**, never 26. Kiseka's 3-day lead time rules out "per order" (`leadDays <= 2` fails). The engine's answer is **Stock**, not Consign. The Today coach line ("4.7M of cash stays in the till") repeats the same error.

**Fix.** Either change the story so that Consign is true (for example a first batch of about 100 sheets, 40 of them spoken for, so days to sell is over 21), or show **Stock** with the numbers the engine gives (58, 67, about 16 days). Then make every figure on the Passport, the ManagerItem fact row (`Consign — Kiseka Steel · 65`) and the coach come from the same calculation.

### B2 · Passport / engine — the score is built on the markup Sourcing must not see, and a draft has none yet
**Evidence.** The console's Margin part is `(shelfV − costV)/costV` (l.1272). Price vs rivals and Cash payback also use `shelfV`, and the hold options print `margin ${…}%` (l.1458–1460). `docs/decision-rights.md` row `margin.see`: Manager only. A draft item has no shelf price until the Manager sets the markup, which is the *last* gate. The mockup hides this by renaming Margin to "Room", but the engine underneath cannot compute without a markup.

**Fix.** Define a Sourcing-side score that uses only cost and rivals:
- **Room** = (cheapest rival in stock − cost) / cost.
- **Against rivals** = where cost sits in the rival band.
- **Cash payback** = cost × batch against days to sell.

Write the formula down before the build. Never port the hold "margin %" sub-labels to `sourcing.html`. Add a test that asserts that no field the Sourcing app receives carries a shelf price, a markup or a margin.

### B3 · Passport → ManagerItem — consignment changes the cost, and the Manager prices off the wrong one
**Evidence.** The console puts the consignment unit at `bq.p × 1.06` = **125,100** (l.1444). ManagerItem uses `const COST = 118000` and shows `Against Kikuubo · 1,500 under`. At the shop's 25% default on the consigned cost, the price is round(125,100 × 1.25 / 500) × 500 = **156,500**, which is **7,500 over** Kikuubo. On consignment, the Passport's `Room under the cheapest rival 31,000` is really **23,900**. Consignment also needs Kiseka's yes, and the Verdict gate turns done the moment Moses taps it.

**Fix.**
- Split the Verdict gate's states: `Consign — ask Kiseka` (amber), then `Kiseka agreed at 125,100` (done).
- Base the cost, the room, the ladder and ManagerItem's "Where the price sits" on the cost of the hold that was chosen.
- Show the consignment cost on ManagerItem.

### B4 · Whole flow — no decision-rights row, migration number, schema or push for the new steps
**Evidence.**
- `docs/decision-rights.md` has no row for **choosing how an item is held** (stock / per order / consign). Stock commits 4.72M of cash, and consignment creates a consignor Accounts settles (`consign.settle`, row 127).
- It has no row for **putting a draft item on sale**. `markup.set` covers markups, not making a product live.
- `products` (0001) has no `status`, so no item can be "born draft". There is nowhere to store a verdict, a "certified" flag, a went-live time or a "sent back" reason.
- `sourcing_leads.status` is `asked | looking | sourced | priced | listed` (0072 l.86). The Funnel's six lanes (Wanted, Hunting, Quoted, Ready, With Manager, Live) do not map onto it.
- The migration table stops at 0156 and reserves no number for Sourcing v3.
- No push is designed for "Send to Manager" or "Send back". CLAUDE.md: "Every handoff that waits on someone sends that person a push."

CLAUDE.md says that a day-to-day job with no role in that file goes to the owner, who decides which role takes it. `test/decision-rights.test.js` will fail when the migration lands without its row.

**Fix.** Put these questions to the owner before sign-off:
1. Who chooses the hold? (Proposal: Sourcing, `product.hold`; Accounts told when it is Consign.)
2. Is going live part of `markup.set` (Manager)?

Then:
- Reserve a migration number.
- Add `products.status ('draft','live')` plus the gate columns (or a `product_passport` table).
- Map the lanes to lead stages.
- Add the pushes `product.to_price` (→ Manager) and `product.sent_back` (→ Sourcing, with the reason).

### B5 · Navigation — the core paths land on the wrong artboard or do nothing
**Evidence** (full trace below):
- **Funnel:** every card is `<a href="Passport.dc.html">`, so the gutter bracket, the tile cutter and the paint roller all open the wire-mesh passport. The card's own action pill ("Hunt it", "Chase 3", "Set the packing") is a `<span>` inside that link and cannot be tapped on its own.
- **Suppliers tab:** it opens Kiseka's scorecard. That screen has `Back → Main.dc.html` and no tab bar, so the user leaves the tab system. No Suppliers list exists.
- **Capture:** "Supplier price" opens `Visit.dc.html` (the Owino visit). "New item seen" opens the *existing* wire-mesh passport. "Photo" opens the wire-mesh camera with no way to pick the item. "Someone asked for an item" opens the Funnel, with no ask form.
- **Visit:** "New" opens `QuickPrice.dc.html`, which is the **rival** price form for Kikuubo / wire mesh. It should be Owino's **supplier** price for the gate valve.
- **Passport:** the Packing tile opens the packing sheet for *self-drilling screws*. The Verdict and Name & aisle tiles link to `Passport.dc.html` itself.
- **ManagerItem:** "Put it on sale at 147,500" has no handler. Back has no handler.

**Fix.** Give every card and tile its own target. Before sign-off, add the missing screens marked ● in the table below. At minimum: Suppliers list, Supplier price entry, New item, Verdict sheet, and the Sent / Live states.

---

## Should-fix

| # | Screen | Finding (evidence) | Proposed fix |
|---|---|---|---|
| S1 | Passport | The state never updates. The ring (`states = 'gddgdt'`), `3/6`, `2 gaps to Ready` and the dock `Send to Manager · 2 gaps` are hard-coded. Picking a hold flips only the Verdict tile. | Derive the ring, the count, the header and the dock from the gate list. With one gap left, the dock reads "Send to Manager · 1 gap". |
| S2 | Passport, Today | Content is hidden under the docks. The Passport's content is 1,488px tall in a 1,440px frame with 16px bottom padding, so the "Waiting for it" askers (Kato, Lubowa, Mukono) are covered. On Today, the coach's lines 2–3 sit under the tab bar. | Give the scroll area bottom padding equal to the dock height plus 16px, and grow the boards. |
| S3 | Funnel | Three oxide actions on one screen: the red `Take the photo` and `Send to Manager` pills plus the red + FAB (ow-design §2: one primary). | Make the card pills navy or soft. Keep red for the FAB only. |
| S4 | Funnel | No **Live** lane, though Today's bar shows `Live 5` and links here. No **Sent back** lane, yet Today's top task "Door hinge 4" brass · Ruth sent it back" is in no lane. Lanes list 2 of 9, 1 of 6 and so on, with no "7 more" (§7 "Named rather than dropped"). | Add "Sent back" (first, amber) and "Live this week" lanes. End each lane with "+7 more in Wanted". |
| S5 | Funnel | The thumbnail shows a **box** icon when the photo is done (`icon: has ? ICON.box : ICON.cam`), not the photo. The six-word legend sits in a row, but the gates are drawn as ring segments, so the order cannot be read. Wire mesh's Photo segment is grey "todo" (`'tddgdt'`) here but an amber "gap" on the Passport (`'gddgdt'`). | Show the real photo thumbnail. Replace the ring with six small labelled pips in legend order, or drop the legend. Use one gate state per item everywhere. |
| S6 | PackingGate | "Packing is right" stays enabled while a quote fails to convert (`1,000 ≠ whole boxes`). The Kiseka row always passes, because it echoes our own carton size (`'carton of ' + fmt(boxes * pcs)`). It opens from the wire-mesh Passport but shows screws. The carton and box drawing does not follow the steppers. | Disable the CTA and name the failing supplier. Check each supplier's *own* pack (`prices.pack_unit`, `pack_qty`). Bind the drawing to the steppers. |
| S7 | Today | `Next moves · 1 of 3` with 2 cards. "Door hinge" has no count where the other rows have one. | Add the third card (for example the Certify top seller) or say "1 of 2". |
| S8 | Prices | Margin-adjacent leak: `For Ruth · Y12 rebar: Nateete sells 1,000 under our price`. Sourcing then knows our shelf price. With the cost on the Today tab (`Y12 rebar 12m · 41,500`), the margin is a subtraction (`margin.see` is Manager only). | Word it from rival and cost only ("Nateete sells Y12 at …, flagged to the Manager"). Compute the "under our price" test server-side and push it to the Manager. |
| S9 | Visit | Progress counts only "Same" taps (`done = Object.keys(same).length`), so it tops out at 3 of 7. Accept, Push back, Quote and the photos never count. "counts in today's share" is true for 2 of the 3 rows (the PPR elbow is not in today's six). The red `End the visit · 0 of 7` is the screen's primary action at zero. | Count every job. Tag only the rows that are in today's share. Make "End the visit" secondary until the jobs are done, or rename it "Done here · 3 left". |
| S10 | Visit, Prices | Accept and Push back have no handlers, and no counter-offer sheet exists. Accepting Owino's +4.8% may push lines under their sale price (0153 `price.waits` → Manager), and the screen does not say so. | Design Push back (a counter figure plus a note to the supplier). After Accept, show "Ruth is told about 2 lines now under their sale price". |
| S11 | All | Colour roles (§2). Score bars use **sky (Money)** as a "middling" state (`v >= 50 ? '#1A5A8A'`). The gap amber is off-palette `#B86E12` (3.98:1 on white) instead of `#95530C`. Rivals are **indigo (Buy)** on Passport and ManagerItem but **plum** on Capture and QuickPrice. "Supplier proposals" (Today) and Capture "Photo" wear sky (Money). | State colours only for state: verdigris, amber `#95530C`, crimson. One identity hue for rivals everywhere (plum). Indigo (Buy) for supplier things. |
| S12 | Passport, Capture | Contrast: the 11–12px state text is set at `opacity: .85` on tints. Grey "Ruth sets it" is **3.56:1**, green "By the sheet" **4.22:1**, Capture's subtitles **4.22–4.34:1**. | Drop the opacity. Use the full ink, which gives 4.75–5.97:1. |
| S13 | Passport, ManagerItem, QuickPrice, Visit | Names outside the cast: "Kikuubo Hardware Mart" and "Nateete Builders' Centre". `docs/canvas-cast.md` has no rivals at all. "For Ruth" uses a person as a radar category. | Ask the owner to add a **Rivals** row to the cast (for example these two), then use only those. Rename the tag "For the Manager". |
| S14 | Capture, Prices, Today, Main | Claims the data cannot back: "sends itself later" (and §7 "Nothing sends itself"); weekly movers `▲ 3.0% this week` and the supplier sparklines (no price history); "Nobody stocks them nearby"; "At a supplier?" (no location). See the feasibility table. | Reword or build the source, as listed in the feasibility table. |

---

## Polish

| # | Screen | Finding | Fix |
|---|---|---|---|
| P1 | Passport, Prices, QuickPrice, PackingGate, ManagerItem | Typed glyphs where §5 asks for drawn icons: `Consign ★`, `▲ ▼`, `−` / `+` steppers, `⌫`, `≠`. | Draw 24-viewBox strokes at 1.8 (a star, up and down chevrons, minus, plus, backspace). |
| P2 | All | Sizes off the type ramp: 15, 17, 18, 22, 24 and 44px. | Map them to 14/16/20/28. The QuickPrice figure can stay at 44px as the one display size. |
| P3 | ManagerItem, Prices, Visit, Today | Money set in Figtree inside prose: `Kikuubo 149,000 · Nateete 152,000`, the radar titles' `1,500`, `700`, `19,500`, `17,500`, `4.7M`. | Wrap every figure in the mono `.m` span. |
| P4 | PhotoGate | `1200 × 1200` on the frame against `Size 3024 px` in the check. "Sharp 312" is a raw Laplacian number nobody can read. Torch is a `span role=img`, not a button. Retake has no handler. | One size. Show sharpness as "Sharp" with the pass mark only. Make the torch a button. |
| P5 | ManagerItem | The lower third is empty. The Our-price dot (147,500) and the Kikuubo dot (149,000) touch. "Waiting · Kato · Lubowa · Mukono Roofing" wraps. | Move the facts up and the Send-back reasons into a sheet. Offset the colliding labels. Shorten to "3 customers". |
| P6 | QuickPrice | "Kikuubo Hardware M…" truncates with no title. About 200px of dead space. The Shop and Item buttons and the unit chips do nothing. "Do they have it?" lives only in `aria-label`. The board title promises "three taps" (shop, item, 6 digits, stock and save is at least 10). | Show the label. Fill the gap with the last 3 readings for this shop. Rename the board "A rival price, fast". |
| P7 | Supplier | The hero's "18 cheapest on" repeats the first scorecard bar. Lines are not tappable. `Call` has no `tel:`. `Compare`, `+ sells` and Edit have no handlers. The sparklines have no scale. | Replace the hero stat with "Owed 0 · 7 days credit". Make lines open the item. Add a last-price dot to each sparkline. |
| P8 | Today | `today 4 of 6` wraps to two lines in the ring tile. | Shorten to "4/6 today". |
| P9 | All | No safe-area insets on the docks or tab bars. `agent.html` uses `--safe-b`. | Pad the bottom bars by `var(--safe-b)`. |
| P10 | Tooling | `.design/shot.mjs` crashes on every artboard. Its size regex is `/width:(\d+)px;height:(\d+)px/` (no spaces), and it queries a `.app` that does not exist. | Accept spaces (`/width:\s*(\d+)px;\s*height:\s*(\d+)px/`), drop the `.app` probe, and optionally fill holes. |
| P11 | canvas.json | ManagerItem shows wire mesh with 5 gates done, "2 h ago", while the Passport shows it at 3/6. That is a later moment than the rest of the canvas. PhotoGate has `Retake` but is not `is_interactive`. | Title the board "…later that day". Mark PhotoGate interactive. |

---

## Designed and missing screens

| Screen | State | Reached from |
|---|---|---|
| Today | ✓ designed | tab |
| Funnel (Open / Certify) | ✓ designed | tab, Today bar, Today "Sort" / "Hunt" |
| Item passport | ✓ designed (one item only) | every Funnel card |
| Photo gate | ✓ designed | Passport, Visit, Capture, Today "Fix" |
| Packing gate | ✓ designed (wrong item) | Passport |
| Manager: new item to price | ✓ designed | Passport Markup tile |
| Capture sheet | ✓ designed | the + |
| Rival price | ✓ designed | Capture, Visit "New" (wrongly) |
| Visit | ✓ designed | Today card, Capture, Supplier |
| Prices (radar / today / proposals) | ✓ designed | tab, Today ring, Today card |
| Supplier scorecard | ✓ designed | Suppliers tab (wrongly), radar |
| ● Suppliers list | missing | Suppliers tab |
| ● Search | missing | Today search |
| ● Profile and settings (prices a day, `set_prices_per_day`) | missing | Today "ML" |
| ● Supplier price entry (price, tiers, packing) | missing | Capture, Visit "New" |
| ● New item (a draft is born) | missing | Capture "New item seen" |
| ● Ask form ("Someone asked") | missing | Capture |
| ● Wanted triage (sort the asks; hunt / mute / teach a name, 0146) | missing | Today "Sort", "Hunt" |
| ● Hunt: who to ask, chase | missing | "Hunt it", "Chase 3" |
| ● Quote sheet | missing | Visit "Quote" |
| ● Suppliers gate sheet | missing | Passport Suppliers tile |
| ● Verdict sheet (why, what-ifs, consign ask) | missing | Passport Verdict tile |
| ● Name & aisle sheet (with item twins, 0152) | missing | Passport tile |
| ● Rival run (several shops in a row) | missing | Capture |
| ● Send to Manager confirmation and the sent state | missing | Passport dock |
| ● Sent back (with the Manager's reason) | missing | Today "Fix" |
| ● Live item and "Tell the askers" | missing | after "Put it on sale" |
| ● Certify a live top seller | missing | Funnel Certify cards |
| ● Push back (counter-offer) | missing | Visit, Prices |
| ● Deal detail (switch / tier) | missing | radar cards |
| ● Supplier merge compare (0145) | missing | Supplier "Compare" |
| ● Outbox (captures waiting) | missing | Today banner |
| ● Item and supplier pickers | missing | QuickPrice Shop / Item, Capture Photo, Visit start |
| ● Empty, error and long-name states | missing | everywhere |

## Navigation trace

| Screen | Control | Goes to | Right? |
|---|---|---|---|
| Today | Search, Profile | nothing | ✗ dead |
| Today | Funnel bar | Funnel | ✓ |
| Today | Prices ring / Certified ring | Prices / Funnel (Open view) | ✓ / ✗ should open Certify |
| Today | Visit card / Deal card | Visit / Prices | ✓ / ~ should open the deal |
| Today | Fix · Sort · Hunt · Open | PhotoGate (wire mesh, not the hinge) · Funnel · Funnel · Prices radar | ✗ · ~ · ✗ · ✗ should open Proposals |
| Today | 2 captures banner | nothing | ✗ |
| Tab bar | Suppliers | Kiseka scorecard | ✗ needs a list |
| Funnel | Open / Certify, lane chips | toggle and filter | ✓ (Manager chip clipped off-screen) |
| Funnel | every card | wire-mesh Passport | ✗ |
| Passport | Back | Funnel | ✓ |
| Passport | Photo / Packing / Suppliers / Verdict / Name / Markup tiles | PhotoGate / screws packing / Kiseka / self / self / ManagerItem | ✓ / ✗ / ~ / ✗ / ✗ / ✗ Sourcing can't open the Manager's screen |
| Passport | hold radios | set state | ~ (the ring does not update) |
| Passport | Send to Manager | disabled | ✓ |
| PhotoGate | Retake / Use this photo / Torch | nothing / Passport / nothing | ✗ / ✓ / ✗ |
| PackingGate | steppers / Packing is right | work / Passport | ✓ / ~ (passes a failing quote) |
| ManagerItem | Back / Send back / Put it on sale | nothing / toggles chips (chips dead) / nothing | ✗ / ~ / ✗ |
| Capture | Start a visit / Supplier price / Rival price / New item / Photo / Ask | Visit / Visit / QuickPrice / Passport / PhotoGate / Funnel | ~ / ✗ / ✓ / ✗ / ~ / ✗ |
| QuickPrice | Shop, Item, unit chips / keypad / Save | nothing / works / Passport | ✗ / ✓ / ~ should return to where it came from |
| Visit | Same / New / Quote / Accept, Push back / photos / End | works / Rival form / Passport / nothing / PhotoGate / Today | ✓ / ✗ / ✗ / ✗ / ~ / ✓ |
| Prices | tabs | work | ✓ |
| Prices | Switch / Tier / For Ruth / One supplier / Wanted | Kiseka / Kiseka (it is Namanve's) / self / Funnel / Funnel | ~ / ✗ / ✗ / ~ / ~ |
| Supplier | Back / Edit / Compare / Call / Start a visit | Today / nothing / nothing / nothing / Owino visit | ✗ / ✗ / ✗ / ✗ / ✗ (it is Kiseka) |

## Figures that agree (checked)

- Lane counts: Today 9 / 6 / 4 / 3 / 2 / 5 and Funnel `All 24` = 9+6+4+3+2 ✓.
- Today's share 4 of 6 on Today, Prices and the Prices list (4 done + Owino's 2) ✓. Cast: 6 a day ✓.
- Prices fresh 78% = 312/400; ring 281° ✓. Certified 41/100 at 148° ✓; Certify lane 59 = 100 − 41 ✓.
- Visit's 7 jobs = 3 + 1 + 1 + 2 on Today and Visit ✓.
- Radar 392,000 = 210,000 (1,500 × 140) + 182,000 (700 × 260) ✓; the For-Ruth 180,000 is rightly left out.
- Mesh 118,000 × 1.25 = 147,500 ✓; 40 × 147,500 = 5,900,000 ✓; cash 118,000 × 40 = 4,720,000 ✓; room 149,000 − 118,000 = 31,000 ✓ (but see B3).
- 40 sheets = 20 + 12 + 8 from three customers ✓. QuickPrice 147,000 → 149,000 = ▲ 2,000 ✓.
- Proposals +4.8% (42→44k) and −1.6% (96→94.5k) ✓. Kiseka 14 orders on Passport and Supplier ✓. Lead time 3 days ✓.

## Wording

| Thing | Variants found | Use |
|---|---|---|
| The Manager stage | "Manager" (bar, chip), "With Manager" (lane), "For Ruth" (radar), "Ruth sets it" | "With the Manager" for the lane; "Manager" in the 6-wide bar only |
| Quote | "Quoted" lane, "Quote" button (Visit, a noun or a verb?), "quoted 2 days ago" | Button "Get their price" |
| Certify | "Certify" toggle, "Certified" ring; the toggle's other half "Open" reads as a verb | Toggle "New items · Top sellers"; ring "Certified" |
| Hunt | "Hunt" (Today), "Hunt it" (Funnel), "Hunting" lane, "starts a hunt", "joins its hunt" | "Hunt it" everywhere |
| Same / New | bare words on Visit | "Same price" / "New price" |
| Push back / Accept | Visit and Prices; "pushed" on the paint-roller card means something else | Keep Push back / Accept; change "pushed" to "sent 3 h ago" |
| Fix / Sort / Open | Today pills | "Retake photo" / "Sort 3 asks" / "Review 2" |
| Hold | "Stock · Per order · Consign" (Passport), "Hold it differently" (Manager), console "Stock it · Order per client · Consignment" | Pick one set for all three apps |
| Today | the tab "Today" and the Prices chip "Today 4/6" | Chip "Today's share" |
| Score parts | "Room", "Cash back" against the console's "Margin", "Cash payback" | Document the Sourcing names (B2) |
| Gate name | legend "Name" against tile "Name & aisle" | "Name & aisle" |
| Voice | "The engine recommends" / "Coach" / "Talking points" | One voice, "Coach", for all advice |

## Feasibility — what is real and what is a wish

| Claim | Source today | Verdict | What makes it real, or honest wording |
|---|---|---|---|
| Fill rate "47 of 50 lines" | `supplier_answers` (0132): state and `changes[{lineId, have}]` per order | Partly: only orders answered in the supplier app; the Buyer's phone confirmations are not in it | Count both sources; print the window ("since 1 Sep") |
| "Average of our suppliers" | same metric over all suppliers | Real, if each supplier has enough orders | Hide the tick under 5 orders |
| Median lead time "3 days" | `supplierLeadTimes()` in index.html (receipts against order dates) | Real, but it lives in the console | Port it, or serve it from an RPC |
| "Cheapest on 18 of 31" | latest `prices` row per product and supplier | Real | Denominator = lines with at least 2 suppliers |
| "14 orders with us" | `savedQuotes` items by `supplierId` | Real | Say "orders", not "purchases" |
| Weekly movers, sparklines | `prices` is updated in place; only `priceObservations()` (purchase invoices) and `rival_prices` (every reading) keep history | **Wish** for supplier quotes | Add an append-only `price_history` written by a trigger on `prices`; until then, label it "from what we paid" |
| "Searched 7 times by 4 people" | `search_misses` (`by_user`, `agent_id`, `client_name`) | Mostly real; web searches are anonymous | "7 searches · 4 named people" |
| "Nobody stocks them nearby" | nothing | **Wish** | "None of our suppliers lists it" |
| Photo check: sharp, light, size | canvas pixel maths on the phone | Real | — |
| Photo check: busy background | edge density outside the centre | Unreliable (wire mesh *is* a grid) | Keep it advisory only, as drawn |
| "At a supplier?" | no location used anywhere | **Wish** | "Start a visit" plus a supplier picker sorted by today's jobs |
| Offline captures "send themselves later" | `sourcing.html` has no offline queue (only the server's `push_outbox`) | **Wish**, and the wording clashes with §7 | Build an IndexedDB outbox with retry and conflict rules; word it "Saved on this phone. It goes up when you have signal." |
| Talking points citing a rival price | `rival_prices` | Real | Cite the date ("Kikuubo 19,500, seen 3 days ago"); show how the target figure was chosen |
| "Every bill paid on time · 9 of 9" | supplier bills (Accounts') | Needs read access and a definition of "on time" | Ask the owner; it is Accounts' data |
| "Prices fresh 78%", "own stale window" | `learnedStaleDays()` (null without enough purchase history) | Real with a fallback | "312 of 400 fresh (window learned for N, default for the rest)" |
| "5 went live this week", Certified 41 | no `status` or went-live time | **Wish** until B4 | Add the passport columns |

## Premium score per screen

| Screen | /5 | Why |
|---|---|---|
| Passport | 4 | The best screen: gate grid, cost ladder with the room band, gauge. It loses the askers under the dock, the state is static, the dock label wraps, and it uses a typed ★. |
| Today | 4 | Funnel bar and two rings read at a glance; strong hero. It loses the coach under the tab bar, "1 of 3", and the coach is still three sentences. |
| Visit | 4 | One list per stop is the right idea; age bars on prices are good. Progress is broken and the red End is shown at 0. |
| Supplier | 4 | The scorecard with its average tick is excellent. Most buttons are dead and the hero repeats a stat. |
| PhotoGate | 4 | Clear pass/fail tiles with pass marks. Raw numbers and conflicting sizes. |
| Funnel | 3 | The gate rings are a good idea, but the legend cannot map to them, there are three red actions, the chips are clipped and the thumbnails mean nothing. |
| Prices | 3 | Strong ring. The radar bars at 4% for unpriced rows say nothing, plus the tab-name clash and the margin-adjacent card. |
| ManagerItem | 3 | The price line is good. Half the board is empty, two dots collide, and the cost is wrong under consign. |
| PackingGate | 3 | The nested-box idea is good, but the drawing is static and the check is tautological. |
| QuickPrice | 3 | Big figure and keypad are right. Dead space and dead pickers. |
| Capture | 3 | A tidy grid, but four pastels that answer no question and four of six wrong targets. |

**Against `agent.html`.** The tokens match `agent.html` exactly (l.236–307), which is good. `agent.html` also uses things these mockups lack:
- safe-area padding on its bars (`--safe-b`);
- `--shadow-up` on its docks;
- `--ow-ink-400 #6B7480` (the mockups use `#767F91`, which is 4.03:1 on white);
- designed empty states.
