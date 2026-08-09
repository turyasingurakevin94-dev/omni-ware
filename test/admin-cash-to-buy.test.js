#!/usr/bin/env node
'use strict';
/*
 * How much cash the board needs.
 *
 * Whatever an order asks for that is not already on our shelf has to be
 * bought, and the shop needs to know what that costs before the day starts
 * rather than at the counter. The figure is built per order and rolled up
 * for the whole Being Prepared step, then regrouped by supplier -- because
 * that is how it is actually spent: one trip to Roto with one amount, not
 * three order-sized amounts.
 *
 * Three decisions the figure rests on, each of them a way to get it wrong:
 *
 *   which lines    only supplier-sourced ones. A '__stock__' line is on the
 *                  shelf and already paid for. Same rule
 *                  generatePurchaseInvoicesForQuote uses, so the cash figure
 *                  and the invoices that follow it are drawn on one line.
 *
 *   which price    today's cheapest, not the price stored on the line. The
 *                  line records what was quoted, possibly days ago; this
 *                  answers what to take to market now. Through the same
 *                  ranker the item picker uses, so it names the supplier
 *                  that screen would name -- volume tiers included, and
 *                  out-of-stock suppliers excluded.
 *
 *   which orders   Being Prepared only. A draft is not committed work and
 *                  would inflate the figure; anything past this step has
 *                  been picked, so whatever had to be bought already was.
 *
 * Run: node test/admin-cash-to-buy.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('admin cash to buy');
const src = read('index.html');
const sharedJs = read('shared-worker.js');

const data = { savedQuotes: [], suppliers: [], products: [], prices: [] };

const scope = compileScope([
  extractDeclaration(sharedJs, 'SQ_BOARD_HIDE_AFTER_MS', 'shared-worker.js'),
  extractFunction(sharedJs, 'quoteAgedOffBoard', 'shared-worker.js'),
  extractFunction(src, 'productPriceRows', 'index.html'),
  extractFunction(src, 'rankedPriceRows', 'index.html'),
  extractFunction(src, 'tiersForKind', 'index.html'),
  extractFunction(src, 'tieredUnitPrice', 'index.html'),
  extractFunction(src, 'purchasePriceAtQty', 'index.html'),
  extractFunction(src, 'rankedPurchaseRowsAtQty', 'index.html'),
  extractFunction(src, 'orderLineIsBoughtIn', 'index.html'),
  // orderPurchaseLines asks ipLineOutlay how many a pack-only supplier
  // will actually sell, so the collect-this quantity comes with it.
  extractFunction(src, 'ipLineOutlay', 'index.html'),
  // A line already received is no longer a call on cash, so
  // orderPurchaseLines asks whether it has been.
  extractFunction(src, 'quoteLineReceived', 'index.html'),
  extractFunction(src, 'orderPurchaseLines', 'index.html'),
  extractFunction(src, 'orderCashToBuy', 'index.html'),
  extractFunction(src, 'orderUnpricedLines', 'index.html'),
  extractFunction(src, 'beingPreparedOrders', 'index.html'),
  extractFunction(src, 'buyingListRuns', 'index.html'),
], {
  data,
  // productPriceRows decorates each row with a display name; not what any of
  // this is about, so it is stubbed rather than dragging staffName's file in.
  supplierName: (id) => ({ S1: 'Roto', S2: 'Kampala', S3: 'Nsambya' }[id] || id),
}, ['orderPurchaseLines', 'orderCashToBuy', 'orderUnpricedLines',
  'beingPreparedOrders', 'buyingListRuns', 'orderLineIsBoughtIn', 'rankedPurchaseRowsAtQty']);

const price = (over) => Object.assign({
  id: 1, productId: 'P1', variantIdx: null, supplierId: 'S1',
  wholesale: 10000, retail: 12000, packQty: 0, tiers: [], outOfStock: false,
}, over);
const line = (over) => Object.assign({
  productId: 'P1', variantIdx: null, productName: 'Cement', unit: 'bag',
  qty: 10, supplierId: 'S1', price: 10000, sellPrice: 20000,
}, over);
const order = (over) => Object.assign({
  id: 900, client: { name: 'Moses' }, date: '2026-08-03', status: 'preparing',
  items: [line()], voided: false, invoiced: false, invoicedTs: null,
  assignedWorkerId: null, stageEnteredAt: Date.now(),
}, over);

const world = (prices, orders) => {
  data.prices = prices;
  data.savedQuotes = orders;
  data.suppliers = [{ id: 'S1', name: 'Roto' }, { id: 'S2', name: 'Kampala' }, { id: 'S3', name: 'Nsambya' }];
  data.products = [{ id: 'P1', name: 'Cement', variants: [] }, { id: 'P2', name: 'Nails', variants: [] }];
};

/* ---------- 1. only what has to be bought counts ---------------------- */
{
  t.check(scope.orderLineIsBoughtIn(line({ supplierId: 'S1' })) === true,
    'a line sourced from a supplier has to be bought');
  t.check(scope.orderLineIsBoughtIn(line({ supplierId: '__stock__' })) === false,
    "a line off our own shelf does not -- it is already paid for");
  t.check(scope.orderLineIsBoughtIn(line({ supplierId: null })) === false,
    'and neither does one with no source set, which means the same thing');

  // The rule the purchase invoices use, so the two cannot drift apart.
  const gen = extractFunction(src, 'generatePurchaseInvoicesForQuote', 'index.html');
  t.check(/if\(!it\.supplierId \|\| it\.supplierId==='__stock__'\) return;/.test(gen),
    'and it is the same rule the purchase invoices are built on');

  world([price()], []);
  const q = order({ items: [line({ qty: 10 }), line({ supplierId: '__stock__', qty: 5 })] });
  t.check(scope.orderPurchaseLines(q).length === 1, 'so a mixed order reports only its bought-in line');
}

