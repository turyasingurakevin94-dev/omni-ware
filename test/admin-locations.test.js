#!/usr/bin/env node
'use strict';
/*
 * One place, spelled one way.
 *
 * A location's whole job is to be the SAME string on two records. Typed
 * free into a text box it is not: "Ntinda", "ntinda" and " Ntinda " are
 * three places as far as any grouping is concerned, and the delivery
 * clusters -- whose entire purpose is putting orders for one place on one
 * trip -- quietly split in half.
 *
 * So locations are a preset, chosen from a list. Adding one is still a
 * single keystroke: type a place that is not on the list and press Enter.
 * Nobody is sent to a settings screen to record a customer who lives
 * somewhere new.
 *
 * And it is required, on customers and on agents, because everything
 * downstream that plans a delivery reads it and there is no second place
 * to get it from. An order for a customer with no location cannot be
 * grouped or routed; it sits under "No address yet" until somebody rings
 * them.
 *
 * Run: node test/admin-locations.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('admin locations');
const src = read('index.html');

const data = { presetLocations: [], customers: [] };
const said = [];
let saves = 0, datalistRefreshes = 0;

const scope = compileScope([
  extractFunction(src, 'canonicalLocation', 'index.html'),
  extractFunction(src, 'rememberLocation', 'index.html'),
], {
  data,
  saveData: () => { saves++; },
  refreshPresetDatalists: () => { datalistRefreshes++; },
  toast: (m) => { said.push(String(m)); },
}, ['canonicalLocation', 'rememberLocation']);

const reset = (locs) => {
  data.presetLocations = (locs || ['Bwaise', 'Ntinda']).slice();
  data.customers = [];
  said.length = 0; saves = 0; datalistRefreshes = 0;
};

/* ---------- 1. the same place is the same string ---------------------- */
{
  reset();
  t.check(scope.canonicalLocation('  Ntinda  ') === 'Ntinda', 'stray spaces are trimmed off');
  t.check(scope.canonicalLocation('Plot  14   Ntinda') === 'Plot 14 Ntinda',
    'and a doubled space in the middle is collapsed');
  t.check(scope.canonicalLocation('ntinda') === 'Ntinda',
    'a place already on the list comes back spelled the way it was recorded');
  t.check(scope.canonicalLocation('NTINDA') === 'Ntinda', 'whatever case it was typed in');
  t.check(scope.canonicalLocation('Seeta') === 'Seeta',
    'while somewhere genuinely new keeps the spelling it was given');
  t.check(scope.canonicalLocation('') === '' && scope.canonicalLocation('   ') === '',
    'and blank stays blank rather than becoming a place called nothing');
  t.check(scope.canonicalLocation(null) === '' && scope.canonicalLocation(undefined) === '',
    'as does nothing at all');
}

/* ---------- 2. typing a new one records it ---------------------------- */
{
  reset();
  const got = scope.rememberLocation('Seeta');
  t.check(got === 'Seeta', 'a new place is returned as given');
  t.check(data.presetLocations.includes('Seeta'), 'and joins the list');
  t.check(saves === 1 && datalistRefreshes === 1,
    'saved and offered immediately, so the next person choosing sees it');
  t.check(said.some((m) => /Seeta/.test(m)), 'with the person told it was added');

  said.length = 0; saves = 0;
  const again = scope.rememberLocation('seeta');
  t.check(again === 'Seeta', 'entering it again in another case returns the recorded spelling');
  t.check(data.presetLocations.filter((l) => l.toLowerCase() === 'seeta').length === 1,
    'and does not add a second entry for the same place -- which is the whole point');
  t.check(saves === 0 && said.length === 0, 'saying nothing, because nothing changed');

  // Sorted, not appended. Checked with a place that belongs at the FRONT --
  // append and sort agree on anything that happens to come last, so a
  // fixture like that proves nothing.
  scope.rememberLocation('Bugolobi');
  t.check(data.presetLocations.join(',') === ['Bugolobi', 'Bwaise', 'Ntinda', 'Seeta'].join(','),
    `a new place lands in its alphabetical spot rather than on the end (${data.presetLocations.join(', ')})`);

  reset();
  t.check(scope.rememberLocation('   ') === '' && data.presetLocations.length === 2,
    'a blank entry records nothing');
}

/* ---------- 3. it survives a shop with no list yet -------------------- */
{
  reset();
  delete data.presetLocations;
  t.check(scope.rememberLocation('Seeta') === 'Seeta', 'a shop with no locations on file can still add one');
  t.check(Array.isArray(data.presetLocations) && data.presetLocations.includes('Seeta'),
    'and the list is created rather than thrown at');
}

