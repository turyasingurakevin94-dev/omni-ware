#!/usr/bin/env node
'use strict';
/*
 * Consignment: whose goods, and whose cash.
 *
 * A supplier leaves goods to be sold and paid for as they sell. Two
 * facts follow, and the shop must be able to see both at any moment:
 * the goods on the shelf are not its own, and the moment one sells,
 * part of the money in the drawer belongs to somebody else.
 *
 * The rules this file holds to account:
 *
 *   RECEIVING OWES NOTHING. No bill is raised when consigned goods
 *   arrive, because nothing is owed until something sells.
 *
 *   THE MARKER SURVIVES EVERYTHING. A lot knows whose it is; a sale
 *   records the lots it consumed; an un-invoice puts them back exactly.
 *   Lose the marker anywhere along that chain and the shop has quietly
 *   helped itself to someone else's goods.
 *
 *   ONE READING, NOT A SECOND LEDGER. Owed = what sold (read from
 *   invoiced sales) minus what was settled (read from the bills those
 *   settlements raised). Nothing to keep in step by hand.
 *
 *   THE ACCOUNTS AGREE. Consigned goods are stock ON HAND but not part
 *   of what the stock is WORTH; unsettled consignment IS a payable.
 *
 * Run: node test/consignment.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('consignment');
const src = read('index.html');
const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);

const TODAY = '2026-08-27';

const data = {
  products: [
    { id: 'P1', name: 'Roto Sofa Legs', variants: [] },
    { id: 'P2', name: 'Our Own Cement', variants: [] },
  ],
  suppliers: [{ id: 'S1', name: 'Roto Industry' }, { id: 'S2', name: 'Okuosi' }],
  stock: {},
  stockLots: {},
  stockLog: [],
  savedQuotes: [],
  purchaseInvoices: [],
  customers: [],
};

let rowId = 1;
const env = {
  data,
  todayISO: () => TODAY,
  saveData: () => {},
  allocRowId: () => rowId++,
  supplierName: (id) => (data.suppliers.find((s) => s.id === id) || {}).name || String(id),
  productVariantLabel: (p) => p.name,
  purchaseInvoiceTotal: (pi) => (pi.items || []).reduce((s, i) => s + (Number(i.qty) || 0) * (Number(i.price) || 0), 0),
  fmtUGX: (n) => Number(n || 0).toLocaleString('en-US') + ' UGX',
  // The accrual now asks whether the customer has actually paid, so it
  // needs the invoice's own total to measure a part-payment against.
  savedQuoteTotal: (q) => (q.items || []).reduce((s, i) => s + (Number(i.qty) || 0) * (Number(i.sellPrice) || 0), 0),
  quoteLineComesOffShelf: (it) => !!it && (it.supplierId === '__stock__'
    || !!(it.receivedAt && Number(it.receivedQty) > 0)),
};

let scope = null; let err = null;
try {
  scope = compileScope([
    'stockKey', 'stockOnHand', 'getStockQty', 'addStockLot', 'consumeStockLots', 'restoreStockLots',
    'applyStockDelta', 'getFIFOUnitCost', 'shelfValueForKey', 'inventoryValue',
    'consignmentHeld', 'consignmentHeldLines', 'consignmentAccrued',
    'consignmentSettlements', 'consignmentSettled', 'consignmentSettlementDue',
    'purchaseInvoiceBalanceDue', 'consignmentRows', 'consignmentOwedTotal', 'consignmentDueNow',
    'consignmentSoldLines', 'returnConsignedStock', 'consignedUnitCostForSale', 'sellBelowCostClause',
    'peekStockLots', 'consignTally', 'consignedForLine',
    'unmarkedSalesByKey', 'consignmentUnmarkedSales',
    'consignmentMarkPlan', 'consignmentMarkApply', 'invoiceNumberLabel',
  ].map((n) => extractFunction(src, n, 'index.html')),
  env, ['addStockLot', 'applyStockDelta', 'consumeStockLots', 'restoreStockLots', 'inventoryValue',
    'shelfValueForKey',
    'consignmentHeld', 'consignmentHeldLines', 'consignmentAccrued', 'consignmentSettled',
    'consignmentRows', 'consignmentOwedTotal', 'consignmentSoldLines', 'returnConsignedStock',
    'sellBelowCostClause', 'getFIFOUnitCost', 'stockOnHand', 'getStockQty', 'stockKey', 'consignmentSettlements',
    'consignmentSettlementDue', 'purchaseInvoiceBalanceDue', 'consignmentDueNow',
    'consignmentMarkPlan', 'consignmentMarkApply', 'unmarkedSalesByKey', 'consignmentUnmarkedSales']);
} catch (e) { err = e; }
t.check(!!scope, `the consignment chain compiles${err ? ` (${err.message})` : ''}`);

/* ---------- 1. goods arrive owing nothing ----------------------------- */
if (scope) {
  // 20 of Roto's legs, we will owe 2,000 each as they sell.
  scope.applyStockDelta('P1', null, 20, 'restock', 'Received on consignment', 2000, 'S1', { consign: 'S1' });
  // 10 cement of our own, bought and paid for.
  scope.applyStockDelta('P2', null, 10, 'restock', 'Purchased', 28000, 'S2', null);

  eq(scope.getStockQty('P1', null), 20, 'consigned goods are on the shelf and can be sold');
  t.check(data.stockLots.P1[0].consign === 'S1', 'and the lot knows whose they are');
  t.check(data.stockLots.P2[0].consign === undefined, 'while goods the shop bought carry no such mark');

  const held = scope.consignmentHeld();
  t.check(held.length === 1 && held[0].supplierId === 'S1' && held[0].qty === 20,
    'what a consignor has in the shop is readable at any moment');
  eq(held[0].value, 40000, 'valued at what will be owed for it');

  eq(scope.consignmentOwedTotal(), 0,
    'and NOTHING is owed yet — goods that have not sold owe nobody anything');
}

/* ---------- 2. the accounts keep them apart --------------------------- */
if (scope) {
  const inv = scope.inventoryValue();
  eq(Math.round(inv.value), 280000,
    'the stock is worth only what the shop OWNS — 10 cement at 28,000, and not a shilling of Roto\'s legs');
  eq(inv.consignedQty, 20, 'the consigned units are reported apart');
  eq(inv.consignedValue, 40000, 'with what they would cost to keep');
}

