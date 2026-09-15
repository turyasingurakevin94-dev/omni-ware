#!/usr/bin/env node
'use strict';
/*
 * The drawer against the book, and what to write when they disagree.
 *
 * THE CASE THIS COMES FROM. A shop counted its cash, found 900,000 less
 * than the book claimed, and had no entry to make -- so it reached for
 * the category nearest to hand and entered a Capital Withdrawal. The cash
 * came right. Everything else went wrong quietly: the balance sheet now
 * said the owner had taken 900,000 home, so drawings were overstated by
 * the whole amount and retained earnings with them, and the shop's
 * trading read 900,000 better than it had been. A plug that balances is
 * the most dangerous kind of wrong entry, because nothing on screen
 * disagrees with it.
 *
 * So the substance here is not the button. It is that a count difference
 * is an ACCOUNT of its own, with two names for its two directions and one
 * line on the profit and loss, and that every statement reading the cash
 * book has to be taught about both names at once. Miss one and the money
 * does not vanish -- it lands somewhere plausible and stays there:
 *
 *   left as trading income   an overage becomes takings with no invoice
 *                            behind it, and a 5,000 miscount raises the
 *                            basis-gap warning about uninvoiced counter
 *                            sales, which is a different problem entirely
 *   left off the P&L         shortages are charged month after month
 *                            while the overages answering them credit
 *                            nothing, because revenue here comes from
 *                            invoices and a cash receipt is not one
 *   left out of the cash     it belongs to no section of the cash flow,
 *   flow's sections          and the statement stops adding up
 *
 * Each of those is a test below.
 *
 * Run: node test/cash-count-variance.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('cash count variance');
const src = read('index.html');
const code = src.split(/\r?\n/).map(l => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');

const TODAY = '2026-08-17';
const data = {
  savedQuotes: [], customers: [], cashTxns: [], cashDays: {},
  stock: {}, stockLots: {}, fixedAssets: [], loans: [],
};

let viewedDate = TODAY;
let confirmAnswer = true;
let confirmAsked = [];
let toasts = [];
let nextId = 1;

const scope = compileScope([
  extractDeclaration(src, 'ACCOUNTS', 'index.html'),
  extractDeclaration(src, 'CASH_NOT_OPEX', 'index.html'),
  extractDeclaration(src, 'CASH_NOT_REVENUE', 'index.html'),
  extractDeclaration(src, 'CASH_OWNER_WITHDRAWAL', 'index.html'),
  extractDeclaration(src, 'CASH_SHORTAGE_CATEGORY', 'index.html'),
  extractDeclaration(src, 'CASH_OVERAGE_CATEGORY', 'index.html'),
  extractDeclaration(src, 'CASH_VARIANCE_LINE', 'index.html'),
  extractDeclaration(src, 'cashHas', 'index.html'),
  extractFunction(src, 'chargeCostedCashIds', 'index.html'),
  extractFunction(src, 'cashIsMoneyIn', 'index.html'),
  extractFunction(src, 'cashIsMoneyOut', 'index.html'),
  extractFunction(src, 'cashIsOperatingExpense', 'index.html'),
  extractFunction(src, 'cashIsTradingIncome', 'index.html'),
  extractFunction(src, 'cashIsDebtCollection', 'index.html'),
  extractFunction(src, 'cashIsOwnerWithdrawal', 'index.html'),
  extractFunction(src, 'cashIsCashShortage', 'index.html'),
  extractFunction(src, 'cashIsCashOverage', 'index.html'),
  extractFunction(src, 'cashOpexRows', 'index.html'),
  extractDeclaration(src, 'DUE_KINDS', 'index.html'),
  extractFunction(src, 'dueCostBetween', 'index.html'),
  extractFunction(src, 'dueCostRows', 'index.html'),
  extractFunction(src, 'dueSettledCashIds', 'index.html'),
  extractFunction(src, 'unlinkedDuePayments', 'index.html'),
  extractFunction(src, 'uncostedDuesInRange', 'index.html'),
  extractFunction(src, 'cashIsSpreadCost', 'index.html'),
  extractFunction(src, 'spreadCostTxns', 'index.html'),
  extractFunction(src, 'spreadDays', 'index.html'),
  extractFunction(src, 'spreadCostBetween', 'index.html'),
  extractFunction(src, 'spreadCostRows', 'index.html'),
  extractFunction(src, 'statementOpexRows', 'index.html'),
  extractFunction(src, 'cashOpexTotal', 'index.html'),
  extractFunction(src, 'withPresetCategory', 'index.html'),
  extractFunction(src, 'invoiceBackedCashTxnIds', 'index.html'),
  extractFunction(src, 'dashCashTxnsInRange', 'index.html'),
  extractFunction(src, 'invoiceLineCost', 'index.html'),
  extractFunction(src, 'anInvoiceTotals', 'index.html'),
  extractFunction(src, 'anOverallTotals', 'index.html'),
  extractFunction(src, 'anInvoicesInRange', 'index.html'),
  extractFunction(src, 'incomeStatement', 'index.html'),
  extractFunction(src, 'cashFlowStatement', 'index.html'),
  extractFunction(src, 'statementBasisGap', 'index.html'),
  // The cash book side: the count, and the entry that answers it.
  extractFunction(src, 'accountLabel', 'index.html'),
  extractFunction(src, 'cbAccountTotals', 'index.html'),
  extractFunction(src, 'cbClosingFor', 'index.html'),
  extractFunction(src, 'previousCashDate', 'index.html'),
  extractFunction(src, 'carriedOpening', 'index.html'),
  extractFunction(src, 'getDayRecord', 'index.html'),
  extractFunction(src, 'cbDayPosition', 'index.html'),
  extractFunction(src, 'cbVarianceMeaning', 'index.html'),
  extractFunction(src, 'addCashPayment', 'index.html'),
  extractFunction(src, 'addCashReceipt', 'index.html'),
  extractFunction(src, 'recordCountVariance', 'index.html'),
  // compileScope only hands back functions, so the names come out through one.
  'function names(){ return {CASH_SHORTAGE_CATEGORY, CASH_OVERAGE_CATEGORY, CASH_VARIANCE_LINE}; }',
], {
  data,
  todayISO: () => TODAY,
  currentCbDate: () => viewedDate,
  document: { getElementById: () => null },
  saveData: () => {},
  allocRowId: () => nextId++,
  renderCbTransactions: () => {},
  renderCbSummary: () => {},
  renderCbTriggers: () => {},
  toast: (m) => toasts.push(m),
  confirm: (m) => { confirmAsked.push(m); return confirmAnswer; },
  fmtUGX: (n) => Number(n || 0).toLocaleString('en-US') + ' UGX',
  quoteItemSellPrice: (it) => Number(it.sellPrice) || 0,
  // Not what this file is about; each has its own.
  depreciationForPeriod: () => 0,
  loanChargesForPeriod: () => 0,
  loanInterestForPeriod: () => 0,
  loanFeesForPeriod: () => 0,
  liveFixedAssets: () => [],
  assetDisposalResult: () => ({ gain: 0 }),
}, [
  'incomeStatement', 'cashFlowStatement', 'statementBasisGap', 'recordCountVariance',
  'cbDayPosition', 'cbVarianceMeaning', 'withPresetCategory', 'names', 'cashOpexTotal',
  'cashIsCashShortage', 'cashIsCashOverage', 'cashIsOperatingExpense',
  'cashIsTradingIncome', 'cashIsOwnerWithdrawal',
]);

const { CASH_SHORTAGE_CATEGORY: SHORT, CASH_OVERAGE_CATEGORY: OVER, CASH_VARIANCE_LINE: LINE } = scope.names();
const FROM = '2026-08-01', TO = '2026-08-31';
const txn = (over) => Object.assign(
  { id: nextId++, date: TODAY, account: 'cash', type: 'expense', category: 'Rent', amount: 0 }, over);
const reset = (opening) => {
  data.cashTxns = []; data.savedQuotes = []; data.customers = [];
  data.cashDays = { [TODAY]: {
    opening: { cash: opening === undefined ? 1000000 : opening, momo: 0, bank: 0 },
    actual: { cash: null, momo: null, bank: null }, openingSet: true } };
  viewedDate = TODAY; confirmAnswer = true; confirmAsked = []; toasts = []; nextId = 100;
};
const cashAcc = () => scope.cbDayPosition(viewedDate).accounts.find(a => a.key === 'cash');

/* ---------- 1. the names, and reaching a shop that already exists ----- */
/*
 * The seed is only read by a shop being created. Every shop already
 * trading has its own preset list saved, and `presets.x || seed.x` means
 * the seed never reaches it again -- so a category seeded and nothing
 * more would be missing from the very list it has to be picked from.
 */
{
  t.check(/presetExpenseCategories: \[[^\]]*'Cash Shortage'/.test(code),
    'a new shop is seeded with Cash Shortage');
  t.check(/presetIncomeCategories: \[[^\]]*'Cash Overage'/.test(code),
    'and with Cash Overage on the other side');

  const seedExpense = /presetExpenseCategories: \[([^\]]*)\]/.exec(code)[1];
  t.check(seedExpense.indexOf("'Cash Shortage'") < seedExpense.indexOf("'Capital Withdrawal'"),
    'the honest answer stands in front of the withdrawal, which is what a shop reaches for when the drawer is short');

  const mine = ['Stock Purchase', 'Boda', 'Lunch'];
  const grown = scope.withPresetCategory(mine, SHORT);
  t.check(grown.indexOf(SHORT) !== -1, 'an existing shop gets the category added to its own list');
  t.check(grown.slice(0, 3).join('|') === mine.join('|'),
    'with the names it typed itself left in place and in order — the list is the shop’s');
  t.check(scope.withPresetCategory(grown, SHORT).length === grown.length,
    'and adding it twice adds it once, so a reload does not grow the list every time');
  t.check(scope.withPresetCategory(null, SHORT).length === 1,
    'a shop with no list at all still gets one');
  t.check(/presetExpenseCategories: withPresetCategory\(/.test(code)
    && /presetIncomeCategories: withPresetCategory\(/.test(code),
    'and the loader is what guarantees it, not the seed');
}

/* ---------- 2. what each one IS to the accounts ----------------------- */
{
  const short = txn({ type: 'payment', category: SHORT, amount: 900000 });
  const over = txn({ type: 'receipt', category: OVER, amount: 20000 });

  t.check(scope.cashIsCashShortage(short) && !scope.cashIsCashOverage(short),
    'money out under Cash Shortage is a shortage and nothing else');
  t.check(scope.cashIsCashOverage(over) && !scope.cashIsCashShortage(over),
    'and money in under Cash Overage is an overage');
  t.check(!scope.cashIsCashShortage(txn({ type: 'receipt', category: SHORT, amount: 1 })),
    'the direction is part of the answer — a receipt is never a shortage');

  t.check(scope.cashIsOperatingExpense(short),
    'a shortage is a running cost of the shop, so it reaches the profit and loss on its own');
  t.check(!scope.cashIsTradingIncome(over),
    'an overage is NOT trading income — left as one it would pose as a sale nobody invoiced');
  t.check(!scope.cashIsOwnerWithdrawal(short) && !scope.cashIsOwnerWithdrawal(over),
    'and neither is the owner taking money home, which is the entry this whole thing replaces');
}

/* ---------- 3. the 900,000, entered both ways ------------------------- */
/*
 * The same cash effect and two different sets of books. This is the
 * comparison the shop could not see on screen.
 */
{
  reset();
  data.cashTxns = [txn({ type: 'payment', category: 'Capital Withdrawal', amount: 900000 })];
  const asDrawing = scope.incomeStatement(FROM, TO);
  const cfDrawing = scope.cashFlowStatement(FROM, TO);

  reset();
  data.cashTxns = [txn({ type: 'payment', category: SHORT, amount: 900000 })];
  const asShortage = scope.incomeStatement(FROM, TO);
  const cfShortage = scope.cashFlowStatement(FROM, TO);

  t.check(cfDrawing.netMovement === cfShortage.netMovement && cfShortage.netMovement === -900000,
    'the cash is gone either way — which is exactly why the wrong entry looked right');
  t.check(asDrawing.opex === 0 && asDrawing.netProfit === 0,
    'entered as a withdrawal it costs the shop nothing on paper');
  t.check(cfDrawing.ownerOut === 900000,
    'while the balance sheet is told the owner took 900,000 home that they never received');
  t.check(asShortage.opex === 900000,
    `entered as a shortage it is a running cost (got ${asShortage.opex})`);
  t.check(asShortage.netProfit === -900000,
    'so the loss lands on the profit and loss, where a shop can see it');
  t.check(cfShortage.ownerOut === 0,
    'and the owner is left out of it entirely');
  t.check(asShortage.opexRows[LINE] === 900000 && asShortage.opexRows[SHORT] === undefined,
    'it appears once, on the short/over line, not under its own category name');
}

/* ---------- 4. money found, and the line running both ways ------------ */
/*
 * The asymmetry that would have been easy to ship: a shortage reaches
 * the profit and loss by itself because it is money out, and an overage
 * reaches NOTHING by itself, because revenue on this statement is built
 * from invoices. A shop counting badly in both directions would then be
 * charged for every bad count and credited for none.
 */
{
  reset();
  data.cashTxns = [txn({ type: 'receipt', category: OVER, amount: 50000 })];
  const is = scope.incomeStatement(FROM, TO);
  t.check(is.opexRows[LINE] === -50000,
    `money found credits the line rather than sitting nowhere (got ${is.opexRows[LINE]})`);
  t.check(is.opex === -50000 && is.netProfit === 50000,
    'so a month that only ever counted over is better off, not merely richer in cash');
  t.check(is.revenue === 0,
    'and it is not revenue — the sales figure stays what was invoiced');

  reset();
  data.cashTxns = [
    txn({ type: 'payment', category: SHORT, amount: 900000 }),
    txn({ type: 'receipt', category: OVER, amount: 20000 }),
  ];
  const net = scope.incomeStatement(FROM, TO);
  t.check(net.opexRows[LINE] === 880000,
    `short and over meet on one line: 900,000 short less 20,000 found (got ${net.opexRows[LINE]})`);
  t.check(Object.keys(net.opexRows).length === 1,
    'as one line, not two facing each other');

  reset();
  data.cashTxns = [
    txn({ type: 'payment', category: SHORT, amount: 40000 }),
    txn({ type: 'receipt', category: OVER, amount: 40000 }),
  ];
  const flat = scope.incomeStatement(FROM, TO);
  t.check(!(LINE in flat.opexRows),
    'counting out and back in again leaves no line at all — a zero on a statement reads as something to look into');
  t.check(flat.opex === 0, 'and costs nothing');
}

/* ---------- 4b. the home screen says the same as the statement -------- */
/*
 * Two screens report what running the shop cost, and a shop reading both
 * has to see one figure. They were the same sum written out twice, which
 * was harmless until a credit joined it.
 */
{
  reset();
  data.cashTxns = [
    txn({ type: 'expense', category: 'Transport', amount: 150000 }),
    txn({ type: 'payment', category: SHORT, amount: 900000 }),
    txn({ type: 'receipt', category: OVER, amount: 20000 }),
  ];
  const is = scope.incomeStatement(FROM, TO);
  const dash = scope.cashOpexTotal(data.cashTxns);
  t.check(is.opex === 1030000,
    `the statement charges the transport and the net short/over (got ${is.opex})`);
  t.check(dash === is.opex,
    `and the home screen's running costs are the same figure (got ${dash})`);
  t.check(/const curOpex = cashOpexTotal\(/.test(code),
    'because both read one routine rather than each keeping its own sum');
}

/* ---------- 5. the cash flow still adds up ---------------------------- */
/*
 * `unclassified` is the statement's own tripwire: every movement should
 * belong to one of the three sections. An overage was deliberately taken
 * out of trading income, which leaves it belonging to nothing unless the
 * operating section names it.
 */
{
  reset();
  data.cashTxns = [txn({ type: 'receipt', category: OVER, amount: 50000 })];
  const cf = scope.cashFlowStatement(FROM, TO);
  t.check(cf.cashFound === 50000, 'found cash has a line of its own in the cash flow');
  t.check(cf.operating === 50000, 'and it is operating cash — it really did arrive');
  t.check(cf.unclassified === 0,
    `so nothing falls between the sections (got ${cf.unclassified})`);
  t.check(cf.tradingIn === 0, 'while received-from-sales is left alone');

  reset();
  data.cashTxns = [txn({ type: 'payment', category: SHORT, amount: 900000 })];
  const cfs = scope.cashFlowStatement(FROM, TO);
  t.check(cfs.operatingOut === 900000 && cfs.unclassified === 0,
    'and a shortage rides out with the other running costs, still adding up');

  t.check(/cashfound:\s+\(t\)=> cashIsCashOverage\(t\)/.test(code),
    'the drill-down names it too, or "Not classified" would collect it while the statement said there was none');
}

/* ---------- 6. it does not raise the basis-gap warning ---------------- */
/*
 * The warning this shop has already been given once falsely. It is about
 * counter sales going through the till without an invoice, and it says
 * the statements are missing a share of the trade. A miscount is not
 * that, and a 5,000 overage must not be reported as though it were.
 */
{
  reset();
  data.cashTxns = [txn({ type: 'receipt', category: OVER, amount: 5000 })];
  t.check(scope.statementBasisGap(scope.incomeStatement(FROM, TO), scope.cashFlowStatement(FROM, TO)) === null,
    'money found in the drawer raises no warning about uninvoiced sales');

  data.cashTxns.push(txn({ type: 'receipt', category: 'Sales Revenue', amount: 60000 }));
  const gap = scope.statementBasisGap(scope.incomeStatement(FROM, TO), scope.cashFlowStatement(FROM, TO));
  t.check(gap && gap.uninvoiced === 60000,
    `while a real till sale with no invoice behind it still does, and for its own amount alone (got ${gap && gap.uninvoiced})`);
}

/* ---------- 7. booking the difference from the count ------------------ */
{
  reset(1000000);
  data.cashTxns = [txn({ type: 'receipt', category: 'Sales Revenue', amount: 500000 })];
  // Book says 1,500,000. The drawer holds 600,000.
  data.cashDays[TODAY].actual.cash = 600000;

  t.check(cashAcc().closing === 1500000 && cashAcc().variance === -900000,
    'the day is 900,000 short before anything is done about it');

  scope.recordCountVariance('cash');
  const written = data.cashTxns.find(x => x.category === SHORT);
  t.check(!!written, 'booking it writes a Cash Shortage');
  t.check(written && written.amount === 900000, 'for the gap exactly');
  t.check(written && written.date === TODAY,
    'dated the day that was counted, not today — a shop closes yesterday’s book this morning');
  t.check(written && written.account === 'cash', 'against the account whose card was clicked');
  t.check(cashAcc().variance === 0,
    `and the count and the book now agree (got ${cashAcc().variance})`);
  t.check(scope.cbVarianceMeaning(cashAcc()).state === 'ok',
    'so the card stops asking');

  // Pressed twice in a hurry. The second press recomputes and finds
  // nothing left to book, so a shop cannot charge itself the same
  // shortage over and over by leaning on the button.
  scope.recordCountVariance('cash');
  t.check(data.cashTxns.filter(x => x.category === SHORT).length === 1,
    'booking it a second time writes nothing — the difference is already gone');
}

{
  reset(1000000);
  data.cashDays[TODAY].actual.cash = 1020000;
  t.check(cashAcc().variance === 20000, 'a drawer holding more than the book says');
  scope.recordCountVariance('cash');
  const written = data.cashTxns.find(x => x.category === OVER);
  t.check(!!written && written.type === 'receipt' && written.amount === 20000,
    'comes in as a Cash Overage for the extra');
  t.check(cashAcc().variance === 0, 'and settles the day the same way');
}

/* ---------- 8. the account that was clicked, not the first one -------- */
{
  reset(1000000);
  data.cashDays[TODAY].opening.momo = 300000;
  data.cashDays[TODAY].actual.momo = 250000;
  scope.recordCountVariance('momo');
  const written = data.cashTxns.find(x => x.category === SHORT);
  t.check(written && written.account === 'momo',
    'mobile money short is booked against mobile money');
  t.check(scope.cbDayPosition(TODAY).accounts.find(a => a.key === 'momo').variance === 0,
    'and it is that account that comes right');
  t.check(scope.cbDayPosition(TODAY).accounts.find(a => a.key === 'cash').counted === null,
    'while an account nobody counted is left alone entirely');
}

/* ---------- 9. what it refuses, and what it asks --------------------- */
{
  reset(1000000);
  scope.recordCountVariance('cash');
  t.check(data.cashTxns.length === 0, 'an account that was never counted writes nothing');
  t.check(confirmAsked.length === 0, 'and is not even asked about');

  reset(1000000);
  data.cashDays[TODAY].actual.cash = 1000000;
  scope.recordCountVariance('cash');
  t.check(data.cashTxns.length === 0, 'a count that already agrees writes nothing');

  reset(1000000);
  data.cashDays[TODAY].actual.cash = 940000;
  confirmAnswer = false;
  scope.recordCountVariance('cash');
  t.check(confirmAsked.length === 1, 'a real difference is asked about before it is written');
  t.check(data.cashTxns.length === 0, 'and answering no writes nothing');
  t.check(cashAcc().variance === -60000, 'leaving the difference standing, to be traced instead');

  const ask = confirmAsked[0];
  t.check(/60,000 UGX/.test(ask), 'the question names the amount');
  t.check(new RegExp(TODAY).test(ask), 'and the day it belongs to');
  t.check(/cannot trace/.test(ask) && /enter that instead/.test(ask),
    'and says plainly that finding the missing entry is the better answer — this button is for the remainder');
}

/* ---------- 10. the figure comes from the day, not from the button ---- */
/*
 * The card carries the variance it was drawn with. Between drawing and
 * clicking, the count can be retyped and the thirty-second refresh can
 * bring in a transaction from another till. Booking the figure the button
 * was born with would leave a fresh difference the size of the change.
 */
{
  reset(1000000);
  data.cashDays[TODAY].actual.cash = 600000;   // card drawn showing 400,000 short
  data.cashTxns = [txn({ type: 'receipt', category: 'Sales Revenue', amount: 500000 })];
  // ...then the count is corrected before the button is pressed.
  data.cashDays[TODAY].actual.cash = 700000;
  scope.recordCountVariance('cash');
  const written = data.cashTxns.find(x => x.category === SHORT);
  t.check(written && written.amount === 800000,
    `the corrected count is what gets booked (got ${written && written.amount})`);
  t.check(cashAcc().variance === 0, 'so the day lands flat rather than 100,000 out');

  reset(1000000);
  data.cashDays[TODAY].actual.cash = 900000;
  // A payment lands from another device after the card was drawn.
  data.cashTxns = [txn({ type: 'payment', category: 'Transport', amount: 100000 })];
  scope.recordCountVariance('cash');
  t.check(data.cashTxns.filter(x => x.category === SHORT).length === 0,
    'and a difference that another till has already explained is not booked at all');
  t.check(/already agrees/.test(toasts.join(' ')), 'the shop is told why nothing happened');
}

/* ---------- 11. the drill-down opens both sides of the line ----------- */
{
  t.check(/cat === CASH_VARIANCE_LINE/.test(code),
    'opening the short/over line fetches both categories, not one');
  t.check(/cashIsCashShortage\(t\) \|\| cashIsCashOverage\(t\)/.test(code),
    'by name rather than by direction');
  t.check(/cashIsCashOverage\(t\) \? \{\.\.\.txnRow\(t\), v: -\(Number\(t\.amount\)\|\|0\)\}/.test(code),
    'with the money found carried negative, so the panel totals what the statement line says');
}

/* ---------- 12. the button is on the cards that need it -------------- */
{
  t.check(/meaning\.state==='over' \|\| meaning\.state==='short' \? `/.test(code),
    'the button appears only where there is a difference to book');
  t.check(/class="btn btn-ghost cb-var-record" data-account=/.test(code),
    'carrying the account it belongs to');
  t.check(/recordCountVariance\(btn\.dataset\.account\)/.test(code),
    'and that is what it acts on');
  t.check(/Only for money you cannot trace/.test(code),
    'with the caveat on the card itself, where it is read before the button is pressed');
  t.check(/\.cb-count-fix\{/.test(code), 'and it is styled as part of the card');
}

process.exit(t.done() ? 1 : 0);
