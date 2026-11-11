# Canvas parity — Store, Today and the shell (TD, 33 boards)

Spec `test/parity/store-today.json`; shots `docs/audit/store/parity/<Board>.png` (board left, app right) and `.diff.png`; figures in `results.json`. Run: `npm run build:store && NODE_PATH=$(npm root -g) node tools/parity/run.cjs --tab store-today`. Judged by the builder (a strict first pass); an independent critic re-checks. "pass" = same content and layout, the rest fonts, antialiasing or a known demo-figure difference named in the note. Every screen was checked at 360 × 800 for 44 px targets, text ≥ 11 px, no clipping; slides are committed from the keyboard (Tab to the knob, Enter) because the knob nudges forever.

| Board | Route | Taps | Diff % | Result | Notes |
|---|---|---|---|---|---|
| TD01Today | `today` | 0 | 1.9 | pass | No driver time ("Ssali 13:20": the books keep no run time); #0530's faces are BO RN (Brian placed it, FACTS) where the board draws GA. |
| TD09TodayMore | `today` (scrolled) | 1 | 13.7 | pass | The figure scrolls to Needs you under the compact head; the diff is the scroll offset and the head's shadow. Done today rows as drawn. |
| TD33TodayPressed | `today` | 0 | 2.8 | pass* | The pressed red (#A82D24) is the shared TabBar's :active; a still shot cannot hold it (the scale .97 is not added: it would change Sales' bar). |
| TD02TodayNextCheckin | `today` &at=1132 | 0 | 0.4 | pass | 8 done (the demo packs #0552 at 10:52, which the board does not count). |
| TD03TodayNextRide | `today` &at=1510 | 0 | 2.0 | fail (figures) | Layout matches; the demo's 15:10 still has the return, the bent sheets and aisle C open, so 6 ready / 14 done where the board draws 3 / 12. The board's later moments are not the demo's; left for the lead (demo/moments.ts is shared). |
| TD04TodayCalm | `today` &at=1730 | 0 | 2.5 | pass* | "3 of 4" where the board draws 4 of 4: the return is not set aside yet at 17:30 (TD28 is the entry, as the flow "1 return to shelve" says). 9 delivered (demo) vs 8. |
| TD05TodayFirst | `today` &state=first-day | 0 | 0.3 | pass | "Ruth added you" without the date (the books keep no invite date). |
| TD06TodayOffline | `today` &offline&kept=1 | 0 | 7.1 | pass | The new flag `&kept=1` seeds the two kept writes. A few px of section spacing. |
| TD07TodayFailed | `today` &fail=snapshot | 0 | 3.0 | pass* | "tried 3 times" left out: the app reads once and says so; it never claims retries it did not make. |
| TD08TodayUpdate | `today` &update=1 | 0 | 0.3 | pass | |
| TD10Alerts | `today/alerts` | 1 | 3.5 | pass | Fri 16 Oct "1 · read": the demo keeps one of the seven. |
| TD11WithRuth | `today/with-ruth` | 2 | 14.2 | pass* | Every ask and its step track as drawn; "Brian takes it" (FACTS) where the board says Grace; spacing within the cards a few px off, re-tuned after the shot. |
| TD29AlertsEmpty | `today/alerts` &state=empty | 1 | 2.3 | pass | No "Fri 16 Oct · 6 · read" row: the empty demo has no older alerts. |
| TD30WithRuthEmpty | `today/with-ruth` &state=empty | 2 | 14.7 | pass | Content as drawn; the head was 8 px taller in the shot (re-tuned after it). |
| TD12You | `today/you` | 1 | 15.6 | pass* | No "Kampala Road" and no call button for the shop: the yard's books carry the shop's name only (data gap). |
| TD13PassYard | `today/pass-yard` | 2 | 4.7 | pass | Ssali is out with the truck, so not offered (as drawn). |
| TD18PassYardSending | `today/pass-yard` | 2 | 10.8 | not reached | The pass is held 10 s with "Take it back" (screens Q17, data W22'): the slide never waits on the server on this screen; the shot is TD13. |
| TD14PassYardSent | `today/pass-yard` (held) | 5 | 8.5 | pass* | The Sales moment's spacing (disc 30 px lower); re-tuned after the shot. |
| TD24PassYardNobody | `today/pass-yard` &state=nobody | 2 | 4.0 | pass | The slide's off label is the shared Slide's white (the board greys it). |
| TD26PassYardFailed | `today/pass-yard` &fail=passYard | 5 | 5.0 | pass | Shot after the 10 s hold: That did not save · tell Kevin · ST-301 · Try again. |
| TD15PassYardGot | `today` &as=okello&at=1043 | 0 | 0.6 | pass | |
| TD25PassYardTaking | `today` &as=okello&at=1043 | 1 | 0.9 | pass | |
| TD32OkelloToday | `today` &as=okello&at=1043 | 1 | 3.6 | fail (rule) | The Next job is #0552 (passed to Okello, in progress: "your pack first", the job rule) where the board draws #0556 first. Open for Kevin. |
| TD28CloseYardDisabled | `today/close-yard` &at=1730 | 1 | 9.6 | pass* | Bays 1–4 and the gate (the shop has 4 bays, PK06); the board draws 3. |
| TD16CloseYard | `today/close-yard` | 2 | 9.5 | pass* | As TD28; 9 out (demo). |
| TD27CloseYardOffline | `today/close-yard` &offline | 2 | 10.0 | pass* | As TD28. |
| TD19CloseYardSending | `today/close-yard` | 4 | 9.7 | pass* | Shot while the write is on its way (250 ms). |
| TD17Closed | `today/close-yard` (done) | 5 | 6.1 | pass* | Moment spacing re-tuned after the shot. |
| TD20SignIn | `shell/sign-in` &state=signed-out | 0 | 1.5 | pass | "Your manager sends you an invite link": before sign-in the app does not know who the manager is. |
| TD31SignInError | `shell/sign-in` | 1 | 3.9 | pass | |
| TD23SignInSending | `shell/sign-in` | 1 | 64.7 | not reached | The demo signs in at once; Signing in… shows for a frame, then Today. |
| TD21Checking | `shell/checking` &state=loading | 0 | 12.4 | pass | |
| TD22NoReach | `shell/no-reach` &state=no-reach | 0 | 10.8 | pass* | "tried 3 times" left out (as TD07); "nothing waiting" (the demo has no kept writes in this state). |

*pass with a named difference. Totals: 26 pass (13 with a named difference), 2 fail (TD03 figures of the demo's 15:10, TD32 the job order), 2 not reached as still screens (TD18, TD23), and TD33's pressed state.
