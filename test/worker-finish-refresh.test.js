#!/usr/bin/env node
'use strict';
/*
 * Finishing a pick has to survive a refresh landing in the middle of it.
 *
 * finishPreparingOrder awaits twice -- a save, then the delivery picker,
 * which sits open for as long as the worker takes to choose. A background
 * refresh assigns `data` a whole new object, so the order captured at the
 * top of the function belongs to a snapshot nothing saves any more. Writes
 * to it went nowhere:
 *
 *     q.assignedDeliveryId = deliveryStaffId;   // into the discarded copy
 *     q.status = 'pending_delivery';            // into the discarded copy
 *     await saveData();                         // saves the new one, unchanged
 *
 * The worker tapped "Mark as finished", chose a delivery person, and the
 * order stayed sitting in Being Prepared. The pick they had just completed
 * came back needing doing again, and nothing anywhere said why.
 *
 * The standalone worker app holds refreshes off while the picker is up, by
 * looking for its overlay class. The admin app hosts the same view and
 * looked only for its own '.modal-overlay.show', so there the refresh ran
 * straight through the decision it was asking about. Both halves are fixed;
 * this file covers the one that does not depend on which app is hosting.
 *
 * Run: node test/worker-finish-refresh.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('worker finish refresh');
const sharedJs = read('shared-worker.js');
const indexHtml = read('index.html');

const seen = { toasts: [], saves: 0, autoAssigned: null };

const order = (over) => Object.assign({
  id: 900,
  client: { name: 'Moses' },
  status: 'preparing',
  assignedWorkerId: 'ST1',
  assignedDeliveryId: null,
  pickingStatus: 'done',
  deliveryMode: 'shop_delivery',
  stageEnteredAt: 111,
  items: [{ productId: 'P001', qty: 5, pickStatus: 'done', pickedQty: 5 }],
}, over || {});

// What the picker does while it is open, and what happens during a save.
// Both are awaits a refresh can land in. Set per case.
let onPicker = async () => 'ST9';
let onSave = null;

const scope = compileScope([
  // finishPreparingOrder gates on every line being ANSWERED, not on every
  // line being 'done' -- a recorded shortfall finishes too. See
  // test/worker-short-pick.test.js.
  extractDeclaration(sharedJs, 'PICK_ANSWERED', 'shared-worker.js'),
  extractFunction(sharedJs, 'itemPickAnswered', 'shared-worker.js'),
  extractFunction(sharedJs, 'finishPreparingOrder', 'shared-worker.js'),
  // Lets a case replace `data` the way a background refresh does -- from
  // inside the compiled scope, which is the only place the binding lives.
  'function __setData(d){ data = d; }',
  'function __getData(){ return data; }',
], {
  data: { savedQuotes: [order()] },
  saveData: async () => { seen.saves++; if (onSave) onSave(seen.saves); },
  toast: (m) => { seen.toasts.push(m); },
  renderWorkerView: () => {},
  refreshAdminOrderBoardIfOpen: () => {},
  autoAssignNextOrder: (id) => { seen.autoAssigned = id; },
  promptAssignDelivery: () => onPicker(),
}, ['finishPreparingOrder', '__setData', '__getData']);

const load = (over) => {
  seen.toasts = []; seen.saves = 0; seen.autoAssigned = null;
  onSave = null;
  const fresh = { savedQuotes: [order(over)] };
  scope.__setData(fresh);
  return fresh.savedQuotes[0];
};
// A refresh: a brand-new object graph, as loadWorkerData returns.
const refreshTo = (over) => {
  const fresh = { savedQuotes: [order(over)] };
  scope.__setData(fresh);
  return fresh.savedQuotes[0];
};

(async () => {

/* ---------- 1. a refresh mid-picker does not swallow the finish ------- */
{
  load();
  let live = null;
  onPicker = async () => { live = refreshTo(); return 'ST9'; };
  await scope.finishPreparingOrder(900);

  t.check(live.status === 'pending_delivery', 'the finish lands on the order the app is actually holding');
  t.check(live.assignedDeliveryId === 'ST9', 'and so does the delivery person the worker chose');
  t.check(live.pickingStatus === 'done', 'the completed pick is not lost back to being unfinished');
  t.check(seen.autoAssigned === 'ST1', 'the worker is still handed their next order');
}

