#!/usr/bin/env node
'use strict';
/*
 * Purchase invoices and supplier payments -- the buy side of the money.
 *
 * Two lists claim to be the same numbers regrouped: the Purchase Invoices
 * tab shows a balance per invoice, and the Creditors list shows a total per
 * supplier built by summing those balances. That claim only holds while no
 * single invoice can report a NEGATIVE balance. One overpaid invoice would
 * otherwise subtract from what the supplier is still owed on their other
 * invoices -- and since a lump-sum payment is capped at that total, the
 * shop would underpay the supplier and be told it was square.
 *
 * The customer side already clamped (invoiceBalanceDue); the supplier side
 * did not. These checks pin both halves: the clamp itself, and the cap that
 * stops an overpayment being recorded in the first place.
 *
 * Run: node test/supplier-payables.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('supplier payables');
const adminSrc = read('index.html');

/* ---------- the scope under test -------------------------------------- */
const data = { suppliers: [], purchaseInvoices: [], savedQuotes: [], nextPurchaseInvoiceId: 1 };
const cash = { txns: [], nextId: 1 };

const env = {
  data,
  todayISO: () => '2026-08-02',
  fmtUGX: (n) => `UGX ${n}`,
  addCashPayment: (account, amount, category, description) => {
    const id = cash.nextId++;
    cash.txns.push({ id, account, amount, category, description, type: 'payment' });
    return id;
  },
  removeCashTxnsByIds: (ids) => {
    const set = new Set((ids || []).filter((id) => id !== undefined && id !== null));
    cash.txns = cash.txns.filter((x) => !set.has(x.id));
  },
  quoteItemSellPrice: (it) => Number(it.sellPrice) || 0,
  // Present so that a change which wrongly reaches for esc() in the
  // confirm-dialog text fails on the check that says so, rather than
  // throwing ReferenceError first and reporting nothing at all.
  esc: (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
  // PINV- numbers come from the database one at a time now (0034, see
  // row-id-allocation.test.js). Stubbed with its offline path -- the same
  // counter this used to increment directly -- and async, because that is
  // what makes the generators below async.
  issueRowId: async (name) => {
    if (name !== 'purchaseInvoice') throw new Error(`unexpected row id kind in this scope: ${name}`);
    const id = Number(data.nextPurchaseInvoiceId) || 1;
    data.nextPurchaseInvoiceId = id + 1;
    return id;
  },
};

const FNS = [
  'purchaseInvoiceNumberLabel', 'purchaseInvoiceTotal', 'purchaseInvoiceBalanceDue',
  'purchaseInvoicePaymentStatusLabel', 'supplierName',
  'creditorOutstandingInvoices', 'creditorTotalOwed',
  'allocateCreditorPayment', 'generatePurchaseInvoicesForQuote',
  'removePurchaseInvoicesForQuote', 'orderReversalParts', 'uninvoiceReversalWarning', 'deleteQuoteWarning',
  'savedQuoteTotal', 'invoiceBalanceDue',
];
const fn = compileScope(FNS.map((n) => extractFunction(adminSrc, n, 'index.html')), env, FNS);

const inv = (id, supplierId, total, paid, extra) => Object.assign({
  id, supplierId, supplierName: 'Supplier ' + supplierId, quoteId: null,
  date: '2026-07-0' + id, voided: false, amountPaid: paid,
  items: [{ productId: 'P1', qty: 1, price: total }], payments: [],
}, extra || {});
const seed = (...invoices) => { data.purchaseInvoices = invoices; };

/* ---------- 1. the invoice's own numbers ------------------------------ */
{
  const pi = inv(1, 'S1', 0, 0);
  pi.items = [{ qty: 4, price: 25000 }, { qty: 2, price: 10000 }];
  t.check(fn.purchaseInvoiceTotal(pi) === 120000,
    `the invoice total is qty x price summed across items (got ${fn.purchaseInvoiceTotal(pi)})`);
}
{
  t.check(fn.purchaseInvoiceBalanceDue(inv(1, 'S1', 500000, 200000)) === 300000,
    'a part-paid invoice owes the remainder');
  t.check(fn.purchaseInvoiceBalanceDue(inv(1, 'S1', 500000, 500000)) === 0,
    'a fully paid invoice owes nothing');
  const over = fn.purchaseInvoiceBalanceDue(inv(1, 'S1', 500000, 600000));
  t.check(over === 0,
    `an OVERPAID invoice owes nothing rather than reporting a negative balance (got ${over})`);
}

/* ---------- 2. one overpayment can't cancel another invoice's debt ----- */
/*
 * The bug this suite exists for. Unclamped, S1's total owed came out as
 * 200,000 (-100,000 + 300,000) while 300,000 was genuinely outstanding on
 * invoice 2 -- and the Creditors payment caps at that total, so the shop
 * pays 200,000, invoice 2 is left 100,000 short, and the list then shows
 * the supplier as settled.
 */
{
  seed(inv(1, 'S1', 500000, 600000), inv(2, 'S1', 300000, 0));
  const owed = fn.creditorTotalOwed('S1');
  t.check(owed === 300000,
    `an overpayment on one invoice does not reduce what's owed on another (owed ${owed}, expected 300000)`);

  const outstanding = fn.creditorOutstandingInvoices('S1');
  const sumOfRows = outstanding.reduce((s, pi) => s + fn.purchaseInvoiceBalanceDue(pi), 0);
  t.check(sumOfRows === owed,
    `the Creditors total equals the sum of the invoice rows it's built from (${sumOfRows} vs ${owed})`);
}
{
  // The same invariant across a mixed spread, since the two functions filter
  // differently -- creditorOutstandingInvoices drops anything at or below
  // 0.5, creditorTotalOwed sums everything non-voided.
  seed(
    inv(1, 'S1', 100000, 0), inv(2, 'S1', 100000, 100000), inv(3, 'S1', 100000, 250000),
    inv(4, 'S1', 100000, 40000), inv(5, 'S1', 0, 0), inv(6, 'S2', 900000, 0),
  );
  const owed = fn.creditorTotalOwed('S1');
  const sumOfRows = fn.creditorOutstandingInvoices('S1').reduce((s, pi) => s + fn.purchaseInvoiceBalanceDue(pi), 0);
  t.check(owed === 160000 && sumOfRows === owed,
    `owed is the sum of the positive balances only (owed ${owed}, rows ${sumOfRows}, expected 160000)`);
  t.check(fn.creditorTotalOwed('S2') === 900000,
    "one supplier's invoices never affect another's total");
}
{
  seed(inv(1, 'S1', 500000, 0, { voided: true }), inv(2, 'S1', 300000, 0));
  t.check(fn.creditorTotalOwed('S1') === 300000 && fn.creditorOutstandingInvoices('S1').length === 1,
    'a voided purchase invoice is owed nothing and is not payable');
}

/* ---------- 3. allocation never overpays ------------------------------ */
{
  seed(inv(1, 'S1', 100000, 0), inv(2, 'S1', 300000, 0));
  cash.txns = [];
  const r = fn.allocateCreditorPayment('S1', 250000, 'cash', 'part payment');
  t.check(r.applied === 250000 && r.unapplied === 0,
    `a lump sum smaller than the debt is fully applied (applied ${r.applied})`);
  t.check(data.purchaseInvoices[0].amountPaid === 100000 && data.purchaseInvoices[1].amountPaid === 150000,
    'allocation settles the oldest invoice first, then part-pays the next');
  t.check(cash.txns.length === 2 && cash.txns.reduce((s, x) => s + x.amount, 0) === 250000,
    `each allocated portion becomes its own Cash Book entry (${cash.txns.length} entries)`);
  t.check(fn.creditorTotalOwed('S1') === 150000, 'the remaining debt is what is left unpaid');
}
{
  // Handed more than is owed, allocation must stop at the debt rather than
  // pushing the surplus onto the last invoice.
  seed(inv(1, 'S1', 100000, 0), inv(2, 'S1', 300000, 0));
  cash.txns = [];
  const r = fn.allocateCreditorPayment('S1', 999999999, 'cash', '');
  t.check(r.applied === 400000 && r.unapplied === 999999999 - 400000,
    `allocation applies only what is owed and reports the rest unapplied (applied ${r.applied})`);
  const overpaid = data.purchaseInvoices.filter((pi) => (pi.amountPaid || 0) > fn.purchaseInvoiceTotal(pi));
  t.check(overpaid.length === 0,
    `allocation never leaves an invoice paid above its total (${overpaid.length} overpaid)`);
  t.check(fn.creditorTotalOwed('S1') === 0, 'the supplier is settled once every invoice is covered');
}

/* ---------- 4. the per-invoice payment form caps too ------------------- */
/*
 * Structural: the handler is an inline listener, not an extractable
 * function. Without the cap, allocation's guarantee above is worth nothing
 * -- the surplus just gets typed in on the single-invoice form instead.
 */
{
  const handler = /getElementById\('pip_save'\)\.addEventListener\('click', \(\)=>\{([\s\S]*?)\n\}\);/.exec(adminSrc);
  if (!handler) {
    t.fail("could not find the pip_save handler to check");
  } else {
    const body = handler[1];
    t.check(/purchaseInvoiceBalanceDue\(pi\)/.test(body) && /Math\.min\(amountEntered, due\)/.test(body),
      'recording a payment on one purchase invoice caps it at that invoice\'s balance');
    t.check(/if\(due<=0\)/.test(body),
      'a fully paid purchase invoice refuses a further payment instead of overpaying it');
  }
}

/* ---------- 5. parity with the customer side -------------------------- */
{
  const q = { items: [{ qty: 1, sellPrice: 500000 }], amountPaid: 600000 };
  t.check(fn.invoiceBalanceDue(q) === 0 && fn.purchaseInvoiceBalanceDue(inv(1, 'S1', 500000, 600000)) === 0,
    'buy side and sell side both clamp an overpaid balance to zero');
}

/* Generating purchase invoices is async from here on -- each PINV- number
   is fetched one at a time to keep that sequence dense. */
(async () => {

/* ---------- 6. generating invoices off a quote ------------------------ */
{
  data.suppliers = [{ id: 'S1', name: 'Kampala Steel' }, { id: 'S2', name: 'Mukono Cement' }];
  data.purchaseInvoices = [];
  data.nextPurchaseInvoiceId = 1;
  const q = {
    id: 77, client: { name: 'Achen' }, invoicedAt: '2026-08-01',
    items: [
      { productId: 'P1', supplierId: 'S1', qty: 2, price: 40000, sellPrice: 55000, productName: 'Rebar' },
      { productId: 'P2', supplierId: 'S1', qty: 1, price: 10000, sellPrice: 14000, productName: 'Wire' },
      { productId: 'P3', supplierId: 'S2', qty: 5, price: 30000, sellPrice: 38000, productName: 'Cement' },
      { productId: 'P4', supplierId: '__stock__', qty: 3, price: 5000, sellPrice: 9000, productName: 'Nails' },
    ],
  };
  await fn.generatePurchaseInvoicesForQuote(q);
  t.check(data.purchaseInvoices.length === 2,
    `one purchase invoice per supplier, and none for our own stock (got ${data.purchaseInvoices.length})`);
  const s1 = data.purchaseInvoices.find((pi) => pi.supplierId === 'S1');
  t.check(s1 && fn.purchaseInvoiceTotal(s1) === 90000,
    `the purchase invoice is costed at the BUY price, not the sell price (got ${s1 && fn.purchaseInvoiceTotal(s1)}, expected 90000)`);
  t.check(data.purchaseInvoices.every((pi) => pi.quoteId === 77 && pi.amountPaid === 0 && !pi.voided),
    'generated invoices start unpaid and linked back to the order');

  // Re-invoicing must not double up.
  await fn.generatePurchaseInvoicesForQuote(q);
  t.check(data.purchaseInvoices.length === 2, 're-invoicing the same order replaces its purchase invoices rather than duplicating them');
}

/* ---------- 7. reversal takes the Cash Book with it ------------------- */
{
  data.purchaseInvoices = [];
  data.nextPurchaseInvoiceId = 1;
  cash.txns = [];
  seed(inv(1, 'S1', 500000, 0, { quoteId: 77 }), inv(2, 'S1', 200000, 0, { quoteId: null }));
  // Enough to settle the order-linked invoice AND spill onto the restock one,
  // so the reversal has both to tell apart.
  fn.allocateCreditorPayment('S1', 600000, 'cash', '');
  const before = cash.txns.length;
  fn.removePurchaseInvoicesForQuote(77);
  t.check(data.purchaseInvoices.length === 1 && data.purchaseInvoices[0].quoteId === null,
    'removing an order\'s purchase invoices leaves standalone restock invoices alone');
  t.check(before === 2 && cash.txns.length === 1,
    `the Cash Book entries for the removed invoice's payments go with it (${before} -> ${cash.txns.length})`);
}

/* ---------- 8. un-invoicing warns about the money it destroys --------- */
/*
 * removePurchaseInvoicesForQuote deletes supplier payments and their Cash
 * Book entries. That cash really did leave the till, so reversing it rewrites
 * the books to say it never did -- it must be confirmed, not discovered.
 */
{
  data.purchaseInvoices = [];
  seed(inv(1, 'S1', 500000, 300000, { quoteId: 77, payments: [{ amount: 300000, cashTxnId: 1 }] }));
  const q = { id: 77, payments: [{ amount: 120000, cashTxnId: 9 }] };
  const w = fn.uninvoiceReversalWarning(q);
  t.check(w && /120000/.test(w) && /300000/.test(w),
    'the un-invoice warning names both the customer payments and the supplier payments');

  const supplierOnly = fn.uninvoiceReversalWarning({ id: 77, payments: [] });
  t.check(supplierOnly && /300000/.test(supplierOnly),
    'an order with no customer payment still warns about what was paid to the supplier');

  data.purchaseInvoices = [inv(1, 'S1', 500000, 0, { quoteId: 77 })];
  t.check(fn.uninvoiceReversalWarning({ id: 77, payments: [] }) === null,
    'nothing is asked when un-invoicing destroys no money');
}
/* ---------- deleting says what un-invoicing says, and more ----------- */
/*
 * Deleting undoes everything un-invoicing does AND removes the order, yet
 * asked only "Delete this saved quote? This cannot be undone." -- naming no
 * figure at all. Three real orders carrying UGX 1,965,500 of payments were
 * deleted behind that prompt.
 */
{
  data.purchaseInvoices = [];
  seed(inv(1, 'S1', 500000, 300000, { quoteId: 77, payments: [{ amount: 300000, cashTxnId: 1 }] }));
  const q = { id: 77, client: { name: 'Kato Construction' }, payments: [{ amount: 120000, cashTxnId: 9 }], debtCharged: 80000 };

  const del = fn.deleteQuoteWarning(q);
  t.check(/120000/.test(del) && /300000/.test(del),
    'deleting names the customer and supplier payments it will remove');
  t.check(/80000/.test(del) && /Kato Construction/.test(del),
    'and the debt it writes off, with whose it was — applyInvoiceDebtCharge(q, 0) clears it silently otherwise');
  t.check(/Deleting this order/.test(del),
    'worded for deletion rather than borrowed verbatim from un-invoicing');

  // Both paths describe the same underlying loss.
  const un = fn.uninvoiceReversalWarning(q);
  const figures = (s) => (String(s).match(/[\d,]{4,}/g) || []).join('|');
  t.check(figures(un) === figures(del),
    `un-invoicing and deleting quote the same figures (${figures(un)} vs ${figures(del)})`);

  // Nothing to lose still asks, just without a list.
  const bare = fn.deleteQuoteWarning({ id: 99, client: {}, payments: [], debtCharged: 0 });
  t.check(/^Delete this saved quote/.test(bare) && !/permanently remove/.test(bare),
    'an order carrying nothing gets the plain question, not an empty threat');
  t.check(typeof fn.deleteQuoteWarning(undefined) === 'string',
    'and a quote that cannot be found still produces a question rather than throwing');
}
{
  // The order matters: it has to look the quote up BEFORE asking, or it
  // cannot describe what it is about to delete.
  const del = extractFunction(adminSrc, 'deleteSavedQuote', 'index.html');
  const iFind = del.indexOf('data.savedQuotes.find');
  const iConfirm = del.indexOf('confirm(deleteQuoteWarning(q))');
  t.check(iFind > -1 && iConfirm > iFind,
    'the order is found before the question is asked');
  t.check(!/confirm\('Delete this saved quote\? This cannot be undone\.'\)/.test(del),
    'and the old figure-free prompt is gone');
}
{
  // These strings go into confirm(), which is plain text.
  const parts = extractFunction(adminSrc, 'orderReversalParts', 'index.html');
  t.check(!/esc\(/.test(parts),
    "nothing in the dialog is HTML-escaped — a customer called \"O'Brien & Sons\" must not read as O&#39;Brien &amp; Sons");
}
{
  const toggle = extractFunction(adminSrc, 'toggleQuoteInvoiced', 'index.html');
  const iWarn = toggle.indexOf('uninvoiceReversalWarning');
  const iFlip = toggle.indexOf('q.invoiced = !q.invoiced');
  t.check(iWarn > -1 && /confirm\(warning\)/.test(toggle) && iWarn < iFlip,
    'toggleQuoteInvoiced asks before it flips, so a declined confirm changes nothing');
}
{
  // The toast has to match: hadPayments used to look only at the customer
  // side, so reversing a paid supplier reported "stock restored".
  const toggle = extractFunction(adminSrc, 'toggleQuoteInvoiced', 'index.html');
  t.check(/hadPayments[\s\S]{0,200}purchaseInvoices\.some/.test(toggle),
    'the reversal notice counts supplier payments too, not just customer payments');
}

/* ---------- 9. a voided document doesn't count, and says so ----------- */
/*
 * Voiding excludes an invoice from the Creditors/Debtors lists but leaves
 * it on its own tab, where the totals row was still adding it in -- so the
 * two disagreed about what the shop owed. And the printed A5 carried no
 * marking at all: on screen a voided invoice is struck through, on paper it
 * was indistinguishable from a live one and could be handed over and acted
 * on. Both halves are checked on both sides, because the buy and sell
 * documents shared the bug and a fix to one only would leave them
 * inconsistent.
 */
{
  const totalsBlock = (fnName, guard) => {
    const src = extractFunction(adminSrc, fnName, 'index.html');
    return new RegExp(guard).test(src);
  };
  t.check(totalsBlock('renderPurchaseInvoices', 'if\\(!pi\\.voided\\)\\{ totalAmt \\+= total'),
    'the Purchase Invoices totals row skips voided invoices');
  t.check(totalsBlock('renderInvoices', 'if\\(!q\\.voided\\)\\{ totalAmt \\+= total'),
    'the Invoices totals row skips voided invoices');
}
{
  // Run the real builder rather than matching source, so the marking has to
  // actually reach the page.
  const build = compileScope(
    [extractFunction(adminSrc, 'buildPurchaseInvoiceA5HTML', 'index.html')],
    Object.assign({}, env, {
      esc: (s) => String(s == null ? '' : s),
      quoteItemPackingLabel: () => '',
      purchaseInvoiceNumberLabel: fn.purchaseInvoiceNumberLabel,
      purchaseInvoiceTotal: fn.purchaseInvoiceTotal,
    }),
    ['buildPurchaseInvoiceA5HTML'],
  ).buildPurchaseInvoiceA5HTML;

  const live = build(inv(1, 'S1', 500000, 0));
  const dead = build(inv(1, 'S1', 500000, 0, { voided: true }));
  t.check(/VOIDED/.test(dead) && /a5-voided/.test(dead),
    'a voided purchase invoice prints marked as cancelled');
  t.check(!/VOIDED/.test(live),
    'a live purchase invoice carries no such marking');
  t.check(/PINV-0001/.test(dead) && /500000/.test(dead),
    'the voided copy still shows its number and figures, so it can be identified');
}
{
  // The CSS has to survive a black and white printer -- a colour-only cue
  // would vanish on the machines these are actually printed on.
  const css = /\.a5-voided\{([^}]+)\}/.exec(adminSrc);
  t.check(css && /border:/.test(css[1]) && /font-weight:\s*700/.test(css[1]),
    'the voided banner is bordered and bold rather than relying on colour');
}

process.exit(t.done() ? 1 : 0);

})();
