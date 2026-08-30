#!/usr/bin/env node
'use strict';
/*
 * ORDERING WHAT THE PLAN RECOMMENDED.
 *
 * The screen could always say what to buy and never buy it. The owner
 * read the plan, left the app, wrote the supplier a message by hand,
 * and typed the goods in again a week later when the lorry came. In
 * between, the plan knew nothing — so the next morning it recommended
 * the same twelve bags against the same budget, because nothing in the
 * books had moved: the shelf was still empty and no bill existed. The
 * advice was right and the app was arguing with a decision the owner
 * had already taken.
 *
 * An order is written down between the advice and the goods. What this
 * file holds to account is the accounting around it:
 *
 *   AN ORDER OWES NOTHING. It is not a bill and never becomes one by
 *   itself. Nothing is owed until goods arrive, so it is never on the
 *   cash line — no day has been named for paying it, and only dated
 *   money goes on that line.
 *
 *   BUT IT COMMITS. What is on the way comes off the NEED so a line is
 *   not recommended twice, and what it cost comes off the BUDGET so
 *   the same shilling is not offered to a second supplier.
 *
 *   WHAT CAME IS WHAT IS BILLED. A supplier who sends nine of twelve
 *   has sent nine. Writing the bill from the ORDER would have the shop
 *   owing for three bags on somebody else's lorry.
 *
 *   NAMED, NEVER DROPPED. A line that leaves the plan because it is
 *   already coming is SAID, or the screen looks like it forgot.
 *
 * Run: node test/buy-orders.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('buy orders');
const src = read('index.html');
const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);

const TODAY = '2026-08-27';
const shift = (iso, n) => {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/* The same shop purchase-plan.test.js uses, so the figures this file
   argues with are the ones that file already pinned: Cement is short
   24 and rounds to 30 at 27,000 from Roto; Wall Angle is a 200-unit
   buy-in at 2,300 from Okuosi. */
const makeData = () => ({
  presetRestockCoverDays: 14,
  presetBuyOrders: {},
  stockLog: [],
  purchaseInvoices: [],
  suppliers: [{ id: 'S1', name: 'Kampala Steel', phone: '0771000001' },
    { id: 'S2', name: 'Roto', phone: '0772000002' },
    { id: 'S3', name: 'Okuosi Gypsum', phone: '' }],
  products: [
    { id: 'P1', name: 'Cement', variants: [] },
    { id: 'P2', name: 'Wall Angle', variants: [] },
  ],
  stock: { P1: 4, P2: 0 },
  savedQuotes: [
    { id: 1, invoiced: true, voided: false, date: '2026-08-22', items: [
      { productId: 'P1', variantIdx: null, qty: 40, supplierId: '__stock__', sellPrice: 34000, _stockLots: [{ qty: 40, cost: 30000 }] },
      { productId: 'P2', variantIdx: null, qty: 80, supplierId: 'S3', price: 2600, sellPrice: 4000 } ] },
    { id: 2, invoiced: true, voided: false, date: '2026-08-24', items: [
      { productId: 'P1', variantIdx: null, qty: 20, supplierId: '__stock__', sellPrice: 34000, _stockLots: [{ qty: 20, cost: 30000 }] },
      { productId: 'P2', variantIdx: null, qty: 60, supplierId: 'S3', price: 2600, sellPrice: 4000 } ] },
    { id: 3, invoiced: true, voided: false, date: '2026-08-25', items: [
      { productId: 'P2', variantIdx: null, qty: 60, supplierId: 'S3', price: 2600, sellPrice: 4000 } ] },
  ],
  prices: [
    { id: 1, productId: 'P1', variantIdx: null, supplierId: 'S1', wholesale: 30000, retail: 32000,
      unit: 'bag', packQty: 10, packUnit: 'lot', tiers: [], outOfStock: false },
    { id: 2, productId: 'P1', variantIdx: null, supplierId: 'S2', wholesale: 31000, retail: 32500,
      unit: 'bag', packQty: 10, packUnit: 'lot', tiers: [{ minQty: 20, price: 27000 }], outOfStock: false },
    { id: 3, productId: 'P2', variantIdx: null, supplierId: 'S3', wholesale: 2500, retail: 2600,
      unit: 'pc', packQty: 40, packUnit: 'bundle', tiers: [{ minQty: 200, price: 2300 }], outOfStock: false },
  ],
});

