#!/usr/bin/env node
'use strict';
/*
 * Sales round 1, data integrity (0165; docs/audit/sales/ROUND-1.md): an
 * order's money holds together on the server, whoever writes.
 *
 *   1. The SQL text: each check, function and change the round planned.
 *   2. A REAL database, when OW_PG names one: every migration in order,
 *      0165 run twice, then test/fixtures/sales-round1-scenario.sql, as the
 *      owner, the Manager, Sales and Accounts.
 *
 * Run: node test/sales-round1-db.test.js
 *      OW_PG="host=/var/lib/postgresql/owtest port=5433 user=postgres" node test/sales-round1-db.test.js
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { read, createReporter } = require('./_extract');

const t = createReporter('Sales round 1: money holds together (0165)');
const raw = read('supabase/migrations/0165_sales_money_holds_together.sql');
const sql = raw.replace(/--[^\n]*/g, '');

/* ---------------- 1. the text ---------------- */
{
  t.check(/continue when ow_line_to_confirm\(p_shop_id, it, presets\);/.test(sql) && /round\(greatest\(0, coalesce\(ow_num\(it ->> 'qty'\), 0\)\) \* coalesce\(ow_line_sell_price/.test(sql) && /return greatest\(0, cash \+ credit - credited\)/.test(sql),
    'SAL-007/003/004: a line nobody priced is never in a total, each line is whole UGX, a total is never below 0');
  t.check(/create trigger saved_quotes_zz_money_check before insert or update on saved_quotes/.test(sql) && /'A payment needs its receipt\.'/.test(sql) && /That payment doesn''t match its receipt/.test(sql) && /is not the sum of the payments/.test(sql),
    'SAL-010/012: a payment matches its receipt, and paid is the sum of the payments');
  t.check(/A payment can''t be dropped while its receipt still names the order/.test(sql), 'SAL-013: a stale copy can\'t drop a payment whose receipt stands');
  t.check(/A line can''t have a count below 0/.test(sql) && /A price can''t be below 0/.test(sql), 'SAL-006: no count or price below 0');
  t.check(/Credit notes \(%\) can''t be more than the bill/.test(sql), 'SAL-004: credit notes never above the bill');
  t.check(/create trigger saved_quotes_zz_sync_debt before update on saved_quotes/.test(sql) && /ow_system_begin\(\)/.test(sql), 'SAL-011: an invoice\'s share of the balance follows what is due on it, on the server');
  t.check(/create trigger cash_txns_zz_payment_check before update on cash_txns/.test(sql), 'SAL-010: a receipt a payment points to moves only with it');
  t.check(/p_over text default null/.test(sql) && /Paid over by %: give change, or keep it as a deposit\./.test(sql) && /Name the customer to keep a deposit\./.test(sql), 'SAL-005: paid over is change, or a deposit the customer confirms');
  t.check(/dep_use := least\(desired, -v_before\)/.test(sql) && /'Deposit used — ' \|\| inv_label/.test(sql) && /amount_paid = coalesce\(amount_paid, 0\) \+ dep_use/.test(sql), 'a new invoice uses the deposit first, logged on no bill');
  t.check(/create or replace function ow_patch_order/.test(sql) && /security invoker/.test(sql) && /k in \('payments', 'debtCharged', 'amountPaid'\)/.test(sql) && /- coalesce\(p_drop/.test(sql), 'SAL-013: ow_patch_order merges and drops only the keys it is given, never the money keys, under the caller\'s own rules');
  t.check(/create or replace function ow_settle_over/.test(sql) && /p_how not in \('deposit', 'change'\)/.test(sql), 'SAL-005: Esther settles an order paid over as a deposit, or change given back');
  t.check(/create or replace function ow_correct_payment/.test(sql) && /has_task\(p_shop_id, 'payment\.edit'\)/.test(sql), 'Accounts corrects a payment in one transaction (payment.edit)');
  t.check(/what in \('method', 'amount', 'bill', 'day', 'over', 'balance'\)/.test(sql) && /cash_txn_id is not null or what = 'balance'/.test(sql), 'two new asks: over and balance');
  t.check(/create view ow_balance_check with \(security_invoker = true\)/.test(sql), 'the balance check reads under the reader\'s own policies');
  t.check(/Safe to run twice/.test(raw) && /ROLLBACK/.test(raw) && /CHECK AFTERWARDS/.test(raw), 'the header says it runs twice, and how to check and roll back');
  const doc = read('docs/decision-rights.md');
  t.check(/\| 0165 \| Sales, fifth/.test(doc), 'docs/decision-rights.md reserves 0165');
}

/* ---------------- 2. on a real database ---------------- */
const conn = process.env.OW_PG;
if (!conn) {
  console.log('skip   - OW_PG is not set, so the scenario is not run on a database (see the header of this file)');
  process.exit(t.done() ? 1 : 0);
}
const db = 'ow_sales_round1_test';
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
const again = onDb(['-qAt', '-v', 'ON_ERROR_STOP=1', '-f', path.join(migDir, '0165_sales_money_holds_together.sql')]);
t.check(again.status === 0, `0165 runs a second time without error (${(again.stderr || '').trim().split('\n').filter((l) => /ERROR/.test(l))[0] || 'ok'})`);
const scenario = fs.readFileSync(path.join(__dirname, 'fixtures', 'sales-round1-scenario.sql'), 'utf8');
const run = onDb(['-qAt', '-F', '\t'], scenario);
const rows = (run.stdout || '').split('\n').filter((l) => /^(PASS|FAIL)\t/.test(l));
t.check(rows.length >= 37, `the scenario ran (${rows.length} cases${run.stderr ? '; ' + run.stderr.trim().split('\n').filter((l) => /ERROR/.test(l)).slice(0, 2).join(' | ') : ''})`);
rows.forEach((l) => {
  const [verdict, label, got] = l.split('\t');
  t.check(verdict === 'PASS', `${label} — ${got}`);
});
psql(['-qAt', '-c', `drop database if exists ${db}`]);
process.exit(t.done() ? 1 : 0);
