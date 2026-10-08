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
 *   - signing keeps a summary and never acts;
 *   - a stress test is judged on the EXPECTED band against the floor
 *     (Q40; the committed line alone where there is no band), the
 *     committed low shown beside it, and it is always k of three;
 *   - an unknown is never 0: an order whose supplier's credit days are
 *     not written is counted on delivery, never left off the line.
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
  'mgrSimPriceSteps', 'mgrSimBand', 'mgrSimSeason', 'mgrSimTermsFact', 'mgrSimOfferFact', 'mgrSimLevers', 'mgrSimSpread', 'mgrSimChaseLever', 'mgrSimBillLever',
  'mgrSimPayDay', 'mgrSimOrderLever', 'mgrSimSeasonOut', 'mgrSimSeasonLever', 'mgrSimOfferLever', 'mgrSimClearLever', 'mgrDeadWindow', 'mgrSimPriceLever',
  'mgrSimDiscountLever', 'mgrSimTermsLever', 'mgrSimHirePay', 'mgrSimHireLever', 'mgrSimQuoteLever', 'mgrSimPostLever', 'mgrSimChoiceOf',
  'mgrSimAssumeOf', 'mgrSimCompose', 'mgrSimExpected', 'mgrSimLands', 'mgrSimRun', 'mgrSimJudge', 'mgrSimShocks', 'mgrSimHolds', 'mgrSimPresets',
  'mgrSimSame', 'mgrSimVerdict', 'mgrSimWeekWords', 'mgrSimNoFloor', 'mgrSimBreakDay', 'mgrSimHeadline', 'mgrSimTeaserFigures', 'mgrSimTargetsTouched',
  'mgrSimDecisionBody', 'mgrSimMoves', 'mgrSimOpen', 'mgrSimScenarioFacts', 'mgrSimVerdictInputs', 'mgrSimWaitHint', 'mgrNavCountSim',
  'mgrSimPlanPriceNote', 'mgrSimPoss', 'mgrSimShift', 'mgrSimStops', 'mgrSimQuoteBounds', 'mgrSimOffLine', 'mgrSimLegendNamed', 'mgrSimUncostedSay'];
const LOANS = ['loanSchedule', 'loanPrincipal', 'loanInstallments', 'loanRoundTo', 'loanRound', 'loanLevelPI', 'loanDueDate',
  'loanPeriodRate', 'loanFeePerInstallment', 'loanPeriodsPerYear', 'loanFrequency', 'loanTotalInterest'];
const SOURCES = [
  ...SIM.map(fn),
  ...LOANS.map(fn),
  ...['anShiftDate', 'daysBetweenISO', 'waWeekday', 'mgrShortUGX', 'mgrNum', 'mgrPossessive', 'mgrDept', 'chaseRate',
    'mgrPipsFromRate', 'mgrPipsFromDeliveries', 'mgrPipsFromAge', 'clearanceFor', 'periodOf', 'periodShift', 'periodEndDate',
    'mgrPaydayDates', 'mgrPaydaySettles', 'mgrPaydaySettlesDefault'].map(fn),
  ...['MGR_SIM_ASSUME', 'MGR_SIM_SHOCK', 'MGR_SIM_MONTHS', 'MGR_WEEKDAYS', 'MGR_DEPTS', 'MGR_WHOLE_SHOP', 'LOAN_FREQUENCIES', 'MGR_SIM_EV',
    'MGR_SIM_LEGEND_NAMED', 'MGR_SIM_NO_FLOOR'].map(decl),
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
  /* One consigned line: P7's lots are a consignor's, owed 60,000 each. */
  consignmentUnitCostForKey: (k) => (k === 'P7' ? 60000 : null),
  console: { warn() {}, log() {}, error() {} },
}, SIM.concat(['loanSchedule', 'loanTotalInterest', 'clearanceFor']));

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
/* A dead line as the books hand it over: priced by clearanceFor at the
   owner's clearance price and at cost. */
const deadLine = (r) => ({ ...r, atSet: r.clearance > 0 ? S.clearanceFor(r, r.clearance) : null,
  atCost: r.costKnown && r.unitCost > 0 ? S.clearanceFor(r, r.unitCost) : null });
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
    deadLine({ key: 'P9', line: 'Tiles', qty: 10, unitCost: 50000, costKnown: true, value: 500000, clearance: 40000 }),
    deadLine({ key: 'P8', line: 'Sheets', qty: 5, unitCost: 100000, costKnown: true, value: 500000, clearance: null })] },
  price: { key: 'P24', line: 'Y10 bar', rival: 'Nakivubo', ours: 33170, theirs: 35750, side: 'retail', units: 93, daysOld: 16, unitProfit: 2000 },
  discounts: null,
  debt60: { amount: 63406119, count: 4 },
  terms: S.mgrSimTermsFact({ days: 35.2, receivables: 136669398, creditPerDay: 3882323 }, { amount: 63406119, count: 4 },
    [{ termsDays: 30 }, { termsDays: 14 }, { termsDays: 30 }]),
  hire: { name: 'Peter', cost: 500000, staff: 4, payday: { kind: 'monthly', day: 28, settles: 'same' }, paydayLabel: 'the 28th of each month' },
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

/* THE ORDER, DERIVED (mgrSimOrderFact) from a buying plan, the ranked
   prices at each half and the suppliers' terms -- the figures ORDERS
   hands the lever. 123 bags: half is 61 (rounded down) from the next
   supplier, 62 from the plan's. 62 × 34,250 = 2,123,500 at Kasubi; 61 ×
   36,000 = 2,196,000 at Simba Depot. Kasubi's delivery is measured (1
   day) and its credit written (7); Simba's delivery is only written (2
   days) and its credit days are not. */
{
  const O = compileScope([fn('mgrSimOrderFact')], {
    data: { suppliers: [{ id: 'S4', name: 'Kasubi Hardware', creditDays: 7, deliveryDays: 3 }, { id: 'S1', name: 'Simba Depot', creditDays: null, deliveryDays: 2 }] },
    buyKeyParts: (k) => ({ product: { name: 'Simba Cement' }, productId: 'P1', variantIdx: null }),
    productVariantLabel: () => 'Simba Cement 50kg',
    mgrMemo: (k, f) => f(),
    purchasePlan: () => ({ lines: [{ key: 'P1', buyQty: 123, supplierId: 'S4', supplier: 'Kasubi Hardware', unit: 'Bag', unitCost: 34250, cost: 4212750 }], didNotFit: [] }),
    rankedPurchaseRowsAtQty: (pid, vi, q) => [{ supplierId: 'S4', sname: 'Kasubi Hardware', purchasePrice: 34250, q },
      { supplierId: 'S9', sname: 'No price', purchasePrice: null }, { supplierId: 'S1', sname: 'Simba Depot', purchasePrice: 36000 }],
    supplierLeadDays: (id) => (id === 'S4' ? 1 : null),
    supplierLeadTimes: () => [{ supplierId: 'S4', deliveries: 12 }, { supplierId: 'S1', deliveries: 4 }],
    supplierName: (id) => id,
  }, ['mgrSimOrderFact']);
  const of = O.mgrSimOrderFact('P1', TODAY);
  eq([of.qty, of.cost, of.supplier, of.split.qtyA, of.split.qtyB, of.split.costA, of.split.costB, of.split.supplier],
    [123, 4212750, 'Kasubi Hardware', 62, 61, 2123500, 2196000, 'Simba Depot'], 'the split: 62 + 61, each costed at its own supplier\'s price, skipping a supplier with none');
  eq([of.a, of.split.b], [{ lead: 1, leadFrom: 'measured', credit: 7, deliveries: 12 }, { lead: 2, leadFrom: 'written', credit: null, deliveries: 4 }],
    'each supplier\'s terms: a measured delivery beats a written one; credit days only where written');
  eq(O.mgrSimOrderFact('P2', TODAY), { key: 'P2', name: 'Simba Cement 50kg', none: true }, 'a line not on today\'s plan is said so, never costed');
}
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
eq(L.map((l) => l.group), ['books', 'books', 'books', 'books', 'books', 'books', 'assumption', 'assumption', 'assumption', 'assumption', 'assumption'],
  'each tagged where it comes from — the clearance\'s price arithmetic is the books\' (Q19), only its sell-through is assumed');
t.check(!L.some((l) => l.kind === 'discounts'), 'no discounts on the books: that lever is not shown');
t.check(L.filter((l) => l.group === 'assumption').every((l) => l.assume && l.assume.basis && Number.isFinite(l.assume.value)
  && l.assume.lo <= l.assume.value && l.assume.value <= l.assume.hi), 'every assumption lever shows its starting value, its low and high, and why it is an assumption');
t.check(L.filter((l) => l.group === 'books' && l.kind !== 'clear').every((l) => !l.assume), 'and no other book lever carries one');
t.check(!L.some((l) => l.kind === 'season'), 'under a year of books: no seasonal lever');
/* THE INVARIANTS, over every lever and every option: what a choice
   commits only ever LEAVES (a negative amount), and money in on the
   committed line comes only from a bank's loan. */
{
  const effects = [];
  L.forEach((l) => l.opts.forEach((o) => { const a = S.mgrSimAssumeOf(l, {}); effects.push({ l, e: l.effect(o.id, a ? a.value : null) || {} }); }));
  t.check(effects.every(({ e }) => (e.out || []).every((x) => x.amount < 0)), 'every committed one-off a lever adds is money going out');
  t.check(effects.every(({ l, e }) => !e.loan || (l.kind === 'offer' && l.offers.some((o) => o.from === 'bank' && o.name === e.loan.lender))),
    'a loan reaches the committed line only from a bank\'s offer');
}
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
   its half is counted on delivery: 7 Oct + 2 = 9 Oct (never left off). */
const od = lv('order:P1');
eq(od.label, 'Simba Cement 50kg · 123 bags', 'the order is named with its quantity');
eq(od.effect('a'), { out: [{ date: '2026-10-15', amount: -4212750, label: 'Kasubi Hardware — order', dept: 'procurement', routine: true }], stock: 4212750 },
  'all from the plan\'s supplier: paid on delivery + credit, onto the shelf at cost');
eq(od.effect('split'), { out: [{ date: '2026-10-15', amount: -2123500, label: 'Kasubi Hardware — order', dept: 'procurement', routine: true },
  { date: '2026-10-09', amount: -2196000, label: 'Simba Depot — order (credit days not written — counted on delivery)', dept: 'procurement', routine: true }], stock: 4319500, profit: -106750 },
  'half from the next supplier: dearer by 106,750, and the half with no credit days is counted on delivery, never left off the line');
t.check(/counted on delivery, Fri 9 Oct/.test(od.opts[2].hint), `and says so (${od.opts[2].hint})`);
/* No credit days and no delivery time: counted today. */
eq(S.mgrSimPayDay(TODAY, { lead: null, credit: null }), TODAY, 'nothing written on the supplier: the order is counted today');
t.check(/106.75k dearer/.test(od.opts[2].hint) || /107k dearer/.test(od.opts[2].hint), `the split says it is dearer (${od.opts[2].hint})`);
eq(od.effect('none'), {}, 'not ordered: nothing on the line');

/* The offer: the unpriced one is offered but cannot be taken. */
const of = lv('offer');
eq(of.opts.map((o) => [o.id, !!o.disabled]), [['decline', false], ['take:5', false], ['take:7', true]], 'an offer that cannot be priced cannot be taken');
eq(of.effect('take:5'), { loan: { amount: 12000000, on: TODAY, ratePct: 0, termMonths: 12, lender: 'Centenary Bank' }, profit: 0, gross: 0, interest: 0 },
  'taking it puts the loan through the walk on its own terms');
