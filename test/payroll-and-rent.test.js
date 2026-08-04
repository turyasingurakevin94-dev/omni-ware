#!/usr/bin/env node
'use strict';
/*
 * What the shop owes its people and its landlord.
 *
 * "Rent" and "Salaries & Wages" were already cash-book categories, so a
 * payment could be filed after the fact and reached operating costs
 * correctly. Everything BEFORE the payment was missing: staff carried no
 * pay rate, so payroll could only be typed as a lump sum and never
 * checked; there was no rent agreement, so nothing knew what was due or
 * when; and nothing in the app was ever owed-but-unpaid except a loan,
 * so rent five days late or a month of wages already worked was
 * invisible.
 *
 * A COMMITMENT AND A DUE. A commitment is a rent agreement or a staff
 * member's pay rate. A due is one month of one commitment -- the thing
 * that can be overdue, part-paid, or still uncosted.
 *
 * THE TRAP THIS FILE EXISTS FOR, in three shapes:
 *
 *   no rate set     a staff member nobody has set up is not on the
 *                   payroll at a wage of zero. They are missing, and
 *                   the screen has to say so.
 *   no days yet     a daily-paid worker's month cannot be costed until
 *                   somebody counts the days. That is UNKNOWN, and
 *                   folding it in at zero produces a confident payroll
 *                   figure short by exactly the wages of the people who
 *                   did the work.
 *   a raise         changing somebody's rate in August must not rewrite
 *                   what July cost. The rate is snapshot onto the due.
 *
 * Run: node test/payroll-and-rent.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('payroll and rent');
const src = read('index.html');
const code = src.split(/\r?\n/).map((l) => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');
const TODAY = '2026-08-04';
const data = { staff: [], rentAgreements: [], dues: [], cashTxns: [] };

let nextId = 1;
const cashAdded = [];
const toasts = [];

const NAMES = ['periodOf', 'currentPeriod', 'periodShift', 'periodEndDate', 'staffOnPayroll',
  'staffWithoutPayRate', 'rentAgreementsFor', 'findDue', 'generateDuesForPeriod', 'setDueDays',
  'dueBalance', 'dueIsSettled', 'dueIsOverdue', 'dueName', 'payrollPosition', 'duesOutstanding',
  'duesOverdue', 'payDue', 'reverseDuePayment'];

const scope = compileScope([
  extractDeclaration(src, 'DUE_KINDS', 'index.html'),
  ...NAMES.map((n) => extractFunction(src, n, 'index.html')),
], {
  data,
  todayISO: () => TODAY,
  saveData: () => {},
  toast: (m) => { toasts.push(String(m)); },
  allocRowId: () => nextId++,
  periodLabel: (p) => p,
  addCashPayment: (account, amount, category, description, date) => {
    const id = nextId++;
    cashAdded.push({ id, account, amount, category, description, date });
    data.cashTxns.push({ id, account, amount, category, description, date, type: 'payment' });
    return id;
  },
  removeCashTxnsByIds: (ids) => {
    const set = new Set(ids.filter((x) => x != null));
    data.cashTxns = data.cashTxns.filter((x) => !set.has(x.id));
  },
}, NAMES);

const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);
const staff = (id, name, payBasis, payRate) => ({ id, name, role: 'worker', payBasis, payRate });
const rent = (id, premises, amount, dueDay, startMonth, endMonth) =>
  ({ id, premises, landlord: '', amount, dueDay, startMonth, endMonth: endMonth || null });
const reset = (st, rt) => {
  data.staff = st || []; data.rentAgreements = rt || []; data.dues = []; data.cashTxns = [];
  cashAdded.length = 0; toasts.length = 0; nextId = 1;
};
const wageFor = (name) => data.dues.find((d) => d.kind === 'wage' && scope.dueName(d) === name);

/* ---------- 1. what a month raises --------------------------------- */
{
  reset(
    [staff('S1', 'Monthly Musa', 'monthly', 450000),
      staff('S2', 'Daily Okello', 'daily', 15000),
      // On the staff list, but nobody has set them up.
      staff('S3', 'Unset Joan', null, null),
      // Half set up: told to be monthly, never given an amount.
      staff('S4', 'Half-set Peter', 'monthly', null)],
    [rent(1, 'Main shop', 800000, 1, '2026-01')],
  );
  const made = scope.generateDuesForPeriod('2026-08');
  eq(made.length, 4, 'rent plus the three staff who have a pay basis');

  eq(scope.staffOnPayroll().length, 3, 'somebody with no pay basis is not on the payroll');
  t.check(!wageFor('Unset Joan'), 'so no month is raised for them at all');
  eq(scope.staffWithoutPayRate().length, 2,
    'but they are counted, so the screen can say somebody is not set up');
  /* A monthly wage with no amount agreed is UNKNOWN, not free. Reading
     the blank as zero would raise a month for them every month at
     nothing and quietly report the payroll as complete. */
  t.check(wageFor('Half-set Peter').amount === null,
    'a monthly month with no rate agreed is raised uncosted, not at zero');

  const r = data.dues.find((d) => d.kind === 'rent');
  eq(r.dueDate, '2026-08-01', 'rent falls due on the agreement\'s day of the month');
  eq(r.amount, 800000, 'at the agreed amount');
  eq(wageFor('Monthly Musa').dueDate, '2026-08-31',
    'wages fall due at the end of the month they were worked');
  eq(scope.periodEndDate('2026-02'), '2026-02-28', 'and February looks after itself');
  eq(scope.periodEndDate('2028-02'), '2028-02-29', 'including in a leap year');

  /* A daily month is NOT costed until the days are counted. Zero would
     be a claim that they worked no days. */
  t.check(wageFor('Daily Okello').amount === null,
    'a daily-paid month starts uncosted rather than at zero');
  eq(wageFor('Daily Okello').rate, 15000, 'with the day rate carried onto it');
}

