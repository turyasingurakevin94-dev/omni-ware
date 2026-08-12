#!/usr/bin/env node
'use strict';
/*
 * The price form's instructions, folded behind an "i" per section.
 *
 * Measured at 375x812 before this: the modal body is a 614px box holding
 * 1727px of form, of which 747px -- 43% -- was explanatory prose. Six
 * paragraphs telling a shopkeeper who has entered a hundred prices what
 * a pack unit is, scrolled past every time. Folded into five bubbles,
 * the same form is 980px.
 *
 * The same mechanism the page screens use (foldInstruction, see
 * page-instructions.test.js), so this file tests only what is particular
 * to the price form:
 *
 *   the notes are MOVED. Two of them -- pr_pack_note and
 *   pr_tiers_tip_text -- are rewritten live by setPrBulkMode() as the
 *   form switches between one entry and a whole variant list. Copying
 *   their text into a bubble would have frozen whichever wording happened
 *   to be showing when the form was folded.
 *
 *   the badge follows the text. pr_tiers_tip_text is empty in the markup
 *   until setPrBulkMode() runs, and an "i" that opens an empty box is
 *   worse than no "i".
 *
 * Where the bubble is placed so a scrolling body cannot clip it is the
 * shared mechanism's problem, and is tested in page-instructions.test.js.
 *
 * Run: node test/price-form-instructions.test.js   (or: npm test)
 */
const { read, extractFunction, createReporter } = require('./_extract');

const t = createReporter('price form instructions');
const src = read('index.html');
const modal = (/<div class="modal-overlay" id="priceModal">[\s\S]*?\n<\/div>/.exec(src) || [''])[0];

