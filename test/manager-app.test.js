#!/usr/bin/env node
'use strict';
/*
 * The Manager app (manager.html): every figure it shows must be the
 * figure the owner's app and the sales desk would show, and every move it
 * makes on an order, a trip or a customer's account must be the move the
 * owner's app would make, written in the shape the owner's app reads.
 *
 *   1. Parity. manager.html carries its own copies of the rules it reads
 *      and acts on -- an order's total, a bill's balance, how a payment
 *      spreads over the bills, a debt's age, the owner's sales goal, the
 *      stage timer, a pick handed on. Each copy must be the original, word
 *      for word, from sales.html / index.html / shared-worker.js.
 *   2. Handing over. A packing job to another packer is offered to them
 *      and starts again (index.html setPacker); a delivery goes to another
 *      driver (assignCarrier); a trip to another buyer.
 *   3. A held order. The yes, the hold and cash-first are written onto
 *      the order (payload.creditCheck) and nothing else.
 *   4. A payment. Spread oldest first: a receipt per bill, the bill's
 *      payments and share of the debt, the debt lowered and logged --
 *      the sales desk's own path.
 *   5. Every screen draws from the fixture without throwing, with one,
 *      three and five salespeople.
 *
 * Runs the page's real script in a sandbox with a fake database.
 *
 * Run: node test/manager-app.test.js   (or: npm test)
 */
const vm = require('vm');
const { read, extractFunction, createReporter } = require('./_extract');
const fakeReceivePayment = require('./_fake-receive-payment');

const t = createReporter('manager app');
const html = read('manager.html');
const salesSrc = read('sales.html');
const adminSrc = read('index.html');
const workerSrc = read('shared-worker.js');
const accountsSrc = read('accounts.html');
const app = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).find(s => s.includes('function holderOf'));
if (!app) throw new Error('manager.html has no app script');

/* ---------------- 1. parity: the copies are the originals ---------------- */
const norm = s => s.replace(/^\s*\/\/.*$/gm, '').replace(/\s+/g, ' ').trim();
// A one-line `function f(){ ... }` has no brace ending its line, so the
// shared extractor reaches past it; take such a function as its own line.
const fnOf = (src, name, where) => {
  const m = new RegExp('^(?:async\\s+)?function\\s+' + name + '\\s*\\(.*$', 'm').exec(src);
  if (m) { let d = 0; for (const c of m[0]) { if (c === '{') d++; else if (c === '}') d--; }
    if (d === 0 && /\}\s*$/.test(m[0])) return m[0]; }
  return extractFunction(src, name, where);
};
const same = (name, src, where) => {
  const a = fnOf(app, name, 'manager.html'), b = fnOf(src, name, where);
  t.check(norm(a) === norm(b), `${name}() is ${where}'s, word for word`);
};
['goodsTotal', 'pricedView', 'chargeAmount', 'chargesTotal', 'cashTotal', 'creditCharge', 'quoteTotal', 'balanceDue', 'quoteItemSellPrice', 'lineHasRule', 'linePriceToConfirm',
  'effectiveMarkupRule', 'effectiveStockMarkupRule', 'applyRule', 'sellSideFor', 'productPriceRows', 'customerOrdersFor', 'outstandingInvoices',
  'custTerms', 'custBillAge', 'custOverdue', 'custLimit', 'custOverLimit', 'nmInvoiceSales', 'nmInvoicesIn', 'nmIsSale', 'salesTarget', 'payPlan', 'issueRowId',
  'supplierGroups', 'supplierTerms', 'confirmState'].forEach(n => same(n, salesSrc, 'sales.html'));
// How old a debt is (19 Oct 2026 report, fix 9): no longer the oldest open
// invoice's date (the sales desk's old custOldestAge), but the debt log's open
// charges -- accounts.html's custOpenCharges, word for word -- so the Manager,
// Sales and Accounts show one oldest age and one "over 30 days" figure.
same('custOpenCharges', accountsSrc, 'accounts.html');
same('custAging', accountsSrc, 'accounts.html');
{
  // custAging's bands are accounts.html's (k, lo, hi), and bandOf finds them the same way.
  const tri = src => [...src.matchAll(/\{ k: '(b\d+p?)',[^}]*?lo: (\d+), hi: (\d+|Infinity)/g)].map(m => m.slice(1).join(':')).slice(0, 4).join(' ');
  const accBands = accountsSrc.slice(accountsSrc.indexOf('const BANDS = ['), accountsSrc.indexOf('function bandOf'));
  t.check(tri(accBands) === 'b30:0:29 b60:30:59 b90:60:89 b90p:90:Infinity' && tri(app.slice(app.indexOf('const AGE_BANDS'))) === tri(accBands), "custAging's bands are accounts.html's: " + tri(accBands));
  t.check(norm(fnOf(app, 'bandOf', 'manager.html')).replace(/AGE_BANDS/g, 'BANDS') === norm(fnOf(accountsSrc, 'bandOf', 'accounts.html')), 'bandOf() is accounts.html\'s, on those bands');
}
t.check(/function custOldestAge\(c\)\{ return custAging\(c\)\.oldest; \}/.test(app), 'the oldest age is the debt log\'s (custAging), not an invoice date');
same('orderStageOverdue', adminSrc, 'index.html');
same('resetPickingProgress', workerSrc, 'shared-worker.js');
same('staffEligibleForRole', workerSrc, 'shared-worker.js');
{
  // The one change from the sales desk's goal: a personal goal (body.who) is not the shop's.
  const mine = norm(extractFunction(app, 'nmTargetRow', 'manager.html')), theirs = norm(extractFunction(salesSrc, 'nmTargetRow', 'sales.html'));
  t.check(mine === theirs.replace("return b.metric === 'sales' &&", "return !b.who && b.metric === 'sales' &&"), "the shop's goal is the sales desk's, with one person's goal left out of it");
}
{
  // The payment is the sales desk's customer payment: the same one write (0140 receive_payment), with the same arguments.
  // Sales sends it through payRpc, which adds the transaction ID (0155) only when one was typed: the arguments are compared.
  const grab = (src, where) => { const i = src.indexOf("ACT['slide:pay'] = async"); if (i < 0) throw new Error('no slide:pay in ' + where); const j = src.indexOf("('receive_payment', {", i); if (j < 0) throw new Error('no receive_payment in ' + where); const k = src.indexOf('}', j); return norm(src.slice(j, k + 1)); };
  t.check(grab(app, 'manager.html') === grab(salesSrc, 'sales.html'), 'a payment is the one write the sales desk makes, with the same arguments');
}

