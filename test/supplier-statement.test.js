#!/usr/bin/env node
'use strict';
/*
 * The supplier's account -- what you owe them, and why.
 *
 * The same document as the customer statement with the arrows reversed,
 * and deliberately NOT a second implementation of it: the ledger table
 * and the printed sheet are shared, and only the words that genuinely
 * flip are passed in.
 *
 * BUILT FROM THE PURCHASE INVOICES, because that is where this side's
 * money lives. A customer carries a c.debt field with a debtLog beside
 * it. A supplier carries neither -- what you owe them is derived from
 * their unvoided purchase invoices, which is what creditorTotalOwed
 * reads and what the creditors list pays down. So the invoices are the
 * single source here exactly as the log is there, and reading the cash
 * book as well would count every payment twice.
 *
 * The decisions pinned below:
 *
 *   one source        pi.payments catches every payment. Both paths
 *                     write there: one invoice at a time, and a lump sum
 *                     spread across the oldest first.
 *   voided is gone    the invoice AND its payments, never gathered
 *                     rather than filtered afterwards -- otherwise a
 *                     voided invoice leaves a payment floating against a
 *                     charge that no longer exists.
 *   the clamp         creditorTotalOwed floors each invoice at zero, so
 *                     an overpaid one contributes nothing there while
 *                     the history carries it as a credit. The two can
 *                     legitimately disagree, and the sheet says so
 *                     rather than picking one.
 *
 * Run: node test/supplier-statement.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('supplier statement');
const src = read('index.html');
const code = src.split(/\r?\n/).map((l) => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');
const data = { suppliers: [], purchaseInvoices: [] };

const NAMES = ['supplierStatementRows', 'purchaseInvoiceTotal', 'purchaseInvoiceBalanceDue',
  'creditorTotalOwed', 'purchaseInvoiceNumberLabel', 'creditorOutstandingInvoices'];
const scope = compileScope(NAMES.map((n) => extractFunction(src, n, 'index.html')), { data }, NAMES);

const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);
const inv = (id, date, amount, over) => Object.assign({
  id, supplierId: 'S1', date, voided: false, payments: [], amountPaid: 0,
  items: [{ qty: 1, price: amount }],
}, over || {});
const supplier = (invoices) => {
  data.suppliers = [{ id: 'S1', name: 'Roto Industry', location: 'Industrial Area', phone: '0700000000' }];
  data.purchaseInvoices = invoices;
};
const paid = (date, amount, note) => ({ date, amount, note: note || '', cashTxnId: null });

/* ---------- 1. charges, payments, and the balance between ------------ */
{
  supplier([
    inv(88, '2026-03-10', 6615000, { payments: [paid('2026-03-20', 1000000, 'Cash')], amountPaid: 1000000 }),
    inv(89, '2026-05-02', 170000),
  ]);
  const st = scope.supplierStatementRows('S1', '2026-01-01', '2026-08-15');

  eq(st.rows.length, 3, 'each invoice is a charge and each payment a line of its own');
  eq(st.rows[0].charge, 6615000, 'an invoice is charged at its total');
  eq(st.rows[0].payment, 0, 'and is not also a payment');
  eq(st.rows[1].payment, 1000000, 'a payment against it shows in the paid column');
  eq(st.rows[1].charge, 0, 'and not in the charged one');
  t.check(st.rows.map((r) => r.balance).join(',') === '6615000,5615000,5785000',
    `the balance runs down the page (${st.rows.map((r) => r.balance).join(' -> ')})`);
  eq(st.charged, 6785000, 'charges are totalled');
  eq(st.paid, 1000000, 'and so are payments');
  eq(st.closing, 5785000, 'leaving what you owe them');

  // The document number, so a line can be traced to the paper it came from.
  eq(st.rows[0].ref, 'PINV-0088', 'a charge names its invoice');
  eq(st.rows[1].ref, 'PINV-0088', 'and so does the payment against it');
}

/* ---------- 2. the period -------------------------------------------- */
{
  const st = scope.supplierStatementRows('S1', '2026-04-01', '2026-08-15');
  eq(st.opening, 5615000, 'everything earlier collapses into one carried figure');
  eq(st.rows.length, 1, 'and only what falls inside the period is listed');
  eq(st.closing, 5785000, 'reaching the same closing figure as the longer period');

  const all = scope.supplierStatementRows('S1', '0000-01-01', '2026-08-15');
  eq(all.opening, 0, 'over all time there is nothing brought forward');
  eq(all.rows.length, 3, 'and every entry is listed');
}

