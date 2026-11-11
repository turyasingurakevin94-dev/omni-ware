# The Store's job, rethought from first principles

Design only. This is the job the new boards draw (canvas "Store — in the agent app's language"). Today's job and taps come from `STORE-TODAY.md` §2; the handovers and their mismatches (IM-nn) from `INTEGRATION.md`. `docs/decision-rights.md` is unchanged: the Store does its work and proposes; Ruth (Manager) decides short picks, write-offs, returns, count differences and credit; Accounts takes money; nothing waits on the owner.

The people: storekeepers in a yard in daylight, often on bad signal, some who read little. So: pictures before words, one job on screen at a time, everything prefilled, the exception is the only thing you tap, one slide commits, Undo instead of a confirm, and the phone keeps the work when the signal goes.

## 1. The order's path through the yard

```
Sales (Grace) places #0552 ─push "New to pack"─▶ STORE: To pack
   (Checking, Buying happen elsewhere; a Buying line arriving = Check-in, §2)
To pack ──tap the order── Pack: one line at a time, all at the asked qty
   └─ a line short ─▶ Pack short (amber) ─push "Short · Ruth settles"─▶ Ruth ─decision push─▶ Store + Grace
Packed ── the app picks the bay, says it, prints nothing ──
   ├─ we deliver ─▶ To load (by direction) ─slide─▶ On the road (Ssali) ─push─▶ Grace, agent, customer
   │                    └─ Not paid yet: stays on the bay; push to GRACE (takes the money) + Ruth (may let it go)
   │   On the road ─▶ at the door: photo = Delivered ─push─▶ Grace, Ruth; invoice by itself after 24 h
   └─ they collect ─▶ Ready to collect (On the road · at the gate) ─push "Ready · bay 3"─▶ Grace, agent, customer
        gate: name or agent code ─slide Hand over─▶ Delivered · collected ─push─▶ Grace
Stock and books agree: every step writes the shelf (packed lines leave the shelf; nothing counted twice).
```

### What changed, step by step

| Step today | Needed? | Now | Closes |
|---|---|---|---|
| Find the next order (tile → list → row) | merged | Today's **Next job** card opens the oldest To pack order with the yard already in its path (aisle order). 1 tap | — |
| Claim the order ("Yours", Release) | automated | The first Packed claims it; a Manager's pick ("Ruth gave it to you") shows as **For you** on To pack; others see "Okello's" and get Look only | IM-08 |
| Per line "Packed" | kept | One card per line, picture first, aisle letter big; "Packed" moves on by itself | — |
| Short: − steps, then "Pack short" | merged | "Short" opens the count in the unit you can see (cartons, boxes); the amber Pack short sends `pick.short` to Ruth **and tells Grace** "1 short · Ruth settles" | IM-37 |
| Pick a bay | automated | The app picks and says it ("Bay 2"); change is one tap | — |
| Packed pickup sits in Packing until the gate | **changed** | Packed + they collect ⇒ **Ready to collect** (On the road · at the gate) with a push to the salesperson, the agent and the customer | IM-03, IM-05, IM-06 |
| Packed delivery waits for Load | kept | **To load**, grouped by direction (→ Ntinda, → Ggaba); the driver remembered; tick lines, one slide | — |
| "Not paid yet" pushes only Ruth | **changed** | Packed + not paid ⇒ "Not paid yet" on the bay, and a push to **the salesperson who took it** ("Kato's #0552 is packed · take the money") and to Ruth ("…or let it go on credit"). The Store taps nothing | IM-07 |
| Delivery address and time guessed from the customer | **changed** | The pack card, To load and the drive read the order's own **"Where · when · phone"** from Sales ("Ntinda site · by 13:00 · 0772 418 220") | IM-01, IM-02 |
| Gate hand over (name typed) | kept, shorter | The collector's name is prefilled from the order's phone/contact; agent pickups by the 4-digit code; slide. Delivered **· collected**, never "at the door" | IM-06 |
| Deliver: photo then slide | merged | The shutter takes the photo **and** marks it Delivered (Undo 10 s). No photo: one reason chip | IM-30 |
| Cancel reaches only the packer | **changed** | A called-off order shows red **"Called off · put it back"** wherever it is (To pack, bay, To load, truck) with a put-back list; the tap on the push opens it | IM-11, IM-39 |

## 2. Goods coming in

