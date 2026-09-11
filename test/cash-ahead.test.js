#!/usr/bin/env node
'use strict';
/*
 * What cash you'll actually have.
 *
 * The app's whole forward view was one scalar: ninety days of outgoings
 * averaged, divided into the balance, "about two months left". It could
 * not say which DAY was tight, and it counted a stock purchase as if it
 * were the rent.
 *
 * And What to buy was offering the WHOLE cash balance as a budget --
 * the wages due on Friday included. The buy plan was telling the shop
 * to spend the rent.
 *
 * Five laws:
 *
 *   ONLY DATED MONEY GOES ON THE LINE  three things the shop OWES carry
 *       a real forward date: a raised due, a loan instalment, and the
 *       day of the month a rent agreement falls on. There is still no
 *       invoice due date and no supplier terms, so a supplier's bill
 *       has an age and nothing else. Putting it on a calendar would
 *       mean inventing the day, and a forecast built on an invented day
 *       is worse than one that says plainly it does not know.
 *   A DEBTOR'S WORD IS NOT THE SHOP'S MONEY  since 0089 a customer CAN
 *       name a day, and it is written down. It rides a band of its own:
 *       not in commitments, not in committed, not in the floor of the
 *       line, and above all not in safe to spend. The budget the buying
 *       screen offers stays built on what the shop actually holds --
 *       buying stock on the strength of a promise is precisely the
 *       mistake this file exists to prevent.
 *   UNCOSTED IS NOT NOTHING  dueBalance returns null for a month nobody
 *       has counted the days on. Folded in at zero, the line is short
 *       by exactly the wages of the people who did the work. It travels
 *       as unknown and is said out loud.
 *   READ AHEAD, NEVER WRITE  generateDuesForPeriod saves as it goes, so
 *       next month's rent is DERIVED from the agreement rather than
 *       raised. Browsing ahead must not put a liability on the balance
 *       sheet. Wages are not derived at all -- a month is not costed
 *       until somebody counts the days, and this will not guess.
 *   SAFE TO SPEND IS THE FLOOR OF THE LINE  not the cash in hand.
 *       Spending X today lowers every later balance by X, so what can
 *       leave the drawer is what survives every promise already made.
 *
 * Run: node test/cash-ahead.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('what cash you will actually have');
const src = read('index.html');
const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);

const TODAY = '2026-08-29';   // window runs to 2026-09-28

const makeData = () => ({
  staff: [{ id: 10, name: 'Milly' }, { id: 11, name: 'Okello' }, { id: 12, name: 'Sam' }],
  rentAgreements: [{ id: 1, premises: 'Shop front', amount: 400000, dueDay: 5, startMonth: '2026-01', endMonth: null }],
  dues: [
    /* Overdue: still owed, so still a commitment — and it belongs at
       TODAY, because that is when it has to leave. */
    { id: 1, kind: 'rent', refId: '1', period: '2026-08', dueDate: '2026-08-05', amount: 600000, paid: 200000, payments: [] },
    { id: 2, kind: 'wage', refId: '10', period: '2026-08', dueDate: '2026-08-31', amount: 1200000, paid: 0, payments: [] },
    /* Nobody has counted the days. */
    { id: 3, kind: 'wage', refId: '11', period: '2026-08', dueDate: '2026-08-31', amount: null, paid: 0, payments: [] },
    /* Settled: not a commitment at all. */
    { id: 4, kind: 'wage', refId: '12', period: '2026-08', dueDate: '2026-08-31', amount: 300000, paid: 300000, payments: [] },
    /* Beyond the window. */
    { id: 5, kind: 'wage', refId: '10', period: '2026-09', dueDate: '2026-09-30', amount: 1200000, paid: 0, payments: [] },
  ],
  loans: [{ id: 1, lender: 'Centenary', closedOn: null }],
  /* The two collectableDebts returns, so a promise can be attached to a
     real balance rather than to a name. */
  customers: [
    { id: 1, name: 'Milly', debt: 840000, debtLog: [] },
    { id: 2, name: 'Mulongo', debt: 160000, debtLog: [] },
  ],
  paymentPromises: [],
  purchaseInvoices: [], suppliers: [],
});

const env = (data, over) => ({
  data,
  todayISO: () => TODAY,
  anShiftDate: (iso, n) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); },
  daysBetweenISO: (a, b) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000),
  fmtUGX: (n) => Number(n || 0).toLocaleString('en-US'),
  fmtShortDate: (d) => String(d),
  periodLabel: (p) => String(p),
  cashOnHandByAccount: () => ({ total: 5000000, byAccount: [] }),
  /* Its own amortisation is tested where it lives; what matters here is
     that the WHOLE instalment leaves the drawer, not the principal. */
  loanSchedule: () => [
    { date: '2026-08-01', payment: 500000, principal: 400000, interest: 90000, fee: 10000 },
    { date: '2026-09-01', payment: 500000, principal: 400000, interest: 90000, fee: 10000 },
    { date: '2026-10-01', payment: 500000, principal: 400000, interest: 90000, fee: 10000 },
  ],
  collectableDebts: () => [
    { id: 1, name: 'Milly', debt: 840000, ageDays: 62 },
    { id: 2, name: 'Mulongo', debt: 160000, ageDays: 9 },
  ],
  /* The bill BEHIND the balance, not just the balance. The forecast only
     ever needed `due` and `ageDays`; the screen now names a day on an
     undated bill, and a day is a fact about one invoice — so the stub
     carries the invoice, as the real reading always has. Same figures. */
  credOpenInvoices: () => [
    { due: 2100000, ageDays: 47, supplierId: 'S1', invoice: { id: 91, date: '2026-07-13' } },
    { due: 300000, ageDays: 4, supplierId: 'S2', invoice: { id: 92, date: '2026-08-25' } }],
  console, Date, JSON, Math, Number, String, Array, Object, Boolean,
  ...(over || {}),
});

