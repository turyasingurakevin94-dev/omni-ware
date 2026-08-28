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
};

let scope = null; let err = null;
try {
  scope = compileScope([
    'stockKey', 'getStockQty', 'addStockLot', 'consumeStockLots', 'restoreStockLots',
    'applyStockDelta', 'getFIFOUnitCost', 'inventoryValue',
    'consignmentHeld', 'consignmentHeldLines', 'consignmentAccrued',
    'consignmentSettlements', 'consignmentSettled', 'consignmentRows', 'consignmentOwedTotal',
    'consignmentSoldLines', 'returnConsignedStock', 'consignedUnitCostForSale', 'sellBelowCostClause',
    'consignmentMarkPlan', 'consignmentMarkApply', 'invoiceNumberLabel',
  ].map((n) => extractFunction(src, n, 'index.html')),
  env, ['addStockLot', 'applyStockDelta', 'consumeStockLots', 'restoreStockLots', 'inventoryValue',
    'consignmentHeld', 'consignmentHeldLines', 'consignmentAccrued', 'consignmentSettled',
    'consignmentRows', 'consignmentOwedTotal', 'consignmentSoldLines', 'returnConsignedStock',
    'sellBelowCostClause', 'getFIFOUnitCost', 'getStockQty', 'stockKey', 'consignmentSettlements',
    'consignmentMarkPlan', 'consignmentMarkApply']);
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
  const warn = scope.sellBelowCostClause({ productId: 'P3', variantIdx: null, qty: 3,
    unit: 'pc', sellPrice: 4000, price: 0 });
  t.check(/below the 5,000 UGX you will owe/.test(warn) && /out of your own pocket/.test(warn),
    `a shelf sale under the consigned cost is named as the loss it is (${warn})`);
  t.check(/3,000 UGX over 3/.test(warn), 'with what it costs over the whole line');

  const fine = scope.sellBelowCostClause({ productId: 'P3', variantIdx: null, qty: 3,
    unit: 'pc', sellPrice: 6000, price: 0 });
  eq(fine, '', 'and a price above it says nothing');

  data.stockLots.P4 = [{ qty: 10, cost: 5000 }];
  data.stock.P4 = 10;
  eq(scope.sellBelowCostClause({ productId: 'P4', variantIdx: null, qty: 1, sellPrice: 4000, price: 0 }), '',
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

process.exit(t.done() ? 1 : 0);