/* ---------- 3. a payment never prints above the charge it settles ----
   Both on the same day, so the date cannot order them. Supplied with
   the payment written first, so a stable sort alone would put it above
   the invoice and show a negative balance mid-page for money that had
   not yet been charged. */
{
  supplier([inv(12, '2026-06-01', 300000, {
    payments: [paid('2026-06-01', 100000, 'Cash')], amountPaid: 100000,
  })]);
  const st = scope.supplierStatementRows('S1', '2026-01-01', '2026-12-31');
  eq(st.rows[0].type, 'charge', 'the invoice comes first');
  eq(st.rows[0].balance, 300000, 'so the balance rises before it falls');
  eq(st.rows[1].balance, 200000, 'and lands on what is owed');
  t.check(st.rows.every((r) => r.balance >= 0), 'with no negative balance invented on the way');

  /* Two invoices on one day, each with a payment, must not interleave --
     a payment belongs under ITS invoice, not under whichever charge
     happened to sort first. */
  supplier([
    inv(20, '2026-06-01', 100000, { payments: [paid('2026-06-01', 40000)], amountPaid: 40000 }),
    inv(21, '2026-06-01', 200000, { payments: [paid('2026-06-01', 50000)], amountPaid: 50000 }),
  ]);
  const pair = scope.supplierStatementRows('S1', '2026-01-01', '2026-12-31');
  eq(pair.rows.map((r) => `${r.ref}:${r.type}`).join(' '),
    'PINV-0020:charge PINV-0020:payment PINV-0021:charge PINV-0021:payment',
    'each invoice is followed by its own payment');
}

/* ---------- 4. a voided invoice takes its payments with it ------------ */
{
  supplier([
    inv(30, '2026-06-01', 500000),
    inv(31, '2026-06-02', 800000, { voided: true, payments: [paid('2026-06-03', 300000)], amountPaid: 300000 }),
  ]);
  const st = scope.supplierStatementRows('S1', '2026-01-01', '2026-12-31');
  eq(st.rows.length, 1, 'the voided invoice is not listed');
  eq(st.charged, 500000, 'its charge is not counted');
  eq(st.paid, 0,
    'and NEITHER IS ITS PAYMENT — a payment surviving its voided invoice would credit the supplier against a charge that no longer exists');
  eq(st.closing, 500000, 'leaving only the live invoice');
  eq(st.closing, Math.round(scope.creditorTotalOwed('S1')),
    'which is exactly what the creditors list carries, because both filter voided the same way');
}

/* ---------- 5. measured against what the shop will actually pay ------- */
{
  supplier([inv(40, '2026-06-01', 500000, { payments: [paid('2026-06-10', 200000)], amountPaid: 200000 })]);
  const st = scope.supplierStatementRows('S1', '2026-01-01', '2026-12-31');
  eq(st.recorded, 300000, 'the recorded balance is the open-invoice total');
  t.check(st.agrees, 'and an ordinary account agrees with it');

  /* THE CLAMP. purchaseInvoiceBalanceDue floors at zero, so an overpaid
     invoice contributes nothing to creditorTotalOwed while the running
     history carries the overpayment as a credit. Neither is wrong; the
     gap is money the shop has handed a supplier and not noticed. */
  supplier([inv(41, '2026-06-01', 500000, { payments: [paid('2026-06-10', 600000)], amountPaid: 600000 })]);
  const over = scope.supplierStatementRows('S1', '2026-01-01', '2026-12-31');
  eq(over.closing, -100000, 'the history shows the overpayment as a credit');
  eq(over.recorded, 0, 'while the open-invoice total floors at zero');
  t.check(!over.agrees, 'so the two are reported as out of step rather than quietly reconciled');
}