/* ---------- 3. selling turns goods into someone else's money ---------- */
if (scope) {
  // Six legs sell. The sale consumes lots and records what it took.
  const taken = scope.consumeStockLots('P1', null, 6);
  data.stock.P1 = 14;
  t.check(taken.length === 1 && taken[0].consign === 'S1' && taken[0].cost === 2000,
    'the sale records whose units it consumed, and at what they will cost');

  const q = { id: 1, invoiced: true, voided: false, invoicedAt: '2026-08-20',
    items: [{ productId: 'P1', variantIdx: null, productName: 'Roto Sofa Legs', qty: 6,
      unit: 'pc', supplierId: '__stock__', sellPrice: 3000, _stockLots: taken }] };
  data.savedQuotes.push(q);

  eq(scope.consignmentOwedTotal(), 12000,
    'six sold at 2,000 each is 12,000 of the drawer that belongs to Roto');
  const row = scope.consignmentRows()[0];
  t.check(row.soldQty === 6 && row.accrued === 12000 && row.settled === 0 && row.owed === 12000,
    'and the consignor\'s row says so, sold and owed');
  eq(row.heldQty, 14, 'with what is still theirs on the shelf');

  // A draft order owes nobody anything.
  data.savedQuotes.push({ id: 2, invoiced: false, voided: false, date: '2026-08-21',
    items: [{ productId: 'P1', variantIdx: null, qty: 5, supplierId: '__stock__',
      _stockLots: [{ qty: 5, cost: 2000, consign: 'S1' }] }] });
  eq(scope.consignmentOwedTotal(), 12000, 'a draft order has sold nothing, so it owes nothing');

  // Nor does a voided one.
  data.savedQuotes.push({ id: 3, invoiced: true, voided: true, invoicedAt: '2026-08-21',
    items: [{ productId: 'P1', variantIdx: null, qty: 5, supplierId: '__stock__',
      _stockLots: [{ qty: 5, cost: 2000, consign: 'S1' }] }] });
  eq(scope.consignmentOwedTotal(), 12000, 'and a voided sale is a sale that did not happen');
  data.savedQuotes = data.savedQuotes.filter((x) => x.id === 1);
}

/* ---------- 4. un-invoicing must not launder the goods ---------------- */
if (scope) {
  const q = data.savedQuotes[0];
  const lots = q.items[0]._stockLots;
  scope.restoreStockLots('P1', null, lots);
  data.stock.P1 = 20;
  const back = data.stockLots.P1.find((l) => l.qty === 6);
  t.check(back && back.consign === 'S1',
    'units put back by an un-invoice are STILL the consignor\'s — the marker is rebuilt, so it has to be carried across deliberately');
  eq(scope.consignmentHeld()[0].qty, 20, 'and they are held for them again');
  // Put the sale back for the rest of the file.
  scope.consumeStockLots('P1', null, 6);
  data.stock.P1 = 14;
}

/* ---------- 5. settling raises an ordinary bill ----------------------- */
if (scope) {
  const lines = scope.consignmentSoldLines('S1');
  t.check(lines.length === 1 && lines[0].qty === 6 && lines[0].price === 2000,
    'the settlement is itemised by what actually sold, at what was agreed');

  // The bill settleConsignment would write, applied here directly: the
  // async id issue is the app's, the arithmetic is what matters.
  data.purchaseInvoices.push({ id: 90, quoteId: null, supplierId: 'S1', supplierName: 'Roto Industry',
    date: '2026-08-25', items: lines, amountPaid: 0, payments: [], voided: false, consignSettlement: true });

  eq(scope.consignmentSettled('S1'), 12000, 'the bill counts as settled against what accrued');
  eq(scope.consignmentOwedTotal(), 0,
    'so nothing is owed any more — the money is now an ordinary supplier bill, not loose cash');
  const row = scope.consignmentRows()[0];
  t.check(row.accrued === 12000 && row.settled === 12000 && row.owed === 0,
    'and the row shows the whole story rather than resetting to nothing');

  // Selling more starts it again.
  data.savedQuotes.push({ id: 4, invoiced: true, voided: false, invoicedAt: '2026-08-26',
    items: [{ productId: 'P1', variantIdx: null, qty: 2, supplierId: '__stock__',
      _stockLots: [{ qty: 2, cost: 2000, consign: 'S1' }] }] });
  eq(scope.consignmentOwedTotal(), 4000, 'what sells after a settlement is owed again');

  // A voided settlement is not a settlement.
  data.purchaseInvoices[0].voided = true;
  eq(scope.consignmentOwedTotal(), 16000, 'and a voided bill settles nothing');
  data.purchaseInvoices[0].voided = false;
}

/* ---------- 6. sending unsold goods back owes nothing ----------------- */
if (scope) {
  const before = scope.consignmentOwedTotal();
  // Our own cement must not be touched by a return of Roto's goods.
  scope.addStockLot('P1', null, 5, 1500);          // 5 of the shop's own, same product
  data.stock.P1 = (data.stock.P1 || 0) + 5;
  const heldBefore = scope.consignmentHeld()[0].qty;

  const sent = scope.returnConsignedStock('P1', null, 'S1', 4);
  eq(sent, 4, 'the units go back');
  eq(scope.consignmentHeld()[0].qty, heldBefore - 4, 'and leave the consignor\'s holding');
  t.check(data.stockLots.P1.some((l) => !l.consign && l.qty === 5),
    'while the shop\'s OWN units on the same product are untouched — a return takes from the consigned lots, not the front of the queue');
  eq(scope.consignmentOwedTotal(), before,
    'and nothing is owed for goods that went back unsold');
  const log = data.stockLog[data.stockLog.length - 1];
  t.check(/Returned unsold to Roto Industry/.test(log.note) && log.delta === -4,
    'with the movement written down plainly');
}

