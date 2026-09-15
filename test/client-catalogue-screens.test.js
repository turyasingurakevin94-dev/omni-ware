#!/usr/bin/env node
'use strict';
/*
 * The catalogue and the item screen, rendered.
 *
 * These are the first screens in the portal that show a price, so the
 * checks here are about a price being right ON SCREEN rather than right
 * in the response -- client-portal-pricing.test.js owns the arithmetic.
 * What can go wrong here is different: a figure with the wrong word after
 * it, a fact stated twice, a fact stated that is not true of this row.
 *
 * Everything below runs the shipped render functions against a stub DOM.
 * Reading them missed all four of these, and one pass of rendering showed
 * every one:
 *
 *   - "How many sheet" at a quantity of one, which is correct English and
 *     reads as a typo on a label asking for a count.
 *   - "How many kgs", from a pluraliser that did not know an abbreviation
 *     when it saw one.
 *   - an item with no price on file saying "Out of stock just now"
 *     directly above "We have no price on file" -- two different facts,
 *     one of them untrue.
 *   - "No photograph yet" on every un-photographed row of the ledger,
 *     below the held price and below "Out of stock just now", burying the
 *     two lines that change what a customer does.
 *
 * Run: node test/client-catalogue-screens.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('catalogue screens');
const src = read('client.html');

const AVAIL = { 'in-stock': 'In stock', 'to-order': 'We order this in', 'out': 'Out of stock just now' };
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December'];
const words = (h) => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const count = (h, re) => (words(h).match(re) || []).length;

const LIST = ['esc', 'money', 'plural', 'longDate', 'many', 'unitWord', 'packLine',
  'imgHTML', 'exceptionHTML', 'heldHTML', 'cheaperHTML', 'figureHTML', 'rowHTML',
  'cellHTML', 'packSplit', 'rungFor'];
const list = compileScope(LIST.map(n => extractFunction(src, n, 'client.html')), { AVAIL, MONTHS }, LIST);

const ITEM = { productId: 'P1', variantIdx: null, name: 'Iron sheets — G28 box profile',
  variantLabel: '', note: '', category: 'Roofing', subcategory: '', image: null,
  available: true, availability: 'in-stock', unitPrice: 48500, heldFrom: null,
  unit: 'sheet', packUnit: 'bundle', packQty: 12, nextMinQty: null, nextPrice: null };
const row = (o) => list.rowHTML({ ...ITEM, ...o }, 0);

/* ---------- 1. a figure never travels without its word ---------------- */
{
  /* Against figureHTML, not the whole row. "per sheet" also appears in
     the pack line under the name, so a row-wide match stayed green when
     the figure lost its unit entirely and read as a bare 48,500. */
  t.check(/48,500/.test(words(list.figureHTML(ITEM))) && /per sheet/.test(words(list.figureHTML(ITEM))),
    `a price on the ledger says what it is per (${words(list.figureHTML(ITEM))})`);
  t.check(/each/.test(words(list.figureHTML({ ...ITEM, unit: '' }))),
    'and "each" where the shop has not named a unit, rather than a bare figure');
  t.check(/48,500/.test(words(row({}))) && /per sheet/.test(words(row({}))),
    'and it reaches the row');
  t.check(/Cheaper from 12 — 44,000 a sheet/.test(words(row({ nextMinQty: 12, nextPrice: 44000 }))),
    'the cheaper breakpoint names the quantity, the price and the unit');
  t.check(!/Cheaper from/.test(words(row({}))),
    'and is absent where there is no cheaper breakpoint');
}

/* ---------- 2. only the exceptions are said -------------------------- */
/*
 * "In stock" against every line is noise that makes the two lines which
 * matter invisible.
 */
{
  t.check(!/In stock/.test(words(row({ availability: 'in-stock' }))),
    'the ordinary case says nothing on a list');
  t.check(/We order this in/.test(words(row({ availability: 'to-order' }))), 'the two exceptions do');
  t.check(/Out of stock just now/.test(words(row({ availability: 'out' }))), 'both of them');
  // A price that cannot be bought today is still the price -- a customer
  // planning a job needs the number as much as one buying today.
  t.check(/11,400/.test(words(row({ availability: 'out', unitPrice: 11400 }))),
    'an out-of-stock item keeps its price rather than vanishing');
  t.check(/var\(--meta\)/.test(row({ availability: 'out' })),
    'greyed, so the eye still ranks it below what can be had');
}

/* ---------- 3. the held price, and whose it is ----------------------- */
{
  const h = row({ heldFrom: '2026-07-04' });
  t.check(/Your price, held from 4 July/.test(words(h)),
    'a held price says so, and says since when');
  t.check(!/held/.test(words(row({}))), 'and an ordinary price does not');
}

