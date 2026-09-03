#!/usr/bin/env node
'use strict';
/*
 * What the shop owes its people TODAY.
 *
 * Three faults, reported together by a shop reading its own balance
 * sheet, and all of them the same confusion between "what this month
 * costs" and "what is owed on this day".
 *
 * 1. Looking at a past month RAISED it. renderPayroll generated dues for
 *    whatever period was on screen, so paging back through the year
 *    wrote a wage for every worker into every month browsed — including
 *    months before the shop had employed them. Eight million owed to
 *    people not yet hired, put there by reading.
 *
 * 2. The balance sheet counted a whole month's wage from the day the
 *    month was raised. Somebody paid every second week is owed a
 *    fortnight mid-month, not a month; the shop asked to see "how much
 *    he demands us since the 1st".
 *
 * 3. The two halves of the liability disagreed. duesOwed (today) counted
 *    every unpaid month whatever its date; duesOwedAsAt (a past date)
 *    dropped any month not yet fallen due. The drill-down beside the
 *    sheet follows the second rule, so it reconciled to 8,104,615 while
 *    the line above it said 8,747,692 — and said so, in red, which is
 *    how this was found at all.
 *
 * One accrual rule now serves the sheet, its preview and every date.
 *
 * Run: node test/payroll-accrual.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('payroll accrual');
const src = read('index.html');
const code = src.split(/\r?\n/).map(l => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');

const store = { dues: [], staff: [], rentAgreements: [] };
const TODAY = '2026-08-22';
const NAMES = ['duePaidBy', 'dueAccruedAsAt', 'dueAccruedOutstanding', 'dueBalance',
  'dueBasis', 'duesOwed', 'duesOwedAsAt', 'periodEndDate', 'daysBetweenISO'];
let fns = null, err = null;
try {
  fns = compileScope(
    [extractDeclaration(src, 'PAY_BASES', 'index.html'),
      ...NAMES.map(n => extractFunction(src, n, 'index.html'))],
    { data: store, todayISO: () => TODAY }, NAMES);
} catch (e) { err = e; }
t.check(!!fns, `the accrual routines compile${err ? ` (${err.message})` : ''}`);

if (fns) {
  const { dueAccruedAsAt, dueAccruedOutstanding, duesOwed, duesOwedAsAt, dueBalance } = fns;

  const wage = (over) => Object.assign({
    id: 1, kind: 'wage', refId: 'ST064', period: '2026-08', dueDate: '2026-08-31',
    amount: 320000, paid: 0, payments: [], basis: 'weekly', rate: 73846.15,
  }, over);
  const rent = (over) => Object.assign({
    id: 2, kind: 'rent', refId: 'R1', period: '2026-08', dueDate: '2026-08-02',
    amount: 600000, paid: 0, payments: [],
  }, over);

  /* ---------- 1. a month still running is owed in part -------------- */
  /*
   * Edrine's case. On the 22nd of a 31-day month he has worked 22 of it,
   * so 22/31 of the month is owed — near enough a fortnight and a half,
   * and emphatically not the whole month.
   */
  {
    const d = wage();
    const acc = dueAccruedAsAt(d, TODAY);
    t.check(Math.round(acc) === Math.round(320000 * 22 / 31),
      `a running month is earned day by day (got ${Math.round(acc)}, want ${Math.round(320000 * 22 / 31)})`);
    t.check(acc < 320000, 'so the shop is not charged for days nobody has worked yet');
    t.check(dueBalance(d) === 320000,
      'while the payroll screen still pays against the whole month — the two answer different questions');
    t.check(dueAccruedAsAt(d, '2026-08-31') === 320000, 'and at month end the whole of it is owed');
    t.check(dueAccruedAsAt(d, '2026-09-15') === 320000, 'and stays owed after, until it is paid');
    t.check(dueAccruedAsAt(d, '2026-07-31') === 0, 'a month not yet begun is owed nothing');
  }

  /* ---------- 2. rent is not earned by the day ---------------------- */
  {
    const r = rent();
    t.check(dueAccruedAsAt(r, '2026-08-22') === 600000,
      'rent already fallen due is owed whole');
    t.check(dueAccruedAsAt(r, '2026-08-01') === 0,
      'and before its day it is not owed at all — a tenancy falls due on a date, not by the night');
  }

  /* ---------- 3. a daily-paid month is already the days worked ------ */
  {
    const d = wage({ basis: 'daily', days: 9, amount: 90000, rate: 10000 });
    t.check(dueAccruedAsAt(d, TODAY) === 90000,
      'a daily month is not pro-rated — its amount already IS the days counted');
  }

  /* ---------- 4. what has been paid comes off ----------------------- */
  {
    const d = wage({ payments: [{ date: '2026-08-14', amount: 147692 }], paid: 147692 });
    const owed = dueAccruedOutstanding(d, TODAY);
    t.check(Math.round(owed) === Math.round(320000 * 22 / 31 - 147692),
      `a fortnight already handed over comes off what is owed (got ${Math.round(owed)})`);
    /* Asked as at a date BEFORE that payment, the payment does not
       count: ten days were earned and nothing had been handed over yet.
       Which is the point of dating the walk — a sheet printed for the
       10th must not know about money paid on the 14th. */
    t.check(Math.round(dueAccruedOutstanding(d, '2026-08-10')) === Math.round(320000 * 10 / 31),
      `asked as at the 10th, ten days are earned and nothing yet paid (got ${Math.round(dueAccruedOutstanding(d, '2026-08-10'))})`);
    const paidUp = wage({ payments: [{ date: '2026-08-02', amount: 320000 }], paid: 320000 });
    t.check(dueAccruedOutstanding(paidUp, TODAY) === 0, 'a month paid in full owes nothing');
  }

  /* ---------- 5. the two halves of the liability agree -------------- */
  /*
   * The reported reconciliation failure. The sheet and its own preview
   * read one rule now, so today is simply the as-at of today.
   */
  {
    store.dues = [wage(), rent(), wage({ id: 3, refId: 'ST002', period: '2026-07',
      dueDate: '2026-07-31', amount: 400000, basis: 'monthly', rate: 400000 })];
    const today = duesOwed();
    const asAtToday = duesOwedAsAt(TODAY);
    t.check(today.total === asAtToday.total,
      `today is the as-at of today, not a second rule (${today.total} vs ${asAtToday.total})`);
    // The preview sums the same per-due figures the total is built from.
    const rows = store.dues.map(d => dueAccruedOutstanding(d, TODAY)).filter(v => v !== null && v > 0.5);
    const sum = rows.reduce((a, b) => a + b, 0);
    t.check(Math.abs(sum - today.total) < 0.01,
      `and the records behind the figure add up to it (${Math.round(sum)} vs ${Math.round(today.total)})`);
    t.check(today.count === rows.length, 'with the same count the preview lists');
  }

  /* ---------- 6. an uncosted month is not counted before it starts --- */
  {
    store.dues = [wage({ amount: null, period: '2026-12', dueDate: '2026-12-31' })];
    t.check(duesOwed().uncostedCount === 0,
      'a month that has not begun is not yet an uncosted obligation');
    store.dues = [wage({ amount: null })];
    t.check(duesOwed().uncostedCount === 1, 'while one already running is');
    t.check(duesOwed().total === 0, 'and contributes nothing to the figure, its size being unknown');
  }
}

