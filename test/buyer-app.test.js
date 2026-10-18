#!/usr/bin/env node
'use strict';
/*
 * The Buyer app (buyer.html): every move it makes on an order or a trip
 * must be the move the owner's app would make, written in the shape the
 * owner's app reads.
 *
 *   1. Parity. buyer.html carries its own copies of the rules it acts on
 *      -- a supplier's terms and answer state, the ask message, carton
 *      rounding on the buying list, the trip message, what a supplier is
 *      owed, a line's quantity in the unit it was chosen in. Each runs
 *      here beside the original from index.html / shared-worker.js on the
 *      same inputs and must agree exactly.
 *   2. The answer. Sliding the last supplier to "confirmed" writes their
 *      record with the terms it covers and moves the order out of
 *      Checking with an auto stage-log entry; a prepay agent's order is
 *      stamped confirmed but held; an answer from another phone already
 *      on the server is never overwritten.
 *   3. The line moves: asked, switched, dropped with a reason, re-priced.
 *   4. A trip: made from the buying list with the row columns the owner's
 *      loader maps, its answers written as setTripLineGot does, and
 *      handed in only when every line is answered.
 *   5. Every screen draws from the fixture without throwing.
 *   6. Who decides what (docs/decision-rights.md): the Manager's price and
 *      credit decisions and a line nobody sells hold an order in Checking;
 *      a switch to another item tells Sales; a phone confirm is the
 *      Buyer's yes; a tie on price goes to the best score; the shelf's
 *      buys ride the buying list; hand-offs go to the role that takes them.
 *
 * Runs the page's real script in a sandbox with a fake database; nothing
 * is copied into this file.
 *
 * Run: node test/buyer-app.test.js   (or: npm test)
 */
const vm = require('vm');
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('buyer app');
const html = read('buyer.html');
const adminSrc = read('index.html');
const workerSrc = read('shared-worker.js');

/* ---------------- the fixture: one small shop ---------------- */
const SH = 'shop1';
const NOW = Date.now();
function fixture(){
  return {
    suppliers: [
      { id: 'S1', name: 'Kikuubo Steel Mart', phone: '0772410220', phone2: '', location: 'Kikuubo', shopNo: '14', termsDays: 30, stopAtDays: 45, deliveryDays: 2 },
      { id: 'S2', name: 'Ndeeba Pipes', phone: '', phone2: '0701552908', location: 'Ndeeba', shopNo: '', termsDays: null, stopAtDays: null, deliveryDays: null },
      { id: 'S3', name: 'Katwe Metal Works', phone: '0700000000', phone2: '', location: 'Katwe', shopNo: '', termsDays: 14, stopAtDays: null, deliveryDays: 1 },
    ],
    staff: [{ id: 'W1', name: 'Okello Peter', phone: '', role: 'worker', unavailable: false, userId: 'u1' }, { id: 'W2', name: 'Musa K', phone: '', role: 'worker', unavailable: false, userId: null }],
    agents: [{ id: 'A1', name: 'Agent One', paymentTerm: 'prepay' }],
    products: [
      { id: 'P1', name: 'Ridge caps', variants: [{ combo: { g: 'G28' } }] },
      { id: 'P2', name: 'Gutter, 4m PVC', variants: [] },
      { id: 'P3', name: 'Roofing nails', variants: [] },
    ],
    prices: [
      { id: 1, productId: 'P1', variantIdx: 0, supplierId: 'S1', wholesale: 14000, retail: 14500, unit: 'pc', packUnit: 'bundle', packQty: 10, outOfStock: false, tiers: [], date: '2026-01-01' },
      { id: 2, productId: 'P1', variantIdx: 0, supplierId: 'S3', wholesale: null, retail: 15000, unit: 'pc', packUnit: '', packQty: 0, outOfStock: false, tiers: [], date: null },
      { id: 3, productId: 'P2', variantIdx: null, supplierId: 'S2', wholesale: null, retail: 28000, unit: 'pc', packUnit: '', packQty: 0, outOfStock: false, tiers: [] },
      { id: 4, productId: 'P3', variantIdx: null, supplierId: 'S1', wholesale: 5000, retail: null, unit: 'kg', packUnit: 'box', packQty: 25, outOfStock: false, tiers: [{ minQty: 50, price: 4800 }] },
    ],
    stock: { P3: 40 }, stockLots: { P3: [{ qty: 40, cost: 4600 }] },
    savedQuotes: [], collectionTrips: [],
    purchaseInvoices: [
      { id: 7, supplierId: 'S1', date: '2026-09-20', items: [{ qty: 10, price: 14500 }, { qty: 2, price: 5000 }], transport: 5000, credits: [{ amount: 3000 }, { amount: 999, voided: true }], amountPaid: 50000, voided: false },
      { id: 8, supplierId: 'S1', date: '2026-10-01', items: [{ qty: 1, price: 1000 }], amountPaid: 1000, voided: false },
    ],
    presetPriceReview: {},
  };
}
const it = (lineId, pid, vi, qty, sid, price, extra) => ({ lineId, productId: pid, variantIdx: vi, productName: pid === 'P1' ? 'Ridge caps — G28' : pid === 'P2' ? 'Gutter, 4m PVC' : 'Roofing nails',
  unit: pid === 'P3' ? 'kg' : 'pc', packUnit: pid === 'P1' ? 'bundle' : pid === 'P3' ? 'box' : '', packQty: pid === 'P1' ? 10 : pid === 'P3' ? 25 : 0, qtyIn: 'unit', qty, supplierId: sid, supplierName: sid, price, sellPrice: null, ...(extra || {}) });
