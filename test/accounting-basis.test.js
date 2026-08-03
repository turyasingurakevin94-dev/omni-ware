#!/usr/bin/env node
'use strict';
/*
 * One set of numbers, before anything is built on top of them.
 *
 * Phase 1 of the accounting work. No new feature here -- three figures
 * the app already showed were each computed two ways, and a financial
 * statement built on them would have inherited all three.
 *
 *   COST OF SALES
 *   Invoicing a quote consumes FIFO stock lots and stashes exactly what
 *   it took on the line as `_stockLots`. That is the real cost of the
 *   goods, it is persisted with the order, and it was read back for one
 *   purpose only: putting the same lots back on un-invoice. Every profit
 *   figure instead costed the sale at `it.price`, which for a shelf line
 *   is a quote-time ESTIMATE -- quoteSuggestedPrice reaches for
 *   getFIFOUnitCost, which returns the cost of the NEXT lot, i.e. what it
 *   would cost to REPLACE the unit. The two agree only while the buying
 *   price has not moved. They are one figure now, and where the estimate
 *   still has to be used, the quantity is counted and reported.
 *
 *   CASH
 *   The dashboard summed data.cashTxns and nothing else -- the shop's net
 *   MOVEMENT, not its position. A book opened with 1,000,000 in the
 *   drawer reported 70,000 after a day's trading. Every opening balance
 *   was missing, and the runway figure divided that wrong number by the
 *   monthly burn. It reads the Cash Book's own arithmetic now.
 *
 *   WHAT COUNTS AS AN OPERATING COST
 *   A whitelist of five category names, so anything not on it was
 *   invisible to profit: agent commission payouts, and every category a
 *   shopkeeper adds themselves. Stated the other way round now -- money
 *   out is an operating cost unless it is buying stock or settling a
 *   payable, both of which are costed elsewhere and would double-count.
 *
 * Run: node test/accounting-basis.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('accounting basis');
const src = read('index.html');

const data = { cashTxns: [], cashDays: {}, products: [], customers: [] };

const scope = compileScope([
  extractDeclaration(src, 'ACCOUNTS', 'index.html'),
  extractFunction(src, 'cbAccountTotals', 'index.html'),
  extractFunction(src, 'cbClosingFor', 'index.html'),
  extractFunction(src, 'previousCashDate', 'index.html'),
  extractFunction(src, 'carriedOpening', 'index.html'),
  extractFunction(src, 'cashAnchorFor', 'index.html'),
  extractFunction(src, 'cashOnHandFor', 'index.html'),
  extractFunction(src, 'cashOnHandByAccount', 'index.html'),
  extractFunction(src, 'dashCashBalanceAllTime', 'index.html'),
  extractDeclaration(src, 'CASH_NOT_OPEX', 'index.html'),
  extractDeclaration(src, 'CASH_NOT_REVENUE', 'index.html'),
  extractDeclaration(src, 'cashHas', 'index.html'),
  extractFunction(src, 'cashIsMoneyOut', 'index.html'),
  extractFunction(src, 'cashIsMoneyIn', 'index.html'),
  extractFunction(src, 'cashIsOperatingExpense', 'index.html'),
  extractFunction(src, 'cashIsTradingIncome', 'index.html'),
  extractFunction(src, 'invoiceLineCost', 'index.html'),
  extractFunction(src, 'anInvoiceTotals', 'index.html'),
  extractFunction(src, 'anOverallTotals', 'index.html'),
  extractFunction(src, 'anRowsByItem', 'index.html'),
], {
  data,
  todayISO: () => '2026-08-03',
  // Costing is the subject; what a line SELLS for is not, so the sell
  // side is stubbed rather than dragging the markup engine in.
  quoteItemSellPrice: (it) => Number(it.sellPrice) || 0,
  productVariantLabel: () => '',
}, ['invoiceLineCost', 'anInvoiceTotals', 'anOverallTotals', 'anRowsByItem', 'cashOnHandByAccount',
  'dashCashBalanceAllTime', 'cashIsOperatingExpense', 'cashIsTradingIncome']);

const line = (over) => Object.assign({
  productId: 'P1', variantIdx: null, productName: 'Cement 50kg', unit: 'bag',
  qty: 10, supplierId: '__stock__', price: 34000, sellPrice: 45000,
}, over);
const txn = (over) => Object.assign({
  id: 1, date: '2026-08-03', account: 'cash', type: 'expense', category: 'Rent', amount: 0,
}, over);

/* ---------- 1. a sale costs what it cost ------------------------------ */
{
  // The case the whole change exists for: cement bought at 30,000 sits on
  // the shelf, the price rises to 34,000, and it sells. The shop made
  // 15,000 a bag, not 11,000.
  const rose = scope.invoiceLineCost(line({ _stockLots: [{ qty: 10, cost: 30000 }] }));
  t.check(rose.cost === 300000,
    `stock is costed at what those units cost, not at what replacing them would cost (got ${rose.cost})`);
  t.check(rose.estimatedQty === 0, 'with nothing estimated');

  // And the correction cuts both ways. When buying prices FALL, the old
  // figure was flattering: it costed the sale at the new cheap
  // replacement price while the goods sold had cost more.
  const fell = scope.invoiceLineCost(line({ _stockLots: [{ qty: 10, cost: 38000 }] }));
  t.check(fell.cost === 380000,
    'and a fall in prices makes the corrected cost HIGHER than the estimate, not lower');

  const mixed = scope.invoiceLineCost(line({ _stockLots: [{ qty: 4, cost: 30000 }, { qty: 6, cost: 33000 }] }));
  t.check(mixed.cost === 4 * 30000 + 6 * 33000,
    `a sale spanning two lots is costed lot by lot (got ${mixed.cost})`);
}

