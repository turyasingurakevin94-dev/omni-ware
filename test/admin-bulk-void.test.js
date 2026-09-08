#!/usr/bin/env node
'use strict';
/*
 * Voiding two invoices at once did less than voiding them one at a time.
 *
 * Voiding is never just a flag. invoiceDebtDesired() returns 0 for a voided
 * invoice, so the customer's debt has to be re-synced or they go on owing
 * for a sale that has been cancelled.
 *
 * The single toggle did that. The bulk Void / Unvoid actions in the
 * Invoices dropdown did:
 *
 *     quotes.forEach(q=>q.voided = true);
 *     saveData();
 *     renderInvoices(...);
 *
 * -- the flag, and nothing else. Two invoices totalling 8,000, voided
 * together, left the customer owing 8,000 for both. Voided one at a time
 * they cleared correctly. Unvoid had the mirror fault: the invoices came
 * back live and nothing re-charged them. Neither redrew the Customers or
 * Debtors screens, so the stale figure stayed on display as well.
 *
 * All three paths go through one function now.
 *
 * Run: node test/admin-bulk-void.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('admin bulk void');
const src = read('index.html');
const code = src.split(/\r?\n/).map(l => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');

const store = { customers: [], savedQuotes: [], products: [] };
let nextId = 1, rendered = [];
const env = {
  data: store,
  allocRowId: () => nextId++,
  todayISO: () => '2026-08-02',
  invoiceNumberLabel: (q) => `INV-${String(q.id).padStart(4, '0')}`,
  generateCustomerId: () => 'C' + (nextId++),
  quoteSuggestedPrice: () => null, quoteSuggestedStockPrice: () => null,
  saveData: () => {},
  renderInvoices: () => rendered.push('invoices'),
  renderCustomers: () => rendered.push('customers'),
  renderDebtorsList: () => rendered.push('debtors'),
  document: { getElementById: () => ({ value: '' }) },
  /* These scenarios are about the DEBT arithmetic of voiding rather
     than about the asking, so they run with nothing to answer. The ask
     has its own scenario at the end of the file. */
  voidInvoicesWarning: () => warning,
  confirm: () => confirmAnswer,
};
let warning = null;
let confirmAnswer = true;
const NAMES = [
  'savedQuoteTotal', 'quoteItemSellPrice', 'invoiceBalanceDue', 'invoiceDebtDesired',
  'resolveInvoiceCustomer', 'applyInvoiceDebtCharge', 'syncInvoiceDebtCharge',
  'customerLedgerTotal', 'customerDebtDrift', 'setInvoicesVoided',
];
let fns = null, err = null;
try { fns = compileScope(NAMES.map(n => extractFunction(src, n, 'index.html')), env, NAMES); }
catch (e) { err = e; }
t.check(!!fns, `setInvoicesVoided compiles${err ? ` (${err.message})` : ''}`);

if (fns) {
  const { setInvoicesVoided, syncInvoiceDebtCharge, customerDebtDrift } = fns;

  const setup = () => {
    store.customers = [{ id: 'C1', name: 'Nakato', debt: 0, debtLog: [] }];
    const mk = (id, price) => ({
      id, client: { name: 'Nakato' }, date: '2026-08-02', customerId: 'C1',
      items: [{ id: id * 10, productId: 'P1', variantIdx: null, qty: 1, sellPrice: price, supplierId: 'S1' }],
      status: 'completed', invoiced: true, invoicedAt: '2026-08-02',
      amountPaid: 0, payments: [], voided: false, debtCharged: 0,
    });
    store.savedQuotes = [mk(1, 3000), mk(2, 5000)];
    store.savedQuotes.forEach(syncInvoiceDebtCharge);
    return store.customers[0];
  };
  const debt = () => Math.round(store.customers[0].debt);

  /* ---------- 1. voiding in bulk clears the debt ------------------- */
  {
    setup();
    t.check(debt() === 8000, 'two invoices charge 8,000 between them');
    setInvoicesVoided(store.savedQuotes, true);
    t.check(store.savedQuotes.every(q => q.voided), 'both are marked voided');
    t.check(debt() === 0, `and the customer stops owing for them (${debt()})`);
    t.check(customerDebtDrift(store.customers[0]) === 0, 'with the ledger agreeing');
  }

  /* ---------- 2. and unvoiding charges them back ------------------- */
  {
    setInvoicesVoided(store.savedQuotes, false);
    t.check(store.savedQuotes.every(q => !q.voided), 'both are live again');
    t.check(debt() === 8000, `so the debt is back (${debt()})`);
    t.check(customerDebtDrift(store.customers[0]) === 0, 'still agreeing');
  }

  /* ---------- 3. bulk and single reach the same place -------------- */
  /*
   * The property that was broken: the same end state, whichever route was
   * taken to it.
   */
  {
    setup();
    setInvoicesVoided([store.savedQuotes[0]], true);
    const viaBulk = debt();

    setup();
    store.savedQuotes[0].voided = true;
    syncInvoiceDebtCharge(store.savedQuotes[0]);
    const viaSingle = debt();

    t.check(viaBulk === viaSingle, `voiding one invoice costs the same either way (${viaBulk} vs ${viaSingle})`);
    t.check(viaBulk === 5000, 'leaving only the other invoice owed');
  }

  /* ---------- 4. the screens showing that balance are redrawn ------ */
  {
    setup();
    rendered = [];
    setInvoicesVoided(store.savedQuotes, true);
    t.check(rendered.includes('invoices'), 'the Invoices list is redrawn');
    t.check(rendered.includes('customers') && rendered.includes('debtors'),
      `and so are the two screens that show the balance (${rendered.join(', ')})`);
  }

  /* ---------- 5. an invoice with no customer does not throw -------- */
  {
    store.customers = [];
    store.savedQuotes = [{
      id: 3, client: { name: '' }, date: '2026-08-02', customerId: null,
      items: [{ id: 1, productId: 'P1', variantIdx: null, qty: 1, sellPrice: 1000, supplierId: 'S1' }],
      status: 'completed', invoiced: true, amountPaid: 0, payments: [], voided: false, debtCharged: 0,
    }];
    let threw = null;
    try { setInvoicesVoided(store.savedQuotes, true); } catch (e) { threw = e.message; }
    t.check(!threw, `an unnamed walk-in invoice voids without error${threw ? ` (${threw})` : ''}`);
    t.check(store.savedQuotes[0].voided === true, 'and is still marked voided');
  }
}

