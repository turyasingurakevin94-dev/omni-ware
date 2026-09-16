# Brief for Claude Design — the rail map

Omni-Ware is a wholesale hardware shop in Uganda. One owner, a phone in a yard in
daylight, and a computer on a desk. Every figure on screen is money that is really
theirs.

You have already designed three parts of its redesign: `design_handoff_dashboard_today/`
(Today), `design_handoff_quote_page/` (Quote) and `design_handoff_sell_section/`
(Invoices, Customers, Agents, Messages). This brief is about the one element that
appears in all eight frames of that last bundle and cannot be built from it: **the rail**.

---

## What I need back

1. **A rail artboard**, 236 × 900, in two states: Sell expanded (as the four Sell frames
   already draw it) and one other group expanded, so the collapsed-to-open transition is
   settled.
2. **The final membership of all six groups**, as a list of rows, with the count each
   group's collapsed header shows.
3. **For every row that disappears: the argument.** What is lost, what absorbs it, and
   which words people search by still reach the work — the same three-part form as the
   cuts in the Sell bundle, which is the part of that handoff I found most useful.
4. **A decision on Order tracking** (see *Open question 1*).

No new visual system is needed. The rail's appearance is already specified to the value
and restated below; what is missing is **which rows are in it**.

---

## The problem

The Sell frames draw a rail that this app does not have. The frames show:

| Group | Frames draw | The app has |
| --- | --- | --- |
| Sell | 5 | 7 |
| Buy | 2 | 3 |
| Catalogue | 5 | 6 |
| Money | 4 | 8 |
| Insight | 5 | 6 |
| Setup | 3 | 3 |
| **Total** | **24** | **33** |

Nine rows have to go somewhere. The Sell bundle argues four cuts — and **two of them do
not land**, because they describe screens this app does not have.

### Cut 1, "Invoices absorbs Statements" — does not land

The argument is that a statement is "a document produced from rows this screen already
holds — one customer's invoices, the payments against them, and the balance that falls
out", re-drawn under a second filter bar.

That describes a **customer statement**. This app's `Statements` row is the **financial
statements** — profit and loss, balance sheet, cash flow. Its own search keywords are
`profit loss balance sheet cash flow accounts`. Deleting it would take the accounts with
it.

The customer statement you describe already exists, and already lives exactly where you
propose putting it: `customerStatementBlockHTML()` renders it inside the customer's
record, built from the debt log rather than from the invoices, because deriving it from
both would count every credit sale twice. It has its own test pinning that decision.

**So that cut is already done, and the row it names is a different screen.** I have not
deleted it.

### Cut 2, "Agents absorbs Commissions" — does not land

There is no Commissions screen. No `tab-commissions`, no `renderCommissions()`, no rail
row. Commission is shown to agents in the *agent* app, and reconciled by a test. The admin
side has never had a screen for it.

The **Supplier bonus** block you designed into the agent panel is still worth building —
it surfaces a figure that currently has no home on the admin side. But it absorbs nothing,
so it does not remove a rail row.

### The two that do land

- **Customers absorbs Debtors.** Exactly as argued. `renderDebtorsList()` and
  `renderCustomers()` both exist and must be called together after every void or payment;
  this is a real synchronisation bug waiting, not a tidiness argument.
- **Messages = WhatsApp + Follow-ups.** Both screens exist and the merge is sound.

**Net: Sell 7 → 6, Money 8 → 7. Thirty-one rows, not twenty-four.**

---

## The app, completely

Every row in the rail today, with what it actually is. This is the material to cut from.

### Today
| Row | What it is |
| --- | --- |
| Dashboard | The day. Already redesigned as Today. |

### Sell — 7
| Row | What it is |
| --- | --- |
| New quote | Build a quote. The act. |
| Order tracking | A stage board — quoted → packing → out. Recently redesigned; its dialogs are one object. |
| Invoices | Sales and purchase invoices in one register, as two lenses (`invSide`). Merge already done. |
| Customers | The people who buy. Carries the customer statement block and the debt-drift check. |
| Follow-ups | Who you owe a word, tagged with a reason (`fupWhy`). Already absorbed Chase debts and Worth telling. |
| Sales agents | Agents, their orders and the four prices an agent line carries. |
| WhatsApp | The message box and the broadcast. |

