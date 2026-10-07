#!/usr/bin/env node
'use strict';
/*
 * The Targets section's arithmetic, worked by hand.
 *
 * The owner composes a target from the shop's own past (Q16): safe,
 * stretch and bold are the median, 75th and 90th percentile of the
 * measure's own past periods of the same length, read in its good
 * direction; the odds are how many of those periods reached the level, k
 * of n, and are not shown under six (Q4, TGT.2). A running target is
 * read against the straight road from where it started to its aim, and
 * called On track / At risk / Off track by one stated rule: behind the
 * road by less than a third of what is still to go is At risk, a third
 * or more is Off track. What finished is judged on its own last day, and
 * the rules it teaches are counts (TGT.8).
 *
 * Every expectation below is worked out in the comment beside it, on a
 * small hand-made book, and the functions are the app's own, read out of
 * index.html.
 *
 * Run: node test/manager-targets-model.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('the Targets section’s arithmetic');
const src = read('index.html');
const eq = (got, want, msg) => t.check(JSON.stringify(got) === JSON.stringify(want),
  `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);
const near = (got, want, msg) => t.check(Math.abs(got - want) < 1e-6, `${msg} (got ${got}, want ${want})`);

const shift = (iso, n) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const between = (a, b) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000);
const periodEnd = (p) => { const [y, m] = p.split('-').map(Number); return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); };
const periodShift = (p, n) => { const [y, m] = p.split('-').map(Number); return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7); };
const TODAY = '2026-10-07';

const FNS = ['mgrTgMemo', 'mgrTgBooksFrom', 'mgrTgFig', 'mgrTgGap', 'mgrTgDelta', 'mgrTgName', 'mgrTgClamp',
  'mgrTgDeadlines', 'mgrTgPeriods', 'mgrTgPercentile', 'mgrTgChoices', 'mgrTgOdds', 'mgrTgOutlook', 'mgrTgBridge',
  'mgrTgRoad', 'mgrTgState', 'mgrTgTrack', 'mgrTgLinked', 'mgrTgBehindTwo', 'mgrTgLearned', 'mgrTgSuggest',
  'mgrTgPerson', 'mgrTgBandLine', 'mgrTgFinishedLine', 'mgrTgDeadStockAt', 'mgrNavCountTargets', 'mgrTgBreak', 'mgrTgCashOn'];
const DECLS = ['MGR_TG_MIN_ODDS', 'MGR_TG_MIN_CHOICES', 'MGR_TG_PERIODS', 'MGR_TG_RISK', 'MGR_TG_MAX_RUNNING',
  'mgrTgMemoSig', 'mgrTgMemoAt', 'mgrTgMemoMap', 'mgrTgBetter', 'mgrTgDay'];

/* A scope over a hand-made book. METRICS stands in for MANAGER_METRICS so
   each test can say exactly what the books read. */
function scope(env) {
  return compileScope([
    ...DECLS.map((n) => extractDeclaration(src, n, 'index.html')),
    ...FNS.map((n) => extractFunction(src, n, 'index.html')),
  ], {
    todayISO: () => TODAY, anShiftDate: shift, waDaysBetween: between, periodOf: (iso) => String(iso).slice(0, 7),
    periodEndDate: periodEnd, periodShift, mgrRenderGen: 1, mgrMoveOrder: (r) => r, esc: (s) => String(s),
    shCashAt: () => 0, mgrCashWalk: undefined,
    data: { savedQuotes: [], cashTxns: [], stockLog: [], customers: [], staff: [] },
    MANAGER_METRICS: {},
    Date, Math, Number, String, Array, Object, Map, Set, JSON,
    ...env,
  }, FNS);
}

/* ---------- 1. a figure in its own unit ---------------------------------- */
{
  const s = scope({});
  eq(s.mgrTgFig('ugx', 5040000), '5.04m', 'money over a million reads in millions to two places');
  eq(s.mgrTgFig('ugx', 850000), '850k', 'and under it in thousands');
  eq(s.mgrTgFig('ugx', -1200000), '−1.20m', 'a negative figure keeps its sign');
  eq(s.mgrTgFig('pct', 22), '22.0%', 'a margin in per cent to one place');
  eq(s.mgrTgFig('days', 38.4), '38 days', 'days whole');
  eq(s.mgrTgFig('days', 38.4, true), '38', 'and bare where the name says days');
  eq(s.mgrTgFig('count', 40), '40', 'a count whole');
  eq(s.mgrTgFig('ugx', null), 'not known', 'a reading the books cannot give says so — never 0');
  eq(s.mgrTgGap('pct', 21.3 - 22), '0.7 pts', 'a margin moves in points');
  eq(s.mgrTgDelta('days', -7), '−7 days', 'a change carries its sign');
  eq(s.mgrTgDelta('ugx', 525000), '+525k', 'money added');
}

