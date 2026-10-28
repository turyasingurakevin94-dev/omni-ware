# Sales app design review: 90 boards

An independent review of the Sales phone app's design canvas (90 boards in `shots/`). Where a board has BEFORE and AFTER panels, the AFTER is judged. File names are cited as `NN_Name`.

---

## Scores at a glance

| Question | Score |
|---|---|
| **1. Ease of use for a non-technical, junior salesperson** | **5.5 / 10** |
| **2. Professional / premium look, overall** | **7 / 10** |

**Premium score by section**

| Section | Score | One-line reason |
|---|---|---|
| Today (incl. Find, Goal, Your day, You, Asked of Sourcing) | **6.5** | Good pieces, but there are three different Todays and the navy hero is still tall |
| Chats | **7.5** | Polished and familiar (it feels like WhatsApp), but the Team tab is a manager dashboard squeezed onto a phone |
| Sell (new sale, order, prices, counter) | **7** | Very well-crafted core screens, let down by three docks, two slide styles, mixed sheet colours and gimmicky success screens |
| Orders | **8** | The most consistent family: one sheet header, one stage bar, one paper, one action |
| Customers (incl. payments) | **6.5** | The new Tidy and Pay boards are strong; old-style boards (78, 80, 81) and the cash-register animation pull it down |

**In one paragraph:** the craft is real. The palette is restrained, figures are monospaced, the "paper slip" is a confident signature, avatars are tidy and spacing is generous. At first glance it looks like a well-funded fintech. The problem is **not** ugliness but **sprawl**. The set has too many words for the same thing, too many visual patterns to learn, and a "rule" that changes from board to board about which button is the next step (red, navy, green, white, slide, double-tap). Every board also tells you, in small grey text, who decides what. One board at a time looks premium. A junior who uses forty of them in a day meets an app that keeps changing its mind. This is exactly the owner's complaint that it is "overdone".

---

## 1. Ease of use: 5.5 / 10

### What already works (keep it)

- **One obvious bottom action on most task sheets.** Order detail (`60_Order`, `61_OrderDone`, `59_OrderBuying`) always ends with one wide red "Tell them…" button in the thumb zone. A junior learns "red at the bottom = what to do next" here, and it works.
- **The Tidy redesigns are a real simplification.** `19_NewSaleTidy`, `77_CustomersTidy`, `79_CustomerSimple` and `08_GoalTidy` all cut bars, legends and puzzles down to one figure, one search and plain rows. The BEFORE panels in those boards prove the team can diagnose overload.
- **Typo rescue** (`20_ClientNear`, `78_CustSearch`) and **"read as ×40"** search (`22_QFind`) are excellent for low-literacy users, who can type the way they speak.
- **Guard rails are in the right place.** Zero/negative count (`29`, `30`, `49`), 10× price (`42_PTooHigh`), short cash (`51_CShortCash`), offline (`55_COffline`). Each one keeps the user's input and says one short thing.
- **Tap targets on primary actions are generous** (52–56px buttons, 60px slides).

### The biggest problems, ranked by impact

**P1. Vocabulary sprawl: many words for one idea, and many ideas per screen.**
A junior must learn far more terms than the job needs. Examples taken straight from the boards:

| Idea | Words used across the boards |
|---|---|
| Customer owes money | Owes · owes · To collect · to take · Billed, not paid (`78`) · Who owes (`01`) · Owe (`77`) · Left to pay · still to pay · Balance due (`58`) · NOT PAID |
| Amount in dispute | in question (`01`, `77`) · being checked (`79`) · Doesn't add up (`81`) · Which is it? (`80`) |
| Price not known yet | price to confirm (`07`, `27`) · to price (`31`, `65`) · to be confirmed (`40`, `41`) · Quote · to be confirmed · priced at Checking (`07`) · BEING CONFIRMED (`58`) · lines to price, not counted yet (`01`) |
| Not in stock | bought in · shop checks for supplier (`31`) · WAITING FOR A SUPPLIER (`32`) · Not on our shelf (`45`) · out · short · Order in |
| Stock in stock | 412 on shelf · 412 free · 40 held · ON THE SHELF · on our shelf · From our own shelf |
| Order reference | Q-2402 · #0541 · #0550 · #0264 · INV-0605 (the house rule says **#0550**) |
| Stages | Checking/Buying/Packing/On road/Done today (`56`) · Delivered (`61`) · Asked/Looking/Found/Priced/Listed (`12`) · Sold › Paid › Invoiced (`53`) |

