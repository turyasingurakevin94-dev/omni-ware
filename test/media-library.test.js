#!/usr/bin/env node
'use strict';
/*
 * The media library.
 *
 * Photos used to be write-only: uploaded to a bucket under a random
 * UUID, their URL stamped onto whatever asked for them, and then
 * unknowable -- no name, no size, no answer to "what uses this?", and
 * the same picture uploaded again every time it was needed. Migration
 * 0049 gives them an index; this file holds that index to its claims.
 *
 * The claims that matter:
 *
 *   WHAT USES A PHOTO IS DERIVED, NEVER STORED -- scanned from products,
 *   variants and category presets on read, so it cannot drift.
 *
 *   A NULL HASH NEVER MATCHES. Two unhashed photos are not thereby the
 *   same photo. Getting this wrong makes "Upload new" silently hand
 *   back the wrong picture.
 *
 *   BYTES: NULL IS NOT ZERO BYTES. Unsized photos are counted apart,
 *   not vanished into a smaller total.
 *
 *   DELETING A REFERENCE IS NOT DELETING THE PHOTO. Removing a product
 *   leaves its photo in the library as "used nowhere" -- the one thing
 *   the storage strip exists to say. Only the library's own delete
 *   (refuse-and-name guarded) and the abandoned-form cleanup remove
 *   objects, and the cleanup never touches a photo that was merely
 *   reused.
 *
 * Run: node test/media-library.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter, winningDeclaration } = require('./_extract');

const t = createReporter('media library');
const src = read('index.html');

const NAMES = ['mediaFmtBytes', 'mediaUsageIndex', 'mediaUsage', 'mediaUserLabel',
  'findMediaBySha', 'mediaStripStats', 'mediaBackfillPlan', 'mediaFolderRemovalPlan',
  'mediaVisibleRows', 'mediaCardLabel', 'mediaWeeklyAdds', 'mediaDupBytes',
  'mediaStorageSplit', 'mediaBadName'];
const env = {
  data: { products: [], presetCategories: [], media: [], mediaFolders: [] },
  mlState: { folder: 'all', filter: 'all', search: '' },
  PRODUCT_IMAGE_URL_PREFIX: 'https://x/img/',
};
let scope = null; let err = null;
try {
  scope = compileScope(
    // mediaVisibleRows now resolves a folder's subtree; pull in the real
    // helper rather than stubbing, so this file keeps testing real code.
    [...NAMES, 'variantLabel', 'mediaFolderSubtreeIds'].map((n) => extractFunction(src, n, 'index.html')),
    env, NAMES);
} catch (e) { err = e; }
t.check(!!scope, `the media helpers compile${err ? ` (${err.message})` : ''}`);
if (!scope) { process.exit(1); }

const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);
const eqJ = (got, want, msg) => t.check(JSON.stringify(got) === JSON.stringify(want),
  `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);

/* ---------- 1. what uses a photo is scanned, not stored -------------- */
{
  env.data.products = [
    { id: 'P1', name: 'Simba Cement', image: 'u1',
      variants: [{ combo: { Size: '50kg' }, image: 'u2' }, { combo: { Size: '25kg' }, image: null }] },
    { id: 'P2', name: 'Iron sheet 28g', image: 'u1', variants: [] },
    { id: 'P3', name: 'No photo', image: null },
  ];
  env.data.presetCategories = [{ name: 'Roofing', image: 'u3' }, { name: 'Bare', image: null }];

  eq(scope.mediaUsage('u1').length, 2, 'a photo on two products is used by 2');
  eqJ(scope.mediaUsage('u1').map((u) => u.name), ['Simba Cement', 'Iron sheet 28g'],
    'and both are named');
  eqJ(scope.mediaUsage('u2'), [{ kind: 'variant', name: 'Simba Cement — 50kg' }],
    'a variant user carries the product AND the variant');
  eqJ(scope.mediaUsage('u3'), [{ kind: 'category', name: 'Roofing' }],
    'a category default counts as a user');
  eqJ(scope.mediaUsage('nowhere'), [], 'a photo nothing points at is used by nobody');
  t.check(!scope.mediaUsageIndex().has(null) && !scope.mediaUsageIndex().has(''),
    'a product with no photo does not manufacture a phantom entry');

  eq(scope.mediaUserLabel({ kind: 'product', name: 'X' }), 'Product — X', 'a product user says so');
  eq(scope.mediaUserLabel({ kind: 'variant', name: 'X — Y' }), 'Variant — X — Y', 'a variant user says so');
  eq(scope.mediaUserLabel({ kind: 'category', name: 'X' }), 'Category default — X', 'a category user says so');
}

