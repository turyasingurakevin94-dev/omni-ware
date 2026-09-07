'use strict';
/*
 * The customer brief measures a derived price against what the customer
 * last paid, and leaves a line off where the two are wildly apart. Two
 * ways that went wrong, both on one real row:
 *
 *   Runners — Ordinary / 12"  priced 3,400 a Pair, 25 to the Ctn.
 *
 * 1. A customer who took 3 Ctn at 85,000 was recorded as paying 85,000,
 *    and the brief compared that with 3,400 — "a price on file far
 *    below what they last paid", pointing the owner at a row that was
 *    right. The receipt has to be read in the row's unit first.
 *
 * 2. Where the line really does say Pair and 85,000, the figure is the
 *    CARTON price to the shilling. That is not the registry's fault
 *    either, and the owner is now told which order to open.
 *
 * And the pairing side: "Soft Close" comes in sizes, the customer had
 * never bought one, and the picture said "nothing on the pairing says
 * which size" while offering no way to say it. A pairing can now name a
 * size, and where it does not, the size matching the one they buy the
 * first product in is taken.
 *
 * Everything is extracted from index.html and run against fixtures; no
 * copy of the logic lives here.
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('brief receipt units');
const src = read('index.html');

const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);
const near = (got, want, msg) => t.check(Math.abs(got - want) < 1e-6, `${msg} (got ${got}, want ${want})`);

/* ---- the fixture shop ------------------------------------------------ */
const RUNNERS = { id: 'P-RUN', name: 'Runners — Ordinary', type: 'variable', unit: 'Pair',
  variants: [{ combo: { Size: '10"' } }, { combo: { Size: '12"' } }, { combo: { Size: '14"' } }] };
const SOFT = { id: 'P-SOFT', name: 'Soft Close Mulper', type: 'variable', unit: 'Pair',
  variants: [{ combo: { Length: '12"' } }, { combo: { Length: '14"' } }, { combo: { Length: '16"' } }] };
const PAINT = { id: 'P-PAINT', name: 'Paint', type: 'variable',
  variants: [{ combo: { Colour: 'White', Size: '4L' } }, { combo: { Colour: 'White', Size: '20L' } }] };
const CEMENT = { id: 'P-CEM', name: 'Cement', type: 'simple', unit: 'Bag' };
const LOOSE = { id: 'P-LOOSE', name: 'Wire', type: 'simple', unit: 'Kg' };

const data = {
  products: [RUNNERS, SOFT, PAINT, CEMENT, LOOSE],
  prices: [
    { productId: 'P-RUN', variantIdx: 1, supplierId: 'S1', unit: 'Pair', packUnit: 'Ctn', packQty: 25, wholesale: 3200, retail: 3400 },
    { productId: 'P-SOFT', variantIdx: 0, supplierId: 'S1', unit: 'Pair', wholesale: 9000, retail: 9500 },
    { productId: 'P-SOFT', variantIdx: 1, supplierId: 'S1', unit: 'Pair', wholesale: 9500, retail: 10000 },
    { productId: 'P-SOFT', variantIdx: 2, supplierId: 'S1', unit: 'Pair', wholesale: 10000, retail: 10500 },
    { productId: 'P-PAINT', variantIdx: 0, supplierId: 'S1', unit: 'Tin', wholesale: 30000, retail: 32000 },
    { productId: 'P-PAINT', variantIdx: 1, supplierId: 'S1', unit: 'Tin', wholesale: 120000, retail: 125000 },
    { productId: 'P-CEM', variantIdx: null, supplierId: 'S1', unit: 'Bag', wholesale: 30000, retail: 32000 },
    { productId: 'P-LOOSE', variantIdx: null, supplierId: 'S1', unit: '', packUnit: 'Roll', packQty: 50, wholesale: 4000, retail: 4500 },
  ],
  productLinks: [],
  savedQuotes: [],
};
let saved = 0;
const env = {
  data,
  cmpUnitKey: (s)=> String(s || '').trim().toLowerCase(),
  productById: (id)=> data.products.find(p=> p.id === id) || null,
  productPriceRows: (productId, variantIdx=null)=> data.prices.filter(p=> p.productId === productId
    && (p.variantIdx == null ? null : p.variantIdx) === variantIdx),
  rankedPriceRows: (productId, variantIdx=null)=> env.productPriceRows(productId, variantIdx).filter(r=> !r.outOfStock),
  briefInStock: ()=> null,
  quoteItemSellPrice: (it)=> Number(it.sellPrice) || 0,
  productVariantLabel: (p, vi)=> (vi == null || !p.variants || !p.variants[vi]) ? p.name
    : `${p.name} — ${Object.values(p.variants[vi].combo).join(' / ')}`,
  variantLabel: (combo)=> Object.values(combo).join(' / '),
  productLinkName: (id)=> (env.productById(id) || {}).name || `${id} — gone from the catalogue`,
  productLinksAll: ()=> data.productLinks,
  pairVerb: (id)=> ['needs','with','instead','after','part'].includes(id) ? { id } : null,
  saveData: ()=> { saved++; },
  customerOrdersFor: ()=> data.savedQuotes,
  todayISO: ()=> '2026-09-06',
  daysBetweenISO: (a, b)=> Math.round((Date.parse(b) - Date.parse(a)) / 86400000),
};
const NAMES = ['habitLineOnRowUnit', 'customerProductHabits', 'briefVariantForLine', 'briefSameSizeAs',
  'briefPaidFigure', 'updateProductLink', 'productLinkLabel', 'pairSizeIdx', 'pairFault',
  'pairDuplicateOf', 'pairSideLabel'];
