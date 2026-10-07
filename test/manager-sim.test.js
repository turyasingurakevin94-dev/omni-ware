#!/usr/bin/env node
'use strict';
/*
 * The Manager's Simulator (the Sim bed): levers read from the books, what
 * a set of choices adds up to, the scenario's cash, the stress tests, the
 * presets, the verdict, the Brief's teaser and what Sign it keeps.
 *
 * Every figure below is arithmetic on a book small enough to add up by
 * hand, and each sum is written out beside its check. The laws pinned
 * here:
 *   - the committed line moves only for money the owner would commit (a
 *     bill paid on another day, an order, a wage, a loan); money a lever
 *     brings in rides the EXPECTED band only;
 *   - a lever the books cannot price carries an assumption the owner can
 *     change, with its low and high, and the profit range is read
 *     between them -- one figure when nothing assumed is moved;
 *   - a lever whose subject is not on the books is not shown;
 *   - signing keeps a summary and never acts.
 *
 * Today is Wednesday 7 October 2026.
 *
 * Run: node test/manager-sim.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('manager simulator');
const src = read('index.html');
const fn = (n) => extractFunction(src, n, 'index.html');
const decl = (n) => extractDeclaration(src, n, 'index.html');
const eq = (got, want, msg) => t.check(JSON.stringify(got) === JSON.stringify(want),
  `${msg}${JSON.stringify(got) === JSON.stringify(want) ? '' : ` (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`}`);

const TODAY = '2026-10-07';
const SIM = ['mgrSimDate', 'mgrSimDay', 'mgrSimMoney', 'mgrSimSigned', 'mgrSimCell', 'mgrSimAnd', 'mgrSimQuantile', 'mgrSimRoundPrice',
  'mgrSimPriceSteps', 'mgrSimBand', 'mgrSimSeason', 'mgrSimOfferFact', 'mgrSimLevers', 'mgrSimSpread', 'mgrSimChaseLever', 'mgrSimBillLever',
  'mgrSimPayDay', 'mgrSimOrderLever', 'mgrSimOfferLever', 'mgrSimClearLever', 'mgrSimPriceLever', 'mgrSimDiscountLever', 'mgrSimTermsLever',
  'mgrSimHirePay', 'mgrSimHireLever', 'mgrSimQuoteLever', 'mgrSimPostLever', 'mgrSimChoiceOf', 'mgrSimAssumeOf', 'mgrSimCompose',
  'mgrSimExpected', 'mgrSimRun', 'mgrSimShocks', 'mgrSimHolds', 'mgrSimPresets', 'mgrSimSame', 'mgrSimVerdict', 'mgrSimWeekWords',
  'mgrSimBreakDay', 'mgrSimHeadline', 'mgrSimTeaserFigures', 'mgrSimDecisionBody', 'mgrSimMoves', 'mgrSimOpen', 'mgrNavCountSim'];
const LOANS = ['loanSchedule', 'loanPrincipal', 'loanInstallments', 'loanRoundTo', 'loanRound', 'loanLevelPI', 'loanDueDate',
  'loanPeriodRate', 'loanFeePerInstallment', 'loanPeriodsPerYear', 'loanFrequency', 'loanTotalInterest'];
const SOURCES = [
  ...SIM.map(fn),
  ...LOANS.map(fn),
  ...['anShiftDate', 'daysBetweenISO', 'waWeekday', 'mgrShortUGX', 'mgrNum', 'mgrPossessive', 'mgrDept', 'chaseRate',
    'mgrPipsFromRate', 'mgrPipsFromDeliveries', 'mgrPipsFromAge'].map(fn),
  ...['MGR_SIM_ASSUME', 'MGR_SIM_SHOCK', 'MGR_SIM_MONTHS', 'MGR_WEEKDAYS', 'MGR_DEPTS', 'MGR_WHOLE_SHOP', 'LOAN_FREQUENCIES'].map(decl),
];
let memoThrows = false;
let teaserModel = null;
const S = compileScope(SOURCES, {
  todayISO: () => TODAY,
  cashIsMoneyOut: (x) => x.type === 'payment',
  mgrMemo: (k, f) => { if (memoThrows) throw new Error('the books are away'); return f(); },
  mgrNavCtx: null,
  mgrSimModel: () => teaserModel,
  mgrSimWalkFn: () => () => { throw new Error('no committed walk in this book'); },
  console: { warn() {}, log() {}, error() {} },
}, SIM.concat(['loanSchedule', 'loanTotalInterest']));

/* ---------- 1. what the screen says a figure is ---------- */
eq(S.mgrSimDay('2026-10-14'), 'Wed 14 Oct', 'a day is the canvas\'s "Wed 14 Oct", in the app\'s UTC days');
eq(S.mgrSimDate('2025-10-22'), '22 Oct', 'last year\'s day carries no weekday, so it cannot read as this year\'s');
eq(S.mgrSimMoney(null), 'not known', 'an unknown figure says so — never 0');
eq([S.mgrSimMoney(3148424), S.mgrSimMoney(-1064326)], ['3.15m', '−1.06m'], 'money at a glance, a real minus sign');
eq([S.mgrSimSigned(81840), S.mgrSimSigned(-50000), S.mgrSimSigned(0)], ['+82k', '−50k', '+0'], 'a change carries its sign');
/* 3,148,424 / 1e6 = 3.148 -> 3.1; −1,064,326 -> −1.1; 187,630,801 -> 188 (whole from 100m). */
eq([S.mgrSimCell(3148424), S.mgrSimCell(-1064326), S.mgrSimCell(187630801)], ['3.1', '−1.1', '188'], 'a calendar cell, millions to a place');
/* [1,2,3,4]: the median sits halfway between 2 and 3; the 25th percentile
   is three quarters of the way from 1 to 2. */
eq([S.mgrSimQuantile([4, 1, 3, 2], 0.5), S.mgrSimQuantile([1, 2, 3, 4], 0.25), S.mgrSimQuantile([], 0.5)], [2.5, 1.75, null],
  'quantiles read between neighbours; none of nothing');
/* 33,170 to the rival's 35,750: a gap of 2,580. A third is 860 -> 34,030,
   to the nearest 50 = 34,050; two thirds is 1,720 -> 34,890 -> 34,900. */
