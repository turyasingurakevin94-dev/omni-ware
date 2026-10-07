#!/usr/bin/env node
'use strict';
/*
 * What the app knew in memory and lost on the way to the database and
 * back -- the round trip, driven for real.
 *
 * Each case builds the row the console sends (buildSyncRows), passes it
 * through JSON the way the wire does, and reads it back through the
 * loader's own mapping, sliced out of loadData rather than retyped:
 *
 *   ORIGIN        counterSale and waConversationId ride the order's
 *                 payload, which the loader spreads back whole. Named in
 *                 the payload list, or the first save stripped them --
 *                 and a counter sale read back as an ordinary order.
 *   STOCK LOG     cost, supplier, bill, source, and the correction chain
 *                 (corrects, purchase_qty, reverses). correctedBy and
 *                 reversedBy have no column; the loader rebuilds them
 *                 from the backward pointers.
 *   LEDGER        the cash entry a payment arrived as, and the invoice a
 *                 row belongs to.
 *
 * Every new column waits for 0106: with the probe false a row carries
 * none of them (PostgREST rejects the whole upsert for one unknown
 * column), and an older row read back gains no keys at all.
 *
 * Run: node test/data-integrity.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('data integrity');
const eq = (got, want, msg) => t.check(JSON.stringify(got) === JSON.stringify(want),
  `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);
const src = read('index.html');
const mig = read('supabase/migrations/0106_data_integrity.sql');
const load = extractFunction(src, 'loadData', 'index.html');

/* The text from `from` to the bracket that closes the one opened at
   `open` -- skipping comments and strings, whose brackets are not code. */
function balanced(text, from, open) {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    const c = text[i], n = text[i + 1];
    if (c === '/' && n === '*') { i = text.indexOf('*/', i + 2) + 1; continue; }
    if (c === '/' && n === '/') { i = text.indexOf('\n', i); continue; }
    if (c === "'" || c === '"' || c === '`') {
      for (i++; i < text.length && text[i] !== c; i++) if (text[i] === '\\') i++;
      continue;
    }
    if (c === '(') depth++;
    else if (c === ')' && --depth === 0) return text.slice(from, i + 1);
  }
  throw new Error('unbalanced from ' + from);
}
const sliceFrom = (needle) => {
  const at = load.indexOf(needle);
  if (at < 0) throw new Error('not found in loadData: ' + needle);
  // The needle ends on the call that opens the expression's last bracket.
  return balanced(load, at, at + needle.lastIndexOf('('));
};
const LOAD_QUOTES = sliceFrom('(savedQuotesR.data||[]).map(');
const LOAD_STOCKLOG = sliceFrom('stockLog: stockLogRelink(').replace(/^stockLog: /, '');
const LOAD_DEBT = sliceFrom('(debtLogR.data||[]).forEach(');
const LOAD_BILLS = sliceFrom('(purchaseInvoicesR.data||[]).map(');

const FLAGS = ['priceAskedColumn', 'sourcingVariantColumn', 'sourcingImageColumn', 'linkSizeColumn', 'siteStageColumn',
  'cashTransferColumn', 'cashCoversColumns', 'customerTermsColumns', 'waPostKindsColumn', 'cashEntryMetaColumns',
  'cashCloseColumns', 'lotConsignColumn', 'transferColumn'];
const books = (over) => Object.assign({
  suppliers: [], staff: [], agents: [], customers: [], products: [], prices: [], stock: {}, stockLots: {},
  stockLog: [], cashDays: {}, cashTxns: [], savedQuotes: [], purchaseInvoices: [], supplierCommissions: [],
  fixedAssets: [], loans: [], quote: null,
}, over || {});
const sync = (on) => compileScope([
  extractFunction(src, 'dateOrNull', 'index.html'),
  extractFunction(src, 'buildSyncRows', 'index.html'),
], Object.assign({ sourcingResearchRows: () => [], stockLogMetaColumns: on, debtLogLinkColumns: on },
  Object.fromEntries(FLAGS.map((f) => [f, true]))), ['buildSyncRows']).buildSyncRows;
const wire = (x) => JSON.parse(JSON.stringify(x));
const reader = (expr, names) => compileScope([
  extractFunction(src, 'stockLogRelink', 'index.html'),
  `function __read(${names.join(', ')}){ return ${expr}; }`,
], {}, ['__read']).__read;

