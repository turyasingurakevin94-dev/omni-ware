#!/usr/bin/env node
'use strict';
/*
 * Audit round 1, data integrity (0161; docs/audit/ROUND-1.md).
 *
 *   DATA-01 one waiting count per place; a count done again replaces it when sent.
 *   DATA-02 a return reads in its order line's unit, on the phone and in the books.
 *   DATA-03 no loss off an empty shelf; a write-off never past the shelf, logged per report.
 *   DATA-04 "shelf", not "books", next to a shelf figure.
 *   DATA-05 no product without an aisle; "No aisle yet" never takes a letter.
 *   DATA-06 one dash per name.
 *
 * Run: node test/store-round1.test.js
 *      OW_PG="host=/tmp port=5544 user=postgres" node test/store-round1.test.js
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { read, createReporter } = require('./_extract');

const t = createReporter('audit round 1: data integrity (0161)');
const sql = read('supabase/migrations/0161_store_one_count_per_place.sql');
const store = read('store.html');
const manager = read('manager.html');

/* ---------------- the SQL ---------------- */
t.check(/create unique index if not exists stock_counts_one_open on stock_counts\(shop_id, place\) where status = 'sent'/.test(sql), 'one waiting count per place');
t.check(/'superseded'/.test(sql) && /function store_count_replace\(/.test(sql), 'a count done again replaces the waiting one');
t.check(/coalesce\(it ->> 'unit', l ->> 'unit'\)/.test(sql), 'a return takes its unit from the order line');
t.check(/The shelf has only % of %: count it first/.test(sql) && /' · report ' \|\| rep_id::text/.test(sql), 'a write-off never past the shelf, its log row naming the report');
t.check(/\| 0161 \| /.test(read('docs/decision-rights.md')), 'docs/decision-rights.md reserves 0161');

/* ---------------- the app ---------------- */
t.check(/SHEET\.ctwait = /.test(store) && /sb\.rpc\('store_count_replace'/.test(store), 'the Store app offers "Count it again" and sends it as a replace');
t.check(/Replaces \$\{/.test(store), 'the count says whose count it replaces');
t.check(/function returnLineWords\(q, l\)\{ const it = q && \(q\.items \|\| \[\]\)\[l\.idx\]/.test(store) && /it \? backText\(it, Number\(l\.qty\) \|\| 0\)/.test(store), 'a return line reads through the order line\'s pack formatter');
t.check(/Nothing on the shelf to lose/.test(store) && /0 · count first/.test(store), 'an empty shelf asks for a count before a loss');
t.check(!/The books hold|More than the books hold|fewer than' : 'differ from'} the books|All match the books|Counted against the books/.test(store), 'no "books" next to a shelf figure');
t.check(/No aisle yet/.test(store), 'a product with no category reads "No aisle yet"');
t.check(/status === 'superseded'/.test(manager), 'the Manager app names a replaced count');

/* ---------------- on a real database ---------------- */
const conn = process.env.OW_PG;
if (!conn) {
  console.log('skip   - OW_PG is not set, so the scenario is not run on a database (see the header of this file)');
  process.exit(t.done() ? 1 : 0);
}
const db = 'ow_store_round1_test';
const psql = args => spawnSync('psql', [conn, ...args], { encoding: 'utf8' });
const onDb = (args, input) => spawnSync('psql', [`${conn} dbname=${db}`, ...args], { input, encoding: 'utf8' });
t.check(psql(['-qAt', '-c', `drop database if exists ${db}`, '-c', `create database ${db}`]).status === 0, 'a fresh database was made');
t.check(onDb(['-qAt', '-v', 'ON_ERROR_STOP=1'], read('test/fixtures/supabase-shim.sql')).status === 0, 'the Supabase stand-in applied');
const migDir = path.join(__dirname, '..', 'supabase', 'migrations');
const all = fs.readdirSync(migDir).filter(f => f.endsWith('.sql')).sort();
const apply = f => onDb(['-qAt', '-v', 'ON_ERROR_STOP=1', '-f', path.join(migDir, f)]);
const failed = all.filter(f => f < '0161').filter(f => apply(f).status !== 0);
t.check(!failed.length, `every migration before 0161 applied (${failed.join(', ')})`);
const before = onDb(['-qAt', '-v', 'ON_ERROR_STOP=1'], read('test/fixtures/store-round1-before.sql'));
t.check(before.status === 0, `the books before 0161 were set up ${before.stderr || ''}`);
const m = apply('0161_store_one_count_per_place.sql');
t.check(m.status === 0, `0161 applied ${m.stderr || ''}`);
t.check(apply('0161_store_one_count_per_place.sql').status === 0, '0161 is safe to run twice');
const r = onDb(['-At', '-F', '|'], read('test/fixtures/store-round1-scenario.sql'));
const out = (r.stdout || '') + (r.stderr || '');
t.check(/^dup\|superseded:-,sent:aaaaaaaa-0000-0000-0000-000000000001$/m.test(out), 'the older Aisle A count is superseded, the newest names it');
t.check(/^place\|aisle:aluminum$/m.test(out), 'a count\'s place is its aisle\'s name, not its letter');
t.check(/second\|refused/.test(out), 'a second waiting count of the same aisle is refused');
t.check(/^replace\|true\|Joy Namata\|aaaaaaaa-0000-0000-0000-000000000002\|sent$/m.test(out), 'Joy\'s count again replaces Musa\'s (anyone may replace)');
t.check(/^after replace\|superseded,superseded,sent$/m.test(out), 'only the latest waits');
t.check(/^spot\|item:P103\|aisle:furniture$/m.test(out), 'a spot count is one item\'s place');
t.check(/accept old\|.*not waiting to be accepted|accept old\|A newer count/.test(out), 'a replaced count can\'t be accepted');
t.check(/^accept new\|true$/m.test(out), 'the latest count is accepted');
t.check(/^replace after accept\|false\|sent$/m.test(out), 'a count after the old one was accepted goes as the next count');
t.check(/^new return\|Box$/m.test(out), 'a new return saves the line\'s unit, whatever the phone sent');
t.check(/^old return\|Box\|20\|f\|230000$/m.test(out), '#0494 reads 20 Box, its qty and amount kept');
t.check(/empty shelf\|The shelf has only 0 of ABC Black Screws: count it first/.test(out), 'a write-off on an empty shelf is refused: count it first');
t.check(/^write off\|1$/m.test(out) && /^log\|1\|-2\|3\|t$/m.test(out), 'a write-off of 2 off 5 writes one stock_log row, delta -2 to 3, naming its report');
t.check(/^reports\|sent,written_off$/m.test(out), 'the refused report still waits; the written-off one is decided');
t.check(/^moved\|P103:Furniture,P107:Curtain Fittings,P269:Hinges,P271:Hinges,P342:Fasteners,P435:Runners,P522:Hinges$/m.test(out), 'the products moved to their aisles; the furniture stayed; none without one');
t.check(/^other shop\|Something else\|Furniture$/m.test(out), 'another shop\'s P269 is never touched');
t.check(/^renamed\|OMEGA Hinges Normal,ZAWAINA Hinges Normal,Drawer Runners Maria$/m.test(out), 'one dash per product name');
t.check(/^variants\|19mm Light,25mm Heavy,25mm Light$/m.test(out) && /^bend\|Half Bend \(Type B\)\|Full Overlay$/m.test(out), 'and per variant name; the others stay');
if (!r.stdout) console.log(r.stderr);
if (!process.env.KEEP) psql(['-qAt', '-c', `drop database if exists ${db}`]);
process.exit(t.done() ? 1 : 0);