eq(S.mgrSimPriceSteps(33170, 35750), [33170, 34050, 34900, 35750], 'price steps: today, a third, two thirds, the rival');
eq(S.mgrSimPriceSteps(100, 90), [100], 'no step up when the rival is not above');
/* Floor 3m: under 3m is under; to 4.5m thin; to 9m safe; above, high. */
eq([2999999, 3000000, 4499999, 4500000, 8999999, 9000000].map((v) => S.mgrSimBand(v, 3000000)), ['lo', 'md', 'md', 'ok', 'ok', 'hi'],
  'the calendar\'s bands against the floor');
eq([S.mgrSimBand(-1, 0), S.mgrSimBand(0, 0)], ['lo', 'ok'], 'with no floor at all only going below nothing is told apart');
/* 100 over three days: 33, 33, and the 34 rounding leaves. */
eq(S.mgrSimSpread(TODAY, 100, 1, 3, 'x', 'sales').map((x) => [x.date, x.amount]),
  [['2026-10-08', 33], ['2026-10-09', 33], ['2026-10-10', 34]], 'an amount spread from tomorrow, nothing lost to rounding');

/* ---------- 2. the levers, read from a hand-made book ---------- */
/* The expected band of a tiny walk: today and three days. */
const WALK = () => ({
  from: TODAY, to: '2026-10-10', opening: 1000, tightest: { date: '2026-10-09', balance: 700 },
  expectedTightest: { date: TODAY, balance: 950 },
  expectedReceipts: [{ customerId: 'C1', kind: 'chase', date: '2026-10-08', amount: 300, line: 'expected' }],
  days: [
    { date: '2026-10-07', committed: 900, expected: 950, events: [{ kind: 'bill', amount: -100, line: 'committed', label: 'Steel — bill' }] },
    { date: '2026-10-08', committed: 900, expected: 1250, events: [{ kind: 'chase', customerId: 'C1', amount: 300, line: 'expected' }] },
    { date: '2026-10-09', committed: 700, expected: 1050, events: [{ kind: 'rent', amount: -200, line: 'committed', label: 'Shop — rent' }] },
    { date: '2026-10-10', committed: 700, expected: 1050, events: [] }],
});
const BOOKS = () => ({
  today: TODAY, to: '2026-11-06', errors: [], walk: WALK(), floor: { amount: 3000000, source: 'set' }, marginPct: 0.09,
  profit: { net: 10172190 }, debtorDays: { days: 35.2, receivables: 136669398, creditPerDay: 3882323 },
  daysOfStock: { days: 33.57, value: 187630801, cogsPerDay: 5588501 }, deadStock: { value: 1000000, total: 187630801 },
  aims: { debtorDays: 30, stockDays: 90 }, season: { available: false },
  receipts: [{ customerId: 'C1', name: 'Kato Construction Ltd', kind: 'chase', date: '2026-10-10', amount: 1800000, k: 3, n: 4, lagDays: 3, ifToday: true }],
  bills: [
    { billId: 891, supplierId: 'S3', supplier: 'Steel & Tube', due: 5670120, dueOn: '2026-08-24', ageDays: 74, billDate: '2026-07-25', stopAt: 90, reachesOn: '2026-10-23' },
    { billId: 1041, supplierId: 'S2', supplier: 'Roofings', due: 10294212, dueOn: '2026-10-19', ageDays: 9, billDate: '2026-09-28', stopAt: null, reachesOn: null }],
  clearance: { quietDays: 60, value: 1000000, lines: [
    { key: 'P9', line: 'Tiles', qty: 10, unitCost: 50000, costKnown: true, value: 500000, clearance: 40000 },
    { key: 'P8', line: 'Sheets', qty: 5, unitCost: 100000, costKnown: true, value: 500000, clearance: null }] },
  price: { key: 'P24', line: 'Y10 bar', rival: 'Nakivubo', ours: 33170, theirs: 35750, side: 'retail', units: 93, daysOld: 16, unitProfit: 2000 },
  discounts: null,
  terms: { days: 35.2, receivables: 136669398, creditPerDay: 3882323, options: [30, 14] },
  hire: { name: 'Peter', cost: 500000, staff: 4, paydays: ['2026-10-28'], monthDays: [31], paydayLabel: 'the 28th of each month' },
  quote: { eligible: 158, converted: 137, rate: 0.867, who: 'Joan Nakato', avgProfit: 50000, avgSale: 600000 },
  post: { n: 33, median: 0, p25: -56000, p75: 29000, salesMedian: 0, unitsMedian: 0, up: 12 },
});
const MOVES = [
  { i: 0, status: 'open', body: { mkind: 'chase', subject: { customerId: 'C1' } } },
  { i: 1, status: 'open', body: { mkind: 'settle', subject: { supplierId: 'S3' }, after: 0 } },
  { i: 2, status: 'open', body: { mkind: 'buy', subject: { key: 'P1' } } },
  { i: 3, status: 'done', body: { mkind: 'price', subject: { key: 'P24' } } }];
const ORDERS = [{ key: 'P1', name: 'Simba Cement 50kg', qty: 123, unit: 'Bag', supplierId: 'S4', supplier: 'Kasubi Hardware', unitCost: 34250, cost: 4212750,
  a: { lead: 1, credit: 7, deliveries: 12 },
  split: { supplierId: 'S1', supplier: 'Simba Depot', qtyA: 62, qtyB: 61, costA: 2123500, costB: 2196000, b: { lead: 2, credit: null, deliveries: 4 } } }];
/* A bank's 12,000,000 at 0% over 12 months: twelve instalments of
   1,000,000 and no interest at all. */
const OFFER0 = S.mgrSimOfferFact({ id: 5, from: 'bank', name: 'Centenary Bank', amount: 12000000, rate: 0, termMonths: 12, expiresOn: '2026-10-18', daysLeft: 11 }, TODAY);
eq([OFFER0.priced, OFFER0.interestYear, OFFER0.instalment], [true, 0, 1000000], 'an offer at 0% over 12 months: no interest, 1,000,000 a month');
/* At 12% a year, 1% a month: the instalment is 12,000,000 × 0.01 /
   (1 − 1.01^−12) ≈ 1,066,185, and the year's interest ≈ 12 × 1,066,185
   − 12,000,000 ≈ 794,220 -- the whole loan's interest, all twelve
   instalments falling inside the year (the twelfth is 365 days on). */
