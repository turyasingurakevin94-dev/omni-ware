# Canvas parity — Sales

The proof Kevin asked for (`docs/spec/04-screens-sales.md` §1): every board of the approved canvas ("Sales — in the agent app's language", `docs/canvas/sales-agent/`) beside the new app at 360 × 800, the app reached by **real taps from Today** in the demo seeded with the canvas's `FACTS.md`.

| How | Where |
|---|---|
| How the app reaches each board (the taps, the demo flags) | `test/parity/<tab>.json`, written by each tab's builder (`test/parity/README.md`) |
| Board beside app, the diff, the % of pixels that differ | `NODE_PATH=$(npm root -g) node tools/parity/run.cjs <Board>.dc.html` (or `--tab <tab>`, `--all`) → `parity/<Board>.png`, `parity/<Board>.diff.png`, `parity/results.json` |
| The critic's verdict | `test/parity/verdicts/<tab>.json`, written by the tab's independent critic |
| This table | `node tools/parity/report.cjs` |

Reading the numbers: "Pixels that differ" counts pixels where any colour channel differs by more than 24 of 255. Anti-aliasing and a font rendered a hair apart leave a few percent on a matching board; a missing block or a wrong colour shows as a red area in the diff. The critic judges the pair by eye: the number only points at where to look.

<!-- parity:start (tools/parity/report.cjs writes this part) -->

**149 boards** · 4 with a spec · 4 measured · 0 passed by their critic. Regenerated 2026-10-29.

