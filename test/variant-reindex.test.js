#!/usr/bin/env node
'use strict';
/*
 * What happens to prices and stock when a product's variants are
 * renumbered.
 *
 * Variants have no ids. Everything hangs off their POSITION: a price row
 * stores variantIdx, and stock, its FIFO cost lots and its log are all
 * keyed "P123::2". So a variant list is not an append-only thing --
 * adding one value can renumber the ones already there.
 *
 *   Size: Medium, Small        ->  Medium=0, Small=1
 *   add Large at the front     ->  Large=0, Medium=1, Small=2
 *
 * Everything that pointed at 1 now means Medium instead of Small. Prices
 * were already remapped by matching the variant's own combo. Stock was
 * not: the 40 Small on the shelf became 40 Medium, silently, and in the
 * direction that matters -- the count is now wrong about the thing that
 * actually walks out of the shop.
 *
 * A variant that disappears takes its stock with it, because there is
 * nothing left for that stock to be. That is allowed and it is reported;
 * it is not allowed to be quiet.
 *
 * Run: node test/variant-reindex.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('variant reindex');
const src = read('index.html');
const code = src.split(/\r?\n/).map((l) => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');

const store = { stock: {}, stockLots: {}, stockLog: [] };
const scope = compileScope([
  extractFunction(src, 'stockKey', 'index.html'),
  extractFunction(src, 'variantRemovalIndexMap', 'index.html'),
  extractFunction(src, 'remapVariantStock', 'index.html'),
], { data: store }, ['stockKey', 'variantRemovalIndexMap', 'remapVariantStock']);

const eqJ = (got, want, msg) => t.check(JSON.stringify(got) === JSON.stringify(want),
  `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);
const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);

const seed = () => {
  /* P12 is here on purpose: its keys begin with "P1", so a product match
     done by prefix rather than by the whole id would renumber another
     product's shelf along with this one. */
  store.stock = { 'P1::0': 5, 'P1::1': 40, 'P9::1': 7, P2: 12, 'P12::1': 99 };
  store.stockLots = { 'P1::1': [{ qty: 40, cost: 900 }] };
  store.stockLog = [
    { id: 1, productId: 'P1', variantIdx: 1, key: 'P1::1', delta: 40 },
    { id: 2, productId: 'P9', variantIdx: 1, key: 'P9::1', delta: 7 },
    { id: 3, productId: 'P1', variantIdx: null, key: 'P1', delta: 1 },
  ];
};

/* ---------- 1. inserting a variant at the front ---------------------- */
/*
 * The reported shape: Medium=0, Small=1, then Large is added and sorts
 * first. Small's 40 must travel from slot 1 to slot 2 rather than staying
 * put and becoming Medium's.
 */
{
  seed();
  // old 0 (Medium) -> 1,  old 1 (Small) -> 2
  const res = scope.remapVariantStock('P1', new Map([[0, 1], [1, 2]]));
  eq(store.stock['P1::2'], 40, 'the count moves to the slot its variant moved to');
  eq(store.stock['P1::1'], 5, 'and the one behind it moves too');
  eq(store.stock['P1::0'], undefined, 'leaving nothing behind on the slot it left');
  eqJ(store.stockLots['P1::2'], [{ qty: 40, cost: 900 }], 'the cost lots go with the count');
  eq(store.stockLots['P1::1'], undefined, 'and do not stay to be read as another variant\'s');
  eq(store.stockLog[0].variantIdx, 2, 'the log stays attached to the variant it describes');
  eq(store.stockLog[0].key, 'P1::2', 'by key as well as by index, since both are read');
  eqJ(res, { droppedQty: 0, droppedVariants: 0 }, 'nothing was lost, and it says so');
}

/* ---------- 2. other products are not touched ------------------------ */
{
  seed();
  scope.remapVariantStock('P1', new Map([[0, 1], [1, 2]]));
  eq(store.stock['P9::1'], 7, 'another product keyed the same way is left alone');
  eq(store.stock['P12::1'], 99,
    'and so is one whose id merely BEGINS with this product\'s — P12 is not P1');
  eq(store.stock.P2, 12, 'and so is a simple product, which has no variant slot at all');
  eq(store.stockLog[1].variantIdx, 1, 'including its log rows');
  eq(store.stockLog[2].variantIdx, null, 'and a log row for the product as a whole');
}

/* ---------- 3. a swap, applied all at once --------------------------- */
/*
 * 0->1 and 1->0 done one at a time would have the first write land on the
 * slot the second is about to be read from, and both counts would end up
 * the same number.
 */
{
  seed();
  scope.remapVariantStock('P1', new Map([[0, 1], [1, 0]]));
  eq(store.stock['P1::0'], 40, 'a straight swap carries both counts across');
  eq(store.stock['P1::1'], 5, 'rather than one overwriting the other');
}

