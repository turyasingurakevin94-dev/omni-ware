#!/usr/bin/env node
'use strict';
/*
 * A round is handed in once (0147): the Buyer hands every stop of a round in
 * together, back at the yard, and the Store and Accounts are told once for
 * the round, not once per stop.
 *
 *   1. The SQL text, and the Buyer app's one hand-in.
 *   2. A REAL database, when OW_PG names one: every migration in order,
 *      0147 run twice, then test/fixtures/push-round-once-scenario.sql.
 *
 * Run: node test/push-round-once-db.test.js
 *      OW_PG="host=/var/tmp/owpg port=5499 user=postgres" node test/push-round-once-db.test.js
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { read, createReporter } = require('./_extract');

const t = createReporter('a round handed in once (0147)');
const raw = read('supabase/migrations/0147_buyer_round_handed_in_once.sql');
const sql = raw.replace(/--[^\n]*/g, '');

/* ---------------- 1. the text ---------------- */
{
  t.check(/function ow_trip_round\(p_id text\)/.test(sql) && /'\^\(TRIP-\[A-Za-z0-9\]\+\)-\[0-9\]\+\$'/.test(sql), 'a round is its stops\' shared id stem');
  t.check(/'tripback:' \|\| rnd \|\| ':store'/.test(sql) && /'tripback:' \|\| rnd \|\| ':cash'/.test(sql), 'the Store and Accounts pushes are keyed on the round');
  t.check(/'tripdiff:' \|\| new\.id/.test(sql), 'a yard difference stays per trip');
  t.check(/not coalesce\(c\.voided, false\)/.test(sql), 'a stop off the round is not counted');
  t.check(/security definer set search_path = public/.test(sql) && /exception when others then/.test(sql), 'security definer, and a push that fails never stops the write');
  t.check(/perform ow_push\(/.test(sql) && !/insert into push_outbox/.test(sql), 'through 0120\'s ow_push, never straight into the outbox');
  t.check(/Safe to run twice/.test(raw) && /ROLLBACK/.test(raw) && /CHECK AFTERWARDS/.test(raw), 'the header says it runs twice, and how to check and roll back');
  t.check(/\| 0147 \| /.test(read('docs/decision-rights.md')), 'docs/decision-rights.md reserves 0147 for this build');
  const buyer = read('buyer.html');
  t.check(/'TRIP-' \+ stamp \+ \(runs\.length > 1 \? '-' \+ \(i \+ 1\) : ''\)/.test(buyer), 'the Buyer app still names a round\'s stops TRIP-<stamp>-<n>');
  t.check(/Stops not reached are off the round first/.test(buyer), 'the Buyer app takes the stops not reached off before handing in, so the count is what came back');
}

/* ---------------- 2. on a real database ---------------- */
const conn = process.env.OW_PG;
if (!conn) {
  console.log('skip   - OW_PG is not set, so the scenario is not run on a database (see the header of this file)');
  process.exit(t.done() ? 1 : 0);
}
const db = 'ow_push_round_once_test';
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
const again = onDb(['-qAt', '-v', 'ON_ERROR_STOP=1', '-f', path.join(migDir, '0147_buyer_round_handed_in_once.sql')]);
t.check(again.status === 0, `0147 runs a second time without error (${(again.stderr || '').trim().split('\n').filter((l) => /ERROR/.test(l))[0] || 'ok'})`);

const scenario = fs.readFileSync(path.join(__dirname, 'fixtures', 'push-round-once-scenario.sql'), 'utf8');
const run = onDb(['-qAt', '-F', '\t'], scenario);
const rows = (run.stdout || '').split('\n').filter((l) => /^(PASS|FAIL)\t/.test(l));
t.check(rows.length >= 13, `the scenario ran (${rows.length} cases${run.stderr ? '; ' + run.stderr.trim().split('\n').filter((l) => /ERROR/.test(l)).slice(0, 2).join(' | ') : ''})`);
rows.forEach((l) => {
  const [verdict, label, got] = l.split('\t');
  t.check(verdict === 'PASS', `${label} — ${got}`);
});

psql(['-qAt', '-c', `drop database if exists ${db}`]);
process.exit(t.done() ? 1 : 0);
