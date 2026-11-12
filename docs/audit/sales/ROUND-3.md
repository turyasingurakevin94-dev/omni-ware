# Sales · Round 3: Core workflows (on the /next build)   (brief received 10 Nov 2026, build a8cd027d4d73, last-modified 10 Nov 2026 07:09 GMT)

Tested by Cowork on `/next/sales.html`, signed in as Daphine (sales), shop "Omni-ware (old records)", read-only.
Verified fixed and not to regress: SAL-016 (no credit switch; over the limit waits for the Manager), the price guard
under cost, quick entry "3 sahara", Undo on a removed line, nothing clipped at 360 px on Today, Orders, Customers, Chats.

## Design changes (canvas)

Canvas: "Sales — in the agent app's language" (https://claude.ai/artifact/SwqWmXv4c2KbB1zgErYsWQ). Boards at 360 px.
The Sales app is a phone app (spec 07), so 360 px only, as in rounds 1 and 2.

| ID | Board(s) | Before → After | States drawn | Tokens/components used | New component? |
|---|---|---|---|---|---|
| SAL-019 | TD28WhichShop (new) | A sign-in with two shops opened the first one without asking → "Which shop?" lists each shop with your role and since when; the choice is kept on this phone until sign-out (as `sales.html` chooseShop) | default (two shops); one shop: no screen (straight in); offline: the last choice from the copy | navy sign-in screen of TD10, group rows 72 px, store mark | No (TD10's screen and row) |
| SAL-021 | TD29NotSentStuck (new), TD30NotSentSheet (new) | With signal, a write that kept failing sat in the outbox unseen and held every write behind it → Today shows it in red ("Ask to cancel #0586 couldn't go", "Not sent yet 2 · 1 couldn't go · tried 8 times", See); the sheet shows what the shop said, Throw away or Try again; the writes behind it go on their own | default (stuck, with signal), sending (the one behind it), refused (what the shop said); offline stays TD09; empty: no row | Notice (bad), Needs-you row, sheet frame of SL18, CU46's Fix/Throw away pattern | No |
| SAL-015 | SL14CountZero (redrawn) | − at 1 showed 0 while the line and total went back to the count the line opened with (3 bags, 105,000) → at 1, − is grey and does nothing to the count; the line stays 1 × 38,000 and the total follows; "At least 1 — use the bin to remove it" | at 1 (− grey + the hint), the bin outlined | Stepper, Alert, bin | No |
| SAL-023 | SL44PriceFirst (new); SL18, SL19, SL20 unchanged | The warning appeared between the amount and the keypad and pushed the keys ~40 px down under the finger → the message line keeps its 44 px even when empty, so a warning appears in place and the keys stay put | nothing typed (empty line), under the shop's price (SL18), a zero too many (SL19), under cost (SL20) | Price sheet, Callout | No |
| SAL-022 | none (SL01Who already draws the white label) | — | — | — | — |
| SAL-024 | none (CH01 already draws count = rows) | — | — | — | — |
| SAL-025 | none | — | — | — | — |
| SAL-026 | none | — | — | — | — |

## Code changes planned

| ID | Sev | File / function | Change (one line) | UI? | Acceptance check |
|---|---|---|---|---|---|
| SAL-019 | High | `core/supabase/read.ts` readSession; `shell` sign-in | Ask which shop when the sign-in opens more than one (TD28) and keep the choice until sign-out, instead of opening the first; then whatever `round-3-check.sql` 1–4 shows (a wrong shop is fixed by this; a policy hiding orders is a server fix, below) | Yes | `round-3-check.sql` 2 and 4: the orders a sales sign-in may read equal `books.orders`; #0494–#0586 appear |
| SAL-020 | High | `core/owing.ts` owingOf | The opening balance is what the stored balance holds beyond the open bills (0165 `ow_balance_check`: "the log is not used to split the balance"), never the sum of debt-log lines with no order; owes = the balance (or the bills, when they say more) | No (same screens, right figure) | Onora 382,000 on her page, Take payment, the picker and the list; the Customers total equals the sum of balances; test: a debt-log charge with no order that is an order's own charge is not counted twice |
| SAL-011 | (reopened, with SAL-020) | `core/owing.ts` | Settled by SAL-020: the debt log no longer sets the balance (Ken Bwaise 40,000) | No | Ken Bwaise 40,000 |
| SAL-021 | High | `core/outbox.ts` flush; `today/Today.tsx`; new sheet in `shell` | A write that fails 3 times with signal becomes refused, with the shop's words (or "couldn't go, tried N times"); refused writes no longer hold the queue, except a later write on the same order, which waits for it; Today's "Not sent yet" shows whenever something is kept, not only offline; See opens TD30 | Yes | A failing write first: the ones after it still send; Today says "2" with "1 couldn't go"; Throw away and Try again work |
| SAL-015 | Medium | `sell/Lines.tsx` the open line's stepper; `counter` stepper (same rule) | − at 1 leaves the count at 1 (no 0 state, no going back to the opening count) and shows the hint | Yes | − at 1: the line stays 1 × 35,000 and the total 35,000 |
| SAL-022 | Medium | `sell/who.css` → the shell's CSS | The Who sheet's button styles ship with the shell, so the red + opens it styled before the Sell tab has loaded | No | Cold first open: white on navy, ≥ 4.5:1 |
| SAL-023 | Medium | `sell/PriceSheet.tsx`, `price.css` | One message line of fixed 44 px between the amount and the keypad; the warnings render into it | Yes | The keys' positions are the same before and after a warning |
| SAL-024 | Low | `chats/List.tsx` | The Mine count and the chip count are the rows Mine shows (one list for both) | No | The count equals the rows on every filter |
| SAL-025 | Low | `ui/toast` + `sell` | A toast with Undo from a screen closes when that screen closes | No | No Sell toast on another tab |
| SAL-026 | Low | `sell/AislesSheet.tsx`, `sell/Start.tsx` and every "N items" | Counted words through `core/names.ts counted()` ("1 item", "2 items") | No | "Bolts & Nuts · 1 item" |

## Server / SQL changes planned

| ID | Migration / function / policy | Change | Test |
|---|---|---|---|
| SAL-019 | none yet; `docs/audit/sales/round-3-check.sql` 1–4 (read-only) | Kevin runs it. If query 4 shows a policy hiding orders from Sales, the fix is a migration (the next number reserved in `docs/decision-rights.md`), planned then | SQL run as the sales role: seen = there |
| SAL-021 | 0181 (already written, not yet applied on live) | The stuck ask to cancel #0586 calls `ask_cancel`, which 0181 adds; Kevin's 10 Nov check showed 0181 missing. `docs/live/apply-0179-0181.sql` applies it | `round-3-check.sql` 6: 2 rows |

## Glossary changes

| Term | Meaning | Replaces |
|---|---|---|
| Couldn't go | A kept write the shop refused or that failed again and again with signal; red, with what the shop said; Throw away or Try again | "Failed", "Error", a silent outbox |
| Which shop? | The question when one sign-in opens more than one shop; the choice is kept until sign-out | opening the first shop without asking |

## Not changing / pushed back

| ID | Why |
|---|---|
| SAL-010, SAL-012, SAL-013, SAL-018 | Can't be checked until SAL-019 loads the orders; carried to the re-check |
| SAL-017 | Round 5 (Roles and privacy), as agreed in round 2 |
| SAL-020's "match a charge to an order by customer, amount and day" | Not built: the server's own rule (0165) is that the balance is the truth and the log never splits it. Guessing which log line belongs to which order would be a second rule that can disagree with the server |
| Cowork's two questions (writing on test records; clearing the Grace Hardware draft and the stuck #0586 cancel) | Kevin's to answer, not this round's code |

## Phase B result (filled after implementing)

| ID | Done? | What changed | How verified |
|---|---|---|---|
| SAL-015 | Yes | − at 1 leaves the count at 1, greyed, with "At least 1 — use the bin to remove it"; the line and the total stay at 1 (no 0, no going back to the opening count) (`sell/Lines.tsx` `atLeast`, SL14) | parity SL14 0.02%; e2e 13/13 |
| SAL-019 | Yes (as planned) | A sign-in that opens more than one shop asks Which shop? (TD28, `shell/WhichShop.tsx`), kept on the phone until sign-out (`core/shop-choice.ts`, `readSession` `prefer`, `shops`). Not the cause of the missing orders: `round-3-check.sql` 2 and 3 showed the live books hold only 46 orders (#148–#214); Kevin restored an old backup in the console between 5 and 10 Nov, which deleted every newer row | parity TD28 0%; e2e: asks, opens on a choice, not asked again after a reload |
| SAL-020 | **No change — the mechanism is right** (12 Nov) | Kevin first chose "the stored balance is the truth"; building it showed the trade: it breaks Lubowa's case (a payment in the log naming no order, stored 0, bill 349,000: the log + bills rule says 0, rightly), while 0169's rule only double-counts rows whose charge names no order. Every writer names the order today (the console's auto-sync writes `quoteId`; every server money function writes `quote_id`), so 0169 is right for everything written now; Onora's 764,000 comes from old rows that round 1's `round-1-correct.sql` fixed and the 25 Aug backup restore brought back. Migration 0184 and the app changes were built, tested and withdrawn | the 0184 build's own DB test passed; the existing Sales and Manager tests (MGR-DATA-02's Eddy and Ken, the demo's Lubowa) showed what it would break |
| SAL-011 | With SAL-020 | — | — |
| SAL-021 | Yes, by cross-app round 1 (SAL-3, on main 11 Nov) | Writes wait only behind a write on the same thing; a write still "no signal" after 5 tries while reads work is refused with its reason; Today lists Not sent first, its sheet has Remove and Try again (`src/core/outbox.ts`, `today/NotSent.tsx`, spec 06 §7a). TD29/TD30 taken off the canvas: one design | cross-app round 1's tests (in npm test) |
| SAL-022 | Yes | The cause was not loading: "New customer" is a link under the finger that tapped the red +, and `a:hover {color: inherit}` (0,1,1) beat its white (0,1,0) on a stuck touch hover. Now `:where(a:hover)` (`ui/tokens.css`) | cold open and after a touch: white on navy |
| SAL-023 | Yes, by cross-app round 1 (SAL-5) | The message line is one 52 px slot, "The shop's price …" at rest, so a warning never moves a key (`sell/PriceSheet.tsx`); SL44 drawn to it, SL18–SL20 redrawn to the 52 px slot | parity SL44, SL18, SL19, SL20 ≤ 0.02% |
| SAL-024 | **Not reproduced** | On the demo data the count and the rows agree (one list, `mineList`). The chat named (last message 10 Oct) is older than a week and should not count; to re-check once the books are restored | — |
| SAL-025 | Yes | A line's Undo toast is tagged with its order and goes when the order closes (`ui/toast.tsx` `tag`, `sell/Order.tsx`) | — |
| SAL-026 | Yes | "1 item", "1 aisle" on the aisle tiles and the Browse sheet | — |