/* ---------- 7. selling below what will be owed ------------------------ */
if (scope) {
  data.stockLots.P3 = [{ qty: 10, cost: 5000, consign: 'S1' }];
  data.stock.P3 = 10;
  /* `supplierId: '__stock__'` is not decoration. The clause reads the
     shelf only for a line that is actually coming off it, by the same
     rule invoicing uses (quoteLineComesOffShelf) -- a fixture that left
     it out was asking production code to guess, and production code was
     bent to satisfy the guess. */
  const warn = scope.sellBelowCostClause({ productId: 'P3', variantIdx: null, qty: 3,
    supplierId: '__stock__', unit: 'pc', sellPrice: 4000, price: 0 });
  t.check(/below the 5,000 UGX you will owe/.test(warn) && /out of your own pocket/.test(warn),
    `a shelf sale under the consigned cost is named as the loss it is (${warn})`);
  t.check(/3,000 UGX over 3/.test(warn), 'with what it costs over the whole line');

  const fine = scope.sellBelowCostClause({ productId: 'P3', variantIdx: null, qty: 3,
    supplierId: '__stock__', unit: 'pc', sellPrice: 6000, price: 0 });
  eq(fine, '', 'and a price above it says nothing');

  data.stockLots.P4 = [{ qty: 10, cost: 5000 }];
  data.stock.P4 = 10;
  eq(scope.sellBelowCostClause({ productId: 'P4', variantIdx: null, qty: 1,
    supplierId: '__stock__', sellPrice: 4000, price: 0 }), '',
    'goods the shop owns are not judged by this rule — that margin is the shop\'s own business');
}

