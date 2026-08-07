#!/usr/bin/env node
'use strict';
/*
 * Being told a repayment is due, and being able to pay it there.
 *
 * The schedule knew exactly what the lender wanted and when. Nothing
 * looked at it, so the shop found out it was late when the lender rang.
 *
 * CUMULATIVE, NOT PER-INSTALMENT. The question is what the agreement has
 * asked for by now against what has actually been handed over. Counting
 * whole missed instalments gets both ends wrong, in opposite directions:
 *
 *   a lump sum covering three months would read as three payments
 *   behind, because three instalment dates went by without a payment
 *   landing on them.
 *
 *   a year of quiet underpayment would read as perfectly up to date,
 *   because something arrived every month.
 *
 * An instalment belongs to a MONTH, so it is due during that month and
 * overdue once the month has passed. That is the only convention the
 * schedule supports -- its rows carry a month, not a day -- and inventing
 * a day of the month would be inventing a fact the loan does not record.
 *
 * Run: node test/loan-due-reminder.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('loan due reminder');
const src = read('index.html');
const TODAY = '2026-08-04';
const data = { loans: [] };

const scope = compileScope([
  extractFunction(src, 'loanPrincipal', 'index.html'),
  extractFunction(src, 'loanFees', 'index.html'),
  extractFunction(src, 'loanInstallments', 'index.html'),
  extractDeclaration(src, 'LOAN_FREQUENCIES', 'index.html'),
  extractFunction(src, 'loanFrequency', 'index.html'),
  extractFunction(src, 'loanPeriodsPerYear', 'index.html'),
  extractFunction(src, 'loanInstallments', 'index.html'),
  extractFunction(src, 'loanPeriodRate', 'index.html'),
  extractFunction(src, 'loanFeePerInstallment', 'index.html'),
  extractFunction(src, 'loanDueDate', 'index.html'),
  extractFunction(src, 'loanPeriodsBetween', 'index.html'),
  extractFunction(src, 'loanLevelPI', 'index.html'),
  extractFunction(src, 'loanRoundTo', 'index.html'),
  extractFunction(src, 'loanRound', 'index.html'),
  extractFunction(src, 'loanScheduledPayment', 'index.html'),
  extractFunction(src, 'loanSchedule', 'index.html'),
  extractFunction(src, 'loanRepayments', 'index.html'),
  extractFunction(src, 'monthsBetween', 'index.html'),
  extractFunction(src, 'loanApplied', 'index.html'),
  extractFunction(src, 'loanDuePosition', 'index.html'),
  extractFunction(src, 'loansNeedingPayment', 'index.html'),
], { data, todayISO: () => TODAY },
  ['loanDuePosition', 'loansNeedingPayment', 'loanScheduledPayment', 'loanSchedule']);

const mkLoan = (over) => Object.assign({
  id: 1, lender: 'Centenary', principal: 20000000, ratePct: 24,
  method: 'reducing_balance', termMonths: 12, startedOn: '2026-01-15',
  fees: 600000, repayments: [],
}, over);
const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${got}, want ${want})`);
const near = (got, want, msg) => t.check(Math.abs(got - want) < 1,
  `${msg} (got ${Math.round(got)}, want ${Math.round(want)})`);

const base = mkLoan();
const PAY = scope.loanScheduledPayment(base);
const paidOn = (date, amount) => ({ date, amount: amount == null ? PAY : amount });

/* ---------- 1. the schedule starts the month AFTER drawing ----------- */
{
  const months = scope.loanSchedule(base).map((r) => r.month);
  eq(months[0], '2026-02', 'a loan drawn in January is first asked for in February');
  eq(months.length, 12, 'twelve instalments for a twelve-month term');
  // Feb through Aug inclusive is seven months of asking by 4 August.
  eq(months.filter((m) => m <= '2026-08').length, 7, 'seven of them have come due by August');
}

/* ---------- 2. nothing paid at all ----------------------------------- */
{
  const d = scope.loanDuePosition(mkLoan(), TODAY);
  eq(d.status, 'overdue', 'a loan nothing has been paid on is overdue, not merely due');
  near(d.dueNow, PAY * 7, 'everything asked for so far is wanted, this month included');
  near(d.overdue, PAY * 6, 'and the part that is LATE excludes this month, which still has time to run');
  eq(d.instalmentsBehind, 6, 'six instalments have gone by uncovered');
  eq(d.next.month, '2026-09', 'with next month named so the shop can see what is coming');
}

/* ---------- 3. paid up, and the month it is in ----------------------- */
{
  const upToJuly = mkLoan({ repayments: [
    paidOn('2026-02-20'), paidOn('2026-03-20'), paidOn('2026-04-20'),
    paidOn('2026-05-20'), paidOn('2026-06-20'), paidOn('2026-07-20'),
  ] });
  const d = scope.loanDuePosition(upToJuly, TODAY);
  eq(d.status, 'due', 'up to date through July leaves August due, not overdue');
  near(d.dueNow, PAY, 'and only August is wanted');
  eq(d.overdue, 0, 'nothing is late');
  eq(d.instalmentsBehind, 0, 'no instalment has gone by uncovered');

  const alsoAugust = mkLoan({ repayments: [...upToJuly.repayments, paidOn('2026-08-02')] });
  const d2 = scope.loanDuePosition(alsoAugust, TODAY);
  eq(d2.status, 'upcoming', 'once this month is paid there is nothing to remind anybody about');
  eq(d2.dueNow, 0, 'nothing is wanted');
  eq(d2.next.month, '2026-09', 'though what comes next is still named');
}

