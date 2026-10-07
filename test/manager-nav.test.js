#!/usr/bin/env node
'use strict';
/*
 * The Manager as seven sections: the nav, the beds, and who paints what.
 *
 * The owner approved a Manager of seven sections -- the canvas's Brief,
 * Simulator, Targets, Playbook, Out of the ordinary and It needs to know,
 * and the Record kept after them (Q26). This file pins the frame they
 * stand in, which every later change to a single section builds on:
 *
 *   THE NAV        Seven entries in the canvas's order, a tablist the
 *                  keyboard can walk, the open one filled; a count on an
 *                  entry only where it counts something, and the line
 *                  under it saying the counts in words. Every figure is
 *                  derived -- nothing on the nav is typed in.
 *
 *   THE BEDS       One painter per section, mgrPaint<Bed>(gen, ctx), and
 *                  it is the ONLY writer of its section's containers.
 *                  Each painter, its count and its CSS (desktop and
 *                  phone) live in blocks of their own between markers,
 *                  so one section can be rebuilt without touching
 *                  another.
 *
 *   THE RENDER     renderManager reads; the painters draw. One ctx per
 *                  render, every reading guarded by the render's ticket,
 *                  every reading painted as it lands.
 *
 * Run: node test/manager-nav.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('manager nav and beds');
const src = read('index.html');
const eq = (a, b, m) => t.check(JSON.stringify(a) === JSON.stringify(b),
  `${m}${JSON.stringify(a) === JSON.stringify(b) ? '' : ` — got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`}`);

const BEDS = ['Brief', 'Sim', 'Targets', 'Plays', 'Unusual', 'Ask', 'Record'];
/* One entry per bed and a line between each, so a bed that gains a wrap
   edits its own entry and never a line another bed's change touches. */
const WRAPS = {
  Brief: ['managerBandWrap', 'managerStripWrap', 'managerDeptWrap', 'managerChainWrap', 'managerPlanWrap',
    'managerForesightWrap', 'managerSimTeaserWrap', 'managerMemoryWrap', 'managerBlindWrap'],

  Sim: ['managerSimWrap'],

  Targets: ['managerTargetsWrap'],

  Plays: ['managerPlaysWrap'],

  Unusual: ['managerUnusualWrap'],

  Ask: ['managerQuestionsWrap'],

  Record: ['managerHistoryWrap', 'managerTrackWrap', 'managerGrowthWrap', 'managerAccountWrap', 'managerPoliciesWrap'],
};
const begin = (b) => `/* ═══ MGR BED: ${b} — begin ═══ */`;
const end = (b) => `/* ═══ MGR BED: ${b} — end ═══ */`;
const all = (hay, needle) => { const out = []; let i = hay.indexOf(needle);
  while (i > -1) { out.push(i); i = hay.indexOf(needle, i + 1); } return out; };

const styleEnd = src.indexOf('\n</style>\n');
const scriptAt = src.indexOf('<script>\n', src.indexOf('sourcing-console.js'));
const css = src.slice(src.indexOf('<style>'), styleEnd);
const js = src.slice(scriptAt, src.indexOf('</script>', scriptAt));

