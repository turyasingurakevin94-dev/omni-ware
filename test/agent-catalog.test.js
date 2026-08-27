#!/usr/bin/env node
'use strict';
/*
 * agent-catalog -- what an agent is allowed to see.
 *
 * Agents are deliberately not shop_members (0012_sales_agents.sql), so they
 * have no RLS access to products or prices at all. This function reads both
 * with the service-role key and hands back a redacted view. Redaction is
 * the whole job, and it was the one thing with no test: the review found
 * the pricing correct, the authorization correct, and the parity with
 * agent-submit-order already enforced by tier-pricing-parity -- but nothing
 * stopped a future edit adding `cost` to a response.
 *
 * What must never reach an agent is raw supplier cost and supplier
 * identity. `ourPrice` deliberately may: it is the shop's own markup-rule
 * price, the same figure the admin quote builder shows, and the agent app
 * needs it as the reference point for pricing guidance.
 *
 * Run: node test/agent-catalog.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('agent catalog');
const src = read('supabase/functions/agent-catalog/index.ts');
const strip = (s) => s.split(/\r?\n/).map(l => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');
const code = strip(src);

/* ---------- 1. cost is stripped, and provably ------------------------- */
{
  t.check(/const \{ cost, \.\.\.safeResult \} = result;/.test(code),
    'the price action destructures cost away before responding');
  t.check(/return json\(\{ ok: true, available: true, \.\.\.safeResult, tiers \}\)/.test(code),
    'and responds with the remainder, not the original object');
  t.check(!/\.\.\.result[,}\s]/.test(code),
    'the un-redacted result object is never spread into a response');
}

/* ---------- 2. the ladder carries no cost either ---------------------- */
/*
 * buildFloorPriceLadder calls computeFloorPrice once per rung, and that
 * returns cost. If a rung ever passed the whole object through, cost would
 * travel to the agent alongside every breakpoint.
 */
{
  // Two TypeScript forms _extract's stripTypes does not cover, both in
  // buildFloorPriceLadder: a type-predicate filter, whose annotation is not
  // at end-of-line where the return-type rule looks, and an explicit
  // generic on new Set. Cleared here rather than widening stripTypes for
  // every other test that depends on its current behaviour.
  const detype = (s) => s
    .replace(/\(\s*(\w+)\s*\)\s*:\s*\w+\s+is\s+\{[^}]*\}\s*=>/g, '($1) =>')
    .replace(/new Set<[^>]*>\(/g, 'new Set(');

  let fns = null, err = null;
  try {
    fns = compileScope(
      ['effectiveMarkupRule', 'suggestedSellingPrice', 'tieredUnitPrice', 'computeFloorPrice', 'effectiveTiers', 'buildFloorPriceLadder']
        .map(n => detype(extractFunction(src, n, 'agent-catalog'))),
      {}, ['buildFloorPriceLadder', 'computeFloorPrice'], { typescript: true },
    );
  } catch (e) { err = e; }
  t.check(!!fns, `the ladder builder compiles${err ? ` (${err.message})` : ''}`);

  if (fns) {
    const product = { name: 'Nails', wholesale_markup_type: 'percent', wholesale_markup_value: 10, retail_markup_type: 'percent', retail_markup_value: 25 };
    const priceRow = { wholesale: 1000, retail: 1200, pack_qty: 12, unit: 'pc', pack_unit: 'box', variant_idx: null, tiers: [{ minQty: 12, price: 900 }, { minQty: 60, price: 850 }] };

    const ladder = fns.buildFloorPriceLadder(product, priceRow, 0, 0);
    t.check(Array.isArray(ladder) && ladder.length > 0, `the ladder has rungs (${ladder.length})`);

    const keys = [...new Set(ladder.flatMap(r => Object.keys(r)))].sort();
    t.check(JSON.stringify(keys) === JSON.stringify(['minQty', 'tier', 'unitPrice']),
      `each rung carries only minQty/unitPrice/tier (got ${keys.join(', ')})`);
    t.check(!ladder.some(r => 'cost' in r), 'no rung carries cost');

    // The thing the redaction protects: computeFloorPrice really does hold
    // cost, so stripping it is doing work rather than being decorative.
    const raw = fns.computeFloorPrice(product, priceRow, 1, 0, 0);
    t.check(raw && 'cost' in raw, 'computeFloorPrice does return cost, which is what has to be stripped');
    t.check(raw && 'ourPrice' in raw, 'and ourPrice, which is allowed through on purpose');

    // qty 1 is always a rung -- the bug that let an order of 5 be shown the
    // qty-12 volume price while submit charged the flat one.
    t.check(ladder[0].minQty === 1, `the ladder starts at qty 1 (${ladder[0].minQty})`);

    // The shop default rule, as the optional LAST argument (older callers
    // and fixtures pass nothing and get the old behavior byte for byte).
    const bare = { name: 'No rule Nails' };
    const withDflt = fns.computeFloorPrice(bare, priceRow, 1, 0, 0, { retailType: 'percent', retailValue: 20 });
    t.check(!!withDflt && withDflt.ourPrice === 1440 && withDflt.floorPrice === 1440,
      `a ruleless product carries the shop default margin (got ${JSON.stringify(withDflt)})`);
    const noDflt = fns.computeFloorPrice(bare, priceRow, 1, 0, 0);
    t.check(noDflt.ourPrice === noDflt.cost,
      'and with no default handed in, a ruleless product still floors at cost');
  }

  /* The plumbing, pinned: the default is read once from the same presets
     blob the agent discounts ride in, and passes into EVERY pricing call
     -- the price action, both list probes, and both ladders. A call that
     forgets it would quietly show the old cost-floor for ruleless items. */
  t.check(/const defaultMarkup = presets\.defaultMarkup \|\| null;/.test(code),
    'the default is derived where the presets land');
  t.check(code.includes('computeFloorPrice(product, best, Number(qty), discountWholesalePct, discountRetailPct, defaultMarkup)')
    && code.includes('computeFloorPrice(p, best, 1, discountWholesalePct, discountRetailPct, defaultMarkup)')
    && code.includes('computeFloorPrice(p, best, Number(best.pack_qty), discountWholesalePct, discountRetailPct, defaultMarkup)')
    && code.includes('buildFloorPriceLadder(product, best, discountWholesalePct, discountRetailPct, defaultMarkup)')
    && code.includes('buildFloorPriceLadder(p, best, discountWholesalePct, discountRetailPct, defaultMarkup)'),
    'and threaded into every pricing call — price, both list probes, both ladders');
}

