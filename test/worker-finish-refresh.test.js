#!/usr/bin/env node
'use strict';
/*
 * Finishing a pick, and the window that used to sit inside it.
 *
 * finishPreparingOrder used to await twice -- a save, then the delivery
 * picker, which stayed open for as long as the worker took to choose. A
 * background refresh assigns `data` a whole new object, so the order
 * captured at the top belonged to a snapshot nothing saved any more:
 *
 *     q.assignedDeliveryId = deliveryStaffId;   // into the discarded copy
 *     q.status = 'pending_delivery';            // into the discarded copy
 *     await saveData();                         // saves the new one, unchanged
 *
 * The worker tapped "Mark as finished", chose a delivery person, and the
 * order stayed in Being Prepared. The pick came back needing doing again.
 *
 * Worse, the order was 'done' but still in Being Prepared for the whole of
 * that window, and renderWorkerView builds its lists from awaiting_accept
 * and in_progress only -- so it was on nobody's screen at all while it sat
 * there, and backing out of the picker needed its own un-finish path to
 * escape.
 *
 * Choosing a driver is the admin's job now. With nothing to do between the
 * two writes there are not two: every field is set, then one save. The
 * window is not defended against, it does not exist -- which is what this
 * file checks, because "there is no window" is a claim that rots quietly
 * the moment somebody puts an await back.
 *
 * Run: node test/worker-finish-refresh.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('worker finish refresh');
const sharedJs = read('shared-worker.js');
const indexHtml = read('index.html');

const seen = { toasts: [], saves: 0, autoAssigned: null };
let onSave = null;

const order = (over) => Object.assign({
  id: 900,
  client: { name: 'Moses' },
  status: 'preparing',
  assignedWorkerId: 'ST1',
  assignedDeliveryId: null,
  pickingStatus: 'in_progress',
  deliveryMode: 'shop_delivery',
  stageEnteredAt: 111,
  items: [{ productId: 'P001', qty: 5, pickStatus: 'done', pickedQty: 5 }],
}, over);

const scope = compileScope([
  extractDeclaration(sharedJs, 'PICK_ANSWERED', 'shared-worker.js'),
  extractFunction(sharedJs, 'itemPickAnswered', 'shared-worker.js'),
  extractFunction(sharedJs, 'finishPreparingOrder', 'shared-worker.js'),
  // Lets a case replace `data` the way a background refresh does -- from
  // inside the compiled scope, which is the only place the binding lives.
  'function __setData(d){ data = d; }',
], {
  data: { savedQuotes: [order()] },
  saveData: async () => { seen.saves++; if (onSave) onSave(seen.saves); },
  toast: (m) => { seen.toasts.push(m); },
  renderWorkerView: () => {},
  refreshAdminOrderBoardIfOpen: () => {},
  autoAssignNextOrder: (id) => { seen.autoAssigned = id; },
}, ['finishPreparingOrder', '__setData']);

const load = (over) => {
  seen.toasts = []; seen.saves = 0; seen.autoAssigned = null;
  onSave = null;
  const fresh = { savedQuotes: [order(over)] };
  scope.__setData(fresh);
  return fresh.savedQuotes[0];
};

(async () => {

/* ---------- 1. there is no window to land in -------------------------- */
/*
 * Structural, because that is what the claim actually is. Driving it can
 * only fail to find a window; it cannot show there is none.
 */
{
  const fin = extractFunction(sharedJs, 'finishPreparingOrder', 'shared-worker.js');
  const body = fin.split(/\r?\n/).map((l) => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');

  const awaits = (body.match(/await\s/g) || []).length;
  t.check(awaits === 1, `finishing awaits exactly once (found ${awaits})`);
  t.check((body.match(/await saveData\(\)/g) || []).length === 1, 'and that one await is the save');

  const saveAt = body.indexOf('await saveData()');
  ["pickingStatus = 'done'", "status = 'pending_delivery'", 'assignedDeliveryId =', 'stageEnteredAt ='].forEach((frag) => {
    const at = body.indexOf(frag);
    t.check(at > -1 && at < saveAt, `\`${frag}\` is set before the save, not after it`);
  });

  t.check(!/promptAssignDelivery/.test(body),
    "no delivery picker sits in the middle of it -- choosing a driver is the admin's job");
  t.check(!/reresolve/.test(body),
    'and nothing needs re-resolving against a replaced snapshot, because nothing can replace it mid-flow');
  t.check(!/promptAssignDelivery/.test(sharedJs),
    'the picker is gone from the file rather than left sitting there unused, where it would drift from the admin\'s own');
}

/* ---------- 2. the ordinary finish ------------------------------------ */
{
  const q = load();
  await scope.finishPreparingOrder(900);

  t.check(q.status === 'pending_delivery', 'the order moves to Pending Delivery');
  t.check(q.pickingStatus === 'done', 'the pick is recorded as finished');
  t.check(q.assignedDeliveryId === null,
    'with no driver on it -- the admin board is what asks, via orderNeedsDelivery');
  t.check(q.stageEnteredAt !== 111, 'the stage stamp moves with it');
  t.check(seen.saves === 1, 'and it saves exactly once');
  t.check(seen.autoAssigned === 'ST1', 'the worker is handed their next order');
}

/* ---------- 3. a refresh during the save cannot undo it --------------- */
{
  // The one remaining await. By the time it runs every field is already set
  // and on its way, so a refresh landing here replaces what the app holds
  // without touching what was sent.
  const q = load();
  onSave = () => { scope.__setData({ savedQuotes: [order()] }); };
  await scope.finishPreparingOrder(900);

  t.check(q.status === 'pending_delivery' && q.pickingStatus === 'done',
    'the finish was applied before the save, so a refresh during it changes nothing about what was written');
  t.check(seen.saves === 1, 'and does not cause a second save');
}

/* ---------- 4. an agent collecting their own order -------------------- */
{
  const q = load({ deliveryMode: 'agent_pickup' });
  await scope.finishPreparingOrder(900);

  t.check(q.assignedDeliveryId === '__agent__',
    'a self-pickup order is settled with the agent sentinel, not left looking undelivered');
  t.check(q.status === 'pending_delivery', 'and still moves on');

  // Which matters because of how the admin board reads it: without the
  // sentinel every self-pickup order would carry a "Nobody delivering"
  // alarm for the rest of its life, and an alarm that is always on is one
  // nobody reads.
  const needs = extractFunction(indexHtml, 'orderNeedsDelivery', 'index.html');
  /* Read through the set rather than off the '__agent__' literal: a
     second self-carrier joined it (the client sending their own person),
     and what this test cares about is that the sentinel is treated as
     settled, not which sentinel it is. */
  t.check(/if\(deliveryIsSelfCarried\(q\)\) return false;/.test(needs),
    'the admin board reads the sentinel as settled rather than missing');
  t.check(/__agent__:/.test(indexHtml.slice(indexHtml.indexOf('DELIVERY_SELF_CARRIERS'), indexHtml.indexOf('DELIVERY_SELF_CARRIERS') + 220)),
    'and the agent sentinel this file writes is one of the set it is read through');
  t.check(/if\(!q\.assignedDeliveryId\) return true/.test(needs),
    'while a shop-delivery order with nobody on it is exactly what it asks about');
}

/* ---------- 5. the guards before it still hold ------------------------ */
{
  const moved = load({ status: 'completed' });
  await scope.finishPreparingOrder(900);
  t.check(moved.status === 'completed', 'an order that has already moved on is not dragged back');
  t.check(/already moved on/.test(seen.toasts.join(' ')), 'and the worker is told why nothing happened');

  const unpicked = load({ items: [{ productId: 'P001', qty: 5, pickStatus: 'pending' }] });
  await scope.finishPreparingOrder(900);
  t.check(unpicked.status === 'preparing', 'an order with an unpicked item cannot be finished');

  load();
  scope.__setData({ savedQuotes: [] });
  let threw = false;
  try { await scope.finishPreparingOrder(900); } catch (e) { threw = true; }
  t.check(!threw, 'an order that is gone entirely does not throw');
  t.check(seen.autoAssigned === null, 'and nothing is assigned off the back of it');
}

/* ---------- 6. the refresh hold-off is still load-bearing ------------- */
{
  // The picker is gone, but the class it shared with the short-pick
  // quantity prompt is not -- that prompt is still a decision built at call
  // time by shared-worker.js, and a refresh through it would replace the
  // order it is asking about.
  t.check(/el\.className = 'wv-assign-overlay wv-qty-overlay';/.test(sharedJs),
    'the short-pick quantity prompt still carries the class the guards look for');
  t.check(/document\.querySelector\('\.wv-assign-overlay'\)/.test(indexHtml),
    "the admin app's background poll holds off for it");
  t.check(/document\.querySelector\('\.wv-assign-overlay'\)/.test(read('worker.html')),
    'as the standalone worker app already did');
}

process.exit(t.done() ? 1 : 0);
})();
