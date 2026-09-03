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
const fs = require('fs');
const path = require('path');
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

  /* The exact shape of the places/collectionTrips bug, proven end to end.
     A collection missing from `data` reaches the diff as an empty array --
     buildSyncRows reads it as `(d.places||[])` -- so "we have none" and "we
     never asked" are indistinguishable by the time the diff sees them. The
     absent list is the ONLY thing that tells them apart, and a restore
     holds the mass-delete breaker open, so the breaker cannot catch what
     the list misses. */
  const i = runScenario(mk(12), [], null, { allow: true });
  eq(i.confirms.length, 0, 'a restore holds the breaker open by design — the wipe is never questioned');
  eq(i.deletes[0].vals.length, 12,
    'so a collection the absent list forgot loses every row the snapshot remembered, silently');
  const j = runScenario(mk(12), [], null, { allow: true, absent: new Set(['c']) });
  eq(j.ops.length, 0, 'naming it in the absent list is the only thing standing between the two');

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
  const absentLit = (/const absent = \[[^\]]*\]\.filter\(k=> !data\[k\]\);/.exec(adminSrc) || [''])[0];
  t.check(absentLit.length > 0,
    'saveData computes which collections are absent before anything fills them');
  t.check(/syncAbsentCollections = absent\.length \? new Set\(absent\) : null;/.test(adminSrc),
    'and hands the set to the diff engine to refuse');
  t.check(/if\(absent\.includes\('customers'\)\) absent\.push\('debtLog'\);/.test(adminSrc),
    'debtLog rides customers, so an absent customers benches both');
  t.check(/REFUSING to sync stockLots/.test(adminSrc),
    'the stock-lots rewrite refuses an absent collection the same way');

  /* DERIVED from the addDiffOps calls, never hand-listed. The check that
     used to stand here matched the literal's two ends with [\s\S]{0,400}
     between them, so a collection missing from the MIDDLE satisfied it --
     which is how places and collectionTrips sat outside the armor while a
     test named 'absence is not emptiness' passed on every run. */
  const diffedKeys = [...adminSrc.matchAll(/addDiffOps\(ops, '(\w+)'/g)].map((m) => m[1])
    .filter((k) => k !== 'debtLog');   // pushed conditionally, riding customers
  diffedKeys.concat(['stockLots']).forEach((k) =>
    t.check(new RegExp(`'${k}'`).test(absentLit),
      `the absent list names ${k} — one it forgets is read as "delete every row" instead of benched`));
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
  /* Searched across EVERY migration, not just 0058. The gate is a fact
     about the database; a table added afterwards carries its policy in
     its own migration, and reading one file could only ever describe the
     tables that existed when it was written. */
  const allMigrations = fs.readdirSync(path.join(__dirname, '..', 'supabase', 'migrations'))
    .filter((f) => f.endsWith('.sql'))
    .map((f) => read('supabase/migrations/' + f)).join('\n');
  const diffedTables = [...adminSrc.matchAll(/addDiffOps\(ops, '\w+', '(\w+)'/g)].map((m) => m[1]);
  diffedTables.concat(['stock_lots']).forEach((tbl) => {
    const gated = new RegExp(`on ${tbl}\\s+as restrictive\\s+for delete`).test(allMigrations)
      || new RegExp(`'${tbl}'`).test(mig);
    t.check(gated,
      `${tbl} is synced, so a stale client cannot delete from it — only the owner's session can`);
  });
}

/* ---------- 9. the refresh does not eat work that is still in flight ----
 *
 * Reported live: a receipt was recorded against Musisi's invoice, saved,
 * and the invoice came back showing nothing received. A while later it
 * was there again. Second time that day.
 *
 * The shape: ip_save mutates `data` and fires saveData() WITHOUT awaiting
 * it, then closes the modal. From that moment the payment exists only in
 * memory until the write lands. pollForUpdatesNow() replaces `data` and
 * `lastSynced` wholesale, and had no idea a save was running -- so a poll
 * landing in that window threw the payment away. It reappeared because
 * that particular write had in fact reached the server and a later poll
 * read it back. One that had NOT would have been gone with no trace but a
 * five-second toast.
 *
 * The window is not theoretical: visibilitychange fires a poll the instant
 * the tab comes back, which is exactly what happens when somebody records
 * a receipt and switches to WhatsApp.
 *
 * These drive the real pollForUpdatesNow() out of index.html.
 */
(async () => {
  /* A watchdog, because these drive real async code against stalled
     promises: without it a regression that never resolves would drain the
     event loop, exit 0, and read as a pass. Found by mutation — removing
     the re-entrancy latch hung this file and the run went green. */
  const watchdog = setTimeout(() => {
    t.fail('the refresh tests never finished — a poll is hanging, which is a failure, not a pass');
    process.exit(1);
  }, 10000);

  const invoice = (paid) => ({ id: 170, client: { name: 'Musisi' }, status: 'completed',
    invoiced: true, amountPaid: paid, payments: paid ? [{ id: 1, amount: paid }] : [] });
  // What the server still has: the invoice with nothing received, because
  // the read went out before the write landed.
  const serverState = () => ({ savedQuotes: [invoice(0)], cashTxns: [] });

  const build = (over) => {
    const log = [];
    const env = Object.assign({
      data: { savedQuotes: [invoice(665000)], cashTxns: [{ id: 9, amount: 665000 }] },
      lastSynced: { savedQuotes: {} },
      pollInFlight: false,
      syncSavesInFlight: 0,
      lastUserInputAt: 0,
      currentShopId: 'shop-1',
      currentActiveTab: 'invoices',
      document: { querySelector: () => null },
      saveData: async () => { log.push('save'); return true; },
      loadData: async () => { log.push('load'); return serverState(); },
      buildLastSynced: (d) => ({ savedQuotes: Object.fromEntries((d.savedQuotes || []).map((q) => [String(q.id), q])) }),
      goToTab: () => {},
      refreshNavBadges: () => {},
      // The refresh holds off while the order board's Loaded form is being
      // filled in -- a redraw replaces the field under the owner's hands,
      // and an open dropdown cannot be given back. Stubbed false here for
      // the same reason goToTab is stubbed: this file is about the sync,
      // and nobody is typing in it. The guard itself is pinned by
      // test/order-board-layout.test.js.
      otTyping: () => false,
      // The debt heal has its own test file (debtor-balance-reconciliation);
      // here it only needs to not be a ReferenceError inside the refresh.
      reconcileCustomerDebts: () => [],
      reportDebtReconciliation: () => {},
      console: { error: () => { log.push('error'); } },
    }, over || {});
    const scope = compileScope(
      [extractFunction(adminSrc, 'pollForUpdatesNow', 'index.html'),
        'function __peek(){ return { data: data, pollInFlight: pollInFlight }; }'],
      env, ['pollForUpdatesNow', '__peek'],
    );
    return { scope, log, paidNow: () => scope.__peek().data.savedQuotes[0].amountPaid };
  };

  /* a save still running holds the refresh off entirely */
  {
    const h = build({ syncSavesInFlight: 1 });
    await h.scope.pollForUpdatesNow();
    t.check(!h.log.includes('load'),
      'a refresh will not run while a save is in flight — it would swap lastSynced out from under that save’s diff');
    eq(h.paidNow(), 665000, 'so the payment that save is carrying is still there');
  }

  /* the refresh flushes first, and gives up if the flush did not land */
  {
    const h = build({ saveData: async () => false });
    await h.scope.pollForUpdatesNow();
    t.check(!h.log.includes('load'),
      'a flush that failed abandons the refresh rather than overwriting the only copy of the work');
    eq(h.paidNow(), 665000,
      'the receipt survives — this is the case that used to lose it outright, with the write never having reached the server');
    /* This is the path that makes the finally load-bearing, and the throw
       path is not: a throw is caught and execution carries on past the
       try either way. Abandoning the refresh RETURNS from inside it, and
       only a finally runs on the way out. */
    t.check(!h.scope.__peek().pollInFlight,
      'and it lowers the latch on its way out, rather than refusing every refresh from here on');
  }

  /* and when there is nothing outstanding, it refreshes as before */
  {
    const h = build();
    await h.scope.pollForUpdatesNow();
    eq(h.log.join(','), 'save,load',
      'the flush goes out BEFORE the load, so anything local is on the server before the server’s copy replaces it');
    eq(h.paidNow(), 0, 'and the refresh does still replace data — the guard is not a permanent freeze');
  }

  /* two refreshes cannot interleave */
  {
    // Every stalled load keeps its own resolver: a second poll that got
    // through would make a second promise, and one shared `release` would
    // strand the first one for ever.
    const stalled = [];
    const h = build({ loadData: () => new Promise((res) => stalled.push(() => res(serverState()))) });
    /* Neither is awaited. A refused refresh returns immediately, but one
       that slipped past the latch would sit on the stalled load — and
       awaiting THAT is how this test used to hang instead of failing. */
    const both = [h.scope.pollForUpdatesNow(), h.scope.pollForUpdatesNow()];
    /* Checked with no await in between: both prologues run synchronously
       as far as their first await, so a second one that got through has
       already logged its flush by now. */
    t.check(h.log.filter((x) => x === 'save').length === 1,
      'a second refresh arriving mid-flight (visibilitychange lands on top of the 30s tick) is refused');
    // Now let the surviving refresh get as far as its load before releasing
    // it -- the flush it awaits first means `stalled` is empty until it does.
    await new Promise((r) => setTimeout(r, 0));
    stalled.forEach((r) => r());
    await Promise.all(both);
    t.check(!h.scope.__peek().pollInFlight, 'and the latch is down again once it finishes');
  }

  /* a refresh that throws must not wedge the latch */
  {
    const h = build({ loadData: async () => { throw new Error('offline'); } });
    await h.scope.pollForUpdatesNow();
    t.check(!h.scope.__peek().pollInFlight,
      'the latch is cleared in a finally — a throw leaving it raised would stop every future refresh for the life of the tab');
    await h.scope.pollForUpdatesNow();
    t.check(h.log.filter((x) => x === 'save').length === 2, 'and the next refresh runs');
  }

  /* saveData has to actually report, and actually count */
  {
    const wrapper = extractFunction(adminSrc, 'saveData', 'index.html');
    t.check(/syncSavesInFlight\+\+;/.test(wrapper) && /finally\s*\{\s*syncSavesInFlight--;/.test(wrapper),
      'saveData counts itself in and out in a finally, so a throw cannot wedge the refresh off');
    t.check(/return await/.test(wrapper),
      'and passes the verdict back, rather than swallowing it');
    const inner = extractFunction(adminSrc, 'syncDataToServer', 'index.html');
    t.check(/if\(!ops\.length\) return true;/.test(inner),
      'nothing to send counts as landed');
    t.check(/return !failed;/.test(inner),
      'and a failed write counts as not landed — which is what the refresh reads before it replaces anything');
  }

  clearTimeout(watchdog);
  process.exit(t.done() ? 1 : 0);
})();
