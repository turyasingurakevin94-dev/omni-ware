#!/usr/bin/env node
'use strict';
/*
 * CORRECTING A DELIVERY.
 *
 * A delivery against the shop's own buy order raises ONE bill for the
 * whole lorry — nine lines, one supplier, one thing to pay. That is what
 * the supplier hands over and what the owner pays against.
 *
 * It was the one purchase in this app that could not be corrected. The
 * correction screen repaired a bill by writing `pi.items[0]` — one line,
 * because the only purchases it had ever seen raised a bill of one — so
 * a delivery was kept out of it deliberately: letting it through would
 * have had the owner correct the cement and silently overwrite the wall
 * angle with cement's figures, in a record nobody re-reads until they
 * are arguing with a supplier about it. The owner's only way out was to
 * void the whole bill.
 *
 * What this file holds to account:
 *
 *   THE LINE THIS ROW IS ABOUT, found by content, never items[0]. One
 *   stock movement per line, each stamped with the bill; correcting one
 *   must touch one.
 *
 *   REFUSED, NEVER HALF-WRITTEN. A bill carrying no line for this item
 *   is a bill this correction has no business editing, and falling back
 *   to its first line is precisely the wrong answer.
 *
 *   THE WHOLE BILL IS WHAT THE BILL COMES TO. The toast names what the
 *   bill now stands at; on nine lines, one line's own value is not that
 *   figure — it would tell the shop it owed a ninth of what it owes.
 *
 *   AND A CUSTOMER'S ORDER STAYS OUT. Those goods belong to somebody's
 *   job and the order screen corrects them. Two screens correcting one
 *   delivery is how the two come to hold different truths about it.
 *
 * Run: node test/delivery-correction.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('correcting a delivery');
const src = read('index.html');

const FNS = ['stockKey', 'addStockLot', 'consumeStockLots', 'isStockPurchaseRow', 'stockCostsEqual',
  'effectiveStockPurchase', 'stockPurchaseMinQty', 'takeBackPurchaseLots', 'stockPurchaseInvoiceFor',
  'applyStockPurchaseEdit', 'stockLogEditButtonHTML', 'ipeFillBillOptions',
  'samePiLineTarget', 'purchaseInvoiceTotal', 'purchaseInvoiceBalanceDue'];

const data = {};
const syncCalls = [];
let nextId = 100;

const scope = compileScope(
  FNS.map((n) => extractFunction(src, n, 'index.html')),
  {
    data,
    STOCK_PURCHASE_NOTE_RE: /^Purchased\b/,
    fmtUGX: (n) => `${Number(n).toLocaleString('en-US')} UGX`,
    supplierName: (id) => (data.suppliers.find((s) => s.id === id) || {}).name || '(unknown)',
    purchaseInvoiceNumberLabel: (pi) => 'PINV-' + String(pi.id).padStart(4, '0'),
    productVariantLabel: (p) => p.name,
    allocRowId: () => ++nextId,
    todayISO: () => '2026-08-31',
    esc: (s) => String(s == null ? '' : s),
    syncPriceRegistryFromPurchase: (...a) => { syncCalls.push(a); },
    /* A stub DOM just wide enough for the form's bill panel: the three
       elements it reads, and nothing else. */
    document: { getElementById: (id) => dom[id] || null },
  },
  FNS,
);
const dom = {
  ipe_bill: { disabled: false, innerHTML: '' },
  ipe_bill_note: { style: { display: '' }, textContent: '' },
  ipe_supplier: { value: 'S1' },
};
const { applyStockPurchaseEdit, isStockPurchaseRow, stockLogEditButtonHTML, effectiveStockPurchase } = scope;
const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);

/* One lorry from ABC: 30 bags of cement at 27,000 and 200 wall angle at
   2,300. One bill, PINV-9, 1,270,000 in all. Two stock movements, both
   stamped with it. */
