#!/usr/bin/env node
'use strict';
/*
 * Price entry authoring -- where the tier ladders everything else reads are
 * actually written.
 *
 * Every other price test in this suite checks that the four implementations
 * AGREE about a ladder. This one checks the ladder is right in the first
 * place, because a bad row here is agreed upon perfectly by all four.
 *
 * The sharp edge is packQty. It isn't stored on the tiers -- it's what
 * SPLITS one ladder into a wholesale side and a retail side
 * (deriveWholesaleRetail), so changing it re-reads the same numbers as
 * meaning something different. Bulk mode pre-fills packing from one
 * representative variant and used to write it onto all of them, which
 * silently dropped the wholesale price of any variant packed differently.
 *
 * Run: node test/price-authoring.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('price authoring');
const src = read('index.html');

const NAMES = ['deriveWholesaleRetail', 'tiersFromLegacyRow', 'invertedTierPairs', 'tieredUnitPrice', 'tiersForKind'];
const fn = compileScope(NAMES.map((n) => extractFunction(src, n, 'index.html')), {}, NAMES);

const ladder = (...pairs) => pairs.map(([minQty, price]) => ({ minQty, price }));

/* ---------- 1. the wholesale/retail split ----------------------------- */
{
  const tiers = ladder([1, 20000], [12, 15000]);
  const d = fn.deriveWholesaleRetail(tiers, 12);
  t.check(d.retail === 20000 && d.wholesale === 15000,
    `the tier below pack size is retail, the one at or above it is wholesale (${JSON.stringify(d)})`);
}
{
  const tiers = ladder([1, 20000], [6, 18000], [12, 15000], [24, 14000]);
  const d = fn.deriveWholesaleRetail(tiers, 12);
  t.check(d.retail === 20000 && d.wholesale === 15000,
    `the flat fields take the LOWEST breakpoint on each side, not the best price (${JSON.stringify(d)})`);
}
{
  const d = fn.deriveWholesaleRetail(ladder([1, 20000], [12, 15000]), 0);
  t.check(d.retail === 20000 && d.wholesale === null,
    `with no pack size there is no wholesale side at all (${JSON.stringify(d)})`);
}

/* ---------- 2. the flat fields agree with the ladder ------------------ */
/*
 * The two are separate representations of one row, and different screens
 * read different ones. They have to answer the same question the same way,
 * including when the ladder starts above 1 -- tieredUnitPrice falls back to
 * row[kind] when no breakpoint is reached, so that fallback has to BE the
 * lowest rung, not something else.
 */
{
  const cases = [
    { tiers: ladder([1, 20000], [12, 15000]), packQty: 12 },
    { tiers: ladder([6, 18000], [12, 15000]), packQty: 12 },   // ladder starts above 1
    { tiers: ladder([1, 20000]), packQty: 12 },                // retail only
    { tiers: ladder([12, 15000]), packQty: 12 },               // wholesale only
    { tiers: ladder([1, 20000], [6, 18000], [24, 14000]), packQty: 12 },
  ];
  const bad = [];
  cases.forEach(({ tiers, packQty }) => {
    const row = Object.assign({ packQty, tiers }, fn.deriveWholesaleRetail(tiers, packQty));
    // At qty 1 the retail side must charge exactly what `retail` claims,
    // and at pack size the wholesale side exactly what `wholesale` claims.
    if (row.retail != null && fn.tieredUnitPrice(row, 1, 'retail') !== row.retail) {
      bad.push(`retail ${row.retail} but charges ${fn.tieredUnitPrice(row, 1, 'retail')} at qty 1`);
    }
    if (row.wholesale != null && fn.tieredUnitPrice(row, packQty, 'wholesale') !== row.wholesale) {
      bad.push(`wholesale ${row.wholesale} but charges ${fn.tieredUnitPrice(row, packQty, 'wholesale')} at qty ${packQty}`);
    }
  });
  t.check(bad.length === 0,
    bad.length ? `flat fields disagree with the ladder: ${bad.join('; ')}` : `the flat fields match what the ladder charges (${cases.length} ladders)`);
}

