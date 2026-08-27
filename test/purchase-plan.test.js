#!/usr/bin/env node
'use strict';
/*
 * The Procurement Copilot: what to buy, derived — never predicted.
 *
 * purchasePlan turns four records the shop already keeps — invoiced
 * demand (waSalesByKey), stock held, the supplier price registry, and
 * a budget — into a ranked buy list. What this file holds to account:
 *
 *   ONE VELOCITY. restockRiskRows runs on the same demand measure the
 *   WhatsApp picker trusts, and dashStockOutExposure now reads from
 *   it — the alert and the copilot can never disagree.
 *
 *   HONESTY. No sales history → no advice. Demand with no priced
 *   supplier → a NAMED source-first line, never a guessed figure.
 *   Over budget → a NAMED tail, never a silent drop.
 *
 *   REAL ARITHMETIC. The supplier is the cheapest AT the needed
 *   quantity (tiers included); the refill rounds UP to that
 *   supplier's pack; the unit cost is re-read at the rounded
 *   quantity, where a bigger buy can only reach a better tier.
 *
 * Run: node test/purchase-plan.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('purchase plan');
const src = read('index.html');
const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);

const TODAY = '2026-08-27';

const data = {
  presetRestockCoverDays: 14,
  products: [
    { id: 'P1', name: 'Cement', variants: [] },
    { id: 'P2', name: 'Screws', variants: [] },
    { id: 'P3', name: 'Gypsum', variants: [{ combo: { Type: 'A' } }, { combo: { Type: 'B' } }] },
    { id: 'P4', name: 'NoHistory', variants: [] },
    { id: 'P5', name: 'Unpriced fast', variants: [] },
  ],
  stock: { P1: 4, P2: 0, 'P3::1': 5, P4: 50, P5: 1 },
  savedQuotes: [
    // One invoiced order inside the 30-day window carries all demand.
    { id: 1, invoiced: true, voided: false, date: '2026-08-22', items: [
      { productId: 'P1', variantIdx: null, qty: 60 },
      { productId: 'P2', variantIdx: null, qty: 30 },
      { productId: 'P3', variantIdx: 1, qty: 15 },
      { productId: 'P5', variantIdx: null, qty: 20 },
    ] },
    // A voided order must count for nothing.
    { id: 2, invoiced: true, voided: true, date: '2026-08-22', items: [
      { productId: 'P4', variantIdx: null, qty: 99 } ] },
    // Outside the window: lifetime only, never velocity.
    { id: 3, invoiced: true, voided: false, date: '2026-07-01', items: [
      { productId: 'P1', variantIdx: null, qty: 500 } ] },
  ],
  prices: [
    { id: 1, productId: 'P1', variantIdx: null, supplierId: 'S1', wholesale: 30000, retail: 32000,
      unit: 'bag', packQty: 10, packUnit: 'lot', tiers: [], outOfStock: false },
    /* S2 is dearer flat but carries a volume tier that makes it the
       cheapest AT the needed quantity — the pick must be tier-aware. */
    { id: 2, productId: 'P1', variantIdx: null, supplierId: 'S2', wholesale: 31000, retail: 32500,
      unit: 'bag', packQty: 10, packUnit: 'lot', tiers: [{ minQty: 20, price: 27000 }], outOfStock: false },
    { id: 3, productId: 'P2', variantIdx: null, supplierId: 'S1', wholesale: null, retail: 500,
      unit: 'pc', packQty: 0, packUnit: '', tiers: [], outOfStock: false },
    { id: 4, productId: 'P3', variantIdx: 1, supplierId: 'S1', wholesale: 1800, retail: 2000,
      unit: 'pc', packQty: 4, packUnit: 'box', tiers: [], outOfStock: false },
  ],
};

const env = {
  data,
  todayISO: () => TODAY,
  supplierName: (id) => ({ S1: 'Kampala Steel', S2: 'Roto' })[id] || String(id),
  productDisplayLabel: (p, vi) => (vi == null ? p.name : p.name + ' v' + vi),
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
    'restockRiskRows', 'purchasePlan', 'dashStockOutExposure',
  ].map((n) => extractFunction(src, n, 'index.html')),
  env, ['restockRiskRows', 'purchasePlan', 'dashStockOutExposure']);
} catch (e) { err = e; }
t.check(!!scope, `the copilot chain compiles${err ? ` (${err.message})` : ''}`);

/* ---------- 1. the risk ranking ---------------------------------------- */
if (scope) {
  const rows = scope.restockRiskRows(TODAY);
  eq(rows.map((r) => r.name).join(','), 'Screws,Unpriced fast,Cement,Gypsum v1',
    'ranked by how soon each runs out — already-out first');
  eq(rows[0].daysLeft, 0, 'out of stock with demand is zero days left');
  t.check(!rows.some((r) => r.name.startsWith('NoHistory')),
    'no sales history means NO advice — a shelf of it changes nothing');
  const cement = rows.find((r) => r.name === 'Cement');
  t.check(cement.units30 === 60 && cement.dailyRate === 2 && cement.daysLeft === 2,
    'velocity is the invoiced 30-day demand: the voided and the out-of-window orders count for nothing');
}

