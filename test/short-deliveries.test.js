#!/usr/bin/env node
'use strict';
/*
 * When less arrives than was ordered.
 *
 * The shop is a fulfilment centre: goods for an order come in first and
 * are picked from the shelf afterwards. Everything about that assumed
 * the delivery was complete. It often is not -- the supplier had four
 * cartons, not ten -- and the app had one flag, quoteLineReceived, which
 * answers "did anything arrive" and was standing in for "is this line
 * filled".
 *
 * So four arriving against an order for ten read as a line fully in:
 *
 *   - the board said "All items in -- ready to prepare"
 *   - goodsBlockPreparing opened the gate
 *   - the picker was sent to a shelf holding four, found four, and the
 *     six that were never delivered were recorded as THEIR short pick
 *   - the line vanished off the buying list, so the only surviving
 *     record that six were still owed was a number on a trip nobody
 *     reopens
 *   - and the money for those six was counted as already spent, so the
 *     shop was told it had less to buy with than it did
 *
 * The shortfall is measured against what the CUSTOMER is owed, not
 * against the pack-rounded purchase: a one-dozen line filled from a
 * six-dozen carton that came back with three is not short, because the
 * customer's dozen is there. Judging by the carton would have called a
 * perfectly filled order short on every pack-forced line in the shop.
 *
 * Preparing is deliberately NOT blocked by a shortfall. The supplier may
 * simply have no more, and an order that can never be completed must not
 * be strandable forever with no way out -- so the board says it loudly
 * and the decision stays with the admin.
 *
 * Run: node test/short-deliveries.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('short deliveries');
const src = read('index.html');
const shared = read('shared-worker.js');

/* ---------- 1. the shortfall itself ---------------------------------- */

const SHARED_NAMES = ['orderLineIsBoughtIn', 'quoteLineReceived', 'quoteLineShortfall',
  'quoteLineShelfShare', 'orderShortLines', 'orderIncomingLines', 'orderAwaitsGoods',
  'orderGoodsProgress', 'goodsBlockPreparing', 'quoteLineComesOffShelf'];
const scope = compileScope(
  SHARED_NAMES.map((n) => extractFunction(shared, n, 'shared-worker.js')),
  {}, SHARED_NAMES,
);

const line = (over) => Object.assign({
  lineId: 1, productId: 'P2', variantIdx: null, productName: 'Hinges',
  unit: 'Ctn', qty: 10, supplierId: 'S1', price: 300000,
}, over);
const arrived = (n) => ({ receivedQty: n, receivedPrice: 300000, receivedAt: '2026-08-11T19:00:00Z' });

{
  t.check(scope.quoteLineShortfall(line()) === 0,
    'a line nothing has arrived for has no shortfall — it is simply still coming');
  t.check(scope.quoteLineShortfall(line(arrived(4))) === 6,
    'four against ten is six short');
  t.check(scope.quoteLineShortfall(line(arrived(10))) === 0,
    'ten against ten is not short');
  /* More than ordered is surplus, not negative shortfall -- the extra
     goes to the shelf and must never read as a debt to the customer. */
  t.check(scope.quoteLineShortfall(line(arrived(12))) === 0,
    'and twelve against ten is surplus, not a negative shortfall');
  /* The pack-forced case, which is why this is measured against the
     customer's quantity. One dozen ordered, a six-dozen carton sent for,
     three came back: the customer's dozen is there. */
  t.check(scope.quoteLineShortfall(line({ qty: 1, unit: 'Dozen', ...arrived(3) })) === 0,
    'a pack-forced line that got less surplus than planned is not short of the customer');

  // A line off our own shelf was never bought in, so it cannot be short.
  t.check(scope.quoteLineShortfall(line({ supplierId: '__stock__', ...arrived(1) })) === 0,
    'and a line coming off our own shelf has no delivery to be short of');
}

