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
  'mgrPlayLevelAt', 'mgrPlayReads', 'mgrPlayResult', 'mgrPlayConflicts', 'mgrPlayOdds', 'mgrPlayRerunPlan', 'mgrPlayBoard',
  'mgrPlayPastWeeks', 'mgrPlayP75', 'mgrPlayPresets', 'mgrPlayDraftBase', 'mgrPlayDesignCheck', 'mgrPlayWorth', 'mgrShortUGX', 'mgrDept'];
const DECLS = ['MGR_PLAY_SLOTS', 'MGR_PLAY_TREAT_DEPT', 'MGR_PLAY_VERDICT_WORDS', 'MANAGER_PROBLEMS', 'MGR_DEPTS', 'MGR_WHOLE_SHOP'];

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
  /* A FLOW: the share kept. Before = the 7 days before the start
     (14-20 Sep) = 9.0%. Week 1 9.2% is better (it wants up), week 2
     8.2% worse: k = 1 of n = 2, one pip, latest 8.2%. */
  const SHARE = { '2026-09-14|2026-09-20': 9.0, '2026-09-21|2026-09-27': 9.2, '2026-09-28|2026-10-04': 8.2 };
  const margin = { label: 'the share kept', unit: 'pct', kind: 'flow', direction: 'up',
    measure: (f, to) => (SHARE[f + '|' + to] == null ? null : SHARE[f + '|' + to]) };
  const S = scope({ MANAGER_PROBLEM_METRICS: { margin } });
  const r = S.mgrPlayReads({ id: 1, treats: 'margin', started_on: '2026-09-21', weeks: 4 }, TODAY, []);
  eq([r.measured, r.before, r.beforeBasis], [true, 9, 'the 7 days before it started'], 'a flow is read against the week before it started');
  eq(r.cells.map((c) => [c.value, c.state]), [[9.2, 'better'], [8.2, 'worse'], [null, 'open'], [null, 'open']],
    'each finished week read and called better or worse the way the play wants it');
  eq([r.k, r.n, r.pips, r.latest], [1, 2, 1, 8.2], 'better in 1 of 2 weeks: one pip, and the latest reading is week 2');
  eq(S.mgrPlayResult(r), { text: 'the share kept 9.0% → 8.2%, better in 1 of 2 weeks',
    read: { label: 'the share kept', unit: 'pct', direction: 'up', before: 9, after: 8.2, moved: -0.8, k: 1, n: 2 } },
  'a verdict keeps the read in words and in figures: 8.2 - 9.0 = -0.8 points');

  /* The books start 18 Sep, after the 14 Sep the before needs. */
  const short = scope({ MANAGER_PROBLEM_METRICS: { margin }, booksStartDate: () => '2026-09-18' })
    .mgrPlayReads({ id: 1, treats: 'margin', started_on: '2026-09-21', weeks: 4 }, TODAY, []);
  eq([short.before, short.beforeWhy, short.k, short.n], [null, 'the books do not reach a full week before it started', 0, 0],
    'with no full week before it, there is no before — and no week is called better or worse');
  eq(short.cells.slice(0, 2).map((c) => c.state), ['read', 'read'], 'its weeks are still read and shown');

  /* A LEVEL: money owed, stamped 102,672,963 the day it started (Mon 7
     Sep). Week ends 13, 20, 27 Sep and 4 Oct read 107m, 116m, 141m, 99m
     from the dated ledgers. It wants it DOWN: only 99m < 102.67m is
     better -> 1 of 4. */
  const OWED = { '2026-09-06': 110950363, '2026-09-13': 107000000, '2026-09-20': 116000000, '2026-09-27': 141000000, '2026-10-04': 99000000 };
  const debt = { label: 'money owed to you', unit: 'money', kind: 'level', direction: 'down', measure: () => 0 };
  const L = scope({ MANAGER_PROBLEM_METRICS: { debt }, receivablesAsAt: (d) => OWED[d] });
  const d = L.mgrPlayReads({ id: 2, treats: 'debt', started_on: '2026-09-07', weeks: 6, baseline: 102672963 }, TODAY, []);
  eq([d.before, d.beforeBasis], [102672963, 'stamped the day it started'],
    'a level is read against the stamp taken when it was switched on — the before the meeting reads too');
  eq(d.cells.map((c) => c.state), ['worse', 'worse', 'worse', 'better', 'open', 'open'], 'down is better for money owed');
  eq([d.k, d.n, d.latest], [1, 4, 99000000], 'better in 1 of 4 weeks; the latest is the 4 Oct ledger');
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
  eq([stamped.before, stamped.beforeBasis, stamped.n], [15000000, 'stamped the day it started', 0],
    'no snapshot at all: the stamp is the before, and no week can be read');

  /* NOTHING MEASURES IT */
  const none = scope().mgrPlayReads({ id: 4, treats: 'concentration', started_on: '2026-09-21' }, TODAY, []);
  eq([none.measured, none.why], [false, 'Nothing in the books measures depending on one buyer — you judge it by what you see.'],
    'a play nothing measures says so, rather than reaching for the nearest number');
  eq(scope().mgrPlayResult(none), { text: 'nothing in the books measures it', read: null }, 'and its verdict keeps no figure');
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
  const m = S.mgrPlayBoard(book, new Map(), TODAY);
  /* Ranked by the Manager's own sizing: 9,000,000 > 1,466,051 > 250,000. */
  eq(m.proposed.map((x) => x.p.name), ['Clashing', 'Big one', 'Small one'], 'proposals ranked by what each would add, as sized');
  eq(m.proposed.map((x) => x.level), ['cr', 'vg', 'vg'], 'the one clashing with a running play is marked');
  eq(m.lead.p.name, 'Big one', 'the lead is the biggest that fits a free slot — not the biggest that clashes');
  eq(m.slots, { used: 2, cap: 3, free: 1 }, 'two of three slots');
  /* Tried: 2 running + 3 judged + 1 dropped that had started = 6, since
     the first start on file, 20 May. Win rate: 2 of 3 judged worked. */
  eq([m.band.tried, m.band.since, m.band.verdicts, m.band.worked, m.band.proven], [6, '2026-05-20', 3, 2, 1],
    'the band: 6 tried since 20 May, 2/3 judged worked, 1 proven recipe');
  eq(m.judged.map((j) => j.id), [8, 7, 6], 'judged newest verdict first');
  eq(m.band.headline, 'A play is an experiment, not a wish. Friday chase is 3 days past its 4 weeks and needs your verdict. '
    + 'Big one is the one I’d start next: the biggest the meeting sized that fits a free slot.',
  'the sentence: what is past its span first, then the play it would start next');
  eq(m.band.lamp, 'am', 'and the lamp says something is waiting on the owner');
  book.running[0].clock = { past: false, daysLeft: 9, weeks: 6, noSpan: false };
  book.running.push({ id: 11, name: 'Hima', treats: 'other', started_on: '2026-09-25', clock: { noSpan: true, past: false } });
  const full = S.mgrPlayBoard(book, new Map(), TODAY);
  eq(full.band.headline, 'A play is an experiment, not a wish. Steel is due for your verdict in 2 days. '
    + 'All three slots are full, so nothing new starts until one is judged.', 'due within the week, and three slots full');
  eq(full.lead, null, 'with the slots full nothing leads');
  eq(S.mgrPlayBoard({ running: [], proposed: [], judged: [], proven: [], dropped: [] }, new Map(), TODAY).band.headline,
    'A play is an experiment, not a wish. Nothing is running yet — write one below.', 'an empty book says what to do next');
}

