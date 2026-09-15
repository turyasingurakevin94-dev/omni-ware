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
  extractFunction(read('shared-worker.js'), 'orderLineIsBoughtIn', 'shared-worker.js'),
  // orderPurchaseLines asks ipLineOutlay how many a pack-only supplier
  // will actually sell, so the collect-this quantity comes with it.
  extractFunction(src, 'ipLineOutlay', 'index.html'),
  // A line already received is no longer a call on cash, so
  // orderPurchaseLines asks whether it has been.
  extractFunction(read('shared-worker.js'), 'quoteLineReceived', 'shared-worker.js'),
  extractFunction(read('shared-worker.js'), 'quoteLineShortfall', 'shared-worker.js'),
  // The buying list's Receive control opens on what was sent for.
  extractFunction(src, 'quoteLineExpected', 'index.html'),
  extractFunction(src, 'quoteLineUnitsBought', 'index.html'),
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
  extractFunction(src, 'orderBoardCashToBuy', 'index.html'),
  /* The row now says whose the goods are as well as where they are, so
     the reading behind that comes with it. */
  extractFunction(src, 'stockKey', 'index.html'),
  extractFunction(src, 'peekStockLots', 'index.html'),
  extractFunction(src, 'consignTally', 'index.html'),
  extractFunction(src, 'consignedForLine', 'index.html'),
  extractFunction(src, 'consignTagLabel', 'index.html'),
  extractFunction(src, 'consignTagTitle', 'index.html'),
  extractFunction(src, 'consignTagHTML', 'index.html'),
  extractFunction(src, 'consignedForOrder', 'index.html'),
  extractFunction(src, 'orderCashStripHTML', 'index.html'),
  extractFunction(src, 'otBuyingSpec', 'index.html'),
  extractFunction(src, 'otBuyingStops', 'index.html'),
  extractFunction(src, 'otStopActHTML', 'index.html'),
  extractFunction(src, 'otStopTripsHTML', 'index.html'),
  extractFunction(src, 'otStopSuppliers', 'index.html'),
  extractFunction(src, 'otBuyerFor', 'index.html'),
  extractFunction(src, 'otDayName', 'index.html'),
  /* The list counts each line in the unit it was chosen in, through the
     same reader every document uses. Compiled in, not stubbed; a loose
     line reads exactly as before. */
  extractFunction(src, 'quoteLinePack', 'index.html'),
  extractFunction(src, 'quoteLineCountPer', 'index.html'),
  extractFunction(src, 'quoteLineCount', 'index.html'),
], {
  data,
  quoteLineComesOffShelf: (it) => !!it && (it.supplierId === '__stock__'
    || !!(it.receivedAt && Number(it.receivedQty) > 0)),
  // The carousel is DOM plumbing shared with the two run modals; this
  // scope has no DOM, so it is stubbed and its wiring pinned on the
  // source instead.
  wireRunCarousel: () => {},
  supplierName: (id) => (data.suppliers.find((s) => s.id === id) || {}).name || String(id),
  esc: (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'),
  fmtUGX: (n) => Number(n || 0).toLocaleString('en-US') + ' UGX',
  savedAgoLabel: () => '42 minutes ago',
  savedQuoteTotal: (q) => (q.items || []).reduce((s, i) => s + i.qty * (i.sellPrice || 0), 0),
  ICON_WALLET: '<svg data-i="wallet"></svg>', ICON_STORE: '<svg data-i="store"></svg>',
  ICON_GO: '<svg data-i="go"></svg>',
  ICON_WARN: '<svg data-i="warn"></svg>', ICON_CLOCK: '<svg data-i="clock"></svg>',
  ICON_ITEMS: '<svg data-i="items"></svg>', ICON_MONEY: '<svg data-i="money"></svg>',
  ICON_SHELF: '<svg data-i="shelf"></svg>', ICON_PURCHASE: '<svg data-i="purchase"></svg>',
  ICON_CASH: '<svg data-i="cash"></svg>', ICON_MOMO: '<svg data-i="momo"></svg>',
  ICON_BANK: '<svg data-i="bank"></svg>', ICON_CHECK: '<svg data-i="check"></svg>',
  ICON_PLAN: '<svg data-i="plan"></svg>', ICON_TRUCK: '<svg data-i="truck"></svg>',
  todayISO: () => '2026-08-03',
  openModal: (id) => { modal.opened = id; },
  // The plan modal is this file's neighbour, exercised in full by
  // admin-shortfall-plan.test.js. Here it is only the thing the button
  // opens, so it is stubbed rather than dragging its scope in.
  openShortfallPlan: () => { modal.planOpened = true; },
  /* Receiving is wired after the body is written, and is exercised in
     full by goods-receiving.test.js. Here it is only a call the render
     makes, and this file's document stub has no querySelectorAll. */
  wireBuyingListReceiving: () => { modal.receivingWired = true; },
  /* Collection trips live in shared-worker.js and are exercised by their
     own file. Here they only decide whether a run offers "Send someone",
     and this fixture has no trips -- so nothing is on one, and the run's
     own trip strip renders empty. */
  lineIsOnATrip: () => false,
  blRunTripsHTML: () => '',
  // Collections still out whose orders have left the board. Not what this
  // file is about; collection-trips.test.js owns it.
  blStrandedTripsHTML: () => '',
  document: {
    getElementById: () => ({
      set innerHTML(v) { modal.html = v; },
      addEventListener(_e, fn) { modal.planWiring = fn; },
    }),
  },
  /* The buying list is a spec poured into the board's one dialog now,
     so its collaborators come in as stubs rather than as a DOM. */
  supplierLocationFor: (id) => ((data.suppliers || []).find((x) => String(x.id) === String(id)) || {}).location || '',
  destinationKey: (place) => String(place || '').toLowerCase(),
  orderLinesWithNobodySent: () => [],
  blStrandedTripsHTML: () => '',
  lineIsOnATrip: () => false,
  tripIsLive: () => false,
  quoteLineShortfall: (it) => {
    if (!it || !it.receivedAt) return 0;
    return Math.max(0, (Number(it.qty) || 0) - (Number(it.receivedQty) || 0));
  },
  otDlgFig: (label, n) => `<span class="ow-mt-l">${label}</span><span class="ow-dlg-fig-v">${Number(n || 0).toLocaleString('en-US')}</span>`,
  otDlgGhost: (a, label, ds) => `<button data-dlg="${a}"${ds || ''}>${label}</button>`,
  otDlgPrimary: (a, label) => `<button class="btn-accent" data-dlg="${a}">${label}</button>`,
  otFig: (n) => Number(n || 0).toLocaleString('en-US'),
  OT_TICK: '<svg data-i="tick"></svg>',
}, ['orderBoardCashToBuy', 'orderCashStripHTML', 'otBuyingSpec',
  'cashOnHandFor', 'cashOnHandByAccount', 'cashPositionForBuying', 'cashPositionHTML',
  'orderPurchaseLines', 'orderCashToBuy', 'orderUnpricedLines', 'beingPreparedOrders',
  'buyingListRuns', 'orderLineIsBoughtIn', 'quoteClientName']);