const fns = compileScope([
  extractDeclaration(src, 'TELL_MIN_ORDERS', 'index.html'),
  extractDeclaration(src, 'TELL_PRICE_FALL_CEILING_PCT', 'index.html'),
  extractDeclaration(src, 'BRIEF_PACK_FIGURE_PCT', 'index.html'),
  ...NAMES.map((n)=> extractFunction(src, n, 'index.html')),
], env, NAMES);

/* ---- 1. a receipt is read in the row's unit -------------------------- */
{
  const ctn = fns.habitLineOnRowUnit({ productId: 'P-RUN', variantIdx: 1, unit: 'Ctn', qty: 3, sellPrice: 85000 });
  eq(ctn.converted, true, 'a line sold by the Ctn is converted onto the row');
  near(ctn.qty, 75, '3 Ctn of 25 is 75 Pair');
  near(ctn.price, 3400, '85,000 a Ctn is 3,400 a Pair');
  eq(ctn.unit, 'Pair', 'and the unit it is now in is the row\'s');
  eq(ctn.unitKnown, true, 'a converted line knows its unit');

  const ctnCase = fns.habitLineOnRowUnit({ productId: 'P-RUN', variantIdx: 1, unit: 'ctn', qty: 1, sellPrice: 80000 });
  eq(ctnCase.converted, true, 'the shop\'s casing of the pack unit does not matter');
  near(ctnCase.price, 3200, '80,000 a ctn is 3,200 a Pair');

  const own = fns.habitLineOnRowUnit({ productId: 'P-RUN', variantIdx: 1, unit: 'Ctn', packUnit: 'Ctn', packQty: 20, qty: 2, sellPrice: 60000 });
  near(own.qty, 40, 'a line still carrying its own pack count is converted by THAT count');
  near(own.price, 3000, 'and priced by it');

  const pair = fns.habitLineOnRowUnit({ productId: 'P-RUN', variantIdx: 1, unit: 'Pair', qty: 3, sellPrice: 85000 });
  eq(pair.converted, false, 'a line already in the row\'s unit is left as written');
  near(pair.price, 85000, 'including its figure, however odd');
  eq(pair.unitKnown, true, 'and it knows its unit');

  const blank = fns.habitLineOnRowUnit({ productId: 'P-RUN', variantIdx: 1, unit: '', qty: 3, sellPrice: 85000 });
  eq(blank.unitKnown, false, 'a blank unit on a packed product with a named base unit cannot be settled');
  eq(blank.converted, false, 'and is not guessed at');

  const nameless = fns.habitLineOnRowUnit({ productId: 'P-LOOSE', variantIdx: null, unit: '', qty: 3, sellPrice: 4500 });
  eq(nameless.unitKnown, true, 'a blank unit against a row whose own unit is blank is one nameless unit, not a mystery');

  const simple = fns.habitLineOnRowUnit({ productId: 'P-CEM', variantIdx: null, unit: 'Bag', qty: 10, sellPrice: 32000 });
  eq(simple.converted, false, 'a product with no pack has nothing to convert');
  eq(simple.unitKnown, true, 'and its unit is its unit');

  const unknown = fns.habitLineOnRowUnit({ productId: 'P-NOPE', variantIdx: null, unit: 'Box', qty: 1, sellPrice: 100 });
  eq(unknown.converted, false, 'a line for a product with no rows is left alone');
}

