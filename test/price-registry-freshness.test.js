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
const data = { prices: [], products: [], stock: {}, stockLog: [], savedQuotes: [],
  purchaseInvoices: [], presetPriceReview: {} };

const DECLS = ['PRICE_STALE_DAYS', 'PRICE_REVIEW_DEMAND_DAYS', 'PRICE_REVIEW_TARGET_DEFAULT',
  'PRICE_REVIEW_CONFIRMING_SOURCES', 'PRICE_DRIFT_TARGET', 'PRICE_LEARN_MIN_INTERVALS',
  'PRICE_LEARN_MIN_SPAN_DAYS', 'PRICE_LEARN_MIN_DAYS', 'PRICE_LEARN_MAX_DAYS'];
const FNS = ['priceAgeDays', 'stockKey', 'anShiftDate', 'daysBetweenISO', 'stockOnHand', 'getStockQty',
  'productPriceRows', 'rankedPriceRows', 'priceReviewTarget', 'priceReviewStaleDays',
  'priceReviewPeriod', 'priceReviewDemand', 'priceReviewFacts', 'priceNeedsReview',
  'priceReviewCandidates', 'priceReviewProgress', 'confirmPriceUnchanged',
  'supplierAskList', 'supplierPriceAskMessage', 'markSupplierAsked', 'priceAskedDaysAgo',
  'priceObservations', 'learnedStaleDays', 'priceStaleDaysFor',
  'applySupplierReply', 'syncPriceRegistryFromPurchase', 'purchasePriceAtQty',
  'purchasePriceSlotAtQty', 'tiersForKind', 'cheaperSmallerQuantity', 'purchasePricePoints',
  'tieredUnitPrice', 'deriveWholesaleRetail', 'priceReplySlots'];
/* The registry write now refuses a price quoted in a unit the row is not
   priced in, so the comparison it makes comes into the scope too. */
