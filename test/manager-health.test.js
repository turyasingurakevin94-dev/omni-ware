#!/usr/bin/env node
'use strict';
/*
 * The shop's health, as a share of named checks (Q1), each with its
 * figure and its rule; the department lines (A3.3); the week's trend from
 * the daily snapshots (only once seven exist); and the figures the
 * checks read -- debtor days on CREDIT sales (Q18) and days of stock the
 * Inventory screen's way (Q17).
 *
 * Every expectation below is worked by hand from the small book beside
 * it, and the working is written next to it.
 *
 * Run: node test/manager-health.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('manager health');
const src = read('index.html');
const fn = (n) => extractFunction(src, n, 'index.html');
const decl = (n) => extractDeclaration(src, n, 'index.html');
const eq = (got, want, msg) => t.check(JSON.stringify(got) === JSON.stringify(want),
  `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);
const TODAY = '2026-10-07';

/* ---------- 1. the checks, judged on a hand-made reading ------------- */
const FACTS = {
  today: TODAY, errors: [],
  floor: { amount: 3000000, source: 'set', note: 'the floor you set' },
  tightest: { date: '2026-10-20', balance: 2500000 },
  debt60: { amount: 0, count: 0, total: 5000000, oldest: null },
  bills: { owed: 900000, count: 3, dated: 0, late: 0, lateAmount: 0 },
  loans: { open: 0, overdue: 0, amount: 0 },
  debtorDays: { days: 22.4, receivables: 5000000, creditSales: 20000000, creditPerDay: 222222, windowDays: 90 },
  margin: { pct: 14.2, aim: 12, sales: 30000000 },
  belowCost: { count: 0, loss: 0, worst: null },
  quiet: { count: 2, names: ['Achen', 'Bosco'] },
  costRise: { count: 0, worst: null },
  concentration: { share: 0.6, top: 'Roofings', total: 10000000 },
  stopAt: { known: 0, owing: 3, unknownOwing: 3, past: [], near: [] },
  ordersLate: { open: 1, dated: 0, late: 0, worst: null },
  stockOut: { count: 0, names: [], soonest: null },
  deadStock: { value: 0, total: 10000000, share: 0, lines: 0, quietDays: 60 },
  daysOfStock: { days: 120.4, value: 10000000, cogsPerDay: 83056 },
  countAccuracy: null,
  wagesLate: { count: 0, amount: 0, dues: 0 },
  ratesMissing: { count: 0, staff: 0, names: [] },
  till: null, repeat: null, posts: null,
};
const H = compileScope([
  fn('mgrHealthChecks'), fn('mgrShortUGX'), fn('fmtShortDate'), fn('mgrPossessive'), fn('mgrHealthTrend'), fn('anShiftDate'),
  decl('MGR_HEALTH_CHECKS'), decl('MGR_DEPTS'),
], { mgrHealthFacts: () => FACTS, todayISO: () => TODAY, DASH_COST_RISE_PCT: 5 }, ['mgrHealthChecks', 'mgrHealthTrend']);