/* ---------- 6. write a play: the presets are this shop's own ---------- */
{
  /* Twelve finished weeks of sales, newest first: 10m, 20m ... 120m.
     The 75th percentile by nearest rank is the 9th of 12 sorted: 90m. */
  const weeks = Array.from({ length: 12 }, (_, i) => ({ from: shift(TODAY, -7 * (i + 1)), v: (i + 1) * 10e6 }));
  const sales = { label: 'sales', unit: 'money', kind: 'flow', direction: 'up',
    measure: (f) => (weeks.find((w) => w.from === f) || { v: 0 }).v };
  const S = scope({
    MANAGER_PROBLEM_METRICS: { growth: sales },
    MANAGER_METRICS: { debtors_total: { measure: () => 50000000 }, dead_stock_value: { measure: () => 13000000 } },
    mgrDebtorDays: () => ({ creditPerDay: 1000000, windowDays: 90 }),
    /* Two invoices on Saturday 3 Oct (16m in all), one on Monday 5 Oct
       (8m). Over 8 weeks: Saturday averages 16m/8 = 2m, Monday 1m. */
    anInvoicesInRange: () => [{ invoicedAt: '2026-10-03T09:00:00Z', total: 10e6 }, { date: '2026-10-03', total: 6e6 },
      { invoicedAt: '2026-10-05', total: 8e6 }],
    deadStockRows: () => [{ productId: 'P9', variantIdx: null, line: 'P9 — Floor tiles', value: 5000000, daysQuiet: 120 }],
    anRowsByItem: () => [{ name: 'Iron sheet', variant: 'Iron sheet — G28', sales: 5 }, { name: 'Roofing nails', variant: '', sales: 9 }],
    data: { products: [{ id: 'P9', name: 'Floor tiles' }], agents: [],
      staff: [{ name: 'Joan Nakato', role: 'counter' }, { name: 'Moses Kibirige', role: 'delivery' }] },
  });
  eq(S.mgrPlayP75([5, 1, 3, 2, 4, 6, 7, 8, 9, 10, 11, 12]), 9, 'p75 of 1..12 is the 9th: ceil(0.75 x 12) = 9');
  eq(S.mgrPlayP75([10, null]), 10, 'one value is its own p75; a missing one is left out');
  eq(S.mgrPlayP75([]), null, 'and none is not known');
  const P = S.mgrPlayPresets(TODAY);
  eq(P.map((p) => p.id), ['cash', 'sat', 'paint', 'moses'], 'the canvas’s four, each mapped onto a situation these books hold');
  /* cash: 50m owed less a week of credit sales, 7 x 1m = 43m. */
  eq([P[0].label, P[0].treats, P[0].weeks, P[0].target, P[0].stopBy, P[0].cost], ['Cash price', 'debt', 6, 43000000, 3, null],
    'cash price aims at money owed less a week of credit sales; its cost is the owner’s to write');
  eq([P[1].label, P[1].if, P[1].target, P[1].stopBy], ['Saturday delivery', 'deliver to builders’ sites on Saturdays', 90000000, 2],
    'the strongest weekday by the last 8 weeks’ sales, aimed at the 75th percentile week');
  t.check(/Saturday is your strongest day, 2m on average over the last 8/.test(P[1].aimBasis), 'and its basis says how it was chosen');
  /* paint: 13m dead less the 5m tiles = 8m; the best seller has no variant, so its name. */
  eq([P[2].label, P[2].name, P[2].treats, P[2].target], ['Floor tiles with every order', 'Floor tiles with every Roofing nails order', 'dead_stock', 8000000],
    'the biggest dead line offered with the best seller, aimed at dead stock less that line');
  eq([P[3].label, P[3].if, P[3].target, P[3].weeks, P[3].stopBy], ['Moses to new sites', 'send Moses to new building sites every week', 90000000, 8, 4],
    'the field hand on the books, by first name');
  const bare = scope({ MANAGER_PROBLEM_METRICS: { growth: { ...sales, measure: () => 0 } },
    MANAGER_METRICS: { debtors_total: { measure: () => 0 }, dead_stock_value: { measure: () => 0 } } }).mgrPlayPresets(TODAY);
  eq(bare, [], 'a shop whose books hold none of the four situations is offered none — only "your own"');
}

