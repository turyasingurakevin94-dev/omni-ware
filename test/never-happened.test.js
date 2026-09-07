#!/usr/bin/env node
'use strict';
/*
 * Saying a movement never happened.
 *
 * Every repair in this app corrects a movement to a NEW figure.
 * applyStockPurchaseEdit refuses a quantity of nothing — "a purchase
 * cannot be for nothing" — the count screen moves a count, and the
 * movement log offers no reversal at all. So a delivery entered by
 * mistake could only be disguised as a smaller delivery.
 *
 * On this shop's real books that is exactly what happened: a phantom
 * 16 cartons from a supplier nothing was ever bought from was
 * "corrected" to 0.85, given a different supplier, and hung on a
 * settled 620,000 bill belonging to another delivery three weeks
 * earlier. Three wrong rows out of one, because the right sentence was
 * not sayable.
 *
 * Run: node test/never-happened.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('a movement that never happened');
const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);
const src = read('index.html');

const data = {
  products: [{ id: 'P-EL', name: 'ELEPHANT King',
    variants: [{ combo: { Type: 'Short / Single Lock' } }, { combo: { Type: 'Long / Single Lock' } }] }],
  stock: {}, stockLots: {}, stockLog: [], nextStockLogId: 1, purchaseInvoices: [],
};
const N = ['stockKey', 'addStockLot', 'consumeStockLots', 'restoreStockLots', 'applyStockDelta',
  'stockMovementReversalPlan', 'reverseStockMovement', 'shelfValueForKey', 'stockUnitFor', 'stockMoveOnRowUnit'];
const fns = compileScope([
  extractDeclaration(src, 'STOCK_TYPE_LABELS', 'index.html'),
  ...N.map((n) => extractFunction(src, n, 'index.html')),
], {
  data,
  todayISO: () => '2026-09-07',
  cmpUnitKey: (s) => String(s || '').trim().toLowerCase(),
  productPriceRows: () => [],
  allocRowId: () => data.nextStockLogId++,
  productVariantLabel: (p, vi) => (vi == null ? p.name : `${p.name} — ${Object.values(p.variants[vi].combo).join(' / ')}`),
}, N);

/* The Long variant exactly as the movements screen shows it. */
const reset = (onHand) => {
  data.stock = { 'P-EL::1': onHand };
  data.stockLots = { 'P-EL::1': [{ qty: onHand, cost: 310000 }] };
  data.stockLog = [{ id: 1, key: 'P-EL::1', productId: 'P-EL', variantIdx: 1, type: 'restock',
    delta: 16, qtyAfter: 17, date: '2026-08-28', cost: 310000, supplierId: 'S-SHAFIK', source: 'inv-purchase' }];
  data.nextStockLogId = 2;
  data.purchaseInvoices = [];
};

/* ---------- 1. the phantom delivery, taken back ----------------------- */
{
  reset(16);
  const res = fns.reverseStockMovement(1, 'nothing was ever bought from Shafik Katwe');
  eq(res.ok, true, 'a delivery that never arrived can be said not to have arrived');
  eq(res.took, 16, 'all sixteen come back off the shelf');
  eq(res.soldOn, 0, 'none of them had gone');
  eq(data.stock['P-EL::1'], 0, 'and the shelf is left holding none of them');
  eq(fns.shelfValueForKey('P-EL::1').value, 0, 'with the money that arrived with them off the books too');
}

/* ---------- 2. posted, never erased ----------------------------------- */
{
  reset(16);
  fns.reverseStockMovement(1, 'nothing was ever bought from Shafik Katwe');
  eq(data.stockLog.length, 2, 'the original row is still there — a reversal is a new movement');
  const orig = data.stockLog[0], rev = data.stockLog[1];
  eq(orig.delta, 16, 'saying what it always said');
  eq(rev.delta, -16, 'and the reversal carries the whole of it back');
  eq(rev.type, 'reversal', 'typed as the reversal it is');
  eq(rev.reverses, 1, 'naming the row it undid');
  eq(orig.reversedBy, rev.id, 'and the row it undid naming it back — neither can be read alone and believed');
  t.check(/Never happened/.test(rev.note), `the note says what was said (${rev.note})`);
  t.check(/nothing was ever bought from Shafik Katwe/.test(rev.note), 'with the owner\'s own words kept');

  // Twice is refused.
  const again = fns.reverseStockMovement(1, '');
  eq(again.ok, false, 'a movement already taken back cannot be taken back again');
  eq(data.stockLog.length, 2, 'and nothing further is written');
}

