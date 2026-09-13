#!/usr/bin/env node
'use strict';
/*
 * The statements themselves.
 *
 * Phase 4, and mostly assembly: phases 1 to 3 settled one cost of sales,
 * one cash figure, what is and is not income, depreciation, interest and
 * two liabilities. What is new here is putting them together without
 * counting anything twice, and being honest about what the result proves.
 *
 * WHAT IT PROVES IS THE POINT. There is no general ledger, so equity is
 * what is left when liabilities are taken from assets: the balance sheet
 * BALANCES BY CONSTRUCTION and a balancing sheet is not evidence of
 * anything. The reconciliation checks are what stand in for a trial
 * balance, so they are tested as carefully as the arithmetic.
 *
 * The double-counting traps, each of which is a test below:
 *   stock bought    already costed through COGS when it sells
 *   supplier paid   settles a payable for goods already costed
 *   debt collected  the sale was booked when the invoice was raised
 *   a loan drawn    borrowed, not earned
 *
 * Run: node test/financial-statements.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('financial statements');
const src = read('index.html');
const TODAY = '2026-08-03';
const data = {
  savedQuotes: [], customers: [], suppliers: [], products: [],
  cashTxns: [], cashDays: {}, stock: {}, stockLots: {}, fixedAssets: [], loans: [],
  // Wages and rent already fallen due are a liability on this sheet.
  dues: [],
};

const scope = compileScope([
  /* Payables now include consignment that has sold and not been
     settled -- money owed with no bill yet. The chain comes along so
     the figure is the real one; a fixture holding nothing on
     consignment simply reads zero. */
  extractFunction(src, 'orderCharges', 'index.html'),
  extractFunction(src, 'chargeAmount', 'index.html'),
  extractFunction(src, 'savedQuoteGoodsTotal', 'index.html'),
  extractFunction(src, 'orderChargesTotal', 'index.html'),
  extractFunction(src, 'consignmentHeld', 'index.html'),
  extractFunction(src, 'consignmentAccrued', 'index.html'),
  extractFunction(src, 'consignmentSettlements', 'index.html'),
  extractFunction(src, 'consignmentSettled', 'index.html'),
  extractFunction(src, 'consignmentRows', 'index.html'),
  extractFunction(src, 'consignmentOwedTotal', 'index.html'),
  extractDeclaration(src, 'ACCOUNTS', 'index.html'),
  extractDeclaration(src, 'DEPRECIATION_MAX_MONTHS', 'index.html'),
  extractDeclaration(src, 'CASH_NOT_OPEX', 'index.html'),
  extractDeclaration(src, 'CASH_OWNER_WITHDRAWAL', 'index.html'),
  extractDeclaration(src, 'CASH_NOT_REVENUE', 'index.html'),
  extractDeclaration(src, 'CASH_SHORTAGE_CATEGORY', 'index.html'),
  extractDeclaration(src, 'CASH_OVERAGE_CATEGORY', 'index.html'),
  extractDeclaration(src, 'CASH_VARIANCE_LINE', 'index.html'),
  extractDeclaration(src, 'cashHas', 'index.html'),
  extractFunction(src, 'cbAccountTotals', 'index.html'),
  extractFunction(src, 'cbClosingFor', 'index.html'),
  extractFunction(src, 'previousCashDate', 'index.html'),
  extractFunction(src, 'carriedOpening', 'index.html'),
  extractFunction(src, 'cashAnchorFor', 'index.html'),
  extractFunction(src, 'cashOnHandFor', 'index.html'),
  extractFunction(src, 'cashOnHandByAccount', 'index.html'),
  extractFunction(src, 'cashIsMoneyOut', 'index.html'),
  extractFunction(src, 'cashIsMoneyIn', 'index.html'),
  extractFunction(src, 'cashIsOperatingExpense', 'index.html'),
  extractFunction(src, 'cashIsOwnerWithdrawal', 'index.html'),
  extractFunction(src, 'cashIsDebtCollection', 'index.html'),
  extractFunction(src, 'invoiceBackedCashTxnIds', 'index.html'),
  extractFunction(src, 'cashIsTradingIncome', 'index.html'),
  extractFunction(src, 'cashIsCashShortage', 'index.html'),
  extractFunction(src, 'cashIsCashOverage', 'index.html'),
  extractFunction(src, 'cashOpexRows', 'index.html'),
  extractFunction(src, 'invoiceLineCost', 'index.html'),
  extractFunction(src, 'anInvoiceTotals', 'index.html'),
  extractFunction(src, 'anOverallTotals', 'index.html'),
  extractFunction(src, 'anInvoicesInRange', 'index.html'),
  extractFunction(src, 'dashCashTxnsInRange', 'index.html'),
  extractFunction(src, 'dashTotalDebtors', 'index.html'),
  extractFunction(src, 'dueBalance', 'index.html'),
  extractFunction(src, 'duePaidBy', 'index.html'),
  extractFunction(src, 'dueBasis', 'index.html'),
  extractFunction(src, 'dueAccruedAsAt', 'index.html'),
  extractFunction(src, 'dueCostAccruedTo', 'index.html'),
  extractFunction(src, 'duePositionAsAt', 'index.html'),
  extractFunction(src, 'dueAccruedOutstanding', 'index.html'),
  extractFunction(src, 'duePrepaidAsAt', 'index.html'),
  extractFunction(src, 'duesPrepaidAsAt', 'index.html'),
  extractFunction(src, 'cashIsSpreadCost', 'index.html'),
  extractFunction(src, 'spreadCostTxns', 'index.html'),
  extractFunction(src, 'spreadDays', 'index.html'),
  extractFunction(src, 'spreadCostBetween', 'index.html'),
  extractFunction(src, 'spreadCostRows', 'index.html'),
  extractFunction(src, 'spreadPrepaidOf', 'index.html'),
  extractFunction(src, 'spreadAccruedOf', 'index.html'),
  extractFunction(src, 'spreadPrepaidAsAt', 'index.html'),
  extractFunction(src, 'spreadAccruedAsAt', 'index.html'),
  extractFunction(src, 'periodEndDate', 'index.html'),
  extractFunction(src, 'daysBetweenISO', 'index.html'),
  extractFunction(src, 'duesOwed', 'index.html'),
  extractFunction(src, 'stockValueAsAt', 'index.html'),
  extractFunction(src, 'receivablesAsAt', 'index.html'),
  extractFunction(src, 'payablesAsAt', 'index.html'),
  extractFunction(src, 'duesOwedAsAt', 'index.html'),
  extractFunction(src, 'balanceSheetAsAt', 'index.html'),
  extractFunction(src, 'monthsBetween', 'index.html'),
  extractFunction(src, 'monthChargeFraction', 'index.html'),
  extractFunction(src, 'assetCoverInMonth', 'index.html'),
  extractFunction(src, 'assetRowFraction', 'index.html'),
  extractDeclaration(src, 'DUE_KINDS', 'index.html'),
  // dueBasis is reached for every wage now that its month is costed by the day.
  extractDeclaration(src, 'PAY_BASES', 'index.html'),
  extractFunction(src, 'dueCostBetween', 'index.html'),
  extractFunction(src, 'dueCostRows', 'index.html'),
  extractFunction(src, 'dueSettledCashIds', 'index.html'),
  extractFunction(src, 'unlinkedDuePayments', 'index.html'),
  extractFunction(src, 'uncostedDuesInRange', 'index.html'),
  extractFunction(src, 'statementOpexRows', 'index.html'),
  extractFunction(src, 'assetIsDisposed', 'index.html'),
  extractFunction(src, 'assetMonthsCharged', 'index.html'),
  extractFunction(src, 'assetMonthlyCharge', 'index.html'),
  extractFunction(src, 'assetSchedule', 'index.html'),
  extractFunction(src, 'assetNBVAt', 'index.html'),
  extractFunction(src, 'assetChargeBetween', 'index.html'),
  extractFunction(src, 'assetDisposalResult', 'index.html'),
  extractFunction(src, 'liveFixedAssets', 'index.html'),
  extractFunction(src, 'depreciationForPeriod', 'index.html'),
  extractFunction(src, 'fixedAssetsNBVAt', 'index.html'),
  extractDeclaration(src, 'LOAN_FREQUENCIES', 'index.html'),
  extractFunction(src, 'loanFrequency', 'index.html'),
  extractFunction(src, 'loanPeriodsPerYear', 'index.html'),
  extractFunction(src, 'loanInstallments', 'index.html'),
  extractFunction(src, 'loanPeriodRate', 'index.html'),
  extractFunction(src, 'loanFeePerInstallment', 'index.html'),
  extractFunction(src, 'loanDueDate', 'index.html'),
  extractFunction(src, 'loanPeriodsBetween', 'index.html'),
  extractFunction(src, 'loanLevelPI', 'index.html'),

  extractFunction(src, 'loanPrincipal', 'index.html'),
  extractFunction(src, 'loanFees', 'index.html'),
  extractFunction(src, 'loanScheduledPayment', 'index.html'),
  extractFunction(src, 'loanSchedule', 'index.html'),
  extractFunction(src, 'loanRepayments', 'index.html'),
  extractFunction(src, 'loanApplied', 'index.html'),
  extractFunction(src, 'loanOutstanding', 'index.html'),
  extractFunction(src, 'dayBeforeISO', 'index.html'),
  extractFunction(src, 'loanInterestPaidBetween', 'index.html'),
  extractFunction(src, 'loanChargedTo', 'index.html'),
  extractFunction(src, 'loanInterestChargedBetween', 'index.html'),
  extractFunction(src, 'loanInstalmentChargesBetween', 'index.html'),
  extractFunction(src, 'loanChargesForPeriod', 'index.html'),
  extractFunction(src, 'loanChargesOwedAt', 'index.html'),
  extractFunction(src, 'loansChargesOwedAt', 'index.html'),
  extractFunction(src, 'liveLoans', 'index.html'),
  extractFunction(src, 'loansOutstandingAt', 'index.html'),
  extractFunction(src, 'loanInterestForPeriod', 'index.html'),
  extractFunction(src, 'loanFeesForPeriod', 'index.html'),
  extractFunction(src, 'shelfValueForKey', 'index.html'),
  extractFunction(src, 'inventoryValue', 'index.html'),
  extractFunction(src, 'incomeStatement', 'index.html'),
  extractFunction(src, 'balanceSheetToday', 'index.html'),
  extractFunction(src, 'cashFlowStatement', 'index.html'),
  extractFunction(src, 'statementBasisGap', 'index.html'),
  extractFunction(src, 'statementChecks', 'index.html'),
], {
  data,
  todayISO: () => TODAY,
  /* The consignment accrual now asks whether the customer has actually
     paid, so it needs the invoice's own total to measure a part-payment
     against -- a debt that falls due on the invoice is not the same as
     cash the shop is holding. */
  savedQuoteTotal: (q) => (q.items || []).reduce((s, i) => s + (Number(i.qty) || 0) * (Number(i.sellPrice) || 0), 0),
  quoteItemSellPrice: (it) => Number(it.sellPrice) || 0,
  dashTotalCreditors: () => 0,
  fmtUGX: (n) => Number(n || 0).toLocaleString('en-US') + ' UGX',
}, ['incomeStatement', 'balanceSheetToday', 'cashFlowStatement', 'statementChecks', 'inventoryValue', 'duesOwed', 'statementBasisGap', 'balanceSheetAsAt', 'dueSettledCashIds', 'dueCostRows', 'statementOpexRows']);

