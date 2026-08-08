#!/usr/bin/env node
'use strict';
/*
 * Finding one variant among sixty.
 *
 * Three attributes multiply: Colour x Size x Thread is a wall of cards,
 * and bulk entry means typing into them. So the list can be filtered to
 * the slice being worked on.
 *
 * THE INDEX IS THE WHOLE PROBLEM. Every field in a variant card writes
 * back through data-idx into draftVariants. A filtered list that
 * renumbered its rows would send the SKU typed on the third VISIBLE card
 * to the third variant of sixty — silently, into a product nobody was
 * looking at. So a filtered row carries the index it has in the real
 * array, not its position on screen.
 *
 * Run: node test/variant-filter.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('variant filter');
const src = read('index.html');
const code = src.split(/\r?\n/).map((l) => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');

const NAMES = ['variantSearchText', 'filterSortVariants'];
const scope = compileScope([
  extractFunction(src, 'searchTokens', 'index.html'),
  extractFunction(src, 'matchesAllTokens', 'index.html'),
  ...NAMES.map((n) => extractFunction(src, n, 'index.html')),
], {}, NAMES);

const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);
const V = [
  { combo: { Colour: 'Red', Thread: 'M8' }, sku: 'RM8' },
  { combo: { Colour: 'Red', Thread: 'M10' }, sku: '' },
  { combo: { Colour: 'Blue', Thread: 'M8' }, sku: 'BM8' },
  { combo: { Colour: 'Blue', Thread: 'M10' }, sku: '' },
  { combo: { Colour: 'Green', Thread: 'M8' }, sku: 'ZED' },
];

/* ---------- 1. what a variant can be found by ------------------------ */
{
  const text = scope.variantSearchText(V[0]);
  t.check(text.includes('red'), 'a variant is findable by its value');
  t.check(text.includes('colour'), 'and by the attribute name');
  t.check(text.includes('rm8'), 'and by its SKU, which is what somebody reads off a box');
  eq(scope.variantSearchText({}), '', 'a variant with nothing on it searches as nothing');
  eq(scope.variantSearchText(null), '', 'and neither does no variant at all');
}

/* ---------- 2. filtering, and the index it must keep ----------------- */
{
  const all = scope.filterSortVariants(V, '', 'generated');
  eq(all.length, 5, 'an empty box shows everything');
  eq(all[0].i, 0, 'in the order the attributes generated them');
  eq(all[4].i, 4, 'all the way down');

  const red = scope.filterSortVariants(V, 'red', 'generated');
  eq(red.length, 2, 'a value narrows the list');
  /* THE TRAP, stated as the assertion that matters most in this file:
     the second red variant is index 1 of the real array, and every field
     on its card writes through that number. */
  eq(red[0].i, 0, 'and each row keeps the index it has in the REAL array');
  eq(red[1].i, 1, 'not its position among the matches');

  const m8 = scope.filterSortVariants(V, 'm8', 'generated');
  eq(m8.length, 3, 'a value from the other attribute narrows differently');
  eq(m8[2].i, 4, 'still carrying real indexes — this one is the fifth variant');

  eq(scope.filterSortVariants(V, 'red m10', 'generated').length, 1,
    'two words must BOTH match, which is how you reach one variant of sixty');
  eq(scope.filterSortVariants(V, 'red m10', 'generated')[0].i, 1, 'and it is the right one');
  eq(scope.filterSortVariants(V, 'RED', 'generated').length, 2, 'however it is cased');
  eq(scope.filterSortVariants(V, 'zed', 'generated')[0].i, 4, 'a SKU finds its variant');
  eq(scope.filterSortVariants(V, 'purple', 'generated').length, 0, 'and a miss is a miss');
}

/* ---------- 3. sorting, without losing the index --------------------- */
{
  const az = scope.filterSortVariants(V, '', 'az');
  /* "Blue M10" before "Blue M8", because these are strings and '1' sorts
     before '8'. Worth pinning as the real behaviour rather than the
     numeric order somebody might expect from a thread size. */
  eq(az[0].i, 3, 'A to Z starts at Blue M10 — carrying its real index, 3');
  eq(az[1].i, 2, 'then Blue M8, index 2');
  eq(az[az.length - 1].i, 0, 'and Red M8 last, still index 0');
  const za = scope.filterSortVariants(V, '', 'za');
  eq(za[0].i, 0, 'Z to A reverses it');
  eq(za.length, 5, 'without dropping anybody');
  /* Sorting must not reorder the caller's own array — the cards, the
     save and every data-idx read from it afterwards. */
  eq(V[0].combo.Colour, 'Red', 'and the real array is left in its own order');
  eq(V[2].combo.Colour, 'Blue', 'exactly as it was generated');

  // Sort and filter compose.
  const redAz = scope.filterSortVariants(V, 'red', 'az');
  eq(redAz.length, 2, 'filtering and sorting work together');
  eq(redAz[0].i, 1, 'M10 sorts before M8 as text, and keeps index 1');
}