On top of that, each screen adds its own one-off concepts: "pace", "behind pace" and the % ring (`01`, `02`); "held" vs "free" (`22`, `46`); "floor" (`52_CAsk`); "deposit" vs "change" (`87`); "tests left out" (`01`); "armed" double-tap (`36`). Three to five new nouns per screen is too many for a junior with low literacy.

**P2. Text density: grey micro-lines carry too much of the meaning.**
Almost every row and sheet relies on an 11–13px grey line of facts joined by "·". Many primary buttons also carry a footnote:
- `82_AddCustTidy`: "Cash to start · Ruth sets credit · drafts stay kept"
- `40_PNoCost`: "They're told it's to be confirmed" plus "Denis: the cost › Ruth: if it's under the shop's"
- `16_SNoSell`: "The rest of Kato's order goes on as normal"
- `12`/`15`: "No order needed · you're told when it's listed"
- `70_MTellSend`: "Goes from the shop's number · the card leaves Today once it's sent"
- `73_XFix`: "You propose · nothing changes until they say yes"

With the phone's large text setting on, these lines are the first to break. Worse, the Tidy boards solve large text by **cutting off the important part**: "Good evening, Daphi…" and "Roof paint, mar…" (`01`, 360 panel), "Soft close hinge, f…" (`79`), "Omni-ware (old recor…" (`11`), "Kato Constructi…" and "Ggaba Stor…" (`17`), "Kyaligonza &…" (`69`). A customer or item name must never be the part that gets cut.

**P3. The "what do I press next" signal is inconsistent.**
The house rule is one red primary per screen. The boards use:
- **red** fill (most boards)
- **navy** fill for the main action: `40_PNoCost` "Quote · to be confirmed", `67`/`68`/`71` "Message Kato", `79` "Take payment", `20` "Sell to Kato", `27` "Add · price to confirm"
- **green** fill: `22` "Add · 1,528,000", `26`, `45` "Sell the 12", `49`
- **white** fill on navy: `35_QSwitch` "Move the 3 lines to Nansana"
- **two red primaries on one screen**: `69_MTell` ("Tell Kato on WhatsApp" *and* "Take the order"); `42_PTooHigh` (a red outline and a red fill, where the *safe* choice is the filled one)
- **red used as a warning**: the 0 field and error copy in `29`, the 9,000 price in `39`, "Too low"
- **slide with a red knob** (order, `21`) vs **green knob** (counter `47`, pay `84`) vs **green knob on navy** (`70`). Plus **double-tap OR slide** (`36_QArmed`).
- **slide used for sending a WhatsApp message** (`58_TellFound`, `70_MTellSend`), which is neither irreversible nor a yard action

A junior cannot form the habit "the red thing is the next step" when the next step is navy on one screen and green on the next, and red also means "wrong".

**P4. Too many visual patterns to learn.** Counted across the set:
- **Headers: 7 kinds.** Tall navy greeting hero (`02`, `69`); navy hero with 8-icon shortcut grid below (`01`); navy sheet header with stage bar (`57`–`66`); navy title + search header (`77`); light page title (`56`, `44`); dark "Who is it for?" sheet (`20`) next to the light one (`19`); no header, × + customer pill (`21`).
- **Quantity editing: 5 kinds.** Inline stepper in an expanded line (`21`); separate bottom sheet with a giant number and Done (`29`); stepper with red-ringed field (`30`); a tappable dark count tile you type into (`48`); round ± buttons beside a total (`47`). Plus "+40" pills (`22`) and "+2 box" pills (`18`).
- **Bars: 6 kinds.** Stage segments; stock bar with hatched shortfall (`23`, `26`); owed gradient bar (`84`, `85`); goal bar with a pace tick (`08`); % ring (`01`); split stacked bar (`09`, `56`); hatched "in question" stripes (`01`, `80`).
- **Cards: 5 kinds.** White rounded card; zig-zag paper slip; dark navy card on a light body (`18`, `24`, `44`); tinted notice card (amber `26`, green `14`, peach `80`); dashed "someone new" card (`20`).
- **Chips: about 8 kinds** (see section 2).
- **Success screens: 5 kinds** (see P8).

