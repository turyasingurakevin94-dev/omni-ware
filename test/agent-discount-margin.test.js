#!/usr/bin/env node
'use strict';
/*
 * An agent's discount is a share of the MARGIN, not a cut off the price.
 *
 * It used to be `ourPrice * (1 - pct/100)`, clamped up to cost. That is
 * wrong in a way that hides itself: on an item carrying a 10% markup, a
 * 50% discount asks for five times the whole margin, so the clamp fired
 * and the agent got the item at cost -- every one of those sales made
 * nothing, and the shop's own setting said "50%", not "all of it". Worse,
 * the same 50% meant something different on every product, because what
 * it took depended on the markup it happened to be eating.
 *
 * The rule now: agentPrice = cost + margin * (1 - pct/100). 50% is half
 * the margin on every product. 100% is all of it, landing exactly on
 * cost. Below cost is not reachable -- which is the whole point, and is
 * asserted here as a property over a sweep rather than at a few chosen
 * points.
 *
 * Both copies of the math are run, because agent-catalog is what an agent
 * is SHOWN and agent-submit-order is what they are CHARGED. tier-pricing-
 * parity compares them as text; this compares the numbers they produce.
 *
 * Run: node test/agent-discount-margin.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('agent discount as a share of margin');

const HELPERS = ['effectiveMarkupRule', 'suggestedSellingPrice', 'tieredUnitPrice', 'computeFloorPrice', 'resolveDiscountPcts'];
const load = (file, label) => compileScope(
  HELPERS.map((n) => extractFunction(read(file), n, label)),
  {}, ['computeFloorPrice', 'resolveDiscountPcts'], { typescript: true },
);

const shown = load('supabase/functions/agent-catalog/index.ts', 'agent-catalog');
const charged = load('supabase/functions/agent-submit-order/index.ts', 'agent-submit-order');

const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${got}, want ${want})`);

// 10% on wholesale, 25% on retail -- two different margins on one product,
// so a discount that is a share of margin has to give different SHILLINGS
// on each while giving the same SHARE.
const product = {
  name: 'Elephant drawer lock',
  wholesale_markup_type: 'percent', wholesale_markup_value: 10,
  retail_markup_type: 'percent', retail_markup_value: 25,
};
const row = { wholesale: 1000, retail: 1200, pack_qty: 12, unit: 'pc', pack_unit: 'box', variant_idx: null, tiers: [] };

/* ---------- 1. the share it says it is -------------------------------- */
{
  // qty 1 -> retail: cost 1200, our price 1500, margin 300.
  eq(shown.computeFloorPrice(product, row, 1, 0, 0).floorPrice, 1500,
    'no discount leaves the agent paying our own price');
  eq(shown.computeFloorPrice(product, row, 1, 0, 50).floorPrice, 1350,
    'half the margin off a 300 margin is 150, not half the price');
  eq(shown.computeFloorPrice(product, row, 1, 0, 25).floorPrice, 1425,
    'a quarter of it is 75');
  eq(shown.computeFloorPrice(product, row, 1, 0, 100).floorPrice, 1200,
    'the whole margin lands exactly on cost');

  // qty 12 -> wholesale: cost 1000, our price 1100, margin 100.
  eq(shown.computeFloorPrice(product, row, 12, 50, 0).floorPrice, 1050,
    'the same 50% on the thinner wholesale margin gives away 50, not 150');
  eq(shown.computeFloorPrice(product, row, 12, 100, 0).floorPrice, 1000,
    'and 100% of it still only reaches cost');
}

/* ---------- 2. the same percentage means the same thing everywhere ---- */
/*
 * The property the old scheme could not offer. Under "% off the price",
 * 50% took the entire margin on a 10% markup and two thirds of it on a
 * 25% markup -- the setting did not describe what was being given away
 * until you knew the markup it was applied to.
 */
{
  const markups = [5, 10, 25, 60, 200];
  const pcts = [0, 10, 40, 50, 75, 100];
  let drift = 0, worst = null;
  markups.forEach((m) => {
    const p = { retail_markup_type: 'percent', retail_markup_value: m };
    pcts.forEach((pct) => {
      const r = shown.computeFloorPrice(p, row, 1, 0, pct);
      const margin = r.ourPrice - r.cost;
      const kept = (r.floorPrice - r.cost) / margin;
      if (Math.abs(kept - (1 - pct / 100)) > 1e-9) { drift++; worst = `markup ${m}%, discount ${pct}%: kept ${kept}`; }
    });
  });
  t.check(drift === 0,
    `the shop keeps exactly (100 - pct)% of its margin at every markup (${markups.length * pcts.length} combinations${worst ? `, e.g. ${worst}` : ''})`);

  // Stated the other way round, as the regression: it must NOT be a
  // percentage off the price. On a 25% markup those two differ by a lot.
  const r = shown.computeFloorPrice(product, row, 1, 0, 50);
  t.check(r.floorPrice !== r.ourPrice * 0.5,
    'a 50% discount is not half the selling price');
  t.check(r.floorPrice > r.cost,
    'and does not collapse onto cost the way the old formula did once the clamp caught it');
}

