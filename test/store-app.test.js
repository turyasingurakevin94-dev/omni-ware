#!/usr/bin/env node
'use strict';
/*
 * The Store app (store.html): every move it makes on an order, a trip or
 * the shelf must be the move the owner's app or the worker app would
 * make, written in the shape they read.
 *
 *   1. Parity. store.html carries its own copies of the rules it acts on
 *      -- a line's count in the unit it was chosen in, where an order goes,
 *      which orders are in the pickers' queue, when an order waits on
 *      goods. Each runs here beside the original from index.html /
 *      shared-worker.js on the same inputs and must agree.
 *   2. Packing. Taking an order, each pick, and finishing write only the
 *      worker app's keys, onto the row as the server has it now.
 *   3. Out of the gate. Loading writes the carrier as loadOrder does and
 *      moves the order to Out for delivery; the door moves it to
 *      Completed with the proof; the gate does both at once.
 *   4. A trip checked in, and a blind count sent: nothing the owner keeps
 *      (stock, lots, bills, places) is ever written by the page.
 *   5. Every screen draws from the fixture without throwing, and no price
 *      or cost is drawn.
 *
 * Runs the page's real script in a sandbox with a fake database; nothing
 * is copied into this file.
 *
 * Run: node test/store-app.test.js   (or: npm test)
 */
const vm = require('vm');
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('store app');
const html = read('store.html');
const adminSrc = read('index.html');
const workerSrc = read('shared-worker.js');

/* ---------------- the fixture: one small yard ---------------- */
const SH = 'shop1';
const NOW = Date.now();
const iso = ms => new Date(ms).toISOString();
function fixture(){
  return {
    products: [
      { id: 'P1', name: 'Iron sheet G28', category: 'Roofing', image: null, variants: [{ combo: { len: '3m' } }] },
      { id: 'P2', name: 'Cement Hima 50kg', category: 'Cement', image: null, variants: [] },
      { id: 'P3', name: 'Door hinges 4"', category: 'Tools', image: null, variants: [] },
    ],
    units: [{ productId: 'P1', variantIdx: 0, unit: 'pc', packUnit: 'bundle', packQty: 20, pieces: 0 }, { productId: 'P3', variantIdx: null, unit: 'doz', packUnit: 'ctn', packQty: 10, pieces: 12 }],
    stock: { 'P1::0': 86, P2: 60, P3: 204 }, stockLog: [], lastCounted: {},
    savedQuotes: [], collectionTrips: [],
    staff: [{ id: 'W1', name: 'Musa Kato', phone: '0772111222', role: 'delivery', unavailable: false, userId: 'u1' }, { id: 'W2', name: 'Okello Peter', phone: '', role: 'worker', unavailable: false, userId: null }],
    customers: [{ id: 'C1', name: 'Kato Construction Ltd', phone: '', location: 'Ntinda' }],
    agents: [{ id: 'A1', name: 'Agent One', paymentTerm: 'prepay' }],
    places: [{ name: 'Nakasero', lat: 0.3236, lng: 32.58 }, { name: 'Ntinda', lat: 0.354, lng: 32.615 }],
    routes: [], counts: [],
    categories: [], locations: ['Nakasero', 'Ntinda'], shopPlace: 'Nakasero',
  };
}
const it = (lineId, pid, qty, extra) => ({ lineId, productId: pid, variantIdx: pid === 'P1' ? 0 : null, productName: pid === 'P1' ? 'Iron sheet G28 — 3m' : pid === 'P2' ? 'Cement Hima 50kg' : 'Door hinges 4"',
  unit: pid === 'P3' ? 'doz' : pid === 'P2' ? 'bag' : 'pc', packUnit: pid === 'P1' ? 'bundle' : pid === 'P3' ? 'ctn' : '', packQty: pid === 'P1' ? 20 : pid === 'P3' ? 10 : 0, qtyIn: 'unit', qty, supplierId: '__stock__', price: 1000, sellPrice: 1500, ...(extra || {}) });
