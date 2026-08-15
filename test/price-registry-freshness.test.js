#!/usr/bin/env node
'use strict';
/*
 * Which prices to go and check, and how the shop is told.
 *
 * THE BLIND SPOT. The registry refreshes itself only where the shop is
 * already busy -- a quote line edited, a restock booked, goods received.
 * So the items that move keep themselves current and the ones nobody
 * has quoted lately are never questioned again. Measured on the live
 * shop when this was written: 2 of 307 rows had ever been written by
 * the automatic path.
 *
 * AGE ALONE WILL NOT FIND THEM USEFULLY. "Everything over ninety days"
 * is a list of hundreds that nobody works through, and the rows at the
 * top of it are as likely to be a discontinued handle as the cement half
 * the shop's money runs through. So the question is not what is old but
 * WHAT DOES BEING OLD COST -- money at risk, weighted by whether a wrong
 * figure here would do any damage.
 *
 * The decisions pinned below:
 *
 *   the exclusion    nothing sold, nothing quoted, nothing on the shelf
 *                    means a wrong price costs nothing today. Those stay
 *                    off the list entirely; leaving them in is how a
 *                    worklist becomes six hundred rows and stops being
 *                    read.
 *   a refresh is     not a first entry. Counting every row dated this
 *   not an entry     month read 304 done against a target of 20, because
 *                    297 were prices typed in for the first time.
 *   confirming       "I asked and it has not moved" is a real answer and
 *                    has to be recordable, or the only way to clear a
 *                    row is to change a price that was correct.
 *   no round object  the period is derived from the date. Nothing is
 *                    raised, so nothing can be raised twice -- which is
 *                    the trap generateDuesForPeriod exists to avoid.
 *
 * Run: node test/price-registry-freshness.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('price registry freshness');
const src = read('index.html');
const code = src.split(/\r?\n/).map((l) => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');

const TODAY = '2026-08-15';
const data = { prices: [], products: [], stock: {}, stockLog: [], savedQuotes: [], presetPriceReview: {} };

const DECLS = ['PRICE_STALE_DAYS', 'PRICE_REVIEW_DEMAND_DAYS', 'PRICE_REVIEW_TARGET_DEFAULT',
  'PRICE_REVIEW_CONFIRMING_SOURCES'];
const FNS = ['priceAgeDays', 'stockKey', 'anShiftDate', 'getStockQty', 'productPriceRows',
  'rankedPriceRows', 'priceReviewTarget', 'priceReviewStaleDays', 'priceReviewPeriod',
  'priceReviewDemand', 'priceReviewFacts', 'priceNeedsReview', 'priceReviewCandidates',
  'priceReviewProgress', 'confirmPriceUnchanged',
  'supplierAskList', 'supplierPriceAskMessage', 'markSupplierAsked', 'priceAskedDaysAgo'];
const scope = compileScope([
  ...DECLS.map((n) => extractDeclaration(src, n, 'index.html')),
  ...FNS.map((n) => extractFunction(src, n, 'index.html')),
], {
  data,
  todayISO: () => TODAY,
  supplierName: (id) => `Supplier ${id}`,
  productName: (id) => `Product ${id}`,
  productVariantLabel: (p) => (p && p.name) || 'Item',
}, FNS);

const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);

const price = (id, over) => Object.assign({
  id, productId: 'P1', variantIdx: null, supplierId: 'S1',
  wholesale: 10000, retail: null, packQty: 0, tiers: [], outOfStock: false,
  date: '2026-01-01', priceSource: 'manual',
}, over);
const reset = () => {
  data.products = [{ id: 'P1', name: 'Cement' }, { id: 'P2', name: 'Handle' }];
  data.prices = [];
  data.stock = {};
  data.stockLog = [];
  data.savedQuotes = [];
  data.presetPriceReview = {};
};
const sold = (productId, qty, date) => data.stockLog.push({
  type: 'sale', key: productId, delta: -qty, date,
});

/* ---------- 1. old and harmless is not a job -------------------------- */
{
  reset();
  // 226 days old, and nothing has moved: no sales, no quotes, no shelf.
  data.prices = [price(1, { date: '2026-01-01' })];
  const facts = scope.priceReviewFacts(data.prices[0]);
  eq(facts.ageDays, 226, 'the row is well past the limit');
  eq(facts.volume, 0, 'but nothing flows through it');
  t.check(!scope.priceNeedsReview(facts),
    'so it is NOT a job — a wrong price on something nobody buys costs the shop nothing today');
  eq(scope.priceReviewCandidates().length, 0, 'and it stays off the list entirely');

  // One sale is enough to make it matter.
  sold('P1', 3, '2026-07-01');
  t.check(scope.priceNeedsReview(scope.priceReviewFacts(data.prices[0])),
    'one sale in the window is enough to put it on');

  // So is stock standing behind it, with no sales at all.
  data.stockLog = [];
  data.stock = { P1: 12 };
  t.check(scope.priceNeedsReview(scope.priceReviewFacts(data.prices[0])),
    'and so is stock on the shelf — that money has to be re-bought and re-valued');

  // And so is a quote that never closed.
  data.stock = {};
  data.savedQuotes = [{ id: 1, date: '2026-08-01', items: [{ productId: 'P1', variantIdx: null }] }];
  t.check(scope.priceReviewDemand('P1', null).quotes === 1,
    'a quote counts as demand even though nothing was sold');
}

