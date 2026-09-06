#!/usr/bin/env node
'use strict';
/*
 * Filtering the Products list by when each product was added.
 *
 * The date was already there: products.created_at has been written by the
 * column's own default since migration 0012, and the push payload
 * deliberately omits it so an edit never overwrites it. It simply was
 * never read back into the app.
 *
 * Two things this has to get right.
 *
 * NULL IS NOT ZERO. A product with no recorded date has not been shown to
 * be new. Treating a missing date as "0 days ago" would pile every
 * undated product into "Added today" -- which is exactly where somebody
 * looks to check what they entered this morning, so the wrong answer
 * lands in the most-trusted place.
 *
 * THE DATE MUST SURVIVE AN EDIT. Saving a product replaces its record
 * wholesale, so a createdAt that is not carried across is erased on every
 * edit -- and the product silently becomes "added today" the next time
 * anybody touches it.
 *
 * Run: node test/product-date-added.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('product date added');
const src = read('index.html');
const code = src.split(/\r?\n/).map((l) => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');

const NAMES = ['todayISO', 'daysSinceDate', 'productAddedDaysAgo', 'productMatchesAddedBand', 'productAddedBandLabel'];
const scope = compileScope([
  extractFunction(src, 'todayISO', 'index.html'),
  extractFunction(src, 'daysSinceDate', 'index.html'),
  extractDeclaration(src, 'PRODUCT_ADDED_BANDS', 'index.html'),
  extractFunction(src, 'productAddedDaysAgo', 'index.html'),
  extractFunction(src, 'productMatchesAddedBand', 'index.html'),
  extractFunction(src, 'productAddedBandLabel', 'index.html'),
], {}, NAMES);   // the bands const is in scope for these, not exported through it

const ago = (days) => new Date(Date.now() - days * 86400000).toISOString();
const P = (days) => ({ createdAt: days === null ? null : ago(days) });
const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);

/* ---------- 1. how long ago ------------------------------------------ */
{
  eq(scope.productAddedDaysAgo(P(0)), 0, 'a product added today is nought days old');
  eq(scope.productAddedDaysAgo(P(1)), 1, 'yesterday is one');
  eq(scope.productAddedDaysAgo(P(120)), 120, 'and four months is a hundred and twenty');

  /* THE HONESTY LINE. Every one of these is a product nobody can date,
     and every one of them must say so rather than answer "today". */
  eq(scope.productAddedDaysAgo(P(null)), null, 'a product with no date reports null, not nought');
  eq(scope.productAddedDaysAgo({}), null, 'and one with no field at all');
  eq(scope.productAddedDaysAgo({ createdAt: '' }), null, 'an empty string is not a date');
  eq(scope.productAddedDaysAgo({ createdAt: 'whenever' }), null, 'nor is an unreadable one');
  eq(scope.productAddedDaysAgo(null), null, 'and neither is no product at all');
}

/* ---------- 2. the bands --------------------------------------------- */
{
  const inBand = (days, band) => scope.productMatchesAddedBand(P(days), band);

  t.check(inBand(0, 'today') && !inBand(1, 'today'),
    '"Added today" is today and nothing else');

  /* Inclusive of today: "last 7 days" is this week's entries, so today
     and the six before it. A cutoff that dropped today would answer the
     wrong question. */
  t.check(inBand(0, 'd7') && inBand(6, 'd7'), 'the last 7 days includes today and six days back');
  t.check(!inBand(7, 'd7'), 'and stops at the seventh');
  t.check(inBand(29, 'd30') && !inBand(30, 'd30'), 'the same shape at thirty');
  t.check(inBand(89, 'd90') && !inBand(90, 'd90'), 'and at ninety');

  /* The two halves must meet exactly: day 90 belongs to "older", and no
     product may fall between the bands or into both. */
  t.check(inBand(90, 'older') && !inBand(89, 'older'),
    'older-than-90 starts precisely where the 90-day window ends');
  t.check(inBand(365, 'older'), 'and keeps going');

  t.check(inBand(0, '') && inBand(500, '') && scope.productMatchesAddedBand(P(null), ''),
    'no band selected keeps everything, including the undated');
}

/* ---------- 3. what happens to a product nobody can date ------------- */
{
  const undated = P(null);
  t.check(!scope.productMatchesAddedBand(undated, 'today'),
    'an undated product is not claimed to be new');
  t.check(!scope.productMatchesAddedBand(undated, 'd7')
    && !scope.productMatchesAddedBand(undated, 'd30')
    && !scope.productMatchesAddedBand(undated, 'd90'),
    'nor to fall inside any window');
  /* Nor is it silently called old -- which would be the other way of
     inventing an answer. */
  t.check(!scope.productMatchesAddedBand(undated, 'older'),
    'and not quietly filed as old either');
  t.check(scope.productMatchesAddedBand(undated, 'unknown'),
    'it has its own band, so it is findable rather than merely missing');
  t.check(!scope.productMatchesAddedBand(P(3), 'unknown'),
    'which holds nothing but the undated');
}