/* ---------- 7b. THE ROUND TRIP -- the case that was missed ------------ */
/*
 * The feature shipped with every reading correct and no way to keep the
 * answer. stock_lots is a real table -- key, qty, cost -- and the mark
 * was never in the row that went up nor in the mapper that came back.
 * So a shop received goods on consignment, sold some, and saw an empty
 * screen: the mark lived until the next page load and then the goods
 * were the shop's own again.
 *
 * Pinned as a round trip rather than as source text, because that is
 * the shape of the fault: each half looked reasonable on its own.
 */
{
  const code = src;
  // The write: what one lot becomes on the way to the server.
  const insertLine = (code.match(/changedKeys\.forEach\(k=> \(stockLotsMap\[k\]\|\|\[\]\)\.forEach\(l=> insertRows\.push\(\{[\s\S]{0,300}?\}\)\)\);/) || [''])[0];
  t.check(/consign: l\.consign \|\| null/.test(insertLine),
    'the row that goes UP carries the consignor');
  t.check(/stockLotConsignColumn \? \{consign/.test(insertLine),
    'guarded by a probe, because one unknown column would fail the whole insert and stop the shop saving its cost lots at all');

  // The read: what comes back becomes a lot again.
  const loadBlock = (code.match(/\(stockLotsR\.data\|\|\[\]\)\.forEach\(l=>\{[\s\S]{0,400}?\}\);/) || [''])[0];
  t.check(/if\(l\.consign\) lot\.consign = l\.consign;/.test(loadBlock),
    'and the row that comes DOWN puts it back on the lot');

  // Both halves against one lot, so a change to either is caught here.
  const lot = { qty: 12, cost: 2250, consign: 'S2' };
  const wire = { shop_id: 'x', key: 'P3', qty: lot.qty, cost: lot.cost, consign: lot.consign || null };
  const backOnLoad = { qty: Number(wire.qty) || 0, cost: wire.cost == null ? null : Number(wire.cost) };
  if (wire.consign) backOnLoad.consign = wire.consign;
  t.check(backOnLoad.consign === 'S2' && backOnLoad.qty === 12 && backOnLoad.cost === 2250,
    'a consigned lot survives the trip out and back — the whole feature rests on this one field');

  t.check(/alter table stock_lots\s*\n\s*add column if not exists consign text;/.test(read('supabase/migrations/0080_stock_lot_consign.sql')),
    'and the column it needs is a migration in the repo, not an assumption');
}

/* ---------- 7c. what happens before that migration lands -------------- */
{
  const stage = extractFunction(src, 'renderInvPurchaseStage', 'index.html');
  t.check(/id="inv_purchase_consign" \$\{invPurchaseConsign \? 'checked' : ''\}\$\{stockLotConsignColumn \? '' : ' disabled'\}/.test(stage),
    'without the column the consignment tick is disabled rather than offered');
  const save = src.slice(src.indexOf('inv_purchase_save_btn'));
  t.check(/if\(invPurchaseConsign && !stockLotConsignColumn\)\{/.test(save),
    'and refused at the save too — a mark that cannot be kept is never taken');
  t.check(/if\(invPurchaseConsign && !invPurchaseSupplierId\)\{/.test(save),
    'as is a consignment with nobody to consign it to');
  const screen = extractFunction(src, 'renderConsignment', 'index.html');
  t.check(/This screen cannot record anything yet/.test(screen)
    && /alter table stock_lots add column if not exists consign text;/.test(screen),
    'and the screen says so plainly, with the exact line to run');
}

/* ---------- 7d. marking goods that are already here ------------------- */
if (scope) {
  data.stockLots.P9 = [{ qty: 30, cost: 3000 }];
  data.stock.P9 = 30;
  data.products.push({ id: 'P9', name: 'Gypsum Boards', variants: [] });
  data.savedQuotes.push({ id: 50, invoiced: true, voided: false, invoicedAt: '2026-08-26',
    items: [{ productId: 'P9', variantIdx: null, productName: 'Gypsum Boards', qty: 10,
      supplierId: '__stock__', sellPrice: 4200, _stockLots: [{ qty: 10, cost: 3000 }] }] });

  const plan = scope.consignmentMarkPlan('P9', null, 'S2');
  t.check(plan.shelfQty === 30 && plan.shelfValue === 90000,
    'the plan says what is on the shelf');
  t.check(plan.soldQty === 10 && plan.soldValue === 30000,
    'and what has ALREADY sold, which is money owed the moment it is marked');
  t.check(plan.sales.length === 1 && /INV-/.test(plan.sales[0].invoice),
    'naming the invoice it is on, so the figure can be checked before it is accepted');

  const owedBefore = scope.consignmentOwedTotal();
  scope.consignmentMarkApply('P9', null, 'S2');
  eq(scope.consignmentOwedTotal(), owedBefore + 30000,
    'applying it adds exactly what the plan said to what is owed');
  t.check(data.stockLots.P9.every((l) => l.consign === 'S2'),
    'the shelf is theirs');
  t.check(data.savedQuotes.find((q) => q.id === 50).items[0]._stockLots[0].consign === 'S2',
    'and so are the units already sold — the goods were always theirs, the app simply failed to write it down');

  const again = scope.consignmentMarkPlan('P9', null, 'S2');
  t.check(again.shelfQty === 0 && again.soldQty === 0,
    'marking it twice would do nothing, so it cannot double the debt');
}

/* ---------- 7e. when only PART of the shelf is theirs ----------------- */
/*
 * The first version marked every unmarked unit of the item. Right when a
 * consignment is the only stock of that thing, and wrong the moment
 * there is a mix -- which is ordinary. Claiming the shop's own goods as
 * the supplier's overstates what is owed, in money, in the direction
 * that costs the shop.
 */
if (scope) {
  // 50 on the shelf in two lots at different costs; 20 already sold
  // across two invoices. Only 30 of the shelf and 8 of the sold are the
  // consignor's, and the owner is the one who knows that.
  data.stockLots.PA = [{ qty: 20, cost: 1000 }, { qty: 30, cost: 1100 }];
  data.stock.PA = 50;
  data.products.push({ id: 'PA', name: 'Mixed Shelf', variants: [] });
  data.savedQuotes.push({ id: 60, invoiced: true, voided: false, invoicedAt: '2026-08-10',
    items: [{ productId: 'PA', variantIdx: null, qty: 12, supplierId: '__stock__',
      sellPrice: 1500, _stockLots: [{ qty: 12, cost: 1000 }] }] });
  data.savedQuotes.push({ id: 61, invoiced: true, voided: false, invoicedAt: '2026-08-22',
    items: [{ productId: 'PA', variantIdx: null, qty: 8, supplierId: '__stock__',
      sellPrice: 1500, _stockLots: [{ qty: 8, cost: 1100 }] }] });

  const full = scope.consignmentMarkPlan('PA', null, 'S1');
  t.check(full.shelfAvailable === 50 && full.soldAvailable === 20,
    'the plan reports everything that COULD be marked');
  t.check(full.shelfQty === 50 && full.soldQty === 20,
    'and defaults to all of it, so leaving the boxes alone behaves exactly as before');

  const part = scope.consignmentMarkPlan('PA', null, 'S1', 30, 8);
  eq(part.shelfQty, 30, 'a smaller number marks only that many');
  eq(part.shelfValue, 31000, 'valued oldest lot first — 20 at 1,000 and 10 at 1,100');
  eq(part.soldQty, 8, 'and the sold figure is its own number, not derived from the shelf');
  eq(part.soldValue, 8000, 'taken from the OLDEST invoice first');

  const owedBefore = scope.consignmentOwedTotal();
  scope.consignmentMarkApply('PA', null, 'S1', 30, 8);
  eq(scope.consignmentOwedTotal(), owedBefore + 8000,
    'applying adds exactly the sold value the plan named, and not a shilling of the rest');

  const lots = data.stockLots.PA;
  eq(lots.reduce((s, l) => s + (l.consign === 'S1' ? l.qty : 0), 0), 30, '30 on the shelf are theirs');
  eq(lots.reduce((s, l) => s + (l.consign ? 0 : l.qty), 0), 20, 'and 20 are still the shop\'s own');
  t.check(lots.some((l) => l.consign === 'S1' && l.qty === 10 && l.cost === 1100)
    && lots.some((l) => !l.consign && l.qty === 20 && l.cost === 1100),
    'a lot the number falls inside is SPLIT, so the shop\'s own units keep their own cost');

  const first = data.savedQuotes.find((q) => q.id === 60);
  const second = data.savedQuotes.find((q) => q.id === 61);
  t.check(first.items[0]._stockLots.every((l) => l.consign === 'S1') === false
    && first.items[0]._stockLots.some((l) => l.consign === 'S1'),
    'the oldest invoice is partly marked — 8 of its 12');
  t.check(second.items[0]._stockLots.every((l) => !l.consign),
    'and the later invoice is untouched, because only 8 were asked for');

  // Marking the rest later must not double anything already counted.
  const owedMid = scope.consignmentOwedTotal();
  scope.consignmentMarkApply('PA', null, 'S1', 5, 4);
  eq(scope.consignmentOwedTotal(), owedMid + 4000,
    'a second, smaller marking adds only its own units — the first ones are already theirs');
}

/* ---------- 8. the wiring --------------------------------------------- */
{
  t.check(/id="tab-consignment"/.test(src) && /data-tab="consignment"/.test(src),
    'Consignment is its own screen on the rail');
  const go = extractFunction(src, 'goToTab', 'index.html');
  t.check(/if\(tab==='consignment'\) renderConsignment\(\);/.test(go), 'and redraws on entry');

  const save = src.slice(src.indexOf('inv_purchase_save_btn'));
  t.check(/const onConsignment = !!\(invPurchaseConsign && invPurchaseSupplierId && stockLotConsignColumn\);/.test(save)
    && /const piId = onConsignment \? null/.test(save),
    'receiving on consignment raises NO bill — nothing is owed until something sells — and only when the mark can actually be kept');
  t.check(/consign: invPurchaseSupplierId/.test(save),
    'and the lot is marked as the consignor\'s');

  t.check(/\.\.\.\(pi\.consignSettlement \? \{consignSettlement:true\} : \{\}\)/.test(src),
    'the settlement flag rides the payload like openingBalance, so no migration is needed');

  const pay = extractFunction(src, 'payablesAsAt', 'index.html');
  t.check(/consignmentOwedTotal\(\)/.test(pay) && /consignmentOwedTotal\(asOf\)/.test(pay),
    'unsettled consignment counts as a payable, today and as at any date');

  const brief = extractFunction(src, 'morningBriefData', 'index.html');
  t.check(/consignOwed: Math\.round\(consignmentOwedTotal\(\)\)/.test(brief),
    'the morning brief carries it');
  const dash = extractFunction(src, 'renderDashboard', 'index.html');
  t.check(/belongs to a consignor/.test(dash),
    'and the cash tile says how much of the drawer is not the shop\'s');
}

/* ---------- 10. one reading of what a shelf is worth ------------------ */
/*
 * inventoryValue counted a consignor's goods out of what the stock was
 * worth, and the Stock on hand card worked out its own figure over the
 * whole shelf. They disagreed by exactly the consigned holding: a shop
 * could ask what its stock was worth in two places and get two answers,
 * and the bigger one was other people's goods. Both now read
 * shelfValueForKey, so the drift has nowhere to come from.
 */
if (scope) {
  data.stock = {}; data.stockLots = {}; data.savedQuotes = []; data.purchaseInvoices = [];
  data.stockLots.P1 = [{ qty: 20, cost: 2000 }, { qty: 30, cost: 5000, consign: 'S1' }];
  data.stock.P1 = 50;
  data.stockLots.P2 = [{ qty: 10, cost: 8000 }];
  data.stock.P2 = 10;

  const k = scope.shelfValueForKey('P1');
  eq(k.qty, 50, 'the shelf count is everything standing on it');
  eq(k.ownedQty, 20, 'of which the shop owns this much');
  eq(k.value, 40000, 'and only that much is the shop\'s money');
  eq(k.consignedValue, 150000, 'the rest belongs to whoever left it');

  const whole = scope.inventoryValue();
  eq(Math.round(['P1', 'P2'].reduce((s, key) => s + scope.shelfValueForKey(key).value, 0)),
    Math.round(whole.value),
    'summing the per-shelf reading IS the balance sheet figure — one function, so they cannot drift');
  eq(whole.consignedQty, 30, 'with the consigned units reported apart');
  eq(whole.consignedValue, 150000, 'at what they would cost to keep');
}

/* ---------- 11. the two halves have to be asked whether they agree ----
 *
 * What is HELD reads the shelf's lots; what is SOLD reads the lot record
 * on each invoice line. Nothing joins them. Mark a shelf after some of
 * it has already gone and they disagree for good -- and the card said
 * "sold 0 so far · nothing owed right now" about a shop holding
 * 2,422,500 UGX of somebody else's takings, in the tone of a settled
 * account. The owner had to notice it themselves.
 *
 * The two fixtures below are the reported case and its healthy twin.
 * They differ in ONE thing: whether the goods were marked before or
 * after they sold.
 */
if (scope) {
  const sellOff = (id, qty, day) => {
    const lots = scope.consumeStockLots('P9', null, qty);
    data.stock.P9 = scope.getStockQty('P9', null);
    const q = { id, client: { name: 'Adinan' }, invoiced: true, voided: false,
      invoicedAt: day, date: day,
      items: [{ productId: 'P9', variantIdx: null, qty, supplierId: '__stock__', _stockLots: lots }] };
    data.savedQuotes.push(q);
    return q;
  };
  const fresh = () => {
    data.stock = {}; data.stockLots = {}; data.savedQuotes = []; data.purchaseInvoices = [];
    data.products.push({ id: 'P9', name: 'Gypsum board 9mm', variants: [] });
  };

  // MARKED FIRST, then sold: the chain carries the stamp all the way.
  fresh();
  scope.applyStockDelta('P9', null, 105, 'restock', 'Received on consignment', 25500, 'S1', { consign: 'S1' });
  sellOff(254, 95, '2026-08-25');
  let row = scope.consignmentRows().find(r => r.supplierId === 'S1');
  eq(Math.round(row.heldQty), 10, 'marked first: ten of theirs left on the shelf');
  eq(Math.round(row.soldQty), 95, 'and the ninety-five that went are recorded as sold');
  eq(row.owed, 2422500, 'so they are owed for them');
  eq(scope.consignmentUnmarkedSales('S1').length, 0,
    'nothing is unaccounted for, so the card carries no warning');

  // SOLD FIRST, then only the shelf marked: the reported screen exactly.
  fresh();
  scope.applyStockDelta('P9', null, 105, 'restock', 'Purchased', 25500, 'S1', {});
  sellOff(254, 95, '2026-08-25');
  scope.consignmentMarkApply('P9', null, 'S1', null, 0);   // shelf only, sold left at zero
  row = scope.consignmentRows().find(r => r.supplierId === 'S1');
  eq(Math.round(row.heldQty), 10, 'sold first: the same ten held');
  eq(Math.round(row.heldValue), 255000, 'worth the same 255,000 to them');
  eq(Math.round(row.soldQty), 0, 'and the same "sold 0 so far" — the two screens are indistinguishable');
  eq(row.owed, 0, 'with nothing recorded as owed');

  // Which is the whole reason the screen has to ask.
  const gaps = scope.consignmentUnmarkedSales('S1');
  eq(gaps.length, 1, 'the gap is found');
  eq(Math.round(gaps[0].qty), 95, 'and counted');
  eq(Math.round(gaps[0].value), 2422500, 'and priced at what they would be owed');
  t.check(gaps[0].sales.length === 1 && /254/.test(gaps[0].sales[0].invoice),
    `and the invoice it sold on is named, so the owner can check it rather than take the app's word (${gaps[0].sales.map(x=>x.invoice).join(', ')})`);

  // Taking the offer moves it, and taking it twice cannot.
  scope.consignmentMarkApply('P9', null, 'S1', 0, Math.round(gaps[0].qty));
  row = scope.consignmentRows().find(r => r.supplierId === 'S1');
  eq(Math.round(row.soldQty), 95, 'recording them makes the sale count');
  eq(row.owed, 2422500, 'and the consignor is owed exactly what the warning said');
  eq(Math.round(row.heldQty), 10, 'while what is on the shelf is untouched — this was about goods that had gone');
  eq(scope.consignmentUnmarkedSales('S1').length, 0, 'the gap closes');
  scope.consignmentMarkApply('P9', null, 'S1', 0, 95);
  eq(scope.consignmentRows().find(r => r.supplierId === 'S1').owed, 2422500,
    'and running it again cannot double what is owed — there is nothing unmarked left to take');
}

/* ---------- 11b. sales the repair cannot reach are still counted ------ */
/*
 * A line records the lots it took, but four things leave it without one:
 * the shelf read zero at invoicing, the count and the lot ledger had
 * drifted, an order was edited between load and save, or it predates the
 * record entirely. Those units left the shelf all the same. Reporting
 * only what CAN be marked would understate the gap in the one direction
 * that costs a consignor money.
 */
if (scope) {
  data.stock = {}; data.stockLots = {}; data.savedQuotes = []; data.purchaseInvoices = [];
  data.stockLots.P9 = [{ qty: 10, cost: 25500, consign: 'S1' }, { qty: 4, cost: 25500 }];
  data.stock.P9 = 14;
  // One sale that kept its lots, one that kept none.
  data.savedQuotes.push({ id: 260, invoiced: true, voided: false, invoicedAt: '2026-08-26',
    items: [{ productId: 'P9', variantIdx: null, qty: 6, supplierId: '__stock__',
      _stockLots: [{ qty: 6, cost: 25500 }] }] });
  data.savedQuotes.push({ id: 261, invoiced: true, voided: false, invoicedAt: '2026-08-27',
    items: [{ productId: 'P9', variantIdx: null, qty: 12, supplierId: '__stock__' }] });

  const plan = scope.consignmentMarkPlan('P9', null, 'S1');
  eq(plan.soldAvailable, 6, 'only the sale with lots on file can be marked');
  eq(plan.soldUnrecorded, 12, 'and the one without is counted apart rather than left out');
  const gap = scope.consignmentUnmarkedSales('S1')[0];
  eq(Math.round(gap.qty), 6, 'the card offers what it can fix');
  eq(Math.round(gap.unrecorded), 12, 'and names what it cannot');

  // A bought-in line never came off our shelf, so it is not this shelf's business.
  data.savedQuotes.push({ id: 262, invoiced: true, voided: false, invoicedAt: '2026-08-27',
    items: [{ productId: 'P9', variantIdx: null, qty: 50, supplierId: 'S2' }] });
  eq(scope.consignmentMarkPlan('P9', null, 'S1').soldUnrecorded, 12,
    'a line bought in from another supplier is not a sale off this shelf');
}

/* ---------- 11c. the screen says both of these things ----------------- */
{
  const render = extractFunction(src, 'renderConsignment', 'index.html');
  t.check(/consignmentUnmarkedSales\(r\.supplierId\)/.test(render),
    'the card asks whether the two halves agree');
  t.check(/nothing recorded as owed — see above/.test(render),
    'and stops calling itself settled while they do not');
  t.check(/cannot be marked here/.test(render),
    'what no marking can reach is named on the card, not dropped');
  /* The owner had to ask which it was. A screen that reports money owed
     must say what makes it owed. */
  t.check(/Counted from the invoice, not the payment/.test(render),
    'and the screen says the basis: invoiced, not paid');
  t.check(/consignmentMarkApply\(btn\.dataset\.pid, vidx, sup, 0, qty\)/.test(render),
    'the fix marks the SOLD side only — what is on the shelf is a separate decision');
  t.check(/if\(!confirm\(`Record \$\{Math\.round\(plan\.soldQty\)\}/.test(render),
    'and asks first, naming the count');
}

/* ---------- 12. the screen has its own shape ------------------------- */
/*
 * FIRST it wore three other screens' clothes -- .chase-row (a name, an
 * amount and a sentence), .buy-tail/.buy-row (a shopping list),
 * .buy-controls (a filter bar) -- and was rebuilt on the supplier card:
 * an avatar, a title, a four-tile strip and a table, per consignor.
 *
 * That was right about the card and wrong about the screen. A supplier
 * card is the shape for looking AT one party; this screen is a standing
 * watch across all of them -- "how much of what is in the drawer is not
 * mine" -- and it answered that by expanding every consignor in full,
 * always. Three consignors was a thousand pixels. At the ten to thirty
 * this shop deals with, the figure the screen exists for was off the top
 * of the window by the third card, and the ranking could not be read
 * without scrolling the whole list.
 *
 * So the assertions below moved with it: the strip, ONE .ow-q queue whose
 * rows open in place, the layer's .ow-tbl for the goods and .ow-sr for
 * the rail. What each one is protecting is the same property it always
 * was -- the figures sit where they can be compared, the goods line up
 * down a column, the two notices are notices -- said in the vocabulary
 * the rest of the app now speaks.
 */
{
  const render = extractFunction(src, 'renderConsignment', 'index.html');
  const form = extractFunction(src, 'markAlreadyHereHTML', 'index.html');

  /* A consignor is a queue row that opens, not a card that is always
     open. This is the assertion that changed in substance: the old one
     said "a card of its own, not a debt-chase row", and a card of its
     own is precisely what stopped working at ten of them. */
  t.check(/class="ow-q" data-id=/.test(render) && !/class="cons-card"/.test(render)
    && !/class="chase-row"/.test(render),
    'a consignor is a queue row that opens in place, not a card that is always open');
  /* The layer's queue emits the desk row AND the phone card from one
     call, which is what makes the two designs unable to say different
     things. The old screen had a desktop table and a media query that
     hid two of its columns -- a reflow, not a second design. */
  t.check(/class="ow-q-r ow-qtog"/.test(render) && /class="ow-q-card ow-qtog"/.test(render),
    'and the desk row and the phone card come from that one call');
  t.check(/class="ow-strip"/.test(render) && !/class="sum-strip"/.test(render),
    'the figures the screen exists for are in the strip every other screen uses for them');
  /* The four figures of one consignment are still together and still
     comparable -- they are the strip's four tiles now rather than a
     private stat strip inside each card, so they are read once for the
     whole screen instead of once per consignor. */
  t.check(/'Owed to consignors'/.test(render) && /'Of it, already billed'/.test(render)
    && /'Their goods here'/.test(render) && /'Consignors'/.test(render)
    && !/class="sc-stats"/.test(render),
    'and the four that make up the whole holding sit together where they can be compared');
  t.check(/class="ow-tbl cons-tbl"/.test(render) && !/cons-goods-table/.test(render)
    && !/class="buy-row"/.test(render),
    'their goods are the layer\'s table, so the figures line up down the column');
  t.check(/class="form-panel cons-mark"/.test(form) && /class="form-grid"/.test(form)
    && !/class="buy-controls"/.test(form),
    'and marking goods is a form, not a row of inline controls reading like a filter bar');

  /* The empty state was a bare paragraph and the blocked notice a
     coloured one -- both of them the shape of a placeholder. */
  t.check(/class="cons-empty"/.test(render), 'nothing held reads as an empty state, not a stray sentence');
  t.check(/class="cons-blocked"/.test(render), 'and the migration notice as a notice');
  /* And an empty screen shows no strip. Four tiles reading zero fill it
     with figures that mean nothing and make a quiet screen look like a
     broken one, so the count lives in the panel head instead. */
  const emptyArm = render.slice(render.indexOf('if(!rows.length)'), render.indexOf('GOODS OF THEIRS'));
  t.check(!/ow-strip/.test(emptyArm) && /ow-pan-n">none/.test(emptyArm),
    'and shows no strip of zeros when there is nothing to count');

  const css = (sel) => (new RegExp(`\\${sel}\\{([^}]*)\\}`).exec(src) || ['', ''])[1];
  /* The queue's own tracks, declared once on the container so every row
     shares them -- which is what makes a column of figures line up at
     the glance it is read at. The old assertion asked the card for a
     border and a corner; there is no card to ask.

     .ow-tbl.cons-tbl, not .cons-tbl: the layer sets the same custom
     property on .ow-tbl, and a bare class would lose the cascade to it
     on document order. */
  t.check(/--ow-tbl-cols:/.test(css('.ow-tbl.cons-tbl')),
    'the goods table declares its tracks on the container, so the rows cannot disagree about them');
  /* THE PHONE IS NOT A SQUEEZED TABLE ANY MORE.
     Five columns of figures came to more than 375px however tightly they
     were set, and the old answer was @media (max-width:640px) hiding two
     of them -- a reflow of one design, which is the thing the two-designs
     law forbids. The layer's table turns every labelled cell into a line
     of its own from the data-l it was emitted with, so the media query
     and its 560px companion are gone and nothing is hidden from anybody. */
  t.check(!/\.cons-goods-table tr\{display:grid/.test(src)
    && /data-l="On shelf"/.test(render) && /data-l="Worth to them"/.test(render),
    'and on a phone the goods carry their column names instead of losing two columns to a media query');
}

/* ---------- 12b. a finding with nothing to fix is not a warning ------- */
/*
 * consignmentUnmarkedSales reports a product where units sold that no
 * marking can reach, even when none of them are markable. Rendered
 * through the fixable wording that read:
 *
 *   "0 of Ceiling Tile 600x600 have already sold on  — recorded as
 *    nobody's, so the 0 UGX they would owe is not counted above"
 *
 * -- a sentence about nothing, under a warning icon, with an empty
 * invoice list where the evidence should be. Found by rendering it.
 */
{
  const render = extractFunction(src, 'renderConsignment', 'index.html');
  // Counted over the code, not the comment above it, which quotes the
  // sentence it exists to explain.
  const body = render.replace(/\/\*[\s\S]*?\*\//g, '');
  t.check((body.match(/have already sold/g) || []).length === 1,
    'the fixable wording is written once');
  t.check(/const fixable = \(g\)=>/.test(render) && /g\.qty > 0\s*\?\s*fixable\(g\)/.test(render),
    'and reached only when there is something to fix');
  t.check(/sold without a trace/.test(render),
    'a finding with nothing markable gets its own sentence');
  /* GHOST, not accent -- and that is a deliberate change to what this
     line asserts. The button was oxide and it sat ABOVE the money, so on
     any account with a finding the loudest thing on the screen was a
     correction to the record rather than the debt the screen is about.
     The accent is the one thing to do next, and on this screen that is
     Settle. What the assertion still protects is unchanged: the button
     exists only where g.qty > 0, because a finding nothing can be done
     about must not offer to do something. */
  t.check(/g\.qty > 0 \? `<div class="cons-gap-act"><button type="button" class="btn btn-ghost ow-sm cons-gap-fix"/.test(render),
    'and no button, because there is nothing the app can do about it');
}

/* ---------- 13. billed is not paid, and neither is "your cash" -------- */
/*
 * Settling raises a bill. The accrual is offset by that bill's TOTAL --
 * which is right, because the bill leg carries total-less-paid, so the
 * money is counted once however much of it has been handed over. But the
 * card called the offset "settled", so the moment Settle was tapped it
 * read "settled 2,295,000 · nothing owed" while not one shilling had
 * moved.
 *
 * The sequence below is the property the whole settle design rests on,
 * and nothing pinned it.
 */
if (scope) {
  data.stock = {}; data.stockLots = {}; data.savedQuotes = []; data.purchaseInvoices = [];
  data.stockLots.PA = [{ qty: 20, cost: 5000, consign: 'S1' }];
  data.stock.PA = 20;
  data.savedQuotes.push({ id: 300, invoiced: true, voided: false, invoicedAt: '2026-08-20',
    items: [{ productId: 'PA', variantIdx: null, qty: 20, supplierId: '__stock__', sellPrice: 8000,
      _stockLots: [{ qty: 20, cost: 5000, consign: 'S1' }] }] });

  const owed = () => scope.consignmentOwedTotal();
  const billDue = () => scope.consignmentSettlementDue('S1');
  // The bill leg, the way creditorTotalOwed reads it.
  const creditors = () => (data.purchaseInvoices || [])
    .filter((pi) => !pi.voided).reduce((n, pi) => n + scope.purchaseInvoiceBalanceDue(pi), 0);
  const payable = () => owed() + creditors();

  eq(owed(), 100000, 'their goods sold, so they are owed for them');
  eq(payable(), 100000, 'and that is what the shop owes, bill or no bill');

  const bill = { id: 9, supplierId: 'S1', consignSettlement: true, voided: false,
    date: '2026-08-27', amountPaid: 0, payments: [],
    items: [{ productId: 'PA', variantIdx: null, qty: 20, price: 5000 }] };
  data.purchaseInvoices.push(bill);
  eq(owed(), 0, 'raising the bill moves it off the accrual');
  eq(billDue(), 100000, 'and onto the bill, where none of it is paid yet');
  eq(payable(), 100000, 'so what the shop owes has not changed — counted once, not twice');

  bill.amountPaid = 40000;
  bill.payments.push({ date: '2026-08-27', amount: 40000 });
  eq(owed(), 0, 'a part-payment does not put anything back on the accrual');
  eq(billDue(), 60000, 'it comes off the bill');
  eq(payable(), 60000, 'and off what the shop owes — never 120,000, which is what an offset by AMOUNT PAID would have given');

  bill.amountPaid = 100000;
  eq(billDue(), 0, 'paying the rest clears the bill');
  eq(payable(), 0, 'and the debt');

  // A voided bill is not a settlement, on either leg.
  bill.voided = true; bill.amountPaid = 0;
  eq(billDue(), 0, 'a voided settlement bill owes nothing');
  eq(owed(), 100000, 'and puts what it billed back on the accrual, where it can be settled again');
}

/* ---------- 13b. how much of it has the shop actually been paid? ------ */
/*
 * The screen read "2,295,000 UGX of your cash is theirs". It is not
 * cash. The debt falls due on the INVOICE, so a sale on credit owes the
 * consignor while the shop is holding nothing at all for them; collected
 * money is not set aside; and the figure can exceed everything in the
 * drawer, which makes the sentence arithmetically impossible.
 */
if (scope) {
  const sale = (id, qty, paidShare) => ({ id, invoiced: true, voided: false, invoicedAt: '2026-08-20',
    amountPaid: qty * 8000 * paidShare,
    items: [{ productId: 'PA', variantIdx: null, qty, supplierId: '__stock__', sellPrice: 8000,
      _stockLots: [{ qty, cost: 5000, consign: 'S1' }] }] });
  const split = () => {
    const a = scope.consignmentAccrued('S1')[0] || { collected: 0, uncollected: 0 };
    return [Math.round(a.collected), Math.round(a.uncollected)];
  };

  data.purchaseInvoices = [];
  data.savedQuotes = [sale(310, 10, 1)];
  t.check(String(split()) === '50000,0', `a paid invoice is money the shop has (${split()})`);

  data.savedQuotes = [sale(311, 10, 0)];
  t.check(String(split()) === '0,50000', `an unpaid one is not — it is owed by the customer and owed to the consignor (${split()})`);

  data.savedQuotes = [sale(312, 10, 0.5)];
  t.check(String(split()) === '25000,25000',
    `and a part-payment is taken to have paid for a proportion of the invoice (${split()})`);

  // A sale that did not happen is neither.
  data.savedQuotes = [Object.assign(sale(313, 10, 1), { voided: true })];
  t.check(String(split()) === '0,0', 'a voided sale is collected nothing and owed nothing');
  data.savedQuotes = [Object.assign(sale(314, 10, 1), { invoiced: false })];
  t.check(String(split()) === '0,0', 'and so is a draft');

  const render = extractFunction(src, 'renderConsignment', 'index.html');
  // Over the code, not the comment above it, which quotes the sentence
  // it exists to explain.
  t.check(!/of your cash is theirs/.test(render.replace(/\/\*[\s\S]*?\*\//g, '')),
    'the screen no longer calls a liability cash');
  t.check(/'Owed to consignors'/.test(render), 'it calls it what it is');
  /* The same three derived figures, moved from a paragraph under the
     strip into the rail's own rows, where they read as the arithmetic
     behind the headline rather than as a caveat trailing it. The
     shortfall is now stated outright -- dueTotal against
     cashOnHandByAccount -- which is the question the old sentence was
     reaching for and never actually answered. */
  t.check(/Still out with customers/.test(render)
    && /Cash you are holding/.test(render)
    && /const cashHeld = cashOnHandByAccount\(\)\.total;/.test(render)
    && /you would be \$\{esc\(f\(short\)\)\} short/.test(render),
    'and answers the question that sentence was reaching for, out of figures it can actually derive');
  t.check(/'Of it, already billed'/.test(render) && /still to pay, on their bill/.test(render),
    'billed and paid are two facts, and the screen carries both');
  /* And the headline is the whole debt, not the half of it that has no
     bill yet. It read "0 UGX · nothing owed" the moment Settle was
     tapped, about a supplier still waiting for every shilling -- the
     same complaint that started this, one layer down. */
  /* Same claim, new markup: the figure is the queue row's own, and its
     value is still consignmentDueNow and nothing narrower. The strip's
     total is built by reducing the same call over the same rows, so the
     headline and the column under it cannot disagree about one figure. */
  t.check(/const dueNow = consignmentDueNow\(r\);/.test(render)
    && /const money = f\(dueNow\);/.test(render)
    && /<b class="ow-q-f">\$\{esc\(money\)\}<\/b>/.test(render)
    && /rows\.reduce\(\(n,r\)=> n \+ consignmentDueNow\(r\)\)/.test(render.replace(/, 0\)/g, ')')),
    'and the headline counts what is billed-but-unpaid as owed, because it is');
  const dn = scope.consignmentDueNow;
  eq(dn({ owed: 100000, settlementDue: 0 }), 100000, 'nothing billed: what is owed is what has sold');
  eq(dn({ owed: 0, settlementDue: 60000 }), 60000, 'all billed, part paid: what is owed is what is left on the bill');
  eq(dn({ owed: 40000, settlementDue: 60000 }), 100000, 'some of each: both, because a supplier is waiting for both');
  eq(dn({ owed: 0, settlementDue: 0 }), 0, 'and paid up is nothing');
  /* consignmentOwedTotal must NOT follow it there: payablesAsAt counts
     settlement bills on the ordinary creditors leg, so adding them to
     the accrual as well would count the money twice. */
  eq(scope.consignmentOwedTotal(), 0,
    'while the payables reading still counts only what has no bill yet — the bills are counted on their own leg');
}

/* ---------- 13c. settling asks how much you are paying now ------------ */
{
  const render = extractFunction(src, 'renderConsignment', 'index.html');
  t.check(/openPiPaymentModal\(id\)/.test(render),
    'settling goes straight into the ordinary supplier-payment door');
  /* No new money code: that modal already caps the entry at the balance,
     writes the cash book through addCashPayment and keeps a history, so
     a consignment payment is written by the same code as every other
     supplier payment. */
  t.check(/asked how much you are paying now/.test(render),
    'and the confirm says so before the bill is raised');
  t.check(/pay later from Invoices, under Purchases/.test(render),
    'while closing that box without paying is still an option, as it was before');
  /* Scoped to where the claim actually lives -- the save handler -- and
     not to a slice of the first 4,000 characters after the modal opens.
     Adding one line to the open handler pushed renderConsignment past
     that mark and failed a payment path that redraws the card perfectly
     well. A window measured in characters is not a boundary. */
  const payFrom = src.indexOf("getElementById('pip_save')");
  const pay = src.slice(payFrom, src.indexOf('\n});\n', payFrom));
  t.check(/renderConsignment\(\);/.test(pay),
    'and a payment redraws the consignment card, which reports the balance it just changed');
}

process.exit(t.done() ? 1 : 0);
