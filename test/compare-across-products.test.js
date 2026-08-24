#!/usr/bin/env node
'use strict';
/*
 * Comparing DIFFERENT products against each other.
 *
 * Ranking suppliers of one product is easy: they are all quoting the same
 * thing, so the smallest number wins. Ranking different products is not,
 * and this shop's own catalogue says why. Fasteners / Self Drilling:
 *
 *     RIDER       per Box     5 Box  / Ctn    Haidery
 *     SJS         per Pack    8 Pack / Ctn    SJS Enersol
 *     Flat Head   per Box    20 Box  / Ctn    SJS Enersol
 *     PATTA       per Ctn     no pack size    Susan Patta
 *
 * "44,000 a Box" against "40,000 a Pack" is not a comparison. Nothing on
 * file says how many screws are in either, so sorting those two numbers
 * produces an answer that looks authoritative and is worth nothing. That
 * is the same shape as the carton price entered as a unit price, which
 * cost this shop 1.76m of phantom supplier debt and a shelf valued at five
 * times what it held.
 *
 * SO THE RULE THIS FILE DEFENDS: a row is ranked only on a basis every
 * entry in it actually supports, and a row with no shared basis is
 * labelled, not sorted. Declining to answer is the correct answer.
 *
 * The three bases, strongest first:
 *   piece  exact. Needs piecesPerUnit on BOTH sides.
 *   pack   both priced per pack of the same pack unit.
 *   unit   both quoting the same unit name.
 *
 * Run: node test/compare-across-products.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('compare across products');
const src = read('index.html');
// Comments stripped, so a source-reading check is never satisfied by the
// prose EXPLAINING the code rather than by the code.
//
// The lookbehind is not decoration. `accept="image/*"` on the media
// picker's file input opens what a naive stripper reads as a block
// comment, and the next closing marker is 104,248 characters further
// down the file -- so every id, class and attribute between them became
// invisible. A check for one of them could never pass, and worse, a
// negated check passed for free. A real comment opener is not preceded
// by a word character or a quote; `image/*` is.
const stripComments = (s) => s
  .replace(/(?<![\w"'])\/\*[\s\S]*?\*\//g, ' ')
  .split(/\r?\n/).map((l) => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');
const code = stripComments(src);

const data = { products: [], prices: [] };
const scope = compileScope([
  extractFunction(src, 'tiersForKind', 'index.html'),
  extractFunction(src, 'tieredUnitPrice', 'index.html'),
  extractFunction(src, 'purchasePriceAtQty', 'index.html'),
  extractFunction(src, 'cmpBasisFigures', 'index.html'),
  extractDeclaration(src, 'cmpUnitKey', 'index.html'),
  extractFunction(src, 'cmpSharedBasis', 'index.html'),
  extractDeclaration(src, 'CMP_BASIS_FIELD', 'index.html'),
  extractFunction(src, 'cmpBasisForSet', 'index.html'),
  extractDeclaration(src, 'cmpVariantKey', 'index.html'),
  extractFunction(src, 'cmpVariantRowsFor', 'index.html'),
  extractFunction(src, 'cmpNoBasisReason', 'index.html'),
  extractFunction(src, 'cmpMatrix', 'index.html'),
], {
  data,
  variantLabel: (combo) => Object.values(combo || {}).join(' / '),
  supplierName: (id) => 'S:' + id,
  // The matrix asks the same question the single-product view answers, so
  // the stub is the honest one: cheapest priced row first.
  rankedPurchaseRowsAtQty: (productId, variantIdx, qty) => data.prices
    .filter((r) => r.productId === productId && r.variantIdx === variantIdx)
    .map((r) => ({ ...r, purchasePrice: scope.purchasePriceAtQty(r, qty) }))
    .filter((r) => r.purchasePrice != null)
    .sort((a, b) => a.purchasePrice - b.purchasePrice),
}, ['cmpBasisFigures', 'cmpSharedBasis', 'cmpBasisForSet', 'cmpVariantRowsFor',
  'cmpNoBasisReason', 'cmpMatrix', 'purchasePriceAtQty']);

const row = (over) => Object.assign({
  productId: 'P1', variantIdx: 0, supplierId: 'A',
  unit: 'Box', packUnit: 'Ctn', packQty: 5, piecesPerUnit: null,
  wholesale: null, retail: 44000, tiers: [{ minQty: 1, price: 44000 }],
}, over);
const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);
const fig = (over, qty) => scope.cmpBasisFigures(row(over), qty == null ? 1 : qty);

/* ---------- 1. what one row can support ------------------------------- */
{
  const f = fig({});
  eq(f.unitPrice, 44000, 'the unit price is what the tier ladder says at this quantity');
  eq(f.packPrice, 220000, 'the pack price is that times the pack size');
  eq(f.piecePrice, null, 'and there is no price per piece until pieces are recorded');

  eq(fig({ piecesPerUnit: 100 }).piecePrice, 440, 'recorded pieces give an exact price per piece');
  eq(fig({ piecesPerUnit: 100 }).piecesPerPack, 500, 'and the pieces in a whole pack');

  // A pack size of 0 or 1 means the unit IS the pack. Multiplying by it
  // would invent a carton price for something never sold by the carton.
  eq(fig({ packQty: 0 }).packPrice, null, 'no pack size means no pack price');
  eq(fig({ packQty: 1 }).packPrice, null, 'and neither does a pack of one');

  // Zero and negative pieces are not readings. They divide.
  eq(fig({ piecesPerUnit: 0 }).piecePrice, null, 'zero pieces is unknown, not free');
  eq(fig({ piecesPerUnit: -5 }).piecePrice, null, 'and nor is a negative count');
  // retail cleared too: purchasePriceAtQty falls back to it, so a fixture
  // that only empties the tiers still has a price and proves nothing.
  eq(scope.cmpBasisFigures(row({ retail: null, wholesale: null, tiers: [{ minQty: 50, price: 40000 }] }), 1), null,
    'a row with no price at this quantity yields nothing rather than a zero');
}

