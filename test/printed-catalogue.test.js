#!/usr/bin/env node
'use strict';
/*
 * The printed catalogue.
 *
 * A customer-facing document built from the shop's own data: category
 * spreads with photos, then a trade price list, retail prices with the
 * volume breaks printed.
 *
 * THE TRAP THIS FILE EXISTS FOR. A price row's `tiers` are the
 * SUPPLIER'S ladder -- what the shop PAYS at each quantity. The obvious
 * way to print volume breaks is to print those, and doing so would hand
 * every customer holding the catalogue the shop's buy price. Cement
 * bought at 29,000 a bag over fifty must appear as 36,250, not 29,000.
 *
 * Every rung goes through the markup rule before it is printed, and the
 * last check in this file reads the whole generated document and asserts
 * no supplier price appears anywhere in it.
 *
 * Run: node test/printed-catalogue.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('printed catalogue');
const src = read('index.html');
const code = src.split(/\r?\n/).map((l) => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');

const data = { products: [], prices: [], suppliers: [], presetCategories: [] };
const NAMES = ['catalogueRetailAtQty', 'catalogueBreaks', 'catalogueLine', 'catalogueSections',
  'rankedPurchaseRowsAtQty', 'rankedPriceRows', 'purchasePriceAtQty', 'tieredUnitPrice',
  'tiersForKind', 'suggestedSellingPrice', 'effectiveMarkupRule', 'productPriceRows',
  'productUnitLabel'];
let scope = null; let err = null;
try {
  scope = compileScope(NAMES.map((n) => extractFunction(src, n, 'index.html')), {
    data,
    resolveProductImage: (p) => (p && p.image) || null,
    variantLabel: (c) => String(c || ''),
    productVariantLabel: (p) => p.name,
    supplierName: (id) => String(id || ''),
  }, NAMES);
} catch (e) { err = e; }
t.check(!!scope, `the catalogue helpers compile${err ? ` (${err.message})` : ''}`);

const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);
const handler = (/p_catalogue_btn'\)\.addEventListener[\s\S]*?\n\}\);/.exec(code) || [''])[0];

const product = (id, name, over) => Object.assign({
  id, name, category: 'Cement', subcategory: '', variants: [],
  retailMarkupType: 'percent', retailMarkupValue: 25,
  wholesaleMarkupType: 'percent', wholesaleMarkupValue: 15, image: null,
}, over || {});
const price = (id, productId, tiers, over) => Object.assign({
  id, productId, variantIdx: null, supplierId: 'S001', unit: 'Bag',
  packQty: 50, packUnit: 'Pallet', outOfStock: false, date: '2026-08-01',
  wholesale: tiers[tiers.length - 1].price, retail: tiers[0].price, tiers,
}, over || {});
const row = (p) => ({ p, v: null, idx: null, kind: 'simple' });

/* ---------- 1. the supplier's ladder is not the customer's ----------- */
if (scope) {
  data.products = [product('P001', 'Cement (Tororo 50kg)')];
  data.prices = [price(1, 'P001', [{ minQty: 1, price: 31000 }, { minQty: 50, price: 29000 }])];

  const at1 = scope.catalogueRetailAtQty(data.products[0], null, 1);
  eq(Math.round(at1.price), 38750, 'one bag prints at the shop price plus its markup');
  const at50 = scope.catalogueRetailAtQty(data.products[0], null, 50);
  eq(Math.round(at50.price), 36250, 'and fifty bags at the DISCOUNTED cost plus the same markup');
  /* THE WHOLE POINT: 29,000 is what the shop pays at fifty. It must never
     be what the catalogue prints. */
  t.check(Math.round(at50.price) !== 29000,
    'never at 29,000, which is the shop\'s own cost and nobody else\'s business');

  const breaks = scope.catalogueBreaks(data.products[0], null);
  eq(breaks.length, 1, 'the ladder yields one printable break');
  eq(breaks[0].qty, 50, 'at the quantity the supplier drops');
  eq(Math.round(breaks[0].price), 36250, 'priced for the customer, not for the shop');
}

