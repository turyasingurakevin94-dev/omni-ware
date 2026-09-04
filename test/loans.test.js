#!/usr/bin/env node
'use strict';
/*
 * Money the shop has borrowed.
 *
 * Phase 3. A loan used to be a cash-book receipt categorised "Loan
 * Received" and nothing else: an inflow that looked like income, no
 * liability, and no record that any of it had to go back. Phase 1 stopped
 * it counting as revenue. This is where it becomes something the shop
 * owes, with what it really costs and whether the repayments are keeping
 * up.
 *
 * TWO KINDS, because both are ordinary here and they are not the same
 * loan at the same rate:
 *
 *   reducing_balance  interest each month on what is still owed.
 *   flat              interest for the whole term computed once on the
 *                     ORIGINAL principal, then split evenly. "24% flat"
 *                     over a year costs about 41.7%, because you go on
 *                     paying interest on money you have already given
 *                     back. That gap is the single most useful thing this
 *                     screen can tell a shopkeeper, so it is computed
 *                     rather than repeating the number on the paperwork.
 *
 * The agreed schedule and what actually happened are deliberately
 * separate. Comparing them is the whole of loanPerformance, and the
 * property that ties the two engines together is below: paying exactly
 * the agreed instalments must reproduce the agreed balance, to the
 * shilling.
 *
 * Run: node test/loans.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('loans');
const src = read('index.html');
const data = { loans: [] };

const scope = compileScope([
  extractFunction(src, 'monthsBetween', 'index.html'),
  extractFunction(src, 'loanInstallments', 'index.html'),
  extractFunction(src, 'loanPrincipal', 'index.html'),
  extractFunction(src, 'loanScheduledPayment', 'index.html'),
  extractFunction(src, 'loanSchedule', 'index.html'),
  extractFunction(src, 'loanTotalInterest', 'index.html'),
  extractFunction(src, 'loanEffectiveRate', 'index.html'),
  extractFunction(src, 'loanRepayments', 'index.html'),
  extractFunction(src, 'loanApplied', 'index.html'),
  extractFunction(src, 'loanOutstanding', 'index.html'),
  extractDeclaration(src, 'LOAN_FREQUENCIES', 'index.html'),
  extractFunction(src, 'loanFrequency', 'index.html'),
  extractFunction(src, 'loanPeriodsPerYear', 'index.html'),
  extractFunction(src, 'loanInstallments', 'index.html'),
  extractFunction(src, 'loanPeriodRate', 'index.html'),
  extractFunction(src, 'loanFeePerInstallment', 'index.html'),
  extractFunction(src, 'loanDueDate', 'index.html'),
  extractFunction(src, 'loanPeriodsBetween', 'index.html'),
  extractFunction(src, 'loanLevelPI', 'index.html'),
  extractFunction(src, 'loanTotalFees', 'index.html'),
  extractFunction(src, 'loanFees', 'index.html'),
  extractFunction(src, 'loanNetAdvanced', 'index.html'),
  extractFunction(src, 'loanTrueCostRate', 'index.html'),
  extractFunction(src, 'loanMethodLabel', 'index.html'),
  extractFunction(src, 'loanRoundTo', 'index.html'),
  extractFunction(src, 'loanRound', 'index.html'),
  extractFunction(src, 'loanRateFor', 'index.html'),
  extractFunction(src, 'dayBeforeISO', 'index.html'),
  extractFunction(src, 'loanInterestPaidBetween', 'index.html'),
  extractFunction(src, 'liveLoans', 'index.html'),
  extractFunction(src, 'loansOutstandingAt', 'index.html'),
  extractFunction(src, 'loanInterestForPeriod', 'index.html'),
  extractFunction(src, 'loanPerformance', 'index.html'),
], { data, todayISO: () => '2026-08-04' },
['loanScheduledPayment', 'loanSchedule', 'loanTotalInterest', 'loanEffectiveRate',
  'loanApplied', 'loanOutstanding', 'loanInterestPaidBetween', 'loansOutstandingAt',
  'loanInterestForPeriod', 'loanPerformance', 'dayBeforeISO', 'loanMethodLabel',
  'loanTotalFees', 'loanFrequency', 'loanScheduledPayment', 'loanTrueCostRate', 'loanApplied']);

const r = (n) => Math.round(n);
const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);
const loan = (over) => Object.assign({
  id: 1, lender: 'Centenary Bank', principal: 10000000, ratePct: 24,
  method: 'reducing_balance', termMonths: 12, startedOn: '2026-01-01', repayments: [],
}, over);
const pay = (m, amount) => ({ date: `2026-${String(m).padStart(2, '0')}-01`, amount });

/* ---------- 1. reducing balance is the textbook loan ------------------ */
{
  const l = loan();
  // P*r/(1-(1+r)^-n) with r = 24%/12 = 2%, n = 12.
  const textbook = 10000000 * 0.02 / (1 - Math.pow(1.02, -12));
  t.check(r(scope.loanScheduledPayment(l)) === r(textbook),
    `the instalment is the standard annuity (got ${r(scope.loanScheduledPayment(l))}, expected ${r(textbook)})`);

  const s = scope.loanSchedule(l);
  t.check(s.length === 12, 'one row per month of the term');
  t.check(r(s[0].interest) === 200000, "the first month's interest is 2% of the whole balance");
  t.check(s[11].interest < s[0].interest, 'and each month charges less, as the balance falls');
  t.check(r(s[s.length - 1].closing) === 0, 'the last instalment clears it exactly, leaving no rounding behind');
  t.check(s[0].month === '2026-02', 'the first payment falls the month after it was taken');

  t.check(Math.abs(scope.loanEffectiveRate(l) - 24) < 0.05,
    `a reducing-balance loan really does cost its stated rate (got ${scope.loanEffectiveRate(l).toFixed(2)}%)`);

  // A rate of zero must not divide by zero.
  const free = loan({ ratePct: 0 });
  t.check(r(scope.loanScheduledPayment(free)) === r(10000000 / 12), 'an interest-free loan just repays the principal');
  t.check(r(scope.loanTotalInterest(free)) === 0, 'and costs nothing');
}