/* ---------- 2. raising a month twice ------------------------------- *
 * This runs every time the screen is opened. Charging the rent twice in
 * one morning would be a real and expensive bug.
 */
{
  const before = data.dues.length;
  eq(scope.generateDuesForPeriod('2026-08').length, 0, 'a second run raises nothing new');
  scope.generateDuesForPeriod('2026-08');
  scope.generateDuesForPeriod('2026-08');
  eq(data.dues.length, before, 'and the month still has exactly what it had');
}

/* ---------- 3. uncosted is not zero -------------------------------- *
 * The heart of it. A month nobody has counted is unknown, and folding
 * it in at zero reports a payroll short by exactly the wages of the
 * people who did the work.
 */
{
  const p = () => scope.payrollPosition('2026-08');
  eq(p().known, 1250000, 'what is known is the rent plus the monthly wage');
  eq(p().uncostedCount, 2, 'with both uncosted months reported apart from it');
  eq(p().noRateCount, 2, 'and the two people without a usable rate reported apart again');

  scope.setDueDays(wageFor('Daily Okello').id, 24);
  eq(wageFor('Daily Okello').amount, 360000, 'entering days costs the month at days times rate');
  eq(p().known, 1610000, 'and it joins the total');
  eq(p().uncostedCount, 1, 'leaving only the half-set-up monthly one uncounted');

  // Clearing the box returns it to uncosted rather than costing it at nothing.
  scope.setDueDays(wageFor('Daily Okello').id, '');
  t.check(wageFor('Daily Okello').amount === null,
    'clearing the days makes the month uncosted again, not free');
  eq(p().uncostedCount, 2, 'and it is reported as uncounted once more');

  // Zero days IS a count: a month somebody genuinely did not work.
  scope.setDueDays(wageFor('Daily Okello').id, 0);
  eq(wageFor('Daily Okello').amount, 0, 'zero days is a real count of nothing owed');
  eq(p().uncostedCount, 1, 'and is not the same as not having counted');
  scope.setDueDays(wageFor('Daily Okello').id, 24);
}

/* ---------- 4. a raise does not rewrite history -------------------- */
{
  const july = scope.generateDuesForPeriod('2026-07');
  const julyMusa = data.dues.find((d) => d.period === '2026-07' && scope.dueName(d) === 'Monthly Musa');
  eq(julyMusa.amount, 450000, 'July was raised at the rate that applied then');

  // Give them a raise.
  data.staff.find((s) => s.id === 'S1').payRate = 600000;
  eq(julyMusa.amount, 450000, 'and a raise in August does not rewrite what July cost');
  eq(julyMusa.rate, 450000, 'the rate is snapshot onto the due, not read back off the staff record');

  const sept = scope.generateDuesForPeriod('2026-09');
  const septMusa = data.dues.find((d) => d.period === '2026-09' && scope.dueName(d) === 'Monthly Musa');
  eq(septMusa.amount, 600000, 'while a month raised after it uses the new rate');
  data.staff.find((s) => s.id === 'S1').payRate = 450000;
  data.dues = data.dues.filter((d) => d.period === '2026-08');
}

