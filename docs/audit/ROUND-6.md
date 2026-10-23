# Round 6: Wording and consistency   (brief received 23 Oct 2026, build 23 Oct 2026 19:02 UTC)

Canvas: https://claude.ai/artifact/LVsyQEintezbVH3qn4cSVi, row "Audit round 6 · wording" (bottom of the canvas, version 102).
Migration: none. This round is store.html only.
Do not regress (round 5): the snapshot with no money for the store role, "Could not load the yard", display names, own-row-only `shop_members`, the Back guard.

## What was found

| ID | Root cause |
|---|---|
| WORD-01 | `staffName(id)` returns the staff record's name as stored, and this person's staff record is literally named "turyasingurakevin94". Only `myName()` skips a handle (`looksHandle`), and only for the person themself. Everything that names someone else goes through `staffName` / `tripWho` / `takerOf` / a stored `byName`, so the handle shows on Alerts, Checked in today, the collect receipt, With Ruth and Returns. The members list from 0164 (`D().members`, the name each person chose) is not used to name anyone but yourself. |
| WORD-02 | The shift change reuses goods words: You has "Hand the yard to …", and the page is titled "Hand over the yard". |
| WORD-03 | Four places wrote their own wording: the bay tile and Load ("waits on money"), the slip foot ("Packed · waits on the money"), the stamp and banner ("Not paid · cash customer · It can't leave the gate yet…"), and Today's "more" line ("holds"). |
| WORD-04 | Today's "to pack" tile is `packQueue + waitingOnGoods`; the To pack screen counts them apart. Today's legend and ring count "delivered" as everything completed today, collections included; On the road shows "delivered today" and "collected" as two numbers. |
| WORD-05 | `ruthAsks()` keeps only the asks this login sent (`mine(by)`). Returns, Count and Report show everyone's. |
| WORD-06 | The row is not an aisle count: it is the Manager's answer to a **trip check-in difference** (`ruthAsks`, the trips part). It is titled with `tripWho` (the handle) and answered "Accepted your count". |
| WORD-07 | `waitClock()` prints a duration as a clock ("oldest 9:41"); `hm()` prints a clock time with no day ("Left 23:28", the pinned alert). `whenSaid()` exists, with a day, but only 4 places use it, against 59 `hm(`. |
| WORD-08 | "Checked in today" names a check-in of several trips a "round" (`r.length > 1 ? 'round'`); everywhere else it is a "trip". |
| WORD-09 | Stock history prints `stock_log.note` as written by the console ("Quote for Walk-in"). Units come from three places: `unitWord()` lowercases, `quoteLineCount()` keeps the order line's case ("Ctn"), `fmtLevels` keeps the units table's. |
| WORD-10 | Every alert of the last 7 days counts as unread until the Alerts page is *left* (the seen time is saved on the way out). Other people's routine check-ins count as well. |

## Glossary (the words the code uses, one per thing)

| Word | Means | Where it is used | Never |
|---|---|---|---|
| A person's name | The name they chose (`members`), else their staff record's unless it looks like a login, else "Someone" | Alerts, With Ruth, Returns, Collect receipt, "taken by", "counted by", trips, You | the login handle, a stored byName that differs |
| You | The person holding the phone, in their own lists | With Ruth rows, counts, reports | their own name |
| Trip | A buying pickup; "trip · 3 suppliers" when it has several | Today jobs, Checked in today, Alerts, With Ruth, Ride | round |
| Delivery (supplier) | A supplier brings the goods to the yard | Checked in today | trip |
| Hand over | Goods to a collector at the gate | Slip, Agent pickup, done screens | the shift |
| Pass the yard | The shift to a colleague; "End my shift" on You | You, the Pass the yard page, Today's card for the one who gets it | hand over, handover |
| Not paid yet | An order that cannot leave until it is paid | bay tile, Today job, Load, slip stamp | waits on money, holds, cash customer |
| To pack | Ready to pack now | Today tile, To pack screen, play button | waiting on goods counted in it |
| Waiting on goods | Bought in for the order, not in yet | Today tile ("+1 waiting"), To pack, order view | to pack |
| Delivered | Left the yard for good: at the door, or collected at the gate | Today ring and legend, On the road | "gone out" vs "delivered" counting differently |
| Waiting on Ruth | Any yard ask the Manager has not answered | With Ruth, Returns, Count, Report | only your own |
| How long | `howLong(min)`: "41 m", "9 h 41 m", "2 days" | waits, oldest, ages | a clock time for a duration |
| When | `when(ms)`: "15:20" today, "Thu 23:28" otherwise | Left, delivered at, alerts, counted at | a clock time with no day when it is not today |
| A sale | "Order #0548 · Walk-in" | Stock history | Quote for … |
| Units | lower case, through one `unitSay()` | every quantity | 1 Ctn and 1 ctn on the same screen |

