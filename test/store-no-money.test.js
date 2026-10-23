#!/usr/bin/env node
'use strict';
/*
 * No money reaches a Store phone (0159).
 *
 *   1. The SQL: a Store login reads no shop table but the few the yard works
 *      in; what it needs comes from store_snapshot with every money key taken
 *      out; its writes go through functions that touch only its own fields.
 *   2. store.html reads the snapshot and writes through those functions, and
 *      sends no prices with a return.
 *   3. On a real database when OW_PG names one: every migration, then
 *      test/fixtures/store-no-money-scenario.sql.
 *
 * Run: node test/store-no-money.test.js
 *      OW_PG="host=/tmp port=5544 user=postgres" node test/store-no-money.test.js
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { read, createReporter } = require('./_extract');

const t = createReporter('no money on a Store phone (0159)');
const sql = read('supabase/migrations/0159_store_no_money.sql');
const store = read('store.html');
const fn = name => { const i = sql.indexOf(`create or replace function ${name}(`); return i < 0 ? '' : sql.slice(i, sql.indexOf('$$;', i) + 3); };

/* ---------------- 1. the SQL ---------------- */
t.check(/m\.role = 'store'/.test(fn('ow_yard_only')), 'the yard is the Store login');
t.check(/as restrictive for select to authenticated using \(not ow_yard_only\(shop_id\)\)/.test(sql) && /open_to_yard text\[\] := array\['stock', 'stock_counts', 'stock_reports', 'store_asks', 'places', 'place_routes',\s*'road_names', 'push_subscriptions', 'shop_members', 'agents'\]/.test(sql),
  'every shop table is closed to the yard but the ones it works in');
t.check(/price\|cost\|amount\|paid\|payment\|total\|owed\|debt\|cash/.test(fn('ow_strip_money')) && /'agentPaymentStatus', 'paymentTerm'/.test(fn('ow_strip_money')), 'money keys are stripped at any depth; the payment status words stay');
const snap = fn('store_snapshot');
t.check(['orders', 'trips', 'products', 'units', 'customers', 'staff', 'suppliers', 'presets', 'log', 'counted', 'returns', 'holds'].every(k => snap.includes(`'${k}'`)), 'the snapshot carries what the Store app reads');
t.check(!/'pay_rate'|'debt'|'credit_limit'|'cost'|'cash_given'|'amount_paid'|'owed'/.test(snap), 'and no pay, debt, credit limit, cost, cash or owed column');
t.check(/line_keys text\[\] := array\['pickStatus', 'pickedQty'\]/.test(fn('store_patch_order')) && !/'items'/.test(fn('store_patch_order').split('allowed text[]')[1].split(';')[0]), 'an order patch merges a line\'s pick fields and never replaces the lines');
t.check(/sellPrice/.test(fn('store_return_ask')) && /round\(price \* /.test(fn('store_return_ask')), 'a return is priced in the database from the order');
t.check(/add column if not exists missing jsonb/.test(sql), 'a partial count keeps what it could not find apart from its lines');
t.check(/'store\.new_item'/.test(fn('store_asks_ow_push')) && /'product\.edit'/.test(fn('store_asks_ow_push')), 'a new item at check-in tells Sourcing');
t.check(/\| 0159 \| /.test(read('docs/decision-rights.md')), 'docs/decision-rights.md reserves 0159');
t.check(/\| 0160 \| /.test(read('docs/decision-rights.md')) && /function ow_store_payload/.test(read('supabase/migrations/0160_store_allow_list.sql')), 'docs/decision-rights.md reserves 0160, the allow-list');

/* ---------------- 2. the app ---------------- */
t.check(/sb\.rpc\('store_snapshot'/.test(store) && /sb\.rpc\('store_patch_order'/.test(store) && /sb\.rpc\('store_patch_trip'/.test(store) && /sb\.rpc\('store_return_ask'/.test(store), 'the Store app reads the snapshot and writes through the functions');
t.check(!/sellPrice/.test(store), 'the Store app never reads a sell price');

/* ---------------- 3. on a real database ---------------- */
const conn = process.env.OW_PG;
if (!conn) {
  console.log('skip   - OW_PG is not set, so the scenario is not run on a database (see the header of this file)');
  process.exit(t.done() ? 1 : 0);
}
const db = 'ow_store_no_money_test';
const psql = args => spawnSync('psql', [conn, ...args], { encoding: 'utf8' });
const onDb = (args, input) => spawnSync('psql', [`${conn} dbname=${db}`, ...args], { input, encoding: 'utf8' });
t.check(psql(['-qAt', '-c', `drop database if exists ${db}`, '-c', `create database ${db}`]).status === 0, 'a fresh database was made');
t.check(onDb(['-qAt', '-v', 'ON_ERROR_STOP=1'], read('test/fixtures/supabase-shim.sql')).status === 0, 'the Supabase stand-in applied');
const migDir = path.join(__dirname, '..', 'supabase', 'migrations');
const failed = fs.readdirSync(migDir).filter(f => f.endsWith('.sql')).sort().filter(f => onDb(['-qAt', '-v', 'ON_ERROR_STOP=1', '-f', path.join(migDir, f)]).status !== 0);
t.check(!failed.length, `every migration applied, in order (${failed.join(', ')})`);
const r = onDb(['-At', '-F', '|'], read('test/fixtures/store-no-money-scenario.sql'));
const out = r.stdout || '';
['quotes', 'prices', 'customers', 'staff', 'trips', 'stock_log'].forEach(x => t.check(new RegExp(`^store reads ${x}\\|0$`, 'm').test(out), `a Store login reads no ${x}`));
t.check(/^money keys in snapshot\|0$/m.test(out) && /^snapshot keeps\|true\|2$/m.test(out), 'the snapshot holds no money key, an agent\'s order says only whether it is settled (0164), and both orders');
t.check(/^prices kept after patch\|32000\|done\|in_progress\|t\|10000$/m.test(out), 'the yard\'s patch set the pick fields and left the price, the payments and the money paid alone');
t.check(/^trip row\|collected\|5\|29000\|150000$/m.test(out), 'handing a round in kept what the Buyer paid and the cash');
t.check(/^return row\|64000\|32000\|Damaged after delivery\|burst$/m.test(out), 'the return was priced from the order, with its reason and note');
t.check(/^manager reads quotes\|2$/m.test(out) && /^manager reads prices\|1$/m.test(out), 'the Manager still reads everything');
// 0160: the allow-list, the wider money names, deliveredNote, and a return no bigger than the line.
t.check(/^money keys 0160\|0$/m.test(out), 'no amt, rate, receipts, charges, owed, sum, value or price reaches the snapshot (0160)');
t.check(/^allow list keeps\|letgo\|x\|Cement$/m.test(out), 'and the allow-list keeps the let-it-go answer (0164), a taken-back note (its amount gone) and the line\'s name');
t.check(/too big\|More than that line can take back: 3 left of 5/.test((r.stderr || '') + out), 'a return bigger than the line has left is refused (0160)');
t.check(/^deliver note\|The camera will not open$/m.test(out), 'the Store can say why a delivery has no photo (0160)');
psql(['-qAt', '-c', `drop database if exists ${db}`]);
process.exit(t.done() ? 1 : 0);
