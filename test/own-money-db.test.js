#!/usr/bin/env node
'use strict';
/*
 * Own money on the trip (0151): a stop's pay on collection_trips, the
 * Buyer's pay-back handed to Accounts (own_money, pushed), Accounts' cash
 * tied once to the round it started, and a big carton asked of the Manager.
 *
 *   1. The SQL text, and the Buyer app that writes it.
 *   2. A REAL database, when OW_PG names one: every migration in order,
 *      0151 run twice, then test/fixtures/own-money-scenario.sql.
 *
 * Run: node test/own-money-db.test.js
 *      OW_PG="host=/var/tmp/owpg port=5499 user=postgres" node test/own-money-db.test.js
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { read, createReporter } = require('./_extract');

const t = createReporter('own money on the trip (0151)');
const raw = read('supabase/migrations/0151_buyer_own_money_on_the_trip.sql');
const sql = raw.replace(/--[^\n]*/g, '');

/* ---------------- 1. the text ---------------- */
{
  t.check(/add column if not exists pay jsonb/.test(sql) && /add column if not exists for_line text/.test(sql), 'a stop\'s pay on the trip, and a carton\'s line on its refill');
  t.check(/'own_money'/.test(sql) && /kind = 'own_money' and has_task\(shop_id, 'trip\.collect'\)/.test(sql) && /kind = 'own_money' and has_task\(shop_id, 'trip\.cash'\)/.test(sql), 'the Buyer passes own_money (trip.collect), Accounts closes it (trip.cash)');
  t.check(/'trip\.own_money'/.test(sql) && /'ownmoney:' \|\| new\.id/.test(sql) && /null, 'trip\.cash', null/.test(sql), 'Accounts is pushed once per pay-back, by task');
  t.check(/old\.kind = 'trip_cash' and coalesce\(old\.payload ->> 'round', ''\) = ''/.test(sql), 'a trip_cash hand-off gains its round once, and nothing else in a hand-off changes');
  t.check(/'carton\.ask'/.test(sql) && /'restock\.hold'/.test(sql), 'a carton is asked of the Manager by task');
  t.check(/Safe to run twice/.test(raw) && /ROLLBACK/.test(raw) && /CHECK AFTERWARDS/.test(raw), 'the header says it runs twice, and how to check and roll back');
  t.check(/\| 0151 \| /.test(read('docs/decision-rights.md')), 'docs/decision-rights.md reserves 0151 for this build');
  const buyer = read('buyer.html');
  t.check(/passOn\('own_money', 'accounts', 'round:' \+ stem/.test(buyer) && /round: tripRoundStem\(trips\[0\]\.id\), v: 2/.test(buyer) && /status: 'held', for_line: c\.key/.test(buyer), 'the Buyer app writes all three');
}

/* ---------------- 2. on a real database ---------------- */
const conn = process.env.OW_PG;
if (!conn) {
  console.log('skip   - OW_PG is not set, so the scenario is not run on a database (see the header of this file)');
  process.exit(t.done() ? 1 : 0);
}
const db = 'ow_own_money_test';
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
const again = onDb(['-qAt', '-v', 'ON_ERROR_STOP=1', '-f', path.join(migDir, '0151_buyer_own_money_on_the_trip.sql')]);
t.check(again.status === 0, `0151 runs a second time without error (${(again.stderr || '').trim().split('\n').filter((l) => /ERROR/.test(l))[0] || 'ok'})`);

const scenario = fs.readFileSync(path.join(__dirname, 'fixtures', 'own-money-scenario.sql'), 'utf8');
const run = onDb(['-qAt', '-F', '\t'], scenario);
const rows = (run.stdout || '').split('\n').filter((l) => /^(PASS|FAIL)\t/.test(l));
t.check(rows.length >= 12, `the scenario ran (${rows.length} cases${run.stderr ? '; ' + run.stderr.trim().split('\n').filter((l) => /ERROR/.test(l)).slice(0, 2).join(' | ') : ''})`);
rows.forEach((l) => {
  const [verdict, label, got] = l.split('\t');
  t.check(verdict === 'PASS', `${label} — ${got}`);
});

psql(['-qAt', '-c', `drop database if exists ${db}`]);
process.exit(t.done() ? 1 : 0);
