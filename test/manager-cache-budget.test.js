#!/usr/bin/env node
'use strict';
/*
 * THE MANAGER'S LAST-KNOWN COPIES HAVE A TOTAL BUDGET.
 *
 * Every box on the Manager screen that waits on the journal keeps its
 * last good render in localStorage ('ow-mgr-last:<shop>:<box>'), so the
 * owner reads figures at once. Sixteen boxes, for every shop opened on
 * the device, share that storage with the offline queue -- and a full
 * quota there is a sale that cannot be kept offline. Each box had a
 * 200,000-character cap and the whole had none.
 *
 * Now all copies together stay under a budget (400,000 characters by
 * default). When they would not, the OLDEST copies go first and, among
 * copies of the same age, the LARGEST. Nothing else in localStorage is
 * touched.
 *
 * Run: node test/manager-cache-budget.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('manager cache budget');
const src = read('index.html');
const eq = (got, want, msg) => t.check(JSON.stringify(got) === JSON.stringify(want),
  `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);

/* A localStorage that keeps insertion order, as browsers do for key(i). */
function store(init) {
  const m = new Map(Object.entries(init || {}));
  return {
    m,
    get length() { return m.size; },
    key: (i) => [...m.keys()][i] ?? null,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
  };
}
function el(id, html, opts) {
  const o = opts || {};
  return { id, innerHTML: html, classList: { contains: (c) => !!(o.stale && c === 'mgr-stale') },
    querySelector: (q) => (o.reading && q === '.mgr-reading' ? {} : null) };
}
function build(ls, els) {
  return compileScope([
    extractDeclaration(src, 'MGR_CACHED_WRAPS', 'index.html'),
    extractFunction(src, 'mgrCacheKey', 'index.html'),
    extractFunction(src, 'mgrCacheSave', 'index.html'),
  ], {
    currentShopId: 'S1', localStorage: ls,
    document: { getElementById: (id) => els[id] || null },
  }, ['mgrCacheSave']);
}
const copy = (at, n) => JSON.stringify({ at, html: 'x'.repeat(n) });
const K = (shop, id) => 'ow-mgr-last:' + shop + ':' + id;

/* ---------- 1. under the budget, everything is kept ----------------- */
{
  const ls = store({ 'ow-queue': 'q'.repeat(50), [K('S2', 'managerPlanWrap')]: copy('2026-10-01T08:00:00.000Z', 100) });
  const s = build(ls, { managerPlanWrap: el('managerPlanWrap', 'p'.repeat(100)), managerTrackWrap: el('managerTrackWrap', 't'.repeat(100)) });
  s.mgrCacheSave();
  t.check(ls.m.has(K('S1', 'managerPlanWrap')) && ls.m.has(K('S1', 'managerTrackWrap')), 'both of this shop\'s boxes are kept');
  t.check(ls.m.has(K('S2', 'managerPlanWrap')), 'another shop\'s copy is kept while the whole fits');
  eq(ls.m.get('ow-queue'), 'q'.repeat(50), 'and the offline queue is never touched');
}

