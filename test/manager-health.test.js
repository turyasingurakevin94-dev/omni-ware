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
  belowCost: { lines: 12, count: 0, loss: 0, worst: null },
  quiet: { count: 2, regulars: 15, names: ['Achen', 'Bosco'] },
  costRise: { trended: 8, count: 0, worst: null },
  concentration: { share: 0.6, top: 'Roofings', total: 10000000 },
  stopAt: { known: 0, owing: 3, unknownOwing: 3, past: [], near: [] },
  ordersLate: { open: 1, dated: 0, late: 0, worst: null },
  stockOut: { selling: 40, count: 0, names: [], soonest: null },
  deadStock: { value: 0, total: 10000000, share: 0, lines: 0, quietDays: 60 },
  daysOfStock: { days: 120.4, value: 10000000, cogsPerDay: 83056 },
  countAccuracy: null,
  wagesLate: { count: 0, amount: 0, dues: 0 },
  ratesMissing: { count: 0, staff: 0, names: [] },
  till: null, repeat: null, posts: null,
};
const H = compileScope([
  fn('mgrHealthChecks'), fn('mgrShortUGX'), fn('fmtShortDate'), fn('mgrPossessive'), fn('mgrHealthTrend'), fn('anShiftDate'),
  decl('MGR_HEALTH_CHECKS'), decl('MGR_DEPTS'), fn('mgrDeadWindow'), fn('deadStockQuietDays'),
], { mgrHealthFacts: () => FACTS, todayISO: () => TODAY, DASH_COST_RISE_PCT: 5, data: { presetDeadStockDays: 60 } }, ['mgrHealthChecks', 'mgrHealthTrend']);

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
  /* WAS: collectableDebts() with ageDays > 60 -- the WHOLE balance of any
     customer whose oldest charge was over 60 days (63.41m on the harness
     book, while the Brief's Cash to free read 38.05m).
     NOW: only the part of each balance over 60 days old, charge by charge
     (mgrChargesOver60 over customerOpenCharges), the Brief's own rule. */
  t.check(/collectableDebts\(\)/.test(facts) && /mgrChargesOver60\(customerOpenCharges\(cu\), today\)/.test(facts)
    && !/ageDays > 60/.test(facts), 'debt over 60 days is the part of each balance over 60 days old, charge by charge');
  t.check(/mgrDeadStockLines\(today\)/.test(facts) && !/dashInventoryHealth\(\)/.test(facts),
    'dead stock is the quiet window\'s lines valued as the register values them (mgrDeadStockLines), as the target, the Brief and the Simulator read it');
  t.check(/mgrDaysOfStock\(today\)/.test(facts) && /mgrDebtorDays\(today\)/.test(facts), 'days of stock and debtor days by the approved definitions');
  /* WAS: anShiftDate(today, -29) .. today -- today's unfinished day in
     it. NOW the 30 whole days to yesterday, as margin_pct and the
     Simulator read them (manager-shared-windows.test.js works it). */
  t.check(/anOverallTotals\(anInvoicesInRange\(anShiftDate\(today, -30\), anShiftDate\(today, -1\)\)\)/.test(facts),
    'margin over the 30 whole days to yesterday, as the Targets measure and the Simulator read it');
  t.check(/purchaseConcentration\(anShiftDate\(today, -89\), today\)/.test(facts), 'concentration is the Statements\' reading');
  t.check(/const watch = supplierPriceWatch\(\);/.test(facts) && /watch\.up\.filter\(s=> s\.risePct > DASH_COST_RISE_PCT\)/.test(facts),
    'and price rises the dashboard\'s');
  t.check(/mgrWageDueLate\(d, today, payday\)/.test(facts),
    'late wages are judged by the payday rule the cash walk dates them by — never dueIsOverdue on its own once a payday is set');
  t.check(/errors\.push\(name\)/.test(facts) && /console\.warn/.test(facts), 'a figure that cannot be read is named, and its checks read not known');
  const checks = extractDeclaration(src, 'MGR_HEALTH_CHECKS', 'index.html');
  t.check(!/because of|thanks to|it worked/i.test(checks), 'no check claims a cause');
}

