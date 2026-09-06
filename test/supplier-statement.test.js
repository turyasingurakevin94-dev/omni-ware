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

  /* Cut at BOTH ends. An invoice dated after the period must not appear
     on a statement that says it covers up to a given day -- a statement
     of account is a document about a span, and one carrying next
     month's invoice is wrong in a way the reader cannot see. */
  supplier([
    inv(50, '2026-03-01', 100000),
    inv(51, '2026-09-01', 900000, { payments: [paid('2026-09-05', 400000)], amountPaid: 400000 }),
  ]);
  const cut = scope.supplierStatementRows('S1', '2026-01-01', '2026-06-30');
  eq(cut.rows.length, 1, 'an invoice dated after the period is left out');
  eq(cut.charged, 100000, 'so it adds nothing to the charges');
  eq(cut.paid, 0, 'and neither does a payment made after the period');
  eq(cut.closing, 100000, 'leaving the balance as it stood at the end of the period');
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

  /* Supplied in REVERSE, which is the only arrangement that tells the
     tiebreak apart from doing nothing. Sorting by date alone is stable,
     and the charge is pushed before its payment, so array order already
     produces the right answer whenever the array happens to be in
     document order. It is not always: data.purchaseInvoices arrives in
     whatever order the server returned. Ordered by invoice id, two
     same-day invoices read PINV-0020 then PINV-0021 on the sheet
     whichever way round they were stored. */
  supplier([
    inv(21, '2026-06-01', 200000, { payments: [paid('2026-06-01', 50000)], amountPaid: 50000 }),
    inv(20, '2026-06-01', 100000, { payments: [paid('2026-06-01', 40000)], amountPaid: 40000 }),
  ]);
  const rev = scope.supplierStatementRows('S1', '2026-01-01', '2026-12-31');
  eq(rev.rows.map((r) => `${r.ref}:${r.type}`).join(' '),
    'PINV-0020:charge PINV-0020:payment PINV-0021:charge PINV-0021:payment',
    'and stored out of order they still read in document order, not in the order the server sent them');
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
  t.check(/pi\.payments\.push\(\{date: paidOn, amount, note, cashTxnId\}\);/.test(code),
    'paying one invoice writes there');
  t.check(/pi\.payments\.push\(\{date: paidOn, amount: pay, note, cashTxnId\}\);/.test(code),
    'and so does a lump sum spread across the oldest first');
  /* Both now carry the day the money actually moved rather than the day
     somebody typed it, which is what lets a statement asked about a past
     date show what was really outstanding then. */
  t.check(!/pi\.payments\.push\(\{date: todayISO\(\)/.test(code),
    'and neither stamps today regardless of when the payment was made');

  /* ONE supplier's invoices, not the shop's. Every other test here has a
     single supplier on file, which cannot tell a working filter from a
     missing one -- and a statement carrying another supplier's invoices
     is the worst kind of wrong on a document you hand over. */
  data.suppliers = [{ id: 'S1', name: 'Roto Industry' }, { id: 'S2', name: 'Karddia' }];
  data.purchaseInvoices = [
    inv(60, '2026-06-01', 100000, { supplierId: 'S1' }),
    inv(61, '2026-06-02', 999999, { supplierId: 'S2',
      payments: [paid('2026-06-03', 500000)], amountPaid: 500000 }),
  ];
  const mine = scope.supplierStatementRows('S1', '2026-01-01', '2026-12-31');
  eq(mine.rows.length, 1, 'only this supplier’s invoices are listed');
  eq(mine.charged, 100000, 'another supplier’s charge is not counted');
  eq(mine.paid, 0, 'nor their payment');
  eq(mine.closing, 100000, 'leaving a balance that is theirs alone');
  eq(scope.supplierStatementRows('S2', '2026-01-01', '2026-12-31').closing, 499999,
    'and the other supplier gets their own, separately');

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
  /* supplierStatsHTML is gone with the modal that held it. What drew
     the statement was one line inside it; that line is now
     supplierStatementBlockHTML, called by the supplier account screen,
     and it is what the shared-layout guarantee attaches to. */
  const panel = extractFunction(src, 'supplierStatementBlockHTML', 'index.html');
  const print = extractFunction(src, 'printSupplierStatement', 'index.html');

  t.check(/statementLedgerHTML\(supplierStatementRows\(supplierId, from, to\)/.test(panel),
    'the account renders through the shared ledger');
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
     trust the button.

     The gate moved with the screen: it used to sit on a.invoiceCount
     inside the modal builder, and now sits on r.everInvoiced in the
     account, which is the same reading of the same purchase invoices. */
  const acct = extractFunction(src, 'renderSupplierAccount', 'index.html');
  t.check(/\$\{r\.everInvoiced \? `<button type="button" class="btn btn-ghost ow-sm" data-sact="print"/.test(acct),
    'the print button is withheld from a supplier with no purchase invoice');
  t.check(/const ask = r\.ask\.length\s*\n?\s*\? `<button/.test(acct),
    'while asking for a price is offered on its own terms, which a supplier with no invoice can very much have');
  t.check(/No purchase invoice has been raised with them yet/.test(acct),
    'and the account says why in words instead of showing an empty ledger');
  t.check(/the statement fills in once the first order to them is billed/.test(acct),
    'naming what would make one appear');
}

/* ---------- 8. reached the same way a customer is --------------------- */
{
  /* The supplier grid became a register on the .ow- layer, and the
     dialog it opened became a screen. What is checked is unchanged: a
     row opens that supplier's account, it is reachable by keyboard as
     well as by pointer, a control inside it does only its own job, and
     the listener is bound once on the wrapper because the register is
     rebuilt on every search keystroke. */
  const wiring = (/\(function wireSupplierRegister\(\)[\s\S]*?\n\}\)\(\);/.exec(src) || [''])[0];
  t.check(wiring.length > 0, 'the buying book opens an account');
  t.check(/if\(name === 'open'\) return openSupplierAccount\(id\);/.test(wiring),
    'from the row that was clicked');
  /* Scoped to the SUPPLIER row's own markup. Tested against the whole
     file, `role="button" tabindex="0"` is satisfied by the customer
     row, and stripping it off the supplier row would pass unnoticed --
     which is exactly what happened the first time this was written. */
  const row = extractFunction(src, 'supplierRegisterRowHTML', 'index.html');
  t.check(/data-sopen="\$\{esc\(r\.id\)\}"/.test(row), 'the row carries the id');
  t.check(/role="button" tabindex="0"/.test(row),
    'and is reachable by keyboard, not only by pointer');
  t.check(/title="See the account for \$\{esc\(r\.name\)\}"/.test(row),
    'and says what clicking it does, since a row that opens something must look like it opens something');
  t.check(/e\.target\.closest\('a, button'\)/.test(wiring),
    'a click on an action inside the row does only its own job');
  t.check(/e\.key !== 'Enter' && e\.key !== ' '/.test(wiring), 'and it opens on Enter or Space');
  t.check(/e\.preventDefault\(\)/.test(wiring), 'with Space stopped from scrolling the page instead');
  // Delegated: the register is rebuilt on every search keystroke.
  t.check(/wrap\.addEventListener/.test(wiring) && !/row\.addEventListener/.test(wiring),
    'bound once on the wrapper, so re-rendering the register does not stack listeners');
  /* The account is a VIEW of this screen, not a dialog over it. A modal
     could not be printed from, could not be read beside anything else,
     and trapped the keyboard behind whatever was opened next. */
  t.check(!/id="supplierStatsModal"/.test(src),
    'and the dialog it replaced is gone from the file, not merely unused');
  t.check(/if\(name === 'book'\)\{ supViewId = null;/.test(wiring),
    'with a way back to the book rather than an X in a corner');
}

/* ---------- 9. the strip above the register --------------------------- */
{
  const render = extractFunction(src, 'renderSuppliers', 'index.html');
  const row = extractFunction(src, 'supplierBookRow', 'index.html');

  /* WHAT THE STRIP ASKS CHANGED, and that is the point of the
     conversion. It used to be "total suppliers / total you owe /
     suppliers with a balance" -- three tiles of which two were
     Creditors' headline figure restated on a screen that cannot act on
     it, one of them painted crimson on ordinary trade credit. The four
     here are the buying book's own health: how many suppliers can
     actually be bought from, how many priced lines have a second quote,
     what has been spent, and how many prices are past their own age.
     Not one of them is Creditors'. */
  t.check(/You can buy from/.test(render) && /Lines with a choice/.test(render)
    && /Spent in 90 days/.test(render) && /Prices to confirm/.test(render),
    'the four figures are named for what they count');
  t.check(!/Total suppliers/.test(render) && !/Total you owe/.test(render),
    'and none of them restates the figure Creditors exists to give');

  /* What is owed is still shown -- it is one column of the register,
     because it is what you check before paying a bill -- and it is
     still read from creditorTotalOwed rather than summed a second way,
     which is what stopped the old strip drifting from the list it
     summarised. */
  t.check(/creditorTotalOwed\(s\.id\)/.test(row),
    'what you owe is read from creditorTotalOwed, not summed a second way');
  t.check(!/purchaseInvoiceBalanceDue/.test(row),
    'so the register cannot drift from the creditors list beside it');
  t.check(/r\.owed > 0\.5/.test(extractFunction(src, 'supplierRegisterRowHTML', 'index.html')),
    'and a supplier counts as owing on the same 0.5 threshold the creditors list uses');

  /* The borrowed strip is gone from the FILE, not merely unused.
     Customers stopped drawing .dir-summary-row when it converted, and
     this was the last screen carrying it -- along with the rule that
     painted ordinary trade credit crimson. */
  t.check(!/\.dir-summary-row\{/.test(src) && !/\.dir-summary-card\{/.test(src),
    'the borrowed summary strip is gone from the file, and with it the crimson it put on trade credit');
  t.check(!/id="supSummaryRow"/.test(src),
    'and the suppliers page draws the layer’s strip instead');
}

process.exit(t.done() ? 1 : 0);