const CHAIN = ['waSalesByKey', 'waDaysBetween', 'waWeekday', 'stockKey', 'getStockQty',
  'productPriceRows', 'rankedPriceRows', 'rankedPurchaseRowsAtQty',
  'purchasePriceAtQty', 'tieredUnitPrice', 'tiersForKind',
  'quoteItemSellPrice', 'invoiceLineCost', 'buyKeptPct',
  'buyKeyParts', 'buyKeyLabel', 'buyPriceStamp', 'buyPriceNow', 'buyHoldFor',
  'restockRiskRows', 'stockingCandidates', 'buyLineFor', 'buyLineMerge',
  'buyLineReason', 'buyLineAlsoReason',
  'reorderRuleFor', 'supplierLeadTimes', 'supplierLeadDays',
  'buyOrderTotal', 'buyOrderIsOpen', 'buyOrdersOnTheWay', 'buyOrdersCommitted',
  'buyOrderFor', 'buyOrdersAll', 'buyOrdersOpenRows',
  'placeBuyOrder', 'setBuyOrderExpected', 'markBuyOrderSent', 'cancelBuyOrder',
  'buyOrderMessage', 'buyOrderWaUrl', 'waComposeUrl', 'supplierWaNumber',
  'receiveBuyOrder', 'buyOrdersSweep',
  'buyOrderToolLines', 'purchasePlan'];
const CONSTS = ['REPEAT_BUYIN_ORDERS', 'LEAD_TIME_WINDOW_DAYS', 'LEAD_TIME_MIN_DELIVERIES',
  'BUY_HOLD_MAX_DAYS', 'BUY_HOLD_KEEP_DAYS', 'BUY_ORDER_STALE_DAYS', 'BUY_ORDER_KEEP_DAYS'];

const SUPPLIERS = { S1: 'Kampala Steel', S2: 'Roto', S3: 'Okuosi Gypsum' };
const build = (data, extraSrc, extraNames, extraEnv) => compileScope(
  CHAIN.map((n) => extractFunction(src, n, 'index.html'))
    .concat(CONSTS.map((n) => extractDeclaration(src, n, 'index.html')))
    .concat(extraSrc || []),
  Object.assign({
    data,
    todayISO: () => TODAY,
    daysSinceDate: (d) => (d ? Math.round((Date.parse(TODAY) - Date.parse(String(d))) / 86400000) : -1),
    supplierName: (id) => SUPPLIERS[id] || String(id),
    productDisplayLabel: (p, vi) => (vi == null ? p.name : p.name + ' v' + vi),
    fmtUGX: (n) => Number(n || 0).toLocaleString('en-US') + ' UGX',
    fmtShortDate: (d) => String(d),
    allProductVariantEntries: () => data.products.flatMap((p) => (p.variants && p.variants.length)
      ? p.variants.map((_v, i) => ({ p, variantIdx: i }))
      : [{ p, variantIdx: null }]),
    saveData: () => {},
    contactPhones: (s) => [s && s.phone].filter(Boolean),
    CASH_AHEAD_DAYS: 30,
    cashAhead: () => ({ safeToSpend: 2000000 }),
    encodeURIComponent,
    Date, Math, Number, String, Array, Object, Boolean, JSON, Map, Set,
  }, extraEnv || {}),
  CHAIN.concat(extraNames || []));

