#!/usr/bin/env node
'use strict';
/*
 * A count is a number AND a unit.
 *
 * Stock is kept in base units — pairs, pieces, metres — and a shop that
 * buys in cartons thinks in cartons. The purchase screen has always
 * asked which of the two a typed number is. The stock-count screen took
 * a bare number with no unit beside it and read it as base units.
 *
 * So a shop counting ZIN ZHUANG Soft Close typed 10, meaning ten
 * cartons, against a shelf the app held as 2,000 pairs. It recorded a
 * correction of −1,990 and set the shelf to ten pairs. Nothing on the
 * screen was in cartons to contradict it, and the 1,990 pairs were only
 * found weeks later by reading the movement log.
 *
 * The count now carries the same unit choice the purchase does, through
 * the same converter, and says the result back in both units before
 * anything is saved.
 *
 * Run: node test/stock-count-units.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('stock count units');
const src = read('index.html');
const code = src.split(/\r?\n/).map(l => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');

const store = { prices: [], products: [] };
// The count screen reads its unit off the shelf's one reader, stockUnitFor.
const NAMES = ['stockUnitFor', 'invPurchaseQtyValue', 'invPackContextFor', 'invQtyInBothUnits'];
let fns = null, err = null;
try {
  fns = compileScope(NAMES.map(n => extractFunction(src, n, 'index.html')), {
    data: store,
    cmpUnitKey: (s) => String(s || '').trim().toLowerCase(),
    // The two price-row helpers, stubbed at the boundary this reads them.
    productPriceRows: () => store.prices,
    rankedPriceRows: () => store.prices.filter(r => !r.outOfStock),
  }, NAMES);
} catch (e) { err = e; }
t.check(!!fns, `the unit routines compile${err ? ` (${err.message})` : ''}`);

if (fns) {
  const { invPurchaseQtyValue, invPackContextFor, invQtyInBothUnits } = fns;

  // ZIN ZHUANG Soft Close: sold in pairs, bought in cartons of 100.
  const soldInCartons = () => {
    store.prices = [{ supplierId: 'S1', unit: 'Pair', packUnit: 'Ctn', packQty: 100, wholesale: 2150 }];
    return invPackContextFor('P1', null);
  };

  /* ---------- 1. the pack is found, and named ----------------------- */
  {
    const ctx = soldInCartons();
    t.check(ctx.hasPack && ctx.packQty === 100 && ctx.packUnit === 'Ctn' && ctx.unit === 'Pair',
      `the product's packing is read off its price row (${JSON.stringify(ctx)})`);
    store.prices = [{ supplierId: 'S1', unit: 'Piece', packUnit: '', packQty: 0, wholesale: 500 }];
    t.check(!invPackContextFor('P1', null).hasPack,
      'a product with no pack has none — the screen must not offer a unit that does not exist');
  }

  /* ---------- 2. the mistake that cost 1,990 pairs ------------------ */
  /*
   * Ten, meaning cartons, against 2,000 pairs on the shelf. Typed as
   * cartons it is 1,000 pairs; read as pairs it is ten, and the
   * difference is the whole of the fault.
   */
  {
    const ctx = soldInCartons();
    const asCartons = invPurchaseQtyValue(10, 'pack', ctx.packQty);
    const asPairs = invPurchaseQtyValue(10, 'unit', ctx.packQty);
    t.check(asCartons === 1000, `ten cartons is a thousand pairs (${asCartons})`);
    t.check(asPairs === 10, 'and ten pairs is ten — the same keystroke, two different shelves');
    t.check(asCartons - 2000 === -1000 && asPairs - 2000 === -1990,
      'against a shelf of 2,000 the two readings differ by 1,990 — the pairs that went missing');
  }

  /* ---------- 3. the shop's own correction, done right -------------- */
  /*
   * Six cartons remaining, which is what the shop actually has. Typed
   * as cartons against a recorded 900 pairs.
   */
  {
    const ctx = soldInCartons();
    const six = invPurchaseQtyValue(6, 'pack', ctx.packQty);
    t.check(six === 600, `six cartons is six hundred pairs (${six})`);
    t.check(six - 900 === -300, 'so counting down from 900 pairs is a correction of −300, not −894');
  }

  /* ---------- 4. said back in both units, before anything is saved -- */
  {
    const ctx = soldInCartons();
    t.check(invQtyInBothUnits(600, ctx) === '600 Pair · 6 Ctn',
      `a count is restated in the unit typed and the unit kept (${invQtyInBothUnits(600, ctx)})`);
    t.check(invQtyInBothUnits(10, ctx) === '10 Pair · 0.1 Ctn',
      `so ten pairs reads as a tenth of a carton — which is the sentence that stops the mistake (${invQtyInBothUnits(10, ctx)})`);
    t.check(invQtyInBothUnits(900, ctx) === '900 Pair · 9 Ctn', 'and a whole number of packs stays whole');
    store.prices = [{ supplierId: 'S1', unit: 'Piece', packUnit: '', packQty: 0 }];
    t.check(invQtyInBothUnits(7, invPackContextFor('P1', null)) === '7 Piece',
      'a product with no pack is stated once, not padded with a unit it does not have');
  }
}