/* ---------- 4. the two ways per-instalment counting goes wrong ------- */
{
  /* A lump sum covering three months. Three instalment months went by
     with no payment landing IN them, so counting missed instalments
     would report three months behind on a shop that is square through
     April. */
  const lump = mkLoan({ repayments: [paidOn('2026-02-20', PAY * 3)] });
  const d = scope.loanDuePosition(lump, TODAY);
  eq(d.instalmentsBehind, 3, 'Feb, Mar and Apr are covered by the lump — only May, Jun and Jul are behind');
  near(d.overdue, PAY * 3, 'and the arrears are three instalments, not six');

  /* The opposite error. Something arrived every single month, so no
     instalment date was "missed" -- but each was half of what was asked,
     and the shop is half a year behind. */
  const half = mkLoan({ repayments: [
    paidOn('2026-02-20', PAY / 2), paidOn('2026-03-20', PAY / 2), paidOn('2026-04-20', PAY / 2),
    paidOn('2026-05-20', PAY / 2), paidOn('2026-06-20', PAY / 2), paidOn('2026-07-20', PAY / 2),
  ] });
  const dh = scope.loanDuePosition(half, TODAY);
  eq(dh.status, 'overdue', 'paying half every month is still falling behind');
  near(dh.overdue, PAY * 3, 'by exactly the half that was never paid');
  t.check(dh.instalmentsBehind > 0, 'and it is reported as instalments behind rather than passing as up to date');
}

/* ---------- 5. a reminder never asks for more than the loan ---------- */
{
  // Paid off early and in full. The schedule still lists instalments for
  // months to come; none of them may be demanded.
  const cleared = mkLoan({ repayments: [paidOn('2026-02-20', 30000000)] });
  const d = scope.loanDuePosition(cleared, TODAY);
  eq(d.status, 'settled', 'a loan with nothing left to pay is settled');
  eq(d.dueNow, 0, 'and asks for nothing');

  /* The cap earning its keep. A three-month loan whose term ran out in
     April has been asked, by the schedule, for the principal AND all
     three months of interest. Interest only accrues to today, so what
     would actually close it is less than the schedule's total -- and a
     reminder demanding the difference is asking for money the shop does
     not owe.

     Swept across method, rate, term, principal and how much was paid:
     the cap changes the answer in 300 of 1440 combinations, so this is a
     real guard and not defensive decoration. */
  const short = mkLoan({ principal: 500000, ratePct: 6, termMonths: 3, fees: 0, repayments: [] });
  const ds = scope.loanDuePosition(short, TODAY);
  const askedBySchedule = scope.loanSchedule(short)
    .filter((r) => r.month <= '2026-08').reduce((s, r) => s + r.payment, 0);
  t.check(askedBySchedule > ds.payoff + 0.5,
    `the schedule asks for more than would close it (asks ${Math.round(askedBySchedule)}, payoff ${Math.round(ds.payoff)})`);
  near(ds.dueNow, ds.payoff, 'and the reminder asks for the payoff, not the schedule total');
  t.check(ds.dueNow < askedBySchedule, 'which is strictly less than the agreement has nominally asked for');
}

/* ---------- 5b. a payment dated ahead has not happened --------------- */
{
  // A post-dated cheque, or a typo in the date. Either way the money has
  // not moved, and counting it would report a shop as up to date on a
  // payment it has not made.
  const ahead = mkLoan({ repayments: [paidOn('2026-12-20', PAY * 7)] });
  const d = scope.loanDuePosition(ahead, TODAY);
  eq(d.status, 'overdue', 'a repayment dated four months from now settles nothing today');
  near(d.dueNow, PAY * 7, 'so everything asked for so far is still wanted');
  eq(d.paid, 0, 'and nothing counts as handed over yet');
}

