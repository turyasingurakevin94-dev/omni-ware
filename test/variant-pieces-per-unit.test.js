#!/usr/bin/env node
'use strict';
/*
 * How many pieces are in one unit, said per variant.
 *
 * THE FIELD THE SHOP ASKED FOR, and the four faults underneath it. The
 * supplier form asks "Pieces in one unit" once, at the top, and the
 * variant cards below it -- which already let a variant say it is packed
 * differently -- had no way to say this. That was the request. What was
 * actually wrong was worse, and all of it was one omission: the count was
 * never made part of PACKING, though that is exactly what it is.
 *
 *   the row builder    buildVariantPriceRow had no piecesPerUnit key at
 *                      all. The bulk save writes `{...record, id: keep.id}`
 *                      over the row it found, so a key that is merely
 *                      ABSENT takes the old value with it. Every bulk
 *                      save nulled the count, on a save that touched
 *                      nothing else and said nothing about it.
 *   the shared box     visible in bulk mode, typed into, and read by
 *                      nobody: getPack() did not return it and
 *                      effectiveVariantPacking did not carry it.
 *   opening the form   the box was never filled from what was on file for
 *                      a variable product, so it opened blank however
 *                      much was recorded -- and then saved that blank.
 *   the signature      packingSignature ignored it, so two variants at
 *                      100 and 60 pieces to the Kg counted as "packed the
 *                      same", filled the default from one of them and
 *                      wrote it over the other.
 *
 * The last one is why the seeding in toggleBulkVariantPacking is
 * defensible at all, and section 5 is about that interlock: a seeded
 * count is a claim nobody typed, and a fabricated count is worse than no
 * count, because absence is reported as unknown while a wrong number is
 * reported as a RANKED per-piece price.
 *
 * Run: node test/variant-pieces-per-unit.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('per-variant pieces per unit');
const src = read('index.html');
const code = src.split(/\r?\n/).map((l) => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');

const NAMES = ['piecesPerUnitOrNull', 'packingSignature', 'effectiveVariantPacking',
  'buildVariantPriceRow', 'deriveWholesaleRetail'];
const fn = compileScope(NAMES.map((n) => extractFunction(src, n, 'index.html')), {}, NAMES);
const { effectiveVariantPacking: eff, buildVariantPriceRow: build, packingSignature: sig } = fn;

const pack = (over) => Object.assign({ unit: 'Kg', packUnit: 'Bag', packQty: 25, piecesPerUnit: null }, over);
const rowFor = (p) => build({ productId: 'P1', variantIdx: 0, supplierId: 'S1',
  tiers: [{ minQty: 1, price: 20000 }], pack: p, sku: '', date: '2026-08-24' });

/* ---------- 1. the leak: a save that touched nothing else ------------- */
/*
 * The one that was destroying data. Reproduced as the save itself does
 * it -- spread over the row it found, which is why an ABSENT key and a
 * null one are not the same thing here.
 */
{
  const onFile = { id: 7, productId: 'P1', variantIdx: 0, supplierId: 'S1',
    unit: 'Kg', packUnit: 'Bag', packQty: 25, piecesPerUnit: 100, outOfStock: false };

  // Nothing was typed: no override, an untouched default. The packing
  // resolves to what the row already had, and so must the count.
  const resolved = eff(null, pack({ piecesPerUnit: null }), onFile, false);
  t.check(resolved.piecesPerUnit === 100,
    `an untouched form resolves to the count already on file (got ${resolved.piecesPerUnit})`);

  const saved = { ...rowFor(resolved), id: onFile.id, outOfStock: onFile.outOfStock };
  t.check('piecesPerUnit' in saved,
    'the row the save writes HAS the key — absent is not null when it is spread over the old row');
  t.check(saved.piecesPerUnit === 100,
    `so re-saving a variable product no longer wipes the count (got ${saved.piecesPerUnit})`);
  t.check(saved.packQty === 25 && saved.unit === 'Kg',
    'while the rest of the packing comes through as it always did');
}

