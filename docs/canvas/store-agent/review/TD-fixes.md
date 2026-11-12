# Today boards · fixed with the app (critic 2026-11-12)

The Today critic (`docs/audit/store/CANVAS-PARITY.md` "## Today", T1–T27) found faults the boards draw the same way as the app (T1, T2), board figures the sample day does not have (T7, T9, T19), and one board link the app cannot follow (T26). The app was fixed and each board below got the same change, nothing more. The sample day's later moments are now all written in `FACTS.md` §8, and `demo/moments.ts` follows them.

| Board | What changed | Why |
|---|---|---|
| TD01 Today | the Next job tiles' second lines and the struck "10 pair" `#8D99B5` → `#B3BCD2`; the blue tag "Packing now · yours" `#A9BCEB` → `#B8C8F0` | T1: 3.21:1 on the navy tile, `#B3BCD2` is `--on-navy` (4.82:1); T2: the tag 4.46:1, `#B8C8F0` is 5.05:1 (the shared `pill.css` `.n-blue`) |
| TD08 Today, update ready | the same two changes as TD01 | T1, T2 |
| TD33 Next job pressed | the same two changes as TD01 | T1, T2 |
| TD32 The yard is yours | the tiles' second lines `#8D99B5` → `#B3BCD2`; the blue tag `#A9BCEB` → `#B8C8F0` | T1, T2 |
| TD02 Next is a check-in | the tiles' second lines ("#0549", "#0546") `#8D99B5` → `#B3BCD2` | T1 |
| TD15 Musa passed you | the tiles' second lines ("1 of 2", "return", "count") `#8D99B5` → `#B3BCD2` | T1 |
| TD25 I've got it, sending | the same as TD15 | T1 |
| TD12 You | the three figures' labels and lines ("Denis · 10:05", "#0555", "2 Ssali · 1 gate") `#8D99B5` → `#B3BCD2` | T1: 3.17:1 on You's figures; 4.75:1 now |
| TD10 Alerts | the timeline's "9:00" and "10:00" `#8D99B5` → `#B3BCD2` | T1: 3.89:1 on the hero |
| TD29 Alerts, empty | the same as TD10 | T1 |
| TD03 Next is a ride | the tiles' second lines `#8D99B5` → `#B3BCD2`; "4 jobs left · 12 done" → "3 jobs left · 16 done", the bar and its legend 16 done · 3 ready · 0 later; "5 delivered today" → "6"; On the road 1 (NH) → 0, nobody; "Denis sent you · 1 m" → "just now", "From Denis · 15:09" → "15:10"; #0559's LB face 10 → 11 px | T1; T7: FACTS §8 now names #0534 (10:58), #0556 (collected 11:45) and #0547 (11:50), the demo's day, and the board is corrected to it (spec §2a); T9: Denis sends at 15:10, so under a minute is "just now" (§4.7); the 11 px floor |
| TD04 Calm | "18 done" → "21 done" and the bar's 18 marks → 21; "8 delivered today" → "9"; the close card's "8 out" → "9 out" | T7: #0556 collected 11:45 (FACTS §8) |
| TD16 Close the yard | Out 8 → 9 | T7 |
| TD19 Close sending | Out 8 → 9 | T7 |
| TD27 Close offline | Out 8 → 9 | T7 |
| TD28 Close, 3 of 4 | Out 8 → 9 | T7 |
| TD14 Pass the yard, held | the screen during the 10 s hold says what is true: the disc's tick → a clock, "Sent to Okello" → "Passing to Okello…", step 1 "Sent · 10:42 · his phone buzzed" → "Sends in 10 s · take it back until then" (now, mint), step 2 no longer mint, the bar at 0 | T19: spec §4.8, never a tick or "Sent" before the server's yes; the hold can still be taken back and the send can still fail (TD26). "Sent to Okello" shows only after the write lands |
| TD21 Checking | the tab bar's Today and Shelf links → shown but off (`aria-disabled`), as the red button already is | T26: while the shop is checked there is nothing to open |

Not redrawn: TD24's "a colleague with a yard login shows here" and TD22's "code ST-101" (T21) and TD19's white "Sending…" (T22) are already right on the boards; only the app was wrong.

## Re-check (critic 2026-11-12 on `bacd5c32`)

| Board | What changed | Why |
|---|---|---|
| TD24 Nobody else | the locked knob's double chevron → the lock | G-T20: a slide that cannot go shows why on its knob (spec §4.8); the shared `Slide` `lock` draws it |
| TD28 Close, 3 of 4 | the knob's chevron → the lock; aisle C "sent 16:40" → "sent 14:40" | G-T20; FACTS §8 (aisle C counted and sent 14:40) |
| TD27 Close offline | the knob's chevron → the no-signal icon; "sent 16:40" → "14:40" | G-T20; FACTS §8 |
| TD16 Close the yard | aisle C "sent 16:40" → "sent 14:40" | FACTS §8 |
| TD19 Close sending | aisle C "sent 16:40" → "sent 14:40" | FACTS §8 |
| TD07 Load failed | "tried 3 times" dropped, the code stays | §4.8: the app reads once and says only what is true |
| TD22 No reach | "tried 3 times · code ST-101" → "code ST-101" | §4.8 |
| TD20 Sign in | "Ruth sends you an invite link" → "Your manager sends you an invite link" | nobody is known before sign-in |
| TD23 Signing in | the same as TD20 | the same |
| TD31 Wrong password | the same as TD20 | the same |

Not redrawn: "Ssali 13:20" (TD01, TD08, TD33) and "Kampala Road" with the call button (TD12) stay as drawn while screens Q25 is open. TD02 needs no change: FACTS §8 now puts #0556's collection (11:45) and #0547's delivery (11:50) after its 11:32, and the demo stamps the same.