Each one is fine on its own. Together they cost a junior many hours to learn.

**P5. Decision rights leak into every sales screen.**
Ruth, Esther, Denis, Moses, Musa and Joseph appear as faces and names on most boards, with "decides", "settles", "raises", "checks it", "gets the price" and "sets the selling price" (`14`, `38`–`43`, `52`, `66`, `73`–`76`, `81`, `90`). The *fact* that something waits on someone matters to the salesperson. The *org chart* does not. `52_CAsk` even shows a "floor" price on a slider, which is a manager concept, not a salesperson's. `43_MUnder` shows "2,000 under cost" to a junior, which is margin information they should not need.

**P6. Today is the most-used screen and has three competing designs.**
- `01_TodayTidy` adds an 8-tile shortcut grid. It duplicates the tab bar (Chats), the red + (New order, Counter) and the Customers tab (Who owes), and adds two more ideas (Prices, Sourcing).
- `02_TodayCard` has no grid, one rich card and plain rows.
- `69_MTell` has two full-width rich cards with red buttons, then the rows.

The navy hero is still about 165–200px of a 844px screen before any work shows (`02`, `69`). This is the "big navy top bar" the owner dislikes. The figures in it (the "Invoiced · October" ring, "behind pace") are a manager's view, not a junior's.

**P7. Hidden or text-explained interactions.**
"tap one to change it" (`21`, `31`), "tap a price to change it" (`41`), "tap the orders they pay" (`85`), "one tap adds one" (`44`), "NOT PAID · tap to take payment" on a tilted rubber stamp (`57`; `62` later admits the stamp is "only decoration", so the two boards disagree), and Find's tiles that are secretly filters ("Tap a tile to search only there, tap it again…", `06`). When the interface has to explain how to use it in words, it is a sign the control isn't obvious.

**P8. End-of-flow screens are unpredictable and partly unreadable.**
- `37_Sent` and `72_MShelf`: confetti, grey "Order placed" text at low contrast on navy, and no visible button in the captured frame.
- `34`, placed panel: three buttons (Next sale / Open the order / Today).
- `53_CDone`: two buttons (Receipt / Next counter sale).
- `87`, success panel: Receipt / Done.
- `88_Paid`, `89_PReceipt`: a cash-register animation where neither the amount nor the receipt is readable in the frame.

The house rule is "one button with one label, the same on every screen". None of these follow it, and for a cashier the most important fact on `53` (the change to give back) competes with confetti-grade decoration elsewhere.

**P9. Small secondary targets.**
- Kind filters "Contractor / Reseller / Retail / New / Owes" in `17` are about 20px tall.
- "Let Brian" (`17`), "+ tag" (`17`), "Change" (`31`), "Edit" (`58`), "Open Q-2264" (`80`) and "Sell at the shop's price instead · 409,000" (`52`) are text links.
- The round ± on counter lines (`47`, `30` counter panel) look about 32px.
- The "All areas" dropdown (`77`) and "Ask Sourcing" link (`22`) are text-height.

These are fine for an experienced user, but fiddly for a junior on a cheap phone.

**P10. Money shown four ways.**
Full UGX on rows. Abbreviated "254k" / "1.01M" inside the payment toggle (`31`, `41`), which is a place the person acts on. Coloured by age on the Customers list (`77`: 290,000 red, 20,000 amber, 420,000 black, without the legend that was removed). Amber/coral "Owes" in headers (`80`, `81`, `90`) but white in `79`. A junior reads colour as meaning, so here the colour carries meaning that isn't explained anywhere.

