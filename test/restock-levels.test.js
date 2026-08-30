#!/usr/bin/env node
'use strict';
/*
 * Restock levels, and how long a supplier actually takes.
 *
 * The buying plan asked the shelf to cover N days and then behaved as
 * though goods arrived the moment they were ordered. Two things fix
 * that, and both are answerable from records the shop already keeps or
 * sets by hand:
 *
 *   LEAD TIME, MEASURED. Every arrival ticked in against an order is
 *   stamped, and the order carries its own date, so the wait is on
 *   file. The MEDIAN, so one broken-down lorry does not move the plan,
 *   and never from a single delivery — one arrival is an anecdote.
 *
 *   A FLOOR THE SHOP SETS. Sales pace cannot know that a staple must
 *   never run out, or that this line is worth carrying longer. Both
 *   overrides are optional, and a line without them behaves exactly as
 *   it did before.
 *
 * Run: node test/restock-levels.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('restock levels');
const src = read('index.html');
const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);

const TODAY = '2026-08-27';
const ago = (d) => new Date(Date.parse(TODAY + 'T00:00:00Z') - d * 86400000).toISOString().slice(0, 10);
const at = (d) => ago(d) + 'T09:00:00.000Z';

/* Two suppliers with real delivery histories: S1 is quick, S2 drags.
   P1 sells steadily off the shelf, which is what a refill answers to. */
const shelfSale = (qty) => ({ productId: 'P1', variantIdx: null, qty, supplierId: '__stock__',
  sellPrice: 40000, _stockLots: [{ qty, cost: 30000 }] });

const data = {
  presetRestockCoverDays: 14,
  presetReorderRules: {},
  products: [
    { id: 'P1', name: 'Cement', variants: [] },
    { id: 'P2', name: 'Slow Staple', variants: [] },
  ],
  stock: { P1: 30, P2: 4 },
  savedQuotes: [
    // Shelf sales inside the 30-day window: 60 units, so 2 a day.
    { id: 1, invoiced: true, voided: false, date: ago(10), items: [shelfSale(30)] },
    { id: 2, invoiced: true, voided: false, date: ago(4), items: [shelfSale(30)] },
    // P2 sells slowly off the shelf: 3 in 30 days, 0.1 a day.
    { id: 3, invoiced: true, voided: false, date: ago(8), items: [
      { productId: 'P2', variantIdx: null, qty: 3, supplierId: '__stock__', sellPrice: 9000,
        _stockLots: [{ qty: 3, cost: 6000 }] }] },
    /* Deliveries. S1: 2, 4 and 3 days — quick, three arrivals.
       S2: 9 and 11 days, plus one arrival stamped BEFORE its order,
       which is unusable rather than a zero-day delivery. */
    { id: 4, invoiced: true, voided: false, date: ago(40), items: [
      { productId: 'P1', variantIdx: null, qty: 10, supplierId: 'S1', price: 30000, sellPrice: 34000,
        receipts: [{ qty: 10, price: 30000, at: at(38) }] }] },
    { id: 5, invoiced: true, voided: false, date: ago(30), items: [
      { productId: 'P1', variantIdx: null, qty: 10, supplierId: 'S1', price: 30000, sellPrice: 34000,
        receipts: [{ qty: 10, price: 30000, at: at(26) }] }] },
    { id: 6, invoiced: true, voided: false, date: ago(20), items: [
      { productId: 'P1', variantIdx: null, qty: 10, supplierId: 'S1', price: 30000, sellPrice: 34000,
        receipts: [{ qty: 10, price: 30000, at: at(17) }] }] },
    { id: 7, invoiced: true, voided: false, date: ago(50), items: [
      { productId: 'P1', variantIdx: null, qty: 10, supplierId: 'S2', price: 29000, sellPrice: 34000,
        receipts: [{ qty: 10, price: 29000, at: at(41) }] }] },
    { id: 8, invoiced: true, voided: false, date: ago(35), items: [
      { productId: 'P1', variantIdx: null, qty: 10, supplierId: 'S2', price: 29000, sellPrice: 34000,
        receipts: [{ qty: 10, price: 29000, at: at(24) }] }] },
    { id: 9, invoiced: true, voided: false, date: ago(15), items: [
      { productId: 'P1', variantIdx: null, qty: 5, supplierId: 'S2', price: 29000, sellPrice: 34000,
        receipts: [{ qty: 5, price: 29000, at: at(18) }] }] },
    // S3 has delivered exactly once: an anecdote, not a lead time.
    { id: 10, invoiced: true, voided: false, date: ago(12), items: [
      { productId: 'P2', variantIdx: null, qty: 5, supplierId: 'S3', price: 6000, sellPrice: 9000,
        receivedAt: at(5) }] },
    // Older than the year-long window: not counted.
    { id: 11, invoiced: true, voided: false, date: ago(500), items: [
      { productId: 'P1', variantIdx: null, qty: 10, supplierId: 'S1', price: 30000, sellPrice: 34000,
        receipts: [{ qty: 10, price: 30000, at: at(400) }] }] },
  ],
  prices: [
    { id: 1, productId: 'P1', variantIdx: null, supplierId: 'S2', wholesale: 29000, retail: 30000,
      unit: 'bag', packQty: 1, packUnit: '', tiers: [], outOfStock: false },
    { id: 2, productId: 'P2', variantIdx: null, supplierId: 'S3', wholesale: 6000, retail: 6200,
      unit: 'pc', packQty: 1, packUnit: '', tiers: [], outOfStock: false },
  ],
};

