#!/usr/bin/env node
'use strict';
/*
 * Filtering the Price Registry by stock.
 *
 * Out of stock is a fact about ONE supplier's quote, not about the item.
 * The flag is set on a price row, so three suppliers for the same product
 * can be in three different states, and a product is only unobtainable
 * when every quote on it is flagged.
 *
 * So this filters ROWS. A card that keeps only its flagged rows is
 * answering "who is out", which is what somebody with a customer waiting
 * is asking.
 *
 * The knock-on that matters: the "Cheapest" badge is worked out from the
 * rows that survive filtering, and it deliberately never crowns a flagged
 * one. Filtered to out-of-stock, no card has a cheapest -- the right
 * answer, since none of them can be bought from.
 *
 * Run: node test/price-stock-filter.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('price stock filter');
const src = read('index.html');
const code = src.split(/\r?\n/).map((l) => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');

const store = { products: [], prices: [] };
const NAMES = ['priceRowMatchesStock', 'getFilteredPriceRows', 'priceGroupsFor'];
const scope = compileScope([
  extractFunction(src, 'todayISO', 'index.html'),
  extractFunction(src, 'priceAgeDays', 'index.html'),
  extractFunction(src, 'priceRowMatchesStock', 'index.html'),
  extractFunction(src, 'productSearchHaystack', 'index.html'),
  extractFunction(src, 'getFilteredPriceRows', 'index.html'),
  extractFunction(src, 'priceGroupsFor', 'index.html'),
], {
  data: store,
  supplierName: (id) => id,
  productName: (id) => id,
  productVariantLabel: (p) => p.name,
  resolveProductImage: () => null,
  variantLabel: (c) => Object.values(c || {}).join(' '),
  searchTokens: (f) => String(f || '').toLowerCase().split(/\s+/).filter(Boolean),
  matchesAllTokens: (hay, toks) => toks.every((x) => hay.includes(x)),
  priceRowMatchesAge: () => true,
  purchasePriceAtQty: (r) => (r.wholesale == null ? null : r.wholesale),
}, NAMES);

const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);

/* ---------- 1. one row's flag, not the item's ------------------------- */
{
  const f = scope.priceRowMatchesStock;
  t.check(f({ outOfStock: true }, 'out'), 'a flagged row is out of stock');
  t.check(!f({ outOfStock: false }, 'out'), 'an unflagged one is not');
  t.check(f({ outOfStock: false }, 'in'), 'and shows under in stock instead');
  t.check(!f({ outOfStock: true }, 'in'), 'where the flagged one does not');

  // Everything passes when nothing is chosen — the ordinary case.
  t.check(f({ outOfStock: true }, '') && f({ outOfStock: false }, ''),
    'no choice keeps both, which is what the registry has always shown');

  /* A row that has never been flagged has no flag at all rather than a
     false one. Treated as in stock, which is what it is. */
  t.check(f({}, 'in') && !f({}, 'out'), 'a row that was never flagged counts as in stock');
  t.check(f(null, 'in'), 'and no row at all does not throw');
  t.check(f({ outOfStock: true }, 'nonsense'),
    'an unknown filter key keeps everything rather than silently emptying the screen');
}

