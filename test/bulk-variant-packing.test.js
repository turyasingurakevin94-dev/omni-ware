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

const NAMES = ['piecesPerUnitOrNull', 'packingSignature', 'effectiveVariantPacking', 'deriveWholesaleRetail', 'tierUnitOptionsHTML', 'pendingTierEntry'];
const fn = compileScope(NAMES.map((n) => extractFunction(src, n, 'index.html')),
  { esc: (x) => String(x == null ? '' : x) }, NAMES);

/* Four fields, not three. How many pieces are in one unit is packing --
   a fact about how the thing comes -- so it rides the same resolution as
   the rest of it rather than a rule of its own. */
const pk = (unit, packUnit, packQty, piecesPerUnit = null) =>
  ({ unit, packUnit, packQty, piecesPerUnit });
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
  /* Two variants packed 25 to a bag are not packed the same way when one
     is 100 screws to the Kg and the other 60. Calling them shared is what
     fills the default box from one and writes it over the other. */
  t.check(sig(pk('Kg', 'Bag', 25, 100)) !== sig(pk('Kg', 'Bag', 25, 60)),
    'a different count of pieces in the unit is different packing');
  eq(sig(pk('Kg', 'Bag', 25, 100)), sig(pk('Kg', 'Bag', 25, '100')),
    'and one typed as text signs the same as one that arrived as a number');
  /* Not recorded, recorded as nothing, and recorded as a number that
     cannot be true are one claim: nobody said. They must not sign as
     three different packings, or a catalogue of rows that never answered
     the question would read as all differently packed. */
  eq(sig(pk('Kg', 'Bag', 25, null)), sig(pk('Kg', 'Bag', 25, 0)),
    'while unrecorded and zero are the same claim — nobody said');
  eq(sig(pk('Kg', 'Bag', 25, null)), sig(pk('Kg', 'Bag', 25, '')),
    'and so is a box left empty');
  eq(sig({}), '||0|', 'and an empty one reads as blank, blank, nought, unknown');
}

/* ---------- 1b. the piece count follows the same precedence ---------- */
/*
 * It used to follow nothing at all. buildVariantPriceRow simply had no
 * piecesPerUnit key, so every bulk save replaced the row it found with
 * one that had lost the figure -- silently, on a save that touched
 * nothing else.
 */
{
  const f = fn.effectiveVariantPacking;
  const shared = pk('Pc', 'Ctn', 12, 100);
  const own = pk('Pc', 'Ctn', 12, 60);
  const mine = pk('Pc', 'Ctn', 12, 25);

  eq(f(mine, shared, own, true).piecesPerUnit, 25,
    'a variant that says how many pieces are in ITS unit keeps that, default or no default');
  eq(f(null, shared, own, true).piecesPerUnit, 100,
    'a typed default reaches the variants that never said');
  /* The one that was losing data. The default box shows something
     whether or not anybody typed in it. */
  eq(f(null, shared, own, false).piecesPerUnit, 60,
    'and an untouched default leaves a variant on the count it already had');
  eq(f(null, shared, null, false).piecesPerUnit, 100,
    'a variant with nothing on file follows the default, having nothing to protect');

  // The rule the whole figure rests on, applied wherever it now arrives.
  eq(f(pk('Pc', 'Ctn', 12, ''), shared, own, false).piecesPerUnit, null,
    'a blank box on a variant card is "unknown", not a fallback to the default');
  eq(f(pk('Pc', 'Ctn', 12, 0), shared, own, false).piecesPerUnit, null,
    'zero is not a count — it divides, and would take the comparison with it');
  eq(f(pk('Pc', 'Ctn', 12, -5), shared, own, false).piecesPerUnit, null, 'nor is a negative');
  eq(f(pk('Pc', 'Ctn', 12, 'abc'), shared, own, false).piecesPerUnit, null, 'nor junk');
  eq(f(pk('Pc', 'Ctn', 12, '100'), shared, own, false).piecesPerUnit, 100,
    'while a real count typed into an input arrives as a number');
}