/* ---------- 3. never below cost, whatever is on file ------------------ */
/*
 * The rule the shop actually asked for. Swept rather than sampled,
 * including percentages no UI can produce -- both columns are plain
 * numeric with no constraint, so a figure written straight into the
 * database reaches computeFloorPrice without passing any clamp.
 */
{
  const rows = [
    { name: 'flat', wholesale: 1000, retail: 1200, pack_qty: 12, tiers: [] },
    { name: 'volume ladder', wholesale: 1000, retail: 1200, pack_qty: 12, tiers: [{ minQty: 12, price: 900 }, { minQty: 60, price: 850 }] },
    { name: 'wholesale only', wholesale: 1000, retail: null, pack_qty: 12, tiers: [] },
  ];
  const products = [
    { name: 'percent both', wholesale_markup_type: 'percent', wholesale_markup_value: 10, retail_markup_type: 'percent', retail_markup_value: 25 },
    { name: 'fixed wholesale', wholesale_markup_type: 'fixed', wholesale_markup_value: 6000, retail_markup_type: 'percent', retail_markup_value: 25 },
    { name: 'no markup rule at all' },
  ];
  const pcts = [0, 1, 50, 99, 100, 150, 1000, -20];
  const qtys = [1, 5, 11, 12, 13, 60, 100];

  let below = 0, cases = 0, example = null;
  products.forEach((p) => rows.forEach((r) => pcts.forEach((pct) => qtys.forEach((qty) => {
    const res = shown.computeFloorPrice(p, r, qty, pct, pct);
    if (!res) return;
    cases++;
    if (res.floorPrice < res.cost) { below++; example = `${p.name} / ${r.name} / ${pct}% / qty ${qty}: ${res.floorPrice} < ${res.cost}`; }
  }))));
  t.check(cases > 0 && below === 0,
    `no agent price falls below cost in ${cases} combinations${example ? ` (e.g. ${example})` : ''}`);

  // A percentage over 100 is the case that makes the clamp real rather
  // than decorative: the formula alone would go under.
  const over = shown.computeFloorPrice(product, row, 1, 0, 150);
  eq(over.floorPrice, over.cost, 'a 150% figure written straight into the column stops at cost');

  // No markup rule means no margin to share, so the discount finds
  // nothing -- an agent pays cost rather than getting an accidental gift.
  const bare = shown.computeFloorPrice({ name: 'nothing set' }, row, 1, 0, 50);
  eq(bare.floorPrice, bare.cost, 'a product with no markup rule hands over nothing');
  eq(bare.ourPrice, bare.cost, 'because our own price is cost there too');
}

/* ---------- 4. shown price == charged price --------------------------- */
{
  let mismatches = 0, first = null, compared = 0;
  [0, 10, 40, 50, 100, 150].forEach((pct) => [1, 5, 12, 60].forEach((qty) => {
    const a = shown.computeFloorPrice(product, row, qty, pct, pct);
    const b = charged.computeFloorPrice(product, row, qty, pct, pct);
    compared++;
    if (a.floorPrice !== b.floorPrice) { mismatches++; first = first || `${pct}% at qty ${qty}: shown ${a.floorPrice}, charged ${b.floorPrice}`; }
  }));
  t.check(mismatches === 0,
    `agent-catalog and agent-submit-order price identically (${compared} combinations${first ? `, first difference ${first}` : ''})`);
}

