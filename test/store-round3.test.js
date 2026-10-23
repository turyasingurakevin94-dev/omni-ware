#!/usr/bin/env node
'use strict';
/*
 * Audit round 3, reliability (0162; docs/audit/ROUND-3.md).
 *
 *   REL-04 one "Waiting to send" list on Today, signal or not; "Not sent · N" in the header.
 *   REL-05 sending, kept on this phone, sent: green only after the server's yes.
 *   REL-06 a tap in the first 400 ms of a new screen is ignored; Unpack sits up top.
 *   REL-07 a write that did not go keeps its work on screen with Try again.
 *   REL-08 two phones on one order: the write says what the phone saw; 0162 refuses when it moved.
 *   REL-09 plain words, no SQL or migration names on screen.
 *   REL-02 the hand-over ticks are kept with the name.
 *
 * Run: node test/store-round3.test.js
 *      OW_PG="host=/tmp port=5544 user=postgres" node test/store-round3.test.js
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { read, createReporter } = require('./_extract');

const t = createReporter('audit round 3: reliability (0162)');
const store = read('store.html');
const sql = read('supabase/migrations/0162_store_expect_order.sql');

// REL-04
t.check(/function waitingList\(\)\{/.test(store) && /S\.ui\.outboxRows/.test(store) && /function waitCard\(live\)\{/.test(store) && /\$\{waitCard\(live\)\}/.test(store), 'one Waiting to send list, shown whenever it is not empty');
t.check(/Not sent · \$\{n\}/.test(store) && /ACT\.sendnow = /.test(store), 'the header says Not sent · N, and Send now sends');
// REL-05
t.check(/function trackStep1\(o\)\{/.test(store) && /function stateDot\(st(, ring)?\)\{/.test(store), 'done screens have sending and kept looks');
t.check(/state: st, undo: ui\.wait && !ui\.going/.test(store) && /const st = ui\.sent\.queued \? 'kept' : ui\.sent\.wait \? 'sending' : 'sent';/.test(store) && /s\.wait \? stateDot\('sending'\)/.test(store), 'report, return and delivery show no tick before the server says yes');
// REL-06
t.check(/Date\.now\(\) - \(S\.screenAt \|\| 0\) < 400/.test(store) && /data-done-screen/.test(store), 'taps in the first 400 ms of a new screen are ignored');
t.check(/unpackLink\(q, 'chip'\)/.test(store), 'Unpack is a chip up top on Packed');
// REL-07 / REL-02
t.check(/function notDoneBar\(page, id\)\{/.test(store) && /setNotDone\(e, 'slip', q\.id, 'slide:slgo'\)/.test(store) && /setNotDone\(e, 'deliver', q\.id, 'slide:dvgo'\)/.test(store) && /setNotDone\(e, 'pack', q\.id, 'pkfinish'\)/.test(store), 'hand over, deliver and pack keep their work with Try again');
t.check(!/ui\.sent = \{ car, at: Date\.now\(\), gate: client, wait: true \}; slSave\(ui\.id, ''\)/.test(store) && /else slSave\(ui\.id, null\)/.test(store), 'the hand-over name is cleared only after the server says yes');
t.check(/JSON\.stringify\(\{ name, ticks \}\)/.test(store) && /const kept = slSaved\(id\)/.test(store) && /ticks: kept\.ticks/.test(store), 'the ticks are kept with the name');
// REL-08
t.check(/p_expect jsonb default null/.test(sql) && /errcode = '40001', hint = 'OWSTALE'/.test(sql) && /drop function if exists store_patch_order\(uuid, bigint, jsonb, text, jsonb\);/.test(sql), '0162 refuses a write when the order moved since');
t.check(/function seenOf\(q\)\{/.test(store) && /p_expect: seen/.test(store) && /if \(seenDiffers\(seen, q\)\) \{ keepOrder/.test(store), 'the app sends what the phone saw and checks it first');
t.check(/Someone else just did this/.test(store) && /function movedWords\(q\)\{/.test(store), 'a refused write says someone else did it, and refreshes');
t.check(/\| 0162 \| /.test(read('docs/decision-rights.md')), 'docs/decision-rights.md reserves 0162');
// REL-09
t.check(!/This needs migration/.test(store) && !/'Nothing was changed: ' \+/.test(store) && /That did not save · tell \$\{ownerWord\(\)\}/.test(store), 'no SQL or migration words on screen');

/* ---------------- on a real database ---------------- */
const conn = process.env.OW_PG;
if (!conn) {
  console.log('skip   - OW_PG is not set, so the scenario is not run on a database (see the header of this file)');
  process.exit(t.done() ? 1 : 0);
}
const db = 'ow_store_round3_test';
const psql = args => spawnSync('psql', [conn, ...args], { encoding: 'utf8' });
const onDb = (args, input) => spawnSync('psql', [`${conn} dbname=${db}`, ...args], { input, encoding: 'utf8' });
t.check(psql(['-qAt', '-c', `drop database if exists ${db}`, '-c', `create database ${db}`]).status === 0, 'a fresh database was made');
t.check(onDb(['-qAt', '-v', 'ON_ERROR_STOP=1'], read('test/fixtures/supabase-shim.sql')).status === 0, 'the Supabase stand-in applied');
const migDir = path.join(__dirname, '..', 'supabase', 'migrations');
const failed = fs.readdirSync(migDir).filter(f => f.endsWith('.sql')).sort().filter(f => onDb(['-qAt', '-v', 'ON_ERROR_STOP=1', '-f', path.join(migDir, f)]).status !== 0);
t.check(!failed.length, `every migration applied, in order (${failed.join(', ')})`);
t.check(onDb(['-qAt', '-v', 'ON_ERROR_STOP=1', '-f', path.join(migDir, '0162_store_expect_order.sql')]).status === 0, '0162 is safe to run twice');
const r = onDb(['-At', '-F', '|'], read('test/fixtures/store-round3-scenario.sql'));
const out = (r.stdout || '') + (r.stderr || '');
t.check(/^hand over\|Peter$/m.test(out), 'tab A hands it over, having seen it packed');
t.check(/unpack\|40001 Someone else just changed this order\./.test(out), 'tab B, still showing it packed, is refused when it unpacks');
t.check(/^no expect\|kept$/m.test(out), 'a write with no p_expect still goes (an app not yet updated)');
t.check(/^row\|done\|Peter\|2$/m.test(out), 'the order is handed over and still packed on bay 2: nothing was overwritten');
if (!r.stdout) console.log(r.stderr);
psql(['-qAt', '-c', `drop database if exists ${db}`]);
process.exit(t.done() ? 1 : 0);