/* ---------- 1c. and the row that is saved actually carries it -------- */
{
  const row = extractFunction(src, 'buildVariantPriceRow', 'index.html');
  t.check(/piecesPerUnit: piecesPerUnitOrNull\(pack\.piecesPerUnit\)/.test(row),
    'the saved row carries the count — its absence was the whole leak');
  /* Absent is not the same as null here: the bulk save writes
     `{...record, id: keep.id}` over the row it found, so a key that is
     simply missing takes the old value with it. */
  t.check(/piecesPerUnit/.test(row), 'the key is present on the object, not merely null-able');

  const grad = code.slice(code.indexOf('const slots = record.variants.length'));
  t.check(!/id: allocRowId\('price'\), piecesPerUnit: null/.test(grad.slice(0, 2000)),
    'and a lead graduating into a product no longer throws the researcher’s count away');
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
  /* The box was left blank on every variable product no matter what was
     on file -- so it opened empty, saved back as nothing, and took the
     figure with it. */
  t.check(/getElementById\('pr_pieces_per_unit'\)\.value =\s*\n?\s*packSample && packSample\.piecesPerUnit/.test(load),
    'opening a variable product fills the piece count from what is on file');
  t.check(/piecesPerUnit: r\.piecesPerUnit \? String\(r\.piecesPerUnit\) : ''/.test(load),
    'and a differently-packed variant opens with its own count on its card');
  t.check(/piecesPerUnit: document\.getElementById\('pr_pieces_per_unit'\)\.value/.test(load),
    'the prefill remembers it, so the save can tell typed-in from merely shown');
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

/* ---------- 4c. a price typed but never added -------------------------- */
/*
 * REPORTED, and it cost real data. Packing was set on a variant and a
 * quantity and price typed into its tier row, then "Save price" pressed
 * without touching "+ Add tier". The save only ever read COMMITTED tiers,
 * so those two figures were dropped without a word -- and because they
 * were that variant's only price, the variant was skipped entirely and
 * its packing went with it. Reopening showed a variant with nothing on
 * it, and no way to tell that anything had been lost.
 */
{
  const f = fn.pendingTierEntry;

  eqJ(f('20', '245000', 'unit', 'unit', 0).tier, { minQty: 20, price: 245000 },
    'two figures left in the boxes are a tier, and pressing Save means them');

  /* Converted exactly as the "+ Add tier" button converts, or a tier
     committed by the save would mean something else than the same
     numbers committed by the button. */
  eqJ(f('1', '100000', 'pack', 'pack', 20).tier, { minQty: 20, price: 5000 },
    'per-pack figures are converted against the pack size, same as the button does');
  eqJ(f('2', '9000', 'pack', 'unit', 5).tier, { minQty: 10, price: 9000 },
    'a per-pack quantity with a per-unit price converts only the quantity');

  // The ordinary case: nothing typed, nothing to commit.
  eq(f('', '', 'unit', 'unit', 0), null, 'empty boxes are not a tier');
  eq(f(null, undefined, 'unit', 'unit', 0), null, 'and neither is nothing at all');
  eq(f('0', '0', 'unit', 'unit', 0), null, 'nor a pair of noughts');

  /* HALF A TIER IS NOT A PRICE. Guessing the missing half is how a
     quantity becomes a price or a price becomes free. */
  eq(f('20', '', 'unit', 'unit', 0).missing, 'price', 'a quantity with no price says which half is missing');
  eq(f('', '245000', 'unit', 'unit', 0).missing, 'quantity', 'and a price with no quantity');
  t.check(f('20', '', 'unit', 'unit', 0).tier === undefined,
    'and neither is turned into a tier by filling in the blank');
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

  /* A card the admin has deliberately customised has to be findable
     without reading all of them. Every card looked identical, so on a
     twenty-two variant product nothing said which ones had been touched
     -- while both toggles wore the brand's red on every card, which is
     forty-four red links saying nothing is different. The accent belongs
     on the difference, not on the control that offers it. */
  t.check(/class="variant-card\$\{\(override \|\| packOverride\) \? ' has-own' : ''\}"/.test(rows),
    'a card carrying its own packing or its own ladder is marked as such');
  t.check(/class="pr-bulk-tier-status\$\{packOverride \? ' is-own' : ''\}"/.test(rows)
    && /class="pr-bulk-tier-status\$\{override \? ' is-own' : ''\}"/.test(rows),
    'and each of the two states says which of them differs');
  const cardOwn = (/\.variant-card\.has-own\{[^}]*\}/.exec(src) || [''])[0];
  t.check(/var\(--accent\)/.test(cardOwn),
    'the marked card is where the accent goes');
  ['.pr-bulk-tier-toggle', '.pr-bulk-pack-toggle'].forEach(sel=>{
    const rule = (new RegExp('\\' + sel + '\\{[^}]*\\}').exec(src) || [''])[0];
    t.check(/color:var\(--ink-soft\)/.test(rule) && !/color:var\(--accent\)/.test(rule),
      `${sel} is a quiet control rather than one more alarm (${rule.slice(0, 90)})`);
  });

  // The same icon the two ladders above it already use.
  t.check(/class="pr-bulk-tier-add btn-icon"[^>]*><svg class="icon"/.test(rows)
    && !/>\+ Add tier</.test(rows),
    'the per-variant Add tier carries the icon rather than a typed plus, as the shared one does');

  const add = extractFunction(src, 'addBulkVariantTier', 'index.html');
  t.check(/const ov = S\.getPackOverrides\(\)\[idx\];/.test(add)
    && /const packQty = ov \? \(Number\(ov\.packQty\)\|\|0\) : \(Number\(S\.getPack\(\)\.packQty\)\|\|0\);/.test(add),
    'and "per pack" is converted using the variant\'s own pack size, not the default one');

  const save = /getElementById\('pr_save'\)\.addEventListener\('click', \(\)=>\{([\s\S]*?)\n\}\);/.exec(src);
  const body = save ? save[1] : '';
  t.check(!!save, 'the save handler is there to check');
  t.check(/const rowPack = effectiveVariantPacking\(prBulkPackOverrides\[i\], sharedPack, keep, packEdited\);/.test(body),
    'the save asks the same question this file tests, rather than deciding again in its own words');
  /* The derivation moved into buildVariantPriceRow, which the sourcing
     funnel writes its rows through too -- so this claim is now made once
     for both screens rather than once for this one. */
  t.check(/tiers: effectiveTiers, pack: rowPack/.test(body)
    && /deriveWholesaleRetail\(tiers, pack\.packQty\)/.test(extractFunction(src, 'buildVariantPriceRow', 'index.html')),
    'and the wholesale split is derived against the packing the row ends up with');
  t.check(/unit: pack\.unit, packUnit: pack\.packUnit, packQty: pack\.packQty/
    .test(extractFunction(src, 'buildVariantPriceRow', 'index.html')),
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

  /* Committed BEFORE the save reads prTiers, or a figure typed into the
     shared row would not even count as having edited the default. */
  t.check(/const sharedPending = pendingTierEntry\(/.test(body),
    'the shared tier row is read on save, not only when "+ Add tier" is pressed');
  t.check(/if\(!prBulkVariantOverrides\[i\]\) continue;/.test(body)
    && /const pending = pendingTierEntry\(q\.value, pr\.value,/.test(body),
    'and so is each variant\'s own tier row');

  /* Reading the boxes is only half of it — what is read has to reach the
     ladder. Pinned on the commit itself, because a guard that never fires
     leaves every "is it read?" check above passing while the figures go
     in the bin exactly as before. */
  t.check(body.includes('if(sharedPending && !prTiers.some(t=> t.minQty === sharedPending.tier.minQty)){')
    && body.includes('prTiers.push(sharedPending.tier);'),
    'a figure typed into the shared row actually joins the shared ladder');
  t.check(body.includes('if(pending && !prBulkVariantOverrides[i].some(t=> t.minQty === pending.tier.minQty)){')
    && body.includes('prBulkVariantOverrides[i].push(pending.tier);'),
    'and one typed into a variant\'s row joins that variant\'s ladder');
  /* Not committed twice: the button may already have added this rung. */
  t.check(/!prTiers\.some\(t=> t\.minQty === sharedPending\.tier\.minQty\)/.test(body),
    'a rung already on the ladder is not added a second time');
  t.check(body.indexOf('sharedPending') < body.indexOf('const tiersEdited'),
    'both are committed before the save decides what was edited and what to write');
  t.check(/if\(sharedPending && sharedPending\.missing\)/.test(body)
    && /is missing a \$\{pending\.missing\}/.test(body),
    'a half-filled row stops the save and names the variant, rather than being guessed at');

  /* Packing lives on a price row, so a variant given packing and no price
     has nowhere to keep it. Allowed, but not in silence. */
  t.check(/else if\(prBulkPackOverrides\[i\]\) packingWithNoPrice\+\+;/.test(body),
    'a variant given its own packing but no price is counted');
  t.check(/had packing but no price, so nothing was saved for/.test(body),
    'and the save says so instead of dropping it quietly');
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