/* ---------- 2. names and deadlines --------------------------------------- */
{
  const s = scope({ MANAGER_METRICS: {
    debtor_days: { label: 'Debtor days', unit: 'days', direction: 'down' },
    lowest_cash: { label: 'Lowest cash in a month', unit: 'ugx', direction: 'up' },
    margin_pct: { label: 'Gross margin', unit: 'pct', direction: 'up' },
    wa_orders: { label: 'WhatsApp orders a month', unit: 'count', direction: 'up' },
  } });
  eq(s.mgrTgName('debtor_days', 30), 'Debtor days under 30', 'a measure aimed down is named "under"');
  eq(s.mgrTgName('lowest_cash', 2000000), 'Cash never under 2.00m', 'the lowest cash is named as the floor it holds');
  eq(s.mgrTgName('margin_pct', 22), 'Gross margin 22.0%', 'a margin with its per cent');
  eq(s.mgrTgName('wa_orders', 40), 'WhatsApp orders 40 a month', 'orders a month');
  /* 7 Oct: 31 Oct is 24 days on (25 with today), 30 Nov 54 (55), 31 Dec 85 (86). */
  eq(s.mgrTgDeadlines('2026-10-07'), [{ to: '2026-10-31', left: 24, days: 25 }, { to: '2026-11-30', left: 54, days: 55 },
    { to: '2026-12-31', left: 85, days: 86 }], 'the next three month-ends');
  /* 27 Oct: 31 Oct is only 4 days on, under a week, so it is skipped. */
  eq(s.mgrTgDeadlines('2026-10-27').map((d) => d.to), ['2026-11-30', '2026-12-31', '2027-01-31'],
    'a month-end less than a week away is not offered');
}

/* ---------- 3. safe / stretch / bold and the odds ------------------------ */
{
  const s = scope({});
  /* [3,5,9]: the 50th sits on 5; the 75th at position 1.5 is 5 + (9-5)*0.5 = 7;
     the 90th at 1.8 is 5 + 4*0.8 = 8.2. */
  near(s.mgrTgPercentile([3, 5, 9], 50), 5, 'the median of 3, 5, 9 is 5');
  near(s.mgrTgPercentile([3, 5, 9], 75), 7, 'the 75th is 7, read between neighbours');
  near(s.mgrTgPercentile([3, 5, 9], 90), 8.2, 'the 90th is 8.2');
  const vals = [30, 10, 50, 20, 40].map((v) => ({ v }));
  /* up, sorted 10..50: p50 = 30; p75 at position 3 = 40; p90 at 3.6 = 40 + 10*0.6 = 46. */
  eq(s.mgrTgChoices(vals, 'up', Math.round), { safe: 30, stretch: 40, bold: 46, n: 5 },
    'aimed up: safe the median, stretch the 75th, bold the 90th of the past periods');
  /* down: good is low, so stretch is the 25th (position 1 = 20), bold the 10th (0.4 = 10 + 10*0.4 = 14). */
  eq(s.mgrTgChoices(vals, 'down', Math.round), { safe: 30, stretch: 20, bold: 14, n: 5 },
    'aimed down: read in the good direction — stretch is what only a quarter of the past did better than');
  eq(s.mgrTgChoices([{ v: 1 }, { v: 2 }], 'up', Math.round), null, 'two past periods size nothing');
  /* aim 35 up over 10..50: 40 and 50 reached it, 2 of 5 — under six, no per cent. */
  eq(s.mgrTgOdds(vals, 35, 'up'), { k: 2, n: 5, pct: null }, 'the odds are counted, and hidden under six periods');
  const six = [10, 20, 30, 40, 50, 60].map((v) => ({ v }));
  eq(s.mgrTgOdds(six, 35, 'up'), { k: 3, n: 6, pct: 50 }, '3 of 6 past periods reached 35: 50%');
  eq(s.mgrTgOdds(six, 25, 'down'), { k: 2, n: 6, pct: 33 }, 'aimed down, 10 and 20 got under 25: 2 of 6, 33%');
}