/* ---------- 4. a variant that no longer exists ----------------------- */
{
  seed();
  // Small (old 1) is gone; Medium stays put.
  const res = scope.remapVariantStock('P1', new Map([[0, 0]]));
  eq(store.stock['P1::1'], undefined, 'stock on a removed variant is not left keyed to its old slot');
  eq(store.stock['P1::0'], 5, 'and the surviving variant keeps its own');
  eq(res.droppedQty, 40, 'the quantity that stopped being counted is reported');
  eq(res.droppedVariants, 1, 'along with how many variants it was on');
  eq(store.stockLots['P1::1'], undefined, 'its cost lots go with it');
  /* The log is history and is never rewritten away: what happened,
     happened, even if the variant is gone. */
  eq(store.stockLog[0].key, 'P1::1', 'but its log rows are left as they were, being a record of the past');
}
{
  seed();
  store.stock['P1::1'] = 0;
  const res = scope.remapVariantStock('P1', new Map([[0, 0]]));
  eq(res.droppedQty, 0, 'removing a variant that held nothing reports nothing lost');
  eq(res.droppedVariants, 0, 'and does not claim a variant lost stock when it had none');
}

/* ---------- 4b. where everything lands when one is removed ------------ */
/*
 * Deleting the middle of three has to pull the third down onto the
 * second's slot and leave the first alone. Getting the direction backwards
 * moves the wrong half of the list; mapping the removed one anywhere at
 * all keeps its stock alive on a variant that no longer exists.
 */
{
  const m = scope.variantRemovalIndexMap(3, 1);   // Medium, [Small], Large
  eq(m.get(0), 0, 'a variant before the removed one does not move');
  eq(m.get(2), 1, 'and every one after it comes down a slot');
  eq(m.has(1), false, 'the removed one maps nowhere, which is what drops its stock');
  eq(m.size, 2, 'leaving exactly the survivors');

  const first = scope.variantRemovalIndexMap(3, 0);
  eqJ([first.get(1), first.get(2)], [0, 1], 'removing the first pulls both of the others down');
  const last = scope.variantRemovalIndexMap(3, 2);
  eqJ([last.get(0), last.get(1)], [0, 1], 'removing the last moves nobody');
  eq(scope.variantRemovalIndexMap(1, 0).size, 0, 'and removing the only one leaves nothing to move');
}
{
  // End to end: the map and the remap together, on the middle variant.
  seed();
  store.stock = { 'P1::0': 5, 'P1::1': 40, 'P1::2': 8 };
  const res = scope.remapVariantStock('P1', scope.variantRemovalIndexMap(3, 1));
  eq(store.stock['P1::0'], 5, 'the variant before the removed one keeps its count');
  eq(store.stock['P1::1'], 8, 'the one after it takes the freed slot, with its own count');
  eq(store.stock['P1::2'], undefined, 'and nothing is left on the end');
  eq(res.droppedQty, 40, 'the removed variant\'s stock is reported as no longer counted');
}

/* ---------- 5. wired into both paths that renumber -------------------- */
{
  const save = /getElementById\('p_save'\)\.addEventListener\('click', \(\)=>\{([\s\S]*?)\n\}\);/.exec(src);
  const body = save ? save[1] : '';
  t.check(!!save, 'the product save handler is there to check');
  t.check(/stockMoved = remapVariantStock\(id, oldToNew\);/.test(body),
    'saving a product with changed variants moves its stock too, not only its prices');
  t.check(/const newIdx = newIndexBySig\[JSON\.stringify\(v\.combo\)\];\s*\r?\n\s*if\(newIdx!==undefined\) oldToNew\.set\(i, newIdx\);/.test(body),
    'and works out where each variant went by matching its combo, exactly as the prices do');
  t.check(/in stock was on \$\{stockMoved\.droppedVariants\} variant/.test(body),
    'stock left with no variant to belong to is reported rather than quietly dropped');

  const del = extractFunction(src, 'deleteVariant', 'index.html');
  t.check(/remapVariantStock\(productId, variantRemovalIndexMap\(p\.variants\.length \+ 1, variantIdx\)\);/.test(del),
    'deleting a variant shifts the remaining stock down, as it already shifted the prices');
  t.check(/const stockHere = getStockQty\(productId, variantIdx\);/.test(del)
    && /will no longer be counted/.test(del),
    'and says how much stock is about to stop being counted BEFORE asking to confirm');
}

process.exit(t.done() ? 1 : 0);