/* ---------- 1b. ...nor one landing during the save before it ---------- */
{
  // The other await. The pick state is saved before the picker opens, and a
  // refresh can land in that gap just as easily.
  load();
  let live = null;
  onSave = (n) => { if (n === 1) live = refreshTo(); };
  onPicker = async () => 'ST9';
  await scope.finishPreparingOrder(900);

  t.check(live.status === 'pending_delivery', 'a refresh during the first save does not swallow the finish either');
  t.check(live.assignedDeliveryId === 'ST9', 'the delivery person still lands on the live order');
}

/* ---------- 2. backing out after a refresh still leaves it visible ---- */
{
  load();
  let live = null;
  onPicker = async () => { live = refreshTo(); return null; };
  await scope.finishPreparingOrder(900);

  t.check(live.pickingStatus === 'in_progress',
    'backing out puts the live order back where the worker can still see it');
  t.check(live.status === 'preparing', 'and leaves it in Being Prepared');
  t.check(seen.autoAssigned === null, 'nobody is handed a next order on a back-out');
}

/* ---------- 3. the order disappearing is said out loud ---------------- */
{
  load();
  onPicker = async () => { scope.__setData({ savedQuotes: [] }); return 'ST9'; };
  let threw = false;
  try { await scope.finishPreparingOrder(900); } catch (e) { threw = true; }

  t.check(!threw, 'an order that has gone entirely does not throw');
  t.check(/no longer here/.test(seen.toasts.join(' ')),
    'the worker is told rather than left tapping a button that does nothing');
  t.check(seen.autoAssigned === null, 'and nothing is assigned off the back of it');
}

/* ---------- 4. with no refresh at all, nothing changes ---------------- */
{
  const q = load();
  onPicker = async () => 'ST9';
  await scope.finishPreparingOrder(900);

  t.check(q.status === 'pending_delivery' && q.assignedDeliveryId === 'ST9',
    'the ordinary path is untouched');
  t.check(q.stageEnteredAt !== 111, 'the stage stamp moves with the order');
  t.check(seen.saves === 2, 'and it still saves exactly twice');
}

/* ---------- 5. an agent collecting their own order skips the picker --- */
{
  const q = load({ deliveryMode: 'agent_pickup' });
  let pickerOpened = false;
  onPicker = async () => { pickerOpened = true; return 'ST9'; };
  await scope.finishPreparingOrder(900);

  t.check(!pickerOpened, 'no delivery picker for an order the agent collects themselves');
  t.check(q.assignedDeliveryId === '__agent__', 'it uses the agent sentinel');
  t.check(q.status === 'pending_delivery', 'and still moves on');
}
{
  // ...which is the one path with no picker to re-resolve after, so the save
  // before it is the only await left and the only chance to notice.
  load({ deliveryMode: 'agent_pickup' });
  let live = null;
  onSave = (n) => { if (n === 1) live = refreshTo({ deliveryMode: 'agent_pickup' }); };
  await scope.finishPreparingOrder(900);

  t.check(live.status === 'pending_delivery',
    'a refresh during the save still does not swallow an agent-pickup finish');
  t.check(live.assignedDeliveryId === '__agent__', 'and the sentinel lands on the live order');
}

/* ---------- 6. the guards before the picker still hold ---------------- */
{
  const moved = load({ status: 'completed' });
  onPicker = async () => 'ST9';
  await scope.finishPreparingOrder(900);
  t.check(moved.status === 'completed', 'an order that has already moved on is not dragged back');

  const unpicked = load({ items: [{ productId: 'P001', qty: 5, pickStatus: 'pending' }] });
  await scope.finishPreparingOrder(900);
  t.check(unpicked.status === 'preparing', 'an order with an unpicked item cannot be finished');
}

/* ---------- 7. the admin app holds off while the picker is up --------- */
{
  // The other half of the fix. promptAssignDelivery classes its overlay so a
  // refresh can see it; the standalone app looks for that class, and the
  // admin app hosting the same view now does too.
  t.check(/el\.className = 'wv-assign-overlay';/.test(sharedJs),
    'the delivery picker still carries the class the guards look for');
  t.check(/document\.querySelector\('\.wv-assign-overlay'\)/.test(indexHtml),
    "the admin app's background poll holds off for it");
  t.check(/document\.querySelector\('\.wv-assign-overlay'\)/.test(read('worker.html')),
    'as the standalone worker app already did');
}

process.exit(t.done() ? 1 : 0);
})();