/* ---------- 2. flat rate is not the rate on the paperwork ------------- */
{
  const l = loan({ method: 'flat' });
  t.check(r(scope.loanScheduledPayment(l)) === r((10000000 + 10000000 * 0.24) / 12),
    'a flat loan splits principal plus whole-term interest evenly');
  t.check(r(scope.loanTotalInterest(l)) === 2400000,
    'the interest is the full rate on the ORIGINAL sum, however much has been paid back');

  const s = scope.loanSchedule(l);
  t.check(r(s[0].interest) === r(s[11].interest),
    'so every month is charged the same, unlike a reducing balance');
  t.check(r(s[s.length - 1].closing) === 0, 'and it still clears exactly');

  const eff = scope.loanEffectiveRate(l);
  t.check(eff > 40 && eff < 43,
    `24% flat costs about 41.7% a year in real terms (got ${eff.toFixed(1)}%)`);
  t.check(eff > Number(l.ratePct) * 1.5,
    'which is well over half again the number on the agreement -- the thing worth telling a shopkeeper');
  t.check(scope.loanTotalInterest(l) > scope.loanTotalInterest(loan()),
    'and the same headline rate costs more flat than reducing');
}

/* ---------- 3. agreed and actual are the same arithmetic -------------- */
{
  // The property that ties the two engines together. If paying exactly
  // what was asked did not reproduce the agreed balance, one of them
  // would be wrong and there would be no way to tell which.
  const inst = scope.loanScheduledPayment(loan());
  const onTrack = loan({ repayments: [pay(2, inst), pay(3, inst), pay(4, inst)] });
  const applied = scope.loanApplied(onTrack, '2026-04-30');
  const agreed = scope.loanSchedule(loan())[2].closing;
  t.check(Math.abs(applied.balance - agreed) < 1,
    `paying the agreed instalments reproduces the agreed balance (${r(applied.balance)} vs ${r(agreed)})`);

  const p = scope.loanPerformance(onTrack, '2026-04-30');
  t.check(Math.abs(p.behind) < 1, 'and such a loan is not behind');
  t.check(p.instalmentsDue === 3, 'with three instalments due by the end of April');
}

