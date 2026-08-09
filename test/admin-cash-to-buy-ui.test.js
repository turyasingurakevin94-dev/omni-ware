#!/usr/bin/env node
'use strict';
/*
 * The cash-to-buy screens.
 *
 * admin-cash-to-buy.test.js pins the arithmetic -- which lines count, which
 * price they are counted at, which orders are in scope. This pins what an
 * admin is shown, which is a separate way to be wrong: the figure can be
 * right and the screen still lie about it, or crash, or quietly render a
 * total it could not actually see.
 *
 * Three surfaces, one number:
 *
 *   the banner      on the Being Prepared column -- the step's whole cash
 *                   need, with the biggest supplier runs under it.
 *   the card strip  one order's share, only while it is the question being
 *                   asked.
 *   the buying list the same money regrouped by who to walk to.
 *
 * The rule they are held to here is that they agree. A banner saying one
 * thing and a list saying another sends somebody to market with the wrong
 * money, and the arithmetic being individually correct is no defence.
 *
 * Run: node test/admin-cash-to-buy-ui.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('admin cash to buy ui');
const src = read('index.html');
const sharedJs = read('shared-worker.js');

const data = {
  savedQuotes: [], suppliers: [], products: [], prices: [],
  cashTxns: [], cashDays: {},
};
const modal = {};

// The icons are stubbed as identifiable markup rather than the real paths:
// the tests below care that an icon is present and which one, not what it
// looks like. Everything else is the real function out of index.html.
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
  extractFunction(src, 'orderPurchaseLines', 'index.html'),
  extractFunction(src, 'orderCashToBuy', 'index.html'),
  extractFunction(src, 'orderUnpricedLines', 'index.html'),
  extractFunction(src, 'beingPreparedOrders', 'index.html'),
  extractFunction(src, 'buyingListRuns', 'index.html'),
  extractFunction(src, 'quoteClientName', 'index.html'),
  // The cash position the buying list now opens with. Real Cash Book
  // arithmetic, so this file cannot drift from the Cash Book screen.
  extractDeclaration(src, 'ACCOUNTS', 'index.html'),
  extractFunction(src, 'cbAccountTotals', 'index.html'),
  extractFunction(src, 'cbClosingFor', 'index.html'),
  extractFunction(src, 'previousCashDate', 'index.html'),
  extractFunction(src, 'carriedOpening', 'index.html'),
  extractDeclaration(src, 'CASH_NOT_REVENUE', 'index.html'),
  extractDeclaration(src, 'cashHas', 'index.html'),
  extractFunction(src, 'cashIsMoneyIn', 'index.html'),
  extractFunction(src, 'cashAnchorFor', 'index.html'),
  extractFunction(src, 'cashOnHandFor', 'index.html'),
  extractFunction(src, 'cashOnHandByAccount', 'index.html'),
  extractFunction(src, 'cashPositionForBuying', 'index.html'),
  extractFunction(src, 'cashPositionHTML', 'index.html'),
  extractFunction(src, 'cashToBuyBannerHTML', 'index.html'),
  extractFunction(src, 'orderMetaRowHTML', 'index.html'),
  extractFunction(src, 'orderCashStripHTML', 'index.html'),
  extractFunction(src, 'openBuyingList', 'index.html'),
], {
  data,
  supplierName: (id) => (data.suppliers.find((s) => s.id === id) || {}).name || String(id),
  esc: (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'),
  fmtUGX: (n) => Number(n || 0).toLocaleString('en-US') + ' UGX',
  savedAgoLabel: () => '42 minutes ago',
  savedQuoteTotal: (q) => (q.items || []).reduce((s, i) => s + i.qty * (i.sellPrice || 0), 0),
  ICON_WALLET: '<svg data-i="wallet"></svg>', ICON_STORE: '<svg data-i="store"></svg>',
  ICON_WARN: '<svg data-i="warn"></svg>', ICON_CLOCK: '<svg data-i="clock"></svg>',
  ICON_ITEMS: '<svg data-i="items"></svg>', ICON_MONEY: '<svg data-i="money"></svg>',
  ICON_SHELF: '<svg data-i="shelf"></svg>', ICON_PURCHASE: '<svg data-i="purchase"></svg>',
  ICON_CASH: '<svg data-i="cash"></svg>', ICON_MOMO: '<svg data-i="momo"></svg>',
  ICON_BANK: '<svg data-i="bank"></svg>', ICON_CHECK: '<svg data-i="check"></svg>',
  ICON_PLAN: '<svg data-i="plan"></svg>',
  todayISO: () => '2026-08-03',
  openModal: (id) => { modal.opened = id; },
  // The plan modal is this file's neighbour, exercised in full by
  // admin-shortfall-plan.test.js. Here it is only the thing the button
  // opens, so it is stubbed rather than dragging its scope in.
  openShortfallPlan: () => { modal.planOpened = true; },
  document: {
    getElementById: () => ({
      set innerHTML(v) { modal.html = v; },
      addEventListener(_e, fn) { modal.planWiring = fn; },
    }),
  },
}, ['cashToBuyBannerHTML', 'orderMetaRowHTML', 'orderCashStripHTML', 'openBuyingList',
  'cashOnHandFor', 'cashOnHandByAccount', 'cashPositionForBuying', 'cashPositionHTML',
  'orderPurchaseLines', 'orderCashToBuy', 'orderUnpricedLines', 'beingPreparedOrders',
  'buyingListRuns', 'orderLineIsBoughtIn', 'quoteClientName']);

// packQty 0 with one price on both kinds: "this supplier sells it at this,
// there is no pack deal". Deliberately unambiguous, so the assertions below
// are about the screens. Section 3 is where the two kinds pull apart.
const price = (o) => Object.assign({
  id: 1, productId: 'P1', variantIdx: null, supplierId: 'S1',
  wholesale: 10000, retail: 10000, packQty: 0, tiers: [], outOfStock: false }, o);
const line = (o) => Object.assign({
  productId: 'P1', variantIdx: null, productName: 'Cement', unit: 'bag',
  qty: 10, supplierId: 'S1', price: 10000, sellPrice: 20000 }, o);
const order = (o) => Object.assign({
  id: 900, client: { name: 'Moses' }, date: '2026-08-03', status: 'preparing',
  items: [line()], voided: false, invoiced: false, invoicedTs: null,
  stageEnteredAt: Date.now() }, o);

data.suppliers = [
  { id: 'S1', name: 'Roto', location: 'Nakawa' }, { id: 'S2', name: 'Kampala' },
  { id: 'S3', name: 'Nsambya' }, { id: 'S4', name: 'Ntinda Steel' }, { id: 'S5', name: 'Bwaise' }];
data.products = [{ id: 'P1', name: 'Cement', variants: [] }, { id: 'P2', name: 'Nails', variants: [] }];

// Every UGX figure in a blob of markup, in the order it is rendered.
const figures = (html) => [...String(html).matchAll(/([\d,]+) UGX/g)]
  .map((m) => Number(m[1].replace(/,/g, '')));

/* ---------- 1. nothing to buy shows nothing --------------------------- */
{
  data.prices = [price()];
  const shelf = order({ items: [line({ supplierId: '__stock__' })] });

  t.check(scope.cashToBuyBannerHTML([shelf]) === '',
    'a board whose orders all come off our shelf renders no banner at all -- not one reading zero');
  t.check(scope.orderCashStripHTML(shelf) === '',
    'and such an order carries no cash strip on its card');
  t.check(scope.cashToBuyBannerHTML([]) === '', 'an empty column renders no banner');
  t.check(scope.cashToBuyBannerHTML(undefined) === '',
    'and neither does a column that has not loaded yet');
}

