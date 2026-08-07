#!/usr/bin/env node
'use strict';
/*
 * The worker app must not be able to delete an order.
 *
 * addDiffOps derives deletes by subtraction: anything lastSynced remembers
 * that `data` no longer has is taken as removed, and one statement deletes
 * the lot. That is right for the admin app, which really can delete a
 * product or a customer.
 *
 * The worker app cannot. Nothing in it ever takes a row out of
 * data.savedQuotes -- it accepts, picks, finishes. So a delete from there is
 * never an instruction; it is the symptom of `data` and `lastSynced` having
 * drifted apart, and what it deletes is the shop's entire order history.
 *
 * Three places assign the two together, in a deliberate order, to stop that
 * drift: boot, the background refresh, and a notification tap. Each carries
 * a comment explaining why the order matters. This makes a fourth one
 * getting it wrong survivable rather than catastrophic -- and saveData's own
 * `if(!data.savedQuotes) data.savedQuotes = []` is exactly the shape that
 * would trigger it, turning "missing" into "empty" and empty into "delete
 * everything".
 *
 * Run: node test/worker-never-deletes.test.js   (or: npm test)
 */
const { read, extractFunction, createReporter } = require('./_extract');

const t = createReporter('worker never deletes');
const sharedJs = read('shared-worker.js');
const workerHtml = read('worker.html');
const indexHtml = read('index.html');

/* ---------- 1. the diff, driven directly ------------------------------ */
{
  // Real source, with sb and lastSynced stubbed so the ops can be inspected
  // without running them.
  const lastSynced = {};
  const calls = [];
  const sb = {
    from: (table) => ({
      upsert: (rows) => { calls.push({ op: 'upsert', table, rows }); return Promise.resolve({}); },
      delete: () => ({
        eq: () => ({
          in: (field, values) => { calls.push({ op: 'delete', table, field, values }); return Promise.resolve({}); },
        }),
      }),
    }),
  };
  const errors = [];
  const scope = (new Function('sb', 'lastSynced', 'console', `
    let syncAbsentCollections = null;
    let __owAllowMassDelete = false;
    ${extractFunction(sharedJs, 'cloneJSON', 'shared-worker.js')}
    ${extractFunction(sharedJs, 'addDiffOps', 'shared-worker.js')}
    return { addDiffOps };
  `))(sb, lastSynced, { error: (...a) => errors.push(a.join(' ')) });

  const run = (prevRows, currRows, opts) => {
    calls.length = 0; errors.length = 0;
    lastSynced.savedQuotes = {};
    prevRows.forEach((r) => { lastSynced.savedQuotes[String(r.id)] = JSON.parse(JSON.stringify(r)); });
    const ops = [];
    scope.addDiffOps(ops, 'savedQuotes', 'saved_quotes', 'id', 'shop-1', currRows, opts);
    ops.forEach((o) => o.run());
    return { calls: calls.slice(), errors: errors.slice(), remembered: Object.keys(lastSynced.savedQuotes) };
  };

  const A = { id: 1, shop_id: 'shop-1', status: 'preparing' };
  const B = { id: 2, shop_id: 'shop-1', status: 'draft' };

  /* the drift, with the flag on */
  {
    const r = run([A, B], [], { neverDelete: true });
    t.check(!r.calls.some((c) => c.op === 'delete'),
      'an empty snapshot against a remembered one sends no delete');
    t.check(r.errors.length === 1 && /Refusing to delete 2 saved_quotes/.test(r.errors[0]),
      'and says so loudly instead of going quiet about it');
    t.check(r.remembered.length === 2,
      'lastSynced is left alone, so the next refresh can put the two back in step');
  }

  /* the same drift, with the flag off: the admin's behaviour, unchanged */
  {
    const r = run([A, B], []);
    const del = r.calls.find((c) => c.op === 'delete');
    t.check(!!del && del.table === 'saved_quotes',
      'without the flag a real delete is still issued -- the admin app needs it');
    t.check(JSON.stringify(del.values) === JSON.stringify([1, 2]), 'for exactly the removed ids');
    t.check(r.errors.length === 0, 'and nothing is logged, because nothing is wrong');
  }

  /* an ordinary save is unaffected either way */
  {
    const changed = { id: 1, shop_id: 'shop-1', status: 'pending_delivery' };
    const r = run([A, B], [changed, B], { neverDelete: true });
    const up = r.calls.find((c) => c.op === 'upsert');
    t.check(!!up && up.rows.length === 1 && up.rows[0].status === 'pending_delivery',
      'a changed row is still upserted');
    t.check(!r.calls.some((c) => c.op === 'delete') && r.errors.length === 0,
      'with no delete and nothing logged');

    const same = run([A, B], [A, B], { neverDelete: true });
    t.check(same.calls.length === 0 && same.errors.length === 0,
      'and a save that changes nothing sends nothing at all');
  }

  /* a row appearing is not a deletion */
  {
    const C = { id: 3, shop_id: 'shop-1', status: 'draft' };
    const r = run([A], [A, C], { neverDelete: true });
    t.check(r.calls.length === 1 && r.calls[0].op === 'upsert',
      'a new order is upserted and nothing else');
  }
}

/* ---------- 2. the worker app asks for it, the admin does not --------- */
{
  t.check(/addDiffOps\(ops, 'savedQuotes', 'saved_quotes', 'id', shopId, rows\.savedQuotes, \{neverDelete:true\}\)/.test(workerHtml),
    'the worker app passes neverDelete on its only diff');

  const adminCalls = (indexHtml.match(/addDiffOps\(ops,[^\n]*\)/g) || []);
  t.check(adminCalls.length >= 14, `the admin app still diffs its collections (${adminCalls.length} found)`);
  t.check(!adminCalls.some((c) => /neverDelete/.test(c)),
    'and none of them suppress deletes, because it really can delete things');
}

/* ---------- 3. nothing in the worker app removes an order ------------- */
{
  // The premise the flag rests on. If this stops being true, the flag is
  // wrong rather than merely unnecessary, and this should be what says so.
  const removers = [];
  [['worker.html', workerHtml], ['shared-worker.js', sharedJs]].forEach(([name, src]) => {
    const lines = src.split(/\r?\n/);
    lines.forEach((line, i) => {
      if (/^\s*\/\//.test(line)) return;
      if (/data\.savedQuotes\s*=(?!=)/.test(line) && !/data\.savedQuotes = \[\]/.test(line)) {
        removers.push(`${name}:${i + 1} reassigns data.savedQuotes`);
      }
      if (/data\.savedQuotes\.(splice|pop|shift)\(/.test(line)) {
        removers.push(`${name}:${i + 1} removes from data.savedQuotes`);
      }
    });
  });
  t.check(removers.length === 0,
    removers.length
      ? `the worker app can now remove orders, so neverDelete needs rethinking: ${removers.join('; ')}`
      : 'nothing in the worker app removes an order from its own copy');
}

process.exit(t.done() ? 1 : 0);
