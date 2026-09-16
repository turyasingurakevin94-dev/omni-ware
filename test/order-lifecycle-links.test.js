#!/usr/bin/env node
'use strict';
/*
 * Walking the order lifecycle.
 *
 * An order, the invoice it becomes and the purchase invoice it raises
 * against a supplier are one thing moving through the business. The data
 * has always known that -- purchase invoices carry quoteId, and
 * purchaseInvoiceCollectionPct() already reads across the link to work out
 * how much of an order has been collected.
 *
 * The screens did not. This app has twenty tabs named after the tables
 * behind them, and `switchTab('purchase-invoices')` appeared nowhere in
 * the file: to get from an order to the purchase invoice it raised you had
 * to memorise a number, change tab, and search for it yourself.
 *
 * The purchase-invoice side did carry a label -- but it named the CUSTOMER
 * rather than the order, it was not clickable, and when customerName
 * happened to be empty it rendered nothing at all despite the invoice
 * being linked to a real order.
 *
 * Run: node test/order-lifecycle-links.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('order lifecycle links');
const src = read('index.html');

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let s = null, err = null;
try {
  s = compileScope(
    [
      extractFunction(src, 'purchaseInvoiceNumberLabel', 'index.html'),
      extractFunction(src, 'invoiceNumberLabel', 'index.html'),
      extractFunction(src, 'purchaseInvoicesForOrder', 'index.html'),
      extractFunction(src, 'orderForPurchaseInvoice', 'index.html'),
      extractFunction(src, 'orderPurchaseInvoiceLinksHTML', 'index.html'),
    ],
    { esc, data: { purchaseInvoices: [], savedQuotes: [] } },
    ['purchaseInvoicesForOrder', 'orderForPurchaseInvoice', 'orderPurchaseInvoiceLinksHTML',
     'invoiceNumberLabel', 'purchaseInvoiceNumberLabel'],
  );
} catch (e) { err = e; }
t.check(!!s, `the lifecycle helpers compile${err ? ` (${err.message})` : ''}`);

if (s) {
  // A fresh scope per dataset, rather than mutating a shared `data`
  // binding through a closure.
  const withData = (d) => compileScope(
    [
      extractFunction(src, 'purchaseInvoiceNumberLabel', 'index.html'),
      extractFunction(src, 'invoiceNumberLabel', 'index.html'),
      extractFunction(src, 'purchaseInvoicesForOrder', 'index.html'),
      extractFunction(src, 'orderForPurchaseInvoice', 'index.html'),
      extractFunction(src, 'orderPurchaseInvoiceLinksHTML', 'index.html'),
    ],
    { esc, data: d },
    ['purchaseInvoicesForOrder', 'orderForPurchaseInvoice', 'orderPurchaseInvoiceLinksHTML'],
  );

  const ORDER = { id: 142, client: { name: 'Ssebowa J.' } };
  const OTHER = { id: 143, client: { name: 'Namuli Hardware' } };
  const PI_A = { id: 42, quoteId: 142, supplierName: 'Hima Cement' };
  const PI_B = { id: 43, quoteId: 142, supplierName: 'Roofings Ltd', voided: true };
  const PI_STOCK = { id: 44, quoteId: null, supplierName: 'Hima Cement' };

  const D = { savedQuotes: [ORDER, OTHER], purchaseInvoices: [PI_A, PI_B, PI_STOCK] };
  const f = withData(D);

  /* ---------- 1. both directions resolve ----------------------------- */
  {
    const pis = f.purchaseInvoicesForOrder(ORDER);
    t.check(pis.length === 2, `an order finds every purchase invoice it raised (${pis.length})`);
    t.check(pis.every(p => p.quoteId === 142), 'and only its own');
    t.check(f.purchaseInvoicesForOrder(OTHER).length === 0, 'an order that raised none finds none');
    t.check(f.purchaseInvoicesForOrder(null).length === 0, 'and a missing order does not throw');

    t.check(f.orderForPurchaseInvoice(PI_A) === ORDER, 'a purchase invoice finds the order behind it');
    t.check(f.orderForPurchaseInvoice(PI_STOCK) === null,
      'a stock restock has no order, and says so rather than guessing');
    t.check(f.orderForPurchaseInvoice(null) === null, 'and a missing invoice does not throw');
  }

  /* ---------- 2. a voided invoice is named, not hidden --------------- */
  /*
   * It is part of this order's history. Hiding it makes the money look
   * unexplained -- which is exactly the confusion the reversal warning
   * built earlier this week exists to prevent.
   */
  {
    const html = f.orderPurchaseInvoiceLinksHTML(ORDER);
    t.check(/PINV-0042/.test(html), 'the live purchase invoice is listed');
    t.check(/PINV-0043/.test(html), 'and so is the voided one');
    t.check(/\(voided\)/.test(html), 'marked as voided');
    t.check(/class="lc-link voided"/.test(html), 'and styled apart from a live one');
    t.check(/Hima Cement/.test(html) && /Roofings Ltd/.test(html),
      'each names its supplier, since that is why there is more than one');
  }

  /* ---------- 3. nothing is drawn when there is nothing to follow ---- */
  {
    t.check(f.orderPurchaseInvoiceLinksHTML(OTHER) === '',
      'an order with no purchase invoice draws no lifecycle row');
    t.check(f.orderPurchaseInvoiceLinksHTML(null) === '', 'nor does a missing order');
  }

  /* ---------- 4. the markup is escaped -------------------------------- */
  {
    const evil = withData({
      savedQuotes: [ORDER],
      purchaseInvoices: [{ id: 50, quoteId: 142, supplierName: '<img src=x onerror=alert(1)>' }],
    });
    const html = evil.orderPurchaseInvoiceLinksHTML(ORDER);
    t.check(!/<img src=x/.test(html), 'a supplier name carrying markup is escaped');
    t.check(/&lt;img/.test(html), 'and survives as text');
  }
}

