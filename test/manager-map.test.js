#!/usr/bin/env node
'use strict';
/*
 * The Manager's department board -- what the map became (Q26).
 *
 * WAS: a drawing of six areas around the Manager, read from shop_pulse,
 * each area's people and lines hanging off it. NOW: the canvas's board,
 * the whole shop and the six departments (Q2), each a tile with its
 * health as a share of named checks passed (Q1), its lamp, its change
 * over the week once seven daily snapshots exist, and one line -- its
 * first failing check, said with the figure. A tap narrows the
 * decisions, lights the chains and dims the next 30 days.
 *
 * What did NOT change is pinned as it was: the Brief's whole-shop half is
 * drawn only while the Brief is on screen, by the render that is current,
 * and a journal read that fails is named rather than waited on.
 *
 * Run: node test/manager-map.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('manager department board');
const src = read('index.html');
const fn = (n) => extractFunction(src, n, 'index.html');
const decl = (n) => extractDeclaration(src, n, 'index.html');
const esc = (x) => String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const eq = (got, want, msg) => t.check(JSON.stringify(got) === JSON.stringify(want),
  `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);

/* ---------- 1. the tiles, from the health checks ------------------------ */
{
  const s = compileScope([fn('mgrBriefBoard'), fn('mgrBriefLamp'), fn('mgrBriefTrendText'), decl('MGR_DEPTS'), decl('MGR_WHOLE_SHOP')],
    { Number, Math, Object }, ['mgrBriefBoard', 'mgrBriefLamp']);
  /* Finance 3 of 5 checks pass = 60; sales 0 of 3 = 0; people thin (one
     known check). The whole shop: 8 of 20 = 40. */
  const health = { score: 40, known: 20, passed: 8, byDept: {
    finance: { score: 60, known: 5, passed: 3, thin: false, line: '63.41m owed for more than 60 days, by 4 customers' },
    sales: { score: 0, known: 3, passed: 0, thin: false, line: 'Margin 9.1% over 30 days, under your 12% aim' },
    procurement: { score: 75, known: 4, passed: 3, thin: false, line: 'Roofings Ltd holds 32% of your buying' },
    store: { score: 25, known: 4, passed: 1, thin: false, line: '4 lines run out inside 10 days' },
    people: { score: null, known: 1, passed: 1, thin: true, line: 'Not enough on the books to judge' },
    marketing: { score: 100, known: 2, passed: 2, thin: false, line: '2 of 2 checks pass' } } };
  const tiles = s.mgrBriefBoard(health, null, 18, 3);
  eq(tiles.map((x) => x.id), ['all', 'finance', 'sales', 'procurement', 'store', 'people', 'marketing'],
    'seven tiles: the whole shop first, then the six departments in the board\'s order');
  eq(tiles.map((x) => x.score), [40, 60, 0, 75, 25, null, 100], 'each the share of its own checks passed, as counted');
  /* 70 and over well, 40 and over watch, under 40 trouble, thin none. */
  eq(tiles.map((x) => x.lamp), ['warn', 'warn', 'bad', 'good', 'bad', 'none', 'good'], 'the lamp follows the score bands');
  t.check(tiles[0].line === '3 chains behind 18 signals', 'the whole shop counts chains beside signals, and claims nothing more');
  t.check(tiles[5].thin && tiles[5].line === 'Not enough on the books to judge', 'a thin department says so, with no score (Q2)');
  t.check(tiles[1].line === '63.41m owed for more than 60 days, by 4 customers', 'a department\'s line is its first failing check, with its figure');
  t.check(tiles.every((x) => x.trend === null), 'and no change is shown before seven daily snapshots exist');
  const week = s.mgrBriefBoard(health, { change: 3, byDept: { finance: -4, sales: 0, procurement: null } }, 18, 3);
  eq(week.slice(0, 4).map((x) => x.trend), ['+3', '−4', '±0', null], 'once they do, each tile carries its own week\'s change');
  const broke = s.mgrBriefBoard({ error: 'could not be read', byDept: {} }, null, 0, 0);
  t.check(/could not be read/.test(broke[0].line) && broke.slice(1).every((x) => x.score === null && x.line === 'Not read'),
    'a health reading that failed says so on the board rather than scoring anything');
}