/* The dialog is a spec -- a title, a mono sub-line, a body of blocks and
   a footer. The footer leads with the figure the round costs, which is
   what the old modal put at the top of its body, so the two are read in
   the same order here. */
const openBuyingList = () => {
  const spec = scope.otBuyingSpec();
  modal.opened = 'otDlg';
  modal.html = String(spec.foot) + String(spec.act || '') + String(spec.body);
  modal.sub = String(spec.sub);
};

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

  const none = scope.orderBoardCashToBuy([shelf]);
  t.check(none.total === 0 && none.runs.length === 0,
    'a board whose orders all come off our shelf has nothing to buy in -- no run, and a figure of nothing');
  t.check(scope.orderCashStripHTML(shelf) === '',
    'and such an order carries no cash strip in its row');
  t.check(scope.orderBoardCashToBuy([]).total === 0, 'an empty board adds up to nothing');
  t.check(scope.orderBoardCashToBuy(undefined).total === 0,
    'and neither does one that has not loaded yet');
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
  const bannerTotal = scope.orderBoardCashToBuy(orders).total;
  openBuyingList();
  const listTotal = figures(modal.html)[0];
  const stripTotal = orders
    .map((q) => figures(scope.orderCashStripHTML(q)).pop() || 0)
    .reduce((a, b) => a + b, 0);

  t.check(bannerTotal === 15000 + 2000, `the strip's figure totals the step (got ${bannerTotal})`);
  t.check(listTotal === bannerTotal,
    `the buying list opens on the same figure the strip sent them there with (${listTotal} vs ${bannerTotal})`);
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

  /* What the client pays moved OFF the meta row and onto the name row,
     right-aligned in mono -- who and how much are the two facts a board
     is scanned for, and buried mid-row the figure read like a timestamp.
     The meta row must not carry it any more (two money figures on one
     card is how the buy cost gets read as the sell price), and the name
     row must. */
  const sell = scope.orderCashStripHTML(order({ items: [line({ qty: 10, sellPrice: 45000 })] }));
  t.check(figures(sell).every((n) => n !== 450000),
    'the cash strip is what the shop pays, never what the client pays');
  t.check(/<div class="ow-tbl-n" data-l="Client pays" title="What the client pays">\$\{esc\(fmtUGX\(savedQuoteTotal\(q\)\)\)\}/.test(read('index.html')),
    'it sits on the name row instead, right-aligned against the name');

  /* A line received in full costs 0 more, and a strip reading
     "To buy · 1 line · 1 supplier · 0 UGX" is a claim that there is
     buying to do on an order whose buying is finished. Run with a
     received fixture, because the guard is one line a mutant deletes. */
  const done = order({ items: [line({ qty: 10,
    receivedQty: 10, receivedPrice: 10000, receivedAt: '2026-08-03T09:00:00Z' })] });
  t.check(scope.orderCashStripHTML(done) === '',
    'an order whose goods are all in shows no cash strip at all');
}

