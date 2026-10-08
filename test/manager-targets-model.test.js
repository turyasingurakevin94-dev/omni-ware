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
  'mgrTgPerson', 'mgrTgBandLine', 'mgrTgFinishedLine', 'mgrTgDeadStockAt', 'mgrNavCountTargets', 'mgrTgBreak', 'mgrTgCashOn',
  'mgrTgCashLowOver', 'mgrTgFloorRead', 'mgrTgWaFrom', 'mgrTgVerdict', 'mgrTgComposeModel', 'mgrTgComposeSay',
  'mgrTgRunModel', 'mgrTgFinishedModel', 'mgrTgAbove90', 'mgrTgMetOn', 'mgrTgMondays', 'mgrTgPlanMoves', 'mgrTgTodayLine', 'mgrTgLower',
  'mgrTgDefaultBy', 'mgrTgComposerHTML', 'mgrTgAvHTML', 'mgrTgAskText'];
/* The writers' slot rule, compiled with what it reads. */
const SLOT = [extractDeclaration(src, 'MGR_TG_MAX_RUNNING', 'index.html'), extractFunction(src, 'mgrTgSlotRefusal', 'index.html'),
  extractFunction(src, 'mgrTgLower', 'index.html')];
const DECLS = ['MGR_TG_MIN_ODDS', 'MGR_TG_MIN_CHOICES', 'MGR_TG_PERIODS', 'MGR_TG_RISK', 'MGR_TG_MAX_RUNNING', 'MGR_TG_GLYPH',
  'mgrTgMemoSig', 'mgrTgMemoAt', 'mgrTgMemoMap', 'mgrTgBetter', 'mgrTgDay', 'MGR_TG_ORDER', 'MGR_TG_STATE_WORD'];

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
  /* 999,600 rounds to 1,000 thousands: that is a million, never "1000k". */
  eq(s.mgrTgFig('ugx', 999600), '1.00m', 'rounded first, then scaled: 999,600 is 1.00m');
  eq(s.mgrTgFig('ugx', 999499), '999k', 'and 999,499 is still 999k');
  eq(s.mgrTgFig('ugx', 999.6), '1k', 'and 999.6 shillings is 1k, never "1000"');
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
     24 days to 31 Oct = 81 - 5/25*24 = 76.2, rounded as its aims are: 76. */
  const l = s.mgrTgOutlook('stock_days', TODAY, '2026-10-31');
  eq(l.projected, 76, 'a level moves on at the rate it moved over the last 25 days, rounded as the aims are');
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
  /* A line to hold: cash never under 10m, at 20m today; at this rate it
     ends at 8m -- across the line before the deadline: At risk. Ending at
     12m it is held: On track. Under the line it is Off track. */
  eq(s.mgrTgState({ finished: false, hold: true, direction: 'up', aim: 10, actual: 20, pace: { on_course: true, behind_by: 0, at_this_rate: 8 } }).key, 'risk',
    'a line held today that crosses at this rate is At risk');
  eq(s.mgrTgState({ finished: false, hold: true, direction: 'up', aim: 10, actual: 20, pace: { on_course: true, behind_by: 0, at_this_rate: 12 } }).key, 'on',
    'held, and staying held, is On track');
  eq(s.mgrTgState({ finished: false, hold: true, direction: 'up', aim: 10, actual: 4, pace: { on_course: false, behind_by: 6, at_this_rate: 2 } }).key, 'off',
    'crossed is Off track');
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
     Owners: 4 with nobody named, 3 missed; 2 named, 0 missed -- WAS a
     rule; NOW no rule is counted about owners: every target is taken on
     with one, and the weekly rows from before the app asked never had
     the chance to name anybody.
     Moves: 2 unlinked both missed vs 1 linked met: a rule.
     Mondays: 1 behind twice — too few: no rule. */
  const rows = [
    R(false, { above90: true }), R(false, { above90: true, linked: false }), R(true, { above90: true, owner: 'you', linked: true }),
    R(false, { linked: false, behindTwo: true }), R(true, { owner: 'ST001' }), R(null, { above90: true }),
  ];
  const rules = s.mgrTgLearned(rows);
  eq(rules.map((r) => r.id), ['above90', 'moves'], 'the rules the counts support, and only those — none blames a missing owner the app never asked for');
  eq(rules.map((r) => r.k + '/' + r.n), ['2/3', '2/2'], 'each is a count of what finished — a target with no known end counts for nothing');
  t.check(/2 of 3 targets set at or above the 90th percentile/.test(rules[0].line), 'said as a count');
  t.check(/2 of 2 targets with no move aimed at them were missed, against 0 of 1 with one/.test(rules[1].line), 'against the other side');
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
  eq(s.mgrTgPerson(null).name, 'No owner named', 'a weekly target from before owners were asked names nobody, and says so');
  /* Met 4 days early: crossed on 27 Sep, ended 1 Oct. */
  eq(s.mgrTgFinishedLine({ x: { aim: 3100000, actual: 3200000, to: '2026-10-01', owner: 'you' }, m: { unit: 'ugx' }, met: true, metOn: '2026-09-27' }),
    'reached 3.20m, 4 days early', 'met, and how early');
  /* Missed 22.0% by 0.9 pts, no move aimed at it. WAS also "nobody named
     as its owner"; NOW not said -- the app took weekly targets on without
     asking, so it is not the shop's fact to be told. */
  eq(s.mgrTgFinishedLine({ x: { aim: 22, actual: 21.1, to: '2026-08-31' }, m: { unit: 'pct' }, met: false, linked: false }),
    'missed by 0.9 pts — ended at 21.1% · no move aimed at it', 'missed, by how much, and the fact the books hold');
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