/* ---------- 1. one block per bed, consecutive, right after the render ---------- */
const blockOf = {};
{
  const order = BEDS.map((b) => { const at = all(js, begin(b)); const to = all(js, end(b));
    t.check(at.length === 1 && to.length === 1 && at[0] < to[0], `the ${b} painter block is marked once, begin before end`);
    blockOf[b] = [at[0], to[0] + end(b).length];
    return at[0]; });
  t.check(order.every((v, i) => i === 0 || v > order[i - 1]), 'the seven blocks stand in the nav\'s order');

  const rm = extractFunction(js, 'renderManager', 'index.html');
  const rmEnd = js.indexOf(rm) + rm.length;
  t.check(/^\s*$/.test(js.slice(rmEnd, blockOf.Brief[0])), 'and the first of them starts right after renderManager');

  /* Between two blocks: the same three lines, every time, and nothing
     else -- the seam two people can each work up to without meeting. */
  const seams = BEDS.slice(1).map((b, i) => js.slice(blockOf[BEDS[i]][1], blockOf[b][0]).trim());
  t.check(seams.every((s) => s === seams[0]) && seams[0].split('\n').length === 3 && /^\/\*[\s\S]*\*\/$/.test(seams[0]),
    'the blocks are consecutive, each separated from the next by the same three-line comment');

  BEDS.forEach((b) => {
    const body = js.slice(blockOf[b][0], blockOf[b][1]);
    t.check(new RegExp(`\\nfunction mgrPaint${b}\\(gen, ctx\\)\\{`).test(body), `mgrPaint${b}(gen, ctx) lives in its block`);
    t.check(new RegExp(`\\nfunction mgrNavCount${b}\\(ctx\\)\\{`).test(body), `and so does mgrNavCount${b}(ctx)`);
    t.check(all(js, `function mgrPaint${b}(`).length === 1, `and there is one mgrPaint${b}, not a second somewhere else`);
  });
}