const r = (n) => Math.round(n);
const txn = (over) => Object.assign({ id: 1, date: TODAY, account: 'cash', type: 'expense', category: 'Rent', amount: 0 }, over);
const sale = (over) => Object.assign({
  id: 900, client: { name: 'Okello' }, date: TODAY, status: 'completed', invoiced: true,
  invoicedTs: Date.now(), voided: false, amountPaid: 0, payments: [], customerId: 'C1',
  items: [{ productId: 'P1', qty: 10, supplierId: '__stock__', price: 34000, sellPrice: 45000,
    _stockLots: [{ qty: 10, cost: 30000 }] }],
}, over);
const reset = () => {
  data.savedQuotes = []; data.customers = []; data.cashTxns = [];
  data.cashDays = { [TODAY]: { opening: { cash: 0, momo: 0, bank: 0 }, actual: {}, openingSet: true } };
  data.stock = {}; data.stockLots = {}; data.fixedAssets = []; data.loans = []; data.dues = [];
};

/* ---------- 1. profit, built from the corrected pieces ---------------- */
{
  reset();
  data.savedQuotes = [sale()];
  data.cashTxns = [
    txn({ id: 1, type: 'expense', category: 'Transport', amount: 150000 }),
    txn({ id: 2, type: 'payment', category: 'Agent Commission', amount: 80000 }),
    txn({ id: 3, type: 'expense', category: 'Fuel', amount: 71000 }),
  ];
  const is = scope.incomeStatement('2026-08-01', TODAY);

  t.check(is.revenue === 450000, 'revenue is what was invoiced');
  t.check(is.costOfSales === 300000,
    `cost of sales is what the goods actually cost, not the quoted estimate (got ${is.costOfSales})`);
  t.check(is.grossProfit === 150000, 'so gross profit is the difference');
  t.check(is.opex === 301000,
    `operating costs include the commission and the shopkeeper's own category (got ${is.opex})`);
  t.check(is.opexRows['Agent Commission'] === 80000 && is.opexRows.Fuel === 71000,
    'itemised, so the statement shows where the money went rather than one lump');
  t.check(is.operatingProfit === 150000 - 301000, 'operating profit follows');
  t.check(is.netProfit === is.operatingProfit, 'and with no borrowing or assets, net profit equals it');
}