/* ---------------- the fixture: one shop on a Thursday ---------------- */
const SH = 'shop1', NOW = Date.now(), H = 3600e3, D = 864e5;
const iso = ms => { const d = new Date(ms); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const TODAY = iso(NOW), M0 = TODAY.slice(0, 8) + '01';
const monthEnd = (() => { const d = new Date(); const e = new Date(d.getFullYear(), d.getMonth() + 1, 0); return iso(e.getTime()); })();
const line = (lineId, qty, price, extra) => ({ lineId, productId: 'P1', variantIdx: null, productName: 'Iron sheet G28', unit: 'pc', packUnit: '', packQty: 0, qtyIn: 'unit', qty, supplierId: '__stock__', supplierName: 'Our stock', price, sellPrice: price, ...(extra || {}) });
function fixture(nSales){
  const sales = [['S1', 'Grace Akello', 'u2'], ['S2', 'Brian Ouma', 'u3'], ['S3', 'Faith Nankya', 'u4'], ['S4', 'Aisha N', 'u5'], ['S5', 'Peter S', 'u6']].slice(0, nSales == null ? 3 : nSales);
  return {
    suppliers: [{ id: 'SUP1', name: 'Kikuubo Steel', phone: '' }],
    staff: [{ id: 'M1', name: 'Sarah Nabirye', phone: '0772000001', role: 'manager', unavailable: false, userId: 'u1' },
      ...sales.map(([id, name, uid]) => ({ id, name, phone: '0772' + id.slice(1).padStart(6, '0'), role: 'sales', unavailable: false, userId: uid })),
      { id: 'B1', name: 'Okello James', phone: '0772300233', role: 'buyer', unavailable: false, userId: 'u9' },
      { id: 'W1', name: 'Musa Kato', phone: '0772300101', role: 'worker', unavailable: false, userId: null },
      { id: 'W2', name: 'Joy Atim', phone: '0772300102', role: 'worker', unavailable: false, userId: null },
      { id: 'D1', name: 'Ssali Paul', phone: '0772300377', role: 'delivery', unavailable: false, userId: null },
      { id: 'D2', name: 'Hassan L', phone: '', role: 'delivery', unavailable: true, userId: null }],
    customers: [
      { id: 'C1', name: 'Kyaligonza & Sons', phone: '0700111222', phone2: '', location: 'Najjera', notes: '', debt: 746000, termsDays: 7, creditLimit: 600000, debtLog: [{ id: 2, date: iso(NOW - 12 * D), type: 'charge', amount: 746000, note: 'Auto-sync — INV-0012', cashTxnId: null, quoteId: 12 }] },
      { id: 'C2', name: 'Mukono Roofing Centre', phone: '0700333444', phone2: '', location: 'Mukono', notes: '', debt: 1846000, termsDays: 7, creditLimit: 3000000, debtLog: [
        { id: 3, date: iso(NOW - 26 * D), type: 'charge', amount: 1120000, note: 'Auto-sync — INV-0010', cashTxnId: null, quoteId: 10 },
        { id: 4, date: iso(NOW - 15 * D), type: 'charge', amount: 726000, note: 'Auto-sync — INV-0011', cashTxnId: null, quoteId: 11 },
        { id: 5, date: iso(NOW - 13 * D), type: 'charge', amount: 1000000, note: 'Auto-sync — INV-0009', cashTxnId: null, quoteId: 9 },
        { id: 1, date: iso(NOW - 12 * D), type: 'payment', amount: 1000000, note: '', cashTxnId: null, quoteId: 9 }] },
      { id: 'C3', name: 'Nansana Hardware', phone: '', phone2: '', location: '', notes: '', debt: 0, termsDays: null, creditLimit: null, debtLog: [] },
    ],
    products: [{ id: 'P1', name: 'Iron sheet G28', variants: [] }],
    prices: [], stock: {}, stockLots: {},
    savedQuotes: [
      // invoiced bills
      { id: 10, status: 'completed', invoiced: true, invoicedAt: iso(NOW - 26 * D), date: iso(NOW - 26 * D), amountPaid: 0, voided: false, client: { name: 'Mukono Roofing Centre' }, customerId: 'C2', items: [line(1, 10, 112000)], charges: [], payments: [], debtCharged: 1120000, takenBy: 'u3' },
      { id: 11, status: 'completed', invoiced: true, invoicedAt: iso(NOW - 15 * D), date: iso(NOW - 15 * D), amountPaid: 0, voided: false, client: { name: 'Mukono Roofing Centre' }, customerId: 'C2', items: [line(1, 6, 121000)], charges: [], payments: [], debtCharged: 726000, takenBy: 'u3' },
      { id: 12, status: 'completed', invoiced: true, invoicedAt: iso(NOW - 12 * D), date: iso(NOW - 12 * D), amountPaid: 0, voided: false, client: { name: 'Kyaligonza & Sons' }, customerId: 'C1', items: [line(1, 4, 186500)], charges: [], payments: [], debtCharged: 746000, takenBy: 'u3' },
      { id: 13, status: 'completed', invoiced: true, invoicedAt: TODAY, date: TODAY, amountPaid: 2000000, voided: false, client: { name: 'Nansana Hardware' }, customerId: 'C3', items: [line(1, 20, 100000)], charges: [], payments: [], takenBy: 'u2', deliveredAt: NOW - H, deliveredPhoto: 'p.jpg', assignedDeliveryId: 'D1' },
      // on the move
      { id: 20, status: 'draft', invoiced: false, voided: false, client: { name: 'Kyaligonza & Sons' }, customerId: 'C1', items: [line(1, 6, 186000)], charges: [], payments: [], takenBy: 'u3', createdAt: new Date(NOW - 20 * 60e3).toISOString(), stageEnteredAt: NOW - 20 * 60e3, stageLog: [{ status: 'draft', at: NOW - 20 * 60e3 }] },
      { id: 21, status: 'preparing', invoiced: false, voided: false, client: { name: 'Namuli General Stores' }, customerId: null, items: [line(1, 20, 34980, { pickStatus: 'picked', pickedQty: 20 })], charges: [], payments: [], takenBy: 'u2', createdAt: new Date(NOW - 7 * H).toISOString(), stageEnteredAt: NOW - 3 * H - 10 * 60e3,
        stageLog: [{ status: 'draft', at: NOW - 7 * H }, { status: 'awaiting_goods', at: NOW - 6.5 * H }, { status: 'preparing', at: NOW - 3 * H - 10 * 60e3 }], assignedWorkerId: 'W1', pickingStatus: 'awaiting_accept', pickingAssignedAt: NOW - 3 * H, pickCursor: 1, workerAcceptedAt: null, pickingDoneAt: null },
      { id: 22, status: 'pending_delivery', invoiced: false, voided: false, client: { name: 'Ggaba Stores' }, customerId: null, items: [line(1, 2, 35500)], charges: [], payments: [], takenBy: 'u4', createdAt: new Date(NOW - 8 * H).toISOString(), stageEnteredAt: NOW - 5 * H, stageLog: [], assignedDeliveryId: 'D1', carrier: { kind: 'staff', name: 'Ssali Paul' } },
      { id: 23, status: 'awaiting_goods', invoiced: false, voided: false, client: { name: 'Lubowa Builders' }, customerId: null, items: [line(1, 5, 196000, { supplierId: 'SUP1' })], charges: [], payments: [], takenBy: 'u2', createdAt: new Date(NOW - 2 * D).toISOString(), stageEnteredAt: NOW - 26 * H, stageLog: [] },
      { id: 24, status: 'draft', invoiced: false, voided: false, client: { name: 'Mukono Roofing Centre' }, customerId: 'C2', items: [line(1, 4, 160000)], charges: [], payments: [], takenBy: 'u3', createdAt: new Date(NOW - 2 * H).toISOString(), stageEnteredAt: NOW - 2 * H, stageLog: [] },
    ],
    cashTxns: [{ id: 501, date: TODAY, account: 'cash', type: 'receipt', category: 'Debt Payment', amount: 2000000, description: '', time: '09:10', quoteId: 13, enteredBy: 'u2' }],
    collectionTrips: [{ id: 'T1', supplierId: 'SUP1', status: 'assigned', assignedWorkerId: 'B1', createdAt: new Date(NOW - 5 * H).toISOString(), assignedAt: new Date(NOW - 5 * H).toISOString(), lines: [{ orderId: 23, lineId: 1, qty: 5 }], voided: false }],
    targets: [{ id: 1, date: M0, status: 'open', body: { metric: 'sales', aim: 1000000, from: M0, to: monthEnd } }, { id: 2, date: M0, status: 'open', body: { metric: 'sales', aim: 5000000, from: M0, to: monthEnd, who: 'u3' } }],
    statementsSent: [], promises: [{ id: 1, customerId: 'C2', promisedOn: iso(NOW - 10 * D), madeOn: iso(NOW - 14 * D), amount: 1000000 }],
    presetCreditPct: 0, presetDefaultMarkup: {}, presetChaseAfterDays: 7, presetOrderStageLimits: { draft: 120, awaiting_goods: 1440, preparing: 60, pending_delivery: 120 }, presetCreditHold: null, presetShopAddress: '', presetShopPhone: '',
  };
}

/* ---------------- the page, in a sandbox ---------------- */
function fakeDb(tables){
  const writes = [];
  function Q(table){ this.t = table; this.f = []; this.op = 'select'; this.one = false; }
  Q.prototype.select = function(){ return this; };
  Q.prototype.eq = function(k, v){ this.f.push(r => String(r[k]) === String(v)); return this; };
  Q.prototype.gt = Q.prototype.gte = Q.prototype.neq = Q.prototype.order = Q.prototype.limit = function(){ return this; };
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
  let nextId = 1000;
  return { writes, tables, auth: { getUser: () => new Promise(() => {}), getSession: async () => ({ data: { session: null } }), signOut: async () => ({}) }, from: tb => new Q(tb),
    rpc: async (fn, args) => { // 0165: the apps change an order through ow_patch_order
      if (fn === 'ow_patch_order') { const qs = tables.saved_quotes || (tables.saved_quotes = []), r = qs.find(x => String(x.id) === String(args.p_id)); if (!r) return { data: null, error: { message: 'This order is no longer in the books.' } }; const pl = { ...(r.payload || {}), ...JSON.parse(JSON.stringify(args.p_patch || {})) }; (args.p_drop || []).forEach(k => { delete pl[k]; }); const row = { payload: pl }; if (args.p_status != null) row.status = args.p_status; writes.push(['update', 'saved_quotes', JSON.parse(JSON.stringify(row)), [r.id]]); Object.assign(r, row); return { data: JSON.parse(JSON.stringify(r)), error: null }; }  if (fn === 'receive_payment') { writes.push(['rpc', fn, args]); return fakeReceivePayment(tables, writes, () => ++nextId, args, 'u1'); } if (fn !== 'next_row_id_blocks') return { data: null, error: { message: 'no rpc ' + fn } }; const k = args.p_kinds[0]; nextId = Math.max(nextId, Number(args.p_floors[k]) || 0) + 1; return { data: { [k]: nextId }, error: null }; } };
}
function page(db, data, role){
  const el = () => ({ innerHTML: '', textContent: '', value: '', children: [], style: {}, dataset: {}, classList: { add() {}, remove() {}, toggle() {} }, setAttribute() {}, querySelector: () => null, querySelectorAll: () => [], appendChild() {}, remove() {}, focus() {} });
  const store = {};
  const sandbox = {
    console, setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, requestAnimationFrame: () => 0, Promise, Date, Math, JSON, URLSearchParams, encodeURIComponent, isFinite, isNaN,
    location: { hostname: 'localhost', hash: '', reload() {} },
    localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
    navigator: {}, matchMedia: () => ({ matches: true }),
    document: { getElementById: el, querySelector: () => null, querySelectorAll: () => [], addEventListener() {}, createElement: el, body: { appendChild() {}, style: {} }, documentElement: { classList: { toggle() {} } }, visibilityState: 'visible', activeElement: null },
    supabase: { createClient: () => db },
  };
  sandbox.window = sandbox; sandbox.window.open = () => {}; sandbox.window.addEventListener = () => {};
  vm.createContext(sandbox);
  vm.runInContext(app + '\n;globalThis.__x = { S, ACT, PAGE, SHEET, D, render, renderSheet, viewToday, viewTeam, viewOrders, viewMoney, holderOf, whyStuck, stuckOrders, isStuck, heldOrders, heldWaiting, creditCase, debtBands, debtors, lastSeller, personGoal, salesTarget, teamMonth, stageTimes, promiseState, rowToQuote, handToPacker, handToDriver, changeOrder, quoteTotal, balanceDue, custOldestAge, team, payPlan, customerById, showWin, candidatesFor, needsYou, custAging, custOpenCharges, knownBill, packedOrdersToday, floorHTML };', sandbox);
  const X = sandbox.__x;
  Object.assign(X.S, { data: data || fixture(), shopId: SH, user: { id: 'u1', email: 'sarah@shop.ug' }, shopName: 'Mukasa Hardware', role: role || 'manager', started: true,
    tasks: ['order.move', 'order.assign', 'credit.release', 'team.nudge', 'customer.edit', 'payment.receive', 'statement.send'] });
  return X;
}
const quoteRow = (q) => {
  const { id, status, invoiced, invoicedAt, amountPaid, voided, date, ...payload } = q;
  return { id, shop_id: SH, status, invoiced: !!invoiced, invoiced_at: invoicedAt || null, invoiced_ts: null, amount_paid: amountPaid || 0, voided: !!voided, date: date || TODAY, client_name: q.client.name, client_phone: null, payload };
};

/* ---------------- 2-5 ---------------- */
(async () => {
  // reading the team's day
  {
    const X = page(fakeDb({}));
    const ids = X.stuckOrders().map(q => q.id);
    t.check(ids.includes(21) && ids.includes(22) && ids.includes(23) && !ids.includes(20), 'stuck is the owner\'s stage timer: past the limit, oldest first; a fresh order is not stuck');
    const q21 = X.D().savedQuotes.find(q => q.id === 21);
    t.check(X.holderOf(q21).staff.id === 'W1' && /not taken by Musa/.test(X.whyStuck(q21).w), 'a pick offered and not taken says who has it and why');
    t.check(/no trip|trip/.test(X.whyStuck(X.D().savedQuotes.find(q => q.id === 23)).w) && X.holderOf(X.D().savedQuotes.find(q => q.id === 23)).staff.id === 'B1', 'an order being bought in is held by the buyer on its trip');
    const times = X.stageTimes(q21);
    t.check(Math.round(times.draft) === 30 && Math.round(times.awaiting_goods) === 200 && Math.round(times.preparing) === 190, 'time in each stage comes from the order\'s own stage log');
    // An order from before the stage log: only the stage it is in has a time,
    // from when it entered it -- the earlier ones are not recorded, not "skipped".
    const q22 = X.D().savedQuotes.find(q => q.id === 22), t22 = X.stageTimes(q22);
    t.check(Math.round(t22.pending_delivery) === 300 && !t22.draft && !t22.preparing && t22.timed === false, 'with no stage log, the stage it is in is timed from when it entered it, and the rest are not recorded');
    // Delivery can go to anybody the owner's board would offer: a picker drives too.
    const drv = X.candidatesFor(q22).map(c => c.p.id);
    t.check(drv[0] === 'D1' && drv.includes('W1') && drv.includes('W2') && !drv.includes('S1') && !drv.includes('B1'), 'a delivery can be handed to a driver or a picker, drivers first, never sales or the buyer');
    const held = X.heldOrders().map(x => x.q.id);
    t.check(held.includes(20) && held.includes(24), 'held for credit: over the limit (Kyaligonza) and owing past the hold line (Mukono, 26 days)');
    const k = X.creditCase(X.D().savedQuotes.find(q => q.id === 20));
    t.check(k.over && !k.old && k.withIt === 746000 + 1116000 && k.limit === 600000, 'the limit check counts what they owe plus this order');
    const m = X.creditCase(X.D().savedQuotes.find(q => q.id === 24));
    t.check(m.old && m.age === 26 && !m.over, 'the age check is the oldest open bill against the hold line (21 days unless the owner sets one)');
    const bands = X.debtBands(X.debtors());
    // The owner's bands (Round 3): under 7 · 8–21 · 22–30 · over 30. Kyaligonza's 12-day bill and Mukono's
    // 15-day bill are 8–21; Mukono's 26-day bill is 22–30, past the 21-day hold line.
    t.check(bands[0] === 0 && bands[1] === 746000 + 726000 && bands[2] === 1120000 && bands[3] === 0 && bands.unknown === 0, 'debts are aged by their open charges into the owner\'s 7/21/30 bands: ' + bands.join(', '));
    t.check(X.lastSeller(X.customerById('C2')).id === 'S2', 'who last sold to a customer is the taker of their newest order');
    const tg = X.salesTarget();
    const inMonth = X.D().savedQuotes.filter(q => q.invoiced && !q.voided && q.invoicedAt >= M0).reduce((a, q) => a + X.quoteTotal(q), 0);
    t.check(tg && tg.aim === 1000000 && inMonth > 0 && tg.actual === inMonth && tg.reached, 'the team goal is the owner\'s shop goal, not a personal one');
    const pg = X.personGoal('u3');
    t.check(pg && pg.aim === 5000000 && pg.actual === 1120000 + 726000 + 746000 - 0 - (1120000 + 726000 + 746000 - X.D().savedQuotes.filter(q => q.takenBy === 'u3' && q.invoiced && q.invoicedAt >= M0).reduce((s, q) => s + q.items.reduce((a, it) => a + it.qty * it.sellPrice, 0), 0)), 'one person\'s goal is measured on what they took that was invoiced in its range');
    t.check(X.promiseState(X.D().promises[0], X.customerById('C2')) === 'kept', 'a promise is kept when payments after it was made reach it by the date');
  }
  // 2. handing over a pick
  {
    const data = fixture(), db = fakeDb({ saved_quotes: data.savedQuotes.map(quoteRow) }), X = page(db, data);
    X.S.sheet = { type: 'reassign', args: { id: 21 } };
    await X.ACT.rgo({ dataset: { id: 'W2' } });
    const r = db.tables.saved_quotes.find(x => x.id === 21), p = r.payload;
    t.check(p.assignedWorkerId === 'W2' && p.pickingStatus === 'awaiting_accept' && typeof p.pickingAssignedAt === 'number' && p.pickingAssignedAt > NOW - 6e4, 'the pick is offered to the new packer, as setPacker does');
    t.check(p.pickCursor === 0 && p.workerAcceptedAt === null && p.pickingDoneAt === null && p.items[0].pickStatus === null && p.items[0].pickedQty === null, 'and starts again from the first line (resetPickingProgress)');
    t.check(r.status === 'preparing' && p.takenBy === 'u2' && p.stageEnteredAt === data.savedQuotes.find(q => q.id === 21).stageEnteredAt, 'the stage and its clock are left alone — it is still the customer\'s wait');
    const up = db.writes.filter(w => w[0] === 'update');
    t.check(up.length === 1 && Object.keys(up[0][2]).join() === 'payload', 'one write, the payload only');
    t.check(X.S.sheet.args.done === 'W2' && X.S.sheet.args.from === 'W1', 'the sheet says who has it now');
  }
  // 2b. a delivery to another driver; an order that already moved is left alone
  {
    const data = fixture(); data.staff.push({ id: 'D3', name: 'Moses K', phone: '', role: 'delivery', unavailable: false, userId: null });
    const db = fakeDb({ saved_quotes: data.savedQuotes.map(quoteRow) }), X = page(db, data);
    await X.ACT.handover({ dataset: { id: '22', to: 'D3' } });
    const p = db.tables.saved_quotes.find(x => x.id === 22).payload;
    t.check(p.assignedDeliveryId === 'D3' && p.carrier.kind === 'staff' && p.carrier.name === 'Moses K' && p.carrier.by === 'manager', 'a delivery goes to the new driver as assignCarrier writes it');
    db.tables.saved_quotes.find(x => x.id === 21).status = 'pending_delivery';
    const before = db.writes.length;
    X.S.sheet = { type: 'reassign', args: { id: 21 } };
    await X.ACT.rgo({ dataset: { id: 'W2' } });
    t.check(db.writes.length === before && !X.S.sheet.args.done, 'a pick that has already gone out is not handed over');
  }
  // 2c. a trip to another buyer
  {
    const data = fixture(); data.staff.push({ id: 'B2', name: 'Peter Buyer', phone: '', role: 'buyer', unavailable: false, userId: null });
    const trips = [{ id: 'T1', shop_id: SH, supplier_id: 'SUP1', status: 'assigned', assigned_worker_id: 'B1', assigned_at: 'x', accepted_at: 'y', lines: [], voided: false }];
    const db = fakeDb({ collection_trips: trips }), X = page(db, data);
    X.S.sheet = { type: 'reassign', args: { id: 'T1', kind: 'trip' } };
    await X.ACT.rgo({ dataset: { id: 'B2' } });
    const r = db.tables.collection_trips[0];
    t.check(r.assigned_worker_id === 'B2' && r.status === 'assigned' && r.accepted_at === null && r.assigned_at !== 'x', 'a trip not yet out goes to the other buyer, waiting for them to take it');
    r.status = 'collecting';
    const before = db.writes.length;
    X.S.sheet = { type: 'reassign', args: { id: 'T1', kind: 'trip' } };
    await X.ACT.rgo({ dataset: { id: 'B1' } });
    t.check(db.writes.length === before, 'a trip already out collecting is not taken off the buyer riding it');
  }
  // 3. a held order: release, hold, cash first
  {
    const data = fixture(), db = fakeDb({ saved_quotes: data.savedQuotes.map(quoteRow) }), X = page(db, data);
    X.S.ui.hold = 0;
    await X.ACT.hdecide({ dataset: { v: 'release' } });
    const p = db.tables.saved_quotes.find(x => x.id === 24).payload.creditCheck || db.tables.saved_quotes.find(x => x.id === 20).payload.creditCheck;
    t.check(p && p.decision === 'release' && p.by === 'u1' && typeof p.at === 'number', 'the yes is written on the order with who and when');
    const r = db.tables.saved_quotes.find(x => x.payload.creditCheck);
    t.check(r.status === 'draft' && Object.keys(db.writes.filter(w => w[0] === 'update')[0][2]).join() === 'payload', 'and nothing else: the order stays where the board has it, its status untouched');
    X.S.ui.hold = 1;
    await X.ACT.hdecide({ dataset: { v: 'cash' } });
    t.check(db.tables.saved_quotes.filter(x => x.payload.creditCheck).map(x => x.payload.creditCheck.decision).sort().join() === 'cash,release', 'cash-first is written the same way');
    const Y = page(fakeDb({ saved_quotes: data.savedQuotes.map(quoteRow) }), fixture());
    Y.S.tasks = [];
    t.check(/not on for this login/.test(Y.PAGE.approvals({})) && !/data-act="hdecide"/.test(Y.PAGE.approvals({})), 'without credit.release the yes is shown locked, not offered');
  }
  // 4. a payment, oldest bill first
  {
    const data = fixture(), rows = { saved_quotes: data.savedQuotes.map(quoteRow), customers: [{ id: 'C2', shop_id: SH, debt: 1846000 }], cash_txns: [], customer_debt_log: [] };
    const db = fakeDb(rows), X = page(db, data);
    X.S.stack = [{ type: 'pay', args: { id: 'C2', amt: 1300000, method: 'mobile' } }];
    await X.ACT['slide:pay']();
    const cash = db.tables.cash_txns;
    t.check(cash.length === 2 && cash[0].amount === 1120000 && cash[0].quote_id === 10 && cash[1].amount === 180000 && cash[1].quote_id === 11, 'a receipt per bill, the oldest cleared first: ' + cash.map(c => c.amount).join(' + '));
    t.check(cash.every(c => c.type === 'receipt' && c.category === 'Debt Payment' && c.account === 'mobile' && c.entered_by === 'u1'), 'each a customer payment, by the method chosen, in the manager\'s name');
    const b10 = db.tables.saved_quotes.find(x => x.id === 10), b11 = db.tables.saved_quotes.find(x => x.id === 11);
    t.check(b10.amount_paid === 1120000 && b10.payload.payments.length === 1 && b10.payload.payments[0].cashTxnId === cash[0].id && b10.payload.debtCharged === 0, 'the oldest bill is paid in full, its payment line pointing at its receipt');
    t.check(b11.amount_paid === 180000 && b11.payload.debtCharged === 546000, 'the next bill takes the rest, and carries what is still owed on it');
    t.check(db.tables.customers[0].debt === 546000 && db.tables.customer_debt_log.length === 2 && db.tables.customer_debt_log.every(l => l.type === 'payment'), 'what they owe comes down by the payment, each step logged as a payment');
    t.check(X.S.stack[0].type === 'paid' && X.S.stack[0].args.after === 546000, 'and the page turns into Paid, with what is still owed');
    const Y = page(fakeDb(JSON.parse(JSON.stringify(rows))), fixture());
    Y.S.tasks = []; Y.S.stack = [{ type: 'pay', args: { id: 'C2', amt: 100000 } }];
    await Y.ACT['slide:pay']();
    t.check(Y.S.stack[0].type === 'pay', 'without payment.receive nothing is recorded');
  }
  // 9 (19 Oct 2026 report). How old a debt is: the debt log's open charges, the
  // rule Accounts uses; what has no date is "no date", never aged, never new.
  {
    const data = fixture();
    const ch = (id, days, amount, quoteId) => ({ id, date: days == null ? null : iso(NOW - days * D), type: 'charge', amount, note: '', cashTxnId: null, quoteId });
    data.customers.push(
      { id: 'C4', name: 'Sadat', phone: '', phone2: '', location: '', notes: '', debt: 310000, termsDays: null, creditLimit: null, debtLog: [] },
      { id: 'C5', name: 'Ken Bwaise', phone: '', phone2: '', location: '', notes: '', debt: 800000, termsDays: null, creditLimit: null, debtLog: [ch(40, 40, 500000, 40), ch(41, 5, 300000, 41)] },
      { id: 'C6', name: 'Hajat Faluk', phone: '', phone2: '', location: '', notes: '', debt: 200000, termsDays: null, creditLimit: null, debtLog: [ch(42, null, 200000, 42)] },
      { id: 'C7', name: 'Ssendawula Sam', phone: '', phone2: '', location: '', notes: '', debt: 900000, termsDays: null, creditLimit: null,
        debtLog: [ch(43, 45, 600000, 43), { id: 44, date: iso(NOW - 20 * D), type: 'payment', amount: 600000, note: '', cashTxnId: null, quoteId: null }, ch(45, 14, 900000, 45)] });
    // Ken's invoice is dated 60 days back: the old invoice-date age would say 60.
    data.savedQuotes.push({ id: 40, status: 'completed', invoiced: true, invoicedAt: iso(NOW - 60 * D), date: iso(NOW - 60 * D), amountPaid: 0, voided: false, client: { name: 'Ken Bwaise' }, customerId: 'C5', items: [line(1, 8, 100000)], charges: [], payments: [], takenBy: 'u2' });
    const X = page(fakeDb({}), data), cu = id => X.customerById(id);
    t.check(X.custOldestAge(cu('C5')) === 40, 'the oldest age is the oldest open charge on the log (40 days), not the invoice date (60)');
    const a4 = X.custAging(cu('C4')), a6 = X.custAging(cu('C6'));
    t.check(a4.unknown === 310000 && a4.oldest === 0 && a6.unknown === 200000 && a6.oldest === 0 && a6.parts.b30 === 0, 'a debt the log does not cover, or a charge with no date, is "no date" — not aged 0, not counted as new');
    t.check(X.custOldestAge(cu('C7')) === 14, 'a payment pays the oldest charge first, so what is left is 14 days old');
    const bands = X.debtBands(X.debtors());
    t.check(bands.unknown === 510000 && bands[0] === 300000 && bands[3] === 500000, 'the HOW OLD bands come from the open charges, with "no date" its own part: ' + bands.join(', ') + ' · no date ' + bands.unknown);
    const old = X.needsYou().rest.find(n => n.k === 'old');
    t.check(old && old.n === 1 && old.v === 500000, 'Watch "owing 30+ days" is the part aged 30 days or more (500,000), not the whole debt of anyone with an old bill');
    X.S.ui.mside = 'out';
    const money = X.viewMoney();
    t.check(/over 30 days 500K, no date 510K;/.test(money) && /<b style="color:var\(--navyInk\)">510K<\/b>no date<\/span>/.test(money), 'Money › How old draws a "no date" segment of its own (510K), not "under 7d"');
    t.check(!/no dated bill/.test(money) && /white-space:nowrap;color:var\(--ink3\)">no date</.test(money), 'a debtor with nothing dated reads "no date" where the age goes, never as new');
    t.check(/>no date</.test(X.PAGE.debtor({ id: 'C4' })) && /200,000<\/span> of it has no date/.test(X.PAGE.debtor({ id: 'C6' })), 'one customer: "no date" instead of an oldest age, and the undated part named under the bills');
    // The same figures Accounts shows: accounts.html's own functions, run on the same customers.
    const pick = name => { const i = accountsSrc.indexOf(name); return accountsSrc.slice(i, accountsSrc.indexOf('\n}\n', i) + 2); };
    const accCode = [accountsSrc.slice(accountsSrc.indexOf('const BANDS = ['), accountsSrc.indexOf('function bandOf')), fnOf(accountsSrc, 'bandOf', 'accounts.html'), fnOf(accountsSrc, 'daysBetween', 'accounts.html'),
      fnOf(app, 'todayISO', 'manager.html'), pick('function custOpenCharges(c){'), pick('function custAging(c){'), 'const memo = (n, a, f) => f();', 'globalThis.__a = { custAging };'].join('\n');
    const box = { Math, Number, String, Date, Infinity }; vm.createContext(box); vm.runInContext(accCode, box);
    const agree = data.customers.filter(c => c.debt > 0).every(c => { const A = box.__a.custAging(c), M = X.custAging(cu(c.id)), over = p => p.b60 + p.b90 + p.b90p;
      return A.oldest === X.custOldestAge(cu(c.id)) && over(A.parts) === over(M.parts) && A.unknown === M.unknown; });
    t.check(agree, 'for every customer the Manager shows the oldest age, the "over 30 days" amount and the "no date" part Accounts shows');
  }
  // 12. The short-pick sheet bills what Sales shows: priced lines only, and the count still to price -- never a cost total.
  {
    const data = fixture();
    data.savedQuotes.push({ id: 30, status: 'preparing', invoiced: false, voided: false, client: { name: 'Walk-in' }, customerId: null,
      items: [line(1, 10, 100000, { pickStatus: 'short', pickedQty: 6 }), line(2, 3, 50000, { productName: 'Glass Door Locks', sellPrice: null, pickStatus: 'done' })],
      charges: [], payments: [], takenBy: 'u2', createdAt: new Date(NOW - 2 * H).toISOString(), stageEnteredAt: NOW - H, stageLog: [] });
    const db = fakeDb({ saved_quotes: data.savedQuotes.map(quoteRow) }), X = page(db, data);
    const kb = X.knownBill(X.D().savedQuotes.find(q => q.id === 30));
    t.check(kb.total === 1000000 && kb.toPrice === 1, 'an order bills its priced lines only, with one line to price');
    const sheet = X.PAGE.shortpick({ id: 30 });
    t.check(/600,000 \+ 1 to price/.test(sheet) && /1,000,000 \+ 1 to price/.test(sheet) && !/750,000|1,150,000/.test(sheet), 'both choices show the known total and "+ 1 to price", never the line at cost');
    await X.ACT.spgo({ dataset: { id: '30' } });
    t.check(X.S.ui.spDone && X.S.ui.spDone.total === 600000 && X.S.ui.spDone.toPrice === 1 && /The order now bills 600,000 \+ 1 to price/.test(X.PAGE.shortpick({ id: 30 })), '"The order now bills" is the known total and the unpriced count');
  }
  // 8 (second half). Team › Buying counts the suppliers' own deliveries; "packed today" counts every order packed today.
  {
    const data = fixture(), recent = NOW - 60e3;
    data.collectionTrips.push({ id: 'T2', supplierId: 'SUP1', status: 'collected', assignedWorkerId: '__supplier__', createdAt: new Date(NOW - 2 * 60e3).toISOString(), collectedAt: new Date(recent).toISOString(), lines: [], voided: false },
      { id: 'T3', supplierId: 'SUP1', status: 'collecting', assignedWorkerId: '__supplier__', createdAt: new Date(NOW - 2 * 60e3).toISOString(), lines: [], voided: false });
    data.savedQuotes.push({ id: 31, status: 'pending_delivery', invoiced: false, voided: false, client: { name: 'Walk-in' }, customerId: null, items: [line(1, 1, 1000)], charges: [], payments: [], takenBy: 'u2', assignedWorkerId: null, pickingStatus: 'done', pickingDoneAt: recent, stageLog: [] },
      { id: 32, status: 'completed', invoiced: false, voided: false, client: { name: 'Walk-in' }, customerId: null, items: [line(1, 1, 1000)], charges: [], payments: [], takenBy: 'u2', pickingDoneAt: null,
        stageLog: [{ status: 'preparing', at: NOW - 3 * 60e3 }, { status: 'pending_delivery', at: recent }] });
    const X = page(fakeDb({}), data), floor = X.floorHTML(X.team());
    t.check(/Suppliers/.test(floor) && /delivering to us/.test(floor) && /1 arrived today/.test(floor) && /1<\/span> on the way/.test(floor), 'Buying shows the suppliers\' deliveries: one arrived today, one on the way');
    const ids = X.packedOrdersToday().map(q => q.id).sort();
    t.check(ids.join() === '31,32' && />2<\/span> packed today/.test(floor), 'packed today counts every order packed today, whoever packed it, by pickingDoneAt or the stage log');
  }
  // 18. The month's team sales are invoiced-only, and the card says so.
  {
    const X = page(fakeDb({}), fixture());
    t.check(/Sales invoiced · /.test(X.viewToday()) && / invoiced<\/span>/.test(X.viewTeam()), 'the team\'s month is labelled "invoiced" on Today and Team');
  }
  // 5. every screen draws
  for (const n of [0, 1, 3, 5]) {
    const X = page(fakeDb({}), fixture(n));
    const draw = (label, f) => { try { const out = f(); t.check(typeof out === 'string' && out.length > 50, `${label} draws (${n} salespeople)`); return out; } catch (e) { t.check(false, `${label} draws (${n} salespeople): ${e.message}`); return ''; } };
    draw('Today', X.viewToday);
    const team = draw('Team', X.viewTeam);
    if (n === 5) t.check(/\+2 more/.test(team), 'five salespeople: the three furthest behind, the rest folded');
    if (n === 1) t.check(/mx-pcard one/.test(team), 'one salesperson: one wide ring card');
    ['stuck', 'all', 'done'].forEach(s => { X.S.ui.show = s; draw('Orders · ' + s, X.viewOrders); });
    ['old', 'promised', 'limit'].forEach(s => { X.S.ui.money = s; draw('Money · ' + s, X.viewMoney); });
    X.S.ui.money = 'old'; X.S.ui.area = 'Mukono'; draw('Money · one area', X.viewMoney); X.S.ui.area = '';
    draw("The team's day", () => X.PAGE.teamday({}));
    X.D().staff.forEach(s => draw('Person ' + s.name, () => X.PAGE.person({ id: s.id })));
    X.D().savedQuotes.forEach(q => draw('Order ' + q.id, () => X.PAGE.order({ id: q.id })));
    X.D().customers.forEach(c => draw('Customer ' + c.name, () => X.PAGE.debtor({ id: c.id })));
    draw('Needs a yes', () => X.PAGE.approvals({}));
    draw('Take a payment', () => X.PAGE.pay({ id: 'C2' }));
    draw('Paid', () => X.PAGE.paid({ name: 'Mukono', amount: 1000, method: 'cash', time: '10:00', bills: [{ label: 'INV-0010', pay: 1000, cleared: true }], before: 2000, after: 1000, phone: '07', receipt: true }));
    draw('You', () => X.PAGE.me({}));
    draw('Nudge', () => X.SHEET.nudge({}));
    draw('Nudge one person about one order', () => X.SHEET.nudge({ who: 'W1', order: 21 }));
    draw('Hand over a pick', () => X.SHEET.reassign({ id: 21 }));
    draw('Hand over a delivery', () => X.SHEET.reassign({ id: 22 }));
    draw('Give a trip', () => X.SHEET.reassign({ id: 'T1', kind: 'trip' }));
  }
  {
    const X = page(fakeDb({}), fixture());
    const s = X.SHEET.nudge({ who: 'W1', order: 21 });
    t.check(/wa\.me\/256772300101\?text=/.test(s) && /Namuli General Stores/.test(s), 'a nudge opens WhatsApp to their own number, written about the order holding them up');
    t.check(!/Cost|margin/i.test(X.viewToday() + X.viewMoney() + X.PAGE.order({ id: 21 })), 'costs and margins are never drawn');
  }
  // Sales round 2 (0167): credit with no limit set is the Manager's yes; a test payment is never money here.
  t.check(/const noLimit = !\(limit > 0\) && !!q\.credit && Number\(q\.credit\.pct\) > 0;\s*if \(!over && !old && !noLimit\) return null;/.test(app), 'SAL-016: an order on credit for a customer with no limit set waits for the Manager');
  t.check(/no credit limit set/.test(app) && /\.map\(rowToTxn\)\.filter\(t => !t\.qa\)/.test(app) && /qa: !!q\.qa/.test(app), 'SAL-016/018: the hold says no limit is set; test payments and orders are in no figure');
  t.check(/\.map\(rowToTxn\)\.filter\(t => !t\.qa\)/.test(accountsSrc), 'SAL-018: Accounts\' cash book leaves test payments out (they were never cash)');
  process.exit(t.done() ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