/* ---------- 5. when a tenancy runs ---------------------------------- */
{
  reset([], [rent(1, 'Lock-up', 200000, 15, '2026-06', '2026-07')]);
  eq(scope.rentAgreementsFor('2026-05').length, 0, 'nothing is raised before the tenancy started');
  eq(scope.rentAgreementsFor('2026-06').length, 1, 'the first month is the month it started');
  eq(scope.rentAgreementsFor('2026-07').length, 1, 'the last is the month it ended');
  eq(scope.rentAgreementsFor('2026-08').length, 0, 'and nothing after that');

  // Taking on premises in June must not invent five months of arrears.
  scope.generateDuesForPeriod('2026-02');
  eq(data.dues.length, 0, 'so a month before the tenancy raises nothing');

  /* A due day past the 28th has no date in February. Left unclamped the
     rent for that month gets a due date of 2026-02-30, which is not a
     day -- so it sorts oddly, never compares as overdue, and the one
     month of the year the shop is tightest is the month the reminder
     goes quiet. */
  reset([], [rent(2, 'Yard', 300000, 31, '2026-01')]);
  scope.generateDuesForPeriod('2026-02');
  eq(data.dues[0].dueDate, '2026-02-28', 'a due day past the 28th lands on a day February has');
  data.dues = [];
  scope.generateDuesForPeriod('2026-03');
  eq(data.dues[0].dueDate, '2026-03-28', 'and is clamped the same way in every other month, so the day never moves');
}

/* ---------- 6. paying one ------------------------------------------- */
{
  reset([staff('S1', 'Musa', 'monthly', 450000)], [rent(1, 'Main shop', 800000, 1, '2026-01')]);
  scope.generateDuesForPeriod('2026-08');
  const r = data.dues.find((d) => d.kind === 'rent');

  eq(scope.payDue(r.id, 300000, 'cash'), 300000, 'a part payment goes through');
  eq(scope.dueBalance(r), 500000, 'leaving the rest owing');
  t.check(!scope.dueIsSettled(r), 'and the month is not settled');

  /* Through the cash book under the category that was always there, so
     it reaches operating costs the way a hand-typed entry does. */
  eq(cashAdded.length, 1, 'one cash book entry per payment');
  eq(cashAdded[0].category, 'Rent', 'under Rent, which cashIsOperatingExpense already counts as opex');
  eq(cashAdded[0].amount, 300000, 'for what was actually paid');

  eq(scope.payDue(wageFor('Musa') ? wageFor('Musa').id : 0, 100000, 'cash'), 100000, 'wages pay the same way');
  eq(cashAdded[1].category, 'Salaries & Wages', 'under their own category');

  // Overpaying is capped at what is owed rather than creating a credit
  // this model has nowhere to hold.
  eq(scope.payDue(r.id, 999999999, 'cash'), 500000, 'paying more than is owed settles it and no more');
  eq(scope.dueBalance(r), 0, 'the balance lands exactly on nothing');
  t.check(scope.dueIsSettled(r), 'and it reads as settled');

  // An uncosted month cannot be paid: there is no figure to pay against.
  reset([staff('S9', 'Daily', 'daily', 10000)], []);
  scope.generateDuesForPeriod('2026-08');
  t.check(scope.dueBalance(data.dues[0]) === null, 'an uncosted month has no balance');
  toasts.length = 0;
  t.check(scope.payDue(data.dues[0].id, 50000, 'cash') === null,
    'and cannot be paid until the days are entered');
  eq(cashAdded.length, 0, 'so nothing reaches the cash book on a guess');
  /* And the refusal says WHY. Without its own guard this still stops --
     Math.min(50000, null) is 0, so the amount check catches it -- but
     the person is told "enter an amount to pay" while the amount they
     typed was fine, and the thing actually missing is never named. */
  t.check(toasts.some((m) => /days worked/.test(m)),
    'and the refusal names the days as what is missing, not the amount');
}