/* ---------- 2. fresh is never a job ----------------------------------- */
{
  reset();
  data.stock = { P1: 50 };
  data.prices = [price(1, { date: TODAY })];
  t.check(!scope.priceNeedsReview(scope.priceReviewFacts(data.prices[0])),
    'a price dated today is not chased however much moves through it');

  data.prices = [price(1, { date: '2026-05-20' })];   // 87 days
  t.check(!scope.priceNeedsReview(scope.priceReviewFacts(data.prices[0])),
    'nor one still inside the limit');

  /* Exactly ON the limit is not past it. Ninety days old is the last day
     the price is still considered good, not the first day it is stale --
     an off-by-one here quietly pulls a day's worth of rows onto every
     list forever. */
  data.prices = [price(1, { date: '2026-05-17' })];   // exactly 90
  eq(scope.priceReviewFacts(data.prices[0]).ageDays, 90, 'a row exactly at the limit');
  t.check(!scope.priceNeedsReview(scope.priceReviewFacts(data.prices[0])),
    'is not yet past it, so it is not chased');
  data.prices = [price(1, { date: '2026-05-16' })];   // 91 days
  t.check(scope.priceNeedsReview(scope.priceReviewFacts(data.prices[0])),
    'and one day older is');

  /* An undated row is the WORST case, not an exempt one: nothing at all
     is known about when it was last true. */
  data.prices = [price(1, { date: '' })];
  const f = scope.priceReviewFacts(data.prices[0]);
  eq(f.ageDays, null, 'an undated row has no age');
  t.check(scope.priceNeedsReview(f), 'and is chased rather than skipped for lack of a date');
  t.check(f.reasons.includes('never dated'), 'saying so in as many words');
}

