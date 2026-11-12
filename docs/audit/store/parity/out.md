# Store parity · Out (OU, 28 boards)

Each board beside the app at 360 × 800 (`NODE_PATH=$(npm root -g) node tools/parity/run.cjs --tab store-out`), the app reached by real taps from the `job.given` push (routes §5: it opens To load; `&push=` in the demo) and the rail, specs in `test/parity/store-out.json`, shots in this folder. Judged by the builder as a strict critic; an independent critic re-checks.

Checked on every board: 44 px targets (the 36 px pills sit in 44 px links; the pen has a 44 px hit area), text ≥ 11 px, contrast ≥ 4.5:1 (dimmed controls are disabled), nothing clipped at 360, no money.

**Critic fixes, 2026-11-12** (`CANVAS-PARITY.md` "## Out", G1–G10): all ten fixed in the app; the boards that drew the same fault are redrawn (`docs/canvas/store-agent/review/OU-fixes.md`); rulings in spec §2a. Every link re-tapped: the strips over the gate and Coming back name and land on the screen below; OU13's Close → the gate; OU24's Close and slide → On the road; OU14's and OU15's rows → To load and To pack.

Residual everywhere: fonts and antialiasing. Fixed in the integration pass (2026-11-11): To load's rail icon is the stack (`shell/routes.ts` RAIL, `layers` in `src/ui/icons.tsx`); every face comes from `src/core/store/faces.ts` (`yardFace`: the holder slate, Grace navy).

