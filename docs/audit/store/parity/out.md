# Store parity · Out (OU, 28 boards)

Each board beside the app at 360 × 800 (`NODE_PATH=$(npm root -g) node tools/parity/run.cjs --tab store-out`), the app reached by real taps from the `job.given` push (routes §5: it opens To load; `&push=` in the demo) and the rail, specs in `test/parity/store-out.json`, shots in this folder. Judged by the builder as a strict critic; an independent critic re-checks.

Checked on every board: 44 px targets (the 36 px pills sit in 44 px links; the pen has a 44 px hit area), text ≥ 11 px, contrast ≥ 4.5:1 (dimmed controls are disabled), nothing clipped at 360, no money.

Residual everywhere: fonts and antialiasing; the shell's rail icons (Coming in and To load draw a cart and a hand where the boards draw an arrow and a stack: `shell/routes.ts` RAIL, left to the shell); Grace's face is the demo's light blue where the boards draw her navy (FACTS "GA navy", the demo gives t0).

| Board | Route | Demo · taps | Diff | Verdict | Notes |
|---|---|---|---|---|---|
| OU01ToLoad | `out/load` | `?demo&at=1052&push=job.given` · 0 | 6.73% | pass | Every word, figure and control as drawn; rows open out/run, Name it opens OU31. Residual: the shared rail icons (cart, hand-over where the board draws an arrow and a stack) and its lit pill 2 px off; GA tint. |
| OU02Load | `out/run` | `?demo&at=1315&push=job.given` · 1 | 0.99% | pass | Matches. The now-stop reads "now" where the board writes 10:05 (P18 Track). |
| OU03LoadHired | `out/run · Hired` | `?demo&at=1315&push=job.given` · 2 | 6.72% | pass | Matches; the sheet sits 4 px lower (LightSheet head), Abudu not drawn pressed. |
| OU17LoadPressed | `out/run` | `?demo&at=1315&push=job.given` · 2 | 9.32% | pass | Knob held, "Keep going", the hint line. The app keeps "Who drives" while the knob is held (no layout jump mid-drag); the board drops it. |
| OU04LoadSending | `out/run` | `?demo&at=1315&fail=load&push=job.given` · 3 | 1.06% | pass | Matches. |
| OU05Loaded | `out/run (end)` | `?demo&at=1315&push=job.given` · 2 | 0.47% | pass | Matches; the Undo row counts down from 10. |
| OU06LoadNotSent | `out/run` | `?demo&at=1315&offline&push=job.given` · 2 | 6.34% | pass | Matches; 2 px lower body under the bar. |
| OU07LoadFailed | `out/run` | `?demo&at=1315&fail=load&push=job.given` · 2 | 9.41% | pass | Matches (white Try again kept on the red bar as drawn). |
| OU10Gate | `out/gate` | `?demo&at=1047&state=agent&push=job.given` · 2 | 4.99% | pass | Matches; rail icons as OU01. |
| OU08GateSending | `out/gate` | `?demo&at=1047&state=agent&fail=handOver&push=job.given` · 4 | 4.5% | pass | Matches. |
| OU12HandedOver | `out/gate (end)` | `?demo&at=1047&state=agent&push=job.given` · 3 | 0.58% | pass | Matches. |
| OU13GateNotPaid | `out/gate { id }` | `?demo&push=job.given` · 2 | 7.17% | pass | Buying and Packing ticked, not "skipped" (Track draws a skipped stop as a dash); "ready" under the stop where the board writes "now". |
| OU15GateEmpty | `out/gate` | `?demo&state=empty&push=job.given` · 2 | 10.56% | partial | Ghost, words, To pack and tiles as drawn; see the gap. Gap: the demo has no 10:10 moment: no "Coming to the gate" list, no Delivered 1. |
| OU16GateOffline | `out/gate` | `?demo&at=1047&state=agent&offline&push=job.given` · 3 | 7.76% | pass | Matches; "by his code" hidden while sending as drawn. |
| OU11GateAgent | `out/gate-code` | `?demo&at=1047&state=agent&push=job.given` · 7 | 0.82% | pass | Matches. |
| OU09GateWrongCode | `out/gate-code` | `?demo&at=1047&state=agent&push=job.given` · 7 | 0.83% | pass | Matches. |
| OU20Road | `out/road` | `?demo&push=job.given` · 1 | 7.39% | pass | Matches; rail icons as OU01. |
| OU14OnTheRoadEmpty | `out/road` | `?demo&state=empty&push=job.given` · 1 | 10.07% | partial | Ghost, words, To load and tiles; see the gap. Gap: the demo has no 9:30 moment: no "Next out" list. |
| OU25RoadOffline | `out/road` | `?demo&offline&push=job.given` · 4 | 7.03% | pass | Matches; "saved 7:52" is the demo's offline copy (board 10:38). |
| OU27CancelledOnTruck | `out/road` | `?demo&state=cancel-0534&push=job.given` · 1 | 9.53% | pass | Matches; Ruth cancelled at 10:39 (demo) where the board writes 10:38. |
| OU21Door | `out/door` | `?demo&at=1405&push=job.given` · 2 | 0.33% | pass | Matches. |
| OU26DoorSending | `out/door` | `?demo&at=1405&fail=deliver&push=job.given` · 4 | 0.59% | pass | Matches. |
| OU22Delivered | `out/door (end)` | `?demo&at=1405&push=job.given` · 3 | 0.43% | pass | Matches. |
| OU23NoPhoto | `out/door · NoPhoto` | `?demo&at=1405&push=job.given` · 4 | 4.35% | pass | Matches; the reason is tapped (never preselected). |
| OU28DoorNotSent | `out/door` | `?demo&at=1405&offline&push=job.given` · 3 | 1.16% | pass | Matches. |
| OU24CantDeliver | `out/cant-deliver` | `?demo&push=job.given` · 4 | 3.34% | pass | Matches; the now-stop shows the truck where the board draws the return arrow, "now" for 9:55. |
| OU30ToLoadEmpty | `out/load` | `?demo&state=cancel-0530&push=job.given` · 0 | 9.89% | partial | Ghost, words, the packing row, To pack 1 and tiles as drawn. Gap: reached as #0530 cancelled (the board's moment is not in the demo). |
| OU31NameDirection | `out/load · NameSheet` | `?demo&at=1052&push=job.given` · 1 | 6.27% | pass | Matches; the scrim covers the real To load. |
