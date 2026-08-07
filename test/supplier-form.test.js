#!/usr/bin/env node
'use strict';
/*
 * Adding a supplier.
 *
 * Five boxes opening on a disabled one, and NOTHING STOPPED THE SAME
 * SUPPLIER BEING ENTERED TWICE. Verified on the running app: two
 * "Katwe Iron Works", no warning, "Supplier saved".
 *
 * That is not a tidiness problem. supplierName() returns the same string
 * for both, so every screen that shows a supplier -- the creditors list,
 * the price registry, Compare Prices, the buying list, the pickup runs
 * -- shows two identical rows, with the prices attached to one and the
 * invoices to the other, and nothing to tell them apart. The shop's view
 * of that relationship splits in half permanently, and the halves both
 * look right.
 *
 * The second silence: a supplier with no prices on file cannot be picked
 * as a source for anything. Adding one and closing the form changed
 * nothing operationally, and the form did not say so.
 *
 * Run: node test/supplier-form.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter, winningDeclaration } = require('./_extract');

const t = createReporter('supplier form');
const src = read('index.html');
const code = src.split(/\r?\n/).map((l) => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');

const data = { suppliers: [] };
const NAMES = ['supNormalisedName', 'supFindDuplicate'];
const scope = compileScope([...NAMES.map((n) => extractFunction(src, n, 'index.html'))], { data }, NAMES);

const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);
const modal = (/<div class="modal-overlay" id="supplierModal">[\s\S]*?\n<\/div>\n/.exec(src) || [''])[0];
const save = (/s_save'\)\.addEventListener[\s\S]*?\n\}\);/.exec(code) || [''])[0];

/* ---------- 1. the same supplier, typed twice ------------------------ */
{
  data.suppliers = [{ id: 'SP001', name: 'Katwe Iron Works', location: 'Katwe' }];

  t.check(!!scope.supFindDuplicate('Katwe Iron Works', null), 'the same name is recognised');
  /* Matched as somebody would SAY it. Trailing spaces, double spaces and
     capitals are not a different supplier, and a shop typing the name a
     second time will not reproduce the first keystroke for keystroke. */
  t.check(!!scope.supFindDuplicate('  katwe   IRON works ', null),
    'however it was typed the second time');
  eq(scope.supNormalisedName('  Katwe   IRON works '), 'katwe iron works',
    'because the comparison is on the name as spoken');

  t.check(scope.supFindDuplicate('Nsambya Steel', null) === null, 'a different name is not a duplicate');
  /* An unnamed supplier on file is what makes the empty-key guard load
     bearing: without it a blank box matches them, and the form accuses
     somebody of duplicating a supplier before they have typed a letter. */
  data.suppliers.push({ id: 'SP009', name: '', location: '' });
  t.check(scope.supFindDuplicate('', null) === null, 'and an empty box matches nothing');
  t.check(scope.supFindDuplicate('   ', null) === null, 'nor does a box with only spaces');
  t.check(!!scope.supFindDuplicate('Katwe Iron Works', null),
    'while a real name still finds its match with an unnamed supplier on file');
  data.suppliers = data.suppliers.filter((x) => x.id !== 'SP009');

  /* Editing must not accuse a supplier of duplicating itself -- the
     warning would be permanent and the shop would learn to ignore it. */
  t.check(scope.supFindDuplicate('Katwe Iron Works', 'SP001') === null,
    'and a supplier being edited is not its own duplicate');
}

/* ---------- 2. asked, not refused ------------------------------------ *
 * Two genuinely different firms CAN share a name, and a shop that means
 * it has to be able to say so. Refusing would make the app wrong about
 * the world; staying silent made it wrong about the shop's own records.
 */
{
  t.check(/const dup = supFindDuplicate\(name, editingSupplierId\);/.test(save),
    'saving checks for one');
  t.check(/if\(dup && !confirm\(/.test(save) && /Add them anyway\?/.test(save),
    'and asks rather than refusing');
  t.check(/prices and invoices will split between them/.test(save),
    'saying what actually goes wrong, not merely that the name is taken');
  /* Declining must leave nothing behind. `return` inside the if, not a
     flag checked later. */
  t.check(/\)\) return;/.test(save), 'and saying no adds nothing');
}

