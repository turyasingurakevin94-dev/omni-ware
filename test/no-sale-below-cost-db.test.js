#!/usr/bin/env node
'use strict';
/*
 * No sale below cost (0171; docs/spec/02-money.md §8 Q16, docs/rebuild.md
 * "Backend fixes decided"): the database refuses a line priced below its
 * cost, except a line given away, whichever app writes.
 *
 *   1. The SQL text: the two refusals, and what is left alone.
 *   2. A REAL database, when OW_PG names one: every migration in order, 0171
 *      run twice, then test/fixtures/no-sale-below-cost-scenario.sql as
 *      Sales, the Buyer, the Manager, the owner's console, the server with
 *      no login, and the hourly run.
 *
 * Run: node test/no-sale-below-cost-db.test.js
 *      OW_PG="host=/var/tmp/owpg port=5499 user=postgres" node test/no-sale-below-cost-db.test.js
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { read, createReporter } = require('./_extract');

const t = createReporter('No sale below cost (0171)');
const raw = read('supabase/migrations/0171_no_sale_below_cost.sql');
const sql = raw.replace(/--[^\n]*/g, '');

/* ---------------- 1. the SQL text ---------------- */
{
  t.check(/Safe to run twice/.test(raw) && /ROLLBACK/.test(raw) && /CHECK AFTERWARDS/.test(raw), 'the header says it runs twice, and how to check and roll back');
  t.check(/\| 0171 \| /.test(read('docs/decision-rights.md')), 'docs/decision-rights.md reserves 0171');
  t.check(/- \[x\] No line priced below cost, except given away \(money Q16\)/.test(read('docs/rebuild.md')), 'docs/rebuild.md ticks it off');
  const fn = sql.slice(sql.indexOf('function ow_line_sells_under_cost'), sql.indexOf('function saved_quotes_cost_floor'));
  t.check(/givenAway' ->> 'why'/.test(fn) && /if sell = 0 then return false/.test(fn), 'a line given away, and a line at 0, are left to 0169');
  t.check(/now_price < cost/.test(fn) && /ow_line_sell_price\(p_shop_id, it, p_presets\)/.test(fn), 'under its cost: the typed price, else the shop\'s');
  const tr = sql.slice(sql.indexOf('function saved_quotes_cost_floor'));
  t.check(/auth\.uid\(\) is not null/.test(tr) && /errcode = 'OWCST'/.test(tr), 'a price a person types under the cost is refused (OWCST)');
  t.check(/o ->> 'lineId' = it ->> 'lineId'/.test(tr), 'judged only when the price is new, line by line');
  t.check(/not coalesce\(old\.invoiced, false\)/.test(tr) && /errcode = 'OWPRC'/.test(tr), 'never billed under the cost: OWPRC, which the hourly run sends to price.approve');
  t.check(/v_code in \('OWTPC', 'OWPRC', 'OWGIV'\) then 'price\.approve'/.test(read('supabase/migrations/0169_manager_money_integrity.sql')), '0169\'s hourly run still routes OWPRC to the Manager\'s prices');
  t.check(/current_setting\('ow\.money_fix', true\)/.test(tr), 'a correction script may switch it off for its own transaction, as 0165\'s check');
  t.check(/create trigger saved_quotes_zz_cost_floor before insert or update on saved_quotes/.test(sql), 'one trigger on saved_quotes');
}

/* ---------------- 2. on a real database ---------------- */
const conn = process.env.OW_PG;
if (!conn) {
  console.log('skip   - OW_PG is not set, so the scenario is not run on a database (see the header of this file)');
  process.exit(t.done() ? 1 : 0);
}
const db = 'ow_no_sale_below_cost_test';
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
const again = onDb(['-qAt', '-v', 'ON_ERROR_STOP=1', '-f', path.join(migDir, '0171_no_sale_below_cost.sql')]);
t.check(again.status === 0, `0171 runs a second time without error (${errs(again)[0] || 'ok'})`);

const r = onDb(['-qAt', '-F', '\t'], fs.readFileSync(path.join(__dirname, 'fixtures', 'no-sale-below-cost-scenario.sql'), 'utf8'));
const rows = (r.stdout || '').split('\n').filter((l) => /^(PASS|FAIL)\t/.test(l));
t.check(rows.length >= 24, `the scenario ran (${rows.length} cases${errs(r).length ? '; ' + errs(r).slice(0, 2).join(' | ') : ''})`);
rows.forEach((l) => { const [verdict, label, got] = l.split('\t'); t.check(verdict === 'PASS', `${label} — ${got}`); });

psql(['-qAt', '-c', `drop database if exists ${db}`]);
process.exit(t.done() ? 1 : 0);