/* ---------- 1. a counter sale and a chat stay what they were ---------- */
{
  const counter = { id: 41, status: 'completed', invoiced: true, items: [], client: { name: 'Walk-in' },
    counterSale: true, date: '2026-10-01' };
  const chat = { id: 42, status: 'draft', items: [], client: { name: 'Achen' }, waConversationId: 9001,
    originWa: true, originWamid: 'wamid.X', date: '2026-10-01' };
  const plain = { id: 43, status: 'draft', items: [], client: { name: 'Okello' }, date: '2026-10-01' };
  const rows = wire(sync(true)(books({ savedQuotes: [counter, chat, plain] }), 'shop-1').savedQuotes);
  const back = reader(LOAD_QUOTES, ['savedQuotesR'])({ data: rows });
  eq(back[0].counterSale, true, 'a counter sale comes back a counter sale after a reload');
  eq(back[1].waConversationId, 9001, 'the chat an order was taken from comes back with it');
  eq([back[1].originWa, back[1].originWamid], [true, 'wamid.X'], 'beside the WhatsApp fields that were already kept');
  t.check(!('counterSale' in rows[2].payload) && !('waConversationId' in rows[2].payload),
    'an ordinary order carries neither key at all');
  t.check(!('counterSale' in back[2]) && !('waConversationId' in back[2]), 'and reads back without them');
  const off = wire(sync(false)(books({ savedQuotes: [counter] }), 'shop-1').savedQuotes);
  eq(off[0].payload.counterSale, true, 'no migration stands in the way: the payload column already exists');
}

