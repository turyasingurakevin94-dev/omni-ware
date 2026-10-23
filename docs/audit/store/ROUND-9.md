# Store · Round 9: Speed   (brief received 23 Oct 2026, build 23 Oct 2026 22:58 UTC)

**Canvas:** https://claude.ai/artifact/LVsyQEintezbVH3qn4cSVi, row "Audit round 9 · speed" (bottom of the canvas, version 113). As in round 8, the boards are the real screens from the harness with each change applied there as a prototype; `store.html` is not changed.

**Migration:** possibly **0166**, to trim the snapshot, once its size is measured on live (Q1). 0165 is taken by Sales round 1.

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
| Snapshot | 315 KB / 735 ms | < 200 KB | |

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

| ID | Migration / function / policy | Change | Test |
|---|---|---|---|
| STO-SPD-03 | **check first:** `docs/audit/store/round-9-snapshot-size.sql` (read-only) | Shows each part of the snapshot and the heaviest order payload keys, as the shop's Store login. | — |
| STO-SPD-03 | **0166** (only if Q1 says so), `store_snapshot` | Trim what the check shows is heaviest and unused. **Candidates:** the stock history window, 35 → 21 days (the item page shows 8 moves); customers limited to those on orders in the snapshot; `stock` folded in, to save one request. Safe to run twice, with ROLLBACK and CHECK blocks. | The PG scenario: same keys, smaller; the Store tests pass. |

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
- **Starting from the stored session** shows the saved copy a moment before the server confirms the login. A refused session signs out, as now; nothing is written before the check.

## Questions for Kevin

1. **The snapshot:** please run `docs/audit/store/round-9-snapshot-size.sql` (read-only) and paste the two result tables. If it is over 200 KB, I'll trim the heaviest parts in 0166. The first candidate is the stock history window, 35 → 21 days. Is that OK?

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
