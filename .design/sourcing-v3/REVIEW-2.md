# Sourcing mockups — design review, second pass

Independent second pass on the "Sourcing Engine" canvas after rounds 2 and 3, 22 Oct 2026.
Report only: no artboard or app file was changed.

**Source reviewed.** The live canvas (version `1792696752-f25d`, 35 boards). It is
byte-identical to `.design/sourcing-v3/` at `7369250` on `claude/sweet-mayer-sqtl88`.

**How it was read.** Every board was rendered with its holes filled and looked at. Every
`href` and button was traced by script. Every shared figure was compared across boards and
checked against `sourcing-console.js`, `index.html`, `supabase/migrations/` and
`docs/decision-rights.md`.

## Verdict: not ready to sign off, but close

Round 2 and round 3 are a large step up.
- 23 of the 30 first-pass findings are fixed (one of them deferred to the build), 6 are partly fixed, and 1 is waiting on the owner.
- The flagship figures agree on every board.
- The average premium score rose from 3.5 to 3.9.

Two things still block sign-off:

1. **The screens give Sourcing three powers no role holds yet** (B1). These need the owner's decision.
2. **The wire mesh's first batch ignores Kiseka's own 20+ price** (B2). With that price the verdict moves from 68 to 70, which crosses into the "Stock it" band.

Everything else (12 should-fix, 10 polish) is one more round of small edits.

**Counts this pass:** 2 blockers · 12 should-fix · 10 polish.

---

## 1. The 30 findings from the first pass

| # | First-pass finding | Now | Evidence |
|---|---|---|---|
| B1 | Verdict didn't follow the console | **Fixed** (see new B2) | 68 · Stock · confidence 67 · ≈16 d on Passport, Verdict, ManagerItem ("Hold · Stock"), Live ("first batch 40"). Weighted 43·30 + 88·30 + 54·10 + 85·15 + 73·15 = 68.4 ✓; confidence 67 ✓; `holdRec`: 16 < 21 days → not consign, 3-day lead → not per order → Stock ✓ |
| B2 | Score built on the markup | **Fixed** | README formula is cost / rivals / demand only; Verdict: "Built only on cost, rivals and demand. Our markup is the Manager's and is never in it." |
| B3 | Consign changes the cost | **Fixed** | Passport `cost = hold === 'Consign' ? 125100 : 118000`, ladder and room switch (23,900, "Fair"); Verdict shows the three holds side by side; Consign waits on "They agreed" |
| B4 | Rights, schema, pushes | **Partly** | The pushes are drawn (Send to Ruth, Sent back, Live "Pushed"). `docs/decision-rights.md` has no new row and no reserved number; `products` still has no `status`. See new B1 |
| B5 | Wrong or dead navigation | **Partly** | The Suppliers tab, Capture, Visit and the Passport tiles are right now. Still wrong: Capture → Photo → Search → **QuickPrice** (the rival form); "Review 2" (Today) and "Review" (Kiseka) land on the radar tab, not Proposals; Hunt "Ask on a visit" opens Owino, which is not one of the suppliers ticked. See S1 |
| S1 | Static passport | **Fixed** | Ring, `3/6`, gap line and dock all derive from `gates` and `hold` |
| S2 | Content under docks | **Partly** | Today's coach line 3 is under the tab bar (content 1,319 px in a 1,260 frame); the Funnel's "Live this week" lane falls off the board (1,484 in 1,300) |
| S3 | Three reds on Funnel | **Fixed** | Card actions are navy; red is the + only |
| S4 | Lanes | **Fixed** | "Sent back" and "Live this week" lanes, "+ 7 more in Wanted". Nit: Funnel "All 25" while Today's bar sums to 24 (no Sent back) |
| S5 | Legend vs ring | **Fixed** | Six pips under each card in legend order; striped thumbnail when a photo exists |
| S6 | Packing check | **Fixed** (new nit S9) | CTA blocked with "Doesn't fit … pack"; drawing follows the steppers |
| S7 | Next moves 1 of 3 | **Fixed** | "3 today · swipe" with three cards |
| S8 | Y12 margin leak | **Fixed** | "Nateete sells at 45,000 (seen 12 Oct) · 3,500 room · thin · The Manager is told" |
| S9 | Visit progress | **Fixed** | All 7 jobs count; "today's share" on the two rows; "Done here · 7 left" |
| S10 | Accept / Push back | **Partly** | Push back has its own sheet, but its only action is dead and two labels collide (S4, S5) |
| S11 | Colour roles | **Fixed** | Amber `#95530C`; rivals plum, suppliers indigo everywhere. Nit: the Wanted "Agent" tag is indigo (Buy) |
| S12 | Faded text | **Fixed** | No text opacity left; `#6B7480` for captions |
| S13 | Invented rival names | **Not fixed** (owner) | Kikuubo and Nateete are still outside `docs/canvas-cast.md`; "For Ruth" is gone |
| S14 | Wishes stated as fact | **Fixed**, three new ones | Movers, sparklines, "none of our suppliers lists it", the visit list and the outbox wording are honest now. New wishes: see section 5 |
| P1 | Typed glyphs | **Fixed** | Drawn minus, plus, backspace and arrows; ★ is gone |
| P2 | Type ramp | **Partly** | 130 uses of 15px and one 18px remain; ow-design §3's ramp is 11/12/13/14/16/20/28 (the README added 15 to it) |
| P3 | Money in prose | **Partly** | Mono in most prose; radar titles still set `1,500`, `700` and `45,000` in Figtree |
| P4 | Photo check | **Fixed** | One size line, pass marks, working torch and Retake |
| P5 | Manager board | **Fixed** | Labels clear, shorter facts |
| P6 | Rival price | **Fixed** | Full shop name, pickers, units, "Do they have it?", last three readings |
| P7 | Supplier | **Fixed** | Call is a `tel:` link, Compare opens Twins, terms editable, sparkline end dots |
| P8 | "today 4 of 6" wrap | **Fixed** | "4/6 today" |
| P9 | Safe areas | **Deferred** | README: the build pads every bar by `--safe-b`. Fine for mockups |
| P10 | `shot.mjs` | **Fixed** | Accepts spaces in the size and no longer needs `.app` |
| P11 | ManagerItem moment | **Fixed** | Titled "later that day"; PhotoGate interactive |