/* ---------- 2. priced at today's cheapest, not at the quote ----------- */
{
  // Quoted on Nsambya at 33,000. Kampala has a tier that undercuts it at 10.
  world([
    price({ id: 1, supplierId: 'S3', wholesale: 33000, retail: 33000 }),
    price({ id: 2, supplierId: 'S2', wholesale: 34000, retail: 34000, tiers: [{ minQty: 10, price: 32500 }] }),
  ], []);
  const q = order({ items: [line({ qty: 10, supplierId: 'S3', price: 33000 })] });
  const [l] = scope.orderPurchaseLines(q);

  t.check(l.best && l.best.supplierId === 'S2',
    'the cheapest supplier AT THIS QUANTITY wins, tiers included');
  t.check(l.unitCost === 32500 && l.lineCost === 325000, 'and prices the line at their tier rate');
  t.check(l.movedFrom === 'S3',
    'with the supplier the order was quoted on recorded, since the buyer walks past them to get here');
  t.check(l.quotedUnitCost === 33000, 'and what it was quoted at, so the difference can be shown');

  // Below the tier threshold the flat cheapest wins again.
  const small = order({ items: [line({ qty: 2, supplierId: 'S3', price: 33000 })] });
  const [s] = scope.orderPurchaseLines(small);
  t.check(s.best.supplierId === 'S3' && s.movedFrom === null,
    'under the threshold the order stays where it was quoted');
}

/* ---------- 3. a supplier who cannot supply cannot be cheapest -------- */
{
  world([
    price({ id: 1, supplierId: 'S2', wholesale: 7000, retail: 7000, outOfStock: true }),
    price({ id: 2, supplierId: 'S1', wholesale: 9000, retail: 9000 }),
  ], []);
  const [l] = scope.orderPurchaseLines(order({ items: [line({ qty: 4 })] }));
  t.check(l.best.supplierId === 'S1' && l.unitCost === 9000,
    'the cheaper supplier is skipped while marked out of stock');
}