| Board | Route | Demo · taps | Diff | Verdict | Notes |
|---|---|---|---|---|---|
| OU01ToLoad | `out/load` | `?demo&at=1052&push=job.given` · 0 | 6.78% | pass | Every word, figure and control as drawn; rows open out/run, Name it opens OU31. The rail draws the stack for To load (`layers`, shared; integration 2026-11-11); Coming in keeps the shared arrow (IN01's, a little shorter than OU01's). Residual: the lit pill 2 px off. |
| OU02Load | `out/run` | `?demo&at=1315&push=job.given` · 1 | 0.99% | pass | Matches. The now-stop reads "now" where the board writes 10:05 (P18 Track). |
| OU03LoadHired | `out/run · Hired` | `?demo&at=1315&push=job.given` · 2 | 6.72% | pass | Matches; the sheet sits 4 px lower (LightSheet head), Abudu not drawn pressed. |
| AD01SomeoneNew | `out/run · Hired · SomeoneNew` | `?demo&at=1315&push=job.given` · 3 | 0.37% | pass | Added while building. OU03's "Someone new" opens it; the name focused on arrival; "Add a name first" (a tap takes the eye to the name, never a disabled button). |
| AD03SomeoneNewFilled | `out/run · SomeoneNew` | same, name, plate and phone typed · 3 | 0.58% | pass | "Phone checked" (load.ts hiredPhoneOk), Robert gets the drop on WhatsApp, navy "Robert drives" puts him on the run. The phone, typed last, keeps the focus ring. Robert Kasozi is the board's invented driver (AD open question 1). |
| AD04SomeoneNewPhone | `out/run · SomeoneNew` | same, a landline typed · 3 | 0.02% | pass | Amber field "Not a mobile number", "No drop on WhatsApp to a landline", "Fix the phone first". |
| OU17LoadPressed | `out/run` | `?demo&at=1315&push=job.given` · 2 | 2.08% | pass | Knob held, "Keep going", the hint line. G9: "Who drives" stays while the knob is held (nothing jumps under the thumb); the board is redrawn with it (spec §2a, `review/OU-fixes.md`). |
| OU04LoadSending | `out/run` | `?demo&at=1315&fail=load&push=job.given` · 3 | 1.06% | pass | Matches. |
| OU05Loaded | `out/run (end)` | `?demo&at=1315&push=job.given` · 2 | 0.47% | pass | Matches; the Undo row counts down from 10. |
| OU06LoadNotSent | `out/run` | `?demo&at=1315&offline&push=job.given` · 2 | 6.34% | pass | Matches; 2 px lower body under the bar. |
| OU07LoadFailed | `out/run` | `?demo&at=1315&fail=load&push=job.given` · 2 | 6.38% | pass | Matches (white Try again kept on the red bar as drawn). |
| OU10Gate | `out/gate` | `?demo&at=1047&state=agent&push=job.given` · 2 | 4.98% | pass | Matches. G1: the strip says "Back to On the road" and lands there (`StageSheet` `backTo`, every stage sheet; spec taps by selector because "On the road" and "Walk-in" also name Today's tile and row under the sheet). |
| OU08GateSending | `out/gate` | `?demo&at=1047&state=agent&fail=handOver&push=job.given` · 4 | 4.49% | pass | Matches. G1 strip; G3: "Code" is inactive while the hand-over is held (`aria-disabled`, no link), as its grey draws. |
| OU12HandedOver | `out/gate (end)` | `?demo&at=1047&state=agent&push=job.given` · 3 | 0.58% | pass | Matches. |
| OU13GateNotPaid | `out/gate { id }` | `?demo&push=job.given` · 2 | 7.21% | pass | G4: Close → the gate (`nav.to('out/gate')`); the strip says "Back to On the road". G5: Buying and Packing skipped (`trackTimes`), "ready" at the gate; Ask Ruth's disc teal, her face (spec §2a; board redrawn). The gate under it at 10:41 holds only #0555, not paid: "Nobody to hand over" with #0555 in Next at the gate (Open → this sheet), a state no board draws (Kevin: confirm). |
| OU15GateEmpty | `out/gate` | `?demo&at=1010&push=job.given` · 2 | 10.24% | pass | G6: the 10:10 moment (`demo/moments-out.ts`): Coming to the gate #0555 packing, #0554 and #0556 to pack; each row opens To pack. Reached by On the road's Ready chip. Board redrawn: "they collect" (no ready time while packing), "To pack 2". Delivered is a figure, not a link, as drawn. Residual: rows 2–6 px lower. |
| OU16GateOffline | `out/gate` | `?demo&at=1047&state=agent&offline&push=job.given` · 3 | 7.75% | pass | Matches; "by his code" hidden while sending as drawn. G1 strip; G3 "Code" inactive while kept. |
| OU11GateAgent | `out/gate-code` | `?demo&at=1047&state=agent&push=job.given` · 7 | 0.38% | pass | G7: Ready to collect drawn under the scrim (the gate below, inert). G2: the eyebrow `--ink-soft` (board redrawn). |
| OU09GateWrongCode | `out/gate-code` | `?demo&at=1047&state=agent&push=job.given` · 7 | 0.39% | pass | G7, G2 as OU11. |
| OU20Road | `out/road` | `?demo&push=job.given` · 1 | 7.35% | pass | Matches; no "Done" chip (Kevin 2026-11-11, Q22: Today's Delivered today is the one place). |
| OU14OnTheRoadEmpty | `out/road` | `?demo&at=930&push=job.given` · 1 | 11.19% | pass | G6: the 9:30 moment: Next out #0534, #0547, each row opens To load; Delivered is a figure, not a link, as drawn. Board redrawn: "Next out" (no driver), "Ntinda", "To load 3" (#0530 is packed too). Residual: the ghost and rows 6–8 px lower. |
| OU25RoadOffline | `out/road` | `?demo&offline&push=job.given` · 4 | 7.02% | pass | Matches; "saved 7:52" is the demo's offline copy (board 10:38). |
| OU27CancelledOnTruck | `out/road` | `?demo&state=cancel-0534&push=job.given` · 1 | 9.66% | pass | G8: Ruth cancelled 10:38, as drawn; the put-back row 44 px. |
| OU21Door | `out/door` | `?demo&at=1405&push=job.given` · 2 | 0.33% | pass | Matches. |
| OU26DoorSending | `out/door` | `?demo&at=1405&fail=deliver&push=job.given` · 4 | 0.59% | pass | Matches. |
| OU22Delivered | `out/door (end)` | `?demo&at=1405&push=job.given` · 3 | 0.43% | pass | Matches. |
| OU23NoPhoto | `out/door · NoPhoto` | `?demo&at=1405&push=job.given` · 4 | 4.35% | pass | Matches; the reason is tapped (never preselected). G2: the eyebrow on the ground sheet `--ink-soft` (`src/ui/sheet.css`; board redrawn). |
| OU28DoorNotSent | `out/door` | `?demo&at=1405&offline&push=job.given` · 3 | 1.16% | pass | Matches. |
| OU24CantDeliver | `out/cant-deliver` | `?demo&push=job.given` · 4 | 3.31% | pass | G5: the now-stop draws the return arrow and 9:55 (`Track` `nowIcon`, `nowTime`). G10: Close and the slide → On the road; the strip says "Back to the door" and lands there. |
| OU30ToLoadEmpty | `out/load` | `?demo&state=cancel-0530&push=job.given` · 0 | 9.88% | partial | Ghost, words, the packing row, To pack 1 and tiles as drawn. Gap: reached as #0530 cancelled (the board's moment is not in the demo). |
| OU31NameDirection | `out/load · NameSheet` | `?demo&at=1052&push=job.given` · 1 | 6.27% | pass | Matches; the scrim covers the real To load. G2: the eyebrow `--ink-soft` (board redrawn). |