**Tally:** 23 fixed (P9 deferred, counted here), 6 partly fixed (B4, B5, S2, S10, P2, P3), and 1 not fixed but waiting on the owner (S13).

---

## 2. Blockers

### B1 · Three powers the screens give Sourcing that no role holds
`docs/decision-rights.md` is binding. CLAUDE.md says a day-to-day job with no role in that file goes to the owner, who decides which role takes it. The canvas draws three such jobs as Sourcing's:

1. **Choosing how an item is held, and the size of the first batch.**
   - Where: ManagerItem `Hold · Stock · Sourcing's call · 40 first`; Live pushes Denis Okello "held as Stock, first batch 40"; Certify chooses Stock for the live iron sheet.
   - The conflict: `buy.restock` ("Buy to refill the shelf … what to buy") is the **Buyer's**, and Stock commits 4,720,000 of cash.
2. **Pinning an item to the agents' feed.**
   - Where: Live, "Pin it on the agents' feed · for 14 days".
   - The conflict: `agent_feed_pins` (0102) is admin-only today, and its own comment calls a pin "the owner's own word". There is no row for it.
3. **Certifying a live top seller.**
   - Where: Certify, "certifying waits on nobody".
   - The conflict: changing a live product's details is `product.edit` (Sourcing). But its hold changes restock policy, which is the first item again.

**Fix.** Ask the owner one question per item. A proposal:
- (1) Sourcing *recommends* the hold and the batch, and the Buyer decides under `buy.restock`. Reword Live to "Recommended: Stock, about 40 to start" and ManagerItem to "Hold · Stock (Sourcing's advice)".
- (2) Pinning goes to the Manager, and Sourcing "asks the Manager to pin".
- (3) Certify is fine under `product.edit` once (1) is settled.

Then add the rows, reserve the migration number and add the push kinds (still open from the first pass).

### B2 · The wire mesh's first batch is costed at 118,000 though Kiseka sells 20+ at 115,500
**Evidence.** SuppliersGate: `Kiseka Steel · 118,000 · Steps 20+ 115,500`. The first batch is 40 sheets. The console prices a batch at the tier that batch reaches (`quote(batch)`, `sourcing-console.js` l.1355–1366). Every other board uses 118,000.

Recomputed:
- cost **115,500**; cash **4,620,000**;
- room **33,500** (29% → Room **97**);
- score 43·.3 + 97·.3 + 5.4 + 12.75 + 10.95 = **71.1** → band **"Stock it"** (not "a small first batch").

The consigned cost would be 122,450 (+6%), leaving room of 26,550. The flagship verdict's band changes, so this is the same class of error as the first pass's B1.

**Fix.** Choose one story:
- Drop the 20+ step from SuppliersGate.
- Or re-cost the batch at 115,500 everywhere: Passport, Verdict, ManagerItem (`COST`), Live and the coach. Then the verdict reads 71 · "Stock it".