{
  const h = H.mgrHealthChecks();
  const ids = h.checks.map((c) => c.id);
  eq(ids.length, 21, 'twenty-one named checks: finance 5, sales 3, procurement 4, store 4, people 3, marketing 2');
  t.check(h.checks.every((c) => c.label && c.dept && 'pass' in c && 'figure' in c && 'threshold' in c && 'source' in c && 'line' in c),
    'each carries its label, department, verdict, figure, rule threshold, source and a sentence');
  const v = Object.fromEntries(h.checks.map((c) => [c.id, c.pass]));
  /* Known and passed:
       cash_floor   2.5m < 3m floor          FAIL
       debt_60      nothing past 60 days     pass
       debtor_days  22 ≤ 30                  pass
       margin       14.2% ≥ 12%              pass
       below_cost   none                     pass
       going_quiet  2 customers              FAIL
       cost_rise    none                     pass
       one_supplier 60% ≥ 50%                FAIL
       stock_out    none                     pass
       dead_stock   0 of 10m                 pass
       stock_days   120 > 90                 FAIL
     Not known (no dated bill, no loan, no supplier terms, no dated
     order, no count, no wages raised, no staff, no till count, too few
     new customers, no posts): left out. 7 of 11 → 63.6 → 64. */
  eq([v.cash_floor, v.debt_60, v.debtor_days, v.margin, v.below_cost, v.going_quiet, v.cost_rise, v.one_supplier,
    v.stock_out, v.dead_stock, v.stock_days], [false, true, true, true, true, false, true, false, true, true, false],
  'each known check judged by its rule');
  eq(['bills_late', 'loans', 'stop_at', 'orders_late', 'count_accuracy', 'wages_late', 'pay_rates', 'till', 'repeat', 'posting'].map((k) => v[k]),
    [null, null, null, null, null, null, null, null, null, null], 'and every check the books cannot answer is null — not passed, not failed');
  eq([h.known, h.passed, h.score], [11, 7, 64], 'the score is passed ÷ known × 100, rounded: 7 of 11 → 64');

  /* Departments: finance 2 of 3 → 67, its line the first failing check;
     sales 2 of 3 → 67; procurement 1 of 2 → 50; store 2 of 3 → 67;
     people and marketing have no known check -- thin, no score. */
  const d = h.byDept;
  eq(['finance', 'sales', 'procurement', 'store', 'people', 'marketing'].map((k) => d[k].score), [67, 67, 50, 67, null, null],
    'each department scored on its own checks');
  eq(d.finance.line, 'Cash falls to 2.5m on 20 Oct 2026, under your 3m floor', 'finance\'s line is its worst check, with the figure');
  eq(d.sales.line, '2 regular customers have gone quiet — Achen, Bosco', 'sales\' line likewise');
  eq(d.procurement.line, 'Roofings holds 60% of your buying', 'procurement\'s');
  eq(d.store.line, '120 days of stock on the shelf — the healthy range is 90', 'store\'s');
  eq([d.people.line, d.marketing.line], ['Not enough on the books to judge', 'Not enough on the books to judge'],
    'a department with fewer than two known checks says there is not enough on the books');
  eq(h.thin, ['people', 'marketing'], 'and is listed as thin');
  const notKnown = h.checks.find((c) => c.id === 'stop_at');
  eq(notKnown.line, 'Terms not known for the 3 suppliers you owe', 'a not-known check says what is missing');

  /* The Simulator's ripple: the same rules on changed figures. Lowest
     cash 3.5m (≥ 3m) and 80 days of stock (≤ 90) turn two fails to
     passes: 9 of 11 → 81.8 → 82. */
  const s = H.mgrHealthChecks(null, { tightest: { date: '2026-10-20', balance: 3500000 }, daysOfStock: { days: 80 } });
  eq([s.score, s.scenario, s.byDept.finance.score], [82, true, 100], 'a scenario is judged by the same checks');
  const again = H.mgrHealthChecks();
  eq(again.score, 64, 'and today\'s reading is not changed by it');

  const one = H.mgrHealthChecks(null, { posts: { recent: 1, usual: 3, prior: [3, 3, 3] } });
  eq([one.byDept.marketing.thin, one.byDept.marketing.score, one.byDept.marketing.line, one.byDept.marketing.worstLine],
    [true, null, 'Not enough on the books to judge', '1 post in 30 days — usually 3'],
    'one known check is still thin — no score, the thin line — and its failing check travels for the tap');
  const some = H.mgrHealthChecks(null, { stopAt: { known: 1, owing: 3, unknownOwing: 2, past: [], near: [] } });
  const st = some.checks.find((c) => c.id === 'stop_at');
  eq([st.pass, st.note], [true, 'terms not known for 2 suppliers you owe'], 'and a check that can only partly see says what it cannot');
  const stand = H.mgrHealthChecks(null, { floor: { amount: 4200000, source: 'stand-in', note: 'not set' } });
  t.check(/under the stand-in 4\.2m floor/.test(stand.byDept.finance.line), 'a stand-in floor is called the stand-in, never yours');
}

