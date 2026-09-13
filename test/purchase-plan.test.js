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
  /* What the shop wrote down about its own goods, as the one reader
     returns it. Empty unless a check below writes a rule down. */
  pairCompanionsFor: (pid, vi) => (data.__companions || {})[pid + '::' + (vi == null ? '' : vi)] || [],
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
    'waSalesByKey', 'waDaysBetween', 'waWeekday', 'stockKey', 'stockOnHand', 'getStockQty',
    'productPriceRows', 'rankedPriceRows', 'rankedPurchaseRowsAtQty',
    'purchasePriceAtQty', 'tieredUnitPrice', 'tiersForKind',
    'quoteItemSellPrice', 'invoiceLineCost',
    'restockRiskRows', 'stockingCandidates', 'buyLineFor', 'buyRanOut', 'daysSinceDate', 'buyLineMerge',
    'buyLineReason', 'buyLineAlsoReason',
    'buyLineFacts', 'buyLineWhy', 'buyKeptPct',
    'buyKeyParts', 'buyKeyLabel', 'buyPriceStamp', 'buyPriceNow',
    'buyHoldFor', 'setBuyHold', 'liftBuyHold', 'buyHoldsStanding', 'buyHoldsSweep',
    'effectiveMarkupRule', 'effectiveStockMarkupRule', 'suggestedStockSellingPrice',
    'reorderRuleFor', 'supplierLeadTimes', 'supplierLeadDays',
    /* The plan reads what is already on order before it costs a line,
       so the ordering chain travels with it. */
    'buyOrderTotal', 'buyOrderIsOpen', 'buyOrdersOnTheWay', 'buyOrdersCommitted',
    'purchasePlan', 'dashStockOutExposure',
  ].map((n) => extractFunction(src, n, 'index.html'))
    .concat([
      extractDeclaration(src, 'REPEAT_BUYIN_ORDERS', 'index.html'),
      extractDeclaration(src, 'LEAD_TIME_WINDOW_DAYS', 'index.html'),
      extractDeclaration(src, 'LEAD_TIME_MIN_DELIVERIES', 'index.html'),
      extractDeclaration(src, 'THIN_MARGIN_PCT', 'index.html'),
      extractDeclaration(src, 'BUY_HOLD_MAX_DAYS', 'index.html'),
      extractDeclaration(src, 'BUY_HOLD_KEEP_DAYS', 'index.html'),
      extractDeclaration(src, 'BUY_ORDER_STALE_DAYS', 'index.html'),
      extractDeclaration(src, 'BUY_ORDER_KEEP_DAYS', 'index.html'),
    ]),
  env, ['waSalesByKey', 'restockRiskRows', 'stockingCandidates', 'buyLineReason',
    'buyLineFacts', 'buyLineWhy', 'purchasePlan', 'dashStockOutExposure']);
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
  /* WHAT TO BUY IS A LENS, NOT A SCREEN. It, What's coming and The day
     asked one question -- what is coming -- at three horizons, from
     three different groups of the rail, and the dependency between them
     was only ever in the code: the first line of renderPurchasePlanPanel
     reads cashAhead().safeToSpend, because the plan a shop can afford IS
     the low point of the cash line. They are the three lenses of
     Forecasts now.

     What this check meant -- that the plan is reachable in one press
     from the rail rather than buried inside another screen -- still
     holds, and the row that reaches it is Forecasts. The old key is not
     abandoned: resolveTab turns 'buying' into the Stock lens, so every
     door already written, a saved last-tab and the Manager's own moves
     all still land on the plan. */
  t.check(/id="tab-forecasts"/.test(src) && /data-tab="forecasts"/.test(src),
    'the plan is one press from the rail, as the Stock lens of Forecasts');
  const resolve = extractFunction(src, 'resolveTab', 'index.html');
  t.check(/if\(tab === 'buying'\)\{ fcLens = 'stock'; return 'forecasts'; \}/.test(resolve),
    "and the old door still opens it — 'buying' presses the Stock lens rather than throwing on a section that is gone");
  t.check(/data-fclens="stock"/.test(src), 'which the lens switch can be pressed to directly');
  t.check(/id="buy_plan"/.test(src) && /id="buy_budget"/.test(src) && /id="buy_cover"/.test(src),
    'with its budget and cover controls');
  const go = extractFunction(src, 'goToTab', 'index.html');
  t.check(/if\(tab==='forecasts'\) renderForecasts\(\);/.test(go),
    'and redraws on entry, like every other data screen');
  const rf = extractFunction(src, 'fcApplyLens', 'index.html');
  t.check(/if\(fcLens === 'stock'\) renderPurchasePlanPanel\(\);/.test(rf),
    'which draws the plan when the Stock lens is the one open');
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
  /* The reason is the row's argument line (.bp-w), drawn from
     buyLineWhy -- the same sentence the assistant is handed. */
  t.check(/class="bp-w"/.test(panel) && /buyLineWhy\(l\)/.test(panel), 'and every row carries its reason');

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

