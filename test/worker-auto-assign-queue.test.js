#!/usr/bin/env node
'use strict';
/*
 * Who gets handed the next order when a worker finishes one.
 *
 * autoAssignNextOrder documents itself as handing over the order that has
 * been waiting longest, and sorted by savedAt to find it. But savedAt is
 * rewritten on every save -- saveQuote sets `savedAt: new Date()` each time,
 * and pointedly does NOT do that to stageEnteredAt ("re-saving the quote's
 * own content must not reset it"). So the sort was least-recently-EDITED
 * first, and an order dropped to the back of the queue every time anybody
 * touched it: a five-hour-old order with one corrected line lost its place
 * to an order taken an hour later, and an order being amended repeatedly
 * could keep losing it.
 *
 * stageEnteredAt is what the board's own overdue warning already treats as
 * "waiting since", and renderSavedQuotes back-fills it for any row missing
 * one, so it is there to be used.
 *
 * The queue itself is now workerPickQueue: ONE rule, read three ways --
 * the "Next to pick" panel on every worker's phone, "Take the next one",
 * and this hand-over after a finished pick. So the order it puts things in
 * and the orders it refuses to hand out are checked here, and the
 * hand-over is checked for reading it rather than filtering again.
 *
 * Run: node test/worker-auto-assign-queue.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('worker auto-assign queue');
const sharedJs = read('shared-worker.js');

const HOUR = 3600000;
const NOW = Date.parse('2026-08-02T12:00:00Z');

const data = { savedQuotes: [], staff: [], agents: [] };
let saved = 0;

const scope = compileScope([
  extractDeclaration(sharedJs, 'SQ_BOARD_HIDE_AFTER_MS', 'shared-worker.js'),
  extractFunction(sharedJs, 'quoteAgedOffBoard', 'shared-worker.js'),
  // Awaiting Goods: an order cannot be picked while any of it is still
  // in a supplier's shop, so the rule that decides that comes too.
  extractFunction(sharedJs, 'orderLineIsBoughtIn', 'shared-worker.js'),
  extractFunction(sharedJs, 'quoteLineReceived', 'shared-worker.js'),
  extractFunction(sharedJs, 'quoteLineComesOffShelf', 'shared-worker.js'),
  extractFunction(sharedJs, 'orderIncomingLines', 'shared-worker.js'),
  extractFunction(sharedJs, 'orderAwaitsGoods', 'shared-worker.js'),
  extractFunction(sharedJs, 'goodsBlockPreparing', 'shared-worker.js'),
  // The queue skips a late entry (an order entered after it was delivered).
  extractFunction(sharedJs, 'orderIsBackdated', 'shared-worker.js'),
  extractFunction(sharedJs, 'agentPaymentBlocksPreparing', 'shared-worker.js'),
  extractFunction(sharedJs, 'workerPickQueue', 'shared-worker.js'),
  extractFunction(sharedJs, 'autoAssignNextOrder', 'shared-worker.js'),
], {
  data,
  saveData: () => { saved++; },
  refreshAdminOrderBoardIfOpen: () => {},
}, ['autoAssignNextOrder', 'workerPickQueue']);

// placedHoursAgo drives stageEnteredAt (when it started waiting);
// editedHoursAgo drives savedAt (when someone last touched it).
const order = (id, name, placedHoursAgo, editedHoursAgo, over) => Object.assign({
  id,
  client: { name },
  date: '2026-08-02',
  savedAt: new Date(NOW - editedHoursAgo * HOUR).toISOString(),
  stageEnteredAt: NOW - placedHoursAgo * HOUR,
  items: [{ productId: 'P001', qty: 1 }],
  /* Preparing, not draft. An order in Taken is waiting on its suppliers
     and the last confirmation is what moves it on (orderLeaveDraft,
     index.html) -- so the pickers' queue starts at Preparing, and a draft
     in it would have sent somebody to pack a maybe. */
  status: 'preparing',
  assignedWorkerId: null,
  voided: false,
  pickingStatus: null,
  pickCursor: 0,
}, over || {});

const handOut = (quotes, staff) => {
  data.staff = staff || [{ id: 'ST1', name: 'Andrew', role: 'worker' }];
  data.savedQuotes = quotes;
  scope.autoAssignNextOrder('ST1');
  const got = data.savedQuotes.find((q) => q.assignedWorkerId === 'ST1');
  return got ? got.client.name : 'none';
};

