#!/usr/bin/env node
'use strict';
/*
 * Store audit round 9, speed (store.html, store-sw.js, 0166; docs/audit/store/ROUND-9.md).
 *
 *   STO-SPD-01  store-sw.js: the page opens with no signal; a new build says "Update ready · Reload";
 *               the books are never cached by it.
 *   STO-SPD-02  Find: typing waits 120 ms and redraws only the results and the chip counts, 30 rows at a time.
 *   STO-SPD-03  boot asks the shop and its books at once, beside the sign-in check; the 45-second refresh
 *               reads store_live (0166) with the stock folded in, and falls back without it.
 *   STO-SPD-04  "Live" only after this session's fresh load; "Updating…" before it.
 *   STO-A11Y-03 Pack's header count, the bar's words and the Alerts times clear 4.5:1.
 *   STO-UI-10   on a short phone the slip and the panel are one scroll.
 *
 * Run: node test/store-round9.test.js
 *      OW_PG="host=/tmp port=5544 user=postgres" node test/store-round9.test.js
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('store audit round 9: speed');
const store = read('store.html');
const sw = read('store-sw.js');
const sql = read('supabase/migrations/0166_store_live_snapshot.sql');
const fn = n => { const l = store.split('\n').find(x => x.startsWith('function ' + n + '(') || x.startsWith('async function ' + n + '(')); return l && (l.match(/\{/g) || []).length === (l.match(/\}/g) || []).length ? l : extractFunction(store, n); };

(async () => {
  // STO-SPD-01
  t.check(/if \(\/\(\^\|\\\.\)supabase\\\.co\$\/\.test\(url\.hostname\)\) return;/.test(sw) && !/indexedDB/.test(sw), 'the worker never answers a request to the books, and keeps no data');
  t.check(/if \(had\) \{ event\.waitUntil\(fresh\.catch\(\(\) => \{\}\)\); return had; \}/.test(sw) && /if \(old != null && old !== body\) await tell\(\);/.test(sw) && /ready = false;/.test(sw), 'the page comes from the phone, is fetched again behind it, and a changed one is told once');
  t.check(/@supabase\/supabase-js@/.test(sw) && /fonts\.gstatic\.com/.test(sw) && /\/manifest-store\.json/.test(sw), 'supabase.js, the fonts and the manifest are kept on the phone');
  t.check(/navigator\.serviceWorker\.register\('\/store-sw\.js', \{ scope: '\/store\.html' \}\)/.test(store) && /if \(native \|\| !\('serviceWorker' in navigator\) \|\| !\(location\.protocol === 'https:' \|\| location\.hostname === 'localhost'\)\) return;/.test(store)
    && /S\.prefs = loadPrefs\(\); applyPrefs\(\); registerStoreSW\(\);/.test(store), 'registered for the Store page only, over https, never inside the Android app');
  t.check(/<b style="font-size:var\(--t-14\)">Update ready<\/b>/.test(store) && /A newer Store app is here/.test(store) && /data-act="swreload"[^>]*>Reload<\/button>/.test(store) && /\$\{updateBar\(\)\}\$\{waitCard\(live\)\}/.test(store), 'Today says "Update ready · A newer Store app is here · Reload" at the top');
  // STO-SPD-02
  t.check(/ACT\['in:fdq'\] = t => \{ S\.ui\.fd\.q = t\.value; S\.ui\.fd\.lim = FD_STEP; clearTimeout\(ACT\.fdT\); ACT\.fdT = setTimeout\(findRedraw, 120\); \};/.test(store), 'typing waits 120 ms, then redraws what the query changes');
  t.check(/morphInto\(res, fdResults\(ui, F\)\); const ch = pg\.querySelector\('\[data-live="fdchips"\]'\); if \(ch\) morphInto\(ch, fdChips\(ui, F\)\);/.test(store) && /<div data-live="fdres"/.test(store) && /data-live="fdchips"/.test(store), 'only the results and the chip counts are redrawn; the box keeps its caret');
  t.check(/function fdIndex\(\)\{ return memo\('fdIndex', /.test(store) && /return memo\('fd:' \+ qn, /.test(store), 'the words are worked out once per change to the books, each query once');
  t.check(/const FD_STEP = 30;/.test(store) && /Show \$\{Math\.min\(FD_STEP, more\)\} more/.test(store) && /ACT\.fdmore = \(\) => \{ S\.ui\.fd\.lim = \(S\.ui\.fd\.lim \|\| FD_STEP\) \+ FD_STEP;/.test(store), 'the first 30 rows, then "Show 30 more"');
  // STO-SPD-03
  {
    const boot = extractFunction(store, 'boot');
    const at = s => boot.indexOf(s);
    t.check(at('const membersP = fast ? readMembers(u0) : null, freshP = fast && early ? readFresh()') > 0 && at('const membersP') < at('await userP') && /const r = first && membersP \? await membersP : await readMembers\(user\);/.test(boot), 'the shop and its books are asked at once, beside the sign-in check');
    t.check(/if \(f && f\.shopId === S\.shopId\) \{ applyFresh\(f\); loadSide\(\); \} else await loadAll\(\);/.test(boot) && /const f = freshP && early && early\.shopId === S\.shopId \? await freshP : null;/.test(boot), 'the early read is used only for the shop the person opens');
    t.check(/error\.status === 401 \|\| error\.status === 403/.test(boot) && /!isNetworkError\(error\)/.test(boot), 'a sign-in the server refuses still ends the session; no signal does not');
    t.check(/async function loadAll\(\)\{ applyFresh\(await readFresh\(\)\); loadSide\(\); \}/.test(store) && /if \(loadSide\.on \|\| Date\.now\(\) - \(S\.sideAt \|\| 0\) < 600000\) return;/.test(store), 'places, routes and road names come after the first paint');
    const M = compileScope([fn('snapStock'), fn('stockMapOf')], {}, ['stockMapOf']);
    t.check(JSON.stringify(M.stockMapOf({ stock: { P1: '14', P2: 3 } }, null)) === '{"P1":14,"P2":3}' && JSON.stringify(M.stockMapOf({}, [{ key: 'P1', qty: '2' }])) === '{"P1":2}' && M.stockMapOf({}, null) === null, 'the stock folded in (0166), or read as before');
    let calls = [];
    const S = { shopId: 's' }, sb = { rpc: async n => { calls.push(n); return n === 'store_live' ? (S.has ? { data: { orders: [] }, error: null } : { data: null, error: { code: 'PGRST202' } }) : { data: { orders: [1] }, error: null }; } };
    const L = compileScope([fn('storeSnapshotNow'), fn('storeLiveNow')], { S, sb }, ['storeLiveNow']);
    await L.storeLiveNow(); await L.storeLiveNow();
    t.check(calls.join() === 'store_live,store_snapshot,store_snapshot' && S.noLive === true, 'without 0166 the refresh asks once, then uses the snapshot');
    calls = []; delete S.noLive; S.has = true; await L.storeLiveNow();
    t.check(calls.join() === 'store_live', 'with 0166 the refresh is one store_live call');
    t.check(/storeLiveNow\(\), S\.noLive \? selectCols\('stock', STOCK_COLS, 'key'\)/.test(store) && /S\.loadedAt = S\.freshAt = Date\.now\(\);/.test(store), 'the refresh takes the stock from store_live, and marks the data fresh');
  }
  // STO-SPD-04
  {
    const S = { loadedAt: Date.now() - 60000 };
    const P = compileScope([fn('hm'), store.slice(store.indexOf('function freshWord('), store.indexOf('// A newer Store app has been downloaded'))], { S }, ['freshWord']);
    t.check(/>Updating…</.test(P.freshWord()), 'a recent saved copy reads "Updating…"');
    S.loadedAt = new Date(2026, 9, 23, 7, 52).getTime();
    t.check(/cv-live wait"><i><\/i>Updating · saved 7:52</.test(P.freshWord()), 'an older one reads "Updating · saved 7:52"');
    t.check(/!live \? '<span class="cv-live off"><i><\/i>Offline<\/span>' : S\.freshAt \? '<span class="cv-live"><i><\/i>Live<\/span>' : freshWord\(\);/.test(store), '"Live" only once this session\'s fresh load is in; "Offline" with no signal');
  }
  // STO-A11Y-03
  {
    const lum = h => { const c = h.match(/\w\w/g).map(x => parseInt(x, 16) / 255).map(v => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
    const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
    t.check(/<span style="font-size:var\(--t-12\);color:var\(--navyInk\)">\/\$\{n\}<\/span>/.test(store) && ratio('B3BCD2', '16203C') >= 4.5, `Pack's header count is navy-ink on navy (${ratio('B3BCD2', '16203C').toFixed(1)}:1)`);
    t.check(/\.st-nav\.cv-nav button:not\(\.st-go\):not\(\[aria-current="page"\]\)\{color:var\(--ink2\)\}/.test(store) && /\.cv-at\{[^}]*color:var\(--ink2\)\}/.test(store) && ratio('5F6980', 'FFFFFF') >= 4.5, `the bar's words and the Alerts times are ink-2 (${ratio('5F6980', 'FFFFFF').toFixed(1)}:1)`);
  }
  // STO-UI-10
  t.check(/@media \(max-height:700px\)\{\.sl-cv\{overflow-y:auto\}\.sl-cv>\.sl-scroll\{flex:none!important;overflow:visible!important\}\.sl-cv>:last-child\{margin-top:auto\}\}/.test(store)
    && /<div class="cv sl-cv"/.test(store) && /<div class="sl-scroll" style="flex:1;min-height:0;overflow-y:auto/.test(store), 'on a short phone the slip and the panel are one scroll; the panel still sits at the bottom when both fit');
  // 0166, the text
  t.check(/create or replace function store_live\(p_shop uuid\)/.test(sql) && /return store_live\(p_shop\) \|\| jsonb_build_object\(/.test(sql) && /'stock', coalesce\(\(select jsonb_object_agg\(s\.key, s\.qty\) from stock s where s\.shop_id = p_shop\), '\{\}'::jsonb\)/.test(sql), '0166: the snapshot is store_live plus what rarely changes; the stock folded in');
  t.check(/since date := current_date - 28;/.test(sql) && /interval '30 days'/.test(sql) && /and \(not t\.voided or /.test(sql) && /jsonb_strip_nulls\(jsonb_build_object\('product_id', r\.product_id/.test(sql), '0166: 28 days of history, 30 days of deliveries, voided trips for 14 days, units without their id');
  t.check(/revoke all on function store_live\(uuid\) from public, anon;/.test(sql) && /grant execute on function store_live\(uuid\) to authenticated;/.test(sql) && /Safe to run twice/.test(sql) && /ROLLBACK/.test(sql) && /CHECK AFTERWARDS/.test(sql), '0166: for signed-in members only; runs twice; says how to check and roll back');
  t.check(/^\| 0166 \| /m.test(read('docs/decision-rights.md')), 'docs/decision-rights.md reserves 0166');

  /* ---------------- on a real database ---------------- */
  const conn = process.env.OW_PG;
  if (!conn) {
    console.log('skip   - OW_PG is not set, so 0166 is not tried on a database (see the header of this file)');
    process.exit(t.done() ? 1 : 0);
  }
  const db = 'ow_store_round9_test';
  const psql = args => spawnSync('psql', [conn, ...args], { encoding: 'utf8' });
  const onDb = (args, input) => spawnSync('psql', [`${conn} dbname=${db}`, ...args], { input, encoding: 'utf8' });
  t.check(psql(['-qAt', '-c', `drop database if exists ${db}`, '-c', `create database ${db}`]).status === 0, 'a fresh database was made');
  t.check(onDb(['-qAt', '-v', 'ON_ERROR_STOP=1'], read('test/fixtures/supabase-shim.sql')).status === 0, 'the Supabase stand-in applied');
  const migDir = path.join(__dirname, '..', 'supabase', 'migrations');
  const failed = fs.readdirSync(migDir).filter(f => f.endsWith('.sql')).sort().filter(f => onDb(['-qAt', '-v', 'ON_ERROR_STOP=1', '-f', path.join(migDir, f)]).status !== 0);
  t.check(!failed.length, `every migration applied, in order (${failed.join(', ')})`);
  t.check(onDb(['-qAt', '-v', 'ON_ERROR_STOP=1', '-f', path.join(migDir, '0166_store_live_snapshot.sql')]).status === 0, '0166 is safe to run twice');
  const r = onDb(['-At', '-F', '|'], read('test/fixtures/store-round9-scenario.sql'));
  const out = (r.stdout || '') + (r.stderr || '');
  t.check(/^live keys\|asks,counts,holds,managers,me,members,orders,reports,returns,stock,trips$/m.test(out), 'store_live holds what changes all day, and the stock');
  t.check(/^snap keys\|agents,asks,counted,counts,customers,holds,log,managers,me,members,orders,presets,products,reports,returns,staff,stock,suppliers,trips,units$/m.test(out) && /^live part of snap\|t$/m.test(out), 'the snapshot keeps every key it had, plus the stock, and holds store_live whole');
  t.check(/^stock\|\{"P1": 14, "P2": 3\}$/m.test(out), 'the stock is { key: qty }');
  t.check(/^orders\|601,602$/m.test(out), 'an order delivered 29 days ago stays; one delivered 32 days ago goes');
  t.check(/^trips\|T1,T2$/m.test(out), 'a trip voided 3 days ago stays; one voided 15 days ago goes');
  t.check(/^log\|1$/m.test(out), 'stock history is 28 days');
  t.check(/^unit\|\{"unit": "Box", "pack_qty": 20, "pack_unit": "Ctn", "product_id": "P1"\}$/m.test(out), 'a unit row carries no id and no empty field');
  t.check(/^money\|none$/m.test(out), 'no money word in the snapshot');
  t.check(/stranger\|live\|refused\|42501/.test(out), 'someone outside the shop is refused');
  t.done();
})();
