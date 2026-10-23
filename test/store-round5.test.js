#!/usr/bin/env node
'use strict';
/*
 * Audit round 5, roles and privacy (0164; docs/audit/store/ROUND-5.md).
 *
 *   PRIV-02 store_snapshot works: 0156's money hold is brought back with it.
 *   PRIV-03 a failed load says "Could not load the yard" on every tab; no direct reads, for anyone.
 *   PRIV-01 no money word reaches the phone: notes stripped, the money hold renamed, settings an allow-list.
 *   PRIV-04 every member has a name (display_name, ow_member_name, set_my_name), never a blank greeting.
 *   PRIV-05 a Store login writes only through its functions and reads only its own membership.
 *   NAV-02  one history entry per level opened by a tap; Back never leaves without "Leave Omni-ware?".
 *
 * Run: node test/store-round5.test.js
 *      OW_PG="host=/tmp port=5544 user=postgres" node test/store-round5.test.js
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { read, createReporter } = require('./_extract');

const t = createReporter('audit round 5: roles and privacy (0164)');
const store = read('store.html');
const sql = read('supabase/migrations/0164_store_roles_and_privacy.sql');
const invite = read('supabase/functions/invite-worker/index.ts');

// PRIV-02
t.check(/create or replace function ow_money_hold\(p_shop_id uuid, p_payload jsonb, p_amount_paid numeric\)/.test(sql) && /create trigger saved_quotes_ow_money_gate before update on saved_quotes/.test(sql)
  && /to_regprocedure\('ow_order_total\(uuid, jsonb, boolean\)'\) is null/.test(sql), '0164 brings back the money hold and its gate, and names what it needs');
// PRIV-03
t.check(/async function storeSnapshotNow\(\)\{\n  const r = await sb\.rpc\('store_snapshot', \{ p_shop: S\.shopId \}\);\n  if \(r\.error\) throw r\.error;/.test(store), 'a failed snapshot is an error, never a fallback');
t.check(!/from\('saved_quotes'\)|from\('collection_trips'\)|from\('invoice_asks'\)|from\('agents'\)|selectAll\(|function noFn/.test(store) && !/sb\.from\('shop_members'\)\.select\('user_id,role'\)/.test(store), 'the Store app reads no order, trip, return, agent or roster table directly');
t.check(/function loadFailCard\(\)\{/.test(store) && /Could not load the yard/.test(store) && /Still not loading\? Tell \$\{esc\(ownerWord\(\)\)\} · code/.test(store) && /Showing what this phone saw at/.test(store), 'the failure is said, with Try again and a code');
t.check(/S\.loadErr \? \(D\(\)\.blank \? loadFailCard\(\) : loadBar\(\)/.test(store) && /loadBlank\(\) \? loadFailCard\(\)/.test(store) && /blank \? '–' : n/.test(store), 'Today and Stock never say "clear" or "No products" for a failed load');
t.check(/else \{ S\.loadErr = isNetworkError\(e\) \? \{ code: 'no signal', at: Date\.now\(\) \} : loadErrOf\(e\); if \(!S\.data\) S\.data = blankData\(\); \}/.test(store) && /ACT\.loadretry = /.test(store), 'a failed boot opens the app on the failure, and Try again reloads');
t.check(/function snapKey\(\)\{ return 'ow-store-snap2:'/.test(store) && /objectStore\(SNAP_OS\)\.delete\(legacy\)/.test(store) && /if \(!S\.data \|\| S\.data\.blank\) return;/.test(store), 'copies kept before the snapshot was the only way in are dropped');
// PRIV-01
t.check(/create or replace function ow_strip_note\(t text\) returns text/.test(sql) && /'note', ow_strip_note\(l\.note\)/.test(sql) && /'note', ow_strip_note\(t\.note\)/.test(sql), 'notes lose their money');
t.check(/'letGoAsk', jsonb_strip_nulls/.test(sql) && /'letGo', jsonb_build_object\('decision'/.test(sql) && /'takenBack'/.test(sql) && /'agentSettled'/.test(sql) && /'terms', case when g\.payment_term/.test(sql)
  && /if p_patch \? 'letGoAsk' then p_patch := \(p_patch - 'letGoAsk'\) \|\| jsonb_build_object\('creditAsk', p_patch -> 'letGoAsk'\)/.test(sql), 'the money hold travels under names with no money word');
t.check(!/creditAsk|creditCheck|creditNotes|agentPaymentStatus|paymentTerm/.test(store.replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, '')), 'the app code uses only the phone\'s names');
t.check(/ORDER_KEYS\.forEach\(k => \{ if \(k !== 'items' && !same\(q\[k\], was\[k\]\)\) patch\[k\] = /.test(store), 'an order write sends only what the tap changed');
// PRIV-04
t.check(/alter table shop_members add column if not exists display_name text;/.test(sql) && /create or replace function ow_member_name\(p_shop uuid, p_user uuid\)/.test(sql) && /create or replace function set_my_name\(p_shop uuid, p_name text\)/.test(sql)
  && /nm := ow_member_name\(p_shop, auth\.uid\(\)\);/.test(sql), 'a name for every member, written by the database from one place');
t.check(/display_name: String\(staffRow\.name \|\| ""\)\.trim\(\) \|\| null/.test(invite) && /\.select\("id, user_id, role, name"\)/.test(invite), 'an invite sets the name');
t.check(/function nameCard\(\)\{/.test(store) && /SHEET\.myname = /.test(store) && /sb\.rpc\('set_my_name'/.test(store) && /hasOwnName\(\) \? ini\(myName\(\)\) : '\?'/.test(store), 'Today asks once; You sets it; never a blank or "The store"');
// PRIV-05
t.check(/the yard writes through its functions \(insert\)/.test(sql) && /as restrictive for insert to authenticated with check \(not ow_yard_only\(shop_id\)\)/.test(sql) && /create policy "the yard sees only itself" on shop_members as restrictive for select/.test(sql), 'a Store login writes only through its functions and reads only itself');
// NAV-02
t.check(/function navDepth\(\)\{ return 1 \+ \(S\.view !== 'today' \? 1 : 0\) \+ S\.stack\.length/.test(store) && /while \(cur < want\) \{ cur\+\+; history\.pushState\(\{ ow: cur \}, ''\); \}/.test(store) && /if \(S\.navIgnore\) \{ S\.navIgnore = false; navArm\(\); return; \}/.test(store), 'one history entry per level, pushed as the tap is handled');
t.check(/^\| 0164 \| /m.test(read('docs/decision-rights.md')), 'docs/decision-rights.md reserves 0164');

/* ---------------- on a real database ---------------- */
const conn = process.env.OW_PG;
if (!conn) {
  console.log('skip   - OW_PG is not set, so the roles are not tried on a database (see the header of this file)');
  process.exit(t.done() ? 1 : 0);
}
const db = 'ow_store_round5_test';
const psql = args => spawnSync('psql', [conn, ...args], { encoding: 'utf8' });
const onDb = (args, input) => spawnSync('psql', [`${conn} dbname=${db}`, ...args], { input, encoding: 'utf8' });
t.check(psql(['-qAt', '-c', `drop database if exists ${db}`, '-c', `create database ${db}`]).status === 0, 'a fresh database was made');
t.check(onDb(['-qAt', '-v', 'ON_ERROR_STOP=1'], read('test/fixtures/supabase-shim.sql')).status === 0, 'the Supabase stand-in applied');
const migDir = path.join(__dirname, '..', 'supabase', 'migrations');
const failed = fs.readdirSync(migDir).filter(f => f.endsWith('.sql')).sort().filter(f => onDb(['-qAt', '-v', 'ON_ERROR_STOP=1', '-f', path.join(migDir, f)]).status !== 0);
t.check(!failed.length, `every migration applied, in order (${failed.join(', ')})`);
t.check(onDb(['-qAt', '-v', 'ON_ERROR_STOP=1', '-f', path.join(migDir, '0164_store_roles_and_privacy.sql')]).status === 0, '0164 is safe to run twice');
const r = onDb(['-At', '-F', '|'], read('test/fixtures/store-round5-scenario.sql'));
const out = (r.stdout || '') + (r.stderr || '');
for (const role of ['owner', 'admin', 'manager', 'sales', 'store', 'staff', 'buyer', 'accounts', 'sourcing'])
  t.check(new RegExp(`snap\\|${role}\\|loaded\\|orders=2\\|money=none`).test(out), `the snapshot loads as ${role}, with no money word in it`);
