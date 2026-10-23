# Store · Round 9: Speed   (brief received 23 Oct 2026, build 23 Oct 2026 22:58 UTC)

**Canvas:** https://claude.ai/artifact/LVsyQEintezbVH3qn4cSVi, row "Audit round 9 · speed" (bottom of the canvas, version 113). As in round 8, the boards are the real screens from the harness with each change applied there as a prototype; `store.html` is not changed.

**Migration:** **0166** (0165 is taken by Sales round 1). It splits the snapshot into what changes all day and what doesn't, so the 45-second refresh stops downloading the catalogue again. The live measurement is below.

**Do not regress (round 8):**
- Big text scales the tokens;
- section labels are headings;
- the shop check retries;
- cached Today paints at about 0.8 s;
- lists end clear of the play button on Today and Stock.

## Speed: before and after

Before = Cowork's measurements on the live build, on a desktop. After = filled in Phase B, measured the same way (harness first, then Cowork).

| Measure | Before | Target | After |
|---|---|---|---|
| Cached Today on screen | 0.8 s | ≤ 0.8 s; also with no signal | |
| Fresh data on screen | 4.5 s | ≤ 2 s | |
| Opening with no signal | does not open | cached Today ≤ 1 s | |
| Find, one keystroke ("screw", 118 rows) | 57–112 ms | < 16 ms | |
| Alerts render | 11–25 ms | ≤ 16 ms | |
| Other screens' render | 1–5 ms | no worse | |
| Page | 768 KB / 206 KB gzip | no worse; served from the phone after the first open | |
| Snapshot, on opening | 315 KB / 735 ms (Kevin's check: 347 KB) | about 300 KB, once a session | |
| Each 45-second refresh | the whole snapshot (347 KB) + stock, 2 requests | < 200 KB, 1 request | |

## What was found

| ID | Root cause |
|---|---|
| STO-SPD-01 | No service worker. The other apps have one (`agent-sw.js`, `supplier-sw.js`), but those only show pushes. Vercel serves `store.html` with "max-age=0, must-revalidate", so with no signal the browser has nothing to open. The data is safe in IndexedDB, but there is no page to read it. |
| STO-SPD-02 | Typing already waits 220 ms (`ACT['in:fdq']`), but then it calls `render()`. That rebuilds the whole Find page string (box, chips and all 118 rows) and morphs it, so the cost grows with the result count. |
| STO-SPD-03 | `boot()` waits for `getUser()` (a network call, about 1.7 s) before anything else. Then it reads `shop_members`, then calls `loadAll()`, which runs `store_snapshot` and only then reads stock, places, routes and road names. That is four steps one after another. The snapshot is 315 KB. |
| STO-SPD-04 | The header pill shows "Live" whenever the phone is online (`online()`), even before this session's first fresh load has come back. |
| STO-UI-03 | Today and Stock end clear of the button (round 8). Returns, Alerts and the aisle lists open as pages over the bar, so the button is not on screen there. The harness's `elementFromPoint` at the button's centre returns the page, not the button. The brief's "row bottom 718 px vs button top 662 px" compares boxes, not what is visible. |
| STO-A11Y-03 (still open) | A contrast scan of every text on the brief's screens finds the real fails. None of them is the Pack card's "1 of 2" pill, which is 5.5:1 since round 8. **The fails:** Pack's header count "0 /2", grey `#8D99B5` on the navy, 3.95:1; the bar's "Today"/"Stock" words when not selected, `#767F91` on white, 4.03:1; the Alerts times, `#9AA1AE`, 2.47:1. |
| STO-UI-10 (still open) | At 360 × 740 the slip ends 52 px clear of the panel when scrolled (round 8). On a short phone (360 × 600) the hero and the pinned panel leave almost no room, so the slip is mostly behind the panel at rest. |

## Design changes (canvas)

| ID | Board(s) | Before → After | States drawn | Tokens/components used | New component? |
|---|---|---|---|---|---|
| STO-SPD-01, STO-SPD-04 | `Store · Opening · states` | **Before:** "Live" from the first frame; no signal means no app. **After**, all on the status pill: "Updating…" while the saved copy shows; "Updating · saved 7:52" when the copy is more than 10 min old; "Live" only after a fresh load; "Offline" when opened with no signal, with the "No signal · keep working" card and the saved copy working. A new build shows a navy "Update ready · A newer Store app is here · Reload" bar at the top of Today. | Updating, Updating (old), Live, Offline, Update ready | status pill (round 7), the offline card, navy card, white button | No (the update bar is the navy card with one white button) |
| STO-SPD-02 | `Store · Find · first 30` | **Before:** every match drawn on every key. **After:** the first 30 rows, then "Show 30 more" at the end of the list. The search box and chips are not redrawn while typing. | before, after (scrolled to the end) | list rows, the white outline button | No |
| STO-UI-10 | `Store · Hand over · short phone (360 × 600)` | **Before:** the pinned panel sits on the slip. **After:** when the slip and the panel do not both fit, the panel follows the slip in one scroll, so the slip is seen whole first. Where both fit, the panel stays pinned as now. | before, after at rest, after scrolled | slip, dark panel | No |
| STO-A11Y-03 | `Store · Contrast · small text` | **Pack header count:** navy-ink on navy, 5.8:1 and up. **The bar's words:** ink-2 on white, 5.5:1. **Alerts times:** ink-2, 5.5:1. | Pack before/after, Alerts before/after | `--c-navy-ink`, `--c-ink-2` | No |

## Code changes planned

| ID | Sev | File / function | Change (one line) | UI? | Acceptance check |
|---|---|---|---|---|---|
| STO-SPD-01 | P2 | **new** `store-sw.js` (scope `/store.html`) + `store.html` `registerStoreSW()` | **Caching:** the page is served stale-while-revalidate, and the background copy is compared with the cached one; supabase.js (pinned version), Google Fonts and `manifest-store.json` are cache-first. **Never cached:** requests to the Supabase project (`*.supabase.co`) are never handled; the IndexedDB snapshot stays the one copy of the data. **Update:** a changed page posts "update" to the app, which shows "Update ready · Reload". **Registration:** only on https, so not in the harness on `file://` or in a native shell. | yes | **Harness**, over a local http server: load once, cut the network, reopen; Today with the saved copy and "Offline" appears within 1 s. Then change `store.html` on the server and reopen: "Update ready" appears, and Reload shows the new build. |
| STO-SPD-02 | P2 | `store.html` `PAGE.find`, `ACT['in:fdq']`, new `findResults()` | Typing waits 120 ms, then redraws only the results block (`data-live="fdres"`) from a memoised search (`memo` keyed by query and filter). The first 30 rows are drawn, with "Show N more" adding 30 at a time. The box and chips are left alone, so the caret and characters stay put. | yes | **Harness** with a 120-row fixture: a keystroke costs < 16 ms (`performance.now` around the handler and the redraw), and 10 characters typed at 30 ms intervals all land. |
| STO-SPD-03 | P3 | `store.html` `boot()`, `loadAll()` | **Session:** start from the stored session (`getSession`, no network); `getUser()` checks it in the background, and a refused session signs out. **Parallel reads:** `readMembers()`, `store_snapshot` and `stock` run together, using the shop the phone last opened; if the membership answer disagrees, the copy is dropped as now. **Places, routes, road names:** read after first paint, in the background; only Load and the ride use them. | no | **Harness**, with each request delayed to Cowork's timings (auth 1.7 s, members 0.27 s, snapshot 0.75 s, the rest 0.3 s): fresh data on screen within 2 s, against 4.5 s now. |
| STO-SPD-04 | P3 | `store.html` `viewToday` status pill, new `S.freshAt` | `S.freshAt` is set only by a successful `loadAll()` or `refreshLive()`. Before that, the pill reads "Updating…" (or "Updating · saved H:MM" when `S.loadedAt` is more than 10 min old); after it, "Live"; with no signal, "Offline". | yes | **Harness:** with the snapshot delayed 2 s, the pill reads "Updating…" until it lands, then "Live". |
| STO-A11Y-03 | P3 | `store.html`: Pack header count, `.st-nav` button colour, `.cv-at` | Navy-ink for the count; ink-2 for the bar's words and the Alerts times. | yes | The contrast scan (all text on Today, Stock, Pack, Hand over, On the road, Returns and Alerts) finds nothing under 4.5:1 for small text. |
| STO-UI-10 | P3 | `store.html` `PAGE.slip`: classes on the scroller and the panel; `@media (max-height: 700px)` makes them one scroll | The panel is pinned only when both fit. | yes | At 360 × 600 the slip is seen whole at rest, and the panel follows it. At 360 × 740 nothing changes. |

## Server / SQL changes planned

**What the live check found** (`round-9-snapshot-size.sql`, run by Kevin): the snapshot is **347 KB**.

| Part | Rows | Size | Used by the 45-second refresh? |
|---|---|---|---|
| orders | 107 | 124 KB | yes |
| units | 523 | 69 KB | no |
| products | 146 | 56 KB | no |
| trips | 56 | 46 KB | yes |
| log (stock history) | 160 | 30 KB | no |
| customers | 127 | 11 KB | no |
| suppliers, counts, returns, counted, presets, members, staff and the rest | — | 12 KB | partly |

**What this shows:**
- **Most of the size is downloaded twice for nothing.** `refreshLive()` fetches the whole snapshot every 45 s while Today is open. It keeps only orders, trips, holds, asks, counts, reports, returns, members and me, which is about 185 KB. The other 170 KB (units, products, log, customers and suppliers) is thrown away. Stock comes in a second request.
- **The size is not in one fat key.** Inside an order, `items` is the biggest key at 39 KB over 107 orders; the rest is many small fields. No one cut takes the whole snapshot under 200 KB without dropping something a screen reads.
- **21 days of stock history is too short.** The item page draws 4 weekly bars (`weeksIndex`, 28 days), so 21 days would blank the oldest bar. 28 days keeps all four.

| ID | Migration / function / policy | Change | Test |
|---|---|---|---|
| STO-SPD-03 | **0166**, new `store_live(p_shop)` | **What it holds:** the parts that change all day, the same as `store_snapshot` gives today: orders, trips, holds, asks, counts, reports, returns, members, managers and me. **Stock:** folded in as one `{key: qty}` map, so the refresh is one request. **Access:** the same member check, security definer, granted to `authenticated` only. `refreshLive()` calls it, and falls back to `store_snapshot` + the stock read when 0166 is not there yet. | PG: `store_live` keys = the live parts + `stock`; a non-member gets 42501; no money key in it (the round 5 money scan). |
| STO-SPD-03 | **0166**, `store_snapshot(p_shop)` | **Becomes** `store_live(p_shop)` plus the parts that rarely change (products, units, customers, staff, suppliers, presets, log, counted and agents). So the two cannot drift apart. **Same keys as now, plus `stock`**; `loadAll()` uses the folded stock and drops its own stock read. | PG: the old key set ⊂ the new; the Store tests pass. |
| STO-SPD-03 | **0166**, trims inside the snapshot | **Stock history:** 35 → 28 days, the 4 weeks the item page draws. **Delivered orders:** 35 → 30 days, the window Returns offers (`returnableOrders`). **Voided trips:** gone after 14 days, as voided orders already are. **Units:** no `id` (the app never reads it), and empty fields left out (every reader defaults them). | PG scenario: an order delivered 32 days ago and a trip voided 15 days ago are not in the snapshot; one delivered 29 days ago is. |
| STO-SPD-03 | 0166 house rules | Safe to run twice (`create or replace`); ROLLBACK block (0164's `store_snapshot` again, `drop function store_live`); CHECK block (both functions exist, `store_live` is not granted to `anon`); a row in `docs/decision-rights.md`. No role, task or push changes. | `test/decision-rights.test.js` |

**Expected after 0166:** the refresh drops from 347 KB + the stock request to about 185 KB in one request, and the opening snapshot to about 330 KB, once per session. With the service worker, that opening load comes in behind the saved copy rather than in front of it. Cowork should also compare `transferSize` with `decodedBodySize`: the snapshot is repeated JSON keys and is probably compressed on the wire to a fraction of 347 KB.

## Glossary changes

| Term | Meaning | Replaces |
|---|---|---|
| Updating… | Showing the copy saved on this phone while the fresh one comes; "· saved H:MM" when it is more than 10 min old | "Live" before anything fresh has arrived |
| Live | This session has loaded fresh data, and the phone is online | — |
| Update ready · Reload | A newer Store app has been downloaded; one tap switches to it | a silent change on the next open |

## Not changing / pushed back

| ID | Why |
|---|---|
| STO-UI-03 (Returns, Alerts, aisle lists) | Those screens are pages that cover the bar; the play button is not on screen there (`elementFromPoint` at its centre returns the page). Their last row is already reachable, and each page ends 24 px or more above the screen's bottom edge. Adding the bar's 120 px there would leave an empty band under every list. To confirm, please ask Cowork to check what is at the button's position (`elementFromPoint`), rather than comparing boxes. |
| NAV-08 | Still open: the aisle has a sticky header; the other long lists are not named. |
| NAV-09 | Still open: removing a waiting item, and restoring the screen on reload. These belong to reliability or navigation, not speed. |

## Risks

- **A service worker that serves an old page.** The page is always revalidated in the background, the worker never touches API calls, and Reload is one tap. The worker's own file is checked by the browser on each open. A broken worker can be removed by publishing a `store-sw.js` that unregisters itself.
- **`store_live` before 0166 is pasted.** The page falls back to `store_snapshot` + the stock read, so it works with or without the migration, in either order.
- **Starting from the stored session** shows the saved copy a moment before the server confirms the login. A refused session signs out, as now; nothing is written before the check.

## Questions for Kevin

1. ~~The snapshot size~~: answered (347 KB, see above). The stock history window is now **35 → 28 days**, not 21, because the item page draws 4 weeks. "Go ahead" covers this.

## Phase B result (filled after implementing)

| ID | Done? | What changed | How verified |
|---|---|---|---|
| STO-SPD-01 | | | |
| STO-SPD-02 | | | |
| STO-SPD-03 | | | |
| STO-SPD-04 | | | |
| STO-UI-03 | | | |
| STO-A11Y-03 | | | |
| STO-UI-10 | | | |