/* ---------- 4. the photograph, and its absence ----------------------- */
{
  t.check(/<img src="https:\/\/x\/y.jpg"/.test(row({ image: 'https://x/y.jpg' })),
    'a photograph is rendered');
  t.check(/loading="lazy"/.test(row({ image: 'https://x/y.jpg' })),
    'lazily — a catalogue is a long list on a handset');
  t.check(/img-none/.test(row({})), 'its absence gets the dashed mat');

  /* The canvas words the absence on the list row too. Rendered against
     real rows it landed on EVERY un-photographed line, below the held
     price and below "Out of stock just now" -- so a rule meant to stop a
     customer being misled was burying what they needed to read. The
     dashed, crossed-through 48px mat is not disguising itself as a
     photograph; the words stay where a plain box could be mistaken for
     one. */
  t.check(!/No photograph/.test(words(row({}))),
    'but not in words at 48px, where it would outrank the price memory');
  t.check(/No photograph/.test(words(list.cellHTML({ ...ITEM }, 0))),
    'and in words in the gallery, where the box is big enough to be mistaken for one');
  t.check(!/No photograph/.test(words(list.cellHTML({ ...ITEM, image: 'https://x/y.jpg' }, 0))),
    'never against a photograph that exists');
}

/* ---------- 5. nothing a customer types is trusted ------------------- */
{
  t.check(!/<script>/.test(row({ name: '<script>alert(1)</script>' })),
    'a product name is escaped -- it reaches here from the shop\'s own records, which is not the same as safe');
  t.check(!/<script>/.test(list.cellHTML({ ...ITEM, name: '<script>x</script>' }, 0)),
    'in the gallery too');
}

/* ---------- 6. English ------------------------------------------------ */
{
  t.check(['sheet', 'box', 'bunch', 'bag', 'piece', 'brush'].map(list.many).join(' ')
    === 'sheets boxes bunches bags pieces brushes',
    `a unit pluralises (${['sheet', 'box', 'bunch'].map(list.many).join(', ')})`);
  // kg, m, pc are already both, and "kgs" is not a word anybody says.
  t.check(['kg', 'm', 'pc'].every(u => list.many(u) === u),
    `an abbreviation is left alone (${['kg', 'm', 'pc'].map(list.many).join(', ')})`);

  t.check(list.packSplit(140, 12, 'bundle', 'sheet') === '11 bundles and 8 loose',
    `a quantity is said in the units a trade customer orders in (${list.packSplit(140, 12, 'bundle', 'sheet')})`);
  t.check(list.packSplit(24, 12, 'bundle', 'sheet') === '2 bundles', 'with no "and 0 loose"');
  t.check(list.packSplit(12, 12, 'bundle', 'sheet') === '1 bundle', 'and one is not "1 bundles"');
}

/* ---------- 7. the rung a quantity earns ----------------------------- */
{
  const ladder = [{ minQty: 1, unitPrice: 51000 }, { minQty: 12, unitPrice: 48500 }, { minQty: 60, unitPrice: 46000 }];
  t.check(list.rungFor(ladder, 1).unitPrice === 51000, 'one gets the qty-1 rung');
  t.check(list.rungFor(ladder, 11).unitPrice === 51000, 'eleven still does');
  t.check(list.rungFor(ladder, 12).unitPrice === 48500, 'twelve clears the next');
  t.check(list.rungFor(ladder, 140).unitPrice === 46000, 'and 140 the last');
  // The ladder always carries a rung at 1, so there is always one to find
  // -- the agent app's equivalent had a fallback that quoted a volume
  // price for a small order.
  t.check(list.rungFor(ladder, 0) === null, 'below every rung there is no rung, rather than the cheapest one');
}

/* ---------- 8. the item screen --------------------------------------- */
const renderItem = (it, priced, qty) => {
  const nodes = {};
  ['itemBody', 'itemFoot', 'itemTitle', 'qtyDown', 'qtyUp', 'qtyBox',
   'itemAddWrap', 'itemAdd'].forEach((id) => {
    nodes[id] = { id, innerHTML: '', textContent: '', value: '', disabled: false,
      addEventListener() {}, onclick: null };
  });
  const NAMES = ['esc', 'money', 'plural', 'longDate', 'many', 'unitWord', 'packLine',
    'imgHTML', 'rungFor', 'packSplit', 'renderItem'];
  compileScope(NAMES.map(n => extractFunction(src, n, 'client.html')), {
    document: { getElementById: (id) => nodes[id] || null },
    AVAIL, MONTHS, item: { it, priced }, itemQty: qty, setQty() {},
  }, ['renderItem']).renderItem();
  return { html: nodes.itemBody.innerHTML, foot: nodes.itemFoot.textContent,
    add: nodes.itemAdd.textContent, addShown: !nodes.itemAddWrap.hidden };
};

