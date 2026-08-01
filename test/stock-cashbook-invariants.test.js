#!/usr/bin/env node
'use strict';
/*
 * Invariants for the stock and Cash Book math in index.html.
 *
 * Unlike the tier-pricing rule, none of this is duplicated anywhere -- it
 * lives in index.html and nowhere else -- so there is no parity to check.
 * What matters here is different: these routines mutate paired structures
 * that have to stay consistent with each other, and the damage when they
 * don't is silent. Stock drifts, or cash goes missing from the books, and
 * nothing errors.
 *
 * So these are round-trip and conservation properties:
 *   - deducting stock for an order and reversing it returns to the start
 *   - stock never goes negative
 *   - the FIFO cost lots always account for exactly the stock on hand
 *   - a Cash Book entry and its removal cancel out exactly
 *
 * Run: node test/stock-cashbook-invariants.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('stock/cash-book invariant');
const src = read('index.html');

/* ---------- the live state these routines mutate ----------------------- */
// One object, mutated in place rather than reassigned: the compiled code
// closes over this exact reference, so resetting has to keep it.
const data = {};
function reset(stock, lots) {
  Object.keys(data).forEach((k) => delete data[k]);
  Object.assign(data, {
    stock: stock || {},
    stockLots: lots || {},
    stockLog: [],
    nextStockLogId: 1,
    cashTxns: [],
    nextCashTxnId: 1,
    products: [{ id: 'P1', name: 'Hinges' }, { id: 'P2', name: 'Sofa Legs' }],
  });
}
reset();

const env = {
  data,
  todayISO: () => '2026-08-01',
  productVariantLabel: (p, v) => (v == null ? p.name : `${p.name} / ${v}`),
  saveData: () => {},
  // Stock log and cash txn ids come from the database's block allocator now
  // (0034, see row-id-allocation.test.js). Stubbed with its offline path --
  // which is exactly the counter these routines used to increment directly --
  // so the ids here behave the way the app's do without needing a server.
  allocRowId: (name) => {
    const counter = { stockLog: 'nextStockLogId', cashTxn: 'nextCashTxnId' }[name];
    if (!counter) throw new Error(`unexpected row id kind in this scope: ${name}`);
    const id = Number(data[counter]) || 1;
    data[counter] = id + 1;
    return id;
  },
  // addCashReceipt pokes at the Cash Book tab to decide whether to re-render;
  // returning null from getElementById makes it skip that entirely.
  document: { getElementById: () => null },
  renderCbTransactions: () => {},
  renderCbSummary: () => {},
  renderCbTriggers: () => {},
};

const NAMES = [
  'stockKey', 'addStockLot', 'consumeStockLots', 'getFIFOUnitCost',
  'applyStockDelta', 'getStockQty',
  'applyQuoteStockDeduction', 'reverseQuoteStockDeduction',
  'addCashReceipt', 'addCashPayment', 'removeCashTxnsByIds',
];
const fns = compileScope(NAMES.map((n) => extractFunction(src, n, 'index.html')), env, NAMES);
const {
  getFIFOUnitCost, applyStockDelta, getStockQty,
  applyQuoteStockDeduction, reverseQuoteStockDeduction,
  addCashReceipt, addCashPayment, removeCashTxnsByIds,
} = fns;

const lotsFor = (key) => (data.stockLots[key] || []);
const lotTotal = (key) => lotsFor(key).reduce((s, l) => s + Number(l.qty || 0), 0);
const cashBalance = () => data.cashTxns.reduce(
  (s, x) => s + (x.type === 'receipt' ? Number(x.amount) : -Number(x.amount)), 0);

/* ====================== STOCK ========================================= */

/* S1 -- deduct then reverse returns to exactly where it started. This is
 * what un-invoicing an order relies on, and what editing an invoiced order
 * used to break (fixed in 32a2394 by blocking that edit). */