/* ---------- 2. when the Brief is drawn ---------------------------------
   The real painter, its timer held so each check can say what was
   queued. Drawn only while the Manager is on screen and the Brief is the
   section open, and only by the render that is still current; opening
   the Brief from the nav draws what a render marked stale. A journal
   read that fails is named in the band and the plan, and the books are
   drawn all the same. */
{
  const el = (id) => ({ id, innerHTML: '', style: {}, classList: { contains: () => false, add() {}, remove() {} },
    querySelector: () => null, querySelectorAll: () => [], addEventListener() {} });
  const els = {};
  ['managerBandWrap', 'managerStripWrap', 'managerDeptWrap', 'managerPlanWrap', 'managerChainWrap', 'managerForesightWrap',
    'managerSimTeaserWrap', 'managerMemoryWrap', 'managerBlindWrap', 'tab-manager'].forEach((id) => { els[id] = el(id); });
  let timers = [], draws = 0;
  const bands = [];
  let S = null;
  const env = {
    document: { getElementById: (id) => els[id] || null },
    setTimeout: (f) => { timers.push(f); return timers.length; },
    mgrRenderGen: 1, mgrView: 'brief',
    mgrBriefDraw: () => { draws++; S.__clean(); },
    mgrBriefPaintBand: () => { bands.push(S.__state().band); }, mgrBriefPaintPlan: () => {},
    mgrPaintVerdict: () => {}, mgrCachePaint: () => false, mgrLastKnown: () => {},
    mgrJournalUnreadHTML: (e) => `<div class="ow-empty">The journal could not be read — ${e}</div>`,
    mgrWirePlan: () => {}, managerMeetingFields: () => ({}), managerMoveFields: () => ({}),
    MANAGER_WORTH_BASES: {}, MANAGER_LEVERS: [],
    managerToday: null, managerMeetingRunning: false, apMode: null, apWasCutOff: false, managerCommittedPlan: null,
    assistantBusy: false, runManagerMeeting() {}, runManagerReview() {}, apOpenPanel() {}, apSend() {}, mgrTrailHTML: () => '',
    lsSet() {}, todayISO: () => '2026-10-07', esc, fmtShortDate: (d) => d,
    mgrBriefPaintThumb() {},
  };
  S = compileScope([fn('mgrPaintBrief'), fn('mgrBriefSoon'), fn('mgrBriefOnScreen'),
    'let mgrMapJournal = null, mgrBriefDirty = true, mgrBriefJournalErr = null, mgrBriefRows = [], mgrBriefPlanArgs = null,'
      + ' mgrBriefBandArgs = {}, mgrBriefCtx = null, mgrBriefTimer = null;',
    'function __state(){ return { mgrBriefDirty, mgrBriefJournalErr, mgrMapJournal, band: mgrBriefBandArgs }; }',
    'function __clean(){ mgrBriefDirty = false; }',
    'function __set(k, v){ if(k === "view") mgrView = v; if(k === "gen") mgrRenderGen = v; }'],
    env, ['mgrPaintBrief', '__state', '__set', '__clean']);
  const run = () => { const q = timers; timers = []; q.forEach((f) => f()); };
  const ok = { today: null, prior: [], reviews: [], weekMeetings: 0 };

  els['tab-manager'].style.display = 'block';
  S.mgrPaintBrief(1, { gen: 1, landed: 'state', st: { error: 'network down' }, notes: true, heldGuess: true });
  run();
  t.check(draws === 1 && S.__state().mgrBriefJournalErr === 'network down',
    'a journal read that fails still draws the Brief from the books, with the failure kept');
  t.check(/could not be read — network down/.test(els.managerPlanWrap.innerHTML) && bands.length && bands[bands.length - 1].unread === 'network down',
    'and the plan and the band both name the failure, rather than the band saying it is still reading');
  S.mgrPaintBrief(1, { gen: 1, landed: 'state', st: ok, notes: true, heldGuess: false });
  run();
  t.check(draws === 2 && S.__state().mgrBriefJournalErr === null && S.__state().mgrMapJournal && S.__state().mgrMapJournal.today === null
    && Object.keys(S.__state().mgrMapJournal).join() === 'today,review,last',
    'the next clean read clears it, draws again, and keeps the journal in the shape the assistant panel reads');

  els['tab-manager'].style.display = 'none';
  S.mgrPaintBrief(1, { gen: 1, landed: 'state', st: ok, notes: true, heldGuess: false });
  run();
  t.check(draws === 2 && S.__state().mgrBriefDirty === true,
    'a render while another screen is showing reads nothing for the Brief — it is only marked stale');
  S.mgrPaintBrief(1, { gen: 1, landed: 'start', notes: false, heldGuess: false });
  run();
  t.check(draws === 2 && S.__state().mgrBriefDirty === true, 'nor on a shop with no journal');
  els['tab-manager'].style.display = 'block';
  S.mgrPaintBrief(1, { gen: 1, landed: 'state', st: ok, notes: true, heldGuess: false });
  run();
  t.check(draws === 3, 'and the render that showing the screen runs draws it');

  S.__set('view', 'targets');
  S.mgrPaintBrief(1, { gen: 1, landed: 'tally', notes: true, heldGuess: false });
  run();
  t.check(draws === 3 && S.__state().mgrBriefDirty === true, 'another section open: marked stale, not drawn');
  S.__set('view', 'brief');
  S.mgrPaintBrief(1, { gen: 1, landed: 'view', notes: true, heldGuess: false });
  t.check(draws === 4 && S.__state().mgrBriefDirty === false, 'opening the Brief from the nav draws it at once');

  S.mgrPaintBrief(1, { gen: 1, landed: 'tally', notes: true, heldGuess: false });
  S.mgrPaintBrief(1, { gen: 1, landed: 'weeks', notes: true, heldGuess: false });
  t.check(timers.length === 1, 'readings that land together are drawn once, not once each');
  S.__set('gen', 2);
  run();
  t.check(draws === 4, 'and a draw queued by a render that has since been replaced is not made');

  /* A SHOP WITH NO JOURNAL keeps today's plan for the session: at most
     eight decisions, as the journal keeps them, each carrying the fields a
     saved move does -- read through the same whitelists (managerMoveFields,
     and managerMeetingFields for the verdict, the sure and the chains). */
  const moves = Array.from({ length: 9 }, (_, i) => ({ title: 'Move ' + (i + 1), why: 'w', worth: 1000 * (i + 1), kind: 'chase',
    worth_basis: i % 2 ? 'profit_30d' : 'cash_freed', lever: 'collect', play: 'p', unlocks: i === 0 ? 'u' : '',
    dept: 'finance', touches: ['sales', 'finance', 'nonsense'], confidence: 4, evidence: ['3 of 4 chases', 'no figure'], mind: 'If not paid by Friday',
    target: 'collections', effect: 5, subject: { customerId: 'C' + i }, ...(i === 2 ? { after: 1 } : {}) }));
  const W = compileScope([fn('mgrPaintBrief'), fn('managerMoveFields'), fn('managerMeetingFields'), fn('managerPips'), fn('managerPlanText'),
    decl('MANAGER_DEPTS'), decl('MANAGER_WORTH_BASES'), decl('MANAGER_LEVERS'),
    'let mgrMapJournal = null, mgrBriefDirty = true, mgrBriefJournalErr = null, mgrBriefRows = [], mgrBriefPlanArgs = null,'
      + ' mgrBriefBandArgs = {}, mgrBriefCtx = null, mgrBriefTimer = null;',
    'function __rows(){ return { rows: mgrBriefRows, plan: mgrBriefPlanArgs, band: mgrBriefBandArgs }; }'],
  { ...Object.fromEntries(Object.entries(env).filter(([k]) => !/^MANAGER_(WORTH_BASES|LEVERS)$|^manager(Move|Meeting)Fields$/.test(k))),
    mgrBriefSoon() {}, MANAGER_METRICS: { collections: {} }, mgrBriefPaintPlan() {},
    managerToday: { date: '2026-10-07', plan: { keyline: 'k', verdict: 'Cash first, then the rest.', sure: 4, moves,
      chains: [{ title: 'A reading', links: [{ text: 'one', figure: '1m', tool: 'shop_pulse' }, { text: 'two', figure: '2 days', tool: 'list_bills' }], fix: { move: 2 } }] } } },
  ['mgrPaintBrief', '__rows']);
  W.mgrPaintBrief(1, { gen: 1, landed: 'start', notes: false, heldGuess: true });
  const got = W.__rows();
  t.check(got.rows.length === 8 && got.rows[0].id === 'mem:0', 'at most eight decisions from the session, as the journal keeps');
  const b0 = got.rows[0].body, b2 = got.rows[2].body;
  t.check(b0.worthBasis === 'cash_freed' && got.rows[1].body.worthBasis === 'profit_30d' && b0.lever === 'collect' && b0.play === 'p' && b0.unlocks === 'u',
    'each carries its kind of money, lever, play and what it unlocks');
  t.check(b0.dept === 'finance' && JSON.stringify(b0.touches) === '["sales"]' && b0.confidence === 4
    && JSON.stringify(b0.evidence) === '["3 of 4 chases"]' && b0.mind === 'If not paid by Friday' && b2.after === 0,
    'and the meeting\'s department, the others it moves, how sure, its evidence with figures and what would change its mind');
  t.check(!('target' in b0 && b0.target.id) && !b0.fromQuestion, 'with no journal to vouch for an id, no pointer is kept');
  t.check(got.plan.plan.verdict === 'Cash first, then the rest.' && got.plan.plan.sure === 4 && got.plan.plan.chains.length === 1
    && got.plan.plan.chains[0].fix.move === 1 && got.band.plan.verdict === 'Cash first, then the rest.',
    'the session\'s verdict, sure and chains read through the meeting\'s whitelist, its fix a position in the plan');
}

