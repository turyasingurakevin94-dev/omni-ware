#!/usr/bin/env node
'use strict';
/*
 * A price paid teaches the price book, at the quantity it was paid at.
 *
 * Editing Buy @ on a quote line means the supplier's price has moved, and
 * the price book learns it rather than making somebody retype it in
 * Compare Prices. The catch is that a price is only ever observed at a
 * quantity: the same supplier sells cement at 34,000 for one bag and
 * 32,500 for ten, and "we paid 32,000" is a different fact depending on
 * which of those it replaces.
 *
 * syncPriceRegistryFromPurchase took no quantity at all. It wrote to the
 * LOWEST tier on the side it picked, so negotiating 32,000 a bag on fifty
 * bags rewrote the SINGLE-bag price to 32,000 -- and every later one-bag
 * quote came out at a bulk rate nobody had been offered, with the price
 * book quietly reporting the shop's costs as lower than they were.
 *
 * It also chose the side with `wholesale != null ? wholesale : retail`,
 * which is not how a price is read: purchasePriceAtQty reads a row with no
 * pack break from RETAIL whatever wholesale holds. So on those rows the
 * edit landed in a field nothing was looking at, and the quote appeared to
 * ignore what had just been typed into it.
 *
 * The rule here: the write lands in the slot the read came out of. Anything
 * else and a figure typed into a quote goes somewhere the quote will not
 * find it again.
 *
 * Run: node test/admin-price-writeback.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('admin price write-back');
const src = read('index.html');

const data = { prices: [] };
const scope = compileScope([
  extractFunction(src, 'tiersForKind', 'index.html'),
  extractFunction(src, 'tieredUnitPrice', 'index.html'),
  extractFunction(src, 'purchasePriceAtQty', 'index.html'),
  extractFunction(src, 'deriveWholesaleRetail', 'index.html'),
  extractFunction(src, 'purchasePriceSlotAtQty', 'index.html'),
  extractFunction(src, 'syncPriceRegistryFromPurchase', 'index.html'),
], { data, todayISO: () => '2026-08-03' },
['purchasePriceAtQty', 'purchasePriceSlotAtQty', 'syncPriceRegistryFromPurchase', 'tiersForKind']);

// Roto sells cement at 34,000 a bag, or 32,500 once you take ten.
const tiered = () => {
  data.prices = [{
    id: 1, productId: 'P1', variantIdx: null, supplierId: 'S1',
    wholesale: null, retail: 34000, packQty: 0,
    tiers: [{ minQty: 1, price: 34000 }, { minQty: 10, price: 32500 }],
    outOfStock: false,
  }];
  return data.prices[0];
};
// A supplier with a pack break: singles at 3,000, a carton of 12 at 2,600.
const packed = () => {
  data.prices = [{
    id: 1, productId: 'P1', variantIdx: null, supplierId: 'S1',
    wholesale: 2600, retail: 3000, packQty: 12, tiers: [], outOfStock: false,
  }];
  return data.prices[0];
};
// The simplest row there is: one price, no tiers, no pack.
const flat = () => {
  data.prices = [{
    id: 1, productId: 'P1', variantIdx: null, supplierId: 'S1',
    wholesale: null, retail: 34000, packQty: 0, tiers: [], outOfStock: false,
  }];
  return data.prices[0];
};
const sync = (price, qty) => scope.syncPriceRegistryFromPurchase('P1', null, 'S1', price, qty);

/* ---------- 1. the bug, in the words it was reported in --------------- */
{
  const row = tiered();
  // Fifty bags, negotiated down from 32,500 to 32,000.
  sync(32000, 50);

  t.check(scope.purchasePriceAtQty(row, 50) === 32000,
    'the price agreed for fifty is what fifty now costs');
  t.check(scope.purchasePriceAtQty(row, 1) === 34000,
    `one bag still costs 34,000 (got ${scope.purchasePriceAtQty(row, 1)}) -- a lorry-load price is not a single-bag price`);
  t.check(row.tiers.find(x => x.minQty === 1).price === 34000,
    'the single-unit tier is untouched');
  t.check(row.tiers.find(x => x.minQty === 10).price === 32000,
    'and the tier that actually applied at fifty is the one that moved');
  t.check(row.tiers.length === 2, 'no extra tier is invented for the quantity that happened to be bought');
}

/* ---------- 2. and the other way round -------------------------------- */
{
  const row = tiered();
  // One bag, and they wanted 35,000 for it.
  sync(35000, 1);

  t.check(scope.purchasePriceAtQty(row, 1) === 35000, 'a single-bag price corrects the single-bag tier');
  t.check(scope.purchasePriceAtQty(row, 10) === 32500,
    `and leaves the bulk rate alone (got ${scope.purchasePriceAtQty(row, 10)})`);
  t.check(row.retail === 35000,
    'the flat field follows, because it IS the lowest tier on that side (deriveWholesaleRetail)');
}

/* ---------- 3. a bulk edit does not become the headline price --------- */
{
  const row = tiered();
  const before = row.retail;
  sync(32000, 50);
  t.check(row.retail === before,
    `the row's headline price is unchanged by a bulk purchase (${row.retail} vs ${before}) -- it mirrors the lowest tier, and that tier did not move`);
}