/* ---------- 2. the three surfaces agree on the number ----------------- */
{
  data.prices = [
    price({ id: 1, productId: 'P1', supplierId: 'S1', wholesale: 1000, retail: 1000 }),
    price({ id: 2, productId: 'P2', supplierId: 'S2', wholesale: 500, retail: 500 })];
  data.savedQuotes = [
    order({ id: 1, items: [line({ productId: 'P1', qty: 10 }), line({ productId: 'P2', productName: 'Nails', qty: 4 })] }),
    order({ id: 2, items: [line({ productId: 'P1', qty: 5 })] }),
    order({ id: 3, status: 'draft', items: [line({ qty: 9999 })] })];

  const orders = scope.beingPreparedOrders();
  const bannerTotal = figures(scope.cashToBuyBannerHTML(orders))[0];
  scope.openBuyingList();
  const listTotal = figures(modal.html)[0];
  const stripTotal = orders
    .map((q) => figures(scope.orderCashStripHTML(q)).pop() || 0)
    .reduce((a, b) => a + b, 0);

  t.check(bannerTotal === 15000 + 2000, `the banner totals the step (got ${bannerTotal})`);
  t.check(listTotal === bannerTotal,
    `the buying list opens on the same figure the banner sent them there with (${listTotal} vs ${bannerTotal})`);
  t.check(stripTotal === bannerTotal,
    `and the per-order strips add up to it (${stripTotal} vs ${bannerTotal}) -- three readings of one number`);
  t.check(!/9999|9,999/.test(String(modal.html)),
    'the draft that is not in the step stays out of all of them');
}

