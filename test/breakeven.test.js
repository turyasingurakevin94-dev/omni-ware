#!/usr/bin/env node
'use strict';
/*
 * What has to be sold before the shop earns anything.
 *
 * Newly possible. Until rent agreements and staff pay rates existed
 * there was no record of what the shop is COMMITTED to -- only of what
 * it had already paid, which is a different question and always looks
 * backwards.
 *
 * THE THING THIS FILE MOSTLY GUARDS IS THE REFUSAL TO GUESS. Breakeven
 * is sales = running costs / gross margin, and the margin is the part
 * that can be missing. Two ways, calling for opposite answers, so they
 * are never collapsed into one "cannot compute":
 *
 *   no sales    nothing invoiced, so there is no way to know what a
 *               shilling of sales leaves behind. Record the sales.
 *   no margin   goods going out at or below cost. NO volume covers the
 *               running costs -- selling more makes it worse. Fix the
 *               prices.
 *
 * A breakeven from a guessed margin would be a confident number that is
 * wrong, on the one figure somebody would set a target by. So it is not
 * produced. What IS produced either way is the floor -- rent plus
 * salaries, what leaves whether or not anybody walks in -- because that
 * needs no margin at all and is the most concrete number on the page.
 *
 * Run: node test/breakeven.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('breakeven');
const src = read('index.html');
const code = src.split(/\r?\n/).map((l) => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');

const data = { rentAgreements: [], staff: [] };
const NAMES = ['rentAgreementsFor', 'staffOnPayroll', 'staffWithoutPayRate',
  'committedMonthlyCost', 'breakevenPosition', 'periodDays', 'basisMonthCost'];
const scope = compileScope([
  // periodDays guards itself with monthsBetween, so that comes too.
  extractFunction(src, 'monthsBetween', 'index.html'),
  // Which bases are on the payroll at all, and what a week costs a month.
  extractDeclaration(src, 'PAY_BASES', 'index.html'),
  extractDeclaration(src, 'WAGE_DAYS_PER_MONTH', 'index.html'),
  extractDeclaration(src, 'WAGE_DAYS_PER_WEEK', 'index.html'),
  extractFunction(src, 'basisDayRate', 'index.html'),
  ...NAMES.map((n) => extractFunction(src, n, 'index.html')),
], { data, currentPeriod: () => '2026-08' }, NAMES);

const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);
const near = (got, want, msg) => t.check(Math.abs(got - want) < 1, `${msg} (got ${got}, want ${want})`);
const rent = (amount, startMonth, endMonth) =>
  ({ id: 1, premises: 'Shop', amount, dueDay: 1, startMonth, endMonth: endMonth || null });
const staff = (id, basis, rate) => ({ id, name: id, role: 'worker', payBasis: basis, payRate: rate });
// from/to spanning 31 days, the shape the page actually passes.
const IS = (revenue, costOfSales, opex, extra) => Object.assign({
  from: '2026-07-06', to: '2026-08-05',
  revenue, costOfSales,
  grossMarginPct: revenue > 0 ? ((revenue - costOfSales) / revenue) * 100 : 0,
  // Non-zero on purpose: with all three at zero, dropping them from the
  // running costs changed no figure and read as an equivalent mutant.
  opex, depreciation: 120000, interest: 80000, loanFees: 30000,
}, extra || {});

/* ---------- 1. the floor: what leaves whatever happens -------------- */
{
  data.rentAgreements = [rent(800000, '2026-01')];
  data.staff = [
    staff('S1', 'monthly', 450000),
    staff('S2', 'monthly', 380000),
    staff('S3', 'daily', 15000),
    staff('S4', null, null),
    // Half set up: told to be monthly, never given an amount. Without
    // one of these in the fixture, dropping the payRate!=null guard
    // changed nothing and read as an equivalent mutant.
    staff('S5', 'monthly', null),
  ];
  const c = scope.committedMonthlyCost('2026-08');
  eq(c.rent, 800000, 'the rent on every live tenancy');
  eq(c.wages, 830000, 'plus every monthly salary');
  eq(c.total, 1630000, 'is what leaves whether or not anybody walks in');
  eq(c.salariedCount, 2, 'from two salaried people');

  /* A daily-paid worker is NOT committed: what they cost follows the
     days worked, which follows the trade. Counting them would put a
     floor under the shop that it does not have, and make breakeven look
     further away than it is. */
  eq(c.dailyCount, 1, 'the daily-paid worker is counted separately');
  // Pinned against their actual rate, so adding it to the floor is caught
  // rather than passing as "some number that is not 1,630,000".
  t.check(c.total === 1630000 && c.total !== 1630000 + 15000,
    'and their day rate is not in the floor');

  /* A monthly staff member with no amount agreed is NOT on the floor at
     zero: they are half set up, and counting them would report a
     salaried head with no salary. */
  eq(c.salariedCount, 2, 'somebody set to monthly with no amount is not counted as a salary');
  eq(c.wages, 830000, 'and adds nothing to it');
  // Both of them are reported as missing from the figure.
  eq(c.noRateCount, 2, 'while both people without a usable rate are reported as missing from it');

  // A tenancy that has not started, or has ended, is not a commitment.
  data.rentAgreements = [rent(800000, '2026-09')];
  eq(scope.committedMonthlyCost('2026-08').rent, 0, 'a tenancy starting later is not yet committed');
  data.rentAgreements = [rent(800000, '2026-01', '2026-07')];
  eq(scope.committedMonthlyCost('2026-08').rent, 0, 'and one that has ended is not committed either');
  data.rentAgreements = [rent(800000, '2026-01')];
}

