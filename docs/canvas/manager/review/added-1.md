# Manager canvas: independent review, Added boards 1 and 2 (12 Nov 2026)

I scored these boards only from the rendered PNGs. Before scoring I re-rendered both from the current `.dc.html` (`png/Added.png`, `png/Added2.png`, both 2040×1720). I compared them with the approved boards (Today, Money, MoneyCredit, Team, Orders) and the Agent references used in rounds 1–4. I ignored the boards' own score panels. The *Manager today* column is the grey number from each board's own panel.

Baselines (C · T · G · P · S):
- Sign in, could not reach, and You use Agent Today: 9 9 8 9 8.
- Limit, Look alike and Old books use the decision sheet: 9 9 8 8 8.
- The restock list uses Agent Clients: 9 8 8 8 8.

## Result

**Not yet. Six of the seven pages meet the baseline on every measure. AD01 "Could not reach the shop" is below on Polish (8 vs 9).**

## Board Added (1)

| Page | Manager today | Baseline | New | Avg | Every measure? |
|---|---|---|---|---|---|
| AD01 Sign in (with loading, sending, error, offline) | 5.8 | 9 · 9 · 8 · 9 · 8 | 9 · 9 · 9 · 9 · 9 | 9.0 | yes |
| AD01 Could not reach the shop | 2.8 | 9 · 9 · 8 · 9 · 8 | 9 · 9 · 8 · **8** · 8 | 8.4 | **no (Polish)** |
| AD02 You (sheet over Today) | 0.0 | 9 · 9 · 8 · 9 · 8 | 9 · 9 · 8 · 9 · 9 | 8.8 | yes |
| AD05 Denis's restock list | 3.8 | 9 · 8 · 8 · 8 · 8 | 9 · 8 · 8 · 8 · 9 | 8.4 | yes |

Notes:
- **Sign in.** Two fields, one navy button, and "The phone keeps you signed in". It is the cleanest page on either board.
- **Could not reach.** "tried 09:40 · code NET-TIMEOUT" is a technical code on a screen meant for people who read little. It is the only mono, jargon line on a hero page. The large empty middle above Sign out also reads unfinished next to Agent Today.
- **You.** It reuses the sheet, the rows and the toggle correctly. It has one primary action (Sign out), and the FAB is hidden under the sheet, which is right.
- **Restock list.** It mirrors Clients rows, with the answer on the row and "Denis sees Not yet or Go ahead" with a bell. The hero says "PLANNED · 3 LINES" but the Planned section counts 2 (2 Planned + 1 Not yet). The two do not agree at a glance.

## Board Added2 (2)

| Page | Manager today | Baseline | New | Avg | Every measure? |
|---|---|---|---|---|---|
| AD03 Change the limit (D-25) | 3.8 | 9 · 9 · 8 · 8 · 8 | 9 · 9 · 9 · 8 · 9 | 8.8 | yes |
| AD04 Look alike (D-26) | 3.2 | 9 · 9 · 8 · 8 · 8 | 9 · 9 · 8 · 8 · 8 | 8.4 | yes |
| AD04 Old books (D-27) | 3.0 | 9 · 9 · 8 · 8 · 8 | 9 · 9 · 8 · 8 · 8 | 8.4 | yes |

Notes:
- **Change the limit.** Chips, the owes bar with ticks at now 2M and 3M, and the white Save dock with "Grace sees". This is the decision-sheet language. There is an empty band of about 80 px above the dock, as on the round-4 sheets.
- **Look alike.** The kept and dropped cards side by side and the "After" bar are good. The pages lose points on the words: "records", "Goes into it", and a leading square icon on "Goes in the owner's log" that looks like an unticked box to tap. Handover D-26 also lists **Fix the phone** as an answer, and it is not drawn.
- **Old books.** The figures are right. The striped old-books slice on the owes bar is a clear picture. "Beside its bills" is a new phrase.

## Checks

- **States.** All eight are drawn on both boards: default, pressed, disabled, sending, success/undo, error, offline, and empty on board 1. They are drawn, not described.
- **One red.** Only `--accent` #C93A30 counts.
  - Board 1: the restock phone has the FAB, and the Iron sheet bar is `--bad`, which is allowed. Sign in, Could not reach and You have no accent.
  - Board 2: Look alike and Old books each have one slide knob and no FAB. Limit has none.
  - Pass.
- **Figures (checked against BRIEF):**
  - Ggaba owes 1,615,000, 81% of 2,000,000, 14 days, oldest 16 d. Correct.
  - Room left at 3M: 3,000,000 − 1,615,000 = 1,385,000. Correct.
  - Old books 290,000 since 1 Oct. 1,615,000 + 290,000 = 1,905,000. Left at 2M: 95,000. Correct.
  - Gaba Stores 1 order, 0. After the merge, 6 + 1 = 7 orders, 1,615,000. Correct.
  - Restock: 2,280,000 + 1,360,000 + 810,000 = 4,450,000. Go ahead 3,640,000 and Not yet 810,000 add up. Correct.
  - The one mismatch is "3 lines" vs "Planned 2".
- **44 px.** Chips, row pills (Not yet, Go ahead, Waits, Change, Undo), Try again, Sign out and the close buttons all look 44 or more in the render. The source has 57 `height: 44px`.
- **Text under 11 px.** None. The smallest in either source is 11 px ("now" tags, mono subs).
- **Clipping at 360.** Nothing is clipped. The half-hidden Money p4 row behind the limit sheet is backdrop, which is fine.