const NAMES = ['cashCommitments', 'cashAhead', 'dueBalance', 'dueName', 'findDue',
  'rentAgreementsFor', 'periodOf', 'periodShift', 'periodEndDate',
  /* Whole, not stubbed, for the same reason the promises are: what the
     line still asks for on a loan and what the loans screen counts as
     paid have to be one allocation, or the shop is told to find the same
     instalment twice. loanSchedule under it stays a stub -- the
     amortisation is tested where it lives. */
  'loanRepayments', 'loanRemainingSchedule',
  /* Whole, not stubbed: the forecast and the chase queue must agree
     about what "waiting" and "broken" mean, or one of them is lying. */
  'promisesFor', 'promiseState', 'promiseLatest', 'promisesBroken'];

const build = (data, extraSrc, names, over) => compileScope(
  NAMES.map((n) => extractFunction(src, n, 'index.html'))
    .concat([extractDeclaration(src, 'CASH_AHEAD_DAYS', 'index.html')])
    .concat(extraSrc || []),
  env(data, over), names || ['cashCommitments', 'cashAhead']);

(async () => {

/* ---------- 1. what goes on the line, and what each is worth --------- */
{
  const c = build(makeData()).cashCommitments(TODAY, 30);
  const by = (label) => c.find((x) => String(x.label).indexOf(label) === 0);

  eq(c.length, 5, 'five dated promises inside the window');

  const rent = by('Shop front');
  eq(rent.date, TODAY,
    'an OVERDUE due sits on today — it is money that has to leave now, not a date in the past nobody can act on');
  eq(rent.dueOn, '2026-08-05', 'while still saying the day it was actually due');
  eq(rent.overdue, true, 'and saying it is late');
  eq(rent.amount, 400000, 'valued at what is still owed on it, not the whole rent');

  const wage = by('Milly');
  eq(wage.kind, 'wage', 'wages are their own kind');
  eq(wage.amount, 1200000, 'at their balance');
  eq(wage.unknown, false, 'costed');

  const uncosted = by('Okello');
  eq(uncosted.unknown, true,
    'a month nobody has counted the days on is UNCOSTED — folded in at zero the line is short by exactly the wages of the people who did the work');
  eq(uncosted.amount, 0, 'so it takes nothing off the line, and the screen says why');

  const loan = c.find((x) => x.kind === 'loan');
  eq(loan.amount, 500000,
    'a loan instalment is the WHOLE payment — principal, interest and fee; the ratio reading sums principal alone and reusing it would let 100,000 leave the drawer unseen');
  eq(loan.date, '2026-09-01', 'on its own date');
  eq(c.filter((x) => x.kind === 'loan').length, 1,
    'and only the one inside the window — a past instalment is the loans screen’s business, the only reading that knows what was repaid');

  const derived = c.find((x) => x.raised === false);
  eq(derived.date, '2026-09-05', 'next month’s rent is on the line, on the day the agreement says');
  eq(derived.amount, 400000, 'at the agreed amount');
  eq(derived.kind, 'rent', 'as rent');
  t.check(c.filter((x) => x.kind === 'rent').length === 2,
    'and does not duplicate the month whose due is already raised');

  t.check(!c.some((x) => String(x.label).indexOf('Sam') === 0),
    'a settled due is not a commitment');
  t.check(!c.some((x) => x.dueOn === '2026-09-30'),
    'and neither is one beyond the window');

  /* THE WRITE THAT MUST NOT HAPPEN. */
  const body = extractFunction(src, 'cashCommitments', 'index.html');
  t.check(!/generateDuesForPeriod\(/.test(body),
    'next month’s rent is DERIVED, never generated — generateDuesForPeriod writes and saves, so reading ahead would quietly raise a liability onto the balance sheet');
  t.check(!/wage[^]{0,200}rentAgreementsFor|rentAgreementsFor[^]{0,400}kind: 'wage'/.test(body),
    'and wages for an unraised month are not derived at all: a month is not costed until somebody counts the days');
}

/* ---------- 1b. an instalment already paid is not still to pay ------- */
/* The line quoted every instalment at its face, whatever had been handed
   over. So the morning the owner paid this week's repayment the screen
   went on asking for it: the one view whose job is what is STILL to go,
   telling them to find the same money twice on the day they had just
   done the right thing. Every other promise here is valued at its
   balance -- dueBalance takes off what was paid, an open bill carries
   what is still due -- and the loan was the one thing that was not. */
{
  const withRepayments = (rp) => Object.assign(makeData(), {
    loans: [{ id: 1, lender: 'Centenary', closedOn: null, repayments: rp }],
  });
  const loansOn = (data) => build(data).cashCommitments(TODAY, 30).filter((x) => x.kind === 'loan');

  /* Nothing paid: exactly as before. The stubbed schedule asks 500,000 on
     1 August, 1 September and 1 October; only September is in the window. */
  eq(loansOn(withRepayments([])).length, 1, 'with nothing repaid the instalment inside the window stands');
  eq(loansOn(withRepayments([]))[0].amount, 500000, 'at the whole of it');

  /* OLDEST FIRST, the way loanDuePosition counts arrears and the way a
     lender credits money. 500,000 handed over covers AUGUST, which is
     already behind — it does not strike September off. A shop that pays
     one instalment while a week in arrears has caught up on the old one,
     not paid the new one, and a line that said otherwise would let it
     spend money the lender is about to ask for. */
  const caughtUp = loansOn(withRepayments([{ date: '2026-08-20', amount: 500000 }]));
  eq(caughtUp.length, 1, 'a payment that only catches up on a missed instalment leaves the next one on the line');
  eq(caughtUp[0].amount, 500000, 'at its full face');

  /* Both covered: September has been paid, so it is not money that is
     going to leave the drawer again and it drops off the line. */
  eq(loansOn(withRepayments([
    { date: '2026-08-20', amount: 500000 },
    { date: TODAY, amount: 500000 },
  ])).length, 0, 'an instalment actually paid is off the line — it is not leaving the drawer twice');

  /* PART PAID IS NEITHER. The remainder stays, not the whole of it and
     not nothing, and the row says which it is. */
  const part = loansOn(withRepayments([
    { date: '2026-08-20', amount: 500000 },
    { date: TODAY, amount: 300000 },
  ]));
  eq(part.length, 1, 'a part payment leaves the rest of the instalment on the line');
  eq(part[0].amount, 200000, 'at the REMAINDER — the whole of it would ask twice, nothing at all would flatter the drawer');
  eq(part[0].partPaid, true, 'and says so, because a figure smaller than the agreement needs a reason on its face');

  /* And the floor of the line moves with it, which is the whole point:
     safe to spend was 2,500,000 with the instalment on it. */
  const paid = build(withRepayments([
    { date: '2026-08-20', amount: 500000 },
    { date: TODAY, amount: 500000 },
  ])).cashAhead(TODAY, 30);
  eq(paid.committed, 2000000, 'what falls due drops by the instalment already settled');
  eq(paid.safeToSpend, 3000000, 'and safe to spend rises by exactly it');

  /* WHAT IS OWED IS NOT WHAT IS STILL TO BE HANDED OVER. loanApplied
     splits a payment fee-interest-principal to answer what the lender is
     owed; this answers what leaves the drawer, and the whole instalment
     leaves it. Reusing the balance here would put interest on the line
     twice over. */
  const body = extractFunction(src, 'loanRemainingSchedule', 'index.html');
  t.check(/r\.payment/.test(body) && !/loanApplied\(/.test(body),
    'the remainder is worked off the whole instalment, never off the outstanding balance');
}

/* ---------- 2. the line, and its floor -------------------------------- */
{
  const a = build(makeData()).cashAhead(TODAY, 30);

  eq(a.onHand, 5000000, 'the line opens on the cash actually in hand');
  eq(a.committed, 2500000, 'against everything dated inside the window');
  eq(a.commitments[0].balanceAfter, 4600000, 'and each promise says what it leaves');
  eq(a.commitments[1].balanceAfter, 3400000, 'in order');
  eq(a.commitments[a.commitments.length - 1].balanceAfter, 2500000, 'down to the last');

  eq(a.safeToSpend, 2500000,
    'SAFE TO SPEND IS THE FLOOR, not the 5,000,000 in hand — spending today lowers every later balance by the same amount');
  eq(a.tightest.date, '2026-09-05', 'and the tightest day has a name');
  eq(a.tightest.balance, 2500000, 'and a figure');
  eq(a.unknown, 1, 'with the uncosted one counted, so the line can admit it is generous');

  eq(a.commitments[0].inDays, 0, 'an overdue promise is today, not a negative number of days');
  eq(a.commitments[3].inDays, 3, 'and a future one says how far off it is');

  /* Nothing promised. */
  const bare = build(Object.assign(makeData(), { dues: [], loans: [], rentAgreements: [] })).cashAhead(TODAY, 30);
  eq(bare.commitments.length, 0, 'a shop with nothing dated has an empty line');
  eq(bare.safeToSpend, 5000000, 'and every shilling is spendable');
  eq(bare.tightest.balance, 5000000, 'the tightest day being today itself');
}

/* ---------- 3. when the promises come to more than the drawer -------- */
{
  const a = build(makeData(), [], null, { cashOnHandByAccount: () => ({ total: 1000000, byAccount: [] }) }).cashAhead(TODAY, 30);
  eq(a.tightest.balance, -1500000, 'the line goes below nothing, and says so');
  eq(a.tightest.date, '2026-09-05', 'on the day it happens');
  eq(a.safeToSpend, 0,
    'and safe to spend is nought — never a negative budget, which the buying screen would read as "spend nothing" only by accident');
}

/* ---------- 4. wages nobody has raised ------------------------------- */
{
  const d = makeData();
  d.dues = d.dues.filter((x) => x.kind !== 'wage' || x.period !== '2026-08');
  const a = build(d).cashAhead(TODAY, 30);
  eq(a.wagesNotRaised.length, 1, 'a month inside the window with staff and no wages raised is NAMED');
  eq(a.wagesNotRaised[0], '2026-08', 'by its period');
  t.check(!a.commitments.some((x) => x.kind === 'wage'),
    'and no figure is invented for it — the line is silent rather than wrong');

  const none = build(Object.assign(makeData(), { staff: [] })).cashAhead(TODAY, 30);
  eq(none.wagesNotRaised.length, 0, 'a shop with no staff is not nagged about wages it does not pay');
}

/* ---------- 5. money with no date ------------------------------------ */
{
  const a = build(makeData()).cashAhead(TODAY, 30);
  eq(a.owedToYou.total, 1000000, 'what customers owe is carried');
  eq(a.owedToYou.count, 2, 'with how many of them');
  eq(a.owedToYou.oldestDays, 62, 'and the oldest age, which is all anybody recorded');
  eq(a.owedByYou.total, 2400000, 'and what the shop owes suppliers');
  eq(a.owedByYou.oldestDays, 47, 'the same way');

  t.check(!a.commitments.some((x) => x.kind === 'debt' || x.kind === 'bill'),
    'NEITHER IS ON THE LINE — nothing in this app records when a customer will pay or when a supplier expects to be paid, so a date for them could only be invented');
  eq(a.committed, 2500000, 'and neither is in what is committed');
}

/* ---------- 5b. what they SAID they would pay ------------------------ *
 * The dangerous part of this feature is not the storage. safeToSpend
 * sets the shop's buying budget, and a promised inflow raising it would
 * mean buying stock on the strength of a debtor's word.
 */
{
  const d = makeData();
  d.paymentPromises = [{ id: 1, customerId: 1, promisedOn: '2026-09-10', madeOn: '2026-08-29', amount: null }];
  const a = build(d).cashAhead(TODAY, 30);

  eq(a.promised.length, 1, 'a customer who named a day is carried as a dated inflow');
  eq(a.promised[0].date, '2026-09-10', 'on the day they said');
  eq(a.promised[0].amount, 840000, 'at their balance, no figure having been named');
  eq(a.promised[0].whole, true, 'and knowing that is what it is');
  eq(a.promised[0].inDays, 12, 'with how far off it is');
  eq(a.promisedTotal, 840000, 'totalled');

  /* THE LAW OF THIS BUILD, in four assertions. */
  eq(a.safeToSpend, 2500000,
    'NOT ONE SHILLING of it reaches safe to spend — the buying budget stays built on what the shop actually holds');
  eq(a.committed, 2500000, 'nor what is committed');
  eq(a.tightest.balance, 2500000, 'nor the floor of the line');
  eq(a.commitments.length, 5, 'and it is not on the line at all — the same five dated promises, unchanged');

  /* COUNTED ONCE. On the band AND in the pool is the same money said
     twice, and the second saying is the one somebody spends. */
  eq(a.owedToYou.count, 1, 'a promised debtor leaves the undated pool');
  eq(a.owedToYou.total, 160000, 'which leaves exactly the rest of it');

  const late = makeData();
  late.paymentPromises = [{ id: 1, customerId: 1, promisedOn: '2026-08-20', madeOn: '2026-08-15', amount: null }];
  const b = build(late).cashAhead(TODAY, 30);
  eq(b.promised.length, 0,
    'a BROKEN promise is not a forecast — a day that has gone is a chase, not money coming');
  eq(b.owedToYou.count, 2, 'and the money goes back to being counted with no date on it');

  const far = makeData();
  far.paymentPromises = [{ id: 1, customerId: 1, promisedOn: '2026-11-01', madeOn: '2026-08-29', amount: null }];
  const c = build(far).cashAhead(TODAY, 30);
  eq(c.promised.length, 0, 'a day beyond the window is not in the window');
  eq(c.owedToYou.count, 2, 'and stays in the pool, where it can still be seen');

  const part = makeData();
  part.paymentPromises = [{ id: 1, customerId: 1, promisedOn: '2026-09-10', madeOn: '2026-08-29', amount: 400000 }];
  const e = build(part).cashAhead(TODAY, 30);
  eq(e.promised[0].amount, 400000, 'a part payment is carried at what they said, not at the whole balance');
  eq(e.promised[0].whole, false, 'and says which of the two it is');

  /* A LEDGER, NOT A STAMP. */
  const twice = makeData();
  twice.paymentPromises = [
    { id: 1, customerId: 1, promisedOn: '2026-08-15', madeOn: '2026-08-10', amount: null },
    { id: 2, customerId: 1, promisedOn: '2026-09-10', madeOn: '2026-08-20', amount: null },
  ];
  const g = build(twice).cashAhead(TODAY, 30);
  eq(g.promised.length, 1, 'the latest promise is the one on the band');
  eq(g.promised[0].date, '2026-09-10', 'and it is the later one, not the first they made');
  eq(g.promised[0].brokenBefore, 1,
    'carrying how many they have already broken — a second promise from somebody who broke the first is a different fact, and overwriting the row would have lost it');
}

/* ---------- 6. the screen -------------------------------------------- */
{
  const el = { innerHTML: '', querySelector: () => null, querySelectorAll: () => [] };
  /* THE SCREEN IS THREE FUNCTIONS NOW, not one. renderAhead draws the
     strip, the ledger and the rail; aheadRunwaySVG draws the line the
     ledger is a reading of; cashAheadDays says how far it runs. They are
     compiled together because they are one screen -- every assertion
     below is the one that was here before it was redrawn. */
  const AHEAD = ['cashAheadDays', 'aheadRunwaySVG', 'renderAhead'];
  const aheadStubs = {
    document: { getElementById: (id) => (id === 'ah_body' ? el : null) },
    esc: (x) => String(x == null ? '' : x),
    listPageSlice: (id, rows) => rows, listMoreButtonHTML: () => '',
    daysBetweenISO: (from, to) => Math.round(
      (Date.parse(to + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z')) / 86400000),
    debtsCovering: (amt, rows) => ({ rows: rows || [], covered: 0, enough: false }),
    collectableDebts: () => [],
    supplierName: () => 'Supplier',
    purchaseInvoiceNumberLabel: (pi) => 'PINV-' + String(pi.id),
    agingDaysLabel: (n) => n + ' days',
    /* Which bill is having a day named on it. Module state on the real
       screen; nothing is open when it is drawn cold. */
    aheadDayEditId: null,
  };
  const draw = (over, d) => { build(d || makeData(), AHEAD.map((n) => extractFunction(src, n, 'index.html')), AHEAD, Object.assign({}, aheadStubs, over || {})).renderAhead(); return el.innerHTML; };

  const html = draw();
  /* THE STRIP OPENS ON SAFE TO SPEND, not on cash in hand. It is the
     lowest point the line reaches, it is what the buying plan budgets
     from, and it is the only figure here that answers "can I commit
     money today". Cash in hand is the figure that MISLEADS -- some of it
     is already spent -- so it comes second, and the leading tile says
     what it is measured against. Both figures are still on the strip;
     what changed is which one a reader meets first. */
  t.check(/Safe to spend/.test(html) && html.indexOf('Safe to spend') < html.indexOf('In hand today'),
    'the strip opens on what is safe to spend, ahead of the cash in hand');
  t.check(/In hand today/.test(html) && html.includes('5,000,000'), 'and carries the cash in hand');
  t.check(/Falls due in 30 days/.test(html) && html.includes('2,500,000'), 'against what is promised');
  t.check(/safe to spend/.test(html), 'and names what is safe to spend');
  t.check(/tightest day/.test(html) && /2026-09-05/.test(html), 'and the day it is tightest');
  t.check(/leaves 4,600,000/.test(html) && /leaves 2,500,000/.test(html),
    'every promise says what it leaves behind, which is the whole point of a line');
  t.check(/overdue/.test(html), 'a late one says so');
  t.check(/not costed yet/.test(html), 'an uncosted one shows no figure at all rather than a nought');
  t.check(/1 of these is not costed yet/.test(html),
    'and is counted underneath, so the line can admit it is generous by whatever it turns out to be');
  t.check(/not raised yet/.test(html), 'a rent derived from the agreement says it has not been raised');
  t.check(/Money with no date on it/.test(html) && /the oldest <b[^>]*>47<\/b> days old/.test(html),
    'what has no date sits beside the line with its age');
  t.check(/because nobody has named a day for it/.test(html),
    'and says WHY it is not on the line — nobody has said when');
  t.check(/They promised/.test(html) && /Chase debts/.test(html),
    'pointing at where a day IS written down, now that there is somewhere');
  t.check(!/said they would pay/.test(html) && !/ow-ah-ghost/.test(html),
    'while a shop nobody has promised anything gets no promise row and no second line, rather than an empty heading');
  t.check(!/short of/.test(html), 'a shop that can cover its promises is not told it is short');

  const pd = makeData();
  pd.paymentPromises = [{ id: 1, customerId: 1, promisedOn: '2026-09-10', madeOn: '2026-08-29', amount: null }];
  const band = draw(null, pd);
  /* A PROMISE SITS IN THE LEDGER, in date order, rather than in a band
     of its own below it. The line above draws commitments and promises
     as one sequence, and a reader cannot check a picture against two
     separate lists. What must still hold -- and does, on the row itself
     -- is that it never dresses itself up as money in the drawer. */
  t.check(/said they would pay/.test(band), 'a promise appears on the ledger, in date order with what falls due');
  t.check(/Promised to you, if kept/.test(band) && /840,000/.test(band) && /2026-09-10/.test(band),
    'saying what it comes to and by when');
  t.check(/Not counted in what is safe to spend/.test(band),
    'and saying so out loud — the one sentence standing between a promise and the buy plan spending it');
  t.check(/the whole balance/.test(band), 'a promise with no figure named is the whole balance');
  t.check(/their word, not cash/.test(band), 'and the row never dresses itself up as money in the drawer');

  /* A BARE border-bottom-style IS NOT A BORDER. `.ah-row:last-child{
     border-bottom:none}` resets the WIDTH to medium and the colour to
     currentColor; setting only the style back re-lit both, and the last
     promised row drew a 3px near-black dashed rule across the screen. */
  const css = (/\.ow-ah-lr\.ow-ah-said\{([^}]*)\}/.exec(src) || ['', ''])[1];
  t.check(/border-bottom:\s*[\d.]+px\s+dashed\s+var\(/.test(css),
    `the promised row states its whole border — width, style and colour (${css})`);
  t.check(/\.ow-ah-lr\.ow-ah-said:last-child\{[^}]*border-bottom:\s*none/.test(src),
    'and re-asserts the last-child reset it would otherwise have overridden');
  t.check(/safe to spend/.test(band) && /2,500,000/.test(band),
    'the figure itself being untouched by any of it');

  const tight = draw({ cashOnHandByAccount: () => ({ total: 1000000, byAccount: [] }) });
  /* The red-railed paragraph is gone: the line itself goes into a
     crimson field and the strip says it in the tile a reader is already
     looking at. The two facts it carried -- that you cannot cover what
     you have promised, and by how much -- are both still stated. */
  t.check(/goes under on/.test(tight) && /nothing you can safely commit today/.test(tight),
    'a shop that cannot is told plainly');
  t.check(/Short <b>1,500,000<\/b> by then/.test(tight), 'by how much');
  t.check(/Chase debts/.test(tight), 'and pointed at the thing that closes it');
  t.check(/ow-ah-neg/.test(tight), 'and the line is drawn going into the ground below nothing');

  const empty = build(Object.assign(makeData(), { dues: [], loans: [], rentAgreements: [] }),
    AHEAD.map((n) => extractFunction(src, n, 'index.html')), AHEAD, Object.assign({}, aheadStubs));
  empty.renderAhead();
  t.check(/Nothing falls due in the next 30 days/.test(el.innerHTML), 'a clear window says so');
  t.check(/not the same as nothing being owed/.test(el.innerHTML),
    'and refuses to let that read as owing nothing — the undated pools are still there');
}

/* ---------- 7. the buy plan stops offering the rent ------------------- */
const buyAsked = [];
const budgetBox = { value: 'untouched' };
const drawBuy = (over) => {
  const el = { innerHTML: '', querySelector: () => null, querySelectorAll: () => [] };
  buyAsked.length = 0;
  budgetBox.value = 'untouched';
  compileScope([extractFunction(src, 'renderPurchasePlanPanel', 'index.html')], Object.assign({
    document: { getElementById: (id) => (id === 'buy_plan' ? el : id === 'buy_budget' ? budgetBox : null) },
    esc: (x) => String(x == null ? '' : x),
    fmtUGX: (n) => Number(n || 0).toLocaleString('en-US'),
    fmtShortDate: (d) => String(d),
    todayISO: () => TODAY,
    CASH_AHEAD_DAYS: 30,
    cashOnHandByAccount: () => ({ total: 5000000, byAccount: [] }),
    cashAhead: () => ({ days: 30, committed: 2500000, safeToSpend: 2500000, unknown: 0,
      commitments: [{ dueOn: '2026-08-31', date: '2026-08-31', overdue: false, label: 'Milly', amount: 1200000 }],
      tightest: { date: '2026-09-05', balance: 2500000 } }),
    buyBudget: null, buyPlanLast: null, buyOrderBasket: new Set(),
    buyHoldsSweep: () => {},
    /* This file is about the BUDGET the panel is handed, so orders are
       stubbed away here: what an order does to that budget belongs to
       buy-orders.test.js, which owns the claim. */
    buyOrdersSweep: () => {}, buyOrdersOpenRows: () => [],
    /* What collecting would pay for is its own reading, and
       collect-to-buy.test.js owns that claim. Stubbed away here so
       two files cannot half-own it. */
    collectToBuy: () => null, collectToBuyHTML: () => '',
    purchasePlan: (budget) => { buyAsked.push(budget); return { budget, budgetBefore: budget, onOrder: 0, coverDays: 14, lines: [], spend: 0, didNotFit: [], sourceFirst: [], coming: [] }; },
    listPageSlice: (id, rows) => rows, listMoreButtonHTML: () => '',
    /* The row's own rendering is tested where it lives; here it only has
       to draw without throwing, so the strip above it can be read. */
    buyLineFacts: () => '', buyLineWhy: () => '', buyLineWhen: () => '',
    buyHoldFor: () => null, buyHoldLabel: () => '', agingDaysLabel: (n) => `${n} days`,
    Math, Number, String, Array, Object, Boolean, JSON,
  }, over || {}), ['renderPurchasePlanPanel']).renderPurchasePlanPanel();
  return el.innerHTML;
};
{
  const asked = buyAsked;
  const el = { innerHTML: drawBuy() };

  eq(asked[0], 2500000,
    'the plan is budgeted on what is SAFE, not the 5,000,000 in hand — the rent and the wages were in that figure until the day they leave, and offering it was the plan telling the shop to spend money it had already promised');
  t.check(/Budget is 2,500,000, not the 5,000,000 in hand/.test(el.innerHTML),
    'and the screen says which figure it used');
  t.check(/2,500,000 is already promised in the next 30 days/.test(el.innerHTML),
    'and what it held back');
  t.check(/2026-08-31/.test(el.innerHTML), 'naming when the first of it goes');
  /* "above": the budget field moved from a form beside the note into the
     page header, and the note now sits in the rail under it. */
  t.check(/type a budget above to overrule it/.test(el.innerHTML),
    'while leaving the decision the owner’s');

  /* The Manager and the tool ask for the same figure. */
  t.check(/purchasePlan\(cashAhead\(today, CASH_AHEAD_DAYS\)\.safeToSpend, null, today\)/.test(src),
    'the Manager’s pulse budgets on the same figure, so the screen and the mind cannot disagree');
  t.check(/input\.budget != null \? Number\(input\.budget\) : cashAhead\(todayISO\(\), CASH_AHEAD_DAYS\)\.safeToSpend/.test(src),
    'and so does the spoken buy plan');
}

/* ---------- 7b. the shop that is over-committed ---------------------- *
 * The live shop that prompted this: 2,608,644 in the drawer against
 * 3,471,156 promised, so the line dips below nothing and safeToSpend
 * floors at 0. Nothing had ever walked the buying screen down that path,
 * and it broke in three places at once — each of them a thing the screen
 * SAYS rather than a figure it computes, which is why the arithmetic
 * cross-check passed while the screen misled.
 */
{
  /* A DATE IN THE PAST IS NOT THE NEXT THING DUE. cashCommitments clamps
     an overdue payment's `date` to today so it heads the line, keeping
     the day it was really due in `dueOn` behind it — and reading that off
     row 0 printed "already promised in the next 30 days, the first on 31
     Jul 2026" onto a screen dated 29 August. */
  const overdue = drawBuy({
    cashAhead: () => ({ days: 30, committed: 2500000, safeToSpend: 2500000, unknown: 0,
      commitments: [
        { dueOn: '2026-07-31', date: TODAY, overdue: true, label: 'Edrine', amount: 21098 },
        { dueOn: '2026-08-31', date: '2026-08-31', overdue: false, label: 'Milly', amount: 1200000 },
      ],
      tightest: { date: '2026-09-05', balance: 2500000 } }),
  });
  t.check(!/2026-07-31/.test(overdue),
    'a day already gone is never named as something falling due in the next 30 — the sentence would be arguing with itself');
  t.check(/1 of them already overdue/.test(overdue),
    'it is named as what it is: money that is late, which is the more urgent half of the fact');
  t.check(/the next on 2026-08-31/.test(overdue),
    'and the next day something actually falls is found among the rows still ahead');

  const clean = drawBuy();
  t.check(/the first on 2026-08-31/.test(clean) && !/already overdue/.test(clean),
    'while a shop with nothing late still reads "the first on", and is not told about overdue payments it does not have');

  /* SILENCE IS NOT EVIDENCE. With nothing safe to spend, every candidate
     goes to didNotFit and `lines` is empty — so a run-out count taken
     over `lines` reported that nothing had run out on the exact morning
     the shelves were emptiest and there was no money to fill them. */
  const broke = (plan) => drawBuy({
    cashAhead: () => ({ days: 30, committed: 3471156, safeToSpend: 0, unknown: 0,
      commitments: [{ dueOn: '2026-08-31', date: '2026-08-31', overdue: false, label: 'Milly', amount: 1200000 }],
      tightest: { date: '2026-09-25', balance: -862512 } }),
    purchasePlan: (budget) => { buyAsked.push(budget); return Object.assign({ budget, budgetBefore: budget, onOrder: 0, coverDays: 14, lines: [], spend: 0, didNotFit: [], sourceFirst: [], coming: [] }, plan || {}); },
  });

  const emptyPlan = broke({ didNotFit: [{ kind: 'shelf', daysLeft: 0, name: 'ABC Black Screws', cost: 210000, qty: 20,
    reason: 'Out now', supplier: 'ABC', unitCost: 10500, unit: 'Box', units30: 1, earned30: 116000, kept: 4 }] });
  t.check(/have run out|has run out/.test(emptyPlan),
    'a line that has run out is COUNTED even when the shop cannot afford it — being broke is a reason to say it louder, not to fall silent');
  eq(buyAsked[0], 0, 'the plan is still budgeted on nought rather than on the cash in hand');

  /* WHY THE PLAN IS EMPTY. Three noughts over a list headed "Over this
     budget" states a conclusion and withholds its reason — and the reason
     is not "nothing needs buying". */
  t.check(/There is nothing safe to spend, so the plan is empty/.test(emptyPlan),
    'and the screen says WHY it is empty, rather than leaving three noughts to be read as "nothing needed"');
  t.check(/Chase debts/.test(emptyPlan), 'pointing at the thing that changes it');
  /* And at the reading that does the arithmetic that sentence used to
     stand in for. "Collecting is what makes it affordable" names a
     lever and no hand to pull it; the section underneath names who,
     how much, and which lines their money would buy. */
  t.check(/What collecting would pay for/.test(emptyPlan),
    'and at the section that works out WHICH of them, and what their money would actually buy');
  t.check(!/There is nothing safe to spend/.test(clean),
    'while a shop with a budget is not told it has none');

  /* A BLANK BOX MEANS "NO LIMIT". Zero is falsy, so `budget || ''`
     emptied the field on the one render where the answer is "nothing" —
     showing the state the change handler reads back as null. */
  broke();
  eq(budgetBox.value, 0,
    'a computed budget of nought is WRITTEN into the box — an empty box is the state meaning "no override", which is the opposite of what is true here');
  drawBuy();
  eq(budgetBox.value, 2500000, 'and a real budget still fills it');
}

/* ---------- 7c. the same trap, one screen over ----------------------- *
 * dashboardContext exposes `ahead.next` built exactly the way the buy
 * screen's sentence was. Nothing renders it yet, which is precisely why
 * it is worth pinning: it is a loaded gun for whoever writes the first
 * renderer, and by then the fault will look like theirs.
 */
{
  const ctxSrc = extractFunction(src, 'dashboardContext', 'index.html');
  const nextBlock = (/next: a\.commitments\[0\][\s\S]{0,320}?\)/.exec(ctxSrc) || [''])[0];
  t.check(/on: a\.commitments\[0\]\.date/.test(nextBlock),
    '`on` is the day the money must LEAVE — for an overdue payment that is today, never the day behind them it was due');
  t.check(/overdue: !!a\.commitments\[0\]\.overdue/.test(nextBlock),
    'and the row says whether it is late, so a reader cannot print a past date as upcoming without choosing to');
  t.check(!/on: a\.commitments\[0\]\.dueOn/.test(nextBlock),
    'the field that caused this on the buying screen is not the one keyed as "next"');
}

/* ---------- 8. one reading, two readers ------------------------------ */
{
  const alerts = compileScope([
    extractFunction(src, 'dashAlerts', 'index.html'),
    extractFunction(src, 'dashBandFor', 'index.html'),
    extractDeclaration(src, 'DASH_URGENT_DAYS', 'index.html'),
    extractDeclaration(src, 'DASH_SOON_DAYS', 'index.html'),
    extractDeclaration(src, 'DASH_BAND_RANK', 'index.html'),
  ], {
    fmtUGX: (n) => Number(n || 0).toLocaleString('en-US'),
    fmtShortDate: (d) => String(d),
    todayISO: () => TODAY,
    /* This block is about the cash line reaching the alerts. Whether a
       late supplier order becomes an alert is dashboard-alerts.test.js's
       claim, and it is stubbed empty here so the two files cannot both
       half-own it. */
    buyOrdersOpenRows: () => [],
    daysBetweenISO: (a, b) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000),
    daysSinceDate: () => 0, anShiftDate: (iso) => iso,
    data: { customers: [], suppliers: [], savedQuotes: [], products: [] },
    Math, Number, String, Array, Object, Boolean, JSON, Date,
  }, ['dashAlerts']).dashAlerts;

  const CTX = (over) => Object.assign({
    itemRows: [], totals: { sales: 0, cost: 0 }, opex: 0, grossProfit: 0, netProfit: 0,
    cashBalance: 1000000, burn: 0, runwayMonths: null,
    inv: { deadValue: 0, deadQty: 0, ratio: 100 },
    ahead: { days: 30, committed: 0, safeToSpend: 1000000, tightestOn: TODAY, tightestBalance: 1000000, notCosted: 0, next: null },
    debtors: [], goingQuiet: [], concentration: [], stockOut: [], inflation: [],
  }, over || {});

  const quiet = alerts(CTX()).filter((a) => a.id === 'cash:promised');
  eq(quiet.length, 0, 'a shop that covers its promises gets no alert about them');

  const loud = alerts(CTX({ ahead: { days: 30, committed: 2500000, safeToSpend: 0,
    tightestOn: '2026-09-05', tightestBalance: -1500000, notCosted: 0, next: null } }))
    .filter((a) => a.id === 'cash:promised');
  eq(loud.length, 1, 'a shop that does not is told');
  eq(loud[0].money, 1500000,
    'and the money is the SHORTFALL, never the balance — carrying the balance would sort a healthy shop to the top of every list by sheer size');
  eq(loud[0].dueDays, 7, 'dated by how far off the day is, so it sorts by when rather than by size');
  eq(loud[0].band, 'now', 'landing in the right band on its own');
  t.check(/2026-09-05/.test(loud[0].detail), 'with the day named');

  const contextSrc = extractFunction(src, 'dashboardContext', 'index.html');
  t.check(/ahead:/.test(contextSrc) && /cashAhead\(todayISO\(\), CASH_AHEAD_DAYS\)/.test(contextSrc),
    'and it reaches the dashboard AND the Manager through the one context, which is why that function exists');

  /* And the Manager is handed it, not just the balance. */
  const pulse = src.slice(src.indexOf("shop_pulse: { confirm: false"), src.indexOf("shop_pulse: { confirm: false") + 3000);
  t.check(/cash\.promised_in_30_days/.test(pulse) && /cash\.safe_to_spend/.test(pulse),
    'shop_pulse hands the Manager what is promised as well as what is held — the balance alone reads as money to act on, and arguing to spend it is arguing to spend the rent');
  t.check(/if\(ahead\.tightest\.balance < 0\) cash\.short_by/.test(pulse),
    'and the shortfall only where there is one');
  t.check(/safe_to_spend when the question is what can be bought/.test(read('api/assistant.js')),
    'with the mind told which figure answers "what can I buy"');

  /* Nothing projected may reach the books. */
  const ahead = extractFunction(src, 'cashAhead', 'index.html') + extractFunction(src, 'cashCommitments', 'index.html');
  t.check(!/cashTxns\.push|saveData\(\)/.test(ahead),
    'and NOTHING is written: three separate guards keep the cash book historical, and every statement in the app rests on that');
}

})().then(() => { process.exit(t.done() ? 1 : 0); })
  .catch((e) => { console.error(e); process.exit(1); });
