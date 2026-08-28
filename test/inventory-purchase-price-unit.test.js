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
{
  const stage = stripComments(extractFunction(src, 'renderInvPurchaseStage', 'index.html'));

  t.check(/id="inv_purchase_price_unit"/.test(stage),
    'the price field has a unit selector of its own');
  t.check(/priceUnitOptionsHTML/.test(stage) && /per \$\{esc\(packUnit\)\}/.test(stage),
    'offering the pack unit, not only the base one');
  t.check(!/Price purchased at \(UGX per/.test(stage),
    'and the label no longer hardcodes the base unit it can no longer promise');

  // The save path is the one that matters: a selector nothing reads is
  // worse than no selector, because it looks like it was honoured.
  t.check(/invPurchasePriceValue\(priceInput\.value,\s*priceUnitSel\.value,\s*packQty\)/.test(stage),
    'and Save converts through invPurchasePriceValue with the chosen unit');
  t.check(!/const price = priceRaw===''\s*\?\s*null\s*:\s*Number\(priceRaw\)/.test(stage),
    'rather than taking the raw number as though it were always per unit');

  // Auto-fill has to speak the unit the field is asking in, or the trap
  // simply reverses: the per-unit figure sitting under a "per Ctn" label.
  t.check(/selectedRow\.purchasePrice \* \(priceInPack \? packQty : 1\)/.test(stage),
    'the auto-filled price is restated in whichever unit the field is asking for');
  // And "which unit the field is asking in" is the PRICE mode, not the
  // quantity mode. The two agree by default, which is exactly why reading
  // the wrong one would look correct until somebody overrides the price
  // unit on its own -- and then silently multiply the figure by the pack.
  t.check(/const priceInPack = invPurchasePriceUnitMode==='pack' && packQty>0;/.test(stage),
    'and it reads the price unit to decide that, not the quantity unit that merely seeds it');

  // The conversion line needs an element to live in, wired to the id the
  // input handler writes to. A style with nothing to style styles nothing.
  t.check(/id="inv_purchase_price_note"/.test(stage) && /class="q-price-per-unit"/.test(stage),
    'the conversion line is rendered, in the element its handler updates');
  t.check(/getElementById\('inv_purchase_price_note'\)\.innerHTML =\s*invPurchasePriceNote\(priceInput\.value, unit, packQty, invPurchasePriceUnitMode\)/.test(stage),
    'and it recomputes from what is in the field, in the unit the price selector is on');
  // The line above only proves the updater EXISTS. Nothing was listening
  // to the price input and every check still passed, because the body of
  // refreshPriceNote matched whether or not anything ever called it -- so
  // the conversion would freeze at whatever the stage opened with while a
  // different number was typed over it.
  t.check(/priceInput\.addEventListener\('input', refreshPriceNote\);/.test(stage),
    'and something is actually listening, so it follows what is being typed');

  // Changing what you count in changes what you are quoted in.
  t.check(/invPurchasePriceUnitMode = qtyUnitSel\.value;/.test(stage),
    'switching the quantity unit carries the price unit with it');
  t.check(/qtyUnitSel\.addEventListener\('change'/.test(stage) && /priceUnitSel\.addEventListener\('change'/.test(stage),
    'and both selectors are live');

  // Changing the price unit has to RESTATE the figure in the field, not
  // merely record the new mode. Left un-restated, 44,000 typed as a box
  // price stays on screen under a "per Ctn" label and is then divided
  // again on Save -- 8,800 a box, wrong in the opposite direction and by
  // the same mechanism.
  const priceUnitHandler = /priceUnitSel\.addEventListener\('change',[\s\S]*?\}\);/.exec(stage);
  t.check(!!priceUnitHandler && /renderInvPurchaseStage\(/.test(priceUnitHandler[0]),
    'and changing the price unit re-renders, so the number in the field is restated rather than reinterpreted');

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
  // Every reset of the quantity mode must reset this one too, or a pack
  // price sticks to the next item -- which may have no pack at all.
  const qtyResets = (code.match(/invPurchaseQtyUnitMode = 'unit';/g) || []).length;
  t.check(resets === qtyResets,
    `both modes are cleared in the same places (${resets} price vs ${qtyResets} quantity)`);

  const stage = stripComments(extractFunction(src, 'renderInvPurchaseStage', 'index.html'));
  t.check(/if\(invPurchasePriceUnitMode==='pack' && !hasPack\) invPurchasePriceUnitMode = 'unit';/.test(stage),
    'and a pack mode left over from an item that had packs falls back on one that does not');
}

/* ---------- 8. the note cannot displace the fields ------------------- */
{
  const css = (src.match(/<style[^>]*>([\s\S]*?)<\/style>/g) || []).join('\n');
  t.check(/\.q-price-per-unit\{/.test(css), 'the conversion line has a style of its own');
  t.check(/\.q-price-per-unit:empty\{display:none;\}/.test(css),
    'and takes no space when there is nothing to convert');
  // .q-qty-row aligns its fields at flex-end, which lines two label+input
  // columns up by their inputs. A column carrying an extra line below is
  // taller, so flex-end would push the OTHER input down to meet it -- and
  // the line comes and goes with the unit, so the quantity box would jump.
  t.check(/\.q-qty-row-noted\{align-items:flex-start;\}/.test(css),
    'the row carrying it aligns at the top so the quantity field does not move when it appears');
  const stage = stripComments(extractFunction(src, 'renderInvPurchaseStage', 'index.html'));
  t.check(/class="q-qty-row q-qty-row-noted"/.test(stage),
    'and the purchase row asks for that alignment');
}

process.exit(t.done() ? 1 : 0);
