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
  extractFunction(src, 'loanMonths', 'index.html'),
  extractFunction(src, 'loanPrincipal', 'index.html'),
  extractFunction(src, 'loanScheduledPayment', 'index.html'),
  extractFunction(src, 'loanSchedule', 'index.html'),
  extractFunction(src, 'loanTotalInterest', 'index.html'),
  extractFunction(src, 'loanEffectiveRate', 'index.html'),
  extractFunction(src, 'loanRepayments', 'index.html'),
  extractFunction(src, 'loanApplied', 'index.html'),
  extractFunction(src, 'loanOutstanding', 'index.html'),
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
  'loanInterestForPeriod', 'loanPerformance', 'dayBeforeISO', 'loanMethodLabel']);

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

process.exit(t.done() ? 1 : 0);