/* ---------- 1. an order holds nothing until it is open, and then it holds both ---- */
{
  const data = makeData();
  const s = build(data);

  const before = s.purchasePlan(2000000, null, TODAY);
  const cementBefore = before.lines.find((l) => l.name === 'Cement');
  t.check(!!cementBefore, 'the fixture is the one purchase-plan pinned: Cement is short and on the plan');
  eq(cementBefore.buyQty, 30, 'short 24, rounded up to the supplier’s pack of ten');
  eq(cementBefore.cost, 810000, 'at the 27,000 the volume tier reaches');
  eq(before.onOrder, 0, 'and nothing is on order yet');
  eq(before.budget, 2000000, 'so the budget is the whole of what was handed in');
  eq(before.budgetBefore, 2000000, 'and the two figures agree while there is nothing between them');

  const o = s.placeBuyOrder('S2', [{ key: 'P1', productId: 'P1', variantIdx: null, name: 'Cement',
    unit: 'bag', packQty: 10, packUnit: 'lot', qty: 30, unitCost: 27000 }], null);
  t.check(!!o && o.state === 'placed', 'an order is written down');
  eq(o.total, 810000, 'at the terms it was placed on');
  eq(o.supplier, 'Roto', 'against the supplier the plan costed it at');

  const after = s.purchasePlan(2000000, null, TODAY);
  t.check(!after.lines.some((l) => l.name === 'Cement'),
    'THE LINE LEAVES THE PLAN — recommending goods already in a lorry is the app arguing with a decision the owner took');
  eq(after.coming.length, 1,
    'but it is NAMED rather than dropped: a screen that goes quiet looks like a screen that forgot');
  eq(after.coming[0].name, 'Cement', 'by name');
  eq(after.coming[0].qty, 30, 'with how many are coming');
  eq(after.coming[0].needed, 24, 'against the shortfall it answers');
  eq(after.coming[0].unit, 'bag',
    'IN THE UNIT THE ORDER WAS WRITTEN IN — the sentence had "pc" typed into it and said "30 pc" of a line this shop counts in bags, in the one place the owner checks a number against a delivery note');
  eq(after.onOrder, 810000, 'and the money is counted as committed');
  eq(after.budget, 1190000,
    'THE BUDGET DROPS BY IT — nothing left the drawer, so without this the same shilling is offered to a second supplier this afternoon');
  eq(after.budgetBefore, 2000000,
    'and what it was before is still reported, or the screen cannot explain the figure it shrank to');
}

/* ---------- 2. part of it coming is not all of it coming ---------------- */
{
  const data = makeData();
  const s = build(data);
  s.placeBuyOrder('S2', [{ key: 'P1', productId: 'P1', variantIdx: null, name: 'Cement',
    unit: 'bag', packQty: 10, packUnit: 'lot', qty: 10, unitCost: 27000 }], null);

  const plan = s.purchasePlan(2000000, null, TODAY);
  const cement = plan.lines.find((l) => l.name === 'Cement');
  t.check(!!cement, 'ten of the twenty-four needed leaves the line ON the plan — the rest is still a buy');
  eq(cement.inTransit, 10, 'and the line carries what is already on the way');
  eq(cement.shortBefore, 24, 'beside the whole shortfall, so the row can say it is topping up');
  t.check(cement.buyQty < 30,
    'and it asks for LESS than it would have: a plan that ignored the lorry would order the full thirty again');
  eq(plan.coming.length, 0, 'nothing is called covered while a real shortfall stands');
}

/* ---------- 3. only an OPEN order holds anything ------------------------ */
{
  const data = makeData();
  const s = build(data);
  const o = s.placeBuyOrder('S2', [{ key: 'P1', productId: 'P1', variantIdx: null, name: 'Cement',
    unit: 'bag', packQty: 10, packUnit: 'lot', qty: 30, unitCost: 27000 }], null);
  eq(s.buyOrdersCommitted(TODAY), 810000, 'an open order holds its money');

  s.cancelBuyOrder(o.id, 'they had none');
  eq(s.buyOrdersCommitted(TODAY), 0,
    'a CALLED-OFF order holds nothing — leaving it in would keep the owner from spending money they have back');
  const back = s.purchasePlan(2000000, null, TODAY);
  t.check(back.lines.some((l) => l.name === 'Cement'),
    'and the line comes back into the plan, because nothing is coming any more');
  eq(back.budget, 2000000, 'with the whole budget restored');
  eq(s.buyOrderFor(o.id).reason, 'they had none', 'the record keeps why it was called off');

  /* Lapsed: nobody chased it and nothing came. It stops holding budget
     on its own, or a forgotten order starves the shop for ever. */
  const data2 = makeData();
  const s2 = build(data2);
  const o2 = s2.placeBuyOrder('S2', [{ key: 'P1', productId: 'P1', variantIdx: null, name: 'Cement',
    unit: 'bag', packQty: 10, packUnit: 'lot', qty: 30, unitCost: 27000 }], null);
  data2.presetBuyOrders[o2.id].placedOn = shift(TODAY, -(46));
  eq(s2.buyOrdersCommitted(TODAY), 0,
    'an order placed 46 days ago with nothing heard has LAPSED and holds nothing');
  t.check(s2.buyOrderFor(o2.id).lapsed && !s2.buyOrderFor(o2.id).open,
    'and says so, rather than vanishing while the owner still waits on it');
}

