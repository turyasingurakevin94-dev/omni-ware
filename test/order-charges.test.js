#!/usr/bin/env node
'use strict';
/*
 * What the shop is paid for besides the goods.
 *
 * THE HOLE THIS FILLS. An order total was `q.items.reduce(qty * sell)`
 * and nothing else, so there was no way to be paid for anything but
 * goods. Delivering to Kyaliwajjala, sending somebody to Kikuubo to
 * fetch a line, cutting a 3m length -- all of it was given away, and a
 * delivery charge could only be typed as free text into a WhatsApp
 * message, where it reached no invoice, no statement and no margin.
 *
 * A CHARGE IS NOT AN ITEM, and that is the whole design. Everything that
 * reads q.items reads its elements as goods: they resolve a cost, they
 * key the per-line margin readings, they come off a shelf and they
 * become a picker's job. Two of those were already wrong for a line with
 * no product when this was written -- anRowsByItem would have filed a
 * delivery fee as an "Unknown item" earning 100%, and invoiceLineCost
 * would have reported it as a line whose cost is an ESTIMATE and
 * reddened the statements' trust check for good. So charges ride in
 * their own array and the goods pipeline never sees them. Most of this
 * file is that claim, asserted from the outside.
 *
 * Run: node test/order-charges.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('order charges');
const src = read('index.html');
const code = src;

const NAMES = ['orderCharges', 'chargeAmount', 'savedQuoteGoodsTotal', 'orderChargesTotal',
  'chargeCostTxn', 'chargeCostOf', 'orderChargesCost', 'chargeCostedCashIds',
  'orderChargeLines', 'orderTakesCharges', 'nextChargeId',
  /* The bill total now has a third part -- what waiting for the money
     costs -- and this file's subject is what the CHARGES come to. The
     credit chain rides along so the totals are the real ones; every
     order here takes no credit, so it adds nothing and proves it. */
  'savedQuoteCashTotal', 'orderCreditTerms', 'orderCreditCharge',
  'savedQuoteTotal', 'anInvoiceTotals'];

/* What a charge COST is read back off the cash book, so the scope needs
   one. A live binding rather than a copy: the reversal case empties it
   and expects the readers to notice. */
const store = { cashTxns: [], savedQuotes: [] };

const s = compileScope(NAMES.map((n)=> extractFunction(src, n, 'index.html')), {
  data: store,
  // What a LINE sells for is not this file's subject: the price on the
  // fixture is the price, so the goods total is arithmetic a reader can
  // check by eye.
  quoteItemSellPrice: (it)=> Number(it.sellPrice) || 0,
  // Costing is not the subject either. Every fixture line costs what it
  // says and none of it is an estimate, so anything this file reports as
  // estimated came from the charges -- which is exactly what section 4
  // is about.
  invoiceLineCost: (it)=> ({ cost: (Number(it.qty)||0) * (Number(it.price)||0), estimatedQty: 0 }),
}, NAMES);

// 30 bags at 32,000 and 8 sheets at 67,500 -- 1,500,000 of goods.
const order = (over)=> Object.assign({
  id: 41,
  items: [
    { productId: 'P001', qty: 30, sellPrice: 32000, price: 27500 },
    { productId: 'P002', qty: 8, sellPrice: 67500, price: 60000 },
  ],
  charges: [],
}, over);
const GOODS = 30*32000 + 8*67500;

const eq = (got, want, msg)=> t.check(got === want, `${msg} (got ${got}, want ${want})`);

/* ---------- 1. the goods, and the goods plus what it took to move them --- */
{
  eq(s.savedQuoteGoodsTotal(order()), GOODS, 'the goods come to what the lines come to');
  eq(s.savedQuoteTotal(order()), GOODS, 'and an order with no charge on it totals exactly that');

  const withDelivery = order({ charges: [{ id:1, service:'Delivery', label:'Delivery', type:'fixed', value:60000, cost:null }] });
  eq(s.savedQuoteTotal(withDelivery), GOODS + 60000,
    'a delivery adds itself to the bill');
  eq(s.savedQuoteGoodsTotal(withDelivery), GOODS,
    'and leaves what the goods come to exactly where it was');
}