/* ---------- 7. reversing a payment ---------------------------------- */
{
  reset([], [rent(1, 'Main shop', 800000, 1, '2026-01')]);
  scope.generateDuesForPeriod('2026-08');
  const r = data.dues.find((d) => d.kind === 'rent');
  scope.payDue(r.id, 800000, 'cash');
  eq(data.cashTxns.length, 1, 'the payment is in the cash book');

  scope.reverseDuePayment(r.id, 0);
  eq(data.cashTxns.length, 0,
    'reversing it removes its cash book entry too, so the two cannot drift apart');
  eq(r.paid, 0, 'and the month is owing again');
  eq(scope.dueBalance(r), 800000, 'for the whole of it');
}

/* ---------- 8. what is late ----------------------------------------- */
{
  reset([staff('S1', 'Musa', 'monthly', 450000)], [rent(1, 'Main shop', 800000, 1, '2026-01')]);
  scope.generateDuesForPeriod('2026-08');
  const r = data.dues.find((d) => d.kind === 'rent');
  const w = data.dues.find((d) => d.kind === 'wage');

  // Today is the 4th; the rent fell due on the 1st and the wage on the 31st.
  t.check(scope.dueIsOverdue(r), 'rent past its day is late');
  t.check(!scope.dueIsOverdue(w), 'while a wage not yet due is not');
  eq(scope.duesOverdue().length, 1, 'so one thing is late');
  eq(scope.payrollPosition('2026-08').overdueAmount, 800000, 'and it is the rent');

  scope.payDue(r.id, 800000, 'cash');
  t.check(!scope.dueIsOverdue(r), 'paying it stops it being late');
  eq(scope.duesOverdue().length, 0, 'and nothing is late any more');

  /* An uncosted month cannot be late: there is no amount for it to be
     late BY, and calling it overdue would put a figure of nothing on the
     one line that is meant to be alarming. */
  reset([staff('S9', 'Daily', 'daily', 10000)], []);
  data.dues = [];
  scope.generateDuesForPeriod('2026-07');   // due 31 July, before today
  t.check(!scope.dueIsOverdue(data.dues[0]),
    'an uncosted month past its date is not reported as late, having no amount to be late by');
}

/* ---------- 9. wired into the shop's data --------------------------- */
{
  t.check(/sel\('rent_agreements'\)/.test(code) && /sel\('dues'\)/.test(code), 'both tables are loaded');
  t.check(/addDiffOps\(ops, 'rentAgreements', 'rent_agreements', 'id', shopId, rows\.rentAgreements\);/.test(code)
    && /addDiffOps\(ops, 'dues', 'dues', 'id', shopId, rows\.dues\);/.test(code), 'and saved');
  t.check(/'loans','rentAgreements','dues'\]/.test(code),
    'and guarded against being absent when data is rebuilt from a partial literal');
  t.check(/rentAgreement:\s*\{kind:'row:rent_agreement'/.test(code) && /due:\s*\{kind:'row:due'/.test(code),
    'with their own id kinds, named the way every other kind is');

  /* null all the way through. Coercing on the way in or out would undo
     the whole distinction this file is about. */
  t.check(/payBasis: s\.pay_basis \|\| null/.test(code) && /payRate: s\.pay_rate==null \? null : Number\(s\.pay_rate\)/.test(code),
    'a staff member with no rate loads as null, not as 0');
  t.check(/amount: d\.amount==null \? null : Number\(d\.amount\)/.test(code),
    'and an uncosted month loads as null too');
  t.check(/pay_rate: s\.payRate==null \? null : s\.payRate/.test(code)
    && /amount: x\.amount==null \? null : x\.amount/.test(code),
    'and both are written back as null rather than coerced on the way out');

  // Seven `const record = {` literals in this file, so the staff one is
  // reached through the pay fields rather than by taking the first match.
  const save = (/const payBasis = document\.getElementById\('st_pay_basis'\)[\s\S]*?\n  \};/.exec(code) || [''])[0];
  t.check(/payRate: \(!payBasis \|\| rateRaw === ''\) \? null : Number\(rateRaw\)/.test(save),
    'an empty rate box saves as no rate, not as a rate of nothing');

  // The screen raises the month on open, which is what makes it work
  // without anybody remembering to run payroll.
  const render = (/function renderPayroll\(\)\{[\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(/generateDuesForPeriod\(period\)/.test(render), 'opening the screen raises the month');
  t.check(/pr_next'\)\.disabled = period >= currentPeriod\(\)/.test(render),
    'and next month cannot be opened before it has happened');
  t.check(/if\(next <= currentPeriod\(\)\)\{ prPeriod = next;/.test(code),
    'guarded as well as disabled, so a keyboard cannot get past it either');
}

process.exit(t.done() ? 1 : 0);