/* ---------- 2. nothing is counted twice ------------------------------- */
{
  reset();
  data.savedQuotes = [sale()];
  data.cashTxns = [
    txn({ id: 1, type: 'payment', category: 'Stock Purchase', amount: 600000 }),
    txn({ id: 2, type: 'payment', category: 'Supplier Payment', amount: 400000 }),
    txn({ id: 3, type: 'receipt', category: 'Debt Collection', amount: 900000 }),
    txn({ id: 4, type: 'receipt', category: 'Loan Received', amount: 19400000 }),
    txn({ id: 5, type: 'receipt', category: 'Owner Investment', amount: 5000000 }),
  ];
  const is = scope.incomeStatement('2026-08-01', TODAY);

  t.check(is.opex === 0,
    'buying stock and settling a payable are not operating costs -- both are already costed through COGS');
  t.check(is.revenue === 450000,
    'and revenue is the invoice alone: a loan is borrowed, the owner\'s money is equity, and collecting a debt books a sale that was already booked');
  t.check(is.netProfit === 150000, 'so profit is unmoved by 25,300,000 of cash arriving');
}

/* ---------- rent and wages are the months they are FOR ----------------
 *
 * Reported from the shop, off a one-day profit and loss: rent showed
 * 600,000 on the day it was paid and nothing on any other day, and the
 * day before showed a whole month of wages. Both lines came from the
 * CASH BOOK, so they landed whole on payday -- a month settled a week
 * late showed no rent in the month it was for and two in the month
 * after.
 *
 * Phase 1 settled on cash for operating costs and said why: "the
 * alternative needs a prepayments subledger this app does not have". It
 * has one now -- data.dues, a row per premises per month and per person
 * per month, which the balance sheet has read as a liability since
 * Payroll & rent was built. So these two lines come from the month they
 * are FOR, apportioned across its days. Every other running cost has no
 * month behind it and is still cash.
 */
{
  reset();
  data.dues = [
    { id: 1, kind: 'rent', refId: '1', period: '2026-08', dueDate: '2026-08-01',
      amount: 620000, paid: 0, payments: [] },
    { id: 2, kind: 'wage', refId: '1', period: '2026-08', dueDate: '2026-08-31',
      amount: 310000, paid: 0, payments: [] },
  ];
  const day = scope.incomeStatement('2026-08-03', '2026-08-03');
  t.check(r(day.opexRows.Rent) === r(620000 / 31),
    `one day of August charges one day of its rent (got ${r(day.opexRows.Rent)})`);
  t.check(r(day.opexRows['Salaries & Wages']) === r(310000 / 31),
    'and one day of its wages');

  const month = scope.incomeStatement('2026-08-01', '2026-08-31');
  t.check(r(month.opexRows.Rent) === 620000 && r(month.opexRows['Salaries & Wages']) === 310000,
    'a whole month is still the whole month, so no monthly figure moved');
  t.check(r(scope.incomeStatement('2026-09-01', '2026-09-30').opexRows.Rent || 0) === 0,
    'and August rent is not in September, whatever month it was paid in');

  /* THE MONTH IT IS FOR, NOT THE MONTH IT WAS PAID. Settled on 4
     September, and August still carries it. This is the whole change. */
  data.dues[0].payments = [{ date: '2026-09-04', amount: 620000, account: 'cash', cashTxnId: 99 }];
  data.dues[0].paid = 620000;
  data.cashTxns = [txn({ id: 99, type: 'payment', category: 'Rent', amount: 620000, date: '2026-09-04' })];
  t.check(r(scope.incomeStatement('2026-08-01', '2026-08-31').opexRows.Rent) === 620000,
    'rent settled in September is still August\'s cost');
  t.check(!scope.incomeStatement('2026-09-01', '2026-09-30').opexRows.Rent,
    'and it is not charged again in the month the money left');

  /* Which is only safe because the payment that settles a month is
     dropped from the cash side. Counting both would be the same rent
     twice, and it is the failure mode this design has to be proof
     against rather than merely careful about. */
  t.check(scope.dueSettledCashIds().has('99'),
    'the payment that settles a month is known by its link, not by its category');

  /* A rent payment typed straight into the Cash Book has no month behind
     it. It is a real cost and it stays -- on the day it was paid -- and
     the trust checks name it, because beside an accrued month it is the
     one line that could be the same rent twice. */
  data.cashTxns.push(txn({ id: 100, type: 'payment', category: 'Rent', amount: 55000, date: '2026-09-10' }));
  const sept = scope.incomeStatement('2026-09-01', '2026-09-30');
  t.check(r(sept.opexRows.Rent) === 55000,
    'a rent payment with no month behind it is still counted, on the day it was paid');
  t.check(sept.unlinkedDues.length === 1 && r(sept.unlinkedDuesTotal) === 55000,
    'and it is reported, so a check can say the same rent may be on the statement twice');

  /* A daily-paid month nobody has costed is a wage MISSING, not a wage
     of nothing. Named rather than shown as a nought. */
  data.dues.push({ id: 3, kind: 'wage', refId: '2', period: '2026-09', dueDate: '2026-09-30',
    amount: null, paid: 0, payments: [] });
  const sept2 = scope.incomeStatement('2026-09-01', '2026-09-30');
  t.check(sept2.uncostedDues.length === 1,
    'a month with no days entered is reported rather than counted as zero');
  t.check(!sept2.opexRows['Salaries & Wages'],
    'and nothing is invented for it');
  reset();
}