/* ---------- 3. in the Brief's department slot, and no longer a map ------ */
{
  t.check(/<div class="mgr-bed mgr-bed-b"[\s\S]*?<div id="managerDeptWrap" class="mgr-slot"><\/div>[\s\S]*?<div class="mgr-bed mgr-bed-x"/.test(src)
    && /function mgrPaintMap\(\)\{\s*const wrap = document\.getElementById\('managerDeptWrap'\);/.test(src),
    'the board is drawn into the Brief\'s department slot');
  const b0 = src.indexOf('/* ═══ MGR BED: Brief — begin ═══ */', src.indexOf('function renderManager('));
  const block = src.slice(b0, src.indexOf('/* ═══ MGR BED: Brief — end ═══ */', b0));
  t.check(b0 > -1 && !/ASSISTANT_TOOLS\.shop_pulse/.test(block) && !/function mgrMapModel\(|function mgrMapHTML\(/.test(src),
    'the map\'s drawing is retired: nothing on the Brief recomputes shop_pulse');
  const reader = fn('mgrBriefRead');
  t.check(/mgrMemo\('brief:' \+ name \+ ':' \+ today, fn\)/.test(reader) && /memo\('alerts', \(\)=>\{\s*const dctx = dashboardContext\(/.test(reader),
    'and the whole-shop reading it does make is kept for a minute or until the books change');
  /* Tap a tile: the decisions narrow, the chains light, the next 30 days
     dim; the same tile, or the whole shop, clears it. */
  const p = compileScope(['let mgrBriefDept = "all";', fn('mgrBriefPickDept'), 'function __d(){ return mgrBriefDept; }'],
    { mgrPaintMap() {}, mgrBriefPaintChains() {}, mgrBriefPaintForesight() {}, mgrBriefPaintPlan() {}, mgrWirePlan() {}, console },
    ['mgrBriefPickDept', '__d']);
  p.mgrBriefPickDept('finance');
  const a = p.__d();
  p.mgrBriefPickDept('finance');
  const b = p.__d();
  p.mgrBriefPickDept('sales'); p.mgrBriefPickDept('all');
  eq([a, b, p.__d()], ['finance', 'all', 'all'], 'a tap narrows to the department; the same tap, or the whole shop, clears it');
  t.check(/mgrBriefDept !== 'all' && x\.dept !== mgrBriefDept/.test(fn('mgrBriefPaintForesight')) && /mgr-b-dim/.test(fn('mgrBriefPaintForesight')),
    'the next 30 days of other departments dim');
  t.check(/mgrBriefDept !== 'all' && d === mgrBriefDept \? ' mgr-b-hl' : ''/.test(fn('mgrBriefPaintChains')), 'the chain cards of the department light');
  t.check(/r\.dept === dept \|\| \(r\.touches \|\| \[\]\)\.includes\(dept\)/.test(fn('mgrBriefDecisionList')),
    'and the decisions narrow to it and to those that move it');
}

process.exit(t.done() ? 1 : 0);
