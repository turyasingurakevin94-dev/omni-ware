#!/usr/bin/env node
'use strict';
/*
 * The audit of 19 October 2026, part two: what the phones read, and how often.
 *
 * Measured on a shop of 1,500 orders and 3,000 cash lines (headless Chromium,
 * the real pages against a real database): every role app read the WHOLE
 * order history at boot (2 MB raw) and again on every poll -- Sales every 60 s,
 * Buyer/Store/Manager every 45 s, Accounts and Owner the whole books every
 * 90 s (29 reads, 3 MB) -- and rewrote a 3 MB snapshot each time. A bare
 * .limit() above 1,000 was cut at 1,000 rows by PostgREST with HTTP 200 and
 * no error (supabase/config.toml max_rows), so the month's cash book, the
 * stock log and the owner's log silently lost rows on a busy shop. The
 * database client came unpinned from a CDN, in front of first paint.
 *
 * What this pins:
 *   1. The polls read the orders that can still change (liveQuoteFilter)
 *      and merge them (mergeQuotes); the whole history is read at boot and on
 *      coming back, as before.
 *   2. Accounts and Owner poll a live set, not loadAll.
 *   3. Every read that used a bare limit above 1,000 is paged through
 *      selectAll (or its filter form).
 *   4. The WhatsApp poll runs only on a shop that has WhatsApp, and slows
 *      down when Chats is not open.
 *   5. supabase-js is pinned and preconnected; the Capacitor transform still
 *      swaps it for the bundled copy and drops the preconnect.
 *   6. 0137 adds the indexes the windows and the hourly run were missing.
 *
 * Run: node test/audit-live-refresh.test.js
 */
const { read, createReporter } = require('./_extract');

