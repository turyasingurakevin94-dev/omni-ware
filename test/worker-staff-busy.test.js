#!/usr/bin/env node
'use strict';
/*
 * Who the shop thinks each staff member is currently working on.
 *
 * staffActiveOrders answers that for two screens: the delivery picker a
 * worker sees when they finish a pick, which prints "Preparing for Moses —
 * since 3 hours ago" beside each candidate, and the admin's Staff tab.
 *
 * It filtered on the assignment, the stage, and whether the order had aged
 * off the board -- but not on whether it had been cancelled. Voiding an
 * order sets the flag and nothing else: the status stays 'preparing' and
 * the worker stays assigned. So a cancelled order went on reporting its
 * worker as busy to everyone deciding who was free, while that worker's own
 * screen showed them nothing to do.
 *
 * Every other reader of "is this order still live" already excluded voided
 * -- myWorkerOrders before rendering anything, autoAssignNextOrder before
 * handing work out. This one was the odd reader out.
 *
 * Run: node test/worker-staff-busy.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('worker staff busy');
const sharedJs = read('shared-worker.js');

const data = { savedQuotes: [] };

const scope = compileScope([
  extractDeclaration(sharedJs, 'SQ_BOARD_HIDE_AFTER_MS', 'shared-worker.js'),
  extractFunction(sharedJs, 'quoteAgedOffBoard', 'shared-worker.js'),
  extractFunction(sharedJs, 'staffActiveOrders', 'shared-worker.js'),
], { data }, ['staffActiveOrders']);

const HOUR = 3600000;
const DAY = 24 * HOUR;
const ANDREW = { id: 'ST1', name: 'Andrew', role: 'worker' };
const GRACE = { id: 'ST9', name: 'Grace', role: 'delivery' };

const order = (over) => Object.assign({
  id: 900,
  client: { name: 'Moses' },
  status: 'preparing',
  assignedWorkerId: 'ST1',
  assignedDeliveryId: null,
  voided: false,
  invoiced: false,
  invoicedTs: null,
  stageEnteredAt: Date.now() - 3 * HOUR,
}, over || {});

const busy = (staff, quotes) => {
  data.savedQuotes = quotes;
  return scope.staffActiveOrders(staff).map((x) => `${x.capacity}:${x.order.client.name}`);
};
const eq = (got, want) => JSON.stringify(got) === JSON.stringify(want);

/* ---------- 1. a cancelled order does not keep anyone busy ------------ */
{
  t.check(eq(busy(ANDREW, [order({ voided: true })]), []),
    'a voided order does not report its worker as still preparing it');
  t.check(eq(busy(GRACE, [order({
    voided: true, status: 'pending_delivery', assignedWorkerId: null, assignedDeliveryId: 'ST9',
  })]), []), 'nor its delivery person as still out with it');
}

/* ---------- 2. a live one still does --------------------------------- */
{
  t.check(eq(busy(ANDREW, [order()]), ['worker:Moses']),
    'a live order being prepared still shows its worker as busy');
  t.check(eq(busy(GRACE, [order({
    status: 'pending_delivery', assignedWorkerId: null, assignedDeliveryId: 'ST9',
  })]), ['delivery:Moses']), 'and a live delivery still shows its driver as busy');
}

/* ---------- 3. one person can be on two orders at once ---------------- */
{
  const got = busy(ANDREW, [
    order(),
    order({ id: 901, client: { name: 'Sarah' }, status: 'pending_delivery', assignedDeliveryId: 'ST1' }),
  ]);
  t.check(eq(got, ['worker:Moses', 'delivery:Sarah']),
    'a worker preparing one order and delivering another shows both, in that order');
}

/* ---------- 4. the filters that were already right stay right --------- */
{
  t.check(eq(busy(ANDREW, [order({ invoiced: true, invoicedTs: Date.now() - 2 * DAY })]), []),
    'an order long since invoiced has aged off and no longer counts');
  t.check(eq(busy(ANDREW, [order({ status: 'draft' })]), []),
    'an order not yet at Being Prepared does not count');
  t.check(eq(busy(ANDREW, [order({ status: 'completed' })]), []),
    'nor one already finished');
  // A delivered order keeps its driver on the row forever, so the stage is
  // the only thing saying they are no longer out with it.
  t.check(eq(busy(GRACE, [order({
    status: 'completed', assignedWorkerId: null, assignedDeliveryId: 'ST9',
  })]), []), 'a driver who has finished a delivery is free again');
  t.check(eq(busy(ANDREW, [order({ assignedWorkerId: 'ST7' })]), []),
    "nor somebody else's order");
  t.check(eq(busy(ANDREW, [order({ status: 'pending_delivery', assignedDeliveryId: 'ST9' })]), []),
    'being the picker does not make you the driver');
}

/* ---------- 5. and this is the same rule its neighbours use ----------- */
{
  // The point of the fix: three readers of "is this order still live", one
  // of which disagreed. If a fourth appears, it should read like these.
  const myWorkerOrders = extractFunction(sharedJs, 'myWorkerOrders', 'shared-worker.js');
  const autoAssign = extractFunction(sharedJs, 'autoAssignNextOrder', 'shared-worker.js');
  const staffActive = extractFunction(sharedJs, 'staffActiveOrders', 'shared-worker.js');
  [['myWorkerOrders', myWorkerOrders], ['autoAssignNextOrder', autoAssign], ['staffActiveOrders', staffActive]]
    .forEach(([name, src]) => {
      t.check(/!q\.voided/.test(src), `${name}() excludes voided orders`);
      t.check(/quoteAgedOffBoard\(q\)/.test(src), `${name}() excludes orders aged off the board`);
    });
}

process.exit(t.done() ? 1 : 0);