/* ---------- 2. a rung that moves nothing is not a break -------------- */
if (scope) {
  data.products = [product('P002', 'Steel Nails 3 inch')];
  // A ladder whose later rung is the SAME price: nothing to advertise.
  data.prices = [price(2, 'P002', [{ minQty: 1, price: 9500 }, { minQty: 25, price: 9500 }])];
  eq(scope.catalogueBreaks(data.products[0], null).length, 0,
    'a rung at the same price is not a volume break and is not printed');

  // And one that gets DEARER with quantity is certainly not a break.
  data.prices = [price(3, 'P002', [{ minQty: 1, price: 9500 }, { minQty: 25, price: 11000 }])];
  eq(scope.catalogueBreaks(data.products[0], null).length, 0,
    'nor is one that costs more, which would advertise a penalty for buying more');

  data.prices = [price(4, 'P002', [{ minQty: 1, price: 9500 }])];
  eq(scope.catalogueBreaks(data.products[0], null).length, 0, 'and a flat price has no ladder at all');

  /* Rungs stored OUT OF ORDER. Nothing guarantees a price row lists its
     tiers ascending, and walking them as stored compares each rung to
     whichever happened to precede it -- so a genuine break gets dropped
     for being dearer than a rung further down the ladder. */
  data.prices = [price(5, 'P002', [
    { minQty: 100, price: 8000 }, { minQty: 1, price: 9500 }, { minQty: 25, price: 8800 },
  ])];
  const walked = scope.catalogueBreaks(data.products[0], null);
  eq(walked.map((b2) => b2.qty).join(','), '25,100',
    'the ladder is walked smallest first however the tiers were stored');
  eq(Math.round(walked[0].price), 11000, 'so each rung is compared with the one before it');
  eq(Math.round(walked[1].price), 10000, 'and every real drop survives');
}

/* ---------- 3. the cheapest supplier sets the shelf price ------------ */
if (scope) {
  data.products = [product('P003', 'Iron Sheets')];
  data.prices = [
    price(5, 'P003', [{ minQty: 1, price: 45000 }], { supplierId: 'S001' }),
    price(6, 'P003', [{ minQty: 1, price: 42000 }], { supplierId: 'S002' }),
  ];
  eq(Math.round(scope.catalogueRetailAtQty(data.products[0], null, 1).price), 52500,
    'the catalogue prices off the cheapest supplier, the same one the buying list would use');
}

/* ---------- 4. what cannot be printed, and why ----------------------- *
 * suggestedSellingPrice returns null with no markup rule -- it does NOT
 * fall back to cost. So a priced product can still be uncataloguable,
 * and the two reasons need different fixing.
 */
if (scope) {
  data.products = [
    product('P010', 'Priced and ruled'),
    product('P011', 'Priced, no rule', { retailMarkupType: null, retailMarkupValue: null }),
    product('P012', 'No price at all'),
  ];
  data.prices = [
    price(10, 'P010', [{ minQty: 1, price: 1000 }]),
    price(11, 'P011', [{ minQty: 1, price: 1000 }]),
  ];
  const out = scope.catalogueSections(data.products.map(row));
  eq(out.printable.length, 1, 'only what can actually be priced is printed');
  eq(out.skipped.length, 2, 'and the rest are held back rather than printed at nothing');
  const why = Object.fromEntries(out.skipped.map((s) => [s.name, s.skip]));
  /* Named as the RETAIL rule specifically. A yard selling mostly to
     builders can perfectly well have a wholesale markup set and no
     retail one -- the Products screen shows it as "W +10,000 · R No
     rule" -- and telling that shop it has "no markup rule" contradicts
     what it is looking at. */
  eq(why['Priced, no rule'], 'no retail markup rule (a wholesale rule does not set the catalogue price)',
    'a product with a cost and a WHOLESALE rule is told which rule is actually missing');
  eq(why['No price at all'], 'no supplier price on file',
    'which is a different problem from having no price at all, and says so');
  /* Zero is the one thing a price must never print as: it reads as free. */
  t.check(out.printable.every((l) => l.price > 0), 'and nothing is printed at a price of nothing');

  /* A variable product with no variants built yet is not a sellable
     line at all -- it has no price because there is nothing to price. */
  const unbuilt = scope.catalogueLine(product('P013', 'Variable, empty'), null, 'variable-empty', null);
  eq(unbuilt.skip, 'no variants set up yet',
    'a product whose variants do not exist yet is held back for that reason, not for a missing price');
  eq(unbuilt.price, undefined, 'and carries no price to print');
}

/* ---------- 5. grouped and ordered the way a document is read -------- */
if (scope) {
  data.products = [
    product('P020', 'Zinc Sheets', { category: 'Roofing' }),
    product('P021', 'Aggregate', { category: 'Cement' }),
    product('P022', 'Ridge Cap', { category: 'Roofing' }),
  ];
  data.prices = [10, 11, 12].map((n, i) => price(20 + i, 'P02' + i, [{ minQty: 1, price: 1000 * (i + 1) }]));
  const out = scope.catalogueSections(data.products.map(row));
  eq(out.sections.map((s) => s.name).join(','), 'Cement,Roofing',
    'categories run alphabetically, because a printed document is read in order');
  eq(out.sections[1].items.map((i) => i.name).join(','), 'Ridge Cap,Zinc Sheets',
    'and so do the items inside one');

  data.products = [product('P030', 'Loose item', { category: '' })];
  data.prices = [price(30, 'P030', [{ minQty: 1, price: 500 }])];
  eq(scope.catalogueSections(data.products.map(row)).sections[0].name, 'Uncategorised',
    'a product with no category still gets a home rather than vanishing');
}