/* ---------- 4b. the shop default rule reaches the agents app ---------- */
/*
 * The admin app's shop-wide default (app_settings.presets.defaultMarkup)
 * is threaded into both copies as an ARGUMENT — never module state;
 * requests interleave in one isolate. A ruleless product carries the
 * shop's margin again, a product's own rule still wins, and the floor
 * still never goes below cost.
 */
{
  const dflt = { retailType: 'percent', retailValue: 20, wholesaleType: 'fixed', wholesaleValue: 6000 };
  const bare = { name: 'nothing set' };

  const d1 = shown.computeFloorPrice(bare, row, 1, 0, 0, dflt);
  eq(d1.ourPrice, 1440, 'a ruleless product now carries the default margin (1200 + 20%)');
  eq(d1.floorPrice, 1440, 'and at 0% discount the agent pays the full default price');
  const d2 = shown.computeFloorPrice(bare, row, 1, 0, 50, dflt);
  eq(d2.floorPrice, 1320, 'a 50% share hands over half of the DEFAULT margin');
  const dw = shown.computeFloorPrice(bare, row, 12, 0, 0, dflt);
  eq(dw.floorPrice, 1500, 'a fixed wholesale default spreads across the pack (1000 + 6000/12)');

  const own = shown.computeFloorPrice(product, row, 1, 0, 0, dflt);
  const ownNo = shown.computeFloorPrice(product, row, 1, 0, 0);
  eq(own.floorPrice, ownNo.floorPrice, 'a product\'s own rule wins — the default changes nothing for it');

  const clamped = shown.computeFloorPrice(bare, row, 1, 0, 150, dflt);
  eq(clamped.floorPrice, clamped.cost, 'and the never-below-cost clamp holds under the default too');

  let dMismatches = 0, dCompared = 0;
  [0, 40, 100].forEach((pct) => [1, 5, 12, 60].forEach((qty) => {
    const a = shown.computeFloorPrice(bare, row, qty, pct, pct, dflt);
    const b = charged.computeFloorPrice(bare, row, qty, pct, pct, dflt);
    dCompared++;
    if (a.floorPrice !== b.floorPrice) dMismatches++;
  }));
  t.check(dCompared === 12 && dMismatches === 0,
    'the shown default price and the charged default price agree in every combination');
  t.check(read('supabase/functions/agent-submit-order/index.ts')
    .includes('computeFloorPrice(product, best, Number(it.qty), discountWholesalePct, discountRetailPct, defaultMarkup)'),
    'and the charging call site actually passes the default — shown and charged read the same book');
}

/* ---------- 5. what is on file is held to a real share ---------------- */
{
  const presets = { agentDiscountWholesalePct: 40, agentDiscountRetailPct: 30 };
  let r = shown.resolveDiscountPcts({}, presets);
  eq(r.discountWholesalePct, 40, 'a product with no override takes the shop default');
  eq(r.discountRetailPct, 30, 'on both tiers');

  r = shown.resolveDiscountPcts({ agent_discount_wholesale_pct: 60 }, presets);
  eq(r.discountWholesalePct, 60, 'an override wins over the default');
  eq(r.discountRetailPct, 30, 'without disturbing the tier it did not override');

  /* 0 is a real choice -- "this product shares nothing" -- and must not be
     read as "unset" and quietly replaced by the shop default. Checked on
     BOTH tiers rather than one: they are two separate lines, and a
     truthiness test creeping into either would hand away a margin the
     shop had deliberately set to nothing. */
  r = shown.resolveDiscountPcts({ agent_discount_wholesale_pct: 0, agent_discount_retail_pct: 0 }, presets);
  eq(r.discountWholesalePct, 0, 'a wholesale override of zero is an override, not a blank');
  eq(r.discountRetailPct, 0, 'and so is a retail one');

  r = shown.resolveDiscountPcts({ agent_discount_wholesale_pct: 150, agent_discount_retail_pct: -20 }, presets);
  eq(r.discountWholesalePct, 100, 'more than the whole margin is held to the whole margin');
  eq(r.discountRetailPct, 0, 'and a negative share, which would charge an agent above our own price, is held to none');

  r = charged.resolveDiscountPcts({ agent_discount_wholesale_pct: 150 }, presets);
  eq(r.discountWholesalePct, 100, 'the charging copy holds it to the same bound');
}

