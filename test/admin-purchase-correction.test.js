#!/usr/bin/env node
'use strict';
/*
 * Correcting a purchase that was entered wrong.
 *
 * Inventory > Purchase writes to five places in one press -- the stock
 * count, a FIFO cost lot, the movement log, a supplier bill, and the price
 * registry -- and until now none of it could be taken back. The comment
 * over the purchase invoices said so outright: "never reversed
 * automatically since a restock itself can't be un-done". A shop that
 * typed 50 where it meant 5 had no way to say so, and every margin drawn
 * off that lot was wrong from then on.
 *
 * The two things these checks exist to hold:
 *
 *   Units that have already been SOLD cannot be un-bought. They existed,
 *   they left, and a correction that pretended otherwise would drive the
 *   shelf negative or silently re-cost a sale already invoiced.
 *
 *   The units taken back are THIS purchase's own. consumeStockLots() eats
 *   from the front, which is right for a sale and wrong here -- doing it
 *   that way would leave the shop holding this purchase's goods at
 *   somebody else's cost, which is the very error being corrected.
 *
 * Run: node test/admin-purchase-correction.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('purchase correction');
const src = read('index.html');

const FNS = ['stockKey', 'addStockLot', 'consumeStockLots', 'isStockPurchaseRow', 'stockCostsEqual',
  'effectiveStockPurchase', 'stockPurchaseMinQty', 'takeBackPurchaseLots', 'stockPurchaseInvoiceFor',
  'applyStockPurchaseEdit', 'stockLogEditButtonHTML', 'stockLogCorrectedTagHTML'];

/* compileScope copies each env value into a `var` once, so the extracted
   source keeps whatever reference it was handed. Both of these are
   therefore mutated in place between scenarios rather than reassigned --
   a fresh object would leave the code under test still holding the old
   one, and every check after the first would be measuring a shop nobody
   had touched. */
const data = {};
const syncCalls = [];
let nextId = 100;

const scope = compileScope(
  FNS.map((n) => extractFunction(src, n, 'index.html')),
  {
    data,
    STOCK_PURCHASE_NOTE_RE: /^Purchased\b/,
    fmtUGX: (n) => `${Number(n).toLocaleString('en-US')} UGX`,
    supplierName: (id) => (data.suppliers.find((s) => s.id === id) || {}).name || '(unknown supplier)',
    purchaseInvoiceNumberLabel: (pi) => 'PINV-' + String(pi.id).padStart(4, '0'),
    productVariantLabel: (p) => p.name,
    allocRowId: () => ++nextId,
    todayISO: () => '2026-08-19',
    esc: (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
    syncPriceRegistryFromPurchase: (...a) => { syncCalls.push(a); },
  },
  FNS,
);

const { applyStockPurchaseEdit, effectiveStockPurchase, isStockPurchaseRow,
  stockPurchaseMinQty, stockLogEditButtonHTML, stockLogCorrectedTagHTML } = scope;

const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);

/* A shop holding 20 of one product, all of them from one purchase at
   5,000, with the supplier's bill raised against it. */
function freshShop(opts) {
  const o = opts || {};
  const qty = o.qty != null ? o.qty : 20;
  const cost = o.cost != null ? o.cost : 5000;
  Object.keys(data).forEach((k) => delete data[k]);
  Object.assign(data, {
    products: [{ id: 'P1', name: 'Sofa legs 4in chrome' }],
    suppliers: [{ id: 'S1', name: 'Kirinya Steel' }, { id: 'S2', name: 'Nakawa Hardware' }],
    stock: { P1: o.onHand != null ? o.onHand : qty },
    stockLots: { P1: o.lots || [{ qty, cost }] },
    stockLog: [{
      id: 1, key: 'P1', productId: 'P1', variantIdx: null, label: 'Sofa legs 4in chrome',
      type: 'restock', delta: qty, qtyAfter: qty, note: `Purchased from Kirinya Steel @ ${cost} per pcs`,
      date: '2026-08-18', at: '2026-08-18T09:00:00.000Z',
      cost, supplierId: 'S1', source: 'inv-purchase', piId: 7,
    }],
    purchaseInvoices: [{
      id: 7, quoteId: null, customerName: '', supplierId: 'S1', supplierName: 'Kirinya Steel',
      date: '2026-08-18', items: [{ productId: 'P1', variantIdx: null, productName: 'Sofa legs 4in chrome', qty, price: cost }],
      amountPaid: o.amountPaid || 0, payments: [], voided: false,
    }],
    prices: [],
  });
  syncCalls.length = 0;
  return data.stockLog[0];
}
const logRow = () => data.stockLog[0];