DECLS.push('cmpUnitKey');
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
  data.purchaseInvoices = [];
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

  /* A TIE MAKES BOTH WINNERS. rankedPriceRows returns a sorted list, and
     two suppliers quoting the same figure are separated only by where
     they sit in data.prices -- server row order, which shifts between
     reloads. Seen on the real books: WISEUP Tape Measure is 45,000 from
     two suppliers, and which one counted as the winner changed from one
     load to the next. If they tie at the cheapest, a wrong figure on
     either misprices the quote. */
  reset();
  data.prices = [
    price(1, { supplierId: 'S1', wholesale: 10000 }),
    price(2, { supplierId: 'S2', wholesale: 10000 }),
    price(3, { supplierId: 'S3', wholesale: 12000 }),
  ];
  sold('P1', 100, '2026-07-01');
  const tied = scope.priceReviewCandidates();
  t.check(tied.filter((f) => f.isWinner).length === 2,
    'both suppliers at the cheapest price count as winning it');
  t.check(!tied.find((f) => f.row.supplierId === 'S3').isWinner, 'while the dearer one does not');
  // Reversed in the array, the answer must not change.
  data.prices.reverse();
  const rev = scope.priceReviewCandidates();
  t.check(rev.filter((f) => f.isWinner).length === 2,
    'and storing them the other way round does not move the crown');

  /* Out of stock is never the winner: rankedPriceRows leaves those out
     of the running and the buying list will not walk to them.

     Priced EQUAL to the cheapest available one, which is the only shape
     that tells the guard apart from the price comparison beside it — a
     cheaper out-of-stock row already fails on price and proves nothing
     about whether being out of stock was checked. */
  data.prices = [
    price(1, { supplierId: 'S1', wholesale: 10000, outOfStock: true }),
    price(2, { supplierId: 'S2', wholesale: 10000 }),
    price(3, { supplierId: 'S3', wholesale: 12000 }),
  ];
  const oos = scope.priceReviewCandidates();
  t.check(!oos.find((f) => f.row.supplierId === 'S1').isWinner,
    'an out-of-stock row does not win, even at the winning price — nobody can buy it there today');
  t.check(oos.find((f) => f.row.supplierId === 'S2').isWinner,
    'the cheapest one actually available does');

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
  /* WHERE THE REPORT LIVES NOW.

     Analysis stopped being seven panels. It leads with what the books
     FOUND, ranked by what fixing each is worth, and this report is the
     EVIDENCE inside one of those findings rather than a panel of its
     own. So the id it is drawn into changed, and the arithmetic moved
     from renderDashPriceReview into analysisFindings -- but every
     question this section was asking is still asked, of the place that
     now answers it. */
  t.check(/id="dash_findings"/.test(src), 'the report has a home on the Analysis screen');
  t.check(/function renderDashPriceReview\(\)/.test(code), 'and a renderer');
  t.check(/renderDashPriceReview\(\);/.test(extractFunction(src, 'renderDashboard', 'index.html')),
    'drawn with the rest of the dashboard');

  const finds = extractFunction(src, 'analysisFindings', 'index.html');
  t.check(/priceReviewCandidates\(\)/.test(finds) && /priceReviewProgress\(\)/.test(finds),
    'built from the same two functions tested above, not its own arithmetic');
  t.check(/f\.reasons\.join/.test(finds),
    'every row says why it is there, so the ranking can be argued with');

  /* A CHANGE WORTH ARGUING, NOT A LOWERED BAR.
     The old assertion wanted "Nothing to chase" inside this panel: an
     empty list had to be good news said in words rather than a blank
     box. It still must be -- but a screen of seven panels each saying
     its own version of "nothing here" is how Analysis came to be a
     column nobody read to the end of. A finding with nothing to say now
     does not appear at all, and the SCREEN says the good news once,
     naming stale prices among the things it checked. The words moved;
     they were not dropped, and this checks they were not. */
  const render = extractFunction(src, 'renderAnalysis', 'index.html');
  t.check(/ow-empty/.test(render) && /no price you trade is stale/.test(render),
    'an empty list is still good news said in words — now said once, by the screen');
  t.check(/if\(prows\.length\)\{/.test(finds),
    'and the finding is absent rather than empty when there is nothing to chase');

  /* It must NOT follow the dashboard's date range. Every other finding
     answers "how did the chosen window go"; a price does not stop being
     out of date because you were looking at last quarter. The screen
     now says so out loud, beside the window control itself, instead of
     in the fourth sentence of a paragraph nobody reads. */
  t.check(!/dash_range|rangeFrom|rangeTo|dctx\.from|dctx\.to/.test(
      finds.slice(finds.indexOf('priceReviewCandidates'), finds.indexOf('3. WHAT IS OWED'))),
    'the report ignores the dashboard date range — staleness is a fact about now');
  t.check(/Stale prices are not/.test(render),
    'and the rail says so where the window is set, not buried in prose');

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
  /* Was pinned to the single literal `ageFilter === 'review'`. There is
     a second non-age key now -- `odd`, the rows whose figure does not
     fit the evidence around it -- and it is decided the same way, in
     getFilteredPriceRows where the other quotes on the line and the
     purchase invoices are already open. The assertion's MEANING is
     unchanged and is what is pinned here instead: every key this
     predicate cannot decide from one row alone passes straight through
     rather than being half-applied. */
  const worklistKeys = ['review', 'odd'];
  worklistKeys.forEach(k=>{
    t.check(new RegExp(`ageFilter === '${k}'`).test(pred),
      `and passes the ${k} worklist key through untouched rather than pretending to apply it`);
    t.check(new RegExp(`ageFilter === '${k}'[^\\n]*return true;`).test(pred),
      `— through the same early return, so ${k} is never measured as an age`);
  });
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
     three things should be asking about the three that matter.

     Needs S1 to hold TWO chaseable rows of clearly different weight, or
     reversing the list would be indistinguishable from leaving it
     alone -- which is exactly how this claim first passed against a
     reversed list. The cheap one is listed FIRST in the array, so
     entry order and review order disagree. */
  reset();
  data.products = [{ id: 'P1', name: 'Cement' }, { id: 'P2', name: 'Handle' }];
  data.prices = [
    price(10, { productId: 'P2', supplierId: 'S1', wholesale: 500 }),
    price(11, { productId: 'P1', supplierId: 'S1', wholesale: 30000 }),
  ];
  sold('P1', 200, '2026-07-01');
  sold('P2', 200, '2026-07-01');
  const two = scope.supplierAskList('S1');
  eq(two.length, 2, 'both of this supplier’s stale rows are on the list');
  eq(two[0].row.id, 11, 'the one with more money running through it is asked about first');
  const all = scope.priceReviewCandidates().filter((f) => f.row.supplierId === 'S1');
  t.check(two.map((f) => f.row.id).join() === all.map((f) => f.row.id).join(),
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

  /* THE QUANTITY IS NAMED, because this shop's prices are kept against
     one. 193 of its 307 rows have no single-unit price at all --
     ELEPHANT King is 310,000 for three cartons -- so "what is your price
     per Ctn" asks a different question from the one the registry holds,
     and the answer would be filed against a quantity nobody quoted. */
  const tiered = [{ row: { id: 9, pname: 'ELEPHANT King', unit: 'Ctn', packQty: 1,
    packUnit: '', tiers: [{ minQty: 3, price: 310000 }] } }];
  const tm = scope.supplierPriceAskMessage('S1', tiered);
  t.check(/3 Ctn\+/.test(tm) || /3 units\+/.test(tm),
    `the ask names the quantity the price is kept at (${tm.split('\n').find((l) => l.startsWith('•'))})`);
  t.check(!/per Ctn\)/.test(tm),
    'rather than asking per unit for a row that has no per-unit price');

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
  /* And must not GAIN one. The probe can fail for reasons other than
     the column being absent -- a blip on that one request -- and a
     guarded read would then quietly report every row as never asked
     while the stamps sat there in the table. The read is safe on its
     own; only the write can bring an upsert down. */
  t.check(!/\.\.\.\(priceAskedColumn \? \{lastAskedAt/.test(code),
    'and is never made conditional on the probe, which would lose real stamps to a failed request');

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

/* ---------- 15. how fast THIS item's price actually moves --------------
   One flat limit over-flags a door handle and under-flags cement, and
   that noise is what makes people stop reading the warning. Nobody has
   to guess it per item: the shop has been billed for these things, on
   dated invoices, at whatever the price was that day.

   FROM THE PURCHASE INVOICES AND NOTHING ELSE. Two other records look
   like price history and are the same events counted again -- the stock
   log (whose cost and supplierId are stamped in memory and never
   persisted; the columns do not exist) and the receipts on order lines
   (which become purchase invoice lines too). */
{
  const pi = (id, date, items, over) => Object.assign({
    id, date, supplierId: 'S1', voided: false, items,
  }, over);
  const item = (price, qty) => ({ productId: 'P1', variantIdx: null, price, qty: qty || 1 });

  reset();
  data.purchaseInvoices = [
    pi(1, '2026-01-01', [item(10000)]),
    pi(2, '2026-03-01', [item(11000)]),
  ];
  const obs = scope.priceObservations('P1', null, 'S1');
  eq(obs.length, 2, 'each dated invoice line is an observation');
  eq(obs[0].price, 10000, 'carrying what was billed');
  t.check(obs[0].date < obs[1].date, 'oldest first');

  // Not another supplier's, not another item's, not a voided invoice's.
  data.purchaseInvoices.push(pi(3, '2026-02-01', [item(99999)], { supplierId: 'S2' }));
  data.purchaseInvoices.push(pi(4, '2026-02-02', [{ productId: 'P2', variantIdx: null, price: 88888, qty: 1 }]));
  data.purchaseInvoices.push(pi(5, '2026-02-03', [item(77777)], { voided: true }));
  eq(scope.priceObservations('P1', null, 'S1').length, 2,
    'another supplier’s, another item’s and a voided invoice are all left out');

  // A variant's prices are its own.
  data.purchaseInvoices.push(pi(6, '2026-02-04', [{ productId: 'P1', variantIdx: 0, price: 55555, qty: 1 }]));
  eq(scope.priceObservations('P1', null, 'S1').length, 2, 'a variant’s line is not the product’s');
  eq(scope.priceObservations('P1', 0, 'S1').length, 1, 'and belongs to the variant it was billed against');

  /* Two invoices to one supplier on one day is a SPREAD, not a change
     over time -- and it happens on the real books, where PINV-0088 and
     PINV-0089 were both raised on 13 August. Collapsed to one
     observation, weighted by quantity so the big line is not out-voted
     by the small one. */
  reset();
  data.purchaseInvoices = [
    pi(1, '2026-01-01', [item(135000, 49)]),
    pi(2, '2026-01-01', [item(85000, 2)]),
  ];
  const same = scope.priceObservations('P1', null, 'S1');
  eq(same.length, 1, 'one day is one observation, however many invoices it took');
  t.check(same[0].price > 130000,
    `weighted by quantity, so 49 at 135,000 is not out-voted by 2 at 85,000 (got ${Math.round(same[0].price)})`);

  /* Stored out of order, because purchase invoices arrive in whatever
     order the server returned them and an unsorted list turns the
     intervals backwards. Entered newest-first here so insertion order
     and date order disagree. */
  reset();
  data.purchaseInvoices = [
    pi(3, '2026-05-01', [item(12000)]),
    pi(1, '2026-01-01', [item(10000)]),
    pi(2, '2026-03-01', [item(11000)]),
  ];
  eq(scope.priceObservations('P1', null, 'S1').map((o) => o.date).join(),
    '2026-01-01,2026-03-01,2026-05-01',
    'observations come back oldest first however they were stored');
}

/* ---------- 16. and when it refuses to say ----------------------------
   The refusals are the point. Two prices give one interval, which is an
   anecdote rather than a rate. Anything it cannot support honestly comes
   back null and the caller falls back to the flat limit. */
{
  const pi = (id, date, price) => ({ id, date, supplierId: 'S1', voided: false,
    items: [{ productId: 'P1', variantIdx: null, price, qty: 1 }] });

  reset();
  eq(scope.learnedStaleDays('P1', null, 'S1'), null, 'no invoices at all teaches nothing');

  data.purchaseInvoices = [pi(1, '2026-01-01', 10000)];
  eq(scope.learnedStaleDays('P1', null, 'S1'), null, 'one price is not a rate');

  data.purchaseInvoices.push(pi(2, '2026-03-01', 11000));
  eq(scope.learnedStaleDays('P1', null, 'S1'), null, 'two prices are one interval — an anecdote, not a rate');

  data.purchaseInvoices.push(pi(3, '2026-05-01', 12000));
  eq(scope.learnedStaleDays('P1', null, 'S1'), null, 'three still falls short of the three intervals it asks for');

  /* Counted in INTERVALS, and counted once. Guarding on the observation
     count as well read like two checks and was one -- a day is already
     collapsed to a single observation, so the intervals are always
     one fewer -- and two guards that cannot disagree are a place for one
     of them to be weakened without anything noticing. */
  t.check(!/if\(obs\.length < PRICE_LEARN_MIN_INTERVALS \+ 1\) return null;/.test(code),
    'and there is one count guard rather than two that mask each other');

  data.purchaseInvoices.push(pi(4, '2026-07-01', 13000));
  t.check(scope.learnedStaleDays('P1', null, 'S1') !== null,
    'four dated prices spanning half a year is the least it will speak on');

  /* Four observations crammed into one week describe that week, not the
     year. Refused on span even though the count is met. */
  reset();
  data.purchaseInvoices = [
    pi(1, '2026-08-01', 10000), pi(2, '2026-08-02', 11000),
    pi(3, '2026-08-03', 12000), pi(4, '2026-08-05', 13000),
  ];
  eq(scope.learnedStaleDays('P1', null, 'S1'), null,
    'four prices inside five days describe five days, not how the item behaves');
}

/* ---------- 17. what it says when it does speak ----------------------- */
{
  const pi = (id, date, price) => ({ id, date, supplierId: 'S1', voided: false,
    items: [{ productId: 'P1', variantIdx: null, price, qty: 1 }] });
  const learn = (rows) => { reset(); data.purchaseInvoices = rows; return scope.learnedStaleDays('P1', null, 'S1'); };

  /* A price that climbs 10% every 60 days drifts the 5% that counts as
     "moved" in about 30. */
  const fast = learn([pi(1, '2026-01-01', 10000), pi(2, '2026-03-02', 11000),
    pi(3, '2026-05-01', 12100), pi(4, '2026-06-30', 13310)]);
  t.check(fast >= 25 && fast <= 35, `a price climbing 10% every two months is trusted about a month (${fast})`);

  /* A price coming DOWN has moved just as surely as one going up, and an
     item whose supplier keeps cutting is exactly one worth asking about.
     Same shape as the climb above, inverted. */
  const falling = learn([pi(1, '2026-01-01', 13310), pi(2, '2026-03-02', 12100),
    pi(3, '2026-05-01', 11000), pi(4, '2026-06-30', 10000)]);
  t.check(falling >= 25 && falling <= 40,
    `a price falling as fast as the other climbed is watched just as closely (${falling})`);

  /* One that has not moved at all across the same span earns the longest
     interval rather than an infinite one. */
  const flat = learn([pi(1, '2026-01-01', 10000), pi(2, '2026-03-01', 10000),
    pi(3, '2026-05-01', 10000), pi(4, '2026-07-01', 10000)]);
  eq(flat, 365, 'a price that has never moved is trusted for a year, not for ever');

  /* And one that creeps -- 0.3% every four months -- would work out at
     around 2,000 days, which is nobody's idea of a review. The slow
     clamp is what stops it, and only a non-zero creep can tell that
     clamp apart from the never-moved case above. */
  const creep = learn([pi(1, '2026-01-01', 10000), pi(2, '2026-05-01', 10030),
    pi(3, '2026-08-29', 10060), pi(4, '2026-12-27', 10090)]);
  eq(creep, 365, 'a barely-moving price is still looked at once a year rather than in five');

  /* Clamped at both ends. A wildly jumping price must not demand
     checking every other day. */
  const wild = learn([pi(1, '2026-01-01', 10000), pi(2, '2026-02-01', 20000),
    pi(3, '2026-03-01', 10000), pi(4, '2026-04-01', 20000)]);
  t.check(wild >= 14, `even a violently moving price is not chased more often than a fortnight (${wild})`);
  t.check(wild <= 365, 'and nothing exceeds a year');

  /* THE MEDIAN, not the mean: one mistyped invoice must not set the pace
     for the item. Three quiet intervals and one absurd one. */
  const withTypo = learn([pi(1, '2026-01-01', 10000), pi(2, '2026-03-01', 10000),
    pi(3, '2026-05-01', 10000), pi(4, '2026-07-01', 10000), pi(5, '2026-07-20', 900000)]);
  t.check(withTypo >= 200,
    `one absurd invoice among four quiet ones does not drag the whole item to a fortnight (${withTypo})`);
}

/* ---------- 18. the row uses its own limit ---------------------------- */
{
  const pi = (id, date, price) => ({ id, date, supplierId: 'S1', voided: false,
    items: [{ productId: 'P1', variantIdx: null, price, qty: 1 }] });
  reset();
  data.products = [{ id: 'P1', name: 'Cement' }];
  // Climbs fast, so its own limit is far shorter than the shop's 90.
  data.purchaseInvoices = [pi(1, '2026-01-01', 10000), pi(2, '2026-03-02', 11000),
    pi(3, '2026-05-01', 12100), pi(4, '2026-06-30', 13310)];
  data.prices = [price(1, { productId: 'P1', supplierId: 'S1', date: '2026-06-20' })]; // 56 days
  sold('P1', 50, '2026-08-01');

  const f = scope.priceReviewFacts(data.prices[0]);
  t.check(f.learnedLimit !== null && f.limit === f.learnedLimit,
    `the row carries the limit its own invoices support (${f.limit})`);
  t.check(f.limit < scope.priceReviewStaleDays(), 'which here is shorter than the shop-wide one');
  t.check(scope.priceNeedsReview(f),
    'so a 56-day-old price on a fast-moving item IS chased, where the flat 90 would have left it');
  t.check(f.reasons.some((r) => /moves every/.test(r)),
    `and the row says why it was judged on a different number (${f.reasons.join(' · ')})`);

  // A row with no history falls back, and says nothing about moving.
  data.purchaseInvoices = [];
  const bare = scope.priceReviewFacts(data.prices[0]);
  eq(bare.learnedLimit, null, 'with no history there is nothing to learn');
  eq(bare.limit, scope.priceReviewStaleDays(), 'so the shop-wide limit applies');
  t.check(!bare.reasons.some((r) => /moves every/.test(r)),
    'and no claim is made about how fast it moves');
  t.check(!scope.priceNeedsReview(bare), 'a 56-day-old price is not stale at the flat 90');

  // priceStaleDaysFor answers the same question on its own.
  eq(scope.priceStaleDaysFor(data.prices[0]), scope.priceReviewStaleDays(),
    'the helper falls back too');
  eq(scope.priceStaleDaysFor(null), scope.priceReviewStaleDays(),
    'and a missing row gets the default rather than throwing');
}

/* ---------- 19. one source, and why not the other two ------------------ */
{
  const fn = (/function priceObservations[\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(/data\.purchaseInvoices/.test(fn), 'the history is read from the purchase invoices');
  t.check(!/stockLog/.test(fn),
    'and NOT the stock log, whose cost and supplierId are stamped in memory and never persisted');
  t.check(!/receipts/.test(fn),
    'nor the receipts, which become purchase invoice lines too and would double every order-derived price');

  /* The stock log's two dead fields, pinned so nobody builds on them
     again believing they survive. They are written by applyStockDelta,
     mapped by neither side of the sync, and the columns do not exist. */
  const push = (/data\.stockLog\.push\(\{[\s\S]*?\}\);/.exec(code) || [''])[0];
  t.check(/cost:/.test(push) && /supplierId:/.test(push),
    'applyStockDelta does stamp a cost and a supplier onto the entry');
  const load = (/stockLog: \(stockLogR\.data\|\|\[\]\)\.map[\s\S]*?\)\),/.exec(code) || [''])[0];
  const save = (/stockLog: d\.stockLog\.map[\s\S]*?\}\)\),/.exec(code) || [''])[0];
  t.check(!/cost/.test(load) && !/cost/.test(save),
    'but neither side of the sync carries it, so it does not survive a reload — which is why it is not the source here');
}

