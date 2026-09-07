'use strict';
/*
 * ONE READING OF A RULE.
 *
 * A rule used to be read in one place — the customer's picture — and
 * every other counter in the shop knew nothing about it. As the quote
 * rail, the till, a WhatsApp reply, the buying plan and the Manager
 * start reading rules too, each of them re-deriving "which size, how
 * many, is it on the shelf, what does it sell for" would be five
 * answers to one question. pairCompanionsFor and its neighbours are
 * that one answer.
 *
 * Extracted from index.html and run against fixtures: no copy of the
 * logic lives here.
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('pairing consumers');
const src = read('index.html');
const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);

/* ---- the fixture shop ------------------------------------------------
   Runners come in three sizes, soft closes in three; screws and glue
   have one each. Two sizes of soft close are on the shelf, the 14" is
   not, and a plain "Quiet Runner" stands in for the 14" by an
   instead-of rule written the other way round. */
const RUNNERS = { id: 'P-RUN', name: 'Runners', type: 'variable', unit: 'Pair',
  variants: [{ combo: { Size: '10"' } }, { combo: { Size: '12"' } }, { combo: { Size: '14"' } }] };
const SOFT = { id: 'P-SOFT', name: 'Soft Close Mulper', type: 'variable', unit: 'Pair',
  variants: [{ combo: { Length: '12"' } }, { combo: { Length: '14"' } }, { combo: { Length: '18"' } }] };
const SCREWS = { id: 'P-SCR', name: 'Black Screws', type: 'simple', unit: 'Box' };
const QUIET = { id: 'P-QUIET', name: 'Quiet Runner', type: 'simple', unit: 'Pair' };
const GLUE = { id: 'P-GLUE', name: 'Wood Glue', type: 'simple', unit: 'Tin' };
const HINGE = { id: 'P-HINGE', name: 'Hinges', type: 'simple', unit: 'Pc' };

const stock = new Map([
  ['P-SOFT::0', 20], ['P-SOFT::1', 0], ['P-SOFT::2', 5],
  ['P-SCR', 40], ['P-QUIET', 12], ['P-GLUE', 0], ['P-HINGE', 9],
]);
const prices = new Map([
  ['P-SOFT::0', { price: 9500, unit: 'Pair', kind: 'retail' }],
  ['P-SOFT::1', { price: 10000, unit: 'Pair', kind: 'retail' }],
  ['P-SOFT::2', { price: 10500, unit: 'Pair', kind: 'retail' }],
  ['P-SCR', { price: 9000, unit: 'Box', kind: 'retail' }],
  ['P-QUIET', { price: 8800, unit: 'Pair', kind: 'retail' }],
  ['P-HINGE', { price: 2500, unit: 'Pc', kind: 'retail' }],
]);
const key = (id, vi) => (vi == null ? id : `${id}::${vi}`);