## Design changes (canvas)

| ID | Board(s) | Before → After | States drawn | Tokens/components used | New component? |
|---|---|---|---|---|---|
| WORD-01 / 06 / 08 | `OneName` | Before: "turyasingurakevin94 is back at the yard", "…'s round · 7 lines", "…'s trip · abc / Accepted your count", "Return logged · turyasingurakevin94 told", "Taken by turyasingurakevin94". After: "Denis is back at the yard", "Denis's trip · 3 suppliers · 7 lines", "Your check-in of Denis's trip · Hinges · Ruth accepted 2 of 3", "Return logged · Grace told", "Taken by Grace". | before, after | list rows, faces | No |
| WORD-03 | `NotPaidYet` | One amber label, "Not paid yet", on the bay tile, Today's job, Load's list and the slip stamp. One explanation, only on the order: "Sales take the money before it leaves, or Ruth lets it go on credit.", with "Ask Ruth to let it go". | Today and bays, Load, the order | amber chip/stamp (existing), list rows | No |
| WORD-04 | `CountsAgree` | The Today tile counts ready orders ("1 to pack"), with "+1 waiting" beside it. The To pack screen shows "1 to pack" with "Waiting on goods · 1" below. "Delivered" includes collected everywhere: On the road shows "3 delivered today · 1 of them collected". | Today, To pack, On the road | hero tiles, stat strip | No |
| WORD-05 | `WithRuthAll` | Every yard ask still waiting, each with who sent it (a face, "You" for your own); "4 waiting on Ruth · 2 yours". | one | stat strip, list rows, faces | No |
| WORD-02 | `PassTheYard` | You: "End my shift · pass the yard to Joy". The page: "Pass the yard to Joy". The gate keeps "Slide to hand over to Peter". | You, Pass the yard, the gate (unchanged) | navy button, list rows | No |
| WORD-10 | `AlertsForYou` | Two groups: "For you" (a recount asked of you, a trip back for you to check in) with the dot and the badge; "In the yard today" (others' check-ins and hand-overs), no dot. Older than today is read. Opening Alerts marks them read: the badge goes to 0. | opening, after | bell badge, list rows | No |
| WORD-07 / 09 + glossary | `WordsAndTimes` | The glossary above, as a say / never sheet: "9 h 41 m" not "oldest 9:41", "Thu 23:28" not "Left 23:28", "Out · Order #0548 · Walk-in", "1 ctn · 6 pcs". | one | table | No |

## Code changes planned

| ID | Sev | File / function | Change (one line) | UI? | Acceptance check |
|---|---|---|---|---|---|
| WORD-01 | P2 | `store.html`: new `personName({ userId, staffId, stored })` (members → staff record unless `looksHandle` → stored unless a handle → "Someone"); `staffName`, `tripWho`, `takerOf`, `managerName` and every `byName` / `countedByName` / `askedByName` / `reportedByName` on screen go through it | One resolver for every name. | yes | The rendered text of every screen in the harness (with a staff record named like a handle) never contains the handle. Test greps the screens. |
| WORD-02 | P2 | `store.html`: You's button, `PAGE.handover` title and copy, the "handed you the yard" card → "passed you the yard" | Hand over is for goods only. | yes | "hand over" / "handover" appears nowhere in the shift flow's text. |
| WORD-03 | P2 | `store.html`: `NOT_PAID = 'Not paid yet'` used by the bay tile, Today job, Load, slip foot and stamp; one `notPaidWhy()` line on the slip; Today's "more" line drops "holds"; `failSay` for OWCSH says "Not paid yet · Sales take the money first" | One label, one reason. | yes | The same unpaid order reads "Not paid yet" on the bay, Today, Load and the slip. |
| WORD-04 | P2 | `store.html`: `counts()` gives `toPack` (ready), `waitingGoods`, `delivered` (completed today, collections included), `collected`; Today's tiles, legend and ring, To pack and On the road all read it | One definition per word. | yes | Each Today number equals the screen its tile opens. |
| WORD-05 | P2 | `store.html`: `ruthAsks()` lists every yard ask (counts, returns, reports, trips, restock, extras) with `by`; rows show the sender ("You" for yours); the stat strip says "N waiting on Ruth · M yours" | Everything waiting, with who sent it. | yes | With Ruth's waiting count equals the waiting items in Returns, Count and Report. |
| WORD-06 | P3 | `store.html`: the trip-difference row → "Your check-in of Denis's trip · Hinges", answer "Ruth accepted 2 of 3" | Says what it is. | yes | No count is called a trip, and no trip a count. |
| WORD-07 | P3 | `store.html`: `howLong(min)` ("9 h 41 m") replaces `waitWords` and `waitClock`; `when(ms)` ("15:20" today, "Thu 23:28" otherwise) replaces bare `hm()` wherever the moment may not be today | One way to write each. | yes | No screen shows a duration as a clock, or a clock time from another day without the day. |
| WORD-08 | P3 | `store.html`: "Checked in today" and every other place: "trip", "trip · N suppliers" | One word. | yes | "round" appears nowhere on screen. |
| WORD-09 | P3 | `store.html`: `logNoteSay(note)` turns "Quote for X" (and "Quote #n for X") into "Order #0548 · X"; `unitSay(u)` lower-cases every unit, used by `unitWord`, `quoteLineCount`, `fmtLevels`, `backText` | One formatter for each. | yes | Stock history never says "Quote"; a unit has one case on every screen. |
| WORD-10 | P3 | `store.html`: each alert gets `forYou` (answers to your asks, a recount of your count, a trip assigned to you back at the yard, a shift passed to you, a credit answer to your ask); only `forYou` and today can be unread; the seen time is saved when Alerts *opens* | The bell is what needs you. | yes | After opening Alerts once, the badge is 0 until something new needs this person. |

### DATA-05 (still open): check on live

Paste in the SQL editor (read-only). Every row should say `moved`. Anything else is listed with where it sits now, with `NOT moved` rows first.

See `docs/audit/round-6-data05-check.sql`.

## Not changing / pushed back

| ID | Why |
|---|---|
| WORD-03 ("Sales must take the money") | `docs/decision-rights.md` gives credit to the Manager (credit.release), so the one explanation line names both ways out: "Sales take the money before it leaves, or Ruth lets it go on credit." |
| WORD-06 ("Your count of Aisle E") | The row is a trip check-in difference, not an aisle count. It becomes "Your check-in of Denis's trip · Hinges · Ruth accepted 2 of 3". Aisle counts already read "Accepted your Aisle K count". |
| NAV-08 | The aisle list has it (round 4). Please name the other long list. |
| NAV-09 | Still no details; a later round. |

## Risks

- **Names change on old records.** A count or return that stored "turyasingurakevin94" will now show the person's current name, found through their login id. A row with no login id keeps its stored name, unless that looks like a handle, in which case it shows "Someone".
- **With Ruth gets longer.** With every yard ask on it, a busy day lists more rows; they are grouped by kind as today.
- **The alert badge drops.** People may miss the routine "checked in" events they used to see as dots. They stay in the list under "In the yard today".

## Questions for Kevin (answered 23 Oct 2026)

1. **The unpaid line:** "Sales take the money before it leaves, or Ruth lets it go on credit." **Yes.**
2. **To pack:** ready orders only, with "+1 waiting" beside it. **As drawn.**
3. **Units:** all lower case ("1 ctn", "6 pcs", "2 box"). **Yes.**

## Phase B result (filled after implementing)

| ID | Done? | What changed (function names) | How verified |
|---|---|---|---|
| WORD-01 | | | |
| WORD-02 | | | |
| WORD-03 | | | |
| WORD-04 | | | |
| WORD-05 | | | |
| WORD-06 | | | |
| WORD-07 | | | |
| WORD-08 | | | |
| WORD-09 | | | |
| WORD-10 | | | |