---

## 2. Professional / premium look: 7 / 10

### Why it earns a 7

- **A coherent core palette.** Deep navy chrome, warm paper body, white cards, and one oxide red. It reads as expensive and calm.
- **Monospaced figures** with tabular digits make money look exact and bank-like.
- **The paper slip** (zig-zag edges, rubber stamps) is a memorable signature that makes "what the customer gets" instantly recognisable (`57`–`66`, `09`, `10`, `84`).
- **Good spacing and restraint** on the Tidy boards. White space is used confidently and nothing is boxed twice.
- **Real states are drawn** (offline, sending, error, success, large text). That is a professional habit.

### Why it is not an 8–9

The craft is high but the **system is not enforced**, so the set looks like several good designers' work rather than one product. There is also **ornament drift**: confetti, cash register, tilted stamps, hatched stripes, glow on red buttons, gradient knobs. Premium apps get their polish from consistency and restraint, not from effects.

### Strongest boards

1. **`56_Orders` / `64_OVoidWait`.** Stage tiles with counts, one stacked bar, grouped rows with one dark action icon. You understand the state of the business in two seconds. This is the best "visual first" screen in the set.
2. **`60_Order`, `61_OrderDone`, `59_OrderBuying`.** Sheet header, stage word plus segmented bar, the paper, one red action and a call button. Calm, consistent and confident. `59`'s delivery line with the truck is a lovely, functional touch.
3. **`84_Pay` / `85_PayPick`.** A huge clear amount, "what it clears" on paper, methods as three big tiles, and a slide. Premium and simple. (The owed gradient bar is the one weak element.)
4. **`77_CustomersTidy` and `79_CustomerSimple` (AFTER).** The best examples of simplifying without looking cheaper.
5. **`17_TeamChats` panels 1–3.** The WhatsApp-like familiarity is the right call for this audience. Avatars and kind tags are tidy.
6. **`22_QFind`.** Variant pills, a stock bar and one green "Add · 1,528,000". A dense but clear product card.

### Weakest boards

1. **`69_MTell` (Today with the price-change card).** Two red primaries, two oversized cards and a truncated row under the + button. It is the busiest screen in the set and it is the home tab.
2. **`80_CustResolve`.** This is the exact "bars, stripes and a puzzle" that `79`'s BEFORE panel criticises: a compare box, hatched bar, peach card and three button styles. It looks like an older system.
3. **`37_Sent`, `72_MShelf`, `88_Paid`, `89_PReceipt`.** Mostly empty navy with low-contrast text or a toy-like till. They read as gimmicks, not premium, and show no information in the frame.
4. **`52_CAsk`.** A slider with floor/yours/shop's markers, a timer, a two-step progress line, a locked slide and a text link, all in one dock. This is overdone.
5. **`20_ClientNear` and `35_QSwitch`.** Dark navy sheets in a flow the Tidy board (`19`) moved to light. Next to `19` they look like a different app.
6. **`82_AddCustTidy`.** A large preview card repeats the three fields shown right below it. "Add them in three" is clever copy but a junior won't parse it. The coloured icons with rings plus a glowing red button feel decorative.
7. **`17_TeamChats` panel 5 (Team).** Three bar-chart tables and a reply-speed histogram. Polished, but it is console analytics on a salesperson's phone.

### Inconsistencies between older and newer boards

