#!/usr/bin/env node
'use strict';
/*
 * The new Store app's database (0182; the approved canvas
 * docs/canvas/store-agent/, its integration board IB01Handovers and
 * docs/audit/store/OTHER-APPS.md "The database"): every handover the yard
 * takes part in pushes the people IB01 names, in its words; a packed pickup
 * waits at the gate as Ready to collect (held there while not paid); the
 * yard's allow-list passes the new keys, a dropped line (no price) among
 * them; a cancelled order's put-back is stamped on it once (W7), no stock.
 *
 *   1. The SQL text, the decision-rights row, and IB01's words.
 *   2. A REAL database, when OW_PG names one: every migration in order, 0182
 *      run twice, then test/fixtures/store-new-app-scenario.sql.
 *
 * Run: node test/store-new-app-db.test.js
 *      OW_PG="host=/var/tmp/owpg port=5499 user=postgres" node test/store-new-app-db.test.js
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { read, createReporter } = require('./_extract');

const t = createReporter('The new Store app\'s database (0182)');
const raw = read('supabase/migrations/0182_store_new_app.sql');
const sql = raw.replace(/--[^\n]*/g, '');

/* ---------------- 1. the SQL text ---------------- */
{
  t.check(/Safe to run twice/.test(raw) && /ROLLBACK/.test(raw) && /CHECK AFTERWARDS/.test(raw), 'the header says it runs twice, and how to check and roll back');
  t.check(/\| 0182 \| /.test(read('docs/decision-rights.md')), 'docs/decision-rights.md reserves 0182');
  t.check(!/insert into role_tasks|delete from role_tasks/i.test(sql), 'no role or task changes');
  t.check(!/insert into (cash_txns|customer_debt_log|stock_log|stock_lots)|update customers|update stock\b/i.test(sql), 'touches no money and no stock');
  // Every push IB01 draws as new (or with new words) that has a write behind it.
  const kinds = ['order.pick', 'order.all_in', 'order.cancelled', 'pick.short', 'pick.settled', 'order.packed', 'order.unpaid_at_gate',
    'credit.ask', 'order.ready', 'order.out', 'order.delivered', 'order.back', 'order.moved', 'trip.back', 'trip.checked',
    'trip.difference', 'trip.difference.decided', 'delivery.checked', 'store.restock', 'store.extra', 'store.handover',
    'store.ask.decided', 'stock.count.sent', 'stock.count.decided', 'stock.recount', 'return.coming', 'invoice.ask', 'invoice.ask.decided'];
  const missing = kinds.filter((k) => !new RegExp(`'${k.replace(/\./g, '\\.')}'`).test(sql));
  t.check(missing.length === 0, `every push kind is written (${missing.join(', ') || 'all'})`);
  const board = read('docs/canvas/store-agent/boards/IB01Handovers.dc.html');
  const said = ['New push', 'order.unpaid_at_gate', 'stock.count.sent', 'return.coming', 'delivery.checked', 'trip.difference.decided', 'pick.settled', 'order.moved'];
  t.check(said.every((w) => board.includes(w)), 'IB01 draws them');
  t.check(/'deliverTo', 'deliverWhen'/.test(sql) && /'deliverPhone'/.test(sql) && /'counter'/.test(sql) && /'restocked'/.test(sql) && /'comingBack'/.test(sql),
    'the allow-list passes deliverTo, deliverWhen, deliverPhone, counter, comingBack and takenBack[].restocked');
  t.check(/'droppedLines', coalesce/.test(sql) && !/'sellPrice'/.test(sql.slice(sql.indexOf("'droppedLines', coalesce"), sql.indexOf("'droppedLines', coalesce") + 600)),
    'the yard reads a dropped line (payload.droppedLines), never its price');
  t.check(/'putBack'/.test(sql) && /p_patch -> 'putBack'/.test(sql) && !/allowed text\[\][^;]*'droppedLines'/.test(sql),
    'W7: a called-off order takes the yard\'s put-back stamp; the yard never writes droppedLines');
  t.check(/hint = 'OWCSH'/.test(sql) && /hint = 'OWSTALE'/.test(sql), 'the money gate and the stale-order guard stay');
  t.check(!/cash customer\./.test(sql.replace(/raise exception 'Not paid · cash customer\./, '')), 'no push says "cash customer" (IM-35)');
}

/* ---------------- 2. on a real database ---------------- */
const conn = process.env.OW_PG;
if (!conn) {
  console.log('skip   - OW_PG is not set, so the scenario is not run on a database (see the header of this file)');
  process.exit(t.done() ? 1 : 0);
}
const db = 'ow_store_new_app_test';
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
const again = onDb(['-qAt', '-v', 'ON_ERROR_STOP=1', '-f', path.join(migDir, '0182_store_new_app.sql')]);
t.check(again.status === 0, `0182 runs a second time without error (${errs(again)[0] || 'ok'})`);

const r = onDb(['-qAt', '-F', '\t'], fs.readFileSync(path.join(__dirname, 'fixtures', 'store-new-app-scenario.sql'), 'utf8'));
const rows = (r.stdout || '').split('\n').filter((l) => /^(PASS|FAIL)\t/.test(l));
t.check(rows.length >= 70, `the scenario ran (${rows.length} cases${errs(r).length ? '; ' + errs(r).slice(0, 2).join(' | ') : ''})`);
rows.forEach((l) => { const [verdict, label, got] = l.split('\t'); t.check(verdict === 'PASS', `${label} — ${got}`); });

psql(['-qAt', '-c', `drop database if exists ${db}`]);
process.exit(t.done() ? 1 : 0);