/* ---------- 2. a null hash never matches ----------------------------- */
{
  env.data.media = [
    { id: 1, url: 'u1', sha256: 'abc' },
    { id: 2, url: 'u2', sha256: null },
    { id: 3, url: 'u3', sha256: null },
  ];
  eq((scope.findMediaBySha('abc') || {}).id, 1, 'a known fingerprint finds its photo');
  eq(scope.findMediaBySha('zzz'), null, 'an unknown one finds nothing');
  /* The trap: rows 2 and 3 both carry sha null. A find() over
     `m.sha256 === sha` with sha null WOULD match row 2 -- handing back an
     arbitrary unrelated photo as "the same picture". */
  eq(scope.findMediaBySha(null), null, 'a null hash matches nothing, even with null-hash rows present');
  eq(scope.findMediaBySha(''), null, 'an empty hash matches nothing either');
}

/* ---------- 3. the storage strip ------------------------------------- */
{
  const rows = [
    { id: 1, url: 'ua', bytes: 1000, sha256: 's1' },
    { id: 2, url: 'ub', bytes: 2000, sha256: 's1' },   // duplicate of 1
    { id: 3, url: 'uc', bytes: null, sha256: 's2' },   // size never recorded
    { id: 4, url: 'ud', bytes: 500, sha256: null },
    { id: 5, url: 'ue', bytes: 300, sha256: null },
    { id: 6, url: 'uf', bytes: 100, sha256: 's1' },    // a THIRD copy of s1
  ];
  const usage = new Map([['ua', [{ kind: 'product', name: 'X' }]]]);
  const s = scope.mediaStripStats(rows, usage);
  eq(s.count, 6, 'six photos are six photos');
  eq(s.bytes, 3900, 'the total is the sizes it actually knows');
  eq(s.unsized, 1, 'and the photo with no recorded size is counted apart, not as zero');
  eq(s.unusedCount, 5, '"used nowhere" is everything the scan found no user for');
  eq(s.unusedBytes, 2900, 'and the money question -- how much is tied up in those -- excludes the unsized one honestly');
  /* s1 three times = TWO extra copies (one group). The distinction is
     the point: "2 duplicate copies" is the number you can delete. And
     the two null-sha rows must NOT band together as a duplicate group. */
  eq(s.dupExtras, 2, 'a triple is two extra copies, not one group; unhashed photos are never declared duplicates');
}

/* ---------- 4. the backfill decides once, then never again ----------- */
{
  const existing = [{ url: 'https://x/img/shop/a.jpg' }];
  const objects = [
    { path: 'shop/a.jpg', bytes: 5, mime: 'image/jpeg' },
    { path: 'shop/b.jpg', bytes: 10, mime: 'image/png' },
    { path: 'shop/c.jpg', bytes: null, mime: '' },
  ];
  const usage = new Map([['https://x/img/shop/b.jpg', [{ kind: 'product', name: 'Hoe' }]]]);
  const plan = scope.mediaBackfillPlan(existing, objects, usage);
  eq(plan.length, 2, 'an object already indexed is left alone');
  eq(plan[0].name, 'Hoe', 'a referenced photo is named after what uses it');
  eq(plan[0].url, 'https://x/img/shop/b.jpg', 'and its URL is the one the reference already holds');
  eq(plan[1].name, 'c.jpg', 'an orphan keeps its object name -- ugly, but true');
  eq(plan[1].bytes, null, 'a size the listing did not know stays null, not 0');
  eqJ(scope.mediaBackfillPlan(
    [{ url: 'https://x/img/shop/a.jpg' }, { url: 'https://x/img/shop/b.jpg' }, { url: 'https://x/img/shop/c.jpg' }],
    objects, usage), [], 'once everything is indexed the backfill has nothing to say -- it self-terminates');
}

