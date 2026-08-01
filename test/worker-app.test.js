#!/usr/bin/env node
'use strict';
/*
 * The worker (pick-and-pack) app.
 *
 * Its defining constraint: it loads once at boot and never refreshes on its
 * own -- setInterval(renderWorkerView, 60000) only redraws what is already
 * in memory. A worker who opens the app in the morning is looking at, and
 * saving from, a morning snapshot all day.
 *
 * That makes "send the whole row back" catastrophic rather than merely
 * untidy: the order row carries amount_paid, payments, client and items, so
 * a stale save reverts every one of them to whenever the app was opened.
 * These checks pin the two halves that stop it -- writing only the fields
 * this app owns, and refusing to move an order that has already moved on.
 *
 * Run: node test/worker-app.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('worker app');
const workerHtml = read('worker.html');
const sharedJs = read('shared-worker.js');

/* ---------- 1. a save writes only what this app owns ------------------ */
{
  const scope = compileScope([
    extractDeclaration(workerHtml, 'WORKER_OWNED_KEYS', 'worker.html'),
    extractFunction(workerHtml, 'mergePickState', 'worker.html'),
    extractFunction(workerHtml, 'mergeOntoServerRows', 'worker.html'),
    'function __ownedKeys(){ return WORKER_OWNED_KEYS.slice(); }',
  ], {
    sb: {
      from: () => ({
        select: () => ({
          eq: () => ({
            in: (_f, ids) => Promise.resolve({
              // What the server holds NOW -- an admin took a 500,000
              // payment after this worker's app last loaded.
              data: ids.map((id) => ({
                id, shop_id: 'shop-1', status: 'preparing', amount_paid: 500000, invoiced: false,
                payload: {
                  client: { name: 'Achen' }, payments: [{ amount: 500000, cashTxnId: 7 }],
                  customerId: 'C001', debtCharged: 0,
                  items: [{ productName: 'Rebar', qty: 2, pickStatus: 'pending' }],
                  assignedWorkerId: 'ST1', pickingStatus: 'in_progress', pickCursor: 0,
                },
              })),
              error: null,
            }),
          }),
        }),
      }),
    },
  }, ['mergePickState', 'mergeOntoServerRows', '__ownedKeys']);

  // What the worker app would send from its stale morning snapshot.
  const stale = [{
    id: 12, shop_id: 'shop-1', status: 'pending_delivery', invoiced: false,
    amount_paid: 0, client_name: 'Achen', date: '2026-08-01',
    payload: {
      client: { name: 'Achen' }, payments: [], customerId: null, debtCharged: 0,
      items: [{ productName: 'Rebar', qty: 2, pickStatus: 'done', pickedQty: 2 }],
      assignedWorkerId: 'ST1', assignedDeliveryId: 'ST2',
      pickingStatus: 'done', pickCursor: 0, workerAcceptedAt: 111, stageEnteredAt: 222,
    },
  }];

  return (async () => {
    const [merged] = await scope.mergeOntoServerRows('shop-1', stale);

    t.check(merged.amount_paid === 500000,
      `a payment taken after this app loaded survives the save (amount_paid ${merged.amount_paid})`);
    t.check(merged.payload.payments.length === 1 && merged.payload.payments[0].amount === 500000,
      'the payment record itself survives too, not just the total');
    t.check(merged.payload.customerId === 'C001',
      'fields this app never touches come back from the server, not from its snapshot');

    t.check(merged.payload.pickingStatus === 'done' && merged.payload.assignedDeliveryId === 'ST2'
      && merged.payload.workerAcceptedAt === 111,
      'the picking fields this app does own are written through');
    t.check(merged.status === 'pending_delivery',
      'the one status move this app makes is written through');
    t.check(merged.payload.items[0].pickStatus === 'done' && merged.payload.items[0].pickedQty === 2,
      'pick state lands on the items');
    t.check(merged.payload.items[0].productName === 'Rebar',
      'the items themselves are the server\'s, with only pick state laid on top');

    /* ---------- 2. an order edited underneath keeps the admin's version -- */
    {
      const serverItems = [{ productName: 'Rebar', qty: 5 }, { productName: 'Wire', qty: 1 }];
      const localItems = [{ productName: 'Rebar', qty: 2, pickStatus: 'done', pickedQty: 2 }];
      // Caught rather than allowed to propagate: without the length check
      // this reads past the end of the shorter list and throws, which would
      // abort the run instead of reporting which invariant broke.
      let out, threw = null;
      try { out = scope.mergePickState(serverItems, localItems); } catch (e) { threw = e.message; }
      t.check(!threw && out === serverItems,
        threw ? `merging a changed item list threw instead of deferring to the server: ${threw}`
              : 'when the admin has changed the item list, their version wins outright');
      t.check(!threw && !out.some((it) => it.pickStatus === 'done'),
        'pick state is not smeared across a changed list by index');
    }
    {
      const serverItems = [{ productName: 'Rebar', qty: 2 }, { productName: 'Wire', qty: 1 }];
      const localItems = [
        { productName: 'Rebar', qty: 2, pickStatus: 'done', pickedQty: 2 },
        { productName: 'Wire', qty: 1, pickStatus: 'pending', pickedQty: null },
      ];
      const out = scope.mergePickState(serverItems, localItems);
      t.check(out[0].pickStatus === 'done' && out[1].pickStatus === 'pending' && out[0].qty === 2,
        'a matching list keeps the server\'s item data and takes the pick state');
    }

    /* ---------- 3. the owned list is the picking fields only ----------- */
    {
      const owned = scope.__ownedKeys();
      const MUST_NOT = ['payments', 'amountPaid', 'client', 'items', 'customerId', 'debtCharged', 'invoiced'];
      const leaked = MUST_NOT.filter((k) => owned.includes(k));
      t.check(leaked.length === 0,
        leaked.length ? `this app claims ownership of ${leaked.join(', ')}` : `the owned list is picking and assignment only (${owned.length} keys)`);
      t.check(owned.includes('pickingStatus') && owned.includes('assignedWorkerId') && owned.includes('assignedDeliveryId'),
        'the fields this app genuinely drives are all in the owned list');
    }

    /* ---------- 4. a save never sends a row it could not re-read ------- */
    {
      const body = extractFunction(workerHtml, 'saveData', 'worker.html');
      t.check(/mergeOntoServerRows\(shopId, changed\)/.test(body),
        'the save merges the rows it is about to send onto the server\'s current version');
      // Anchored on the call, not the name -- the comment above it mentions
      // addDiffOps too, and matching that put the "before" test the wrong
      // way round while still reporting a failure for the right reason.
      const iCatch = body.indexOf('catch');
      const iOps = body.indexOf('addDiffOps(ops,');
      t.check(iCatch > -1 && iOps > iCatch && /return;/.test(body.slice(iCatch, iOps)),
        'a failed re-read aborts the save rather than falling back to sending the stale row');
    }

    /* ---------- 5. an order that has moved on is not dragged back ------ */
    {
      const fin = extractFunction(sharedJs, 'finishPreparingOrder', 'shared-worker.js');
      const iGuard = fin.indexOf("q.status !== 'preparing'");
      const iSet = fin.indexOf("q.status = 'pending_delivery'");
      t.check(iGuard > -1 && iGuard < iSet,
        'finishing a pick checks the order is still being prepared before moving it');
      t.check(iGuard < fin.indexOf("q.pickingStatus = 'done'"),
        'the check happens before anything is mutated, so a stale finish changes nothing');
    }

    /* ---------- 6. backing out of delivery leaves the order visible ---- */
    /*
     * 'done' is neither awaiting_accept nor in_progress, and renderWorkerView
     * builds both of its lists from exactly those two -- so an order left at
     * 'done' vanished from this app while still assigned to the worker,
     * blocked on them, with no way back to it.
     */
    {
      const fin = extractFunction(sharedJs, 'finishPreparingOrder', 'shared-worker.js');
      const backOut = /if\(!deliveryStaffId\)\{([\s\S]*?)\n    \}/.exec(fin);
      t.check(backOut && /q\.pickingStatus = 'in_progress'/.test(backOut[1]),
        'backing out of the delivery picker puts the order back where this app can show it');

      const render = extractFunction(sharedJs, 'renderWorkerView', 'shared-worker.js');
      const shown = (render.match(/pickingStatus==='(\w+)'/g) || []).map((s) => s.split("'")[1]);
      t.check(shown.includes('awaiting_accept') && shown.includes('in_progress') && !shown.includes('done'),
        `the worker's screen only ever shows these picking states: ${shown.join(', ')}`);
    }

    /* ---------- 7. accept/deny only touch this worker's own order ------ */
    /*
     * Both are reachable from a notification tap, and a notification outlives
     * the assignment it was sent for.
     */
    {
      const isMine = compileScope([extractFunction(sharedJs, 'orderIsMine', 'shared-worker.js')], {
        myStaff: { id: 'ST1' },
      }, ['orderIsMine']).orderIsMine;
      t.check(isMine({ assignedWorkerId: 'ST1' }) === true, 'an order assigned to me is mine');
      t.check(isMine({ assignedWorkerId: 'ST2' }) === false,
        'an order reassigned to another worker is not mine');
      t.check(isMine({ assignedWorkerId: null }) === false && isMine(null) === false,
        'an unassigned or missing order is not mine');

      ['acceptOrderAssignment', 'denyOrderAssignment'].forEach((name) => {
        const fn = extractFunction(sharedJs, name, 'shared-worker.js');
        const iCheck = fn.indexOf('orderIsMine');
        const iMutate = Math.min(...['q.pickingStatus =', 'q.assignedWorkerId ='].map((s) => {
          const i = fn.indexOf(s); return i === -1 ? Infinity : i;
        }));
        t.check(iCheck > -1 && iCheck < iMutate,
          `${name} checks the order is still mine before changing it`);
      });
    }

    /* ---------- 8. the APK is built from the copy that ships ----------- */
    /*
     * capacitor.config.json points webDir at worker-www, so that copy IS the
     * shipped app. It had drifted behind the root files by two merged
     * features, which meant work that looked done was not in anyone's hands.
     */
    {
      const wwwShared = read('worker-www/shared-worker.js');
      t.check(wwwShared === sharedJs,
        'worker-www/shared-worker.js matches the root copy the APK is built from');

      const wwwHtml = read('worker-www/index.html');
      // One deliberate difference: the APK loads from a local origin, where
      // an absolute manifest path resolves to nothing.
      const normalised = wwwHtml.replace('href="manifest-worker.json"', 'href="/manifest-worker.json"');
      t.check(normalised === workerHtml,
        'worker-www/index.html matches worker.html apart from the relative manifest path');
      t.check(/href="manifest-worker\.json"/.test(wwwHtml),
        'the shipped copy keeps its relative manifest path');
    }

    process.exit(t.done() ? 1 : 0);
  })();
}
