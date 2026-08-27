#!/usr/bin/env node
'use strict';
/*
 * The Procurement Copilot: what to buy, derived — never predicted.
 *
 * The first version measured demand with every invoiced line and ranked
 * on days of cover. On a shop that buys most goods to order that named
 * the whole catalogue, every row reading "holding 0", every row at zero
 * days, ordered by nothing better than catalogue position. What this
 * file holds to account is the fix:
 *
 *   WHICH DEMAND. Only what sold OFF THE SHELF can empty the shelf, so
 *   only that earns a refill. What was bought in for one order is a
 *   different argument — worth STOCKING, if it keeps happening — and
 *   never a false alarm.
 *
 *   WHICH ORDER. Ranked by what each item actually EARNED in 30 days,
 *   so "the best few" means the best few by money. Days left only
 *   breaks ties.
 *
 *   WHY. Every line carries a sentence built from its own figures, and
 *   a saving is claimed only when every unit of the history it rests on
 *   carried a recorded price.
 *
 *   REAL ARITHMETIC. The supplier is the cheapest AT the needed
 *   quantity (tiers included); the refill rounds UP to that supplier's
 *   pack; the unit cost is re-read at the rounded quantity.
 *
 * Run: node test/purchase-plan.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('purchase plan');
const src = read('index.html');
const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);

const TODAY = '2026-08-27';

/* A shop like the owner's: it holds almost nothing, and most of what it
   sells is bought in per order. Only P1 is genuinely stocked. */
const data = {
  presetRestockCoverDays: 14,
  products: [
    { id: 'P1', name: 'Cement', variants: [] },
    { id: 'P2', name: 'Wall Angle', variants: [] },
    { id: 'P3', name: 'Gypsum', variants: [{ combo: { Type: 'A' } }, { combo: { Type: 'B' } }] },
    { id: 'P4', name: 'Sofa Legs', variants: [] },
    { id: 'P5', name: 'Staple Wires', variants: [] },
    { id: 'P6', name: 'Half Bend', variants: [] },
  ],
  stock: { P1: 4, P2: 0, 'P3::1': 0, P4: 0, P5: 0, P6: 0 },
  savedQuotes: [
    /* Cement sells off the shelf; everything else is bought in for the
       order it was sold on, which is how this shop mostly trades. */
    { id: 1, invoiced: true, voided: false, date: '2026-08-22', items: [
      { productId: 'P1', variantIdx: null, qty: 40, supplierId: '__stock__', sellPrice: 34000, _stockLots: [{ qty: 40, cost: 30000 }] },
      { productId: 'P2', variantIdx: null, qty: 80, supplierId: 'S3', price: 2600, sellPrice: 4000 },
      { productId: 'P4', variantIdx: null, qty: 40, supplierId: 'S1', price: 2000, sellPrice: 2400 },
      { productId: 'P5', variantIdx: null, qty: 10, supplierId: 'S1', sellPrice: 900 },
      { productId: 'P6', variantIdx: null, qty: 1, supplierId: 'S2', price: 250000, sellPrice: 265000 },
    ] },
    { id: 2, invoiced: true, voided: false, date: '2026-08-24', items: [
      { productId: 'P1', variantIdx: null, qty: 20, supplierId: '__stock__', sellPrice: 34000, _stockLots: [{ qty: 20, cost: 30000 }] },
      { productId: 'P2', variantIdx: null, qty: 60, supplierId: 'S3', price: 2600, sellPrice: 4000 },
      { productId: 'P4', variantIdx: null, qty: 30, supplierId: 'S1', price: 2000, sellPrice: 2400 },
      { productId: 'P5', variantIdx: null, qty: 10, supplierId: 'S1', sellPrice: 900 },
      { productId: 'P6', variantIdx: null, qty: 1, supplierId: 'S2', price: 250000, sellPrice: 265000 },
    ] },
    { id: 3, invoiced: true, voided: false, date: '2026-08-25', items: [
      { productId: 'P2', variantIdx: null, qty: 60, supplierId: 'S3', price: 2600, sellPrice: 4000 },
      { productId: 'P4', variantIdx: null, qty: 30, supplierId: 'S1', price: 2000, sellPrice: 2400 },
      { productId: 'P5', variantIdx: null, qty: 10, supplierId: 'S1', price: 600, sellPrice: 900 },
      { productId: 'P6', variantIdx: null, qty: 1, supplierId: 'S2', price: 250000, sellPrice: 265000 },
      { productId: 'P3', variantIdx: 1, qty: 15, supplierId: 'S1', price: 1800, sellPrice: 2100 },
    ] },
    // Voided: counts for nothing, however much it asked for.
    { id: 4, invoiced: true, voided: true, date: '2026-08-22', items: [
      { productId: 'P1', variantIdx: null, qty: 99, supplierId: '__stock__', sellPrice: 34000 } ] },
    // Outside the window: lifetime only, never velocity.
    { id: 5, invoiced: true, voided: false, date: '2026-07-01', items: [
      { productId: 'P1', variantIdx: null, qty: 500, supplierId: '__stock__', sellPrice: 34000 } ] },
  ],
  prices: [
    { id: 1, productId: 'P1', variantIdx: null, supplierId: 'S1', wholesale: 30000, retail: 32000,
      unit: 'bag', packQty: 10, packUnit: 'lot', tiers: [], outOfStock: false },
    /* S2 is dearer flat but carries a volume tier that makes it the
       cheapest AT the needed quantity — the pick must be tier-aware. */
    { id: 2, productId: 'P1', variantIdx: null, supplierId: 'S2', wholesale: 31000, retail: 32500,
      unit: 'bag', packQty: 10, packUnit: 'lot', tiers: [{ minQty: 20, price: 27000 }], outOfStock: false },
    { id: 3, productId: 'P2', variantIdx: null, supplierId: 'S3', wholesale: 2500, retail: 2600,
      unit: 'pc', packQty: 40, packUnit: 'bundle', tiers: [{ minQty: 200, price: 2300 }], outOfStock: false },
    { id: 4, productId: 'P3', variantIdx: 1, supplierId: 'S1', wholesale: 1800, retail: 2000,
      unit: 'pc', packQty: 4, packUnit: 'box', tiers: [], outOfStock: false },
    { id: 5, productId: 'P4', variantIdx: null, supplierId: 'S1', wholesale: 2000, retail: 2150,
      unit: 'pc', packQty: 50, packUnit: 'ctn', tiers: [], outOfStock: false },
    { id: 6, productId: 'P5', variantIdx: null, supplierId: 'S1', wholesale: 550, retail: 600,
      unit: 'pc', packQty: 20, packUnit: 'ctn', tiers: [], outOfStock: false },
  ],
};

