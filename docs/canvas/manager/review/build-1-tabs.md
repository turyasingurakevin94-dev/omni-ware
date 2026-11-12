# Manager build: independent review 1, the tabs and the added pages (12 Nov 2026)

I drove the built app (`node tools/build-app.js manager` → `next/manager.html`) on `?demo` at 360×780. I reached every page by taps from Today and the tab bar, then compared it with its approved board PNG (`png/Orders.png`, `Money.png`, `Team.png`, `Added.png`, `Added2.png`). I scored it with the round-4 method: the five measures C · T · G · P · S (Consistency with the Agent app · Taps per decision · Glanceability · Polish · In step with the asker). The board score comes from `round-4.md` (Orders, Money, Team) and `added-1.md` (Added, Added2). For AD01 "Could not reach" I took the score after its fix, since the PNG now draws the fixed page. I used the switches `&at=1005`, `&at=1140`, `&state=twins|signed-out|no-reach|empty`, `&offline`, `&fail=<write>` and `&slow=1`. The screenshots are in the session scratchpad (`review-tabs/`).

I did not mark down the decided differences:
- the pace figures (+3.53M ahead, Faith −1.54M, Brian −0.28M, Faith "0.88M a day");
- Taken twice is not in the + count;
- "Statement · not in this app yet".

Checks run on every page: buttons under 44 px (counting the `::after` hit-area pads, so the 36 px row pills with a −4 px pad pass), text under 11 px (none anywhere), text clipped with an ellipsis, and the `--accent` red count. The red count passes everywhere: one per screen, either the + or one slide knob, and sheets with a slide have no +.

## Result