t.check(/snap\|stranger\|refused\|42501/.test(out), 'someone outside the shop is refused');
t.check(/^note\|counted in \| Bought from Katwe$/m.test(out) && /^trip note\|two bundles$/m.test(out), 'notes keep their words and lose their money');
t.check(/^renamed\|\{[^|]*"decision": "letgo"[^|]*\}\|\{"at": 1729000100000, "decision": "release"\}\|true\|before$/m.test(out), 'the money hold arrives as letGoAsk, letGo, agentSettled and terms');
t.check(/^presets\|\{"bays": 4, "categories": \["Hinges"\]\}$/m.test(out), 'the settings are only what the yard needs');
t.check(/^me\|Musa Kiggundu$/m.test(out) && /^managers\|\["00000000-0000-0000-0000-00000000000c"\]$/m.test(out), 'the snapshot names the person and the Manager');
t.check(/^members visible\|1$/m.test(out), 'a Store login sees only its own membership');
t.check(/w\|own role\|0 rows/.test(out) && /w\|other role\|0 rows/.test(out), 'a Store login cannot change its own or anyone\'s role');
t.check(/w\|order insert\|refused 42501/.test(out) && /w\|order update\|0 rows/.test(out) && /w\|order delete\|0 rows/.test(out) && /w\|customer insert\|refused 42501/.test(out), 'a Store login cannot write orders or customers directly');
t.check(/w\|decide_invoice_ask\|refused 42501/.test(out) && /w\|accept_stock_count\|refused 42501/.test(out) && /w\|ask_recount\|refused 42501/.test(out), 'the Manager\'s decisions refuse a Store login');
t.check(/ok\|report insert\|written/.test(out) && /ok\|ask insert\|written/.test(out), 'its own tables still take its reports and asks');
t.check(/^patch\|1729000900000$/m.test(out) && /^row\|1729000900000\|f\|preparing$/m.test(out), 'letGoAsk from the phone is written as creditAsk');
t.check(/^joy before\|∅$/m.test(out) && /name\|email\|refused 22023/.test(out) && /^joy set\|Joy Namata$/m.test(out) && /^joy after\|Joy Namata$/m.test(out)
  && /^joy in members\|Joy Namata$/m.test(out) && /^joy return\|Joy Namata$/m.test(out), 'a login with no name sets its own, and its records carry it');
t.check(/^orders\|2$/m.test(out), 'nothing was added to the order book');
if (!r.stdout) console.log(r.stderr);
psql(['-qAt', '-c', `drop database if exists ${db}`]);
process.exit(t.done() ? 1 : 0);