/* ---------- 4. the figure rests on the runs, biggest first ------------ */
{
  data.products = ['0', '1', '2', '3', '4'].map((i) => ({ id: 'P' + i, name: 'Item' + i, variants: [] }));
  data.prices = ['S1', 'S2', 'S3', 'S4', 'S5'].map((s, i) =>
    price({ id: i + 1, productId: 'P' + i, supplierId: s, wholesale: 1000 * (i + 1), retail: 1000 * (i + 1) }));
  const spread = order({ items: data.prices.map((p, i) =>
    line({ productId: 'P' + i, productName: 'Item' + i, qty: 2, supplierId: p.supplierId })) });

  const cash = scope.orderBoardCashToBuy([spread]);
  t.check(cash.total === 30000, 'the headline figure covers every supplier');
  t.check(cash.runs.length === 5 && cash.runs.every((r, i, a) => !i || a[i - 1].total >= r.total),
    'and the runs behind it are biggest first, since those are what a day is planned around');
  /* The glance itself is the rail's buying-trip panel, drawn by PLACE
     from the pickup runs rather than by supplier; admin-pickup-runs owns
     that derivation. What this file pins is that the strip's figure and
     the runs it rests on are one call. */
  t.check(/pickupRuns\(orders\)/.test(extractFunction(src, 'orderTripPanelHTML', 'index.html'))
    && /Cash to carry/.test(extractFunction(src, 'orderTripPanelHTML', 'index.html')),
    'the rail plans the trip by place and says what cash to carry');
}

/* ---------- 4b. nothing on the rail wraps ------------------------------
 * The rail is 304px. The place and its suppliers sit on one line each and
 * the figure on the right; when a name is too long it is the NAME that
 * yields, never the amount, and no figure is ever broken after its
 * digits with "UGX" stranded on a line of its own. These are the layer's
 * own rules for its side rows and its money column, held here because no
 * assertion on the markup can see a wrap.
 */
{
  t.check(/\.ow-sr-k2-t,\.ow-sr-k2-s\{display:block;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;\}/.test(src),
    'a stop\'s place and its suppliers truncate with all three declarations, and can shrink');
  t.check(/\.ow-tbl-n\{[^}]*white-space:nowrap/.test(src) && /\.ow-tbl-n\{[^}]*font-variant-numeric:tabular-nums/.test(src),
    'and a figure never wraps and always lines up');
}

