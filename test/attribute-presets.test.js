#!/usr/bin/env node
'use strict';
/*
 * Attributes typed on a product join the shop's list.
 *
 * The app already does this for places: a location typed on a customer
 * becomes a preset, so the second person to need "Ntinda" gets the first
 * person's spelling and the two records group together. Attributes had
 * no such path -- "Colour" and its values could be typed on every
 * variable product for ever, and the Presets page was the only way to
 * put them on the list.
 *
 * AN ATTRIBUTE IS A NAME AND A SET OF VALUES, so remembering it is two
 * jobs, and each has a way of going wrong:
 *
 *   THE NAME KEEPS ITS OWN SPELLING. Matched case-insensitively, but
 *   never rewritten -- "colour" typed today must not rename the "Colour"
 *   already sitting on twenty products.
 *
 *   THE VALUES MERGE, THEY DO NOT REPLACE. Adding Maroon to one product
 *   must not take Red and Blue away from every other product using that
 *   attribute. That is the failure that would be silent and expensive.
 *
 * Run: node test/attribute-presets.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('attribute presets');
const src = read('index.html');
const code = src.split(/\r?\n/).map((l) => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');

const data = { presetAttributes: [] };
const NAMES = ['rememberAttribute', 'rememberDraftAttributes'];
const scope = compileScope(
  NAMES.map((n) => extractFunction(src, n, 'index.html')), { data }, NAMES);

const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);
const attr = (name) => data.presetAttributes.find((a) => a.name === name);
const reset = () => { data.presetAttributes = [{ name: 'Colour', values: ['Red', 'Blue'] }]; };

/* ---------- 1. a new attribute joins the list ------------------------ */
{
  reset();
  const res = scope.rememberAttribute('Finish', 'Matt, Gloss');
  eq(res.added, true, 'an attribute nobody had is added');
  eq(attr('Finish').values.length, 2, 'with the values it was given');
  eq(attr('Finish').values[0], 'Matt', 'in the order they were typed');
  // Sorted, so the datalist reads alphabetically like the Presets page.
  eq(data.presetAttributes[0].name, 'Colour', 'and the list stays sorted');

  eq(scope.rememberAttribute('', 'Red'), null, 'a nameless attribute is not an attribute');
  eq(scope.rememberAttribute('   ', 'Red'), null, 'nor is one that is only spaces');
  eq(scope.rememberAttribute(null, null), null, 'and nothing at all is nothing');
}

/* ---------- 2. the name keeps its own spelling ----------------------- */
{
  reset();
  const res = scope.rememberAttribute('colour', 'Green');
  eq(res.added, false, 'an attribute already on file is not added twice');
  eq(data.presetAttributes.length, 1, 'so the list does not grow a near-duplicate');
  /* THE TRAP: matching case-insensitively must not mean OVERWRITING with
     whatever was typed last. Twenty products already say "Colour". */
  eq(attr('Colour').name, 'Colour', 'and it keeps ITS spelling, not the one just typed');
  eq(res.name, 'Colour', 'the caller is told the spelling that won');

  scope.rememberAttribute('  COLOUR  ', 'Black');
  eq(data.presetAttributes.length, 1, 'however it is spaced or cased');
}

/* ---------- 3. values merge, they never replace ---------------------- */
{
  reset();
  scope.rememberAttribute('Colour', 'Maroon');
  eq(attr('Colour').values.length, 3, 'a new value is added');
  t.check(attr('Colour').values.includes('Red') && attr('Colour').values.includes('Blue'),
    'and the values already there SURVIVE — this is the expensive one to get wrong');
  eq(attr('Colour').values[2], 'Maroon', 'the new one goes on the end');

  const again = scope.rememberAttribute('Colour', 'red, BLUE');
  eq(attr('Colour').values.length, 3, 'a value already on file is not added again in another case');
  eq(again.newValues.length, 0, 'and the caller is told nothing was new');

  reset();
  const res = scope.rememberAttribute('Colour', 'Red, Teal, Teal');
  eq(attr('Colour').values.length, 3, 'the same value typed twice in one box lands once');
  eq(res.newValues.length, 1, 'reported once too');

  reset();
  scope.rememberAttribute('Colour', '  ,  , Gold ,, ');
  eq(attr('Colour').values.length, 3, 'empty gaps between commas are not values');
  t.check(attr('Colour').values.includes('Gold'), 'while a real one among them is');

  // An attribute with no values is still an attribute worth having.
  reset();
  scope.rememberAttribute('Grade', '');
  t.check(!!attr('Grade') && attr('Grade').values.length === 0,
    'a name with no values yet is remembered, ready for values later');
}

/* ---------- 4. the whole form at once -------------------------------- */
{
  reset();
  const out = scope.rememberDraftAttributes([
    { name: 'Colour', values: 'Red, Gold' },     // one new value
    { name: 'Size', values: 'S, M, L' },         // wholly new
    { name: '', values: 'ignored' },             // not an attribute
  ]);
  t.check(out.added.includes('Size'), 'a wholly new attribute is reported as added');
  t.check(out.grown.some((g) => g.startsWith('Colour')), 'and an existing one as grown');
  t.check(/Saved to your attributes/.test(out.message), 'with one sentence for the whole form');
  t.check(/Colour \(\+1\)/.test(out.message), 'saying how many values were new');
  /* Nothing changed is not a message. A toast on every variant
     generation, saying nothing happened, is noise. */
  eq(scope.rememberDraftAttributes([{ name: 'Colour', values: 'Red' }]), null,
    're-generating with nothing new says nothing at all');
  eq(scope.rememberDraftAttributes([]), null, 'and an empty form says nothing');
  eq(scope.rememberDraftAttributes(null), null, 'as does no form');
}

/* ---------- 5. reached from the product form ------------------------- */
{
  const gen = extractFunction(src, 'generateVariants', 'index.html');
  t.check(/rememberDraftAttributes\(attrs\.map\(a=>\(\{ name: a\.name, values: a\.values\.join\(', '\) \}\)\)\)/.test(gen),
    'generating variants remembers the attributes it was given');
  /* Generating is the moment the typing becomes the product's shape --
     and it happens AFTER the guard that rejects an empty form, so
     nothing blank is ever remembered. */
  t.check(gen.indexOf("Add at least one attribute with values first") < gen.indexOf('rememberDraftAttributes'),
    'after the check that there is anything worth remembering');
  t.check(/saveData\(\);/.test(gen) && /refreshPresetDatalists\(\);/.test(gen),
    'and it is saved and offered in the suggestion list straight away');
  t.check(/toast\(remembered\.message/.test(gen),
    'with the shop told what was kept, rather than it happening invisibly');
  /* The datalist the product form reads must be the one that gets
     refreshed, or the new attribute is saved and still not suggested. */
  t.check(/list="dl_attribute_names"/.test(src)
    && /getElementById\('dl_attribute_names'\)\.innerHTML = \(data\.presetAttributes\|\|\[\]\)/.test(code),
    'the field suggests from the very list this writes to');
}

process.exit(t.done() ? 1 : 0);