/* ---------- 14. the nav: what is running, and the Off track --------------- */
{
  const s = scope({});
  const score = { targets: [
    { finished: false, direction: 'down', aim: 22, actual: 35, pace: { on_course: false, behind_by: 11.094 } },   // off
    { finished: false, direction: 'up', aim: 4400000, actual: 1030000, pace: { on_course: false, behind_by: 856000 } }, // at risk
    { finished: true, met: true, actual: 1, aim: 1 } ], proposed: [{ id: 1 }] };
  /* WAS: running + proposed = 3. NOW the canvas's count: 2 running. */
  eq(s.mgrNavCountTargets({ score }), { n: 2, note: '<b>1 target</b> off track' },
    '2 running = 2 (the proposal is not a running target); only the one Off track by the rule is named, not the one at risk');
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

/* ---------- 16c. a cash floor over its own days ------------------------- */
{
  /* The books: cash 30m every day but 2 Oct (3.54m). The committed line
     from today (7 Oct): 38.3m, 22 Oct 9.59m, 31 Oct 7.48m, 5 Nov 3.15m,
     and it stops on 6 Nov (37.0m). */
  const cash = { '2026-10-02': 3540000 };
  const mk = (walk) => scope({ shCashAt: (d) => (d in cash ? cash[d] : 30000000), mgrCashWalk: () => ({ days: walk }),
    data: { savedQuotes: [{ date: '2025-01-01' }], cashTxns: [], stockLog: [], customers: [], staff: [] } });
  const walk = [{ date: '2026-10-07', committed: 38300000 }, { date: '2026-10-22', committed: 9590000 }, { date: '2026-10-31', committed: 7480000 },
    { date: '2026-11-05', committed: 3150000 }, { date: '2026-11-06', committed: 37000000 }];
  /* Floor 10.00m from 1 Oct to 31 Oct: the books' 2 Oct (3.54m) is inside
     its days -- broken, from the books. */
  const b = mk(walk).mgrTgFloorRead('2026-10-01', '2026-10-31', 10000000);
  eq([b.low, b.lowOn, b.lowBooks, b.breaksOn, b.broke, b.through, b.partial], [3540000, '2026-10-02', true, '2026-10-02', true, '2026-10-31', false],
    'the books already show 3.54m on 2 Oct, inside its days: broken, from the books — not a figure of the committed line');
  /* The same floor set on 3 Oct: 2 Oct is not one of its days. The line
     goes under 10.00m on 22 Oct and is lowest on 31 Oct (7.48m); 5 Nov is
     past its deadline. */
  const c = mk(walk).mgrTgFloorRead('2026-10-03', '2026-10-31', 10000000);
  eq([c.low, c.lowOn, c.lowBooks, c.breaksOn, c.broke], [7480000, '2026-10-31', false, '2026-10-22', false],
    'a day before its first day is not its business; ahead, the committed line goes under on 22 Oct');
  /* "Cash never under 3.40m" from 7 Oct to 31 Dec: judged over all its
     days, not the 30 to its deadline -- 3.15m on 5 Nov breaks it -- and
     the line stops on 6 Nov, short of 31 Dec. */
  const d = mk(walk).mgrTgFloorRead('2026-10-07', '2026-12-31', 3400000);
  eq([d.low, d.lowOn, d.breaksOn, d.broke, d.through, d.partial], [3150000, '2026-11-05', '2026-11-05', false, '2026-11-06', true],
    'a floor to 31 Dec is judged on every day of it the line reaches, and says where the line stops');
  eq(mk([]).mgrTgFloorRead('2026-10-01', '2026-10-31', 10000000), null, 'no committed line, no reading of the days ahead');
  eq(mk(walk).mgrTgFloorRead('2026-09-01', '2026-09-30', 10000000), null, 'and a floor that has ended is read from the books alone, not here');
  /* The row reads what the scoreboard read (managerScoreProgress's pace). */
  const s2 = scope({});
  const pace = { at_this_rate: 3540000, low_on: '2026-10-02', low_books: true, breaks_on: '2026-10-02', broke: true, line_to: '2026-10-31' };
  eq(s2.mgrTgBreak({ finished: false, metric: 'lowest_cash', to: '2026-10-31', pace }),
    { low: 3540000, lowOn: '2026-10-02', lowBooks: true, breaksOn: '2026-10-02', broke: true, through: '2026-10-31', partial: false },
    'the row’s break is the scoreboard’s own reading, never a second derivation');
  eq(s2.mgrTgBreak({ finished: false, metric: 'collections', to: '2026-10-31', pace }), null, 'only the lowest cash is read against the line');
  eq(s2.mgrTgBreak({ finished: false, metric: 'lowest_cash', to: '2026-10-31', pace: { at_this_rate: 1 } }), null, 'and only when there was a line to read');
}

/* ---------- 16d. where a projection can go ------------------------------- */
{
  const s = scope({});
  eq(s.mgrTgClamp({ direction: 'down', unit: 'ugx' }, -237500), 0, 'money owed carried down past nothing lands at nothing');
  eq(s.mgrTgClamp({ direction: 'up', unit: 'count' }, -3), 0, 'a count is never below nothing');
  eq(s.mgrTgClamp({ direction: 'up', unit: 'pct' }, 104), 100, 'a share is never above the whole');
  eq(s.mgrTgClamp({ direction: 'up', unit: 'ugx' }, -30350000), 0, 'cash is never below nothing — the old composer said −30.35m');
  eq(s.mgrTgClamp({ direction: 'up', unit: 'ugx', signed: true }, -933), -933, 'net profit, signed, can be a loss');
  eq(s.mgrTgClamp({ direction: 'up', unit: 'ugx' }, null), null, 'not known stays not known');
}

/* ---------- 18. the readers, on a small book ----------------------------- */
{
  const day = (iso) => Date.parse(iso + 'T00:00:00Z');
  const inRange = (d, a, b) => d >= a && d <= b;
  /* Net profit: 100 a day on every whole day; today (7 Oct) is half done
     -- rent and wages against two sales -- at −500. */
  const np = (d) => (d === TODAY ? -500 : 100);
  /* Invoices: 20 Sep 1,000 sold for 200 profit; 6 Oct 1,000 for 100;
     today 500 for −50. */
  const inv = [{ date: '2026-09-20', sales: 1000, profit: 200 }, { date: '2026-10-06', sales: 1000, profit: 100 }, { date: TODAY, sales: 500, profit: -50 }];
  /* WhatsApp: the first chat order on 9 Jun; then 10 Sep, 20 Sep (voided),
     6 Oct and today. The books (a cash entry) start on 1 Jan. */
  const quotes = [{ date: '2026-06-09', originWa: true }, { date: '2026-09-10', originWa: true }, { date: '2026-09-20', originWa: true, voided: true },
    { date: '2026-10-06', originWa: true }, { date: TODAY, originWa: true }, { date: '2026-05-01' }];
  /* Cash: 5,000,000 a day, 1,200,000 on 15 Sep and 2,000,000 on 3 Oct. */
  const cashOn = { '2026-09-15': 1200000, '2026-10-03': 2000000 };
  const growthAsked = [];
  const env = {
    data: { savedQuotes: quotes, cashTxns: [{ date: '2026-01-01' }], stockLog: [], customers: [], staff: [] },
    incomeStatement: (a, b) => { let n = 0; for (let d = a; d <= b; d = shift(d, 1)) n += np(d);
      return { netProfit: n, revenue: inv.filter((x) => inRange(x.date, a, b)).reduce((k, x) => k + x.sales, 0) }; },
    anInvoicesInRange: (a, b) => inv.filter((x) => inRange(x.date, a, b)),
    anOverallTotals: (list) => list.reduce((t, x) => ({ sales: t.sales + x.sales, profit: t.profit + x.profit }), { sales: 0, profit: 0 }),
    mgrDebtorDays: (d) => (d === TODAY ? { days: 35.2 } : d === '2026-09-30' ? { creditSales: 900000, windowDays: 90 } : { creditSales: 0, windowDays: 90 }),
    receivablesAsAt: () => 300000,
    mgrDaysOfStock: (d) => (d === TODAY ? { days: 33.6 } : d === '2026-09-30' ? { cogsPerDay: 100000 } : { cogsPerDay: 0 }),
    stockValueAsAt: () => ({ value: 3300000 }),
    managerGrowthBaseline: (ms) => { growthAsked.push(new Date(ms).toISOString()); return { quotes: { rate: ms > day('2026-09-01') ? 0.425 : null } }; },
    shCashAt: (d) => (d in cashOn ? cashOn[d] : 5000000),
    mgrCashWalk: () => ({ days: [{ date: TODAY, committed: 4000000 }, { date: '2026-10-20', committed: 2200000 }, { date: '2026-10-31', committed: 3000000 }] }),
  };
  const sc = compileScope([
    ...DECLS.map((n) => extractDeclaration(src, n, 'index.html')),
    ...FNS.map((n) => extractFunction(src, n, 'index.html')),
    extractDeclaration(src, 'MANAGER_METRICS', 'index.html'),
    'function metrics(){ return MANAGER_METRICS; }',
  ], {
    todayISO: () => TODAY, anShiftDate: shift, waDaysBetween: between, periodOf: (iso) => String(iso).slice(0, 7),
    periodEndDate: periodEnd, periodShift, mgrRenderGen: 1, esc: (s) => String(s),
    Date, Math, Number, String, Array, Object, Map, Set, JSON, ...env,
  }, [...FNS, 'metrics']);
  const M = sc.metrics();
  /* net profit: "now" is the 30 days to yesterday, 8 Sep–6 Oct... 30 whole
     days at 100 = 3,000; the 30 days to today would be 29*100 − 500 = 2,400. */
  eq(M.net_profit.measure(), 3000, 'net profit now is the 30 whole days to yesterday (3,000), never a half-day’s rent (2,400)');
  eq(M.net_profit.at(TODAY), 2400, 'while a reading at a day is that day’s own 30 days');
  /* 3 Jul–1 Aug holds no invoice (revenue 0): the Simulator reads that as
     "not known — nothing invoiced in 30 days", and so does the target --
     never the rent alone as a month's profit, never 0. */
  eq(M.net_profit.at('2026-08-01'), null, 'thirty days with nothing invoiced: net profit not known, as the Simulator says');
  /* margin: 7 Sep–6 Oct sold 2,000 for 300: 15%; today's −50 on 500 is not in it. */
  near(M.margin_pct.measure(), 15, 'margin now: 300 of 2,000 sold over the 30 days to yesterday = 15%');
  eq(M.margin_pct.at('2026-08-01'), null, 'nothing sold in the window: not known, never 0%');
  /* debtor days on 30 Sep: owed 300,000 over credit sales 900,000/90 = 10,000 a day = 30 days. */
  near(M.debtor_days.at('2026-09-30'), 30, 'debtor days on a past day: owed over credit sales a day = 300,000 / 10,000 = 30');
  eq(M.debtor_days.at('2026-09-01'), null, 'no credit sales in the window: not known');
  eq(M.debtor_days.measure(), 35.2, 'today, the shared definition (mgrDebtorDays, Q18)');
  /* stock days on 30 Sep: shelf 3,300,000 over cost of sales 100,000 a day = 33. */
  near(M.stock_days.at('2026-09-30'), 33, 'stock days on a past day: shelf over cost sold a day = 33');
  eq(M.stock_days.at('2026-09-01'), null, 'nothing sold at cost: not known');
  /* quotes won: 42.5%, read to the end of yesterday. */
  near(M.quotes_won_pct.measure(), 42.5, 'quotes won now: the growth reading’s rate, ×100');
  eq(growthAsked[growthAsked.length - 1], '2026-10-06T23:59:59.000Z', 'read at the end of yesterday, not mid-morning');
  eq(M.quotes_won_pct.at('2026-08-01'), null, 'no rate: not known');
  /* WhatsApp: first chat order 9 Jun. A window starting before it is not
     recorded. 7 Sep–6 Oct holds 10 Sep and 6 Oct (20 Sep was voided) = 2;
     today's order waits for tomorrow. */
  eq(sc.mgrTgWaFrom(), '2026-06-09', 'the first order the books hold as born in a chat');
  eq(M.wa_orders.at('2026-07-01'), null, 'a month that starts before the first chat order is not recorded — never 0');
  eq(M.wa_orders.at('2026-07-08'), 1, 'the first whole month from it counts its orders (9 Jun)');
  eq(M.wa_orders.measure(), 2, 'now: the 30 days to yesterday, voided left out');
  /* Past 25-day periods ending 6 Oct: 6 Oct, 11 Sep, 17 Aug, 23 Jul read
     (2, 1, 0, 0 -- zeros after the first order are real); 28 Jun, 3 Jun,
     9 May, 14 Apr, 20 Mar, 23 Feb start before 9 Jun: unknown (6); 29 Jan's
     30-day window (from 31 Dec) is before the books. */
  const wp = sc.mgrTgPeriods('wa_orders', 25, '2026-10-06');
  eq([wp.values.map((x) => x.v), wp.unknown], [[2, 1, 0, 0], 6], 'periods before WhatsApp was recorded are unknown, never months of none');
  /* Lowest cash over a run of days: 1–31 Oct read to today: 2,000,000 (3 Oct);
     September: 1,200,000 (15 Sep). */
  eq(M.lowest_cash.measure('2026-10-01', '2026-10-31'), 2000000, 'the lowest over its own days, to today');
  eq(M.lowest_cash.measure('2026-09-01', '2026-09-30'), 1200000, 'a past period over its days');
  eq(M.lowest_cash.at('2026-09-20'), 1200000, 'and over the 30 days to a day');
  /* Floor 2,500,000 from 1 Oct to 31 Oct: books 1–6 Oct low 2,000,000 on
     3 Oct (under: broke); the line from today 4.0m, 2.2m, 3.0m. */
  eq(M.lowest_cash.floor('2026-10-01', '2026-10-31', 2500000), { low: 2000000, lowOn: '2026-10-03', lowBooks: true, breaksOn: '2026-10-03',
    broke: true, through: '2026-10-31', partial: false }, 'the floor reads the books, then the committed line');
  eq(M.lowest_cash.floor(TODAY, '2026-10-31', 2500000).breaksOn, '2026-10-20', 'from today the line goes under 2.5m on 20 Oct');
}

/* ---------- 19. the score: whole days, first days, floors, failures ------- */
{
  const M = {
    sales: { label: 'Sales', unit: 'ugx', kind: 'flow', direction: 'up', measure: (a, b) => (between(a, b < TODAY ? b : TODAY) + 1) * 100 },
    boom: { label: 'Boom', unit: 'days', kind: 'level', direction: 'down', measure: () => { throw new Error('one bad day'); }, at: () => { throw new Error('one bad day'); } },
    cash: { label: 'Lowest cash in a month', unit: 'ugx', kind: 'level', direction: 'up', span: true, measure: () => 6000000,
      floor: () => ({ low: -300, lowOn: '2026-10-20', lowBooks: false, breaksOn: '2026-10-20', broke: false, through: '2026-10-31' }) },
    np: { label: 'Net profit a month', unit: 'ugx', kind: 'level', direction: 'up', signed: true, measure: () => -100 },
  };
  const { managerScoreProgress } = compileScope([extractFunction(src, 'managerScoreProgress', 'index.html')],
    { MANAGER_METRICS: M, todayISO: () => TODAY, Date, Math, Number, String, Array }, ['managerScoreProgress']);
  const bad = managerScoreProgress({ body: { metric: 'boom', aim: 30, baseline: 35, from: '2026-07-01', to: '2026-07-31' } });
  eq([bad.finished, bad.actual, bad.met, bad.pace, bad.error], [true, null, null, null, 'one bad day'],
    'a reading that throws is not known on its own row and says why — it never takes the scoreboard down');
  /* Set this morning by the owner, landing where the composer said (2,500). */
  const first = managerScoreProgress({ body: { metric: 'sales', aim: 3000, from: TODAY, to: '2026-10-31', source: 'owner',
    parts: [{ label: 'At the rate of the last 25 days', amount: 2500, adds: false }] } });
  eq([first.pace.first, first.pace.on_course, first.pace.at_this_rate, first.pace.elapsed_days], [true, true, 2500, 0],
    'its first morning is On track and lands where it was set — never a morning’s takings ×25');
  const weekly = managerScoreProgress({ body: { metric: 'sales', aim: 3000, from: TODAY, to: '2026-10-13' } });
  eq(weekly.pace.at_this_rate, null, 'a weekly one, with no landing of its own, lands nowhere until its first whole day');
  /* From 1 Oct (Thu) to 31 Oct, 31 days: six whole days (1–6 Oct) at 100 = 600; road 3100*6/31 = 600: on course; at this rate 600/(6/31) = 3,100. */
  const flow = managerScoreProgress({ body: { metric: 'sales', aim: 3100, from: '2026-10-01', to: '2026-10-31' } });
  eq([flow.actual, flow.pace.elapsed_days, flow.pace.expected, flow.pace.on_course, flow.pace.at_this_rate], [700, 6, 600, true, 3100],
    'now counts today (700); the road and the rate are whole days to yesterday (600 of 600, landing 3,100)');
  /* A floor: a line to hold, landing on the committed line's low -- clamped at nothing (−300 → 0). */
  const fl = managerScoreProgress({ body: { metric: 'cash', aim: 2000000, baseline: 6000000, from: '2026-10-01', to: '2026-10-31' } });
  eq([fl.hold, fl.pace.expected, fl.pace.on_course, fl.pace.at_this_rate, fl.pace.breaks_on, fl.pace.broke, fl.pace.line_to],
    [true, 2000000, true, 0, '2026-10-20', false, '2026-10-31'], 'a floor lands at the committed line’s low, never below nothing, and names the day it breaks');
  const flBelow = managerScoreProgress({ body: { metric: 'cash', aim: 7000000, baseline: 6000000, from: '2026-10-01', to: '2026-10-31' } });
  eq([flBelow.hold, flBelow.met, flBelow.pct], [true, false, 0], 'a floor set above where cash stood is broken from its first day: a line, not a journey');
  /* Net profit, signed: from 100 to an aim of 200, at −100 after six whole
     days of 31: 100 + (−100 − 100)/(6/31) = 100 − 1,033.3 = −933. */
  const loss = managerScoreProgress({ body: { metric: 'np', aim: 200, baseline: 100, from: '2026-10-01', to: '2026-10-31' } });
  eq(loss.pace.at_this_rate, -933, 'a loss carried forward is a loss — net profit is the one money figure that may go under nothing');
}

/* ---------- 20. one count of what finished, for every surface ------------ */
(async () => {
  const M = {
    debt: { label: 'Money owed to you', unit: 'ugx', kind: 'level', direction: 'down', measure: () => 4, at: (d) => (d === '2026-08-31' ? null : 8) },
    sales: { label: 'Sales', unit: 'ugx', kind: 'flow', direction: 'up', measure: () => 50 },
  };
  /* A running hold (owed 5, kept under 10, at 4: met, not finished); a
     sales week met (50 ≥ 40) and one missed (50 < 60); a debt month whose
     last day the books cannot read (unknown); one met long ago. */
  const rows = [
    { id: 5, status: 'open', date: '2026-10-01', body: { metric: 'debt', aim: 10, baseline: 5, from: '2026-10-01', to: '2026-10-31' } },
    { id: 4, status: 'open', date: '2026-09-28', body: { metric: 'sales', aim: 40, from: '2026-09-28', to: '2026-10-04' } },
    { id: 3, status: 'open', date: '2026-09-21', body: { metric: 'sales', aim: 60, from: '2026-09-21', to: '2026-09-27' } },
    { id: 2, status: 'open', date: '2026-08-01', body: { metric: 'debt', aim: 10, baseline: 12, from: '2026-08-01', to: '2026-08-31' } },
    { id: 1, status: 'open', date: '2026-07-01', body: { metric: 'debt', aim: 10, baseline: 12, from: '2026-07-01', to: '2026-07-31' } },
  ];
  const q = { select: () => q, eq: () => q, order: () => q, limit: () => Promise.resolve({ data: rows, error: null }) };
  const { managerScoreboard } = compileScope([extractFunction(src, 'managerScoreProgress', 'index.html'), extractFunction(src, 'managerScoreboard', 'index.html')],
    { MANAGER_METRICS: M, todayISO: () => TODAY, anShiftDate: shift, managerNotesTable: true, currentShopId: 's', sb: { from: () => q },
      Date, Math, Number, String, Array, Map, Set, Promise }, ['managerScoreboard']);
  const sb = await managerScoreboard();
  eq(sb.tally, { running: 1, met: 2, missed: 1, unknown: 1 },
    'met is a finished met, missed a finished miss; a running hold is not met yet and an unknown end is neither');
  /* The Targets band counts the same: finished, met === true over met !== null. */
  const s = scope({});
  const fin = sb.targets.filter((x) => x.finished).map((x) => ({ x, met: x.met }));
  const known = fin.filter((r) => r.met === true || r.met === false);
  eq([known.filter((r) => r.met).length, known.length], [sb.tally.met, sb.tally.met + sb.tally.missed],
    'the band’s k of n and the tally agree: 2 of 3, the unknown in neither');
  eq(s.mgrTgState(sb.targets.find((x) => x.id === 2)).key, 'unknown', 'and the unknown end is called nothing');
  /* The week's view: running, and finished on or after 30 Sep (7 days back):
     only id 4 (ended 4 Oct) of the finished -- and no checkpoint lists. */
  eq(sb.week.map((x) => x.id), [5, 4], 'the meeting and the review are handed the week, not the whole record');
  t.check(sb.week.every((x) => !('checkpoints' in x)) && 'checkpoints' in sb.targets[0], 'without the screen’s checkpoint lists');
})().catch((e) => { t.check(false, 'the tally test threw: ' + e.message); });

/* ---------- 21. the row's model: one state, the floor, the plan --------- */
{
  const s = scope({ MANAGER_METRICS: {
    lowest_cash: { label: 'Lowest cash in a month', unit: 'ugx', kind: 'level', direction: 'up', span: true, measure: () => null },
    debtors_total: { label: 'Money owed to you', unit: 'ugx', kind: 'level', direction: 'down', measure: () => null, at: () => null },
  } });
  const plan = { on: TODAY, moves: [{ id: 7, num: '01', status: 'open', title: 'Pay Simba after Kato pays', target: { metric: 'lowest_cash' }, effect: 1000000 }] };
  const broke = { id: 1, metric: 'lowest_cash', finished: false, direction: 'up', measure_kind: 'level', hold: true, aim: 10000000, baseline: 29070000,
    actual: 3540000, from: '2026-10-01', to: '2026-10-31', days_left: 24,
    pace: { on_course: false, behind_by: 6460000, expected: 10000000, at_this_rate: 3540000, low_on: '2026-10-02', low_books: true, breaks_on: '2026-10-02', broke: true, line_to: '2026-10-31' } };
  const r = s.mgrTgRunModel(broke, plan);
  eq([r.key, r.brk.broke, r.landsAlone, r.land, r.planLand], ['off', true, false, 3540000, 4540000],
    'a floor the books broke is Off track, lands nowhere on its own, and the plan’s sizing is added to its low');
  /* (The weekday's comma is the locale's: Node prints "Fri 2 Oct", a browser "Fri, 2 Oct".) */
  t.check(/^Two running\. One lands at this rate on its own — and cash already went under 10\.00m on Fri,? 2 Oct\.$/.test(s.mgrTgBandLine([r, { landsAlone: true }])),
    'the band does not count a broken floor among those that "need a move": this time cannot hold it');
  /* A floor held, a line ahead that stays above it: On track -- and the nav
     says the same (one derivation). The old nav read the trailing 30-day
     low, which dipped before the target began, and called it off track. */
  const held = { ...broke, id: 2, actual: 2600000, aim: 2000000, baseline: 2600000,
    pace: { on_course: true, behind_by: 0, expected: 2000000, at_this_rate: 2600000, low_on: '2026-10-07', low_books: false, breaks_on: null, broke: false, line_to: '2026-10-31' } };
  eq(s.mgrTgRunModel(held, { moves: [] }).key, 'on', 'held all through on the books and the line: On track');
  eq(s.mgrNavCountTargets({ score: { targets: [held, broke], proposed: [] } }), { n: 2, note: '<b>1 target</b> off track' },
    'the nav counts by the same state the rows are coloured by');
  /* Money owed carried down past nothing lands at nothing. */
  const debt = { id: 3, metric: 'debtors_total', finished: false, direction: 'down', measure_kind: 'level', aim: 1000000, baseline: 2000000,
    actual: 1500000, from: '2026-10-01', to: '2026-10-31', days_left: 24, pace: { on_course: true, behind_by: 0, expected: 1806452, at_this_rate: -237500 } };
  eq(s.mgrTgRunModel(debt, { moves: [] }).land, 0, '"at this rate" stops at nothing: money owed cannot go below it');
}

/* ---------- 22. my read's word comes from the path ----------------------- */
{
  const s = scope({});
  const up = { kind: 'flow', direction: 'up' }, lvl = { kind: 'level', direction: 'down' };
  eq(s.mgrTgVerdict(up, 100, 90, 120, { reached: true, end: 120 }).word, 'Likely', 'the books alone reach it: Likely');
  eq(s.mgrTgVerdict(up, 100, 90, 80, { reached: true, end: 105 }).word, 'Reachable — with the moves below', 'the moves close the rest: Reachable');
  /* A flow from nothing: 90 of 100 after every move, 10 short of 100 = 10%: A stretch. */
  eq(s.mgrTgVerdict(up, 100, 80, 90, { reached: false, end: 90 }), { word: 'A stretch', tone: 'warn', share: 0.1 }, 'short by a tenth: A stretch');
  /* Debtor days 35 now, aim 30, landing 33: 3 short of the 5 to travel = 60%: Not by then. */
  eq(s.mgrTgVerdict(lvl, 30, 35, 33, { reached: false, end: 33 }).word, 'Not by then', 'short by more than a third: Not by then');
  /* Exactly a third: 20 now, aim 26 (up level), end 24 -> 2 of 6. */
  eq(s.mgrTgVerdict({ kind: 'level', direction: 'up' }, 26, 20, 24, { reached: false, end: 24 }).word, 'Not by then', 'a third exactly is Not by then');
  eq(s.mgrTgVerdict(up, null, 1, 1, null).word, 'Cannot be read yet', 'no aim, no word');
}

/* ---------- 23. the composer ---------------------------------------------- */
{
  /* Seven past 25-day periods (books from 1 Apr), newest first, ending 6 Oct,
     11 Sep, 17 Aug, 23 Jul, 28 Jun, 3 Jun, 9 May. */
  const ends = ['2026-10-06', '2026-09-11', '2026-08-17', '2026-07-23', '2026-06-28', '2026-06-03', '2026-05-09'];
  const lows = [8, 12, 4, 10, 6, 14, 9].map((v) => v * 1e6);
  const waVals = [8, 0, 0, 0, 0, 12, 14];
  let cashToday = 10e6;
  const M = {
    lowest_cash: { label: 'Lowest cash in a month', unit: 'ugx', kind: 'level', direction: 'up', span: true,
      measure: (a, b) => (a === TODAY && b === TODAY ? cashToday : lows[ends.indexOf(b)]),
      floor: () => ({ low: -2e6, lowOn: '2026-10-20', lowBooks: false, breaksOn: null, broke: false, through: '2026-10-31', partial: false }) },
    wa_orders: { label: 'Orders', unit: 'count', kind: 'flow', direction: 'up', measure: (a, b) => waVals[ends.indexOf(b)] },
  };
  const s = scope({ MANAGER_METRICS: M,
    data: { savedQuotes: [], cashTxns: [{ date: '2026-04-01' }], stockLog: [], customers: [], staff: [{ id: 'ST001', name: 'Joan Nakato' }] } });
  const env = { runningMetrics: [], runningCount: 0, plan: { moves: [] }, finished: [], rules: [] };
  /* Lows sorted 4,6,8,9,10,12,14 (m): safe the median 9; stretch at 4.5 =
     10 + 2*0.5 = 11; bold at 5.4 = 12 + 2*0.4 = 12.8. Cash today is 10m:
     11m and 12.8m are already under today -- not offered; stretch falls
     back to safe, 9m. Odds: 12, 10, 14, 9 reached 9m: 4 of 7 = 57%. */
  const c = s.mgrTgComposeModel({ metric: 'lowest_cash', choice: 'stretch', by: 0 }, env);
  eq([c.choices.safe, c.choices.stretch, c.choices.bold, c.blocked, c.choice, c.aim], [9e6, 11e6, 12.8e6, { stretch: true, bold: true }, 'safe', 9e6],
    'a floor above today’s cash is not offered: it would break on its first day');
  eq([c.odds.k, c.odds.n, c.odds.pct], [4, 7, 57], 'the odds count the past periods whose low held 9m');
  eq([c.out.projected, c.out.method], [0, 'on the committed line'], 'it lands on the committed line’s low — and never below nothing (the line said −2m)');
  eq([c.verdict.word, c.canSet], ['Not by then', true], 'short by 9m of the 1m it had to spare: Not by then — but it can still be set');
  eq(s.mgrTgComposeSay(c), 'With no move aimed at it yet, cash dips to 0 — under 9.00m before 31 Oct, on the committed line.',
    'said in figures it derived, with no lower floor to offer — and no later deadline, which only gives a floor more days to break');
  cashToday = 3e6;
  const none = s.mgrTgComposeModel({ metric: 'lowest_cash', choice: 'safe', by: 0 }, env);
  eq([none.aim, none.canSet, none.verdict.word], [null, false, 'Under every floor today'], 'cash under every floor on offer: nothing can be set, and it says so');
  t.check(/^Cash stands at 3\.00m today — already under every floor/.test(s.mgrTgComposeSay(none)), 'in figures');
  /* Orders, a flow: newest 8, then 0,0,0,0 (real zeros), 12, 14 -> sorted
     0,0,0,0,8,12,14: safe 0, stretch at 4.5 = 8 + 4*0.5 = 10, bold at 5.4
     = 12 + 2*0.4 = 12.8 -> 13. Lands at 8 (the last 25 days). */
  const w = s.mgrTgComposeModel({ metric: 'wa_orders', choice: 'stretch', by: 0 }, env);
  eq([w.choices.safe, w.aim, w.out.projected], [0, 10, 8], 'a flow’s choices and where its last period lands it');
  t.check(!/I’d set 0/.test(s.mgrTgComposeSay(w)) && /I’d give it until 30 Nov\.$/.test(s.mgrTgComposeSay(w)),
    'a lower value of nothing is never suggested — the later deadline is');
  const wb = s.mgrTgComposeModel({ metric: 'wa_orders', choice: 'bold', by: 0 }, env);
  t.check(/I’d set 10, or give it until 30 Nov\.$/.test(s.mgrTgComposeSay(wb)), 'a lower value still above where the books land it is');
  /* The 90th-percentile rule warns; four running holds the composer. */
  const warned = s.mgrTgComposeModel({ metric: 'wa_orders', choice: 'bold', by: 0 }, { ...env, rules: [{ id: 'above90', k: 3, n: 3 }] });
  eq(warned.warn, ['At or past your 90th percentile — 3 of 3 aims like that were missed.'], 'the composer warns against what history taught');
  const full = s.mgrTgComposeModel({ metric: 'wa_orders', choice: 'stretch', by: 0 }, { ...env, runningCount: 4 });
  eq([full.full, full.canSet], [true, false], 'four running: nothing more can be set');
  eq(s.mgrTgComposeModel({ metric: 'wa_orders', by: 0 }, { ...env, runningMetrics: ['wa_orders'] }).metric, 'lowest_cash', 'a measure already running is not offered');
}

/* ---------- 23b. the final review: first days, today's cash, the composer - */
{
  /* A FIRST DAY IS JUDGED BY WHERE IT WAS SET TO LAND. Debtor days under
     22, standing at 47, set to land at 47 (the composer said "Not by
     then"): 25 still to go, 25 short = 100% -> Off track, never On track. */
  const s = scope({ MANAGER_METRICS: { debtor_days: { label: 'Debtor days', unit: 'days', kind: 'level', direction: 'down' } } });
  const first = (land, actual) => ({ id: 7, metric: 'debtor_days', label: 'Debtor days', unit: 'days', finished: false, direction: 'down', measure_kind: 'level',
    aim: 22, baseline: actual, actual, from: TODAY, to: '2026-11-30', days_left: 54,
    pace: { elapsed_days: 0, total_days: 55, expected: actual, on_course: true, behind_by: 0, at_this_rate: land, first: true } });
  const off = s.mgrTgState(first(47, 47));
  eq([off.key, off.toGo, off.short, off.share], ['off', 25, 25, 1], 'set today to land at 47 against 22: Off track on its first day');
  /* Standing at 30, landing 24: 8 to go, 2 short = 25% -> At risk. */
  const risk = s.mgrTgState(first(24, 30));
  eq([risk.key, risk.share], ['risk', 0.25], 'landing 2 days short of 8 to go: At risk');
  eq(s.mgrTgState(first(20, 30)).key, 'on', 'landing at or past the aim: On track');
  eq(s.mgrTgState(first(null, 30)).key, 'on', 'no landing saved (a weekly target): On track until the first whole day is read');
  const tl = s.mgrTgTodayLine(first(47, 47));
  t.check(tl.key === 'off' && tl.ok === false && /^Off track — Debtor days under 22: 47 days now\. As set it lands at 47 days by 30 Nov — 25 days short\. Set today — its first whole day is read tomorrow\. 54 days are left\.$/.test(tl.text),
    `Today says the same as the row, with where it was set to land (${tl.text})`);
  const rm = s.mgrTgRunModel(first(47, 47), { moves: [] });
  eq(rm.key, 'off', 'the row is coloured by the same state');
  eq(s.mgrNavCountTargets({ score: { targets: [first(47, 47)], proposed: [] } }).note, '<b>1 target</b> off track', 'and the nav counts it');
}
{
  /* TODAY'S CASH BOOK IS A BOOKS DAY. "Cash never under 45.00m" from 6
     Oct; the cash book closed 6 Oct at 50.00m and stands at 41,792,637
     today (a 5.00m payment this morning); the committed line has 43.00m
     today and 46.00m on 20 Oct. The target's own lowest so far is
     41.79m (today) -- so the floor read must say the books broke it today,
     not that the committed line would. */
  const mkCash = (today) => scope({ shCashAt: (d) => (d === TODAY ? today : 50000000),
    mgrCashWalk: () => ({ days: [{ date: TODAY, committed: 43000000 }, { date: '2026-10-20', committed: 46000000 }] }),
    data: { savedQuotes: [{ date: '2025-01-01' }], cashTxns: [], stockLog: [], customers: [], staff: [] } });
  const s = mkCash(41792637);
  const f = s.mgrTgFloorRead('2026-10-06', '2026-10-31', 45000000);
  eq([f.low, f.lowOn, f.lowBooks, f.breaksOn, f.broke], [41792637, TODAY, true, TODAY, true],
    'today’s cash book under the floor: broken, from the books, today');
  eq(s.mgrTgCashLowOver('2026-10-06', '2026-10-31'), 41792637, 'the same lowest the target reads as its "lowest so far"');
  const st = s.mgrTgState({ finished: false, direction: 'up', aim: 45000000, actual: 41792637, hold: true,
    pace: { at_this_rate: f.low, breaks_on: f.breaksOn, broke: f.broke, line_to: f.through } });
  eq(st.key, 'off', 'so it is Off track (Q37), not At risk with odds beside it');
  /* Above the floor today (46.00m): the books hold, the line (43.00m
     today) would break it -- At risk, as before. */
  const g = mkCash(46000000).mgrTgFloorRead('2026-10-06', '2026-10-31', 45000000);
  eq([g.low, g.lowBooks, g.breaksOn, g.broke], [43000000, false, TODAY, false], 'cash book above it: only the committed line goes under');
}
{
  /* THE COMPOSER, as the review asked. Books from 1 Apr; deadlines from 7
     Oct are 31 Oct (24 days after today), 30 Nov (54) and 31 Dec (85). */
  const ends = ['2026-10-06', '2026-09-11', '2026-08-17', '2026-07-23', '2026-06-28', '2026-06-03', '2026-05-09'];
  const lows = [8, 12, 4, 10, 6, 14, 9].map((v) => v * 1e6);
  let cashToday = 3e6;
  let floor = { amount: 3e6, source: 'set', note: 'the floor you set' };
  const M = {
    lowest_cash: { label: 'Lowest cash in a month', unit: 'ugx', kind: 'level', direction: 'up', span: true, basis: 'b',
      measure: (a, b) => (a === TODAY && b === TODAY ? cashToday : lows[ends.indexOf(b)]),
      floor: () => ({ low: 7480000, lowOn: '2026-10-28', lowBooks: false, breaksOn: null, broke: false, through: '2026-10-31', partial: false }) },
  };
  const s = scope({ MANAGER_METRICS: M, mgrCashFloor: () => floor, waComposeUrl: (p, m) => 'wa:' + m,
    data: { savedQuotes: [], cashTxns: [{ date: '2026-04-01' }], stockLog: [], customers: [], staff: [{ id: 'ST001', name: 'Joan Nakato' }] } });
  const env = { runningMetrics: [], runningCount: 0, plan: { moves: [] }, finished: [], rules: [] };
  /* NOW is the lowest ahead (7.48m on 28 Oct, the committed line), the
     figure the Brief and the Simulator read -- not today's cash (3.00m). */
  const c = s.mgrTgComposeModel({ metric: 'lowest_cash', choice: 'stretch', by: 0 }, env);
  eq([c.out.now, c.out.nowLabel, c.out.cashToday, c.stand], [7480000, 'lowest ahead', 3e6, 3e6], 'a floor’s NOW is the lowest ahead; today’s cash rides beside it');
  /* Past lows 4..14m are all above today's 3.00m: all three blocked. The
     owner's own floor (Q8) is 3.00m, which today's cash stands on: it is
     offered and picked -- the composer is not disabled. Odds: all 7 past
     lows held 3.00m -> 7 of 7 = 100%. */
  eq([c.blocked, (c.floorOpt || {}).value, c.choice, c.aim, c.canSet], [{ safe: true, stretch: true, bold: true }, 3e6, 'floor', 3e6, true],
    'every past floor above today’s cash: the owner’s own floor is offered instead, and can be set');
  eq([(c.odds || {}).k, (c.odds || {}).n, (c.odds || {}).pct], [7, 7, 100], 'its odds are counted like any aim');
  const html = s.mgrTgComposerHTML(c);
  t.check(/<small>your floor<\/small><span class="mgr-tg-fig">3\.00m<\/span>/.test(html) && /<small>lowest ahead<\/small><span class="mgr-tg-fig">7\.48m<\/span>/.test(html),
    'the chips read “your floor 3.00m” and “lowest ahead 7.48m”');
  /* The deadline chips count the days after today, as the rows do. */
  t.check(/<small>24 days<\/small><span>31 Oct<\/span>/.test(html) && /<small>54 days<\/small><span>30 Nov<\/span>/.test(html) && /<small>85 days<\/small><span>31 Dec<\/span>/.test(html),
    'the deadline chips read 24 / 54 / 85 days, as the canvas and the running rows count them');
  t.check(/disabled title="You own it[^"]*">Ask the owner first<\/button>/.test(html), '“Ask the owner first” is drawn while You own it, and says why it waits');
  /* A floor of its own above today's cash is blocked too; with nothing
     left the composer says so. */
  floor = { amount: 5e6, source: 'set' };
  const none = s.mgrTgComposeModel({ metric: 'lowest_cash', choice: 'floor', by: 0 }, env);
  eq([none.blocked.floor, none.aim, none.canSet, none.verdict.word], [true, null, false, 'Under every floor today'], 'a floor of its own above today’s cash is not offered either');
  t.check(/^Cash stands at 3\.00m today — already under every floor on offer, your own included/.test(s.mgrTgComposeSay(none)), 'and it says so in figures');
  /* No floor set: the stand-in (a month of rent and salaries) is offered, said as that. */
  floor = { amount: 2.5e6, source: 'stand-in', note: 'not set — a month of rent and salaries stands in' };
  const si = s.mgrTgComposeModel({ metric: 'lowest_cash', by: 0 }, env);
  t.check(si.aim === 2.5e6 && /<small>a month’s costs<\/small>/.test(s.mgrTgComposerHTML(si)), 'the stand-in floor is offered as a month’s costs');

  /* WHICH DEADLINE IT OPENS ON (Q41). Sales, a flow, read on any day. */
  const mk = (from) => scope({ MANAGER_METRICS: { sales: { label: 'Sales', unit: 'ugx', kind: 'flow', direction: 'up', measure: () => 1 } },
    data: { savedQuotes: [], cashTxns: [{ date: from }], stockLog: [], customers: [], staff: [] } });
  const dl = mk('2023-01-01').mgrTgDeadlines(TODAY);
  /* Books from 2023: 86-day periods back to 2023 are 24 (the cap) -> the third. */
  eq(mk('2023-01-01').mgrTgDefaultBy('sales', dl, TODAY), 2, 'enough past 86-day periods for odds: it opens on the third month-end (31 Dec)');
  /* Books from 1 Apr 2026: to 6 Oct is 189 days -- 7 periods of 25 days,
     3 of 55, 2 of 86. The third has too few; the first has enough. */
  eq(mk('2026-04-01').mgrTgDefaultBy('sales', dl, TODAY), 0, 'too few for odds at the third: the first deadline that has them (31 Oct)');
  /* Books from 1 Sep: no deadline has six -> the third, as the canvas opens. */
  eq(mk('2026-09-01').mgrTgDefaultBy('sales', dl, TODAY), 2, 'none with odds: the third, as the canvas');
  const opened = mk('2023-01-01').mgrTgComposeModel({ metric: 'sales', choice: 'stretch', by: null }, env);
  eq([opened.byIdx, opened.by.to], [2, '2026-12-31'], 'a fresh composer opens there');
  eq(mk('2023-01-01').mgrTgComposeModel({ metric: 'sales', by: 1 }, env).byIdx, 1, 'and a deadline the owner picked is kept');
}
{
  /* THE PHONE'S STATE CHIP opens the row's rule, so it is a tap target:
     the design system's --ow-tap (44px), never the 32px it was drawn at. */
  const phone = (src.match(/\/\* ═══ MGR BED: Targets — begin ═══ \*\/[\s\S]*?\/\* ═══ MGR BED: Targets — end ═══ \*\//g) || [])[1] || '';
  const rule = (phone.match(/\.mgr-tg-st\{[^}]*\}/) || [''])[0];
  t.check(/min-height:var\(--ow-tap\)/.test(rule) && /box-sizing:border-box/.test(rule) && !/min-height:32px/.test(rule),
    `on the phone the state chip is at least --ow-tap tall (${rule})`);
}

/* ---------- 24. finished: how early, against its own past, and its moves -- */
{
  const s = scope({ MANAGER_METRICS: { sales: { unit: 'ugx', kind: 'flow', direction: 'up', measure: (a, b) => (between(a, b) + 1) * 100 } } });
  /* 100 a day from 1 Sep: 350 is reached on day 4 (4 Sep, 400). */
  eq(s.mgrTgMetOn({ id: 1, metric: 'sales', from: '2026-09-01', to: '2026-09-10', aim: 350, met: true }), '2026-09-04', 'a flow met on the day its running total reached the aim');
  eq(s.mgrTgFinishedLine({ x: { aim: 350, actual: 1000, to: '2026-09-10' }, m: { unit: 'ugx' }, met: true, metOn: '2026-09-04' }), 'reached 1k, 6 days early',
    '4 Sep to 10 Sep: 6 days early');
  eq(s.mgrTgMetOn({ id: 2, metric: 'sales', from: '2026-09-01', to: '2026-09-10', aim: 350, met: false }), null, 'a miss was never met');
  eq([s.mgrTgAbove90({ metric: 'sales', aim: 13 }, 12), s.mgrTgAbove90({ metric: 'sales', aim: 11 }, 12)], [true, false], 'at or past the 90th, against what the composer showed');
  const sd = scope({ MANAGER_METRICS: { dd: { unit: 'days', kind: 'level', direction: 'down' } } });
  eq(sd.mgrTgAbove90({ metric: 'dd', aim: 9 }, 10), true, 'aimed down, under the 90th is past it');
  const fm = s.mgrTgFinishedModel({ id: 3, metric: 'sales', from: '2026-09-01', to: '2026-09-07', aim: 9e9, met: false, owner: 'you' },
    { error: null, firstLink: '2026-08-01', rows: [{ date: '2026-09-03', body: { target: { metric: 'sales' } } }] });
  eq([fm.linked, fm.owner], [true, 'you'], 'a move dated in its days and aimed at its measure links it');
  const fm2 = s.mgrTgFinishedModel({ id: 4, metric: 'sales', from: '2026-07-01', to: '2026-07-07', aim: 9e9, met: false },
    { error: null, firstLink: '2026-08-01', rows: [] });
  eq(fm2.linked, null, 'before the meeting ever linked moves, "no move aimed at it" is not known, not a fact');
}

/* ---------- 25. the plan's moves and the Mondays ------------------------ */
{
  const s = scope({ MANAGER_METRICS: { sales: { unit: 'ugx', kind: 'flow', direction: 'up', measure: (a, b) => (between(a, b) + 1) * 50 } } });
  const st = { today: null, prior: [{ meeting: { date: '2026-10-05' }, moves: [
    { id: 5, status: 'open', body: { title: 'A', target: { metric: 'sales' }, effect: '100' } },
    { id: 6, status: 'done', body: { title: 'B', effect: 'lots' } }] }] };
  const pm = s.mgrTgPlanMoves(st);
  eq([pm.on, pm.moves.map((m) => m.num + ':' + m.effect)], ['2026-10-05', ['01:100', '02:null']],
    'with no meeting today the last one’s moves are the plan, numbered in its order; an effect that is not a number is no size');
  /* 21 Sep (Mon) to 31 Oct: 41 days, aim 4,100, a road of 100 a day; 50 a
     day done. Mondays before today: 21 Sep (road 100, did 50), 28 Sep
     (800 vs 400), 5 Oct (1,500 vs 750): behind at each -- two running. */
  const mon = s.mgrTgMondays({ id: 9, metric: 'sales', from: '2026-09-21', to: '2026-10-31', aim: 4100 });
  eq(mon.map((c) => `${c.on}:${c.road}:${c.v}:${c.behind}`), ['2026-09-21:100:50:true', '2026-09-28:800:400:true', '2026-10-05:1500:750:true'],
    'each Monday gone, the road and the reading');
  eq(s.mgrTgBehindTwo(mon), true, 'behind the road two Mondays running');
}

/* ---------- 26. the Today screen's line, in the target's own unit -------- */
{
  const s = scope({ MANAGER_METRICS: { debtor_days: { label: 'Debtor days', unit: 'days', direction: 'down' } } });
  /* Debtor days 35 against 22, the road at 24: 11 behind of 13 to go (85%): Off track. */
  const l = s.mgrTgTodayLine({ metric: 'debtor_days', label: 'Debtor days', unit: 'days', finished: false, direction: 'down', aim: 22, actual: 35,
    to: '2026-11-30', days_left: 54, pace: { expected: 24, on_course: false, behind_by: 11, at_this_rate: 53 } });
  eq(l, { key: 'off', ok: false, text: 'Off track — Debtor days under 22: 35 days now. The road has it at 24 days — 11 days behind. At this rate it ends at 53 days by 30 Nov. 54 days are left.' },
    'days as days, the deadline as a date — never "35 UGX of 22 UGX" and "the week ends"');
}

/* ---------- 27. Saturday load time (Q36), from the stage history -------- */
{
  /* Times in UTC; Kampala is UTC+3. Today is Wed 7 Oct; the Saturdays
     before it are 3 Oct, 26 Sep, 19 Sep, 12 Sep, 5 Sep. */
  const U = (d, hh, mm) => Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10)), hh, mm || 0);
  const leg = (prep, out) => [{ status: 'preparing', at: prep }, { status: 'pending_delivery', at: out }];
  const base = [
    /* Sat 3 Oct: 70 min; 60 min (re-entered Being prepared at 08:30 --
       one stay, read from 08:00); 40 min. */
    { date: '2026-09-01', stageLog: leg(U('2026-10-03', 6), U('2026-10-03', 7, 10)) },
    { stageLog: [{ status: 'preparing', at: U('2026-10-03', 8) }, { status: 'preparing', at: U('2026-10-03', 8, 30) }, { status: 'pending_delivery', at: U('2026-10-03', 9) }] },
    { stageLog: leg(U('2026-10-03', 10), U('2026-10-03', 10, 40)) },
    /* Fri 2 Oct 21:30 UTC is Sat 3 Oct 00:30 in Kampala: a Saturday load of 90 min. */
    { stageLog: leg(U('2026-10-02', 20), U('2026-10-02', 21, 30)) },
    /* Sat 3 Oct 22:30 UTC is Sunday 01:30 in Kampala: not a Saturday load. */
    { stageLog: leg(U('2026-10-03', 22), U('2026-10-03', 22, 30)) },
    /* Sat 26 Sep: out straight from Awaiting goods (no prepared stay) and a
       voided order -- neither counts; one load of 50 min, its times as
       ISO strings. */
    { stageLog: [{ status: 'awaiting_goods', at: U('2026-09-26', 6) }, { status: 'pending_delivery', at: U('2026-09-26', 7) }] },
    { voided: true, stageLog: leg(U('2026-09-26', 6), U('2026-09-26', 6, 30)) },
    { stageLog: leg(new Date(U('2026-09-26', 7)).toISOString(), new Date(U('2026-09-26', 7, 50)).toISOString()) },
    /* Sat 19 Sep: 45 min. Sent back to Being prepared and out again on Sat
       12 Sep: 80 min for the second stay, and the first move out was a
       Saturday too (12 Sep, 30 min) -- 12 Sep reads the median of 30 and
       80, 55. A Thursday load counts for nothing. */
    { stageLog: leg(U('2026-09-19', 9), U('2026-09-19', 9, 45)) },
    { stageLog: [{ status: 'preparing', at: U('2026-09-12', 6) }, { status: 'pending_delivery', at: U('2026-09-12', 6, 30) },
      { status: 'preparing', at: U('2026-09-12', 7) }, { status: 'pending_delivery', at: U('2026-09-12', 8, 20) }] },
    { stageLog: leg(U('2026-10-01', 6), U('2026-10-01', 9)) },
    /* No stage history: a counter sale, an old order. */
    { counterSale: true, stageLog: null }, { status: 'completed' },
  ];
  const LOADFNS = ['mgrTgMemo', 'mgrTgBooksFrom', 'mgrTgLoadsOf', 'mgrTgMedian', 'mgrTgLoads', 'mgrTgLoadReady', 'mgrTgLoadAt',
    'mgrTgPeriods', 'mgrTgPercentile', 'mgrTgChoices', 'mgrTgOdds', 'mgrTgFig', 'mgrTgName', 'managerScoreProgress'];
  const mk = (quotes) => compileScope([
    ...['MGR_TG_LOAD_MIN', 'MGR_TG_KAMPALA_MS', 'MGR_TG_PERIODS', 'MGR_TG_MIN_CHOICES', 'MGR_TG_MIN_ODDS', 'mgrTgMemoSig', 'mgrTgMemoAt', 'mgrTgMemoMap',
      'mgrTgBetter', 'MANAGER_METRICS'].map((n) => extractDeclaration(src, n, 'index.html')),
    ...LOADFNS.map((n) => extractFunction(src, n, 'index.html')),
    'function loadMetric(){ return MANAGER_METRICS; }',
  ], { todayISO: () => TODAY, anShiftDate: shift, mgrRenderGen: 1, data: { savedQuotes: quotes, cashTxns: [], stockLog: [] },
    Date, Math, Number, String, Array, Object, Map, Set, JSON }, LOADFNS.concat(['loadMetric']));
  const s = mk(base);
  s.MANAGER_METRICS = s.loadMetric();
  const days = s.mgrTgLoadsOf(base);
  eq([...days.keys()].sort(), ['2026-09-12', '2026-09-19', '2026-09-26', '2026-10-03'],
    'four Saturdays with a load; Sunday by the Kampala clock, a Thursday, a move out from Awaiting goods and a voided order count for none');
  eq(days.get('2026-10-03').slice().sort((a, b) => a - b), [40, 60, 70, 90],
    'Sat 3 Oct: 70, 60 (from the first entry of the stay), 40, and the 90 that was Friday night in UTC but Saturday in Kampala');
  eq(days.get('2026-09-12').slice().sort((a, b) => a - b), [30, 80], 'an order sent back counts each stay that went out on a Saturday');
  eq(s.mgrTgMedian([70, 60, 40, 90]), 65, 'the median of four is the mean of the middle two: (60 + 70) / 2');
  eq(s.mgrTgMedian([50]), 50, 'of one, itself');
  eq(s.mgrTgMedian([]), null, 'of none, not known — never 0');
  eq(s.mgrTgLoadReady(), { n: 4, min: 4, ok: true, why: null }, 'four Saturdays recorded: enough');
  const M = s.MANAGER_METRICS.sat_load;
  eq([M.at('2026-10-06'), M.at('2026-10-03'), M.at('2026-10-02'), M.at('2026-09-12'), M.at('2026-09-11')], [65, 65, 50, 55, null],
    'a day reads the Saturday in the 7 days to it: Tue 6 Oct and Sat 3 Oct read 3 Oct (65), Fri 2 Oct reads 26 Sep (50), 12 Sep (30, 80) reads 55, and 11 Sep reads 5 Sep — no load recorded, not known');
  eq(M.measure(), 65, 'now is read to yesterday (Tue 6 Oct): last Saturday, 65 minutes');
  /* Past 7-day periods ending 6 Oct, 29 Sep, 22 Sep, 15 Sep, 8 Sep (the
     books start 1 Sep; the period to 1 Sep starts before them): 65, 50,
     45, 55 and one not known (5 Sep). Lower is better: sorted 45, 50, 55,
     65 -- safe the median 52.5 -> 53, stretch the 25th 48.75 -> 49, bold
     the 10th 46.5 -> 47. Odds of 49: one period (45) of four -- no per
     cent under six. */
  const per = s.mgrTgPeriods('sat_load', 7, '2026-10-06');
  eq([per.values.map((x) => x.v), per.unknown], [[65, 50, 45, 55], 1], 'its past periods come from the same stage history; a Saturday with none is left out, not read as 0');
  eq(s.mgrTgChoices(per.values, 'down'), { safe: 53, stretch: 49, bold: 47, n: 4 }, 'safe / stretch / bold, read the way lower is better');
  eq(s.mgrTgOdds(per.values, 49, 'down'), { k: 1, n: 4, pct: null }, 'odds stay hidden under six periods');
  eq([s.mgrTgFig('min', 64.6), s.mgrTgFig('min', 45, true), s.mgrTgName('sat_load', 45)], ['65 min', '45', 'Saturday loads in 45 minutes'],
    'minutes, whole, and the target named as the canvas says it');
  /* A running target from 1 Oct to 31 Oct, 70 -> 45. It moves on
     Saturdays only: 3, 10, 17, 24 and 31 Oct are inside it, and read to
     yesterday (Tue 6 Oct) one of them is in (3 Oct). The road steps a
     fifth of the way: 70 - 25/5 = 65; at 65 it is on the road. Where it
     lands waits for a second Saturday (10 Oct): one Saturday's step
     stretched over five would let one noisy week decide it. */
  const run = s.managerScoreProgress({ body: { metric: 'sat_load', aim: 45, baseline: 70, from: '2026-10-01', to: '2026-10-31' } });
  eq([run.actual, run.unit, run.pace.elapsed_steps, run.pace.total_steps, run.pace.expected, run.pace.on_course, run.pace.at_this_rate, run.pace.rate_from],
    [65, 'min', 1, 5, 65, true, null, '2026-10-10'],
    'a load-time target is read in minutes, against a road that steps on each Saturday inside it');
  /* Three Saturdays only: not enough history, said with the count -- and
     nothing is read, never a 0. */
  const thin = base.filter((q) => !(q.stageLog && q.stageLog.some((e) => String(e.at).length > 0 && new Date(e.at).toISOString().slice(0, 10) === '2026-09-12')));
  const s3 = mk(thin);
  s3.MANAGER_METRICS = s3.loadMetric();
  eq(s3.mgrTgLoadReady(), { n: 3, min: 4, ok: false, why: 'not enough history — 3 Saturdays recorded' }, 'three Saturdays: not enough, and it says how many');
  eq([s3.MANAGER_METRICS.sat_load.measure(), s3.MANAGER_METRICS.sat_load.at('2026-10-06')], [null, null], 'nothing is read until four are recorded');
  eq([scope({}).mgrTgLower('Saturday load time'), scope({}).mgrTgLower('WhatsApp orders a month'), scope({}).mgrTgLower('Debtor days')],
    ['Saturday load time', 'WhatsApp orders a month', 'debtor days'], 'inside a sentence a day and WhatsApp keep their capitals');
  eq(mk([]).mgrTgLoadReady().why, 'not enough history — 0 Saturdays recorded', 'none at all says 0 Saturdays recorded');
  eq(mk([base[2]]).mgrTgLoadReady().why, 'not enough history — 1 Saturday recorded', 'one says Saturday');

  /* The composer draws it disabled with that line, and never picks it. */
  const c = scope({ MANAGER_METRICS: {
    sat_load: { label: 'Saturday load time', unit: 'min', kind: 'level', direction: 'down', window: 7, measure: () => null, at: () => null,
      ready: () => ({ n: 3, min: 4, ok: false, why: 'not enough history — 3 Saturdays recorded' }) },
    wa_orders: { label: 'Orders', unit: 'count', kind: 'flow', direction: 'up', measure: () => 1 } } });
  const cm = c.mgrTgComposeModel({ metric: 'sat_load', choice: 'stretch', by: 0 }, { runningMetrics: [], runningCount: 0, plan: { moves: [] }, finished: [], rules: [] });
  eq([cm.metric, cm.measures.find((x) => x.k === 'sat_load').unready], ['wa_orders', 'not enough history — 3 Saturdays recorded'],
    'a measure that cannot be read yet is drawn with why and never chosen');
}