const t = createReporter('the audit\'s live refresh and paging (0137)');
const apps = { sales: read('sales.html'), buyer: read('buyer.html'), store: read('store.html'), manager: read('manager.html'), accounts: read('accounts.html'), owner: read('owner.html') };
const LIVE = /function liveQuoteFilter\(q\)\{ return q\.or\('status\.neq\.completed,invoiced\.eq\.false,voided\.eq\.true,invoiced_ts\.gte\.' \+ new Date\(Date\.now\(\) - 2 \* 864e5\)\.toISOString\(\)\); \}/;
const MERGE = /function mergeQuotes\(rows\)\{\n  const list = D\(\)\.savedQuotes \|\| \[\], at = new Map\(list\.map\(\(q, i\) => \[Number\(q\.id\), i\]\)\);\n  rows\.forEach\(r => \{ const q = rowToQuote\(r\), i = at\.get\(Number\(q\.id\)\); if \(i == null\) list\.push\(q\); else list\[i\] = q; \}\);/;

/* ---------------- 1. the live window, merged ---------------- */
for (const a of Object.keys(apps).filter(a => a !== 'store')) {
  t.check(LIVE.test(apps[a]) && MERGE.test(apps[a]), `${a}: has the live window and the merge`);
}
// The Store app reads one snapshot, money taken out in the database (round 5, 0164): no direct order reads to page.
t.check(/const sn = await storeSnapshotNow\(\); S\.snapMode = true;/.test(apps.store) && !/from\('saved_quotes'\)/.test(apps.store) && /D\(\)\.savedQuotes = \(sn\.orders \|\| \[\]\)\.map\(rowToQuote\)/.test(apps.store), 'store: boot and refresh read only the snapshot');
t.check(/const \[rows, sw\] = await Promise\.all\(\[selectAll\('saved_quotes', 'id', liveQuoteFilter\), switchesQuery\(\)\]\); mergeQuotes\(rows\);/.test(apps.sales), 'sales: refreshQuotes reads the live window and merges');
for (const a of ['buyer', 'manager']) {
  const fn = apps[a].slice(apps[a].indexOf('async function refreshLive()'), apps[a].indexOf('async function refreshLive()') + 1500);
  t.check(/selectAll\('saved_quotes', 'id', liveQuoteFilter\)/.test(fn) && /mergeQuotes\(quotes\);/.test(fn) && !/S\.data\.savedQuotes = quotes\.map\(rowToQuote\)/.test(fn), `${a}: refreshLive reads the live window and merges`);
}
for (const a of Object.keys(apps).filter(a => a !== 'store')) {
  // boot still reads everything: the figures on Today are whole
  const boot = apps[a].slice(apps[a].indexOf('async function loadAll()'), apps[a].indexOf('async function loadAll()') + 2500);
  t.check(/selectAll\('saved_quotes'\)/.test(boot), `${a}: boot still reads the whole order book`);
}

/* ---------------- 2. Accounts and Owner poll a live set ---------------- */
t.check(/setInterval\(\(\) => \{ if \(document\.visibilityState === 'visible' && quiet\(\) && !S\.sheet\) refreshLive\(\)/.test(apps.accounts) && !/setInterval\(\(\) => \{ if \(document\.visibilityState === 'visible' && quiet\(\) && !S\.sheet\) loadAll\(\)/.test(apps.accounts), 'accounts: the 90 s timer calls refreshLive, not loadAll');
t.check(/async function refreshLive\(\)\{\n  if \(!S\.data\) return loadAll\(\);/.test(apps.accounts) && /selectAll\('cash_txns', 'id', \['date', daysAgoISO\(2\)\]\)/.test(apps.accounts) && /if \(asks\) D\(\)\.asks = asks\.map\(rowToAsk\);/.test(apps.accounts) && /if \(payAsks\) D\(\)\.payAsks = payAsks\.map\(rowToPayAsk\);/.test(apps.accounts) && /if \(handoffs\) \{ D\(\)\.handoffs = accHandoffs\(handoffs\); D\(\)\.looseCash = accLooseCash\(handoffs\); \}/.test(apps.accounts), 'accounts: refreshLive reads orders, two days of cash, the asks and the hand-offs, through the same mappers as boot');
t.check(/payAsks: \(payAsks \|\| \[\]\)\.map\(rowToPayAsk\),/.test(apps.accounts) && /handoffs: accHandoffs\(handoffs\),/.test(apps.accounts), 'accounts: boot uses those mappers too, so the two cannot drift');
t.check(/setInterval\(\(\) => \{ if \(document\.visibilityState === 'visible' && quiet\(\) && !S\.sheet\) refreshLive\(\)/.test(apps.owner) && /selectAll\('decision_log', 'id', \['at', since\]\)/.test(apps.owner) && /D\(\)\.log = fresh\.reverse\(\)\.concat\(D\(\)\.log \|\| \[\]\)/.test(apps.owner), 'owner: the 90 s timer reads new log lines and live orders, newest first');

/* ---------------- 3. no bare limit above 1,000 ---------------- */
for (const a of Object.keys(apps)) {
  const bare = [...apps[a].matchAll(/\.limit\((\d{4,})\)/g)].map(m => Number(m[1])).filter(n => n > 1000);
  t.check(bare.length === 0, `${a}: no read asks for more than 1,000 rows in one page (PostgREST cuts it to 1,000, HTTP 200)${bare.length ? ' -- found ' + bare.join(', ') : ''}`);
}
t.check(/selectAll\('cash_txns', 'id', q => q\.gte\('date', monthStartISO\(\)\)\)\.then\(rows => \(\{ data: rows \}\)\)/.test(apps.sales), 'sales: the month\'s cash book is paged');
t.check(/selectAll\('cash_txns', 'id', q => q\.gte\('date', cashFromISO\(\)\)\)\.then\(rows => \(\{ data: rows \}\)\)/.test(apps.manager) && /selectAll\('rival_prices'\)\.then\(rows => \(\{ data: rows \}\)/.test(apps.manager), 'manager: the cash book and rival prices are paged');
t.check(/selectAll\('stock_log', 'id', q => q\.not\('pi_id', 'is', null\)\.gte\('date', daysAgoISO\(400\)\)\)/.test(apps.accounts) && /selectAll\('collection_trips', 'id', q => q\.gte\('created_at'/.test(apps.accounts), 'accounts: the stock log and the trips are paged');
t.check(/selectAll\('decision_log', 'id', \['at', new Date\(Date\.now\(\) - 62 \* 864e5\)\.toISOString\(\)\]\)\.then\(rows => \(\{ data: rows\.slice\(\)\.reverse\(\) \}\)/.test(apps.owner), 'owner: the log is paged, newest first');
for (const a of ['sales', 'buyer', 'manager']) t.check(/async function selectAll\(table, keyCol, filter\)\{[\s\S]{0,400}if \(filter\) q = filter\(q\);/.test(apps[a]), `${a}: selectAll takes a filter`);
for (const a of ['accounts', 'owner']) t.check(/if \(typeof since === 'function'\) q = since\(q\); else if \(since\) q = q\.gte\(since\[0\], since\[1\]\);/.test(apps[a]), `${a}: selectAll takes a filter or a since`);

/* ---------------- 4. the WhatsApp poll ---------------- */
// The first tick reads the chats at once (the retest of 21 Oct: skipping it held Today's chats back 45 s).
t.check(/const waTick = async \(\) => \{ if \(document\.visibilityState !== 'visible' \|\| S\.loginLost\) return; if \(S\.wa\.configured == null\) await waStatus\(\); if \(!S\.wa\.configured\) return; if \(S\.view !== 'chats' && S\.wa\.loadedAt && \(\+\+waTicks % 4\)\) return;/.test(apps.sales), 'sales: the chats poll asks once whether the shop has WhatsApp, reads them on the first tick, then ticks every minute unless Chats is open');

/* ---------------- 5. the database client ---------------- */
const fs = require('fs'), path = require('path');
for (const a of ['sales', 'buyer', 'store', 'manager', 'accounts', 'sourcing', 'owner', 'agent']) {
  const src = read(a + '.html');
  t.check(src.includes('<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0/dist/umd/supabase.js"></script>') && !/supabase-js@2\/dist/.test(src), `${a}: supabase-js is pinned`);
  t.check(src.includes('<link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>'), `${a}: and preconnected`);
  const tr = require(path.join(__dirname, '..', 'apps', a, 'src', 'transform.js'));
  const out = tr(src);
  t.check(out.includes('<script src="vendor/supabase.js"></script>') && !/cdn\.jsdelivr\.net/.test(out), `${a}: the app's transform still swaps it for the bundled copy and drops the preconnect`);
}

/* ---------------- 6. the indexes ---------------- */
const sql = read('supabase/migrations/0137_audit_indexes.sql');
for (const ix of ['cash_txns_shop_date_idx on cash_txns (shop_id, date)', 'stock_log_shop_date_idx on stock_log (shop_id, date)', "stock_log_shop_counts_idx on stock_log (shop_id, id desc) where type in ('count', 'correction')", 'saved_quotes_shop_status_idx on saved_quotes (shop_id, status)', "saved_quotes_due_invoice_idx on saved_quotes (shop_id) where status = 'completed' and not invoiced and not voided", 'saved_quotes_live_idx on saved_quotes (shop_id, invoiced_ts)', 'push_outbox_to_user_idx on push_outbox (to_user, id desc) where to_user is not null']) {
  t.check(sql.includes('create index if not exists ' + ix), '0137: ' + ix.split(' on ')[0]);
}
t.check(/\| 0137 \| /.test(read('docs/decision-rights.md')), 'docs/decision-rights.md reserves 0137 for it');

process.exit(t.done() ? 1 : 0);
