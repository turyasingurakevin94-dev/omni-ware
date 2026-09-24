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
    t.check((svg.match(/<rect /g) || []).length === 8, 'one column per week');
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

  /* ---------- 4. wiring ------------------------------------------------ */
  {
    const render = extractFunction(src, 'renderManager', 'index.html');
    t.check(/\$\{\(!x\.finished && mgrPaceHTML\(x\)\) \|\| bar\(x\.pct\)\}/.test(render),
      'a running target shows its pace chart; a finished one keeps its bar');
    t.check(/managerAdviceWeeks\(todayISO\(\)\)\.then/.test(render), 'the weeks are read beside the other verdict readings');
    const paint = extractFunction(src, 'mgrPaintVerdict', 'index.html');
    t.check(/if\(wk && !cells\[0\]\.wait\) cells\[0\]\.spark/.test(paint) && /if\(wk && !cells\[2\]\.wait\) cells\[2\]\.spark/.test(paint),
      'the trend rides beside a figure only once that figure is read');
    t.check(!/cells\[1\]\.spark|cells\[3\]\.spark/.test(paint), 'and targets met and not landing carry none — a weekly line there would be noise');
    t.check(/closest\('\.mgr-pc'\)/.test(src) && /tip\.style\.left = Math\.max\(0, Math\.min\(rect\.width - tw/.test(src),
      'one hover for every pace chart, and its label is kept inside the chart');
  }

  process.exit(t.done() ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
