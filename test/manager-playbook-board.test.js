#!/usr/bin/env node
'use strict';
/*
 * The Playbook section: the board's arithmetic, on small hand-made books.
 *
 * The canvas board draws every play as a guess, a measure, a deadline and
 * a verdict: four lanes (proposed, running, judged, proven recipes),
 * three experiment slots, a week-by-week read of each running play
 * against the week before it started, and "Write a play" with the checks
 * a play must pass before it starts. Every figure here is worked out by a
 * pure function in the Plays block (no DOM), and every one is checked
 * below against arithmetic written out by hand.
 *
 * THE LAWS THIS FILE HOLDS
 *   THE OWNER JUDGES (Q14)  a judged play carries the owner's verdict;
 *       a proven recipe is one the OWNER judged worked twice or more,
 *       counted -- never the app deciding a play worked.
 *   THREE SLOTS (Q15)  a fourth running play is refused, with the
 *       reason named.
 *   ASSOCIATION ONLY  "how sure, so far" is k of n weeks better than
 *       before: what moved alongside the play, never proof.
 *   NOT KNOWN IS NOT ZERO  a week with no reading (dead stock with no
 *       snapshot) is "not measured", never a zero; a play nothing
 *       measures says so.
 *
 * Run: node test/manager-playbook-board.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('the playbook board');
const src = read('index.html');
const eq = (got, want, msg) => t.check(JSON.stringify(got) === JSON.stringify(want),
  `${msg}${JSON.stringify(got) === JSON.stringify(want) ? '' : ` (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`}`);

const TODAY = '2026-10-07';   // a Wednesday
const shift = (iso, n) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const esc = (v) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const FNS = ['mgrPlayDept', 'mgrPlaySlotRefusal', 'mgrPlayFig', 'mgrPlayCellFig', 'mgrPlayDate', 'mgrPlayDays', 'mgrPlayWeeks',
  'mgrPlayLevelAt', 'mgrPlayWeekValue', 'mgrPlayReads', 'mgrNavCountPlays', 'mgrPlayStopRule', 'mgrPlayStopCheck', 'mgrPlayAimOdds', 'mgrPlayResult', 'mgrPlayConflicts', 'mgrPlayOdds', 'mgrPlayRerunPlan', 'mgrPlayBoard',
  'mgrPlayPastWeeks', 'mgrPlayP75', 'mgrPlayPresets', 'mgrPlayDraftBase', 'mgrPlayDesignCheck', 'mgrPlayWorth', 'mgrShortUGX', 'mgrDept',
  /* a play's own measure (Q41) */
  'mgrPlayMetric', 'mgrPlayMeasureClean', 'mgrPlayAreas', 'mgrPlayAfter', 'mgrPlayInvoiceDay', 'mgrPlayPlaceOf', 'mgrPlayInAreas',
  'mgrPlayWeekdaySales', 'mgrPlayFirstBuys', 'mgrPlayBuilderIds', 'mgrPlayNewAccountSales', 'mgrPlayAimFrom', 'mgrPlayWentOut'];
const DECLS = ['MGR_PLAY_SLOTS', 'MGR_PLAY_TREAT_DEPT', 'MGR_PLAY_VERDICT_WORDS', 'MGR_PLAY_STOP_SAY', 'MGR_PLAY_MONEY_KIND', 'MANAGER_PROBLEMS', 'MGR_DEPTS', 'MGR_WHOLE_SHOP',
  'MGR_PLAY_DAYS', 'MGR_PLAY_NEW_DAYS'];

/* The block's functions, compiled over a book the test controls. */
function scope(over) {
  const env = {
    anShiftDate: shift, esc, fmtUGX: (n) => Number(n).toLocaleString('en-US') + ' UGX',
    booksStartDate: () => '2026-01-01',
    shCashAt: () => 0, receivablesAsAt: () => 0,
    MANAGER_PROBLEM_METRICS: {}, MANAGER_METRICS: {}, data: { products: [], agents: [], staff: [] },
    mgrDebtorDays: () => ({ creditPerDay: 0, windowDays: 90 }), anInvoicesInRange: () => [],
    anOverallTotals: (l) => ({ sales: l.reduce((n, q) => n + q.total, 0) }), deadStockRows: () => [], anRowsByItem: () => [],
    productVariantLabel: (p) => p.name,
    orderCustomerLocation: (q) => q.place || '',
    ...over,
  };
  return compileScope([...FNS.map((n) => extractFunction(src, n, 'index.html')),
    ...DECLS.map((n) => extractDeclaration(src, n, 'index.html'))], env, FNS);
}

/* ---------- 1. a play's weeks, counted from the day it started ---------- */
{
  const S = scope();
  /* Started Mon 21 Sep, four weeks, read on Wed 7 Oct: 16 days in, so 3
     weeks have begun (floor(16/7)+1). Week 1 is 21-27 Sep and week 2
     28 Sep-4 Oct, both over; week 3 (5-11 Oct) is still running. */
  const w = S.mgrPlayWeeks('2026-09-21', 4, TODAY);
  eq(w.map((x) => [x.k, x.from, x.to, x.done, x.over]), [
    [1, '2026-09-21', '2026-09-27', true, false], [2, '2026-09-28', '2026-10-04', true, false],
    [3, '2026-10-05', '2026-10-11', false, false], [4, '2026-10-12', '2026-10-18', false, false]],
  'four weeks from the start day; a week is read only once its seventh day is over');
  /* Two weeks for, 29 days in: 5 weeks begun, the last three past the span. */
  eq(S.mgrPlayWeeks('2026-08-01', 2, '2026-08-30').map((x) => [x.k, x.done, x.over]),
    [[1, true, false], [2, true, false], [3, true, true], [4, true, true], [5, false, true]],
    'a play past its span keeps being read, its overrun weeks marked');
  eq(S.mgrPlayWeeks('2026-09-30', null, TODAY).length, 2, 'no span named: as many weeks as have begun (7 days in = 2)');
  eq(S.mgrPlayWeeks('2026-01-01', 4, TODAY).length, 13, 'and never more than thirteen, a quarter');
  eq(S.mgrPlayWeeks('', 4, TODAY), [], 'a play with no start day has no weeks');
}