/* ---------- 5. what it cannot price, it says ------------------------- */
{
  data.products = [{ id: 'P1', name: 'Cement', variants: [] }, { id: 'P2', name: 'Nails', variants: [] }];
  data.prices = [price({ productId: 'P1', supplierId: 'S1', wholesale: 1000, retail: 1000 })];
  const mixed = order({ id: 7, items: [
    line({ productId: 'P1', qty: 2 }), line({ productId: 'P2', productName: 'Nails', qty: 3 })] });
  data.savedQuotes = [mixed];

  const cash = scope.orderBoardCashToBuy([mixed]);
  t.check(cash.unpriced === 1, 'a line nothing can price is counted apart');
  t.check(cash.total === 2000,
    'and is not counted into the figure -- a total that silently includes zero for it is worse than one that says so');
  t.check(/with no price on file/.test(extractFunction(src, 'renderSavedQuotes', 'index.html')),
    'and the strip names it under the figure');

  openBuyingList();
  t.check(/Nails/.test(modal.html) && /Not on any stop/.test(modal.html),
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

/* ---------- 6. the row reads at a glance ------------------------------ */
{
  /* The console's row says under the client's name how many lines the
     order has and how many of them are to buy -- words at row size,
     with the order's number and place, rather than pictograms a person
     has to guess. */
  const row = extractFunction(src, 'orderRowHTML', 'index.html');
  t.check(/const bought = \(q\.items \|\| \[\]\)\.filter\(orderLineIsBoughtIn\)\.length;/.test(row),
    'the row counts what is to buy in off the same predicate the buying does');
  t.check(/\$\{items\} line\$\{items === 1 \? '' : 's'\}\$\{bought \? `, \$\{bought\} to buy` : ''\}/.test(row),
    'and says "N lines, M to buy" -- one line is "1 line", nothing to buy says nothing');
  t.check(/\[`#\$\{q\.id\}`, place, /.test(row), 'with the number and the place beside it');
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
  t.check(scope.orderBoardCashToBuy(voidedInGroup).total === 100000,
    'a cancelled order handed in with the group is left out of the figure too');
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
  try { openBuyingList(); } catch (e) { threw = e.message; }
  t.check(!threw, `the buying list opens with a clientless order on the board (${threw || 'ok'})`);
  /* THE ROW SAYS WHICH ORDER, NOT WHICH CLIENT. The round is grouped by
     place and its rows are item / supplier / for order / cost / qty, so
     an order is identified by its number the way the buyer will read it
     out at the counter. The client's name still appears where it decides
     something -- on a line that came back short, which is somebody's
     order left incomplete. */
  t.check(threw === null && /#2/.test(modal.html) && /#1/.test(modal.html),
    'and the orders either side of it are still listed');

  const unguarded = /\.order\.client\.name/.test(extractFunction(src, 'otBuyingSpec', 'index.html'));
  t.check(!unguarded, 'with no unguarded client read left in the function');
}

/* ---------- 9. a client name is content, not markup ------------------- */
{
  data.prices = [price()];
  data.savedQuotes = [order({
    client: { name: '<img src=x onerror=alert(1)>' },
    items: [line({ productName: '<b>Cement</b>' })] })];
  openBuyingList();

  t.check(!/<b>Cement<\/b>/.test(modal.html) && /&lt;b&gt;Cement/.test(modal.html),
    'a product name is escaped into the buying list -- names are typed by people and land here verbatim');
  /* And the client's name, on the one row that carries it. */
  data.savedQuotes = [order({
    client: { name: '<img src=x onerror=alert(1)>' },
    items: [line({ receivedAt: '2026-08-03', receivedQty: 4, receivedPrice: 10000 })] })];
  openBuyingList();
  t.check(!/<img src=x/.test(modal.html) && /&lt;img/.test(modal.html),
    'and so is a client name, where a short line names whose order it is');
  t.check(modal.opened === 'otDlg', 'and the list is what gets opened');
}

/* ---------- 10. one supplier, one card, sliding sideways --------------
 *
 * This replaces two sections that pinned a five-column table and then
 * the minimum width and re-cut column shares it needed to survive a
 * phone. Both were defending a shape that should not have been here:
 * Pickup Runs and Delivery Runs already answer "which places, and what
 * do they cost" as cards in a horizontal track, and this screen answered
 * the same question by stacking full-width blocks -- so three suppliers
 * meant a scroll to discover whether there was a fourth.
 *
 * The table was what forced that width, and on a phone its columns
 * collided at 331px: "12,250 245,000" printed over each other with
 * Receive hanging off the edge. A minimum width made that scrollable.
 * A LIST HAS NO COLUMNS TO COLLIDE, so the card is narrow enough to sit
 * in the track and the phone problem stops existing rather than being
 * made navigable.
 */
{
  data.prices = [price()];
  data.savedQuotes = [order()];
  openBuyingList();

  t.check(!/<table/.test(modal.html),
    'the run no longer draws a table — that was the thing forcing a full-width block');
  /* AND THE TRACK IS GONE TOO. Cards in a sideways track fixed the
     width the table forced, at the cost of hiding two thirds of the
     morning behind a swipe -- and it did that on all three run screens
     at once. They are one dialog now, and the round is grouped by PLACE
     rather than by supplier, which is the shape the morning actually
     has: a stop is a place you walk to, and the suppliers at it are
     named inside it. Rows under a group head, read down the page, with
     nothing hidden and no columns to collide. */
  t.check(!/dr-carousel|dr-track|bl_track|bl_prev|bl_next/.test(modal.html),
    'the suppliers are no longer cards in a sideways track');
  t.check(!/wireRunCarousel\('/.test(src),
    'and no screen opens one at all — one fix, three screens, rather than a copy each');
  t.check(/class="ow-dlg-g"/.test(modal.html) && /Stop 1 · /.test(modal.html),
    'the round is a group per stop, numbered in the order it is worth walking');
  t.check(/class="ow-dlg-g-v"/.test(modal.html) && /Cash for this stop/.test(modal.html),
    'each carrying what that stop costs to walk into');

  // The row still carries everything the card did.
  t.check(/class="ow-dlg-r ow-bl-r"/.test(modal.html), 'the lines are rows on one grid');
  t.check(/class="ow-dlg-v ow-dlg-rt"/.test(modal.html) && /class="ow-dlg-m ow-dlg-rt"/.test(modal.html),
    'still showing what each line costs and how much of it there is');
  t.check(/class="ow-dlg-ck bl-receive"/.test(modal.html), 'and still offering to receive it');

  /* IN THE UNIT THE LINE WAS CHOSEN IN. A line chosen as 2 Ctn is on the
     list as 2 Ctn at the carton price, not as 200 Pair at the pair price
     -- the person collecting it asks the supplier for cartons. */
  data.savedQuotes = [order({ id: 41, items: [line({ productId: 'P1', productName: 'Soft Close',
    unit: 'Pair', packUnit: 'Ctn', packQty: 100, qtyIn: 'pack', qty: 200, price: 2150 })] })];
  data.prices = [price({ id: 1, supplierId: 'S1', wholesale: 2150, retail: 2400, packQty: 100, packUnit: 'Ctn', unit: 'Pair' })];
  openBuyingList();
  const qtyCell = (modal.html.match(/class="ow-dlg-m ow-dlg-rt">([^<]*)/) || [])[1];
  t.check(/>2 Ctn</.test(modal.html) && !/200 Pair/.test(modal.html),
    `a carton line is listed as 2 Ctn (${qtyCell})`);
  /* At the carton price: 2 Ctn of 100 Pair at 2,150 is 430,000, and the
     cost column is what will actually be handed over. The old card said
     the per-carton price beside the quantity; the row says the line's
     own cost, which is the figure the buyer counts out. */
  t.check(/>430,000</.test(modal.html),
    `costed at the carton price, 200 × 2,150 = 430,000 (${(modal.html.match(/class="ow-dlg-v ow-dlg-rt">([^<]*)/) || [])[1]})`);

  /* Every branch of that control, not just the common one. Blanking the
     shortfall test still leaves a plain "Receive" on an unreceived line,
     so checking only for the class passed on a card that had lost the
     two states somebody actually has to act on. */
  /* Both lines on P1, the product this fixture actually prices. A line
     with no supplier price has a null lineCost and is dropped before it
     reaches a card, so pointing the second one at unpriced P2 tested a
     row that was never rendered. */
  data.savedQuotes = [order({ items: [
    line({ receivedAt: '2026-08-03', receivedQty: 4, receivedPrice: 10000 }),    // 4 of 10 came
    line({ productName: 'Cement (second line)', receivedAt: '2026-08-03', receivedQty: 10, receivedPrice: 10000 }),
  ] })];
  openBuyingList();
  t.check(/still owed to/.test(modal.html) && /bl-receive/.test(modal.html),
    'a line that came back short offers to receive the rest');
  t.check(/class="ow-dlg-undo bl-undo"/.test(modal.html),
    'and a line already received offers to undo it');
  /* THE TICK IS THE DIFFERENCE. Received in full wears one and is
     finished business; received short does not, so it still reads as
     something somebody has to act on -- and its box is still the
     check-in, which is what tops up the rest. */
  t.check(/class="ow-dlg-ck ow-on bl-undo"/.test(modal.html)
    && /class="ow-dlg-ck bl-receive"/.test(modal.html),
    'with the two drawn differently — short still needs somebody, received in full does not');

  data.savedQuotes = [order()];
  openBuyingList();
  t.check(/data-dlg="sendstop"/.test(modal.html) && /data-dlg="bringstop"/.test(modal.html),
    'with both ways of getting the goods on the stop head');

  /* Every table rule is gone rather than left behind unused. Named by
     their own selector, not by a bare property: "table-layout:fixed"
     also belongs to the quote items panel and the shortfall plan, so
     searching for the property alone failed on two tables that are
     still very much alive. */
  ['.bl-lines{', '.bl-lines table{', '.bl-lines col.item{', '.bl-lines col.recv{'].forEach((dead) => {
    t.check(!src.includes(dead), `the dead rule "${dead}" is removed, not orphaned`);
  });
  t.check(!/\.bl-lines table\{min-width/.test(src),
    'and so is the phone minimum-width that existed only to make those columns scrollable');

  /* And the card's own width is what keeps it on a phone, rather than a
     scroller inside a scroller. */
  const cardCss = (/\.bl-card\{[^}]*\}/.exec(src) || [''])[0];
  t.check(/flex-basis:clamp\(/.test(cardCss),
    `the card is sized by clamp so it fits a phone and a monitor alike (${cardCss})`);
}

/* ---------- 11. the answer is the headline, and it is not grey -------- */
/*
 * Reported: "the most important hint 'Enough on hand' is buried in a card
 * with a lot of other details", and "you emphasised what the trips would
 * cost, but you do not show it alongside the shortfall in our cash
 * position side by side".
 *
 * Both true. The cost sat in the modal header, the money sat in a row of
 * account chips, and the verdict sat underneath those chips as a
 * sentence -- three places for one thought, with the account split given
 * the most room. A gap means nothing without the two numbers it came
 * from, so those two and the gap are now one line of figures.
 *
 * And the block was grey, the same grey as every supplier block below
 * it, so the answer looked like one more container of details.
 */
{
  data.prices = [price()];
  data.savedQuotes = [order()];
  openBuyingList();

  t.check(/class="bl-verdict/.test(modal.html), 'the cash answer is its own block');
  const figs = [...modal.html.matchAll(/class="bl-fig-label">([^<]+)</g)].map((m) => m[1]);
  t.check(figs.length === 3, `three figures, side by side (${figs.join(' / ')})`);
  t.check(/To buy/.test(figs[0]) && /On hand/.test(figs[1]),
    'the cost and the money it comes out of, in that order');
  /* Tied to the arithmetic rather than accepting either word. An
     alternation -- /Left after|Short by/ -- passes whichever the code
     prints, so a version that called a shortfall "Left after" satisfied
     it. This fixture holds no cash, so the third figure is a shortfall
     and must say so. */
  const pos = scope.cashPositionForBuying(scope.beingPreparedOrders());
  t.check(pos.short > 0, `the fixture is short of cash, which is what makes this readable (${pos.short})`);
  t.check(figs[2] === 'Short by',
    `so the third figure is named as a shortfall, not as money left over (${figs[2]})`);
  t.check(/class="bl-verdict short"/.test(modal.html), 'and the block carries the shortfall state');
  t.check(/Not enough for everything on this board/.test(modal.html),
    'with the verdict saying which way it went');
  t.check(/class="bl-fig strong"/.test(modal.html),
    'the answer drawn larger than the two figures it is derived from');

  /* Colour carries the verdict, and is the reason it can never be
     mistaken for a supplier card. */
  const verdictCss = (/\.bl-verdict\{[\s\S]*?\}/.exec(src) || [''])[0];
  t.check(/verdigris-soft/.test(verdictCss),
    'a good answer is tinted, not grey — grey is what made it look like another container');
  t.check(/\.bl-verdict\.short\{background:var\(--ow-crimson-soft\)/.test(src),
    'and a bad one is red');
  t.check(!/\.bl-verdict\{[^}]*ow-steel-050/.test(src),
    'neither state uses the neutral grey the run cards sit on');

  // The split is kept, because money in the bank does not buy cement for
  // cash -- but it is no longer the biggest thing in the block.
  t.check(/class="bl-verdict-accounts"/.test(modal.html), 'the account split is still shown');
  const accountsAt = modal.html.indexOf('bl-verdict-accounts');
  const figsAt = modal.html.indexOf('bl-verdict-figs');
  t.check(figsAt > -1 && accountsAt > figsAt,
    'below the figures rather than above them, which is the demotion the report asked for');
}

/* ---------- 12. and when there is nothing left to buy ----------------- */
/*
 * The finished state, which read worse than the working one. Every line
 * received, so the block said:
 *
 *   TO BUY 0  from  ON HAND 1,150,000  leaves  LEFT AFTER 1,150,000
 *   Enough on hand for everything on this board
 *
 * -- an affordability verdict on a bill of nothing, true the way "you
 * can afford to buy no cement" is true. And each supplier card
 * headlined "0 UGX", which reads as a price rather than as a run that
 * is done.
 */
{
  data.prices = [price()];
  data.savedQuotes = [order({ items: [
    line({ receivedAt: '2026-08-03', receivedQty: 10, receivedPrice: 10000 }),
  ] })];
  openBuyingList();

  t.check(/class="bl-verdict done"/.test(modal.html),
    'a board with nothing left to buy gets its own state');
  t.check(/Nothing left to buy/.test(modal.html),
    'and says that, rather than pronouncing on whether it can afford nothing');
  t.check(!/bl-fig-label/.test(modal.html),
    'the three figures are gone — subtracting nothing from the float says nothing');
  t.check(/on hand/.test(modal.html),
    'while what the shop is holding is still worth a glance');

  /* The stop with nothing left to spend on it. It is still LISTED --
     its lines keep their Undo, which is the whole reason the list keeps
     a line a walking round would drop -- and it costs nothing, because
     nothing is left to spend there. What it does not do is offer to send
     anybody: there is nothing to fetch. */
  t.check(/Stop 1 · /.test(modal.html), 'the stop is still listed, so its receipts can still be undone');
  t.check(/class="ow-dlg-g-v">0</.test(modal.html),
    'costing nothing, because nothing is left to buy there');
  t.check(!/data-dlg="sendstop"/.test(modal.html),
    'with nobody offered to be sent, because there is nothing to fetch');

  /* A run only half in is NOT finished, or the card would go quiet while
     money was still owed. */
  data.savedQuotes = [order({ items: [
    line({ receivedAt: '2026-08-03', receivedQty: 10, receivedPrice: 10000 }),
    line({ productName: 'Cement (still coming)' }),
  ] })];
  openBuyingList();
  t.check(/data-dlg="sendstop"/.test(modal.html),
    'one line still to come keeps the stop live');
  t.check(!/bl-verdict done/.test(modal.html) && /bl-fig-label/.test(modal.html),
    'and the figures come back, because there is buying left to afford');

  data.savedQuotes = [order()];
  openBuyingList();
}



process.exit(t.done() ? 1 : 0);
