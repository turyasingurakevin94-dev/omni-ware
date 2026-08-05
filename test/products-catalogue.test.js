#!/usr/bin/env node
'use strict';
/*
 * The catalogue, as a list.
 *
 * It was a grid of 270px cards, one per sellable thing, carrying an id,
 * a name, two category pills and the markup RULES. A catalogue is
 * scanned and compared -- what do I have, what does it cost me, what
 * does it sell for -- and a card grid is the one shape that makes
 * comparing hard, because no two figures ever line up in a column.
 *
 * It was also quieter than its own printout. The print button already
 * put stock on the page, on the stated reasoning that "walking the
 * shelves is most of what it is for", while the screen it printed from
 * showed no stock at all.
 *
 * So: one row per line, with the two missing facts -- what it costs to
 * buy, and how many are on the shelf -- in columns that line up.
 *
 * The judgements pinned below:
 *
 *   the cheapest, not      a product with three suppliers has one price
 *   the first              worth showing, and it is the one the buying
 *                          list would actually walk to.
 *   unbuilt is not         a variable product with no variants yet
 *   unpriced               cannot be priced or stocked. Counting it as a
 *                          pricing gap reports a setup step as a fault.
 *   the strip counts       a summary that ignored the filters would
 *   what is LISTED         contradict the rows underneath it.
 *
 * Run: node test/products-catalogue.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('products catalogue');
const src = read('index.html');
const code = src.split(/\r?\n/).map((l) => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');
const data = { products: [], prices: [], stock: {}, suppliers: [] };

const scope = compileScope([
  extractFunction(src, 'productPriceRows', 'index.html'),
  extractFunction(src, 'stockKey', 'index.html'),
  extractFunction(src, 'getStockQty', 'index.html'),
  extractFunction(src, 'productLineStats', 'index.html'),
  extractFunction(src, 'productBestBuy', 'index.html'),
], {
  data,
  supplierName: (id) => (data.suppliers.find((s) => s.id === id) || {}).name || 'Unknown',
  rankedPurchaseRowsAtQty: (productId, variantIdx, qty) =>
    data.prices
      .filter((p) => p.productId === productId && (p.variantIdx == null ? null : p.variantIdx) === variantIdx)
      .map((p) => ({ ...p, purchasePrice: p.buy == null ? null : p.buy }))
      .sort((a, b) => (a.purchasePrice == null ? Infinity : a.purchasePrice)
                    - (b.purchasePrice == null ? Infinity : b.purchasePrice)),
}, ['productLineStats', 'productBestBuy', 'getStockQty']);

const line = extractFunction(src, 'productLineHTML', 'index.html');
const price = (productId, variantIdx, supplierId, buy) => ({ productId, variantIdx, supplierId, buy });
const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);
const reset = () => {
  data.suppliers = [{ id: 'S1', name: 'Katwe Steel' }, { id: 'S2', name: 'Mabati Point' }];
  data.products = []; data.prices = []; data.stock = {};
};

/* ---------- 1. the cheapest supplier, not the first ------------------ */
{
  reset();
  // Listed dearest first on purpose: taking prices[0] would name the
  // wrong supplier and the wrong figure, and a catalogue that disagrees
  // with the buying list about where to go is worse than no figure.
  data.prices = [price('P1', null, 'S2', 32500), price('P1', null, 'S1', 31000)];
  const buy = scope.productBestBuy('P1', null);
  eq(buy.price, 31000, 'the cheapest price is the one shown');
  eq(buy.supplierId, 'S1', 'and the supplier it belongs to');
  eq(buy.suppliers, 2, 'with how many others could supply it');

  // A line nothing can price says so rather than showing a zero, which
  // would read as free.
  const none = scope.productBestBuy('P9', null);
  t.check(none.price === null, 'nothing on file gives no price rather than zero');
  eq(none.suppliers, 0, 'and no suppliers');

  // A price row with no usable figure is still a supplier on file, but
  // not a price.
  data.prices = [price('P2', null, 'S1', null)];
  const unpriced = scope.productBestBuy('P2', null);
  t.check(unpriced.price === null, 'a supplier with no figure yields no price');
  eq(unpriced.suppliers, 1, 'though the supplier is still counted');
}

/* ---------- 2. variants are priced and stocked separately ------------ */
{
  reset();
  data.prices = [price('P2', 0, 'S2', 45000), price('P2', 1, 'S2', 62000)];
  eq(scope.productBestBuy('P2', 0).price, 45000, 'each variant carries its own price');
  eq(scope.productBestBuy('P2', 1).price, 62000, 'and they do not share one');

  data.stock = { 'P2::0': 0, 'P2::1': 22 };
  eq(scope.getStockQty('P2', 0), 0, 'nor their stock');
  eq(scope.getStockQty('P2', 1), 22, 'which is keyed per variant');
}

