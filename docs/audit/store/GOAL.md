# Goal: the Store app in the agent app's language

Kevin's goal (set 11 Nov 2026): redesign the Store app (`store.html`) in the Agent app's design language (`agent.html`), rethink its workflow from first principles, and keep it in step with every app that hands work to the Store or takes work from it. **Design only: no code until Kevin approves the canvas.**

**The canvas: "Store — in the agent app's language", https://claude.ai/artifact/8oCrpUTjvjLGqQT4V8rESr** (source: `docs/canvas/store-agent/`). Page "Integration & flow" opens first; then one page per area. Each board's title carries its independent score beside its Agent screen's.

## Why

Someone who knows the Agent app picks up the Store app with no training: it shows rather than tells, takes the fewest steps and looks polished. The Store sits in the middle of the order's journey, so every handover uses the same words, states and signals on both sides.

## How

1. The agent's language, written down (reusing the Buyer's reference). 2. The Store as it is. 3. Every app ↔ Store handover and its mismatches. 4. The job rethought before the screens. 5. One design agent per area, every screen at 360 px in all its states. 6. One canvas with an integration board and a flow board. 7. An independent reviewer scores every page against its Agent screen until each matches or beats it.

## Focus

The order's path from Sales' handover to delivered and paid, plus goods in from the Buyer: the fewest steps, nothing lost or worded differently between apps.

## Done when