/* ---------- 2. the stock log, both ways ------------------------------- */
const BASE_LOG_COLS = ['id', 'shop_id', 'key', 'product_id', 'variant_idx', 'label', 'type', 'delta', 'qty_after', 'note', 'date', 'at'];
const NEW_LOG_COLS = ['cost', 'supplier_id', 'pi_id', 'source', 'corrects', 'reverses', 'purchase_qty'];
{
  const log = [
    { id: 1, key: 'P1', productId: 'P1', variantIdx: null, label: 'Cement', type: 'restock', delta: 30, qtyAfter: 30,
      note: 'Received from ABC on order', date: '2026-10-01', at: '2026-10-01T09:00:00.000Z',
      cost: 27000, supplierId: 'S1', piId: 9, source: 'buy-order' },
    { id: 2, key: 'P1', productId: 'P1', variantIdx: null, label: 'Cement', type: 'correction', delta: -18, qtyAfter: 12,
      note: 'Purchase of 2026-10-01 corrected — quantity 30 → 12', date: '2026-10-02', at: '2026-10-02T09:00:00.000Z',
      cost: 27000, supplierId: 'S1', piId: 9, source: 'buy-order', corrects: 1, purchaseQty: 12 },
    { id: 3, key: 'P2', productId: 'P2', variantIdx: '1', label: 'Wire', type: 'restock', delta: 5, qtyAfter: 5,
      note: 'Purchased', date: '2026-10-02', at: '2026-10-02T10:00:00.000Z', cost: null, supplierId: null },
    { id: 4, key: 'P2', productId: 'P2', variantIdx: '1', label: 'Wire', type: 'reversal', delta: -5, qtyAfter: 0,
      note: 'Never happened', date: '2026-10-03', at: '2026-10-03T10:00:00.000Z', cost: null, supplierId: null,
      source: 'never-happened', reverses: 3 },
    { id: 5, key: 'P3', productId: 'P3', variantIdx: null, label: 'Nails', type: 'sale', delta: -1, qtyAfter: 9,
      note: '', date: '2026-10-03', at: '2026-10-03T11:00:00.000Z', cost: null, supplierId: null },
    { id: 6, key: 'P1', productId: 'P1', variantIdx: null, label: 'Cement', type: 'correction', delta: -12, qtyAfter: 0,
      note: 'Delivery undone', date: '2026-10-04', at: '2026-10-04T09:00:00.000Z',
      cost: 27000, supplierId: 'S1', piId: 9, source: 'buy-order', corrects: 2, purchaseQty: 0 },
  ];
  log[0].correctedBy = 2; log[1].correctedBy = 6; log[2].reversedBy = 4;

  const off = sync(false)(books({ stockLog: log }), 'shop-1').stockLog;
  t.check(off.every((r) => JSON.stringify(Object.keys(r)) === JSON.stringify(BASE_LOG_COLS)),
    'before 0106 a stock log row carries exactly the columns it always had — no new key, so the upsert cannot fail on one');

  const on = wire(sync(true)(books({ stockLog: log }), 'shop-1').stockLog);
  t.check(on.every((r) => NEW_LOG_COLS.every((k) => k in r)), 'with 0106 every row names all seven new columns');
  eq([on[0].cost, on[0].supplier_id, on[0].pi_id, on[0].source], [27000, 'S1', 9, 'buy-order'], 'a delivery carries its cost, supplier, bill and source');
  eq([on[1].corrects, on[1].purchase_qty], [1, 12], 'a correction carries the row it put right and what the purchase now stands at');
  eq([on[5].corrects, on[5].purchase_qty], [2, 0], 'an undone delivery stands at nothing — 0 kept as 0, not lost as blank');
  eq(on[3].reverses, 3, 'a reversal carries the row it took back');
  eq([on[2].cost, on[2].supplier_id, on[2].pi_id, on[2].source, on[2].corrects, on[2].purchase_qty, on[2].reverses],
    [null, null, null, null, null, null, null], 'and a row with none of it says null, never 0');
  t.check(on.every((r) => !('correctedBy' in r) && !('reversedBy' in r) && !('corrected_by' in r)),
    'the forward pointers are not sent — there is no column for them');

  const back = reader(LOAD_STOCKLOG, ['stockLogR'])({ data: on });
  eq([back[0].cost, back[0].supplierId, back[0].piId, back[0].source], [27000, 'S1', 9, 'buy-order'],
    'read back, the delivery says what it cost, from whom, on which bill, from which screen');
  eq([back[1].corrects, back[1].purchaseQty, back[5].purchaseQty], [1, 12, 0], 'the correction chain comes back');
  eq(back[3].reverses, 3, 'and the reversal\'s pointer');
  eq([back[0].correctedBy, back[1].correctedBy, back[2].reversedBy], [2, 6, 4],
    'the forward pointers are rebuilt from the backward ones, so a corrected or undone row still says so');
  t.check(!('correctedBy' in back[5]) && !('reversedBy' in back[4]) && !('reversedBy' in back[0]),
    'and only where a row was put right');
  const NEW_KEYS = ['cost', 'supplierId', 'piId', 'source', 'corrects', 'purchaseQty', 'reverses'];
  t.check(NEW_KEYS.every((k) => !(k in back[2])), 'a row with nothing to say gains no keys on the way back');
  t.check(NEW_KEYS.every((k) => !(k in back[4])), 'nor does a sale');

  // An older row, read back from a database that has the columns but not the values.
  const old = reader(LOAD_STOCKLOG, ['stockLogR'])({ data: [{ id: 7, key: 'P9', product_id: 'P9', variant_idx: null,
    label: 'Old', type: 'restock', delta: 2, qty_after: 2, note: 'Purchased', date: '2026-01-01', at: null,
    cost: null, supplier_id: null, pi_id: null, source: null, corrects: null, purchase_qty: null, reverses: null }] })[0];
  eq(Object.keys(old), ['id', 'key', 'productId', 'variantIdx', 'label', 'type', 'delta', 'qtyAfter', 'note', 'date', 'at'],
    'a row written before 0106 reads back exactly as it always did');
}

/* ---------- 3. the customer ledger, both ways ------------------------- */
{
  const customers = [{ id: 'C1', name: 'Achen', debtLog: [
    { id: 11, date: '2026-10-01', type: 'payment', amount: 50000, note: 'cash', cashTxnId: 301 },
    { id: 12, date: '2026-10-01', type: 'charge', amount: 90000, note: 'Auto-sync — INV-0042', quoteId: 42 },
    { id: 13, date: '2026-10-02', type: 'charge', amount: 1000, note: 'manual' },
  ] }];
  const off = sync(false)(books({ customers }), 'shop-1').debtLog;
  t.check(off.every((r) => !('cash_txn_id' in r) && !('quote_id' in r)),
    'before 0106 a ledger row carries no link column');
  const on = wire(sync(true)(books({ customers }), 'shop-1').debtLog);
  eq(on.map((r) => [r.cash_txn_id, r.quote_id]), [[301, null], [null, 42], [null, null]],
    'with it, the payment names its cash entry and the invoice row its invoice — and the rest say null');

  const debtByCustomer = {};
  compileScope([`function __read(debtLogR, debtByCustomer){ ${LOAD_DEBT}; }`], {}, ['__read'])
    .__read({ data: on.map((r) => Object.assign({}, r)) }, debtByCustomer);
  const rows = debtByCustomer.C1;
  eq(rows[0].cashTxnId, 301, 'read back, a payment taken on the ledger still names the money it arrived as');
  eq(rows[1].quoteId, 42, 'and an invoice\'s own row its invoice');
  t.check(!('cashTxnId' in rows[2]) && !('quoteId' in rows[2]) && !('quoteId' in rows[0]) && !('cashTxnId' in rows[1]),
    'with the key only where there is a link');
}