/* ---------- 2. bought in for the order is not an estimate ------------- */
{
  const bought = scope.invoiceLineCost(line({ supplierId: 'S1', price: 34000 }));
  t.check(bought.cost === 340000,
    'a line ordered from a supplier for this sale is costed at what we paid them');
  t.check(bought.estimatedQty === 0,
    'and that is a fact, not a guess -- it must not be counted as estimated');
  t.check(scope.invoiceLineCost(line({ supplierId: 'S1', _stockLots: [{ qty: 10, cost: 1 }] })).cost === 340000,
    'even if a stale lot list is somehow attached, a bought-in line is what the supplier charged');
}

/* ---------- 3. what it cannot measure, it counts ---------------------- */
{
  // Stock ran out mid-sale: six came off the shelf, four were sold that
  // never existed there. Those four have no cost anybody recorded.
  const short = scope.invoiceLineCost(line({ qty: 10, _stockLots: [{ qty: 6, cost: 30000 }] }));
  t.check(short.cost === 6 * 30000 + 4 * 34000,
    `the six are costed from their lots and the four fall back to the estimate (got ${short.cost})`);
  t.check(short.estimatedQty === 4,
    'and the four are counted, so a statement can say how much of its cost figure is not evidence');

  const legacy = scope.invoiceLineCost(line({}));
  t.check(legacy.cost === 340000 && legacy.estimatedQty === 10,
    'an order invoiced before lots were recorded is entirely estimated, and says so rather than reporting no cost');

  // A half-finished reversal could leave lots claiming more than the line
  // sold. Costing 14 units against a sale of 10 would understate profit
  // with nothing on screen to explain it.
  const over = scope.invoiceLineCost(line({ qty: 10, _stockLots: [{ qty: 14, cost: 30000 }] }));
  t.check(over.cost === 300000, 'lots claiming more than was sold are capped at the quantity sold');

  t.check(scope.invoiceLineCost(line({ qty: 0, _stockLots: [] })).cost === 0, 'a zero-quantity line costs nothing');
}

