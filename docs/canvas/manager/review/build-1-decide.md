# Manager build 1: independent review of the decide pages (12 Nov 2026)

I drove the **built** app (`node tools/build-app.js manager` → `next/manager.html`) on `?demo` at 360 × 780 and put each screen next to its approved board PNG (`png/Today.png`, `DecidePrice.png`, `DecideOrders.png`, `DecideStock.png`, `MoneyCredit.png`). The method is the same as `round-4.md`, and the five measures are the ones in `BRIEF.md` "Scores": Consistency · Taps · Glance · Polish · In step (C · T · G · P · S). The *Board* column is that page's round-4 score. The *Built* column scores the running app only. Wherever I could, I reached each page by taps from Today. Otherwise I used `&push=x:<key>` with `&at=` as listed in `src/core/manager/demo/asks.ts`.

Every screen I took a score from also got a DOM check: tap targets under 44 px, clipped leaf text, anything past 360 px, text under 11 px, and how many elements are `#C93A30`. The screenshots are in the session scratchpad under `review-decide/`.

I did not mark down the decided differences: the pace figures (+3.53M ahead, Faith −1.54M, Q6), D-6's chips 3M · 5M · 10M (Q4), and Taken twice (Q7).

## Checks that pass everywhere

- **One red:** each screen has exactly one accent red, either the + FAB or the one slide knob. There is never a FAB on a sheet with a slide.
- **Tap targets:** every visible control is 44 px or more on every screen I shot.
- **Text size:** no text is under 11 px.
- **Width:** nothing runs past 360 px.
- **Queue order:** it matches the boards. D-7 is 1, D-18 2, D-3 3, D-16 4, D-1 5, D-20 6, D-12 7, D-24 8. The + opens the oldest in one tap.
- **Figures:** these all match their boards.
  - D-1: 1,380,000 · gain 240,000 · −45,000
  - D-4: 400,000 · gain 60,000
  - D-3: 337,500 · gain 67,500 · +77,500
  - D-2: 775,000 · gain 155,000
  - D-12: 1,710,000 / 1,900,000
  - D-18: 662,000 → 605,750
  - D-19: 878,000 → 558,000
  - D-16: 102,000
  - D-24: 298,500
  - D-13: −28,000
  - D-15: 68,000
  - D-17: −12,000
  - D-5: 3,690,000
  - D-6: 2,501,500
  - D-7: 1,240,000
  - D-32: 2,390,000 · 390,000 over · 610,000 left
- **Today's row states:** the Today row's default, pressed, disabled, sending, success (Undo 10 → row leaves, + 8 → 7), error (Not sent · Try again · Grace still sees Ruth decides), clash (Someone else just did this) and empty (Nothing waits on you, + is a tick) all work as drawn.

## Scores (C · T · G · P · S)

