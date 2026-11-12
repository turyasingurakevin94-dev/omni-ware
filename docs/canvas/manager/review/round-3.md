# Manager canvas: independent review, round 3 (12 Nov 2026)

I scored this round only from the rendered PNGs. Before scoring I re-rendered every board from the current `.dc.html` (`png/*.png`). I ignored the boards' own score panels.

**References:**
- The Agent boards, rendered fresh: Main, Order, Clients, Client, Money, MoneyPro, NextMove, Goal, MoveSent and ChangeAsk.
- `docs/canvas/buyer/Today.png`.
- Baselines come from the "Scores" section of `BRIEF.md`. That file gives no baseline for Main and Flow, so I scored both against the decision-sheet baseline (9 9 8 8 8).

Each page gets five scores, in this order: Consistency · Taps · Glance · Polish · In step. Need badges in navy are the Manager's choice (§8) and were not marked down.

**Result:**
- There are 36 pages. **0 are below their baseline average** (round 2: 8; round 1: 28).
- **2 pages are below on a single measure**, both on Polish: Today p1 (8 against 9) and MoneyCredit p1 (7 against 8).
- **34 pages meet every measure** (round 2: 18).
- The overall average is **8.62**. The Agent baseline average is **8.37** (round 2: 8.44; round 1: 7.94).

**Checks across the boards:**
- **States:** every board draws all eight states.
- **Red:** each phone has one red, either the FAB or one knob. The exception is MoneyCredit p1 (see below).
- **Who asked and what they get:** every decision shows both. The "X sees" line is in each dock, and DecideOrders p6 now shows "Peter gets back 0".
- **Font size:** nothing in the source is under 11 px.
- **Overlap:** one overlap, in DecideStock *sending*.
- **Truncation:** one truncation, on the DecideOrders p3 NEXT card.

## Totals and figures checked

All of these agree.

