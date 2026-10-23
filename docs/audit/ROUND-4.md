# Round 4: Search and navigation   (brief received 23 Oct 2026, build 23 Oct 2026 15:44 UTC)

Canvas: https://claude.ai/artifact/LVsyQEintezbVH3qn4cSVi, the row "Audit round 4 · search and navigation" (bottom of the canvas).
Migration: **0163** (data only: one product name, NAV-06). 0161 and 0162 are still to run.
Do not regress: Waiting to send and "Not sent · N", the Sending/Kept/Sent states, the tap guard, the offline hand-over with "Not done · Try again", plain error words, order search by number and client, Luganda aliases, real-stock suggestions, Escape → leave-confirm.

**The brief arrived cut off after NAV-08** ("Back is reachable at…"). Anything after it, and NAV-01 if there was one, is not in this plan yet.

## Design changes (canvas)

| ID | Board(s) | Before → After | States drawn | Tokens/components used | New component? |
|---|---|---|---|---|---|
| NAV-03 | `VariantTags` | Before: "6* · Coarse · 1 1 · 4"" (a fraction torn in two, so the picker reads 4"). After: "6* · Coarse · 1 1/4"", the size whole and darkest. | before/after, 4 rows | `.pv` tags | No |
| NAV-02 | `LeaveApp` | Before: phone Back reloads the page or closes the app. After: Back walks back screen by screen (the existing leave-confirm sheets included). On Today it asks "Leave Omni-ware?" with Stay (primary) / Leave. If anything is still waiting to send, it says so in amber. | calm, waiting | the confirm sheet (`leave`), amber status line | No |
| NAV-04 / NAV-05 | `OrderView` | Before: a quote shows "To pack" and opens Pack; a buying order's row does nothing. After: one look-only order view: **Buying** ("Packing opens when the goods come in", each line saying where it comes from); **Quote · not confirmed** ("Grace is still writing it up"); **Joy is packing it** ("2 of 4 lines packed"). Every Find row opens something. | buying, quote, someone else's | navy hero, status chip, list rows, "Look only" foot | No: the order pages' parts, read-only. |
| NAV-04 | `PackShortChoice` | Before: the red button says "Pack 0 · 1 short" / "Pack 13 · 7 short". After: red only for the full line. Short is an amber-outlined choice, "Pack short · 13 of 20". A line bought for this order that hasn't come in says "Not in yet · coming from Katwe Fabricators" and offers no pack. | enough, some, not in yet | pack dock, red primary, amber outline | No |
| REL-05 (reopened) | `HandOverStates` | Before: a green "Handed over" tick during the 10 s undo. After: "Handing over…" (spinner, Undo, the slip faded) → "Handed over" (green, after the server's yes) → or the `NotDone` bar. Also "Packing #0576…" and "Delivering…". | handing over, handed over, packing | `stateDot`, done screen grid | No |
| NAV-06 / NAV-07 | `FindTypos` | Before: "hindge" and "4x20" find nothing, the chips read "All 180" against 68 rows, and they show 0s before typing. After: "hindge" → hinges ("Showing hinges"), "4x20" → "4*20", 0 results → "Did you mean hinge · handle". The chips appear only with a query, and their counts equal the rows. | typo, times, did you mean, empty (no chips, Try) | Find hero, chips, list, hint line | No |
| NAV-08 | `AisleSticky` | Before: in a 68-row aisle the header and Back scroll away. After: a compact navy bar (Back, the aisle letter and name, which rows are in view) sticks once the hero scrolls off, and a round "back to the top" button sits bottom right. | scrolled | navy, circle letter, navy round button | No |

## Code changes planned

| ID | Sev | File / function | Change (one line) | UI? | Acceptance check |
|---|---|---|---|---|---|
| NAV-03 | P1 | `store.html`: `prodTT` (and any other place that splits a variant) | Split on `\s+\/\s+` (space-slash-space) only; a "/" inside a number never splits. | yes | All 20 fractional variants show their size as one tag on Find, the aisle lists, Needs a look, Report a loss and Pack. |
| NAV-02 | P1 | `store.html`: new `navArm()` (one history entry in front, re-armed after each Back), a `popstate` handler that runs `stBack()` (sheets, `leaveGuard`, pop, tab → Today), `SHEET.leaveapp` on Today, Leave → `history.back()`. Skipped in the APK, where Capacitor's back button already calls `stBack`. | Phone and browser Back walk the app's own stack. | yes | Stock → aisle → item, then Back walks back to Stock with no reload. Back on a filled Report a loss asks "Leave this report?". Back on Today asks "Leave Omni-ware?". |
| NAV-04 | P1 | `store.html`: Find's `stOf` (draft → "Quote · not confirmed", awaiting goods → "Buying", someone else's → "Joy's", all → `orderview`); new `PAGE.orderview`; `PAGE.pack` and `openPack` send a non-packable order (draft, awaiting goods) to `orderview` | Only orders the yard can act on open Pack. | yes | #0548 can't be packed from the phone. |
| NAV-04 | P1 | `store.html`: `packFrom` / the pack hint (a bought-in line not yet in says "Not in yet · coming from …", not "Only 0 on the shelf"; a shelf line uses the shelf, books less what has left); the pack dock button (red only when the pick equals the line; otherwise "Pack short · n of m", amber, an explicit choice) | Never "Pack 0" as the main action. | yes | P042::0 shows its shelf (27). No screen offers "Pack 0" as the red button. |
| REL-05 | P2 | `store.html`: `slDone` (all three variants), `pkDone` (title "Packing #…" and spinner while `ui.wait`), `dvDone` (already "Delivering…") | No green before the server's yes. | yes | No green tick before the server confirms on hand over, delivery and pack. |
| NAV-05 | P2 | `store.html`: Find's order rows all carry an action (`orderview` for buying, quote and someone else's) | No dead rows. | yes | Every order row in Find opens a screen. |
| NAV-06 | P2 | `store.html`: `fdNorm` (`4x20`, `4×20`, `4 x 20` → `4*20`), `fdHit` (a one-letter typo also against the word one shorter: "hindge" ~ "hinge"), `didYouMean(q)` (the nearest shop words, at most 2, within 2 letters), Find's empty state. `0163`: P550 "Silcone Clear" → "Silicone Clear". | Forgiving search. | yes | "hindge", "4x20" and "silcone" find the right items. |
| NAV-07 | P3 | `store.html`: `PAGE.find` (no 60-row cap, so the counts equal the rows; chips hidden until there is a query) | Counts match. | yes | The counts match on "e", "hinge" and "4*20". |
| NAV-08 | P3 | `store.html`: `PAGE.aisle` (a sticky compact bar shown once the hero scrolls off, from a scroll listener on the page; a "back to the top" button) | Back stays in reach. | yes | On Aisle E, scrolled to row 60, Back is one tap away. |