/* ---------- 2. over the budget: oldest first, then largest ------------ */
{
  /* Sizes are key + value. Three old copies already stored:
       S2 plan, 1 October, value 1,000 chars of html
       S2 track, 3 October, 1,000
       S1 account, 2 October, 500 (not drawn this time: kept from before)
     and two fresh ones drawn now, 600 and 300 chars of html.
     Budget = the two fresh + S2 track + a little: the 1 October copy
     goes first, then the 2 October one; the 3 October one stays. */
  const old1 = copy('2026-10-01T08:00:00.000Z', 1000);
  const old2 = copy('2026-10-02T08:00:00.000Z', 500);
  const old3 = copy('2026-10-03T08:00:00.000Z', 1000);
  const ls = store({ [K('S2', 'managerPlanWrap')]: old1, [K('S1', 'managerAccountWrap')]: old2, [K('S2', 'managerTrackWrap')]: old3,
    'ow-queue': 'q'.repeat(5000) });
  const els = { managerPlanWrap: el('managerPlanWrap', 'p'.repeat(600)), managerTrackWrap: el('managerTrackWrap', 't'.repeat(300)) };
  const s = build(ls, els);
  const freshSize = (id, n) => K('S1', id).length + JSON.stringify({ at: new Date().toISOString(), html: 'x'.repeat(n) }).length;
  const keep = freshSize('managerPlanWrap', 600) + freshSize('managerTrackWrap', 300) + K('S2', 'managerTrackWrap').length + old3.length;
  s.mgrCacheSave(keep + 10);
  eq([K('S2', 'managerPlanWrap'), K('S1', 'managerAccountWrap')].map((k) => ls.m.has(k)), [false, false],
    'the 1 October copy goes, then the 2 October one');
  eq([K('S2', 'managerTrackWrap'), K('S1', 'managerPlanWrap'), K('S1', 'managerTrackWrap')].map((k) => ls.m.has(k)), [true, true, true],
    'the 3 October copy and both fresh ones stay');
  const total = [...ls.m].filter(([k]) => k.startsWith('ow-mgr-last:')).reduce((n, [k, v]) => n + k.length + v.length, 0);
  t.check(total <= keep + 10, 'and the copies together are inside the budget (' + total + ' <= ' + (keep + 10) + ')');
  eq(ls.m.get('ow-queue').length, 5000, 'the queue\'s room is not what is cut');
}

/* ---------- 3. fresh copies alone too large: the largest is not kept -- */
{
  /* Nothing older to give up. The two fresh copies are the same age, so
     the larger (the 900-char plan) is the one left out -- and an old
     copy of that box is removed rather than left standing for a box
     that was redrawn since. */
  const ls = store({ [K('S1', 'managerPlanWrap')]: copy('2026-09-01T08:00:00.000Z', 50) });
  const els = { managerPlanWrap: el('managerPlanWrap', 'p'.repeat(900)), managerTrackWrap: el('managerTrackWrap', 't'.repeat(200)) };
  build(ls, els).mgrCacheSave(600);
  eq([ls.m.has(K('S1', 'managerPlanWrap')), ls.m.has(K('S1', 'managerTrackWrap'))], [false, true],
    'the larger fresh copy is left out (its old copy with it); the smaller is kept');
}

/* ---------- 4. what is never cached --------------------------------- */
{
  const ls = store();
  build(ls, {
    managerPlanWrap: el('managerPlanWrap', 'p'.repeat(100), { stale: true }),
    managerTrackWrap: el('managerTrackWrap', '<p class="mgr-reading">Reading…</p>', { reading: true }),
    managerHistoryWrap: el('managerHistoryWrap', '   '),
    managerAccountWrap: el('managerAccountWrap', 'a'.repeat(200001)),
  }).mgrCacheSave();
  eq(ls.m.size, 0, 'a box showing a last-known copy, one still reading, an empty one and one over 200,000 characters are not kept');
}

/* ---------- 5. storage that refuses ---------------------------------- */
{
  const ls = store();
  ls.setItem = () => { throw new Error('QuotaExceededError'); };
  let threw = false;
  try { build(ls, { managerPlanWrap: el('managerPlanWrap', 'p'.repeat(100)) }).mgrCacheSave(); } catch (e) { threw = true; }
  t.check(!threw, 'a full or blocked localStorage costs the copy, never the screen');
}

/* ---------- 6. the default budget ------------------------------------ */
{
  const fn = extractFunction(src, 'mgrCacheSave', 'index.html');
  t.check(/Number\(budget\) > 0 \? Number\(budget\) : 400000/.test(fn), 'the budget is 400,000 characters unless told otherwise');
  t.check(/startsWith\(prefix\)/.test(fn) && /const prefix = 'ow-mgr-last:'/.test(fn), 'and it counts only the Manager\'s own copies');
}

process.exit(t.done() ? 1 : 0);
