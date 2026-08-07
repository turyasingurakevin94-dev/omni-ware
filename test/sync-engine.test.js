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
const baseConfirms = [];
const { addDiffOps } = compileScope(
  [extractFunction(workerSrc, 'addDiffOps', 'shared-worker.js')],
  { lastSynced, sb, cloneJSON: (x) => JSON.parse(JSON.stringify(x)),
    syncAbsentCollections: null, __owAllowMassDelete: false,
    confirm: (m) => { baseConfirms.push(String(m)); return false; },
    console: { error: () => {} } },
  ['addDiffOps'],
);
const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);

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

/* ---------- 3. a stale snapshot no longer deletes everything ---------- */
/*
 * The diff's raw contract IS "delete the difference" -- which is exactly
 * how the shop got wiped (products 11 times over, orders 174) whenever a
 * snapshot and its data drifted. The atomic refresh (section 5) prevents
 * the drift; the mass-delete breaker now stands in front of the contract
 * for whatever slips through: a storm ASKS, and unconfirmed it deletes
 * nothing. The full breaker behavior is proven in THE ARMOR below.
 */
{
  baseConfirms.length = 0;
  const d = diff([row(1, 'a'), row(2, 'b'), row(3, 'c')], []);
  t.check(d.deleted.length === 0 && baseConfirms.length === 1,
    `a populated snapshot against empty data ASKS, and unconfirmed deletes nothing (deleted ${d.deleted.length}, asked ${baseConfirms.length})`);
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

/* Every collection addDiffOps() diffs MUST be seeded in the snapshot.
 * addDiffOps derives deletes from lastSynced[collection]; a diffed
 * collection the snapshot skips loses any delete made before that
 * collection's first save of the session -- the row vanishes locally, no
 * delete op is built, and the next load resurrects it. Learned live: the
 * snapshot skipped fixed assets, loans, and dues as "never removed", and
 * a deleted delivery bike kept coming back from the server.
 */
{
  const diffed = [...adminSrc.matchAll(/addDiffOps\(ops, '(\w+)'/g)].map((m) => m[1]);
  t.check(diffed.length >= 19, `the save fn diffs the collections we expect (found ${diffed.length})`);
  const snap = extractFunction(adminSrc, 'buildLastSynced', 'index.html');
  diffed.forEach((k) =>
    t.check(new RegExp(`\\b${k}: keyRowsById\\(rows\\.${k},`).test(snap),
      `${k} is diffed, so the snapshot seeds it -- or its deletes never reach the server`));
}

/* =====================================================================
 * THE ARMOR. The shop lost products 11 times over and orders 174 times
 * to delete storms before these existed. Three latches, each proven:
 * absence is not emptiness (an absent collection is refused, not
 * emptied); a mass delete asks the human in plain words; and the only
 * two intentional wipes (typed-out Clear, backup restore) raise a flag
 * instead of being interrogated collection by collection.
 */
{
  const sharedSrc = read('shared-worker.js');
  const mk = (n, from) => Array.from({ length: n }, (_, i) => ({ id: (from || 0) + i + 1, v: 'x' }));
  const key = (rows) => Object.fromEntries(rows.map((r) => [String(r.id), r]));

  const runScenario = (prevRows, rows, opts, env2) => {
    const confirms = [];
    const deletes = [];
    const scope = compileScope([extractFunction(sharedSrc, 'addDiffOps', 'shared-worker.js')], {
      lastSynced: { c: key(prevRows) },
      cloneJSON: (x) => JSON.parse(JSON.stringify(x)),
      confirm: (m) => { confirms.push(String(m)); return env2 && env2.confirmSays === undefined ? false : !!(env2 && env2.confirmSays); },
      sb: { from: (t) => ({
        upsert: () => ({ error: null }),
        delete: () => ({ eq: () => ({ in: (f, vals) => { deletes.push({ t, vals }); return { error: null }; } }) }),
      }) },
      syncAbsentCollections: (env2 && env2.absent) || null,
      __owAllowMassDelete: !!(env2 && env2.allow),
      console: { error: () => {} },
    }, ['addDiffOps']);
    const ops = [];
    scope.addDiffOps(ops, 'c', 'saved_quotes', 'id', 'SHOP', rows, opts);
    ops.forEach((op) => op.run());
    return { confirms, deletes, ops };
  };

  /* wiping 20 rows: asked, and No means no */
  const a = runScenario(mk(20), [], null, { confirmSays: false });
  eq(a.confirms.length, 1, 'deleting all 20 remembered rows asks the human first');
  t.check(/permanently DELETE 20 of the shop's 20 saved quotes record/.test(a.confirms[0]),
    'and the question says the number, the table, and the blast radius in plain words');
  eq(a.deletes.length, 0, 'Cancel means nothing is deleted');

  /* Yes means yes */
  const b = runScenario(mk(20), [], null, { confirmSays: true });
  eq(b.deletes.length, 1, 'a confirmed mass delete goes through');
  eq(b.deletes[0].vals.length, 20, 'all of it');

  /* one row is normal work, not an interrogation */
  const c = runScenario(mk(20), mk(19), null, {});
  eq(c.confirms.length, 0, 'deleting 1 of 20 asks nobody');
  eq(c.deletes.length, 1, 'and just happens');

  /* half of a small collection is still a storm */
  const d = runScenario(mk(4), mk(1), null, { confirmSays: false });
  eq(d.confirms.length, 1, '3 of 4 remembered rows is half the shop — asked');
  eq(d.deletes.length, 0, 'and blocked on Cancel');

  /* 9 of 100 is below both thresholds */
  const e = runScenario(mk(100), mk(91), null, {});
  eq(e.confirms.length, 0, '9 of 100 is not a storm');
  eq(e.deletes.length, 1, 'and proceeds');

  /* 10 of 100 crosses the absolute threshold with the half-rule silent —
     the case that proves the ten-row line exists on its own */
  const e2 = runScenario(mk(100), mk(90), null, { confirmSays: false });
  eq(e2.confirms.length, 1, '10 of 100 is a storm by count alone');
  eq(e2.deletes.length, 0, 'and blocked on Cancel');

  /* the intentional-wipe flag skips the question, not the delete */
  const f = runScenario(mk(20), [], null, { allow: true });
  eq(f.confirms.length, 0, 'an intentional wipe is not interrogated');
  eq(f.deletes.length, 1, 'it just happens');

  /* absence is not emptiness — with rows that WOULD have upserted, so a
     refusal that quietly stopped refusing cannot hide behind a no-op diff */
  const g = runScenario(mk(20), mk(20).map((r) => ({ ...r, v: 'CHANGED' })), null, { absent: new Set(['c']) });
  eq(g.ops.length, 0, 'an absent collection sits the save out entirely — no upserts, no deletes');

  /* the stock-lots rewrite honors the same latch, REACHABLY — its refusal
     string existing is not the refusal running */
  {
    const lotDeletes = [];
    const lotsScope = compileScope([extractFunction(adminSrc, 'addStockLotsDiffOps', 'index.html')], {
      lastSynced: { stockLots: { A: [{ qty: 1, cost: 5 }] } },
      syncAbsentCollections: new Set(['stockLots']),
      cloneJSON: (x) => JSON.parse(JSON.stringify(x)),
      sb: { from: () => ({ delete: () => ({ eq: () => ({ in: (f, vals) => { lotDeletes.push(vals); return { error: null }; } }) }) }) },
      console: { error: () => {} },
    }, ['addStockLotsDiffOps']);
    const lops = [];
    lotsScope.addStockLotsDiffOps(lops, 'SHOP', {});
    eq(lops.length, 0, 'an absent stockLots is refused by the lot rewrite too — not read as "rewrite to nothing"');
  }

  /* the worker's old guard still holds */
  const h = runScenario(mk(20), [], { neverDelete: true }, {});
  eq(h.confirms.length, 0, 'neverDelete refuses silently');
  eq(h.deletes.length, 0, 'and deletes nothing');

  /* the flag rests low, and the two wipes raise it around their save */
  t.check(/let __owAllowMassDelete = false;/.test(sharedSrc),
    'the intentional-wipe flag rests false');
  eq((adminSrc.match(/__owAllowMassDelete = true;\s*\r?\n\s*saveData\(\);\s*\r?\n\s*__owAllowMassDelete = false;/g) || []).length, 2,
    'exactly two places raise it — the typed-out Clear and the backup restore — and both lower it');
}

/* saveData records absence FIRST, and refuses to speak for the gap */
{
  t.check(/const absent = \['suppliers','staff'[\s\S]{0,400}'stock','stockLots','cashDays'\]\.filter\(k=> !data\[k\]\);/.test(adminSrc),
    'saveData computes which collections are absent before anything fills them');
  t.check(/syncAbsentCollections = absent\.length \? new Set\(absent\) : null;/.test(adminSrc),
    'and hands the set to the diff engine to refuse');
  t.check(/if\(absent\.includes\('customers'\)\) absent\.push\('debtLog'\);/.test(adminSrc),
    'debtLog rides customers, so an absent customers benches both');
  t.check(/REFUSING to sync stockLots/.test(adminSrc),
    'the stock-lots rewrite refuses an absent collection the same way');
}

/* the Clear button says what it does, and does all of what it says */
{
  const clear = (/clearBtn'\)\.addEventListener\('click', \(\)=>\{[\s\S]*?\n\}\);/.exec(adminSrc) || [''])[0];
  t.check(/Type ERASE to continue/.test(clear) && /typed\.trim\(\) !== 'ERASE'/.test(clear),
    'erasing the shop takes typing ERASE, not clicking through');
  t.check(/WHOLE SHOP'S data from the server/.test(clear) && /every device and every member/.test(clear),
    'and the words match the real blast radius — not "on this computer"');
  /* Every diffed collection appears in the literal: one an absent-refusal
     would skip is one a "clear" silently fails to clear. */
  const diffedKeys = [...adminSrc.matchAll(/addDiffOps\(ops, '(\w+)'/g)].map((m) => m[1])
    .filter((k) => k !== 'debtLog');   // derived from customers, not its own literal key
  diffedKeys.concat(['stockLots']).forEach((k) =>
    t.check(new RegExp(`${k}:`).test(clear), `the clear literal names ${k} — nothing left to be refused or resurrected`));
}

/* restoring a backup names its cost */
{
  t.check(/Anything created or changed AFTER this backup was made will be permanently deleted/.test(adminSrc),
    'the restore confirm says what a restore deletes');
}

/* the server no longer takes a delete from anyone but the owner */
{
  const mig = read('supabase/migrations/0058_owner_only_deletes.sql');
  t.check(/as restrictive for delete/.test(mig) && /role = 'owner'/.test(mig),
    'deletes are gated by a RESTRICTIVE policy on the owner role');
  const diffedTables = [...adminSrc.matchAll(/addDiffOps\(ops, '\w+', '(\w+)'/g)].map((m) => m[1]);
  diffedTables.concat(['stock_lots']).forEach((tbl) =>
    t.check(new RegExp(`'${tbl}'`).test(mig),
      `${tbl} is synced, so a stale client cannot delete from it — only the owner's session can`));
}

process.exit(t.done() ? 1 : 0);