**6 of 19 pages are at or above their board on every measure. 13 are below.** One page (AD05, Denis's restock list) cannot be reached at all.

| # | Board page | How reached | Board C·T·G·P·S | Built C·T·G·P·S | At or above? |
|---|---|---|---|---|---|
| 1 | Orders p1 by stage | Today → `nav a[href='#orders']` | 9·8·8·8·9 | 9·8·8·**7**·**8** | no |
| 2 | Orders p2 one order #0552 | Orders → #0552 row | 9·9·8·8·9 | 9·9·8·8·9 | **yes** |
| 3 | Orders p3 Stuck | Orders → "Stuck 1" chip, or the #0554 row | 9·8·8·8·9 | 9·8·**7**·8·9 | no |
| 4 | Orders p4 To bill 10:05 | `&at=1005` Orders → Delivered column | 9·8·8·8·9 | 9·8·8·**7**·**8** | no |
| 5 | Money p1 | tab Money | 9·9·9·9·9 | 9·9·9·**8**·9 | no (minor) |
| 6 | Money p2 Kyaligonza | Money → lead card | 9·9·8·9·9 | 9·9·8·**8**·**8** | no |
| 7 | Money p3 promise sheet | p2 → Promise | 9·8·8·9·9 | 9·8·8·**8**·9 | no |
| 8 | Money p4 Ggaba 11:40 | `&at=1140` Money → Ggaba row → "OWES ›" | 9·8·8·9·9 | 9·**7**·8·**8**·**8** | no |
| 9 | Team p1 | tab Team | 9·8·9·8·9 | 9·8·9·8·9 | **yes** |
| 10 | Team p2 Faith's sheet | Team → Faith row | 9·9·8·8·9 | 9·9·8·8·9 | **yes** |
| 11 | Team p3 Goals and limits | Team → "SALES INVOICED ›" | 9·8·8·8·9 | 9·8·8·8·9 | **yes** |
| 12 | Team p4 Nudge Denis | Team → Denis tile | 9·8·8·8·9 | 9·8·8·**7**·**8** | no |
| 13 | Added AD01 Sign in | `&state=signed-out` | 9·9·9·9·9 | 9·9·9·9·9 | **yes** |
| 14 | Added AD01 Could not reach | `&state=no-reach` | 9·9·8·9·8 | 9·9·8·9·8 | **yes** |
| 15 | Added AD02 You | Today → RN disc | 9·9·8·9·9 | 9·9·8·**7**·9 | no |
| 16 | Added AD05 Denis's restock list | **no tap reaches it** (not by `#orders/stock` either) | 9·8·8·8·9 | not reachable, not scored | no |
| 17 | Added2 AD03 Change the limit | p4 → Change | 9·9·9·8·9 | 9·9·9·8·**8** | no |
| 18 | Added2 AD04 Look alike | p4 → Look alike Open | 9·9·8·8·8 | 9·9·8·8·**7** | no |
| 19 | Added2 AD04 Old books | p4 → Old books Open | 9·9·8·8·8 | 9·9·**7**·8·**7** | no |

What matched well:
- Orders p2: the Waits-on-Ruth card, the price track and "Faith · Denis see".
- Money p1: the bands sum to 6,679,000 and each figure is right.
- Money p4: the credit card, Limit now, Look alike and Old books are all as drawn.
- Team p1–p3.
- Sign in.
- The Nudge states on Orders p1: pressed, Nudging, "Nudged Denis · 09:40" with Undo, and offline "Waits".
- The Limit sheet: the pressed state with the now 2M and 3M ticks and "Left 1,385,000", plus its sending and error states.
- The error words on the merge slide ("Not merged · Try again").

## GAPS

### Blocking

1. **AD05 Denis's restock list cannot be reached.** `orders/stock` is registered in `src/apps/manager/orders/index.tsx`, but no `nav.push('orders/stock')` exists anywhere. A deep link (`#orders/stock`) also falls back to Today. On the board the page has a back button from Orders. Result: a dead page, and its "Not yet" and "Go ahead" answers cannot be given.
2. **Orders p1, Ggaba #0556 age.** The board says "0 h 50 m / 2 h". The app says "1 h 20 m / 2 h", because the demo order has `stageAt 08:20` while the cancel ask is at 08:50. Kyaligonza agrees (1 h 05 m), so either the demo stage time or the bar's meaning is wrong. Wrong figure.
3. **Orders p1, hero "1 stuck" link.** It is a 35×24 button with no hit-area pad. Under 44 px.
4. **Orders p1, #0551 row.** The name is clipped to "Nansana Hardwa…" at 360.
5. **Orders p1, error state.** The sub line is clipped: "Nudge Denis · #0…". The board reads "Nudge Denis · #0554".
6. **Orders p4, success word.** After Bill it, the strip reads "**Bill it** · 567 · #0561". The board reads "**Invoiced** · 567 · #0561 · Undo 10 s", the result word and not the verb. The board's "Grace sees: Invoiced" line is also missing.
7. **The Undo strip covers the page title** on pushed pages: To bill, Kyaligonza and Ggaba. During the slide-in it also overlaps the title text ("Merged · Ggaba Stores" over "Ggaba Stores"). For 10 s it hides the title and half the back button. The board draws the success state inline in the row or card, or as a push card, never over the head.
8. **Orders p4, Taken twice.** The board's default (twin card with Open / Both are real, 5 bills, 1,493,567, Bills itself 748,000) cannot be reproduced:
   - by default, #0545 is invoiced, so the page shows the disabled slide;
   - with `&state=twins`, the head reads **To bill 6 · 1,813,567 · Bills itself 1,068,000**, because #0545 joins Bills itself.

   Board or app: pick one.
9. **Orders p4, disabled "Billed first · ask for a void".** It is drawn as a full navy slide with a knob, so it looks live. The board draws it greyed (#F1EEE8 track, grey lock).
10. **Money p2, offline.** The amber "No signal · it sends when back · 1 waiting" banner is in the DOM but sits under the navy dock, so it cannot be seen. The board shows the banner and a "Waits" row. Missing state on the debtor page.
11. **Money p2 and p4, "OWES ›".** It is 320×22 on p2 and 320×14 on p4, and it is the **only** way from a debtor to the customer page (Money p4: limit, look alike, old books). Under 44 px, and a hidden route. Taps from the app to Ggaba's credit card become Money → row → OWES ›, against "1 tap on the card" on the board.
12. **Money p3, after "Promised".** The new open promise is drawn at the right end of the track, on top of the word "today", and the two overlap. It should sit at Mon 19, after today.
13. **Money p3, day chips.** Sun to Fri are each 43×64 (under 44 wide). "Pick a day later" is 328×39.
14. **Money p4 / AD03, the credit ask stays after a Save.** After Save · Limit 3,000,000 from the Change sheet, Esther's ask card is still there and now reads "3,000,000 › 3,000,000 · 14 days", with its answers still live. The answer is broken: setting the limit should answer D-32, or the card should say it is done.
15. **AD04 Look alike, success.** The toast "Merged · Ggaba Stores" has no Undo. The board's success state is "Merged · Ggaba Stores · 7 orders · 1,615,000 · Undo 10".
16. **AD04 Old books, the figures disagree.**
    - The sheet says Owes 1,615,000 → **1,905,000** and "95,000 left".
    - The demo already counts the 290,000 inside 1,615,000. The debtor page lists "Thu 1 Oct · old books · 290,000" plus 1,325,000.
    - After the slide, owes stays 1,615,000, and the card reads "Old books · **0 left**", a phrase that is in neither the board nor the glossary.

    Wrong figure and wrong word.
17. **Team p4, Nudge Denis error.** The dock's "Try again" button is squashed to **328×19** at the bottom edge (it is clipped). On the board it is a full 44 px "Try again" pill.
18. **AD02 You.**
    - The RN avatar is stretched into a 128×56 navy pill. It should be a 56 px disc.
    - "Manager · Mukasa Hardware" wraps to two lines.
    - The push toggle is 52×32 and the row is not the button. Under 44 px.

### Minor

19. Orders p1 and p3 have no search button in the hero (the board has one at the top right).
20. Orders p2 shows the age chip as "2 h 10". The board has "2 h 10 m".
21. Orders p3:
    - "Denis holds it · **3 orders**", where the board has "**trip at 11:30**". This loses the one fact that says when he can act.
    - "Give it to Moses · Sourcing", where the board has "Sourcing · finds items".
22. Orders p4: the Bills itself rings use a clock glyph. The board uses the lightning bolt ("bills itself").
23. Orders and To bill, offline: the amber banner sits at the bottom above the bar. The board draws it at the top of the list.
24. Money p1: the active Money tab icon renders as a solid navy block, and the note detail is lost. The other active icons keep their shape.
25. Money p3, error: the board makes the dock an error card ("Promised · Mon 19 / Not saved · no signal / Try again"). The app keeps the "Promised …" button with a red "Not saved · Try again" line above it. It is readable but not as drawn.
26. AD03, disabled: "Grace sees **Limit 2,000,000 · 14 days**" shows over "Nothing to save". She would see nothing.
27. Team p4:
    - "Buyer · 3 orders", where the board has "Buyer · trip from 11:30".
    - The push preview breaks "2 / h 40 m" across lines.
28. AD01 Could not reach: a wifi-off glyph, where the board has cloud-off.
29. Empty states that cannot be shown on demo: "Nothing stuck · nothing to bill", "Nobody owes" and Team "Nothing in hand" exist in code, but `&state=empty` only empties the queue, so I did not check them against the board.

The page and state with nothing to report:
- Sign in;
- every Team p3 state: default, Sending…, "November · set" with Undo 10 s, and Nothing to save.

## Round 2 (12 Nov 2026, after the fixes)

I rebuilt the app (`node tools/build-app.js manager`) and drove every page and state again at 360 px on `?demo`, by taps. Screenshots are in the scratchpad (`review-tabs/r2/`). The restock list is now reached from Orders → "Denis's list" chip → Denis's restock list card. That is the new "THE WAY IN" card on the Added board.

**Result: 11 of 19 pages are at or above their board on every measure (round 1: 6). 8 are below. 7 blocking gaps are left.**

### Round 1 gaps now fixed (checked in the app)

| Round 1 gap | Fixed |
|---|---|
| 1 | Restock list reached |
| 3 | "1 stuck" has a 44 px pad |
| 4 | "Nansana Hardware" wraps instead of being clipped |
| 5 | Error line wraps to "Nudge Denis · #0554" |
| 6 | "Invoiced · 567 · #0561" inline, with "Grace sees: Invoiced" |
| 8 | Twins: 5 · 1,493,567 · Bills itself 748,000, as on the board |
| 9 | Locked void slide is grey |
| 10 | Debtor offline banner shows above the dock, with a "Waits" row |
| 11 | "OWES ›" is padded |
| 12 | The promise mark sits right of today, labelled "19 Oct" |
| 13 | Day chips are 44 px |
| 14 | Saving the limit answers Esther's ask, and the card goes |
| 16 | Old books: owes 1,905,000, 95% of 2M |
| 17 | Team "Try again" is full size |
| 18 | You: round avatar, toggle 44 px |

On Orders p1, the inline Undo strip in the row also no longer covers anything.

### Scores, round 2 (board → built)

| # | Page | Board | Built | At or above? |
|---|---|---|---|---|
| 1 | Orders p1 | 9·8·8·8·9 | 9·8·8·**7**·**8** | no |
| 2 | Orders p2 #0552 | 9·9·8·8·9 | 9·9·8·8·9 | yes |
| 3 | Orders p3 Stuck | 9·8·8·8·9 | 9·8·**7**·8·9 | no (minor only) |
| 4 | Orders p4 To bill | 9·8·8·8·9 | 9·8·8·8·9 | yes |
| 5 | Money p1 | 9·9·9·9·9 | 9·9·9·**8**·9 | no (minor only) |
| 6 | Money p2 Kyaligonza | 9·9·8·9·9 | 9·9·8·**8**·9 | no |
| 7 | Money p3 Promise | 9·8·8·9·9 | 9·8·8·9·9 | yes |
| 8 | Money p4 Ggaba | 9·8·8·9·9 | 9·8·8·**8**·9 | no |
| 9 | Team p1 | 9·8·9·8·9 | 9·8·9·8·9 | yes |
| 10 | Team p2 Faith | 9·9·8·8·9 | 9·9·8·8·9 | yes |
| 11 | Team p3 Goals | 9·8·8·8·9 | 9·8·8·8·9 | yes |
| 12 | Team p4 Nudge Denis | 9·8·8·8·9 | 9·8·8·8·9 | yes |
| 13 | AD01 Sign in | 9·9·9·9·9 | 9·9·9·9·9 | yes |
| 14 | AD01 Could not reach | 9·9·8·9·8 | 9·9·8·9·8 | yes |
| 15 | AD02 You | 9·9·8·9·9 | 9·9·8·9·9 | yes |
| 16 | AD05 Restock list | 9·8·8·8·9 | 9·8·8·**7**·**8** | no |
| 17 | AD03 Change the limit | 9·9·9·8·9 | 9·9·9·8·9 | yes |
| 18 | AD04 Look alike | 9·9·8·8·8 | 9·9·8·8·**7** | no |
| 19 | AD04 Old books | 9·9·8·8·8 | 9·9·8·**7**·8 | no |

### Gaps left

#### Blocking

R2-1. **The success toast still covers the head on pushed pages.** "Nudged Grace · Undo", "Limit set · 3,000,000 · Undo", "Merged · Ggaba Stores", "Opening balance · 290,000" and "Not yet · Cement 50 kg · Undo" each sit over the back button and the page title for 10 s. The places are the debtor, the customer and the restock list. The inline strips on Orders and To bill are fixed; this toast is not. (Pages 6, 8, 16, 17, 19.)

R2-2. **AD04 Look alike, success has no Undo.** The toast reads only "Merged · Ggaba Stores". The board reads "Merged · Ggaba Stores · 7 orders · 1,615,000 · Undo 10".

R2-3. **AD05 restock list has two reds.** The weeks-left bar on Iron sheet uses `--accent` #C93A30 (`.mg-stk-weeks.bad i.on`, `src/apps/manager/orders/stock.css:33`), on top of the +. The board uses `--bad` #8E2A22.

R2-4. **AD05 error words.** `&fail=restock` shows "Not sent · tell Kevin · code MG-502". The added-1 review already ruled codes off the phone (NET-TIMEOUT). The house error is "Not sent · Try again".

R2-5. **Orders p1, the Denis's list chip is clipped.** Once selected, the chip stays cut to "Den…" at the right edge, because the chip row does not scroll to it. The board draws the row swiped, with "Denis's list 3" in full.

R2-6. **Orders p1, Ggaba #0556 age is still wrong.** The app says "1 h 20 m / 2 h"; the board says "0 h 50 m / 2 h" (demo `stageAt 08:20`, ask at 08:50). This was not in the fix list.

R2-7. **AD04 Old books, the finished card reads "Old books · 0 left".** That is a new phrase, it is not in the glossary, and nothing on the board matches it. The board's success state moves the dock on to the next thing.

#### Minor

R2-8. Orders p3 and Team p4 say "Denis holds it · 3 orders" and "Buyer · 3 orders". The board says "trip at 11:30" and "trip from 11:30". The restock head also lacks "next trip 11:30".

R2-9. The restock card on Orders wraps to "…4,450,000 · 1 / not yet". The board has one line, "this trip · 3 lines · 4,450,000".

R2-10. The restock rows use product photo tiles. The board uses line icons in a neutral tile.

R2-11. The active Money tab icon is still a solid navy block.

R2-12. Round 1 minors 19–29 that are not listed above are unchanged.