### Buy — 3
| Row | What it is |
| --- | --- |
| Compare prices | Which supplier is cheapest for a given item. |
| Sourcing | Items a customer asked for that the shop does not stock yet. A funnel. |
| Suppliers | The people you buy from. |

### Catalogue — 6
| Row | What it is |
| --- | --- |
| Products | The catalogue and its variants. |
| What goes with what | Pairings — what is bought alongside what, and in what ratio. |
| Price registry | What you paid, what you charge, tiers, and rival prices as a lens. |
| Inventory | Stock on hand, with the movements log as a lens (`invLens='moves'`). Merge already done. |
| Media | Photo library. |
| Fastener guide | A conversion reference — mm/inch, thread pitch, spanner sizes. |

### Money — 8
| Row | What it is |
| --- | --- |
| Cash book | Money in and money out. |
| Consignment | Goods held that are not yours. |
| Pricing | Markup and margin rules; thin lines and dead stock as lenses. Absorbed Margin and Clearance. |
| Debtors | Who owes you, ranked by amount. **→ becoming the Customers Owing lens.** |
| Creditors | Who you owe, ranked by amount. |
| Statements | **Profit and loss, balance sheet, cash flow.** Not customer statements. |
| Payroll & rent | Wages, salary, rent. |
| Assets & loans | Equipment, vehicles, depreciation, borrowings. Absorbed Loans. |

### Insight — 6
| Row | What it is |
| --- | --- |
| Forecasts | What the shelf will need, against the cash line. Absorbed What to buy (`fcLens='stock'`). |
| Manager | Advice and strategy. Also a phone tab-bar slot. |
| Analysis | Charts — margin quadrant, demand breadth, cash bridge, leakage. |
| Sales analytics | Demand trends, best sellers. |
| Purchase analytics | Spend by supplier. |
| Map | Where customers and deliveries are. |

### Setup — 3
| Row | What it is |
| --- | --- |
| Staff | Employees and users. |
| Worker view | The shop-floor pick-and-pack screen. |
| The shop | Presets, categories, units, locations, defaults. |

---

## Open question 1 — Order tracking

The Sell frames draw no Order tracking row, and the bundle's note says Sell is
"Quote absorbing Saved quotes". But this app's Order tracking is not a saved-quote
archive: it is a **stage board** that moves an order through quoted → packing → out, and
it was redesigned two commits ago with its dialogs unified into one object. The top bar
in your own Invoices frame carries its three stage chips — `12 quoted`, `5 packing`,
`3 out` — so the frames already assume that board exists somewhere.

Does Quote absorb the board, or does Sell keep six rows? If it absorbs it, I need to know
what happens to the stage board itself: a lens on Quote, a strip on Today, or something
else. **Please do not answer this by deleting the board** — moving an order through its
stages is the one thing in Sell that is neither a document nor a list.

## Open question 2 — the remaining rows

After the two cuts that land, the rail is 31 rows. The frames draw 24. Either:

**(a)** argue the remaining cuts — in which case each one needs the three-part form, and
the counts in the frames stand; or

**(b)** redraw the rail with honest counts — Sell 6, Buy 3, Catalogue 6, Money 7,
Insight 6, Setup 3 — and the eight Sell frames get their rails corrected.

Either is a real answer. I would rather have (b) than a cut invented to hit a number:
a rail that hides work is worse than a rail that is long, and the app's own rule is that
the rail is the complete map with nothing behind a menu.

### What the code suggests, for you to judge

Not decisions — things the shape of the code shows that are hard to see from outside.
Each is an observation with its evidence; whether any of them is a cut is yours to say.

- **Creditors is the exact mirror of Debtors.** `renderCreditorsList()` exists alongside
  `renderDebtorsList()`, and Suppliers exists alongside Customers. If a debtor is a
  customer with a balance, then a creditor is a supplier with a balance, and the same
  argument — one list, two renderers, a synchronisation bug waiting — applies unchanged.
  This is the single strongest candidate, and it is one row.