/* ---------- 20. both settings are reachable ---------------------------
   The sustainable numbers are not known yet, which is exactly why they
   are settings and why the report says what was really achieved. */
{
  t.check(/id="preset_price_stale_days"/.test(src) && /id="preset_price_review_target"/.test(src),
    'both settings have a field in Presets');
  const fn = extractFunction(src, 'renderPresetPriceReview', 'index.html');
  t.check(/data\.presetPriceReview\[key\] = Math\.max\(0, Number\(el\.value\)\|\|0\);/.test(fn),
    'and are saved off the box');
  t.check(/renderPresetPriceReview\(\);/.test(code), 'drawn with the rest of the presets');
  /* Blank means "use the default", which is why zero is stored happily
     and the READERS fall back rather than obeying it -- a shop that
     cleared the box must not end up with a limit of nothing. */
  data.presetPriceReview = { staleDays: 0, targetPerPeriod: 0 };
  eq(scope.priceReviewStaleDays(), 90, 'a cleared limit falls back to the default');
  eq(scope.priceReviewTarget(), 20, 'and so does a cleared target');
  data.presetPriceReview = {};

  // Changing either one changes what the report says, so it is redrawn.
  t.check(/renderDashPriceReview\(\);/.test(fn),
    'and the dashboard is rebuilt, rather than going on reporting against the old numbers');
}

