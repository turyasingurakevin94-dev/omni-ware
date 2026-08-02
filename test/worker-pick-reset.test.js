#!/usr/bin/env node
'use strict';
/*
 * Stepping an order backward across "Being Prepared" has to retire the pick.
 *
 * The pick belongs to the stage, not to the order. Both backward steps that
 * touch that stage used to leave it behind, and the leftovers read as this
 * stage's work already done:
 *
 *   preparing -> draft     the worker was retired, the ticks were not. Handed
 *                          to somebody else, the order opened on their device
 *                          with every item already "Picked" and "Mark as
 *                          finished" live from the first tap -- signable off
 *                          without anyone walking to a shelf.
 *
 *   pending_delivery ->    sent back for a re-pick, it kept pickingStatus
 *   preparing              'done'. That is neither awaiting_accept nor
 *                          in_progress, and the worker app lists only those
 *                          two -- so it sat assigned to a worker and invisible
 *                          on their screen, while the board read "being
 *                          prepared by" them. The same stranding
 *                          denyOrderAssignment and the finish back-out each
 *                          already guard, reached from a third direction.
 *
 * Run: node test/worker-pick-reset.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('worker pick reset');
const indexHtml = read('index.html');
const sharedJs = read('shared-worker.js');

// compileScope binds bare identifiers at compile time, so the fixture object
// has to exist before the sources are compiled -- only its contents may be
// swapped between cases.
const data = { savedQuotes: [] };
const seen = { assignPrompted: false };

const scope = compileScope([
  "const SQ_STATUS_ORDER = ['draft','preparing','pending_delivery','completed'];",
  "const STAGE_ASSIGNMENT_ROLE = { preparing:'worker', pending_delivery:'delivery' };",
  "const STAGE_ASSIGNMENT_FIELD = { worker:'assignedWorkerId', delivery:'assignedDeliveryId' };",
  extractFunction(sharedJs, 'resetPickingProgress', 'shared-worker.js'),
  extractFunction(indexHtml, 'stepSavedQuoteStatus', 'index.html'),
], {
  data,
  seen,
  // Only the assignment/pick bookkeeping is under test here; the stage move
  // itself and the prepay gate are covered elsewhere.
  setSavedQuoteStatus: (id, to) => {
    const q = data.savedQuotes.find((x) => x.id === id);
    if (q) q.status = to;
  },
  agentPaymentBlocksPreparing: () => false,
  promptAgentPrepayment: () => {},
  openAssignStaffModal: () => { seen.assignPrompted = true; },
  toast: () => {},
}, ['stepSavedQuoteStatus', 'resetPickingProgress']);

const order = (over) => Object.assign({
  id: 900,
  client: { name: 'Moses' },
  status: 'preparing',
  assignedWorkerId: 'ST1',
  assignedDeliveryId: null,
  pickingStatus: 'in_progress',
  pickCursor: 2,
  pickingAssignedAt: 1000,
  workerAcceptedAt: 2000,
  items: [
    { productId: 'P001', qty: 5, pickStatus: 'done', pickedQty: 5 },
    { productId: 'P002', qty: 2, pickStatus: 'done', pickedQty: 2 },
    { productId: 'P003', qty: 1, pickStatus: 'done', pickedQty: 1 },
  ],
}, over);

const load = (over) => {
  const q = order(over);
  data.savedQuotes = [q];
  return q;
};
const allPicks = (q, v) => q.items.every((it) => it.pickStatus === v);

/* ---------- 1. preparing -> draft abandons the pick ------------------- */
{
  const q = load();
  scope.stepSavedQuoteStatus(900, -1);

  t.check(q.status === 'draft', 'the order steps back to draft');
  t.check(q.assignedWorkerId === null, 'the worker is retired with the stage');
  t.check(q.pickingStatus === null, 'the picking status goes with the assignment');
  t.check(q.pickCursor === 0, 'the cursor resets');
  t.check(q.pickingAssignedAt === null && q.workerAcceptedAt === null,
    'both picking timestamps are cleared');
  t.check(allPicks(q, null), 'every tick is thrown away');
  t.check(q.items.every((it) => it.pickedQty === null), 'every picked quantity is thrown away');
}