/* ---------- 2. the plan: packs, tiers, budget -------------------------- */
if (scope) {
  const plan = scope.purchasePlan(900000, null, TODAY);
  eq(plan.coverDays, 14, 'cover comes from the shop preset');
  eq(plan.lines.map((l) => l.name).join(','), 'Screws,Cement,Gypsum v1',
    'the plan follows the risk order');

  const cement = plan.lines.find((l) => l.name === 'Cement');
  t.check(cement.supplier === 'Roto' && cement.unitCost === 27000,
    'the supplier is the cheapest AT the needed quantity — the volume tier flips the pick');
  eq(cement.buyQty, 30, 'the refill (24 needed) rounds UP to the supplier\'s pack of 10');
  eq(cement.cost, 810000, 'and is costed at the rounded quantity');

  const gypsum = plan.lines.find((l) => l.name === 'Gypsum v1');
  t.check(gypsum.buyQty === 4 && gypsum.unitCost === 1800,
    'rounding 2-needed up to the box of 4 reaches the wholesale price — a bigger buy can only help');

  const screws = plan.lines.find((l) => l.name === 'Screws');
  t.check(screws.buyQty === 14 && screws.cost === 7000,
    'no pack size means the exact refill, at the only price on file');

  eq(plan.spend, 824200, 'the spend is the sum of what fit');
  eq(plan.didNotFit.length, 0, 'everything fit this budget');
  eq(plan.sourceFirst.length, 1, 'one fast mover has no priced supplier');
  t.check(plan.sourceFirst[0].name === 'Unpriced fast' && plan.sourceFirst[0].qty === 9,
    'and it is NAMED with the quantity it needs — never priced by guesswork, never dropped');

  /* A budget too small for the big line: the tail is named and the
     smaller line after it still fits — greedy, not give-up. */
  const tight = scope.purchasePlan(500000, null, TODAY);
  eq(tight.lines.map((l) => l.name).join(','), 'Screws,Gypsum v1',
    'what fits is bought in risk order, past the line that did not');
  eq(tight.didNotFit.map((l) => l.name).join(','), 'Cement',
    'and what did not fit is NAMED, never silently dropped');
  eq(tight.spend, 14200, 'with the spend honest about it');
}

/* ---------- 3. one velocity, one story --------------------------------- */
if (scope) {
  const out = scope.dashStockOutExposure();
  eq(out.map((r) => r.name).join(','), 'Screws,Unpriced fast,Cement',
    'the stock-out alert reads the SAME rows (daysLeft < 10, top 3)');
  const cement = out.find((r) => r.name === 'Cement');
  t.check(cement.dailyRate === 2 && cement.qty === 4 && cement.key === 'P1'
    && cement.productId === 'P1' && cement.variantIdx === null,
    'and keeps the exact shape dashAlerts joins on');
  const delegSrc = extractFunction(src, 'dashStockOutExposure', 'index.html');
  t.check(/restockRiskRows\(todayISO\(\)\)/.test(delegSrc),
    'delegation in the source too — the alert cannot grow its own velocity again');
}

/* ---------- 4. the wiring ---------------------------------------------- */
{
  t.check(/id="dash_buyPlan"/.test(src) && /id="dash_buy_budget"/.test(src) && /id="dash_buy_cover"/.test(src),
    'the What-to-buy panel exists with its budget and cover controls');
  const dash = extractFunction(src, 'renderDashboard', 'index.html');
  t.check(/renderPurchasePlanPanel\(\);/.test(dash), 'and renders with the dashboard');
  const panel = extractFunction(src, 'renderPurchasePlanPanel', 'index.html');
  t.check(/cashOnHandByAccount\(\)\.total/.test(panel),
    'the default budget is the cash actually on hand');
  t.check(/captureSourcingLeadAndSave\(\{ name: l\.name, source: 'copilot', qty: l\.buyQty,/.test(src),
    'Source-it travels the same sourcing door as every other ask, with qty and reason');
  t.check(/Nothing runs out within \$\{plan\.coverDays\} days — no buying needed\./.test(panel),
    'a quiet shelf is said plainly');
  t.check(/restockCoverDays:d\.presetRestockCoverDays/.test(src)
    && /presetRestockCoverDays: presets\.restockCoverDays != null \? Number\(presets\.restockCoverDays\) : 14/.test(src),
    'the cover preset loads and persists like every other preset');
  t.check(/purchase_plan: \{ confirm: false, run\(input\)\{/.test(src)
    && /plan\.lines\.slice\(0, 10\)/.test(src),
    'the assistant tool is a read, capped for speech, over the SAME purchasePlan');
  const api = read('api/assistant.js');
  t.check(/name: 'purchase_plan',/.test(api) && /Omit to use cash on hand\./.test(api),
    'the server offers it, budget optional');
}

process.exit(t.done() ? 1 : 0);
