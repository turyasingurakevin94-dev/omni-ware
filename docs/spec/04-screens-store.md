# 04 · Screens — Store

What this covers: every screen of the new Store app (`src/apps/store`, `src/core/store`), the rules its boards draw, the audit fixes it keeps, and the questions still open.
Date: 2026-11-11
Status: **screens decided** (the approved canvas). **Questions open** (§3): until Kevin answers, the new app builds what the canvas draws, which is the default listed beside each one.

Read with: [`04-screens-store-routes.md`](04-screens-store-routes.md) (one route id per board family), [`04-screens-store-data.md`](04-screens-store-data.md) (every read and write of `store.html`, and what the new app changes), [`05-data.md`](05-data.md), [`06-offline-sync-push.md`](06-offline-sync-push.md), [`07-stack.md`](07-stack.md), `docs/decision-rights.md`, `docs/audit/GLOSSARY.md`, `docs/audit/store/` (`FLOW.md`, `INTEGRATION.md`, `OTHER-APPS.md`, `STORE-TODAY.md`).

---

## 1. The screens are the canvas

The approved canvas is "Store — in the agent app's language" (https://claude.ai/artifact/8oCrpUTjvjLGqQT4V8rESr). Its source is [`docs/canvas/store-agent/`](../canvas/store-agent/README.md).
- 145 boards: 142 phone screens at 360 × 800, plus the three summary boards on the "Integration & flow" page.
- Every screen scored at or above its matching Agent screen in an independent review (3–4 rounds per area; area means 8.93–9.14 against the Agent's 8.83–9.03; none below), `docs/canvas/store-agent/review/`, scores in `docs/audit/store/GOAL.md`.
- The end-to-end flow takes fewer taps: 99 → 72 across 18 jobs (`FL01Taps`, `FLOW.md` §5).

| Area (canvas page) | Prefix | Boards | Route ids | What it does |
|---|---|---|---|---|
| Today and the shell | TD | 33 | `shell/*`, `today`, `today/*` | the yard at a glance, the Next job, Alerts, With Ruth, You, Pass the yard, Close the yard, sign-in and boot |
| Pack | PK | 22 | `pack`, `pack/*` | To pack (stage sheet), pack one order line by line, Pack short, Packed, Unpack, Look only, Cancelled · put it back |
| Goods in | IN | 29 | `in`, `in/*` | Coming in (stage sheet), check in a trip (blind), a supplier delivery, a return at the gate, ride a trip |
| Shelf | SH | 30 | `shelf`, `shelf/*` | aisles, Find, scan, one item, blind counts, losses, ask for more |
| Out | OU | 28 | `out/*` | To load by direction (stage sheet), load a run, the gate (Hand over, agent code), On the road, the door, can't deliver |
| Integration & flow | IB01, IB02, FL01 | 3 | — | every handover with its push and both apps' words (36), one word per order state (17), taps before and after |

Every board, its title and its route: `docs/canvas/store-agent/manifest/<area>.json` (rows, titles, agent matches, flows, handovers, kept fixes) and [`04-screens-store-routes.md`](04-screens-store-routes.md) §2.

| Where the rest lives | File |
|---|---|
| The design language: the Sales canvas's parts P01–P29 and tokens, plus what the Store adds (the stage sheet, states at 360 px, motion, status words, taps per job) | `docs/canvas/sales-agent/LANGUAGE.md`, `docs/audit/store/agent-design-language.md` |
| The sample day every board draws; the demo is seeded from it | `docs/canvas/store-agent/FACTS.md` |
| The rules the designers worked to (the shell, the lead rulings) | `docs/canvas/store-agent/BRIEF.md` |
| The job, step by step (what was cut, merged, automated) | `docs/audit/store/FLOW.md` |

**Proof that the app matches.** `docs/audit/store/CANVAS-PARITY.md` (to write as each area is built) lists one row per board:
- the board beside the app at 360 × 800, with the app reached by real taps from Today: `tools/parity/run.cjs` on `next/store.html?demo` (the tool is Sales'; the Store build adds its board folder, `next/store.html` and `test/parity/store-<area>.json`, the specs naming the route ids of [`04-screens-store-routes.md`](04-screens-store-routes.md));
- the pixel difference and the screenshots under `docs/audit/store/parity/`;
- the verdict of an independent critic.

## 2. A screen the canvas does not draw

The app sometimes needs a state, sheet, error, empty view or step the canvas does not draw. When it does:
- it is **drawn first**, with `/design`, as one board in the same language, on the same canvas, prefix **AD** (`AD01…`), built only from the existing parts (P01–P29, the Store's stage sheet) and the sample day in `FACTS.md`;
- it gets **one critic round** on the canvas's five axes (Consistency · Steps · Glance · Polish · In step), each at least 8.5, before it is built;
- it is published on the canvas's page **"Added while building"**, and its route is added to [`04-screens-store-routes.md`](04-screens-store-routes.md) in the same commit;
- **if it has no job in `docs/audit/store/FLOW.md`, ask Kevin first**: a screen with no job is a feature, and features are his (CLAUDE.md, "Keep it reasonable").

Nothing is improvised in code. Known candidates, from `store.html` features no board draws (`04-screens-store-data.md` §8): an order's own look-only sheet for Find's delivered and on-the-road rows (SH02 links stand-ins), Release (let go of an order you started), the shop picker (two shops), the password reset, the shelf labels page.

## 2a. Rules a board's figures follow

The sample day is [`FACTS.md`](../canvas/store-agent/FACTS.md): **Sat 17 Oct 2026, 10:41**, Mukasa Hardware, the phone held by **Musa Kiggundu (MK)**, Store lead, the same moment as the Sales canvas (orders, customers, lines and times unchanged from Sales' FACTS). Where a board's figures disagree with `FACTS.md` and the demo seed, **the board is corrected, not the data** (the lead's ruling for Sales, 30 Oct 2026, applied here).

| Rule | Source |
|---|---|
| Later moments are each named on their board: 10:47 (#0555 collected), 11:30–11:34 (Denis's trip in), 12:00 (Hima Cement), 14:04–14:05 (#0552 at the door), 15:10 (the ride to Katwe Timber), 17:30 (Close the yard), and the what-ifs (#0530 cancelled on bay 2, #0534 cancelled on Ssali's truck, #0547 Ggaba closed). The demo opens at 10:41; a parity spec for a later board sets the demo's clock (`&at=HH:MM`) or its state (`&state=`) | FACTS §8 |
| The counts on Today and the stage sheets: To pack 1 (#0556) · Packing now 1 (#0552) · Packed 1 (#0530, not paid yet) · On the road 3 (2 with Ssali, 1 ready to collect) · Delivered today 1 (#0543) · Waiting on goods +2 (#0549, #0546) | FACTS §2 |
| Bays: #0552 bay 1, #0530 bay 2, #0556 bay 3, #0555 at the gate. One order per bay | FACTS §2; manifest `pack.json` |
| No money anywhere: no price, total or amount owed on any board or in the demo seed the phone reads | FACTS (head); GLOSSARY "Money on a phone" |
| A stage sheet has **one head**: PK01's (the shared `shell/StageSheet.tsx`: the 40 px strip, the rounded foot, the rail). IN01 and IN40 were redrawn to it (2026-11-12); a new stage board draws it, not a head of its own | Goods-in critic G1; `docs/canvas/store-agent/review/IN-fixes.md` |
| **Ruling: IN40's "Ask Denis for more" opens Find** (`shelf/find`, SH02), not SH30 (`shelf/ask`) as the board linked: an ask is for one item (SH30 draws the item, its shelf figure and how many), and an empty Coming in names none, so the person picks the item first and asks from it. IN40 is relinked to SH02 | Goods-in critic G2; `in/ComingIn.tsx` |
| Sample gaps the designers filled, to confirm or replace (Q9): #0534's three lines (OU27: Kato's usual), Okello's count (SH25), the "just now" states after 10:41 (SH13, SH16, SH22, SH24, SH25, SH32), the hired drivers Abudu and Juma (OU03), when Ssali's 9:55 run and #0556 were done (#0534 delivered 10:58, #0556 collected 11:45, #0547 delivered 11:50: after TD02's 11:32, before TD03's 15:10; FACTS §8), what Ruth answered by 17:30 (the Wire nails count accepted 16:20, #0557 cancelled 16:30, so TD04 and TD16 carry "1 with Ruth", aisle C's count; FACTS §8), sample error codes (ST-301, CI-502, RT-417, TR-233, SC-502, SR-502, LD-412) | GOAL.md "Waiting on Kevin" 9; manifests `shelf.json`, `out.json` |
| **Earlier moments for the Out area's empty boards**: 9:30 (OU14: Ssali not out yet, #0534 and #0547 packed, To load 3 with #0530) and 10:10 (OU15: #0555 still packing, #0554 and #0556 to pack). The demo winds the 10:41 day back (`&at=930`, `&at=1010`, `core/store/demo/moments-out.ts`). A row's words are the ones the app can know: "#0555 · they collect", not a ready time it has not got; "Next out" names no driver (he is chosen on Load, OU02); a place is its short name ("Ntinda", as OU20's stops) | OU14, OU15; critic G6, 2026-11-12 |
| **The track of a pickup that came off the shelf** (OU13): Buying and Packing are skipped (a dash, "skipped"), and the now-stop at the gate says "ready" (P18's OR38), never "now". **Coming back** (OU24): the now-stop draws the return arrow and when he left (9:55) | `core/store/load.ts trackTimes`; `ui/Track.tsx` `nowIcon`, `nowTime`; critic G5 |
| **Ruth's face is teal** wherever she is drawn, the "Ask Ruth" disc on OU13 too (FACTS §1 tints: RN teal). Navy stays for the sends: the navy "Send to Ruth" button (§4.8) | FACTS §1; OU13; critic G5, lead ruling 2026-11-12 |
| **The slide held keeps the screen still**: "Who drives" and its row stay while the knob is held (OU17), so nothing moves under the thumb | OU17; critic G9, lead ruling 2026-11-12 |

## 3. Open questions (Kevin)

Each row names the default being built until Kevin answers. Q1–Q9 are `docs/audit/store/GOAL.md` "Waiting on Kevin"; Q10 on are from the manifests and from reading `store.html` for this spec. The data questions are in `04-screens-store-data.md` §9.

| # | Question | Default being built | Source |
|---|---|---|---|
| Q1 | ~~Approve the canvas~~ | Approved: the build has started (this spec is its step 1) | GOAL.md 1 |
| Q2 | **The blind rule in Find**: an item due for a count shows "Count due" in place of its figure on the yard's phone (SH02, Wire nails 3"), where Sales shows "96 on shelf". Keep it? | Keep: "Count due", no figure | GOAL.md 2; lead ruling (c); `store.html:5148 countDue` |
| Q3 | **Who gives out a yard login** when nobody else can take the yard at the end of a shift? No role in `decision-rights.md` holds staff logins for the yard | TD24: the slide is off and "Ask Ruth" (navy) | GOAL.md 3; manifest `today.json` |
| Q4 | **A ridden trip is checked in by someone else** (Okello), so the count stays blind (IN31, IN32). Confirm | Someone else checks it in; the rider's hand-in says "Okello checks it in" | GOAL.md 4 |
| Q5 | **The supplier's delivery note photo goes to Esther** (Accounts pays suppliers), with `delivery.checked`. Confirm the push | It goes to Esther | GOAL.md 5; IB01 |
| Q6 | **A return before the bill** (#0548): the yard says "Ruth checks it" and never names a credit note; Ruth settles it once the 24-hour bill is out | As drawn (IN20–IN22) | GOAL.md 6; IM-12; Sales OR21 |
| Q7 | **Aisle C has 132 items**: split an aisle count by shelf (C1–C4)? | No: one aisle count (SH14) with Keep for later | GOAL.md 7 |
| Q8 | **The new shared words** (Ready to collect, Back at the yard, Coming back, Cancelled · put it back / bring it back, Counter sale, Delivered today) take effect with the canvas | In effect in the Store; other apps change in their sessions (`OTHER-APPS.md`) | GOAL.md 8; GLOSSARY (proposed) |
| Q9 | **Sample-day gaps** the boards filled (§2a, last row): confirm or replace | As drawn | GOAL.md 9 |
| Q10 | ~~A count is due after **21 days** (`countDue`, `store.html:5148`), but the Shelf says "counted every **14** days" and an aisle is fresh within 14 (`COUNT_DUE_DAYS`, 5120). One number?~~ **Answered 2026-11-11, Kevin: 21 days.** | One rule, `core/store/counts.ts` `countDue` (`COUNT_DUE_DAYS` 21): the item's "Count due", Today's count job, and the Shelf's aisle ring and its "every 21 days" (`shelf.ts` `aislesOf` reads `countDue`); no second number | `store.html:5120`, `5148`; SH01 |
| Q11 | **Put back writes nothing to the books today**: `pkbackdone` keeps "done" only on the phone (`ow-store-putback`, `store.html:4342–4347`). PK10 draws a red slide (a commit). Should the put-back be recorded (who, when) so Ruth and Grace see it? | **Decided (11 Nov 2026, the area builders' gap):** recorded on the order, `payload.putBack {at, by, byName, lines}` through `store_patch_order` (0183; data W28), stamped once by the server, so every phone, Ruth and Grace see it and the order leaves To pack. No stock line (it never left the books, 0177) and no push (IB01 draws none) | `store.html:4345`; PK10, PK22, OU27 |
| Q12 | **An unpaid pickup cannot be Ready to collect today**: the money gate (0156 `saved_quotes_ow_money_gate`) stops a Store login moving a cash customer's unpaid order out of Packing, but FACTS draws #0555 "Ready to collect · Not paid yet" (OU13) | The new migration moves the gate for a pickup from "leaves Packing" to "handed over" (Ready to collect may be unpaid; Hand over stays locked until paid or let go). Kevin to confirm, since it changes what the server lets through | `supabase/migrations/0156_store_money_at_the_gate.sql:82–105`; OU13; `OTHER-APPS.md` "one decision" |
| Q13 | **Can't deliver · bring it back** (OU24) has no write today (STORE-TODAY §4.4: only a toast). Is the order kept On the road with a reason until it is checked in at the gate, or moved back to Packing? | Kept On the road, with `comingBack {why, at, by}` on the order (new allow-list key) and the `order.back` push; checked in at the gate as a return | OU24; IB01 "Can't deliver · coming back" |
| Q14 | **The error line**: the boards write "That did not save · tell Kevin · code"; `store.html` names the owner from the staff list (`ownerWord`, 1007) | "tell Kevin", as drawn | `store.html:1007–1015`; BRIEF "No signal" |
| Q15 | **Manager, owner and admin logins** can open the Store app (`store.html:2007`) and Accept or Ask for a recount there (`PAGE.decide`, 5874; `canCorrect`, 1390). IM-20/21: the Store app stops showing them. Do those logins still get in, look only? | They get in and see what the yard sees; no Accept, no recount, no return decline (`rtdecline`, 6099) | `OTHER-APPS.md` Manager IM-20/21; STORE-TODAY §4.4 |
| Q16 | **No-photo reasons**: `store.html` offers four ("The camera will not open", "The client said no photo", "Too dark to see", "Phone battery low", 4986); OU23 draws "Kato said no" as one reason tile among others | The boards' tiles; the reason goes on the order (`deliveredNote`) | `store.html:4986`; OU23 |
| Q17 | **Pass the yard has no Undo today** (`ACT.hosend`, 6223, writes at once); TD14 draws "Take it back 10 s" | As drawn: held 10 s with Undo (one rule for sends, §4.9) | TD14; `store.html:6223` |
| Q18 | Icons new to the canvas (the Shelf tab's shelving with boxes; Coming in, To load, damaged), drawn in the agent's stroke style but not in `LANGUAGE.md`: add them to the parts board? | Added to the shared icon set as drawn | manifests `in.json`, `shelf.json` |
| Q19 | **The decision rights** say who "takes the yard" when Musa passes it: the half-done packs move to the colleague (`store.html:6231`). Does an order Ruth gave to Musa (For you) move too? | Yes, every order this person holds in Packing moves | `store.html:6227–6231`; PK08 |
| Q20 | ~~**Next job after taking over the yard**: Okello's Next job is #0552, the half-packed order passed to him, where TD32 draws #0556 first~~ **Answered 2026-11-11, Kevin: the packer's own half-packed order comes first.** | Keep `core/store/jobs.ts` (your pack first); TD32 passes by this ruling | TD32; `jobs.ts` |
| Q21 | ~~**Forgot password and shelf-label printing**~~ **Answered 2026-11-11, Kevin: drop both.** | Forgot password only says "Ask your manager for a new invite link" (no reset); no label printing anywhere (the Shelf's "Print again" and its toast removed from SH04) | TD20; SH04; data §8 "Shelf labels" |
| Q23 | **Unpack: To pack or Packing?** AD05 (and FLOW-02, PK15's tile) show an unpacked order back in **To pack** ("To pack now · #0530 · ticks kept · ready"), while §4.2 "Unpack" says "back to Packing now". W5 keeps the packer and sets `pickingStatus: in_progress`, so the books read it as Packing (the packer's) | As drawn on AD05: the screen lists it under To pack now; W5 unchanged. Kevin to say which sub-state the yard list shows | AD manifest open question 2; AD02, AD05; §4.2 |
| Q24 | **Who gets "At the door"** (OU21, FLOW.md §5 "Next job 'At the door'")? `store.html:2783 myDrops` gives a drop to its driver only; a driver with no login (Ssali, a hired driver) has no phone in the app, so the job goes to the login that sent him (`carrier.by`) | `jobs.ts` `atTheDoor`: the driver, else the login that loaded a driver with no login of his own; Ssali's 9:55 run has no loader in FACTS, so no door job at 10:41 | OU05, OU21, OU22 ("Ssali · next: back to the yard"); FLOW.md §5 |
| Q25 | **The run's time and the shop's address are not in the books.** FACTS draws "Ssali **13:20**" on #0552's Next job (TD01, TD08, TD33) and "Open · **Kampala Road**" with a call button for the shop (TD12). The yard's books keep no planned run time (a carrier and its time exist only once the run is loaded, W8), and `store_snapshot` gives the shop's name only (no address, no phone) | **Left out**: the Next job names the driver once the run is loaded; You shows the shop's name and "Open", no call button. To carry them: the planned run on the order (who and when, before W8), and the shop's address and phone in `side` (data §9 D14) | TD01, TD08, TD12, TD33; Today critic T6 (2026-11-12) |
| Q22 | ~~**On the road's "Done" chip** (OU20) repeats Today's Delivered today~~ **Answered 2026-11-11, Kevin: remove it.** | Today's "Delivered today" is the one place; On the road keeps Out now and Ready | OU20; `out/Road.tsx` |

Smaller notes from the designers are in each `manifest/<area>.json` under `open_questions` (e.g. TD03 must draw the ride at Katwe Timber at 15:10, not Kiseka; SH02's order rows link stand-ins).

## 4. Rules the boards draw but do not state

Each rule is written once in code (the place named is where the new app keeps it) and comes from the source given. A board that disagrees with one of these is corrected to it. `store.html` lines are of commit `57ef55fa` (the file has not changed since round 10, `1bb6698d`).

### 4.1 The yard's states and counts

| Rule | Where in code | Source |
|---|---|---|
| **To pack** is an order in Packing (`preparing`) that nobody has packed (`pickingStatus` not `done`), whose bought-in lines have all come in, not held for an agent who pays first, not backdated. Oldest first (`stageEnteredAt`, else saved, else created); this person's own first. Ready now only: what waits is counted apart | `core/store/yard.ts` `toPack` | `store.html:1488 packQueue`, `1477 waitingSince`, `1772 agentPaymentBlocksPreparing`, `1480 orderIsBackdated`; WORD-04 |
| **Waiting on goods** is an order in Buying (`awaiting_goods`), or in Packing with a bought-in line (a supplier, not `__stock__`) not yet received (`receivedAt` and `receivedQty > 0`). It shows as "+2 waiting" beside To pack, and in the sheet as "Waiting on goods · Denis is buying" (grey, PK21). Its Pack button is "Waits for the goods"; Check-in opens it | `yard.ts` `waitingOnGoods` | `store.html:1492`, `1767–1770`; NAV-04; IB02 Buying row |
| **Packing now** is `pickingStatus: in_progress`: "yours · carry on" when `assignedWorkerId` is this person's staff row, else "Packing now · Okello" (look only, PK17) | `yard.ts` `packingNow` | `store.html:1487 orderIsMine`, `1512 takenBySomeoneElse`; STO-WORD-11 "Packing now" |
| **For you** is an order Ruth gave this person (`assignedWorkerId` is theirs, not started): first on To pack, "Ruth gave you #0556 to pack"; others see it as hers to give (look only) | `yard.ts` `forYou` | IB02 "Given to a packer"; PK08; IM-08 |
| **Packed** is `pickingStatus: done` in Packing (a delivery waiting for the truck, on its bay). The Packing clock stops at `pickingDoneAt`: "Packed · waits for the truck", never stuck | `yard.ts` `packed` | `store.html:1495 loadQueue`; IM-28 |
| **Ready to collect** is a packed pickup. A pickup is an order nobody of ours drives: an agent pickup (`deliveryMode: 'agent_pickup'` or `assignedDeliveryId: '__agent__'`), or one with nowhere to deliver (Sales' `deliverTo` empty). When packed it moves to **On the road** (`pending_delivery`) with no carrier, and reads "Ready to collect · at the gate · code 0554" | `yard.ts` `readyToCollect` (the same rule as Sales' `core/orders.ts` `readyToCollect`) | `OTHER-APPS.md` "one decision"; `store.html:1494 orderIsPickup`, `1520 orderIsCollected`; PK07, OU10; IM-03 |
| **On the road** counts what left with a driver and what waits at the gate (3 at 10:41). **Delivered today** includes collected. One definition per count, read by Today's tiles, its bar and every stage sheet | `yard.ts` `counts` | `store.html:1510 counts`; WORD-04 |
| **An invoiced order leaves the board 24 h after its invoice** | `yard.ts` `onBoard` | `store.html:1751 quoteAgedOffBoard` |
| **Cancelled** (`voided`, `cancelledAt` or status `cancelled`): red "Cancelled · put it back" wherever it is in the yard (To pack, a bay, To load), "Cancelled · bring it back" on a truck, with the list of what to put back and each line's aisle. Only lines already picked go back; with none, "Stop packing · nothing was picked yet" | `core/store/pack.ts` `putBack` | `store.html:4065 orderCalledOff`, `4324 pkCancel`, `4349 putBacksNow`; PK10, OU27; IM-11, IM-39 |
| **The copy** (#0557): an order Ruth is cancelling as a copy is Look only, "the copy of #0556 · Don't pack", with "Pack #0556 instead" | `pack.ts` | PK09; IB01 `order.copy` |

### 4.2 Packing

| Rule | Where in code | Source |
|---|---|---|
| **Looking is free; the first Packed claims the order** (`assignedWorkerId`, `workerAcceptedAt`, `pickingStatus: in_progress`). A tap from a push never takes an order. Someone else's open order is Look only | `pack.ts` `claim` | `store.html:4077–4087 pkClaim`, `2368 takeOrder`, `2696` |
| **One card per line, picture first, the aisle letter big; every line opens at what was ordered** (the shelf only hints, "Count due · count as you pick"); "Packed" moves on to the next open line by itself | `pack.ts` | `store.html:4060 pkPick`, `4202 pkMark`; STO-UI-02 |
| **Red packs only the full line; Pack short is amber; Waits for the goods is grey.** Short opens the count in the unit you can see; Pack short sends the line `short` with `pickedQty` | `pack.ts` | NAV-04; `store.html:2344 setPick`; PK04 |
| **The bay is picked for you**: the order's own bay if it has one, else the bay the map shows it on, else the first free bay; one tap changes it. Bays are `presets.bays` (default 4, 1 to 12). A packed order with no valid bay is shown in the first free one, so no packed order is hidden; with every bay full, "leave it by the gate". Unpack frees the bay | `core/store/bays.ts` | `store.html:1271`, `2828 bayMap`, `2837 freeBay`, `4214 pkFinish`, `4319 pkbay`; PK06 |
| **The last line finishes the order**, held 10 s with Undo (Undo reopens that line) | `pack.ts` `finish` | `store.html:4213 pkFinish` |
| **Unpack** a packed order while it is still in the yard (not loaded, no carrier): back to Packing now, ticks kept, bay freed. Refused once loaded or out | `pack.ts` `unpack` | `store.html:2396 canUnpack`; FLOW-02; PK15 |
| **Lines the yard never picks**: a line with no supplier whose client waits (`clientWaits`), and a line Ruth settled to nothing ("Bill what went" on none). They are not a short pick | `pack.ts` `notPicked` | `store.html:1540 lineNotPicked` |
| **A short is short until Ruth settles it**: still under what the line bills and not settled as the full quantity (`pickShortfallAckAt`) | `pack.ts` `shortNow` | `store.html:1549 lineShortNow` |
| **Where · when · phone** on the pack card, To load and the drive read the order's own `deliverTo`, `deliverWhen`, `deliverPhone` from Sales ("Ntinda site · today afternoon · 0772 418 220"), never the customer's record | `pack.ts` | IM-01, IM-02; PK02 (today `store.html:1521 orderDestination` reads the customer's location) |

### 4.3 Goods in

| Rule | Where in code | Source |
|---|---|---|
| **The check-in is blind**: the books never show; the Buyer's figure for a line shows only once the line is counted. Quick tiles in the unit you can see ("1 bundle · 20", "2 ctn", "+1") make most lines one tap; a count unlike Denis's asks why on that line only | `core/store/checkin.ts` | STORE-TODAY §5; IN02, IN03; IM-36 |
| **The why chips**: Never came · Torn or broken · Wrong brand · I miscounted (keeps nothing and reopens the number); over: bought extra · sent by mistake (what was bought goes to the shelf, the rest is kept aside as an extra ask to Ruth) | `checkin.ts` | `store.html:3750–3754 WHY, WHY_OVER`, `3995 checkInRound`; FLOW-06 |
| **Grouped by where it goes**: the order's drop, or the shelf. A carton bought for one pack: the order takes what its line asks, the rest goes on the shelf; an order already out the gate, or cancelled, takes nothing and it all goes on the shelf | `checkin.ts` `shareOf` | `store.html:3767 rcShareOf`; IN02 |
| **A trip is one check-in**, whatever its stops ("Denis's trip · 2 suppliers"); never "round" | `checkin.ts` | `store.html:1569–1573`; WORD-08 |
| **After the slide: "Sent to Ruth · 1 differs"** and "Ruth decides the 2 pc" until she decides; never "Ruth accepted" before she has | `checkin.ts` | IM-23; IN06 |
| **Not on the list**: pick the item (or scan), how many, why → Ask Ruth (navy). An item not ours is a new item with a photo, for Moses | `checkin.ts` | `store.html:2485 sendExtras`, `3923 SHEET.extra`; IN04; IM-17, IM-19 |
| **A supplier delivery** is the same check-in, titled "Delivery · Hima Cement": stacks-of-10 tiles, the note photo, torn ones apart for Ruth | `checkin.ts` | IN10, IN11; `store.html:1783 tripIsSupplierDelivered` |
| **A return at the gate** starts at what the salesperson asked (2 of 3 bag), Good or Damaged per line, a photo, navy "Send to Ruth". Never bigger than the line has left (open and accepted asks plus credit notes); damaged never goes to the shelf by default; a damaged reason marks the lines damaged; quantities in the order line's unit | `core/store/returns.ts` | `store.html:1128 returnedQty`, `6060 RT_WHY`, `6074 rtwhy`; DATA-02; Pre 3; IN20 |
| **A ridden trip**: tick lines onto the truck ("All on"), Done at the stop, slide to hand in at the yard; no money on the phone ("Esther checks his receipt · no money here"); someone else checks it in (Q4) | `core/store/ride.ts` | `store.html:2552–2575`; IN30, IN31 |

### 4.4 Out

| Rule | Where in code | Source |
|---|---|---|
| **To load by direction**: packed deliveries grouped by compass sector from the yard (45°, from the places' pins), each named once by its farthest place ("→ Ntinda"); an unnamed one offers "Name it" (`route.lock`, OU31). Nearest direction first; load last drop first. Orders still packing on the same road show as "goes on the next run" | `core/store/load.ts` | `store.html:2846 sectorOf`, `4436 loadDrops`, `4444 roadsOf`, `2847 runsNow` |
| **The driver is remembered**: today's last driver of ours, else the first driver on the staff list; a driver already out is not offered. Hired: the last 8 hired drivers by their phone, one tap each; a hired phone must be a Ugandan mobile (256 7/3 + 8 digits); the drop goes to him on WhatsApp | `load.ts` | `store.html:4430 defaultCarrier`, `2845 drivers`, `4424 pastHired`, `4783 phoneOk`, `4564 driverMessage`; OU03 |
| **Not paid yet is a label, never a figure**, one label everywhere ("Not paid yet"), the one reason only on the order: the salesperson takes the money before it leaves, or Ruth lets it go on credit. It stays on its bay (or at the gate); the Store taps nothing, the pushes go by themselves (`order.unpaid_at_gate` to the salesperson, `credit.ask` to Ruth). "Ask Ruth" (her face's teal, §2a) only on OU13 and only for a customer with a record | `core/store/money-hold.ts` | `store.html:1498 NOT_PAID`, `1499 notPaidWhy`, `1502 moneyHold`, `4795 canAskCredit`; WORD-03; IM-07, IM-35 |
| **The gate**: the collector's name is prefilled from the order's contact; an agent collects by the 4-digit code, which is the order number; a wrong code says "Not #0554 · ask Peter to read it again" and locks the slide; a money hold refuses. Done is "Delivered · collected", never "at the door" | `core/store/gate.ts` | `store.html:2416 handOver`, `5065 agTry`; OU10, OU11, OU09; IM-06 |
| **The door**: the shutter takes the photo **and** marks it Delivered (Undo 10 s); "No photo?" asks one reason, never preselected; what stays on the truck becomes a return checked at the gate. "The bill goes by itself after 24 h" | `core/store/door.ts` | `store.html:2437 markDelivered`, `4984 dvnophoto`, `4932 doorReturnLines`; OU21, OU23; IM-30 |
| **On the road shows stops done; a hired driver is told apart** ("Abudu (hired)") | `load.ts` | STO-UI-09; OU20; IM-04 |

### 4.5 The shelf and counts

| Rule | Where in code | Source |
|---|---|---|
| **One figure for the shelf**: "412 on shelf" is the books less what has already left for orders not yet invoiced (packed, out, delivered), never below 0 — the figure Sales shows. What is packed for an order shows apart ("packed for #0552 · bay 1 · 40"). Never "held", never "books" next to a shelf figure | `core/store/shelf.ts` (the same rule as Sales' and the Buyer's) | `store.html:1596–1650 heldIndex, heldGone, stockItems`; DATA-04; IM-32; lead ruling "Never held" |
| **The blind count**: an item due for a count shows "Count due" in place of its figure wherever it opens (Find, the aisle, the item, Pack's hint). Due = Ruth asked a recount, or on the shelf and not counted for more than 21 days (Q10). The count screen never shows the books; after Ruth decides, the item shows what changed ("18 → 17 ctn", SH16) | `core/store/counts.ts` `countDue` | `store.html:5132 lookOf`, `5146 recountAsk`, `5148 countDue`; DATA-01; Q2 |
| **Count in the unit you can see** (cartons and loose kg, bundles and pieces); the books keep the line's unit: "You counted 1 ctn = 20 dozen" | `counts.ts` | FLOW-01; `store.html:5299 levelsFor`; SH10 |
| **One waiting count per place** (an aisle by its category's name, one item by its key); counting it again replaces the waiting one when sent ("Count it again replaces it", SH15); if Ruth decided meanwhile, it goes as the next count. A try after a dropped signal first asks whether the last one arrived, so a count never goes twice | `counts.ts` `place` | `store.html:1158 countPlace`, `2579 sendCount`, `2595 sendCountReplace`, `5421`; DATA-01; 0161 |
| **A partial count** ("Can't find") sends what was counted; what could not be found rides apart and stays due | `counts.ts` | `store.html:5424–5427`; Pre 1 |
| **A count goes to Ruth only**; the owner gets the log, never the push ("Joseph · in the log only", SH12) | — (server, 0183) | IM-20; IB01 |
| **What needs a look**, worst first: reported · short (an order wants more than the shelf) · out (sold in 4 weeks, none free) · low (less than a week's sales free) · count due | `shelf.ts` `lookOf` | `store.html:5132–5143`; SH01 |
| **No loss off an empty shelf**: "Count it now"; a report is capped at the shelf; one item, one reason (Damaged · Lost · Stolen), how many in the unit you see, a photo | `core/store/report.ts` | DATA-03; `store.html:5491 REASONS`, `5559–5561 rpFits, rpMax`; SH20, SH23 |
| **Ask for more** is asked in the unit the Buyer buys (the pack when the item has one); how soon (We're out / Running low) prefilled; it names the orders short of it | `core/store/restock.ts` | `store.html:2495 restockUnit`, `2496 sendRestock`, `5617`; SH30 |
| **Find**: the best match first; misspellings find ("hindge", "4x20", "silcone", "Did you mean"); a size like 1 1/4" is one tag; chips only with a query, a chip's count is its rows; 30 rows at a time, "Show 30 more"; every order row opens something | `core/store/find.ts` | `store.html:5647–5700`; NAV-03, NAV-05, NAV-06, NAV-07, STO-SPD-02 |
| **No aisle yet**: a product with no category has no aisle letter | `shelf.ts` | DATA-05; SH05 |
| **A shelf label's short code** (under its bars, for a person to read) is the aisle letter and four digits from the item's key, `h = (h × 31 + char) mod 10000` ("A-3533" for Iron sheet G28): the labels already stuck on the shelves carry it. The bars carry the key itself (`OW1:` / `OW-`). SH40's "A-014" was a designer's sample; the board now reads the rule's code | `shelf.ts` `labelShort` | `store.html:5814 labelShort`, `5811 labelCode`; SH40 (Shelf parity F4) |
| **Find's Open** on the best match opens the item; while a count of it waits with Ruth it opens that count, with its waiting sheet ("Count it again" or leave it) | `shelf/Find.tsx` `Best` | SH02 links Open to SH15 (Shelf parity F2) |

### 4.6 The shift

| Rule | Where in code | Source |
|---|---|---|
| **Pass the yard** goes to a colleague with a Store login who is not away (Okello prefilled); what this person was packing moves to them (their name on the order, the picks kept), and Ruth's answers follow them; they tap "I've got it" on their own phone. Words: "Pass the yard" / "End my shift", never "Hand over" (that is the gate) | `core/store/shift.ts` | `store.html:6193 mates`, `6223 hosend`, `6245 hogot`; WORD-02; TD13–TD15 |
| **First day** (TD05): the yard has nothing of its own yet (no order, trip or return) and nothing is done today: "Welcome · Your first day", Get going (Signed in · Turn on alerts → You · Walk the shelf → Shelf), the ghost of On the move, who shows you the yard. A shelf count that falls due does not end it (counting is the shelf's upkeep, and Walk the shelf leads there). The demo's `first-day` seed has every aisle counted, so the board's "0 jobs yet" holds | `today/Today.tsx` `firstDay` | Today critic T11 (2026-11-12); TD05 |
| **Close the yard** from 17:30, Today's last card: four checks (every bay empty or "stays the night on its bay", what waits on Ruth carries over, every good return back on the shelf, the next first job); the slide is off until the red one is sorted; Ruth gets a line in her log, nothing to answer | `shift.ts` | `store.html:6255 PAGE.close`; TD16, TD28; IM-18 |

### 4.7 Words, names and time

| Rule | Where in code | Source |
|---|---|---|
| **One name per person** (`personName`): the name they chose (`shop_members.display_name`) → their staff record's unless it reads like a login handle (one word with a digit) or has an @ → the name stored with the row → their role ("The owner", "The manager") → "A colleague". Never an email handle, never "Someone" | `core/names.ts` (shared) | `store.html:1366 personName`, `1354 looksHandle`, `878 ROLE_WORD`; WORD-01; STO-WORD-11; PRIV-04 |
| **How long** (`howLong`): under a minute "just now"; "41 m"; "9 h 05 m"; "1 day", "2 days". **When** (`whenAt`): today "15:20", another day "Thu 23:28" | `core/time.ts` (shared) | `store.html:871`, `873`; WORD-07 |
| **Order numbers** as `#0552` (4 digits) | `core/orders.ts` `orderNo` | `store.html:2805 q4`; CLAUDE.md |
| **Quantities** in whole packs, then the line's unit: "1 ctn + 4 box", "10 dozen"; never "0.5 ctn"; units lower case | `core/units.ts` | `store.html:1145 lineQty`, `1139 unitSay`; STO-UI-01; WORD-09 |
| **Singular and plural from one helper** | `core/names.ts` `counted` | `store.html:5297 nOf`; FLOW-07 |
| **A trip is never a round**; "Back at the yard" for a trip that has come back; "at the gate" only for orders waiting to be collected and returns | — (words) | WORD-08; IM-26 |
| **A walk-in** is "Walk-in"; two walk-ins are told apart by their number | `core/orders.ts` | `store.html:1753 quoteClientName` |

### 4.8 States, sends and errors

| Rule | Where in code | Source |
|---|---|---|
| **Undo 10 s**: every write that moves goods or reaches Ruth waits at least 10 s with Undo, and goes at once when the app is put away or the screen changes; one held write at a time | `core/store/held.ts` | `store.html:991 heldWrite`, `2074 flushHeld`; FLOW-02 |
| **Sending… · Not sent yet · Sent**: a done screen says only what is true; never a green tick before the server's yes ("Handing over…", "Packing #0552…", "Delivering…") | `src/ui` (the dock's sending state) | `store.html:5436 trackStep1`, `5451 stateDot`; REL-05 |
| **The Not done bar** keeps the work and says why: amber "No signal" (white Try again, the work kept on this phone); red "That did not save · tell Kevin · code" (navy Try again); blue "Someone else just did this · Refreshed" with what happened ("Okello checked it in") | `src/ui` `NotDone` | `store.html:4600 movedWords`, `4606 setNotDone`, `4609 notDoneBar`; REL-07, REL-09; BRIEF "No signal" |
| **Plain error words**: no SQL, function or migration name on screen; a sentence the database says on purpose shows as it is | `core/store/errors.ts` | `store.html:1008 plainSentence`, `1009 failWord`; REL-09 |
| **Two phones on one order never both win**: every order write carries what the phone saw (status, pickingStatus, pickingDoneAt, carrier.at); a clash refreshes and says "Someone else just did this" | `core/store/write.ts` | `store.html:2301 seenOf`; 0162; REL-08 |
| **One rule for sends** (lead ruling, round 2): a send that changes nothing until Ruth decides (a count, a loss report, an ask for more, a return, Ask Ruth) is a **navy "Send to Ruth"** (or "Send to Denis") button with Undo 10 s. A commit that moves goods (check-in, load, hand over, deliver, put back, ride hand-in, pass and close the yard) is the **red slide**. "Pack short" is amber; "Packed" is the per-line button | — | BRIEF "One rule for sends"; GLOSSARY |
| **A slide that cannot go yet shows why on its knob**: the quiet locked track, its words, and on the grey knob the lock (nobody to pass to, a return to set aside first) or the no-signal icon (Back online to close); never the slide's arrows, which promise a move. One shared part, `Slide` `lock` (Sales' KC07–KC18 draw the same) | `src/ui/Slide.tsx` | Today critic G-T20 (2026-11-12); TD24, TD27, TD28 |
| **Before a commit**, who will be told sits in a dashed "After the slide · Grace and Kato see …" strip; after it, "Grace sees" rows. Never past tense before the commit | `src/ui` | BRIEF |
| **Every flow ends on one button, "Back to Today"** (or the real next job) | — | BRIEF; CLAUDE.md |
| **Updating · saved 7:52**: "Live" only after fresh data; "Updating…" while reading; after 10 minutes without fresh data "Updating · saved H:MM" | `src/ui` status pill | `store.html:2966 freshWord`; STO-SPD-04 |
| **Waiting to send**: one list on Today of everything kept on this phone (picks, check-ins, counts, reports, returns), with Remove after a confirm; "Not sent · N" in the header | `core/store/outbox.ts` | `store.html:2988 waitingList`, `3027 rmwait`; REL-04; NAV-09 |

### 4.9 The shell

| Rule | Where in code | Source |
|---|---|---|
| **Back walks the app**: phone and browser Back go back one screen (a sheet closes first, one history entry per screen); on Today, "Leave Omni-ware?" | `src/native` back, `shell/nav.ts` | `store.html:2098 navArm`, `2209 SHEET.leaveapp`; NAV-02 |
| **A reload reopens the same screen**; flows reopen from Today with their drafts | `shell/nav.ts` | `store.html:2035 saveView`, `2037 restoreView`; NAV-09 |
| **Close goes to the board's place; the way back walks the stack.** A sheet's Close goes where its board links (the Shelf's item and aisle → Shelf; a report → its item, or Shelf when the shelf is empty; a waiting count's Close, Leave it and Keep theirs → the item): down the stack when that place is below, else in the top's place. The 40 px strip above a sheet is Back, and its words name the screen really below ("Back to Find", "Back to Roofing") | `shell/nav.ts` `nav.to`, `backTo` | Shelf parity F5 (critic 2026-11-12); SH03, SH05, SH10, SH15, SH20, SH23, SH25 |
| **Back and the title stay at the top** of every long page | `src/ui` | NAV-08 |
| **Big text** (You): the whole scale at least 1.2×, controls 52 px | `src/ui` tokens | `store.html:2130 bigPx`; STO-A11Y-01 |
| **Alerts** are this phone's row in `push_subscriptions`, signed up when the person turns them on and has a staff row. The bell counts only today's alerts for you; opening Alerts reads them | `core/supabase/push.ts` | `store.html:2647–2704 enablePush, listenPush, pushOpen`, `3248 seenAt`; WORD-10; spec 06 §6a |
| **Offline**: the app opens with no signal on the phone's copy (drawn before the login is checked) and says "Updating · saved 7:52"; reports and returns with their photos wait in the outbox and go by themselves; picks, check-ins, counts and the gate's name and ticks are drafts kept across a reload; the page itself is kept by the service worker, never the books; "Update ready · Reload" | `core/store/offline.ts`, `src/apps/store/sw.ts` | `store.html:1289–1340`, `2971 registerStoreSW`; REL-02, STO-SPD-01; spec 06 §1, §3 |
| **One h1 per screen, section labels h2, only the top screen readable; text contrast at least 4.5:1; every control 44 × 44; nothing clipped at 360; nothing under a fixed control** | `src/ui` | STO-A11Y-02, STO-A11Y-03, STO-UI-04; CLAUDE.md |

## 5. The audit fixes kept

Every "yes" row of `docs/audit/store/STORE-TODAY.md` §3, as a rule the new app keeps whatever its screens look like. A row marked "not needed if X" there keeps only the rule in brackets. Server-side fixes stay whatever the UI does.

| Round | Id | The rule kept | Boards / §4 |
|---|---|---|---|
| Pre 1 | Report 1 | No money on the yard's phone (0159); the copy kept in IndexedDB; over/short reasons at check-in; new items at check-in; return reasons; partial counts; screen-reader labels | §4.3, §4.5, §4.9 |
| Pre 2 | Report 2 | Nothing cut off at 360: name, size and colour on their own lines (tags); one Back | §4.9 |
| Pre 3 | Report 3 | A loss report never multiplies on a unit switch; damaged goods never go back to the shelf; one page per tap; Back from a return goes to the right list | §4.3, §4.5 |
| Pre 4 | Report 4 | The yard's data by allow-list (0160); search puts the best match first; delivered goods leave the shelf; Take back a return asks first; outbox for reports and returns; hand-over drafts kept; the driver's phone checked | §4.3–§4.5 |
| 1 | DATA-01 | One waiting count per place; a count done again replaces it when sent; the done screen shows old → new | §4.5 |
| 1 | DATA-02 | A return reads in its order line's unit | §4.3 |
| 1 | DATA-03 | No loss off an empty shelf ("Count it now"); a write-off never past the shelf | §4.5 |
| 1 | DATA-04 | "Shelf", never "books", next to a shelf figure | §4.5 |
| 1 | DATA-05 | No aisle letter for an uncategorised product ("No aisle yet") | §4.5 |
| 1 | DATA-06 | Product and variant names with one dash (data) | data |
| 2 | FLOW-01 | Check-in counts in cartons or dozens and keeps the line's unit | §4.3, §4.5 |
| 2 | FLOW-02 | Every held write waits 10 s; a packed order can be unpacked in the yard | §4.2, §4.8 |
| 2 | FLOW-03 | (Typing never loses focus) | all fields |
| 2 | FLOW-04 | A counter or field that opens takes the cursor | all fields |
| 2 | FLOW-05 | One Today card per job | TD01 |
| 2 | FLOW-06 | "I miscounted" both ways keeps nothing and reopens the number | §4.3 |
| 2 | FLOW-07 | Singular and plural from one helper | §4.7 |
| 3 | REL-02 | The gate's name and ticks are kept until the server says yes, across a reload | §4.9 |
| 3 | REL-04 | One "Waiting to send" list on Today; "Not sent · N" | §4.8 |
| 3 | REL-05 | Sending / kept / sent on every done screen | §4.8 |
| 3 | REL-06 | A 400 ms tap guard after a screen change; nothing tappable lands where the last main button was | `src/ui` |
| 3 | REL-07 | A failed write keeps its work: the Not done bar with Try again | §4.8 |
| 3 | REL-08 | Two phones on one order never both win (`p_expect`, 0162) | §4.8 |
| 3 | REL-09 | Plain error words | §4.8 |
| 4 | NAV-02 | Phone and browser Back walk the app; "Leave Omni-ware?" on Today; one history entry per screen | §4.9 |
| 4 | NAV-03 | A size like 1 1/4" stays one tag | §4.5 |
| 4 | NAV-04 | A quote, an order waiting on goods, someone else's order open look only; red packs only the full line, Pack short amber, Waits for the goods grey | §4.1, §4.2 |
| 4 | NAV-05 | Every order row in Find opens something | §4.5; routes §3 |
| 4 | NAV-06 | Misspellings find the right items; "Did you mean" | §4.5 |
| 4 | NAV-07 | Find lists every match; chips only with a query; a chip's count is its rows | §4.5 |
| 4 | NAV-08 | (Back always reachable) | §4.9 |
| 4 | REL-05 | "Handing over…" / "Packing #…" until the server's yes | §4.8 |
| 5 | PRIV-01 | Nothing about money reaches the phone for any login; a write sends only the keys the tap changed; the UI never asks for a money field | data §0, §9 |
| 5 | PRIV-02 | The snapshot works; the money hold restored | data §1 |
| 5 | PRIV-03 | A failed load says "Could not load the yard" with Try again and a code on every tab; never falls back to direct reads | TD07, TD22 |
| 5 | PRIV-04 | Every member has a name; set on invite, changeable on You (`set_my_name`) | TD12 |
| 5 | PRIV-05 | A Store login writes only through its functions and reads only its own membership (server) | data §0 |
| 5 | NAV-02 (reopened) | One history entry per screen | §4.9 |
| 6 | WORD-01 | One name resolver; never a login handle | §4.7 |
| 6 | WORD-02 | "Pass the yard" / "End my shift" for the shift; "Hand over" only at the gate | §4.6 |
| 6 | WORD-03 | "Not paid yet" everywhere, one reason only on the order | §4.4 |
| 6 | WORD-04 | One definition per count | §4.1 |
| 6 | WORD-05 | With Ruth shows every yard ask with who sent it and a face | TD11 |
| 6 | WORD-06 | A trip difference is a check-in ("Musa's check-in of Denis's trip") | §4.3 |
| 6 | WORD-07 | `howLong` and `whenAt` | §4.7 |
| 6 | WORD-08 | A trip is never a round | §4.7 |
| 6 | WORD-09 | Stock history names the order ("Order #0548 · …"); units lower case | SH03; §4.7 |
| 6 | WORD-10 | The bell counts only today's for-you alerts; opening Alerts reads them | §4.9 |
| 7 | STO-UI-01 | Quantities in whole packs then the line's unit; never a decimal carton | §4.7 |
| 7 | STO-UI-02 | Every Pack line opens at what was ordered | §4.2 |
| 7 | STO-UI-03 | (Nothing hides under a fixed control) | §4.9 |
| 7 | STO-UI-04 | Every control 44 × 44 | §4.9 |
| 7 | STO-UI-05 | (One scale, no raw values) | `src/ui` tokens |
| 7 | STO-UI-06 | (The status pill's states) | §4.8 |
| 7 | STO-UI-07 | Names in full, with their tags, on every slip | §4.4 |
| 7 | STO-UI-08 | One picture style; a broken photo falls back to the category drawing | all lists |
| 7 | STO-UI-09 | On the road shows stops done; a hired driver told apart | §4.4 |
| 8 | STO-REL-11 | "Checking your shop…" / "Could not reach the shop"; never "This login has no shop" after a failed read | TD21, TD22 |
| 8 | STO-A11Y-01 | Big text at least 1.2×, controls 52 px | §4.9 |
| 8 | STO-A11Y-02 | One h1 per screen, h2 sections, only the top screen readable | §4.9 |
| 8 | STO-A11Y-03 | Text contrast at least 4.5:1 | §4.9 |
| 8 | STO-UI-10 | (Fits at 360) | §4.9 |
| 9 | STO-SPD-01 | Opens with no signal (the page kept, never the books); "Update ready · Reload" | §4.9; TD08 |
| 9 | STO-SPD-02 | Find types smoothly: only results redraw, 30 rows a time, "Show 30 more" | §4.5 |
| 9 | STO-SPD-03 | First data in about 1 s; the 45 s `store_live` refresh (0166) | data §1 |
| 9 | STO-SPD-04 | "Live" only after fresh data; "Updating…" / "Updating · saved H:MM" | §4.8 |
| 10 | STO-WORD-11 | A person with no name is named by role, never "Someone"; "Packing now" | §4.7 |
| 10 | STO-REL-12 | Two tabs on one order proven safe on a real database (server, tests) | §4.8 |
| 10 | STO-UI-11 | (The whole Report box is the field) | SH20 |
| 10 | STO-A11Y-04 | A finished pack card dims its contents, never its stamp | PK05, PK06 |
| 10 | NAV-08 | Back and the title stay at the top of With Ruth, Alerts, On the road, Coming in | §4.9 |
| 10 | NAV-09 | Waiting to send has Remove after a confirm; a reload reopens the same screen; flows reopen from Today with their drafts | §4.8, §4.9 |
| 10 | STO-UI-12 | A check-in line shows the name, then its tags; one service-worker cache | §4.3 |
| 10 | Kevin · In | Coming in is an arrivals board (next trip, coming in, checked in today) | IN01 |
| 10 | Kevin · On the road | One row per stop, with Delivered beside it | OU20 |
| 10 | Kevin · light band | The strip behind the clock follows a coloured head (Android) | `src/native` bars |

Rows that go with the old layout (the floating play button's room, the old compact headers, the old token set, the sticky aisle bar, the slip's live label) keep only their rule, in brackets above. Deferred and still open from `LOG.md`, now in the new migration or the data questions: the `store.handover` words ("passed you the yard", 0183), stable stored aisle letters, the 13 products still in Furniture, the owner's display name, `worker.html` reading orders directly.
