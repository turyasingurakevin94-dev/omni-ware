#!/usr/bin/env node
'use strict';
/*
 * The price registry, grouped by what is being priced.
 *
 * It was a flat grid of cards in date order, one per entry. The registry
 * answers exactly one question -- who is cheapest for this product --
 * and that was the one layout which could not answer it: three quotes
 * for cement could land in three different rows of the grid, newest
 * first, with no two prices ever side by side.
 *
 * Grouped now, suppliers underneath, cheapest first.
 *
 * The judgements pinned below:
 *
 *   out of stock cannot   the rest of the app leaves those out of its
 *   be the cheapest       best-supplier recommendations. A registry
 *                         crowning a supplier the buying list will not
 *                         walk to points at the wrong yard.
 *   unpriced sorts last   a null sorting to the top would crown a row
 *                         carrying no figure at all.
 *   a quote ages          ninety days is a judgement, not a rule, and is
 *                         stated on screen. A price from two seasons ago
 *                         must not sit unmarked beside one from this
 *                         week.
 *
 * Run: node test/price-registry-layout.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('price registry layout');
const src = read('index.html');
const code = src.split(/\r?\n/).map((l) => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');
const TODAY = '2026-08-04';

const scope = compileScope([
  extractDeclaration(src, 'PRICE_STALE_DAYS', 'index.html'),
  extractFunction(src, 'priceAgeDays', 'index.html'),
  extractFunction(src, 'priceGroupsFor', 'index.html'),
  extractFunction(src, 'priceRegistryStats', 'index.html'),
], {
  todayISO: () => TODAY,
  // Buying one: the same question the catalogue and the buying list ask.
  purchasePriceAtQty: (row) => (row.retail == null ? row.wholesale : row.retail),
}, ['priceGroupsFor', 'priceRegistryStats', 'priceAgeDays']);

const row = (id, productId, supplierId, wholesale, retail, over) => Object.assign({
  id, productId, variantIdx: null, supplierId, wholesale, retail,
  pname: productId === 'P1' ? 'Cement Hima 50kg' : 'Binding wire',
  category: productId === 'P1' ? 'Cement' : 'Steel',
  date: '2026-08-01', outOfStock: false, unit: 'bag',
}, over);
const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);

/* ---------- 1. cheapest first, whatever order they arrive in --------- */
{
  // Fed dearest-first on purpose: date order is what the flat list used,
  // and it is not price order.
  const groups = scope.priceGroupsFor([
    row(1, 'P1', 'S2', 32500, 39000),
    row(2, 'P1', 'S1', 31000, 38000),
    row(3, 'P1', 'S3', 29500, 36000),
  ]);
  eq(groups.length, 1, 'three quotes for one product make one group');
  eq(groups[0].rows.map((r) => r.supplierId).join(','), 'S3,S1,S2',
    'sorted cheapest to dearest, not by when the quote was taken');
  eq(groups[0].cheapestId, 3, 'and the cheapest is named');
  eq(groups[0].rows.length, 3, 'with none dropped');

  // The spread is what makes the comparison worth making.
  t.check(groups[0].spread && groups[0].spread.low === 36000 && groups[0].spread.high === 39000,
    `the spread between cheapest and dearest is carried (${JSON.stringify(groups[0].spread)})`);
}

/* ---------- 2. out of stock cannot be the cheapest ------------------- */
{
  const groups = scope.priceGroupsFor([
    row(4, 'P2', 'S1', 9000, 11000, { outOfStock: true }),   // cheapest, unavailable
    row(5, 'P2', 'S2', 9500, 11500),
  ]);
  eq(groups[0].cheapestId, 5,
    'the crown goes to the cheapest supplier who actually has it');
  eq(groups[0].rows[0].id, 4,
    'though the out-of-stock row is still listed, and still listed first by price');
  t.check(groups[0].spread === null,
    'and a spread needs two usable quotes, so one in stock gives none');

  // Every quote out of stock: nothing is crowned rather than crowning
  // something that cannot be bought.
  const allOut = scope.priceGroupsFor([
    row(6, 'P2', 'S1', 9000, 11000, { outOfStock: true }),
    row(7, 'P2', 'S2', 9500, 11500, { outOfStock: true }),
  ]);
  t.check(allOut[0].cheapestId === null, 'with none in stock, nothing is crowned');
}