let saved = 0;
const env = {
  data,
  todayISO: () => TODAY,
  saveData: () => { saved++; },
  supplierName: (id) => ({ S1: 'Quick Steel', S2: 'Slow Roto', S3: 'Once Only Ltd' })[id] || String(id),
  productDisplayLabel: (p, vi) => (vi == null ? p.name : p.name + ' v' + vi),
  fmtUGX: (n) => Number(n || 0).toLocaleString('en-US') + ' UGX',
  allProductVariantEntries: () => data.products.map((p) => ({ p, variantIdx: null })),
};

let scope = null; let err = null;
try {
  scope = compileScope([
    'waSalesByKey', 'waDaysBetween', 'waWeekday', 'stockKey', 'getStockQty',
    'productPriceRows', 'rankedPriceRows', 'rankedPurchaseRowsAtQty',
    'purchasePriceAtQty', 'tieredUnitPrice', 'tiersForKind',
    'quoteItemSellPrice', 'invoiceLineCost',
    'supplierLeadTimes', 'supplierLeadDays', 'reorderRuleFor', 'setReorderRule',
    'restockRiskRows', 'stockingCandidates', 'buyLineFor', 'buyLineReason',
    'buyOrderTotal', 'buyOrderIsOpen', 'buyOrdersOnTheWay', 'buyOrdersCommitted', 'purchasePlan',
    'buyKeptPct', 'buyHoldFor',
  ].map((n) => extractFunction(src, n, 'index.html'))
    .concat([
      extractDeclaration(src, 'REPEAT_BUYIN_ORDERS', 'index.html'),
      extractDeclaration(src, 'LEAD_TIME_WINDOW_DAYS', 'index.html'),
      extractDeclaration(src, 'LEAD_TIME_MIN_DELIVERIES', 'index.html'),
      extractDeclaration(src, 'BUY_ORDER_STALE_DAYS', 'index.html'),
      extractDeclaration(src, 'BUY_ORDER_KEEP_DAYS', 'index.html'),
    ]),
  env, ['supplierLeadTimes', 'supplierLeadDays', 'reorderRuleFor', 'setReorderRule',
    'restockRiskRows', 'purchasePlan', 'buyLineReason']);
} catch (e) { err = e; }
t.check(!!scope, `the restock chain compiles${err ? ` (${err.message})` : ''}`);

/* ---------- 1. how long each supplier actually takes ------------------ */
if (scope) {
  const lead = scope.supplierLeadTimes(TODAY);
  const by = (id) => lead.find((x) => x.supplierId === id);

  eq(by('S1').days, 3, 'the wait is the MEDIAN of what the shop actually waited — 2, 3 and 4 days');
  eq(by('S1').deliveries, 3, 'counted over the arrivals inside the window');
  t.check(by('S1').typical, 'three deliveries is enough to call it typical');

  eq(by('S2').days, 10, 'a slower supplier is measured just as plainly (9 and 11)');
  eq(by('S2').unusable, 1,
    'an arrival stamped BEFORE its own order is counted as unusable, never folded in as an instant delivery');

  t.check(by('S3').deliveries === 1 && by('S3').typical === false,
    'one delivery is an anecdote — reported, but never called a typical wait');
  eq(scope.supplierLeadDays('S3', TODAY), null, 'so the plan is told nothing rather than something shaky');
  eq(scope.supplierLeadDays('S1', TODAY), 3, 'while a real history is handed over');
  eq(scope.supplierLeadDays('S9', TODAY), null, 'and a supplier who has never delivered says nothing');

  t.check(!lead.some((x) => x.days > 100),
    'a delivery older than the year-long window is not dragged into the figure');
}

