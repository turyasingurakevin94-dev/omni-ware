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
  extractDeclaration(src, 'PRICE_AGE_BUCKETS', 'index.html'),
  extractFunction(src, 'priceAgeDays', 'index.html'),
  extractFunction(src, 'priceRowMatchesAge', 'index.html'),
  extractFunction(src, 'priceGroupsFor', 'index.html'),
  extractFunction(src, 'priceRegistryStats', 'index.html'),
], {
  todayISO: () => TODAY,
  // Buying one: the same question the catalogue and the buying list ask.
  purchasePriceAtQty: (row) => (row.retail == null ? row.wholesale : row.retail),
}, ['priceGroupsFor', 'priceRegistryStats', 'priceAgeDays', 'priceRowMatchesAge']);

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

/* ---------- 7. back to cards, without losing the sort ---------------- *
 * The grouped rows were asked to go back to the card the registry had
 * before them. What must NOT go with them is priceGroupsFor: it does the
 * sorting as well as the grouping -- including "undated last whichever
 * way the sort points" -- so rendering the filtered rows straight into
 * cards silently killed the Sort by dropdown.
 */
{
  t.check(/priceCardHTML/.test(code), 'the registry is drawn as cards again');
  t.check(/priceGroupsFor\(rows, sortMode\)\.flatMap\(g=> g\.rows\)/.test(code),
    'through priceGroupsFor, so the chosen sort still applies');
  /* And a product's competing quotes stay consecutive in the grid, which
     is the one thing the grouped layout had that a plain card grid did
     not. Flattening the groups keeps it for free.

     This was one expression until the registry started showing a page of
     twenty-four rather than all 276. The chain is now broken over a
     binding and a slice, so the check is on the ORDER SURVIVING that
     journey rather than on its punctuation: the flattened groups go into
     `ordered`, and the only thing between `ordered` and the cards is the
     page. Anything else inserted there -- a re-sort, a filter, a second
     grouping -- fails this. */
  t.check(/const ordered = priceGroupsFor\(rows, sortMode\)\.flatMap\(g=> g\.rows\);/.test(code),
    'the flattened groups are what gets rendered');
  t.check(/listPageSlice\('prices', ordered\)\.map\(r=> priceCardHTML\(r, tokens\)\)/.test(code),
    'and one product\'s quotes land next to each other rather than scattered by date — nothing but the page sits between grouping and drawing');

  /* .price-card and .price-grid are NOT dead with it: the agent
     promotions and the commission claims still build on them. Removing
     them with the registry's card would have quietly broken two other
     screens. */
  t.check(/\.price-grid\{/.test(src) && /\.price-card\{/.test(src),
    'the shared card styles stay');
  t.check(/promotionCardHTML|claimCardHTML/.test(code),
    'because other screens still use them');

  /* .reg-fig was the grouped row's figure, and those rows -- never
     called after the registry went back to cards -- are gone with the
     rule. The card draws both prices in the layer's .ow-fig. */
  t.check(/\.ow-fig\{[^}]*font-variant-numeric:tabular-nums;/.test(src)
    && /class="ow-fig ow-fig-lg[^"]*"[^>]*>\$\{fmtPriceCompact\(r\.wholesale, r\.unit\)\}/.test(code),
    'the figures are tabular, so two suppliers can be read against each other across the cards');

  // Same gap the Presets page had: a summary that only drew at boot.
  t.check(/if\(tab==='prices'\)\{ refreshPriceDropdowns\(\); triggerPricesRender\(\); \}/.test(code),
    'and the tab redraws on entry, since the strip makes a claim about current data');
}

/* ---------- 8. finding what has gone unrepriced ---------------------- */
{
  const q = (date) => row(1, 'P1', 'S1', 100, 100, { date });
  const on = (date, f) => scope.priceRowMatchesAge(q(date), f);

  eq(on('2026-05-01', '90'), true, 'a quote from three months back is over 90 days old');
  eq(on('2026-07-20', '90'), false, 'one from a fortnight ago is not');
  // The boundary, stated rather than left to be discovered: "over 90"
  // means 91 and up. A quote taken exactly ninety days ago is not yet
  // over ninety days old.
  eq(scope.priceAgeDays('2026-05-06'), 90, 'this date is exactly 90 days old');
  eq(on('2026-05-06', '90'), false, 'and exactly 90 is not OVER 90');
  eq(on('2026-05-05', '90'), true, 'one day older is');
  eq(on('2026-05-06', '89'), true, 'and 90 days is over 89');
  eq(on('', ''), true, 'no filter lets everything through');

  /* Undated is its own bucket, not the far end of "old". A quote with no
     date is not ancient -- nobody knows how old it is -- and sweeping it
     into "over a year" would report a certainty the record cannot
     support. It is also the only bucket that can be acted on at once:
     put a date on it. */
  eq(on('', 'undated'), true, 'an undated quote is found by asking for undated ones');
  eq(on('2026-05-01', 'undated'), false, 'and a dated one is not');
  eq(on('', '365'), false,
    'an undated quote is NOT "over a year old" — it has no age to be over anything');

  // Every option the dropdown offers must be one the filter understands,
  // or a user can pick a filter that silently does nothing.
  const buckets = (/const PRICE_AGE_BUCKETS = \[([\s\S]*?)\];/.exec(code) || ['', ''])[1];
  const keys = [...buckets.matchAll(/key:'([a-z0-9]*)'/g)].map((m) => m[1]);
  t.check(keys.length >= 5, `the dropdown offers ${keys.length} ages`);
  /* "review" is in the dropdown but is not an age, and is applied by
     getFilteredPriceRows rather than by this predicate -- deciding it
     needs the stock log, the sales and the item's other suppliers, none
     of which a pure function of one row can see. Swept separately below
     so it still cannot become a dropdown entry that does nothing. */
  const AGE_KEYS = keys.filter(Boolean).filter((k) => k !== 'review');
  AGE_KEYS.forEach((k) => {
    const understood = k === 'undated'
      ? scope.priceRowMatchesAge(q(''), k)
      : scope.priceRowMatchesAge(q('2020-01-01'), k);
    t.check(understood, `"${k}" is a filter the code actually applies`);
  });
  t.check(keys.includes('review'), 'the worklist is offered from the same dropdown');
  t.check(/if\(ageFilter === 'review'\)\{/.test(code)
    && /priceReviewCandidates\(\)/.test(code),
    'and applied where the shop can be read, not from the row predicate');
  /* After the other filters, not instead of them. An early return here
     silently ignored a supplier or stock filter set alongside it. */
  const gf = (/function getFilteredPriceRows[\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(gf.indexOf('priceRowMatchesStock') < gf.indexOf("ageFilter === 'review'"),
    'narrowing by stock still narrows the worklist');
  t.check(gf.indexOf('supplierFilter') < gf.indexOf("ageFilter === 'review'"),
    'and so does narrowing by supplier');
  t.check(/pr_age_filter'\)\.value/.test(code) && /PRICE_AGE_BUCKETS\.map/.test(code),
    'and the dropdown is built from that same list rather than written out twice');
}

/* ---------- 9. sorting by how long since it was repriced ------------- */
{
  /* The freshest quote on an item, not the oldest. If any supplier
     priced it last week the item is not going unrepriced, however old
     the other quotes are -- that is what "what have I not looked at in a
     while" actually asks. */
  const groups = scope.priceGroupsFor([
    row(1, 'P1', 'S1', 100, 100, { date: '2026-08-02', pname: 'Cement' }),
    row(2, 'P1', 'S2', 110, 110, { date: '2025-06-01', pname: 'Cement' }),
  ], 'name');
  eq(groups[0].lastRepricedDays, 2,
    'an item with one fresh quote and one ancient one was repriced two days ago');

  const mixed = [
    row(1, 'P1', 'S1', 100, 100, { date: '2026-08-02', pname: 'Cement' }),
    row(2, 'P2', 'S1', 100, 100, { date: '2026-06-20', pname: 'Binding wire' }),
    row(3, 'P3', 'S1', 100, 100, { date: '2025-06-20', pname: 'Old item' }),
    row(4, 'P4', 'S1', 100, 100, { date: '', pname: 'Undated item' }),
  ];
  eq(scope.priceGroupsFor(mixed, 'oldest').map((g) => g.pname).join(' > '),
    'Old item > Binding wire > Cement > Undated item',
    'least recently repriced first — which is the list of what to go and re-quote');
  eq(scope.priceGroupsFor(mixed, 'newest').map((g) => g.pname).join(' > '),
    'Cement > Binding wire > Old item > Undated item',
    'and the reverse');

  /* Undated last in BOTH directions. It is not the oldest and not the
     newest; it is unknown, and putting it at either end asserts
     something the record does not say. */
  ['oldest', 'newest'].forEach((mode) => {
    const last = scope.priceGroupsFor(mixed, mode).slice(-1)[0].pname;
    eq(last, 'Undated item', `undated sorts last under "${mode}", not to either extreme`);
  });

  eq(scope.priceGroupsFor(mixed, 'name').map((g) => g.pname).join(' > '),
    'Binding wire > Cement > Old item > Undated item',
    'and by name it is alphabetical, undated included');

  // Two items last repriced on the same day fall back to name, or the
  // order would shuffle between renders.
  const tie = scope.priceGroupsFor([
    row(1, 'P2', 'S1', 100, 100, { date: '2026-08-01', pname: 'Zinc' }),
    row(2, 'P1', 'S1', 100, 100, { date: '2026-08-01', pname: 'Anvil' }),
  ], 'oldest');
  eq(tie.map((g) => g.pname).join(','), 'Anvil,Zinc',
    'a tie falls back to the name rather than to whatever order they arrived in');
}

/* ---------- 10. the screen and the printout agree -------------------- */
{
  // The age filter lives inside getFilteredPriceRows, so printing cannot
  // produce a different set of rows from the one on screen.
  const fn = (/function getFilteredPriceRows[\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(/priceRowMatchesAge\(r, ageFilter\)/.test(fn),
    'the age filter is applied where every caller gets it');
  // The stock filter joined the other four; both callers still pass the
  // SAME set, which is what this has always been pinning.
  t.check((code.match(/getFilteredPriceRows\(filter, supplierFilter, categoryFilter, ageFilter, stockFilter\)/g) || []).length === 2,
    'so the list and the printout ask for the same rows');

  // A filtered printout under a plain heading is a partial registry that
  // reads like the whole one.
  t.check(/ageBucket\.label\.toLowerCase\(\)/.test(code),
    'and the printed heading names the age filter alongside the others');

  // "No matches" on a screen with an age filter set reads as an empty
  // registry rather than as good news.
  t.check(/every quote that matches your other filters is fresher than that/.test(code),
    'an empty result explains that nothing is that old, rather than implying nothing exists');
}

process.exit(t.done() ? 1 : 0);