const OFFER12 = S.mgrSimOfferFact({ id: 6, from: 'bank', name: 'Stanbic', amount: 12000000, rate: 12, termMonths: 12 }, TODAY);
const whole = Math.round(S.loanTotalInterest({ principal: 12000000, ratePct: 12, termMonths: 12, startedOn: TODAY }));
t.check(OFFER12.interestYear === whole && Math.abs(OFFER12.interestYear - 794220) < 100,
  `a year of a 12-month loan is its whole interest, from loanSchedule (${OFFER12.interestYear} = ${whole}, about 794,220)`);
t.check(Math.abs(OFFER12.instalment - 1066185) < 10, `and its instalment is about 1,066,185 (${OFFER12.instalment})`);
const UNPRICED = S.mgrSimOfferFact({ id: 7, from: 'supplier', name: 'Roofings Ltd', amount: 6000000, rate: null, termMonths: null }, TODAY);
eq([UNPRICED.priced, UNPRICED.interestYear], [false, null], 'an offer with no rate or term cannot be priced — not priced at 0');

const levers = () => S.mgrSimLevers(BOOKS(), { moves: MOVES, open: S.mgrSimOpen(MOVES), orders: ORDERS, offers: [OFFER0, UNPRICED] });
const L = levers();
const lv = (id) => L.find((l) => l.id === id);
eq(L.map((l) => l.id), ['chase:C1', 'bill:891', 'bill:1041', 'order:P1', 'offer', 'clear', 'price:P24', 'terms', 'hire', 'quote', 'post'],
  'the levers the books price come first (Q19), then the ones resting on the owner\'s assumptions');
eq(L.map((l) => l.group), ['books', 'books', 'books', 'books', 'books', 'assumption', 'assumption', 'assumption', 'assumption', 'assumption', 'assumption'],
  'each tagged where it comes from');
t.check(!L.some((l) => l.kind === 'discounts'), 'no discounts on the books: that lever is not shown');
t.check(L.filter((l) => l.group === 'assumption').every((l) => l.assume && l.assume.basis && Number.isFinite(l.assume.value)
  && l.assume.lo <= l.assume.value && l.assume.value <= l.assume.hi), 'every assumption lever shows its starting value, its low and high, and why it is an assumption');
t.check(L.filter((l) => l.group === 'books').every((l) => !l.assume), 'and no book lever carries one');
eq(S.mgrSimLevers({ ...BOOKS(), receipts: [], bills: [], clearance: null, price: null, terms: null, hire: null, quote: null, post: null },
  { moves: [], orders: [], offers: [] }).length, 0, 'a book with no subject for any lever shows none');

/* The bill the plan pays after Kato's chase: due since 24 Aug, so on the
   line today -- no "pay today"; after Kato pays (10 Oct); a week later
   (14 Oct). Its supplier stops at 90 days: 25 Jul + 90 = 23 Oct. */
const b891 = lv('bill:891');
eq(b891.opts.map((o) => o.id), ['as', 'after:C1', 'week'], 'an overdue bill: due now, after the customer the plan waits on, a week later');
eq(b891.stop, '2026-10-23', 'and the day it reaches the age its supplier stops delivering');
eq(b891.effect('after:C1'), { bills: [{ billId: 891, to: '2026-10-10', after: 'C1' }] }, 'paid after Kato pays: moved to the day his money is expected');
eq(b891.effect('week'), { bills: [{ billId: 891, to: '2026-10-14' }] }, 'a week later: 7 Oct + 7');
eq(b891.effect('as'), {}, 'as it stands, nothing moves');
const b1041 = lv('bill:1041');
eq(b1041.opts.map((o) => o.id), ['as', 'today', 'week'], 'a bill dated 19 Oct: its day, today, a week later — Kato\'s 10 Oct is before its day, so no "after"');
eq(b1041.effect('today'), { bills: [{ billId: 1041, to: TODAY }] }, 'pay today');
const late = S.mgrSimBillLever(BOOKS(), { ...BOOKS().bills[0], dueOn: '2026-10-20' }, {}, MOVES, BOOKS().receipts);
eq(late.opts.find((o) => o.id === 'week').warn, true, 'a week after 20 Oct is past the 23 Oct limit, and is flagged');

/* Chase: Kato pays within 3 days of a chase in 3 of 4. 3 of 4 read by the
   middle of its 95% range is about 0.63 -> 3 pips. */
const ch = lv('chase:C1');
eq([ch.def, ch.opts.map((o) => o.id), ch.opts[0].pips], ['today', ['today', 'week', 'none'], 3], 'a chase: today (the band\'s own reading), next week, not this month');
eq([ch.effect('week'), ch.effect('none')], [{ moves: [{ customerId: 'C1', days: 7 }] }, { moves: [{ customerId: 'C1', days: null }] }],
  'it moves the expected payment, never the committed line');

/* The order: 123 bags from Kasubi at 4,212,750, delivered in a day and
   paid 7 days later -> 7 Oct + 1 + 7 = 15 Oct. Half from Simba Depot:
   62 × Kasubi = 2,123,500 and 61 × Simba = 2,196,000 = 4,319,500,
   106,750 dearer -- and Simba's credit days are not written down, so
   its half carries no day and is not placed. */
const od = lv('order:P1');
eq(od.label, 'Simba Cement 50kg · 123 bags', 'the order is named with its quantity');
eq(od.effect('a'), { out: [{ date: '2026-10-15', amount: -4212750, label: 'Kasubi Hardware — order', dept: 'procurement' }], stock: 4212750 },
  'all from the plan\'s supplier: paid on delivery + credit, onto the shelf at cost');
eq(od.effect('split'), { out: [{ date: '2026-10-15', amount: -2123500, label: 'Kasubi Hardware — order', dept: 'procurement' }], stock: 4319500, profit: -106750 },
  'half from the next supplier: dearer by 106,750, and the half with no credit days is not dated');
t.check(/106.75k dearer/.test(od.opts[2].hint) || /107k dearer/.test(od.opts[2].hint), `the split says it is dearer (${od.opts[2].hint})`);
eq(od.effect('none'), {}, 'not ordered: nothing on the line');

