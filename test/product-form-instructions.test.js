#!/usr/bin/env node
'use strict';
/*
 * The add-product form's instructions, folded behind an "i" per panel.
 *
 * The same treatment the price form and the twenty-three screens got,
 * through the same foldInstruction() -- see page-instructions.test.js for
 * the mechanism and where the bubble is placed. This file covers what is
 * particular to this form.
 *
 * Measured at 375x812 before folding, panel by panel:
 *
 *   Photo         172px, of which 84px was prose   -- 49%
 *   Agent terms   323px, of which 113px            -- 35%
 *   Markup        428px, of which 75px
 *   Basics        734px, of which 91px
 *
 * After: 116px, 216px, 364px, 656px.
 *
 * Per PANEL rather than per form, because the rail shows one at a time --
 * the "i" belongs beside the heading of whichever panel is on screen, and
 * a single badge somewhere else would explain four panels you cannot see.
 *
 * Run: node test/product-form-instructions.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('product form instructions');
const src = read('index.html');
const modal = (/<div class="modal-overlay" id="productModal">[\s\S]*?\n<\/div>/.exec(src) || [''])[0];
const fn = extractFunction(src, 'foldProductFormInstructions', 'index.html');

/* ---------- 1. every panel, and nothing left standing ---------------- */
{
  t.check(modal.length > 0, 'the product modal is found in the markup');
  t.check(fn.length > 0, 'and something folds it');
  t.check(/^foldProductFormInstructions\(\);$/m.test(src),
    'which actually runs, rather than only being defined');

  /* Named individually rather than counted. A count is satisfied while
     any one panel quietly stops being folded, and the panel left with a
     paragraph is then the only one that looks different -- which reads
     as a bug rather than as the four that were tidied. */
  ['basics', 'photo', 'pricing', 'agent', 'variants'].forEach((id) => {
    t.check(new RegExp(`foldPane\\('${id}'`).test(fn), `the ${id} panel folds`);
    t.check(new RegExp(`<div class="pf-pane" id="pfpane-${id}"`).test(modal),
      `and ${id} is still a panel in the markup for it to find`);
  });

  // The paragraphs stay in the markup: this is a fold, not a rewrite.
  const heads = (modal.match(/<header class="pset-head">/g) || []).length;
  t.check(heads === 5, `all five panel headers are still written where they were (${heads})`);
}

/* ---------- 2. two sentences, one badge ------------------------------ */
/*
 * Photo says what the photo is for, then where it comes from -- one
 * thought, written either side of the uploader. In a 116px panel a
 * second badge would have been worse than the paragraph.
 */
{
  t.check(/foldPane\('photo',\s*'What the photo is for',\s*'\.img-upload-hint'\)/.test(fn),
    'the photo panel folds its upload hint into the same bubble as its heading');
  t.check(/class="img-upload-hint"/.test(modal),
    'and that hint still exists in the markup');
  t.check(/\[head\.querySelector\('p'\)\]\.concat\(extra \? \[p\.querySelector\(extra\)\] : \[\]\)/.test(fn),
    'which is the only panel given a second node, the rest passing one');
}

/* ---------- 3. the two field hints ----------------------------------- */
/*
 * Folded onto their own labels, the way the price form's supplier-code
 * hint is. Leaving them would have left the only prose in the form
 * sitting under two of its nine fields.
 */
{
  ['p_short_desc', 'p_notes'].forEach((id) => {
    t.check(new RegExp(`\\['${id}'`).test(fn), `${id}'s hint is folded onto its label`);
    t.check(new RegExp(`id="${id}"`).test(modal), `and ${id} is still there to hang it on`);
  });
  t.check(/field\.querySelector\('label'\), field\.querySelector\('\.field-hint'\)/.test(fn),
    'onto the label of the field it belongs to, not the panel heading');

  /* p_id_hint is deliberately NOT folded. "Generated automatically" is
     the state of a disabled box rather than an instruction, and the form
     shows and hides it -- a badge over it would have had to be kept in
     step with that for no gain. */
  /* Comments stripped first: the fold carries one naming p_id_hint to say
     why it is skipped, and a check reading the raw body found that
     mention and reported the opposite of the truth. */
  const code = fn.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(?<!:)\/\/.*$/gm, '');
  t.check(!/p_id_hint/.test(code), 'the Product ID hint is left alone');
  t.check(/id="p_id_hint"/.test(modal)
    && /getElementById\('p_id_hint'\)\.style\.display/.test(src),
    'because it is a state the form toggles, not a sentence about how to work');
}

/* ---------- 4. the live estimates are not instructions --------------- */
/*
 * The agent panel's two hints are the running figures renderAgentDiscountHints()
 * writes -- the margin, what the share hands over, what is left. They are
 * the reason to look at that panel, and folding them behind a hover would
 * have hidden the answer rather than the explanation.
 */
{
  t.check(!/agent-discount-hint/.test(fn),
    'the agent discount estimate stays on the panel');
  t.check(/<div class="agent-discount-hint" id="p_agent_discount_wholesale_hint"><\/div>/.test(modal)
    && /<div class="agent-discount-hint" id="p_agent_discount_retail_hint"><\/div>/.test(modal),
    'both of them, where they can be read while the number above is being typed');
}

