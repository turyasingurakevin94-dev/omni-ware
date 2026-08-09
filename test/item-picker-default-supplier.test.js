#!/usr/bin/env node
'use strict';
/*
 * The supplier the item picker ticks must be the one it labels BEST.
 *
 * Reported on a real line. Asking for 1 dozen of WISEUP Tape Measure
 * 3M/Plastic, the picker drew Annet Lak with the BEST badge and ticked
 * the radio against Shafik Katwe:
 *
 *   Annet Lak      retail 26,000/dozen, no wholesale price on file
 *   Shafik Katwe   wholesale 28,000/dozen, no retail price on file
 *
 * Two rankings, one question. The CARDS rank by what the quantity would
 * actually cost (rankedPurchaseRowsAtQty) -- 26,000 beats 28,000, so
 * Annet is BEST. The DEFAULT SELECTION took staticRanked[0], and
 * staticRanked is rankedPriceRows(), which sorts on the wholesale column
 * and treats "no wholesale price on file" as infinitely expensive. Annet
 * was buried for having no wholesale figure rather than for being dear,
 * and the picker pre-selected the more expensive supplier.
 *
 * Accepting that default paid 2,000/dozen over the odds. It also cost
 * margin twice: Shafik has no retail price, so the recommended price
 * fell back to the wholesale rate on a retail-sized order -- same 29,000
 * to the customer, 1,000 of margin instead of 3,000.
 *
 * Run: node test/item-picker-default-supplier.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('item picker default supplier');
const src = read('index.html');
const stage = extractFunction(src, 'renderIpStage', 'index.html');

/* ---------- 1. the two rankings, and which one is right -------------- */
/*
 * Run rather than read: the whole bug is that two orderings answered one
 * question differently, and only running both shows they disagree.
 */
{
  const NAMES = ['tiersForKind', 'tieredUnitPrice', 'purchasePriceAtQty', 'rankedPurchaseRowsAtQty'];
  // The real shape from the report: one supplier priced only by the
  // carton, one priced only loose, and the loose one cheaper per dozen.
  const ROWS = [
    { supplierId: 'S096', sname: 'Shafik Katwe', wholesale: 28000, retail: null, packQty: 10, packUnit: 'Ctn', unit: 'Dozen', tiers: [] },
    { supplierId: 'S038', sname: 'Annet Lak', wholesale: null, retail: 26000, packQty: 10, packUnit: 'Ctn', unit: 'Dozen', tiers: [] },
    /* A price entry carrying a supplier and packing but no figures at
       all -- reachable by saving one before the prices are known. It
       must rank LAST: an unpriced row costs nothing to compare against,
       and treating "no price" as a low price would recommend the one
       supplier whose price nobody has asked yet. */
    { supplierId: 'S999', sname: 'Not priced yet', wholesale: null, retail: null, packQty: 10, packUnit: 'Ctn', unit: 'Dozen', tiers: [] },
  ];
  let scope = null, err = null;
  try {
    scope = compileScope(
      NAMES.map((n) => extractFunction(src, n, 'index.html')),
      { rankedPriceRows: () => ROWS.map((r) => ({ ...r })) },
      NAMES,
    );
  } catch (e) { err = e; }
  t.check(!!scope, `the ranking helpers compile${err ? ` (${err.message})` : ''}`);

  if (scope) {
    const order = (qty) => scope.rankedPurchaseRowsAtQty('P171', 0, qty).map((r) => r.sname);
    const pays = (qty) => scope.rankedPurchaseRowsAtQty('P171', 0, qty)
      .map((r) => `${r.sname} ${r.purchasePrice}`);

    t.check(scope.purchasePriceAtQty(ROWS[1], 1) === 26000,
      `one dozen from the loose-priced supplier costs its loose rate (${scope.purchasePriceAtQty(ROWS[1], 1)})`);
    /* No retail price at all, so the carton rate is what it would cost --
       not "unavailable", and certainly not free. */
    t.check(scope.purchasePriceAtQty(ROWS[0], 1) === 28000,
      `and from the carton-priced one, the only rate it has (${scope.purchasePriceAtQty(ROWS[0], 1)})`);

    t.check(scope.purchasePriceAtQty(ROWS[2], 1) === null,
      'a row with no figures at all prices to nothing rather than to a number');

    // Cheaper at every quantity here, neither having a volume tier -- so
    // this was never a case of the ranking being right for big orders.
    [1, 5, 9, 10, 20, 100].forEach((q) => {
      t.check(order(q)[0] === 'Annet Lak', `the cheaper supplier ranks first at ${q} (${pays(q).join(', ')})`);
      t.check(order(q)[order(q).length - 1] === 'Not priced yet',
        `and the one with no price on file ranks last at ${q}, not first`);
    });

    /* The ordering the default USED to come from, reproduced: sort on
       the wholesale column with a missing price as Infinity. It puts the
       dearer supplier first, which is the bug. */
    const byWholesaleColumn = ROWS.slice().sort((a, b) =>
      (a.wholesale != null ? a.wholesale : Infinity) - (b.wholesale != null ? b.wholesale : Infinity));
    t.check(byWholesaleColumn[0].sname === 'Shafik Katwe',
      'the old wholesale-column ordering really does put the dearer supplier first');
    t.check(byWholesaleColumn[0].sname !== order(1)[0],
      'so the two orderings genuinely disagree, which is what put the badge and the tick on different cards');
  }
}

