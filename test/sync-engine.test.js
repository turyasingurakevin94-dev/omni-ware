#!/usr/bin/env node
'use strict';
/*
 * The sync engine -- addDiffOps() in shared-worker.js.
 *
 * This decides what gets written AND DELETED for every entity the admin app
 * owns: products, prices, stock, customers, orders, agents, cash. Its
 * deletes are derived from `lastSynced`, not from the server -- a row that
 * was in the last snapshot and isn't in the current one is a delete
 * instruction. Absence means "remove this".
 *
 * That makes `data` and `lastSynced` disagreeing far more dangerous than a
 * stale render: whatever lastSynced has and data doesn't gets deleted on
 * the next save. The two must therefore only ever move together.
 *
 * Run: node test/sync-engine.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('sync-engine');
const workerSrc = read('shared-worker.js');
const adminSrc = read('index.html');

/* ---------- addDiffOps against a controllable snapshot ---------------- */
const lastSynced = {};
const sb = {
  from: (table) => ({
    upsert: (rows) => ({ __op: 'upsert', table, rows }),
    delete: () => ({ eq: () => ({ in: (field, values) => ({ __op: 'delete', table, field, values }) }) }),
  }),
};
const { addDiffOps } = compileScope(
  [extractFunction(workerSrc, 'addDiffOps', 'shared-worker.js')],
  { lastSynced, sb, cloneJSON: (x) => JSON.parse(JSON.stringify(x)) },
  ['addDiffOps'],
);

// Runs a diff and reports what it would have sent, without sending it.
function diff(prevRows, currRows) {
  Object.keys(lastSynced).forEach((k) => delete lastSynced[k]);
  lastSynced.products = {};
  (prevRows || []).forEach((r) => { lastSynced.products[String(r.id)] = JSON.parse(JSON.stringify(r)); });
  const ops = [];
  addDiffOps(ops, 'products', 'products', 'id', 'shop-1', currRows);
  const planned = ops.map((o) => o.run());
  return {
    upserted: (planned.find((p) => p.__op === 'upsert') || {}).rows || [],
    deleted: (planned.find((p) => p.__op === 'delete') || {}).values || [],
    commit: () => ops.forEach((o) => o.commit()),
  };
}
const row = (id, name) => ({ id, shop_id: 'shop-1', name });

/* ---------- 1. the basic diff ----------------------------------------- */
{
  const d = diff([row(1, 'a'), row(2, 'b')], [row(1, 'a'), row(2, 'b')]);
  t.check(d.upserted.length === 0 && d.deleted.length === 0,
    `an unchanged collection sends nothing (upserts ${d.upserted.length}, deletes ${d.deleted.length})`);
}
{
  const d = diff([row(1, 'a')], [row(1, 'a'), row(2, 'b')]);
  t.check(d.upserted.length === 1 && d.upserted[0].id === 2 && d.deleted.length === 0,
    'a new row is upserted and nothing is deleted');
}
{
  const d = diff([row(1, 'a')], [row(1, 'CHANGED')]);
  t.check(d.upserted.length === 1 && d.upserted[0].name === 'CHANGED' && d.deleted.length === 0,
    'an edited row is upserted by value, not skipped');
}
{
  const d = diff([row(1, 'a'), row(2, 'b')], [row(1, 'a')]);
  t.check(d.deleted.length === 1 && d.deleted[0] === 2 && d.upserted.length === 0,
    `a row missing from the current set is deleted (deleted ${JSON.stringify(d.deleted)})`);
}

/* ---------- 2. an empty snapshot never deletes ------------------------ */
/*
 * This is what makes a first load safe: with nothing in lastSynced there is
 * nothing to consider missing, so a save can't delete rows it has never
 * seen. It also means an empty load followed by its own re-seed is
 * survivable -- both sides end up empty together.
 */
{
  const d = diff([], []);
  t.check(d.deleted.length === 0 && d.upserted.length === 0,
    'an empty snapshot against empty data deletes nothing');
  const d2 = diff([], [row(1, 'a')]);
  t.check(d2.deleted.length === 0 && d2.upserted.length === 1,
    'an empty snapshot against real data only upserts');
}

/* ---------- 3. a stale snapshot deletes everything -------------------- */
/*
 * Not a bug in addDiffOps -- this is its contract, and the reason the two
 * assignments have to be atomic. Pinned here so the consequence is on the
 * record next to the code that relies on it.
 */
{
  const d = diff([row(1, 'a'), row(2, 'b'), row(3, 'c')], []);
  t.check(d.deleted.length === 3,
    `a populated snapshot against empty data deletes every row (${d.deleted.length}) — which is why the refresh below must be atomic`);
}

/* ---------- 4. commit only advances what actually went ---------------- */
{
  const d = diff([row(1, 'a'), row(2, 'b')], [row(1, 'a'), row(2, 'CHANGED')]);
  d.commit();
  t.check(lastSynced.products['2'].name === 'CHANGED' && lastSynced.products['1'].name === 'a',
    'commit advances the snapshot for the rows that were sent');
  const again = [];
  addDiffOps(again, 'products', 'products', 'id', 'shop-1', [row(1, 'a'), row(2, 'CHANGED')]);
  t.check(again.length === 0, 'a second save with no further edits sends nothing');
}
{
  // Ops that fail are not committed by saveData(), so the snapshot must
  // still describe the server -- otherwise the next diff would skip a row
  // that never actually landed.
  const d = diff([row(1, 'a')], [row(1, 'CHANGED')]);
  // deliberately not calling d.commit(), as a failed op wouldn't
  const retry = [];
  addDiffOps(retry, 'products', 'products', 'id', 'shop-1', [row(1, 'CHANGED')]);
  t.check(retry.length === 1,
    'an uncommitted change is still pending on the next save (a failed op is retried, not lost)');
}

/* ---------- 5. the refresh assigns data and lastSynced atomically ----- */
/*
 * The reason this matters: boot() shows an error screen and returns out of
 * the app when a refresh fails, but pollForUpdatesNow()'s catch only logs
 * and carries on. Assigning `data` before building the snapshot meant a
 * throw in between left data fresh and lastSynced stale -- and by check 3
 * above, the next save deletes the difference.
 */
{
  const poll = /async function pollForUpdatesNow\(\)\{([\s\S]*?)\n\}/.exec(adminSrc);
  if (!poll) {
    t.fail('could not find pollForUpdatesNow() to check');
  } else {
    const body = poll[1];
    const iData = body.indexOf('data = fresh');
    const iBuild = body.indexOf('buildLastSynced(');
    const iLoad = body.indexOf('await loadData(');
    t.check(iBuild > -1 && iData > -1 && iBuild < iData && iLoad < iBuild,
      'the refresh loads and builds the new snapshot before assigning either');
    t.check(!/\bdata = await loadData\(/.test(body),
      'the refresh no longer assigns data straight from loadData() ahead of the snapshot');
    const iSynced = body.indexOf('lastSynced = freshSynced');
    t.check(iSynced > iBuild,
      'lastSynced is assigned from the prebuilt snapshot, not rebuilt after data changed');
  }
}
{
  // buildLastSynced must be pure -- if it assigned lastSynced itself, the
  // ordering above would be pointless.
  const fn = extractFunction(adminSrc, 'buildLastSynced', 'index.html');
  t.check(!/^\s*lastSynced\s*=/m.test(fn) && /return \{/.test(fn),
    'buildLastSynced returns a snapshot instead of assigning one');
}

process.exit(t.done() ? 1 : 0);