/* ---------- 4. required on both onboarding forms ---------------------- */
{
  const code = src.split(/\r?\n/).map((l) => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');

  t.check(/const location = rememberLocation\(document\.getElementById\('c_location'\)\.value\);/.test(code),
    'saving a customer reads the location through rememberLocation, so typing a new one records it');
  t.check(/if\(!location\)\{[\s\S]{0,200}?c_location'\)\.focus\(\)/.test(code),
    'and refuses to save without one, putting the cursor where the problem is');

  t.check(/const location = rememberLocation\(document\.getElementById\('ag_location'\)\.value\);/.test(code),
    'inviting an agent does the same');
  t.check(/if\(!location\)\{[\s\S]{0,220}?ag_location'\)\.focus\(\)/.test(code),
    'and refuses the invite without one');

  // The field has to be reachable and labelled as required, or "required"
  // is a rule the person only meets by being refused.
  t.check(/<input id="c_location" list="dl_locations"/.test(code), 'the customer field offers the list');
  t.check(/<input id="ag_location" list="dl_locations"/.test(code), 'and so does the agent field');
  t.check(/Location <span class="req">required<\/span>/.test(code)
    && /Based at <span class="req">required<\/span>/.test(code),
  'both labels say so before the person fills the form in, not after');
  t.check(/press Enter to add it/.test(code) && /press Enter\./.test(code),
    'and both say how to add one that is not on the list');

  /* The supplier field joined these two. It was the last one keeping its
     own free text, so a supplier in Ntinda and a customer in Ntinda were
     unrelated strings and a pickup run could not group them. */
  t.check(/\['c_location','ag_location','s_location'\]\.forEach/.test(code),
    'both inputs are wired for choose-or-add');
  t.check(/<datalist id="dl_locations">/.test(code)
    && /function refreshLocationDatalist\(\)\{[\s\S]*?\(data\.presetLocations\|\|\[\]\)/.test(code),
  'off one datalist fed from the preset list');
  /* Pulled out of refreshPresetDatalists because THAT only ever ran from
     the product form and the presets page: opening the app and going
     straight to a form with a location field offered an empty dropdown
     with seven places on file. Filled when the field is focused, which
     is the one moment it is certainly needed. */
  t.check(/input\.addEventListener\('focus', refreshLocationDatalist\);/.test(code),
    'and filled when a location field is used, not only when the presets page has been visited');
  t.check(/function refreshPresetDatalists\(\)\{[\s\S]*?refreshLocationDatalist\(\);/.test(code),
    'from the one function that builds it, so the two cannot drift apart');
}

/* ---------- 5. the list is carried with the shop ---------------------- */
{
  const code = src.split(/\r?\n/).map((l) => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');
  t.check(/presetLocations: presets\.locations \|\| seed\.presetLocations,/.test(code),
    'the list is read back from the shop settings');
  t.check(/locations:d\.presetLocations,/.test(code), 'and written with them');
  t.check(/presetLocations: \['Ntinda'/.test(code),
    'with a starting set, so the first customer is not typed into an empty list');
}

/* ---------- 6. renaming a place moves everybody standing there -------- */
{
  // The rename is the dangerous one. Left alone, the customers keep a
  // string that is no longer on the list -- which is exactly the split
  // this preset exists to prevent, reintroduced by the tool meant to
  // tidy it.
  const fn = extractFunction(src, 'renderPresetLocations', 'index.html');
  t.check(/data\.customers\|\|\[\]\)\.forEach/.test(fn) && /c\.location = val;/.test(fn),
    'renaming a location carries every customer recorded at it across');
  t.check(/\(c\.location\|\|''\)\.toLowerCase\(\) === String\(from\|\|''\)\.toLowerCase\(\)/.test(fn),
    'matching however each of them happened to be spelled');
  t.check(/renderCustomers\(\)/.test(fn), 'and the customer list is redrawn to show it');

  // Removing is safe but not free: the records keep the string, and the
  // place stops being offered. Worth a word rather than a silent removal.
  t.check(/const inUse = \(data\.customers\|\|\[\]\)\.filter/.test(fn),
    'removing a location counts who is recorded there');
  t.check(/if\(inUse && !confirm\(/.test(fn),
    'and asks first when that count is not zero -- gated on the count, not merely near it');
  t.check(/\$\{inUse\} customer/.test(fn), 'naming how many, so the answer is an informed one');
  t.check(/if\(inUse && !confirm\([\s\S]{0,200}?\) return;/.test(fn),
    'and a declined confirm removes nothing');
}

/* ---------- 7. it feeds the thing it exists for ----------------------- */
{
  // The delivery clusters group on a normalised key precisely because
  // locations were free text. They still normalise -- belt and braces --
  // but the preset is what stops the split happening in the first place.
  const dest = extractFunction(src, 'destinationKey', 'index.html');
  t.check(/toLowerCase\(\)/.test(dest),
    'the delivery clusters still normalise what they are given, since older records predate the list');
}

process.exit(t.done() ? 1 : 0);