/* ---------- 7. looking at a month does not raise it ------------------- */
{
  t.check(/if\(period >= currentPeriod\(\)\) generateDuesForPeriod\(period\);/.test(code),
    'only the current month is raised on open — paging back through the year no longer writes a wage into every month browsed');
  t.check(!/^\s*generateDuesForPeriod\(period\);\s*$/m.test(code),
    'and the unguarded call that did is gone');
  /* The button now NAMES the month it will raise, and it is drawn inside
     the empty state of that month rather than sitting permanently in a
     toolbar with display:none. Same act, same guard, said where it
     applies -- so what is pinned is the id and the month in the label. */
  t.check(/id="pr_raise"/.test(code) && /Raise \$\{esc\(periodLabel\(period\)\)\}/.test(code),
    'a past month can still be run, but by deciding to rather than by looking');
  /* The guard moved with it. `bare` was a boolean computed in
     renderPayroll beside a style.display; the state that draws the
     button is reached only when the month has raised NOTHING at all
     (`!p.dues.length`, p being payrollPosition(period)) and only when
     the month is past -- which is the same condition, now standing
     where the button is written rather than a line away from it. */
  t.check(/if\(!p\.dues\.length\)\{[\s\S]{0,400}?const past = period < currentPeriod\(\);[\s\S]{0,600}?if\(past && \(onRoll \|\| agreements\)\)\{/.test(code),
    'offered only where there is nothing raised yet, so it cannot double a month');

  const drop = (/function dropDue[\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(drop.length > 0, 'a month raised in error can be removed');
  t.check(/if\(\(due\.payments\|\|\[\]\)\.length \|\| \(Number\(due\.paid\)\|\|0\) > 0\.5\)\{/.test(drop),
    'but never one with money against it — that wants the payment reversed, not the record deleted');
  t.check(/no cash entry is involved/.test(drop),
    'and it says plainly that no cash is touched');
}

process.exit(t.done() ? 1 : 0);