/* ---------- 6. the document itself ------------------------------------ */
{
  t.check(/@page\{size:A4/.test(handler), 'it is laid out for A4');
  t.check(/section\{page-break-after:always;break-after:page;\}/.test(handler),
    'each category starts a fresh page, so one never splits across a turn');
  t.check(/\.cat-item\{[^}]*page-break-inside:avoid/.test(handler),
    'and a single item is never broken in half by a page end');
  t.check(/class="trade-page"/.test(handler), 'the trade price list is its own page at the back');
  /* Pinned on the COLUMN, not the words: "Volume price" also appears in
     the footer note, so a loose match passed with the header emptied. */
  t.check(/<th class="r">Volume price<\/th>/.test(handler),
    'carrying the volume column, which is what it is for');
  t.check(/<td class="r tr-break">\$\{breaksInline\(l\) \|\| '—'\}<\/td>/.test(handler),
    'and a dash where an item has no break, rather than an empty cell');

  /* A printed price goes stale in a drawer. Every page carries the date
     it was generated and says so in as many words. */
  t.check(/prices as at \$\{esc\(today\)\}/.test(handler), 'every page is dated');
  t.check(/Prices are subject to change/.test(handler) && /confirm\s*\n?\s*before ordering against this sheet/.test(handler),
    'and says plainly not to quote from an old sheet');

  /* A catalogue narrowed by a filter is a partial catalogue that looks
     like the whole one unless it says otherwise -- the same rule the
     products print already follows. */
  t.check(/This catalogue covers only products/.test(handler), 'a filtered catalogue says what it covers');
  t.check(/could not be priced and\s*\n?\s*\$\{skipped\.length===1\?'is':'are'\} not shown/.test(handler),
    'and one with gaps says how many it left out');
  t.check(/skipped\.slice\(0,60\)/.test(handler), 'naming them, up to a sensible limit');

  // Nothing can be priced -> a refusal that says what to fix, not an
  // empty document.
  /* Pinned on the guard: `if(false)` leaves the sentence sitting in the
     file unreachable while a match on its words goes on passing. */
  t.check(/if\(printable\.length===0\)\{[\s\S]{0,1400}?return;\s*\}/.test(handler),
    'a shop with nothing priceable gets no document at all');
  /* AND IS TOLD WHICH OF THE TWO IS BLOCKING. The first version said
     "a catalogue needs a supplier price and a markup rule" to a shop
     whose every product had both a price and a supplier -- they were
     missing only the retail rule, and the message read as though nothing
     was set up at all. */
  t.check(/const noRule = skipped\.filter\(x=> \/retail markup rule\/\.test\(x\.skip\)\)\.length;/.test(handler)
    && /const noPrice = skipped\.filter\(x=> x\.skip === 'no supplier price on file'\)\.length;/.test(handler),
  'the refusal counts each cause separately rather than guessing');
  t.check(/noRule && !noPrice/.test(handler) && /A wholesale rule does not set the catalogue price/.test(handler),
    'a shop blocked only by missing retail rules is told exactly that');
  t.check(/noPrice && !noRule/.test(handler) && /Add one in the Price book/.test(handler),
    'and one blocked only by missing prices is sent somewhere else');
  t.check(/need a retail markup rule and \$\{line\(noPrice\)\} need a supplier price/.test(handler),
    'with both counted when both are in the way');

  t.check(/productRowsForList\(filter, categoryFilter, supplierFilter, ''\)/.test(handler),
    'it follows the screen\'s own filters');
}

/* ---------- 7. no cost price anywhere in the document ---------------- *
 * The strongest check here. Build a catalogue whose supplier prices are
 * distinctive numbers, render the lines, and assert none of them appears.
 */
if (scope) {
  data.products = [product('P040', 'Cement (Tororo 50kg)')];
  data.prices = [price(40, 'P040', [{ minQty: 1, price: 31337 }, { minQty: 50, price: 29123 }])];
  const line = scope.catalogueSections([row(data.products[0])]).printable[0];
  const printed = [
    String(Math.round(line.price)),
    ...line.breaks.map((b) => String(Math.round(b.qty))),
    ...line.breaks.map((b) => String(Math.round(b.price))),
  ].join(' ');
  t.check(!/31337/.test(printed), 'the shop\'s unit cost never reaches the paper');
  t.check(!/29123/.test(printed), 'nor its volume cost, which is the one a competitor would want');
  t.check(/39171/.test(printed), 'what is printed is that cost plus the markup');
  t.check(/36404/.test(printed), 'at every rung of the ladder');
}

process.exit(t.done() ? 1 : 0);