/* ---------- 4. interest before principal ------------------------------ */
{
  // Not a preference: a payment covers what the money has cost since the
  // last one, and only the remainder reduces the debt. The other way
  // round would show the loan being paid off faster than it is.
  const one = loan({ repayments: [pay(2, 1000000)] });
  const a = scope.loanApplied(one, '2026-02-28');
  t.check(r(a.interestPaid) === 200000, 'a month of interest is taken first');
  t.check(r(a.principalPaid) === 800000, 'and only what is left reduces the debt');
  t.check(r(a.balance) === 9200000, 'so the balance falls by less than was paid');

  // A payment too small to cover the interest reduces nothing.
  const tiny = loan({ repayments: [pay(2, 150000)] });
  const b = scope.loanApplied(tiny, '2026-02-28');
  t.check(r(b.principalPaid) === 0 && r(b.balance) === 10000000,
    'a payment smaller than the interest owed pays down no principal at all');
  t.check(r(b.accruedUnpaid) === 50000, 'and the shortfall is still owed');

  // Overpaying cannot take the balance below zero or invent principal.
  const over = loan({ repayments: [pay(2, 99000000)] });
  const c = scope.loanApplied(over, '2026-12-31');
  t.check(r(c.balance) === 0 && r(c.principalPaid) === 10000000,
    'paying far more than is owed clears it and no more');
  t.check(scope.loanPerformance(over, '2026-12-31').settled, 'and the loan reads as settled');
  t.check(scope.loanTotalInterest(loan()) > c.interestPaid,
    'clearing it early costs less interest than running the full term -- the reason to do it');
}

/* ---------- 5. falling behind ----------------------------------------- */
{
  const inst = scope.loanScheduledPayment(loan());
  const late = loan({ repayments: [pay(2, inst)] });
  const p = scope.loanPerformance(late, '2026-04-30');
  t.check(r(p.behind) === r(2 * inst),
    `three instalments due and one paid is two behind (got ${r(p.behind)})`);
  t.check(r(p.scheduledByNow) === r(3 * inst) && r(p.paidByNow) === r(inst),
    'reported as both figures, so it can be shown in shillings rather than as a flag');

  const ahead = loan({ repayments: [pay(2, inst * 5)] });
  t.check(scope.loanPerformance(ahead, '2026-04-30').behind < 0,
    'and paying ahead of the agreement is a negative figure rather than clamped to zero');
}

/* ---------- 6. what the statements will read -------------------------- */
{
  const inst = scope.loanScheduledPayment(loan());
  data.loans = [loan({ repayments: [pay(2, inst), pay(3, inst)] })];

  t.check(r(scope.loanInterestForPeriod('2026-02-01', '2026-02-28')) === 200000,
    'interest lands in the month it was actually paid -- the cash basis phase 1 settled on');
  t.check(r(scope.loanInterestForPeriod('2026-01-01', '2026-03-31'))
    === r(scope.loanInterestForPeriod('2026-02-01', '2026-02-28'))
      + r(scope.loanInterestForPeriod('2026-03-01', '2026-03-31')),
  'and the months add up to the quarter');
  t.check(r(scope.loanInterestForPeriod('2025-01-01', '2025-12-31')) === 0,
    'a period before the loan existed charges nothing');

  t.check(r(scope.loansOutstandingAt('2026-03-31')) === r(scope.loanOutstanding(data.loans[0], '2026-03-31')),
    'the balance-sheet liability is what is still owed');
  t.check(r(scope.loansOutstandingAt('2025-12-31')) === 0,
    'and a loan not yet taken is not a liability');

  // Principal repaid plus interest paid must equal the cash that left.
  const a = scope.loanApplied(data.loans[0], '2026-03-31');
  t.check(Math.abs((a.principalPaid + a.interestPaid) - 2 * inst) < 1,
    'every shilling repaid is either interest or principal, with nothing unaccounted for');
}

