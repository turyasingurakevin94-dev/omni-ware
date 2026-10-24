#!/usr/bin/env node
'use strict';
/*
 * Sales round 2, core workflows (0167; docs/audit/sales/ROUND-2.md): credit
 * for a customer with no limit set waits for the Manager, and test records are
 * marked so no figure counts them.
 *
 *   1. The SQL text.
 *   2. A REAL database, when OW_PG names one: every migration in order, 0167
 *      run twice, then test/fixtures/sales-round2-scenario.sql, as the owner,
 *      the Manager and Sales.
 *
 * Run: node test/sales-round2-db.test.js
 *      OW_PG="host=/var/lib/postgresql/owtest port=5433 user=postgres" node test/sales-round2-db.test.js
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { read, createReporter } = require('./_extract');

const t = createReporter('Sales round 2: credit with no limit, test records (0167)');
const raw = read('supabase/migrations/0167_sales_credit_and_test_records.sql');
const sql = raw.replace(/--[^\n]*/g, '');

/* ---------------- 1. the text ---------------- */
{
  t.check(/elsif jsonb_typeof\(p_payload -> 'credit'\) = 'object' and coalesce\(ow_num\(p_payload -> 'credit' ->> 'pct'\), 0\) > 0 and undecided then\s*return 'credit';/.test(sql),
    'SAL-016: an order on credit for a customer with no limit set waits for the Manager');
  t.check(/if coalesce\(c\.credit_limit, 0\) > 0 then\s*if coalesce\(c\.debt, 0\) \+ amt > c\.credit_limit and undecided then return 'credit'; end if;/.test(sql), 'SAL-016: over a set limit still waits, within it goes on');
  t.check(/' · no limit set'/.test(sql) && /pg_get_functiondef\('public\.saved_quotes_ow_push\(\)'::regprocedure\)/.test(sql), 'SAL-016: the Manager\'s push says no limit is set');
  t.check(['customers', 'saved_quotes', 'cash_txns'].every(tb => new RegExp(`alter table ${tb} add column if not exists qa boolean not null default false`).test(sql)), 'SAL-018: customers, orders and receipts carry a test mark, false by default');
  t.check(/select coalesce\(p, ''\) ~ '\^TEST\\M'/.test(sql) && /'TESTQA'/.test(sql), 'SAL-018: a TEST name, or a TESTQA ref, is a test');
  t.check(!/\bdelete from\b/i.test(sql), 'SAL-018: nothing is deleted');
  t.check(/Safe to run twice/.test(raw) && /ROLLBACK/.test(raw) && /CHECK AFTERWARDS/.test(raw), 'the header says it runs twice, and how to check and roll back');
  const doc = read('docs/decision-rights.md');
  t.check(/\| 0167 \| Sales, sixth/.test(doc), 'docs/decision-rights.md reserves 0167');
}

/* ---------------- 2. on a real database ---------------- */
const conn = process.env.OW_PG;
if (!conn) {
  console.log('skip   - OW_PG is not set, so the scenario is not run on a database (see the header of this file)');
  process.exit(t.done() ? 1 : 0);
}
const db = 'ow_sales_round2_test';
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
const again = onDb(['-qAt', '-v', 'ON_ERROR_STOP=1', '-f', path.join(migDir, '0167_sales_credit_and_test_records.sql')]);
t.check(again.status === 0, `0167 runs a second time without error (${(again.stderr || '').trim().split('\n').filter((l) => /ERROR/.test(l))[0] || 'ok'})`);
const scenario = fs.readFileSync(path.join(__dirname, 'fixtures', 'sales-round2-scenario.sql'), 'utf8');
const run = onDb(['-qAt', '-F', '\t'], scenario);
const rows = (run.stdout || '').split('\n').filter((l) => /^(PASS|FAIL)\t/.test(l));
t.check(rows.length >= 30, `the scenario ran (${rows.length} cases${run.stderr ? '; ' + run.stderr.trim().split('\n').filter((l) => /ERROR/.test(l)).slice(0, 2).join(' | ') : ''})`);
rows.forEach((l) => {
  const [verdict, label, got] = l.split('\t');
  t.check(verdict === 'PASS', `${label} — ${got}`);
});
psql(['-qAt', '-c', `drop database if exists ${db}`]);
process.exit(t.done() ? 1 : 0);