/* ---------- 3. changing pack size re-reads the same ladder ------------ */
/*
 * The reason bulk mode must not write one variant's packing onto another.
 * Nothing about the tiers changes here -- only the number that decides
 * which of them count as wholesale.
 */
{
  const tiers = ladder([1, 500], [25, 400]);   // 4-inch nails, 25 to a box
  const own = fn.deriveWholesaleRetail(tiers, 25);
  const flattened = fn.deriveWholesaleRetail(tiers, 50);
  t.check(own.wholesale === 400 && own.retail === 500,
    `priced against its own pack size the variant has both rates (${JSON.stringify(own)})`);
  t.check(flattened.wholesale === null,
    `priced against a bigger pack size the SAME ladder loses its wholesale rate entirely (${JSON.stringify(flattened)})`);
}
{
  // Structural: the bulk save has to derive against the packing each row
  // actually ends up with, and only apply the shared fields when the admin
  // typed in them.
  const save = /getElementById\('pr_save'\)\.addEventListener\('click', \(\)=>\{([\s\S]*?)\n\}\);/.exec(src);
  if (!save) {
    t.fail('could not find the pr_save handler to check');
  } else {
    const body = save[1];
    t.check(/const packEdited = !prBulkPackPrefill/.test(body),
      'the bulk save distinguishes a typed pack size from an untouched pre-fill');
    t.check(/const own = \(!packEdited && keep\) \? keep : null/.test(body),
      'an untouched packing form leaves each variant on its own packing');
    t.check(/deriveWholesaleRetail\(effectiveTiers, rowPackQty\)/.test(body),
      'wholesale/retail are derived against the packing the row ends up with, not the shared field');
    t.check(!/deriveWholesaleRetail\(effectiveTiers, packQty\)/.test(body),
      'the shared pack size is no longer used to derive a per-variant rate');
    // A pack size raised past every rung leaves a row with no wholesale
    // rate. That IS what was asked for, but it has to be said out loud.
    t.check(/if\(keep && keep\.wholesale != null && derived\.wholesale == null\) lostWholesale\+\+/.test(body)
      && /lost their bulk rate/.test(body),
      'a save that drops a variant\'s bulk rate reports it rather than doing it quietly');
  }
}
{
  // Run the real pre-fill. The structural checks above can see that the
  // guard EXISTS but not that the snapshot it compares against is the one
  // actually in the fields -- a snapshot that never matches makes
  // packEdited permanently true and quietly restores the old flattening.
  const fields = {};
  const el = (id) => (fields[id] = fields[id] || { value: '', innerHTML: '' });
  const env = {
    data: {
      products: [{ id: 'P1', variants: [{ combo: { Size: '2in' } }, { combo: { Size: '4in' } }] }],
      prices: [
        { id: 1, productId: 'P1', variantIdx: 0, supplierId: 'S1', unit: 'pc', packUnit: 'Box', packQty: 50, tiers: ladder([1, 300], [50, 240]) },
        { id: 2, productId: 'P1', variantIdx: 1, supplierId: 'S1', unit: 'pc', packUnit: 'Box', packQty: 25, tiers: ladder([1, 500], [25, 400]) },
      ],
    },
    document: { getElementById: el },
    tiersFromLegacyRow: fn.tiersFromLegacyRow,
    renderPrTierUnitOptions: () => {},
    renderPrTiers: () => {},
    renderPrBulkVariantRows: () => {},
  };
  const scope = compileScope([
    'let prTiers = []; let prBulkVariantOverrides = []; let prBulkPackPrefill = null;',
    extractFunction(src, 'renderPrBulkVariants', 'index.html'),
    'function __prefill(){ return prBulkPackPrefill; }',
    'function __overrides(){ return prBulkVariantOverrides; }',
  ], env, ['renderPrBulkVariants', '__prefill', '__overrides']);

  el('pr_product').value = 'P1';
  el('pr_supplier').value = 'S1';
  scope.renderPrBulkVariants();

  const snap = scope.__prefill();
  t.check(snap && snap.unit === el('pr_unit').value
    && snap.packUnit === el('pr_pack_unit').value
    && snap.packQty === el('pr_pack_qty').value,
    `the snapshot records what was actually put in the fields (${JSON.stringify(snap)} vs pack qty "${el('pr_pack_qty').value}")`);
  // Which is what makes "untouched" detectable at all.
  t.check(String(el('pr_pack_qty').value) === '50',
    `the fields are pre-filled from one representative variant (${el('pr_pack_qty').value})`);
  t.check(scope.__overrides().length === 2 && scope.__overrides().every(Boolean),
    'each variant with a saved entry gets its own ladder as an override');
}