const env = {
  data,
  todayISO: () => TODAY,
  supplierName: (id) => ({ S1: 'Kampala Steel', S2: 'Roto', S3: 'Okuosi Gypsum' })[id] || String(id),
  productDisplayLabel: (p, vi) => (vi == null ? p.name : p.name + ' v' + vi),
  fmtUGX: (n) => Number(n || 0).toLocaleString('en-US') + ' UGX',
  allProductVariantEntries: () => data.products.flatMap((p) => (p.variants && p.variants.length)
    ? p.variants.map((_v, i) => ({ p, variantIdx: i }))
    : [{ p, variantIdx: null }]),
};

let scope = null; let err = null;
try {
  scope = compileScope([
    'waSalesByKey', 'waDaysBetween', 'waWeekday', 'stockKey', 'getStockQty',
    'productPriceRows', 'rankedPriceRows', 'rankedPurchaseRowsAtQty',
    'purchasePriceAtQty', 'tieredUnitPrice', 'tiersForKind',
    'quoteItemSellPrice', 'invoiceLineCost',
    'restockRiskRows', 'stockingCandidates', 'buyLineFor', 'buyLineReason',
    'reorderRuleFor', 'supplierLeadTimes', 'supplierLeadDays',
    'purchasePlan', 'dashStockOutExposure',
  ].map((n) => extractFunction(src, n, 'index.html'))
    .concat([
      extractDeclaration(src, 'REPEAT_BUYIN_ORDERS', 'index.html'),
      extractDeclaration(src, 'LEAD_TIME_WINDOW_DAYS', 'index.html'),
      extractDeclaration(src, 'LEAD_TIME_MIN_DELIVERIES', 'index.html'),
    ]),
  env, ['waSalesByKey', 'restockRiskRows', 'stockingCandidates', 'buyLineReason',
    'purchasePlan', 'dashStockOutExposure']);
} catch (e) { err = e; }
t.check(!!scope, `the copilot chain compiles${err ? ` (${err.message})` : ''}`);