/* ---------- 7. wired into the shop's data ----------------------------- */
{
  const code = src.split(/\r?\n/).map((l) => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');
  t.check(/addDiffOps\(ops, 'loans', 'loans', 'id', shopId, rows\.loans\);/.test(code), 'loans are saved');
  t.check(/sel\('loans'\)/.test(code), 'and loaded');
  t.check(/loan:\s*\{kind:'row:loan'/.test(code), 'with their own id kind');
  /* Membership, not position. This pinned 'loans' as the LAST entry in
     the normalisation list, which broke the moment a later collection
     was appended after it -- while the thing it exists to protect, that
     a partial `data` rebuild cannot leave data.loans undefined for the
     save path, was never in question. */
  t.check(/const absent = \['suppliers','staff'[^\]]*'loans'[^\]]*\]\.filter\(k=> !data\[k\]\);/.test(code),
    'and an absent loans collection is refused from the sync, not read as empty');
  t.check(/payload:\{ repayments: l\.repayments\|\|\[\] \}/.test(code),
    'repayments ride in the payload, following purchase_invoices and saved_quotes');

  const mig = read('supabase/migrations/0043_loans.sql');
  t.check(/generated by default as identity/.test(mig), 'the id column accepts a client-assigned id');
  t.check(/is_shop_member\(shop_id\)/.test(mig), 'and the table is behind the membership check');
  t.check(/insert into entity_id_counters/.test(mig) && /row:loan/.test(mig), 'with its id counter seeded');
  t.check(/check \(method in \('reducing_balance', 'flat'\)\)/.test(mig),
    'and only the two methods the app can compute are storable');

  // Editing a loan's terms must not erase what has been paid against it.
  t.check(/data\.loans\[i\] = \{\.\.\.data\.loans\[i\], \.\.\.l\};/.test(code),
    'editing a loan merges into the stored row, so its repayments survive');
  t.check(!/readLoanForm\(\)[\s\S]{0,120}repayments/.test(code),
    'and the form never carries a repayments list of its own to overwrite them with');
}