/* ---------- 4. an inverted ladder is spotted -------------------------- */
/*
 * Buying more costing more per unit is a transposed pair of figures nearly
 * every time, and nothing downstream would catch it -- tierForQty just
 * takes the highest breakpoint the quantity reaches.
 */
{
  t.check(fn.invertedTierPairs(ladder([1, 20000], [12, 15000], [24, 14000])).length === 0,
    'a properly descending ladder raises nothing');
  const bad = fn.invertedTierPairs(ladder([1, 15000], [12, 20000]));
  t.check(bad.length === 1 && bad[0][0].minQty === 1 && bad[0][1].minQty === 12,
    `a rung where the bigger quantity costs more is reported (${bad.length} found)`);
  t.check(fn.invertedTierPairs(ladder([12, 20000], [1, 15000])).length === 1,
    'entry order does not matter — the ladder is sorted before it is judged');
  t.check(fn.invertedTierPairs(ladder([1, 15000], [12, 15000])).length === 0,
    'the same price at a bigger quantity is flat, not inverted');
  t.check(fn.invertedTierPairs([]).length === 0 && fn.invertedTierPairs(ladder([1, 500])).length === 0,
    'an empty or single-rung ladder cannot be inverted');
}
{
  const add = extractFunction(src, 'addPrTier', 'index.html');
  t.check(/invertedTierPairs\(prTiers\)/.test(add) && !/return;[\s\S]*invertedTierPairs/.test(add.split('renderPrTiers();')[1] || ''),
    'the warning fires as a tier is added, and does not block the entry');
}

/* ---------- 5. reading an entry back gives the same ladder ------------ */
{
  const tiers = ladder([1, 20000], [12, 15000]);
  const back = fn.tiersFromLegacyRow({ tiers, retail: 20000, wholesale: 15000, packQty: 12 });
  t.check(JSON.stringify(back) === JSON.stringify(tiers),
    'a row with real tiers reads back exactly those tiers');
  t.check(back !== tiers && back[0] !== tiers[0],
    'the ladder is copied, so editing the form cannot mutate the saved row in place');
}
{
  // Rows predating the tier list carry only the two flat fields.
  const legacy = fn.tiersFromLegacyRow({ retail: 20000, wholesale: 15000, packQty: 12 });
  const d = fn.deriveWholesaleRetail(legacy, 12);
  t.check(d.retail === 20000 && d.wholesale === 15000,
    `a legacy row round-trips through the ladder unchanged (${JSON.stringify(d)})`);
  t.check(fn.tiersFromLegacyRow({ retail: 20000, wholesale: 15000, packQty: 0 }).length === 1,
    'a legacy row with no pack size yields only the retail rung, since it has no wholesale side');
}

/* ---------- 6. the edit path survives a vanished row ------------------ */
{
  const save = /getElementById\('pr_save'\)\.addEventListener\('click', \(\)=>\{([\s\S]*?)\n\}\);/.exec(src);
  const body = save ? save[1] : '';
  t.check(/const editingRow = data\.prices\.find\(p=>p\.id===editingPriceId\);[\s\S]{0,200}if\(!editingRow\)/.test(body),
    'saving an edit checks the row is still there instead of reading through undefined');
  t.check(!/data\.prices\.find\(p=>p\.id===editingPriceId\)\.outOfStock/.test(body),
    'the out-of-stock flag is no longer read off an unchecked find()');
}

process.exit(t.done() ? 1 : 0);