/* ---------- 3. assets and borrowing reach the statement --------------- */
{
  reset();
  data.savedQuotes = [sale()];
  data.fixedAssets = [{ id: 80, name: 'Van', cost: 20000000, acquiredOn: '2026-08-01',
    method: 'straight_line', lifeMonths: 60, salvage: 2000000, disposedOn: null }];
  data.loans = [{ id: 70, lender: 'Bank', principal: 20000000, fees: 600000, ratePct: 20,
    method: 'reducing_balance', termMonths: 36, startedOn: '2026-08-01', repayments: [] }];
  const is = scope.incomeStatement('2026-08-01', TODAY);

  /* THREE DAYS OF A MONTH, NOT THE MONTH. This read `=== 300000` -- a
     whole month's charge -- over a window of 1 to 3 August, and it was
     pinning the defect the shop reported off this very line: the period
     charge matched months as YYYY-MM and took each match WHOLE, so one
     day of a month charged all of it and eleven days spanning a month
     end charged two. The monthly charge is still (20m - 2m) / 60 =
     300,000; what changed is that a window gets the days of it that it
     covers. 3 of August's 31. */
  t.check(Math.round(is.depreciation) === Math.round(300000 * 3 / 31),
    `three days of a month's depreciation is charged, not the month (got ${Math.round(is.depreciation)})`);
  t.check(Math.round(scope.incomeStatement('2026-08-01', '2026-08-31').depreciation) === 300000,
    'and a whole month is still exactly a month, which is why no month-end figure moved');
  t.check(is.loanFees === 600000, 'and the fee the lender kept is a cost of the month it was drawn');

  /* INTEREST IS CHARGED, NOT PAID. It used to reach the statement only
     inside a repayment, on the day the repayment was made -- the cash
     basis -- so a month the shop missed showed no cost of borrowing and
     the month it caught up showed two. Rent, wages and depreciation had
     all moved off that basis and interest was left behind on it. It is
     charged now as the lender charges it: one period at a time, whether
     or not the instalment was paid. */
  const monthOfInterest = 20000000 * 0.20 / 12;
  t.check(is.interest === 0, 'three days into a loan nothing has been charged yet');
  const untouched = scope.incomeStatement('2026-09-01', '2026-09-30');
  t.check(r(untouched.interest) === r(monthOfInterest),
    `a month the shop did not pay still cost a month's interest (got ${r(untouched.interest)})`);
  data.loans[0].repayments = [{ date: '2026-09-01', amount: 800000 }];
  const withInterest = scope.incomeStatement('2026-09-01', '2026-09-30');
  t.check(r(withInterest.interest) === r(monthOfInterest),
    `and paying it on time charges exactly the same month (got ${r(withInterest.interest)})`);
  t.check(scope.incomeStatement('2026-08-01', TODAY).interest === 0,
    'and none of it lands before it was charged');
  // Paid six weeks late: the charge stays in September, and October is
  // charged once -- not for the arrears as well.
  data.loans[0].repayments = [{ date: '2026-10-15', amount: 800000 }];
  t.check(r(scope.incomeStatement('2026-09-01', '2026-09-30').interest) === r(monthOfInterest),
    'a repayment made late does not move the charge to the month the money finally left');
  t.check(r(scope.incomeStatement('2026-10-01', '2026-10-31').interest) === r(monthOfInterest),
    'and the month it was caught up in is charged for itself alone');
  /* What has been charged and not paid is OWED. The sheet carried the
     principal alone, so a month's interest left profit and was owed to
     nobody. */
  data.loans[0].repayments = [];
  const sep = scope.balanceSheetAsAt('2026-09-30');
  t.check(r(sep.loanCharges) === r(monthOfInterest),
    `interest charged and unpaid is owed to the lender (got ${r(sep.loanCharges)})`);
  t.check(r(sep.loans) === r(20000000 + monthOfInterest),
    'inside the loans line, beside the principal');
  /* THE CHARGE ON EVERY INSTALMENT reached no statement at all: it was
     taken off each repayment first, and the repayment is filed under
     Loan Repayment, which is not a running cost. It is a cost of
     borrowing and lands beside the interest. */
  data.loans[0].feePerInstallment = 50000;
  const charged = scope.incomeStatement('2026-09-01', '2026-09-30');
  t.check(charged.loanInstalmentCharges === 50000 && charged.loanFees === 50000,
    `the instalment charge is a cost of the month it fell due (got ${charged.loanFees})`);
  t.check(scope.incomeStatement('2026-08-01', TODAY).loanFees === 600000,
    'while the month of drawdown carries the arrangement fee and no instalment yet');
  data.loans[0].feePerInstallment = 0;
  /* The point is WHERE depreciation sits, not what it is: above
     operating profit, below gross. Written against the charge the same
     window produces rather than a copy of it, so this keeps testing the
     ordering after the apportioning above changed the amount. */
  t.check(r(is.operatingProfit) === r(150000 - is.depreciation),
    `depreciation sits above operating profit (got ${r(is.operatingProfit)})`);
  t.check(is.depreciation > 0, 'and it is a real charge, so the line above is not passing on a nought');
  t.check(is.netProfit === is.operatingProfit - 600000,
    'while the loan fee sits below it, being a cost of borrowing rather than of trading');

  // Selling an asset is a correction, not trading.
  data.fixedAssets = [{ id: 81, name: 'Old van', cost: 1200000, acquiredOn: '2026-01-01',
    method: 'straight_line', lifeMonths: 12, salvage: 0, disposedOn: '2026-08-02', disposalProceeds: 900000 }];
  data.loans = [];
  const is2 = scope.incomeStatement('2026-08-01', TODAY);
  /* Bought on 1 January, sold on 2 August: seven whole months and the
     two days of August it was still owned. The disposal month used to be
     skipped entirely -- the conservative half of a choice that only
     existed because a month could not be split -- so this read 400,000
     against a book value worn by seven months flat. Two days is not much
     of a correction, which is the point: it is the right two days. */
  const worn = 100000 * (7 + 2 / 31);
  t.check(is2.disposals.length === 1 && r(is2.disposalGain) === r(900000 - (1200000 - worn)),
    `a disposal is reported on its own line (got ${r(is2.disposalGain)})`);
  t.check(is2.operatingProfit !== is2.netProfit, 'below operating profit, not inside it');
  // And a sale that happened in another period belongs to that one.
  data.fixedAssets[0].disposedOn = '2026-06-02';
  const is3 = scope.incomeStatement('2026-08-01', TODAY);
  t.check(is3.disposals.length === 0 && is3.disposalGain === 0,
    'an asset sold before this period is not counted in it');
}