/* ---------- 3. counted at what we would actually pay ------------------ */
{
  // Every fixture in admin-cash-to-buy.test.js sets wholesale and retail to
  // the same figure, so none of it can tell the two apart. This can: the
  // shop buys at the pack price only once it is taking a pack, and the cash
  // it needs is the buying price, never the selling one.
  data.products = [{ id: 'P1', name: 'Cement', variants: [] }];
  data.prices = [
    // Roto: 34,000 a bag, or 32,000 once you take ten.
    price({ id: 1, supplierId: 'S1', wholesale: 32000, retail: 34000, packQty: 10 }),
    // Kampala: 33,000 a bag however many you take.
    price({ id: 2, supplierId: 'S2', wholesale: 33000, retail: 33000, packQty: 0 })];

  const [big] = scope.orderPurchaseLines(order({ items: [line({ qty: 10 })] }));
  t.check(big.unitCost === 32000 && big.best.supplierId === 'S1',
    `ten bags reaches Roto's pack price (got ${big.unitCost} at ${big.best.supplierId})`);
  t.check(figures(scope.orderCashStripHTML(order({ items: [line({ qty: 10 })] }))).pop() === 320000,
    'and the strip asks for that, not for the shelf price of the same ten bags');

  const [small] = scope.orderPurchaseLines(order({ items: [line({ qty: 3 })] }));
  t.check(small.unitCost === 33000 && small.best.supplierId === 'S2',
    `three bags does not, so the cheapest supplier changes with the quantity (got ${small.unitCost} at ${small.best.supplierId})`);
  t.check(figures(scope.orderCashStripHTML(order({ items: [line({ qty: 3 })] }))).pop() === 99000,
    'and the figure follows -- three at 33,000, not three at the pack rate we have not earned');

  const sell = scope.orderMetaRowHTML(order({ items: [line({ qty: 10, sellPrice: 45000 })] }));
  t.check(figures(sell)[0] === 450000,
    'the card still shows what the client pays, which is a different number on the same row');
}

