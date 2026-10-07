#!/usr/bin/env node
'use strict';
/*
 * The Brief on a phone (the phone canvas) and the Brief's Phase 3
 * follow-ups, run on small hand-made inputs with the arithmetic written
 * beside each expectation.
 *
 *   - a goal's dates on the next 30 days are said in the measure's own
 *     unit (4.40m, 10.6%, 38 days), never as a raw number, and a figure
 *     the books cannot give reads "not known";
 *   - the phone's week is the next 30 days' own list, today and the six
 *     days after it, picked the same way;
 *   - the phone's four readouts are the desk strip's own cells, in the
 *     canvas's order: health, lowest cash, upside found, hit rate;
 *   - "It needs to know" counts as the nav counts: the open questions on
 *     the journal plus the supplier terms the books cannot supply;
 *   - the thumb bar carries only what the plan panel offers as its accent
 *     -- the open decision's door, or holding (or finishing) the meeting
 *     -- and runs nothing itself: a tap on it is a tap on the panel's own
 *     button;
 *   - the Simulator's teaser says "not known" for what it could not work
 *     out, with the Simulator's own shock count and its own words.
 *
 * Today is Wednesday 7 October 2026.
 *
 * Run: node test/manager-brief-phone.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('manager brief phone');
const src = read('index.html');
const fn = (n) => extractFunction(src, n, 'index.html');
const decl = (n) => extractDeclaration(src, n, 'index.html');
const eq = (got, want, msg) => t.check(JSON.stringify(got) === JSON.stringify(want),
  `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);
const TODAY = '2026-10-07';

const S = compileScope([
  ...['mgrBriefGoalCheckpoints', 'mgrBriefNext7', 'mgrBriefForesightPick', 'mgrBriefForesight', 'mgrBriefPhoneCells', 'mgrBriefNeeds',
    'mgrBriefThumbPick', 'mgrBriefOwn', 'mgrBriefDay', 'mgrTgFig', 'mgrShortUGX', 'anShiftDate', 'waWeekday'].map(fn),
  ...['MGR_BRIEF_METRIC_DEPT', 'MGR_BRIEF_PHONE_CELLS', 'MGR_BRIEF_FS_ORDER', 'MGR_BRIEF_MONTHS', 'MGR_WEEKDAYS'].map(decl),
], {
  todayISO: () => TODAY,
  fmtShortDate: (d) => {
    const m = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return Number(d.slice(8, 10)) + ' ' + m[Number(d.slice(5, 7)) - 1] + ' ' + d.slice(0, 4); },
  Date, Math, Number, String, Map, Set, Array, Object, JSON,
}, ['mgrBriefGoalCheckpoints', 'mgrBriefNext7', 'mgrBriefForesight', 'mgrBriefPhoneCells', 'mgrBriefNeeds', 'mgrBriefThumbPick', 'mgrTgFig']);

/* ---------- 1. a goal's dates, in its own unit (A6.8) ------------------ */
{
  const targets = [
    /* Gross profit to 31 Oct, 1,033,433 so far; the straight road's
       Mondays. Next checkpoint on or after today and before the end:
       Mon 12 Oct at 1,600,000 -> "1.60m". The end, 31 Oct, is inside the
       30 days (to 6 Nov), at its own checkpoint 4,400,000 -> "4.40m". */
    { metric: 'gross_profit', label: 'Gross profit', unit: 'ugx', to: '2026-10-31', aim: 4400000, actual: 1033433, finished: false,
      checkpoints: [{ on: '2026-10-05', value: 500000 }, { on: '2026-10-12', value: 1600000 }, { on: '2026-10-19', value: 2700000 },
        { on: '2026-10-31', value: 4400000 }] },
    /* Margin to 31 Dec: its next checkpoint, 10.6% on 12 Oct; its end is
       past the 30 days, so only the checkpoint is shown. Now 10.48 -> 10.5%. */
    { metric: 'margin_pct', label: 'Gross margin', unit: 'pct', to: '2026-12-31', aim: 12, actual: 10.48, finished: false,
      checkpoints: [{ on: '2026-10-12', value: 10.6 }, { on: '2026-12-31', value: 12 }] },
    /* Debtor days with no checkpoint list and no reading: its end, on
       its aim, and "not known" for now -- never 0. */
    { metric: 'debtor_days', label: 'Debtor days', unit: 'days', to: '2026-10-09', aim: 38, actual: null, finished: false },
    /* Finished, and a running one whose next date is past the 30 days:
       neither is on the list. */
    { metric: 'sales', label: 'Sales', unit: 'ugx', to: '2026-10-04', aim: 1, actual: 2, finished: true, checkpoints: [] },
    { metric: 'wa_orders', label: 'WhatsApp orders a month', unit: 'count', to: '2027-01-31', aim: 30, actual: 12, finished: false,
      checkpoints: [{ on: '2026-11-30', value: 20 }] },
  ];
  const got = S.mgrBriefGoalCheckpoints(targets, TODAY, S.mgrTgFig);
  eq(got.map((x) => [x.to, x.label, x.aimText, x.nowText, x.last, x.dept]), [
    ['2026-10-12', 'Gross profit', '1.60m', '1.03m', false, 'sales'],
    ['2026-10-31', 'Gross profit', '4.40m', '1.03m', true, 'sales'],
    ['2026-10-12', 'Gross margin', '10.6%', '10.5%', false, 'sales'],
    ['2026-10-09', 'Debtor days', '38 days', 'not known', true, 'finance'],
  ], 'the next checkpoint and the end inside 30 days, each in its own unit, and "not known" for a figure the books cannot give');
  /* Through the foresight: the canvas's words, and no raw number. */
  const fs = S.mgrBriefForesight({ today: TODAY, targets: got });
  const lines = fs.filter((x) => /goal/.test(x.text)).map((x) => x.text + ' | ' + x.tag);
  eq(lines, [
    'Debtor days goal ends · 38 days | goal · now not known',
    'Gross profit goal checkpoint · 1.60m | goal · now 1.03m',
    'Gross margin goal checkpoint · 10.6% | goal · now 10.5%',
    'Gross profit goal ends · 4.40m | goal · now 1.03m',
  ], 'the foresight says "goal checkpoint" and "goal ends" with formatted figures, in date order');
  t.check(!lines.some((l) => /\d{5,}/.test(l)), 'and not one line carries a raw figure such as 4400000 or 1033433');
  t.check(fs.filter((x) => /goal/.test(x.text)).every((x) => x.kind === 'deadline'), 'each is a deadline on the timeline');
}

