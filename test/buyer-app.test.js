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
  vm.runInContext(app + '\n;globalThis.__x = { S, ACT, PAGE, SHEET, D, render, dropNoneLine, slideHTML, roundStops, todayJobs, orderSupplierTerms, orderSupplierConfirmState, supplierConfirmMessage, supplierTripMessage, ipLineOutlay, quoteLineQtyText, quoteLineCount, quoteLineEach, purchaseInvoiceTotal, purchaseInvoiceBalanceDue, tripShortLines, tripAllAnswered, orderPurchaseLines, buyingListRuns, beingPreparedOrders, runsToGo, tripFromRun, flushTrip, setGot, rowToQuote, rowToTrip, checkOrders, askingSuppliers, supplierOwed, viewToday, viewCheck, viewAsking, viewSuppliers, orderLeaveDraft, priceWaits, noneOpen, pickReason, restockRows, managerWaits, heldForOrders, shelfAvailable, shelfFor, packSplitText, linePackSplit, tripLinePackSplit, staffName, tripWho, canAddMe, refreshLive, triHTML, answerOf, topArgs, pushOpen, supplierTidy, fmtPhone, poss, go, restockKind, priceItems, supplierJobs, staleBySupplier, shareToday, fixAll, fixTabs, packWords, holdOf, orderHoldReason, lineIsOnATrip, flushYes, withLineIds, roundCashAsk, tripRound, roundCash, shelfIncoming, askAllMessage, askPack, flowNow, roundStops, stopIsDone, tripPlanFor, roundHandover, restoreTripPay, setTripPay, outGroups, greetName, greeting, handInOf, stopBoughtElsewhere, cWaitFor, commitConfirm, todayJobs, askTotal, askLines, payOdd, cashStep, openTripFor, tripTakeable, tripView, tripById, roundCashH, setTripPay, orderPurchaseLines, cartonsWaiting, stopReadyWhy, holdOf, yardCommit, yardBuy, yardCardHTML, loadStoreAsks };', sandbox);
  // Every folding line drawn open, so the checks read what a tap shows.
  sandbox.__x.S.ui.oline = '*'; sandbox.__x.S.ui.ruthOpen = '*'; sandbox.__x.S.ui.rsOpen = '*'; sandbox.__x.S.ui.yaskOpen = '*';
  return sandbox.__x;
}
function fakeDb(tables){
  const writes = [];
  function Q(table){ this.t = table; this.f = []; this.op = 'select'; this.one = false; }
  Q.prototype.select = function(){ return this; };
  Q.prototype.eq = function(k, v){ this.f.push(r => String(r[k]) === String(v)); return this; };
  Q.prototype.gt = Q.prototype.gte = Q.prototype.order = Q.prototype.limit = Q.prototype.or = function(){ return this; };
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
  const storage = { from: () => ({ upload: async (path) => { writes.push(['upload', path]); return { error: null }; } }) };
  return { writes, tables, storage, auth: { getUser: () => new Promise(() => {}), getSession: async () => ({ data: { session: null } }), signOut: async () => ({}) }, from: tb => new Q(tb), rpc: async (fn, args) => { // 0165: the apps change an order through ow_patch_order
      if (fn === 'ow_patch_order') { const qs = tables.saved_quotes || (tables.saved_quotes = []), r = qs.find(x => String(x.id) === String(args.p_id)); if (!r) return { data: null, error: { message: 'This order is no longer in the books.' } }; const pl = { ...(r.payload || {}), ...JSON.parse(JSON.stringify(args.p_patch || {})) }; (args.p_drop || []).forEach(k => { delete pl[k]; }); const row = { payload: pl }; if (args.p_status != null) row.status = args.p_status; writes.push(['update', 'saved_quotes', JSON.parse(JSON.stringify(row)), [r.id]]); Object.assign(r, row); return { data: JSON.parse(JSON.stringify(r)), error: null }; }  writes.push(['rpc', fn, args]); return tables.__rpcOk ? { data: 1, error: null } : { data: null, error: { message: 'no rpc' } }; } };
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
    await X.ACT.answer(5, 'S1', 'yes', true);
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
    await X.ACT.answer(6, 'S2', 'yes', true);
    const r = db.tables.saved_quotes[0];
    t.check(r.status === 'draft' && r.payload.shopConfirmedAt && r.payload.shopConfirmedTerms === 'P2::6:35000', 'a prepay agent\'s order is confirmed for the agent but waits for their money before it moves');
  }
  // 2c. another phone's answer is kept
  {
    const row = orderRow(7, [it(1, 'P1', 0, 12, 'S1', 14500), it(2, 'P2', null, 6, 'S2', 28000), it(3, 'P1', 0, 2, 'S3', 15000)]);
    const db = fakeDb({ saved_quotes: [row] }), X = page(db);
    X.D().savedQuotes = [X.rowToQuote(JSON.parse(JSON.stringify(row)))];
    db.tables.saved_quotes[0].payload.supplierConfirms = { S2: { state: 'problem', at: NOW, askedAt: null, terms: null, note: 'from the owner' } };
    await X.ACT.answer(7, 'S1', 'yes', true);
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
    await X.ACT.pdo({ dataset: { asked: '1' } });
    let items = db.tables.saved_quotes[0].payload.items;
    t.check(items[0].supplierId === 'S3' && items[0].supplierName === 'Katwe Metal Works' && items[0].price === 15000, 'switching moves the line to the other supplier at their price');
    t.check(typeof db.tables.saved_quotes[0].payload.supplierConfirms.S3.askedAt === 'number' && X.S.stack[X.S.stack.length - 1].type === 'order', 'switch and ask is one tap: the new supplier is marked asked, and you are back on the order');
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
    t.check(X.orderSupplierConfirmState(X.rowToQuote(db.tables.saved_quotes[0]), 'S3').state === 'confirmed', 'their new price is their answer: no second confirm');
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
    X.S.stack = [{ type: 'plan', args: { sel: ['S1'], who: 'me', given: 450000 } }];
    X.D().handoffs = [];
    await X.ACT['slide:trip']();
    t.check(!db.writes.some(w => w[1] === 'collection_trips'), 'no trip starts before Accounts has handed the cash over');
    X.D().handoffs = [{ id: 'h1', kind: 'trip_cash', ref: 'round:t1', status: 'done', createdAt: new Date(NOW - 6e4).toISOString(), payload: { supplierIds: ['S1'], amount: 450000 } }];
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
    t.check(db.tables.collection_trips[0].status === 'collecting', 'every line answered, it still waits for what was paid and the receipt');
    X.ACT['in:tpaid']({ value: '417,000' });
    await X.ACT['slide:handin']();
    t.check(db.tables.collection_trips[0].status === 'collecting', 'the amount alone is not enough: the receipt photo too');
    X.S.tripPay[id].photo = { file: { name: 'r.jpg', type: 'image/jpeg' }, url: '', at: new Date(NOW).toISOString() };
    await X.ACT['slide:handin']();
    t.check(db.tables.collection_trips[0].status === 'collecting' && /data-act="toddok"/.test(X.PAGE.trip({ id })), '417,000 against a plan of 288,000 waits for "yes, it is right", with the receipt photo');
    X.ACT.toddok();
    await X.ACT['slide:handin']();
    const tr = db.tables.collection_trips[0];
    t.check(tr.status === 'collected' && tr.collected_at && tr.lines[0].gotQty === 12, 'answered in full, it is handed in for the owner to check in');
    t.check(X.S.stack[0].type === 'done', 'and the tailgate opens');
    const rc = db.writes.find(w => w[0] === 'insert' && w[1] === 'buyer_handoffs' && w[2].kind === 'paper_bill');
    t.check(rc && rc[2].for_role === 'accounts' && rc[2].payload.tripId === id && rc[2].payload.total === 417000 && rc[2].payload.receipt === true && /^shop1\//.test(rc[2].payload.photoPath), 'what was paid and the receipt go to Accounts as the trip\'s paper bill');
    t.check(/You paid/.test(X.PAGE.done({ id })) && />receipt</.test(X.PAGE.done({ id })) && /417,000/.test(X.PAGE.done({ id })), 'the tailgate shows what you said you paid, with the receipt');
    t.check(!db.writes.some(w => ['stock', 'stock_lots', 'purchase_invoices', 'cash_txns', 'prices', 'suppliers'].includes(w[1])), 'nothing the owner keeps — stock, bills, cash, prices, suppliers — is ever written');
  }
  // 4b. sending somebody else, and a supplier delivery
  {
    const buying = orderRow(11, [it(1, 'P2', null, 6, 'S2', 28000)], {}, { status: 'preparing' });
    const db = fakeDb({ saved_quotes: [buying], collection_trips: [] }), X = page(db);
    X.D().savedQuotes = [X.rowToQuote(JSON.parse(JSON.stringify(buying)))];
    X.S.stack = [{ type: 'plan', args: { sid: 'S2', who: 'W2' } }];
    X.D().handoffs = [{ id: 'h2', kind: 'trip_cash', ref: 'round:t2', status: 'done', createdAt: new Date(NOW - 6e4).toISOString(), payload: { supplierIds: ['S2'], amount: 200000 } }];
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
    await X.dropNoneLine(31, '2');
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
    t.check(rpc && rpc[1] === 'buyer_confirm_price' && rpc[2].p_price_id === 3 && rpc[2].p_wholesale === 29000 && rpc[2].p_qty === q.items[0].qty, 'the price list is updated through buyer_confirm_price with the line\'s quantity (0138), never a direct write');
  }
  {
    const data = fixture();
    data.prices.push({ id: 9, productId: 'P2', variantIdx: null, supplierId: 'S3', wholesale: 28300, retail: null, unit: 'pc', packUnit: '', packQty: 0, outOfStock: false, tiers: [] });
    const X = page(fakeDb({}), data);
    const r = X.pickReason(it(1, 'P2', null, 6, 'S2', 28000));
    t.check(r.tie && /Tie on price/.test(r.text), 'two suppliers within 2% are a tie, and the reason says the score decided it: ' + r.text);
    data.prices.push({ id: 10, productId: 'P3', variantIdx: null, supplierId: 'S3', wholesale: 6000, retail: null, unit: 'kg', packUnit: '', packQty: 0, outOfStock: false, tiers: [] });
    t.check(/Cheapest of \d+, by \d+%/.test(X.pickReason(it(1, 'P3', null, 10, 'S1', 5000)).text), 'no tie: price alone picks, by how much');
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
    t.check(!X.runsToGo().some(r => r.supplierId === 'S2'), 'a refill on a price nobody has checked waits to be asked: it is not a stop yet');
    X.D().prices.find(p => p.id === 3).date = new Date().toISOString().slice(0, 10);
    const runs = X.runsToGo(), stop = runs.find(r => r.supplierId === 'S2');
    t.check(stop && stop.lines.some(l => l.order.id === 'restock' && l.qty === 10), 'once its price is confirmed, the refill rides the buying list beside the orders’ lines');
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

  // 7. The 19 Oct 2026 end-to-end test (Q-0541)
  // 7a. Fix 3, rule A: the shelf to sell is the count less what live orders' invoices will take.
  {
    const data = fixture();
    data.stock = { P2: 20, 'P1::0': 40, P3: 5 };
    const X = page(fakeDb({}), data);
    const recv = { receivedAt: NOW - 3600e3, receivedQty: 3 };
    X.D().savedQuotes = [
      X.rowToQuote(orderRow(60, [it(1, 'P2', null, 3, 'S2', 28000, recv), it(2, 'P1', 0, 2, 'S1', 140000, { unit: 'bundle', receivedAt: NOW, receivedQty: 2 }), it(3, 'P3', null, 9, '__stock__', 4600)], {}, { status: 'completed' })),
      X.rowToQuote(orderRow(61, [it(1, 'P2', null, 5, '__stock__', 28000)], {}, { status: 'preparing', invoiced: true })),
      X.rowToQuote(orderRow(62, [it(1, 'P2', null, 4, '__stock__', 28000)], {}, { status: 'preparing', voided: true })),
      X.rowToQuote(orderRow(63, [it(1, 'P2', null, 6, '__stock__', 28000)])),
      X.rowToQuote(orderRow(64, [it(1, 'P2', null, 2, 'S2', 28000)], {}, { status: 'awaiting_goods' })),
    ];
    t.check(X.heldForOrders('P2', null) === 3 && X.shelfAvailable('P2', null) === 17, 'a delivered, uninvoiced order holds what it took (3): 17 are on the shelf to sell, not 20');
    t.check(X.heldForOrders('P1', 0) === 20 && X.shelfAvailable('P1', 0) === 20, 'a line counted in bundles holds its pieces (2 bundles of 10 = 20)');
    t.check(X.shelfAvailable('P3', null) === 0, 'what is held is never shown as less than nothing on the shelf');
    t.check(X.heldForOrders('P2', null, 60) === 0, 'an order\'s own hold can be left out when its own lines are drawn');
    const draft = X.rowToQuote(orderRow(65, [it(1, 'P2', null, 10, 'S2', 28000)]));
    X.D().savedQuotes.push(draft);
    const sh = X.shelfFor(draft, draft.items[0]);
    t.check(sh && sh.free === 11, 'Our shelf for a line in Checking: 20 on the books, 3 held by the delivered order, 6 promised by another in Checking = 11 free: ' + (sh && sh.free));
    X.D().savedQuotes = [X.D().savedQuotes[0], X.rowToQuote(orderRow(66, [it(1, 'P2', null, 4, '__stock__', 28000)]))];
    const h = X.PAGE.order({ id: 66 }).replace(/<[^>]*>/g, ' ');
    t.check(/BOOKS SAY\s+17 /.test(h) && /3 held for other orders/.test(h), 'the order\'s shelf card says what is free and what is held for orders');
  }
  // 7b. Fix 6: a supplier delivery is named by its supplier, and a handed-in trip says it waits for the Store.
  {
    const data = fixture(); data.staff.push({ id: 'W7', name: 'Juma Store', phone: '', role: 'store', unavailable: false, userId: null });
    const db = fakeDb({ saved_quotes: [], collection_trips: [] }), X = page(db, data);
    const sup = { id: 'TRIP-S', supplier_id: 'S1', status: 'collected', assigned_worker_id: '__supplier__', created_at: new Date(NOW - 7200e3).toISOString(), collected_at: new Date(NOW - 600e3).toISOString(), lines: [{ orderId: 70, lineId: 1, productId: 'P2', variantIdx: null, productName: 'Gutter, 4m PVC', unit: 'pc', packUnit: '', packQty: 0, qtyIn: '', clientName: 'Kato', qty: 6, expectedPrice: 28000, gotQty: 6, gotPrice: 28000 }], cash_given: null };
    X.D().collectionTrips = [X.rowToTrip(sup)];
    t.check(X.staffName('__supplier__', 'S1') === 'Kikuubo Steel Mart' && X.tripWho(X.D().collectionTrips[0]) === 'Kikuubo Steel Mart', 'the supplier carrier is the supplier\'s name, never "(removed staff)"');
    const h = X.PAGE.trip({ id: 'TRIP-S' });
    t.check(/Handed in · waiting for Juma/.test(h) && !/removed staff/.test(h) && !/is on it/.test(h), 'a handed-in trip\'s footer says it waits for the Store, by name');
    X.D().collectionTrips = [X.rowToTrip({ ...sup, status: 'collecting', collected_at: null, lines: sup.lines.map(l => ({ ...l, gotQty: 6 })) })];
    db.tables.collection_trips = [JSON.parse(JSON.stringify({ ...sup, shop_id: SH, status: 'collecting', collected_at: null }))];
    X.S.stack = [{ type: 'trip', args: { id: 'TRIP-S' } }];
    const before = X.refreshLive.seq || 0;
    await X.ACT['slide:handin']();
    t.check(db.tables.collection_trips[0].status === 'collected' && (X.refreshLive.seq || 0) > before, 'after a hand-in the trips are read again, so the chips stop saying "Out"');
    const stale = X.refreshLive(), fresh = X.refreshLive();
    await Promise.all([stale, fresh]);
    t.check(X.D().collectionTrips[0].status === 'collected', 'only the newest read lands');
  }
  // 7c. Fix 7: pack rounding is said, on the Check slip and on the trip.
  {
    const X = page(fakeDb({}));
    const line = it(1, 'P3', null, 30, 'S1', 5000, { qtyIn: '' });
    t.check(X.linePackSplit(line) === '30 for the order + 20 to the shelf (sold by the 25)', 'a carton-only supplier: ' + X.linePackSplit(line));
    t.check(X.linePackSplit(it(1, 'P2', null, 6, 'S2', 28000)) === '', 'a supplier who sells loose: nothing to say');
    t.check(X.packSplitText(3, 20, 20) === '3 for the order + 17 to the shelf (sold by the 20)', 'the words of the report: 3 for the order + 17 to the shelf (sold by the 20)');
    X.D().savedQuotes = [X.rowToQuote(orderRow(71, [line]))];
    t.check(/30 for the order \+ 20 to the shelf \(sold by the 25\)/.test(X.PAGE.order({ id: 71 })), 'the Check slip shows it under the line');
    const tr = X.rowToTrip({ id: 'TRIP-P', supplier_id: 'S1', status: 'collecting', assigned_worker_id: 'W1', created_at: new Date(NOW).toISOString(), lines: [{ orderId: 71, lineId: 1, productId: 'P3', variantIdx: null, productName: 'Roofing nails', unit: 'kg', packUnit: 'box', packQty: 25, qtyIn: '', clientName: 'Nansana Hardware', qty: 50, expectedPrice: 5000, gotQty: null, gotPrice: null }, { orderId: 71, lineId: 1, productId: 'P3', variantIdx: null, productName: 'Roofing nails', unit: 'kg', packUnit: 'box', packQty: 25, qtyIn: '', clientName: 'Nansana Hardware', qty: 50, expectedPrice: 5000, gotQty: null, gotPrice: null }] });
    X.D().collectionTrips = [tr];
    t.check(X.tripLinePackSplit(tr, tr.lines[0]) === '30 for the order + 20 to the shelf (sold by the 25)', 'a trip line knows the order line it buys for');
    t.check(/30 for Nansana \+ 20 to the shelf/.test(X.PAGE.trip({ id: 'TRIP-P' })), 'and the trip row says it');
    X.D().savedQuotes = [X.rowToQuote(orderRow(72, [line], {}, { status: 'awaiting_goods' }))];
    X.D().collectionTrips = [];
    t.check(/· 30 [^<]+ \+ 20 shelf/.test(X.PAGE.plan({ sid: 'S1' })), 'Plan a trip says why a stop carries more than the order: the client\'s part, then the shelf\'s');
  }
  // 7d. Fix 8: an owner with no staff row adds themself in one tap; a buyer cannot.
  {
    const data = fixture(); data.staff = data.staff.filter(s => s.userId !== 'u1');
    const db = fakeDb({ staff: [] }), X = page(db, data);
    X.S.role = 'owner';
    t.check(X.canAddMe() && /Add me to the team/.test(X.PAGE.me({})) && /tap · add me/.test(X.PAGE.plan({})) === !!X.runsToGo().length, 'the owner\'s You page offers "Add me to the team"');
    await X.ACT.addme();
    const ins = db.writes.find(w => w[0] === 'insert' && w[1] === 'staff');
    t.check(ins && ins[2].user_id === 'u1' && ins[2].role === 'buyer' && ins[2].id === 'ST001' && ins[2].shop_id === SH && ins[2].name, 'one staff row for this login, as a buyer, with an ST id');
    t.check(!X.canAddMe() && !/Add me to the team/.test(X.PAGE.me({})), 'and the offer is gone');
    const Y = page(fakeDb({ staff: [] }), (() => { const d = fixture(); d.staff = d.staff.filter(s => s.userId !== 'u1'); return d; })());
    t.check(!Y.canAddMe() && !/Add me to the team/.test(Y.PAGE.me({})), 'a buyer login is not offered it: staff rows are the owner\'s to write');
  }
  // 7e. Fix 14: a second slide while the first saves is queued, never lost.
  {
    const row = orderRow(73, [it(1, 'P1', 0, 12, 'S1', 14500), it(2, 'P2', null, 6, 'S2', 28000), it(3, 'P1', 0, 2, 'S3', 15000)]);
    const db = fakeDb({ saved_quotes: [row] }), X = page(db);
    X.D().savedQuotes = [X.rowToQuote(JSON.parse(JSON.stringify(row)))];
    const a = X.ACT.answer(73, 'S1', 'yes', true), b = X.ACT.answer(73, 'S2', 'yes', true);
    const q0 = X.D().savedQuotes[0], g = { supplierId: 'S2', lines: q0.items.filter(i => i.supplierId === 'S2'), a: X.answerOf(q0, 'S2') };
    t.check(/data-pos="yes"/.test(X.triHTML(q0, g)), 'a slide waiting to be written stays where it was let go');
    await Promise.all([a, b]);
    const sc = db.tables.saved_quotes[0].payload.supplierConfirms;
    t.check(sc.S1 && sc.S1.state === 'confirmed' && sc.S2 && sc.S2.state === 'confirmed', 'both answers are on the order');
  }
  // 7f. Fix 15: the supplier's price on the Check slip opens the re-price page.
  {
    const row = orderRow(74, [it(1, 'P2', null, 6, 'S2', 2300)]);
    const X = page(fakeDb({ saved_quotes: [row] }));
    X.D().savedQuotes = [X.rowToQuote(JSON.parse(JSON.stringify(row)))];
    t.check(/data-act="lineprice"[^>]*data-line="1"[^>]*>@ 2,300/.test(X.PAGE.order({ id: 74 })), 'the "@ 2,300" on the slip is a button');
    X.S.stack = [{ type: 'order', args: { id: 74 } }];
    X.ACT.lineprice({ dataset: { id: '74', sid: 'S2', line: '1' } });
    const top = X.S.stack[X.S.stack.length - 1];
    t.check(top.type === 'price' && top.args.id === 74 && top.args.lineId === '1' && top.args.sid === 'S2', 'tapping it opens the page to type their new price (line.reprice)');
    X.D().savedQuotes[0].status = 'awaiting_goods';
    t.check(!/data-act="lineprice"/.test(X.PAGE.order({ id: 74 })), 'past Checking it is only a figure');
  }

  // 8. The canvas build: Find a supplier, the supplier list, one supplier, trips.
  {
    const row = orderRow(80, [it(1, 'P2', null, 6, 'S2', 28000), { ...it(2, 'PZ', null, 8, null, 0), productName: 'Valley gutter 3m' }]);
    const db = fakeDb({ saved_quotes: [row] }), X = page(db);
    X.D().savedQuotes = [X.rowToQuote(JSON.parse(JSON.stringify(row)))];
    X.S.stack = [{ type: 'order', args: { id: 80 } }, { type: 'findsup', args: { id: 80, lineId: 2 } }];
    const html = X.PAGE.findsup(X.topArgs());
    t.check(/NOBODY ON OUR LIST SELLS IT/.test(html) && /Ask [^<]+ to find a supplier/.test(html), 'a line nobody sells: Find a supplier offers Sourcing');
    t.check(X.topArgs().q === 'valley gutter', 'the search starts from the name without its size');
    await X.ACT.nonewait({ dataset: { id: '80', line: '2', from: 'find' }, getAttribute: () => null });
    const line = db.tables.saved_quotes[0].payload.items.find(x => x.lineId === 2);
    t.check(line.clientWaits && line.clientWaits.by === 'u1', 'asking Sourcing marks the line client waits, with who asked (0139 makes it a request; 0144 pushes back)');
    X.D().savedQuotes = [X.rowToQuote(JSON.parse(JSON.stringify(db.tables.saved_quotes[0])))];
    t.check(/With [^<]+ · tap to undo/.test(X.PAGE.findsup(X.topArgs())) && /you ask/.test(X.PAGE.findsup(X.topArgs())), 'then it shows sent, Sourcing finds one, you ask');
    X.D().savedQuotes[0].status = 'awaiting_goods';
    t.check(!/no longer|left Checking/.test(X.PAGE.findsup(X.topArgs())), 'once the order has gone on, the waiting line still shows where it stands');
    X.S.stack = [];
    X.pushOpen({ kind: 'sourcing.found', orderId: '80' });
    t.check(X.S.stack[0].type === 'findsup' && String(X.S.stack[0].args.lineId) === '2', 'the found push opens that line');
  }
  {
    const data = fixture();
    data.suppliers.push({ id: 'S8', name: 'Kikuubo Steel Mart Ltd', phone: '', phone2: '', location: '', shopNo: '' }, { id: 'S9', name: 'Mukwano Centre 7', phone: '1', location: '' }, { id: 'S10', name: 'Mukwano Centre 13', phone: '1', location: '' });
    const X = page(fakeDb({}), data), tidy = X.supplierTidy();
    t.check(tidy.length === 1 && tidy[0].b.id === 'S8', 'one supplier twice is flagged; branches that differ by a number are not');
    t.check(X.fmtPhone('0772410220') === '0772 410 220' && X.poss('St. Mary\'s') === 'St. Mary\'s' && X.poss('Moses') === 'Moses’' && X.poss('Kato') === 'Kato’s', 'phones and names read the way people say them');
    X.S.view = 'suppliers'; X.S.ui.supTab = 'all';
    const list = X.viewSuppliers();
    t.check(/id="bx_supq"/.test(list) && /MAY BE THE SAME · 1/.test(list) && /names alike/.test(list) && /data-act="tidyall"/.test(list), 'the supplier list has its search out, and the tidy card');
    t.check(/\+ phone/.test(list), 'a supplier with no phone says so on the list');
    const one = X.PAGE.supplier({ sid: 'S8' });
    t.check(/data-act="savephone"/.test(one) && /No phone on file/.test(one) && !/wa\.me/.test(one), 'one supplier with no phone: the field sits where Call and WhatsApp go, and nothing opens WhatsApp yet');
  }
  {
    const X = page(fakeDb({}));
    X.S.stack = [{ type: 'trip', args: { id: 'T1' } }];
    X.ACT.tripsback();
    t.check(X.S.stack.length === 1 && X.S.stack[0].type === 'trips', 'back from a trip lands on Trips, wherever it was opened from');
    X.S.stack = [{ type: 'trips', args: {} }, { type: 'trip', args: { id: 'T1' } }];
    X.ACT.tripsback();
    t.check(X.S.stack.length === 1 && X.S.stack[0].type === 'trips', 'and from Trips it simply goes back');
    t.check(X.restockKind({ hold: {} }) === 'held' && X.restockKind({ key: 'zz', rate: 0.05, need: 3, best: {} }) === 'nocount', 'What to buy sorts each line: held, no count yet, and so on');
  }

  // 9. The supplier redesign: who sells it, prices to confirm, the pack picker.
  {
    const db = fakeDb({ __rpcOk: true }), X = page(db);
    const g = X.priceItems('ridge');
    t.check(g.length === 1 && g[0].rows.length === 2, 'typing an item finds it on the price list, with everyone who sells it');
    X.S.view = 'suppliers'; X.S.ui.supQuery = 'ridge caps';
    t.check(/WHAT IT COSTS US · CHEAPEST FIRST/.test(X.viewSuppliers()) && /THE PICK/.test(X.viewSuppliers()), 'the supplier tab shows who sells it cheapest, and the pick');
    X.S.ui.supQuery = '';
    const stale = X.staleBySupplier();
    t.check(stale.length >= 1 && stale.some(x => x.rows.some(r => r.r.id === 2)), 'a price never dated is one to confirm');
    t.check(X.supplierJobs().some(j => j.kind === 'confirm'), 'and a supplier with prices to confirm is a job on Needs you');
    X.S.stack = [{ type: 'confirm', args: { sid: null, edit: null, v: null } }];
    const html = X.PAGE.confirm(X.topArgs());
    t.check(/Is it still the price\?/.test(html) && /data-act="pconfirm"/.test(html), 'Prices to confirm offers "still the price" in one tap');
    X.ACT.pconfirm({ dataset: { id: '2' } });
    t.check(!db.writes.some(w => w[0] === 'rpc') && /data-act="pundo"/.test(X.PAGE.confirm(X.topArgs())), 'a confirm ticks the row at once, in place, with Undo · nothing is written yet');
    X.ACT.pundo({ dataset: { id: '2' } });
    t.check(!X.cWaitFor(2) && /data-act="pconfirm" data-id="2"/.test(X.PAGE.confirm(X.topArgs())), 'Undo puts the row back to ask');
    X.ACT.pconfirm({ dataset: { id: '2' } });
    await X.commitConfirm(X.cWaitFor(2));
    const rpc = db.writes.find(w => w[0] === 'rpc' && w[1] === 'buyer_confirm_price');
    t.check(rpc && rpc[2].p_price_id === 2 && rpc[2].p_wholesale === null && rpc[2].p_qty === 1, '"still" confirms through buyer_confirm_price with no new figure (price.confirm)');
    t.check(X.shareToday().done === 1, 'and it counts in today\'s share');
    X.topArgs().edit = '1'; X.topArgs().v = 15000;
    X.ACT.pconfirm({ dataset: { id: '1', new: '1' } }); await X.commitConfirm(X.cWaitFor(1));
    const rpc2 = db.writes.filter(w => w[0] === 'rpc' && w[1] === 'buyer_confirm_price')[1];
    t.check(rpc2 && rpc2[2].p_wholesale === 15000 && X.D().prices.find(r => r.id === 1).retail === 15000, 'a new price is saved on the side a single unit is sold at');
    X.D().prices.push({ id: 9, productId: 'P2', variantIdx: null, supplierId: 'S1', wholesale: null, retail: 30000, unit: 'pc', packUnit: '', packQty: 0, outOfStock: true, outOfStockSince: '2026-09-01', tiers: [], date: '2026-09-01' });
    await X.ACT.pback({ dataset: { id: '9' } });
    const h = db.writes.find(w => w[0] === 'insert' && w[1] === 'buyer_handoffs');
    t.check(h && h[2].kind === 'sourcing_fix' && h[2].payload.fixes[0].field === 'status' && h[2].payload.fixes[0].now === 'sells it', 'back in stock goes to Sourcing as a fix: the stock flag is theirs');
  }
  {
    const X = page(fakeDb({})), s = X.D().suppliers[0], tabs = X.fixTabs(s), tb = tabs.find(x => x.priceId === 4), f = tb.fields.find(x => x[0] === 'pack');
    t.check(f[2] === 'pack' && f[3] === 'box|25' && X.packWords(f[3], f[5]) === 'box of 25 kg', 'a pack is picked, not typed: box of 25 kg');
    const all = X.fixAll(tabs, { [tb.k + ':pack']: 'bag|50' });
    t.check(all.length === 1 && all[0].was === 'box of 25 kg' && all[0].now === 'bag of 50 kg' && all[0].packUnit === 'bag' && all[0].packQty === 50, 'the fix carries the words and the pack, for Sourcing');
    t.check(X.packWords('loose|1', 'pc') === 'sold loose, no pack' && X.packWords('bundle|10', 'sheet') === 'bundle of 10 sheets', 'loose, and plurals read right');
  }


  // 8. The browser test of 20 Oct 2026, built from the Buyer canvas.
  // 8a. A pack-only supplier is asked for the whole pack, split order and shelf.
  {
    const row = orderRow(80, [it(1, 'P3', null, 30, 'S1', 5000, { qtyIn: '' })]);
    const db = fakeDb({ saved_quotes: [row] }), X = page(db);
    X.D().savedQuotes = [X.rowToQuote(JSON.parse(JSON.stringify(row)))];
    const r = X.flowNow().toAsk.find(x => x.supplierId === 'S1'), msg = X.askAllMessage('S1', r);
    t.check(/Roofing nails — 50 kg/.test(msg) && /\(30 for our order \+ 20 for our shelf\)/.test(msg), 'the ask says the 50 kg the trip will pay for, and which part is the order\'s: ' + msg.split('\n').find(l => /•/.test(l)));
    t.check(/sold by the 50/.test(X.PAGE.ask({ sid: 'S1' })) && /20<\/b>shelf/.test(X.PAGE.ask({ sid: 'S1' })), 'the Ask screen splits the line: the order\'s part and the shelf\'s');
    // 8b. Nothing is marked asked until the buyer says it went.
    X.ACT.askall({ dataset: { sid: 'S1' } });
    t.check(X.S.sheet && X.S.sheet.type === 'sent' && !db.writes.some(w => w[1] === 'saved_quotes'), 'opening WhatsApp asks "Did you send it?" and marks nothing');
    t.check(/Yes, I sent it/.test(X.SHEET.sent(X.S.sheet.args)) && /I asked another way/.test(X.SHEET.sent(X.S.sheet.args)), 'Yes, Not yet, or I asked another way');
    X.S.sheet.args.other = true;
    t.check(/Called them/.test(X.SHEET.sent(X.S.sheet.args)) && /In person/.test(X.SHEET.sent(X.S.sheet.args)) && /Another phone/.test(X.SHEET.sent(X.S.sheet.args)), 'asked another way: a call, in person, another phone');
    await X.ACT.sentyes({ dataset: { sid: 'S1', how: 'call' } });
    const rec = db.tables.saved_quotes[0].payload.supplierConfirms.S1;
    t.check(rec && rec.askedAt && rec.askedHow === 'call', 'a call counts as asked, and says how');
    t.check(X.S.sheet && X.S.sheet.type === 'said' && /What did Kikuubo say\?/.test(X.SHEET.said(X.S.sheet.args)), 'a call has its answer there and then: "What did they say?" opens');
    t.check(/called /.test(X.PAGE.ask({ sid: 'S1' })) && !/Chase opens|no reply/.test(X.PAGE.ask({ sid: 'S1' })), 'the ask shows "called 12:02", with no wait and no chase');
    await X.ACT.saidsay({ dataset: { v: 'yes' } });
    t.check(X.S.yesWait['80|S1'] && /Confirmed/.test(X.PAGE.ask({ sid: 'S1' })), 'their yes is one tap, and the header says Confirmed at once');
  }
  // 8c. A yes waits six seconds with Undo before it is written.
  {
    const row = orderRow(81, [it(1, 'P2', null, 6, 'S2', 28000)], { supplierConfirms: { S2: { state: 'pending', askedAt: NOW - 9e5 } } });
    const db = fakeDb({ saved_quotes: [row] }), X = page(db);
    X.D().savedQuotes = [X.rowToQuote(JSON.parse(JSON.stringify(row)))];
    let done = false; X.ACT.answer(81, 'S2', 'yes').then(() => { done = true; });
    await Promise.resolve();
    t.check(!done && !db.writes.length && X.S.yesWait['81|S2'], 'a yes is held, not written, while Undo shows');
    X.ACT.undoyes({ dataset: { key: '81|S2' } });
    await new Promise(r => setImmediate(r));
    t.check(done && !db.writes.length && !X.S.answering['81|S2'], 'Undo takes it back: nothing was written');
    X.ACT.answer(81, 'S2', 'yes'); X.flushYes(); await X.ACT.answer(81, 'S2', 'mid').catch(() => {});
    t.check(db.writes.some(w => w[1] === 'saved_quotes'), 'leaving the app writes a held yes at once');
  }
  // 8d. Q-0548: an agent-app order without line ids still has buttons that find their line.
  {
    const X = page(fakeDb({}));
    const q = X.rowToQuote(orderRow(82, [{ ...it(null, 'P2', null, 6, 'S2', 28000), lineId: undefined }, { ...it(null, 'P1', 0, 2, 'S1', 14500), lineId: undefined }]));
    t.check(q.items[0].lineId === 'L82-0' && q.items[1].lineId === 'L82-1' && X.rowToQuote(orderRow(82, [it(7, 'P2', null, 6, 'S2', 28000)])).items[0].lineId === 7, 'a line without an id gets one from its place on the order; a line with one keeps it');
    X.D().savedQuotes = [q];
    t.check(!/That line is no longer/.test(X.PAGE.why({ id: 82, lineId: 'L82-0' })) && /nothing to pick/.test(X.PAGE.order({ id: 82 })), 'its Why and Switch open; one supplier is a label, not a step');
    t.check(!/out of 100|THE OWNER SETS WEIGHTS/.test(X.PAGE.why({ id: 82, lineId: 'L82-0' })), 'one supplier has no score to show');
    X.D().suppliers[1].phone2 = '';
    const h = X.PAGE.order({ id: 82 });
    t.check(/data-act="toldopen"/.test(h) && /They told me/.test(h) && /Add phone/.test(h) && /Ask Ndeeba and Kikuubo/.test(h), 'a supplier with no phone: they told me, or add the phone; the button names every supplier to ask');
    X.ACT.toldopen({ dataset: { key: '82|S2' } });
    const told = X.PAGE.order({ id: 82 });
    t.check(/WHAT DID THEY SAY\?/.test(told) && /data-act="toldsay" data-v="yes"/.test(told) && /In person/.test(told), 'how they told you and what they said, in one card');
  }
  // 8e. The round: two stops, one start, one cash ask that only Accounts hands over.
  {
    const buying = orderRow(83, [it(1, 'P1', 0, 12, 'S1', 14500), it(3, 'P2', null, 6, 'S2', 28000)], {}, { status: 'awaiting_goods' });
    const data = fixture(); data.handoffs = [];
    const db = fakeDb({ saved_quotes: [buying], collection_trips: [], buyer_handoffs: [] }), X = page(db, data);
    X.D().savedQuotes = [X.rowToQuote(JSON.parse(JSON.stringify(buying)))];
    X.S.stack = [{ type: 'plan', args: { who: 'me' } }];
    const h0 = X.PAGE.plan(X.topArgs());
    t.check(X.topArgs().sel.length === 2 && /data-act="cashask"[^>]*>[\s\S]{0,80}Ask [^<]* for [\d,]+/.test(h0) && !/data-slide="trip"/.test(h0) && /role="checkbox" aria-checked="true"/.test(h0), 'every stop is ticked, and the slide waits for the cash');
    t.check(!/Back · to check in/.test(h0) && !/Got it/.test(h0), 'the strip shows only trips out, and the buyer never marks their own cash');
    const given = Number((h0.match(/data-act="cashask" data-v="(\d+)"/) || [])[1]);
    await X.ACT.cashask({ dataset: { v: String(given) } });
    const ask = db.tables.buyer_handoffs[0];
    t.check(ask && ask.kind === 'trip_cash' && ask.payload.supplierIds.join() === 'S1,S2' && ask.payload.amount === given && /^round:/.test(ask.ref), 'one ask for the whole round goes to Accounts');
    t.check(/Waiting for/.test(X.PAGE.plan(X.topArgs())), 'then it waits for Accounts: no "Got it" for the buyer');
    X.D().handoffs[0].status = 'done';
    t.check(/handed over/.test(X.PAGE.plan(X.topArgs())) && /Start the trip · 2 stops/.test(X.PAGE.plan(X.topArgs())), 'Accounts marks it handed over in their app, and one slide starts the round');
    await X.ACT['slide:trip']();
    const trips = db.tables.collection_trips;
    t.check(trips.length === 2 && /-1$/.test(trips[0].id) && /-2$/.test(trips[1].id) && trips.reduce((s, r) => s + r.cash_given, 0) === given, 'two trips, in stop order, the cash split between them to the shilling');
    t.check(X.tripRound(X.D().collectionTrips[0]).length === 2 && X.S.stack[0].type === 'trip', 'they are one round, and stop 1 opens');
    t.check(!X.roundCashAsk(['S1', 'S2']), 'a handover already spent on a trip never shows as cash in hand again');
  }
  // 8f. What to buy counts the yard and the trips.
  {
    const data = fixture(); data.stock = { P3: 0 }; data.restockBuys = [];
    const X = page(fakeDb({}), data);
    X.D().savedQuotes = [X.rowToQuote(orderRow(84, [it(1, 'P3', null, 60, '__stock__', 4600)], { createdAt: new Date(NOW - 5 * 864e5).toISOString() }, { status: 'completed' })),
      X.rowToQuote(orderRow(85, [it(1, 'P3', null, 30, 'S1', 5000, { qtyIn: '' })], {}, { status: 'awaiting_goods' }))];
    X.D().collectionTrips = [X.rowToTrip({ id: 'TRIP-Z', supplier_id: 'S1', status: 'collected', assigned_worker_id: 'W1', created_at: new Date(NOW - 7200e3).toISOString(), collected_at: new Date(NOW - 600e3).toISOString(), lines: [{ orderId: 85, lineId: 1, productId: 'P3', variantIdx: null, productName: 'Roofing nails', unit: 'kg', qty: 50, expectedPrice: 5000, gotQty: 50, gotPrice: 5000 }], cash_given: 300000 })];
    const inc = X.shelfIncoming('P3', null), row = X.restockRows().find(r => r.pid === 'P3');
    t.check(inc.yard === 20, 'the 20 kg a box brought beyond the order wait at the yard for the shelf');
    t.check(row && row.coming === 20 && /\+ 20 at the yard/.test(X.PAGE.restock({ picked: null })), 'and What to buy counts them before it asks for more');
  }

  // 9. The second browser test of 20 Oct 2026.
  // 9a. Hand-in with no receipt: said out loud, and Accounts is told.
  {
    const buying = orderRow(90, [it(1, 'P2', null, 6, 'S2', 28000)], {}, { status: 'awaiting_goods' });
    const data = fixture(); data.handoffs = [{ id: 'h9', kind: 'trip_cash', ref: 'round:x', status: 'done', createdAt: new Date(NOW - 6e4).toISOString(), payload: { supplierIds: ['S2'], amount: 200000 } }];
    const db = fakeDb({ saved_quotes: [buying], collection_trips: [], buyer_handoffs: [] }), X = page(db, data);
    X.D().savedQuotes = [X.rowToQuote(JSON.parse(JSON.stringify(buying)))];
    X.S.stack = [{ type: 'plan', args: { who: 'me' } }];
    await X.ACT['slide:trip']();
    const id = db.tables.collection_trips[0].id;
    t.check(db.tables.collection_trips[0].cash_given === 200000, 'the trip carries the cash Accounts handed over, not a guess');
    X.S.stack = [{ type: 'trip', args: { id } }];
    X.ACT.tall({ dataset: { i: '0' } });
    t.check(/planned 168,000/.test(X.PAGE.trip({ id })) && /left <b class="m"[^>]*>200,000/.test(X.PAGE.trip({ id })), 'the plan shows in full, and the cash left only drops by what you type');
    X.ACT['in:tpaid']({ value: '168000' });
    t.check(/Photograph the receipt/.test(X.PAGE.trip({ id })) && /data-receipt type="file"/.test(X.PAGE.trip({ id }).split('Photograph the receipt')[0].slice(-600)), 'the big button is the camera when the photo is all that is missing');
    X.ACT.tnorec();
    await X.ACT['slide:handin']();
    const nr = db.writes.find(w => w[0] === 'insert' && w[1] === 'buyer_handoffs' && w[2].kind === 'paper_bill'), pay0 = db.tables.collection_trips[0].pay;
    t.check(db.tables.collection_trips[0].status === 'collected' && !nr && pay0 && pay0.receipt === 'none' && pay0.amount === 168000, '"No receipt given" hands in: the trip says 168,000 with no receipt, and no paper bill is asked for (0151)');
  }
  // 9b. A trip made before the order's lines had ids still covers them: no second stop.
  {
    const X = page(fakeDb({}));
    const q = X.rowToQuote(orderRow(91, [{ ...it(null, 'P2', null, 6, 'S2', 28000), lineId: undefined }], {}, { status: 'awaiting_goods' }));
    X.D().savedQuotes = [q];
    X.D().collectionTrips = [X.rowToTrip({ id: 'TRIP-OLD', supplier_id: 'S2', status: 'collecting', assigned_worker_id: '__supplier__', created_at: new Date(NOW - 3 * 864e5).toISOString(), lines: [{ orderId: 91, productId: 'P2', variantIdx: null, productName: 'Gutter, 4m PVC', unit: 'pc', qty: 6, expectedPrice: 28000, gotQty: 6 }] })];
    t.check(X.lineIsOnATrip(91, 'L91-0') && !X.runsToGo().some(r => r.supplierId === 'S2'), 'a "they bring it" trip from before still covers the line: it is never bought twice');
  }
  // 9c. One story for a held order; the same price is a yes.
  {
    const row = orderRow(92, [it(1, 'P2', null, 6, 'S2', 30000, { priceWas: 28000, sellPrice: 29000 })], { creditCheck: { decision: 'hold' }, supplierConfirms: { S2: { state: 'confirmed', at: NOW, terms: 'P2::6:30000' } } });
    const db = fakeDb({ saved_quotes: [row] }), X = page(db);
    X.D().savedQuotes = [X.rowToQuote(JSON.parse(JSON.stringify(row)))];
    const q = X.D().savedQuotes[0], h = X.holdOf(q);
    t.check(h && h.kind === 'credit' && /price up 12,000/.test(X.orderHoldReason(q)), 'the hold says who, why, and that the price went up: ' + X.orderHoldReason(q));
    t.check(/Waiting on others · 1/.test(X.viewToday()) && /Waiting on/.test(X.PAGE.order({ id: 92 })), 'Today and the order tell the same story');
    t.check(!/sold at|29,000/.test(X.viewToday()), 'the Buyer is never shown what it sells at');
    const row2 = orderRow(93, [it(1, 'P2', null, 6, 'S2', 28000)], { supplierConfirms: { S2: { state: 'pending', askedAt: NOW - 9e5, askedHow: 'person' } } });
    const db2 = fakeDb({ saved_quotes: [row2] }), Y = page(db2);
    Y.D().savedQuotes = [Y.rowToQuote(JSON.parse(JSON.stringify(row2)))];
    Y.S.stack = [{ type: 'order', args: { id: 93 } }, { type: 'price', args: { id: 93, lineId: 1, v: '28000', unit: 'base' } }];
    t.check(/Same price · that’s a yes/.test(Y.PAGE.price(Y.topArgs())) && /In person · /.test(Y.PAGE.price(Y.topArgs())) && !/role="switch"/.test(Y.PAGE.price(Y.topArgs())), 'New price shows how they told you, with no switch; the same figure is a yes');
    await Y.ACT.pgo();
    t.check(Y.S.yesWait['93|S2'] && !db2.writes.some(w => w[1] === 'saved_quotes'), 'and it answers yes, with Undo, without re-pricing');
  }
  // 9d. A refill already on the list, when the stock came in: take it off.
  {
    const data = fixture(); data.restockBuys = [{ id: 'rb1', productId: 'P3', variantIdx: null, qty: 25, unit: 'kg', supplierId: 'S1', price: 5000, status: 'planned' }];
    const db = fakeDb({ restock_buys: [{ id: 'rb1', shop_id: SH, status: 'planned' }] }), X = page(db, data);
    X.D().savedQuotes = [X.rowToQuote(orderRow(94, [it(1, 'P3', null, 30, 'S1', 5000, { qtyIn: '' })], {}, { status: 'awaiting_goods' }))];
    X.D().collectionTrips = [X.rowToTrip({ id: 'TRIP-Y2', supplier_id: 'S1', status: 'collected', assigned_worker_id: 'W1', created_at: new Date(NOW - 864e5).toISOString(), collected_at: new Date(NOW - 6e5).toISOString(), lines: [{ orderId: 94, lineId: 1, productId: 'P3', variantIdx: null, productName: 'Roofing nails', unit: 'kg', qty: 50, expectedPrice: 5000, gotQty: 50, gotPrice: 5000 }] })];
    t.check(/data-act="rsoff" data-id="rb1"/.test(X.PAGE.restock({ picked: [] })), 'a refill on the list whose stock just came in offers Take off');
    await X.ACT.rsoff({ dataset: { id: 'rb1' } });
    t.check(db.tables.restock_buys[0].status === 'cancelled', 'and Take off cancels it');
  }

  /* ---------------- 10. the round: one hand-in, at the yard ---------------- */
  // 10a. Two stops: a short line pays for what came, each stop is done in turn, the round goes in once.
  {
    const a1 = orderRow(95, [it(1, 'P2', null, 6, 'S2', 28000)], {}, { status: 'awaiting_goods' }), a2 = orderRow(96, [it(1, 'P1', 0, 10, 'S1', 14500)], {}, { status: 'awaiting_goods' });
    const data = fixture(); data.handoffs = [{ id: 'h10', kind: 'trip_cash', ref: 'round:r10', status: 'done', createdAt: new Date(NOW - 6e4).toISOString(), doneAt: new Date(NOW - 3e4).toISOString(), payload: { supplierIds: ['S1', 'S2'], amount: 400000 } }];
    const db = fakeDb({ saved_quotes: [a1, a2], collection_trips: [], buyer_handoffs: [], __rpcOk: true }), X = page(db, data);
    X.D().savedQuotes = [X.rowToQuote(JSON.parse(JSON.stringify(a1))), X.rowToQuote(JSON.parse(JSON.stringify(a2)))];
    X.S.stack = [{ type: 'plan', args: { who: 'me' } }];
    await X.ACT['slide:trip']();
    t.check(db.tables.collection_trips.length === 2, 'the round starts as two stops');
    const [s1, s2] = X.roundStops(X.D().collectionTrips[0]);
    X.S.stack = [{ type: 'trip', args: { id: s1.id } }];
    const per = s1.supplierId === 'S1' ? 14500 : 28000, qty = s1.supplierId === 'S1' ? 10 : 6;
    X.ACT.tshort({ dataset: { i: '0' } });
    let html = X.PAGE.trip({ id: s1.id });
    t.check(/STOP 1 OF 2/.test(html) && /aria-label="The round: 2 stops, handed in once at the yard"/.test(html), 'the stop says where it is in the round, with the route to the yard');
    t.check(new RegExp((qty - 1) + ' of ' + qty).test(html) && /as planned · what came/.test(html), 'a short line reads "' + (qty - 1) + ' of ' + qty + '", and "as planned" pays for what came');
    X.ACT.tpaidplan();
    t.check(X.S.tripPay[s1.id].amount === (qty - 1) * per, '"as planned" on a short line fills in what came: ' + X.S.tripPay[s1.id].amount);
    t.check(/in hand <b class="m"[^>]*>400,000<\/b>/.test(X.PAGE.trip({ id: s1.id })) && /SAVED/.test(X.PAGE.trip({ id: s1.id })), 'the cash in hand is Accounts\' handover, and what was typed is saved');
    X.S.tripPay = {}; X.restoreTripPay();
    t.check(X.S.tripPay[s1.id] && X.S.tripPay[s1.id].amount === (qty - 1) * per, 'what you typed survives stepping away');
    X.ACT.tnorec();
    t.check(/data-act="stopdone"/.test(X.PAGE.trip({ id: s1.id })) && !/data-slide="handin"/.test(X.PAGE.trip({ id: s1.id })), 'with another stop to go, the button is "Done here", not a hand-in');
    await X.ACT.stopdone();
    t.check(X.S.tripPay[s1.id].done, 'Done here marks the stop done');
    t.check(db.tables.collection_trips.every(r => r.status === 'collecting') && !db.writes.some(w => w[1] === 'buyer_handoffs' && w[2].kind === 'paper_bill'), 'and nothing is handed in, nobody told: the goods ride on');
    html = X.PAGE.trip({ id: s1.id });
    t.check(/IN HAND FOR/.test(html) && new RegExp('data-act="nextstop" data-id="' + s2.id + '"').test(html) && /data-act="endnow"/.test(html), 'the stop shows the cash for the next stop, the way to it, and Hand in now');
    X.S.stack = [{ type: 'trip', args: { id: s2.id } }];
    X.ACT.tall({ dataset: { i: '0' } }); X.ACT.tpaidplan(); X.ACT.tnorec();
    t.check(/Tap or slide · hand in the trip/.test(X.PAGE.trip({ id: s2.id })), 'the last stop hands in the round');
    await X.ACT['slide:handin']();
    t.check(db.tables.collection_trips.every(r => r.status === 'collected') && new Set(db.tables.collection_trips.map(r => r.collected_at)).size === 1, 'both stops go in at once, at one time');
    const shortRow = db.tables.collection_trips.find(r => r.id === s1.id);
    t.check(shortRow.lines[0].gotPrice == null && shortRow.lines[0].gotQty === qty - 1, 'a short line never updates the price list: its price paid is left to the plan');
    t.check(db.tables.collection_trips.every(r => r.pay && r.pay.amount > 0 && r.pay.receipt === 'none' && r.pay.own === false), 'Accounts gets each stop\'s amount at the hand-in, on the trip');
    X.S.stack = [{ type: 'done', args: { id: s1.id } }];
    html = X.PAGE.done({ id: s1.id });
    t.check(/BACK FROM 2 STOPS · ONE HAND-IN/.test(html) && /TRIP · 2 STOPS/.test(html) && /told once/.test(html), 'the hand-in page is the round\'s');
    t.check(new RegExp('\\+1 short · ' + (qty - 1) + ' of ' + qty).test(html) && /letter-spacing:-\.04em">1<\/span><span class="m" style="font-size:18px;color:var\(--navyInk2\)">of 2 in full/.test(html), 'and it says what came, never "0 of 1 in full": ' + (html.match(/\+1 short[^<]*/) || [''])[0]);
  }
  // 10e. Hand in now: the stop not reached goes back to To plan, and its cash stays counted on the round.
  {
    const a1 = orderRow(97, [it(1, 'P2', null, 6, 'S2', 28000)], {}, { status: 'awaiting_goods' }), a2 = orderRow(98, [it(1, 'P1', 0, 10, 'S1', 14500)], {}, { status: 'awaiting_goods' });
    const data = fixture(); data.handoffs = [{ id: 'h11', kind: 'trip_cash', ref: 'round:r11', status: 'done', createdAt: new Date(NOW - 6e4).toISOString(), payload: { supplierIds: ['S1', 'S2'], amount: 400000 } }];
    const db = fakeDb({ saved_quotes: [a1, a2], collection_trips: [], buyer_handoffs: [], __rpcOk: true }), X = page(db, data);
    X.D().savedQuotes = [X.rowToQuote(JSON.parse(JSON.stringify(a1))), X.rowToQuote(JSON.parse(JSON.stringify(a2)))];
    X.S.stack = [{ type: 'plan', args: { who: 'me' } }];
    await X.ACT['slide:trip']();
    const given = db.tables.collection_trips.reduce((a, r) => a + (Number(r.cash_given) || 0), 0);
    const [s1, s2] = X.roundStops(X.D().collectionTrips[0]);
    X.S.stack = [{ type: 'trip', args: { id: s1.id } }];
    X.ACT.tall({ dataset: { i: '0' } }); X.ACT.tpaidplan(); X.ACT.tnorec();
    await X.ACT.stopdone();
    t.check(X.topArgs().id === s2.id && /done · <span class="m">/.test(X.PAGE.trip({ id: s2.id })), 'Done here opens the next stop at once, the last one on a strip at its top');
    X.ACT.endnow();
    t.check(/Tap or slide · hand in the trip/.test(X.PAGE.trip({ id: s2.id })) && /back to To plan/.test(X.PAGE.trip({ id: s2.id })), 'Hand in now from the next stop: it goes back to To plan');
    await X.ACT['slide:handin']();
    const r1 = db.tables.collection_trips.find(r => r.id === s1.id), r2 = db.tables.collection_trips.find(r => r.id === s2.id);
    t.check(r1.status === 'collected' && r2.voided === true && r2.status === 'collecting', 'the stop reached is handed in, the one not reached is off the round');
    t.check(Number(r1.cash_given) === given && given === 400000, 'and the whole handover is still counted on the round for Accounts: ' + r1.cash_given);
    t.check(X.runsToGo().some(r => String(r.supplierId) === String(s2.supplierId)), 'the stop not reached is back on To plan');
  }
  // 10b. No handover from Accounts: no cash is shown as given.
  {
    const X = page(fakeDb({}));
    X.D().collectionTrips = [X.rowToTrip({ id: 'TRIP-NC-1', supplier_id: 'S1', status: 'collecting', assigned_worker_id: 'W1', created_at: new Date(NOW - 6e5).toISOString(), cash_given: 850000, lines: [{ orderId: 1, lineId: 1, productId: 'P1', qty: 2, expectedPrice: 1000 }] })];
    X.S.stack = [{ type: 'trip', args: { id: 'TRIP-NC-1' } }];
    const html = X.PAGE.trip({ id: 'TRIP-NC-1' });
    t.check(!/gave you|in hand <b/.test(html) && /No cash from /.test(html) && /data-act="tcashask"/.test(html) && /data-act="tcashown"/.test(html), 'a cash figure on the trip is never "gave you": with no handover it says so, with Ask and "I paid myself"');
    X.D().collectionTrips[0].lines[0].gotQty = 2; X.setTripPay('TRIP-NC-1', { amount: 2000, noReceipt: true });
    t.check(/Finish this stop once /.test(X.PAGE.trip({ id: 'TRIP-NC-1' })) && !/data-slide="handin"/.test(X.PAGE.trip({ id: 'TRIP-NC-1' })), 'with no cash from Accounts, the stop is locked: no Done here, no hand-in');
    X.ACT.tcashown();
    const h2 = X.PAGE.trip({ id: 'TRIP-NC-1' });
    t.check(/You paid from your own pocket/.test(h2) && /data-slide="handin"/.test(h2) && /own money/.test(h2), '"I paid myself" unlocks it, and says Accounts pays you back');
  }
  // 10c. A stop a supplier already delivers is off the round, and a trip out since an earlier day with nothing loaded is late.
  {
    const X = page(fakeDb({}));
    const old = new Date(NOW - 3 * 864e5).toISOString(), now = new Date(NOW - 6e5).toISOString();
    X.D().collectionTrips = [
      X.rowToTrip({ id: 'TRIP-DL', supplier_id: 'S2', status: 'collecting', assigned_worker_id: '__supplier__', created_at: old, lines: [{ orderId: 7, lineId: 'L7-0', productId: 'P2', qty: 1, expectedPrice: 95000 }] }),
      X.rowToTrip({ id: 'TRIP-RD-1', supplier_id: 'S2', status: 'collecting', assigned_worker_id: 'W1', created_at: now, lines: [{ orderId: 7, lineId: 'L7-0', productId: 'P2', qty: 1, expectedPrice: 95000 }] }),
      X.rowToTrip({ id: 'TRIP-RD-2', supplier_id: 'S1', status: 'collecting', assigned_worker_id: 'W1', created_at: now, lines: [{ orderId: 8, lineId: 'L8-0', productId: 'P1', qty: 1, expectedPrice: 1000 }] }),
    ];
    t.check(X.stopBoughtElsewhere(X.D().collectionTrips[1]) && X.stopBoughtElsewhere(X.D().collectionTrips[1]).id === 'TRIP-DL', 'a stop whose lines a supplier already delivers is spotted');
    X.S.stack = [{ type: 'trip', args: { id: 'TRIP-RD-1' } }];
    t.check(/delivers these/.test(X.PAGE.trip({ id: 'TRIP-RD-1' })) && /data-act="stopdrop"/.test(X.PAGE.trip({ id: 'TRIP-RD-1' })), 'and the stop offers Take off the round');
    const html = X.PAGE.trips();
    t.check(/3 D LATE/.test(html) && /THEY BRING IT · 1/.test(html) && /TRIP · /.test(html) && (html.match(/data-act="trip" data-id="TRIP-RD-/g) || []).length === 1, 'Trips shows the round as one card, and the delivery from three days ago as late');
    t.check(!/\(YOU\)/.test(html) && /today’s trips only/.test(html), 'no "(YOU)", and the cash counts today\'s trips only');
  }
  // 10f. At the yard: one card, a bar by day, the names behind a tap.
  {
    const X = page(fakeDb({}));
    const back = (id, sid, h) => X.rowToTrip({ id, supplier_id: sid, status: 'collected', assigned_worker_id: 'W1', created_at: new Date(NOW - (h + 2) * 36e5).toISOString(), collected_at: new Date(NOW - h * 36e5).toISOString(), lines: [{ orderId: 1, lineId: 1, productId: 'P1', qty: 1, gotQty: 1 }] });
    // Y3 and Y4 on one day, noon and half past, three days back, whatever the hour now.
    const noon3 = new Date(NOW); noon3.setDate(noon3.getDate() - 3); noon3.setHours(12, 0, 0, 0); const h3 = (NOW - noon3.getTime()) / 36e5;
    X.D().collectionTrips = [back('Y1', 'S1', 1), back('Y2', 'S2', 1.2), back('Y3', 'S1', h3), back('Y4', 'S1', h3 - .5)];
    let html = X.PAGE.trips();
    t.check(/waiting<br>to count/.test(html) && /data-act="yardopen"/.test(html) && !/data-id="Y3"/.test(html), 'At the yard is one card, the trips folded behind a tap');
    t.check(/oldest /.test(html) && /#E09A4E/.test(html), 'the oldest day is named, in amber when it has sat for days');
    X.ACT.yardopen();
    html = X.PAGE.trips();
    t.check(/data-id="Y1"/.test(html) && /×2/.test(html) && (html.match(/data-id="Y[34]"/g) || []).length === 1, 'open, the trips show by day as chips, two from one supplier on one day as one "×2"');
  }
  // 10g. The round keeps its order when a stop comes off; the yard refills the shelf first; late stops are flagged.
  {
    const X = page(fakeDb({ collection_trips: [] }));
    const at = NOW - 6e5, mk = (id, sid, i, extra) => X.rowToTrip({ id, supplier_id: sid, status: 'collecting', assigned_worker_id: 'W1', created_at: new Date(at + i).toISOString(), lines: [{ orderId: 50 + i, lineId: 'L' + i, productId: 'P1', qty: 2, expectedPrice: 1000 * (5 - i) }], ...(extra || {}) });
    X.D().collectionTrips = [mk('R-1', 'S1', 0), mk('R-2', 'S2', 1), mk('R-3', 'S3', 2)];
    const before = X.roundStops(X.D().collectionTrips[0]).map(x => x.id);
    X.D().collectionTrips[1].voided = true;
    const after = X.roundStops(X.D().collectionTrips[0]).map(x => x.id);
    t.check(JSON.stringify(before.filter(id => id !== 'R-2')) === JSON.stringify(after), 'a stop taken off is skipped, the rest keep their order: ' + before.join(',') + ' → ' + after.join(','));
    X.S.tripPay = {}; X.setTripPay('R-1', { done: new Date().toISOString(), amount: 1 });
    t.check(JSON.stringify(X.roundStops(X.D().collectionTrips[0]).map(x => x.id)) === JSON.stringify(after), 'and a stop done does not move it either');
    // a stop of a round from three days ago, nothing loaded, is late on its own
    const old = NOW - 3 * 864e5, mo = (id, sid, i, got) => X.rowToTrip({ id, supplier_id: sid, status: 'collecting', assigned_worker_id: 'W2', created_at: new Date(old + i).toISOString(), lines: [{ orderId: 70 + i, lineId: 'L7' + i, productId: 'P1', qty: 2, expectedPrice: 1000, gotQty: got }] });
    X.D().collectionTrips.push(mo('O-1', 'S1', 0, 2), mo('O-2', 'S2', 1, null));
    const html = X.PAGE.trips();
    t.check(/LATE · 1/.test(html) && /3 D LATE/.test(html) && /’s trip · /.test(html), 'a stop on an old round with nothing loaded is flagged late on its own');
    t.check(/1 of 2 stops/.test(X.viewToday().replace(/<[^>]*>/g, ' ')), 'the Today tile shows your own trip stop by stop, a round as one');
  }
  // 10h. A shelf refill buys only what the yard does not already hold.
  {
    const data = fixture(); data.restockBuys = [{ id: 'rb9', productId: 'P2', variantIdx: null, qty: 10, unit: 'pc', supplierId: 'S2', price: 28000, status: 'planned', createdAt: new Date(NOW - 36e5).toISOString() }];
    data.prices = data.prices.map(r => r.id === 3 ? { ...r, date: new Date(NOW).toISOString().slice(0, 10) } : r);
    const X = page(fakeDb({}), data);
    X.D().savedQuotes = [X.rowToQuote(orderRow(61, [it(1, 'P2', null, 1, 'S2', 28000)], {}, { status: 'awaiting_goods' }))];
    X.D().collectionTrips = [X.rowToTrip({ id: 'YD', supplier_id: 'S2', status: 'collected', assigned_worker_id: 'W1', created_at: new Date(NOW - 864e5).toISOString(), collected_at: new Date(NOW - 8e7).toISOString(), lines: [{ orderId: 61, lineId: 1, productId: 'P2', variantIdx: null, qty: 7, expectedPrice: 28000, gotQty: 7 }] })];
    // Back before the refill was planned: its 10 already allowed for the yard.
    let r = X.runsToGo().find(x => String(x.supplierId) === 'S2'), l = r && r.lines.find(x => x.restock);
    t.check(l && l.qty === 10 && !l.fromYard, 'stock at the yard before the refill was planned is not taken off it twice: ' + (l && l.qty));
    X.D().collectionTrips[0].collectedAt = new Date(NOW - 6e5).toISOString();
    r = X.runsToGo().find(x => String(x.supplierId) === 'S2'); l = r && r.lines.find(x => x.restock);
    t.check(l && l.qty === 4 && l.fromYard === 6, 'the yard holds 6 spare that came after, so the refill of 10 buys 4: ' + (l && l.qty));
    X.S.stack = [{ type: 'plan', args: {} }];
    t.check(/are already at the yard \(not counted yet\) · buy only 4/.test(X.PAGE.plan({})), 'and the plan says so');
  }
  // 10i. A typo is not good news; None came is one tap; a tap during a save is kept; the Buyer never sees what it sells at.
  {
    const X = page(fakeDb({ collection_trips: [] }));
    X.D().handoffs = [{ id: 'hx', kind: 'trip_cash', ref: 'round:x', status: 'done', createdAt: new Date(NOW - 9e5).toISOString(), payload: { supplierIds: ['S1'], amount: 500000 } }];
    const row = { id: 'TRIP-TY', shop_id: SH, supplier_id: 'S1', status: 'collecting', assigned_worker_id: 'W1', created_at: new Date(NOW - 6e5).toISOString(), lines: [{ orderId: 1, lineId: 1, productId: 'P1', qty: 10, expectedPrice: 10000 }] };
    X.D().collectionTrips = [X.rowToTrip(row)];
    X.S.stack = [{ type: 'trip', args: { id: 'TRIP-TY' } }];
    X.ACT.tall({ dataset: { i: '0' } }); X.ACT['in:tpaid']({ value: '10000' });
    const h = X.PAGE.trip({ id: 'TRIP-TY' });
    t.check(/Meant 100,000\?/.test(h) && !/under plan/.test(h), 'paying 10,000 for a 100,000 stop asks "meant 100,000?", never a green "under plan"');
    X.ACT.tshort({ dataset: { i: '0' } });
    t.check(/data-act="tnone"/.test(X.PAGE.trip({ id: 'TRIP-TY' })) && /data-in="tgot"/.test(X.PAGE.trip({ id: 'TRIP-TY' })), 'a short line offers None came and a count you can type');
    X.ACT.tnone({ dataset: { i: '0' } });
    t.check(X.S.tripDraft['TRIP-TY'] && X.S.tripDraft['TRIP-TY'][0].q === 0, 'None came sets the line to 0 in one tap');
  }
  // 10j. Sixth review: the freshest price first, Ask first on one line with Undo, I paid myself, one message, held last.
  {
    const data = fixture(), today = new Date(NOW).toISOString().slice(0, 10);
    data.prices = data.prices.map(r => r.id === 2 || r.id === 3 ? { ...r, date: today } : r);
    data.presetReorderRules = { 'P1::0': { minUnits: 10 } }; data.restockBuys = [];
    const X = page(fakeDb({ __rpcOk: true }), data);
    const row = X.restockRows().find(r => r.key === 'P1::0');
    t.check(row && String(row.best.supplierId) === 'S3', 'What to buy picks the supplier with a fresh price over a cheaper one 290 days old: ' + (row && row.best.supplierId));
    t.check(row && row.alt && String(row.alt.supplierId) === 'S1' && row.alt.save > 0, 'and shows the cheaper old price beside it, with what asking could save');
    X.S.stack = [{ type: 'restock', args: { picked: [] } }];
    t.check(/ask to save /.test(X.PAGE.restock(X.topArgs())), 'the card says "ask to save"');
    // Ask first: only the line being bought, big, and what happens once it is confirmed.
    X.S.stack = [{ type: 'confirm', args: { sid: 'S1', edit: null, v: null, cashBefore: 100000, focus: [{ id: 1, qty: 10, unit: 'pc' }] } }];
    let h = X.PAGE.confirm(X.topArgs());
    t.check(/ASK FIRST · BEFORE YOU BUY IT/.test(h) && /Is it still 14,000\?/.test(h) && (h.match(/data-act="pconfirm"/g) || []).length === 1, 'Ask first shows only the line being bought, at the carton price it is bought at');
    t.check(/THEN/.test(h) && /Joins the S1 stop|Joins the .* stop/.test(h) && /100,000 <span[^>]*>→ 240,000/.test(h), 'with the steps after it and the cash to carry, before → after');
    t.check(/price checks today · /.test(h) && /does the rest/.test(h), 'the share says what it is: your price checks today, Sourcing does the rest');
    X.ACT.pconfirm({ dataset: { id: '1' } });
    h = X.PAGE.confirm(X.topArgs());
    t.check(/Confirmed · it joins the trip/.test(h) && /data-act="pundo"/.test(h), 'confirmed: it joins the round, with Undo');
    X.ACT.pundo({ dataset: { id: '1' } });
    t.check(/Is it still 14,000\?/.test(X.PAGE.confirm(X.topArgs())), 'Undo asks again');
  }
  {
    const data = fixture(); data.prices = data.prices.map(r => r.id === 3 ? { ...r, date: new Date(NOW).toISOString().slice(0, 10) } : r); data.restockBuys = [];
    const X = page(fakeDb({ collection_trips: [] }), data);
    X.D().savedQuotes = [X.rowToQuote(orderRow(61, [it(1, 'P2', null, 2, 'S2', 28000)], {}, { status: 'awaiting_goods' }))];
    X.S.stack = [{ type: 'plan', args: { who: 'me' } }];
    let h = X.PAGE.plan(X.topArgs());
    t.check(/Pay with my own money instead/.test(h) && !/data-slide="trip"/.test(h), 'waiting for the cash, the plan offers "I paid myself"');
    X.ACT.planown();
    h = X.PAGE.plan(X.topArgs());
    t.check(/Your own money · /.test(h) && /data-act="planown"[^>]*>Undo/.test(h) && /Start the trip/.test(h), 'on your own money the slide opens, with Undo');
  }
  {
    const X = page(fakeDb({}));
    X.D().savedQuotes = [X.rowToQuote(orderRow(62, [it(1, 'P2', null, 2, 'S2', 28000)]))];
    const r = X.flowNow().toAsk.concat(X.flowNow().asked).find(x => String(x.supplierId) === 'S2');
    const msg = r ? X.askAllMessage('S2', r) : '';
    t.check(/please confirm you have these at these prices:/.test(msg) && /\*Total: 56,000 UGX\*/.test(msg), 'the ask says the words its preview shows, and the total: ' + JSON.stringify(msg.slice(0, 60)));
  }

  // 10k. Seventh review: a typo is settled before Done here; whole cartons; sensible cash; own money; an open trip is never a second visit.
  {
    const X = page(fakeDb({ collection_trips: [] }));
    X.D().handoffs = [{ id: 'hk', kind: 'trip_cash', ref: 'round:k', status: 'done', createdAt: new Date(NOW - 9e5).toISOString(), payload: { supplierIds: ['S1'], amount: 200000 } }];
    X.D().collectionTrips = [X.rowToTrip({ id: 'TRIP-K', shop_id: SH, supplier_id: 'S1', status: 'collecting', assigned_worker_id: 'W1', created_at: new Date(NOW - 6e5).toISOString(), lines: [{ orderId: 1, lineId: 1, productId: 'P1', qty: 10, expectedPrice: 11000, gotQty: 10 }] })];
    X.S.stack = [{ type: 'trip', args: { id: 'TRIP-K' } }];
    X.ACT['in:tpaid']({ value: '11000' }); X.ACT.tnorec();
    let h = X.PAGE.trip({ id: 'TRIP-K' });
    t.check(/NOT SAVED/.test(h) && !/✓ SAVED|>SAVED</.test(h) && /check below/.test(h) && /Check the amount first/.test(h), 'an odd amount is NOT SAVED until it is checked, and the stop waits for it');
    t.check(/Meant 110,000\?/.test(h) && /data-act="toddfix"/.test(h) && /Keep it · photo receipt/.test(h) && !/data-act="toddok"/.test(h), '11,000 for a 110,000 stop asks "Meant 110,000?"; keeping it needs the receipt photo, "no receipt" is not enough');
    t.check(/Check the amount first/.test(h), 'and the slide stays locked until it is settled');
    X.ACT.toddfix();
    t.check(X.S.tripPay['TRIP-K'].amount === 110000 && !X.payOdd(X.tripView(X.tripById('TRIP-K'))), 'one tap uses 110,000');
    t.check(X.cashStep(11000) === 1000 && X.cashStep(480000) === 10000 && X.cashStep(2767000) === 50000, 'cash is asked to the 1,000 under 100k, 10,000 under 1M, 50,000 above');
    t.check(X.tripTakeable(X.tripById('TRIP-K')) === false, 'a trip already loading is never taken over');
  }
  {
    const data = fixture(), today = new Date(NOW).toISOString().slice(0, 10);
    // P3 at S1 only by the box of 25 kg; 2 on the shelf, a floor of 6.
    data.prices = data.prices.map(r => r.id === 4 ? { ...r, date: today, retail: null } : r); data.stock = { P3: 2 }; data.stockLots = { P3: [{ qty: 2, cost: 4600 }] };
    data.presetReorderRules = { P3: { minUnits: 6 } }; data.restockBuys = [];
    const X = page(fakeDb({}), data);
    const r = X.restockRows().find(x => x.key === 'P3');
    t.check(r && r.pack && r.need === 25 && r.pack.cartons === 1, 'a supplier who sells only whole boxes: What to buy rounds 4 kg up to one box of 25: ' + (r && r.need));
    X.S.stack = [{ type: 'restock', args: { picked: [] } }];
    t.check(/1 box · 25/.test(X.PAGE.restock(X.topArgs())), 'and the card shows short → one box');
  }
  {
    const data = fixture(); data.prices = data.prices.map(r => r.id === 3 ? { ...r, date: new Date(NOW).toISOString().slice(0, 10) } : r); data.restockBuys = [];
    const X = page(fakeDb({ collection_trips: [] }), data);
    X.D().savedQuotes = [X.rowToQuote(orderRow(61, [it(1, 'P2', null, 2, 'S2', 28000)], {}, { status: 'awaiting_goods' }))];
    X.D().collectionTrips = [X.rowToTrip({ id: 'TRIP-OLD', shop_id: SH, supplier_id: 'S2', status: 'assigned', assigned_worker_id: 'W2', created_at: new Date(NOW - 4 * 864e5).toISOString(), lines: [{ orderId: 70, lineId: 9, productId: 'P2', qty: 1, expectedPrice: 28000 }] })];
    X.S.stack = [{ type: 'plan', args: { who: 'me' } }];
    let h = X.PAGE.plan(X.topArgs());
    t.check(/already has a trip to/.test(h) && /data-act="planopentake"/.test(h) && /data-act="planopenleave"/.test(h), 'a supplier with a trip already out shows it, with Take its lines and Leave it');
    t.check(/>You</.test(h), 'Who collects says You');
    X.ACT.planown(); h = X.PAGE.plan(X.topArgs());
    t.check(/Your own money · /.test(h) && !/data-act="cashask"/.test(h) && !/I paid myself/.test(h), 'on your own money the cash card says so, and there is no Ask for it');
  }

  // 10l. Eighth review: a confirmed row holds its place; Chase reaches the runner; deliveries are late too; the Out tile in K.
  {
    const db = fakeDb({ __rpcOk: true }), X = page(db);
    X.S.stack = [{ type: 'confirm', args: { sid: null, edit: null, v: null } }];
    const order = h => (h.match(/data-act="(?:pconfirm|pundo)" data-id="(\d+)"/g) || []).map(x => x.replace(/\D/g, '')).filter((v, i, a) => a.indexOf(v) === i);
    const before = order(X.PAGE.confirm(X.topArgs()));
    X.ACT.pconfirm({ dataset: { id: before[0] } });
    let h = X.PAGE.confirm(X.topArgs());
    t.check(/saving…/.test(h) && /class="bx-drain"/.test(h) && /data-act="pundo"/.test(h), 'a confirm says saving…, with Undo and a bar running out');
    await X.commitConfirm(X.cWaitFor(before[0]));
    h = X.PAGE.confirm(X.topArgs());
    t.check(h.indexOf('data-act="pconfirm" data-id="' + before[1] + '"') > h.indexOf('✓ saved'), 'once saved the row stays where it was, above the next one');
  }
  {
    const X = page(fakeDb({ collection_trips: [] }));
    const old = new Date(NOW - 5 * 864e5).toISOString();
    X.D().staff = [{ id: 'W1', name: 'Okello Peter', phone: '', role: 'buyer', userId: 'u1' }, { id: 'W2', name: 'Andrew Ssali', phone: '0772000111', role: 'worker', userId: null }, { id: 'W3', name: 'Musa K', phone: '', role: 'store', userId: null }];
    X.D().savedQuotes = [X.rowToQuote(orderRow(71, [it(1, 'P2', null, 1, 'S2', 28000)], {}, { client_name: 'Grace Hardware', status: 'awaiting_goods' }))];
    X.D().collectionTrips = [X.rowToTrip({ id: 'TRIP-SJ', shop_id: SH, supplier_id: 'S2', status: 'assigned', assigned_worker_id: 'W2', created_at: old, lines: [{ orderId: 71, lineId: 1, productId: 'P2', qty: 1, expectedPrice: 28000 }] }),
      X.rowToTrip({ id: 'TRIP-SH', shop_id: SH, supplier_id: 'S1', status: 'collecting', assigned_worker_id: '__supplier__', created_at: old, lines: [{ orderId: 72, lineId: 1, productId: 'P1', qty: 2, expectedPrice: 14000 }] })];
    X.S.stack = [{ type: 'trips', args: {} }];
    let h = X.PAGE.trips();
    t.check(/Sent to Andrew · not taken · /.test(h) && /data-act="tchase" data-id="TRIP-SJ"/.test(h), 'a trip sent and never taken says so, with Chase');
    t.check((h.match(/D LATE/g) || []).length === 2, 'a supplier bringing it, out for days, is late too');
    t.check(/>56K</.test(h) || />56K /.test(h) || /56K/.test(h), 'the Out tile shows what is on the road in K, never 0 M');
    X.ACT.tchase({ dataset: { id: 'TRIP-SJ' } }); h = X.PAGE.trips();
    t.check(/WhatsApp Andrew/.test(h) && /data-act="tchasego" data-step="give"/.test(h) && /data-act="tchasego" data-step="cancel"/.test(h) && /Nansana waits · 5 d/.test(h), 'Chase: WhatsApp the runner, give it to someone, or cancel it; who waits is named');
    X.ACT.tchasego({ dataset: { step: 'give' } }); await X.ACT.tchasegive({ dataset: { w: 'W3' } });
    t.check(X.tripById('TRIP-SJ').assignedWorkerId === 'W3' && /Musa has it now · Andrew is told/.test(X.PAGE.trips()), 'given to Musa: the trip is his, Andrew is told');
    await X.ACT.tchaseundo();
    t.check(X.tripById('TRIP-SJ').assignedWorkerId === 'W2', 'Undo gives it back');
    X.ACT.tchasego({ dataset: { step: 'cancel' } }); await X.ACT.tchasecancel();
    t.check(X.tripById('TRIP-SJ').voided && /^Cancelled/.test(X.tripById('TRIP-SJ').note) && /Cancelled · the lines are on To plan/.test(X.PAGE.trips()), 'cancelled: the lines go back to To plan, the note the push reads');
  }
  {
    const X = page(fakeDb({}));
    X.S.view = 'suppliers'; const h = X.viewSuppliers();
    t.check(/>SCORE</.test(h) && />TERMS</.test(h) && />WE OWE</.test(h), 'a supplier row labels its score, its terms and what we owe');
  }

  // 10m. The cross-app run: a cost over the client's price holds; the agreed price rides; own money never takes Accounts' cash; nothing came; big cartons wait.
  {
    const row = orderRow(34, [it(1, 'P2', null, 6, 'S2', 28000, { sellPrice: 30000 })]);
    const db = fakeDb({ saved_quotes: [row], __rpcOk: true }), X = page(db);
    X.D().savedQuotes = [X.rowToQuote(JSON.parse(JSON.stringify(row)))];
    X.S.stack = [{ type: 'order', args: { id: 34 } }, { type: 'price', args: { id: 34, lineId: 1, v: '33000', unit: 'base', phone: true } }];
    const h = X.PAGE.price(X.topArgs());
    t.check(/Above our selling price · /.test(h) && /decides/.test(h) && !/30,000/.test(h), 'a new price over the client\'s price shows the order will wait for the Manager, never the selling price');
    await X.ACT.pgo();
    const q = X.rowToQuote(db.tables.saved_quotes[0]);
    t.check(q.status === 'draft' && q.items[0].priceNote === 'nomargin' && X.holdOf(q) && X.holdOf(q).kind === 'price', 'saved: the line waits for the Manager\'s price and the order stays in Checking');
    q.status = 'awaiting_goods'; X.D().savedQuotes = [q];
    const l = X.orderPurchaseLines(q)[0];
    t.check(l.unitCost === 33000 && l.best.agreedAt, 'the round carries the agreed 33,000, not the list price');
  }
  {
    const X = page(fakeDb({ collection_trips: [] }));
    X.D().handoffs = [{ id: 'old', kind: 'trip_cash', ref: 'round:ab', status: 'done', createdAt: new Date(NOW - 36e5).toISOString(), doneAt: new Date(NOW - 35e5).toISOString(), payload: { supplierIds: ['S1'], amount: 150000 } }];
    X.D().collectionTrips = [X.rowToTrip({ id: 'TRIP-OWN-1', shop_id: SH, supplier_id: 'S1', status: 'collecting', assigned_worker_id: 'W1', created_at: new Date(NOW - 6e5).toISOString(), lines: [{ orderId: 1, lineId: 1, productId: 'P1', qty: 2, expectedPrice: 1000 }] })];
    t.check(!!X.roundCashH(X.tripById('TRIP-OWN-1')), 'an older handover still reaches a round that paid with it');
    X.setTripPay('round:TRIP-OWN-1', { own: true });
    t.check(!X.roundCashH(X.tripById('TRIP-OWN-1')), 'a round on your own money never shows Accounts\' cash from an earlier ask');
    X.S.stack = [{ type: 'trip', args: { id: 'TRIP-OWN-1' } }];
    X.ACT.tnoneall({ dataset: {} });
    const h = X.PAGE.trip({ id: 'TRIP-OWN-1' });
    t.check(/Nothing came at /.test(h) && X.stopReadyWhy(X.tripView(X.tripById('TRIP-OWN-1'))) === '', 'Nothing came here: nothing paid, no receipt, and the stop can be done');
  }
  {
    const data = fixture(); data.prices = data.prices.map(r => r.id === 4 ? { ...r, retail: null, date: new Date(NOW).toISOString().slice(0, 10) } : r);
    const X = page(fakeDb({}), data);
    X.D().savedQuotes = [X.rowToQuote(orderRow(81, [it(1, 'P3', null, 1, 'S1', 5000)], {}, { status: 'awaiting_goods' }))];
    t.check(X.cartonsWaiting().length === 1 && X.cartonsWaiting()[0].l.carton.state === 'ask' && !X.runsToGo().some(r => r.lines.some(x => String(x.order.id) === '81')), '1 kg sold from a supplier who sells 25 kg boxes waits for the Manager\'s OK, off the round');
    X.S.stack = [{ type: 'plan', args: { who: 'me' } }];
    t.check(/data-act="cartonask"/.test(X.PAGE.plan(X.topArgs())), 'the plan asks the Manager in one tap');
    X.D().restockBuys = [{ id: 'cb', productId: 'P3', variantIdx: null, qty: 24, supplierId: 'S1', price: 5000, status: 'planned', forLine: '81:1', createdAt: new Date(NOW).toISOString() }];
    t.check(X.cartonsWaiting().length === 0 && X.runsToGo().some(r => r.lines.some(x => String(x.order.id) === '81')), 'once the Manager lets it go, the carton joins the round');
  }

  // 10n. The yard's restock asks (Store 0157): add to a round or not yet, with Undo before anything is sent.
  {
    const db = fakeDb({ __rpcOk: true }), X = page(db);
    { const la = await X.loadStoreAsks(); t.check(la === null || Array.isArray(la), 'loading the yard asks never throws · null when 0157 is not there'); }
    X.D().storeAsks = [
      { id: 'A1', ref: 'P2', askedByName: 'Musa Kato', createdAt: new Date(NOW - 6e5).toISOString(), payload: { key: 'P2', productId: 'P2', variantIdx: null, name: 'Gutter, 4m PVC', qty: 10, unit: 'pc', when: 'today', shortFor: [] } },
      { id: 'A2', ref: 'P3', askedByName: 'Musa Kato', createdAt: new Date(NOW - 3e5).toISOString(), payload: { key: 'P3', productId: 'P3', variantIdx: null, name: 'Roofing nails', qty: 4, unit: 'kg', when: 'this week', shortFor: [] } }];
    X.S.stack = [{ type: 'restock', args: { picked: null } }];
    let h = X.PAGE.restock(X.topArgs());
    t.check(/FROM THE YARD · 2/.test(h) && /needed today/.test(h) && /data-act="yardadd"/.test(h) && /data-act="yardno"/.test(h) && /Musa asks · you decide/.test(h), 'What to buy shows the yard\'s asks: qty, item, when, Add to a round and Not yet');
    X.ACT.yardadd({ dataset: { id: 'A1' } });
    h = X.PAGE.restock(X.topArgs());
    t.check(/On the restock list · goes on your next trip · Musa is told/.test(h) && /data-act="yardundo"/.test(h) && !db.writes.length, 'Add to a round ticks at once with Undo · nothing is written yet');
    X.ACT.yardundo({ dataset: { id: 'A1' } });
    t.check(/FROM THE YARD · 2/.test(X.PAGE.restock(X.topArgs())), 'Undo puts the ask back, nothing sent');
    X.ACT.yardadd({ dataset: { id: 'A1' } });
    await X.yardCommit(X.S.ui.yardWait.A1);
    const ins = db.writes.find(w => w[0] === 'insert' && w[1] === 'restock_buys'), rpc = db.writes.find(w => w[0] === 'rpc' && w[1] === 'answer_store_ask');
    t.check(ins && ins[2].product_id === 'P2' && ins[2].status === 'planned' && ins[2].qty >= 10 && rpc && rpc[2].p_id === 'A1' && rpc[2].p_status === 'accepted', 'sent: a planned refill for the item, and the ask answered accepted');
    X.ACT.yardno({ dataset: { id: 'A2' } });
    h = X.PAGE.restock(X.topArgs());
    t.check(/Monday trip/.test(h) && /Tell Musa · not yet/.test(h), 'Not yet offers the note chips and tells Musa');
    X.ACT.yardnote({ dataset: { id: 'A2', t: 'Next week' } });
    X.ACT.yardsend({ dataset: { id: 'A2' } });
    await X.yardCommit(X.S.ui.yardWait.A2);
    const rpc2 = db.writes.filter(w => w[0] === 'rpc' && w[1] === 'answer_store_ask')[1];
    t.check(rpc2 && rpc2[2].p_status === 'declined' && rpc2[2].p_note === 'Next week' && db.writes.filter(w => w[1] === 'restock_buys').length === 1, 'Not yet answers declined with the note and buys nothing');
    t.check(!X.D().storeAsks.length && /FROM THE YARD · 0/.test(X.PAGE.restock(X.topArgs())) && !/data-act="yardundo"/.test(X.PAGE.restock(X.topArgs())), 'answered asks leave the open list; the done lines stay without Undo');
    X.D().storeAsks = []; X.S.ui.yardWait = {};
    t.check(X.yardCardHTML() === '', 'no asks (or no 0157 yet): no card');
  }
  // 10o. The canvas build of 28 Oct 2026: Today's steps, the order as one slip, a question before a slide.
  {
    const row = orderRow(95, [it(1, 'P1', 0, 10, 'S1', 14500), it(2, 'P2', null, 6, 'S2', 28000), it(3, 'P3', null, 4, null, 0)], { supplierConfirms: { S1: { state: 'problem', at: NOW - 6e5, askedAt: NOW - 9e5 } } });
    const db = fakeDb({ saved_quotes: [row] }), X = page(db);
    X.D().savedQuotes = [X.rowToQuote(JSON.parse(JSON.stringify(row)))];
    const today = X.viewToday();
    t.check(X.todayJobs()[0].k === 'check' && /DO THIS FIRST/.test(today) && /Kikuubo is out/.test(today) && /Choose supplier/.test(today) && /jobs? · in order/.test(today), 'Today: a problem is step 1, do this first, with one button');
    X.S.ui.oline = null;
    let h = X.PAGE.order({ id: 95 });
    t.check(/NANSANA’S ORDER · 3 LINES/.test(h) && />PROBLEM</.test(h) && />TO ASK</.test(h) && />NO SUPPLIER</.test(h) && !/data-tri=/.test(h), 'the order is one slip: a line each, its status in one word, folded');
    X.ACT.oline({ dataset: { k: '95|3' } });
    h = X.PAGE.order({ id: 95 });
    t.check(/data-act="findsheet"/.test(h) && /Client will wait/.test(h) && /Remove from order/.test(h), 'a line nobody sells opens to Find a supplier, Client will wait, Remove from order');
    const sh = X.SHEET.find({ id: 95, lineId: '3' });
    t.check(/Not on our price list/.test(sh) && /data-act="nonewait" data-from="find"/.test(sh), 'Find a supplier is a popup: Sourcing finds one, or a close match');
    X.ACT.nonedrop({ dataset: { id: '95', line: '3' } });
    h = X.PAGE.order({ id: 95 });
    t.check(/>REMOVED</.test(h) && /data-act="nonedropundo"/.test(h) && !db.tables.saved_quotes[0].payload.droppedLines, 'Remove from order waits with Undo · nothing is written yet');
    X.ACT.oline({ dataset: { k: '95|1' } });
    h = X.PAGE.order({ id: 95 });
    t.check(/data-act="tritap" data-to="yes"/.test(h) && /data-act="tritap" data-to="no"/.test(h), 'Confirmed and Problem are buttons as well as the slide');
    X.S.ui.slideAsk = 'handin';
    t.check(/Finish the trip\?/.test(X.slideHTML('handin', 'Tap or slide · hand in the trip', 'box', { ask: 'Finish the trip?', yes: 'Yes, finish' })) && /data-ask="1"/.test((X.S.ui.slideAsk = null, X.slideHTML('handin', 'x', 'box', { ask: 'Finish the trip?' }))), 'a tap on the slide asks "Finish the trip?" first');
    const mk = (id, sid, i, lines) => X.rowToTrip({ id, supplier_id: sid, status: 'collecting', assigned_worker_id: 'W1', created_at: new Date(NOW - 36e5 + i).toISOString(), lines });
    X.D().collectionTrips = [mk('R-1', 'S3', 0, [{ orderId: 1, lineId: 1, productId: 'P1', qty: 1, price: 100 }]), mk('R-2', 'S1', 1, [{ orderId: 1, lineId: 2, productId: 'P1', qty: 90, price: 1000, gotQty: 90 }]), mk('R-3', 'S2', 2, [{ orderId: 1, lineId: 3, productId: 'P2', qty: 5, price: 10 }])];
    t.check(X.roundStops(X.D().collectionTrips[1]).map(x => x.id).join() === 'R-1,R-2,R-3', 'a trip keeps the order it was planned in, however its lines load');
  }

  // 10d. The greeting: the time of day it is, and a name, never a login.
  {
    const X = page(fakeDb({}));
    X.D().staff = [{ id: 'W1', name: 'turyasingurakevin94', userId: 'u1' }];
    t.check(X.greetName() === '', 'a login handle is not a name to greet by');
    X.D().staff = [{ id: 'W1', name: 'Kevin Ackman', userId: 'u1' }];
    t.check(X.greetName() === 'Kevin Ackman', 'the staff row\'s name is');
    const real = Date.prototype.getHours; Date.prototype.getHours = () => 1;
    t.check(X.greeting() === 'Working late', 'at 1 am it says Working late, not Good evening');
    Date.prototype.getHours = real;
  }

  process.exit(t.done() ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