{
  const it = { ...ITEM, note: '3m box profile, 28 gauge' };
  const ladder = [{ minQty: 1, unitPrice: 51000 }, { minQty: 12, unitPrice: 48500 }, { minQty: 60, unitPrice: 46000 }];
  const priced = { ok: true, available: true, availability: 'in-stock', heldFrom: null,
    unit: 'sheet', packUnit: 'bundle', packQty: 12, tiers: ladder };

  const one = renderItem(it, priced, 1);
  t.check(/How many sheets/.test(words(one.html)),
    `the count label is plural at one too (${(words(one.html).match(/How many \w+/) || [])[0]})`);
  t.check(/UGX 51,000/.test(words(one.html)), 'one sheet totals the qty-1 rung');
  t.check(/From 12 it is 48,500 a sheet/.test(words(one.html)),
    'and the next breakpoint is offered before it is reached');
  t.check(/In stock/.test(words(one.html)), 'availability IS said here — this is the deciding screen');

  const many140 = renderItem(it, priced, 140);
  t.check(/UGX 6,440,000/.test(words(many140.html)),
    `140 sheets totals at the top rung (${(words(many140.html).match(/UGX [\d,]+/) || [])[0]})`);
  t.check(/11 bundles and 8 loose/.test(words(many140.html)), 'said in bundles');
  t.check(/You are buying by the bundle/.test(words(many140.html)), 'and why the rate changed');
  t.check(!/From \d+ it is/.test(words(many140.html)), 'with nothing offered beyond the last rung');

  t.check(/held from 4 July/.test(words(renderItem(it, { ...priced, heldFrom: '2026-07-04' }, 140).html)),
    'a held price says so on the item screen too');

  /* availabilityOf returns "out" for an item with no live price row,
     because there is nothing to order against -- which rendered as "Out
     of stock just now" directly above "We have no price on file". Two
     different facts, one of them untrue. */
  const unpriced = renderItem(it, { ok: true, available: false, availability: 'out' }, 1);
  t.check(/We have no price on file/.test(words(unpriced.html)), 'an unpriced item says so');
  t.check(!/Out of stock just now/.test(words(unpriced.html)),
    'and is NOT also called out of stock, which is a different fact and not this one');
  t.check(!/How many/.test(words(unpriced.html)),
    'and is not offered a quantity stepper that could not price anything');
  /* Nor an Add button. A line the shop cannot price is a line it cannot
     fill, and a basket carrying one is a conversation at the counter. */
  t.check(!unpriced.addShown, 'nor an Add button that would send an unfillable line');
  t.check(unpriced.foot === '', 'and no promise under a button that is not there');

  /* The one action on the screen. It says the quantity it is going to
     add, because a button that says only "Add" leaves the customer
     checking the stepper again to find out what they just did. */
  t.check(one.addShown, 'a priced item offers the Add button');
  t.check(one.add === 'Add 1 sheet to the order', `naming what it will add (${one.add})`);
  t.check(renderItem(it, priced, 140).add === 'Add 140 sheets to the order',
    `in the plural where there is more than one (${renderItem(it, priced, 140).add})`);
  t.check(/Nothing is charged and nothing is booked/.test(one.foot),
    'under a line saying that tapping it commits nothing');
  t.check(!/Ordering is not open/.test(one.html + one.foot),
    'and the old apology for a missing button is gone');

  const noPack = renderItem({ ...it, unit: 'kg', packUnit: '', packQty: 0 },
    { ...priced, unit: 'kg', packUnit: '', packQty: 0, tiers: [{ minQty: 1, unitPrice: 9200 }] }, 30);
  t.check(/How many kg\b/.test(words(noPack.html)),
    `an abbreviation stays put on the label (${(words(noPack.html).match(/How many \w+/) || [])[0]})`);
  t.check(!/loose|bundle/.test(words(noPack.html)),
    'and an item with no pack says nothing about packs');
}

/* ---------- 9. the prices do not outlive the session ----------------- */
/*
 * The catalogue carries THIS customer's own prices. A handset at a
 * building site is a shared handset.
 */
{
  t.check(/let stock = null;/.test(src), 'the catalogue is held in a variable');
  t.check(!/store\([^)]*stock|localStorage[^\n]*(stock|catalogue|price)/i.test(src),
    'never in storage, where it would outlive the tab');
  const out = src.slice(src.indexOf("document.getElementById('signOut').onclick"));
  t.check(/stock = null;/.test(out.slice(0, out.indexOf('};'))),
    'and signing out takes it with them');
}

process.exit(t.done() ? 1 : 0);
