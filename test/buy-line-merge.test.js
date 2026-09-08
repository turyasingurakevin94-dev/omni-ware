#!/usr/bin/env node
'use strict';
/*
 * ONE PRODUCT, ONE DECISION.
 *
 * From the owner's own screen. ABC Black Screws stood on the buy plan
 * twice, and both rows were true:
 *
 *   Out now   Buy 20 Box (1 Ctn) from ABC at 10,500 — 210,000
 *             1 sold in 30 days · 0 on the shelf
 *   Buy-in    Buy 240 Box (12 Ctn) from ABC at 10,500 — 2,520,000
 *             7 buy-ins this month · 240 Box bought in
 *
 * Two readings, two arguments, one product from one supplier. But it is
 * ONE decision — how many do I buy from ABC — and ordering the 240
 * covers the 20. The screen left the owner to notice that, and the
 * ordering basket would cheerfully raise 2,730,000 of goods for a shop
 * that wanted 2,520,000.
 *
 * What this file holds to account:
 *
 *   ONE ROW PER PRODUCT. Whatever the two readings say, the plan offers
 *   one line and one price for one shelf.
 *
 *   THE BIGGER QUANTITY WINS, AND IS COMPARED, NEVER PRESUMED. A shop
 *   that sells mostly off its own shelf can need more for the shelf
 *   than it has ever bought in, and then the refill is the answer.
 *
 *   RE-READ AT WHAT IS BEING BOUGHT. The surviving line is the one
 *   actually costed at the winning quantity — the cheapest supplier at
 *   240 is not always the cheapest at 20.
 *
 *   NEITHER ARGUMENT IS LOST. The row carries the case it did not keep
 *   and says both, because a merged row arguing only one half has
 *   thrown away half the reason to buy it.
 *
 *   AND THE URGENT HALF TRAVELS. A stocking line knows nothing about
 *   the shelf, so a merge keeping only its figures would drop "the
 *   shelf is empty" — the one fact on the row with a deadline on it.
 *
 * Run: node test/buy-line-merge.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('one product, one decision');
const src = read('index.html');
const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);

const TODAY = '2026-08-27';

/* P1 raises BOTH arguments: it sold off the shelf and ran out, and it
   has been bought in for three separate orders and never held. That is
   the owner's ABC Black Screws, in miniature. */
const makeData = (over) => Object.assign({
  presetRestockCoverDays: 14,
  presetBuyOrders: {},
  products: [{ id: 'P1', name: 'Black Screws', variants: [] }],
  stock: { P1: 0 },
  savedQuotes: [
    { id: 1, invoiced: true, voided: false, date: '2026-08-22', items: [
      { productId: 'P1', variantIdx: null, qty: 6, supplierId: '__stock__', sellPrice: 14000, _stockLots: [{ qty: 6, cost: 10500 }] },
      { productId: 'P1', variantIdx: null, qty: 80, supplierId: 'S1', price: 10500, sellPrice: 14000 } ] },
    { id: 2, invoiced: true, voided: false, date: '2026-08-24', items: [
      { productId: 'P1', variantIdx: null, qty: 80, supplierId: 'S1', price: 10500, sellPrice: 14000 } ] },
    { id: 3, invoiced: true, voided: false, date: '2026-08-25', items: [
      { productId: 'P1', variantIdx: null, qty: 80, supplierId: 'S1', price: 10500, sellPrice: 14000 } ] },
  ],
  prices: [
    { id: 1, productId: 'P1', variantIdx: null, supplierId: 'S1', wholesale: 10500, retail: 11000,
      unit: 'Box', packQty: 20, packUnit: 'Ctn', tiers: [], outOfStock: false },
  ],
}, over || {});

const CHAIN = ['waSalesByKey', 'waDaysBetween', 'waWeekday', 'stockKey', 'stockOnHand', 'getStockQty',
  'productPriceRows', 'rankedPriceRows', 'rankedPurchaseRowsAtQty',
  'purchasePriceAtQty', 'tieredUnitPrice', 'tiersForKind',
  'quoteItemSellPrice', 'invoiceLineCost', 'buyKeptPct',
  'buyKeyParts', 'buyKeyLabel', 'buyPriceStamp', 'buyPriceNow', 'buyHoldFor',
  'restockRiskRows', 'stockingCandidates', 'buyLineFor', 'buyRanOut', 'daysSinceDate', 'buyLineMerge',
  'buyLineReason', 'buyLineAlsoReason',
  'reorderRuleFor', 'supplierLeadTimes', 'supplierLeadDays',
  'buyOrderTotal', 'buyOrderIsOpen', 'buyOrdersOnTheWay', 'buyOrdersCommitted',
  'purchasePlan'];
