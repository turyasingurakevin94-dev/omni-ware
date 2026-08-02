#!/usr/bin/env node
'use strict';
/*
 * Order status transitions and delivery routing.
 *
 * The board's forward/back arrows are the only way an order moves, and each
 * step carries a gate: a prepay agent's order can't start being prepared
 * until they've paid, and a step that needs a worker or a driver can't be
 * entered without one -- except a self-pickup agent order, which has no
 * shop driver to assign and uses the '__agent__' sentinel instead.
 *
 * Getting a gate wrong doesn't throw. An order just quietly slips into a
 * stage it shouldn't be in: unpaid stock gets picked, or an order sits in
 * "out for delivery" with nobody delivering it.
 *
 * Separately, shared-worker.js exists in THREE copies -- the root one the
 * web apps load, worker-www/ for the Capacitor build, and the built Android
 * assets. They have already drifted elsewhere (variant images), so the
 * status rules living in all three are checked for agreement here.
 *
 * Run: node test/order-status-delivery.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('order-status/delivery');
const adminSrc = read('index.html');
const workerSrc = read('shared-worker.js');

/* ---------- live state + stubs ---------------------------------------- */
const data = {};
const calls = { prompted: null, assignPicker: null };
function reset(quote, agents) {
  Object.keys(data).forEach((k) => delete data[k]);
  Object.assign(data, { savedQuotes: quote ? [quote] : [], agents: agents || [] });
  calls.prompted = null;
  calls.assignPicker = null;
}

const env = {
  data,
  saveData: () => {},
  renderSavedQuotes: () => {},
  // Both gates divert instead of advancing; recording that is how the tests
  // tell "blocked" apart from "moved".
  promptAgentPrepayment: (q) => { calls.prompted = q.id; },
  openAssignStaffModal: (id, toStatus, role) => { calls.assignPicker = { id, toStatus, role }; },
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
 * A role-gated forward step ALWAYS hands off to the staff picker, even when
 * someone is already assigned -- the picker is the confirmation step, and it
 * calls setSavedQuoteStatus() once a person is chosen. So the walk is driven
 * the way the picker drives it; the gates themselves are checked in 4 below.
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

/* ---------- 3. prepay gate ------------------------------------------- */
const PREPAY = [{ id: 'AG1', paymentTerm: 'prepay' }];
const ONDELIVERY = [{ id: 'AG1', paymentTerm: 'pay_on_delivery' }];
{
  reset(mkQuote({ originAgentId: 'AG1', agentPaymentStatus: 'unpaid', assignedWorkerId: 'ST1' }), PREPAY);
  stepSavedQuoteStatus(1, +1);
  t.check(status() === 'draft' && calls.prompted === 1,
    `an unpaid prepay agent's order can't start being prepared (status ${status()}, prompted ${calls.prompted})`);

  // Past the payment gate, the step lands on the worker-assignment gate --
  // so "proceeded" means the prepay prompt didn't fire and the picker did.
  reset(mkQuote({ originAgentId: 'AG1', agentPaymentStatus: 'paid' }), PREPAY);
  stepSavedQuoteStatus(1, +1);
  t.check(calls.prompted === null && calls.assignPicker && calls.assignPicker.toStatus === 'preparing',
    'once paid it clears the payment gate and moves on to worker assignment');

  reset(mkQuote({ originAgentId: 'AG1', agentPaymentStatus: 'unpaid' }), ONDELIVERY);
  stepSavedQuoteStatus(1, +1);
  t.check(calls.prompted === null && calls.assignPicker !== null,
    'a pay-on-delivery agent is never held at this gate');

  reset(mkQuote(), PREPAY);
  stepSavedQuoteStatus(1, +1);
  t.check(calls.prompted === null && calls.assignPicker !== null,
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

/* ---------- 4. role gates and self-pickup ----------------------------- */
{
  // Entering 'preparing' with no worker assigned must open the picker
  // rather than silently advancing.
  reset(mkQuote({ status: 'draft' }));
  stepSavedQuoteStatus(1, +1);
  t.check(status() === 'draft' && calls.assignPicker && calls.assignPicker.role === 'worker',
    `entering Preparing without a worker opens the picker instead of advancing (status ${status()})`);

  // Shop delivery still needs a driver picked.
  reset(mkQuote({ status: 'preparing', deliveryMode: 'shop_delivery' }));
  stepSavedQuoteStatus(1, +1);
  t.check(status() === 'preparing' && calls.assignPicker && calls.assignPicker.role === 'delivery',
    `shop delivery asks for a driver (status ${status()})`);

  // Self-pickup has no driver to ask for -- it uses the shared sentinel.
  reset(mkQuote({ status: 'preparing', deliveryMode: 'agent_pickup' }));
  stepSavedQuoteStatus(1, +1);
  t.check(status() === 'pending_delivery' && data.savedQuotes[0].assignedDeliveryId === '__agent__'
    && calls.assignPicker === null,
    `agent pickup skips the driver picker and marks it __agent__ (status ${status()}, assignee ${data.savedQuotes[0].assignedDeliveryId})`);
}

/* ---------- 5. stepping back retires the assignment ------------------- */
{
  reset(mkQuote({ status: 'pending_delivery', assignedWorkerId: 'ST1', assignedDeliveryId: 'ST2' }));
  stepSavedQuoteStatus(1, -1);
  t.check(status() === 'preparing' && data.savedQuotes[0].assignedDeliveryId === null,
    `moving back out of Pending Delivery clears the driver (assignee ${data.savedQuotes[0].assignedDeliveryId})`);
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
 * These have already drifted on product-image handling, so agreement can't
 * be assumed. Only the status rules are compared -- that's what this file
 * is about, and it's the part where a difference would mean the Android
 * worker app gating orders differently from the web one.
 */
{
  const norm = (s) => s.replace(/\r/g, '').trim();
  const RULES = ['agentPaymentBlocksPreparing', 'quoteAgedOffBoard', 'autoAssignNextOrder'];

  // worker-www/ is a tracked second copy, so it must agree.
  let drifted = 0;
  RULES.forEach((fn) => {
    const base = norm(extractFunction(workerSrc, fn, 'shared-worker.js'));
    const other = norm(extractFunction(read('worker-www/shared-worker.js'), fn, 'worker-www'));
    if (other !== base) { drifted++; t.fail(`${fn}() differs between shared-worker.js and worker-www/shared-worker.js`); }
  });
  if (!drifted) t.pass(`status rules match between shared-worker.js and worker-www/ (${RULES.length} functions)`);

  /*
   * android/app/src/main/assets/public/ is Capacitor's build output -- git-
   * ignored, regenerated by `npx cap copy android` from worker-www. It won't
   * exist on a fresh clone, so its absence is not a failure; a stale copy
   * present on disk is, since building from it would ship rules that don't
   * match the source.
   */
  const BUILT = 'android/app/src/main/assets/public/shared-worker.js';
  let built = null;
  try { built = read(BUILT); } catch (_e) { /* not built here */ }
  if (built === null) {
    t.pass('android build output not present (nothing to check — run `npx cap copy android` before building)');
  } else {
    const stale = RULES.filter((fn) =>
      norm(extractFunction(built, fn, 'android build output'))
        !== norm(extractFunction(workerSrc, fn, 'shared-worker.js')));
    t.check(stale.length === 0,
      stale.length
        ? `android build output is stale (${stale.join(', ')}) — run \`npx cap copy android\``
        : 'android build output is in step with the source');
  }
}

process.exit(t.done() ? 1 : 0);
