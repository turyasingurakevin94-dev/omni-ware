#!/usr/bin/env node
'use strict';
/*
 * The short description on a product.
 *
 * A second text field beside the notes, and the whole risk is that the
 * two become one thing typed twice. They are not the same:
 *
 *   short description   what the item IS, in the words a customer uses.
 *                       "Heavy duty steel wheelbarrow, 90 litre".
 *   notes               what YOU need to remember about it. Whose van it
 *                       comes on, which backstreet the supplier is down.
 *
 * So they are labelled apart, and both are searchable -- the description
 * because a customer has just said "90 litre" and the product's own name
 * does not contain those words.
 *
 * The other trap is old rows. Every product saved before this column
 * existed has no value at all, and an undefined dropped into an input
 * renders the literal word "undefined" -- which then gets saved as the
 * description the next time anybody presses Save.
 *
 * Run: node test/product-short-description.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('product short description');
const src = read('index.html');
const code = src.split(/\r?\n/).map((l) => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');

const scope = compileScope([extractFunction(src, 'productSearchText', 'index.html')],
  {}, ['productSearchText']);

/* ---------- 1. it is part of what a product is found by -------------- */
{
  const p = {
    name: 'Wheelbarrow', category: 'Tools', subcategory: '', id: 'P1',
    shortDescription: 'Heavy duty steel barrow, 90 litre',
    notes: 'Comes on the Tuesday lorry',
  };
  const text = scope.productSearchText(p);
  t.check(text.includes('90 litre'),
    'a customer saying "90 litre" can be typed straight into the search');
  t.check(text.includes('heavy duty'), 'and lower-cased, so any capitalisation finds it');
  t.check(text.includes('tuesday'), 'the notes are still in there beside it');
  t.check(text.includes('wheelbarrow') && text.includes('p1'),
    'along with everything the search already matched on');

  /* Old rows. Neither field exists on a product saved before its column
     did, and "undefined" in the haystack would make the word `undefined`
     match every such product. */
  const bare = { name: 'Nail', category: 'Fixings', subcategory: '', id: 'P2' };
  t.check(!scope.productSearchText(bare).includes('undefined'),
    'a product with neither field does not become findable by the word "undefined"');
  t.check(scope.productSearchText(bare).includes('nail'), 'and is still findable by its name');
  t.check(!scope.productSearchText({ ...bare, shortDescription: null }).includes('null'),
    'nor by the word "null" when the column came back empty');
}

/* ---------- 2. the field on the form --------------------------------- */
{
  t.check(/id="p_short_desc"/.test(src), 'the Add product popup has the field');
  t.check(/<label>Short description<\/label>/.test(src), 'labelled for what it holds');
  /* "Short" has to be enforced by the box, not just asked for in the
     label, or it becomes a second notes field with a different name. */
  t.check(/id="p_short_desc" maxlength="120"/.test(src),
    'and capped, so "short" is a property of the field rather than a request');

  /* The two fields sit together, so each has to say which is which or
     they get filled in twice with the same sentence. */
  const basics = src.slice(src.indexOf('id="pfpane-basics"'), src.indexOf('id="pfpane-photo"'));
  t.check(/read out to a customer/.test(basics) && /not the customer/.test(basics),
    'each of the two text fields says who it is for, so they do not become the same field twice');
  t.check(basics.indexOf('p_short_desc') < basics.indexOf('p_notes'),
    'what the thing is comes before what to remember about it');
}

/* ---------- 3. it survives the round trip ---------------------------- */
{
  t.check(/shortDescription: p\.short_description \|\| ''/.test(code),
    'the column is read back from the server');
  t.check(/short_description: p\.shortDescription \|\| null/.test(code),
    'and written to it — empty as null, not as an empty string pretending to be a description');

  // The product record is built in the save handler, not a named function.
  t.check(/shortDescription: document\.getElementById\('p_short_desc'\)\.value\.trim\(\)/.test(code),
    'saving a product keeps what was typed, trimmed');

  /* THE OLD-ROW TRAP. Without the fallback the input shows the word
     "undefined", and the next Save writes that as the description. */
  t.check(/document\.getElementById\('p_short_desc'\)\.value = p\.shortDescription \|\| '';/.test(code),
    'reopening a product written before this field existed shows an empty box, not the word "undefined"');

  t.check(/'p_id','p_name','p_category','p_subcategory','p_short_desc','p_notes'/.test(code),
    'and it is cleared with the rest of the form, so it cannot ride into the next product');
}

process.exit(t.done() ? 1 : 0);