const CONSTS = ['REPEAT_BUYIN_ORDERS', 'LEAD_TIME_WINDOW_DAYS', 'LEAD_TIME_MIN_DELIVERIES',
  'BUY_HOLD_MAX_DAYS', 'BUY_HOLD_KEEP_DAYS', 'BUY_ORDER_STALE_DAYS', 'BUY_ORDER_KEEP_DAYS'];

const build = (data, over) => compileScope(
  CHAIN.map((n) => extractFunction(src, n, 'index.html'))
    .concat(CONSTS.map((n) => extractDeclaration(src, n, 'index.html'))),
  Object.assign({
    data,
    /* What the shop wrote down about its own goods, as the one reader
       returns it. This fixture has written none. */
    pairCompanionsFor: () => [],
    todayISO: () => TODAY,
    daysSinceDate: () => -1,
    supplierName: (id) => ({ S1: 'ABC', S2: 'Roto' })[id] || String(id),
    productDisplayLabel: (p) => p.name,
    fmtUGX: (n) => Number(n || 0).toLocaleString('en-US') + ' UGX',
    allProductVariantEntries: () => data.products.map((p) => ({ p, variantIdx: null })),
    Date, Math, Number, String, Array, Object, Boolean, JSON, Map, Set,
  }, over || {}),
  CHAIN);

/* ---------- 1. both readings really do fire ------------------------- */
{
  const s = build(makeData());
  const refills = s.restockRiskRows(TODAY);
  const stocking = s.stockingCandidates(TODAY);
  eq(refills.length, 1, 'the shelf reading claims it — 6 sold off the shelf, none left');
  eq(stocking.length, 1, 'and so does the buy-in reading — 240 bought in across three orders, never held');
  eq(refills[0].key, stocking[0].key,
    'ABOUT THE SAME SHELF KEY — which is the whole difficulty: two true arguments, one product, one supplier');
}

/* ---------- 2. and the plan offers ONE line ------------------------- */
{
  const s = build(makeData());
  const plan = s.purchasePlan(null, null, TODAY);
  eq(plan.lines.length, 1,
    'ONE ROW PER PRODUCT — two prices for one shelf is two orders for one delivery, and the owner is the one who pays for the confusion');
  const l = plan.lines[0];
  eq(l.buyQty, 240, 'the BIGGER quantity wins: ordering the month covers the fortnight');
  eq(l.kind, 'stock', 'carried by the reading that asked for it');
  eq(l.cost, 2520000, 'costed at what is actually being bought');
  eq(l.alsoKind, 'refill', 'AND THE OTHER CASE IS CARRIED, not dropped');
  eq(l.alsoQty, 20, 'with what it would have asked for on its own');
}

/* ---------- 3. bigger is compared, never presumed -------------------- */
{
  /* The same shop, selling hard off its OWN shelf: 300 units in 30 days
     off stock against three buy-ins of 20. Now the refill is the bigger
     argument, and a merge that always kept the stocking line would order
     20 for a shelf that empties in two days. */
  const data = makeData({
    stock: { P1: 0 },
    savedQuotes: [
      { id: 1, invoiced: true, voided: false, date: '2026-08-22', items: [
        { productId: 'P1', variantIdx: null, qty: 100, supplierId: '__stock__', sellPrice: 14000, _stockLots: [{ qty: 100, cost: 10500 }] },
        { productId: 'P1', variantIdx: null, qty: 20, supplierId: 'S1', price: 10500, sellPrice: 14000 } ] },
      { id: 2, invoiced: true, voided: false, date: '2026-08-24', items: [
        { productId: 'P1', variantIdx: null, qty: 100, supplierId: '__stock__', sellPrice: 14000, _stockLots: [{ qty: 100, cost: 10500 }] },
        { productId: 'P1', variantIdx: null, qty: 20, supplierId: 'S1', price: 10500, sellPrice: 14000 } ] },
      { id: 3, invoiced: true, voided: false, date: '2026-08-25', items: [
        { productId: 'P1', variantIdx: null, qty: 100, supplierId: '__stock__', sellPrice: 14000, _stockLots: [{ qty: 100, cost: 10500 }] },
        { productId: 'P1', variantIdx: null, qty: 20, supplierId: 'S1', price: 10500, sellPrice: 14000 } ] },
    ],
  });
  const s = build(data);
  eq(s.stockingCandidates(TODAY).length, 1, 'the buy-in reading still fires — three orders, never held');
  const plan = s.purchasePlan(null, null, TODAY);
  eq(plan.lines.length, 1, 'still one row');
  const l = plan.lines[0];
  eq(l.kind, 'refill',
    'AND THIS TIME THE REFILL WINS — a shop selling off its own shelf can need more than it has ever bought in, so bigger is compared and never presumed');
  t.check(l.buyQty > 60,
    `the shelf's own need is what is ordered (${l.buyQty}), not the 20 the buy-in reading asked for`);
  eq(l.alsoKind, 'stock', 'with the other case carried the other way round');
}

