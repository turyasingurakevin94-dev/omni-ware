#!/usr/bin/env node
'use strict';
/*
 * The Buyer holds an order while Sales' ask to cancel it waits (0182;
 * Sales+Buyer cross-app round 1, BUY-1; docs/audit/cross-app/ROUND-1.md):
 * no new trip line for it, and the Buyer pushed the hold and the Manager's no.
 *
 *   1. The SQL text, the decision-rights row, and the Buyer app's read and rules.
 *   2. A REAL database, when OW_PG names one: every migration in order, 0182
 *      run twice, then test/fixtures/cancel-hold-scenario.sql.
 *
 * Run: node test/cancel-hold-db.test.js
 *      OW_PG="host=/var/tmp/owpg port=5499 user=postgres" node test/cancel-hold-db.test.js
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { read, createReporter } = require('./_extract');

const FILE = 'supabase/migrations/0182_buyer_holds_on_a_cancel_ask.sql';
const t = createReporter('The Buyer holds an order on a cancel ask (0182)');
const raw = read(FILE);
const sql = raw.replace(/--[^\n]*/g, '');
const doc = read('docs/decision-rights.md');

/* ---------------- 1. the SQL text ---------------- */
{
  t.check(/Safe to run twice/.test(raw) && /ROLLBACK/.test(raw) && /CHECK AFTERWARDS/.test(raw), 'the header says it runs twice, and how to check and roll back');
  t.check(/\| 0182 \| /.test(doc), 'docs/decision-rights.md reserves 0182');
  t.check(!/role_tasks/.test(sql), 'no role or task changes');
  t.check(/before insert or update of lines on collection_trips/.test(sql) && /errcode = 'OWHLD'/.test(sql) && /a\.status = 'sent'/.test(sql), 'a new trip line for an order with an open ask is refused (OWHLD)');
  t.check(/if auth\.uid\(\) is null then return new/.test(sql), 'a write with no login is not judged');
  t.check(/'order\.hold', 'On hold · '/.test(sql) && /'order\.hold\.kept', 'Not cancelled · '/.test(sql) && (sql.match(/null, 'trip\.plan', null, ref/g) || []).length === 2, 'the Buyer (trip.plan) is pushed the hold and the no');
  t.check(/q_status not in \('draft', 'awaiting_goods'\)/.test(sql), 'only while the order is in Checking or Buying');
  t.check(/order\.hold\.kept/.test(read('docs/spec/06-offline-sync-push.md')), 'spec 06 lists the two new pushes');
  t.check(/from\('cancel_asks'\)/.test(read('src/core/buyer/supabase/read.ts')), 'the Buyer app reads the open asks');
  t.check(/!o\.hold/.test(read('src/core/buyer/rules.ts')), 'and leaves a held order out of every count, ask and trip (core/buyer/rules.ts)');
  t.check(/k === 'order\.hold'/.test(read('src/apps/buyer/shell/native.ts')), 'a tapped hold push opens the order');
}

/* ---------------- 2. on a real database ---------------- */
const conn = process.env.OW_PG;
if (!conn) {
  console.log('skip   - OW_PG is not set, so the scenario is not run on a database (see the header of this file)');
  process.exit(t.done() ? 1 : 0);
}
const db = 'ow_cancel_hold_test';
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
const again = onDb(['-qAt', '-v', 'ON_ERROR_STOP=1', '-f', path.join(__dirname, '..', FILE)]);
t.check(again.status === 0, `0182 runs a second time without error (${errs(again)[0] || 'ok'})`);

const r = onDb(['-qAt', '-F', '\t'], fs.readFileSync(path.join(__dirname, 'fixtures', 'cancel-hold-scenario.sql'), 'utf8'));
const rows = (r.stdout || '').split('\n').filter((l) => /^(PASS|FAIL)\t/.test(l));
t.check(rows.length >= 23, `the scenario ran (${rows.length} cases${errs(r).length ? '; ' + errs(r).slice(0, 2).join(' | ') : ''})`);
rows.forEach((l) => { const [verdict, label, got] = l.split('\t'); t.check(verdict === 'PASS', `${label} — ${got}`); });

psql(['-qAt', '-c', `drop database if exists ${db}`]);
process.exit(t.done() ? 1 : 0);
