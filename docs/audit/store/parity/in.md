# Canvas parity — Store · Goods in (IN, 29 boards)

The builder's record (an independent critic re-checks). Each board beside the app at 360 × 800, the app reached by the taps in `test/parity/store-in.json`.

**How it was run.** `NODE_PATH=$(npm root -g) node tools/parity/run.cjs --tab store-in`, every board reached by real taps from Today (Today's Coming in tile, 'Check in Hima Cement, 1 line', 'Start the trip to Katwe Timber'), IN13 and IN22 from the push the board names (`&push=`). Shots and `results.json` in this folder. Taps count `tap` steps; the slide is pressed from the keyboard (Tab to the knob, Enter), a drag cannot be a step.

Every board was also checked for: no control under 44 px (the 100-bag tile reads 43 only while it is drawn pressed, scale .97), no text under 11 px, nothing wider than 360 (scrollWidth 360 on all 29), every control landing where the board links.

**2026-11-12, the critic's G1–G13 fixed** (`docs/audit/store/CANVAS-PARITY.md` "## Goods in"; the boards redrawn with the app are in `docs/canvas/store-agent/review/IN-fixes.md`):
- **Undo** (G4): the check-in, the delivery and the ride hand-in go through `core/store/held.ts` (`store.ts hold`, quiet), as Out's end screens do: the slide shows Checked in / Handed in at once with "Undo 10 s", nothing is sent until the 10 s end (or the screen changes), then it goes. No signal: after its 10 s the write is kept on the phone and the screen turns to its kept state (IN07, IN15, IN33); refused: the red bar (IN08, IN35). "Sending…" (IN05, IN14, IN34) is Try again's. The end screen's bar runs 12 s when it has Undo, so it goes home after the write went. A check-in still kept on this phone reopens as kept, so it is not sent twice.
- **The saved time** (G5): "Updating · saved 11:30" is the outbox entry's time (when this work was kept), not the time the books were last read (7:52).
- **Close and the strip** (G6): Close goes to the board's place with `nav.to` (check-in, delivery, return → Coming in; ride and IN09 → Today); the strip goes back one and names the screen really below (`nav.ts backTo`).
- **Head buttons** (G3): Scan and Not on the list work while kept (the extra waits in the outbox too) and are `disabled` (dimmed) while sending.
- **The return** (G10–G13): the first chip "From Grace · Fri 15:40" (one row; wrapping stays as the fallback for a long name); a kept bag fades its picture only; sending dims only the bag strip, the switch and the camera; IN22's "At the gate" is the gate time the ask carries (`ReturnAsk.gateAt`; the demo keeps it, the real `store_return_ask` has no field for it, so the books show the sent time); "2 bag · back wall" 11 px regular mono.
- **The delivery** (G7–G9): the head reads "at the yard 12:00"; the torn bags overlap −8 px.
- **The stage head** (G1, G2): IN01 and IN40 redrawn with PK01's head; IN40's Ask Denis opens Find (spec §2a ruling).

| Board | Route | Taps | Diff % | Result | Notes |
|---|---|---|---|---|---|
| IN01ComingIn | `in` | 1 | 5.78 | pass | The board now draws PK01's head (spec §2a); what differs is the head as PK01's own diff. "A supplier turned up" opens the listed delivery (the board's stand-in link) |
| IN40ComingInEmpty | `in` (`&at=1730`) | 1 | 3.81 | pass | Head as IN01. The pill counts 4 checked in by 17:30 (the board draws 3). Ask Denis for more opens `shelf/find`, as the board now links (spec §2a ruling) |
| IN02Checkin | `in/checkin` | 3 | 1.27 | pass | The board's pressed "1 tin" is the moment of a tap; the line opens by itself after 4 box |
| IN03CheckinShort | `in/checkin` | 6 | 0.04 | pass | 20 pc tiles go in twos, so 18 is one tile |
| IN04CheckinExtra | sheet `openNotOnList` | 7 | 3.49 | pass | 2 px vertical offsets in the sheet |
| IN16ExtraSending | sheet | 8 | 3.64 | pass | `&slow=1` holds the write |
| IN05CheckinSending | `in/checkin` (`&fail=checkIn`) | 7 | 3.08 | pass | The held check-in refused once, then Try again: Sending…; Scan and Not on the list dimmed and disabled |
| IN06CheckedIn | `in/checkin` | 6 | 2.12 | pass | Undo 10 s while the check-in waits. The mint bar runs to its end in the shot. 11:30 for 11:34 (fixed clock) |
| IN07CheckinOffline | `in/checkin` (`&offline=1`) | 6 | 2.3 | pass | After its 10 s, kept; "saved 11:30" is when it was kept (board 11:33). Scan and Not on the list live |
| IN08CheckinFailed | `in/checkin` (`&fail=checkIn`) | 6 | 2.58 | pass | After its 10 s, refused once. Red bar's Try again: 40 px drawn in a 44 px target |
| IN09CheckinSomeoneElse | `in/checkin` (`&state=someone-checkin`) | 6 | 2.19 | pass | After its 10 s the held check-in meets Okello's. Close: back to Today. Grace's face is t0 blue in the demo; FACTS and the boards draw her navy (every board with GA) |
| IN13ExtraAnswered | `in/checkin` via push `store.ask.decided` | 0 | 0.57 | pass | |
| IN10Delivery | `in/delivery` (`&at=1200`) | 3 | 0.23 | pass | "Torn?" now on the board too; head "at the yard 12:00" |
| IN11DeliveryDiffers | `in/delivery` | 7 | 0.3 | pass | Torn bags overlap −8 px; "Torn bags" on one line |
| IN14DeliverySending | `in/delivery` (`&fail=checkIn`) | 4 | 2.37 | pass* | Refused once, then Try again: Sending…; the head buttons dimmed as the board now draws. *The aisle bar is the shelf now, `shelf.ts` `onShelf`: 118 → 218 at 12:00, where the board draws FACTS' 10:41 figure 120 → 220 (#0556's 2 bags were collected 11:10) |
| IN15DeliveryOffline | `in/delivery` (`&offline=1`) | 3 | 2.33 | pass* | as IN14; "saved 12:00" when it was kept (board 12:04) |
| IN12DeliveryDone | `in/delivery` | 3 | 8.89 | pass* | Undo 10 s while it waits. *The board's bag pictures sit 10 px lower and its 5 bags are wider; 12:00 for 12:05 (fixed clock) |
| IN20Return | `in/return` (`&at=1102`) | 3 | 0.41 | pass | One row of chips ("From Grace · Fri 15:40"); "kept" at full strength. The photo is the demo's sample |
| IN23ReturnSending | `in/return` (`&slow=1`) | 4 | 0.44 | pass | Dims only the bag strip, the switch and the camera |
| IN21ReturnSent | `in/return` | 4 | 5.32 | pass | Undo 10 s takes it back (W18a). 11:02 for 11:03 (fixed clock) |
| IN24ReturnOffline | `in/return` (`&offline=1`) | 4 | 0.63 | pass | |
| IN25ReturnFailed | `in/return` (`&fail=returnAsk`) | 4 | 4.41 | pass | "Grace sees Return asked" above the red bar again. The board's button runs past the bottom under the red bar; the app keeps it whole |
| IN22ReturnDecided | `in/return` via push `invoice.ask.decided` | 0 | 0.06 | pass | At the gate 11:02 (the ask's gate time), Sent 11:03; "2 bag · back wall" regular |
| IN30Ride | `in/ride` (`&at=1534`) | 2 | 0.65 | pass | |
| IN31RideHandIn | `in/ride` (`&at=1552`) | 3 | 0.76 | pass | Katwe Timber reads 15:52 (fixed clock; board 15:34) |
| IN34RideHandInSending | `in/ride` (`&fail=rideHandIn`) | 5 | 0.85 | pass | The held hand-in refused once, then Try again: Sending… |
| IN33RideOffline | `in/ride` (`&offline=1`) | 3 | 0.79 | pass | "saved 15:52" when the ticks were kept |
| IN35RideHandInFailed | `in/ride` (`&fail=rideHandIn`) | 4 | 1.08 | pass | After its 10 s, refused once |
| IN32RideDone | `in/ride` | 4 | 5.86 | pass | Undo 10 s while the hand-in waits; the board's end screen sits 4 px higher |

29 of 29 pass by the builder's measure (three with a starred note). The critic's verdicts in `CANVAS-PARITY.md` are left for the critic's re-run.