/* ---------- 4. the urgent half travels ------------------------------- */
{
  const s = build(makeData());
  const l = s.purchasePlan(null, null, TODAY).lines[0];
  t.check(l.daysLeft != null && l.daysLeft <= 0,
    'A STOCKING ROW KNOWS NOTHING ABOUT THE SHELF, so the merge carries the shelf’s own answer: this one is out now');
  eq(l.held, 0, 'holding nothing');
}

/* ---------- 5. and the sentence still argues both cases -------------- */
{
  const s = build(makeData());
  const l = s.purchasePlan(null, null, TODAY).lines[0];
  const why = s.buyLineReason(l);
  t.check(/Bought in for 3 orders this month/.test(why), 'the case it kept is made');
  t.check(/shelf is empty too/.test(why),
    'AND THE CASE IT DID NOT — a merged row arguing one half has thrown away half the reason to buy it');
  t.check(/answers both/.test(why), 'saying plainly that one buy settles the pair');

  /* And the other way round, on the shelf-led shop. */
  const data = makeData({
    stock: { P1: 0 },
    savedQuotes: [
      { id: 1, invoiced: true, voided: false, date: '2026-08-22', items: [
        { productId: 'P1', variantIdx: null, qty: 100, supplierId: '__stock__', sellPrice: 14000, _stockLots: [{ qty: 100, cost: 10500 }] },
        { productId: 'P1', variantIdx: null, qty: 20, supplierId: 'S1', price: 10500, sellPrice: 14000 } ] },
      { id: 2, invoiced: true, voided: false, date: '2026-08-24', items: [
        { productId: 'P1', variantIdx: null, qty: 100, supplierId: '__stock__', sellPrice: 14000, _stockLots: [{ qty: 100, cost: 10500 }] },
        { productId: 'P1', variantIdx: null, qty: 20, supplierId: 'S1', price: 10500, sellPrice: 14000 } ] },
      { id: 3, invoiced: true, voided: false, date: '2026-08-25', items: [
        { productId: 'P1', variantIdx: null, qty: 100, supplierId: '__stock__', sellPrice: 14000, _stockLots: [{ qty: 100, cost: 10500 }] },
        { productId: 'P1', variantIdx: null, qty: 20, supplierId: 'S1', price: 10500, sellPrice: 14000 } ] },
    ],
  });
  const s2 = build(data);
  const why2 = s2.buyLineReason(s2.purchasePlan(null, null, TODAY).lines[0]);
  t.check(/off the shelf/.test(why2), 'the shelf case is made');
  t.check(/also bought in for 3 orders a month/.test(why2), 'and the buy-in case beside it');
  t.check(/one buy instead of the refill and those trips/.test(why2),
    'naming what the single order replaces');
}

/* ---------- 6. a line with only ONE case is left alone ---------------- */
{
  /* Nothing bought in at all: the shelf reading is the only one, and a
     merge that touched it would be inventing a second argument. */
  const data = makeData({
    savedQuotes: [
      { id: 1, invoiced: true, voided: false, date: '2026-08-22', items: [
        { productId: 'P1', variantIdx: null, qty: 60, supplierId: '__stock__', sellPrice: 14000, _stockLots: [{ qty: 60, cost: 10500 }] } ] },
    ],
  });
  const s = build(data);
  eq(s.stockingCandidates(TODAY).length, 0, 'nothing was bought in, so there is no second case');
  const l = s.purchasePlan(null, null, TODAY).lines[0];
  eq(l.kind, 'refill', 'the one reading that fired is the line');
  eq(l.alsoKind, undefined, 'and it claims no second argument it does not have');
  /* NEITHER TAIL, not just the one that matches this line's kind. The
     tail is written from alsoKind, and a guard that only checked for
     truthiness would fall through to the OTHER branch and print "the
     shelf is empty too" on every single-case row in the shop. */
  const only = s.buyLineReason(l);
  t.check(!/also bought in/.test(only) && !/shelf is empty too/.test(only) && !/answers both/.test(only),
    'nor says one, in either wording — a sentence about a case that never fired is an invented reason to buy');
}