/* ---------- 2. the trend waits for seven days ------------------------- */
{
  const snap = (date, score, fin) => ({ date, body: { score, depts: { finance: { score: fin } } } });
  const six = ['2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07'].map((d, i) => snap(d, 50 + i, 40));
  eq(H.mgrHealthTrend(six), null, 'six days of snapshots give no trend');
  const seven = [snap('2026-10-01', 50, 40)].concat(six.map((s, i) => snap(s.date, [52, 51, 55, 56, 58, 60][i], 40 + i)));
  const tr = H.mgrHealthTrend(seven);
  /* Latest 7 Oct at 60; the week runs back to 1 Oct (7 − 6), at 50: +10.
     Finance 45 (the sixth) − 40 = +5. */
  eq([tr.change, tr.from, tr.to, tr.snapshots, tr.byDept.finance], [10, { date: '2026-10-01', score: 50 }, { date: '2026-10-07', score: 60 }, 7, 5],
    'seven daily snapshots give the change across the week');
  const gaps = [snap('2026-09-28', 70, 1), snap('2026-10-01', 66, 1), snap('2026-10-03', 64, 1), snap('2026-10-04', 63, 1),
    snap('2026-10-05', 62, 1), snap('2026-10-06', 61, 1), snap('2026-10-07', 61, 1)];
  eq(H.mgrHealthTrend(gaps).change, -5, 'with gaps, from the latest snapshot at least six days back (1 Oct, 66 → 61)');
  const dup = seven.concat([snap('2026-10-07', 60, 46)]);
  eq(H.mgrHealthTrend(dup).snapshots, 7, 'a day written twice counts once');
}

/* ---------- 3. debtor days on credit sales (Q18) ---------------------- */
{
  const data = {
    savedQuotes: [
      // Paid 400,000 on the day of 1,000,000: 600,000 went on credit.
      { id: 1, status: 'completed', invoiced: true, invoicedAt: '2026-09-01', total: 1000000,
        payments: [{ date: '2026-09-01', amount: 400000 }, { date: '2026-09-20', amount: 600000 }] },
      // A counter sale paid at the till: no payments record, amountPaid in full -- no credit.
      { id: 2, status: 'completed', invoiced: true, invoicedAt: '2026-09-15', total: 500000, payments: [], amountPaid: 500000 },
      // Nothing paid: 900,000 on credit.
      { id: 3, status: 'completed', invoiced: true, invoicedAt: '2026-10-01', total: 900000, payments: [], amountPaid: 0 },
      // Voided and too old: not sales here.
      { id: 4, status: 'completed', invoiced: true, voided: true, invoicedAt: '2026-10-02', total: 7000000, payments: [] },
      { id: 5, status: 'completed', invoiced: true, invoicedAt: '2026-06-01', total: 8000000, payments: [] },
    ],
    customers: [{ id: 'C1', debt: 1000000 }, { id: 'C2', debt: 0 }, { id: 'C3', debt: -50 }],
  };
  const s = compileScope([fn('mgrDebtorDays'), fn('anInvoicesInRange'), fn('anShiftDate')],
    { data, todayISO: () => TODAY, savedQuoteTotal: (q) => q.total }, ['mgrDebtorDays']);
  /* Window: 90 days to 7 Oct, from 10 Jul. Credit sales 600,000 +
     900,000 = 1,500,000 → 16,667 a day. Owed 1,000,000 (a credit balance
     is not owed). 1,000,000 ÷ (1,500,000 ÷ 90) = 60 days. */
  const d = s.mgrDebtorDays(TODAY);
  eq([d.creditSales, d.receivables, Math.round(d.days), d.windowDays], [1500000, 1000000, 60, 90],
    'what customers owe over what was sold on credit a day');
  data.savedQuotes = data.savedQuotes.filter((q) => q.id === 2);
  eq(s.mgrDebtorDays(TODAY).days, null, 'with no credit sale in the window, debtor days are not known — never 0');
}