/* ---------- 4. late is only ever against a day somebody named ----------- */
{
  const data = makeData();
  const s = build(data);
  const placed = s.placeBuyOrder('S2', [{ key: 'P1', productId: 'P1', name: 'Cement', qty: 5, unitCost: 27000 }], null);
  /* TWENTY DAYS OLD AND STILL UNDATED. A young one would pass this
     check against a rule that called any order late once it aged,
     which is exactly the rule that must not exist here: age is not a
     broken word, and only a day somebody named can be missed. */
  data.presetBuyOrders[placed.id].placedOn = shift(TODAY, -20);
  const undated = s.buyOrderFor(placed.id);
  eq(undated.expectedOn, null, 'an order nobody dated carries no day');
  eq(undated.days, 20, 'however long it has been standing');
  eq(undated.late, false,
    'AND IS NEVER LATE — undated is not late, the same law the bills and the promises keep');

  const dated = s.placeBuyOrder('S1', [{ key: 'P1', productId: 'P1', name: 'Cement', qty: 5, unitCost: 30000 }], shift(TODAY, -2));
  eq(dated.late, true, 'a day that has gone by IS late');
  const ahead = s.placeBuyOrder('S1', [{ key: 'P1', productId: 'P1', name: 'Cement', qty: 5, unitCost: 30000 }], shift(TODAY, 3));
  eq(ahead.late, false, 'a day still ahead is not');

  eq(s.setBuyOrderExpected(undated.id, 'next week').ok, false,
    'a day that is not a day is refused rather than stored');
  t.check(s.setBuyOrderExpected(undated.id, shift(TODAY, 4)).ok, 'a real one is written down');
  eq(s.buyOrderFor(undated.id).expectedOn, shift(TODAY, 4), 'and read back');
  t.check(s.setBuyOrderExpected(undated.id, '').cleared,
    'and it can be TAKEN BACK — an order whose day the owner unsays is undated, not overdue');
  eq(s.buyOrderFor(undated.id).expectedOn, null, 'which is a state this app already knows how to say');
}

/* ---------- 5. placing refuses what it cannot mean ---------------------- */
{
  const data = makeData();
  const s = build(data);
  eq(s.placeBuyOrder('', [{ key: 'P1', qty: 5, unitCost: 100 }], null), null,
    'no supplier is no order — goods nobody is asking for');
  eq(s.placeBuyOrder('S2', [], null), null, 'and no lines is no order');
  eq(s.placeBuyOrder('S2', [{ key: 'P1', qty: 0, unitCost: 100 }], null), null,
    'a line of nothing is nothing');
  const o = s.placeBuyOrder('S2', [{ key: 'P1', productId: 'P1', name: 'Cement', qty: 5, unitCost: 27000 },
    { key: 'P2', productId: 'P2', name: 'Wall Angle', qty: 0, unitCost: 2300 }], null);
  eq(o.lines.length, 1, 'and a zero line is dropped from an order that has real ones');
}

/* ---------- 6. the message carries the price ---------------------------- */
{
  const data = makeData();
  const s = build(data);
  const o = s.placeBuyOrder('S2', [{ key: 'P1', productId: 'P1', name: 'Cement', unit: 'bag',
    packQty: 10, packUnit: 'lot', qty: 30, unitCost: 27000 }], shift(TODAY, 3));
  const msg = s.buyOrderMessage(o);
  t.check(/Roto/.test(msg), 'the supplier is greeted by name');
  t.check(/Cement/.test(msg) && /30/.test(msg), 'the line and the quantity are in it');
  t.check(/27,000/.test(msg),
    'AND THE PRICE — an order that leaves it out gets back "yes, we have them" against a figure the supplier never saw');
  t.check(/810,000/.test(msg), 'with what it comes to, so a wrong line is caught before the lorry loads');
  t.check(/3 lot/.test(msg), 'said in the packs they sell in as well as the units the shop counts in');
  t.check(s.buyOrderWaUrl(o).startsWith('https://wa.me/256772000002'),
    'and the draft opens at their number');

  const o2 = s.placeBuyOrder('S3', [{ key: 'P2', productId: 'P2', name: 'Wall Angle', qty: 200, unitCost: 2300 }], null);
  t.check(s.buyOrderWaUrl(o2).startsWith('https://wa.me/?'),
    'a supplier with no number still gets a draft — with no number, rather than no order');
}