/* ---------- 6. a book that cannot answer passes nothing --------------- */
{
  /* Everything a brand-new shop has: no floor set and nothing to stand in
     for one, no cash moved, nobody owing or owed, nothing invoiced or
     bought or sold, nobody on staff. Every check is "not known" -- not
     one passes on an empty book, so there is no score at all. */
  const EMPTY = {
    today: TODAY, errors: [],
    floor: { amount: 0, source: 'stand-in', note: 'not set — and no rent or salary is on the books to stand in' },
    tightest: { date: TODAY, balance: 0 },
    debt60: { amount: 0, count: 0, total: 0, oldest: null },
    bills: { owed: 0, count: 0, dated: 0, late: 0, lateAmount: 0 },
    loans: { open: 0, overdue: 0, amount: 0 },
    debtorDays: { days: null, receivables: 0, creditSales: 0, creditPerDay: 0, windowDays: 90 },
    margin: { pct: null, aim: 12, sales: 0 },
    belowCost: { lines: 0, count: 0, loss: 0, worst: null },
    quiet: { count: 0, regulars: 0, names: [] },
    costRise: { trended: 0, count: 0, worst: null },
    concentration: null,
    stopAt: { known: 0, owing: 0, unknownOwing: 0, past: [], near: [] },
    ordersLate: { open: 0, dated: 0, late: 0, worst: null },
    stockOut: { selling: 0, count: 0, names: [], soonest: null },
    deadStock: { value: 0, total: 0, share: null, lines: 0, quietDays: 60 },
    daysOfStock: { days: null, value: 0, cogsPerDay: 0 },
    countAccuracy: null,
    wagesLate: { count: 0, amount: 0, dues: 0 },
    ratesMissing: { count: 0, staff: 0, names: [] },
    till: null, repeat: null, posts: null,
  };
  const E = compileScope([
    fn('mgrHealthChecks'), fn('mgrShortUGX'), fn('fmtShortDate'), fn('mgrPossessive'),
    decl('MGR_HEALTH_CHECKS'), decl('MGR_DEPTS'), fn('mgrDeadWindow'), fn('deadStockQuietDays'),
  ], { mgrHealthFacts: () => EMPTY, todayISO: () => TODAY, DASH_COST_RISE_PCT: 5, data: { presetDeadStockDays: 60 } }, ['mgrHealthChecks']);
  const h = E.mgrHealthChecks();
  eq([h.known, h.passed, h.score], [0, 0, null], 'an empty book: nothing known, nothing passed, no score');
  const v = Object.fromEntries(h.checks.map((c) => [c.id, c.pass]));
  eq(['cash_floor', 'debt_60', 'below_cost', 'going_quiet', 'cost_rise', 'stock_out'].map((k) => v[k]),
    [null, null, null, null, null, null], 'the six that used to pass on nothing now say they cannot judge');
  const line = (id) => h.checks.find((c) => c.id === id).line;
  eq([line('cash_floor'), line('below_cost'), line('going_quiet'), line('cost_rise'), line('stock_out'), line('debt_60')],
    ['No floor set, and no rent or salary on the books to stand in for one', 'Nothing invoiced in 30 days',
      'No customer has bought twice yet — no rhythm to judge', 'No line bought often enough to see its price move',
      'Nothing sold off the shelf in 30 days to judge', 'No credit sales on the books to judge'],
    'and each says what is missing');
  eq(h.thin, ['finance', 'sales', 'procurement', 'store', 'people', 'marketing'], 'every department is thin');

  /* Even with no floor to judge against, running out of cash is known:
     the committed line below nothing fails. */
  const broke = E.mgrHealthChecks(null, { tightest: { date: '2026-10-20', balance: -400000 } });
  const cf = broke.checks.find((c) => c.id === 'cash_floor');
  eq([cf.pass, cf.figure, cf.threshold], [false, -400000, 0], 'no floor, but cash below nothing still fails');
  /* A floor of 0 the owner SET is a real floor: cash at 0 passes it. */
  const set0 = E.mgrHealthChecks(null, { floor: { amount: 0, source: 'set', note: 'the floor you set' } });
  eq(set0.checks.find((c) => c.id === 'cash_floor').pass, true, 'a floor of 0 the owner typed is judged like any floor');
  /* Debt with nobody owing but credit sold and paid in the window is a
     real pass, not a gap. */
  const paid = E.mgrHealthChecks(null, { debtorDays: { days: null, receivables: 0, creditSales: 900000, creditPerDay: 10000, windowDays: 90 } });
  eq(paid.checks.find((c) => c.id === 'debt_60').pass, true, 'credit sold and all of it paid: nothing past 60 days is known, and passes');
}