| Board | Tab | What it shows | Taps from Today | Pixels that differ | Critic | Screenshot |
|---|---|---|---|---|---|---|
| TD01Today | today | Today → sold this month, 4 live stages with Mukono's Take 1.1M, Needs you 7 by kind | 0 | 41.04% (region 0%) | — | [side by side](parity/TD01Today.png) · [diff](parity/TD01Today.diff.png) |
| TD02TodayBusy | today | Today, busy → Needs you 22 by kind, running on into Next move | — | no spec yet | — | — |
| TD03TodayNext | today | Next move → Kyaligonza 4 days late, Order usual in one tap; then Lubowa, Mukono, Kato's new price | — | no spec yet | — | — |
| TD04TodayTell | today | Tell them → old price struck, the message shown, Send to Kato, next tell queued | — | no spec yet | — | — |
| TD05ToCollect | today | To collect → 1,910,000: past 21 days (Take 585,000), under 21 days, being checked | — | no spec yet | — | — |
| TD06TodayFirst | today | A new salesperson's first day → ghost stages, Get going 1 of 3, Turn on alerts | — | no spec yet | — | — |
| TD07TodayCalm | today | All told (15:40) → #0552 delivered (9 done), Kyaligonza and Ggaba paid 585,000, Who's due 2 | — | no spec yet | — | — |
| TD08TodayGoalHit | today | Goal hit (Thu 29 Oct) → full bar with mint over-run, take payment oldest 23 days | — | no spec yet | — | — |
| TD09TodayOffline | today | No signal → Updating · saved 7:52, Not sent yet first, chats wait | — | no spec yet | — | — |
| TD10SignedElsewhere | today | Signed in as someone else → nothing saved as Musa, your work waits on this phone | — | no spec yet | — | — |
| TD11Find | today | Find, nothing typed → waiting chats, lately, past searches | — | no spec yet | — | — |
| TD12FindTyped | today | Find 'Kato' → best match with Sell / chat / call, orders, chats, their usual | — | no spec yet | — | — |
| TD13FindItem | today | Find 'hinge' → pair vs carton price, Sell at the counter, add to the open order | — | no spec yet | — | — |
| TD14FindNothing | today | Nothing found → Did you mean, closest items, Ask Moses, aisles | — | no spec yet | — | — |
| TD15Goal | today | Your goal → ring with pace mark, what it takes, who gets you there | — | no spec yet | — | — |
| TD16DaySold | today | Your day · Placed → 8 orders 2,440,500, sold today 96,000 (#0543), Grace's best customers | — | no spec yet | — | — |
| TD17DayMoney | today | Your day · Money in → split by how they paid, payments adding up, still to collect | — | no spec yet | — | — |
| TD18You | today | You → goal ring avatar, sold / orders / customers, what the sign-in opens, alerts, big text | — | no spec yet | — | — |
| TD19Asks | today | Asked of Sourcing → 5-stage funnel, ready to tell, each ask's dots (only Lubowa's opens a board) | — | no spec yet | — | — |
| TD20AsksEmpty | today | Asked of Sourcing, your first week → ghost ask's steps, one way in, searches that found nothing | — | no spec yet | — | — |
| TD21AskLooking | today | One ask, looking → rail, who Moses asked, tell them it's still coming | — | no spec yet | — | — |
| TD22AskListed | today | One ask, listed → 185,000 a tin, 24 on shelf, 6 tins prefilled, Tell Mukono | — | no spec yet | — | — |
| TD23AskNew | today | Ask Moses → what, how many, who asked prefilled, photo | — | no spec yet | — | — |
| TD24AskNotSent | today | Ask Moses, no signal → Not sent yet with Try again, Done · it sends itself | — | no spec yet | — | — |
| TD25DayTest | today | Your day with a test record → struck through, Test · not counted | — | no spec yet | — | — |
| CH01Chats | chats | Mine → the wait line (who waits, 0 to 1 h), the new number with Take, Grace's chats with wait rings, unread counts and Brian typing | — | no spec yet | — | — |
| CH02ChatsWaiting | chats | Waiting → Grace's customers oldest first with the WhatsApp reply disc, the new number with Take, Mukono answered in 7 m | — | no spec yet | — | — |
| CH03ChatsNew | chats | New number → Mama Shine's photo and question, Brian in the chat too, Take in one tap; who took a number today | — | no spec yet | — | — |
| CH04ChatsTeam | chats | Team → who is on, each person's load bar and waiting; the team's waiting list; anyone may reply | — | no spec yet | — | — |
| CH05NewChat | chats | New chat → customers who wrote today with their 23 h bar, Nansana shut, New customer | — | no spec yet | — | — |
| CH06ChatsEmpty | chats | No chats yet → a dashed ghost of the list, the first moves, Send the shop's number | — | no spec yet | — | — |
| CH07ChatsLoading | chats | Loading → the real layout as shimmer, Reading the chats | — | no spec yet | — | — |
| CH10Chat | chats | Kato's chat → Grace's chip, #0552 · Packing, Brian typing, 9:02 ask to 9:14 placed, a suggested reply | — | no spec yet | — | — |
| CH11ChatNote | chats | Team note → the note button turns the box amber; @ names a teammate, who gets a push | — | no spec yet | — | — |
| CH12ChatNotSent | chats | No signal → Mukono's head with #0551 · Checking, her ask and photo, the sent answer, two bubbles Not sent yet with Try again and Change | — | no spec yet | — | — |
| CH13ChatShut | chats | Window shut → Nansana's Thursday thread; the draft goes as the shop's message, photos wait | — | no spec yet | — | — |
| CH14ChatNewNumber | chats | A new number → Take in the strip, Save as a customer, her photo read as a line, Start order | — | no spec yet | — | — |
| CH15ChatPaid | chats | Faith's customer → your reply names you and Faith is told; 'says they paid' 165,000 with the to-collect / being-checked split and Take payment | — | no spec yet | — | — |
| CH20ChatAdd | chats | The + → a suggested reply, prices of Kato's usual (cement, iron sheet, wire nails), quick replies, other prices · catalogue · photo | — | no spec yet | — | — |
| CH21ChatPrice | chats | Send a price → Kato's usual first, what goes with it; a Price coming item asked of Ruth (toast); Send 2 prices | — | no spec yet | — | — |
| CH30HandOver | chats | Give Kato to… → teammates with their load, a note filled in from Kato's order, Give to Brian | — | no spec yet | — | — |
| CH31ChatHanded | chats | Given → Undo at the top; the thread records the give and the note | — | no spec yet | — | — |
| CH32ManagerMove | chats | Ruth moves any chat → Ggaba from Faith (away) to Brian; both get a push | — | no spec yet | — | — |
| CH33ChatCustomer | chats | Kato, from the chat → Grace's since Mon 12 Oct, who served him as bars, the four latest acts; Call · Take payment 420,000 · Give | — | no spec yet | — | — |
| SL01Who | sell | Who is it for? → counter door, 2 still open, a new number asking, who's due 3 | — | no spec yet | — | — |
| SL02WhoTypo | sell | A typo → the customer they meant, New order for Kato | — | no spec yet | — | — |
| SL03OrderStart | sell | Order just started → Kato's usual 0/3, Add all 3, Sell again #0553 | — | no spec yet | — | — |
| SL04FromChat | sell | Lubowa's draft → 60 sheets already in, Slide to place · 1 item | — | no spec yet | — | — |
| SL05Order | sell | The order → lines, Often with, aisle chips, dock | — | no spec yet | — | — |
| SL06Line | sell | A line opened → count, price; last 38,000 · shop 38,000 | — | no spec yet | — | — |
| SL07OrderFoot | sell | Order's foot → pays (credit is Ruth's), picture, charge; delivery once, in the dock | — | no spec yet | — | — |
| SL08Find | sell | "40 sheets" → read as ×40, Add with the count | — | no spec yet | — | — |
| SL09FindNone | sell | Nothing called “tile cuter” → closest in the shop, ask Moses to stock it | — | no spec yet | — | — |
| SL10Voice | sell | Say it → two items read, Add both | — | no spec yet | — | — |
| SL11Aisles | sell | Browse the shop → aisles, Kato's aisles marked | — | no spec yet | — | — |
| SL12Aisle | sell | An aisle open → cards with shelf words, Done | — | no spec yet | — | — |
| SL13Short | sell | 8 short on G26 → Make it 12 / Order in 8 (slide stays on the order) | — | no spec yet | — | — |
| SL14CountZero | sell | A count under 1 → use the bin | — | no spec yet | — | — |
| SL15Whole | sell | Carton only → 1 carton 96,000 beside 20 × 1 kg 180,000 (dock 2,286,000) | — | no spec yet | — | — |
| SL16Charge | sell | Add a charge → loading at the shop's rate, one tap | — | no spec yet | — | — |
| SL17Delivery | sell | The shop delivers → saved site, site phone, map, when, fee | — | no spec yet | — | — |
| SL18Price | sell | Price keypad → under the shop's price (shop = Kato's last), Ruth says yes | — | no spec yet | — | — |
| SL19PriceHigh | sell | A zero too many → Make it 38,200 | — | no spec yet | — | — |
| SL20PriceCost | sell | Under cost → refused, keep the shop's price | — | no spec yet | — | — |
| SL21PriceComing | sell | No selling price → Moses, Ruth, Kato; Priced so far | — | no spec yet | — | — |
| SL22LineWaiting | sell | A line waiting → Ruth decides; dock: 1 price coming · 1 for Ruth | — | no spec yet | — | — |
| SL23CreditNoLimit | sell | Nansana on credit, no limit set → Credit charge +65,700, Ruth decides | — | no spec yet | — | — |
| SL24CreditOver | sell | Kato on credit over the 2M limit → 675,700 over, Ruth decides | — | no spec yet | — | — |
| SL25CreditOld | sell | Kyaligonza's draft on credit → bill #0533 is 54 days, Ruth decides | — | no spec yet | — | — |
| SL26Switch | sell | Change the customer → Keep for later or Change · 3 items | — | no spec yet | — | — |
| SL27Offline | sell | No signal → notice with Try again, Back online to sell | — | no spec yet | — | — |
| SL28Placed | sell | Placed #0560 (or SL29) → Not paid yet, Checking → Buying → Packing | — | no spec yet | — | — |
| SL29PlacedShelf | sell | Placed #0561 (or SL28) → from the shelf, Packing, Not paid yet | — | no spec yet | — | — |
| SL30Mukono | sell | Mukono's new order → roof paint is in; #0551 Not paid yet, Take 1.1M | — | no spec yet | — | — |
| SL31WalkIn | sell | Walk-in order → You sell most, the aisles | — | no spec yet | — | — |
| KC01Counter | counter | Counter → the shelf's best sellers, one tap adds one | — | no spec yet | — | — |
| KC02Find | counter | Find '2 paint' → read as ×2, Add · 370,000; none on the shelf → Order in | — | no spec yet | — | — |
| KC03Picked | counter | Picked → Exact is already chosen, slide to sell | — | no spec yet | — | — |
| KC04Who | counter | Who is it for? → Walk-in chosen, or one of the 3 due (FACTS) | — | no spec yet | — | — |
| KC05Change | counter | They gave 60,000 → Give change 8,000, drawn as the notes | — | no spec yet | — | — |
| KC06Count | counter | Other amount → tap each note they hand over, − to take one back, or type it | — | no spec yet | — | — |
| KC07Short | counter | Short · 2,000 → the missing note in dashes; Count again | — | no spec yet | — | — |
| KC08Momo | counter | Mobile → Paste the ID from their SMS; the slide waits for it | — | no spec yet | — | — |
| KC09MomoReady | counter | ID in → slide to sell | — | no spec yet | — | — |
| KC10Below | counter | Their price 170,000 → the ladder; navy Ask Ruth or the shop price 218,500 | — | no spec yet | — | — |
| KC11Wait | counter | Waiting for Ruth → pushed to her; serve the next walk-in meanwhile | — | no spec yet | — | — |
| KC12RuthYes | counter | Ruth said yes → 185,000 struck to 170,000; slide to sell 203,500 | — | no spec yet | — | — |
| KC13Selling | counter | Sending… → the slide holds, nothing can double-sell | — | no spec yet | — | — |
| KC14Sold | counter | Sold → the change to give, big, as notes; Sell again | — | no spec yet | — | — |
| KC15SoldMomo | counter | Sold by mobile money → paid in full, the ID kept | — | no spec yet | — | — |
| KC16Receipt | counter | Receipt → send on WhatsApp, share, save | — | no spec yet | — | — |
| KC17Offline | counter | No signal → lines kept, Back online to sell | — | no spec yet | — | — |
| KC18NotOnShelf | counter | 1 short → SL13's pattern: Make it 2 or Order in 1 | — | no spec yet | — | — |
| KC19Failed | counter | Not sold → nothing taken, slide again | — | no spec yet | — | — |
| OR01Orders | orders | Orders by stage → act from the row (Take 1.1M, Tell), who holds each | 1 | 29.93% (region 0%) | — | [side by side](parity/OR01Orders.png) · [diff](parity/OR01Orders.diff.png) |
| OR02Delivered | orders | Delivered this week → paid, return asked at a glance | — | no spec yet | — | — |
| OR03Find | orders | Find Kato → what's in each order, owes 420,000, Take from search | — | no spec yet | — | — |
| OR04Empty | orders | Nothing on the move → ghost stages, first steps, New order | — | no spec yet | — | — |
| OR05Checking | orders | #0552 Checking (9:30) → Ruth kept 38,000, tell Kato the new price | — | no spec yet | — | — |
| OR06Buying | orders | #0552 Buying (9:50) → on the shelf / on the way / not found | — | no spec yet | — | — |
| OR07Packing | orders | #0552 Packing (now) → packed lines, not paid yet, Take payment | — | no spec yet | — | — |
| OR08Road | orders | #0552 On the road (13:30) → map strip, Call Ssali | — | no spec yet | — | — |
| OR09Delivered | orders | #0552 Delivered (14:05) → photo at the door, Sell again | — | no spec yet | — | — |
| OR10Tell | orders | Tell Kato → the message as they read it, picture, WhatsApp or SMS | — | no spec yet | — | — |
| OR11TellShut | orders | Tell Nansana, chat shut 2 days → WhatsApp opens with it typed | — | no spec yet | — | — |
| OR12PriceUp | orders | #0559 the cost went up → ladder, what Ruth's answer leads to | — | no spec yet | — | — |
| OR13PriceTell | orders | #0559 Ruth set 35,000 → send the new price, or mark told | — | no spec yet | — | — |
| OR15PaidOver | orders | Nansana paid over 90,000 → pick Give change or Deposit, send to Esther | — | no spec yet | — | — |
| OR16PaidOverAsked | orders | Nansana · sent to Esther → where it is, Undo, tell by SMS | — | no spec yet | — | — |
| OR17Change | orders | Change #0552 → what is still possible by stage | — | no spec yet | — | — |
| OR18Cancel | orders | Cancel #0552? → reason, ask Ruth | — | no spec yet | — | — |
| OR19Twice | orders | #0556 / #0557 entered twice → ask Ruth to cancel the copy | — | no spec yet | — | — |
| OR20Wrong | orders | #0548 Something wrong → return, payment fix or a note; delivered, so no void | — | no spec yet | — | — |
| OR21Return | orders | #0548 items coming back → 2 bags, damaged, 67,000 of 119,000 | — | no spec yet | — | — |
| OR22ReturnAsked | orders | #0548 return asked → credit asked 67,000, Ruth decides, take it back | — | no spec yet | — | — |
| OR23TwiceVoid | orders | #0536 / #0537 invoiced twice → ask Ruth to void the copy | — | no spec yet | — | — |
| OR24PayWhich | orders | #0533 which payment? → the Cash row opens its fix | — | no spec yet | — | — |
| OR25PayWrong | orders | #0533 recorded vs should be, ID, owes 420,000 → 438,000 | — | no spec yet | — | — |
| OR26Else | orders | #0548 something else → tap a reason, a few words to Ruth | — | no spec yet | — | — |
| CU01Customers | customers | Owe → 585k to take past 21 days, 1.2M under; rhythm rings; Take from the row | — | no spec yet | — | — |
| CU02CustomersMore | customers | Owe, scrolled to the end → being checked 474k, promised 475k, all 4 shown | — | no spec yet | — | — |
| CU03CustomersDue | customers | Due → week strip, reach out today (KS, LB, MR), WhatsApp from the row | — | no spec yet | — | — |
| CU04CustomersAll | customers | All → gone quiet 8, everyone from G with a tappable letter rail | — | no spec yet | — | — |
| CU05CustomersSearch | customers | A typo → did you mean, or add them as new | — | no spec yet | — | — |
| CU06CustomersNobodyOwes | customers | Nobody owes → ghost, tick, who's due | — | no spec yet | — | — |
| CU07CustomersOffline | customers | No signal → the same list, saved 7:52 | — | no spec yet | — | — |
| CU08CustomersLoading | customers | First open → skeleton of the list | — | no spec yet | — | — |
| CU10Customer | customers | Kato → bills on the age track, credit 2M, day blocks, Order usual | — | no spec yet | — | — |
| CU11CustomerChecked | customers | Ggaba → to collect vs being checked, bills, day blocks | — | no spec yet | — | — |
| CU12BillChecked | customers | A bill being checked → paid already, or still owed? Send to Esther | — | no spec yet | — | — |
| CU13AddsUp | customers | Lubowa → balance 0 vs open bills 349,000, Esther is checking | — | no spec yet | — | — |
| CU15Promise | customers | Promise to pay → amount, day strip with the hold day, Ruth sees it | — | no spec yet | — | — |
| CU20NewCustomer | customers | Mama Shine → from her chat, digit meter, kind (Ruth changes it later) | — | no spec yet | — | — |
| CU21SameName | customers | Name already saved → use Kato, or add as new | — | no spec yet | — | — |
| CU22PhoneShort | customers | Phone too short → 6 of 9 digits, both buttons wait | — | no spec yet | — | — |
| CU23PhoneUsed | customers | Number already Kato's → change the number | — | no spec yet | — | — |
| CU30Pay | customers | All of it by Mobile → bills fill, owes 420,000 → 0, slide | — | no spec yet | — | — |
| CU31PayPart | customers | Part, by Bank → #0544 fills to 50,000 of 120,000 | — | no spec yet | — | — |
| CU32PayPick | customers | One bill picked → the #0544 chip and the tick agree | — | no spec yet | — | — |
| CU33PayNoId | customers | Mobile, no ID → the slide waits | — | no spec yet | — | — |
| CU34PayWalkin | customers | Walk-in #0555 pays 30,000 → Kato's worker; 6,180 on Kato (+180 credit charge), Nansana: Ruth decides | — | no spec yet | — | — |
| CU35PayOver | customers | They gave 500,000 → pays 420,000, 80,000 change | — | no spec yet | — | — |
| CU36PayDeposit | customers | They gave 500,000 → Kato keeps 80,000 as a deposit | — | no spec yet | — | — |
| CU40Paid | customers | Paid → receipt slip, owes now 0, receipt sent 10:41 | — | no spec yet | — | — |
| CU41PaidChange | customers | Paid with change → give 80,000 back now | — | no spec yet | — | — |
| CU42PaidDeposit | customers | Paid with a deposit → deposit 80,000 on the slip | — | no spec yet | — | — |
| CU43ReceiptNotSent | customers | Paid; WhatsApp can't reach Kato → Send by SMS or Try again | — | no spec yet | — | — |
| Main | parts | The language · shared parts | 0 | 0.02% | — | [side by side](parity/Main.png) · [diff](parity/Main.diff.png) |
| Main2 | parts | The language · Sales-only parts in the same voice | 0 | 0% | — | [side by side](parity/Main2.png) · [diff](parity/Main2.diff.png) |

<!-- parity:end -->