function freshDelivery(over) {
  const o = over || {};
  Object.keys(data).forEach((k) => delete data[k]);
  Object.assign(data, {
    products: [{ id: 'P1', name: 'Cement' }, { id: 'P2', name: 'Wall Angle' }],
    suppliers: [{ id: 'S1', name: 'ABC' }, { id: 'S2', name: 'Roto' }],
    stock: { P1: o.cementOnHand != null ? o.cementOnHand : 30, P2: 200 },
    stockLots: { P1: [{ qty: 30, cost: 27000 }], P2: [{ qty: 200, cost: 2300 }] },
    stockLog: [
      { id: 1, key: 'P1', productId: 'P1', variantIdx: null, label: 'Cement',
        type: 'restock', delta: 30, qtyAfter: 30, note: 'Received from ABC on order — 27,000 per bag',
        date: '2026-08-30', at: '2026-08-30T09:00:00.000Z',
        cost: 27000, supplierId: 'S1', source: 'buy-order', piId: 9 },
      { id: 2, key: 'P2', productId: 'P2', variantIdx: null, label: 'Wall Angle',
        type: 'restock', delta: 200, qtyAfter: 200, note: 'Received from ABC on order — 2,300 per pc',
        date: '2026-08-30', at: '2026-08-30T09:00:01.000Z',
        cost: 2300, supplierId: 'S1', source: 'buy-order', piId: 9 },
    ],
    purchaseInvoices: [{
      id: 9, quoteId: null, customerName: '', supplierId: 'S1', supplierName: 'ABC',
      date: '2026-08-30', buyOrderId: 'o1',
      items: [
        { productId: 'P1', variantIdx: null, productName: 'Cement', unit: 'bag', qty: 30, price: 27000 },
        { productId: 'P2', variantIdx: null, productName: 'Wall Angle', unit: 'pc', qty: 200, price: 2300 },
      ],
      amountPaid: o.amountPaid || 0, payments: [], voided: false,
    }],
    prices: [],
  });
  syncCalls.length = 0;
}
const bill = () => data.purchaseInvoices[0];
const line = (pid) => bill().items.find((it) => it.productId === pid);

/* ---------- 1. a delivery can be corrected at all -------------------- */
{
  freshDelivery();
  t.check(isStockPurchaseRow(data.stockLog[0]),
    'A DELIVERY ROW IS A PURCHASE THIS SCREEN CAN CORRECT — it was kept out while the screen could only repair a bill of one line, and the owner’s only way out of a mistyped lorry was to void the whole bill');
  t.check(/stock-log-edit/.test(stockLogEditButtonHTML(data.stockLog[0])),
    'so the row offers the Edit door, where before it offered nothing');
}

/* ---------- 2. and it corrects the RIGHT line ------------------------ */
{
  freshDelivery();
  eq(scope.purchaseInvoiceTotal(bill()), 1270000, 'the lorry came to 1,270,000 across two lines');

  /* They sent 24 bags, not 30, and charged 28,000. */
  const res = applyStockPurchaseEdit(1, { qty: 24, price: 28000, supplierId: 'S1' });
  t.check(res.ok, `the cement line is corrected${res.ok ? '' : ' — ' + res.error}`);

  eq(line('P1').qty, 24, 'the CEMENT line takes the new quantity');
  eq(line('P1').price, 28000, 'and the price they actually charged');
  eq(line('P2').qty, 200,
    'AND THE WALL ANGLE IS UNTOUCHED — writing items[0] would have overwritten it with cement’s figures, silently, in the record the shop pays against');
  eq(line('P2').price, 2300, 'at the price it actually came at');
  eq(scope.purchaseInvoiceTotal(bill()), 24 * 28000 + 200 * 2300, 'and the bill comes to both lines together');
}

/* ---------- 3. what the BILL now stands at --------------------------- */
{
  freshDelivery();
  const res = applyStockPurchaseEdit(1, { qty: 24, price: 28000, supplierId: 'S1' });
  eq(res.billBefore, 1270000, 'the whole bill before');
  eq(res.billAfter, 24 * 28000 + 200 * 2300,
    'AND THE WHOLE BILL AFTER — the toast says "PINV-9 now stands at", and this line’s own value would tell the shop it owed a fraction of what it owes');
  eq(res.overpaid, false, 'nothing has been paid, so nothing is overpaid');
}