/* A supplier's 6,000,000 at 12% over 2 months: priced (its first month's
   interest is 6,000,000 × 1% = 60,000) but not taken as cash. */
const SUP = S.mgrSimOfferFact({ id: 8, from: 'supplier', name: 'Roofings Ltd', amount: 6000000, rate: 12, termMonths: 2 }, TODAY);
t.check(SUP.priced && Math.abs(SUP.interestMonth - 60000) < 1000, `a supplier's offer is priced: its first month's interest about 60,000 (${SUP.interestMonth})`);
const ofS = S.mgrSimOfferLever(BOOKS(), [SUP]);
eq([ofS.opts[1].disabled, ofS.effect('take:8')], [true, {}], 'but a supplier\'s credit is goods, not cash in hand: it cannot be taken onto the cash line');
t.check(/not cash in hand/.test(ofS.opts[1].hint), 'and its option says why');
/* A bank's 12,000,000 at 12% over 12 months costs its FIRST month's
   interest a month (1% = 120,000), not a year's interest over twelve. */
const of12 = S.mgrSimOfferLever(BOOKS(), [OFFER12]).effect('take:6');
t.check(Math.abs(of12.profit + OFFER12.interestMonth) < 1 && Math.abs(OFFER12.interestMonth - 120000) < 2000,
  `a month's cost is the schedule's first month of interest (${of12.profit}, about −120,000)`);

/* Clearance at your price, half sold: the tiles only (the one line with a
   clearance price) -- 40,000 × 10 × 50% = 200,000 in; their cost
   50,000 × 10 × 50% = 250,000 off the shelf; 50,000 under cost. */
const cl = lv('clear');
const e1 = cl.effect('set', 50);
eq([e1.profit, e1.stock, e1.dead, e1.clearIn, e1.freed, e1.exp.reduce((n, x) => n + x.amount, 0), e1.exp.length],
  [-50000, -250000, -250000, 200000, undefined, 200000, 30], 'clearance at your price: 200,000 in over 30 days on the expected band, 50,000 under cost — its takings kept apart from cash freed');
/* At cost, half sold: (50,000 × 10 + 100,000 × 5) × 50% = 500,000 in, the
   same off the shelf, no loss. */
const e2 = cl.effect('cost', 50);
eq([e2.profit, e2.clearIn, e2.stock], [0, 500000, -500000], 'at cost: 500,000 back, no loss');
/* A consigned line (P7: 2 at 60,000, its consignor owed 60,000 each)
   at a 45,000 clearance: clearanceFor says 15,000 under on each, all of
   it owed to the consignor out of the owner's pocket -- 30,000. All sold:
   90,000 in, 120,000 off the shelf, 30,000 under cost (named, not added
   twice). */
const clC = S.mgrSimClearLever({ ...BOOKS(), clearance: { quietDays: 60, value: 120000,
  lines: [deadLine({ key: 'P7', line: 'Doors', qty: 2, unitCost: 60000, costKnown: true, value: 120000, clearance: 45000 })] } });
const eC = clC.effect('set', 100);
eq([eC.profit, eC.clearIn, eC.stock], [-30000, 90000, -120000], 'a consigned line cleared under its consignor\'s price: the loss once');
t.check(/30k of what it owes its consignor comes out of your pocket/.test(clC.opts[1].hint), `and the consignor's share is named (${clC.opts[1].hint})`);
t.check(!e1.out && !e1.bills && !e1.loan, 'a clearance commits nothing: its money is expected, never committed');
/* Q43: the lever says what dead stock counted -- the shop's own window
   (60 here, from the books' quietDays; 45 when the shop sets 45). */
eq([clC.label, clC.opts[0].hint.split(' · ').slice(0, 2)], ['Dead stock (no sale in 60 days) · 120k', ['1 line', 'no sale in 60 days']],
  'the dead-stock lever is labelled "no sale in 60 days"');
eq(S.mgrSimClearLever({ ...BOOKS(), clearance: { quietDays: 45, value: 120000,
  lines: [deadLine({ key: 'P7', line: 'Doors', qty: 2, unitCost: 60000, costKnown: true, value: 120000, clearance: 45000 })] } }).label,
'Dead stock (no sale in 45 days) · 120k', 'and with the shop\'s window at 45, 45 -- never a literal 60');

/* Price: 93 units a month. At 34,050 and the same volume: 93 × 880 =
   81,840 more a month. Losing 10% of the volume: 93 × 0.9 × 880 =
   73,656, less the margin on the 9.3 units lost at 2,000 each = 18,600,
   so 55,056. */
const pr = lv('price:P24');
eq([pr.effect('p1', 0).profit, pr.effect('p1', -10).profit], [81840, 55056], 'a price step: 81,840 at the same volume, 55,056 at a tenth less');
eq(pr.effect('p0', 0), {}, 'today\'s price moves nothing');

/* Terms (mgrSimTermsFact): of 136,669,398 owed, 63,406,119 is over 60
   days old and stalled -- shorter terms cannot reach it -- leaving
   73,263,279 of young debt. At 30-day terms the young debt would be
   3,882,323 × 30 = 116,469,690: more than it is, so 30 frees nothing and
   is not offered. At 14: 54,352,522, so 73,263,279 − 54,352,522 =
   18,910,757 is freed over 60 days -- half of it (9,455,379) inside these
   30, on the expected band. */
eq([BOOKS().terms.young, BOOKS().terms.options, BOOKS().terms.freed], [73263279, [14], [18910757]],
  'terms free only young debt; a term that frees nothing is not offered');
const tm = lv('terms');
const e3 = tm.effect('t14', 0);
eq([e3.freed, e3.profit, Math.round(e3.exp.reduce((n, x) => n + x.amount, 0))], [18910757, 0, 9455379],
  'shorter terms: 18.9m freed over 60 days, half of it expected inside these 30');
/* DEBTOR DAYS RECOMPUTED, mgrDebtorDays' way: what is still owed after
   the half freed inside the window, over credit sales a day --
   (136,669,398 − 9,455,378.5) ÷ 3,882,323 = 127,214,020 ÷ 3,882,323 =
   32.77 days. Partway, not the term itself. */
eq(e3.dd, { owed: 127214020, perDay: 3882323 }, 'the debtor days\' own inputs, after the release inside the window');
const rT = S.mgrSimRun({ books: BOOKS(), levers: L }, { terms: 't14' }, {}, () => { throw new Error('nothing committed'); });
t.check(Math.abs(rT.debtorDays - 127214020 / 3882323) < 1e-9 && rT.debtorDays > 14 && rT.debtorDays < 35.2,
  `14-day terms move debtor days partway: ${rT.debtorDays.toFixed(2)}, between 14 and today's 35.2`);
/* Losing 10% of a month's credit sales (3,882,323 × 30 = 116,469,690)
   is 11,646,969 of sales and, at a 9% margin, 1,048,227 of profit -- and
   fewer credit sales a day (× 0.9) RAISE debtor days on what is left. */
eq([tm.effect('t14', -10).sales, tm.effect('t14', -10).profit], [-11646969, -1048227], 'and the sales the owner assumes lost cost their margin');
t.check(Math.abs(tm.effect('t14', -10).dd.perDay - 3882323 * 0.9) < 1e-6, 'and shrink the credit sales debtor days are read over');
eq(S.mgrSimTermsFact({ days: 35.2, receivables: 136669398, creditPerDay: 3882323 }, { amount: 63406119, count: 4 }, [{ termsDays: 30 }, { termsDays: 21 }]),
  null, 'no term the shop gives would free anything: no terms lever');

/* A hire paid as Peter (500,000 a month). The 28th pays the month in
   progress (mgrPaydaySettles 'same'), so October's pay covers the days
   worked in October: 7 to 31 Oct inclusive = 25 of 31 days = 500,000 ×
   25 / 31 = 403,226 on 28 Oct. November's falls after these days. */
const hr = lv('hire');
eq(hr.effect('yes', 500000), { out: [{ date: '2026-10-28', amount: -403226, label: 'New hire — pay', dept: 'people' }], profit: 0, gross: 500000 },
  'a hire: its pay committed on the payday for the days worked in the month it settles');
/* The 5th pays the month just ended ('previous'): October's 25 days are
   paid 5 Nov, inside these days. */
eq(S.mgrSimHirePay(TODAY, '2026-11-06', 500000, { kind: 'monthly', day: 5, settles: 'previous' }).map((x) => [x.date, x.amount]),
  [['2026-11-05', -403226]], 'a payday that pays the month just ended pays October\'s worked days on 5 Nov');
/* Weekly on Fridays: October's 403,226 over the Fridays from the first
   day worked (9, 16, 23, 30 Oct) -- 100,806 each, the last 100,808;
   November's 500,000 over its four Fridays, the first (6 Nov) inside. */
eq(S.mgrSimHirePay(TODAY, '2026-11-06', 500000, { kind: 'weekly', day: 5 }).map((x) => [x.date, x.amount]),
  [['2026-10-09', -100806], ['2026-10-16', -100806], ['2026-10-23', -100806], ['2026-10-30', -100808], ['2026-11-06', -125000]],
  'a weekly payroll: each month\'s share over its Fridays from the first day worked');
eq(S.mgrSimHirePay(TODAY, '2026-11-06', 500000, null).map((x) => [x.date, x.amount]), [['2026-10-31', -403226]], 'no payday: month end');
eq([hr.assume.value, hr.assume.lo, hr.assume.hi], [500000, 0, 1000000], 'between nothing and twice its cost');

/* Another quoter winning 10 points more of 158 quotes: 15.8 more won, at
   50,000 of profit each = 790,000. */
/* Counter discounts: 4 invoices, 200,000 off, their sales 3,000,000 and
   profit 300,000 (both net of the discount). None at the same volume:
   +200,000 of each. At 10% less volume: profit 0.9 × 500,000 − 300,000 =
   150,000; sales 0.9 × 3,200,000 − 3,000,000 = −120,000. */
const dl = S.mgrSimDiscountLever({ ...BOOKS(), discounts: { count: 4, total: 200000, profit: 300000, sales: 3000000 } });
eq([dl.effect('none', 0).profit, dl.effect('none', 0).sales, dl.effect('none', -10).profit, dl.effect('none', -10).sales],
  [200000, 200000, 150000, -120000], 'no counter discounts: the discount back at the same volume; less volume costs its sales');
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
   days, so off the band: 950, 950, 750, 750; expected low 750 on 9 Oct.
   The committed line is 700 on 9 Oct: under an 800 floor, so it breaks
   whatever the band does. The season and the rival cannot be run. */
const SH = S.mgrSimShocks(model, {}, {}, R, fakeWalk);
eq(SH.map((s) => [s.id, s.available, s.held]), [['late', true, false], ['season', false, null], ['rival', false, null]],
  'a big payment two weeks late breaks an 800 floor; no year of books, no rival above you');
eq([SH[0].low, SH[0].expLow], [{ date: '2026-10-09', balance: 700 }, { date: '2026-10-09', balance: 750 }], 'its lows: 700 committed, 1050 − 300 expected, on 9 Oct');
eq(SH[1].note, 'Not available — it needs a year of books and the eight weeks before it.', 'the season says what it needs');
eq(S.mgrSimShocks({ ...model, books: { ...model.books, season: { available: false, booksStart: '2025-09-15', needs: '2025-08-13' } } }, {}, {}, R, fakeWalk)[1].note,
  'Not available — it needs a year of books and the eight weeks before it; yours start 15 Sep 2025.',
  'thirteen months of books is over a year: it says what is missing, not "under a year"');