/* ---------- 2. the wait is bought as well as the cover ---------------- */
if (scope) {
  /* P1: 30 on the shelf, selling 2 a day — 15 days of cover, which is
     MORE than the shop's 14, so the old plan would have bought nothing.
     Slow Roto takes 10 days, so 14 days of cover really means 24. */
  const plan = scope.purchasePlan(null, null, TODAY);
  const cement = plan.lines.find((l) => l.name === 'Cement');
  t.check(!!cement, 'a shelf with 15 days of cover from a supplier who takes 10 IS a refill');
  eq(cement.leadDays, 10, 'the line carries the wait it was costed against');
  eq(cement.buyQty, 18, 'and buys the cover PLUS the wait: 24 days of selling, less the 30 held');
  t.check(/taken about 10 days to deliver/.test(cement.reason)
    && /covers the wait as well as the 14 days/.test(cement.reason),
    `the reason says so in words (${cement.reason})`);
}

/* ---------- 3. a floor the shop sets by hand -------------------------- */
if (scope) {
  /* P2 sells 0.1 a day with 4 on the shelf — 40 days of cover, so no
     sales figure will ever call it urgent. The shop knows better. */
  t.check(!scope.purchasePlan(null, null, TODAY).lines.some((l) => l.name === 'Slow Staple'),
    'a slow line inside its cover is not bought, and should not be');

  scope.setReorderRule('P2', null, 12, 0);
  t.check(saved > 0, 'setting a level saves it');
  eq(scope.reorderRuleFor('P2', null).minUnits, 12, 'and reads back');

  const staple = scope.purchasePlan(null, null, TODAY).lines.find((l) => l.name === 'Slow Staple');
  t.check(!!staple, 'below the floor it IS bought, however slowly it sells');
  t.check(staple.belowFloor && staple.floor === 12, 'the line knows why it is there');
  t.check(staple.buyQty >= 8, `and buys at least back up to the floor (${staple.buyQty})`);
  t.check(/under the 12 you asked to always keep/.test(staple.reason),
    `with the reason saying it plainly (${staple.reason})`);

  /* A per-line cover override, on a line the shop cover would not flag. */
  scope.setReorderRule('P2', null, 0, 90);
  const covered = scope.purchasePlan(null, null, TODAY).lines.find((l) => l.name === 'Slow Staple');
  t.check(!!covered && covered.coverDays === 90,
    'a line carrying its own cover is measured against that, not the shop default');
  t.check(!covered.belowFloor, 'and is not pretending to be below a floor it does not have');

  scope.setReorderRule('P2', null, 0, 0);
  eq(scope.reorderRuleFor('P2', null), null,
    'clearing both leaves NO rule — a line that says nothing is not stored as zeroes');
  t.check(!scope.purchasePlan(null, null, TODAY).lines.some((l) => l.name === 'Slow Staple'),
    'and the line follows the shop default again');
}

/* ---------- 4. the wiring --------------------------------------------- */
{
  t.check(/id="reorderModal"/.test(src) && /id="ro_min"/.test(src) && /id="ro_cover"/.test(src),
    'the restock level is set in its own small editor');
  const inv = extractFunction(src, 'renderInventory', 'index.html');
  t.check(/inv-reorder-btn/.test(inv) && /openReorderEditor\(btn\.dataset\.id, vidx\)/.test(inv),
    'opened from the shelf, where a level is decided');
  t.check(/inv-low-pill/.test(inv) && /'below ' : 'keep '/.test(inv),
    'and a line under its floor says so on the card, beside the level it is under');
  const line = extractFunction(src, 'inventoryLineFor', 'index.html');
  t.check(/belowFloor: !!\(rule && rule\.minUnits && qty < rule\.minUnits\)/.test(line),
    'from the same rule the buying plan reads — one answer, two screens');
  t.check(/reorderRules:d\.presetReorderRules\|\|\{\}/.test(src)
    && /presetReorderRules: \(presets\.reorderRules/.test(src),
    'the levels load and persist with the shop settings — no migration needed');
  const ed = extractFunction(src, 'openReorderEditor', 'index.html');
  t.check(/restockRiskRows\(todayISO\(\)\)/.test(ed),
    'and the editor shows the line\'s real pace, so a number is typed against evidence');
}

process.exit(t.done() ? 1 : 0);