/* ---------- 6. all three callers go through it ---------------------- */
{
  /* The body now opens by asking, then does exactly what it always
     did. Both halves are pinned: the guard cannot be dropped, and the
     flag and the sync still cannot be separated. */
  t.check(/function setInvoicesVoided\(quotes, voided\)\{\s*\n\s*if\(voided\)\{\s*\n\s*const warning = voidInvoicesWarning\(quotes\);\s*\n\s*if\(warning && !confirm\(warning\)\) return false;\s*\n\s*\}\s*\n\s*quotes\.forEach\(q=>\{ q\.voided = voided; syncInvoiceDebtCharge\(q\); \}\);/.test(code),
    'it asks before voiding, then the flag and the sync happen together for every quote passed');
  t.check(/setInvoicesVoided\(\[q\], !q\.voided\)/.test(code), 'the single toggle uses it');
  t.check(/setInvoicesVoided\(quotes, true\)/.test(code), 'bulk void uses it');
  t.check(/setInvoicesVoided\(quotes, false\);/.test(code), 'bulk unvoid uses it');
  /* A caller must not announce something the shop declined. */
  t.check(/if\(!setInvoicesVoided\(\[q\], !q\.voided\)\) return;/.test(code),
    'the single toggle keeps quiet when the ask is refused');
  t.check(/if\(!setInvoicesVoided\(quotes, true\)\) return;/.test(code),
    'and so does bulk void');
  t.check(!/quotes\.forEach\(q=>q\.voided = (true|false)\);/.test(code),
    'and neither bulk action sets the flag on its own any more');
}

/* ---------- 7. saying no leaves everything exactly as it was --------- *
 * Voiding cancels a sale, and it is a small grey icon a thumb's width
 * from Undo invoice, which does something quite different. So it asks --
 * and a dialog is only worth having if refusing it really does nothing.
 * Checked on the debt as well as the flag, because the flag alone was
 * the original bulk-void bug in this very file.
 */
if (fns) {
  const { setInvoicesVoided, customerDebtDrift, syncInvoiceDebtCharge } = fns;
  /* The same two-invoice fixture the scenarios above use, built here
     because setup() is scoped to the block that owns them. */
  store.customers = [{ id: 'C1', name: 'Nakato', debt: 0, debtLog: [] }];
  store.savedQuotes = [3000, 5000].map((price, i) => ({
    id: i + 1, client: { name: 'Nakato' }, date: '2026-08-02', customerId: 'C1',
    items: [{ id: (i + 1) * 10, productId: 'P1', variantIdx: null, qty: 1, sellPrice: price, supplierId: 'S1' }],
    status: 'completed', invoiced: true, invoicedAt: '2026-08-02',
    amountPaid: 0, payments: [], voided: false, debtCharged: 0,
  }));
  store.savedQuotes.forEach(syncInvoiceDebtCharge);
  const debt = () => store.customers[0].debt;
  const before = debt();
  t.check(before === 8000, 'two invoices charge 8,000 between them to begin with');

  warning = 'Void these?';
  confirmAnswer = false;
  rendered = [];
  const went = setInvoicesVoided(store.savedQuotes, true);

  t.check(went === false, 'a refused void reports that it did not happen');
  t.check(store.savedQuotes.every(q => q.voided === false), 'no document is marked voided');
  t.check(debt() === before, `the customer still owes what they owed (${debt()})`);
  t.check(customerDebtDrift(store.customers[0]) === 0, 'and the ledger has not been written to');
  t.check(rendered.length === 0, 'nothing is redrawn, because nothing changed');

  /* And the ask is not in the way of the act: answering yes does what it
     always did. */
  confirmAnswer = true;
  t.check(setInvoicesVoided(store.savedQuotes, true) === true, 'saying yes goes ahead');
  t.check(debt() === 0, 'and the debt clears, exactly as before the dialog existed');

  /* Unvoiding is the way back from the question, so it is never asked
     about -- even with a warning available and the answer set to no. */
  confirmAnswer = false;
  t.check(setInvoicesVoided(store.savedQuotes, false) === true, 'unvoiding is not gated on the ask');
  t.check(debt() === 8000, 'and it restores the charge');
  warning = null;
  confirmAnswer = true;
}

process.exit(t.done() ? 1 : 0);
