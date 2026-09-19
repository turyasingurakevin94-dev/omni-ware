#!/usr/bin/env node
'use strict';
/*
 * Order status transitions and delivery routing.
 *
 * The board's forward/back arrows move an order, and each step carries a
 * gate: a prepay agent's order can't start being prepared until they've
 * paid, and an order can't be sent out for delivery by the arrow at all --
 * "out for delivery" has to mean something is out, so the move belongs to
 * Loaded (loadOrder, shared-worker.js), which carries who is carrying it.
 * The one exception is a self-pickup agent order, which has no carrier to
 * name and uses the '__agent__' sentinel.
 *
 * Entering Being Prepared asks for nobody: the order joins the pickers'
 * queue and the next free picker takes it from their own phone. The
 * pop-up that used to stand there was the tap the owner asked to lose.
 *
 * Getting a gate wrong doesn't throw. An order just quietly slips into a
 * stage it shouldn't be in: unpaid stock gets picked, or an order sits in
 * "out for delivery" with nobody delivering it.
 *
 * shared-worker.js exists in THREE copies -- the root one the web apps load,
 * worker-www/ for the Capacitor build, and the built Android assets. They
 * have drifted before now (variant images). Agreement between them used to
 * be checked here for the status rules only; it moved to
 * test/worker-packaging.test.js, which compares the files whole.
 *
 * Run: node test/order-status-delivery.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('order-status/delivery');
const adminSrc = read('index.html');
const workerSrc = read('shared-worker.js');

/* ---------- live state + stubs ---------------------------------------- */
const data = {};
const calls = { prompted: null, toasts: [], openedRow: null };
function reset(quote, agents) {
  Object.keys(data).forEach((k) => delete data[k]);
  Object.assign(data, { savedQuotes: quote ? [quote] : [], agents: agents || [] });
  calls.prompted = null;
  calls.toasts = [];
  calls.openedRow = null;
}

const env = {
  data,
  saveData: () => {},
  renderSavedQuotes: () => {},
  // Move feedback (toast + rail pulse + scroll) is DOM work, stubbed
  // as the one collaborator it was extracted to be.
  announceOrderMove: () => {},
  // Same reason announceOrderMove is stubbed: setSavedQuoteStatus is the
  // one place a status changes, so the sales-group hand-off fires from
  // there too. Its own function precisely so this stays one stub.
  shareOrderToSalesGroup: () => {},
  // Open, so the gates THIS file is about are the ones being measured. The
  // draft gate has its own file (order-draft-confirm.test.js), and leaving
  // it live here would block every move out of Draft before the gate under
  // test was reached.
  orderDraftReady: () => true,
  // Both gates divert instead of advancing; recording that is how the tests
  // tell "blocked" apart from "moved".
  promptAgentPrepayment: (q) => { calls.prompted = q.id; },
  // The delivery refusal says what to do instead and opens the row where
  // the Loaded form is; both are DOM work, recorded as the collaborators
  // they are so the gate itself is what is measured.
  toast: (m) => { calls.toasts.push(String(m)); },
  otOpenRow: (id) => { calls.openedRow = id; },
  openSupplierConfirmModal: (id) => { calls.openedPanel = id; },
  /* The board asks who is picking or carrying again, through the modal
     the forward arrow has always opened. Stubbed, not exercised: whose
     order it becomes is assign-staff's business, and this file is about
     the stage and the pick. */
  openAssignStaffModal: (id, toStatus, role) => { calls.assignAsked = { id, toStatus, role }; },
  openOrderPreview: (id) => { calls.openedDialog = id; },
};