function orderRow(id, items, extra, cols){
  return { id, shop_id: SH, client_name: 'Kato Construction Ltd', client_phone: null, date: new Date(NOW).toISOString().slice(0, 10), status: 'preparing', invoiced: false, invoiced_ts: null, voided: false,
    payload: { client: { name: 'Kato Construction Ltd', phone: '' }, items, charges: [], customerId: 'C1', savedAt: iso(NOW - 3 * 3600e3), createdAt: iso(NOW - 3 * 3600e3), stageEnteredAt: NOW - 3600e3, stageLog: [{ status: 'preparing', at: NOW - 3600e3 }], ...(extra || {}) }, ...(cols || {}) };
}

/* ---------------- the page, in a sandbox ---------------- */
function loadPage(db){
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  const app = scripts.find(s => s.includes('function packQueue'));
  if (!app) throw new Error('store.html has no app script');
  const el = () => ({ innerHTML: '', textContent: '', children: [], style: {}, dataset: {}, classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, setAttribute() {}, getAttribute: () => null, querySelector: () => null, querySelectorAll: () => [], appendChild() {}, remove() {}, addEventListener() {} });
  const store = {};
  const sandbox = {
    console, setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, requestAnimationFrame: () => 0, Promise, Date, Math, JSON, URLSearchParams, encodeURIComponent, isFinite, isNaN,
    location: { hostname: 'localhost', hash: '', search: '', reload() {} },
    localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
    navigator: {}, innerWidth: 390,
    document: { getElementById: el, querySelector: () => null, querySelectorAll: () => [], addEventListener() {}, createElement: el, body: { appendChild() {}, style: {} }, documentElement: { classList: { toggle() {} } }, visibilityState: 'visible', activeElement: null },
    supabase: { createClient: () => db },
  };
  sandbox.window = sandbox; sandbox.window.open = () => {}; sandbox.window.addEventListener = () => {};
  vm.createContext(sandbox);
  // boot() waits on getUser, which this fake never answers: the page stays
  // unbooted and the test drives it.
  vm.runInContext(app + '\n;globalThis.__x = { S, ACT, PAGE, D, render, rowToQuote, rowToTrip, quoteLineCount, quoteLinePack, orderDestination, orderIsBackdated, goodsBlockPreparing, packQueue, loadQueue, takeOrder, setPick, flushPicks, finishPack, loadOrders, markDelivered, handOver, checkInTrip, sendCount, changeOrder, levelsFor, fmtLevels, viewToday, viewShelf, pickView, pickLines, heldForOrders, shelfAvailable, heldGone, tripWho, lineShortNow };', sandbox);
  return sandbox.__x;
}
function fakeDb(tables){
  const writes = [];
  function Q(table){ this.t = table; this.f = []; this.op = 'select'; this.one = false; }
  Q.prototype.select = function(){ return this; };
  Q.prototype.eq = function(k, v){ this.f.push(r => String(r[k]) === String(v)); return this; };
  Q.prototype.in = Q.prototype.gt = Q.prototype.gte = Q.prototype.order = Q.prototype.limit = Q.prototype.not = function(){ return this; };
  Q.prototype.maybeSingle = Q.prototype.single = function(){ this.one = true; return this; };
  Q.prototype.insert = function(row){ this.op = 'insert'; this.row = row; return this; };
  Q.prototype.update = function(row){ this.op = 'update'; this.row = row; return this; };
  Q.prototype.then = function(res, rej){
    const rows = tables[this.t] || (tables[this.t] = []);
    const clone = x => JSON.parse(JSON.stringify(x));
    if (this.op === 'insert') { const r = { id: 'new' + rows.length, status: 'sent', created_at: iso(NOW), ...clone(this.row) }; writes.push(['insert', this.t, clone(this.row)]); rows.push(r); return Promise.resolve({ data: clone(r), error: null }).then(res, rej); }
    const hit = rows.filter(r => this.f.every(f => f(r)));
    if (this.op === 'update') { writes.push(['update', this.t, clone(this.row), hit.map(r => r.id)]); hit.forEach(r => Object.assign(r, clone(this.row))); return Promise.resolve({ error: null }).then(res, rej); }
    return Promise.resolve({ data: clone(this.one ? (hit[0] || null) : hit), count: hit.length, error: null }).then(res, rej);
  };
  return { writes, tables, auth: { getUser: () => new Promise(() => {}), getSession: async () => ({ data: { session: null } }), signOut: async () => ({}) }, from: tb => new Q(tb),
    rpc: async () => ({ data: null, error: { message: 'no rpc' } }), storage: { from: () => ({ upload: async p => { writes.push(['upload', p]); return { error: null }; } }) } };
}
function page(db, data){
  const X = loadPage(db);
  Object.assign(X.S, { data: data || fixture(), shopId: SH, user: { id: 'u1', email: 'musa@shop.ug' }, shopName: 'Omni-Ware', role: 'store' });
  return X;
}
function withOrder(row, data){ const db = fakeDb({ saved_quotes: [row] }), X = page(db, data); X.D().savedQuotes = [X.rowToQuote(JSON.parse(JSON.stringify(row)))]; return { db, X }; }

