#!/usr/bin/env node
'use strict';
/*
 * Ratios.
 *
 * Phase 5. Computed FROM the statements rather than re-derived from the
 * subledgers: if a ratio disagreed with the statement printed above it,
 * a reader would have no way to tell which was wrong.
 *
 * Three things here are honesty rather than arithmetic, and each is
 * tested as such.
 *
 *   ANNUALISING  a month's profit over a year's assets is not a return.
 *                Anything putting a period figure over a balance is
 *                scaled to a year and labelled, because an unscaled month
 *                against a snapshot is worse than a scaled one that says
 *                what it did.
 *
 *   AVERAGES     textbook turnover and collection ratios use AVERAGE
 *                stock and debtors. This data model keeps current
 *                balances only, so they use closing figures -- which
 *                reads high in a growing shop and low in a shrinking one.
 *                Labelled on every ratio it touches.
 *
 *   NOTHING TO   a ratio with a zero denominator is null, never Infinity
 *   MEASURE      and never zero. "Cannot be worked out" and "is nothing"
 *                are different answers, and showing one for the other is
 *                how somebody comes to trust a figure that means nothing.
 *
 * Run: node test/financial-ratios.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('financial ratios');
const src = read('index.html');
const TODAY = '2026-12-31';
const data = { loans: [], fixedAssets: [] };

const scope = compileScope([
  extractDeclaration(src, 'RATIO_DAYS_IN_YEAR', 'index.html'),
  extractFunction(src, 'monthsBetween', 'index.html'),
  extractFunction(src, 'periodDays', 'index.html'),
  extractDeclaration(src, 'safeRatio', 'index.html'),
  extractFunction(src, 'loanInstallments', 'index.html'),
  extractFunction(src, 'loanPrincipal', 'index.html'),
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
  extractFunction(src, 'loanApplied', 'index.html'),
  extractFunction(src, 'loanOutstanding', 'index.html'),
  extractFunction(src, 'liveLoans', 'index.html'),
  extractFunction(src, 'loansDueWithin', 'index.html'),
  extractFunction(src, 'financialRatios', 'index.html'),
], { data, todayISO: () => TODAY }, ['periodDays', 'loansDueWithin', 'financialRatios']);

const R = (out, label) => {
  for (const g of out.groups) { const r = g.rows.find((x) => x.label === label); if (r) return r; }
  return null;
};
const val = (out, label) => { const r = R(out, label); return r ? r.value : undefined; };

// A shop with round numbers, so every ratio can be checked by hand.
const IS = (over) => Object.assign({
  from: '2026-01-01', to: '2026-12-31',
  revenue: 10000000, costOfSales: 6000000, grossProfit: 4000000,
  opex: 2000000, depreciation: 0, operatingProfit: 2000000,
  interest: 500000, loanFees: 0, disposalGain: 0, disposals: [],
  netProfit: 1500000, invoiceCount: 10, estimatedCostUnits: 0,
}, over);
const BS = (over) => Object.assign({
  asOf: TODAY, cash: 2000000, receivables: 1000000, inventory: 3000000,
  fixedAssets: 4000000, assets: 10000000,
  payables: 2000000, loans: 3000000, liabilities: 5000000,
  // Wages and rent already fallen due. A current liability without
  // argument -- not due within the year, due within the month.
  staffAndRent: 0, staffAndRentDetail: { wages: 0, rent: 0, total: 0, count: 0, uncostedCount: 0 },
  ownerCapital: 1000000, retainedEarnings: 4000000, equity: 5000000,
  cashAccounts: [], inventoryUncostedQty: 0,
}, over);
const CF = () => ({ operating: 0, financing: 0, netMovement: 0, unclassified: 0 });

/* ---------- 1. the arithmetic, on a full year ------------------------- */
{
  data.loans = [];
  const out = scope.financialRatios(IS(), BS(), CF());
  t.check(out.days === 365, `a full year is 365 days (got ${out.days})`);
  t.check(out.annualised === false, 'and needs no scaling, which the screen is told');

  t.check(val(out, 'Gross margin') === 40, 'gross margin is what is left of each sale after the goods');
  t.check(val(out, 'Net margin') === 15, 'net margin is what is left after everything');
  t.check(val(out, 'Return on assets') === 15, '1.5m on 10m of assets is 15%');
  t.check(val(out, 'Return on the owner’s money') === 30, 'and 30% on the 5m that is actually theirs');
  t.check(val(out, 'Debt to net worth') === 1, '5m owed against 5m owned is one to one');
  t.check(val(out, 'Borrowing as a share of assets') === 50, 'half of what the shop owns is the lenders’');
  t.check(val(out, 'Interest cover') === 4, 'trading profit covers the interest four times over');
}

