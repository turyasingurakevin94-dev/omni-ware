#!/usr/bin/env node
'use strict';
/*
 * FIFO cost lots, and what happens when a sale is undone.
 *
 * Stock cost is tracked as lots -- {qty, cost} in purchase order. A
 * purchase pushes a lot on the end; any reduction consumes from the front,
 * so "what did the stock on hand cost us" reflects the oldest unsold units.
 *
 * Un-invoicing broke that. reverseQuoteStockDeduction() knew only the
 * QUANTITY it had taken, so it handed that number to applyStockDelta(),
 * which pushed one fresh lot with no cost on the back. Two things went
 * wrong at once:
 *
 *   - the cost was lost. A sale that cleared an item's last stock and was
 *     then un-invoiced left the shop holding goods it no longer knew the
 *     price of: getFIFOUnitCost() returned null, and every margin figure
 *     downstream lost its cost side.
 *   - the order was wrong. Units taken off the FRONT came back on the BACK,
 *     so newer stock costed out ahead of older -- the opposite of the rule.
 *
 * The consume now reports which lots it took, and the reversal puts those
 * same units back, at those same costs, at the front.
 *
 * Run: node test/admin-stock-lots.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('admin stock lots');
const src = read('index.html');
const code = src.split(/\r?\n/).map(l => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');

const store = { stockLots: {} };
let fns = null, err = null;
try {
  fns = compileScope(
    ['stockKey', 'addStockLot', 'consumeStockLots', 'restoreStockLots', 'getFIFOUnitCost']
      .map(n => extractFunction(src, n, 'index.html')),
    { data: store }, ['stockKey', 'addStockLot', 'consumeStockLots', 'restoreStockLots', 'getFIFOUnitCost'],
  );
} catch (e) { err = e; }
t.check(!!fns, `the lot functions compile${err ? ` (${err.message})` : ''}`);

const lots = () => JSON.parse(JSON.stringify(store.stockLots['P1'] || []));
const reset = () => { store.stockLots = {}; };

if (fns) {
  const { addStockLot, consumeStockLots, restoreStockLots, getFIFOUnitCost } = fns;

  /* ---------- 1. the consume reports what it took ------------------- */
  {
    reset();
    addStockLot('P1', null, 10, 28000);
    addStockLot('P1', null, 10, 31000);
    const taken = consumeStockLots('P1', null, 12);
    t.check(Array.isArray(taken), 'it returns a list rather than nothing');
    t.check(JSON.stringify(taken) === JSON.stringify([{ qty: 10, cost: 28000 }, { qty: 2, cost: 31000 }]),
      `spanning as many lots as the sale crossed (${JSON.stringify(taken)})`);
    t.check(JSON.stringify(lots()) === JSON.stringify([{ qty: 8, cost: 31000 }]),
      'and what is left is what is left');
    t.check(getFIFOUnitCost('P1', null) === 31000, 'costing out at the oldest remaining lot');

    t.check(JSON.stringify(consumeStockLots('P1', null, 0)) === '[]', 'consuming nothing takes nothing');
    reset();
    t.check(JSON.stringify(consumeStockLots('P1', null, 5)) === '[]', 'and consuming from an empty item does not throw');
  }

  /* ---------- 2. a reversal puts the same units back, in order ------ */
  {
    reset();
    addStockLot('P1', null, 10, 28000);
    addStockLot('P1', null, 10, 31000);
    const taken = consumeStockLots('P1', null, 12);
    restoreStockLots('P1', null, taken);
    t.check(JSON.stringify(lots()) === JSON.stringify([{ qty: 10, cost: 28000 }, { qty: 2, cost: 31000 }, { qty: 8, cost: 31000 }]),
      `restored at the FRONT, oldest first (${JSON.stringify(lots())})`);
    t.check(getFIFOUnitCost('P1', null) === 28000,
      'so the oldest cost leads again -- appending would have left 31,000 costing out ahead of 28,000');
    const total = lots().reduce((s, l) => s + l.qty, 0);
    t.check(total === 20, `and nothing is created or lost (${total} of 20)`);
  }

  /* ---------- 3. the case that destroyed the cost ------------------- */
  /*
   * The whole reason this matters: a sale that clears the last of an item.
   * Before, the item came back with a null-cost lot and its cost basis was
   * simply gone.
   */
  {
    reset();
    addStockLot('P1', null, 10, 28000);
    const taken = consumeStockLots('P1', null, 10);
    t.check(lots().length === 0 && getFIFOUnitCost('P1', null) === null,
      'selling the last of it leaves no lots and no cost, which is correct while it is gone');
    restoreStockLots('P1', null, taken);
    t.check(getFIFOUnitCost('P1', null) === 28000,
      'and undoing that sale gets the cost back -- it used to come back as null forever');
    t.check(JSON.stringify(lots()) === JSON.stringify([{ qty: 10, cost: 28000 }]), 'as the original lot');
  }

  /* ---------- 4. restore refuses what it cannot use ----------------- */
  /*
   * It reports false so applyStockDelta can fall back to adding a plain
   * lot. An order invoiced before lots were recorded has nothing to
   * restore, and must still return its stock rather than silently adding
   * quantity with no lot behind it.
   */
  {
    reset();
    t.check(restoreStockLots('P1', null, undefined) === false, 'nothing to restore reports false');
    t.check(restoreStockLots('P1', null, []) === false, 'an empty list too');
    t.check(restoreStockLots('P1', null, [{ qty: 0, cost: 5 }]) === false, 'and a list of zero-quantity lots');
    t.check(lots().length === 0, 'none of which touched the ladder');

    t.check(restoreStockLots('P1', null, [{ qty: 4, cost: null }]) === true,
      'a lot that genuinely had no cost is still restorable -- a stock-count correction makes those');
    t.check(JSON.stringify(lots()) === JSON.stringify([{ qty: 4, cost: null }]), 'and keeps its null');
    t.check(getFIFOUnitCost('P1', null) === null, 'contributing no cost, which is honest rather than a guess');
  }
}

/* ---------- 5. the wiring ------------------------------------------- */
{
  t.check(/const taken = consumeStockLots\(productId, variantIdx, -actualChange\);\s*\n\s*if\(opts && typeof opts\.onConsumed === 'function'\) opts\.onConsumed\(taken\);/.test(code),
    'a decrease reports the lots it consumed');
  t.check(/if\(!\(opts && restoreStockLots\(productId, variantIdx, opts\.restoreLots\)\)\)\{\s*\n\s*addStockLot\(productId, variantIdx, actualChange, cost\);/.test(code),
    'an increase restores them when it has them, and adds a plain lot when it does not');

  t.check(/onConsumed: lots => \{ it\._stockLots = lots; \}/.test(code),
    'a sale remembers them against the line it came from');
  t.check(/\{ restoreLots: it\._stockLots \}/.test(code), 'and un-invoicing hands them back');
  t.check(/delete it\._stockTaken;\s*\n\s*delete it\._stockLots;/.test(code),
    'clearing both afterwards, so a second reversal cannot restore the same units twice');

  // The paths that must NOT have changed.
  t.check(/applyStockDelta\(invProductId, invVariantIdx, q, 'restock', note, price, invPurchaseSupplierId\);/.test(code),
    'a restock still passes its purchase price and no opts');
  t.check(/applyStockDelta\(invProductId, invVariantIdx, d, 'correction', note\);/.test(code),
    'and a stock-count correction still passes neither');
}

process.exit(t.done() ? 1 : 0);