/* ---------- 3. a row with no figure is not the cheapest -------------- */
{
  /* Three rows, with the unpriced one supplied FIRST. Two rows was not
     enough: with a single comparison the unpriced row is only ever the
     right-hand operand, so a comparator that mishandles a null on the
     left still came out in the right order and the mutation survived. */
  const groups = scope.priceGroupsFor([
    row(8, 'P1', 'S1', null, null),
    row(9, 'P1', 'S2', 31000, 38000),
    row(10, 'P1', 'S3', 29500, 36000),
  ]);
  eq(groups[0].cheapestId, 10, 'a row carrying no price cannot be the cheapest');
  eq(groups[0].rows.map((r) => r.id).join(','), '10,9,8',
    'and it sorts last rather than to the top, where a null would have put it');

  /* The same rows, unpriced one LAST. The order quotes arrive in must
     not change the order they are shown in -- and this is not a
     rephrasing of the check above. V8 sorts small arrays by insertion,
     comparing each new element against the sorted prefix, so a row at
     index 0 is only ever the right-hand operand. A comparator that
     mishandles a null on the LEFT is invisible until the null row
     arrives later, which is exactly what this arrangement does. */
  const late = scope.priceGroupsFor([
    row(9, 'P1', 'S2', 31000, 38000),
    row(10, 'P1', 'S3', 29500, 36000),
    row(8, 'P1', 'S1', null, null),
  ]);
  eq(late[0].rows.map((r) => r.id).join(','), '10,9,8',
    'the same order, whichever way round the quotes came in');

  /* Every row unpriced. This is the only shape where "cheapest with a
     figure" and "cheapest of any kind" disagree -- with any priced row
     present the sort already puts it first, so dropping the price check
     from the crown changes nothing and the mutation survived. */
  const noneP = scope.priceGroupsFor([
    row(11, 'P2', 'S1', null, null),
    row(12, 'P2', 'S2', null, null),
  ]);
  t.check(noneP[0].cheapestId === null,
    'and where nothing is priced at all, nothing is crowned rather than the first row by default');
}

/* ---------- 4. groups, and how they are ordered ---------------------- */
{
  const groups = scope.priceGroupsFor([
    row(1, 'P1', 'S1', 31000, 38000),
    row(2, 'P2', 'S1', 9000, 11000),
    row(3, 'P1', 'S2', 32500, 39000),
  ]);
  eq(groups.length, 2, 'two products make two groups');
  eq(groups.map((g) => g.pname).join(' | '), 'Binding wire | Cement Hima 50kg',
    'listed by name, so the same product is always in the same place');
  eq(groups.find((g) => g.pname === 'Cement Hima 50kg').rows.length, 2,
    'and each carries its own quotes');
}

/* ---------- 5. a quote ages ------------------------------------------ */
{
  eq(scope.priceAgeDays('2026-08-01'), 3, 'age is counted in days from today');
  eq(scope.priceAgeDays('2026-08-04'), 0, "today's quote is nought days old");
  t.check(scope.priceAgeDays('') === null, 'a missing date has no age rather than an age of zero');
  t.check(scope.priceAgeDays('not-a-date') === null, 'and nor does an unparseable one');

  const s = scope.priceRegistryStats([
    row(1, 'P1', 'S1', 31000, 38000, { date: '2026-08-01' }),
    row(2, 'P1', 'S2', 32500, 39000, { date: '2026-01-15' }),   // 200-odd days
    row(3, 'P2', 'S3', 9000, 11000, { date: '2026-08-02', outOfStock: true }),
  ]);
  eq(s.entries, 3, 'every quote is counted');
  eq(s.things, 2, 'across two products');
  eq(s.suppliers, 3, 'from three suppliers');
  eq(s.stale, 1, `one is older than ${scope ? '' : ''}the threshold`);
  eq(s.oos, 1, 'and one is out of stock');

  // The threshold is a judgement, so it is a named constant and it is
  // shown on screen rather than being a number only the code knows.
  t.check(/const PRICE_STALE_DAYS = \d+;/.test(code), 'the threshold is named, not scattered');
  t.check(/older than \$\{PRICE_STALE_DAYS\} days/.test(code),
    'and stated on the summary, so a reader can discount it');
}

/* ---------- 6. an empty registry ------------------------------------- */
{
  const s = scope.priceRegistryStats([]);
  eq(s.entries, 0, 'no quotes');
  eq(s.things, 0, 'no products');
  eq(s.stale, 0, 'nothing stale');
  eq(scope.priceGroupsFor([]).length, 0, 'and no groups');
}

/* ---------- 7. the card grid is gone, but not for everyone ----------- */
{
  t.check(!/priceCardHTML/.test(code), 'the registry card builder is gone');
  t.check(/class="reg-group"/.test(code) && /priceGroupHTML/.test(code),
    'replaced by grouped rows');

  /* .price-card and .price-grid are NOT dead with it: the agent
     promotions and the commission claims still build on them. Removing
     them with the registry's card would have quietly broken two other
     screens. */
  t.check(/\.price-grid\{/.test(src) && /\.price-card\{/.test(src),
    'the shared card styles stay');
  t.check(/promotionCardHTML|claimCardHTML/.test(code),
    'because other screens still use them');

  t.check(/\.reg-fig\{[^}]*font-variant-numeric:tabular-nums;/.test(src),
    'the figures are tabular, so two suppliers can be read against each other down the column');

  // Same gap the Presets page had: a summary that only drew at boot.
  t.check(/if\(tab==='prices'\)\{ refreshPriceDropdowns\(\); triggerPricesRender\(\); \}/.test(code),
    'and the tab redraws on entry, since the strip makes a claim about current data');
}

process.exit(t.done() ? 1 : 0);
