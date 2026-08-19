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
const told = [];
const scope = compileScope([
  extractFunction(src, 'tiersForKind', 'index.html'),
  extractFunction(src, 'tieredUnitPrice', 'index.html'),
  extractFunction(src, 'purchasePriceAtQty', 'index.html'),
  extractFunction(src, 'deriveWholesaleRetail', 'index.html'),
  extractFunction(src, 'purchasePriceSlotAtQty', 'index.html'),
  extractFunction(src, 'purchasePricePoints', 'index.html'),
  extractFunction(src, 'cheaperSmallerQuantity', 'index.html'),
  extractFunction(src, 'syncPriceRegistryFromPurchase', 'index.html'),
], {
  data,
  todayISO: () => '2026-08-03',
  toast: (m) => { told.push(String(m)); },
  fmtUGX: (n) => Number(n || 0).toLocaleString('en-US'),
}, ['purchasePriceAtQty', 'purchasePriceSlotAtQty', 'syncPriceRegistryFromPurchase',
  'tiersForKind', 'purchasePricePoints', 'cheaperSmallerQuantity']);

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
const sync = (price, qty) => {
  told.length = 0;
  return scope.syncPriceRegistryFromPurchase('P1', null, 'S1', price, qty);
};
// The same write, told that money actually moved -- goods received, or a
// restock booked. See section 6 for why that changes one thing only.
const bought = (price, qty) => {
  told.length = 0;
  return scope.syncPriceRegistryFromPurchase('P1', null, 'S1', price, qty, {confirms: true});
};
const warned = () => told.some((m) => /Buying more now costs more each/.test(m));

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

  /* Unless money moved. The claim above is aimed at the QUOTE LINE,
     whose Buy @ arrives pre-filled and whose change event fires whether
     or not the number was touched -- restamping there records a check
     that never happened.

     Goods arriving is not a round-trip. Somebody paid that much, to that
     supplier, today, and buying at exactly the recorded price is the
     strongest confirmation that price can get. Stamping only on a change
     meant the commonest case of all -- a stable item bought at its own
     recorded price -- refreshed nothing, so the row aged towards "stale"
     while the shop was actively trading on it and the review list would
     flag for checking the very prices it had just proved correct. */
  row = tiered();
  bought(32500, 10);
  t.check(row.date === '2026-08-03',
    'but buying at the price on file IS a confirmation of it, and dates the row');
  t.check(row.priceSource === 'purchase', 'recorded as coming from a purchase, because it did');
  t.check(scope.purchasePriceAtQty(row, 10) === 32500,
    'while the figure itself is untouched — nothing changed, so nothing is written');
  t.check(row.tiers.length === 2, 'and no tier is invented for a price that did not move');

  /* A confirmation must not run the WRITE, only the date.

     Told apart on an already-inverted row, because that is the only
     shape where entering the write branch has a visible effect when the
     figure is unchanged: the inversion warning fires. Confirming a price
     you did not touch must not nag you about a shape the row already
     had. Anywhere else the branch would write the same number over
     itself and nothing could tell. */
  data.prices = [{
    id: 1, productId: 'P1', variantIdx: null, supplierId: 'S1',
    wholesale: null, retail: 30000, packQty: 0,
    tiers: [{ minQty: 1, price: 30000 }, { minQty: 10, price: 32500 }],
    outOfStock: false,
  }];
  row = data.prices[0];
  bought(32500, 10);
  t.check(row.date === '2026-08-03', 'the confirmation still dates the row');
  t.check(!warned(),
    `and says nothing about the inversion, because it did not cause it (${JSON.stringify(told)})`);

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

/* ---------- 7. buying more that costs more is said out loud ----------- */
/*
 * Recorded, never blocked. The supplier may genuinely have put the bulk
 * rate up and the person typing knows what they were quoted -- but it is
 * far more often a slip, and this row feeds margins, the cheapest-supplier
 * ranking and the cash-to-buy total, so an inversion nobody notices is
 * expensive and invisible at the same time.
 */
{
  // 35,000 for fifty, against 34,000 already on file for one.
  let row = tiered();
  sync(35000, 50);
  t.check(warned(), `a bulk price above a smaller-quantity price warns (${JSON.stringify(told)})`);
  t.check(scope.purchasePriceAtQty(row, 50) === 35000,
    'and is still saved, because the person typing may be right');
  t.check(/35,000 for 50/.test(told[0]) && /34,000 already on file for 1/.test(told[0]),
    'naming both figures and both quantities, so the contradiction is checkable rather than just asserted');

  // The ordinary case must stay silent, or the warning is noise.
  row = tiered();
  sync(32000, 50);
  t.check(!warned(), `a bulk price BELOW the single price says nothing (${JSON.stringify(told)})`);

  row = tiered();
  sync(35000, 1);
  t.check(!warned(), 'and raising the single-unit price is just a price rise, not an inversion');

  row = tiered();
  sync(32500, 10);
  t.check(told.length === 0, 'a price that did not change warns about nothing at all');

  // Equal is not inverted: a supplier who offers no bulk discount is
  // ordinary, and warning about it would train the warning away.
  row = tiered();
  sync(34000, 50);
  t.check(!warned(), 'matching the smaller-quantity price exactly is not a contradiction');

  // The pack-break shape, where the two sides are different fields.
  row = packed();               // singles 3,000, pack of 12 at 2,600
  sync(3500, 24);
  t.check(warned(), 'the same check holds across a pack break, not just across tiers');
  row = packed();
  sync(2400, 24);
  t.check(!warned(), 'a better pack price stays quiet');

  // A row with nothing smaller on file has nothing to contradict.
  row = flat();
  sync(99000, 50);
  t.check(!warned(), 'a row with a single price point cannot be inverted against itself');

  // A pack break is a price point in its own right even with no tier
  // written at it: on this row the price changes at twelve because that is
  // where wholesale takes over from retail, and the curve has to say so.
  const points = scope.purchasePricePoints(packed()).map((p) => `${p.qty}:${p.price}`);
  t.check(JSON.stringify(points) === '["1:3000","12:2600"]',
    `the pack break is a price point of its own (${JSON.stringify(points)})`);

  // Tiers on both sides of the break, all consistent with
  // deriveWholesaleRetail: singles 3,000, twelve 2,600, sixty 2,400.
  data.prices = [{
    id: 1, productId: 'P1', variantIdx: null, supplierId: 'S1',
    wholesale: 2600, retail: 3000, packQty: 12,
    tiers: [{ minQty: 12, price: 2600 }, { minQty: 60, price: 2400 }], outOfStock: false,
  }];
  row = data.prices[0];
  sync(2700, 100);
  t.check(warned(),
    `2,700 for a hundred is dearer than the 2,600 already on file for twelve (${JSON.stringify(told)})`);
  t.check(/2,600 already on file for 12/.test(told[0] || ''),
    'and it names the cheapest thing the new price undercuts, not merely the nearest');
  t.check(row.wholesale === 2600,
    "while the row's headline pack price is untouched, since the tier that moved was not the lowest");
}