/* ---------- 7. the check before it starts, and the verdict ---------- */
{
  const S = scope();
  const sales = { label: 'sales', unit: 'money', kind: 'flow', direction: 'up' };
  const base = { measured: true, m: sales, base: 60000000, basis: 'the last 7 days' };
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
  /* Friday chase started 7 Sep for 42 days: its span ends 19 Oct. */
  eq([clash.verdict.h, clash.verdict.act], ['Wait.', 'queue'], 'a clash waits: it is queued, not started');
  t.check(/once “Friday chase” is judged \(its span ends 19 Oct\)/.test(clash.verdict.b), 'until the clashing play is judged, with the day its span ends');
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
  const book = await compileScope([extractFunction(src, 'managerPlaybook', 'index.html'),
    extractDeclaration(src, 'MANAGER_PROBLEMS', 'index.html')], {
    managerNotesTable: true, currentShopId: 'S', todayISO: () => TODAY,
    managerPlayProgress: () => null, managerPlayClock: () => null,
    sb: { from: () => { const q = {}; q.select = () => q; q.eq = () => q; q.order = () => q;
      q.limit = (n) => { q.lim = n; return Promise.resolve({ data: rows, error: null }); }; return q; } },
  }, ['managerPlaybook']).managerPlaybook();
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
})().then(() => {
  /* ---------- 10. the screen draws it all from these ---------- */
  const block = src.slice(src.indexOf('/* ═══ MGR BED: Plays — begin ═══ */\n/* ---- THE PLAYBOOK'),
    src.indexOf('/* ═══ MGR BED: Plays — end ═══ */\n/* ────'));
  t.check(block.length > 20000, 'the Plays block was found');
  const paint = extractFunction(src, 'mgrPaintPlays', 'index.html');
  t.check(/mgrPlayReads\(p, today, snaps\)/.test(paint) && /mgrPlayBoard\(book, reads, today\)/.test(paint),
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
  t.check(/managerAddOwnPlay\(name, d\.if, \{ status: act === 'queue' \? 'proposed' : 'running'/.test(design),
    'the designer saves through managerAddOwnPlay, starting it or queuing it');
  process.exit(t.done() ? 1 : 0);
}).catch((e) => { console.error(e); process.exit(1); });
