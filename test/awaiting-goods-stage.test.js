#!/usr/bin/env node
'use strict';
/*
 * Awaiting Goods: the shop is a fulfilment centre, not a shopfront.
 *
 * Goods bought for an order come IN to the shop first and are picked from
 * the shop afterwards. Before this stage existed an order went straight
 * to Being Prepared the moment it left Draft, and two things followed
 * that were reported from the shop floor:
 *
 *   a worker could accept a pick for goods still sitting in Shafik's
 *   shop -- and would walk the shelves, find nothing, and record a short
 *   pick against a delivery that had simply not happened
 *
 *   their card told them to go and GET it from Shafik. That is a
 *   different job, in a different part of town, for goods that by then
 *   were often standing on our own shelf, paid for and counted in
 *
 * The rule that decides all of it lives in shared-worker.js, because both
 * apps have to agree: the admin board decides whether an order may be
 * prepared, and the worker app decides whether to offer the pick and
 * where to send somebody. Two copies would eventually disagree, and the
 * way it would show is a worker sent across town for goods behind them.
 *
 * Run: node test/awaiting-goods-stage.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('awaiting goods stage');
const src = read('index.html');
const shared = read('shared-worker.js');

const NAMES = ['orderLineIsBoughtIn', 'quoteLineReceived', 'quoteLineComesOffShelf',
  'orderIncomingLines', 'orderAwaitsGoods', 'orderGoodsProgress', 'goodsBlockPreparing',
  'pickItemSourceLabel'];
const fn = compileScope(
  NAMES.map((n) => extractFunction(shared, n, 'shared-worker.js')),
  { data: { suppliers: [{ id: 'S1', name: 'Shafik Katwe', location: 'Katwe', shopNo: 'B12' }] } },
  NAMES,
);

const bought = (over) => Object.assign(
  { productId: 'P1', variantIdx: 0, qty: 1, supplierId: 'S1', supplierName: 'Shafik Katwe' }, over);
const arrived = (over) => bought(Object.assign(
  { receivedQty: 6, receivedPrice: 78333, receivedAt: '2026-08-09T00:00:00Z' }, over));
const fromStock = (over) => Object.assign({ productId: 'P1', variantIdx: 0, qty: 2, supplierId: '__stock__' }, over);
const order = (items, over) => Object.assign({ id: 'Q1', status: 'preparing', items }, over);

/* ---------- 1. the stage exists, in the right place ------------------ */
{
  const order5 = extractDeclaration(src, 'SQ_STATUS_ORDER', 'index.html');
  t.check(/'draft','awaiting_goods','preparing','pending_delivery','completed'/.test(order5),
    'Awaiting Goods sits between Draft and Being Prepared');
  /* Between, not after: goods come in before anyone picks them, and a
     stage on the wrong side of Being Prepared would be describing a
     delivery to the customer rather than one from the supplier. */
  const statuses = extractDeclaration(src, 'SQ_STATUSES', 'index.html');
  t.check(/awaiting_goods:\s*\{ label:'Step 2\. Awaiting Goods'/.test(statuses),
    'and is numbered as the second step');
  t.check(/preparing:\s*\{ label:'Step 3\. Being Prepared'/.test(statuses)
    && /completed:\s*\{ label:'Step 5\. Completed'/.test(statuses),
    'with everything after it renumbered rather than left claiming the old place');
  t.check(/awaiting_goods:'Awaiting Goods'/.test(extractDeclaration(src, 'ORDER_STATUS_SHORT_LABELS', 'index.html')),
    'and a short label for the phone stepper, which reads that list rather than the long one');
}

/* ---------- 2. what "still out" means -------------------------------- */
{
  t.check(fn.orderAwaitsGoods(order([bought()])) === true, 'a line still at a supplier is still out');
  t.check(fn.orderAwaitsGoods(order([arrived()])) === false, 'one that has arrived is not');
  /* An order filled entirely off our own shelf has nothing to wait for.
     Treating stock lines as outstanding would park every such order in a
     stage about goods coming in. */
  t.check(fn.orderAwaitsGoods(order([fromStock()])) === false, 'and neither is one off our own shelf');
  t.check(fn.orderAwaitsGoods(order([arrived(), bought()])) === true,
    'one line still out holds the whole order — a pick needs all of it');
  t.check(fn.orderAwaitsGoods(order([])) === false && fn.orderAwaitsGoods(null) === false,
    'an empty or missing order waits for nothing');

  const p = fn.orderGoodsProgress(order([arrived(), bought(), fromStock()]));
  t.check(p.received === 1 && p.total === 2,
    `progress counts the bought-in lines only (${p.received} of ${p.total})`);
  t.check(fn.orderGoodsProgress(order([fromStock()])).total === 0,
    'an order with nothing to collect has no progress to report');
}

/* ---------- 3. the gate ---------------------------------------------- */
{
  t.check(fn.goodsBlockPreparing(order([bought()])) === true, 'goods still out block preparing');
  t.check(fn.goodsBlockPreparing(order([arrived()])) === false, 'goods in do not');
  /* Draft is exempt. Nothing is being picked there, and an order still
     being written should not be held up by goods nobody has gone for
     yet -- the block is about the pick, not about the order. */
  t.check(fn.goodsBlockPreparing(order([bought()], { status: 'draft' })) === false,
    'and a draft is exempt, since nothing is being picked in it');

  // Both places a pick can start.
  const accept = extractFunction(shared, 'acceptOrderAssignment', 'shared-worker.js');
  t.check(/if\(goodsBlockPreparing\(q\)\)\{/.test(accept),
    'a worker cannot accept a pick for goods that have not arrived');
  t.check(accept.indexOf('goodsBlockPreparing') < accept.indexOf("pickingStatus = 'in_progress'"),
    'and is stopped before the order is marked as being picked, not after');
  t.check(/orderIncomingLines\(q\)\.length/.test(accept),
    'being told how many are still out, which is the thing they would go and ask');

  const auto = extractFunction(shared, 'autoAssignNextOrder', 'shared-worker.js');
  t.check(/&& !goodsBlockPreparing\(q\)\)/.test(auto),
    'and the queue does not hand one out either');
  t.check(!/'awaiting_goods'/.test(auto),
    'nor does it reach into Awaiting Goods for work');

  // The admin's own step-forward.
  const step = extractFunction(src, 'stepSavedQuoteStatus', 'index.html');
  t.check(/if\(dir>0 && toStatus==='preparing' && orderAwaitsGoods\(q\)\)\{/.test(step),
    'and the board will not move an order into Being Prepared over it');
}

/* ---------- 4. an order with nothing to collect steps over it -------- */
/*
 * A stage that exists for goods coming in should not detain an order
 * being filled entirely from our own shelf.
 */
{
  const step = extractFunction(src, 'stepSavedQuoteStatus', 'index.html');
  t.check(/if\(toStatus==='awaiting_goods' && !orderAwaitsGoods\(q\)\)\{/.test(step),
    'the skip is decided by whether there is anything to wait for');
  t.check(/nextIdx \+= dir;/.test(step),
    'and steps again in the direction it was already going, so it works backwards too');
  /* let, not const: the skip rewrites both. Left as const this threw on
     the first order that had nothing to collect. */
  t.check(/let nextIdx = idx \+ dir;/.test(step) && /let toStatus = SQ_STATUS_ORDER\[nextIdx\];/.test(step),
    'both of which have to be reassignable for that to be possible');
}

/* ---------- 5. where the picker is sent ------------------------------ */
{
  t.check(fn.pickItemSourceLabel(bought()) === 'Shafik Katwe — Katwe · Shop B12',
    `goods not yet collected send the picker to the supplier (${fn.pickItemSourceLabel(bought())})`);
  /* The bug as reported: it read the line's supplier and nothing else,
     and went on directing the picker to Katwe for a carton standing on
     our own shelf. */
  t.check(fn.pickItemSourceLabel(arrived()) === 'Shop',
    `goods already collected are picked from the shop (${fn.pickItemSourceLabel(arrived())})`);
  t.check(fn.pickItemSourceLabel(fromStock()) === 'Shop', 'as are goods that were always ours');
  t.check(fn.pickItemSourceLabel({ qty: 1 }) === 'Shop', 'and a line with no source at all');
}

/* ---------- 6. the buying moved with the waiting --------------------- */
{
  const being = extractFunction(src, 'beingPreparedOrders', 'index.html');
  t.check(/q\.status==='awaiting_goods' \|\| q\.status==='preparing'/.test(being),
    'the cash-to-buy question covers both working stages');
  /* Awaiting Goods is where an order sits BECAUSE something has not been
     fetched, so dropping Being Prepared entirely would have been tidier
     and wrong: orders were already sitting there when this stage
     arrived, and a line can be un-received underneath one. Double
     counting is prevented by a collected line costing zero, not by
     leaving a stage out. */
  t.check(/lineCost: received \? 0 :/.test(extractFunction(src, 'orderPurchaseLines', 'index.html')),
    'without counting a collected line twice');

  t.check(/status==='awaiting_goods' \? cashToBuyBannerHTML\(group\) : ''/.test(src),
    'and the money to go and buy sits over the column waiting for it');
  t.check(!/\$\{status==='preparing' \? cashToBuyBannerHTML\(group\) : ''\}/.test(src),
    'rather than over the one whose goods are in by definition');
}

/* ---------- 7. the card says how far along ---------------------------- */
{
  const row = extractFunction(src, 'orderGoodsRowHTML', 'index.html');
  t.check(/orderGoodsProgress\(q\)/.test(row), 'the card counts what has landed');
  t.check(/All items in — ready to prepare/.test(row),
    'and says plainly when the order can be picked, which is the moment anything can happen');
  t.check(/\$\{p\.received\} of \$\{p\.total\} item/.test(row),
    'counting up to it rather than warning about it — waiting is this stage\'s normal state');
  t.check(/if\(!p\.total\) return '';/.test(row),
    'an order with nothing to collect says nothing');
  /* And the card actually asks. Checked next to the strip it sits under,
     because a function that is written and never called reads exactly
     like one that works. */
  t.check(src.includes('${orderCashStripHTML(q)}')
    && src.includes('${orderGoodsRowHTML(q)}')
    && src.indexOf('${orderCashStripHTML(q)}') < src.indexOf('${orderGoodsRowHTML(q)}'),
    "and the card puts it under the cash strip, where the order's other facts are");
  t.check(/\.sq-goods-row\.in\{color:var\(--good\)/.test(src),
    'and it turns when the last one lands');
}

process.exit(t.done() ? 1 : 0);
