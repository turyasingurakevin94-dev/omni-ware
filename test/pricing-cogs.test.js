#!/usr/bin/env node
'use strict';
/*
 * The cost side of the pricing engine: what a quote line records as having
 * cost the shop.
 *
 * tier-pricing-parity already checks the four implementations agree on what
 * a CUSTOMER is charged. Nothing checked the other half of the line. Both
 * halves feed Sales Analytics, the Executive Dashboard and every margin
 * figure the shop makes decisions on, and the cost half had two ways of
 * being wrong -- one that halved it and one that zeroed it.
 *
 * Run: node test/pricing-cogs.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('pricing/COGS');
const src = read('index.html');

const NAMES = ['tiersForKind', 'tieredUnitPrice', 'purchasePriceAtQty', 'ipLineBuyPrice',
  'stockKey', 'addStockLot', 'consumeStockLots', 'getFIFOUnitCost'];
const data = { stockLots: {} };
const fn = compileScope(NAMES.map((n) => extractFunction(src, n, 'index.html')), { data }, NAMES);

// A supplier who sells loose at 30,000 and by the 12-carton at 15,000.
const row = (extra) => Object.assign({
  supplierId: 'S1', wholesale: 15000, retail: 30000, packQty: 12, packUnit: 'Ctn', unit: 'pc', tiers: [],
}, extra || {});

/* ---------- 1. the quantity decides which side you pay ---------------- */
{
  const r = row();
  t.check(fn.purchasePriceAtQty(r, 1) === 30000,
    `buying one unit costs the loose rate (${fn.purchasePriceAtQty(r, 1)})`);
  t.check(fn.purchasePriceAtQty(r, 11) === 30000, 'still loose one short of a full pack');
  t.check(fn.purchasePriceAtQty(r, 12) === 15000,
    `a full pack earns the pack rate (${fn.purchasePriceAtQty(r, 12)})`);
  t.check(fn.purchasePriceAtQty(r, 100) === 15000, 'and everything above it');
}
{
  // Falls back to whichever side exists rather than reporting nothing.
  t.check(fn.purchasePriceAtQty(row({ wholesale: null }), 24) === 30000,
    'a supplier with no pack rate is costed at their loose rate even for a big order');
  t.check(fn.purchasePriceAtQty(row({ retail: null }), 1) === 15000,
    'a supplier with no loose rate is costed at their pack rate even for one unit');
}

/* ---------- 2. what a supplier-sourced line records ------------------- */
/*
 * The bug. This took the wholesale figure whenever the supplier had one,
 * regardless of quantity -- so one unit from the supplier above was costed
 * at 15,000 rather than 30,000. Sell it at 35,000 and the line reported
 * 20,000 profit against a real 5,000.
 */
{
  const r = row();
  t.check(fn.ipLineBuyPrice('S1', r, 1, null) === 30000,
    `one unit is costed at what one unit actually costs (${fn.ipLineBuyPrice('S1', r, 1, null)})`);
  t.check(fn.ipLineBuyPrice('S1', r, 12, null) === 15000,
    'a full pack is costed at the pack rate');
  t.check(fn.ipLineBuyPrice('S1', r, 1, null) === fn.purchasePriceAtQty(r, 1),
    'the line cost is exactly what the Purchase screen would rank this supplier by');
}
{
  const r = row({ tiers: [{ minQty: 24, price: 13000 }] });
  t.check(fn.ipLineBuyPrice('S1', r, 24, null) === 13000,
    `a volume tier the quantity reaches is what gets recorded (${fn.ipLineBuyPrice('S1', r, 24, null)})`);
  t.check(fn.ipLineBuyPrice('S1', r, 12, null) === 15000,
    'a tier the quantity does not reach is not applied');
}
{
  t.check(fn.ipLineBuyPrice('S1', null, 5, null) === 0,
    'with no price row at all there is nothing to cost the line at');
}

/* ---------- 3. what an off-the-shelf line records --------------------- */
{
  const r = row();
  t.check(fn.ipLineBuyPrice('__stock__', r, 1, 22000) === 22000,
    'stock with a known cost is recorded at what it actually cost');
  t.check(fn.ipLineBuyPrice('__stock__', r, 1, 0) === 0,
    'a genuinely free unit is recorded as free, not mistaken for unknown');
}
{
  // The zero-cost trap. Only a Purchase records a cost; a stock count --
  // how opening inventory gets entered -- and an un-invoice reversal both
  // add costless lots. Selling those recorded a cost of nothing at all.
  const r = row();
  const got = fn.ipLineBuyPrice('__stock__', r, 1, null);
  t.check(got === 30000,
    `stock with no cost on file falls back to what replacing it costs, not zero (${got})`);
  t.check(fn.ipLineBuyPrice('__stock__', r, 12, null) === 15000,
    'and that replacement cost follows the quantity too');
  t.check(fn.ipLineBuyPrice('__stock__', null, 1, null) === 0,
    'with no supplier price to estimate from there is genuinely nothing to say');
}