- [x] every Store page is on the canvas and the independent reviewer scores it at or above its Agent screen (142 pages in 5 areas, 3–4 rounds each; area means 8.93–9.14 against the Agent screens' 8.83–9.03; 0 below);
- [x] the integration board covers every handover with a push and the same words on both sides (`IB01`: 36 handovers, 34 with a push, 2 read live; 12 out of the yard's scope listed; `IB02`: 17 states, one word each; review round 4: no missing handover, no word mismatch);
- [x] the end-to-end flow takes fewer steps than today (99 → 72 taps across 18 jobs; #0552 11 → 8; #0556 8 + a typed name → 5);
- [x] changes other apps need are listed for their sessions, not built here (`OTHER-APPS.md`, plus the pushes for one migration after approval);
- [x] this progress table is up to date.

Then stop and ask Kevin to approve the canvas. No code, migrations or other-app changes until then.

## Progress

| # | Step | State | Evidence |
|---|---|---|---|
| 1 | Write down the agent app's design language | Done | `agent-design-language.md`: reuses the Buyer's `docs/audit/buyer/agent-design-language.md` (§E) and the Sales `LANGUAGE.md` parts P01–P29, and adds only what they lack (the stage sheet, states at 360 px, motion, status words, taps per agent job) |
| 2 | The Store app as it is: pages, taps, every audit fix | Done | `STORE-TODAY.md` (33 pages, 12 sheets; taps measured in the real app; every fix of rounds 1–10 marked keep, or not needed and why) |
| 3 | Map every app ↔ Store handover and its mismatches | Done | `INTEGRATION.md` (39 mismatches IM-01..39, every one closed on a board or listed in `OTHER-APPS.md`; IM-26 closed late: a trip that has come back is "Back at the yard", "at the gate" is only for orders waiting to be collected) |
| 4 | Rethink the job before the screens | Done | `FLOW.md` (each step: needed, merged or automated; taps before and after) |
| 5 | One design agent per Store area, every screen at 360 px in all its states | Done | Today & shell TD (33) · Pack PK (22) · Goods in IN (29) · Shelf SH (30) · Out OU (28). States drawn per flow: default, pressed, disabled, sending, success, error, offline, empty |
| 6 | One canvas, with an integration board and a flow board | Done | the canvas above; `IB01Handovers`, `IB02StateWords`, `FL01Taps` |
| 7 | An independent reviewer scores every page against its Agent screen; revise until each is at or above it | Done | 3–4 review rounds per area (`docs/canvas/store-agent/review/`), scores below and in each board's title |
| 8 | Changes other apps need, listed apart | Done | `OTHER-APPS.md`; proposed shared words added to `docs/audit/GLOSSARY.md` (marked proposed) |

## Scores

The independent reviewer scored each Store board and its matching Agent screen (or the approved Sales board) on Consistency · Steps · Glance · Polish · In step, 0–10 each. The figures are the mean of the five axes.

| Area | Boards | Pass | Mean score | Mean agent score | Review rounds |
|---|---|---|---|---|---|
| Today | 33 | 33 | 8.99 | 8.86 | 3 |
| Pack | 22 | 22 | 8.93 | 8.83 | 3 |
| Goods in | 29 | 29 | 9.00 | 8.91 | 4 |
| Shelf | 30 | 30 | 9.14 | 9.03 | 3 |
| Out | 28 | 28 | 9.01 | 8.93 | 4 |

<details><summary>Every board</summary>

| Area | Board | Store | Agent screen | Agent | Pass |
|---|---|---|---|---|---|
| Today | TD01Today | 9.0 | Today.dc.html (agent-ref) | 8.8 | ✓ |
| Today | TD09TodayMore | 9.0 | TodayBusy.dc.html (agent-ref) | 8.7 | ✓ |
| Today | TD02TodayNextCheckin | 9.0 | Today.dc.html (agent-ref) | 8.8 | ✓ |
| Today | TD03TodayNextRide | 8.9 | Today.dc.html (agent-ref) | 8.8 | ✓ |
| Today | TD04TodayCalm | 9.0 | Sales TD07TodayCalm | 9.0 | ✓ |
| Today | TD05TodayFirst | 9.0 | Sales TD06TodayFirst | 9.0 | ✓ |
| Today | TD06TodayOffline | 9.0 | Sales TD09TodayOffline | 9.0 | ✓ |
| Today | TD07TodayFailed | 9.0 | ClientsEmpty.dc.html (agent-ref) · P24/P28 | 8.7 | ✓ |
| Today | TD08TodayUpdate | 9.0 | Today.dc.html (agent-ref) | 8.8 | ✓ |
| Today | TD33TodayPressed | 9.0 | Today.dc.html (agent-ref) | 8.8 | ✓ |
| Today | TD10Alerts | 9.0 | Sales TD19Asks | 9.0 | ✓ |
| Today | TD11WithRuth | 9.0 | Sales TD19Asks | 9.0 | ✓ |
| Today | TD29AlertsEmpty | 9.0 | ClientsEmpty.dc.html (agent-ref) · P24/P28 | 8.7 | ✓ |
| Today | TD30WithRuthEmpty | 9.0 | Sales TD20AsksEmpty | 9.0 | ✓ |
| Today | TD12You | 9.0 | Sales TD18You | 9.0 | ✓ |
| Today | TD13PassYard | 9.0 | Sales CH30HandOver | 9.0 | ✓ |
| Today | TD18PassYardSending | 9.0 | Sales KC13Selling (slide Sending…) | 9.0 | ✓ |
| Today | TD14PassYardSent | 9.0 | Sent.dc.html (agent-ref) | 8.8 | ✓ |
| Today | TD24PassYardNobody | 8.9 | ClientsEmpty.dc.html (agent-ref) · P24/P28 | 8.7 | ✓ |
| Today | TD15PassYardGot | 9.0 | Today.dc.html (agent-ref) | 8.8 | ✓ |
| Today | TD25PassYardTaking | 9.0 | Today.dc.html (agent-ref) | 8.8 | ✓ |
| Today | TD26PassYardFailed | 9.0 | Sales CH12ChatNotSent (P28 failed save) | 9.0 | ✓ |
| Today | TD32OkelloToday | 9.0 | Today.dc.html (agent-ref) | 8.8 | ✓ |
| Today | TD16CloseYard | 9.0 | Sales OR07Packing (track sheet) | 9.0 | ✓ |
| Today | TD19CloseYardSending | 9.0 | Sales KC13Selling (slide Sending…) | 9.0 | ✓ |
| Today | TD17Closed | 9.0 | Sent.dc.html (agent-ref) | 8.8 | ✓ |
| Today | TD27CloseYardOffline | 9.0 | Sales TD09TodayOffline | 9.0 | ✓ |
| Today | TD28CloseYardDisabled | 9.0 | Sales KC13Selling (slide Sending…) | 9.0 | ✓ |
| Today | TD20SignIn | 9.0 | SignIn.dc.html (agent-ref) | 8.7 | ✓ |
| Today | TD23SignInSending | 9.0 | SignIn.dc.html (agent-ref) | 8.7 | ✓ |
| Today | TD31SignInError | 9.0 | SignIn.dc.html (agent-ref) | 8.7 | ✓ |
| Today | TD21Checking | 9.0 | P25 skeleton (agent Today) | 8.8 | ✓ |
| Today | TD22NoReach | 9.0 | ClientsEmpty.dc.html (agent-ref) · P24/P28 | 8.7 | ✓ |
| Pack | PK01ToPack | 8.9 | PackingBusy.dc.html / MovePacking.dc.html (agent-ref) | 8.8 | ✓ |
| Pack | PK02Pack | 9.0 | PackCard.dc.html + Track3.dc.html (agent-ref); OR07Packing (Sales) | 8.8 | ✓ |
| Pack | PK03PackPressed | 9.1 | PackCard.dc.html (agent-ref) | 8.8 | ✓ |
| Pack | PK04PackShort | 8.9 | PackLine.dc.html (agent-ref) | 8.8 | ✓ |
| Pack | PK05PackShortSent | 8.9 | Track3.dc.html + P28 undo toast | 8.8 | ✓ |
| Pack | PK06Packed | 9.0 | Sent.dc.html / P22 (agent-ref) | 9.0 | ✓ |
| Pack | PK07PackedPickup | 9.1 | NansubugaReady.dc.html / P22; OR38PickupGate (Sales) | 9.1 | ✓ |
| Pack | PK08ForYou | 8.9 | PackingBusy.dc.html (agent-ref) | 8.8 | ✓ |
| Pack | PK09LookOnly | 8.8 | Track3.dc.html (agent-ref) | 8.8 | ✓ |
| Pack | PK10CalledOff | 8.9 | Track3.dc.html + P15 slide | 8.8 | ✓ |
| Pack | PK11PackOffline | 8.8 | P27 notice bar, live t08 | 8.8 | ✓ |
| Pack | PK12PackFailed | 8.9 | live t11 error toast | 8.8 | ✓ |
| Pack | PK13SomeoneElse | 8.8 | PackingBusy.dc.html + P27 notice bar | 8.8 | ✓ |
| Pack | PK14ToPackEmpty | 9.1 | ClientsEmpty.dc.html (agent-ref) | 9.1 | ✓ |
| Pack | PK15Unpack | 9.0 | Track3.dc.html + P28 undo toast | 8.8 | ✓ |
| Pack | PK16PackShortSending | 8.8 | PackLine.dc.html, live busy state | 8.8 | ✓ |
| Pack | PK17LookOkello | 8.9 | Track3.dc.html (agent-ref) | 8.8 | ✓ |
| Pack | PK18PackSending | 9.0 | PackCard.dc.html, live busy state | 8.7 | ✓ |
| Pack | PK19PackShortFailed | 8.9 | live t11 error toast | 8.8 | ✓ |
| Pack | PK20ToPackOffline | 8.9 | PackingBusy.dc.html + P27, live t08 | 8.8 | ✓ |
| Pack | PK21WaitsForGoods | 8.9 | Track3.dc.html (agent-ref) | 8.8 | ✓ |
| Pack | PK22PutBackFailed | 8.9 | live t11 error toast | 8.8 | ✓ |
| Goods in | IN01ComingIn | 9.0 | MovePacking.dc.html + PackingBusy.dc.html (agent-ref) | 8.8 | ✓ |
| Goods in | IN02Checkin | 9.0 | Track.dc.html (P04/P12) + Order.dc.html dock (P15) | 8.9 | ✓ |
| Goods in | IN03CheckinShort | 9.0 | PackLine.dc.html (agent-ref) | 8.8 | ✓ |
| Goods in | IN04CheckinExtra | 9.0 | ClientPick.dc.html (agent-ref, P17) | 9.0 | ✓ |
| Goods in | IN05CheckinSending | 9.0 | Order.dc.html dock, sending (t01) | 9.0 | ✓ |
| Goods in | IN06CheckedIn | 9.0 | Sent.dc.html (agent-ref, P22) | 9.0 | ✓ |
| Goods in | IN07CheckinOffline | 8.9 | Main.dc.html t08-offline / SL27Offline (Sales) | 8.9 | ✓ |
| Goods in | IN08CheckinFailed | 9.0 | Main.dc.html t11 error toast (agent-ref) | 8.9 | ✓ |
| Goods in | IN09CheckinSomeoneElse | 9.0 | PackingBusy.dc.html + P27 notice bar (agent-ref) | 8.8 | ✓ |
| Goods in | IN10Delivery | 9.0 | Track.dc.html + Order.dc.html dock (agent-ref) | 8.9 | ✓ |
| Goods in | IN11DeliveryDiffers | 9.0 | PackLine.dc.html (agent-ref) | 8.8 | ✓ |
| Goods in | IN12DeliveryDone | 9.0 | Sent.dc.html (agent-ref, P22) | 9.0 | ✓ |
| Goods in | IN13ExtraAnswered | 9.0 | Track.dc.html (decision) (agent-ref) | 8.9 | ✓ |
| Goods in | IN14DeliverySending | 9.0 | Order.dc.html dock, sending (t01) | 9.0 | ✓ |
| Goods in | IN15DeliveryOffline | 9.0 | Main.dc.html t08-offline (agent-ref) | 8.9 | ✓ |
| Goods in | IN16ExtraSending | 9.0 | ClientPick.dc.html, sending (agent-ref) | 9.0 | ✓ |
| Goods in | IN20Return | 9.0 | ChangeAsk.dc.html (agent-ref) / OR22ReturnAsked (Sales) | 8.8 | ✓ |
| Goods in | IN21ReturnSent | 9.0 | Sent.dc.html (agent-ref, P22) | 9.0 | ✓ |
| Goods in | IN22ReturnDecided | 9.0 | Track.dc.html (P18 rail) (agent-ref) | 8.9 | ✓ |
| Goods in | IN23ReturnSending | 9.0 | ChangeAsk.dc.html, sending (agent-ref) | 8.8 | ✓ |
| Goods in | IN24ReturnOffline | 9.0 | Main.dc.html t08-offline (agent-ref) | 8.9 | ✓ |
| Goods in | IN25ReturnFailed | 9.0 | Main.dc.html t11 error toast (agent-ref) | 8.9 | ✓ |
| Goods in | IN30Ride | 9.0 | PackResults.dc.html / Track.dc.html (agent-ref) | 8.7 | ✓ |
| Goods in | IN31RideHandIn | 9.0 | Track.dc.html + Order.dc.html dock (agent-ref) | 8.9 | ✓ |
| Goods in | IN32RideDone | 9.0 | Sent.dc.html (agent-ref, P22) | 9.0 | ✓ |
| Goods in | IN33RideOffline | 9.0 | Main.dc.html t08-offline (agent-ref) | 8.9 | ✓ |
| Goods in | IN34RideHandInSending | 9.0 | Order.dc.html dock, sending (t01) | 9.0 | ✓ |
| Goods in | IN35RideHandInFailed | 9.0 | Main.dc.html t11 error toast (agent-ref) | 8.9 | ✓ |
| Goods in | IN40ComingInEmpty | 9.1 | ClientsEmpty.dc.html (agent-ref, P24) | 9.1 | ✓ |
| Shelf | SH01Shelf | 9.0 | Clients.dc.html (P03) + Today.dc.html Needs you | 8.9 | ✓ |
| Shelf | SH41ShelfOffline | 9.1 | TD09TodayOffline (sales) | 9.1 | ✓ |
| Shelf | SH04Aisle | 9.2 | SL12Aisle (sales) | 9.2 | ✓ |
| Shelf | SH05AisleEmpty | 9.1 | ClientsEmpty.dc.html (P24) | 9.1 | ✓ |
| Shelf | SH02Find | 9.2 | TD13FindItem (sales) | 9.2 | ✓ |
| Shelf | SH42FindNone | 9.2 | TD14FindNothing (sales) | 9.2 | ✓ |
| Shelf | SH40Scan | 9.0 | Find.dc.html (no agent scanner) | 9.0 | ✓ |
| Shelf | SH03Item | 9.3 | FindStock.dc.html / Track.dc.html | 8.7 | ✓ |
| Shelf | SH22ReportDecided | 9.3 | Track5.dc.html | 8.8 | ✓ |
| Shelf | SH24ReportKept | 9.2 | Track5.dc.html | 8.8 | ✓ |
| Shelf | SH16CountAccepted | 9.2 | Track5.dc.html | 8.8 | ✓ |
| Shelf | SH32AskAnswered | 9.1 | Track5.dc.html | 8.8 | ✓ |
| Shelf | SH10Count | 9.3 | KC20CountType (sales) | 9.3 | ✓ |
| Shelf | SH11CountSending | 9.1 | Order.dc.html sending (P26/P28) | 9.1 | ✓ |
| Shelf | SH12CountSent | 9.3 | KC25AskSent (sales) | 9.2 | ✓ |
| Shelf | SH13CountAgain | 9.1 | Update.dc.html + P26 disabled | 9.0 | ✓ |
| Shelf | SH14AisleCount | 8.7 | PackResults.dc.html / PackCard.dc.html | 8.7 | ✓ |
| Shelf | SH15CountWaiting | 9.1 | ChangeOpen.dc.html (P17) | 8.9 | ✓ |
| Shelf | SH17CountFailed | 9.1 | agent error toast (P28) | 9.0 | ✓ |
| Shelf | SH18CountKept | 9.1 | agent offline (P27) / TD09 | 9.0 | ✓ |
| Shelf | SH19CountPressed | 9.1 | agent pressed state (§C) | 9.1 | ✓ |
| Shelf | SH25SomeoneElse | 9.1 | agent 'Someone else' notice (P27) | 9.0 | ✓ |
| Shelf | SH20Report | 9.2 | OR21Return (sales) | 9.2 | ✓ |
| Shelf | SH21ReportSent | 9.3 | KC25AskSent (sales) | 9.2 | ✓ |
| Shelf | SH23ReportEmptyShelf | 9.1 | ClientsEmpty.dc.html (P24) | 9.1 | ✓ |
| Shelf | SH30Ask | 9.2 | TD23AskNew (sales) | 9.1 | ✓ |
| Shelf | SH31AskSent | 9.3 | KC25AskSent (sales) | 9.2 | ✓ |
| Shelf | SH26ReportNotSent | 9.1 | agent offline (P27) / TD09 | 9.0 | ✓ |
| Shelf | SH27ReportFailed | 9.1 | agent error toast (P28) | 9.0 | ✓ |
| Shelf | SH06NeedsLookEmpty | 9.1 | TodayEmpty.dc.html / ClientsEmpty.dc.html (P24) | 9.1 | ✓ |
| Out | OU01ToLoad | 8.9 | PackingBusy.dc.html (agent-ref) | 8.9 | ✓ |
| Out | OU02Load | 9.0 | DelOnWay.dc.html + Track4.dc.html (agent-ref) | 8.9 | ✓ |
| Out | OU03LoadHired | 9.0 | ClientPick.dc.html (agent-ref) | 9.0 | ✓ |
| Out | OU04LoadSending | 9.0 | Main.dc.html t01-plus sending (agent-ref) | 8.9 | ✓ |
| Out | OU05Loaded | 9.1 | MoveSent.dc.html (agent-ref) | 8.5 | ✓ |
| Out | OU06LoadNotSent | 9.0 | CH12ChatNotSent.dc.html (sales-agent) / P27 | 9.0 | ✓ |
| Out | OU07LoadFailed | 9.0 | t11-toast-bad as a bar (agent-ref Main) | 9.0 | ✓ |
| Out | OU08GateSending | 9.0 | t01-plus sending (agent-ref Main) | 9.0 | ✓ |
| Out | OU09GateWrongCode | 9.0 | NansubugaReady.dc.html + error tone (agent-ref) | 9.0 | ✓ |
| Out | OU10Gate | 9.1 | NansubugaReady.dc.html + OutBusy.dc.html (agent-ref) | 9.0 | ✓ |
| Out | OU11GateAgent | 9.0 | NansubugaReady.dc.html (code chip) + keypad (agent-ref) | 9.0 | ✓ |
| Out | OU12HandedOver | 9.1 | MoveSent.dc.html (agent-ref) | 8.5 | ✓ |
| Out | OU13GateNotPaid | 9.0 | Track.dc.html / OR38PickupGate.dc.html | 8.9 | ✓ |
| Out | OU14OnTheRoadEmpty | 9.0 | ClientsEmpty.dc.html (agent-ref) | 8.9 | ✓ |
| Out | OU15GateEmpty | 9.0 | ClientsEmpty.dc.html (agent-ref) | 8.9 | ✓ |
| Out | OU16GateOffline | 9.0 | Main.dc.html t08-offline / P27 + NansubugaReady.dc.html | 9.0 | ✓ |
| Out | OU17LoadPressed | 9.0 | t01-plus slide mid-drag (agent-ref Main) | 9.0 | ✓ |
| Out | OU20Road | 9.0 | OutBusy.dc.html / MoveOut.dc.html (agent-ref) | 9.0 | ✓ |
| Out | OU21Door | 9.1 | DelOnWay.dc.html (agent-ref) | 8.9 | ✓ |
| Out | OU22Delivered | 9.1 | DelDone.dc.html (agent-ref) | 8.9 | ✓ |
| Out | OU23NoPhoto | 9.0 | ClientPick.dc.html (agent-ref) | 9.0 | ✓ |
| Out | OU24CantDeliver | 9.0 | ChangeOpen.dc.html / Track.dc.html (agent-ref) | 8.9 | ✓ |
| Out | OU25RoadOffline | 9.0 | Main.dc.html t08-offline / P27 | 8.9 | ✓ |
| Out | OU26DoorSending | 9.0 | DelOnWay.dc.html + sending (agent-ref) | 9.0 | ✓ |
| Out | OU27CancelledOnTruck | 9.0 | OutBusy.dc.html + ChangeCancelled.dc.html (agent-ref) | 9.0 | ✓ |
| Out | OU28DoorNotSent | 9.0 | DelOnWay.dc.html + P27 notice bar | 9.0 | ✓ |
| Out | OU30ToLoadEmpty | 9.0 | ClientsEmpty.dc.html (agent-ref) | 8.9 | ✓ |
| Out | OU31NameDirection | 9.0 | ClientPick sheet + DelSetup.dc.html (agent-ref) | 9.0 | ✓ |

</details>

## Waiting on Kevin

1. **Approve the canvas** — then the build starts in the Store's session (one migration for the new pushes, the next free number after 0181, recorded in `docs/decision-rights.md`).
2. **The blind rule in Find**: on the yard's phone an item due for a count shows "Count due" in place of its figure (an audit fix), where Sales shows "96 on shelf" (SH02). Keep it?
3. **Who gives out a yard login** when nobody can take the yard at the end of a shift (TD24 asks Ruth).
4. **A ridden trip is checked in by someone else** (Okello) so the count stays blind (IN31, IN32). Confirm.
5. **The supplier's delivery note photo goes to Esther** (Accounts pays suppliers). Confirm the push.
6. **A return before the bill** (#0548): the yard says "Ruth checks it" and never names a credit note; Ruth settles it once the 24-hour bill is out (IM-12, with Sales OR21).
7. **Aisle C has 132 items**: split an aisle count by shelf (C1–C4)?
8. **The new shared words** in the glossary (Ready to collect, Back at the yard, Coming back, Cancelled · put it back / bring it back, Counter sale, Delivered today) take effect when the canvas is approved.
9. Sample-day gaps filled on the boards, to confirm or replace: #0534's three lines (OU27), Okello's count (SH25), a few "just now" states after 10:41 (SH13, SH16, SH22, SH24, SH25, SH32), the hired drivers Abudu and Juma (OU03).