reset({ P1: 100, P2: 40 });
{
  const q = { client: { name: 'Acme' }, items: [
    { productId: 'P1', variantIdx: null, qty: 10, supplierId: '__stock__' },
    { productId: 'P2', variantIdx: null, qty: 5,  supplierId: '__stock__' },
  ] };
  const shortfall = applyQuoteStockDeduction(q);
  const afterDeduct = { P1: getStockQty('P1', null), P2: getStockQty('P2', null) };
  reverseQuoteStockDeduction(q);
  const afterReverse = { P1: getStockQty('P1', null), P2: getStockQty('P2', null) };
  t.check(shortfall === false && afterDeduct.P1 === 90 && afterDeduct.P2 === 35,
    `deduction takes the ordered quantity (got P1=${afterDeduct.P1}, P2=${afterDeduct.P2})`);
  t.check(afterReverse.P1 === 100 && afterReverse.P2 === 40,
    `deduct -> reverse restores stock exactly (got P1=${afterReverse.P1}, P2=${afterReverse.P2})`);
}

/* S2 -- the same round trip when there wasn't enough stock. Reversal must
 * put back what was actually taken, not what was ordered; putting back the
 * ordered amount would invent stock that never existed. */
reset({ P1: 5 });
{
  const q = { client: { name: 'Acme' }, items: [
    { productId: 'P1', variantIdx: null, qty: 10, supplierId: '__stock__' },
  ] };
  const shortfall = applyQuoteStockDeduction(q);
  const afterDeduct = getStockQty('P1', null);
  reverseQuoteStockDeduction(q);
  const afterReverse = getStockQty('P1', null);
  t.check(shortfall === true && afterDeduct === 0,
    `short stock is flagged and drains to zero (shortfall=${shortfall}, qty=${afterDeduct})`);
  t.check(afterReverse === 5,
    `reversal restores only what was actually taken, not what was ordered (got ${afterReverse})`);
}

/* S3 -- lines sourced from a supplier rather than our own stock must not
 * move stock at all, in either direction. */
reset({ P1: 100 });
{
  const q = { client: { name: 'Acme' }, items: [
    { productId: 'P1', variantIdx: null, qty: 10, supplierId: 'S001' },
  ] };
  applyQuoteStockDeduction(q);
  const afterDeduct = getStockQty('P1', null);
  reverseQuoteStockDeduction(q);
  t.check(afterDeduct === 100 && getStockQty('P1', null) === 100,
    `supplier-sourced lines never touch stock (got ${afterDeduct})`);
}

/* S4 -- stock is floored at zero, and the log records the change that
 * actually happened rather than the one that was asked for. */
reset({ P1: 5 });
{
  applyStockDelta('P1', null, -999, 'sale', 'oversell');
  const entry = data.stockLog[data.stockLog.length - 1];
  t.check(getStockQty('P1', null) === 0, `stock never goes negative (got ${getStockQty('P1', null)})`);
  t.check(entry.delta === -5 && entry.qtyAfter === 0,
    `the log records the real change, not the requested one (delta=${entry.delta})`);
}

/* S5 -- FIFO lots must always account for exactly the stock on hand. These
 * are two separate structures updated side by side; if they drift, costing
 * silently prices against stock that isn't there. */
reset({}, {});
{
  const steps = [
    ['restock', 10, 100], ['restock', 25, 120], ['sale', -12, null],
    ['restock', 5, 90],   ['sale', -20, null],  ['correction', -3, null],
    ['restock', 8, 130],  ['sale', -99, null],  ['restock', 4, 110],
  ];
  let consistent = true, detail = '';
  steps.forEach(([type, delta, cost]) => {
    applyStockDelta('P1', null, delta, type, '', cost);
    const qty = getStockQty('P1', null), lots = lotTotal('P1');
    if (qty !== lots) { consistent = false; detail = detail || `after ${type} ${delta}: stock=${qty}, lots=${lots}`; }
  });
  t.check(consistent, `FIFO lots stay in step with stock through restocks, sales and an oversell${detail ? ' — ' + detail : ''}`);
}

/* S6 -- FIFO really is first-in-first-out: the oldest priced lot is the one
 * costed against, and it's the one consumed first. */
reset({}, {});
{
  applyStockDelta('P1', null, 10, 'restock', '', 100);
  applyStockDelta('P1', null, 10, 'restock', '', 200);
  const first = getFIFOUnitCost('P1', null);
  applyStockDelta('P1', null, -10, 'sale', '');
  const second = getFIFOUnitCost('P1', null);
  t.check(first === 100 && second === 200,
    `FIFO cost follows the oldest remaining lot (${first} then ${second}, expected 100 then 200)`);
}

