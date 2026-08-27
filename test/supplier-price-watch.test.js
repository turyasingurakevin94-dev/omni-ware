#!/usr/bin/env node
'use strict';
/*
 * What suppliers charge, over time.
 *
 * The shop buys most of its goods to order, so a supplier's price IS
 * the margin. This watches it from the purchase invoices the shop
 * already writes, and holds itself to four rules:
 *
 *   ONE UNIT ONLY. A price compares only with a price for the same
 *   thing. A product re-recorded from pieces to cartons would show a
 *   rise that never happened, so those points are excluded and COUNTED.
 *
 *   TWO DATED PURCHASES, ON DIFFERENT DAYS. One purchase is a price,
 *   not a trend; three on one day is one delivery.
 *
 *   MONEY, NOT PERCENTAGE. A 2% rise on the thing bought every week
 *   costs more than a 40% rise on something bought once, and the list
 *   is ordered by what it actually costs.
 *
 *   ONE DERIVATION. The dashboard's cost-rise flag reads from this, so
 *   the alert and the screen can never name different suppliers.
 *
 * Run: node test/supplier-price-watch.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('supplier price watch');
const src = read('index.html');
const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);

const TODAY = '2026-08-27';
const ago = (d) => new Date(Date.parse(TODAY + 'T00:00:00Z') - d * 86400000).toISOString().slice(0, 10);
const pi = (id, days, supplierId, supplierName, items, voided) =>
  ({ id, date: ago(days), supplierId, supplierName, items, voided: !!voided });
const line = (productId, productName, price, qty, unit, variantIdx) =>
  ({ productId, variantIdx: variantIdx == null ? null : variantIdx, productName, price, qty, unit: unit || 'pc' });

const data = {
  presetPriceWatchDays: 180,
  products: [
    { id: 'P1', name: 'Wall Angle', variants: [] },
    { id: 'P2', name: 'Cement', variants: [] },
    { id: 'P3', name: 'Screws', variants: [] },
    { id: 'P4', name: 'Once Only', variants: [] },
    { id: 'P5', name: 'Same Day', variants: [] },
    { id: 'P6', name: 'Switched Unit', variants: [] },
  ],
  purchaseInvoices: [
    // P1: a small rise on a big volume — 2,500 → 2,600 over 600 units.
    pi(1, 120, 'S1', 'Okuosi Gypsum', [line('P1', 'Wall Angle', 2500, 200)]),
    pi(2, 60, 'S1', 'Okuosi Gypsum', [line('P1', 'Wall Angle', 2550, 200)]),
    pi(3, 10, 'S1', 'Okuosi Gypsum', [line('P1', 'Wall Angle', 2600, 200)]),
    // P2: a big percentage rise on almost nothing — 10,000 → 14,000 on 2.
    pi(4, 90, 'S2', 'Roto', [line('P2', 'Cement', 10000, 1, 'bag')]),
    pi(5, 12, 'S2', 'Roto', [line('P2', 'Cement', 14000, 1, 'bag')]),
    // P3: come down — 700 → 600 over 300.
    pi(6, 100, 'S1', 'Okuosi Gypsum', [line('P3', 'Screws', 700, 150)]),
    pi(7, 20, 'S1', 'Okuosi Gypsum', [line('P3', 'Screws', 600, 150)]),
    // P4: one purchase only — a price, not a trend.
    pi(8, 30, 'S1', 'Okuosi Gypsum', [line('P4', 'Once Only', 5000, 10)]),
    // P5: three purchases, all on one day — one delivery, no trend.
    pi(9, 40, 'S2', 'Roto', [line('P5', 'Same Day', 1000, 5)]),
    pi(10, 40, 'S2', 'Roto', [line('P5', 'Same Day', 1200, 5)]),
    // P6: the unit changed. The earlier pieces must never be compared
    // with the later cartons.
    pi(11, 150, 'S1', 'Okuosi Gypsum', [line('P6', 'Switched Unit', 500, 100, 'pc')]),
    pi(12, 80, 'S1', 'Okuosi Gypsum', [line('P6', 'Switched Unit', 10000, 5, 'ctn')]),
    pi(13, 15, 'S1', 'Okuosi Gypsum', [line('P6', 'Switched Unit', 10400, 5, 'ctn')]),
    // Voided, and outside the look-back: neither counts for anything.
    pi(14, 5, 'S1', 'Okuosi Gypsum', [line('P1', 'Wall Angle', 9999, 500)], true),
    pi(15, 400, 'S1', 'Okuosi Gypsum', [line('P1', 'Wall Angle', 100, 500)]),
  ],
  prices: [
    // Agrees with what was actually paid: not out of step.
    { id: 1, productId: 'P1', variantIdx: null, supplierId: 'S1', wholesale: 2600, retail: 2650,
      unit: 'pc', packQty: 40, packUnit: 'bundle', tiers: [], outOfStock: false },
    // The file still says 10,000 while the last invoice paid 14,000.
    { id: 2, productId: 'P2', variantIdx: null, supplierId: 'S2', wholesale: 10000, retail: 10000,
      unit: 'bag', packQty: 10, packUnit: 'lot', tiers: [], outOfStock: false },
    /* A volume tier that matches what was paid at THAT quantity: the
       file and reality agree, and a naive comparison against the flat
       price would have called it drift. */
    { id: 3, productId: 'P3', variantIdx: null, supplierId: 'S1', wholesale: 700, retail: 750,
      unit: 'pc', packQty: 50, packUnit: 'ctn', tiers: [{ minQty: 100, price: 600 }], outOfStock: false },
  ],
};

