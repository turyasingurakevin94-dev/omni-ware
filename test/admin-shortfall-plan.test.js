#!/usr/bin/env node
'use strict';
/*
 * Whether the shop can actually afford the board, and what to do if not.
 *
 * "The board needs 640,000" is half a question. The other half is whether
 * the shop HAS 640,000, and that is spread across three Cash Book
 * accounts which are not interchangeable on the day -- money in the bank
 * does not buy cement from a yard that wants cash this morning.
 *
 * Two rankings live here and they answer different questions. Keeping
 * them apart is the point:
 *
 *   debts    ranked by AGE, then amount. A debt has no profit margin --
 *            it is money already earned. The only useful ordering is
 *            which one has been out longest.
 *
 *   orders   ranked by profit per shilling of buying, over the Being
 *            Prepared step and nothing else. Not by profit: an order
 *            making 400,000 on 2,000,000 of buying ties up float that two
 *            orders making 150,000 each on 300,000 would have returned by
 *            the weekend. When cash is the binding constraint -- the
 *            premise of the whole screen -- return per shilling is what
 *            decides how much trading gets done before the money is back.
 *
 * The balance is read through the Cash Book's own closing arithmetic
 * rather than re-summed here, so this screen cannot drift from the Cash
 * Book screen, and it carries from the last closed day when today has not
 * been opened yet -- otherwise it read zero every morning.
 *
 * Run: node test/admin-shortfall-plan.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('admin shortfall plan');
const src = read('index.html');
const sharedJs = read('shared-worker.js');

const data = {
  savedQuotes: [], suppliers: [], products: [], prices: [],
  customers: [], cashTxns: [], cashDays: {},
};
const modal = {};
const TODAY = '2026-08-03';

const scope = compileScope([
  extractDeclaration(sharedJs, 'SQ_BOARD_HIDE_AFTER_MS', 'shared-worker.js'),
  extractFunction(sharedJs, 'quoteAgedOffBoard', 'shared-worker.js'),
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
  extractFunction(src, 'orderPurchaseLines', 'index.html'),
  extractFunction(src, 'orderCashToBuy', 'index.html'),
  extractFunction(src, 'orderUnpricedLines', 'index.html'),
  extractFunction(src, 'beingPreparedOrders', 'index.html'),
  extractFunction(src, 'cashPositionForBuying', 'index.html'),
  extractFunction(src, 'daysSinceDate', 'index.html'),
  extractFunction(src, 'customerOpenCharges', 'index.html'),
  extractFunction(src, 'customerOldestOpenChargeDate', 'index.html'),
  extractFunction(src, 'collectableDebts', 'index.html'),
  extractFunction(src, 'debtsCovering', 'index.html'),
  extractFunction(src, 'orderIsRepeatClient', 'index.html'),
  extractDeclaration(src, 'BUYING_PRIORITY_REPEAT_BONUS', 'index.html'),
  extractFunction(src, 'orderBuyingPriority', 'index.html'),
  extractFunction(src, 'buyingPlanWithin', 'index.html'),
], {
  data,
  todayISO: () => TODAY,
  savedQuoteTotal: (q) => (q.items || []).reduce((s, i) => s + (Number(i.qty) || 0) * (Number(i.sellPrice) || 0), 0),
  supplierName: (id) => String(id),
}, ['cashOnHandFor', 'cashOnHandByAccount', 'cashPositionForBuying', 'collectableDebts',
  'debtsCovering', 'orderIsRepeatClient', 'orderBuyingPriority', 'buyingPlanWithin',
  'beingPreparedOrders', 'orderCashToBuy']);

const txn = (o) => Object.assign({ id: 1, date: TODAY, account: 'cash', type: 'receipt', amount: 0 }, o);
const price = (o) => Object.assign({
  id: 1, productId: 'P1', variantIdx: null, supplierId: 'S1',
  wholesale: 1000, retail: 1000, packQty: 0, tiers: [], outOfStock: false }, o);
const line = (o) => Object.assign({
  productId: 'P1', variantIdx: null, productName: 'Cement', unit: 'bag',
  qty: 10, supplierId: 'S1', price: 1000, sellPrice: 1500 }, o);
const order = (o) => Object.assign({
  id: 900, client: { name: 'Moses' }, date: TODAY, status: 'preparing',
  items: [line()], voided: false, invoiced: false, invoicedTs: null,
  amountPaid: 0, customerId: null, stageEnteredAt: Date.now() }, o);

const resetWorld = () => {
  data.prices = [price()];
  data.products = [{ id: 'P1', name: 'Cement', variants: [] }];
  data.suppliers = [{ id: 'S1', name: 'Roto' }];
  data.savedQuotes = []; data.customers = []; data.cashTxns = []; data.cashDays = {};
};

/* ---------- 1. what the shop is holding ------------------------------- */
{
  resetWorld();
  data.cashDays[TODAY] = { opening: { cash: 500000, momo: 200000, bank: 300000 }, actual: {}, openingSet: true };
  data.cashTxns = [
    txn({ id: 1, account: 'cash', type: 'receipt', amount: 120000 }),
    txn({ id: 2, account: 'cash', type: 'payment', amount: 50000 }),
    txn({ id: 3, account: 'momo', type: 'expense', amount: 20000 }),
  ];

  const held = scope.cashOnHandByAccount();
  const by = Object.fromEntries(held.byAccount.map((a) => [a.key, a.amount]));
  t.check(by.cash === 570000, `cash is opening plus receipts less payments (got ${by.cash})`);
  t.check(by.momo === 180000, `an expense comes off the account it was paid from (got ${by.momo})`);
  t.check(by.bank === 300000, 'an account with no movement still reports its opening');
  t.check(held.total === 1050000, `and the three add up (got ${held.total})`);
  t.check(held.byAccount.length === 3 && held.byAccount.every((a) => a.label),
    'each account is named, because they are not interchangeable on the day');
}