/* ---------- 5. the links are wired to real navigation ---------------- */
{
  const code = src.split(/\r?\n/).map(l => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');

  t.check(/function revealPurchaseInvoice\(piId\)/.test(code) && /function revealOrderFor\(piId\)/.test(code),
    'both directions have a reveal');
  /* They work by filling the SHARED search box before switching lens,
     because goToTab() -> invApplySide() re-renders whichever register is
     open from that box.

     The two registers are ONE SCREEN now -- Sales and Purchases are
     lenses over one filter bar -- so there is one search box, one date
     range and one Hide voided rather than two copies of each. That is
     what this check has to hold: the tab switch it used to assert was
     the expensive half of the link, not the useful one.

     The window is 400 rather than 120 because filling the box turned out
     to be only half the job: the register ALSO filters by a date range
     and hides voided documents, and neither was reset for a reader
     arriving from another screen -- so a bill from last month, or one
     that had been voided, landed them on an empty list with its own
     number typed above it. Those two guards sit between the box and the
     switch, and are checked in their own right below. */
  t.check(/document\.getElementById\('inv_doc_search'\)[\s\S]{0,400}invSide = 'buys';[\s\S]{0,80}goToTab\('invoices'\)/.test(code),
    'revealing a purchase invoice fills the shared search box, then opens the Purchases lens');
  t.check(!/'pi_doc_search'/.test(code) && !/'pi_doc_range_preset'/.test(code),
    'and there is no second copy of that bar left to disagree with it');

  const reveals = [
    ['revealPurchaseInvoice', 'inv_doc_hide_voided', 'inv_doc_range_preset'],
    ['revealInvoice', 'inv_doc_hide_voided', 'inv_doc_range_preset'],
  ];
  reveals.forEach(([fn, hide, preset]) => {
    const body = (new RegExp('function ' + fn + '\\([\\s\\S]*?\\n\\}').exec(code) || [''])[0];
    t.check(body.includes(hide),
      `${fn} drops the voided filter, so a cancelled document is not pointed at and then hidden`);
    t.check(new RegExp(preset + "[\\s\\S]{0,160}'all'").test(body),
      `${fn} widens the date range, so a document outside it is not pointed at and then hidden`);
  });
  t.check(/function revealInvoice\(qId\)/.test(code),
    'and an invoice has a reveal of its own, rather than three screens keeping their own copy of it');
  t.check(/document\.getElementById\('inv_doc_search'\)[\s\S]{0,120}goToTab\('invoices'\)/.test(code),
    'and revealing an order does the same');

  /* THE FORWARD LINK ASKS ABOUT THE ORDER, not about the one number
     pressed. An order that raised three bills is one question with three
     answers, so following any of them shows all three under a crumb
     naming the order -- with the one pressed open. revealPurchaseInvoice
     is still the fallback for a bill with no order behind it, which is
     every restock (generatePurchaseInvoiceForRestock sets quoteId: null). */
  /* The binding moved from each pill to the row that holds them: the card
     register listens once per row and asks what was pressed, because a row
     is now a document you can open as well as a set of links. Both paths
     are unchanged and both are still here -- the order's bills when there
     is an order, the single bill when there is not. */
  t.check(/pill\.dataset\.pi[\s\S]{0,460}revealBillsForOrder\(order\.id\)/.test(code),
    'the order card wires its forward links to the order they belong to');
  t.check(/revealBillsForOrder\(order\.id\); \}\s*\n\s*else revealPurchaseInvoice\(piId\)/.test(code),
    'and falls back to the single bill when there is no order behind it');
  /* And the pressed bill is the one that opens, not merely the order. */
  t.check(/piOpenId = piId; revealBillsForOrder\(order\.id\)/.test(code),
    'with the bill that was pressed already open under the crumb');
  const focus = (/function revealBillsForOrder\([\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(/invFocusOrderId = q\.id/.test(focus) && !/inv_doc_search/.test(focus),
    'it sets a focus rather than typing into the shared bar, so the Sales list it left is untouched');
  t.check(/invFocusOrderId = null;[\s\S]{0,60}invSide = 'sales';/.test(code),
    'and Back to Sales is one press, which is the whole of what the merge buys');
  t.check(/wrap\.querySelectorAll\('\[data-order-pi\]'\)[\s\S]{0,160}revealOrderFor/.test(code),
    'and the purchase invoice card wires its link back');
  t.check((code.match(/ev\.stopPropagation\(\);/g) || []).length >= 2,
    'both stop the click reaching the row underneath');

  // The label that used to name the customer instead of the order.
  t.check(/data-order-pi="\$\{pi\.id\}"[\s\S]{0,80}invoiceNumberLabel\(linkedOrder\)/.test(code),
    'the purchase invoice now names the ORDER, not just the customer');
  t.check(!/const fromOrderLabel = pi\.customerName \? `Order for/.test(code),
    'the old customer-only label is gone');
  // It carries markup now, so double-escaping would render the tags as text.
  t.check(!/esc\(fromOrderLabel\)/.test(code),
    'and it is not escaped again at the point of use, which would print the link as text');
}

process.exit(t.done() ? 1 : 0);
