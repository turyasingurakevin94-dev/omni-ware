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
 * Four sites: the agent's catalogue, the agent's promotions shelf, the
 * public catalogue a customer is handed a link to, and -- found later, and
 * the one where it matters most -- the worker's pick card, where somebody
 * is standing at a shelf choosing between the brass one and the chrome one.
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
  /* Since the media library, the image is picked per variant index rather
     than uploaded in place, and the usage scan counts each variant as a
     real user of its picture -- which is this file's "only sensible if it
     is real" evidence now that deleting a product no longer deletes photos. */
  t.check(/openMediaPicker\(\{ sessionTrack: true, onPick: m=> setVariantImagePreview\(idx, m\.url\) \}\)/.test(strip(admin)),
    'and picks it from the media library, per variant');
  t.check(/add\(v\.image, 'variant', /.test(strip(admin)),
    'and the usage scan counts each variant photo as real');
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

/* ---------- 5. the worker's pick card ------------------------------- */
/*
 * A fourth site, and the one where it matters most. The pick card is a
 * full-bleed photo carousel, built for someone standing at a shelf deciding
 * which of two similar things to take, and the photo is the largest thing
 * on it. It showed the generic product photo for every variant.
 *
 * Two independent reasons, both needed:
 *   - the card called ipStageThumbHTML(product) with no variant index,
 *     alone among every caller of it; and
 *   - the standalone app's product fetch never selected the variants
 *     column, so there was nothing to resolve against even if it had.
 */
{
  const sharedJs = read('shared-worker.js');
  const workerHtml = read('worker.html');
  const sharedCode = strip(sharedJs);

  t.check(/ipStageThumbHTML\(product\|\|\{\}, it\.variantIdx\)/.test(sharedCode),
    'the pick card asks for the photo of the variant on the line');
  t.check(!/ipStageThumbHTML\(product\|\|\{\}\)/.test(sharedCode),
    'and no longer asks for the product photo regardless of variant');
  t.check(/select\('id, name, image, variants, category'\)/.test(workerHtml),
    'the standalone worker app loads the columns it needs to resolve one');
  t.check(/variants:p\.variants\|\|\[\]/.test(workerHtml),
    'and carries variants through into the product it builds');
  t.check(/category:p\.category\|\|null/.test(workerHtml),
    'and the category the shared photo hangs off');
  t.check(/from\('app_settings'\)\.select\('presets'\)[\s\S]{0,80}maybeSingle\(\)/.test(workerHtml),
    'and reads the presets row the category photos live in, tolerating its absence');
  t.check(/presetCategories: \(\(settingsR\.data && settingsR\.data\.presets\) \|\| \{\}\)\.categories \|\| \[\]/.test(workerHtml),
    'landing them where resolveProductImage looks');
  t.check(/settingsR\]\.forEach\(r=>\{ if\(r\.error\) throw r\.error; \}\)/.test(workerHtml),
    'and the new query is error-checked with the rest');

  // The resolver's whole fallback chain, on the shapes a pick card meets.
  const presetCategories = [{ name: 'Cement', image: 'cat-cement.jpg' }, { name: 'Paint' }];
  const scope = compileScope([
    extractFunction(sharedJs, 'resolveProductImage', 'shared-worker.js'),
  ], { data: { presetCategories } }, ['resolveProductImage']);
  const img = (p, vi) => scope.resolveProductImage(p, vi);
  const hinge = {
    name: 'Cabinet Hinge', image: 'generic.jpg', category: 'Cement',
    variants: [{ combo: ['Brass'], image: 'brass.jpg' }, { combo: ['Chrome'] }],
  };
  t.check(img(hinge, 0) === 'brass.jpg', "a variant with its own photo shows it");
  t.check(img(hinge, 1) === 'generic.jpg',
    'one without falls back to the product photo, not past it to the category');
  t.check(img({ name: 'Bag of cement', image: null, category: 'Cement', variants: [] }, null) === 'cat-cement.jpg',
    "a product with no photo of its own falls back to its category's");
  t.check(img({ name: 'Brush', image: null, category: 'Paint', variants: [] }, null) == null,
    'a category with no photo either gets the placeholder');
  t.check(img({ name: 'Odd', image: null, category: 'Gone', variants: [] }, null) == null,
    'and so does a category that is not in the list');
  t.check(img({ name: 'Sand', image: null, category: null, variants: [] }, null) == null,
    'and a product with no category at all');

  // Rows shaped the way the worker app used to build them must not throw.
  t.check(img({ name: 'Old', image: 'old.jpg' }, 2) === 'old.jpg',
    'a product row with no variants array at all is handled, not thrown on');
  const bare = compileScope([
    extractFunction(sharedJs, 'resolveProductImage', 'shared-worker.js'),
  ], { data: {} }, ['resolveProductImage']);
  t.check(bare.resolveProductImage({ name: 'Cement', image: null, category: 'Cement' }, null) == null,
    'and with no presetCategories loaded it stops quietly rather than throwing');
}

process.exit(t.done() ? 1 : 0);