/* ---------- 2. a volume tier still moves the answer ------------------ */
/*
 * The ranking is quantity-aware on purpose: a supplier who is dearer
 * loose and cheaper by the carton must win once the carton is reached,
 * and the tick has to follow the badge there too.
 */
{
  const NAMES = ['tiersForKind', 'tieredUnitPrice', 'purchasePriceAtQty', 'rankedPurchaseRowsAtQty'];
  const ROWS = [
    { supplierId: 'A', sname: 'Cheap loose', wholesale: 9000, retail: 5000, packQty: 12, packUnit: 'Ctn', unit: 'pc', tiers: [] },
    { supplierId: 'B', sname: 'Cheap by the carton', wholesale: 4000, retail: 6000, packQty: 12, packUnit: 'Ctn', unit: 'pc', tiers: [] },
  ];
  const scope = compileScope(
    NAMES.map((n) => extractFunction(src, n, 'index.html')),
    { rankedPriceRows: () => ROWS.map((r) => ({ ...r })) },
    NAMES,
  );
  const firstAt = (q) => scope.rankedPurchaseRowsAtQty('X', null, q)[0].sname;
  t.check(firstAt(1) === 'Cheap loose', `buying one, the loose price wins (${firstAt(1)})`);
  t.check(firstAt(11) === 'Cheap loose', 'still one short of a full carton');
  t.check(firstAt(12) === 'Cheap by the carton', `a full carton flips it (${firstAt(12)})`);
  t.check(firstAt(50) === 'Cheap by the carton', 'and everything above');
}

/* ---------- 3. the default is taken from the cards' own ranking ------ */
{
  t.check(/const ranked = rankedPurchaseRowsAtQty\(ipProductId, variantIdx, qty\);/.test(stage),
    'the cards are ranked by what the typed quantity would cost');
  t.check(/const top3 = ranked\.slice\(0, 3\);/.test(stage),
    'and the BEST badge is the first of that ranking');
  t.check(/ipSelectedSupplierId = stockQty>0 \? '__stock__' : \(ranked\[0\] \? ranked\[0\]\.supplierId : null\);/.test(stage),
    'so the default tick is taken from the same list, not from a second one');
  t.check(!/ipSelectedSupplierId = stockQty>0 \? '__stock__' : \(staticRanked\[0\]/.test(stage),
    'the wholesale-column ordering no longer decides who is pre-selected');

  /* Order matters as much as the source: the quantity may be typed in
     cartons, so it cannot be read until packing is known, and `ranked`
     cannot exist until the quantity does. Deciding the default before
     that is what forced it onto the quantity-blind list in the first
     place. */
  const iRanked = stage.indexOf('const ranked = rankedPurchaseRowsAtQty');
  const iDefault = stage.indexOf("ipSelectedSupplierId = stockQty>0 ? '__stock__'");
  t.check(iRanked > -1 && iDefault > iRanked,
    'and it is decided after there is a quantity to judge it by');
  const iNeeds = stage.indexOf('const needsDefaultSupplier =');
  t.check(iNeeds > -1 && iNeeds < iRanked,
    'while WHETHER one is needed is still settled up front, before anything is chosen');
}

/* ---------- 4. what must not have changed ---------------------------- */
{
  /* A supplier picked by hand has to survive every re-render -- the
     price-card clicks, the quantity edits -- or choosing one would be
     undone by the next keystroke. */
  t.check(/const needsDefaultSupplier = !ipSelectedSupplierId\s*\n\s*\|\| \(ipSelectedSupplierId!=='__stock__' && !staticRanked\.some\(r=>r\.supplierId===ipSelectedSupplierId\)\);/.test(stage),
    'a default is only ever applied when nothing is currently selected');
  t.check(/if\(needsDefaultSupplier\)\{/.test(stage),
    'and the assignment is behind that guard, not run on every render');

  /* Selling off the shelf is recorded against stock, not against
     whoever would be cheapest to buy from -- the ranking only decides
     who to buy from when there is nothing on the shelf. */
  t.check(/stockQty>0 \? '__stock__' :/.test(stage),
    'stock on hand still wins over every supplier');

  // Packing is a property of the item, so it can still be read from the
  // flat list before any quantity exists.
  t.check(/const contextRow = staticRanked\.find\(r=>r\.supplierId===ipSelectedSupplierId\) \|\| staticRanked\[0\] \|\| null;/.test(stage),
    'packing context still comes from the flat list, which needs no quantity');
  t.check(/const qty = ipComputeQty\(ipQtyRaw, ipQtyUnitMode, packQty\);/.test(stage),
    'and the quantity is still read through it, so it can be typed in cartons');
}

/* ---------- 5. the badge and the tick are drawn from one list -------- */
{
  /* Structural, because this is the invariant the bug broke: the card
     wearing BEST and the card carrying the checked radio are the same
     card only while both come from `top3` and `ipSelectedSupplierId` is
     seeded from the head of the list `top3` was sliced from. */
  t.check(/const cardsHtml = top3\.map\(\(r,i\)=>\{/.test(stage),
    'the cards are drawn from the ranked list');
  t.check(/const sel = r\.supplierId===ipSelectedSupplierId;/.test(stage),
    'each card is ticked by comparing against the selection');
  t.check(/\$\{i===0\?'best':''\}/.test(stage) && /rankLabels\[i\]/.test(stage),
    'and badged by its position in that same list');
}

process.exit(t.done() ? 1 : 0);
