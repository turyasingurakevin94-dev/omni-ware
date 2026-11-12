# Buyer · Round 1: Core workflows (full click-through)   (brief received 12 Nov 2026, build buyer.html LM Wed 11 Nov 2026 18:35 GMT, inline script 247,872 chars)

The build Cowork tested is the new Buyer app (`buyer.html` built from `src/apps/buyer`, switched 11 Nov). Its
inline script is the 247,872 characters on `main` at 8c86609e. **First step of Phase B: rebuild `buyer.html`**:
the cross-app round 1 commit changed `src/core/buyer` and its page is not exactly what `src/` builds
(`node tools/build-app.js buyer --check` fails), so some of its fixes may not be live.

Kept working (Cowork, do not regress): Checking filter chips; item and supplier search; Back closes the trip; the
trip's maths; Ask, New price and buyer_confirm_price writes; "Still X" one-tap confirm; trip stops locked after
the cash ask; letters stripped from the price field; no sideways scroll at 360 px.

Severity: Critical = P1, High = P1, Medium = P2, Low = P3.

## Design changes (canvas)

Boards on the canvas "Buyer — Agent language", in the row "Round 1" (each before → after, 360 px; the Buyer is a phone app).

| ID | Board(s) | Before → After | States drawn | Tokens/components used | New component? |
|---|---|---|---|---|---|
| BUY-02 · BUY-08 · BUY-13 | `Buyer · Order · Cost and price` | Before: the order and its row show one figure, the cost added up, read as the order (40,900 → 40,450 after a new price); "sells 0"; an old cost struck through. After: the row and the order head show **Client pays 40,900** (the order, never changed by the Buyer) and **Cost 40,450** beside it in grey; while a line is Price coming, Client pays adds "+ 1 price coming" so it never reads as a loss; a line with no selling price reads **Price coming · Warren prices it** (glossary), never "sells 0", and never goes to "Warren decides" for its cost; an old cost reads "was 400" in grey, no line through; the Not found sheet's foot shows what Sales will see **only after a choice is picked**. | default, pressed, sending, success, error, offline, empty | order row, Hero, line row, Money, chip | No |
| BUY-03 | `Buyer · Today · Counts` | Before: "3 orders" vs Checking 4; Needs you 3 (lines) vs chip 2 (orders); + "4 stops" vs 2; "said yes 3 of 3" vs 4 Found; "Found · 0/0". After: every number carries its unit word and has one definition (table below): tiles count **suppliers**, Checking counts **orders**, the + counts **stops** on the plan (held lines are not stops), a supplier's record is **said yes N of M asks · 30 days** and hides at 0 of 0. | default, empty, offline | tiles, section head, TabBar +, Suppliers row | No |
| BUY-04 · BUY-05 | `Buyer · Order · Who sees what` | Before: Replies chip "Buying", the order "Sales sees: Found"; "Sales sees" and "Daphine sees" both used; #0604 under On hold with a "Warren decides" banner and its line "Daphine sees: Needs a supplier". After: one label, **{Seller} sees: {word}** with the seller's display name, the word from the one rule (`core/lineword.ts`); an order on hold (Cancel asked) reads **On hold · Cancel asked · Warren decides** in its banner, sits under the **On hold** filter (counted there and in "Warren decides"), and its lines read **{Seller} sees: On hold**. | default, on hold, empty filter | banner (Notice), chip, sees line | No |
| BUY-06 · BUY-07 | `Buyer · New price` | Before: ~3 s blank wait, field not focused, head flips to Found before Save; 15 accepted for 145,000. After: the field shows at once, focused, with the keyboard up; the head keeps **Asked** until the save is confirmed (Sending… → Found / Price up); a price more than 50% from the list shows an amber line **"Far from the list (145,000) · check it"** and the button becomes **Save anyway** (one more tap, nothing blocked). | default, typing, warn (far from list), sending, success, error, offline | price field, Button, Notice (amber) | No |
| BUY-14 | `Buyer · You · Loading · Cash ask` | Before: the TU avatar does nothing; ~3 s blank on load; a sent cash ask cannot be taken back. After: the avatar opens **You**: name, role, shop, "Pushes on this phone: On", **Sign out**; the app opens on the navy head with **Opening…** and the last copy's figures dimmed, never blank; a cash ask Esther has not given yet has **Take back the ask** (a slide; Esther's ask goes, she is told), then the plan is open again to correct and ask again. | default, pressed, sending, success, error, offline; loading; cash ask waiting / taken back | sheet, Avatar, Slide, Hero | No |
| BUY-11 · BUY-12 | `Buyer · Words and times` | Before → after strip: "Found · 15:41" (yesterday) → "Found · Yesterday 15:41" / "Found · Tue 10 Nov"; Replies "No" → **Not found**; "Nothing not found" → **No Not found lines**, "Nothing Warren decides" → **Nothing waits on Warren**; "Back to Checking" from Replies → **Back to Replies** (the screen it came from); Held chip "Expansion Bolts — · Asked" → **Expansion Bolts · #0606 · Asked**; "75,000 UGX /" → **75,000 UGX / pcs**, "Karddia · per" → **Karddia · per pcs** (the line's unit, else "each"); the trip stepper's long names on two lines, never cut. | default | chips, rows | No |