/* ---------- 1. an edit does not cost an order its place --------------- */
{
  // Moses ordered five hours ago; a clerk corrected a line five minutes ago.
  // Sarah ordered an hour ago and nobody has touched hers since.
  const got = handOut([order(1, 'Moses', 5, 0.08), order(2, 'Sarah', 1, 1)]);
  t.check(got === 'Moses', 'the order that has waited longest is handed over, edits notwithstanding');
}

/* ---------- 2. ...and the plain case still works ---------------------- */
{
  const got = handOut([order(1, 'Moses', 1, 1), order(2, 'Sarah', 5, 5)]);
  t.check(got === 'Sarah', 'with nothing edited, longest-waiting is still first');
}

/* ---------- 3. rows predating stageEnteredAt fall back to savedAt ------ */
{
  // Sarah is first in the array deliberately. With no fallback both keys
  // collapse to 0, the sort is stable, and she wins on position alone -- so
  // only a working fallback can put Moses, edited longer ago, ahead of her.
  const got = handOut([
    order(2, 'Sarah', 0, 1, { stageEnteredAt: null }),
    order(1, 'Moses', 0, 5, { stageEnteredAt: null }),
  ]);
  t.check(got === 'Moses', 'without a stageEnteredAt, savedAt is still better than nothing');
}

/* ---------- 4. the existing filters are untouched --------------------- */
{
  data.agents = [
    { id: 'AG1', name: 'Peter', paymentTerm: 'prepay' },
    { id: 'AG2', name: 'Joan', paymentTerm: 'credit' },
  ];

  t.check(handOut([
    order(1, 'Moses', 9, 9, { originAgentId: 'AG1', agentPaymentStatus: 'unpaid' }),
    order(2, 'Sarah', 1, 1),
  ]) === 'Sarah', 'a prepay agent order still waiting on its payment is skipped');

  t.check(handOut([
    order(1, 'Moses', 9, 9, { originAgentId: 'AG1', agentPaymentStatus: 'paid' }),
    order(2, 'Sarah', 1, 1),
  ]) === 'Moses', 'once paid, that same order is taken');

  t.check(handOut([
    order(1, 'Moses', 9, 9, { originAgentId: 'AG2', agentPaymentStatus: 'unpaid' }),
    order(2, 'Sarah', 1, 1),
  ]) === 'Moses', 'a credit agent order does not wait on payment');

  t.check(handOut([
    order(1, 'Moses', 9, 9, { voided: true }),
    order(2, 'Sarah', 1, 1),
  ]) === 'Sarah', 'a voided order is skipped');

  t.check(handOut([
    order(1, 'Moses', 9, 9, { assignedWorkerId: 'ST7' }),
    order(2, 'Sarah', 1, 1),
  ]) === 'Sarah', "somebody else's order is skipped");

  t.check(handOut([
    order(1, 'Moses', 9, 9, { status: 'pending_delivery' }),
    order(2, 'Sarah', 1, 1),
  ]) === 'Sarah', 'an order past preparation is skipped');

  t.check(handOut([
    order(1, 'Moses', 9, 9, { status: 'draft' }),
    order(2, 'Sarah', 1, 1),
  ]) === 'Sarah', 'and so is one still in Taken, waiting on its suppliers');

  t.check(handOut([
    order(1, 'Moses', 9, 9, { pickingStatus: 'done' }),
    order(2, 'Sarah', 1, 1),
  ]) === 'Sarah', 'a packed order is not picked again — it is waiting for transport, not for a picker');
}

/* ---------- 5. an unavailable worker is handed nothing ---------------- */
{
  const got = handOut([order(1, 'Moses', 9, 9)],
    [{ id: 'ST1', name: 'Andrew', role: 'worker', unavailable: true }]);
  t.check(got === 'none', 'a worker marked unavailable is not given the next order');
}

/* ---------- 6. what the hand-over actually writes ---------------------- */
{
  saved = 0;
  handOut([order(1, 'Moses', 5, 5)]);
  const q = data.savedQuotes[0];
  t.check(q.pickingStatus === 'awaiting_accept', 'it arrives on the device as a pending accept');
  t.check(q.pickCursor === 0, 'the pick starts at the first item');
  t.check(typeof q.pickingAssignedAt === 'number', 'the hand-over is timestamped');
  t.check(q.status === 'preparing', 'the order is where it was — the queue is Preparing');
  t.check(saved === 1, 'and the change is saved once');
}

/* ---------- 7. nothing to hand over is not an error ------------------- */
{
  saved = 0;
  const got = handOut([]);
  t.check(got === 'none' && saved === 0, 'an empty queue writes nothing');
}

process.exit(t.done() ? 1 : 0);
