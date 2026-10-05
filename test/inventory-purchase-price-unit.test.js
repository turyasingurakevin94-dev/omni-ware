#!/usr/bin/env node
'use strict';
/*
 * A price has a unit, and the restock form has to ask for it.
 *
 * Everything downstream of the purchase stage stores the price per BASE
 * unit: the FIFO lot cost, the price registry row, the purchase invoice
 * line. But the quantity field above it has always offered packs -- "Ctn
 * (5 Box)" -- while the price field's label was hardcoded to the base
 * unit. So the form said, in the same breath, "how many cartons" and
 * "price per box".
 *
 * A supplier quoting a carton says 220,000 a carton. That is the number
 * that gets typed. On RIDER Self Drilling Screws it went in as the per-BOX
 * cost of a 5-box carton, and:
 *
 *   - the shelf valued 10 Box at 2,200,000 instead of 440,000
 *   - two purchase invoices claimed 1,100,000 owed each, against 220,000
 *   - the price book offered the item at five times its real cost, so
 *     every quote for it would have been priced off a phantom
 *
 * One typed number, wrong in four places, and the only record of what
 * happened -- the stock log note -- said "@ 220,000 UGX each" without ever
 * saying each WHAT, so it could not settle the question it was the sole
 * evidence for.
 *
 * The fix is that the price carries its own unit selector, exactly as the
 * quantity does, and invPurchasePriceValue divides down to base units
 * before anything stores the figure. The invariant these checks defend:
 * the same purchase, expressed in packs or in units, must cost the same
 * money. If that ever stops holding, a shelf is lying about what it holds.
 *
 * Run: node test/inventory-purchase-price-unit.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('inventory purchase price unit');
const src = read('index.html');

// Comments carry the numbers this file argues about -- 220,000, per Ctn,
// packQty -- so a source-reading check run against the raw file would be
// satisfied by the prose EXPLAINING the code rather than by the code. Both
// comment forms go, or the assertions below prove nothing.
// The lookbehind guards against `accept="image/*"` in the media picker,
// whose `/*` opens a block comment a naive stripper does not close for
// another 104,248 characters — blinding every check to the markup in
// between. A real opener is not preceded by a word character or a quote.
const stripComments = (s) => s
  .replace(/(?<![\w"'])\/\*[\s\S]*?\*\//g, ' ')
  .split(/\r?\n/).map((l) => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');

/* The note takes its unit mode as an ARGUMENT rather than reading module
   state, because the stock-count screen now asks the same question about
   the same product and keeps its own selector. That makes it a pure
   function of what it is handed -- so these checks pass the mode
   directly, and there is no module variable left for them to set. */
