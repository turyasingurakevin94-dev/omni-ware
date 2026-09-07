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
 * fine, it is just not there today, so it is counted apart.
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
  briefSupply: ()=> ({ shelf: 0, onShelf: false, supplier: true, lead: 3, can: true, how: 'order' }),
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
const NAMES = ['briefGroups', 'pairVerb'];
const fns = compileScope([
  extractDeclaration(src, 'PAIR_VERBS', 'index.html'),
  extractDeclaration(src, 'TELL_PRICE_FALL_CEILING_PCT', 'index.html'),
  extractDeclaration(src, 'BRIEF_PACK_FIGURE_PCT', 'index.html'),
  extractDeclaration(src, 'TELL_PRICE_MEMORY_DAYS', 'index.html'),
  extractDeclaration(src, 'BRIEF_ROWS_PER_GROUP', 'index.html'),
  ...NAMES.map((n)=> extractFunction(src, n, 'index.html')),
], env, NAMES);

const habit = (productId, variantIdx)=> ({ productId, variantIdx, typicalQty: 10, lastOrder: null });

/* ---- 1. an empty shelf is reported as an empty shelf ----------------- */
{
  const groups = fns.briefGroups({ id: 'C1' }, [habit('P-WASH', 0), habit('P-SCRW', 0)]);
  const rows = groups.dropped.rows;
  eq(rows.length, 2, 'both of their lines are named rather than dropped');
  eq(rows.every(r=> r.why === 'shelfOut'), true,
    'and both say the SHELF is empty, not that a supplier is out');
  eq(rows.some(r=> r.why === 'outOfStock'), false,
    'no healthy Price Registry row is reported as marked out of stock');
  eq(rows.map(r=> r.name).sort().join(' | '),
    'Washer — M20*30*4 | Wood Screws — 6*50 / 25kgs',
    'each is named the way the shop reads it');
  eq(groups.dropped.shelfOut, 2, 'counted as shelf-empty');
  eq(groups.dropped.noPrice, 0, 'and never as lines that cannot be priced -- these price fine');
  eq(groups.dropped.noRule, 0, 'nor as a missing markup rule');
}

/* ---- 2. a real supplier mark still reads as one ---------------------- */
{
  /* Empty shelf AND marked out at the supplier. The shelf is what the
     owner meets first, and it is the one thing they can put right by
     counting, so that is what they are told. */
  const both = fns.briefGroups({ id: 'C1' }, [habit('P-SOFT', null)]);
  eq(both.dropped.rows.length, 1, 'the marked product is named too');
  eq(both.dropped.rows[0].why, 'shelfOut',
    'where the shelf is empty as well, the shelf is what the owner is sent to');

  /* On the shelf, and the supplier is out: now the registry really is
     the thing to look at, and the row that carries the mark is named. */
  shelf.set('P-SOFT::', 6);
  const marked = fns.briefGroups({ id: 'C1' }, [habit('P-SOFT', null)]);
  shelf.set('P-SOFT::', 0);
  eq(marked.dropped.rows.length, 1, 'a supplier-marked product is left off and named');
  eq(marked.dropped.rows[0].why, 'outOfStock', 'under the supplier\'s own reason');
  eq(marked.dropped.rows[0].name, 'Soft Close Mulper (Kirumira, marked 3 days ago)',
    'with the row that carries the mark said out loud');
  eq(marked.dropped.noPrice, 1, 'and counted as a line that cannot be priced, because it cannot');
  eq(marked.dropped.shelfOut, 0, 'never as an empty shelf -- ours has six on it');
}

/* ---- 3. something on the shelf is still just a row ------------------- */
{
  const groups = fns.briefGroups({ id: 'C1' }, [habit('P-NAIL', null)]);
  eq(groups.dropped.rows.length, 0, 'a product we are holding is left off nothing');
  eq(groups.length > 0, true, 'it goes on the list');
}

/* ---- 4. the words the owner reads ------------------------------------ */
{
  const leftOff = extractDeclaration(src, 'BRIEF_LEFT_OFF', 'index.html');
  t.check(/shelfOut:\s*\{/.test(leftOff), 'the empty shelf has words of its own');
  t.check(/shelfOut:[^}]*none of our own on the shelf/.test(leftOff),
    'and they say whose stock is missing');
  t.check(/shelfOut:[^}]*OUR count, not a supplier mark/.test(leftOff),
    'and say plainly that the Price Registry is not the thing to go and fix');
  t.check(/outOfStock:[^}]*about the SUPPLIER/.test(leftOff),
    'while the supplier mark keeps saying it is about the supplier');
  t.check(/nShelf[\s\S]{0,400}at a zero on our own shelf/.test(src),
    'the empty brief panel counts the two apart');
  t.check(/allShelf[\s\S]{0,200}Nothing of theirs is on the shelf today/.test(src),
    'and the picture builder does not claim they cannot be priced');
}

process.exit(t.done() ? 1 : 0);