/* ---------- 2. the CSS: seven blocks for the desk, seven for the phone ---------- */
{
  const depthAt = (text, from, to) => { let d = 0; const s = text.slice(from, to).replace(/\/\*[\s\S]*?\*\//g, '');
    for (const c of s) { if (c === '{') d++; else if (c === '}') d--; } return d; };
  const desk = [], phone = [];
  BEDS.forEach((b) => {
    const bs = all(css, begin(b)), es = all(css, end(b));
    t.check(bs.length === 2 && es.length === 2, `${b} has a desktop and a phone CSS block`);
    desk.push(bs[0]); phone.push(bs[1]);
    t.check(bs[0] < es[0] && es[0] < bs[1] && bs[1] < es[1], `and each is closed before the next opens`);
  });
  t.check(desk.every((v, i) => i === 0 || v > desk[i - 1]) && phone.every((v, i) => i === 0 || v > phone[i - 1]),
    'both sets stand in the nav\'s order');
  const mediaBefore = css.lastIndexOf('@media', desk[0]);
  t.check(depthAt(css, mediaBefore, desk[0]) === 0 && depthAt(css, desk[0], all(css, end('Record'))[0]) === 0,
    'the desktop blocks sit outside every @media block, and close every rule they open');
  const media = css.lastIndexOf('@media (max-width:820px){', phone[0]);
  t.check(media > all(css, end('Record'))[0] && depthAt(css, media, phone[0]) === 1
    && depthAt(css, media, all(css, end('Record'))[1]) === 1,
    'and the phone blocks sit inside the phone\'s own @media (max-width:820px) block, every one of them');
}

/* ---------- 3. each painter is the ONLY writer of its bed ----------

   A container written from two places is two opinions about one box.
   Every getElementById of a bed's wrap is either inside that bed's
   block, or inside a helper (the strip's mgrPaintVerdict, the board's
   mgrPaintMap, the levers' mgrPaintLevers, growth's own render) that
   nothing outside the block calls. */
{
  const fnAround = (pos) => { const re = /\n(?:async\s+)?function\s+([A-Za-z0-9_$]+)\s*\(/g; let m, last = null;
    while ((m = re.exec(js)) && m.index < pos) last = m;
    if (!last) return null;
    const body = extractFunction(js.slice(last.index + 1), last[1], 'index.html');
    const at = last.index + 1;
    return pos < at + body.length ? { name: last[1], at, end: at + body.length } : null; };
  BEDS.forEach((b) => {
    const [lo, hi] = blockOf[b];
    const inBlock = (p) => p > lo && p < hi;
    WRAPS[b].forEach((id) => {
      const uses = all(js, `getElementById('${id}')`);
      const stray = [];
      uses.filter((p) => !inBlock(p)).forEach((p) => {
        const f = fnAround(p);
        if (!f) { stray.push('top level'); return; }
        const calls = [...js.matchAll(new RegExp(`\\b${f.name}\\(`, 'g'))].map((m) => m.index)
          .filter((c) => !(c >= f.at && c < f.end) && !/function\s+$/.test(js.slice(Math.max(0, c - 12), c)));
        if (!calls.length || calls.some((c) => !inBlock(c))) stray.push(f.name);
      });
      t.check(uses.length > 0 && stray.length === 0,
        `${id} is written by the ${b} painter alone${stray.length ? ' — also from ' + stray.join(', ') : ''}`);
    });
  });
}

/* ---------- 3b. what one bed draws with lives in that bed's block ----------

   A bed's helpers outside its block are lines another bed's change can
   land beside, and two edits on touching lines are a merge conflict
   even when they mean nothing to each other. So from the screen's first
   shared helper to the end of the beds, the only code outside a block
   is the frame every bed shares, named here. A new helper for one bed
   goes in that bed's block; a new shared one is added to this list on
   purpose, not by accident. */
{
  const from = js.indexOf('\nfunction mgrMoveOrder(rows){');
  const to = js.indexOf(end('Record')) + end('Record').length;
  const SHARED = ['mgrMoveOrder', 'mgrView', 'mgrRenderGen', 'mgrPaceGen', 'MANAGER_KIND_CHIPS', 'MGR_TREND_WEEKS',
    'managerAdviceWeeks', 'mgrShortUGX', 'MGR_VIEWS', 'mgrNavCtx', 'mgrPaintSwitch', 'mgrNum', 'MGR_JR_STOP', 'mgrJrWords',
    'MGR_CACHED_WRAPS', 'mgrCacheKey', 'mgrCacheSave', 'mgrCachePaint', 'window.addEventListener', 'mgrLastKnown',
    'mgrNeedsMemoryHTML', 'mgrJournalUnreadHTML', 'renderManager'];
  const inBlock = (p) => BEDS.some((b) => p > blockOf[b][0] && p < blockOf[b][1]);
  const outside = [...js.slice(from, to).matchAll(
    /\n(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(|\n(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=|\n(document|window)\.addEventListener\(/g)]
    .filter((m) => !inBlock(from + m.index)).map((m) => m[1] || m[2] || m[3] + '.addEventListener');
  const stray = outside.filter((n) => !SHARED.includes(n));
  t.check(from > -1 && outside.length > 0 && stray.length === 0,
    `outside the blocks there is only the shared frame${stray.length ? ' — also: ' + stray.join(', ') : ''}`);
  /* And each helper a block holds is called from that block alone, so
     moving it in did not leave a caller outside. */
  ['mgrPaintMap', 'mgrPaintVerdict', 'mgrHeroHTML', 'mgrProposalHTML', 'mgrPaceHTML', 'mgrAsksHTML', 'mgrWireAsks',
    'mgrPlayWorth', 'mgrUnusualHTML', 'mgrJournalChartHTML', 'mgrPaintLevers', 'mgrPaintAcctAdvice', 'mgrMoveView']
    .forEach((n) => {
      const def = js.indexOf(`\nfunction ${n}(`);
      const owner = BEDS.find((b) => def > blockOf[b][0] && def < blockOf[b][1]);
      const calls = [...js.matchAll(new RegExp(`[^\\w$.]${n}\\(`, 'g'))].map((m) => m.index).filter((p) => p !== def);
      t.check(owner && calls.length && calls.every((p) => p > blockOf[owner][0] && p < blockOf[owner][1]),
        `${n} lives in the ${owner || '(no)'} block and is called from there alone`);
    });
}

/* ---------- 4. the render: one ctx, every reading guarded and painted ---------- */
{
  const rm = extractFunction(src, 'renderManager', 'index.html');
  t.check(/const ctx = \{ gen, landed: 'start', notes: !!managerNotesTable, heldGuess \};/.test(rm),
    'one ctx per render, carrying its ticket');
  t.check(/MGR_VIEWS\.forEach\(v=>\{\s*try\{ v\.paint\(gen, ctx\); \}/.test(rm) && /mgrPaintSwitch\(ctx\);/.test(rm),
    'every bed is painted from it, then the nav with the counts it now has');
  const start = rm.indexOf("paint('start');");
  [['managerLoadState().then', 'state', 'ctx.st = st;'], ['managerAdviceTally(todayISO()).then', 'tally', 'ctx.tally = tally;'],
   ['managerTrackRecord(todayISO()).then', 'track', 'ctx.track = track;'], ['managerAdviceWeeks(todayISO()).then', 'weeks', 'ctx.weeks = weeks;'],
   ['managerPlaybook().then', 'book', 'ctx.book = book;'], ['managerOpenAskCount().then', 'asks', 'ctx.openAsks = n;']].forEach(([open, landed, put]) => {
    const at = rm.indexOf(open);
    const body = at > -1 ? rm.slice(at, rm.indexOf('});', at)) : '';
    t.check(at > start && start > -1, `${open} goes out after the start paint`);
    t.check(/^[\s\S]{0,140}?if\(gen !== mgrRenderGen/.test(body) && body.includes(put) && body.includes(`paint('${landed}');`),
      `and lands on ctx and is painted as '${landed}' only while its render is current`);
  });
  t.check(!/\bawait\b/.test(rm) && !/^async /.test(rm), 'renderManager waits on nothing itself — every reading paints when it lands');
  t.check(rm.indexOf("if(!managerNotesTable) return;") > start && rm.indexOf("if(!managerNotesTable) return;") < rm.indexOf('managerLoadState().then'),
    'and a shop with no journal sends no journal reading at all');
  /* The ctx is documented where it is made: each field a painter may read. */
  const doc = src.slice(src.lastIndexOf('/* ==== THE RENDER, AND THE CONTEXT IT HANDS THE BEDS', src.indexOf('function renderManager(){')),
    src.indexOf('function renderManager(){'));
  ['gen', 'landed', 'notes', 'heldGuess', 'st', 'score', 'tally', 'track', 'weeks', 'book', 'openAsks'].forEach((f) =>
    t.check(new RegExp(`\\n\\s+${f}\\s{2,}`).test(doc), `ctx.${f} is documented above renderManager`));
  ["'start'", "'state'", "'tally'", "'track'", "'weeks'", "'book'", "'asks'", "'view'"].forEach((l) =>
    t.check(doc.includes(l), `and so is the landing ${l}`));
}

/* ---------- 5. the nav: seven sections, keyboard, one class ---------- */
{
  const views = extractDeclaration(src, 'MGR_VIEWS', 'index.html');
  const vs = [...views.matchAll(/\{ view: '([a-z]+)', label: '([^']+)', bed: '([A-Za-z]+)', paint: (\w+), count: (\w+) \}/g)];
  eq(vs.map((m) => m[1]), ['brief', 'sim', 'targets', 'plays', 'unusual', 'ask', 'record'], 'seven views, in the canvas\'s order');
  eq(vs.map((m) => m[2]), ['Brief', 'Simulator', 'Targets', 'Playbook', 'Out of the ordinary', 'It needs to know', 'Record'],
    'named as the canvas names them, the record after them');
  eq(vs.map((m) => m[4]), BEDS.map((b) => 'mgrPaint' + b), 'each with its own painter');
  eq(vs.map((m) => m[5]), BEDS.map((b) => 'mgrNavCount' + b), 'and its own count');
  vs.forEach((m) => t.check(new RegExp(`<div class="mgr-bed mgr-bed-[a-z]" id="${m[3]}" role="tabpanel" aria-label="${m[2]}">`).test(src),
    `the ${m[2]} bed is a labelled tabpanel the nav controls (#${m[3]})`));
  t.check(/\nlet mgrView = 'brief';/.test(src), 'the screen opens on the brief');
  t.check(!/(lsSet|localStorage\.setItem)\([^)]*mgrView/.test(src), 'and which section was open is not remembered between visits');

  /* Painted, not read for shape. */
  const toggles = {};
  const el = { innerHTML: '', querySelector: () => null, querySelectorAll: () => [] };
  const doc = { activeElement: null, getElementById: (id) => id === 'managerViewWrap' ? el
    : id === 'tab-manager' ? { classList: { toggle: (c, on) => { toggles[c] = on; } } } : null };
  const esc = (v) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const env = { document: doc, esc, console, String };
  BEDS.forEach((b) => { env['mgrPaint' + b] = () => {}; env['mgrNavCount' + b] = (c) => (c.counts || {})[b] || null; });
  const nav = compileScope([views, extractFunction(src, 'mgrPaintSwitch', 'index.html'),
    'let mgrView = \'brief\'; let mgrNavCtx = null; function setView(v){ mgrView = v; } function getView(){ return mgrView; }'],
  env, ['mgrPaintSwitch', 'setView', 'getView']);

  nav.mgrPaintSwitch({ counts: { Targets: { n: 3, note: '<b>1 target</b> off track' }, Plays: { n: 5, note: null },
    Ask: { n: 4, note: '<b>4 questions</b> only you can find out' }, Record: { n: 10, note: null } } });
  const html = el.innerHTML;
  eq((html.match(/<button type="button" role="tab" class="mgr-nav-b"/g) || []).length, 7, 'seven tabs in one tablist');
  t.check(/class="mgr-nav" role="tablist" aria-label="The Manager"/.test(html), 'the list is named');
  eq([...html.matchAll(/data-mgrview="([a-z]+)"/g)].map((m) => m[1]), ['brief', 'sim', 'targets', 'plays', 'unusual', 'ask', 'record'],
    'every tab carries the view it opens');
  eq((html.match(/aria-selected="true"/g) || []).length, 1, 'exactly one is open');
  t.check(/data-mgrview="brief"\s+aria-selected="true" aria-controls="mgrBedBrief" tabindex="0"/.test(html)
    && (html.match(/tabindex="-1"/g) || []).length === 6, 'the brief, and only the open tab sits in the tab order');
  eq([...html.matchAll(/<span class="mgr-nav-n">([^<]+)<\/span>/g)].map((m) => m[1]), ['3', '5', '4', '10'],
    'a chip only where a count was given, the figure as counted');
  t.check(/<p class="mgr-nav-sum"><b>1 target<\/b> off track &middot; <b>4 questions<\/b> only you can find out<\/p>/.test(html),
    'and the line under it joins what the counts say, in order');
  eq(Object.keys(toggles).filter((k) => toggles[k]), ['mgr-on-brief'], 'one class on the section shows the open bed');
  eq(Object.keys(toggles).length, 7, 'and the other six are taken off');

  nav.setView('standing');
  nav.mgrPaintSwitch({ counts: {} });
  t.check(nav.getView() === 'brief' && !/mgr-nav-sum/.test(el.innerHTML) && !/mgr-nav-n/.test(el.innerHTML),
    'a view that no longer exists opens the brief; with nothing counted there are no chips and no line');
  nav.setView('record');
  nav.mgrPaintSwitch();
  t.check(/data-mgrview="record"\s+aria-selected="true"/.test(el.innerHTML) && toggles['mgr-on-record'] === true && toggles['mgr-on-brief'] === false,
    'repainted without a ctx, it keeps the last one and moves the class with the view');

  const sw = extractFunction(src, 'mgrPaintSwitch', 'index.html');
  t.check(/'ArrowRight'/.test(sw) && /'ArrowLeft'/.test(sw) && /'Home'/.test(sw) && /'End'/.test(sw) && /e\.preventDefault\(\);\s*open\(MGR_VIEWS\[j\]\.view, true\);/.test(sw),
    'the arrow keys walk the sections and open them, Home and End jump to the ends');
  t.check(/mgrNavCtx\.landed = 'view';/.test(sw), 'opening a section hands its bed a \'view\' paint');
  t.check(/f\.focus\(\{ preventScroll: true \}\)/.test(sw) && /nav\.scrollLeft = scrollX;/.test(sw),
    'and a repaint puts back the keyboard\'s focus and the row\'s sideways scroll');
}

/* ---------- 6. every count is derived: hand-worked ---------- */
{
  const esc = (v) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  let reading = null;
  const answers = new Map();
  const C = compileScope(BEDS.map((b) => extractFunction(src, 'mgrNavCount' + b, 'index.html'))
    .concat([extractFunction(src, 'mgrUnusualKey', 'index.html')]), {
    esc, Number, mgrUnusualReading: () => reading, mgrUnusualAnswers: answers,
  }, BEDS.map((b) => 'mgrNavCount' + b));

  eq(C.mgrNavCountBrief({}), null, 'the brief counts nothing — it is the brief, not a queue');
  eq(C.mgrNavCountSim({}), null, 'nor does the simulator');

  eq(C.mgrNavCountTargets({}), null, 'targets: nothing until the journal answers');
  eq(C.mgrNavCountTargets({ score: { error: 'down' } }), null, 'and nothing — not a zero — when it could not be read');
  const score = { targets: [
    { finished: false, pace: { on_course: false } },   // running, behind
    { finished: false, pace: { on_course: true } },    // running, on course
    { finished: true, met: true }, { finished: true, met: false } ], proposed: [{ id: 1 }, { id: 2 }] };
  eq(C.mgrNavCountTargets({ score }), { n: 4, note: '<b>1 target</b> off track' },
    'targets: 2 running + 2 proposed = 4, and the 1 running behind its pace is off track');
  score.targets[1].pace.on_course = false;
  eq(C.mgrNavCountTargets({ score }).note, '<b>2 targets</b> off track', 'two behind are two targets');
  eq(C.mgrNavCountTargets({ score: { targets: [{ finished: false }], proposed: [] } }), { n: 1, note: null },
    'a running target with no pace yet is not called off track');

  eq(C.mgrNavCountPlays({ book: { error: 'down', running: [], proposed: [] } }), null, 'plays: nothing when the playbook could not be read');
  const book = { running: [
    { name: 'Friday chase', clock: { past: true, noSpan: false, daysLeft: 0 } },
    { name: 'Steel to the rival', clock: { past: false, noSpan: false, daysLeft: 3 } } ], proposed: [{}, {}, {}] };
  eq(C.mgrNavCountPlays({ book }), { n: 5, note: '<b>1 play</b> past its span' },
    'plays: 2 running + 3 proposed = 5, and one past its span is named before anything else');
  book.running[0].clock.past = false; book.running[0].clock.daysLeft = 9;
  eq(C.mgrNavCountPlays({ book }).note, '<b>Steel to the rival</b> is due for your verdict in 3 days',
    'otherwise the one whose span ends soonest within the week is due for the owner\'s verdict');
  book.running[1].clock.daysLeft = 1;
  eq(C.mgrNavCountPlays({ book }).note, '<b>Steel to the rival</b> is due for your verdict in 1 day', 'one day is a day');
  book.running[1].clock.daysLeft = 0;
  eq(C.mgrNavCountPlays({ book }).note, '<b>Steel to the rival</b> is due for your verdict today', 'and none left is today');
  eq(C.mgrNavCountPlays({ book: { running: [{ name: 'x', clock: { noSpan: true, past: false, daysLeft: null } }], proposed: [] } }),
    { n: 1, note: null }, 'a play with no span named is never "due"');
  eq(C.mgrNavCountPlays({ book: { running: [{ name: 'a <b>', clock: { past: false, noSpan: false, daysLeft: 2 } }], proposed: [] } }).note,
    '<b>a &lt;b&gt;</b> is due for your verdict in 2 days', 'and a play\'s name is escaped');

  reading = { judged: false, items: [] };
  eq(C.mgrNavCountUnusual({}), null, 'unusual: nothing while the books are too new to know a usual day');
  reading = { judged: true, items: [{ date: '2026-10-03', metric: 'sales' }, { date: '2026-10-02', metric: 'cash_out' },
    { date: '2026-10-03', metric: 'stock_short' }] };
  answers.set('2026-10-03|sales', 'A big order came in');
  eq(C.mgrNavCountUnusual({}), { n: 3, note: '<b>2 unusual things</b> need your answer' },
    'unusual: 3 found in the window, 2 still without the owner\'s word');
  answers.set('2026-10-02|cash_out', 'Paid a supplier');
  eq(C.mgrNavCountUnusual({}).note, '<b>1 unusual thing</b> needs your answer', 'one is one thing');
  answers.set('2026-10-03|stock_short', 'Counted wrong');
  eq(C.mgrNavCountUnusual({}), { n: 3, note: null }, 'all answered: still three found, nothing asked');

  eq(C.mgrNavCountAsk({}), null, 'asks: nothing until counted');
  eq(C.mgrNavCountAsk({ openAsks: null }), null, 'and nothing — not a zero — when the count could not be read');
  eq(C.mgrNavCountAsk({ openAsks: 0 }), { n: 0, note: null }, 'none open is a counted zero');
  eq(C.mgrNavCountAsk({ openAsks: 11 }), { n: 11, note: '<b>11 questions</b> only you can find out' }, 'eleven open');
  eq(C.mgrNavCountAsk({ openAsks: 1 }).note, '<b>1 question</b> only you can find out', 'one is one question');

  eq(C.mgrNavCountRecord({}), null, 'record: nothing until the journal answers');
  eq(C.mgrNavCountRecord({ st: { error: 'down' } }), null, 'nor when it could not be read');
  eq(C.mgrNavCountRecord({ st: { today: { meeting: {} }, prior: [1, 2, 3, 4, 5], reviews: [1, 2, 3, 4] } }), { n: 10, note: null },
    'record: today\'s meeting + 5 before it + 4 reviews = 10 entries on the journal');
  eq(C.mgrNavCountRecord({ st: { today: null, prior: [1], reviews: [] } }).n, 1, 'and a day with no meeting yet does not count one');
}

/* ---------- 7. the open questions, counted rather than read ---------- */
{
  /* NAMED RATHER THAN DROPPED. The journal reading brings the newest few
     questions; when more are open than it brought, the section says how
     many it is not showing -- and only then. */
  const ask = extractFunction(src, 'mgrPaintAsk', 'index.html');
  t.check(/const more = ctx\.openAsks != null && ctx\.openAsks > shown;\s*p\.hidden = !more;/.test(ask)
    && /`Showing the newest \$\{shown\} of \$\{ctx\.openAsks\} open questions\.`/.test(ask),
    'when more questions are open than are shown, It needs to know says how many it is not showing');
  t.check(/if\(ctx\.landed === 'asks'\)\{ if\(ctx\.st && !ctx\.st\.error\) cut\(\); return; \}/.test(ask),
    'and a count landing after the questions only updates that line — it never repaints what the owner is typing');
}
(async () => {
  const mk = (answer, notes = true) => {
    const seen = [];
    const q = { select: (c, o) => { seen.push(['select', c, o]); return q; }, eq: (k, v) => { seen.push([k, v]); return q; },
      then: (ok, bad) => (answer instanceof Error ? Promise.reject(answer) : Promise.resolve(answer)).then(ok, bad) };
    const f = compileScope([extractFunction(src, 'managerOpenAskCount', 'index.html')], {
      managerNotesTable: notes, currentShopId: 'S1', Number,
      sb: { from: (tb) => { seen.push(['from', tb]); return q; } },
    }, ['managerOpenAskCount']).managerOpenAskCount;
    return { f, seen };
  };
  let r = mk({ data: null, count: 11, error: null });
  eq(await r.f(), 11, 'eleven open questions are counted as eleven');
  eq(r.seen, [['from', 'manager_notes'], ['select', 'id', { count: 'exact', head: true }], ['shop_id', 'S1'], ['kind', 'question'], ['status', 'open']],
    'by an exact head count on this shop\'s open questions — the rows themselves are not fetched');
  eq(await mk({ data: null, count: null, error: { message: 'down' } }).f(), null, 'a refused count is null, never a zero');
  eq(await mk(new Error('offline')).f(), null, 'and so is one that threw');
  eq(await mk({ data: null, count: 0, error: null }).f(), 0, 'none open is a counted zero');
  r = mk({ data: null, count: 5, error: null }, false);
  eq(await r.f(), null, 'a shop with no journal is not asked at all');
  eq(r.seen.length, 0, 'not even once');
})().then(() => {
  process.exit(t.done() ? 1 : 0);
}).catch((e) => {
  console.error(e);
  process.exit(1);
});
