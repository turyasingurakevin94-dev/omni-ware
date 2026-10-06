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
const store = {};

const NAMES = ['periodOf', 'currentPeriod', 'periodShift', 'periodEndDate', 'staffOnPayroll',
  'staffWithoutPayRate', 'rentAgreementsFor', 'findDue', 'generateDuesForPeriod', 'setDueDays',
  'dueBalance', 'dueIsSettled', 'dueIsOverdue', 'dueName', 'payrollPosition', 'duesOutstanding',
  'duesOverdue', 'duesNeedingPayment', 'payDue', 'reverseDuePayment',
  'duesSnoozed', 'snoozeDues',
  // Days missed.
  'dueAbsences', 'dueBasis', 'dueDayRate', 'dueUnpaidAbsenceDays', 'dueDeduction',
  'dueCostOf', 'recostDue', 'addDueAbsence', 'removeDueAbsence', 'setDueAbsencePaid',
  'dueOverpaid',
  // The daily register on the Staff screen.
  'newWageDue', 'ensureWageDue', 'staffAttendanceOn', 'setStaffAttendance', 'attendanceForDay',
  // The month calendar the register is drawn on.
  'attWeekdayIndex', 'attIsRestDay', 'attMonthDays', 'currentAttDate', 'currentAttMonth',
  'goToAttMonth', 'selectAttDate',
  // Weekly pay.
  'basisDayRate', 'basisMonthCost', 'dueGross', 'dueFortnight'];