/* ---------- 7. debt past 60 days is counted charge by charge ---------- */
{
  /* Kato: charged 1,000,000 on 1 July (98 days before 7 October) and
     800,000 on 20 September (17 days), paid 600,000 on 10 August. The
     payment settles the oldest first, so 400,000 of July's charge is
     still open and over 60 days; September's 800,000 is young. Kato's
     balance is 1,200,000 and his oldest open charge is 98 days old -- the
     old reading counted all 1,200,000 as past 60 days; the part that is
     is 400,000.
     Exactly 60 days (8 August) is in "60 days or more", as the Debtors
     aging bands it (AGING_BANDS: 60 to 90 starts AT 60): counted. An
     undated charge has no age: not counted. */
  const S = compileScope([fn('mgrChargesOver60'), fn('customerOpenCharges'), fn('mgrBriefOver60'), fn('daysBetweenISO')],
    { todayISO: () => TODAY, promisesFor: () => [] }, ['mgrChargesOver60', 'customerOpenCharges', 'mgrBriefOver60']);
  const kato = { id: 1, debt: 1200000, debtLog: [
    { id: 1, type: 'charge', date: '2026-07-01', amount: 1000000 },
    { id: 2, type: 'payment', date: '2026-08-10', amount: 600000 },
    { id: 3, type: 'charge', date: '2026-09-20', amount: 800000 },
  ] };
  const ch = S.customerOpenCharges(kato);
  eq(S.mgrChargesOver60(ch, TODAY), { amount: 400000, oldest: '2026-07-01' }, 'Kato: 400,000 of 1,200,000 is over 60 days old, since 1 July');
  eq(S.mgrChargesOver60(ch, TODAY).amount, S.mgrBriefOver60(ch, TODAY), 'the same figure the Brief\'s Cash to free counts');
  const edge = [{ date: '2026-08-08', remaining: 500000 }, { date: '', remaining: 300000 }, { date: '2026-08-07', remaining: 200000 }];
  eq(S.mgrChargesOver60(edge, TODAY), { amount: 700000, oldest: '2026-08-07' }, 'exactly 60 days (500,000) and 61 days (200,000) are counted; undated is not');
  eq(S.mgrChargesOver60([], TODAY), { amount: 0, oldest: null }, 'nothing open: nothing past 60 days');
}

/* ---------- the snapshot says which debt60 it kept ------------------ */
{
  /* levels.debt60 changed meaning in Phase 3 (whole balance of an old
     customer -> the over-60 part charge by charge). A trend read across
     the two would invent a drop, so each snapshot marks its basis. */
  const S = compileScope([fn('mgrSnapshotBody')], {
    todayISO: () => TODAY,
    mgrHealthFacts: () => ({ debt60: { amount: 400000, count: 1, total: 1200000, oldest: null } }),
    mgrHealthChecks: () => ({ byDept: {}, checks: [], score: null, known: 0, passed: 0 }),
  }, ['mgrSnapshotBody']);
  const b = S.mgrSnapshotBody({});
  eq([b.levels.debt60, b.levels.debt60Basis], [400000, 'charge'], 'the over-60 part is kept, marked as counted charge by charge');
  const none = compileScope([fn('mgrSnapshotBody')], { todayISO: () => TODAY, mgrHealthFacts: () => ({}),
    mgrHealthChecks: () => ({ byDept: {}, checks: [], score: null, known: 0, passed: 0 }) }, ['mgrSnapshotBody']).mgrSnapshotBody({});
  eq([none.levels.debt60, none.levels.debt60Basis], [null, null], 'and no figure carries no basis');
}