| Element | Variants found (examples) |
|---|---|
| **Header** | Tall greeting hero (`02`, `69`, ~165–200px) · hero + shortcut grid (`01`) · sheet header + stage bar (`57`–`66`) · navy title + embedded search (`77`, and old `78` with bar and legend) · light page title (`56`, `44`) · dark sheet (`20`, `35`) vs light sheet (`19`) · no header (`21`) · navy header with 5 counters (`12`) |
| **Primary button** | Red (most) · navy (`20`, `27`, `40`, `67`, `68`, `71`, `79`) · green (`22`, `26`, `45`, `49`) · white-on-navy (`35`) · red with glow (`19` BEFORE, `82`, `13`) vs flat red (`66`) |
| **Secondary button** | White with ink border (`62`, `79`) · white borderless (`81` "Promise") · grey fill (`26` "Make it 45", `01` "Collect") · navy pill (`02` "Collect") · red outline (`42`) |
| **"Collect" on Today** | Grey pill (`01`) vs navy pill (`02`) for the same action |
| **Slide** | Red knob on navy (`21`) · green knob, green text (`47`, `84`) · green knob on navy (`70`) · red knob send icon (`58`) · double-tap variant (`36`) |
| **Cards** | White radius ~16 · paper slip · dark navy card on a light body (`18`, `24`, `44`) · tinted notice (`26`, `27`, `14`, `80`) · dashed (`20`) |
| **Chips** | Pastel status pill (`09` "Packing") · uppercase micro-label without a pill (`32` "ON THE SHELF") · dashed-edge chip (`27` "price to confirm") · person chip with dot (`43` "RN · Ruth sets…") · dark filter pill (`17` "Mine 6") · segmented tile (`77`) · "Read as ×13" token (`22`) · tilted rubber stamp (`57`, `60`) · tiny caps badge (`03` "TEST · NOT COUNTED") |
| **Money colour** | Ink (`79`) · red/amber by age (`77`) · amber "owes" (`20`, `81`) · coral (`80` header) · green "+" (`10`) · abbreviated k/M in toggles (`31`) |
| **Order ID** | Q-2402 (`21`, `57`–`71`) · #0541 (`01`, `65`) · #0550 (`06`) · INV-0605 used as the row ID in a list (`64`, `81`) |
| **Order dock** | `21` (total + Cash/Credit + Picture + Draft + slide) · `31`/`41` (LINES label + full-width segmented with k/M + slide) · `30` (total + small segmented + slide) · "Review" bar (`22`–`27`) · counter floating pill (`44`) |
| **Density** | Tidy boards: about 4 rows per screen, large type · `57`/`68`/`43`: 3 chip rows in the header plus inline chips on every line |

---

## 3. Suggestions

Every suggestion below is chosen so that it **reduces** what a junior must learn **and** keeps or raises the premium feel. Fewer, more consistent elements read as more expensive, not less. Nothing here adds colour, borders or effects.

### Do first (biggest gain, mostly redrawing existing boards)

