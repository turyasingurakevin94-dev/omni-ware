#!/usr/bin/env node
'use strict';
/*
 * Assets and loans, wired to the cash book.
 *
 * The five accounting phases built a register of assets and a register of
 * loans, and neither of them moved any money. Every other flow in the app
 * writes to the cash book -- invoice payments, debt payments, stock
 * purchases, agent commissions -- and these two did not, which made the
 * balance sheet say things that were not true:
 *
 *   buying a 20,000,000 van   assets up 20,000,000, cash unmoved, so
 *                             equity up 20,000,000. The shop got RICHER
 *                             for spending the money.
 *   drawing a 20,000,000 loan liabilities up 20,000,000, cash unmoved, so
 *                             equity DOWN 20,000,000. The shop got poorer
 *                             for borrowing.
 *   repaying it               liability down, cash unmoved, equity up out
 *                             of nowhere.
 *
 * What is tested here is not the click handlers -- those are DOM -- but
 * the two things that decide whether the entries mean anything once they
 * exist: how a cash-book category is classified, and which entries belong
 * to a record when it is deleted.
 *
 * The classification is the part that is easy to get wrong and impossible
 * to see. An 'Equipment purchase' that counts as an operating expense
 * charges the whole van to the month it was bought AND charges it again
 * over its life as depreciation. A 'Loan Repayment' that counts as one
 * expenses the principal, which was never an expense, and double-charges
 * the interest.
 *
 * Run: node test/cash-book-wiring.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('cash book wiring');
const src = read('index.html');
const data = { cashTxns: [] };

const scope = compileScope([
  extractDeclaration(src, 'CASH_NOT_OPEX', 'index.html'),
  extractDeclaration(src, 'CASH_NOT_REVENUE', 'index.html'),
  extractDeclaration(src, 'cashHas', 'index.html'),
  extractFunction(src, 'cashIsMoneyOut', 'index.html'),
  extractFunction(src, 'cashIsMoneyIn', 'index.html'),
  extractFunction(src, 'cashIsOperatingExpense', 'index.html'),
  extractFunction(src, 'cashIsTradingIncome', 'index.html'),
  extractFunction(src, 'removeCashTxnsByIds', 'index.html'),
  extractFunction(src, 'loanCashTxnIds', 'index.html'),
  extractFunction(src, 'assetCashTxnIds', 'index.html'),
  extractFunction(src, 'loanPrincipal', 'index.html'),
  extractFunction(src, 'loanFees', 'index.html'),
  extractFunction(src, 'loanNetAdvanced', 'index.html'),
], { data }, [
  'cashIsOperatingExpense', 'cashIsTradingIncome', 'removeCashTxnsByIds',
  'loanCashTxnIds', 'assetCashTxnIds', 'loanNetAdvanced',
]);

const {
  cashIsOperatingExpense, cashIsTradingIncome, removeCashTxnsByIds,
  loanCashTxnIds, assetCashTxnIds, loanNetAdvanced,
} = scope;

const out = (category)=> ({ type:'payment', category, amount: 1000 });
const inn = (category)=> ({ type:'receipt', category, amount: 1000 });

const section = (title)=> console.log('\n# ' + title);
const isEq = (got, want, msg)=> t.check(got === want, `${msg} (got ${JSON.stringify(got)})`);
const isSame = (got, want, msg)=>
  t.check(JSON.stringify(got) === JSON.stringify(want), `${msg} (got ${JSON.stringify(got)})`);

/* ---- What a category MEANS to the income statement ---- */

section("capital spending is not a running cost");

isEq(cashIsOperatingExpense(out('Equipment purchase')), false,
  'buying equipment is capital — its cost reaches the accounts as depreciation, so counting it here charges the van twice');
isEq(cashIsOperatingExpense(out('Loan Repayment')), false,
  'a repayment settles borrowing; the interest inside it is charged from the loan schedule');
isEq(cashIsOperatingExpense(out('Stock Purchase')), false,
  'stock is costed through COGS when it sells');
isEq(cashIsOperatingExpense(out('Supplier Payment')), false,
  'settles a payable that was already costed');

// The other side of the same guard: the exclusions must be narrow. A rule
// that excluded too much would silently stop the shop's real costs from
// reaching the income statement at all, and an income statement that
// omits rent reads as a very profitable shop.
isEq(cashIsOperatingExpense(out('Rent')), true, 'rent is a running cost');
isEq(cashIsOperatingExpense(out('Transport')), true, 'transport is a running cost');
isEq(cashIsOperatingExpense(out('Salary')), true, 'wages are a running cost');
isEq(cashIsOperatingExpense(inn('Rent')), false, 'money coming in is never an expense, whatever it is called');

section("money arriving is not always earned");

isEq(cashIsTradingIncome(inn('Loan Received')), false, 'borrowed money is a liability, not revenue');
isEq(cashIsTradingIncome(inn('Owner Investment')), false, 'the owner\'s own money is equity, not earnings');
isEq(cashIsTradingIncome(inn('Debt Collection')), false, 'settles a receivable — the sale was booked when it was made');
isEq(cashIsTradingIncome(inn('Customer Payment')), true, 'a customer paying is trading income');
// Selling a van is not trading. It is cash arriving from investing, and
// the profit or loss on it comes from the asset register comparing the
// proceeds with the written-down value -- not from the size of the cheque.
isEq(cashIsTradingIncome(inn('Asset Sale')), false,
  'selling the van is investing coming back, not money earned — counted as trading it lands in BOTH sections and the cash flow stops adding up');

/* ---- Which entries belong to a record ---- */

section("a loan owns the entries it wrote");

isSame(loanCashTxnIds({ cashTxnId: 5, repayments: [{ cashTxnId: 6 }, { cashTxnId: 7 }] }), [5, 6, 7],
  'the drawing and every repayment made against it');
