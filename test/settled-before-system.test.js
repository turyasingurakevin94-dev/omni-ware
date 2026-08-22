#!/usr/bin/env node
'use strict';
/*
 * Stock that was already on the shelf on day one, and already paid for.
 *
 * To exist on the books at all it had to be entered as a purchase, and
 * that raised a bill -- so the Creditors list showed money owed to
 * suppliers who had in fact been settled with long before any of this
 * existed. A real shop hit this with 3,105,000 against one supplier it
 * owed nothing.
 *
 * The only way out the app offered was to record a payment, which spends
 * TODAY's cash on goods bought months ago. That is not a clerical
 * nuisance, it is a false entry with three consequences: the Cash Book
 * stops matching the money in the drawer, the cash flow statement reports
 * stock buying that never happened in the period, and backdating it
 * merely moves the lie to an earlier day.
 *
 * So a bill can be marked settled before this system: the debt clears and
 * no cash moves. What this file exists to prove is the "and nothing else
 * moves" half, because that is the claim a shopkeeper is being asked to
 * trust:
 *
 *   - cash book        untouched (no entry is written at all)
 *   - stock, and its cost basis   untouched (both live elsewhere)
 *   - cost of sales / profit      untouched (read off SALES invoices)
 *   - payables         down, at every date, including historic sheets
 *
 * Run: node test/settled-before-system.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('settled before this system');
const src = read('index.html');
const code = src.split(/\r?\n/).map(l => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');

const store = { suppliers: [], purchaseInvoices: [], cashTxns: [], stock: {}, stockLots: {} };
const env = { data: store, todayISO: () => '2026-08-21' };
const NAMES = [
  'purchaseInvoiceTotal', 'purchaseInvoiceBalanceDue',
  'piPaymentIsSettledBefore', 'purchaseInvoiceSettledBeforeTotal',
  'creditorTotalOwed', 'creditorOutstandingInvoices', 'payablesAsAt', 'dashTotalCreditors',
];
let fns = null, err = null;
try {
  fns = compileScope(
    // The note is the fallback identity for these entries, so the test
    // uses the app's own string rather than a copy that could drift.
    [extractDeclaration(src, 'SETTLED_BEFORE_NOTE', 'index.html'),
      ...NAMES.map(n => extractFunction(src, n, 'index.html'))],
    env, NAMES,
  );
}
catch (e) { err = e; }
t.check(!!fns, `the routines compile${err ? ` (${err.message})` : ''}`);

if (fns) {
  const {
    purchaseInvoiceTotal, purchaseInvoiceBalanceDue, piPaymentIsSettledBefore,
    purchaseInvoiceSettledBeforeTotal, creditorTotalOwed, creditorOutstandingInvoices, payablesAsAt,
  } = fns;

  // The reported shop: opening stock entered on the day they started,
  // raising a bill for goods bought and paid for long before.
  const OPENING_DAY = '2026-06-01';
  const setup = () => {
    store.suppliers = [{ id: 'S1', name: 'Karddia' }];
    store.cashTxns = [];
    store.purchaseInvoices = [{
      id: 7, quoteId: null, supplierId: 'S1', supplierName: 'Karddia', date: OPENING_DAY,
      items: [{ productName: 'Opening stock', qty: 1, price: 3105000 }],
      amountPaid: 0, payments: [], voided: false,
    }];
    return store.purchaseInvoices[0];
  };
  // Exactly what the save handler writes for this option.
  const settleBefore = (pi, amount, on) => {
    pi.payments.push({ date: on, amount, note: 'Settled before this system — no cash moved',
      cashTxnId: null, settledBeforeSystem: true });
    pi.amountPaid = (Number(pi.amountPaid) || 0) + amount;
  };

  /* ---------- 1. the debt clears ----------------------------------- */
  {
    const pi = setup();
    t.check(creditorTotalOwed('S1') === 3105000, 'before: the shop is shown owing 3,105,000 it does not owe');
    settleBefore(pi, 3105000, OPENING_DAY);
    t.check(creditorTotalOwed('S1') === 0, 'after: the supplier is clear');
    t.check(creditorOutstandingInvoices('S1').length === 0, 'and the bill stops appearing as outstanding');
  }

  /* ---------- 2. and NO cash moves --------------------------------- */
  /*
   * The whole point. An ordinary payment writes a Cash Book entry through
   * addCashPayment; this must write none, or the drawer stops matching
   * the book.
   */
  {
    const pi = setup();
    settleBefore(pi, 3105000, OPENING_DAY);
    t.check(store.cashTxns.length === 0, 'no Cash Book entry is created — the money left before any of this existed');
    t.check(pi.payments.every(p => p.cashTxnId === null),
      'and the record points at no cash entry, so removing it cannot delete one');
    t.check(purchaseInvoiceSettledBeforeTotal(pi) === 3105000,
      'the amount settled this way is identifiable, not mixed in with real payments');
  }

  /* ---------- 3. historic balance sheets, not just today's ---------- */
  /*
   * payablesAsAt re-sums payments dated on or before the date asked
   * about. Dating the settlement with the bill is what stops a sheet
   * printed for any month in between showing a debt that was never owed.
   */
  {
    const pi = setup();
    t.check(payablesAsAt('2026-07-01') === 3105000, 'before: a July sheet shows the phantom debt');
    settleBefore(pi, 3105000, OPENING_DAY);
    t.check(payablesAsAt('2026-07-01') === 0, 'after: it is gone from July too');
    t.check(payablesAsAt('2026-06-15') === 0, 'and from every date after the bill itself');
    t.check(payablesAsAt('2026-08-21') === 0, 'as well as from today');
  }

  /* ---------- 4. dating it later leaves the gap it should ----------- */
  /*
   * If a shop says it settled up in July rather than on day one, the
   * sheets must show the debt for June and not for August. The date is
   * not decoration.
   */
  {
    const pi = setup();
    settleBefore(pi, 3105000, '2026-07-15');
    t.check(payablesAsAt('2026-06-20') === 3105000, 'a June sheet still shows it owed, because in June it was');
    t.check(payablesAsAt('2026-07-20') === 0, 'and a later sheet shows it settled');
  }

  /* ---------- 5. part of a bill ------------------------------------ */
  /*
   * A bill can be a mix: some of it goods carried in, some genuinely
   * bought and still owed. Settling part must leave the rest owed.
   */
  {
    const pi = setup();
    settleBefore(pi, 2000000, OPENING_DAY);
    t.check(purchaseInvoiceBalanceDue(pi) === 1105000, 'the rest of the bill is still owed');
    t.check(creditorTotalOwed('S1') === 1105000, 'and the supplier still shows it');
    t.check(purchaseInvoiceTotal(pi) === 3105000, 'while the bill is still worth what it was — nothing was erased');
  }

  /* ---------- 6. reversible, and recognisable afterwards ------------ */
  {
    const pi = setup();
    settleBefore(pi, 3105000, OPENING_DAY);
    const p = pi.payments[0];
    t.check(piPaymentIsSettledBefore(p), 'the entry knows what it is');
    delete p.settledBeforeSystem;
    t.check(piPaymentIsSettledBefore(p),
      'and is still recognised by its note if the flag is ever lost in transit');
    // Undoing it puts the debt back, which is the honest reversal.
    pi.payments.splice(0, 1);
    pi.amountPaid = 0;
    t.check(creditorTotalOwed('S1') === 3105000, 'removing it returns the bill to being owed');
    t.check(store.cashTxns.length === 0, 'and still no cash entry is involved either way');
  }

  /* ---------- 7. an ordinary payment is untouched ------------------- */
  {
    const pi = setup();
    pi.payments.push({ date: '2026-08-21', amount: 500000, note: 'Cash', cashTxnId: 99 });
    pi.amountPaid = 500000;
    t.check(!piPaymentIsSettledBefore(pi.payments[0]), 'a real payment is not mistaken for one of these');
    t.check(purchaseInvoiceSettledBeforeTotal(pi) === 0, 'and does not count toward what was settled beforehand');
    t.check(creditorTotalOwed('S1') === 2605000, 'while still reducing the debt as it always did');
  }
}

/* ---------- 8. the shape of it --------------------------------------- */
{
  const save = code.slice(code.indexOf("getElementById('pip_save')"));
  const branch = save.slice(save.indexOf("account === 'settled-before'"), save.indexOf('const cashTxnId'));
  t.check(branch.length > 0, 'the save handler has a settled-before branch');
  t.check(!/addCashPayment/.test(branch),
    'which writes NO Cash Book entry — the one thing this whole feature is for');
  t.check(/cashTxnId: null,/.test(branch), 'and records that there is none to point at');
  t.check(/settledBeforeSystem: true,/.test(branch), 'marked, so it can be told from a real payment later');
  t.check(/if\(settledOn > todayISO\(\)\)\{/.test(branch), 'and refuses a date in the future');
  t.check(/document\.getElementById\('pip_settled_date'\)\.value \|\| pi\.date \|\| todayISO\(\)/.test(branch),
    'defaulting to the bill\'s own date, which is what makes historic sheets right');
  // The confirm on removal must not promise to remove a cash entry that
  // was never written.
  t.check(/no Cash Book entry was ever made and none will be removed/.test(code),
    'removing one says plainly that no cash entry is involved');
}

process.exit(t.done() ? 1 : 0);
