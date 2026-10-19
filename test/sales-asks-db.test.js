#!/usr/bin/env node
'use strict';
/*
 * Sales' second migration (0130), asked of the SQL and of a real database:
 *
 *   1. The SQL text: payment_asks has no update or delete policy, so an ask
 *      changes only through withdraw_payment_ask (the asker) and
 *      decide_payment_ask (payment.edit); the outbox drops "ready to
 *      invoice" for a counter sale and nothing else.
 *   2. A REAL database, when OW_PG names one: every migration applied in
 *      order, then test/fixtures/sales-asks-scenario.sql: a counter sale
 *      placed, paid, invoiced through invoice_order and pushed to nobody;
 *      a payment ask from Sales to Accounts and back.
 *
 * Run: node test/sales-asks-db.test.js
 *      OW_PG="host=/var/tmp/owpg port=5499 user=postgres" node test/sales-asks-db.test.js
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { read, createReporter } = require('./_extract');

const t = createReporter('counter sale and payment asks (0130)');
const sql = read('supabase/migrations/0130_counter_sale_and_payment_asks.sql').replace(/--[^\n]*/g, '');
t.check(!/create policy[^;]*on payment_asks\s+for (update|delete|all)/i.test(sql), 'no policy lets a login change or delete an ask directly');
t.check(/has_task\(a\.shop_id, 'payment\.edit'\)/.test(sql), 'only payment.edit decides an ask');
t.check(/asked_by = auth\.uid\(\)/.test(sql) && /m\.role in \('owner', 'admin', 'manager', 'sales'\)/.test(sql), 'the proposers ask in their own name: Sales, the Manager, the owner');
t.check(/new\.kind = 'order\.delivered'/.test(sql) && /'counter'/.test(sql) && /return null/.test(sql), 'the outbox drops "ready to invoice" for a counter sale only');
t.check(/'payment\.edit'/.test(sql.slice(sql.indexOf('payment_asks_push'))), 'an ask is pushed to whoever holds payment.edit');

/* ---------------- 4. on a real database ---------------- */
const conn = process.env.OW_PG;
if (!conn) {
  console.log('skip   - OW_PG is not set, so the scenario is not run on a database (see the header of this file)');
  process.exit(t.done() ? 1 : 0);
}
const db = 'ow_sales_asks_test';
const psql = (args, input) => spawnSync('psql', [conn, ...args], { input, encoding: 'utf8' });
const onDb = (args, input) => spawnSync('psql', [`${conn} dbname=${db}`, ...args], { input, encoding: 'utf8' });

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
const again = onDb(['-qAt', '-v', 'ON_ERROR_STOP=1', '-f', path.join(migDir, '0130_counter_sale_and_payment_asks.sql')]);
t.check(again.status === 0, `0130 runs a second time without error (${(again.stderr || '').trim().split('\n').filter((l) => /ERROR/.test(l))[0] || 'ok'})`);

const scenario = fs.readFileSync(path.join(__dirname, 'fixtures', 'sales-asks-scenario.sql'), 'utf8');
const run = onDb(['-qAt', '-F', '\t'], scenario);
const rows = (run.stdout || '').split('\n').filter((l) => /^(PASS|FAIL)\t/.test(l));
t.check(rows.length >= 15, `the scenario ran (${rows.length} cases${run.stderr ? '; ' + run.stderr.trim().split('\n').filter((l) => /ERROR/.test(l)).slice(0, 2).join(' | ') : ''})`);
rows.forEach((l) => {
  const [verdict, label, got] = l.split('\t');
  t.check(verdict === 'PASS', `${label} — ${got}`);
});

psql(['-qAt', '-c', `drop database if exists ${db}`]);
process.exit(t.done() ? 1 : 0);