/* ---------- 2. through the real filter -------------------------------- */
{
  store.products = [{ id: 'P1', name: 'Cement', category: '', type: 'simple' }];
  store.prices = [
    { id: 1, productId: 'P1', variantIdx: null, supplierId: 'A', wholesale: 9000, outOfStock: false, date: '2026-08-01' },
    { id: 2, productId: 'P1', variantIdx: null, supplierId: 'B', wholesale: 3000, outOfStock: true, date: '2026-08-01' },
    { id: 3, productId: 'P1', variantIdx: null, supplierId: 'C', wholesale: 5000, outOfStock: true, date: '2026-08-01' },
  ];
  const ids = (stock) => scope.getFilteredPriceRows('', '', '', '', stock).map((r) => r.id).sort().join(',');
  eq(ids(''), '1,2,3', 'unfiltered, every quote is listed as before');
  eq(ids('out'), '2,3', 'out of stock keeps only the flagged quotes');
  eq(ids('in'), '1', 'and in stock keeps only the rest');

  /* Filtering stock must not disturb the other filters -- they narrow
     together rather than replacing one another. */
  eq(scope.getFilteredPriceRows('', 'B', '', '', 'out').map((r) => r.id).join(','), '2',
    'a supplier filter and a stock filter narrow together');
  eq(scope.getFilteredPriceRows('', 'A', '', '', 'out').length, 0,
    'and a supplier who is in stock has nothing to show under out of stock');
}

/* ---------- 3. the cheapest badge follows the filter ------------------ */
/*
 * The registry never crowns a flagged supplier cheapest, because the
 * buying list will not walk to a yard that has none. Filtered to out of
 * stock, every remaining row is flagged, so no card has a cheapest --
 * which is the honest answer, not a missing feature.
 */
{
  const outRows = scope.getFilteredPriceRows('', '', '', '', 'out');
  const g = scope.priceGroupsFor(outRows, 'added')[0];
  eq(g.rows.length, 2, 'the card keeps its flagged suppliers');
  eq(g.cheapestId, null, 'and crowns none of them cheapest, since none can be bought from');

  const inRows = scope.getFilteredPriceRows('', '', '', '', 'in');
  const g2 = scope.priceGroupsFor(inRows, 'added')[0];
  eq(g2.cheapestId, 1, 'while the in-stock view still names its cheapest');

  // Unfiltered, the flagged 3,000 is still not crowned over the 9,000.
  const all = scope.priceGroupsFor(scope.getFilteredPriceRows('', '', '', '', ''), 'added')[0];
  eq(all.cheapestId, 1, 'and unfiltered it is still the cheapest IN STOCK that is crowned');
}

/* ---------- 4. wired into the screen and the sheet -------------------- */
{
  t.check(/id="pr_stock_filter"/.test(src) && /<label>Stock<\/label>/.test(src),
    'the toolbar has the control, labelled for what it filters');
  /* Built from the same list it is read by, so an option cannot exist
     that the filter does not know -- the reason these are generated. */
  t.check(/stock\.innerHTML = PRICE_STOCK_FILTERS\.map/.test(code),
    'and is built from the list the filter itself reads');
  t.check(/PRICE_STOCK_FILTERS\.find\(f=> f\.key === stockFilter\)/.test(code),
    'which the printed sheet also reads, so it can name the slice it is');

  const trigger = extractFunction(src, 'triggerPricesRender', 'index.html');
  t.check(/document\.getElementById\('pr_stock_filter'\)\.value/.test(trigger),
    'the chosen value reaches the render');
  t.check(/stock\.addEventListener\('change', triggerPricesRender\);/.test(code),
    'and changing it redraws');

  /* Applied in the row builder, not the renderer: the printout has to
     carry the rows the screen is showing. */
  t.check(/if\(stockFilter\) rows = rows\.filter\(r=> priceRowMatchesStock\(r, stockFilter\)\);/.test(code),
    'the filter is applied where the rows are built, so screen and printout agree');
  t.check((code.match(/getFilteredPriceRows\(filter, supplierFilter, categoryFilter, ageFilter, stockFilter\)/g) || []).length === 2,
    'and both the screen and the printout ask for the same rows');

  /* "No matches" would read as an empty registry. "Nothing is out of
     stock" reads as the good news it is. */
  t.check(/Nothing is marked out of stock/.test(code),
    'an empty out-of-stock view says so in words, rather than looking like an empty registry');
  t.check(/Everything matching your other filters is marked out of stock/.test(code),
    'and an empty in-stock view says the opposite, which is the bad news it is');
}

process.exit(t.done() ? 1 : 0);
