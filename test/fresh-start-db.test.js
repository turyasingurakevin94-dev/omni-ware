#!/usr/bin/env node
'use strict';
/*
 * A fresh start (0146), asked of a REAL database.
 *
 * The copy writes into ninety tables' worth of schema by reading each
 * table's own columns, so only a database can say it works: every
 * migration is applied, in order, to a fresh Postgres with a stand-in for
 * Supabase's auth schema (test/fixtures/supabase-shim.sql), an old shop is
 * made with a bit of everything, and test/fixtures/fresh-start-scenario.sql
 * runs the dry run, the copy and switch day against it.
 *
 * It needs a Postgres it may create databases on, named by OW_PG as a
 * libpq connection string -- e.g.
 *   OW_PG="host=/var/tmp/owpg port=5499 user=postgres" node test/fresh-start-db.test.js
 * Without OW_PG it says so and passes; test/fresh-start.test.js still reads
 * the migration and the runbook everywhere.
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { createReporter } = require('./_extract');

const t = createReporter('a fresh start, on a real database');
const conn = process.env.OW_PG;
if (!conn) {
  console.log('skip   - OW_PG is not set, so there is no database to ask (see the header of this file)');
  process.exit(t.done() ? 1 : 0);
}

const db = 'ow_fresh_start_test';
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
const again = onDb(['-qAt', '-v', 'ON_ERROR_STOP=1', '-f', path.join(migDir, '0146_fresh_start.sql')]);
t.check(again.status === 0, `0146 runs a second time without error (${(again.stderr || '').trim().split('\n')[0] || 'ok'})`);

const scenario = fs.readFileSync(path.join(__dirname, 'fixtures', 'fresh-start-scenario.sql'), 'utf8');
const run = onDb(['-qAt', '-F', '\t'], scenario);
t.check(!/ERROR/.test(run.stderr || ''), `the scenario ran without an error (${(run.stderr || '').split('\n').find((l) => /ERROR/.test(l)) || 'none'})`);
const rows = (run.stdout || '').split('\n').filter((l) => /^(PASS|FAIL)\t/.test(l));
t.check(rows.length >= 40, `the scenario ran (${rows.length} cases)`);
rows.forEach((l) => {
  const [verdict, label] = l.split('\t');
  t.check(verdict === 'PASS', label);
});

/* The staging rehearsal (tools/staging-rehearsal.js), on this database
   after the scenario: it must clean up after itself, run the runbook's
   steps on its made-up shop, and pass its own checks, twice running. */
for (const pass of ['first', 'second']) {
  const r = spawnSync(process.execPath, [path.join(__dirname, '..', 'tools', 'staging-rehearsal.js')],
    { env: { ...process.env, OW_PG: `${conn} dbname=${db}`, GITHUB_STEP_SUMMARY: '' }, encoding: 'utf8' });
  t.check(r.status === 0 && /Every check passed/.test(r.stdout), `the staging rehearsal passes its own checks, ${pass} time (${((r.stderr || '') + (r.stdout.match(/❌.*$/m) || [''])[0]).trim().slice(0, 200) || 'ok'})`);
}
const practice = onDb(['-qAt', '-c', "select count(*) from shops where name like 'Mukasa Hardware (practice%'"]);
t.check(practice.stdout.trim() === '2', 'and a second rehearsal replaces the first rather than adding to it');

psql(['-qAt', '-c', `drop database if exists ${db}`]);
process.exit(t.done() ? 1 : 0);