function orderRow(id, items, extra, cols){
  return { id, shop_id: SH, client_name: 'Nansana Hardware', client_phone: null, date: '2026-10-16', status: 'draft', invoiced: false, invoiced_at: null, invoiced_ts: null, amount_paid: 0, voided: false,
    payload: { client: { name: 'Nansana Hardware', phone: '' }, items, charges: [], savedAt: new Date(NOW - 3 * 3600e3).toISOString(), createdAt: new Date(NOW - 3 * 3600e3).toISOString(), stageEnteredAt: NOW - 3 * 3600e3, stageLog: [{ status: 'draft', at: NOW - 3 * 3600e3 }], ...(extra || {}) }, ...(cols || {}) };
}

/* ---------------- the page, in a sandbox ---------------- */
function loadPage(db){
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  const app = scripts.find(s => s.includes('function orderLeaveDraft'));
  if (!app) throw new Error('buyer.html has no app script');
  const el = () => ({ innerHTML: '', textContent: '', children: [], style: {}, dataset: {}, classList: { add() {}, remove() {}, toggle() {} }, setAttribute() {}, querySelector: () => null, querySelectorAll: () => [], appendChild() {}, remove() {} });
  const store = {};
  const sandbox = {
    console, setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, requestAnimationFrame: () => 0, Promise, Date, Math, JSON, URLSearchParams, encodeURIComponent, isFinite, isNaN,
    location: { hostname: 'localhost', hash: '', reload() {} },
    localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
    navigator: {},
    document: { getElementById: el, querySelector: () => null, querySelectorAll: () => [], addEventListener() {}, createElement: el, body: { appendChild() {}, style: {} }, documentElement: { classList: { toggle() {} } }, visibilityState: 'visible', activeElement: null },
    supabase: { createClient: () => db },
  };
  sandbox.window = sandbox; sandbox.window.open = () => {}; sandbox.window.addEventListener = () => {};
  vm.createContext(sandbox);
  // boot() waits on getUser, which this fake never answers: the page stays
  // unbooted and the test drives it.
  vm.runInContext(app + '\n;globalThis.__x = { S, ACT, PAGE, SHEET, D, render, orderSupplierTerms, orderSupplierConfirmState, supplierConfirmMessage, supplierTripMessage, ipLineOutlay, quoteLineQtyText, quoteLineCount, quoteLineEach, purchaseInvoiceTotal, purchaseInvoiceBalanceDue, tripShortLines, tripAllAnswered, orderPurchaseLines, buyingListRuns, beingPreparedOrders, runsToGo, tripFromRun, flushTrip, setGot, rowToQuote, rowToTrip, checkOrders, askingSuppliers, supplierOwed, viewToday, viewCheck, viewAsking, viewSuppliers, orderLeaveDraft, priceWaits, noneOpen, pickReason, restockRows, managerWaits };', sandbox);
  return sandbox.__x;
}
function fakeDb(tables){
  const writes = [];
  function Q(table){ this.t = table; this.f = []; this.op = 'select'; this.one = false; }
  Q.prototype.select = function(){ return this; };
  Q.prototype.eq = function(k, v){ this.f.push(r => String(r[k]) === String(v)); return this; };
  Q.prototype.gt = Q.prototype.gte = Q.prototype.order = Q.prototype.limit = function(){ return this; };
  Q.prototype.maybeSingle = function(){ this.one = true; return this; };
  Q.prototype.insert = function(row){ this.op = 'insert'; this.row = row; return this; };
  Q.prototype.update = function(row){ this.op = 'update'; this.row = row; return this; };
  Q.prototype.then = function(res, rej){
    const rows = tables[this.t] || (tables[this.t] = []);
    const clone = x => JSON.parse(JSON.stringify(x));
    if (this.op === 'insert') { writes.push(['insert', this.t, clone(this.row)]); rows.push(clone(this.row)); return Promise.resolve({ error: null }).then(res, rej); }
    const hit = rows.filter(r => this.f.every(f => f(r)));
    if (this.op === 'update') { writes.push(['update', this.t, clone(this.row), hit.map(r => r.id)]); hit.forEach(r => Object.assign(r, clone(this.row))); return Promise.resolve({ error: null }).then(res, rej); }
    return Promise.resolve({ data: clone(this.one ? (hit[0] || null) : hit), count: hit.length, error: null }).then(res, rej);
  };
  return { writes, tables, auth: { getUser: () => new Promise(() => {}), getSession: async () => ({ data: { session: null } }), signOut: async () => ({}) }, from: tb => new Q(tb), rpc: async (fn, args) => { writes.push(['rpc', fn, args]); return tables.__rpcOk ? { data: 1, error: null } : { data: null, error: { message: 'no rpc' } }; } };
}
function page(db, data){
  const X = loadPage(db);
  Object.assign(X.S, { data: data || fixture(), shopId: SH, user: { id: 'u1', email: 'okello@shop.ug' }, shopName: 'Omni-Ware', role: 'buyer' });
  return X;
}