eq(S.mgrSimHolds(SH), { held: 0, of: 3, untestable: 2 }, 'held in 0 of 3 — the two that could not be run are counted apart, never dropped');
/* Q40: JUDGED ON THE EXPECTED LINE against the floor. Floor 750: the
   expected band with Kato late bottoms at 750 -- at the floor, so it
   holds -- while the committed line sits at 700, under it; that low is
   kept beside the verdict (low), never hidden. Floor 800: 750 expected is
   under it -- it breaks. */
const m750 = { ...model, books: { ...model.books, floor: { amount: 750, source: 'set' } } };
const S750 = S.mgrSimShocks(m750, {}, {}, R, fakeWalk);
eq([S750[0].held, S750[0].expLow.balance, S750[0].low.balance], [true, 750, 700],
  'Q40: the expected low (750) at a 750 floor holds; the committed 700 is kept beside it');
eq(S.mgrSimHolds(S750), { held: 1, of: 3, untestable: 2 }, 'and holds 1 of 3 — the two that could not be run still counted apart');
eq(S.mgrSimShocks({ ...model, books: { ...model.books, floor: { amount: 800, source: 'set' } } }, {}, {}, R, fakeWalk)[0].held, false,
  'the expected low under the floor: it breaks');
eq([S.mgrSimJudge({ low: { balance: 700 }, expLow: null }, 600), S.mgrSimJudge({ low: { balance: -5 }, expLow: { balance: 900 } }, 600),
  S.mgrSimJudge({ low: null, expLow: null }, 600)], [true, true, null],
  'no expected band: the committed line alone; with one, the expected line decides; neither: not known');
/* Last year's buying: 100 a day as usual, and one day of 1,100 in the week
   from 15 Oct 2025 -- that week took 1,000 more than its usual 700. */
const txns = [];
for (let i = 1; i <= 56; i++) txns.push({ date: new Date(Date.UTC(2025, 9, 8 - i)).toISOString().slice(0, 10), type: 'payment', category: 'Supplier Payment', amount: 100 });
for (let i = 0; i < 35; i++) txns.push({ date: new Date(Date.UTC(2025, 9, 8 + i)).toISOString().slice(0, 10), type: 'payment', category: 'Stock Purchase', amount: i === 7 ? 1100 : 100 });
txns.push({ date: '2025-10-09', type: 'receipt', category: 'Sales Revenue', amount: 99999 });
const SE = S.mgrSimSeason(TODAY, '2025-01-01', txns);
eq([SE.available, SE.usualDay, SE.extra, SE.from, SE.to], [true, 100, 1000, '2025-10-15', '2025-10-21'], 'last year\'s season: 1,000 more buying in the week of 15 Oct');
/* The year back starts 8 Oct 2025 (364 days); its usual pace needs the 56
   days before it, from 13 Aug 2025. */
eq(S.mgrSimSeason(TODAY, '2025-12-01', txns), { available: false, booksStart: '2025-12-01', needs: '2025-08-13' }, 'under a year of books, there is no season to read — and it says from when the books are needed');
/* A week early it lands from 15 Oct 2025 + 364 − 7 = 7 Oct 2026: 143 a
   day (1,000/7), the last day taking 142. Inside these four days:
   950−143, 950−286, 750−429, 750−572 after Kato also pays late... the
   season alone: 950−143 = 807, 1250−286 = 964, 1050−429 = 621,
   1050−572 = 478. */
const SH2 = S.mgrSimShocks({ ...model, books: { ...model.books, season: SE } }, {}, {}, R, fakeWalk);
eq([SH2[1].available, SH2[1].held, SH2[1].expLow], [true, false, { date: '2026-10-10', balance: 478 }], 'the season a week early: 1,000 of buying from today, an expected low of 478');
/* THE SEASON AS A LEVER (book-derived, with a year of books): last
   year's busy week from 15 Oct 2025 lands 52 weeks on, 14 Oct 2026 --
   1,000 committed on its first day; a week ahead, 7 Oct. */
const sLv = S.mgrSimSeasonLever({ ...BOOKS(), season: SE });
eq([sLv.group, sLv.def, sLv.opts.map((o) => o.id)], ['books', 'off', ['off', 'ly', 'early']], 'the season\'s buying: not counted, as last year, a week ahead');
eq(sLv.effect('ly'), { out: [{ date: '2026-10-14', amount: -1000, label: 'Season’s buying, as last year', dept: 'procurement' }], stock: 1000 },
  'as last year: last year\'s extra on the committed line, 52 weeks on');
eq(sLv.effect('early').out[0].date, TODAY, 'a week ahead: 7 Oct');
eq(S.mgrSimSeasonLever({ ...BOOKS(), season: { available: false } }), null, 'under a year of books: no seasonal lever');
/* With the season counted, the stress test moves THAT buying a week
   sooner (committed); counted a week ahead already, it has no further
   effect. */
const sModel = { books: { ...BOOKS(), season: SE, floor: { amount: 0, source: 'set' } }, levers: [sLv] };
const sCalls = [];
const sWalk = (o) => { sCalls.push(o.adjust.oneOff.map((x) => x.date)); return WALK(); };
const sRun = S.mgrSimRun(sModel, { season: 'ly' }, {}, sWalk);
const sSh = S.mgrSimShocks(sModel, { season: 'ly' }, {}, sRun, sWalk);
eq([sCalls[0], sCalls[sCalls.length - 1]], [['2026-10-14'], [TODAY]], 'the season test on counted buying: the same 1,000 a week sooner, on the committed line');
t.check(/lands a week sooner/.test(sSh[1].note), 'and says so');
t.check(/no further effect/.test(S.mgrSimShocks(sModel, { season: 'early' }, {}, sRun, sWalk)[1].note), 'already a week ahead: no further effect');

const P = S.mgrSimPresets(L, S.mgrSimOpen(MOVES), MOVES);
eq(P.plan, { 'bill:891': 'after:C1', 'order:P1': 'a' },
  'my plan: the bill paid after the chase it waits on, the order placed — the chase is the band\'s own reading and the done price move moves nothing');
eq(P.cash, { 'bill:891': 'after:C1', clear: 'cost', terms: 't14', post: 'post' }, 'cash first: wait for the payment, clear at cost, the shortest terms, a post');
const sorted = (o) => Object.keys(o).sort().map((k) => [k, o[k]]);
eq(sorted(P.growth), sorted({ 'bill:891': 'after:C1', offer: 'take:5', 'price:P24': 'p1', terms: 't14', post: 'post', hire: 'yes', quote: 'train', 'order:P1': 'a' }),
  'growth push: a step up in price, a hire, another quoter, a post, the next terms, the offer taken, the order (the split is dearer)');
eq(S.mgrSimPresets(L, null, null).plan, null, 'no plan read: no plan');
eq(S.mgrSimPresets(L, [], []).plan, null, 'no open move: no plan');
t.check(S.mgrSimSame(L, {}, { 'chase:C1': 'today' }) && !S.mgrSimSame(L, {}, P.plan), 'a choice of the default is no change');

