# The supply side: closing the loop toward a trade platform

This document reviews the owner's proposal, a trade platform that brings clients, agents, suppliers
and advertisers together to simplify commerce, and plans its first missing piece: an interface for
suppliers. It builds on option 12 of `docs/margin-strategy.md` ("Become the demand aggregator") and
cites code the same way.

**Decisions taken before writing:**
- **v1 serves the shop's own suppliers**: the Kikuubo suppliers and importers already in
  `suppliers`, not an open marketplace.
- **The platform stays in the middle.** Buyers never see suppliers, and suppliers never see buyers.

---

## Where the loop is open today

Demand arrives from three directions:
- **client.html**: customers sign in with a phone and a shop-issued PIN (`0096_client_accounts.sql`).
- **agent.html**: commission-only resellers (`0012_sales_agents.sql`).
- **WhatsApp**: inbox, auto-quote and broadcasts.

Every channel ends up as one `saved_quotes` order. Each line on it is stamped with the supplier who
will fill it: `pickBestPriceRow` (`supabase/functions/agent-submit-order/index.ts:114`) takes the
cheapest in-stock `prices` row.

From that point on, **suppliers have no interface at all.** A person at the shop does every supplier
step for them:

| Step | How it happens today | Code |
|---|---|---|
| Confirm an order | Staff tap *Ask them*, WhatsApp opens with the supplier's lines, the reply comes back in chat, and staff tap *They confirmed* or *Problem* on the supplier's behalf | `supplierConfirmMessage` `index.html:63143`, `setOrderSupplierConfirm` `index.html:63061` |
| Keep prices current | Staff type them into the Price Registry, and price-watch chases stale rows | `prices`, `last_asked_at` (0075) |
| Prepare a pickup | A worker turns up at the stall with a list | `collection_trips` (0070) |
| Get paid | The supplier phones to ask | `purchase_invoices`, `suppliers.terms_days` (0106) |
| Consignment and commission | Known only to the shop | `stock_lots.consign` (0080), `supplier_commissions` (0020/0021) |

The confirmation tap matters more than it looks. It drives:
- the automatic move out of Draft (`orderLeaveDraft`, `index.html:63025`);
- the agent's "Checking k of n" tile (`lineSupplierCheck`, `agent.html:4848`);
- the agent's Pay gate (`agentOrderSuppliersConfirmed`, `shared-worker.js:2258`, and its server copy
  at `supabase/functions/agent-initiate-momo-payment/index.ts:187`).

**Closing the loop means the supplier makes that tap.**

---

## Part A: Review of the proposal

**The direction is right.** The demand network of agents, client accounts and WhatsApp quoting is
the one asset this shop has that is hard to copy (`margin-strategy.md` §12). Whoever holds combined
demand sets the terms. The supply side is where that leverage becomes a business: suppliers compete
for your order book instead of you shopping theirs.

Five corrections make it achievable.

### 1. Add one side at a time, each pulled in by value the existing sides already create

Four sides at once is four cold starts.
- **Suppliers come in now**, because the platform already sends them orders. They get paid faster
  and chased less.
- **Advertisers in this market are suppliers**: importers and brands. Supplier-funded sponsored
  items already exist (`agent_promotions.supplier_id`; UI at `index.html:38912`). So "advertiser" is
  first a capability a supplier unlocks, not a separate side to recruit.
- **Other shops come last.** This is the app as a product (option 13), which leads into the
  combined order book (option 12).

### 2. Stay the counterparty

Identical goods from identical suppliers make price the only variable (`margin-strategy.md` §3c).
If buyers can see suppliers, they go around you, and the platform shrinks to a fee nobody pays.

So the platform **buys from suppliers and sells to buyers**, and each side's boundary is enforced in
code:
- **Buyer side: already built.** See `client-portal/index.ts:10-28` and
  `agent-catalog/index.ts:1-10`.
- **Supplier side: the mirror image.** A supplier never sees the buyer, the sell price or margin, or
  another supplier.

### 3. Meet suppliers where they already are

Kikuubo traders live on WhatsApp, on a phone. The way in is **a link inside the WhatsApp ask they
already receive**, not an app to install or an account to create. The account comes later, once the
link has proved useful.

### 4. Design identity for many shops now, build it for one