| Board · page | Reached by | Board | Built | At or above? |
|---|---|---|---|---|
| Today 1 · Today 09:40 | `?demo` | 9 · 9 · 9 · 9 · 9 | 9 · 9 · 9 · 9 · 9 | yes |
| Today 2 · Decide next 1 of 8 (D-7) | Today → + | 9 · 9 · 8 · 8 · 9 | 9 · 9 · 8 · 8 · 9 | yes |
| Today 3 · Answered, next slides in (D-18) | + → On credit · load it | 9 · 9 · 8 · 8 · 9 | 9 · 9 · **7 · 7** · 9 | **no** (gaps 1, 2) |
| Today 4 · All decided 09:59 | `&at=0959` → + (and by answering all 8) | 9 · 9 · 9 · 9 · 8 | 9 · 9 · **7 · 7** · 8 | **no** (gaps 3, 4, 5) |
| Today · 8 state cards | taps on Today's row; `&slow=1 &fail=price &clash=price &offline &state=empty` | (states) | offline header clipped | **no** (gap 6) |
| DecidePrice 1 · D-1 Under the shop's price, 5 of 8 | Today → tap the row | 9 · 9 · 9 · 8 · 9 | 9 · 9 · 9 · 8 · 9 | yes |
| DecidePrice 2 · D-4 At the counter, 1 of 1 | `&at=1120&push=x:counter:570:0` | 9 · 9 · 9 · 8 · 9 | **8** · 9 · 9 · 8 · 9 | **no** (gap 7) |
| DecidePrice 3 · D-3 Price up, 3 of 8 | Today → tap the row | 9 · 9 · 8 · 8 · 9 | 9 · 9 · **7** · 8 · 9 | **no** (gap 8) |
| DecidePrice 4 · D-2 Price coming, 1 of 2 | `&at=1015&push=x:price:553:0` | 9 · 9 · 8 · 8 · 9 | 9 · 9 · 8 · 8 · 9 | yes |
| DecidePrice · states (D-33, pressed, no cost, sending, success, error, offline, empty) | `&state=markup` → row; Price set → keypad; `&slow &fail &offline` | (states) | sending never seen; error has wrong word; no-cost unreachable | **no** (gaps 9, 10, 11) |
| DecideOrders 1 · D-12 Packed short, 7 of 8 | Today → tap the row | 9 · 9 · 9 · 8 · 9 | 9 · 9 · 9 · 8 · 9 | yes |
| DecideOrders 2 · D-20 Cancel asked, 6 of 8 | Today → … → next | 9 · 9 · 8 · 8 · 9 | 9 · 9 · 8 · 8 · **7** | **no** (gap 12) |
| DecideOrders 3 · D-18 Return asked, 2 of 8 | `&push=x:return:ia-547` / Today p3 | 9 · 9 · 8 · 8 · 9 | 9 · 9 · 8 · 8 · 9 | yes |
| DecideOrders 4 · D-19 Void asked, 1 of 1 | `&at=1420&push=x:void:ia-545` | 9 · 9 · 9 · 8 · 9 | 9 · 9 · 9 · 8 · 9 | yes |
| DecideOrders 5 · D-10 A line at 0, 1 of 1 | `&at=1610&push=x:given:563` | 9 · 9 · 8 · 8 · 9 | 9 · **6** · 8 · 8 · **7** | **no** (gap 13) |
| DecideOrders 6 · D-22 Peter asks for fewer | `&at=1125&push=x:agent:560` | 9 · 9 · 8 · 8 · 9 | 9 · 9 · **7** · 8 · 9 | **no** (gap 14) |
| DecideOrders · states (push, pressed, disabled D-19, sending, success, error, offline, empty) | `&slow &fail=settlePick &fail=creditNote &offline`, slide drags | (states) | error has wrong word; slide offline goes through | **no** (gaps 10, 15) |
| DecideStock 1 · D-16 Damaged, 4 of 8 | Today → tap the row | 9 · 9 · 9 · 8 · 9 | 9 · 9 · 9 · **7** · 9 | **no** (gaps 16, 17) |
| DecideStock 2 · D-24 A carton for the shelf, 8 of 8 | Today → tap the row | 9 · 9 · 9 · 9 · 9 | 9 · 9 · **8** · 9 · 9 | **no** (gap 17) |
| DecideStock 3 · D-13 + D-14 Check-in differs, 2 of 2 | `&at=1015&push=x:checkin:trip-1009` | 9 · 9 · 9 · 8 · 9 | 9 · 9 · 9 · 8 · 9 | yes |
| DecideStock 4 · D-15 Not on the list, 1 of 1 | `&at=1020&push=x:extra:sa-9` | 9 · 9 · 9 · 8 · 8 | 9 · 9 · 9 · 8 · 8 | yes |
| DecideStock · states (D-17, D-23, disabled, sending, success, error, offline, empty) | `&at=1620` D-17; switch off; `&slow &fail=extra &offline` | (states) | the error shows "All decided · 0 waiting" | **no** (gaps 10, 18, 19) |
| MoneyCredit 1 · D-5 Credit hold | `&at=1220&push=x:credit:555` | 9 · 9 · 8 · 8 · 9 | 9 · 9 · 8 · 8 · 9 | yes |
| MoneyCredit 2 · D-6 No limit set | `&at=1310&push=x:credit:552` | 9 · 9 · 8 · 8 · 9 | 9 · 9 · 8 · 8 · 9 | yes |
| MoneyCredit 3 · D-7 The Store asks | Today → + | 9 · 9 · 8 · 8 · 9 | 9 · 9 · 8 · 8 · 9 | yes |
| MoneyCredit 4 · D-32 Credit asked | `&at=1140&push=x:limit:cq-4` | 9 · 9 · 9 · 8 · 9 | 9 · 9 · 9 · 8 · 9 | yes |
| MoneyCredit · states (push, pressed, disabled, sending, success, error, offline, empty) | tap the 1.5M chip to clear it; `&slow &fail &offline` | (states) | the dock never spins | **no** (gap 9) |

