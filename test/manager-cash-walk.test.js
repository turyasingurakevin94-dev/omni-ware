#!/usr/bin/env node
'use strict';
/*
 * The Manager's thirty days of cash ahead (mgrCashWalk).
 *
 * Two lines and never one. COMMITTED is the law's line: cash on hand less
 * every dated commitment cashAhead already carries, with wages moved to
 * the owner's payday -- nothing coming in, ever. EXPECTED is a separate
 * band with its method: what customers are expected to pay (a day they
 * named; the chase lag in k of n) and a usual day's trading by weekday.
 *
 * cashAhead is stubbed with a hand-made reading here -- its own tests pin
 * how it builds commitments -- so every figure below is arithmetic on a
 * book small enough to add up by hand, and each sum is written out.
 *
 * Today is Wednesday 7 October 2026 (waWeekday 3); 30 days runs to
 * Friday 6 November.
 *
 * Run: node test/manager-cash-walk.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('manager cash walk');
const src = read('index.html');
const fn = (n) => extractFunction(src, n, 'index.html');
const decl = (n) => extractDeclaration(src, n, 'index.html');
const eq = (got, want, msg) => t.check(JSON.stringify(got) === JSON.stringify(want),
  `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);

const TODAY = '2026-10-07';
const SOURCES = [
  ...['anShiftDate', 'daysBetweenISO', 'waWeekday', 'periodOf', 'periodShift', 'periodEndDate', 'periodLabel',
    'findDue', 'dueBalance', 'staffOnPayroll', 'basisMonthCost', 'basisDayRate',
    'cashIsMoneyIn', 'cashIsMoneyOut', 'cashIsTradingIncome', 'cashIsDebtCollection', 'cashIsOperatingExpense',
    'collectionInvoiceTxn', 'collectionLedgerRow', 'debtLogIsInvoiceOwned', 'chaseRate', 'chaseDayAdd',
    'loanSchedule', 'loanPrincipal', 'loanInstallments', 'loanRoundTo', 'loanRound', 'loanLevelPI', 'loanDueDate',
    'loanPeriodRate', 'loanFeePerInstallment', 'loanPeriodsPerYear', 'loanFrequency',
    'mgrDept', 'mgrPayday', 'mgrPaydayLabel', 'mgrOrdinal', 'mgrMedian', 'mgrPaydayDates', 'mgrWageEvents',
    'mgrCollectionsByDay', 'mgrChaseLags', 'mgrTradingPattern', 'mgrCashWalk', 'mgrCashWalkBuild'].map(fn),
  ...['PAY_BASES', 'WAGE_DAYS_PER_MONTH', 'WAGE_DAYS_PER_WEEK', 'CASH_NOT_OPEX', 'CASH_NOT_REVENUE', 'cashHas',
    'LOAN_FREQUENCIES', 'MGR_DEPTS', 'MGR_WEEKDAYS', 'MGR_DATED_CATEGORIES',
    'CHASE_WINDOW', 'CHASE_LOOKBACK', 'CHASE_MIN_CHASED', 'CHASE_MERGE'].map(decl),
  'const MGR_TRADING_WEEKS = 8, MGR_TRADING_MIN = 3;',
];
t.check(/const MGR_TRADING_WEEKS = 8, MGR_TRADING_MIN = 3;/.test(src), 'the walk reads eight weeks and wants three of a weekday');

/* The book. Joan is on a 600,000 salary with October raised; Okello is
   paid by the day. One bill dated (1,000,000, overdue so pinned to
   today), rent of 2,000,000 on the 10th, a loan instalment of 500,000 on
   1 November. Cash on hand 10,000,000. */