/* ---- 2. the habit carries the converted figure, or none -------------- */
{
  data.savedQuotes = [
    { id: 104, invoiced: true, invoicedAt: '2026-08-30', items: [
      { productId: 'P-RUN', variantIdx: 1, unit: 'Ctn', qty: 3, sellPrice: 85000 }] },
    { id: 105, invoiced: true, invoicedAt: '2026-09-01', items: [
      { productId: 'P-RUN', variantIdx: 1, unit: 'Ctn', qty: 3, sellPrice: 85000 }] },
    { id: 106, invoiced: true, invoicedAt: '2026-09-03', items: [
      { productId: 'P-RUN', variantIdx: 1, unit: 'Ctn', qty: 3, sellPrice: 85000 },
      { productId: 'P-CEM', variantIdx: null, unit: '', qty: 10, sellPrice: 32000 }] },
  ];
  const habits = fns.customerProductHabits('C1');
  const run = habits.find(h=> h.productId === 'P-RUN');
  near(run.typicalQty, 75, 'the habit is 75 Pair, not 3 of something');
  near(run.lastPrice, 3400, 'and they last paid 3,400 a Pair');
  eq(run.unit, 'Pair', 'in the row\'s unit');
  eq(run.lastOrder && run.lastOrder.id, 106, 'the order the receipt came off is carried');
  eq(run.everyDays, 2, 'the rhythm is untouched by the conversion');

  data.savedQuotes = [{ id: 107, invoiced: true, invoicedAt: '2026-09-03', items: [
    { productId: 'P-RUN', variantIdx: 1, unit: '', qty: 3, sellPrice: 85000 }] }];
  const blank = fns.customerProductHabits('C1')[0];
  eq(blank.lastPrice, null, 'a receipt whose unit cannot be settled is no figure to measure against');
  eq(blank.unitKnown, false, 'and says so');
  near(blank.typicalQty, 3, 'while the quantity stays as written');
}

/* ---- 3. what a figure far under the receipt means -------------------- */
{
  const px = { price: 3400, packQty: 25, packUnit: 'Ctn', unit: 'Pair' };
  const habit = { unit: 'Pair', lastOrder: { id: 104 } };
  eq(fns.briefPaidFigure(px, 3400, habit), null, 'the same figure is no finding');
  eq(fns.briefPaidFigure(px, 4000, habit), null, 'a fall inside the ceiling is news, not a fault');
  const pack = fns.briefPaidFigure(px, 85000, habit);
  eq(pack && pack.why, 'packFigure', '85,000 against 3,400 at 25 a Ctn is the CARTON price on the line');
  eq(pack && pack.packQty, 25, 'with the pack that explains it');
  eq(pack && pack.packUnit, 'Ctn', 'and its name');
  eq(pack && pack.unit, 'Pair', 'and the unit the line counted in');
  eq(pack && pack.order && pack.order.id, 104, 'and the order to open');
  const moved = fns.briefPaidFigure(px, 80000, habit);
  eq(moved && moved.why, 'packFigure', 'a carton that has since moved a little in price is still the carton price');
  const digit = fns.briefPaidFigure(px, 34000, habit);
  eq(digit && digit.why, 'checkRow', 'a figure short a digit is still the row\'s to answer for');
  const loose = fns.briefPaidFigure({ price: 3400, packQty: 0, unit: 'Pair' }, 85000, habit);
  eq(loose && loose.why, 'checkRow', 'with no pack there is nothing else it could be');
  eq(fns.briefPaidFigure(px, 0, habit), null, 'no receipt, nothing to compare');
  eq(fns.briefPaidFigure({ why: 'noRow' }, 85000, habit), null, 'no price, nothing to compare');
}

