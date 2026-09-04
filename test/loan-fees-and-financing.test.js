#!/usr/bin/env node
'use strict';
/*
 * What the loan actually put in your hands, and what it bought.
 *
 * Two things a real loan has that the first cut could not hold.
 *
 * FEES DEDUCTED AT DRAWDOWN
 * A lender charges for insurance and paperwork and takes it out of the
 * money before handing it over: apply for 20,000,000, receive
 * 19,400,000, owe 20,000,000. One number could not carry that, so
 * whichever was entered the books were wrong -- 20m overstated the cash
 * by 600,000, and 19.4m understated both the liability and every
 * interest figure derived from it, because the lender charges interest
 * on the full 20m regardless.
 *
 * The principal stays what is owed; the fee is held beside it and the
 * net is derived, so no third number can drift. And it makes the money
 * cost more than the agreement says -- interest paid on 20m that only
 * ever delivered 19.4m -- which loanTrueCostRate works out, in the same
 * spirit as exposing what a flat rate really costs.
 *
 * WHAT THE LOAN BOUGHT
 * A van bought on credit is two records that belong together. Held
 * apart, neither answers the question a financed asset raises: is it
 * worth less than is still owed on it? Ordinary on a vehicle
 * depreciated over five years against a loan repaid over three, and
 * worth knowing before it is sold.
 *
 * Run: node test/loan-fees-and-financing.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('loan fees and asset financing');
const src = read('index.html');
const data = { loans: [], fixedAssets: [] };

const scope = compileScope([
  'const DEPRECIATION_MAX_MONTHS = 40*12;',
  extractFunction(src, 'monthsBetween', 'index.html'),
  extractFunction(src, 'monthChargeFraction', 'index.html'),
  extractFunction(src, 'periodEndDate', 'index.html'),
  extractFunction(src, 'assetIsDisposed', 'index.html'),
  extractFunction(src, 'assetMonthsCharged', 'index.html'),
  extractFunction(src, 'assetMonthlyCharge', 'index.html'),
  extractFunction(src, 'assetSchedule', 'index.html'),
  extractFunction(src, 'assetNBVAt', 'index.html'),
  extractFunction(src, 'loanInstallments', 'index.html'),
  extractFunction(src, 'loanPrincipal', 'index.html'),
  extractFunction(src, 'loanScheduledPayment', 'index.html'),
  extractFunction(src, 'loanSchedule', 'index.html'),
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
  extractFunction(src, 'loanRateFor', 'index.html'),
  extractFunction(src, 'loanEffectiveRate', 'index.html'),
  extractFunction(src, 'loanFees', 'index.html'),
  extractFunction(src, 'loanNetAdvanced', 'index.html'),
  extractFunction(src, 'loanTrueCostRate', 'index.html'),
  extractFunction(src, 'liveLoans', 'index.html'),
  extractFunction(src, 'loanFeesForPeriod', 'index.html'),
  extractFunction(src, 'assetFinancingSchedule', 'index.html'),
  extractFunction(src, 'assetFinancingLoan', 'index.html'),
], { data }, ['loanFees', 'loanNetAdvanced', 'loanTrueCostRate', 'loanEffectiveRate',
  'loanFeesForPeriod', 'assetFinancingSchedule', 'assetFinancingLoan', 'loanSchedule', 'assetNBVAt']);

const r = (n) => Math.round(n);
// The real one: 20,000,000 applied for, 600,000 kept, 19,400,000 received.
const loan = (over) => Object.assign({
  id: 70, lender: 'Centenary Bank', principal: 20000000, fees: 600000,
  ratePct: 20, method: 'reducing_balance', termMonths: 36,
  startedOn: '2026-01-01', repayments: [],
}, over);
const asset = (over) => Object.assign({
  id: 80, name: 'Delivery van', cost: 20000000, acquiredOn: '2026-01-15',
  method: 'straight_line', lifeMonths: 60, ratePct: null, salvage: 2000000,
  disposedOn: null, loanId: 70,
}, over);

/* ---------- 1. owed, received, and the gap ---------------------------- */
{
  const l = loan();
  t.check(scope.loanNetAdvanced(l) === 19400000,
    `what reached the shop is the principal less the fee (got ${scope.loanNetAdvanced(l)})`);
  t.check(scope.loanFees(l) === 600000, 'and the fee is held rather than folded into either figure');

  // The liability is emphatically NOT the net. Interest is charged on the
  // full sum, so a schedule built on 19.4m would understate every figure.
  t.check(r(scope.loanSchedule(l)[0].opening) === 20000000,
    'the schedule opens on what is owed, not on what arrived -- the lender charges interest on all of it');

  t.check(scope.loanNetAdvanced(loan({ fees: 0 })) === 20000000, 'no fee means the whole sum arrived');
  t.check(scope.loanNetAdvanced(loan({ fees: 99000000 })) === 0,
    'and a fee larger than the loan floors at nothing rather than going negative');
  t.check(scope.loanFees(loan({ fees: -5 })) === 0, 'a negative fee is not a refund');
}