/* ---------- 6. the screen is a decision, not a paragraph ------------- */
/*
 * Every row read as forty words of prose carrying six figures, and the
 * one line that said what to actually DO -- buy 1 Ctn from Roto -- was
 * the smallest, faintest text in it. Figures inside sentences also
 * cannot be compared down a list: the shop could not see which of
 * thirteen lines earned most without reading all thirteen.
 *
 * buyLineReason keeps the prose, because the assistant speaks it. The
 * screen takes the same fields as figures.
 */
if (scope) {
  const refill = { kind: 'refill', name: 'Cement', held: 7, units30: 28, orders30: 5,
    profit30: 370000, daysLeft: 7, coverDays: 7, floor: 0, belowFloor: false, leadDays: 1,
    unit: 'bag', buyQty: 10, supplier: 'Roto', unitCost: 30000, cost: 300000 };
  const label = (fs, l) => (fs.find((x) => x.label === l) || {}).v;

  let fs = scope.buyLineFacts(refill);
  eq(label(fs, 'sold in 30 days'), 28, 'a refill is bought on what the shelf sold');
  eq(label(fs, 'earned'), '370,000 UGX', 'and what that earned, which is the ranking');
  eq(label(fs, 'on the shelf'), 7, 'against what is left');
  eq(label(fs, 'to deliver'), '1 day', 'and how long the supplier takes — "1 day", not "1 days"');
  eq(scope.buyLineFacts({ ...refill, leadDays: 10 }).find((x) => x.label === 'to deliver').v,
    '10 days', 'ten of them are days');

  /* A fact the app does not have is ABSENT. Nothing earned and nothing
     recorded as earned are different facts, and a zero standing in a row
     of figures reads as the first. */
  fs = scope.buyLineFacts({ ...refill, leadDays: null, profit30: 0 });
  t.check(!fs.some((x) => x.label === 'to deliver'),
    'no measured lead time, no wait figure — rather than a confident zero');
  t.check(!fs.some((x) => x.label === 'earned'), 'and nothing earned is left out, not shown as 0');

  // A shelf under its floor, and an empty one, are marked rather than
  // described in another sentence.
  t.check(scope.buyLineFacts({ ...refill, held: 2, belowFloor: true })
    .find((x) => x.label === 'on the shelf').cls === 'bad', 'a shelf under its floor is marked');
  t.check(scope.buyLineFacts({ ...refill, held: 0 })
    .find((x) => x.label === 'on the shelf').cls === 'bad', 'so is an empty one');

  const stock = { kind: 'stock', name: 'Wall Angle', held: 0, units30: 20, orders30: 3,
    profit30: 40000, paid30: 260000, bulkCost: 220000, allPriced: true, daysLeft: null,
    unit: 'Box', buyQty: 20, supplier: 'SJS', unitCost: 11000, cost: 220000 };
  fs = scope.buyLineFacts(stock);
  eq(label(fs, 'buy-ins this month'), 3, 'a buy-in line is bought on how often it was bought in');
  eq(label(fs, 'paid across them'), '260,000 UGX', 'and what those trips actually cost');
  eq(label(fs, 'saved buying once'), '40,000 UGX', 'against the price on file for the same total in one');
  eq(scope.buyLineFacts({ ...stock, orders30: 1 })
    .find((x) => x.label === 'buy-in this month').v, 1, 'one of them is a buy-in, singular');

  /* No saving is claimed on a half-recorded cost history: arithmetic
     against a blank flatters itself every time. */
  t.check(!scope.buyLineFacts({ ...stock, allPriced: false }).some((x) => x.label === 'saved buying once'),
    'a buy-in whose history is missing prices shows no saving — it cannot be worked out');
  t.check(!scope.buyLineFacts({ ...stock, bulkCost: 300000 }).some((x) => x.label === 'saved buying once'),
    'and neither does one where buying once costs more');

  /* The argument still has words, because "7 on the shelf · 1 day to
     deliver" says what is true and not why that means buy today. */
  const why = scope.buyLineWhy(refill);
  t.check(/Runs out in about 7 days/.test(why) && /covers the wait/.test(why),
    `a refill says why now (${why})`);
  t.check(/under a day/.test(scope.buyLineWhy({ ...refill, daysLeft: 0.4 })),
    'a shelf with hours left says under a day, not "about 0 days"');
  t.check(/Nothing left to sell/.test(scope.buyLineWhy({ ...refill, held: 0, daysLeft: 0 })),
    'an empty shelf says so first');
  t.check(/under the 12 you asked to always keep/.test(
    scope.buyLineWhy({ ...refill, floor: 12, belowFloor: true })), 'and a floor is named');
  t.check(/never held here/.test(scope.buyLineWhy(stock)), 'a buy-in line says what it is');

  /* The same two faults in the SPOKEN text, which the assistant reads
     out: "Roto Industry has taken about 1 days to deliver" was on the
     owner's screen, and a shelf with half a day left was rounded down
     and then reported as "about 0 days". */
  const said = scope.buyLineReason(refill);
  t.check(/about 1 day to deliver/.test(said) && !/1 days/.test(said),
    `the spoken reason says "1 day" (${said})`);
  t.check(/about 10 days to deliver/.test(scope.buyLineReason({ ...refill, leadDays: 10 })),
    'and "10 days"');
  const hours = scope.buyLineReason({ ...refill, daysLeft: 0.4 });
  t.check(/less than a day/.test(hours) && !/about 0 days/.test(hours),
    `a shelf with hours left is not rounded down to nothing (${hours})`);
}

