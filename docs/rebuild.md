# The rebuild — standing goal

**A new front end, built cleanly from a written spec, on the database we
already have. Role by role, each new app replaces its old one only when it
is clearly better.** Kevin set this goal on 2026-10-28.

## Why this way

| Option | Verdict |
|---|---|
| Keep editing the old apps | Months of moving code around to end with the same screens. The old shape keeps pulling back. |
| Start over, database too | Throws away the part that is right (169 migrations, one-write money, decision rights in the database) and risks the shop's real books in a data move. |
| **New front end, same database** | Clean design from line one; the old tests and audit lessons carried over through the spec; the old app stays as a fallback. |

## Done looks like

| Measure | Today (2026-10-28) | Done |
|---|---|---|
| Biggest source file | `index.html`, 181,049 lines | under 1,000 (aim 200–500) |
| Phone role apps, all together | ~73,000 lines in 11 files | ~15,000–25,000 lines in small files |
| Functions copied into 2+ apps | 552 names, 13,679 duplicate lines | 0 — each rule lives once |
| Copies that disagree | 250 (35 touch money) | 0 — one rule, decided by Kevin where they differ |
| Where the rules are written | in the code, in six places | `docs/spec/`, one place, with the test that proves each |

## The rules

1. **One database.** The new apps use the same Supabase project, tables,
   server functions and decision rights. Never a copy. Database changes go
   through `supabase/migrations/` as now.
2. **Spec first.** `docs/spec/` says what the system does. Build to it. A rule
   found in old code that is not in the spec is added to the spec first.
3. **One role at a time.** The next role starts only when the last one has
   replaced its old app.
4. **The old app is frozen while its new one is built.** Urgent fixes only, no
   new features; otherwise everything is built twice.
5. **Leave alone what works and rarely changes**: Owner, Worker, Supplier, and
   the console for now.
6. **Small files.** No source file over 1,000 lines (aim 200–500).
   `test/file-size.test.js` guards it.
7. **Plan for the shop we have** (one business, two shops, a few dozen staff),
   not for scale nobody has.

## The phases

- [x] **0. Guardrails.** This file, CLAUDE.md pointing at it, the size guard,
      the baseline below.
- [ ] **1. The spec** (`docs/spec/`). 01 and 02 decided 2026-10-28. From the existing system: the order's
      journey, money, roles, screens, data, offline and pushes. Kevin reviews
      each chapter.
- [x] **2. The stack.** One page in the spec (chapter 07); Kevin approves.
      Decided 2026-10-28 (`docs/spec/07-stack.md`): TypeScript, Preact with
      signals, esbuild (not Vite), one built page per role committed as today,
      each new app tried at `/next/<role>.html` first; Supabase and Capacitor stay.