/* ---------- 2. the phone's week ---------------------------------------- */
{
  const it = (date, kind, extra) => ({ date, kind, dept: 'finance', text: kind + ' ' + date, day: Number(date.slice(8)), dow: 'x', ...(extra || {}) });
  const items = [it('2026-10-07', 'risk'), it('2026-10-10', 'known', { pay: 'wage', amount: 1 }), it('2026-10-13', 'deadline'),
    it('2026-10-14', 'deadline'), it('2026-10-20', 'expected')];
  /* Today to today + 6 (13 Oct) inclusive: 7, 10, 13; 14 and 20 are the
     30 days' alone. */
  eq(S.mgrBriefNext7(items, 6, TODAY).map((x) => x.date), ['2026-10-07', '2026-10-10', '2026-10-13'], 'today and the six days after it');
  /* Eight in the week, a cap of six: the pick's own order keeps the
     lowest day, the risk and the deadlines over the known payments. */
  const busy = [it('2026-10-07', 'risk'), it('2026-10-08', 'known', { pay: 'rent', amount: 1 }), it('2026-10-08', 'known', { pay: 'other', amount: 1 }),
    it('2026-10-09', 'deadline'), it('2026-10-10', 'known', { lowest: true }), it('2026-10-11', 'deadline'),
    it('2026-10-12', 'known', { pay: 'other', amount: 1 }), it('2026-10-13', 'known', { pay: 'other', amount: 1 })];
  const wk = S.mgrBriefNext7(busy, 6, TODAY);
  t.check(wk.length === 6 && wk.some((x) => x.lowest) && wk.some((x) => x.kind === 'risk') && wk.filter((x) => x.kind === 'deadline').length === 2,
    'capped at six, chosen as the 30 days chooses: the lowest day, the risk and both deadlines kept (got ' + wk.map((x) => x.date + ':' + x.kind).join(', ') + ')');
  t.check(wk.every((x, i) => i === 0 || wk[i - 1].date <= x.date), 'and put back in date order');
}

/* ---------- 3. the phone's four readouts -------------------------------- */
{
  const cells = ['health', 'lowest', 'upside', 'free', 'risks', 'hit'].map((id) => ({ id }));
  eq(S.mgrBriefPhoneCells(cells).map((c) => c.id), ['health', 'lowest', 'upside', 'hit'],
    'health, lowest cash, upside found, hit rate -- the canvas\'s four, from the desk\'s own cells');
  t.check(S.mgrBriefPhoneCells(cells)[0] === cells[0], 'the same cell objects, so the same figures and the same failures');
}

/* ---------- 4. it needs to know ---------------------------------------- */
{
  const items = [
    { det: false, done: true, question: 'Answered already' },
    { det: false, question: 'What is Kasubi charging for G28 this week?', dept: 'sales', stake: { amount: 525000, from: 'market' }, place: { label: 'At Kasubi’s counter' } },
    { det: true, question: 'When does Roofings stop supplying?', dept: 'procurement', place: { label: 'Ask Roofings Ltd' } },
    { det: true, done: true, question: 'Kept this session' },
  ];
  /* The nav's count: 7 open on the journal + 1 supplier term still open = 8. */
  const m = S.mgrBriefNeeds(7, items);
  t.check(m.n === 8, 'the journal\'s open count plus the open supplier terms: 7 + 1 = 8 (got ' + m.n + ')');
  eq(m.top && [m.top.question, m.top.dept, m.top.stake.amount, m.top.where],
    ['What is Kasubi charging for G28 this week?', 'sales', 525000, 'At Kasubi’s counter'], 'the first open one, as the section orders them');
  /* Before the journal's count lands: the open journal questions on the
     list (1) plus the terms (1) = 2. */
  t.check(S.mgrBriefNeeds(null, items).n === 2, 'before the count lands, what the list holds: 1 + 1 = 2');
  const none = S.mgrBriefNeeds(0, []);
  t.check(none.n === 0 && none.top === null, 'nothing open: none, and no question invented');
}