/* ---------- 27b. a measure that moves once a week is paced by its weeks --- */
{
  /* One Saturday median a week, stood in for by a fixed table: the
     Saturday in the 7 days to a day is the one read (as mgrTgLoadAt). */
  const SAT = { '2026-09-26': 57, '2026-10-03': 57, '2026-10-10': 52, '2026-10-17': 49 };
  const satOf = (d) => { for (let i = 0; i < 7; i++) { const x = shift(d, -i); if (new Date(x + 'T00:00:00Z').getUTCDay() === 6) return x; } return null; };
  const mkAt = (today) => {
    const sc = compileScope([extractFunction(src, 'managerScoreProgress', 'index.html')], {
      todayISO: () => today, Date, Math, Number, String, Array, Object,
      MANAGER_METRICS: { sat_load: { label: 'Saturday load time', unit: 'min', kind: 'level', direction: 'down', window: 7, step: 6,
        at: (d) => SAT[satOf(d)] == null ? null : SAT[satOf(d)], measure: () => SAT[satOf(shift(today, -1))] == null ? null : SAT[satOf(shift(today, -1))] } },
    }, ['managerScoreProgress']);
    return sc.managerScoreProgress;
  };
  /* Set Mon 5 Oct for the week to Sun 11 Oct, from 57 to 50, read on Wed
     7 Oct: Sat 10 Oct is its only Saturday and has not come. Read a day
     at a time it was 2 behind a road at 55 -- At risk for a Saturday that
     has not happened. It is On track, and names the Saturday it waits on. */
  const wk = { body: { metric: 'sat_load', aim: 50, baseline: 57, from: '2026-10-05', to: '2026-10-11' } };
  const p1 = mkAt('2026-10-07')(wk);
  eq([p1.actual, p1.pace.first, p1.pace.first_on, p1.pace.on_course, p1.pace.behind_by, p1.pace.expected, p1.pace.total_steps],
    [57, true, '2026-10-10', true, 0, 57, 1], 'a weekly target set on a Monday reads On track on Wednesday — no Saturday inside it has been read');
  const ts = scope({ MANAGER_METRICS: { sat_load: { label: 'Saturday load time', unit: 'min', kind: 'level', direction: 'down', step: 6 } } });
  const x1 = { ...p1, id: 1, finished: false, days_left: 4 };
  eq(ts.mgrTgState(x1).key, 'on', 'the state says On track');
  const tl1 = ts.mgrTgTodayLine(x1).text;
  t.check(/^On track — Saturday loads in 50 minutes: 57 min now\. It moves on Saturdays only — the first inside it is Sat,? 10 Oct\. 4 days are left\.$/.test(tl1),
    `Today names the Saturday it waits on, not a whole day tomorrow (${tl1})`);
  /* Read on Sun 11 Oct (yesterday Sat 10 Oct is in): 52 against a road
     that has stepped all the way to 50: 2 behind of 2 to go -- Off track. */
  const p2 = mkAt('2026-10-11')(wk);
  eq([p2.actual, p2.pace.elapsed_steps, p2.pace.expected, p2.pace.on_course, p2.pace.behind_by, p2.pace.at_this_rate], [52, 1, 50, false, 2, 52],
    'once its Saturday is read the road has stepped to the aim, and with its only Saturday in, where it lands is where it stands');
  /* A month from Thu 1 Oct to Sat 31 Oct, from 65 to 45, read on Wed 14
     Oct: Saturdays inside it 3, 10, 17, 24, 31 (5); in by yesterday 3 and
     10 Oct (2). The road: 65 - 20*2/5 = 57; it reads 52, ahead. At this
     rate, carried over Saturdays, not days: 65 + (52 - 65) * 5/2 = 32.5
     -> 33 (a day at a time it was 65 - 13*31/13 = 34). */
  const mo = mkAt('2026-10-14')({ body: { metric: 'sat_load', aim: 45, baseline: 65, from: '2026-10-01', to: '2026-10-31' } });
  eq([mo.pace.elapsed_steps, mo.pace.total_steps, mo.pace.expected, mo.pace.on_course, mo.pace.at_this_rate, mo.pace.rate_from],
    [2, 5, 57, true, 33, undefined], 'the rate is read over Saturdays, and only once two are in');
  /* Its checkpoints step too: Mondays 5, 12, 19, 26 Oct and 31 Oct have
     1, 2, 3, 4 and 5 of its 5 Saturdays behind them (65 - 20*k/5): 61,
     57, 53, 49, 45. */
  const mo7 = mkAt('2026-10-07')({ body: { metric: 'sat_load', aim: 45, baseline: 65, from: '2026-10-01', to: '2026-10-31' } });
  eq(mo7.checkpoints, [{ on: '2026-10-05', value: 61 }, { on: '2026-10-12', value: 57 }, { on: '2026-10-19', value: 53 },
    { on: '2026-10-26', value: 49 }, { on: '2026-10-31', value: 45 }], 'the checkpoints step on Saturdays: 3 Oct is behind 5 Oct (61), 3 and 10 Oct behind 12 Oct (57)');
  eq(mo7.pace.rate_from, '2026-10-10', 'with one Saturday in, where it lands waits for the second');
  /* The composer's road steps the same way. 7 Oct to 31 Oct, 57 -> 45:
     Saturdays 10, 17, 24, 31 -- Monday 12 Oct has one behind it (54). */
  const road = ts.mgrTgRoad('2026-10-07', '2026-10-31', 57, 45, Math.round, 6);
  eq(road.mondays.map((c) => c.on + ':' + c.value), ['2026-10-12:54', '2026-10-19:51', '2026-10-26:48', '2026-10-31:45'], 'and the composer’s road and its checkpoints with it');
  /* The row says it in its own unit and names what it waits on. */
  const r = ts.mgrTgRunModel({ ...mo7, id: 2, finished: false, days_left: 24 }, { moves: [] });
  eq([r.key, r.land], ['on', null], 'no landing until the second Saturday');
}