/* ---------- 21. what the supplier said, entered in one go -------------
   The ask goes out as a list, so the reply comes back as a list. Before
   this the only way to record one was to open each row's form in turn --
   eight items, eight round trips, which is how the answering stops
   happening at all.

   THREE OUTCOMES FROM ONE BOX, because that is how a reply arrives. */
{
  const reply = (id, price) => ({ id, price });

  // A price that MOVED.
  reset();
  data.prices = [price(1, { wholesale: 10000, date: '2026-01-01', priceSource: 'manual' })];
  let r = scope.applySupplierReply([reply(1, 12000)]);
  eq(r.changed, 1, 'a different figure is a change');
  eq(scope.purchasePriceAtQty(data.prices[0], 1), 12000, 'and is written');
  eq(data.prices[0].date, TODAY, 'dated today');
  eq(data.prices[0].priceSource, 'confirmed',
    'and filed as their word rather than as a purchase — no money moved');

  // The SAME price: a confirmation, and the figure is not rewritten.
  reset();
  data.prices = [price(1, { wholesale: 10000, date: '2026-01-01', tiers: [{ minQty: 1, price: 10000 }] })];
  r = scope.applySupplierReply([reply(1, 10000)]);
  eq(r.confirmed, 1, 'the same figure is a confirmation');
  eq(r.changed, 0, 'not a change');
  eq(data.prices[0].date, TODAY, 'which still dates the row');
  eq(data.prices[0].tiers.length, 1, 'and invents no tier for a price that did not move');

  /* BLANK: they did not say. The row must be left completely alone --
     recording silence as an answer would clear it off the review list
     and lose the question. */
  reset();
  data.prices = [price(1, { date: '2026-01-01', priceSource: 'manual' })];
  sold('P1', 50, '2026-08-01');
  const before = JSON.stringify(data.prices[0]);
  r = scope.applySupplierReply([reply(1, '')]);
  eq(r.skipped, 1, 'an empty box is not an answer');
  eq(r.confirmed, 0, 'and is not counted as one');
  t.check(JSON.stringify(data.prices[0]) === before, 'the row is untouched, date and all');
  eq(scope.priceReviewCandidates().length, 1, 'so it is still on the list to be asked again');

  ['', null, undefined, 0, -5, 'abc'].forEach((v) => {
    reset();
    data.prices = [price(1, { date: '2026-01-01' })];
    const was = data.prices[0].date;
    scope.applySupplierReply([reply(1, v)]);
    eq(data.prices[0].date, was, `${JSON.stringify(v)} leaves the row alone`);
  });

  // A row that has gone since the ask went out.
  reset();
  data.prices = [];
  eq(scope.applySupplierReply([reply(99, 5000)]).skipped, 1,
    'a row deleted since the ask is skipped rather than throwing');
  eq(scope.applySupplierReply().skipped, 0, 'and no entries at all is no work');

  /* AT THE UNIT THEY WERE ASKED ABOUT, not at the pack.

     Every other fixture here has packQty 0, where "read at one" and
     "read at the pack size" are the same number and nothing can tell
     them apart. This one has a real pack break -- singles at 3,000, a
     carton of twelve at 2,600 -- so the two readings genuinely differ.

     The ask names the item and its unit ("per Bag"), so the reply is the
     single-unit price. Reading it against the pack would call an
     unchanged answer a change, and then write their per-unit figure into
     the bulk slot. */
  reset();
  data.prices = [price(1, { wholesale: 2600, retail: 3000, packQty: 12, date: '2026-01-01' })];
  eq(scope.purchasePriceAtQty(data.prices[0], 1), 3000, 'a single reads the sub-pack price');
  eq(scope.purchasePriceAtQty(data.prices[0], 12), 2600, 'and a dozen reads the pack price');

  r = scope.applySupplierReply([reply(1, 3000)]);
  eq(r.confirmed, 1, 'quoting the single price back is a confirmation of it');
  eq(r.changed, 0, 'not a change against the pack price they were never asked about');

  reset();
  data.prices = [price(1, { wholesale: 2600, retail: 3000, packQty: 12, date: '2026-01-01' })];
  scope.applySupplierReply([reply(1, 2800)]);
  eq(data.prices[0].retail, 2800, 'a new single price lands on the single-price side');
  eq(data.prices[0].wholesale, 2600, 'and leaves the pack rate they did not mention alone');

  /* ---- THE ROW SHAPE THIS SHOP ACTUALLY HAS ------------------------
     All 307 price rows carry tiers, and 193 of them have NO tier
     reaching a single unit -- their break starts at 20, 25, 50.
     ELEPHANT King is 310,000 for three cartons and has no
     single-carton price on file at all.

     Writing a reply at quantity one on those rows corrected the flat
     field and left the tier alone, so the row said one thing at the top
     and another from three up -- and the quote reads the tier. A
     supplier's new price changed nothing anybody was charged. */
  reset();
  data.prices = [price(1, { wholesale: 310000, retail: null, packQty: 1, unit: 'Ctn',
    tiers: [{ minQty: 3, price: 310000 }], date: '2026-01-01' })];
  let slots = scope.priceReplySlots(data.prices[0]);
  eq(slots.length, 1, 'a one-tier row has one thing to ask about');
  eq(slots[0].qty, 3, 'at the quantity the price is actually kept at, not at one');
  eq(slots[0].price, 310000, 'showing the figure on file there');

  scope.applySupplierReply([{ id: 1, qty: slots[0].qty, price: 250000 }]);
  eq(data.prices[0].tiers[0].price, 250000,
    'so a new price lands on the TIER — which is what the quote reads at three cartons');
  eq(scope.purchasePriceAtQty(data.prices[0], 3), 250000, 'and is what an order of three now costs');
  t.check(data.prices[0].wholesale === 250000,
    'the headline follows it, because that tier is the lowest on its side');

  /* A PRICE IS A NUMBER AND A UNIT, AND THE NUMBER ALONE IS NOT A FACT.
   *
   * The live shop that found this: ELEPHANT King is 310,000 a carton on
   * file and 15,500 a dozen on the invoices — twenty dozen to the
   * carton, so the SAME price written two ways. setLineSupplier moves a
   * line to whoever is cheapest today and deliberately leaves the
   * packing alone, so the dozen figure can arrive here against the
   * carton row. Written through, the carton tier reads 15,500 — and the
   * buying plan, which costs every line from this file, then prices a
   * carton at a twentieth of what it costs. Silently, in the one place
   * everything else is measured from.
   */
  reset();
  data.prices = [price(1, { wholesale: 310000, retail: null, packQty: 1, unit: 'Ctn',
    tiers: [{ minQty: 3, price: 310000 }], date: '2026-01-01' })];
  scope.syncPriceRegistryFromPurchase('P1', null, 'S1', 15500, 3, { confirms: true, unit: 'Dzn' });
  eq(data.prices[0].tiers[0].price, 310000,
    'a price quoted per dozen is REFUSED by a row priced per carton — the two are the same money in different units, and writing one into the other is not an update, it is damage');
  eq(data.prices[0].wholesale, 310000, 'the headline is untouched too');
  eq(data.prices[0].date, '2026-01-01',
    'and nothing is dated as confirmed — a write nobody could trust must not leave a footprint saying it was checked today');

  /* The same figure, in the unit the row is actually kept in, still
     lands. The guard has to refuse a mismatch without refusing work. */
  scope.syncPriceRegistryFromPurchase('P1', null, 'S1', 250000, 3, { confirms: true, unit: 'Ctn' });
  eq(data.prices[0].tiers[0].price, 250000, 'the same call in the row’s own unit goes through');

  /* Case and spacing are not a unit change. "Ctn" and " ctn " are the
     same carton, and refusing there would block honest work over
     whitespace. */
  scope.syncPriceRegistryFromPurchase('P1', null, 'S1', 240000, 3, { confirms: true, unit: ' ctn ' });
  eq(data.prices[0].tiers[0].price, 240000, 'and so does the same unit typed differently');

  /* A BLANK UNIT IS NOT A MISMATCH. The app snapshots the unit off this
     same row when it writes a line, so blank on one side usually means
     blank on both; refusing then would block every shop that has never
     typed a unit, to guard a case that cannot be told from it. */
  reset();
  data.prices = [price(2, { wholesale: 10000, unit: 'Bag', tiers: [], date: '2026-01-01' })];
  scope.syncPriceRegistryFromPurchase('P1', null, 'S1', 11000, 1, { confirms: true, unit: '' });
  eq(data.prices[0].wholesale, 11000,
    'a caller that names no unit is trusted, because the alternative blocks the ordinary work of a shop that has never typed one');

  /* Two breaks are two questions. Recording either against the other is
     how a quote comes out wrong at exactly the quantities people order.
     36 of this shop's rows have two. */
  reset();
  data.prices = [price(1, { wholesale: null, retail: 34000, packQty: 0,
    tiers: [{ minQty: 1, price: 34000 }, { minQty: 10, price: 32500 }], date: '2026-01-01' })];
  slots = scope.priceReplySlots(data.prices[0]);
  eq(slots.length, 2, 'a two-tier row is asked about twice');
  eq(slots.map((s) => s.qty).join(), '1,10', 'smallest quantity first');
  /* Each showing the figure at ITS OWN quantity. Reading them all at one
     would put 34,000 beside the bulk box and invite the supplier's bulk
     answer to be compared against the single price. */
  eq(slots.map((s) => s.price).join(), '34000,32500',
    'each price point shows what is on file at that quantity, not all at one');

  scope.applySupplierReply([{ id: 1, qty: 10, price: 31000 }]);
  eq(data.prices[0].tiers[1].price, 31000, 'a bulk answer moves the bulk tier');
  eq(data.prices[0].tiers[0].price, 34000, 'and leaves the single price they did not mention alone');

  /* And the CONFIRMATION is judged at that quantity too. Answering
     32,500 for ten is "unchanged"; judged against the single price of
     34,000 it would read as a change and rewrite a tier nobody moved.
     Only a row whose price differs between one and the break can tell
     those apart -- the one-tier fixture above cannot. */
  reset();
  data.prices = [price(1, { wholesale: null, retail: 34000, packQty: 0,
    tiers: [{ minQty: 1, price: 34000 }, { minQty: 10, price: 32500 }], date: '2026-01-01' })];
  r = scope.applySupplierReply([{ id: 1, qty: 10, price: 32500 }]);
  eq(r.confirmed, 1, 'the bulk price quoted back unchanged is a confirmation');
  eq(r.changed, 0, 'not a change against a single price they were not asked about');
  eq(data.prices[0].tiers[1].price, 32500, 'and the tier is left exactly as it was');

  // A row with no tiers at all is still one question, at one.
  reset();
  data.prices = [price(1, { wholesale: 9000, retail: null, packQty: 0, tiers: [] })];
  slots = scope.priceReplySlots(data.prices[0]);
  eq(slots.length, 1, 'a row with no tiers has a single price point');
  eq(slots[0].qty, 1, 'read at one, which is all its flat fields describe');

  // A whole reply at once, which is the point of the sheet.
  reset();
  data.prices = [
    price(1, { supplierId: 'S1', wholesale: 10000, date: '2026-01-01' }),
    price(2, { supplierId: 'S1', wholesale: 20000, date: '2026-01-01', productId: 'P2' }),
    price(3, { supplierId: 'S1', wholesale: 30000, date: '2026-01-01', productId: 'P3' }),
  ];
  r = scope.applySupplierReply([reply(1, 11000), reply(2, 20000), reply(3, '')]);
  t.check(r.changed === 1 && r.confirmed === 1 && r.skipped === 1,
    `one moved, one held, one unanswered — in a single pass (${JSON.stringify(r)})`);
}

