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
                  // The agent attribution. None of these appear in the
                  // payload the worker app builds, so they only survive by
                  // coming back off the server.
                  originAgentId: 'AG0003', agentClientId: 17,
                  deliveryMode: 'agent_pickup', deliveryAddress: null,
                  agentPaymentStatus: 'paid',
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
    // Read defensively: if the merge stops carrying the server's payload
    // through, this is the first assertion to touch it, and reading straight
    // through would abort the run with a stack trace instead of naming the
    // invariant that broke.
    const pay = (merged.payload || {}).payments;
    t.check(Array.isArray(pay) && pay.length === 1 && pay[0].amount === 500000,
      Array.isArray(pay)
        ? 'the payment record itself survives too, not just the total'
        : 'the merged payload carries no payments array at all — the server payload is not coming through');
    t.check(merged.payload.customerId === 'C001',
      'fields this app never touches come back from the server, not from its snapshot');

    // Named individually because these are the ones that actually got
    // destroyed. buildWorkerSyncRows still builds its payload from an
    // explicit list that omits all five, so before the merge every worker
    // touch on an agent's order stripped them -- and originAgentId is what
    // the RLS policy matches on, so losing it detached the order from its
    // agent entirely and the agent's app simply stopped showing it. Three
    // real orders totalling UGX 1.9m were found in that state.
    const AGENT_FIELDS = ['originAgentId', 'agentClientId', 'deliveryMode', 'deliveryAddress', 'agentPaymentStatus'];
    const carried = await scope.mergeOntoServerRows('shop-1', [{
      id: 12, shop_id: 'shop-1', status: 'pending_delivery', amount_paid: 0,
      payload: { items: [], pickingStatus: 'done' },   // exactly what the worker sends: none of them
    }]);
    const lost = AGENT_FIELDS.filter((k) => carried[0].payload[k] === undefined);
    t.check(lost.length === 0,
      lost.length
        ? `a worker save still strips these from an agent's order: ${lost.join(', ')}`
        : `an agent order keeps all ${AGENT_FIELDS.length} of its agent fields through a worker save`);
    t.check(carried[0].payload.originAgentId === 'AG0003',
      'originAgentId in particular survives — it is what the order policy matches on');

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

    /* ---------- 8. the background refresh ------------------------------ */
    /*
     * Added because merging on save only stopped stale data DESTROYING
     * anything -- the worker was still looking at a screen that could be
     * hours old, with cancelled or reassigned orders still sitting on it.
     *
     * It runs on a worker's phone for a whole shift, so the conditions it
     * declines to run under matter as much as the refresh itself.
     */
    {
      const refresh = extractFunction(workerHtml, 'refreshWorkerData', 'worker.html');

      const iLoad = refresh.indexOf('await loadWorkerData(');
      const iBuild = refresh.indexOf('const freshSynced =');
      const iData = refresh.indexOf('data = fresh');
      const iSynced = refresh.indexOf('lastSynced = freshSynced');
      t.check(iLoad > -1 && iBuild > iLoad && iData > iBuild && iSynced > iBuild,
        'the refresh builds the new snapshot before assigning either half');
      t.check(!/\bdata = await loadWorkerData\(/.test(refresh),
        'the refresh never assigns data straight from the load ahead of the snapshot');

      // Every guard is a reason NOT to spend the worker's battery or data,
      // or not to yank the screen out from under them.
      const guards = [
        [/workerSaveInFlight/, 'it holds off while a save is in flight, so lastSynced is not swapped mid-diff'],
        [/document\.visibilityState === 'hidden'/, 'it does nothing while the app is backgrounded'],
        [/wv-assign-overlay/, 'it holds off while the delivery picker is open'],
        [/lastWorkerInteractionAt < WORKER_QUIET_MS/, 'it holds off just after a touch, so a re-render cannot snap the carousel away mid-scroll'],
        [/workerRefreshing/, 'it will not overlap with itself'],
      ];
      guards.forEach(([re, msg]) => t.check(re.test(refresh), msg));

      // The quiet window has to be escapable, or a worker scrolling steadily
      // would never see an update.
      t.check(/const force = !!\(opts && opts\.force\)/.test(refresh) && /if\(!force\)\{/.test(refresh),
        'a forced refresh bypasses the quiet-period guards');

      // renderWorkerView has to run even when the load threw, or the
      // "Requested X ago" labels freeze the moment the signal drops.
      const iCatch = refresh.indexOf('}catch(err){');
      const iRender = refresh.lastIndexOf('renderWorkerView()');
      const iFinally = refresh.indexOf('}finally{');
      t.check(iCatch > -1 && iFinally > iCatch && iRender > iFinally,
        'the screen redraws after a failed refresh too, so the elapsed labels keep moving offline');
    }
    {
      const start = extractFunction(workerHtml, 'startWorkerPolling', 'worker.html');
      t.check(/setInterval\(refreshWorkerData, WORKER_POLL_MS\)/.test(start),
        'polling is on an interval rather than a chain that a single throw would end');
      t.check(/visibilitychange/.test(start) && /=== 'visible'\) refreshWorkerData\(\)/.test(start),
        'coming back to the foreground refreshes straight away instead of waiting out the interval');

      const ms = extractDeclaration(workerHtml, 'WORKER_POLL_MS', 'worker.html');
      const value = Number((/=\s*(\d+)/.exec(ms) || [])[1]);
      t.check(value >= 30000,
        `the interval is gentle enough for a phone on mobile data (${value}ms)`);
    }
    {
      // The old bare re-render loop must be gone, not left running alongside.
      const boot = extractFunction(workerHtml, 'boot', 'worker.html');
      // Comments stripped first: the note in boot() explaining what this
      // replaced names the old call, and scanning that as code reports it
      // still running when it isn't.
      const code = workerHtml.split(/\r?\n/).map((l) => l.replace(/\/\/.*$/, '')).join('\n');
      t.check(/startWorkerPolling\(\)/.test(boot) && !/setInterval\(renderWorkerView/.test(code),
        'boot starts the refresh, and the old render-only interval is not still running beside it');
    }
    {
      // saveData has to actually set the flag the refresh checks, in a
      // finally -- an early return leaving it stuck true would silently
      // stop every future refresh.
      const save = extractFunction(workerHtml, 'saveData', 'worker.html');
      t.check(/workerSaveInFlight = true;/.test(save) && /finally\s*\{[\s\S]*workerSaveInFlight = false;/.test(save),
        'the in-flight flag is cleared in a finally, so an early return cannot wedge the refresh off');
    }
    {
      // The notification path does its own load; it has the same ordering
      // hazard and the same catch-and-carry-on shape.
      const route = extractFunction(sharedJs, 'routeNotificationAction', 'shared-worker.js');
      const iBuild = route.indexOf('const freshSynced =');
      const iData = route.indexOf('data = fresh');
      t.check(iBuild > -1 && iData > iBuild,
        'a notification tap also builds the snapshot before assigning data');
    }

    /* ---------- 9. the APK is built from the copy that ships ----------- */
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