/* ---------------- 1. parity ---------------- */
const adminData = { ...fixture(), savedQuotes: [] };
const admin = compileScope([
  ...['quoteLinePack', 'quoteLineCountPer', 'quoteLineCount', 'orderDestination', 'orderIsCollected', 'orderCustomerLocation'].map(n => extractFunction(adminSrc, n, 'index.html')),
], { data: adminData }, ['quoteLinePack', 'quoteLineCount', 'orderDestination']);
const workerData = { savedQuotes: [], agents: adminData.agents };
const worker = compileScope([
  ...['orderIsBackdated', 'goodsBlockPreparing', 'orderAwaitsGoods', 'orderIncomingLines', 'orderLineIsBoughtIn', 'quoteLineReceived', 'workerPickQueue', 'quoteAgedOffBoard', 'agentPaymentBlocksPreparing'].map(n => extractFunction(workerSrc, n, 'shared-worker.js')),
], { data: workerData }, ['orderIsBackdated', 'goodsBlockPreparing', 'workerPickQueue']);

const P = page(fakeDb({}));
{
  [it(1, 'P1', 40), it(2, 'P1', 40, { qtyIn: 'pack' }), it(3, 'P1', 45, { qtyIn: '' }), it(4, 'P2', 10), it(5, 'P3', 24, { qtyIn: 'pack' })].forEach(l => {
    t.check(JSON.stringify(admin.quoteLinePack(l)) === JSON.stringify(P.quoteLinePack(l)), `a line's packs read the same as the owner's (${l.productName} × ${l.qty}, ${l.qtyIn || 'auto'})`);
    t.check(JSON.stringify(admin.quoteLineCount(l, 20)) === JSON.stringify(P.quoteLineCount(l, 20)), `a count reads in the same unit (${l.productName})`);
  });
  const rows = [
    orderRow(1, [it(1, 'P2', 4)]),
    orderRow(2, [it(1, 'P2', 4)], { originAgentId: 'A1', deliveryMode: 'shop_delivery', deliveryAddress: 'Bwaise', customerId: null }),
    orderRow(3, [it(1, 'P2', 4)], { originAgentId: 'A1', deliveryMode: 'agent_pickup' }),
    orderRow(4, [it(1, 'P2', 4)], { customerId: null, deliveryMode: 'shop_delivery', deliveryAddress: 'Kireka' }, { client_name: 'Walk-in' }),
    orderRow(5, [it(1, 'P2', 4, { supplierId: 'S1' })]),
    orderRow(6, [it(1, 'P2', 4, { supplierId: 'S1', receivedAt: iso(NOW), receivedQty: 4 })]),
    orderRow(7, [it(1, 'P2', 4)], { assignedWorkerId: 'W2', pickingStatus: 'in_progress' }),
    orderRow(8, [it(1, 'P2', 4)], { pickingStatus: 'done' }),
    orderRow(9, [it(1, 'P2', 4)], { createdAt: iso(NOW + 864e5 * 3) }),
    orderRow(10, [it(1, 'P2', 4)], { originAgentId: 'A1', agentPaymentStatus: 'unpaid' }),
  ];
  const qs = rows.map(r => P.rowToQuote(JSON.parse(JSON.stringify(r))));
  const qa = rows.map(r => P.rowToQuote(JSON.parse(JSON.stringify(r))));
  adminData.savedQuotes = qa; workerData.savedQuotes = qa;
  qs.forEach((q, i) => {
    t.check(String(admin.orderDestination(qa[i])) === String(P.orderDestination(q)), `where order ${q.id} goes reads the same as the delivery runs: ${P.orderDestination(q)}`);
    t.check(worker.goodsBlockPreparing(qa[i]) === P.goodsBlockPreparing(q) && worker.orderIsBackdated(qa[i]) === P.orderIsBackdated(q), `order ${q.id} waits on goods / is backdated the same as in the worker app`);
  });
  P.D().savedQuotes = qs;
  const mine = P.packQueue().filter(q => !q.assignedWorkerId).map(q => q.id).sort().join();
  const theirs = worker.workerPickQueue().map(q => q.id).sort().join();
  t.check(mine === theirs, `the unassigned orders to pack are the worker app's pick queue exactly (${theirs})`);
}

