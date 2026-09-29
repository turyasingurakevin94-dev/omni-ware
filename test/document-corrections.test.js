#!/usr/bin/env node
'use strict';
/*
 * Correcting a document already in the books.
 *
 * The owner's redesign made the pencil on every invoice and bill open an
 * editor, and asked for it to be real: change a sale's customer, date,
 * terms, lines, note or discount while money is still owed on it; change a
 * bill's supplier number, dates, lines or transport the same way; and once
 * either is PAID, correct it with a second document -- a credit note
 * against the invoice, a supplier credit against the bill -- leaving the
 * original untouched.
 *
 * Every one of those moves more than the paper, and this file runs the
 * real routines to prove each book moves with it:
 *
 *   THE SHELF. An edited quantity puts back what the invoice took and takes
 *   the new quantity, so stock is never short or doubled. A credit note
 *   whose goods came back puts them on the shelf; a supplier credit whose
 *   goods went back takes them off.
 *
 *   THE BALANCES. What the customer owes follows the edited total, and
 *   follows a credit note down. What is owed to a supplier follows a bill
 *   edit and a supplier credit the same way.
 *
 *   THE CASH BOOK. A refund is money out (customer) or in (supplier), in a
 *   category the reports know is not a cost or an income -- the credit
 *   already took it out of revenue or cost, and counting the cash too
 *   would count it twice.
 *
 *   THE OTHER HALF. A sale changed after its supplier bills were raised
 *   flags those bills for review rather than rewriting the supplier's
 *   paper.
 *
 *   THE REFUSALS. A paid document is closed to editing; an edit may not
 *   take a document below what was already paid; a credit may not take
 *   back more than was sold or refund more than was paid.
 *
 * Run: node test/document-corrections.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('document corrections');
const src = read('index.html');

const store = {};
let nextId = 1;
const stockMoves = [];
const cash = [];
const reset = () => {
  store.customers = [{ id: 'C1', name: 'Nakato', phone: '', debt: 0, debtLog: [] },
                     { id: 'C2', name: 'Okello', phone: '', debt: 0, debtLog: [] }];
  store.savedQuotes = [];
  store.purchaseInvoices = [];
  store.stock = { 'P1|': 50, 'P2|': 20 };
  store.suppliers = [{ id: 'S1', name: 'Steel Express' }, { id: 'S2', name: 'Sun Steel' }];
  store.cashTxns = cash;
  store.stockLog = [];
  stockMoves.length = 0;
  cash.length = 0;
};
const key = (p, v) => `${p}|${v == null ? '' : v}`;
const env = {
  data: store,
  allocRowId: () => nextId++,
  issueRowId: async () => nextId++,
  todayISO: () => '2026-09-26',
  fmtUGX: (n) => `${Number(n).toLocaleString('en-UG')} UGX`,
  invoiceNumberLabel: (q) => `INV-${String(q.id).padStart(4, '0')}`,
  purchaseInvoiceNumberLabel: (pi) => `PINV-${String(pi.id).padStart(4, '0')}`,
  generateCustomerId: () => 'C' + (nextId++),
  quoteSuggestedPrice: () => null,
  quoteSuggestedStockPrice: () => null,
  saveData: () => {},
  supplierName: (id) => { const s = store.suppliers.find(x => x.id === id); return id === '__stock__' ? 'Our stock' : s ? s.name : '(unknown supplier)'; },
  orderLineIsBoughtIn: (it) => !!(it && it.supplierId && it.supplierId !== '__stock__'),
  quoteLineComesOffShelf: (it) => it.supplierId === '__stock__' || Number(it.receivedQty) > 0,
  quoteLineReceived: (it) => Number(it.receivedQty) > 0,
  quoteLineSurplus: () => 0,
  getStockQty: (p, v) => Number(store.stock[key(p, v)]) || 0,
  stockMoveOnRowUnit: (p, v, qty, unit, cost) => ({ qty: Number(qty) || 0, cost: cost == null ? null : Number(cost) }),
  applyStockDelta: (p, v, delta, type, note) => {
    const k = key(p, v);
    store.stock[k] = Math.max(0, (Number(store.stock[k]) || 0) + delta);
    stockMoves.push({ k, delta, type, note });
    store.stockLog.push({ id: nextId++, key: k, delta, type, note });
    return store.stock[k];
  },
  normaliseCashAccount: (a) => a || 'cash',
  addCashPayment: (account, amount, category, description, date) => { const id = nextId++; cash.push({ id, type: 'payment', account, amount, category, description, date }); return id; },
  addCashReceipt: (account, amount, category, description, date) => { const id = nextId++; cash.push({ id, type: 'receipt', account, amount, category, description, date }); return id; },
  purchaseInvoicesForOrder: (q) => store.purchaseInvoices.filter(pi => pi.quoteId === q.id),
  nextPaymentId: (q) => ((q.payments || []).reduce((m, p) => Math.max(m, Number(p.id) || 0), 0)) + 1,
  CUSTOMER_REFUND_CATEGORY: 'Customer Refund',
  SUPPLIER_REFUND_CATEGORY: 'Supplier Refund',
};
const NAMES = [
  'orderCharges', 'chargeAmount', 'savedQuoteGoodsTotal', 'orderCreditTerms', 'orderCreditCharge', 'savedQuoteCashTotal',
  'orderChargesTotal', 'savedQuoteTotal', 'quoteItemSellPrice', 'invoiceBalanceDue', 'invoiceDebtDesired',
  'resolveInvoiceCustomer', 'applyInvoiceDebtCharge', 'syncInvoiceDebtCharge', 'orderTakesCharges',
  'applyQuoteStockDeduction', 'reverseQuoteStockDeduction', 'applyQuoteSurplusToStock', 'reverseQuoteSurplusToStock',
  'purchaseInvoiceTotal', 'purchaseInvoiceBalanceDue',
  'creditNoteNumberLabel', 'supplierCreditNumberLabel', 'savedQuoteDiscount', 'liveCreditNotes', 'savedQuoteCreditedTotal',
  'creditedQtyOnLine', 'liveSupplierCredits', 'purchaseInvoiceCreditedTotal', 'supplierCreditedQtyOnLine', 'docLogAdd',
  'invoiceEditable', 'invoiceEditTouchesBills', 'applyInvoiceEdit', 'raiseCreditNote',
  'billEditable', 'billStocksShelf', 'applyBillEdit', 'markBillPriceChecked', 'recordSupplierCredit', 'createSupplierBill',
];
let fns = null, err = null;
try { fns = compileScope(NAMES.map(n => extractFunction(src, n, 'index.html')), env, NAMES); }
catch (e) { err = e; }
t.check(!!fns, `the correction routines compile${err ? ` (${err.message})` : ''}`);

const sale = (over = {}) => {
  const q = Object.assign({
    id: 7, client: { name: 'Nakato', phone: '' }, customerId: 'C1', date: '2026-09-10', status: 'completed',
    invoiced: true, invoicedAt: '2026-09-10', amountPaid: 0, payments: [], voided: false, debtCharged: 0,
    items: [
      { lineId: 1, productId: 'P1', variantIdx: null, productName: 'Cement', qty: 10, sellPrice: 30000, price: 25000, supplierId: '__stock__', unit: 'bag' },
      { lineId: 2, productId: 'P2', variantIdx: null, productName: 'Sheets', qty: 5, sellPrice: 20000, price: 15000, supplierId: 'S1', unit: 'sheet' },
    ],
  }, over);
  store.savedQuotes.push(q);
  return q;
};
const lines = (q) => q.items.map((it, i) => ({ ...it, _k: 'L' + it.lineId }));

(async () => {
  if (!fns) { process.exit(t.done() ? 1 : 0); return; }
  const F = fns;

  /* ---------- 1. an edited quantity moves the shelf and the balance --- */
  {
    reset();
    const q = sale();
    F.applyQuoteStockDeduction(q);
    F.syncInvoiceDebtCharge(q);
    t.check(store.stock['P1|'] === 40 && store.customers[0].debt === 400000,
      `invoicing took 10 off the shelf and charged 400,000 (shelf ${store.stock['P1|']}, owed ${store.customers[0].debt})`);
    const next = { clientName: 'Nakato', customerId: 'C1', invoicedAt: '2026-09-10', termsDays: '14', invoiceNote: 'Deliver to Kira',
      discount: 0, lines: lines(q).map(l => l.productId === 'P1' ? { ...l, qty: 12 } : l) };
    const r = F.applyInvoiceEdit(q.id, next);
    t.check(r.ok, `the edit is accepted${r.why ? ` (${r.why})` : ''}`);
    t.check(store.stock['P1|'] === 38, `the shelf gives up exactly the two more (now ${store.stock['P1|']})`);
    t.check(stockMoves.some(m => m.type === 'reversal' && /Corrected — INV-0007 edited/.test(m.note)),
      'and the log says the invoice was corrected, not un-invoiced');
    t.check(store.customers[0].debt === 460000, `the customer now owes the new total (${store.customers[0].debt})`);
    t.check(q.termsDays === 14 && q.invoiceNote === 'Deliver to Kira', 'terms and the note are kept on the invoice');
    t.check(q.docLog && q.docLog.some(e => e.kind === 'edited'), 'and its history says it was edited');
  }

  /* ---------- 2. a changed bought-in line flags its bill -------------- */
  {
    reset();
    const q = sale();
    F.applyQuoteStockDeduction(q);
    store.purchaseInvoices.push({ id: 31, quoteId: q.id, supplierId: 'S1', supplierName: 'Steel Express', date: '2026-09-10',
      items: [{ productId: 'P2', variantIdx: null, qty: 5, price: 15000 }], amountPaid: 0, payments: [], voided: false });
    t.check(F.invoiceEditTouchesBills(q, lines(q)).length === 0, 'an unchanged sale flags nothing');
    const r = F.applyInvoiceEdit(q.id, { clientName: 'Nakato', customerId: 'C1', invoicedAt: '2026-09-10', termsDays: '', invoiceNote: '', discount: 0,
      lines: lines(q).map(l => l.productId === 'P2' ? { ...l, qty: 6 } : l) });
    t.check(r.ok && r.flagged.length === 1 && store.purchaseInvoices[0].needsReview,
      'a changed quantity on a bought-in line flags the supplier\'s bill for review');
    t.check(store.purchaseInvoices[0].items[0].qty === 5, 'and leaves the supplier\'s own paper as it was');
  }

  /* ---------- 3. the refusals ---------------------------------------- */
  {
    reset();
    const q = sale({ amountPaid: 300000, payments: [{ id: 1, date: '2026-09-11', amount: 300000 }] });
    F.applyQuoteStockDeduction(q);
    const below = F.applyInvoiceEdit(q.id, { clientName: 'Nakato', customerId: 'C1', invoicedAt: '2026-09-10', termsDays: '', invoiceNote: '', discount: 0,
      lines: lines(q).map(l => l.productId === 'P1' ? { ...l, qty: 1 } : l) });
    t.check(!below.ok && /below the/.test(below.why) && q.items[0].qty === 10,
      'an edit that would take the invoice below what was paid is refused, and nothing moves');
    const none = F.applyInvoiceEdit(q.id, { clientName: 'Nakato', lines: [] });
    t.check(!none.ok && /at least one line/.test(none.why), 'an invoice with no lines is refused — void it instead');
    q.amountPaid = 400000;
    t.check(!F.invoiceEditable(q), 'a paid invoice is closed to editing');
    const closed = F.applyInvoiceEdit(q.id, { clientName: 'Nakato', lines: lines(q) });
    t.check(!closed.ok && /credit note/.test(closed.why), 'and says a credit note is how it is corrected');
  }

  /* ---------- 4. a discount ----------------------------------------- */
  {
    reset();
    const q = sale();
    F.syncInvoiceDebtCharge(q);
    const r = F.applyInvoiceEdit(q.id, { clientName: 'Nakato', customerId: 'C1', invoicedAt: '2026-09-10', termsDays: '', invoiceNote: '', discount: 25000, lines: lines(q) });
    t.check(r.ok && F.savedQuoteTotal(q) === 375000 && store.customers[0].debt === 375000,
      `a discount comes off the total and off what the customer owes (${F.savedQuoteTotal(q)})`);
  }

  /* ---------- 5. moving the sale to another customer ----------------- */
  {
    reset();
    const q = sale();
    F.syncInvoiceDebtCharge(q);
    const r = F.applyInvoiceEdit(q.id, { clientName: 'Okello', customerId: 'C2', invoicedAt: '2026-09-10', termsDays: '', invoiceNote: '', discount: 0, lines: lines(q) });
    t.check(r.ok && store.customers[0].debt === 0 && store.customers[1].debt === 400000,
      `the debt leaves the old customer and lands on the new one (${store.customers[0].debt} / ${store.customers[1].debt})`);
  }

  /* ---------- 6. a credit note against a paid invoice ---------------- */
  {
    reset();
    const q = sale({ amountPaid: 400000, payments: [{ id: 1, date: '2026-09-11', amount: 400000, cashTxnId: 99 }] });
    F.applyQuoteStockDeduction(q);
    F.syncInvoiceDebtCharge(q);
    const over = await F.raiseCreditNote(q.id, { lines: [{ idx: 0, qty: 11 }] });
    t.check(!over.ok && /only 10 left/.test(over.why), 'a credit cannot take back more than was sold');
    const tooMuch = await F.raiseCreditNote(q.id, { lines: [{ idx: 0, qty: 2 }], refund: { amount: 70000, account: 'cash' } });
    t.check(!tooMuch.ok && /cannot be more than the credit/.test(tooMuch.why), 'nor refund more than it credits');
    const r = await F.raiseCreditNote(q.id, { lines: [{ idx: 0, qty: 2 }], restock: true, refund: { amount: 60000, account: 'cash' }, reason: 'Two bags split' });
    t.check(r.ok && r.cn.amount === 60000 && /^CN-\d{4}$/.test(F.creditNoteNumberLabel(r.cn)),
      `a credit note is raised for two bags at 30,000, numbered on paper (${r.ok ? F.creditNoteNumberLabel(r.cn) : r.why})`);
    t.check(F.savedQuoteTotal(q) === 340000, `the invoice's value comes down by the credit (${F.savedQuoteTotal(q)})`);
    t.check(q.amountPaid === 340000 && q.payments.some(p => p.amount === -60000 && p.refund),
      'the refund is recorded against the invoice as money going back');
    t.check(cash.some(c => c.type === 'payment' && c.amount === 60000 && c.category === 'Customer Refund'),
      'and leaves the Cash Book as a Customer Refund');
    t.check(store.stock['P1|'] === 42 && r.cn.restocked, `the two bags go back on the shelf (${store.stock['P1|']})`);
    t.check(q.items[0].qty === 10, 'the original invoice line is untouched — the note carries the correction');
    t.check(store.customers[0].debt === 0, 'and the customer still owes nothing');
    const again = await F.raiseCreditNote(q.id, { lines: [{ idx: 0, qty: 9 }] });
    t.check(!again.ok && /only 8 left/.test(again.why), 'a second note sees what the first already took back');
  }

  /* ---------- 7. a stock bill edited, and credited once paid ---------- */
  {
    reset();
    store.purchaseInvoices.push({ id: 41, quoteId: null, supplierId: 'S2', supplierName: 'Sun Steel', date: '2026-09-20',
      items: [{ productId: 'P2', variantIdx: null, productName: 'Sheets', qty: 10, price: 15000, unit: 'sheet' }],
      amountPaid: 50000, payments: [{ date: '2026-09-21', amount: 50000 }], voided: false, priceCheckedAt: '2026-09-21' });
    const pi = store.purchaseInvoices[0];
    const low = F.applyBillEdit(pi.id, { date: '2026-09-20', transport: 0, lines: [{ idx: 0, productId: 'P2', productName: 'Sheets', qty: 3, price: 15000 }] });
    t.check(!low.ok && /below the/.test(low.why), 'a bill cannot be edited below what was already paid to the supplier');
    const r = F.applyBillEdit(pi.id, { supplierRef: 'SS-8821', date: '2026-09-20', dueDate: '2026-10-05', transport: 20000,
      lines: [{ idx: 0, productId: 'P2', productName: 'Sheets', qty: 12, price: 15500, unit: 'sheet' }] });
    t.check(r.ok && store.stock['P2|'] === 22, `the two more sheets go on the shelf (now ${store.stock['P2|']})`);
    t.check(F.purchaseInvoiceTotal(pi) === 12 * 15500 + 20000, `transport is part of what is owed (${F.purchaseInvoiceTotal(pi)})`);
    t.check(pi.supplierRef === 'SS-8821' && pi.dueDate === '2026-10-05', 'the supplier\'s own number and the due day are kept');
    t.check(!pi.priceCheckedAt, 'a changed price asks for the price check again');
    pi.amountPaid = F.purchaseInvoiceTotal(pi);
    t.check(!F.billEditable(pi), 'a paid bill is closed to editing');
    const sc = await F.recordSupplierCredit(pi.id, { lines: [{ idx: 0, qty: 2 }], returned: true, refund: { amount: 31000, account: 'bank' } });
    t.check(sc.ok && sc.sc.amount === 31000 && /^SC-\d{4}$/.test(F.supplierCreditNumberLabel(sc.sc)), 'a supplier credit is recorded for two sheets');
    t.check(store.stock['P2|'] === 20, `the two sheets that went back come off the shelf (${store.stock['P2|']})`);
    t.check(cash.some(c => c.type === 'receipt' && c.amount === 31000 && c.category === 'Supplier Refund'),
      'the refund comes into the Cash Book as a Supplier Refund');
    t.check(F.purchaseInvoiceBalanceDue(pi) === 0 && pi.items[0].qty === 12,
      'nothing is owed, and the bill\'s own lines stay as the supplier wrote them');
  }

  /* ---------- 8. a bill recorded by hand -------------------------------- */
  {
    reset();
    const r = await F.createSupplierBill({ supplierId: 'S1', supplierRef: 'SE-1', date: '2026-09-26', quoteId: null, transport: 0,
      lines: [{ productId: 'P1', productName: 'Cement', qty: 5, price: 24000, unit: 'bag' }] });
    t.check(r.ok && store.purchaseInvoices.length === 1 && store.stock['P1|'] === 55,
      'a stock bill recorded by hand puts its goods on the shelf');
    const q = sale({ id: 9 });
    const r2 = await F.createSupplierBill({ supplierId: 'S1', date: '2026-09-26', quoteId: q.id, transport: 0,
      lines: [{ productId: 'P2', productName: 'Sheets', qty: 5, price: 15000 }] });
    t.check(r2.ok && r2.pi.quoteId === 9 && store.stock['P2|'] === 20,
      'a bill for a sale links to it and leaves the shelf alone — those goods went straight on');
    const bad = await F.createSupplierBill({ supplierId: '', lines: [] });
    t.check(!bad.ok, 'a bill with no supplier is refused');
  }

  /* ---------- 9. the reports and the saved record ----------------------- */
  {
    const notOpex = extractDeclaration(src, 'CASH_NOT_OPEX', 'index.html');
    const notRev = extractDeclaration(src, 'CASH_NOT_REVENUE', 'index.html');
    t.check(/'Customer Refund':/.test(notOpex), 'a customer refund is not an operating cost — the credit note already took it out of revenue');
    t.check(/'Supplier Refund':/.test(notRev), 'and a supplier refund is not income — the supplier credit already cut the cost');
    const totals = extractFunction(src, 'anInvoiceTotals', 'index.html');
    t.check(/sales -= Math\.min\(Math\.max\(0, Number\(q\.discount\)/.test(totals) && /q\.creditNotes/.test(totals),
      'the income statement\'s revenue comes down by the discount and by each credit note');
    const sync = extractFunction(src, 'buildSyncRows', 'index.html');
    ['discount:q.discount', 'termsDays:q.termsDays', 'invoiceNote:q.invoiceNote', 'creditNotes:q.creditNotes', 'docLog:q.docLog',
     'supplierRef:pi.supplierRef', 'transport:pi.transport', 'credits:pi.credits', 'priceCheckedAt:pi.priceCheckedAt',
     'needsReview:pi.needsReview', 'photo:pi.photo'].forEach(k => {
      t.check(sync.includes(k), `${k.split(':')[0]} is named in the saved payload, so a save cannot strip it`);
    });
  }

  process.exit(t.done() ? 1 : 0);
})();
