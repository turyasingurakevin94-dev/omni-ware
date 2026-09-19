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
  ['P-SOFT::0', 20], ['P-SOFT::1', 0], ['P-SOFT::2', 0],
  ['P-SCR', 40], ['P-QUIET', 12], ['P-GLUE', 0], ['P-HINGE', 9],
]);
/* THE SHELF AND THE SUPPLIER ARE TWO FACTS. The 14" soft close is one
   NOBODY can supply -- every registry row is marked out of stock, so
   there is no live row and no price. The 18" is simply not on our own
   shelf: the supplier still has it and it is ordered in. */
const supplierOut = new Set(['P-SOFT::1']);
const prices = new Map([
  ['P-SOFT::0', { price: 9500, unit: 'Pair', kind: 'retail' }],
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
  briefPriceFor: (id, vi, qty)=> supplierOut.has(key(id, vi)) ? { why: 'outOfStock' }
    : (prices.get(key(id, vi)) || { why: 'noRow' }),
  rankedPriceRows: (id, vi)=> (prices.has(key(id, vi)) && !supplierOut.has(key(id, vi)))
    ? [{ productId: id, supplierId: 'S1' }] : [],
  supplierLeadDays: ()=> 3,
};
const NAMES = ['pairVerb', 'pairReversed', 'briefPriceRows', 'productLinksAll', 'pairSizeIdx', 'pairDuplicateOf', 'pairFault', 'addProductLink',
  'pairingsFor', 'pairRuleKey', 'pairRulesOf', 'pairStanding', 'pairEvidence', 'invoicedOrders',
  'briefVariantForLine', 'briefSameSizeAs', 'briefSupply', 'briefSupplyWords', 'pairCompanionsFor', 'pairSubstitutesFor', 'pairSwapFault', 'pairLastsDays',
  'pairPartsOf', 'pairCooccurrence', 'observedPairs'];
const fns = compileScope([
  extractDeclaration(src, 'PAIR_VERBS', 'index.html'),
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

/* ---- 2. the shelf and the supplier are two different facts ----------- */
{
  /* NOT ON OUR SHELF, AND ORDERED IN. This shop buys to order, so a
     thing we hold none of is still a thing we can sell -- offered, and
     marked as one to order rather than struck off. */
  const at18 = fns.pairCompanionsFor('P-RUN', 2, 2, { habits: [{ productId: 'P-SOFT', variantIdx: 2 }] })
    .find(c=> c.productId === 'P-SOFT');
  eq(at18.variantIdx, 2, 'the size they buy');
  eq(at18.available, true, 'is still offered');
  eq(at18.onShelf, false, 'though we are holding none');
  eq(at18.how, 'order', 'because the supplier can still send it');
  eq(at18.why, null, 'so nothing is left off');
  t.check(/day/.test(at18.supply), 'and the wait is said where the books know it');

  /* NOBODY CAN SUPPLY IT. Every row is marked out of stock in the
     registry, which is a different sentence altogether. */
  const at14 = fns.pairCompanionsFor('P-RUN', 2, 2);
  const soft = at14.find(c=> c.productId === 'P-SOFT');
  eq(soft.variantIdx, 1, 'a 14" runner matches the 14" soft close');
  eq(soft.available, false, 'which nobody can supply');
  eq(soft.why, 'outOfStock', 'said as itself rather than dropped');
  eq(soft.substitutes.length, 0, 'and no swap is offered unless one is asked for');
  add('P-QUIET', 'instead', 'P-SOFT', null, '', { toVariantIdx: 1 });
  const withSub = fns.pairCompanionsFor('P-RUN', 2, 2, { substitute: true }).find(c=> c.productId === 'P-SOFT');
  eq(withSub.substitutes.length, 1, 'an instead-of written the other way round still answers this stock-out');
  eq(withSub.substitutes[0].productId, 'P-QUIET', 'naming the thing that can stand in');
  eq(withSub.substitutes[0].usable, true, 'and one the shop can actually give');
}

/* ---- 3. what can stand in --------------------------------------------- */
{
  const subs = fns.pairSubstitutesFor('P-SOFT', 1);
  eq(subs.length, 1, 'the 14" soft close has one substitute');
  eq(subs[0].usable, true, 'which the shop can actually give');
  eq(subs[0].stock, 12, 'with what is on the shelf');
  eq(subs[0].how, 'shelf', 'and it can go out today');
  eq(subs[0].price, 8800, 'and a price to quote');
  eq(fns.pairSubstitutesFor('P-SOFT', 0).length, 0, 'a swap written for the 14" is not offered for the 12"');
  /* A SWAP IS TRUE FROM BOTH ENDS. "Quiet Runner instead of the 14"
     soft close" answers the soft close being out, and the soft close
     answers the Quiet Runner being out. */
  const back = fns.pairSubstitutesFor('P-QUIET', null);
  eq(back.length, 1, 'the swap reads from the other end as well');
  eq(back[0].productId, 'P-SOFT', 'naming what it was written against');
  /* Written down, unusable, and SAID so rather than dropped: the owner
     needs to know which of the three things to put right. */
  add('P-GLUE', 'instead', 'P-SCR', null, '');
  /* Wood glue is not on our shelf, but nothing says the supplier is
     out of it -- so it IS a swap, ordered in. */
  const glue = fns.pairSubstitutesFor('P-SCR', null);
  eq(glue.length, 1, 'a swap we hold none of is still a swap');
  eq(glue[0].usable, false, 'unless nothing can price it');
  t.check(/no price on file/.test(fns.pairSwapFault(glue[0])), 'and the reason says which');
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

/* ---- 8. the verb is the heading, in the picture ---------------------- */
{
  /* briefGroups is compiled with its own scope: the fixture above is a
     shop of rules, and what matters here is which heading each row
     lands under and that nothing is offered twice. */
  const gEnv = Object.assign({}, env, {
    customerSiteStage: ()=> ({ fresh: false, stage: { buys: [] } }),
    briefPriceFor: env.briefPriceFor,
    briefPackText: ()=> 'Sold loose',
    productPriceRows: (id, vi)=> env.rankedPriceRows(id, vi),
    shelfValueForKey: ()=> ({ ownedQty: 0, unitCost: null }),
    stockKey: (id, vi)=> (vi == null ? id : `${id}::${vi}`),
    TELL_PRICE_MEMORY_DAYS: 90, TELL_PRICE_DROP_PCT: 5, TELL_PRICE_FALL_CEILING_PCT: 40,
    BRIEF_PACK_FIGURE_PCT: 15, BRIEF_ROWS_PER_GROUP: 5, BRIEF_MAX_ROWS: 16,
    briefPaidFigure: ()=> null,
    invoiceNumberLabel: (q)=> 'INV-' + q.id,
  });
  const GNAMES = ['briefGroups'];
  const g = compileScope([
    ...NAMES.map((n)=> extractFunction(src, n, 'index.html')),
    extractDeclaration(src, 'PAIR_VERBS', 'index.html'),
    extractDeclaration(src, 'PAIR_VERB_ORDER', 'index.html'),
    extractDeclaration(src, 'PAIR_OBSERVED_MIN', 'index.html'),
    extractDeclaration(src, 'PAIR_OBSERVED_SHARE', 'index.html'),
    extractFunction(src, 'briefGroups', 'index.html'),
  ], gEnv, GNAMES);
  const habits = [{ productId: 'P-RUN', variantIdx: 1, typicalQty: 3, lastPrice: null, sinceLast: 5, orders: 3 }];
  const groups = g.briefGroups({ id: 'C1' }, habits);
  const head = (k)=> (groups.find(x=> x.key === k) || {}).head;
  eq(head('needs'), 'ALSO NEED', 'what the line cannot be used without has its own heading');
  eq(head('with'), 'ALSO TAKE', 'and what usually goes with it has another');
  const names = groups.flatMap(x=> x.rows.map(r=> r.productId));
  eq(new Set(names).size, names.length, 'and no product is offered under two headings');
  eq(head('also'), undefined, 'the one heading that said nothing about the claim is gone');
  eq(groups.filter(x=> x.key === 'needs')[0].rows.length, 1, 'the needed thing is on the list');
  eq(groups.filter(x=> x.key === 'with')[0].rows[0].productId, 'P-SOFT', 'and so is what goes with it');

  const at14 = [{ productId: 'P-RUN', variantIdx: 2, typicalQty: 2, lastPrice: null, sinceLast: 5, orders: 3 }];
  const swapped = g.briefGroups({ id: 'C1' }, at14);
  const or = swapped.find(x=> x.key === 'instead');
  t.check(!!or && or.rows.some(r=> r.productId === 'P-QUIET'),
    'a companion that is out of stock is answered with what stands in for it');
  eq(or && or.head, 'OR TAKE', 'under the heading that says it is a swap');
  t.check(!swapped.dropped.rows.some(r=> r.id === 'P-SOFT' && !r.name),
    'and the shop is told which companion it replaced');
}

/* ---- 9. the counters that now read a rule ---------------------------- */
{
  t.check(/id="q_rail_with"/.test(src), 'the quote rail has a place for what goes with a line');
  t.check(/pairCompanionsFor\(it\.productId, it\.variantIdx, Number\(it\.qty\)\|\|0,/.test(src),
    'and fills it through the one reading');
  t.check(/data-with="\$\{esc\(c\.productId\)\}"/.test(src), 'each companion offers itself as a line');
  t.check(/data-swap="\$\{r\.it\.lineId\}"/.test(src), 'and a short line offers the swap the owner wrote down');
  t.check(/pairSubstitutesFor\(r\.it\.productId, r\.it\.variantIdx\)/.test(src), 'read the same way everywhere');
  /* Nothing sends itself: every one of those is a button, never a push
     that happens on render. */
  const railBody = extractFunction(src, 'renderQuoteRail', 'index.html');
  t.check(!/data\.quote\.items\.push[\s\S]{0,400}?renderQuoteItems\(\);\s*\}\s*\)/.test(railBody.replace(/addEventListener\('click'[\s\S]*/, '')),
    'and no line is added outside a click');
}

/* ---- 10. the till, and a rhythm the books cannot see yet -------------- */
{
  t.check(/function tillGoesWith\(\)\{/.test(src), 'the till reads what goes with the last thing added');
  t.check(/data-tillwith=/.test(src), 'and offers it as a tap');
  t.check(/tillAddSaleLine\(el\.dataset\.tillwith, vi\);/.test(src), 'which adds it the way the till adds anything');
  t.check(/\.find\(c=> \(c\.verbId === 'needs' \|\| c\.verbId === 'with'\) && c\.available && !c\.why && c\.price != null\)/.test(src),
    'never offering what the shop cannot get or the registry cannot price');

  const habitsSrc = extractFunction(src, 'customerProductHabits', 'index.html');
  t.check(/rhythmBy = 'rule'/.test(habitsSrc), 'a rule can stand in for a rhythm the invoices cannot show yet');
  t.check(/const lasts = pairLastsDays\(h\.productId\);/.test(habitsSrc), 'read from what the owner wrote down');
  const reason = extractFunction(src, 'briefReasonFor', 'index.html');
  t.check(/by your own rule/.test(reason), 'and the picture says which of the two it is reading');
  t.check(/times running/.test(reason), 'the other sentence being about the invoices');
}

/* ---- 11. what lands on one invoice, as a screen ---------------------- */
{
  const anEnv = { data, productById: env.productById };
  const a = compileScope([
    extractDeclaration(src, 'PAIR_VERBS', 'index.html'),
    extractFunction(src, 'pairVerb', 'index.html'),
    extractFunction(src, 'productLinksAll', 'index.html'),
    extractFunction(src, 'pairCooccurrence', 'index.html'),
    extractFunction(src, 'invoicedOrders', 'index.html'),
    extractFunction(src, 'anRowsByPair', 'index.html'),
  ], anEnv, ['anRowsByPair']);
  const rows = a.anRowsByPair(data.savedQuotes);
  const runScr = rows.find(r=> r.name === 'Runners' && r.mate === 'Black Screws');
  eq(runScr.count, 4, 'four orders carried runners and screws');
  eq(runScr.qty, 5, 'out of five that carried runners');
  eq(Math.round(runScr.margin), 80, 'which is an attach rate of 80%');
  const back = rows.find(r=> r.name === 'Black Screws' && r.mate === 'Runners');
  eq(back.count, 4, 'the same four, read the other way round');
  eq(Math.round(back.margin), 100, 'and every screw order carried runners — one row cannot say both');
  eq(runScr.rule, 'Needs', 'a pair the shop has ruled on says which rule');
  eq(back.rule, 'not judged', 'and one it has not says so');
  t.check(rows.every(r=> !r.sales && !r.profit), 'there is no money in this view to add up');
}

/* ---- 12. the Manager reads and writes the shop's own rules ----------- */
{
  const T = compileScope([
    ...NAMES.map((n)=> extractFunction(src, n, 'index.html')),
    extractDeclaration(src, 'PAIR_VERBS', 'index.html'),
    extractDeclaration(src, 'PAIR_VERB_ORDER', 'index.html'),
    extractDeclaration(src, 'PAIR_OBSERVED_MIN', 'index.html'),
    extractDeclaration(src, 'PAIR_OBSERVED_SHARE', 'index.html'),
    extractFunction(src, 'pairRuleById', 'index.html'),
    extractFunction(src, 'pairGrid', 'index.html'),
    extractFunction(src, 'updateProductLink', 'index.html'),
    extractDeclaration(src, 'ASSISTANT_TOOLS', 'index.html'),
    'function tools(){ return { ASSISTANT_TOOLS }; }',
  ], Object.assign({}, env, { briefPriceFor: env.briefPriceFor }), ['tools']).tools().ASSISTANT_TOOLS;

  eq(T.product_rules.confirm, false, 'reading the shop\'s rules asks nobody');
  eq(T.set_product_rule.confirm, true, 'writing one is put to the owner first');
  eq(typeof T.set_product_rule.summary, 'function', 'in words, on a card');

  const read = T.product_rules.run({ product_id: 'P-RUN' });
  t.check(read.rules.some(r=> r.goes_with === 'Black Screws' && r.qty_per_one === 8),
    'every rule written about the product comes back with its figure');
  t.check(read.rules.every(r=> typeof r.orders_with_first === 'number'),
    'and what the shop\'s own invoices say about it');
  const sized = read.rules.find(r=> r.sizes_still_open != null);
  t.check(!!sized, 'a rule between two sized products says how far its sizes are settled');

  const before = data.productLinks.length;
  const wrote = T.set_product_rule.run({ from_product_id: 'P-SCR', verb: 'with', to_product_id: 'P-GLUE', qty: 1, per: 'Box' });
  eq(wrote.done, true, 'a new rule is written');
  eq(data.productLinks.length, before + 1, 'as one row');
  t.check(/no price/.test(T.set_product_rule.summary({ from_product_id: 'P-SCR', verb: 'with', to_product_id: 'P-GLUE', qty: 1 })),
    'and the card says plainly that nothing about money changes');
  const again = T.set_product_rule.run({ from_product_id: 'P-SCR', verb: 'with', to_product_id: 'P-GLUE', qty: 2, per: 'Box' });
  eq(again.changed, true, 'writing the same sentence twice changes the one already there');
  eq(data.productLinks.length, before + 1, 'rather than writing a second');
  eq(data.productLinks[data.productLinks.length - 1].qty, 2, 'with the new figure');
  let threw = '';
  try { T.set_product_rule.run({ from_product_id: 'P-SCR', verb: 'sells' }); } catch(e){ threw = e.message; }
  t.check(/needs, with, instead, after, part/.test(threw), 'a sixth verb is refused, and the five are named');
  try { T.set_product_rule.run({ from_product_id: 'P-RUN', verb: 'with', to_product_id: 'P-SOFT', from_variant_index: 9 }); } catch(e){ threw = e.message; }
  t.check(/has no size 9/.test(threw), 'and a size the product has not got');
  const self = T.set_product_rule.run({ from_product_id: 'P-HINGE', verb: 'after', qty: 30 });
  eq(self.done, true, 'runs out after needs no second product');
  eq(T.product_rules.run({ product_id: 'P-HINGE' }).rules.some(r=> r.goes_with === null), true,
    'because it is about the one product');
}

/* ---- 13. a rule as a REASON, on the worth-telling queue -------------- */
{
  /* The gap the rules know best about one customer: they take the
     runners and have never once taken the screws those runners need. */
  const rEnv = Object.assign({}, env, {
    esc: (x)=> String(x == null ? '' : x),
    customerOrdersFor: (cid)=> cid === 'C-BOTH' ? data.savedQuotes : [],
    TELL_PRICE_MEMORY_DAYS: 90,
  });
  const RNAMES = ['briefNeedsReason', 'briefSwapReason', 'pairCompanionsFor', 'pairSubstitutesFor',
    'pairEvidence', 'pairStanding', 'pairingsFor', 'pairReversed', 'productLinksAll', 'pairVerb', 'pairSizeIdx',
    'briefSupply', 'briefSupplyWords', 'briefPriceRows',
    'briefVariantForLine', 'briefSameSizeAs', 'invoicedOrders'];
  const r = compileScope([
    extractDeclaration(src, 'PAIR_VERBS', 'index.html'),
    extractDeclaration(src, 'PAIR_VERB_ORDER', 'index.html'),
    extractDeclaration(src, 'PAIR_OBSERVED_MIN', 'index.html'),
    extractDeclaration(src, 'PAIR_OBSERVED_SHARE', 'index.html'),
    ...RNAMES.map((n)=> extractFunction(src, n, 'index.html')),
  ], rEnv, RNAMES);

  const habitRun = { productId: 'P-RUN', variantIdx: 1, typicalQty: 3, sinceLast: 5, orders: 4, lastPrice: 40000 };
  const needs = r.briefNeedsReason([habitRun], null);
  eq(needs && needs.key, 'needs', 'a customer who takes runners and never takes the screws they need is worth telling');
  eq(needs.productId, 'P-SCR', 'and the thing to show them is the screws');
  eq(needs.qty, 24, 'at the quantity their own line implies');
  eq(needs.weight, 24 * 9000, 'weighed at what that order would be worth');
  t.check(/never taken/.test(needs.why), 'the sentence says they have never taken it');
  t.check(/Black Screws/.test(needs.why) && /Runners/.test(needs.why), 'and names both things');
  t.check(/in 4 of 5/.test(needs.why), 'with the shop-wide sample it is built on');

  const mine = r.briefNeedsReason([habitRun], 'C-BOTH');
  t.check(/Theirs, in 2 of 3/.test(mine.why),
    "and this customer's own orders, at the size they buy, where there are any");

  eq(r.briefNeedsReason([habitRun, { productId: 'P-SCR', variantIdx: null, typicalQty: 1, sinceLast: 9, orders: 2 }], null),
    null, 'a customer who already takes it is not told they need it');
  eq(r.briefNeedsReason([Object.assign({}, habitRun, { sinceLast: 400 })], null), null,
    'nor one whose habit is a year old');

  /* A rule with no figure has no number to weigh, and an invented one
     is worse than none. */
  const noFig = add('P-RUN', 'needs', 'P-HINGE', null, '');
  eq(r.briefNeedsReason([habitRun], null).productId, 'P-SCR', 'a rule with no figure never outranks one with');
  data.productLinks = data.productLinks.filter(x=> x.id !== noFig.id);

  /* Out of stock is not a reason to tell anybody anything. */
  const glue = add('P-RUN', 'needs', 'P-GLUE', 2, 'Pair');
  eq(r.briefNeedsReason([habitRun], null).productId, 'P-SCR', 'and what the shelf has not got is never the reason');
  data.productLinks = data.productLinks.filter(x=> x.id !== glue.id);

  /* Due, and NOBODY can send it -- our shelf being empty is no longer
     enough, because such a line is now offered and ordered in. */
  const dueOut = [{ productId: 'P-SOFT', variantIdx: 1, typicalQty: 4, sinceLast: 30, orders: 3, lastPrice: 10000 }];
  const swap = r.briefSwapReason(dueOut);
  eq(swap && swap.key, 'swap', 'a customer due for something that is out is still worth telling');
  eq(swap.productId, 'P-QUIET', 'with the swap the owner wrote down');
  eq(swap.qty, 4, 'at the quantity they take');
  eq(swap.unit, 'Pair', 'in the unit it is priced in');
  t.check(/nobody can send it/.test(swap.why) && /stands in/.test(swap.why), 'and the sentence says both halves');
  /* A plain board, out of stock, with nothing written down for it. */
  data.products.push({ id: 'P-BOARD', name: 'Plain Board', type: 'simple', unit: 'Sheet' });
  stock.set('P-BOARD', 0);
  eq(r.briefSwapReason([{ productId: 'P-BOARD', variantIdx: null, typicalQty: 1 }]), null,
    'where nothing stands in for it, nothing is claimed');

  const reasonSrc = extractFunction(src, 'briefReasonFor', 'index.html');
  t.check(/briefSwapReason\(dueAll\.filter/.test(reasonSrc), 'the queue reads the swap before it reads a price story');
  t.check(/briefNeedsReason\(habits, r\.id\)/.test(reasonSrc), 'and the attach gap before the site stage');
}

/* ---- 14. one customer's own orders, and the words under a picture ---- */
{
  const eEnv = Object.assign({}, env, { invoicedOrders: ()=> data.savedQuotes });
  const E = compileScope([extractFunction(src, 'pairEvidence', 'index.html'),
    extractFunction(src, 'pairSizeIdx', 'index.html'), extractFunction(src, 'invoicedOrders', 'index.html')],
    eEnv, ['pairEvidence']);
  const all = E.pairEvidence('P-RUN', 'P-SCR', null, null);
  eq(all.withFrom, 5, 'the shop-wide count reads every invoice');
  const one = E.pairEvidence('P-RUN', 'P-SCR', null, null, data.savedQuotes.slice(0, 2));
  eq(one.withFrom, 2, 'and the same counter, handed two orders, reads two');
  eq(one.andTo, 1, 'counting only the one that carried both');

  const W = compileScope([extractFunction(src, 'briefAlsoWords', 'index.html')],
    { esc: (x)=> String(x == null ? '' : x) }, ['briefAlsoWords']);
  const a = { verb: { brief: 'ALSO NEED' }, link: { qty: 8, per: 'Pair', toId: 'P-SCR' },
    product: SCREWS, label: 'Black Screws', qty: 24, standing: { ev: { withFrom: 5, andTo: 4 } } };
  const words = W.briefAlsoWords(a, { withFrom: 3, andTo: 2 });
  t.check(/ALSO NEED/.test(words), 'the reasoning says the heading the customer will read');
  t.check(/in 4 of 5 cases/.test(words), 'with what the shop as a whole shows');
  t.check(/took both together in 2 of their 3/.test(words), 'and what this customer shows');
  t.check(/never taken the two together in 4 orders/.test(W.briefAlsoWords(a, { withFrom: 4, andTo: 0 })),
    'a customer who never has is said plainly');
  t.check(!/orders of their own/.test(W.briefAlsoWords(a, { withFrom: 0, andTo: 0 })),
    'and a customer with nothing on file is claimed nothing about');
  t.check(/no quantity/.test(W.briefAlsoWords(Object.assign({}, a, { qty: null }), null)),
    'a rule with no figure says so rather than inventing one');
}

/* ---- 15. the picture answers a habit the shelf has run out of ------- */
{
  const gEnv2 = Object.assign({}, env, {
    briefPriceNow: (id, vi, qty)=> (prices.get(key(id, vi)) || {}).price ?? null,
    briefPackText: ()=> 'Sold loose',
    productPriceRows: (id, vi)=> env.rankedPriceRows(id, vi),
    shelfValueForKey: ()=> ({ ownedQty: 0, unitCost: null }),
    stockKey: (id, vi)=> (vi == null ? id : `${id}::${vi}`),
    customerSiteStage: ()=> ({ fresh: false, stage: null }),
    briefStageProducts: ()=> [],
    TELL_PRICE_MEMORY_DAYS: 90, TELL_PRICE_DROP_PCT: 5, TELL_PRICE_FALL_CEILING_PCT: 40,
    BRIEF_PACK_FIGURE_PCT: 15, BRIEF_ROWS_PER_GROUP: 5, BRIEF_MAX_ROWS: 16,
    briefPaidFigure: ()=> null,
    invoiceNumberLabel: (q)=> 'INV-' + q.id,
    /* Reached now that a line we hold none of still goes through
       rowFor: only a row the SUPPLIER has marked is left off, and it is
       named with the mark that put it there. */
    briefMarkedOutWords: (id, vi)=> supplierOut.has(key(id, vi)) ? 'Kirumira, marked 2 days ago' : '',
  });
  const G2 = compileScope([
    ...NAMES.map((n)=> extractFunction(src, n, 'index.html')),
    extractDeclaration(src, 'PAIR_VERBS', 'index.html'),
    extractDeclaration(src, 'PAIR_VERB_ORDER', 'index.html'),
    extractDeclaration(src, 'PAIR_OBSERVED_MIN', 'index.html'),
    extractDeclaration(src, 'PAIR_OBSERVED_SHARE', 'index.html'),
    extractFunction(src, 'briefGroups', 'index.html'),
  ], gEnv2, ['briefGroups']);
  /* Their own line, the 14" soft close, is out; a Quiet Runner stands
     in for it by the rule written the other way round. */
  const out = G2.briefGroups({ id: 'C1' }, [{ productId: 'P-SOFT', variantIdx: 1, typicalQty: 4, sinceLast: 6, orders: 3, lastPrice: 10000 }]);
  const or = out.find(x=> x.key === 'instead');
  t.check(!!or && or.rows.some(x=> x.productId === 'P-QUIET'),
    'a customer whose own line is out is offered what stands in for it');
  eq(or && or.rows[0].theirQty, 4, 'at the quantity they take');
  /* AN EMPTY SHELF OF OURS IS NOT A REFUSAL. The 18" soft close is one
     we hold none of and the supplier still has: it goes on the list,
     priced, carrying the fact that it would be ordered in. This shop
     buys to order, so keeping it off was keeping a customer from a
     thing the shop can plainly sell them. */
  const orderIn = G2.briefGroups({ id: 'C1' }, [{ productId: 'P-SOFT', variantIdx: 2, typicalQty: 4, sinceLast: 6, orders: 3, lastPrice: 12000 }]);
  const row18 = orderIn.flatMap(g=> g.rows).find(x=> x.productId === 'P-SOFT');
  t.check(!!row18, 'a thing we hold none of, that a supplier still has, is offered');
  eq(row18 && row18.toOrder, true, 'carrying the fact that it is not on the shelf');
  eq(row18 && row18.price, 10500, 'at the price the registry gives');
  t.check(!orderIn.dropped.rows.some(x=> x.id === 'P-SOFT'),
    'and it is left off nothing -- an empty shelf of ours is not a reason');

  /* What NOBODY can supply is still left off, under the supplier's own
     reason and named with the mark that put it there. */
  const nobody = G2.briefGroups({ id: 'C1' }, [{ productId: 'P-SOFT', variantIdx: 1, typicalQty: 4, sinceLast: 6, orders: 3, lastPrice: 12000 }]);
  const out14 = nobody.dropped.rows.find(x=> x.id === 'P-SOFT');
  eq(out14 && out14.why, 'outOfStock', 'a product every supplier has marked is left off as theirs');
  t.check(/Kirumira, marked 2 days ago/.test((out14 || {}).name || ''),
    'with the row carrying the mark said out loud');

  /* And a product with no price on file at all is left off for THAT,
     which is a different errand on a different screen. */
  const boardOnly = G2.briefGroups({ id: 'C1' }, [{ productId: 'P-BOARD', variantIdx: null, typicalQty: 2, sinceLast: 6, orders: 3, lastPrice: 5000 }]);
  t.check(boardOnly.dropped.rows.some(x=> x.id === 'P-BOARD' && x.why === 'noRow'),
    'a product nobody has priced is named as left off, for the missing row');
}

/* ---- 16. what the screen itself says --------------------------------- */
{
  /* Worth telling is not a screen any more; its queue, its rules and its
     score are the Follow-ups hub's third tab, and its rail's two claims
     moved with them. The claims are unchanged -- every reason is named
     rather than printed as a key, and the panel that says it is the
     whole algorithm counts the rules it runs on -- so they are asserted
     where they now live: the label map, and the rules panel. */
  const names = extractDeclaration(src, 'HUB_SCORE_LABELS', 'index.html');
  t.check(/needs:'Needs it too'/.test(names) && /swap:'Out — offered instead'/.test(names),
    'the scoreboard has a name for each new reason rather than printing its key');
  const rules = extractFunction(src, 'renderFollowUpScore', 'index.html');
  t.check(/Companions come from rules you wrote/.test(rules),
    'and the panel that claims to be the whole algorithm counts the rules too');
  const why = extractFunction(src, 'briefWhyHTML', 'index.html');
  t.check(!/Under <b>Also buy<\/b>/.test(why), 'the reasoning no longer names a heading the picture stopped using');
  t.check(/The reason names/.test(why),
    'and says so where the list has no room for the very thing the reason is about');
  /* The queue row that printed `b.unit || (b.product && b.product.unit)`
     went with the screen. That fallback was a SECOND copy of a
     resolution customerBrief had already done -- its pickUnit chain
     ends in the product's own unit -- so the claim is asserted at the
     one place the unit is decided, and at the one place it now reaches
     the client. */
  const brief0 = extractFunction(src, 'customerBrief', 'index.html');
  t.check(/\(product && product\.unit\) \|\| ''/.test(brief0),
    'the unit the price was worked in is resolved once, ending at the product’s own');
  const line = extractFunction(src, 'briefPlainLine', 'index.html');
  t.check(/b\.unit/.test(line), 'and it is what the client is told the price is per');
  const brief = extractFunction(src, 'customerBrief', 'index.html');
  t.check(/briefPriceNow\(pick, pickVar, qty\)/.test(brief),
    'and prices the pick at the quantity the reason weighed');
}

/* ---- 17. a rule is true from both ends ------------------------------- */
{
  /* "Runners needs Black Screws" was written on the runners. Somebody
     buying the screws is offered the runners -- under the weaker word,
     because screws are used for a hundred other things. */
  const back = fns.pairCompanionsFor('P-SCR', null, 2);
  const run = back.find(c=> c.productId === 'P-RUN');
  t.check(!!run, 'a rule written on the other product still reaches this one');
  eq(run.verbId, 'with', 'read backwards, NEEDS softens to goes with');
  eq(run.qty, null, 'and the figure does not survive the turn');
  eq(run.link.reversed, true, 'the row says it was read backwards');

  /* Goes with is the same word either way. */
  const soft = fns.pairCompanionsFor('P-SOFT', 0, 1).find(c=> c.productId === 'P-RUN');
  t.check(!!soft && soft.verbId === 'with', 'goes with reads the same from either end');

  /* The owner's own sentence beats the one read backwards, figure and
     all -- they wrote it, and it carries the ratio. */
  const own = fns.addProductLink('P-SCR', 'with', 'P-RUN', 3, 'Box', '');
  eq(own.ok, true, 'the shop may write the other end itself');
  const both = fns.pairCompanionsFor('P-SCR', null, 2).filter(c=> c.productId === 'P-RUN');
  eq(both.length, 1, 'and then the product is offered once, not twice');
  eq(both[0].qty, 6, 'at the figure they wrote');
  eq(!!both[0].link.reversed, false, 'from their own sentence');
  data.productLinks = data.productLinks.filter(x=> x.id !== own.link.id);

  /* Writing the mirror of a symmetric sentence is writing it twice. */
  const mirror = fns.addProductLink('P-SOFT', 'with', 'P-RUN', null, '', '');
  eq(mirror.ok, false, 'the same sentence backwards is refused');
  t.check(/other way round/.test(mirror.why), 'and named as the sentence it already is');
  /* But "needs" both ways is two different claims, and both may stand. */
  const twoWay = fns.addProductLink('P-SCR', 'needs', 'P-RUN', 1, 'Box', '');
  eq(twoWay.ok, true, 'while needs may be written in both directions');
  data.productLinks = data.productLinks.filter(x=> x.id !== twoWay.link.id);

  /* And the screen shows what reaches a product from elsewhere. */
  const RE = ['pairReachingRules', 'pairReversed', 'pairVerb', 'productLinksAll', 'pairSizeIdx'];
  const re = compileScope([extractDeclaration(src, 'PAIR_VERBS', 'index.html'),
    ...RE.map((n)=> extractFunction(src, n, 'index.html'))], env, RE);
  const reach = re.pairReachingRules('P-SCR');
  t.check(reach.some(x=> x.otherId === 'P-RUN' && x.verb === 'with' && x.authoredVerb === 'needs'),
    'named on the second product, with the word it was written in');
}

/* ---- 18. the mark is about the supplier, and says so ----------------- */
{
  const mEnv = Object.assign({}, env, {
    productPriceRows: (id, vi)=> id === 'P-SOFT' && vi === 1
      ? [{ supplierId: 'S1', outOfStock: true, outOfStockSince: '2026-08-20' },
         { supplierId: 'S2', outOfStock: true, outOfStockSince: '2026-09-01' }]
      : id === 'P-SCR' ? [{ supplierId: 'S1', outOfStock: false }] : [],
    supplierName: (id)=> id === 'S1' ? 'Karddia' : 'SJS Enersol',
    daysSinceDate: (d)=> d === '2026-08-20' ? 21 : 9,
  });
  const M = compileScope([extractFunction(src, 'briefMarkedOutWords', 'index.html')], mEnv, ['briefMarkedOutWords']);
  const words = M.briefMarkedOutWords('P-SOFT', 1);
  t.check(/Karddia and SJS Enersol/.test(words), 'the rows carrying the mark are named');
  t.check(/marked 9 days ago/.test(words), 'and the most recent mark is dated');
  eq(M.briefMarkedOutWords('P-SCR', null), '', 'a row nobody marked says nothing');

  const left = extractDeclaration(src, 'BRIEF_LEFT_OFF', 'index.html');
  t.check(/every supplier row marked out of stock/.test(left),
    'the words say WHOSE stock the mark is about');
  t.check(/not our own shelf/.test(left),
    'and that a thing we simply hold none of is offered and ordered in');
  const groups = extractFunction(src, 'briefGroups', 'index.html');
  t.check(/briefMarkedOutWords\(productId, variantIdx\)/.test(groups),
    'and the line names the row so the owner can see the mark rather than guess');
}

t.check(saves > 0, 'every rule written was saved');
process.exit(t.done() ? 1 : 0);