const NAMES = ['agentPaymentBlocksPreparing', 'quoteAgedOffBoard', 'setSavedQuoteStatus', 'stepSavedQuoteStatus'];
const scope = compileScope(
  [
    // Real constants, not a hand-copied set that could stop matching.
    extractDeclaration(adminSrc, 'SQ_STATUSES', 'index.html'),
    extractDeclaration(adminSrc, 'SQ_STATUS_ORDER', 'index.html'),
    extractDeclaration(adminSrc, 'STAGE_ASSIGNMENT_ROLE', 'index.html'),
    extractDeclaration(adminSrc, 'STAGE_ASSIGNMENT_FIELD', 'index.html'),
    extractDeclaration(workerSrc, 'SQ_BOARD_HIDE_AFTER_MS', 'shared-worker.js'),
    extractFunction(workerSrc, 'agentPaymentBlocksPreparing', 'shared-worker.js'),
    // Awaiting Goods: an order cannot be picked while any of it is still
    // in a supplier's shop, so the rule that decides that comes too.
    extractFunction(workerSrc, 'orderLineIsBoughtIn', 'shared-worker.js'),
    extractFunction(workerSrc, 'quoteLineReceived', 'shared-worker.js'),
    extractFunction(workerSrc, 'quoteLineComesOffShelf', 'shared-worker.js'),
    extractFunction(workerSrc, 'orderIncomingLines', 'shared-worker.js'),
    extractFunction(workerSrc, 'orderAwaitsGoods', 'shared-worker.js'),
    extractFunction(workerSrc, 'goodsBlockPreparing', 'shared-worker.js'),
    extractFunction(workerSrc, 'quoteAgedOffBoard', 'shared-worker.js'),
    // Stepping backward across Being Prepared retires the pick with the
    // assignment -- see test/worker-pick-reset.test.js.
    extractFunction(workerSrc, 'resetPickingProgress', 'shared-worker.js'),
    extractFunction(adminSrc, 'setSavedQuoteStatus', 'index.html'),
    extractFunction(adminSrc, 'stepSavedQuoteStatus', 'index.html'),
  ],
  env, NAMES.concat(['SQ_STATUS_ORDER']).filter((n) => n !== 'SQ_STATUS_ORDER'),
);
const { agentPaymentBlocksPreparing, quoteAgedOffBoard, stepSavedQuoteStatus, setSavedQuoteStatus } = scope;

const ORDER = ['draft', 'preparing', 'pending_delivery', 'completed'];
const mkQuote = (over) => Object.assign({
  id: 1, status: 'draft', deliveryMode: 'shop_delivery',
  assignedWorkerId: null, assignedDeliveryId: null, stageEnteredAt: 111,
}, over || {});
const status = () => data.savedQuotes[0].status;

/* ---------- 1. the sequence walks forward and stops at the ends -------- */
/*
 * Driven through setSavedQuoteStatus, which is where every move lands --
 * the arrow, the last supplier confirmation, and Loaded alike. The gates
 * on the arrow itself are checked in 4 below.
 */
{
  reset(mkQuote());
  const seen = [status()];
  ORDER.slice(1).forEach((s) => { setSavedQuoteStatus(1, s); seen.push(status()); });
  t.check(JSON.stringify(seen) === JSON.stringify(ORDER),
    `the board's stages are ${ORDER.join(' -> ')} (got ${seen.join(' -> ')})`);
}
{
  reset(mkQuote({ status: 'completed', assignedWorkerId: 'ST1', assignedDeliveryId: 'ST2' }));
  stepSavedQuoteStatus(1, +1);
  t.check(status() === 'completed', `stepping past the last stage is a no-op (got ${status()})`);
  reset(mkQuote({ status: 'draft' }));
  stepSavedQuoteStatus(1, -1);
  t.check(status() === 'draft', `stepping back from the first stage is a no-op (got ${status()})`);
}
{
  // An unknown status has no position in the sequence; stepping must not
  // coerce it to one end or the other.
  reset(mkQuote({ status: 'archived' }));
  stepSavedQuoteStatus(1, +1);
  const forward = status();
  stepSavedQuoteStatus(1, -1);
  t.check(forward === 'archived' && status() === 'archived',
    `an unrecognised status isn't dragged into the sequence (got ${status()})`);
}