const data = {
  products: [RUNNERS, SOFT, SCREWS, QUIET, GLUE, HINGE],
  productLinks: [],
  savedQuotes: [
    { id: 1, invoiced: true, items: [{ productId: 'P-RUN', variantIdx: 1 }, { productId: 'P-SOFT', variantIdx: 0 }] },
    { id: 2, invoiced: true, items: [{ productId: 'P-RUN', variantIdx: 1 }, { productId: 'P-SCR', variantIdx: null }] },
    { id: 3, invoiced: true, items: [{ productId: 'P-RUN', variantIdx: 1 }, { productId: 'P-SCR', variantIdx: null }] },
    { id: 4, invoiced: true, items: [{ productId: 'P-RUN', variantIdx: 2 }, { productId: 'P-SCR', variantIdx: null }] },
    { id: 5, invoiced: true, items: [{ productId: 'P-RUN', variantIdx: 0 }, { productId: 'P-SCR', variantIdx: null }] },
  ],
};
let nextId = 200, saves = 0;
const env = {
  data,
  productLinksTable: true,
  allocRowId: ()=> nextId++,
  saveData: ()=> { saves++; },
  productById: (id)=> data.products.find(p=> p.id === id) || null,
  productVariantLabel: (p, vi)=> (vi == null || !p.variants || !p.variants[vi]) ? p.name
    : `${p.name} — ${Object.values(p.variants[vi].combo).join(' / ')}`,
  variantLabel: (combo)=> Object.values(combo).join(' / '),
  productLinkName: (id)=> (env.productById(id) || {}).name || `${id} — gone from the catalogue`,
  productUnitLabel: (id, vi)=> (env.productById(id) || {}).unit || '',
  briefInStock: (id, vi)=> { const v = stock.get(key(id, vi)); return v === undefined ? null : v; },
  briefPriceFor: (id, vi, qty)=> prices.get(key(id, vi)) || { why: 'noRow' },
  rankedPriceRows: (id, vi)=> prices.has(key(id, vi)) ? [{ productId: id }] : [],
  PAIR_VERBS: [
    { id:'needs', label:'Needs', say:'needs', brief:'ALSO NEED' },
    { id:'with', label:'Goes with', say:'goes with', brief:'ALSO TAKE' },
    { id:'instead', label:'Instead of', say:'instead of', brief:'OR TAKE' },
    { id:'after', label:'Runs out after', say:'runs out after', brief:'', self:true },
    { id:'part', label:'Part of', say:'part of', brief:'FOR THE JOB' },
  ],
};
const NAMES = ['pairVerb', 'productLinksAll', 'pairSizeIdx', 'pairDuplicateOf', 'pairFault', 'addProductLink',
  'pairingsFor', 'pairRuleKey', 'pairRulesOf', 'pairStanding', 'pairEvidence', 'invoicedOrders',
  'briefVariantForLine', 'briefSameSizeAs', 'pairCompanionsFor', 'pairSubstitutesFor', 'pairLastsDays',
  'pairPartsOf', 'pairCooccurrence', 'observedPairs'];
const fns = compileScope([
  extractDeclaration(src, 'PAIR_VERB_ORDER', 'index.html'),
  extractDeclaration(src, 'PAIR_OBSERVED_MIN', 'index.html'),
  extractDeclaration(src, 'PAIR_OBSERVED_SHARE', 'index.html'),
  ...NAMES.map((n)=> extractFunction(src, n, 'index.html')),
], env, NAMES);

const add = (from, verb, to, qty, per, sizes)=> fns.addProductLink(from, verb, to, qty, per, '', sizes).link;

/* ---- 1. a companion, sized and priced -------------------------------- */
{
  add('P-RUN', 'with', 'P-SOFT', 1, 'Pair');
  add('P-RUN', 'needs', 'P-SCR', 8, 'Pair');
  const at12 = fns.pairCompanionsFor('P-RUN', 1, 3);
  eq(at12.length, 2, 'both rules written for runners apply at 12"');
  eq(at12[0].verbId, 'needs', 'what it NEEDS is offered before what it goes with');
  const scr = at12[0], soft = at12[1];
  eq(scr.qty, 24, 'eight screws a pair, on three pairs, is 24');
  eq(scr.unit, 'Box', 'in the unit the price is quoted in');
  eq(scr.price, 9000, 'at the price on file');
  eq(scr.inStock, true, 'and it is on the shelf');
  eq(soft.productId, 'P-SOFT', 'the soft close follows');
  eq(soft.variantIdx, 0, 'at 12", the size that matches the runner');
  eq(soft.by, 'size', 'credited to the match');
  eq(soft.label, 'Soft Close Mulper — 12"', 'and named with its size');
  eq(soft.qty, 3, 'one per pair, on three pairs');
  eq(fns.pairCompanionsFor('P-RUN', 1, 0)[0].qty, null, 'with no quantity to work from, no figure is invented');
  const noRatio = fns.pairCompanionsFor('P-RUN', 1, 3).find(c=> c.productId === 'P-SOFT');
  eq(typeof noRatio.evidence.withFrom, 'number', 'the books are carried with every companion');
}

