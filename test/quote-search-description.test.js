#!/usr/bin/env node
'use strict';
/*
 * Finding a product by the words a customer actually used.
 *
 * A product carries two free-text fields on purpose. The short
 * description holds the words a customer would say -- "90 litre", "heavy
 * duty" -- and the notes hold everything with no field of its own: whose
 * van it comes on, the thread size, the name people ask for rather than
 * the one on the box. productSearchText has folded both into the
 * catalogue's search since they existed, and says why in its own comment.
 *
 * The picker that matters most could not see either. Every product list
 * in the app runs through buildProductSuggestionEntries, and it built a
 * haystack of its own -- name, category, id -- so the Products tab found
 * a barrow by "90 litre" and the New Quote picker, with the customer
 * standing there saying exactly that, answered "No matching products"
 * and offered to go and source one the shop was already holding.
 *
 * Two haystacks for one question is the fault; the fix is that there is
 * now one. Subcategory came along with it, having been missing here for
 * the same reason.
 *
 * Run: node test/quote-search-description.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('quote search by description and notes');
const src = read('index.html');
const code = src.split(/\r?\n/).map((l) => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');

const data = { products: [], prices: [] };
const NAMES = ['productSearchText', 'supplierSkuIndex', 'buildProductSuggestionEntries',
  'searchTokens', 'matchesAllTokens'];
const sc = compileScope(NAMES.map((n) => extractFunction(src, n, 'index.html')),
  { data, variantLabel: (combo) => Object.values(combo || {}).join(' ') }, NAMES);

const find = (q) => sc.buildProductSuggestionEntries(sc.searchTokens(q));
const names = (q) => find(q).map((e) => e.p.name);

data.products = [
  { id: 'P001', name: 'Wheelbarrow', category: 'Site', subcategory: 'Concrete tools',
    type: 'simple', shortDescription: 'Heavy duty steel wheelbarrow, 90 litre',
    notes: 'Comes on Kadde’s van, Thursdays' },
  { id: 'P002', name: 'Roofing Screw', category: 'Fasteners', subcategory: '',
    type: 'variable', shortDescription: 'Self-drilling, for iron sheets',
    notes: 'Ask for "washer screws" — that is what customers call them',
    variants: [{ combo: { Size: '2 inch' }, sku: '' }, { combo: { Size: '4 inch' }, sku: '' }] },
  { id: 'P003', name: 'Cement', category: 'Building', subcategory: '', type: 'simple',
    shortDescription: '', notes: '' },
];

/* ---------- 1. the words the customer said -------------------------- */
{
  t.check(names('90 litre').length === 1 && names('90 litre')[0] === 'Wheelbarrow',
    'a barrow is found by the size a customer quotes, which lives only in its description');
  t.check(names('heavy duty')[0] === 'Wheelbarrow',
    'and by how it was described, not only by what it is called');
  t.check(names('kadde')[0] === 'Wheelbarrow',
    'a note about whose van it comes on is searchable — a note nobody can find is one you had to remember writing');
  t.check(names('concrete')[0] === 'Wheelbarrow',
    'and its subcategory, which this list could not see either');
}

/* ---------- 2. it still finds everything it always did -------------- */
{
  t.check(names('wheelbarrow')[0] === 'Wheelbarrow', 'by name');
  t.check(names('P001')[0] === 'Wheelbarrow', 'by id');
  t.check(names('building')[0] === 'Cement', 'by category');
  t.check(find('').length === 4,
    'and an empty search still offers everything — one simple, one simple, and two sizes');
  const sizes = find('roofing').map((e) => e.variantIdx);
  t.check(sizes.length === 2 && sizes[0] === 0 && sizes[1] === 1,
    'a product with sizes still comes back once per size, so a quote line names the one being sold');
  t.check(find('roofing 4')[0].variantIdx === 1,
    'and a size is still narrowed to by its own label');
}

/* ---------- 3. every token has to land somewhere -------------------- */
/*
 * The words can come from different fields -- that is the point -- but
 * all of them must match, or a two-word search would widen instead of
 * narrowing and the list would fill with everything.
 */
{
  t.check(names('wheelbarrow kadde').length === 1,
    'a word from the name and a word from the notes together still find the one product');
  t.check(names('wheelbarrow cement').length === 0,
    'while two words that share no product find none');
  t.check(names('washer').length === 2,
    'the name customers actually use reaches both sizes of the screw');
}

/* ---------- 4. a product that says nothing about itself ------------- */
{
  t.check(names('cement')[0] === 'Cement', 'a product with no description or notes is unaffected');
  data.products.push({ id: 'P004', name: 'Nails', category: 'Fasteners', type: 'simple' });
  t.check(names('nails')[0] === 'Nails',
    'and one with the fields absent entirely does not throw — they are optional on old rows');
  data.products.pop();
}

/* ---------- 5. one routine, so they cannot drift again -------------- */
{
  const build = extractFunction(src, 'buildProductSuggestionEntries', 'index.html');
  t.check(/const base = productSearchText\(p\);/.test(build),
    'the picker asks the same routine the catalogue does');
  t.check(!/p\.name\+' '\+\(p\.category\|\|''\)\+' '\+p\.id/.test(build),
    'and keeps no haystack of its own to fall behind it');
  t.check(/const base = productSearchText\(p\)/.test(build)
    && (build.match(/base\+' '/g) || []).length === 4,
    'every branch of it — simple, variable, sizeless variable, and the whole-product row');

  const text = extractFunction(src, 'productSearchText', 'index.html');
  t.check(/p\.shortDescription\|\|''/.test(text) && /p\.notes\|\|''/.test(text),
    'which is where the description and the notes are');
  t.check(/toLowerCase\(\)/.test(text),
    'lowercased there, as the tokens are, so the case somebody typed does not decide the answer');

  /* Supplier codes are indexed lowercase and appended after, so they must
     not be lowercased twice or matched against a raw haystack. */
  t.check(/codesFor\(p\.id, null\)/.test(build) && /codesFor\(p\.id, idx\)/.test(build),
    'and a supplier’s own code still finds the line it was recorded against');
}

/* ---------- 6. the box says what can be typed into it --------------- */
{
  t.check(/description or notes\.\.\."/.test(code),
    'the picker invites it, since a search nobody knows about is one nobody uses');
}

process.exit(t.done() ? 1 : 0);
