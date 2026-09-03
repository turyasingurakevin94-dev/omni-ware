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
// Staff matter here: a re-pick is only re-offered to the assigned worker if
// they are still on staff, or the order would sit awaiting acceptance by
// somebody no app can resolve. Section 8 covers the other side of that.
const data = { savedQuotes: [], staff: [{ id: 'ST1', name: 'Emma', role: 'worker' }] };
const seen = { assignPrompted: false };

const scope = compileScope([
  "const SQ_STATUS_ORDER = ['draft','preparing','pending_delivery','completed'];",
  "const STAGE_ASSIGNMENT_ROLE = { preparing:'worker', pending_delivery:'delivery' };",
  "const STAGE_ASSIGNMENT_FIELD = { worker:'assignedWorkerId', delivery:'assignedDeliveryId' };",
  extractFunction(sharedJs, 'resetPickingProgress', 'shared-worker.js'),
  // Awaiting Goods: an order cannot be picked while any of it is still
  // in a supplier's shop, so the rule that decides that comes too.
  extractFunction(sharedJs, 'orderLineIsBoughtIn', 'shared-worker.js'),
  extractFunction(sharedJs, 'quoteLineReceived', 'shared-worker.js'),
  extractFunction(sharedJs, 'quoteLineComesOffShelf', 'shared-worker.js'),
  extractFunction(sharedJs, 'orderIncomingLines', 'shared-worker.js'),
  extractFunction(sharedJs, 'orderAwaitsGoods', 'shared-worker.js'),
  extractFunction(sharedJs, 'goodsBlockPreparing', 'shared-worker.js'),
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
  // Ditto for the supplier-confirmation gate on leaving Draft. true is also
  // what the real one answers for these fixtures -- no line here names a
  // supplier, so there is nobody to confirm with.
  orderDraftReady: () => true,
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

/* ---------- 6. forward, into a stage that asks for nobody -------------- */
/*
 * This used to open a pop-up asking who would pick it, and hold the move
 * until somebody was chosen. Nothing asks now: the order enters Preparing
 * unassigned, joins the pickers' queue (workerPickQueue, shared-worker.js)
 * and the next free picker takes it from their own phone. The pop-up was
 * the tap and the interruption the owner asked to lose, and it was also
 * the only thing making an unassigned order look like a problem.
 */
{
  seen.assignPrompted = false;
  const q = load({ status: 'draft', assignedWorkerId: null, pickingStatus: null, pickCursor: 0 });
  q.items.forEach((it) => { it.pickStatus = null; it.pickedQty = null; });
  scope.stepSavedQuoteStatus(900, 1);

  t.check(!seen.assignPrompted, 'moving forward into preparing asks for nobody');
  t.check(q.status === 'preparing', 'the order advances unassigned, into the pickers\' queue');
  t.check(!q.assignedWorkerId && !q.pickingStatus,
    'with no worker on it and no pick pretended — which is exactly what puts it in that queue');
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

/* ---------- 8. ...but not to somebody who has left -------------------- */
{
  // An order that reached Pending Delivery keeps the worker who picked it as
  // the record of who did, and deleting a staff member deliberately leaves
  // that alone. Sending one back then re-offered the re-pick to somebody
  // gone: 'awaiting_accept' naming a worker no app can resolve, which reads
  // as an order waiting on a person rather than one waiting for anybody.
  //
  // Found by test/worker-lifecycle-property.test.js, from a random sequence
  // no hand-written case here had thought to try.
  const q = load({ status: 'pending_delivery', assignedWorkerId: 'ST_GONE', assignedDeliveryId: 'ST9', pickingStatus: 'done' });
  scope.stepSavedQuoteStatus(900, -1);

  t.check(q.status === 'preparing', 'the order still comes back to be picked');
  t.check(q.assignedWorkerId === null, 'but not in the name of somebody no longer on staff');
  t.check(q.pickingStatus === null,
    'and it is not left awaiting acceptance by them -- the board offers it to anybody instead');
}

process.exit(t.done() ? 1 : 0);