/* ---------- 4. overpaid is a fact about the whole bill --------------- */
{
  /* 500,000 already paid against a 1,270,000 lorry. Correcting cement
     down to 6 bags leaves THAT LINE worth 162,000 — a third of what was
     paid — while the BILL is still worth 622,000. Judged per line this
     would have sent the owner to argue with a supplier who owes them
     nothing. */
  freshDelivery({ amountPaid: 500000 });
  const res = applyStockPurchaseEdit(1, { qty: 6, price: 27000, supplierId: 'S1' });
  t.check(res.ok, `the correction lands${res.ok ? '' : ' — ' + res.error}`);
  eq(scope.purchaseInvoiceTotal(bill()), 622000, 'the bill is worth both lines together');
  eq(res.overpaid, false,
    'NOT OVERPAID — 500,000 against a 162,000 line looks like an overpayment and is not one; the bill is still worth 622,000');

  /* Now take the wall angle down too, and the bill really is worth less
     than was paid — which is money the supplier owes back, and the one
     thing on this screen worth interrupting for. */
  const res2 = applyStockPurchaseEdit(2, { qty: 20, price: 2300, supplierId: 'S1' });
  t.check(res2.ok, `and the second line corrects${res2.ok ? '' : ' — ' + res2.error}`);
  eq(scope.purchaseInvoiceTotal(bill()), 208000, 'leaving the bill worth 208,000');
  eq(res2.overpaid, true,
    'and NOW it is overpaid — 500,000 paid on a bill worth 208,000');
}

/* ---------- 5. a bill with no line for this item is REFUSED ---------- */
{
  freshDelivery();
  /* The bill was edited by hand and the cement line taken off it. */
  bill().items = bill().items.filter((it) => it.productId !== 'P1');
  const res = applyStockPurchaseEdit(1, { qty: 24, price: 28000, supplierId: 'S1' });
  eq(res.ok, false,
    'REFUSED, NEVER HALF-WRITTEN — falling back to the bill’s first line would put cement’s figures onto the wall angle');
  t.check(/carries no line for/.test(res.error || ''), 'and the refusal names what is wrong');
  t.check(/PINV-0009/.test(res.error || ''), 'and which bill it is about');
  eq(line('P2').qty, 200, 'the line it might have wrecked is exactly as it was');
  eq(data.stock.P1, 30, 'and nothing moved on the shelf either — a refusal costs nothing');
}

/* ---------- 6. the shelf and the lots still follow this line --------- */
{
  freshDelivery();
  applyStockPurchaseEdit(1, { qty: 24, price: 28000, supplierId: 'S1' });
  eq(data.stock.P1, 24, 'six bags come off the cement shelf');
  eq(data.stock.P2, 200, 'and the wall angle shelf does not move');
  const lots = data.stockLots.P1;
  eq(lots.reduce((n, l) => n + l.qty, 0), 24, 'the cost lots hold what is actually there');
  eq(lots.every((l) => l.cost === 28000), true, 'at the price they were really bought at');
  eq(data.stockLots.P2[0].qty, 200, 'and the other line’s lots are untouched');
}

/* ---------- 7. it is POSTED, not painted over ------------------------ */
{
  freshDelivery();
  applyStockPurchaseEdit(1, { qty: 24, price: 28000, supplierId: 'S1' });
  eq(data.stockLog[0].delta, 30,
    'THE ROW THAT WAS WRONG STAYS AS IT WAS WRITTEN — that is how a ledger corrects anything, and it keeps every later qtyAfter true');
  const fix = data.stockLog.find((r) => r.type === 'correction');
  t.check(!!fix, 'and a correction movement carries the difference');
  eq(fix.piId, 9, 'tied to the same bill');
  eq(effectiveStockPurchase(data.stockLog[0]).qty, 24, 'so what this purchase NOW says is the corrected figure');
  eq(effectiveStockPurchase(data.stockLog[1]).qty, 200, 'while the other line still says its own');
}

