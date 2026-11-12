# Manager canvas: independent review, round 4 (12 Nov 2026)

I scored this round only from the rendered PNGs. Before scoring I re-rendered all ten boards from the current `.dc.html` (`png/*.png`) and the ten Agent references (Main, Order, Clients, Client, Money, MoneyPro, NextMove, Goal, MoveSent, ChangeAsk). I ignored the boards' own score panels for the New score. The *Manager today* column is the grey number from each board's own panel.

Baselines come from `BRIEF.md`. As in rounds 1–3, Main and Flow (no baseline in BRIEF) and MoneyCredit and Today p2/p3 (decision sheets) use the decision-sheet baseline 9 9 8 8 8. Navy need badges are the Manager's choice (§8) and were not marked down. Red count: only `--accent` (#C93A30) counts as "the red". `--bad` (#8E2A22, for things like broken promises and under cost) is a separate meaning token in the language file and is allowed.

## Result

**Every page is at or above its baseline, on average and on every measure.**

| | Round 1 | Round 2 | Round 3 | **Round 4** |
|---|---|---|---|---|
| Overall average (Agent baseline 8.37) | 7.94 | 8.44 | 8.62 | **8.66** |
| Pages below baseline on average | 28 | 8 | 0 | **0** |
| Pages below on any measure | — | 18 | 2 | **0** |
| Pages meeting every measure | — | 18 | 34 | **36 of 36** |

Taps: from the app 145 → 68, from the push 59 → 24, each next in the queue 2 → 1. Flow and Main agree with these.

## Round 3 fixes: all done

