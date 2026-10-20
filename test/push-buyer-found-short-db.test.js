#!/usr/bin/env node
'use strict';
/*
 * Two pushes the Buyer canvas promises (0144): Sourcing finding a supplier
 * for a line the client waits for tells the Buyer who sent it, and a trip
 * handed in short tells each short order's salesperson.
 *
 *   1. The SQL text: the triggers, the person or task each one pushes to.
 *   2. A REAL database, when OW_PG names one: every migration in order,
 *      0144 run twice, then test/fixtures/push-buyer-found-short-scenario.sql.
 *
 * Run: node test/push-buyer-found-short-db.test.js
 *      OW_PG="host=/var/tmp/owpg port=5499 user=postgres" node test/push-buyer-found-short-db.test.js
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { read, createReporter } = require('./_extract');

const t = createReporter('found a supplier, came back short (0144)');
const raw = read('supabase/migrations/0144_buyer_found_and_short_pushes.sql');
const sql = raw.replace(/--[^\n]*/g, '');

/* ---------------- 1. each push, to whom the rules say ---------------- */
{
  t.check(/'sourcing\.found'/.test(sql) && /ow_uuid\(r ->> 'droppedBy'\)/.test(sql) && /'supplier\.confirm'/.test(sql), 'a supplier found tells the Buyer who sent it, else the Buyer by task');
  t.check(/new\.status not in \('sourced', 'priced', 'listed'\) or old\.status not in \('asked', 'looking'\)/.test(sql), 'only when the request first leaves asked or looking');
  t.check(/e ->> 'source' = 'dropped'/.test(sql), 'only for a line from an order (dropped or client waits), not a salesperson\'s ask');
  t.check(/'trip\.short'/.test(sql) && /q\.taker/.test(sql) && /'quote\.make'/.test(sql), 'a short trip tells the salesperson, else Sales by task');
  t.check(/<> 'restock'/.test(sql), 'the shelf\'s own lines tell no salesperson');
  t.check(/security definer set search_path = public/.test(sql), 'the triggers are security definer with a pinned search_path');
  t.check(/perform ow_push\(/.test(sql) && !/insert into push_outbox/.test(sql), 'they go through 0120\'s ow_push, never straight into the outbox');
  t.check((sql.match(/exception when others then/g) || []).length >= 4, 'a push that fails never stops the write');
  t.check(/to_regclass\('public\.sourcing_leads'\) is null/.test(sql) && /to_regclass\('public\.collection_trips'\) is null/.test(sql), 'a database without the tables is skipped and named, not an error');
  t.check(/Safe to run twice/.test(raw) && /ROLLBACK/.test(raw) && /CHECK AFTERWARDS/.test(raw), 'the header says it runs twice, and how to check and roll back');
  t.check(/\| 0144 \| /.test(read('docs/decision-rights.md')), 'docs/decision-rights.md reserves 0144 for this build');
  const buyer = read('buyer.html');
  t.check(/it\.clientWaits = \{ at: Date\.now\(\), \.\.\.\(S\.user \? \{ by: S\.user\.id \} : \{\}\) \}/.test(buyer), 'the Buyer app still marks client waits with who did it (0139 reads it as droppedBy)');
  t.check(/d\.kind === 'sourcing\.found'/.test(buyer), 'a tap on the found push opens the order in the Buyer app');
}

/* ---------------- 2. on a real database ---------------- */
const conn = process.env.OW_PG;
if (!conn) {
  console.log('skip   - OW_PG is not set, so the scenario is not run on a database (see the header of this file)');
  process.exit(t.done() ? 1 : 0);
}
const db = 'ow_push_found_short_test';
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
const again = onDb(['-qAt', '-v', 'ON_ERROR_STOP=1', '-f', path.join(migDir, '0144_buyer_found_and_short_pushes.sql')]);
t.check(again.status === 0, `0144 runs a second time without error (${(again.stderr || '').trim().split('\n').filter((l) => /ERROR/.test(l))[0] || 'ok'})`);

const scenario = fs.readFileSync(path.join(__dirname, 'fixtures', 'push-buyer-found-short-scenario.sql'), 'utf8');
const run = onDb(['-qAt', '-F', '\t'], scenario);
const rows = (run.stdout || '').split('\n').filter((l) => /^(PASS|FAIL)\t/.test(l));
t.check(rows.length >= 18, `the scenario ran (${rows.length} cases${run.stderr ? '; ' + run.stderr.trim().split('\n').filter((l) => /ERROR/.test(l)).slice(0, 2).join(' | ') : ''})`);
rows.forEach((l) => {
  const [verdict, label, got] = l.split('\t');
  t.check(verdict === 'PASS', `${label} — ${got}`);
});

psql(['-qAt', '-c', `drop database if exists ${db}`]);
process.exit(t.done() ? 1 : 0);