/* ---------- 4. the past periods, back to back, never older than the books */
{
  const flowDays = [];
  const s = scope({
    data: { savedQuotes: [{ date: '2026-09-01' }], cashTxns: [], stockLog: [], customers: [], staff: [] },
    MANAGER_METRICS: {
      sales: { kind: 'flow', unit: 'ugx', direction: 'up', measure: (f, to) => { flowDays.push([f, to]); return (between(f, to) + 1) * 100; } },
      margin_pct: { kind: 'level', unit: 'pct', direction: 'up', window: 30, at: (d) => (d === '2026-10-06' ? 9.5 : 8) },
      wa_orders: { kind: 'level', unit: 'count', direction: 'up', at: (d) => (d === '2026-09-29' ? null : 12) },
    },
  });
  /* Books from 1 Sep, periods of 7 ending 6 Oct: 30 Sep–6 Oct, 23–29, 16–22,
     9–15, 2–8 Sep; the next (26 Aug–1 Sep) starts before the books. */
  const p = s.mgrTgPeriods('sales', 7, '2026-10-06');
  eq(p.values.map((x) => x.from + '..' + x.to), ['2026-09-30..2026-10-06', '2026-09-23..2026-09-29', '2026-09-16..2026-09-22',
    '2026-09-09..2026-09-15', '2026-09-02..2026-09-08'], 'five whole weeks, newest first, none before the books');
  eq(p.values.map((x) => x.v), [700, 700, 700, 700, 700], 'a flow is what each period earned');
  /* A month's figure reads 30 days back: only the reading on 6 Oct (back to
     7 Sep) fits inside books that start on 1 Sep. */
  eq(s.mgrTgPeriods('margin_pct', 7, '2026-10-06').values.map((x) => x.v), [9.5],
    'a month’s figure is never read over days the books do not cover');
  const w = s.mgrTgPeriods('wa_orders', 7, '2026-10-06');
  eq([w.values.length, w.unknown], [4, 1], 'a period the books cannot read is counted unknown and left out — never a zero');
}

/* ---------- 5. where a new target lands on the books alone --------------- */
{
  const s = scope({
    data: { savedQuotes: [{ date: '2025-01-01' }], cashTxns: [], stockLog: [], customers: [], staff: [] },
    MANAGER_METRICS: {
      sales: { kind: 'flow', unit: 'ugx', direction: 'up', measure: () => 2500 },
      stock_days: { kind: 'level', unit: 'days', direction: 'down', measure: () => 81, at: (d) => (d === '2026-09-12' ? 86 : 80) },
    },
  });
  /* To 31 Oct is 25 days with today. A flow's rate is the last 25 days
     (2,500), carried over the next 25: lands at 2,500. */
  const f = s.mgrTgOutlook('sales', TODAY, '2026-10-31');
  eq([f.P, f.now, f.projected, f.method], [25, 2500, 2500, 'at the rate of the last 25 days'], 'a flow lands where its last period of the same length did');
  /* A level: 81 today, 86 on 12 Sep (25 days back): -5 over 25 days, carried
     24 days to 31 Oct = 81 - 5/25*24 = 76.2. */
  const l = s.mgrTgOutlook('stock_days', TODAY, '2026-10-31');
  near(l.projected, 76.2, 'a level moves on at the rate it moved over the last 25 days');
}

/* ---------- 6. the path, and the road ------------------------------------ */
{
  const s = scope({});
  /* 5.04m at this rate; moves add 0.525m (5.565m, still short), then 0.64m
     (6.205m >= 6.0m: reached). The third is not needed. */
  const b = s.mgrTgBridge(5040000, 6000000, 'up', [{ effect: 525000 }, { effect: 640000 }, { effect: 270000 }]);
  eq([b.used, b.reached, b.end, b.rows.length], [2, true, 6205000, 2], 'moves are added in the meeting’s order until the aim is reached');
  /* Down: 38 days, a move sized at 7 days (31), then 3 (28 <= 30). */
  const d = s.mgrTgBridge(38, 30, 'down', [{ effect: 7 }, { effect: -3 }]);
  eq([d.used, d.reached, d.end, d.rows.map((r) => r.delta)], [2, true, 28, [-7, -3]], 'aimed down, each move takes its size off');
  const u = s.mgrTgBridge(4, 6, 'up', [{ effect: null }]);
  eq([u.used, u.reached, u.rows[0].delta, u.short], [0, false, null, 2], 'a move with no size is listed and adds nothing');
  eq(s.mgrTgBridge(7, 6, 'up', [{ effect: 1 }]).rows.length, 0, 'a target the books reach alone needs no move');
  /* 7 Oct (Wed) to 31 Oct (Sat), 25 days, 0 -> 2,500: by the end of day i
     the road stands at 2500*(i+1)/25. Mondays 12, 19, 26 Oct are days 5, 12,
     19 -> 600, 1300, 2000; the last day 2,500. Quarters: day ceil(25/4)-1 = 6
     (13 Oct, 700), 12 (19 Oct, 1300), 18 (25 Oct, 1900), 24 (31 Oct, 2500). */
  const r = s.mgrTgRoad('2026-10-07', '2026-10-31', 0, 2500, Math.round);
  eq(r.mondays, [{ on: '2026-10-12', value: 600 }, { on: '2026-10-19', value: 1300 }, { on: '2026-10-26', value: 2000 },
    { on: '2026-10-31', value: 2500 }], 'a checkpoint every Monday and on the last day');
  eq(r.quarters.map((q) => q.on + ':' + q.value), ['2026-10-13:700', '2026-10-19:1300', '2026-10-25:1900', '2026-10-31:2500'],
    'and the composer’s four on the same road');
}