/* ---------- 2. a percent is a percent OF THE GOODS ---------------------- *
 * Never of a running total. Two percents resolving against a total that
 * already holds the first would make the bill depend on which was tapped
 * first, and a shop cannot explain that to a customer.
 */
{
  const urgent = order({ charges: [{ id:1, service:'Urgent', label:'Urgent', type:'percent', value:5, cost:null }] });
  eq(s.savedQuoteTotal(urgent), GOODS + 75000, 'five per cent is five per cent of the items');

  const both = order({ charges: [
    { id:1, service:'Urgent', label:'Urgent', type:'percent', value:5, cost:null },
    { id:2, service:'Handling', label:'Handling', type:'percent', value:5, cost:null },
  ]});
  const swapped = order({ charges: both.charges.slice().reverse() });
  eq(s.savedQuoteTotal(both), GOODS + 75000 + 75000, 'two of them add, and neither compounds on the other');
  eq(s.savedQuoteTotal(both), s.savedQuoteTotal(swapped),
    'so the bill is the same whichever was tapped first');

  /* THE AMOUNT IS DERIVED, NEVER STORED. Adding a line after the percent
     was agreed moves the percent with it -- a figure frozen at the tap
     would print "5%" beside something that is five per cent of nothing
     on the document. */
  const bigger = order({ charges: urgent.charges,
    items: urgent.items.concat([{ productId:'P003', qty: 10, sellPrice: 7000, price: 6000 }]) });
  eq(s.chargeAmount(bigger.charges[0], s.savedQuoteGoodsTotal(bigger)), Math.round((GOODS + 70000) * 0.05),
    'and a line added afterwards moves it, because it is worked out and not remembered');
}

/* ---------- 3. money the shop is owed, never money it gives back -------- */
{
  const nil = order({ charges: [{ id:1, label:'Delivery', type:'fixed', value:0, cost:null }] });
  eq(s.savedQuoteTotal(nil), GOODS, 'a charge nobody has priced yet adds nothing');
  const neg = order({ charges: [{ id:1, label:'Goodwill', type:'fixed', value:-50000, cost:null }] });
  eq(s.savedQuoteTotal(neg), GOODS,
    'and a negative one adds nothing either — a discount is a decision about the price of the goods, not a charge');

  /* It is also refused at the door on the way in. */
  const guard = (/ch\.value = Math\.max\(0, Number\(inp\.value\)\|\|0\);/).test(src);
  t.check(guard, 'the field that sets it cannot be typed below nothing');
}

/* ---------- 4. the goods pipeline never sees a charge ------------------- *
 * The claim the whole design rests on.
 */
{
  const withDelivery = order({ charges: [
    { id:1, service:'Delivery', label:'Delivery', type:'fixed', value:60000, cost:null }] });
  const plain = order();

  const a = s.anInvoiceTotals(withDelivery), b = s.anInvoiceTotals(plain);
  eq(a.sales, b.sales, 'sales are the goods, and a charge does not join them');
  eq(a.cost, b.cost, 'cost of sales is what the goods cost, and a charge does not join that either');
  eq(a.qty, b.qty, 'a charge is not a unit sold');
  eq(a.estimatedQty, 0,
    'and it is never reported as a unit whose cost was a guess — which would redden the statements’ trust check for good');
  eq(a.services, 60000, 'it is reported on its own, as service income');
  eq(a.takings, GOODS + 60000, 'with the two together available for anything that wants the whole bill');
  eq(a.margin, b.margin, 'so the margin on the goods reads exactly as it did before the charge existed');

  /* And the stock paths cannot reach it, because it is not in items. */
  eq(withDelivery.items.length, 2, 'an order with a charge still has exactly its goods in items');
  t.check(!withDelivery.items.some((it)=> it.sellPrice === 60000),
    'the charge is nowhere among them, so picking, costing and the shelf never meet it');
}