/* ---------- 5. deleting a folder orphans nothing --------------------- */
{
  const folders = [{ id: 1, parentId: null }, { id: 2, parentId: 1 }, { id: 3, parentId: null }];
  const media = [{ id: 10, folderId: 1 }, { id: 11, folderId: 2 }, { id: 12, folderId: null }];
  const plan = scope.mediaFolderRemovalPlan(folders, media, 1);
  eqJ(plan.movePhotoIds, [10], 'the photos inside move out');
  eqJ(plan.reparentFolderIds, [2], 'a folder inside is re-parented, not stranded');
  eq(plan.newParent, null, 'a top-level folder empties to the top level');
  eq(scope.mediaFolderRemovalPlan(folders, media, 2).newParent, 1,
    'a nested folder empties into its parent');
}

/* ---------- 6. the grid shows what the chips claim ------------------- */
{
  env.data.media = [
    { id: 1, url: 'ua', name: 'Cement bag', folderId: 7, sha256: 's1', createdAt: '2026-01-01' },
    { id: 2, url: 'ub', name: 'iron sheet', folderId: null, sha256: 's1', createdAt: '2026-03-01' },
    { id: 3, url: 'uc', name: 'Old cement photo', folderId: 7, sha256: null, createdAt: '2026-02-01' },
    { id: 4, url: 'ud', name: 'spare washer', folderId: null, sha256: null, createdAt: '2026-04-01' },
  ];
  env.data.products = [{ id: 'P1', name: 'Cement', image: 'ua', variants: [] }];
  env.data.presetCategories = [];
  const usage = scope.mediaUsageIndex();

  env.mlState.folder = 'all'; env.mlState.filter = 'all'; env.mlState.search = '';
  eqJ(scope.mediaVisibleRows(usage).map((m) => m.id), [4, 2, 3, 1],
    'newest first -- the photo just added is the one being looked for');

  env.mlState.filter = 'unused';
  eqJ(scope.mediaVisibleRows(usage).map((m) => m.id), [4, 2, 3],
    '"Used nowhere" hides the photo that has a user');

  env.mlState.filter = 'dupes';
  /* Rows 3 and 4 BOTH carry sha null -- two of a kind is exactly what a
     dropped null-guard would band together. */
  eqJ(scope.mediaVisibleRows(usage).map((m) => m.id), [2, 1],
    '"Duplicates" shows only fingerprint-matched pairs -- never the unhashed');

  env.mlState.filter = 'all'; env.mlState.folder = 7;
  eqJ(scope.mediaVisibleRows(usage).map((m) => m.id), [3, 1], 'a folder shows its own photos');
  env.mlState.folder = 'none';
  eqJ(scope.mediaVisibleRows(usage).map((m) => m.id), [4, 2], 'and "No folder" the loose ones');

  /* Mixed case on BOTH sides: 'CEMENT' typed, 'Cement bag' stored. A
     search that lowercases only one side fails one of the two rows. */
  env.mlState.folder = 'all'; env.mlState.search = 'CEMENT';
  eqJ(scope.mediaVisibleRows(usage).map((m) => m.id), [3, 1], 'search is by name, case-blind');
  env.mlState.search = '';
}