/* The offer: the unpriced one is offered but cannot be taken. */
const of = lv('offer');
eq(of.opts.map((o) => [o.id, !!o.disabled]), [['decline', false], ['take:5', false], ['take:7', true]], 'an offer that cannot be priced cannot be taken');
eq(of.effect('take:5'), { loan: { amount: 12000000, on: TODAY, ratePct: 0, termMonths: 12, lender: 'Centenary Bank' }, profit: 0, interest: 0 },
  'taking it puts the loan through the walk on its own terms');

/* Clearance at your price, half sold: the tiles only (the one line with a
   clearance price) -- 40,000 × 10 × 50% = 200,000 in; their cost
   50,000 × 10 × 50% = 250,000 off the shelf; 50,000 under cost. */
const cl = lv('clear');
const e1 = cl.effect('set', 50);
eq([e1.profit, e1.stock, e1.dead, e1.freed, e1.exp.reduce((n, x) => n + x.amount, 0), e1.exp.length],
  [-50000, -250000, -250000, 200000, 200000, 30], 'clearance at your price: 200,000 in over 30 days on the expected band, 50,000 under cost');
/* At cost, half sold: (50,000 × 10 + 100,000 × 5) × 50% = 500,000 in, the
   same off the shelf, no loss. */
const e2 = cl.effect('cost', 50);
eq([e2.profit, e2.freed, e2.stock], [0, 500000, -500000], 'at cost: 500,000 back, no loss');
t.check(!e1.out && !e1.bills && !e1.loan, 'a clearance commits nothing: its money is expected, never committed');

/* Price: 93 units a month. At 34,050 and the same volume: 93 × 880 =
   81,840 more a month. Losing 10% of the volume: 93 × 0.9 × 880 =
   73,656, less the margin on the 9.3 units lost at 2,000 each = 18,600,
   so 55,056. */
const pr = lv('price:P24');
eq([pr.effect('p1', 0).profit, pr.effect('p1', -10).profit], [81840, 55056], 'a price step: 81,840 at the same volume, 55,056 at a tenth less');
eq(pr.effect('p0', 0), {}, 'today\'s price moves nothing');

/* Terms of 14 days: what would be owed at 14 days of credit sales is
   3,882,323 × 14 = 54,352,522; of 136,669,398 owed, 82,316,876 is freed
   over 60 days -- half of it inside these 30, on the expected band.
   Losing 10% of a month's credit sales (3,882,323 × 30 = 116,469,690)
   is 11,646,969 of sales and, at a 9% margin, 1,048,227 of profit. */
const tm = lv('terms');
const e3 = tm.effect('t14', 0);
eq([e3.dd, e3.freed, e3.profit, Math.round(e3.exp.reduce((n, x) => n + x.amount, 0))], [14, 82316876, 0, 41158438],
  'shorter terms: debtor days to 14, 82.3m freed over 60 days, half of it expected inside these 30');
eq([tm.effect('t14', -10).sales, tm.effect('t14', -10).profit], [-11646969, -1048227], 'and the sales the owner assumes lost cost their margin');

/* A hire paid as Peter (500,000 a month), first paid on the 28th: 21 days
   of a 31-day month = 338,710 on the committed line. */
const hr = lv('hire');
eq(hr.effect('yes', 500000), { out: [{ date: '2026-10-28', amount: -338710, label: 'New hire — pay', dept: 'people' }], profit: 0 },
  'a hire: its pay committed on the payday, and it pays for itself as a starting assumption');
eq([hr.assume.value, hr.assume.lo, hr.assume.hi], [500000, 0, 1000000], 'between nothing and twice its cost');

/* Another quoter winning 10 points more of 158 quotes: 15.8 more won, at
   50,000 of profit each = 790,000. */
eq(lv('quote').effect('train', 10).profit, 790000, 'ten points more quotes won: 15.8 × 50,000 = 790,000');
eq(lv('quote').effect('train', 0), { profit: 0, sales: 0, exp: lv('quote').effect('train', 0).exp }, 'and nothing at the starting assumption of no lift');
eq([lv('post').assume.value, lv('post').assume.lo, lv('post').assume.hi], [0, -56000, 29000], 'a post: the middle and quartiles of what past posts were followed by');

/* ---------- 3. what a set of choices adds up to ---------- */
const ch1 = { 'bill:891': 'after:C1', 'order:P1': 'a', 'price:P24': 'p1' };
const C = S.mgrSimCompose(L, ch1, {});
eq([C.adjust.bills.length, C.adjust.oneOff.length, !!C.adjust.loan], [1, 1, false], 'the bill and the order are committed; the price is not');
eq([C.profit, C.lo, C.hi, C.assumed], [81840, 55056, 81840, 1], 'profit 81,840, read between 55,056 and 81,840 on the volume assumption');
eq(C.changed.map((x) => [x.id, x.from]), [['bill:891', 'books'], ['order:P1', 'books'], ['price:P24', 'assumption']], 'three changed, each tagged');
eq(S.mgrSimCompose(L, { 'bill:891': 'after:C1' }, {}).lo, 0, 'with nothing assumed moved the range is one figure');
eq(S.mgrSimCompose(L, { 'price:P24': 'p1' }, { 'price:P24': { value: -5 } }).profit, Math.round(93 * 0.95 * 880 + 93 * -0.05 * 2000),
  'an assumption the owner changes is the one used: 93 × 0.95 × 880 − 4.65 × 2,000');
eq(S.mgrSimChoiceOf(lv('offer'), { offer: 'take:7' }), 'decline', 'a choice that cannot be made reads as the default');
eq(S.mgrSimAssumeOf(lv('price:P24'), { 'price:P24': { value: 5 } }), { ...lv('price:P24').assume, value: 5, lo: -10, hi: 5 },
  'an owner\'s value outside the bounds widens them');

/* ---------- 4. the scenario's expected band ---------- */
/* Kato's 300 moved two days: off 8 Oct onward, back on 10 Oct.
   expected 950, 1250−300 = 950, 1050−300 = 750, 1050. */