- [ ] **3. The shared core.** Money (one rule each, Kevin's answers below),
      data and offline sync, log in, the screen parts. The old money tests are
      ported as its checks.
- [ ] **4. Role apps, one at a time**, to the approved canvases: **Sales first**
      (Kevin, 2026-10-29: the Sales canvas in the agent app's language,
      `docs/canvas/sales-agent/`), then Store, Buyer, Manager, Accounts. Each is tried on a preview link,
      then its role switches over; the old app stays one release as fallback.
- [ ] **5. Later, if ever:** Owner, Worker, Supplier, Agent, the console.

## Backend fixes decided (2026-10-28)

Kevin's answers to the spec's questions (`docs/spec/01-order-journey.md` §5,
`docs/spec/02-money.md` §8) that make the **database** check a rule the apps
checked alone. They protect the books whichever app is in use, so they come
**before** the shared core. Each takes a migration number reserved in
`docs/decision-rights.md` and a test run against a real database (`OW_PG`).

- [x] Moving a stage needs `order.move`, and only to an allowed next stage (journey Q2) — `0173`, `test/stage-move-db.test.js`
- [x] The Checking gate checks suppliers' yes, lines with no supplier, agent prepay (journey Q1) and debt past the hold days (money Q8) — `0174`, `test/checking-gate-db.test.js`
- [x] `credit.release`, `pick.settle`, `credit_note.raise` checked on the writer (journey Q5); only `price.approve` changes a price decision (journey Q12) — `0175`, `test/manager-decisions-writer-db.test.js`
- [x] A void and a credit note are each one database write (journey Q6) — `0176` `void_invoice`, `raise_credit_note`; `test/void-credit-one-write-db.test.js`
- [x] One "Cancel" by the Manager: `status = 'cancelled'`, stock put back, the Store and Sales pushed (journey Q7, Q8; builds the `order.cancel` row) — `0177` `cancel_order`; `test/cancel-db.test.js`
- [x] No line priced below cost, except given away (money Q16) — `0171`, `test/no-sale-below-cost-db.test.js`
- [x] Agent order total counts charges (money Q14) — `0172`, `test/agent-total-charges-db.test.js`

**Putting them live.** One script, `docs/live/apply-0171-0177.sql` (made by
`tools/build-live-sql.js` from the migrations; `test/live-apply-0171-0177.test.js`
runs it on a database made from 0001-0170). In the live project's SQL editor:

0. **First, `docs/live/which-migrations.sql`** (read-only): which of the
   repo's migrations live is missing. On 28 Oct it found 0120 partly in and
   0153 and 0158 missing: `docs/live/catch-up-before-0171.sql` brings those
   level (0120's missing pieces only, never 0120 whole: later migrations
   changed it). After it, the query names only the fixes.
1. **Step 1** alone: read-only. Stops with a plain message if live is missing
   anything the seven are built on, or if a function they change was edited
   by hand. Says which of the seven are in already.
2. **Step 2**: read-only. Lists what staff will notice. Tell the Manager first:
   "next" now waits for suppliers' yes, a customer owing past 21 days waits
   for a Release, and an order selling under its cost waits at the bill.
3. **Step 3**, BEGIN to COMMIT in one go: all seven or none. Safe to run twice.
4. **Step 4**: every row says ok.

No edge function changes. The Manager app's credit-note fix reaches the
phones when this branch is merged to main.

Everything else decided there is a front-end rule: the shared core builds it
once, and the old apps are not changed for it (they are frozen).

## Retire list

Each role's old page goes once its new app has taken over, so the repo never
keeps two versions of an app. `test/retire-list.test.js` reads this table:

- once a role is **switched**, its page at the root must be the built one
  (first line `GENERATED from src/`), and the date it must be gone by must be
  filled in, at most 30 days after the switch;
- after that date, the old copy (`old/<role>.html`) must not be in the repo;
- after the switch, a test that still reads the role's page must say it reads
  the built page (a comment `reads the built <role>.html`); the old app's tests
  go with the old app;
- nothing in `src/` reads an old page.

Fill in **Switched** and **Old gone by** in the commit that switches the role.

| Role | Page | Switched | Old gone by |
|---|---|---|---|
| Store | `store.html` | — | — |
| Sales | `sales.html` | — | — |
| Buyer | `buyer.html` | — | — |
| Manager | `manager.html` | — | — |
| Accounts | `accounts.html` | — | — |

Goes with the old Sales page: **the old page's native layer** (`sales.html` lines 9–213: Back,
the strip behind the clock, the bars' size, the live update). The phone app now ships the new
app, whose own layer is `src/apps/sales/shell/native*.ts`; the old copy stays only while the old
page is the live fallback, frozen, and is deleted with it, never fixed as a second rule.

## Baseline (2026-10-28)

Source lines per app file: `index.html` 181,049 · `agent.html` 17,391 ·
`sales.html` 11,252 · `sourcing.html` 9,704 · `accounts.html` 7,039 ·
`manager.html` 6,398 · `store.html` 6,296 · `buyer.html` 6,168 ·
`owner.html` 4,333 · `client.html` 2,051 · `supplier.html` 1,663 ·
`worker.html` 1,196 · `shared-worker.js` 2,447 · `sourcing-console.js` 2,255.

## Log

- **2026-10-28** — Goal set. Phase 0 done: this file, CLAUDE.md rules, the size guard.
- **2026-10-28** — Plan changed to a new front end on the same database. Spec chapters 01 (the order's journey) and 02 (money) written from the code, checked, and decided by Kevin: 31 questions answered. The answers that need the database are listed under "Backend fixes decided".
- **2026-10-28** — First backend fix: no sale below cost (`0171`). Checked the old apps first: Sales and the Manager refuse a typed price under cost; a line also comes under cost when the Buyer takes a dearer supplier price, which they hold for the Manager. The database now refuses the first (OWCST) and never bills the second (OWPRC), until the Manager prices it or gives it away. Found on the way: the server's gate does not hold an untagged under-cost line in Checking (0153 only pushes) — left for the gate item (journey Q1).
- **2026-10-28** — Second backend fix: an agent order's total counts its charges (`0172`). `order_shop_total` counted goods only while its three edge-function twins count goods + charges, so on an order with a delivery fee mobile money marked it paid early and the agent's credit could not pay the fee (every plan refused as "changed"). Tested on a real database; the same test fails on the old rule.
- **2026-10-28** — Third backend fix: moving a stage needs its task (`0173`). Every move the apps make was traced to its task first: the Buyer leaves Checking with `supplier.confirm`, the Store moves with `stock.receive`, `order.load` and `order.deliver`, so `order.move` alone would have stopped them; each move takes `order.move` or that role's own task. Skips (other than the Manager's "mark done"), unknown stages and moves on invoiced or voided orders are refused.
- **2026-10-28** — Fourth backend fix: the Checking gate checks what only the Buyer app checked (`0174`). The Manager's "next" skipped suppliers' yes, lines with no supplier and agent prepay; now no app moves an order past them. Old debt (past 21 days) holds an order that adds to it as a credit hold, aged as the apps age it. Not added (not decided): the Buyer app's hold while an agent asks to change or cancel (`agentOrderOnHold`), and a line selling under its cost (found in fix 1; it is refused at the bill).
- **2026-10-28** — Fifth backend fix: the Manager's answers are checked on the writer (`0175`). Only the Manager app writes them today; no server function does. The Buyer app clears a price decision when a dearer supplier price leaves no margin; the database now does that itself (Kevin's Q12), and refuses any other change by anyone without `price.approve`, so the frozen Buyer app keeps working.
- **2026-10-28** — Sixth backend fix: a void and a credit note are each one write (`0176`), for the new apps to call; the old Manager app keeps its several calls (frozen). Found on the way: the Manager app asks for a credit-note number with the kind `'creditNote'`, which `next_row_id_blocks` refuses (it takes `row:…`; the console uses `row:credit_note`), so raising a credit note from the Manager app failed before it wrote. Fixed (Kevin approved the urgent fix): `manager.html` asks for `row:credit_note`.
- **2026-10-28** — Seventh backend fix: one Cancel (`0177`); every backend fix decided is now built. Stock moves only at the invoice, so "stock put back" is the yard's own step: the push tells them, and the Store screen already shows it. Not built: Sales asking for a cancel, and billing goods that came in before a cancel (such an order is refused, as the Manager app refuses it today).
- **2026-10-28** — The seven backend fixes as one live script (`docs/live/apply-0171-0177.sql`): prerequisites, preview, one transaction, check. Tested on a database from 0001-0170, run twice, on one missing 0169 (stops first), and on one with a hand-edited function (stops first; forced, leaves nothing).
- **2026-10-28** — First live try: step 1 stopped before writing anything — live does not have `0153` (the push to the Manager when a dearer supplier price puts a line under its sale). Added `docs/live/which-migrations.sql` to list everything live is missing in one go; tested that 0153 goes in on its own on top of 0154-0170 and that the script then passes.
- **2026-10-28** — `which-migrations.sql` on live: 0120 partly in (no `push_outbox.claimed_at`, `.delivered`, `ow_push_claim`, which `push-send` calls to take its rows), 0153 and 0158 missing (so the Manager app's "no" to a carton and its customer-change push fail on live). `docs/live/catch-up-before-0171.sql` (made by `tools/build-catch-up-sql.js`) adds them in one transaction; tested on a database shaped like live, twice, then the fixes on top.
- **2026-10-28** — After the catch-up, step 1 stopped on the void guard: live's `saved_quotes_sales_guard` is not 0122's. `docs/live/void-guard.sql` (made by `tools/build-void-guard-sql.js`) names which repo version live has by its fingerprint (0113, 0116 or 0122) and puts 0122's in place; a guard nobody in the repo wrote is refused and left alone. With 0113's or 0116's on live, only the owner could void an order.
- **2026-10-28** — Live's void guard is 0122's word for word, with Windows line ends (`\r\n`): pasted from Windows. 0174 and 0177 change functions in place by matching their lines, so they now read a function without its carriage returns; step 1 of the live script does too. Tested with live's guard and every script pasted with `\r\n`.
- **2026-10-28** — **Live.** In the live SQL editor: the catch-up (0120's missing pieces, 0153, 0158), the void guard put back to 0122's, then `apply-0171-0177.sql`; step 4 said ok seven times. One order was in Checking, #0556, a test record, held for credit. Still to do: tell the Manager what changes, and merge this branch so the Manager app's credit-note fix reaches the phones.
- **2026-10-28** — The three old failing database tests fixed: the shared-foundation scenario gives its moved orders their suppliers' yes (0174) and pays its counter sale with a receipt (0165); the Manager's-decisions and money-at-the-gate scenarios write as the Store app does, through `receive_trip` and `store_patch_order` (0164). The last one showed a live regression from fix 3: `store_patch_order` lets a `staff` (yard worker) login load and deliver, and 0173 refused them. `0178` lets the yard's own moves through for `store` and `staff` logins, as 0164 does. Pasted on live the same day (checked: the rule names `staff`).
- **2026-10-28** — Phase 2: chapter 07, the stack, proposed. Measured first: the phones ship one page and update by swapping it, Vercel has no build step, CI tests install nothing and Node 22 runs TypeScript as it is, today's pages are 192–266 KB compressed. Proposed esbuild over Vite (the dev server is for a terminal nobody here has), and committed built pages so nothing that ships changes. Four questions for Kevin.
- **2026-10-28** — Retire list added, with `test/retire-list.test.js`: an old page goes within 30 days of its switch, its tests with it, and new code never reads it — so v3 never sits beside v2.
- **2026-10-28** — Phase 2 done: Kevin approved chapter 07 as proposed (all four answers yes). Next: phase 3, the shared core.
- **2026-10-28** — Spec chapters 05 (data) and 06 (offline, sync, pushes) written from the database and the apps. Found on the way: a `staff` (yard worker) login can read the cash book and customers' debts (only `store` is kept to its functions); 8 pushes reach an app with no page for them; the Manager's "kept on this phone" invoice is held only in memory. 19 questions for Kevin.
- **2026-10-28** — Kevin took every recommended answer in chapters 05 (§8) and 06 (§7); both decided. 05 Q1 and Q2 built now as `0179`: a `staff` (yard worker) login is refused the 21 money and customer tables the worker app never reads, and `staff` holds the yard's tasks (`order.pick`, `order.load`, `order.deliver`) in `decision-rights.md` and `role_tasks`. Still open to a worker: an order's prices and payments in `saved_quotes`, closed when the worker app reads through a stripped function as the Store does. 06 Q10 (stock-count pushes go to the Manager, not the owner) and the eight pushes with no page (Q9) are built by the new apps. Test: `test/staff-privacy-db.test.js`.
- **2026-10-29** — Kevin moved **Sales ahead of Store**: the new Sales app is built in `src/apps/sales/` to the approved canvas "Sales — in the agent app's language" (149 boards, every one scored at least 8.5 by an independent audit; source in `docs/canvas/sales-agent/`), tried at `/next/sales.html`; `sales.html` stays frozen as the fallback. Phase 3's shared core (build, `src/core`, `src/ui` parts from the canvas's LANGUAGE.md) is built first, for Sales. Proof per board: `docs/audit/sales/CANVAS-PARITY.md` (board beside app at 360 × 800, reached by taps from Today in a demo seeded with the canvas's FACTS.md).
- **2026-10-29** — The new Sales app's two missing server paths (05 §9 Q6, Q7). `0180` `place_order` (quote.make): Sales places an order in one write instead of an id call plus a direct insert; the insert is the phone's own, so 0119's gate, 0165, 0167, 0171, 0173, 0174, 0175 and the pushes all still judge it as the caller; the server writes the number, date, times, who took it, nothing paid and the shop's Credit charge pct, and a draft's key places it once. `0181` Sales' ask for a cancel (`cancel_asks`; new task `cancel.ask`): `ask_cancel` on your own order before the bill, `withdraw_cancel_ask`, the Manager pushed (`order.cancel.ask`) and answering with `answer_cancel_ask` (yes is 0177's `cancel_order`; no is logged and pushed back, `order.cancel.ask.decided`); an order called off another way or invoiced first closes its ask. `src/core` places and asks through them, the demo the same way. Tests: `test/place-order-db.test.js`, `test/cancel-ask-db.test.js`. Found on the way: 0017's `sync_saved_quotes_id_seq` takes a `nextval` on every order insert, so each order, however placed, uses up two numbers (#0701, #0703 …) — left as it is (not decided). The Manager app has no page for the ask yet.
- **2026-10-30** — Page budget: the Sales tabs came to about 30 KB compressed each, so six would not fit in 80 KB. Kevin chose to fold each tab's copies of a part into `src/ui` first, raise the budget to 200 KB (still under today's pages), then load each tab when first opened (spec 07 §4).
- **2026-10-30** — Sales Today, critic round: no send is claimed unless it happened (no chat: an error, nothing marked told). Ask photos (`sourcing_leads.image`, 0074) and item photos are sent. Alerts are this phone's real `push_subscriptions` row (`DataSource.pushState/pushOn/pushOff`), and big text is applied at start. Find's "Say it" uses SL34's listening sheet, now the shared `src/ui/Listen.tsx`. The rules the boards fitted are written once each in spec 04 §4. `core/money.ts` `promiseState` (Q10), `core/owing.ts` `owedBy` (Customers keeps another copy: open question, spec 04 §4.2), `Books.aisles`. Every Take pays named `bills`, and Play all runs in order (`then`).
- **2026-11-04** — Sales: all six tabs merged into one app (`claude/cool-edison-i2d22t`). One rule, one place, at merge: an order entered twice (`core/orders.ts` `twinOf`, 5 minutes; Q11), a paid-over payment (`money.ts` `paidOver`), likely notes (`likelyNotes`, FACTS' rule on Take payment too; CU35–CU37, CU41, CU42 corrected; Q12), the rhythm and last order (`core/customers.ts`), who owes (`core/owing.ts`, the server's `ow_customer_balance`: opening balance plus open bills, a checked bill shown apart, `debt` in a Take), the search (`core/find.ts`, Sell's; the closest needs a word of letters), often-with, late in stage, the listening sheet (`src/ui/Listen.tsx`). Every seed extra runs idempotently; Kato's lines serve every board (CH21 corrected). One CSS prefix per tab, guarded by `test/sales-css-prefix.test.js`. The page is 220 KB compressed, over its 200 KB budget, so `next/` stays at its last good build and `build-app.test.js` is red until the parts fold and per-tab loading, which are next.
- **2026-11-04** — Sales loads each tab when first opened (spec 07 §4, Kevin's step 3 first). The page (`next/sales.html`, 104.9 KB of 200) is the shell, `src/ui`, `src/core` and Today; Chats, Sell, Counter, Orders and Customers are their own files (25–36 KB each, 60 KB budget), taking every shared module from the page, so nothing ships twice and there is one store. They load quietly after the first paint; a tap that gets there first shows the loading state (P25), and no signal says so with Try again. One build id ties page and tabs; `sales-sw.js` keeps them together on the phone; the phone app's build carries the files the page names (`<meta name="ow-files">`), and its live update must fetch them beside the page (spec 07 §4) when the native layer moves into the new page. `build-app --check` checks every file. Customers opens Orders' "entered twice" sheet through `callTab`. Parity on TD01, TD05, CH01, SL05, KC01, OR07, CU10, CU30 unchanged.
- **2026-11-04** — Sales: a tapped push opens its page (spec 06 Q8, Q9). One map, `src/apps/sales/shell/pushes.ts`: the 16 kinds the migrations send to a salesperson, each to a ROUTES.md id from the push's own data (an order's `orderId`, an ask's `quote`, a chat's or customer's `id`, `request.listed` to `today/asks`; `payment.ask.decided` names only the ask, so the copy finds its order, else its customer, else the day's money); a push without its id opens its list. `shell/open-push.ts` opens it at once from the phone's copy and reads behind it, from the phone app's tap (Capacitor `pushNotificationActionPerformed`), the web's (`sales-sw.js` `notificationclick`: the open window is handed the push, else `sales.html#push=…`) and the demo's (`?demo&push=<kind>&<key>=<value>`). §6b: `order.cancelled`, `order.cancel.ask.decided`, `customer.changed` and `trip.short` now open in Sales. `test/sales-push-routes.test.js` pairs every kind in the migrations with the map, ROUTES.md and §6b; `test/sales-push-open.test.js` lands an order, a chat and a customer push (demo, no signal, web, phone) with no console error. No migration.
- **2026-11-04** — Sales parts fold, step 1 (shared fixes + Counter). Shared fixes: the sheet grab is hidden from a screen reader (the × is its close); the FullSheet back strip has a 44 px hit area; one `ClearButton` and one `MicButton`, each 44 × 44 (the boards draw five disc sizes, kept as a prop: canvas tidy-up); the light Search's focused look; `WhoPill still`, `FullSheet shadow`, FaceStack's first face on top. Counter's local parts are now `src/ui`: LineCard (`OpenLine`, `LineHead`, `PriceChip`, `OnShelf`; Stepper `bin`), Slide `lock` and its sending look, the dock (`Dock amber/tight/above`, `MethodPicker dim`, `TheyGave`, `RefField`, `Notice under`, `FailCard`), `Steps` (Track.tsx) and `EndOfFlow moves/bar`.
- **2026-11-04** — Sales end to end: `npm run e2e:sales` (`test/e2e/`, also in `npm test` as `test/sales-e2e.test.js`, about 35 s) runs 11 flows on `next/sales.html?demo` from Today by taps (a slide is a real drag) at 360 × 800: sell, counter cash and mobile, take payment (and kept with no signal), tell from Today and from an order, chats with CH14's Start order, give, and something wrong (return, payment fix). Each fails on a console error, a page error or a screen wider than the phone, and lists every button or link under 44 × 44. Three flows fail on real bugs, left red: an order's Tell (OR10) sends Kato the new price but Today still asks to tell it (`orders/Tell.tsx` never marks told); Placed for an unnamed buyer says "Picture sent to They" and "They leaves when paid" (`sell/Placed.tsx:66`); a payment fix asked of Esther (OR25) shows nowhere once its toast goes, and the same payment can be asked about again (`orders/Wrong.tsx`). The demo cannot regain signal mid-run, so a kept payment's send is not covered.
- **2026-11-04** — Sales: the three e2e findings fixed; `npm run e2e:sales` passes all 11 flows. An order's Tell that carries Ruth's new price marks it told when sent (`msg.ts` `tellsPrice`, and one rule for a price not told yet, `core/orders.ts` `priceUntold`, which Today, Chats, the order view and the demo now share). Placed names a buyer with no name by the chat's number ("Picture sent to 0701 552 904"). A payment fix asked of Esther shows on its bill as OR22 shows a return (OR32) and its row in Which payment? waits, not a link (OR33): two new boards, drawn and scored before they were built, parity 0% and 0.01%. The demo seed's two asks on Kyaligonza's 14 Oct payment (10:12, from CH01's "Esther is checking it") are gone: no screen read them before, and once the bill showed an ask they shut OR25. Open question for Kevin: CH01's 10:12 words against OR24/OR25, which draw the payment not asked yet.
- **2026-11-04** — Sales: the order's paper. The Receipt tile opened a blank screen (it sent an order id to `customers/paid`, since 773583f9). It now opens `orders/receipt { id }` (OR34–OR37, drawn and approved by the critic before they were built): KC16's slip on KC16's grid (`orders/local-slip.tsx`, to fold with the counter's into one src/ui part), "as it stands" from the order screen's own `pendingOf` (`view.ts`), Send on WhatsApp through `sendImage` that tells a new price (Q17), Share and Save image on a shut chat, and a walk-in's phone field. Also built: OR32/OR33 as approved; an ask card names who asked (Undo on your own only); the merge of `claude/cool-edison-i2d22t`. Parity OR32–OR37 0–0.01%; e2e tell-order sends #0559's paper and checks it told the price.
- **2026-11-04** — Sales parts fold, step 2 (Chats). The chat's composer is the one `src/ui/Composer.tsx` (note, shut, listening; the old S01 drawing on Main2 is replaced: canvas tidy-up); the chat's sheets are `LightSheet` (`extra` beside the ×); the wait ring is `RingAvatar` (a face or none, `badge`); the chips are `FilterChip snug`.
- **2026-11-04** — Sales parts fold, step 3 (Orders). `local-OrderRow`, `local-CheckList`, `local-Track` and `local-Parts` are gone: OrderRow's status takes a chip, the came bar and a tick, its act an icon (`duo`); `ShowMore`, `CustOrderRow` and `OrderPill` live in StageGroup.tsx; CheckList takes the order's marks (Ruth's face, "2 back", the dashed disc), a struck old figure, a word after it, counted pills and a picture under a row; Track and StageDots take skipped stops; ActBar is a button unless it goes somewhere, with the order's tones; MoneyTiles take the old figure on its own line, a waiting dot, a struck figure with its pill and a tap; the navy Search's typed look (`onClear`); the step lists are `AskStep`.
- **2026-11-04** — Sales parts fold, step 4 (Today, and the nothing-found mark). Today's hero is the one `Hero` (Find, the note, goal hit in proportion, compact with its `GoalStrip`); its rows are `ActRow chip` and `MiniRow` (a second line, a face stack); `SubHead`, `TitleHead`, `FaceStack max` and `PLAIN` are shared; its light sheets are `LightSheet` (`titleSize`, the progress dots as `extra`); the lens ticked is the `found` icon. The nothing-found mark is one `NoneMark` (Today, Counter, Sell, Chats). Sell's unit buttons (kg · ctn · pc · box) are 44 × 44 with no pixel moved.
- **2026-11-04** — Sales parts fold, step 5 (Customers). No `local-*` file is left in Sales. The customer row is the one `CustomerRow` (the Take disc, a chip, the figure's word or note, a sub in a tone, the ring's start); the list's heads and cards are `GroupHead` and `GroupCard`; the rings are `RingAvatar` (`start`, `big` for the sheet's head); the week is `WeekStrip` (`dots`); the amount field is `AmountInput` (PayMethod.tsx); Take payment's waiting slide is `Slide lock quiet`; the sheet's acts are `ActBar` (tones take and promise, icons 20); the hard hat is an icon.
- **2026-11-04** — Sales parts fold, step 6 (the slip). KC16's receipt slip and the order's paper (OR34–OR37, `orders/local-slip.tsx`) are one `src/ui/Slip.tsx` (`Slip`, and `SlipHead` for the light head over it); `slip.css` and the head rules of `paper.css` and `receipt.css` are gone. KC16 and OR34–OR37 stay at 0.
- **2026-11-04** — Sales final-audit fixes, three batches (verdicts 06bc69c9, 83fb52cf, be3bfda4). Orders/Customers: Sell again carries the order's own lines; the door photo opens (`Order.deliveredPhoto`, `DataSource.deliveryPhoto`, 0111's bucket); SMS records nothing; one plural rule (`core/names.ts counted`); New customer safe while loading and never saved without 9 digits; Customers' Take is `takeWithHeld`. Today/Chats: faces spaced by series (Avatar `PLAIN`), TD05's chip opens CU12 (`openBillChecked`), the chats filter kept in the route (`nav.keep`), the price sheet back to +, the sheet grab drawn only. Sell/Counter: every figure follows the count at once; one unpriced rule ("Price coming", `ui/Money.tsx`); clean kinds; the counter's Say it is `ListenSheet`. Board corrections listed in the commits (content and odd-ones-out only).
- **2026-11-05** — Sales canvas parity done. SL41 (Cutting, one price) drawn, scored 8.5+ by the independent critic in round 3, and built; a pickup at the gate shows no arrival time (`isPickup`); no line shows 0 for a missing price; accessible names follow the boards. The fresh final auditors re-checked every tab on the merged app: Today 27, Chats 29, Sell 41, Counter 29, Orders 36, Customers 36 and the two parts boards, 200 of 200 passed. `docs/audit/sales/CANVAS-PARITY.md` lists all 200 with screenshot, verdict and taps; `npm test` 499/499, `e2e:sales` 11/11 with no console errors, design-system and decision-rights pass. Canvas republished (200 boards). The old `sales.html` stays the live app until Kevin switches the phone build.
- **2026-11-05** — The Sales phone app ships the new app (`claude/cool-edison-i2d22t`, not merged; the switch for every phone is Kevin's, after he tries the APK). The native layer moved into the page, `src/apps/sales/shell/native.ts` (Back, the strip, the bars' size, the live update; `native-back.ts`, `native-bars.ts`, `native-update.ts`), inert in a browser and the demo. Back is a sheet, then a screen, then Today, then the background; it never exits. The screens start under the clock (`--app-top`, `--app-bottom` in the tokens: 0 on the web, so the boards hold). The live update fetches the page and every file its `ow-files` names from beside it on the server, all or nothing, each of the page's build, and switches only when the app goes to the background; **it refuses any page that is not a build of the new app** (no build id or no `ow-files`), so the APK never turns back into the old app by fetching today's live `/sales.html`: until the root page is the built one, it stays on what it shipped. A copy the old layer staged without its tab files is fetched whole once. `apps/sales/scripts/build-www.js` packages `next/sales.html`, its tab files and the demo (fonts 400–800, the local Supabase client, `transform.js`, the native marker; no CDN left); the workflow builds on `next/**` and `src/**`. The phone app skips the service worker. The old page's native layer is on the retire list. Tests: `test/sales-native.test.js`, `test/sales-phone-app.test.js`.
- **2026-11-05** — Sales on Kevin's phone (APK from 34274b29, a Huawei with Android's own opaque status bar). Three fixes. (1) **The band at the top**: Android laid the WebView out below its bar while Capacitor still reported the bar, so every screen kept 25 px of `--app-top` and a strip over the heads. One rule in `native-bars.ts` (`barsPlan`): the page is inside a bar when the screen's height less its own is at least that bar, and then `--app-top` is 0 and there is no strip; edge-to-edge phones keep the inset; the 32 px stand-in only ever on a page that fills the screen. A strip, where needed, is navy #16203C under a navy head (a gradient's ground, not its glow). The chat's Undo toast now makes room for `--app-top`. (2) **The tab labels**: slots are fixed and, under the phone's text zoom, the labels are held at 12 px (`src/ui/tabfit.ts`); the APK holds textZoom at 130% at most. At 100% the boards hold, so "Customers" still sits 3 px from the edge as TD01 draws it: **open question for Kevin** — 8 px from the edge needs the canvas's P16 changed (padding 8 px each side, slots 62 px; every tab-bar board moves by up to 6 px). (3) **Real data**: "Still to collect" and "earlier" draw at most 4 faces then "+n" (TD16/TD17 draw 4); `FaceStack` counts its own "+n"; sheets and the chat can no longer scroll sideways; bars cap at 100% (`barW`: a goal passed 7×, a debt over its limit); long figures and keys wrap instead of running off; the order rows clip their status, the rail's "On the road" may take two lines. `&state=stretched` (30 owe, 20 paid, 20 live, 12 chats, long names, 9-digit amounts) and the e2e flow `fit` at 360 × 800, 130% text and a 24 px bar: no page wider than 360, labels in their slots, nothing under the bar, no words off the screen or over other words.
- **2026-11-05** — Sales: the late re-judgement's fails, then Kevin's "remove the rough edges" (the hunter's 34 items, `rough-edges.md`). **Re-judgement:** OR05's paper never shows 0 for a line with no price (one rule, `ui/Money.tsx` `isPriced`/`PRICE_COMING`, also on Placed, the order picture, the counter's receipt, OR12's ladder and the counter's price field) and says "As it stands · Ruth decides N prices" while one waits; the slide is one control named by its words (`knobLabel` gone); SL01's strip is decorative again, on the board too; KC01/KC03/KC07/KC18/KC27's `&quot;` and KC14's Back to Today fixed on the canvas (to republish); OR38PickupGate drawn (approved: false, not built). **Rough edges, at their source in `src/ui`:** a figure inside words keeps whole while the words give way (`util.tsx` `Keep`: the slide, the who-pill, the toast); a toast's words give way so Undo stays on the screen; docks set the page's room from their real height (`--dock-h`, `Dock.tsx`, Sell's own dock too), and with the keyboard up for a field above a dock the dock sits at the end of the page (`ui/keyboard.ts`); a sheet's top is drawn in proportion (on a short screen it never starts past the bottom); rows that ran under a pill or off the screen wrap (check list, order rows, the pay chips, the Pays switch, heads, the chat's unsaved number, sheet heads take two lines); one bar past eight lines; a chat bubble breaks a long link; the wait line spreads its faces and says "+n" past three in one place; Mine's count (the head's and the chip's) is exactly what Mine lists, this week's (CH01's 6; Kevin's "Mine 2" over an empty list), with words when it is empty; presence is written as the old app wrote it (`touch_presence` every 20 s, typing every 8 s; `shell/presence.ts`); `short()` says 1M and 1.4B; plurals through `counted`/`plural`; "chat shut · today"; a missing figure reads "not known"; the owed key never says "Take 0" and takes the hold from the settings; `orderNo()` everywhere. `&state=stretched` is now the hunter's shop (150 customers, emoji and long names, 9-digit bills, 25 lines on #2999, 40 chats) and `&state=one` one of everything. **Kept as checks:** `npm run e2e:sales:room` walks every board's taps at 320 × 640, at 130% text, and with the stretched shop at 130%: no page wider than the phone, no money figure cut, nothing under a dock or the keyboard, no target under 44 (the 320 px exceptions named: Due's and a promise's seven days, an aisle card's units). **Open for Kevin:** the tab labels' 8 px needs P16 changed on the canvas (padding 8 px each side); the owed key's "Take" (past the hold) and the rows' "to take" (any bill) are one word for two things on CU01, a canvas wording change; at 320 × 640 the counter's "Sold most today" draws only the rows that fit above the dock (KC01's rule).