/* ---------- 22. the sheet itself -------------------------------------- */
{
  const open = extractFunction(src, 'openSupplierReply', 'index.html');
  t.check(/supplierAskList\(supplierId\)/.test(open),
    'the sheet is built from the same ask list that went out');

  /* The price on file is SHOWN but the box starts EMPTY. Pre-filling it
     would make "they confirmed it" and "nobody typed anything" the same
     keystroke — and the first is a fact about the supplier while the
     second is a fact about the shop. */
  t.check(/priceReplySlots\(f\.row\)/.test(open) && /fmtUGX\(Math\.round\(s\.price \|\| 0\)\)/.test(open),
    'each price point shows what is on file at that quantity');
  t.check(/data-qty="\$\{s\.qty\}"/.test(open),
    'and its box carries the quantity, so the answer is written where it was asked');
  /* EVERY point, not just the first. 36 of this shop's rows break twice,
     and offering only the lower one silently leaves the bulk price to
     rot while the sheet looks complete. */
  t.check(/rows\.flatMap\(f=> priceReplySlots\(f\.row\)\.map\(/.test(open),
    'and every break on a row gets a line, not just its lowest');
  const save2 = extractFunction(src, 'saveSupplierReply', 'index.html');
  t.check(/qty: Number\(i\.dataset\.qty\)/.test(save2),
    'the quantity survives the trip back out of the DOM — dropping it there would land every answer at one');
  t.check(/class="srp-input"[^>]*placeholder="—"/.test(open) && !/value="\$\{/.test(open.split('srp-input')[1] || ''),
    'and starts empty rather than pre-filled with that figure');

  const save = extractFunction(src, 'saveSupplierReply', 'index.html');
  t.check(/applySupplierReply\(entries\)/.test(save), 'saving goes through the tested function');
  t.check(/if\(!r\.changed && !r\.confirmed\)\{ toast\('Nothing entered/.test(save),
    'a sheet nobody filled in saves nothing and says so');
  t.check(/still to ask/.test(save),
    'and the toast counts what was left unanswered, rather than reporting it as done');
  /* Both screens the answer changes are rebuilt. Without this the
     registry still shows yesterday's date on a row just confirmed, and
     the dashboard goes on listing an item the shop has this minute
     settled -- which teaches people the report is not to be believed. */
  t.check(/triggerPricesRender\(\);/.test(save), 'the registry is redrawn');
  t.check(/renderDashPriceReview\(\);/.test(save),
    'and so is the report, which would otherwise still be asking for what was just answered');
  /* And the suppliers screen, whose band, strip and Standing chips are
     all counts of exactly what was just answered. Left out, entering a
     reply on that screen leaves it insisting the prices are still to be
     confirmed. */
  t.check(/renderSuppliers\(/.test(save),
    'and the buying book, which counts the very prices the sheet just settled');

  /* Reachable beside the ask, since the two halves are one errand.

     It used to be #sstReplyBtn in the supplier modal, wired by id after
     the dialog was written. The modal is gone -- the supplier account
     is a screen now -- so the button lives at the foot of the list of
     prices worth asking about, and goes through the register's one
     delegated listener like every other control on that screen. The
     guarantee is unchanged: whatever draws the ask also offers the way
     to write down the answer. */
  const askBlock = extractFunction(src, 'supplierAskBlockHTML', 'index.html');
  t.check(/data-sact="reply"/.test(askBlock),
    'the list of prices to ask about offers the reply sheet at its foot');
  t.check(/if\(name === 'reply'\) return openSupplierReply\(id\);/.test(src),
    'and the suppliers screen wires it to the sheet');

  /* NOT renderPrBulkVariantRows, which the plan for this named. That
     renders VARIANTS OF ONE PRODUCT, indexed into p.variants with shared
     tiers and packing; this is one supplier and many unrelated products,
     each already carrying its own. Reusing it would have meant faking a
     variants array and dragging along index-based override machinery
     that means nothing here. */
  t.check(!/renderPrBulkVariantRows/.test(open),
    'built for its own shape rather than forced through the variant editor');
}

process.exit(t.done() ? 1 : 0);
