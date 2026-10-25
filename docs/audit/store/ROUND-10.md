# Store · Round 10: Final polish to 10/10   (brief received 24 Oct 2026, build 24 Oct 2026 00:04 UTC)

**Canvas:** https://claude.ai/artifact/LVsyQEintezbVH3qn4cSVi, row "Audit round 10 · final polish" (bottom, version 116). The boards are the real screens from the harness with each change applied there as a prototype. `store.html` is not changed in Phase A.

**Migration:** **0168** (Store, eleventh; 0167 went to Sales round 2). It covers names only (STO-WORD-11).

**Do not regress (verified by Cowork):**
- the service worker caches the app only, never the API;
- the parallel boot;
- Find's debounce;
- "Live" only after fresh data;
- check-in by Ctn/Box;
- the books/shelf split;
- categories;
- no money fields for the Store login.

## What was found

| ID | Root cause |
|---|---|
| STO-WORD-11 | **The fallback.** When a member has no `display_name` and no staff record, `ow_member_name()` (0164) gives "The Store". `personName()` rightly refuses that as a name, and falls back to "Someone". **The owner's login** has neither, so everything it did reads "Someone": checked in, reported, passed the yard, replaced a count. **The snapshot's `members`** carry the name but not the role, so the phone can't say "The owner" instead. |
| STO-REL-12 | **The two-phone guard has a database test.** `test/store-round3.test.js` covers it: tab B, still showing an order packed, is refused with 40001 "Someone else just changed this order". It passes. **The write limits (PRIV-05) are tested in `test/store-round5.test.js`, but that test no longer runs.** Since Sales' 0165 ("a payment needs its receipt"), its fixture's sample order is refused at setup, so every check after it fails (found in round 9). So the guards exist; the proof that the limits work stopped running. |
| STO-UI-11 | **Off the scale.** Alerts and You were not among round 7's eight screens, so they still set 11/12/13/15 px and 11/13/14/22/26 px. **The search field.** Report a loss's `#rp_find` is its natural 21 px high inside a 52 px box; Find's box was fixed in round 7 (`align-self:stretch;height:100%`). |
| STO-A11Y-04 | **The stamp.** The PACKED stamp is green on white (6.4:1), but it sits inside the finished card, and the whole card is dimmed to 55 %. Dimming the stamp with it gives 2.5:1. **The empty text.** `.st-empty` uses ink-3 (`#767F91`), 4.0:1 on white. It is the empty text on every list, not only Alerts. |
| NAV-08 | **The Aisle page already has the sticky header** (`cv-stick`, round 4). The harness shows it on Aisle C (70 items) at 360 and 1280 wide, with normal and Big text. Once scrolled, Back and "Nails and fixings · 70 items · 14–24" stay at the top (canvas, "Aisle · already"). **The pages without it** are the other long lists whose header scrolls away: With Ruth, Alerts, On the road and Agent pickup. Count, Find, Returns and Labels keep their header pinned. |
| NAV-09 | **Remove.** "Waiting to send" lists four kinds of things: a report or a return kept in the outbox, picks kept on the phone, a check-in under way, and a count that did not send. None has a way to drop it. **Reload.** Every reload calls `start()` → Today; the screen stack is not kept. |
| STO-UI-12 | **The check-in line.** It draws `fullName(l)` as one string. Stock and Pack use `prodTT()` (the name, then the size tags). **Live trip lines** carry the size in the name ("Black Screws 8* / Coarse / 3/4"") with no `variantIdx`, so even `nameParts()` can't split them. **The caches.** Round 9's worker keeps two caches by design: `ow-store-page-v1` for the page and `ow-store-lib-v1` for supabase.js and the fonts. Activate already deletes any other `ow-store-*` cache. Two caches look like a leftover, so they become one. |

## Design changes (canvas)

| ID | Board(s) | Before → After | States drawn | Tokens/components used | New component? |
|---|---|---|---|---|---|
| STO-WORD-11 | `Store · Names · never "Someone"` | **Before:** "Someone · checked in 59 of 60", "Someone passed you the yard". **After:** the name the person chose; failing that, the role: "The owner checked in Denis's trip", "The owner · 2 · damaged". A role name has a person mark in its avatar instead of initials. | With Ruth before/after, Alerts before/after | avatar circle, person mark (icon set, 24 box, round ends) | No |
| STO-UI-11, STO-A11Y-04 | `Store · You and Alerts · on the scale` | You and Alerts use only 12 / 14 / 16 / 20 / 28. The empty text is ink-2 (5.5:1). | You before/after, Alerts empty before/after | `--t-*`, `--c-ink-2` | No |
| STO-UI-11 | `Store · Report a loss · the whole box is the field` | The whole 52 px search box takes the tap and the caret, as in Find. | before, after | Find's search box | No |
| STO-A11Y-04 | `Store · Pack · the stamp at full strength` | On a finished card, the card's content dims; the PACKED stamp stays at full strength on solid white (6.4:1). | before, after | the stamp (round 3) | No |
| NAV-08 | `Store · Long lists · Back and the title stay` | The Aisle page's bar, shown as it already works. **The same bar on the other long lists:** With Ruth "3 waiting · 2 answered today", Alerts "N for you", On the road "N of M stops done", Agent pickup. | Aisle (already), With Ruth before/after | `cv-stick` (round 4), reused | No |
| NAV-09 | `Store · Waiting to send · Remove` | **The row:** each waiting row gets a 44 px bin (crimson on crimson-soft, labelled "Remove"). **The sheet:** "Remove it from this phone?" repeats the row and says "It was never sent. Ruth will not see it. Nothing on the books changes." Keep it (navy, first) and Remove (crimson outline). **After:** the row goes, the count drops, "Removed from this phone". | default, confirm, removed | wait row, the Leave sheet's layout (`SHEET.leave`), toast | No (the bin is the icon set's; the sheet is Leave's) |
| STO-UI-12 | `Store · Check-in · name and tags` | "Black Screws 8* / Coarse / 3/4"" as one name → "Black Screws" with the tags 8*, Coarse, 3/4". | before, after | `prodTT()` / `.pv` tags | No |
| Kevin · In (24 Oct) | `In` (TodayIn, redone) and `Store · In · nothing at the gate yet` (InQuiet), canvas v117 | **Before:** two big tiles, a decorative road, and three faults on live (a bare "For", "buying" after every stop was done, "Shafik's trip · Shafik"). **After:** an arrivals board. **Top:** one row with the Buying · Coming · At the gate dots. **The oldest trip at the gate** gets its own card: wait ring, ticked suppliers, the orders waiting on it, and one "Check it in". **On the way:** "Buying · 1 of 2" / "Coming" / "Not started", a dot track, and "For the shelf" / "For 1 order" / "#0049 Ssali". **Checked in today:** a day line. **Nothing at the gate:** a calm card, no button. | busy, nothing at the gate | the navy header, dots, pills, chips | No |
| Kevin · headers (24 Oct) | To pack, On the road, Count sent / Recount / Decide (canvas v117) | Back, title and the key figure in one row; a slimmer bar, figures or track under it. 170–220 px → 110–135 px. | — | same | No |
| Kevin · On the road (25 Oct) | `Store · On the road · the button beside the order` (canvas v120) | **Before:** round 8 put "Mark delivered" under each order, so every stop took two rows. **After:** one row per stop. **The client** on the first line (two lines at most). **Under it:** "#0036 · Kira". **Beside it:** a "Delivered" button with the camera mark. | before, after, a long name | stop row, navy pill | No |

## Code changes planned

| ID | Sev | File / function | Change (one line) | UI? | Acceptance check |
|---|---|---|---|---|---|
| STO-WORD-11 | P2 | `store.html` `personName()`, `nameEveryone()`, `ini()` / avatars, `firstWord()`, `managerName()`, the 5 `|| 'Someone'` sites | **The order:** the chosen name, then the staff name, then the stored name, then the member's role ("The owner", "The manager", "The buyer", "Sales", "Accounts", "Sourcing", "The store", "A worker"), then "A colleague"; never "Someone". **Avatars:** a role name gets the person mark. **`firstWord()`** keeps "The owner" whole. "Someone else just did this" stays as it is: it is a sentence, not a name. | yes | The harness walk (#r6 with an unnamed owner) finds no "Someone" on any screen except "Someone else just did this". A test pins the order. |
| STO-REL-12 | P2 | `test/fixtures/store-round5-scenario.sql`, `store-no-money-scenario.sql`; new `test/store-round10.test.js` + `test/fixtures/store-round10-scenario.sql` | **Repair:** the round 5 and no-money fixtures, under 0165's receipt rule. **New, as a Store login:** a stale `p_expect` on pack and on hand over (40001); writes to `shop_members` (role), `saved_quotes` (insert/update), `customers`; the Manager's functions (`write_off_stock`, `accept_stock_count`, `decide_invoice_ask`, `accept_trip_difference`) all refused; the Store's own functions still work. | no | All four pass with `OW_PG`; their output is pasted into this file. |
| STO-REL-12 | P2 | new `docs/audit/store/round-10-test-order.sql` (+ cleanup) | One "TEST · two tabs" walk-in order on live, ready to pack: one line, 1 pc of an in-stock item, already let go so the money gate does not hold it. A second script returns the piece and voids the order. **Kevin runs both** (Q2). | — | On the TEST order, tab A packs then hands over; tab B, opened before, is refused each time with the blue "Someone else just did this · Refreshed". |
| STO-UI-11 | P3 | `store.html` `PAGE.alerts`, `PAGE.me` (and `alertRow`) | Every font size to `--t-*` (round 7's mapping). | yes | No raw px font size in either page (test). The round 7 / 8 harness walk passes, normal and Big text. |
| STO-UI-11 | P3 | `store.html` `PAGE.report` `#rp_find` | `align-self:stretch;height:100%` | yes | The field is 52 px tall; a tap anywhere in the box places the caret. |
| STO-A11Y-04 | P3 | `store.html` `PAGE.pack` (the finished card), `.st-empty` | The dim moves from the card to its content, so the stamp is never dimmed. `.st-empty` → ink-2. | yes | The contrast scan with a finished line on screen, and on Alerts empty: nothing under 4.5:1. |
| NAV-08 | P3 | `store.html` `PAGE.ruth`, `PAGE.alerts`, `PAGE.onroad`, `PAGE.agent`; `stickSync()` | The same `cv-stick` bar (Back + title + a live line), shown once the header has scrolled away. `stickSync` counts rows only where the page asks for it. | yes | On each page, scrolled past its header, Back and the title are at the top (`elementFromPoint`), and Back works. |
| NAV-09 | P3 | `store.html` `waitCard()`, new `SHEET.rmwait`, `ACT.rmwait` / `ACT.rmwaityes` | **What Remove does, by kind:** the outbox (`outboxDel`); the picks kept on the phone (the draft dropped; the order stays as the books have it); a check-in under way (the draft dropped); a count that did not send (dropped). Each needs the confirm. | yes | Each kind is removed only after the confirm, and doesn't come back on reload. Keep it changes nothing. |
| NAV-09 | P3 | `store.html` `render()` / `start()`; new `saveView()` / `restoreView()` | **Kept** in `sessionStorage` (one reload, this tab): the tab and the stack of list or detail pages (aisle, stock item, Find with its query, order, Alerts, With Ruth, You, On the road, Labels). **Not kept:** flows (Pack, check-in, counting, hand over) and sheets; these resume from Today's cards as now. A page whose thing is gone opens as "That … is gone". History is aligned with `navArm()`, so Back still steps back. | no | Open an aisle → an item, reload: the item page, and Back goes to the aisle, then Stock. In Pack, reload: Today with "Resume". |
| STO-UI-12 | P3 | `store.html` `PAGE.receive` line, `nameParts()` | **The line:** `prodTT(l)` in place of `fullName(l)`. **The split:** with no `variantIdx`, find the product's variant whose label ends the name; failing that, split the name at " / ". | yes | "Black Screws 8* / Coarse / 3/4"" shows the name with three tags; a line with `variantIdx` is unchanged. |
| STO-UI-12 | P3 | `store-sw.js` | **One cache,** `ow-store-v2`, for the page and the libraries. Activate deletes every other `ow-store-*` cache, including both v1 caches. | no | After an update, `caches.keys()` holds one Store cache; opening offline still works. |
| Kevin · In | P3 | `store.html` `PAGE.movein` | Rebuilt to the TodayIn / InQuiet boards. **"For":** order ids not in the phone's data count as "For N orders". **"Coming":** once every stop is done. **Supplier deliveries:** "<Supplier> delivers". | yes | Harness: busy and quiet match the boards at 360; never a bare "For"; a trip with every stop done reads "Coming". |
| Kevin · headers | P3 | `store.html` `PAGE.movepack`, `PAGE.onroad` header, the count status pages | The compact headers from the boards. | yes | Each header at most 135 px at 360, normal text; the round 8 Big text walk passes. |
| Kevin · On the road | P3 | `store.html` `PAGE.onroad` stop row | No wrap. The client is the title (clamp 2); `q4` and the place go below; the button reads "Delivered", 44 px high, beside the order. Round 8's test line for "the button under it" changes with it. | yes | At 360, each stop is one row, a long client name takes two lines, and nothing is clipped. |
| Kevin · the light band at the top (25 Oct) | P2 | `store.html` head script (the Android shell), `paintBar()` and `insets()` | **Cause 1:** a pushed page slides up 40 px as it opens, and the strip behind the clock is coloured on that first frame. The navy header is still 40 px down, so the strip is painted light, and nothing repaints it after the slide. **Fix 1:** repaint on `animationend`, and judge the header by its place in the page (`offsetTop`), not its place mid-slide. **Cause 2:** on phones where Android keeps the clock in its own bar (Kevin's), the app still reserves room for it, so the band is a second, empty strip. **Fix 2:** when the page is already laid out below the bars, the top inset is 0. | yes | On Kevin's phone: To pack, In, On the road, Alerts and You open with navy right up to Android's bar, no light band, and no band after Back. On a phone with the clock over the page, the header still runs under the clock. |

## Server / SQL changes planned

| ID | Migration / function / policy | Change | Test |
|---|---|---|---|
| STO-WORD-11 | **0168** `ow_member_name()` | The last fallback is the member's role word ("The owner", "The manager"…), not "The Store". So names the database writes from now on (counted by, asked by) carry it too. | PG: a member with no name, as owner, store and manager. |
| STO-WORD-11 | **0168** `store_live()` `members` | Each member carries `role` as well as the name. | PG: `members[*].role` present; no other key added. |
| STO-WORD-11 | data, **Kevin's call** (Q1) | `docs/audit/store/round-10-names-check.sql` (read-only) lists every member with no name the apps can show. For each, Kevin either gives the name (set by one `update shop_members set display_name = …` line) or leaves the role word. | — |
| STO-WORD-11 | 0168 house rules | Safe to run twice; ROLLBACK (0164's `ow_member_name` and 0166's `store_live`); CHECK block; a 0168 row in decision-rights. No role, task or push changes. | `test/decision-rights.test.js` |
| STO-REL-12 | tests only | Repair the round 5 and no-money fixtures (a payment gets its receipt); the new round 10 scenario. No migration. | as above |

## Glossary changes

| Term | Meaning | Replaces |
|---|---|---|
| A person's name (updated) | The name they chose; otherwise their staff record's name; otherwise their role ("The owner", "The manager"). Never a login. | "Otherwise 'Someone'" |
| A colleague | A person who has left the shop and has no role any more | "Someone" |
| Remove (Waiting to send) | Drop something that was never sent from this phone, after a confirm; the books never had it | — |
| Coming in | Goods coming **into** the yard from suppliers: trips still buying ("Buying") and trips heading back ("Coming"). The In page's list | "On the way", which read like "On the road" |
| On the road (unchanged) | Orders going **out** to clients on a truck | — |

## Not changing / pushed back

| ID | Why |
|---|---|
| NAV-08 (Aisle page) | It already has the sticky header (canvas: "Aisle · already", 70 items, 360 and 1280 wide, normal and Big text). If Cowork still sees it scroll away, please send the steps and the screen size. The plan adds the same bar to the four long lists that lack it. |
| "Someone else just did this" | Kept: it is the two-phone sentence the brief itself asks for, not a person's name. |

## Questions for Kevin

1. **The owner's name.** What should the owner's login show: your name (say how), or "The owner"? Please run `docs/audit/store/round-10-names-check.sql` (read-only) and paste the result. For each member listed, give a name or say "role".
2. **The TEST order on live.** Is it all right to make one walk-in order "TEST · two tabs" with 1 pc of a cheap in-stock item? It would be marked as let go so the money gate doesn't hold it. It takes 1 pc off the shelf when handed over; the cleanup script puts it back and voids the order. If Sales round 2's test marking goes in, an order named "TEST …" is kept out of every figure as well.
3. **Migration numbers.** Sales round 2's plan (`docs/audit/sales/ROUND-2.md`) names 0166 for Sales. 0166 is already Store round 9's, and it's live. This commit reserves 0167 for Store round 10, so Sales should take the next free number (0168) when it reserves.

## Phase B result (filled after implementing)

| ID | Done? | What changed | How verified |
|---|---|---|---|
| STO-WORD-11 | Yes | **0168** `store_live()`: each member carries `role`, and `name` is null when the shop has none to show. `ow_member_name()` is **not** changed: six Store functions test for its "The Store" marker, so the role fallback is done on the phone instead of in the plan's SQL. `store.html`: `ROLE_WORD` / `ROLE_NAMES`; `personName()` falls back to the member's role, then "A colleague"; `initials()` + `iniHTML()` draw a person mark for a role name; `firstWord()` keeps "The owner" whole; `managerName()` skips role words; the members keep `role` in `applyFresh` and `refreshLive`. Two more "Someone"s found while checking: To pack's "Someone's on it" is now **"Packing now"** (heading and legend; canvas v122), and the Aisle header's "someone counted it" uses "The yard" like the other count lines. | `test/store-round10.test.js`: `personName` on a login with no name → "The owner"; handle → role; no role → "A colleague"; no `'Someone'` in the code. Harness `r10names.js` on every page: 0 "Someone". `r10desk.js` at 360 and 1280 on In, To pack, On the road, Alerts, With Ruth, You, Find: 0 "Someone". |
| STO-REL-12 | Yes | `test/fixtures/store-round5-scenario.sql` and `store-no-money-scenario.sql`: each payment gets its receipt row, so the scenarios run again. New `test/fixtures/store-round10-scenario.sql` (two tabs, the yard's write limits, members with roles). `docs/audit/store/round-10-test-order.sql` + `round-10-test-order-cleanup.sql` for the live check. | On Postgres 16, all migrations, 0168 twice, then the scenario (output below). `store-round1/3/5/9/10`, `store-no-money`, `store-asks` pass with `OW_PG`. |
| STO-UI-11 | Yes | `PAGE.alerts` and `PAGE.me`: every font size on the `--t-*` scale. `PAGE.report` `#rp_find`: `align-self:stretch;height:100%`, so the whole box is the field. | No raw px font size in either page (test). Harness: Report a loss field fills its 52 px box. |
| STO-A11Y-04 | Yes | `PAGE.pack`: a card off to the side gets `pk-dim`, which dims its contents and never the `pk-keep` stamp (white ground). `.st-empty` in `--ink2`. | Test pins the CSS; `r9contrast.js`: 0 small text under 4.5:1 on slip, On the road, Return, Alerts. |
| NAV-08 | Yes | New `stickBar(title, sub)`: With Ruth ("N waiting · N answered today"), Alerts ("N new for you"), On the road ("N out · N delivered today") and In ("N at the gate · N coming in"). Agent pickup was in the plan, but it is a fixed keypad screen that never scrolls, so it needs no bar. | `r10nav.js`: scrolled past the header, Back and the title are at the top and Back works. |
| NAV-09 | Yes | **Remove:** each Waiting-to-send row has a 44 px bin (`data-act="rmwait"`), then `SHEET.rmwait` ("Remove it from this phone?" · Keep it / Remove), then `ACT.rmwaityes` drops a kept report or return (`outboxDel`), picks (`S.pickDraft`), a check-in (`RC_KEY`) or a count (`CT_KEY`). **Reload:** `saveView()` / `restoreView()` keep the list or detail page (`VIEW_PAGES`) in `sessionStorage`; flows reopen from Today with their drafts. | Harness: Keep it keeps the item; Remove removes it and it stays gone after a reload. A reload on Aisle → item opens the same item, and Back goes to the aisle. A reload during Pack opens Today with the draft. |
| STO-UI-12 | Yes | `nameParts()` falls back to the product variant that ends the name, otherwise splits at " / " (a trailing size word goes to the tags); the check-in line uses `prodTT()`. `store-sw.js`: one cache `ow-store-v2`; activate deletes every other `ow-store-*` cache. | Test: "Black Screws 8* / Coarse / 3/4"" → name "Black Screws", tags "8* / Coarse / 3/4""; the SW has no second cache name. |
| Kevin · In | Yes | `PAGE.movein` rebuilt to TodayIn / InQuiet: the stage dots in the header, the next trip at the gate (wait ring, ticked suppliers, the orders waiting on it, "Check it in"), "Coming in" with Buying / Coming / Not started, "Checked in today" on a day line, and a calm "Nothing at the gate" card. `inStage()` / `inFor()`: never a bare "For" and never "buying" after every stop is done. A trip the supplier brings reads "Shafik · to the yard", not "The supplier brings it" (canvas v121). "At the gate · next" and "Nothing at the gate" are level-2 headings. | Test: `inStage`, `inFor`. Harness `r10in.js` busy and quiet at 360 match the boards (header 82 px); `r10desk.js` at 1280. |
| Kevin · headers | Yes | New `compactHead()`: To pack 110 px, On the road 122 px, the count status pages 124 px (were 170–220). | `r10heads.js` at 360; `r8big.js` Big text walk: nothing clipped. |
| Kevin · On the road | Yes | One row per stop: the client (2 lines at most), then "#0036 · Kira", then "Delivered" with the camera beside it. No wrap. | `r10road.js` at 360: every stop is one row and the button is inside it. |
| Kevin · the light band | Yes | Head script: `paintBar()` judges the header by `offsetTop - scrollTop` and repaints on `animationend`; `insets()` marks its own guess, and removes it when Android keeps the clock in its own bar (page shorter than the screen), never a value Capacitor measured. | `r10strip.js`: after a page slides in, the strip is transparent (the old build: light). On Kevin's phone this needs the live check. |

### STO-REL-12 on Postgres 16 (`test/fixtures/store-round10-scenario.sql`)

```
A packs|done
B packs|40001 Someone else just changed this order.
A hands over|completed
B hands over|40001 Someone else just changed this order.
w|own role|0 rows
w|manager role|0 rows
w|order insert|refused 42501
w|order update|0 rows
w|customer update|0 rows
w|write_off_stock|refused 42501
w|accept_stock_count|refused 42501
w|decide_invoice_ask|refused 42501
w|accept_trip_difference|refused 42501
w|own ask|written
member|manager|Ruth Nakato
member|owner|∅
member|store|Musa Kiggundu
row|completed|Peter|1
```

### Checks run

- `npm test`: exit 0.
- `node test/store-round10.test.js` with `OW_PG`: all passed (static checks and the database scenario).
- Old tests updated to round 10's markup: round 4 (`afterRender` ends with `saveView`), round 6 (On the road's pills "delivered" / "collected", collected still a part of delivered), round 8 (level-2 headings counted however they are styled; On the road on one row), store-app (fix 6 still holds: no "the supplier").
- `store-money-db` with `OW_PG`: 8 failures, the same 8 on the commit before this round (deferred since round 5, see LOG).