/* ---------- 4. the side is chosen the way the price is READ ----------- */
{
  // packQty 12, so twelve or more reads wholesale and fewer reads retail.
  let row = packed();
  sync(2500, 24);
  t.check(row.wholesale === 2500 && row.retail === 3000,
    `a pack-quantity purchase corrects the pack price (w ${row.wholesale} / r ${row.retail})`);

  row = packed();
  sync(3200, 3);
  t.check(row.retail === 3200 && row.wholesale === 2600,
    `a singles purchase corrects the singles price (w ${row.wholesale} / r ${row.retail})`);

  // The old rule picked wholesale whenever it was set. On a row with NO
  // pack break the price is read from retail, so that wrote to a field
  // nothing reads -- the edit vanished from the quote that made it.
  row = flat();
  row.wholesale = 30000;               // present, and not what gets read
  t.check(scope.purchasePriceAtQty(row, 5) === 34000, 'with no pack break the price is read from retail');
  sync(33000, 5);
  t.check(scope.purchasePriceAtQty(row, 5) === 33000,
    `so editing it changes what the next quote reads (got ${scope.purchasePriceAtQty(row, 5)})`);
  t.check(row.retail === 33000, 'by correcting retail, the field that was actually read');
  t.check(row.tiers.length === 0,
    'and a row with no volume breaks gains none -- inventing one would assert a discount the supplier never quoted');
}

/* ---------- 5. the write always lands where the read came from -------- */
{
  // The property the whole file exists for, over every shape and quantity:
  // set a price at a quantity, read it back at that quantity, get it.
  const shapes = [
    ['tiered', tiered], ['pack break', packed], ['flat', flat],
    ['tiers above the pack break', () => {
      data.prices = [{ id: 1, productId: 'P1', variantIdx: null, supplierId: 'S1',
        wholesale: 2600, retail: 3000, packQty: 12,
        tiers: [{ minQty: 12, price: 2600 }, { minQty: 60, price: 2400 }], outOfStock: false }];
      return data.prices[0];
    }],
  ];
  let bad = 0;
  shapes.forEach(([name, make]) => {
    [1, 2, 9, 10, 11, 12, 13, 50, 60, 100].forEach((qty) => {
      const row = make();
      const target = 9999;
      scope.syncPriceRegistryFromPurchase('P1', null, 'S1', target, qty);
      const got = scope.purchasePriceAtQty(row, qty);
      if (Number(got) !== target) {
        bad++;
        t.fail(`${name} @ qty ${qty}: wrote ${target}, reads back ${got}`);
      }
    });
  });
  if (!bad) t.pass('a price written at a quantity reads back at that quantity, over every row shape (40 cases)');
}

/* ---------- 6. what it must not touch --------------------------------- */
{
  let row = tiered();
  sync(32500, 10);
  t.check(row.date === undefined,
    'a price that has not changed is not restamped, so the book does not claim it was checked today');

  row = tiered();
  row.outOfStock = true;
  sync(32500, 10);
  t.check(row.outOfStock === false,
    'but buying from them is proof they have it, so a stale out-of-stock flag clears either way');

  row = tiered();
  sync(32000, 50);
  t.check(row.date === '2026-08-03' && row.priceSource === 'purchase',
    'a real change is dated and says where it came from');

  // Our own shelf is not a supplier. Given a row keyed on the sentinel --
  // which nothing should create, and the guard is what makes sure it could
  // never matter -- a stock line still writes nothing.
  row = tiered();
  data.prices.push({ id: 2, productId: 'P1', variantIdx: null, supplierId: '__stock__',
    wholesale: null, retail: 20000, packQty: 0, tiers: [], outOfStock: false });
  scope.syncPriceRegistryFromPurchase('P1', null, '__stock__', 5, 10);
  t.check(data.prices[1].retail === 20000 && data.prices[1].priceSource === undefined,
    'a stock line writes nothing to the price book, whatever rows happen to exist');
  t.check(row.tiers[1].price === 32500, 'and leaves the real supplier rows alone');
  row = tiered();
  scope.syncPriceRegistryFromPurchase('P1', null, 'S1', null, 10);
  t.check(row.tiers[1].price === 32500, 'and neither does a blank price');
  scope.syncPriceRegistryFromPurchase('P9', null, 'S1', 1, 10);
  t.check(data.prices.length === 1, 'a supplier with no row for this product is left alone rather than invented');
}

/* ---------- 7. both callers say at what quantity ---------------------- */
{
  const code = src.split(/\r?\n/).map(l => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');
  const calls = [...code.matchAll(/syncPriceRegistryFromPurchase\(([^;]*?)\);/g)].map(m => m[1]);
  t.check(calls.length === 2, `both call sites are accounted for (found ${calls.length})`);
  t.check(calls.every((c) => c.split(',').length === 5),
    'each one passes a quantity, or the price it records is a fact with the quantity torn off');
  t.check(calls.some((c) => /item\.qty/.test(c)), "the quote line passes that line's quantity");
  t.check(calls.some((c) => /,\s*q$/.test(c.trim())), 'and the restock passes what was actually bought');

  // The quote's own qty handler has to resolve prices the same way, or an
  // edit lands in one tier while a quantity change reads another.
  t.check(/const oldTierPrice = Math\.round\(purchasePriceAtQty\(priceRow, oldQty\)\);/.test(code),
    'the quantity handler follows tiers through purchasePriceAtQty, the same resolution the write-back inverts');
  t.check(!/priceRow\.wholesale!=null \? 'wholesale' : 'retail'/.test(code),
    'and nothing picks the side by hand any more');
}

process.exit(t.done() ? 1 : 0);