const env = {
  data,
  todayISO: () => TODAY,
  supplierName: (id) => ({ S1: 'Okuosi Gypsum', S2: 'Roto' })[id] || String(id),
};

let scope = null; let err = null;
try {
  scope = compileScope([
    'supplierPriceSeries', 'supplierPriceWatch', 'dashSupplierPriceInflation',
    'waDaysBetween', 'productPriceRows', 'purchasePriceAtQty', 'tieredUnitPrice', 'tiersForKind',
  ].map((n) => extractFunction(src, n, 'index.html'))
    .concat([
      extractDeclaration(src, 'PRICE_WATCH_FILE_TOLERANCE_PCT', 'index.html'),
      extractDeclaration(src, 'DASH_COST_RISE_PCT', 'index.html'),
    ]),
  env, ['supplierPriceSeries', 'supplierPriceWatch', 'dashSupplierPriceInflation']);
} catch (e) { err = e; }
t.check(!!scope, `the watch chain compiles${err ? ` (${err.message})` : ''}`);

/* ---------- 1. what counts as a trend at all -------------------------- */
if (scope) {
  const all = scope.supplierPriceSeries(TODAY);
  const by = (name) => all.find((s) => s.name === name);

  t.check(by('Once Only').trend === false && by('Once Only').rise === 0,
    'one purchase is a price, not a trend');
  t.check(by('Same Day').trend === false,
    'and three purchases on one day are one delivery, not a movement');

  const angle = by('Wall Angle');
  eq(angle.points.length, 3, 'the voided invoice and the one outside the look-back are not points');
  t.check(angle.first.price === 2500 && angle.last.price === 2600,
    'the trend runs from the oldest comparable price to the newest');
  eq(angle.units, 600, 'over the quantity actually bought in the window');
  eq(angle.extra, 60000, 'and the money is that quantity at the new price — 100 more on each of 600');

  const switched = by('Switched Unit');
  eq(switched.points.length, 2, 'a purchase recorded in another unit is NOT compared');
  eq(switched.skippedOtherUnit, 1, 'it is counted instead, so the gap in the trail is visible');
  t.check(switched.first.price === 10000 && switched.rise === 400,
    'and the trend is only over the prices that can honestly be compared');
}