/* ---------- 3. what has been sold on cannot be un-bought -------------- */
{
  // Sixteen delivered, fourteen sold: only two are left to take back.
  reset(2);
  const res = fns.reverseStockMovement(1, '');
  eq(res.ok, true, 'the part still standing can still come back');
  eq(res.took, 2, 'which is the two still on the shelf');
  eq(res.soldOn, 14, 'and the fourteen that left are named rather than driven negative');
  eq(data.stock['P-EL::1'], 0, 'the shelf lands on nothing, never below it');
  t.check(/less 14 already gone/.test(data.stockLog[1].note),
    `and the log says so (${data.stockLog[1].note})`);

  // Nothing left at all is a refusal, not a silent no-op.
  reset(0);
  const none = fns.reverseStockMovement(1, '');
  eq(none.ok, false, 'where every one has gone there is nothing to take back');
  t.check(/already been sold or written off/.test(none.error), 'and the refusal says why');
  eq(data.stockLog.length, 1, 'writing nothing');
}

/* ---------- 4. what it refuses to be asked ---------------------------- */
{
  reset(16);
  eq(fns.reverseStockMovement(999, '').ok, false, 'a movement that is not there');
  // A movement that TOOK goods off is not a delivery to un-deliver.
  data.stockLog.push({ id: 5, key: 'P-EL::1', productId: 'P-EL', variantIdx: 1, type: 'sale',
    delta: -1, qtyAfter: 15, date: '2026-09-05' });
  const sale = fns.reverseStockMovement(5, '');
  eq(sale.ok, false, 'a sale is not something that put goods on the shelf');
  t.check(/PUT goods on the shelf/.test(sale.error), 'and says what the verb is for');
}

/* ---------- 5. the bill is named, never quietly moved ----------------- */
{
  reset(16);
  data.stockLog[0].piId = 102;
  data.purchaseInvoices = [{ id: 102, supplierId: 'S-SHAFIK', voided: false, amountPaid: 0,
    items: [{ productId: 'P-EL', variantIdx: 1, qty: 16, price: 310000 }] }];
  const res = fns.reverseStockMovement(1, '');
  eq(res.ok, true, 'the goods still come off the shelf');
  eq(res.bill && res.bill.id, 102, 'and the bill they were on is handed back to the caller');
  eq(data.purchaseInvoices[0].items[0].qty, 16, 'but the bill itself is untouched');
  eq(data.purchaseInvoices[0].voided, false,
    'un-owing money is a different act, done where voiding a bill is what the screen is for');
}

/* ---------- 6. it is offered where the goods went on, and said ------- */
/*
 * The verb reaches the shop through Put it right rather than a button of
 * its own: one door on every movement row, which asks which KIND of
 * wrong it is. A second door to one verb would be the scattering this
 * whole change exists to remove.
 */
{
  const verbs = extractFunction(src, 'prVerbsFor', 'index.html');
  t.check(/\(Number\(e\.delta\) \|\| 0\) > 0 && !e\.reversedBy/.test(verbs),
    'offered only on a movement that PUT goods on the shelf, and not on one already taken back');
  t.check(!/never'\) return isStockPurchaseRow/.test(verbs),
    'on every such row, not only the purchases the figures verb can reach — a receipt entered by mistake is the same mistake');

  const tag = extractFunction(src, 'stockLogReversedTagHTML', 'index.html');
  t.check(/taken back/.test(tag), 'and the row it undid says so, so it cannot be read alone and believed');
  const log = extractFunction(src, 'renderStockLog', 'index.html');
  t.check(/stockLogReversedTagHTML\(e\)/.test(log) && /stockLogPutRightButtonHTML\(e\)/.test(log),
    'the tag and the door both reach the screen');

  /* SAID IN FULL BEFORE IT IS DONE, from the PLAN rather than the press,
     so what is agreed to is what happens — including the part that
     cannot. */
  const pane = extractFunction(src, 'prPaneHTML', 'index.html');
  t.check(/stockMovementReversalPlan\(e\.id\)/.test(pane), 'the pane reads the plan, not the press');
  t.check(/come back off the shelf/.test(pane), 'it says how many come off');
  t.check(/cannot be un-bought/.test(pane), 'names what has already gone, and marks it a warning');
  t.check(/Money is not touched here/.test(pane) && /purchaseInvoiceNumberLabel\(plan\.bill\)/.test(pane),
    'and names the bill it is deliberately not touching');
  t.check(/Nothing is erased/.test(pane), 'and that the row stays');

  /* And the consequence panel says the same thing in figures, live. */
  const eff = extractFunction(src, 'prRefreshEffects', 'index.html');
  t.check(/prVerb === 'never'/.test(eff) && /On the shelf/.test(eff),
    'the panel shows what the shelf becomes');
  t.check(/nothing left to take back/.test(eff),
    'and blocks the save where every one has already gone');
}

process.exit(t.done() ? 1 : 0);
