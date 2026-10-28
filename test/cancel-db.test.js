#!/usr/bin/env node
'use strict';
/*
 * One Cancel, by the Manager, before the bill (0177;
 * docs/spec/01-order-journey.md §5 Q7 and Q8, docs/rebuild.md "Backend
 * fixes decided"): cancel_order writes status 'cancelled' (the stage the
 * Store reads) and the void in one write, settles the money, and pushes the
 * yard and the salesperson.
 *
 *   1. The SQL text, the decision-rights row, and what the Store screen reads.
 *   2. A REAL database, when OW_PG names one: every migration in order, 0177
 *      run twice, then test/fixtures/cancel-scenario.sql.
 *
 * Run: node test/cancel-db.test.js
 *      OW_PG="host=/var/tmp/owpg port=5499 user=postgres" node test/cancel-db.test.js
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { read, createReporter } = require('./_extract');

const t = createReporter('One Cancel, by the Manager (0177)');
const raw = read('supabase/migrations/0177_one_cancel.sql');
const sql = raw.replace(/--[^\n]*/g, '');

/* ---------------- 1. the SQL text ---------------- */
{
  t.check(/Safe to run twice/.test(raw) && /ROLLBACK/.test(raw) && /CHECK AFTERWARDS/.test(raw), 'the header says it runs twice, and how to check and roll back');
  t.check(/\| 0177 \| /.test(read('docs/decision-rights.md')), 'docs/decision-rights.md reserves 0177');
  t.check(/- \[x\] One "Cancel" by the Manager/.test(read('docs/rebuild.md')), 'docs/rebuild.md ticks it off');
  t.check(/insert into role_tasks \(role, task\) values \('manager', 'order\.cancel'\)/.test(sql)
    && /\| \*\*Cancel an order before it is invoiced\*\* \(the Store puts back what was packed\) \| `order\.cancel` \| Manager \| Sales \| Store, Sales \| yes \|/.test(read('docs/decision-rights.md')),
    'order.cancel is the Manager\'s, and its decision-rights row is built');
  const c = sql.slice(sql.indexOf('create or replace function cancel_order'));
  t.check(/set status = 'cancelled', voided = true/.test(c) && /'cancelledAt', now_ms, 'cancelledBy', uid, 'cancelledByName', who/.test(c), 'the stage, the void, and who cancelled it, in one write');
  t.check(/'order\.cancelled', 'Called off · stop packing'/.test(c) && /'order\.pick'/.test(c) && /in_yard := q\.status in \('preparing', 'pending_delivery'\)/.test(c), 'the yard is pushed when it had the order');
  t.check(/taker := ow_uuid\(q\.payload ->> 'takenBy'\)/.test(c), 'the salesperson who took it is pushed');
  t.check(/ow_settle_void_money\(p_shop_id, q, p_choice, p_account/.test(c), 'money paid is refunded or kept as a deposit');
  t.check(/came in: their supplier is billed first/.test(c) && /collection_trips/.test(c), 'goods that came in, or a live buying trip, refuse it (manager.html obVoidBlock)');
  t.check(/position\('order\.cancel' in src\) > 0 then return/.test(sql), 'the two patched functions are left alone on a second run');
  // The Store screen already reads what the Cancel writes.
  const store = read('store.html');
  t.check(/function orderCalledOff\(q\)\{ return !!q && \(q\.voided \|\| !!q\.cancelledAt \|\| q\.status === 'cancelled'\); \}/.test(store) && /q\.cancelledByName/.test(store), 'store.html reads status cancelled, cancelledAt and cancelledByName');
}

/* ---------------- 2. on a real database ---------------- */
const conn = process.env.OW_PG;
if (!conn) {
  console.log('skip   - OW_PG is not set, so the scenario is not run on a database (see the header of this file)');
  process.exit(t.done() ? 1 : 0);
}
const db = 'ow_cancel_test';
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
const again = onDb(['-qAt', '-v', 'ON_ERROR_STOP=1', '-f', path.join(migDir, '0177_one_cancel.sql')]);
t.check(again.status === 0, `0177 runs a second time without error (${errs(again)[0] || 'ok'})`);

const r = onDb(['-qAt', '-F', '\t'], fs.readFileSync(path.join(__dirname, 'fixtures', 'cancel-scenario.sql'), 'utf8'));
const rows = (r.stdout || '').split('\n').filter((l) => /^(PASS|FAIL)\t/.test(l));
t.check(rows.length >= 19, `the scenario ran (${rows.length} cases${errs(r).length ? '; ' + errs(r).slice(0, 2).join(' | ') : ''})`);
rows.forEach((l) => { const [verdict, label, got] = l.split('\t'); t.check(verdict === 'PASS', `${label} — ${got}`); });

psql(['-qAt', '-c', `drop database if exists ${db}`]);
process.exit(t.done() ? 1 : 0);
