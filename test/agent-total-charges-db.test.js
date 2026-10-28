#!/usr/bin/env node
'use strict';
/*
 * An agent order's total counts its charges (0172; docs/spec/02-money.md §8
 * Q14, docs/rebuild.md "Backend fixes decided"): order_shop_total, the SQL
 * twin of the agent edge functions' orderShopTotal, is goods + charges, so
 * mobile money and the agent's credit both see the delivery fee.
 *
 *   1. The SQL text, and the edge functions it must agree with.
 *   2. A REAL database, when OW_PG names one: every migration in order, 0172
 *      run twice, then test/fixtures/agent-total-charges-scenario.sql as the
 *      edge functions run it (service role).
 *
 * Run: node test/agent-total-charges-db.test.js
 *      OW_PG="host=/var/tmp/owpg port=5499 user=postgres" node test/agent-total-charges-db.test.js
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { read, createReporter } = require('./_extract');

const t = createReporter('Agent order total counts charges (0172)');
const raw = read('supabase/migrations/0172_agent_total_counts_charges.sql');
const sql = raw.replace(/--[^\n]*/g, '');

/* ---------------- 1. the SQL text ---------------- */
{
  t.check(/Safe to run twice/.test(raw) && /ROLLBACK/.test(raw) && /CHECK AFTERWARDS/.test(raw), 'the header says it runs twice, and how to check and roll back');
  t.check(/\| 0172 \| /.test(read('docs/decision-rights.md')), 'docs/decision-rights.md reserves 0172');
  t.check(/- \[x\] Agent order total counts charges \(money Q14\)/.test(read('docs/rebuild.md')), 'docs/rebuild.md ticks it off');
  t.check(/create or replace function public\.order_shop_total\(p jsonb\) returns numeric/.test(sql) && /p -> 'charges'/.test(sql), 'order_shop_total keeps its signature and reads the charges');
  t.check(/ch ->> 'type' = 'percent' then round\(g \* public\.jsonb_num\(ch -> 'value'\) \/ 100\)/.test(sql) && /else round\(public\.jsonb_num\(ch -> 'value'\)\)/.test(sql) && /jsonb_num\(ch -> 'value'\) > 0/.test(sql),
    'a percent is of the goods, a fixed charge whole shillings, nothing at or below 0');
  // The edge functions it is the twin of all add the charges.
  ['agent-change-order', 'agent-initiate-momo-payment', 'check-momo-payment-status'].forEach((f) => {
    const ts = read(`supabase/functions/${f}/index.ts`);
    t.check(/function chargesTotal\(payload: any, goods: number\)/.test(ts) && /ch\.type === "percent" \? Math\.round\(goods \* v \/ 100\) : Math\.round\(v\)/.test(ts) && /if \(!\(v > 0\)\) return s;/.test(ts),
      `${f} counts the charges by the same rule`);
  });
}

/* ---------------- 2. on a real database ---------------- */
const conn = process.env.OW_PG;
if (!conn) {
  console.log('skip   - OW_PG is not set, so the scenario is not run on a database (see the header of this file)');
  process.exit(t.done() ? 1 : 0);
}
const db = 'ow_agent_total_charges_test';
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
const again = onDb(['-qAt', '-v', 'ON_ERROR_STOP=1', '-f', path.join(migDir, '0172_agent_total_counts_charges.sql')]);
t.check(again.status === 0, `0172 runs a second time without error (${errs(again)[0] || 'ok'})`);

const r = onDb(['-qAt', '-F', '\t'], fs.readFileSync(path.join(__dirname, 'fixtures', 'agent-total-charges-scenario.sql'), 'utf8'));
const rows = (r.stdout || '').split('\n').filter((l) => /^(PASS|FAIL)\t/.test(l));
t.check(rows.length >= 11, `the scenario ran (${rows.length} cases${errs(r).length ? '; ' + errs(r).slice(0, 2).join(' | ') : ''})`);
rows.forEach((l) => { const [verdict, label, got] = l.split('\t'); t.check(verdict === 'PASS', `${label} — ${got}`); });

psql(['-qAt', '-c', `drop database if exists ${db}`]);
process.exit(t.done() ? 1 : 0);