/* ---------- 2. stageEnteredAt tracks real movement only ---------------- */
{
  reset(mkQuote({ stageEnteredAt: 111 }));
  setSavedQuoteStatus(1, 'preparing');
  t.check(status() === 'preparing' && data.savedQuotes[0].stageEnteredAt !== 111,
    'entering a new stage restamps stageEnteredAt (drives the overdue warning)');
  const stamp = data.savedQuotes[0].stageEnteredAt;
  setSavedQuoteStatus(1, 'preparing'); // same stage again
  t.check(data.savedQuotes[0].stageEnteredAt === stamp,
    're-setting the stage an order is already in leaves stageEnteredAt alone');
  reset(mkQuote({ status: 'completed', assignedWorkerId: 'ST1', assignedDeliveryId: 'ST2', stageEnteredAt: 111 }));
  stepSavedQuoteStatus(1, +1); // refused -- already at the end
  t.check(data.savedQuotes[0].stageEnteredAt === 111,
    'a refused step leaves stageEnteredAt alone');
}

/* ---------- 2b. moving an order on ends the pick ---------------------- */
/*
 * The picking state used to stay 'in_progress' while the order sat in
 * Pending Delivery, so the worker's app went on showing it as their active
 * pick. They could tick the last item, press "Mark as finished", and be told
 * the order had already moved on -- true, and finishPreparingOrder is right
 * to refuse it. But there was no way past: holding an order they could not
 * finish, they could not accept another either, and the toast's advice to
 * refresh changed nothing, because the order really was in that state. An
 * admin nudging the board forward one stage stopped a picker for the shift.
 *
 * 'done' rather than cleared. Moving it on IS the claim that the picking is
 * over, and it leaves the same state finishPreparingOrder does. The backward
 * move is the opposite claim, and resets instead (section 6b below).
 */
{
  const pick = () => data.savedQuotes[0].pickingStatus;

  reset(mkQuote({ status: 'preparing', pickingStatus: 'in_progress', assignedWorkerId: 'ST1' }));
  setSavedQuoteStatus(1, 'pending_delivery');
  t.check(pick() === 'done', 'a pick in progress is ended when the order moves on');

  reset(mkQuote({ status: 'preparing', pickingStatus: 'awaiting_accept', assignedWorkerId: 'ST1' }));
  setSavedQuoteStatus(1, 'pending_delivery');
  t.check(pick() === 'done', 'and so is one still waiting to be accepted');

  // Two states it must not invent or overwrite.
  reset(mkQuote({ status: 'preparing', pickingStatus: null, assignedWorkerId: 'ST1' }));
  setSavedQuoteStatus(1, 'pending_delivery');
  t.check(pick() === null, 'an order nobody was picking is not given a finished pick');

  reset(mkQuote({ status: 'preparing', pickingStatus: 'done', assignedWorkerId: 'ST1' }));
  const before = pick();
  setSavedQuoteStatus(1, 'pending_delivery');
  t.check(pick() === before, 'and one already finished is left alone');

  // Only forwards, and only out of Being Prepared.
  reset(mkQuote({ status: 'preparing', pickingStatus: 'in_progress', assignedWorkerId: 'ST1' }));
  setSavedQuoteStatus(1, 'draft');
  t.check(pick() === 'in_progress',
    'moving BACK does not end the pick here -- stepSavedQuoteStatus resets it instead');

  reset(mkQuote({ status: 'draft', pickingStatus: 'awaiting_accept', assignedWorkerId: 'ST1' }));
  setSavedQuoteStatus(1, 'preparing');
  t.check(pick() === 'awaiting_accept',
    'and taking a draft INTO Being Prepared leaves the pick it is about to start');

  // The destination being later is not enough on its own -- the order has to
  // be leaving Being Prepared. A draft sent straight past it never had a
  // pick to finish, so there is nothing to declare over.
  reset(mkQuote({ status: 'draft', pickingStatus: 'awaiting_accept', assignedWorkerId: 'ST1' }));
  setSavedQuoteStatus(1, 'pending_delivery');
  t.check(pick() === 'awaiting_accept',
    'a stage later than Being Prepared does not end a pick the order never started');

  // The state it lands on is the one the worker app treats as finished, so
  // the order stops being listed by either of the two lists it renders.
  const mine = extractFunction(workerSrc, 'renderWorkerView', 'shared-worker.js');
  t.check(/pickingStatus==='awaiting_accept'/.test(mine) && /pickingStatus==='in_progress'/.test(mine)
    && !/pickingStatus==='done'/.test(mine),
    "'done' is neither of the two states that app lists, which is what frees the picker");
}