/* ---------- 6. the admin app says what the number now means ----------- */
/*
 * The setting changed meaning without changing name or type: a shop that
 * had 10 in that box still has 10 in it, and 10 now gives away far less.
 * Text is worth pinning here because the number itself cannot tell anyone
 * that.
 */
{
  const admin = read('index.html');
  const hint = extractFunction(admin, 'renderAgentDiscountHints', 'index.html');

  t.check(/const margin = ourPrice - cost;/.test(hint),
    'the estimate is built from the margin');
  t.check(/margin \* pct\/100/.test(hint),
    'and shows a share of it, matching what the server will actually do');
  t.check(!/allows up to/.test(admin) && !/before hitting cost/.test(admin),
    'the old "how much discount fits before hitting cost" ceiling is gone, since every share now fits');
  t.check(!/agent-discount-warn/.test(admin),
    'and so is the below-cost warning, which is no longer reachable');
  /* A percentage of a margin is not a number anyone can feel. The three
     shilling figures are what the decision is made on. */
  t.check(/Margin here is \$\{fmtUGX\(margin\)\}/.test(hint)
    && /hands over \$\{fmtUGX\(given\)\}/.test(hint)
    && /you keep \$\{fmtUGX\(margin-given\)\}/.test(hint),
    'the estimate names the margin, what is given away, and what is kept, in shillings');
  t.check(/No markup set for this tier/.test(hint),
    'and says so plainly when there is no margin to share at all');
  t.check(/presetAgentDiscountWholesalePct/.test(hint) && /presetAgentDiscountRetailPct/.test(hint),
    'a blank box estimates the shop default rather than going quiet, blank being its normal state');

  /* Two different silences. Calling "this supplier quoted wholesale but
     not retail" a missing price sent someone looking for a price that was
     already on file. */
  t.check(/No \$\{kind\} price on file/.test(hint) && /No price on file yet to estimate against/.test(hint),
    'a missing retail figure reads differently from no price entry at all');

  /* The estimate now reads its figures off a variant and names it, and
     regenerating renumbers variants -- so an estimate left standing
     across a regenerate would name whichever variant has since taken
     that position. Scoped to generateVariants rather than searched for
     across the file, where the two calls in editProduct/newProduct would
     satisfy it. */
  t.check(/renderAgentDiscountHints\(\);/.test(extractFunction(admin, 'generateVariants', 'index.html')),
    'regenerating variants refreshes the estimate rather than leaving it naming the old numbering');

  ['share of your margin', 'share of margin'].forEach((phrase) => {
    t.check(admin.includes(phrase), `the form explains it as a "${phrase}"`);
  });
  t.check(/100% gives an agent|100% gives all of it/.test(admin),
    'naming what the far end of the scale does');
}

