#!/usr/bin/env node
'use strict';
/*
 * Packing per variant, inside the bulk price entry.
 *
 * The packing fields were one shared set for the whole save, and the note
 * under them told anyone with a differently-packed variant to leave and
 * price that one on its own -- one modal per variant, which is the exact
 * errand bulk mode exists to remove. Now they are a DEFAULT, and any
 * variant this supplier packs differently carries its own.
 *
 * WHY THIS IS NOT A LABELLING FEATURE. packQty is not decoration: it is
 * what splits a tier ladder into a wholesale side and a retail side
 * (deriveWholesaleRetail). Give a variant the wrong pack size and the same
 * numbers are re-read as meaning something else -- a variant whose pack
 * size grew loses its wholesale price outright, with nothing on screen
 * saying so. So the order of precedence below is a data-integrity rule,
 * not a convenience:
 *
 *   1. this variant's own packing, if one was set for it
 *   2. the default, but only if the default was actually typed into
 *   3. otherwise whatever this variant already had on file
 *
 * Three is the one that stops an untouched form flattening a catalogue.
 *
 * Run: node test/bulk-variant-packing.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('bulk variant packing');
const src = read('index.html');
const code = src.split(/\r?\n/).map((l) => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');

const NAMES = ['packingSignature', 'effectiveVariantPacking', 'deriveWholesaleRetail', 'tierUnitOptionsHTML'];
const fn = compileScope(NAMES.map((n) => extractFunction(src, n, 'index.html')),
  { esc: (x) => String(x == null ? '' : x) }, NAMES);

const pk = (unit, packUnit, packQty) => ({ unit, packUnit, packQty });
const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);
const eqJ = (got, want, msg) => t.check(JSON.stringify(got) === JSON.stringify(want),
  `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);

/* ---------- 1. is this the same packing? ----------------------------- */
{
  const sig = fn.packingSignature;
  eq(sig(pk('Pc', 'Ctn', 12)), sig(pk('Pc', 'Ctn', 12)), 'the same packing signs the same');
  t.check(sig(pk('Pc', 'Ctn', 12)) !== sig(pk('Pc', 'Ctn', 5)),
    'a different pack size is different packing — it is what decides wholesale');
  t.check(sig(pk('Pc', 'Ctn', 12)) !== sig(pk('Pc', 'Box', 12)), 'and so is a different pack unit');
  t.check(sig(pk('Kg', 'Bag', 25)) !== sig(pk('Pc', 'Bag', 25)), 'and a different unit');
  eq(sig(pk('Pc', 'Ctn', 12)), sig(pk(' Pc ', ' Ctn ', 12)), 'padding is not a difference');
  eq(sig(pk('Pc', 'Ctn', 12)), sig({ unit: 'Pc', packUnit: 'Ctn', packQty: '12' }),
    'nor is a pack size that arrived as text');
  eq(sig(null), '', 'no packing signs as nothing');
  eq(sig({}), '|' + '|0', 'and an empty one reads as blank, blank, nought');
}

/* ---------- 2. which packing a variant is saved with ----------------- */
{
  const f = fn.effectiveVariantPacking;
  const shared = pk('Pc', 'Ctn', 12);
  const own = pk('Pc', 'Ctn', 5);
  const mine = pk('Pair', 'Box', 20);

  eqJ(f(mine, shared, own, false), pk('Pair', 'Box', 20),
    'a variant with its own packing keeps it, whatever the default says');
  eqJ(f(mine, shared, own, true), pk('Pair', 'Box', 20),
    'even when the default was just typed into — the more specific statement wins');

  eqJ(f(null, shared, own, true), pk('Pc', 'Ctn', 12),
    'a typed default reaches the variants that have none of their own');

  /* THE ONE THAT PROTECTS A CATALOGUE. The default boxes show something
     whether or not anybody typed in them. Writing an untouched default
     over a variant packed 5 to a carton would re-read its ladder against
     12 and drop its wholesale rate. */
  eqJ(f(null, shared, own, false), pk('Pc', 'Ctn', 5),
    'an untouched default leaves a variant on the packing it already had');

  eqJ(f(null, shared, null, false), pk('Pc', 'Ctn', 12),
    'a variant with nothing on file follows the default, having nothing to protect');

  // Shapes that arrive from inputs, which are always strings.
  eqJ(f({ unit: ' Pc ', packUnit: ' Ctn ', packQty: '5' }, shared, null, false), pk('Pc', 'Ctn', 5),
    'a pack size typed as text is stored as a number, trimmed');
  eqJ(f({ unit: '', packUnit: '', packQty: '' }, shared, own, false), pk('', '', 0),
    'and clearing the boxes means no packing, not "fall back to the default"');
}