/* ---------- 8. dead stock says what it counted (Q43) ------------------ */
{
  /* 13,685,508 of a 187,630,801 shelf, 6 lines, nothing sold in 60 days:
     13.69m, 13,685,508 / 187,630,801 = 7.29% -> 7%. The check's label and
     line say "no sale in 60 days"; with the shop's window at 45, 45. */
  const dead = { value: 13685508, total: 187630801, share: 13685508 / 187630801, lines: 6, quietDays: 60 };
  const c = H.mgrHealthChecks(null, { deadStock: dead }).checks.find((x) => x.id === 'dead_stock');
  eq([c.pass, c.label, c.rule, c.line], [false, 'No dead stock — no sale in 60 days', 'nothing with no sale in 60 days',
    '13.69m of dead stock — no sale in 60 days — 7% of the shelf, 6 lines'], 'a failing dead-stock check names its window');
  const c45 = H.mgrHealthChecks(null, { deadStock: { ...dead, quietDays: 45 } }).checks.find((x) => x.id === 'dead_stock');
  eq([c45.label, c45.line], ['No dead stock — no sale in 45 days', '13.69m of dead stock — no sale in 45 days — 7% of the shelf, 6 lines'],
    'the shop\'s own quiet window, never a literal 60');
  const ok = H.mgrHealthChecks().checks.find((x) => x.id === 'dead_stock');
  eq([ok.pass, ok.line], [true, 'No dead stock — every line on the shelf has sold in the last 60 days'], 'a passing check says the same window');
  /* Targets: the measure is named and explained with the window. */
  const T = compileScope([fn('mgrTgName'), fn('mgrTgFig'), fn('mgrDeadWindow'), fn('deadStockQuietDays')], {
    data: { presetDeadStockDays: 60 }, MANAGER_METRICS: { dead_stock_value: { label: 'Dead stock', unit: 'ugx', direction: 'down' } } }, ['mgrTgName']);
  eq(T.mgrTgName('dead_stock_value', 6000000), 'Dead stock (no sale in 60 days) under 6.00m', 'a dead-stock target names its window');
  const M = compileScope([decl('MANAGER_METRICS'), fn('mgrDeadWindow'), fn('deadStockQuietDays'), 'function metrics(){ return MANAGER_METRICS; }'],
    { data: { presetDeadStockDays: 45 } }, ['metrics']).metrics();
  t.check(/^stock with no sale in 45 days; /.test(M.dead_stock_value.basis), 'the measure\'s basis reads the window when shown (45 here)');
  t.check(/x\.metric === 'dead_stock_value' \? x\.label \+ ' \(' \+ mgrDeadWindow\(\) \+ '\)'/.test(fn('mgrProposalHTML'))
    && /x\.k === 'dead_stock_value' \? `<small>\$\{esc\(mgrDeadWindow\(\)\)\}<\/small>`/.test(src),
  'the Targets proposal card and the composer\'s measure chip carry the window');
  /* The meeting and Today's alert. */
  t.check(/counted_as: mgrDeadWindow\(deadStockQuietDays\(\)\)/.test(src), 'the meeting is told what dead stock counted');
  t.check(/of dead stock — \$\{mgrDeadWindow\(\)\}/.test(src) && !/of stock has not sold in 60 days/.test(src), 'Today\'s alert no longer hard-codes 60 days');
}

process.exit(t.done() ? 1 : 0);