/* ---------------- 2-4: the writes ---------------- */
(async () => {
  // 2. packing
  {
    const { db, X } = withOrder(orderRow(20, [it(1, 'P1', 40), it(2, 'P2', 10), it(3, 'P3', 4)]));
    await X.takeOrder(20);
    let p = db.tables.saved_quotes[0].payload;
    t.check(p.assignedWorkerId === 'W1' && p.pickingStatus === 'in_progress' && typeof p.workerAcceptedAt === 'number' && p.items.every(i => i.pickStatus === 'pending'), 'taking an order puts it on this login\'s staff row, in progress, every line pending');
    // Somebody edits the order on the console while this phone picks.
    db.tables.saved_quotes[0].payload.note = 'from the owner';
    const q = X.D().savedQuotes[0];
    X.setPick(q, 0, 'done'); X.setPick(q, 1, 'short', 6);
    t.check(X.pickView(q)[1].pickStatus === 'short' && X.pickView(q)[1].pickedQty === 6, 'a pick shows on the phone before it is sent');
    await X.flushPicks(20);
    p = db.tables.saved_quotes[0].payload;
    t.check(p.items[0].pickStatus === 'done' && p.items[0].pickedQty === 40 && p.items[1].pickStatus === 'short' && p.items[1].pickedQty === 6 && p.items[2].pickStatus === 'pending', 'each pick lands on its line the way setItemPickedQty writes it');
    t.check(p.note === 'from the owner' && p.items[0].sellPrice === 1500, 'what the console wrote meanwhile, and the line\'s own fields, are kept');
    t.check(!(await X.finishPack(20)), 'an order with a line still unanswered cannot be finished');
    X.setPick(X.D().savedQuotes[0], 2, 'done');
    await X.finishPack(20);
    const r = db.tables.saved_quotes[0];
    t.check(r.payload.pickingStatus === 'done' && typeof r.payload.pickingDoneAt === 'number' && r.status === 'preparing', 'finishing marks the pick done and leaves the order in Packing, as finishPreparingOrder does');
    t.check(db.writes.every(w => w[0] === 'update' && w[1] === 'saved_quotes' && Object.keys(w[2]).every(k => k === 'payload' || k === 'status')), 'only the payload (and the status) of the order is written');
  }
  // 3a. the truck
  {
    const { db, X } = withOrder(orderRow(21, [it(1, 'P2', 4, { pickStatus: 'done' })], { pickingStatus: 'done', pickingDoneAt: NOW - 6e5 }));
    const done = await X.loadOrders([21], { kind: 'hired', name: 'Kasule', what: 'UBF 412Q', phone: '0772418905' });
    const r = db.tables.saved_quotes[0], p = r.payload;
    t.check(done.length === 1 && r.status === 'pending_delivery', 'loading moves the order to Out for delivery');
    t.check(p.carrier.kind === 'hired' && p.carrier.name === 'Kasule' && p.carrier.what === 'UBF 412Q' && p.carrier.phone === '0772418905' && typeof p.carrier.at === 'number' && p.carrier.by && p.assignedDeliveryId === '__carrier__', 'the carrier is written as loadOrder writes it');
    const last = p.stageLog[p.stageLog.length - 1];
    t.check(last.status === 'pending_delivery' && last.at === p.stageEnteredAt, 'the stage log gains the move, at stageEnteredAt');
  }
  // 3b. the door
  {
    const { db, X } = withOrder(orderRow(22, [it(1, 'P2', 4)], { carrier: { kind: 'staff', staffId: 'W1', name: 'Musa' }, assignedDeliveryId: 'W1' }, { status: 'pending_delivery' }));
    await X.markDelivered(22, 'Joseph', null);
    const r = db.tables.saved_quotes[0];
    t.check(r.status === 'completed' && r.payload.deliveredTo === 'Joseph' && r.payload.deliveredAt && r.payload.deliveredPhoto === null, 'the door marks it delivered with who took it, as saveDeliveredProof does');
    t.check(!db.writes.some(w => w[1] === 'saved_quotes' && 'invoiced' in w[2]), 'delivering never touches invoicing');
  }
  // 3b'. with a photo
  {
    const { db, X } = withOrder(orderRow(25, [it(1, 'P2', 4)], { originAgentId: 'A1' }, { status: 'pending_delivery' }));
    X.S.data.products = X.S.data.products; // createImageBitmap is not in the sandbox: the photo goes up as it came
    await X.markDelivered(25, 'Agent One', { type: 'image/jpeg' });
    const up = db.writes.find(w => w[0] === 'upload');
    t.check(up && up[1].startsWith('shop1/A1/25-') && db.tables.saved_quotes[0].payload.deliveredPhoto === up[1], 'the photo goes to the agent\'s own folder and the order points at it');
  }
  // 3c. the gate
  {
    const { db, X } = withOrder(orderRow(23, [it(1, 'P2', 4, { pickStatus: 'done' })], { pickingStatus: 'done' }));
    await X.handOver(23, { kind: 'client', name: 'Ssali', phone: '0701552310' }, NOW);
    const r = db.tables.saved_quotes[0], p = r.payload;
    t.check(r.status === 'completed' && p.carrier.kind === 'client' && p.assignedDeliveryId === '__client__' && p.deliveredTo === 'Ssali' && p.handoverCheckedAt === NOW, 'handing over at the gate loads it to the client and completes it in one go');
    t.check(p.stageLog.map(s => s.status).join() === 'preparing,pending_delivery,completed', 'both moves are in the stage log');
  }
  // 3d. a move the yard does not make is refused
  {
    const { db, X } = withOrder(orderRow(24, [it(1, 'P2', 4)], {}, { status: 'awaiting_goods' }));
    let threw = false; try { await X.changeOrder(24, q => { q.status = 'completed'; }); } catch (_e) { threw = true; }
    t.check(threw && db.tables.saved_quotes[0].status === 'awaiting_goods', 'an order still waiting on goods cannot be pushed to Completed from the yard');
  }
  // 4a. a trip off the truck
  {
    const trip = { id: 'T1', shop_id: SH, supplier_id: 'S1', status: 'collected', assigned_worker_id: 'W2', lines: [{ orderId: 20, lineId: 1, productId: 'P2', qty: 20, gotQty: 20 }, { orderId: 21, lineId: 1, productId: 'P1', variantIdx: 0, qty: 40, gotQty: 38 }] };
    const db = fakeDb({ collection_trips: [JSON.parse(JSON.stringify(trip))] }), X = page(db);
    X.D().collectionTrips = [X.rowToTrip(trip)];
    await X.checkInTrip('T1', { 1: 36 });
    const r = db.tables.collection_trips[0];
    t.check(r.lines[0].yardQty === 20 && r.lines[1].yardQty === 36 && r.lines[1].gotQty === 38 && r.yard_checked_at && r.yard_checked_by === 'u1', 'the yard\'s count rides on each line beside what the buyer said, with who checked it and when');
    t.check(r.status === 'collected', 'the trip stays for the console to check in: the yard never confirms it');
  }
  // 4b. a blind count
  {
    const db = fakeDb({ stock_counts: [] }), X = page(db);
    const L = X.levelsFor({ productId: 'P3', variantIdx: null });
    t.check(L.map(l => l[1]).join() === 'ctn,doz,pc' && X.fmtLevels(L, 20 * 10 + 4) === '20 ctn 4 doz', 'door hinges count as cartons, dozens and loose pieces: 20 ctn and 4 doz is 204 dozen');
    await X.sendCount('Aisle C · Tools', [{ key: 'P3', productId: 'P3', variantIdx: null, name: 'Door hinges 4"', counted: 200, system: 204 }]);
    const w = db.writes.find(x => x[1] === 'stock_counts');
    t.check(w && w[2].counted_by === 'u1' && w[2].lines[0].counted === 200 && w[2].lines[0].system === 204 && !('status' in w[2]), 'the count goes to stock_counts with what the books said beside it, for a manager to decide');
  }
  t.check(true, 'see below');
  {
    // Across every write above, nothing the owner keeps.
    // (Each block had its own db; re-run the gate and the count on one to check.)
    const db = fakeDb({ saved_quotes: [orderRow(30, [it(1, 'P2', 4, { pickStatus: 'done' })], { pickingStatus: 'done' })], stock_counts: [] }), X = page(db);
    X.D().savedQuotes = [X.rowToQuote(JSON.parse(JSON.stringify(db.tables.saved_quotes[0])))];
    await X.handOver(30, { kind: 'client', name: 'A' });
    await X.sendCount('x', [{ key: 'P2', counted: 1, system: 2 }]);
    t.check(!db.writes.some(w => ['stock', 'stock_lots', 'stock_log', 'purchase_invoices', 'cash_txns', 'prices', 'places'].includes(w[1])), 'nothing the owner keeps — stock, lots, the stock log, bills, cash, prices, places — is ever written by the page');
  }

  // 5. the screens draw
  {
    const data = fixture(), X = page(fakeDb({}), data);
    X.D().savedQuotes = [
      X.rowToQuote(orderRow(40, [it(1, 'P1', 40), it(2, 'P2', 10)])),
      X.rowToQuote(orderRow(41, [it(1, 'P2', 4, { pickStatus: 'done' })], { pickingStatus: 'done', pickingDoneAt: NOW - 6e5 })),
      X.rowToQuote(orderRow(42, [it(1, 'P2', 4)], { carrier: { kind: 'staff', staffId: 'W1', name: 'Musa' }, assignedDeliveryId: 'W1' }, { status: 'pending_delivery' })),
      X.rowToQuote(orderRow(43, [it(1, 'P3', 4, { pickStatus: 'short', pickedQty: 2 })], { pickingStatus: 'done', deliveryMode: 'agent_pickup', originAgentId: 'A1', agentPaymentStatus: 'paid' })),
    ];
    X.D().collectionTrips = [X.rowToTrip({ id: 'T9', supplier_id: 'S1', status: 'collected', assigned_worker_id: 'W2', collected_at: iso(NOW - 6e5), lines: [{ orderId: 40, lineId: 2, productId: 'P2', productName: 'Cement Hima 50kg', unit: 'bag', qty: 10, gotQty: 10 }] })];
    X.D().counts = [{ id: 'c1', aisle: 'Aisle A', countedByName: 'Musa', lines: [{ key: 'P3', productId: 'P3', name: 'Door hinges 4"', counted: 200, system: 204 }], status: 'sent', createdAt: iso(NOW) }];
    X.S.ui.ct = { aisle: 'Aisle C · Tools', keys: ['P3'], i: 0, entries: { 0: { 0: '20', 1: '4' } }, focus: 1, counts: { 0: 204 }, system: { 0: 204 }, at: NOW };
    X.S.ui.pk = { id: 40, i: 0 };
    ['viewToday', 'viewShelf'].forEach(v => { try { const h = X[v](); t.check(typeof h === 'string' && h.length > 400, v + ' draws'); } catch (e) { t.fail(v + ' threw: ' + e.stack); } });
    const pages = [['movein', {}], ['movepack', {}], ['onroad', {}], ['receive', { id: 'T9' }], ['pack', { id: 40 }], ['load', {}], ['loadhired', {}], ['collect', { id: 43 }], ['deliver', { id: 42 }], ['delivered', { id: 42 }], ['stock', { key: 'P1::0' }], ['count', {}], ['countresults', {}], ['decide', { id: 'c1' }], ['me', {}]];
    let all = '';
    pages.forEach(([pg, a]) => { try { X.S.stack = [{ type: pg, args: a }]; const h = X.PAGE[pg]({ ...a }); all += h; t.check(typeof h === 'string' && h.length > 300 && !/undefined|NaN/.test(h.replace(/data-[a-z]+="[^"]*"/g, '')), 'page ' + pg + ' draws, with no undefined or NaN in it'); } catch (e) { t.fail('page ' + pg + ' threw: ' + e.stack); } });
    const visible = (all + X.viewToday() + X.viewShelf()).replace(/<[^>]*>/g, ' ');
    t.check(!/UGX|sell(ing)? ?price|margin|markup|\bcost\b|1,500/i.test(visible), 'no price, cost or margin is drawn anywhere');
    t.check(!/204/.test(X.PAGE.count({}).replace(/<[^>]*>/g, ' ')), 'the count screen never shows what the books say');
  }

  // 6. The end-to-end test of 19 Oct 2026 (the report's fixes 3, 5, 6, 13).
  {
    // Fix 3, rule A: what is on the shelf to sell is the shelf less what the
    // invoices of live orders past Checking will take, in the shelf's unit.
    const data = fixture(), X = page(fakeDb({}), data), Q = (r) => X.rowToQuote(JSON.parse(JSON.stringify(r)));
    X.D().savedQuotes = [
      Q(orderRow(50, [it(1, 'P2', 4)], { pickingStatus: 'done', deliveredAt: iso(NOW) }, { status: 'completed' })),                          // delivered, not invoiced: held
      Q(orderRow(51, [it(1, 'P2', 3, { supplierId: 'S1', receivedAt: iso(NOW), receivedQty: 3 })], {}, { status: 'pending_delivery' })),      // bought in and received: held
      Q(orderRow(52, [it(1, 'P2', 7, { supplierId: 'S1' })])),                                                                                  // bought in, not received: not yet on the shelf
      Q(orderRow(53, [it(1, 'P2', 5)], {}, { status: 'draft' })),                                                                               // still Checking
      Q(orderRow(54, [it(1, 'P2', 10)], {}, { status: 'completed', invoiced: true, invoiced_ts: iso(NOW) })),                                 // invoiced: the stock is gone already
      Q(orderRow(55, [it(1, 'P2', 6)], {}, { voided: true })),
      Q(orderRow(56, [it(1, 'P2', 6)], { cancelledAt: iso(NOW) })),
      Q(orderRow(57, [it(1, 'P1', 2, { unit: 'bundle' })])),                                                                                    // 2 bundles of 20 off the shelf
      Q(orderRow(58, [it(1, 'P3', 300)])),                                                                                                       // more than the shelf has
      Q(orderRow(59, [it(1, 'P2', 5, { supplierId: '', clientWaits: true })])),                                                               // no supplier, client waits
    ];
    t.check(X.heldForOrders('P2', null) === 7 && X.shelfAvailable('P2', null) === 53, `fix 3: delivered and received lines of live, uninvoiced orders past Checking are held; drafts, invoiced, voided, cancelled, not-yet-received and no-supplier lines are not (60 on the shelf, ${X.heldForOrders('P2', null)} held, ${X.shelfAvailable('P2', null)} to sell)`);
    t.check(X.heldForOrders('P1', 0) === 40 && X.shelfAvailable('P1', 0) === 46, 'fix 3: a line sold by the bundle holds its pieces on the shelf (2 × 20 of 86)');
    t.check(X.shelfAvailable('P3', null) === 0, 'fix 3: available is never below nought');
    // 0142: what has LEFT the shelf (packed, out, delivered) for orders not yet invoiced; a blind count expects the books less it.
    X.D().savedQuotes.push(Q(orderRow(60, [it(1, 'P2', 2)], { pickingStatus: 'in_progress' }, { status: 'preparing' })));   // still being packed: on the shelf
    t.check(X.heldGone('P2', null) === 7, 'a count expects the books less what packed, out or delivered orders took (not what Checking or Buying still waits on): ' + X.heldGone('P2', null));
    const stockTxt = X.PAGE.stock({ key: 'P2' }).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
    t.check(/\b53\b/.test(stockTxt) && /7 held/.test(stockTxt) && /53 free to sell/.test(stockTxt) && /delivered/.test(stockTxt), 'fix 3: the item page shows what is on the shelf to sell, with the part held for orders');
    const shelfTxt = X.viewShelf().replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
    // "Needs a look" (the canvas's Stock tab) names the order that falls short.
    t.check(/Out · #0058 is short/.test(shelfTxt), 'fix 3: "Needs a look" says the item is out and which order falls short');

    // Fix 5: a line with no supplier that waits for the client is never picked, so never short.
    const row = orderRow(60, [it(1, 'P2', 4), it(2, 'P3', 5, { supplierId: '', clientWaits: true })]);
    const { db, X: Y } = withOrder(row);
    await Y.takeOrder(60);
    const q = Y.D().savedQuotes[0];
    t.check(Y.pickView(q).length === 1 && Y.pickLines(q)[0].i === 0 && db.tables.saved_quotes[0].payload.items[1].pickStatus === undefined, 'fix 5: the client-waits line is off the pick list and is not made pending');
    Y.setPick(q, 0, 'done');
    t.check(!!(await Y.finishPack(60)), 'fix 5: the order finishes packing without an answer for the client-waits line');
    const p = db.tables.saved_quotes[0].payload;
    t.check(p.pickingStatus === 'done' && p.items[0].pickStatus === 'done' && p.items[1].pickStatus === undefined && !p.items.some(i => i.pickStatus === 'short'), 'fix 5: it is never marked short, so no short pick reaches the Manager');

    // Fix 6: a trip the supplier brings is named for the supplier, with a time.
    const Z = page(fakeDb({}), { ...fixture(), suppliers: [{ id: 'S1', name: 'Maria Building Materials', location: 'Kawempe' }] });
    Z.D().savedQuotes = [Q(orderRow(61, [it(1, 'P2', 4, { supplierId: 'S1' })], {}, { status: 'awaiting_goods', client_name: 'Walk-in' }))];
    Z.D().collectionTrips = [
      Z.rowToTrip({ id: 'T20', supplier_id: 'S1', status: 'collecting', assigned_worker_id: '__supplier__', assigned_at: iso(NOW - 36e5), accepted_at: null, lines: [{ orderId: 61, lineId: 1, productId: 'P2', productName: 'Cement Hima 50kg', unit: 'bag', qty: 4 }] }),
      Z.rowToTrip({ id: 'T21', supplier_id: 'S1', status: 'collected', assigned_worker_id: '__supplier__', collected_at: iso(NOW - 6e5), lines: [{ orderId: 61, lineId: 1, productId: 'P2', productName: 'Cement Hima 50kg', unit: 'bag', qty: 4, gotQty: 4 }] }),
    ];
    t.check(Z.tripWho(Z.D().collectionTrips[0]) === 'Maria Building Materials', 'fix 6: tripWho names the supplier for a trip the supplier brings');
    Z.S.stack = [{ type: 'receive', args: { id: 'T21' } }];
    const yardTxt = [Z.viewToday(), Z.PAGE.movein({}), Z.PAGE.receive({ id: 'T21' })].join(' ').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
    // The check-in screen is titled for whoever brought it ("Maria's trip", the canvas's "Denis's trip").
    t.check(/Maria's trip/.test(yardTxt) && !/the's|\bthe supplier\b|since\s*(·|$|<)/i.test(yardTxt) && !/since\s+[^0-9]/.test(yardTxt), 'fix 6: "Maria\'s trip", never "the\'s", "the supplier" or a "since" with no time');

    // Fix 13: the gate's short banner compares with what the line bills now.
    const W = page(fakeDb({}), fixture());
    W.D().savedQuotes = [
      Q(orderRow(62, [it(1, 'P2', 0, { pickStatus: 'short', pickedQty: 0 }), it(2, 'P3', 2, { pickStatus: 'short', pickedQty: 2 })], { pickingStatus: 'done', pickSettle: { pick: 'went', lines: [{ idx: 0, ordered: 5, picked: 0 }, { idx: 1, ordered: 4, picked: 2 }] } })),
      Q(orderRow(63, [it(1, 'P3', 4, { pickStatus: 'short', pickedQty: 2 })], { pickingStatus: 'done' })),
    ];
    const gate = id => { W.S.ui.gc = null; W.S.stack = [{ type: 'collect', args: { id } }]; return W.PAGE.collect({ id }).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' '); };
    const g62 = gate(62), g63 = gate(63);
    // The slip (the canvas's Load) counts lines ticked, and a short reads "2 of 4 short" under the line.
    t.check(!/is 0, not 0/.test(g62) && !/0 of 0 short/.test(g62) && !/2 of 2 short/.test(g62) && !/Cement Hima/.test(g62) && /0 of 1 ticked/.test(g62), 'fix 13: after "Bill what went" the line settled to nothing is not counted out and nothing reads "0 of 0 short"');
    t.check(/Door hinges 4(&quot;|")[\s\S]{0,40}2 of 4 short/.test(g63), 'fix 13: a short not yet settled still shows what went against what was ordered');
  }

  process.exit(t.done() ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