/* ---------- 3. ranked by what being wrong would cost ------------------ */
{
  reset();
  data.products = [{ id: 'P1', name: 'Cement' }, { id: 'P2', name: 'Handle' }];
  /* Cement 200 sold at 30,000; handle 200 sold at 500 -- and the HANDLE
     is much the older of the two. Ranked by age the handle leads, which
     is exactly the uselessness this ordering exists to avoid: the top of
     the list would be the thing it costs nothing to be wrong about. */
  data.prices = [price(1, { productId: 'P1', wholesale: 30000, date: '2026-04-01' }),
    price(2, { productId: 'P2', wholesale: 500, date: '2025-01-01' })];
  sold('P1', 200, '2026-07-01');
  sold('P2', 200, '2026-07-01');
  const ranked = scope.priceReviewCandidates();
  eq(ranked.length, 2, 'both are past the limit and both move');
  t.check(ranked[1].ageDays > ranked[0].ageDays,
    'the row that comes second is the OLDER one, so age is not what put the first one there');
  eq(ranked[0].row.productId, 'P1',
    'the money leads: 200 bags at 30,000 outranks 200 handles at 500, however much older the handles are');

  /* A wrong WINNER misprices quotes and sends the buying list to the
     wrong door. A wrong loser costs nothing until it wins. */
  reset();
  data.prices = [
    price(1, { id: 1, supplierId: 'S1', wholesale: 10000 }),
    price(2, { id: 2, supplierId: 'S2', wholesale: 12000 }),
  ];
  sold('P1', 100, '2026-07-01');
  const both = scope.priceReviewCandidates();
  eq(both[0].row.supplierId, 'S1', 'the cheapest supplier is checked before the dearer one');
  t.check(both[0].isWinner && !both[1].isWinner, 'and is marked as the one currently winning');
  t.check(both[0].reasons.includes('currently the cheapest'), 'with that given as a reason');

  /* A lone supplier has nothing to be checked against, so its price is
     the whole story and is worth more of somebody's morning.

     Told apart from the winner weighting by comparing two rows that are
     BOTH the cheapest on their item, at the same price and the same
     volume -- so the only thing left between them is that one item has a
     second supplier and the other does not. The two-supplier item is
     listed first in the array, so a tie would leave it on top. */
  reset();
  data.products = [{ id: 'P1', name: 'Cement' }, { id: 'P2', name: 'Handle' }];
  data.prices = [
    price(1, { productId: 'P1', supplierId: 'S1', wholesale: 10000 }),
    price(2, { productId: 'P1', supplierId: 'S2', wholesale: 12000 }),
    price(3, { productId: 'P2', supplierId: 'S1', wholesale: 10000 }),
  ];
  sold('P1', 100, '2026-07-01');
  sold('P2', 100, '2026-07-01');
  const bySource = scope.priceReviewCandidates();
  const p1win = bySource.find((f) => f.row.id === 1);
  const p2win = bySource.find((f) => f.row.id === 3);
  t.check(p1win.isWinner && p2win.isWinner, 'both are the cheapest on their own item');
  eq(p1win.moneyAtRisk, p2win.moneyAtRisk, 'and carry the same money');
  t.check(!p1win.singleSource && p2win.singleSource, 'but only one item has a second opinion on file');
  t.check(bySource[0].row.id === 3,
    'the item with no second opinion is checked first, since its one price is the whole story');
  t.check(p2win.reasons.includes('the only supplier'), 'and it says so');

  // Every row on the list explains itself. A rank nobody can argue with
  // is a rank nobody acts on.
  reset();
  data.prices = [price(1)];
  sold('P1', 5, '2026-07-01');
  data.stock = { P1: 2 };
  const one = scope.priceReviewCandidates()[0];
  t.check(one.reasons.length >= 2 && one.reasons.every((r) => typeof r === 'string' && r),
    `the row carries its reasons (${one.reasons.join(' · ')})`);
}