/* ---------- 2. the arithmetic --------------------------------------- */
{
  // 28% margin, 2,650,000 to cover.
  const be = scope.breakevenPosition(IS(14000000, 10080000, 2420000), '2026-08');
  eq(be.reason, 'ok', 'with sales and a margin it can be worked out');
  near(be.marginPct, 28, 'the margin is what the trading left');
  /* Everything that is not the goods: the running costs, the wear on
     what the shop owns, and the cost of its borrowing. Leaving any of
     them out sets a target that does not cover the shop. */
  eq(be.running, 2420000 + 120000 + 80000 + 30000, 'the running costs are everything but the goods');
  near(be.salesNeeded, 2650000 / 0.28, 'and breakeven is those costs over that margin');

  /* The figure has to cover itself: selling exactly the breakeven amount
     at that margin must produce exactly the running costs. */
  near(be.salesNeeded * be.marginPct / 100, be.running,
    'selling exactly that much at that margin covers exactly the running costs');

  eq(be.days, 31, 'over the days the period actually spans');
  near(be.perDay, be.salesNeeded / 31, 'which gives what has to be sold a day');

  /* Cost of sales is deliberately NOT in the running costs: it rises and
     falls with what is sold, so it belongs inside the margin rather than
     in the target the margin has to cover. Counting it would ask the
     shop to cover its stock twice. */
  t.check(be.running === 2650000 && be.running !== 2650000 + 10080000,
    'the cost of the goods is inside the margin, not added to the target');
}

/* ---------- 3. where the shop stands -------------------------------- */
{
  const above = scope.breakevenPosition(IS(14000000, 10080000, 2420000), '2026-08');
  t.check(above.over > 0, 'a shop selling more than it needs to is above the line');
  near(above.over, 14000000 - above.salesNeeded, 'by the difference');
  t.check(above.safetyPct > 0 && above.safetyPct < 100,
    'and the margin of safety is the share of the trade that was above it');

  const below = scope.breakevenPosition(IS(6000000, 4320000, 2420000), '2026-08');
  t.check(below.over < 0, 'a shop selling less is below it');
  t.check(below.safetyPct < 0, 'and its margin of safety is negative rather than absent');
}