function book() {
  const data = {
    staff: [{ id: 'ST1', name: 'Joan', payBasis: 'monthly', payRate: 600000 },
      { id: 'ST2', name: 'Okello', payBasis: 'daily', payRate: 15000 }],
    dues: [{ id: 1, kind: 'wage', refId: 'ST1', period: '2026-10', dueDate: '2026-10-31', amount: 600000, paid: 0 }],
    customers: [{ id: 'C1', name: 'Kato', debt: 2000000, debtLog: [
      // Payments a chase was answered by -- 2, 3 and 1 day after (lags), none in August.
      { id: 1, type: 'payment', date: '2026-06-03', amount: 500000, cashTxnId: 901, note: '' },
      { id: 2, type: 'payment', date: '2026-07-04', amount: 700000, cashTxnId: 902, note: '' },
      { id: 3, type: 'payment', date: '2026-09-02', amount: 600000, cashTxnId: 903, note: '' },
    ] }, { id: 'C2', name: 'Okot', debt: 300000, debtLog: [] }],
    presetChaseLog: [{ c: 'C1', d: '2026-06-01' }, { c: 'C1', d: '2026-07-01' }, { c: 'C1', d: '2026-08-03' }, { c: 'C1', d: '2026-09-01' }],
    savedQuotes: [],
    cashTxns: [],
    presetManager: {},
  };
  /* Eight weeks of trading back from yesterday, the first on Wednesday
     12 August: 1,000,000 of takings every Wednesday, 400,000 paid to a
     supplier every Thursday, and rent on one Tuesday (dated -- never in
     the usual day). */
  let id = 1;
  for (let w = 0; w < 8; w++) {
    const wed = new Date(Date.UTC(2026, 7, 12 + 7 * w)).toISOString().slice(0, 10);
    const thu = new Date(Date.UTC(2026, 7, 13 + 7 * w)).toISOString().slice(0, 10);
    data.cashTxns.push({ id: id++, date: wed, type: 'receipt', category: 'Sales Revenue', amount: 1000000, account: 'cash' });
    data.cashTxns.push({ id: id++, date: thu, type: 'payment', category: 'Supplier Payment', amount: 400000, account: 'bank' });
  }
  data.cashTxns.push({ id: id++, date: '2026-09-08', type: 'payment', category: 'Rent', amount: 2000000, account: 'bank' });
  return data;
}
const AHEAD = () => ({
  onHand: 10000000,
  commitments: [
    { date: TODAY, dueOn: '2026-09-30', overdue: true, kind: 'bill', label: 'Steel — bill', amount: 1000000, raised: true, billId: 11 },
    { date: '2026-10-10', dueOn: '2026-10-10', overdue: false, kind: 'rent', label: 'Shop — rent', amount: 2000000, raised: false },
    // cashAhead's own wage row -- replaced by the payday walk, never counted twice.
    { date: '2026-10-31', dueOn: '2026-10-31', overdue: false, kind: 'wage', label: 'Joan', amount: 600000, raised: true },
    { date: '2026-11-01', dueOn: '2026-11-01', overdue: false, kind: 'loan', label: 'Bank repayment', amount: 500000, raised: true },
  ],
  tightest: { date: '2026-11-01', balance: 5900000 }, safeToSpend: 5900000,
  promised: [{ date: '2026-10-12', customerId: 'C2', name: 'Okot', amount: 300000, whole: false, inDays: 5, brokenBefore: 1 }],
  owedToYou: { total: 2000000, count: 1, oldestDays: 40 },
  owedByYou: { total: 1800000, count: 2, oldestDays: 50, dated: 1, datedTotal: 1000000 },
});
const READING = { customers: [{ customerId: 'C1', name: 'Kato', verdict: 'pays_when_chased', chased: { k: 3, n: 4 } }] };

function scope(data) {
  return compileScope(SOURCES, {
    data, todayISO: () => TODAY, CASH_AHEAD_DAYS: 30,
    cashAhead: () => AHEAD(),
    cashOnHandByAccount: () => ({ byAccount: [{ key: 'cash', label: 'Cash', amount: 4000000 }, { key: 'bank', label: 'Bank', amount: 6000000 }], total: 10000000 }),
    mgrCashFloor: () => ({ amount: 3000000, source: 'set', note: 'the floor you set' }),
    mgrMemo: (name, f) => f(),
    chaseResponse: () => READING,
    credOpenInvoices: () => [{ invoice: { id: 11 }, supplierId: 'S1', due: 1000000, dueOn: '2026-09-30', ageDays: 50 },
      { invoice: { id: 12 }, supplierId: 'S2', due: 800000, dueOn: null, ageDays: 20 }],
    buyOrdersOpenRows: () => [],
    supplierName: (id) => ({ S1: 'Steel', S2: 'Roofings' })[id] || '',
    dueName: (d) => ({ ST1: 'Joan', ST2: 'Okello' })[d.refId] || 'Staff member',
  }, ['mgrCashWalk', 'mgrWageEvents', 'mgrPaydayDates', 'mgrTradingPattern', 'mgrChaseLags', 'mgrPayday']);
}
const day = (w, d) => w.days.find((x) => x.date === d);
const committedOn = (w, ds) => ds.map((d) => day(w, d).committed);