Today a supplier is a row in one shop's address book (`suppliers(shop_id, id)`, `0001:64`). Supplier
logins should be keyed by normalised phone and linked to `(shop_id, supplier_id)`, as
`client_accounts` already is. One person can then be linked to several shops later, without a
migration that rewrites the books.

### 5. Measure the loop, using data that mostly exists already

| Measure | Source |
|---|---|
| Minutes from asked to answered | `supplierConfirms[sid].askedAt` → `.at` |
| Share of answers given by the supplier, not staff | new `by` field on the confirmation |
| Problem rate (fill rate) | confirmation `state` |
| Price freshness | `prices.last_asked_at` |
| Days bills are paid late against terms | `purchase_invoices` + `terms_days` |

Each stage below opens only when the previous stage's measure has moved.

---

## Part B: Platform roadmap

```
STAGE 1  Close the loop      The shop's own suppliers answer, price, prepare and get paid in the app
   │     gate: ≥60% of confirmations answered by the supplier, median answer < 30 min
   ▼
STAGE 2  Compete for demand  "Wanted" board: anonymised asks (sourcing_leads) and reorders go out
   │                         as requests for quotes; suppliers quote price tiers and lead time
   │     gate: sourcing leads filled by supplier quotes rather than staff research
   ▼
STAGE 3  Supplier-funded     Self-serve sponsored items (agent_promotions), placement in the client
   │     growth (advertiser) catalogue and WhatsApp broadcasts, rebate and commission statements
   │     gate: supplier spend > 0 without the shop having to sell it
   ▼
STAGE 4  Many shops          The app as a product for other shops (option 13); one supplier identity
                             across shops; combined order book (option 12); trade finance for
                             suppliers against confirmed orders; shared logistics
```

---

## Part C: The supplier side (Stage 1)

### C1. The loop, before and after

```
TODAY   order → staff tap "Ask them" → WhatsApp → supplier replies in chat → staff tap "They confirmed"
AFTER   order → staff tap "Ask them" → WhatsApp with a link → supplier taps Yes / changes a line
                                                             → board updates itself → agent's Pay opens
```

### C1a. The simple supplier app (`supplier.html`)

Three tabs: **Today**, **Prices**, **Money**. The order is the hero.

- **Order:** each line is *Have it* or ✕. Tap the price to change it. Swipe to send.
  - The answer goes out as confirmed, short (missing lines at 0) or none.
  - A changed price rides along twice: in the answer's note, which the shop sees on the order, and as a price proposal on the item. This works because order lines now carry `productId` and `variantIdx`.
- **Price check:** at most 3 cards a day, oldest first. Variants of one product at one price are a single card, so "Still the same" confirms them all in one `still` call.
- **Price editor:** price per piece and per carton, a "1 ctn has 20 dozens" picture, and volume tiers behind "Cheaper for many?". The shop approves every price before it is used.
- **Money:** owed and due bills, bill receipts, goods at the shop, paid records.
- **Sign-in:** phone plus a 4-digit PIN from the shop. There is no sign-up.
- **Offline:** answers, prices and stock flips are queued on the phone and sent when data returns.

Not built yet, because nothing in the backend supports them: telling the supplier the shop took the answer, the rider's arrival time, the payment reference and photo upload.

### C2. Identity and access: mirror the client portal (0096) exactly

- **New migration `supabase/migrations/0132_supplier_accounts.sql`** creates three tables:
  - `supplier_accounts`: primary key `(shop_id, supplier_id)`, `phone` stored as the last 9
    digits, `pin_hash`, `pin_expires_at`, `pin_attempts`, `status` and `last_seen_at`.
  - `supplier_sessions`: token hash and device, the same shape as `client_sessions`.
  - `supplier_answer_links`: a one-tap token per order and supplier. Holds `token_hash`,
    `order_id`, `supplier_id`, the `terms` signature and `expires_at`.
- **RLS:** admins manage these tables, and **no policy grants a supplier anything**. Every read
  goes through one service-role function. The migration is safe to run twice, like every migration
  here.
- **Accounts are created by the shop, never by signing up.** The owner presses *Invite to portal*
  on an existing supplier and a PIN goes out over WhatsApp. The shop asserts the link once, which is
  the same reasoning as the header of 0096.