let X = S.mgrSimExpected(WALK(), [], [{ customerId: 'C1', days: 2 }]);
eq(X.days.map((d) => d.expected), [950, 950, 750, 1050], 'a payment moved two days later');
eq(X.expectedTightest, { date: '2026-10-09', balance: 750 }, 'and the expected low moves with it');
eq(X.days.map((d) => d.committed), [900, 900, 700, 700], 'the committed line is never touched');
t.check(!X.days[1].events.some((e) => e.kind === 'chase') && X.days[3].events.some((e) => e.kind === 'chase' && e.moved), 'its marker moves with it');
/* And 100 out on 9 Oct as well: 750−100 = 650, 1050−100 = 950. */
X = S.mgrSimExpected(WALK(), [{ date: '2026-10-09', amount: -100 }], [{ customerId: 'C1', days: 2 }]);
eq(X.days.map((d) => d.expected), [950, 950, 650, 950], 'money a lever brings or loses adds from its day on');
const bare = { ...WALK(), expectedTightest: null, expectedReceipts: [], days: WALK().days.map((d) => ({ ...d, expected: null, events: [] })) };
eq(S.mgrSimExpected(bare, [], []).days.map((d) => d.expected), [null, null, null, null], 'no expected band, and nothing added: still none');
eq(S.mgrSimExpected(bare, [{ date: '2026-10-08', amount: 50 }], []).days.map((d) => d.expected), [900, 950, 750, 750],
  'something added to a shop with no band: built on the committed line');

/* ---------- 5. a run, the stress tests, the presets ---------- */
const model = { books: { ...BOOKS(), to: '2026-10-10', floor: { amount: 800, source: 'set' }, price: null }, levers: [] };
const fakeWalk = () => { throw new Error('nothing committed: the walk must not be asked'); };
const R = S.mgrSimRun(model, {}, {}, fakeWalk);
eq([R.low, R.expLow, R.profit.mid, R.debtorDays, R.stockDays], [{ date: '2026-10-09', balance: 700 }, { date: TODAY, balance: 950 }, 10172190, 35.2, 33.57],
  'nothing changed: the walk\'s own lows, today\'s profit, the books\' debtor and stock days');
/* The late payer: Kato's 300 on 8 Oct, fourteen days late -- past these
   days, so off the band: 950, 950, 750, 750; low 750 on 9 Oct. Floor 800:
   it breaks. The season and the rival cannot be run on this book. */
const SH = S.mgrSimShocks(model, {}, {}, R, fakeWalk);
eq(SH.map((s) => [s.id, s.available, s.held]), [['late', true, false], ['season', false, null], ['rival', false, null]],
  'a big payment two weeks late breaks an 800 floor; no year of books, no rival above you');
eq(SH[0].low, { date: '2026-10-09', balance: 750 }, 'its low: 1050 − 300 on 9 Oct');
eq(SH[1].note, 'Not available — under a year of books.', 'the season says why it was not run');
eq(S.mgrSimHolds(SH), { held: 0, of: 1 }, 'held in 0 of the 1 test that could be run');
/* Last year's buying: 100 a day as usual, and one day of 1,100 in the week
   from 15 Oct 2025 -- that week took 1,000 more than its usual 700. */
const txns = [];
for (let i = 1; i <= 56; i++) txns.push({ date: new Date(Date.UTC(2025, 9, 8 - i)).toISOString().slice(0, 10), type: 'payment', category: 'Supplier Payment', amount: 100 });
for (let i = 0; i < 35; i++) txns.push({ date: new Date(Date.UTC(2025, 9, 8 + i)).toISOString().slice(0, 10), type: 'payment', category: 'Stock Purchase', amount: i === 7 ? 1100 : 100 });
txns.push({ date: '2025-10-09', type: 'receipt', category: 'Sales Revenue', amount: 99999 });
const SE = S.mgrSimSeason(TODAY, '2025-01-01', txns);
eq([SE.available, SE.usualDay, SE.extra, SE.from, SE.to], [true, 100, 1000, '2025-10-15', '2025-10-21'], 'last year\'s season: 1,000 more buying in the week of 15 Oct');
eq(S.mgrSimSeason(TODAY, '2025-12-01', txns), { available: false }, 'under a year of books, there is no season to read');
/* A week early it lands from 15 Oct 2025 + 364 − 7 = 7 Oct 2026: 143 a
   day (1,000/7), the last day taking 142. Inside these four days:
   950−143, 950−286, 750−429, 750−572 after Kato also pays late... the
   season alone: 950−143 = 807, 1250−286 = 964, 1050−429 = 621,
   1050−572 = 478. */
const SH2 = S.mgrSimShocks({ ...model, books: { ...model.books, season: SE } }, {}, {}, R, fakeWalk);
eq([SH2[1].available, SH2[1].held, SH2[1].low], [true, false, { date: '2026-10-10', balance: 478 }], 'the season a week early: 1,000 of buying from today, a low of 478');

const P = S.mgrSimPresets(L, S.mgrSimOpen(MOVES), MOVES);
eq(P.plan, { 'bill:891': 'after:C1', 'order:P1': 'a' },
  'my plan: the bill paid after the chase it waits on, the order placed — the chase is the band\'s own reading and the done price move moves nothing');
eq(P.cash, { 'bill:891': 'after:C1', clear: 'cost', terms: 't14', post: 'post' }, 'cash first: wait for the payment, clear at cost, the shortest terms, a post');
const sorted = (o) => Object.keys(o).sort().map((k) => [k, o[k]]);
eq(sorted(P.growth), sorted({ 'bill:891': 'after:C1', offer: 'take:5', 'price:P24': 'p1', terms: 't30', post: 'post', hire: 'yes', quote: 'train', 'order:P1': 'a' }),
  'growth push: a step up in price, a hire, another quoter, a post, the next terms, the offer taken, the order (the split is dearer)');
eq(S.mgrSimPresets(L, null, null).plan, null, 'no plan read: no plan');
eq(S.mgrSimPresets(L, [], []).plan, null, 'no open move: no plan');
t.check(S.mgrSimSame(L, {}, { 'chase:C1': 'today' }) && !S.mgrSimSame(L, {}, P.plan), 'a choice of the default is no change');