/* ---------- 2. the shared box now reaches the variants ---------------- */
{
  t.check(/piecesPerUnit: prPiecesPerUnitValue\(\),/.test(code),
    'the default box is part of the packing the variant cards are given');
  const surface = code.slice(code.indexOf('function prBulkPriceSurface()'));
  t.check(/getPack: \(\)=> \(\{[\s\S]{0,240}piecesPerUnit: prPiecesPerUnitValue\(\)/.test(surface),
    'through getPack, which is what every card reads its default from');

  const typed = eff(null, pack({ piecesPerUnit: 100 }), null, true);
  t.check(typed.piecesPerUnit === 100, 'a count typed into the default reaches a variant with none of its own');

  const sharedRow = rowFor(typed);
  t.check(sharedRow.piecesPerUnit === 100, 'and lands on that variant’s saved row');
}

/* ---------- 3. a variant that says its own -------------------------- */
{
  const own = eff(pack({ packQty: 10, piecesPerUnit: 60 }), pack({ piecesPerUnit: 100 }), null, true);
  t.check(own.piecesPerUnit === 60,
    'a variant’s own count beats the default, exactly as its own pack size does');
  t.check(own.packQty === 10, 'and it keeps its own pack size at the same time');

  /* Pieces is counted PER THE VARIANT'S OWN UNIT, which is the argument
     for the box living inside the Own-packing block rather than beside
     it: a variant that overrides its unit to Pc must have its count read
     against Pc, not against the default's Kg. */
  const otherUnit = eff(pack({ unit: 'Pc', piecesPerUnit: 1 }), pack({ unit: 'Kg', piecesPerUnit: 100 }), null, true);
  t.check(otherUnit.unit === 'Pc' && otherUnit.piecesPerUnit === 1,
    'a variant that overrides its unit carries the count belonging to that unit');
}

/* ---------- 4. blank is unknown, and stays unknown ------------------- */
/*
 * The rule the whole figure rests on. The count is a DIVISOR in the
 * per-piece comparison, so a zero would not merely be wrong -- it would
 * take the comparison down with it. A one would be worse than either: it
 * claims "sold by the piece" about every row nobody answered for.
 *
 * A variant card holds a raw input string, so '' arrives here where it
 * never used to. Number('') is 0, and the sync writer only guards on
 * `== null` -- so an unguarded '' would be stored as a hard 0 in a
 * numeric column that no reader can tell from a real reading.
 */
{
  const cases = [['', 'a box left empty'], [0, 'a zero'], [-5, 'a negative'],
    ['abc', 'junk'], [null, 'nothing at all'], [undefined, 'a key that is not there']];
  cases.forEach(([v, what]) => {
    const r = rowFor(eff(pack({ piecesPerUnit: v }), pack({ piecesPerUnit: 100 }), null, true));
    t.check(r.piecesPerUnit === null, `${what} is saved as unknown, never as a number`);
  });
  const real = rowFor(eff(pack({ piecesPerUnit: '100' }), pack(), null, true));
  t.check(real.piecesPerUnit === 100 && typeof real.piecesPerUnit === 'number',
    'while a real count typed into an input is stored as a number, not the string it arrived as');

  t.check(/function piecesPerUnitOrNull\(raw\)/.test(code),
    'one guard, because the figure now arrives from two places');
  const guard = extractFunction(src, 'piecesPerUnitOrNull', 'index.html');
  t.check(/n <= 0\) \? null : n/.test(guard), 'and it is the same rule the shared box always used');
  t.check(/piecesPerUnitOrNull\(/.test(extractFunction(src, 'prPiecesPerUnitValue', 'index.html')),
    'which the shared box now reads through, rather than keeping a second copy to drift from');
}

/* ---------- 5. the interlock that makes seeding honest --------------- */
/*
 * "Set packing for this variant" pre-fills from the default so the
 * numbers to change are already in the boxes. For the count that is a
 * claim about this variant that nobody typed -- defensible ONLY because
 * the default box is filled solely when every priced variant agrees, and
 * "agrees" now includes agreeing about the count.
 */
{
  t.check(sig({ unit: 'Kg', packUnit: 'Bag', packQty: 25, piecesPerUnit: 100 })
       !== sig({ unit: 'Kg', packUnit: 'Bag', packQty: 25, piecesPerUnit: 60 }),
    'two variants counted differently are not packed the same way');
  t.check(sig({ unit: 'Kg', packUnit: 'Bag', packQty: 25, piecesPerUnit: 100 })
       === sig({ unit: 'Kg', packUnit: 'Bag', packQty: 25, piecesPerUnit: '100' }),
    'however the count arrived');
  t.check(sig({ unit: 'Kg', packUnit: 'Bag', packQty: 25, piecesPerUnit: null })
       === sig({ unit: 'Kg', packUnit: 'Bag', packQty: 25, piecesPerUnit: 0 }),
    'while unrecorded and zero are one claim — nobody said — so a catalogue that never answered reads as uniform');

  const toggle = extractFunction(src, 'toggleBulkVariantPacking', 'index.html');
  t.check(/piecesPerUnit: shared\.piecesPerUnit == null \? '' : shared\.piecesPerUnit/.test(toggle),
    'turning on a variant’s own packing seeds the count from the default');
  t.check(/signature/i.test(toggle),
    'with the reason it is safe to do so written where somebody might remove it');
}

/* ---------- 6. opening the form, and telling typed from shown -------- */
{
  const load = extractFunction(src, 'renderPrBulkVariants', 'index.html');
  t.check(/packSample && packSample\.piecesPerUnit/.test(load),
    'a variable product opens with the count that is on file, instead of blank');
  t.check(/piecesPerUnit: r\.piecesPerUnit \? String\(r\.piecesPerUnit\) : ''/.test(load),
    'and a differently-packed variant opens with its own count on its own card');
  t.check(/piecesPerUnit: document\.getElementById\('pr_pieces_per_unit'\)\.value/.test(load),
    'the prefill remembers what was shown');

  /* The rule this form already lives by: a box merely SHOWING what is on
     file must not write itself onto variants nobody quoted. Typing only
     in this box still counts as typing. */
  const save = code.slice(code.indexOf('const packEdited = !prBulkPackPrefill'));
  t.check(/pr_pieces_per_unit'\)\.value !== prBulkPackPrefill\.piecesPerUnit/.test(save.slice(0, 900)),
    'so the save can tell a count that was entered from one that was only displayed');
  t.check(/const sharedPack = \{ unit, packUnit, packQty, piecesPerUnit: prPiecesPerUnitValue\(\) \}/.test(code),
    'and the default handed to every variant carries it');
}

/* ---------- 7. the input itself ------------------------------------- */
{
  t.check(/class="pr-bulk-pack-pieces" data-idx="\$\{i\}"/.test(code),
    'the variant card has the box the shop asked for');
  t.check(/placeholder="Pieces in one unit — optional, e\.g\. 100"/.test(code),
    'labelled in the placeholder, since a variant card carries no labels');
  t.check(/type="number" class="pr-bulk-pack-pieces"/.test(code), 'and it is a number field');
  t.check(/packField\('\.pr-bulk-pack-pieces', 'piecesPerUnit'\)/.test(code),
    'typing in it writes to that variant’s own packing');
  t.check(/\.pr-bulk-pack-row input\.pr-bulk-pack-pieces\{flex:1 1 100%;\}/.test(code),
    'on a line of its own, as the shared block gives it, so the placeholder fits');

  // It only appears where a variant has said its packing differs, which
  // is the block it belongs to -- the count is read against that unit.
  const cardBlock = code.slice(code.indexOf('${packOverride ? `<div class="pr-bulk-pack-row">'));
  t.check(cardBlock.indexOf('pr-bulk-pack-pieces') < cardBlock.indexOf('</div>` : \'\'}'),
    'inside the Own-packing block, so it is read against that variant’s own unit');
}

/* ---------- 8. a researched lead keeps what was recorded ------------- */
/*
 * The variant cards on the sourcing form are the same editor, so the box
 * appears there too. It used to be thrown away at the moment the lead
 * became a product: the graduation hardcoded piecesPerUnit to null.
 */
{
  const grad = code.slice(code.indexOf('const slots = record.variants.length'), code.indexOf('const slots = record.variants.length') + 2500);
  t.check(!/piecesPerUnit: null/.test(grad),
    'graduating a lead no longer overwrites the count with nothing');
  t.check(/\.\.\.buildVariantPriceRow\(\{productId, variantIdx: idx, supplierId,/.test(grad),
    'it comes through the same row builder as everything else');
  const fromLead = rowFor(eff({ unit: 'Kg', packUnit: 'Bag', packQty: 25, piecesPerUnit: '60' },
    { unit: 'Kg', packUnit: 'Bag', packQty: 25 }, null, true));
  t.check(fromLead.piecesPerUnit === 60,
    'so a count recorded while researching survives into the price registry');
  const nobodySaid = rowFor(eff(null, { unit: 'Kg', packUnit: 'Bag', packQty: 25 }, null, true));
  t.check(nobodySaid.piecesPerUnit === null,
    'and is null when genuinely nobody said, which is what that form usually means');
}

/* ---------- 9. absence still survives the trip to the server -------- */
{
  t.check(/piecesPerUnit: pr\.pieces_per_unit == null \? null : Number\(pr\.pieces_per_unit\)/.test(code),
    'loading keeps "not recorded" distinct from zero');
  t.check(/pieces_per_unit: pr\.piecesPerUnit == null \? null : Number\(pr\.piecesPerUnit\)/.test(code),
    'and so does saving');
  /* The writer guards on `== null` only, and Number('') is 0. Nothing may
     hand it a raw input string -- both the resolver and the row builder
     put the value through the guard first, which is what keeps a stored
     zero out of a column no reader could tell from a real reading. */
  t.check(/piecesPerUnit: piecesPerUnitOrNull\(p && p\.piecesPerUnit\)/.test(code),
    'the resolver normalises before anything can be stored');
  t.check(/piecesPerUnit: piecesPerUnitOrNull\(pack\.piecesPerUnit\)/.test(code),
    'and so does the row builder, so a raw empty box can never reach the column as a zero');
}

/* ---------- 10. the other surface, and what a card says it follows --- */
/*
 * renderPrBulkVariantRows is one editor pointed at two forms. The
 * research form has no shared box for the count, which is a real gap --
 * but its contract must still say so rather than leaving the field off
 * and relying on `undefined == null` to land the seed on blank.
 */
{
  const funnel = extractFunction(src, 'slCandBulkSurface', 'index.html');
  t.check(/piecesPerUnit: null/.test(funnel),
    'the research form’s surface states it has no shared count, rather than omitting the field');
  t.check(/getPack: \(\)=> \(\{/.test(funnel), 'through the same getPack every card reads');

  const rows = extractFunction(src, 'renderPrBulkVariantRows', 'index.html');
  t.check(/piecesPerUnit: piecesPerUnitOrNull\(packOverride\.piecesPerUnit\)/.test(rows),
    'a card reads its own count through the same guard as everything else');
  t.check(/pcs \/ \$\{esc\(pk\.unit\|\|'unit'\)\}/.test(rows),
    'and a card following the default says what the default’s count is — otherwise the only way to see it is to scroll past every card');
  t.check(/pk\.piecesPerUnit != null/.test(rows),
    'saying nothing when there is nothing to say, rather than printing a zero');
}

process.exit(t.done() ? 1 : 0);