/* ---------- 3. why the precedence matters at all --------------------- */
/*
 * Stated in the currency the shop actually loses: the same ladder, read
 * against two pack sizes, is two different prices.
 */
{
  const ladder = [{ minQty: 1, price: 20000 }, { minQty: 5, price: 15000 }];
  const right = fn.deriveWholesaleRetail(ladder, 5);
  const flattened = fn.deriveWholesaleRetail(ladder, 12);
  eq(right.wholesale, 15000, 'against its own pack size the variant has a bulk rate');
  eq(right.retail, 20000, 'and a retail one');
  eq(flattened.wholesale, null,
    'against the default pack size the SAME ladder has no bulk rate at all — this is what the precedence prevents');
}

/* ---------- 4. the default is only shown as shared when it is --------- */
{
  const load = extractFunction(src, 'renderPrBulkVariants', 'index.html');
  t.check(/const packSigs = variantRows0\.filter\(Boolean\)\.map\(r=> packingSignature\(r\)\);/.test(load),
    'every variant this supplier prices is compared, not just the first row');
  /* Where packing parts company with the price ladder above: an unpriced
     variant has no packing to disagree with, and packing is never written
     to a variant that has no tiers, so counting them as "differently
     packed" would only empty the default on a product that has one. */
  t.check(/Packing invents nothing/.test(src),
    'and variants this supplier has never priced are left out, for a stated reason');
  t.check(/const packTrulyShared = packSigs\.length > 0 && packSigs\.every\(sig=> sig === sharedPackSig\);/.test(load),
    'the default boxes fill only when every variant really is packed that way');
  t.check(/const packSample = packTrulyShared \? variantRows0\.find\(Boolean\) : null;/.test(load),
    'and stay empty otherwise, rather than showing one variant\'s packing as everybody\'s');
  /* When they differ, each priced variant must arrive already carrying
     its own — otherwise opening the form shows them all as following a
     default they do not follow. */
  t.check(/prBulkPackOverrides = variantRows0\.map\(r=> \(r && !packTrulyShared\)/.test(load),
    'and each priced variant opens carrying the packing it actually has');
}

/* ---------- 4b. the per-pack choice on a variant's own packing -------- */
/*
 * REPORTED. A variant set to 20 Pcs to a Bundle was offered only "per
 * unit" when entering its tiers -- the card copied its dropdown options
 * off the SHARED control, which knew nothing about that variant's bundle.
 * So the one packing the person had just typed in was the one thing they
 * could not price against.
 */
{
  const opts = fn.tierUnitOptionsHTML;
  const bundle = opts('Pcs', 'Bundle', 20);
  t.check(/value="pack"/.test(bundle),
    'packing with a pack unit and a pack size offers the per-pack choice');
  t.check(/per Bundle \(20 Pcs\)/.test(bundle),
    `named after that packing, so it reads as the thing on the card (${bundle})`);
  t.check(/per Pcs/.test(bundle), 'and the single-unit choice is named after its own unit');

  /* The three ways there is no pack to price by. Offering "per pack" for
     any of them would divide a typed price by nought. */
  t.check(!/value="pack"/.test(opts('Pcs', '', 20)), 'no pack unit, no per-pack choice');
  t.check(!/value="pack"/.test(opts('Pcs', 'Bundle', 0)), 'nor with a pack size of nought');
  t.check(!/value="pack"/.test(opts('Pcs', 'Bundle', '')), 'nor with the pack size left blank');
  t.check(/per unit/.test(opts('', '', 0)),
    'and packing with no unit at all still offers something to price by');
  t.check(/value="pack"/.test(opts(' Pcs ', ' Bundle ', '20')),
    'values arriving from inputs — padded, and numbers as text — still resolve');
}

/* ---------- 5. wired into the card and the save ---------------------- */
{
  const rows = extractFunction(src, 'renderPrBulkVariantRows', 'index.html');
  t.check(/Set packing for this variant/.test(rows) && /Use default packing instead/.test(rows),
    'each variant card can take its own packing, and give it back');
  t.check(/class="pr-bulk-pack-unit"/.test(rows) && /class="pr-bulk-pack-punit"/.test(rows)
    && /class="pr-bulk-pack-qty"/.test(rows),
    'with all three fields, since any of them can differ');
  t.check(/data-idx="\$\{i\}"/.test(rows),
    'carrying the real variant index, like every other control on the card');

  /* Built per card, not copied off the shared control -- that copy is
     what left a variant unable to price by its own bundle. */
  t.check(/const pkOptions = tierUnitOptionsHTML\(pk\.unit, pk\.packUnit, pk\.packQty\);/.test(rows),
    'each card builds its unit choices from the packing that card is priced against');
  t.check(/class="pr-bulk-tier-qty-unit" data-idx="\$\{i\}">\$\{pkOptions\}/.test(rows)
    && /class="pr-bulk-tier-price-unit" data-idx="\$\{i\}">\$\{pkOptions\}/.test(rows),
    'and uses them for both the quantity and the price');
  t.check(!/\$\{unitOptionsHTML\}/.test(rows),
    'rather than the shared control\'s options, which know nothing of this variant');

  /* A chip reading "1 Ctn+" has to mean THIS variant's carton. */
  t.check(/prTierChipLabel\(t, pk\.unit, pk\.packUnit, pk\.packQty\)/.test(rows),
    'the tier chips are labelled against the variant\'s own packing');

  const add = extractFunction(src, 'addBulkVariantTier', 'index.html');
  t.check(/const ov = prBulkPackOverrides\[idx\];/.test(add)
    && /const packQty = ov \? \(Number\(ov\.packQty\)\|\|0\) : \(Number\(document\.getElementById\('pr_pack_qty'\)\.value\)\|\|0\);/.test(add),
    'and "per pack" is converted using the variant\'s own pack size, not the default one');

  const save = /getElementById\('pr_save'\)\.addEventListener\('click', \(\)=>\{([\s\S]*?)\n\}\);/.exec(src);
  const body = save ? save[1] : '';
  t.check(!!save, 'the save handler is there to check');
  t.check(/const rowPack = effectiveVariantPacking\(prBulkPackOverrides\[i\], sharedPack, keep, packEdited\);/.test(body),
    'the save asks the same question this file tests, rather than deciding again in its own words');
  t.check(/deriveWholesaleRetail\(effectiveTiers, rowPackQty\)/.test(body),
    'and the wholesale split is derived against the packing the row ends up with');
  t.check(/packQty: rowPackQty/.test(body) && /unit: rowUnit/.test(body) && /packUnit: rowPackUnit/.test(body),
    'which is what gets written');

  /* A save that drops a bulk rate has always said so. Now that variants
     can be packed differently it has to name the pack size the rate was
     lost AT -- quoting the default at somebody whose variant comes five
     to a carton names a number that appears nowhere in their data. */
  t.check(/lostWholesale\+\+; lostAt\.push\(rowPackQty\);/.test(body),
    'the pack size a bulk rate was lost at is the row\'s own, not the default');
  t.check(/\[\.\.\.new Set\(lostAt\)\]/.test(body),
    'and the warning names those rather than the shared field');
  t.check(!/no price set at \$\{packQty\}\+/.test(body),
    'the default pack size is no longer quoted as though it were every row\'s');
}

/* ---------- 6. the copy no longer sends people away ------------------ */
{
  t.check(!/price those ones separately by picking the specific variant\.<\/p>/.test(src),
    'the note telling people to leave and price variants one at a time is gone from the markup');
  const mode = extractFunction(src, 'setPrBulkMode', 'index.html');
  t.check(/Set packing for this variant/.test(mode),
    'and bulk mode points at the control that replaced that errand');
}

process.exit(t.done() ? 1 : 0);
