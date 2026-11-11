# The Store app today (before the redesign)

This is a record of `store.html` as it stands after audit round 10 (commit `1bb6698d`, the last commit to touch `store.html`; migrations up to 0181 are live). It is here so a redesign can drop what it no longer needs and keep everything else. Nothing in it is a proposal.

Sources: `store.html` (6,296 lines), `docs/audit/store/LOG.md`, `ROUND-1.md` to `ROUND-10.md`, `docs/decision-rights.md`, `docs/audit/GLOSSARY.md`, the migrations under `supabase/migrations/` and the edge functions `notify-worker` and `notify-stock-count`. Every screen below was drawn in the real app at 360 × 780 in the scratchpad harness (see "How this was checked" at the end). The sample shop is the harness's: Musa Kato (store), Ruth Nakato (manager), Denis Okello (buyer), Joy (a second store login), Okello and Wasswa (drivers).

---

## 0. The app in one paragraph

The app has two tabs, **Today** and **Stock**, with a red **play button** between them. The play button starts the next job, and its badge counts the jobs. Everything else is a page pushed on top of a tab (`PAGE.<name>`, 33 of them) or a bottom sheet (`SHEET.<name>`, 12). One stack is shared by phone Back, browser Back, Escape and on-screen Back (sheet, then page, then tab, then "Leave Omni-ware?"). Data comes from one call, `store_snapshot`, with `store_live` every 45 s. The phone never holds money. Writes go through `store_*` functions or the yard's own tables (`stock_counts`, `stock_reports`, `store_asks`). Most writes wait 10 s with Undo before they go (`heldWrite`). Reports and returns go to an outbox when there is no signal, and picks, check-ins and counts are kept as drafts on the phone.

---

## 1. Page inventory

Legend for states: **E** empty, **X** error, **O** offline, **S** sending, **✓** success. "—" means the page has no such state of its own.

### 1.1 Shell, sign-in and tabs

| Page | Purpose | What it shows | Entry points | Actions | States |
|---|---|---|---|---|---|
| Sign in (`authScreen`) | Log in | "Omni-Ware Store · The shop floor, in your hand", email, password, Sign in, Forgot password? | Cold start with no session | Sign in, reset | X: "Enter your email and password" |
| Checking your shop… | Wait while the phone asks which shop | Logo, spinner | After sign-in, unless a kept copy is on screen (R8 STO-REL-11) | — | S |
| Could not reach the shop | The membership read failed 3 times | "Your shop is fine. This phone could not ask it just now", "Tried 3 times · code", Try again, Sign out | Boot | Try again, Sign out | X; O shows the kept copy instead |
| This login has no shop | A real empty membership answer | Sign out | Boot | Sign out | X (only after a real empty answer) |
| Shop picker | Choose a shop when the login has more than one | Shop list | Boot; You → Switch shop (`switchshop`) | pick | — |
| Bottom bar | Tabs and the play button | Today · ▶ (badge = job count) · Stock | Always, under tab views | `tab`, `nextjob` | Load failed: play button grey, tiles dashed |
| **Today** tab (`viewToday`) | What the yard does next | Greeting with first name; date · shop; status pill (Live / Updating… / Updating · saved H:MM / Offline / Not sent · N / Offline · N waiting); bell with unread count; avatar ("?" until named). **Ring** "3/9 gone out" (delivered, on the road, packed, to pack). **Four tiles**: In, to pack (+N waiting), to load, on the road. Legend. "Update ready · Reload" card. "Waiting to send" card. Name card (asks once). "X passed you the yard · I've got it" card. **Next job** card (kind tag, title, 3 stats, one white button). **Bays** (4 tiles: free / order ready / Not paid yet). **Then** list (one row per job kind) and "N more · …" with faces and icons | App open; Back from any page; Done on most done screens | `alerts`, `me`, `tin`, `tpack`, `tload`, `troad`, `job`, `bay`, `todaymore`, `sendnow`, `rmwait`, `hogot`, `swreload`, `loadretry`, `close` (only when the yard is clear) | E: "The yard is clear" (green tick, "You'll get a buzz when a trip is back…") plus the "Close the yard" card from 17:30. X: "Could not load the yard" card, Try again, code; with a kept copy, a red bar over the faded day. O: "No signal · keep working" card. S: "Sending now…" on Waiting to send. ✓: — |
| **Stock** tab (`viewShelf`) | The shelf | "Stock · N aisles · counted every 14 days", scan button, Find box, **aisle tiles** A–D (name, badge for items that need a look), **Count / Report a loss / Returns** tiles, "Needs a look" list (out, low, count due, short, reported), "Came in today" (quantities, time · who) | Tab | `stscan`, `find`, `aisle`, `count` (the aisle counted longest ago), `report`, `goret`, `stock` | E: "No products on the books yet · they appear here, an aisle per category". X: "Not loaded yet", grey aisle letters, "Could not load the yard" card. O: as Today |

### 1.2 Pages pushed from Today

