#!/usr/bin/env node
'use strict';
/*
 * Pace: the scoreboard watches itself between meetings.
 *
 * A target was only ever looked at when a meeting was held, so a week
 * could be half gone with a third of the aim collected and nothing
 * anywhere said so. Progress alone says "900,000 of 3,000,000". Pace
 * says "900,000 where 1,300,000 would be level, with 3 days left" --
 * the difference between a warning and a verdict.
 *
 * Three things this file exists to hold:
 *
 *   AGAINST THE CALENDAR  expected is measured for the DAYS ELAPSED. A
 *       version that compares against the whole period is progress
 *       wearing pace's name, and would call every target behind on day
 *       one and none of them behind on day six.
 *   IN THE METRIC'S OWN DIRECTION  a debt target is on course when it
 *       is at or BELOW the line. Getting this backwards congratulates a
 *       shop for owing more.
 *   PACE OUTLIVES THE MEETING  the dashboard row must survive today's
 *       meeting being held -- that is exactly when it matters, and the
 *       card used to empty its whole slot.
 *
 * "At this rate" is the observed rate carried to the end of the period:
 * arithmetic on the past, which this app allows and labels, never a
 * forecast.
 *
 * Run: node test/manager-pace.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('the target pace');
const src = read('index.html');
const api = read('api/assistant.js');
const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);

const shift = (iso, n) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
/* Monday 24th to Sunday 30th; today is Wednesday the 26th, so three of
   the seven days are gone. */
const TODAY = '2026-08-26';
const data = { customers: [{ id: 1, debt: 7100000 }] };
const env = {
  data,
  todayISO: () => TODAY, anShiftDate: shift,
  apRound: (n) => Math.round(Number(n) || 0),
  debtCollectionsOn: (d) => ({ total: d <= TODAY ? 300000 : 0 }),
  anInvoicesInRange: () => [{}], anOverallTotals: () => ({ sales: 0, profit: 0, count: 0, estimatedQty: 0 }),
  dashInventoryHealth: () => ({ deadValue: 0, deadQty: 0 }),
  cashOnHandByAccount: () => ({ total: 0, byAccount: [] }),
  Date, JSON, Math, Number, String, Array, Object,
};
const scope = compileScope([
  extractDeclaration(src, 'MANAGER_METRICS', 'index.html'),
  extractFunction(src, 'managerScoreProgress', 'index.html'),
  'function names(){ return { managerScoreProgress }; }',
], env, ['names']);
const { managerScoreProgress } = scope.names();

const row = (body) => ({ date: '2026-08-24', body: { from: '2026-08-24', to: '2026-08-30', ...body } });

/* ---------- 1. a flow, measured against the days elapsed ------------- */
{
  /* 24th, 25th, 26th collected 300,000 each = 900,000 of a 3,000,000 aim
     with three of seven days gone. Level would be 1,285,714. */
  const p = managerScoreProgress(row({ metric: 'collections', aim: 3000000, baseline: 0 })).pace;
  eq(p.elapsed_days, 3, 'three days of the week are gone');
  eq(p.total_days, 7, 'out of seven');
  eq(p.expected, 1285714, 'level today is the aim shared over the days elapsed, not the whole week');
  eq(p.on_course, false, 'so 900,000 is behind');
  eq(p.behind_by, 385714, 'by the distance to level, in shillings the owner can act on');
  eq(p.at_this_rate, 2100000,
    'and the observed rate carried to Sunday lands at 2,100,000 — arithmetic on the past, said as "at this rate"');
}

/* ---------- 2. ahead of the line ------------------------------------- */
{
  const p = managerScoreProgress(row({ metric: 'collections', aim: 1500000, baseline: 0 })).pace;
  t.check(p.on_course === true, 'a smaller aim on the same collections is on course');
  eq(p.behind_by, 0, 'nothing behind is nothing to report');
  eq(p.at_this_rate, 2100000, 'the projection is the same rate whatever the aim — it describes the shop, not the target');
}