/* ---------------- 1. parity with the owner's app ---------------- */
const adminData = fixture();
const admin = compileScope([
  ...['orderSupplierGroups', 'orderSupplierTerms', 'orderSupplierConfirmState', 'supplierConfirmMessage', 'supplierTripMessage', 'tripIsSupplierDelivered', 'ipLineOutlay', 'tieredUnitPrice', 'tiersForKind',
    'quoteLinePack', 'quoteLineQtyText', 'quoteLineCountPer', 'quoteLineCount', 'quoteLineEach', 'fmtUGX', 'purchaseInvoiceTotal', 'purchaseInvoiceBalanceDue'].map(n => extractFunction(adminSrc, n, 'index.html')),
  ...['tripLines', 'tripLineGot', 'tripAllAnswered', 'tripShortLines', 'staffName'].map(n => extractFunction(workerSrc, n, 'shared-worker.js')),
], { data: adminData, TRIP_SUPPLIER_CARRIER: '__supplier__', supplierName: id => (adminData.suppliers.find(s => s.id === id) || {}).name || '' },
['orderSupplierTerms', 'orderSupplierConfirmState', 'supplierConfirmMessage', 'supplierTripMessage', 'ipLineOutlay', 'quoteLineQtyText', 'quoteLineCount', 'quoteLineEach', 'purchaseInvoiceTotal', 'purchaseInvoiceBalanceDue', 'tripAllAnswered', 'tripShortLines']);

const P = page(fakeDb({}));
{
  const q = { items: [it(1, 'P1', 0, 12, 'S1', 14500), it(2, 'P3', null, 30, 'S1', 5000.4), it(3, 'P2', null, 6, 'S2', 28000), it(4, 'P1', 0, 4, '__stock__', 13000)],
    supplierConfirms: { S1: { state: 'confirmed', at: 1, terms: 'P1:0:12:14500|P3::30:5000' }, S2: { state: 'confirmed', at: 1, terms: 'old' } } };
  ['S1', 'S2', 'S3'].forEach(sid => {
    t.check(admin.orderSupplierTerms(q, sid) === P.orderSupplierTerms(q, sid), `a supplier's terms match the owner's app (${sid})`);
    const a = admin.orderSupplierConfirmState(q, sid), b = P.orderSupplierConfirmState(q, sid);
    t.check(a.state === b.state && a.at === b.at && a.askedAt === b.askedAt, `an answer reads the same: ${sid} is ${b.state}`);
    t.check(admin.supplierConfirmMessage(q, sid) === P.supplierConfirmMessage(q, sid), `the ask to ${sid} is word for word the owner's`);
  });
  t.check(P.orderSupplierConfirmState(q, 'S2').state === 'stale', 'a yes to different terms is stale, not confirmed');
  const lines = [it(1, 'P1', 0, 25, 'S1', 14500, { qtyIn: 'pack' }), it(2, 'P3', null, 60, 'S1', 4800, { qtyIn: '' }), it(3, 'P3', null, 7, 'S1', 4800, { qtyIn: '' }), it(4, 'P2', null, 6, 'S2', 28000)];
  lines.forEach(l => {
    t.check(JSON.stringify(admin.quoteLineQtyText(l)) === JSON.stringify(P.quoteLineQtyText(l)), `quantity text matches for ${l.productName} × ${l.qty}`);
    t.check(JSON.stringify(admin.quoteLineCount(l, 15)) === JSON.stringify(P.quoteLineCount(l, 15)) && JSON.stringify(admin.quoteLineEach(l, 4800)) === JSON.stringify(P.quoteLineEach(l, 4800)), `counted units and price each match for ${l.productName}`);
  });
  adminData.prices.forEach(row => [1, 7, 10, 25, 26, 60].forEach(n => {
    t.check(JSON.stringify(admin.ipLineOutlay(row, n)) === JSON.stringify(P.ipLineOutlay(row, n)), `what leaves the supplier matches for price row ${row.id} at ${n}`);
  }));
  t.check(P.ipLineOutlay(adminData.prices[3], 30).units === 50, 'a carton-only supplier is bought in whole boxes: 30 kg asked is 50 kg collected');
  const trip = { supplierId: 'S1', assignedWorkerId: 'W2', lines: [{ productName: 'Ridge caps — G28', qty: 20, unit: 'pc', packUnit: 'bundle', packQty: 10, qtyIn: 'pack', gotQty: 20 }, { productName: 'Roofing nails', qty: 50, unit: 'kg', packUnit: 'box', packQty: 25, qtyIn: '', gotQty: 25 }] };
  ['W2', '__supplier__', null].forEach(w => { const tr = { ...trip, assignedWorkerId: w }; t.check(admin.supplierTripMessage(tr) === P.supplierTripMessage(tr), `the trip message matches the owner's (${w || 'nobody yet'})`); });
  t.check(JSON.stringify(admin.tripShortLines(trip)) === JSON.stringify(P.tripShortLines(trip)) && admin.tripAllAnswered(trip) === P.tripAllAnswered(trip), 'short lines and "all answered" read the same as the worker app');
  adminData.purchaseInvoices.forEach(pi => t.check(admin.purchaseInvoiceTotal(pi) === P.purchaseInvoiceTotal(pi) && admin.purchaseInvoiceBalanceDue(pi) === P.purchaseInvoiceBalanceDue(pi), `a bill's total and balance match (bill ${pi.id})`));
  const o = P.supplierOwed('S1');
  t.check(o.owed === 145000 + 10000 + 5000 - 3000 - 50000 && o.bills === 1 && o.oldest === '2026-09-20', 'what we owe a supplier is the open bills\' balances, dated by the oldest: ' + o.owed);
}

