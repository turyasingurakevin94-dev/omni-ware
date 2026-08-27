#!/usr/bin/env node
'use strict';
/*
 * What the shop already owed a supplier before any of this was recorded.
 *
 * A shop does not start trading on the day it starts recording, and the
 * supplier form had nowhere to say so. The customer side has had the
 * mirror of this since the debtors list learned about aging: an opening
 * balance, dated when the debt started or explicitly undated.
 *
 * The two sides cannot be built the same way, and that is the whole
 * substance of this file. A customer's debt is a STORED total on the
 * customer, so their opening balance is an entry in their ledger. What the
 * shop owes a supplier is DERIVED, live, from purchase invoices and from
 * nothing else -- creditorTotalOwed, credOpenInvoices and payablesAsAt are
 * three independent walks of that one array, and not one of them reads a
 * supplier record for money. So a figure stored on the supplier would have
 * been invisible to every screen that reports payables, and the opening
 * balance has to BE a purchase invoice.
 *
 * Which puts the weight on its shape. purchaseInvoiceTotal() sums
 * qty * price across items and there is no stored total field anywhere, so
 * an opening balance without a line item is a record worth zero to all of
 * them -- present, findable, and counted by nobody.
 *
 * Run: node test/supplier-opening-balance.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('supplier opening balance');
const src = read('index.html');
const code = src.split(/\r?\n/).map(l => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');

const store = { suppliers: [], purchaseInvoices: [], customers: [], savedQuotes: [] };
let nextPinv = 41;
const env = {
  data: store,
  issueRowId: async () => nextPinv++,
  supplierName: (id) => (store.suppliers.find(s => s.id === id) || {}).name || '',
  todayISO: () => '2026-08-21',
};
const NAMES = [
  /* Payables now include consignment that has sold and not been settled
     -- money owed with no bill yet -- so its chain comes along. A
     fixture holding nothing on consignment simply reads zero. */
  'consignmentHeld', 'consignmentAccrued', 'consignmentSettlements',
  'consignmentSettled', 'consignmentRows', 'consignmentOwedTotal',
  'purchaseInvoiceTotal', 'purchaseInvoiceBalanceDue',
  'purchaseInvoiceIsOpeningBalance', 'supplierOpeningInvoice', 'createSupplierOpeningBalance',
  'creditorOutstandingInvoices', 'creditorTotalOwed', 'creditorOldestDueDate',
  'daysSinceDate', 'agingBandFor', 'credOpenInvoices', 'payablesAsAt', 'dashTotalCreditors',
];
let fns = null, err = null;
try {
  fns = compileScope(
    [extractDeclaration(src, 'AGING_BANDS', 'index.html'),
      extractDeclaration(src, 'SUPPLIER_OPENING_BALANCE_LABEL', 'index.html'),
      ...NAMES.map(n => extractFunction(src, n, 'index.html'))],
    env, NAMES,
  );
} catch (e) { err = e; }
t.check(!!fns, `the opening-balance routines compile${err ? ` (${err.message})` : ''}`);