/* ---------- 2. ranked by money, not percentage ------------------------ */
if (scope) {
  const w = scope.supplierPriceWatch(TODAY);
  eq(w.up.map((s) => s.name).join(','), 'Wall Angle,Cement,Switched Unit',
    'the biggest COST comes first — Wall Angle rose 4% and leads, because it rose on six hundred pieces');
  const cement = w.up.find((s) => s.name === 'Cement');
  t.check(Math.round(cement.risePct) === 40 && cement.extra === 8000,
    'a 40% rise on two bags is reported as 40%, and still ranks below a 4% rise worth ten times as much');

  eq(w.down.map((s) => s.name).join(','), 'Screws',
    'a supplier who dropped their price is worth knowing about too');
  t.check(w.down[0].rise === -100 && w.down[0].extra === -30000,
    'with what that saved on what was bought');
}

/* ---------- 3. the Price Registry, checked against reality ------------ */
if (scope) {
  const w = scope.supplierPriceWatch(TODAY);
  const names = w.outOfStep.map((s) => s.name);
  t.check(names.includes('Cement'),
    'a file still saying 10,000 while the last invoice paid 14,000 is named');
  const cement = w.outOfStep.find((s) => s.name === 'Cement');
  eq(cement.onFile, 10000, 'with what the file says');
  eq(cement.fileGap, 4000, 'and the size of the gap');

  t.check(!names.includes('Wall Angle'),
    'a file that agrees with what was paid is not flagged');
  t.check(!names.includes('Screws'),
    'and neither is one whose VOLUME TIER matches what was paid at that quantity — a tier is not drift');

  const once = scope.supplierPriceSeries(TODAY).find((s) => s.name === 'Once Only');
  t.check(once.onFile === null && once.fileStale === false,
    'nothing on file is reported as nothing on file — a different answer from agreeing');
}

/* ---------- 4. one derivation, one story ------------------------------ */
if (scope) {
  const flags = scope.dashSupplierPriceInflation();
  t.check(flags.length > 0 && flags.every((f) => f.growth > 5),
    'the dashboard flag still only reports rises past its own threshold');
  const first = flags[0];
  t.check(typeof first.name === 'string' && typeof first.supplierName === 'string'
    && typeof first.first === 'number' && typeof first.last === 'number'
    && typeof first.growth === 'number' && typeof first.since === 'string',
    'and keeps the exact shape dashAlerts consumes');
  t.check(!flags.some((f) => f.name === 'Wall Angle'),
    'a 4% rise is under the dashboard threshold even though it costs the most — the card and the screen answer different questions from the SAME series');
  const deleg = extractFunction(src, 'dashSupplierPriceInflation', 'index.html');
  t.check(/supplierPriceWatch\(\)\.up/.test(deleg),
    'delegation in the source too — the alert cannot grow its own price history again');
}

/* ---------- 5. the wiring --------------------------------------------- */
{
  t.check(/id="tab-prices-watch"/.test(src) && /data-tab="prices-watch"/.test(src),
    'Supplier prices is its own screen on the rail');
  const go = extractFunction(src, 'goToTab', 'index.html');
  t.check(/if\(tab==='prices-watch'\) renderPriceWatch\(\);/.test(go), 'and redraws on entry');
  const panel = extractFunction(src, 'renderPriceWatch', 'index.html');
  t.check(/listPageSlice\('priceUp', w\.up\)/.test(panel) && /listPageSlice\('priceFile', w\.outOfStep\)/.test(panel),
    'each section shows the few that matter, with the rest one tap away');
  t.check(/selectPrProduct\(sr\.productId, sr\.variantIdx\)/.test(panel) && /openModal\('priceModal'\)/.test(panel),
    'and an out-of-step row opens the price form — this screen never edits the file itself');
  t.check(/priceWatchDays:d\.presetPriceWatchDays/.test(src)
    && /presetPriceWatchDays: presets\.priceWatchDays != null \? Number\(presets\.priceWatchDays\) : 180/.test(src),
    'the look-back loads and persists like every other shop setting');
}

process.exit(t.done() ? 1 : 0);
