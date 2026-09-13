#!/usr/bin/env node
'use strict';
/*
 * A bill that says "settled" with nothing behind it in the cash book.
 *
 * Reported from a real book: PINV-0262 for ABC, 210,000, one payment,
 * settled — and no corresponding entry in the Cash Book. Both halves of
 * the shop's money disagreed about a payment that had certainly been
 * recorded, and the only way anybody would find out is by adding up a
 * month by hand.
 *
 * The link between the two ran ONE WAY. Recording a payment against a
 * document — a supplier's bill, a customer's invoice, a wage, a rent —
 * writes a Cash Book entry and keeps its id, so reversing the payment
 * can take the entry with it. The Cash Book knew nothing about what was
 * leaning on its rows: deleteCashTxn() checked for the other leg of a
 * transfer, and for nothing else. Delete the entry from the Cash Book
 * screen and the bill went on saying it was paid, pointing at a row
 * that no longer existed.
 *
 * Three things are checked here, and each is one half of the fault:
 *
 *   1. A cash entry a document is standing on cannot be deleted from
 *      the Cash Book. Not a warning to click through: the reversal
 *      lives on the document, it removes BOTH sides, and deleting from
 *      this side can only ever half-do it.
 *   2. An entry nothing leans on still deletes, because a guard that
 *      stops ordinary work is a guard somebody routes around.
 *   3. The books that are ALREADY broken this way are found and named,
 *      on the screen whose job is to say which bills are wrong.
 *
 * And the one case that is not a fault is kept out of it: "already
 * settled — before this system" deliberately writes no entry, because
 * no cash moves today. Its payment carries a flag and a null id, and it
 * must never be reported as a break — it is reported on the bill
 * itself, so that "settled" cannot read as money out of the till.
 *
 * Run: node test/orphaned-payments.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('orphaned payments');
const src = read('index.html');

/* ---------- 1. the guard on the Cash Book side ----------------------- */
{
  const NAMES = ['cashTxnDependents', 'deleteCashTxn'];
  const store = { cashTxns: [], purchaseInvoices: [], savedQuotes: [], dues: [] };
  const said = [];
  let fns = null, err = null;
  try {
    fns = compileScope(NAMES.map((n) => extractFunction(src, n, 'index.html')), {
      data: store,
      fmtUGX: (n) => `${Number(n).toLocaleString('en-UG')} UGX`,
      purchaseInvoiceNumberLabel: (pi) => 'PINV-' + String(pi.id).padStart(4, '0'),
      invoiceNumberLabel: (q) => 'INV-' + String(q.id).padStart(4, '0'),
      dueName: (d) => d.name || 'a wage',
      periodLabel: (p) => String(p || ''),
      accountLabel: (a) => String(a || 'cash'),
      toast: (m) => said.push(String(m)),
      confirm: () => true,
      saveData: () => {},
      renderCbTransactions: () => {}, renderCbSummary: () => {}, renderCbTriggers: () => {},
      document: { getElementById: () => null },
    }, NAMES);
  } catch (e) { err = e; }
  t.check(!!fns, `the guard compiles${err ? ` (${err.message})` : ''}`);

  if (fns) {
    const { cashTxnDependents, deleteCashTxn } = fns;

    store.cashTxns = [{ id: 11, amount: 210000, account: 'cash' }, { id: 12, amount: 5000, account: 'cash' }];
    store.purchaseInvoices = [{ id: 262, supplierName: 'ABC',
      payments: [{ amount: 210000, cashTxnId: 11 }] }];

    const held = cashTxnDependents([11]);
    t.check(held.length === 1 && /PINV-0262/.test(held[0].what) && held[0].where === 'Invoices, under Purchases',
      'the entry knows which bill is standing on it');
    t.check(cashTxnDependents([12]).length === 0, 'and an entry nothing leans on knows that too');

    said.length = 0;
    deleteCashTxn(11);
    t.check(store.cashTxns.some((x) => x.id === 11),
      'deleting it from the Cash Book is REFUSED — the bill would be left saying it was paid');
    t.check(said.some((m) => /PINV-0262/.test(m) && /210,000/.test(m)),
      'and the refusal names the bill and the figure rather than saying "cannot delete"');
    t.check(said.some((m) => /Reverse the payment on Invoices, under Purchases/.test(m)),
      'and names the one place that can undo it properly, which removes both sides');

    deleteCashTxn(12);
    t.check(!store.cashTxns.some((x) => x.id === 12),
      'an entry nothing is standing on still deletes — a guard that blocks ordinary work gets routed around');

    /* The customer side and the payroll side carry the same link and had
       the same hole; a fix to one only would leave the books
       inconsistent about which documents can be orphaned. */
    store.cashTxns = [{ id: 21, amount: 90000 }, { id: 22, amount: 40000 }];
    store.purchaseInvoices = [];
    store.savedQuotes = [{ id: 307, client: { name: 'Joan JEZONA' }, payments: [{ amount: 90000, cashTxnId: 21 }] }];
    store.dues = [{ id: 5, name: 'Musa Kato', period: '2026-08', payments: [{ amount: 40000, cashTxnId: 22 }] }];
    t.check(/INV-0307/.test((cashTxnDependents([21])[0] || {}).what || ''),
      "a customer invoice's payment holds its entry too");
    t.check(/Musa Kato/.test((cashTxnDependents([22])[0] || {}).what || ''),
      'and so does a wage');

    /* A settled-before payment never made an entry, so it holds none —
       and must not make some unrelated row undeletable. */
    store.savedQuotes = []; store.dues = [];
    store.purchaseInvoices = [{ id: 263, supplierName: 'Bwaise',
      payments: [{ amount: 257500, cashTxnId: null, settledBeforeSystem: true }] }];
    t.check(cashTxnDependents([21, 22, null, undefined]).length === 0,
      'a payment that never made an entry holds nothing, and a null id matches no row');
  }
}