/* ---------- 1. a quantity typed wrong ---------------------------------
   The plain case, and the one the shop actually reported: 50 where 5 was
   meant. */
{
  freshShop({ qty: 50, cost: 5000 });
  const res = applyStockPurchaseEdit(1, { qty: 5, price: 5000, supplierId: 'S1' });
  t.check(res.ok, 'a purchase of 50 that should have been 5 is corrected');
  eq(data.stock.P1, 5, 'the shelf holds what was really bought');
  eq(data.stockLots.P1.reduce((n, l) => n + l.qty, 0), 5, 'and the cost lots agree with the shelf');
  eq(data.stockLots.P1[0].cost, 5000, 'at the price really paid');
  eq(effectiveStockPurchase(logRow()).qty, 5, 'and the purchase now stands at 5');
}

/* ---------- 2. a price typed wrong ------------------------------------ */
{
  freshShop({ qty: 20, cost: 500 });
  const res = applyStockPurchaseEdit(1, { qty: 20, price: 5000, supplierId: 'S1' });
  t.check(res.ok, 'a price of 500 that should have been 5,000 is corrected');
  eq(data.stock.P1, 20, 'the quantity is untouched');
  eq(data.stockLots.P1.length, 1, 'and the stock still sits in one lot');
  eq(data.stockLots.P1[0].cost, 5000, 'carrying the corrected cost, so every margin drawn off it is right from now on');
}

/* ---------- 3. units already sold cannot be un-bought ------------------
   The guard, stated in the numbers the person is looking at. 20 bought, 8
   left, so 12 are gone and the purchase cannot be said to have been
   smaller than the 12 that demonstrably existed. */
{
  freshShop({ qty: 20, cost: 5000, onHand: 8, lots: [{ qty: 8, cost: 5000 }] });
  eq(stockPurchaseMinQty(logRow()), 12, 'the floor is what has already left the shelf');
  const res = applyStockPurchaseEdit(1, { qty: 5, price: 5000, supplierId: 'S1' });
  t.check(!res.ok, 'correcting below that is refused');
  t.check(/12 of the 20 bought have already been sold/.test(res.error),
    `and the refusal says which numbers it is talking about (${JSON.stringify(res.error)})`);
  eq(data.stock.P1, 8, 'nothing moved on the shelf');
  eq(data.stockLog.length, 1, 'and nothing was posted to the log');
}

/* ---------- 4. down to exactly what was sold IS allowed ---------------- */
{
  freshShop({ qty: 20, cost: 5000, onHand: 8, lots: [{ qty: 8, cost: 5000 }] });
  const res = applyStockPurchaseEdit(1, { qty: 12, price: 5000, supplierId: 'S1' });
  t.check(res.ok, 'correcting down to exactly what was sold is allowed — those 12 did exist');
  eq(data.stock.P1, 0, 'which leaves nothing on the shelf');
  eq((data.stockLots.P1 || []).reduce((n, l) => n + l.qty, 0), 0, 'and no lots claiming otherwise');
}

/* ---------- 5. the units taken back are THIS purchase's ----------------
   The FIFO trap. An older, cheaper lot sits in front of the one being
   corrected. Taking the correction off the front would leave the shop
   holding 10 units bought at 5,000 but costed at 1,000 -- understating
   the stock's value and overstating every margin off it.

   The lots are deliberately NOT in cost order, so a correction that
   happened to pick the cheapest would still be caught. */
{
  freshShop({ qty: 10, cost: 5000, onHand: 18, lots: [{ qty: 8, cost: 1000 }, { qty: 10, cost: 5000 }] });
  const res = applyStockPurchaseEdit(1, { qty: 4, price: 5000, supplierId: 'S1' });
  t.check(res.ok, 'a purchase sitting behind an older lot is corrected');
  eq(data.stock.P1, 12, 'the shelf drops by the six that were never bought');
  const older = data.stockLots.P1.filter((l) => l.cost === 1000).reduce((n, l) => n + l.qty, 0);
  const mine = data.stockLots.P1.filter((l) => l.cost === 5000).reduce((n, l) => n + l.qty, 0);
  eq(older, 8, 'the older lot is untouched — it was not the one entered wrong');
  eq(mine, 4, 'and only this purchase gave units back');
}

