#!/usr/bin/env node
'use strict';
/*
 * The other four things the Buyer passes on (0134): a paper bill to
 * Accounts, details to fix to Sourcing, an item switched to the
 * salesperson, a note on the yard's count to the Manager. Each sends a
 * push to whoever takes it, as trip cash does since 0131.
 *
 *   1. The SQL text: the trigger, the task or person each one pushes to.
 *   2. A REAL database, when OW_PG names one: every migration in order,
 *      0134 run twice, then test/fixtures/push-buyer-handoffs-scenario.sql
 *      walks each hand-off as the Buyer.
 *
 * Run: node test/push-buyer-handoffs-db.test.js
 *      OW_PG="host=/var/tmp/owpg port=5499 user=postgres" node test/push-buyer-handoffs-db.test.js
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { read, createReporter } = require('./_extract');

const t = createReporter('pushes for the buyer\'s hand-offs (0134)');
const raw = read('supabase/migrations/0134_pushes_for_buyer_handoffs.sql');
const sql = raw.replace(/--[^\n]*/g, '');

/* ---------------- 1. each hand-off, to whom the rules say ---------------- */
{
  const want = [
    ["'paper_bill'", "'bill.paper'", "'bill.record'"],
    ["'sourcing_fix'", "'sourcing.fix'", "'price.list'"],
    ["'item_switch'", "'item.switch'", 'q.taker', "'quote.make'"],
    ["'yard_note'", "'trip.yard_note'", "'trip.difference'"],
  ];
  for (const bits of want) t.check(bits.every((b) => sql.includes(b)), `${bits[0]} pushes ${bits.slice(1).join(', ')}`);
  t.check(/security definer set search_path = public/.test(sql), 'the trigger is security definer with a pinned search_path');
  t.check(/perform ow_push\(/.test(sql) && !/insert into push_outbox/.test(sql), 'it goes through 0120\'s ow_push, never straight into the outbox');
  t.check(/new\.kind = 'trip_cash' then return null/.test(sql), 'trip cash stays 0131\'s, so it is never pushed twice');
  t.check(/tg_op <> 'INSERT' or new\.status <> 'open'/.test(sql) && /after insert on buyer_handoffs/.test(sql), 'a hand-off is pushed once, when it is passed on');
  t.check(/exception when others then/.test(sql) && /return null;\s*end \$\$/.test(sql), 'a push that fails never stops the hand-off');
  t.check(/to_regclass\('public\.buyer_handoffs'\) is null/.test(sql), 'a database without 0125 is skipped and named, not an error');
  for (const k of ["'supplierId'", "'orderId'", "'tripId'"]) t.check(sql.includes(k), `the push carries ${k} so the tap can open it`);
  t.check(/Safe to run twice/.test(raw) && /ROLLBACK/.test(raw) && /CHECK AFTERWARDS/.test(raw), 'the header says it runs twice, and how to check and roll back');
  t.check(/\| 0134 \| /.test(read('docs/decision-rights.md')), 'docs/decision-rights.md reserves 0134 for this build');
  const buyer = read('buyer.html');
  for (const k of ['paper_bill', 'sourcing_fix', 'item_switch', 'yard_note']) {
    t.check(new RegExp(`passOn\\('${k}'`).test(buyer), `the Buyer app still passes on ${k}`);
  }
  t.check(/passOn\('item_switch', 'sales', String\(a\.id\), \{ orderId: a\.id, client:/.test(buyer) && /passOn\('yard_note', 'manager', t\.id, \{ tripId: t\.id, supplierId: t\.supplierId, why, words:/.test(buyer),
    'and with the keys the pushes read (orderId, client; tripId, supplierId, words)');
}

/* ---------------- 2. on a real database ---------------- */
const conn = process.env.OW_PG;
if (!conn) {
  console.log('skip   - OW_PG is not set, so the scenario is not run on a database (see the header of this file)');
  process.exit(t.done() ? 1 : 0);
}
const db = 'ow_push_buyer_handoffs_test';
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
const again = onDb(['-qAt', '-v', 'ON_ERROR_STOP=1', '-f', path.join(migDir, '0134_pushes_for_buyer_handoffs.sql')]);
t.check(again.status === 0, `0134 runs a second time without error (${(again.stderr || '').trim().split('\n').filter((l) => /ERROR/.test(l))[0] || 'ok'})`);

const scenario = fs.readFileSync(path.join(__dirname, 'fixtures', 'push-buyer-handoffs-scenario.sql'), 'utf8');
const run = onDb(['-qAt', '-F', '\t'], scenario);
const rows = (run.stdout || '').split('\n').filter((l) => /^(PASS|FAIL)\t/.test(l));
t.check(rows.length >= 20, `the scenario ran (${rows.length} cases${run.stderr ? '; ' + run.stderr.trim().split('\n').filter((l) => /ERROR/.test(l)).slice(0, 2).join(' | ') : ''})`);
rows.forEach((l) => {
  const [verdict, label, got] = l.split('\t');
  t.check(verdict === 'PASS', `${label} — ${got}`);
});

psql(['-qAt', '-c', `drop database if exists ${db}`]);
process.exit(t.done() ? 1 : 0);