/* ---------- 6. which loans the reminder raises ----------------------- */
{
  /* Order in the array is deliberately the WRONG order. With the overdue
     loan listed first, Array.sort is stable and a comparator that does
     nothing still leaves it on top -- the check would pass on a sort that
     had been removed entirely. */
  data.loans = [
    // Sized to ITS OWN schedule. Paying this 4,000,000 loan six
    // instalments of the 20,000,000 one settles it outright, and it then
    // vanishes from the list for the right reason but the wrong test.
    (() => {
      const equity = mkLoan({ id: 2, lender: 'Equity', principal: 4000000 });
      const own = scope.loanScheduledPayment(equity);
      equity.repayments = ['2026-02-20', '2026-03-20', '2026-04-20',
        '2026-05-20', '2026-06-20', '2026-07-20'].map((date) => ({ date, amount: own }));
      return equity;
    })(),
    mkLoan({ id: 3, lender: 'Settled Ltd', repayments: [paidOn('2026-02-20', 30000000)] }),
    mkLoan({ id: 4, lender: 'Not Yet', startedOn: '2026-07-20' }),
    /* Bigger than Centenary's arrears, but merely due rather than late.
       Without it the two sort keys mask each other: Centenary is both
       the most overdue AND the biggest, so a comparator that had lost
       its status term entirely would still put it on top by amount. */
    (() => {
      const big = mkLoan({ id: 5, lender: 'Big But Current', principal: 200000000 });
      const own = scope.loanScheduledPayment(big);
      big.repayments = ['2026-02-20', '2026-03-20', '2026-04-20',
        '2026-05-20', '2026-06-20', '2026-07-20'].map((date) => ({ date, amount: own }));
      return big;
    })(),
    // A second overdue loan, smaller, so the amount tiebreaker within a
    // status has something to order.
    mkLoan({ id: 6, lender: 'Small Arrears', principal: 2000000 }),
    mkLoan({ id: 1, lender: 'Centenary' }),   // overdue and biggest -- listed LAST on purpose
  ];
  const list = scope.loansNeedingPayment(TODAY);
  const names = list.map((x) => x.loan.lender);

  t.check(!names.includes('Settled Ltd'), 'a settled loan is never raised');
  t.check(names[0] === 'Centenary',
    `overdue comes before merely due even when the due one is larger (got ${names.join(', ')})`);
  t.check(names.indexOf('Small Arrears') < names.indexOf('Big But Current'),
    'being late outranks being large — a small overdue loan sits above a big one that is merely due');
  t.check(names.indexOf('Centenary') < names.indexOf('Small Arrears'),
    'and within the overdue ones the bigger sum comes first');
  t.check(names.includes('Equity'), 'and a loan simply due this month is still raised');

  // A loan drawn last month is first asked for this month, so it is due
  // rather than overdue -- being new is not being late.
  const notYet = list.find((x) => x.loan.lender === 'Not Yet');
  t.check(!notYet || notYet.due.status === 'due',
    'a loan drawn last month is due, not overdue');

  data.loans = [];
  eq(scope.loansNeedingPayment(TODAY).length, 0, 'a shop with no loans is asked for nothing');
}

/* ---------- 7. the reminder can act, and cannot be silenced ---------- */
{
  const pay = (/async function payLoanFromReminder[\s\S]*?\n\}/.exec(src) || [''])[0];
  t.check(/addCashPayment\(account, amount, 'Loan Repayment'/.test(pay),
    'accepting the reminder writes the cash book entry itself, rather than sending the user off to find the screen that can');
  t.check(/loan\.repayments\.push\(\{ date, amount, note:'', cashTxnId \}\)/.test(pay),
    'and records it against the loan, carrying the id so deleting the loan can take the entry with it');
  t.check(/promptCashAccount\(/.test(pay),
    'asking which account it came from, because the cash book tracks three');
  t.check(/prompt\(/.test(pay),
    'the amount is offered rather than imposed — a part payment must be recordable');

  /* "Remind me tomorrow" stores a DATE, not a flag -- a boolean would
     make the first snooze permanent, which is how a reminder quietly
     stops existing.

     RUN, not read. The first version of this check asserted the
     comparison OPERATOR in the source and passed while the behaviour was
     wrong: snoozing wrote today and compared today > today, so the
     popup reopened the instant anything called it again. Driving the
     function is the only version of this check that could have failed. */
  const store = {};
  const snoozeScope = compileScope([
    extractDeclaration(src, 'LOAN_DUE_SNOOZE_KEY', 'index.html'),
    extractFunction(src, 'loanDueSnoozed', 'index.html'),
    extractFunction(src, 'snoozeLoanDue', 'index.html'),
  ], {
    lsGet: (k) => (k in store ? store[k] : null),
    lsSet: (k, v) => { store[k] = v; },
    todayISO: () => TODAY,
    closeModal: () => {},
  }, ['loanDueSnoozed', 'snoozeLoanDue']);

  eq(snoozeScope.loanDueSnoozed(TODAY), false, 'nothing is snoozed to begin with');
  snoozeScope.snoozeLoanDue();
  eq(snoozeScope.loanDueSnoozed(TODAY), true,
    'snoozing quiets the rest of TODAY — otherwise "remind me tomorrow" does not even manage today');
  eq(snoozeScope.loanDueSnoozed('2026-08-05'), false,
    'and tomorrow it is back, which is the whole difference from a flag');
  eq(snoozeScope.loanDueSnoozed('2027-01-01'), false, 'and stays back');

  // Snoozing hides the interruption, not the fact. The Loans screen keeps
  // a way in for somebody who dismissed it this morning and has the money
  // this afternoon.
  t.check(/id="ln_due_banner"/.test(src) && /ln_due_banner'\)/.test(src),
    'and the Loans screen still offers a way in after it has been dismissed');
}

process.exit(t.done() ? 1 : 0);
