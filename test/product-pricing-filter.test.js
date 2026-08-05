#!/usr/bin/env node
'use strict';
/*
 * Filtering the product list by whether a line has a price yet.
 *
 * The shop asked for two lists it could print: what is priced, and what
 * is not. The second is the one that does work -- it is carried out to
 * go and FIND the prices -- and the first is a reference.
 *
 * THE CASE THAT DECIDES THE DESIGN is a variable product with no
 * variants yet. It has no sellable line at all, so it cannot be priced;
 * calling it "not priced" would put a setup step at the top of a pricing
 * worklist and send somebody out to price a thing that does not exist to
 * be priced. So it is in NEITHER list, and both the screen and the sheet
 * say how many lines they are holding back -- dropping rows silently is
 * how somebody concludes a product has gone missing.
 *
 * The other case worth naming: the filter works on SELLABLE LINES, not
 * on products. An iron sheet with two gauges, one priced and one not,
 * appears on both lists -- because what the person going out needs to
 * know is that it is the 30-gauge that is missing, not "iron sheet".
 *
 * Run: node test/product-pricing-filter.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('product pricing filter');
const src = read('index.html');
const code = src.split(/\r?\n/).map((l) => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');

const data = { products: [], prices: [] };
const NAMES = ['productPriceRows', 'productLineIsPriced', 'productRowsForList',
  'productLinesNotPriceable', 'productLineStats'];
const scope = compileScope([
  ...NAMES.map((n) => extractFunction(src, n, 'index.html')),
], {
  data,
  supplierName: () => 'A supplier',
  searchTokens: (f) => String(f || '').toLowerCase().split(/\s+/).filter(Boolean),
  matchesAllTokens: (hay, toks) => toks.every((x) => hay.includes(x)),
  variantLabel: (combo) => Object.values(combo).join(' / '),
  getStockQty: () => 0,
}, NAMES);

const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);
const simple = (id, name, category) => ({ id, name, type: 'simple', category, subcategory: '' });
const variable = (id, name, category, variants) =>
  ({ id, name, type: 'variable', category, subcategory: '', variants });
const price = (n, productId, variantIdx) =>
  ({ id: n, productId, variantIdx, supplierId: 'S1', retail: 1000, tiers: [] });
const label = (r) => r.p.id + (r.kind === 'variant' ? '/' + r.idx : (r.kind === 'variable-empty' ? '/none' : ''));
const list = (priced) => scope.productRowsForList('', '', '', priced).map(label);

/* ---------- 1. the two halves and the thing in neither -------------- */
{
  data.products = [
    simple('P1', 'Cement 50kg', 'Cement'),
    simple('P2', 'Wheelbarrow', 'Tools'),
    // One gauge priced, one not -- the reason this works on lines.
    variable('P3', 'Iron sheet', 'Roofing', [{ combo: { Gauge: '28' } }, { combo: { Gauge: '30' } }]),
    // Nothing to price yet.
    variable('P4', 'Paint', 'Finishes', []),
  ];
  data.prices = [price(1, 'P1', null), price(2, 'P3', 0)];

  eq(list('').join(','), 'P1,P2,P3/0,P3/1,P4/none', 'unfiltered, every line is listed as before');
  eq(list('priced').join(','), 'P1,P3/0', 'priced is the lines with a price entry on file');
  eq(list('unpriced').join(','), 'P2,P3/1', 'and not-priced is the lines without one');

  /* One product, both lists. The person going out needs to know it is
     the 30-gauge that is missing, not "iron sheet". */
  t.check(list('priced').includes('P3/0') && list('unpriced').includes('P3/1'),
    'a product with one gauge priced and one not appears on both, as the two separate lines it is');

  /* The case the design turns on. A variable product with no variants
     cannot be priced, so calling it unpriced would send somebody out to
     price something that does not exist to be priced. */
  t.check(scope.productLineIsPriced({ p: data.products[3], idx: null, kind: 'variable-empty' }) === null,
    'a product with no variants yet is neither priced nor unpriced');
  t.check(!list('priced').includes('P4/none') && !list('unpriced').includes('P4/none'),
    'so it is in neither list');
  eq(scope.productLinesNotPriceable('', '', ''), 1,
    'but it is counted, so the list can say what it is holding back');

  /* Nothing lost and nothing counted twice. The two halves plus the
     lines that cannot be priced have to account for every line, or a
     filter is quietly losing stock. */
  eq(list('priced').length + list('unpriced').length + scope.productLinesNotPriceable('', '', ''),
    list('').length,
    'the two lists and the held-back lines account for every line exactly once');
}