/* ---------- 6. the supplier's bill follows ----------------------------- */
{
  freshShop({ qty: 50, cost: 5000 });
  applyStockPurchaseEdit(1, { qty: 5, price: 4800, supplierId: 'S1' });
  const pi = data.purchaseInvoices[0];
  eq(pi.items[0].qty, 5, 'the bill is for what was really bought');
  eq(pi.items[0].price, 4800, 'at what was really paid');
}

/* ---------- 7. money already paid pins the supplier -------------------- */
{
  freshShop({ qty: 20, cost: 5000, amountPaid: 100000 });
  const res = applyStockPurchaseEdit(1, { qty: 20, price: 5000, supplierId: 'S2' });
  t.check(!res.ok, 'a bill with money against it cannot be moved to another supplier');
  t.check(/has already been paid against PINV-0007/.test(res.error),
    `and says which bill and how much (${JSON.stringify(res.error)})`);
  eq(data.purchaseInvoices[0].supplierId, 'S1', 'the bill stays with whoever was actually paid');

  // The quantity and the price are what the bill is FOR, so those still move.
  const ok = applyStockPurchaseEdit(1, { qty: 12, price: 5000, supplierId: 'S1' });
  t.check(ok.ok, 'while the quantity on that same bill can still be corrected');
  t.check(ok.overpaid, 'and an overpayment left by the correction is reported rather than hidden');
}

/* ---------- 8. a correction is posted, not painted over ---------------- */
{
  freshShop({ qty: 50, cost: 5000 });
  applyStockPurchaseEdit(1, { qty: 5, price: 5000, supplierId: 'S1' });
  const original = data.stockLog[0];
  eq(original.delta, 50, 'the row that was wrong still says what it said');
  eq(original.qtyAfter, 50, 'including the stock it claimed at the time, so later rows stay true');
  eq(data.stockLog.length, 2, 'and the correction is its own movement');
  const corr = data.stockLog[1];
  eq(corr.type, 'correction', 'filed as a correction');
  eq(corr.delta, -45, 'carrying only the difference');
  eq(corr.corrects, 1, 'and pointing at the row it corrects');
  eq(original.correctedBy, corr.id, 'which that row points back at');
  t.check(/quantity 50 → 5/.test(corr.note), `the note says what changed (${JSON.stringify(corr.note)})`);
}

/* ---------- 9. a correction can itself be corrected -------------------- */
{
  freshShop({ qty: 50, cost: 5000 });
  applyStockPurchaseEdit(1, { qty: 5, price: 5000, supplierId: 'S1' });
  const res = applyStockPurchaseEdit(1, { qty: 8, price: 5200, supplierId: 'S1' });
  t.check(res.ok, 'the same purchase can be corrected a second time');
  eq(effectiveStockPurchase(logRow()).qty, 8, 'from the corrected figure rather than the original one');
  eq(data.stock.P1, 8, 'and the shelf follows the latest word');
  eq(data.stockLots.P1.reduce((n, l) => n + l.qty, 0), 8, 'with the lots still agreeing');
}

/* ---------- 10. nothing changed is not a correction -------------------- */
{
  freshShop({ qty: 20, cost: 5000 });
  const res = applyStockPurchaseEdit(1, { qty: 20, price: 5000, supplierId: 'S1' });
  t.check(!res.ok && /Nothing was changed/.test(res.error), 'pressing save without changing anything posts nothing');
  eq(data.stockLog.length, 1, 'so the log does not fill with movements of zero');
}

/* ---------- 11. only a purchase made HERE is correctable ---------------
   A receipt against an order and the leftovers of a broken pack are
   restocks too. Both belong to the order that caused them, and correcting
   them from this screen would leave that order claiming goods arrived
   which no longer exist. */
{
  freshShop();
  t.check(isStockPurchaseRow(logRow()), 'a purchase made from Inventory is correctable');

  const receipt = { type: 'restock', note: 'Received from Kirinya Steel for Musisi', source: 'quote-receipt' };
  t.check(!isStockPurchaseRow(receipt), 'goods received against an order are not');
  const surplus = { type: 'restock', note: 'Left over from Musisi — Kirinya Steel sells by the Ctn' };
  t.check(!isStockPurchaseRow(surplus), 'nor the leftovers of a pack that could not be broken');
  const sale = { type: 'sale', note: 'Quote for Musisi' };
  t.check(!isStockPurchaseRow(sale), 'nor a sale');
  const count = { type: 'correction', note: 'Recount after stocktake' };
  t.check(!isStockPurchaseRow(count), 'nor a stock count');

  /* Rows written before the marker existed carry no `source`. The purchase
     path is the only one whose note opens "Purchased", which is what lets
     a shop correct what it recorded last week rather than only from now on. */
  const legacy = { type: 'restock', note: 'Purchased from Kirinya Steel @ 5,000 per pcs' };
  t.check(isStockPurchaseRow(legacy), 'and a purchase recorded before this existed is still correctable');
}