/* ---------- 28. a cash floor the committed line breaks is At risk (Q37) --- */
{
  const s = scope({ MANAGER_METRICS: { lowest_cash: { label: 'Lowest cash in a month', unit: 'ugx', kind: 'level', direction: 'up', span: true } } });
  const row = (pace) => ({ id: 1, metric: 'lowest_cash', label: 'Lowest cash in a month', unit: 'ugx', finished: false, direction: 'up', measure_kind: 'level',
    hold: true, aim: 10000000, baseline: 29070000, actual: 25000000, from: '2026-10-01', to: '2026-10-31', days_left: 24, pace });
  /* Above the floor in the books (25.00m); the committed line -- no money
     coming in -- goes under 10.00m on Thu 22 Oct. */
  const line = row({ on_course: true, behind_by: 0, expected: 10000000, at_this_rate: 7480000, low_on: '2026-10-31', low_books: false,
    breaks_on: '2026-10-22', broke: false, line_to: '2026-10-31' });
  const st = s.mgrTgState(line);
  eq([st.key, st.breaksOn], ['risk', '2026-10-22'], 'the committed line under the floor before the deadline is At risk, with the day it would break');
  /* The books already went under on 2 Oct: Off track. */
  const broke = row({ on_course: false, behind_by: 6460000, expected: 10000000, at_this_rate: 3540000, low_on: '2026-10-02', low_books: true,
    breaks_on: '2026-10-02', broke: true, line_to: '2026-10-31' });
  eq([s.mgrTgState({ ...broke, actual: 3540000 }).key, s.mgrTgState({ ...broke, actual: 3540000 }).breaksOn], ['off', '2026-10-02'],
    'Off track only once the books show cash under it');
  eq(s.mgrNavCountTargets({ score: { targets: [line], proposed: [] } }), { n: 1, note: null }, 'the nav names no Off track for a line that only would break');
  const tl = s.mgrTgTodayLine(line);
  /* The floor's reading is the lowest close since it began, not today's
     cash: it says so. */
  t.check(tl.key === 'risk' && tl.ok === false && /^At risk — Cash never under 10\.00m: lowest 25\.00m since 1 Oct\. The committed line takes cash under it on Thu,? 22 Oct\. 24 days are left\.$/.test(tl.text),
    `Today says At risk, the lowest since it began, and the day it would break (${tl.text})`);
  const r = s.mgrTgRunModel(line, { moves: [] });
  eq(r.key, 'risk', 'the row is coloured At risk by the same state');
  /* The row's track labels the floor's reading the same way, and its
     break day sits under the chip without a weekday (it fits its column). */
  const rowSrc = extractFunction(src, 'mgrTgRowHTML', 'index.html');
  t.check(/const nowWord = r\.m\.span \? 'lowest so far' : 'now';/.test(rowSrc) && /\$\{nowWord\} <b class="mgr-tg-fig">/.test(rowSrc),
    'a floor’s track says lowest so far, never now');
  t.check(/const chipDay = r\.brk && r\.brk\.breaksOn \? `\$\{r\.brk\.broke \? 'broke' : 'breaks'\} \$\{mgrTgDay\(r\.brk\.breaksOn\)\}` : '';/.test(rowSrc),
    'the break day reads "breaks 22 Oct", as the canvas does');
  t.check(/const tf = \(v\)=> mgrTgFig\(u, v, u !== 'min'\);/.test(rowSrc) && !/mgrTgFig\(u, [^)]*, true\)/.test(rowSrc),
    'the track’s figures keep "min" (started 72 min · now 70 min · target 45 min)');
}

