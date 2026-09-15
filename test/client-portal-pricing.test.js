#!/usr/bin/env node
'use strict';
/*
 * What a customer is charged, and why.
 *
 * Two halves. The first is parity: effectiveMarkupRule, suggestedSelling-
 * Price, tieredUnitPrice, pickBestPriceRow and effectiveTiers are copied
 * verbatim from agent-catalog because Edge Functions here deploy one file
 * at a time, and a copy that drifts means the portal quotes one number
 * and the shop charges another. Compared character for character.
 *
 * The second is the rule the portal adds and nothing else in the app has:
 *
 *   today  = the shop's markup rule applied to this quantity's tier --
 *            the same figure the admin quote builder shows.
 *   held   = what we last charged THIS customer for THIS item.
 *   price  = held, but never below cost and NEVER ABOVE today.
 *
 * That upper bound does not exist in index.html and it has to exist here.
 * There, "the remembered price leads" is advice to a person looking at
 * both numbers who can overrule it. Here it would be an automatic
 * decision to charge a loyal customer more than a stranger, at ten at
 * night, with nobody watching -- on the one screen built to earn their
 * trust. A portal with that in it is worse than a portal with no memory.
 *
 * Run: node test/client-portal-pricing.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('client portal pricing');
const src = read('supabase/functions/client-portal/index.ts');
const agent = read('supabase/functions/agent-catalog/index.ts');

/* ---------- 1. the copied math has not drifted ------------------------ */
{
  ['effectiveMarkupRule', 'suggestedSellingPrice', 'tieredUnitPrice', 'effectiveTiers']
    .forEach((fn) => {
      const a = extractFunction(src, fn, 'client-portal');
      const b = extractFunction(agent, fn, 'agent-catalog');
      t.check(a === b, `${fn}() is identical to agent-catalog's copy`);
    });
  // pickBestPriceRow's comment differs by design (agent-catalog's names
  // rankedPriceRows); the body is what must not drift.
  const strip = (s) => s.replace(/\/\/[^\n]*/g, '').replace(/\s+/g, ' ').trim();
  t.check(strip(extractFunction(src, 'pickBestPriceRow', 'client-portal'))
    === strip(extractFunction(agent, 'pickBestPriceRow', 'agent-catalog')),
    'pickBestPriceRow() has the same body as agent-catalog\'s');

  // The agent's discount vocabulary must NOT have come across. A customer
  // has no discount, and `margin` inside the customer boundary is a
  // variable one edit away from a response key.
  ['computeFloorPrice', 'resolveDiscountPcts', 'buildFloorPriceLadder'].forEach((fn) => {
    t.check(!new RegExp(`function ${fn}\\b`).test(src),
      `${fn}() is deliberately NOT copied — it is an agent concept`);
  });
}

/* ---------- 2. the price rule ----------------------------------------- */
/*
 * TypeScript forms _extract's stripTypes does not cover, all of them in
 * the new functions rather than the copied ones. stripTypes deliberately
 * confines itself to a function's SIGNATURE -- its own comment explains
 * that the parameter rule cannot tell `(a: number)` from an object
 * literal's `{ cost: costNum }` -- so anything typed inside a body is
 * left alone, and so is a parameter type that does not start with a
 * letter. Cleared here rather than widening stripTypes, which every
 * other test depends on behaving exactly as it does; the same call
 * agent-catalog.test.js makes for its own two forms.
 */