/* ---- 2. out of stock is named, not dropped --------------------------- */
{
  const at14 = fns.pairCompanionsFor('P-RUN', 2, 2);
  const soft = at14.find(c=> c.productId === 'P-SOFT');
  eq(soft.variantIdx, 1, 'a 14" runner matches the 14" soft close');
  eq(soft.inStock, false, 'which is not on the shelf');
  eq(soft.why, 'outOfStock', 'said as itself rather than dropped');
  eq(soft.substitutes.length, 0, 'and no swap is offered unless one is asked for');
  add('P-QUIET', 'instead', 'P-SOFT', null, '', { toVariantIdx: 1 });
  const withSub = fns.pairCompanionsFor('P-RUN', 2, 2, { substitute: true }).find(c=> c.productId === 'P-SOFT');
  eq(withSub.substitutes.length, 1, 'an instead-of written the other way round still answers this stock-out');
  eq(withSub.substitutes[0].productId, 'P-QUIET', 'naming the thing that can stand in');
  eq(withSub.substitutes[0].reverse, true, 'and saying which way it was written');
}

/* ---- 3. what can stand in --------------------------------------------- */
{
  const subs = fns.pairSubstitutesFor('P-SOFT', 1);
  eq(subs.length, 1, 'the 14" soft close has one substitute');
  eq(subs[0].stock, 12, 'with what is on the shelf');
  eq(subs[0].price, 8800, 'and a price to quote');
  eq(fns.pairSubstitutesFor('P-SOFT', 0).length, 0, 'a swap written for the 14" is not offered for the 12"');
  add('P-GLUE', 'instead', 'P-SCR', null, '');
  eq(fns.pairSubstitutesFor('P-SCR', null).length, 0, 'a swap the shelf has not got is not a swap');
  eq(fns.pairSubstitutesFor('P-HINGE', null).length, 0, 'and a product nothing stands in for has none');
}

/* ---- 4. already on the document -------------------------------------- */
{
  const all = fns.pairCompanionsFor('P-RUN', 1, 3);
  eq(all.length, 2, 'both companions are offered');
  const some = fns.pairCompanionsFor('P-RUN', 1, 3, { exclude: new Set(['P-SCR']) });
  eq(some.length, 1, 'what is already on the document is not offered again');
  eq(some[0].productId, 'P-SOFT', 'leaving the one that is not');
}

/* ---- 5. how long one lasts -------------------------------------------- */
{
  eq(fns.pairLastsDays('P-GLUE'), null, 'nothing is claimed where nothing is written');
  add('P-GLUE', 'after', 'P-GLUE', 26, 'day');
  eq(fns.pairLastsDays('P-GLUE'), 26, 'the figure the owner wrote is the number of days');
  const off = fns.productLinksAll().find(l=> l.verb === 'after');
  off.active = false;
  eq(fns.pairLastsDays('P-GLUE'), null, 'a rule switched off says nothing');
  off.active = true;
}

/* ---- 6. one job, both ways round -------------------------------------- */
{
  add('P-HINGE', 'part', 'P-SCR', null, '');
  eq(fns.pairPartsOf('P-HINGE')[0].productId, 'P-SCR', 'the other half of the job is found from the first');
  eq(fns.pairPartsOf('P-SCR')[0].productId, 'P-HINGE', 'and from the second, because a job is symmetric');
  eq(fns.pairPartsOf('P-RUN').length, 0, 'a product in no job has none');
}

/* ---- 7. one count of what lands together ------------------------------ */
{
  const co = fns.pairCooccurrence(fns.invoicedOrders());
  eq(co.get('P-RUN P-SCR'), 4, 'four orders carried runners and screws');
  eq(co.get('P-SCR P-RUN'), 4, 'counted the same both ways');
  eq(co.get('P-RUN P-SOFT'), 1, 'and one carried runners and a soft close');
  t.check(/const seen = pairCooccurrence\(\);/.test(src), 'and the pairings screen reads that same count');
}

t.check(saves > 0, 'every rule written was saved');
process.exit(t.done() ? 1 : 0);