/* ---------- equal principal, against a real printed schedule ---------
 * Every figure below is copied from the Lyamujungu SACCO repayment
 * schedule for loan C0DB761897: 20,000,000 over 12 months at 24%, which
 * the paperwork calls "declining". It IS declining -- the interest is 2%
 * of the outstanding balance -- but the PRINCIPAL is a flat 1/12 each
 * month, so the instalment falls from 2,066,700 to 1,699,600 instead of
 * staying level.
 *
 * Modelling that as an annuity (the only reducing-balance shape the app
 * had) overstated the balance from month one and the total interest by
 * 94,303. A schedule that disagrees with the lender's is worse than no
 * schedule: it is a number the shop would reconcile against and lose.
 *
 * The rounding is not cosmetic either. The sheet rounds every figure to
 * the nearest 100, and twelve slices of 1,666,700 overshoot the
 * principal by 400 -- so the last row is 1,666,300 and the loan closes
 * at exactly 0.00. Both facts are held here.
 */
{
  const sacco = loan({
    principal: 20000000, ratePct: 24, termMonths: 12,
    method: 'equal_principal', roundTo: 100, startedOn: '2026-07-25',
  });
  const rows = scope.loanSchedule(sacco);
  eq(rows.length, 12, 'twelve months, twelve rows');

  // [installment, interest, ending balance] -- straight off the paper.
  const paper = [
    [2066700, 400000, 18333300], [2033400, 366700, 16666600],
    [2000000, 333300, 14999900], [1966700, 300000, 13333200],
    [1933400, 266700, 11666500], [1900000, 233300, 9999800],
    [1866700, 200000, 8333100], [1833400, 166700, 6666400],
    [1800000, 133300, 4999700], [1766700, 100000, 3333000],
    [1733400, 66700, 1666300], [1699600, 33300, 0],
  ];
  let mismatched = 0;
  rows.forEach((row, i) => {
    const [pay, int, end] = paper[i];
    if (r(row.payment) !== pay || r(row.interest) !== int || r(row.closing) !== end) mismatched++;
  });
  eq(mismatched, 0, 'every row matches the lender\'s printed schedule exactly');
  eq(r(rows[0].principal), 1666700, 'the principal slice is flat and rounded');
  eq(r(rows[11].principal), 1666300, 'and the last one absorbs the rounding, to the shilling');
  eq(r(rows[11].closing), 0, 'so the loan closes at exactly nothing');
  eq(r(scope.loanTotalInterest(sacco)), 2600000,
    'total interest is what the sheet says — 94,303 less than the annuity charged');

  /* The instalment is different every month, so "the payment" can only
     honestly mean the first -- the one the borrower must actually find. */
  eq(r(scope.loanScheduledPayment(sacco)), 2066700,
    'the quoted payment is the FIRST instalment, the largest');

  /* Both balance-based methods charge the stated rate honestly; only the
     flat one hides its real cost. Priced off the ACTUAL instalments, so a
     falling schedule is not mispriced as a level one. */
  t.check(Math.abs(scope.loanEffectiveRate(sacco) - 24) < 0.01,
    `equal principal costs the rate it states (${scope.loanEffectiveRate(sacco).toFixed(2)}%)`);
  const annuity = loan({ principal: 20000000, ratePct: 24, termMonths: 12,
    method: 'reducing_balance', startedOn: '2026-07-25' });
  t.check(Math.abs(scope.loanEffectiveRate(annuity) - 24) < 0.01,
    'and so does the annuity, unchanged by the generalisation');
  t.check(scope.loanTotalInterest(annuity) > scope.loanTotalInterest(sacco),
    'the annuity really is the dearer of the two at the same stated rate');

  /* Unrounded, the same method still closes cleanly -- rounding is a
     lender's habit, not a requirement of the maths. */
  const unrounded = loan({ principal: 20000000, ratePct: 24, termMonths: 12,
    method: 'equal_principal', roundTo: 0, startedOn: '2026-07-25' });
  const ur = scope.loanSchedule(unrounded);
  eq(r(ur[ur.length-1].closing), 0, 'an unrounded equal-principal loan closes at zero too');
  t.check(Math.abs(ur[0].principal - 20000000/12) < 0.01,
    'with the exact slice rather than a rounded one');

  /* A zero-rate loan of this shape is just the principal, in slices. */
  const free = loan({ principal: 1200000, ratePct: 0, termMonths: 12,
    method: 'equal_principal', roundTo: 0, startedOn: '2026-07-25' });
  const fr = scope.loanSchedule(free);
  /* On a list, "Reducing" alone covered both balance-based shapes, so an
     equal-principal loan read exactly like the annuity beside it. */
  eq(scope.loanMethodLabel(sacco), 'Equal principal 24%', 'the list names the shape it actually is');
  eq(scope.loanMethodLabel(annuity), 'Reducing 24%', 'and still tells the annuity apart from it');
  eq(scope.loanMethodLabel(loan({ method: 'flat', ratePct: 12 })), 'Flat 12%', 'flat unchanged');

  eq(r(fr[0].payment), 100000, 'no rate, no interest — just the slice');
  eq(r(scope.loanTotalInterest(free)), 0, 'and nothing charged over the term');
}