/* ---------- 2. what the order says ----------------------------------- */
{
  const order = (items) => ({ id: 'QX', status: 'awaiting_goods', client: { name: 'Abraham' }, items });

  const waiting = order([line()]);
  t.check(scope.orderAwaitsGoods(waiting) === true && scope.goodsBlockPreparing(waiting) === true,
    'nothing arrived: the order waits and the gate is shut');

  const short = order([line(arrived(4))]);
  const p = scope.orderGoodsProgress(short);
  t.check(p.received === 1 && p.total === 1 && p.short === 1,
    `a short line has arrived AND is short — both, not one or the other (${JSON.stringify(p)})`);
  t.check(scope.orderShortLines(short).length === 1, 'and is listed as short');
  /* The deliberate non-block. Stated as a test so that turning it into a
     block later is a decision somebody makes on purpose. */
  t.check(scope.goodsBlockPreparing(short) === false,
    'preparing is not blocked by a shortfall — the supplier may have no more, and the order must not be strandable');
  t.check(scope.quoteLineComesOffShelf(short.items[0]) === true,
    'what did arrive is on our shelf, so the picker is sent there and not across town');

  const full = order([line(arrived(10))]);
  t.check(scope.orderGoodsProgress(full).short === 0 && scope.orderShortLines(full).length === 0,
    'a fully delivered line is short of nothing');

  const mixed = order([line(arrived(4)), line({ lineId: 2, ...arrived(10) }), line({ lineId: 3 })]);
  const pm = scope.orderGoodsProgress(mixed);
  t.check(pm.received === 2 && pm.total === 3 && pm.short === 1,
    `counts hold up when some are in, some short, some still coming (${JSON.stringify(pm)})`);
  t.check(scope.orderAwaitsGoods(mixed) === true,
    'and a line nobody has been for still keeps the order waiting');
}

/* ---------- 3. receiving ADDS rather than replaces -------------------- */
/*
 * The top-up. A second trip fetching the missing six used to overwrite
 * the 4 with 6 -- the shelf got both deliveries (the stock delta is
 * always just this receipt) while the line claimed six of the ten had
 * ever turned up. It stayed short forever, and the buying list kept
 * sending people back for goods already in the building.
 */
{
  const deltas = [];
  const priceWrites = [];
  const recv = compileScope(
    [extractFunction(src, 'receiveQuoteLine', 'index.html'),
      extractFunction(shared, 'orderLineIsBoughtIn', 'shared-worker.js'),
      extractFunction(shared, 'quoteLineReceived', 'shared-worker.js'),
      extractFunction(shared, 'quoteLineShortfall', 'shared-worker.js')],
    {
      applyStockDelta: (pid, vi, n) => { deltas.push(n); },
      supplierName: () => 'Shafik Katwe',
      // Stubbed: the price registry is not what this file is about, and
      // compiling it would drag in tier resolution and the inversion
      // warning. Recorded so the split-delivery case below can check
      // which quantity each receipt reported.
      syncPriceRegistryFromPurchase: (pid, vi, sid, price, qty, opts) =>
        priceWrites.push({ price, qty, opts }),
    },
    ['receiveQuoteLine', 'quoteLineShortfall', 'quoteLineReceived'],
  );

  const it = line();
  const q = { client: { name: 'Abraham' } };
  t.check(recv.receiveQuoteLine(it, 4, 300000, q) === 4, 'four arrive');
  t.check(it.receivedQty === 4 && recv.quoteLineShortfall(it) === 6, 'the line is six short');
  t.check(recv.receiveQuoteLine(it, 6, 300000, q) === 6, 'the rest arrives later');
  t.check(it.receivedQty === 10,
    `and the receipts ADD — ten in total, not the last six (${it.receivedQty})`);
  t.check(recv.quoteLineShortfall(it) === 0, 'so the line is finally complete');
  /* Each receipt puts only its OWN goods on the shelf. Adding the
     running total here would shelve fourteen for a delivery of ten. */
  t.check(deltas.join(',') === '4,6',
    `the shelf got each delivery once, never the running total (${deltas.join(',')})`);

  /* Both arrivals kept, each with what was actually paid for it. The
     supplier's invoice multiplies qty by price, so a list that reset on
     every receipt -- or held the running total instead of the delivery
     -- would bill the whole quantity at whichever came last. Run rather
     than read: the push line is identical either way. */
  t.check((it.receipts || []).length === 2,
    `both arrivals are on the line, not just the last (${(it.receipts || []).length})`);
  t.check(it.receipts.map((r) => `${r.qty}@${r.price}`).join(' ') === '4@300000 6@300000',
    `each carrying its own quantity, not the running total (${it.receipts.map((r) => r.qty).join(',')})`);
  t.check(it.receipts.every((r) => !!r.at),
    'and when it turned up');

  /* And the price book hears about each one separately, at the quantity
     that actually arrived rather than the line's running total.

     This is the whole reason receiving reaches the registry: money
     changed hands, so the price is confirmed for today whether or not it
     moved. A line fetched twice is two purchases -- the second trip is
     honestly a small one, and pricing it at ten would file a bulk rate
     under a quantity nobody bought. */
  t.check(priceWrites.length === 2,
    `each arrival tells the price book once (${priceWrites.length})`);
  t.check(priceWrites.map((w) => w.qty).join(',') === '4,6',
    `at its own quantity, never the running total (${priceWrites.map((w) => w.qty).join(',')})`);
  t.check(priceWrites.every((w) => w.price === 300000), 'carrying what was actually paid');
  t.check(priceWrites.every((w) => w.opts && w.opts.confirms === true),
    'and marked as money moving, so an unchanged price is still dated today rather than left to go stale');

  // Undoing takes the arrivals with it, so the next receipt starts clean.
  const it3 = line();
  recv.receiveQuoteLine(it3, 4, 300000, q);
  t.check((it3.receipts || []).length === 1, 'a fresh line records its first arrival');

  // Nothing arriving is not a receipt at all.
  priceWrites.length = 0;
  const it2 = line();
  t.check(recv.receiveQuoteLine(it2, 0, 300000, q) === 0 && it2.receivedQty === undefined,
    'and a delivery of nothing does not mark the line received');
  t.check(priceWrites.length === 0,
    'nor tells the price book a price was confirmed by goods that never came');
}