| Step today | Now | Closes |
|---|---|---|
| Trip back: push "A round is back — count it in" | Push "Denis's trip is at the gate · 4 lines" (the word is **Check-in**; never round, never count-in) | IM-25, §4.4 |
| Check in: tap each line's circle, type a count (blind), pick a reason | **Still blind** (the books never show; audit DATA rules). Each line is a big picture with **quick tiles in the unit you can see** ("1 bundle · 20", "2 ctn", "+1"), so most lines are one tap and no typing. Lines are grouped **by where they go** (the order's drop, or the shelf); a cancelled order's line goes to the shelf by itself. A count unlike Denis's asks why on that line only | IM-36 |
| After the slide: "Ruth accepted your check-in" at once | "**Sent to Ruth** · 1 differs" until she decides; her answer comes back as a push | IM-23 |
| Console can check in at the Buyer's count | (other app) only the yard checks in | IM-24 |
| Supplier delivery (no trip) | the same check-in, "Delivery · Hima Cement" | — |
| Extra goods on the truck | "Not on the list" tile in the check-in → asks Ruth (keep or send back), and Ruth's app shows it | IM-17 |
| Return at the gate | One screen from the push or the order: the lines start at what the salesperson asked; per line Good / Damaged; photo; slide "Send to Ruth". Her decision comes back ("Credit note · 67,000 off" is NOT shown: the yard sees "Ruth took it back · 2 bag to damaged") | IM-12 – IM-15 |
| Ride a trip (Denis sends you) | kept: the ride, tick lines onto the truck, hand in. Words: trip, never round | §4.4 |

## 3. Stock, counts and losses

| Step today | Now | Closes |
|---|---|---|
| Spot count only when due or from the scanner | **Count** on every item page; blind; Send to Ruth | §4.4 |
| Count sent; owner pushed; no word back | Count → **Ruth only** (the owner gets the log); Ruth accepts or asks again → push back to the counter ("Ruth asked: count Wire nails 4" again") | IM-20, IM-21 |
| "books" in the Manager's count view | (other app) "the shelf" | IM-22 |
| Report a loss: 5 taps | From the item: Report → Damaged/Lost/Stolen (pictures) → how many (unit you see) → photo → slide. 4 taps + photo. Ruth's decision comes back | — |
| Ask for more | from the item: "We need more" → how soon → send to Denis | — |

## 4. The shift

| Today | Now |
|---|---|
| Pass the yard: You → End my shift → pick → slide; the colleague "I've got it" | kept; push words "Musa passed you the yard" (needs the migration) |
| Close the yard | kept; Today's last card from 17:30 |

## 5. Taps, before and after

From a fresh open of the app; a tap is a press or a slide; typed text listed apart.

| Job | Taps today | Taps new | How |
|---|---|---|---|
| Check in a trip (4 lines, 1 short) | 7 + 4 typed | **6 + 0 typed** | open 1 · 4 quick tiles (one per line, blind) · slide 1; the short line's reason is its tile ("2 came · 1 never came") |
| Pack 6 lines, one short | 9 (10 by tile) | **8** | Next job 1 · Packed ×5 · Short 1 (opens at the count, choose 4 of 6 in boxes) · Pack short 1. Bay is auto |
| Load, our driver (2 drops) | 5 | **3** | To load 1 · "All on" for the direction's lines (or tick one by one) 1 · slide 1 |
| Load, hired driver used before | 7 | **4** | To load 1 · driver chip 1 · All on 1 · slide 1 |
| Client collects at the gate | 4 + name | **2** | Ready card 1 · slide "Hand over to Kato's driver" 1 (name prefilled from the order) |
| Agent collects | 6 + lines | **6** | card 1 · code 4 · slide 1 (lines are on the slip, read, not ticked) |
| Deliver with photo | 3 | **2** | Next job "At the door" 1 · shutter = Delivered 1 |
| Spot count, one item | 6 + typed | **4 + typed** | Shelf · item · Count · Send |
| Aisle count, 3 items | 7 + typed | **6 + typed** | — |
| Report a loss | 5 (+2 photo) | **4 (+1 photo)** | item · Report · Damaged · slide (how many opens at 1) |
| Return at the gate | 6 | **3** | push/Today card 1 · Damaged on 1 line 1 · slide 1 |
| Ride a trip (1 stop, 2 lines) | 5 | **4** | start 1 · All on 1 · Done 1 · slide 1 |
| **The order's path, end to end** (#0552: pack 3 lines, load our driver, deliver) | **9 + 5 + 3 = 17** | **4 + 3 + 2 = 9** | |
| **A pickup, end to end** (#0556: pack 2 lines, they collect) | **9-ish + 4 + name** | **3 + 2 = 5** | |

## 6. Rules the designs keep (from the audit rounds)

All "yes" rows of `STORE-TODAY.md` §3. In particular: blind counts; one waiting count per place; Undo 10 s; Sending… / Not sent yet / Sent; the Not done bar; "Someone else just did this"; no money on the phone; Not paid yet as one label; trip never round; Pass the yard vs Hand over; personName; Show 30 more; Updating · saved 7:52; Back walks the app; 44 px; 4.5:1; Big text. Rows marked "not needed" (the floating play button's room, the old compact headers, the old token set) go because the agent layout replaces them; their rules stay ("nothing hides under a fixed control", "one scale").
