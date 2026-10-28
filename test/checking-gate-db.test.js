#!/usr/bin/env node
'use strict';
/*
 * The Checking gate checks (0174; docs/spec/01-order-journey.md §5 Q1,
 * docs/spec/02-money.md §8 Q8, docs/rebuild.md "Backend fixes decided"):
 * suppliers' yes, a line with no supplier, an agent's prepay, and debt past
 * the hold days hold an order in Checking, whichever app moves it.
 *
 *   1. The SQL text, and the Buyer app's rules it copies.
 *   2. A REAL database, when OW_PG names one: every migration in order, 0174
 *      run twice, then test/fixtures/checking-gate-scenario.sql.
 *
 * Run: node test/checking-gate-db.test.js
 *      OW_PG="host=/var/tmp/owpg port=5499 user=postgres" node test/checking-gate-db.test.js
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { read, createReporter } = require('./_extract');

const t = createReporter('The Checking gate checks (0174)');
const raw = read('supabase/migrations/0174_checking_gate_checks.sql');
const sql = raw.replace(/--[^\n]*/g, '');

/* ---------------- 1. the SQL text ---------------- */
{
  t.check(/Safe to run twice/.test(raw) && /ROLLBACK/.test(raw) && /CHECK AFTERWARDS/.test(raw), 'the header says it runs twice, and how to check and roll back');
  t.check(/\| 0174 \| /.test(read('docs/decision-rights.md')), 'docs/decision-rights.md reserves 0174');
  t.check(/- \[x\] The Checking gate checks suppliers' yes/.test(read('docs/rebuild.md')), 'docs/rebuild.md ticks it off');
  const g = sql.slice(sql.indexOf('create or replace function ow_gate_reason'), sql.indexOf('do $mig$'));
  const at = (w) => g.indexOf(`return '${w}'`);
  t.check(at('price') > 0 && at('price') < at('credit') && at('credit') < at('suppliers') && at('suppliers') < at('unsourced') && at('unsourced') < at('prepay'),
    'price, then credit, then the three new reasons: the pushes and the counter sale read what they read before');
  t.check(/ow_oldest_debt_days\(p_shop_id, c\.id\) > ow_hold_days\(presets\)/.test(g) && /coalesce\(c\.debt, 0\) > 0 and amt > 0 and undecided/.test(g), 'old debt: past the hold days, on an order that adds to it, until the Manager decides');
  t.check(/yes ->> 'state' is distinct from 'confirmed'/.test(g) && /yes ->> 'terms' is distinct from ow_supplier_terms\(items, sid\)/.test(g), 'every supplier said yes, on the lines as they stand');
  t.check(/'clientWaits', ''\) in \('', 'false', '0'\)/.test(g), 'a line with no supplier holds it, unless the client waits for it');
  t.check(/a\.payment_term = 'prepay'/.test(g) && /agentPaymentStatus', ''\) <> 'paid'/.test(g), 'an agent who pays first has paid');
  t.check(/when coalesce\(ow_num\(p_presets -> 'creditHold' ->> 'days'\), 0\) > 0/.test(sql) && /else 21 end/.test(sql), 'hold days: presets.creditHold.days, 21 when unset');
  // The Buyer app's rules it copies, as they stand.
  const buyer = read('buyer.html'), sales = read('sales.html');
  t.check(/function orderSupplierTerms\(q, supplierId\)[\s\S]{0,260}\[it\.productId, it\.variantIdx == null \? '' : it\.variantIdx, Number\(it\.qty\) \|\| 0, Math\.round\(Number\(it\.price\) \|\| 0\)\]\.join\(':'\)\)\.join\('\|'\)/.test(buyer), 'buyer.html orderSupplierTerms is the shape ow_supplier_terms writes');
  t.check(/function noneOpen\(q\)\{ return \(q\.items \|\| \[\]\)\.filter\(it => it && !it\.supplierId && !it\.clientWaits\); \}/.test(buyer), 'buyer.html noneOpen is the unsourced rule');
  t.check(/agent\.paymentTerm === 'prepay' && q\.agentPaymentStatus !== 'paid'/.test(buyer), 'buyer.html agentPaymentBlocksPreparing is the prepay rule');
  t.check(/function holdDays\(\)\{ const h = D\(\)\.presetCreditHold; return h && Number\(h\.days\) > 0 \? Number\(h\.days\) : 21; \}/.test(sales), 'sales.html holdDays is the hold line');
  t.check(/if \(e\.quoteId != null\) for \(const ch of open\)/.test(sales), 'sales.html custOpenCharges clears a payment\'s own bill first');
}

/* ---------------- 2. on a real database ---------------- */
const conn = process.env.OW_PG;
if (!conn) {
  console.log('skip   - OW_PG is not set, so the scenario is not run on a database (see the header of this file)');
  process.exit(t.done() ? 1 : 0);
}
const db = 'ow_checking_gate_test';
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
const again = onDb(['-qAt', '-v', 'ON_ERROR_STOP=1', '-f', path.join(migDir, '0174_checking_gate_checks.sql')]);
t.check(again.status === 0, `0174 runs a second time without error (${errs(again)[0] || 'ok'})`);

const r = onDb(['-qAt', '-F', '\t'], fs.readFileSync(path.join(__dirname, 'fixtures', 'checking-gate-scenario.sql'), 'utf8'));
const rows = (r.stdout || '').split('\n').filter((l) => /^(PASS|FAIL)\t/.test(l));
t.check(rows.length >= 32, `the scenario ran (${rows.length} cases${errs(r).length ? '; ' + errs(r).slice(0, 2).join(' | ') : ''})`);
rows.forEach((l) => { const [verdict, label, got] = l.split('\t'); t.check(verdict === 'PASS', `${label} — ${got}`); });

psql(['-qAt', '-c', `drop database if exists ${db}`]);
process.exit(t.done() ? 1 : 0);