/* ---------- 4. labels ------------------------------------------------ */
{
  eq(scope.productAddedBandLabel('today'), 'Added today', 'each band can name itself');
  eq(scope.productAddedBandLabel('older'), 'Older than 90 days', 'including the open-ended one');
  eq(scope.productAddedBandLabel('unknown'), 'Date not recorded', 'and the undated one');
  eq(scope.productAddedBandLabel(''), 'Any time', 'no band selected reads as any time');
}

/* ---------- 5. the date reaches the app, and stays ------------------- */
{
  t.check(/createdAt: p\.created_at \|\| null/.test(code),
    'the column the server has always written is finally read back');
  t.check(!/created_at:\s*p\.createdAt/.test(code),
    'and never written up, so an edit cannot overwrite the real creation date');

  /* Saving replaces the record wholesale. A createdAt that is not carried
     across is erased on every edit, and the product becomes "added today"
     the moment anybody touches it. */
  t.check(/createdAt: editingProductId\s*\r?\n\s*\? \(\(data\.products\.find\(p=>p\.id===editingProductId\)\|\|\{\}\)\.createdAt \|\| null\)\s*\r?\n\s*: new Date\(\)\.toISOString\(\),/.test(code),
    'editing a product keeps its creation date; adding one stamps it now');
}

/* ---------- 6. wired into the list ----------------------------------- */
{
  const rows = extractFunction(src, 'productRowsForList', 'index.html');
  t.check(/function productRowsForList\(filter='', categoryFilter='', supplierFilter='', pricedFilter='', addedFilter=''\)/.test(rows),
    'the list takes the band');
  /* Product-level, like category and supplier: when it was added is a
     fact about the product, so its variants go with it. */
  t.check(/const matchesAdded = productMatchesAddedBand\(p, addedFilter\);/.test(rows)
    && /if\(!matchesCategory \|\| !matchesSupplier \|\| !matchesAdded\) return;/.test(rows),
    'and drops a product with all of its variants, rather than half a product');

  const render = extractFunction(src, 'renderProducts', 'index.html');
  t.check(/function renderProducts\(filter='', categoryFilter='', supplierFilter='', pricedFilter='', addedFilter=''\)/.test(render)
    && /const rows = productRowsForList\(filter, categoryFilter, supplierFilter, pricedFilter, addedFilter\);/.test(render),
    'the on-screen list is narrowed by the band, not just the printed one');
  t.check(/populateProductFilterDropdowns\(categoryFilter, supplierFilter, addedFilter\);/.test(render),
    'and the dropdown is rebuilt knowing which band is chosen');

  t.check(/document\.getElementById\('p_added_filter'\)\.addEventListener\('change', triggerProductsRender\);/.test(code),
    'changing it redraws the list');
  const trigger = extractFunction(src, 'triggerProductsRender', 'index.html');
  t.check(/document\.getElementById\('p_added_filter'\)\.value/.test(trigger),
    'and the value actually reaches the render');
  /* The label moved from <label>Date added</label> to the console's
     .ow-f-l span when Products converted, and shortened to "Added"
     because the field sits in a labelled strip where "Date" is what the
     band options say ("Added today", "In the last 7 days"). What is
     pinned is unchanged: the control exists and is LABELLED, so it can
     never become an unnamed select the shop has to open to identify. */
  t.check(/id="p_added_filter"/.test(src) && /<span class="ow-f-l">Added<\/span>/.test(src),
    'the toolbar has the control, labelled for what it filters');

  /* A printed sheet is read away from the screen, so a list narrowed to
     one band has to carry the reason it is short. */
  const print = code.slice(code.indexOf("getElementById('p_print_btn')"));
  t.check(/if\(addedFilter\) applied\.push\(productAddedBandLabel\(addedFilter\)\.toLowerCase\(\)\);/.test(print),
    'a printed list says which slice of dates it is');
  t.check(/const rows = productRowsForList\(filter, categoryFilter, supplierFilter, pricedFilter, addedFilter\);/.test(print),
    'and prints that slice rather than the whole catalogue');
}

/* ---------- 7. the option that would always find nothing ------------- */
{
  const pop = extractFunction(src, 'populateProductFilterDropdowns', 'index.html');
  t.check(/const anyUndated = data\.products\.some\(p=> productAddedDaysAgo\(p\) === null\);/.test(pop),
    'the undated band is offered only when a product is actually in it');
  /* Removing the option somebody has already chosen would silently widen
     their filter back to everything. */
  t.check(/if\(anyUndated \|\| selectedAdded === 'unknown'\) opts\.push/.test(pop),
    'and stays offered while it is the current choice');
  t.check(/o\.key===\(selectedAdded\|\|''\)\?'selected':''/.test(pop),
    'the chosen band survives the redraw');
}

process.exit(t.done() ? 1 : 0);
