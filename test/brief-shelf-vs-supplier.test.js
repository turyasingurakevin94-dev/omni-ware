'use strict';
/*
 * Two facts the brief kept confusing:
 *
 *   OUR SHELF is empty      -- we counted and hold none. The price is on
 *                              file, the supplier has it, we can order.
 *   THE SUPPLIER is out     -- somebody ticked "out of stock" against
 *                              every row in the Price Registry. Nobody
 *                              can send it at all.
 *
 * Musisi was told "2 left off — every price marked out of stock: Washer
 * — M20*30*4, Wood Screws — 6*50 / 25kgs" for two products whose
 * registry rows were perfectly healthy: unmarked, priced, live
 * suppliers. Both were simply at a counted zero on our own shelf. The
 * habit block that names a customer's own line when the shelf has run
 * out was reporting it under 'outOfStock' — the SUPPLIER's word — so
 * the fix it offered ("clear the mark in the Price Registry") was an
 * errand with nothing to do at the end of it.
 *
 * A shelf at zero also is not a line that "cannot be priced": it prices
 * fine, it is just not there today. So it is no longer left off at all
 * -- this shop buys most of what it sells to order, and such a line now
 * goes on the customer's list at the registry's price, carrying
 * `toOrder` so the SHOP knows what is not standing here before a
 * customer asks for it this afternoon. Only what NOBODY can send is
 * left off, under the supplier's own reason.
 *
 * briefGroups itself is run here, extracted from index.html.
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('brief: our shelf is not the supplier');
const src = read('index.html');
const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);

/* ---- the fixture shop ------------------------------------------------
   WASHER  -- shelf 0, registry healthy      -> our shelf
   SCREWS  -- shelf 0, registry healthy      -> our shelf
   MULPER  -- shelf 0, every row marked out  -> the supplier
   NAILS   -- on the shelf, priced           -> a row on the list      */
const WASHER = { id: 'P-WASH', name: 'Washer', type: 'variable', unit: 'Pc',
  variants: [{ combo: { Size: 'M20*30*4' } }] };
const SCREWS = { id: 'P-SCRW', name: 'Wood Screws', type: 'variable', unit: 'Pc',
  variants: [{ combo: { Size: '6*50', Pack: '25kgs' } }] };
const MULPER = { id: 'P-SOFT', name: 'Soft Close Mulper', type: 'simple', unit: 'Pair' };
const NAILS  = { id: 'P-NAIL', name: 'Nails', type: 'simple', unit: 'Kg' };
const PRODUCTS = [WASHER, SCREWS, MULPER, NAILS];

const shelf = new Map([['P-WASH::0', 0], ['P-SCRW::0', 0], ['P-SOFT::', 0], ['P-NAIL::', 40]]);
const supplierOut = new Set(['P-SOFT::']);
const key = (id, vi)=> id + '::' + (vi == null ? '' : vi);

const env = {
  briefInStock: (id, vi)=> { const v = shelf.get(key(id, vi)); return v === undefined ? null : v; },
  /* Healthy rows for everything; the mark lives only on MULPER. */
  briefPriceFor: (id, vi)=> supplierOut.has(key(id, vi))
    ? { why: 'outOfStock' }
    : { price: 9750, cost: 8000, unit: 'Pc', kind: 'wholesale' },
  briefMarkedOutWords: (id, vi)=> supplierOut.has(key(id, vi)) ? 'Kirumira, marked 3 days ago' : '',
  briefPriceRows: (id, vi)=> supplierOut.has(key(id, vi)) ? [] : [{ productId: id, supplierId: 'S1' }],
  supplierLeadDays: ()=> 3,
  briefPackText: ()=> '',
  briefPaidFigure: ()=> null,
  briefVariantForLine: ()=> ({ variantIdx: null, why: 'noVariants' }),
  briefStageProducts: ()=> [],
  customerSiteStage: ()=> ({ fresh: false, stage: { label: '', buys: [] } }),
  /* No pairings at all: nothing stands in for anything, which is what
     drops both of Musisi's lines into the "say it plainly" branch. */
  pairCompanionsFor: ()=> [],
  pairSubstitutesFor: ()=> [],
  productById: (id)=> PRODUCTS.find(p=> p.id === id) || null,
  productVariantLabel: (p, vi)=> (vi == null || !p.variants || !p.variants[vi]) ? p.name
    : `${p.name} — ${Object.values(p.variants[vi].combo).join(' / ')}`,
  variantLabel: (combo)=> Object.values(combo).join(' / '),
  invoiceNumberLabel: ()=> 'INV-1',
};
/* The REAL verb table and the REAL reader of it: a stub here would let
   the brief's blocks fall behind the words the shop actually writes. */