/* ---------- 2. the basis two rows share ------------------------------- */
{
  const packB = fig({ unit: 'Pack', packQty: 8, retail: 40000, tiers: [{ minQty: 1, price: 40000 }] });

  eq(scope.cmpSharedBasis(fig({}), fig({})), 'pack',
    'without pieces, two rows packed in the same pack unit compare per pack');
  eq(scope.cmpSharedBasis(fig({ piecesPerUnit: 100 }), fig({ piecesPerUnit: 50 })), 'piece',
    'pieces on both sides beat the pack');
  eq(scope.cmpSharedBasis(fig({ piecesPerUnit: 100 }), fig({})), 'pack',
    'pieces on ONE side do not — that is the whole trap');
  eq(scope.cmpSharedBasis(packB, fig({})), 'pack',
    'different units still share a pack unit, so the carton price is the basis');
  eq(scope.cmpSharedBasis(fig({ packQty: 0, packUnit: '' }), fig({ packQty: 0, packUnit: '' })), 'unit',
    'no packs anywhere falls back to the shared unit name');
  eq(scope.cmpSharedBasis(fig({ unit: 'Box', packQty: 0, packUnit: '' }),
                          fig({ unit: 'Pack', packQty: 0, packUnit: '' })), null,
    'and different units with no pack and no pieces share nothing at all');

  // This shop's data holds both "Ctn" and "ctn" on the same product.
  eq(scope.cmpSharedBasis(fig({ packUnit: 'Ctn' }), fig({ packUnit: 'ctn' })), 'pack',
    'a pack unit is matched case-insensitively, because the catalogue holds both spellings');
  // A carton is not a bag, so the PACK basis is refused -- but both rows
  // still quote a Box, so the comparison drops to the unit rather than
  // vanishing. Falling all the way to null here would hide a real (if
  // weaker) comparison; ranking them per pack would invent one.
  eq(scope.cmpSharedBasis(fig({ packUnit: 'Ctn' }), fig({ packUnit: 'Bag' })), 'unit',
    'a carton is not a bag, so it falls back to the unit both still share');
  eq(scope.cmpSharedBasis(fig({ packUnit: 'Ctn', unit: 'Box' }),
                          fig({ packUnit: 'Bag', unit: 'Pack' })), null,
    'and when neither the pack nor the unit matches, there is no basis at all');
}