/* ---------- 7. what CAME is what is billed ------------------------------ */
(async () => {
  {
    const data = makeData();
    const applied = [];
    const s = build(data, [], [], {
      issueRowId: async () => 'PINV-9',
      applyStockDelta: (pid, vi, q, kind, note, price, sid) => {
        applied.push({ pid, vi, q, kind, price, sid });
        data.stockLog.push({ id: data.stockLog.length + 1, productId: pid, qty: q });
      },
      syncPriceRegistryFromPurchase: () => {},
    });
    const o = s.placeBuyOrder('S2', [
      { key: 'P1', productId: 'P1', variantIdx: null, name: 'Cement', unit: 'bag', packQty: 10, packUnit: 'lot', qty: 30, unitCost: 27000 },
      { key: 'P2', productId: 'P2', variantIdx: null, name: 'Wall Angle', unit: 'pc', packQty: 40, packUnit: 'bundle', qty: 200, unitCost: 2300 },
    ], null);

    /* Nine of twelve: they sent fewer cement, and charged more for it. */
    const res = await s.receiveBuyOrder(o.id, [
      { key: 'P1', productId: 'P1', variantIdx: null, name: 'Cement', unit: 'bag', packQty: 10, packUnit: 'lot', qty: 20, unitCost: 28000 },
      { key: 'P2', productId: 'P2', variantIdx: null, name: 'Wall Angle', unit: 'pc', packQty: 40, packUnit: 'bundle', qty: 200, unitCost: 2300 },
    ]);
    t.check(!!res, 'the delivery is recorded');
    eq(applied.length, 2, 'every line that came goes on the shelf');
    eq(applied[0].q, 20, 'at the quantity that ACTUALLY came, not the one that was ordered');
    eq(applied[0].price, 28000, 'and the price they actually charged');

    eq(data.purchaseInvoices.length, 1,
      'ONE BILL FOR THE WHOLE DELIVERY — that is what the supplier hands over and what the owner pays against');
    const bill = data.purchaseInvoices[0];
    eq(bill.items.length, 2, 'carrying every line');
    eq(bill.items[0].qty, 20, 'billed for what came');
    eq(bill.items[0].price, 28000, 'at what was charged');
    eq(res.total, 20 * 28000 + 200 * 2300, 'and the total is the delivery, never the order');
    t.check(bill.total === undefined && !('dueDate' in bill),
      'THE BILL IS UNDATED — when the shop will pay is the shop’s word to give, and deriving a day would put money on the cash line nobody promised');
    eq(bill.supplierId, 'S2', 'against the supplier who sent it');
    eq(bill.buyOrderId, o.id, 'and tied to the order it came off, so nothing has to be guessed later');

    /* A DELIVERY IS NOT A ONE-LINE PURCHASE, and must not be marked as
       one. isStockPurchaseRow admits `inv-purchase` rows to the
       correction screen, and that screen repairs a bill by writing
       pi.items[0] — one line. A delivery bill carries every line off
       the lorry, so admitting it would let the owner correct the
       cement and silently overwrite the wall angle's row with cement's
       figures. The marker is the whole guard, so it is pinned here. */
    eq(data.stockLog.every((r) => r.source === 'buy-order'), true,
      'every shelf movement is marked as having come off an order');
    t.check(!/logRow.source = 'inv-purchase'; logRow.piId = billId/.test(src),
      'and NOT as a one-line purchase — the correction screen writes pi.items[0], and a delivery bill has many');
    t.check(/if\(e\.source === 'inv-purchase'\) return true;/.test(src)
      && !/e\.source === 'buy-order'/.test(src),
      'the correction screen still admits only the one-line kind, which is what makes the marker a guard rather than a label');

    const closed = s.buyOrderFor(o.id);
    eq(closed.state, 'arrived', 'the order is closed');
    eq(closed.billId, 'PINV-9', 'against its bill');
    eq(closed.open, false, 'and holds no budget any more');
    eq(s.buyOrdersCommitted(TODAY), 0, 'so the money is free again — it is a real debt now, and the bills count it');
    eq(await s.receiveBuyOrder(o.id, null), null,
      'and it cannot be received twice — a second bill for one lorry is money owed that was never borrowed');
  }

  /* ---------- 8. nothing came is not a delivery ------------------------- */
  {
    const data = makeData();
    const s = build(data, [], [], {
      issueRowId: async () => 'PINV-1',
      applyStockDelta: () => { data.stockLog.push({}); },
      syncPriceRegistryFromPurchase: () => {},
    });
    const o = s.placeBuyOrder('S2', [{ key: 'P1', productId: 'P1', name: 'Cement', qty: 30, unitCost: 27000 }], null);
    eq(await s.receiveBuyOrder(o.id, [{ key: 'P1', productId: 'P1', name: 'Cement', qty: 0, unitCost: 27000 }]), null,
      'a delivery of nothing raises no bill');
    eq(data.purchaseInvoices.length, 0, 'and nothing is owed');
    eq(s.buyOrderFor(o.id).state, 'placed', 'the order is still open, because it still is');
  }

  /* ---------- 9. forgetting, once there is nothing left to say ---------- */
  {
    const data = makeData();
    const s = build(data);
    const o = s.placeBuyOrder('S2', [{ key: 'P1', productId: 'P1', name: 'Cement', qty: 30, unitCost: 27000 }], null);
    s.cancelBuyOrder(o.id, 'off');
    data.presetBuyOrders[o.id].closedOn = shift(TODAY, -7);
    s.buyOrdersSweep(TODAY);
    t.check(!!data.presetBuyOrders[o.id],
      'a closed order stays readable for a fortnight — the owner should be able to see what happened to it');
    data.presetBuyOrders[o.id].closedOn = shift(TODAY, -15);
    s.buyOrdersSweep(TODAY);
    t.check(!data.presetBuyOrders[o.id], 'and then it is forgotten, rather than sitting in the settings for ever');
  }

  /* ---------- 10. the tool never supplies a price ----------------------- */
  {
    const data = makeData();
    const s = build(data);
    const good = s.buyOrderToolLines({ supplier_id: 'S2', lines: [{ key: 'P1' }] });
    eq(good.error, undefined, 'a line on today’s plan resolves');
    eq(good.lines[0].unitCost, 27000,
      'AT THE PLAN’S OWN PRICE — which came from the Price Registry, so an order can never be placed at a figure a mind made up');
    eq(good.lines[0].qty, 30, 'and the plan’s own quantity when none is given');
    eq(good.total, 810000, 'costed by the app, never by the caller');

    const withQty = s.buyOrderToolLines({ supplier_id: 'S2', lines: [{ key: 'P1', qty: 10 }] });
    eq(withQty.lines[0].qty, 10, 'a quantity the owner asked for is honoured');
    eq(withQty.lines[0].unitCost, 27000, 'while the price still is not the caller’s to give');

    /* THE SCHEMA IS THE REAL GUARD, and it is checked here rather than
       trusted. A resolver that happened to ignore one field name would
       still take a price under another; what makes it impossible is
       that the server offers the model exactly two fields and refuses
       anything else. This is the one law of this tool: an order placed
       at a figure a mind worked out is an order at a price nobody
       quoted, and the supplier finds out when the lorry is loaded. */
    const api = read('api/assistant.js');
    /* BOUNDED BY THE NEXT TOOL. Slicing to a literal that later moved
       ran this read straight past the end of the declaration and
       swallowed three other tools' fields — a check that passes on
       whatever it happens to find is not a check. */
    const from = api.indexOf("name: 'place_buy_order'");
    const decl = api.slice(from, api.indexOf("    name: '", from + 40));
    t.check(decl.length > 400 && decl.length < 4000,
      `the declaration was found and bounded, not run past its end (${decl.length} chars)`);
    const itemProps = decl.slice(decl.indexOf('items: {'), decl.indexOf('additionalProperties: false'));
    const fields = [...itemProps.matchAll(/^\s{14}([a-z_]+): \{/gm)].map((m) => m[1]);
    eq(fields.join(','), 'line_id,key,qty',
      'the tool offers the model a row id, a shelf key and a quantity, and NOTHING that could carry a price');
    t.check((decl.match(/additionalProperties: false/g) || []).length === 2,
      'and refuses any other field outright, on the line AND on the call — additionalProperties:false is what makes the law hold');
    t.check(/never supply a price/.test(decl.slice(0, decl.indexOf('input_schema'))),
      'and the description says so, so the mind is not left to infer it');

    const bogus = s.buyOrderToolLines({ supplier_id: 'S2', lines: [{ key: 'NOPE' }] });
    t.check(/NOPE/.test(bogus.error || ''),
      'a key that is not on the plan is refused BY NAME — silently skipping it would order less than the card promised');
    const wrongSup = s.buyOrderToolLines({ supplier_id: 'S1', lines: [{ key: 'P1' }] });
    t.check(/Roto/.test(wrongSup.error || ''),
      'and a line the plan costed at a different supplier is refused, naming who the price belongs to');
    t.check(/find_supplier/.test(s.buyOrderToolLines({ supplier_id: 'ZZ', lines: [{ key: 'P1' }] }).error || ''),
      'an unknown supplier points at the tool that would resolve it');
    t.check(!!s.buyOrderToolLines({ supplier_id: 'S2', lines: [] }).error,
      'and no lines is an error, not an empty order');
  }

  /* ---------- 11. and the screen shows what is coming ------------------- */
  {
    const data = makeData();
    const el = { innerHTML: '', querySelector: () => null, querySelectorAll: () => [] };
    const s = build(data, ['let buyBudget = null; let buyPlanLast = null; let buyOrderBasket = new Set();',
      extractFunction(src, 'buyLineFacts', 'index.html'),
      extractFunction(src, 'buyLineWhy', 'index.html'),
      extractFunction(src, 'buyHoldsSweep', 'index.html'),
      extractFunction(src, 'liftBuyHold', 'index.html'),
      extractFunction(src, 'renderPurchasePlanPanel', 'index.html')],
      ['renderPurchasePlanPanel'], {
        document: { getElementById: (id) => (id === 'buy_plan' ? el : null), activeElement: null },
        cashOnHandByAccount: () => ({ total: 5000000, byAccount: [] }),
        cashAhead: () => ({ days: 30, commitments: [], committed: 0, unknown: 0,
          safeToSpend: 2000000, tightest: { date: TODAY, balance: 2000000 } }),
        esc: (x) => String(x == null ? '' : x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
        listPageSlice: (_k, rows) => rows,
        listMoreButtonHTML: () => '',
        targetMarginPct: () => 10,
        /* What collecting would pay for is its own reading, and
           collect-to-buy.test.js owns that claim. Stubbed away here so
           two files cannot half-own it. */
        collectToBuy: () => null, collectToBuyHTML: () => '',
      });
    s.placeBuyOrder('S2', [{ key: 'P1', productId: 'P1', variantIdx: null, name: 'Cement',
      unit: 'bag', packQty: 10, packUnit: 'lot', qty: 30, unitCost: 27000 }], shift(TODAY, -1));
    s.renderPurchasePlanPanel();
    const html = el.innerHTML;
    t.check(/On the way/.test(html),
      'WHAT IS ALREADY COMING IS DRAWN, above the plan — a buyer who cannot see it buys it twice');
    t.check(/Roto/.test(html) && /810,000/.test(html), 'with who it is from and what it comes to');
    t.check(/pp-ord/.test(html) && /late/.test(html),
      'and a day that has gone by is marked, because somebody named that day');
    t.check(/It came/.test(html), 'with the door that turns it into stock and a bill');
    t.check(/already on order/.test(html),
      'the budget says what it is holding back, or a figure that quietly shrank is a screen nobody trusts');
    t.check(/Covered by an order already out/.test(html) && /Cement/.test(html),
      'and the line missing from the plan is NAMED as covered, never silently dropped');
  }
  /* ---------- 12. TWO ROWS UNDER ONE KEY, TOLD APART ---------------- *
   *
   * From the owner's own screen. ABC Black Screws stood on the plan
   * twice: it had run out (a refill, 20 Box, 210,000) AND it had been
   * bought in for seven orders that month (worth stocking, 240 Box,
   * 2,520,000). The BASKET was keyed on the shelf key, so the two rows
   * were one thing to it: tapping "Order it" on the 2,520,000 lit both
   * rows and put the 210,000 on the order. The owner would have pressed
   * send on a message for a twelfth of what they chose.
   *
   * THE PLAN NO LONGER PRODUCES THIS SHAPE — buy-line-merge.test.js
   * holds it to one row per product. The guard stays anyway, and the
   * shape is handed in here rather than derived, because the row id is
   * what every ordering path resolves on: if duplicates ever return by
   * another door, the money must not silently follow the wrong row.
   */
  {
    const data = makeData();
    const el = { innerHTML: '', querySelector: () => null, querySelectorAll: () => [] };
    const s = build(data, ['let buyBudget = null; let buyPlanLast = null; let buyOrderBasket = new Set();',
      extractFunction(src, 'buyOrderReviewLines', 'index.html'),
      'function setPlan(p){ buyPlanLast = p; }',
      'function tick(x){ buyOrderBasket.add(x); }',
      'function basketSize(){ return buyOrderBasket.size; }'],
      ['buyOrderReviewLines', 'setPlan', 'tick', 'basketSize'], {
        document: { getElementById: () => el, activeElement: null },
        esc: (x) => String(x),
      });

    const refill = { kind: 'refill', key: 'P9', tag: 'P9|refill', name: 'Black Screws',
      supplierId: 'S3', supplier: 'ABC', unit: 'Box', packQty: 20, packUnit: 'Ctn',
      buyQty: 20, unitCost: 10500, cost: 210000, productId: 'P9', variantIdx: null };
    const stock = { kind: 'stock', key: 'P9', tag: 'P9|stock', name: 'Black Screws',
      supplierId: 'S3', supplier: 'ABC', unit: 'Box', packQty: 20, packUnit: 'Ctn',
      buyQty: 240, unitCost: 10500, cost: 2520000, productId: 'P9', variantIdx: null };
    s.setPlan({ lines: [refill, stock], didNotFit: [] });

    t.check(refill.tag !== stock.tag,
      'TWO ROWS UNDER ONE SHELF KEY CARRY DIFFERENT ROW IDS — without that the basket cannot tell the 2,520,000 from the 210,000');
    s.tick(stock.tag);
    eq(s.basketSize(), 1, 'ticking one row tickets one row');
    const picked = s.buyOrderReviewLines();
    eq(picked.length, 1, 'and the review resolves to exactly one line');
    eq(picked[0].cost, 2520000, 'THE ONE THAT WAS TICKED — not its namesake at a twelfth of the money');

    /* THE SAME AMBIGUITY REACHES THE MANAGER, and must fail loudly
       there too. A tool that picked one of two rows would place an
       order the owner approved a card for and the machine did not
       honour — the worst thing this app could do. */
    const tool = compileScope(
      [extractFunction(src, 'buyOrderToolLines', 'index.html')],
      { data, todayISO: () => TODAY, CASH_AHEAD_DAYS: 30,
        cashAhead: () => ({ safeToSpend: 9000000 }),
        purchasePlan: () => ({ lines: [refill, stock], didNotFit: [] }),
        supplierName: () => 'ABC',
        Math, Number, String, Array, Object, Boolean, JSON },
      ['buyOrderToolLines']);
    const byKey = tool.buyOrderToolLines({ supplier_id: 'S3', lines: [{ key: 'P9' }] });
    t.check(/stands on the plan twice/.test(byKey.error || ''),
      'a bare key that names TWO rows is refused, not resolved by guesswork');
    t.check(/line_id/.test(byKey.error || ''),
      'and the refusal names the field that would settle it');
    eq(tool.buyOrderToolLines({ supplier_id: 'S3', lines: [{ line_id: 'P9|stock' }] }).total, 2520000,
      'the row id resolves to the row that was named, at its own figure');
    eq(tool.buyOrderToolLines({ supplier_id: 'S3', lines: [{ line_id: 'P9|refill' }] }).total, 210000,
      'and its namesake to ITS figure — the two are told apart, which is the whole point');
  }

})().then(() => {
  process.exit(t.done() ? 1 : 0);
}).catch((e) => {
  console.error(e);
  process.exit(1);
});
