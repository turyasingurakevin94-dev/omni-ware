'use strict';
/*
 * A pairing with sizes at either end.
 *
 * Most of this shop's products come in sizes, and prices and stock are
 * kept per size, so a pairing that can only name a product could not
 * put a companion on a picture for any customer who had never bought
 * one. A sentence may now hold for every size of the first product or
 * for one, and name a size of the second or leave it to follow; a
 * sentence pinned to one size sits beside the general one and wins for
 * that size.
 *
 * Extracted from index.html and run against fixtures: no copy of the
 * logic lives here.
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('pairing sizes');
const src = read('index.html');
const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);

const RUNNERS = { id: 'P-RUN', name: 'Runners', type: 'variable', unit: 'Pair',
  variants: [{ combo: { Size: '10"' } }, { combo: { Size: '12"' } }, { combo: { Size: '16"' } }] };
const SOFT = { id: 'P-SOFT', name: 'Soft Close Mulper', type: 'variable', unit: 'Pair',
  variants: [{ combo: { Length: '12"' } }, { combo: { Length: '14"' } }, { combo: { Length: '18"' } }] };
const SCREWS = { id: 'P-SCR', name: 'Black Screws', type: 'simple', unit: 'Box' };
const data = {
  products: [RUNNERS, SOFT, SCREWS],
  prices: [
    { productId: 'P-SOFT', variantIdx: 0, supplierId: 'S1', unit: 'Pair', wholesale: 9000, retail: 9500 },
    { productId: 'P-SOFT', variantIdx: 1, supplierId: 'S1', unit: 'Pair', wholesale: 9500, retail: 10000 },
    { productId: 'P-SOFT', variantIdx: 2, supplierId: 'S1', unit: 'Pair', wholesale: 10000, retail: 10500 },
    { productId: 'P-SCR', variantIdx: null, supplierId: 'S1', unit: 'Box', wholesale: 8000, retail: 9000 },
  ],
  productLinks: [],
  savedQuotes: [
    { id: 1, invoiced: true, items: [{ productId: 'P-RUN', variantIdx: 1, qty: 10 }, { productId: 'P-SOFT', variantIdx: 0, qty: 10 }] },
    { id: 2, invoiced: true, items: [{ productId: 'P-RUN', variantIdx: 1, qty: 5 }, { productId: 'P-SCR', variantIdx: null, qty: 1 }] },
    { id: 3, invoiced: true, items: [{ productId: 'P-RUN', variantIdx: 2, qty: 4 }] },
    { id: 4, invoiced: true, items: [{ productId: 'P-RUN', variantIdx: 2, qty: 4 }, { productId: 'P-SOFT', variantIdx: 2, qty: 4 }] },
    { id: 5, invoiced: true, items: [{ productId: 'P-RUN', variantIdx: 0, qty: 2 }] },
  ],
};
let nextId = 100, saves = 0;
const env = {
  data,
  productLinksTable: true,
  allocRowId: ()=> nextId++,
  saveData: ()=> { saves++; },
  productById: (id)=> data.products.find(p=> p.id === id) || null,
  productPriceRows: (productId, variantIdx=null)=> data.prices.filter(p=> p.productId === productId
    && (p.variantIdx == null ? null : p.variantIdx) === variantIdx),
  rankedPriceRows: (productId, variantIdx=null)=> env.productPriceRows(productId, variantIdx),
  briefInStock: ()=> null,
  productVariantLabel: (p, vi)=> (vi == null || !p.variants || !p.variants[vi]) ? p.name
    : `${p.name} — ${Object.values(p.variants[vi].combo).join(' / ')}`,
  variantLabel: (combo)=> Object.values(combo).join(' / '),
  productLinkName: (id)=> (env.productById(id) || {}).name || `${id} — gone from the catalogue`,
  PAIR_VERBS: [
    { id:'needs', self:false }, { id:'with' }, { id:'instead' }, { id:'after', self:true }, { id:'part' },
  ],
};
const NAMES = ['pairVerb', 'productLinksAll', 'pairSizeIdx', 'pairDuplicateOf', 'pairFault', 'addProductLink',
  'updateProductLink', 'pairSideLabel', 'productLinkLabel', 'productLinkFromLabel', 'pairingsFor',
  'pairRuleKey', 'pairRulesOf', 'pairRuleById', 'pairGrid', 'pairSetCell', 'pairMatchBySize', 'pairClearCells',
  'pairRuleDelete', 'briefVariantForLine', 'briefSameSizeAs', 'invoicedOrders', 'pairEvidence', 'pairStanding'];
const fns = compileScope(NAMES.map((n)=> extractFunction(src, n, 'index.html')), env, NAMES);

/* ---- 1. writing a sentence, and what is refused ---------------------- */
{
  const r = fns.addProductLink('P-RUN', 'with', 'P-SOFT', 1, 'Pair', '');
  eq(r.ok, true, 'a general pairing is written');
  eq(r.link.fromVariantIdx, null, 'for every size of the first product');
  eq(r.link.toVariantIdx, null, 'to the size that follows');
  const again = fns.addProductLink('P-RUN', 'with', 'P-SOFT', 1, 'Pair', '');
  eq(again.ok, false, 'the same sentence is not written twice');
  eq(again.existing && again.existing.id, r.link.id, 'and the one already written is handed back');
  const self = fns.addProductLink('P-RUN', 'with', 'P-RUN', null, '', '');
  eq(self.ok, false, 'a product cannot go with itself');
  t.check(/Runs out after/.test(self.why), 'and the words name the verb that IS about itself');
  const after = fns.addProductLink('P-RUN', 'after', 'P-SCR', 30, '', '');
  eq(after.ok, true, 'runs out after is written');
  eq(after.link.toId, 'P-RUN', 'and points back at the product whatever the caller passed');
  const pinned = fns.addProductLink('P-RUN', 'with', 'P-SOFT', 1, 'Pair', '', { fromVariantIdx: 2, toVariantIdx: '2' });
  eq(pinned.ok, true, 'a sentence for one size sits beside the general one');
  eq(pinned.link.fromVariantIdx, 2, 'its size is a number');
  eq(pinned.link.toVariantIdx, 2, 'at both ends, whatever a select handed over');
  const twice = fns.addProductLink('P-RUN', 'with', 'P-SOFT', 1, 'Pair', '', { fromVariantIdx: 2, toVariantIdx: 2 });
  eq(twice.ok, false, 'and it too is written once');
  eq(fns.productLinkFromLabel(pinned.link), 'Runners — 16"', 'a pinned sentence reads with its size');
  eq(fns.productLinkLabel(pinned.link), 'Soft Close Mulper — 18"', 'at both ends');
  eq(fns.productLinkLabel(r.link), 'Soft Close Mulper', 'a general one reads as the product');
}

