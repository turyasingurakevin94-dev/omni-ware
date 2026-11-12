# 04 · Screens — Store: the routes

What this covers: one route id per board family of the approved canvas "Store — in the agent app's language" (`docs/canvas/store-agent/`), the boards each id draws, and where it lives (tab, pushed screen or stage sheet). The builders use these ids in links, in the push map and in the parity specs (`test/parity/store-*.json`).
Date: 2026-11-11
Status: **decided with the canvas** (the ids are new; the boards are approved). Read with [`04-screens-store.md`](04-screens-store.md).

---

## 1. How the Store app is laid out

| Part | What it is | Boards |
|---|---|---|
| The tab bar (P16) | **Today · the red centre button · Shelf**. The red centre is not a route: it opens the first of the day's jobs (`nextJob`, aria-label "Start the next job"), with a badge of jobs waiting | every Today and Shelf board |
| Tabs | `today` and `shelf` | TD01, SH01 |
| Stage sheets | The agent's "Packing 7" sheet: a rail **Coming in · To pack · To load · On the road · Delivered** over Today. They are routes, so a push or a tile can open them | PK01, IN01, OU01, OU20 |
| Pushed screens | Everything else: one job on screen, Back walks the stack | — |
| Sheets inside a screen | Not routes (as Sales' `ROUTES.md`). They open with `sheet.open(...)` in their own area's code; another area calls them through an exported function (§4) | IN04, OU31, the "Not on the list" picker, the no-photo reasons |

A route id belongs to one **area** (the canvas page: Today, Pack, Goods in, Shelf, Out); that area's builder registers it in its own `index.tsx`, as in `src/apps/sales/shell/ROUTES.md`. To add a cross-area entry, add a row here in the same commit.

## 2. The routes

33 ids for the 149 screen boards (142 approved, 7 added while building: AD01–AD07). The default board is first; the rest are its states.

### Shell (sign-in and boot, owned by `shell`)

| Id | Params | Kind | Boards |
|---|---|---|---|
| `shell/sign-in` | — | full screen, no tab bar | TD20 (default), TD23 sending, TD31 wrong email or password |
| `shell/checking` | — | over Today's skeleton | TD21 |
| `shell/no-reach` | — | full screen | TD22 (Try again · open the copy saved 7:52 · Sign out) |

### Today (area `today`, tab)

| Id | Params | Kind | Boards |
|---|---|---|---|
| `today` | — | tab | TD01 (default), TD09 scrolled, TD02 next job is a check-in, TD03 next job is a ride, TD04 calm (Close the yard), TD05 first day, TD06 offline, TD07 load failed, TD08 update ready, TD33 Next job pressed; on the colleague's phone TD15 (Musa passed you the yard), TD25 I've got it sending, TD32 the yard is yours |
| `today/alerts` | — | pushed | TD10, TD29 empty |
| `today/with-ruth` | — | pushed | TD11, TD30 empty |
| `today/you` | — | pushed | TD12 |
| `today/pass-yard` | `{ to? }` (a staff id; Okello prefilled) | pushed | TD13, TD18 sending, TD14 sent, TD24 nobody else, TD26 failed |
| `today/close-yard` | — | pushed | TD16, TD19 sending, TD17 closed, TD27 offline, TD28 disabled (3 of 4) |

### Pack (area `pack`)

| Id | Params | Kind | Boards |
|---|---|---|---|
| `pack` | `{ first? }` (an order id to put at the top, from a push) | stage sheet | PK01 (default), PK20 offline, PK08 For you, PK13 someone else just did this, PK14 empty, PK21 waits for the goods |
| `pack/order` | `{ id, line?, unpack? }` (`unpack`: the order on its bay with the Unpack sheet, from PK06's bay tile) | pushed | PK02 (default, line 2 of 3), PK03 pressed, PK18 sending, PK11 offline, PK12 failed, PK04 short, PK16 short sending, PK19 short failed, PK05 short sent, PK06 packed, PK07 packed pickup (Ready to collect), PK15 unpack; added while building: AD02 the unpack sheet (from the order on its bay once the 10 s Undo has passed: Keep it packed / Unpack), AD05 unpacked (Undo), AD06 unpack not saved |
| `pack/look` | `{ id }` | pushed | PK09 the copy (#0557), PK17 Okello's (#0556) |
| `pack/put-back` | `{ id }` | pushed | PK10 cancelled · put it back, PK22 put back failed |

### Goods in (area `in`)

| Id | Params | Kind | Boards |
|---|---|---|---|
| `in` | — | stage sheet | IN01 (default), IN40 empty |
| `in/checkin` | `{ trip }` (any trip id of the trip; its stops come together, §3) | pushed | IN02 (default), IN03 a line differs, IN04 Not on the list (sheet), IN16 extra sending, IN05 sending, IN06 checked in, IN07 offline, IN08 failed, IN09 someone else, IN13 Ruth: keep it |
| `in/delivery` | `{ trip }` (a supplier delivery: `assigned_worker_id = '__supplier__'`) | pushed | IN10, IN11 differs (4 torn), IN14 sending, IN12 done, IN15 offline |
| `in/return` | `{ order }` | pushed | IN20, IN23 sending, IN21 sent, IN22 Ruth decided, IN24 offline, IN25 failed |
| `in/ride` | `{ trip? }` (none: the trips Denis sent this person) | pushed | IN30, IN31 hand in, IN34 sending, IN32 done, IN33 offline, IN35 failed |

### Shelf (area `shelf`, tab)

| Id | Params | Kind | Boards |
|---|---|---|---|
| `shelf` | — | tab | SH01 (default), SH41 offline, SH06 nothing needs a look |
| `shelf/aisle` | `{ aisle }` (the category name; the letter moves when aisles do) | pushed | SH04, SH05 no aisle yet |
| `shelf/find` | `{ q? }` (kept in the params when the list is left, so Back lands on the search) | pushed | SH02, SH42 nothing found |
| `shelf/scan` | `{ then?: 'item' \| 'count' \| 'report' \| 'checkin' }` | pushed | SH40 |
| `shelf/item` | `{ key }` (`productId` or `productId::variantIdx`, `store.html:1700`) | pushed | SH03 (default), SH16 count accepted, SH22 Ruth wrote off, SH24 Ruth kept it, SH32 ask answered |
| `shelf/count` | `{ key }` (a spot count) or `{ aisle }` (an aisle count) | pushed | SH10 (default), SH19 pressed, SH11 sending, SH12 sent, SH13 count it again, SH15 a count already waiting, SH17 failed, SH18 kept, SH25 someone else; SH14 the aisle count |
| `shelf/report` | `{ key, why?: 'damaged' \| 'lost' \| 'stolen' }` | pushed | SH20, SH21 sent, SH23 nothing on the shelf, SH26 not sent, SH27 failed |
| `shelf/ask` | `{ key }` | pushed | SH30, SH31 sent |

### Out (area `out`)

| Id | Params | Kind | Boards |
|---|---|---|---|
| `out/load` | — | stage sheet | OU01 (default), OU30 empty; OU31 name a direction is its sheet (§4) |
| `out/run` | `{ dir, driver?, go?, hired? }` (the direction's key: its farthest place, `store.html:4444`; To load's slide passes its driver and `go`; `hired` opens OU03) | pushed | OU02 (default), OU03 hired, OU17 slide pressed, OU04 sending, OU05 loaded, OU06 not sent, OU07 failed; added while building: AD01 Someone new (the hired sheet's name, plate, phone), AD03 filled, AD04 phone not a mobile |
| `out/gate` | `{ id? }` (none: everything ready to collect) | pushed | OU10 (default, 10:47), OU08 sending, OU12 handed over, OU13 not paid yet, OU15 empty, OU16 offline; added while building: AD07 every order there held by money (the first as the top card, locked: "Stays until paid", a tap opens OU13; OU13's Close lands here) |
| `out/gate-code` | `{ id? }` | pushed | OU11 the agent's code, OU09 wrong code |
| `out/road` | — | stage sheet | OU20 (default), OU14 empty, OU25 offline, OU27 cancelled on the truck |
| `out/door` | `{ id }` | pushed | OU21 (default), OU26 sending, OU22 delivered, OU23 no photo, OU28 not sent |
| `out/cant-deliver` | `{ id }` | pushed | OU24 |

Not routes: the summary boards `IB01Handovers`, `IB02StateWords`, `FL01Taps` (the integration page).

## 3. Rules for links

- **A control opens THAT order's, THAT trip's or THAT item's own screen** (the Sales ruling, `docs/canvas/sales-agent/BRIEF.md`). A stage sheet opens only from its tile, the Next job, or a push about the list.
- **An order with nothing to do here opens `pack/look`**: a quote, one waiting on goods, one someone else is packing (NAV-04, `store.html:4069 orderLookOnly`). Find's order rows open the order's own screen by its stage: To pack and Packing → `pack/order` or `pack/look`; Packed → `out/load`'s row; Ready to collect → `out/gate { id }`; On the road → `out/road`; Delivered → `pack/look` (SH02 links stand-ins OU01, OU20, IN01, the designer's note: no order sheet is drawn; see `04-screens-store.md` §2 for drawing one).
- **A trip of several stops is one check-in.** `in/checkin { trip }` takes any stop's id and gathers the stops of the same trip (the same id stem and runner, `store.html:1569 tripRoundKey`; the server's `ow_trip_round`, 0147).
- **Every flow ends on one button, "Back to Today"** (or the real next job), which is `nav.home()`, never a pushed `today`.

## 4. Exported sheets

| Function | Owner | Boards |
|---|---|---|
| `openNameDirection(dir)` | out | OU31 (from OU01's "Name it"; `dir` is load.ts's Direction) |
| `openNotOnList(trip)` | in | IN04 (from the check-in; also from the scanner, SH40, when the label is not on the trip) |
| `openNoPhoto(books, order, onGo)` | out | OU23's reason tiles over OU21 (`onGo(why)` delivers with no photo) |
| `openHired(dir, books, chosen, onPick)` | out | OU03, over the run (`out/run { dir, hired: true }` opens it too); its "Someone new" step is AD01, AD03, AD04 (name, plate, phone; writes nothing, the load's slide keeps him) |
| `openUnpack(order)` | pack | AD02 over the packed order on its bay (PK06's bay, To load's Packed row); AD05 done, AD06 not saved |
| _(add as built)_ | | |

## 5. A tapped push opens a route

One map (`shell/pushes.ts` in the new app, as Sales'), from the push's kind and data. A tap never takes an order (`store.html:2696`). With no signal the route opens on the phone's copy and reads behind it (spec 06 §6a, as the new Sales app does). The kinds and words are IB01's (`04-screens-store-data.md` §6).

| Push kind | Opens | Board |
|---|---|---|
| `order.pick` (new, given, or all in) | `pack { first: id }`; `pack/order { id }` only when the order is already this person's | PK01, PK08 |
| `order.copy` | `pack/look { id }` | PK09 |
| `order.cancelled` | in the yard: `pack/put-back { id }`; on a truck: `out/road` | PK10, OU27 |
| `trip.back` | `in/checkin { trip }`, else `in` | IN02 |
| `trip.sent` | `in/ride { trip }` | IN30 |
| `trip.taken`, `trip.cancelled` | `today` | TD01 |
| `trip.difference.decided` | `today/with-ruth` | TD11 |
| `store.ask.decided` | an extra: `in/checkin { trip }` (IN13); a restock: `shelf/item { key }` (SH32); a handover: `today/pass-yard` (TD14 "Okello has it") | |
| `store.handover` | `today` (the "I've got it" card) | TD15 |
| `pick.settled` | `today/with-ruth` (answered) — no board draws its own screen | TD11 |
| `credit.ask.decided` | a pickup: `out/gate { id }`; else `out/load` | OU13, OU01 |
| `job.given` | on the road with this person: `out/door { id }`; else `out/load` | OU21 |
| `order.moved` | `today/alerts` | TD10 |
| `return.coming` | `in` | IN01 |
| `invoice.ask.decided` | `in/return { order }` | IN22 |
| `stock.count.decided` | `shelf/item { key }` | SH16 |
| `stock.recount` | `shelf/count { key }` (or `{ aisle }`) | SH13 |
| `stock.report.decided` | `shelf/item { key }` | SH22, SH24 |
| anything else | `today` | |

`test/store-push-routes.test.js` (to write with the shell) checks every id this map opens is in §2.
