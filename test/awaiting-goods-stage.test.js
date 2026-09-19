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
  /* The stage names came back with the board: Draft, Awaiting Goods,
     Being Prepared, Pending Delivery, Completed. The keys are untouched
     and every derivation reads them; only the words moved, twice. */
  t.check(/awaiting_goods:\s*\{ label:'Step 2\. Awaiting Goods'/.test(statuses),
    'and is numbered as the second step, named for what it is waiting on');
  t.check(/preparing:\s*\{ label:'Step 3\. Being Prepared'/.test(statuses)
    && /completed:\s*\{ label:'Step 5\. Completed'/.test(statuses),
    'with everything after it renumbered rather than left claiming the old place');
  t.check(/awaiting_goods:'Awaiting Goods'/.test(extractDeclaration(src, 'ORDER_STATUS_SHORT_LABELS', 'index.html')),
    'and a short label for the step rail and the top bar, which read that list rather than the long one');
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

  /* The queue is its own function now -- workerPickQueue -- because three
     things read it: the "Next to pick" panel on every worker's phone,
     "Take the next one", and the hand-over after a finished pick. The gate
     lives in the queue, so all three are covered by one rule instead of
     one of them remembering it. */
  const queue = extractFunction(shared, 'workerPickQueue', 'shared-worker.js');
  t.check(/&& !goodsBlockPreparing\(q\)/.test(queue),
    'and the queue does not offer one either');
  t.check(!/'awaiting_goods'/.test(queue),
    'nor does it reach into Awaiting Goods for work');
  const auto = extractFunction(shared, 'autoAssignNextOrder', 'shared-worker.js');
  t.check(/workerPickQueue\(\)\[0\]/.test(auto),
    'and the hand-over after a finished pick takes the top of that same queue');

  // The admin's own step-forward.
  const step = extractFunction(src, 'stepSavedQuoteStatus', 'index.html');
  t.check(/if\(dir>0 && toStatus==='preparing' && orderAwaitsGoods\(q\)\)\{/.test(step),
    'and the board will not move an order into Being Prepared over it');
  /* Refusing is half an answer. The refusal used to say only "receive
     them", which was the whole story before trips existed and is now
     the second half of it -- somebody has to go and fetch the goods
     before there is anything to receive, and which of those two is next
     depends on whether anyone has already been sent. */
  t.check(/lineIsOnATrip\(q\.id, it\.lineId\)/.test(step),
    'and asks whether somebody is already out for them before saying what to do');
  /* Run, not read: both sentences are in the source whichever branch
     actually fires, so wiring the condition to a constant left every
     regex above green while the board told the admin the opposite of
     what to do. */
  const said = (onATrip) => {
    const toasts = [];
    const st = { savedQuotes: [{ id: 'QX', status: 'awaiting_goods', client: { name: 'Abraham' },
      items: [{ lineId: 1, productId: 'P2', supplierId: 'S1', qty: 10, price: 300000 }] }] };
    compileScope([
      extractDeclaration(src, 'SQ_STATUS_ORDER', 'index.html'),
      ...['orderLineIsBoughtIn', 'quoteLineReceived', 'orderIncomingLines', 'orderAwaitsGoods']
        .map((n) => extractFunction(shared, n, 'shared-worker.js')),
      extractFunction(src, 'stepSavedQuoteStatus', 'index.html'),
    ], {
      data: st,
      toast: (m) => toasts.push(m),
      lineIsOnATrip: () => onATrip,
      agentPaymentBlocksPreparing: () => false,
    }, ['stepSavedQuoteStatus']).stepSavedQuoteStatus('QX', 1);
    return { text: toasts[0] || '', status: st.savedQuotes[0].status };
  };

  const nobodySent = said(false);
  t.check(/send someone for it from the buying list/.test(nobodySent.text),
    `nobody sent yet: go and arrange it (${nobodySent.text})`);
  const alreadyOut = said(true);
  t.check(/still on the way — check it in from the buying list/.test(alreadyOut.text),
    `already out: wait and check it in, not send somebody a second time (${alreadyOut.text})`);
  t.check(nobodySent.status === 'awaiting_goods' && alreadyOut.status === 'awaiting_goods',
    'and either way the order does not move');
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
  t.check(/const outstanding = received \? shortfall : qty;/.test(extractFunction(src, 'orderPurchaseLines', 'index.html')),
    'without counting a collected line twice — what is left to spend is the shortfall, which is nothing when it all arrived');

  /* The board is lanes again, so the figure sits on the lane it is about
     rather than on a strip over the whole screen: Buying carries the
     banner, beside the orders the money is waiting on. */
  t.check(/status==='awaiting_goods' \? cashToBuyBannerHTML\(group\)/.test(extractFunction(src, 'renderSavedQuotes', 'index.html')),
    'and the money to go and buy is on the Buying lane, beside the orders waiting for it');
  t.check(/buyingListRuns\(live\)/.test(extractFunction(src, 'orderBoardCashToBuy', 'index.html')),
    "as the buying list's own runs, so the strip and the list cannot disagree");
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
  t.check(/orderGoodsRowHTML\(q\) \+ orderTripsRowHTML\(q\)/.test(extractFunction(src, 'orderWho', 'index.html')),
    "and the row's who-cell asks it, the count first and the journeys under it");
  t.check(/\$\{orderCashStripHTML\(q\)\}/.test(extractFunction(src, 'orderRowBodyHTML', 'index.html')),
    "with this order's share of the buying in the open row, beside its lines");
  t.check(/\.ow-ot-gr\.ow-good\{color:var\(--ow-verdigris\)/.test(src),
    'and it turns when the last one lands');
}

/* ---------- 8. and WHO is bringing it -------------------------------- */
/*
 * "2 of 5 items in" says how far along, never whether the other three
 * are moving. An order somebody is out collecting and an order nobody
 * has arranged anything for looked identical on the board, and the
 * second only surfaced when a client rang to ask. The trips were
 * recorded and the buying list showed them; the screen somebody actually
 * watches did not.
 *
 * THE ROW THAT MATTERS IS THE ABSENCE. Everything else on the card
 * reports progress; "Nobody sent for 2 items" reports that there is
 * none, which is why it is the one that is a button.
 */
{
  const NAMES2 = ['orderLiveTrips', 'orderLinesWithNobodySent', 'orderTripsRowHTML'];
  const state = { collectionTrips: [], suppliers: [{ id: 'S1', name: 'Shafik Katwe' }] };
  const scope = compileScope([
    extractFunction(shared, 'tripIsLive', 'shared-worker.js'),
    extractFunction(shared, 'tripLines', 'shared-worker.js'),
    extractFunction(shared, 'tripsCoveringLine', 'shared-worker.js'),
    extractFunction(shared, 'lineIsOnATrip', 'shared-worker.js'),
    extractFunction(shared, 'orderLineIsBoughtIn', 'shared-worker.js'),
    extractFunction(shared, 'quoteLineReceived', 'shared-worker.js'),
    extractFunction(shared, 'orderIncomingLines', 'shared-worker.js'),
    extractFunction(shared, 'orderAwaitsGoods', 'shared-worker.js'),
    extractDeclaration(src, 'TRIP_SUPPLIER_CARRIER', 'index.html'),
    extractFunction(src, 'tripIsSupplierDelivered', 'index.html'),
    extractFunction(src, 'tripCarrierLabel', 'index.html'),
    extractFunction(src, 'tripStatusLabel', 'index.html'),
    ...NAMES2.map((n) => extractFunction(src, n, 'index.html')),
  ], {
    data: state, esc: (s) => String(s), ICON_TRUCK: '', ICON_WARN: '',
    staffName: () => 'Abudu', supplierName: () => 'Shafik Katwe',
    TRIP_STATUS_LABELS: { open: 'To send', assigned: 'Sent', collecting: 'Out collecting', collected: 'Back — to check in' },
  }, NAMES2);

  const order = { id: 7, items: [
    { lineId: 'A', supplierId: 'S1', productName: 'Hinges' },
    { lineId: 'B', supplierId: 'S1', productName: 'Runners' },
  ] };
  const tripOver = (over) => Object.assign({
    id: 'T1', supplierId: 'S1', status: 'collecting', assignedWorkerId: 'W1', voided: false,
    lines: [{ orderId: 7, lineId: 'A' }, { orderId: 7, lineId: 'B' }],
  }, over);

  // Nothing arranged.
  state.collectionTrips = [];
  const gap = scope.orderTripsRowHTML(order);
  t.check(scope.orderLinesWithNobodySent(order).length === 2, 'both lines are on nobody\'s list');
  t.check(/Nobody sent for 2 items/.test(gap), `and the card says so (${gap.replace(/<[^>]+>/g, '').trim()})`);
  t.check(/data-trip-gap="7"/.test(gap) && /<button/.test(gap),
    'as the one line on the card you can press, because there is somewhere to go about it');

  // One of ours is out.
  state.collectionTrips = [tripOver({})];
  const ours = scope.orderTripsRowHTML(order);
  t.check(/Abudu/.test(ours) && /out collecting/.test(ours), 'a worker out is named, with what they are doing');
  t.check(!/Nobody sent/.test(ours), 'and nothing is reported as unarranged once it is on a list');
  t.check((ours.match(/sq-goods-row trip/g) || []).length === 1,
    'one journey covering two of this order\'s lines is ONE row — printing it twice would read as two people out');
  t.check(/2 items of this order/.test(ours),
    'saying how much of THIS order it covers, since a run carries other orders too');

  /* And that count is only ours. A run to Shafik carries lines from
     three different orders -- that is the whole reason trips are per
     supplier -- so counting the trip's lines instead of this order's
     lines would tell each card the journey is bigger than its share of
     it. A fixture whose trip carries only this order cannot tell the
     two apart, which is how this passed while counting everything. */
  state.collectionTrips = [tripOver({ lines: [
    { orderId: 7, lineId: 'A' }, { orderId: 7, lineId: 'B' },
    { orderId: 42, lineId: 'X' }, { orderId: 42, lineId: 'Y' }, { orderId: 99, lineId: 'Z' },
  ] })];
  const shared5 = scope.orderTripsRowHTML(order);
  t.check(/2 items of this order/.test(shared5) && !/5 items/.test(shared5),
    `a run of five lines reports the two that are ours (${(shared5.match(/\d+ items? of this order/) || [])[0]})`);

  // The supplier is bringing it.
  state.collectionTrips = [tripOver({ assignedWorkerId: '__supplier__' })];
  const theirs = scope.orderTripsRowHTML(order);
  t.check(/Supplier delivering/.test(theirs) && /on its way here/.test(theirs),
    'a supplier delivery says so in the same place');
  t.check(!/__supplier__/.test(theirs), 'and never leaks the sentinel onto the board');

  /* Half arranged is the case that would be easiest to get wrong: a trip
     exists, so an early return would call the whole order covered and
     the other line would wait for a journey nobody ever makes. */
  state.collectionTrips = [tripOver({ lines: [{ orderId: 7, lineId: 'A' }] })];
  const half = scope.orderTripsRowHTML(order);
  t.check(/Abudu/.test(half) && /Nobody sent for 1 item/.test(half),
    'a trip covering some of it shows the trip AND flags the rest');
  t.check(/1 item of this order/.test(half), 'counting only the lines it actually carries');

  // Somebody else's trip is not this order's business.
  state.collectionTrips = [tripOver({ lines: [{ orderId: 99, lineId: 'Z' }] })];
  t.check(scope.orderLiveTrips(order).length === 0
    && /Nobody sent for 2 items/.test(scope.orderTripsRowHTML(order)),
    'a trip carrying another order entirely covers nothing here');

  // Nothing outstanding, nothing said.
  const settled = { id: 8, items: [{ lineId: 'A', supplierId: '__stock__' }] };
  t.check(scope.orderTripsRowHTML(settled) === '',
    'an order with nothing on its way says nothing at all');
  const gotIt = { id: 9, items: [{ lineId: 'A', supplierId: 'S1', receivedAt: 'x', receivedQty: 3 }] };
  state.collectionTrips = [];
  t.check(scope.orderTripsRowHTML(gotIt) === '',
    'and neither does one whose goods have already come through the door');

  /* The guard earns its place here specifically. A trip stays live until
     it is checked IN, so an order whose goods have arrived can still be
     on a live trip -- and without the awaits-goods test the card would
     go on announcing that somebody is out fetching what is already on
     the shelf. Every other fixture returns empty for a second reason
     (no trips, no gap), which is why this one is needed to see it. */
  state.collectionTrips = [tripOver({ lines: [{ orderId: 9, lineId: 'A' }] })];
  t.check(scope.orderLiveTrips(gotIt).length === 1,
    'the trip is still live, because live means "not yet checked in"');
  t.check(scope.orderTripsRowHTML(gotIt) === '',
    'but the card stays silent — the goods are here, whatever the paperwork still says');

  // Drawn on the card, and wired.
  t.check(/orderGoodsRowHTML\(q\) \+ orderTripsRowHTML\(q\)/.test(extractFunction(src, 'orderWho', 'index.html')),
    'the row draws it directly under the count it explains');
  t.check(/if\(t\.closest\('\[data-trip-gap\]'\)\)\{ openBuyingList\(\); return; \}/.test(src),
    'and the button opens the buying list, where somebody actually gets sent -- through the one listener the console has');
}

process.exit(t.done() ? 1 : 0);
