#!/usr/bin/env node
'use strict';
/*
 * Audit round 4, search and navigation (0163; docs/audit/ROUND-4.md).
 *
 *   NAV-03 a size like 1 1/4" is one tag: variants split on " / " only.
 *   NAV-02 phone and browser Back walk the app's own stack; on Today, "Leave Omni-ware?".
 *   NAV-04 only an order the yard can act on opens Pack; red packs the full line only.
 *   REL-05 hand over and pack say "Handing over…" / "Packing #…" until the server says yes.
 *   NAV-05 every order row in Find opens a screen.
 *   NAV-06 "hindge", "4x20" and "silcone" find the right items; "Did you mean" on nothing.
 *   NAV-07 no row cap in Find, so the counts are the rows; no chips before a query.
 *   NAV-08 a long aisle keeps Back in reach: a sticky bar and "back to the top".
 *
 * Run: node test/store-round4.test.js
 *      OW_PG="host=/tmp port=5544 user=postgres" node test/store-round4.test.js
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { read, createReporter, extractFunction, extractDeclaration, compileScope } = require('./_extract');

const t = createReporter('audit round 4: search and navigation (0163)');
const store = read('store.html');
const sql = read('supabase/migrations/0163_store_find_forgives.sql');
const region = (start, len) => { const i = store.indexOf(start); return i < 0 ? '' : store.slice(i, i + (len || 4000)); };

// NAV-03
t.check(/parts = n\.variant \? n\.variant\.split\(\/\\s\+\\\/\\s\+\/\)/.test(store) && /function variantLabel\(combo\)\{ return Object\.values\(combo \|\| \{\}\)\.join\(' \/ '\); \}/.test(store), 'a variant splits on " / " only, the way variantLabel joins it');

// NAV-02
// Reworked in round 5 (NAV-02 reopened): one entry per level opened, pushed during the tap.
t.check(/function navArm\(\)\{/.test(store) && /history\.pushState\(\{ ow: cur \}, ''\)/.test(store) && /window\.addEventListener\('popstate', /.test(store), 'history entries in front, and Back runs the app\'s own stack');
t.check(/if \(window\.stBack\(\)\) \{ navArm\(\); return; \}/.test(store) && /openSheet\('leaveapp'\)/.test(store), 'Back is re-armed after each step; on Today it asks first');
t.check(/const NATIVE_BACK = /.test(store) && /if \(NATIVE_BACK \|\| S\.navLeaving \|\| S\.navIgnore \|\| \(S\.sheet && S\.sheet\.type === 'leaveapp'\)\) return;/.test(store), 'the APK keeps its own back button');
t.check(/SHEET\.leaveapp = /.test(store) && /Leave Omni-ware\?/.test(store) && /still waiting to send · they go when you come back/.test(store) && /Nothing is lost · Today opens where you are/.test(store) && /data-act="leaveapp"[^>]*>Leave<\/button>/.test(store), 'Leave Omni-ware? with Stay / Leave, and what is still waiting');
t.check(/function closeSheet\(silent\)\{ S\.sheet = null; if \(!silent\) renderSheet\(\); navArm\(\); \}/.test(store) && /bindSlides\(\); navArm\(\); \}/.test(store), 'closing a sheet or drawing a screen puts the entry back');

// NAV-04 / NAV-05
t.check(/function orderLookOnly\(q\)\{ return !!q && \(q\.status === 'draft' \|\| orderBuying\(q\) \|\| \(takenBySomeoneElse\(q\) && !canCorrect\(\)\)\); \}/.test(store)
  && /q\.status === 'awaiting_goods' \|\| \(q\.status === 'preparing' && q\.pickingStatus !== 'in_progress' && q\.pickingStatus !== 'done' && goodsBlockPreparing\(q\)\)/.test(store), 'a quote, an order waiting on goods and someone else\'s are look only');
t.check(/if \(orderLookOnly\(q\)\) \{ push\('orderview', \{ id \}\); return; \}/.test(store) && /if \(orderLookOnly\(q\)\) return PAGE\.orderview\(\{ id \}\);/.test(store), 'Pack sends them to the order view, from any door');
t.check(/PAGE\.orderview = /.test(store) && /Packing opens when the goods come in/.test(store) && /is still writing it up with the client/.test(store) && /is packing it/.test(store) && /Look only · /.test(store), 'the order view: buying, quote, someone else\'s');
const stOf = region('const stOf = q => {', 1800).split('\n  return ')[0];
t.check(stOf.length > 200 && !/, null\]/.test(stOf) && /'Quote · not confirmed'/.test(stOf) && /'troad'/.test(stOf) && /'orderview'/.test(stOf), 'every order row in Find opens a screen');
t.check(/Pack short · \$\{esc\(pq\.n\)\} of \$\{esc\(cq\.n\)\}/.test(store) && !/`Pack \$\{esc\(pq\.n\)\} · /.test(store), 'short is an amber choice; "Pack 0" is never the red button');
t.check(/Not in yet · coming from \$\{/.test(store) && /'Waits for the goods'/.test(store) && /if \(orderLineIsBoughtIn\(it\) && !quoteLineReceived\(it\)\) return; pkMark/.test(store) && !/`Only \$\{n0\(quoteLineCount\(cur, from\)\.n\)\} on the shelf/.test(store), 'a line bought for the order that has not come in waits for it');

// REL-05
t.check((store.match(/'Handing over…'/g) || []).length >= 4 && /s\.wait \? stateDot\('sending', 176\)/.test(store) && /state: ui\.sent\.wait \? 'sending' : null/.test(store), 'hand over says Handing over… until the server says yes');
t.check(/ui\.wait \? `Packing \$\{q4\(q\)\}…` : `\$\{q4\(q\)\} is packed`/.test(store) && /ui\.wait \? stateDot\('sending', 128\)/.test(store), 'pack says Packing #… until the server says yes');

// NAV-06 / NAV-07 / NAV-08 (the search runs below)
t.check(!/\.slice\(0, 60\)/.test(region('PAGE.find = () => {', 3000)) && /\$\{qw\.length \? `<div class="st-chiprow"[^`]*>\$\{chip\.map\(/.test(store), 'no row cap in Find, and no chips before a query');
t.check(/function didYouMean\(q\)\{/.test(store) && /Did you mean<\/span>/.test(store), 'nothing found offers "Did you mean"');
t.check(/data-stick aria-hidden="true"/.test(store) && /function stickSync\(pg\)\{/.test(store) && /ACT\.totop = /.test(store) && /Back to the top of \$\{esc\(aisleWord\(A\)\)\}/.test(store), 'a long aisle has a sticky bar with Back, and back to the top');

// The search, compiled from store.html with a small shop.
const names = ['Hinges 4"', 'Butt hinges 4"', 'Gold screws 4*20', 'Black screws 4*20', 'Silicone Clear', 'Wire nails 4"', 'Door handle', 'Screws 4*25'];
const items = names.map((n, i) => ({ key: 'P' + i, productName: n, aisle: { letter: 'K' } }));
const S = compileScope([
  extractDeclaration(store, 'ALIASES', 'store.html'), extractDeclaration(store, 'FD_RANK', 'store.html'),
  // fdNorm's regex holds quote marks the brace matcher reads as strings, so fdNorm and lev are cut by position.
  store.slice(store.indexOf('function fdNorm('), store.indexOf('function fdHit(')), extractFunction(store, 'fdHit', 'store.html'),
  extractFunction(store, 'fdScore', 'store.html'), extractFunction(store, 'itemSearch', 'store.html'), extractFunction(store, 'didYouMean', 'store.html'),
], { stockItems: () => items, labelShort: () => '' }, ['itemSearch', 'didYouMean', 'fdNorm']);
const found = q => S.itemSearch(q).map(x => x.productName);
t.check(found('hindge').includes('Hinges 4"') && found('hindge').includes('Butt hinges 4"'), '"hindge" finds the hinges');
t.check(['4x20', '4×20', '4 x 20', '4X20'].every(q => found(q).length === 2 && found(q).every(n => /4\*20/.test(n))), '"4x20", "4×20" and "4 x 20" find 4*20, not 4*25');
t.check(found('silcone')[0] === 'Silicone Clear', '"silcone" finds Silicone Clear (after 0163)');
t.check(JSON.stringify(S.didYouMean('hngie')) === '["hinge"]' && S.didYouMean('qqqzz').length === 0 && S.didYouMean('hinge').length === 0, '"hngie" offers hinge; nonsense offers nothing');
t.check(!found('425').length && !found('4*21').length, 'a number is still matched as written');

// 0163
t.check(/update products p set name = 'Silicone Clear'\s+where p\.id = 'P550' and p\.name = 'Silcone Clear';/.test(sql), '0163 renames P550 by id and its old name');
t.check(/^\| 0163 \| /m.test(read('docs/decision-rights.md')), 'docs/decision-rights.md reserves 0163');

/* ---------------- on a real database ---------------- */
const conn = process.env.OW_PG;
if (!conn) {
  console.log('skip   - OW_PG is not set, so 0163 is not run on a database (see the header of this file)');
  process.exit(t.done() ? 1 : 0);
}
const db = 'ow_store_round4_test';
const psql = args => spawnSync('psql', [conn, ...args], { encoding: 'utf8' });
const onDb = (args, input) => spawnSync('psql', [`${conn} dbname=${db}`, ...args], { input, encoding: 'utf8' });
t.check(psql(['-qAt', '-c', `drop database if exists ${db}`, '-c', `create database ${db}`]).status === 0, 'a fresh database was made');
t.check(onDb(['-qAt', '-v', 'ON_ERROR_STOP=1'], read('test/fixtures/supabase-shim.sql')).status === 0, 'the Supabase stand-in applied');
const migDir = path.join(__dirname, '..', 'supabase', 'migrations');
const all = fs.readdirSync(migDir).filter(f => f.endsWith('.sql')).sort();
const before = all.filter(f => f < '0163');
const failed = before.filter(f => onDb(['-qAt', '-v', 'ON_ERROR_STOP=1', '-f', path.join(migDir, f)]).status !== 0);
t.check(!failed.length, `every migration before 0163 applied, in order (${failed.join(', ')})`);
const seed = `\\set ON_ERROR_STOP 1
insert into auth.users values ('00000000-0000-0000-0000-00000000000a','o@x');
insert into shops(id,name,created_by) values ('11111111-1111-1111-1111-111111111111','M','00000000-0000-0000-0000-00000000000a');
insert into products(shop_id,id,name,category) values ('11111111-1111-1111-1111-111111111111','P550','Silcone Clear','Furniture'),('11111111-1111-1111-1111-111111111111','P551','Silcone Clear','Furniture');`;
t.check(onDb(['-qAt'], seed).status === 0, 'P550 and a look-alike P551 are seeded');
const mig = path.join(migDir, '0163_store_find_forgives.sql');
t.check(onDb(['-qAt', '-v', 'ON_ERROR_STOP=1', '-f', mig]).status === 0 && onDb(['-qAt', '-v', 'ON_ERROR_STOP=1', '-f', mig]).status === 0, '0163 applies, and is safe to run twice');
const rows = onDb(['-At', '-F', '|', '-c', 'select id, name, category from products order by id']).stdout || '';
t.check(/^P550\|Silicone Clear\|Furniture$/m.test(rows) && /^P551\|Silcone Clear\|Furniture$/m.test(rows), 'only P550 is renamed, and it stays in Furniture');
const after = all.filter(f => f > '0163').filter(f => onDb(['-qAt', '-v', 'ON_ERROR_STOP=1', '-f', path.join(migDir, f)]).status !== 0);
t.check(!after.length, `every migration after 0163 applied (${after.join(', ')})`);
psql(['-qAt', '-c', `drop database if exists ${db}`]);
process.exit(t.done() ? 1 : 0);