/* ---------- 29. the screens that read the scoreboard count it one way ---- */
{
  /* The meeting's proposed aim is rounded by its measure's own rule: a
     10.46% margin is 10.5, never 10; minutes and shillings whole. */
  const save = extractFunction(src, 'managerSaveMeeting', 'index.html');
  t.check(/aim: \(MANAGER_METRICS\[String\(x\.metric\)\]\.round \|\| apRound\)\(Number\(x\.aim\)\)/.test(save),
    'a proposed aim is rounded by its measure’s rule (a margin to a tenth), not to a whole number');
  const { metrics } = compileScope([extractDeclaration(src, 'MANAGER_METRICS', 'index.html'), 'function metrics(){ return MANAGER_METRICS; }'],
    { Math, Number }, ['metrics']);
  eq([metrics().margin_pct.round(10.46), metrics().quotes_won_pct.round(48.25)], [10.5, 48.3], 'a share keeps a tenth of a point');
  /* The weekly review is handed the week, and the long record as a count. */
  const review = src.slice(src.indexOf('  week_review_data: { confirm: false'), src.indexOf('  week_review_data: { confirm: false') + 6000);
  t.check(/if\(\(score\.week\|\|\[\]\)\.length\) out\.scoreboard = score\.week;/.test(review) && !/out\.scoreboard = score\.targets/.test(review),
    'the review reads the running targets and those finished in the last seven days, not every target ever taken on');
  t.check(/out\.targets_finished = \{ met: score\.tally\.met, of: score\.tally\.met \+ score\.tally\.missed \}/.test(review),
    'and the finished record as met of met-or-missed, an unknown end in neither');
  /* The Record's account counts the tally: a running target is never Met,
     an unreadable end is never Missed, and is named. */
  const rec = extractFunction(src, 'mgrPaintRecord', 'index.html');
  t.check(/const tally = st\.score && !st\.score\.error && st\.score\.tally \? st\.score\.tally : null;/.test(rec)
    && /tally \? tally\.met : unread/.test(rec) && /tally \? tally\.missed : unread/.test(rec) && /Ended, not known/.test(rec)
    && !/filter\(x=> x\.met\)/.test(rec) && !/x\.finished && !x\.met/.test(rec),
    'Met and Missed are the scoreboard’s tally, and an end the books cannot read is named, never counted as missed');
  /* A scoreboard that could not be read: every count in the account says
     so -- never a 0 beside "not known" -- and no unknown wears a state colour. */
  t.check(/st\.score && !st\.score\.error \? \(st\.score\.targets \|\| \[\]\)\.length : unread/.test(rec)
    && /'the scoreboard could not be read'/.test(rec)
    && /class="mgr-rf-v\$\{tally \? ' ow-good' : ''\}"/.test(rec) && /class="mgr-rf-v\$\{tally \? ' ow-bad' : ''\}"/.test(rec)
    && !/mgr-rf-v ow-good/.test(rec) && !/mgr-rf-v ow-bad/.test(rec),
    'Targets taken on is not 0 when the read failed, and green and red belong to known counts only');
}

