#!/usr/bin/env node
'use strict';
/*
 * What could hurt in the next 30 days (A2.5), and the figures the
 * health checks read off the books.
 *
 * A risk is DATED, every one -- a worry without a day is not on this
 * list. Something already past its day is due today and says it is
 * overdue; a supplier's stop-at deadline exists only where the owner
 * wrote the supplier's terms down (0107); the floor is the owner's, or
 * the stand-in, and the cash line is the committed one.
 *
 * Today is 7 October 2026; the window ends 6 November.
 *
 * Run: node test/manager-risks.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('manager risks');
const src = read('index.html');
const fn = (n) => extractFunction(src, n, 'index.html');
const decl = (n) => extractDeclaration(src, n, 'index.html');
const eq = (got, want, msg) => t.check(JSON.stringify(got) === JSON.stringify(want),
  `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);
const TODAY = '2026-10-07';

/* ---------- 1. the risks ------------------------------------------------ */
{
  const data = {
    suppliers: [{ id: 'S1', name: 'Steel & Tube', stopAtDays: 90 }, { id: 'S2', name: 'Roofings', stopAtDays: 100 }, { id: 'S3', name: 'Kasubi' }],
    dues: [{ id: 7, kind: 'rent', refId: 'R1', period: '2026-10', dueDate: '2026-10-05', amount: 2500000, paid: 0 },
      { id: 8, kind: 'wage', refId: 'ST1', period: '2026-10', dueDate: '2026-10-31', amount: 600000, paid: 0 }],
    customers: [{ id: 'C1', name: 'Achieng', debt: 1000000 }, { id: 'C2', name: 'Okot', debt: 800000 }],
    loans: [],
  };
  const open = [
    { invoice: { id: 891, date: '2026-07-25' }, supplierId: 'S1', due: 5670120, dueOn: '2026-09-30', missedOwnWord: true, ageDays: 74 },
    { invoice: { id: 964, date: '2026-08-28' }, supplierId: 'S2', due: 5272994, dueOn: null, missedOwnWord: false, ageDays: 40 },
    { invoice: { id: 970, date: '2026-06-01' }, supplierId: 'S3', due: 100000, dueOn: null, missedOwnWord: false, ageDays: 128 },
  ];
  const walk = { days: [
    { date: '2026-10-07', committed: 5000000, events: [] },
    { date: '2026-10-08', committed: 5000000, events: [] },
    { date: '2026-10-15', committed: 2900000, events: [{ line: 'committed', label: 'Roofings — bill' }] },
    { date: '2026-10-16', committed: 2800000, events: [] },
    { date: '2026-10-20', committed: -100000, events: [{ line: 'committed', label: 'Shop — rent' }] },
  ] };
  const s = compileScope([fn('mgrRisks30'), fn('anShiftDate'), fn('dueIsOverdue'), fn('dueBalance'), fn('periodLabel'), fn('mgrDept'),
    fn('mgrShortUGX'), fn('fmtShortDate'), fn('mgrPossessive'), fn('purchaseInvoiceNumberLabel'), decl('MGR_DEPTS')], {
    data, todayISO: () => TODAY,
    mgrCashFloor: () => ({ amount: 3000000, source: 'set' }),
    mgrCashWalk: () => walk,
    credOpenInvoices: () => open,
    loansNeedingPayment: () => [{ loan: { id: 4, lender: 'Centenary' }, due: { status: 'overdue', overdue: 1833599, dueNow: 1833599 } }],
    buyOrdersOnTheWay: () => new Map([['P4', { qty: 10 }]]),
    supplierLeadTimes: () => [{ supplierId: 'S1', days: 3, typical: true }, { supplierId: 'S2', days: 9, typical: false }],
    restockRiskRows: () => [
      { key: 'P1', name: 'Simba cement', qty: 46, dailyRate: 10, daysLeft: 4.6 },
      { key: 'P2', name: 'Hoop iron', qty: 5, dailyRate: 2, daysLeft: 2.5 },
      { key: 'P3', name: 'Nails', qty: 120, dailyRate: 10, daysLeft: 12 },
      { key: 'P4', name: 'Y12', qty: 2, dailyRate: 2, daysLeft: 1 },
      { key: 'P5', name: 'Wire', qty: 6, dailyRate: 1, daysLeft: 6 },
    ],
    mgrLineSupplier: (k) => ({ P1: { supplierId: 'S1' }, P2: { supplierId: 'S1' }, P5: { supplierId: 'S2' } })[k] || null,
    promiseLatest: (id) => (id === 'C1' ? { promisedOn: '2026-10-03', amount: 1000000, state: 'broken' } : { promisedOn: '2026-10-09', amount: 800000, state: 'waiting' }),
    supplierName: (id) => ({ S1: 'Steel & Tube', S2: 'Roofings', S3: 'Kasubi' })[id],
    dueName: (d) => (d.kind === 'rent' ? 'Shop and store' : 'Joan'),
  }, ['mgrRisks30']);
  const r = s.mgrRisks30({ playsPastSpan: [{ id: 3, name: 'Friday chase round', endsOn: '2026-10-02' }] });
  const row = (id) => r.find((x) => x.id === id);

  t.check(r.every((x) => /^\d{4}-\d{2}-\d{2}$/.test(x.date) && x.date >= TODAY && x.date <= '2026-11-06'),
    'every risk carries a day, inside the next 30');
  eq(r.map((x) => x.date), r.map((x) => x.date).slice().sort(), 'and they come in the order they fall');

  /* The committed line first goes under the 3,000,000 floor on the 15th
     (2.9m), and below nothing on the 20th. */
  eq([row('floor:2026-10-15').amount, row('floor:2026-10-15').label], [2900000, 'Cash falls under your floor'],
    'the day cash goes under the floor, with the balance');
  t.check(/after Roofings — bill/.test(row('floor:2026-10-15').detail), 'and what took it there');
  eq(row('cash:2026-10-20').amount, -100000, 'and the day it would go below nothing');

  const bill = row('bill:891');
  eq([bill.date, bill.overdue, bill.dueOn, bill.amount], [TODAY, true, '2026-09-30', 5670120],
    'a bill past the day the owner named is due today, and says when it was due');
  /* Steel & Tube stop at 90: their oldest bill, 25 July, reaches 90 days
     on 25 Jul + 90 = 23 October. Roofings stop at 100: 28 Aug + 100 =
     6 December, beyond the window. Kasubi have no terms written. */
  eq(row('supplier:S1') && [row('supplier:S1').date, row('supplier:S1').amount], ['2026-10-23', 5670120],
    'a supplier\'s stop-at deadline is the oldest bill\'s date plus their stop-at age');
  t.check(!row('supplier:S2') && !row('supplier:S3'), 'one beyond the window, and one with no terms, are not risks');
  t.check(/Steel & Tube stops delivering/.test(row('supplier:S1').label), 'and says what happens');

  eq([row('loan:4').date, row('loan:4').overdue], [TODAY, true], 'a loan behind is due today and overdue');
  eq([row('due:7').date, row('due:7').overdue, row('due:7').dept, row('due:7').amount], [TODAY, true, 'finance', 2500000],
    'rent past its day');
  t.check(!row('due:8'), 'a wage not yet due is not a risk');

  /* Stock: cement, 46 at 10 a day → out on 7 + 4 = 11 Oct; Steel & Tube
     take 3 days → order by 11 − 3 − 1 = 7 Oct, today. Hoop iron, 2.5
     days → out 9 Oct; ordering by 5 Oct is already past. Wire's supplier
     has one delivery only: lead not measured. Nails at 12 days and Y12
     already on order are not risks. */
  eq([row('stock:P1').date, row('stock:P1').lastOrderOn], ['2026-10-11', '2026-10-07'], 'the run-out day and the last day to order');
  t.check(/order from Steel & Tube by 7 Oct 2026 \(3-day lead time\)/.test(row('stock:P1').detail), 'said in the shop\'s words');
  t.check(/already inside Steel & Tube's 3-day lead time/.test(row('stock:P2').detail), 'too late to restock in time is said plainly');
  t.check(/lead time not measured/.test(row('stock:P5').detail) && !('lastOrderOn' in row('stock:P5')),
    'one delivery is not a lead time — no last day is invented');
  t.check(!row('stock:P3') && !row('stock:P4'), 'twelve days left, or already on order, is not a risk');

  eq([row('promise:C1').date, row('promise:C1').overdue, row('promise:C1').dueOn], [TODAY, true, '2026-10-03'], 'a broken promise');
  t.check(!row('promise:C2'), 'a promise still waiting is not');
  eq(row('play:3') && row('play:3').label, 'Friday chase round — past its span', 'a play past its span, when the playbook was read');
}

/* ---------- 2. the facts the checks read ------------------------------ */
{
  const data = {
    suppliers: [{ id: 'S1', name: 'Steel & Tube', stopAtDays: 90 }, { id: 'S2', name: 'Roofings', stopAtDays: 60 }, { id: 'S3', name: 'Kasubi' }],
    cashDays: { '2026-10-05': { actual: { cash: 100, momo: null, bank: null } }, '2026-10-06': { actual: { cash: 200 } }, '2026-08-01': { actual: { cash: 1 } } },
    cashTxns: [
      { date: '2026-09-29', type: 'payment', category: 'Cash Shortage', amount: 85000 },
      { date: '2026-09-29', type: 'payment', category: 'Cash Shortage', amount: 15000 },
      { date: '2026-09-14', type: 'receipt', category: 'Cash Overage', amount: 10000 },
      { date: '2026-08-01', type: 'payment', category: 'Cash Shortage', amount: 99999 },
    ],
    waPosts: [
      // 30-day windows back from today: 0-29 → 2 posts; 30-59 → 3; 60-89 → 1; 90-119 → 4. Usual = median(3, 1, 4) = 3.
      ...['2026-10-01', '2026-09-20'], ...['2026-09-01', '2026-08-25', '2026-08-20'], ...['2026-07-20'], ...['2026-06-20', '2026-06-18', '2026-06-16', '2026-06-12'],
    ].map((date) => ({ date })),
    presetStockCounts: {},
    staff: [], dues: [], loans: [], customers: [],
  };
  const open = [
    { invoice: { id: 1, date: '2026-07-25' }, supplierId: 'S1', due: 100, ageDays: 74 },
    { invoice: { id: 2, date: '2026-09-07' }, supplierId: 'S1', due: 100, ageDays: 30 },
    { invoice: { id: 3, date: '2026-08-01' }, supplierId: 'S2', due: 100, ageDays: 67 },
    { invoice: { id: 4, date: '2026-09-01' }, supplierId: 'S3', due: 100, ageDays: 36 },
  ];
  const s = compileScope([fn('mgrHealthFactsBuild'), fn('anShiftDate'), fn('waDaysBetween'), fn('mgrMedian'), fn('cashIsMoneyIn'), fn('cashIsMoneyOut'),
    fn('cashIsCashShortage'), fn('cashIsCashOverage'), decl('CASH_SHORTAGE_CATEGORY'), decl('CASH_OVERAGE_CATEGORY')], {
    data, todayISO: () => TODAY,
    credOpenInvoices: () => open,
    invCountRecords: () => [
      { key: 'A', date: '2026-10-03', found: 10, record: 10, kept: true }, { key: 'B', date: '2026-10-03', found: 4, record: 9, kept: true },
      { key: 'C', date: '2026-09-01', found: 7, record: 7, kept: true }, { key: 'D', date: '2026-09-01', found: 1, record: 2 },
      { key: 'E', date: '2026-05-01', found: 1, record: 1, kept: true }],
    // Everything else the builder reads, made to throw: a figure that cannot be read is named and left not known.
    ...Object.fromEntries(['mgrCashFloor', 'mgrCashWalk', 'collectableDebts', 'loansNeedingPayment', 'mgrDebtorDays', 'anOverallTotals',
      'anInvoicesInRange', 'anRowsByItem', 'dashGoingQuietCustomers', 'buyOrdersOpenRows', 'supplierPriceWatch', 'purchaseConcentration',
      'dashInventoryHealth', 'stockAgeRows', 'deadStockQuietDays', 'mgrDaysOfStock', 'buyOrdersOnTheWay', 'restockRiskRows', 'dueIsOverdue',
      'dueBalance', 'staffWithoutPayRate', 'managerGrowthBaseline', 'targetMarginPct', 'daysBetweenISO'].map((k) => [k, () => { throw new Error(k + ' is down'); }])),
    console: { warn() {} },
  }, ['mgrHealthFactsBuild']);
  const f = s.mgrHealthFactsBuild({});
  /* Steel & Tube's oldest is 74 days of their 90: 16 left, so near.
     Roofings' 67 is past their 60: past. Kasubi have no terms. */
  eq([f.stopAt.known, f.stopAt.past.map((x) => [x.supplier, x.age, x.left]), f.stopAt.near.map((x) => [x.supplier, x.left]), f.stopAt.unknownOwing],
    [2, [['Roofings', 67, -7]], [['Steel & Tube', 16]], 1], 'supplier terms against the oldest bill of each');
  /* Counted days in the 30 before today: 5 and 6 Oct (1 Aug is out).
     Shortage booked on one day, 29 Sep, 100,000; an overage on 14 Sep. */
  eq(f.till, { counted: 2, shortDays: 1, overDays: 1, short: 100000, over: 10000 }, 'the till, per day — never per person');
  eq([f.posts.recent, f.posts.prior, f.posts.usual], [2, [3, 1, 4], 3], 'posts in 30 days against the median of the three months before');
  /* Kept counts in 90 days: A matched, B did not, C matched (D was not
     kept, E is too old): 2 of 3 = 66.7%. */
  eq([Math.round(f.countAccuracy.pct * 10) / 10, f.countAccuracy.n], [66.7, 3], 'count accuracy over kept counts, 90 days');
  t.check(f.tightest === undefined && f.errors.includes('cash') && f.errors.includes('debt') && f.errors.includes('margin'),
    'a reading that throws is named in errors and left undefined — its check says it could not be read');
}

process.exit(t.done() ? 1 : 0);