/* ---------- 2. it costs more than the rate says ----------------------- */
{
  const l = loan();
  const stated = scope.loanEffectiveRate(l);
  const real = scope.loanTrueCostRate(l);
  t.check(Math.abs(stated - 20) < 0.05,
    `on the principal alone this is its stated rate (got ${stated.toFixed(2)}%)`);
  t.check(real > stated,
    `but paying 20m of interest on 19.4m of money costs more (${real.toFixed(1)}% against ${stated.toFixed(1)}%)`);
  t.check(real > 21 && real < 24,
    `a 3% deduction over three years adds about two points (got ${real.toFixed(1)}%)`);

  // The shorter the term, the more a one-off fee costs in annual terms --
  // the same 600,000 is recovered over fewer months.
  const short = scope.loanTrueCostRate(loan({ termMonths: 12 }));
  const long = scope.loanTrueCostRate(loan({ termMonths: 36 }));
  t.check(short > long,
    `the same fee bites harder over a shorter term (${short.toFixed(1)}% vs ${long.toFixed(1)}%)`);

  t.check(Math.abs(scope.loanTrueCostRate(loan({ fees: 0 })) - stated) < 0.05,
    'with no fee the true cost is just the effective rate -- the two agree where they should');

  // Compounds with a flat rate rather than replacing it.
  const flat = loan({ method: 'flat', ratePct: 24, termMonths: 12 });
  t.check(scope.loanTrueCostRate(flat) > scope.loanEffectiveRate(flat),
    'a flat loan with fees costs more again than the flat rate alone');
}

/* ---------- 3. the fee is a cost of the month it was charged ---------- */
{
  data.loans = [loan({ startedOn: '2026-03-10' })];
  t.check(scope.loanFeesForPeriod('2026-03-01', '2026-03-31') === 600000,
    'the fee falls in the month the loan was drawn');
  t.check(scope.loanFeesForPeriod('2026-04-01', '2026-04-30') === 0,
    'and not in any month after -- expensed at drawdown rather than spread, which would be the only accrual in a cash-basis P&L');
  t.check(scope.loanFeesForPeriod('2026-01-01', '2026-12-31') === 600000, 'a year containing it counts it once');
  t.check(scope.loanFeesForPeriod('2025-01-01', '2025-12-31') === 0, 'a year before it charges nothing');
}

/* ---------- 4. worth against owed ------------------------------------- */
{
  data.loans = [loan()];
  data.fixedAssets = [asset()];
  const a = asset(), l = loan();
  const s = scope.assetFinancingSchedule(a, l);

  t.check(s.length === 60,
    `the schedule runs as long as either side has something to say (got ${s.length}: 60 depreciating, 36 repaying)`);
  t.check(r(s[0].owed) === 20000000, 'it opens on the full debt');
  t.check(r(s[0].equity) < 0, 'and the van is worth less than it the day it is bought');

  // The bug this fixture found: `owed` came from the repayments actually
  // made, so a loan with none yet recorded reported the full principal in
  // all sixty months and the table claimed the shop would still owe
  // 20,000,000 in 2030. Depreciation is a projection, so the loan side
  // has to be one too or the columns are not comparable.
  const last = s[s.length - 1];
  t.check(r(last.owed) === 0,
    `the debt clears on the agreed schedule rather than standing still (got ${r(last.owed)} in ${last.month})`);
  t.check(r(last.nbv) === 2000000, 'while the asset carries on to its residual value');

  const crossover = s.find((x) => x.equity >= 0);
  t.check(crossover && crossover.month === '2026-04',
    `it is underwater only until the repayments overtake the depreciation (${crossover && crossover.month})`);
  t.check(s.filter((x) => x.equity < 0).length === 3, 'three months, not sixty');

  // A loan repaid faster than the asset depreciates is never underwater.
  const quick = scope.assetFinancingSchedule(a, loan({ termMonths: 6, ratePct: 0 }));
  t.check(quick.filter((x) => x.equity < 0).length <= 1,
    'a loan cleared quickly leaves the asset in the clear almost at once');
}

/* ---------- 5. the link, and how it fails safely ---------------------- */
{
  data.loans = [loan()];
  t.check(scope.assetFinancingLoan(asset()) !== null, 'an asset bought on a loan finds it');
  t.check(scope.assetFinancingLoan(asset({ loanId: null })) === null, 'one bought outright has none');
  t.check(scope.assetFinancingLoan(asset({ loanId: 999 })) === null,
    'and a link to a loan that no longer exists reads as bought outright rather than throwing');
  t.check(scope.assetFinancingSchedule(asset(), null).length === 0, 'with no loan there is no schedule');
  t.check(scope.assetFinancingSchedule(null, loan()).length === 0, 'and no asset likewise');
}

/* ---------- 6. wired through --------------------------------------- */
{
  const code = src.split(/\r?\n/).map((x) => x.replace(/(?<!:)\/\/.*$/, '')).join('\n');
  t.check(/fees:Number\(l\.fees\)\|\|0,/.test(code) && /fees:l\.fees\|\|0,/.test(code),
    'the fee is loaded and saved');
  t.check(/loanId:a\.loan_id==null\?null:Number\(a\.loan_id\)/.test(code)
    && /loan_id:a\.loanId==null\?null:a\.loanId/.test(code),
  'and so is the loan an asset was bought with');
  t.check(/fees: Number\(document\.getElementById\('ln_fees'\)\.value\)\|\|0,/.test(code),
    'the loan form captures it');
  t.check(/getElementById\('fa_loan'\)\.value === ''/.test(code), 'and the asset form captures the link');

  const mig = read('supabase/migrations/0044_loan_fees_and_asset_financing.sql');
  t.check(/alter table loans add column if not exists fees/.test(mig), 'the fee column is added');
  t.check(/alter table fixed_assets add column if not exists loan_id/.test(mig), 'and the link column');
  t.check(/if not exists/.test(mig), 'idempotently, so a re-run against a restored database is safe');
}

process.exit(t.done() ? 1 : 0);