/* ---------- 3. the basis a whole ROW of the grid shares --------------- */
{
  eq(scope.cmpBasisForSet([fig({}), fig({}), fig({})]), 'pack', 'three rows in cartons compare per carton');
  eq(scope.cmpBasisForSet([fig({ piecesPerUnit: 100 }), fig({ piecesPerUnit: 50 }), fig({ piecesPerUnit: 20 })]), 'piece',
    'three rows with pieces compare per piece');

  /* The weakest link decides. Two of three having pieces must NOT rank
     those two per piece and leave the third out -- a column silently
     dropped from a comparison is how a buyer picks the wrong supplier. */
  eq(scope.cmpBasisForSet([fig({ piecesPerUnit: 100 }), fig({ piecesPerUnit: 50 }), fig({})]), 'pack',
    'one row without pieces drops the whole row to the pack');
  eq(scope.cmpBasisForSet([fig({}), fig({}), fig({ packUnit: 'Bag' })]), 'unit',
    'one row in a different pack unit drops the whole row to the unit they still share');
  eq(scope.cmpBasisForSet([fig({}), fig({}), fig({ packUnit: 'Bag', unit: 'Pack' })]), null,
    'and one row sharing neither leaves the row with no basis at all');

  eq(scope.cmpBasisForSet([fig({})]), null, 'one row alone is not a comparison');
  eq(scope.cmpBasisForSet([fig({}), null]), null, 'and neither is a row with only one live entry');

  /* Pairwise agreement is not set agreement: A and B can share a pack
     while B and C share a unit, and no single basis covers all three.
     Checked against the chosen basis, not merely pair by pair. */
  const a = fig({ packUnit: 'Ctn', unit: 'Box' });
  const b = fig({ packUnit: 'Ctn', unit: 'Box' });
  const c = fig({ packQty: 0, packUnit: '', unit: 'Box' });
  eq(scope.cmpBasisForSet([a, b, c]), 'unit',
    'a set falls to the basis ALL of it supports, not one two of them happen to agree on');

  /* And the fallen-to basis has to be confirmed, not assumed.
     Row 1 shares PIECES with row 0 and needs no matching unit to do so.
     Row 2 has no pieces and drags the set down to the unit -- which row 1
     does not share, because it is quoted in Packs and the others in Boxes.
     Taking the downgrade on trust ranks a Box against a Pack. */
  const p0 = fig({ unit: 'Box', packUnit: 'Ctn', piecesPerUnit: 100 });
  const p1 = fig({ unit: 'Pack', packUnit: 'Bag', piecesPerUnit: 50 });
  const p2 = fig({ unit: 'Box', packQty: 0, packUnit: '' });
  eq(scope.cmpBasisForSet([p0, p1, p2]), null,
    'a basis the set was downgraded TO is re-checked against every row, not assumed');

  /* The same, one rung up: row 1 shares pieces, row 2 shares only the
     pack, so the set falls to the pack -- and row 1's pack is a Bag while
     the others are Cartons. Every row has A pack price, so the null check
     passes; only comparing the pack NAMES catches it. */
  const q2 = fig({ unit: 'Box', packUnit: 'Ctn' });
  eq(scope.cmpBasisForSet([p0, p1, q2]), null,
    'including when the shared field exists on every row but names a different pack');

  /* And the case the NAME checks cannot see: a row that names a pack unit
     but leaves units-per-pack blank. Somebody typing "Ctn" and tabbing
     past the count produces exactly this. Every pack unit then reads
     "Ctn", so comparing the names finds nothing wrong -- while that row
     has no pack PRICE at all, and would drop silently out of the ranking
     rather than stopping it. A column quietly missing from a comparison
     is how a buyer picks the wrong supplier and never knows there was
     another. Only checking the field itself catches this one. */
  const named = fig({ unit: 'Pack', packUnit: 'Ctn', packQty: 0, piecesPerUnit: 50 });
  eq(named.packPrice, null, 'a named pack with no count has no pack price');
  eq(scope.cmpBasisForSet([p0, named, q2]), null,
    'and a row missing the chosen basis stops the ranking even when every pack NAME agrees');
}