/* ---- 2. changing one, and what the rules keep from changing ---------- */
{
  const g = data.productLinks[0];
  const was = Object.assign({}, g);
  const bad = fns.updateProductLink(g.id, { toId: 'P-RUN' });
  eq(bad.ok, false, 'a change that would pair a product with itself is refused');
  eq(g.toId, was.toId, 'and the row is left exactly as it was');
  const dup = fns.updateProductLink(g.id, { fromVariantIdx: 2, toVariantIdx: 2 });
  eq(dup.ok, false, 'a change that would repeat another sentence is refused');
  eq(g.fromVariantIdx, null, 'without touching the row');
  eq(fns.updateProductLink(g.id, { fromVariantIdx: '1' }).ok, true, 'a size on the first product is set');
  eq(g.fromVariantIdx, 1, 'as a number');
  fns.updateProductLink(g.id, { fromId: 'P-SCR' });
  eq(g.fromVariantIdx, null, 'a new first product starts with no size: size 2 of the old is nobody\'s size of the new');
  fns.updateProductLink(g.id, { fromId: 'P-RUN' });
  const dupAfter = fns.updateProductLink(g.id, { verb: 'after' });
  eq(dupAfter.ok, false, 'turning it into runs out after would repeat the one already written for runners');
  eq(g.verb, 'with', 'so it stays as it was');
  const s = fns.addProductLink('P-SCR', 'with', 'P-SOFT', null, '', '').link;
  eq(fns.updateProductLink(s.id, { verb: 'after' }).ok, true, 'a sentence with no twin can become runs out after');
  eq(s.toId, 'P-SCR', 'and then points at itself');
  fns.updateProductLink(s.id, { verb: 'with', toId: 'P-SOFT' });
  eq(s.toId, 'P-SOFT', 'and back');
  data.productLinks = data.productLinks.filter(x=> x.id !== s.id);
}

