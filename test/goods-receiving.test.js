#!/usr/bin/env node
'use strict';
/*
 * Recording what actually came back from the supplier.
 *
 * Until this, nothing did. The purchase invoice was built from the
 * order, the cost was the quoted one, and the pack surplus was worked
 * out from a pack size rather than counted. A supplier who sent five
 * dozen instead of six, or charged 80,000 instead of 78,333, went
 * unnoticed in both directions -- the shop paid more than its books said
 * and held less than they claimed.
 *
 * Receiving is recorded on the order line, not as a document of its own.
 * That is a deliberate limit: a trip covering three orders is three
 * receipts here, and one payment across them stays implicit. What it
 * buys is that no new table, sync path or invoice key changes -- and it
 * still catches the short delivery and the price that moved.
 *
 * The shape that follows from it: goods arrive GROSS. All six go on the
 * shelf when they come through the door, and the customer's one comes
 * back off when the order is invoiced. The stock log says "six in, one
 * out" instead of a bare five appearing from nowhere days later, and a
 * short delivery becomes "four arrived" rather than an impossible state.
 *
 * Run: node test/goods-receiving.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('goods receiving');
const src = read('index.html');
/* Three of these live in shared-worker.js: both apps have to agree
   about whether an order's goods are in. */
const SHARED_HOME = ['orderLineIsBoughtIn', 'quoteLineReceived', 'quoteLineComesOffShelf'];
const fnSrc = (n) => (SHARED_HOME.includes(n) ? read('shared-worker.js') : src);
const fnFile = (n) => (SHARED_HOME.includes(n) ? 'shared-worker.js' : 'index.html');

const CARTONS = { supplierId: 'S1', sname: 'Shafik Katwe', wholesale: 78333, retail: null,
  packQty: 6, packUnit: 'Ctn', unit: 'Dozen', tiers: [] };

const NAMES = ['tiersForKind', 'tieredUnitPrice', 'ipLineOutlay', 'orderLineIsBoughtIn',
  'quoteLineUnitsBought', 'quoteLineSurplus', 'quoteLineReceived', 'quoteLineComesOffShelf',
  'quoteLineExpected', 'receiveQuoteLine', 'unreceiveQuoteLine',
  'applyQuoteSurplusToStock', 'reverseQuoteSurplusToStock'];

let movements = [];
const build = () => compileScope(
  NAMES.map((n) => extractFunction(fnSrc(n), n, fnFile(n))),
  {
    productPriceRows: (pid, vi) => (pid === 'P1' && vi === 0 ? [CARTONS] : []),
    supplierName: (id) => (id === 'S1' ? 'Shafik Katwe' : id),
    applyStockDelta: (productId, variantIdx, delta, type, note, cost, supplierId) =>
      movements.push({ productId, variantIdx, delta, type, note, cost, supplierId }),
  },
  NAMES,
);
let fn = null, err = null;
try { fn = build(); } catch (e) { err = e; }
t.check(!!fn, `the receiving helpers compile${err ? ` (${err.message})` : ''}`);

const line = (over) => Object.assign(
  { lineId: 1, productId: 'P1', variantIdx: 0, productName: 'Tape Measure', unit: 'Dozen',
    packUnit: 'Ctn', packQty: 6, qty: 1, supplierId: 'S1', price: 78333 }, over);
const order = (it) => ({ id: 'Q1', client: { name: 'Abraham' }, items: [it] });

/* ---------- 1. what a receipt is ------------------------------------- */
{
  t.check(fn.quoteLineReceived(line()) === false, 'a line nobody has received is not received');
  t.check(fn.quoteLineReceived(line({ receivedQty: 5, receivedAt: '2026-08-09T00:00:00Z' })) === true,
    'one with a quantity and a time is');
  /* Both halves, or a line half-written by an interrupted save reads as
     a delivery that never happened -- and its goods would be shelved
     twice, once by the receipt and once by the surplus. */
  t.check(fn.quoteLineReceived(line({ receivedQty: 5 })) === false, 'a quantity with no time is not');
  t.check(fn.quoteLineReceived(line({ receivedAt: '2026-08-09T00:00:00Z' })) === false, 'nor a time with no quantity');
  t.check(fn.quoteLineReceived(line({ receivedQty: 0, receivedAt: '2026-08-09T00:00:00Z' })) === false,
    'and nor is a delivery of nothing');

  /* What the form opens on: what was sent for, at what it was expected
     to cost -- a carton where the supplier sells no less. */
  const exp = fn.quoteLineExpected(line());
  t.check(exp.qty === 6 && exp.price === 78333,
    `receiving opens on what was sent for (${exp.qty} at ${exp.price})`);
}