---

## 3. Should-fix

| # | Board | Finding (evidence) | Fix |
|---|---|---|---|
| S1 | Capture → Search | "Photo · pick the item, then shoot" opens Search, and every Search item goes to `QuickPrice.dc.html` (the rival price form; the chip reads "Picking an item for a rival price") | Give the photo path its own Search state, or link Capture's Photo tile to a picker that ends on PhotoGate |
| S2 | Today, Funnel | Content falls off the frame: Today's coach line 3 is under the tab bar (1,319 / 1,260 px); the Funnel's "Live this week" lane is past the bottom (1,484 / 1,300) | Grow the boards to 1,330 and 1,500, or trim |
| S3 | Today | Coach line 1: "Wire mesh … One photo and it is ready for the Manager". The Passport shows **two** gaps (Photo and Verdict: "Choose a hold") | "A photo and a hold, and it is ready for the Manager" |
| S4 | PushBack | The "Was" and "Yours" figures collide: `42,00042,500` | Hang "Was" left of its dot and "Yours" right of it, as ManagerItem does |
| S5 | PushBack and 6 more | Dead buttons: "Send 42,500 to Owino", Hunt "Ask 2 on WhatsApp", Verdict "Ask on WhatsApp", Deal "Ask Katwe to confirm", NewSupplier "Snap their card" and "From contacts", ErrorState "Try again", Profile "Sign out anyway" | Give each a state change ("Sent · waiting for Owino") or a link; at minimum the PushBack and Hunt primaries |
| S6 | Today, Kiseka | "Review 2" (Today) and "Review" (SupplierKiseka) open Prices on the **radar** tab; the proposals are one tab away | A Proposals board, or Prices opening on Proposals |
| S7 | Deal, Supplier, SupplierKiseka | Averages disagree with the list they average. Deal: "our average is 85%" for fill, but the scorecard tick is 89 and the six suppliers' fills average 90. Scorecard "Cheapest on" average tick 64; the list's six values average 70 | Use one computed average everywhere (fill 90, cheapest 70), or say what it averages ("of the 4 we buy most from") |
| S8 | Funnel → PackingGate | The screws board lists **two** suppliers' packs, while the Funnel card says "1 price · Faith Nambi asked". Kiseka Steel (tags: Rebar · Mesh · Wire) sells screws | Make the second row "Katwe Fabricators · price not yet in", or change the card to "2 prices"; give the screws to suppliers that list fasteners |
| S9 | Visit, RivalRun | Item names cut to a few letters when a tag sits beside them: "Gate …", "Ball v…", "Iron she…", "Y12 reb…", "Gate valv…" | Put the tag on the second line with the age, so the name gets the full width (ow-design §5: cut the name last) |
| S10 | ManagerItem → SentBack | The Manager sends back the **wire mesh** and lands on the **door hinge's** Sent back. Certify's "Take the photo" opens the wire-mesh camera. The same happens on SentBack → PhotoGate | Title the shared boards as templates ("Sent back — example: door hinge"), or put the item name in a prop |
| S11 | Deal | "With Denis Okello, the Buyer. **He** decides which supplier to buy from." Nobody's pronouns are given in the cast | "Denis Okello, the Buyer, decides which supplier to buy from." |
| S12 | Passport | The Packing tile has no link once done (`href: ''`), so a done gate cannot be reopened; the only Packing board is for screws | Link it to a wire-mesh packing view, or make PackingGate a template as in S10 |

## 4. Polish