/* ---------- 5. the thumb bar carries the panel's one accent -------------- */
{
  const door = { num: '01', dept: 'Finance', sure: 'sure 4/5 from 4 chases', title: 'Collect Kato’s 2.4m first', label: 'Draft the chase' };
  const d = S.mgrBriefThumbPick({ door });
  eq(d && [d.kind, d.small, d.title, d.label], ['door', '01 · Finance · sure 4/5 from 4 chases', 'Collect Kato’s 2.4m first', 'Draft the chase'],
    'the open decision: its number, department and how sure, its title, and its door');
  const h = S.mgrBriefThumbPick({ hold: true });
  t.check(h && h.kind === 'hold' && h.label === 'Hold the meeting', 'no meeting held: Hold the meeting');
  t.check(S.mgrBriefThumbPick({ finish: true, hold: true }).kind === 'finish', 'a meeting that stopped short: finish it, never a second one');
  t.check(S.mgrBriefThumbPick({ hold: true, running: true }) === null, 'a meeting in progress: nothing to carry');
  t.check(S.mgrBriefThumbPick({ door, stale: true }) === null, 'a last-known panel: nothing to carry -- its buttons are not wired');
  t.check(S.mgrBriefThumbPick({}) === null && S.mgrBriefThumbPick({ door: { title: 'x' } }) === null, 'a decision with no door: no bar');

  /* NOTHING SENDS ITSELF: the bar never runs a meeting, sends to the
     assistant or marks a move -- a tap on it clicks the panel's own
     button, found when tapped. */
  const paint = fn('mgrBriefPaintThumb');
  t.check(!/runManagerMeeting|apSend|apOpenPanel|managerSetMoveStatus|goToTab|apMode\s*=/.test(paint),
    'the bar calls no meeting, no assistant, no status write and no door of its own');
  t.check(/target\.click\(\)/.test(paint) && /\.mgr-b-dc\.mgr-b-x \.mgr-door/.test(paint) && /#mgrRunBtn\.btn-accent/.test(paint) && /#mgrFinishBtn/.test(paint),
    'it clicks the panel\'s own door, Hold or Finish button');
  t.check(/addEventListener\('click'/.test(paint) && !/setTimeout|setInterval/.test(paint), 'only on a click, never on a timer');
  /* The panel's copy steps aside only while the bar carries it. */
  t.check(/\.mgr-bed-b\.mgr-b-has-thumb #managerPlanWrap #mgrRunBtn\.btn-accent/.test(src) && /\.mgr-bed-b\.mgr-b-has-thumb \.mgr-b-dc\.mgr-b-x \.mgr-door/.test(src),
    'one accent on the phone: the panel\'s copy is hidden only while the bar shows');
}

/* ---------- 6. the teaser: the Simulator's own count, "not known" ------- */
{
  const els = {};
  const document = { getElementById: (id) => (els[id] = els[id] || { id, innerHTML: '', querySelectorAll: () => [] }) };
  const make = (M, rows) => compileScope([fn('mgrBriefPaintTeaser'), fn('mgrShortUGX'), fn('mgrBriefDay'), fn('waWeekday'),
    decl('mgrOf'), decl('MGR_BRIEF_MONTHS'), decl('MGR_WEEKDAYS')], {
    document, mgrBriefModel: M, mgrBriefRows: rows || [], esc: (s) => String(s), mgrBriefWireGo() {}, mgrBriefNeedsHTML: () => '',
    Date, Math, Number, String, Array, Object,
  }, ['mgrBriefPaintTeaser']);
  make({ tz: null, walk: null }).mgrBriefPaintTeaser();
  const none = els.managerSimTeaserWrap.innerHTML;
  t.check((none.match(/not known/g) || []).length === 3 && !/>—</.test(none),
    'nothing worked out: profit, lowest cash and the shocks each read "not known"');
  make({ walk: null, tz: { profitMonth: { lo: 100000, hi: 100000 }, lowest: { balance: -1060000, date: '2026-11-05' },
    shocksHeld: 0, shocksOf: 3, plan: 'my plan' } }, [{}, {}]).mgrBriefPaintTeaser();
  const tz = els.managerSimTeaserWrap.innerHTML;
  t.check(/0<span class="of">of<\/span>3/.test(tz) && /at or above the floor, on both lines/.test(tz) && /3 shocks\. My plan, played out:/.test(tz)
    && /Holds under shocks/.test(tz) && /2 decisions/.test(tz),
    'the Simulator\'s own count (0 of 3), its own label and what holding means');
}

process.exit(t.done() ? 1 : 0);
