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
  'mediaVisibleRows'];
const env = {
  data: { products: [], presetCategories: [], media: [], mediaFolders: [] },
  mlState: { folder: 'all', filter: 'all', search: '' },
  PRODUCT_IMAGE_URL_PREFIX: 'https://x/img/',
};
let scope = null; let err = null;
try {
  scope = compileScope(
    [...NAMES, 'variantLabel'].map((n) => extractFunction(src, n, 'index.html')),
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
  t.check((src.match(/data-tab="media"/g) || []).length >= 2,
    'and can be reached from both the topbar and the phone sheet');
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

  /* The abandoned-form cleanup only ever touches this session's genuinely
     new uploads. */
  const discard = extractFunction(src, 'discardUnsavedProductImages', 'index.html');
  t.check(/ids\.includes\(m\.id\)/.test(discard) && /mediaUsage\(m\.url\)\.length === 0/.test(discard),
    'the cleanup drops only session uploads that nothing kept and nothing uses');
  t.check(/\} else if\(mpState\.sessionTrack\)\{[\s\S]{0,400}?sessionUploadedMediaIds\.push\(res\.media\.id\);/.test(src),
    'and a photo merely REUSED from the library is never put on the cleanup list');

  /* The sync plumbing: loaded in step, seeded in lastSynced (or a photo
     deleted before the first save would quietly come back), and diffed. */
  t.check(/loansR,\s*\n\s*mediaR, mediaFoldersR,\s*\n\s*rentAgreementsR/.test(src)
    && /sel\('loans'\),\s*\n\s*sel\('media'\), sel\('media_folders'\),\s*\n\s*sel\('rent_agreements'\)/.test(src),
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
