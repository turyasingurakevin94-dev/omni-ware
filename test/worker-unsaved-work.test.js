#!/usr/bin/env node
'use strict';
/*
 * A refresh must not throw away work that has not been saved.
 *
 * refreshWorkerData replaces `data` wholesale. A save that failed -- the
 * ordinary outcome on a warehouse connection -- leaves the tick on screen
 * and a toast that fades in five seconds, and the next successful poll then
 * quietly put the item back to unpicked. The quiet period is 4s and the poll
 * is 60s, so the toast is long gone by the time the work disappears. The
 * worker has already taken the goods off the shelf.
 *
 * The guard is "is there anything here the server has not got", and getting
 * that comparison right is the whole difficulty. Two versions of it were
 * wrong in a way that would have been worse than the bug:
 *
 *   whole rows      saveData commits the MERGED row -- the server's columns
 *                   with this app's fields laid on. Once an admin takes a
 *                   payment, lastSynced carries the new amount_paid while
 *                   `data` holds the old, and the rows never match again.
 *
 *   null vs absent  buildWorkerSyncRows writes `q.workerAcceptedAt || null`;
 *                   an order in memory simply has no such property. null
 *                   against undefined made every row look unsaved.
 *
 * Either would have held every refresh off for good -- an app that never
 * sees another order, which is worse than one that occasionally loses a
 * tick. Both are covered below.
 *
 * Run: node test/worker-unsaved-work.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, createReporter } = require('./_extract');

const t = createReporter('worker unsaved work');
const workerHtml = read('worker.html');

const LINE = () => ({ productId: 'P1', productName: 'Cement', qty: 5, pickStatus: 'pending', pickedQty: null });
const SERVER_ROW = () => ({
  id: 900, shop_id: 'shop-1', status: 'preparing', amount_paid: 0, invoiced: false,
  voided: false, date: '2026-08-03',
  payload: {
    client: { name: 'Moses' }, payments: [], items: [LINE()],
    assignedWorkerId: 'ST1', pickingStatus: 'in_progress', pickCursor: 0,
    pickingAssignedAt: null, workerAcceptedAt: null,
  },
});

function build({ saveFails, serverPayment }) {
  const seen = [];
  // What the app believes it has committed. Shared by the addDiffOps stub
  // and handed to the compiled scope as its lastSynced.
  const LS = { savedQuotes: { 900: SERVER_ROW() } };
  let SERVER = SERVER_ROW();
  if (serverPayment) SERVER.amount_paid = 500000;   // an admin took money since boot

  const sb = {
    from: () => ({
      select: () => ({ eq: () => ({ in: () => Promise.resolve({ data: [JSON.parse(JSON.stringify(SERVER))], error: null }) }) }),
      upsert: (rows) => {
        seen.push('upsert');
        if (saveFails) return Promise.resolve({ error: { message: 'offline' } });
        SERVER = JSON.parse(JSON.stringify(rows[0]));
        return Promise.resolve({});
      },
      delete: () => ({ eq: () => ({ in: () => Promise.resolve({}) }) }),
    }),
  };

  const scope = (new Function('sb', 'document', 'console', 'toast', 'addDiffOps', 'cloneJSON',
    'keyRowsById', 'loadWorkerData', 'renderWorkerView', 'LS', `
    let data = null, lastSynced = LS, currentShopId = 'shop-1', currentUser = { id: 'U1' }, myStaff = null;
    let workerRefreshing = false, workerSaveInFlight = false, lastWorkerInteractionAt = 0;
    const WORKER_QUIET_MS = 0;
    ${extractDeclaration(workerHtml, 'WORKER_OWNED_KEYS', 'worker.html')}
    ${extractDeclaration(workerHtml, 'WORKER_STATUS_MOVES', 'worker.html')}
    ${extractFunction(workerHtml, 'buildWorkerSyncRows', 'worker.html')}
    ${extractFunction(workerHtml, 'mergePickState', 'worker.html')}
    ${extractFunction(workerHtml, 'mergeOntoServerRows', 'worker.html')}
    ${extractFunction(workerHtml, 'saveData', 'worker.html')}
    ${extractFunction(workerHtml, 'hasUnsavedWork', 'worker.html')}
    ${extractFunction(workerHtml, 'refreshWorkerData', 'worker.html')}
    return { saveData, refreshWorkerData, unsaved: () => hasUnsavedWork(),
      setData: (d) => { data = d; },
      pick: () => data.savedQuotes[0].items[0].pickStatus };
  `))(
    sb,
    { visibilityState: 'visible', querySelector: () => null },
    { error: () => {} },
    () => seen.push('toast'),
    (ops, key, table, idField, shopId, rows) => {
      const prev = LS[key] || (LS[key] = {});
      const up = rows.filter((r) => JSON.stringify(r) !== JSON.stringify(prev[String(r[idField])]));
      if (up.length) {
        ops.push({
          run: () => sb.from(table).upsert(up),
          commit: () => up.forEach((r) => { prev[String(r[idField])] = JSON.parse(JSON.stringify(r)); }),
        });
      }
    },
    (x) => (x === undefined ? x : JSON.parse(JSON.stringify(x))),
    (rows, f) => { const m = {}; rows.forEach((r) => { m[String(r[f])] = JSON.parse(JSON.stringify(r)); }); return m; },
    async () => {
      seen.push('reloaded');
      const r = JSON.parse(JSON.stringify(SERVER));
      return { staff: [], savedQuotes: [{ id: r.id, status: r.status, invoiced: r.invoiced, voided: r.voided, date: r.date, amountPaid: r.amount_paid, ...r.payload }] };
    },
    () => seen.push('render'),
    LS,
  );

  const local = (over) => ({
    staff: [], savedQuotes: [Object.assign({
      id: 900, status: 'preparing', invoiced: false, voided: false, date: '2026-08-03',
      client: { name: 'Moses' }, payments: [], items: [LINE()],
      assignedWorkerId: 'ST1', pickingStatus: 'in_progress', pickCursor: 0,
    }, over || {})],
  });
  return { scope, seen, local };
}

(async () => {

/* ---------- 1. a failed save is not thrown away by the next refresh --- */
{
  const { scope, seen, local } = build({ saveFails: true });
  const d = local();
  d.savedQuotes[0].items[0].pickStatus = 'done';
  d.savedQuotes[0].items[0].pickedQty = 5;
  scope.setData(d);

  await scope.saveData();
  t.check(scope.pick() === 'done', 'the tick is on screen after the save fails');
  t.check(scope.unsaved() === true, 'and the app knows it never reached the server');
  t.check(seen.includes('toast'), 'the worker is told at the time');

  await scope.refreshWorkerData();
  t.check(scope.pick() === 'done', 'and the refresh leaves it alone rather than reverting it');
  t.check(!seen.includes('reloaded'),
    'the reload is skipped entirely -- local work outranks a minute of staleness');
  t.check(seen.filter((s) => s === 'upsert').length === 2,
    'and the save is retried instead, so it lands as soon as there is signal');
}