/* ---------- 7. the estimate, actually run ----------------------------- */
/*
 * Section 6 reads the source; this runs it. The variant fallback below is
 * the part source-reading cannot pin down: an assertion that "the
 * cheapest priced variant" appears somewhere in the function is satisfied
 * by the comment explaining why the fallback exists, long after the
 * fallback itself has been deleted. It was, until this section replaced
 * it.
 *
 * Most of this shop's products are variable, and a variable product's
 * prices hang off its variants, never off the product row. The estimate
 * asked for variantIdx null only, so on a product carrying dozens of
 * prices it reported "No price on file yet" -- the exact case it was
 * there to answer.
 */
{
  const adminSrc = read('index.html');

  // rows is keyed by variant index ('null' for a simple product's own
  // row), holding what rankedPriceRows should hand back for it.
  const runHint = ({ rows, variants, markup, typed, presets }) => {
    const fields = {};
    const el = (id) => (fields[id] = fields[id] || { value: '', textContent: '' });
    const key = (variantIdx) => (variantIdx == null ? 'null' : variantIdx);
    const scope = compileScope(
      ['effectiveMarkupRule', 'suggestedSellingPrice', 'variantLabel', 'renderAgentDiscountHints']
        .map((n) => extractFunction(adminSrc, n, 'index.html')),
      {
        document: { getElementById: el },
        rankedPriceRows: (_id, variantIdx) => (rows[key(variantIdx)] ? [rows[key(variantIdx)]] : []),
        draftVariants: variants || [],
        fmtUGX: (n) => (n == null ? '' : Number(n).toLocaleString('en-UG') + ' UGX'),
        data: presets || { presetAgentDiscountWholesalePct: 0, presetAgentDiscountRetailPct: 0 },
      },
      ['renderAgentDiscountHints'],
    );
    el('p_id').value = 'P073';
    el('p_wholesale_markup_type').value = markup.wt || 'percent';
    el('p_wholesale_markup_value').value = markup.wv == null ? '' : String(markup.wv);
    el('p_retail_markup_type').value = markup.rt || 'percent';
    el('p_retail_markup_value').value = markup.rv == null ? '' : String(markup.rv);
    el('p_agent_discount_wholesale').value = typed == null ? '' : String(typed);
    el('p_agent_discount_retail').value = typed == null ? '' : String(typed);
    scope.renderAgentDiscountHints();
    return { w: el('p_agent_discount_wholesale_hint').textContent, r: el('p_agent_discount_retail_hint').textContent };
  };

  const variants = [
    { combo: { Length: 'Short', Lock: 'Single Lock' }, wholesaleMarkupType: 'percent', wholesaleMarkupValue: 0, retailMarkupType: 'percent', retailMarkupValue: 0 },
    { combo: { Length: 'Long', Lock: 'Double Lock' }, wholesaleMarkupType: 'percent', wholesaleMarkupValue: 0, retailMarkupType: 'percent', retailMarkupValue: 0 },
  ];

  // A simple product, priced on its own row: unchanged behaviour.
  {
    const out = runHint({ rows: { null: { wholesale: 10000, retail: null, packQty: 0 } }, variants: [], markup: { wt: 'percent', wv: 10 }, typed: 50 });
    t.check(/Margin here is 1,000 UGX/.test(out.w) && /hands over 500 UGX/.test(out.w) && /an agent pays 10,500 UGX/.test(out.w),
      `a simple product is estimated off its own price row (${out.w})`);
    t.check(!/variant/.test(out.w), 'with nothing said about variants, there being none');
  }

  // The regression: nothing on the product row, prices on the variants.
  {
    const out = runHint({
      rows: { 0: { wholesale: 300000, retail: null, packQty: 0 }, 1: { wholesale: 320000, retail: null, packQty: 0 } },
      variants, markup: { wt: 'fixed', wv: 10000 }, typed: 40,
    });
    t.check(/Margin here is 10,000 UGX/.test(out.w),
      `a variable product is estimated rather than reported unpriced (${out.w})`);
    t.check(/an agent pays 306,000 UGX/.test(out.w) && /you keep 6,000 UGX/.test(out.w),
      '40% of a 10,000 margin being 4,000');
    t.check(/Short \/ Single Lock/.test(out.w) && !/Long \/ Double Lock/.test(out.w),
      'naming which variant the figures came from, since that changes what they mean');
  }

  // The same two variants with the cheaper one second, so "cheapest" and
  // "first found" disagree and only one of them can be right.
  {
    const out = runHint({
      rows: { 0: { wholesale: 320000, retail: null, packQty: 0 }, 1: { wholesale: 300000, retail: null, packQty: 0 } },
      variants, markup: { wt: 'fixed', wv: 10000 }, typed: 40,
    });
    t.check(/Long \/ Double Lock/.test(out.w),
      `the cheapest variant is found wherever it sits in the list (${out.w})`);
  }

  // A variant carrying its own markup rule is estimated on that rule, not
  // on the product-level one it overrides.
  {
    const own = [{ ...variants[0], wholesaleMarkupType: 'percent', wholesaleMarkupValue: 20 }, variants[1]];
    const out = runHint({
      rows: { 0: { wholesale: 300000, retail: null, packQty: 0 } },
      variants: own, markup: { wt: 'fixed', wv: 10000 }, typed: 0,
    });
    t.check(/Margin here is 60,000 UGX/.test(out.w),
      `the variant's own 20% is used, not the product's fixed 10,000 (${out.w})`);
  }

  // Priced, but only on one side of the curve -- the common case here.
  {
    const out = runHint({
      rows: { 0: { wholesale: 300000, retail: null, packQty: 0 } },
      variants, markup: { wt: 'fixed', wv: 10000 }, typed: 40,
    });
    t.check(/No retail price on file for Short \/ Single Lock/.test(out.r),
      `a missing retail figure names what is missing and where (${out.r})`);
  }

  // Nothing priced anywhere.
  {
    const out = runHint({ rows: {}, variants, markup: { wt: 'fixed', wv: 10000 }, typed: 40 });
    t.check(out.w === 'No price on file yet to estimate against.',
      `and no price entry at all reads differently again (${out.w})`);
  }

  // Blank box: the shop default is what will actually apply, so it is
  // what gets estimated.
  {
    const out = runHint({
      rows: { null: { wholesale: 10000, retail: null, packQty: 0 } }, variants: [], markup: { wt: 'percent', wv: 10 },
      typed: null, presets: { presetAgentDiscountWholesalePct: 25, presetAgentDiscountRetailPct: 25 },
    });
    t.check(/The shop default of 25% hands over 250 UGX/.test(out.w),
      `a blank box estimates the default it will actually use (${out.w})`);
  }
}

process.exit(t.done() ? 1 : 0);