/* ---------- 2. it agrees with the strip above it -------------------- */
{
  /* productLineStats already refused to count a variantless product as a
     pricing gap. A filter that disagreed with the summary sitting on top
     of it would leave the screen contradicting itself. */
  const all = scope.productRowsForList('', '', '', '');
  eq(scope.productLineStats(all).unpriced, list('unpriced').length,
    'the strip\'s "without a price" count is exactly what the not-priced filter lists');
  eq(scope.productLineStats(all).unbuilt, scope.productLinesNotPriceable('', '', ''),
    'and its "with no variants yet" count is exactly what is held back');
}

/* ---------- 3. it narrows what the other filters left --------------- */
{
  eq(scope.productRowsForList('', 'Roofing', '', 'unpriced').map(label).join(','), 'P3/1',
    '"not priced in Roofing" means not priced AND in Roofing');
  eq(scope.productRowsForList('', 'Cement', '', 'unpriced').length, 0,
    'a category where everything is priced yields nothing rather than everything');
  eq(scope.productRowsForList('iron', '', '', 'priced').map(label).join(','), 'P3/0',
    'and it composes with the search box too');

  /* What is held back is held back FROM THE FILTERED LIST. Counted over
     the whole catalogue instead, a list narrowed to Roofing would
     announce it was hiding a paint tin -- and every check that called
     this with no filters at all passed happily either way. */
  eq(scope.productLinesNotPriceable('', 'Finishes', ''), 1,
    'the paint with no variants is held back from its own category');
  eq(scope.productLinesNotPriceable('', 'Roofing', ''), 0,
    'but a list narrowed to Roofing holds nothing back, having nothing of the kind in it');

  // An unknown value is not a filter. Better to list everything than to
  // silently list nothing.
  eq(scope.productRowsForList('', '', '', 'nonsense').length, list('').length,
    'an unrecognised value filters nothing rather than emptying the list');
}

/* ---------- 4. a price entry with no figure in it ------------------- */
{
  /* "Priced" means a price entry EXISTS, which is what productLineStats
     has always meant by it and what keeps the two agreeing. A row whose
     figures were never filled in is a malformed entry -- a different
     problem, and the price registry is where it shows. Pinned so the
     meaning is a decision on the record rather than an accident. */
  data.products = [simple('P9', 'Half-entered', 'Tools')];
  data.prices = [{ id: 9, productId: 'P9', variantIdx: null, supplierId: 'S1', retail: null, tiers: [] }];
  eq(list('priced').join(','), 'P9', 'a line with a price entry counts as priced');
  eq(list('unpriced').length, 0, 'even if the figures on that entry were never filled in');
}

/* ---------- 5. what the screen and the sheet say -------------------- */
{
  const render = (/function renderProducts[\s\S]*?\n\}\n/.exec(code) || [''])[0];
  t.check(/productRowsForList\(filter, categoryFilter, supplierFilter, pricedFilter\)/.test(render),
    'the list on screen is the filtered one');
  t.check(/productLinesNotPriceable\(filter, categoryFilter, supplierFilter\)/.test(render),
    'and it works out what it is holding back');
  t.check(/in neither list/.test(render), 'and says so where the missing rows would have been');

  /* The empty states are different sentences because they mean different
     things: nothing left to price is good news, nothing priced yet is
     not. "No products match your filters" said neither. */
  t.check(/Every line that matches has a price on file/.test(render)
    && /Nothing that matches has been priced yet/.test(render),
    'an empty list says which of the two emptinesses it is');

  const prt = (/p_print_btn'\)\.addEventListener[\s\S]*?\n\}\);/.exec(code) || [''])[0];
  t.check(/productRowsForList\(filter, categoryFilter, supplierFilter, pricedFilter\)/.test(prt),
    'the sheet prints exactly what the screen is listing');
  t.check(/with no price on file/.test(prt) && /with a price on file/.test(prt),
    'and names the pricing filter in its header, so a partial list cannot pass for the whole one');
  t.check(/held \? /.test(prt), 'and says on paper what it is leaving off');

  /* The two sheets are printed for opposite errands. The not-priced one
     is a worklist carried out to find prices, so it carries a box to
     write them into; printing a cost column of blanks would waste the
     trip. */
  t.check(/const worklist = pricedFilter === 'unpriced';/.test(prt),
    'the not-priced sheet knows it is a worklist');
  t.check(/Price found/.test(prt) && /class="write"/.test(prt),
    'and carries an empty column to write the price into');
  t.check(/Costs to buy/.test(prt) && /productBestBuy\(r\.p\.id, r\.idx\)/.test(prt),
    'while the other carries what it costs to buy, from the same ranking the buying list uses');
  /* A line with no price on file prints blank, never 0 -- a zero here
     reads as "free", which is the one thing it never means. */
  t.check(/buy && buy\.price!=null \? esc\(fmtUGX\(Math\.round\(buy\.price\)\)\) : ''/.test(prt),
    'and a missing cost prints blank rather than as zero');
}

process.exit(t.done() ? 1 : 0);
