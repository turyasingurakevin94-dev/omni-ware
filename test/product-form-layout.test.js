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
    // The two _warn lines are gone by design, not by accident: the
    // discount is a share of the margin now, so "this would price below
    // cost" describes something the arithmetic can no longer do. See
    // agent-discount-margin.test.js.
    'p_agent_discount_wholesale', 'p_agent_discount_wholesale_hint',
    'p_agent_discount_retail', 'p_agent_discount_retail_hint',
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
  /* The Presets switcher used to bind every .preset-tab on the page and
     clear `active` from all of them; had this form reused that class,
     opening a section here would have deactivated the Presets rail
     underneath. That rail is gone, but the check stays as the record of
     why this form's rail has a class of its own. */
  // Matched loosely: the class rarely appears alone, and pinning the
  // closing quote let `class="preset-tab active"` slip straight through.
  t.check(!/class="[^"]*\bpreset-tab\b/.test(modal),
    'the form does not reuse the class that rail was bound by');
  t.check(/#p_form_nav \.pf-tab/.test(code) || /getElementById\('p_form_nav'\)/.test(code),
    'its handler is scoped to its own rail');
  /* There is no Presets rail left to collide with: The shop has no
     sub-tabs at all. So the hazard this section guarded is gone at the
     source, and what is worth pinning now is that it went cleanly --
     no orphan .preset-tab rule styling nothing, and no orphan handler
     binding a class that is never emitted. */
  t.check(/\.pf-tab\{/.test(src), 'the form’s own rail carries its own rule');
  t.check(!/\.preset-tab/.test(src),
    'and the rail it could once have collided with is gone, rule and handler together');
}

/* ---------- 4. the rail says what is set ----------------------------- */
{
  const fn = (/function refreshProductFormRail[\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(fn.length > 0, 'the rail state is computed');

  ['basics', 'photo', 'pricing', 'agent', 'variants'].forEach((k) => {
    t.check(new RegExp(`${k}:`).test(fn), `${k} reports its state`);
  });

  /* Was: "blank, not a tick" -- an untouched section showed nothing, and
     the badge collapsed rather than sitting there empty.

     That assertion was right about what it rejected and wrong about what
     it chose. A tick on an empty section IS a lie and a dash on every row
     DOES read as a broken screen; blank is simply the third wrong answer.
     It means the rail cannot tell you a section is empty -- you have to
     open it to find that out, which is the one errand the rail exists to
     save you. Six sections, five of them blank, and the only way to learn
     that nothing is set anywhere is five clicks.

     So the rule is no longer "say nothing when there is nothing". It is:
     every section states its contents in its own words, and a section
     holding nothing states THAT -- "None", "No rule set", "Not named yet",
     "Shop default". Neither a tick nor a dash nor a blank: an answer. The
     empty ones are greyed (.pf-none) so a filled rail still reads at a
     glance as filled.

     What must hold now is that no section can be silent. */
  t.check(/const \[text, none\] = state\[el\.dataset\.state\] \|\| \['', true\];/.test(fn),
    'every section resolves to a state, rather than falling through to nothing');
  t.check(!/\.pf-state:empty\{display:none;\}/.test(src),
    'and the rule that collapsed an empty badge is gone with the blank it hid');

  /* Named individually: a count passes while any one of them quietly goes
     back to reporting nothing, and the section left silent is then the one
     that looks broken. */
  [['basics', 'Not named yet'], ['photo', 'None'], ['pricing', 'No rule set'],
   ['agent', 'Shop default'], ['variants', 'None built yet']].forEach(([k, said]) => {
    t.check(new RegExp(`${k}:[\\s\\S]*?'${said}'`).test(fn),
      `${k} says "${said}" rather than going blank`);
  });

  /* Amber while the form is merely unfinished, crimson only once Save has
     actually refused. A form you have not yet tried to save is incomplete,
     which is not the same as wrong, and the rail must not shout before it
     has been asked to do anything. */
  t.check(/dot\.hidden = !!name;/.test(fn) && /if\(name\) dot\.classList\.remove\('pf-bad'\);/.test(fn),
    'the blocking mark is dropped the moment the name is typed');
  const mark = (/function markProductNameMissing[\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(/dot\.classList\.add\('pf-bad'\)/.test(mark),
    'and only a refused save turns it crimson');
  t.check(/showProductFormPane\('basics'\);/.test(mark) && /field\.focus\(\);/.test(mark),
    'a refused save opens the section at fault and puts the cursor in the field, rather than toasting from the far corner');

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