/* ---------- 2. scaled to a year, and labelled ------------------------- */
{
  // The same trading in one month. Margins are ratios of one period to
  // itself and must NOT move; returns put a period over a balance and must.
  const month = scope.financialRatios(
    IS({ from: '2026-01-01', to: '2026-01-31' }), BS(), CF());
  t.check(month.days === 31 && month.annualised === true, 'a month is 31 days and is scaled');

  t.check(val(month, 'Gross margin') === 40 && val(month, 'Net margin') === 15,
    'margins are unchanged -- both sides are the same period, so there is nothing to scale');
  t.check(val(month, 'Return on assets') > 100,
    `a month's profit scaled to a year is a far larger return (got ${val(month, 'Return on assets').toFixed(0)}%)`);
  t.check(Math.abs(val(month, 'Return on assets') - 15 * (365/31)) < 0.01,
    'scaled by exactly the days in the period, not by a rule of thumb about months');
  t.check(R(month, 'Return on assets').annual === true && R(month, 'Gross margin').annual !== true,
    'and only the scaled ones are marked as such, so the reader knows which is which');

  t.check(val(month, 'Interest cover') === 4,
    'interest cover is period over period too, so it does not move either');
}

/* ---------- 3. closing balances, admitted --------------------------- */
{
  const out = scope.financialRatios(IS(), BS(), CF());
  t.check(val(out, 'Stock turns a year') === 2, '6m of goods sold against 3m on the shelf turns twice');
  t.check(Math.round(val(out, 'Days of stock')) === 183, 'which is about half a year of stock');
  t.check(Math.round(val(out, 'Days to get paid')) === 37, '1m owed on 10m of sales is about 37 days');

  ['Stock turns a year', 'Days of stock', 'Days to get paid'].forEach((label)=>{
    t.check(R(out, label).closing === true,
      `${label} is marked as using today's balance rather than the period's average, which this app does not keep`);
  });
}

/* ---------- 4. what cannot be worked out says so ---------------------- */
{
  data.loans = [];
  const empty = scope.financialRatios(
    IS({ revenue: 0, costOfSales: 0, grossProfit: 0, operatingProfit: 0, netProfit: 0, interest: 0 }),
    BS({ cash: 0, receivables: 0, inventory: 0, fixedAssets: 0, assets: 0,
      payables: 0, loans: 0, liabilities: 0, equity: 0, ownerCapital: 0, retainedEarnings: 0 }),
    CF());
  const all = empty.groups.flatMap((g) => g.rows);
  t.check(all.every((r) => r.value === null),
    'a shop with nothing in it can compute no ratio at all, and every one is null');
  t.check(!all.some((r) => r.value === 0),
    'none of them is zero -- "cannot be worked out" is not "is nothing"');
  t.check(!all.some((r) => r.value != null && !isFinite(r.value)),
    'and none is Infinity, which is what dividing by an empty balance would give');

  // The specific one a real shop hits: no borrowing, so no interest.
  const noDebt = scope.financialRatios(IS({ interest: 0 }), BS(), CF());
  t.check(val(noDebt, 'Interest cover') === null,
    'a shop paying no interest has no interest cover, rather than an infinitely good one');

  // A shop whose debts exceed everything it owns has negative equity --
  // a real state, and the ratio must report it rather than refuse.
  const underwater = scope.financialRatios(IS(), BS({ equity: -2000000 }), CF());
  t.check(val(underwater, 'Debt to net worth') === 5000000 / -2000000,
    'negative net worth gives a negative ratio, which is the truth, not a blank');
}

