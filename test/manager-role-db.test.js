#!/usr/bin/env node
'use strict';
/*
 * The manager role (0116), asked of a REAL database: everything a Manager
 * login may write, the hand-overs and the credit yes on top, and the same
 * refusals on debts, limits, terms, invoicing and voiding -- 0116 moves
 * the two guards from Sales alone onto both desk roles.
 *
 * So this applies every migration, in order, to a fresh Postgres
 * database with a small stand-in for Supabase's auth schema
 * (test/fixtures/supabase-shim.sql), then signs in as the owner, a Manager
 * login and a worker and tries what each may and may not do
 * (test/fixtures/manager-role-scenario.sql).
 *
 * It needs a Postgres it may create databases on, named by OW_PG as a
 * libpq connection string -- e.g.
 *   OW_PG="host=/var/tmp/owpg port=5499 user=postgres" node test/manager-role-db.test.js
 * Without OW_PG it says so and passes, because most machines that run
 * the suite have no database; the text checks still run everywhere.
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { createReporter } = require('./_extract');

const t = createReporter('the manager role, on a real database');
const conn = process.env.OW_PG;
if (!conn) {
  console.log('skip   - OW_PG is not set, so there is no database to ask (see the header of this file)');
  process.exit(t.done() ? 1 : 0);
}

const db = 'ow_manager_role_test';
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

/* 0116 is pasted by hand, and sometimes twice. */
const again = onDb(['-qAt', '-v', 'ON_ERROR_STOP=1', '-f', path.join(migDir, '0116_manager_role.sql')]);
t.check(again.status === 0, `0116 runs a second time without error (${(again.stderr || '').trim().split('\n')[0] || 'ok'})`);
/* 0122 redraws the two guards 0116 makes, so a second paste of 0116 is
   followed by 0122 again, as 0122's header says. */
const after122 = onDb(['-qAt', '-v', 'ON_ERROR_STOP=1', '-f', path.join(migDir, '0122_manager_decisions.sql')]);
t.check(after122.status === 0, `0122 runs again after it (${(after122.stderr || '').trim().split('\n')[0] || 'ok'})`);

const scenario = fs.readFileSync(path.join(__dirname, 'fixtures', 'manager-role-scenario.sql'), 'utf8');
const run = onDb(['-qAt', '-F', '\t'], scenario);
const rows = (run.stdout || '').split('\n').filter((l) => /^(PASS|FAIL)\t/.test(l));
t.check(rows.length >= 40, `the scenario ran (${rows.length} cases)`);
rows.forEach((l) => {
  const [verdict, label, got] = l.split('\t');
  t.check(verdict === 'PASS', `${label} — ${got}`);
});

psql(['-qAt', '-c', `drop database if exists ${db}`]);
process.exit(t.done() ? 1 : 0);