/* ---------- 1. no payday: the committed line is cashAhead's --------- */
{
  const s = scope(book());
  const w = s.mgrCashWalk({ today: TODAY });
  eq(w.days.length, 31, 'thirty days ahead, today and the thirtieth both in it, as cashAhead counts them');
  eq([w.days[0].date, w.days[30].date], [TODAY, '2026-11-06'], 'from today to 6 November');
  eq(w.opening, 10000000, 'opening is the cash on hand');
  /* 10,000,000 − 1,000,000 bill (pinned to today) = 9,000,000;
     − 2,000,000 rent on the 10th = 7,000,000; − 600,000 Joan on the
     31st (her raised due, at month end) = 6,400,000; − 500,000 loan on
     1 November = 5,900,000. */
  eq(committedOn(w, [TODAY, '2026-10-09', '2026-10-10', '2026-10-30', '2026-10-31', '2026-11-01', '2026-11-06']),
    [9000000, 9000000, 7000000, 7000000, 6400000, 5900000, 5900000], 'the committed line, day by day');
  eq(w.tightest, { date: '2026-11-01', balance: 5900000 }, 'its lowest point is cashAhead\'s, to the shilling');
  eq(w.vsCashAhead, { tightest: { date: '2026-11-01', balance: 5900000 }, safeToSpend: 5900000 },
    'and safeToSpend is handed through untouched — the walk never changes it');
  const wages = w.days.flatMap((d) => d.events).filter((e) => e.kind === 'wage');
  eq(wages.map((e) => [e.date, e.amount]), [['2026-10-31', -600000]], 'Joan once — cashAhead\'s own wage row is replaced, not added to');
  t.check(w.days.every((d) => d.events.filter((e) => e.line === 'committed').every((e) => e.amount < 0)),
    'nothing coming in is ever on the committed line');
  t.check(/month end/.test(w.method.wages), 'and the wages say they are at month end because no payday is set');
  const okello = w.notOnLine.find((x) => /Okello/.test(x.label));
  t.check(okello && okello.amount === null && /not costed/.test(okello.why),
    'Okello, paid by the day, is named off the line as not costed — never placed at 0');
  const undated = w.notOnLine.find((x) => x.kind === 'bill');
  eq(undated && [undated.count, undated.amount], [1, 800000], 'the bill with no day is named with its amount, not dated by a guess');
}

/* ---------- 2. the payday moves the wages ----------------------------- */
{
  const data = book();
  data.presetManager.payday = { kind: 'monthly', day: 13 };
  const s = scope(data);
  const w = s.mgrCashWalk({ today: TODAY });
  /* October's 600,000 leaves on the 13th: 7,000,000 − 600,000 =
     6,400,000 from the 13th; November's falls on 13 November, outside. */
  eq(committedOn(w, ['2026-10-12', '2026-10-13', '2026-10-31', '2026-11-01']), [7000000, 6400000, 6400000, 5900000],
    'a payday of the 13th takes October\'s wages on the 13th');
  t.check(/the 13th of each month/.test(w.method.wages), 'and says so');

  data.presetManager.payday = { kind: 'monthly', day: 5 };
  data.staff.push({ id: 'ST3', name: 'Peter', payBasis: 'monthly', payRate: 300000 });
  const w5 = scope(data).mgrCashWalk({ today: TODAY });
  /* The 5th has gone by: Joan's raised October is owed now (today).
     Peter's October was never raised and its payday has passed -- it may
     have been paid from the cash book, so it is named, not placed.
     November: Joan 600,000 and Peter 300,000 on the 5th, both costed
     from their rates. 10m − 1m − 0.6m = 8.4m today; − 2m = 6.4m on the
     10th; − 0.5m = 5.9m on 1 Nov; − 0.9m = 5.0m on 5 Nov. */
  eq(committedOn(w5, [TODAY, '2026-10-10', '2026-11-01', '2026-11-05']), [8400000, 6400000, 5900000, 5000000],
    'a payday already gone by is owed today, and next month\'s lands on its own 5th');
  const nov = w5.days.find((d) => d.date === '2026-11-05').events.filter((e) => e.kind === 'wage');
  eq(nov.map((e) => [e.label, e.amount, e.raised]), [['Joan', -600000, false], ['Peter', -300000, false]],
    'November is costed from the pay rate, and says it was not raised yet');
  t.check(w5.notOnLine.some((x) => /Peter/.test(x.label) && /payday has gone by/.test(x.why)),
    'Peter\'s October, unraised past its payday, is named and not taken a second time');
  eq(w5.tightest, { date: '2026-11-05', balance: 5000000 }, 'the lowest day moves with the payday');

  data.presetManager.payday = { kind: 'weekly', day: 5 };
  data.staff = data.staff.filter((x) => x.id !== 'ST3');
  const ww = scope(data).mgrCashWalk({ today: TODAY });
  /* Fridays. October's left after today: 9, 16, 23, 30 -- 600,000 in
     four of 150,000. November's: 6, 13, 20, 27 -- the 6th is in the
     window, 150,000. 9m → 8.85m (9th) → 6.85m (rent 10th) → 6.7m (16th)
     → 6.55m (23rd) → 6.4m (30th) → 5.9m (1 Nov) → 5.75m (6 Nov). */
  eq(committedOn(ww, ['2026-10-09', '2026-10-10', '2026-10-16', '2026-10-23', '2026-10-30', '2026-11-01', '2026-11-06']),
    [8850000, 6850000, 6700000, 6550000, 6400000, 5900000, 5750000], 'a weekly payday splits the month across its Fridays');
  eq(ww.tightest, { date: '2026-11-06', balance: 5750000 }, 'and the lowest day is the last Friday in the window');
}