/* ---------- 4. the shortfall stays on the buying list ----------------- */
{
  const fn = extractFunction(src, 'orderPurchaseLines', 'index.html');
  t.check(/const shortfall = quoteLineShortfall\(it\);/.test(fn),
    'each buying-list line knows its shortfall');
  t.check(/const outstanding = received \? shortfall : qty;/.test(fn),
    'and what is still to be fetched is the shortfall once something has come');
  t.check(/settled: received && shortfall === 0,/.test(fn),
    'only a line received IN FULL is settled');
  /* lineCost drives orderCashToBuy and the item picker's affordability
     hint. A shortfall is money still to be spent; zeroing it told the
     shop it had less free cash than it really did. */
  t.check(/lineCost: unitCost==null \? null : unitCost \* outstanding,/.test(fn)
    && !/lineCost: received \? 0 :/.test(fn),
    'and the money still to be spent is the outstanding quantity, not zero');

  // The Send-someone gate and the row now turn on `settled`, not `received`.
  t.check(/r\.lines\.some\(l=> !l\.settled && !lineIsOnATrip\(l\.order\.id, l\.it\.lineId\)\)/.test(src),
    'Send someone is still offered while a line is short');
  t.check(/l\.settled \? 'bl-received' : \(l\.shortfall \? 'bl-short' : ''\)/.test(src),
    'a short row does not wear the finished-business styling');
  t.check(/still owed to/.test(src), 'and says who is still owed what');
  t.check(/>Receive rest</.test(src),
    'with a way to record the rest arriving by hand');
}