/* ---------- 2. a morning before the book is opened -------------------- */
{
  // The balance does not become zero because nobody has opened today yet.
  // It carries from the last day that was closed -- the same rule the Cash
  // Book itself uses to propose an opening.
  resetWorld();
  data.cashDays['2026-08-01'] = { opening: { cash: 400000, momo: 0, bank: 0 }, actual: {}, openingSet: true };
  data.cashTxns = [txn({ id: 1, date: '2026-08-01', account: 'cash', type: 'receipt', amount: 100000 })];

  t.check(scope.cashOnHandFor('cash') === 500000,
    `an unopened day carries yesterday's closing balance (got ${scope.cashOnHandFor('cash')})`);

  // A counted figure beats a calculated one, exactly as carriedOpening says.
  data.cashDays['2026-08-01'].actual = { cash: 480000 };
  t.check(scope.cashOnHandFor('cash') === 480000,
    `a physically counted close is what carries (got ${scope.cashOnHandFor('cash')})`);

  // And today's own movements still land on top of it.
  data.cashTxns.push(txn({ id: 2, date: TODAY, account: 'cash', type: 'payment', amount: 30000 }));
  t.check(scope.cashOnHandFor('cash') === 450000, "today's movements count against the carried balance");

  // Every kind of outgoing, not just payments. This branch is only reached
  // on a day nobody has opened yet, so it does not share cbClosingFor's
  // coverage and has to be checked on its own -- an expense left in would
  // make the shop look like it had money it had already spent.
  data.cashTxns.push(txn({ id: 3, date: TODAY, account: 'cash', type: 'expense', amount: 20000 }));
  t.check(scope.cashOnHandFor('cash') === 430000,
    `an expense on an unopened day comes off too (got ${scope.cashOnHandFor('cash')})`);
}

/* ---------- 3. the position: held against needed ---------------------- */
{
  resetWorld();
  data.cashDays[TODAY] = { opening: { cash: 100000, momo: 0, bank: 0 }, actual: {}, openingSet: true };
  data.savedQuotes = [order({ id: 1, items: [line({ qty: 10 })] })];   // needs 10,000

  let pos = scope.cashPositionForBuying();
  t.check(pos.needed === 10000 && pos.onHand === 100000, 'the position pairs what is needed with what is held');
  t.check(pos.after === 90000 && pos.short === 0, 'a surplus reports what is left and no shortfall');

  data.cashDays[TODAY].opening.cash = 4000;
  pos = scope.cashPositionForBuying();
  t.check(pos.short === 6000,
    `a shortfall is reported as a positive number (got ${pos.short}), so no caller has to work out which way a signed surplus reads`);
  t.check(pos.after === -6000, 'with the signed figure still available underneath');
}