/* ---------- 3. a level target travels from where it started ---------- */
{
  /* Owed 8,000,000 when taken on, aiming for 5,000,000; three days in,
     level is 8,000,000 - 3,000,000 * 3/7 = 6,714,286. It stands at
     7,100,000, so it is behind. */
  const p = managerScoreProgress(row({ metric: 'debtors_total', aim: 5000000, baseline: 8000000 })).pace;
  eq(p.expected, 6714286, 'level on a LEVEL target is the journey from the baseline, not a share of the aim');
  eq(p.on_course, false, 'above the line on a target aimed DOWN is behind');
  eq(p.behind_by, 385714, 'by the distance back to the line');
  eq(p.at_this_rate, 5900000, 'and the rate of reduction carried forward lands at 5,900,000');

  data.customers[0].debt = 6500000;
  const better = managerScoreProgress(row({ metric: 'debtors_total', aim: 5000000, baseline: 8000000 })).pace;
  t.check(better.on_course === true,
    'BELOW the line on a down target is on course — getting this backwards congratulates a shop for owing more');
  eq(better.behind_by, 0, 'and nothing is behind');
  data.customers[0].debt = 7100000;
}

/* ---------- 4. the edges ---------------------------------------------- */
{
  const done = managerScoreProgress({ date: '2026-08-10',
    body: { metric: 'collections', aim: 100000, baseline: 0, from: '2026-08-10', to: '2026-08-16' } });
  t.check(done.finished === true, 'a period that has ended is finished');
  eq(done.pace.elapsed_days, 7, 'its elapsed days stop at the end of the period, never past it');
  const same = managerScoreProgress({ date: TODAY,
    body: { metric: 'collections', aim: 700000, baseline: 0, from: TODAY, to: TODAY } });
  eq(same.pace.total_days, 1, 'a one-day period is one day, never zero — nothing here divides by nothing');
  eq(same.pace.expected, 700000, 'and its whole aim is due today');
  eq(managerScoreProgress({ body: { metric: 'collections', aim: 1 } }).pace, null,
    'a target with no period has no pace, rather than a fabricated one');
  eq(managerScoreProgress({ body: { metric: 'nonsense', aim: 1 } }), null, 'and an unmeasurable metric still scores nothing');
}

/* ---------- 5. pace outlives the meeting ------------------------------ */
{
  /* RENDER it, twice. Reading the source for the right shape let a
     mutation through that simply returned early and emptied the slot —
     every assertion still matched the code that never ran. */
  const drawCard = (heldOn) => {
    const el = { innerHTML: '', querySelector: () => null, querySelectorAll: () => [] };
    let paceCalls = 0;
    compileScope([extractFunction(src, 'renderManagerCard', 'index.html')], {
      document: { getElementById: (id) => (id === 'dash_managerCard' ? el : null) },
      lsGet: () => heldOn, todayISO: () => TODAY,
      MANAGER_MEETING_KEY: 'k', renderManagerPace: () => { paceCalls++; },
      goToTab: () => {}, runManagerMeeting: () => {}, String,
    }, ['renderManagerCard']).renderManagerCard();
    return { html: el.innerHTML, paceCalls };
  };

  const before = drawCard('2026-08-01');
  t.check(/mgr-invite/.test(before.html), 'with no meeting held today the invite is offered');
  t.check(/id="dash_managerPace"/.test(before.html), 'and the pace slot is there beside it');

  const after = drawCard(TODAY);
  t.check(!/mgr-invite/.test(after.html), 'once today’s meeting is held the invite goes');
  t.check(/id="dash_managerPace"/.test(after.html),
    'but the PACE SLOT REMAINS — it matters most after the meeting, and the old card emptied the whole slot');
  eq(after.paceCalls, 1, 'and it is filled, held meeting or not');

  const pace = extractFunction(src, 'renderManagerPace', 'index.html');
  t.check(/if\(!el \|\| !managerNotesTable\) return;/.test(pace),
    'probe-guarded like every other journal read');
  t.check(/const behind = live\.filter\(x=> !x\.pace\.on_course\);/.test(pace)
    && /behind\.concat\(live\.filter\(x=> x\.pace\.on_course\)\)\.slice\(0, 2\)/.test(pace),
    'behind first, and at most two — a dashboard that always speaks teaches the eye to skip it');
  t.check(/if\(!live\.length\)\{ el\.innerHTML = ''; return; \}/.test(pace),
    'and silent when nothing is live');
  t.check(/x\.pace\.at_this_rate/.test(pace) && /At this rate/.test(pace),
    'the projection is shown as the rate carried forward, in those words');
  t.check(/managerScoreboard\(\)/.test(pace),
    'read from the one scoreboard derivation, so the dashboard and the Manager screen cannot disagree');
}