/* ---------- 2. the books already broken are found -------------------- */
{
  const NAMES = ['purchaseInvoiceOrphanPayments', 'purchaseInvoiceNoCashPaid', 'piPaymentIsSettledBefore'];
  const store = { cashTxns: [{ id: 11 }] };
  let fns = null, err = null;
  try {
    fns = compileScope(NAMES.map((n) => extractFunction(src, n, 'index.html')),
      { data: store, SETTLED_BEFORE_NOTE: 'Settled before this system — no cash moved' }, NAMES);
  } catch (e) { err = e; }
  t.check(!!fns, `the detector compiles${err ? ` (${err.message})` : ''}`);

  if (fns) {
    const { purchaseInvoiceOrphanPayments, purchaseInvoiceNoCashPaid } = fns;
    const bill = (payments, over) => Object.assign({ id: 1, payments }, over);

    t.check(purchaseInvoiceOrphanPayments(bill([{ amount: 210000, cashTxnId: 99 }])).length === 1,
      'a payment pointing at an entry that is gone is found');
    t.check(purchaseInvoiceOrphanPayments(bill([{ amount: 210000, cashTxnId: 11 }])).length === 0,
      'and one whose entry is still there is not');

    /* THE DECLARED CASE IS NOT A FAULT. It writes no entry on purpose,
       because no cash moves today: paying off stock the shop bought
       before it began recording would spend money it still has. */
    const settled = bill([{ amount: 257500, cashTxnId: null, settledBeforeSystem: true }]);
    t.check(purchaseInvoiceOrphanPayments(settled).length === 0,
      'settled-before-this-system is declared, not broken, and is never reported as a break');
    t.check(purchaseInvoiceNoCashPaid(settled) === 257500,
      'but the bill can say how much of it moved no cash, so "settled" never reads as money out of the till');
    t.check(purchaseInvoiceNoCashPaid(bill([{ amount: 210000, cashTxnId: 11 }])) === 0,
      'and an ordinary payment reports none');

    /* Not asked about: recorded before the id was kept. A finding
       nobody can check is worse than no finding. */
    t.check(purchaseInvoiceOrphanPayments(bill([{ amount: 5000 }])).length === 0,
      'a payment from before the id was kept is not accused of anything');

    t.check(purchaseInvoiceOrphanPayments(bill([{ amount: 210000, cashTxnId: 99 }], { voided: true })).length === 0,
      'and a voided bill is not asked, since it owes nothing and counts towards nothing');
  }
}

/* ---------- 3. the screen says which of the two it is ---------------- */
{
  const body = extractFunction(src, 'piOpenBodyHTML', 'index.html');
  t.check(/the cash book has no entry behind it/.test(body),
    'an orphaned payment is named on the bill, in words, not left as a bare "settled"');
  t.check(/settled before this system/.test(body) && /no cash moved/.test(body),
    'and the declared case is told apart from it rather than sharing one wording');
  const row = extractFunction(src, 'piRowHTML', 'index.html');
  t.check(/settled — no cash moved/.test(row),
    "the row says it too, because the list is where a book is read and 'settled' alone is the ambiguity");
}

process.exit(t.done() ? 1 : 0);
