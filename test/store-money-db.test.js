#!/usr/bin/env node
'use strict';
/*
 * Money at the gate (0156): nothing leaves unpaid for a cash customer until
 * it is paid or the Manager lets it go on credit (docs/decision-rights.md:
 * credit is the Manager's). The Store asks; each side gets a push.
 *
 *   1. The SQL text, and the Store and Manager apps that use it.
 *   2. A REAL database, when OW_PG names one: every migration in order,
 *      0156 run twice, then test/fixtures/store-money-scenario.sql.
 *
 * Run: node test/store-money-db.test.js
 *      OW_PG="host=/var/tmp/owpg port=5499 user=postgres" node test/store-money-db.test.js
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { read, createReporter } = require('./_extract');

const t = createReporter('money at the gate (0156)');
const raw = read('supabase/migrations/0156_store_money_at_the_gate.sql');
const sql = raw.replace(/--[^\n]*/g, '');

/* ---------------- 1. the text ---------------- */
{
  t.check(/coalesce\(c\.credit_limit, 0\) > 0 then return null/.test(sql) && /if dec = 'release' then return null/.test(sql) && /originAgentId/.test(sql), 'a credit customer, a Manager\'s yes and an agent\'s order are not held');
  t.check(/ow_order_total\(p_shop_id, p, true\)/.test(sql) && /coalesce\(p_amount_paid, 0\)/.test(sql), 'what is owed is the order\'s total less what was paid, as the Checking gate reckons it');
  t.check(/v_role not in \('store', 'staff'\) or has_task\(new\.shop_id, 'credit\.release'\)/.test(sql), 'a Store or worker login is stopped (store.html opens for both); the Manager and the owner are not');
  t.check(/old\.status = 'preparing' and new\.status in \('pending_delivery', 'completed'\)/.test(sql), 'it stops loading and the hand-over, nothing else');
  t.check(/'credit\.ask', 'Not paid · let it go on credit\?'/.test(sql) && /null, 'credit\.release', null/.test(sql), 'the ask goes to whoever decides credit');
  t.check(/'credit\.ask\.decided'/.test(sql) && /ow_uuid\(ask ->> 'by'\)/.test(sql), 'the answer goes back to the Store person who asked');
  t.check(/security definer set search_path = public/.test(sql) && /revoke all on function ow_money_hold/.test(sql) && /grant execute on function store_money_holds\(uuid\) to authenticated/.test(sql), 'definer functions with a pinned path; the helper is nobody\'s to call');
  t.check(/Safe to run twice/.test(raw) && /ROLLBACK/.test(raw) && /CHECK AFTERWARDS/.test(raw), 'the header says it runs twice, and how to check and roll back');
  const doc = read('docs/decision-rights.md');
  t.check(/\| 0156 \| /.test(doc) && /`credit\.release` \| Manager \| Sales, Store \|/.test(doc), 'docs/decision-rights.md reserves 0156 and has the Store propose credit');
  const store = read('store.html'), mgr = read('manager.html');
  // Round 5 (0164): the holds come in the snapshot, and the ask is creditAsk in the books, letGoAsk on the phone.
  t.check(/holds = snapHolds\(sn\.holds\) \|\| \{\}/.test(store) && /'handoverCheckedAt', 'letGoAsk'\]/.test(store), 'the Store app reads what waits on money and writes its ask on the order');
  t.check(/const go = all\.filter\(d => !moneyHold\(d\.q\)\)/.test(store) && /if \(moneyHold\(q\)\) \{ toast\(/.test(store), 'a held order is never picked for the truck or handed over');
  t.check(!/q\.creditCheck = /.test(store), 'the Store app never decides credit');
  t.check(/function canAskCredit\(q\)\{ return !!\(q && q\.customerId && /.test(store) && /if \(S\.busy \|\| !canAskCredit\(quoteById\(id\)\)\) return;/.test(store), 'an order with no customer record is never asked about: credit is set on a customer, so it waits for the money');
  t.check(/function creditAskOf\(q\)\{ const a = q && q\.creditAsk;/.test(mgr) && /k === 'credit\.ask' \|\| k === 'credit\.hold'/.test(mgr), 'the Manager app reads the Store\'s ask as payload.creditAsk, and the credit.ask push opens it');
  t.check(/function loadAskOf\(q\)\{ const a = q && q\.letGoAsk; return a && typeof a === 'object' && a\.at && !a\.answer/.test(store), 'the Store app reads an ask as open the way the Manager app does');
}

/* ---------------- 2. on a real database ---------------- */
const conn = process.env.OW_PG;
if (!conn) {
  console.log('skip   - OW_PG is not set, so the scenario is not run on a database (see the header of this file)');
  process.exit(t.done() ? 1 : 0);
}
const db = 'ow_store_money_test';
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
const again = onDb(['-qAt', '-v', 'ON_ERROR_STOP=1', '-f', path.join(migDir, '0156_store_money_at_the_gate.sql')]);
t.check(again.status === 0, `0156 runs a second time without error (${(again.stderr || '').trim().split('\n').filter((l) => /ERROR/.test(l))[0] || 'ok'})`);

const scenario = fs.readFileSync(path.join(__dirname, 'fixtures', 'store-money-scenario.sql'), 'utf8');
const run = onDb(['-qAt', '-F', '\t'], scenario);
const rows = (run.stdout || '').split('\n').filter((l) => /^(PASS|FAIL)\t/.test(l));
t.check(rows.length >= 19, `the scenario ran (${rows.length} cases${run.stderr ? '; ' + run.stderr.trim().split('\n').filter((l) => /ERROR/.test(l)).slice(0, 2).join(' | ') : ''})`);
rows.forEach((l) => {
  const [verdict, label, got] = l.split('\t');
  t.check(verdict === 'PASS', `${label} — ${got}`);
});

psql(['-qAt', '-c', `drop database if exists ${db}`]);
process.exit(t.done() ? 1 : 0);