/* ---------- 3. the expected band, with its method --------------------- */
{
  const s = scope(book());
  const lags = s.mgrChaseLags(TODAY, READING);
  /* Kato's four chases: 1 June paid on the 3rd (2 days), 1 July on the
     4th (3), 3 August nothing in the week, 1 September on the 2nd (1).
     3 of 4, within 3 days -- the longest of the three -- and the median
     of what each brought, 500,000 / 700,000 / 600,000, is 600,000. */
  eq(lags.map((l) => [l.customerId, l.k, l.n, l.lagDays, l.typicalAmount]), [['C1', 3, 4, 3, 600000]],
    'the chase lag is counted from the chases and the payments');
  const w = s.mgrCashWalk({ today: TODAY });
  const r = w.expectedReceipts.map((x) => [x.kind, x.date, x.amount]);
  eq(r, [['promise', '2026-10-12', 300000], ['chase', '2026-10-10', 600000]],
    'Okot on the day he named; Kato three days after a chase today, 600,000 (less than the 2,000,000 owed)');
  const kato = w.expectedReceipts.find((x) => x.kind === 'chase');
  t.check(kato.source === 'paid within 3 days of a chase in 3 of 4 · if chased today', 'and it says its basis, k of n');
  /* Weekday medians over the eight weeks: Wednesday +1,000,000,
     Thursday −400,000 (paying suppliers at the shop's pace), every
     other weekday 0; the Tuesday rent is dated, never the usual day. */
  const by = w.trading.byWeekday.map((x) => x.median);
  eq(by, [0, 0, 0, 1000000, -400000, 0, 0], 'the usual day by weekday');
  /* Expected = 10m, the bill NOT taken (it is inside the usual paying),
     rent, wages and the loan taken as on the committed line:
     7 Oct (Wed)  +1.0m                     = 11.0m
     8 Oct (Thu)  −0.4m                     = 10.6m
     10 Oct       +0.6m Kato −2.0m rent     =  9.2m   ← lowest
     12 Oct       +0.3m Okot                =  9.5m
     14 Oct (Wed) +1.0m = 10.5m; 15th −0.4m = 10.1m
     ... five Wednesdays (+5.0m), five Thursdays (−2.0m), −0.6m wages on
     the 31st, −0.5m loan on 1 Nov: 10 + 5 − 2 + 0.3 + 0.6 − 2 − 0.6 − 0.5 = 10.8m. */
  eq(['2026-10-07', '2026-10-08', '2026-10-10', '2026-10-12', '2026-10-14', '2026-10-15', '2026-11-06'].map((d) => day(w, d).expected),
    [11000000, 10600000, 9200000, 9500000, 10500000, 10100000, 10800000], 'the expected band, day by day');
  eq(w.expectedTightest, { date: '2026-10-10', balance: 9200000 }, 'with its own lowest day');
  eq(w.tightest, { date: '2026-11-01', balance: 5900000 }, 'and the committed line is exactly as it was without it');
  t.check(w.days.flatMap((d) => d.events).filter((e) => e.line === 'expected').every((e) => /chase|promise|trading/.test(e.kind)),
    'everything on the expected band is a receipt or a usual day');
  t.check(/median of the last 8/.test(w.method.expectedTrading) && /k of n/.test(w.method.expectedReceipts),
    'and the method is stated for both');
}