/* ---------- 6. the verdict and the headline ---------- */
const F = { amount: 3000000, source: 'set' };
let V = S.mgrSimVerdict({ changed: 0, floor: F, low: { date: '2026-11-05', balance: 3148424 }, lowWeek: 'the loan repayment and rent' });
eq([V.cls, V.head], ['am', 'This is today, unchanged.'], 'today, unchanged');
eq(V.body, 'Cash after what is already promised stays above your 3m floor — lowest 3.15m on Thu 5 Nov, the week the loan repayment and rent go out. Start from my plan, or move one choice at a time.',
  'said from the books: the low, its day, and what leaves that week');
V = S.mgrSimVerdict({ changed: 2, floor: F, low: { date: '2026-11-05', balance: -1064326 }, expLow: { date: '2026-11-06', balance: 28380000 },
  fix: 'Leaving the Simba order as it is keeps cash above the floor.' });
eq([V.cls, V.head, V.body], ['cr', 'I wouldn’t sign this.', 'Cash falls to −1.06m on Thu 5 Nov — under your 3m floor, counting only money already in hand; with what customers usually pay, the low is 28.38m on Fri 6 Nov. Leaving the Simba order as it is keeps cash above the floor.'],
  'under the floor: not signed, said on the committed line, the expected low beside it');
const ok = { changed: 1, floor: F, low: { date: '2026-11-05', balance: 3200000 }, held: 3, of: 3, breaks: [] };
eq(S.mgrSimVerdict({ ...ok, offer: { interest: 1070000, amount: 10000000 }, owed: 136669398, termsFree: { days: 14, freed: 82316876 } }).body,
  'You’d pay 1.07m a year to borrow 10m. Customers already owe you 137m. 14-day terms would free 82.32m without interest.', 'an offer taken: safe, but its cost said (137m: whole millions from 100m)');
eq(S.mgrSimVerdict({ ...ok, priceBetter: { at: 35750, better: 34900 } }).head, 'Close — but not that price.', 'a dearer step that earns less on the owner\'s own assumption');
eq(S.mgrSimVerdict({ ...ok, held: 1, of: 3, breaks: ['Nalubega Estates pays two weeks late', 'The season comes a week early'] }).body,
  'It breaks if Nalubega Estates pays two weeks late or if the season comes a week early.', 'fragile: the tests it fails, a name kept as it is');
eq(S.mgrSimVerdict({ ...ok, profitD: 81840, ranged: true, lo: 55056, hi: 81840 }).head, 'This is the plan I’d sign.', 'more profit even at the low end, and it holds');
eq(S.mgrSimVerdict({ ...ok, profitD: 81840, ranged: true, lo: -10000, hi: 81840 }).head, 'Better than today, and it holds.', 'more profit, but not at the low end');
eq(S.mgrSimVerdict({ ...ok, profitD: -50000, lo: -50000, hi: -50000 }).head, 'Safer, at a price.', 'less profit for the cushion');
eq(S.mgrSimVerdict({ ...ok, profitD: 0 }).head, 'It holds.', 'no profit change');
const breakWalk = { days: [{ date: '2026-10-07', committed: 5e6, events: [] }, { date: '2026-11-01', committed: 2e6, events: [] }] };
const okWalk = { days: [{ date: '2026-10-07', committed: 5e6, events: [] }] };
eq(S.mgrSimHeadline({ floor: F, base: { walk: okWalk }, plan: { walk: breakWalk } }),
  'Move any decision and I’ll play out the next 30 days before you commit. Today’s path stays above your floor; my plan breaks it on Sun 1 Nov.',
  'the band\'s line: today\'s path and the plan\'s, against the floor, on a named day');
eq(S.mgrSimHeadline({ floor: F, base: { walk: breakWalk }, plan: { walk: okWalk }, planLate: { held: true, name: 'Kato Construction Ltd' } }),
  'Move any decision and I’ll play out the next 30 days before you commit. Today’s path breaks your floor on Sun 1 Nov; my plan doesn’t — even if Kato Construction Ltd pays late.',
  '"even if" only when the plan holds that test');
eq(S.mgrSimHeadline({ floor: { amount: 900000, source: 'stand-in' }, base: { walk: okWalk }, plan: null, planWhy: 'no plan is open today' }),
  'Move any decision and I’ll play out the next 30 days before you commit. Today’s path stays above the stand-in floor; no plan is open today.',
  'a stand-in floor says so, and a missing plan says why');
eq(S.mgrSimWeekWords({ days: [{ date: '2026-10-30', events: [{ line: 'committed', kind: 'wage' }] }, { date: '2026-11-05', events: [{ line: 'committed', kind: 'rent' }, { line: 'expected', kind: 'chase' }] }] }, '2026-11-05'),
  'wages and rent', 'what leaves in the week up to the low');

/* ---------- 7. what Sign it keeps ---------- */
const run = S.mgrSimRun({ books: BOOKS(), levers: L }, { 'price:P24': 'p1', 'chase:C1': 'week' }, {}, fakeWalk);
const body = S.mgrSimDecisionBody({ run, verdict: { head: 'Better than today, and it holds.', body: '+82k a month.' }, holds: { held: 3, of: 3 },
  floor: F, today: TODAY, alone: [{ id: 'chase:C1', profit: 0, low: 700 }, { id: 'price:P24', profit: 81840, low: 700 }] });
eq(body.levers, [{ id: 'chase:C1', label: 'Chase Kato Construction Ltd', choice: 'Next week', dept: 'finance', from: 'books' },
  { id: 'price:P24', label: 'Y10 bar price', choice: '34,050', dept: 'sales', from: 'assumption' }], 'each lever kept with its choice and where it came from');
eq([body.dept, body.why], [null, 'Better than today, and it holds. +82k a month.'], 'two departments: no single one; why is the verdict');
eq([body.outcome.profit, body.outcome.holds, body.outcome.levers], [{ base: 10172190, change: 81840, lo: 55056, hi: 81840 }, { held: 3, of: 3 },
  [{ id: 'chase:C1', profit: 0, low: 700 }, { id: 'price:P24', profit: 81840, low: 700 }]], 'the outcome is a summary: the profit and its range, the tests, each lever on its own');
