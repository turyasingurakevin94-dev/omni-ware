#!/usr/bin/env node
'use strict';
/*
 * Moving a stage needs its task, and only to an allowed next stage (0173;
 * docs/spec/01-order-journey.md §5 Q2, docs/rebuild.md "Backend fixes
 * decided"): order.move was granted but never checked.
 *
 *   1. The SQL text: the moves and their tasks, what is not judged, and
 *      that it runs before the Checking gate.
 *   2. A REAL database, when OW_PG names one: every migration in order, 0173
 *      run twice, then test/fixtures/stage-move-scenario.sql as Sales, the
 *      Buyer, the Store, Accounts, the Manager, the owner's console and the
 *      server with no login.
 *
 * Run: node test/stage-move-db.test.js
 *      OW_PG="host=/var/tmp/owpg port=5499 user=postgres" node test/stage-move-db.test.js
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { read, createReporter } = require('./_extract');

const t = createReporter('Moving a stage needs its task (0173)');
const raw = read('supabase/migrations/0173_stage_moves_need_their_task.sql');
const sql = raw.replace(/--[^\n]*/g, '');

/* ---------------- 1. the SQL text ---------------- */
{
  t.check(/Safe to run twice/.test(raw) && /ROLLBACK/.test(raw) && /CHECK AFTERWARDS/.test(raw), 'the header says it runs twice, and how to check and roll back');
  t.check(/\| 0173 \| /.test(read('docs/decision-rights.md')), 'docs/decision-rights.md reserves 0173');
  t.check(/- \[x\] Moving a stage needs `order\.move`, and only to an allowed next stage \(journey Q2\)/.test(read('docs/rebuild.md')), 'docs/rebuild.md ticks it off');
  const fn = sql.slice(sql.indexOf('function saved_quotes_stage_move'));
  t.check(/when t < f then array\['order\.move'\]/.test(fn), 'back to an earlier stage: order.move');
  t.check(/was = 'draft' and new\.status in \('awaiting_goods', 'preparing'\) then array\['order\.move', 'supplier\.confirm'\]/.test(fn), 'out of Checking: order.move, or the Buyer\'s supplier.confirm');
  t.check(/tg_op = 'INSERT' and new\.status = 'preparing' then array\['quote\.make', 'order\.move'\]/.test(fn) && /tg_op = 'INSERT' and new\.status = 'awaiting_goods' then array\['order\.move'\]/.test(fn),
    'a new order placed past Checking is a move out of it: Packing with quote.make or order.move, Buying with order.move');
  t.check(/was = 'awaiting_goods' and new\.status = 'preparing' then array\['order\.move', 'stock\.receive'\]/.test(fn), 'Buying to Packing: order.move, or stock.receive (receive_trip)');
  t.check(/'pending_delivery' then array\['order\.move', 'order\.load'\]/.test(fn) && /new\.status = 'completed' then array\['order\.move', 'order\.deliver'\]/.test(fn), 'load and deliver: order.move, or the Store\'s order.load and order.deliver');
  t.check(/when new\.status = 'completed' then array\['order\.move'\]/.test(fn), 'any stage to Delivered: order.move ("mark done")');
  t.check((fn.match(/errcode = 'OWSTG'/g) || []).length >= 3 && /errcode = '42501'/.test(fn), 'a move not allowed is OWSTG; a missing task 42501');
  t.check(/old\.invoiced, false\) or coalesce\(old\.voided, false\)/.test(fn), 'an invoiced or voided order\'s stage stays');
  t.check(/auth\.uid\(\) is null then return new/.test(fn) && /is_shop_admin\(new\.shop_id\) then return new/.test(fn), 'no login and the owner\'s console are not judged');
  const m178 = read('supabase/migrations/0178_yard_workers_load_and_deliver.sql');
  t.check(/m\.role in \('store', 'staff'\)/.test(m178) && /was in \('preparing', 'pending_delivery'\) and new\.status in \('pending_delivery', 'completed'\)/.test(m178)
    && /m\.role in \('store', 'staff'\)/.test(read('supabase/migrations/0164_store_roles_and_privacy.sql')),
    '0178: a store or staff login makes the yard\'s moves, as store_patch_order (0164) lets them');
  t.check(/has_task\(new\.shop_id, 'order\.cancel'\)/.test(m178), '0178 keeps 0177\'s Cancel in the rule it writes out whole');
  t.check('saved_quotes_ow_a_stage_move' < 'saved_quotes_ow_checking_gate' && /create trigger saved_quotes_ow_a_stage_move before insert or update on saved_quotes/.test(sql), 'it runs before the Checking gate (BEFORE triggers fire by name)');
  // Every task it names is one the decision-rights table and role_tasks know.
  const dr = read('docs/decision-rights.md');
  ['order.move', 'supplier.confirm', 'stock.receive', 'order.load', 'order.deliver'].forEach((k) => t.check(dr.includes('`' + k + '`'), `${k} is in docs/decision-rights.md`));
}