/* ---- 3. which sentences apply to a product at a size ----------------- */
{
  const at12 = fns.pairingsFor('P-RUN', 1);
  eq(at12.length, 1, 'at 12" the general sentence applies');
  eq(at12[0].fromVariantIdx, null, 'and it is the general one');
  const at16 = fns.pairingsFor('P-RUN', 2);
  eq(at16.length, 1, 'at 16" one sentence applies');
  eq(at16[0].fromVariantIdx, 2, 'and it is the ticked one, not both');
  eq(at16[0].toVariantIdx, 2, 'which names 18"');
  eq(fns.pairingsFor('P-RUN', null).length, 1, 'with no size known only the general sentence applies');
  eq(fns.pairingsFor('P-SCR', null).length, 0, 'runs out after is never a companion');
  data.productLinks[0].active = false;
  eq(fns.pairingsFor('P-RUN', 1).length, 0, 'a sentence switched off applies nowhere');
  data.productLinks[0].active = true;
  const named = fns.addProductLink('P-RUN', 'with', 'P-SOFT', 1, 'Pair', '', { toVariantIdx: 1 }).link;
  eq(fns.pairingsFor('P-RUN', 1)[0].id, named.id, 'a row naming a size of the second, for every size of the first, beats the general one');
  eq(fns.pairingsFor('P-RUN', 2)[0].fromVariantIdx, 2, 'but not the row ticked for this exact size');
  data.productLinks = data.productLinks.filter(x=> x.id !== named.id);
}

/* ---- 4. the size grid ------------------------------------------------ */
{
  const rules = fns.pairRulesOf('P-RUN');
  eq(rules.length, 2, 'runners carry two rules: goes with soft close, runs out after');
  const rule = rules.find(r=> r.toId === 'P-SOFT');
  eq(rule.rows.length, 2, 'the soft close rule is two rows: the general one and one tick');
  eq(rule.general && rule.general.fromVariantIdx, null, 'the general row has no size');
  eq(rule.ticks.length, 1, 'and one tick');
  eq(fns.pairRuleById(rule.ticks[0].id).key, rule.key, 'a rule is found from any of its rows');

  const grid = fns.pairGrid(rule);
  eq(grid.rows.length, 3, 'one row per size of the first product');
  eq(grid.cols.length, 3, 'one column per size of the second');
  eq(grid.rows[0].follows && grid.rows[0].follows.gap, true, '10" runners: no soft close matches, nothing follows');
  eq(grid.rows[0].open, true, 'which is an open row');
  eq(grid.rows[1].follows && grid.rows[1].follows.idx, 0, '12" runners take the 12" soft close');
  eq(grid.rows[1].follows.by, 'size', 'because the sizes match');
  eq(grid.rows[2].ticked.length, 1, '16" runners have a tick');
  eq(grid.rows[2].ticked[0].j, 2, 'on 18"');
  eq(grid.rows[2].cells[2].orders, 1, 'and one order carried both at those sizes');
  eq(grid.rows[1].cells[0].orders, 1, 'as one carried 12" with 12"');
  eq(grid.rows[1].cells[1].orders, 0, 'and none carried 12" with 14"');
  eq(grid.open, 1, 'one size is open');
  eq(grid.settled, 2, 'two are settled');

  eq(fns.pairSetCell(rule, 0, 1, true).ok, true, '10" can be ticked against 14"');
  const rule2 = fns.pairRuleById(rule.lead.id);
  eq(rule2.ticks.length, 2, 'which writes a second tick');
  eq(rule2.ticks.find(l=> l.fromVariantIdx === 0).qty, 1, 'carrying the rule\'s figure');
  eq(fns.pairGrid(rule2).open, 0, 'and no size is open');
  eq(fns.pairSetCell(rule2, 0, 1, true).ok, true, 'ticking a ticked square is not a second row');
  eq(fns.pairRuleById(rule.lead.id).ticks.length, 2, 'still two');
  eq(fns.pairSetCell(fns.pairRuleById(rule.lead.id), 0, 1, false).ok, true, 'and it can be unticked');
  eq(fns.pairRuleById(rule.lead.id).ticks.length, 1, 'which deletes that row');

  const m = fns.pairMatchBySize(fns.pairRuleById(rule.lead.id));
  eq(m.ok && m.matched, 1, 'match by size ticks the one row with a same-size match and no tick');
  const g3 = fns.pairGrid(fns.pairRuleById(rule.lead.id));
  eq(g3.rows[1].ticked.length === 1 && g3.rows[1].ticked[0].j === 0, true, '12" to 12"');
  eq(g3.rows[2].ticked[0].j, 2, 'while the 16" tick is left as it was');
  eq(fns.pairClearCells(fns.pairRuleById(rule.lead.id)).ok, true, 'clear takes every tick off');
  const g4 = fns.pairGrid(fns.pairRuleById(rule.lead.id));
  eq(g4.rows.every(r=> !r.ticked.length), true, 'leaving the general row alone');
  eq(fns.pairRuleById(rule.lead.id).general != null, true, 'which is still there');
  fns.pairSetCell(fns.pairRuleById(rule.lead.id), 2, 2, true);

  const plain = fns.addProductLink('P-RUN', 'needs', 'P-SCR', 2, 'Pair', '').link;
  const gp = fns.pairGrid(fns.pairRuleById(plain.id));
  eq(gp.cols.length, 1, 'a second product with no sizes is one column');
  eq(gp.toSized, false, 'and the grid says so');
  eq(gp.rows.length, 3, 'against every size of the first');
  fns.pairRuleDelete(fns.pairRuleById(plain.id));
  eq(fns.pairRulesOf('P-RUN').length, 2, 'deleting a rule takes every row of it');
  data.products.push({ id: 'P-NAIL', name: 'Wire Nails', type: 'simple', unit: 'Kg' });
  const flat = fns.addProductLink('P-SCR', 'with', 'P-NAIL', null, '', '').link;
  eq(fns.pairGrid(fns.pairRuleById(flat.id)), null, 'two products with no sizes have no grid');
  fns.pairRuleDelete(fns.pairRuleById(flat.id));
}