t.check(/^Simulator: Kato Construction Ltd chased a week later; Y10 bar at 34,050$/.test(body.title), `titled by what was chosen (${body.title})`);
const all = Object.fromEntries(L.map((l) => [l.id, (l.opts.find((o) => o.id !== l.def && !o.disabled) || {}).id]).filter((x) => x[1]));
const big = S.mgrSimRun({ books: BOOKS(), levers: L.filter((l) => !['bill', 'order', 'offer', 'hire'].includes(l.kind)) }, all, {}, fakeWalk);
const bigBody = S.mgrSimDecisionBody({ run: big, verdict: { head: 'x', body: 'y' }, holds: { held: 3, of: 3 }, floor: F, today: TODAY,
  alone: big.changed.map((x) => ({ id: x.id, profit: x.profit, low: 1 })) });
t.check(JSON.stringify(bigBody.outcome).length < 4000 && bigBody.title.length <= 200,
  `every lever changed still signs a summary under the 4,000-character outcome cap (${JSON.stringify(bigBody.outcome).length})`);

/* ---------- 8. the Brief's teaser ---------- */
memoThrows = true;
eq(S.mgrSimTeaserFigures(), { profitMonth: null, lowest: null, shocksHeld: null, shocksOf: 3, plan: 'nothing changes' },
  'a teaser that cannot be worked out answers with nothing — it never throws');
memoThrows = false;
teaserModel = { books: { ...BOOKS(), to: '2026-10-10', floor: { amount: 800, source: 'set' }, price: null }, levers: L.filter((l) => l.group === 'assumption') };
eq(S.mgrSimTeaserFigures(), { profitMonth: { lo: 10172190, hi: 10172190 }, lowest: { balance: 700, date: '2026-10-09' }, shocksHeld: 0, shocksOf: 1, plan: 'nothing changes' },
  'no plan read: the teaser is today, unchanged — today\'s profit, the committed low, the tests it held');
const ctxPlan = { st: { today: { meeting: { id: 9 }, moves: [{ id: 1, status: 'open', body: { mkind: 'whatsapp', door: 'whatsapp' } }] } } };
eq(S.mgrSimTeaserFigures(ctxPlan).plan, 'my plan', 'with an open move that moves a lever, it reads the plan');

