#!/usr/bin/env node
'use strict';
/*
 * The yard's asks (0157) and receive_trip v2.
 *
 *   1. The SQL: store_asks is read by members and written only by the yard,
 *      as itself; nobody updates a row -- answer_store_ask does, for the one
 *      whose decision it is (the Buyer a restock, the Manager an extra, the
 *      named colleague a handover); each ask and answer is pushed.
 *   2. receive_trip v2: a line with no order goes on the shelf, and the
 *      yard's reason rides on the line as yardWhy.
 *   3. store.html reads the asks, answers a handover through the function,
 *      and sends the reason with the count.
 *   4. On a real database when OW_PG names one: every migration, then
 *      test/fixtures/store-asks-scenario.sql.
 *
 * Run: node test/store-asks.test.js
 *      OW_PG="host=/tmp port=5544 user=postgres" node test/store-asks.test.js
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { read, createReporter } = require('./_extract');

const t = createReporter('store asks (0157)');
const sql = read('supabase/migrations/0157_store_asks.sql');
const store = read('store.html');
const fnBody = name => { const i = sql.indexOf(`create or replace function ${name}(`); if (i < 0) return ''; return sql.slice(i, sql.indexOf('$$;', i) + 3); };

/* ---------------- 1. the asks ---------------- */
t.check(/create table if not exists store_asks/.test(sql) && /kind in \('restock', 'extra', 'handover', 'close'\)/.test(sql), 'store_asks holds the four kinds the yard asks');
t.check(/alter table store_asks enable row level security/.test(sql) && /for select using \(is_shop_member\(shop_id\)\)/.test(sql), 'members read the asks');
t.check(/for insert with check \(ow_is_yard\(shop_id\) and asked_by = auth\.uid\(\) and status = 'sent'/.test(sql), 'only the yard adds one, as itself, unanswered');
t.check(!/create policy[^;]*for (update|delete|all)/.test(sql), 'no update or delete policy: answers go through answer_store_ask');
const ans = fnBody('answer_store_ask');
t.check(/when 'restock' then has_task\(a\.shop_id, 'buy\.restock'\)/.test(ans) && /when 'extra' then has_task\(a\.shop_id, 'trip\.difference'\)/.test(ans) && /when 'handover' then ow_uuid\(a\.payload ->> 'toUserId'\) = auth\.uid\(\)/.test(ans),
  'the Buyer answers a restock, the Manager an extra, the named colleague a handover');
t.check(/a\.asked_by is distinct from auth\.uid\(\)/.test(ans) && /security definer set search_path = public/.test(ans), 'only the asker takes one back; the function runs as definer with a fixed search_path');
const push = fnBody('store_asks_ow_push');
t.check(["'store.restock'", "'buy.restock'", "'store.extra'", "'trip.difference'", "'store.handover'", "'store.closed'", "'manager'", "'store.ask.decided'"].every(k => push.includes(k)), 'each ask pushes the one who decides, and the answer pushes the asker');
t.check(!/\('[a-z]+', '[a-z_]+\.[a-z_]+'\)/.test(sql.replace(/--[^\n]*/g, '')), 'no task is granted here: every decision is a task a role already holds');

/* ---------------- 2. receive_trip v2 ---------------- */
const rcv = fnBody('receive_trip');
t.check(rcv.includes("has_task(p_shop, 'stock.receive')") && /'yardQty', n/.test(rcv) && /yard_checked_at = coalesce\(yard_checked_at, now\(\)\)/.test(rcv), 'receive_trip keeps 0136\'s checks and the yard count on the line');
t.check(/coalesce\(l ->> 'orderId', ''\) in \('restock', ''\)/.test(rcv), 'a line with no order goes on the shelf instead of reading "missing"');
t.check(/inp ->> 'why' in \('short', 'torn', 'brand'\)/.test(rcv) && /'yardWhy', why/.test(rcv), 'the yard\'s reason rides on the line as yardWhy');
t.check(/\| 0157 \| /.test(read('docs/decision-rights.md')), 'docs/decision-rights.md reserves 0157 for it');

/* ---------------- 3. the store app ---------------- */
t.check(/from\('store_asks'\)\.select\('\*'\)/.test(store) && /asks: asks === null \? null : asks\.map\(rowToAsk\)/.test(store), 'the store app reads the asks, null before 0157');
t.check(/sb\.rpc\('answer_store_ask', \{ p_id: t\.dataset\.id, p_status: 'accepted'/.test(store) && !/from\('store_asks'\)\.update/.test(store), '"I\'ve got it" answers through answer_store_ask, never a direct update');
t.check(/why && why\[i\] \? \{ why: why\[i\] \} : \{\}/.test(store), 'the check-in sends the yard\'s reason with the count');

/* ---------------- 4. on a real database ---------------- */
const conn = process.env.OW_PG;
if (!conn) {
  console.log('skip   - OW_PG is not set, so the scenario is not run on a database (see the header of this file)');
  process.exit(t.done() ? 1 : 0);
}
const db = 'ow_store_asks_test';
const psql = args => spawnSync('psql', [conn, ...args], { encoding: 'utf8' });
const onDb = (args, input) => spawnSync('psql', [`${conn} dbname=${db}`, ...args], { input, encoding: 'utf8' });
t.check(psql(['-qAt', '-c', `drop database if exists ${db}`, '-c', `create database ${db}`]).status === 0, 'a fresh database was made');
t.check(onDb(['-qAt', '-v', 'ON_ERROR_STOP=1'], read('test/fixtures/supabase-shim.sql')).status === 0, 'the Supabase stand-in applied');
const migDir = path.join(__dirname, '..', 'supabase', 'migrations');
const failed = fs.readdirSync(migDir).filter(f => f.endsWith('.sql')).sort().filter(f => onDb(['-qAt', '-v', 'ON_ERROR_STOP=1', '-f', path.join(migDir, f)]).status !== 0);
t.check(!failed.length, `every migration applied, in order (${failed.join(', ')})`);
const r = onDb(['-At', '-F', '|'], read('test/fixtures/store-asks-scenario.sql'));
const out = r.stdout || '', err = r.stderr || '';
t.check((err.match(/ERROR: {2}new row violates row-level security policy for table "store_asks"/g) || []).length === 1, 'asking as someone else is refused');
t.check((err.match(/That answer is not yours to give\./g) || []).length === 3, 'answering your own restock, someone else\'s extra, or a close is refused');
t.check(/^0$/m.test(out), 'a direct update changes nothing');
t.check(['restock|accepted|Monday round', 'extra|declined|', 'handover|accepted|', 'close|sent|'].every(l => out.includes(l)), 'the Buyer, the Manager and the colleague answered; the close stays a log line');
t.check(/store\.restock\|\|buy\.restock\|\|/.test(out) && /store\.extra\|\|trip\.difference\|\|/.test(out) && /store\.handover\|0{8}-0{4}-0{4}-0{4}-000000000010\|/.test(out) && /store\.closed\|\|\|manager\|/.test(out), 'each ask was pushed to the one who decides');
t.check((out.match(/^store\.ask\.decided\|0{8}-0{4}-0{4}-0{4}-00000000000e\|/gm) || []).length === 3, 'each answer was pushed to the asker');
t.check(/^P1\|7\.0+$/m.test(out) && /^"short"$/m.test(out) && /"missing": 0/.test(out), 'the no-order line reached the shelf (5 + 2) and the reason rode on the line');
psql(['-qAt', '-c', `drop database if exists ${db}`]);
process.exit(t.done() ? 1 : 0);