/* ---------- 5. what it COST the shop is a PAYMENT, not a figure -------- *
 * A delivery costs what the driver was handed, and that money leaves the
 * drawer -- so it is already a cash entry, and the honest way to say what
 * the delivery cost is to point at that entry rather than type the amount
 * a second time beside it. Two copies of one figure is the drift this app
 * writes migrations about, and a typed cost with no money behind it is a
 * number invented to make a margin look answered.
 *
 * A delivery nobody has costed and a delivery that cost nothing are still
 * different facts, and one figure still cannot tell them apart.
 */
{
  store.cashTxns = [
    { id: 900, date:'2026-09-13', account:'cash', type:'payment', category:'Transport', amount:40000 },
  ];
  const mixed = order({ charges: [
    { id:1, label:'Delivery', type:'fixed', value:60000, costTxnId:900 },
    { id:2, label:'Cutting', type:'fixed', value:20000, costTxnId:null },
  ]});
  const c = s.orderChargesCost(mixed);
  eq(c.total, 40000, 'what was actually paid is added up, read back off the cash book');
  eq(c.uncosted, 1, 'and what nobody has paid for is counted, not read as free');

  const none = order({ charges: [{ id:1, label:'Delivery', type:'fixed', value:60000, costTxnId:null }] });
  eq(s.orderChargesCost(none).total, 0, 'an entirely uncosted set costs nothing so far');
  eq(s.orderChargesCost(none).uncosted, 1, 'and says so rather than looking cheap');

  /* REVERSE THE PAYMENT AND THE COST GOES WITH IT. This is the whole
     reason the amount is not stored on the charge: a figure left behind
     with nothing under it would go on claiming the shop paid a fare it
     has taken back. */
  store.cashTxns = [];
  eq(s.orderChargesCost(mixed).total, 0, 'a payment reversed in the cash book takes the cost with it');
  eq(s.orderChargesCost(mixed).uncosted, 2, 'and the charge reads as uncosted again, which is the truth');

  /* The statement lifts those entries out of running costs, so one fare
     is never both a cost of service and a cost of running the shop. */
  store.cashTxns = [{ id: 900, amount: 40000 }];
  store.savedQuotes = [mixed];
  const claimed = s.chargeCostedCashIds();
  t.check(claimed.has('900'),
    'and the statement can find the entry a charge has claimed, so the same fare is never charged twice');
}