/* ---------- 10. through the real cash walk ----------
   The committed path, end to end: mgrSimRun hands the walk what the
   choices commit and the walk places it. The book is the cash-walk
   test's: 10,000,000 on hand; a 1,000,000 bill (#11) overdue, so on the
   line today; 2,000,000 rent on 10 Oct; 600,000 of wages on 31 Oct;
   500,000 of loan on 1 Nov. Committed: 9.0m today, 7.0m from 10 Oct,
   6.4m from 31 Oct, 5.9m from 1 Nov. */
{
  const WALKFNS = ['anShiftDate', 'daysBetweenISO', 'waWeekday', 'periodOf', 'periodShift', 'periodEndDate', 'periodLabel',
    'findDue', 'dueBalance', 'staffOnPayroll', 'basisMonthCost', 'basisDayRate',
    'cashIsMoneyIn', 'cashIsMoneyOut', 'cashIsTradingIncome', 'cashIsDebtCollection', 'cashIsOperatingExpense',
    'collectionInvoiceTxn', 'collectionLedgerRow', 'debtLogIsInvoiceOwned', 'chaseRate', 'chaseDayAdd',
    ...LOANS, 'mgrDept', 'mgrPayday', 'mgrPaydayLabel', 'mgrOrdinal', 'mgrMedian', 'mgrPaydayDates', 'mgrWageEvents',
    'mgrPaydaySettles', 'mgrPaydaySettlesDefault', 'mgrPaydaySettlesLabel', 'mgrWageShares', 'mgrWageDueLate', 'dueIsOverdue',
    'mgrCollectionsByDay', 'mgrChaseLags', 'mgrTradingPattern', 'mgrCashWalk', 'mgrCashWalkBuild',
    'mgrSimExpected', 'mgrSimRun', 'mgrSimCompose', 'mgrSimChoiceOf', 'mgrSimAssumeOf', 'mgrSimBillLever', 'mgrSimOrderLever',
    'mgrSimOfferLever', 'mgrSimPayDay', 'mgrSimDay', 'mgrSimMoney', 'mgrSimSigned', 'mgrShortUGX', 'mgrNum', 'mgrPossessive',
    'mgrPipsFromRate', 'mgrPipsFromDeliveries'];
  const data = {
    staff: [{ id: 'ST1', name: 'Joan', payBasis: 'monthly', payRate: 600000 }],
    dues: [{ id: 1, kind: 'wage', refId: 'ST1', period: '2026-10', dueDate: '2026-10-31', amount: 600000, paid: 0 }],
    customers: [], presetChaseLog: [], savedQuotes: [], cashTxns: [], presetManager: {},
  };
  const AHEAD = () => ({ onHand: 10000000, commitments: [
    { date: TODAY, dueOn: '2026-09-30', overdue: true, kind: 'bill', label: 'Steel — bill', amount: 1000000, raised: true, billId: 11 },
    { date: '2026-10-10', dueOn: '2026-10-10', overdue: false, kind: 'rent', label: 'Shop — rent', amount: 2000000, raised: false },
    { date: '2026-10-31', dueOn: '2026-10-31', overdue: false, kind: 'wage', label: 'Joan', amount: 600000, raised: true },
    { date: '2026-11-01', dueOn: '2026-11-01', overdue: false, kind: 'loan', label: 'Bank repayment', amount: 500000, raised: true }],
    tightest: { date: '2026-11-01', balance: 5900000 }, safeToSpend: 5900000, promised: [],
    owedToYou: { total: 0, count: 0, oldestDays: 0 }, owedByYou: { total: 1000000, count: 1, oldestDays: 50, dated: 1, datedTotal: 1000000 } });
  const W = compileScope([...WALKFNS.map(fn),
    ...['PAY_BASES', 'WAGE_DAYS_PER_MONTH', 'WAGE_DAYS_PER_WEEK', 'CASH_NOT_OPEX', 'CASH_NOT_REVENUE', 'cashHas', 'LOAN_FREQUENCIES',
      'MGR_DEPTS', 'MGR_WEEKDAYS', 'MGR_DATED_CATEGORIES', 'MGR_SIM_MONTHS', 'CHASE_WINDOW', 'CHASE_LOOKBACK', 'CHASE_MIN_CHASED', 'CHASE_MERGE'].map(decl),
    'const MGR_TRADING_WEEKS = 8, MGR_TRADING_MIN = 3;'], {
    data, todayISO: () => TODAY, CASH_AHEAD_DAYS: 30, cashAhead: () => AHEAD(),
    cashOnHandByAccount: () => ({ byAccount: [{ key: 'bank', label: 'Bank', amount: 10000000 }], total: 10000000 }),
    mgrCashFloor: () => ({ amount: 3000000, source: 'set', note: 'the floor you set' }),
    mgrMemo: (k, f) => f(), chaseResponse: () => ({ customers: [] }),
    credOpenInvoices: () => [{ invoice: { id: 11 }, supplierId: 'S1', due: 1000000, dueOn: '2026-09-30', ageDays: 50 }],
    buyOrdersOpenRows: () => [], supplierName: (id) => ({ S1: 'Steel' })[id] || '', dueName: () => 'Joan',
  }, ['mgrCashWalk', 'mgrSimRun', 'mgrSimBillLever', 'mgrSimOrderLever', 'mgrSimOfferLever']);
  const base = W.mgrCashWalk({ today: TODAY });
  const books = { today: TODAY, to: '2026-11-06', walk: base, floor: { amount: 3000000, source: 'set' }, profit: { net: 1000000 },
    daysOfStock: { days: 30, value: 3000000, cogsPerDay: 100000 }, debtorDays: null, deadStock: null };
  const bill = W.mgrSimBillLever(books, { billId: 11, supplierId: 'S1', supplier: 'Steel', due: 1000000, dueOn: '2026-09-30', ageDays: 50,
    billDate: '2026-08-18', stopAt: null, reachesOn: null }, {}, [], []);
  const order = W.mgrSimOrderLever(books, { key: 'P1', name: 'Cement', qty: 10, unit: 'bag', supplierId: 'S9', supplier: 'Depot', unitCost: 200000,
    cost: 2000000, a: { lead: 2, credit: 3, deliveries: 6 }, split: null });
  const offer = W.mgrSimOfferLever(books, [{ id: 3, from: 'bank', name: 'Bank', amount: 1200000, rate: 0, termMonths: 12, priced: true, interestYear: 0, instalment: 100000 }]);
  const model = { books, levers: [bill, order, offer] };
  const at = (r, d) => r.walk.days.find((x) => x.date === d).committed;
  /* The bill a week later: off today, on 14 Oct (30 Sep pinned to today
     + 7). 10.0m until 10 Oct, then 8.0m, 7.0m from the 14th. The lowest
     point is still 5.9m on 1 Nov: moving a bill inside the window moves
     the line's shape, never its end. */
  let r = W.mgrSimRun(model, { 'bill:11': 'week' }, {}, W.mgrCashWalk);
  eq([at(r, TODAY), at(r, '2026-10-10'), at(r, '2026-10-14'), r.low.balance], [10000000, 8000000, 7000000, 5900000],
    'a bill paid a week later: off today, on the 14th; the low is unchanged');
  /* The order: 2,000,000 paid 7 Oct + 2 + 3 = 12 Oct. 5.9m − 2.0m = 3.9m
     on 1 Nov. */
  r = W.mgrSimRun(model, { 'order:P1': 'a' }, {}, W.mgrCashWalk);
  eq([at(r, '2026-10-11'), at(r, '2026-10-12'), r.low], [7000000, 5000000, { date: '2026-11-01', balance: 3900000 }],
    'an order: 2,000,000 committed on the 12th, the low 3.9m');
  eq(r.stockDays, (3000000 + 2000000) / 100000, 'and the shelf it fills: 5,000,000 at 100,000 a day = 50 stock days');
  /* The offer: 1,200,000 lands today on the committed line (the owner's
     own financing); its first 100,000 instalment falls on the first of
     the next month, as loanDueDate dates every monthly loan -- 1 Nov,
     inside these days. 5.9m + 1.2m − 0.1m = 7.0m. */
  r = W.mgrSimRun(model, { offer: 'take:3' }, {}, W.mgrCashWalk);
  eq([at(r, TODAY), r.low.balance], [10200000, 7000000], 'an offer taken: its money on the line today, its first instalment on 1 Nov, the low 7.0m');
  t.check(r.walk.days.find((d) => d.date === '2026-11-01').events.some((e) => e.kind === 'loan' && e.amount === -100000), 'the instalment on its day');
  t.check(r.walk.days[0].events.some((e) => e.kind === 'loan-in' && e.amount === 1200000 && e.line === 'committed'), 'as a loan-in, committed');
  r = W.mgrSimRun(model, {}, {}, () => { throw new Error('asked'); });
  eq(r.low, base.tightest, 'nothing chosen: the walk the Brief draws, not asked again');
}

/* ---------- 9. the laws the section keeps ---------- */
const begin = src.indexOf('\n/* ═══ MGR BED: Sim — begin ═══ */');
const block = src.slice(begin, src.indexOf('/* ═══ MGR BED: Sim — end ═══ */', begin));
eq(S.mgrNavCountSim({}), null, 'the canvas draws no count on the Simulator');
t.check(!/apMode\s*=/.test(block), 'the simulator never sets apMode');
t.check(!/\b(setBillDueDate|addCashPayment|addCashReceipt|placeBuyOrder|recordCustomerPayment|payDue|saveData|wa\.me|apSend|apRunLoop)\b/.test(block),
  'signing pays, orders and sends nothing — no money-moving door is called from the section');
t.check(/mgrSaveDecision\(mgrSimDecisionBody\(/.test(block) && /nothing was paid, ordered or sent/.test(block),
  'Sign it keeps one decision record, after the owner\'s tap, and says it acted on nothing');
t.check(/if\(gen !== mgrRenderGen\) return;/.test(fn('mgrSimReadJournal')), 'the offers and the decisions land only under the render\'s ticket');
t.check(/could not be read — \$\{esc\(o\.error\)\}/.test(block) && /could not be read — \$\{esc\(d\.error\)\}/.test(block),
  'a failed read of the offers or the decisions names itself');
t.check(/mgrMigrationNote\(\{ code: '23514' \}\)/.test(block), 'a missing 0107 is named when signing');
t.check(!/likely/i.test(block.replace(/\/\*[\s\S]*?\*\//g, '')), 'no "likely" range: profit is read between the owner\'s own assumptions');

process.exit(t.done() ? 1 : 0);
