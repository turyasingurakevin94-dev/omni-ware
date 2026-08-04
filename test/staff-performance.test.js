#!/usr/bin/env node
'use strict';
/*
 * How somebody is actually doing.
 *
 * The staff screen listed people and said whether they were busy. That
 * is a rota, not a record: it cannot tell the picker who clears an order
 * in ten minutes from the one who leaves it until somebody phones, and
 * both looked identical on a card.
 *
 * WHAT CANNOT HONESTLY BE MEASURED, AND IS THEREFORE NOT SHOWN.
 *
 * Time SPENT preparing is gone after the fact. It lives in
 * stageEnteredAt, which is overwritten the moment an order leaves the
 * step, so once it reaches Completed there is no record of how long the
 * picking took. Reporting it would mean inventing it. The screen says so
 * rather than quietly omitting it.
 *
 * What survives is on the order itself -- when the job was handed over,
 * when it was picked up, and what each line came to -- so those are the
 * figures.
 *
 * The judgement calls, each pinned below:
 *
 *   median, not mean    one order handed over on a Friday evening and
 *                       accepted on Monday is 60 hours, and it drags a
 *                       mean far enough to make a reliable picker look
 *                       slow.
 *   null, not zero      "never comes up short" and "has picked nothing"
 *                       are different facts, and showing the first for
 *                       the second flatters somebody who has done no
 *                       work.
 *   answered lines only an order they never got to is not evidence about
 *                       their picking in either direction.
 *
 * Run: node test/staff-performance.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('staff performance');
const src = read('index.html');
const worker = read('shared-worker.js');
const TODAY = '2026-08-04';
const data = { staff: [], savedQuotes: [], customers: [] };

const scope = compileScope([
  extractFunction(src, 'staffMedian', 'index.html'),
  extractFunction(src, 'staffOrdersInRange', 'index.html'),
  extractFunction(src, 'destinationKey', 'index.html'),
  extractFunction(src, 'staffPerformance', 'index.html'),
], {
  data,
  todayISO: () => TODAY,
  itemPickedQty: (it) => (it.pickStatus === 'done' ? (Number(it.qty) || 0)
    : it.pickStatus === 'short' ? (Number(it.pickedQty) || 0) : null),
  pickShortfallLines: (q) => (q.items || []).filter((it) =>
    it.pickStatus === 'short' && (Number(it.pickedQty) || 0) < (Number(it.qty) || 0)),
  savedQuoteTotal: (q) => (q.items || []).reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.sellPrice) || 0), 0),
  orderDestination: (q) => q.dest || '',
  staffActiveOrders: () => [],
}, ['staffPerformance', 'staffOrdersInRange', 'staffMedian']);

const MIN = 60000;
const HANDED = Date.UTC(2026, 7, 1, 8, 0);
const line = (over) => Object.assign({ productName: 'Cement', qty: 10, sellPrice: 38000 }, over);
const order = (id, over) => Object.assign({
  id, date: '2026-08-02', invoicedAt: '2026-08-02', voided: false,
  assignedWorkerId: 'W1', assignedDeliveryId: null,
  pickingAssignedAt: HANDED, workerAcceptedAt: HANDED + 10 * MIN,
  items: [line()],
}, over);
const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);
const reset = () => {
  data.staff = [{ id: 'W1', name: 'James', role: 'worker' }, { id: 'D1', name: 'Sarah', role: 'delivery' }];
  data.savedQuotes = [];
};

/* ---------- 1. the work that went through them ----------------------- */
{
  reset();
  data.savedQuotes = [order(1), order(2), order(3, { items: [line({ qty: 5 })] })];
  const p = scope.staffPerformance('W1', '2026-08-01', '2026-08-31');

  eq(p.picked, 3, 'every order assigned to them in the period');
  eq(p.pickedValue, (10 + 10 + 5) * 38000, 'and what it was worth');
  eq(p.delivered, 0, 'they delivered none of it');
  eq(p.staff.name, 'James', 'the person is carried through');
}