/* ---------------- 2-4: the writes ---------------- */
(async () => {
  // 2a. the last supplier says yes: the order leaves Checking by itself
  {
    const row = orderRow(5, [it(1, 'P1', 0, 12, 'S1', 14500), it(2, 'P2', null, 6, 'S2', 28000)], { supplierConfirms: { S2: { state: 'confirmed', at: NOW - 6e5, askedAt: NOW - 9e5, terms: 'P2::6:28000', note: '' }, S1: { state: 'pending', at: null, askedAt: NOW - 7e6, terms: null, note: '' } } });
    const db = fakeDb({ saved_quotes: [row] }), X = page(db);
    X.D().savedQuotes = [X.rowToQuote(JSON.parse(JSON.stringify(row)))];
    await X.ACT.answer(5, 'S1', 'yes');
    const up = db.writes.filter(w => w[0] === 'update' && w[1] === 'saved_quotes');
    t.check(up.length === 1, 'one write to the order');
    const p = db.tables.saved_quotes[0].payload, rec = p.supplierConfirms.S1;
    t.check(rec.state === 'confirmed' && rec.terms === 'P1:0:12:14500' && rec.askedAt === NOW - 7e6 && rec.by === 'u1' && typeof rec.at === 'number', 'the yes is recorded with the terms it covers, keeps when they were asked, and says who');
    t.check(db.tables.saved_quotes[0].status === 'awaiting_goods', 'with every supplier confirmed and goods still out, the order moves to Buying');
    const last = p.stageLog[p.stageLog.length - 1];
    t.check(last.status === 'awaiting_goods' && last.auto === true && last.at === p.stageEnteredAt && p.stageLog.length === 2, 'the stage log gains an automatic Buying entry at stageEnteredAt');
    t.check(Object.keys(up[0][2]).sort().join() === 'payload,status', 'only the payload and the status column are written');
    t.check(p.client.name === 'Nansana Hardware' && p.charges && p.savedAt, 'the rest of the payload is left as it was');
  }
  // 2b. a prepay agent's order is stamped but held
  {
    const row = orderRow(6, [it(1, 'P2', null, 6, 'S2', 28000, { sellPrice: 35000 })], { originAgentId: 'A1', agentPaymentStatus: 'unpaid' });
    const db = fakeDb({ saved_quotes: [row] }), X = page(db);
    X.D().savedQuotes = [X.rowToQuote(JSON.parse(JSON.stringify(row)))];
    await X.ACT.answer(6, 'S2', 'yes');
    const r = db.tables.saved_quotes[0];
    t.check(r.status === 'draft' && r.payload.shopConfirmedAt && r.payload.shopConfirmedTerms === 'P2::6:35000', 'a prepay agent\'s order is confirmed for the agent but waits for their money before it moves');
  }
  // 2c. another phone's answer is kept
  {
    const row = orderRow(7, [it(1, 'P1', 0, 12, 'S1', 14500), it(2, 'P2', null, 6, 'S2', 28000), it(3, 'P1', 0, 2, 'S3', 15000)]);
    const db = fakeDb({ saved_quotes: [row] }), X = page(db);
    X.D().savedQuotes = [X.rowToQuote(JSON.parse(JSON.stringify(row)))];
    db.tables.saved_quotes[0].payload.supplierConfirms = { S2: { state: 'problem', at: NOW, askedAt: null, terms: null, note: 'from the owner' } };
    await X.ACT.answer(7, 'S1', 'yes');
    const sc = db.tables.saved_quotes[0].payload.supplierConfirms;
    t.check(sc.S2 && sc.S2.note === 'from the owner' && sc.S1.state === 'confirmed', 'an answer written by another phone since this one loaded survives');
    t.check(db.tables.saved_quotes[0].status === 'draft', 'an order with a problem still on it stays in Checking');
    await X.ACT.answer(7, 'S1', 'mid');
    t.check(!db.tables.saved_quotes[0].payload.supplierConfirms.S1, 'sliding back to the middle unsays the yes (and, never asked, leaves no record)');
  }
  // 3. asked, switched, dropped, re-priced, shelved
  {
    const row = orderRow(8, [it(1, 'P1', 0, 12, 'S1', 14500), it(2, 'P2', null, 6, 'S2', 28000), it(3, 'P3', null, 10, 'S1', 5000)]);
    const db = fakeDb({ saved_quotes: [row] }), X = page(db);
    X.D().savedQuotes = [X.rowToQuote(JSON.parse(JSON.stringify(row)))];
    const sync = () => { X.D().savedQuotes = [X.rowToQuote(JSON.parse(JSON.stringify(db.tables.saved_quotes[0])))]; };
    await X.ACT.asked({ dataset: { id: '8', sid: 'S2' } });
    const s2 = db.tables.saved_quotes[0].payload.supplierConfirms.S2;
    t.check(s2 && s2.state === 'pending' && typeof s2.askedAt === 'number', 'sending the ask stamps when they were asked, still pending');
    sync();
    X.S.stack = [{ type: 'problem', args: { id: 8, sid: 'S1', lineId: 1, pick: 'alt:S3' } }];
    await X.ACT.pdo();
    let items = db.tables.saved_quotes[0].payload.items;
    t.check(items[0].supplierId === 'S3' && items[0].supplierName === 'Katwe Metal Works' && items[0].price === 15000, 'switching moves the line to the other supplier at their price');
    t.check(X.S.stack[X.S.stack.length - 1].type === 'ask' && X.S.stack[X.S.stack.length - 1].args.sid === 'S3', 'and opens the ask to the new supplier');
    sync();
    X.S.stack = [{ type: 'problem', args: { id: 8, sid: 'S1', lineId: 3, pick: 'shelf' } }];
    await X.ACT.pdo();
    items = db.tables.saved_quotes[0].payload.items;
    t.check(items[2].supplierId === '__stock__' && items[2].supplierName === 'Our stock' && items[2].price === 4600, 'using the shelf costs the line off our own lots, as useShelf does');
    sync();
    X.S.stack = [{ type: 'problem', args: { id: 8, sid: 'S2', lineId: 2, pick: 'drop', why: 'dear' } }];
    await X.ACT.pdo();
    const p = db.tables.saved_quotes[0].payload;
    t.check(p.items.length === 2 && !p.items.some(x => x.lineId === 2), 'dropping takes the line off the order');
    t.check(p.droppedLines && p.droppedLines[0].reason === 'Too dear' && p.droppedLines[0].productId === 'P2' && p.droppedLines[0].qty === 6 && p.droppedLines[0].by === 'u1', 'the dropped line is kept on the order\'s record with why');
    sync();
    X.S.stack = [{ type: 'order', args: { id: 8 } }, { type: 'price', args: { id: 8, lineId: 1, v: '160000', unit: 'pack' } }];
    await X.ACT.pgo();
    const l1 = db.tables.saved_quotes[0].payload.items.find(x => x.lineId === 1);
    t.check(l1.price === 16000 && l1.priceWas === 15000 && typeof l1.repricedAt === 'number', 'a new price for a bundle of 10 is kept per piece, with the old figure beside it');
    t.check(X.S.stack.length === 1 && X.S.stack[0].type === 'order', 're-pricing goes back to the order');
    t.check(X.orderSupplierConfirmState(X.rowToQuote(db.tables.saved_quotes[0]), 'S3').state === 'pending', 'the re-priced supplier still needs a yes');
  }
  // 3b. the last line cannot be dropped
  {
    const row = orderRow(9, [it(1, 'P2', null, 6, 'S2', 28000)]);
    const db = fakeDb({ saved_quotes: [row] }), X = page(db);
    X.D().savedQuotes = [X.rowToQuote(JSON.parse(JSON.stringify(row)))];
    X.S.stack = [{ type: 'problem', args: { id: 9, sid: 'S2', lineId: 1, pick: 'drop' } }];
    await X.ACT.pdo();
    t.check(db.tables.saved_quotes[0].payload.items.length === 1, 'an order\'s only line is never dropped — that is a cancel, and the owner\'s');
  }
  // 4. a trip, from the buying list to handed in
  {
    const buying = orderRow(10, [it(1, 'P1', 0, 12, 'S1', 14500), it(2, 'P3', null, 30, 'S1', 5000, { qtyIn: '' }), it(3, 'P2', null, 6, 'S2', 28000)], {}, { status: 'awaiting_goods' });
    const db = fakeDb({ saved_quotes: [buying], collection_trips: [] }), X = page(db);
    X.D().savedQuotes = [X.rowToQuote(JSON.parse(JSON.stringify(buying)))];
    const runs = X.runsToGo();
    t.check(runs.length === 2 && runs[0].supplierId === 'S1', 'the buying list has a stop per cheapest supplier, biggest first');
    t.check(runs[0].total === 12 * 14000 + 50 * 5000, 'a stop carries the money for whole cartons: ' + runs[0].total);
    X.S.stack = [{ type: 'plan', args: { sid: 'S1', who: 'me', given: 450000 } }];
    await X.ACT['slide:trip']();
    const ins = db.writes.filter(w => w[0] === 'insert' && w[1] === 'collection_trips');
    t.check(ins.length === 1, 'starting writes one collection_trips row');
    const r = ins[0] && ins[0][2];
    if (r) {
      t.check(Object.keys(r).sort().join() === 'accepted_at,assigned_at,assigned_worker_id,cash_given,collected_at,confirmed_at,created_at,id,lines,note,shop_id,status,supplier_id,voided', 'the row has the columns the owner\'s loader maps, and the cash given');
      t.check(/^TRIP-[0-9A-Z]+$/.test(r.id) && r.supplier_id === 'S1' && r.status === 'collecting' && r.assigned_worker_id === 'W1' && r.accepted_at && r.assigned_at && r.cash_given === 450000, 'a trip you take yourself is yours and under way, with the cash you were given');
      const l = r.lines;
      t.check(l.length === 2 && l[1].qty === 50 && l[1].expectedPrice === 5000 && l[0].clientName === 'Nansana Hardware' && l[0].gotQty === null && l[0].gotPrice === null, 'its lines are the run\'s, in whole cartons, unanswered');
      t.check(Object.keys(l[0]).sort().join() === 'clientName,expectedPrice,gotPrice,gotQty,lineId,orderId,packQty,packUnit,productId,productName,qty,qtyIn,unit,variantIdx', 'each line has exactly the fields createCollectionTripFromRun writes');
    }
    t.check(X.S.stack[0].type === 'trip', 'the truck opens');
    t.check(X.runsToGo().length === 1, 'the stop leaves the buying list once somebody is on the way');
    const id = r.id;
    X.S.stack = [{ type: 'trip', args: { id } }];
    X.ACT.tall({ dataset: { i: '0' } });
    X.ACT.tshort({ dataset: { i: '1' } });
    X.S.sheet = { type: 'tprice', args: { tripId: id, i: 1, v: '120000', unit: 'box' } };
    X.ACT.tpset({ dataset: {} });
    await X.flushTrip(id);
    const lines = db.tables.collection_trips[0].lines;
    t.check(lines[0].gotQty === 12 && lines[0].gotPrice === 14000, '"all came" is the full quantity at the expected price');
    t.check(lines[1].gotQty === 25 && lines[1].gotPrice === 4800, '"short" takes one carton off, and a paid price per box is kept per kg');
    X.ACT.tundo({ dataset: { i: '0' } });
    X.S.stack = [{ type: 'trip', args: { id } }];
    await X.ACT['slide:handin']();
    t.check(db.tables.collection_trips[0].status === 'collecting', 'a trip with a line unanswered is not handed in');
    X.ACT.tall({ dataset: { i: '0' } });
    await X.ACT['slide:handin']();
    const tr = db.tables.collection_trips[0];
    t.check(tr.status === 'collected' && tr.collected_at && tr.lines[0].gotQty === 12, 'answered in full, it is handed in for the owner to check in');
    t.check(X.S.stack[0].type === 'done', 'and the tailgate opens');
    t.check(!db.writes.some(w => ['stock', 'stock_lots', 'purchase_invoices', 'cash_txns', 'prices', 'suppliers'].includes(w[1])), 'nothing the owner keeps — stock, bills, cash, prices, suppliers — is ever written');
  }
  // 4b. sending somebody else, and a supplier delivery
  {
    const buying = orderRow(11, [it(1, 'P2', null, 6, 'S2', 28000)], {}, { status: 'preparing' });
    const db = fakeDb({ saved_quotes: [buying], collection_trips: [] }), X = page(db);
    X.D().savedQuotes = [X.rowToQuote(JSON.parse(JSON.stringify(buying)))];
    X.S.stack = [{ type: 'plan', args: { sid: 'S2', who: 'W2' } }];
    await X.ACT['slide:trip']();
    let r = db.tables.collection_trips[0];
    t.check(r && r.status === 'assigned' && r.assigned_worker_id === 'W2' && r.accepted_at === null, 'a trip sent to somebody else waits for them to take it');
    db.tables.collection_trips = []; X.D().collectionTrips = [];
    X.S.stack = [{ type: 'plan', args: { sid: 'S2', who: 'sup' } }];
    await X.ACT['slide:trip']();
    r = db.tables.collection_trips[0];
    t.check(r && r.status === 'collecting' && r.assigned_worker_id === '__supplier__' && r.cash_given === null, 'a supplier delivery starts under way, with no cash carried');
  }

  // 5. the screens draw
  {
    const data = fixture();
    const X = page(fakeDb({}), data);
    X.D().savedQuotes = [
      X.rowToQuote(orderRow(20, [it(1, 'P1', 0, 12, 'S1', 14500), it(2, 'P2', null, 6, 'S2', 28000), it(3, 'P3', null, 4, '__stock__', 4600)], { supplierConfirms: { S2: { state: 'pending', askedAt: NOW - 2 * 3600e3 }, S1: { state: 'problem', at: NOW } } })),
      X.rowToQuote(orderRow(21, [it(1, 'P1', 0, 25, 'S1', 14500, { qtyIn: 'pack' })], {}, { status: 'awaiting_goods' })),
    ];
    X.D().collectionTrips = [X.rowToTrip({ id: 'TRIP-A', supplier_id: 'S3', status: 'collecting', assigned_worker_id: 'W1', created_at: new Date(NOW - 3600e3).toISOString(), accepted_at: new Date(NOW - 3600e3).toISOString(), lines: [{ orderId: 21, lineId: 1, productId: 'P1', variantIdx: 0, productName: 'Ridge caps — G28', unit: 'pc', packUnit: 'bundle', packQty: 10, qtyIn: 'pack', clientName: 'Kato', qty: 20, expectedPrice: 15000, gotQty: 18, gotPrice: 15000 }], cash_given: 400000 }),
      X.rowToTrip({ id: 'TRIP-B', supplier_id: 'S1', status: 'collected', assigned_worker_id: 'W1', created_at: new Date(NOW - 7200e3).toISOString(), collected_at: new Date(NOW - 600e3).toISOString(), lines: [{ orderId: 21, lineId: 1, productName: 'Ridge caps — G28', unit: 'pc', packUnit: 'bundle', packQty: 10, qtyIn: 'pack', clientName: 'Kato', qty: 20, expectedPrice: 15000, gotQty: 10, gotPrice: 15000 }], cash_given: null })];
    ['viewToday', 'viewCheck', 'viewAsking', 'viewSuppliers'].forEach(v => { try { const h = X[v](); t.check(typeof h === 'string' && h.length > 200, v + ' draws'); } catch (e) { t.fail(v + ' threw: ' + e.stack); } });
    const pages = [['order', { id: 20 }], ['problem', { id: 20, sid: 'S1' }], ['ask', { sid: 'S2' }], ['ask', { sid: 'S3' }], ['price', { id: 20, lineId: 1 }], ['plan', {}], ['trip', { id: 'TRIP-A' }], ['done', { id: 'TRIP-B' }], ['supplier', { sid: 'S1' }], ['me', {}]];
    pages.forEach(([pg, a]) => { try { const h = X.PAGE[pg]({ ...a }); t.check(typeof h === 'string' && h.length > 200 && !/undefined|NaN/.test(h.replace(/data-[a-z]+="[^"]*"/g, '')), 'page ' + pg + ' draws, with no undefined or NaN in it'); } catch (e) { t.fail('page ' + pg + ' threw: ' + e.stack); } });
    ['staff', 'cash'].forEach(sh => { try { X.S.stack = [{ type: 'plan', args: { sid: 'S1' } }]; X.SHEET[sh]({ v: '100', planned: 100 }); t.pass('sheet ' + sh + ' draws'); } catch (e) { t.fail('sheet ' + sh + ' threw: ' + e.message); } });
    const html2 = X.PAGE.order({ id: 20 });
    t.check(/only one has it/.test(html2) && /cheapest of 2/.test(html2), 'each line says where its supplier ranks, or that they are the only one');
    const visible = (X.viewToday() + html2 + X.PAGE.plan({})).replace(/<[^>]*>/g, ' ');
    t.check(!/sell(ing)? ?price|margin|markup/i.test(visible), 'no selling price or margin is drawn');
  }

  // 6. who decides what
  {
    const X = page(fakeDb({}));
    const yes = (q, sid) => { q.supplierConfirms = q.supplierConfirms || {}; q.supplierConfirms[sid] = { state: 'confirmed', at: NOW, terms: X.orderSupplierTerms(q, sid) }; };
    const mk = (items, extra) => { const q = X.rowToQuote(orderRow(30, items, extra)); orderSupplierIds(q).forEach(sid => yes(q, sid)); return q; };
    const orderSupplierIds = q => [...new Set(q.items.filter(i => i.supplierId && i.supplierId !== '__stock__').map(i => i.supplierId))];
    let q = mk([it(1, 'P2', null, 6, 'S2', 28000, { priceNote: 'under', sellPrice: 27000 })]);
    t.check(X.priceWaits(q).length === 1 && !X.orderLeaveDraft(q) && q.status === 'draft', 'a price Sales set under the shop’s holds the order in Checking, whatever the suppliers say');
    q = mk([it(1, 'P2', null, 6, 'S2', 28000, { priceNote: 'under', priceReview: { state: 'approved' } })]);
    t.check(X.orderLeaveDraft(q) && q.status !== 'draft', 'once the Manager has decided the price, the last yes moves it');
    q = mk([it(1, 'P2', null, 6, 'S2', 28000)], { creditCheck: { decision: 'hold' } });
    t.check(!X.orderLeaveDraft(q) && X.managerWaits(q) === 1, 'a credit hold is the Manager’s, and holds it too');
    q = mk([it(1, 'P2', null, 6, 'S2', 28000), it(2, 'P3', null, 4, null, 0)]);
    t.check(X.noneOpen(q).length === 1 && !X.orderLeaveDraft(q), 'a line nobody sells is never billed by default: the order waits until it is decided');
    q.items[1].clientWaits = { at: NOW };
    t.check(X.orderLeaveDraft(q), '"the client waits" decides it');
  }
  {
    const row = orderRow(31, [it(1, 'P2', null, 6, 'S2', 28000), it(2, 'P3', null, 4, null, 0)], { takenBy: 'u9' });
    const db = fakeDb({ saved_quotes: [row] }), X = page(db);
    X.D().savedQuotes = [X.rowToQuote(JSON.parse(JSON.stringify(row)))];
    await X.ACT.nonedrop({ dataset: { id: '31', line: '2' } });
    const p = db.tables.saved_quotes[0].payload;
    t.check(p.items.length === 1 && p.droppedLines && p.droppedLines[0].reason === 'Nobody has it', 'dropping a line nobody sells takes it off the order and the bill, kept on the record with why');
  }
  {
    const row = orderRow(32, [it(1, 'P1', 0, 10, 'S1', 14000)], { takenBy: 'u9', supplierConfirms: { S1: { state: 'confirmed', at: NOW, terms: 'P1:0:10:14000' } } });
    const data = fixture(); data.staff.push({ id: 'W9', name: 'Grace Auma', phone: '', role: 'sales', unavailable: false, userId: 'u9' }); data.handoffs = [];
    const db = fakeDb({ saved_quotes: [row], buyer_handoffs: [] }), X = page(db, data);
    X.D().savedQuotes = [X.rowToQuote(JSON.parse(JSON.stringify(row)))];
    X.S.stack = [{ type: 'swap', args: { id: 32, lineId: 1, q: 'nails', pick: 'P3::', why: 'out' } }];
    const h = X.PAGE.swap(X.S.stack[0].args);
    t.check(/Roofing nails/.test(h) && /tell Grace/.test(h), 'search finds another item on the price list, and the switch names the seller who is told');
    await X.ACT.swapgo();
    const l = db.tables.saved_quotes[0].payload.items[0], ins = db.writes.find(w => w[0] === 'insert' && w[1] === 'buyer_handoffs');
    t.check(l.productId === 'P3' && l.supplierId === 'S1' && l.price === 5000 && l.switchedFrom && l.switchedFrom.why === 'That one is out', 'the line becomes the other item, from its cheapest supplier, and remembers what it was and why');
    t.check(ins && ins[2].kind === 'item_switch' && ins[2].for_role === 'sales' && ins[2].payload.to === 'Roofing nails', 'Sales is passed the switch to tell the client');
    t.check(X.orderSupplierConfirmState(X.rowToQuote(db.tables.saved_quotes[0]), 'S1').state !== 'confirmed', 'the old yes does not cover the new item');
  }
  {
    const row = orderRow(33, [it(1, 'P2', null, 6, 'S2', 28000)]);
    const db = fakeDb({ saved_quotes: [row], __rpcOk: true }), X = page(db);
    X.D().savedQuotes = [X.rowToQuote(JSON.parse(JSON.stringify(row)))];
    X.S.stack = [{ type: 'order', args: { id: 33 } }, { type: 'price', args: { id: 33, lineId: 1, v: '29000', unit: 'base', phone: true } }];
    await X.ACT.pgo();
    const q = X.rowToQuote(db.tables.saved_quotes[0]), rpc = db.writes.find(w => w[0] === 'rpc');
    t.check(q.items[0].price === 29000 && q.supplierConfirms.S2.state === 'confirmed' && q.supplierConfirms.S2.via === 'phone', '"they said it on the phone" re-prices the line and gives their yes on the new terms');
    t.check(q.status !== 'draft', 'and the order moves on');
    t.check(rpc && rpc[1] === 'buyer_confirm_price' && rpc[2].p_price_id === 3 && rpc[2].p_wholesale === 29000, 'the price list is updated through buyer_confirm_price, never a direct write');
  }
  {
    const data = fixture();
    data.prices.push({ id: 9, productId: 'P2', variantIdx: null, supplierId: 'S3', wholesale: 28300, retail: null, unit: 'pc', packUnit: '', packQty: 0, outOfStock: false, tiers: [] });
    const X = page(fakeDb({}), data);
    const r = X.pickReason(it(1, 'P2', null, 6, 'S2', 28000));
    t.check(r.tie && /Tie on price/.test(r.text), 'two suppliers within 2% are a tie, and the reason says the score decided it: ' + r.text);
    data.prices.push({ id: 10, productId: 'P3', variantIdx: null, supplierId: 'S3', wholesale: 6000, retail: null, unit: 'kg', packUnit: '', packQty: 0, outOfStock: false, tiers: [] });
    t.check(/Cheapest by \d+%/.test(X.pickReason(it(1, 'P3', null, 10, 'S1', 5000)).text), 'no tie: price alone picks, by how much');
  }
  {
    const data = fixture();
    data.stock = { P3: 2 }; data.presetReorderRules = { P2: { minUnits: 10 } }; data.presetBuyHolds = { P3: { reason: 'slow season', by: 'manager' } }; data.restockBuys = [];
    const X = page(fakeDb({ restock_buys: [] }), data);
    X.D().savedQuotes = [X.rowToQuote(orderRow(40, [it(1, 'P3', null, 90, '__stock__', 4600)], { createdAt: new Date(NOW - 5 * 864e5).toISOString() }, { status: 'preparing' }))];
    const rows = X.restockRows();
    const p2 = rows.find(r => r.pid === 'P2'), p3 = rows.find(r => r.pid === 'P3');
    t.check(p2 && p2.below && p2.need === 10 && p2.best && p2.best.supplierId === 'S2', 'a line under its floor is to buy, from its cheapest supplier');
    t.check(p3 && p3.hold && p3.rate === 3, 'a line selling off the shelf that runs out is found, and the Manager’s hold is kept on it');
    X.S.stack = [{ type: 'restock', args: { picked: ['P2'] } }];
    await X.ACT.rsgo();
    const db = X.S.stack; // replaced with the plan
    const runs = X.runsToGo(), stop = runs.find(r => r.supplierId === 'S2');
    t.check(stop && stop.lines.some(l => l.order.id === 'restock' && l.qty === 10), 'what you bought for the shelf rides the buying list beside the orders’ lines');
    t.check(!runs.some(r => r.lines.some(l => l.it.productId === 'P3')), 'a held line is not bought');
  }
  {
    const data = fixture();
    data.staff.push({ id: 'W5', name: 'Esther Achen', phone: '', role: 'accounts', unavailable: false, userId: null }, { id: 'W6', name: 'Ruth N', phone: '', role: 'manager', unavailable: false, userId: null });
    data.handoffs = []; data.restockBuys = [];
    const X = page(fakeDb({}), data);
    X.D().savedQuotes = [X.rowToQuote(orderRow(50, [it(1, 'P1', 0, 12, 'S1', 14500, { priceNote: 'under' }), it(2, 'P2', null, 6, null, 0)], { creditCheck: { decision: 'hold' } }))];
    X.D().collectionTrips = [X.rowToTrip({ id: 'TRIP-Y', supplier_id: 'S1', status: 'collected', assigned_worker_id: 'W1', created_at: new Date(NOW - 7200e3).toISOString(), collected_at: new Date(NOW - 600e3).toISOString(), lines: [{ orderId: 50, lineId: 1, productId: 'P1', variantIdx: 0, productName: 'Ridge caps — G28', unit: 'pc', qty: 12, expectedPrice: 14000, gotQty: 12, gotPrice: 14000, yardQty: 11 }], cash_given: 200000 })];
    const pages = [['order', { id: 50 }], ['why', { id: 50, lineId: 1 }], ['ruth', { id: 50 }], ['findsup', { id: 50, lineId: 2 }], ['swap', { id: 50, lineId: 1, q: '', pick: null, why: 'client' }], ['yard', { id: 'TRIP-Y' }], ['done', { id: 'TRIP-Y' }], ['bill', { sid: 'S1', no: '', total: '' }], ['fix', { sid: 'S1', tab: null, sel: 'price', how: 'phone', edits: {} }], ['restock', { picked: null }], ['plan', {}], ['me', {}]];
    let all = '';
    pages.forEach(([pg, a]) => { try { const h = X.PAGE[pg]({ ...a }); all += h; t.check(typeof h === 'string' && h.length > 200 && !/undefined|NaN/.test(h.replace(/data-[a-z]+="[^"]*"/g, '')), 'page ' + pg + ' draws, with no undefined or NaN in it'); } catch (e) { t.fail('page ' + pg + ' threw: ' + e.stack); } });
    const vis = all.replace(/<[^>]*>/g, ' ');
    t.check(/waits for Ruth/.test(vis) && /Esther/.test(vis), 'hand-offs name the person in the role that takes them');
    t.check(!/\bthe owner (pays|checks|keeps)/i.test(vis), 'nothing day-to-day waits for the owner');
    t.check(!/sell(ing)? ?price|margin %|markup/i.test(X.PAGE.swap({ id: 50, lineId: 1, q: '', pick: null, why: 'client' }).replace(/<[^>]*>/g, ' ')), 'switching an item never draws the selling price or a margin');
  }

  process.exit(t.done() ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
