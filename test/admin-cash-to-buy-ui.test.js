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
  extractFunction(src, 'cashToBuyBannerHTML', 'index.html'),
  extractFunction(src, 'orderMetaRowHTML', 'index.html'),
  extractFunction(src, 'orderCashStripHTML', 'index.html'),
  extractFunction(src, 'openBuyingList', 'index.html'),
], {
  data,
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

  /* What the client pays moved OFF the meta row and onto the name row,
     right-aligned in mono -- who and how much are the two facts a board
     is scanned for, and buried mid-row the figure read like a timestamp.
     The meta row must not carry it any more (two money figures on one
     card is how the buy cost gets read as the sell price), and the name
     row must. */
  const sell = scope.orderMetaRowHTML(order({ items: [line({ qty: 10, sellPrice: 45000 })] }));
  t.check(figures(sell).every((n) => n !== 450000),
    'the sell total is no longer buried in the meta row');
  t.check(/class="sq-client-total" title="What the client pays">\$\{fmtUGX\(savedQuoteTotal\(q\)\)\}/.test(read('index.html')),
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

/* ---------- 4b. it never says the same number twice ------------------- */
/*
 * A real board: one order, every line from Okuosi Gypsum. The runs
 * partition exactly the lines the headline is summed from, so with a
 * single supplier that run's total IS the headline -- and the banner
 * printed it again directly underneath itself. The screenshot that
 * raised this read 2,309,000 UGX over 2,309,000 UGX.
 *
 * Equivalent mutant, named: dropping the amount when runs.length === 1
 * cannot be distinguished from dropping it when the run total happens
 * to equal the headline, because those are the same condition. The
 * assertions below are written on the count of suppliers, which is what
 * the rule is actually about.
 */
{
  data.products = [{ id: 'P1', name: 'Cement', variants: [] }, { id: 'P2', name: 'Nails', variants: [] }];
  data.prices = [
    price({ id: 1, productId: 'P1', supplierId: 'S1', wholesale: 1000, retail: 1000 }),
    price({ id: 2, productId: 'P2', supplierId: 'S2', wholesale: 500, retail: 500 })];

  const alone = scope.cashToBuyBannerHTML([order({ items: [
    line({ productId: 'P1', qty: 2 }), line({ productId: 'P1', qty: 3 })] })]);
  t.check(figures(alone).length === 1 && figures(alone)[0] === 5000,
    `one supplier prints its amount once, not twice (got ${JSON.stringify(figures(alone))})`);
  t.check(/All from Roto/.test(alone),
    'and names them instead -- the supplier is the fact the headline does not already carry');
  t.check(!/<b>/.test(alone),
    'with no second figure left on the row at all');

  const both = scope.cashToBuyBannerHTML([order({ items: [
    line({ productId: 'P1', qty: 2 }),
    line({ productId: 'P2', productName: 'Nails', qty: 4, supplierId: 'S2' })] })]);
  t.check(figures(both).length === 3 && figures(both)[0] === 4000,
    `two suppliers still carry an amount each under the headline (got ${JSON.stringify(figures(both))})`);
  t.check(!/All from/.test(both),
    'and none of them claims to be all of it');

  // It opens the buying list. Nothing on it said so.
  t.check(/data-i="go"/.test(alone), 'the banner shows it can be pressed');
}

/* ---------- 4c. nothing on it wraps -------------------------------------
 *
 * A lane is 270px, which leaves this card about 230px inside its padding.
 * The label and the amount were laid out abreast in it -- 74px and 123px
 * measured -- so BOTH wrapped, and the amount broke after its digits and
 * stranded "UGX" on a line of its own. These are the CSS facts that stop
 * that, held here because no assertion on the markup can see a wrap.
 */
{
  const rule = (sel) => (new RegExp(`\\${sel}\\{[^}]*\\}`).exec(src) || [''])[0];

  t.check(/display:block/.test(rule('.sq-cash-fig')) && !/margin-left:auto/.test(rule('.sq-cash-fig')),
    'the amount is a line of its own, not the right-hand end of the label’s row');
  t.check(/white-space:nowrap/.test(rule('.sq-cash-fig')),
    'and cannot be broken in the middle whatever the lane is doing');
  t.check(/white-space:nowrap/.test(rule('.sq-cash-label')),
    'nor can the label, which is why it can sit above rather than fight for room');

  /* The supplier chips were panel-white on a panel-white card: the pill
     had a radius and padding that drew nothing at all. Rows instead --
     and the guard is that the run must not repaint the card's own
     background, whatever it is. */
  const runRule = rule('.sq-cash-run');
  const cardRule = rule('.sq-cash');
  t.check(/background:var\(--panel\)/.test(cardRule) && !/background:/.test(runRule),
    'a run paints no background of its own, so it cannot be an invisible pill on the card again');
  t.check(/text-overflow:ellipsis/.test(rule('.sq-cash-run .nm')) && /white-space:nowrap/.test(rule('.sq-cash-run b')),
    'and when a name is too long for the lane it is the NAME that yields, never the amount');
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

  t.check(/data-i="clock"/.test(meta) && /data-i="items"/.test(meta),
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
  scope.openBuyingList();

  t.check(!/<table/.test(modal.html),
    'the run no longer draws a table — that was the thing forcing a full-width block');
  t.check(/class="dr-carousel"/.test(modal.html) && /class="dr-track" id="bl_track"/.test(modal.html),
    'the suppliers sit in the same track the pickup and delivery runs use');
  t.check(/class="dr-card bl-card"/.test(modal.html),
    'and carry the shared card class, so one change of that pattern moves all three screens');
  t.check(/id="bl_prev"/.test(modal.html) && /id="bl_next"/.test(modal.html),
    'with the same arrows');
  t.check(/wireRunCarousel\('bl_track', 'bl_prev', 'bl_next'\)/.test(src),
    'wired by the shared helper rather than a second copy of the scrolling');
  t.check(/Slide sideways for the next supplier/.test(modal.html),
    'and says so, the way the other two do');

  // The card still carries everything the table row did.
  t.check(/class="bl-items"/.test(modal.html), 'the lines are a list');
  t.check(/class="bl-item-cost"/.test(modal.html) && /class="bl-item-qty"/.test(modal.html),
    'still showing what each line costs and how much of it there is');
  t.check(/class="bl-receive"/.test(modal.html), 'and still offering to receive it');

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
  scope.openBuyingList();
  t.check(/Receive rest/.test(modal.html),
    'a line that came back short offers to receive the rest');
  t.check(/class="bl-undo"/.test(modal.html),
    'and a line already received offers to undo it');
  t.check(/class="bl-item-row bl-short"/.test(modal.html)
    && /class="bl-item-row bl-received"/.test(modal.html),
    'with the two drawn differently — short still needs somebody, received in full does not');

  data.savedQuotes = [order()];
  scope.openBuyingList();
  t.check(/class="bl-send"/.test(modal.html) && /class="bl-bringing"/.test(modal.html),
    'with both ways of getting the goods in the card footer');

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
  scope.openBuyingList();

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
  scope.openBuyingList();

  t.check(/class="bl-verdict done"/.test(modal.html),
    'a board with nothing left to buy gets its own state');
  t.check(/Nothing left to buy/.test(modal.html),
    'and says that, rather than pronouncing on whether it can afford nothing');
  t.check(!/bl-fig-label/.test(modal.html),
    'the three figures are gone — subtracting nothing from the float says nothing');
  t.check(/on hand/.test(modal.html),
    'while what the shop is holding is still worth a glance');

  /* The card for a run with nothing left to spend on it. */
  t.check(/class="dr-card bl-card done"/.test(modal.html),
    'and its supplier card is marked finished');
  t.check(/class="bl-card-done">All in</.test(modal.html),
    'reading "All in" rather than a price of zero');
  t.check(!/class="bl-send"/.test(modal.html),
    'with nobody offered to be sent, because there is nothing to fetch');

  /* A run only half in is NOT finished, or the card would go quiet while
     money was still owed. */
  data.savedQuotes = [order({ items: [
    line({ receivedAt: '2026-08-03', receivedQty: 10, receivedPrice: 10000 }),
    line({ productName: 'Cement (still coming)' }),
  ] })];
  scope.openBuyingList();
  t.check(!/bl-card done/.test(modal.html),
    'one line still to come keeps the card live');
  t.check(!/bl-verdict done/.test(modal.html) && /bl-fig-label/.test(modal.html),
    'and the figures come back, because there is buying left to afford');

  data.savedQuotes = [order()];
  scope.openBuyingList();
}



process.exit(t.done() ? 1 : 0);
