#!/usr/bin/env node
'use strict';
/*
 * One delivery, billed twice.
 *
 * Save on the restock screen awaited a PINV number from the server and
 * the button stayed live while it did, so a second press entered the
 * whole purchase again. A shop found PINV-0143 and PINV-0144 for the
 * same twenty cartons that way, and three +1,000 restocks of the same
 * hinges on one day. The press is guarded now; the bills it already
 * raised are still on the books, and nobody can be asked to find them by
 * reading a year of paperwork.
 *
 * So they are found — by what a duplicate actually IS: same supplier,
 * same day, same lines at the same prices. Deliberately NOT by the
 * numbers being consecutive: a real double-press usually is, but an
 * honest second delivery is too, and a duplicate with one ordinary bill
 * landing between the presses would go unfound.
 *
 * And asked, never assumed. A shop can buy the same thing twice in one
 * day, so nothing here voids on its own.
 *
 * Run: node test/duplicate-purchase-invoices.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('duplicate purchase invoices');
const src = read('index.html');
const code = src.split(/\r?\n/).map(l => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');

const store = { purchaseInvoices: [] };
const NAMES = ['duplicatePurchaseInvoiceGroups', 'purchaseInvoiceTotal', 'purchaseInvoiceBalanceDue'];
let fns = null, err = null;
try { fns = compileScope(NAMES.map(n => extractFunction(src, n, 'index.html')), { data: store }, NAMES); }
catch (e) { err = e; }
t.check(!!fns, `the detector compiles${err ? ` (${err.message})` : ''}`);

if (fns) {
  const { duplicatePurchaseInvoiceGroups } = fns;
  const pi = (over) => Object.assign({
    id: 1, supplierId: 'S1', supplierName: 'Jin Zhuang Le Ju', date: '2026-08-19', voided: false,
    items: [{ productId: 'P1', variantIdx: null, qty: 1000, price: 2150 }],
    amountPaid: 0, payments: [],
  }, over);

  /* ---------- 1. the reported case ---------------------------------- */
  {
    store.purchaseInvoices = [pi({ id: 41 }), pi({ id: 42 }), pi({ id: 43 })];
    const g = duplicatePurchaseInvoiceGroups();
    t.check(g.length === 1 && g[0].length === 3,
      `three bills for one delivery are found as one group (${g.length} group(s) of ${g[0] && g[0].length})`);
    t.check(g[0][0].id === 41,
      'oldest first — the bill raised first is the one the delivery produced, and the one to keep');
  }

  /* ---------- 2. what is NOT a duplicate ---------------------------- */
  {
    store.purchaseInvoices = [pi({ id: 41 }), pi({ id: 42, date: '2026-08-20' })];
    t.check(duplicatePurchaseInvoiceGroups().length === 0, 'the same order on another day is a second delivery');

    store.purchaseInvoices = [pi({ id: 41 }), pi({ id: 42, supplierId: 'S2', supplierName: 'Other' })];
    t.check(duplicatePurchaseInvoiceGroups().length === 0, 'and the same goods from another supplier is another purchase');

    store.purchaseInvoices = [pi({ id: 41 }),
      pi({ id: 42, items: [{ productId: 'P1', variantIdx: null, qty: 500, price: 2150 }] })];
    t.check(duplicatePurchaseInvoiceGroups().length === 0, 'a different quantity is a different delivery');

    store.purchaseInvoices = [pi({ id: 41 }),
      pi({ id: 42, items: [{ productId: 'P1', variantIdx: null, qty: 1000, price: 2200 }] })];
    t.check(duplicatePurchaseInvoiceGroups().length === 0, 'and so is the same goods at another price');

    store.purchaseInvoices = [pi({ id: 41 }), pi({ id: 42, voided: true })];
    t.check(duplicatePurchaseInvoiceGroups().length === 0, 'a bill already voided is not still a duplicate');

    store.purchaseInvoices = [pi({ id: 41, items: [] }), pi({ id: 42, items: [] })];
    t.check(duplicatePurchaseInvoiceGroups().length === 0,
      'and two bills with no lines at all are not matched — there is nothing to compare');
  }

  /* ---------- 3. found across an honest bill in between ------------- */
  /*
   * The reason this does not look at consecutive numbers: an ordinary
   * purchase landing between the two presses would hide the pair.
   */
  {
    store.purchaseInvoices = [
      pi({ id: 41 }),
      pi({ id: 42, items: [{ productId: 'P9', variantIdx: null, qty: 5, price: 90000 }] }),
      pi({ id: 43 }),
    ];
    const g = duplicatePurchaseInvoiceGroups();
    t.check(g.length === 1 && g[0].map(x => x.id).join(',') === '41,43',
      `the pair is still found with an unrelated bill between them (${g[0] && g[0].map(x => x.id).join(',')})`);
  }

  /* ---------- 4. line order does not hide a match ------------------- */
  {
    const two = [{ productId: 'P1', variantIdx: null, qty: 10, price: 100 },
      { productId: 'P2', variantIdx: null, qty: 4, price: 250 }];
    store.purchaseInvoices = [pi({ id: 41, items: two }), pi({ id: 42, items: two.slice().reverse() })];
    t.check(duplicatePurchaseInvoiceGroups().length === 1,
      'the same lines in another order are the same bill');
  }

  /* ---------- 5. several deliveries, each its own group ------------- */
  {
    store.purchaseInvoices = [pi({ id: 41 }), pi({ id: 42 }),
      pi({ id: 51, date: '2026-08-21', items: [{ productId: 'P7', variantIdx: null, qty: 20, price: 145000 }] }),
      pi({ id: 52, date: '2026-08-21', items: [{ productId: 'P7', variantIdx: null, qty: 20, price: 145000 }] })];
    const g = duplicatePurchaseInvoiceGroups();
    t.check(g.length === 2, `two separate deliveries each billed twice are two groups (${g.length})`);
    t.check(String(g[0][0].date) > String(g[1][0].date), 'newest first, so the freshest mistake is at the top');
  }
}

/* ---------- 6. asked, and never silently destructive ----------------- */
{
  const voidFn = (/function voidDuplicatePurchaseInvoices[\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(voidFn.length > 0, 'the void exists');
  t.check(/const keep = all\[0\];/.test(voidFn) && /const drop = all\.slice\(1\);/.test(voidFn),
    'it keeps the first and voids the rest');
  t.check(/if\(paid\.length\)\{/.test(voidFn),
    'refusing any bill with money against it — that is a real payment to a real supplier');
  t.check(/if\(!confirm\(msg\)\) return;/.test(voidFn), 'and asks first');
  t.check(/does NOT take any goods back off the shelf/.test(voidFn),
    'saying plainly that the stock is a separate correction — voiding a bill leaves the goods where they are');
  const banner = (/function renderPurchaseInvoiceDuplicates[\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(/Did that delivery really arrive twice\?/.test(banner),
    'the banner opens on the question only the shop can answer');
  t.check(/\(paid on\)/.test(banner), 'and marks which bills carry money before anything is pressed');
}

process.exit(t.done() ? 1 : 0);
