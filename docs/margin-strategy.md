# Where the margin can come from

Research into the business model, written because the owner's own diagnosis was that margins are
thin — that the shop creates little value and is easily replaced, being a middleman between the
Kikuubo importers and the builders.

The diagnosis is right, and the code says it more sharply than the owner did. Three findings set up
everything below.

**1. Until recently the shop had no way to be paid for anything except goods.** An order total was
the goods and nothing else. Every non-goods thing the shop does — sourcing an item nobody stocks,
sending someone to Kikuubo to fetch it, delivering it, carrying the credit, cutting and threading,
telling a customer how many nails a roof takes — was given away. A delivery charge existed only as
free text in a WhatsApp message (`.design/whatsapp/body_main.html`: *"Delivery to Kyaliwajjala
is 60,000 on top."*), so it never reached an invoice, the profit and loss, or the margin arithmetic.
This is now fixed — see option 1 — and the rest of this document assumes it.

**2. Cost to serve is still largely invisible.** `deliveryRuns()` (`index.html:30628`) groups orders
by destination and values each run by the goods on it, never by what the run costs. There is no
profit-per-customer reading anywhere in the app. Thin margin usually hides exactly there.

**3. The middleman position is the architecture, not an accident.** `0070_collection_trips.sql`
states it plainly: *"The shop is a fulfilment centre: goods bought for an order come IN first and are
picked from the shop afterwards."* Zero inventory risk — and zero moat. The customer can buy the
same carton from the same importer up the street.

Against that, the shop already owns four things most of its competitors do not, and each is the seed
of a different business model:

- a **priced supplier registry** with volume ladders across the product list;
- a **sourcing funnel that separates who imports a thing from who sells it** —
  `sourcing_leads.candidates.role` is `importer` | `supplier` | `both` (`0072_sourcing_leads.sql`);
- **`product_links` with real ratios** ("eight nails per sheet", `0090_product_links.sql`) beside
  **`customers.site_stage`** (`0092_customer_site_stage.sql`) — together, a way of knowing what a
  site needs before it asks;
- an **external, commission-only agent network** the shop pays nothing to carry (`0012_sales_agents.sql`).

---

## 1. Figures used

Every number in this document comes from this block. Nothing is restated inline without being
traceable to a row here, and every row carries its provenance:

- **`canvas`** — from the design mockups in `.design/`. **These are mockup figures, not live
  readings.** They are internally coherent and are used as a working baseline so the options can be
  sized against each other.
- **`benchmark`** — outside research, sourced in §8.
- **`derived`** — arithmetic on the rows above, shown.
- **`assumption`** — a judgement, marked as one.

| Figure | Value | Tag | Where |
|---|---|---|---|
| Invoiced sales, one month | 148,600,000 UGX | canvas | `.design/statements`, `.design/sales-analytics` |
| Gross margin | 20.0% (Aug) · 21.4% (last 30 days) | canvas | statements · sales-analytics |
| Net profit | 20,925,000 UGX — 14.1% of what was invoiced | canvas | statements |
| Running costs | 7,745,000 UGX a month, of which 4,950,000 committed (800,000 rent, 4,150,000 in 6 salaries) | canvas | statements |
| Break-even | 38,725,000 UGX of sales | canvas | statements |
| Counter sales outside the P&L | 34,200,000 UGX — 19% of what came in, with no invoice behind it | canvas | statements |
| Cash in hand | 6,480,000 UGX across 3 accounts | canvas | statements |
| Owed to the shop | 8,420,000 UGX across 14 customers | canvas | debtors |
| Of it, over 90 days | 2,180,000 UGX — 26%, from 3 customers | canvas | debtors |
| Bought in 30 days | 33,901,800 UGX from 12 suppliers | canvas | purchase-analytics |
| Largest supplier | 36.8% of buying — 12,480,000 UGX; top three 76.2% | canvas | purchase-analytics |
| Others' goods on the shelf | 7,640,000 UGX — 247 units, 5 consignors | canvas | consignment |
| Own shelf | 19,300,000 UGX at cost across 340 lines | canvas | pricing |
| Standing still | 5,410,000 UGX — 22 lines untouched in 60 days, 28% of the shelf | canvas | pricing |
| Kept on own-shelf sales | 22.4% against the 30% target, on 11,400,000 taken in 30 days | canvas | pricing |
| **What the thin lines cost** | **2,580,000 UGX a month** — lifting 14 lines to 30% across the units that really sold | canvas | pricing |
| Cement, Hima 50kg | costs 27,500, charged 29,500 → keeps **6.8%**; 145 sold; 30% would be 39,300; +1,421,000 a month | canvas | pricing |
| Iron sheets, G28 box profile | keeps **10.9%**; 42 sold; +529,000 a month | canvas | pricing |
| Cost was a guess on | 1,206 units — 13% of what was sold | canvas | sales-analytics |
| Value-added products and installation | 5.8% of revenue across the US construction-supply top 150 | benchmark | §8 |
| Margin on value-added services | 40–60%, managed properly | benchmark | §8 |
| Infra.Market own brands vs distribution | **16–18%** gross margin against **6–7%** | benchmark | §8 |
| Infra.Market private-label share | 33% of revenue in FY21 → 64% now | benchmark | §8 |
| Jumba (Kenya) | 700+ hardware stores, 60% of Kenya's 47 counties, $5.5m raised | benchmark | §8 |
| **One point of gross margin** | **1,486,000 UGX a month ≈ 17,832,000 a year** | derived | 148,600,000 × 1% |

**One unit of account carries this whole document: a point of gross margin is about 1.49m a month,
about 17.8m a year.** Every option below is sized in points so they can be compared with each other
rather than admired one at a time.

### On the figures being mockups

The analysis was asked to be built on real Supabase numbers. It could not be, and this document does
not pretend otherwise: the network policy denies the database host (the proxy answered
`403` to `CONNECT` for the project host), there is no Supabase CLI session so `npm run backup`
(`tools/backup-shop-data.js`) cannot run, and the publishable key in `api/assistant.js` is anon-level,
which RLS (`is_shop_member(shop_id)`) would answer with nothing even if the host were reachable.

So the document is built to be re-sized in a single edit: **replace the table above** — run
`npm run backup` on a machine with `supabase link`, or read the Statements, Pricing, Debtors and
Purchase analytics screens — and every sizing below moves with it, because none of them uses a number
from anywhere else.

---

## 2. What the shop earns today, and from what

Three lines, and only three:

1. **Markup on goods.** Either a percent or a fixed amount, with a separate rule for the shop's own
   stock (`0006_stock_pricing_rule.sql`). This is almost all of it.
2. **Commission earned *from* suppliers** (`0020_supplier_commissions.sql`,
   `0021_supplier_commission_pct.sql`). The column is `commission_pct`, documented "e.g. 3%", and it
   is null on most suppliers — meaning no rate has been agreed. Money the shop is owed for moving a
   supplier's goods, and mostly not collected.
3. **The agent layer** (`0012_sales_agents.sql`), whose own margin is collected from their client and
   never touches the shop's books at all.

And now a fourth, since this research was commissioned:

4. **Service income** — charges on an order, carrying their own cost. See option 1.

---

## 3. Why the margin is thin — five causes, each with its evidence

**a. Nothing but goods could be charged for.** Finding 1 above. Now fixed; it was the first thing
fixed because it was the cheapest to fix and the only one that was a pure giveaway.

**b. Fixed markups decay silently.** `ruleYieldPct()` (`index.html:68614`) is the mechanism; the
Pricing canvas is the damage. Cement is the shop's biggest seller and the thinnest thing on the
shelf: the rule is `+2,000` a bag, which was a fifth of the price when a bag cost 8,000 and is
**6.8%** on a cost of 27,500. Iron sheets keep **10.9%**. A fixed mark does not grow with the cost,
and nothing repriced them. The app was even shipped judging prices against a 10% bar
(`THIN_MARGIN_PCT = 10`, `index.html:84501`) without ever asking the owner what their bar was.
**The screen's own figure for this is 2,580,000 a month.**

**c. Identical goods, identical suppliers — so price is the only variable.** This is Bertrand
competition, and it ends at cost. `0087_rival_prices.sql` exists because the shop already knows it:
it is a table for recording what the shop up the street charges.

**d. Credit is free.** 8,420,000 owed, 2,180,000 of it past 90 days, at a price of zero. That is a
direct transfer of margin to the customer, financed by the shop. Note the asymmetry the app itself
records: `0043_loans.sql` models the shop's **own** borrowing in detail — a real SACCO schedule, a
bike loan where the fees exceeded the interest — while nothing prices the credit the shop gives.

**e. Concentration sets the price, not the shop.** One supplier is 36.8% of the buying; the top three
are 76.2% of it. A shop that must go to the same yard every week does not negotiate, it asks.

The customer side is not in the design figures, so this document asserts no number for it — but the
app already measures it on real data and the owner can read it today: `revenueConcentration()`
(`index.html:78311`) for the largest customer's share, `purchaseConcentration()` for the supplier
side, `singleSourcedLines()` for the lines only one supplier has ever quoted, and
`concentrationExposure()`, which answers the only version of the question that decides anything —
whether the shop would still clear break-even without its largest customer.

---

## 4. Four places margin can come from

Every option below is one of these four. It is worth knowing which, because they cost different
things and take different amounts of time:

1. **Buy better** — pay less for the same goods. *(options 5, 6)*
2. **Sell the same goods for more** — stop leaking price. *(options 2, 3)*
3. **Sell something other than goods** — get paid for work, knowledge, credit, convenience.
   *(options 1, 4, 8, 9, 10, 11)*
4. **Change what the business is** — stop being a reseller. *(options 7, 12, 13)*

The first two are available this month and are bounded. The last two are where the replaceability
problem actually gets solved.

---

## 5. The thirteen options

### 1. Charge for what you already do — ✅ **shipped**

A priced service menu: delivery, fetching, cutting and threading, urgent, after-hours, take-offs.
Everything in finding 1 that used to be free.

**Why it fits:** the shop was already doing all of it. Nothing new has to be learned or hired — only
named and priced. And the customer already accepts it: the WhatsApp quote in the design files
carries "Delivery to Kyaliwajjala is 60,000 on top.", in words, as a thing the customer agrees to.

**Benchmark:** value-added products and installation are **5.8% of revenue** across the US
construction-supply top 150, and **value-added service margins run 40–60%** when they are managed
rather than absorbed.

**Size:** at 2% of invoiced sales (2.97m a month) with half of it kept after fares, **+1.0 pt**. At
the benchmark's 5.8%, **+2.9 pts**. *(assumption: the 2% and the 50%.)*

**What shipped:** charges are rows of the order with their own labels and amounts, they reach the
invoice, the WhatsApp sales-group message and the books as **Service income**; and what each one cost
is recorded on the order as a real payment out of a real account, so it appears as **Cost of service**
in the same period rather than as a running cost of the day the driver was paid. A charge nobody has
costed counts as kept in full and is **named on the statement's trust checks** — because an uncosted
delivery flatters the one line it belongs to, and the app must not quietly show a 100% margin.

### 2. Stop the discount and decay leak

Three things at once: lift the lines that have fallen under target, put a floor and a discount
authority under the agents, and answer price objections with `rival_prices` evidence instead of
reflex.

**Why it fits:** this is the only option that needs no new product, no new supplier and no new skill.
The screen already names the lines and the money.

**Size:** the Pricing screen's own figure is **2,580,000 a month = +1.7 pts** — but read it as the
ceiling it is: it is *"what lifting 14 lines to 30% would have added over the units that really
sold"*, and it assumes the same units sell at the new price. More than half of it (1,421,000) is
cement, where the lift is 29,500 → 39,300 on the most price-shopped commodity in the trade; that part
will not survive contact with a customer at full size. **The realistic near-term take is the
non-cement 1,160,000 a month — about +0.8 pts — plus whatever discipline on discounts is worth.**

**Risk:** the honest one. Lifting a headline price on cement is how a shop loses a builder for
everything else. Do the quiet lines first; move cement with a kit or a service, not with a sticker.

**The app already has the right primitive** for the agent side: the margin-share discount rule
(`test/agent-discount-margin.test.js`) makes a discount come out of the discounter's own share.

### 3. Price the credit

A cash price and a credit price; a discount for settling early; a deposit before delivery.

**Why it fits:** 8,420,000 is out there at no charge, a quarter of it aged past the point where money
usually arrives on its own. The shop is a bank that forgot to have a rate card.

**Size:** a 3% spread between cash and credit on the share of sales that go on credit — say 40% —
is 148,600,000 × 40% × 3% = **1,780,000 a month ≈ +1.2 pts**. It earns either way: the customer
takes the cash price and the shop gets the money now, or takes the credit price and is paid for the
wait. *(assumption: the 40% and the 3%.)*

**Second-order:** 8.42m collected is 8.42m that buys goods again. On the canvas figures the shop
turns its purchases roughly monthly, so that is another cycle of margin on the same capital.

### 4. Move the mix

Sell cement and sheets as the door-opener, and earn on what goes with them.

**Why it fits:** cement keeps 6.8%, nails keep 21.0% — the shop is already carrying both. And it has
the machinery to know what to attach: `product_links` holds real ratios ("eight nails per sheet"),
`customers.site_stage` says where a site has got to. That is an attach-rate engine that nobody is
using as one.

**Size:** moving 5% of revenue from 6.8%-margin goods to 21%-margin goods is
148,600,000 × 5% × (21.0 − 6.8)% = **1,060,000 a month ≈ +0.7 pts**, with no price rise anywhere and
no customer losing anything.

### 5. Go upstream on two or three lines

Buy direct from the importer on the lines where the shop has the volume to be worth serving.

**Why it fits:** the shop has already done the research. `sourcing_leads.candidates.role`
distinguishes `importer` from `supplier` from `both` — it is a map of who is upstream of whom, built
for a different purpose and usable for this one.

**Size:** moving a quarter of purchases (8,500,000 a month) direct and recovering 8 points of the
distributor's margin is **680,000 a month ≈ +0.5 pts**. *(assumption: the quarter and the 8 points.)*

**Cost and risk:** real money tied up, real inventory risk, and it forfeits the zero-risk position
that `0070` describes. It is also the precondition for option 7, which is where the actual prize is.

### 6. Turn informal commission into a written rebate

Two moves, both with suppliers. Get `commission_pct` actually agreed and written down. And push more
suppliers onto consignment.

**Why it fits:** the column exists and is null on most suppliers, which means the shop is moving
other people's goods for nothing. And 7,640,000 of somebody else's stock is already sitting on the
shelf under `0080_stock_lot_consign.sql` — proof the arrangement is acceptable in this market.

**Size:** 3% agreed across the top three suppliers (76.2% of 33,901,800 = 25,800,000 a month) is
**775,000 a month ≈ +0.5 pts**.

**Why a rebate rather than a discount:** a rebate is retained until the volume is actually
delivered; a discount is surrendered at the point of sale whether the volume comes or not.

**And consignment is free working capital** — every shilling of it is stock the shop sells without
having funded. Doubling the 7.64m releases about that much cash.

### 7. Private label

Put the shop's own name on one commodity where quality can be verified and brand barely matters:
nails, binding wire, wall plugs, PVC fittings.

**Why it fits:** it is the direct answer to "the customer can buy the same carton up the street" —
they cannot, if it is the shop's carton.

**Benchmark, and it is the strongest evidence in this document:** Infra.Market's own brands run
**16–18% gross margin against 6–7% on the third-party brands they distribute** — roughly ten points,
on the same kind of goods, in the same kind of market. Their private label went from **33% of revenue
in FY21 to 64% now**, which turned a logistics intermediary into something closer to a manufacturer
with a distribution arm.

**Size:** ten points on a tenth of revenue is **1,490,000 a month ≈ +1.0 pt** — and unlike everything
above it, it compounds: the same ten points apply to every further shilling moved onto own brand.

**Cost and risk:** a minimum order from a manufacturer, quality control the shop must own, and the
first complaint arrives at the shop's own name instead of somebody else's. Start with one line, small.

### 8. Kits and solutions, not SKUs

Sell a roof, not twelve individually comparable line items.

**Why it fits:** it attacks cause (c) — Bertrand competition — at the root, by removing the thing
being compared. A customer can price-check a bag of cement in four shops in ten minutes; they cannot
price-check *"everything for a 3-bedroom roof, delivered Thursday, cut to length"*, because nobody
else has quoted that. `0026_solution_templates.sql` already exists.

**Size:** kits at 15% of revenue carrying 5 points more than the same goods loose is
**1,110,000 a month ≈ +0.75 pts**, and it protects the margin on everything inside the kit from
comparison.

### 9. Supply-and-fix

Bundle the fundi with the material.

**Why it fits:** margin moves off the material, where it is compared, and onto the job, where it is
not. The benchmark's 40–60% service margin is the reason this is the single biggest per-shilling
uplift available.

**Size:** installation at 3% of revenue (what Home Depot and Lowe's take, at 3.2%) with 40% kept is
**1,780,000 a month ≈ +1.2 pts**.

**Cost and risk:** this one is genuinely operational. Fundis have to be found, scheduled, paid and
stood behind — a bad fix is the shop's problem now, not the customer's. It is the option most likely
to be underestimated.

### 10. Technical advisory as the reason not to shop around

Make the expertise explicit and free — take-offs, "how many nails for this roof", which gauge for
which span, the Fastener Guide (`METRIC_BOLTS`, `SCREW_GAUGES`, `WALL_PLUGS`, the true-scale renders,
the 1:1 phone ruler the app already ships).

**Why it fits:** distributors increasingly compete on speed, expertise and workflow support rather
than on inventory and price, and the shop has already built the asset without charging for it.

**Size: no line of its own, deliberately.** It is what makes options 1, 8 and 9 sellable — the reason
a builder accepts a delivery charge from this shop and not from the next one. Judge it by win rate
and by repeat customers, not by an invoice line.

### 11. Materials savings / layaway for self-builders

Let a customer pay in monthly and take the materials when the amount is reached, at a price fixed
when they started.

**Why it fits:** it formalises exactly what this market already does informally — the self-builder
who saves *in kind*, buying twenty blocks at a time and stacking them on the plot. The shop is
competing with a pile of blocks in somebody's yard, and the pile is winning because it is the only
savings product on offer.

**Size:** measured in float, not margin. Fifty savers at 200,000 a month is **10,000,000 of float**
and fifty sales locked months ahead of the competition. *(assumption: both numbers.)*

**Risk:** it is deposit-taking in all but name, so the price-fixing side has to be conservative and
the money must not be spent as though it were earned.

### 12. Become the demand aggregator

Stop taking a markup on goods and start owning the order book several suppliers compete for.

**Why it fits:** the agent network plus WhatsApp quoting is *already* a demand-collection machine —
it is the one asset the shop has that is hard to copy. Whoever holds the aggregated demand sets the
terms; today the shop hands that position to whoever it buys from.

**Precedent:** Jumba in Kenya serves **700+ hardware stores across 60% of the country's counties** on
approximately this model, on $5.5m of venture funding.

**Size:** not a margin point — a different business. And the only option in this document that
genuinely answers "we are highly replaceable", because the thing being sold stops being a carton.

### 13. Secondary: the app as a product

94 migrations, multi-tenant, offline-first, WhatsApp auto-quoting, an AI manager — in a market of
thousands of unsystematised hardware shops.

**Honest version:** it is a different company to run, with a different skill set, and it competes for
exactly the attention the shop needs. But it is also the natural road into option 12 — a hundred
shops running the same system is a buying group and an aggregated order book, arrived at from the
side.

---

## 6. The ranking, and the order to do them in

Sizing is monthly gross-margin points from §5. "Effort" is the shop's, not the app's.

| # | Option | Size | Effort | Kind |
|---|---|---|---|---|
| 1 | Service menu — **shipped** | +1.0 to +2.9 pts | done | sell non-goods |
| 3 | Price the credit | +1.2 pts | low | sell goods for more |
| 9 | Supply-and-fix | +1.2 pts | high | sell non-goods |
| 7 | Private label | +1.0 pt, compounding | high | change the business |
| 2 | Pricing discipline | +0.8 pts (ceiling +1.7) | low | sell goods for more |
| 8 | Kits and solutions | +0.75 pts + protection | medium | sell non-goods |
| 4 | Move the mix | +0.7 pts | medium | sell non-goods |
| 6 | Rebates and consignment | +0.5 pts + working capital | low | buy better |
| 5 | Go upstream | +0.5 pts | high | buy better |
| 11 | Layaway | float, not margin | medium | sell non-goods |
| 10 | Technical advisory | enables 1, 8, 9 | low | sell non-goods |
| 12 | Demand aggregator | a different business | very high | change the business |
| 13 | The app as a product | a different company | very high | change the business |

**Now** — 2, 3, 6, and the service menu in 1 that is already built. About **+2.5 points**, or 45m a
year, from pricing discipline, priced credit and agreed rebates. No new capability, no capital.

**This quarter** — 4, 8, 10. Another **+1.5 points**, and they begin to make the shop harder to
compare.

**This year** — 9, 7, 5. The first two of those are worth more than everything above them combined
over time, because private label compounds and installation cannot be price-checked.

**The bet** — 12, with 13 as the road in. Only worth starting when the shop is not short of
attention.

**If only one thing is done: price the credit.** It is the largest number available for the least
work, it needs nothing built, and it costs nothing to reverse if customers push back.

---

## 7. What the books still cannot tell you

Every figure above is a size, not a measurement. These three gaps are what stand between the two —
and shipping option 1 closed the first of them.

- ~~**There is no charge line.**~~ **Closed.** Charges are rows on the order, they reach the invoice
  and the sales-group message, and they land in the books as Service income with their own Cost of
  service.
- **Cost to serve a delivery run is derivable now, and is not derived.** Each order's fares are
  recorded, but `deliveryRuns()` (`index.html:30628`) still values a run by `savedQuoteTotal` and
  never by what the run cost. The figure that would say "this run lost money" is one subtraction away
  and nobody is doing it.
- **There is still no profit per customer.** `revenueConcentration()` (`index.html:78311`) ranks
  customers by `anInvoiceTotals(q).sales` — goods only, deliberately excluding services — so it
  answers "who buys the most", never "who is worth the most". Until that exists, option 3 and
  option 4 are being aimed by feel. *(A small open decision sits inside this: whether a customer's
  charges should count toward their rank. They are revenue; they are also not goods. It is the
  owner's call, and it should be made deliberately rather than inherited.)*

Two more caveats the app already states about itself, and which bound every figure in §1:

- **19% of what came in has no invoice behind it** — 34,200,000 of counter sales. The profit and
  loss counts invoiced sales only, so it understates the business by that much, and every point of
  margin above is a point of the invoiced part.
- **Cost was a guess on 13% of units sold.** Margin on those lines is an estimate, and the app says
  so rather than hiding it.

---

## 8. Sources

**In this repository**

- Delivery runs valued by goods, not cost — `index.html:30628`
- Fixed-markup decay — `ruleYieldPct()`, `index.html:68614`
- The 10% thin-margin bar shipped without being asked for — `index.html:84501`
- Customer, supplier and single-source concentration — `index.html:78311` onward
- Charges, their totals and their costs — `index.html:37605`, `:37642`, `:37700`
- Stock pricing rule — `supabase/migrations/0006_stock_pricing_rule.sql`
- The agent layer — `0012_sales_agents.sql`
- Supplier commission, and its rate — `0020_supplier_commissions.sql`, `0021_supplier_commission_pct.sql`
- Solution templates — `0026_solution_templates.sql`
- The shop's own borrowing — `0043_loans.sql`
- "The shop is a fulfilment centre" — `0070_collection_trips.sql`
- Importer vs supplier vs both — `0072_sourcing_leads.sql`
- Consignment — `0080_stock_lot_consign.sql`
- Recording what rivals charge — `0087_rival_prices.sql`
- Product ratios, and where a site has got to — `0090_product_links.sql`, `0092_customer_site_stage.sql`
- The figures — `.design/statements`, `.design/sales-analytics`, `.design/purchase-analytics`,
  `.design/debtors`, `.design/consignment`, `.design/pricing`, `.design/whatsapp`

**Outside**

- [Margins Tighten, Value-Add Matters In Construction Supply](https://www.housingwire.com/articles/margins-tighten-value-add-matters-in-construction-supply/)
  — value-added products and installation at 5.8% of revenue across the CS150; Home Depot and Lowe's
  at 3.2% from installation alone.
- [Stacking Value, Stacking Margins: The Distributor's Guide to Service-Led Growth](https://www.phcppros.com/articles/23654-stacking-value-stacking-margins-the-distributors-guide-to-service-led-growth)
  — value-added service margins of 40–60% when managed.
- [Building and Construction Distributors Can Increase Their Margins More; Here Are 10 Ways To Do It](https://www.lek.com/insights/industrials/building-and-construction-distributors-can-increase-their-margins-more-here)
- [Winning in 2025: How building material suppliers can navigate a changing market](https://www.simon-kucher.com/en/insights/winning-2025-how-building-material-suppliers-can-navigate-changing-market)
- [Can India's Fastest Unicorn Win the Infra.Market?](https://www.ajuniorvc.com/infra-market-construction-unicorn-startup-india-tech)
  and [Infra.Market scales up](https://www.foundamental.com/perspectives/infra-market-scales-up-as-indias-infra-and-real-estate-boom-fuels-demand)
  — own brands at 16–18% gross margin against 6–7% on third-party distribution; private label from
  33% of revenue in FY21 to 64%.
- [The power of private-label brands in distribution](https://www.mckinsey.com/industries/industrials/our-insights/the-power-of-private-label-brands-in-distribution)
- [Jumba, a Kenyan startup simplifying sourcing of construction supplies, raises $4.5M](https://techcrunch.com/2023/02/19/jumba-a-kenyan-startup-simplifying-sourcing-of-construction-supplies-raises-4-5m/)
  and [Jumba](https://www.speedinvest.com/portfolio/jumba) — 700+ hardware stores, 60% of Kenya's
  counties.
- [Building material prices, Uganda](https://www.lexauganda.com/materials-prices/) and
  [2025 price survey](https://smeatonconstructions.com/building-material-prices-uganda-2025/) — local
  price levels behind the cement and iron-sheet figures.