/* ---------- 5b. Q38: the price today's plan names ---------- */
/* The move's price goes in through the contract's whitelist
   (managerMoveFields) and comes out on the price lever and in "My plan".
   Y10 bar (P24): ours 33,170, Nakivubo 35,750, 93 sold a month, 2,000 a
   unit profit. */
{
  const MF = compileScope([fn('managerMoveFields'), fn('managerPips'), fn('managerPlanText'),
    decl('MANAGER_DEPTS'), decl('MANAGER_METRICS')], {
    data: { products: [{ id: 'P24', name: 'Y10 bar' }, { id: 'P5', name: 'Paint 4L' }] },
    buyKeyParts: (k) => (['P24', 'P5'].includes(String(k)) ? { productId: String(k), variantIdx: null } : null),
  }, ['managerMoveFields']).managerMoveFields;
  const bodyOf = (raw) => ({ mkind: raw.kind, subject: raw.subject, ...MF(raw) });
  const priceMove = bodyOf({ kind: 'price', subject: { key: 'P24' }, price: 35000 });
  eq(priceMove.price, 35000, 'the price move carries its planned price through the save whitelist');
  const PM = [...MOVES.slice(0, 3), { i: 3, status: 'open', body: priceMove }];
  const planOn = { key: 'P24', price: 35000, line: null };
  /* THE PLANNED PRICE IS WHOLESALE (the contract's word). The book's
     market line is Y10 on its RETAIL side; for the plan to land on that
     lever the market line must be read on its wholesale side. */
  const BW = () => ({ ...BOOKS(), price: { ...BOOKS().price, side: 'wholesale' } });

  /* 35,000 sits between the steps 34,900 and 35,750: a choice of its own,
     in price order. At the same volume, 93 × (35,000 − 33,170) = 170,190
     a month; at a tenth less, 93 × 0.9 × 1,830 − 9.3 × 2,000 = 153,171 −
     18,600 = 134,571. */
  const pl = S.mgrSimPriceLever(BW(), planOn);
  eq(pl.opts.map((o) => [o.id, o.price]), [['p0', 33170], ['p1', 34050], ['p2', 34900], ['plan', 35000], ['p3', 35750]],
    'the price lever offers the plan’s 35,000 among the steps, in price order, today’s price still first');
  eq(pl.def, 'p0', 'and today’s price is still where it starts');
  eq([pl.effect('plan', 0).profit, pl.effect('plan', -10).profit], [170190, 134571], 'priced like every step: 170,190 at the same volume, 134,571 at a tenth less');
  t.check(/^my plan · \+170k a month at the same volume — 750 under Nakivubo$/.test(pl.opts[3].hint), `and it says it is my plan (${pl.opts[3].hint})`);
  eq(pl.opts[3].pips, undefined, 'with no rival-age pips: the price is the meeting’s, not a sighting (the sighting’s age rides in the hint)');
  const onStep = S.mgrSimPriceLever(BW(), { ...planOn, price: 34900 });
  eq([onStep.opts.map((o) => o.id), onStep.opts[2].plan, /^my plan · /.test(onStep.opts[2].hint)], [['p0', 'p1', 'p2', 'p3'], true, true],
    'a planned price on a step marks that step rather than adding a twin');
  eq(S.mgrSimPriceLever(BW(), { ...planOn, price: 33170 }).opts.some((o) => o.plan), false, 'a plan to hold today’s price is today’s price');
  eq(S.mgrSimPriceLever(BW(), null).opts.map((o) => o.id), ['p0', 'p1', 'p2', 'p3'], 'with no planned price the lever is as built');
  /* WAS: the plan's price went onto the market lever whatever its side,
     so a wholesale plan could be simulated against 93 RETAIL units at
     the retail 33,170. NOW: a retail market lever is never offered it. */
  eq(S.mgrSimPriceLever(BOOKS(), planOn).opts.map((o) => o.id), ['p0', 'p1', 'p2', 'p3'],
    'ONE SIDE: the market line read on its retail side is never offered a wholesale plan price');

  const PL = S.mgrSimLevers(BW(), { moves: PM, open: S.mgrSimOpen(PM), orders: ORDERS, offers: [OFFER0, UNPRICED], planPrice: planOn });
  const PP = S.mgrSimPresets(PL, S.mgrSimOpen(PM), PM);
  eq(PP.plan, { 'bill:891': 'after:C1', 'order:P1': 'a', 'price:P24': 'plan' }, 'MY PLAN INCLUDES IT: the price lever set to the plan’s 35,000');
  eq(PP.growth['price:P24'], 'p1', 'while Growth push still takes the first step up');
  const done = [...MOVES.slice(0, 3), { i: 3, status: 'done', body: priceMove }];
  eq(S.mgrSimPresets(PL, S.mgrSimOpen(done), done).plan['price:P24'], undefined, 'a price move already done sets nothing');
  const PLr = S.mgrSimLevers(BOOKS(), { moves: PM, open: S.mgrSimOpen(PM), orders: ORDERS, offers: [OFFER0, UNPRICED], planPrice: planOn });
  eq(S.mgrSimPresets(PLr, S.mgrSimOpen(PM), PM).plan['price:P24'], undefined, 'and My plan never sets a retail lever to a wholesale price');

  /* ANOTHER LINE: the plan prices Paint 4L (P5), which the market reading
     does not. Ours 12,000; 40 sold wholesale of 50 in 30 days for 100,000
     profit = 2,000 a unit. Rivals: Abba 11,800 (4 days), Bina 13,000
     (2 days) -- the cheapest ABOVE ours is Bina's. */
  const fact = (over) => compileScope([fn('mgrSimPlanPriceFact')], {
    buyKeyParts: (k) => (k === 'P5' ? { product: { name: 'Paint 4L' }, productId: 'P5', variantIdx: null }
      : k === 'P24' ? { product: { name: 'Y10 bar' }, productId: 'P24', variantIdx: null } : null),
    productVariantLabel: (p) => p.name, ourPriceFor: () => 12000,
    waSalesByKey: () => new Map([['P5', { units30: 50, wholesaleUnits30: 40, profit30: 100000 }]]),
    rivalMarketRows: () => [{ key: 'P5', comparable: true, side: 'wholesale', theirs: 11800, shop: 'Abba', daysOld: 4 },
      { key: 'P5', comparable: true, side: 'wholesale', theirs: 13000, shop: 'Bina', daysOld: 2 }],
    ...(over || {}),
  }, ['mgrSimPlanPriceFact']).mgrSimPlanPriceFact;
  const paint = [{ i: 0, status: 'open', body: bodyOf({ kind: 'policy', subject: { key: 'P5' }, price: 12500 }) }];
  const pf = fact()(paint, BOOKS());
  eq(pf, { key: 'P5', price: 12500, name: 'Paint 4L', line: { key: 'P5', line: 'Paint 4L', rival: 'Bina', ours: 12000, theirs: 13000, side: 'wholesale',
    units: 40, daysOld: 2, unitProfit: 2000 } },
  'the plan’s line read the market reading’s way: our wholesale price, wholesale units, profit a unit — and the cheapest rival above ours, Bina’s 13,000 (Abba’s 11,800 is under)');
  /* Steps a third and two thirds of the 1,000 gap, to the nearest 50:
     12,333 → 12,350 and 12,667 → 12,650; the plan's 12,500 between. */
  const pfl = S.mgrSimPriceLever(BOOKS(), pf);
  eq([pfl.id, pfl.opts.map((o) => [o.id, o.price]), pfl.effect('plan', 0).profit],
    ['price:P5', [['p0', 12000], ['p1', 12350], ['plan', 12500], ['p2', 12650], ['p3', 13000]], 20000],
    'the lever moves to the plan’s line, the plan among its steps — 40 × 500 = 20,000 a month at the same volume');
  eq(pfl.opts[0].hint, 'today’s price · 1,000 under Bina (seen 2 days ago)', 'today’s price says where it sits against the rival');
  const PL5 = S.mgrSimLevers(BOOKS(), { moves: paint, open: paint, orders: [], offers: [], planPrice: pf });
  eq(PL5.filter((l) => l.kind === 'price').map((l) => l.id), ['price:P24', 'price:P5'],
    'the plan’s line gets a price lever of its own, beside the market reading’s — which is untouched');
  eq(PL5.find((l) => l.id === 'price:P24').opts.some((o) => o.plan), false, 'and the market line is offered no planned price it was never given');
  const P5 = S.mgrSimPresets(PL5, paint, paint);
  eq([P5.plan, P5.growth['price:P5'], P5.growth['price:P24']], [{ 'price:P5': 'plan' }, 'p1', 'p1'],
    'my plan takes the plan’s price; Growth push takes the first step up on each line');
  /* Both priced: the rival test reads the market line's price, and the
     verdict looks for a better step on whichever price was moved. */
  const both = S.mgrSimCompose(PL5, { 'price:P5': 'plan', 'price:P24': 'p1' }, {});
  eq([both.price.key, both.price.side, both.price.price, both.profit], ['P24', 'retail', 34050, 81840 + 20000],
    'the rival test reads Y10 at 34,050 on its own side; the month adds 81,840 + 20,000');
  eq(S.mgrSimCompose(PL5, { 'price:P5': 'plan' }, {}).price.key, 'P5', 'with only the plan’s line moved, that is the price chosen');

  /* RIVALS ONLY UNDER OURS: Abba 11,800 (4 days) and Cee 11,500 -- the
     nearest, Abba's, says where today's price and the plan's sit. */
  const below = fact({ rivalMarketRows: () => [{ key: 'P5', comparable: true, side: 'wholesale', theirs: 11500, shop: 'Cee', daysOld: 30 },
    { key: 'P5', comparable: true, side: 'wholesale', theirs: 11800, shop: 'Abba', daysOld: 4 },
    { key: 'P5', comparable: true, side: 'retail', theirs: 11950, shop: 'Dan', daysOld: 1 }] });
  const pb = below(paint, BOOKS());
  eq([pb.line.rival, pb.line.theirs, pb.line.daysOld], ['Abba', 11800, 4], 'with no rival above, the nearest one under ours (wholesale only)');
  const pbl = S.mgrSimPriceLever(BOOKS(), pb);
  eq([pbl.opts.map((o) => [o.id, o.price]), pbl.opts[0].hint, pbl.opts[1].hint],
    [[['p0', 12000], ['plan', 12500]], 'today’s price · 200 over Abba (seen 4 days ago)', 'my plan · +20k a month at the same volume — 700 over Abba'],
    'no steps to climb; today’s price and the plan’s each say how far over Abba they sit');

  /* A PLANNED CUT: 11,900, 100 under ours. Same volume: 40 × −100 =
     −4,000. The volume range for a cut runs 0 to +10% (a raise's runs −10
     to 0): at +10%, 44 × −100 + 4 × 2,000 = −4,400 + 8,000 = 3,600. Its
     likely range is −4,000 to 3,600 -- never under the same-volume figure. */
  const cut = below([{ i: 0, status: 'open', body: bodyOf({ kind: 'price', subject: { key: 'P5' }, price: 11900 }) }], BOOKS());
  const cl = S.mgrSimPriceLever(BOOKS(), cut);
  eq([cl.opts.map((o) => o.id + ':' + o.price), cl.opts[0].hint, cl.def],
    [['plan:11900', 'p0:12000'], 'my plan · −4k a month at the same volume — 100 over Abba', 'p0'], 'the cut sits under today’s price, in price order, today’s still the start');
  const ca = S.mgrSimAssumeOf(cl, {}, 'plan');
  eq([ca.value, ca.lo, ca.hi], [0, 0, 10], 'THE RANGE FOLLOWS THE DIRECTION: a cut assumes volume holds or gains up to a tenth');
  eq([S.mgrSimAssumeOf(pfl, {}, 'p1').lo, S.mgrSimAssumeOf(pfl, {}, 'p1').hi, S.mgrSimAssumeOf(pfl, {}).lo], [-10, 0, -10],
    'a raise keeps −10 to 0, and a lever read with no choice keeps its own');
  const cc = S.mgrSimCompose([cl], { [cl.id]: 'plan' }, {});
  eq([cc.profit, cc.lo, cc.hi], [-4000, -4000, 3600], 'so a planned cut’s likely range is −4,000 to 3,600, never below its same-volume −4,000');
  eq(S.mgrSimAssumeOf(cl, { [cl.id]: { lo: -5 } }, 'plan').lo, -5, 'and the owner’s own low still wins');

  /* THE MARKET LINE ON ITS RETAIL SIDE, planned wholesale: Y10's
     wholesale side read as a lever of its own -- ours 32,240, 207 sold
     wholesale (of 300) for 600,000 = 2,000 a unit, Nakivubo wholesale
     33,000. Steps: 32,240 + 760/3 = 32,493 → 32,500; + 1,520/3 = 32,747
     → 32,750; 33,000. The plan's 32,800: 207 × 560 = 115,920. */
  const y10 = [{ i: 0, status: 'open', body: bodyOf({ kind: 'price', subject: { key: 'P24' }, price: 32800 }) }];
  const yf = fact({ ourPriceFor: () => 32240, waSalesByKey: () => new Map([['P24', { units30: 300, wholesaleUnits30: 207, profit30: 600000 }]]),
    rivalMarketRows: () => [{ key: 'P24', comparable: true, side: 'wholesale', theirs: 33000, shop: 'Nakivubo', daysOld: 16 }] })(y10, BOOKS());
  eq([yf.line && yf.line.id, yf.line && yf.line.side, yf.line && yf.line.ours, yf.line && yf.line.units], ['price:P24:wholesale', 'wholesale', 32240, 207],
    'a retail market line gets the plan’s line read on its wholesale side, named apart');
  const YL = S.mgrSimLevers(BOOKS(), { moves: y10, open: y10, orders: [], offers: [], planPrice: yf });
  const yw = YL.find((l) => l.id === 'price:P24:wholesale');
  eq([YL.filter((l) => l.kind === 'price').map((l) => l.id), yw.opts.map((o) => o.price), yw.effect('plan', 0).profit],
    [['price:P24', 'price:P24:wholesale'], [32240, 32500, 32750, 32800, 33000], 115920], 'two levers on Y10, one a side: the plan is offered on the wholesale one');
  const YP = S.mgrSimPresets(YL, y10, y10);
  eq(YP.plan, { 'price:P24:wholesale': 'plan' }, 'My plan sets the wholesale lever, never the retail one');
  /* The rival test reads the retail market line: a wholesale price on
     the same line is not that price. */
  const ym = { books: { ...BOOKS(), to: '2026-10-10' }, levers: YL };
  const yr = S.mgrSimRun(ym, YP.plan, {}, fakeWalk);
  eq([yr.comp.price.side, S.mgrSimShocks(ym, YP.plan, {}, yr, fakeWalk)[2].note], ['wholesale', 'No effect — you are already at 33,170.'],
    'and the rival test does not read a wholesale price as the retail one');

  eq([fact({ ourPriceFor: () => null })(paint, BOOKS()).why, fact({ waSalesByKey: () => new Map() })(paint, BOOKS()).why,
    fact({ buyKeyParts: () => null })(paint, BOOKS()).why],
  ['Paint 4L has no wholesale price of ours to start from', 'no wholesale sale of Paint 4L in 30 days', 'its line is no longer in the catalogue'],
  'a line the books cannot price says what is missing — never priced on a guess');
  eq(S.mgrSimPriceLever(BOOKS(), fact({ ourPriceFor: () => null })(paint, BOOKS())).id, 'price:P24', 'and the lever stays on the market reading’s line');
  eq(fact()(PM.filter((m) => m.status === 'open'), BW()), { key: 'P24', price: 35000, name: 'Y10 bar', line: null },
    'on the market reading’s own line, on its wholesale side, the price is all it needs');
  eq(fact()([{ i: 0, status: 'open', body: bodyOf({ kind: 'price', subject: { key: 'P24' } }) }], BOOKS()), null, 'an old price move with no price names none');

  /* A PLANNED PRICE MY PLAN DOES NOT CARRY IS SAID (law 3) -- on the
     levers panel and on the My plan preset, never dropped in silence. */
  const note = (pp, open, extra) => {
    const L = S.mgrSimLevers(BOOKS(), { moves: open, open, orders: [], offers: [], planPrice: pp });
    return S.mgrSimPlanPriceNote({ levers: L, planPrice: pp, ...(extra || {}) }, S.mgrSimPresets(L, open, open));
  };
  eq(note(fact({ ourPriceFor: () => null })(paint, BOOKS()), paint),
    { bad: true, text: 'My plan prices Paint 4L at 12,500 — not on a lever: Paint 4L has no wholesale price of ours to start from.' },
    'a line the books cannot price: My plan names the price it leaves out, and why');
  eq(note(fact({ buyKeyParts: () => null })(paint, BOOKS()), paint).text,
    'My plan prices a line at 12,500 — not on a lever: its line is no longer in the catalogue.', 'a line gone from the catalogue is still named as a price left out');
  eq(note(null, paint, { planPriceErr: 'the market record is away' }),
    { bad: true, text: 'The price today’s plan names could not be read — the market record is away. My plan leaves prices as they are.' },
    'a read that threw is named as a read that failed');
  eq(note(pf, paint), null, 'a price My plan carries needs no word');
  const same = [{ i: 0, status: 'open', body: bodyOf({ kind: 'price', subject: { key: 'P5' }, price: 12000 }) }];
  eq(note(below(same, BOOKS()), same), { bad: false, text: 'My plan keeps Paint 4L at today’s 12,000.' }, 'a plan at today’s price is said plainly, not as a fault');
  const two = [...paint, { i: 1, status: 'open', body: bodyOf({ kind: 'price', subject: { key: 'P24' }, price: 33000 }) }];
  eq(note(fact()(two, BOOKS()), two).text, 'My plan also prices Y10 bar at 33,000 — not on a lever: the simulator tries one planned price at a time, the first.',
    'a second planned price is named, not dropped');
  eq(S.mgrSimPlanPriceNote({ levers: [], planPrice: pf }, { plan: null }), null, 'no plan to start from: the preset says why itself');
  const PH = compileScope([fn('mgrSimPresetsHTML'), fn('mgrSimSame'), fn('mgrSimChoiceOf')], { esc: (v) => String(v).replace(/"/g, '&quot;') }, ['mgrSimPresetsHTML']).mgrSimPresetsHTML;
  const why = 'My plan prices Paint 4L at 12,500 — not on a lever: Paint 4L has no wholesale price of ours to start from.';
  t.check(PH({ presets: { plan: {}, cash: {}, growth: {} }, model: { levers: [] }, choice: {}, planWhy: 'nothing on today’s plan moves a lever here',
    planPriceNote: { bad: true, text: why } }).includes(`data-sim-preset="plan" disabled title="nothing on today’s plan moves a lever here — ${why}"`),
  'the My plan preset carries the reason in its title, beside the line on the levers panel');
}

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
const ok = { changed: 1, floor: F, low: { date: '2026-11-05', balance: 3200000 }, held: 3, of: 3, untestable: 0, breaks: [] };
eq(S.mgrSimVerdict({ ...ok, offer: { interest: 1070000, amount: 10000000 }, owed: 136669398, termsFree: { days: 14, freed: 18910757 } }).body,
  'You’d pay 1.07m a year to borrow 10m. Customers already owe you 137m. 14-day terms would free 18.91m over 60 days, if customers keep to them, without interest.',
  'an offer taken: safe, but its cost said — and what shorter terms would free, with its condition');
t.check(S.mgrSimVerdict({ ...ok, offer: { interest: 0, amount: 20000000 }, profitD: 0 }).head !== 'Safe, but expensive.', 'an offer at no interest is not called expensive');
eq(S.mgrSimVerdict({ ...ok, priceBetter: { at: 35750, better: 34900 } }).head, 'Close — but not that price.', 'a dearer step that earns less on the owner\'s own assumption');
eq(S.mgrSimVerdict({ ...ok, held: 1, of: 3, breaks: ['Nalubega Estates pays two weeks late', 'The season comes a week early'] }).body,
  'It breaks if Nalubega Estates pays two weeks late or if the season comes a week early.', 'fragile: the tests it fails, a name kept as it is');
eq(S.mgrSimVerdict({ ...ok, profitD: 81840, ranged: true, lo: 55056, hi: 81840 }).head, 'This is the plan I’d sign.', 'more profit even at the low end, and it holds');
eq(S.mgrSimVerdict({ ...ok, profitD: 81840, ranged: true, lo: -10000, hi: 81840 }).head, 'Better than today, and it holds.', 'more profit, but not at the low end');
eq(S.mgrSimVerdict({ ...ok, profitD: -50000, lo: -50000, hi: -50000 }).head, 'Safer, at a price.', 'less profit for the cushion');
eq(S.mgrSimVerdict({ ...ok, profitD: 0 }).head, 'It holds.', 'no profit change');
eq(S.mgrSimVerdict({ ...ok, profitD: 0, ranged: true, lo: -1100000, hi: 30000 }).body,
  'Profit as today (' + S.mgrSimMoney(-1100000) + ' to ' + S.mgrSimMoney(30000) + ' on your assumptions); cash stays above the floor through all three shocks.',
  'no change at the assumed value still says the range the owner\'s bounds allow');
eq(S.mgrSimVerdict({ ...ok, held: 2, of: 3, untestable: 1, profitD: 81840, lo: 81840, hi: 81840 }).body,
  '+82k a month, cash never under 3.2m, and it survives the 2 shocks that could be tested.', 'a test that could not be run is not claimed as survived');
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
eq([body.outcome.profit, body.outcome.holds, body.outcome.levers], [{ base: 10172190, change: 81840, lo: 55056, hi: 81840 }, { held: 3, of: 3, untestable: 0 },
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
eq(S.mgrSimTeaserFigures(), { profitMonth: null, profitLevel: null, lowest: null, expectedLowest: null, shocksHeld: null, shocksOf: 3,
  shocksUntestable: null, plan: 'nothing changes' },
  'a teaser that cannot be worked out answers with nothing — it never throws');
memoThrows = false;
teaserModel = { books: { ...BOOKS(), to: '2026-10-10', floor: { amount: 800, source: 'set' }, price: null }, levers: L.filter((l) => l.group === 'assumption') };
/* Nothing changes: the profit CHANGE is +0 (the Brief prints "as
   today"), its level today's 10,172,190; the committed low 700 on 9 Oct
   and the expected low 950 today beside it; the late payer takes the
   expected band to 750, under the 800 floor -- 0 held, the other two not
   testable (Q40). */
eq(S.mgrSimTeaserFigures(), { profitMonth: { lo: 0, hi: 0 }, profitLevel: { lo: 10172190, hi: 10172190 }, lowest: { balance: 700, date: '2026-10-09' },
  expectedLowest: { balance: 950, date: TODAY }, shocksHeld: 0, shocksOf: 3, shocksUntestable: 2, plan: 'nothing changes' },
  'no plan read: the teaser is today, unchanged — the change +0, today\'s level, the committed low and the expected one, 0 of three held on the expected line');
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
    'mgrSimExpected', 'mgrSimShift', 'mgrSimPoss', 'mgrSimRun', 'mgrSimCompose', 'mgrSimChoiceOf', 'mgrSimAssumeOf', 'mgrSimBillLever', 'mgrSimOrderLever',
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
  /* A supplier's offer, even at 0%, brings no money onto the committed
     line: taking it is refused, so the walk is not asked and nothing
     lands as a loan-in. */
  const supOffer = W.mgrSimOfferLever(books, [{ id: 4, from: 'supplier', name: 'Roofings', amount: 20000000, rate: 0, termMonths: 3, priced: true, interestYear: 0, instalment: 6666667, interestMonth: 0 }]);
  r = W.mgrSimRun({ books, levers: [supOffer] }, { offer: 'take:4' }, {}, () => { throw new Error('asked'); });
  t.check(r.low.balance === base.tightest.balance && !r.walk.days.some((d) => d.events.some((e) => e.kind === 'loan-in')),
    'a supplier\'s offer adds no money in: the low stays 5.9m');
  /* An order from a supplier whose credit days are not written: counted
     on delivery, 7 Oct + 2 = 9 Oct, 2,000,000 -- the low 3.9m, never as if
     it cost nothing. */
  const orderNC = W.mgrSimOrderLever(books, { key: 'P1', name: 'Cement', qty: 10, unit: 'bag', supplierId: 'S9', supplier: 'Depot', unitCost: 200000,
    cost: 2000000, a: { lead: 2, credit: null, deliveries: 6 }, split: null });
  r = W.mgrSimRun({ books, levers: [orderNC] }, { 'order:P1': 'a' }, {}, W.mgrCashWalk);
  eq([at(r, '2026-10-08'), at(r, '2026-10-09'), r.low.balance], [7000000 + 2000000, 7000000, 3900000],
    'no credit days written: the order counted on delivery, the low 3.9m');
}

/* ---------- 11. a bill paid after a customer follows their money ----------
   Kato (C1) is expected on 8 Oct in the walk's band. The plan pays Steel
   & Tube's bill after he pays. Chased a week later, his money lands 15
   Oct -- and the bill waits with it. Not chased at all, he is not
   expected in these days -- the bill is still owed, so it is counted on
   the last day (6 Nov), never left off. */
{
  const seen = [];
  const walkFn = (o) => { seen.push(o.adjust.bills.map((x) => [x.billId, x.to])); return WALK(); };
  const mdl = { books: BOOKS(), levers: L };
  let r = S.mgrSimRun(mdl, { 'bill:891': 'after:C1' }, {}, walkFn);
  eq([seen.pop(), r.waits], [[[891, '2026-10-08']], [{ billId: 891, after: 'C1', to: '2026-10-08', moved: false, gone: false }]],
    'paid after Kato: on the day his money is expected in the band');
  r = S.mgrSimRun(mdl, { 'bill:891': 'after:C1', 'chase:C1': 'week' }, {}, walkFn);
  eq([seen.pop(), r.waits[0].moved], [[[891, '2026-10-15']], true], 'Kato chased a week later: the bill waits for him, 15 Oct');
  t.check(/lands Thu 15 Oct with your chase choice/.test(S.mgrSimWaitHint(lv('bill:891'), lv('bill:891').opts[1], r)), 'and the bill\'s hint says where it went');
  r = S.mgrSimRun(mdl, { 'bill:891': 'after:C1', 'chase:C1': 'none' }, {}, walkFn);
  eq([seen.pop(), r.waits[0].gone], [[[891, '2026-11-06']], true], 'Kato not chased: the bill counted on the last day, still owed');
  t.check(/not expected to pay in these 30 days/.test(S.mgrSimWaitHint(lv('bill:891'), lv('bill:891').opts[1], r)), 'and its hint says so');
  /* The late payer's test moves the bill with him: 8 Oct + 14 = 22 Oct. */
  S.mgrSimRun(mdl, { 'bill:891': 'after:C1' }, {}, walkFn, { moves: [{ customerId: 'C1', days: 14 }] });
  eq(seen.pop(), [[891, '2026-10-22']], 'a late payer\'s test carries the bill that waits on him');
  eq(S.mgrSimLands([{ customerId: 'C1', date: '2026-10-08' }], [], 'C9'), { date: null, moved: false }, 'a customer with no expected payment lands nowhere');
}

/* ---------- 12. the scenario's facts, the targets it moves, the verdict's inputs ---------- */
{
  /* The ripple's facts: dead stock 1,000,000 of a 187,630,801 shelf, a
     clearance taking 250,000 off it -> 750,000, a share of 750,000 ÷
     187,630,801. The walk is passed only when there is one. */
  const b = BOOKS();
  const run = { walk: null, debtorDays: 32.77, stockValue: 187380801, stockDays: 33.5, deadValue: 750000 };
  const f = S.mgrSimScenarioFacts(b, run);
  eq([f.walk, f.debtorDays.days, f.daysOfStock.value, f.deadStock.value], [undefined, 32.77, 187380801, 750000], 'the scenario\'s figures, in the health checks\' own shape');
  t.check(Math.abs(f.deadStock.share - 750000 / 187630801) < 1e-12, 'and the dead share, recomputed on the scenario\'s dead stock');

  /* Targets: the owner runs three -- debtor days, net profit, WhatsApp
     orders -- and has one finished. 14-day terms move debtor days (35.2
     -> 32.8) and profit (the margin on sales assumed lost is 0 at the
     neutral start, so not profit); no post. One target touched. */
  const mdl = { books: b, levers: L };
  const fw = () => { throw new Error('nothing committed'); };
  const base = S.mgrSimRun(mdl, {}, {}, fw), withT = S.mgrSimRun(mdl, { terms: 't14' }, {}, fw);
  const tg = [{ id: 1, metric: 'debtor_days' }, { id: 2, metric: 'net_profit' }, { id: 3, metric: 'wa_orders' }, { id: 4, metric: 'debtor_days', finished: true },
    { id: 5, metric: 'load_time' }];
  eq(S.mgrSimTargetsTouched(tg, base, withT), [{ id: 1, metric: 'debtor_days' }], 'the running targets these choices move — a finished one, or one the simulator does not compute, never');
  eq(S.mgrSimTargetsTouched(tg, base, S.mgrSimRun(mdl, { terms: 't14', 'price:P24': 'p1', post: 'post' }, {}, fw)).map((x) => x.id), [1, 2, 3],
    'a price step moves net profit; a post, WhatsApp orders');
  eq(S.mgrSimTargetsTouched(tg, base, base), [], 'nothing changed: no target');

  /* The verdict's inputs. Floor 600. The order (committed 15 Oct) takes
     the committed low to 500 -- under; leaving it alone keeps 700. */
  const b6 = { ...b, floor: { amount: 600, source: 'set' } };
  const m6 = { books: b6, levers: L };
  const walkO = (o) => (o.adjust.oneOff.length ? { ...WALK(), tightest: { date: '2026-10-15', balance: 500 } } : WALK());
  const P6 = S.mgrSimPresets(L, S.mgrSimOpen(MOVES), MOVES);
  const run6 = S.mgrSimRun(m6, { 'order:P1': 'a' }, {}, walkO);
  const vi = S.mgrSimVerdictInputs(m6, { 'order:P1': 'a' }, {}, run6, P6, walkO);
  eq(vi.fix, 'Leaving the Simba Cement 50kg order as it is keeps cash above the floor.', 'the committed choice whose undoing alone lifts the line over the floor');
  eq(vi.termsFree, { days: 14, freed: 18910757 }, 'the shortest terms\' cushion, when they are not chosen');
  eq(vi.missing, ['Steel & Tube’s bill'], 'what my plan does that these choices do not');
  eq(vi.offer, null, 'no offer taken');
  /* A price step at 34,050 on a tenth less volume earns 55,056; 35,750
     earns 93 × 0.9 × 2,580 − 9.3 × 2,000 = 215,946 − 18,600 = 197,346 --
     more, on the owner's same assumption. */
  const viP = S.mgrSimVerdictInputs({ books: b, levers: L }, { 'price:P24': 'p1' }, { 'price:P24': { value: -10 } },
    S.mgrSimRun({ books: b, levers: L }, { 'price:P24': 'p1' }, { 'price:P24': { value: -10 } }, fw), P6, fw);
  eq(viP.priceBetter, { at: 34050, better: 35750 }, 'a step that earns more on the same volume assumption is named');
  const viO = S.mgrSimVerdictInputs({ books: b, levers: L }, { offer: 'take:5' }, {}, { comp: { adjust: { loan: {} } }, changed: [], low: null }, P6, fw);
  eq(viO.offer, { interest: 0, amount: 12000000 }, 'the bank offer taken, with its year\'s interest');
}

/* ---------- 13. the books, read once (mgrSimBooksBuild) ----------
   A tiny shop, every reader stubbed with figures small enough to check. */
{
  const DAY = TODAY;
  const data = {
    customers: [{ id: 'C1', name: 'Kato', termsDays: 30 }, { id: 'C2', name: 'Nalubega', termsDays: 21 }, { id: 'C3', termsDays: 14 },
      { id: 'C4', termsDays: 7 }, { id: 'C5', termsDays: 30 }],
    suppliers: [{ id: 'S3', name: 'Steel & Tube', stopAtDays: 90 }],
    staff: [{ id: 'ST1', name: 'Joan Nakato', role: 'counter' }, { id: 'ST2', name: 'Peter' }, { id: 'ST3', name: 'Ann' }],
    waPosts: [], savedQuotes: [], cashTxns: [],
  };
  const WALKB = { tightest: { date: DAY, balance: 1 }, floor: { amount: 3000000, source: 'set' },
    expectedReceipts: [{ customerId: 'C1', kind: 'chase', date: '2026-10-08', amount: 300 }, { customerId: 'C2', kind: 'chase', date: '2026-10-10', amount: 500 }] };
  const ranges = [];
  const INV = [{ counterSale: false, profit: 100, sales: 1000 }, { counterSale: false, profit: 200, sales: 2000 }, { counterSale: false, profit: 300, sales: 3000 },
    { counterSale: true, profit: 9999, sales: 99999 }];
  const B = compileScope([fn('mgrSimBooksBuild'), fn('mgrSimSeason'), fn('mgrSimTermsFact'), fn('mgrSimQuantile'), fn('anShiftDate'), fn('daysBetweenISO'),
    fn('clearanceFor')], {
    data, console: { warn() {} },
    mgrMemo: (k, f) => f(),
    mgrCashWalk: () => WALKB,
    mgrHealthFacts: () => ({ debtorDays: { days: 35.2, receivables: 136669398, creditPerDay: 3882323, creditSales: 349409070, windowDays: 90 },
      daysOfStock: { days: 30, value: 3000000, cogsPerDay: 100000 }, deadStock: { value: 1000, total: 3000000 }, debt60: { amount: 63406119, count: 4 } }),
    waSalesByKey: () => new Map([['K', { units30: 10, profit30: 1000, sales30: 5000 }]]),
    buyKeyParts: (k) => ({ product: k, variantIdx: null }), productVariantLabel: (p) => 'Line ' + p,
    anOverallTotals: (rows) => ({ profit: rows.reduce((n, r) => n + r.profit, 0), sales: rows.reduce((n, r) => n + r.sales, 0) }),
    anInvoicesInRange: (f, to) => { ranges.push([f, to]); return INV; },
    mgrChaseLags: () => [{ customerId: 'C1', name: 'Kato', k: 3, n: 4, lagDays: 3, lastChased: '2026-10-05' }, { customerId: 'C2', name: 'Nalubega', k: 2, n: 2, lagDays: 3, lastChased: null }],
    mgrCashFloor: () => ({ amount: 3000000, source: 'set' }),
    incomeStatement: (f, to) => { ranges.push(['is', f, to]); return { revenue: 6000, netProfit: 450.4,
      uncostedDues: [{ kind: 'wage', refId: 'ST9', period: '2026-10', amount: null }] }; },
    dueName: (d) => (d.refId === 'ST9' ? 'Okello Denis' : 'Staff member'),
    mgrDebtorDays: () => { throw new Error('read from the health facts'); }, mgrDaysOfStock: () => { throw new Error('read from the health facts'); },
    mgrHealthChecks: () => ({ checks: [{ id: 'debtor_days', threshold: 30 }, { id: 'stock_days', threshold: 90 }] }),
    promisesBroken: () => 0,
    credOpenInvoices: () => [{ invoice: { id: 891, date: '2026-07-25' }, supplierId: 'S3', due: 5670120, dueOn: '2026-08-24', ageDays: 74 }],
    supplierName: (id) => (id === 'S3' ? 'Steel & Tube' : ''),
    deadStockRows: () => [], deadStockQuietDays: () => 60, consignmentUnitCostForKey: () => null,
    marketVerdict: () => ({ lift: [] }),
    staffOnPayroll: () => [{ name: 'Joan Nakato', payBasis: 'monthly', payRate: 900000 }, { name: 'Peter', payBasis: 'monthly', payRate: 500000 }],
    basisMonthCost: (basis, rate) => rate,
    mgrPayday: () => ({ kind: 'monthly', day: 28, settles: 'same' }), mgrPaydayLabel: () => 'the 28th of each month',
    managerGrowthBaseline: () => ({ quotes: { rate: 0.867, eligible: 158, converted: 137 } }),
    /* Four ripe posts on line K, each followed by 2, −1, 0 and 4 more
       units; K sells 10 a month at 100 of profit and 500 of sales each. */
    waPostOutcomes: () => [{ key: 'K', lift: 2, ripe: true }, { key: 'K', lift: -1, ripe: true }, { key: 'K', lift: 0, ripe: true }, { key: 'K', lift: 4, ripe: true },
      { key: 'K', lift: 50, ripe: false }],
    WA_LIFT_MIN_POSTS: 3,
    booksStartDate: () => '2026-01-01', cashIsMoneyOut: () => true,
  }, ['mgrSimBooksBuild']);
  const bk = B.mgrSimBooksBuild(DAY);
  eq(bk.errors, [], 'nothing failed to read');
  /* Terms in use: 30, 21, 14, 7. Young debt 136,669,398 − 63,406,119 =
     73,263,279. At 30 or 21 days the young debt would be 116.5m or
     81.5m -- more than it is: nothing freed. At 14: 73,263,279 −
     54,352,522 = 18,910,757. At 7: 73,263,279 − 27,176,261 = 46,087,018. */
  eq([bk.terms.options, bk.terms.freed, bk.terms.young], [[14, 7], [18910757, 46087018], 73263279], 'the terms that would free anything, longest first, two at most');
  eq([bk.hire.name, bk.hire.cost, bk.hire.staff, bk.hire.payday.day], ['Peter', 500000, 3, 28], 'a hire paid as the cheapest salary on the payroll');
  /* Quotes: three non-counter invoices in 90 days with 600 of profit and
     6,000 of sales: 200 and 2,000 on each; the counter sale is left out. */
  eq([bk.quote.who, bk.quote.avgProfit, bk.quote.avgSale, bk.quote.eligible], ['Joan Nakato', 200, 2000, 158], 'the quote baseline: profit and sales per invoice, counter sales left out');
  /* Posts: 2, −1, 0 and 4 units at 100 each: 200, −100, 0, 400. Sorted
     −100, 0, 200, 400: median 100; the 25th percentile three quarters of
     the way from −100 to 0 = −25; the 75th a quarter of the way from 200
     to 400 = 250. The unripe post is not counted. */
  eq([bk.post.n, bk.post.median, bk.post.p25, bk.post.p75, bk.post.up], [4, 100, -25, 250, 2], 'past posts: the middle and quartiles of what followed them');
  /* Kato was chased 5 Oct with a 3-day lag: his money is already on its
     way, so "if chased today" is not his; Nalubega has no chase out. */
  eq(bk.receipts.map((r) => [r.customerId, r.ifToday, r.k, r.n]), [['C1', false, 3, 4], ['C2', true, 2, 2]], 'which expected payments a chase today would bring');
  eq(bk.bills[0].reachesOn, '2026-10-23', 'a bill dated 25 Jul reaches its supplier\'s 90-day stop on 23 Oct');
  /* The month's margin is every invoice's, counter sales too: 10,599 of
     105,999. */
  eq([bk.profit.net, bk.marginPct, bk.aims], [450, 10599 / 105999, { debtorDays: 30, stockDays: 90 }], 'today\'s pace, the month\'s margin and the health checks\' aims');
  eq(bk.season, { available: false, booksStart: '2026-01-01', needs: '2025-08-13' }, 'under a year and eight weeks of books: no season, and why');
  /* ONE MONTH, ON WHOLE DAYS (the final review): the month's profit and
     margin are read over the 30 days to yesterday -- 7 Oct − 30 = 7 Sep
     to 6 Oct -- the window the Targets' net profit and margin read
     (MANAGER_METRICS), not the 30 days to today. */
  eq([ranges[0], ranges.find((r) => r[0] === 'is')], [['2026-09-07', '2026-10-06'], ['is', '2026-09-07', '2026-10-06']],
    'the month\'s margin and net profit: the 30 days to yesterday, as the Targets read them');
  eq([bk.profit.from, bk.profit.to, bk.month], ['2026-09-07', '2026-10-06', { sales: 105999, profit: 10599 }], 'and the month kept for the margin target');
  /* A daily wage nobody has costed is out of that net profit, and named. */
  eq(bk.profit.uncosted, [{ name: 'Okello Denis', period: '2026-10', kind: 'wage' }], 'an uncosted wage is named, not counted as nothing');
  eq(S.mgrSimUncostedSay(bk.profit), 'leaves out Okello Denis’ wage — paid by the day, not costed', 'and said on the net profit tile, the possessive the app\'s own (mgrPossessive)');
  eq(S.mgrSimUncostedSay({ uncosted: [] }), null, 'nothing left out: nothing said');
}

/* ---------- 14. no cash walk to stand on ----------
   The walk could not be read: the run says so -- no line, no lows -- the
   tests are not testable, and nothing throws. */
{
  const nb = { ...BOOKS(), walk: null, errors: ['cash'] };
  const r = S.mgrSimRun({ books: nb, levers: L }, { 'order:P1': 'a', 'price:P24': 'p1' }, {}, () => { throw new Error('must not be asked'); });
  eq([r.walk, r.low, r.expLow, r.profit.d], [null, null, null, 81840], 'no walk: no lows, every other figure still reads');
  const sh = S.mgrSimShocks({ books: nb, levers: L }, {}, {}, r, () => { throw new Error('must not be asked'); });
  eq([sh.map((x) => x.held), S.mgrSimHolds(sh)], [[null, null, null], { held: null, of: 3, untestable: 3 }], 'no test can be run, and none is claimed');
  t.check(/could not be read/.test(S.mgrSimHeadline({ floor: F, base: r, plan: null })), 'the headline names it rather than saying the path stays above the floor');
  eq(S.mgrSimVerdict({ changed: 2, floor: F, low: null }).body, 'The cash ahead could not be read.', 'and so does the verdict');
}

/* ---------- 15. the final review ---------- */
{
  /* NOT ON THE LINE (SIM.1, Q28). The walk's own list: Okello's daily
     wage (not costed), 11 undated bills (46,294,136), 5 buy orders on the
     way (6,314,070), what customers owe with no day named (136,669,398)
     and, in this scenario, Steel's bill moved past the window. A choice
     puts undated bill #77 (1,000,000) on the line today: the undated row
     is then 10 bills, 46,294,136 − 1,000,000 = 45,294,136 -- never
     counted on the line and off it at once. */
  const list = [
    { kind: 'wage', dept: 'people', label: 'Okello Denis — October 2026', amount: null, why: 'paid by the day — not costed until the days are counted' },
    { kind: 'bill', dept: 'procurement', label: '11 bills with no day named', amount: 46294136, count: 11, why: 'owed, but nobody has said when' },
    { kind: 'order', dept: 'procurement', label: '5 buy orders on the way', amount: 6314070, count: 5, why: 'owed when the goods and their bill arrive' },
    { kind: 'owed', dept: 'finance', label: 'Money owed to you with no day named', amount: 136669398, count: 40, why: 'not cash until it is paid' },
    { kind: 'bill', dept: 'procurement', label: 'Steel — bill', amount: 5670120, why: 'moved past these 30 days in this scenario' }];
  const off = S.mgrSimOffLine(list, [{ billId: 77, to: TODAY }, { billId: 891, to: '2026-12-01' }],
    [{ billId: 77, due: 1000000, dueOn: null }, { billId: 891, due: 5670120, dueOn: '2026-08-24' }]);
  eq(off.map((x) => [x.kind, x.label, x.amount, x.dir, x.scenario]), [
    ['wage', 'Okello Denis — October 2026', null, 'out', false],
    ['bill', '10 bills with no day named', 45294136, 'out', false],
    ['order', '5 buy orders on the way', 6314070, 'out', false],
    ['owed', 'Money owed to you with no day named', 136669398, 'in', false],
    ['bill', 'Steel — bill', 5670120, 'out', true]], 'what is not on the line: each row with its amount, its way, and whether only this scenario puts it there');
  eq(S.mgrSimOffLine(list.slice(1, 2), [{ billId: 77, to: TODAY }], [{ billId: 77, due: 46294136, dueOn: null }]).length, 11 - 11 + 1,
    'one undated bill of eleven placed: the row stays, ten left');
  const OH = compileScope([fn('mgrSimOffLineHTML'), fn('mgrShortUGX')], { esc: (v) => String(v) }, ['mgrSimOffLineHTML']).mgrSimOffLineHTML;
  const html = OH(off);
  t.check(/Not on the line · 5/.test(html) && />not costed</.test(html) && /−45\.29m/.test(html) && /\+137m/.test(html) && /this scenario/.test(html)
    && /paid by the day — not costed until the days are counted/.test(html), 'the strip names each: not costed, −45.29m of bills, +137m owed, the scenario\'s own row, and why');
  t.check(/mgrSimOffLineHTML\(c\.offLine/.test(fn('mgrSimCalHTML')) && /mgrSimOffLine\(run\.walk\.notOnLine, run\.comp\.adjust\.bills, b\.bills\)/.test(fn('mgrSimCompute')),
    'the calendar draws it, from the scenario\'s own walk');
  t.check(/mgrSimUncostedSay\(b\.profit\)/.test(fn('mgrSimOutHTML')), 'and the net profit tile names an uncosted wage');

  /* SEVERAL MOVES OF ONE CUSTOMER ADD UP. Kato's 300 on 8 Oct moved a
     day, then a day more: 10 Oct -- 950, 950, 750, 1050 (the second move
     used to be dropped: 950, 950, 1050, 1050). Moved, then taken off:
     off for good -- 950, 950, 750, 750. */
  eq(S.mgrSimExpected(WALK(), [], [{ customerId: 'C1', days: 1 }, { customerId: 'C1', days: 1 }]).days.map((d) => d.expected), [950, 950, 750, 1050],
    'two moves of one payment are one move by their sum');
  eq(S.mgrSimExpected(WALK(), [], [{ customerId: 'C1', days: 1 }, { customerId: 'C1', days: null }]).days.map((d) => d.expected), [950, 950, 750, 750],
    'a move that takes it off takes it off');
  eq([S.mgrSimLands([{ customerId: 'C1', date: '2026-10-08' }], [{ customerId: 'C1', days: 7 }, { customerId: 'C1', days: 14 }], 'C1'),
    S.mgrSimLands([{ customerId: 'C1', date: '2026-10-08' }], [{ customerId: 'C1', days: 7 }, { customerId: 'C1', days: null }], 'C1')],
  [{ date: '2026-10-29', moved: true }, { date: null, moved: true }], 'where the money lands: 8 Oct + 7 + 14 = 29 Oct; taken off, nowhere');
  /* Chased a week later AND two weeks late in the stress test: the bill
     paid after Kato waits 21 days, 8 Oct -> 29 Oct (it used to stop at
     the chase's 15 Oct). */
  const seen = [];
  S.mgrSimRun({ books: BOOKS(), levers: L }, { 'bill:891': 'after:C1', 'chase:C1': 'week' }, {},
    (o) => { seen.push(o.adjust.bills.map((x) => [x.billId, x.to])); return WALK(); }, { moves: [{ customerId: 'C1', days: 14 }] });
  eq(seen.pop(), [[891, '2026-10-29']], 'a chase put back a week and a late payer\'s two weeks: the bill waits 21 days');

  /* GROSS PROFIT IS NOT NET PROFIT. A bank's 12m at 12% taken: about
     −120,000 of interest a month, below gross profit -- net profit moves,
     gross profit and the margin do not. A hire bringing its 500,000 cost:
     gross profit +500,000, net 0 -- and the margin on a 100m month at 9m
     moves from 9.0% to 9.5%. */
  const ofL = S.mgrSimOfferLever(BOOKS(), [OFFER12]);
  const mO = { books: BOOKS(), levers: [ofL, lv('hire'), lv('clear')] };
  const wk = () => WALK();
  const baseO = S.mgrSimRun(mO, {}, {}, wk);
  const tg = [{ id: 1, metric: 'gross_profit' }, { id: 2, metric: 'net_profit' }, { id: 3, metric: 'margin_pct' }];
  const month = { sales: 100000000, profit: 9000000 };
  eq(S.mgrSimTargetsTouched(tg, baseO, S.mgrSimRun(mO, { offer: 'take:6' }, {}, wk), month).map((x) => x.metric), ['net_profit'],
    'an offer taken moves net profit only — interest is below gross profit');
  eq(S.mgrSimTargetsTouched(tg, baseO, S.mgrSimRun(mO, { hire: 'yes' }, {}, wk), month).map((x) => x.metric), ['gross_profit', 'margin_pct'],
    'a hire that brings its cost: gross profit and the margin move, net profit does not');
  /* Clearance at cost, half sold: 500,000 of sales at no profit -- 9m of
     100.5m is 8.955%, still 9.0% to a tenth of a point: no target moved. */
  eq(S.mgrSimTargetsTouched(tg, baseO, S.mgrSimRun(mO, { clear: 'cost' }, {}, wk), month), [], 'sales at cost that leave the margin at 9.0%: none');

  /* THE LEGEND names the weightiest first: nine customers' payments
     (8-16 Oct) and a supplier's stop day (23 Oct). Eight are named --
     the stop day among them -- and the two left out are counted, their
     kind keeping its line. */
  const named = [];
  for (let i = 0; i < 9; i++) named.push({ date: '2026-10-' + String(8 + i).padStart(2, '0'), kind: 'chase', letter: 'C', text: 'Customer ' + i + ' pays' });
  named.push({ date: '2026-10-23', kind: 'deadline', letter: 'D', text: 'Steel stops delivering' });
  const lg = S.mgrSimLegendNamed(named, 8);
  eq([lg.shown.length, lg.shown.some((x) => x.kind === 'deadline'), lg.more, lg.kinds, lg.shown[lg.shown.length - 1].date],
    [8, true, 2, ['chase'], '2026-10-23'], 'eight named, the stop day first in weight and last in date; two more counted');
  t.check(/mgrSimLegendNamed\(named, MGR_SIM_LEGEND_NAMED\)/.test(fn('mgrSimCalHTML')) && !/named\.slice\(0, 8\)/.test(fn('mgrSimCalHTML')),
    'the calendar\'s legend is built by it, never cut by date');

  /* THE STOP DAY FOLLOWS THE SCENARIO. Steel & Tube's bill reaches 90
     days on 23 Oct. Paid on 10 Oct in this scenario: no stop. Paid on 23
     Oct, or nowhere on the line: it still stops. */
  const stopRun = (date) => ({ changed: [{ id: 'bill:891' }], walk: { days: [{ date: date || '2026-10-08', events: date ? [{ kind: 'bill', line: 'committed', billId: 891, amount: -5670120 }] : [] }] } });
  eq([S.mgrSimStops([b891], stopRun('2026-10-10'), BOOKS()), S.mgrSimStops([b891], stopRun('2026-10-23'), BOOKS()).map((x) => [x.on, x.paidOn, x.changed]),
    S.mgrSimStops([b891], stopRun(null), BOOKS()).map((x) => [x.on, x.paidOn])],
  [[], [['2026-10-23', '2026-10-23', true]], [['2026-10-23', null]]], 'paid before the stop day: no marker; on it, or not at all: the marker stays');
  t.check(/mgrSimStops\(c\.model\.levers, run, b\)/.test(fn('mgrSimMarks')), 'and the calendar draws the stop day from it');

  /* THE VERDICT SAYS IT: cash holds, the deliveries do not. */
  const st = S.mgrSimVerdict({ ...ok, stops: [{ who: 'Steel & Tube Industries', at: 90, on: '2026-10-23', paidOn: '2026-11-06', changed: true }] });
  eq([st.cls, st.head, st.body], ['am', 'Cash holds, but Steel & Tube Industries stops delivering on Fri 23 Oct.',
    'Its bill reaches their 90-day limit that day and these choices pay it Fri 6 Nov. Paid before Fri 23 Oct, deliveries keep coming.'],
  'a bill left past its supplier\'s stop day: amber, named, with the day');
  t.check(/stops: mgrSimStops\(model\.levers, run, b\)\.filter\(x=> x\.changed\)/.test(fn('mgrSimCompute')), 'from the choices the owner moved');

  /* ONE POSSESSIVE: "Steel & Tube Industries’", never "Industries’s". */
  eq([S.mgrSimPoss('Steel & Tube Industries'), S.mgrSimPoss('Kato Construction Ltd')], ['Steel & Tube Industries’', 'Kato Construction Ltd’s'], 'possessives, one apostrophe');
  const lateI = S.mgrSimBillLever(BOOKS(), { ...BOOKS().bills[0], supplier: 'Steel & Tube Industries', dueOn: '2026-10-20' }, {}, MOVES, BOOKS().receipts);
  t.check(/past Steel & Tube Industries’ 90-day limit/.test(lateI.opts.find((o) => o.id === 'week').hint), `the limit said rightly (${lateI.opts.find((o) => o.id === 'week').hint})`);
  t.check(!/'\\'s |'’s /.test(src.slice(src.indexOf('\n/* ═══ MGR BED: Sim — begin ═══ */'), src.indexOf('/* ═══ MGR BED: Sim — end ═══ */', src.indexOf('\n/* ═══ MGR BED: Sim — begin ═══ */')))),
    'no possessive built by hand in the section');

  /* ROUTINE BUYING ON THE EXPECTED BAND. The walk took a 100 order off
     the expected band on 9 Oct, as it takes any one-off. With a usual
     day's trading on the band (it already pays suppliers, as for a dated
     bill) the order goes back on it: 950, 1250, 1050, 1050. Without
     trading on the band, it stays off. */
  const W2 = () => ({ ...WALK(), days: WALK().days.map((d, i) => ({ ...d, expected: d.expected - (i >= 2 ? 100 : 0) })) });
  const back = [{ date: '2026-10-09', amount: -100, routine: true }];
  eq(S.mgrSimExpected({ ...W2(), trading: { byWeekday: [{ weekday: 0, mean: 500 }] } }, [], [], back).days.map((d) => d.expected), [950, 1250, 1050, 1050],
    'an order from the buying plan is inside the usual trading on the expected band — not taken off twice');
  eq(S.mgrSimExpected({ ...W2(), trading: { byWeekday: [{ weekday: 0, mean: null }] } }, [], [], back).days.map((d) => d.expected), [950, 1250, 950, 950],
    'with no usual trading on the band, it stays off');
  eq(sLv.effect('ly').out.some((x) => x.routine), false, 'the season\'s above-usual buying is not routine: it stays off the expected band');

  /* Q40 ON SCREEN: the shock's verdict on the expected line, the
     committed low on its own line beside it -- crimson and named when it
     is under the floor, never hidden. */
  const SHH = compileScope([fn('mgrSimShocksHTML'), fn('mgrSimMoney'), fn('mgrSimSigned'), fn('mgrShortUGX'), fn('mgrSimDay'), fn('waWeekday'),
    fn('mgrSimNoFloor'), decl('MGR_SIM_NO_FLOOR'),
    decl('MGR_SIM_SHOCK'), decl('MGR_SIM_MONTHS'), decl('MGR_WEEKDAYS')], { esc: (v) => String(v) }, ['mgrSimShocksHTML']).mgrSimShocksHTML;
  const shH = SHH({ holds: { held: 1, of: 3, untestable: 2 }, floor: { amount: 3000000, source: 'set' }, shocks: [
    { id: 'late', label: 'Nalubega pays two weeks late', available: true, held: true, low: { date: '2026-11-05', balance: -1064326 },
      expLow: { date: '2026-11-06', balance: 32595854 }, note: 'n' }] });
  t.check(/mgr-x-up">Holds — expected low 32\.6m, Fri 6 Nov</.test(shH) && /mgr-x-res mgr-x-dn">Committed low −1\.06m, Thu 5 Nov — under the floor, counting only money in hand</.test(shH)
    && /Judged on the expected line against the floor/.test(shH), 'a shock held on the expected line shows its committed break beside it, in crimson');

  /* NO FLOOR KNOWN (mgrCashFloor().amount == null): judged against
     running out, and said -- never "the stand-in floor is 0", "stays
     above nothing" or "below nothing". The same shock, committed low
     -1.06m: "Runs out" beside it. */
  const nfH = SHH({ holds: { held: 1, of: 3, untestable: 2 }, floor: { amount: null, source: 'stand-in', note: 'no rent or salary' }, shocks: [
    { id: 'late', label: 'Nalubega pays two weeks late', available: true, held: false, low: { date: '2026-11-05', balance: -1064326 },
      expLow: { date: '2026-11-06', balance: -200000 }, note: 'n' }] });
  t.check(/mgr-x-dn">Runs out — expected low −200k, Fri 6 Nov</.test(nfH) && /Committed low −1\.06m, Thu 5 Nov — runs out, counting only money in hand/.test(nfH)
    && /Judged on the expected line against running out — no floor known/.test(nfH) && !/the floor/.test(nfH), `no floor known: the shocks are judged against running out (${nfH.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 300)})`);
  /* The band's headline and the verdict. Today's committed path: 1,000
     on 7 Oct, -500 on 8 Oct -- it runs out on Thu 8 Oct; the plan's stays
     at 1,000 and 200: it never does. */
  const nfWk = (vals) => ({ days: vals.map((v, i) => ({ date: '2026-10-0' + (7 + i), committed: v })) });
  const NF = { amount: null, source: 'stand-in', note: 'no rent or salary' };
  eq(S.mgrSimHeadline({ floor: NF, base: { walk: nfWk([1000, -500]) }, plan: { walk: nfWk([1000, 200]) } }),
    'Move any decision and I’ll play out the next 30 days before you commit. With no floor known — judged against running out, today’s path runs out on Thu 8 Oct; my plan doesn’t.',
    'the headline: no floor known, judged against running out');
  eq(S.mgrSimHeadline({ floor: NF, base: { walk: nfWk([1000, 200]) }, plan: { walk: nfWk([1000, 300]) } }),
    'Move any decision and I’ll play out the next 30 days before you commit. With no floor known — judged against running out, today’s path never runs out; nor does my plan.',
    'and when neither runs out');
  const vNF = S.mgrSimVerdict({ floor: NF, changed: false, low: { date: '2026-10-08', balance: 200 } });
  eq(vNF.body, 'Cash after what is already promised never runs out (no floor known — judged against running out) — lowest 200 on Thu 8 Oct. Start from my plan, or move one choice at a time.',
    'the verdict on an unchanged day with no floor known');
  t.check(!/nothing/.test(vNF.body), 'never "above nothing"');
  const vNF2 = S.mgrSimVerdict({ floor: NF, changed: true, low: { date: '2026-10-08', balance: -500 } });
  t.check(/^Cash falls to −500 on Thu 8 Oct — it runs out \(no floor known — judged against running out\), counting only money already in hand/.test(vNF2.body),
    `and a choice that runs out says so (${vNF2.body})`);
  const cal = fn('mgrSimCalHTML');
  t.check(/mgrSimNoFloor\(floor\) \? MGR_SIM_NO_FLOOR/.test(cal) && /\['lo', 'under 0 · runs out'\], \['ok', '0 or more'\]/.test(cal) && !/below nothing|above nothing/.test(cal),
    'the calendar says no floor is known, and its key reads "under 0 · runs out" / "0 or more"');

  /* SIGNED HERE COUNTS HONESTLY: a lever carrying an assumption is kept
     as one, though its prices are the books' -- the clearance at the
     owner's prices rests on how much of it sells (50%). A bill moved is
     the books'. So 2 choices, 1 on your assumptions. */
  const body = S.mgrSimDecisionBody({ today: TODAY, verdict: { head: 'h', body: 'b' }, holds: { held: 3, of: 3 }, alone: [], floor: null,
    run: { low: null, expLow: null, profit: { base: 0, d: 0, lo: 0, hi: 0 }, changed: [
      { id: 'clear', label: 'Dead stock', choiceLabel: 'At your clearance price', dept: 'store', from: 'books', say: 'cleared',
        assumption: { value: 50, lo: 25, hi: 75, unit: '%', label: 'Of it sold in 30 days' } },
      { id: 'bill:891', label: 'Steel bill', choiceLabel: 'After the chase', dept: 'procurement', from: 'books', say: 'paid later', assumption: null }] } });
  eq(body.levers.map((l) => [l.id, l.from]), [['clear', 'assumption'], ['bill:891', 'books']],
    'the clearance is kept as resting on an assumption; the bill as the books\'');

  /* THE ORDER SAYS WHOSE QUANTITY IT IS. */
  t.check(/4\.21m for the buying plan’s 123 bags/.test(od.opts[1].hint), `the buying plan's quantity, said (${od.opts[1].hint})`);

  /* "NOT KNOWN", NEVER A DASH, for a figure that cannot be read. */
  const CM = compileScope([fn('mgrSimCmpHTML'), fn('mgrSimMoney'), fn('mgrSimSigned'), fn('mgrShortUGX')], { esc: (v) => String(v) }, ['mgrSimCmpHTML']).mgrSimCmpHTML;
  const col = { profit: { mid: 1, d: 0 }, low: null, expLow: null, debtorDays: null, stockDays: null, freed: 0, clearIn: 0, interest: 0, changed: [] };
  const cmp = CM({ base: col, run: col, plan: null, holdsBase: { held: null, of: 3 }, holds: { held: null, of: 3 }, holdsPlan: null });
  t.check(/Debtor days<\/span><span[^>]*>not known<\/span>/.test(cmp) && /Lowest cash<\/span><span[^>]*>not known/.test(cmp)
    && /Holds under shocks<\/span><span[^>]*>not known/.test(cmp), 'the side-by-side reads unknown days, lows and tests as "not known"');
  t.check(/Freed by terms · 60 days, if kept to<\/span><span[^>]*>—</.test(cmp), 'and keeps the dash for none');
  t.check(!/debtorDays == null \? '—'|stockDays == null \? '—'/.test(fn('mgrSimOutHTML')), 'the tiles read unknown debtor and stock days as "not known"');

  /* THE QUOTE LIFT STOPS AT WHAT IS LEFT TO WIN. 137 of 158 won: at most
     21 more, 100 × 21 / 158 = 13.29 points. An owner's +20 reads as that:
     21 more won × 50,000 = 1,050,000 (not 31.6 × 50,000 = 1,580,000). */
  const qL = lv('quote');
  t.check(Math.abs(qL.assume.max - 100 * 21 / 158) < 1e-9 && Math.abs(qL.assume.min + 100 * 137 / 158) < 1e-9 && qL.assume.hi === 10,
    `the quote lift is bounded by what is left to win (${qL.assume.min.toFixed(2)} to ${qL.assume.max.toFixed(2)})`);
  eq(Math.round(S.mgrSimCompose(L, { quote: 'train' }, { quote: { value: 20 } }).profit), 1050000, 'an owner\'s +20 points wins the 21 left, no more');
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