/* ---------- 2. how quickly work is taken up -------------------------- */
{
  reset();
  data.savedQuotes = [
    order(1, { workerAcceptedAt: HANDED + 5 * MIN }),
    order(2, { workerAcceptedAt: HANDED + 10 * MIN }),
    order(3, { workerAcceptedAt: HANDED + 15 * MIN }),
  ];
  const p = scope.staffPerformance('W1', '2026-08-01', '2026-08-31');
  eq(p.acceptMedianMins, 10, 'the middle of three handovers');
  eq(p.acceptSamples, 3, 'across all three');

  /* The reason it is a median. One order handed over on a Friday evening
     and accepted on Monday is 3600 minutes; the mean of these four is
     over fifteen hours, which would report a picker who normally takes
     ten minutes as taking most of a day. */
  data.savedQuotes.push(order(4, { workerAcceptedAt: HANDED + 3600 * MIN }));
  const p2 = scope.staffPerformance('W1', '2026-08-01', '2026-08-31');
  eq(p2.acceptMedianMins, 12.5, 'a weekend outlier moves the median by two and a half minutes');
  const mean = (5 + 10 + 15 + 3600) / 4;
  t.check(p2.acceptMedianMins < mean / 50,
    `where the mean would have said ${Math.round(mean)} minutes`);

  // Never accepted, and half-recorded pairs, contribute no timing.
  reset();
  data.savedQuotes = [
    order(1, { workerAcceptedAt: null }),
    order(2, { pickingAssignedAt: null }),
    order(3, { workerAcceptedAt: HANDED - 5 * MIN }),   // accepted before handed over
  ];
  const p3 = scope.staffPerformance('W1', '2026-08-01', '2026-08-31');
  t.check(p3.acceptMedianMins === null, 'nothing timable gives no figure rather than zero');
  eq(p3.acceptSamples, 0, 'and says how many it had to work from');
  eq(p3.neverAccepted, 1,
    'the one handed over and never picked up is counted; the one never handed over is not');

  /* The guard needs a case where BOTH are missing, or it never has to
     do anything: with a workerAcceptedAt present the second condition
     already excludes the order, and a mutation dropping the
     pickingAssignedAt check passed. An order that was never handed to
     anybody is not an order somebody ignored. */
  reset();
  data.savedQuotes = [
    order(1, { pickingAssignedAt: null, workerAcceptedAt: null }),
    order(2, { workerAcceptedAt: null }),
  ];
  eq(scope.staffPerformance('W1', '2026-08-01', '2026-08-31').neverAccepted, 1,
    'an order never handed over at all is not somebody failing to take it up');
}

/* ---------- 3. whether the shelf held -------------------------------- */
{
  reset();
  data.savedQuotes = [
    order(1, { items: [line({ pickStatus: 'done' }), line({ pickStatus: 'short', pickedQty: 6 })] }),
    order(2, { items: [line({ pickStatus: 'done' }), line({ pickStatus: 'done' })] }),
    // Never picked: contributes nothing in either direction.
    order(3, { items: [line(), line()] }),
  ];
  const p = scope.staffPerformance('W1', '2026-08-01', '2026-08-31');
  eq(p.linesPicked, 4, 'only lines that were actually answered count');
  eq(p.linesShort, 1, 'one of them came up short');
  eq(p.ordersShort, 1, 'on one order');
  t.check(Math.abs(p.shortRate - 25) < 0.01, `so the rate is a quarter (got ${p.shortRate})`);

  /* null, not zero. A picker who has answered nothing has not proved
     they never come up short -- and a 0% beside somebody who has done no
     work reads as the best score on the team. */
  reset();
  data.savedQuotes = [order(1, { items: [line()] })];
  const none = scope.staffPerformance('W1', '2026-08-01', '2026-08-31');
  eq(none.linesPicked, 0, 'nothing answered');
  t.check(none.shortRate === null, 'so there is no rate, rather than a flattering zero');
}

/* ---------- 4. delivery is its own record ---------------------------- */
{
  reset();
  data.savedQuotes = [
    order(1, { assignedWorkerId: null, assignedDeliveryId: 'D1', dest: 'Katwe' }),
    order(2, { assignedWorkerId: null, assignedDeliveryId: 'D1', dest: 'katwe' }),
    order(3, { assignedWorkerId: null, assignedDeliveryId: 'D1', dest: 'Ndeeba' }),
    order(4, { assignedWorkerId: null, assignedDeliveryId: 'D1', dest: '' }),
  ];
  const p = scope.staffPerformance('D1', '2026-08-01', '2026-08-31');
  eq(p.delivered, 4, 'every delivery assigned to them');
  eq(p.places, 2, 'two places — a spelling is not a third destination');
  eq(p.picked, 0, 'and none of it was picking');
  t.check(p.shortRate === null, 'so no pick rate is claimed for a rider');
}