/* ---------- 2. the next worker starts from an unpicked order ---------- */
{
  // The bug as the shop meets it: reassigned, accepted, already finishable.
  const q = load();
  scope.stepSavedQuoteStatus(900, -1);

  // Admin hands it to Brenda -- exactly what openAssignStaffModal writes.
  q.assignedWorkerId = 'ST2';
  q.pickingStatus = 'awaiting_accept';
  q.pickCursor = 0;
  q.status = 'preparing';

  // ...then acceptOrderAssignment's own line, which fills in only a MISSING
  // pickStatus. That is why a leftover 'done' survived into the next pick.
  q.items.forEach((it) => { if (!it.pickStatus) it.pickStatus = 'pending'; });

  t.check(allPicks(q, 'pending'), 'the new worker sees nothing picked');
  const allDone = q.items.length > 0 && allPicks(q, 'done');
  t.check(!allDone, 'and "Mark as finished" is not live before they have picked anything');
}

/* ---------- 3. sent back for a re-pick, it lands where they can see it - */
{
  const q = load({ status: 'pending_delivery', assignedDeliveryId: 'ST9', pickingStatus: 'done' });
  scope.stepSavedQuoteStatus(900, -1);

  t.check(q.status === 'preparing', 'the order returns to being prepared');
  t.check(q.assignedDeliveryId === null, 'the delivery assignment is retired');
  t.check(q.assignedWorkerId === 'ST1', 'the worker keeps the order');
  t.check(q.pickingStatus === 'awaiting_accept', 're-offered, so it shows on their device again');
  t.check(allPicks(q, null), 'the finished pick is thrown away for a fresh one');

  // The stranding itself: the worker app lists these two statuses, no others.
  t.check(['awaiting_accept', 'in_progress'].includes(q.pickingStatus),
    'the status is one the worker app actually renders');
}

/* ---------- 4. unassigned, there is nobody to re-offer it to ----------- */
{
  const q = load({
    status: 'pending_delivery', assignedWorkerId: null,
    assignedDeliveryId: 'ST9', pickingStatus: 'done',
  });
  scope.stepSavedQuoteStatus(900, -1);

  t.check(q.pickingStatus === null, 'no worker means no pending accept to invent');
  t.check(allPicks(q, null), 'the pick is still thrown away');
}

/* ---------- 5. steps that never cross the stage leave the pick alone --- */
{
  const q = load({ status: 'completed', assignedDeliveryId: 'ST9', pickingStatus: 'done' });
  scope.stepSavedQuoteStatus(900, -1);

  t.check(q.status === 'pending_delivery', 'completed steps back to pending delivery');
  t.check(q.pickingStatus === 'done', "a pick two stages back is not this step's business");
  t.check(allPicks(q, 'done'), 'and its ticks stand');
}

/* ---------- 6. forward steps are untouched ---------------------------- */
{
  seen.assignPrompted = false;
  const q = load({ status: 'draft', assignedWorkerId: null, pickingStatus: null, pickCursor: 0 });
  q.items.forEach((it) => { it.pickStatus = null; it.pickedQty = null; });
  scope.stepSavedQuoteStatus(900, 1);

  t.check(seen.assignPrompted, 'moving forward into preparing still prompts for a worker');
  t.check(q.status === 'draft', 'and holds the stage move until one is chosen');
}

/* ---------- 7. the helper leaves the assignment to its caller ---------- */
{
  const q = order();
  scope.resetPickingProgress(q);
  t.check(q.assignedWorkerId === 'ST1', 'resetPickingProgress does not decide who owns the order');
  t.check(q.pickingStatus === null, 'it only throws away the pick');

  let threw = false;
  try { scope.resetPickingProgress(null); scope.resetPickingProgress({}); } catch (e) { threw = true; }
  t.check(!threw, 'and tolerates a missing order, or one with no items');
}

process.exit(t.done() ? 1 : 0);