/* ---------- 7. the three states, by the stated rule ---------------------- */
{
  const s = scope({});
  /* Gross profit: aim 4.4m, 1.03m in, the road has 1.886m today: behind
     0.856m of the 3.37m still to go = 25%, under a third: At risk. */
  const gp = s.mgrTgState({ finished: false, direction: 'up', aim: 4400000, actual: 1030000, pace: { on_course: false, behind_by: 856000 } });
  eq([gp.key, gp.toGo], ['risk', 3370000], 'behind by a quarter of what is left is At risk');
  near(gp.share, 856000 / 3370000, 'and the share is behind over what is still to go');
  /* Debtor days from 25 to 22 over 85 days, day 31: the road has
     25 - 3*31/85 = 23.906; at 35 it is 11.094 behind, of 13 to go (85%): Off track. */
  const dd = s.mgrTgState({ finished: false, direction: 'down', aim: 22, actual: 35, pace: { on_course: false, behind_by: 11.094 } });
  eq(dd.key, 'off', 'a third or more of what is left behind is Off track');
  /* Exactly a third: 20 behind of 60 to go. */
  eq(s.mgrTgState({ finished: false, direction: 'up', aim: 100, actual: 40, pace: { on_course: false, behind_by: 20 } }).key, 'off',
    'a third exactly is Off track — At risk is LESS than a third');
  eq(s.mgrTgState({ finished: false, direction: 'up', aim: 100, actual: 40, pace: { on_course: true, behind_by: 0 } }).key, 'on',
    'at or ahead of the road is On track');
  eq(s.mgrTgState({ finished: false, direction: 'down', aim: 22, actual: 21, pace: null }).key, 'on', 'already at the aim is On track');
  eq(s.mgrTgState({ finished: false, direction: 'up', aim: 1, actual: null, pace: null }).key, 'unknown', 'a figure the books cannot read is called nothing');
  eq(s.mgrTgState({ finished: false, direction: 'up', aim: 9, actual: 1 }).key, 'unknown', 'nor is one with no road yet');
  eq(s.mgrTgState({ finished: true, met: false, actual: 5, aim: 9 }).key, 'missed', 'a finished one is met or missed');
}

/* ---------- 8. the track: every mark on one scale ----------------------- */
{
  const s = scope({});
  /* Collect 6.0m, 5.7m in (95%); the road 2.571m (42.86%); landing 13.3m (off the end: 100). */
  const c = s.mgrTgTrack({ measure_kind: 'flow', direction: 'up', aim: 6000000, actual: 5700000, pace: { expected: 2571429 } }, 13300000, null);
  eq([c.start, c.now, Math.round(c.pace * 100) / 100, c.land, c.plan], [0, 95, 42.86, 100, null], 'a flow runs from nothing to the aim');
  /* Debtor days 25 -> 22, now 35: the wrong way, drawn at the start; the road 23.906 is (25-23.906)/3 = 36.47% along. */
  const d = s.mgrTgTrack({ measure_kind: 'level', direction: 'down', baseline: 25, aim: 22, actual: 35, pace: { expected: 23.906 } }, 53, 47);
  eq([d.start, d.now, Math.round(d.pace * 100) / 100, d.land, d.plan], [25, 0, 36.47, 0, 0], 'a level runs from where it started; the wrong way sits at the start');
}

/* ---------- 9. the moves aimed at a target ------------------------------ */
{
  const s = scope({});
  const moves = [{ id: 1, status: 'open', target: { metric: 'collections' }, effect: 2400000 },
    { id: 2, status: 'done', target: { metric: 'collections' }, effect: 1 }, { id: 3, status: 'open', target: { id: 41 } },
    { id: 4, status: 'open', target: null }];
  eq(s.mgrTgLinked(moves, { id: 41, metric: 'debtor_days' }).map((m) => m.id), [3], 'a move names the target row it serves');
  eq(s.mgrTgLinked(moves, { id: 9, metric: 'collections' }).map((m) => m.id), [1], 'or its measure; a move already done is no longer the plan');
}