/* ---- 5. the books check a sentence at its size ----------------------- */
{
  const g = data.productLinks[0], pinned = data.productLinks[2];
  const evAll = fns.pairEvidence('P-RUN', 'P-SOFT');
  eq(evAll.withFrom, 5, 'five orders carried runners of any size');
  eq(evAll.andTo, 2, 'two of them had a soft close');
  const ev16 = fns.pairEvidence('P-RUN', 'P-SOFT', 2, 2);
  eq(ev16.withFrom, 2, 'two orders carried 16" runners');
  eq(ev16.andTo, 1, 'one of them had the 18" soft close');
  eq(fns.pairStanding(pinned).key, 'agree', 'so the books agree with the pinned sentence');
  eq(fns.pairStanding(g).key, 'argue', 'and argue with the general one');
}

/* ---- 6. the screen ---------------------------------------------------- */
{
  t.check(/data-cell="\$\{ref\}:\$\{c\.i == null \? '' : c\.i\}:\$\{c\.j == null \? '' : c\.j\}"/.test(src), 'every square of the grid is a button that names its pair');
  t.check(/data-pair="match"/.test(src) && /data-pair="clear"/.test(src), 'with match by size and clear beside it');
  t.check(/data-pairsel=/.test(src), 'the product list selects a product');
  t.check(/id="pair_pick"/.test(src) && /data-pick=/.test(src), 'and a rule is written by finding the second product by name');
  t.check(/from_variant_idx: x\.fromVariantIdx==null \? null : Number\(x\.fromVariantIdx\)/.test(src), 'the first size reaches the server');
  t.check(/select\('to_variant_idx, from_variant_idx'\)/.test(src), 'after a probe for both columns');
  const mig = read('supabase/migrations/0093_product_link_size.sql');
  t.check(mig.includes('add column if not exists from_variant_idx integer'), 'which the migration adds');
  t.check(mig.includes('add column if not exists to_variant_idx integer'), 'beside the second');
}

t.check(saves > 0, 'every change was saved');
process.exit(t.done() ? 1 : 0);