const scope = compileScope([
  extractDeclaration(src, 'DUE_KINDS', 'index.html'),
  extractDeclaration(src, 'DUES_SNOOZE_KEY', 'index.html'),
  extractDeclaration(src, 'WAGE_DAYS_PER_MONTH', 'index.html'),
  extractDeclaration(src, 'ABSENCE_REASONS', 'index.html'),
  extractDeclaration(src, 'attDate', 'index.html'),
  extractDeclaration(src, 'PAY_BASES', 'index.html'),
  extractDeclaration(src, 'WAGE_DAYS_PER_WEEK', 'index.html'),
  extractDeclaration(src, 'WAGE_DAYS_PER_FORTNIGHT', 'index.html'),
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
  lsGet: (k) => store[k],
  lsSet: (k, v) => { store[k] = v; },
  closeModal: () => {},
  // The calendar's month navigation redraws on the way out. Nothing here
  // has a DOM, and what is being tested is where it LANDS, not what it draws.
  renderAttendance: () => {},
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
  t.check(/'loans','rentAgreements','dues','media','mediaFolders','waPosts','stock','stockLots','cashDays'\]\.filter\(k=> !data\[k\]\);/.test(code),
    'and an absent dues collection is refused from the sync, not read as empty');
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

/* ---------- 10. the reminder ---------------------------------------- *
 * The point is not to be told, it is to be able to act while being told,
 * so the payment and its cash-book entry are both written from the
 * reminder -- the same shape as the loan one.
 */
{
  reset([staff('S1', 'Musa', 'monthly', 450000), staff('S2', 'Okello', 'daily', 15000)],
    [rent(1, 'Main shop', 800000, 1, '2026-07')]);
  scope.generateDuesForPeriod('2026-07');   // rent due 1 Jul, wages 31 Jul
  scope.generateDuesForPeriod('2026-08');   // rent due 1 Aug, wages 31 Aug

  const asked = scope.duesNeedingPayment().map((d) => `${scope.dueName(d)} ${d.period}`);

  /* A day wider than overdue: rent due TODAY is not late, but a reminder
     that only speaks once you are already late was too slow to be
     useful. */
  eq(asked.length, 3, 'everything whose date has arrived and is still unpaid');
  t.check(asked.includes('Main shop 2026-07') && asked.includes('Musa 2026-07')
    && asked.includes('Main shop 2026-08'), 'the two late rents and last month\'s wage');
  t.check(!asked.includes('Musa 2026-08'),
    'but not this month\'s wage, which is not due until the month is worked');

  /* An uncosted month cannot be asked about: there is no figure to pay,
     and a reminder that cannot say how much is noise. The payroll screen
     counts them separately instead. */
  t.check(!asked.some((a) => /Okello/.test(a)),
    'and never an uncosted month, which has no amount to ask for');

  // Due today counts, so the last of the month raises the whole payroll.
  eq(scope.duesNeedingPayment('2026-08-31')
    .filter((d) => scope.dueName(d) === 'Musa' && d.period === '2026-08').length, 1,
    'on the day wages fall due they are asked about, not the day after');

  // Paying settles it and it stops being asked about.
  const rentJul = scope.duesNeedingPayment()[0];
  scope.payDue(rentJul.id, 800000, 'momo');
  eq(scope.duesNeedingPayment().length, 2, 'a settled month drops off the list');
  eq(cashAdded[cashAdded.length - 1].account, 'momo',
    'and the account it was paid from is carried through, not assumed to be cash');
}

/* ---------- 11. snoozing -------------------------------------------- *
 * "Remind me tomorrow" has to mean the REST OF TODAY is quiet, and has
 * to mean tomorrow rather than never. The loan reminder shipped with >
 * here, wrote today, compared today > today, and came straight back.
 */
{
  delete store.owDuesSnoozedThrough;
  t.check(!scope.duesSnoozed('2026-08-04'), 'nothing is snoozed to begin with');

  scope.snoozeDues();
  eq(store.owDuesSnoozedThrough, '2026-08-04', 'snoozing records today as the last day suppressed');
  t.check(scope.duesSnoozed('2026-08-04'),
    'so the rest of today is quiet — the comparison is >= and not >');
  t.check(!scope.duesSnoozed('2026-08-05'),
    'and tomorrow it is back, so a snooze can never become "never remind me again"');

  // Its own key, so quietening the rent does not also quieten the loans.
  t.check(/const DUES_SNOOZE_KEY = 'owDuesSnoozedThrough'/.test(code)
    && /const LOAN_DUE_SNOOZE_KEY = 'owLoanDueSnoozedThrough'/.test(code),
    'and it snoozes on its own key, separate from the loan reminder');
}

/* ---------- 12. two reminders on one morning ------------------------ *
 * A loan instalment and last month's rent can both be true. Stacking two
 * modals hides one behind the other; showing only the first would make
 * the second wait a day.
 */
{
  /* The morning brief runs ahead of them, but it NAVIGATES (to the
     dashboard) rather than opening a modal — so it takes no slot in
     this queue and the two reminders still relay exactly as before. */
  t.check(/maybeShowMorningBrief\(\);\s*\n\s*if\(maybeRemindLoanDue\(\)\) return;\s*\n\s*maybeRemindDuesDue\(\);/.test(code),
    'they queue rather than stack — only one modal is opened at a time');
  /* Anchored on the line inside the loan reminder, not on the function
     wrapper: `maybeRemindLoanDue(){ [\s\S]*? return true; }` matched with
     the loan one returning false, because the lazy span ran on into
     maybeRemindDuesDue, which ends the same way. */
  t.check(/openModal\('loanDueModal'\);\s*\n\s*return true;/.test(code),
    'which works because the first one reports whether it took the screen');

  /* And dismissing the one in front brings the next up, so rent that is
     already late does not wait until tomorrow. BOTH ways out of the loan
     modal have to do it, or snoozing the loan buries the rent. */
  t.check(/loanDueClose'\)\.addEventListener\('click', \(\)=>\{ closeModal\('loanDueModal'\); maybeRemindDuesDue\(\); \}\);/.test(code),
    'closing the loan reminder brings the next one up');
  t.check(/loanDueSnooze'\)\.addEventListener\('click', \(\)=>\{ snoozeLoanDue\(\); maybeRemindDuesDue\(\); \}\);/.test(code),
    'and so does snoozing it, or snoozing loans would bury the rent behind them');

  t.check(/runStartupReminders\(\);/.test(code),
    'and boot calls the queue rather than one reminder directly');

  // Never over an empty list, and never when snoozed.
  const fn = (/function maybeRemindDuesDue[\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(/if\(!\(data\.dues\|\|\[\]\)\.length\) return false;/.test(fn), 'it stays shut when there are no dues at all');
  t.check(/if\(duesSnoozed\(\)\) return false;/.test(fn), 'and when it has been snoozed');
  t.check(/if\(!duesNeedingPayment\(\)\.length\) return false;/.test(fn), 'and when nothing has fallen due');
}

/* ---------- 13. paying from the reminder ---------------------------- */
{
  const fn = (/async function payDueFromReminder[\s\S]*?\n\}/.exec(code) || [''])[0];
  /* Offered, not imposed: a shop that can only manage part of somebody's
     wages should be able to record what it actually paid. */
  t.check(/prompt\(`How much are you paying/.test(fn), 'the amount is offered rather than imposed');
  /* Asked, not assumed. Wages paid by mobile money and logged against the
     cash drawer leave both accounts wrong by the same amount, and the day
     fails to reconcile with nothing on screen to say why. */
  t.check(/await promptCashAccount\(/.test(fn), 'and which account it came out of is asked, not assumed');
  t.check(/const left = renderDuesDueModal\(\);/.test(fn) && /if\(!left\.length\) closeModal/.test(fn),
    'the list is re-read after paying, so a part payment leaves the reminder up rather than closing on one that did not cover it');

  /* The payroll screen asks the same question rather than defaulting --
     but it no longer asks it in a dialog. openDuePayment was a prompt()
     for the amount followed by promptCashAccount() for the account: two
     browser dialogs to write a Cash Book entry. Both are now one panel
     inside the month's own row, and the account is offered by the same
     cashAccountChoices() that fills the dialog -- with each account's
     balance on the choice, and what is short marked, which the dialog
     could only do after the amount had already been typed and accepted.
     What is pinned is unchanged: the account is ASKED, never assumed. */
  const screen = (/const payPanel = \(prPayId === r\.id\)[\s\S]*?\n    \}\)\(\) : '';/.exec(code) || [''])[0];
  t.check(/cashAccountChoices\(\{amount, outgoing:true\}\)/.test(screen) && /Out of which account/.test(screen),
    'and the payroll screen asks it too rather than hard-coding the cash drawer');
  t.check(/const account = prPayAccount \|\| \(accounts\.find\(a=> !a\.short\) \|\| accounts\[0\] \|\| \{\}\)\.key;/.test(code),
    'and what it pays out of is what was chosen, never the drawer by default');
}

/* ---------- 14. reaching the cash book and the statements ----------- *
 * Paying already went through addCashPayment under categories the income
 * statement's cashIsOperatingExpense accepts, so the COST reached the
 * P&L from the start. What was owed and not yet paid reached nothing:
 * the balance sheet counted suppliers and loans and left the staff and
 * the landlord out entirely, overstating what the shop was worth by
 * exactly what it owed its own people.
 */
{
  t.check(/cashCategory:'Rent'/.test(code) && /cashCategory:'Salaries & Wages'/.test(code),
    'payments carry the categories the income statement already treats as running costs');

  /* The sheet takes a date now, so the call is the as-at variant. What
     is guarded is unchanged: the sheet asks what is owed to staff and
     the landlord rather than counting only suppliers. */
  const bs = (/function balanceSheetAsAt[\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(/const staffAndRent = duesOwedAsAt\(asOf\);/.test(bs),
    'the balance sheet asks what is owed to staff and the landlord');
  t.check(/const liabilities = payables \+ loans \+ staffAndRent\.total \+ accruedCosts\.total;/.test(bs),
    'and it is inside total liabilities, not merely reported beside them');
  t.check(/staffAndRent: staffAndRent\.total/.test(bs),
    'on its own line, since a supplier, a member of staff and a landlord are three different creditors');

  t.check(/const currentLiabilities = bs\.payables \+ bs\.staffAndRent \+ shortTermLoans \+ \(bs\.loanCharges\|\|0\) \+ \(bs\.accruedCosts\|\|0\);/.test(code),
    'and in current liabilities, because wages are due within the month rather than the year');

  /* The dashboard's working-capital gap is what somebody glances at
     before deciding whether the week is affordable. Computed against
     suppliers alone it read better than the shop's week actually was. */
  t.check(/const totalCreditors = dashTotalCreditors\(\) \+ owedToStaffAndLandlord;/.test(code),
    'the working capital gap counts what is owed to staff as well as to suppliers');
  t.check(/const owedToStaffAndLandlord = duesOwedTotal\(\);/.test(code),
    'reading the same figure the balance sheet reads, rather than adding it up a second way');

  /* The basis is named on the sheet rather than left to be discovered.
     It used to name a MIXED basis -- liability when due, cost when paid
     -- and that stopped being true when the profit and loss began
     charging rent and wages to the days they are for. The sheet follows
     the same rule now, with the days paid for and not yet reached as an
     asset, and says so. */
  t.check(/Wages and rent owed are the months already worked or occupied and not yet paid; paid in advance is the days already paid for and not yet reached/.test(code),
    'and the sheet says out loud that the liability and the asset follow the rule the profit and loss charges on');
  /* The Performance hub draws the sheet from row objects (shStatement),
     so the line is matched as a row labelled for it carrying bs.prepaid. */
  t.check(/stLine\('Paid in advance', bs\.prepaid/.test(code)
    || /label:'Paid in advance'[^}]*cur: bs\.prepaid/.test(code),
    'with the days paid for in advance on their own line');
}

/* ---------- deleting a worker deletes their ghost wages -------------
 * A wage due is a demand addressed to a person. Delete the person and a
 * due with NOTHING paid must go too, or the payroll dunns the shop for a
 * ghost every month (learned live: "its asking me to pay salary to a
 * worker i deleted"). But a month with money already recorded against it
 * stays -- it explains cash that actually left, the same way a deleted
 * rent agreement keeps its raised months.
 */
{
  const confirms = [];
  const dsData = { staff: [], dues: [], savedQuotes: [] };
  const dsScope = compileScope([
    /* deleteStaff releases the collection trips the departing worker
       was sent on, the same way it releases their orders. */
    extractFunction(read('shared-worker.js'), 'tripIsLive', 'shared-worker.js'),
    extractFunction(src, 'releaseTripsForStaff', 'index.html'),
    extractFunction(src, 'deleteStaff', 'index.html')], {
    data: dsData,
    confirm: (m) => { confirms.push(String(m)); return true; },
    saveData: () => {}, renderStaff: () => {}, toast: () => {},
    refreshAdminOrderBoardIfOpen: () => {}, resetPickingProgress: () => {},
  }, ['deleteStaff']);

  dsData.staff = [ staff('W1', 'Departing Dan', 'monthly', 300000),
                   staff('W2', 'Staying Sam', 'monthly', 250000) ];
  dsData.dues = [
    { id: 1, kind: 'wage', refId: 'W1', period: '2026-08', amount: 300000, paid: 0, payments: [] },
    { id: 2, kind: 'wage', refId: 'W1', period: '2026-07', amount: 300000, paid: 100000,
      payments: [{ amount: 100000 }] },
    { id: 3, kind: 'wage', refId: 'W2', period: '2026-08', amount: 250000, paid: 0, payments: [] },
    { id: 4, kind: 'rent', refId: 'W1', period: '2026-08', amount: 500000, paid: 0, payments: [] },
  ];
  dsScope.deleteStaff('W1');

  eq(dsData.staff.length, 1, 'the worker is gone');
  eq(dsData.dues.find((d) => d.id === 1), undefined, 'their unpaid wage month goes with them');
  t.check(!!dsData.dues.find((d) => d.id === 2), 'a month with money recorded stays on record');
  t.check(!!dsData.dues.find((d) => d.id === 3), 'the other worker\'s wage is untouched');
  t.check(!!dsData.dues.find((d) => d.id === 4), 'a rent due that merely shares the id is not a wage and stays');
  t.check(/1 unpaid wage month raised for them comes off the payroll/.test(confirms[0] || ''),
    'and the confirm says the ghost wage goes');
  t.check(/months with money already recorded stay on record/.test(confirms[0] || ''),
    'and that the part-paid month stays');

  /* The payroll screen heals dues orphaned BEFORE deleteStaff learned
     this: a wage addressed to nobody with nothing paid gets Remove
     instead of Pay, so a shop that hit the old bug is not stuck with a
     demand no button can dismiss. A part-paid orphan keeps Pay -- the
     shop may genuinely owe a departed worker the balance. */
  /* The test is the same fact read off the console: `orphanGhost`, a
     local computed per row inside the old table renderer, is now
     `orphan` on the row object payrollRow() builds -- one place, read by
     the row, the open body and the rail alike. The condition is
     unchanged to the character. */
  t.check(/orphan: d\.kind === 'wage' && !staff && !\(Number\(d\.paid\)\|\|0\) && !\(d\.payments\|\|\[\]\)\.length,/.test(src),
    'an orphan ghost is a wage for a missing worker with no money recorded');
  t.check(/\$\{r\.orphan\s*\n?\s*\? `<button type="button" class="btn btn-ghost ow-sm pr-orphan-del"/.test(src),
    'and it is offered Remove where every real wage is offered Pay');
  const orphanHandler = (/querySelectorAll\('\.pr-orphan-del'\)\.forEach\(btn=> btn\.addEventListener\('click', \(\)=>\{([\s\S]*?)\}\)\);/.exec(src) || ['', ''])[1];
  t.check(/if\(!confirm\(/.test(orphanHandler) && /data\.dues = data\.dues\.filter\(x=> x\.id !== d\.id\);/.test(orphanHandler)
    && /saveData\(\)/.test(orphanHandler),
    'Remove asks first, then deletes the due and saves so the delete syncs');
}

/* ---------- 11. days missed ----------------------------------------
 *
 * A month of wages was raised at the full rate whether or not the person
 * turned up, so somebody who missed three days was paid exactly as much
 * as somebody who missed none.
 *
 * THE TRAP HERE IS DOUBLE-DOCKING. A daily-paid month is costed from the
 * days somebody COUNTED, so the days not worked were never in the figure
 * -- deducting them again would take the money off twice, and the person
 * losing it would have no way to see that it had happened.
 */
{
  reset([staff('S1', 'Monthly Musa', 'monthly', 600000),
    staff('S2', 'Daily Okello', 'daily', 15000),
    staff('S3', 'Half-set Peter', 'monthly', null)], []);
  scope.generateDuesForPeriod('2026-08');
  const musa = wageFor('Monthly Musa');
  const okello = wageFor('Daily Okello');
  const peter = wageFor('Half-set Peter');

  t.check(/const WAGE_DAYS_PER_MONTH = 30;/.test(src), 'a month is 30 days');
  eq(scope.dueDayRate(musa), 20000, 'so a 600,000 salary is 20,000 a day');
  /* Deliberately not the length of the calendar month: the same absence
     must not cost more in February than in July. */
  reset([staff('S1', 'Monthly Musa', 'monthly', 600000)], []);
  scope.generateDuesForPeriod('2026-02');
  eq(scope.dueDayRate(wageFor('Monthly Musa')), 20000,
    'and 20,000 a day in February too, not 21,429');

  reset([staff('S1', 'Monthly Musa', 'monthly', 600000),
    staff('S2', 'Daily Okello', 'daily', 15000),
    staff('S3', 'Half-set Peter', 'monthly', null)], []);
  scope.generateDuesForPeriod('2026-08');
  const m = wageFor('Monthly Musa');
  const o = wageFor('Daily Okello');
  const p3 = wageFor('Half-set Peter');

  eq(m.basis, 'monthly', 'the basis is snapshot onto the due when it is raised');
  eq(o.basis, 'daily', 'for a daily worker too');

  eq(m.amount, 600000, 'a monthly month starts at the whole salary');
  scope.addDueAbsence(m.id, '2026-08-03', 'Absent', false);
  eq(m.amount, 580000, 'one unpaid day off a 600,000 salary leaves 580,000');
  scope.addDueAbsence(m.id, '2026-08-04', 'Absent', false);
  eq(m.amount, 560000, 'two unpaid days off a 600,000 salary is 40,000 off');
  eq(scope.dueDeduction(m), 40000, 'and the deduction says so');
  eq(scope.dueBalance(m), 560000, 'what is owed follows the net, not the salary');

  /* A paid day is RECORDED but costs nothing. The shop wants to know it
     happened; the worker does not lose money for it. */
  scope.addDueAbsence(m.id, '2026-08-02', 'Sick', true);
  eq(scope.dueAbsences(m).length, 3, 'a paid day is still recorded');
  eq(m.amount, 560000, 'but takes nothing off the pay');
  eq(scope.dueUnpaidAbsenceDays(m), 2, 'only the unpaid days are deducted');

  scope.setDueAbsencePaid(m.id, '2026-08-03', true);
  eq(m.amount, 580000, 'turning an absence into paid leave puts the day back');
  scope.setDueAbsencePaid(m.id, '2026-08-03', false);
  eq(m.amount, 560000, 'and turning it back takes it off again');

  scope.removeDueAbsence(m.id, '2026-08-04');
  eq(m.amount, 580000, 'removing a day recosts the month');
  eq(scope.dueAbsences(m).length, 2, 'and takes it off the list');

  /* ---- the double-dock trap ---- */
  scope.setDueDays(o.id, 22);
  eq(o.amount, 330000, 'a daily month is costed from the days counted');
  scope.addDueAbsence(o.id, '2026-08-03', 'Absent', false);
  scope.addDueAbsence(o.id, '2026-08-04', 'Absent', false);
  eq(scope.dueAbsences(o).length, 2, 'a daily worker\'s missed days are recorded');
  eq(scope.dueDeduction(o), 0, 'but deduct NOTHING — they were never counted in');
  eq(o.amount, 330000, 'so the month still costs the days that were worked');
  scope.setDueDays(o.id, 20);
  eq(o.amount, 300000, 'and counting fewer days is still the only thing that changes it');
  scope.setDueDays(o.id, '');
  t.check(o.amount === null,
    'clearing the days puts the month back to uncosted, absences or not');

  /* Somebody with no salary agreed. Deducting from an unknown would turn
     "we do not know what this costs" into a confident zero -- the one
     mistake this screen exists to avoid. */
  scope.addDueAbsence(p3.id, '2026-08-03', 'Absent', false);
  t.check(p3.amount === null,
    'days missed do not cost a month whose salary nobody has agreed');
  eq(scope.dueAbsences(p3).length, 1, 'the days are still recorded against it');

  /* ---- what will not go on the list ---- */
  const dup = scope.addDueAbsence(m.id, '2026-08-03', 'Absent', false);
  t.check(!!(dup && dup.error), 'the same day cannot be recorded twice');
  eq(scope.dueAbsences(m).length, 2, 'so two people on payday cannot dock it twice over');
  const outside = scope.addDueAbsence(m.id, '2026-07-30', 'Absent', false);
  t.check(!!(outside && outside.error), 'a day outside the month is refused');
  const future = scope.addDueAbsence(m.id, '2026-08-30', 'Absent', false);
  t.check(!!(future && future.error), 'and so is a day that has not happened yet');
  eq(scope.dueAbsences(m).length, 2, 'none of them landed');

  const rentDue = { id: 999, kind: 'rent', refId: '1', period: '2026-08', amount: 800000, rate: 800000, paid: 0 };
  data.dues.push(rentDue);
  const onRent = scope.addDueAbsence(999, '2026-08-03', 'Absent', false);
  t.check(!!(onRent && onRent.error), 'premises are not absent, so rent takes no days');
  eq(scope.dueDeduction(rentDue), 0, 'and nothing is ever deducted from it');
}

/* ---------- 12. more days missed than the month has ----------------
 * A negative wage is the shop billing its own staff for turning up.
 */
{
  reset([staff('S1', 'Monthly Musa', 'monthly', 600000)], []);
  scope.generateDuesForPeriod('2026-08');
  const m = wageFor('Monthly Musa');
  for (let i = 1; i <= 30; i++) {
    scope.addDueAbsence(m.id, `2026-08-${String(i).padStart(2, '0')}`, 'Absent', false);
  }
  // Only the days up to today can be recorded, and TODAY is the 4th.
  eq(scope.dueAbsences(m).length, 4, 'only days that have happened go on');
  // Force the cap by pricing a month that is entirely missed.
  m.absences = Array.from({ length: 30 }, (_, i) =>
    ({ date: `2026-08-${String(i + 1).padStart(2, '0')}`, reason: 'Absent', paid: false }));
  scope.recostDue(m.id);
  eq(scope.dueDeduction(m), 600000, 'the deduction stops at the whole salary');
  eq(m.amount, 0, 'so the month costs nothing');
  t.check(m.amount >= 0, 'and never less than nothing — nobody is billed for working here');
}

/* ---------- 13. an absence recorded after the money went out --------
 * dueBalance floors at zero, so the row would read "Paid" while the shop
 * was genuinely owed money back. Reported, never corrected on its own:
 * taking it off next month, asking for it back, or writing it off are
 * all the shop's call.
 */
{
  reset([staff('S1', 'Monthly Musa', 'monthly', 600000)], []);
  scope.generateDuesForPeriod('2026-08');
  const m = wageFor('Monthly Musa');
  scope.payDue(m.id, 600000, 'cash', '2026-08-31');
  t.check(scope.dueIsSettled(m), 'the month is paid in full');
  eq(scope.dueOverpaid(m), 0, 'and nothing is over');

  scope.addDueAbsence(m.id, '2026-08-03', 'Absent', false);
  eq(m.amount, 580000, 'the month is recosted downwards');
  eq(scope.dueBalance(m), 0, 'the balance still floors at zero');
  eq(scope.dueOverpaid(m), 20000, 'so the overpayment is what says 20,000 went out too much');

  const pos = scope.payrollPosition('2026-08');
  eq(pos.overpaid, 20000, 'the month reports it');
  eq(pos.overpaidCount, 1, 'and how many months it is spread across');
  /* The state pill is gone: it repeated what the balance column had
     already said -- 0 owed reads "Paid", a past date reads "Late" -- on
     every row, which is a device that marks everything and so marks
     nothing. The one state that was genuinely extra information is the
     one that survives, in the column that says why a month is where it
     is, in crimson and carrying the figure the shop is owed back. */
  t.check(/return \{tone:'ow-bad', head:`Overpaid \$\{f\(r\.over\)\}`, sub:'owed back to the shop'\};/.test(src),
    'the row is marked Overpaid rather than reading as a settled month');

  scope.reverseDuePayment(m.id, 0);
  eq(scope.dueOverpaid(m), 0, 'reversing the payment clears it');
  eq(scope.dueBalance(m), 580000, 'and the net month is owed again');
}

/* ---------- 14. what the screen totals ------------------------------ */
{
  reset([staff('S1', 'Monthly Musa', 'monthly', 600000),
    staff('S2', 'Monthly Grace', 'monthly', 300000),
    staff('S3', 'Daily Okello', 'daily', 15000)], []);
  scope.generateDuesForPeriod('2026-08');
  const m = wageFor('Monthly Musa');
  const g = wageFor('Monthly Grace');
  const o = wageFor('Daily Okello');
  scope.setDueDays(o.id, 22);
  scope.addDueAbsence(m.id, '2026-08-03', 'Absent', false);
  scope.addDueAbsence(m.id, '2026-08-04', 'Sick', true);
  scope.addDueAbsence(g.id, '2026-08-03', 'Absent', false);
  scope.addDueAbsence(o.id, '2026-08-03', 'Absent', false);

  const pos = scope.payrollPosition('2026-08');
  eq(pos.absenceDays, 4, 'every recorded day is counted, paid or not, daily or monthly');
  eq(pos.unpaidAbsenceDays, 3, 'the unpaid ones are counted apart');
  eq(pos.absentCount, 3, 'across three people');
  eq(pos.deducted, 20000 + 10000, 'only the monthly unpaid days cost anything');
  /* `known` is already NET. This is the line that catches the deduction
     being applied twice -- once when the month is costed and again when
     the screen adds up. */
  eq(pos.known, 580000 + 290000 + 330000,
    'and the payroll total is the net of every month, deducted exactly once');
  eq(pos.owed, pos.known, 'with nothing paid yet, all of it is owed');
}

/* ---------- 15. a raise, and a change of basis ----------------------
 * The rate is snapshot onto the due so a raise in September does not
 * rewrite August. The BASIS has to be snapshot for the same reason:
 * moving somebody onto a salary must not change how August's absences
 * were priced, nor take away the days box that costed it.
 */
{
  reset([staff('S1', 'Daily Okello', 'daily', 15000)], []);
  scope.generateDuesForPeriod('2026-08');
  const aug = wageFor('Daily Okello');
  scope.setDueDays(aug.id, 22);
  scope.addDueAbsence(aug.id, '2026-08-03', 'Absent', false);
  eq(aug.amount, 330000, 'August is costed at the day rate');
  eq(scope.dueDeduction(aug), 0, 'and deducts nothing for the day missed');

  // Put them on a salary.
  data.staff[0].payBasis = 'monthly';
  data.staff[0].payRate = 600000;
  eq(scope.dueBasis(aug), 'daily', 'August is still a daily month');
  scope.recostDue(aug.id);
  eq(aug.amount, 330000, 'so recosting it does not price it as a salary');
  eq(scope.dueDeduction(aug), 0, 'and its missed day still costs nothing');

  /* A due raised before the basis was stored has none. It falls back to
     the staff member, so a shop that upgrades mid-month is not left with
     every old month mispriced. */
  delete aug.basis;
  eq(scope.dueBasis(aug), 'monthly', 'an older due with no basis asks the staff member');
  data.staff = [];
  eq(scope.dueBasis(aug), 'monthly',
    'and a due whose worker was deleted falls back to monthly, not to uncosted');
}

/* ---------- 16. the daily register ---------------------------------
 *
 * The payroll screen asks what the month cost, which is answered on
 * payday with four weeks to reconstruct. This asks who is in today.
 *
 * ONE SET OF ROWS. There is no separate attendance record: marking
 * somebody absent here IS an absence on their wage month. Two stores
 * would be two figures to reconcile, and the shop would find out they
 * disagreed on the day it paid somebody the wrong amount.
 */
{
  reset([staff('S1', 'Amos Kato', 'monthly', 600000),
    staff('S2', 'Okello Denis', 'daily', 15000),
    staff('S3', 'Unset Joan', null, null)], []);

  eq(scope.staffAttendanceOn('S1', '2026-08-03').state, 'present',
    'somebody nobody has said anything about is present');
  t.check(!data.dues.length, 'and asking does not raise a month');

  scope.setStaffAttendance('S1', '2026-08-03', 'absent');
  eq(data.dues.length, 1, 'marking somebody absent raises the wage month it belongs to');
  const wage = data.dues[0];
  eq(wage.kind, 'wage', 'a wage');
  eq(wage.period, '2026-08', 'for the month the day falls in');
  /* And ONLY the wage. Raising the month wholesale would put that
     month's RENT on the balance sheet as a side effect of saying
     somebody did not come in on Tuesday. */
  t.check(!data.dues.some((d) => d.kind === 'rent'),
    'and does NOT raise that month\'s rent as a side effect');

  eq(scope.staffAttendanceOn('S1', '2026-08-03').state, 'absent', 'the day reads back as absent');
  eq(wage.amount, 580000, 'and the month is costed 20,000 lighter');
  eq(scope.dueAbsences(wage)[0].reason, 'Absent', 'recorded as a plain absence');

  /* Present is the ABSENCE OF A ROW. The shop records exceptions; a
     "present" row for everybody every day would be a thousand rows a
     year saying nothing happened. */
  scope.setStaffAttendance('S1', '2026-08-03', 'present');
  eq(scope.dueAbsences(wage).length, 0, 'marking them back in removes the row rather than adding one');
  eq(wage.amount, 600000, 'and the whole salary is owed again');

  scope.setStaffAttendance('S1', '2026-08-03', 'paid');
  eq(scope.staffAttendanceOn('S1', '2026-08-03').state, 'paid', 'paid leave is its own state');
  eq(scope.dueAbsences(wage).length, 1, 'it is recorded');
  eq(wage.amount, 600000, 'but costs them nothing');

  /* A reason typed on the payroll screen SURVIVES a change of state
     here. Overwriting "Sick" with the default would quietly lose why
     the day was missed. */
  scope.dueAbsences(wage)[0].reason = 'Sick';
  scope.setStaffAttendance('S1', '2026-08-03', 'absent');
  eq(scope.dueAbsences(wage)[0].reason, 'Sick', 'and the reason already on the day is kept');
  eq(wage.amount, 580000, 'while the state itself changes');

  // Somebody with no pay basis has no wage to dock and nothing to write against.
  const unset = scope.setStaffAttendance('S3', '2026-08-03', 'absent');
  t.check(!!(unset && unset.error), 'somebody not on the payroll cannot be marked absent');
  eq(data.dues.length, 1, 'and no month is raised for them');

  const tomorrow = scope.setStaffAttendance('S1', '2026-08-05', 'absent');
  t.check(!!(tomorrow && tomorrow.error), 'and no register can be taken for a day that has not happened');
}

/* ---------- 17. the register and the payroll screen agree ----------
 * The two screens are two questions about the same rows. If they ever
 * disagree, one of them is lying about somebody's pay.
 */
{
  reset([staff('S1', 'Amos Kato', 'monthly', 600000),
    staff('S2', 'Okello Denis', 'daily', 15000)], []);
  scope.setStaffAttendance('S1', '2026-08-03', 'absent');
  scope.setStaffAttendance('S1', '2026-08-04', 'paid');
  scope.setStaffAttendance('S2', '2026-08-03', 'absent');

  const day = scope.attendanceForDay('2026-08-03');
  eq(day.rows.length, 2, 'the register lists everybody on the payroll');
  eq(day.present, 0, 'nobody was in on the 3rd');
  eq(day.absent, 2, 'both were marked absent');
  eq(day.onLeave, 0, 'and neither was on leave that day');

  const next = scope.attendanceForDay('2026-08-04');
  eq(next.present, 1, 'on the 4th one of them is in');
  eq(next.onLeave, 1, 'and the other is on paid leave');
  eq(next.absent, 0, 'nobody is down as absent');

  // The same rows, read the other way round.
  const pos = scope.payrollPosition('2026-08');
  eq(pos.absenceDays, 3, 'the payroll screen counts every day the register wrote');
  eq(pos.unpaidAbsenceDays, 2, 'and which of them were unpaid');
  eq(pos.deducted, 20000, 'only the monthly unpaid day costs anything');
  eq(scope.dueBalance(wageFor('Amos Kato')), 580000, 'so the salary owed is 20,000 lighter');
  /* The daily worker's absence is on record and costs nothing, exactly
     as it does when it is entered from the payroll screen. */
  t.check(wageFor('Okello Denis').amount === null,
    'and the daily month is still uncosted until somebody counts the days');
  eq(scope.dueAbsences(wageFor('Okello Denis')).length, 1, 'with his missed day on record');

  // Somebody on the staff list with no rate is counted, not shown.
  data.staff.push(staff('S9', 'Unset Joan', null, null));
  eq(scope.attendanceForDay('2026-08-04').rows.length, 2,
    'somebody with no pay basis is left off the register');
  eq(scope.attendanceForDay('2026-08-04').notOnPayroll, 1,
    'but counted, so the panel can say who it is leaving out');
}

/* ---------- 18. the register writes onto a month already raised ----- */
{
  reset([staff('S1', 'Amos Kato', 'monthly', 600000)],
    [rent(1, 'Main shop', 800000, 1, '2026-01')]);
  scope.generateDuesForPeriod('2026-08');
  const raised = data.dues.length;
  const wage = wageFor('Amos Kato');

  scope.setStaffAttendance('S1', '2026-08-03', 'absent');
  eq(data.dues.length, raised, 'a month already raised is written onto, not raised twice');
  eq(scope.dueAbsences(wage).length, 1, 'the day lands on the month that was already there');
  eq(wage.amount, 580000, 'and it is recosted');

  // ensureWageDue is what makes that true, and it is idempotent.
  const again = scope.ensureWageDue('S1', '2026-08');
  eq(again.id, wage.id, 'asking for the month twice returns the same one');
  eq(data.dues.length, raised, 'and raises nothing');
  t.check(scope.ensureWageDue('S404', '2026-08') === null,
    'and a staff member who does not exist raises nothing at all');
}

/* ---------- 19. the month the register is drawn on -----------------
 *
 * The register is a calendar now, and a calendar is arithmetic wearing a
 * grid. Every one of these has an off-by-one waiting in it: the weekday
 * the month starts on decides how many blank squares lead it, and a
 * wrong answer silently shifts every date in the month into the wrong
 * column -- which reads as somebody being absent on a different day.
 */
{
  /* MONDAY IS 0, because the shop week is Monday to Saturday and a grid
     that starts on Sunday puts the rest day in the middle of it. */
  eq(scope.attWeekdayIndex('2026-08-01'), 5, '1 Aug 2026 is a Saturday');
  eq(scope.attWeekdayIndex('2026-07-01'), 2, '1 Jul 2026 is a Wednesday');
  eq(scope.attWeekdayIndex('2026-02-01'), 6, '1 Feb 2026 is a Sunday');
  eq(scope.attWeekdayIndex('2026-06-01'), 0, '1 Jun 2026 is a Monday, the zero case');
  eq(scope.attWeekdayIndex('2024-02-29'), 3, 'and a leap day is a Thursday');

  /* READ AS UTC, NEVER AS LOCAL TIME. new Date('2026-08-01') is UTC
     midnight; asking it for a LOCAL weekday returns the day before
     anywhere west of Greenwich. That is the bug that shifts a whole
     month by one column, and it does not show up in the timezone the
     author happens to be sitting in. */
  const viaLocal = (iso)=> (new Date(iso).getDay() + 6) % 7;
  eq(scope.attWeekdayIndex('2026-08-01'), viaLocal('2026-08-01'),
    'which agrees with the local reading here, and must keep agreeing everywhere');

  /* SATURDAY IS A WORKING DAY. 26 days is six days a week, so only
     Sunday is unpaid. Treating Saturday as a weekend would grey out
     four working days a month on the screen that decides pay. */
  t.check(scope.attIsRestDay('2026-08-02'), 'Sunday is the rest day');
  t.check(!scope.attIsRestDay('2026-08-01'), 'Saturday is NOT — the 26-day month pays for it');
  t.check(!scope.attIsRestDay('2026-08-03'), 'nor is Monday');

  // Month lengths, February included, leap February included.
  eq(scope.attMonthDays('2026-02').length, 28, 'February has 28 days');
  eq(scope.attMonthDays('2024-02').length, 29, 'and 29 in a leap year');
  eq(scope.attMonthDays('2026-04').length, 30, 'April has 30');
  eq(scope.attMonthDays('2026-12').length, 31, 'December has 31');
  eq(scope.attMonthDays('2026-02')[0], '2026-02-01', 'the first day is the 1st, zero-padded');
  eq(scope.attMonthDays('2024-02').slice(-1)[0], '2024-02-29', 'and the last is the last');

  // Every month of a year lines up: leading blanks plus days is a whole
  // number of weeks' worth of columns, and no month is short or long.
  let bad = 0;
  for(let m=1;m<=12;m++){
    const p = `2026-${String(m).padStart(2,'0')}`;
    const days = scope.attMonthDays(p);
    if(days.length < 28 || days.length > 31) bad++;
    if(days[0] !== `${p}-01`) bad++;
    // Consecutive days must be consecutive weekday indices, wrapping at 7.
    for(let i=1;i<days.length;i++){
      if(scope.attWeekdayIndex(days[i]) !== (scope.attWeekdayIndex(days[i-1]) + 1) % 7) bad++;
    }
  }
  eq(bad, 0, 'and every month of a year runs Monday to Sunday without a gap or a repeat');
}

/* ---------- 20. stepping between months ----------------------------
 * The selected day travels with the month rather than being cleared, so
 * stepping back and forward lands where you were looking. Two ways that
 * goes wrong: the 31st of a 30-day month, and any day after today.
 */
{
  eq(scope.periodShift('2026-12', 1), '2027-01', 'December steps into next January');
  eq(scope.periodShift('2026-01', -1), '2025-12', 'and January steps back into last December');

  // TODAY is 2026-08-04 in this file.
  scope.goToAttMonth('2026-01');
  const jan = scope.currentAttDate();
  t.check(jan.startsWith('2026-01'), 'stepping to a month lands inside it');

  /* Picking a day refuses one that has not happened. The grid renders
     those disabled, but the guard lives here too -- the button carries
     it for the mouse, this carries it for everything else. */
  scope.selectAttDate('2026-01-31');
  eq(scope.currentAttDate(), '2026-01-31', 'a past day can be picked');
  scope.selectAttDate('2026-09-01');
  eq(scope.currentAttDate(), '2026-01-31', 'a future one is refused and leaves the pick alone');
  scope.selectAttDate('');
  eq(scope.currentAttDate(), '2026-01-31', 'and so is nothing at all');

  /* THE 31st OF FEBRUARY. Carrying the day-of-month across without
     checking produces a date that does not exist, which every later
     lookup then silently fails to match. */
  scope.goToAttMonth('2026-02');
  eq(scope.currentAttDate(), '2026-02-28',
    'a 31st carried into February lands on the 28th rather than on a day that does not exist');
  eq(scope.currentAttMonth(), '2026-02', 'and the month shown is February');

  scope.selectAttDate('2024-01-31');
  scope.goToAttMonth('2024-02');
  eq(scope.currentAttDate(), '2024-02-29', 'and in a leap year it lands on the 29th');

  /* NEVER INTO THE FUTURE. Stepping forward into the current month from
     a 31st would otherwise select a day that has not happened, and the
     editor would offer to mark somebody absent on it. */
  scope.selectAttDate('2026-07-31');
  scope.goToAttMonth('2026-08');
  eq(scope.currentAttDate(), TODAY,
    'stepping into this month cannot land past today');

  const before = scope.currentAttDate();
  scope.goToAttMonth('2026-09');
  eq(scope.currentAttDate(), before, 'and next month is refused outright');
}

/* ---------- 21. paid by the week -----------------------------------
 *
 * "add a weekly rate, because we have some workers we pay every after
 * two weeks". The RATE is a week; the shop hands over two weeks at a
 * time. Those are different facts and the app has to hold both.
 *
 * SIX DAYS TO THE WEEK, AND SO 26 TO THE MONTH. The two constants are
 * one fact stated twice. If they ever drift, a weekly worker's month
 * stops agreeing with a monthly worker's, and the same missed day costs
 * two different amounts depending on how somebody's pay was written up.
 */
{
  t.check(/const WAGE_DAYS_PER_WEEK = 7;/.test(src), 'a week is seven days');
  /* Read from the MONTH, not the week. Two weeks of seven is 14/30 of
     a month, which is nearly-but-not-quite half -- and a shop paying
     twice a month pays half each time. Derived either way, so it cannot
     be typed out of step with what it halves. */
  t.check(/const WAGE_DAYS_PER_FORTNIGHT = WAGE_DAYS_PER_MONTH \/ 2;/.test(src),
    'and a fortnight is half the month, derived rather than typed again');
  eq(scope.basisDayRate('monthly', 300000) * 15 * 2, 300000,
    'so twice the fortnight is exactly the month — the arithmetic a payday has to survive');

  // 70,000 a week -> 10,000 a day -> 300,000 a month.
  eq(scope.basisDayRate('weekly', 70000), 10000, 'a weekly rate divides by seven to give a day');
  eq(scope.basisMonthCost('weekly', 70000), 300000, 'and a month is that day across 30 of them');
  eq(scope.basisDayRate('monthly', 300000), 10000,
    'which is the SAME day rate a 300,000 salary gives — the two bases agree');
  eq(scope.basisDayRate('daily', 10000), 10000, 'a daily rate is already a day');

  /* A MONTHLY SALARY IS RETURNED AS ITSELF, not as its day rate times
     26. Those are equal in arithmetic and not in floating point --
     400000/26*26 is 400000.00000000006 -- and a salary that will not
     compare equal to itself reports a settled month as owing a fraction
     of a shilling for ever. */
  eq(scope.basisMonthCost('monthly', 400000), 400000,
    'a monthly salary comes back exactly, not through a division and a multiplication');
  /* The figure the shop asked for, stated as arithmetic: a 320,000 month
     paid every second week is 160,000 a time. Under the 26-day month it
     was 147,692, which is not half of anything and had to be explained
     every payday. */
  eq(scope.basisDayRate('monthly', 320000) * 15, 160000,
    'and half a 320,000 month is 160,000 — what the shop counts out');
  t.check(scope.basisMonthCost('daily', 15000) === null,
    'a daily rate has no month — what it costs follows the days worked');
  t.check(scope.basisMonthCost('weekly', null) === null, 'and no rate has no month either');
}

/* ---------- 22. a weekly month, and days missed from it ------------- */
{
  reset([staff('S1', 'Weekly Wasswa', 'weekly', 70000),
    staff('S2', 'Monthly Musa', 'monthly', 300000),
    staff('S3', 'Daily Okello', 'daily', 15000)], []);
  scope.generateDuesForPeriod('2026-08');

  const w = wageFor('Weekly Wasswa');
  eq(w.basis, 'weekly', 'the basis is snapshot onto the due like any other');
  eq(w.rate, 70000, 'and the rate stored is the WEEK, as it was agreed');
  eq(w.amount, 300000, 'but the month is raised costed, at what the week comes to over 30 days');
  eq(scope.dueGross(w), 300000, 'the gross is the month, not the week');
  eq(scope.dueDayRate(w), 10000, 'a day is a seventh of the week');
  eq(scope.dueFortnight(w), 150000, 'and a fortnight is half the month — what the shop hands over');

  /* A WEEKLY MONTH DEDUCTS. It is known up front, exactly like a salary,
     so a day missed comes off it. Only the daily basis is exempt, and
     only because its days were never counted in. */
  scope.addDueAbsence(w.id, '2026-08-03', 'Absent', false);
  eq(scope.dueDeduction(w), 10000, 'one unpaid day off a weekly month costs a day');
  eq(w.amount, 290000, 'and the month is recosted');
  scope.addDueAbsence(w.id, '2026-08-04', 'Sick', true);
  eq(w.amount, 290000, 'a paid day is recorded and costs nothing, same as anywhere else');

  // The two bases agree about the same absence.
  scope.addDueAbsence(wageFor('Monthly Musa').id, '2026-08-03', 'Absent', false);
  eq(scope.dueDeduction(wageFor('Monthly Musa')), 10000,
    'and a monthly worker on the same money loses exactly the same for the same day');
  eq(wageFor('Monthly Musa').amount, 290000, 'down to the shilling');

  /* THE CAP IS THE MONTH, NOT THE WEEK. Reading d.rate as the ceiling
     would stop docking a weekly worker after six days -- a sixth of what
     the month is worth -- and quietly pay them for the rest of it. */
  const o = wageFor('Weekly Wasswa');
  o.absences = Array.from({ length: 40 }, (_, i) => {
    // Every day August has. Twenty-eight was enough to overrun a 26-day
    // month and is not enough to overrun a 30-day one — the fixture has
    // to out-miss the month, or it stops testing the cap at all.
    const d = String((i % 31) + 1).padStart(2, '0');
    return { date: `2026-08-${d}`, reason: 'Absent', paid: false };
  }).filter((a, i, arr) => arr.findIndex((x) => x.date === a.date) === i);
  scope.recostDue(o.id);
  eq(scope.dueDeduction(o), 300000, 'more days missed than the month has caps at the whole MONTH');
  eq(o.amount, 0, 'so the month costs nothing, and never less');
}

/* ---------- 23. weekly is on the payroll, and is a committed cost --- */
{
  reset([staff('S1', 'Weekly Wasswa', 'weekly', 70000),
    staff('S2', 'Half-set Peter', 'weekly', null),
    staff('S3', 'Unset Joan', null, null)], []);
  eq(scope.staffOnPayroll().length, 2, 'a weekly worker is on the payroll');
  eq(scope.staffWithoutPayRate().length, 2,
    'and one with no rate agreed is counted as not set up, like any other basis');

  scope.generateDuesForPeriod('2026-08');
  t.check(wageFor('Half-set Peter').amount === null,
    'a weekly month with no rate agreed is raised UNCOSTED, not at zero');
  eq(scope.dueBasis(wageFor('Half-set Peter')), 'weekly', 'with its basis still recorded');

  const pos = scope.payrollPosition('2026-08');
  eq(pos.known, 300000, 'the payroll counts the costed weekly month');
  eq(pos.uncostedCount, 1, 'and reports the one it cannot cost rather than folding it in at nothing');

  /* A weekly wage is a STANDING PROMISE, the same as a salary -- it is
     owed whether or not a thing is sold. Leaving it out of the breakeven
     floor understates what the shop has to cover by a whole wage. */
  eq(scope.basisMonthCost('weekly', 70000), 300000,
    'and the breakeven floor carries it across the month before adding it');
}

/* ---------- 24. an older due, raised before weekly existed ---------- */
{
  reset([staff('S1', 'Weekly Wasswa', 'weekly', 70000)], []);
  scope.generateDuesForPeriod('2026-08');
  const w = wageFor('Weekly Wasswa');

  // A due from before the basis was stored falls back to the staff member.
  delete w.basis;
  eq(scope.dueBasis(w), 'weekly', 'an older due with no basis asks the staff member');
  data.staff = [];
  eq(scope.dueBasis(w), 'monthly',
    'and one whose worker is gone falls back to monthly, which keeps a figure on the screen');
}

process.exit(t.done() ? 1 : 0);