/* ---------- 4. debts rank by age, and carry no margin ----------------- */
{
  resetWorld();
  const charge = (date, amount) => ({ id: 1, date, type: 'charge', amount });
  data.customers = [
    { id: 'k1', name: 'Big but recent', debt: 900000, debtLog: [charge('2026-08-01', 900000)] },
    { id: 'k2', name: 'Small but old', debt: 120000, debtLog: [charge('2026-05-01', 120000)] },
    { id: 'k3', name: 'Settled up', debt: 0, debtLog: [] },
  ];

  const debts = scope.collectableDebts();
  t.check(debts.length === 2, 'a customer who owes nothing is not on the list to be chased');
  t.check(debts[0].id === 'k2',
    'the oldest debt leads, not the biggest -- it is the one most likely to keep ageing');
  t.check(debts[0].ageDays > debts[1].ageDays, 'age is measured from the oldest still-open charge');

  // The rule the user asked for explicitly: margin belongs to orders, not
  // to debts. A debt is money already earned; there is no margin left in it.
  const fnSrc = extractFunction(src, 'collectableDebts', 'index.html');
  t.check(!/margin|profit|sellPrice/i.test(fnSrc),
    'nothing about profit or margin enters the debtor ranking');

  const cover = scope.debtsCovering(200000, debts);
  t.check(cover.rows.length === 2 && cover.enough,
    'it says how many calls it actually takes to cover the gap, rather than leaving the admin to add them up');
  t.check(scope.debtsCovering(50000, debts).rows.length === 1, 'stopping as soon as the gap is covered');
  t.check(scope.debtsCovering(5000000, debts).enough === false,
    'and saying plainly when collecting everything still is not enough');
  t.check(scope.debtsCovering(0, debts).rows.length === 0, 'no shortfall means nobody needs chasing');
}

/* ---------- 5. orders rank by return per shilling, over THIS step ----- */
{
  resetWorld();
  data.products = [{ id: 'P1', name: 'Cement', variants: [] }, { id: 'P2', name: 'Nails', variants: [] }];
  data.prices = [
    price({ id: 1, productId: 'P1', supplierId: 'S1', wholesale: 1000, retail: 1000 }),
    price({ id: 2, productId: 'P2', supplierId: 'S1', wholesale: 1000, retail: 1000 }),
  ];
  // Fat: 400,000 profit on 2,000,000 of buying   -> 0.20 per shilling
  // Lean: 150,000 profit on   300,000 of buying  -> 0.50 per shilling
  const fat = order({ id: 1, client: { name: 'Fat' },
    items: [line({ productId: 'P1', qty: 2000, price: 1000, sellPrice: 1200 })] });
  const lean = order({ id: 2, client: { name: 'Lean' },
    items: [line({ productId: 'P2', qty: 300, price: 1000, sellPrice: 1500 })] });
  data.savedQuotes = [fat, lean];

  const ranked = scope.orderBuyingPriority();
  t.check(ranked[0].q.id === 2,
    'the order returning more per shilling leads, even though the other makes more money outright');
  t.check(ranked[0].profit === 150000 && ranked[1].profit === 400000,
    'and the bigger absolute profit is still reported, so the admin can disagree with the ranking');
  t.check(Math.abs(ranked[0].ratio - 0.5) < 1e-9 && Math.abs(ranked[1].ratio - 0.2) < 1e-9,
    'the ratio is profit over cash committed');

  // Scoped to the step, which is the whole question this screen asks.
  data.savedQuotes = data.savedQuotes.concat([
    order({ id: 3, status: 'draft', client: { name: 'Draft' }, items: [line({ qty: 9999 })] }),
    order({ id: 4, status: 'pending_delivery', client: { name: 'Gone' }, items: [line({ qty: 9999 })] }),
    order({ id: 5, status: 'preparing', voided: true, client: { name: 'Void' }, items: [line({ qty: 9999 })] }),
  ]);
  const ids = scope.orderBuyingPriority().map((r) => r.q.id).sort();
  t.check(JSON.stringify(ids) === '[1,2]',
    `only orders being prepared right now are ranked (got ${JSON.stringify(ids)})`);

  // An order needing no buying is not competing for the money.
  data.savedQuotes = [order({ id: 6, items: [line({ supplierId: '__stock__' })] })];
  t.check(scope.orderBuyingPriority().length === 0,
    'an order coming off our own shelf is not in the queue for cash, and does not divide by zero');
}

/* ---------- 6. a repeat customer edges ahead, and no further ---------- */
{
  resetWorld();
  data.savedQuotes = [
    order({ id: 1, client: { name: 'Namuli' }, status: 'completed', items: [line()] }),   // their history
    order({ id: 2, client: { name: 'Namuli' }, items: [line({ qty: 100, price: 1000, sellPrice: 1200 })] }),
    order({ id: 3, client: { name: 'Stranger' }, items: [line({ qty: 100, price: 1000, sellPrice: 1200 })] }),
  ];

  const ranked = scope.orderBuyingPriority();
  t.check(ranked[0].q.id === 2 && ranked[0].repeat === true,
    'at an identical return the customer who has paid before goes first');
  t.check(ranked[1].repeat === false, 'and the stranger is marked as such rather than hidden');

  // A nudge, not an override: a materially better return still wins.
  data.savedQuotes[2] = order({ id: 3, client: { name: 'Stranger' },
    items: [line({ qty: 100, price: 1000, sellPrice: 1600 })] });   // 0.60 vs 0.20
  const ranked2 = scope.orderBuyingPriority();
  t.check(ranked2[0].q.id === 3,
    'a much better return beats the repeat bonus, which must not bury a materially better order');
  t.check(scope.orderIsRepeatClient(data.savedQuotes[1]) === true, 'repeat is judged over the whole book');
  t.check(scope.orderIsRepeatClient({ id: 99, client: { name: 'Nobody' } }) === false,
    'a first-time customer is not a repeat one');
  t.check(scope.orderIsRepeatClient({ id: 99, client: {} }) === false,
    'and a nameless order does not match every other nameless one');
}