/* ---------- 5. one person can do both -------------------------------- */
{
  reset();
  data.savedQuotes = [
    order(1),                                                   // picked by W1
    order(2, { assignedDeliveryId: 'W1' }),                     // AND delivered by W1
  ];
  const p = scope.staffPerformance('W1', '2026-08-01', '2026-08-31');
  eq(p.picked, 2, 'both orders were picked by them');
  eq(p.delivered, 1, 'and one of them was also delivered by them');
  // The same order counting in both is correct: they did both jobs on it.
  t.check(p.pickedValue > 0 && p.deliveredValue > 0,
    'each capacity carries its own value rather than one cancelling the other');
}

/* ---------- 6. the period, and what falls in it ---------------------- */
{
  reset();
  data.savedQuotes = [
    order(1, { invoicedAt: '2026-07-30', date: '2026-07-28' }),
    order(2, { invoicedAt: '2026-08-02', date: '2026-07-28' }),
    order(3, { invoicedAt: null, date: '2026-08-03' }),
    order(4, { invoicedAt: '2026-08-02', voided: true }),
  ];
  const p = scope.staffPerformance('W1', '2026-08-01', '2026-08-31');
  eq(p.picked, 2, 'dated by when it was billed, falling back to when it was raised');
  t.check(!p.orders.picked.some((q) => q.id === 1),
    'a July invoice stays in July even though the order was raised then too');
  t.check(p.orders.picked.some((q) => q.id === 3),
    'an order still on the board counts by its own date');
  t.check(!p.orders.picked.some((q) => q.id === 4), 'and a voided order is not work');
}

/* ---------- 7. somebody with nothing --------------------------------- */
{
  reset();
  const p = scope.staffPerformance('W1', '2026-08-01', '2026-08-31');
  eq(p.picked, 0, 'no orders');
  eq(p.pickedValue, 0, 'no value');
  t.check(p.acceptMedianMins === null && p.shortRate === null, 'and no invented figures');

  const gone = scope.staffPerformance('NOBODY', '2026-08-01', '2026-08-31');
  t.check(gone.staff === null && gone.picked === 0,
    'a staff id that no longer exists gives an empty record rather than throwing');
}

/* ---------- 8. one row per person, not one card per role ------------- */
{
  /* The old screen had two grids, Workers and Delivery personnel, and
     staffEligibleForRole lets a worker be picked for a delivery -- so
     anybody doing both appeared twice, with two statuses to read for one
     human being. */
  t.check(!/renderStaffGroup/.test(src), 'the two-grid renderer is gone');
  t.check(!/staffCardHTML/.test(src), 'and the card it built with it');
  t.check(/id="staffRoster"/.test(src) && /class="rost-list"/.test(src),
    'replaced by one list of people');
  t.check(/staffEligibleForRole\(s, 'worker'\)/.test(src) && /staffEligibleForRole\(s, 'delivery'\)/.test(src),
    'each row carrying whatever capacities that person has');
  t.check(/staffRoleFilter/.test(src) && /data-role="all"/.test(src),
    'and the roles filter the list rather than splitting it');

  /* The filter sorts on the job somebody holds, not on what they could
     be picked for. staffEligibleForRole returns true for delivery on
     EVERY worker, so filtering by eligibility made the Delivery button
     return the whole team -- a control that appears to work and does
     nothing. Caught by driving it, not by reading it. */
  t.check(/rows = rows\.filter\(s=> s\.role === staffRoleFilter\)/.test(src),
    'Delivery means the delivery staff, not everybody who could be sent on one');
  t.check(!/rows\.filter\(s=> staffEligibleForRole\(s, staffRoleFilter\)\)/.test(src),
    'and eligibility is not what sorts the list');

  // The limitation is on screen, not just in the source.
  t.check(/not kept once an order leaves the step/.test(src),
    'the screen says why time spent picking is not among the figures');
}

process.exit(t.done() ? 1 : 0);
