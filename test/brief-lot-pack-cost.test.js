#!/usr/bin/env node
'use strict';
/*
 * A stock lot that carries the carton's cost per dozen.
 *
 * ELEPHANT King — Short / Single Lock: bought at 290,000 a carton of
 * 20 Dozen, a 10,000 wholesale markup, sold at 300,000 a carton, which
 * is 15,000 a Dozen. The customer had paid 15,000 a Dozen. Their
 * picture offered them 290,500 a Dozen, and the owner was told of a
 * "rise" from 15,000.
 *
 * The lot said 290,000 a Dozen: the carton figure, typed at a
 * question that asked per Dozen. Marked up per Dozen -- 10,000 spread
 * over 20 -- that is 290,500. Two things are checked here:
 *
 *   1. briefPriceFor reads the lot against the supplier's row, sees
 *      the carton figure, prices from it divided down, and NAMES it;
 *   2. the delivery prompts now notice the same figure being typed and
 *      ask, so the next lot is right.
 *
 * Everything is extracted from index.html; no copy of the logic lives
 * here.
 *
 * Run: node test/brief-lot-pack-cost.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('brief lot pack cost');
const src = read('index.html');
const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);
const near = (got, want, msg) => t.check(Math.abs(got - want) < 1e-6, `${msg} (got ${got}, want ${want})`);

const KING = { id: 'P-EK', name: 'ELEPHANT King', type: 'variable', unit: 'Dozen',
  wholesaleMarkupType: 'fixed', wholesaleMarkupValue: 10000,
  variants: [{ combo: { Type: 'Short / Single Lock' } }] };
const data = {
  products: [KING],
  prices: [{ productId: 'P-EK', variantIdx: 0, supplierId: 'S1', unit: 'Dozen', packUnit: 'Ctn', packQty: 20, wholesale: 14500 }],
  presetDefaultMarkup: {},
  stock: {}, stockLots: {},
};
const asks = [];
let answer = true;
const env = {
  data,
  productById: (id)=> data.products.find(p=> p.id === id) || null,
  productPriceRows: (productId, variantIdx=null)=> data.prices.filter(p=> p.productId === productId
    && (p.variantIdx == null ? null : p.variantIdx) === variantIdx),
  rankedPriceRows: (productId, variantIdx=null)=> env.productPriceRows(productId, variantIdx).filter(r=> !r.outOfStock),
  fmtUGX: (n)=> Number(n).toLocaleString('en-UG') + ' UGX',
  confirm: (msg)=> { asks.push(msg); return answer; },
};
const NAMES = ['briefPriceFor', 'briefPriceRows', 'briefPriceKind', 'packFigurePerUnit', 'packFigureAtTheDoor',
  'shelfValueForKey', 'stockKey', 'purchasePriceAtQty', 'purchaseSideAtQty', 'tieredUnitPrice', 'tiersForKind',
  'sellSideFor', 'effectiveMarkupRule', 'effectiveStockMarkupRule', 'suggestedSellingPrice', 'suggestedStockSellingPrice'];
const fns = compileScope([
  extractDeclaration(src, 'BRIEF_PACK_FIGURE_PCT', 'index.html'),
  ...NAMES.map((n)=> extractFunction(src, n, 'index.html')),
], env, NAMES);

const shelf = (qty, cost)=> {
  data.stock = { 'P-EK::0': qty };
  data.stockLots = qty > 0 ? { 'P-EK::0': [{ qty, cost }] } : {};
};

/* ---- 1. the lot carries the carton figure ----------------------------- */
{
  shelf(40, 290000);
  const px = fns.briefPriceFor('P-EK', 0, 35);
  eq(px.price, 15000, '290,000 a Dozen on the lot, against 14,500 on the row for a 20-Dozen Ctn, prices at 15,000 a Dozen -- 300,000 the Ctn');
  eq(px.kind, 'wholesale', 'on the wholesale side, where 35 Dozen is sold');
  eq(px.source, 'shelf', 'still off the shelf: the goods in the yard set the price');
  eq(px.cost, 14500, 'at the cost the shelf really carries, read per Dozen');
  eq(px.packCost && px.packCost.held, 290000, 'and the figure the lot actually says is carried out, to be named');
  eq(px.packCost && px.packCost.packQty, 20, 'with the pack that explains it');
  eq(px.packCost && px.packCost.packUnit, 'Ctn', 'and its name');
  eq(px.packCost && px.packCost.unit, 'Dozen', 'and the unit the line is kept in');
}

/* ---- 2. a lot that is right is left alone ---------------------------- */
{
  shelf(40, 14500);
  const px = fns.briefPriceFor('P-EK', 0, 35);
  eq(px.price, 15000, 'a lot at 14,500 a Dozen prices at 15,000');
  eq(px.packCost, null, 'and nothing is said about it');

  shelf(40, 20000);
  const dear = fns.briefPriceFor('P-EK', 0, 35);
  eq(dear.price, 20500, 'a lot genuinely dearer than the row is priced as it stands');
  eq(dear.packCost, null, 'because 20,000 is not 20 x 14,500');

  shelf(40, 300000);
  const moved = fns.briefPriceFor('P-EK', 0, 35);
  eq(moved.price, 15500, 'a carton that has since moved to 300,000 is still the carton figure, priced from 15,000 a Dozen');
  eq(moved.packCost && moved.packCost.held, 300000, 'and named at the figure the lot says');

  shelf(0, null);
  const off = fns.briefPriceFor('P-EK', 0, 35);
  eq(off.price, 15000, 'with nothing on the shelf the row prices it');
  eq(off.source, 'registry', 'off the registry');
  eq(off.packCost, null, 'and there is no lot to name');
}

/* ---- 3. and at the door, the same figure is asked about -------------- */
{
  asks.length = 0; answer = true;
  near(fns.packFigureAtTheDoor(290000, 14500, 20, 'Ctn', 'Dozen'), 14500, '290,000 typed at "each Dozen" against 14,500 expected is asked about, and OK records 14,500');
  eq(asks.length, 1, 'one question');
  t.check(/290,000 UGX is about 20 × 14,500 UGX/.test(asks[0]), `the question shows the arithmetic (${asks[0].split('\n')[0]})`);
  t.check(/14,500 UGX per Dozen/.test(asks[0]), 'and what OK will record');

  asks.length = 0; answer = false;
  eq(fns.packFigureAtTheDoor(290000, 14500, 20, 'Ctn', 'Dozen'), 290000, 'Cancel keeps the figure as typed: they really charge that each');

  asks.length = 0;
  eq(fns.packFigureAtTheDoor(14500, 14500, 20, 'Ctn', 'Dozen'), 14500, 'the expected figure is not questioned');
  eq(fns.packFigureAtTheDoor(15000, 14500, 20, 'Ctn', 'Dozen'), 15000, 'nor a dozen that has moved a little');
  eq(fns.packFigureAtTheDoor(290000, 14500, 0, '', 'Dozen'), 290000, 'nor anything on a line with no pack');
  eq(fns.packFigureAtTheDoor(290000, null, 20, 'Ctn', 'Dozen'), 290000, 'nor a line with nothing expected to measure against');
  eq(asks.length, 0, 'and none of those asked');
}

/* Non-zero on a failure, or run-all.js reads the exit status of a
   file that failed as a file that passed. */
process.exit(t.done() ? 1 : 0);