/* ---------- 6. the mind judges by pace, not by the raw figure --------- */
{
  const ext = api.slice(api.indexOf('const MANAGER_EXTENSION'), api.indexOf('].join', api.indexOf('const MANAGER_EXTENSION')));
  t.check(/Judge it by PACE, not by the raw figure/.test(ext), 'the meeting is told to judge by pace');
  t.check(/where a target on course would stand TODAY for the days elapsed/.test(ext),
    'with what expected means spelled out');
  ['expected', 'on_course', 'behind_by', 'at_this_rate'].forEach((k) =>
    t.check(ext.includes(k), `${k} is named for the mind that reads it`));
  t.check(/must leave the meeting with either a move against it TODAY or an honest re-plan/.test(ext),
    'and a target behind pace cannot leave the meeting untouched — the whole point of watching');
  t.check(/Each live target carries its pace/.test(api),
    'the tool’s own description says pace rides along');
}

/* ---------- 7. pace reaches the tool, not just the code -------------- */
(async () => {
  const rows = [{ id: 1, date: '2026-08-24', status: 'open',
    body: { metric: 'collections', aim: 3000000, baseline: 0, from: '2026-08-24', to: '2026-08-30' } }];
  const journal = { meeting: [{ id: 9, date: '2026-08-25', body: { keyline: 'k' } }], move: [], question: [], target: rows };
  const tools = compileScope([
    extractDeclaration(src, 'ASSISTANT_TOOLS', 'index.html'),
    extractFunction(src, 'buyHoldsStanding', 'index.html'),
    extractFunction(src, 'buyHoldFor', 'index.html'),
    extractFunction(src, 'buyKeyLabel', 'index.html'),
    extractFunction(src, 'managerPlaybook', 'index.html'),
    extractDeclaration(src, 'MANAGER_PROBLEMS', 'index.html'),
    extractDeclaration(src, 'MANAGER_METRICS', 'index.html'),
    extractFunction(src, 'managerScoreboard', 'index.html'),
    extractFunction(src, 'managerRecentReviews', 'index.html'),
    extractFunction(src, 'managerReviewBrief', 'index.html'),
    extractFunction(src, 'managerScoreProgress', 'index.html'),
    extractFunction(src, 'deriveMoveOutcome', 'index.html'),
    'function names(){ return { ASSISTANT_TOOLS }; }',
  ], { ...env, managerNotesTable: true, currentShopId: 'shop-1',
    data: { ...data, stockLog: [], savedQuotes: [], purchaseInvoices: [] },
    daysSinceDate: () => 2, fmtUGX: (n) => String(n), Promise,
    sb: { from: () => { const q = { _kind: null };
      q.select = () => q; q.order = () => q; q.in = () => q; q.gte = () => q; q.lte = () => q;
      q.eq = (c, v) => { if (c === 'kind') q._kind = v; return q; };
      q.limit = () => Promise.resolve({ data: journal[q._kind] || [], error: null });
      q.then = (res) => res({ data: journal[q._kind] || [], error: null });
      return q; } },
  }, ['names']).names().ASSISTANT_TOOLS;

  const hist = await tools.manager_history.run({ limit: 3 });
  const target = (hist.scoreboard || [])[0];
  t.check(!!(target && target.pace), 'the meeting is HANDED the pace, not merely near the code that computes it');
  eq(target.pace.expected, 1285714, 'the same level the screen shows');
  eq(target.pace.on_course, false, 'and the same verdict');
})().then(() => { process.exit(t.done() ? 1 : 0); })
  .catch((e) => { console.error(e); process.exit(1); });