/* ---------- 2. the whole delivery goes on the shelf ------------------ */
{
  movements = [];
  const it = line();
  const got = fn.receiveQuoteLine(it, 5, 80000, order(it));

  t.check(got === 5, `five arrived, so five are received (${got})`);
  t.check(movements.length === 1 && movements[0].delta === 5 && movements[0].type === 'restock',
    `and all five go on the shelf, not just the four the customer is not taking (${JSON.stringify(movements)})`);
  /* Costed at what was PAID. Quoted at 78,333 and charged 80,000, the
     difference is real money and belongs in the margin figures rather
     than being silently absorbed. */
  t.check(movements[0].cost === 80000, `at the price actually paid (${movements[0].cost})`);
  t.check(movements[0].supplierId === 'S1', 'against the supplier it came from');
  t.check(/Received from Shafik Katwe for Abraham/.test(movements[0].note),
    `with a note naming both ends of it (${movements[0].note})`);

  t.check(it.receivedQty === 5 && it.receivedPrice === 80000 && !!it.receivedAt,
    'and the line remembers what arrived, at what, and when');
  t.check(fn.quoteLineComesOffShelf(it) === true,
    'a received line now comes off our own shelf, like one quoted from stock');

  // A price left blank falls back to what was quoted rather than to nothing.
  movements = [];
  const noPrice = line();
  fn.receiveQuoteLine(noPrice, 6, NaN, order(noPrice));
  t.check(noPrice.receivedPrice === 78333 && movements[0].cost === 78333,
    `no price given falls back to the quoted one, so the lot is never uncosted (${noPrice.receivedPrice})`);

  // Nothing to receive, or nothing that is bought in.
  movements = [];
  t.check(fn.receiveQuoteLine(line(), 0, 80000, null) === 0 && movements.length === 0,
    'a delivery of nothing moves nothing');
  t.check(fn.receiveQuoteLine(line({ supplierId: '__stock__' }), 5, 80000, null) === 0,
    'and goods off our own shelf were never bought, so they cannot arrive');
}

/* ---------- 3. undoing one ------------------------------------------- */
{
  movements = [];
  const it = line();
  fn.receiveQuoteLine(it, 5, 80000, order(it));
  movements = [];
  const back = fn.unreceiveQuoteLine(it);

  t.check(back === 5 && movements.length === 1 && movements[0].delta === -5,
    `undoing takes back exactly what was put on (${JSON.stringify(movements)})`);
  t.check(movements[0].type === 'reversal', 'as a reversal, not as a sale');
  t.check(!fn.quoteLineReceived(it) && it.receivedQty === undefined && it.receivedAt === undefined,
    'and the line forgets the delivery, so it cannot be undone twice');

  movements = [];
  t.check(fn.unreceiveQuoteLine(line()) === 0 && movements.length === 0,
    'a line never received has nothing to give back');
}

/* ---------- 4. the surplus path stands aside ------------------------- */
/*
 * Before receiving existed, invoicing added the calculated leftover.
 * Doing both would shelve them twice -- once counted at the door, once
 * worked out from a pack size days later.
 */
{
  movements = [];
  const notReceived = line();
  fn.applyQuoteSurplusToStock(order(notReceived));
  t.check(movements.length === 1 && movements[0].delta === 5,
    'an unreceived line still shelves its calculated surplus, as before');

  movements = [];
  const received = line({ receivedQty: 6, receivedPrice: 78333, receivedAt: '2026-08-09T00:00:00Z' });
  fn.applyQuoteSurplusToStock(order(received));
  t.check(movements.length === 0,
    'a received line adds nothing further -- its delivery is already on the shelf');
}