/* ---------- 4. variants line up by name, never by position ------------ */
{
  data.products = [
    { id: 'P1', name: 'RIDER', variants: [{ combo: { Size: '1"' } }, { combo: { Size: '1.5"' } }, { combo: { Size: '2"' } }] },
    { id: 'P2', name: 'SJS',   variants: [{ combo: { Size: '2"' } }, { combo: { Size: '1"' } }] },
    { id: 'P3', name: 'FLAT',  variants: [{ combo: { Size: '4.2*19' } }] },
  ];
  data.prices = [
    row({ productId: 'P1', variantIdx: 0, retail: 44000, tiers: [{ minQty: 1, price: 44000 }] }),
    row({ productId: 'P1', variantIdx: 1, retail: 44000, tiers: [{ minQty: 1, price: 44000 }] }),
    row({ productId: 'P1', variantIdx: 2, retail: 44000, tiers: [{ minQty: 1, price: 44000 }] }),
    // SJS lists 2" FIRST. Matching by position would pair RIDER 1" with it.
    row({ productId: 'P2', variantIdx: 0, supplierId: 'B', unit: 'Pack', packQty: 8, retail: 90000, tiers: [{ minQty: 1, price: 90000 }] }),
    row({ productId: 'P2', variantIdx: 1, supplierId: 'B', unit: 'Pack', packQty: 8, retail: 10000, tiers: [{ minQty: 1, price: 10000 }] }),
    row({ productId: 'P3', variantIdx: 0, supplierId: 'C', retail: 5000, tiers: [{ minQty: 1, price: 5000 }] }),
  ];

  const m = scope.cmpMatrix('P1', ['P2', 'P3'], 1);
  eq(m.products.map((p) => p.name).join(','), 'RIDER,SJS,FLAT', 'the subject leads and the rivals follow');
  eq(m.rows.length, 3, "one row per size the SUBJECT sells");

  const oneInch = m.rows.find((r) => r.label === '1"');
  eq(oneInch.cells[1].row.variantIdx, 1,
    'RIDER 1" is matched to SJS\'s 1", which is its SECOND variant — by name, not by position');
  eq(Math.round(oneInch.cells[1].figures.packPrice), 80000, 'so the price compared is that size\'s price');
  eq(oneInch.bestIndex, 1, 'and the cheaper carton wins the row');

  const twoInch = m.rows.find((r) => r.label === '2"');
  eq(twoInch.cells[1].row.variantIdx, 0, 'and 2" matches SJS\'s first variant, the other way round');
  eq(twoInch.bestIndex, 0, 'where the subject is cheaper');

  // A size no rival sells is still a row, with an empty cell.
  const oneFive = m.rows.find((r) => r.label === '1.5"');
  eq(oneFive.cells[1], null, 'a size the rival does not sell leaves an empty cell');
  eq(oneFive.basis, null, 'which cannot be ranked');
  // And is not ranked. A row with no basis picking a winner anyway is the
  // exact failure this whole file exists to prevent, so it is asserted
  // rather than left implied by the basis being null.
  eq(oneFive.bestIndex, null, 'and nothing is badged cheapest in a row that cannot be compared');

  // Labels are normalised before matching, so spacing and case in a
  // hand-typed variant name do not silently break the pairing.
  data.products[1].variants = [{ combo: { Size: ' 2" ' } }, { combo: { Size: '1"' } }];
  const loose = scope.cmpMatrix('P1', ['P2'], 1);
  eq(loose.rows.find((r) => r.label === '2"').cells[1].row.variantIdx, 0,
    'a variant label matches despite stray spacing, rather than falling out of the grid');
  data.products[1].variants = [{ combo: { Size: '2"' } }, { combo: { Size: '1"' } }];
  t.check(/Only one of these/.test(oneFive.reason), `and says why (${oneFive.reason})`);

  // FLAT's 4.2*19 matches nothing and must be reported, not dropped.
  const un = m.unmatched.find((u) => u.name === 'FLAT');
  t.check(un && un.labels.includes('4.2*19'),
    'a rival size with no equivalent is reported rather than silently omitted');
  t.check(!m.rows.some((r) => r.label === '4.2*19'),
    'and is not invented as a row of the subject');
}