/* ---------- 3. said before saving, too ------------------------------- */
{
  const dupPanel = (/function supRenderDuplicate[\s\S]*?\n\}\n/.exec(code) || [''])[0];
  t.check(/id="s_duplicate"/.test(modal), 'the form warns as the name is typed');
  /* Pinned on the guard, not on the text below it: replacing `if(!dup)`
     with an unconditional early return left every string in the function
     present and unreachable while the checks went on passing. */
  t.check(/if\(!dup\)\{ el\.innerHTML = ''; return; \}/.test(dupPanel),
    'drawn only when there IS one, and reached when there is');
  t.check(/creditorTotalOwed\(dup\.id\)/.test(dupPanel) && /data\.prices\|\|\[\]\)\.filter/.test(dupPanel),
    'showing what the existing one already carries — prices and money owed');
  /* The way out matters more than the warning: the thing they meant to
     do is almost always open the one they have. */
  t.check(/Open the one you have instead/.test(dupPanel) && /editSupplier\(dup\.id\)/.test(dupPanel),
    'and offers to open it instead of making them cancel and hunt for it');
}

/* ---------- 4. a supplier with no prices can do nothing --------------- */
{
  const conseq = (/function supRenderConsequence[\s\S]*?\n\}\n/.exec(code) || [''])[0];
  /* Two branches say something similar, so the check has to name WHICH.
     A looser match passed on the new-supplier sentence while the one for
     a supplier already on file said nothing useful. */
  t.check(/No prices on file, so they cannot be picked as a source for anything yet\. Add one in the Price book\./.test(conseq),
    'a supplier already on file with no prices is told plainly they cannot be chosen');
  t.check(/until a price exists they cannot be picked as a source for anything/.test(conseq),
    'and a brand new one is told what to do next');
  t.check(/'sup-consequence warn'/.test(conseq),
    'and marks an existing one in that state rather than stating it flatly');
  t.check(/so they can be picked as a source/.test(conseq),
    'while one that is ready says so');

  /* Where somebody actually drives. The pickup runs group a morning's
     collections by this, so a blank one is not a missing note. */
  const locHint = (/function supRenderLocationHint[\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(/nowhere to be collected from on a pickup run/.test(locHint),
    'and a blank location is named as an operational gap, not an empty field');
  t.check(/Where you collect from them/.test(modal),
    'with the field labelled for what it is used for');
}

/* ---------- 5. the form opens on something you can type in ----------- */
{
  t.check(!/<input id="s_id" disabled>/.test(modal),
    'the generated id is no longer a disabled box at the top');
  t.check(/<input type="hidden" id="s_id">/.test(modal) && /id="s_id_note"/.test(modal),
    'it is a footnote, which still shows it');
  t.check(modal.indexOf('id="s_name"') < modal.indexOf('id="s_id_note"'),
    'and the name comes first');
  /* Both ways in focus it: adding and editing. A single presence check
     would pass with the add path — the one used most — silently broken. */
  eq((code.match(/getElementById\('s_name'\)\.focus\(\)/g) || []).length, 2,
    'with the cursor in it, whether the form was opened to add or to edit');
  /* MEASURED, not matched. Every one of these forms asserted its rule
     was present and written after the general one; both were true and
     the field still rendered at 14px, because `input[type=text]` does
     not match an <input> that declares no type. winningDeclaration
     resolves the cascade the way a browser does. */
  eq(winningDeclaration(src, 's_name', 'font-size').value, '19px',
    'and the name actually renders set apart from the fields that describe it');
  eq(winningDeclaration(src, 's_phone', 'font-size').value, '14px',
    'which only means something because those fields do not');
}

/* ---------- 6. the place is one of the shop's, not free text --------- *
 * Customers and agents already chose from a shared list of places and
 * added to it. Suppliers were the last field keeping their own free
 * text, so a supplier in Ntinda and a customer in Ntinda were unrelated
 * strings — and the pickup runs, which group a morning's collections by
 * where they are, could not put them on the same trip.
 */
{
  t.check(/<input id="s_location" list="dl_locations"/.test(modal),
    'the location field suggests the places the shop already uses');
  t.check(/Choose a place, or type a new one/.test(modal),
    'and says a new one may be typed');
  t.check(/\['c_location','ag_location','s_location'\]\.forEach/.test(code),
    'wired alongside the customer and agent fields, in the one place that does it');

  /* rememberLocation both KEEPS a new place and settles a known one to
     its recorded spelling, so "ntinda" and "Ntinda" do not become two
     stops on the same run. Saving the raw box would do neither. */
  t.check(/location: rememberLocation\(document\.getElementById\('s_location'\)\.value\)/.test(save),
    'and what is saved goes through the list, so a new place is kept and a known one settles');

  const locHint = (/function supRenderLocationHint[\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(/data\.presetLocations\|\|\[\]\)\.some\(l=> l\.toLowerCase\(\) === val\.toLowerCase\(\)\)/.test(locHint),
    'the form knows whether what was typed is a place it already has');
  t.check(/is new — it will be added to your places and offered next time/.test(locHint),
    'and says when it is about to add one, rather than doing it silently');
}

/* ---------- 7. the list was empty when it mattered ------------------- *
 * refreshPresetDatalists only ever ran from the product form and the
 * presets page. Opening the app and going straight to any form with a
 * location field offered an EMPTY dropdown — seven places on file, none
 * suggested. True of customers and agents too, and my supplier field
 * would have inherited it.
 */
{
  t.check(/function refreshLocationDatalist\(\)\{/.test(code),
    'the list of places can be built on its own');
  t.check(/input\.addEventListener\('focus', refreshLocationDatalist\);/.test(code),
    'and is built when a location field is focused — the one moment it is certainly needed');
  t.check(/function refreshPresetDatalists\(\)\{[\s\S]*?refreshLocationDatalist\(\);/.test(code),
    'with the bulk refresh calling the same function, so the two cannot drift apart');
}

/* ---------- 8. the shop no.: the door, not the town ------------------ *
 * "Ntinda" says which part of town the pickup run goes to; "B12" says
 * which door inside the arcade the worker actually knocks on. One field
 * doing both jobs did neither, so the shop no. is its own field -- and
 * it rides all the way to the label the collecting worker reads.
 */
{
  t.check(/<input id="s_shopno"[^>]*placeholder="Shop no\. inside the building/.test(modal),
    'the form asks for the shop no., separate from the place');
  t.check(/shopNo: document\.getElementById\('s_shopno'\)\.value\.trim\(\),/.test(save),
    'and saving records it, trimmed');
  t.check(/document\.getElementById\('s_shopno'\)\.value = s\.shopNo \|\| '';/.test(src),
    'editing fills it back');
  t.check(/\['s_id','s_name','s_phone','s_location','s_shopno','s_notes'\]/.test(src),
    'and the reset clears it with the rest');

  /* Both directions of the sync, in both apps -- an unmapped column is a
     field that quietly empties itself on the next reload. */
  t.check(/shopNo:s\.shop_no\|\|''/.test(src), 'the admin load carries shop_no in');
  t.check(/shop_no:s\.shopNo\|\|null/.test(src), 'the save maps it back to its column');
  t.check(/shopNo:s\.shop_no\|\|''/.test(read('worker.html')), 'and the worker load carries it too');

  /* The label the collecting worker reads, from the shared code both
     apps run. */
  const lscope = compileScope(
    [extractFunction(read('shared-worker.js'), 'pickItemSourceLabel', 'shared-worker.js')],
    { data }, ['pickItemSourceLabel']);
  data.suppliers = [
    { id: 'SP1', name: 'Katwe Iron Works', location: 'Katwe', shopNo: 'B12' },
    { id: 'SP2', name: 'Nsambya Steel', location: 'Nsambya', shopNo: '' },
    { id: 'SP3', name: 'City Bolts', location: '', shopNo: '7C' },
  ];
  eq(lscope.pickItemSourceLabel({ supplierId: 'SP1' }), 'Katwe Iron Works — Katwe · Shop B12',
    'the collecting worker reads the town AND the door');
  eq(lscope.pickItemSourceLabel({ supplierId: 'SP2' }), 'Nsambya Steel — Nsambya',
    'no shop no., no clutter');
  eq(lscope.pickItemSourceLabel({ supplierId: 'SP3' }), 'City Bolts — Shop 7C',
    'a door with no town still shows');
  eq(lscope.pickItemSourceLabel({ supplierId: '__stock__' }), 'Shop',
    'shelf stock is still just the shop');

  /* And the admin's pickup-run line shows the door beside the place. */
  t.check(/\$\{esc\(sup\.location\)\}\$\{sup\.shopNo \? ' · Shop ' \+ esc\(sup\.shopNo\) : ''\}/.test(src),
    'the pickup run names the shop no. beside the place');
}

process.exit(t.done() ? 1 : 0);