/* ---------- 2. once it lands, refreshing resumes ---------------------- */
{
  const { scope, seen, local } = build({ saveFails: false });
  const d = local();
  d.savedQuotes[0].items[0].pickStatus = 'done';
  d.savedQuotes[0].items[0].pickedQty = 5;
  scope.setData(d);

  await scope.saveData();
  t.check(scope.unsaved() === false, 'a save that lands leaves nothing outstanding');

  await scope.refreshWorkerData();
  t.check(seen.includes('reloaded'), 'so the refresh runs as normal');
  t.check(scope.pick() === 'done', 'and the server agrees about the tick');
}

/* ---------- 3. the trap: it must not hold refreshes off for good ------ */
/*
 * The first version compared whole rows. saveData commits the MERGED row, so
 * an admin taking a payment left lastSynced carrying an amount_paid the local
 * order would never have -- permanently "unsaved", refreshing never again.
 */
{
  const { scope, seen, local } = build({ saveFails: false, serverPayment: true });
  scope.setData(local());            // nothing picked; nothing of ours to send

  t.check(scope.unsaved() === false,
    'money taken by an admin since boot is not this app\'s unsaved work');
  await scope.refreshWorkerData();
  t.check(seen.includes('reloaded'), 'so the refresh is not blocked by it');
}

/* ---------- 4. the other trap: null against absent -------------------- */
/*
 * buildWorkerSyncRows writes `q.workerAcceptedAt || null`; an order in memory
 * has no such property until something sets one. Comparing the two directly
 * made every row look unsaved, with the same permanent result.
 */
{
  const { scope } = build({ saveFails: false });
  const bare = {
    staff: [], savedQuotes: [{
      id: 900, status: 'preparing', invoiced: false, voided: false, date: '2026-08-03',
      client: { name: 'Moses' }, payments: [], items: [LINE()],
      assignedWorkerId: 'ST1', pickingStatus: 'in_progress', pickCursor: 0,
      // pickingAssignedAt / workerAcceptedAt / stageEnteredAt deliberately absent
    }],
  };
  scope.setData(bare);
  t.check(scope.unsaved() === false,
    'an order whose optional picking timestamps are simply absent is not unsaved work');

  const fn = extractFunction(workerHtml, 'hasUnsavedWork', 'worker.html');
  t.check(/JSON\.stringify\(wp\[k\] \?\? null\) !== JSON\.stringify\(q\[k\] \?\? null\)/.test(fn),
    'because both sides are normalised before they are compared');
}

/* ---------- 5. real changes are still noticed ------------------------- */
{
  const { scope, local } = build({ saveFails: false });
  const cases = [
    ['a ticked line', (d) => { d.savedQuotes[0].items[0].pickStatus = 'done'; }],
    ['a recorded shortfall', (d) => { d.savedQuotes[0].items[0].pickStatus = 'short'; d.savedQuotes[0].items[0].pickedQty = 3; }],
    ['an accepted order', (d) => { d.savedQuotes[0].pickingStatus = 'in_progress'; d.savedQuotes[0].workerAcceptedAt = 123; }],
    ['a declined one', (d) => { d.savedQuotes[0].assignedWorkerId = null; d.savedQuotes[0].pickingStatus = null; }],
    ['a finished pick', (d) => { d.savedQuotes[0].status = 'pending_delivery'; d.savedQuotes[0].pickingStatus = 'done'; }],
    // Status on its own, so the status comparison is the only thing that can
    // notice it -- the case above moves pickingStatus too and would pass
    // without it.
    ['the status alone', (d) => { d.savedQuotes[0].status = 'pending_delivery'; }],
    ['an order never sent at all', (d) => { d.savedQuotes[0].id = 999; }],
  ];
  const blind = [];
  cases.forEach(([what, mutate]) => {
    const d = local();
    mutate(d);
    scope.setData(d);
    if (!scope.unsaved()) blind.push(what);
  });
  t.check(blind.length === 0,
    blind.length ? `not noticed as unsaved: ${blind.join('; ')}` : `every kind of local change is noticed (${cases.length} checked)`);

  // ...and an untouched order is not mistaken for one.
  scope.setData(local());
  t.check(scope.unsaved() === false, 'while an untouched order is not');
}

process.exit(t.done() ? 1 : 0);
})();
