#!/usr/bin/env node
'use strict';
/*
 * Sales asks the Manager to cancel an order (0181; docs/spec/01-order-journey.md
 * §5 Q7, docs/spec/05-data.md §9 Q7; the canvas's OR18 and OR19): an ask on
 * your own order before the bill, a withdraw, the Manager pushed, and the
 * Manager's answer through 0177's cancel_order or a no that is logged and
 * pushed back.
 *
 *   1. The SQL text, the decision-rights rows, and the new app's write path
 *      (the real books and the demo).
 *   2. A REAL database, when OW_PG names one: every migration in order, 0181
 *      run twice, then test/fixtures/cancel-ask-scenario.sql.
 *
 * Run: node test/cancel-ask-db.test.js
 *      OW_PG="host=/var/tmp/owpg port=5499 user=postgres" node test/cancel-ask-db.test.js
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { read, createReporter } = require('./_extract');

const FILE = 'supabase/migrations/0181_sales_cancel_ask.sql';
const t = createReporter('Sales asks the Manager to cancel (0181)');
const raw = read(FILE);
const sql = raw.replace(/--[^\n]*/g, '');
const doc = read('docs/decision-rights.md');

/* ---------------- 1. the SQL text ---------------- */
{
  t.check(/Safe to run twice/.test(raw) && /ROLLBACK/.test(raw) && /CHECK AFTERWARDS/.test(raw), 'the header says it runs twice, and how to check and roll back');
  t.check(/\| 0181 \| /.test(doc), 'docs/decision-rights.md reserves 0181');
  t.check(/insert into role_tasks \(role, task\) values \('sales', 'cancel\.ask'\)/.test(sql)
    && /\| \*\*Ask the Manager to cancel an order before it is invoiced\*\*[^|]*\| `cancel\.ask` \| Sales \| — \| Manager \| yes \|/.test(doc),
    'cancel.ask is Sales\', and its decision-rights row is built');
  t.check(/create unique index if not exists cancel_asks_one_open on cancel_asks \(shop_id, quote_id\) where status = 'sent'/.test(sql), 'one open ask per order');
  t.check(!/create policy[^;]*on cancel_asks\s+for (insert|update|delete|all)/i.test(sql), 'nobody writes the asks but the functions');
  const ask = sql.slice(sql.indexOf('create or replace function ask_cancel'), sql.indexOf('create or replace function withdraw_cancel_ask'));
  t.check(/has_task\(p_shop_id, 'cancel\.ask'\)/.test(ask) && /ow_uuid\(q\.payload ->> 'takenBy'\) is distinct from uid/.test(ask), 'an ask needs cancel.ask, on your own order');
  t.check(/invoiced: ask for a void instead/.test(ask) && /was delivered/.test(ask), 'never after the bill or the delivery');
  const ans = sql.slice(sql.indexOf('create or replace function answer_cancel_ask'), sql.indexOf('create or replace function saved_quotes_ow_cancel_asks'));
  t.check(/has_task\(a\.shop_id, 'order\.cancel'\)/.test(ans) && /res := cancel_order\(a\.shop_id, a\.quote_id/.test(ans), 'the Manager\'s yes goes through cancel_order (0177)');
  t.check(/manager_log_decision\(a\.shop_id, 'order\.cancel'/.test(ans), 'a no is in the owner\'s log');
  t.check(/'order\.cancel\.ask', 'Cancel asked'/.test(sql) && /null, 'order\.cancel', null, ref/.test(sql), 'the ask pushes the Manager (order.cancel.ask, to order.cancel)');
  t.check(/'order\.cancel\.ask\.decided'/.test(sql) && /new\.asked_by, null, null, ref/.test(sql), 'a no pushes the asker (order.cancel.ask.decided)');
  t.check(/order\.cancel\.ask/.test(read('docs/spec/06-offline-sync-push.md')), 'spec 06 lists the two new pushes');
  const w = read('src/core/supabase/write.ts');
  t.check(/sb\.rpc\('ask_cancel'/.test(w) && /sb\.rpc\('withdraw_cancel_ask'/.test(w), 'the new app asks and withdraws through the functions (src/core/supabase/write.ts)');
  t.check(/from\('cancel_asks'\)/.test(read('src/core/supabase/read.ts')), 'and reads the asks back');
  t.check(/export function askCancel\(/.test(read('src/core/demo/writes.ts')), 'the demo stands in for ask_cancel the same way (src/core/demo/writes.ts)');
}

/* ---------------- 2. on a real database ---------------- */
const conn = process.env.OW_PG;
if (!conn) {
  console.log('skip   - OW_PG is not set, so the scenario is not run on a database (see the header of this file)');
  process.exit(t.done() ? 1 : 0);
}
const db = 'ow_cancel_ask_test';
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
t.check(again.status === 0, `0181 runs a second time without error (${errs(again)[0] || 'ok'})`);

const r = onDb(['-qAt', '-F', '\t'], fs.readFileSync(path.join(__dirname, 'fixtures', 'cancel-ask-scenario.sql'), 'utf8'));
const rows = (r.stdout || '').split('\n').filter((l) => /^(PASS|FAIL)\t/.test(l));
t.check(rows.length >= 56, `the scenario ran (${rows.length} cases${errs(r).length ? '; ' + errs(r).slice(0, 2).join(' | ') : ''})`);
rows.forEach((l) => { const [verdict, label, got] = l.split('\t'); t.check(verdict === 'PASS', `${label} — ${got}`); });

psql(['-qAt', '-c', `drop database if exists ${db}`]);
process.exit(t.done() ? 1 : 0);