/* ---------- 4. wired into the form ----------------------------------- */
{
  t.check(/id="vf_search"/.test(src) && /id="vf_sort"/.test(src) && /id="vf_clear"/.test(src),
    'the form has a filter, a sort and a way out of both');
  /* THE ONE THAT PROTECTS THE DATA: the cards must be rendered from the
     pairs, destructuring the real index into the same `i` every field
     already writes through. */
  t.check(/wrap\.innerHTML = shown\.map\(\(\{v,i\}\)=>`/.test(code),
    'the cards render from the filtered pairs, keeping the real index as `i`');
  t.check(/vfQuery = e\.target\.value;\s*\r?\n\s*renderVariantsList\(\);/.test(code),
    'typing narrows the list as you go');
  /* Showing a slice without saying so leaves somebody sure the other
     fifty variants are gone. */
  t.check(/\$\{shown\.length\} of \$\{draftVariants\.length\}/.test(src)
    && /\$\{draftVariants\.length\} variants/.test(src),
    'the bar says how many of how many are showing, so a filtered list never reads as a short one');
  /* Read from renderVariantsList, not the whole file: the price form
     carries the same sentence, and a file-wide match would let this pass
     on the strength of the other form's copy. */
  const list = extractFunction(src, 'renderVariantsList', 'index.html');
  t.check(/No variant matches that/.test(list),
    'and a query that matches nothing says so rather than looking like an empty product');

  /* A filter left over from the last product would open the next one
     showing a fraction of its variants with nothing saying why. Both
     paths into the form must clear it — this shipped broken because only
     the edit path did, and the Add path carried a stale query in. */
  t.check(/resetVariantFilter\(\);/.test(extractFunction(src, 'editProduct', 'index.html')),
    'opening a product to edit clears the filter left over from the last one');
  t.check(/resetVariantFilter\(\);/.test(extractFunction(src, 'resetProductForm', 'index.html')),
    'and so does opening the form to add a new one');

  /* The bar is furniture on a product with three variants. */
  /* Four, because a four-variant product already scrolls in the price
     form. Six was a guess and it hid the bar on a real product. */
  t.check(/const VARIANT_FILTER_MIN = 4;/.test(code)
    && /const filterable = draftVariants\.length >= VARIANT_FILTER_MIN;/.test(code)
    && /bar\.style\.display = filterable \? '' : 'none'/.test(code),
    'and it only appears once there are enough variants for finding one to be work');

  /* THE ESCAPE HATCH. Hiding the bar takes the Clear button with it, so
     a filter that still applied below the threshold would be a list of
     four variants showing none, with nothing on screen to undo it. This
     is what a stale query actually did before the guard existed. */
  t.check(/const shown = filterable\s*\r?\n\s*\? filterSortVariants\(draftVariants, vfQuery, vfSort\)\s*\r?\n\s*: draftVariants\.map\(\(v,i\)=>\(\{ v, i \}\)\);/.test(code),
    'a hidden bar does not filter — no visible Clear means no filter, whatever the state says');
}

/* ---------- 5. the same filter on the price form --------------------- */
/*
 * Entering a supplier's price list means the same wall of cards, and the
 * same trap wearing different clothes: every tier control there carries
 * data-idx, and toggleBulkVariantOverride / addBulkVariantTier read that
 * number straight back. A renumbered row would give the wrong variant its
 * own price ladder.
 */
{
  t.check(/id="prv_search"/.test(src) && /id="prv_sort"/.test(src) && /id="prv_clear"/.test(src),
    'the price form has its own filter, sort and clear');
  const bulk = extractFunction(src, 'renderPrBulkVariantRows', 'index.html');
  t.check(/const shownVariants = prFilterable\s*\r?\n\s*\? filterSortVariants\(p\.variants, prvQuery, prvSort\)\s*\r?\n\s*: p\.variants\.map\(\(v,i\)=>\(\{ v, i \}\)\);/.test(bulk),
    'and narrows the price list through the same filter as the product form');
  t.check(/const prFilterable = p\.variants\.length >= VARIANT_FILTER_MIN;/.test(bulk),
    'with the same escape hatch: below the threshold the hidden bar filters nothing');
  t.check(/wrap\.innerHTML = shownVariants\.length \? shownVariants\.map\(\(\{v,i\}\)=>\{/.test(bulk),
    'the price cards render from the pairs, so data-idx stays the real variant');
  t.check(/\$\{shownVariants\.length\} of \$\{p\.variants\.length\}/.test(bulk)
    && /\$\{p\.variants\.length\} variants/.test(bulk),
    'the price bar says how many of how many are showing');
  t.check(/No variant matches that/.test(bulk),
    'and a query matching nothing says so, rather than reading as a product with nothing to price');
  t.check(/filterBar\.style\.display = prFilterable \? '' : 'none'/.test(bulk),
    'appearing on the same terms — only once there are enough variants for finding one to be work');

  /* Two modals, two filters. A word typed while pricing one product must
     not silently narrow the variants of the next. */
  t.check(/let prvQuery = '', prvSort = 'generated';/.test(code),
    'the price form keeps its own filter state, separate from the product form');
  const mode = extractFunction(src, 'setPrBulkMode', 'index.html');
  t.check(/resetPrVariantFilter\(\);/.test(mode),
    'switching product or mode clears the filter left over from the last one');
  t.check(/prvQuery = e\.target\.value;\s*\r?\n\s*renderPrBulkVariantRows\(\);/.test(code),
    'typing narrows the price list as you go');
}

process.exit(t.done() ? 1 : 0);