const detype = (s) => s
  // held: { price: number; at: string } | null   -- an inline object type
  // in a parameter; stripTypes' rule needs the type to start with a letter
  .replace(/([(,]\s*)([A-Za-z_$][\w$]*)\s*:\s*\{[^{}]*\}(\s*\|\s*null)?(?=\s*[,)])/g, '$1$2')
  // ): "in-stock" | "to-order" | "out" {   -- a union of string literals
  .replace(/\)\s*:\s*"[^{]*?(?=\{)/g, ') ')
  // ... as { minQty: number; unitPrice: number }[]
  .replace(/\s+as\s+\{[^{}]*\}\[\]/g, '')
  .replace(/new Set<[^>]*>\(/g, 'new Set(')
  // const out: Record<string, {...}> = {}   -- a typed local, inside the body
  .replace(/\b(const|let)\s+([\w$]+)\s*:\s*Record<[^=]*?>\s*=/g, '$1 $2 =')
  // function (it: any) {   -- a typed parameter on an inner function
  .replace(/function \(([\w$]+)\s*:\s*[\w$\[\]]+\)/g, 'function ($1)')
  // held!.price   -- a non-null assertion, which is a type-level claim and
  // nothing at runtime
  .replace(/!\./g, '.');

const fns = compileScope(
  // normalisePhone rides along because rememberedPrices calls it: the
  // phone match IS the "whose memory is this" rule, and stubbing it would
  // mean section 4 below tested a stub rather than the shipped matcher.
  ['normalisePhone', 'effectiveMarkupRule', 'suggestedSellingPrice', 'tieredUnitPrice', 'pickBestPriceRow',
   'effectiveTiers', 'quotableRow', 'availabilityOf', 'rememberedPrices',
   'customerUnitPrice', 'customerPriceLadder']
    .map(n => detype(extractFunction(src, n, 'client-portal'))),
  {}, ['customerUnitPrice', 'customerPriceLadder', 'rememberedPrices', 'quotableRow', 'availabilityOf'],
  { typescript: true },
);

const product = {
  name: 'Iron sheets', variants: null,
  wholesale_markup_type: 'percent', wholesale_markup_value: 10,
  retail_markup_type: 'percent', retail_markup_value: 25,
};
const row = {
  variant_idx: null, wholesale: 40000, retail: 40000, pack_qty: 12,
  unit: 'sheet', pack_unit: 'bundle', tiers: null, out_of_stock: false,
};

{
  // Retail below a pack, wholesale at or above it.
  const one = fns.customerUnitPrice(product, row, 1, null, null);
  t.check(one.unitPrice === 50000, `one sheet carries the retail rule (got ${one.unitPrice})`);
  const dozen = fns.customerUnitPrice(product, row, 12, null, null);
  t.check(dozen.unitPrice === 44000, `a full bundle carries the wholesale rule (got ${dozen.unitPrice})`);
  t.check(one.packQty === 12 && one.unit === 'sheet' && one.packUnit === 'bundle',
    'and the packaging travels with it, so a screen can say what a unit is');

  // Cost is returned to the caller and is what the floor is measured
  // against -- the response builders are what must not pass it on.
  t.check(one.cost === 40000, 'cost comes back for the floor test');

  // No markup rule anywhere: the item prices at cost. A shop that has not
  // said what it makes on something has not said what it charges either.
  const bare = fns.customerUnitPrice({ name: 'No rule' }, row, 1, null, null);
  t.check(bare.unitPrice === 40000, `a ruleless product prices at cost (got ${bare.unitPrice})`);
  const withDflt = fns.customerUnitPrice({ name: 'No rule' }, row, 1, { retailType: 'percent', retailValue: 20 }, null);
  t.check(withDflt.unitPrice === 48000, `unless the shop default says otherwise (got ${withDflt.unitPrice})`);
}

/* ---------- 3. the remembered price, and its two bounds --------------- */
{
  // Below today's price: honoured, and said so.
  const held = fns.customerUnitPrice(product, row, 1, null, { price: 47000, at: '2026-07-04' });
  t.check(held.unitPrice === 47000 && held.heldFrom === '2026-07-04',
    `a price held from July leads over today's (got ${held.unitPrice})`);

  // Below cost: refused. No promise is worth selling at a loss.
  const stale = fns.customerUnitPrice(product, row, 1, null, { price: 38000, at: '2026-01-02' });
  t.check(stale.unitPrice === 50000 && stale.heldFrom === null,
    `a held price under today's cost is dropped (got ${stale.unitPrice})`);
  // And dropped SILENTLY. Saying "the price we held for you no longer
  // covers our cost" tells a customer where the shop's cost now sits,
  // which is the one thing this whole boundary exists to withhold. The
  // number shown is the real number; that is where the honesty lives.
  t.check(!/no longer covers|below cost|under cost/i.test(src),
    'without announcing why, which would name the shop\'s cost position');

  // ABOVE today's price: refused. This is the bound index.html does not
  // have, and the reason this function exists rather than a copy of
  // lastPriceToClient.
  const dear = fns.customerUnitPrice(product, row, 1, null, { price: 60000, at: '2026-02-02' });
  t.check(dear.unitPrice === 50000 && dear.heldFrom === null,
    `a held price ABOVE today's is never charged (got ${dear.unitPrice})`);

  // The case that makes it matter: a memory from a small retail order,
  // then a bundle. Holding 47,000 against a 44,000 wholesale price would
  // quietly charge a returning customer more for buying MORE.
  const bulk = fns.customerUnitPrice(product, row, 12, null, { price: 47000, at: '2026-07-04' });
  t.check(bulk.unitPrice === 44000,
    `ordering a full bundle still gets the bundle price (got ${bulk.unitPrice})`);

  t.check(fns.customerUnitPrice(product, row, 1, null, { price: 50000, at: '2026-07-04' }).heldFrom === '2026-07-04',
    'a held price exactly equal to today still reads as held, which is true and worth saying');
}

/* ---------- 4. whose memory it is ------------------------------------- */
/*
 * The worst bug this project can ship is one customer seeing another's
 * price. saved_quotes carries client_name and client_phone as text and no
 * customer id, so the match is on the normalised phone -- never the name,
 * which would hand "Nakato Grace" the history of "Nakato Grace Ltd".
 */
{
  const quotes = [
    { client_phone: '0772418903', date: '2026-07-04', voided: false,
      payload: { items: [{ productId: 'P1', variantIdx: null, sellPrice: 47000 }] } },
    { client_phone: '+256772418903', date: '2026-08-01', voided: false,
      payload: { items: [{ productId: 'P1', variantIdx: null, sellPrice: 46000 }] } },
    { client_phone: '0700111222', date: '2026-08-20', voided: false,
      payload: { items: [{ productId: 'P1', variantIdx: null, sellPrice: 31000 }] } },
    { client_phone: '0772418903', date: '2026-08-30', voided: true,
      payload: { items: [{ productId: 'P1', variantIdx: null, sellPrice: 1 }] } },
  ];
  const mine = fns.rememberedPrices(quotes, '772418903');
  t.check(mine['P1::'] && mine['P1::'].price === 46000,
    `the most recent of MY orders wins (got ${JSON.stringify(mine['P1::'])})`);
  t.check(mine['P1::'] && mine['P1::'].at === '2026-08-01', 'and carries the date it was set');
  // 0772418903 and +256772418903 are one person; 0700111222 is not.
  t.check(!Object.values(mine).some(v => v.price === 31000),
    'somebody else\'s price is never in my memory');
  t.check(!Object.values(mine).some(v => v.price === 1),
    'and a voided order is not a memory at all');
  t.check(Object.keys(fns.rememberedPrices(quotes, '')).length === 0,
    'a customer with no usable number remembers nothing, rather than everything');

  // A line with no sellPrice has no memory. quoteItemSellPrice in the
  // admin app falls back to deriving one from `price`, which is cost --
  // and re-deriving anything from cost is the code path that must not
  // exist inside this boundary.
  const noSell = fns.rememberedPrices(
    [{ client_phone: '0772418903', date: '2026-08-01', voided: false,
       payload: { items: [{ productId: 'P9', variantIdx: null, price: 40000 }] } }], '772418903');
  t.check(Object.keys(noSell).length === 0,
    'a line with only a cost on it yields no remembered price');

  // Variants are separate memories, or a red sheet is priced at a blue
  // one's number.
  const byVariant = fns.rememberedPrices(
    [{ client_phone: '0772418903', date: '2026-08-01', voided: false,
       payload: { items: [
         { productId: 'P2', variantIdx: 0, sellPrice: 1000 },
         { productId: 'P2', variantIdx: 1, sellPrice: 2000 },
       ] } }], '772418903');
  /* Guarded, not indexed-and-dereferenced. Collapsing the variant out of
     the key -- `P2::` for every variant of P2 -- made this line throw a
     TypeError, and a thrown test prints a stack trace instead of a
     sentence and exits before any later check runs. _extract's own header
     makes the point about tests that silently skip; a test that crashes
     is the same failure wearing a louder coat. */
  t.check(byVariant['P2::0'] && byVariant['P2::0'].price === 1000
    && byVariant['P2::1'] && byVariant['P2::1'].price === 2000,
    `each variant remembers its own price (keys: ${Object.keys(byVariant).join(', ') || 'none'})`);
}

/* ---------- 5. the ladder --------------------------------------------- */
{
  const tiered = { ...row, tiers: [{ minQty: 12, price: 38000 }, { minQty: 60, price: 36000 }] };
  const ladder = fns.customerPriceLadder(product, tiered, null, null);
  t.check(ladder.length === 3 && ladder[0] && ladder[0].minQty === 1,
    `every breakpoint is a rung and qty 1 always is (${JSON.stringify(ladder.map(r => r.minQty))})`);
  const keys = [...new Set(ladder.flatMap(r => Object.keys(r)))].sort();
  t.check(JSON.stringify(keys) === JSON.stringify(['minQty', 'unitPrice']),
    `a rung carries a quantity and a price and nothing else (${keys.join(', ')})`);
  t.check(ladder.every(r => r.unitPrice > 0), 'every rung is priced');
  // Falling, or the "cheaper by the bag" line on the catalogue is a lie.
  t.check(ladder.length === 3 && ladder[2].unitPrice < ladder[0].unitPrice,
    `buying more costs less per unit (${JSON.stringify(ladder.map(r => r.unitPrice))})`);

  // A row with no tiers of its own still describes its real prices.
  const legacy = fns.customerPriceLadder(product, row, null, null);
  t.check(legacy.length === 2 && legacy[0].minQty === 1 && legacy[1].minQty === 12,
    `a row with flat prices synthesises its two rungs (${JSON.stringify(legacy.map(r => r.minQty))})`);
}

/* ---------- 6. what the shop has, and has not ------------------------- */
{
  const out = { ...row, out_of_stock: true };
  t.check(fns.quotableRow([out]) != null,
    'an item that is out of stock can still be quoted — it stays on the shelf with a price');
  t.check(fns.quotableRow([]) === null, 'an item with no price row cannot');
  const cheapInStock = { ...row, wholesale: 30000 };
  const preferred = fns.quotableRow([out, cheapInStock]);
  t.check(preferred && preferred.wholesale === 30000,
    'but an in-stock row is always preferred to an out-of-stock one');

  t.check(fns.availabilityOf([row], 5) === 'in-stock', 'stock on the shelf is in stock');
  t.check(fns.availabilityOf([row], 0) === 'to-order', 'nothing on the shelf but a live supplier row is to-order');
  t.check(fns.availabilityOf([out], 0) === 'out', 'neither is out');
  t.check(fns.availabilityOf([], 0) === 'out', 'and so is an item with no prices at all');

  // No dates. A delivery date on a line this shop does not hold is a
  // promise made with somebody else's lorry.
  const words = ['in-stock', 'to-order', 'out'];
  t.check(words.every(w => new RegExp(`"${w}"`).test(src)),
    'availability is three words');
  t.check(!/days?\b[^\n]*(stock|deliver|arrive)|back in \d/i.test(
    src.slice(src.indexOf('function availabilityOf'), src.indexOf('function rememberedPrices'))),
    'and none of them is a date');
}

/* ---------- 7. a price needs a session -------------------------------- */
{
  const noComments = src.replace(/\/\*[\s\S]*?\*\//g, '')
    .split(/\r?\n/).map(l => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');
  const block = noComments.slice(noComments.indexOf('action === "catalogue" || action === "price"'));
  const guard = block.slice(0, block.indexOf('PRICE_COLS'));
  t.check(/sessionAccount\(shopId, String\(body\.token \?\? ""\)\)/.test(guard)
    && /if \(!session\) return json\(\{ error: "Sign in again" \}, 401\)/.test(guard),
    'no price is computed before a session is proved — the gate the whole strategy rests on');
  // Over the whole block, not the guard slice: app_settings is not IN the
  // guard, so an indexOf against it returns -1 and the comparison passes
  // or fails for reasons that have nothing to do with ordering.
  ['app_settings', 'from("prices")', 'from("products")'].forEach((later) => {
    t.check(block.indexOf('sessionAccount') < block.indexOf(later) && block.includes(later),
      `and ${later} is not read until after it`);
  });
}

process.exit(t.done() ? 1 : 0);