/* ---------- 6b. a card says what the photo IS ------------------------
   Nine of this shop's ten photos are named after the storage object --
   "02bc2ed7-8a03-45c5-9b35-78756976e5f0.jpg" -- because that is what the
   library was backfilled with. A grid of those identifies nothing, and
   the app knew all along: the usage index says "Soft Close Mulper" for
   that very row. */
{
  eq(scope.mediaCardLabel({ name: '02bc2ed7-8a03-45c5.jpg' },
      [{ kind: 'product', name: 'Soft Close Mulper' }]),
    'Soft Close Mulper', 'a used photo is called by what uses it, not by its object name');
  eq(scope.mediaCardLabel({ name: 'WhatsApp Image 2026.jpeg' },
      [{ kind: 'variant', name: 'Sofa Legs — Gold / 4"' }]),
    'Sofa Legs — Gold / 4"', 'even when it has a real filename — what it IS beats what it was called');
  eq(scope.mediaCardLabel({ name: 'hinge.jpg' }, []), 'hinge.jpg',
    'a photo used nowhere falls back to its filename, which is all anybody has');
  eq(scope.mediaCardLabel({ name: '' }, []), 'Photo', 'and to a word rather than an empty card');
  eq(scope.mediaCardLabel({ name: 'x.jpg' },
      [{ kind: 'product', name: 'A' }, { kind: 'product', name: 'B' }]),
    '2 things use this', 'a photo several things share is not labelled with just one of them');

  /* The card's title and the search box have to agree: titled by usage,
     searching "Sofa Legs" must find the card that reads "Sofa Legs". */
  env.data.products = [{ id: 'P1', name: 'Sofa Legs', image: null,
    variants: [{ combo: { Colour: 'Gold' }, image: 'ug' }] }];
  env.data.presetCategories = [];
  env.data.media = [
    { id: 1, url: 'ug', name: '4f6c002e-2fbf-401c.jpg', folderId: null, sha256: 'a', createdAt: '2026-01-02' },
    { id: 2, url: 'un', name: 'WhatsApp Image 2026.jpeg', folderId: null, sha256: 'b', createdAt: '2026-01-01' },
  ];
  const usage2 = scope.mediaUsageIndex();
  env.mlState.folder = 'all'; env.mlState.filter = 'all';
  env.mlState.search = 'sofa legs';
  eqJ(scope.mediaVisibleRows(usage2).map((m) => m.id), [1],
    'searching what the card says finds it, though the row is named after a UUID');
  env.mlState.search = 'whatsapp';
  eqJ(scope.mediaVisibleRows(usage2).map((m) => m.id), [2],
    'and the filename still matches, so nothing that used to be findable stopped being');
  env.mlState.search = '';
}

/* ---------- 6c. the toolbar's orders -------------------------------
   Newest first stays the default -- every assertion above runs with no
   sort set at all. The other three are what the sort menu offers. */
{
  env.data.products = [{ id: 'P1', name: 'Bolt', image: 'ub', variants: [] }];
  env.data.presetCategories = [];
  env.data.media = [
    { id: 1, url: 'ua', name: 'zinc plate', bytes: 500, createdAt: '2026-01-01' },
    { id: 2, url: 'ub', name: 'x.jpg', bytes: 9000, createdAt: '2026-03-01' },
    { id: 3, url: 'uc', name: 'anchor', bytes: null, createdAt: '2026-02-01' },
  ];
  const usage = scope.mediaUsageIndex();
  env.mlState.folder = 'all'; env.mlState.filter = 'all'; env.mlState.search = '';
  env.mlState.sort = 'big';
  eqJ(scope.mediaVisibleRows(usage).map((m) => m.id), [2, 1, 3],
    'largest first -- and a photo with no recorded size sorts last, not as the smallest');
  env.mlState.sort = 'old';
  eqJ(scope.mediaVisibleRows(usage).map((m) => m.id), [1, 3, 2], 'oldest first');
  env.mlState.sort = 'name';
  eqJ(scope.mediaVisibleRows(usage).map((m) => m.id), [3, 2, 1],
    'by name sorts by what the CARD says -- "Bolt", not the object name "x.jpg"');
  delete env.mlState.sort;
}

