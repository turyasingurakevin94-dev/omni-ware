#!/usr/bin/env node
'use strict';
/*
 * Store audit round 8, accessibility (+ round 7 leftovers) (store.html only; docs/audit/store/ROUND-8.md).
 *
 *   STO-REL-11  the shop is asked once the sign-in is ready, three times, and "no shop" only on a real empty answer.
 *   STO-A11Y-01 Big text steps every size up at least 1.2x, the scale's tokens included; controls grow to 52px.
 *   STO-UI-03   option A2: the white bar reaches the play button's top, so nothing above the bar is under it.
 *   STO-A11Y-02 one h1 per screen, h2 for each section, and what is under a page or sheet is inert.
 *   STO-A11Y-03 "1 of 2" on Pack sits on a white pill (5.5:1).
 *   STO-UI-10   Hand over: one scrolling picker row, the slip scrolls clear of the panel; On the road: the button under the order.
 *
 * Run: node test/store-round8.test.js
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('store audit round 8: accessibility');
const store = read('store.html');
const fn = n => { const l = store.split('\n').find(x => x.startsWith('function ' + n + '(') || x.startsWith('async function ' + n + '(')); return l && (l.match(/\{/g) || []).length === (l.match(/\}/g) || []).length ? l : extractFunction(store, n); };

(async () => {
  // STO-REL-11
  {
    const run = async (answers) => {
      let reads = 0, refreshed = 0;
      const sb = { auth: { getSession: async () => ({ data: { session: { expires_at: Date.now() / 1000 + 3600 } } }), refreshSession: async () => { refreshed++; return {}; } },
        from: () => ({ select: () => ({ eq: async () => { const a = answers[Math.min(reads, answers.length - 1)]; reads++; return a; } }) }) };
      const M = compileScope([fn('sessionReady'), fn('readMembers')], { sb, setTimeout: f => f() }, ['readMembers']);
      const r = await M.readMembers({ id: 'u' }); return { r, reads, refreshed };
    };
    const row = { shop_id: 's', role: 'store' };
    let x = await run([{ data: [], error: null }, { data: [row], error: null }]);
    t.check(x.r.rows && x.r.rows.length === 1 && x.refreshed === 1 && x.reads === 2, 'an empty first answer (a stale sign-in) refreshes the sign-in and asks again');
    x = await run([{ data: null, error: { code: '503' } }, { data: null, error: { code: '503' } }, { data: [row], error: null }]);
    t.check(x.r.rows && x.r.rows.length === 1 && x.reads === 3, 'two failed reads, then the shop: no "no shop" on the way');
    x = await run([{ data: null, error: { code: '503' } }]);
    t.check(x.r.error && x.r.error.code === '503' && x.reads === 3, 'three failed reads end in an error, never in "no shop"');
    x = await run([{ data: [], error: null }]);
    t.check(x.r.rows && x.r.rows.length === 0 && x.reads === 2, 'a login with no membership is still told so, after one fresh ask');
    t.check(/if \(!S\.started\) authScreen\('checking'\);/.test(store) && /await authScreen\('unreachable'\);\n    authScreen\('checking'\);/.test(store) && /Checking your shop…/.test(store) && /Could not reach the shop<\/h1>/.test(store) && /Tried 3 times · code/.test(store), 'boot says "Checking your shop…", and "Could not reach the shop" with Try again and a code');
  }
  // STO-A11Y-01
  {
    t.check(/html\.big\{--t-12:15px;--t-14:17px;--t-16:20px;--t-20:24px;--t-28:34px;--t-40:48px;--tap:52px\}/.test(store), 'Big text steps the scale up: 15/17/20/24/34/48');
    const B = compileScope([fn('bigPx'), fn('bigText')], {}, ['bigPx', 'bigText']);
    t.check([11, 12, 13, 14, 16, 18, 20, 22, 28].every(px => B.bigPx(px) / px >= 1.2), 'every size still written in px grows at least 1.2x');
    t.check(B.bigText('<b style="font-size:12px;height:44px">') === '<b style="font-size:15px;height:52px">' && B.bigText('style="min-height:44px"') === 'style="min-height:52px"', 'and a 44px control grows to 52px');
  }
  // STO-UI-03
  t.check(/\.st-nav\.cv-nav\{grid-template-columns:1fr 96px 1fr;padding-top:38px\}/.test(store) && /\.st-nav\.cv-nav \.st-go\{height:64px;margin-top:-34px;box-shadow:0 0 0 4px #fff/.test(store) && /--nav-room:calc\(120px \+ var\(--safe-area-inset-bottom\)\);/.test(store), 'the white bar reaches the play button\'s top (A2), and the room follows it');
  // STO-A11Y-02
  t.check(!/<(span|div|b) class="cv-sec/.test(store) && (store.match(/role="heading" aria-level="2"/g) || []).length >= 39, 'every section label is a level-2 heading');
  t.check(/<div class="cv-h"><b role="heading" aria-level="2">Next job<\/b>/.test(store) && /role="heading" aria-level="1" style="font-size:var\(--t-20\);font-weight:700;letter-spacing:-\.02em">Stock</.test(store) && /<span class="clamp2" role="heading" aria-level="1"/.test(store), 'Today, Stock and "Next job" are headings');
  t.check(!/cvBack\([^)]*\)\}<b>/.test(store) && /function titleHeading\(\)\{/.test(store) && /const PAGE_WORD = \{ scan: 'Scan a label'/.test(store) && /<h1 class="st-sr">/.test(store), 'every page has its title as the h1, or a hidden one');
  t.check(/function syncInert\(\)\{[\s\S]{0,200}main\.inert = kids\.length > 0 \|\| !!S\.sheet;/.test(store) && /syncInert\(\); afterRender\(\);/.test(store), 'what is under a page or a sheet is inert');
  // STO-A11Y-03
  t.check(/position:absolute;right:12px;top:18px;height:32px;padding:0 var\(--s-12\);border-radius:var\(--r-pill\);background:#fff;font-size:var\(--t-12\);font-weight:600;color:var\(--ink2\);display:flex;align-items:center">\$\{k \+ 1\} of \$\{n\}/.test(store), '"1 of 2" sits on a white pill in ink-2');
  // STO-UI-10
  {
    const slip = store.slice(store.indexOf('PAGE.slip = ({ id }) => {'), store.indexOf('PAGE.slip.bg'));
    t.check(/class="st-chiprow" role="group" aria-label="Who takes it" style="display:flex;gap:var\(--s-8\);overflow-x:auto/.test(slip) && /flex:0 0 auto;min-width:76px/.test(slip) && /overflow-y:auto;padding:var\(--s-16\) var\(--s-16\) var\(--s-32\)/.test(slip), 'Hand over: one scrolling picker row; the slip ends 32px clear of the panel');
    const road = store.slice(store.indexOf('PAGE.onroad = () => {'), store.indexOf('PAGE.onroad.bg'));
    // Round 10 (Kevin): one row per stop, the client's name in two lines at most, "Delivered" beside it.
    t.check(!/flex-wrap:wrap/.test(road) && /<span class="cv-tt clamp2"/.test(road) && !/margin-left:52px/.test(road), 'On the road: the order and its button share one row, nothing wraps under it');
  }
  t.done();
})();