/* ---------- 7. and a merged line is still one line to the order ------ */
{
  const s = build(makeData());
  const plan = s.purchasePlan(null, null, TODAY);
  const tags = plan.lines.concat(plan.didNotFit).map((l) => l.tag);
  eq(new Set(tags).size, tags.length,
    'every row on the plan has a row id of its own — the basket, the review and the Manager’s tool all resolve on it');
  eq(tags.filter(Boolean).length, tags.length, 'and none of them is missing');
}

/* ---------- 8. and ALL of it reaches the screen ---------------------- *
 *
 * The merge was built, tested and correct, and the card still read as
 * though half of it had never happened: the row renders buyLineWhy, not
 * buyLineReason, and the chip read `kind` before it read the shelf. So
 * a line with nothing left to sell wore a quiet grey "Buy-in" and its
 * sentence argued one case. Everything above this block passed
 * throughout. This is the block that would not have.
 */
{
  const el = { innerHTML: '', querySelector: () => null, querySelectorAll: () => [] };
  const s = compileScope(
    CHAIN.map((n) => extractFunction(src, n, 'index.html'))
      .concat(CONSTS.map((n) => extractDeclaration(src, n, 'index.html')))
      .concat(['let buyBudget = null; let buyPlanLast = null; let buyOrderBasket = new Set();',
        extractFunction(src, 'buyLineFacts', 'index.html'),
        extractFunction(src, 'buyLineWhy', 'index.html'),
        extractFunction(src, 'buyHoldsSweep', 'index.html'),
        extractFunction(src, 'liftBuyHold', 'index.html'),
        extractFunction(src, 'buyOrderFor', 'index.html'),
        extractFunction(src, 'buyOrdersAll', 'index.html'),
        extractFunction(src, 'buyOrdersOpenRows', 'index.html'),
        extractFunction(src, 'buyOrdersSweep', 'index.html'),
        extractFunction(src, 'renderPurchasePlanPanel', 'index.html')]),
    {
      data: makeData(),
      pairCompanionsFor: () => [],
      todayISO: () => TODAY, daysSinceDate: () => -1,
      supplierName: (id) => ({ S1: 'ABC' })[id] || String(id),
      productDisplayLabel: (p) => p.name,
      fmtUGX: (n) => Number(n || 0).toLocaleString('en-US') + ' UGX',
      fmtShortDate: (d) => String(d),
      allProductVariantEntries: () => [{ p: { id: 'P1', name: 'Black Screws', variants: [] }, variantIdx: null }],
      saveData: () => {},
      esc: (x) => String(x == null ? '' : x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
      listPageSlice: (_k, rows) => rows, listMoreButtonHTML: () => '',
      targetMarginPct: () => 10,
      collectToBuy: () => null, collectToBuyHTML: () => '',
      cashOnHandByAccount: () => ({ total: 5000000, byAccount: [] }),
      CASH_AHEAD_DAYS: 30,
      cashAhead: () => ({ days: 30, commitments: [], committed: 0, unknown: 0,
        safeToSpend: 5000000, tightest: { date: TODAY, balance: 5000000 } }),
      document: { getElementById: (id) => (id === 'buy_plan' ? el : null), activeElement: null },
      Date, Math, Number, String, Array, Object, Boolean, JSON, Map, Set,
    }, ['renderPurchasePlanPanel']);

  s.renderPurchasePlanPanel();
  const html = el.innerHTML;
  eq((html.match(/bp-line/g) || []).length, 1, 'ONE ROW on the screen, not two');
  t.check(/240 Box/.test(html) && !/>20 Box/.test(html),
    'at the quantity that covers both');

  /* THE CHIP IS THE ONLY URGENT THING ON THE ROW. Reading `kind` first
     labelled a shelf with nothing left to sell as a quiet grey
     "Buy-in" — the crying-wolf failure inverted: falling silent on the
     row that should be loudest. */
  t.check(/ow-cp ow-bad">Out now/.test(html),
    'and the chip says OUT NOW — the shelf’s own answer, which a stocking row knows nothing about');
  t.check(!/>Buy-in</.test(html), 'not the quiet label of the half that has no deadline');

  t.check(/on the shelf/.test(html) && /bp-fg bad/.test(html),
    'the figures carry the empty shelf too, so they do not sit out of step with the chip');

  t.check(/shelf is empty too/.test(html) && /answers both/.test(html),
    'AND THE SENTENCE ARGUES BOTH CASES — the card renders buyLineWhy, and a tail added only to buyLineReason reaches the assistant and never the owner');
}

process.exit(t.done() ? 1 : 0);
