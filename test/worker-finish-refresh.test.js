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
 * Choosing a driver is nobody's job at this moment now, because finishing
 * a pick is no longer the moment anything leaves. A finished pick means
 * PACKED: pickingStatus 'done', stamped with pickingDoneAt, still in
 * Preparing, because hired transport arrives later than the picker
 * finishes and "out for delivery" said of goods on the floor is a lie the
 * board used to tell. The order goes out on its own tap -- "Loaded, it
 * has gone", carrying who is carrying it (loadOrder).
 *
 * So there is even less between the writes than before: every field is
 * set, then one save. The window is not defended against, it does not
 * exist -- which is what this file checks, because "there is no window"
 * is a claim that rots quietly the moment somebody puts an await back.
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
  extractDeclaration(sharedJs, 'CARRIER_KINDS', 'shared-worker.js'),
  extractFunction(sharedJs, 'itemPickAnswered', 'shared-worker.js'),
  extractFunction(sharedJs, 'carrierKindsFor', 'shared-worker.js'),
  extractFunction(sharedJs, 'staffEligibleForRole', 'shared-worker.js'),
  extractFunction(sharedJs, 'staffName', 'shared-worker.js'),
  extractFunction(sharedJs, 'loadOrder', 'shared-worker.js'),
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
  // The status move belongs to the admin app where there is one; in the
  // worker app loadOrder writes it directly. Stubbed as the collaborator
  // it is, so this file measures what loadOrder itself decides.
  setSavedQuoteStatus: undefined,
  myStaff: { id: 'ST1', name: 'Brian' },
  document: undefined,
}, ['finishPreparingOrder', 'loadOrder', 'carrierKindsFor', '__setData']);

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
  ["pickingStatus = 'done'", 'pickingDoneAt ='].forEach((frag) => {
    const at = body.indexOf(frag);
    t.check(at > -1 && at < saveAt, `\`${frag}\` is set before the save, not after it`);
  });
  // And what it must NOT do. Finishing reports a pick; it does not send
  // goods out of the building, and it does not name a carrier.
  t.check(!/status = 'pending_delivery'/.test(body) && !/assignedDeliveryId/.test(body),
    'finishing changes no status and names no carrier — packed is a state inside Preparing');

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

  t.check(q.status === 'preparing', 'the order stays in Preparing — packed is a state inside it');
  t.check(q.pickingStatus === 'done', 'the pick is recorded as finished');
  t.check(typeof q.pickingDoneAt === 'number', 'and stamped, which is what "packed 20 m ago" reads');
  t.check(q.assignedDeliveryId === null, 'with no carrier on it: nothing has been loaded yet');
  t.check(q.stageEnteredAt === 111, 'the stage stamp does not move, because the stage did not');
  t.check(seen.saves === 1, 'and it saves exactly once');
  t.check(seen.autoAssigned === 'ST1',
    'the worker is handed their next order at this moment, not when the transport turns up');
}

/* ---------- 2b. and then it is loaded ---------------------------------- */
/*
 * The second tap, and the one that is actually about the goods leaving.
 * It carries who is carrying it, which the app had no field for at all
 * before: assignedDeliveryId was a staff id or a sentinel and that was the
 * whole model, so "Kasule, Fuso UAX 123K, 0772…" had nowhere to live.
 */
{
  const q = load({ pickingStatus: 'done', pickingDoneAt: 90 });
  const ok = scope.loadOrder(900, { kind: 'hired', name: 'Kasule', what: 'Fuso UAX 123K', phone: '0772000111', by: 'Brian' });

  t.check(ok === true && q.status === 'pending_delivery', 'loading it is what sends it out for delivery');
  t.check(q.assignedDeliveryId === '__carrier__',
    'hired transport is its own carrier, not a staff member and not nobody');
  t.check(q.carrier && q.carrier.name === 'Kasule' && q.carrier.what === 'Fuso UAX 123K' && q.carrier.phone === '0772000111',
    'and the note carries the name, the vehicle and the phone the shop rings');
  t.check(q.carrier.at && q.carrier.by === 'Brian', 'stamped with when, and who said so');
  t.check(q.stageEnteredAt !== 111, 'the stage stamp moves with the stage this time');

  // Nothing goes out unnamed.
  const bare = load({ pickingStatus: 'done' });
  t.check(scope.loadOrder(900, { kind: 'hired', name: '   ' }) === false && bare.status === 'preparing',
    'hired transport with no name is refused — "somebody took it" is not a record');
  t.check(/Name the transport/.test(seen.toasts.join(' ')), 'and the refusal says what is missing');
}

/* ---------- 3. a refresh during the save cannot undo it --------------- */
{
  // The one remaining await. By the time it runs every field is already set
  // and on its way, so a refresh landing here replaces what the app holds
  // without touching what was sent.
  const q = load();
  onSave = () => { scope.__setData({ savedQuotes: [order()] }); };
  await scope.finishPreparingOrder(900);

  t.check(q.pickingStatus === 'done' && typeof q.pickingDoneAt === 'number',
    'the finish was applied before the save, so a refresh during it changes nothing about what was written');
  t.check(seen.saves === 1, 'and does not cause a second save');
}

/* ---------- 4. an agent collecting their own order -------------------- */
{
  const q = load({ deliveryMode: 'agent_pickup', pickingStatus: 'done' });
  scope.loadOrder(900, { kind: 'agent' });

  t.check(q.assignedDeliveryId === '__agent__',
    'a self-pickup order is settled with the agent sentinel, not left looking undelivered');
  t.check(q.status === 'pending_delivery', 'and moves on when the agent takes it');
  // The kind is offered only where it means something.
  t.check(scope.carrierKindsFor({ deliveryMode: 'agent_pickup' }).includes('agent')
    && !scope.carrierKindsFor({ deliveryMode: 'shop_delivery' }).includes('agent'),
    "and 'the agent, collecting it' is only asked about an agent's own pickup");

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
  const gone = load({ status: 'completed', pickingStatus: 'done' });
  t.check(scope.loadOrder(900, { kind: 'client' }) === false && gone.status === 'completed',
    'and neither is one somebody tries to load after it was delivered');
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
