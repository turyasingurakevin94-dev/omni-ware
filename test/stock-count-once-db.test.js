#!/usr/bin/env node
'use strict';
/*
 * A stock count no longer counts delivered goods out twice (0141): what
 * orders packed, out or delivered but not yet invoiced have taken off the
 * shelf is counted back in when the count is accepted, so the invoice takes
 * it off once.
 *
 *   1. The SQL text: accept_stock_count is 0115's but for the marked change.
 *   2. A REAL database, when OW_PG names one: every migration in order, 0141
 *      run twice, then test/fixtures/stock-count-once-scenario.sql.
 *
 * Run: node test/stock-count-once-db.test.js
 *      OW_PG="host=/var/tmp/owpg port=5499 user=postgres" node test/stock-count-once-db.test.js
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { read, createReporter } = require('./_extract');

const t = createReporter('a stock count counts once (0141)');
const raw = read('supabase/migrations/0141_stock_count_counts_once.sql');
const sql = raw.replace(/--[^\n]*/g, '');

/* ---------------- 1. the change, and only it ---------------- */
{
  const strip = (x) => x.replace(/--[^\n]*/g, '').replace(/\s+/g, ' ').trim();
  const fnOf = (s) => { const a = s.indexOf('create or replace function accept_stock_count('); return s.slice(a, s.indexOf('$$;', s.indexOf('end;', a)) + 3); };
  const was = strip(fnOf(read('supabase/migrations/0115_store_role.sql')));
  const now = strip(fnOf(raw))
    .replace(' gone numeric;', '')
    .replace(" if k is null then continue; end if; gone := ow_held_gone(c.shop_id, k); after := greatest(0, round(coalesce((l ->> 'counted')::numeric, 0), 6)) + gone;",
             " after := greatest(0, round(coalesce((l ->> 'counted')::numeric, 0), 6)); if k is null then continue; end if;")
    .replace(" || case when gone > 0 then ' · ' || trim_scale(gone) || ' out on orders not yet invoiced' else '' end,", ',');
  t.check(now === was, 'accept_stock_count is 0115\'s but for counting back what live orders took');
  const held = sql.slice(sql.indexOf('create or replace function ow_held_gone('), sql.indexOf('create or replace function accept_stock_count('));
  t.check(/not s\.invoiced and not coalesce\(s\.voided, false\)/.test(held) && /cancelledAt/.test(held), 'only orders not invoiced, voided or cancelled');
  t.check(/s\.status in \('pending_delivery', 'completed'\)/.test(held) && /s\.payload ->> 'pickingStatus' = 'done'/.test(held), 'whose goods have left the shelf: packed, out, or delivered');
  t.check(/'__stock__' or ow_line_received\(it\)/.test(held) && /ow_on_shelf\(/.test(held), 'the lines the invoice takes, converted the way the invoice converts them');
  t.check(/Safe to run twice/.test(raw) && /ROLLBACK/.test(raw) && /CHECK AFTERWARDS/.test(raw), 'the header says it runs twice, and how to check and roll back');
  t.check(/\| 0141 \| /.test(read('docs/decision-rights.md')), 'docs/decision-rights.md reserves 0141 for this build');
  const others = fs.readdirSync(path.join(__dirname, '..', 'supabase', 'migrations')).filter((f) => /^\d{4}_.*\.sql$/.test(f)).sort()
    .filter((f) => /create or replace function accept_stock_count\(/.test(read('supabase/migrations/' + f)));
  t.check(others[others.length - 1] === '0141_stock_count_counts_once.sql', 'in number order, 0141 is the last word on accept_stock_count');
}

/* ---------------- 2. on a real database ---------------- */
const conn = process.env.OW_PG;
if (!conn) {
  console.log('skip   - OW_PG is not set, so the scenario is not run on a database (see the header of this file)');
  process.exit(t.done() ? 1 : 0);
}
const db = 'ow_stock_count_once_test';
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
const again = onDb(['-qAt', '-v', 'ON_ERROR_STOP=1', '-f', path.join(migDir, '0141_stock_count_counts_once.sql')]);
t.check(again.status === 0, `0141 runs a second time without error (${(again.stderr || '').trim().split('\n').filter((l) => /ERROR/.test(l))[0] || 'ok'})`);

const scenario = fs.readFileSync(path.join(__dirname, 'fixtures', 'stock-count-once-scenario.sql'), 'utf8');
const run = onDb(['-qAt', '-F', '\t'], scenario);
const rows = (run.stdout || '').split('\n').filter((l) => /^(PASS|FAIL)\t/.test(l));
t.check(rows.length >= 9, `the scenario ran (${rows.length} cases${run.stderr ? '; ' + run.stderr.trim().split('\n').filter((l) => /ERROR/.test(l)).slice(0, 2).join(' | ') : ''})`);
rows.forEach((l) => {
  const [verdict, label, got] = l.split('\t');
  t.check(verdict === 'PASS', `${label} — ${got}`);
});

psql(['-qAt', '-c', `drop database if exists ${db}`]);
process.exit(t.done() ? 1 : 0);