/* ---------- 6. one source, not two ------------------------------------ */
{
  const fn = (/function supplierStatementRows[\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(/data\.purchaseInvoices/.test(fn), 'the statement reads the purchase invoices');
  t.check(/pi\.payments/.test(fn), 'and the payments recorded on them');
  t.check(!/cashTxns/.test(fn),
    'and NOT the cash book as well — every supplier payment already writes a pi.payments entry, so reading both would credit each one twice');
  t.check(!/debtLog/.test(fn),
    'nor the customer debt log, which is the other side of the shop entirely');

  /* Both writers land in pi.payments. If either stopped, this statement
     would silently miss payments the creditors list had already taken
     off the balance. */
  t.check(/pi\.payments\.push\(\{date: todayISO\(\), amount, note, cashTxnId\}\);/.test(code),
    'paying one invoice writes there');
  t.check(/pi\.payments\.push\(\{date: todayISO\(\), amount: pay, note, cashTxnId\}\);/.test(code),
    'and so does a lump sum spread across the oldest first');

  // Unknown supplier: an empty statement, not a throw.
  data.suppliers = []; data.purchaseInvoices = [];
  const gone = scope.supplierStatementRows('NOBODY', '2026-01-01', '2026-12-31');
  t.check(gone.supplier === null && gone.rows.length === 0 && gone.closing === 0,
    'an unknown supplier gives an empty statement rather than throwing');
}

/* ---------- 7. the shared document ------------------------------------
   The LAYOUT is shared and the SENTENCES are not. Which columns exist
   and where the opening balance sits must be identical on both
   statements, or the shop hands out two documents that look like one
   another and are not. The prose genuinely differs: a customer is told
   what they owe you, and read the other way round that sentence is
   false. */
{
  const panel = extractFunction(src, 'supplierStatsHTML', 'index.html');
  const print = extractFunction(src, 'printSupplierStatement', 'index.html');

  t.check(/statementLedgerHTML\(supplierStatementRows\(s\.id, from, to\)/.test(panel),
    'the panel renders through the shared ledger');
  t.check(/printStatementSheet\(st, \{/.test(print), 'and the print through the shared sheet');
  t.check(/supplierStatementRows\(supplierId, from, to\)/.test(print),
    'both off the same builder, so the sheet cannot disagree with the screen');
  t.check(/customerStatementRange\(\)/.test(print) && /customerStatementRange\(\)/.test(panel),
    'over the same six-month window as the customer statement');

  // The one word that flips.
  t.check(/payWord: 'Payment made'/.test(panel) && /payWord: 'Payment made'/.test(print),
    'money leaving the shop is not "received" — on screen and on paper alike');
  t.check(/owesLine: \(m\)=> `\$\{esc\(printedShopName\(\)\)\} owes/.test(print),
    'and the closing sentence says the shop owes them, not the reverse');
  t.check(/creditLine: \(m\)=> `The account is <b>\$\{m\}<\/b> overpaid/.test(print),
    'with an overpaid account named as overpaid rather than "in credit", which reads as their credit');

  /* No invoice, no statement. The sheet would carry a brought-forward
     zero and "the account is settled" -- a true document about nothing,
     and a button that hands somebody a blank page teaches them not to
     trust the button. */
  const open = extractFunction(src, 'openSupplierStats', 'index.html');
  t.check(/\(s && a\.invoiceCount\) \?/.test(open),
    'the print button is withheld from a supplier with no purchase invoice');
  t.check(/if\(!a\.invoiceCount\)\{/.test(panel) && /have not raised a purchase invoice/.test(panel),
    'and the panel says why in words instead of showing an empty table');
  t.check(/Their prices are\s*\n?\s*on the card behind this/.test(panel),
    'pointing at what that supplier DOES have on file, since a priced supplier is not an empty one');
}

/* ---------- 8. reached the same way a customer is --------------------- */
{
  const wiring = (/\(function wireSupplierCards\(\)[\s\S]*?\n\}\)\(\);/.exec(src) || [''])[0];
  t.check(wiring.length > 0, 'the supplier grid opens an account');
  t.check(/openSupplierStats\(card\.dataset\.supplier\)/.test(wiring), 'from the card that was clicked');
  t.check(/data-supplier="\$\{esc\(s\.id\)\}"/.test(src) && /role="button" tabindex="0"/.test(src),
    'the card carries the id and is reachable by keyboard, not only by pointer');
  t.check(/e\.target\.closest\('button'\)/.test(wiring),
    'a click on commission, edit or delete does only its own job');
  t.check(/e\.key !== 'Enter' && e\.key !== ' '/.test(wiring), 'and it opens on Enter or Space');
  t.check(/e\.preventDefault\(\)/.test(wiring), 'with Space stopped from scrolling the page instead');
  // Delegated: the grid is rebuilt on every search keystroke.
  t.check(/wrap\.addEventListener/.test(wiring) && !/card\.addEventListener/.test(wiring),
    'bound once on the wrapper, so re-rendering the grid does not stack listeners');
}

/* ---------- 9. the strip above the grid ------------------------------- */
{
  const sum = extractFunction(src, 'renderSupplierSummary', 'index.html');
  t.check(/creditorTotalOwed\(s\.id\)/.test(sum),
    'what you owe is read from creditorTotalOwed, not summed a second way');
  t.check(!/purchaseInvoiceBalanceDue/.test(sum),
    'so the strip cannot drift from the creditors list it summarises');
  t.check(/v > 0\.5/.test(sum),
    'and it counts a supplier as owing on the same 0.5 threshold the creditors list uses');
  t.check(/Total suppliers/.test(sum) && /Total you owe/.test(sum) && /Suppliers with a balance/.test(sum),
    'the three figures are the customers page’s three, asked of the other side');
  t.check(/renderSupplierSummary\(\);/.test(extractFunction(src, 'renderSuppliers', 'index.html')),
    'and it is rebuilt with the grid');

  /* Named for what it is, not for the first screen that had one: both
     directories carry this strip now. */
  t.check(/\.dir-summary-row\{/.test(src) && !/cust-summary/.test(src),
    'the strip’s classes are shared rather than prefixed for one of the two pages');
  t.check(/id="supSummaryRow"/.test(src) && /id="custSummaryRow"/.test(src),
    'with a row on each page');
}

process.exit(t.done() ? 1 : 0);
