#!/usr/bin/env node
'use strict';
/*
 * A trip's runner is told (0150): the runner a trip is sent or given to, the
 * runner it is taken from, and the runner of a trip the Buyer cancels.
 *
 *   1. The SQL text, and the Buyer's chase that writes it.
 *   2. A REAL database, when OW_PG names one: every migration in order,
 *      0150 run twice, then test/fixtures/push-trip-runner-scenario.sql.
 *
 * Run: node test/push-trip-runner-db.test.js
 *      OW_PG="host=/var/tmp/owpg port=5499 user=postgres" node test/push-trip-runner-db.test.js
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { read, createReporter } = require('./_extract');

const t = createReporter('a trip\'s runner is told (0150)');
const raw = read('supabase/migrations/0150_buyer_trip_runner_told.sql');
const sql = raw.replace(/--[^\n]*/g, '');

/* ---------------- 1. the text ---------------- */
{
  t.check(/'tripsent:' \|\| rnd \|\| ':' \|\| new\.assigned_worker_id/.test(sql), 'the runner is told once per round, per runner');
  t.check(/'triptaken:' \|\| new\.id/.test(sql) && /'tripcancel:' \|\| new\.id/.test(sql), 'the runner a trip is taken from, or cancelled for, is told');
  t.check(/'tripback:' \|\| rnd \|\| ':store'/.test(sql) && /'tripdiff:' \|\| new\.id/.test(sql), '0147\'s pushes stay as they were');
  t.check(/<> '__supplier__'/.test(sql), 'a supplier bringing it is nobody to push');
  t.check(/perform ow_push\(/.test(sql) && !/insert into push_outbox/.test(sql) && /exception when others then/.test(sql), 'through ow_push, and a push that fails never stops the write');
  t.check(/Safe to run twice/.test(raw) && /ROLLBACK/.test(raw) && /CHECK AFTERWARDS/.test(raw), 'the header says it runs twice, and how to check and roll back');
  t.check(/\| 0150 \| /.test(read('docs/decision-rights.md')), 'docs/decision-rights.md reserves 0150 for this build');
  const buyer = read('buyer.html');
  t.check(/note: 'Cancelled/.test(buyer) || /'Cancelled: /.test(buyer), 'the Buyer\'s cancel writes the note the push reads');
}

/* ---------------- 2. on a real database ---------------- */
const conn = process.env.OW_PG;
if (!conn) {
  console.log('skip   - OW_PG is not set, so the scenario is not run on a database (see the header of this file)');
  process.exit(t.done() ? 1 : 0);
}
const db = 'ow_push_trip_runner_test';
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
const again = onDb(['-qAt', '-v', 'ON_ERROR_STOP=1', '-f', path.join(migDir, '0150_buyer_trip_runner_told.sql')]);
t.check(again.status === 0, `0150 runs a second time without error (${(again.stderr || '').trim().split('\n').filter((l) => /ERROR/.test(l))[0] || 'ok'})`);

const scenario = fs.readFileSync(path.join(__dirname, 'fixtures', 'push-trip-runner-scenario.sql'), 'utf8');
const run = onDb(['-qAt', '-F', '\t'], scenario);
const rows = (run.stdout || '').split('\n').filter((l) => /^(PASS|FAIL)\t/.test(l));
t.check(rows.length >= 9, `the scenario ran (${rows.length} cases${run.stderr ? '; ' + run.stderr.trim().split('\n').filter((l) => /ERROR/.test(l)).slice(0, 2).join(' | ') : ''})`);
rows.forEach((l) => {
  const [verdict, label, got] = l.split('\t');
  t.check(verdict === 'PASS', `${label} — ${got}`);
});

psql(['-qAt', '-c', `drop database if exists ${db}`]);
process.exit(t.done() ? 1 : 0);