| Page | Purpose | What it shows | Entry points | Actions | States |
|---|---|---|---|---|---|
| `alerts` · Alerts | What happened to you | Top card (newest for-you alert); "With Ruth · N waiting · N answered"; **For you · N** (unread dots, kept for the visit); **In the yard today**; older days "· read". Sticky bar "N new for you" (R10 NAV-08) | Bell | `ruth`, `me` (settings icon), tap an alert | E: "Older alerts clear themselves after a week". Opening it marks for-you alerts read (R6 WORD-10) |
| `ruth` · With Ruth | Everything waiting on the Manager | Manager card with phone; 3 stats (waiting on Ruth, answered today, are yours); **Waiting on Ruth** (counts, returns, reports, extras, let-it-go asks, short picks, trip differences, each with who sent it and a face); **Answered today**. Sticky bar | Alerts → With Ruth; a push (`store.ask.decided`) | `decide`, `ruthslip`, `ruthtrip`, `receive`, call | E: "No answers yet today" |
| `me` · You | Who you are, settings, end of shift | Avatar, name with edit pencil, role ("Store lead"), shop; "Your Wednesday so far" (trips checked in, orders packed, loads out); In the yard now (Manager, call); "How the app reaches you": **Push alerts**, **Sound on a new job**, **Buzz on every tick**, **Big text** toggles; "End my shift · pass the yard to Joy"; Switch shop; Sign out | Avatar | `myname`, `pref`, `handover`, `switchshop`, `signout` | Push alerts: toasts if not the installed app, no staff row, or permission off |
| `movein` · In | Goods coming into the yard | Compact header with the stage dots (Buying · Coming · At the gate). **Next at the gate** card: wait ring (minutes), trip name, lines, back time, ticked suppliers, "Waiting on it · N orders", red **Check it in**. **Coming in** list with Buying · 0 of 1 / Coming / Not started pills and a stop track. "Checked in today" day line. Sticky bar "N at the gate · N coming in" | In tile (more than one trip back; with one, the tile opens `receive` directly) | `receive` | E: calm "Nothing at the gate" card (R10) |
| `movepack` · To pack | Every order to pack | Compact header "2 To pack · oldest waiting 5 h" with a bar (yours / ready / waiting on goods). **Yours · carry on** (navy row with ring "2/2", Go on). **Ready · oldest first** (aisle letters, lines, destination, age pill). **Packing now** (someone else's). **Waiting on goods** (striped rows: "Ridge caps at the gate · check it in first") | to pack tile (when there is more than one choice) | `pack`, `receive`, `open` | E: "Nothing to pack · Every order in Packing is done" |
| `onroad` · On the road | Orders out with drivers | Compact header with pills "1 out now · 2 delivered · 2 collected". One card per driver: face (a hired driver gets a dashed amber square), "Left 8:05 · 1 to go", segmented bar "0 of 1 stop done", one row per stop with **Delivered** (camera icon). "Done today" list | on the road tile (when not all drops are yours; else `drive`) | `deliver`, call | E: "Nobody on the road · Everything loaded today is delivered" |
| `receive` · Check in the truck | Count a trip's goods into the yard, blind | Header ring "0/4", trip name, supplier and back time, scan button. Per supplier: line rows (circle, picture, name, "For #2398 Mukono" or "10 bag for #2401 · 10 bag to the shelf", count pill). An open line shows "Off the truck" − [n unit] +, a unit switch (ctn / doz) when the line comes in packs, then once counted "Okello bought N" and a bar. A count unlike the Buyer's asks why: Never came / Torn or broken / Wrong brand / I miscounted (fewer) or bought extra / Sent by mistake / I miscounted (more). "Something not on the list? · Extra goods on the truck". Dark dock: "N of 4 checked · 1 differs · Ruth will see it", slide | Next job "Check it in"; In tile; In page; a `trip.back` push; done-pack "check it in first" rows | `rctog`, `rcedit`, `rcstep`, `rclv`, `rcwhy`, `rcextra`, `rcexdel`, `rcscan`, slide `checkin`, `rcundo` | Draft kept on the phone (`RC_KEY`); Today says "Carry on … · n of m counted". Slide disabled: "Tick every line first" / "Say why the count is less". S: done screen with Undo (10 s). ✓: "On the shelf · 4 lines in at 8:38 · 3 orders can be packed": each order with a "Packing · Sales told" pill, each difference "Ruth sees it", **Pack #… now**, Back to Today |
| `orderview` · Look only | An order the yard can't act on | Order number and client, a stage chip (Buying, Quote, Packing now by X), "Packing opens when the goods come in", **What is coming** (line, supplier, qty), "Look only · the yard has nothing to do yet" | `openPack` on a quote, an order waiting on goods, or someone else's; Find rows; a bay | Back only | — |
| `pack` · Pack | Pick and pack one order, a card per line | Header: back, client avatar, name, "Yours" lock chip, **Release**, "2/6". Number dots 1–6 (green done, amber short). A card per line, swiped sideways: aisle pill, "1 of 6", picture, name, "Off our shelf" / "bought in for this order" / "from today's trip", big qty and unit, stamp **PACKED** or **N SHORT**. Counter − [n] + "of 40 pc". Hint: "Swipe to look back or ahead", "Count due · count as you pick" (amber pill), "The shelf shows N · count what you pick", "N short · Ruth settles the rest", "Not in yet · coming from …". Scan button and main button: red **Packed · 40 pc**, amber **Pack short · 12 of 20 pc**, grey disabled **Waits for the goods**. "Not packed after all · untick it" | Next job "Start packing"; to pack tile; To pack list; done-pack "Next order"; check-in done "Pack #… now"; a `notify-worker` push for an order that is already yours | `pkok`, `pkstep`, `pkto`, swipe, `pkuntick`, `pkrelease`, `pkscan`, `pkclose`, `pkbay`, `unpack`, `pkundofin` | Called off: "Put back" list (`pkCancel`, `pkback`, `pkbackdone`). Not done bar "Your ticks are kept" with Try again (R3 REL-07). S: "Packing #2401…" spinner, Undo 10 s, packed grid faded. ✓: "#2401 is packed · Kato Construction · leave it on bay N" (or "every bay is full · leave it by the gate"), Unpack chip, grid of lines (✓ or −), the short line "Ruth decides: bill what went, or wait for the rest", **Leave it on** bay picker, **Next order**, "Load X's run now" |
| `load` · Load a run | Load one direction's packed drops onto one truck | Header: "Okello's run · Kansanga, then Ggaba", driver face with **Change**. Stats: drops, lines on (n/m), lines short. "Load in this order · the last drop goes in first": numbered stops (1st, 2nd…), each a card with client, #, drop number, **bay** chip and "0/2"; the open card lists lines with a tick box. Locked rows: "Not paid yet · stays on bay N", "X is packing it · goes on the next run". **Other runs**. Dock slide | to load tile; Next job "Load it"; a bay tile; done-pack "Load X's run now"; `credit.ask.decided` push | `lropen`, `lrtick`, `lrrun`, `lrdriver`, `lrscan`, slide `lrsend`, `lrundo`, `lrdone`, `drive`, `wasent` | E: "Nothing to load · Packed orders for delivery show here", or lists "Packed · not paid yet" and "Packed · they collect". Slide: "Tick both slips with Okello" until ready, then "Slide to send Okello · 2 drops" / "Slide · it's on my truck". S: "Handing over…" with Undo. ✓: "Okello is on the way · Ggaba · 3 lines checked · 8:39", numbered drops "Sales are told it's on its way", WhatsApp button for a hired driver, **Start the drive** if it is you, else Done |
| `collect` (router) | Pick the gate screen | — | Today "X collects #…"; push | → `agent` for an agent pickup, else `slip` | Gone: "That order is gone" |
| `slip` · Hand over / Load one order | One order out of the gate: who takes it, every line read out, the slide | Header "Hand over #2552 · Walk-in · collects at the gate", scan. **Who takes it**: one scrolling row (two drivers, Me, Client/Agent, Hired). A paper slip: shop name, date, "Order #2552 · to Walk-in", "WHAT WALK-IN GETS · 0 of 1 ticked", a tick per line, "Read each line out with the client". Dock: "Name of the person collecting" box, slide, **Unpack #…** | Today gate row/card; bay tile (pickup); Load "Packed · they collect" rows; With Ruth | `slwho`, `sltick`, `slscan`, `unpack`, slide `slgo`, `mnask`, `mnback`, `mnwait` | Money hold: amber "NOT PAID YET" stamp, ticks disabled, dock gives the one reason and **Ask Ruth to let it go** (red), then "Asked · waiting on Ruth" with Take back; with no customer record, only Back. Name and ticks kept on the phone (R3 REL-02). Not done bar (amber no signal, red failed, blue "Someone else just did this · Refreshed · …"). S: "Handing over…" with Undo. ✓: "Handed over to Peter · #2552 · Walk-in · at the gate 8:40"; for a driver, a 3-step track (Checked, driver, on the road) and WhatsApp for a hired one; "Next pickup" |
| `loadhired` · Who's driving? | Pick or add the driver | Sheet-style page: "They get the drops on Ggaba on WhatsApp"; **Our drivers** (chips; "I'll drive"); past hired drivers as cards (plate, "N loads with us"); a new driver form (Name, Plate, Phone) | Load → Change; slip → Hired | `drvpick`, `nwuse`, close | Disabled "Add their name first"; amber line when the phone is not a Ugandan number |
| `drive` · The drive | Get to the drop | A map (yard, pin, your dot, route line), "Your drop · 1 of 1", bottom card: client, #, place, **Call them**, **I'm coming** (WhatsApp, turns green), **Directions** (Google Maps), "Nothing to collect at the door", lines, **I'm at Mukono**, "Can't deliver? Bring it back" | on the road tile (when all drops are yours); "Start the drive" | `drtell`, `door`, `drback` | "Can't deliver?" only shows a toast ("Bring it back to the yard · check it in at the gate"): `PAGE.goodsback` does not exist |
| `door` · At the door | Change a number only if some stays on the truck | "At Mukono Roofing · #2390 · arrived 8:35", "Change a number only if some stays on", a slip ("all 1 coming off", "all 10 handed over" with N pc off), **All handed over · take the photo** | drive → I'm at | `dropen`, `drstep`, typing, `proof` | What stays on becomes a door return (a Today job afterwards) |
| `deliver` · Deliver | Proof of delivery | "Deliver #2390 · Mukono Roofing · last step"; **Signed note / At the door** switch; camera frame with shutter, Retake; "Can't take a photo?"; **Who took it** (prefilled with the customer); slide | Next job "At the door"; On the road "Delivered"; door; a `job.given` push | `dvkind`, `dvshoot`, `dvretake`, `dvnophoto`, `dvphotoyes`, typing, slide `dvgo`, `dvclose` | No camera: "The camera did not open · tap the shutter for the phone's camera" (file picker). Slide: "Take the photo first" / "Add who took it" / "Slide to mark delivered". Not done bar "The photo and the name are kept". S: "Delivering…" with Undo. ✓ (`delivered`): "Delivered · #2388 · to Bwaise Traders · 6:35", what went, **The invoice goes out by itself · Thu 12 Nov 6:35 · Ruth can invoice it sooner**, Next drop, Done |
| `delivered` | The old proof screen, kept as a name | The Delivered done screen | Old links | `dvhome` | ✓ |
| `agent` · Collect at the gate (agent) | An agent's code, then the slip | "Their code, from their app", 4 boxes, keypad 1–9 / 0 / delete, "Waiting for 2552", scan, faces of agents expected; then a slip with ticks and a slide | Today "X collects #… · Code"; collect router | `agkey`, `agdel`, `agscan`, `agtick`, slide `aggo`, `agnext`, `agdone` | Wrong code: boxes shake red and clear after 1.2 s. Not paid: "#… · not paid yet · Ruth decides". S/✓ like the slip |
| `ride` · The ride | A Store person rides a buying trip and counts goods onto the truck | "Denis's morning round · You're riding · Denis drives" and both faces; stop chips; "Collect at Kiseka Steel · Count it as it goes on the truck"; line rows (wanted qty, for #…, − n +, tick); "Denis pays at Kiseka · no money on this phone"; button "Tick 2 more first" → "Done · back to the yard"; then "Back at the yard · Everything on the truck · 2 lines", per-stop summary, "Denis paid · Accounts checks the receipts", slide | Next job "Start the trip"; a `trip.sent` push | `rdstop`, `rdstep`, `rdtick`, `rdnext`, slide `ride` | ✓: "Round handed in · 1 stop · 2 lines", track Handed in → Accounts checks the receipt → Check-in "Musa counts it" |
| `handover` · Pass the yard | Pass the shift to a colleague | You → "MK → ( )", colleagues with the app, what moves with you ("Half done · moves to Joy"), **Pass the yard to Joy** | You → End my shift | `hoto`, `hosend`, `hodone`, `goride` | E: "Nobody else is on the yard with the app today · A colleague needs a store login to take the yard". ✓: "Waiting on Joy". Receiver: Today card "Musa passed you the yard · I've got it" (`hogot`) |
| `close` · Close the yard | End of day, goods only | Ring "4/4", "Wednesday's yard · Filled in from the day · goods only", stats (orders out, trip in, returns); checklist: "4 bays hold an order for tomorrow" (chips), "1 thing waits on Ruth · It carries to the next day", returns to shelve (**It's on the shelf**), "Nothing half done", "The next first job is set"; slide "Slide to close the yard" | Today "Close the yard" card (only when the yard is clear, from 17:30) | `clshelf`, slide `clgo`, `cldone` | ✓: "The yard is closed" (a `store_asks` row, kind `close`, logged to the Manager) |
| `decide` · With Ruth (one ask) | Where a count stands | Header "With Ruth · Aisle A · Roofing · 3 items · sent 8:16" and a track Counted → Ruth → The shelf; **What you counted** (blind: never the books' figure); "The books stay off this phone · Ruth compares them" | With Ruth rows; done-count; `stock_count` push; ctwait "See Joy's count" | `count` (recount), `dvhome`; **Accept / Ask for a recount** only for owner, admin and manager logins (`canCorrect`) | Replaced: "It moved on". Recount asked: red "Count it again" |

### 1.3 Pages pushed from Stock

| Page | Purpose | What it shows | Entry points | Actions | States |
|---|---|---|---|---|---|
| `find` · Find | Search items and orders | Search box "Name, aisle, or an order number", scan; **Try** chips (common items, an order) with no query; with a query, filter chips (All, items, orders, counts on the chip = rows), results 30 at a time, "Show 30 more" | Stock Find box; aisle search; `fdgo` | `fdq` typing (120 ms), `fdf`, `fdtry`, `fdclear`, `fdmore`, `stock`, order rows (`orderview` / `pack` / `slip` / `troad`) | E: "Did you mean hinge" (nearest shop words), else the Try chips |
| `aisle` · Aisle | One aisle's items | Letter, name, "4 items · Joy counted it at 8:15", pills (N none free, With Ruth), **Labels**, header **Count**; "On the shelf" with free/held key: picture, name, size tags, "74 on the shelf · 40 held", a ring, "34 pc free". Sticky navy bar with Back and "70 items · 57–68" and a ↑ button on long aisles (R4 NAV-08) | Aisle tiles; item page Aisle pill; Pack card aisle pill | `stock`, `count`, `labels`, `find`, `totop` | "No aisle yet · Sourcing gives it one" toast for uncategorised |
| `stock` · Item | One item's shelf | Aisle pill, picture, name, "Sold by the piece · 20 pieces to a bundle"; variant tabs (2.5m / 3m / 3.5m); ring "74 pc on the shelf" with **free to sell** and **held for orders**; **Held for · N orders** (#, client, to pack/packing/packed/on bay N, qty); **Left the shelf · not invoiced yet**; stock history (4 weeks, "Out · Order #0036 · Kato"); "Counted N days ago" / "Never counted · a check-in adds stock, it is not a count"; **We need more · ask Denis** (when low or due); **Count it now** (red, only when due); "Report damaged, lost or stolen" | Stock rows; Find; aisle; scan; a `stock.report.decided` or restock-answer push | `stocktab`, `aisle`, `shorder`, `restock`, `count`, `report` | Count due: no figures at all, a dashed eye ring, "Not counted for N days · the figures stay hidden until you count" |
| `labels` · Shelf labels | Print barcode labels | Letter and name, "4 of 4 have no label yet", **Only the missing · 4 / The whole aisle · 4**, a label sheet preview (new tags), "Stick each one on the shelf edge, under its item", **Print 4 labels · office printer**, "Save as a PDF instead" | Aisle → Labels; scan "print labels" | `lbonly`, `lball`, `lbprint` | — |
| `count` · Blind count | Count an item or an aisle without seeing the books | **One item** (`ctOne`): "Blind count", picture, name, "Aisle A · count what you can see", a box per unit level (BAGS; CTN and DOZ) with − + and typing, "You counted nothing yet", Send. **Aisle** (`ctAisle`): "D · Tools · 0/3 counted · the books stay hidden", "This round" aisle dots, rows with a box per level and **Can't find**, dock "N of 3 counted · Ruth accepts it, then the shelf changes", **Send the count to Ruth** / "Count every item first" / a partial slide | Stock Count tile (the aisle counted longest ago); aisle header Count; item "Count it now"; scan → Count; decide "Count it again" | `ctv` typing, `ctstep`, `ctmiss`, `ctfound`, `ctsend`, slide `ctpart`, `ctlater` | Draft kept on the phone (`CT_KEY`). A second count of the same place opens the **ctwait** sheet first |
| `countresults` | The count after Send | S: "Sending… · Aisle D · Tools · 3 items", track Sending → Ruth checks it → Shelf takes your count, Undo. ✓: "Count sent". Replaced: old → new strip. X: "It didn't reach Ruth · The signal dropped as it was sending, 9:12", Try again (and it goes by itself on `online`) | After `ctsend` | `ctretry`, `ctdone` | S, X, ✓ |
| `report` · Report a loss | Damaged, lost or stolen stock, for the Manager | No item yet: search "Which item?" and a list with shelf pills (green qty; "Count it now" when empty; no figure when due). Item: card with **Change**; **What happened** Damaged / Lost / Stolen; **How many** − n + with unit switch and cap ("The shelf has … · that is the most"); "What Ruth should know" note; **Add a photo · Optional**; **Send to Ruth** | Stock tile; item page link; Today "looks" | `rppick`, `rpchange`, `rpwhy`, `rpstep`, `rplv`, `rpnote`, `rpphoto`, `rpsend`, `rpdone` | Empty shelf: "Count it now", not a form (R1 DATA-03). Leave guard "Leave this report?". S: "Sending…" with Undo. O: "Kept on this phone" (outbox). ✓: "Report sent · 1 bag of Cement Hima 50kg · damaged", track Sent → Ruth decides → Shelf if written off |
| `rphoto` | The loss photo | Camera, shutter | Report → Add a photo | `rpshoot` | No camera → file picker |
| `restock` · Ask for more | Ask the Buyer to buy for the shelf | Item card ("Aisle D · 2 free to sell"); **How soon**: We're out (orders are waiting) / Running low (next round is fine); **About how many** − n + "A guess is fine · Denis decides what to buy"; Send | Item "We need more · ask Denis" | `rswhen`, `rsstep`, `rssend`, `rsdone` | S/✓ done screen; O → as other sends |
| `ret` · Returns | Goods back from a customer, for a credit note | **Who is bringing it back?** The client (at the gate) / Our driver (refused at the door). **Which order** search; "Delivered lately" (last 30 days); open returns with **Take back**. Order: header "The client brought it to the gate", slip "WHAT BWAISE GOT · tap + for what came back", per line − n + and **Good · to the shelf / Damaged**, "Add a photo of what came back · optional", **Why did it come back?** (4 reasons per who), note, dock "1 line coming back · 0 good · 1 damaged", **Send to Ruth** | Stock Returns tile; Today "Check #…'s return" (door return); With Ruth | `rtwho`, `rtfind`, `rtpick`, `rtunpick`, `rtstep`, `rtcond`, `rtwhy`, `rtnote`, `rtphoto`, `rtsend`, `rtwithdraw` (sheet), `rtdecline`, `rtdone` | Dock "Mark what came back" until a line is marked; a damaged reason marks lines damaged (R before-loop 3). S: "Logging…" with Undo. O: "Kept on this phone". ✓: "Return logged · 0 good · back to the shelf · 1 bag damaged · set aside", track Logged → Ruth credit note → Shelf good goods back |
| `scan` · Scan a label | One scanner, five modes | Dark camera frame with a red line, a counter "N of M", a found card (name, "How many …?", − n +, tick), a wrong card ("Wrong item", "Not on this trip", "Not on #…'s slip"), "Undo", "All N ticked · back to the list". Stock mode adds "Print labels", Open, Count | Stock scan, Find scan, receive, pack, load, slip, agent | `scshoot`, `scstep`, `sctick`, `scundo`, `screscan`, `scwronggo`, `scopen`, `sccount`, `scprint` | "No camera on this phone · tick from the list"; "This phone cannot read labels · tick from the list" |

### 1.4 Sheets

| Sheet | Purpose | Opened from | Buttons |
|---|---|---|---|
| `leave` | "Leave this report / return / count?" before losing work (`leaveGuard`) | Back on a dirty form | Stay / Leave |
| `leaveapp` | "Leave Omni-ware? · Nothing is lost · Today opens where you are" | Back on Today (R4 NAV-02) | Stay / Leave |
| `rmwait` | "Remove it from this phone? · It was never sent. Ruth will not see it. Nothing on the books changes." | Bin on a Waiting-to-send row (R10 NAV-09) | Keep it / Remove |
| `bayfree` | "Bay 4 is free · The next order packed lands here"; bay chips; "Next to pack · if you want to fill it" with Look | A free bay tile | Look (`bfgo`), Close |
| `myname` | "Your name · What the team calls you"; preview "Shows as Musa on Today…" | Today name card; You pencil | Save |
| `extra` | "Extra on the truck": find box, **Scan its label**, "Nakawa brought before" list; then qty, why (bought extra / sent by mistake…); a **new item** sub-form (name, unit, photo) that pushes Sourcing | Check-in "Something not on the list?" | `expick`, `exstep`, `exwhy`, `exadd`, `exnew`, `exnunit`, `exnphoto`, `exnadd`, `exscan` |
| `pkrelease` | "Let #2396 go? It goes back to the queue for anyone to pack." | Pack → Release | Leave it on the bay (ticks stay) / Put it back (ticks cleared) / Keep it |
| `unpack` | "Unpack #2391? · Bay 1 is freed. Your ticks stay…" with a bay → To pack picture | Packed chip; slip "Unpack #…" (R2 FLOW-02) | Keep it packed / Unpack |
| `roadname` | Name a delivery direction on the load map (`route.lock`) | **No entry point**: `ACT.ldname` exists but no screen renders `data-act="ldname"` | Chips, "Call it …" |
| `nophoto` | "Deliver without a photo? · Say why · Ruth sees it on the order" | Deliver → Can't take a photo? | The camera will not open / The client said no photo / Too dark to see / Phone battery low / Take a photo after all |
| `ctwait` | "Aisle C is with Ruth · Joy counted it · 8:15 · 3 items", a track Joy → Ruth → shelf | A second count of a place with one waiting (R1 DATA-01) | **Count it again** ("Ruth sees only the new one once you send it") / See Joy's count |
| `rtback` | "Take back this return?" naming the order | Returns → Take back | Keep it / Take it back |

Also: the toast (one line, above the bar), the "Not done" bar, the Undo pill on done screens, and the goneSheet ("That order is gone") when a page's subject disappears.

---

## 2. Jobs and taps today

These were counted in the harness from a fresh open of the app. A **tap** is a press, a slide or one keypad digit on the agent pad. Typed text (a count, a name) is listed in the notes, not as taps. "Next job" means the white button on Today's Next job card. The red play button does the same thing in one tap.

| Job | Steps today | Taps today | Notes |
|---|---|---|---|
| **Check in a buyer's trip** (4 lines, 1 short) | Today → Next job "Check it in" (or In tile, which opens the trip when one is back) → per line: tap the circle, type what came off (blind) → on the short line pick a reason → slide "onto the shelf" → done screen | **7** (1 open + 4 circles + 1 reason + 1 slide) + 4 typed counts | Measured. A count unlike the Buyer's forces a reason ("Say why the count is less" on the slide). Unit switch +1 per line counted in cartons. Extras: +sheet. Done screen offers "Pack #… now". 10 s Undo |
| **Pick & pack an order** (6 lines, one short by 2) | Today → to pack tile → To pack list → order row (or Next job "Start packing" when it is next) → per card "Packed" (moves on by itself) → on the short card lower with − (or tap the box and type) → amber "Pack short" → the last card finishes the order → bay is picked for you | **10** by the tile (measured: 2 + 5 Packed + 2 minus + Pack short); **9** from the Next job card | The first tick claims the order ("Yours"). Shortfall goes to the Manager (`pick.settle`). The bay is auto-chosen (+1 to change). 10 s Undo, then Unpack behind a sheet |
| **Load: our driver** (2 drops, 3 lines) | to load tile → run opens on the first drop to load → tick each line (the next drop opens by itself) → slide "Slide to send Okello · 2 drops" | **5** | Measured. The driver is the first free driver; another is +2 (Change, pick). "Me" is +2 and ends on "Start the drive". 10 s Undo |
| **Load: hired driver** (new) | to load tile → Change → name, plate, phone → Use → tick each line → slide → (Send on WhatsApp) | **10** (+1 WhatsApp) | Measured. A driver used before is one card (Change + card = 2). Phone must be a Ugandan number |
| **Load: client collects** (pickup, 1 line) | Today "Walk-in collects #2552 · Hand over" (or the bay tile) → type the collector's name → tick each line → slide "Slide to hand over to Peter" | **4** + a typed name | Measured. Client is preselected for a pickup. A not-paid order stops here (Ask Ruth to let it go, 1 tap) |
| **Agent collects** | Today "X collects #… · Code" → 4 keypad digits (the order number) → tick each line → slide | **6 + one per line** | The code is the order number from the agent's app. Wrong code clears itself after 1.2 s |
| **Deliver with photo** | From Today: Next job "At the door" → shutter → name is prefilled → slide "mark delivered". From the road: on the road tile → map → "I'm at X" → door page → "All handed over · take the photo" → shutter → slide | **3** from Today; **5** from the drive | Measured (shutter simulated: no camera in the harness). "At the door" photo kind +1. No photo: "Can't take a photo?" + reason replaces the shutter (+1). Something staying on the truck: +1 to open a line, steps, and a door return waits on Today |
| **Pickup at the counter** | Same as "client collects" (the slip) | **4** + name | There is no separate counter screen. A walk-in order with no destination is a pickup |
| **Count stock: spot** (1 item) | Only when the item is due (over 21 days, or Ruth asked a recount): Stock tab → aisle → item → "Count it now" → type the count → Send. Or Stock → scan → aim → Count → type → Send | **6** + a typed count | Measured from the keypad (2 taps: box, Send). No figure shows before or after. An item that is not due has **no count button** on its page, only through the scanner |
| **Count stock: aisle** (3 items, one in ctn + doz) | Stock tab → Count tile (the app picks the aisle counted longest ago) or aisle → header Count → tap each box and type (one box per unit level) → "Send the count to Ruth" | **7** by the tile, **8** by the aisle (measured: 4 boxes) + typed counts | "Can't find" per item allows a partial slide. "Keep for later" keeps the draft. A place with a count waiting opens ctwait first (+1 "Count it again") |
| **Report damage / loss** | Stock tab → Report a loss → pick the item → Damaged / Lost / Stolen → (− + for how many) → (photo, note) → Send to Ruth | **5** for one unit | Measured. Photo +2. From the item page: Stock → aisle → item → Report → reason → Send (6). Empty shelf → "Count it now" instead |
| **Receive a return** (client at the gate, 1 unit of 1 line) | Stock tab → Returns → (The client is preselected) → pick the order from "Delivered lately" (or search) → + per unit → reason → Send to Ruth | **6** | Measured. A "Damaged…" reason marks the lines damaged; Good/Damaged per line +1. **A door return**: after delivery, Today shows "Check #…'s return · filled in at the door" → Check it → reason → Send (3) |
| **Ride a collection trip** (1 stop, 2 lines) | Today → Next job "Start the trip" → tick each line as it goes on (− + if it differs) → "Done · back to the yard" → slide "Slide to hand in the trip" | **5** | Measured. Several stops: tap the stop chip. Hand-in pushes `trip.back` (to the Store itself, then a check-in job) and `trip.cash` (Accounts) |
| **Counter sale** | None in the Store app | — | The counter sale is Sales' one write from the shelf (glossary "Counter sale: Pay and go, from our own shelf"). The yard sees it only as stock that has gone, and in item history as "Sale · X" |
| Pass the yard (end of shift) | You → End my shift → pick the colleague → Pass the yard to Joy; Joy taps "I've got it" on Today | **4** + 1 for the colleague | Moves your half-done jobs and your asks |
| Close the yard | Today "Close the yard" card (yard clear, from 17:30) → "It's on the shelf" per return to shelve → slide | **2** + one per return | Log line to the Manager (`store.closed`) |

---

## 3. Every audit fix

"Keep?" says whether the redesign must keep the behaviour. **yes** means keep it whatever the screens look like. **not needed if X** means the fix only exists because of a layout or flow the redesign may remove; if the redesign removes it, the fix can go too. Server-side fixes stay whatever the UI does.

### Before the loop (browser-test reports 1–4, Oct 2026)

| Round | Item | What was fixed | Where in the UI | Keep? |
|---|---|---|---|---|
| Pre 1 | Report 1 | Money off the yard's phones (0159); snapshot cached in IndexedDB; over/short reasons at check-in; new items at check-in; return reasons; partial counts; wording; screen-reader labels | Check-in, extras sheet, Returns, aisle count | yes |
| Pre 2 | Report 2 | Nothing cut off at 360 px: name, size and colour on their own lines (`.pv` tags); no ghost of Today under pages; one Back | Every list row; page stack | yes (tags rule); ghost/Back not needed if pages are rebuilt, but keep "one Back" |
| Pre 3 | Report 3 | A loss report never multiplies on a unit switch; damaged goods never go back to the shelf; one page per tap; Return Back goes to the right list | Report a loss, Returns | yes |
| Pre 4 | Report 4 | Allow-list for the yard's data (0160); search puts the best match first; delivered goods leave the shelf; Take back asks first (`rtback`); outbox for reports and returns; hand-over drafts kept; driver phone check | Find, item page, Returns, Waiting to send, slip, Who's driving | yes |

### Rounds 1–10

| Round | Item | What was fixed | Where in the UI | Keep? |
|---|---|---|---|---|
| 1 | DATA-01 | One waiting count per place; a count done again replaces it when sent (`store_count_replace`, 0161); done screen shows old → new | `ctwait` sheet, Count, countresults, decide ("It moved on"), With Ruth | yes |
| 1 | DATA-02 | A return reads in its order line's unit (`backText`); 0161 relabels | Returns, Close the yard line | yes |
| 1 | DATA-03 | No loss off an empty shelf ("Count it now"); a write-off never past the shelf, one log row per report | Report a loss (picker, empty state), Manager | yes |
| 1 | DATA-04 | "Shelf", not "books", next to a shelf figure | Report cap, decide, item page | yes |
| 1 | DATA-05 | 59 products moved out of Furniture; no aisle letter for an uncategorised product ("No aisle yet") | Stock aisles, aisle page, item aisle pill | yes |
| 1 | DATA-06 | 13 product and 4 variant names to one dash | Data only | yes (data) |
| 2 | FLOW-01 | Check-in counts in ctn or dozen and keeps the line's unit ("You counted 1 Ctn = 20 Dozen") | Check-in line counter, unit switch, scan-to-tick | yes |
| 2 | FLOW-02 | Every held write waits 10 s; a packed order can be unpacked in the yard (ticks kept, bay freed) | Undo on done screens; `unpack` sheet; To pack banner | yes |
| 2 | FLOW-03 | The hand-over name follows the typing without losing focus | slip name box and slide label | not needed if the name box is not tied to a live slide label; keep "typing never loses focus" |
| 2 | FLOW-04 | A counter or field that opens takes the cursor | Check-in counter, extras search | yes |
| 2 | FLOW-05 | One Today card per trip draft (Next job carries the draft) | Today Next job / resume card | yes (one card per job) |
| 2 | FLOW-06 | "I miscounted" both ways; it reopens the number and keeps nothing | Check-in reasons | yes |
| 2 | FLOW-07 | Singular/plural from one helper (`nOf`) | Everywhere | yes |
| 3 | REL-02 | The hand-over name and the ticks are kept until the server says yes, across a reload | slip | yes |
| 3 | REL-04 | One "Waiting to send" list on Today; "Not sent · N" in the header | Today card and status pill | yes |
| 3 | REL-05 | Sending / kept / sent on every done screen; "Handing over…", "Packing #…", "Delivering…" until the yes | All done screens (`stateDot`, `trackStep1`) | yes |
| 3 | REL-06 | 400 ms tap guard after a screen change; Unpack moved up top so it never sits where the last main button was | Click handler; Packed screen chip | yes |
| 3 | REL-07 | Failed writes keep their work: the "Not done" bar with Try again (amber no signal, red failed, blue someone else) | slip, deliver, pack | yes |
| 3 | REL-08 | Two phones on one order never both win (`store_patch_order` `p_expect`, 0162; "Someone else just did this · Refreshed") | Every order write | yes |
| 3 | REL-09 | Plain error words; never SQL or migration words; "That did not save · tell Kevin · code" | Toasts, Not done bar | yes |
| 4 | NAV-02 | Phone and browser Back walk the app's own screens; "Leave Omni-ware?" on Today | `navArm`, popstate, `leaveapp` sheet | yes |
| 4 | NAV-03 | A size like 1 1/4" stays one tag | Find, aisle, Pack | yes |
| 4 | NAV-04 | A quote, an order waiting on goods, someone else's order open a look-only view; red packs only the full line, "Pack short" amber, "Waits for the goods" grey | `orderview`; Pack dock | yes |
| 4 | NAV-05 | Every order row in Find opens something | Find | yes |
| 4 | NAV-06 | "hindge", "4x20", "silcone" find the right items; "Did you mean" (0163 renames P550) | Find | yes |
| 4 | NAV-07 | Find lists every match; chips only with a query; a chip's count = the rows | Find | yes |
| 4 | NAV-08 | A long aisle keeps Back in a sticky navy bar with "back to the top" | Aisle page | not needed if the aisle header never scrolls away; keep "Back always reachable" |
| 4 | REL-05 | "Handing over…" / "Packing #…" until the server's yes | slip, load, agent, pack done | yes |
| 5 | PRIV-01 | Nothing about money reaches the phone for any login; the phone's own words (`letGoAsk`, `letGo`, `takenBack`, `agentSettled`, `terms`); a write sends only the keys the tap changed | Data layer; money-hold dock | yes (server; the UI must never ask for a money field) |
| 5 | PRIV-02 | The snapshot works again; 0156's money hold restored | Data layer | yes |
| 5 | PRIV-03 | A failed load says "Could not load the yard" with Try again and a code on every tab; never falls back to direct reads; dashes, grey play | Today, Stock, every tab | yes |
| 5 | PRIV-04 | Every member has a name; set on invite, changeable on You (`set_my_name`) | You, myname sheet, Today name card | yes |
| 5 | PRIV-05 | A Store login writes only through its functions and reads only its own membership | Server | yes |
| 5 | NAV-02 (reopened) | One history entry per screen so Chrome no longer skips Back | Navigation | yes |
| 6 | WORD-01 | One name resolver (`personName`); never a login handle | Everywhere a person shows | yes |
| 6 | WORD-02 | "Pass the yard" / "End my shift" for the shift; "Hand over" only at the gate | You, handover, Today card, alert | yes |
| 6 | WORD-03 | "Not paid yet" everywhere, one reason only on the order | Bay, Today, Load, slip stamp, order dock | yes |
| 6 | WORD-04 | One definition per count (`counts()`): to pack = ready now, "+N waiting" beside it; delivered includes collected | Today ring, tiles, To pack, On the road | yes |
| 6 | WORD-05 | With Ruth shows every yard ask with who sent it and a face | With Ruth | yes |
| 6 | WORD-06 | A trip difference is a check-in ("Your check-in of Denis's trip") | With Ruth, alerts | yes |
| 6 | WORD-07 | Durations `howLong()` ("41 m", "9 h 41 m"), moments `whenAt()` ("15:20", "Thu 23:28") | Everywhere | yes |
| 6 | WORD-08 | A trip is never a round (`roundWord`) | In, Today, alerts | yes (and see the leftovers in §4.4) |
| 6 | WORD-09 | Stock history names the order ("Order #0548 · X"); units lower case (`unitSay`) | Item page, every quantity | yes |
| 6 | WORD-10 | The bell counts only today's for-you alerts; opening Alerts reads them | Bell, Alerts | yes |
| 7 | STO-UI-01 | Quantities in whole packs then the line's unit ("1 ctn + 4 box"); never "0.5 ctn" (`lineQty`) | Pack, slip, receipts | yes |
| 7 | STO-UI-02 | Every Pack line opens at what was ordered; the shelf only hints ("Count due · count as you pick") | Pack | yes |
| 7 | STO-UI-03 | Room under the play button at the end of every scroll (`--nav-room`) | Today, Stock | not needed if there is no floating play button; keep "nothing hides under a fixed control" |
| 7 | STO-UI-04 | Every control 44 × 44 | All | yes |
| 7 | STO-UI-05 | One scale: type, radius, shadow, space, colour tokens | CSS | not needed if the Agent tokens replace it; keep "one scale, no raw values" |
| 7 | STO-UI-06 | Today's header on one line, status as a pill | Today | not needed if the header is redrawn; keep the status pill states |
| 7 | STO-UI-07 | The slip: "OMNI-WARE" (`shopShort`), names with tags, people in full | slip | yes (names in full, tags) |
| 7 | STO-UI-08 | One picture style; a broken photo falls back to the category drawing (`kindOfItem`, `imgOr`) | Lists, Pack card, item | yes |
| 7 | STO-UI-09 | On the road shows stops done; a hired driver is told apart | On the road | yes |
| 8 | STO-REL-11 | "Checking your shop…" / "Could not reach the shop"; never "This login has no shop" after a failed read | Boot screens | yes |
| 8 | STO-A11Y-01 | Big text works on the scale, at least 1.2×, controls 52 px | You → Big text | yes |
| 8 | STO-UI-03 (A2) | The white bar reaches the play button's top; nothing tappable meets it | Bottom bar | not needed if the play button goes |
| 8 | STO-A11Y-02 | One h1 per screen, section labels h2, only the top screen readable (`syncInert`) | All | yes |
| 8 | STO-A11Y-03 | "1 of 2" on Pack readable (5.5:1) | Pack card | yes (contrast ≥ 4.5:1) |
| 8 | STO-UI-10 | Hand over fits at 360 (one picker row); On the road button under the order | slip, On the road | not needed if those layouts change; keep "fits at 360" |
| 9 | STO-SPD-01 | Opens with no signal (`store-sw.js` keeps the page, never the books); "Update ready · Reload" | Boot, Today card | yes |
| 9 | STO-SPD-02 | Find types smoothly: only results redraw, 30 rows a time, "Show 30 more" | Find | yes |
| 9 | STO-SPD-03 | First data in about 1 s; `store_live` refresh (0166) | Data layer | yes |
| 9 | STO-SPD-04 | "Live" only after fresh data; "Updating…" / "Updating · saved H:MM" | Status pill | yes |
| 9 | STO-A11Y-03 | Last small text under 4.5:1 fixed (Pack count, ring, empty bay, bar words, Alerts times) | Several | yes (rule) |
| 9 | STO-UI-10 | Hand over on a short phone shows the whole slip first | slip | not needed if the slip layout changes |
| 9 | STO-UI-03 | Not changed (lists are pages over the bar) | — | — |
| 10 | STO-WORD-11 | A person with no name is named by role ("The owner"), never "Someone"; "Packing now" | Everywhere; To pack | yes |
| 10 | STO-REL-12 | Two tabs on one order proven safe on a real database | Server / tests | yes |
| 10 | STO-UI-11 | Alerts and You on the type scale; the whole Report box is the field | Alerts, You, Report | not needed if redrawn; keep "the whole box is the field" |
| 10 | STO-A11Y-04 | A finished pack card dims its contents, never its stamp; empty text ink-2 | Pack | yes if cards stay |
| 10 | NAV-08 | Back and the title stay at the top of With Ruth, Alerts, On the road, In (`stickBar`) | Those pages | yes (rule) |
| 10 | NAV-09 | Waiting to send has Remove after a confirm; a reload reopens the same list or detail page; flows reopen from Today with drafts | Today card, `rmwait`, `saveView`/`restoreView` | yes |
| 10 | STO-UI-12 | A check-in line shows the name, then its tags; one service-worker cache | Check-in | yes |
| 10 | Kevin · In | The In page as an arrivals board (next trip, Coming in, checked in today) | In | yes as content; layout free |
| 10 | Kevin · headers | One-row compact headers on To pack, On the road, the count pages | Those pages | not needed if redrawn |
| 10 | Kevin · On the road | One row per stop with "Delivered" beside it | On the road | yes (one row per item rule) |
| 10 | Kevin · light band | The strip behind the clock repainted after a page slides in | Status bar (Android) | yes while a coloured header meets the status bar |

Deferred and still open (from LOG.md): the `store.handover` push text ("handed you the yard" should be "passed you the yard"); the `store-money-db` and `manager-decisions-db` database scenarios; stable stored aisle letters; the 13 products still in Furniture; the owner's display name; `worker.html` still reading orders directly.

---

## 4. Order states, words and pushes

### 4.1 Order states the Store reads

| Field | Value | What the Store calls it / does |
|---|---|---|
| `status` | `draft` | A quote: Look only ("Quote") |
| | `awaiting_goods` | Waiting on goods: "Buying" chip, striped row, "+N waiting" beside To pack |
| | `preparing` + no `pickingStatus` | To pack ("Ready · oldest first") unless a bought-in line has not come (`goodsBlockPreparing` → waiting on goods) |
| | `preparing` + `pickingStatus: in_progress` | Packing: "Yours · carry on", or "Packing now · Joy" (someone else's, locked) |
| | `preparing` + `pickingStatus: done` | Packed: on a bay; to load (has a destination) or a pickup / "they collect" (no destination, or agent pickup). With a money hold: "Not paid yet" |
| | `pending_delivery` | On the road ("out now"); the driver's drop |
| | `completed` | Delivered (includes "collected"); 30 days in Returns; aged off the board 24 h after it is invoiced |
| | `cancelled` / `cancelledAt` / `voided` | Called off: "Put back #… · called off" if you had packed some |
| `pickStatus` (per line) | `done` / `short` / `pending` | PACKED stamp / "N SHORT" stamp (Manager settles) / open card |
| `pickedQty` | number | What went for a short line |
| `carrier.kind` | `staff` / `hired` / `client` / `agent` | Driver / "Abudu (hired)" / at the gate / agent code |
| `deliveredPhotoKind` | `note` / `door` | Signed note / At the door |
| `deliveredNote` | reason | Why there was no photo |
| `letGoAsk` / `letGo` | the money ask and the answer | "Asked · waiting on Ruth" / the Manager's decision |
| `bay` | 1–N (4 by default, `presets.bays`) | The bay tile |
| `runDriver` | staff id | The planned driver for a run |

The Store may only move `preparing → pending_delivery | completed` and `pending_delivery → completed` (`STORE_STATUS_MOVES`, 0178).

Trips: `open` (Not started) → `assigned` → `collecting` (Buying · n of m) → `collected` (back at the yard / At the gate) → `confirmed` (checked in, `yardCheckedAt`); `difference_status: open` while Ruth decides. Counts: `sent` → `accepted` / `recount` / `superseded`. Reports: `sent` → `written_off` / dismissed. Returns (`invoice_asks`): `sent` → `withdrawn` / `declined` / accepted. Asks (`store_asks`): `sent` → `accepted` / `declined`.

### 4.2 Words on screen (the Store's vocabulary)

- Today: **gone out**, **In**, **to pack** (+N waiting), **to load**, **on the road**, delivered / on the road / packed / to pack (ring legend), **Next job**, **Bays** (free, Not paid yet, collects, agent), **Then**, "N more · …", **The yard is clear**, **Waiting to send**, **Not sent · N**, **Live / Updating… / Offline**, **Update ready · Reload**.
- Job card tags: Back at the yard · time; Pack · waiting 5 h; At the gate · bay N; On the road · yours; N packed · road; Called off; From the door; Denis sent you.
- In: **Buying · n of m / Coming / Not started / At the gate**, **Coming in**, **Checked in today**.
- Pack: **Yours**, **Release**, **Packed · 40 pc**, **Pack short · n of m**, **Waits for the goods**, **Not in yet · coming from …**, **Count due · count as you pick**, **N short · Ruth settles the rest**, **is packed**, **Leave it on** (bay), **Unpack**.
- Load / gate: **Load in this order · the last drop goes in first**, **lines on**, **lines short**, **Who takes it**, **Read each line out with …**, **Checked together with …**, **Slide to hand over to …**, **Handing over…**, **is on the way**, **Handed over to …**, **Not paid yet**, **Ask Ruth to let it go**.
- Deliver: **Signed note / At the door**, **Who took it**, **Can't take a photo?**, **Slide to mark delivered**, **Delivering…**, **Delivered**, **The invoice goes out by itself · Ruth can invoice it sooner**.
- Stock: **on the shelf**, **free to sell**, **held for orders**, **Left the shelf · not invoiced yet**, **Needs a look** (out, low, count due, short, reported), **No aisle yet**, **Never counted**, **Count it now**, **We need more**, **Blind count**, **Can't find**, **Count it again**, **With Ruth**.
- Sends: **Sending… / Kept on this phone / Not sent yet / Sent**, **Not done** (no signal / That did not save / Someone else just did this), **Remove**.

### 4.3 Pushes

**The Store sends** (the write the app makes, and the push the database or edge function raises):

| Store action | Write | Push kind | To |
|---|---|---|---|
| A short pick | `store_patch_order` (line `short`) | `pick.short` "A short pick to settle" | Manager (`pick.settle`) |
| Delivered | `store_patch_order` → `completed` | `order.delivered` "Delivered — ready to invoice" | Manager (`invoice.make`); it invoices itself 24 h after |
| Check-in with a difference | `receive_trip` | `trip.difference` "A trip came in short or over" | Manager |
| Extra on the truck | `store_asks` kind `extra` | `store.extra` "Not on the list · keep it?" | Manager (`trip.difference`) |
| A new item at check-in | `store_asks` kind `extra` (new) | `store.new_item` "A new item at the yard" | Sourcing (`product.edit`) |
| Ask for more | `store_asks` kind `restock` | `store.restock` "More wanted on the shelf" | Buyer (`buy.restock`) |
| Pass the yard | `store_asks` kind `handover` | `store.handover` "… handed you the yard" (text still to change) | The colleague |
| Close the yard | `store_asks` kind `close` | `store.closed` "The yard is closed" | Manager (a log line) |
| Let an unpaid order go on credit | `store_patch_order` `letGoAsk` | `credit.ask` "Not paid · let it go on credit?" | Manager (`credit.release`) |
| A return | `store_return_ask` (`invoice_asks`) | `invoice.ask` "An invoice to void or credit" | Manager |
| A loss report | `stock_reports` insert | `stock.report` "Stock reported …" | Manager (`stock.writeoff`) |
| A count | `stock_counts` insert / `store_count_replace` | edge function `notify-stock-count`: "Stock take done · aisle" (data `stock_count`) | owner, admin, manager logins (note: the owner gets this push too) |
| Hand in a ridden trip | `store_patch_trip` | `trip.back` "A trip/round is back — count it in" and `trip.cash` | Store (`stock.receive`) and Accounts |

**The Store receives** (handled in `pushOpen`):

| Push kind | From | Opens |
|---|---|---|
| (no kind, `orderId`) "New order to prepare" / "Next to pick" | `notify-worker` (worker, store roles) | Pack if already yours; else Today; Load or Deliver if it moved on |
| `trip.back` | Buyer hands in a trip | Check-in of that trip, else In |
| `trip.sent` | Buyer sends this person on a trip | The ride |
| `trip.taken`, `trip.cancelled` | Buyer | Today |
| `job.given` "A delivery for you" | Manager (0158) | Deliver, else Load |
| `credit.ask.decided` | Manager | The gate slip, else Load |
| `store.handover` | A colleague | Today (the "I've got it" card) |
| `store.ask.decided` | Buyer / Manager | The item (restock), else With Ruth |
| `stock.report.decided` "Your report was decided" | Manager | The item page |
| `stock_count` | `notify-stock-count` | decide (manager logins on the Store app) |
| `order.cancelled` "Called off · stop packing" | Manager (0177, `order.pick`) | **No handler**: the tap does nothing special; Today shows the Put back job anyway |

### 4.4 Words that still disagree (found while documenting)

- The ride says "Denis's **morning round**" and "**Round** handed in" (`store.html` 6142, 6152), and the `trip.back` push title says "A **round** is back". WORD-08 says a trip is never a round.
- The `store.handover` push says "handed you the yard". It should say "passed you the yard" (deferred since round 6).
- Load's done screen says "**Handing over…**" for a driver load. The glossary keeps "Hand over" for the gate.
- The Agent app says "**On the way**" where the Store says "**On the road**".
- You shows the role as "**Store lead**". No other app uses that.
- The roadname sheet (`route.lock`, "name the delivery directions on the load map", a Store right in decision-rights) has **no entry point**.
- "Can't deliver? Bring it back" has no page (`PAGE.goodsback`), only a toast.
- A spot count of an item that is not due can only start from the scanner.
- Accept / Ask for a recount on a count show in the Store app for manager, admin and owner logins. Accepting a count is the Manager's decision.

---

## 5. Store-only concepts (no Agent equivalent)

| Concept | What it is today | Where | Rules it carries |
|---|---|---|---|
| **Blind count** | The phone never shows the books' figure for an item being counted, before or after. A count goes to the Manager (`stock.correct`), who accepts it or asks for a recount. One open count per place; a second one replaces it when sent | Count (item and aisle), decide, ctwait, item page when due | No figures when due; "Can't find" makes a partial count; drafts kept; never "books" next to a shelf figure |
| **Check-in by drop** | A trip (or several stops of one round) is counted off the truck line by line. The Buyer's figure shows only after the line is counted. Each line goes to its order, the shelf, or both when a carton splits (`rcShareOf`). Differences need a reason and go to the Manager. Extras and new items go to the Manager or Sourcing | receive, extra sheet, In | Count in the unit you can see; the books keep the line's unit; one draft per trip; "I miscounted" keeps nothing |
| **Short pick** | Pack fewer than ordered (amber "Pack short"); the Manager settles: bill what went, or the full quantity | Pack, With Ruth | Red is the full line only; a line bought in that has not come waits, never "0 on the shelf" |
| **Claim, release, put back, unpack** | The first tick claims the order ("Yours"); Release leaves ticks on the bay or puts it back; a called-off order lists what to put back; a packed order can be unpacked while in the yard | Pack, pkrelease, unpack, Today put-back job | Looking is free; a tap from a push never takes an order |
| **Bays** | Numbered places where packed orders wait (default 4); the pack picks a free one; Today shows them as tiles | Today, Pack done, Load, Close | "Every bay is full · leave it by the gate" |
| **Loading by direction** | Packed deliveries are grouped into runs by compass sector from the yard (`sectorOf`, 45°), named by road (`roadNames`); loaded last drop first; one driver per run (ours, me, or hired with a WhatsApp list) | Load, Who's driving, Today run job | Orders still packing on the same road show as "goes on the next run" |
| **Money at the gate** | A cash customer's unpaid packed order cannot leave (`moneyHold`); the yard asks the Manager to let it go on credit (`letGoAsk`); no amount is ever shown | Bay, slip, Load, Today "Not paid yet" | One label "Not paid yet"; the one reason only on the order; no customer record means it waits for the money |
| **Hand over at the gate** | A pickup or agent pickup is read out line by line with the collector, named (or the agent's code), then slid | slip, agent | Name and ticks survive a reload |
| **Proof of delivery** | A photo (signed note or at the door), who took it, or a reason for no photo; what stays on the truck becomes a door return | drive, door, deliver | The invoice goes out by itself 24 h later |
| **Returns** | Goods back from the client at the gate or refused at the door, per line good (to the shelf) or damaged (set aside), with a reason, for the Manager's credit note | ret, rtback, Today door-return job | Never bigger than what the line has left; damaged never goes to the shelf by default; Take back asks first |
| **Write-off reports** | Damaged / lost / stolen, how many (capped at the shelf), note, photo, for the Manager to write off | report, rphoto | Count before loss: an empty shelf offers "Count it now" |
| **Ask for more** | A restock ask to the Buyer: how soon and a rough count | restock | The Buyer decides what to buy |
| **Trip ride** | A yard person rides a Buyer's trip, counts each line onto the truck, hands it in at the yard | ride | No money on the phone; the hand-in tells Accounts and the yard |
| **Pass the yard / Close the yard** | Shift handover with half-done jobs and asks; end-of-day checklist logged to the Manager | handover, close, Today card | "I've got it" on the colleague's phone |
| **Shelf labels and the scanner** | Print barcode labels per aisle; one scanner with five modes (stock, pack, load, receive, agent) | labels, scan | A wrong label says whose it is |
| **Waiting to send / held writes** | Every write waits 10 s with Undo; reports and returns go to an outbox with no signal; picks, check-ins and counts are drafts; one list shows all, with Remove | Today, every done screen | Never a green tick before the server's yes |

---

## How this was checked

- Harness: `/tmp/claude-0/-home-user-omni-ware/11b18423-d239-564a-81b7-c16ec0e211d4/scratchpad/app/`. The old stub `fakesb.js` predates round 5 (the app now reads only `store_snapshot`), so a copy, `fakesb2.js`, adds `store_snapshot`, `store_live`, `store_order` and `store_patch_order`. `storeshoot.js` (pages and sheets, from a JSON list) and `storeflow.js` with `flows-*.js` (tap-counted jobs) drive Chromium at 360 × 780. The scratchpad's `build.sh` overwrites `store.html` from old fragments and was **not** run.
- Screenshots: `/tmp/claude-0/-home-user-omni-ware/11b18423-d239-564a-81b7-c16ec0e211d4/scratchpad/storeshots/`. Pages are numbered `01-today` … `49-stock-scrolled`, sheets are `25-sheet-*` and `40`–`47`, states are `empty-*`, `fail-*` and `off-*`, and flows are `f-<job>-<step>` (checkin, pack, load, hired, gate, deliver, spot, aisle, report, ret, ride).
- Not reachable in the harness: the camera (shutter simulated), the map tiles, native push, and the roadname sheet (no entry point).