/* ---------- 7. where the money actually runs out ---------------------- */
{
  resetWorld();
  data.savedQuotes = [
    order({ id: 1, client: { name: 'A' }, items: [line({ qty: 100, price: 1000, sellPrice: 2000 })] }), // 100k
    order({ id: 2, client: { name: 'B' }, items: [line({ qty: 100, price: 1000, sellPrice: 1500 })] }), // 100k
    order({ id: 3, client: { name: 'C' }, items: [line({ qty: 100, price: 1000, sellPrice: 1200 })] }), // 100k
  ];
  const ranked = scope.orderBuyingPriority();
  const plan = scope.buyingPlanWithin(250000, ranked);

  t.check(plan.fund.length === 2 && plan.wait.length === 1,
    `the line falls somewhere specific (${plan.fund.length} funded, ${plan.wait.length} waiting)`);
  t.check(plan.fund[0].q.id === 1 && plan.fund[1].q.id === 2,
    'and it takes them in priority order, so the money buys the best two');
  t.check(plan.spent === 200000 && plan.left === 50000,
    `with what is spent and what is left stated (${plan.spent} / ${plan.left})`);
  t.check(scope.buyingPlanWithin(0, ranked).fund.length === 0,
    'no money funds nothing, rather than funding the first order anyway');
  t.check(scope.buyingPlanWithin(10000000, ranked).wait.length === 0,
    'and enough money leaves nobody waiting');
}

/* ---------- 8. the plan renders what it computed ---------------------- */
{
  // Rendered through the real function, so the copy cannot claim something
  // the arithmetic above does not support.
  resetWorld();
  data.cashDays[TODAY] = { opening: { cash: 50000, momo: 0, bank: 0 }, actual: {}, openingSet: true };
  data.customers = [{ id: 'k1', name: 'Okello', debt: 400000, debtLog: [{ id: 1, date: '2026-06-01', type: 'charge', amount: 400000 }] }];
  data.savedQuotes = [order({ id: 1, client: { name: 'Namuli' }, items: [line({ qty: 100, price: 1000, sellPrice: 2000 })] })];

  const plan = compileScope([
    extractFunction(src, 'openShortfallPlan', 'index.html'),
  ], {
    data,
    beingPreparedOrders: scope.beingPreparedOrders,
    cashPositionForBuying: scope.cashPositionForBuying,
    orderBuyingPriority: scope.orderBuyingPriority,
    buyingPlanWithin: scope.buyingPlanWithin,
    collectableDebts: scope.collectableDebts,
    debtsCovering: scope.debtsCovering,
    quoteClientName: (q) => (q && q.client && q.client.name) || 'Unnamed client',
    invoiceNumberLabel: (q) => 'INV-' + String(q.id).padStart(4, '0'),
    agingDaysLabel: (d) => `${d} days`,
    esc: (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
    fmtUGX: (n) => Number(n || 0).toLocaleString('en-US') + ' UGX',
    ICON_COLLECT: '<svg data-i="collect"></svg>', ICON_PLAN: '<svg data-i="plan"></svg>',
    ICON_WALLET: '<svg data-i="wallet"></svg>', ICON_WARN: '<svg data-i="warn"></svg>',
    openModal: (id) => { modal.opened = id; },
    document: { getElementById: () => ({ set innerHTML(v) { modal.html = v; } }) },
  }, ['openShortfallPlan']);

  plan.openShortfallPlan();
  const html = modal.html;

  t.check(modal.opened === 'shortfallPlanModal', 'the plan opens its own modal, not over the buying list');
  t.check(/50,000 UGX/.test(html), 'it states what is on hand');
  t.check(/Okello/.test(html), 'names who to collect from');
  t.check(/Namuli/.test(html), 'and which order the money should go to');
  t.check(/sp-cut/.test(html) || /does not have yet/.test(html),
    'marking where the money runs out, since that is the answer being looked for');

  // The debtor section must not present a margin for a debt.
  const debtSection = html.slice(html.indexOf('already earned'), html.indexOf('What the money on hand'));
  t.check(debtSection.length > 0 && !/margin/i.test(debtSection),
    'and says nothing about margin in the debts section, where the idea does not apply');
}

process.exit(t.done() ? 1 : 0);