/* ---------- 5. the customer's share comes back off ------------------- */
{
  const deduct = extractFunction(src, 'applyQuoteStockDeduction', 'index.html');
  t.check(/if\(!quoteLineComesOffShelf\(it\)\) return;/.test(deduct),
    'invoicing deducts from both kinds of line that sit on our own shelf');
  t.check(!/if\(it\.supplierId!=='__stock__'\) return;/.test(deduct),
    'not only the ones quoted from stock');
  /* Deducting the ORDER quantity, not the delivery: the customer takes
     one dozen whether six or twelve came through the door. */
  t.check(/const want = Number\(it\.qty\)\|\|0;/.test(deduct),
    'and it is the quantity the customer is owed that leaves');

  const reverse = extractFunction(src, 'reverseQuoteStockDeduction', 'index.html');
  t.check(/if\(!it\._stockTaken\) return;/.test(reverse),
    'un-invoicing puts back whatever was actually taken');
  /* Driven by what was taken rather than by what the line is now: a
     receipt can be undone after invoicing, and the units still have to
     go back on the shelf they came off. */
  t.check(!/it\.supplierId!=='__stock__'/.test(reverse),
    'rather than by whether the line looks like a stock line today');
}

/* ---------- 6. the supplier is billed for what arrived --------------- */
{
  const gen = extractFunction(src, 'generatePurchaseInvoicesForQuote', 'index.html');
  t.check(/qty: quoteLineReceived\(it\) \? Number\(it\.receivedQty\) : quoteLineUnitsBought\(it\)/.test(gen),
    'the invoice carries what was received where it has been counted');
  t.check(/price: quoteLineReceived\(it\) \? Number\(it\.receivedPrice\) : it\.price/.test(gen),
    'at the price actually paid');
  /* Counted beats calculated. A short delivery billed at the carton is
     money the shop does not owe, and a price rise billed at the quote is
     money it does. */
  const total = compileScope([extractFunction(src, 'purchaseInvoiceTotal', 'index.html')], {}, ['purchaseInvoiceTotal'])
    .purchaseInvoiceTotal({ items: [{ qty: 5, price: 80000 }] });
  t.check(total === 400000, `so five at 80,000 is what is owed (${total})`);
}

/* ---------- 7. a collected line is no longer a call on cash ---------- */
{
  const lines = extractFunction(src, 'orderPurchaseLines', 'index.html');
  t.check(/const received = quoteLineReceived\(it\);/.test(lines)
    && /const qty = received \? Number\(it\.receivedQty\)/.test(lines),
    'the buying list shows what arrived once it has');
  /* orderCashToBuy sums lineCost, and that figure is the balance the
     item picker judges a new line against. Left at full cost a collected
     line would keep counting against it for as long as the order sat on
     the board, and the shop would be told it had less money than it
     does. */
  t.check(/const outstanding = received \? shortfall : qty;/.test(lines)
    && /lineCost: unitCost==null \? null : unitCost \* outstanding,/.test(lines),
    'and nothing more is owed on a line received IN FULL, so it stops eating the balance');
  t.check(/received,/.test(lines), 'with the fact of it carried through for the list to show');
}

/* ---------- 8. what receiving does NOT do ---------------------------- */
{
  const toggle = extractFunction(src, 'toggleQuoteInvoiced', 'index.html');
  /* Un-invoicing undoes the sale, not the purchase. The goods arrived
     whether or not the customer's order survives, and taking them off
     the shelf because an invoice was reversed would lose stock the shop
     is holding. */
  t.check(!/unreceiveQuoteLine/.test(toggle),
    'un-invoicing does not un-receive: the delivery happened either way');

  // No new table, no new sync path -- the stated limit of this shape.
  t.check(!/receipts/.test(extractFunction(src, 'receiveQuoteLine', 'index.html')),
    'a receipt is fields on the line rather than a record of its own');
  t.check(!/addDiffOps\(ops, 'receipts'/.test(src) && !/sel\('receipts'\)/.test(src),
    'so nothing was added to the sync path');
}

process.exit(t.done() ? 1 : 0);