**S1. Publish a Sales word list and redraw every board to it.** *(fixes P1, P10)*
Add these to `docs/audit/GLOSSARY.md` and apply them everywhere:
- **Stages (orders):** Checking → Buying → Packing → On the way → Delivered. Use the same five words on the tiles in `56`, the sheet headers and the Today rows. "Done today" becomes "Delivered today".
- **Stock:** "**12 on shelf**" / "**Order in**" (replaces bought in, shop checks for supplier, waiting for a supplier and not on our shelf) / "**Out**". Drop "free" and "held" from sales screens. Show the number the salesperson can sell.
- **Price unknown:** one phrase, "**Price coming**", with the person's face (replaces price to confirm, to price, to be confirmed, being confirmed and priced at Checking).
- **Money:** "**Owes**" (customer total), "**Paid**", "**Part paid**", "**Not paid**", "**Being checked**" (replaces in question, doesn't add up and which is it). "To collect" stays only as the Customers headline.
- **Order number:** "#0550" everywhere a person refers to an order. INV numbers appear only *on the invoice paper*.

*Premium effect:* fewer distinct tokens give a calmer, more editorial look. No visual cost.

**S2. One action system, applied to all 90 boards.** *(fixes P3, P8)*
- **Primary** = oxide red fill, 52px, one per screen, bottom of the screen. Redraw navy/green/white primaries (`20`, `22`, `26`, `27`, `35`, `40`, `45`, `49`, `67`, `68`, `71`, `79`) as red. The "Add" in `22`/`26` becomes red. Green stays a *state* colour only.
- **Secondary** = white fill + 1px ink border, same height. **Tertiary** = text button with a 44px hit area.
- **Red never means "wrong".** Errors use crimson ink on a crimson-soft field (`29`, `39`), never the oxide fill. In `42`, the safe choice "Make it 38,200" is the red primary and "Yes, 382,000" is a white secondary.
- **`69_MTell`:** only the *top* Needs-you item gets a red button. The second card collapses to a normal row with a light "Take order" button.
- **Slide** only for the three commits that move money or stock: *Place order*, *Record payment*, *Sell at counter*. Same look every time: navy track and red knob. Sending a WhatsApp message (`58`, `70`) becomes a red button "Send to Nansana". Delete the double-tap "armed" state (`36`). A single tap on the slide gives a small nudge animation and nothing else.
- **One end screen** for all flows: a white card on navy with the tick, the amount (28 mono), the customer, and the next state as a chip ("Checking", "Paid", "Change 1,000" in large type for the counter). One red button: "**Done**". The receipt is sent automatically and shown as a row inside the card, not as a second button. Confetti and the till animation run for at most 0.8s **over** content that is readable from frame one (`37`, `53`, `72`, `87`, `88`, `89`, `34`).

*Premium effect:* one predictable action colour and one end screen is what premium apps (banking, Uber) do. Removing the effects makes the moment feel confident rather than toy-like.

**S3. Make Today one design: compact.** *(fixes P6, P2)*
Use `02_TodayCard` as the base and change it as follows:
- **Header ≤ 120px:** greeting (20/700) and avatar on one 56px row. Below it, one quiet strip with two figures only: "**Sold today 3,184,600 · Money in 2,240,000**". Remove the ring, "pace" and "Invoiced · October" from the junior's home. They live in "Your goal" one tap away (`08` is already good).
- **Delete the 8-shortcut grid** from `01`. Everything in it is already a tab, the red +, or a Needs-you row.
- **Needs you:** one row style for everything (avatar/icon 40, name 16/600 on up to 2 lines, one 13px fact, one button on the right). The top item may expand into the rich card with the one red button. Every other row uses a white secondary button, never navy (`02` "Collect/Record" currently dark).
- Show "tests left out" only on days when test records exist.

*Premium effect:* a shorter navy band and an unbroken list looks more refined, answers the owner's complaint, and puts the work above the fold at 360px with large text.

**S4. Redraw the old boards to the Tidy language, or retire them.** *(fixes P4 and the premium inconsistency)*
- **`80_CustResolve`:** inside `79`'s layout, the disputed bill is one row with a "Being checked · Esther" chip. Tapping it opens a sheet with two large choice cards ("The same bill" / "Not paid yet") and one red "Ask Esther".
- **`81_R1AddsUp`:** use `79`'s header (white amount, not amber) and a single "Being checked" notice row. Replace the two comparison bars with two numbers side by side and the difference.
- **`78_CustSearch`:** use `77`'s header (no aging bar or legend).
- **`20_ClientNear` and `35_QSwitch`:** use the light sheet from `19`, with a light dock and a red primary.
- **`57_FoundOrder`:** remove "tap to take payment" from the stamp and add the real "Take payment" secondary button as in `62`.

**S5. Never truncate a name; trim facts instead.** *(fixes P2)*
- Customer and item names wrap to 2 lines.
- The grey meta line keeps at most **two** facts and drops the rest at large text.
- Re-check every board at 360px with large text. Today only 5 Tidy boards are drawn that way.
- Fix the visible truncations in `01`, `11`, `17`, `69` and `79`.

### Next (system consolidation)

**S6. Three header types only.** *(fixes P4, P6)*
1. **Tab page** (Today, Chats, Orders, Customers): navy, 56px title row, plus an optional single 64px figure strip, ≤ 120px total. Orders (`56`) moves to this to match the other tabs. Its stage tiles sit on the warm body below.
2. **Detail sheet** (one order, one customer, a payment): the `60_Order` header, ≤ 140px. Avatar, name, #ref, and the stage word plus a segmented bar. **At most one chip row.** `43`, `57` and `68` move their second and third chips into the lines.
3. **Task screen** (order builder, counter, new sale): light, × plus a context pill, with the navy money dock at the bottom.

**S7. One quantity control everywhere.** *(fixes P4, P9)*
Use `[–] [ 40 sheet ] [+]`: 44px buttons and a number field. Tapping the number selects it for typing; the unit sits under the number. Use it on the order line (`21`), counter line (`47`), return (`74`), ask Sourcing (`15`) and promise (`90`). Remove the separate qty sheet (`29`). Make the counter ± 44px, not about 32px.

**S8. One money dock.** *(fixes P4, P10)*
- **Order:** total (28 mono, full UGX, never k/M) + one segmented Cash | Credit +3% + the slide. "Picture to Kato" and "Keep as draft" go into a ⋯ menu or the review step, not the dock (`21`, `28`, `31`, `41`).
- **Counter (`47`):** keep method tiles. Show "They gave" only for Cash, default "Exact", with 3 quick amounts. Put the change in large type *only* when it is not zero.

**S9. Three chip types only; retire the rest.** *(fixes P4)*
- **Status chip:** 24px tall, 12/600 sentence case, soft ground and dark ink, optional dot.
- **Filter chip:** 40–44px tall, outline when off and navy fill when on.
- **Person chip:** 24px avatar, name and state ("Ruth · to say yes").

Retire uppercase micro-labels as status (`32` "ON THE SHELF / WAITING FOR A SUPPLIER"), dashed chips (`27`) and tiny caps badges (`03`). Rubber stamps stay as a *decoration* on the paper only; the payment state always also appears as a status chip.

**S10. One way to show money and age.** *(fixes P10)*
Money is always ink, mono and tabular. Age and urgency go in a small chip next to it ("66 d" in crimson-soft when over 60, amber when 30–60). This applies to `77`, `20`, `81`, `80` and `90`. Remove hatched stripes and gradient owed bars from sales screens (`01`, `80`, `84`, `85`). In Pay, show "Owes 420,000 → 0 after" as two numbers with an arrow.

**S11. Who-decides goes on the line, not in footnotes.** *(fixes P5, P2)*
When something waits on a person, show one person chip on that line ("Ruth · to say yes"). Delete the grey footnotes under primary buttons (`12`, `15`, `16`, `40`, `70`, `73`, `75`, `76`, `82`, `90`) unless they change what the salesperson does next. Remove "floor" and "under cost" amounts from sales screens (`52`, `43`). Say "Below the shop's price · Ruth to say yes" instead.

**S12. Controls should look like controls.** *(fixes P7)*
Order lines get a chevron or a visible ± so "tap one to change it" can be deleted (`21`, `31`, `41`, `85`). Find's tiles (`06`) become a row of filter chips with counts ("Chats 12 · Customers 214 …") and lose the explanatory sentence.

### Later (polish and scope)

**S13. Move analytics off the junior's phone.** `17` panel 5 ("Today side by side", reply speed) and parts of `11` (shop-wide figures) belong in the console for the Manager. On the phone, the Team tab shows only "Waiting now" with Take/Nudge.

**S14. Simplify `52_CAsk`.** The dock shows "Your price 34,000 · Shop's 35,650", the waiting person chip with a timer, and one secondary button "Sell at 35,650 instead". No slider, no floor and no locked slide.

**S15. Unify the surface tints.** Make the dark navy cards on light bodies (`18` WhatsApp lines, `24` "Kato buys from", `44` counter today) white cards with a category-tinted icon. Navy is reserved for chrome and docks.

**S16. `82_AddCustTidy`.** Drop the preview card and keep the three fields. Title: "New customer". Use one red "Save and sell" and a white "Just save". Remove the glow.

**S17. Keep the canvas's sample data consistent** (Kato's order total, the order IDs, the today figures) so reviewers and the owner aren't distracted by numbers that change between boards (`21` 1,883,000 vs `22` 355,000 for the same moment; `01` 13.4M vs `02` 24.8M).