/* ---------- 5. a tie has no winner ------------------------------------ */
{
  data.products = [
    { id: 'P1', name: 'A', variants: [{ combo: { Size: '1"' } }] },
    { id: 'P2', name: 'B', variants: [{ combo: { Size: '1"' } }] },
  ];
  data.prices = [
    row({ productId: 'P1', variantIdx: 0, retail: 44000, tiers: [{ minQty: 1, price: 44000 }] }),
    row({ productId: 'P2', variantIdx: 0, supplierId: 'B', retail: 44000, tiers: [{ minQty: 1, price: 44000 }] }),
  ];
  const m = scope.cmpMatrix('P1', ['P2'], 1);
  eq(m.rows[0].basis, 'pack', 'two identical rows still share a basis');
  eq(m.rows[0].bestIndex, null,
    'but neither is badged cheapest — a tie is a real outcome and picking one invents a reason to prefer it');
}

/* ---------- 6. the reason names the missing fact ---------------------- */
{
  const boxF = fig({ unit: 'Box', packQty: 0, packUnit: '' });
  const packF = fig({ unit: 'Pack', packQty: 0, packUnit: '' });
  const why = scope.cmpNoBasisReason([boxF, packF]);
  t.check(/different units/i.test(why) && /Box/.test(why) && /Pack/.test(why),
    `it names the units that disagree (${why})`);
  t.check(/pieces in one unit/i.test(why),
    'and the field that would fix it, because "not comparable" on its own is a shrug');
  t.check(/Only one/.test(scope.cmpNoBasisReason([boxF, null])),
    'a row with a single live entry says so instead');
}

/* ---------- 7. the field, and the round trip -------------------------- */
{
  t.check(/id="pr_pieces_per_unit"/.test(code), 'the Price Registry can record pieces per unit');
  /* The rule lives in one place now that the figure arrives from two --
     the shared box and a variant's own card. Checked where it lives, and
     checked that the DOM reader routes through it rather than keeping a
     second copy that could drift from this one. */
  const guard = (/function piecesPerUnitOrNull\(raw\)[\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(/if\(raw === '' \|\| raw == null\) return null;/.test(guard),
    'a blank stays null rather than becoming a zero that divides');
  t.check(/isNaN\(n\) \|\| n <= 0\) \? null : n/.test(guard),
    'and so does zero, a negative, or junk');
  const fn = (/function prPiecesPerUnitValue\(\)[\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(/piecesPerUnitOrNull\(/.test(fn),
    'and the box reads it through that one guard, so there is no second copy to disagree');

  // Absence has to survive the trip to the server and back as absence.
  t.check(/piecesPerUnit: pr\.pieces_per_unit == null \? null : Number\(pr\.pieces_per_unit\)/.test(code),
    'loading keeps "not recorded" distinct from zero');
  t.check(/pieces_per_unit: pr\.piecesPerUnit == null \? null : Number\(pr\.piecesPerUnit\)/.test(code),
    'and so does saving');
  t.check(/piecesPerUnit: prPiecesPerUnitValue\(\)/.test(code),
    'the save reads it through the guard rather than off the input');
  t.check(/document\.getElementById\('pr_pieces_per_unit'\)\.value = r\.piecesPerUnit \|\| ''/.test(code),
    'editing an entry shows what it already holds');
  t.check(/document\.getElementById\('pr_pieces_per_unit'\)\.value = '';/.test(code),
    'and the form is cleared between entries, so one row’s count cannot leak into the next');
}

/* ---------- 8. the two views do not run at once ----------------------- */
{
  const render = (/function renderCompare\(\)[\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(/if\(cmpRivalIds\.length\)\{ cmpRenderMatrix\(wrap, productId, cmpQty\(\)\); return; \}/.test(render),
    'adding a rival switches to the cross-product grid instead of stacking a second table under the first');
  /* Scoped to the SEARCH handler. `cmpRivalIds = [];` also appears in
     cmpRenderRivalBar, where it clears rivals for a product that has
     none — so a file-wide match was satisfied by that line and passed
     with the reset here deleted, leaving hinges compared against screws.
     The same shape of hole as an updater nothing calls. */
  const searchHandler = (/cmp_search'\)\.addEventListener\('input',[\s\S]*?\n\}\);/.exec(code) || [''])[0];
  t.check(searchHandler.length > 0, 'the subject search box has an input handler');
  t.check(/cmpRivalIds = \[\];/.test(searchHandler),
    'and changing the subject clears the rivals there, so screws are never compared with hinges');
}

process.exit(t.done() ? 1 : 0);