- **Edge functions:**
  - `supabase/functions/supplier-accounts/index.ts` issues and revokes PINs, modelled on
    `client-accounts`.
  - `supabase/functions/supplier-portal/index.ts` is modelled on `client-portal`. Response objects
    are built literally, key by key, and no table row is ever spread into a response.
  - Both are added to `supabase/config.toml` with `verify_jwt = false`, beside `client-portal`.

### C3. The boundary: what never reaches a supplier

These are enforced by tests in the style of `client-portal.test.js`:
- **The buyer.** `client_name`, `client_phone`, the agent, the customer, and any of that customer's
  history.
- **Sell side money.** `sellPrice`, `agentSellPrice`, markup rules and margin.
- **Other suppliers.** Their names, their prices, the other `sourcing_leads.candidates`, and
  `rival_prices`.
- **Other lines** on the order that are not theirs. `supplierConfirmMessage` already sends only the
  supplier's own lines, for the same reason.
- **The shop's position.** Its stock levels and the other suppliers' share of its buying.

### C4. Answers live in their own table, never written into the order

The owner app re-reads the shop every 30 seconds and saves `saved_quotes.payload` row by row
(`pollForUpdatesNow`, `index.html:174471`). If a server function wrote `payload.supplierConfirms`
directly, the next owner-side edit to that order would save the owner's copy over it, and the
supplier's answer would be gone without anyone noticing.

So answers land in **`supplier_answers`**:
- **Columns:** `shop_id`, `order_id`, `supplier_id`, `state`, `terms`, `note`, `at`, and
  `changes[]`, which holds per-line edits as `{lineId, price?, qty?, none?}`.
- **Owner app.** After each load it folds new answers in through the existing
  `setOrderSupplierConfirm`, marked `by: 'supplier'`. Auto-advance, the toasts and the agent hold
  all keep working unchanged.
- **Agent side.** `agentOrderSuppliersConfirmed` (`shared-worker.js:2258` and
  `agent-initiate-momo-payment/index.ts:187`) reads `payload.supplierConfirms` merged with any
  `supplier_answers` row whose terms still match. An agent's Pay therefore opens even while the
  owner app is closed.
- **A yes goes stale when the order changes.** It is signed with the same signature as
  `orderSupplierTerms` (`index.html:62985`). The helper is copied into the function and pinned
  character for character by a parity test, the house pattern from `client-submit-order.test.js`.

### C5. Price changes are proposals; out-of-stock is a fact

- **Price changes.** A supplier changing a price, or answering an ask at a different price, creates
  a proposal (`supplier_price_proposals`, migration 0110). The owner accepts it in the Price
  Registry. Every catalogue and both submit functions re-price from `prices`, so nothing upstream
  moves without an owner tap. This is the "nothing sends itself" law.
- **Out of stock.** The supplier sets `prices.out_of_stock` / `out_of_stock_since` directly. It is
  their own fact, and it immediately stops `pickBestPriceRow` routing new orders to them.
- **Answers with changes** show on the owner's confirm panel as **Accept their terms**. That one tap
  edits the lines and confirms them.

### C6. Supplier screens: a new `supplier.html`, phone-first and visual-first

- **Look and feel:** the ow-design tokens with the phone column of the two-designs law (≤820px
  cards, 44px top bar, 60px tab bar), plus a desk layout at ≥1024px for importers who work at a
  computer.
- **Boilerplate:**
  - The `OW_ENV` block is copied byte for byte; `test/environment-switch.test.js` checks this.
  - `manifest-supplier.json` lets the page install as a web app.
- **Mockups are made with `/design`** before any code (step M0). The wireframes below only fix what
  is on each screen.

**The answer screen** opens from the WhatsApp link with no PIN, and only for that one ask.

```
┌──────────────────────────────┐
│ A99 TRADE CENTRE · asked 12m │  ← who's asking: the shop, never the buyer
│ ▓▓▓▓▓▓▓░░░  answer by 11:00  │  ← time bar, not a sentence
├──────────────────────────────┤
│ [img] Cement Tororo 50kg     │
│  20 Bag   @ 37,000     ✓ ✎ ✕ │  ← per line: yes / change price or qty / none
│ [img] Steel nails 3"         │
│  15 Kg    @ 7,800      ✓ ✎ ✕ │
├──────────────────────────────┤
│ 417,000 to you               │
│ [  Yes, all available  ]     │  ← the one primary action
└──────────────────────────────┘
```