### NAV-06: data fix (for approval)

| ID | Now | Proposed |
|---|---|---|
| P550 | Silcone Clear | Silicone Clear |

Matched by id and name, like 0161. It stays in Furniture with the other adhesives, as you approved in round 1.

## Not changing / pushed back

| ID | Why |
|---|---|
| NAV-03 ("1¼") | The size stays as the shop typed it ("1 1/4""), one tag. Rewriting it as "1¼" would make Find miss "1 1/4". |
| NAV-02 (a history entry per screen) | One entry in front, re-armed after every Back, does the same job without the history growing with every tap, and it keeps the leave-confirm sheets in charge. Forward is not supported, which an app has no use for. |

## Risks

- **History in an installed PWA.** Some Android browsers treat the first Back after load as "leave the site" if no entry was pushed yet. The entry is armed on first load, so the very first Back is caught.
- **No row cap in Find.** "e" lists every match (about 180 rows). The search is debounced; if it is slow on an old phone, the next round can page it.
- **The quote view reads Sales' draft.** It shows lines only. No prices, as everywhere on the Store phone.

## Questions for Kevin

1. **The brief stops at NAV-08's acceptance check.** Please resend the rest, and NAV-01 if there is one.
2. **Back on Today:** "Leave Omni-ware?" with Stay / Leave (drawn), or should Back on Today do nothing?
3. **0163:** OK to rename P550 to "Silicone Clear"?

## Phase B result (filled after implementing)

| ID | Done? | What changed (function names) | How verified |
|---|---|---|---|
| NAV-03 | Yes | `prodTT` splits a variant on " / " only (the way `variantLabel` joins it). No other place splits a variant. | `1 1/4"` reads as one tag on Find, the aisle list and Pack in the harness at 360 (`#r4`); test `store-round4`. |
| NAV-02 | Yes | `navArm` (one history entry, put back by `afterRender` and `closeSheet`), a `popstate` handler that runs `stBack`, `SHEET.leaveapp` / `ACT.leaveapp`. Skipped in the APK (`NATIVE_BACK`). | Harness: Stock → aisle → item, then browser Back three times walks item → aisle → Stock → Today with no reload; a fourth Back opens "Leave Omni-ware?". A filled Report a loss goes through `leaveGuard` as before. |
| NAV-04 | Yes | `orderBuying` (awaiting goods, or preparing but still waiting on a bought-in line and not started, as Today's lists already treat it), `orderLookOnly`, new `PAGE.orderview` (buying, quote, someone else's), `openPack` and `PAGE.pack` send look-only orders there; the pack dock: red only for the full line, amber "Pack short · n of m", grey "Waits for the goods" (disabled, and `ACT.pkok` refuses) with "Not in yet · coming from …". | Harness: #0042 (buying) and a quote open the order view, never Pack; #0048 Cement reads "13 of 20 on the shelf" with an amber "Pack short · 13 of 20"; a bought-in sheet not yet in reads "Not in yet · coming from Namanve Sheets". |
| REL-05 | Yes | `slDone` (all three variants), `lrSent` and `agDone` say "Handing over…" with the spinner while the write is held; `pkDone` says "Packing #…" with the spinner and the packed grid faded. `stateDot` takes a size. `dvDone` already said "Delivering…". | Harness: each screen with `wait` shows no tick; after the server's yes it shows the green tick and "Handed over to Peter" / "#0048 is packed". |
| NAV-05 | Yes | Find's `stOf`: every order row has an act: Buying, Quote and someone else's → `orderview`; On the road → the On the road page (`troad`), already drawn. | Harness: every order row in Find for "kato", "0045" and "0049" carries an act; test checks `stOf` has no empty act. |
| NAV-06 | Yes | `fdNorm` (`4x20`, `4×20`, `4 x 20` → `4*20`), `fdHit` (also against the word one letter shorter), `didYouMean` (nearest shop words within 2 letters, cut to the length typed; at most 2), Find's empty state. Migration `0163` renames P550. | Test compiles the real search: "hindge" → the hinges, "4x20" → the two 4*20 screws (not 4*25), "silcone" → Silicone Clear, "hngie" → "Did you mean hinge". 0163 run twice on Postgres: only P550 renamed, still in Furniture. |
| NAV-07 | Yes | `PAGE.find`: no 60-row cap; the chips show only with a query. | Harness: the "All" count equals the rows on "e", "hinge" and "4*20"; no chips on the empty Find. |
| NAV-08 | Yes | `PAGE.aisle`: `.cv-stick` (Back, letter, name, rows in view) once the hero scrolls off, `.cv-totop` button, `stickSync`, `ACT.totop`; a long aisle pads its end so the last rows clear the button. | Harness at 360 and 1280: a 70-row aisle scrolled to row 60 shows the bar with Back at the top (44px) and "70 items · 57–68", and the round button bottom right. |

Not changed from the plan: "On the road" in Find opens the existing On the road page rather than a fourth order-view state, since the OrderView board drew three.