isSame(loanCashTxnIds({ cashTxnId: 5, repayments: [] }), [5],
  'a loan drawn but never repaid');
isSame(loanCashTxnIds({ repayments: [{ cashTxnId: 6 }] }), [6],
  'a loan drawn before the shop used this app still owns its repayments');
isSame(loanCashTxnIds({ cashTxnId: 5, repayments: [{ amount: 100 }] }), [5],
  'a repayment kept out of the cash book contributes no id rather than an undefined one');
isSame(loanCashTxnIds({ cashTxnId: 5, repayments: [null] }), [5],
  'a hole in the repayments array does not throw');
isSame(loanCashTxnIds({ cashTxnId: 5 }), [5], 'repayments may be absent entirely');
isSame(loanCashTxnIds(null), [], 'no loan, no entries');

section("an asset owns both its entries");

isSame(assetCashTxnIds({ cashTxnId: 11, disposalCashTxnId: 12 }), [11, 12],
  'what was paid for it and what came back when it was sold');
isSame(assetCashTxnIds({ cashTxnId: 11 }), [11], 'still in use');
isSame(assetCashTxnIds({ disposalCashTxnId: 12 }), [12],
  'an asset the shop already owned, later sold');
isSame(assetCashTxnIds({}), [], 'already owned and still in use — nothing to remove');
isSame(assetCashTxnIds(null), [], 'no asset, no entries');

section("deleting takes the entries with it");

data.cashTxns = [{ id: 1 }, { id: 5 }, { id: 6 }, { id: 7 }, { id: 9 }];
removeCashTxnsByIds(loanCashTxnIds({ cashTxnId: 5, repayments: [{ cashTxnId: 6 }, { cashTxnId: 7 }] }));
isSame(data.cashTxns.map(x=>x.id), [1, 9],
  'the drawing and both repayments go; entries belonging to other flows stay');

// The guard that matters most: a record that never wrote an entry must not
// take somebody else's with it. filter(id => id != null) is what stops the
// undefined from an untouched asset matching a row whose id is undefined.
data.cashTxns = [{ id: 1 }, { id: undefined }, { id: 9 }];
removeCashTxnsByIds(assetCashTxnIds({}));
isEq(data.cashTxns.length, 3,
  'an asset that never touched the cash book removes nothing at all');

/* ---- The net advanced is what gets banked ---- */

section("a loan banks what actually arrived");

// Applied for 20m, the lender kept 600,000 in insurance and paperwork, and
// 19.4m reached the account. The receipt is 19.4m: the fee is already a
// cost of the month through loanFeesForPeriod, so banking the gross would
// both overstate the cash and charge the fee twice.
isEq(loanNetAdvanced({ principal: 20000000, fees: 600000 }), 19400000,
  'the receipt is the net advanced, not the principal repaid against');
isEq(loanNetAdvanced({ principal: 20000000, fees: 0 }), 20000000,
  'no fee, no difference');
isEq(loanNetAdvanced({ principal: 20000000 }), 20000000,
  'a loan recorded before the fee field existed banks its principal');

/* ---------- the ledger names who paid ----------------------------------
   "Payment — INV-0192" is findable by nobody during reconciling; the
   name of the client who paid is. Resolved at DISPLAY time so every old
   row gains it too, and the stored description (what the edit form must
   show) is never rewritten. */
{
  const data2 = {
    savedQuotes: [
      { id: 192, client: { name: 'Mulongo Hardware' } },
      { id: 226, client: { name: 'Onora Peter' } },
      { id: 300, client: { name: '' } },
    ],
  };
  const scope2 = compileScope([
    extractFunction(src, 'invoiceNumberLabel', 'index.html'),
    extractFunction(src, 'cbTxnDisplayDesc', 'index.html'),
  ], { data: data2 }, ['cbTxnDisplayDesc']);
  const desc = scope2.cbTxnDisplayDesc;

  t.check(desc({ description: 'Payment — INV-0226', quoteId: 226 }) === 'Payment — INV-0226 — Onora Peter',
    'a row linked by quoteId gains the client\'s name');
  t.check(desc({ description: 'Payment — INV-0192', quoteId: null }) === 'Payment — INV-0192 — Mulongo Hardware',
    'an old row with no link is resolved from the INV number in its own text');
  t.check(desc({ description: 'Payment — Milly', quoteId: null }) === 'Payment — Milly',
    'a general debt payment already naming its payer is left as written');
  t.check(desc({ description: 'Payment — INV-0192 — Mulongo Hardware', quoteId: 192 }) === 'Payment — INV-0192 — Mulongo Hardware',
    'and a name already present is never doubled');
  t.check(desc({ description: 'Payment — PINV-0192 — Roto Industry', quoteId: null }) === 'Payment — PINV-0192 — Roto Industry',
    'a supplier bill (PINV) never matches the INV pattern — it already names its supplier');
  t.check(desc({ description: 'Payment — INV-0300', quoteId: 300 }) === 'Payment — INV-0300',
    'a nameless client adds nothing');
  t.check(desc({ description: 'Payment — INV-9999', quoteId: null }) === 'Payment — INV-9999',
    'and an invoice that no longer exists leaves the text as it was');

  t.check(/cbTxnDisplayDesc\(t\)/.test(read('index.html'))
    && /esc\(cbTxnDisplayDesc\(t\)\)/.test(read('index.html')),
    'the cash book screen, its daily print and the statement drill-downs all read through it');
  t.check(/document\.getElementById\(prefix\+'desc'\)\.value = t\.description;/.test(read('index.html')),
    'while the edit form still shows the RAW stored description — display never rewrites the record');
}

process.exit(t.done() ? 1 : 0);