1. Check-in word: handover §4 row 177 now pairs the verb and the result (Take the check-in → {Ruth} took {Musa}'s check-in, like Approve → Approved); the DecideStock p3 dock, success state, Answers-out strip, lock-screen push and Main D-13 all follow that pair.
2. MoneyCredit p1: bill icons neutral, '38 d' and '9 Sep' no longer red; the only over-hold mark is on the days track.
3. DecideStock SENDING: 'Written off · 102,000' now ends before the spinner knob.
4. DecideOrders p3 NEXT card: 'Ridge cap · cost 27,000', no truncation.
5. D-22: Main and DecideOrders p6 both read Cement 50 kg 20 → 12 only.
6. D-28: Main, Money's Asks-in strip, Money p3 and Flow all mean Ruth's own promise for Kyaligonza & Sons, 2,310,000 on Mon 19.
7. D-29: Main reads 'Goals · 105M', the same as Team p3.
8. MoneyCredit p4: 'Terms 14 days · same'.
9. Today p1 watch tiles: Nudge is a 44px navy pill, as on Team.

## Checks across the boards

- **States:** all eight states are drawn on every board. Each one is drawn, not described.
- **One red:** each phone has one accent red, either the + FAB or one slide knob. Sheets with a slide have no FAB.
- **Who asked and what they get:** every decision sheet shows "From X · #order · n of 8" and a "X sees: answer" line in the dock, with a bell.
- **Queue order:** the order agrees across Today p1 rows, every sheet's "n of 8", the NEXT cards and Today p4's answer times: D-7 1 · D-18 2 · D-3 3 · D-16 4 · D-1 5 · D-20 6 · D-12 7 · D-24 8.
- **Totals re-checked:**
  - Today/Team 61,110,000 of 105M, 58%, +1.61M
  - Orders To bill: 748,000 = 430,000 + 318,000; 745,567 = 567 + 425,000 + 320,000; 5 cards
  - Money bands sum to 6,679,000
  - Ggaba 1,615,000 is 81% of 2M
  - D-1 gain 8,000 a sheet, 240,000 in all; −1,500 a sheet, −45,000 in all
  - D-4 gain 60,000
  - D-3 gain 67,500; Mukono pays +77,500
  - D-2 155,000
  - D-22 850,000 → 510,000 (8 × 42,500)
  - D-12 1,710,000 / 1,900,000
  - D-18 662,000 → 605,750
  - D-16 102,000
  - D-24 298,500
- **Fit:** nothing is clipped or overlapping at 360. Nothing in the source is under 11 px.

## Scores (C · T · G · P · S)

| Board | Page | Manager today | New | Avg | Baseline | Every measure? |
|---|---|---|---|---|---|---|
| Today | 1 Today 09:40 | 4.6 | 9 · 9 · 9 · 9 · 9 | 9.0 | 8.6 | yes |
| Today | 2 Decide next 1 of 8 (D-7) | 4.4 | 9 · 9 · 8 · 8 · 9 | 8.6 | 8.4 | yes |
| Today | 3 Answered, next slides in (D-18) | 4.4 | 9 · 9 · 8 · 8 · 9 | 8.6 | 8.4 | yes |
| Today | 4 All decided 09:59 | 4.2 | 9 · 9 · 9 · 9 · 8 | 8.8 | 8.6 | yes |
| Orders | 1 Orders by stage | 4.6 | 9 · 8 · 8 · 8 · 9 | 8.4 | 8.2 | yes |
| Orders | 2 One order #0552 | 4.6 | 9 · 9 · 8 · 8 · 9 | 8.6 | 8.2 | yes |
| Orders | 3 Stuck #0554 | 4.0 | 9 · 8 · 8 · 8 · 9 | 8.4 | 8.2 | yes |
| Orders | 4 To bill 10:05 | 4.6 | 9 · 8 · 8 · 8 · 9 | 8.4 | 8.2 | yes |
| Money | 1 Money | 4.6 | 9 · 9 · 9 · 9 · 9 | 9.0 | 8.4 | yes |
| Money | 2 One debtor Kyaligonza | 4.4 | 9 · 9 · 8 · 9 · 9 | 8.8 | 8.4 | yes |
| Money | 3 A promise (D-28) | 4.2 | 9 · 8 · 8 · 9 · 9 | 8.6 | 8.4 | yes |
| Money | 4 Customer Ggaba (D-25/26/27/32) | 3.8 | 9 · 8 · 8 · 9 · 9 | 8.6 | 8.4 | yes |
| MoneyCredit | 1 Credit hold D-5 | 4.8 | 9 · 9 · 8 · 8 · 9 | 8.6 | 8.4 | yes |
| MoneyCredit | 2 No limit set D-6 | 3.8 | 9 · 9 · 8 · 8 · 9 | 8.6 | 8.4 | yes |
| MoneyCredit | 3 The Store asks D-7 | 4.6 | 9 · 9 · 8 · 8 · 9 | 8.6 | 8.4 | yes |
| MoneyCredit | 4 Credit asked D-32 | 0.0 | 9 · 9 · 9 · 8 · 9 | 8.8 | 8.4 | yes |
| Team | 1 Team | 5.0 | 9 · 8 · 9 · 8 · 9 | 8.6 | 8.2 | yes |
| Team | 2 One person Faith | 5.4 | 9 · 9 · 8 · 8 · 9 | 8.6 | 8.2 | yes |
| Team | 3 Goals and limits D-29 | 5.0 | 9 · 8 · 8 · 8 · 9 | 8.4 | 8.2 | yes |
| Team | 4 Nudge Denis D-31 | 4.0 | 9 · 8 · 8 · 8 · 9 | 8.4 | 8.2 | yes |
| DecidePrice | 1 D-1 Under the shop's price | 4.8 | 9 · 9 · 9 · 8 · 9 | 8.8 | 8.4 | yes |
| DecidePrice | 2 D-4 At the counter | 5.2 | 9 · 9 · 9 · 8 · 9 | 8.8 | 8.4 | yes |
| DecidePrice | 3 D-3 Price up | 4.2 | 9 · 9 · 8 · 8 · 9 | 8.6 | 8.4 | yes |
| DecidePrice | 4 D-2 Price coming | 4.2 | 9 · 9 · 8 · 8 · 9 | 8.6 | 8.4 | yes |
| DecideOrders | 1 D-12 Packed short | 4.0 | 9 · 9 · 9 · 8 · 9 | 8.8 | 8.4 | yes |
| DecideOrders | 2 D-20 Cancel asked | 3.4 | 9 · 9 · 8 · 8 · 9 | 8.6 | 8.4 | yes |
| DecideOrders | 3 D-18 Return asked | 4.2 | 9 · 9 · 8 · 8 · 9 | 8.6 | 8.4 | yes |
| DecideOrders | 4 D-19 Void asked, with money | 4.0 | 9 · 9 · 9 · 8 · 9 | 8.8 | 8.4 | yes |
| DecideOrders | 5 D-10 A line at 0 | 3.4 | 9 · 9 · 8 · 8 · 9 | 8.6 | 8.4 | yes |
| DecideOrders | 6 D-22 Peter asks for fewer | 3.4 | 9 · 9 · 8 · 8 · 9 | 8.6 | 8.4 | yes |
| DecideStock | 1 D-16 Damaged, write off | 5.0 | 9 · 9 · 9 · 8 · 9 | 8.8 | 8.4 | yes |
| DecideStock | 2 D-24 A carton for the shelf | 5.4 | 9 · 9 · 9 · 9 · 9 | 9.0 | 8.4 | yes |
| DecideStock | 3 D-13+D-14 Check-in differs | 5.2 | 9 · 9 · 9 · 8 · 9 | 8.8 | 8.4 | yes |
| DecideStock | 4 D-15 Not on the list | 1.0 | 9 · 9 · 9 · 8 · 8 | 8.6 | 8.4 | yes |
| Main | Decisions board (whole) | — | 9 · 9 · 8 · 8 · 8 | 8.4 | 8.4 | yes |
| Flow | Day before/after (whole) | — | 9 · 9 · 9 · 8 · 9 | 8.8 | 8.4 | yes |

## Remaining fixes (none blocks the goal)

1. D-28 push: Main says 'no push · Ruth's own (P-13 is Sales')', but handover §3 lists NEW promise.made (quiet) and Money p3's dock shows the bell + 'Grace sees Promised · Mon 19'. Pick one: if Grace gets the quiet push, Main's push column reads 'promise.made → GA (quiet)'; if not, Money p3 drops the bell.
2. Minor, not blocking: an empty band of about 90 to 120 px above or inside the dock on DecidePrice p2, DecideStock p1, MoneyCredit p1 and DecideOrders p4. The Agent sheets pull the dock up under the content.