/* ---------- 4. the banner is a glance, not a report ------------------- */
{
  data.products = ['0', '1', '2', '3', '4'].map((i) => ({ id: 'P' + i, name: 'Item' + i, variants: [] }));
  data.prices = ['S1', 'S2', 'S3', 'S4', 'S5'].map((s, i) =>
    price({ id: i + 1, productId: 'P' + i, supplierId: s, wholesale: 1000 * (i + 1), retail: 1000 * (i + 1) }));
  const spread = order({ items: data.prices.map((p, i) =>
    line({ productId: 'P' + i, productName: 'Item' + i, qty: 2, supplierId: p.supplierId })) });

  const html = scope.cashToBuyBannerHTML([spread]);
  const runs = (html.match(/class="sq-cash-run"/g) || []).length;
  t.check(runs === 3, `at most three supplier runs are shown on the column (got ${runs})`);
  t.check(/\+2 more/.test(html),
    'and the rest are counted rather than dropped, so the glance is not quietly incomplete');

  const shown = figures(html);
  t.check(shown[0] === 30000, 'the headline figure still covers every supplier, shown or not');
  t.check(shown[1] >= shown[2] && shown[2] >= shown[3],
    'the runs that made the cut are the biggest ones, since those are what a day is planned around');
}

/* ---------- 5. what it cannot price, it says ------------------------- */
{
  data.products = [{ id: 'P1', name: 'Cement', variants: [] }, { id: 'P2', name: 'Nails', variants: [] }];
  data.prices = [price({ productId: 'P1', supplierId: 'S1', wholesale: 1000, retail: 1000 })];
  const mixed = order({ id: 7, items: [
    line({ productId: 'P1', qty: 2 }), line({ productId: 'P2', productName: 'Nails', qty: 3 })] });
  data.savedQuotes = [mixed];

  const banner = scope.cashToBuyBannerHTML([mixed]);
  t.check(/no supplier price/.test(banner) && /1 line/.test(banner),
    'a line nothing can price is called out on the banner');
  t.check(figures(banner)[0] === 2000,
    'and is not counted into the figure -- a total that silently includes zero for it is worse than one that says so');
  t.check(/data-i="warn"/.test(banner), 'the callout carries the warning icon');

  scope.openBuyingList();
  t.check(/Nails/.test(modal.html) && /bl-gap/.test(modal.html),
    'the buying list names it, so somebody can go and put a price on file');

  // The card is where this is easiest to get wrong: the order has a real
  // figure on it, so a strip that quietly folded the unpriced line in at
  // zero would still look entirely plausible.
  const mixedStrip = scope.orderCashStripHTML(mixed);
  t.check(figures(mixedStrip).pop() === 2000,
    `the strip totals only the line it could price (got ${figures(mixedStrip).pop()})`);
  t.check(/1 unpriced/.test(mixedStrip),
    'and says on the card how many it could not, rather than absorbing them into a figure that looks complete');
  t.check(/1 line ·/.test(mixedStrip) && /1 supplier/.test(mixedStrip),
    'counting lines and suppliers over what it priced, not over what it was given');

  // Entirely unpriced: the strip must not reach for a supplier it has not got.
  data.prices = [];
  const strip = scope.orderCashStripHTML(order({ items: [line({ productId: 'P2' })] }));
  t.check(/no price on file/.test(strip) && !/UGX/.test(strip),
    'an order nothing can be priced for reports that, rather than claiming to cost nothing');
}