/* ---------- 6d. the weekly additions ---------------------------------
   The activity panel's twelve columns. Weeks start on Monday; a photo
   with no date is counted apart rather than dropped into a week. */
{
  // 2026-10-07 is a Wednesday, so its week starts Monday 2026-10-05.
  const w = scope.mediaWeeklyAdds([
    { createdAt: '2026-10-05T08:00:00Z' },     // Monday of this week
    { createdAt: '2026-10-07' },               // today
    { createdAt: '2026-10-04' },               // Sunday: last week
    { createdAt: '2026-07-01' },               // before the window
    { createdAt: null },                       // never dated
  ], '2026-10-07', 12);
  eq(w.weeks.length, 12, 'twelve weeks, one column each');
  eq(w.weeks[11].start, '2026-10-05', 'the last column is the week holding today, starting Monday');
  eq(w.weeks[0].start, '2026-07-20', 'and the first is eleven weeks before it');
  eq(w.weeks[11].n, 2, 'this week counts Monday and today');
  eq(w.weeks[10].n, 1, 'Sunday belongs to the week before');
  eq(w.earlier, 1, 'a photo older than the window is outside it, not in its first column');
  eq(w.undated, 1, 'and an undated photo is counted apart, never drawn');
  eq(w.weeks.reduce((a, x) => a + x.n, 0), 3, 'so the columns add up to the dated photos inside the window');
}

/* ---------- 6e. what the extra copies give back ----------------------- */
{
  eq(scope.mediaDupBytes([
    { sha256: 'a', bytes: 300 }, { sha256: 'a', bytes: 100 }, { sha256: 'a', bytes: 200 },
    { sha256: 'b', bytes: 50 },
    { sha256: null, bytes: 999 }, { sha256: null, bytes: 999 },
  ]), 500, 'the cheapest copy of each group is kept, the rest is recoverable; unhashed photos never count');
}

/* ---------- 6f. the storage donut adds up -------------------------
   Its status slices are disjoint: of each set of identical copies the
   cheapest counts as the photo and the rest are "extra copies", used or
   not. So the three slices always sum to the library's known bytes. */
{
  const rows = [
    { id: 1, url: 'ua', bytes: 300, sha256: 'a' },   // used, the dearer copy
    { id: 2, url: 'ub', bytes: 100, sha256: 'a' },   // unused, the cheaper copy -- kept
    { id: 3, url: 'uc', bytes: 50, sha256: null },   // used
    { id: 4, url: 'ud', bytes: 70, sha256: null },   // unused
    { id: 5, url: 'ue', bytes: null, sha256: null }, // unsized, unused
  ];
  const usage = new Map([['ua', [{ kind: 'product', name: 'X' }]], ['uc', [{ kind: 'product', name: 'Y' }]]]);
  const sp = scope.mediaStorageSplit(rows, usage);
  eqJ(sp.extra, { n: 1, bytes: 300 }, 'the dearer of two identical copies is the extra one, whether or not it is used');
  eqJ(sp.use, { n: 1, bytes: 50 }, 'in use counts only what is not an extra copy');
  eqJ(sp.unused, { n: 3, bytes: 170 }, 'used nowhere includes the kept copy and an unsized photo, at its known size');
  eq(sp.use.bytes + sp.unused.bytes + sp.extra.bytes, 520, 'and the slices add up to the bytes the library knows');
}

/* ---------- 6g. a name that says nothing --------------------------- */
{
  t.check(scope.mediaBadName('WhatsApp Image 2026-03-14 at 09.12.44.jpeg'), 'a WhatsApp export name says nothing');
  t.check(scope.mediaBadName('IMG_2041.jpg') && scope.mediaBadName('02bc2ed7-8a03-45c5-9b35.jpg'),
    'nor does a camera counter or a storage key');
  t.check(scope.mediaBadName('') && scope.mediaBadName(null), 'an empty name is not a name');
  t.check(!scope.mediaBadName('Iron sheet 28g stack') && !scope.mediaBadName('Imigongo tile'),
    'while a name that describes the picture passes, even one starting with "Im"');
}

/* ---------- 7. sizes read like sizes --------------------------------- */
{
  eq(scope.mediaFmtBytes(null), null, 'no recorded size formats as nothing, not "0 B"');
  eq(scope.mediaFmtBytes(500), '500 B', 'bytes');
  eq(scope.mediaFmtBytes(840 * 1024), '840 KB', 'kilobytes');
  eq(scope.mediaFmtBytes(1.2 * 1024 * 1024), '1.2 MB', 'megabytes');
}

