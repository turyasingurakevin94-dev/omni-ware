#!/usr/bin/env node
'use strict';
/*
 * Deleting a counterparty must not hide what they owe, or what is owed
 * to them.
 *
 * The Debtors List is built by mapping data.customers, and the Creditors
 * List by mapping data.suppliers. So deleting either did not clear the
 * balance -- it hid it. The documents stayed on file with their balances
 * intact, pointing at a row that no longer existed, and the list they used
 * to appear in simply totalled less.
 *
 * On seeded data: 560,000 owed to a supplier, delete them, and the
 * Creditors List totals 0 while the purchase invoice still carries the
 * full 560,000. The supplier delete warned only about price entries; the
 * customer one mentioned debt history without saying there was any.
 *
 * Both now refuse while money is outstanding, and say what to do instead --
 * the same shape deleteCustomerDebtLog() already uses when it refuses to
 * remove an invoice-owned ledger entry.
 *
 * Run: node test/admin-delete-guards.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('admin delete guards');
const src = read('index.html');
const code = src.split(/\r?\n/).map(l => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');

const store = { suppliers: [], customers: [], purchaseInvoices: [], savedQuotes: [], products: [] };
let toasts = [], confirms = 0, confirmAnswer = true;
const env = {
  data: store,
  toast: (m) => toasts.push(String(m)),
  confirm: () => { confirms++; return confirmAnswer; },
  fmtUGX: (n) => `${Math.round(n).toLocaleString('en-US')} UGX`,
  saveData: () => {},
  renderSuppliers: () => {}, renderCustomers: () => {},
  populatePriceSupplierFilter: () => {}, triggerPricesRender: () => {},
  document: { getElementById: () => ({ value: '' }) },
  quoteSuggestedPrice: () => null, quoteSuggestedStockPrice: () => null,
};
const NAMES = [
  'purchaseInvoiceTotal', 'purchaseInvoiceBalanceDue', 'creditorTotalOwed',
  'savedQuoteTotal', 'quoteItemSellPrice', 'invoiceBalanceDue', 'customerOutstandingInvoices',
  'deleteSupplier', 'deleteCustomer',
];
let fns = null, err = null;
try { fns = compileScope(NAMES.map(n => extractFunction(src, n, 'index.html')), env, NAMES); }
catch (e) { err = e; }
t.check(!!fns, `the delete routines compile${err ? ` (${err.message})` : ''}`);

const reset = () => { toasts = []; confirms = 0; };

if (fns) {
  const { deleteSupplier, deleteCustomer, creditorTotalOwed } = fns;

  const seedSupplier = (amountPaid) => {
    store.suppliers = [{ id: 'S1', name: 'Kirinya Steel' }];
    store.purchaseInvoices = [{
      id: 1, supplierId: 'S1', supplierName: 'Kirinya Steel', date: '2026-07-01',
      items: [{ productId: 'P1', variantIdx: null, qty: 20, price: 28000 }],
      amountPaid, payments: [], voided: false,
    }];
  };
  const seedCustomer = (debt, invoices) => {
    store.customers = [{ id: 'C1', name: 'Sarah Namono', debt, debtLog: [] }];
    store.savedQuotes = invoices;
  };
  const openInvoice = () => ({
    id: 9, client: { name: 'Sarah Namono' }, date: '2026-07-01', customerId: 'C1',
    items: [{ id: 1, productId: 'P1', variantIdx: null, qty: 1, sellPrice: 9000, supplierId: 'S1' }],
    status: 'completed', invoiced: true, invoicedAt: '2026-07-01',
    amountPaid: 0, payments: [], voided: false, debtCharged: 0,
  });

  /* ---------- 1. a supplier you still owe --------------------------- */
  {
    seedSupplier(0);
    t.check(creditorTotalOwed('S1') === 560000, 'the supplier is owed 560,000');
    reset();
    deleteSupplier('S1');
    t.check(store.suppliers.length === 1, 'the delete is refused');
    t.check(confirms === 0, 'without even asking -- there is nothing to weigh up, the money is real');
    t.check(/still owe this supplier/.test(toasts[0] || ''), 'and it says why');
    t.check(/560,000/.test(toasts[0] || ''), `naming the amount (${toasts[0]})`);
    t.check(/Settle or void/.test(toasts[0] || ''), 'and what to do instead');
  }

  /* ---------- 2. and once it is settled ----------------------------- */
  {
    seedSupplier(560000);
    t.check(creditorTotalOwed('S1') === 0, 'nothing outstanding');
    reset();
    deleteSupplier('S1');
    t.check(store.suppliers.length === 0, 'the delete goes through');
    t.check(confirms === 1, 'behind the ordinary confirmation, which is unchanged');
  }

  /* ---------- 3. a customer who owes -------------------------------- */
  {
    seedCustomer(45000, []);
    reset();
    deleteCustomer('C1');
    t.check(store.customers.length === 1, 'refused');
    t.check(confirms === 0 && /still owes/.test(toasts[0] || ''), 'with the reason, not a confirmation');
    t.check(/Sarah Namono/.test(toasts[0] || '') && /45,000/.test(toasts[0] || ''),
      `naming them and the amount (${toasts[0]})`);
  }

  /* ---------- 4. no balance, but an invoice still open -------------- */
  /*
   * The case a balance check alone would miss: the standing debt is zero,
   * yet an invoice in their name is unsettled and would keep its balance
   * after the customer row was gone.
   */
  {
    seedCustomer(0, [openInvoice()]);
    reset();
    deleteCustomer('C1');
    t.check(store.customers.length === 1, 'still refused');
    t.check(/unsettled invoice/.test(toasts[0] || ''), `on the invoice, not the balance (${toasts[0]})`);
    t.check(/1 unsettled invoice\b/.test(toasts[0] || ''), 'counted and singular');
  }

  /* ---------- 5. a clean counterparty still deletes ----------------- */
  {
    seedCustomer(0, []);
    reset();
    deleteCustomer('C1');
    t.check(store.customers.length === 0 && confirms === 1,
      'a customer with nothing outstanding deletes as before');

    // And a voided invoice is not a reason to refuse.
    seedCustomer(0, [Object.assign(openInvoice(), { voided: true })]);
    reset();
    deleteCustomer('C1');
    t.check(store.customers.length === 0, 'nor does a voided invoice block it -- it is not owed');
  }
}

/* ---------- 6. the lists that made this invisible ------------------- */
/*
 * Pinned so the reason is recorded: both lists are built from the entity
 * array, so a document pointing at a deleted row has nowhere to appear.
 */
{
  /* Both mappings moved into their own row builders when the aging
     profiles were added, so each list and the bands above it read one
     row set instead of building two. What has to hold is unchanged and
     is what is pinned: the rows come from the entity array, so a
     document pointing at a deleted row has nowhere to appear. */
  t.check(/function credAllRows\(\)\{[\s\S]*?\n  return data\.suppliers\.map\(s=>\{/.test(code),
    'the Creditors List is built by mapping suppliers');
  t.check(/function debAllRows\(\)\{\s*\n\s*return data\.customers\.map\(c=>\{/.test(code),
    'and the Debtors List by mapping customers');
  t.check(/const owed = creditorTotalOwed\(id\);\s*\n\s*if\(owed > 0\.5\)\{/.test(code),
    'so deleteSupplier checks what is owed first');
  t.check(/if\(owed > 0 \|\| openInvoices > 0\)\{/.test(code),
    'and deleteCustomer checks both the balance and the open invoices');
}

process.exit(t.done() ? 1 : 0);