/* ---------- 3. what the summary counts ------------------------------- */
{
  reset();
  data.prices = [price('P1', null, 'S1', 31000), price('P2', 0, 'S2', 45000)];
  data.stock = { P1: 140, 'P2::0': 0, 'P2::1': 22 };
  const P1 = { id: 'P1' }, P2 = { id: 'P2' }, P3 = { id: 'P3' }, P4 = { id: 'P4' };
  const rows = [
    { p: P1, v: null, idx: null, kind: 'simple' },
    { p: P2, v: {}, idx: 0, kind: 'variant' },
    { p: P2, v: {}, idx: 1, kind: 'variant' },
    { p: P3, v: null, idx: null, kind: 'simple' },        // no price, no stock
    { p: P4, v: null, idx: null, kind: 'variable-empty' },
  ];
  const s = scope.productLineStats(rows);

  eq(s.lines, 5, 'every listed line is counted');
  eq(s.products, 4, 'but four distinct products — two variants are one product');
  eq(s.variants, 2, 'the variants among them');
  eq(s.unbuilt, 1, 'and the one with no variants set up yet');

  /* A variable product with no variants cannot be priced or stocked.
     Counting it as unpriced would report a setup step as a pricing gap,
     and it would be double-counted as out of stock too. */
  eq(s.unpriced, 2, 'unpriced counts P2::1 and P3 — not the unbuilt one');
  eq(s.noStock, 2, 'and out of stock counts P2::0 and P3 — not the unbuilt one either');
}

/* ---------- 4. an empty catalogue ------------------------------------ */
{
  reset();
  const s = scope.productLineStats([]);
  eq(s.lines, 0, 'no lines');
  eq(s.products, 0, 'no products');
  eq(s.unpriced, 0, 'nothing unpriced');
  eq(s.noStock, 0, 'and nothing out of stock, rather than a division by nothing');
}

/* ---------- 5. the screen shows what the paper shows ------------------ */
{
  const render = (/function renderProducts[\s\S]*?\n\}/.exec(code) || [''])[0];

  t.check(/getStockQty/.test(code) && /productBestBuy/.test(code),
    'the on-screen row carries stock and a buying price');
  const rowFn = (/function productLineHTML[\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(/getStockQty\(p\.id, idx\)/.test(rowFn), 'stock is read per line, variant included');
  t.check(/productBestBuy\(p\.id, idx\)/.test(rowFn), 'and so is the price');

  // The card grid is gone, and so are its builders.
  t.check(!/simpleCardHTML|variantCardHTML|variableEmptyCardHTML/.test(code),
    'the three card builders are gone');
  t.check(!/product-grid|product-card/.test(src), 'and nothing is left styling them');

  // Both the list and the printout must come from one row set, or a
  // filtered print could list rows the screen is not showing.
  // Four filters now, still shared between the screen and the sheet.
  t.check((code.match(/productRowsForList\(filter, categoryFilter, supplierFilter, pricedFilter\)/g) || []).length === 2,
    'the list and the printout are built from the same filtered rows');

  // The strip reports the filtered set, not the whole catalogue.
  t.check(/const s = productLineStats\(rows\);/.test(render),
    'the summary counts what is listed, so it cannot contradict the rows under it');
  t.check(/strip\.innerHTML = rows\.length \?/.test(render),
    'and shows nothing at all when nothing matched');
}

/* ---------- 6. back to cards, keeping what the rows were for --------- *
 * The list was asked to go back to the card the catalogue had before it.
 * The rows existed because the card grid "showed neither what a thing
 * costs to buy nor how many are on the shelf" -- so the card comes back
 * carrying both, rather than the look being restored by dropping them.
 */
{
  t.check(/class="price-card/.test(line),
    'a product is a card again, on the same shell the price registry uses');
  t.check(/Costs you/.test(line) && /productBestBuy/.test(code),
    'and it still says what the thing costs to buy');
  t.check(/On the shelf/.test(line) && /getStockQty\(p\.id, idx\)/.test(code),
    'and how many are on the shelf');
  t.check(/\.cat-fig\{[^}]*font-variant-numeric:tabular-nums;/.test(src),
    'with the figures still tabular, so they line up between the cards in a row of them');
  t.check(/cheapest \$\{esc\(supplierName\(buy\.supplierId\)\)\}/.test(line),
    'and the cheapest supplier named, which the printed list has always carried');
}

process.exit(t.done() ? 1 : 0);