/* ---------------- 2. on a real database ---------------- */
const conn = process.env.OW_PG;
if (!conn) {
  console.log('skip   - OW_PG is not set, so the scenario is not run on a database (see the header of this file)');
  process.exit(t.done() ? 1 : 0);
}
const db = 'ow_stage_move_test';
const psql = (args, input) => spawnSync('psql', [conn, ...args], { input, encoding: 'utf8' });
const onDb = (args, input) => spawnSync('psql', [`${conn} dbname=${db}`, ...args], { input, encoding: 'utf8', maxBuffer: 1 << 26 });
const errs = (r) => (r.stderr || '').trim().split('\n').filter((l) => /ERROR/.test(l));

const reset = psql(['-qAt', '-c', `drop database if exists ${db}`, '-c', `create database ${db}`]);
t.check(reset.status === 0, `a fresh database was made (${(reset.stderr || '').trim().slice(0, 200)})`);
const shim = fs.readFileSync(path.join(__dirname, 'fixtures', 'supabase-shim.sql'), 'utf8');
t.check(onDb(['-qAt', '-v', 'ON_ERROR_STOP=1'], shim).status === 0, 'the Supabase stand-in applied');

const migDir = path.join(__dirname, '..', 'supabase', 'migrations');
const failed = [];
fs.readdirSync(migDir).filter((f) => f.endsWith('.sql')).sort().forEach((f) => {
  const r = onDb(['-qAt', '-v', 'ON_ERROR_STOP=1', '-f', path.join(migDir, f)]);
  if (r.status !== 0) failed.push(`${f}: ${(r.stderr || '').trim().split('\n')[0]}`);
});
t.check(failed.length === 0, `every migration applied, in order (${JSON.stringify(failed)})`);
const again = onDb(['-qAt', '-v', 'ON_ERROR_STOP=1', '-f', path.join(migDir, '0173_stage_moves_need_their_task.sql')]);
t.check(again.status === 0, `0173 runs a second time without error (${errs(again)[0] || 'ok'})`);
// 0173's second run puts its own rule back; 0178 writes out the rule in force (0177's Cancel, the yard's workers).
const inForce = onDb(['-qAt', '-v', 'ON_ERROR_STOP=1', '-f', path.join(migDir, '0178_yard_workers_load_and_deliver.sql')]);
t.check(inForce.status === 0, `0178 puts the rule in force back, and runs twice too (${errs(inForce)[0] || 'ok'})`);

const r = onDb(['-qAt', '-F', '\t'], fs.readFileSync(path.join(__dirname, 'fixtures', 'stage-move-scenario.sql'), 'utf8'));
const rows = (r.stdout || '').split('\n').filter((l) => /^(PASS|FAIL)\t/.test(l));
t.check(rows.length >= 32, `the scenario ran (${rows.length} cases${errs(r).length ? '; ' + errs(r).slice(0, 2).join(' | ') : ''})`);
rows.forEach((l) => { const [verdict, label, got] = l.split('\t'); t.check(verdict === 'PASS', `${label} — ${got}`); });

psql(['-qAt', '-c', `drop database if exists ${db}`]);
process.exit(t.done() ? 1 : 0);