/* ---------- 4. the two copies of this are now one --------------------- */
/*
 * The popup previewed a Buy @ and the save wrote one, from two separate
 * copies of the same expression. They agreed only for as long as nobody
 * edited one of them.
 */
{
  const uses = (src.match(/ipLineBuyPrice\(/g) || []).length;
  t.check(uses >= 4,
    `the preview, the saved line and the stock card all go through one function (${uses} references incl. definition)`);
  t.check(!/Math\.round\(tieredUnitPrice\(refRow, qty, refRow\.wholesale!=null \? 'wholesale' : 'retail'\)\)/.test(src),
    'the quantity-blind wholesale-if-present expression is gone from both places');
  t.check(!/stockCost!=null \? Math\.round\(stockCost\) : 0/.test(src),
    'and so is the zero fallback for uncosted stock');
}

/* ---------- 4b. suppliers are ranked for the quantity being bought ---- */
/*
 * The cards said "cheapest" while sorting on the flat wholesale figure. A
 * supplier cheap by the carton outranked one cheaper for the single unit
 * actually being bought, and anyone with no wholesale price at all sat
 * behind every supplier who had one, however expensive they were.
 */
{
  // A: cheap by the carton, dear loose. B: no carton price, moderate loose.
  const A = { supplierId: 'A', wholesale: 15000, retail: 40000, packQty: 12, tiers: [] };
  const B = { supplierId: 'B', wholesale: null, retail: 25000, packQty: 12, tiers: [] };
  const rank = (rows, qty) => rows
    .map((r) => ({ id: r.supplierId, price: fn.purchasePriceAtQty(r, qty) }))
    .sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity))
    .map((r) => r.id);

  t.check(rank([A, B], 1).join(',') === 'B,A',
    `buying one, the supplier who is actually cheaper for one comes first (${rank([A, B], 1).join(',')})`);
  t.check(rank([A, B], 12).join(',') === 'A,B',
    `buying a carton, the carton price wins (${rank([A, B], 12).join(',')})`);

  // The old comparator, for contrast: wholesale first with null as Infinity.
  const oldRank = [A, B].slice().sort((a, b) => {
    const aw = a.wholesale != null ? a.wholesale : Infinity;
    const bw = b.wholesale != null ? b.wholesale : Infinity;
    return aw - bw;
  }).map((r) => r.supplierId);
  t.check(oldRank.join(',') === 'A,B',
    'the old flat sort put A first at every quantity, including one unit at 40,000 against B at 25,000');
}
{
  // A volume tier has to be able to change the order as the quantity crosses it.
  const A = { supplierId: 'A', wholesale: 15000, retail: 30000, packQty: 12, tiers: [] };
  const B = { supplierId: 'B', wholesale: 16000, retail: 30000, packQty: 12, tiers: [{ minQty: 24, price: 11000 }] };
  const rank = (qty) => [A, B]
    .map((r) => ({ id: r.supplierId, price: fn.purchasePriceAtQty(r, qty) }))
    .sort((a, b) => a.price - b.price).map((r) => r.id);
  t.check(rank(12).join(',') === 'A,B' && rank(24).join(',') === 'B,A',
    `a steeper tier overtakes once the quantity reaches it (12: ${rank(12).join(',')}, 24: ${rank(24).join(',')})`);
}
{
  const stage = extractFunction(src, 'renderIpStage', 'index.html');

  // The ranking itself now lives in one place. It was written out here and
  // again in Inventory > Purchase, with the same comment explaining why --
  // and the buying list needed it a third time. Three copies of "which
  // supplier is cheapest" is three chances for the buying list to disagree
  // with the screen the buyer used to choose.
  const ranker = extractFunction(src, 'rankedPurchaseRowsAtQty', 'index.html');
  t.check(/\.map\(r=>\(\{\.\.\.r, purchasePrice: purchasePriceAtQty\(r, qty\)\}\)\)/.test(ranker),
    'the shared ranker works out what each supplier charges for this quantity');
  // Computing it is not the same as sorting on it -- the comparator has to
  // actually read purchasePrice, or the flat figure can quietly drive the
  // order while the quantity-aware number sits there unused.
  const sortBody = /\.sort\(\(a,b\)=>\{([\s\S]*?)\}\);/.exec(ranker);
  t.check(sortBody && /a\.purchasePrice/.test(sortBody[1]) && /b\.purchasePrice/.test(sortBody[1])
    && !/a\.wholesale/.test(sortBody[1]),
    'and sorts on that figure rather than on the flat wholesale one');
  t.check(/rankedPriceRows\(productId, variantIdx\)/.test(ranker),
    'starting from the out-of-stock-filtered list, so a supplier who cannot supply cannot win');

  // Everyone who ranks by quantity goes through it.
  const inv = extractFunction(src, 'renderInvPurchaseStage', 'index.html');
  [['the quote screen', stage], ['Inventory > Purchase', inv]].forEach(([what, fn]) => {
    t.check(/rankedPurchaseRowsAtQty\(/.test(fn), `${what} uses the shared ranker`);
    t.check(!/\.map\(r=>\(\{\.\.\.r, purchasePrice: purchasePriceAtQty/.test(fn),
      `and no longer carries its own copy of it (${what})`);
  });

  // Order matters: the ranking cannot be built before there is a quantity.
  const iQty = stage.indexOf('const qty = ipComputeQty');
  const iRank = stage.indexOf('const ranked = rankedPurchaseRowsAtQty');
  const iTop3 = stage.indexOf('const top3 = ranked.slice');
  t.check(iQty > -1 && iRank > iQty && iTop3 > iRank,
    'the quantity is settled first, then the ranking, then the cards');
  // ...and the things that must be decided before a quantity exists still are.
  t.check(/const contextRow = staticRanked\.find/.test(stage) && /const packQty = contextRow/.test(stage),
    'packing context still comes from the flat list, since the quantity may be typed in packs');
  t.check(stage.indexOf('const contextRow') < iQty,
    'that context is established before the quantity is read');
  t.check(/const top3 = ranked\.slice\(0, 3\)/.test(stage) && !/const top3 = staticRanked/.test(stage),
    'the cards are drawn from the quantity-aware ranking, not the flat one');
}

/* ---------- 5. FIFO costing itself ------------------------------------ */
{
  data.stockLots = {};
  fn.addStockLot('P1', null, 10, 1000);
  fn.addStockLot('P1', null, 10, 1200);
  t.check(fn.getFIFOUnitCost('P1', null) === 1000, 'the oldest lot prices the stock on hand');
  fn.consumeStockLots('P1', null, 10);
  t.check(fn.getFIFOUnitCost('P1', null) === 1200,
    'once the oldest lot is used up the next one prices it');
  fn.consumeStockLots('P1', null, 5);
  t.check(fn.getFIFOUnitCost('P1', null) === 1200 && data.stockLots['P1'][0].qty === 5,
    'a partial draw leaves the rest of the lot at its own cost');
}
{
  // A stock count adds a lot with no cost. It still holds real units, so it
  // is still consumed in order -- it just cannot price anything.
  data.stockLots = {};
  fn.addStockLot('P1', null, 5, null);
  t.check(fn.getFIFOUnitCost('P1', null) === null,
    'stock whose cost was never recorded reports no cost rather than zero');
  fn.addStockLot('P1', null, 5, 900);
  t.check(fn.getFIFOUnitCost('P1', null) === 900,
    'a costless lot is skipped for pricing in favour of one that knows its cost');
  fn.consumeStockLots('P1', null, 5);
  t.check(data.stockLots['P1'].length === 1 && data.stockLots['P1'][0].cost === 900,
    'but it is still consumed first, because it is still real stock');
}
{
  data.stockLots = {};
  fn.addStockLot('P1', null, 5, 100);
  fn.consumeStockLots('P1', null, 999);
  t.check((data.stockLots['P1'] || []).length === 0 && fn.getFIFOUnitCost('P1', null) === null,
    'drawing more than exists empties the lots rather than going negative');
  fn.addStockLot('P1', null, 0, 100);
  fn.addStockLot('P1', null, -3, 100);
  t.check((data.stockLots['P1'] || []).length === 0,
    'a zero or negative lot is not created at all');
}
{
  // Variants are costed separately from the plain product.
  data.stockLots = {};
  fn.addStockLot('P1', null, 5, 100);
  fn.addStockLot('P1', 0, 5, 700);
  t.check(fn.getFIFOUnitCost('P1', null) === 100 && fn.getFIFOUnitCost('P1', 0) === 700,
    'a variant keeps its own cost lots, separate from the product-level ones');
}

process.exit(t.done() ? 1 : 0);
