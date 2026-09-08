#!/usr/bin/env node
'use strict';
/*
 * The assistant speaks the Price Registry's own language.
 *
 * Reported live, on black screws 8 coarse 1.5 from Haidery: the
 * assistant asked whether the carton really was 180,000, and whether
 * Haidery really pack 16 boxes to a carton -- both of which the Price
 * Registry states plainly on screen. The cause was one thing said two
 * ways. The registry renders a tier through prTierChipLabel, which
 * divides minQty by packQty to name the rung in cartons and multiplies
 * the price by packQty to show the whole-pack figure:
 *
 *     "1 Ctn+: 11,250 (180,000/Ctn)"
 *
 * while the tool handed the model { min_qty: 16, price: 11250 } -- a
 * base-unit rung with no unit, no pack translation and no pack price.
 * The model, forbidden from stating a figure it derived itself, asked.
 * A shop cannot be run by an assistant that makes the owner confirm
 * what is already on their screen.
 *
 * So the law here is parity, proved by running both:
 *
 *   ONE VOCABULARY  the tier sentence the tool emits is character-for-
 *                   character the sentence the registry screen renders.
 *                   Not "similar" -- identical, from the same builder.
 *   PACKING IS FACT  packing and pieces-per-unit travel, on the row and
 *                   at the head of the dossier, and on find_product's
 *                   first hop.
 *   NAMED, NOT COUNTED  an out-of-stock supplier is listed and flagged,
 *                   never collapsed into a number nobody can name --
 *                   and still never called the cheapest.
 *
 * Run: node test/assistant-price-vocabulary.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('the assistant’s price vocabulary');
const src = read('index.html');
const api = read('api/assistant.js');
const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);

/* The reported case, to the figure: a box of screws at 11,250, sixteen
   boxes to a carton, so a carton is 180,000. */
const HAIDERY = { id: 1, productId: 'P1', variantIdx: null, supplierId: 'S1',
  wholesale: 11250, retail: 12000, unit: 'Box', packUnit: 'Ctn', packQty: 16,
  supplierSku: 'BS-8C-15', piecesPerUnit: 100, date: '2026-08-20',
  tiers: [{ minQty: 16, price: 11250 }, { minQty: 160, price: 10800 }] };
const RIVAL = { id: 2, productId: 'P1', variantIdx: null, supplierId: 'S2',
  wholesale: 11000, retail: null, unit: 'Box', packUnit: 'Ctn', packQty: 16, date: '2026-08-22' };
const GONE = { id: 3, productId: 'P1', variantIdx: null, supplierId: 'S3',
  wholesale: 9000, retail: null, unit: 'Box', packUnit: 'Ctn', packQty: 16,
  date: '2026-06-01', outOfStock: true };

const data = {
  products: [{ id: 'P1', name: 'Black Screws 8 coarse 1 1/2', type: 'simple',
    category: 'Fixings', retailMarkupType: 'percent', retailMarkupValue: 20,
    wholesaleMarkupType: 'percent', wholesaleMarkupValue: 10 }],
  prices: [HAIDERY, RIVAL, GONE],
  suppliers: [{ id: 'S1', name: 'Haidery' }, { id: 'S2', name: 'Kampala Steel' }, { id: 'S3', name: 'Old Yard' }],
  stock: { 'P1': 40 },
};

const env = {
  // productPackInfo reads the shelf's own unit now (stockUnitFor).
  cmpUnitKey: (s) => String(s || '').trim().toLowerCase(),
  data,
  /* product_details also reads what the shop wrote down about what
     goes with what. This fixture is about the WORDS a price is said
     in, and its shop has written no rules. */
  pairCompanionsFor: () => [],
  pairSubstitutesFor: () => [],
  pairLastsDays: () => null,
  /* product_details now reads what other shops charge, and that
     reading dates each sighting. */
  todayISO: () => '2026-08-29',
  daysSinceDate: () => 0,
  supplierName: (id) => (data.suppliers.find((s) => s.id === id) || {}).name || '',
  productVariantLabel: (p) => p.name,
  variantLabel: () => '',
  getStockQty: () => 40,
  fmtUGX: (n) => `${Math.round(Number(n) || 0).toLocaleString('en-US')} UGX`,
  esc: (x) => String(x),
  apRound: (n) => Math.round(Number(n) || 0),
  effectiveMarkupRule: (p, vi, kind) => ({ type: 'percent', value: kind === 'retail' ? 20 : 10, source: 'product' }),
  apRuleWords: (kind, r) => (r ? `${r.value}% on cost` : null),
  suggestedSellingPrice: (p, base, kind) => (base == null ? null : Math.round(base * (kind === 'wholesale' ? 1.1 : 1.2))),
  apPriceBasis: (row) => (row && row.wholesale != null
    ? { kind: 'wholesale', cost: row.wholesale } : { kind: 'retail', cost: row && row.retail }),
  searchTokens: (q) => String(q || '').trim().split(/\s+/).filter(Boolean),
  buildProductSuggestionEntries: () => [{ p: data.products[0], variantIdx: null }],
  Math, Number, String, Array, Object, JSON,
};