/* ---------- 4. a placed customer is not counted twice ----------------- */
{
  const data = book();
  // Kato paid on five of the eight Mondays (200,000 each) as a Debt Payment.
  [17, 24, 31].map((d) => '2026-08-' + d).concat(['2026-09-07', '2026-09-14']).forEach((d, i) => {
    data.cashTxns.push({ id: 500 + i, date: d, type: 'receipt', category: 'Debt Payment', amount: 200000, account: 'cash' });
    data.customers[0].debtLog.push({ id: 50 + i, type: 'payment', date: d, amount: 200000, cashTxnId: 500 + i, note: '' });
  });
  const s = scope(data);
  /* Mondays: [200k ×5, 0 ×3] → sorted 0,0,0,200,200,200,200,200 → the
     middle two are 200k and 200k: 200,000. With Kato placed by name, his
     payments come out of the history: every Monday 0. */
  eq(s.mgrTradingPattern(TODAY, []).byWeekday[1].median, 200000, 'what other customers pay is part of the usual day');
  eq(s.mgrTradingPattern(TODAY, ['C1']).byWeekday[1].median, 0, 'but a customer placed by name is taken out of it');
  data.cashTxns = data.cashTxns.filter((x) => x.date >= '2026-09-26');
  const thin = s.mgrTradingPattern(TODAY, []);
  t.check(thin.byWeekday.every((x) => x.median === null && x.n < 3),
    'books younger than three of a weekday give no usual day at all — not known, not 0');
}

/* ---------- 5. the Simulator's levers --------------------------------- */
{
  const s = scope(book());
  const w = s.mgrCashWalk({ today: TODAY, adjust: {
    bills: [{ billId: 11, to: '2026-10-20' }],
    loan: { amount: 5000000, on: '2026-10-09', ratePct: 0, termMonths: 5, lender: 'Centenary' },
    clearance: [{ date: '2026-10-15', amount: 400000, label: 'Tiles at clearance' }],
    oneOff: [{ date: '2026-10-12', amount: -250000, label: 'Generator repair' }, { date: '2026-10-13', amount: 100000, label: 'Scrap sold' }],
  } });
  /* The bill moves to the 20th; 5,000,000 lands on the 9th and its first
     instalment (0%, 5 months: 1,000,000) falls on 1 November -- a monthly
     loan's first due is the 1st of the month after; 250,000 out on the
     12th. Clearance and the 100,000 in are expected only.
       7 Oct 10.0m · 9th 15.0m · 10th 13.0m · 12th 12.75m · 20th 11.75m
       31st 11.15m · 1 Nov 11.15 − 0.5 − 1.0 = 9.65m */
  eq(committedOn(w, [TODAY, '2026-10-09', '2026-10-10', '2026-10-12', '2026-10-20', '2026-10-31', '2026-11-01']),
    [10000000, 15000000, 13000000, 12750000, 11750000, 11150000, 9650000], 'each lever moves the committed line by its own arithmetic');
  eq(w.tightest, { date: '2026-11-01', balance: 9650000 }, 'and the lowest day with it');
  const exp = w.days.flatMap((d) => d.events).filter((e) => e.adjusted && e.line === 'expected').map((e) => [e.kind, e.amount]);
  eq(exp, [['one-off', 100000], ['clearance', 400000]], 'what a clearance or a sale might bring rides the expected band only');
  t.check(w.days.flatMap((d) => d.events).filter((e) => e.adjusted && e.line === 'committed').every((e) => /Simulator/.test(e.source)),
    'every changed figure says it is a choice in the Simulator');

  const past = s.mgrCashWalk({ today: TODAY, adjust: { bills: [{ billId: 11, to: '2026-12-01' }] } });
  t.check(past.notOnLine.some((x) => x.kind === 'bill' && /moved past/.test(x.why)) && day(past, TODAY).committed === 10000000,
    'a bill moved past the window comes off the line and is named');
  const undated = s.mgrCashWalk({ today: TODAY, adjust: { bills: [{ billId: 12, to: '2026-10-16' }] } });
  eq(day(undated, '2026-10-16').committed, 6200000, 'an undated bill paid on a chosen day goes on it: 7.0m − 0.8m = 6.2m');
  const base = s.mgrCashWalk({ today: TODAY });
  eq(base.tightest, { date: '2026-11-01', balance: 5900000 }, 'and the baseline is untouched by any scenario');
}

/* ---------- 6. the app's days ----------------------------------------- */
{
  const walk = extractFunction(src, 'mgrCashWalkBuild', 'index.html');
  t.check(!/new Date\(\)\.get(Date|Day|Month)|getDay\(\)|toLocaleDateString/.test(walk),
    'the walk never reads a local-time date — every day is a todayISO string shifted in UTC');
  t.check(/anShiftDate\(today, i\)/.test(walk) && /waWeekday\(date\)/.test(walk), 'days and weekdays come from the app\'s own UTC helpers');
  const ca = extractFunction(src, 'cashAhead', 'index.html');
  t.check(!/mgr/.test(ca), 'and cashAhead itself — the safe-to-spend line — is not touched by any of this');
}

process.exit(t.done() ? 1 : 0);