## Verdict

- **Pages:** 13 of 22 board pages are at or above their board on every measure. 9 are below: Today p3 and p4, D-4, D-3, D-20, D-10, D-22, D-16 and D-24.
- **State sets:** all 5 boards' state sets have at least one gap, so 0 of 5 meet their board.
- **What is fine:** nothing fails on tap size, the red count, text size or width.
- **Where the gaps are:** wrong figures and words on the in-between screens (the next card's counter, All decided's header), one answer that is not built (D-10 "Bill it"), and the failure and no-signal states on the sheets.

## Gaps

### Blocking

1. **Today p3: the counter reads `1 of 7`; the board draws `2 of 8`.** `Decide.tsx` counts `n of q.length` over the queue that is still waiting, so the answered card drops out at once. The board keeps the day's total and moves the bar on. The same thing happens on every next card after an answer (`5 of 7` after D-1 and so on).
2. **Today p3: the answer strip is clipped.** It reads `On credit · load it · 1,24…`. The board draws `On credit · load it` with `#0551 · Musa · Grace see it`. The strip uses the label with the amount; it should use the answer word, or let the line wrap.
3. **Today p4: wrong header figures.** The board has `8 ANSWERED · 09:41–09:59` and the legend `Musa 3 · Denis 2 · Grace 2 · Brian 1`. The app shows `9 ANSWERED · 07:55–09:59` and `Brian 2`, because it counts the 07:55 approval of #0549 from before the queue. The same header shows on `&state=empty` (`1 ANSWERED · 07:55–07:55`) and after the later cards (`9 ANSWERED` at 10:20).
4. **Today p4: wrong "told" figure.** The board has `15 told`; the app shows `6 told`, which is the number of different people. Note that the board's own sum of the people told for the eight is 14 (16 with the two from before 09:40). Decide which meaning is right, then match both.
5. **Today p4: clipped text.** The Cancelled row sub reads `#0556 · Nothing p…` because the three avatars squeeze it. The board shows `#0556 · Nothing paid` in full.
6. **Today OFFLINE: the greeting is clipped.** It reads `Good mornin…` or `Good morning, …` next to the `1 waiting to send` and `Saved 09:38` chips. The board shows `Good morning, Ruth` and the chip on one line.
7. **D-4: wrong word.** The app shows `Cement 50 kg · 10 bag` and `On 10 bag`; the board has `10 bags` and `On 10 bags`. D-2 at 10:05 (#0562) has the same fault: `10 bag`.
8. **D-3: a figure is missing from the head.** The board's head has two chips: `Cost 24,000 → 27,000` and `−1,000 under cost`. The app shows only `−1,000 under cost`, so Ruth cannot see that the cost moved, which is the reason for the ask.
9. **The sending state on the sheets never shows.** This is the dock spinner on DecidePrice "SENDING · from the push" and MoneyCredit "SENDING". A tap answer moves on to the next card at once and is written after the 10 s Undo, off screen. Only Today's row and the slides ever show Sending. Either draw where the sending answer shows (the strip) or change the boards.
10. **The error state on a sheet uses the wrong word, and its card is missing.** I tried `&fail=price` on D-1, `&fail=settlePick` on D-12 and `&fail=extra` on D-15.
    - **Board:** a red `Not saved` / `Not sent · Keep it` card, and the dock reads `Musa still sees · Ruth decides` with Try again as the answer.
    - **App:** a bottom toast `Not sent · tell Kevin code MG-502`, while the dock still reads `Grace sees · Approved` for an answer that was not sent. "tell Kevin code MG-502" is not in the shop's words.
    - **Today's row:** after a sheet answer fails, the row comes back plain, without the red `Not sent` row that Today's own pill answer gets.
11. **DecidePrice DISABLED · no known cost cannot be reached.** It is built (`price.tsx`: `Cost ?` · Ask Denis), but no demo ask lacks a cost, so it cannot be checked. Add one to the demo or mark it untested.
12. **D-20: wrong people in "who stops" and "who sees".** The board has two rows, `Denis · off To ask` and `Musa · nothing to unpack`, and the dock reads `Grace · Denis · Musa see`. The app shows only Musa and `Grace · Musa see`. `whoStops` leaves out the buyer while the order is still at Checking. Today p4's answer log does list GA, DO and MK for the same answer, so the dock disagrees with the log.
13. **D-10: an answer is broken.** The outline answer `Bill it` is greyed: `given.tsx:51` has `disabled: 'not built yet'`. The board draws `Bill it` as a live answer ("Bill it 6 → 2").
14. **D-22: wrong figure.** The board has `300,000 paid stays on it · 510,000 is more`; the app shows `· 897,500 is more`, which is the whole order's new total, not Cement on #0560. The board and the app disagree on which figure this line means. Settle it in the spec, then match both.
15. **A slide goes through with no signal.** Return (D-18), Void (D-19) and paid Cancel slides do this. The DecideStock board rule is "a slide waits for signal", and `loss.tsx` and `count.tsx` do lock it (`Write off needs signal`). But `return.tsx`, `void.tsx` and `cancel.tsx` accept the slide offline, move on, and show a green-tick strip `Credit note raised · Brian · Esther see it` while nothing has been sent. The rule should be the same for every slide.
16. **D-16: clipped text.** The NEXT card reads `Grace · Under the shop's price…` with an ellipsis. The board's NEXT lines do not clip.
17. **The head's second line has lost its context on the stock sheets.**
    - **Board:** `Asked 08:10 · Cement 50 kg · 3 bags` (D-16), `Asked 09:25 · Wall plugs · 200 packs` (D-24), `Denis's trip · Owino` (D-13) and `Denis's trip · Nakawa` (D-15).
    - **App:** only `Asked hh:mm`.
    - **Worst case:** on D-24, "Wall plugs" now appears nowhere on the sheet.
18. **DecideStock ERROR shows the wrong figures.** I tried D-15 at 10:20 with `&fail=extra`. Once the 10 s Undo has passed, the sheet shows `All decided · 0 waiting` while the ask is still open and the + shows 1. The board says "nothing sent · the ask stays open".
19. **DecideStock SUCCESS (D-14 closes, then `THEN 10:20 · Not on the list`) cannot be reached.** `&at=1020` replaces the 10:15 cards rather than adding to them, so the check-in and the extra never wait together.

### Minor

20. The NEXT cards have one line where the board draws two. D-1 is missing `430,000 · Nothing paid`, D-12 `Wall plugs · 199 packs · 298,500`, and D-2 `PVC pipe 4 in · 11 of 12`. D-2 also writes `check-in differs` in lower case where the board has `Check-in differs`.
21. **Today p4:** the rows are about 65 px tall against about 42 px on the board, so only 7 of the 10 answers show above Back to Today.
22. **D-20:** the stage track has 5 stops (it adds Delivered); the board draws 4.
23. **D-4:** the head reads `Walk-in`; the board has `Walk-in · at the counter`. **D-32:** the head is missing `limit now 2M`, though the gauge shows `now 2M`.
24. **D-19:** the disabled knob shows a lock where the board draws a grey chevron. The sheet opens with neither Refund nor Deposit picked, which the board counts in its taps.
25. **Offline and error:** the message is a bottom toast with Try again, where the board has a band under the hero. On Today it covers the Watch tiles, and on the sheets the NEXT card.
26. **Pictures:** the Orders tab icon is a box, where the board draws a clipboard. The D-10 icon is a tag, where the board draws a gift.
27. **Not checked:** the lock-screen push cards cannot be driven in a browser.
