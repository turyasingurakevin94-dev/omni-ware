#!/usr/bin/env node
'use strict';
/*
 * The price entry form, as ordered steps.
 *
 * One flat scroll: product and supplier, then the price ladder, then
 * packing at the bottom. Except the ladder DEPENDS on the packing --
 * whether a breakpoint counts as wholesale or retail is decided by
 * comparing its quantity against the pack size -- so the form asked for
 * the prices before the fact that gives them meaning, and its own
 * tooltip told you to go and look "below" for it.
 *
 * Three numbered steps now, in the order the work actually happens:
 *
 *   1  what you are pricing      product, variant, supplier, date
 *   2  how the supplier quotes   unit, pack unit, units per pack
 *   3  the prices                the tier ladder, or one row per variant
 *
 * The numbering is honest here in a way it would not have been on the
 * product form: each step depends on the one above it. The rule down the
 * left is that dependency, not decoration.
 *
 * Run: node test/price-form-layout.test.js   (or: npm test)
 */
const { read, createReporter } = require('./_extract');

const t = createReporter('price form layout');
const src = read('index.html');
const code = src.split(/\r?\n/).map((l) => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');
const modal = (/<div class="modal-overlay" id="priceModal">[\s\S]*?\n<\/div>/.exec(src) || [''])[0];

/* ---------- 1. nothing was lost ------------------------------------- */
{
  const IDS = [
    'pr_product_search', 'pr_product', 'pr_variant', 'pr_suggestions', 'pr_variant_hint',
    'pr_supplier_search', 'pr_supplier', 'pr_supplier_suggestions', 'pr_date',
    'pr_tiers_wrap', 'pr_tiers_label_text', 'pr_tiers_tip_text', 'pr_tiers_list_wrap',
    'pr_tier_qty', 'pr_tier_qty_unit', 'pr_tier_price', 'pr_tier_price_unit', 'pr_tier_add',
    'pr_bulk_wrap', 'pr_bulk_variants_wrap',
    'pr_unit', 'pr_pack_unit', 'pr_pack_qty',
  ];
  const missing = IDS.filter((id) => !new RegExp(`id="${id}"`).test(modal));
  t.check(missing.length === 0,
    `every control survived the redesign${missing.length ? ` (missing ${missing.join(', ')})` : ` (${IDS.length})`}`);

  t.check(/id="pr_save"/.test(src) && /id="pr_cancel"/.test(src), 'and the footer buttons are untouched');
}

/* ---------- 2. packing is asked BEFORE the prices -------------------- */
{
  /* The whole point of the restructure. packQty is what splits a tier
     ladder into wholesale and retail, so asking for the ladder first
     meant entering it against a pack size that had not been given yet. */
  const packAt = modal.indexOf('id="pr_pack_qty"');
  const tierAt = modal.indexOf('id="pr_tier_qty"');
  t.check(packAt > -1 && tierAt > -1 && packAt < tierAt,
    'units per pack comes before the tier ladder that is read against it');

  const productAt = modal.indexOf('id="pr_product_search"');
  t.check(productAt < packAt, 'and the product comes before both');

  /* Laid out as the owner's design board draws it: what, who, packing,
     their prices -- sections in that order, not numbered steps. */
  const order = ['id="pr_product_search"', 'id="pr_supplier_search"', 'id="prx_eq"', 'id="pr_tiers_label_text"', 'id="prx_more_t"'].map((k) => modal.indexOf(k));
  t.check(order.every((x, i) => x > -1 && (i === 0 || x > order[i - 1])),
    `product, supplier, packing, prices, then the folded details, in that order (${order.join(', ')})`);
  t.check(!/class="pfx-num"/.test(modal), 'as sections of the board, not numbered steps');
}

/* ---------- 3. the copy points the right way ------------------------- */
{
  /* Both tip strings told the reader that a breakpoint is classified
     against "Units per pack below". After the move that field is above
     them, and a direction that points at a control already behind you is
     worse than none. */
  /* HTML comments stripped as well as JS ones: the markup carries a note
     quoting the OLD wording to explain why the section moved, and a
     check reading it found the phrase it exists to forbid. */
  const prose = code.replace(/<!--[\s\S]*?-->/g, '');
  t.check(!/Units per pack below/.test(prose),
    'no copy still sends the reader downwards for the pack size');
  t.check((code.match(/Units per pack above/g) || []).length === 2,
    'both the single and the bulk wording point upwards, where the field now is');

  // The step 2 note says WHY it is asked first, rather than leaving the
  // order to look arbitrary.
  t.check(/because a breakpoint is read as wholesale or retail by comparing its quantity against the pack size/.test(modal),
    'and step 2 explains why it is asked before the prices');
}

/* ---------- 4. the long tooltips became visible copy ----------------- */
{
  /* Three info-tip bubbles carried a paragraph each. Guidance a reader
     has to hover to find is guidance most readers never see -- and the
     tier one is written by JS on every mode change, so it was the most
     important of the three. */
  const tips = (modal.match(/class="info-tip"/g) || []).length;
  t.check(tips === 0, `the hover bubbles are gone from this form (${tips} left)`);
  t.check(/class="pfx-note" id="pr_tiers_tip_text"/.test(modal),
    'the tier guidance is on the page, still written by the same code that switched the bubble');

  // It starts empty and is filled on open, so it can never show the
  // wrong mode's wording.
  t.check(/setPrBulkMode\(false\);/.test(code) && /function resetPriceForm/.test(code),
    'and the form sets the mode on reset, which is what fills it');
  t.check(/\.pfx-note:empty\{display:none;\}/.test(src),
    'with an empty note collapsing rather than leaving a gap');
}

/* ---------- 5. both modes still live in the prices section ----------- */
{
  const step3 = (/<section class="prx-sec">\s*<div class="prx-sec-h"><h3 id="pr_tiers_label_text">[\s\S]*?<\/section>/.exec(modal) || [''])[0];
  t.check(/id="pr_tiers_wrap"/.test(step3), 'the tier ladder is in the pricing step');
  t.check(/id="pr_bulk_wrap"/.test(step3),
    'and so is the per-variant list — they are two shapes of the same step, not two steps');

  // Both start hidden and are revealed by the mode switch, as before.
  t.check(/id="pr_tiers_wrap" style="display:none;"/.test(modal)
    && /id="pr_bulk_wrap" style="display:none;"/.test(modal),
    'both start hidden, so neither flashes before the mode is known');
  t.check(/getElementById\('pr_bulk_wrap'\)\.style\.display = on \? '' : 'none';/.test(code),
    'and the mode switch still governs which is shown');
}

/* ---------- 6. numbered because it is a sequence --------------------- */
{
  // The product form deliberately does NOT number its sections: only the
  // name is required there and the rest can be done in any order. Here
  // each step depends on the one above, which is what makes the
  // numbering carry information rather than decorate.
  t.check(/\.pfx-steps::before\{[\s\S]{0,120}background:var\(--line\);/.test(src),
    'the rule down the left is drawn as the dependency between steps');
  t.check(!/class="pfx-num"/.test((/<div class="modal-overlay" id="productModal">[\s\S]*?\n<\/div>/.exec(src) || [''])[0]),
    'and the product form is not numbered, because its sections have no order');
}

process.exit(t.done() ? 1 : 0);