The one definition per number (BUY-03), shown on the board and kept in `src/core/buyer/rules.ts`:

| Number | Counts | Where |
|---|---|---|
| To ask | **suppliers** with a line to ask (Kevin's decision 2) | Today tile, Needs you head, Orders "To ask" chip says "N suppliers" |
| Asked · Found | **suppliers** in that state | Today tiles |
| Checking | **orders** still being checked | Orders head and chips, Today "On the move · N orders" |
| Needs you | **rows** = suppliers to ask + lines with no supplier + Not found lines, each row one thing | Today |
| The red + | **stops** on the plan (a held line is not a stop) | TabBar, Plan head |
| A supplier's record | **asks** over the last 30 days: said yes N of M | Suppliers, one supplier (hidden at 0 of 0) |

## Code changes planned

| ID | Sev | File / function | Change (one line) | UI? | Acceptance check |
|---|---|---|---|---|---|
| — | P1 | `buyer.html` (build) | Rebuild from `src/` first (`npm run build:buyer`), commit, so the cross-app fixes are live | no | `node tools/build-app.js buyer --check` passes |
| BUY-01 | P1 | `src/apps/buyer/shell/nav.ts` (the sheet effect, `nav.back`, popstate) | One history entry for "a sheet is open": switching sheets **replaces** it (`replaceState`), never back+push; closing pops it only if it is on top; `back()` never goes below the app's own root entry; a guard entry under Today keeps browser Back in the app | no | Today › To ask › an order › Not found › other supplier/Ask › New price › type › Save, 5 times: still on buyer.html, `history.state` matches the screen; Back from Today stays in the app |
| BUY-02 | P1 | `src/apps/buyer/orders/rules.ts` `orderView` (total), `orders/List.tsx`, `orders/Order.tsx`, `replies/Price.tsx` | The order's figure is **Client pays** = Σ qty × sellPrice (unchanged by any Buyer write); **Cost** = Σ qty × cost beside it, labelled; the Buyer never writes `sellPrice` | yes | After a pick and a new price, the order's Client pays in Checking and in Sales is unchanged; the cost shows separately |
| BUY-02 | P1 | `docs/audit/buyer/round-1-check.sql` 1–2 (read only, before coding) | Confirm on #0606/#0612 that `sellPrice` is untouched and no stored total follows the cost | no | query 2 returns no order whose total moved with a cost |
| BUY-03 | P2 | `src/core/buyer/rules.ts` `tiles`, `today/Today.tsx`, `today/Tiles.tsx`, `shell/App.tsx` (the + count), `trip/Plan.tsx`, `suppliers/rules.ts` | One rule per number (table above); every number shows its unit word; the + counts plan stops without held lines | yes | Same value on every screen for each number (e2e checks each pair) |
| BUY-04 | P2 | `orders/parts.tsx` `Sees`, `replies/Replies.tsx` chips, `today/Rows.tsx` | One "sees" part: "{Seller} sees: {word}", the word from `core/lineword.ts` for a line and the order's own word for an order; "Sales sees" goes | yes | #0212: chip and order sheet show the same word, one label |
| BUY-05 | P2 | `orders/rules.ts` (`FILTERS`, `matches`), `orders/Order.tsx` banner, `core/buyer/supabase/rows.ts` (cancel_asks → `onHold`) | One `holdOf(order)`: the banner, the On hold filter, the "Warren decides" filter count and the lines' sees word all read it | yes | #0604: banner "On hold · Cancel asked · Warren decides", in On hold and counted in Warren decides, lines "Daphine sees: On hold" |
| BUY-06 | P2 | `today/AskSheet.tsx` (`run('price')`), `replies/Price.tsx` | Open the price screen at once (no write first); the ask and the price go together on Save; field `autofocus`; the head's word changes only after the save resolves | yes | Field visible and focused < 100 ms; head says Asked until Save succeeds |
| BUY-07 | P2 | `replies/Price.tsx`, `suppliers/Fix.tsx`; rule `farFromList(price, list)` in `core/buyer/rules.ts` | Over ±50% of the list price: the amber line and "Save anyway" | yes | 15 against 145,000 warns; 140,000 does not |
| BUY-08 | P2 | `replies/Price.tsx`, `trip/PlanStop.tsx`, `orders/Order.tsx` (every `sells ${fig(l.sell)}`) | A line with no selling price reads "Price coming · {Manager} prices it"; its cost never sends it to "{Manager} decides" (uses `priceComing`, cross-app BUY-3) | yes | Edging Lipping and Jin Zhuang show Price coming; not in Warren decides |
| BUY-09 | P2 | `suppliers/rules.ts:136` (`was`) | "was" is the line's own `priceWas` (the old cost), never the list's current price | no | 400 → 450 shows "was 400" |
| BUY-10 | P2 | `src/ui/toast.tsx` (`show`), every Buyer `toast.show(..., { undo })` | An Undo stays 10 s and until the next action; a later toast never replaces an Undo before 5 s (queued behind it) | no | Undo still on screen after 5 s in each Undo flow |
| BUY-11 | P3 | `src/core/time.ts` new `whenShort(ms, now)`; every Buyer "· {clock}" | Today: "15:41"; yesterday: "Yesterday 15:41"; older: "Tue 10 Nov" | yes | A found from yesterday reads "Yesterday 15:41" |
| BUY-12 | P3 | `replies/Replies.tsx` (No → Not found), `orders/List.tsx:156` empty words, `orders/Order.tsx` back label, `today/Cards.tsx` held chip, `suppliers/One.tsx`, `trip/StopCard.tsx` units | The words in the board; a missing unit falls back to the line's unit, else "each" | yes | Each before string gone (e2e text checks) |
| BUY-13 | P3 | `orders/orders.css:105`, `replies/replies.css:113` (line-through), `trip/StopCard.tsx` (two-line names), `orders/NotFound.tsx` dock | No strikethrough (grey + "was"/"Removed" word); names wrap on two lines; the dock's "sees" shows only after a choice | yes | 360 px and 1305 px: no "…" on the stepper; no struck text |
| BUY-14 | P3 | new `shell/You.tsx` (sheet), `today/Head.tsx` (avatar opens it); `shell/App.tsx` + `shell/store.ts` (loading: the kept copy's figures dimmed, "Opening…"); `trip/Plan.tsx` + new write `takeBackCash` | The You sheet with Sign out; never a blank start; Take back the cash ask while Esther has not given | yes | Avatar opens You; Sign out lands on the sign-in page; first paint under 300 ms; an ask taken back leaves Esther's list |
| BUY-15 | P3 | `src/ui/TabBar.tsx` (link names), `replies/Done.tsx` (the Answered row), `trip/Plan.tsx` (waiting button) | Each control has a name ("Today", "Suppliers", "Answered, 4", "Waiting for Esther") | no | axe: no unnamed button or link |

## Server / SQL changes planned

| ID | Migration / function / policy | Change | Test |
|---|---|---|---|
| BUY-14 | `buyer_handoffs` (the cash ask) — **no new migration if** the buyer may already update its own pending ask; else the Buyer's reserved migration in `docs/decision-rights.md` | Taking back a cash ask: the Buyer's own ask, still `pending` (not given), goes to `status = 'cancelled'`, and Esther's list drops it; never once given | SQL test as the buyer (own pending ask: allowed; given ask: refused; another runner's: refused) and as accounts (sees it gone) |
| BUY-02 | none | The data already keeps the two prices apart (`items[].price` = cost, `items[].sellPrice` = what the client pays; Sales totals `sellPrice`). Confirmed by `round-1-check.sql` before coding; if query 2 shows a total that moved, that app is fixed in the cross-app round, not here | `round-1-check.sql` |

## Glossary changes

| Term | Meaning | Replaces |
|---|---|---|
| Client pays | What the client pays for an order or a line (`sellPrice`); only Sales or the Manager change it | the order's total shown as the cost |
| Cost | What the shop pays the supplier for a line (the buyer's price) | "price" for a supplier's price on an order line |
| Yesterday 15:41 / Tue 10 Nov | A time not today always carries its day | a bare "15:41" from another day |
| On hold | (existing, Cross-app R1 · X-1) now also the Buyer's banner, filter and sees word for an order whose cancel waits on the Manager | "Warren decides" on a held order |
| Far from the list | A typed cost more than 50% above or below the list price: check it, then Save anyway | — |

## Not changing / pushed back

| ID | Why |
|---|---|
| BUY-02 (rename the field) | Renaming `items[].price` to `cost` in the stored order would touch every app and the server at once for no change on screen; the two prices are already apart. Labelled on screen instead. |
| BUY-14 (correct a given cash ask) | Once Esther has given the cash, it is hers to correct (Accounts is the treasurer, `docs/decision-rights.md`); the Buyer can only take back an ask she has not given. |

## Blocking questions for Kevin

1. **BUY-02:** run queries 1 and 2 of `docs/audit/buyer/round-1-check.sql` (read only). If query 2 lists orders whose stored total moved with a cost, which app wrote it decides where the fix goes.
2. **BUY-07:** is ±50% of the list the right line for "Far from the list"? (Smaller catches more slips but warns on real changes.)
3. **BUY-14:** "Take back the cash ask" adds one write (and possibly a migration). Keep it, or leave correcting a sent ask to Esther (smaller)?

## Phase B result (filled after implementing)

| ID | Done? | What changed | How verified |
|---|---|---|---|