/* ---- 4. which size a pairing means ----------------------------------- */
{
  const from12 = { from: { productId: 'P-RUN', variantIdx: 1 } };
  const r = fns.briefVariantForLine('P-SOFT', [], from12);
  eq(r.variantIdx, 0, 'a 12" runner pairs with the 12" soft close');
  eq(r.by, 'size', 'because the sizes match');

  const none = fns.briefVariantForLine('P-SOFT', [], { from: { productId: 'P-RUN', variantIdx: 0 } });
  eq(none.why, 'pickVariant', 'a 10" runner matches no soft close, and nothing is guessed');
  eq(none.choices, 3, 'with the number of sizes it would have had to guess between');

  const bare = fns.briefVariantForLine('P-SOFT', []);
  eq(bare.why, 'pickVariant', 'a site stage names no companion size and still gets no guess');

  const named = fns.briefVariantForLine('P-SOFT', [], { toVariantIdx: 2, from: from12.from });
  eq(named.variantIdx, 2, 'the size written on the pairing beats the match');
  eq(named.by, 'pairing', 'and is credited to it');

  const habit = fns.briefVariantForLine('P-SOFT', [{ productId: 'P-SOFT', variantIdx: 1 }], from12);
  eq(habit.variantIdx, 1, 'the size they already buy beats the match too');
  eq(habit.by, 'habit', 'and is credited to them');

  const stale = fns.briefVariantForLine('P-SOFT', [], { toVariantIdx: 9, from: from12.from });
  eq(stale.variantIdx, 0, 'a size the product no longer has falls through to the rest');

  const two = fns.briefVariantForLine('P-PAINT', [], { from: { productId: 'P-PAINT-X', variantIdx: 0 } });
  eq(two.why, 'pickVariant', 'a product on the other end with no sizes settles nothing');

  data.products.push({ id: 'P-PAINT-X', name: 'Thinner', type: 'variable', variants: [{ combo: { Colour: 'White' } }] });
  const both = fns.briefVariantForLine('P-PAINT', [], { from: { productId: 'P-PAINT-X', variantIdx: 0 } });
  eq(both.why, 'pickVariant', 'a value both sizes carry (White 4L, White 20L) is still a choice');

  data.products.push({ id: 'P-CAP', name: 'Cap', type: 'variable', variants: [{ combo: { Size: '4L' } }, { combo: { Size: 'Big' } }] });
  const sized = fns.briefVariantForLine('P-PAINT', [], { from: { productId: 'P-CAP', variantIdx: 0 } });
  eq(sized.variantIdx, 0, 'and a value only one size carries settles it');

  eq(fns.briefSameSizeAs({ productId: 'P-RUN', variantIdx: 1 }, SOFT.variants, [0, 1, 2]), 0,
    'the match reads across attribute names: Size on one product, Length on the other');
  eq(fns.briefSameSizeAs({ productId: 'P-RUN', variantIdx: 1 }, SOFT.variants, [1, 2]), null,
    'but never a size the shop cannot price or has not got');
  eq(fns.briefSameSizeAs(null, SOFT.variants, [0, 1, 2]), null, 'and nothing at all with no other end');
}

/* ---- 5. the pairing carries the size, and drops it with the product -- */
{
  data.productLinks = [{ id: 1, fromId: 'P-RUN', verb: 'with', toId: 'P-SOFT', qty: 1, per: '', note: '', active: true }];
  eq(fns.productLinkLabel(data.productLinks[0]), 'Soft Close Mulper', 'a pairing with no size names the product');
  eq(fns.updateProductLink(1, { toVariantIdx: 2 }).ok, true, 'a size can be chosen');
  eq(data.productLinks[0].toVariantIdx, 2, 'and is kept as a number');
  eq(fns.productLinkLabel(data.productLinks[0]), 'Soft Close Mulper — 16"', 'and read back with the product');
  fns.updateProductLink(1, { toVariantIdx: '' });
  eq(data.productLinks[0].toVariantIdx, null, 'the blank entry is "the size that follows"');
  fns.updateProductLink(1, { toVariantIdx: '1' });
  eq(data.productLinks[0].toVariantIdx, 1, 'a select\'s string value is a number on the row');
  fns.updateProductLink(1, { toId: 'P-CEM' });
  eq(data.productLinks[0].toVariantIdx, null, 'a new second product starts with no size: size 2 of the old is nobody\'s size of the new');
  eq(fns.productLinkLabel(data.productLinks[0]), 'Cement', 'and reads as the plain product');
  t.check(saved >= 4, 'every change is saved');
}

/* ---- 6. the words the owner reads ----------------------------------- */
{
  const leftOff = extractDeclaration(src, 'BRIEF_LEFT_OFF', 'index.html');
  t.check(/packFigure:\s*\{/.test(leftOff), 'the pack-figure cause has its own words');
  t.check(/Price Registry is not what is wrong/.test(leftOff), 'and they say the registry is not the fault');
  t.check(/pickVariant:[^}]*choose the size/.test(leftOff), 'the size words point at a chooser that now exists');
  t.check(/pickVariant:[^}]*name the sizes alike/.test(leftOff), 'and say how the match is earned');
  t.check(/data-cell="\$\{ref\}:/.test(src), 'the pairing editor carries a size grid');
  t.check(/pairSetCell\(rule, c\.i, c\.j, on\)/.test(src), 'and a square of it writes the size pair');
  t.check(/linkSizeColumn \? \{ to_variant_idx:/.test(src), 'the column is written only where it exists');
  t.check(/toVariantIdx: r\.to_variant_idx==null \? null : Number\(r\.to_variant_idx\)/.test(src), 'and read back as a number');
  t.check(/sb\.from\('product_links'\)\.select\('to_variant_idx, from_variant_idx'\)\.limit\(1\)/.test(src), 'after a probe for it');
  t.check(read('supabase/migrations/0093_product_link_size.sql').includes('add column if not exists to_variant_idx integer'),
    'the migration adds exactly that column, idempotently');
}

process.exit(t.done() ? 1 : 0);
