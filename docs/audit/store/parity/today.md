# Canvas parity — Store, Today and the shell (TD, 33 boards)

Spec `test/parity/store-today.json`; shots `docs/audit/store/parity/<Board>.png` (board left, app right) and `.diff.png`; figures in `results.json`. Run: `npm run build:store && NODE_PATH=$(npm root -g) node tools/parity/run.cjs --tab store-today`. Judged by the builder after the critic's T1–T27 (`../CANVAS-PARITY.md` "## Today", 2026-11-12); the critic's verdicts there are left as they were. Boards redrawn with the app: `docs/canvas/store-agent/review/TD-fixes.md`. Every screen checked at 360 × 800 for 44 px targets, text ≥ 11 px, no clipping; slides are committed from the keyboard (Tab to the knob, Enter).

| Board | Route | Taps | Diff % | Result | Notes |
|---|---|---|---|---|---|
| TD01Today | `today` | 0 | 1.94 | pass | T1, T2: `--on-navy` on the tiles, the blue tag `#B8C8F0`, board redrawn the same. No "Ssali 13:20": the books keep no run time (screens Q25, left out). |
| TD09TodayMore | `today` (scrolled) | 1 | 13.7 | pass | The scroll offset and the head's shadow (accepted). |
| TD33TodayPressed | `today` | 0 | 2.81 | pass* | T23: the .97 press is the Store's own (`shell/store.css`; Sales' canvas draws none); a still shot cannot hold `:active`. T1, T2 as TD01. |
| TD02TodayNextCheckin | `today` &at=1132 | 0 | 0.39 | pass | T8: bell 1, Denis's trip back at 11:30 (FACTS §8). G-T7: #0556 collected 11:45 and #0547 delivered 11:50 come after 11:32, so the board stands as drawn. |
| TD03TodayNextRide | `today` &at=1510 | 0 | 0.83 | pass | T7: FACTS §8 now names #0534 10:58, #0556 collected 11:45, #0547 11:50; the board is corrected to the sample day (3 left · 16 done · 0 later, 6 delivered, nobody on the road). T8 bell 1 (Denis sent you). T9 "just now", #0559's LB face. |
| TD04TodayCalm | `today` &at=1730 | 3 | 1.04 | pass | The critic's taps (set aside, Close): 4 of 4 with the tick. T7: 21 done, 9 delivered (board corrected). T8 bell 0. T10: 1 with Ruth (the Wire nails count accepted 16:20, #0557 cancelled 16:30: FACTS §8, spec §2a Q9). |
| TD05TodayFirst | `today` &state=first-day | 0 | 0.31 | pass | T11: reached. The first day keys on a yard with nothing of its own; a due count does not end it (spec §4.6); the seed counts every aisle. "Ruth added you" without the date. G-T5: the red button with no job opens To pack's empty state (PK14), as linked. |
| TD06TodayOffline | `today` &offline&kept=1 | 0 | 7.11 | pass | Section spacing; Waiting to send now has an anchor (No reach's Work kept opens it). |
| TD07TodayFailed | `today` &fail=snapshot | 0 | 2.75 | pass* | T12: the four dashed tiles are pictures, not links. "tried 3 times" left out (accepted). |
| TD08TodayUpdate | `today` &update=1 | 0 | 0.27 | pass | T1, T2 as TD01; no "13:20" (Q25). |
| TD10Alerts | `today/alerts` | 1 | 3.49 | pass | T13: GA pushed clear of DO (30 px). T14: titles 600, the words run to 4 px of the chip as drawn, nothing cut. T1 ticks. "2 new" kept while open. Fri "1 · read" (accepted). |
| TD11WithRuth | `today/with-ruth` | 2 | 13.27 | pass* | T15: Gate is a 44 px button with the 36 px pill inside. Spacing within the cards (accepted). |
| TD29AlertsEmpty | `today/alerts` &state=empty | 1 | 2.65 | pass | T16: the empty seed keeps the older day, read: "Fri 16 Oct · 1 · read" (the board 6: older days are not in FACTS). |
| TD30WithRuthEmpty | `today/with-ruth` &state=empty | 2 | 6.39 | pass | T17: the aisle's own picture (Roofing's house); an answered title may take two lines. |
| TD12You | `today/you` | 1 | 15.61 | pass* | T18: the day ring and Out go to Today like Checked in and Packed. T1 figures. No "Kampala Road" and no call (Q25, left out). |
| TD13PassYard | `today/pass-yard` | 2 | 4.66 | pass |  |
| TD18PassYardSending | `today/pass-yard` &slow=1 | 3 | 4.88 | pass | T19: reached. After the 10 s hold the write goes: the pick with the Sending… dock. |
| TD14PassYardSent | `today/pass-yard` | 3 | 9.18 | pass* | T19: during the hold "Passing to Okello…", "Sends in 10 s", a clock, no tick; Sent only on the server's yes. Board redrawn. 10:41 on the demo clock where it draws 10:42. G-T14: the holder's slate face (`yardFace`). |
| TD24PassYardNobody | `today/pass-yard` &state=nobody | 2 | 4.02 | pass | T20: the shared quiet locked slide ; the knob shows the lock, board redrawn (G-T20, spec §4.8). T21 `--ink-soft`. |
| TD26PassYardFailed | `today/pass-yard` &fail=passYard | 3 | 5.04 | pass | Shot after the hold: That did not save · ST-301 · Try again. |
| TD15PassYardGot | `today` &as=okello&at=1043 | 0 | 0.61 | pass | T8: Okello's own push, bell 1. |
| TD25PassYardTaking | `today` &as=okello&at=1043 | 1 | 0.9 | pass | T8 as TD15. |
| TD32OkelloToday | `today` &as=okello&at=1043 | 1 | 3.56 | pass | T8: I've got it reads the pass push, bell 0. Q20 (#0552 first). |
| TD28CloseYardDisabled | `today/close-yard` &at=1730 | 1 | 9.64 | pass* | T20 quiet locked slide, the lock on the knob (board redrawn, G-T20). T7 9 out; aisle C sent 14:40 (board corrected). Bays 1–4 (accepted). |
| TD16CloseYard | `today/close-yard` &at=1730 | 2 | 9.51 | pass* | T10: "Aisle C count with Ruth", one ask; more would be counted ("2 asks"). T7 9 out. |
| TD27CloseYardOffline | `today/close-yard` &at=1730&offline | 2 | 10.05 | pass* | T20 quiet locked slide, "Back online to close", the no-signal knob (board redrawn, G-T20). T7; 14:40. |
| TD19CloseYardSending | `today/close-yard` &at=1730 | 3 | 9.68 | pass* | T22: "Sending…" white on the red fill (`slide.css`). T7. |
| TD17Closed | `today/close-yard` &at=1730 | 3 | 6.08 | pass* | Moment spacing. |
| TD20SignIn | `shell/sign-in` &state=signed-out | 0 | 1.14 | pass | T24: the boot screens render the toast and sheet hosts; Forgot password says "Ask your manager for a new invite link" (Q21). |
| TD31SignInError | `shell/sign-in` | 1 | 3.74 | pass | T24 as TD20. |
| TD23SignInSending | `shell/sign-in` | 1 | 1.35 | pass | T25: the demo's sign-in takes 1.5 s; Signing in… is shot. G-T23: the busy button stays `--oxide`. Board: "Your manager sends you an invite link". |
| TD21Checking | `shell/checking` &state=loading | 0 | 7.7 | pass | T26: the Next job skeleton as drawn (flat navy, tag and from, 84 px ring, three 58 px tiles); the tabs shown but off (`aria-disabled`), board corrected. |
| TD22NoReach | `shell/no-reach` &state=no-reach | 0 | 10.71 | pass* | T27: Open the copy · saved 7:52 (only when a copy exists: `StoreSource.savedCopy`), 2 waiting to send, Work kept opens Today's Waiting to send; "saved on this phone 7:52" (G-T22). T21 `--ink-soft`. Board redrawn without "tried 3 times". |

*pass with a named difference. Totals (Today fix and the critic's re-check, 2026-11-12): 33 reached, 33 pass (11 with a named difference), 0 fail.