/* S7 -- variants are costed and counted separately from their base product. */
reset({}, {});
{
  applyStockDelta('P1', null, 10, 'restock', '', 100);
  applyStockDelta('P1', 0,    10, 'restock', '', 500);
  t.check(getStockQty('P1', null) === 10 && getStockQty('P1', 0) === 10
    && getFIFOUnitCost('P1', null) === 100 && getFIFOUnitCost('P1', 0) === 500,
    'a variant keeps its own stock level and its own FIFO cost');
}

/* ====================== CASH BOOK ===================================== */

/* C1 -- an entry and its removal cancel out exactly. Every reversal path in
 * the app (un-invoicing, deleting a quote, removing a payment) depends on
 * this, and a leftover entry means the books overstate cash on hand. */
reset();
{
  const opening = cashBalance();
  const rid = addCashReceipt('cash', 250000, 'Agent Payment', 'order #501');
  const pid = addCashPayment('cash', 90000, 'Stock Purchase', 'invoice #12');
  const mid = cashBalance();
  removeCashTxnsByIds([rid, pid]);
  t.check(typeof rid === 'number' && typeof pid === 'number',
    'cash entries return an id the caller can keep a link back to');
  t.check(mid === opening + 250000 - 90000,
    `receipts add and payments subtract (balance ${mid}, expected ${opening + 160000})`);
  t.check(cashBalance() === opening && data.cashTxns.length === 0,
    `entry -> removal restores the balance exactly (got ${cashBalance()})`);
}

/* C2 -- removal must take out only what it was asked for. Over-removal would
 * silently delete unrelated entries from the books. */
reset();
{
  const keep1 = addCashReceipt('cash', 1000, 'Sale', 'a');
  const drop  = addCashReceipt('cash', 2000, 'Sale', 'b');
  const keep2 = addCashPayment('cash', 500, 'Expense', 'c');
  removeCashTxnsByIds([drop]);
  const left = data.cashTxns.map((x) => x.id).sort();
  t.check(JSON.stringify(left) === JSON.stringify([keep1, keep2].sort()),
    `removal takes out only the ids given (left ${JSON.stringify(left)})`);
}

/* C3 -- a zero or negative entry is refused outright rather than written as
 * a no-op row that later reversals would have to reason about. */
reset();
{
  const z = addCashReceipt('cash', 0, 'Sale', 'zero');
  const n = addCashPayment('cash', -50, 'Expense', 'negative');
  t.check(z === null && n === null && data.cashTxns.length === 0,
    `zero and negative amounts are refused (receipt=${z}, payment=${n}, rows=${data.cashTxns.length})`);
}

/* C4 -- ids are unique across both kinds, since removal keys on id alone and
 * receipts and payments share one counter. */
reset();
{
  const ids = [
    addCashReceipt('cash', 10, 'a', ''), addCashPayment('cash', 20, 'b', ''),
    addCashReceipt('cash', 30, 'c', ''), addCashPayment('cash', 40, 'd', ''),
  ];
  t.check(new Set(ids).size === ids.length, `receipt and payment ids never collide (${ids.join(',')})`);
}

/* C5 -- structural guard on the fix in 2b2f652.
 *
 * Confirming an agent's cash payment has to do three things together: mark
 * it paid, credit amountPaid, and bank the cash. Setting only the flag is
 * what left settled orders reading unsettled with the money missing from the
 * books. The handler is an inline listener rather than a named function, so
 * this checks its source rather than running it -- weaker than the
 * invariants above, but it catches the specific regression cheaply. The
 * behaviour itself was verified in the browser when the fix landed. */
{
  const m = /agentPrepayConfirm'\)\.addEventListener\('click',([\s\S]*?)\n\}\);/.exec(src);
  if (!m) {
    t.fail('could not find the agentPrepayConfirm handler to check (has it been renamed?)');
  } else {
    const body = m[1];
    const has = (s) => body.includes(s);
    t.check(has("agentPaymentStatus = 'paid'") && has('addCashReceipt(') && has('amountPaid'),
      'confirming agent cash still flags it paid, banks the cash AND credits amountPaid (2b2f652)');
  }
}

process.exit(t.done() ? 1 : 0);
