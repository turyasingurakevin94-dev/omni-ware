#!/usr/bin/env node
'use strict';
/*
 * Store audit round 10, final polish (store.html, store-sw.js, 0168; docs/audit/store/ROUND-10.md).
 *
 *   STO-WORD-11 never "Someone": the name they chose, else their staff name, else their role, else "A colleague".
 *   STO-REL-12  two tabs on one order: the second pack and hand-over are refused; the yard's write limits hold (database).
 *   STO-UI-11   Alerts and You on the scale; Report a loss: the whole box is the field.
 *   STO-A11Y-04 a finished card dims its contents, never its stamp; empty text in ink-2.
 *   NAV-08      Back and the title stay on every long list.
 *   NAV-09      Remove a waiting item, after a confirm; a reload opens the same list or detail page.
 *   STO-UI-12   a check-in line: the name, then its tags; the service worker keeps one cache.
 *   Kevin       the light band at the top; the In page; shorter headers; On the road on one row.
 *
 * Run: node test/store-round10.test.js
 *      OW_PG="host=/tmp port=5544 user=postgres" node test/store-round10.test.js
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('store audit round 10: final polish');
const store = read('store.html');
const sw = read('store-sw.js');
const sql = read('supabase/migrations/0168_store_member_roles.sql');
const fn = n => { const l = store.split('\n').find(x => x.startsWith('function ' + n + '(')); return l && (l.match(/\{/g) || []).length === (l.match(/\}/g) || []).length ? l : extractFunction(store, n); };
const region = (from, to) => store.slice(store.indexOf(from), store.indexOf(to, store.indexOf(from)));
const code = store.replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, '');

// STO-WORD-11
{
  const S = { user: { id: 'u-musa' }, data: { staff: [{ id: 'W2', name: 'joyn7', userId: 'u-joy' }],
    members: [{ userId: 'u-own', name: '', role: 'owner' }, { userId: 'u-joy', name: 'joyn7', role: 'store' }, { userId: 'u-x', name: 'The Store' }] } };
  const P = compileScope([fn('looksHandle'), fn('personName')], { S, myName: () => 'Musa Kiggundu', ROLE_WORD: { owner: 'The owner', store: 'The store', manager: 'The manager' } }, ['personName']);
  t.check(P.personName({ userId: 'u-own', stored: 'The Store' }) === 'The owner', 'a login with no name is named by its role: "The owner"');
  t.check(P.personName({ staffId: 'W2' }) === 'The store' && P.personName({ userId: 'u-x' }) === 'A colleague', 'a handle gives way to the role; with no role, "A colleague"');
  t.check(!/'Someone'|someone's on it/i.test(code) && />Packing now</.test(store) && /Someone else just did this/.test(store), 'no screen says "Someone" for a person; "Someone else just did this" stays');
  const R = compileScope([store.slice(store.indexOf('const ROLE_WORD = '), store.indexOf('function initials(')), fn('initials'), fn('firstWord')], { esc: x => String(x) }, ['initials', 'firstWord', 'iniHTML']);
  t.check(/<svg/.test(R.iniHTML(R.initials('The owner'))) && R.iniHTML(R.initials('Ruth Nakato')) === 'RN', 'a role name has a person mark in its avatar, a person their initials');
  t.check(R.firstWord('The owner') === 'The owner' && R.firstWord('Ruth Nakato') === 'Ruth', '"The owner" is never cut to "The"');
  t.check((store.match(/role: m\.role \|\| ''/g) || []).length === 2, 'the members keep their role, on the first load and every refresh');
  t.check(/'name', nullif\(ow_member_name\(p_shop, m\.user_id\), 'The Store'\), 'role', m\.role\)/.test(sql) && /Safe to run twice/.test(sql) && /ROLLBACK/.test(sql) && /CHECK AFTERWARDS/.test(sql), '0168: members carry their role, and no name when they have none');
  t.check(/^\| 0168 \| /m.test(read('docs/decision-rights.md')), 'docs/decision-rights.md reserves 0168');
}
// STO-UI-11
{
  const px = s => (s.match(/font-size:\s*\d+px/g) || []);
  t.check(!px(region('PAGE.alerts = ', 'PAGE.alerts.bg')).length && !px(region('PAGE.me = ', 'PAGE.me.bg')).length, 'Alerts and You set no font size off the scale');
  t.check(/<input id="rp_find"[^>]*align-self:stretch;height:100%/.test(store), 'Report a loss: the whole box is the field');
}
// STO-A11Y-04
t.check(/class="\$\{on \? '' : 'pk-dim'\}"/.test(store) && /\.pk-dim>:first-child>:not\(\.pk-keep\),\.pk-dim>:not\(:first-child\)\{opacity:\.55/.test(store) && (store.match(/class="pk-keep\$\{S\.ui\.pkStamp === k \? ' pk-stamp' : ''\}"/g) || []).length === 2 && !/opacity:\$\{on \? 1 : \.55\}/.test(store), 'a card off to the side dims its contents, never its stamp');
t.check(/\.st-empty\{[^}]*color:var\(--ink2\)/.test(store), 'empty text is ink-2 (5.5:1)');
// NAV-08
t.check(/function stickBar\(title, sub\)\{/.test(store) && /\$\{stickBar\('With ' \+ mgr/.test(store) && /\$\{stickBar\('Alerts'/.test(store) && /\$\{stickBar\('On the road'/.test(store) && /\$\{stickBar\('In'/.test(store), 'With the manager, Alerts, On the road and In keep Back and the title once scrolled');
// NAV-09
t.check(/data-act="rmwait" data-k="\$\{esc\(o\.rm\)\}"/.test(store) && /SHEET\.rmwait = /.test(store) && /Keep it<\/button>/.test(store) && /ACT\.rmwaityes = /.test(store), 'each waiting row has a bin; Remove asks first');
t.check(/if \(k\.startsWith\('ob:'\)\) await outboxDel/.test(store) && /delete S\.pickDraft\[k\.slice\(3\)\]; saveDrafts\(\);/.test(store) && /localStorage\.removeItem\(RC_KEY\(\)\)/.test(store) && /S\.ui\.ct = null; try \{ localStorage\.removeItem\(CT_KEY\(\)\)/.test(store), 'Remove drops each kind for good: a kept report or return, picks, a check-in, a count');
t.check(/const VIEW_PAGES = \['aisle', 'stock', 'find', 'orderview', 'alerts', 'ruth', 'me', 'onroad', 'labels', 'movein', 'movepack'\];/.test(store) && /sessionStorage\.setItem\(VIEW_KEY\(\)/.test(store) && /restoreDrafts\(\); restoreView\(\);/.test(store) && /if \(S\.started\) saveView\(\); \}/.test(store), 'a reload opens the same list or detail page; flows carry on from Today');
// STO-UI-12
{
  const N = compileScope([fn('variantLabel'), fn('nameParts')], { productById: id => id === 'P1' ? { name: 'ABC Black Screws', variants: [{ combo: { s: '8*', t: 'Coarse' } }] } : null }, ['nameParts']);
  const a = N.nameParts('P9', null, 'Black Screws 8* / Coarse / 3/4"'), b = N.nameParts('P1', null, 'ABC Black Screws 8* / Coarse');
  t.check(a.base === 'Black Screws' && a.variant === '8* / Coarse / 3/4"', `a line with its size in the name splits into the name and tags (${a.base} | ${a.variant})`);
  t.check(b.base === 'ABC Black Screws' && b.variant === '8* / Coarse', 'a name that ends in one of the product\'s variants takes that variant');
  t.check(/\$\{prodTT\(l, 'font-size:var\(--t-14\)'\)\}<span class="cv-sb">\$\{esc\(rcToText\(l, n\)\)\}/.test(store), 'the check-in line is drawn as name and tags');
  t.check(/const CACHE = 'ow-store-v2';/.test(sw) && /k\.startsWith\('ow-store-'\) && k !== CACHE\) await caches\.delete\(k\)/.test(sw) && !/PAGE_CACHE|LIB_CACHE/.test(sw), 'the service worker keeps one cache and deletes the rest');
}
// Kevin: the light band at the top of pushed pages
t.check(/var navyTop = navy \? \(page && page\.contains\(navy\) \? navy\.offsetTop - page\.scrollTop/.test(store) && /document\.addEventListener\('animationend', soon, true\);/.test(store), 'the strip behind the clock is judged by where the header sits, and repainted when a page has slid in');
t.check(/var ours = root\.getAttribute\('data-ow-insets'\) === 'guess';/.test(store) && /if\(ours && !typing\)\{ root\.style\.removeProperty\('--safe-area-inset-top'\)/.test(store), 'when Android keeps the clock apart, no room is kept for it');
// Kevin: the In page
{
  const inS = compileScope([region('function inStage(', '// What a trip carries')], { tripLines: t => t.lines || [], tripLineGot: l => l.got, tripIsSupplierDelivered: t => t.sd }, ['inStage']);
  t.check(inS.inStage([{ status: 'collecting', lines: [{ got: 1 }] }, { status: 'collecting', lines: [{ got: null }] }]).k === 'buy' && inS.inStage([{ status: 'collecting', lines: [{ got: 1 }] }]).k === 'come'
    && inS.inStage([{ status: 'assigned', lines: [{ got: null }] }]).k === 'wait' && inS.inStage([{ sd: true, lines: [] }]).k === 'come', 'Buying until every stop is done, then Coming; Not started; a supplier delivery is Coming');
  const F = compileScope([region('function inFor(', 'PAGE.movein = ')], { tripOrders: t => t.ords || [], quoteById: id => id === 49 ? { id: 49, client: 'Ssali' } : null, q4: q => '#00' + q.id, shortName: x => x, quoteClientName: q => q.client, nOf: (n, w) => `${n} ${w}${n === 1 ? '' : 's'}` }, ['inFor']);
  t.check(F.inFor([{ ords: [] }])[0] === 'For the shelf' && F.inFor([{ ords: [77] }])[0] === 'For 1 order' && F.inFor([{ ords: [49, 77] }])[0] === '#0049 Ssali +1', 'never a bare "For": the order, "For 1 order" or "For the shelf"');
  t.check(/>Coming in<span class="m">/.test(store) && !/>On the way</.test(code) && /Nothing at the gate/.test(store) && /AT THE GATE · NEXT/.test(store) && /class="in-ride"/.test(store), 'the In page: the road in, the next at the gate, Coming in, a calm card when nothing waits');
}
// Kevin: shorter headers, On the road on one row
t.check(/function compactHead\(title, fig, sub, inner, lead\)\{/.test(store) && /\$\{compactHead\('To pack', pq\.length/.test(store) && /\$\{compactHead\('On the road', null/.test(store) && /\$\{compactHead\(S2\.title, null, S2\.sub, track, badge\)\}/.test(store), 'To pack, On the road and the count pages have the one-row header');
{
  const road = region('PAGE.onroad = () => {', 'PAGE.onroad.bg');
  t.check(!/flex-wrap:wrap/.test(road) && /<span class="cv-tt clamp2"[^>]*>\$\{esc\(quoteClientName\(o\)\)\}<\/span><span class="cv-sb"><span class="m"[^>]*>\$\{q4\(o\)\}<\/span>/.test(road) && /Delivered<\/span>`\}<\/button>/.test(road) && !/Mark delivered/.test(road), 'On the road: one row per stop, the client first, "Delivered" beside it');
}

/* ---------------- on a real database ---------------- */
const conn = process.env.OW_PG;
if (!conn) {
  console.log('skip   - OW_PG is not set, so the scenario is not run on a database (see the header of this file)');
  process.exit(t.done() ? 1 : 0);
}
const db = 'ow_store_round10_test';
const psql = args => spawnSync('psql', [conn, ...args], { encoding: 'utf8' });
const onDb = (args, input) => spawnSync('psql', [`${conn} dbname=${db}`, ...args], { input, encoding: 'utf8' });
t.check(psql(['-qAt', '-c', `drop database if exists ${db}`, '-c', `create database ${db}`]).status === 0, 'a fresh database was made');
t.check(onDb(['-qAt', '-v', 'ON_ERROR_STOP=1'], read('test/fixtures/supabase-shim.sql')).status === 0, 'the Supabase stand-in applied');
const migDir = path.join(__dirname, '..', 'supabase', 'migrations');
const failed = fs.readdirSync(migDir).filter(f => f.endsWith('.sql')).sort().filter(f => onDb(['-qAt', '-v', 'ON_ERROR_STOP=1', '-f', path.join(migDir, f)]).status !== 0);
t.check(!failed.length, `every migration applied, in order (${failed.join(', ')})`);
t.check(onDb(['-qAt', '-v', 'ON_ERROR_STOP=1', '-f', path.join(migDir, '0168_store_member_roles.sql')]).status === 0, '0168 is safe to run twice');
const r = onDb(['-At', '-F', '|'], read('test/fixtures/store-round10-scenario.sql'));
const out = (r.stdout || '') + (r.stderr || '');
t.check(/^A packs\|done$/m.test(out) && /B packs\|40001 Someone else just changed this order\./.test(out), 'tab B packs after tab A: refused, "Someone else just changed this order"');
t.check(/^A hands over\|completed$/m.test(out) && /B hands over\|40001 Someone else just changed this order\./.test(out) && /^row\|completed\|Peter\|1$/m.test(out), 'tab B hands over after tab A: refused, and the order keeps tab A\'s carrier and bay');
for (const w of ['own role|0 rows', 'manager role|0 rows', 'order insert|refused 42501', 'order update|0 rows', 'customer update|0 rows', 'write_off_stock|refused 42501', 'accept_stock_count|refused 42501', 'decide_invoice_ask|refused 42501', 'accept_trip_difference|refused 42501'])
  t.check(out.includes('w|' + w), `a Store login: ${w.replace('|', ' — ')}`);
t.check(out.includes('w|own ask|written'), 'a Store login still sends its own asks');
t.check(/^member\|owner\|∅$/m.test(out) && /^member\|manager\|Ruth Nakato$/m.test(out), 'the snapshot\'s members: the owner with no name and the role "owner"; Ruth by name');
t.done();