/* ---------- 4. the demand window -------------------------------------- */
{
  reset();
  data.prices = [price(1)];
  sold('P1', 40, '2026-08-01');                       // inside
  sold('P1', 999, '2025-01-01');                      // long before
  eq(scope.priceReviewDemand('P1', null).units, 40,
    'demand is what moved lately, not everything the shop ever sold');

  // Another item's sales are not this one's.
  sold('P2', 500, '2026-08-01');
  eq(scope.priceReviewDemand('P1', null).units, 40, 'and belongs to the item it was recorded against');

  // A variant's sales are its own, not the product's.
  data.stockLog = [];
  data.stockLog.push({ type: 'sale', key: 'P1::0', delta: -7, date: '2026-08-01' });
  eq(scope.priceReviewDemand('P1', 0).units, 7, 'a variant counts its own sales');
  eq(scope.priceReviewDemand('P1', null).units, 0, 'and the bare product does not inherit them');

  // Only sales. A restock is goods coming IN.
  data.stockLog = [{ type: 'restock', key: 'P1', delta: 100, date: '2026-08-01' }];
  eq(scope.priceReviewDemand('P1', null).units, 0, 'goods arriving are not demand');

  // A voided order was never business.
  data.stockLog = [];
  data.savedQuotes = [{ id: 1, date: '2026-08-01', voided: true, items: [{ productId: 'P1', variantIdx: null }] }];
  eq(scope.priceReviewDemand('P1', null).quotes, 0, 'a voided quote is not demand');
}

/* ---------- 5. a refresh is not a first entry ------------------------- *
 * Counting every row dated inside the period read 304 done against a
 * target of 20 on the first live run -- but 297 of those were prices
 * typed in for the first time that month, not prices anybody went back
 * and checked. A screen opening by congratulating the shop for work it
 * had not done would be worse than no screen.
 */
{
  reset();
  data.prices = [
    price(1, { date: TODAY, priceSource: 'manual' }),
    price(2, { date: TODAY, priceSource: 'purchase' }),
    price(3, { date: TODAY, priceSource: 'confirmed' }),
    price(4, { date: TODAY, priceSource: 'correction' }),
    price(5, { date: '2026-07-30', priceSource: 'purchase' }),
  ];
  const p = scope.priceReviewProgress('2026-08');
  eq(p.done, 2,
    'only a purchase and a confirmation count as checked — a hand-typed row cannot be told from a first entry');
  eq(p.period, '2026-08', 'the period is named');
  eq(p.target, 20, 'against the default target');
  t.check(!p.met, 'and two of twenty is not met');

  // Last month's work belongs to last month.
  eq(scope.priceReviewProgress('2026-07').done, 1, 'an earlier period counts its own');

  // The target is a setting, because nobody knows the sustainable number
  // yet -- and the screen reports what was really achieved so it can be
  // set from evidence.
  data.presetPriceReview = { targetPerPeriod: 2 };
  t.check(scope.priceReviewProgress('2026-08').met, 'a target the shop set is what it is measured against');
  data.presetPriceReview = { targetPerPeriod: 0 };
  eq(scope.priceReviewTarget(), 20, 'and a blank or zero target falls back rather than demanding nothing');
}

/* ---------- 6. the stale limit is a setting too ----------------------- */
{
  reset();
  eq(scope.priceReviewStaleDays(), 90, 'ninety days by default');
  data.presetPriceReview = { staleDays: 30 };
  eq(scope.priceReviewStaleDays(), 30, 'overridden by the shop');
  data.prices = [price(1, { date: '2026-07-20' })];   // 26 days
  sold('P1', 10, '2026-08-01');
  t.check(!scope.priceNeedsReview(scope.priceReviewFacts(data.prices[0])),
    'and the shorter limit is what the list is built against');
  data.presetPriceReview = { staleDays: 10 };
  t.check(scope.priceNeedsReview(scope.priceReviewFacts(data.prices[0])),
    'so tightening it brings more rows in');
}

/* ---------- 7. "I asked, and it has not moved" ------------------------ */
{
  reset();
  data.prices = [price(1, { date: '2026-01-01', wholesale: 10000, priceSource: 'manual' })];
  const row = data.prices[0];
  t.check(scope.confirmPriceUnchanged(1), 'a row can be confirmed');
  eq(row.date, TODAY, 'which dates it today');
  eq(row.priceSource, 'confirmed', 'and records that nobody paid — it was asked about');
  eq(row.wholesale, 10000, 'while the price itself is untouched, because it was right');

  // And that clears it off the list, which is the point.
  sold('P1', 50, '2026-08-01');
  eq(scope.priceReviewCandidates().length, 0,
    'a confirmed row stops being chased — otherwise checking honestly earns you the same list next month');

  t.check(!scope.confirmPriceUnchanged(999), 'a row that is gone confirms nothing rather than throwing');
}