/* ---------- 5. the two screens that must say so ---------------------- */
{
  /* The admin's order card, RUN rather than read. Reading it could not
     tell the difference between the single-line branch being chosen and
     it merely being present: wrapping the condition in a never-true test
     leaves every word of the template intact. */
  const cardScope = compileScope(
    [extractFunction(src, 'orderGoodsRowHTML', 'index.html'),
      ...SHARED_NAMES.map((n) => extractFunction(shared, n, 'shared-worker.js'))],
    { esc: (s) => String(s), ICON_WARN: '<!--warn-->', ICON_CHECK: '<!--check-->', ICON_TRUCK: '<!--truck-->' },
    ['orderGoodsRowHTML'],
  );
  const text = (q) => cardScope.orderGoodsRowHTML(q).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  const ord = (items) => ({ id: 'QX', status: 'awaiting_goods', client: { name: 'Abraham' }, items });

  t.check(text(ord([line(arrived(10))])) === 'All items in — ready to prepare',
    'a fully delivered order says it is ready');
  t.check(text(ord([line(arrived(4))])) === '6 Ctn short of Hinges',
    `and a short one names the item and the number instead (${text(ord([line(arrived(4))]))})`);
  t.check(/still coming/.test(text(ord([line(arrived(4)), line({ lineId: 2 })]))),
    'saying what is still on its way alongside it');
  /* Six cartons and two dozen is not eight of anything, so more than one
     short line is counted rather than added up. */
  const two = text(ord([line(arrived(4)), line({ lineId: 2, unit: 'Dozen', qty: 3, ...arrived(1) })]));
  t.check(two === '2 lines short', `two short lines are counted, never summed (${two})`);

  /* The picker's own card. Without this the worker hunts for goods that
     were never delivered, then records the gap as their own failure to
     find them -- a different fact about a different person.

     Scoped to the stepper: quoteLineShortfall(it) > 0 also appears in
     orderGoodsProgress and orderShortLines, so a file-wide search passes
     with the card's own check deleted. */
  const stepper = extractFunction(shared, 'renderWorkerPickStepper', 'shared-worker.js');
  t.check(/quoteLineShortfall\(it\) > 0/.test(stepper) && /wv-carousel-owed/.test(stepper),
    'the pick card warns the picker before they start looking');

  /* The other side of the same subtraction. A supplier who sells nothing
     smaller than a carton turns an order for one dozen into a purchase
     of six, and all six are on the shelf once they are checked in. The
     picker, standing at an open carton with a card reading "1 Dozen",
     cannot otherwise tell that from a delivery of six meant to go out
     whole -- and handing the carton over gives away five dozen. */
  t.check(scope.quoteLineShelfShare(line({ qty: 1, unit: 'Dozen', ...arrived(6) })) === 5,
    'six arriving against an order for one leaves five for the shop');
  t.check(scope.quoteLineShelfShare(line({ qty: 1, unit: 'Dozen' })) === 0,
    'nothing arrived, nothing kept — the carton is still at the supplier');
  t.check(scope.quoteLineShelfShare(line(arrived(4))) === 0,
    'and a delivery that came up SHORT keeps nothing back');
  /* One slot on the card, and they can never contend for it: shortfall
     is qty - received and shelf share is received - qty, so at most one
     of the two is ever positive. */
  const both = [line(arrived(4)), line(arrived(10)), line({ qty: 1, unit: 'Dozen', ...arrived(6) })]
    .filter((l) => scope.quoteLineShortfall(l) > 0 && scope.quoteLineShelfShare(l) > 0);
  t.check(both.length === 0, 'a line is never both short and holding a surplus');

  t.check(/quoteLineShelfShare\(it\) > 0/.test(stepper) && /wv-carousel-kept/.test(stepper),
    'the card says what stays behind');
  t.check(/came in — \$\{esc\(String\(quoteLineShelfShare\(it\)\)\)\} \$\{quoteLineShelfShare\(it\)===1 \? 'stays' : 'stay'\}/.test(stepper),
    'naming the whole delivery first, since that is what is in front of them');
  // Only one of the two lines can render: the surplus is the else of the shortfall.
  t.check(stepper.indexOf('wv-carousel-owed') < stepper.indexOf('wv-carousel-kept'),
    'and the short warning wins the slot, being the one that costs a customer');
  t.check(/\$\{ICON_WARN_SMALL\}/.test(stepper) && /const ICON_WARN_SMALL = /.test(shared),
    'using an icon the shared file owns — worker.html has no ICON_WARN to borrow, and would throw reaching for one');

  /* --warn-ink is amber ink on the phone's dark ground and dark brown on
     the admin's light one, so the two hosts cannot share a fill. Taking
     the admin's cream panel to the phone put #D9A03A on #FBEFD9: about
     1.9:1, invisible. */
  const wsrc = read('worker.html');
  t.check(/\.wv-carousel-owed\{[^}]*background:rgba\(217,160,58,\.15\)/.test(wsrc),
    'the phone washes the amber over its dark ground rather than borrowing the admin’s cream');
  t.check(/\.wv-carousel-owed\{[^}]*background:var\(--ow-amber-soft/.test(src),
    'while the admin app keeps the cream panel that suits its own ground');
}

process.exit(t.done() ? 1 : 0);