/* ---------- 10. Mondays behind the road ---------------------------------- */
{
  const s = scope({});
  eq(s.mgrTgBehindTwo([{ behind: true }, { behind: true }]), true, 'behind at two Mondays running');
  eq(s.mgrTgBehindTwo([{ behind: true }, { behind: false }, { behind: true }]), false, 'not two in a row');
  eq(s.mgrTgBehindTwo([{ behind: null }, { behind: true }]), null, 'one known Monday says nothing either way');
}

/* ---------- 11. what the finished history teaches ------------------------ */
{
  const s = scope({});
  const R = (met, o) => ({ met, owner: null, linked: null, above90: null, behindTwo: null, ...o });
  /* Above the 90th: 3 targets, 2 missed (2*2 >= 3): a rule, 2 of 3.
     Owners: 4 with nobody named, 3 missed; 2 named, 0 missed: a rule.
     Moves: 2 unlinked both missed vs 1 linked met: a rule.
     Mondays: 1 behind twice — too few: no rule. */
  const rows = [
    R(false, { above90: true }), R(false, { above90: true, linked: false }), R(true, { above90: true, owner: 'you', linked: true }),
    R(false, { linked: false, behindTwo: true }), R(true, { owner: 'ST001' }), R(null, { above90: true }),
  ];
  const rules = s.mgrTgLearned(rows);
  eq(rules.map((r) => r.id), ['above90', 'owner', 'moves'], 'the rules the counts support, and only those');
  eq(rules.map((r) => r.k + '/' + r.n), ['2/3', '3/3', '2/2'], 'each is a count of what finished — a target with no known end counts for nothing');
  t.check(/2 of 3 targets set at or above the 90th percentile/.test(rules[0].line), 'said as a count');
  t.check(/3 of 3 targets with nobody named were missed, against 0 of 2 with an owner/.test(rules[1].line), 'against the other side');
  eq(s.mgrTgLearned([R(false, { above90: true })]).length, 0, 'one target is not a rule');
  eq(s.mgrTgLearned([R(false, {}), R(false, {})]).length, 0, 'nothing to compare against is not a rule either');
}

/* ---------- 12. the owner, and the line under a finished one -------------- */
{
  const s = scope({ data: { savedQuotes: [], cashTxns: [], stockLog: [], customers: [],
    staff: [{ id: 'ST001', name: 'Joan Nakato', phone: '0700 555 111' }] },
  MANAGER_METRICS: { collections: { unit: 'ugx', kind: 'flow' }, margin_pct: { unit: 'pct', kind: 'level' } } });
  const finished = [{ x: { metric: 'collections', to: '2026-09-04', owner: 'ST001' }, met: true },
    { x: { metric: 'collections', to: '2026-08-04', owner: 'you' }, met: true }];
  eq(s.mgrTgSuggest('collections', finished).owner, 'ST001', 'the owner of the last one met on the measure is suggested');
  eq(s.mgrTgSuggest('margin_pct', finished).owner, 'you', 'with none, the owner themself');
  eq(s.mgrTgPerson('ST001').ini, 'JN', 'staff wear their initials');
  eq(s.mgrTgPerson(null).name, 'No owner named', 'a weekly target from the meeting names nobody, and says so');
  /* Met 4 days early: crossed on 27 Sep, ended 1 Oct. */
  eq(s.mgrTgFinishedLine({ x: { aim: 3100000, actual: 3200000, to: '2026-10-01', owner: 'you' }, m: { unit: 'ugx' }, met: true, metOn: '2026-09-27' }),
    'reached 3.20m, 4 days early', 'met, and how early');
  /* Missed 22.0% by 0.9 pts, nobody named, no move aimed at it. */
  eq(s.mgrTgFinishedLine({ x: { aim: 22, actual: 21.1, to: '2026-08-31' }, m: { unit: 'pct' }, met: false, linked: false }),
    'missed by 0.9 pts — ended at 21.1% · nobody named as its owner, no move aimed at it', 'missed, by how much, and the facts the books hold');
  eq(s.mgrTgFinishedLine({ x: { aim: 22, actual: null }, m: { unit: 'pct' }, met: null }).slice(0, 30), 'where it ended is not known — ',
    'an end the books cannot read is not known');
}

