#!/usr/bin/env node
'use strict';
/*
 * The Manager's two pictures: an eight-week trend beside two of the
 * verdict figures, and a pace chart in place of a running target's bar.
 *
 * Pinned: what each draws from, that a week with nothing advised is a
 * gap and not a zero, that a LEVEL target draws no path the books do
 * not hold, that "at this rate" never goes below nothing, and that the
 * figures it shows are the ones the text under it already says.
 *
 * Run: node test/manager-charts.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('manager charts');
const src = read('index.html');
const TODAY = '2026-09-24';
const day = (n) => new Date(Date.parse(TODAY) + n * 86400000).toISOString().slice(0, 10);
const esc = (x) => String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fmtUGX = (n) => Number(n).toLocaleString('en-US') + ' UGX';

/* ---------- 1. the weekly reading ------------------------------------- */
(async () => {
  {
    const rows = [
      { date: day(0), status: 'done', body: { title: 'a', mkind: 'chase', subject: { customerId: 1 } } },
      { date: day(-1), status: 'open', body: { title: 'b', mkind: 'other' } },
      { date: day(-9), status: 'done', body: { title: 'c', mkind: 'buy', subject: { key: 'P1' } } },
      { date: day(-9), status: 'skipped', body: { title: '' } },          // untitled: not advice
      { date: day(-80), status: 'done', body: { title: 'old' } },         // outside the eight weeks
    ];
    const { managerAdviceWeeks } = compileScope([
      extractFunction(src, 'managerAdviceWeeks', 'index.html'),
      extractFunction(src, 'anShiftDate', 'index.html'),
      extractDeclaration(src, 'MGR_TREND_WEEKS', 'index.html'),
      extractDeclaration(src, 'TRACK_WINDOWED', 'index.html'),
      extractDeclaration(src, 'TRACK_MOVES_READ', 'index.html'),
    ], {
      managerNotesTable: true, currentShopId: 'S', todayISO: () => TODAY,
      deriveMoveOutcome: (row) => ({ happened: row.body.mkind === 'chase' }),
      sb: { from: () => { const q = { select: () => q, eq: () => q, gte: () => q, order: () => q,
        limit: () => Promise.resolve({ data: rows, error: null }) }; return q; } },
      Date, String, Number, Math,
    }, ['managerAdviceWeeks']);
    const w = (await managerAdviceWeeks(TODAY)).weeks;
    t.check(w.length === 8 && w[7].current && w[7].to === TODAY, 'eight weeks, the last ending today and marked as still running');
    t.check(w[7].proposed === 2 && w[7].done === 1, 'this week: two advised, one done (got ' + w[7].proposed + '/' + w[7].done + ')');
    t.check(w[7].scored === 1 && w[7].followed === 1, 'and only the kinds with a dated answer are weighed for what followed');
    t.check(w[6].proposed === 1 && w[6].scored === 1 && w[6].followed === 0, 'last week: the untitled row is not advice');
    t.check(w.reduce((n, x) => n + x.proposed, 0) === 3, 'and nothing older than eight weeks is counted');
  }

  /* ---------- 2. the sparkline ----------------------------------------- */
  {
    const { mgrSparkHTML } = compileScope([extractFunction(src, 'mgrSparkHTML', 'index.html')],
      { esc, fmtShortDate: (d) => d.slice(5), Math }, ['mgrSparkHTML']);
    const weeks = Array.from({ length: 8 }, (_, i) => ({ from: day(-7 * (7 - i) - 6), current: i === 7,
      proposed: i === 2 ? 0 : 4, done: i === 2 ? 0 : i % 4 }));
    const svg = mgrSparkHTML(weeks, 'done', 'proposed', 'done');
    t.check((svg.match(/mgr-spark-track/g) || []).length === 7 && (svg.match(/mgr-spark-gap/g) || []).length === 1,
      'one column per week: a full-height track for each week with advice, a baseline tick for the one without');
    const zero = svg.split('<g>').find((g) => /Week of [\d-]+: 0 of 4 done/.test(g)) || '';
    t.check(/mgr-spark-track/.test(zero) && !/mgr-spark-bar|mgr-spark-now/.test(zero),
      'a week where nothing advised was done is an EMPTY track — not the same mark as a week with nothing advised');
    t.check(/class="mgr-spark-gap"><title>Week of [\d-]+: nothing advised<\/title>/.test(svg),
      'a week with nothing advised is a gap that says so, not a zero');
    t.check((svg.match(/mgr-spark-now/g) || []).length === 1 && /This week so far: 3 of 4 done/.test(svg),
      'the running week is drawn apart and called "so far"');
    t.check(/aria-label="Last 8 weeks, done: /.test(svg), 'and the whole trend is read out for a screen reader');
    t.check(mgrSparkHTML(weeks.map((x) => ({ ...x, proposed: 0 })), 'done', 'proposed', 'done') === '',
      'eight empty weeks draw nothing at all');
  }

  /* ---------- 3. the pace chart ---------------------------------------- */
  const paceScope = (metrics) => compileScope([
    extractFunction(src, 'managerTargetSeries', 'index.html'),
    extractFunction(src, 'mgrPaceHTML', 'index.html'),
    extractFunction(src, 'anShiftDate', 'index.html'),
  ], { MANAGER_METRICS: metrics, esc, fmtUGX, Math, Number, String, Date }, ['managerTargetSeries', 'mgrPaceHTML']);
  {
    const perDay = { [day(-2)]: 1000, [day(-1)]: 2000, [day(0)]: 500 };
    const s = paceScope({ sales: { kind: 'flow', direction: 'up', measure: (a) => perDay[a] || 0 } });
    const x = { metric: 'sales', label: 'Sales', from: day(-2), to: day(4), aim: 7000, baseline: 0, actual: 3500,
      pace: { elapsed_days: 3, total_days: 7, expected: 3000, on_course: true, at_this_rate: 8167 } };
    const ser = s.managerTargetSeries(x);
    t.check(ser.pts.map((p) => p.v).join(',') === '1000,3000,3500', 'a flow is drawn from each day\'s own figure, summed');
    t.check(ser.expectedOn(2) === 3000, 'and the road at the end of day three is where the text says on course would be');
    const html = s.mgrPaceHTML(x);
    t.check(/<polyline class="mgr-pc-act"/.test(html) && /mgr-pc-now mgr-pc-good/.test(html),
      'the path is drawn, and today\'s point carries the state');
    t.check(/aria-label="Sales: 3,500 UGX of 7,000 UGX, day 3 of 7\. On course would be 3,000 UGX; at this rate it ends at 8,167 UGX\."/.test(html),
      'and the chart says in words what it shows');
  }
  {
    const s = paceScope({ debtors_total: { kind: 'level', direction: 'down', measure: () => { throw new Error('a level has no daily reading'); } } });
    const x = { metric: 'debtors_total', label: 'Money owed to you', from: day(-3), to: day(3), aim: 100000, baseline: 900000, actual: 250000,
      pace: { elapsed_days: 4, total_days: 7, expected: 442857, on_course: true, at_this_rate: -237500 } };
    const ser = s.managerTargetSeries(x);
    t.check(ser.pts.length === 2 && ser.pts[0].v === 900000 && ser.pts[1].v === 250000,
      'a level has two points, where it started and where it is — never measured for days the books did not keep');
    const html = s.mgrPaceHTML(x);
    t.check(!/mgr-pc-act/.test(html), 'and no line between them: a line there would invent the path');
    t.check(ser.projected === 0, '"at this rate" stops at nothing: money owed cannot go below it');
  }
  {
    const s = paceScope({ sales: { kind: 'flow', measure: () => 0 } });
    t.check(s.mgrPaceHTML({ metric: 'sales', from: day(-1), to: day(5), aim: 10, pace: null }) === '',
      'a target with no pace draws no chart');
  }

  /* ---------- 3b. one proposal per measure ----------------------------- */
  {
    const rows = [
      { id: 9, status: 'proposed', date: '2026-09-20', body: { metric: 'gross_profit', aim: 1400000, why: 'newest' } },
      { id: 7, status: 'proposed', date: '2026-09-19', body: { metric: 'gross_profit', aim: 1400000, why: 'older copy' } },
      { id: 6, status: 'proposed', date: '2026-09-19', body: { metric: 'collections', aim: 2500000, why: 'c' } },
      { id: 5, status: 'proposed', date: '2026-09-18', body: { metric: 'sales', aim: 9, why: 's' } },
      { id: 4, status: 'open', date: '2026-09-21', body: { metric: 'sales', aim: 9, from: '2026-09-21', to: '2026-09-27' } },
    ];
    const { managerScoreboard } = compileScope([
      extractFunction(src, 'managerScoreboard', 'index.html'),
      extractFunction(src, 'anShiftDate', 'index.html'),
    ], {
      managerNotesTable: true, currentShopId: 'S', todayISO: () => TODAY,
      MANAGER_METRICS: { gross_profit: { label: 'Gross profit' }, collections: { label: 'Collect' }, sales: { label: 'Sales' } },
      managerScoreProgress: (x) => ({ metric: x.body.metric }),
      sb: { from: () => { const q = { select: () => q, eq: () => q, order: () => q,
        limit: () => Promise.resolve({ data: rows, error: null }) }; return q; } },
      Date, String, Number, Map, Set,
    }, ['managerScoreboard']);
    const sb2 = await managerScoreboard();
    const gp = sb2.proposed.filter((x) => x.metric === 'gross_profit');
    t.check(gp.length === 1 && gp[0].id === 9 && gp[0].dupIds.join() === '7',
      'two copies of one proposal show as one, the newest, carrying the older as a duplicate');
    t.check(!sb2.proposed.some((x) => x.metric === 'sales'), 'a measure already running is not proposed again');
    t.check(sb2.proposed.length === 2, 'and the rest are untouched');
    const render = extractFunction(src, 'renderManager', 'index.html');
    t.check(/managerAdoptTarget\(id, dups\)/.test(render) && /managerDeclineTarget\(id, dups\)/.test(render)
      && /await managerRetireDuplicates\(dupIds\);/.test(extractFunction(src, 'managerAdoptTarget', 'index.html'))
      && /await managerRetireDuplicates\(dupIds\);/.test(extractFunction(src, 'managerDeclineTarget', 'index.html')),
      'answering the newest retires its older copies, whichever way it was answered');
  }

  /* ---------- 3c. a cut-off meeting carries on by itself, once --------- */
  {
    const meet = extractFunction(src, 'runManagerMeeting', 'index.html');
    t.check(/apAutoResume = true;\s*await apRunLoop\(\);\s*apAutoResume = false;\s*if\(apWasCutOff && !apLastPlan\)\{ apPushResume\('\[plan: …\]'\); await apRunLoop\(\); \}/.test(meet),
      'a meeting cut off before its plan resumes once, and a second cut-off falls back to asking');
    const rev = extractFunction(src, 'runManagerReview', 'index.html');
    t.check(/if\(apWasCutOff && !apLastReview\)\{ apPushResume\('\[review: …\]'\); await apRunLoop\(\); \}/.test(rev),
      'and so does a review cut off before its verdict');
    const loop = extractFunction(src, 'apRunLoop', 'index.html');
    t.check(/if\(apAutoResume\)\{\s*apBubble\('bot', esc\('I ran out of room mid-answer — picking up where I stopped/.test(loop),
      'while it carries on, the panel says so instead of asking for "continue"');
    const push = extractFunction(src, 'apPushResume', 'index.html');
    t.check(/Resume from where it stopped/.test(push) && /apWasCutOff = false;/.test(push),
      'the resume turn is the same sentence the owner\'s own "continue" sends');
  }

  /* ---------- 3d. one proposal per play ------------------------------ */
  {
    const rows = [
      { id: 30, status: 'proposed', date: '2026-09-20', body: { name: 'Retire the stale fixed markups on the top sellers', treats: 'margin' } },
      { id: 28, status: 'proposed', date: '2026-09-19', body: { name: 'Retire the stale fixed markups on the top sellers.', treats: 'margin' } },
      { id: 27, status: 'proposed', date: '2026-09-19', body: { name: 'Buy Masasi at the rung', treats: 'supplier_cost' } },
      { id: 26, status: 'proposed', date: '2026-09-18', body: { name: 'Charge for cutting', treats: 'margin' } },
      { id: 20, status: 'running', date: '2026-09-10', body: { name: 'Charge for cutting', treats: 'margin', startedOn: '2026-09-11' } },
    ];
    const { managerPlaybook } = compileScope([extractFunction(src, 'managerPlaybook', 'index.html')], {
      managerNotesTable: true, currentShopId: 'S', todayISO: () => TODAY,
      MANAGER_PROBLEMS: { margin: 'Margin', supplier_cost: 'Supplier cost' },
      managerPlayProgress: () => null, managerPlayClock: () => null,
      sb: { from: () => { const q = { select: () => q, eq: () => q, order: () => q,
        limit: () => Promise.resolve({ data: rows, error: null }) }; return q; } },
      console, String, Number, Math, Map, Set,
    }, ['managerPlaybook']);
    const book = await managerPlaybook();
    const retire = book.proposed.filter((p) => /Retire the stale/.test(p.name));
    t.check(retire.length === 1 && retire[0].id === 30 && retire[0].dupIds.join() === '28',
      'a play proposed twice shows once, the newest, with the older copy carried to be retired (a trailing full stop is the same play)');
    t.check(!book.proposed.some((p) => p.name === 'Charge for cutting'), 'a play already running is not proposed again beside itself');
    t.check(book.proposed.length === 2 && book.running.length === 1, 'and the rest are untouched');
    const status = extractFunction(src, 'managerPlayStatus', 'index.html');
    t.check(/async function managerPlayStatus\(rowId, status, dupIds\)/.test(status)
      && /if\(status === 'running' \|\| status === 'dropped'\) await managerRetireDuplicates\(dupIds\);/.test(status),
      'trying it or setting it aside retires the older copies too');
    t.check(/managerPlayStatus\(id, status, dups\)/.test(extractFunction(src, 'renderManager', 'index.html')),
      'and the row hands its copies to that answer');
  }

  /* ---------- 3e. a meeting that stopped short says so ------------------ */
  {
    const render = extractFunction(src, 'renderManager', 'index.html');
    t.check(/const cutShort = \(\)=> apMode === 'manager' && apWasCutOff && !managerCommittedPlan && !assistantBusy;/.test(render),
      'a manager sitting cut off before any plan was kept is told apart from no meeting at all');
    t.check(/const notHeldHTML = \(weekMeetings, last\)=> cutShort\(\) \? unfinishedHTML\(\) :/.test(render)
      && /ran out of room before its plan/.test(render) && /<span class="ow-pan-n">unfinished<\/span>/.test(render),
      'and the plan panel says the meeting is unfinished instead of "not held"');
    t.check(/id="mgrFinishBtn">Finish the meeting<\/button>/.test(render)
      && /finBtn\.addEventListener\('click', \(\)=>\{ apOpenPanel\(\); apSend\('continue'\); \}\);/.test(render),
      'with one button that finishes it — "continue", sent for the owner');
  }

  /* ---------- 4. wiring ------------------------------------------------ */
  {
    const render = extractFunction(src, 'renderManager', 'index.html');
    t.check(/\$\{\(!x\.finished && mgrPaceHTML\(x\)\) \|\| bar\(x\.pct\)\}/.test(render),
      'a running target shows its pace chart; a finished one keeps its bar');
    t.check(/managerAdviceWeeks\(todayISO\(\)\)\.then/.test(render), 'the weeks are read beside the other verdict readings');
    const paint = extractFunction(src, 'mgrPaintVerdict', 'index.html');
    /* Advice done became a square per piece of advice (a share of a
       whole); the trend stays with the figure that is about change. */
    t.check(/if\(wk && !cells\[2\]\.wait\) cells\[2\]\.spark/.test(paint)
      && /cells\[0\]\.viz = mgrWaffleHTML\(/.test(paint),
      'the trend rides beside a figure only once that figure is read, and advice done is drawn as its whole');
    t.check(!/cells\[1\]\.spark|cells\[3\]\.spark|cells\[0\]\.spark/.test(paint), 'and no other figure carries a weekly line — there it would be noise');
    t.check(/closest\('\.mgr-pc'\)/.test(src) && /tip\.style\.left = Math\.max\(0, Math\.min\(rect\.width - tw/.test(src),
      'one hover for every pace chart, and its label is kept inside the chart');
  }

  process.exit(t.done() ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