/* ---------- 1. nothing is left sitting on the form ------------------- */
{
  t.check(modal.length > 0, 'the price modal is found in the markup');

  /* Counted, not sampled: leaving one paragraph behind while folding the
     other four is the failure that would look tidy in a screenshot of
     the top of the form and not in the form. */
  const notes = (modal.match(/class="pfx-note/g) || []).length;
  const hints = (modal.match(/class="field-hint"/g) || []).length;
  t.check(notes === 5, `the five step notes are still written in the markup (${notes})`);
  /* Two now. The second belongs to "Pieces in one unit", added so the
     comparison page can weigh a Box of one brand against a Pack of
     another; its hint is the only place that explains why a shop would
     ever fill it in. Counted rather than loosened to >=1, because the
     point of this check is that a hint is never orphaned by a fold. */
  t.check(hints === 2, `along with the two field hints (${hints})`);

  const fn = extractFunction(src, 'foldPriceFormInstructions', 'index.html');
  t.check(fn.length > 0, 'and something folds them');
  // A fold nothing calls is a form with every paragraph still on it.
  t.check(/^foldPriceFormInstructions\(\);$/m.test(src),
    'which actually runs, rather than only being defined');
  /* Six nodes, five bubbles -- step 2's two notes share one. A fold that
     quietly covers five of six leaves the sixth as the only prose left
     standing in the form, which is worse than not having started. */
  t.check((fn.match(/foldInstruction\(/g) || []).length === 5,
    'each of the five sections folds, not most of them');
}

/* ---------- 2. moved, so what rewrites them still works -------------- */
/*
 * setPrBulkMode() rewrites two of these notes by id every time the form
 * switches mode. They keep their ids and their nodes; only where they sit
 * has changed.
 */
{
  const fn = extractFunction(src, 'foldPriceFormInstructions', 'index.html');
  const bulk = extractFunction(src, 'setPrBulkMode', 'index.html');

  ['pr_pack_note', 'pr_tiers_tip_text'].forEach((id) => {
    t.check(new RegExp(`getElementById\\('${id}'\\)`).test(fn),
      `${id} is handed to the fold as the node it already is`);
    t.check(new RegExp(`getElementById\\('${id}'\\)\\.textContent =`).test(bulk),
      `and setPrBulkMode still writes to it directly`);
  });

  t.check(/id="pr_pack_note"/.test(modal) && /id="pr_tiers_tip_text"/.test(modal),
    'both still exist in the markup, where their wording is written');

  /* The fixed half of step 2's explanation and the half setPrBulkMode
     rewrites were one continuous thought split across the fields. One
     bubble carries both. */
  t.check(/\[s2\.querySelector\('\.pfx-note:not\(\.pfx-quiet\)'\), document\.getElementById\('pr_pack_note'\)\]/.test(fn),
    'step 2 folds both of its notes into a single bubble rather than growing a second badge');
}

/* ---------- 3. an "i" with nothing behind it ------------------------- */
{
  const refresh = extractFunction(src, 'refreshInstructionTips', 'index.html');
  t.check(/bubble\.textContent\.trim\(\)/.test(refresh),
    'the badge is shown or hidden by what its bubble actually holds');
  t.check(/info\.style\.display = \(bubble && bubble\.textContent\.trim\(\)\) \? '' : 'none';/.test(refresh),
    'hiding the badge, not just the bubble — a hoverable "i" that opens nothing is the thing being avoided');

  /* Called from both ends: once when the form is folded at load, and
     again every time setPrBulkMode rewrites the text underneath it.
     Without the second, the pricing badge would be decided once against
     an empty paragraph and never appear. */
  t.check(/refreshInstructionTips\('#priceModal'\);/.test(extractFunction(src, 'foldPriceFormInstructions', 'index.html')),
    'checked when the form is folded');
  t.check(/refreshInstructionTips\('#priceModal'\);/.test(extractFunction(src, 'setPrBulkMode', 'index.html')),
    'and again whenever the wording is rewritten');
  /* Scoped to this modal. Unscoped it would sweep the product form's
     badges too, and a rebuild there would be decided by whatever the
     price form happened to be doing. */
  t.check(/document\.querySelectorAll\(root \+ ' \.page-info'\)/.test(refresh),
    'and only over the form it was asked about');
}

/* ---------- 4. a folded heading still looks like its own heading ----- */
{
  t.check(/\.page-title-row h1, \.page-title-row h3\{margin-bottom:0;\}/.test(src),
    'a step heading keeps its own type in the row');
  /* A section label draws a dashed rule above itself. As a flex item that
     rule would have been drawn under its own words only. */
  t.check(/\.page-title-row\.ptr-section\{margin:18px 0 8px;padding-top:16px;border-top:1px dashed var\(--line\);\}/.test(src)
    && /\.page-title-row\.ptr-section > \.form-section-label\{margin:0;padding-top:0;border-top:none;\}/.test(src),
    'and a section label hands its dashed rule to the row, which is as wide as the section');
  t.check(/title\.classList\.contains\('form-section-label'\) \? ' ptr-section' : ''/.test(extractFunction(src, 'foldInstruction', 'index.html')),
    'which the fold decides from the heading it was given');

  /* The moved copy has to read on a navy bubble. A .field-hint is a div
     and a .pfx-note carries its own colour, 66ch width and margins --
     a rule written for <p> alone left one of them grey-on-navy. */
  t.check(/\.page-info-bubble > \*\{/.test(src) && !/\.page-info-bubble p\{/.test(src),
    'anything folded in is restyled for the bubble, not just paragraphs');
  t.check(/\.page-info-bubble > \* \+ \*\{margin-top:9px;\}/.test(src),
    'and two notes in one bubble read as two paragraphs');
}

/* ---------- 5. icons where a glyph was standing in for one ----------- */
{
  t.check(/<button type="button" class="btn-icon" id="pr_tier_add">\s*<svg class="icon" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"\/><\/svg>/.test(modal),
    'Add tier carries the same plus icon the rest of the app uses');
  t.check(!/\+ Add tier/.test(modal),
    'rather than a plus typed into the label');
  t.check(/\.btn-icon\{display:inline-flex;align-items:center;gap:8px;\}/.test(src),
    'reusing the existing icon-button rule rather than a second one');
}

process.exit(t.done() ? 1 : 0);
