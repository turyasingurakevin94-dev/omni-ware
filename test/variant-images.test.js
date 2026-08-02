#!/usr/bin/env node
'use strict';
/*
 * A variant's photo is the variant's.
 *
 * products.variants has carried an image per variant since variants
 * existed. The admin writes {sku, combo, image} (index.html), shows a
 * per-variant preview while editing, and deletes those files along with the
 * product -- so the data is there, and shopkeepers have been putting photos
 * into it.
 *
 * Every read path threw it away and sent products.image for every row. A
 * variable product therefore showed one picture repeated across all of its
 * variants; and where the photos live only on the variants -- which is the
 * normal case for colours, gauges and finishes, because there is no single
 * photo of "the product" -- every variant showed the placeholder instead.
 *
 * Three sites: the agent's catalogue, the agent's promotions shelf, and the
 * public catalogue a customer is handed a link to.
 *
 * Run: node test/variant-images.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('variant images');
const strip = (s) => s.split(/\r?\n/).map(l => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');

const agentSrc = read('supabase/functions/agent-catalog/index.ts');
const agentCode = strip(agentSrc);
const pubSrc = read('supabase/functions/catalogue-public/index.ts');
const pubCode = strip(pubSrc);
const admin = read('index.html');

/* ---------- 1. the data really is there ----------------------------- */
/*
 * Checked at the writer, because the whole bug was a reader assuming it did
 * not exist. If the admin ever stops storing it, this test should be the
 * thing that says so rather than the readers silently going back to being
 * right by accident.
 */
{
  t.check(/draftVariants\.map\(v=>\(\{sku:\(v\.sku\|\|''\)\.trim\(\), combo:v\.combo, image:v\.image\|\|null/.test(strip(admin)),
    'the admin saves an image on each variant');
  t.check(/originalVariantImagesBySig\[JSON\.stringify\(v\.combo\)\] = v\.image \|\| null;/.test(strip(admin)),
    'and tracks it across an edit');
  t.check(/\(product && product\.variants \|\| \[\]\)\.forEach\(v=>\{ if\(v\.image\) deleteProductImageIfStored\(v\.image\)/.test(strip(admin)),
    'and deletes it with the product, which is only sensible if it is real');
}

/* ---------- 2. the agent catalogue ---------------------------------- */
{
  let f = null, err = null;
  try {
    ({ itemImage: f } = compileScope(
      [extractFunction(agentSrc, 'itemImage', 'agent-catalog/index.ts')],
      {}, ['itemImage'], { typescript: true },
    ));
  } catch (e) { err = e; }
  t.check(typeof f === 'function', `itemImage compiles${err ? ` (${err.message})` : ''}`);

  if (f) {
    const p = {
      image: 'product.jpg',
      variants: [{ combo: { Colour: 'Red' }, image: 'red.jpg' }, { combo: { Colour: 'Blue' }, image: null }],
    };
    t.check(f(p, 0) === 'red.jpg', "a variant with its own photo shows it -- this is the whole bug");
    t.check(f(p, 1) === 'product.jpg',
      'a variant without one falls back to the product, so it is illustrated rather than blank');
    t.check(f(p, null) === 'product.jpg', 'a simple product is unchanged');

    // The case that showed nothing at all: photos only on the variants.
    const noParent = { image: null, variants: [{ combo: {}, image: 'gauge30.jpg' }] };
    t.check(noParent.image === null && f(noParent, 0) === 'gauge30.jpg',
      'a product with no photo of its own still shows its variants\' photos -- they used to show the placeholder');

    // Nothing here may throw on a malformed row; this runs for every item.
    t.check(f({ image: 'p.jpg' }, 3) === 'p.jpg', 'an index past the end falls back');
    t.check(f({ image: 'p.jpg', variants: 'not an array' }, 0) === 'p.jpg', 'so does a non-array variants field');
    t.check(f({}, 0) === null && f(null, 0) === null && f(null, null) === null, 'and a missing product returns null');
  }

  t.check(/image: itemImage\(p, variantIdx\),\s*\n\s*createdAt: p\.created_at,/.test(agentCode),
    'the catalogue list uses it');
  t.check(/image: itemImage\(p, variantIdx\),\s*\n\s*category: p\?\.category \|\| "",/.test(agentCode),
    'and so does the promotions list, which feeds the bonus shelf on Sell');
  t.check(!/image: p\.image,/.test(agentCode) && !/image: p\?\.image \|\| null,/.test(agentCode),
    'neither reaches past it to the product image');
}

/* ---------- 3. the public catalogue --------------------------------- */
/*
 * This one goes to a stranger following a link an agent shared, which is
 * the surface where a wrong photo costs an actual sale.
 */
{
  t.check(/image: v\.image \|\| p\.image \|\| null, category: p\.category \|\| "",/.test(pubCode),
    'a variant row sends the variant\'s photo, falling back to the product\'s');
  t.check(/if \(variantCount === 0\) return \[\{ productId: p\.id, variantIdx: null, name: p\.name, image: p\.image \|\| null/.test(pubCode),
    'while a product with no variants still sends its own, which was always correct');

  // Same arithmetic, stated independently of the source.
  const rowImage = (v, p) => v.image || p.image || null;
  t.check(rowImage({ image: 'red.jpg' }, { image: 'product.jpg' }) === 'red.jpg', 'variant wins');
  t.check(rowImage({ image: null }, { image: 'product.jpg' }) === 'product.jpg', 'product is the fallback');
  t.check(rowImage({ image: null }, { image: null }) === null, 'and neither is an honest null, not undefined');
}

/* ---------- 4. the agent app renders whatever it is given ----------- */
/*
 * No fix needed here -- worth pinning, because it is why the bug looked
 * like a frontend problem. Every image on Sell comes from the catalog rows
 * these two functions return.
 */
{
  const agentApp = strip(read('agent.html'));
  t.check(/selected\.image \? `<img class="ag-grid-thumb" src="\$\{esc\(selected\.image\)\}"/.test(agentApp),
    'the card shows the row\'s image');
  t.check(/: `<div class="ag-grid-thumb-placeholder">\$\{ICON_PLACEHOLDER\}<\/div>`/.test(agentApp),
    'and the placeholder only when there is none -- which is what every variant was getting');
}

process.exit(t.done() ? 1 : 0);