/* ---------- 4. a line nothing can price is reported, not counted ------ */
{
  world([], []);
  const q = order({ items: [line({ productId: 'P2', qty: 3 })] });
  const [l] = scope.orderPurchaseLines(q);

  t.check(l.best === null && l.lineCost === null, 'a line with no price on file has no cost');
  t.check(scope.orderCashToBuy(q) === 0,
    'so it adds nothing to the total rather than being counted as free');
  t.check(scope.orderUnpricedLines(q).length === 1,
    'and is reported separately, because a total that hides what it cannot see is worse than one that says so');

  // It must not reach a supplier run either -- there is no supplier to put
  // it under, and reaching for one is how this turns into a crash on the
  // one screen the buyer is standing in the shop reading.
  world([price({ productId: 'P1', supplierId: 'S1', wholesale: 1000, retail: 1000 })], []);
  const mixed = order({ items: [line({ productId: 'P1', qty: 2 }), line({ productId: 'P2', qty: 3 })] });
  let threw = false;
  let runs = [];
  try { runs = scope.buyingListRuns([mixed]); } catch (e) { threw = true; }
  t.check(!threw, 'an unpriced line does not throw while the runs are built');
  t.check(runs.length === 1 && runs[0].lines.length === 1,
    'and appears in nobody\'s run, leaving only the line that can be priced');
  t.check(runs[0].total === 2000, 'so the run totals what it can actually buy');
}

/* ---------- 5. which orders are in scope ------------------------------ */
{
  world([price({ wholesale: 1000, retail: 1000 })], [
    order({ id: 1, status: 'draft' }),
    order({ id: 2, status: 'preparing' }),
    order({ id: 3, status: 'pending_delivery' }),
    order({ id: 4, status: 'completed' }),
    order({ id: 5, status: 'preparing', voided: true }),
    order({ id: 6, status: 'preparing', invoiced: true, invoicedTs: Date.now() - 3 * 24 * 3600 * 1000 }),
  ]);
  const ids = scope.beingPreparedOrders().map((q) => q.id);
  t.check(JSON.stringify(ids) === '[2]',
    `only live Being Prepared orders count (got ${JSON.stringify(ids)})`);
  t.check(!ids.includes(1), 'a draft is not committed work and would inflate the figure');
  t.check(!ids.includes(3) && !ids.includes(4), 'and anything past this step has already been bought for');
  t.check(!ids.includes(5), 'a cancelled order needs nothing bought');
  t.check(!ids.includes(6), 'and one long since aged off the board is not on it');
}

/* ---------- 6. the runs are the same money, regrouped ----------------- */
{
  world([
    price({ id: 1, productId: 'P1', supplierId: 'S1', wholesale: 1000, retail: 1000 }),
    price({ id: 2, productId: 'P2', supplierId: 'S2', wholesale: 500, retail: 500 }),
  ], [
    order({ id: 1, status: 'preparing', items: [line({ productId: 'P1', qty: 10 }), line({ productId: 'P2', qty: 4 })] }),
    order({ id: 2, status: 'preparing', items: [line({ productId: 'P1', qty: 5 })] }),
    order({ id: 3, status: 'draft', items: [line({ productId: 'P1', qty: 999 })] }),
  ]);

  const orders = scope.beingPreparedOrders();
  const runs = scope.buyingListRuns(orders);
  const stepTotal = orders.reduce((s, q) => s + scope.orderCashToBuy(q), 0);
  const runTotal = runs.reduce((s, r) => s + r.total, 0);

  t.check(runTotal === stepTotal,
    `the supplier runs add up to the step total (${runTotal} vs ${stepTotal}) -- one number, two ways of reading it`);
  t.check(runs.length === 2, 'one run per supplier, not per order');
  t.check(runs[0].total >= runs[1].total, 'biggest run first, since that is the one worth planning around');

  const roto = runs.find((r) => r.supplierId === 'S1');
  t.check(roto.total === 15000 && roto.lines.length === 2,
    "a supplier's run gathers that supplier's lines from every order");
  t.check(roto.lines.every((l) => l.order && l.order.id),
    'and each line still knows which order it is for');
}

/* ---------- 7. an order needing nothing bought ------------------------ */
{
  world([price()], []);
  const q = order({ items: [line({ supplierId: '__stock__' }), line({ supplierId: '__stock__' })] });
  t.check(scope.orderCashToBuy(q) === 0 && scope.orderPurchaseLines(q).length === 0,
    'an order entirely off our own shelf needs no cash at all');
  t.check(scope.buyingListRuns([q]).length === 0, 'and puts nobody on the buying list');
}

process.exit(t.done() ? 1 : 0);