/* ---------- 13. dead stock on a past day ---------------------------------- */
{
  /* A: restocked to 10 on 1 Aug, sold 2 on 10 Aug (8), sold 3 on 20 Sep (5); cost 100.
     B: 4 on 1 Jul, never sold; cost 50.  C: first stocked 6 on 1 Sep; no FIFO
     cost, its cheapest supplier price is 70. Quiet window 60 days. */
  const log = [
    { id: 1, key: 'B', date: '2026-07-01', type: 'restock', delta: 4, qtyAfter: 4 },
    { id: 2, key: 'A', date: '2026-08-01', type: 'restock', delta: 10, qtyAfter: 10 },
    { id: 3, key: 'A', date: '2026-08-10', type: 'sale', delta: -2, qtyAfter: 8 },
    { id: 4, key: 'C', date: '2026-09-01', type: 'restock', delta: 6, qtyAfter: 6 },
    { id: 5, key: 'A', date: '2026-09-20', type: 'sale', delta: -3, qtyAfter: 5 },
  ];
  const s = scope({
    data: { savedQuotes: [], cashTxns: [], stockLog: log, customers: [], staff: [] },
    deadStockQuietDays: () => 60, stockKey: (id) => id,
    allProductVariantEntries: () => ['A', 'B', 'C'].map((id) => ({ p: { id }, variantIdx: null })),
    getStockQty: (id) => ({ A: 5, B: 4, C: 6 })[id], getFIFOUnitCost: (id) => ({ A: 100, B: 50 })[id] == null ? null : ({ A: 100, B: 50 })[id],
    rankedPriceRows: () => [{ row: 1 }], purchasePriceAtQty: () => 70,
  });
  /* 15 Aug: A holds 8, sold 10 Aug (inside 60 days) -- alive; B holds 4,
     never sold -- dead, 4*50 = 200; C held 6-6 = 0 before its first row. */
  eq(s.mgrTgDeadStockAt('2026-08-15'), 200, 'on 15 Aug only the line never sold is dead: 4 at 50');
  /* 31 Dec: A's last sale (20 Sep) is before 1 Nov -- dead, 5*100; B 200;
     C 6 at 70 = 420: 1,120. */
  eq(s.mgrTgDeadStockAt('2026-12-31'), 1120, 'a line quiet past the window is dead, at today’s unit cost');
}

/* ---------- 14. the nav: running + proposed, and the Off track ------------ */
{
  const s = scope({});
  const score = { targets: [
    { finished: false, direction: 'down', aim: 22, actual: 35, pace: { on_course: false, behind_by: 11.094 } },   // off
    { finished: false, direction: 'up', aim: 4400000, actual: 1030000, pace: { on_course: false, behind_by: 856000 } }, // at risk
    { finished: true, met: true, actual: 1, aim: 1 } ], proposed: [{ id: 1 }] };
  eq(s.mgrNavCountTargets({ score }), { n: 3, note: '<b>1 target</b> off track' },
    '2 running + 1 proposed = 3; only the one Off track by the rule is named, not the one at risk');
  eq(s.mgrNavCountTargets({ score: { error: 'down' } }), null, 'an unread scoreboard counts nothing');
}

/* ---------- 15. the band’s line is counted -------------------------------- */
{
  const s = scope({});
  eq(s.mgrTgBandLine([]), 'No target is running. Set one below — I’ll show you what your own books say before you commit.',
    'nothing running says so');
  eq(s.mgrTgBandLine([{ landsAlone: true }, { landsAlone: false }, { landsAlone: false }]),
    'Three running. One lands at this rate on its own, two need a move to get there.', 'counts, in words');
}

/* ---------- 16. the score of a finished level is its own last day --------- */
{
  const M = {
    dead: { label: 'Dead stock', unit: 'ugx', kind: 'level', direction: 'down', measure: () => 999, at: (d) => (d === '2026-09-30' ? 500 : 0) },
    margin_pct: { label: 'Gross margin', unit: 'pct', kind: 'level', direction: 'up', round: (v) => Math.round(v * 10) / 10,
      measure: () => 20.94, at: () => 20.94 },
    blank: { label: 'Blank', unit: 'pct', kind: 'level', direction: 'up', measure: () => null, at: () => null },
  };
  const { managerScoreProgress } = compileScope([extractFunction(src, 'managerScoreProgress', 'index.html')],
    { MANAGER_METRICS: M, todayISO: () => TODAY, Date, Math, Number, String, Array }, ['managerScoreProgress']);
  const fin = managerScoreProgress({ body: { metric: 'dead', aim: 600, baseline: 900, from: '2026-09-01', to: '2026-09-30' } });
  eq([fin.finished, fin.actual, fin.met], [true, 500, true],
    'a finished level reads where it stood on its last day (500), never today’s figure (999)');
  const run = managerScoreProgress({ body: { metric: 'margin_pct', aim: 22, baseline: 20.1, from: '2026-10-01', to: '2026-10-31' } });
  eq([run.actual, run.unit], [20.9, 'pct'], 'a margin keeps its decimal and says its unit');
  /* 1 Oct to 31 Oct: 31 days, day 7; road 20.1 + 1.9*7/31 = 20.529 -> 20.5. Mondays 5, 12, 19, 26 Oct and 31 Oct. */
  eq(run.pace.expected, 20.5, 'and so does its road');
  eq(run.checkpoints.map((c) => c.on), ['2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26', '2026-10-31'],
    'a running target carries its Monday checkpoints and its last day');
  /* 5 Oct is day 5: 20.1 + 1.9*5/31 = 20.406 -> 20.4. */
  eq(run.checkpoints[0].value, 20.4, 'each on the straight road');
  const none = managerScoreProgress({ body: { metric: 'blank', aim: 5, from: '2026-10-01', to: '2026-10-31' } });
  eq([none.actual, none.met, none.pct, none.pace], [null, null, null, null], 'a reading the books cannot give is not known — no score, no verdict');
}