/* ---------- 5. the loan split that liquidity rests on ----------------- */
{
  // A three-year loan is not all due this year, and treating it as
  // current would say a healthy shop cannot pay its bills.
  data.loans = [{ id: 1, lender: 'Bank', principal: 3600000, fees: 0, ratePct: 0,
    method: 'reducing_balance', termMonths: 36, startedOn: '2026-01-01', repayments: [] }];
  const due = scope.loansDueWithin(12, TODAY);
  t.check(due > 0 && due < 3600000,
    `only the next twelve months of principal is short-term (got ${Math.round(due)} of 3,600,000)`);
  t.check(Math.abs(due - 1200000) < 100000, 'which on a flat 36-month repayment is about a third');

  t.check(scope.loansDueWithin(12, TODAY) <= 3600000,
    'and it can never exceed what is actually outstanding');

  // A settled loan is not a liability at all.
  data.loans = [{ id: 1, lender: 'Bank', principal: 1000000, fees: 0, ratePct: 0,
    method: 'reducing_balance', termMonths: 12, startedOn: '2026-01-01',
    repayments: [{ date: '2026-02-01', amount: 1000000 }] }];
  t.check(scope.loansDueWithin(12, TODAY) === 0, 'a loan already repaid is due nothing');

  // Paid down early: the agreed schedule still shows a year of principal
  // ahead, but only 50,000 is actually left. What falls due can never
  // exceed what is owed, or the shop would look to have more falling due
  // than it has debt.
  data.loans = [{ id: 1, lender: 'Bank', principal: 1200000, fees: 0, ratePct: 0,
    method: 'reducing_balance', termMonths: 12, startedOn: '2026-06-01',
    repayments: [{ date: '2026-07-01', amount: 1150000 }] }];
  const nearlyDone = scope.loansDueWithin(12, TODAY);
  t.check(Math.abs(nearlyDone - 50000) < 1,
    `what falls due is capped at what is still owed (got ${Math.round(nearlyDone)}, owed 50,000)`);

  /* And it has to reach the liquidity ratios, which is the whole reason
     the split exists. Every fixture above hands financialRatios a
     hand-built balance sheet with no loans behind it, so the ratios were
     never actually being asked the question. */
  data.loans = [{ id: 1, lender: 'Bank', principal: 3600000, fees: 0, ratePct: 0,
    method: 'reducing_balance', termMonths: 36, startedOn: '2026-01-01', repayments: [] }];
  const bs = BS({ cash: 2000000, receivables: 1000000, inventory: 3000000, payables: 2000000, loans: 3600000 });
  const out = scope.financialRatios(IS(), bs, CF());

  // Current liabilities are payables plus only the next year of principal
  // (2,000,000 + 1,200,000), not the whole 3,600,000.
  t.check(Math.abs(val(out, 'Current ratio') - 6000000/3200000) < 0.01,
    `only the next year of the loan is current (got ${val(out, 'Current ratio').toFixed(2)}x)`);
  t.check(val(out, 'Current ratio') > safeCurrentIfWholeLoan(bs),
    'treating the whole term as due this year would make a solvent shop look unable to pay');

  // The quick ratio exists to exclude stock, which has to be sold first.
  t.check(Math.abs(val(out, 'Quick ratio') - 3000000/3200000) < 0.01,
    `the quick ratio leaves the stock out (got ${val(out, 'Quick ratio').toFixed(2)}x)`);
  t.check(val(out, 'Quick ratio') < val(out, 'Current ratio'),
    'so it is always the harsher of the two, which is its point');

  /* Wages and rent already fallen due belong in current liabilities
     without argument: they are not due within the year, they are due
     within the month. Leaving them out flattered every liquidity ratio
     on the page -- a shop that cannot make payroll on Friday would have
     read as comfortably able to pay its way. */
  const withWages = scope.financialRatios(IS(), BS({
    cash: 2000000, receivables: 1000000, inventory: 3000000,
    payables: 2000000, loans: 3600000, staffAndRent: 800000,
  }), CF());
  t.check(Math.abs(val(withWages, 'Current ratio') - 6000000/4000000) < 0.01,
    `wages owed are current liabilities too (got ${val(withWages, 'Current ratio').toFixed(2)}x)`);
  t.check(val(withWages, 'Current ratio') < val(out, 'Current ratio'),
    'so owing your staff makes the shop read as less able to pay, not more');

  // A loan already settled must not inflate current liabilities either.
  data.loans = [{ id: 1, lender: 'Bank', principal: 1000000, fees: 0, ratePct: 0,
    method: 'reducing_balance', termMonths: 12, startedOn: '2026-01-01',
    repayments: [{ date: '2026-02-01', amount: 1000000 }] }];
  const settled = scope.financialRatios(IS(), BS({ cash: 1000000, receivables: 0, inventory: 0, payables: 1000000 }), CF());
  t.check(Math.abs(val(settled, 'Current ratio') - 1) < 0.01,
    'a repaid loan adds nothing to what falls due, so it does not drag liquidity down');
  data.loans = [];
}
// What the current ratio WOULD be if the whole loan were treated as due
// this year -- the mistake the split exists to avoid.
function safeCurrentIfWholeLoan(bs){
  return (bs.cash + bs.receivables + bs.inventory) / (bs.payables + bs.loans);
}

/* ---------- 6. days in a period --------------------------------------- */
{
  t.check(scope.periodDays('2026-01-01', '2026-01-31') === 31, 'January is 31 days, both ends included');
  t.check(scope.periodDays('2026-01-01', '2026-01-01') === 1, 'a single day is one, not zero');
  t.check(scope.periodDays('2026-01-01', '2026-12-31') === 365, 'and a year is a year');
  t.check(scope.periodDays('2026-03-01', '2026-01-01') === 1,
    'a period running backwards floors at one rather than dividing by a negative');
  t.check(scope.periodDays('nonsense', '2026-01-01') === 0, 'and nonsense gives zero rather than NaN');
}

process.exit(t.done() ? 1 : 0);
