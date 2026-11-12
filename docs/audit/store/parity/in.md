# Canvas parity — Store · Goods in (IN, 29 boards)

The builder's record (an independent critic re-checks). Each board beside the app at 360 × 800, the app reached by the taps in `test/parity/store-in.json`.

**How it was run.** `NODE_PATH=$(npm root -g) node tools/parity/run.cjs --tab store-in`, every board reached by real taps from Today (Today's Coming in tile, 'Check in Hima Cement, 1 line', 'Start the trip to Katwe Timber'), IN13 and IN22 from the push the board names (`&push=`). Shots and `results.json` in this folder. Taps count `tap` steps; the slide is pressed from the keyboard (Tab to the knob, Enter), a drag cannot be a step.

Every board was also checked for: no control under 44 px (the 100-bag tile reads 43 only while it is drawn pressed, scale .97), no text under 11 px, nothing wider than 360 (scrollWidth 360 on all 29), every control landing where the board links.

| Board | Route | Taps | Diff % | Result | Notes |
|---|---|---|---|---|---|
| IN01ComingIn | `in` | 1 | 9.54 | fail (head) | The body matches row for row. The head is the shared stage sheet (`shell/StageSheet.tsx`, PK01/OU01's 40 px strip, rounded foot, rail) — IN01 draws its own 24 px strip and taller rail; one head for the five rail stops was kept. The rail's Coming in icon is now IN01's (arrive), not a cart. "A supplier turned up" opens the listed delivery (the board's stand-in link); see the report |
| IN40ComingInEmpty | `in` (`&at=1730`) | 1 | 8.88 | fail (head) | As IN01 for the head. The pill counts 4 checked in by 17:30 (the board draws 3). Ask Denis for more opens `shelf/find` (an ask needs an item) |
| IN02Checkin | `in/checkin` | 3 | 1.27 | pass | The board's pressed "1 tin" is the moment of a tap; the line opens by itself after 4 box |
| IN03CheckinShort | `in/checkin` | 6 | 0.04 | pass | 20 pc tiles go in twos, so 18 is one tile |
| IN04CheckinExtra | sheet `openNotOnList` | 7 | 3.55 | pass | 2 px vertical offsets in the sheet |
| IN16ExtraSending | sheet | 8 | 3.64 | pass | `&slow=1` holds the write |
| IN05CheckinSending | `in/checkin` | 6 | 3.08 | pass | Slide pressed from the keyboard (Tab to the knob, Enter) |
| IN06CheckedIn | `in/checkin` | 6 | 2.19 | pass* | *No Undo chip: no write takes a check-in back (report). The mint bar runs to its end in the shot |
| IN07CheckinOffline | `in/checkin` (`&offline=1`) | 6 | 2.49 | pass | "saved 7:52" is the demo's offline copy (board 11:33) |
| IN08CheckinFailed | `in/checkin` (`&fail=checkIn`) | 6 | 2.58 | pass | Red bar's Try again: 40 px drawn in a 44 px target |
| IN09CheckinSomeoneElse | `in/checkin` (`&state=someone-checkin`) | 6 | 2.19 | pass | Grace's face is t0 blue in the demo; FACTS and the boards draw her navy (every board with GA) |
| IN13ExtraAnswered | `in/checkin` via push `store.ask.decided` | 0 | 0.46 | pass | |
| IN10Delivery | `in/delivery` (`&at=1200`) | 3 | 1.31 | pass | "Torn?" right of the name once counted: the way to IN11, which no board draws |
| IN11DeliveryDiffers | `in/delivery` | 7 | 0.74 | pass | |
| IN14DeliverySending | `in/delivery` (`&slow=1`) | 3 | 2.52 | pass* | *The aisle bar is the shelf now, `shelf.ts` `onShelf` (integration 2026-11-11): 118 → 218 at 12:00, where the board draws FACTS' 10:41 figure 120 → 220; #0556's 2 bags were packed (and collected 11:10) before the delivery. |
| IN15DeliveryOffline | `in/delivery` (`&offline=1`) | 3 | 2.52 | pass* | as IN14 |
| IN12DeliveryDone | `in/delivery` | 3 | 9.04 | fail (minor) | No Undo chip (as IN06); the board's bag pictures sit 10 px lower and its 5 bags are wider; 12:00 for 12:05 (fixed demo clock) |
| IN20Return | `in/return` (`&at=1102`) | 3 | 19.38 | pass | The head's two chips are 327 px for a 320 px row (342 with the phone's Figtree): the board lets "Ssali brought it" run past the padding, which made the sheet 362 px wide on a 360 screen (e2e). The chips now wrap: nothing clipped, the second on its own line, the body 36 px lower. The photo is the demo's sample |
| IN23ReturnSending | `in/return` (`&slow=1`) | 4 | 17.74 | pass | As IN20: the head's chips wrap. The board dims a little less |
| IN21ReturnSent | `in/return` | 4 | 5.34 | pass | Undo 10 s takes it back (W18a). 11:02 for 11:03 (fixed clock) |
| IN24ReturnOffline | `in/return` (`&offline=1`) | 4 | 19.02 | pass | As IN20: the head's chips wrap |
| IN25ReturnFailed | `in/return` (`&fail=returnAsk`) | 4 | 23 | pass | As IN20: the head's chips wrap. The board's button runs past the bottom under the red bar; the app keeps it whole |
| IN22ReturnDecided | `in/return` via push `invoice.ask.decided` | 0 | 0.26 | pass | At the gate and Sent both read 11:03 (one time on the books) |
| IN30Ride | `in/ride` (`&at=1534`) | 2 | 0.65 | pass | |
| IN31RideHandIn | `in/ride` (`&at=1552`) | 3 | 0.76 | pass | Katwe Timber reads 15:52 (fixed clock; board 15:34) |
| IN34RideHandInSending | `in/ride` (`&slow=1`) | 4 | 0.85 | pass | |
| IN33RideOffline | `in/ride` (`&offline=1`) | 3 | 0.86 | pass | |
| IN35RideHandInFailed | `in/ride` (`&fail=rideHandIn`) | 4 | 1.08 | pass | |
| IN32RideDone | `in/ride` | 4 | 6 | pass* | *No Undo chip (as IN06); the board's end screen sits 4 px higher |

26 of 29 pass (four with a starred note); IN01 and IN40 differ in the shared stage-sheet head only, IN12 by the missing Undo chip and its bag row.