/* ---------- 1. the two kinds of demand ---------------------------------- */
if (scope) {
  const sales = scope.waSalesByKey(TODAY);
  const cement = sales.get('P1');
  t.check(cement.units30 === 60 && cement.shelfUnits30 === 60 && cement.inUnits30 === 0,
    'what sold off the shelf is counted as such — the voided and out-of-window orders count for nothing');
  const angle = sales.get('P2');
  t.check(angle.shelfUnits30 === 0 && angle.inUnits30 === 200 && angle.orders30 === 3,
    'and what was bought in for orders is kept apart, with the number of orders that asked');
  eq(angle.inSpend30, 520000, 'with what those buy-ins actually cost');
  const wires = sales.get('P5');
  t.check(wires.inUnits30 === 30 && wires.inPricedUnits30 === 10,
    'units whose line carried no price are counted separately — a saving cannot rest on a blank');

  const rows = scope.restockRiskRows(TODAY);
  eq(rows.map((r) => r.name).join(','), 'Cement',
    'ONLY the shelf can run out: an item the shop never stocks is not a refill, however much it sells');
  t.check(rows[0].dailyRate === 2 && rows[0].daysLeft === 2 && rows[0].orders30 === 2,
    'and the refill runs on the shelf pace, carrying the orders behind it');

  const stocking = scope.stockingCandidates(TODAY);
  eq(stocking.map((r) => r.name).join(','), 'Wall Angle,Half Bend,Sofa Legs,Staple Wires',
    'bought in for 3+ orders and never held: worth stocking, ranked by what it earned — Half Bend sells three a month and still out-earns a hundred sofa legs');
  t.check(!stocking.some((r) => r.name === 'Gypsum v1'),
    'one order is not a pattern — a single buy-in is never a stocking case');
  t.check(!stocking.some((r) => r.name === 'Cement'),
    'and something already held is a refill, not a new line to stock');
}

/* ---------- 2. the plan: ranked by money, packed, budgeted -------------- */
if (scope) {
  const plan = scope.purchasePlan(2000000, null, TODAY);
  eq(plan.coverDays, 14, 'cover comes from the shop preset');
  eq(plan.lines.map((l) => l.name).join(','), 'Wall Angle,Cement,Sofa Legs,Staple Wires',
    'ranked by what each item EARNED in 30 days, not by days of cover');
  t.check(plan.lines[0].name === 'Wall Angle' && plan.lines[1].daysLeft === 2,
    'the ONLY line with days of cover left — the one the old ranking would have put first — sits below a better earner');

  const cement = plan.lines.find((l) => l.name === 'Cement');
  eq(cement.kind, 'refill', 'the stocked item is a shelf refill');
  t.check(cement.supplier === 'Roto' && cement.unitCost === 27000,
    'the supplier is the cheapest AT the needed quantity — the volume tier flips the pick');
  eq(cement.buyQty, 30, 'the refill (24 needed) rounds UP to the supplier\'s pack of 10');
  eq(cement.cost, 810000, 'and is costed at the rounded quantity');

  const angle = plan.lines.find((l) => l.name === 'Wall Angle');
  eq(angle.kind, 'stock', 'the repeat buy-in is a stocking line');
  t.check(angle.buyQty === 200 && angle.unitCost === 2300,
    'costed at the month\'s own quantity, where the 200+ tier is reached');

  eq(plan.sourceFirst.length, 1, 'one qualifying line has no supplier price anywhere');
  t.check(plan.sourceFirst[0].name === 'Half Bend' && plan.sourceFirst[0].units30 === 3,
    'and it is NAMED with what it sold — never priced by guesswork, never dropped');

  /* A budget too small for the big line: the tail is named and the
     cheaper line after it still fits — greedy, not give-up. */
  const tight = scope.purchasePlan(500000, null, TODAY);
  t.check(tight.lines.every((l) => l.name !== 'Cement'),
    'what does not fit is not bought');
  eq(tight.didNotFit.map((l) => l.name).join(','), 'Cement,Sofa Legs',
    'and every line that did not fit is NAMED, never silently dropped');
  t.check(tight.lines.some((l) => l.name === 'Staple Wires'),
    'while a cheaper line further down the ranking still fits — greedy, not give-up');
  t.check(tight.spend <= 500000, 'the spend never exceeds the budget');
}

/* ---------- 3. why each line is there ---------------------------------- */
if (scope) {
  const plan = scope.purchasePlan(2000000, null, TODAY);
  const say = (name) => (plan.lines.find((l) => l.name === name) || {}).reason || '';

  const cement = say('Cement');
  t.check(/off the shelf/.test(cement) && /2 orders/.test(cement) && /shelf is empty|left/.test(cement),
    `a refill says what the shelf sold and what is left (${cement})`);

  const angle = say('Wall Angle');
  t.check(/Bought in for 3 orders/.test(angle) && /Never held/.test(angle),
    `a stocking line says how often it was bought in (${angle})`);
  t.check(/60,000 UGX less/.test(angle),
    `and compares what was PAID with the price on file for the same total (${angle})`);
  t.check(/ties|cash sits in stock/.test(angle),
    `naming the cost of doing it rather than selling the idea (${angle})`);

  /* Sofa Legs: every buy-in priced, but bought at the same price the
     file carries, so there is nothing to claim. */
  const legs = say('Sofa Legs');
  t.check(!/less than was paid/.test(legs) && /about the same/.test(legs),
    `no saving is invented when there is none (${legs})`);

  /* Staple Wires: bought in three times, but only one of those buys
     went in with a price. No saving may be claimed on that. */
  const wires = say('Staple Wires');
  t.check(/carry no price/.test(wires) && !/less than was paid/.test(wires),
    `a half-recorded cost history says so instead of doing the arithmetic (${wires})`);
}