/* ---------- 3. prepay gate ------------------------------------------- */
const PREPAY = [{ id: 'AG1', paymentTerm: 'prepay' }];
const ONDELIVERY = [{ id: 'AG1', paymentTerm: 'pay_on_delivery' }];
{
  reset(mkQuote({ originAgentId: 'AG1', agentPaymentStatus: 'unpaid', assignedWorkerId: 'ST1' }), PREPAY);
  stepSavedQuoteStatus(1, +1);
  t.check(status() === 'draft' && calls.prompted === 1,
    `an unpaid prepay agent's order can't start being prepared (status ${status()}, prompted ${calls.prompted})`);

  /* Past the payment gate, the step lands on the WORKER-ASSIGNMENT gate,
     which is the board's own: the arrow asks who is picking it before it
     moves. So "cleared the gate" is the prepay prompt not firing and the
     picker being asked instead. */
  reset(mkQuote({ originAgentId: 'AG1', agentPaymentStatus: 'paid' }), PREPAY);
  stepSavedQuoteStatus(1, +1);
  t.check(calls.prompted === null && !!calls.assignAsked,
    'once paid it clears the payment gate and is asked who is picking it');

  reset(mkQuote({ originAgentId: 'AG1', agentPaymentStatus: 'unpaid' }), ONDELIVERY);
  stepSavedQuoteStatus(1, +1);
  t.check(calls.prompted === null && !!calls.assignAsked,
    'a pay-on-delivery agent is never held at this gate');

  reset(mkQuote(), PREPAY);
  stepSavedQuoteStatus(1, +1);
  t.check(calls.prompted === null && !!calls.assignAsked,
    "a shop's own order (no agent) is never held at this gate");
}
{
  // The predicate itself, since shared-worker's autoAssignNextOrder uses it
  // independently of the board arrows.
  reset(mkQuote({ originAgentId: 'AG1', agentPaymentStatus: 'unpaid' }), PREPAY);
  const q = data.savedQuotes[0];
  const blocked = agentPaymentBlocksPreparing(q);
  const paidQ = Object.assign({}, q, { agentPaymentStatus: 'paid' });
  const noAgent = Object.assign({}, q, { originAgentId: null });
  t.check(blocked === true && agentPaymentBlocksPreparing(paidQ) === false
    && agentPaymentBlocksPreparing(noAgent) === false,
    'agentPaymentBlocksPreparing gates on agent + prepay + unpaid, and nothing else');
  // An agent who has since been removed from the roster must not deadlock
  // their old orders on a gate nobody can clear.
  reset(mkQuote({ originAgentId: 'GONE', agentPaymentStatus: 'unpaid' }), PREPAY);
  t.check(agentPaymentBlocksPreparing(data.savedQuotes[0]) === false,
    'an order whose agent is no longer on the roster is not held at the gate');
}