- **Insight holds four screens that all read the same books.** Analysis, Sales analytics,
  Purchase analytics and Forecasts. Analysis already carries margin, demand and cash
  charts; the two analytics screens are a sales cut and a purchase cut of the same data,
  which is the shape of a lens rather than a screen. Worth up to two rows.
- **Two screens carry pricing.** Price registry (Catalogue) is what you paid and what you
  charge; Pricing (Money) is markup rules, thin lines and dead stock. They are in different
  groups and neither name says which.
- **Compare prices and the Price registry's rivals lens** both answer "who is cheapest".
- **Media is a photo library**, and the Posting lens you designed treats a missing photo as
  the normal case — the price card is the designed fallback. Worth asking whether a photo
  library earns a rail row or belongs to the product.
- **Fastener guide is a reference table**, not a screen about the shop's money.

---

## What is already decided — do not redesign it

The rail's appearance is specified in the Sell bundle's README and drawn in all eight
frames. Restated so this brief stands alone:

**Structure.** `#17223c`, 236px wide, `flex: none`. A 30px coral logo tile with the shop
name; then `Today` with a `#c2311f` count badge; then six collapsible groups — Sell
expanded, the rest collapsed.

**Items.** 34px tall, radius 9px, 13.5px/500 (600 when active). Hover
`rgba(255,255,255,.07)`, active `rgba(255,255,255,.13)` with white 600. Text
`#b9c2d6` at rest, `#ffffff` active. Labels truncate with an ellipsis; **badges never
shrink** — a count clipped to one digit is a wrong count, where a clipped name is still a
name.

**Group headers.** A 20px two-letter tile (radius 6px, 9.5px/700), an uppercase heading at
10.5px/700 with `letter-spacing: 0.12em` in `#7d89a5`, a mono count at 10px/600 in
`#7d89a5` pushed right, and a chevron. The tiles are already drawn:

| Group | Tile fill | Tile ink |
| --- | --- | --- |
| Se · Sell | `#ffe3d6` | `#8f3009` |
| Bu · Buy | `#e6e3ff` | `#4230a8` |
| Ca · Catalogue | `#d9f2e6` | `#0b5e42` |
| Mo · Money | `#d7e8ff` | `#164a96` |
| In · Insight | `#ffdfe9` | `#8a2450` |
| Su · Setup | `#f0eeea` | `#5f6a7d` |

**Type** is IBM Plex Sans throughout, IBM Plex Mono for every count.

---

## Constraints

- **The rail is the complete map.** Nothing behind a hover or a menu. It was split once —
  six shortcuts on a bar and twenty-one destinations inside six drop-down menus — and it
  cost twice: six screens had two homes and neither was the real one, and the other
  twenty-one could only be found by remembering which menu they were in.
- **The phone tab bar does not change.** Fixed membership on every screen: Today → Today,
  Sell → Quote, Money → Cash book, Manager → Manager, More. Whatever the rail becomes,
  these five slots stay. Anything cut from the rail must still be reachable through More.
- **A badge counts an obligation, never a suggestion.** The Messages badge deliberately
  counts the 13 words owed to people and excludes the 14 posting nominations, because a
  badge that rises when a queue grows trains people to ignore it. Any badge you add
  follows that rule.
- **Named rather than dropped.** A merge is only honest if the words people search by
  still reach the screen that took the work. Every row that goes needs its keywords
  rehomed and an alias so an old link still lands somewhere real — the existing app does
  this for nine screens already and it is why none of those merges broke anyone's habits.
- **Derived, never invented.** Every count on the rail is read off the work, not stored.

## What not to do

- Do not cut a screen to reach a number. If the honest rail is 31 rows, draw 31.
- Do not put anything behind a menu, a hover, or a "more" affordance inside the rail.
- Do not delete the financial statements, and do not delete the order stage board.
- Do not change the phone tab bar's five slots.
- Do not introduce a colour, size or radius outside the system already specified — it is
  now enforced by a test that fails on any hex literal outside the token block.