/* ---------- weekly, with a charge on every payment -------------------
 * Every figure below is copied from a real Spiro bike loan (UMA977GM):
 * 3,310,000 over 52 WEEKLY payments of 88,149, each one 75,149 of
 * principal and interest plus a fixed 13,000 charge. The charges come to
 * 676,000 over the year -- MORE than the 597,744 of interest.
 *
 * The app could hold neither fact. Its schedule walked calendar months,
 * and its only fee was a one-off deduction from the money handed over.
 * Entered with the closest settings it could manage (12 monthly payments
 * at the same rate) it produced 328,572 a month against a real 88,149 a
 * week, and lost the 676,000 of charges entirely -- a loan showing
 * 3,942,863 owed against a true 4,733,744.
 */
{
  const bike = loan({
    principal: 3310000, ratePct: 33.6, termMonths: 52, frequency: 'weekly',
    method: 'reducing_balance', feePerInstallment: 13000, fees: 150000,
    startedOn: '2026-04-10',
  });
  const rows = scope.loanSchedule(bike);
  eq(rows.length, 52, 'fifty-two weekly instalments, not twelve monthly ones');

  /* The dates land a week apart, which is what makes it a weekly loan
     rather than a monthly one wearing a different number. */
  eq(rows[0].date, '2026-04-17', 'the first falls a week after drawdown');
  eq(rows[1].date, '2026-04-24', 'and the next a week after that');
  eq(rows[51].date, '2027-04-09', 'the last lands a year out');
  eq(rows[0].month, '2026-04', 'each row still knows its month, so monthly reporting can sum them');

  // Straight off the printed sheet.
  eq(r(rows[0].payment), 88149, 'the instalment is what the lender asks for');
  eq(r(rows[0].interest), 21388, 'interest is 2% of the whole balance, weekly');
  eq(r(rows[0].principal), 53761, 'and the rest goes to principal');
  eq(r(rows[0].fee), 13000, 'with the fixed charge riding on top');
  eq(r(rows[50].principal), 74187, 'row 51 matches the sheet');
  eq(r(rows[50].interest), 962, 'to the shilling');
  eq(r(rows[51].closing), 0, 'and the loan closes at nothing');

  eq(r(scope.loanTotalFees(bike)), 676000, 'the charges total what the sheet totals');
  t.check(Math.abs(scope.loanTotalInterest(bike) - 597744) < 5,
    `interest matches the sheet (${r(scope.loanTotalInterest(bike))} vs 597,744)`);
  t.check(Math.abs(rows.reduce((a, row) => a + row.payment, 0) - 4583744) < 5,
    'and so does everything handed over across the year');
  eq(r(scope.loanScheduledPayment(bike)), 88149,
    'the quoted instalment is the WHOLE payment, charge included — what is actually handed over');

  /* A charge is not interest. Folding it into the interest column would
     put 676,000 of fees through the P&L as a financing cost and report a
     rate the agreement never stated. */
  t.check(rows.every((row) => Math.abs(row.payment - (row.principal + row.interest + row.fee)) < 0.01),
    'every row adds up: principal + interest + charge = payment');
  t.check(Math.abs(scope.loanEffectiveRate(bike) - 33.6) < 0.05,
    `the interest terms price at the stated rate (${scope.loanEffectiveRate(bike).toFixed(2)}%)`);
  /* And the figure a borrower should actually act on: every shilling
     handed over, against the money that turned up. */
  t.check(scope.loanTrueCostRate(bike) > 70,
    `while the true cost, charges and upfront fee counted, is far higher (${scope.loanTrueCostRate(bike).toFixed(1)}%)`);

  /* A weekly rate is the annual one over 52, not over 12. Getting this
     wrong would quote a weekly loan at a quarter of its cost. */
  eq(scope.loanFrequency(bike), 'weekly', 'the loan knows its own rhythm');
  eq(scope.loanFrequency(loan({})), 'monthly', 'and an old loan with no frequency is monthly, as it always was');
  eq(scope.loanMethodLabel(bike), 'Reducing 33.6% · weekly',
    'the list says how often it is paid, since two loans at one rate can be years apart in cost');
  eq(scope.loanMethodLabel(loan({ ratePct: 24 })), 'Reducing 24%',
    'and stays quiet about the monthly default');

  /* Fortnightly is its own thing, not a slower week: 26 periods a year,
     14 days apart. Sharing a constant with weekly would halve the rate
     and double the gap on every loan of this shape. */
  const fortnightly = loan({
    principal: 3310000, ratePct: 33.6, termMonths: 26, frequency: 'fortnightly',
    method: 'reducing_balance', startedOn: '2026-04-10',
  });
  const fn = scope.loanSchedule(fortnightly);
  eq(fn.length, 26, 'twenty-six fortnights in a year');
  eq(fn[0].date, '2026-04-24', 'the first falls a fortnight after drawdown, not a week');
  eq(r(fn[0].interest), r(3310000 * 0.336 / 26),
    'and a fortnight is charged a 26th of the annual rate, not a 52nd');
  t.check(Math.abs(scope.loanEffectiveRate(fortnightly) - 33.6) < 0.05,
    'which prices back to the rate on the agreement');

  /* A flat loan spread over 52 weeks charges ONE year of interest, not
     the four-and-a-third a monthly reading of "52" would produce. */
  const flatWeekly = loan({
    principal: 1000000, ratePct: 12, termMonths: 52, frequency: 'weekly',
    method: 'flat', startedOn: '2026-04-10',
  });
  eq(r(scope.loanTotalInterest(flatWeekly)), 120000,
    '12% flat over 52 weekly payments is one year of interest');

  /* A frequency nobody recognises is monthly, not a crash and not a
     silent zero-period loan. */
  eq(scope.loanFrequency(loan({ frequency: 'daily' })), 'monthly',
    'an unrecognised rhythm falls back to monthly rather than being trusted');
  eq(scope.loanFrequency(loan({ frequency: null })), 'monthly', 'and so does none at all');

  /* THE PANEL'S OWN COUNT, which is the number the owner actually read.
     It said "20 of 52 instalments due by today" on a loan that was fully
     paid up, because it selected rows by MONTH -- one row IS one month
     on a monthly loan, so nobody noticed until a weekly one swept in the
     rest of August. 1.15m of phantom arrears. */
  const weeks = (from, n) => Array.from({ length: n }, (_, i) =>
    new Date(Date.parse(from + 'T00:00:00Z') + i * 7 * 86400000).toISOString().slice(0, 10));
  const paidUp = { ...bike, repayments: weeks('2026-04-17', 17).map((d) => ({ date: d, amount: 88149 })) };
  const perf = scope.loanPerformance(paidUp, '2026-08-07');
  eq(perf.instalmentsDue, 17, 'seventeen instalments have fallen due by 7 August, not twenty');
  eq(perf.instalments, 52, 'out of fifty-two');
  t.check(Math.abs(perf.scheduledByNow - 17 * 88149) < 5,
    `and the agreement asks for exactly those seventeen (${r(perf.scheduledByNow)})`);
  t.check(perf.behind < 1,
    `so a borrower who has paid all seventeen is not behind (${r(perf.behind)})`);

  /* Repayments must settle the charge as well, or the app credits 13,000
     a week to principal that the lender never did -- and shows the loan
     closing nine weeks early. */
  const paidTwice = loan({
    principal: 3310000, ratePct: 33.6, termMonths: 52, frequency: 'weekly',
    method: 'reducing_balance', feePerInstallment: 13000, startedOn: '2026-04-10',
    repayments: [{ date: '2026-04-17', amount: 88149 }, { date: '2026-04-24', amount: 88149 }],
  });
  const applied = scope.loanApplied(paidTwice, '2026-04-24');
  eq(r(applied.feesPaid), 26000, 'two weeks of charges are settled as charges');
  t.check(Math.abs(applied.principalPaid - (53761 + 54108)) < 3,
    `and only the rest reduced the debt (${r(applied.principalPaid)})`);
  t.check(Math.abs(applied.balance - 3202131) < 3,
    `so the balance is what the lender's sheet says after two weeks (${r(applied.balance)})`);
}