/* ---------- 3b. a bill keeps the buy order it was received against ---- */
{
  const received = { id: 7, date: '2026-10-01', supplierId: 'S1', supplierName: 'ABC', items: [], amountPaid: 0,
    payments: [], voided: false, buyOrderId: 5 };
  const undone = { id: 8, date: '2026-10-01', supplierId: 'S1', supplierName: 'ABC', items: [], amountPaid: 0,
    payments: [], voided: true, buyOrderId: 6, deliveryUndone: '2026-10-02' };
  const paper = { id: 9, date: '2026-10-01', supplierId: 'S1', supplierName: 'ABC', items: [], amountPaid: 0,
    payments: [], voided: false };
  const rows = wire(sync(false)(books({ purchaseInvoices: [received, undone, paper] }), 'shop-1').purchaseInvoices);
  const back = reader(LOAD_BILLS, ['purchaseInvoicesR'])({ data: rows });
  eq(back[0].buyOrderId, 5, 'a bill received against a buy order still names the order after a reload, so it can be undone');
  eq([back[1].buyOrderId, back[1].deliveryUndone], [6, '2026-10-02'],
    'and an undone delivery still reads as undone, not as a bill to unvoid');
  t.check(!('buyOrderId' in rows[2].payload) && !('deliveryUndone' in rows[2].payload),
    'a paper bill carries neither key — the payload column needs no migration');
}

/* ---------- 4. the probes, the flags and the migration ---------------- */
{
  t.check(/sb\.from\('stock_log'\)\.select\('cost, supplier_id, pi_id, source, corrects, purchase_qty, reverses'\)\.limit\(1\)/.test(load),
    'loadData probes the stock log for every 0106 column');
  t.check(/sb\.from\('customer_debt_log'\)\.select\('cash_txn_id, quote_id'\)\.limit\(1\)/.test(load),
    'and the ledger for both of its own');
  t.check(/stockLogMetaColumns = !\(stockLogMetaColR && stockLogMetaColR\.error\);/.test(load)
    && /debtLogLinkColumns = !\(debtLogLinkColR && debtLogLinkColR\.error\);/.test(load),
    'each flag is set from its own probe');
  t.check(/^let stockLogMetaColumns = false;$/m.test(src) && /^let debtLogLinkColumns = false;$/m.test(src),
    'and both start false, so nothing is sent before the probe has answered');
  [['stock_log', 'cost', 'numeric'], ['stock_log', 'supplier_id', 'text'], ['stock_log', 'pi_id', 'bigint'],
    ['stock_log', 'source', 'text'], ['stock_log', 'corrects', 'bigint'], ['stock_log', 'purchase_qty', 'numeric'],
    ['stock_log', 'reverses', 'bigint'], ['customer_debt_log', 'cash_txn_id', 'bigint'], ['customer_debt_log', 'quote_id', 'bigint'],
  ].forEach(([tbl, col, type]) => t.check(new RegExp(`add column if not exists ${col} ${type}`).test(mig)
    && mig.indexOf(`alter table public.${tbl}`) > -1 && mig.indexOf(`alter table public.${tbl}`) < mig.indexOf(`add column if not exists ${col} ${type}`),
  `0106 adds ${tbl}.${col} as ${type}`));
  t.check(!/not null/i.test(mig.slice(0, mig.indexOf('create or replace function'))) && !/references/i.test(mig),
    'nullable, with no foreign keys — audit rows outlive what they point at');

  /* A refusal that depends on 0106 names it, the way 0105's do. */
  t.check(/0106 update is applied/.test(extractFunction(src, 'undoDeliveryPlan', 'index.html')),
    'undoing a delivery that cannot be traced names the missing update');
  t.check(/0106 update is applied/.test(extractFunction(src, 'applyStockPurchaseEdit', 'index.html')),
    'and so does correcting a purchase the log no longer knows as one');
}

process.exit(t.done() ? 1 : 0);