/* ---------- 8. the registry learns the corrected figure --------------- */
{
  freshDelivery();
  syncCalls.length = 0;
  applyStockPurchaseEdit(1, { qty: 24, price: 28000, supplierId: 'S1' });
  eq(syncCalls.length, 1, 'the price registry is taught once');
  const [pid, , sup, cost, qty, opts] = syncCalls[0];
  eq(pid, 'P1', 'about the corrected item');
  eq(sup, 'S1', 'and the supplier who charged it');
  eq(cost, 28000, 'at the figure actually paid');
  eq(qty, 24, 'for the quantity actually taken');
  eq(opts.unit, 'bag', 'in that line’s unit');

  /* THE SECOND LINE, WHICH IS THE DISCRIMINATING ONE. Cement is the
     bill's first line, so a unit read off items[0] happens to be right
     for it and wrong for everything under it — the wall angle would
     have been taught to the registry in bags. A check that can only
     pass is not a check. */
  freshDelivery();
  syncCalls.length = 0;
  applyStockPurchaseEdit(2, { qty: 180, price: 2400, supplierId: 'S1' });
  eq(syncCalls.length, 1, 'the second line teaches the registry too');
  eq(syncCalls[0][0], 'P2', 'about the wall angle');
  eq(syncCalls[0][3], 2400, 'at what they really charged for it');
  eq(syncCalls[0][5].unit, 'pc',
    'IN ITS OWN UNIT — read off items[0] the registry would have learned the wall angle’s price per BAG, which is the cement’s unit and nobody’s price');
}

/* ---------- 9. a customer's order is still not ours to correct ------- */
{
  freshDelivery();
  const receipt = { id: 5, key: 'P1', productId: 'P1', type: 'restock', delta: 10,
    note: 'Received against order INV-0004', date: '2026-08-30', source: 'order-receipt' };
  t.check(!isStockPurchaseRow(receipt),
    'A RECEIPT AGAINST A CUSTOMER’S ORDER STAYS OUT — those goods belong to somebody’s job, the order screen corrects them, and two screens correcting one delivery is how the two come to hold different truths about it');
  eq(stockLogEditButtonHTML(receipt), '', 'so it offers no Edit door here');
}

/* ---------- 10. and the form says WHICH line it will change ---------- *
 *
 * "PINV-9 will be corrected with this save" is true and reads as though
 * the whole delivery were about to move. On a bill of one line it was
 * the whole truth; on a lorry it is a sentence the owner would be right
 * to be alarmed by.
 */
{
  freshDelivery();
  dom.ipe_bill_note.textContent = '';
  scope.ipeFillBillOptions(data.stockLog[0], null);
  eq(dom.ipe_bill.disabled, true, 'the bill is fixed — a delivery’s bill is not something to pick');
  t.check(/PINV-0009/.test(dom.ipe_bill.innerHTML), 'and it is named');
  const note = dom.ipe_bill_note.textContent;
  t.check(/covers 2 lines/.test(note),
    'THE FORM SAYS THE BILL IS A WHOLE DELIVERY — without it "PINV-9 will be corrected" reads as though the lorry were about to move');
  t.check(/Only Cement changes here/.test(note), 'and which line this form actually touches');
  t.check(/1 line stays exactly as it is/.test(note), 'and that the rest of it does not');

  /* A one-line bill needs none of that, and saying it would be noise. */
  freshDelivery();
  bill().items = [bill().items[0]];
  dom.ipe_bill_note.textContent = 'stale';
  scope.ipeFillBillOptions(data.stockLog[0], null);
  eq(dom.ipe_bill_note.textContent, '',
    'a bill of one line says nothing about other lines — there are none, and a sentence about them would be noise');
}

process.exit(t.done() ? 1 : 0);