## Words (handover §3 + GLOSSARY)

| Word on board | In handover/glossary? | Verdict |
|---|---|---|
| NET-TIMEOUT | no | **Not acceptable.** Drop it. The line reads "tried 09:40". The code belongs in the log, not on the phone. |
| Room left | no | **Not acceptable.** Old books says "95,000 left" for the same idea. Use **Left · 1,385,000**, so there is one word per concept. |
| Goes into it | no | Change it to **Merged in**, to pair with *Kept* and the handover's *Merge*. |
| Goes in the owner's log | "owner's log" yes (D-26/27) | Acceptable. Swap the square icon for the log/book icon so it does not read as a checkbox. |
| the app spotted 2 records | "records" is developer talk | Use **2 customers look alike**. |
| Beside its bills | no | Use **Bills · 2**. |
| Open the copy · look only | "look only" yes | Acceptable. **Open the saved copy** would be clearer. |
| Old books, Opening balance, Look alike, Not the same, Kept, Cash only, Not yet, Go ahead, Nothing to save | yes | OK |

## Fixes

### Required (blocking)

1. **AD01 Could not reach.** Remove "code NET-TIMEOUT". This lifts Polish to 9. Also pull the empty middle up, so the Try again and Open the copy group sits under the message, as on Agent Today.
2. **AD03 Limit (default + pressed).** Change "Room left" to the same word as Old books: "Left · 1,385,000" or "1,385,000 left".
3. **AD05 Restock.** Make the hero count agree with the sections. Either "3 LINES" with sections "Planned 2 · Not yet 1" visible in the hero (the green/orange keys already do this), or relabel the hero "THIS TRIP · 3 LINES" so "PLANNED" is not used for two different counts.

### Optional

4. Look alike: "Goes into it" → "Merged in". "the app spotted 2 records" → "2 customers look alike".
5. Draw handover D-26's third answer, **Fix the phone**, as a text link under "Not the same", or record in the handover that it was dropped.
6. Replace the square icon before "Goes in the owner's log" on both slide docks.
7. Old books: "Beside its bills" → "Bills · 2".
8. The board strip shows D-25 before D-27. After a 3M limit, Old books would show 3M and 1,095,000 left. Either keep Old books at 2M and order the strip 27 before 25, or add a one-line note that each sheet starts from the BRIEF state. Also, D-26 and D-27 have no asker per handover, so "Asks in" fits only D-25.
9. Success states differ. The limit uses the navy toast with the ring timer. The merge uses a white card with a plain "Undo 10". Use the navy ring toast for both.
10. Limit ERROR says "Not saved · no signal", but OFFLINE says a Save queues. Make the error a server refusal ("Not saved · try again") so the two states do not contradict.
11. Pull the dock up under the content on the limit sheet (an empty band of about 80 px), as in round 4 fix 2.

## Round 2 (re-rendered from the current `.dc.html`, 12 Nov 2026)

I re-rendered both boards and checked them from the PNGs again.

**Blocking fixes 1–3: all done.**
1. Could not reach: "code NET-TIMEOUT" is gone. The line now reads "tried 09:40". Try again, Open the saved copy and Sign out now sit under the message.
2. Limit: the default and pressed states both read **Left · 1,385,000**, the same word as Old books' "95,000 left".
3. Restock: the hero reads **THIS TRIP · 3 LINES**. It no longer clashes with "Planned 2".

**Optional fixes also done:**
- 4: "Merged in"; "2 customers look alike".
- 6: a list icon replaces the square before "Goes in the owner's log".
- 7: "Bills · 2".
- "Open the saved copy".
- The Old books icon is now a book.

**Still open (optional, not blocking):**
- 5: "Fix the phone" is still not drawn.
- 8: the strip order and the 2M limit on Old books.
- 9: two different success toasts.
- 10: the limit error still reads "no signal".
- 11: the empty band above the limit dock.

| Page | Baseline | Round 1 | **Round 2** | Every measure? |
|---|---|---|---|---|
| AD01 Sign in | 9 · 9 · 8 · 9 · 8 | 9 · 9 · 9 · 9 · 9 | 9 · 9 · 9 · 9 · 9 | yes |
| AD01 Could not reach | 9 · 9 · 8 · 9 · 8 | 9 · 9 · 8 · 8 · 8 | **9 · 9 · 9 · 9 · 8** | **yes** |
| AD02 You | 9 · 9 · 8 · 9 · 8 | 9 · 9 · 8 · 9 · 9 | 9 · 9 · 8 · 9 · 9 | yes |
| AD05 Restock list | 9 · 8 · 8 · 8 · 8 | 9 · 8 · 8 · 8 · 9 | 9 · 8 · 9 · 8 · 9 | yes |
| AD03 Change the limit | 9 · 9 · 8 · 8 · 8 | 9 · 9 · 9 · 8 · 9 | 9 · 9 · 9 · 8 · 9 | yes |
| AD04 Look alike | 9 · 9 · 8 · 8 · 8 | 9 · 9 · 8 · 8 · 8 | 9 · 9 · 9 · 8 · 8 | yes |
| AD04 Old books | 9 · 9 · 8 · 8 · 8 | 9 · 9 · 8 · 8 · 8 | 9 · 9 · 8 · 8 · 8 | yes |

Checks after the fixes:
- The figures are unchanged and still add up.
- Each phone still has one red.
- There is still no text under 11 px.
- Nothing is clipped at 360.

**Verdict: every page is at or above its baseline on every measure. No blocking fix is left.**