/* ---------- 16b. a hold: the aim already met where it started ----------- */
{
  const M = { cash: { label: 'Lowest cash in a month', unit: 'ugx', kind: 'level', direction: 'up', measure: () => 3540000, at: () => 3540000 } };
  const { managerScoreProgress } = compileScope([extractFunction(src, 'managerScoreProgress', 'index.html')],
    { MANAGER_METRICS: M, todayISO: () => TODAY, Date, Math, Number, String, Array }, ['managerScoreProgress']);
  /* Set on 1 Oct at 29.07m with a floor of 10.00m: a line to hold. It now
     stands at 3.54m -- broken: 0%, not the 134% the journey arithmetic
     gave ((29.07-3.54)/(29.07-10), capped to 100 while not met). */
  const h = managerScoreProgress({ body: { metric: 'cash', aim: 10000000, baseline: 29070000, from: '2026-10-01', to: '2026-10-31' } });
  eq([h.hold, h.pct, h.met, h.pace.expected, h.pace.on_course, h.pace.behind_by], [true, 0, false, 10000000, false, 6460000],
    'a hold is 0% once broken, the line it must keep today is the aim, and it is behind by the distance under it');
  eq(h.checkpoints.every((c) => c.value === 10000000), true, 'and every checkpoint is the line itself');
  const sTr = scope({});
  /* The track of a hold: from the line (0) to where it started (100):
     20m is (20-10)/(29.07-10) = 52.4% of the margin left; 3.54m is under it: 0. */
  const tr = sTr.mgrTgTrack({ measure_kind: 'level', direction: 'up', baseline: 29070000, aim: 10000000, actual: 3540000, pace: { expected: 10000000 } }, 20000000, null);
  eq([tr.hold, tr.now, tr.pace, Math.round(tr.land * 10) / 10], [true, 0, null, 52.4], 'a hold is drawn as the margin over its line, with no road to tick');
}

/* ---------- 16c. a cash floor against its month -------------------------- */
{
  /* Floor 10.00m to 31 Oct (its month opens 2 Oct). The books: 2 Oct 3.54m,
     3-6 Oct 30m. The committed line: 7 Oct 38.3m, 22 Oct 9.59m, 31 Oct 7.48m. */
  const cash = { '2026-10-02': 3540000 };
  const mk = (walk) => scope({ shCashAt: (d) => cash[d] || 30000000, mgrCashWalk: () => ({ days: walk }),
    data: { savedQuotes: [{ date: '2025-01-01' }], cashTxns: [], stockLog: [], customers: [], staff: [] } });
  const walk = [{ date: '2026-10-07', committed: 38300000 }, { date: '2026-10-22', committed: 9590000 }, { date: '2026-10-31', committed: 7480000 },
    { date: '2026-11-05', committed: 3150000 }];
  const x = { finished: false, metric: 'lowest_cash', aim: 10000000, to: '2026-10-31' };
  const b = mk(walk).mgrTgBreak(x);
  eq([b.low, b.lowOn, b.lowBooks, b.breaksOn, b.broke, b.through, b.partial], [3540000, '2026-10-02', true, '2026-10-02', true, '2026-10-31', false],
    'the books already show 3.54m on 2 Oct, inside its month: broken, from the books — not a figure of the committed line');
  delete cash['2026-10-02'];
  const c = mk(walk).mgrTgBreak(x);
  eq([c.low, c.lowOn, c.lowBooks, c.breaksOn, c.broke], [7480000, '2026-10-31', false, '2026-10-22', false],
    'with the books above it, the committed line goes under 10.00m on 22 Oct and lows at 7.48m on 31 Oct; 5 Nov is past the deadline');
  eq(mk([]).mgrTgBreak(x), null, 'no committed line, no reading of the days ahead');
  eq(mk(walk).mgrTgBreak({ ...x, metric: 'collections' }), null, 'only the lowest cash is read against the line');
}