const scope = compileScope([
  extractFunction(src, 'invPurchaseQtyValue', 'index.html'),
  extractFunction(src, 'invPurchasePriceValue', 'index.html'),
  extractFunction(src, 'invPurchasePriceNote', 'index.html'),
], {
  esc: (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;'),
}, ['invPurchaseQtyValue', 'invPurchasePriceValue', 'invPurchasePriceNote']);

const { invPurchaseQtyValue, invPurchasePriceValue, invPurchasePriceNote } = scope;

/* ---------- 1. the conversion, both ways ------------------------------ */
{
  t.check(invPurchasePriceValue('44000', 'unit', 5) === 44000,
    'a per-unit price is stored exactly as typed');
  t.check(invPurchasePriceValue('220000', 'pack', 5) === 44000,
    `a per-pack price is divided by the pack size (got ${invPurchasePriceValue('220000', 'pack', 5)})`);
  t.check(invPurchasePriceValue('220000', 'pack', 0) === 220000,
    'a row with no pack size cannot divide, so the figure stands rather than becoming Infinity');
  t.check(invPurchasePriceValue('220000', 'pack', -3) === 220000,
    'and neither does a nonsense pack size invert the price');

  // The direction matters and is easy to get backwards. Quantity in packs
  // multiplies UP to base units; price per pack divides DOWN to them.
  t.check(invPurchaseQtyValue('2', 'pack', 5) === 10 && invPurchasePriceValue('220000', 'pack', 5) === 44000,
    'quantity multiplies and price divides -- the two conversions run opposite ways');
}

/* ---------- 2. blank is not free -------------------------------------- */
{
  t.check(invPurchasePriceValue('', 'pack', 5) === null,
    'an empty price stays null');
  t.check(invPurchasePriceValue(null, 'unit', 5) === null, 'and so does a missing one');
  t.check(invPurchasePriceValue('abc', 'unit', 5) === null, 'and so does junk');
  t.check(invPurchasePriceValue('0', 'unit', 5) === 0,
    'but a typed zero is a claim about the price and survives as one');

  // "I don't know what this cost" and "this cost nothing" are different
  // claims. Collapsing the first into the second writes a zero lot cost,
  // and a shelf full of zero-cost stock reports infinite margin.
  t.check(invPurchasePriceValue('', 'unit', 0) !== 0,
    'a blank price never becomes a free one');
}

/* ---------- 3. the money is the same whichever unit you speak --------- */
{
  // The property the whole change exists for: state a purchase in packs or
  // in units and the shop pays the same. qty*price is what the purchase
  // invoice bills and what the lots are worth, so if this ever drifts the
  // books drift with it.
  let bad = 0;
  [[5, 220000], [12, 36000], [1, 9500], [24, 1200], [100, 250000], [3, 7]].forEach(([packQty, packPrice]) => {
    [1, 2, 3, 7, 40].forEach((packs) => {
      const viaPacks = invPurchaseQtyValue(String(packs), 'pack', packQty)
                     * invPurchasePriceValue(String(packPrice), 'pack', packQty);
      const viaUnits = invPurchaseQtyValue(String(packs * packQty), 'unit', packQty)
                     * invPurchasePriceValue(String(packPrice / packQty), 'unit', packQty);
      if (Math.abs(viaPacks - viaUnits) > 1e-6) {
        bad++;
        t.fail(`${packs} x ${packQty} @ ${packPrice}: packs bill ${viaPacks}, units bill ${viaUnits}`);
      }
      if (Math.abs(viaPacks - packs * packPrice) > 1e-6) {
        bad++;
        t.fail(`${packs} packs at ${packPrice} each should bill ${packs * packPrice}, bills ${viaPacks}`);
      }
    });
  });
  if (!bad) t.pass('a purchase costs the same stated in packs or in units, and equals packs x pack price (30 cases)');
}

/* ---------- 4. the case this was written for -------------------------- */
{
  // Haidery, RIDER Self Drilling Screws 1": 2 cartons, 5 boxes to a
  // carton, 220,000 a carton. Exactly what was typed on 12 Aug 2026.
  const packQty = 5;
  const qty = invPurchaseQtyValue('2', 'pack', packQty);
  const cost = invPurchasePriceValue('220000', 'pack', packQty);

  t.check(qty === 10, 'two cartons is ten boxes');
  t.check(cost === 44000, `and 220,000 a carton is 44,000 a box (got ${cost})`);
  t.check(qty * cost === 440000,
    `so the shelf is worth 440,000, not 2,200,000 (got ${qty * cost})`);

  // The old form had no price unit at all, so the same keystrokes stored
  // the carton figure as the box figure. Pinned as the thing that must not
  // come back rather than merely fixed.
  t.check(invPurchasePriceValue('220000', 'unit', packQty) * qty === 2200000,
    'read as a per-box price the very same number gives the 2,200,000 that was reported -- which is why the unit has to be asked for');
}

/* ---------- 5. the conversion is shown, not just performed ------------ */
{
  const note = invPurchasePriceNote('220000', 'Box', 5, 'pack');
  t.check(/44,000/.test(note), `the per-unit figure is on screen (${JSON.stringify(note)})`);
  t.check(/per Box/.test(note), 'named with the unit it is per');
  t.check(!/220,000/.test(note),
    'and it reports the converted figure rather than echoing what was typed');

  t.check(invPurchasePriceNote('', 'Box', 5, 'pack') === '',
    'nothing is claimed about a blank price');
  t.check(invPurchasePriceNote('220000', 'Box', 0, 'pack') === '',
    'nor about a row with no pack to convert from');

  t.check(invPurchasePriceNote('44000', 'Box', 5, 'unit') === '',
    'and a per-unit price needs no conversion line, so none appears');

  // A price that does not divide evenly must not be rounded into a
  // different price -- 100,000 over 3 is 33,333.33, and reporting 33,333
  // understates a carton by a shilling.
  t.check(/33,333\.33/.test(invPurchasePriceNote('100000', 'Box', 3, 'pack')),
    `an uneven division keeps its fraction (${invPurchasePriceNote('100000', 'Box', 3, 'pack')})`);

  /* The two screens can be open at different settings, so the mode has
     to travel with the call. Reading it off module state again is how
     the stock count would start reporting the purchase screen's unit. */
  t.check(!/invPurchasePriceUnitMode/.test(extractFunction(src, 'invPurchasePriceNote', 'index.html')),
    'and the note reads no module state, so two screens cannot share one selector by accident');
}

/* ---------- 6. the form is wired to the converter ---------------------- */
/* THE RECEIVE DIALOG WAS DRAWN AGAIN, and the form lost its second unit
   selector on purpose. It read: the price field has a unit selector of
   its own, offers the pack, and "both selectors are live"; switching the
   quantity unit carries the price unit with it but leaves it overridable
   ("for the shop that buys a carton and thinks in boxes").

   WHAT THAT PROTECTED: a carton price typed while the box says per piece
   is the whole trap this file exists for -- the price and the quantity
   must never be read in different units without the screen saying so.

   WHY THE SHAPE CHANGED: the owner asked for one unit switch inside the
   quantity field, because "unit switching shouldn't consume this much
   space". With one switch the two units cannot disagree, which removes
   the override and with it the only way to get the trap by choice. The
   price field now names its unit in the label ("UGX / pallet") and states
   the other reading under it ("= 32,400 a bag"), so the conversion is on
   screen rather than hidden in a selector.

   WHAT THE NEW ASSERTIONS MEAN: there is still exactly one place the unit
   is decided, the price follows it by assignment (not by a second
   control), Save converts through invPurchasePriceValue with that mode,
   the auto-fill is restated in it, the conversion line exists and is
   written as the price is typed, and switching re-renders so the figure
   in the field is restated rather than reinterpreted. */
{
  const stage = stripComments(extractFunction(src, 'renderInvPurchaseStage', 'index.html'));

  t.check(/invDlgSwitchHTML\(modes, invPurchaseQtyUnitMode, 'qtyunit'\)/.test(stage) && !/id="inv_purchase_price_unit"/.test(stage),
    'the quantity field carries the one unit switch, and the price has no selector that could disagree with it');
  t.check(/invUnitPl\(packUnit, 2\)/.test(stage) && /UGX \/ \$\{esc\(priceInPack \? packUnit : \(unit \|\| 'unit'\)\)\}/.test(stage),
    'offering the pack unit, and the price field names the unit it is asking in');
  t.check(!/Price purchased at \(UGX per/.test(stage),
    'and the label no longer hardcodes the base unit it can no longer promise');

  // The save path is the one that matters: a control nothing reads is
  // worse than none, because it looks like it was honoured.
  t.check(/invPurchasePriceValue\(priceInput\.value,\s*invPurchasePriceUnitMode,\s*packQty\)/.test(stage),
    'and Save converts through invPurchasePriceValue with the chosen unit');
  t.check(!/const price = priceRaw===''\s*\?\s*null\s*:\s*Number\(priceRaw\)/.test(stage),
    'rather than taking the raw number as though it were always per unit');

  // Auto-fill speaks the unit the field is asking in, or the trap simply
  // reverses: the per-unit figure sitting under a "per Ctn" label.
  t.check(/rowPerUnit\(selectedRow, selectedRow\.purchasePrice\) \* \(priceInPack \? packQty : 1\)/.test(stage),
    'the auto-filled price is restated in whichever unit the field is asking for');
  t.check(/const priceInPack = invPurchasePriceUnitMode==='pack' && packQty>0;/.test(stage),
    'and it reads the price unit to decide that');
  // One decision point: the price mode is assigned from the quantity mode
  // every time the stage draws, so the two can never drift apart.
  t.check(/invPurchasePriceUnitMode = invPurchaseQtyUnitMode;/.test(stage),
    'switching the quantity unit carries the price unit with it, by assignment, so the two cannot differ');

  // The conversion line needs an element to live in, wired to what writes it.
  t.check(/id="inv_purchase_price_note"/.test(stage) && /q-price-per-unit/.test(stage),
    'the conversion line is rendered, in the element its handler updates');
  t.check(/getElementById\('inv_purchase_price_note'\)\.innerHTML = priceInPack/.test(stage) && /a \$\{|invA\(unit\)/.test(stage),
    'and it recomputes from what is in the field, in the unit the switch is on');
  t.check(/priceInput\.addEventListener\('input', refresh\);/.test(stage) && /qtyInput\.addEventListener\('input', refresh\);/.test(stage),
    'and something is actually listening, so it follows what is being typed');

  // Switching converts the figure in the box and re-renders, so the number
  // is restated rather than reinterpreted: 40 bags becomes 1 pallet, not 40 pallets.
  const switchHandler = /querySelectorAll\('\[data-qtyunit\]'\)[\s\S]*?\}\)\);/.exec(stage);
  t.check(!!switchHandler && /to === 'pack' \? v \/ packQty : v \* packQty/.test(switchHandler[0]) && /renderInvPurchaseStage\(/.test(switchHandler[0]),
    'and switching converts what is in the quantity box and re-renders, so the number is restated rather than reinterpreted');

  // The log note was the only record of the mistake and could not name it.
  t.check(/@ \$\{fmtUGX\(price\)\} per \$\{unit\|\|'unit'\}/.test(stage),
    'the stock log note names the unit the price is per, instead of saying "each"');
  t.check(!/\$\{fmtUGX\(price\)\} each/.test(stage),
    'so a note can no longer be true of a carton and false of a box at once');
}

/* ---------- 7. the mode is reset with the rest of the stage ----------- */
{
  const code = stripComments(src);
  const resets = (code.match(/invPurchasePriceUnitMode = 'unit';/g) || []).length;
  t.check(resets >= 2,
    `the price unit is reset alongside the quantity unit when the stage is left or a new item picked (found ${resets})`);
  /* WAS "both modes are cleared in the same places (equal counts)". The
     stage's own fallback now resets only the quantity mode and then
     DERIVES the price mode from it (section 6), so the counts differ by
     exactly that one place; the property -- a pack price cannot stick to
     the next item -- is carried by the assignment instead of by a second
     reset. The places that reset the stage from outside still reset both. */
  const qtyResets = (code.match(/invPurchaseQtyUnitMode = 'unit';/g) || []).length;
  t.check(qtyResets - resets === 1,
    `every outside reset clears both modes; the one extra quantity reset is the stage's own fallback (${resets} price vs ${qtyResets} quantity)`);

  const stage = stripComments(extractFunction(src, 'renderInvPurchaseStage', 'index.html'));
  t.check(/if\(invPurchaseQtyUnitMode === 'pack' && !hasPack\) invPurchaseQtyUnitMode = 'unit';/.test(stage)
       && stage.indexOf("invPurchaseQtyUnitMode = 'unit';") < stage.indexOf('invPurchasePriceUnitMode = invPurchaseQtyUnitMode;'),
    'and a pack mode left over from an item that had packs falls back on one that does not, before the price follows it');
}

/* ---------- 8. the note cannot displace the fields ------------------- */
{
  const css = (src.match(/<style[^>]*>([\s\S]*?)<\/style>/g) || []).join('\n');
  t.check(/\.q-price-per-unit\{/.test(css), 'the conversion line has a style of its own');
  t.check(/\.q-price-per-unit:empty\{display:none;\}/.test(css),
    'and takes no space when there is nothing to convert');
  /* The row used to need align-items:flex-start so a note under one field
     did not push the other input down. The two fields are a two-column
     grid now (.ow-dg-two), which aligns the tops by construction, and each
     note is its own line under its own input. */
  t.check(/\.ow-dg-two\{display:grid;grid-template-columns:1fr 1fr;/.test(css),
    'the two fields sit in a grid that aligns their tops, so the quantity box does not move when the note appears');
  const stage = stripComments(extractFunction(src, 'renderInvPurchaseStage', 'index.html'));
  t.check(/class="ow-dg-two"/.test(stage) && /class="ow-dg-fh q-price-per-unit" id="inv_purchase_price_note"/.test(stage),
    'and the purchase row asks for it, with the note as a line under its own field');
}

process.exit(t.done() ? 1 : 0);