/* ---------- 4. what each forward step asks for ------------------------ */
{
  /* Entering 'preparing' ASKS WHO IS PICKING IT, and holds the move until
     somebody is chosen: openAssignStaffManual writes the worker and calls
     setSavedQuoteStatus itself. The order does not enter the stage on the
     arrow alone, so nothing is in Being Prepared with nobody on it. */
  reset(mkQuote({ status: 'draft' }));
  stepSavedQuoteStatus(1, +1);
  t.check(status() === 'draft' && !!calls.assignAsked,
    `entering Preparing asks who is picking it first (status ${status()})`);
  t.check(calls.assignAsked.toStatus === 'preparing' && calls.assignAsked.role === 'worker',
    'and asks for a picker, for the stage it is moving into');

  /* Shop delivery asks WHO IS CARRYING IT, through the same modal, and
     holds the move until somebody is named -- including "the client is
     sending their own person", which is why the delivery role offers a
     row the picker role does not. */
  reset(mkQuote({ status: 'preparing', deliveryMode: 'shop_delivery' }));
  stepSavedQuoteStatus(1, +1);
  t.check(status() === 'preparing', `shop delivery is not sent out by the arrow alone (status ${status()})`);
  t.check(calls.assignAsked.toStatus === 'pending_delivery' && calls.assignAsked.role === 'delivery',
    'it asks for a driver, for the stage it is moving into');

  // Self-pickup has no carrier to name -- it uses the shared sentinel.
  reset(mkQuote({ status: 'preparing', deliveryMode: 'agent_pickup' }));
  stepSavedQuoteStatus(1, +1);
  t.check(status() === 'pending_delivery' && data.savedQuotes[0].assignedDeliveryId === '__agent__'
    && !calls.toasts.some((m) => /Loaded/.test(m)),
    `agent pickup goes out on the arrow and is marked __agent__ (status ${status()}, assignee ${data.savedQuotes[0].assignedDeliveryId})`);
}

/* ---------- 5. stepping back retires the assignment ------------------- */
{
  reset(mkQuote({ status: 'pending_delivery', assignedWorkerId: 'ST1', assignedDeliveryId: 'ST2',
    carrier: { kind: 'staff', name: 'Kasule', at: 5 } }));
  stepSavedQuoteStatus(1, -1);
  t.check(status() === 'preparing' && data.savedQuotes[0].assignedDeliveryId === null,
    `moving back out of Pending Delivery clears the driver (assignee ${data.savedQuotes[0].assignedDeliveryId})`);
  // And the carrier note with it: an order pulled back inside has not gone
  // out with anybody, so a note saying it did is a false record.
  t.check(data.savedQuotes[0].carrier === null,
    'and the carrier note it went out with, which is no longer true of it');
  stepSavedQuoteStatus(1, -1);
  t.check(status() === 'draft' && data.savedQuotes[0].assignedWorkerId === null,
    `moving back out of Preparing clears the worker (assignee ${data.savedQuotes[0].assignedWorkerId})`);
}

/* ---------- 6. board aging -------------------------------------------- */
{
  const day = 24 * 60 * 60 * 1000;
  const cases = [
    [{ invoiced: false, invoicedTs: Date.now() - 5 * day }, false, 'an uninvoiced order never ages off'],
    [{ invoiced: true, invoicedTs: null }, false, 'an invoiced order with no timestamp stays on'],
    [{ invoiced: true, invoicedTs: Date.now() }, false, 'a just-invoiced order stays on the board'],
    [{ invoiced: true, invoicedTs: Date.now() - 5 * day }, true, 'a long-invoiced order ages off'],
  ];
  let bad = 0;
  cases.forEach(([q, expected, label]) => {
    const got = quoteAgedOffBoard(q);
    if (got !== expected) { bad++; t.fail(`${label} — expected ${expected}, got ${got}`); }
  });
  if (!bad) t.pass('quoteAgedOffBoard hides only orders invoiced long enough ago');
}

/* ---------- 7. the three shared-worker copies still agree ------------- */
/*
 * Moved to test/worker-packaging.test.js, which compares the files whole
 * rather than three named rules. shared-worker.js is the entire worker app,
 * and everything in it outside those three was going unchecked.
 */

process.exit(t.done() ? 1 : 0);
