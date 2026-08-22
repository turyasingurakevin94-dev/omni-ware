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
const NAMES = ['invPurchaseQtyValue', 'invPackContextFor', 'invQtyInBothUnits'];
let fns = null, err = null;
try {
  fns = compileScope(NAMES.map(n => extractFunction(src, n, 'index.html')), {
    data: store,
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

process.exit(t.done() ? 1 : 0);