if (fns) {
  const {
    purchaseInvoiceTotal, purchaseInvoiceBalanceDue, supplierOpeningInvoice,
    createSupplierOpeningBalance, creditorTotalOwed, creditorOutstandingInvoices,
    creditorOldestDueDate, credOpenInvoices, payablesAsAt, purchaseInvoiceIsOpeningBalance,
  } = fns;

  const reset = () => {
    store.suppliers = [{ id: 'S1', name: 'Kagwa Hardware' }, { id: 'S2', name: 'Other' }];
    store.purchaseInvoices = [];
    nextPinv = 41;
  };

  (async () => {
    /* ---------- 1. it reaches every screen that counts payables ------ */
    /*
     * The point of making it a purchase invoice rather than a field on the
     * supplier. Each of these is a SEPARATE walk of data.purchaseInvoices
     * in the app; if the record were shaped wrongly they would disagree.
     */
    {
      reset();
      const pi = await createSupplierOpeningBalance('S1', 1200000, '2026-05-04');
      t.check(!!pi && pi.id === 41, 'an opening balance takes a real PINV- number');
      t.check(purchaseInvoiceTotal(pi) === 1200000,
        `it is worth its amount, not zero -- the line item is what makes it so (got ${purchaseInvoiceTotal(pi)})`);
      t.check(creditorTotalOwed('S1') === 1200000, 'the supplier is owed it on the creditors list');
      t.check(creditorOutstandingInvoices('S1').length === 1, 'it is an outstanding invoice to be paid off');
      t.check(payablesAsAt('2026-08-21') === 1200000, 'the balance sheet counts it in payables');
      t.check(credOpenInvoices().reduce((s, i) => s + i.due, 0) === 1200000,
        'and the creditors aging bar carries the same figure as the rows beneath it');
      t.check(creditorTotalOwed('S2') === 0, 'and it belongs to one supplier only');
    }

    /* ---------- 2. it is aged from when the debt started ------------- */
    /*
     * The fault the customer side already fixed once: dating a carried-in
     * balance today files it under "Under 30 days" -- the one band
     * AGING_BANDS says a figure typed straight in must never quietly join.
     */
    {
      reset();
      await createSupplierOpeningBalance('S1', 500000, '2026-05-04');
      const open = credOpenInvoices()[0];
      t.check(open.ageDays === 109, `it is aged from the date given, not from today (got ${open.ageDays})`);
      t.check(open.band === 'b90p', `so it lands in over-90-days where it belongs (got ${open.band})`);
      t.check(creditorOldestDueDate('S1') === '2026-05-04', 'and it is what the supplier has been owed since');
    }

    /* ---------- 3. nobody knows when it started ---------------------- */
    /*
     * A real answer, and the app already models it. An undated balance
     * must NOT pass for new, and must not pass for zero days old either.
     */
    {
      reset();
      await createSupplierOpeningBalance('S1', 300000, '');
      const open = credOpenInvoices()[0];
      t.check(open.band === 'unknown', `an undated opening balance lands in "No date on record" (got ${open.band})`);
      t.check(open.band !== 'b30', 'and never quietly in under-30-days');
      t.check(creditorTotalOwed('S1') === 300000, 'while still being money the shop owes');
      // An opening balance predates everything, so it sorts first among a
      // supplier's invoices -- which is also the order they are paid off in.
      store.purchaseInvoices.push({ id: 60, supplierId: 'S1', date: '2026-07-01',
        items: [{ qty: 1, price: 90000 }], amountPaid: 0, payments: [], voided: false });
      t.check(creditorOutstandingInvoices('S1')[0].id === 41,
        'and is settled before later bills, being the oldest thing owed');
      t.check(payablesAsAt('2026-06-01') === 300000,
        'a balance sheet dated before the shop started still shows it -- the debt existed');
    }

    /* ---------- 4. it is an ordinary bill from then on --------------- */
    {
      reset();
      const pi = await createSupplierOpeningBalance('S1', 400000, '2026-06-01');
      pi.amountPaid = 150000;
      pi.payments = [{ date: '2026-08-01', amount: 150000 }];
      t.check(purchaseInvoiceBalanceDue(pi) === 250000, 'it can be paid off in part like any other bill');
      t.check(creditorTotalOwed('S1') === 250000, 'and the creditors list follows the payment down');
      pi.amountPaid = 400000;
      t.check(creditorTotalOwed('S1') === 0 && creditorOutstandingInvoices('S1').length === 0,
        'settling it clears the supplier');
      pi.amountPaid = 0;
      pi.voided = true;
      t.check(creditorTotalOwed('S1') === 0, 'and voiding it takes it off the books');
    }

    /* ---------- 5. never two of them -------------------------------- */
    /*
     * Two opening balances would silently double what the shop believes it
     * owes, so the form closes the field once one exists. That check is
     * only as good as its ability to FIND the existing one.
     */
    {
      reset();
      t.check(supplierOpeningInvoice('S1') === null, 'a supplier with none is offered the field');
      const pi = await createSupplierOpeningBalance('S1', 700000, '2026-06-01');
      t.check(supplierOpeningInvoice('S1') === pi, 'once written, it is found again');
      t.check(supplierOpeningInvoice('S2') === null, 'and only for the supplier it belongs to');

      // The flag rides a JSON payload. If anything ever strips it, the
      // line's own name still answers the question -- otherwise the form
      // would offer the field again and double the debt.
      delete pi.openingBalance;
      t.check(purchaseInvoiceIsOpeningBalance(pi),
        'a record whose flag was lost is still recognised by its own line');
      t.check(supplierOpeningInvoice('S1') === pi, 'so the field stays closed and no second one is written');

      // A voided one is not a reason to refuse: the shop said that figure
      // was wrong, and must be able to enter the right one.
      pi.openingBalance = true;
      pi.voided = true;
      t.check(supplierOpeningInvoice('S1') === null,
        'a voided opening balance frees the field, so a wrong figure can be replaced');
    }

    /* ---------- 6. nothing is written for nothing ------------------- */
    {
      reset();
      t.check(await createSupplierOpeningBalance('S1', 0, '2026-06-01') === null,
        'a blank opening balance writes no invoice');
      t.check(await createSupplierOpeningBalance('S1', -5000, '2026-06-01') === null,
        'and neither does a negative one -- a bill for less than nothing is not a bill');
      t.check(await createSupplierOpeningBalance('', 5000, '2026-06-01') === null,
        'nor one with no supplier to owe');
      t.check(store.purchaseInvoices.length === 0, 'so the purchase invoice list is untouched');
    }

    /* ---------- 7. the shape the whole thing rests on ---------------- */
    {
      reset();
      const pi = await createSupplierOpeningBalance('S1', 850000, '2026-04-02');
      t.check(pi.voided === false, 'not voided -- every reader filters on it');
      t.check(pi.amountPaid === 0 && Array.isArray(pi.payments) && pi.payments.length === 0,
        'nothing paid on it yet, so payablesAsAt and balanceDue agree about it');
      t.check(pi.quoteId === null, 'raised by no order');
      t.check(pi.supplierId === 'S1' && pi.supplierName === 'Kagwa Hardware',
        'and named, since payables reach invoices through the supplier list');
      t.check(pi.items.length === 1 && pi.items[0].qty === 1 && pi.items[0].price === 850000,
        'one line carrying the whole amount');
    }

    /* ---------- 8. wiring, and the round trip ------------------------ */
    {
      t.check(/\.\.\.\(pi\.openingBalance \? \{openingBalance:true\} : \{\}\)/.test(code),
        'the marker is written into the sync payload, so it survives a reload');
      t.check(/const openChk = openLocked/.test(code),
        'the form validates the opening balance before writing anything');
      t.check(/cfOpeningBalanceCheck\(openField\.value,/.test(code),
        'through the same routine the customer form uses, rather than a second copy of the question');
      t.check(/opened = await createSupplierOpeningBalance\(id, openChk\.amount, since\);/.test(code),
        'and writes it only after the supplier itself is on file');
      const save = code.slice(code.indexOf("getElementById('s_save')"));
      const linkAt = save.indexOf('linkCustomerSupplier');
      const openAt = save.indexOf('createSupplierOpeningBalance');
      t.check(linkAt > 0 && openAt > linkAt,
        'the invoice is raised after the supplier exists -- payables reach invoices through the supplier list');
      t.check(/function sfShowOpeningBalance\(supplierId\)/.test(code),
        'the form says what an existing opening balance is, instead of silently offering a second');
      t.check(/sfShowOpeningBalance\(s\.id\);/.test(code) && /sfShowOpeningBalance\(null\);/.test(code),
        'on edit as well as on add — the suppliers a shop owed are already on file');
    }

    process.exit(t.done() ? 1 : 0);
  })();
} else {
  process.exit(t.done() ? 1 : 0);
}