/* ---------- 6. what a document is allowed to print ---------------------- */
{
  const doc = order({ charges: [
    { id:1, service:'Delivery', label:'Delivery', type:'fixed', value:60000, cost:null },
    { id:2, service:null, label:'', type:'fixed', value:0, cost:null },
    { id:3, service:'Urgent', label:'Urgent', type:'percent', value:5, cost:null },
  ]});
  const lines = s.orderChargeLines(doc);
  eq(lines.length, 2, 'a charge nobody has priced is not printed at all');
  eq(lines[0].label, 'Delivery', 'each printed charge is named');
  eq(lines[1].amount, 75000, 'and a percent reaches the paper as shillings, not as a percent');

  /* Every client-facing document draws from ONE list, so one cannot
     print a delivery the next leaves out. That list is orderBillLines,
     which is these charges plus the price of credit -- the charges
     reach the paper through it, never around it. */
  ['buildQuoteA5HTML', 'buildReceiptHTML', 'orderInvoiceCheckHTML'].forEach((fn)=>{
    t.check(/orderBillLines\(q\)/.test(extractFunction(src, fn, 'index.html')),
      `${fn} draws what it prints from the one bill list`);
  });
  t.check(/function orderBillLines\(q\)\{\s*const lines = orderChargeLines\(q\);/.test(src),
    'and that list starts from these charges, so nothing can print one without the other');
  const receipt = extractFunction(src, 'buildReceiptHTML', 'index.html');
  t.check(/item\$\{items\.length===1\?'':'s'\}`, receiptNum\(goods\)\)/.test(receipt),
    'and the receipt’s "n items" line totals the items, not the bill they ride on');
}

/* ---------- 7. an agent's order is refused, not half-supported ---------- *
 * agent.html works out what it owes from its own line prices, so a charge
 * added here would make the app and the agent disagree about one order.
 */
{
  t.check(s.orderTakesCharges(order()) === true, 'an ordinary order takes charges');
  t.check(s.orderTakesCharges(order({ originAgentId: 'A3' })) === false,
    'an agent’s order does not, because the agent app would never see it');
  t.check(/const takesCharges = orderTakesCharges\(data\.quote\);/.test(src)
    && /\${takesCharges \? chargeRowsHTML\(data\.quote, grandSell\) : ''}/.test(src)
    /* The offer is chips on the document's one add row now, not a row of
       its own; the gate is the same. */
    && /\${takesCharges \? chargeAddChipsHTML\(\) : ''}/.test(src),
    'and the screen draws the rows, and offers the taps that add one, only where charges are allowed');
}

/* ---------- 8. numbered inside the order it belongs to ------------------ */
{
  eq(s.nextChargeId(order()), 1, 'the first charge on an order is 1');
  eq(s.nextChargeId(order({ charges: [{ id: 1 }, { id: 4 }] })), 5,
    'and the next is past the highest, so removing one never reissues its number');
}

/* ---------- 9. THE ALLOW-LIST ------------------------------------------ *
 * buildSyncRows builds a saved quote's payload key by key rather than
 * spreading the order, so a new top-level field is dropped on every save
 * unless it is named there -- which is how order 151's origin vanished on
 * its first edit. A charge that saved in memory and was gone on the next
 * load would bill a customer for a delivery the books never heard of.
 * Asserted against the source because the failure is a missing key, and a
 * missing key is invisible to arithmetic.
 */
{
  t.check(/payload:\{client:q\.client, items:q\.items, charges:q\.charges\|\|\[\], credit:q\.credit\|\|null, savedAt:q\.savedAt,/.test(src),
    'the charges are named in the payload the sync sends');
  t.check(/client:\{name:'', phone:''\}, items:\[\], savedAt:null, payments:\[\], customerId:null, debtCharged:0,\n\s*charges:\[\],/.test(src),
    'and in the defaults an order saved before charges existed reads back through');
  t.check(/if\(!Array\.isArray\(data\.quote\.charges\)\) data\.quote\.charges = \[\];/.test(src),
    'while the draft is normalised in the one place every reset path goes through');
  /* Loading a saved order back for editing must carry them, deep-copied
     like the items -- the draft is edited in place and must not write
     through to the saved record. */
  t.check(/charges: JSON\.parse\(JSON\.stringify\(orderCharges\(q\)\)\),/.test(src),
    'and editing a saved order carries its charges in, by copy');
}

/* ---------- 10. the group message says what the client pays ------------ *
 * The sales group gets a copy of every saved order. It went out totalling
 * the GOODS while the invoice, the receipt and the customer all said a
 * larger figure -- so the one message the shop's own people read carried
 * a number that matched nothing. The charges ride the item column with
 * the quantity left empty: there is one delivery, and a "1" under a
 * quantity column invites somebody to ask for two.
 */
{
  const NAMES2 = ['orderCharges', 'chargeAmount', 'savedQuoteGoodsTotal', 'orderChargesTotal',
    'orderChargeLines', 'savedQuoteCashTotal', 'orderCreditTerms', 'orderCreditCharge',
    'creditTermLabel', 'orderBillLines',
    'waPadEnd', 'waPadStart', 'waFmtNum', 'waFitQty', 'waQtyLabel',
    'waAbbrUnit', 'quoteLinePack', 'buildSalesGroupQuoteMessage'];
  const g = compileScope(
    [extractDeclaration(src, 'WA_UNIT_ABBR', 'index.html')]
      .concat(NAMES2.map((n)=> extractFunction(src, n, 'index.html'))), {
    quoteItemSellPrice: (it)=> Number(it.sellPrice) || 0,
  }, NAMES2);

  const items = [{ productId:'P001', productName:'Cement', unit:'Bag', qty:30, sellPrice:32000 }];
  const withCharges = { items, charges: [
    { id:1, service:'Delivery', label:'Delivery', type:'fixed', value:60000 },
    { id:2, service:'Urgent', label:'Urgent', type:'percent', value:5 },
  ]};
  const msg = g.buildSalesGroupQuoteMessage(items, { name:'Kato' }, withCharges);

  // 30 x 32,000 = 960,000 of goods, 60,000 carried, 5% of the goods = 48,000.
  t.check(/TOTAL\s+1,068,000/.test(msg),
    `the total is the whole bill, not the goods alone (${(/TOTAL\s+([\d,]+)/.exec(msg) || [])[1]})`);
  t.check(/Delivery/.test(msg) && /Urgent/.test(msg),
    'and each charge is named, so the total is explained rather than just larger');

  /* The Ref section is about where to BUY each line. A delivery is not
     bought, so it must not appear there beside a supplier. */
  const ref = msg.slice(msg.indexOf('Ref:'));
  t.check(!/Delivery/.test(ref) && !/Urgent/.test(ref),
    'while the sourcing list below stays about goods, which is all it can be about');

  /* An order with no charges reads exactly as it did before any of this. */
  const plain = g.buildSalesGroupQuoteMessage(items, { name:'Kato' }, { items, charges: [] });
  t.check(/TOTAL\s+960,000/.test(plain), 'an order with no charge on it totals the goods, as it always did');
  t.check(plain === g.buildSalesGroupQuoteMessage(items, { name:'Kato' }),
    'and a caller that passes no order at all is unchanged, so nothing else that builds this message breaks');
}

/* ---------- 11. every statement line opens its own figure -------------- *
 * The drill-down adds its rows up and compares them against the line it
 * was opened from -- "a preview that quietly showed less than the
 * statement would teach a reader to distrust exactly the thing built to
 * earn trust". Splitting revenue into two lines broke that: Item sales
 * opened a panel that expected REVENUE and listed only the goods.
 */
{
  const drill = (/function stDrillData\(key, ctx\)[\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(/if\(key === 'pl:itemsales'\)[\s\S]{0,240}?rows: invoiceRows\('sales'\)/.test(drill)
    && /if\(key === 'pl:itemsales'\)[\s\S]{0,80}?expect: is\.itemSales/.test(drill),
    'Item sales opens the goods, and expects the goods');
  t.check(/if\(key === 'pl:services'\)[\s\S]{0,240}?rows: invoiceRows\('services'\)/.test(drill)
    && /if\(key === 'pl:services'\)[\s\S]{0,80}?expect: is\.serviceIncome/.test(drill),
    'Service income opens the charges, and expects the charges');
  t.check(/if\(key === 'pl:revenue'\)[\s\S]{0,260}?rows: invoiceRows\('takings'\)/.test(drill),
    'and Revenue opens the two together, so it agrees whether or not anything was charged');
  /* Each line points at the key that states its own figure. */
  const pl = (/function stProfitAndLoss\(ctx\)[\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(/stLine\('Item sales'[^)]*drill:'pl:itemsales'/.test(pl.replace(/\s+/g, ' '))
    || /'Item sales'[\s\S]{0,160}?drill:'pl:itemsales'/.test(pl),
    'the Item sales line opens pl:itemsales');
  t.check(/'Service income'[\s\S]{0,300}?drill:'pl:services'/.test(pl),
    'the Service income line opens pl:services');
}

/* ---------- 12. one fare, charged once ---------------------------------- *
 * Paying a driver is money out under Transport, and left alone it is a
 * running cost of the day it was paid. Named as what a delivery cost, it
 * belongs against the service income that delivery earned instead --
 * and counting it in both places would charge the shop twice for one
 * fare. Driven in the harness on a 12,750 delivery costed at 9,000:
 *
 *   recorded   cost of service 9,000 · Transport 0 · gross profit -9,000
 *   unlinked   cost of service 0 · Transport 9,000 · gross profit back
 *
 * The cash entry survives the unlink either way: this screen does not
 * quietly reverse a payment somebody really made.
 */
{
  const opex = (/function statementOpexRows\(cashRows, fromISO, toISO\)[\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(/const costed = chargeCostedCashIds\(\);/.test(opex)
    && /!costed\.has\(String\(t\.id\)\)/.test(opex),
    'an entry a charge has claimed leaves its running-cost category, the way a settled month already does');

  const inc = (/function incomeStatement\(fromISO, toISO\)[\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(/costOfService \+= c\.total;/.test(inc) && /uncostedServices \+= c\.uncosted;/.test(inc),
    'and comes back as the cost of the service, in the period of the invoice it rode');
  t.check(/const grossProfit = revenue - trade\.cost - costOfService;/.test(inc),
    'so gross profit carries it, and a delivery stops reading as kept in full');

  /* An uncosted charge understates that cost and flatters the line, so
     the statement says so rather than letting it pass as answered. */
  const checks = (/function statementChecks\(is, bs, cf\)[\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(/if\(is\.uncostedServices > 0\)/.test(checks) && /no cost recorded/.test(checks),
    'and a charge nobody has costed is named on the trust checks, never passed off as free');

  /* The unlink leaves the money where it was. */
  const unlink = (/function otUnlinkChargeCost\(btn\)[\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(/ch\.costTxnId = null;/.test(unlink) && !/removeCashTxn|splice/.test(unlink),
    'unlinking forgets the payment, it does not reverse it — the cash book is where money is taken back');
}

process.exit(t.done() ? 1 : 0);