/* ---------- 4. one velocity, one story --------------------------------- */
if (scope) {
  const out = scope.dashStockOutExposure();
  eq(out.map((r) => r.name).join(','), 'Cement',
    'the dashboard stock-out alert reads the SAME shelf rows — it can no longer flag what the shop never stocks');
  t.check(out[0].dailyRate === 2 && out[0].qty === 4 && out[0].key === 'P1'
    && out[0].productId === 'P1' && out[0].variantIdx === null,
    'and keeps the exact shape dashAlerts joins on');
  const delegSrc = extractFunction(src, 'dashStockOutExposure', 'index.html');
  t.check(/restockRiskRows\(todayISO\(\)\)/.test(delegSrc),
    'delegation in the source too — the alert cannot grow its own velocity again');
}

/* ---------- 5. the wiring ---------------------------------------------- */
{
  t.check(/id="tab-buying"/.test(src) && /data-tab="buying"/.test(src),
    'What to buy is its own screen on the rail');
  t.check(/id="buy_plan"/.test(src) && /id="buy_budget"/.test(src) && /id="buy_cover"/.test(src),
    'with its budget and cover controls');
  const go = extractFunction(src, 'goToTab', 'index.html');
  t.check(/if\(tab==='buying'\) renderPurchasePlanPanel\(\);/.test(go),
    'and redraws on entry, like every other data screen');
  const panel = extractFunction(src, 'renderPurchasePlanPanel', 'index.html');

  /* The owner's complaint: every row offered to "source" a product the
     shop already sells, filing its own catalogue as leads. */
  t.check(!/captureSourcingLeadAndSave/.test(panel),
    'NOTHING on this screen goes to the sourcing funnel — every row here is already a product');
  t.check(/openInventoryModal\(l\.productId, l\.variantIdx, 'purchase', \{ supplierId: l\.supplierId, qty: l\.buyQty \}\)/.test(panel),
    'a priced line opens the purchase form with its supplier and quantity in it');
  t.check(/selectPrProduct\(sf\.productId, sf\.variantIdx\)/.test(panel) && /openModal\('priceModal'\)/.test(panel),
    'and a line with no price on file opens the price form for that product');
  const inv = extractFunction(src, 'invSelectProduct', 'index.html');
  t.check(/if\(preset\)\{/.test(inv) && /invPurchaseQtyRaw = String\(preset\.qty\)/.test(inv),
    'the purchase form takes that preset AFTER its own resets, or they would wipe it');

  t.check(/listPageSlice\('buyPlan', plan\.lines\)/.test(panel)
    && /listMoreButtonHTML\('buyPlan', plan\.lines\.length, 'lines'\)/.test(panel),
    'the best few show by default, with the rest one tap away');
  t.check(/buyPlan: 5/.test(src) && /buyPlan: \(\)=> renderPurchasePlanPanel\(\)/.test(src),
    'five of them, redrawn through the same registry every other list uses');
  t.check(/buy-why/.test(panel), 'and every row carries its reason');

  t.check(/cashOnHandByAccount\(\)\.total/.test(panel),
    'the default budget is the cash actually on hand');
  t.check(/restockCoverDays:d\.presetRestockCoverDays/.test(src)
    && /presetRestockCoverDays: presets\.restockCoverDays != null \? Number\(presets\.restockCoverDays\) : 14/.test(src),
    'the cover preset loads and persists like every other preset');
  t.check(/purchase_plan: \{ confirm: false, run\(input\)\{/.test(src)
    && /plan\.lines\.slice\(0, 8\)/.test(src) && /why: l\.reason/.test(src),
    'the assistant tool is a read over the SAME plan, capped for speech, carrying the same reasons');
  const api = read('api/assistant.js');
  t.check(/name: 'purchase_plan',/.test(api) && /Omit to use cash on hand\./.test(api),
    'the server offers it, budget optional');
  t.check(/worth stocking/.test(api),
    'and tells the model there are two kinds of line');
}

process.exit(t.done() ? 1 : 0);
