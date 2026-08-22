#!/usr/bin/env node
'use strict';
/*
 * The opening-balance fields have to be reached by the form's own styling.
 *
 * The supplier form's base input rule reads
 * `.sup input[type=text], .sup input:not([type]), .sup select`. Neither
 * half matches type=number or type=date, and this form had neither until
 * it learned to ask what the shop already owed a supplier.
 *
 * That did not degrade gracefully. It meant NO app styling reached either
 * field: no width, no box-sizing, no border, no radius, no padding. The
 * amount rendered as a raw browser number box with its spinners showing,
 * the "UGX" badge meant to sit inside it sat outside instead (the badge is
 * positioned against a container the input no longer filled), and the two
 * fields stood at different heights beside each other.
 *
 * This is the trap _extract.js was written for, in its own words: "Every
 * test asserted the rule's text was present and written after the general
 * one. Both were true. All three fields rendered at 14px anyway, for
 * weeks, until they were measured in a browser." So this file does not
 * check that a rule exists. It resolves the cascade against the real
 * element, the way a browser would, and asks what actually wins.
 *
 * Run: node test/supplier-opening-balance-styling.test.js   (or: npm test)
 */
const { read, createReporter, winningDeclaration, elementById } = require('./_extract');

const t = createReporter('supplier opening balance styling');
const src = read('index.html');

/* ---------- 1. the base rule reaches both new fields ----------------- */
/*
 * Checked by resolution, not by presence. Every one of these came back
 * null before the fix — the definition of a field the form is not
 * styling at all.
 */
[
  ['the amount', 's_open_bal'],
  ['the date', 's_open_since'],
].forEach(([what, id]) => {
  ['width', 'box-sizing', 'border', 'border-radius', 'padding'].forEach(prop => {
    const win = winningDeclaration(src, id, prop);
    t.check(!!win, `${what} field is given a ${prop} by the form's own styling${win ? ` (${win.sel} → ${win.value})` : ' — nothing reaches it'}`);
  });
});

/* ---------- 2. it is the same styling every other field gets --------- */
/*
 * Not merely "some rule wins", but the same values the rest of the form
 * uses — otherwise these two sit in the middle of the form looking like
 * guests.
 */
{
  const nameW = winningDeclaration(src, 's_phone', 'border-radius');
  ['s_open_bal', 's_open_since'].forEach(id => {
    const w = winningDeclaration(src, id, 'border-radius');
    t.check(!!w && !!nameW && w.value === nameW.value,
      `${id} carries the same corner as the rest of the form (${w && w.value} vs ${nameW && nameW.value})`);
  });
  const phoneWidth = winningDeclaration(src, 's_phone', 'width');
  ['s_open_bal', 's_open_since'].forEach(id => {
    const w = winningDeclaration(src, id, 'width');
    t.check(!!w && !!phoneWidth && w.value === phoneWidth.value,
      `${id} fills its column like every other field (${w && w.value})`);
  });
}

/* ---------- 3. the amount is the money field, not a plain box -------- */
/*
 * A figure kept in hundreds of thousands is read in a monospaced,
 * tabular face at a larger size, with room on the right for the currency
 * badge. That rule has to beat the base rule above it.
 */
{
  const fam = winningDeclaration(src, 's_open_bal', 'font-family');
  t.check(!!fam && /Plex Mono/.test(fam.value),
    `the amount is set in the money face (${fam && fam.value})`);
  const size = winningDeclaration(src, 's_open_bal', 'font-size');
  t.check(!!size && size.value === '18px',
    `at the money size, beating the base rule's 14px (${size && size.value})`);
  const pad = winningDeclaration(src, 's_open_bal', 'padding');
  t.check(!!pad && /52px/.test(pad.value),
    `with the right-hand room the UGX badge sits in (${pad && pad.value})`);
}

/* ---------- 4. the badge sits inside the field ----------------------- */
/*
 * It is absolutely positioned against .sup-amt, so it only lands inside
 * the box if the box is positioned AND the input fills it. The second
 * half is what broke.
 */
{
  const pos = winningDeclaration(src, 's_open_bal', 'width');
  t.check(!!pos && pos.value === '100%', 'the input fills its container, so the badge overlays the field rather than trailing it');
  const el = elementById(src, 's_open_bal');
  t.check(el.ancestors.some(a => a.classes.includes('sup-amt')),
    'and the badge\'s positioning context is the input\'s own ancestor');
  t.check(/\.sup-amt\{position:relative;\}/.test(src.replace(/\s+/g, ' ').replace(/ \{/g, '{')) || /\.sup-amt\{[^}]*position:relative/.test(src),
    'which is positioned');
}

/* ---------- 5. no spinners on money --------------------------------- */
/*
 * They step by 1, which on a figure in hundreds of thousands cannot do
 * anything useful, and they crowd the badge in the same corner. Applied
 * to both opening-balance fields, since the customer form asks the same
 * question in the other direction and the two are meant to look alike.
 */
{
  const css = src.replace(/\s+/g, ' ');
  t.check(/#s_open_bal,#c_debt\{-moz-appearance:textfield;\}/.test(css.replace(/ /g, '')),
    'the amount fields opt out of the spinner control');
  t.check(/s_open_bal::-webkit-inner-spin-button/.test(src) && /c_debt::-webkit-inner-spin-button/.test(src),
    'in both engines, and on both forms');
}

/* ---------- 6. the hint says the useful half ------------------------- */
{
  t.check(/leave blank if that is nothing/.test(src),
    'the hint still says what to do when nothing was owed');
  t.check(/shows in Creditors and on the balance sheet/.test(src),
    'and where the figure turns up, which is the part a shopkeeper cannot guess');
  /* Scoped to the hint itself. The whole-file form of this check failed
     on the validation toast ("You cannot owe them less than nothing.
     Leave it blank if you owed them nothing."), which is a different
     string doing a different job and is meant to stay. */
  const hint = (/function pipRefreshSettledBefore|hint\.textContent = 'Only what you owed them[\s\S]*?;/.exec(src) || [''])[0];
  t.check(hint.length > 0, 'found the hint');
  t.check(!/Leave it blank if you owed them nothing/.test(hint),
    'without the third sentence that repeated the first');
  t.check((hint.match(/\./g) || []).length <= 3,
    'and reads as two sentences rather than three');
}

process.exit(t.done() ? 1 : 0);