---

## 4. The "simple and premium" rulebook (proposed)

One page every Sales screen must follow. Where the house design skill already sets a token (colour values, the type ramp, the 44px tap size), this rulebook uses it. It only adds the limits.

**Canvas**
- Design at **360px**, 16px side gutters, and check every screen with the phone's **large text** on.
- A screen is only done when it works at 360 with large text.

**Headers (three types only)**
| Type | Used for | Size | Contents |
|---|---|---|---|
| Tab | Today, Chats, Orders, Customers | 56px row + optional 64px strip, **≤ 120px** | Title 20/700, ≤ 2 icon buttons (44), optional single figure strip |
| Sheet | One order / customer / payment | **≤ 140px** | Avatar 40, name 18/700, #ref 13 mono, stage word 15/600 + segmented bar, **≤ 1 chip row** |
| Task | Order builder, counter, new sale | 56px, **light** | × (44) + context pill; navy money dock at the bottom |

**Surfaces (two only)**
- **Card:** white, the house card radius, one lift, 16px padding. Rows inside are separated by hairlines, never by boxes.
- **Paper:** the zig-zag slip, **only** for "what the customer gets / paid" (order lines, receipts, invoices).
- No dark cards on the light body. No dashed cards. A notice is one row with an icon and a soft tint; it is not a card.