/* ---------- 4. what the shop is worth --------------------------------- */
{
  reset();
  data.cashDays[TODAY].opening = { cash: 2000000, momo: 500000, bank: 1000000 };
  data.customers = [{ id: 'C1', name: 'Okello', debt: 1200000, debtLog: [] }];
  /* The shelf holds 120: a hundred bought at 30,000 and twenty whose
     cost was never recorded. The COUNT is what is valued; the lots say
     what a unit cost. */
  data.stock = { 'P1::': 120 };
  data.stockLots = { 'P1::': [{ qty: 100, cost: 30000 }, { qty: 20, cost: null }] };
  data.fixedAssets = [{ id: 80, name: 'Van', cost: 20000000, acquiredOn: '2026-08-01',
    method: 'straight_line', lifeMonths: 60, salvage: 2000000, disposedOn: null }];
  data.loans = [{ id: 70, lender: 'Bank', principal: 20000000, fees: 0, ratePct: 20,
    method: 'reducing_balance', termMonths: 36, startedOn: '2026-08-01', repayments: [] }];
  data.cashTxns = [txn({ id: 1, type: 'receipt', category: 'Owner Investment', amount: 4000000 })];

  const bs = scope.balanceSheetToday();
  t.check(bs.cash === 3500000 + 4000000, 'cash is the Cash Book\'s own figure, openings included');
  t.check(bs.inventory === 3000000,
    'stock is valued at what it cost, from the same lots cost of sales is drawn from');
  t.check(bs.inventoryUncostedQty === 20,
    'and stock with no cost on file is counted rather than valued at a guess');
  /* Book value follows the charge, or the balance sheet would take a
     full month off the van on the 3rd while the profit and loss beside
     it showed three days. 20m less 3/31 of the 300,000 month. */
  t.check(Math.round(bs.fixedAssets) === Math.round(20000000 - 300000 * 3 / 31),
    `equipment is at book value, worn by the days elapsed, not what it cost (got ${Math.round(bs.fixedAssets)})`);
  t.check(bs.loans === 20000000, 'the loan is a liability for what is owed, not what arrived');
  t.check(bs.liabilities === bs.payables + bs.loans,
    'and it is inside total liabilities, not merely reported beside them');
  t.check(bs.equity === bs.assets - bs.liabilities,
    'so the net worth of the business is after the borrowing, not before it');
  t.check(bs.ownerCapital === 4000000, "the owner's money in is equity, not profit");

  t.check(Math.abs(bs.assets - (bs.liabilities + bs.equity)) < 0.01,
    'the sheet balances -- which it always will, since equity is the remainder');
  t.check(r(bs.retainedEarnings) === r(bs.equity - bs.ownerCapital),
    'and retained earnings is that remainder less what the owner put in');

  /* Which is why the LINE must not claim otherwise. "Profit kept in the
     business" says the app added up years of profit and put the answer
     here; it did not, and cannot -- there are no opening balances and no
     ledger. It is arrived at by subtraction, so every error anywhere
     else on the sheet lands in this one line, and the reader has to be
     told that where they read it rather than in a footnote below. */
  /* Pinned on the stLine CALL, not on the function's prose: the comment
     explaining the change quotes the old label, so a body-wide search
     for it matches the very note saying it was wrong. */
  const doc = (/function stBalanceSheet[\s\S]*?\n\}\n/.exec(src) || [''])[0];
  t.check(!/stLine\('Profit kept in the business'/.test(doc),
    'the line does not claim to be a total of profits earned');
  t.check(/stLine\('Kept in the business'/.test(doc),
    'and is named for what it is');
  /* As a hint, not merely as text present somewhere in the function.
     Renaming the key left the sentence sitting in the source, unrendered
     and unreachable, while a content-only check went on passing. */
  /* The opts now open with the drill key (the line's records can be
     previewed), so the hint is matched as a property rather than as the
     start of the object — its job is unchanged: rendered on the line. */
  t.check(/hint:'a balancing figure, not a running total of profit/.test(doc),
    'it says what it actually is, on the line where it is read');
  t.check(/anything unexplained elsewhere on this sheet lands here/.test(doc),
    'and that it absorbs everything the rest of the sheet could not explain');
}

/* ---------- 4b. wages and rent are a liability ------------------------ *
 * Wages for a month already worked, and rent for a month already
 * occupied, are money owed whether or not anybody has handed it over.
 * Suppliers were counted here from the start; the staff and the landlord
 * were not, so the sheet overstated what the shop was worth by exactly
 * what it owed its own people.
 */
{
  reset();
  data.cashDays[TODAY].opening = { cash: 5000000, momo: 0, bank: 0 };
  const due = (id, kind, amount, paid) => ({
    id, kind, refId: 'X', period: '2026-07', dueDate: '2026-07-31',
    amount, days: null, rate: amount || 0, paid: paid || 0, payments: [],
  });
  data.dues = [
    due(1, 'wage', 450000),            // a month worked, unpaid
    due(2, 'wage', 400000, 400000),    // settled -- owed nothing
    due(3, 'rent', 800000, 300000),    // part paid -- 500,000 left
    // Uncosted: a real obligation of an unknown size. It must not be
    // guessed at, and it must not be counted as nothing either.
    due(4, 'wage', null),
  ];

  const owed = scope.duesOwed();
  t.check(owed.wages === 450000, 'a settled month owes nothing and a worked one owes its whole wage');
  t.check(owed.rent === 500000, 'and a part-paid month owes only the remainder');
  t.check(owed.total === 950000, 'which is what the shop owes its people and its landlord');
  t.check(owed.uncostedCount === 1,
    'with the uncosted month counted separately rather than guessed at or ignored');
  /* The count is what makes the filter load-bearing: a settled month and
     an uncosted one both add 0 to the totals, so without this a version
     that counted every due whatever its balance summed identically. */
  t.check(owed.count === 2,
    'and only the two months actually owing something are in it');

  const bs = scope.balanceSheetToday();
  t.check(bs.staffAndRent === 950000, 'the balance sheet carries it');
  t.check(bs.liabilities === bs.payables + bs.loans + bs.staffAndRent,
    'inside total liabilities, not merely reported beside them');
  /* Its own line, not folded into payables: a supplier, a member of
     staff and a landlord are three different creditors, and the one you
     can least afford to keep waiting is not the one on an invoice. */
  t.check(bs.payables !== bs.staffAndRent || bs.staffAndRent === 0,
    'and separately from what is owed to suppliers');
  t.check(bs.equity === bs.assets - bs.liabilities,
    'so net worth is after what is owed to staff, not before it');

  // Nothing owed, nothing added.
  data.dues = [due(5, 'wage', 400000, 400000)];
  t.check(scope.balanceSheetToday().staffAndRent === 0,
    'a shop that has paid everybody carries no such liability');
  data.dues = [];
}

/* ---------- 4b. paid in advance ---------------------------------------- */
/*
 * The profit and loss charges rent by the day. The sheet did not
 * follow: a month's rent paid on the 1st left cash on the 1st, nothing
 * stood in for the thirty days it had bought, and net worth fell by the
 * month while profit had fallen by a day. The difference sat in "kept
 * in the business", where nobody could explain it.
 */
{
  reset();
  data.cashDays[TODAY].opening = { cash: 5000000, momo: 0, bank: 0 };
  const rentDue = (over) => Object.assign({ id: 9, kind: 'rent', refId: 'R1', period: '2026-08', dueDate: '2026-08-01',
    amount: 620000, days: null, rate: 620000, paid: 0, payments: [] }, over);
  // August's rent, due on the 1st and paid on the 1st. Today is the 3rd.
  data.dues = [rentDue({ paid: 620000, payments: [{ date: '2026-08-01', amount: 620000, cashTxnId: 5 }] })];
  data.cashTxns = [txn({ id: 5, date: '2026-08-01', type: 'payment', category: 'Rent', amount: 620000 })];
  const bs = scope.balanceSheetToday();
  t.check(r(bs.prepaid) === r(620000 * 28 / 31),
    `twenty-eight days of a month paid on the 1st are still an asset on the 3rd (got ${r(bs.prepaid)})`);
  t.check(bs.staffAndRent === 0, 'and nothing is owed on it');
  t.check(Math.abs(bs.assets - (bs.cash + bs.receivables + bs.inventory + bs.fixedAssets + bs.prepaid)) < 0.01,
    'inside total assets');
  const is = scope.incomeStatement('2026-08-01', TODAY);
  t.check(r(is.opexRows['Rent']) === r(620000 * 3 / 31), 'while the profit and loss has charged three days');
  t.check(Math.abs((620000 - bs.prepaid) - is.opexRows['Rent']) < 0.01,
    'so net worth moved by exactly what profit did');

  // Unpaid and not yet due: the days occupied are owed all the same.
  data.dues = [rentDue({ dueDate: '2026-08-28' })];
  data.cashTxns = [];
  const bs2 = scope.balanceSheetToday();
  t.check(r(bs2.staffAndRent) === r(620000 * 3 / 31),
    `rent not yet due is owed for the days occupied (got ${r(bs2.staffAndRent)})`);
  t.check(bs2.prepaid === 0, 'and none of it is in advance');

  // Unpaid and fallen due: the landlord is owed the month, and the days
  // not yet reached are shown as paid for in advance -- the paying is
  // still to come, but the sheet must not net the two into a figure the
  // landlord's own book would not recognise.
  data.dues = [rentDue()];
  const bs3 = scope.balanceSheetToday();
  t.check(bs3.staffAndRent === 620000, 'rent fallen due and unpaid is owed whole');
  t.check(r(bs3.prepaid) === r(620000 * 28 / 31), 'with the days not yet reached as paid for in advance');
  reset();
}

/* ---------- 4c. a running cost that covers a stretch of days ---------- */
/*
 * A trading licence for the year, paid in August. Counted on the day it
 * was paid it made August a bad month and the eleven after it better
 * than they were -- exactly what the van did before the asset register.
 */
{
  reset();
  data.cashDays[TODAY].opening = { cash: 5000000, momo: 0, bank: 0 };
  data.cashTxns = [
    txn({ id: 1, date: '2026-08-02', type: 'expense', category: 'Licences', amount: 365000,
      coversFrom: '2026-08-01', coversTo: '2027-07-31' }),
    txn({ id: 2, date: '2026-08-02', type: 'expense', category: 'Transport', amount: 40000 }),
  ];
  const is = scope.incomeStatement('2026-08-01', TODAY);
  t.check(r(is.opexRows['Licences']) === r(365000 * 3 / 365),
    `three days of a year's licence are charged, not the year (got ${r(is.opexRows['Licences'])})`);
  t.check(is.opexRows['Transport'] === 40000, 'while an entry with no days on it is still a cost of the day it was paid');
  t.check(r(scope.incomeStatement('2027-03-01', '2027-03-31').opexRows['Licences']) === r(365000 * 31 / 365),
    'and a month next year, long after the money left, carries its own share');
  const cf = scope.cashFlowStatement('2026-08-01', TODAY);
  t.check(cf.operatingOut === 405000, 'the cash flow is untouched: the money left on the day it left');
  const bs = scope.balanceSheetToday();
  t.check(r(bs.prepaid) === r(365000 * 362 / 365),
    `the days not yet reached are paid for in advance (got ${r(bs.prepaid)})`);
  t.check(Math.abs((365000 - bs.prepaid) - is.opexRows['Licences']) < 0.01,
    'so net worth moved by exactly what profit did');
  /* Dated after the days it covers -- a bill for last month paid next
     week -- the days already gone are owed, not in advance. */
  data.cashTxns = [txn({ id: 3, date: '2026-08-10', type: 'expense', category: 'Power', amount: 310000,
    coversFrom: '2026-07-04', coversTo: '2026-08-03' })];
  const bill = scope.balanceSheetToday();
  t.check(bill.prepaid === 0 && bill.accruedCosts === 310000,
    `a bill covering days already gone, not yet paid, is owed in full (got ${bill.accruedCosts})`);
  t.check(Math.abs(bill.liabilities - (bill.payables + bill.loans + bill.staffAndRent + bill.accruedCosts)) < 0.01,
    'inside total liabilities');
  t.check(r(scope.incomeStatement('2026-07-01', '2026-07-31').opexRows['Power']) === r(310000 * 28 / 31),
    'while July carries the twenty-eight days of it that were July\u2019s');
  reset();
}

/* ---------- 5. where the money went ----------------------------------- */
{
  reset();
  data.cashTxns = [
    txn({ id: 1, type: 'receipt', category: 'Sales Revenue', amount: 450000 }),
    txn({ id: 2, type: 'receipt', category: 'Debt Collection', amount: 900000 }),
    txn({ id: 3, type: 'expense', category: 'Transport', amount: 150000 }),
    txn({ id: 4, type: 'payment', category: 'Stock Purchase', amount: 600000 }),
    txn({ id: 5, type: 'receipt', category: 'Loan Received', amount: 19400000 }),
  ];
  const cf = scope.cashFlowStatement('2026-08-01', TODAY);
  t.check(cf.tradingIn === 450000 && cf.debtCollected === 900000,
    'money from selling and money from collecting are separate lines -- one is this period\'s trading, the other is an older sale being settled');
  t.check(cf.operating === 450000 + 900000 - 150000 - 600000, 'and trading nets to what it netted');
  t.check(cf.financing === 19400000, 'borrowing is financing, not trading');
  t.check(cf.netMovement === 450000 + 900000 - 150000 - 600000 + 19400000, 'the total is every movement');
  t.check(Math.abs(cf.unclassified) < 0.01,
    'and nothing falls between the sections -- the parts add up to the whole');

  // Repaying a loan is financing, and emphatically not a running cost:
  // the principal settles a liability the shop already had, and its
  // interest is charged from the loan's own record. Counted here it would
  // expense the principal and charge the interest twice.
  data.cashTxns.push(txn({ id: 6, type: 'payment', category: 'Loan Repayment', amount: 500000 }));
  const cf2 = scope.cashFlowStatement('2026-08-01', TODAY);
  t.check(cf2.repaid === 500000 && cf2.financing === 19400000 - 500000,
    'a loan repayment reduces financing rather than trading');
  t.check(cf2.operating === cf.operating, 'and leaves the trading figure untouched');
  const isRepaid = scope.incomeStatement('2026-08-01', TODAY);
  t.check(!Object.keys(isRepaid.opexRows).includes('Loan Repayment'),
    'nor does it appear as a running cost on the profit and loss');
  t.check(Math.abs(cf2.netMovement - (cf2.operating + cf2.investing + cf2.financing + cf2.unclassified)) < 0.01,
    'the three sections plus what is unclassified always reconstruct the total');

  /* Investing exists because the asset register writes the category
     itself. Before it did, there was no honest way to tell a payment for a
     van from a payment for rent, and the statement said so rather than
     guessing. Now it is a fact the app recorded.

     Two things have to hold at once, and they are separate failures: the
     purchase belongs to investing, and it must NOT be a running cost --
     expensing the van here would charge it in full this month and then
     charge it again, month by month, as depreciation. */
  data.cashTxns.push(txn({ id: 7, type: 'payment', category: 'Equipment purchase', amount: 4000000 }));
  data.cashTxns.push(txn({ id: 8, type: 'receipt', category: 'Asset Sale', amount: 1500000 }));
  const cf3 = scope.cashFlowStatement('2026-08-01', TODAY);
  t.check(cf3.equipmentOut === 4000000 && cf3.assetSaleIn === 1500000,
    'buying and selling equipment are separate lines, not a single net figure');
  t.check(cf3.investing === 1500000 - 4000000, 'and investing is what the two of them came to');
  t.check(cf3.operating === cf2.operating,
    'buying a van does not touch trading -- it is not a running cost and never was');
  t.check(cf3.tradingIn === cf2.tradingIn,
    'nor do the proceeds of selling one count as money earned from customers');
  const isCapital = scope.incomeStatement('2026-08-01', TODAY);
  t.check(!Object.keys(isCapital.opexRows).includes('Equipment purchase'),
    'the van is absent from the profit and loss, which sees it one month at a time as depreciation');
  t.check(Math.abs(cf3.unclassified) < 0.01,
    'and the new categories fall inside a section rather than between them');

  /* `unclassified` should always be zero as the categories stand: every
     movement out is stock, a supplier, a repayment or a running cost, and
     every movement in is trading, borrowing, owner's money or a debt
     settled. It is a tripwire, not an expected figure -- it exists so
     that a category added or reclassified later cannot quietly fall
     between the sections and leave the statement not adding up.

     Asserted as zero across every shape above rather than by contriving
     a leftover, because contriving one would mean asserting behaviour
     the classification cannot currently produce. */
  [cf, cf2, cf3].forEach((c, i)=>{
    t.check(Math.abs(c.unclassified) < 0.01,
      `every movement falls into a section, so nothing is left over (case ${i + 1})`);
    t.check(Math.abs(c.netMovement - (c.operating + c.investing + c.financing + c.unclassified)) < 0.01,
      `and the sections reconstruct the total exactly (case ${i + 1})`);
  });
}

/* ---------- 6. the checks are the point ------------------------------- */
{
  reset();
  data.cashDays[TODAY] = { opening: { cash: 1000000, momo: 0, bank: 0 },
    actual: { cash: 1200000, momo: '', bank: '' }, openingSet: true };
  data.savedQuotes = [sale({ items: [{ productId: 'P1', qty: 10, supplierId: '__stock__',
    price: 34000, sellPrice: 45000, _stockLots: [{ qty: 6, cost: 30000 }] }] })];
  data.stock = { 'P1::': 5 };
  data.stockLots = { 'P1::': [{ qty: 5, cost: null }] };

  const is = scope.incomeStatement('2026-08-01', TODAY);
  const bs = scope.balanceSheetToday();
  const cf = scope.cashFlowStatement('2026-08-01', TODAY);
  const checks = scope.statementChecks(is, bs, cf);
  const find = (s) => checks.find((c) => c.label.includes(s));

  const cashCheck = find('counted');
  t.check(cashCheck && cashCheck.ok === false,
    'a cash figure that disagrees with the physical count is reported as a failure, not smoothed over');
  t.check(/200,000/.test(cashCheck.detail), 'naming the size of the gap');

  t.check(find('estimates') && find('estimates').ok === false,
    'cost of sales resting on estimates is declared -- four of the ten units sold had no recorded cost');
  t.check(find('no cost on file') && find('no cost on file').ok === false,
    'and so is stock valued at nothing because its cost was never recorded');

  const construction = find('by construction');
  t.check(construction && construction.ok === null,
    'and the sheet balancing is stated as proving nothing, rather than presented as a passed check');

  // With everything counted and costed, the cash check passes.
  reset();
  data.cashDays[TODAY] = { opening: { cash: 1000000, momo: 0, bank: 0 },
    actual: { cash: 1000000, momo: 0, bank: 0 }, openingSet: true };
  const clean = scope.statementChecks(
    scope.incomeStatement('2026-08-01', TODAY), scope.balanceSheetToday(),
    scope.cashFlowStatement('2026-08-01', TODAY));
  t.check(clean.find((c) => c.label.includes('counted')).ok === true,
    'a count that agrees with the books passes');
  t.check(!clean.some((c) => c.ok === false), 'and a clean shop raises nothing');

  // A shop that has not counted has an UNVERIFIED cash figure, which is
  // not the same as a verified one. Reported as neither pass nor fail,
  // because claiming either would be a lie about what is known.
  reset();
  data.cashDays[TODAY] = { opening: { cash: 1000000, momo: 0, bank: 0 }, actual: {}, openingSet: true };
  const uncounted = scope.statementChecks(
    scope.incomeStatement('2026-08-01', TODAY), scope.balanceSheetToday(),
    scope.cashFlowStatement('2026-08-01', TODAY));
  const cashRow = uncounted.find((c) => /count/.test(c.label));
  t.check(cashRow && cashRow.ok === null,
    'a shop that counted nothing is told its cash is unverified, not that it checks out');
  t.check(/Close the day/.test(cashRow.detail), 'and told how to verify it');
}

/* ---------- 7. wired onto the board ----------------------------------- */
{
  const code = src.split(/\r?\n/).map((l) => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');
  t.check(/if\(tab==='statements'\) renderStatements\(\);/.test(code), 'the tab renders the statements');
  t.check(/id="tab-statements"/.test(code) && /id="st_body"/.test(code), 'and the section exists to render into');
  // One page per document. Three statements and thirteen ratios on a
  // single scroll is a report nobody reads to the bottom.
  ['overview', 'pl', 'bs', 'cf', 'ratios'].forEach((tab)=>{
    t.check(new RegExp(`data-stab="${tab}"`).test(code), `there is a ${tab} view to switch to`);
  });
  /* The picking moved into statementDocHTML so that printing goes
     through the same renderers as the screen -- a separate print path is
     how a printed balance sheet comes to disagree with the one it was
     printed from. What still has to hold is that the BODY shows one
     document, not the single scroll this replaced. */
  /* The document now renders beside the records-preview panel, so it is
     interpolated into a split layout rather than assigned directly. What
     the check protects is unchanged: ONE document keyed off the active
     tab, never the five-statement scroll this replaced. */
  t.check(/\$\{statementDocHTML\(stActiveTab, ctx\)\}/.test(code)
    && /: statementDocHTML\(stActiveTab, ctx\);/.test(code),
    'and the body renders one of them rather than all of them at once');
  t.check(/key === 'pl'\s+\? stProfitAndLoss/.test(code),
    'chosen by key, one renderer per document');

  // Printing is the one place that deliberately takes all five, and it
  // takes them from the same function.
  t.check(/which === 'all' \? ST_DOCS : ST_DOCS\.filter\(d=> d\.key === which\)/.test(code),
    'printing takes either the one on screen or the whole set');
  t.check(/statementDocHTML\(d\.key, ctx\)/.test(code),
    'built from the same renderer the screen uses, so paper cannot disagree with the screen');

  // -0 is what negating zero gives, and toLocaleString prints it. On a
  // statement it reads as a figure somebody worked out.
  t.check(/function stZero\(n\)\{ return Math\.round\(n\) \|\| 0; \}/.test(code),
    'a negated zero prints as 0, not -0');
  t.check(/fmtUGX\(stZero\(value\)\)/.test(code) && /fmtUGX\(stZero\(prior\)\)/.test(code),
    'on both the figure and its comparison, every expense line being a negated value');

  // A percentage change measured from a loss is arithmetic without
  // meaning: -300,000 to 800,000 is not "up 367%".
  t.check(/if\(before < 0 \|\| now < 0\)\{/.test(code),
    'a change that straddles zero says its direction rather than inventing a percentage');
  t.check(/from a loss/.test(code) && /into a loss/.test(code),
    'and names which way it crossed');

  t.check(/balanceSheetToday/.test(code) && !/balanceSheetAt\(/.test(code),
    'the balance sheet is offered for today only -- cash, debtors and stock are current balances, so a sheet dated last March would be today\'s figures under last March\'s heading');
}

/* ---------- the owner taking money home is not a cost ---------------- */
/*
 * From the shop: a 900,000 "Capital Withdrawal" recorded to bring the
 * book's cash down to the drawer's, which then appeared in the profit
 * and loss as an operating expense. The shopkeeper's own question was
 * the correct review: "is capital withdrawal really an expense?"
 *
 * It is not. It is the mirror of Owner Investment — equity moving the
 * other way. A shop that earned 2,000,000 and whose owner took 900,000
 * home still earned 2,000,000; what changed is where the money sits.
 * So it belongs in the cash flow's financing section and on the equity
 * lines of the balance sheet, and must never move profit. Before this,
 * it also fell into retained earnings — the balancing figure — where it
 * read as a trading loss the shop never made.
 */
{
  reset();
  data.savedQuotes = [sale()];
  data.cashTxns = [
    txn({ id: 1, type: 'expense', category: 'Transport', amount: 150000 }),
    txn({ id: 2, type: 'receipt', category: 'Owner Investment', amount: 1000000 }),
    txn({ id: 3, type: 'expense', category: 'Capital Withdrawal', amount: 900000 }),
    txn({ id: 4, type: 'expense', category: 'Owner Withdrawal', amount: 20000 }),
  ];
  const is = scope.incomeStatement('2026-08-01', TODAY);
  t.check(is.opex === 150000,
    `operating costs carry the transport and neither withdrawal (got ${is.opex})`);
  t.check(!('Capital Withdrawal' in is.opexRows) && !('Owner Withdrawal' in is.opexRows),
    'so no withdrawal line appears on the profit and loss at all');
  t.check(is.netProfit === 450000 - 300000 - 150000,
    `and profit is what the shop earned, unmoved by what the owner took home (got ${is.netProfit})`);

  const cf = scope.cashFlowStatement('2026-08-01', TODAY);
  t.check(cf.ownerOut === 920000, 'the cash flow carries the withdrawals by name');
  t.check(cf.financing === 1000000 - 920000,
    `in financing, the mirror of the owner putting money in (got ${cf.financing})`);
  t.check(cf.operatingOut === 150000,
    'while trading\u2019s outgoings are only the real running costs');
  t.check(Math.abs(cf.unclassified) < 0.01,
    'and nothing falls between the sections — the statement still adds up');

  const bs = scope.balanceSheetToday();
  t.check(bs.ownerDrawings === 920000, 'the balance sheet shows what the owner took out');
  t.check(bs.retainedEarnings === bs.equity - (1000000 - 920000),
    'and retained earnings is net worth less the owner\u2019s NET money — a withdrawal no longer reads as a trading loss');
  /* The invariant in one line: drawings change WHERE the equity sits,
     never how much the business itself explains. */
  t.check(bs.ownerCapital - bs.ownerDrawings + bs.retainedEarnings === bs.equity,
    'put in, less taken out, plus kept — the equity section still closes');
}

/* ---------- an invoiced sale's own receipt is not a second sale ------- */
/*
 * From the shop, verbatim: "These figures are missing 50% of what the
 * shop took — 15,717,000 came in as sales cash with no invoice behind
 * it." The shopkeeper's reply was the finding: "but the invoices are
 * there that total that amount."
 *
 * They were. The gap tested the quoteId stamp on the cash entry, and the
 * only writer that ever stamped it was the mobile-money webhook — every
 * till payment recorded through the app itself went out unstamped. So a
 * shop that invoices everything was told half its takings had no invoice
 * behind them: the same money, seen once as the invoice and again as its
 * own receipt. The invoices' payment records (cashTxnId, written with
 * every payment since the feature existed) are the link that was there
 * all along, and are what the gap reads now.
 *
 * And a debtor settling up was "sales cash" too: the payment screens
 * write 'Debt Payment', the statements only knew 'Debt Collection', so
 * collections posed as fresh takings on top of the sales already booked.
 */
{
  reset();
  // An invoiced sale, paid at the till: the payment keeps the id of the
  // cash entry it created, exactly as ip_save writes it.
  data.savedQuotes = [sale({ amountPaid: 450000, payments: [{ date: TODAY, amount: 450000, cashTxnId: 71 }] })];
  data.cashTxns = [
    txn({ id: 71, type: 'receipt', category: 'Invoice Payment', amount: 450000 }),
    // A debtor clearing an older sale, by the name the screens write.
    txn({ id: 72, type: 'receipt', category: 'Debt Payment', amount: 795000 }),
    // And one genuine counter taking with no document behind it.
    txn({ id: 73, type: 'receipt', category: 'Sales Revenue', amount: 60000 }),
  ];
  const is = scope.incomeStatement('2026-08-01', TODAY);
  const cf = scope.cashFlowStatement('2026-08-01', TODAY);

  t.check(cf.tradingInUninvoiced === 60000,
    `only the undocumented taking counts as uninvoiced — not the invoice's own receipt, not the debt payment (got ${cf.tradingInUninvoiced})`);
  t.check(cf.debtCollected === 795000,
    'a debt payment is collections, by either name it was written under');
  t.check(cf.tradingIn === 450000 + 60000,
    `received from sales carries the till money and not the collections (got ${cf.tradingIn})`);

  const gap = scope.statementBasisGap(is, cf);
  t.check(gap.uninvoiced === 60000,
    `the warning names the 60,000 actually undocumented, not the half of takings it used to claim (got ${gap.uninvoiced})`);

  // The exact shape of the false alarm, pinned so it cannot return: the
  // same books with the payment link ignored would have called 510,000
  // of 510,000 receipts uninvoiced.
  data.savedQuotes[0].payments[0].cashTxnId = null;
  const cfUnlinked = scope.cashFlowStatement('2026-08-01', TODAY);
  t.check(cfUnlinked.tradingInUninvoiced === 450000 + 60000,
    'severing the payment record puts the receipt back outside the invoices — the link is the evidence, not the category name');
}

process.exit(t.done() ? 1 : 0);
