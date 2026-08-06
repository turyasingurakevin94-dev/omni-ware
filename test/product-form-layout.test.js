#!/usr/bin/env node
'use strict';
/*
 * The product form, as sections rather than a scroll.
 *
 * Five panels stacked in one modal -- type, details and photo, markup
 * rules, agent discount overrides, variants -- every one of them weighted
 * the same, for a form whose only required field is the name. Adding
 * "Cement" meant scrolling past a photo uploader, two pairs of markup
 * fields and a variant builder to reach Save.
 *
 * The same rail the Presets page uses: sections on the left, one at a
 * time on the right, each carrying what is set in it.
 *
 * What has to hold:
 *
 *   nothing is lost      every control is bound by id at parse time. A
 *                        dropped id is getElementById(...) on null,
 *                        which throws and stops the rest of the script.
 *   blank, not a tick    a tick on an empty section is a lie, and a dash
 *                        on all five reads as a broken screen.
 *   no cross-talk        the Presets rail and this one must not share a
 *                        click handler, or opening a section here would
 *                        deactivate one there.
 *   variants follow      a simple product has no variants to build, so
 *   the type             the section is not offered -- and if it is the
 *                        one being looked at, the form falls back rather
 *                        than showing nothing.
 *
 * Run: node test/product-form-layout.test.js   (or: npm test)
 */
const { read, createReporter } = require('./_extract');

const t = createReporter('product form layout');
const src = read('index.html');
const code = src.split(/\r?\n/).map((l) => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');
const modal = (/<div class="modal-overlay" id="productModal">[\s\S]*?\n<\/div>/.exec(src) || [''])[0];

/* ---------- 1. nothing was lost ------------------------------------- */
{
  const IDS = [
    'p_type_simple', 'p_type_variable', 'p_type_toggle',
    'p_id', 'p_id_hint', 'p_name', 'p_category', 'p_subcategory', 'p_notes',
    // p_image_input is gone by design: the photo is picked from the
    // media library now, so there is no hidden file input to survive.
    'p_image_preview', 'p_image_placeholder',
    'p_image_upload_btn', 'p_image_remove_btn',
    'p_markup_panel_title',
    'p_wholesale_markup_type', 'p_wholesale_markup_value',
    'p_retail_markup_type', 'p_retail_markup_value',
    'p_agent_discount_wholesale', 'p_agent_discount_wholesale_hint', 'p_agent_discount_wholesale_warn',
    'p_agent_discount_retail', 'p_agent_discount_retail_hint', 'p_agent_discount_retail_warn',
    'variantsSection', 'variantAttrsWrap', 'variantsListWrap',
    'v_add_attr_btn', 'v_generate_btn',
    'p_cancel', 'p_save', 'productFormTitle', 'productModalClose',
  ];
  const missing = IDS.filter((id) => !new RegExp(`id="${id}"`).test(modal));
  t.check(missing.length === 0,
    `every control survived the redesign${missing.length ? ` (missing ${missing.join(', ')})` : ` (${IDS.length})`}`);

  // The radio group has to keep its name or the two options stop being
  // one choice and both can be selected.
  t.check(/name="p_type"/.test(modal), 'the type radios are still one group');

  // Every rail entry needs a pane, or clicking it shows nothing.
  const tabs = [...modal.matchAll(/data-pfpane="([a-z]+)"/g)].map((m) => m[1]);
  t.check(tabs.length === 5, `five sections (${tabs.join(', ')})`);
  const orphans = tabs.filter((k) => !new RegExp(`id="pfpane-${k}"`).test(modal));
  t.check(orphans.length === 0,
    `each has a pane to open${orphans.length ? ` (missing pfpane-${orphans.join(', pfpane-')})` : ''}`);

  t.check(!/form-panel/.test(modal), 'and the five stacked panels are gone');
}

/* ---------- 2. one section at a time --------------------------------- */
{
  const show = (/function showProductFormPane[\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(/p\.style\.display = p\.id === 'pfpane-'\+key \? 'block' : 'none';/.test(show),
    'showing one section hides the others');
  t.check(/b\.classList\.toggle\('active', b\.dataset\.pfpane === key\)/.test(show),
    'and the rail marks which');

  // Four of the five panes start hidden in the markup, so the form does
  // not flash all five before the script runs.
  const hidden = (modal.match(/class="pf-pane" id="pfpane-[a-z]+" style="display:none;"/g) || []).length;
  t.check(hidden === 4, `four panes start hidden in the markup (${hidden})`);

  /* Scoped to resetProductForm. setProductType also falls back to
     Basics, so a check against the whole file passed even with the reset
     dropped -- and a form reopening on Agent terms hides the only field
     that has to be filled. */
  const reset = (/function resetProductForm\(\)[\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(/showProductFormPane\('basics'\);/.test(reset),
    'and the form always opens on Basics — reopening on the last section looked at would hide the only required field');
}

/* ---------- 3. the two rails do not share a handler ------------------ */
{
  /* The Presets switcher binds every .preset-tab on the page and clears
     `active` from all of them. Had this form reused that class, opening a
     section here would have deactivated the Presets rail underneath. */
  // Matched loosely: the class rarely appears alone, and pinning the
  // closing quote let `class="preset-tab active"` slip straight through.
  t.check(!/class="[^"]*\bpreset-tab\b/.test(modal),
    'the form does not reuse the Presets tab class');
  t.check(/#p_form_nav \.pf-tab/.test(code) || /getElementById\('p_form_nav'\)/.test(code),
    'its handler is scoped to its own rail');
  t.check(/\.pf-tab\{/.test(src) && /\.preset-tab\{/.test(src),
    'and the two carry their own rules rather than one being retrofitted onto the other');
}

/* ---------- 4. the rail says what is set ----------------------------- */
{
  const fn = (/function refreshProductFormRail[\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(fn.length > 0, 'the rail state is computed');

  ['basics', 'photo', 'pricing', 'agent', 'variants'].forEach((k) => {
    t.check(new RegExp(`${k}:`).test(fn), `${k} reports its state`);
  });

  // Blank, not a tick.
  t.check(/el\.textContent = state\[el\.dataset\.state\] \|\| '';/.test(fn),
    'an untouched section shows nothing rather than a placeholder');
  t.check(/\.pf-state:empty\{display:none;\}/.test(src),
    'and the badge collapses rather than sitting there empty');

  // A markup of "fixed 5000" is money, not a percentage. The catalogue
  // makes the same distinction; the rail must not contradict it.
  t.check(/=== 'fixed' \? fmtUGX\(v\) : `\+\$\{v\}%`/.test(fn),
    'a fixed markup reads as money and a percentage as a percentage');

  t.check(/addEventListener\('input', refreshProductFormRail\)/.test(code)
    && /addEventListener\('change', refreshProductFormRail\)/.test(code),
    'and it is kept current as the form is filled, so it is never a stale claim');
}

/* ---------- 5. variants follow the product type ---------------------- */
{
  const fn = (/function setProductType[\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(/navItem\.style\.display = isVariable \? '' : 'none';/.test(fn),
    'a simple product is not offered a variants section it cannot use');

  /* The case that strands the form: switching back to simple while
     looking at Variants hides both the rail entry and the pane, leaving
     the modal showing nothing at all. */
  t.check(/if\(!isVariable && navItem\.classList\.contains\('active'\)\) showProductFormPane\('basics'\);/.test(fn),
    'and switching away from it while it is open falls back to Basics rather than showing an empty form');
  t.check(/refreshProductFormRail\(\);/.test(fn),
    'the rail is refreshed with the change');
}

process.exit(t.done() ? 1 : 0);