/* ---------- 5. the screen asks, converts, and says it back ----------- */
{
  const stage = code.slice(code.indexOf('function renderInvStage'), code.indexOf('function renderInvPurchaseStage'));
  t.check(/id="inv_actual_unit"/.test(stage), 'the count box carries a unit selector');
  t.check(/packCtx\.hasPack \? `<select id="inv_actual_unit"/.test(stage),
    'offered only where the product actually comes in packs');
  t.check(/const typedAsBase = \(\)=> invPurchaseQtyValue\(actualInput\.value,/.test(stage),
    'and converts through the same function the purchase screen uses, so a carton means one thing');
  t.check(/const actual = typedAsBase\(\);/.test(stage),
    'the save reads the converted figure, not the raw box');
  t.check(!/const actual = Number\(actualInput\.value\)\|\|0;/.test(stage),
    'the unconverted read that set a 2,000-pair shelf to ten is gone');
  t.check(/That is \$\{invQtyInBothUnits\(actual, packCtx\)\} on the shelf, against \$\{invQtyInBothUnits\(current, packCtx\)\} recorded\./.test(stage),
    'and the screen says the count back in both units, against what is recorded, before anything is saved');
  t.check(/updatePreview\(\);/.test(stage),
    'said on open too, not only after a keystroke');
}


/* ---------- 6. un-invoicing says what goes back on the shelf --------- */
/*
 * A shop sourced a line from one supplier, received it, invoiced,
 * un-invoiced to change supplier, invoiced, and un-invoiced again. Each
 * undo put twenty boxes back on the shelf — correctly, because the sale
 * was being undone — and the shelf ended up holding goods the customer
 * had walked out with.
 *
 * Nothing in the dialog mentioned stock. It named payments and debt, and
 * an order carrying neither opened no dialog at all: the goods went back
 * in silence. The books were right and the shop was not told.
 */
{
  const { read: rd, extractFunction: ef, compileScope: cs } = require('./_extract');
  const s2 = rd('index.html');
  const N2 = ['orderStockReturnParts', 'orderReversalParts', 'uninvoiceReversalWarning', 'deleteQuoteWarning'];
  let f2 = null, e2 = null;
  try {
    f2 = cs(N2.map(n => ef(s2, n, 'index.html')),
      { data: { purchaseInvoices: [] }, fmtUGX: (n) => `${Math.round(n)} UGX` }, N2);
  } catch (e) { e2 = e; }
  t.check(!!f2, `the reversal warnings compile${e2 ? ` (${e2.message})` : ''}`);

  if (f2) {
    const order = (over) => Object.assign({
      id: 193, client: { name: 'Falcon Imprex' }, payments: [], debtCharged: 0,
      items: [{ productId: 'P1', productName: 'Black Screws — 8∗ / Coarse', _stockTaken: 20 }],
    }, over);

    t.check(f2.orderStockReturnParts(order())[0] === '20 × Black Screws — 8∗ / Coarse',
      `what the sale took is what goes back (${f2.orderStockReturnParts(order())[0]})`);
    t.check(f2.orderStockReturnParts(order({ items: [{ productId: 'P1', _stockTaken: 0 }] })).length === 0,
      'a line that took nothing off the shelf puts nothing back');

    const w = f2.uninvoiceReversalWarning(order());
    t.check(!!w, 'an order carrying no payments now WARNS — it used to open no dialog and return the goods in silence');
    t.check(/goes back onto the shelf/.test(w), 'saying the goods go back');
    t.check(/If those goods actually left with the customer, count that product afterwards/.test(w),
      'and naming the one case the books cannot know about');

    // Alongside money, both are said, each as its own sentence.
    const paid = f2.uninvoiceReversalWarning(order({ payments: [{ amount: 230000 }] }));
    t.check(/permanently remove/.test(paid) && /goes back onto the shelf/.test(paid),
      'with payments on the order, the money and the goods are both named');

    const del = f2.deleteQuoteWarning(order());
    t.check(/goes back onto the shelf/.test(del), 'deleting says it too — it undoes the same sale');
    t.check(f2.uninvoiceReversalWarning(order({ items: [] })) === null,
      'while an order that took nothing and carries nothing still asks nothing');
  }
}

process.exit(t.done() ? 1 : 0);
