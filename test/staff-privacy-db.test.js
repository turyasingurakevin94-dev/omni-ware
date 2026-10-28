#!/usr/bin/env node
'use strict';
/*
 * A yard worker keeps out of the books (0179; docs/spec/05-data.md §8 Q1,
 * Q2): a staff login read the cash book and every customer's debt, and held
 * no task, so the yard's moves were written into functions by role name.
 *
 *   1. The SQL text: the tables it closes, that the worker app reads none of
 *      them, and the staff tasks in docs/decision-rights.md.
 *   2. A REAL database, when OW_PG names one: every migration in order, 0179
 *      run twice, then test/fixtures/staff-privacy-scenario.sql as a worker,
 *      the Manager, Accounts and the owner.
 *
 * Run: node test/staff-privacy-db.test.js
 *      OW_PG="host=/var/tmp/owpg port=5499 user=postgres" node test/staff-privacy-db.test.js
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { read, createReporter } = require('./_extract');

const t = createReporter('A yard worker keeps out of the books (0179)');
const FILE = 'supabase/migrations/0179_yard_workers_keep_out_of_the_books.sql';
const raw = read(FILE);
const sql = raw.replace(/--[^\n]*/g, '');

/* ---------------- 1. the SQL text ---------------- */
const closed = ((sql.match(/foreach t in array array\[([^\]]+)\]/) || [])[1] || '').match(/'([a-z_]+)'/g) || [];
const tables = closed.map((s) => s.slice(1, -1));
{
  t.check(/Safe to run twice/.test(raw) && /ROLLBACK/.test(raw) && /CHECK AFTERWARDS/.test(raw), 'the header says it runs twice, and how to check and roll back');
  t.check(/\| 0179 \| /.test(read('docs/decision-rights.md')), 'docs/decision-rights.md reserves 0179');
  t.check(tables.length === 21 && /-- 21/.test(raw), `it closes 21 tables, as its check says (${tables.length})`);
  ['cash_txns', 'customers', 'customer_debt_log', 'purchase_invoices', 'dues', 'loans', 'decision_log'].forEach((k) => t.check(tables.includes(k), `${k} is closed to a worker`));
  t.check(/as restrictive for all to authenticated/.test(sql) && /using \(not ow_yard_worker\(shop_id\)\) with check \(not ow_yard_worker\(shop_id\)\)/.test(sql),
    'a restrictive policy on every operation, reads and writes');
  t.check(/m\.role = 'staff'/.test(sql) && /security definer/.test(sql), 'ow_yard_worker: a staff login in that shop');
  // The worker app is left as it is: it must read none of what is closed.
  const worker = read('worker.html');
  const reads = [...new Set((worker.match(/\.from\(\s*['"]([a-z_]+)['"]/g) || []).map((s) => s.match(/['"]([a-z_]+)['"]/)[1]))];
  t.check(reads.length > 0, `worker.html reads tables directly (${reads.join(', ')})`);
  const hit = reads.filter((x) => tables.includes(x));
  t.check(hit.length === 0, `worker.html reads none of the closed tables (${JSON.stringify(hit)})`);
  const dr = read('docs/decision-rights.md');
  ['order.pick', 'order.load', 'order.deliver'].forEach((k) => t.check(new RegExp('`' + k.replace('.', '\\.') + '` \\| Store, Staff \\|').test(dr), `docs/decision-rights.md gives ${k} to Store, Staff`));
  t.check(/\('staff', 'order\.pick'\), \('staff', 'order\.load'\), \('staff', 'order\.deliver'\)/.test(sql), 'role_tasks gives staff the same three');
}

/* ---------------- 2. on a real database ---------------- */
const conn = process.env.OW_PG;
if (!conn) {
  console.log('skip   - OW_PG is not set, so the scenario is not run on a database (see the header of this file)');
  process.exit(t.done() ? 1 : 0);
}
const db = 'ow_staff_privacy_test';
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
const again = onDb(['-qAt', '-v', 'ON_ERROR_STOP=1', '-f', path.join(__dirname, '..', FILE)]);
t.check(again.status === 0, `0179 runs a second time without error (${errs(again)[0] || 'ok'})`);
const n = onDb(['-qAt', '-c', `select count(*) from pg_policy where polname = 'not a yard worker'`]);
t.check((n.stdout || '').trim() === '21', `its check afterwards finds 21 policies (${(n.stdout || '').trim()})`);

const r = onDb(['-qAt', '-F', '\t'], fs.readFileSync(path.join(__dirname, 'fixtures', 'staff-privacy-scenario.sql'), 'utf8'));
const rows = (r.stdout || '').split('\n').filter((l) => /^(PASS|FAIL)\t/.test(l));
t.check(rows.length >= 18, `the scenario ran (${rows.length} cases${errs(r).length ? '; ' + errs(r).slice(0, 2).join(' | ') : ''})`);
rows.forEach((l) => { const [verdict, label, got] = l.split('\t'); t.check(verdict === 'PASS', `${label} — ${got}`); });

psql(['-qAt', '-c', `drop database if exists ${db}`]);
process.exit(t.done() ? 1 : 0);