/* ---------- 8. no round to raise twice -------------------------------- *
 * generateDuesForPeriod has to be idempotent because raising the rent
 * twice in one morning is a real and expensive bug. This has no such
 * hazard BY CONSTRUCTION: the period is derived from the date and the
 * progress from the rows, so there is no object to raise and nothing to
 * keep in step with the registry it counts.
 */
{
  reset();
  eq(scope.priceReviewPeriod(), '2026-08', 'the period is read off the date');
  const fn = (/function priceReviewProgress[\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(/data\.prices\.filter/.test(fn),
    'progress is counted from the price rows themselves');
  t.check(!/push\(|allocRowId|generate/.test(fn),
    'and nothing is raised, stored or generated — there is no round object to double-raise');

  // Called twice, it says the same thing and changes nothing.
  data.prices = [price(1, { date: TODAY, priceSource: 'purchase' })];
  const a = scope.priceReviewProgress('2026-08');
  const b = scope.priceReviewProgress('2026-08');
  t.check(a.done === b.done && data.prices.length === 1,
    'asking twice reports the same and writes nothing');
}

/* ---------- 9. the report, and where it is not -------------------------
   Asked for as a report that arrives on its own schedule: a warning
   raised while quoting a client is both too late and in the way. */
{
  t.check(/id="dash_priceReview"/.test(src), 'the report has a home on the dashboard');
  t.check(/function renderDashPriceReview\(\)/.test(code), 'and a renderer');
  t.check(/renderDashPriceReview\(\);/.test(extractFunction(src, 'renderDashboard', 'index.html')),
    'drawn with the rest of the dashboard');

  const panel = extractFunction(src, 'renderDashPriceReview', 'index.html');
  t.check(/priceReviewCandidates\(\)/.test(panel) && /priceReviewProgress\(\)/.test(panel),
    'built from the same two functions tested above, not its own arithmetic');
  t.check(/f\.reasons\.join/.test(panel),
    'every row says why it is there, so the ranking can be argued with');
  t.check(/threat-empty/.test(panel) && /Nothing to chase/.test(panel),
    'and an empty list is good news said in words, not a blank panel');

  /* It must NOT follow the dashboard's date range. Every other panel
     answers "how did the chosen window go"; a price does not stop being
     out of date because you were looking at last quarter. */
  t.check(!/dash_range|rangeFrom|rangeTo/.test(panel),
    'the report ignores the dashboard date range — staleness is a fact about now');

  // Reachable as a worklist, ordered the same way.
  t.check(/\{ key:'review',\s+label:'Needs checking' \}/.test(src),
    'the registry offers the same list as a filter');
  t.check(/priceNeedsReview\b/.test(code) && /order\.has\(r\.id\)/.test(code),
    'showing exactly the rows the report names, in the same order');

  /* And it stays OUT of the row predicate. Deciding it needs the stock
     log, the sales and the item's other suppliers; reaching for those
     from a function whose whole virtue is being a pure function of one
     row is how a filter becomes untestable, and the existing dropdown
     sweep is what caught it going in there the first time. */
  const pred = extractFunction(src, 'priceRowMatchesAge', 'index.html');
  t.check(!/priceNeedsReview|priceReviewFacts/.test(pred),
    'the age predicate reads only the row it was handed, never the shop around it');
  t.check(/if\(!ageFilter \|\| ageFilter === 'review'\) return true;/.test(pred),
    'and passes the worklist key through untouched rather than pretending to apply it');
}

/* ---------- 10. asking one supplier ----------------------------------
   The two channels that actually collect the prices. Both rest on the
   same derivation -- the review list, narrowed to one supplier -- rather
   than on a stored list, which would be a second answer free to go stale
   between the day it was built and the day somebody walked. */
{
  reset();
  data.products = [{ id: 'P1', name: 'Cement' }, { id: 'P2', name: 'Handle' }];
  data.prices = [
    price(1, { productId: 'P1', supplierId: 'S1', unit: 'Bag' }),
    price(2, { productId: 'P2', supplierId: 'S2', unit: '' }),
    price(3, { productId: 'P1', supplierId: 'S2', wholesale: 11000 }),
    price(4, { productId: 'P2', supplierId: 'S1', date: TODAY }),   // fresh
  ];
  sold('P1', 50, '2026-08-01');
  sold('P2', 50, '2026-08-01');

  const s1 = scope.supplierAskList('S1');
  t.check(s1.every((f) => f.row.supplierId === 'S1'), 'an ask list is one supplier’s own rows');
  t.check(!s1.some((f) => f.row.id === 4), 'and leaves out the price that is still fresh');
  t.check(scope.supplierAskList('S2').some((f) => f.row.id === 2),
    'while another supplier gets their own');
  t.check(scope.supplierAskList('NOBODY').length === 0,
    'and a supplier with nothing worth asking gets an empty list, not everything');

  /* Ordered the same way the report is. Somebody who can only ask about
     three things should be asking about the three that matter. */
  const all = scope.priceReviewCandidates().filter((f) => f.row.supplierId === 'S1');
  t.check(s1.map((f) => f.row.id).join() === all.map((f) => f.row.id).join(),
    'in the order the review already put them, not the order they were entered');
}

/* ---------- 11. the message asks, and does not tell -------------------- */
{
  const list = [
    { row: { id: 1, pname: 'Cement — 50kg', unit: 'Bag', wholesale: 34000 } },
    { row: { id: 2, pname: 'Nails — 4 inch', unit: '', wholesale: 9500 } },
  ];
  const m = scope.supplierPriceAskMessage('S1', list);
  t.check(/Please confirm your current prices/.test(m), 'it asks for their figure');
  t.check(/Cement — 50kg \(per Bag\)/.test(m), 'naming each item and its unit');
  t.check(/• Nails — 4 inch\n/.test(m), 'and leaving the bracket off where there is no unit');

  /* THE PRICE IS NEVER IN IT, and for a stronger reason than the trip
     message has. The whole point is to hear THEIR number: "you said
     34,000 in May, still right?" invites a yes from a supplier who has
     since put it up, and the shop would never find out. */
  t.check(!/34,000|9,500|34000|9500/.test(m),
    'and never quotes back the price already on file, which would invite a yes and teach the shop nothing');
  t.check(!/UGX/.test(m), 'no money in it at all');

  eq(scope.supplierPriceAskMessage('S1', []), '',
    'nothing to ask is no message, rather than a greeting with nothing under it');
}

/* ---------- 12. that they were asked ----------------------------------
   The one thing the review cannot derive. A price that was CHECKED
   leaves a date behind; a question sent and never answered leaves
   nothing at all, so without this the same list goes to the same
   supplier every week and nobody can tell which items are still
   waiting. */
{
  reset();
  data.prices = [price(1, { supplierId: 'S1' }), price(2, { supplierId: 'S2' })];
  sold('P1', 50, '2026-08-01');
  const asked = scope.markSupplierAsked('S1');
  eq(asked, 1, 'asking stamps the rows it asked about');
  t.check(!!data.prices[0].lastAskedAt, 'the row remembers it was asked');
  t.check(!data.prices[1].lastAskedAt, 'and another supplier’s row does not');

  /* It does NOT clear the row off the list. Asking is not an answer --
     a supplier who never replies must keep showing up, or the shop
     stops chasing the very prices it could not get. */
  t.check(scope.supplierAskList('S1').length === 1,
    'a row that was asked about is still on the list until somebody answers');

  eq(scope.priceAskedDaysAgo(data.prices[0]), 0, 'asked today is nought days ago');
  eq(scope.priceAskedDaysAgo(data.prices[1]), null, 'never asked has no answer rather than a zero');
  eq(scope.priceAskedDaysAgo({ lastAskedAt: 'not a date' }), null, 'and nor does a broken stamp');
  eq(scope.priceAskedDaysAgo(null), null, 'nor a missing row');
}

/* ---------- 13. the column it needs, and surviving without it ---------
   The migrations here are applied BY HAND, so there is always a window
   where the new code is live and the column is not. Reads survive that
   on their own -- the mapper sees undefined -- but a write does not:
   PostgREST rejects the entire upsert for one unknown column, and every
   price row goes up on every save. Sending this unguarded would stop the
   shop saving prices at all, not merely lose the stamp. */
{
  t.check(/alter table prices add column if not exists last_asked_at timestamptz;/
    .test(read('supabase/migrations/0075_price_last_asked.sql')),
    'the column has a migration');
  t.check(/sb\.from\('prices'\)\.select\('last_asked_at'\)\.limit\(1\)/.test(code),
    'and the app probes for it rather than assuming');
  t.check(/priceAskedColumn = !\(askedColR && askedColR\.error\);/.test(code),
    'recording whether it is there yet');
  t.check(/\.\.\.\(priceAskedColumn \? \{last_asked_at: pr\.lastAskedAt \|\| null\} : \{\}\)/.test(code),
    'and the write is guarded on it, so prices keep saving until the migration lands');
  t.check(/lastAskedAt: pr\.last_asked_at \|\| null/.test(code),
    'while the read needs no guard — a missing column simply reads as never asked');

  /* Its own probe, not folded into the sourcing pair. All three are
     applied by hand and can land in any order, so one being absent must
     not stop another being written. */
  t.check(/sourcingImageColumn = !\(imageColR/.test(code) && /priceAskedColumn = !\(askedColR/.test(code),
    'probed separately from the sourcing columns, which land independently');
}

/* ---------- 14. while you're there ------------------------------------
   A separate errand to go and confirm prices is the thing that never
   happens; a line on a message somebody is sending anyway is the thing
   that does. Wired at the join rather than by teaching either message
   about the other, so the trip's deliberate no-prices rule stays where
   it can be read. The message itself is pinned in collection-trips. */
{
  const url = extractFunction(src, 'supplierTripWaUrl', 'index.html');
  t.check(/supplierAskList\(trip\.supplierId\)/.test(url),
    'the trip notice looks up what is worth asking that supplier');
  t.check(/supplierTripMessage\(trip\) \+ '\\n\\n—\\n\\n'/.test(url),
    'and joins the two messages rather than merging them');
  t.check(/ask\.length\s*\?/.test(url),
    'with nothing appended when there is nothing to ask');

  // Named on the card too, so whoever presses Tell supplier knows the
  // message carries it, and a worker being briefed knows to ask.
  t.check(/While there, ask \$\{n\} \$\{n===1\?'price':'prices'\}/.test(code),
    'the trip card says how many prices ride along');

  // And offered on the supplier's own panel, which is where somebody
  // already thinking about that supplier lands.
  const ask = extractFunction(src, 'askSupplierForPrices', 'index.html');
  t.check(/markSupplierAsked\(supplierId, rows\)/.test(ask), 'asking records that it asked');
  t.check(/window\.open\(waComposeUrl\(/.test(ask), 'and opens WhatsApp with it written out');
  /* A DRAFT, never a send. Nothing here puts a message on the wire: the
     shop's own hand is on the button, the same arrangement the sales
     share and the trip notice already use. */
  t.check(!/api|fetch|sendMessage/i.test(ask),
    'nothing is sent — the message is composed and a human decides');
  t.check(/send the message to finish/.test(ask),
    'and the toast says so, rather than implying it has gone');
}

process.exit(t.done() ? 1 : 0);
