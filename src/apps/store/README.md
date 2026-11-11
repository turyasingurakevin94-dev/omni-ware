# The new Store app — for the area builders

Built to the approved canvas `docs/canvas/store-agent/` (boards at 360 × 800, `FACTS.md` the sample day) and the spec `docs/spec/04-screens-store.md`, `-routes.md`, `-data.md`. The foundation (shell, core, demo, build, parity) is in; each area fills its own folder.

## Where your screens go

| Area | Folder | Route ids (routes §2) |
|---|---|---|
| Today (and the shell's boot screens) | `today/` | `today` (its frame is in: `today/Today.tsx`), `today/alerts`, `today/with-ruth`, `today/you`, `today/pass-yard`, `today/close-yard`, `shell/sign-in`, `shell/checking`, `shell/no-reach` |
| Pack | `pack/` | `pack` (stage sheet), `pack/order`, `pack/look`, `pack/put-back` |
| Goods in | `in/` | `in` (stage sheet), `in/checkin`, `in/delivery`, `in/return`, `in/ride` |
| Shelf | `shelf/` | `shelf` (tab), `shelf/aisle`, `shelf/find`, `shelf/scan`, `shelf/item`, `shelf/count`, `shelf/report`, `shelf/ask` |
| Out | `out/` | `out/load` and `out/road` (stage sheets), `out/run`, `out/gate`, `out/gate-code`, `out/door`, `out/cant-deliver` |

- Export the screen from your folder's `index.tsx`: `export const screens = { 'pack/order': { view: ({ params }) => <PackOrder id={Number(params.id)} /> } }`. Until you do, the shell draws a placeholder naming the route and its boards (`shell/Placeholder.tsx`).
- A **stage sheet** draws inside `<StageSheet id="pack" title="To pack" count={1} sub="…" chips={…}>…</StageSheet>` (`shell/StageSheet.tsx`): the strip, the navy head, Close and the rail are done.
- Move with `nav` (`shell/nav.ts`): `nav.push(id, params)`, `nav.back()`, `nav.replace(id)`, `nav.home()` ("Back to Today" ends every flow). Ids only from `shell/routes.ts`; a new id goes in the routes spec and that table in the same commit.
- A sheet inside your screen is not a route: `sheet.open(...)` (`src/ui/sheet.tsx`); export a function when another area opens it (routes §4).
- Compose from `src/ui` (`src/ui/README.md`). Added for the Store: `Hero` `bell` and `children`, `TabBar` `plusIcon="play"`, `Notice kind="failed"`, icons `play` and `shelf`.
- Files of 200–500 lines; none over 1,000. One rule, one place: a rule two screens need goes in `src/core/store/`, never copied.

## The state and the writes (`shell/store.ts`)

Read the signals: `books` (the yard, `YardBooks`), `session`, `me` (the holder's staff id), `now`, `status` ('live' | 'updating'), `online`, `kept` (Waiting to send), `notDone`, `held`, `updateReady`.

Write only through:
- `act('checkIn', lines)` — any StoreSource write by name, through the outbox; a live read follows. No signal: resolves `{ kept: true }` and the amber bar says so. Refused: the bar says it in plain words and Try again resends; the promise rejects so the screen keeps its work.
- `hold('Packed #0552', 'finishPack', [552, 1], undo)` — a write that waits 10 s with Undo (the toast). It goes at once when the screen changes or the app is put away.

The bars (`shell/App.tsx` `Bars`) sit above the tab bar: amber "No signal · N waiting to send", red "That did not save · tell Kevin / code CI-502 · your work is kept", blue "Someone else just did this · Refreshed". A screen with a dock draws them itself: `{ view, bars: false }` and render `<Bars />` over the dock.

## The rules you read (`src/core/store/`)

- `yard.ts`: `stageOf`, `stageWord` (IB02's Store words), `counts`, `ordersAt(b, stage, me, now)`, `isPickup`, `destinationOf` (deliverTo first), `moneyHeld`, `NOT_PAID`, `onATruck`, `isCancelled`, `awaitsGoods`.
- `keys.ts`: `stockKey`, `countPlace`, `tripRoundKey`, `roundsOf`, `lineKey`, `msOf`. `errors.ts`: `notDone`, `notDoneLine`. `held.ts`: `Held`.
- Written by Today: `jobs.ts` (the day's jobs: `yardJobs`, `nextJobs`, `needsYou`, `badge` — the red button, through `shell/next-job.ts` — `doneToday`, `waitingOnOthers`), `counts.ts` (`countDue` at 21 days, `aislesDue`, `aisleLetter`, `FRESH_DAYS` 14 for the ring: screens Q10 open), `shift.ts` (`mates`, `passPlan`, `closeChecks`, `baysTonight`), `ruth.ts` (`withRuth`), `outbox.ts` (`keptLine`, Waiting to send's words), `faces.ts` (`personFace`, `orderFace`, `whoIs`).
- Still to write, by the area that needs it (spec §4 names the file): `pack.ts`, `bays.ts`, `checkin.ts`, `returns.ts`, `ride.ts`, `load.ts`, `gate.ts`, `door.ts`, `shelf.ts` (the shelf figure), `report.ts`, `restock.ts`, `find.ts`.

## The source (`src/core/store/source.ts`)

Reads: `session`, `snapshot` (store_snapshot), `live` (store_live), `order` (store_order), `side` (places, routes, road names), `waitingCount`, `countArrived`.
Writes (data §3): `claim` W1 · `pick` W2 · `finishPack` W3/W3' · `setBay` W4 · `unpack` W5 · `release` W6 · `putBack` W7 (phone only) · `load` W8 · `handOver` W9 · `deliver` W10 · `askLetGo` W11 · `withdrawLetGo` W11a · `nameDirection` W12 · `lockRoute` W13 · `checkIn` W14 · `notOnList` W15 · `restock` W16 · `reportLoss` W17 · `returnAsk` W18 · `withdrawReturn` W18a · `rideTick` W19 · `rideHandIn` W19a · `sendCount` W20 · `replaceCount` W20a · `passYard` W22 · `gotYard` W22a · `closeYard` W23 · `setMyName` W24 · `pushOn` W25 · `signIn`/`signOut`/`resetPassword` W26 · `cantDeliver` W27. Not here on purpose: W8a, W10a (phone drafts), W18b, W21 (Ruth's app), W28 (Q11).

## The demo at 360 × 800

`npm run build:store`, then serve the repo and open `next/store.html?demo` at 360 × 800 (the parity tool does both). Flags (`src/core/store/demo/flags.ts`):

| Flag | What |
|---|---|
| `&at=1047` · `1130` · `1200` · `1405` · `1510` · `1730` | the later moments of FACTS §8 (each includes those before) |
| `&state=cancel-0530` · `cancel-0534` · `ggaba-closed` · `agent` | the what-ifs (PK10, OU27, OU24, OU11) |
| `&state=empty` · `first-day` · `nobody` | the empty boards, Joy's first day (TD05), nobody to pass to (TD24) |
| `&state=signed-out` · `loading` · `no-reach` | TD20, TD21, TD22 |
| `&as=okello` | Okello's phone: Musa passed him the yard (TD15, TD25, TD32) |
| `&offline` | no signal: the copy saved 7:52, writes kept (amber) |
| `&fail=<write>` (or `snapshot`) | that write fails once with its board code, then Try again goes (red) |
| `&update=1` · `&big=1` | Update ready (TD08) · Big text |
| `&kept=1` (with `&offline`) | two writes already kept on this phone: TD06's Waiting to send |

A reload reopens the same screen (the stack is in sessionStorage `ow-store-view`).

## A parity spec

One file per area, `test/parity/store-<area>.json` (`store-today`, `store-pack`, `store-in`, `store-shelf`, `store-out`), as Sales' (`test/parity/README.md`): `{ "board": "PK02Pack.dc.html", "demo": "&at=1047", "steps": [{ "tap": "Start the next job, 3 ready now" }], "note": "" }`. Steps start at Today and tap as a person would.

```
npm run build:store
NODE_PATH=$(npm root -g) node tools/parity/run.cjs PK02Pack.dc.html test/parity/store-pack.json   # one board
NODE_PATH=$(npm root -g) node tools/parity/run.cjs --tab store-pack                               # an area
NODE_PATH=$(npm root -g) node tools/parity/run.cjs --app store --all                              # every store spec
```

Shots and `results.json` go to `docs/audit/store/parity/`. `test/store-shell.test.js` checks each spec names a board of its area's canvas page.

## Gaps to know

- **The demo draws, the books cannot yet**: a dropped line (`items[].removed` is not in 0182's allow-list: `YardLine.dropped` is always false on the real books), a copy (`copyOf`: no app marks one, data §6d), when a trip is due (`Trip.dueAt`), "on since" (`onSince`), and Alerts (`YardBooks.alerts`: the pushes this phone got are not in the books; the supabase source gives none until the push listener keeps them).
- **The bent sheets on TD01** ("Bent · Iron sheet G28 · found 10:20") have no record until reported: the demo keeps them as `YardBooks.found` (a phone draft, "found while packing"); the real books give none, so the job shows only on the demo until Pack keeps such a draft. With it and aisle C's count, the badge is TD01's 5. A return's "~11:00 at the gate" is `StoreReturn.dueAt`, the demo's only.
- `shell/nav.ts` is the Buyer's stack with the stage sheet and the reload added; moving both apps onto one `src/ui` stack is open work. The greeting is now `core/time.ts` `greeting`; Sales and the Buyer still carry their own copies.
- Not wired yet: the native layer (`src/native`, Back on the phone, the bars, the live update) and a service worker (`sw.ts`, Update ready). The Store has no `shell/native.ts` until its phone app builds the new page.