/* ---------- 17. the owner’s own target is written as it was set --------- */
(async () => {
  const written = [];
  const toasts = [];
  const M = { debtor_days: { label: 'Debtor days', unit: 'days', kind: 'level', direction: 'down', measure: () => 35.2, at: () => 35.2 },
    sales: { label: 'Sales', unit: 'ugx', kind: 'flow', direction: 'up', measure: (f, to) => (f === '2026-09-12' && to === '2026-10-06' ? 2500 : -1) } };
  const { managerSetOwnerTarget } = compileScope([extractFunction(src, 'managerSetOwnerTarget', 'index.html')], {
    MANAGER_METRICS: M, todayISO: () => TODAY, anShiftDate: shift, toast: (m) => toasts.push(m), renderManager: () => {},
    data: { staff: [{ id: 'ST001', name: 'Joan Nakato' }] },
    mgrNoteInsert: async (kind, body, status) => { written.push({ kind, body, status }); return { ok: true, row: { id: 9 } }; },
    Date, Math, Number, String, Array, Promise,
  }, ['managerSetOwnerTarget']);

  const r = await managerSetOwnerTarget({ metric: 'debtor_days', aim: 30, to: '2026-10-31', owner: 'ST001',
    parts: [{ label: 'At the rate of the last 25 days', amount: 33.4 }, { label: 'Chase Kato', amount: 6, adds: true }],
    set: { choice: 'stretch', p50: 34, p75: 30, p90: 25, periods: 5, odds: { k: 2, n: 5 } } });
  const w = written[0];
  eq([r.ok, w.kind, w.status], [true, 'target', 'open'], 'one tap writes one open target row');
  eq([w.body.from, w.body.to, w.body.baseline, w.body.aim, w.body.unit, w.body.owner, w.body.source],
    ['2026-10-07', '2026-10-31', 35, 30, 'days', 'ST001', 'owner'], 'with its deadline, its owner, its unit and where it stood today');
  /* 25 days from 35 to 30: Mondays 12, 19, 26 Oct are days 5, 12, 19 ->
     35 - 5*6/25 = 33.8 -> 34; 35 - 5*13/25 = 32.4 -> 32; 35 - 5*20/25 = 31; 31 Oct 30. */
  eq(w.body.checkpoints, [{ on: '2026-10-12', value: 34 }, { on: '2026-10-19', value: 32 }, { on: '2026-10-26', value: 31 }, { on: '2026-10-31', value: 30 }],
    'its checkpoints: every Monday on the road and the deadline');
  eq(w.body.parts.map((p) => [p.amount, p.adds]), [[33, false], [6, true]], 'the path it was set with, what the books do apart from what a move adds');
  eq(w.body.set, { choice: 'stretch', p50: 34, p75: 30, p90: 25, periods: 5, odds: null },
    'and what the composer showed — the odds kept only from six periods up');

  written.length = 0;
  await managerSetOwnerTarget({ metric: 'sales', aim: 3000, to: '2026-10-31', owner: 'you' });
  eq([written[0].body.baseline, written[0].body.checkpoints[0]], [2500, { on: '2026-10-12', value: 720 }],
    'a flow starts from what the last 25 days earned and its road from nothing (3000*6/25 = 720)');

  written.length = 0;
  const refusals = [
    await managerSetOwnerTarget({ metric: 'vibes', aim: 1, to: '2026-10-31' }),
    await managerSetOwnerTarget({ metric: 'sales', aim: 1, to: '2026-10-07' }),
    await managerSetOwnerTarget({ metric: 'sales', to: '2026-10-31' }),
    await managerSetOwnerTarget({ metric: 'sales', aim: 1, to: '2026-10-31', owner: 'ST999' }),
  ];
  t.check(refusals.every((x) => x.ok === false) && written.length === 0 && toasts.length >= 4,
    'an unmeasurable metric, a deadline not after today, no aim, or an owner not on the staff list writes nothing and says why');
  t.check(!/update\(|insert\(/.test(extractFunction(src, 'managerSetOwnerTarget', 'index.html')),
    'it writes through the journal’s one insert, which names a refused write');
})().then(() => { process.exit(t.done() ? 1 : 0); })
  .catch((e) => { console.error(e); process.exit(1); });
