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
  extractFunction(src, 'dayBeforeISO', 'index.html'),
  extractFunction(src, 'loanInterestPaidBetween', 'index.html'),
  extractFunction(src, 'liveLoans', 'index.html'),
  extractFunction(src, 'loansOutstandingAt', 'index.html'),
  extractFunction(src, 'loanInterestForPeriod', 'index.html'),
  extractFunction(src, 'loanPerformance', 'index.html'),
], { data, todayISO: () => '2026-08-04' },
['loanScheduledPayment', 'loanSchedule', 'loanTotalInterest', 'loanEffectiveRate',
  'loanApplied', 'loanOutstanding', 'loanInterestPaidBetween', 'loansOutstandingAt',
  'loanInterestForPeriod', 'loanPerformance', 'dayBeforeISO']);

const r = (n) => Math.round(n);
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
  t.check(/'fixedAssets','loans'\]/.test(code), 'and guarded against being absent');
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

process.exit(t.done() ? 1 : 0);