/* ---------- 4. it refuses to guess ---------------------------------- *
 * The heart of it. Both of these could produce a plausible-looking
 * number and neither does.
 */
{
  const noSales = scope.breakevenPosition(IS(0, 0, 2220000), '2026-08');
  eq(noSales.reason, 'no-sales', 'nothing invoiced is its own reason');
  t.check(noSales.salesNeeded === null, 'and no target is produced from a margin that does not exist');
  t.check(noSales.marginPct === null, 'nor an invented margin');
  t.check(noSales.safetyPct === null,
    'and no margin of safety, which at 0 sales would read as trading exactly at breakeven');
  /* The floor survives, because it needs no margin. On the shop that
     most needs this screen -- the one whose counter sales are not
     invoiced -- it is the only figure that can be given, and it is
     still a real one. */
  eq(noSales.committed.total, 1630000, 'but the floor is still known, since it needs no margin');
  eq(noSales.running, 2450000, 'and so is what had to be covered');

  /* Selling at or below cost is a DIFFERENT problem with the opposite
     answer: no volume fixes it. Collapsing the two into one "cannot
     compute" would send somebody out to sell harder. */
  const noMargin = scope.breakevenPosition(IS(5000000, 5400000, 2420000), '2026-08');
  eq(noMargin.reason, 'no-margin', 'selling below cost is its own reason, not the same as having no sales');
  t.check(noMargin.salesNeeded === null, 'and no volume is offered as the answer');

  // Exactly at cost is also no margin: every extra sale covers nothing.
  eq(scope.breakevenPosition(IS(5000000, 5000000, 2420000), '2026-08').reason, 'no-margin',
    'selling at exactly cost leaves nothing to cover the shop with');
}

/* ---------- 5. what the screen says --------------------------------- */
{
  const html = (/function stBreakevenHTML[\s\S]*?\n\}\n/.exec(code) || [''])[0];
  t.check(/be\.reason === 'ok'/.test(html), 'the panel branches on whether it could be worked out');
  t.check(/nothing was invoiced in this period/.test(html) && /at or below what they cost/.test(html),
    'and gives the two reasons separately rather than one shrug');
  t.check(/Selling more will not fix this\. The prices will\./.test(html),
    'telling a shop selling below cost the one thing that would help');

  /* The floor is OUTSIDE the branch. Checking source order caught
     nothing -- wrapping the block in a condition leaves it in the same
     place -- so what is pinned is that no condition stands between the
     parts strip and the floor inside it. */
  const tail = html.slice(html.indexOf('st-be-parts'));
  const floorChunk = tail.slice(0, tail.indexOf('Kept from every 100 sold'));
  t.check(/Of which committed/.test(floorChunk) && !/be\.reason/.test(floorChunk),
    'the floor is stated whatever else is knowable, with no condition on it');
  t.check(/leaves whether or not anyone walks in/.test(html),
    'in the words that say what it actually means');
  t.check(/daily-paid \$\{floor\.dailyCount===1\?'worker is':'workers are'\} not in this/.test(html),
    'and what the floor leaves out is said, not left to be discovered');

  /* The Performance hub gave break-even a view of its own; the panel
     ("what the line is made of") lives there, and the overview carries
     the one figure in its glance table. Both must be built from the
     period on screen -- the committed floor is that month's. */
  const bev = (/function shBreakEven[\s\S]*?\n\}\n/.exec(code) || [''])[0];
  t.check(/const be = breakevenPosition\(is, periodOf\(ctx\.to\)\);/.test(bev) && /stBreakevenHTML\(be\)/.test(bev),
    'it is on the break-even view, built from the period on screen');
  const model = (/function shModel[\s\S]*?\n\}\n/.exec(code) || [''])[0];
  t.check(/const be = breakevenPosition\(is, periodOf\(/.test(model) && /breakevenPosition\(mis, period\)/.test(model),
    'and the overview\u2019s figure, and every month behind it, uses that month\u2019s committed costs');
}

process.exit(t.done() ? 1 : 0);