/* ---------- 4. it reaches the figures people read --------------------- */
{
  const q = {
    items: [
      line({ qty: 10, _stockLots: [{ qty: 10, cost: 30000 }] }),
      line({ qty: 2, supplierId: 'S1', price: 50000, sellPrice: 70000 }),
    ],
  };
  const tot = scope.anInvoiceTotals(q);
  t.check(tot.sales === 10 * 45000 + 2 * 70000, 'the sale side is unchanged');
  t.check(tot.cost === 300000 + 100000, `and the cost side is the corrected one (got ${tot.cost})`);
  t.check(tot.profit === tot.sales - tot.cost, 'with profit following from it');

  const short = { items: [line({ qty: 10, _stockLots: [{ qty: 6, cost: 30000 }] })] };
  t.check(scope.anInvoiceTotals(short).estimatedQty === 4,
    'the estimated count is carried up to the invoice');
  const overall = scope.anOverallTotals([q, short]);
  t.check(overall.estimatedQty === 4,
    'and up again to the period, where a statement can show it');
  t.check(overall.cost === tot.cost + scope.anInvoiceTotals(short).cost,
    'with the totals adding up');

  // The old behaviour, pinned as gone.
  const oldWay = (qq) => (qq.items || []).reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.price) || 0), 0);
  t.check(tot.cost !== oldWay(q),
    'and it is genuinely a different number from costing every line at its quoted price');

  // Which-products-make-money is a second aggregation with its own loop,
  // and it had its own copy of the costing. Two answers to "what did this
  // product cost us" is how a P&L and a product report end up disagreeing.
  data.products = [{ id: 'P1', name: 'Cement 50kg', variants: [], category: 'Building' }];
  const shelfOnly = { items: [line({ qty: 10, _stockLots: [{ qty: 10, cost: 30000 }] })] };
  const shelfRows = scope.anRowsByItem([shelfOnly]);
  t.check(shelfRows.length === 1 && shelfRows[0].cost === 300000,
    `the per-product rows cost the same way (got ${shelfRows.length === 1 ? shelfRows[0].cost : shelfRows.length + ' rows'})`);
  t.check(shelfRows[0].profit === 150000, 'so product profit agrees with invoice profit');

  // Both of q's lines are the same product, so they gather into one row --
  // which is the point: it has to add up to the invoice it came from.
  const rowCost = scope.anRowsByItem([q]).reduce((s, r) => s + r.cost, 0);
  t.check(rowCost === tot.cost,
    `and the products add up to the invoice they came from (${rowCost} vs ${tot.cost})`);
}

/* ---------- 5. one definition of cash --------------------------------- */
{
  data.cashDays = { '2026-08-03': { opening: { cash: 500000, momo: 200000, bank: 300000 }, actual: {}, openingSet: true } };
  data.cashTxns = [
    txn({ id: 1, type: 'receipt', category: 'Sales Revenue', amount: 120000 }),
    txn({ id: 2, type: 'expense', category: 'Transport', amount: 50000 }),
  ];

  t.check(scope.dashCashBalanceAllTime() === 1070000,
    `the dashboard reports what the shop is holding (got ${scope.dashCashBalanceAllTime()})`);
  t.check(scope.dashCashBalanceAllTime() === scope.cashOnHandByAccount().total,
    'which is the same figure the Cash Book shows -- one definition, so the two screens cannot disagree');
  t.check(scope.dashCashBalanceAllTime() !== 70000,
    'and not the old one, which was net movement and left every opening balance out');
}

/* ---------- 6. money out is a cost unless it is buying or settling ---- */
{
  t.check(scope.cashIsOperatingExpense(txn({ type: 'expense', category: 'Rent' })), 'rent is an operating cost');
  t.check(scope.cashIsOperatingExpense(txn({ type: 'payment', category: 'Agent Commission' })),
    'so is an agent commission payout -- real money, counted nowhere before, and written as type "payment" which the old filter also missed');
  t.check(scope.cashIsOperatingExpense(txn({ type: 'expense', category: 'Fuel' })),
    'and so is a category the shopkeeper invented, which a whitelist silently dropped');

  t.check(!scope.cashIsOperatingExpense(txn({ type: 'payment', category: 'Stock Purchase' })),
    'buying stock is not -- it is costed through COGS when the goods sell, and counting both charges twice');
  t.check(!scope.cashIsOperatingExpense(txn({ type: 'payment', category: 'Supplier Payment' })),
    'nor is settling a payable for goods already costed');
  t.check(!scope.cashIsOperatingExpense(txn({ type: 'receipt', category: 'Sales Revenue', amount: 5 })),
    'and money coming in is not an expense at all');

  // The other half, for the statements to come.
  t.check(scope.cashIsTradingIncome(txn({ type: 'receipt', category: 'Sales Revenue' })), 'a sale receipt is trading income');
  t.check(!scope.cashIsTradingIncome(txn({ type: 'receipt', category: 'Loan Received' })),
    'a loan is not income -- it is borrowed and has to go back');
  t.check(!scope.cashIsTradingIncome(txn({ type: 'receipt', category: 'Owner Investment' })),
    "nor is the owner's own money");
  t.check(!scope.cashIsTradingIncome(txn({ type: 'receipt', category: 'Debt Collection' })),
    'nor collecting a debt, whose sale was booked when the invoice was raised');

  // A category named after something on Object.prototype must not be
  // mistaken for a classified one.
  t.check(scope.cashIsOperatingExpense(txn({ type: 'expense', category: 'constructor' })),
    'and a category called "constructor" is just an expense, not a match on the prototype');
}

process.exit(t.done() ? 1 : 0);
