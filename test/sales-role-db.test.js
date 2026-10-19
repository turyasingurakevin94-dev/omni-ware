#!/usr/bin/env node
'use strict';
/*
 * The sales role, asked of a REAL database.
 *
 * test/sales-desk.test.js reads 0113 as text. Reading is not running:
 * the first draft of 0113 read correctly and would have refused every
 * payment a salesperson took, because the app saves by upsert and
 * Postgres fires the INSERT trigger on the proposed row even when it is
 * about to become an update. Only a database says that.
 *
 * So this applies every migration, in order, to a fresh Postgres
 * database with a small stand-in for Supabase's auth schema
 * (test/fixtures/supabase-shim.sql), then signs in as the owner, a Sales
 * login and a worker and tries what each may and may not do
 * (test/fixtures/sales-role-scenario.sql).
 *
 * It needs a Postgres it may create databases on, named by OW_PG as a
 * libpq connection string -- e.g.
 *   OW_PG="host=/var/tmp/owpg port=5499 user=postgres" node test/sales-role-db.test.js
 * Without OW_PG it says so and passes, because most machines that run
 * the suite have no database; the text checks still run everywhere.
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { createReporter } = require('./_extract');

const t = createReporter('the sales role, on a real database');
const conn = process.env.OW_PG;
if (!conn) {
  console.log('skip   - OW_PG is not set, so there is no database to ask (see the header of this file)');
  process.exit(t.done() ? 1 : 0);
}

const db = 'ow_sales_role_test';
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

/* 0113 is pasted by hand, and sometimes twice. */
const again = onDb(['-qAt', '-v', 'ON_ERROR_STOP=1', '-f', path.join(migDir, '0113_sales_role.sql')]);
t.check(again.status === 0, `0113 runs a second time without error (${(again.stderr || '').trim().split('\n')[0] || 'ok'})`);

const scenario = fs.readFileSync(path.join(__dirname, 'fixtures', 'sales-role-scenario.sql'), 'utf8');
const run = onDb(['-qAt', '-F', '\t'], scenario);
const rows = (run.stdout || '').split('\n').filter((l) => /^(PASS|FAIL)\t/.test(l));
t.check(rows.length >= 40, `the scenario ran (${rows.length} cases)`);
rows.forEach((l) => {
  const [verdict, label, got] = l.split('\t');
  t.check(verdict === 'PASS', `${label} — ${got}`);
});

psql(['-qAt', '-c', `drop database if exists ${db}`]);
process.exit(t.done() ? 1 : 0);