**The signed-in tabs:**

| Tab | What it shows |
|---|---|
| **Today** | Three tiles: *Waiting for you* (count), *Pickup today* (count) and *Owed to you* (UGX). A due-date bar split into overdue (crimson), due within 7 days (amber) and later (neutral). An 8-week sparkline of what this shop bought from them. One primary action: answer the oldest ask. |
| **Asks** | Open and recent confirmations on a state timeline: asked → answered → collected → paid |
| **Pickups** | `collection_trips` addressed to them, with a stepper: assigned → on the way → collected → checked in. Shows the worker's name and a **Get ready** packing list. |
| **Money** | Bills laid out on a due-date timeline from `terms_days`, and payment history. Consignment as a stacked bar per item: sold and owed / on the shelf / returned. Commission statement from `supplier_commissions`. |
| **Prices** | Their `prices` rows, each with a freshness ring for days since confirmed and a one-tap out-of-stock toggle. *Propose a new price*, and *Confirm all still correct*, which refreshes `last_asked_at` in one tap. Sorted by how often the shop asks for each item. |

### C7. Owner-side changes (`index.html`)

- **Suppliers screen** (`renderSuppliers`, `index.html:82042`): a portal chip per supplier showing
  Invite, Active (with last seen) or Suspended. It mirrors the client-accounts admin UI.
- **`supplierConfirmMessage`** (`index.html:63143`): appends the one-tap answer link and mints its
  token.
- **Confirm panel:** a "by supplier · 09:12" mark on answers that arrived by themselves, and
  **Accept their terms** for answers that came with changes.
- **Price Registry:** a queue of incoming proposals with old → new difference chips and
  Accept / Decline buttons.
- **Load path:** `supplier_answers` are folded in after `loadData`.

### C8. Build order (each step ships on its own)

| # | Step | What it delivers | Measure |
|---|---|---|---|
| M0 | Mockups with `/design`, then owner review | Answer screen, Today, Asks, Pickups, Money and Prices, at phone and desk widths | Sign-off |
| M1 | One-tap answer link | 0132 (links and answers), `supplier-portal` actions `link` and `answer`, the answer screen, the link in the message, folding answers into the owner app, the agent-side merge | % answered by supplier; minutes to answer |
| M2 | Accounts, Today and Money | PIN sign-in, bills, due dates, consignment, commission | Weekly active suppliers |
| M3 | Pickups | Trips with the Get ready list | Wait at the stall |
| M4 | Prices | Out-of-stock toggle, proposals (0110), the owner's queue | Price freshness |
| M5 | Wanted board (the start of Stage 2) | Anonymised open `sourcing_leads`: the item, the quantity and how many customers asked. Suppliers quote price tiers and lead time, which land in `candidates`. | Leads sourced by supplier quotes |

### C9. Files the build will touch

**New**
- `supplier.html`
- `manifest-supplier.json`
- `supabase/migrations/0132_supplier_accounts.sql`
- `supabase/migrations/0110_supplier_price_proposals.sql`
- `supabase/functions/supplier-portal/index.ts`
- `supabase/functions/supplier-accounts/index.ts`

**Modified**
- `index.html` (the functions in C7)
- `shared-worker.js` (`agentOrderSuppliersConfirmed` reads the merged answers)
- `supabase/functions/agent-initiate-momo-payment/index.ts`
- `supabase/config.toml`

**Reused rather than rewritten**
- `orderSupplierGroups`, `orderSupplierTerms` and `setOrderSupplierConfirm`
  (`index.html:62957-63119`)
- The client-portal PIN and session code, copied, because functions here are deployed by pasting
  one file at a time
- `contactPhones`, `waComposeUrl`, `receiveQuoteLine`, and the consignment helpers
  (`index.html:125266`)

**New tests**
- `supplier-portal.test.js`: the boundary, meaning no forbidden keys and no row spread
- `supplier-portal-terms-parity.test.js`
- `supplier-answers-fold.test.js`
- `supplier-accounts-admin-ui.test.js`
- `supplier.html` added to `environment-switch.test.js`