/* ---------- 6b. and the screen is built like the rest of the app ----- */
{
  const panel = extractFunction(src, 'renderPurchasePlanPanel', 'index.html');

  // The instruction first, then the argument with its figures on the
  // same line -- the argument in words, the figures after it in the
  // mono face, so both can be read down the list.
  const iDo = panel.indexOf('class="bp-do"');
  const iWhy = panel.indexOf('${esc(why)}');
  const iFacts = panel.indexOf("+ fs");
  t.check(iDo > 0 && iDo < iWhy && iWhy < iFacts,
    'the row says what to buy before it says why — it used to be the other way round, in the smallest text on the screen');

  /* THE TWO FIGURES OUTLIVED THE STRIP THEY WERE IN. This lens gave its
     own four tiles to the strip above all three Forecasts lenses, which
     already carries the two of them that are not about buying alone --
     what the shelf needs back in time, and what has run out. The other
     two went where their arithmetic already lives rather than into a
     second 64px band of figures: the plan's total onto the head of the
     panel that lists it, and what is left of the budget onto the foot of
     "Where the budget came from", which is the sum it belongs to.

     So the claim is no longer "they are in a strip" -- it is that
     neither figure was quietly dropped on the way, and that each is
     beside the thing it is a figure ABOUT. */
  const planHeadAt = panel.indexOf('Buy these, in this order');
  const planHead = panel.slice(planHeadAt, panel.indexOf('</div>', planHeadAt));
  t.check(planHeadAt > 0 && /num\(plan\.spend\)/.test(planHead),
    'what the plan comes to is in the head of the panel that lists it');
  t.check(/sr\('Left of it', num\(left\), true\)/.test(panel),
    'and what is left of the budget is the last row of the sum that works the budget out');
  t.check(!/class="ow-strip"/.test(panel),
    'and this lens draws no strip of its own — two stacked is 128px of figures before the work starts');
  t.check(!/Plan total <b>/.test(panel), 'and neither is a footnote under the list');

  /* The two figures live in the page header as labelled fields, beside
     the name of the screen rather than as a form above the list. The
     ids are the same ones the listeners bind to at parse time. */
  t.check(/<label class="ow-f"><span class="ow-f-l">Budget<\/span>[\s\S]{0,160}?id="buy_budget"/.test(src)
    && /<label class="ow-f"><span class="ow-f-l">Cover<\/span>[\s\S]{0,160}?id="buy_cover"/.test(src),
    'the controls are two labelled fields in the header, not a form above the list');
  t.check(/id="buy_budget"/.test(src) && /id="buy_cover"/.test(src),
    'keeping the ids — the listeners bind to them at parse time with no null guard');

  /* THE SPARE PARTS ARE GONE. Consignment, What to buy, Supplier prices
     and Chase debts each have their own shape now, so .buy-controls,
     .buy-row, .buy-main and .buy-tail are dead and deleted. A dead rule
     in the stylesheet is how the next screen ends up wearing one. */
  // Matched as RULE selectors, not as prose: the comments explaining why
  // they went naturally name them, and a test that cannot tell a rule
  // from a sentence about a rule is a test that fails on its own record.
  t.check(!/\.buy-row\{/.test(src) && !/\.buy-controls\{/.test(src) && !/\.buy-tail h4\{/.test(src),
    'the borrowed classes are retired, not left in the drawer');
  t.check(!/class="buy-row"/.test(panel) && !/class="buy-controls"/.test(panel),
    'while this one wears its own');
}

/* ---------- what cannot be sold without the other --------------------- */
/*
 * Sheets bought without the nails that fix them are sheets nobody can
 * use, and the plan ranked the two by what each earned alone — so the
 * nails could sit ten lines below the sheets and fall off the end of
 * the budget. A rule never buys anything: it moves a line the plan had
 * already chosen up beside the line that needs it, and names a needed
 * thing the shelf still has rather than buying it again.
 */
{
  const plain = scope.purchasePlan(null, 14, TODAY);
  const names = plain.lines.map((l) => l.name);
  /* Wall Angle is on the plan; the shop has written that it cannot be
     used without Sofa Legs, which is on the plan too — and without
     Roofing Nails, which the shelf still holds. */
  data.__companions = {
    'P2::': [
      { verbId: 'needs', productId: 'P4', variantIdx: null, label: 'Sofa Legs',
        qty: 40, unit: 'Pc', price: 6000, inStock: true, stock: 12, why: null },
      { verbId: 'needs', productId: 'P9', variantIdx: null, label: 'Roofing Nails',
        qty: 40, unit: 'Kg', price: 6000, inStock: true, stock: 80, why: null },
    ],
  };
  const withRule = scope.purchasePlan(null, 14, TODAY);
  const paired = withRule.lines.filter((l) => l.productId === 'P2' || l.productId === 'P4');
  if (paired.length === 2) {
    const i = withRule.lines.indexOf(paired[0]), j = withRule.lines.indexOf(paired[1]);
    t.check(Math.abs(i - j) === 1, 'a thing that cannot be used without another is bought beside it');
    t.check(withRule.lines.some((l) => l.boughtWith), 'and says which line put it there');
    t.check(/cannot be used without/.test(scope.buyLineWhy(withRule.lines.find((l) => l.boughtWith))),
      'in the sentence the card shows');
  }
  t.check(withRule.alongside.some((a) => a.name === 'Roofing Nails'),
    'a needed thing the shelf still holds is named rather than bought');
  t.check(withRule.alongside.every((a) => a.with), 'and says what needs it');
  t.check(withRule.spend === plain.spend, 'and a rule never changes what the plan spends');
  t.check(withRule.lines.length === plain.lines.length, 'nor how many lines it buys');
  data.__companions = {};
}

/* ---------- 8. priced, and the supplier has run out ---------------------
   The owner's own screen: "Soft Close Mulper (Flat) — 35 sold in 30
   days, 4 needed" filed under SELLING, NO SUPPLIER PRICE ON FILE, the
   morning after the one supplier who sells it was marked out of stock.
   The price was on file the whole time. rankedPriceRows() drops
   out-of-stock rows -- rightly, nobody can be sent to buy from them --
   buyLineFor() then returned null, and the plan had one bucket for
   null which said the registry was empty when it was not.

   Two facts, two buckets, two doors: get a price, or clear a mark. */
if (scope) {
  const angle = data.prices.find((r) => r.id === 3);   // S3, the only quote on Wall Angle
  angle.outOfStock = true;
  angle.outOfStockSince = '2026-08-25';
  const out = scope.purchasePlan(2000000, null, TODAY);

  t.check(out.lines.every((l) => l.name !== 'Wall Angle'),
    'a supplier with none of it is still no place to send anybody — the line leaves the plan');
  t.check(out.sourceFirst.every((s) => s.name !== 'Wall Angle'),
    'but it is NOT "no supplier price on file": the registry has had the price all along');
  eq(out.ranOut.map((s) => s.name).join(','), 'Wall Angle',
    'it stands in its own bucket, which says what is actually wrong');

  const line = out.ranOut[0];
  eq(line.markedOut.who, 'Okuosi Gypsum', 'named: who has run out');
  eq(line.markedOut.days, 2, 'and how long the mark has stood, so a stale one can be doubted');
  eq(line.markedOut.unitCost, 2300, 'with what they last quoted at the quantity wanted — the tier, not the flat figure');
  eq(line.units30, 200, 'carrying the demand that makes it worth chasing a second supplier for');

  /* The other half of the distinction: a line nobody ever quoted still
     belongs where it always did. */
  t.check(out.sourceFirst.some((s) => s.name === 'Half Bend') && !out.ranOut.some((s) => s.name === 'Half Bend'),
    'and a line nobody ever quoted stays under "no supplier price on file"');

  /* A row marked out of stock that carries no price at that quantity is
     not evidence of a price. */
  angle.wholesale = null; angle.retail = null; angle.tiers = [];
  const bare = scope.purchasePlan(2000000, null, TODAY);
  t.check(bare.ranOut.every((s) => s.name !== 'Wall Angle') && bare.sourceFirst.some((s) => s.name === 'Wall Angle'),
    'an out-of-stock row with no figure on it proves nothing, and the line falls back to "no price"');

  angle.outOfStock = false; angle.outOfStockSince = null;
  angle.wholesale = 2500; angle.retail = 2600; angle.tiers = [{ minQty: 200, price: 2300 }];
  const back = scope.purchasePlan(2000000, null, TODAY);
  t.check(back.lines.some((l) => l.name === 'Wall Angle') && !back.ranOut.length,
    'and clearing the mark puts the line straight back in the plan — the bucket is a state, not a record');
}

process.exit(t.done() ? 1 : 0);