const scope = compileScope([
  extractDeclaration(src, 'ASSISTANT_TOOLS', 'index.html'),
  extractFunction(src, 'rivalPriceLatest', 'index.html'),
  extractFunction(src, 'rivalPricesFor', 'index.html'),
  extractFunction(src, 'productPriceRows', 'index.html'),
  extractFunction(src, 'rankedPriceRows', 'index.html'),
  extractFunction(src, 'stockUnitFor', 'index.html'),
  extractFunction(src, 'productPackInfo', 'index.html'),
  extractFunction(src, 'prTierChipLabel', 'index.html'),
  extractFunction(src, 'priceTierSummaryPart', 'index.html'),
  extractFunction(src, 'priceTiersSummaryHTML', 'index.html'),
  extractFunction(src, 'priceSummaryLine', 'index.html'),
  'function names(){ return { ASSISTANT_TOOLS, priceTiersSummaryHTML, priceSummaryLine, prTierChipLabel }; }',
], env, ['names']);
const N = scope.names();
const T = N.ASSISTANT_TOOLS;

const dossier = T.product_details.run({ product_id: 'P1' });
const v = dossier.variants[0];
const byName = {};
v.suppliers.forEach((s) => { byName[s.supplier] = s; });
const haidery = byName['Haidery'];

/* ---------- 1. the tier sentence IS the screen's sentence ------------ */
{
  t.check(!!haidery, 'the supplier the owner asked about is in the dossier at all');
  const onScreen = N.priceTiersSummaryHTML(HAIDERY);
  const screenSentence = onScreen.replace(/^[\s\S]*Volume pricing: /, '').replace(/<\/div>$/, '');
  eq(haidery.volume_pricing, screenSentence,
    'the ladder the tool hands the model is the SAME SENTENCE the registry row shows — one vocabulary, not two');
  t.check(/180,000 UGX\/Ctn/.test(haidery.volume_pricing),
    `the carton figure the owner reads is IN the sentence, so it is never asked back (${haidery.volume_pricing})`);

  const rung = haidery.tiers[0];
  eq(rung.label, N.prTierChipLabel(HAIDERY.tiers[0], 'Box', 'Ctn', 16),
    'and each rung carries that same label, built by the screen’s own function');
  eq(rung.min_qty, 16, 'with the base-unit quantity still there for arithmetic');
  eq(rung.min_qty_packs, 1, 'translated into packs, which is how the owner said it');
  eq(rung.price_per_unit, 11250, 'the per-unit price');
  eq(rung.price_per_pack, 180000, 'and the whole-pack price — the exact figure that was asked back as a question');
  t.check(haidery.tiers[1].min_qty_packs === 10 && haidery.tiers[1].price_per_pack === 172800,
    'every rung translated, not just the first');
}

/* ---------- 2. packing is a fact on file, never a question ----------- */
{
  eq(haidery.packing, '16 Box in a Ctn',
    'the packing sentence matches the registry’s Packaging line word for word');
  t.check(N.priceSummaryLine({ pname: 'x', packQty: 16, packUnit: 'Ctn', unit: 'Box' }).includes(haidery.packing),
    'proved against the screen’s own builder, not against a copy of the words');
  eq(haidery.pieces_per_unit, 100, 'pieces in one unit travel too');
  eq(haidery.supplier_sku, 'BS-8C-15', 'and the supplier’s own code for it');
  eq(v.packing, '16 Box in a Ctn',
    'the dossier says the packing at its head as well — present even when only the top is read');

  const hit = T.find_product.run({ query: 'black screws' }).matches[0];
  eq(hit.pack, '16 Box in a Ctn', 'find_product carries packing on the FIRST hop');
  eq(hit.pack_price, 176000, 'with what a whole pack costs at the cheapest price on file');
  const bare = { ...HAIDERY };
  t.check(typeof hit.unit === 'string' && bare.unit === 'Box', 'and still the unit it is sold in');
}

/* ---------- 3. named, not counted, and never called cheapest --------- */
{
  const gone = byName['Old Yard'];
  t.check(!!gone, 'a supplier marked out of stock is NAMED — "does this supplier sell it" is answerable');
  t.check(gone.out_of_stock === true, 'and flagged as out of stock, so the answer is honest about it');
  eq(v.suppliers_out_of_stock, 1, 'the count still travels beside the names');
  eq(v.suppliers[0].supplier, 'Kampala Steel',
    'the cheapest IN-STOCK supplier still leads — a cheaper out-of-stock row never takes that place');
  eq(v.suppliers[v.suppliers.length - 1].supplier, 'Old Yard', 'out-of-stock rows rank last');
  eq(v.cost, 11000, 'and the headline cost is still the cheapest in-stock price');
}

/* ---------- 4. the law is taught, not just enabled ------------------- */
{
  t.check(/Packing and volume prices are ON FILE/.test(api),
    'the prompt states that packing and tiers are on file');
  t.check(/never ask the owner to confirm a pack size or a volume rung the registry already holds/.test(api),
    'and forbids asking for what the registry already holds, in as many words');
  t.check(/never to a figure already in the registry/.test(api),
    'scoping ask-don’t-guess to documents and to items with nothing on file');
  t.check(/never called the cheapest/.test(api),
    'while an out-of-stock supplier stays answerable but unrecommended');
  t.check(/read these instead of asking the owner about packing or a carton price/.test(api),
    'and the tool’s own description says what it carries');
}

process.exit(t.done() ? 1 : 0);