| # | Board | Finding | Fix |
|---|---|---|---|
| P1 | All | 15px used 130 times and 18px once, off the §3 ramp | Map to 14/16, or record 15 in ow-design §3 if the owner wants it |
| P2 | Prices | Radar titles set money in Figtree ("1,500 cheaper", "700 less", "45,000") | Wrap the figures in `.m` |
| P3 | Passport | "Send to the Manager · 2 gaps" still wraps to two lines | "Send · 2 gaps" |
| P4 | Today / Funnel | Funnel "All 25" against Today's bar total 24 (Sent back is not on the bar) | Add a "Back 1" mark on the bar, or count Sent back inside Ready |
| P5 | Verdict | "≈16 days" assumes none of the 40 sheets is committed; if the three customers count as sure, the console gives about 7 days and Cash back 100 | Say "if none of the 40 is paid for yet", or show the sure count |
| P6 | Wanted | The agent's ask is tagged indigo, the Buy colour; agents are on the Sell side | Use the Sell tint (oxide-soft) |
| P7 | Suppliers | The three metric bars differ only by opacity of one hue | Give them three lengths of track with labels inline, or one bar plus two figures |
| P8 | SendToManager, SentBack, NewItem, Profile | The lower half of each board is empty | Shorten to 844, or use the room (SentBack: show Ruth's other open items) |
| P9 | ManagerItem | Top bar reads "Manager app · from Decide", which is unclear | "Manager app · from a push" |
| P10 | RivalRun | The "a hunt" tag sits on wire mesh, which is Quoted, not hunting | "being priced" |

## 5. Claims the data can't back (new this round)

| Claim | Board | Source today | Verdict | Fix |
|---|---|---|---|---|
| "12 d since a visit", "2 d since a visit", Plan a visit | Supplier, SupplierKiseka | No visit is recorded anywhere (`supplier_*`, `prices` have no visit row) | **Wish** | Add a `supplier_visits` table in the Sourcing migration, or say "since a price was taken there" (from `prices.date`) |
| "delivers Tue, Fri" (editable days) | Visit, Supplier | `suppliers` has `terms_days` (0106) but no delivery days | **Wish** | A `delivery_days` column, or drop it |
| "What they sell" tags (Plumbing · PVC · Taps) and "0 suppliers list it" | Suppliers, Hunt, NewSupplier | No tag column on `suppliers`; derivable only from the items each supplier prices | Partly | Derive tags from `prices` × `products.category`, or add a column |
| Counter-offer sent to Owino | PushBack | `supplier_proposals` has `status` and `decided_note`, no counter price | **Wish** | A `counter` field in `payload` and the supplier app showing it |
| "We pay on time" | PushBack | Supplier bills are Accounts' books | Needs read access | Ask the owner whether Sourcing may read bill timeliness |
| Pin to the agents' feed | Live | `agent_feed_pins` is admin-only (0102) | Right missing | See B1 |
| "Do they have it? Yes / A few / No" | QuickPrice | `rival_prices.in_stock` (0104) | Real ✓ | — |
| Sheets sold a week, last 13 weeks | Certify | invoices | Real ✓ | — |
| What we paid, last 6 buys (sparklines, movers) | Supplier, Prices | `priceObservations()` from purchase invoices | Real ✓ | — |

## 6. Figures that agree on every board (checked)

| Figure | Boards | Result |
|---|---|---|
| Verdict 68 · Stock · confidence 67 · ≈16 d | Passport, Verdict, ManagerItem, Live | ✓ (see B2) |
| Consign 125,100 · room 23,900 | Passport, Verdict | ✓ |
| Radar 392,000 = 210,000 + 182,000 | Prices | ✓ |
| Hoop iron 1,500 × 140 = 210,000; 23,500 against 22,000 | Prices, Deal, SupplierKiseka, Today | ✓ |
| Kiseka: 14 orders, 3 days, fill 47/50 = 94% | SupplierKiseka, Deal, Suppliers, SuppliersGate, Verdict | ✓ |
| Owino: 22 orders, 24 lines, fill 41/44 = 93%, cheapest 15/19 = 79% | Supplier, Visit, PushBack, Twins, Suppliers | ✓ |
| Today's share 4 of 6 | Today, Prices | ✓ |
| Iron sheet: 260 a month, 34,200 cost, room 35,500 − 34,200 = 1,300 (thin) | Certify, Prices, RivalRun | ✓ |
| Rival readings: gate valve 19,500 (14 Oct), Y12 47,500 Kikuubo / 45,000 Nateete, iron sheet 36,000 / 35,500 | QuickPrice, RivalRun, Prices, Visit, Certify | ✓ |
| Visit 7 jobs = 3 + 1 + 1 + 2 | Today, Visit | ✓ |
| Wanted 3 asks | Today, Wanted | ✓ |
| Fill average | Deal 85, scorecard tick 89, list mean 90 | ✗ (S7) |
| Cheapest-on average | scorecard tick 64, list mean 70 | ✗ (S7) |
| Funnel total | Funnel 25, Today bar 24 | ✗ (P4) |

## 7. Decision rights by screen

| Screen | Action | Row | Verdict |
|---|---|---|---|
| Deal | "Pass to the Buyer" | `buy.restock`, `line.switch` are the Buyer's | ✓ Right: Sourcing recommends, the Buyer switches. Fix the pronoun (S11) |
| ManagerItem | Markup stepper, "Put it on sale", "Send back" | `markup.set`, `price.approve` (Manager); price never below cost (stepper floor 0%) | ✓ |
| Prices / Visit | Accept a supplier's proposal | `price.list` (Sourcing); 0153 pushes the Manager when a line goes under its sale | ✓ "The Manager is told about any order it touches" |
| PushBack | Counter a supplier's price | Sourcing "negotiates" (row 4) | ✓ (needs schema, section 5) |
| Twins | Merge two supplier records | `supplier.edit` with `merge_suppliers` (0145) | ✓ |
| Wanted | Teach a name, set words aside | `product.edit`, `sourcing.lead` (0146) | ✓ |
| NameAisle | Same item / different | `product.edit` with `item_twins` (0152) | ✓ |
| Profile | Prices to confirm a day | `price.confirm` with `set_prices_per_day` (0145) | ✓ |
| Supplier | Edit credit days, delivery days | `supplier.edit` | ✓ (delivery days need a column) |
| Verdict / Live / ManagerItem | Choose the hold and the first batch | **none**; `buy.restock` is the Buyer's | ✗ B1 |
| Live | Pin to the agents' feed | **none**; admin-only today | ✗ B1 |
| Certify | Certify a live item, choose its hold | `product.edit`, plus the hold question | ~ B1 |

## 8. Still missing or dead, and whether it blocks

| Item | Blocks sign-off? |
|---|---|
| Decision-rights rows, migration number, `products.status`, push kinds | **Yes**, for the rights (B1). The schema and migration are build work |
| Real rival names in `docs/canvas-cast.md` | No. It is an owner's naming task; it does not change any screen's design |
| Scorecards for Namanve, Nakawa, Katwe, Ndeeba (rows not links) | No: Owino and Kiseka show the pattern |
| Passports for Funnel items other than the mesh and the iron sheet | No: template boards; title them so (S10) |
| Radar "Next step" (Namanve's 100+) opens the Suppliers list, not a deal | No, but should link Deal once Deal has a tier variant |
| Proposals as its own destination | No, should-fix (S6) |
| The seven dead buttons (S5) | No, but PushBack's and Hunt's primaries should work before sign-off |
| A wire-mesh packing view (S12) | No |

## 9. Premium score per board

| Board | /5 | Why |
|---|---|---|
| Verdict | 5 | Weighted parts with their basis, three holds side by side, an honest "track record" note. The best board on the canvas |
| Deal | 5 | Side-by-side table, a real six-month line, and "the catch" in amber. Reads in seconds |
| Passport | 4 | Gates, ladder and gauge now live. Dock label still wraps |
| Today | 4 | Strong hero; three next moves. Coach clipped by the tab bar |
| Funnel | 4 | Pips under each card read well. The last lane falls off the board |
| Wanted | 4 | Clear triage cards with a result line each |
| Hunt | 4 | Who to ask, the drafted message, honest "you send each one yourself" |
| PhotoGate | 4 | Pass marks without raw numbers |
| PackingGate | 4 | The drawing follows the steppers; the supplier rows explain the block |
| ManagerItem | 4 | Price line and stepper are clear |
| Live | 4 | Who was told and who asked, at a glance |
| Capture | 4 | Visit first, then four kinds; identity colours only |
| SupplierPrice | 4 | Steps drawn as bars; honest offline line |
| QuickPrice | 4 | Big figure, keypad, last three readings |
| Visit | 4 | Seven jobs with progress; names truncate badly (S9) |
| Outbox | 4 | Says what happens on a conflict |
| Prices | 4 | Ring, movers and radar; money in prose still in Figtree |
| Suppliers | 4 | Sort by jobs; three bars differ only by opacity |
| Supplier (Owino) | 4 | Scorecard with averages, editable terms |
| SupplierKiseka | 4 | As Owino; proposal banner |
| Twins | 4 | The comparison table makes the merge obvious |
| NameAisle | 4 | Search words as chips; the look-alike check is in place |
| SuppliersGate | 4 | Two-of-three slots; steps, pack and lead per supplier |
| NewSupplier | 4 | Look-alike by phone blocks the save |
| Certify | 4 | Sales bars and thin room tell the story; long empty tail |
| EmptyToday | 4 | Three numbered steps and a navy + (red is the CTA) |
| ErrorState | 4 | Names the failure, its time and what still works |
| LongNames | 4 | Truncation and big figures hold up |
| SendToManager | 3 | A clear checklist, then half a board of empty space |
| SentBack | 3 | Ruth's note and the failing check are good; sparse |
| NewItem | 3 | A good form; the lower half is empty |
| Search | 3 | Plain list; it only knows the rival-price path (S1) |
| PushBack | 3 | The idea is right; colliding labels and a dead send |
| RivalRun | 3 | Good structure; names cut to a few letters |
| Profile | 3 | Correct but bare |

**Average 3.9** (first pass: 3.5 across 11 boards).
