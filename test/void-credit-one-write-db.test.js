#!/usr/bin/env node
'use strict';
/*
 * A void and a credit note are each one database write (0176;
 * docs/spec/01-order-journey.md §5 Q6, docs/rebuild.md "Backend fixes
 * decided"): void_invoice and raise_credit_note do all of it, or none of it.
 *
 *   1. The SQL text.
 *   2. A REAL database, when OW_PG names one: every migration in order, 0176
 *      run twice, then test/fixtures/void-credit-one-write-scenario.sql.
 *
 * Run: node test/void-credit-one-write-db.test.js
 *      OW_PG="host=/var/tmp/owpg port=5499 user=postgres" node test/void-credit-one-write-db.test.js
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { read, createReporter } = require('./_extract');

const t = createReporter('A void and a credit note, one write each (0176)');
const raw = read('supabase/migrations/0176_void_and_credit_note_one_write.sql');
const sql = raw.replace(/--[^\n]*/g, '');

/* ---------------- 1. the SQL text ---------------- */
{
  t.check(/Safe to run twice/.test(raw) && /ROLLBACK/.test(raw) && /CHECK AFTERWARDS/.test(raw), 'the header says it runs twice, and how to check and roll back');
  t.check(/\| 0176 \| /.test(read('docs/decision-rights.md')), 'docs/decision-rights.md reserves 0176');
  t.check(/- \[x\] A void and a credit note are each one database write/.test(read('docs/rebuild.md')), 'docs/rebuild.md ticks it off');
  const v = sql.slice(sql.indexOf('create or replace function void_invoice'), sql.indexOf('create or replace function raise_credit_note'));
  t.check(/has_task\(p_shop_id, 'invoice\.void'\)/.test(v) && /res := void_with_money\(p_shop_id, q\.id, p_choice, p_account\)/.test(v), 'void_invoice: invoice.void, and the void with its money through void_with_money (0169)');
  t.check(/'_stockTaken'/.test(v) && /manager_stock_move\(p_shop_id, back, 'reversal', 'Voided — ' \|\| lbl, 'invoice\.void'\)/.test(v), 'back on the shelf: what the invoice took, never the line\'s quantity');
  t.check(/not coalesce\(q\.invoiced, false\)/.test(v), 'only an invoice is voided (before the bill it is a cancel)');
  const c = sql.slice(sql.indexOf('create or replace function raise_credit_note'));
  t.check(/has_task\(p_shop_id, 'credit_note\.raise'\)/.test(c) && /ow_reserve_row_ids\(p_shop_id, 'row:credit_note', floor_no, 1\)/.test(c), 'raise_credit_note: credit_note.raise, numbered from the shop\'s one sequence');
  t.check(/qty > room \+ 0\.000001/.test(c) && /coalesce\(c ->> 'voided', 'false'\) <> 'true'/.test(c), 'never more than the line has left to credit');
  t.check(/perform decide_invoice_ask\(p_ask, 'accepted'\)/.test(v) && /perform decide_invoice_ask\(p_ask, 'accepted'\)/.test(c), 'each closes its ask in the same write');
  t.check(/creditNote: *\{kind: *'row:credit_note'/.test(read('index.html')), 'the console numbers credit notes from the same sequence (row:credit_note)');
}

/* ---------------- 2. on a real database ---------------- */
const conn = process.env.OW_PG;
if (!conn) {
  console.log('skip   - OW_PG is not set, so the scenario is not run on a database (see the header of this file)');
  process.exit(t.done() ? 1 : 0);
}
const db = 'ow_void_credit_one_write_test';
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
const again = onDb(['-qAt', '-v', 'ON_ERROR_STOP=1', '-f', path.join(migDir, '0176_void_and_credit_note_one_write.sql')]);
t.check(again.status === 0, `0176 runs a second time without error (${errs(again)[0] || 'ok'})`);

const r = onDb(['-qAt', '-F', '\t'], fs.readFileSync(path.join(__dirname, 'fixtures', 'void-credit-one-write-scenario.sql'), 'utf8'));
const rows = (r.stdout || '').split('\n').filter((l) => /^(PASS|FAIL)\t/.test(l));
t.check(rows.length >= 25, `the scenario ran (${rows.length} cases${errs(r).length ? '; ' + errs(r).slice(0, 2).join(' | ') : ''})`);
rows.forEach((l) => { const [verdict, label, got] = l.split('\t'); t.check(verdict === 'PASS', `${label} — ${got}`); });

psql(['-qAt', '-c', `drop database if exists ${db}`]);
process.exit(t.done() ? 1 : 0);