| Check | Figures |
|---|---|
| Today and Team | 61.11M of 105M, 58% |
| Team pace (day 17.6 of 31) | Grace +, Brian −0.83M, Faith −2.09M, shop +1.61M |
| Faith's pace | 1.08M a day, 0.85M → 26.8M |
| Team p3 goals | 35 + 30 + 30 + 10 = 105M |
| Team p3 so far | 23.4 + 16.17 + 14.91 + 6.63 = 61.11M |
| Team headcount | 10 of 11 in, which matches the 11 tiles (Hassan off) |
| Money bands | 878 + 2,829 + 662 + 2,310 = 6,679,000, the same as the rows |
| Kyaligonza's bills | 1,450,000 + 860,000 = 2,310,000 |
| D-5 | 2,310,000 + 1,380,000 = 3,690,000 |
| D-6 | 1,214,000 + 1,287,500 = 2,501,500 |
| D-32 | 1,615,000 + 775,000 = 2,390,000; 390,000 over / 610,000 left |
| Orders To bill | 748,000 + 745,567 = 1,493,567; 5 cards |
| Orders p2 (#0552) | 950,000 + 260,000 = 1,210,000; at the shop's price 1,287,500 |
| D-1 | 30 × 46,000; gain 240,000; −45,000 |
| D-2 | 20 × 38,750 = 775,000 |
| D-3 | 10 × 33,750 = 337,500; Mukono pays +77,500 |
| D-4 | 10 × 40,000 |
| D-12 | 36 × 47,500 = 1,710,000; all 40 = 1,900,000 |
| D-18 | 662,000 → 605,750 |
| D-19 | Deposit 558,000; Refund 758,000 |
| D-10 | 2 × 1,500 = 3,000 |
| D-22 | 850,000 → 510,000 |
| D-16 | 3 × 34,000 = 102,000 |
| D-24 | 199 × 1,500 = 298,500 |
| D-13 | −28,000 |
| D-15 | 2 × 34,000 = 68,000 |
| D-17 | −18,000 + 6,000 = −12,000 |
| Flow queue | 37 → 16 and 24 → 11 |
| Flow sums | push 59 → 24 (the 20 with a push today); app 145 → 68 (30 decisions) |
| Queue times | DecidePrice p4 "1 of 2 at 10:15" → DecideStock p3 "2 of 2 at 10:16" → p4 "1 of 1 at 10:20" |

Three figures disagree across boards: D-22, D-28 and D-29. They are listed under the remaining fixes.

## Round 2 fixes: what is done and what is not

**Done:**
1. Esther now reads **Accounts** on MoneyCredit p4 and DecideOrders p4.
2. The wall plugs cost 1,500 on every board (DecideOrders p5 now shows 2 × 1,500 = 3,000).
3. **Invoiced** is used on Orders (the default push, the success push and the error state) and in Main D-8, D-9 and D-10.
4. One red per screen holds on Orders p4 (Taken twice is now an Open pill), Money p4 (the merge is now on Open, and the limit is the one primary) and DecideOrders p4 (the twin is a dashed navy outline with a grey tag). The figures on Orders p1/p3, DecideStock p1 and Team p3 are now in ink.
5. The offline words are now the same on every board: "No signal · it sends when back" and **Waits**.
6. The dead band is fixed on MoneyCredit p4 (Ggaba's evidence fills it), Money p3, DecidePrice p1 and DecideOrders p1/p2/p3 (NEXT cards). On Team p2 it is reduced to about 110 px.

**Per board, also done:**
- **Today:** the watch is drawn, and #0556 reads "Nothing paid".
- **Orders:** "To bill 5", the error reads "invoiced on another phone", and the "Or" divider is gone.
- **Money:** the bill icons on p2 are neutral, and "Pick a day later" replaces Later.
- **Team:** the counts match the tiles, the pace uses one basis, and the Counter 10M segment has a row.
- **DecidePrice:** one "Price set · another price" rung row on all four sheets, and the error reads "Ruth decides".
- **DecideOrders:** p2 has a NEXT card, p4's owed figure follows the chosen answer, and p6 shows what Peter gets.
- **DecideStock:** the queue times agree.
- **Flow:** D-17 keeps 4 → 2 with "was an FCM". `handover.md` row D-17 confirms the push already existed through the `notify-stock-count` FCM, so this holds.
- **Money:** the error state for the merge slide is drawn.

**Not done:**
- **Fix 3, the check-in word.** These places still read "Ruth took Musa's check-in": the DecideStock p3 dock pill, the DecideStock success state, and Main D-13's "asker's app" column. The Answers-out strip and the lock-screen push read "Take the check-in". The source disagrees with itself: handover §4 P-4 titles the push "{Ruth} took {Musa}'s check-in", while §3 row D-13 gives the answer as **Take the check-in**. Settle it in handover §3/§4, then use one phrase everywhere.
- **The red pattern on MoneyCredit p1.** It was not listed in round 2, but it is the same fault Money p2 fixed: red-tinted bill icons, a red "38 d", a red "9 Sep" and a red dot.

## Scores

| Board | Page | C · T · G · P · S | Avg | Baseline | ≥ baseline? |
|---|---|---|---|---|---|
| Today | 1 Today 09:40 | 9 · 9 · 9 · 8 · 9 | 8.8 | 8.6 | yes (avg only) |
| Today | 2 Decide next 1 of 8 (D-7) | 9 · 9 · 8 · 8 · 9 | 8.6 | 8.4 | yes |
| Today | 3 Answered, next slides in (D-18) | 9 · 9 · 8 · 8 · 9 | 8.6 | 8.4 | yes |
| Today | 4 All decided 09:59 | 9 · 9 · 9 · 9 · 8 | 8.8 | 8.6 | yes |
| Orders | 1 Orders by stage | 9 · 8 · 8 · 8 · 9 | 8.4 | 8.2 | yes |
| Orders | 2 One order #0552 | 9 · 9 · 8 · 8 · 9 | 8.6 | 8.2 | yes |
| Orders | 3 Stuck #0554 | 9 · 8 · 8 · 8 · 9 | 8.4 | 8.2 | yes |
| Orders | 4 To bill 10:05 | 9 · 8 · 8 · 8 · 9 | 8.4 | 8.2 | yes |
| Money | 1 Money | 9 · 9 · 9 · 9 · 9 | 9.0 | 8.4 | yes |
| Money | 2 One debtor Kyaligonza | 9 · 9 · 8 · 9 · 9 | 8.8 | 8.4 | yes |
| Money | 3 A promise (D-28) | 9 · 8 · 8 · 9 · 8 | 8.4 | 8.4 | yes |
| Money | 4 Customer Ggaba (D-25/26/27/32) | 9 · 8 · 8 · 9 · 9 | 8.6 | 8.4 | yes |
| MoneyCredit | 1 Credit hold D-5 | 9 · 9 · 8 · 7 · 9 | 8.4 | 8.4 | yes (avg only) |
| MoneyCredit | 2 No limit set D-6 | 9 · 9 · 8 · 8 · 9 | 8.6 | 8.4 | yes |
| MoneyCredit | 3 The Store asks D-7 | 9 · 9 · 8 · 8 · 9 | 8.6 | 8.4 | yes |
| MoneyCredit | 4 Credit asked D-32 | 9 · 9 · 9 · 8 · 9 | 8.8 | 8.4 | yes |
| Team | 1 Team | 9 · 8 · 9 · 8 · 9 | 8.6 | 8.2 | yes |
| Team | 2 One person Faith | 9 · 9 · 8 · 8 · 9 | 8.6 | 8.2 | yes |
| Team | 3 Goals and limits D-29 | 9 · 8 · 8 · 8 · 8 | 8.2 | 8.2 | yes |
| Team | 4 Nudge Denis D-31 | 9 · 8 · 8 · 8 · 9 | 8.4 | 8.2 | yes |
| DecidePrice | 1 D-1 Under the shop's price | 9 · 9 · 9 · 8 · 9 | 8.8 | 8.4 | yes |
| DecidePrice | 2 D-4 At the counter | 9 · 9 · 9 · 8 · 9 | 8.8 | 8.4 | yes |
| DecidePrice | 3 D-3 Price up | 9 · 9 · 8 · 8 · 9 | 8.6 | 8.4 | yes |
| DecidePrice | 4 D-2 Price coming | 9 · 9 · 8 · 8 · 9 | 8.6 | 8.4 | yes |
| DecideOrders | 1 D-12 Packed short | 9 · 9 · 9 · 8 · 9 | 8.8 | 8.4 | yes |
| DecideOrders | 2 D-20 Cancel asked | 9 · 9 · 8 · 8 · 9 | 8.6 | 8.4 | yes |
| DecideOrders | 3 D-18 Return asked | 9 · 9 · 8 · 8 · 9 | 8.6 | 8.4 | yes |
| DecideOrders | 4 D-19 Void asked, with money | 9 · 9 · 9 · 8 · 9 | 8.8 | 8.4 | yes |
| DecideOrders | 5 D-10 A line at 0 | 9 · 9 · 8 · 8 · 9 | 8.6 | 8.4 | yes |
| DecideOrders | 6 D-22 Peter asks for fewer | 9 · 9 · 8 · 8 · 8 | 8.4 | 8.4 | yes |
| DecideStock | 1 D-16 Damaged, write off | 9 · 9 · 9 · 8 · 9 | 8.8 | 8.4 | yes |
| DecideStock | 2 D-24 A carton for the shelf | 9 · 9 · 9 · 9 · 9 | 9.0 | 8.4 | yes |
| DecideStock | 3 D-13+D-14 Check-in differs | 9 · 9 · 9 · 8 · 8 | 8.6 | 8.4 | yes |
| DecideStock | 4 D-15 Not on the list | 9 · 9 · 9 · 8 · 8 | 8.6 | 8.4 | yes |
| Main | Decisions board (whole) | 9 · 9 · 8 · 8 · 8 | 8.4 | 8.4 | yes |
| Flow | Day before/after (whole) | 9 · 9 · 9 · 8 · 9 | 8.8 | 8.4 | yes |

## Remaining fixes

1. **DecideStock, the *sending* state (D-16).** The slide label "Written off · 102,000" runs under the spinner knob and reads "102,00". While sending, shorten the label or stop the text before the knob.
2. **DecideOrders p3, the NEXT card.** "Ridge cap · sells 26,000 · cos…" is cut off. Drop one of the two figures.
3. **D-22 figures disagree.**
   - Main reads "Cement 50 kg 20 → 12 · **Y12 rebar 12 m 10 → 10**".
   - The sheet (DecideOrders p6) reads "**PVC pipe 4 in 6 → 6**".
   - Use one second line on both. BRIEF names only the cement.
4. **D-28 means two different things.**
   - In Main and in Money's Asks-in strip, D-28 is Brian's Lubowa promise: 662,000 on Mon 19.
   - Money p3, also labelled D-28, is Ruth logging Kyaligonza's 2,310,000 promise, with "Grace sees Promised".
   - Relabel p3, or make Main's D-28 row match it.
5. **D-29 answer differs.** Main shows "Goals · 35M · 30M · 30M". Team p3 shows "Goals · 105M", with a fourth segment for the counter (10M). Use "Goals · 105M" in Main.
6. **MoneyCredit p1 has too much red.**
   - Use neutral bill icons, as Money p2 now does.
   - Put "38 d" and "9 Sep" in ink.
   - Keep one over-limit mark, on the bar past the hold line.
7. **The check-in word.** Settle handover §3 against §4 P-4, then use the one phrase in all four places: the DecideStock p3 dock, the success state, the Answers-out strip and Main D-13.
8. **MoneyCredit p4.** "Terms 14 → 14 days" draws a change that does not happen. Write "14 days · same".
9. **Today p1, the watch tiles.** "Nudge" is an underlined text link inside a tile about 50 px tall. Draw it as a 44 px pill, as Team's Nudge is.

These are minor and do not block anything: about 100 px of empty band above the dock on DecidePrice p2, DecideStock p1, MoneyCredit p1/p3 and Team p2. The Agent sheets pull the action up under the content.
