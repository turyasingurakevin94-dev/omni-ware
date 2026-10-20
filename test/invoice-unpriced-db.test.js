#!/usr/bin/env node
'use strict';
/*
 * The end-to-end test of 19 Oct 2026, fix 2 (0138): invoicing never bills
 * a line that still has no selling price (Q-0541 billed 6 such lines at
 * cost), never makes a debtor of a generic name ("Walk-in"), and the
 * hourly run tells the Manager what it skipped.
 *
 *   1. The SQL text: the refusals, where they sit, and the hourly push.
 *   2. A REAL database, when OW_PG names one: every migration in order,
 *      0138 run twice, then test/fixtures/invoice-unpriced-scenario.sql.
 *
 * Run: node test/invoice-unpriced-db.test.js
 *      OW_PG="host=/var/tmp/owpg port=5499 user=postgres" node test/invoice-unpriced-db.test.js
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { read, createReporter } = require('./_extract');

const t = createReporter('no bill at cost, no walk-in debtor (0138)');
const raw = read('supabase/migrations/0138_no_bill_at_cost_no_walkin_debtor.sql');
const sql = raw.replace(/--[^\n]*/g, '');

/* ---------------- 1. the refusals, in the one core both callers use ---------------- */
{
  const core = sql.slice(sql.indexOf('create or replace function ow_invoice_core('), sql.indexOf('create or replace function ow_invoice_due_orders('));
  t.check(core.length > 1000, 'ow_invoice_core is re-stated here (the Manager\'s button, the counter sale and the hourly run all call it)');
  t.check(/ow_order_unpriced\(p_shop_id, items, presets\) > 0 then\s*raise exception[\s\S]*?errcode = 'OWTPC'/.test(core), 'a line still to price is refused (OWTPC)');
  t.check(core.indexOf("'OWTPC'") < core.indexOf('insert into purchase_invoices') && core.indexOf("'OWTPC'") < core.indexOf('ow_stock_move'),
    'before any bill is raised or any stock moves');
  t.check(/c\.id is null and client is not null and not ow_generic_client\(client\)/.test(core), 'a generic name is never matched or made a customer');
  t.check(/if c\.id is null and delta > 0 then\s*raise exception[\s\S]*?errcode = 'OWWLK'/.test(core), 'money owed with nobody to owe it is refused (OWWLK), not dropped');
  const prev = read('supabase/migrations/0136_counter_sale_one_write.sql');
  const old = prev.slice(prev.indexOf('create or replace function ow_invoice_core('));
  const strip = (x) => x.replace(/--[^\n]*/g, '').replace(/\s+/g, ' ');
  const was = strip(old.slice(0, old.indexOf('end $$;') + 7));
  const now = strip(core.slice(0, core.indexOf('end $$;') + 7))
    .replace(/ if ow_order_unpriced[\s\S]*?end if;/, '').replace(' and not ow_generic_client(client)', '')
    .replace(/ if c\.id is null and delta > 0 then[\s\S]*?end if;/, '');
  t.check(now === was, 'and is otherwise 0136\'s, line for line');
  const run = sql.slice(sql.indexOf('create or replace function ow_invoice_due_orders('));
  t.check(/perform ow_push\(r\.shop_id, 'invoice\.held'/.test(run) && /'invheld:' \|\| r\.id \|\| ':' \|\| v_code \|\| ':' \|\| ow_today\(\)/.test(run),
    'the hourly run pushes each order it skips, once a day');
  t.check(/when v_code in \('OWTPC', 'OWPRC'\) then 'price\.approve'/.test(run) && !/to_role|'owner'/.test(run), 'to the task that clears it, never the owner');
  t.check(/Safe to run twice/.test(raw) && /ROLLBACK/.test(raw) && /CHECK AFTERWARDS/.test(raw), 'the header says it runs twice, and how to check and roll back');
  t.check(/\| 0138 \| /.test(read('docs/decision-rights.md')), 'docs/decision-rights.md reserves 0138 for this build');
}

/* ---------------- 2. on a real database ---------------- */
const conn = process.env.OW_PG;
if (!conn) {
  console.log('skip   - OW_PG is not set, so the scenario is not run on a database (see the header of this file)');
  process.exit(t.done() ? 1 : 0);
}
const db = 'ow_invoice_unpriced_test';
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
const again = onDb(['-qAt', '-v', 'ON_ERROR_STOP=1', '-f', path.join(migDir, '0138_no_bill_at_cost_no_walkin_debtor.sql')]);
t.check(again.status === 0, `0138 runs a second time without error (${(again.stderr || '').trim().split('\n').filter((l) => /ERROR/.test(l))[0] || 'ok'})`);

const scenario = fs.readFileSync(path.join(__dirname, 'fixtures', 'invoice-unpriced-scenario.sql'), 'utf8');
const run = onDb(['-qAt', '-F', '\t'], scenario);
const rows = (run.stdout || '').split('\n').filter((l) => /^(PASS|FAIL)\t/.test(l));
t.check(rows.length >= 15, `the scenario ran (${rows.length} cases${run.stderr ? '; ' + run.stderr.trim().split('\n').filter((l) => /ERROR/.test(l)).slice(0, 2).join(' | ') : ''})`);
rows.forEach((l) => {
  const [verdict, label, got] = l.split('\t');
  t.check(verdict === 'PASS', `${label} — ${got}`);
});

psql(['-qAt', '-c', `drop database if exists ${db}`]);
process.exit(t.done() ? 1 : 0);