/* ---------- 2. the weekly reads and how sure, so far ---------- */
{
  /* A FLOW: the share kept, read against THE MEETING'S BEFORE. The
     play started Mon 21 Sep and has run 16 days by Wed 7 Oct: two WHOLE
     weeks (review P4 -- 'since' used to run to today inclusive, a day
     longer than 'before' and holding today's unfinished day). So
     managerPlayProgress (the real one, compiled below) reads the 14 days
     since, 21 Sep-4 Oct = 8.7%, and the 14 days before, 7-20 Sep =
     9.0%. The board's before is that same 9.0%. Week 1 9.2% is better
     (it wants up), week 2 8.2% worse: k = 1 of n = 2; pips = round(5 x
     1/2) = round(2.5) = 3; latest 8.2%. */
  const SHARE = { '2026-09-07|2026-09-20': 9.0, '2026-09-21|2026-10-04': 8.7,
    '2026-09-21|2026-09-27': 9.2, '2026-09-28|2026-10-04': 8.2 };
  const margin = { label: 'the share kept', unit: 'pct', kind: 'flow', direction: 'up',
    measure: (f, to) => (SHARE[f + '|' + to] == null ? null : SHARE[f + '|' + to]) };
  const days = (a, b) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000);
  const progressOf = (metrics, first) => compileScope([extractFunction(src, 'managerPlayProgress', 'index.html')], {
    MANAGER_PROBLEM_METRICS: metrics, todayISO: () => TODAY, daysSinceDate: (d) => days(d, TODAY), anShiftDate: shift,
    booksStartDate: () => first || '2026-01-01' }, ['managerPlayProgress']).managerPlayProgress;
  const steel = { id: 1, treats: 'margin', started_on: '2026-09-21', weeks: 4 };
  steel.progress = progressOf({ margin })(steel, TODAY, [steel]);
  const S = scope({ MANAGER_PROBLEM_METRICS: { margin } });
  const r = S.mgrPlayReads(steel, TODAY, []);
  eq([steel.progress.before, steel.progress.since, steel.progress.before_span, steel.progress.since_span, steel.progress.days_read],
    [9, 8.7, '2026-09-07 to 2026-09-20', '2026-09-21 to 2026-10-04', 14],
    'the meeting reads 9.0% in the 14 days before against 8.7% in the 14 since — two whole weeks each side');
  eq([r.measured, r.before, r.before === steel.progress.before], [true, 9, true],
    'ONE READING: the board’s before for a flow IS the before the meeting and the weekly review are handed');
  eq(r.beforeBasis, 'the 14 days before it started (2026-09-07 to 2026-09-20), as the meeting reads it', 'and says so');
  eq(r.cells.map((c) => [c.value, c.state]), [[9.2, 'better'], [8.2, 'worse'], [null, 'open'], [null, 'open']],
    'each finished week read and called better or worse the way the play wants it');
  eq([r.k, r.n, r.pips, r.latest], [1, 2, 3, 8.2], 'better in 1 of 2 weeks: round(5 x 1/2) = 3 pips, and the latest reading is week 2');
  eq(S.mgrPlayResult(r), { text: 'the share kept 9.0% before → 8.7% since it started, better in 1 of 2 weeks',
    read: { label: 'the share kept', unit: 'pct', direction: 'up', before: 9, after: 8.7, moved: -0.3, k: 1, n: 2, basis: 'before → since it started' } },
  'a verdict keeps the meeting’s own pair in words and figures: 8.7 - 9.0 = -0.3 points');

  /* SALES, a sum: the meeting reads 28,000,000 in the 14 days before and
     28,000,000 in the 14 since (15m + 13m). A week's cell is set against
     a week's worth of the before: 28,000,000 x 7 / 14 = 14,000,000. Week
     1 15m better, week 2 13m worse. */
  const SALES = { '2026-09-07|2026-09-20': 28000000, '2026-09-21|2026-10-04': 28000000,
    '2026-09-21|2026-09-27': 15000000, '2026-09-28|2026-10-04': 13000000 };
  const growth = { label: 'sales', unit: 'money', kind: 'flow', direction: 'up', measure: (f, to) => SALES[f + '|' + to] };
  const bundle = { id: 5, treats: 'growth', started_on: '2026-09-21', weeks: 4 };
  bundle.progress = progressOf({ growth })(bundle, TODAY, [bundle]);
  const g = scope({ MANAGER_PROBLEM_METRICS: { growth } }).mgrPlayReads(bundle, TODAY, []);
  eq([g.before, g.cells[0].state, g.cells[1].state], [14000000, 'better', 'worse'], 'a sum: a week’s worth of the meeting’s before, 28m x 7/14 = 14m');
  eq(scope({ MANAGER_PROBLEM_METRICS: { growth } }).mgrPlayResult(g).text, 'sales 28m in the 14 days before → 28m in the 14 days since, better in 1 of 2 weeks',
    'and the line quotes the meeting’s two sums as they are');

  /* STAMPED THE DAY IT STARTED (review P4: "I'll read it each week
     against 44.3m" -- and the board then read its weeks against a
     before that moved every day). Saturday delivery, 4 weeks, started
     Wed 23 Sep with its before stamped: a week's worth of the 28 days
     26 Aug-22 Sep, 44,278,813 -- the figure the designer showed. Two
     whole weeks run by 7 Oct: 23-29 Sep 52m, 30 Sep-6 Oct 48m, 100m in
     the 14 days = a week's worth of 100m x 7/14 = 50m. Both weeks beat
     44.28m. The stop rule "no better than where it starts" is held to
     that same stamp: week 2's 48m is above it, so not met. */
  const STAMPED = { '2026-09-23|2026-10-06': 100000000, '2026-09-23|2026-09-29': 52000000, '2026-09-30|2026-10-06': 48000000 };
  const stampedSales = { label: 'sales', unit: 'money', kind: 'flow', direction: 'up', measure: (f, to) => STAMPED[f + '|' + to] };
  const sat = { id: 8, treats: 'growth', started_on: '2026-09-23', weeks: 4, baseline: 44278813, baselineFrom: '2026-08-26', baselineTo: '2026-09-22',
    stop: { threshold: 'sales no better than 44.3m, where it starts', byWeek: 2, vs: 'before', when: 'atmost' } };
  sat.progress = progressOf({ growth: stampedSales })(sat, TODAY, [sat]);
  eq([sat.progress.stamped, sat.progress.before, sat.progress.since, sat.progress.moved, sat.progress.days_read, sat.progress.before_span],
    [true, 44278813, 50000000, 5721187, 14, '2026-08-26 to 2026-09-22'],
    'the meeting reads the stamp, against a week’s worth of the whole weeks since: 50m − 44,278,813 = 5,721,187');
  const SS = scope({ MANAGER_PROBLEM_METRICS: { growth: stampedSales } });
  const sr = SS.mgrPlayReads(sat, TODAY, []);
  eq([sr.before, sr.cells.slice(0, 2).map((c) => c.state), sr.line],
    [44278813, ['better', 'better'], { before: 44278813, after: 50000000, beforeSpan: 'a week before', span: 'a week since, over 14 days' }],
    'ONE NUMBER: the board’s before cell is the stamp the designer promised, not the 14 days before the start');
  eq(sr.beforeBasis, 'a week’s worth of the 28 days before it started (2026-08-26 to 2026-09-22), stamped the day it started', 'and says so');
  eq(SS.mgrPlayStopCheck(sat, TODAY, [], sr), { rule: { value: 44278813, when: 'atmost', byWeek: 2, from: 'kept' }, met: false, week: 2, value: 48000000 },
    'its stop rule is held to the same stamp: week 2 read 48m, above 44.28m — not met');

  /* The meeting is handed the pair with its windows, so a week's worth
     is never read as the whole span's sum. */
  const hist = src.slice(src.indexOf('  manager_history: { confirm: false, async run(input){'));
  const moving = (hist.match(/worth\.push\((\{ kind: 'play_moving'[\s\S]*?caution: '[^']*' \})\);/) || [])[1];
  t.check(!!moving, 'manager_history builds a play_moving entry');
  const movingOf = new Function('pl', `return (${moving});`);
  /* A margin play is a SHARE over its window: 9.0% before, 8.7% since,
     read over 14 days -- not a sum and not a week's worth. */
  const mv = movingOf({ name: 'Price steel to the rival', progress: steel.progress });
  eq([mv.measures, mv.before, mv.now, mv.read_days, mv.per], ['the share kept', 9, 8.7, 14, 'share'],
    'a share-of-sales play reaches the meeting as a share over its 14 days, never called a sum');
  eq(movingOf({ name: 'Old margin play', progress: { measures: 'the share kept', unit: 'pct', before: 9, since: 8.7, days_read: 14 } }).per, 'share',
    'even a reading carried from before the field existed says share for a percentage');
  eq([steel.progress.per, bundle.progress.per, sat.progress.per], ['share', 'sum', 'week'],
    'the progress names its reading: margin a share, sales unstamped the 14 days’ sum, sales stamped a week’s worth');
  eq([movingOf({ name: 'bundle', progress: bundle.progress }).per, movingOf({ name: 'sat', progress: sat.progress }).per], ['sum', 'week'],
    'and the meeting is handed that same word');

  /* The books start 18 Sep, after the 7 Sep the before needs. */
  const shortP = { ...steel }; shortP.progress = progressOf({ margin }, '2026-09-18')(shortP, TODAY, [shortP]);
  const short = S.mgrPlayReads(shortP, TODAY, []);
  eq([short.before, short.beforeWhy, short.k, short.n], [null, 'the books do not reach back far enough for the same number of days before it started', 0, 0],
    'with no like-for-like window before it, there is no before — the meeting’s own words — and no week is called better or worse');
  eq(short.cells.slice(0, 2).map((c) => c.state), ['read', 'read'], 'its weeks are still read and shown');
  const young = { id: 6, treats: 'margin', started_on: '2026-10-03', weeks: 4 };
  young.progress = progressOf({ margin })(young, TODAY, [young]);
  eq(S.mgrPlayReads(young, TODAY, []).beforeWhy, 'the before is read once it has run a full week', 'under a week in, the before waits, as the meeting’s does');

  /* PIPS ARE k OF n, NOT A COUNT OF GOOD WEEKS: twelve weeks read, five
     better and seven worse, is round(5 x 5/12) = round(2.08) = 2 pips. */
  const long = { id: 7, treats: 'margin', started_on: '2026-07-01', weeks: 13,
    progress: { days_running: 98, before: 10, before_span: 'x', since: 10 } };
  const LONGW = {};
  for (let i = 0; i < 13; i += 1) LONGW[shift('2026-07-01', 7 * i) + '|' + shift('2026-07-01', 7 * i + 6)] = i < 5 ? 11 : 9;
  const lr = scope({ MANAGER_PROBLEM_METRICS: { margin: { ...margin, measure: (f, to) => LONGW[f + '|' + to] } } }).mgrPlayReads(long, TODAY, []);
  eq([lr.k, lr.n, lr.pips], [5, 13, 2], 'better in 5 of 13 weeks is 2 pips of 5 — never five');

  /* A LEVEL: money owed, stamped 102,672,963 the day it started (Mon 7
     Sep). Week ends 13, 20, 27 Sep and 4 Oct read 107m, 116m, 141m, 99m
     from the dated ledgers. It wants it DOWN: only 99m < 102.67m is
     better -> 1 of 4. */
  const OWED = { '2026-09-06': 110950363, '2026-09-13': 107000000, '2026-09-20': 116000000, '2026-09-27': 141000000, '2026-10-04': 99000000 };
  const debt = { label: 'money owed to you', unit: 'money', kind: 'level', direction: 'down', measure: () => 0 };
  const L = scope({ MANAGER_PROBLEM_METRICS: { debt }, receivablesAsAt: (d) => OWED[d] });
  const d = L.mgrPlayReads({ id: 2, treats: 'debt', started_on: '2026-09-07', weeks: 6, baseline: 102672963 }, TODAY, []);
  eq([d.before, d.beforeBasis], [102672963, 'stamped the day it started, as the meeting reads it'],
    'a level is read against the stamp taken when it was switched on — the before the meeting reads too');
  eq(d.cells.map((c) => c.state), ['worse', 'worse', 'worse', 'better', 'open', 'open'], 'down is better for money owed');
  eq([d.k, d.n, d.latest], [1, 4, 99000000], 'better in 1 of 4 weeks; the latest is the 4 Oct ledger');
  eq(d.line, { before: 102672963, after: 99000000, beforeSpan: 'before', span: 'in week 4' },
    'with no progress handed in, the line is the before against the latest week read, and says which week');
  const dp = L.mgrPlayReads({ id: 2, treats: 'debt', started_on: '2026-09-07', weeks: 6, baseline: 102672963,
    progress: { before: 102672963, now: 136669398, days_running: 30 } }, TODAY, []);
  eq(L.mgrPlayResult(dp).text, 'money owed to you 103m when it started → 137m today, better in 1 of 4 weeks',
    'a level’s line is the meeting’s pair: the stamp, and where it stands today');
  const d2 = L.mgrPlayReads({ id: 2, treats: 'debt', started_on: '2026-09-07', weeks: 6 }, TODAY, []);
  eq([d2.before, d2.beforeBasis], [110950363, 'the night before it started, from the books'],
    'with no stamp, the ledgers say where it stood the night before');

  /* DEAD STOCK: only the daily snapshot records it. Before = the last
     snapshot in the week before (19 Sep, 14.0m). Week 1 (21-27 Sep): its
     last snapshot, 27 Sep, 13.2m -- better. Week 2 has none: not
     measured, not a zero. */
  const dead = { label: 'dead stock', unit: 'money', kind: 'level', direction: 'down', measure: () => 0 };
  const DS = scope({ MANAGER_PROBLEM_METRICS: { dead_stock: dead } });
  const snaps = [{ date: '2026-09-19', levels: { deadStock: 14000000 } }, { date: '2026-09-25', levels: { deadStock: 13500000 } },
    { date: '2026-09-27', levels: { deadStock: 13200000 } }];
  const ds = DS.mgrPlayReads({ id: 3, treats: 'dead_stock', started_on: '2026-09-21', weeks: 3 }, TODAY, snaps);
  eq([ds.before, ds.beforeBasis], [14000000, 'the snapshot before it started'], 'dead stock before = the last snapshot before the start');
  eq(ds.cells.map((c) => [c.value, c.state]), [[13200000, 'better'], [null, 'unmeasured'], [null, 'open']],
    'a week with no snapshot is not measured — never a zero');
  eq([ds.k, ds.n, ds.unmeasured], [1, 1, 1], 'and is left out of k of n');
  const reading = DS.mgrPlayReads({ id: 3, treats: 'dead_stock', started_on: '2026-09-21', weeks: 3 }, TODAY, null);
  eq([reading.reading, reading.cells[0].state], [true, 'reading'], 'while the snapshots are being read, a week says so');
  const stamped = DS.mgrPlayReads({ id: 3, treats: 'dead_stock', started_on: '2026-09-21', weeks: 3, baseline: 15000000 }, TODAY, []);
  eq([stamped.before, stamped.beforeBasis, stamped.n, stamped.done, stamped.unmeasured], [15000000, 'stamped the day it started, as the meeting reads it', 0, 2, 2],
    'no snapshot at all: the stamp is the before, and its two finished weeks are not measured');
  eq(DS.mgrPlayReads({ id: 3, treats: 'dead_stock', started_on: '2026-09-21', weeks: 3, baseline: 15000000 }, TODAY, snaps).before, 15000000,
    'a stamp is the before even where a snapshot reaches back — the before the meeting reads');
  /* A FAILED READ IS NOT "NO SNAPSHOT KEPT". */
  const failed = DS.mgrPlayReads({ id: 3, treats: 'dead_stock', started_on: '2026-09-21', weeks: 3 }, TODAY, { error: 'the journal timed out' });
  eq([failed.readError, failed.beforeWhy, failed.cells.map((c) => c.state), failed.unmeasured, failed.n],
    ['the journal timed out', 'the daily snapshots could not be read — the journal timed out', ['unread', 'unread', 'open'], 0, 0],
    'a snapshot read that failed says so, its weeks unread — never "not measured", never a zero');

  /* NOTHING MEASURES IT */
  const none = scope().mgrPlayReads({ id: 4, treats: 'concentration', started_on: '2026-09-21' }, TODAY, []);
  eq([none.measured, none.why], [false, 'Nothing in the books measures depending on one buyer — you judge it by what you see.'],
    'a play nothing measures says so, rather than reaching for the nearest number');
  eq(scope().mgrPlayResult(none), { text: 'nothing in the books measures it', read: null }, 'and its verdict keeps no figure');

  /* THE STOP RULE, AS A FIGURE. */
  const R = scope({ MANAGER_PROBLEM_METRICS: { debt, margin, growth, cash: { label: 'cash in hand', unit: 'money', kind: 'level', direction: 'up' } },
    receivablesAsAt: (dd) => OWED[dd] });
  const rule = (treats, threshold, extra) => R.mgrPlayStopRule({ treats, stop: { threshold, byWeek: 4, ...extra } });
  eq(rule('debt', 'money owed still above 100m'), { value: 100000000, when: 'above', byWeek: 4, from: 'words' }, 'the meeting’s words read: above 100m');
  eq(rule('margin', 'the share kept below 8%'), { value: 8, when: 'below', byWeek: 4, from: 'words' }, 'a share needs its % sign');
  eq(rule('debt', 'money owed no better than 137m'), { value: 137000000, when: 'atleast', byWeek: 4, from: 'words' },
    '"no better than" for a measure that wants down is at or above');
  eq(rule('growth', 'sales no better than 50.8m'), { value: 50800000, when: 'atmost', byWeek: 4, from: 'words' }, 'and for one that wants up, at or below');
  eq([rule('cash', 'cash share under 64%'), rule('growth', 'under 6 a week'), rule('margin', 'below 9'), rule('growth', 'fewer than 3 new accounts')],
    [null, null, null, null], 'words in another unit, or no comparison, stay words: shown, never checked');
  eq(rule('debt', 'x', { value: 136669398, when: 'atleast' }), { value: 136669398, when: 'atleast', byWeek: 4, from: 'kept' },
    'an owner’s play keeps the figure itself');
  /* Friday chase, 7 Sep for 6 weeks, stop if above 100m by week 3: week 3
     (21-27 Sep) ends on a ledger of 141m > 100m -- met. By week 4 (99m)
     it is not; by week 6 (ends 18 Oct) not yet read. */
  const chaseP = (byWeek) => ({ treats: 'debt', started_on: '2026-09-07', weeks: 6, stop: { threshold: 'money owed still above 100m', byWeek } });
  eq(R.mgrPlayStopCheck(chaseP(3), TODAY, []), { rule: { value: 100000000, when: 'above', byWeek: 3, from: 'words' }, met: true, week: 3, value: 141000000 },
    'week 3 read 141m, above 100m: the rule is met');
  eq(R.mgrPlayStopCheck(chaseP(4), TODAY, []).met, false, 'week 4 read 99m: not met');
  eq(R.mgrPlayStopCheck(chaseP(6), TODAY, []), { rule: { value: 100000000, when: 'above', byWeek: 6, from: 'words' }, met: false, week: 6, value: null },
    'a week not yet over has met nothing');
  const withReads = R.mgrPlayReads({ ...chaseP(3), id: 2, baseline: 102672963 }, TODAY, []);
  eq(R.mgrPlayStopCheck(chaseP(3), TODAY, [], withReads).value, 141000000, 'from the board’s reads, the same week and figure');
  /* The nav line leads with a stop rule met, ahead of a span run out. */
  const N = scope({ MANAGER_PROBLEM_METRICS: { debt }, receivablesAsAt: (dd) => OWED[dd], todayISO: () => TODAY, mgrPlaysSnapCached: () => [] });
  eq(N.mgrNavCountPlays({ book: { running: [{ ...chaseP(3), name: 'Friday chase', clock: { past: false, daysLeft: 3, noSpan: false } },
    { name: 'Old', clock: { past: true } }], proposed: [{}] } }), { n: 3, note: '<b>Friday chase</b> has met its stop rule' },
  'the nav count is running + proposed, and its note names the play whose stop rule is met first');

  /* ODDS (Q4): of the last 12 finished weeks, how many reached the aim.
     Weeks ending yesterday: 30 Sep-6 Oct back to 15-21 Jul, sales 10m,
     20m ... 120m newest first. At 90m or more: 90, 100, 110, 120 = 4 of 12. */
  const W12 = {};
  for (let i = 0; i < 12; i += 1) W12[shift(TODAY, -7 * (i + 1)) + '|' + shift(TODAY, -7 * i - 1)] = (i + 1) * 10e6;
  const O = scope({ MANAGER_PROBLEM_METRICS: { growth: { ...growth, measure: (f, to) => W12[f + '|' + to] }, debt },
    receivablesAsAt: (dd) => (dd === shift(TODAY, -1) ? 90e6 : 120e6) });
  eq(O.mgrPlayAimOdds('growth', 90e6, TODAY, []), { k: 4, n: 12, of: 12 }, 'sales of 90m or more in 4 of the last 12 weeks');
  eq(O.mgrPlayAimOdds('debt', 100e6, TODAY, []), { k: 1, n: 12, of: 12 }, 'money owed at or under the aim in 1 of 12 week-ends — down is better');
  eq([O.mgrPlayAimOdds('growth', null, TODAY, []), O.mgrPlayAimOdds('other', 5, TODAY, [])], [null, null], 'no aim, or no measure: no odds');
}

/* ---------- 3. slots, clashes, overlaps and what a play waits for ---------- */
{
  const S = scope();
  const chase = { id: 1, name: 'Friday chase', treats: 'debt' }, steel = { id: 2, name: 'Steel', treats: 'margin' };
  const book = { running: [chase, steel], proposed: [
    { id: 3, name: 'Cash price', treats: 'debt' }, { id: 4, name: 'Bundle', treats: 'growth', dependsOn: 'the loader' },
    { id: 5, name: 'Bundle two', treats: 'growth' }, { id: 6, name: 'Own idea', treats: 'other' }] };
  const kinds = (p) => S.mgrPlayConflicts(p, book).map((c) => [c.kind, c.level, c.with ? c.with.name : c.text || null]);
  eq(kinds(book.proposed[0]), [['clash', 'cr', 'Friday chase']], 'a proposal treating what a running play treats clashes with it');
  eq(kinds(book.proposed[1]), [['twin', 'am', 'Bundle two'], ['depends', 'am', 'the loader']],
    'two proposals on one lever overlap, and a dependency is named');
  eq(kinds(book.proposed[3]), [], '"other" never clashes — it names no lever');
  const both = { running: [chase, { id: 7, name: 'Statements on day 15', treats: 'debt' }], proposed: [] };
  eq(S.mgrPlayConflicts(chase, both).map((c) => [c.kind, c.with.name]), [['shared', 'Statements on day 15']],
    'two running plays on one measure: neither reading is clean, and the card says so');
  const full = { running: [chase, steel, { id: 8, name: 'Hima', treats: 'other' }], proposed: [] };
  eq(S.mgrPlayConflicts({ id: 9, name: 'x', treats: 'growth' }, full).map((c) => c.kind), ['slots'], 'with three running, no slot is free');

  /* Q15: the refusal, named. */
  eq(S.mgrPlaySlotRefusal(book, null), null, 'two running: a slot is free');
  eq(S.mgrPlaySlotRefusal(full, null), 'All 3 experiment slots are in use — “Friday chase”, “Steel” and “Hima”. '
    + 'Judge or stop one first: a fourth at once would blur which play did what.', 'three running: the fourth is refused, every running play named');
  eq(S.mgrPlaySlotRefusal(full, 8), null, 'a play already counted in a slot is not refused its own');
  t.check(/could not be read — down, so the slots could not be counted\. Nothing was started\./.test(S.mgrPlaySlotRefusal({ error: 'down' }, null)),
    'a playbook that could not be read starts nothing, and says why');
  eq(scope().mgrPlaySlotRefusal({ running: [] }, null), null, 'an empty book has three free slots');
}

/* ---------- 4. the owner's verdicts, counted ---------- */
{
  const S = scope();
  const judged = [{ treats: 'debt', verdict: 'worked' }, { treats: 'debt', verdict: 'didnt' }, { treats: 'margin', verdict: 'worked' },
    { treats: 'other', verdict: 'worked' }];
  eq(S.mgrPlayOdds('debt', judged), { k: 1, n: 2 }, 'odds it works = of the debt plays you judged, how many you judged worked: 1 of 2');
  eq(S.mgrPlayOdds('growth', judged), { k: 0, n: 0 }, 'none judged: 0 of 0, which the screen says as "not known"');
  eq(S.mgrPlayOdds('other', judged), { k: 0, n: 0 }, 'and "other" is never counted together — it is not one problem');
  eq(S.mgrPlayRerunPlan({ treats: 'cash', weeks: 4, dept: 'finance', cost: 0, dependsOn: 'x', source: 'manager',
    hypothesis: { if: 'a', then: 'b', target: 'c' }, stop: { threshold: 'd', byWeek: 2 } }),
  { status: 'running', treats: 'cash', weeks: 4, dept: 'finance', cost: 0, depends_on: 'x', source: 'manager',
    hypothesis: { if: 'a', then: 'b', target: 'c' }, stop: { threshold: 'd', by_week: 2 } },
  'a re-run copies the recipe in the meeting contract’s own shape (by_week, depends_on)');
  eq(S.mgrPlayDept({ treats: 'debt' }).id, 'finance', 'a debt play is Finance (Q2)');
  eq(S.mgrPlayDept({ treats: 'dead_stock' }).id, 'store', 'dead stock is the Store');
  eq(S.mgrPlayDept({ treats: 'margin', dept: 'marketing' }).id, 'marketing', 'the meeting’s own department wins');
  eq(S.mgrPlayDept({ treats: 'other' }).id, 'all', 'and "other" is the whole shop');
}

/* ---------- 5. the board: band, slots, lanes, the sentence ---------- */
{
  const S = scope();
  const book = {
    running: [
      { id: 1, name: 'Friday chase', treats: 'debt', started_on: '2026-08-20', clock: { past: true, daysOver: 3, weeks: 4, noSpan: false } },
      { id: 2, name: 'Steel', treats: 'margin', started_on: '2026-09-21', clock: { past: false, daysLeft: 2, weeks: 4, noSpan: false } }],
    proposed: [
      { id: 3, name: 'Small one', treats: 'growth', sized: 'about 250,000 a month' },
      { id: 4, name: 'Big one', treats: 'cash', sized: 'adds 1,466,051 over 30 days' },
      { id: 5, name: 'Clashing', treats: 'debt', sized: 'about 9,000,000 a month' }],
    judged: [
      { id: 6, name: 'A', treats: 'cash', verdict: 'worked', started_on: '2026-06-01', judged_on: '2026-07-01' },
      { id: 7, name: 'B', treats: 'growth', verdict: 'didnt', started_on: '2026-07-10', judged_on: '2026-08-01' },
      { id: 8, name: 'A', treats: 'cash', verdict: 'worked', started_on: '2026-08-05', judged_on: '2026-09-01' }],
    proven: [{ key: 'a' }],
    dropped: [{ id: 9, name: 'C', started_on: '2026-05-20' }, { id: 10, name: 'D', started_on: null }],
  };
  const m = S.mgrPlayBoard(book, new Map(), TODAY, []);
  /* In the meeting's order (Q5) -- never ranked by sizing across kinds. */
  eq(m.proposed.map((x) => x.p.name), ['Small one', 'Big one', 'Clashing'], 'proposals stay in the meeting’s order');
  eq(m.proposed.map((x) => [x.level, x.kind]), [['vg', 'sales'], ['vg', 'cash'], ['cr', 'cash']], 'the clash is marked, and each says its kind of money');
  /* Two fit a free slot, one moving sales and one cash: law 6 -- none crowned. */
  eq(m.lead, null, 'two plays in different kinds of money: no lead');
  eq(m.slots, { used: 2, cap: 3, free: 1 }, 'two of three slots');
  /* Tried: 2 running + 3 judged + 1 dropped that had started = 6, since
     the first start on file, 20 May. Win rate: 2 of 3 judged worked. */
  eq([m.band.tried, m.band.since, m.band.verdicts, m.band.worked, m.band.proven], [6, '2026-05-20', 3, 2, 1],
    'the band: 6 tried since 20 May, 2/3 judged worked, 1 proven recipe');
  eq(m.judged.map((j) => j.id), [8, 7, 6], 'judged newest verdict first');
  eq(m.band.headline, 'A play is an experiment, not a wish. Friday chase is 3 days past its 4 weeks and needs your verdict. '
    + '2 plays fit a free slot — they move different kinds of money, so the choice is yours.',
  'the sentence: what is past its span first, then why it crowns none');
  eq(m.band.lamp, 'am', 'and the lamp says something is waiting on the owner');
  eq(m.proposed[1].odds, { k: 2, n: 2, basis: 'verdicts' }, 'with no aim to count weeks against, odds are your verdicts on cash plays: 2 of 2');
  /* One kind of money, both sized: the biggest leads. 1,466,051 over 30
     days against 900,000 a month, both cash freed. */
  const one = { ...book, proposed: [{ id: 4, name: 'Big one', treats: 'cash', sized: 'adds 1,466,051 over 30 days' },
    { id: 12, name: 'Clear tiles', treats: 'dead_stock', sized: 'about 900,000 a month' }] };
  const mo = S.mgrPlayBoard(one, new Map(), TODAY, []);
  eq([mo.lead.p.name, mo.leadWhy], ['Big one', 'biggest'], 'in one kind of money, the biggest sized leads');
  t.check(/Big one is the one I’d start next: the biggest the meeting sized that fits a free slot\./.test(mo.band.headline), 'and the sentence says so');
  const unsized = S.mgrPlayBoard({ ...one, proposed: [one.proposed[0], { id: 12, name: 'Clear tiles', treats: 'dead_stock', sized: '+4,200,000 cash freed once' }] }, new Map(), TODAY, []);
  eq(unsized.lead, null, 'a sum the meeting did not put against a month is not ranked against one that it did');
  t.check(/2 plays fit a free slot — not all of them are sized, so the choice is yours\./.test(unsized.band.headline), 'and it says why');
  const only = S.mgrPlayBoard({ ...one, proposed: [{ id: 13, name: 'Lone', treats: 'growth', sized: '' }] }, new Map(), TODAY, []);
  eq([only.lead.p.name, only.leadWhy], ['Lone', 'only'], 'the only play that fits leads, sized or not');
  t.check(/Lone is the one I’d start next: it fits a free slot and nothing running pulls the same lever\./.test(only.band.headline),
    'and is never called the biggest');
  /* A STOP RULE MET leads the sentence, lights the lamp red, and with a
     proposal on the same lever offers the replacement. */
  const tripBook = { running: [{ id: 1, name: 'Friday chase', treats: 'debt', started_on: '2026-09-07', weeks: 6,
    stop: { threshold: 'money owed still above 100m', byWeek: 3 }, clock: { past: false, daysLeft: 12, weeks: 6, noSpan: false } }],
  proposed: [{ id: 3, name: 'Cash price', treats: 'debt', sized: '' }], judged: [], proven: [], dropped: [] };
  const tripReads = new Map([[1, { measured: true, unit: 'money', k: 0, n: 4,
    cells: [{ k: 1, value: 107e6 }, { k: 2, value: 116e6 }, { k: 3, value: 141e6 }, { k: 4, value: 99e6 }] }]]);
  const tm = scope({ MANAGER_PROBLEM_METRICS: { debt: { label: 'money owed to you', unit: 'money', kind: 'level', direction: 'down' } } })
    .mgrPlayBoard(tripBook, tripReads, TODAY, []);
  eq([tm.running[0].stop.met, tm.running[0].weak, tm.running[0].replaceWith.name, tm.band.lamp], [true, true, 'Cash price', 'cr'],
    'week 3 read 141m, above 100m: met, weak, and the proposal on the same lever is offered in its place');
  t.check(/Friday chase has met its stop rule: week 3 read 141m\. Judge it or stop it — or replace it with Cash price\./.test(tm.band.headline),
    'the sentence leads with it');
  const weakReads = new Map([[1, { measured: true, unit: 'money', k: 1, n: 3, cells: [{ k: 1, value: 99e6 }, { k: 2, value: 99e6 }, { k: 3, value: 99e6 }] }]]);
  const wk = scope({ MANAGER_PROBLEM_METRICS: { debt: { label: 'money owed to you', unit: 'money', kind: 'level', direction: 'down' } } })
    .mgrPlayBoard({ ...tripBook, running: [{ ...tripBook.running[0], stop: null }] }, weakReads, TODAY, []);
  eq([wk.running[0].weak, wk.running[0].replaceWith.name], [true, 'Cash price'], 'better in 1 of 3 weeks (under half): a replacement is offered');
  book.running[0].clock = { past: false, daysLeft: 9, weeks: 6, noSpan: false };
  book.running.push({ id: 11, name: 'Hima', treats: 'other', started_on: '2026-09-25', clock: { noSpan: true, past: false } });
  const full = S.mgrPlayBoard(book, new Map(), TODAY, []);
  eq(full.band.headline, 'A play is an experiment, not a wish. Steel is due for your verdict in 2 days. '
    + 'All three slots are full, so nothing new starts until one is judged.', 'due within the week, and three slots full');
  eq(full.lead, null, 'with the slots full nothing leads');
  eq(S.mgrPlayBoard({ running: [], proposed: [], judged: [], proven: [], dropped: [] }, new Map(), TODAY, []).band.headline,
    'A play is an experiment, not a wish. Nothing is running yet — write one below.', 'an empty book says what to do next');
  eq(S.mgrPlayBoard({ running: [], proposed: [], judged: [], proven: [], dropped: [{ name: 'Old', superseded: true }, { name: 'New' }] }, new Map(), TODAY, [])
    .dropped.map((p) => p.name), ['New'], 'a set-aside the owner later overturned with a proven recipe is not drawn as set aside');
}

/* ---------- 6. write a play: the presets are this shop's own ---------- */
{
  /* AN AIM FROM A MEASURE'S OWN LAST 12 WEEKS. Twelve finished weeks,
     newest first: 10m, 20m ... 120m. The 75th percentile by nearest rank
     is the 9th of 12 sorted: 90m, above the last 7 days' 10m. */
  const S0 = scope();
  eq(S0.mgrPlayP75([5, 1, 3, 2, 4, 6, 7, 8, 9, 10, 11, 12]), 9, 'p75 of 1..12 is the 9th: ceil(0.75 x 12) = 9');
  eq(S0.mgrPlayP75([10, null]), 10, 'one value is its own p75; a missing one is left out');
  eq(S0.mgrPlayP75([]), null, 'and none is not known');
  const weekly = (vals) => ({ label: 'sales', measure: (f) => vals[[...Array(12).keys()].find((i) => shift(TODAY, -7 * (i + 1)) === f)] });
  const tenTo120 = Array.from({ length: 12 }, (_, i) => (i + 1) * 10e6);
  eq(S0.mgrPlayAimFrom(weekly(tenTo120), TODAY).aim, 90e6, 'the 75th percentile week, 90m, above the last 7 days');
  t.check(/^the 75th percentile of the last 12 weeks’ sales \(a week beaten 1 time in 4\)$/.test(S0.mgrPlayAimFrom(weekly(tenTo120), TODAY).basis), 'and says what it is');
  /* last 7 days 95m, weeks 2..12 20m..120m: sorted 20..90 (8), 95, 100,
     110, 120 -> 9th = 95m = the last week, not above it: the best, 120m. */
  const at95 = S0.mgrPlayAimFrom(weekly([95e6, ...tenTo120.slice(1)]), TODAY);
  eq([at95.aim, /best week/.test(at95.basis)], [120e6, true], 'last 7 days at the 75th percentile: aim at the best week');
  eq(S0.mgrPlayAimFrom(weekly([130e6, ...tenTo120.slice(1)]), TODAY).aim, null, 'last 7 days the best of all: no aim derived — the owner sets one');

  /* THE BOOK. Saturdays (the strongest day), for the 12 weeks back from
     3 Oct: a delivery to Kawempe of (i+1) x 600,000 and one to Bwaise of
     (i+1) x 400,000 in week i (newest i = 0), both out on the truck, and a
     1,000,000 counter sale in Ntinda that went nowhere. Tuesdays: Kato
     (a builder, site on the books) first bought 15 Sep 2m and again 29
     Sep 3m; Musa (no site) first bought 22 Sep 5m; Okello (a builder
     since January) bought 29 Sep 4m. One Monday sale of 500,000. */
  const Q = [];
  for (let i = 0; i < 12; i += 1) {
    const d = shift('2026-10-03', -7 * i);
    Q.push({ invoicedAt: d, total: (i + 1) * 600000, place: 'Kawempe', stageLog: [{ status: 'pending_delivery' }] },
      { invoicedAt: d, total: (i + 1) * 400000, place: 'Bwaise', stageLog: [{ status: 'pending_delivery' }] },
      { invoicedAt: d, total: 1000000, place: 'Ntinda' });
  }
  Q.push({ invoicedAt: '2026-09-15', total: 2000000, customerId: 'C1' }, { invoicedAt: '2026-09-29', total: 3000000, customerId: 'C1' },
    { invoicedAt: '2026-09-22', total: 5000000, customerId: 'C2' }, { invoicedAt: '2026-01-10', total: 1000000, customerId: 'C3' },
    { invoicedAt: '2026-09-29', total: 4000000, customerId: 'C3' }, { invoicedAt: '2026-10-05', total: 500000 });
  Q.forEach((q) => { q.status = 'completed'; q.invoiced = true; });
  const inRange = (f, to) => Q.filter((q) => q.invoicedAt >= f && q.invoicedAt <= to);
  const presetEnv = {
    MANAGER_PROBLEM_METRICS: { growth: { label: 'sales', unit: 'money', kind: 'flow', direction: 'up', measure: (f, to) => inRange(f, to).reduce((n, q) => n + q.total, 0) } },
    MANAGER_METRICS: { debtors_total: { measure: () => 50000000 }, dead_stock_value: { measure: () => 13000000 } },
    mgrDebtorDays: () => ({ creditPerDay: 1000000, windowDays: 90 }),
    anInvoicesInRange: inRange,
    deadStockRows: () => [{ productId: 'P9', variantIdx: null, line: 'P9 — Floor tiles', value: 5000000, daysQuiet: 120 }],
    anRowsByItem: () => [{ name: 'Iron sheet', variant: 'Iron sheet — G28', sales: 5 }, { name: 'Roofing nails', variant: '', sales: 9 }],
    data: { products: [{ id: 'P9', name: 'Floor tiles' }], agents: [], savedQuotes: Q,
      customers: [{ id: 'C1', name: 'Kato', siteStage: 'walling' }, { id: 'C2', name: 'Musa' }, { id: 'C3', name: 'Okello', siteStage: 'roofing' }],
      staff: [{ name: 'Joan Nakato', role: 'counter' }, { name: 'Moses Kibirige', role: 'delivery' }] },
  };
  const S = scope(presetEnv);
  const P = S.mgrPlayPresets(TODAY);
  eq(P.map((p) => p.id), ['cash', 'sat', 'paint', 'moses'], 'the canvas’s four, each mapped onto a situation these books hold');
  /* cash: 50m owed less a week of credit sales, 7 x 1m = 43m. */
  eq([P[0].label, P[0].treats, P[0].weeks, P[0].target, P[0].stopBy, P[0].cost], ['Cash price', 'debt', 6, 43000000, 3, null],
    'cash price aims at money owed less a week of credit sales; its cost is the owner’s to write');
  /* SATURDAY DELIVERY, MEASURED ON SATURDAY SALES IN ITS DELIVERY AREAS
     (Q41). Of the last 8 Saturdays' deliveries Kawempe took 600,000 x
     (1+...+8) = 21.6m and Bwaise 14.4m; Ntinda's counter sale went out
     on no truck, so it is no delivery area. Its weeks: Saturday sales in
     Kawempe & Bwaise, (i+1) x 1m -- 1m last week up to 12m: p75 = 9m. */
  eq([P[1].label, P[1].name, P[1].if, P[1].measure, P[1].target, P[1].stopBy],
    ['Saturday delivery', 'Saturday delivery, Kawempe & Bwaise', 'deliver to Kawempe and Bwaise on Saturdays', { kind: 'weekday', dow: 6, areas: ['Kawempe', 'Bwaise'] }, 9000000, 2],
    'the strongest weekday, measured on that day’s sales in the areas its deliveries went, aimed at its own 75th percentile');
  t.check(/^the 75th percentile of the last 12 weeks’ Saturday sales in Kawempe & Bwaise \(a week beaten 1 time in 4\); Saturday is your strongest day/.test(P[1].aimBasis)
    && /Kawempe and Bwaise took the most of its deliveries$/.test(P[1].aimBasis), 'and its basis says how the day, the areas and the aim were chosen');
  const satM = S.mgrPlayMetric({ treats: 'growth', measure: P[1].measure });
  eq([satM.label, satM.measure('2026-09-27', '2026-10-03'), satM.measure('2026-10-04', '2026-10-06')], ['Saturday sales in Kawempe & Bwaise', 1000000, 0],
    'the week to 3 Oct: 600,000 + 400,000 in the two areas — the 1m Ntinda counter sale and the Monday sale are not Saturday deliveries there');
  eq(S.mgrPlayMetric({ treats: 'growth', measure: { kind: 'weekday', dow: 6, areas: [] } }).measure('2026-09-27', '2026-10-03'), 2000000,
    'with no area named, every Saturday sale counts: 1m + 1m Ntinda');
  /* paint: 13m dead less the 5m tiles = 8m; the best seller has no variant, so its name. */
  eq([P[2].label, P[2].name, P[2].treats, P[2].target], ['Dead-stock bundle', 'Floor tiles with every Roofing nails order', 'dead_stock', 8000000],
    'the biggest dead line offered with the best seller, aimed at dead stock less that line — its pill short enough for one row');
  t.check(/^dead stock less Floor tiles \(/.test(P[2].aimBasis), 'the pill’s hover names the line it bundles, as the play’s name does');
  /* MOSES TO NEW SITES, MEASURED ON NEW BUILDER ACCOUNTS' SALES (Q41). A
     builder = a site on the books; new = within 8 weeks (56 days) of the
     first invoice. Weeks newest first: 30 Sep-6 Oct 0; 23-29 Sep Kato's
     3m (14 days in; Okello's 4m is no new account); 16-22 Sep 0 (Musa
     has no site); 9-15 Sep Kato's first 2m; the rest 0. p75 = 0, not
     above the last week's 0, so the best week: 3m. */
  eq([P[3].label, P[3].if, P[3].measure, P[3].target, P[3].weeks, P[3].stopBy],
    ['Moses to new sites', 'send Moses to new building sites every week', { kind: 'new_accounts', who: 'builders' }, 3000000, 8, 4],
    'the field hand on the books, by first name, measured on new builder accounts’ sales');
  const newM = S.mgrPlayMetric({ treats: 'growth', measure: P[3].measure });
  eq([newM.label, newM.measure('2026-09-01', '2026-10-06')], ['new builder accounts’ sales', 5000000],
    'September: Kato’s 2m + 3m — not Musa (no site), not Okello (a customer since January)');
  t.check(/a builder is a customer with a building site on the books/.test(P[3].aimBasis), 'and says what a builder is');
  const noSites = scope({ ...presetEnv, data: { ...presetEnv.data, customers: presetEnv.data.customers.map((c) => ({ id: c.id, name: c.name })) } });
  const P2 = noSites.mgrPlayPresets(TODAY);
  eq([P2[3].measure, noSites.mgrPlayMetric({ treats: 'growth', measure: P2[3].measure }).measure('2026-09-01', '2026-10-06')],
    [{ kind: 'new_accounts', who: 'accounts' }, 10000000],
    'no customer marked with a site: every new account counts (Kato 5m + Musa 5m), said so');
  t.check(/no customer is marked with a building site, so every new account counts/.test(P2[3].aimBasis), 'in its basis');
  const noPlace = scope({ ...presetEnv, anInvoicesInRange: (f, to) => inRange(f, to).map((q) => ({ ...q, place: '' })) }).mgrPlayPresets(TODAY);
  eq([noPlace[1].name, noPlace[1].measure.areas], ['Saturday delivery to builders’ sites', []], 'no delivery carries a place: every area counts');
  t.check(/no Saturday delivery carries a place on the books, so every area counts/.test(noPlace[1].aimBasis), 'and it says so');
  /* A measure is kept only on a sales play, only in these shapes. */
  eq([S.mgrPlayMeasureClean({ kind: 'weekday', dow: 6, areas: 'Kawempe, Bwaise and Kira' }, 'growth'), S.mgrPlayMeasureClean({ kind: 'weekday', dow: 9 }, 'growth'),
    S.mgrPlayMeasureClean({ kind: 'weekday', dow: 6 }, 'debt'), S.mgrPlayMeasureClean({ kind: 'new_accounts', who: 'x' }, 'growth')],
  [{ kind: 'weekday', dow: 6, areas: ['Kawempe', 'Bwaise', 'Kira'] }, null, null, { kind: 'new_accounts', who: 'accounts' }], 'the measure whitelist');
  const bare = scope({ MANAGER_PROBLEM_METRICS: { growth: { label: 'sales', unit: 'money', kind: 'flow', direction: 'up', measure: () => 0 } },
    MANAGER_METRICS: { debtors_total: { measure: () => 0 }, dead_stock_value: { measure: () => 0 } } }).mgrPlayPresets(TODAY);
  eq(bare, [], 'a shop whose books hold none of the four situations is offered none — only "your own"');
}

/* ---------- 7. the check before it starts, and the verdict ---------- */
{
  const S = scope();
  const sales = { label: 'sales', unit: 'money', kind: 'flow', direction: 'up' };
  const base = { measured: true, m: sales, base: 60000000, basis: 'the last 7 days', said: 'over the last 7 days' };
  const chase = { id: 1, name: 'Friday chase', treats: 'debt', started_on: '2026-09-07',
    clock: { spanDays: 42, noSpan: false, past: false } };
  const book = { running: [chase, { id: 2, name: 'Steel', treats: 'margin' }], proposed: [] };
  const ok = S.mgrPlayDesignCheck({ treats: 'growth', weeks: 4, cost: null }, base, book, []);
  eq(ok.checks.map((c) => [c.c, c.t]), [
    ['vg', 'Baseline found: sales 60m over the last 7 days.'],
    ['vg', 'Nothing running pulls the same lever; 1 of 3 slots free.'],
    ['vg', '4 weeks gives 4 weekly reads — enough to judge.'],
    ['am', 'No cost written — say what it costs, even if nothing.']], 'baseline, clash, long enough, cost — in that order');
  eq([ok.verdict.c, ok.verdict.h, ok.verdict.act], ['am', 'Start it.', 'start'], 'nothing red: start it, amber because a check is');
  t.check(/I’ll read it each week against 60m; write its cost first if it costs anything\./.test(ok.verdict.b), 'and the sentence says what is missing');

  const clash = S.mgrPlayDesignCheck({ treats: 'debt', weeks: 6, cost: 0 },
    { measured: true, m: { label: 'money owed to you', unit: 'money', kind: 'level', direction: 'down' }, base: 136000000, basis: 'today', snapsKept: true }, book, []);
  eq(clash.checks[0].t, 'Baseline found: money owed to you 136m today, from the books.', 'a level’s baseline is where it stands today');
  eq([clash.checks[1].c, clash.checks[1].t], ['cr', 'Clashes with “Friday chase” — both move money owed to you, so you couldn’t tell which did what.'],
    'the clash is named');
  /* Friday chase started 7 Sep for 42 days: its last day is 7 Sep + 41
     = 18 Oct (the board's week 6 is 12-18 Oct), and it is judged the day
     after, 19 Oct -- the day this one is scheduled for. */
  eq([clash.verdict.h, clash.verdict.act, clash.verdict.on], ['Wait.', 'schedule', '2026-10-19'], 'a clash waits: it is scheduled, not started');
  t.check(/Schedule it for 19 Oct, the day “Friday chase” is judged \(its span ends 18 Oct\)/.test(clash.verdict.b),
    'for the day the clashing play is judged, with the day its span ends');
  const noSpan = S.mgrPlayDesignCheck({ treats: 'debt', weeks: 6, cost: 0 }, { measured: true, m: { label: 'money owed to you', unit: 'money', kind: 'level', direction: 'down' },
    base: 1, basis: 'today', snapsKept: true }, { running: [{ ...chase, clock: { noSpan: true } }, book.running[1]], proposed: [] }, []);
  eq([noSpan.verdict.act, /Queue it and start it once “Friday chase” is judged, so/.test(noSpan.verdict.b)], ['queue', true],
    'a clashing play with no span names no day: queued');
  eq(clash.checks[3].t, 'Costs nothing — you said so.', 'a cost of nothing is the owner’s word, said back');

  const full = { running: [chase, { id: 2, treats: 'margin', name: 'Steel' }, { id: 3, treats: 'other', name: 'Hima' }], proposed: [] };
  const nf = S.mgrPlayDesignCheck({ treats: 'growth', weeks: 4, cost: 60000 }, base, full, []);
  eq([nf.checks[1].c, nf.verdict.h, nf.verdict.act], ['cr', 'Not yet.', 'queue'], 'three running: not yet — queue it');
  eq(nf.checks[3].t, 'Costs 60k — written into the play.', 'a cost the owner wrote is shown');
  const short = S.mgrPlayDesignCheck({ treats: 'growth', weeks: 1, cost: 0 }, base, book, []);
  eq([short.checks[2].c, short.verdict.h, short.verdict.act], ['cr', 'Change it.', null], 'under two weeks cannot be judged: change it, nothing to start');
  const eye = S.mgrPlayDesignCheck({ treats: 'concentration', weeks: 4, cost: 0, dependsOn: 'the loader' }, { measured: false }, book, []);
  eq(eye.checks.map((c) => c.c), ['am', 'vg', 'am', 'vg', 'vg'], 'nothing measures it, and it waits on something');
  eq(eye.checks[2].t, 'Waits on the loader.', 'the dependency is named');
  eq([eye.verdict.h, eye.verdict.act], ['Start it — judge it by eye.', 'start'], 'a play nothing measures is judged by the owner’s eye');
  const noBase = S.mgrPlayDesignCheck({ treats: 'growth', weeks: 4, cost: 0 },
    { measured: true, m: sales, base: null, why: 'the books do not reach a full week back' }, book, []);
  eq([noBase.checks[0].c, noBase.checks[0].t, noBase.verdict.h], ['cr', 'No baseline: the books do not reach a full week back.', 'Start it, but know this.'],
    'no baseline is said, and so is what that costs the verdict');
  eq(S.mgrPlayDesignCheck({ treats: 'cash', weeks: 4 }, base, book, [{ treats: 'cash', verdict: 'worked' }, { treats: 'cash', verdict: 'cant_tell' }]).odds,
    { k: 1, n: 2 }, 'and its odds are the owner’s own verdicts on plays like it');

  /* Where a draft's measure stands before it starts. */
  const D = scope({ MANAGER_PROBLEM_METRICS: {
    growth: { ...sales, measure: (f, to) => (f === '2026-09-30' && to === '2026-10-06' ? 61000000 : null) },
    dead_stock: { label: 'dead stock', unit: 'money', kind: 'level', direction: 'down', measure: () => 13685508 } } });
  eq(D.mgrPlayDraftBase('growth', TODAY, []).base, 61000000, 'a flow: the last 7 days, 30 Sep to 6 Oct');
  /* Four weeks: judged against the 28 days before it starts, 9 Sep-6 Oct
     -- the window managerPlayProgress will read at its end. 200m over 28
     days is a week's worth of 200m x 7/28 = 50m. */
  const D4 = scope({ MANAGER_PROBLEM_METRICS: { growth: { ...sales, measure: (f, to) => (f === '2026-09-09' && to === '2026-10-06' ? 200000000 : null) } } });
  eq([D4.mgrPlayDraftBase('growth', TODAY, [], 4).base, D4.mgrPlayDraftBase('growth', TODAY, [], 4).said], [50000000, 'a week, over the last 28 days'],
    'a flow over the span it will be judged against, as a week’s worth');
  const D4s = scope({ booksStartDate: () => '2026-09-20', MANAGER_PROBLEM_METRICS: { growth: sales } });
  eq(D4s.mgrPlayDraftBase('growth', TODAY, [], 4), { measured: true, m: sales, base: null, why: 'the books do not reach 28 days back, the span it would be judged against' },
    'books shorter than the span: no baseline, and why (PB.7)');
  eq([D.mgrPlayDraftBase('dead_stock', TODAY, { error: 'down' }).snapsKept, D.mgrPlayDraftBase('dead_stock', TODAY, { error: 'down' }).snapError], ['error', 'down'],
    'snapshots that could not be read are said as a failure');
  const errChk = S.mgrPlayDesignCheck({ treats: 'dead_stock', weeks: 3, cost: 0 },
    { measured: true, m: { label: 'dead stock', unit: 'money', kind: 'level', direction: 'down' }, base: 13685508, basis: 'today', snapsKept: 'error', snapError: 'down' }, book, []);
  eq(errChk.checks[0], { c: 'am', t: 'Baseline found: dead stock 13.7m today — but the daily snapshots its weekly reads need could not be read — down.' },
    'and the check says the read failed — not that none is kept');
  eq(D.mgrPlayDraftBase('dead_stock', TODAY, []).snapsKept, false, 'dead stock with no snapshot kept: its weekly reads cannot be made yet');
  eq(D.mgrPlayDraftBase('dead_stock', TODAY, null).snapsKept, null, 'still reading the snapshots');
  eq(D.mgrPlayDraftBase('dead_stock', TODAY, [{ levels: { deadStock: 1 } }]).snapsKept, true, 'one snapshot kept is enough to start reading');
  eq(D.mgrPlayDraftBase('other', TODAY, []).measured, false, 'and "other" has no measure');
}

/* ---------- 8. the figures as the board prints them ---------- */
{
  const S = scope();
  eq([S.mgrPlayCellFig(136669398, 'money'), S.mgrPlayCellFig(60300000, 'money'), S.mgrPlayCellFig(250000, 'money'),
    S.mgrPlayCellFig(9.04, 'pct'), S.mgrPlayCellFig(null, 'money')], ['137m', '60.3m', '250k', '9.0%', '—'],
  'a week’s cell: whole millions over 100m, one decimal under, a share to one decimal, and a dash for nothing read');
  eq(S.mgrPlayDate('2026-10-19'), '19 Oct', 'a day as the board says it');
  eq(S.mgrPlayDays('2026-09-21', TODAY), 16, 'days by the calendar');
}

/* ---------- 9. the playbook's judged and proven lanes (managerPlaybook) ---------- */
(async () => {
  const rows = [
    { id: 20, date: '2026-10-01', status: 'running', body: { name: 'Deposit cash twice a week', treats: 'cash', startedOn: '2026-10-01' } },
    { id: 19, date: '2026-09-01', status: 'done', body: { name: 'Deposit cash twice a week.', treats: 'cash', verdict: 'worked', judgedOn: '2026-09-28',
      endedOn: '2026-09-28', result: 'cash in hand 9.8m → 14.1m', resultRead: { unit: 'money', moved: 4300000 }, lesson: 'Fixed days work.' } },
    { id: 18, date: '2026-08-01', status: 'done', body: { name: 'Deposit cash twice a week', treats: 'cash', endedOn: '2026-08-28' } },
    { id: 17, date: '2026-07-01', status: 'done', body: { name: 'Deposit cash twice a week', treats: 'cash', verdict: 'didnt', judgedOn: '2026-07-20' } },
    { id: 16, date: '2026-07-01', status: 'done', body: { name: 'SMS price list', treats: 'growth', verdict: 'worked', judgedOn: '2026-07-15' } },
    { id: 15, date: '2026-06-01', status: 'dropped', body: { name: 'Free delivery', treats: 'growth', endedOn: '2026-06-10' } },
    { id: 14, date: '2026-06-01', status: 'done', body: { name: 'Odd one', treats: 'margin', verdict: 'it worked!' } },
  ];
  const readBook = (list) => compileScope([extractFunction(src, 'managerPlaybook', 'index.html'),
    extractDeclaration(src, 'MANAGER_PROBLEMS', 'index.html')], {
    managerNotesTable: true, currentShopId: 'S', todayISO: () => TODAY,
    managerPlayProgress: () => null, managerPlayClock: () => null,
    sb: { from: () => { const q = {}; q.select = () => q; q.eq = () => q; q.order = () => q;
      q.limit = (n) => { q.lim = n; return Promise.resolve({ data: list, error: null }); }; return q; } },
  }, ['managerPlaybook']).managerPlaybook();
  const book = await readBook(rows);
  /* NEVER BOTH A RECIPE AND SET ASIDE. Its last "worked" verdict is 28
     Sep. A proposal of it set aside on 2 Oct (after) takes it off the
     recipes; one set aside on 1 Jul (before) is superseded by the later
     verdicts. */
  const after = await readBook([...rows, { id: 21, date: '2026-10-02', status: 'dropped', body: { name: 'Deposit cash twice a week', treats: 'cash', endedOn: '2026-10-02' } }]);
  eq([after.proven.length, after.dropped.map((d) => [d.name, !!d.superseded])], [0, [['Free delivery', false], ['Deposit cash twice a week', false]]],
    'set aside after its last "worked": no longer a recipe, and set aside it stays');
  const before = await readBook([...rows, { id: 13, date: '2026-06-25', status: 'dropped', body: { name: 'Deposit cash twice a week', treats: 'cash', endedOn: '2026-07-01' } }]);
  eq([before.proven.map((r) => r.key), before.dropped.map((d) => [d.name, !!d.superseded])],
    [['depositcashtwiceaweek'], [['Free delivery', false], ['Deposit cash twice a week', true]]],
    'set aside before two later "worked" verdicts: still a recipe, the old set-aside superseded');
  eq(book.dropped.map((p) => p.name), ['Free delivery'], 'set aside is only what the owner set aside — a judged play is not filed there');
  eq(book.judged.map((p) => [p.id, p.verdict]), [[19, 'worked'], [18, 'worked'], [17, 'didnt'], [16, 'worked'], [14, 'worked']],
    'every closed play carries the owner’s verdict; one closed with the old "It worked" button reads as their worked');
  eq([book.judged[1].verdictLegacy, book.judged[1].result, book.judged[1].lesson], [true, null, null],
    'and says it was marked before verdicts were asked for, with no result or lesson invented for it');
  eq(book.judged[4].verdictLegacy, true, 'a verdict word that is not one of the three is not taken as given');
  eq([book.judged[0].result, book.judged[0].lesson, book.judged[0].judged_on], ['cash in hand 9.8m → 14.1m', 'Fixed days work.', '2026-09-28'],
    'the result and the lesson come back as the owner kept them');
  /* "Deposit cash twice a week" -- with or without the full stop, the
     same key: judged didn't (20 Jul), worked (28 Aug), worked (28 Sep).
     Worked twice: proven, 2 of 3. SMS worked once: not proven. */
  eq(book.proven.map((r) => [r.key, r.judgedWorked, r.judged, r.runs.map((x) => x.verdict), r.running, r.template.id]),
    [['depositcashtwiceaweek', 2, 3, ['didnt', 'worked', 'worked'], true, 19]],
    'proven = judged worked twice or more, counted by play key, every run kept in order; the newest worked run is the template');
  eq(book.proven[0].lastOn, '2026-09-28', 'with the day of its last verdict');

  /* IN THE MEETING'S ORDER (law 6, Q5; review P4). The journal is read
     newest id first, but a meeting writes its plays in one batch in its
     own order: meeting 140 wrote "AAA first" (145) then "ZZZ second"
     (146). Read as they came, the lane said ZZZ, AAA. The owner queued
     130 the same day (no meeting: placed by its own id, before meeting
     140 wrote). Meeting 120 on 1 Oct wrote 128 then 129. Newest day
     first; within a day the later meeting first; inside a meeting its
     own order: 145, 146, 130, 128, 129. */
  const ordered = await readBook([
    { id: 146, date: '2026-10-07', status: 'proposed', meeting_id: 140, body: { name: 'ZZZ second play of the meeting', treats: 'growth' } },
    { id: 145, date: '2026-10-07', status: 'proposed', meeting_id: 140, body: { name: 'AAA first play of the meeting', treats: 'cash' } },
    { id: 130, date: '2026-10-07', status: 'proposed', meeting_id: null, body: { name: 'Owner queued', treats: 'debt', source: 'owner' } },
    { id: 129, date: '2026-10-01', status: 'proposed', meeting_id: 120, body: { name: 'Y second of 1 Oct', treats: 'margin' } },
    { id: 128, date: '2026-10-01', status: 'proposed', meeting_id: 120, body: { name: 'X first of 1 Oct', treats: 'dead_stock' } }]);
  eq(ordered.proposed.map((p) => p.id), [145, 146, 130, 128, 129], 'managerPlaybook keeps each meeting’s plays in the order the meeting gave them');
})().then(() => {
  /* ---------- 10. the screen draws it all from these ---------- */
  const block = src.slice(src.indexOf('/* ═══ MGR BED: Plays — begin ═══ */\n/* ---- THE PLAYBOOK'),
    src.indexOf('/* ═══ MGR BED: Plays — end ═══ */\n/* ────'));
  t.check(block.length > 20000, 'the Plays block was found');
  const paint = extractFunction(src, 'mgrPaintPlays', 'index.html');
  t.check(/mgrPlayReads\(p, today, snaps\)/.test(paint) && /mgrPlayBoard\(book, reads, today, snaps\)/.test(paint),
    'the painter draws from the reads and the board model, nothing worked out twice');
  t.check(/ctx\.landed !== 'book' && ctx\.landed !== 'view'/.test(paint) && /mgrView !== 'plays'/.test(paint),
    'and draws the board only when the playbook lands on an open section, or the owner opens it');
  const running = extractFunction(src, 'mgrPlayRunningHTML', 'index.html');
  t.check(/data-pl-act="judge"/.test(running) && /MGR_PLAY_VERDICT_WORDS/.test(running) && /data-pl-act="keep" disabled/.test(running),
    'a running play is judged by the owner: three verdicts to choose from, nothing kept until one is chosen');
  t.check(/mgr-pl-in mgr-pl-lesson/.test(running), 'and the lesson is the owner’s, in their words');
  const judgedHTML = extractFunction(src, 'mgrPlayJudgedHTML', 'index.html');
  t.check(/You judged: /.test(judgedHTML) && /moved alongside it/.test(judgedHTML),
    'a judged play says it was YOUR verdict, and what moved alongside it');
  const design = extractFunction(src, 'mgrPlayDesignPaint', 'index.html');
  t.check(/class="btn btn-accent"/.test(design) && (block.match(/btn-accent/g) || []).length === 1,
    'the one oxide button on the section is the designer’s — every other is ghost');
  t.check(/managerAddOwnPlay\(name, d\.if, \{ status: act === 'start' \? 'running' : 'proposed'/.test(design) && /start_on: act === 'schedule' \? chk\.verdict\.on/.test(design)
    && /\.\.\.stopRule/.test(design),
    'the designer saves through managerAddOwnPlay, starting, queuing or scheduling it, its stop rule kept as a figure');
  const snapFor = extractFunction(src, 'mgrPlaysSnapFor', 'index.html');
  t.check(/cur\.waiters\[who\] = then/.test(snapFor) && /Date\.now\(\) - cur\.at < 60000/.test(snapFor) && /\.catch\(e=> land\(null/.test(snapFor),
    'the snapshot read repaints whoever painted last, and a failure is not kept for the day');
  /* ---------- 11. Q38: a meeting play's aim and stop as figures ----------
     From the [plan:] block through the contract's whitelist
     (managerPlayFields) and the playbook's view to the board: odds counted
     from the aim (Q4), the stop rule checked from its figure. A play with
     no figure keeps the k-of-n verdict fallback, said as such. */
  {
    const OWED = { '2026-09-06': 110950363, '2026-09-13': 107000000, '2026-09-20': 116000000, '2026-09-27': 141000000, '2026-10-04': 99000000 };
    const W12 = {};
    for (let i = 0; i < 12; i += 1) W12[shift(TODAY, -7 * (i + 1)) + '|' + shift(TODAY, -7 * i - 1)] = (i + 1) * 10e6;
    const METRICS = {
      growth: { label: 'sales', unit: 'money', kind: 'flow', direction: 'up', measure: (f, to) => W12[f + '|' + to] },
      debt: { label: 'money owed to you', unit: 'money', kind: 'level', direction: 'down', measure: () => 0 },
      margin: { label: 'the share kept', unit: 'pct', kind: 'flow', direction: 'up', measure: () => null },
    };
    const fields = compileScope([extractFunction(src, 'managerPlayFields', 'index.html'), extractFunction(src, 'managerPlanText', 'index.html'),
      extractDeclaration(src, 'MANAGER_DEPTS', 'index.html')], { MANAGER_PROBLEM_METRICS: METRICS }, ['managerPlayFields']).managerPlayFields;
    /* What managerPlaybook hands the screen: the saved body's keys. */
    const viewOf = (id, raw, extra) => { const b = { name: raw.name, treats: raw.treats, weeks: raw.weeks, ...fields(raw) };
      return { id, name: b.name, treats: b.treats, weeks: b.weeks, ...['stop', 'aimValue'].reduce((o, k) => (b[k] != null ? { ...o, [k]: b[k] } : o), {}), ...extra }; };
    const Q = scope({ MANAGER_PROBLEM_METRICS: METRICS, receivablesAsAt: (dd) => OWED[dd] });
    const promo = viewOf(21, { name: 'Weekend promo', treats: 'growth', weeks: 4, aim: { value: 90e6, unit: 'UGX' } });
    const old = viewOf(22, { name: 'Bundle the fastener', treats: 'growth', weeks: 4, hypothesis: { if: 'a', then: 'b', target: 'sales to 90m a week' } });
    eq([promo.aimValue, old.aimValue], [90000000, undefined], 'the meeting’s aim is saved as a figure; an old play has none');
    const judged = [{ id: 30, treats: 'growth', verdict: 'worked' }, { id: 31, treats: 'growth', verdict: 'didnt' }];
    const board = Q.mgrPlayBoard({ running: [], proposed: [promo, old], judged }, new Map(), TODAY, []);
    /* 12 finished weeks read 10m … 120m; 90m or more in 4 of them. */
    eq(board.proposed[0].odds, { k: 4, n: 12, of: 12, basis: 'aim', aim: 90000000, treats: 'growth' }, 'EXACT ODDS (Q4): weeks of the last 12 at its aim of 90m or better — 4 of 12, the figure and the measure carried for the card to name');
    eq(board.proposed[1].odds, { k: 1, n: 2, basis: 'verdicts' }, 'the play with words only keeps the fallback: your verdicts on sales plays, 1 of 2');
    const H = compileScope(['mgrPlayOddsHTML', 'mgrPlayFig', 'mgrPlayCellFig', 'mgrPlayMetric', 'mgrPlayMeasureClean', 'mgrPlayAreas'].map((f) => extractFunction(src, f, 'index.html')),
      { esc, MANAGER_PROBLEM_METRICS: METRICS, fmtUGX: (n) => Number(n).toLocaleString('en-US') + ' UGX' }, ['mgrPlayOddsHTML']).mgrPlayOddsHTML;
    /* WAS: "weeks of the last 12 at its aim or better" -- the figure
       counted against never appeared, and the words beside it may read a
       rise ("+150,000 a week"). NOW: the measure and the figure, named. */
    eq(H(board.proposed[0].odds, 'growth'), '4 of 12<small class="mgr-pl-ob" title="90,000,000 UGX">weeks of the last 12 with sales at 90m or more</small>',
      'and each says what it counted: weeks with sales at the aim’s own figure, 90m, or more — the full figure in its title');
    eq(H({ k: 2, n: 12, of: 12, basis: 'aim', aim: 50e6, treats: 'debt' }, 'debt'),
      '2 of 12<small class="mgr-pl-ob" title="50,000,000 UGX">weeks of the last 12 with money owed to you at 50m or less</small>',
      'a measure that should fall counts the weeks at the figure or less');
    eq(H({ k: 5, n: 12, of: 12, basis: 'aim', aim: 10, treats: 'margin' }, 'margin'),
      '5 of 12<small class="mgr-pl-ob">weeks of the last 12 with the share kept at 10.0% or more</small>', 'a share is named in points, no money title');
    t.check(/^1 of 2<small class="mgr-pl-ob">your verdicts on growth plays<\/small>$/.test(H(board.proposed[1].odds, 'growth')),
      'or the owner’s own verdicts, labelled as such');

    /* THE STOP AS A FIGURE: money owed above 100m, read by week 3. Week 3
       (21-27 Sep) ends on 141m > 100m -- met; the rule came from the
       figure ('kept'), not from reading words. */
    const chase = viewOf(23, { name: 'Friday chase', treats: 'debt', weeks: 6, stop: { value: 100e6, when: 'above', by_week: 3 } },
      { started_on: '2026-09-07' });
    eq(chase.stop, { byWeek: 3, value: 100000000, when: 'above' }, 'the stop is saved as figure, direction and week');
    eq(Q.mgrPlayStopCheck(chase, TODAY, []), { rule: { value: 100000000, when: 'above', byWeek: 3, from: 'kept' }, met: true, week: 3, value: 141000000 },
      'EXACT STOP RULE: week 3 read 141m, above 100m — met, from the figure itself');
    const later = viewOf(24, { name: 'Friday chase', treats: 'debt', weeks: 6, stop: { value: 100e6, when: 'above', by_week: 4 } }, { started_on: '2026-09-07' });
    eq(Q.mgrPlayStopCheck(later, TODAY, []).met, false, 'by week 4 it read 99m: not met');
    /* Words a reader cannot parse stay unchecked; with the figure beside
       them, the figure is what is checked. */
    const worded = viewOf(25, { name: 'Price ladder', treats: 'margin', weeks: 4, stop: { threshold: 'if the share kept slips', value: 8, when: 'below', by_week: 2 } },
      { started_on: '2026-09-21' });
    eq(Q.mgrPlayStopRule(worded), { value: 8, when: 'below', byWeek: 2, from: 'kept' }, 'words that name no figure, with the figure beside them: the figure is checked');
    eq(Q.mgrPlayStopRule(viewOf(26, { name: 'x', treats: 'margin', stop: { threshold: 'if the share kept slips', by_week: 2 } })), null,
      'and without it, nothing is checked — shown, never guessed');

    /* The running card says a figure-only rule in words built from it. */
    const R = compileScope([block, ...['mgrShortUGX', 'mgrDept', 'anShiftDate'].map((n) => extractFunction(src, n, 'index.html')),
      ...['MANAGER_PROBLEMS', 'MGR_DEPTS', 'MGR_WHOLE_SHOP'].map((n) => extractDeclaration(src, n, 'index.html'))], {
      esc, MANAGER_PROBLEM_METRICS: METRICS, fmtUGX: (n) => String(n), localStorage: null, todayISO: () => TODAY,
      data: { products: [], agents: [], staff: [] }, Map, Set, Math, Number, String, Array, Object, JSON, Date,
    }, ['mgrPlayRunningHTML']);
    const card = R.mgrPlayRunningHTML({ p: { ...chase, clock: null }, r: null, conflicts: [], stop: Q.mgrPlayStopCheck(chase, TODAY, []), replaceWith: null },
      { running: [], today: TODAY });
    t.check(/<dt>Stop if<\/dt><dd class="mgr-pl-words">above 100m by week 3 · read 141m<\/dd>/.test(card),
      `a stop given only as a figure reads "above 100m by week 3", with what the week read (${(card.match(/Stop if<\/dt><dd[^>]*>[^<]*/) || [''])[0]})`);
    t.check(/stop rule is met: week 3 read 141m, above 100m/.test(card), 'and the card says the rule is met, in the same figures');

    /* A STOP RULE MET WITH A TWIN ON THE SAME LEVER (review P4). The
       note says "judge it or stop it"; the card used to offer only
       "Replace with …" and "Let it finish". Now Judge it and Stop it
       stand, Replace it beside them -- never "Let it finish". */
    const acts = (html) => [...html.matchAll(/data-pl-act="(\w+)"/g)].map((m) => m[1]).filter((a) => a !== 'verdict' && a !== 'keep');
    const twin = { id: 40, name: 'Cash price under credit' };
    const metCard = R.mgrPlayRunningHTML({ p: { ...chase, clock: null }, r: null, conflicts: [], stop: Q.mgrPlayStopCheck(chase, TODAY, []), replaceWith: twin },
      { running: [], today: TODAY });
    eq(acts(metCard), ['judge', 'stop', 'replace'], 'stop rule met: Judge it, Stop it, and Replace it beside them');
    t.check(/judge it or stop it\. “Cash price under credit” treats the same/.test(metCard) && /title="Stop it and start “Cash price under credit”">Replace it<\/button>/.test(metCard),
      'the note names the twin, and the button is short enough not to wrap in its small height');
    /* Weak weeks only (not met): the replacement is offered, and "Let it
       finish" turns it away. */
    const laterR = Q.mgrPlayReads(later, TODAY, []);
    const weakCard = R.mgrPlayRunningHTML({ p: { ...later, clock: null }, r: laterR, conflicts: [], stop: Q.mgrPlayStopCheck(later, TODAY, [], laterR), replaceWith: twin },
      { running: [], today: TODAY });
    eq(acts(weakCard), ['replace', 'finish'], 'not met, weak weeks: Replace it or Let it finish');

    /* A RULE HELD TO WHERE IT STARTED says the stamp it is held to. */
    const heldTo = { ...viewOf(27, { name: 'Friday chase', treats: 'debt', weeks: 6 }, { started_on: '2026-09-07', baseline: 102672963 }),
      stop: { threshold: 'money owed to you no better than where it starts (103m today)', byWeek: 3, vs: 'before', when: 'atleast', value: 102672963 } };
    const heldCard = R.mgrPlayRunningHTML({ p: { ...heldTo, clock: null }, r: null, conflicts: [], stop: Q.mgrPlayStopCheck(heldTo, TODAY, []), replaceWith: null },
      { running: [], today: TODAY });
    t.check(/<dd class="mgr-pl-words">at or above 103m, where it started, by week 3 · read 141m<\/dd>/.test(heldCard),
      `a rule held to its start says the stamp: "at or above 103m, where it started, by week 3" (${(heldCard.match(/Stop if<\/dt><dd[^>]*>[^<]*/) || [''])[0]})`);

    /* A RULE THE BOARD CANNOT CHECK says so: its silence is not "not met". */
    const vague = viewOf(26, { name: 'Price ladder', treats: 'margin', weeks: 4, stop: { threshold: 'if the share kept slips', by_week: 2 } }, { started_on: '2026-09-21' });
    const vagueCard = R.mgrPlayRunningHTML({ p: { ...vague, clock: null }, r: null, conflicts: [], stop: Q.mgrPlayStopCheck(vague, TODAY, []), replaceWith: null },
      { running: [], today: TODAY });
    t.check(/if the share kept slips by week 2 <span class="mgr-pl-sub">· not checked by the board — your call<\/span>/.test(vagueCard),
      'words that name no figure: "not checked by the board — your call"');
    t.check(!/not checked by the board/.test(metCard), 'a rule the board checks does not say so');

    /* THE WEEK STRIP IN ONE ROW: six weeks and the before, eight cells at
       most, stand in one row (canvas: before + wk 1-6). */
    const chaseR = Q.mgrPlayReads(chase, TODAY, []);
    const stripCard = R.mgrPlayRunningHTML({ p: { ...chase, clock: null }, r: chaseR, conflicts: [], stop: Q.mgrPlayStopCheck(chase, TODAY, [], chaseR), replaceWith: null },
      { running: [], today: TODAY });
    eq([chaseR.cells.length, (stripCard.match(/class="mgr-pl-wk[^"]*"/) || [''])[0]], [6, 'class="mgr-pl-wk mgr-pl-wk1 mgr-pl-wkn"'],
      'six weeks: one row, its figures at the smaller size');
    t.check(/\.mgr-pl-wk\.mgr-pl-wk1\{grid-template-columns:none;grid-auto-flow:column;grid-auto-columns:minmax\(0,1fr\);\}/.test(src),
      'and the one-row rule lays the cells out as equal columns, never wrapping');

    /* A PROVEN RECIPE WHERE ONE WORKED RUN KEPT NO READING (review P4:
       "2 of 2 judged worked … across the 1 run you judged worked"). */
    const RR = compileScope([block, ...['mgrShortUGX', 'mgrDept', 'anShiftDate'].map((n) => extractFunction(src, n, 'index.html')),
      ...['MANAGER_PROBLEMS', 'MGR_DEPTS', 'MGR_WHOLE_SHOP'].map((n) => extractDeclaration(src, n, 'index.html'))], {
      esc, MANAGER_PROBLEM_METRICS: METRICS, fmtUGX: (n) => String(n), localStorage: null, todayISO: () => TODAY,
      data: { products: [], agents: [], staff: [] }, Map, Set, Math, Number, String, Array, Object, JSON, Date,
    }, ['mgrPlayRecipeHTML', 'mgrPlayWeeksText', 'mgrPlayAfter', 'mgrPlayDesignCheck', 'mgrPlayReads']);
    const recipe = { key: 'depositcashtwiceaweek', name: 'Deposit cash twice a week', template: { name: 'Deposit cash twice a week', treats: 'cash' },
      judgedWorked: 2, judged: 2, running: false, lastOn: '2026-09-28',
      runs: [{ verdict: 'worked', ended_on: '2026-08-28', resultRead: null },
        { verdict: 'worked', ended_on: '2026-09-28', resultRead: { unit: 'money', label: 'cash in hand', moved: 4300000 } }] };
    const rh = RR.mgrPlayRecipeHTML(recipe, { slots: { free: 1 } });
    t.check(/<p class="mgr-pl-sub">cash in hand, across 1 of the 2 runs you judged worked \(the other kept no reading\)<\/p>/.test(rh),
      'the average says it covers 1 of the 2 worked runs, the other having kept no reading');
    t.check(/title="cash in hand moved \+4\.3m on average alongside 1 of the 2 runs you judged worked"/.test(rh), 'and its title says the same');
    const both = RR.mgrPlayRecipeHTML({ ...recipe, runs: [{ ...recipe.runs[1], ended_on: '2026-08-28' }, recipe.runs[1]] }, { slots: { free: 1 } });
    t.check(/cash in hand, across the 2 runs you judged worked<\/p>/.test(both), 'when every worked run kept one, it says all of them');

    /* A CLEARED SPAN is asked for, never printed as "null". */
    eq([RR.mgrPlayWeeksText(null), RR.mgrPlayWeeksText(''), RR.mgrPlayWeeksText(NaN), RR.mgrPlayWeeksText(1), RR.mgrPlayWeeksText(6)],
      ['how many weeks?', 'how many weeks?', 'how many weeks?', '1 week', '6 weeks'], 'the designer’s span in its sentence');
    t.check(extractFunction(src, 'mgrPlayDesignPaint', 'index.html').includes("${slot(weeksText)}${/\\?$/.test(weeksText) ? '' : '.'}"),
      'and the sentence uses it, with no full stop after the question');
    /* ONE TAP, ONE WRITE: the buttons switched off are the CARD's -- a
       recipe's "Run it again" carries data-key itself, so the card is
       found as its article, and the tapped button is always among them. */
    const painter = extractFunction(src, 'mgrPaintPlays', 'index.html');
    t.check(/const card = b\.closest\('article'\) \|\| b\.parentElement \|\| b;/.test(painter) && /new Set\(\[b, \.\.\.card\.querySelectorAll\('\[data-pl-act\]'\)\]\)/.test(painter)
      && /if\(WRITES\.includes\(act\) && b\.disabled\) return;/.test(painter), 'a write button is off from the first tap until its write answers');

    /* "OTHER" IS NOT A THING THE BOOKS MEASURE (review P4: "Nothing in
       the books measures other"). */
    eq([RR.mgrPlayAfter('other'), RR.mgrPlayAfter(''), RR.mgrPlayAfter('debt')], ['what this play is after', 'what this play is after', 'debt'],
      'what a play is after, in a sentence');
    const own = RR.mgrPlayDesignCheck({ treats: 'other', weeks: 4, cost: 0 }, { measured: false }, { running: [], proposed: [] }, []);
    eq([own.checks[0].t, own.verdict.b], ['Nothing in the books measures what this play is after — your verdict will rest on what you see.',
      'Nothing in the books measures what this play is after; your verdict will be the only reading.'], 'the designer’s check and verdict for "your own"');
    eq(RR.mgrPlayReads({ id: 9, treats: 'other', started_on: '2026-09-21', weeks: 4 }, TODAY, []).why,
      'Nothing in the books measures what this play is after — you judge it by what you see.', 'and the running card');

    /* THE RUNNING LANE'S SUBTITLE reads as English. */
    const boardHTML = extractFunction(src, 'mgrPlayBoardHTML', 'index.html');
    t.check(/'Read week by week against the same span before it started, as the meeting reads it\.'/.test(boardHTML)
      && !/against the before the meeting reads/.test(boardHTML), 'the running lane says what its weeks are read against');

    /* WHAT THE DESIGNER SAID IT WOULD ADD rides with the play it queues,
       and the queued card shows it rather than "not sized". */
    t.check(/sized: add != null \? `\$\{addText\} if it reaches your aim` : undefined/.test(extractFunction(src, 'mgrPlayDesignPaint', 'index.html')),
      'the designer hands its "would add" to the writer');
    const PH = compileScope([block, ...['mgrShortUGX', 'mgrDept', 'anShiftDate'].map((n) => extractFunction(src, n, 'index.html')),
      ...['MANAGER_PROBLEMS', 'MGR_DEPTS', 'MGR_WHOLE_SHOP'].map((n) => extractDeclaration(src, n, 'index.html'))], {
      esc, MANAGER_PROBLEM_METRICS: METRICS, fmtUGX: (n) => String(n), localStorage: null, todayISO: () => TODAY,
      data: { products: [], agents: [], staff: [] }, Map, Set, Math, Number, String, Array, Object, JSON, Date,
    }, ['mgrPlayProposedHTML']);
    const queued = { id: 50, name: 'Cash price under credit', treats: 'debt', source: 'owner', sized: '+27.2m collected if it reaches your aim', proposed_on: TODAY };
    const qh = PH.mgrPlayProposedHTML({ p: queued, conflicts: [], level: 'vg', pick: false, worth: null, kind: 'cash', odds: { k: 0, n: 0, basis: 'verdicts' } },
      { slots: { free: 1, cap: 3 }, running: [], proposed: [], today: TODAY });
    t.check(/<dt>Would add<\/dt><dd class="mgr-pl-words"[^>]*>\+27\.2m collected if it reaches your aim<\/dd>/.test(qh) && !/not sized/.test(qh),
      'the queued card shows the designer’s figure, never "not sized"');
  }
  process.exit(t.done() ? 1 : 0);
}).catch((e) => { console.error(e); process.exit(1); });
