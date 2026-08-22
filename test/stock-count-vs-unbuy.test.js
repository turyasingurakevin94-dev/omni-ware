#!/usr/bin/env node
'use strict';
/*
 * Counting down, versus un-buying.
 *
 * Both take the same number off the shelf, and they are completely
 * different facts about the money. A count that finds two fewer than the
 * book says is breakage or shrinkage: the goods came, the supplier is
 * owed, and no bill should move. A purchase entered twice is different --
 * those goods never arrived, and the bill has to go with them.
 *
 * A real shop hit exactly this. The Save button on the restock screen was
 * pressed twice while it waited for a PINV number, so twenty cartons went
 * on the shelf as forty on two bills. The shop noticed the count, opened
 * the stock count screen, and put it back to twenty. The shelf was then
 * right and the shop was left owing 2,900,000 for cartons it did not
 * have -- PINV-0143 and PINV-0144 both standing, with nothing anywhere
 * connecting them to the correction it had just made.
 *
 * The count screen was not wrong to leave the bills alone; that is what
 * it is for. It was wrong to say nothing. It now names what would be left
 * standing and points at the tool that takes the bill with the goods --
 * and still lets the shop through, because a genuine count-down is the
 * whole purpose of the screen.
 *
 * Run: node test/stock-count-vs-unbuy.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('stock count vs un-buying');
const src = read('index.html');
const code = src.split(/\r?\n/).map(l => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');

const store = { stockLog: [], purchaseInvoices: [], products: [], stock: {} };
const env = {
  data: store,
  todayISO: () => '2026-08-21',
  fmtUGX: (n) => `${Math.round(Number(n) || 0)} UGX`,
  stockKey: (p, v) => `${p}|${v == null || v === '' ? '' : v}`,
};
const NAMES = [
  'daysSinceDate', 'purchaseInvoiceTotal', 'purchaseInvoiceBalanceDue',
  'purchaseInvoiceNumberLabel', 'isStockPurchaseRow', 'effectiveStockPurchase',
  'stockPurchaseInvoiceFor', 'stockCountOpenPurchaseBills', 'stockCountBillWarning',
];
let fns = null, err = null;
try {
  fns = compileScope(
    [extractDeclaration(src, 'STOCK_PURCHASE_NOTE_RE', 'index.html'),
      extractDeclaration(src, 'STOCK_COUNT_BILL_LOOKBACK_DAYS', 'index.html'),
      ...NAMES.map(n => extractFunction(src, n, 'index.html'))],
    env, NAMES,
  );
} catch (e) { err = e; }
t.check(!!fns, `the routines compile${err ? ` (${err.message})` : ''}`);

if (fns) {
  const { stockCountBillWarning, stockCountOpenPurchaseBills } = fns;

  // The reported shop, as its records actually stood: twenty cartons of
  // hinges restocked twice, on two bills, neither paid.
  const setup = (opts) => {
    const o = opts || {};
    store.stock = { 'P1|': 40 };
    store.stockLog = [
      { id: 1, key: 'P1|', productId: 'P1', variantIdx: null, type: 'restock', delta: 20,
        qtyAfter: 20, note: 'Purchased from Roto Industry @ 145,000 UGX per Ctn',
        date: o.date || '2026-08-21', source: 'inv-purchase', piId: 143, supplierId: 'S1' },
      { id: 2, key: 'P1|', productId: 'P1', variantIdx: null, type: 'restock', delta: 20,
        qtyAfter: 40, note: 'Purchased from Roto Industry @ 145,000 UGX per Ctn',
        date: o.date || '2026-08-21', source: 'inv-purchase', piId: 144, supplierId: 'S1' },
    ];
    const mk = (id) => ({ id, quoteId: null, supplierId: 'S1', supplierName: 'Roto Industry',
      date: o.date || '2026-08-21', items: [{ productId: 'P1', variantIdx: null, qty: 20, price: 145000 }],
      amountPaid: o.paid || 0, payments: [], voided: false });
    store.purchaseInvoices = [mk(143), mk(144)];
  };

  /* ---------- 1. the case that went wrong -------------------------- */
  {
    setup();
    const w = stockCountBillWarning('P1', null, -20);
    t.check(!!w, 'counting 40 back down to 20 now says something at all');
    t.check(/PINV-0144/.test(w) && /PINV-0143/.test(w),
      `naming the bills that would be left standing (${JSON.stringify(String(w).slice(0, 120))})`);
    t.check(/Roto Industry/.test(w), 'and who they are owed to');
    t.check(/does not change any supplier bill/.test(w),
      'stating plainly what this screen does not touch');
    t.check(/press Edit/.test(w),
      'and pointing at the tool that takes the bill with the goods');
    t.check(/Continue with the count\?/.test(w),
      'while still letting a real count through — this screen exists for those');
  }

  /* ---------- 2. it stays quiet when there is nothing to say -------- */
  {
    setup();
    t.check(stockCountBillWarning('P1', null, 5) === null,
      'counting UP says nothing — nothing is being un-bought');
    t.check(stockCountBillWarning('P1', null, 0) === null, 'and neither does no change at all');

    setup({ paid: 2900000 });
    t.check(stockCountBillWarning('P1', null, -20) === null,
      'a bill already settled would not be left standing, so it is not raised');

    setup();
    store.purchaseInvoices.forEach(pi => { pi.voided = true; });
    t.check(stockCountBillWarning('P1', null, -20) === null, 'nor is a voided one');

    setup();
    store.stockLog = [];
    t.check(stockCountBillWarning('P1', null, -20) === null,
      'and an item with no recent purchase behind it counts down in silence, as before');
  }

  /* ---------- 3. old bills do not nag ------------------------------ */
  /*
   * A warning that fires on every count is read on none. Four months on,
   * a recount is a recount.
   */
  {
    setup({ date: '2026-03-01' });
    t.check(stockCountBillWarning('P1', null, -20) === null,
      'a purchase from months ago is not what a recount today is undoing');
    setup({ date: '2026-08-01' });
    t.check(!!stockCountBillWarning('P1', null, -20),
      'while one from three weeks ago still is');
  }

  /* ---------- 4. one line per bill, not per movement ---------------- */
  {
    setup();
    // Two restock rows pointing at the SAME bill must not name it twice.
    store.stockLog[1].piId = 143;
    store.purchaseInvoices = store.purchaseInvoices.filter(pi => pi.id === 143);
    const bills = stockCountOpenPurchaseBills('P1', null, -20);
    t.check(bills.length === 1, `each bill is named once, however many movements point at it (${bills.length})`);
  }

  /* ---------- 5. another item's bill is not this item's problem ----- */
  {
    setup();
    t.check(stockCountBillWarning('P2', null, -20) === null,
      'counting a different item down does not raise this one\'s bills');
  }
}

/* ---------- 6. wired into the count, and asked before anything moves - */
{
  const save = code.slice(code.indexOf("getElementById('inv_save_btn')"));
  const body = save.slice(0, save.indexOf('\n  });'));
  t.check(/const billWarning = stockCountBillWarning\(invProductId, invVariantIdx, d\);/.test(body),
    'the count screen asks the question');
  t.check(/if\(billWarning && !confirm\(billWarning\)\) return;/.test(body),
    'and stops there if the answer is no');
  t.check(body.indexOf('stockCountBillWarning') < body.indexOf('applyStockDelta'),
    'asked BEFORE the stock moves, not after — a warning that follows the act is a receipt');
}

process.exit(t.done() ? 1 : 0);