/* ---------- 8. every caller says at what quantity ---------------------
   Five now. Goods arriving joined the two typing paths -- it is the only
   one needing no screen and no memory, and where the shop's best price
   evidence was being thrown away -- and a supplier's quoted reply joined
   them, which is not a purchase at all but resolves a figure into a tier
   slot by exactly the same arithmetic.

   The fifth is a purchase being CORRECTED. It has to write back for the
   same reason the original did: the registry was taught the wrong figure
   by the entry now being fixed, and a book still quoting a price the shop
   has just said it never paid is worse than one that asks again. */
{
  const code = src.split(/\r?\n/).map(l => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');
  const calls = [...code.matchAll(/syncPriceRegistryFromPurchase\(([^;]*?)\);/g)].map(m => m[1]);
  t.check(calls.length === 5, `every call site is accounted for (found ${calls.length})`);
  t.check(calls.every((c) => c.split(',').length >= 5),
    'each one passes a quantity, or the price it records is a fact with the quantity torn off');
  t.check(calls.some((c) => /item\.qty/.test(c)), "the quote line passes that line's quantity");
  t.check(calls.some((c) => /,\s*q,\s*\{confirms: true\}$/.test(c.trim())),
    'the restock passes what was actually bought');
  /* THIS receipt's quantity, not the line's running total. A line that
     came back short and was fetched again is two purchases at two
     prices, kept as two receipts -- and a second small trip is honestly
     priced as a small trip. */
  t.check(calls.some((c) => /it\.receivedPrice,\s*n,\s*\{confirms: true\}/.test(c)),
    'and goods received pass the price actually paid, at the quantity that actually arrived');
  /* The correction passes the CORRECTED pair, not the original one. A
     write-back carrying the figures being thrown away would re-teach the
     registry the very mistake the shop just came here to fix. */
  t.check(calls.some((c) => /newCost,\s*newQty,\s*\{confirms: true\}/.test(c)),
    'and a corrected purchase passes what it turned out to be, not what was first typed');

  /* `confirms` does not mean "money moved" — it means SOMETHING ASSERTED
     THIS PRICE TODAY, so an unchanged figure still earns a fresh date.
     Three do: goods arriving, a restock booked, and a supplier answering
     the question. What kind of assertion it was is carried separately by
     `source`, checked below.

     The quote line is still not one of them, and that is the whole
     distinction: its Buy @ arrives pre-filled and fires a change event
     whether or not the number was touched, so letting it confirm would
     date every price the admin merely scrolled past — and the registry
     would report a book kept current by nobody having looked at it. */
  const confirming = calls.filter((c) => /confirms:\s*true/.test(c));
  t.check(confirming.length === 4,
    `four callers assert a price rather than round-trip a field (found ${confirming.length})`);
  t.check(confirming.every((c) => !/item\.qty/.test(c)),
    'and the quote line is not one of them — a pre-filled field round-tripping is not a confirmation');

  /* Only the TRANSACTIONS are recorded as purchases. A supplier saying
     "still 45,000" is not a sale, and filing it as one would put money in
     the record that never changed hands — and would then count towards
     the month's checked total under the wrong heading.

     A correction is one of them: the goods were bought and the money did
     move, and the corrected figure is what actually changed hands. */
  const asPurchase = confirming.filter((c) => !/source:/.test(c));
  const asConfirmed = confirming.filter((c) => /source: 'confirmed'/.test(c));
  t.check(asPurchase.length === 3, `three of them are purchases (found ${asPurchase.length})`);
  t.check(asConfirmed.length === 1,
    `and the supplier's own word is filed as confirmed, not bought (found ${asConfirmed.length})`);

  // The quote's own qty handler has to resolve prices the same way, or an
  // edit lands in one tier while a quantity change reads another.
  t.check(/const oldTierPrice = Math\.round\(purchasePriceAtQty\(priceRow, oldQty\)\);/.test(code),
    'the quantity handler follows tiers through purchasePriceAtQty, the same resolution the write-back inverts');
  t.check(!/priceRow\.wholesale!=null \? 'wholesale' : 'retail'/.test(code),
    'and nothing picks the side by hand any more');
}

process.exit(t.done() ? 1 : 0);