/* ---------- 8. all of it is REACHED ---------------------------------- */
{
  t.check(/if\(tab==='media'\) renderMedia\(\);/.test(src), 'the Media tab renders on entry');
  /* One rail entry is enough now: the phone sheet is generated from the
     rail, so a screen listed once is reachable on both. Counting two
     copies was counting the duplicate that has since been removed. */
  t.check((src.match(/data-tab="media"/g) || []).length >= 1,
    'and is on the rail, which is what the phone sheet is built from');
  /* Anchored to the start of the line: `if(false) await backfill...`
     still CONTAINS the call, and this has to fail on it. */
  t.check(/\n    await backfillMediaLibrary\(\);/.test(src), 'boot runs the backfill');
  t.check(/hashUnhashedMedia\(\)\.catch/.test(src), 'and starts fingerprinting behind it');

  /* The three upload points all go through the picker now. */
  const productBtn = (/p_image_upload_btn'\)\.addEventListener\('click', \(\)=>\{[\s\S]*?\n\}\);/.exec(src) || [''])[0];
  t.check(/openMediaPicker\(\{ sessionTrack: true, onPick: m=> setProductImagePreview\(m\.url\) \}\)/.test(productBtn),
    'the product photo button opens the picker');
  t.check(/\.v-image-upload'\)\.forEach\(btn=>btn\.addEventListener\('click', e=>\{\s*const idx = Number\(e\.currentTarget\.dataset\.idx\);\s*openMediaPicker\(\{ sessionTrack: true, onPick: m=> setVariantImagePreview\(idx, m\.url\) \}\);/.test(src),
    'so does each variant row');
  t.check(/preset-cat-image-upload'\)\.forEach\(btn=>btn\.addEventListener\('click', e=>\{[\s\S]{0,600}?openMediaPicker\(\{ onPick: m=>\{\s*cat\.image = m\.url;/.test(src),
    'and the category preset');
  t.check(!/type="file"[^>]*class="v-image-input"/.test(src) && !/id="p_image_input"/.test(src)
    && !/class="preset-cat-image-input"/.test(src),
    'the old direct-upload inputs are gone, not merely bypassed');

  /* Dedupe actually gates the upload: the hash is looked up BEFORE any
     bytes leave the machine. */
  const addFn = extractFunction(src, 'addMediaFromFile', 'index.html');
  t.check(addFn.indexOf('findMediaBySha') > -1
    && addFn.indexOf('findMediaBySha') < addFn.indexOf('uploadProductImageBlob'),
    'an upload looks for the fingerprint before uploading anything');
  t.check(/if\(existing\) return \{ media: existing, reused: true \};/.test(addFn),
    'and an exact match hands back the existing photo instead');

  /* ---- Downscaling, before anything reaches the bucket ----

     A phone photo is three or four megabytes at four thousand pixels on
     the long edge. It went into a 1 GB bucket exactly as it came off the
     camera, and the catalogue -- which lazy-loads nothing -- fetched
     every byte of it on every view. Measured on the shop's own images:
     4032x3024 at 495 KB became 1200x900 at 92 KB, an 81% saving. */
  const shrink = extractFunction(src, 'downscaleImageBlob', 'index.html');
  t.check(/const IMAGE_MAX_EDGE = 1200;/.test(src) && /IMAGE_MAX_EDGE \/ Math\.max\(bmp\.width, bmp\.height\)/.test(shrink),
    'the long edge is capped, whichever way round the photo is');

  /* Phone cameras record orientation in EXIF rather than in the pixels,
     so decoding without this lays every portrait shot on its side. */
  t.check(/createImageBitmap\(blob, \{imageOrientation: 'from-image'\}\)/.test(shrink),
    'EXIF orientation is honoured, so portrait photos do not come out sideways');

  /* Transparency has no JPEG equivalent and an unpainted canvas encodes
     as BLACK. Verified in a browser: a corner reading 0,0,0,0 before
     comes back 255,255,255,255, with the subject unchanged. */
  t.check(/ctx\.fillStyle = '#FFFFFF';[\s\S]{0,60}ctx\.fillRect\(0, 0, w, h\);[\s\S]{0,40}ctx\.drawImage/.test(shrink),
    'the ground is painted white before the photo is drawn, so a cut-out does not come back black');

  /* Two different questions, deliberately answered differently. */
  t.check(/const oversized = scale < 1;/.test(shrink)
    && /oversized\s*\n?\s*\? \(out\.size < blob\.size \? out : blob\)/.test(shrink),
    'an oversized photo is resized unless the resize somehow came out bigger');
  t.check(/out\.size <= blob\.size \* 0\.9 \? out : blob/.test(shrink),
    'while one already inside the cap is only re-encoded when that buys a tenth of the file or better');

  /* Never blocks an upload. */
  t.check(/if\(typeof createImageBitmap !== 'function'\) return blob;/.test(shrink),
    'a browser without createImageBitmap uploads the original rather than failing');
  t.check(/catch\(e\)\{[\s\S]{0,200}return blob;/.test(shrink),
    'and so does a file that cannot be decoded at all');
  t.check(/if\(blob\.type === 'image\/svg\+xml' \|\| blob\.type === 'image\/gif'\) return blob;/.test(shrink),
    'an SVG has no pixel size to cap and a GIF would lose every frame but one, so both pass through');

  /* One place, so a third upload path cannot be added that forgets. */
  const upFn = extractFunction(src, 'uploadProductImageBlob', 'index.html');
  t.check(/const stored = await downscaleImageBlob\(blob\);/.test(upFn),
    'the downscale sits inside the upload rather than at its call sites');
  t.check(/\.upload\(path, stored,/.test(upFn) && /extFromMimeType\(stored\.type\)/.test(upFn),
    'and it is the downscaled blob that is stored, under its own extension');

  /* The row has to describe what is on the server, not what was picked
     off the phone -- otherwise the storage strip adds up to a figure the
     bucket does not hold. */
  t.check(/bytes: stored\.size, mime: stored\.type/.test(addFn),
    'the library records the stored size, not the original file size');
  /* Presence checked BEFORE order. indexOf returns -1 when the call is
     absent, and -1 sorts earlier than everything -- so an ordering test
     on its own passes for code that does not make the call at all, which
     is exactly how a mutant hashing the DOWNSCALED blob slipped through. */
  t.check(addFn.includes('sha256HexOfBlob(file)')
    && addFn.indexOf('sha256HexOfBlob(file)') < addFn.indexOf('uploadProductImageBlob'),
    'the fingerprint is still taken from the file the person chose, so the same photo dedupes across devices');

  /* The old 4MB refusal turned away the ordinary phone photo, which is
     exactly the case downscaling now handles. */
  t.check(/file\.size > 20\*1024\*1024/.test(addFn) && !/file\.size > 4\*1024\*1024/.test(addFn),
    'and a phone photo is accepted rather than refused for being over 4MB');

  /* Deleting a product or variant no longer destroys the photo. */
  const delProduct = extractFunction(src, 'deleteProduct', 'index.html');
  const delVariant = extractFunction(src, 'deleteVariant', 'index.html');
  t.check(!delProduct.includes('deleteProductImageIfStored') && !delVariant.includes('deleteProductImageIfStored'),
    'removing a product or variant leaves its photo in the library');

  /* The refuse-and-name guard stands between the button and the delete. */
  const detail = extractFunction(src, 'openMediaDetail', 'index.html');
  const guardAt = detail.indexOf('blockers.length');
  const deleteAt = detail.indexOf('performMediaDelete');
  t.check(guardAt > -1 && deleteAt > -1 && guardAt < deleteAt,
    'the in-use check runs before the delete, not after');
  t.check(/const blockers = mediaUsage\(m\.url\);/.test(detail),
    'and the check asks the real scan, not a stand-in');
  t.check(/mediaUserLabel\(u\)/.test(detail.slice(guardAt, deleteAt)),
    'and the refusal names what uses the photo');

  /* The selection bar's Delete keeps the same guard, for every picked
     photo: what is in use is kept and named, and usage is asked again at
     the moment of deleting rather than trusted from when the dialog
     opened. */
  const bulkAt = src.indexOf("document.getElementById('ml_bulk_del').addEventListener");
  const bulk = src.slice(bulkAt, src.indexOf('\n});', bulkAt));
  t.check(bulkAt > -1 && /const blocked = rows\.filter\(m=> \(usage\.get\(m\.url\)\|\|\[\]\)\.length\);/.test(bulk)
    && /if\(mediaUsage\(m\.url\)\.length\) continue;\s*await performMediaDelete\(m\);/.test(bulk),
    'the bulk delete skips anything in use, and checks again just before each delete');
  t.check(/await mediaConfirm\(/.test(bulk) && bulk.indexOf('mediaConfirm(') < bulk.indexOf('performMediaDelete'),
    'and nothing is deleted before the owner confirms');
  t.check(detail.indexOf('mediaConfirm(') > guardAt && detail.indexOf('mediaConfirm(') < deleteAt,
    'the record\'s own delete confirms after the in-use refusal and before deleting');

  /* The abandoned-form cleanup only ever touches this session's genuinely
     new uploads. */
  const discard = extractFunction(src, 'discardUnsavedProductImages', 'index.html');
  t.check(/ids\.includes\(m\.id\)/.test(discard) && /mediaUsage\(m\.url\)\.length === 0/.test(discard),
    'the cleanup drops only session uploads that nothing kept and nothing uses');
  t.check(/\} else if\(mpState\.sessionTrack\)\{[\s\S]{0,400}?sessionUploadedMediaIds\.push\(res\.media\.id\);/.test(src),
    'and a photo merely REUSED from the library is never put on the cleanup list');

  /* The sync plumbing: loaded in step, seeded in lastSynced (or a photo
     deleted before the first save would quietly come back), and diffed. */
  t.check(/loansR,\s*\n\s*mediaR, mediaFoldersR, waPostsR,\s*\n\s*rentAgreementsR/.test(src)
    && /sel\('loans'\),\s*\n\s*sel\('media'\), sel\('media_folders'\), sel\('wa_posts'\),\s*\n\s*sel\('rent_agreements'\)/.test(src),
    'the load destructuring and the select list agree on where media sits');
  const lastSyncedFn = extractFunction(src, 'buildLastSynced', 'index.html');
  t.check(/media: keyRowsById\(rows\.media, 'id'\)/.test(lastSyncedFn)
    && /mediaFolders: keyRowsById\(rows\.mediaFolders, 'id'\)/.test(lastSyncedFn),
    'lastSynced is seeded for both, so a delete made before the first save still deletes');
  t.check(/addDiffOps\(ops, 'media', 'media', 'id', shopId, rows\.media\);/.test(src)
    && /addDiffOps\(ops, 'mediaFolders', 'media_folders', 'id', shopId, rows\.mediaFolders\);/.test(src),
    'and both collections are in the diff-sync');

  /* The picker opens ON TOP of the product form -- another modal, at the
     shared overlay z-index of 100 -- and DOM order put the form later, so
     the picker opened underneath it, invisible. Found by watching the
     running app, and asserted through the cascade resolver so an inert
     rule can never satisfy it. */
  const pickerZ = winningDeclaration(src, 'mediaPickerModal', 'z-index');
  const baseZ = 100;
  t.check(pickerZ && Number(pickerZ.value) > baseZ,
    `the picker outranks the modal that summons it (z-index ${pickerZ && pickerZ.value} over ${baseZ})`);
  const detailZ = winningDeclaration(src, 'mediaDetailModal', 'z-index');
  t.check(detailZ && Number(detailZ.value) > baseZ,
    'and so does the photo record it can hand off to');
}

process.exit(t.done() ? 1 : 0);