/* ---------- the row's own actions sit in a row -------------------------
   .pc-icon-btn is display:flex, so icon buttons dropped straight into a
   table cell become a COLUMN. Measured in the browser: three of them
   stacked and the loan row stood 109px tall; wrapped, it is 52.

   Every other group of them in this app already sits in a flex wrapper --
   sq-card-icons, inv-row-actions, sc-actions, cc-actions, rost-actions,
   pc-actions. The loans and fixed-asset tables were the only two that did
   not, and they are the only two that stacked. */
{
  const src = read('index.html');
  const cells = [...src.matchAll(/<td[^>]*>((?:(?!<\/td>)[\s\S])*?)<\/td>/g)]
    .map(m => m[1])
    .filter(inner => (inner.match(/pc-icon-btn/g) || []).length >= 2);
  /* THE FLOOR CAME OFF, THE RULE DID NOT. This asserted that at least
     two such cells exist, which was a measurement of the app rather than
     a statement of the rule -- and the two it was measuring were the
     loans and fixed-asset tables, the only two that had the fault. Both
     are gone: those screens are one register of rows that open in place,
     and their actions are named buttons in the opened row, not icons
     crammed into a table cell. The rule that a group of display:flex
     buttons needs a flex wrapper still binds every OTHER table in the
     app and every table written after this, so it is kept and applied to
     however many such cells exist -- including none. */
  const bare = cells.filter(inner => !/<div class="[a-z-]*actions"/.test(inner));
  t.check(bare.length === 0,
    bare.length
      ? `a cell drops icon buttons straight in, so they stack: ${bare[0].replace(/\s+/g,' ').slice(0,80)}`
      : 'and every one of them wraps the buttons, so they lay out as a row');
  t.check(/\.pc-icon-btn\{\s*\n?\s*all:unset;cursor:pointer;display:flex;/.test(src),
    'which is what the button being display:flex requires of whatever holds several');
}

/* ---------- money does not break across two lines ---------------------
   .dr-lines carries the loan's payment-by-payment schedule and the asset
   depreciation tables, and had no styling at all. Measured in the
   browser: all 84 cells of a twelve-row schedule wrapped, "20,000,000"
   on one line and "UGX" on the next, rows standing 55px instead of 28.
   A figure split over two lines reads as two facts. */
{
  const src = read('index.html');
  const rule = (/\.dr-lines td, \.dr-lines th\{[^}]*\}/.exec(src) || [''])[0];
  t.check(/white-space:nowrap/.test(rule),
    'a schedule cell keeps its figure on one line');
  const numRule = (/\.dr-lines td\.num\{[^}]*\}/.exec(src) || [''])[0];
  t.check(/font-variant-numeric:tabular-nums/.test(numRule) && /IBM Plex Mono/.test(numRule),
    'and its digits line up on themselves, as every other money column in this app does');
  /* A no-wrap table can be wider than the modal, so it needs its own
     scroll -- otherwise it pushes the dialog sideways instead. */
  t.check(/\.dr-lines\{overflow-x:auto;\}/.test(src),
    'and the table scrolls inside its own box rather than widening the dialog');
  /* The precedent it follows, so the two cannot drift apart. */
  t.check(/\.bl-lines td\.num\{[^}]*white-space:nowrap;\}/.test(src),
    'which is the rule the buying list already had for the same reason');
}

process.exit(t.done() ? 1 : 0);