/* ---------- 3. the list response is an explicit whitelist ------------- */
/*
 * Structural, because the list action builds its object literal inline.
 * Named fields rather than a spread is what keeps a new column on
 * `products` from silently becoming agent-visible.
 */
{
  const listBlock = code.slice(code.indexOf('action === "list"'), code.indexOf('if (action === "promotions")'));
  ['cost', 'supplier_id', 'supplierId', 'supplierName', 'wholesale', 'retail', 'margin'].forEach(field => {
    t.check(!new RegExp(`\\b${field}:`).test(listBlock),
      `the list response does not expose ${field}`);
  });
  t.check(/floorPrice: priced\?\.floorPrice \?\? null/.test(listBlock),
    'it exposes the floor price, which is what the agent is quoted');
  t.check(/ourPrice: priced\?\.ourPrice \?\? null/.test(listBlock),
    'and ourPrice, deliberately');
  t.check(!/\.\.\.p[,}\s]/.test(listBlock),
    'the raw product row is never spread into the response');
}

/* ---------- 4. promotions likewise ------------------------------------ */
{
  const promoBlock = code.slice(code.indexOf('action === "promotions"'));
  t.check(/\.select\("id, product_id, variant_idx, bonus_type, bonus_value, starts_at, ends_at"\)/.test(promoBlock),
    'promotions selects named columns rather than *');
  t.check(/\.select\("id, name, image, category, variants"\)/.test(promoBlock),
    'and the product lookup behind it does too');
  t.check(!/\.\.\.pr[,}\s]/.test(promoBlock),
    'the raw promotion row is never spread into the response');

  // Scope: a Browse badge must never imply an item is earnable before it starts.
  const live = (starts, ends, today) => {
    const notEnded = !ends || ends >= today;
    const started = !starts || starts <= today;
    return started && notEnded;
  };
  t.check(live(null, null, '2026-08-02') === true, 'an open-ended promotion is live');
  t.check(live('2026-09-01', null, '2026-08-02') === false, 'one that has not started yet is not');
  t.check(live('2026-08-02', '2026-08-02', '2026-08-02') === true, 'one starting and ending today is');
  t.check(live(null, '2026-08-01', '2026-08-02') === false, 'one that ended yesterday is not');
}

/* ---------- 5. authorization ------------------------------------------ */
{
  t.check(/if \(!authHeader\) return json\(\{ error: "Missing Authorization header" \}, 401\)/.test(code),
    'a request with no Authorization header is refused');
  t.check(/rpc\("is_shop_agent", \{ p_shop_id: shopId \}\)/.test(code),
    'agent identity comes from the database');
  t.check(/if \(!isAgent\) return json\(\{ error: "Not an agent of this shop" \}, 403\)/.test(code),
    'a non-agent is refused');
  t.check(code.indexOf('is_shop_agent') < code.indexOf('SERVICE_ROLE_KEY)'),
    'and that happens before the service-role client is created');

  // Every read is shop-scoped; a valid agent of shop A must not be able to
  // name shop B's product id and get it priced.
  const reads = (code.match(/\.from\("(products|prices|app_settings|agent_promotions)"\)[\s\S]{0,200}?;/g) || []);
  const unscoped = reads.filter(r => !/\.eq\("shop_id", shopId\)/.test(r));
  t.check(unscoped.length === 0,
    `every catalogue read is scoped to the caller's shop (${reads.length} reads, ${unscoped.length} unscoped)`);
}

process.exit(t.done() ? 1 : 0);