**Rows**
- Minimum 64px (72px with large text).
- Avatar or icon 40px.
- Name 16/600, wraps to 2 lines and is never cut.
- One meta line, 13/400, **≤ 2 facts**.
- Right side: money **or** one button, never both plus a chip.

**Buttons (one family)**
- **Primary:** oxide red fill, 52px, 16/600. **One per screen**, in the bottom thumb zone. No glow.
- **Secondary:** white fill, 1px ink border, 52px (44px inside rows).
- **Text button:** ink or oxide-deep, 44px hit area.
- **Icon button:** 44px circle.
- **Slide:** 60px, navy track, red knob. **Only** for Place order, Record payment and Sell at counter.
- **End-of-flow:** one white card on navy with tick, amount, customer, next-state chip and **one red "Done"**. Motion ≤ 0.8s and never hides content.

**Chips (three only)**
- **Status:** 24px, 12/600, sentence case, soft ground and dark ink, optional dot.
- **Filter:** 40–44px, outline when off and navy when on.
- **Person:** 24px avatar, name and state ("Ruth · to say yes").
- No uppercase micro-labels for status. Stamps are decoration on paper only.

**Type sizes (from the house ramp)**
- 28 mono: the one hero amount
- 20/700: page title
- 16/600: row name / button
- 15: body
- 13: meta
- 12/600: chips and section labels (sentence case)
- **Nothing under 12.** At most four sizes visible on one screen.

**Colour**
- **Navy** = chrome and docks only.
- **Warm paper** = body.
- **White** = cards.
- **Oxide red** = the one next action (and the + tab), never an error.
- **Verdigris / amber / crimson** = state only, on chips and dots, never on a primary button.
- **Category tints** = icons only.
- Nothing else carries colour.

**Money**
- IBM Plex Mono, tabular, comma thousands, no decimals.
- "UGX" prefix only on the one hero amount.
- **Always ink.** Urgency goes in a chip beside it ("66 d").
- Never k/M on anything a person acts on. Abbreviations are allowed only on chart axes.
- Strikethrough only for "was → now".

**Status**
- An order shows **one stage word + one 5-segment bar** (Checking → Buying → Packing → On the way → Delivered).
- Payment state is one status chip (Paid / Part paid / Not paid).
- Waiting on someone is one person chip on the line it concerns.

**How much per screen**
- ≤ 1 hero figure
- ≤ 5 list rows above the fold at 360 with large text
- ≤ 1 notice
- ≤ 3 chip types visible
- 1 primary + ≤ 2 secondary actions
- **No grey footnote under a button** unless it changes what the person does
- No sentence that explains how to use a control

**Words**
- Use the Sales word list (S1). One word per idea.
- People's display names, never emails.
- Orders as **#0550**.
- Buttons are a verb plus an object ("Take payment", "Send to Nansana").