/* ---------- 5. the badge follows the text ---------------------------- */
{
  t.check(/refreshInstructionTips\('#productModal'\)/.test(fn),
    'a heading whose paragraph is empty gets no badge');
  t.check(/function refreshInstructionTips\(root\)/.test(src),
    'through the same check the price form uses, scoped to one form at a time');
}

/* ---------- 6. what was deliberately left alone ---------------------- */
{
  /* The Presets page has eight headers of exactly this shape. They are a
     different screen and were not asked for; the fold is scoped by id so
     it cannot reach them by accident. */
  t.check(/const pane = \(id\)=> document\.getElementById\('pfpane-'\+id\);/.test(fn),
    'the fold reaches panels by id, so it cannot wander into the Presets page');
  const presets = (/<div class="preset-pane" id="ppane-[\s\S]*?<header class="pset-head">/.exec(src) || [''])[0];
  t.check(presets.length > 0, "whose own headers are still plain, since nobody asked for those");

  // The two radio options describe the choice they are; they are the
  // control, not a paragraph sitting above it.
  t.check(/class="type-option-desc">One item, one set of prices\./.test(modal),
    'and the simple/variable descriptions stay on their own options');
}

/* ---------- 7. what it actually folds, run --------------------------- */
/*
 * The sections above read the source. This runs the fold against a
 * stubbed form and records what foldInstruction is handed, because
 * reading cannot tell a call that is written from one that is made -- a
 * lookup returning nothing turns every foldPane() into a no-op while
 * every line naming a panel is still there to be matched.
 */
{
  const calls = [];
  const node = (name) => ({ name });

  const panes = {};
  ['basics', 'photo', 'pricing', 'agent', 'variants'].forEach((id) => {
    const h3 = node(id + ':h3'), p = node(id + ':p'), hint = node(id + ':img-upload-hint');
    const head = { querySelector: (sel) => (sel === 'h3' ? h3 : sel === 'p' ? p : null) };
    panes['pfpane-' + id] = {
      _parts: { h3, p, hint },
      querySelector: (sel) => (sel === '.pset-head' ? head : sel === '.img-upload-hint' ? hint : null),
    };
  });

  const fields = {};
  ['p_short_desc', 'p_notes', 'p_id'].forEach((id) => {
    const label = node(id + ':label'), hint = node(id + ':field-hint');
    const field = { querySelector: (sel) => (sel === 'label' ? label : sel === '.field-hint' ? hint : null) };
    fields[id] = { _parts: { label, hint }, closest: (sel) => (sel === '.field' ? field : null) };
  });

  const { foldProductFormInstructions } = compileScope(
    [extractFunction(src, 'foldProductFormInstructions', 'index.html')],
    {
      document: {
        getElementById: (id) => panes[id] || fields[id] || null,
        querySelectorAll: () => [],
      },
      // Normalised the way foldInstruction itself does: a panel hands it
      // an array, a field hint hands it the one node.
      foldInstruction: (title, notes, label) => {
        calls.push({ title, notes: Array.isArray(notes) ? notes : [notes], label });
        return {};
      },
      refreshInstructionTips: () => {},
    },
    ['foldProductFormInstructions'],
  );
  foldProductFormInstructions();

  t.check(calls.length === 7, `five panels and two field hints are folded (${calls.length} calls)`);

  ['basics', 'photo', 'pricing', 'agent', 'variants'].forEach((id) => {
    const c = calls.find((x) => x.title && x.title.name === id + ':h3');
    t.check(!!c, `${id} folds onto its own heading`);
    if (c) {
      t.check(c.notes[0] === panes['pfpane-' + id]._parts.p,
        `carrying ${id}'s own paragraph`);
      t.check(typeof c.label === 'string' && c.label.length > 0,
        `and naming the badge, since "i" is not a name (${c.label})`);
    }
  });

  // Photo, and only Photo, carries a second node.
  {
    const photo = calls.find((x) => x.title && x.title.name === 'photo:h3');
    t.check(photo && photo.notes.length === 2 && photo.notes[1] === panes['pfpane-photo']._parts.hint,
      'the photo panel folds its upload hint into the same bubble');
    const others = calls.filter((x) => x.title && /^(basics|pricing|agent|variants):h3$/.test(x.title.name));
    t.check(others.every((c) => c.notes.filter(Boolean).length === 1),
      'and no other panel drags in a node it was not given');
  }

  // The field hints land on their own labels, not on a panel heading.
  ['p_short_desc', 'p_notes'].forEach((id) => {
    const c = calls.find((x) => x.title === fields[id]._parts.label);
    t.check(!!c && c.notes[0] === fields[id]._parts.hint,
      `${id}'s hint is folded onto ${id}'s own label`);
  });

  /* The one that must NOT be touched. p_id_hint is the state of a
     disabled box, and the form shows and hides it; a badge over it would
     have to be kept in step with that for no gain. */
  t.check(!calls.some((c) => c.title === fields.p_id._parts.label),
    'and the Product ID field is never folded');
}

process.exit(t.done() ? 1 : 0);