const NAMES = ['briefGroups', 'pairVerb', 'briefSupply'];
const fns = compileScope([
  extractDeclaration(src, 'PAIR_VERBS', 'index.html'),
  extractDeclaration(src, 'TELL_PRICE_FALL_CEILING_PCT', 'index.html'),
  extractDeclaration(src, 'BRIEF_PACK_FIGURE_PCT', 'index.html'),
  extractDeclaration(src, 'TELL_PRICE_MEMORY_DAYS', 'index.html'),
  extractDeclaration(src, 'BRIEF_ROWS_PER_GROUP', 'index.html'),
  ...NAMES.map((n)=> extractFunction(src, n, 'index.html')),
], env, NAMES);

const habit = (productId, variantIdx)=> ({ productId, variantIdx, typicalQty: 10, lastOrder: null });

/* ---- 1. an empty shelf of ours keeps nothing off the list ------------ */
{
  const groups = fns.briefGroups({ id: 'C1' }, [habit('P-WASH', 0), habit('P-SCRW', 0)]);
  eq(groups.dropped.rows.length, 0,
    'neither of Musisi\'s lines is left off -- the suppliers have both');
  eq(groups.dropped.noPrice, 0, 'and nothing is reported as unpriceable');
  const rows = groups.flatMap(g=> g.rows);
  eq(rows.map(r=> `${r.name}${r.variant ? ' — ' + r.variant : ''}`).sort().join(' | '),
    'Washer — M20*30*4 | Wood Screws — 6*50 / 25kgs',
    'both are ON the list, named the way the shop reads them');
  eq(rows.every(r=> r.toOrder === true), true,
    'each carrying the fact that it is not on our shelf');
  eq(rows.every(r=> r.lead === 3), true, 'and the wait the supplier has actually managed');
  eq(rows.every(r=> r.price === 9750), true, 'priced from the registry, which was never the problem');
}

/* ---- 2. what nobody can send is still left off, and says whose ------ */
{
  const marked = fns.briefGroups({ id: 'C1' }, [habit('P-SOFT', null)]);
  eq(marked.dropped.rows.length, 1, 'a supplier-marked product is left off and named');
  eq(marked.dropped.rows[0].why, 'outOfStock', 'under the supplier\'s own reason');
  eq(marked.dropped.rows[0].name, 'Soft Close Mulper (Kirumira, marked 3 days ago)',
    'with the row that carries the mark said out loud');
  eq(marked.dropped.noPrice, 1, 'and counted as a line that cannot be priced, because it cannot');
  eq(marked.flatMap(g=> g.rows).length, 0, 'nothing of it reaches the list');
}

/* ---- 3. what we are holding is not marked to order ------------------- */
{
  const groups = fns.briefGroups({ id: 'C1' }, [habit('P-NAIL', null)]);
  eq(groups.dropped.rows.length, 0, 'a product we are holding is left off nothing');
  const row = groups.flatMap(g=> g.rows)[0];
  eq(!!row, true, 'it goes on the list');
  eq(row.toOrder, false, 'and is not claimed to need ordering in');
}

/* ---- 3b. the shelf spends the cap first ------------------------------ */
{
  /* Five to a block. Six lines, five of them orderable and one on the
     shelf, and the one we can hand over today must survive the cut
     however its own block ranked it. */
  ['P-A','P-B','P-C','P-D','P-E'].forEach((id, i)=>{
    PRODUCTS.push({ id, name: 'Filler ' + i, type: 'simple', unit: 'Pc' });
    shelf.set(id + '::', 0);
  });
  const many = fns.briefGroups({ id: 'C1' },
    ['P-A','P-B','P-C','P-D','P-E'].map(id=> habit(id, null)).concat([habit('P-NAIL', null)]));
  const usual = many.find(g=> g.key === 'usual');
  eq(usual.rows.length, 5, 'the block is still capped at five');
  eq(usual.rows[0].productId, 'P-NAIL', 'and the shelf takes the first place');
  eq(usual.rows.slice(1).every(r=> r.toOrder), true, 'the order book fills the rest');
  PRODUCTS.length = 4;
}

/* ---- 4. the words the owner reads ------------------------------------ */
{
  const leftOff = extractDeclaration(src, 'BRIEF_LEFT_OFF', 'index.html');
  t.check(!/shelfOut/.test(src),
    'an empty shelf of ours is no longer a reason to leave anything off, anywhere');
  t.check(/outOfStock:[^}]*about the SUPPLIER/.test(leftOff),
    'while the supplier mark keeps saying it is about the supplier');
  t.check(/NO SHELF GATE/.test(src), 'the gate that dropped them is gone, and says why');
  t.check(/toOrder: !sup\.onShelf, lead: sup\.lead/.test(src),
    'and every row carries whether it would be ordered in');
  t.check(/on this list[\s\S]{0,60}not on the shelf and would be ordered in/.test(src),
    'which the owner is told before sending, though the picture names no day');
}

process.exit(t.done() ? 1 : 0);