/* ---------- 4. days of stock, the Inventory screen's way (Q17) -------- */
{
  const lines = {
    P1: { p: { id: 'P1' }, variantIdx: null, qty: 10, value: 100000, unitCost: 10000 },
    P2: { p: { id: 'P2' }, variantIdx: null, qty: 0, value: null, unitCost: 5000 },
  };
  const data = { stockLog: [
    { key: 'P1', type: 'sale', delta: -3, date: '2026-10-01' },      // 3 × 10,000 = 30,000
    { key: 'P2', type: 'sale', delta: -2, date: '2026-09-20' },      // empty shelf: its unit cost, 2 × 5,000 = 10,000
    { key: 'P1', type: 'reversal', delta: 1, date: '2026-10-02' },   // a sale taken back: −10,000
    { key: 'P1', type: 'sale', delta: -5, date: '2026-09-01' },      // 36 days ago: outside the 30
    { key: 'P1', type: 'restock', delta: 10, date: '2026-10-03' },   // not a sale
  ] };
  const s = compileScope([fn('mgrDaysOfStock'), fn('stockKey'), fn('waDaysBetween')], {
    data, todayISO: () => TODAY,
    allProductVariantEntries: () => [{ p: { id: 'P1' }, variantIdx: null }, { p: { id: 'P2' }, variantIdx: null }],
    inventoryLineFor: (p) => lines[p.id],
  }, ['mgrDaysOfStock']);
  /* Shelf at cost 100,000 (P2's null value adds nothing). Sold at cost
     over 30 days: 30,000 + 10,000 − 10,000 = 30,000 → 1,000 a day.
     100,000 ÷ 1,000 = 100 days. */
  const d = s.mgrDaysOfStock(TODAY);
  eq([d.value, d.cogsPerDay, d.days], [100000, 1000, 100], 'shelf value over the shelf\'s cost of goods a day');
  const inv = extractFunction(src, 'invVitalsHTML', 'index.html');
  t.check(/vals\[i\] \/ \(c \/ 30\)/.test(inv), 'which is the Inventory vital sign\'s own sum, so the two cannot differ');
  data.stockLog = [];
  eq(s.mgrDaysOfStock(TODAY).days, null, 'nothing sold off the shelf: not known');
}

/* ---------- 5. the facts are read, not invented ----------------------- */
{
  const facts = extractFunction(src, 'mgrHealthFactsBuild', 'index.html');
  t.check(/collectableDebts\(\)/.test(facts) && /ageDays > 60/.test(facts), 'debt over 60 days is the Debtors\' own reading');
  t.check(/dashInventoryHealth\(\)/.test(facts), 'dead stock is dashInventoryHealth\'s — the quiet window, as the target uses');
  t.check(/mgrDaysOfStock\(today\)/.test(facts) && /mgrDebtorDays\(today\)/.test(facts), 'days of stock and debtor days by the approved definitions');
  t.check(/anOverallTotals\(anInvoicesInRange\(anShiftDate\(today, -29\), today\)\)/.test(facts),
    'margin over 30 days is the hero\'s own reading');
  t.check(/purchaseConcentration\(anShiftDate\(today, -89\), today\)/.test(facts), 'concentration is the Statements\' reading');
  t.check(/supplierPriceWatch\(\)\.up\.filter\(s=> s\.risePct > DASH_COST_RISE_PCT\)/.test(facts), 'and price rises the dashboard\'s');
  t.check(/errors\.push\(name\)/.test(facts) && /console\.warn/.test(facts), 'a figure that cannot be read is named, and its checks read not known');
  const checks = extractDeclaration(src, 'MGR_HEALTH_CHECKS', 'index.html');
  t.check(!/because of|thanks to|it worked/i.test(checks), 'no check claims a cause');
}

process.exit(t.done() ? 1 : 0);