/* ---------- 6. the card reads at a glance ----------------------------- */
{
  data.prices = [price()];
  const q = order({ items: [line(), line({ supplierId: '__stock__' }), line({ supplierId: '__stock__' })] });
  const meta = scope.orderMetaRowHTML(q);

  t.check(/data-i="clock"/.test(meta) && /data-i="items"/.test(meta) && /data-i="money"/.test(meta),
    'the meta row is icons, not sentences -- the card is scanned, not read');
  t.check(/2 from stock/.test(meta) && /data-i="shelf"/.test(meta),
    'and says how much of the order is already on our shelf');

  // An icon with no words next to it is only usable by someone who can guess
  // it. Every one of them has to name itself on hover.
  const spans = meta.match(/<span[^>]*>/g) || [];
  t.check(spans.length > 0 && spans.every((s) => /title="/.test(s)),
    'every icon carries a title, so none of the row is available only to whoever guesses the pictogram');

  t.check(!/from stock/.test(scope.orderMetaRowHTML(order({ items: [line()] }))),
    'nothing off the shelf means no stock chip, rather than a chip reading zero');
  // Matched on what follows the word rather than on the closing quote:
  // the title now goes on to say the order can be opened to see the lines,
  // and pinning the punctuation after "line" made this fail for a reason
  // that had nothing to do with pluralisation.
  t.check(/title="1 line[^s]/.test(scope.orderMetaRowHTML(order({ items: [line()] }))),
    'and one line is "1 line", not "1 lines"');
}

/* ---------- 7. only while it is the question being asked -------------- */
{
  data.prices = [price()];
  ['draft', 'pending_delivery', 'completed'].forEach((status) => {
    t.check(scope.orderCashStripHTML(order({ status })) === '',
      `an order in ${status} carries no cash strip -- past this step it has already been bought for`);
  });
  t.check(scope.orderCashStripHTML(order({ voided: true })) === '',
    'and a cancelled order needs nothing bought');

  const voidedInGroup = [order({ id: 1 }), order({ id: 2, voided: true, items: [line({ qty: 9999 })] })];
  t.check(figures(scope.cashToBuyBannerHTML(voidedInGroup))[0] === 100000,
    'a cancelled order handed to the banner in its group is left out of the figure too');
}

/* ---------- 8. a name it cannot read does not take the screen down ---- */
{
  // Every other read of a client name in index.html is guarded; this screen
  // builds its whole body in one template, so an unguarded read would blank
  // the entire buying list rather than one row of it.
  t.check(scope.quoteClientName({ client: { name: 'Moses' } }) === 'Moses', 'a client with a name is named');
  t.check(scope.quoteClientName({ client: {} }) === 'Unnamed client', 'one saved without a name is labelled');
  t.check(scope.quoteClientName({}) === 'Unnamed client', 'and an order carrying no client at all does not throw');

  data.prices = [price()];
  data.savedQuotes = [order({ id: 1, client: undefined }), order({ id: 2, client: { name: 'Sarah' } })];
  let threw = null;
  try { scope.openBuyingList(); } catch (e) { threw = e.message; }
  t.check(!threw, `the buying list opens with a clientless order on the board (${threw || 'ok'})`);
  t.check(threw === null && /Sarah/.test(modal.html),
    'and the orders either side of it are still listed');

  const unguarded = /\.order\.client\.name/.test(extractFunction(src, 'openBuyingList', 'index.html'));
  t.check(!unguarded, 'with no unguarded client read left in the function');
}

/* ---------- 9. a client name is content, not markup ------------------- */
{
  data.prices = [price()];
  data.savedQuotes = [order({
    client: { name: '<img src=x onerror=alert(1)>' },
    items: [line({ productName: '<b>Cement</b>' })] })];
  scope.openBuyingList();

  t.check(!/<img src=x/.test(modal.html) && /&lt;img/.test(modal.html),
    'a client name is escaped into the buying list -- names are typed by people and land here verbatim');
  t.check(!/<b>Cement<\/b>/.test(modal.html), 'and so is a product name');
  t.check(modal.opened === 'buyingListModal', 'and the list is what gets opened');
}

/* ---------- 10. the columns land in the same place on every run ------- */
{
  // Auto table layout sizes each run's table from its own contents, so a run
  // carrying a long "quoted on ..." note put its figures in different places
  // from the run below it, and on a narrow column ran them together.
  const css = src.slice(src.indexOf('.bl-lines table{'), src.indexOf('.bl-item{'));
  t.check(/table-layout:fixed/.test(css),
    'the line tables are fixed-layout, so a long note in one run cannot move that run\'s columns');
  t.check(['item', 'qty', 'unit', 'cost'].every((c) => new RegExp(`col\\.${c}\\{width:`).test(css)),
    'with every column given a declared width');

  data.prices = [price()];
  data.savedQuotes = [order()];
  scope.openBuyingList();
  const cols = (modal.html.match(/<col class="/g) || []).length;
  t.check(cols === 4, `and the table declares them (got ${cols} cols)`);
}

process.exit(t.done() ? 1 : 0);