/* ---------- 12. the registry is re-taught the corrected figure ---------
   It learned the wrong one from the entry being fixed. Leaving it quoting
   a price the shop has just said it never paid is worse than re-asking. */
{
  freshShop({ qty: 50, cost: 500 });
  applyStockPurchaseEdit(1, { qty: 5, price: 5000, supplierId: 'S1' });
  eq(syncCalls.length, 1, 'the price registry is told');
  eq(syncCalls[0][3], 5000, 'the corrected price, not the one being thrown away');
  eq(syncCalls[0][4], 5, 'at the corrected quantity');
}

/* ---------- 13. a purchase with no price on it ------------------------- */
{
  freshShop({ qty: 20, cost: null, lots: [{ qty: 20, cost: null }] });
  data.stockLog[0].cost = null;
  const res = applyStockPurchaseEdit(1, { qty: 20, price: 6000, supplierId: 'S1' });
  t.check(res.ok, 'a purchase recorded with no price can have one put on it');
  eq(data.stockLots.P1[0].cost, 6000, 'and the units stop costing nothing');
  eq(data.stockLots.P1.reduce((n, l) => n + l.qty, 0), 20, 'without the quantity moving');
}

/* ---------- 14. the button is offered on exactly the right rows --------
   The logic above is only reachable if the movement log actually draws a
   way in, and only on the rows it is safe for. */
{
  freshShop();
  const btn = stockLogEditButtonHTML(logRow());
  t.check(/data-edit-log="1"/.test(btn), `a purchase row carries the button, tagged with its own id (${btn})`);
  t.check(/>Edit</.test(btn), 'labelled Edit');
  eq(stockLogEditButtonHTML({ type: 'sale', note: 'Quote for Musisi' }), '', 'a sale carries none');
  eq(stockLogEditButtonHTML({ type: 'restock', note: 'Received from Kirinya Steel for Musisi', source: 'quote-receipt' }), '',
    'nor goods received against an order');
}

/* ---------- 15. a corrected row says so where it is read ---------------
   Without this the row goes on stating a figure the shop has withdrawn,
   which is the one thing a kept-but-corrected record must not do. */
{
  freshShop({ qty: 50, cost: 5000 });
  eq(stockLogCorrectedTagHTML(logRow()), '', 'an uncorrected purchase is tagged with nothing');
  applyStockPurchaseEdit(1, { qty: 5, price: 4800, supplierId: 'S1' });
  const tag = stockLogCorrectedTagHTML(logRow());
  t.check(/corrected → 5/.test(tag), `once corrected it says what it became (${tag})`);
  t.check(/4,800/.test(tag), 'including the price it became');
}

/* ---------- 16. the Roto case: a bill the lookup cannot find -----------
   A real shop corrected 60 cartons down to 30 and the supplier's balance
   did not move: the movement predated the piId stamp, carried no
   supplier, and the date fallback missed -- so the shelf was corrected,
   the bill stood, and the toast said "corrected" anyway. The result now
   says the truth (pi null), and the SECOND visit -- same figures, the
   bill picked by hand -- adopts and corrects it instead of dying on
   "Nothing was changed". */
{
  freshShop({ qty: 60, cost: 5000 });
  data.stockLog[0].piId = null;
  data.stockLog[0].supplierId = null;
  data.purchaseInvoices[0].date = '2026-08-10';   // fallback needs same-day; miss

  const first = applyStockPurchaseEdit(1, { qty: 30, price: 5000, supplierId: 'S1' });
  t.check(first.ok && first.pi === null && first.billAfter === null,
    'the shelf corrects, and the result SAYS no bill was touched — the silent half-correction cannot hide');
  eq(data.stock.P1, 30, 'thirty on the shelf');
  eq(data.purchaseInvoices[0].items[0].qty, 60, 'while the bill still claims sixty — the live symptom, reproduced');

  const second = applyStockPurchaseEdit(1, { qty: 30, price: 5000, supplierId: 'S1', adoptPiId: 7 });
  t.check(second.ok && second.billAdopted === true && second.pi.id === 7,
    `same figures plus the picked bill is a real change, not "Nothing was changed" (${JSON.stringify(second.error || null)})`);
  eq(data.purchaseInvoices[0].items[0].qty, 30, 'the bill now stands at what was really bought');
  eq(second.billBefore, 300000, 'carrying what it stood at');
  eq(second.billAfter, 150000, 'and what it stands at now — the figure the toast names');
  eq(data.stock.P1, 30, 'a bill-only repair moves money, never goods');
  eq(data.stockLots.P1.reduce((n, l) => n + l.qty, 0), 30, 'the lots agree');
  const corr2 = data.stockLog[2];
  eq(corr2.delta, 0, 'the repair posts a movement of nothing');
  eq(corr2.piId, 7, 'stamped with the bill, so the next correction finds it by id');
  t.check(/linked to PINV-0007/.test(corr2.note), `and the note says the link was made (${JSON.stringify(corr2.note)})`);
}