### C9a. Build status

Shipped (the supplier's side, end to end):

| Piece | File | Notes |
|---|---|---|
| Tables | `supabase/migrations/0132_supplier_accounts.sql` | Accounts, sessions, answers and proposals in one migration (0110 folded in). |
| Portal function | `supabase/functions/supplier-portal/index.ts` | Sign in, Today, order answer, products, price and stock, add and new item, money, consignment, insights, pickups, partnership, profile. `verify_jwt = false`. |
| Admin function | `supabase/functions/supplier-accounts/index.ts` | `list`, `open`, `reissue`, `suspend`, `restore`, `revoke`. Admin JWT only. |
| App | `supplier.html`, `manifest-supplier.json`, `supplier-sw.js` | Matches the canvas screens. `?demo` runs it on sample data with no backend. |
| Tests | `test/supplier-portal.test.js`; `supplier.html` added to `environment-switch.test.js`; `functions-jwt.test.js` | The boundary, terms parity with `orderSupplierTerms`, verbatim helpers, the PIN. |

The owner's side (C7), built into the existing screens rather than as new pages:

| Where | What was added |
|---|---|
| A supplier's account (Suppliers → a supplier) | A **Supplier app** panel: their status, Invite / Issue a new PIN (shown once, with Send on WhatsApp), Sign out their phones, Suspend / Let them back in. |
| The supplier book | A **Waiting for a new PIN** strip, shown only while someone is locked out or tapped "Forgot PIN?". Each row's details line names their app status. |
| An order's **Confirm with suppliers** panel | Answers from the app fold in on load and on every 30-second refresh. "Have all" at the current terms settles the row, marked "Confirmed in the supplier app". "None" and "short" are recorded as a problem with their words. A short answer offers **Accept their terms**, which cuts the lines. An answer to an older version of the order is shown, not applied. |
| Price Registry → Quotes | A **From suppliers** queue above the strip: new prices, still-correct checks, offers to supply, and new items. Each has Accept / Decline (with an optional note), plus Accept N safe ones. A new item is marked done after it is added under Products. |

Pinned by `test/supplier-owner-ui.test.js`.

Not yet built:

- The one-tap answer link inside `supplierConfirmMessage`, and WhatsApp templates.
- The Wanted board's live data (`sourcing_leads`). Until then the screen shows sample data in demo
  mode and "Coming soon" when signed in.

### C10. How the build is verified

1. `npm test`, `node test/design-system.test.js`, and the new boundary and parity tests.
2. End to end on staging (`docs/environments.md`, `.github/workflows/staging.yml`):
   1. Invite a supplier.
   2. Ask them about an agent's order.
   3. Open the link at 390px and answer *Yes*.
   4. Within one 30-second poll, the owner's board should move the order out of Draft and the
      agent's Pay should open.
   5. Edit a line and check that the answer goes stale.

## Part D: Trust and partnership

The screens in Part C let the supplier tell us things. Part D is about us proving things to the
supplier. Suppliers in Kampala hold back from a new buyer for three reasons:

1. **Will my goods be lost or damaged?**
2. **Will I be paid, and on time?**
3. **Will anyone tell me what is going on?**

Totals don't answer any of these. Evidence does. The mockups are row 5, "Trust & partnership", of
the Omni-Ware Supplier App design canvas.

### D1. Gaps today

| Fear | What the portal shows | What is missing |
|---|---|---|
| My goods | Consigned totals, sold against on the shelf | Proof of receipt, stock counts, a damage policy, a way to get goods back |
| My money | Amount owed, ageing, next payment | Payment references, receipts, our on-time record, a way to query a bill |
| Being told | The order request | A message for every stage of an order, an inbox, message preferences, replying from WhatsApp |
| Partnership | Sales and agent counts | A two-way scorecard, a reward for reliability, signals about what to stock |
| Personal | Initials | A business profile, a named contact at Omni-Ware, staff roles, language |

### D2. Recommendations, in priority order

**Tier 1: proof**

| # | Feature | Builds on | Needs |
|---|---|---|---|
| 1 | **Goods-received receipt** after every pickup: a photo at our store, sent against counted per line, who counted it and when, and "That's right / I sent N" when a line is short | `collection_trips.lines` (ordered against received) | Photos for each trip; a goods-received record the supplier can answer |
| 2 | **Rider handover code.** The rider's name and plate, plus a 4-digit code the supplier reads out, so the handover is provable on both sides | `collection_trips` statuses | Code generation and a check in `shared-worker.js` |
| 3 | **"Your stock with us"** for each consigned item: a received / sold / on shelf / damaged bar, the last count with a photo, a dated history, damage shown openly as our loss, and **Request a return** | `stock_log` (`count`, `damaged`), `stock_lots.consign` | Count photos; a record type for **returns to the supplier** (none exists) |
| 4 | **Payment record:** "Paid on time 11 of 12", each payment with its MoMo or bank reference and a receipt, and a monthly statement as a PDF | `supplierStatementRows`, `supplierStatementSheet`, `suppliers.terms_days` | Payout reference fields on supplier payments |
| 5 | **Query a bill:** reason, then a tracked status with a promised reply time | `purchase_invoices` | A small `supplier_queries` table |

**Tier 2: partnership**

| # | Feature | Builds on | Needs |
|---|---|---|---|
| 6 | **Two-way scorecard.** Theirs: fill rate, reply time, how current their prices are. Ours: paid on time, pickups on time, how fast queries are sorted. **Reliability earns faster payment**, for example 21 → 14 → 7 days | `suppliers.terms_days`, `supplier_answers` (M1) | A scheduled rollup of scores |
| 7 | **Demand signals:** next week's expected orders, and items agents ask for that the supplier doesn't list, with one-tap Add. Counts only, buyers stay private (C3) | `sourcing_leads`, order history | A simple 8-week forecast; extends M5 Wanted |
| 8 | **Get paid early** for a fee (later, Stage 4 trade finance) | Payment terms | Finance partner |

**Tier 3: personal**

| # | Feature | Needs |
|---|---|---|
| 9 | **A named contact at Omni-Ware** (photo, WhatsApp, call) | A field on `suppliers` for the account manager |
| 10 | **Business profile:** pickup place and hours, and payout details that are **locked** (changing them needs a call-back from Omni-Ware, to stop fraud) | Payout details on `suppliers` |
| 11 | **Staff roles:** the owner sees everything; a storekeeper confirms orders only | A `supplier_staff` table, with the 0132 session carrying the role |
| 12 | **Language** (English or Luganda) and **quiet hours** | Preference columns |

**Tier 4: communication**

| # | Feature | Builds on | Needs |
|---|---|---|---|
| 13 | **WhatsApp at every step**, as utility templates: the order request (**Have all / Some short / None** buttons), pickup with rider and code, goods received, payment sent with reference, price check (**Still correct**), price approved or declined, and a Monday summary | `wa-send`, `wa-webhook`, `wa_messages` | Supplier templates, and handling of **interactive button replies** in `wa-webhook` (it ignores them today) |
| 14 | **Inbox** in the app: every message, unread state, a link to its screen | Same message rows | A view over supplier messages |
| 15 | **Preferences:** a grid of message type by channel (WhatsApp, app push). Order requests are always on | FCM push in `notify-worker`, `agent_push_subscriptions` pattern (0103) | `supplier_push_subscriptions` and preference columns |

### D3. Where it fits in the build order

- Items 1, 2, 4 and 13 (receipt, handover code, payment record, WhatsApp set) go with **M2 and
  M3**. They are what make a supplier trust the first pickups.
- Items 3, 5, 9 and 14 follow straight after M3.
- Items 6, 7, 10, 11, 12 and 15 go with **M5**.
- Item 8 waits for Stage 4.

### D4. Data gaps in one place

1. Photos for trips and stock counts: a private storage bucket, as `bill-photos` (0100) does.
2. A goods-received record that the supplier can confirm or dispute.
3. A record type for returns to the supplier.
4. Payout references on supplier payments.
5. `supplier_queries`.
6. `supplier_staff`, with roles.
7. Supplier WhatsApp templates and button-reply handling in `wa-webhook`.
8. Supplier push subscriptions and message preferences.

None of these weakens the C3 boundary. Every new screen shows only the supplier's own goods,
money and counts.