/* ---------- 29b. a meeting's proposal, by its measure's own rules -------- */
(async () => {
  const save = extractFunction(src, 'managerSaveMeeting', 'index.html');
  /* The save is read for its proposed-target lines, as written. */
  t.check(/amount: \(MANAGER_METRICS\[String\(x\.metric\)\]\.round \|\| apRound\)\(Number\(p && p\.amount\) \|\| 0\)/.test(save),
    'a proposal’s parts are rounded by the measure’s own rule, as its aim is');
  t.check(/typeof MANAGER_METRICS\[String\(x\.metric\)\]\.ready === 'function' && !MANAGER_METRICS\[String\(x\.metric\)\]\.ready\(\)\.ok/.test(save),
    'a proposal on a measure that cannot be read yet is not kept');
  /* By hand: a margin aim 10.5 built from 10.2 on the books and 0.3 a move
     adds keeps its tenths, so the parts still close on the aim. */
  const { metrics } = compileScope([extractDeclaration(src, 'MANAGER_METRICS', 'index.html'), 'function metrics(){ return MANAGER_METRICS; }'],
    { Math, Number }, ['metrics']);
  const rd = metrics().margin_pct.round;
  eq([rd(10.5), rd(10.2), rd(0.3), rd(10.2) + rd(0.3)], [10.5, 10.2, 0.3, 10.5], 'a 0.3-point part is kept, and 10.2 + 0.3 closes on 10.5');
  /* Taking one on, or setting one, on a measure not readable yet says why
     in its own words. */
  const adopt = extractFunction(src, 'managerAdoptTarget', 'index.html');
  const own = extractFunction(src, 'managerSetOwnerTarget', 'index.html');
  t.check(/if\(rd && !rd\.ok\)\{ toast\(m\.label \+ ' cannot be taken on yet — ' \+ rd\.why/.test(adopt),
    'taking on a load-time proposal before four Saturdays says how many are recorded');
  const toasts = [];
  const { managerSetOwnerTarget } = compileScope([own, ...SLOT], {
    managerScoreboard: async () => ({ targets: [] }),
    MANAGER_METRICS: { sat_load: { label: 'Saturday load time', unit: 'min', kind: 'level', direction: 'down', step: 6, measure: () => null,
      ready: () => ({ n: 1, min: 4, ok: false, why: 'not enough history — 1 Saturday recorded' }) } },
    todayISO: () => TODAY, anShiftDate: shift, toast: (m) => toasts.push(m), renderManager: () => {}, data: { staff: [] },
    mgrNoteInsert: async () => { throw new Error('nothing is written'); }, Date, Math, Number, String, Array, Promise,
  }, ['managerSetOwnerTarget']);
  const r = await managerSetOwnerTarget({ metric: 'sat_load', aim: 45, to: '2026-10-31', owner: 'you' });
  eq([r.ok, toasts[0]], [false, 'Saturday load time cannot be a target yet — not enough history — 1 Saturday recorded'],
    'setting one says why, and writes nothing');
})().catch((e) => { t.check(false, 'the proposal test threw: ' + e.message); });

/* ---------- 17. the owner’s own target is written as it was set --------- */
(async () => {
  const written = [];
  const toasts = [];
  const M = { debtor_days: { label: 'Debtor days', unit: 'days', kind: 'level', direction: 'down', measure: () => 35.2, at: () => 35.2 },
    sales: { label: 'Sales', unit: 'ugx', kind: 'flow', direction: 'up', measure: (f, to) => (f === '2026-09-12' && to === '2026-10-06' ? 2500 : -1) } };
  let board = { targets: [] };
  const { managerSetOwnerTarget } = compileScope([extractFunction(src, 'managerSetOwnerTarget', 'index.html'), ...SLOT], {
    managerScoreboard: async () => board,
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

  /* THE CAP IN THE WRITER (Q16, Q41). Four running (one finished does not
     count): a fifth is refused with the composer's sentence and nothing is
     written -- a stale card or a second tab cannot get past a disabled
     button. A second on a measure already running is refused; an unread
     scoreboard counts nothing and sets nothing. */
  written.length = 0; toasts.length = 0;
  const run = (metric) => ({ metric, finished: false });
  board = { targets: [run('collections'), run('margin_pct'), run('wa_orders'), run('stock_days'), { metric: 'sales', finished: true }] };
  const fifth = await managerSetOwnerTarget({ metric: 'sales', aim: 3000, to: '2026-10-31', owner: 'you' });
  eq([fifth.ok, fifth.error, written.length], [false, '4 targets are running — the most at once. One has to finish first.', 0],
    'a fifth running target is refused by the writer itself');
  board = { targets: [run('debtor_days'), { metric: 'sales', finished: true }] };
  const twice = await managerSetOwnerTarget({ metric: 'debtor_days', aim: 30, to: '2026-10-31', owner: 'you' });
  eq([twice.ok, twice.error, written.length], [false, 'A target on debtor days is already running — one at a time on each measure.', 0],
    'and a second on a measure already running');
  board = { targets: [], error: 'timeout' };
  const blind = await managerSetOwnerTarget({ metric: 'sales', aim: 3000, to: '2026-10-31', owner: 'you' });
  eq([blind.ok, blind.error, written.length], [false, 'The scoreboard could not be read — timeout, so the running targets could not be counted. Nothing was set.', 0],
    'an unread scoreboard counts nothing, so nothing is set');
  board = { targets: [run('debtor_days'), run('margin_pct'), run('wa_orders'), { metric: 'x', finished: true }] };
  const third = await managerSetOwnerTarget({ metric: 'sales', aim: 3000, to: '2026-10-31', owner: 'you' });
  eq([third.ok, written.length], [true, 1], 'three running and a free measure: it is set');
  t.check(/const refusal = mgrTgSlotRefusal\(await managerScoreboard\(\), body\.metric\);\s*if\(refusal\)\{ toast\(refusal, 8000\); return; \}\s*const up = await sb/.test(extractFunction(src, 'managerAdoptTarget', 'index.html')),
    'taking on a proposal asks the same question of a fresh scoreboard before it writes');
})().then(() => { process.exit(t.done() ? 1 : 0); })
  .catch((e) => { console.error(e); process.exit(1); });