/* ---------- 17. a linked bill out of line is a change to make ---------- */
{
  freshShop({ qty: 30, cost: 5000 });
  data.purchaseInvoices[0].items[0].qty = 60;   // the damage an earlier half-correction left
  const res = applyStockPurchaseEdit(1, { qty: 30, price: 5000, supplierId: 'S1' });
  t.check(res.ok, 'figures matching the movement still save when the BILL disagrees');
  eq(data.purchaseInvoices[0].items[0].qty, 30, 'and the bill is re-aligned');
  eq(res.billAfter, 150000, 'to the balance the toast will name');
  t.check(/re-aligned/.test(data.stockLog[1].note), `said in the log (${JSON.stringify(data.stockLog[1].note)})`);

  const again = applyStockPurchaseEdit(1, { qty: 30, price: 5000, supplierId: 'S1' });
  t.check(!again.ok && /Nothing was changed/.test(again.error),
    'once movement and bill agree, saving the same figures posts nothing');
}

/* ---------- 18. adoption takes only this purchase's kind of bill ------- */
{
  freshShop({ qty: 60, cost: 5000 });
  data.stockLog[0].piId = null;
  data.stockLog[0].supplierId = null;
  data.purchaseInvoices[0].date = '2026-08-10';
  data.purchaseInvoices.push({ id: 8, quoteId: 41, customerName: 'Musisi', supplierId: 'S1',
    supplierName: 'Kirinya Steel', date: '2026-08-18',
    items: [{ productId: 'P1', variantIdx: null, productName: 'Sofa legs 4in chrome', qty: 60, price: 5000 }],
    amountPaid: 0, payments: [], voided: false });
  const res = applyStockPurchaseEdit(1, { qty: 30, price: 5000, supplierId: 'S1', adoptPiId: 8 });
  t.check(!res.ok && /does not match this purchase/.test(res.error),
    'a bill raised by a customer order cannot be adopted by a restock correction');
  eq(data.stockLog.length, 1, 'and the refusal wrote nothing');
  eq(data.stock.P1, 60, 'not even to the shelf');
}

/* ---------- 19. paid money pins the BILL's supplier, not the row's -----
   A legacy row with no supplier adopting the bill of the supplier who was
   actually paid is not a supplier change -- the money stays exactly where
   it went. The old guard compared against the row and refused this. */
{
  freshShop({ qty: 60, cost: 5000, amountPaid: 100000 });
  data.stockLog[0].piId = null;
  data.stockLog[0].supplierId = null;
  data.purchaseInvoices[0].date = '2026-08-10';
  const res = applyStockPurchaseEdit(1, { qty: 30, price: 5000, supplierId: 'S1', adoptPiId: 7 });
  t.check(res.ok, `naming the supplier the bill already belongs to is not moving the bill (${JSON.stringify(res.error || null)})`);
  eq(data.purchaseInvoices[0].items[0].qty, 30, 'so a part-paid bill can still be corrected');
  eq(res.billAfter, 50000, 'to what remains owed after the money already paid');
}

/* ---------- 20. the form offers the money side ------------------------- */
{
  t.check(/id="ipe_bill"/.test(src) && /Supplier bill/.test(src),
    'the correction form carries the bill line');
  t.check(/what is owed will NOT change/.test(src),
    'and an unlinked bill says plainly that the balance will not move');
  t.check(/id="ipe_qty_unit"/.test(src) && /invPurchaseQtyValue\(document\.getElementById\('ipe_qty'\)\.value/.test(src),
    'the quantity field can speak packs, through the same conversion the purchase form uses');
  t.check(/now stands at/.test(src),
    'and the saved toast names the bill’s new balance — the confirmation the owner is actually waiting for');
}

process.exit(t.done() ? 1 : 0);
