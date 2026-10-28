#!/usr/bin/env node
'use strict';
/*
 * Manager round 1 · data and money integrity (docs/audit/manager/ROUND-1.md),
 * the money screens in manager.html:
 *
 *   MGR-DATA-02  What a customer owes is one figure, from the books
 *                (custBalance: opening lines + each invoice's due), on
 *                To collect, the chase card, the debtor sheet and the pay
 *                screen; a stored balance that disagrees says so and asks
 *                Accounts (payment_asks, what 'balance'): sending, sent, no
 *                signal, error, corrected. Eddy (stored 0, #0390 540,000)
 *                is listed; Sadat's old-book 290,000 is an Opening balance.
 *   MGR-DATA-07  A void with money on it asks Refund or Keep as deposit,
 *                can't go without an answer, holds 10 s with Undo, and is
 *                one write: void_with_money (0169).
 *   MGR-DATA-11  A payment dated before its order warns, and is recorded as
 *                a Deposit (p_date, p_label); the order lists "Deposit · day".
 *   MGR-DATA-12  The default markup is the saved one; none saved or 0 is
 *                no default, and then there is no "Shop's" price.
 *   MGR-DATA-15  A bill under 1,000 gets a second look: Bill it / Fix the order.
 *
 * Run: node test/manager-round1-money.test.js   (or: npm test)
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { createReporter } = require('./_extract');
const { fixture, ALL, NOW, DAY, iso } = require('./_manager-decide-fixture');

const t = createReporter('manager round 1 money');
const html = fs.readFileSync(path.join(__dirname, '..', 'manager.html'), 'utf8');
const app = [...html.matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]).filter(s => /const S = \{/.test(s)).join('\n');
const SH = 'shop1', H = 3600e3;

const L = (lineId, pid, name, qty, cost, sell) => ({ lineId, productId: pid, variantIdx: null, productName: name, unit: 'pc', packUnit: '', packQty: 0, qtyIn: 'unit', qty, supplierId: '__stock__', supplierName: 'Our stock', price: cost, sellPrice: sell });
const bill = (id, cid, name, daysAgo, total, paid, extra) => ({ id, status: 'completed', invoiced: true, invoicedAt: iso(NOW - daysAgo * DAY), date: iso(NOW - daysAgo * DAY), amountPaid: paid || 0, voided: false, client: { name }, customerId: cid,
  items: [L(1, 'P1', 'Iron sheet G28 · 3 m', 1, Math.round(total * 0.8), total)], charges: [], payments: [], takenBy: 'u2', createdAt: new Date(NOW - daysAgo * DAY - 5 * H).toISOString(), deliveredAt: NOW - daysAgo * DAY, ...(extra || {}) });
const cust = (id, name, debt, debtLog) => ({ id, name, phone: '0700' + id.replace(/\D/g, '').padEnd(6, '1'), phone2: '', location: 'Bwaise', notes: '', debt, termsDays: 7, creditLimit: null, debtLog: debtLog || [] });

// The brief's cases on top of the canvas shop.
function data(){
  const d = fixture();
  d.customers.push(
    cust('K1', 'Ken Bwaise', 685000),                                     // stored 685,000; his four bills add up to 1,034,000
    cust('E1', 'Eddy (Bonus HW)', 0),                                     // stored 0; #0390 540,000 due, 35 days
    cust('SA', 'Sadat', 290000, [{ id: 901, date: iso(NOW - 60 * DAY), type: 'charge', amount: 290000, note: 'Opening balance', cashTxnId: null, quoteId: null }]),
    cust('AD', 'Adinan', 0),
    cust('MU', 'Muyanja (Walu)', 0));
  d.savedQuotes.push(
    bill(321, 'K1', 'Ken Bwaise', 51, 280000), bill(342, 'K1', 'Ken Bwaise', 44, 349000), bill(413, 'K1', 'Ken Bwaise', 22, 215000), bill(423, 'K1', 'Ken Bwaise', 17, 190000),
    bill(390, 'E1', 'Eddy (Bonus HW)', 35, 540000),
    bill(148, 'AD', 'Adinan', 10, 1425000, 500000, { payments: [{ id: 1, amount: 500000, date: iso(NOW - 10 * DAY), method: 'cash' }] }),
    bill(149, 'AD', 'Adinan', 10, 1425000, 500000, { payments: [{ id: 1, amount: 500000, date: iso(NOW - 16 * DAY), method: 'cash', label: 'Deposit' }] }),
    bill(166, 'MU', 'Muyanja (Walu)', 20, 7040000, 7040000),
    // delivered, not billed: 567
    { id: 572, status: 'completed', invoiced: false, voided: false, client: { name: 'Walk-in' }, customerId: null, items: [L(1, 'P9', 'Washer · 10 mm', 1, 400, 567)], charges: [], payments: [], takenBy: 'u2', createdAt: new Date(NOW - 6 * H).toISOString(), deliveredAt: NOW - 2 * H, stageEnteredAt: NOW - 2 * H });
  d.invoiceAsks.push({ id: 'ask-148', quoteId: 148, customerId: 'AD', kind: 'void', lines: [], amount: 0, reason: 'Raised by mistake', note: '', askedBy: 'u2', askedByName: 'Grace Akello', askedRole: 'sales', status: 'sent', createdAt: new Date(NOW - H).toISOString() });
  d.payAsks = [];
  return d;
}
const quoteRow = q => { const { id, status, invoiced, invoicedAt, amountPaid, voided, date, ...payload } = q; return { id, shop_id: SH, status, invoiced: !!invoiced, invoiced_at: invoicedAt || null, invoiced_ts: null, amount_paid: amountPaid || 0, voided: !!voided, date: date || null, client_name: q.client.name, client_phone: null, payload }; };

function fakeDb(tables, opts){
  opts = opts || {};
  const writes = [], rpcs = [];
  function Q(table){ this.t = table; this.f = []; this.op = 'select'; this.one = false; }
  Q.prototype.select = function(){ return this; };
  Q.prototype.eq = function(k, v){ this.f.push(r => String(r[k]) === String(v)); return this; };
  Q.prototype.in = Q.prototype.gt = Q.prototype.gte = Q.prototype.neq = Q.prototype.order = Q.prototype.limit = Q.prototype.or = function(){ return this; };
  Q.prototype.maybeSingle = function(){ this.one = true; return this; };
  Q.prototype.insert = function(row){ this.op = 'insert'; this.row = row; return this; };
  Q.prototype.update = function(row){ this.op = 'update'; this.row = row; return this; };
  Q.prototype.then = function(res, rej){
    const rows = tables[this.t] || (tables[this.t] = []), clone = x => JSON.parse(JSON.stringify(x));
    if (this.op === 'insert') { if (opts.insertError) return Promise.resolve({ data: null, error: opts.insertError }).then(res, rej); writes.push(['insert', this.t, clone(this.row)]); rows.push(clone(this.row)); return Promise.resolve({ data: { ...clone(this.row), id: 'pa1', created_at: new Date(NOW).toISOString() }, error: null }).then(res, rej); }
    const hit = rows.filter(r => this.f.every(f => f(r)));
    if (this.op === 'update') { writes.push(['update', this.t, clone(this.row), hit.map(r => r.id)]); hit.forEach(r => Object.assign(r, clone(this.row))); return Promise.resolve({ error: null }).then(res, rej); }
    return Promise.resolve({ data: clone(this.one ? (hit[0] || null) : hit), error: null }).then(res, rej);
  };
  return { writes, rpcs, tables, auth: { getUser: () => new Promise(() => {}), getSession: async () => ({ data: { session: null } }), signOut: async () => ({}) }, from: tb => new Q(tb),
    rpc: async (fn, args) => {
      rpcs.push([fn, JSON.parse(JSON.stringify(args || {}))]);
      if (opts.missing && opts.missing.includes(fn)) return { data: null, error: { code: 'PGRST202', message: 'Could not find the function public.' + fn } };
      if (fn === 'ow_patch_order') { const r = (tables.saved_quotes || []).find(x => String(x.id) === String(args.p_id)); if (!r) return { data: null, error: { message: 'gone' } }; r.payload = { ...(r.payload || {}), ...JSON.parse(JSON.stringify(args.p_patch || {})) }; return { data: JSON.parse(JSON.stringify(r)), error: null }; }
      if (fn === 'void_with_money') { const r = (tables.saved_quotes || []).find(x => String(x.id) === String(args.p_order)); if (r) { r.voided = true; r.payload = { ...(r.payload || {}), voidMoney: { done: true, choice: args.p_choice } }; } return { data: { ok: true }, error: null }; }
      if (fn === 'receive_payment') return { data: { amount: args.p_amount, method: args.p_method, bills: [], before: 0, after: 0, cashRows: [] }, error: null };
      return { data: { ok: true }, error: null };
    } };
}
function page(db, d){
  const timers = [], toasts = [], store = {};
  const el = () => ({ innerHTML: '', textContent: '', value: '', children: [], style: {}, dataset: {}, classList: { add() {}, remove() {}, toggle() {} }, setAttribute() {}, querySelector: () => null, querySelectorAll: () => [], appendChild() {}, remove() {}, focus() {} });
  const sandbox = {
    console: { log() {}, warn() {}, error() {} }, setTimeout: (f, ms) => { timers.push({ f, ms, live: true }); return timers.length; }, clearTimeout: id => { if (timers[id - 1]) timers[id - 1].live = false; }, setInterval: () => 0, requestAnimationFrame: () => 0,
    Promise, Date, Math, JSON, URLSearchParams, encodeURIComponent, isFinite, isNaN,
    location: { hostname: 'localhost', hash: '', reload() {} }, localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
    navigator: {}, matchMedia: () => ({ matches: true }), scrollTo() {},
    document: { getElementById: el, querySelector: () => null, querySelectorAll: () => [], addEventListener() {}, createElement: el, body: { appendChild() {}, style: {} }, documentElement: { classList: { toggle() {} } }, visibilityState: 'visible', activeElement: null },
    supabase: { createClient: () => db },
  };
  sandbox.window = sandbox; sandbox.window.open = () => {}; sandbox.window.addEventListener = () => {};
  vm.createContext(sandbox);
  vm.runInContext(app + '\n;globalThis.__x = { S, ACT, PAGE, SHEET, D, viewMoney, needsYou, debtors, debtBands, custBalance, custAddsUp, custBillsWord, customerById, quoteById, payClears, invoiceQueue, defaultMarkupPct, defaultMarkupPrice, shopSellPrice, smallBill, orderNo };', sandbox);
  const X = sandbox.__x;
  sandbox.toast = m => { toasts.push(String(m)); };
  sandbox.loadAll = async () => {};
  Object.assign(X.S, { data: d || data(), shopId: SH, user: { id: 'u1', email: 'ruth@shop.ug' }, shopName: 'Mukasa Hardware', role: 'manager', started: true, tasks: ALL, stack: [] });
  X.render = () => {};
  sandbox.render = () => {};
  return { X, timers, toasts, store };
}
const live = timers => timers.filter(x => x.live);
const fire = async timers => { const ts = live(timers); ts.forEach(x => { x.live = false; }); for (const x of ts) await x.f(); await new Promise(r => setImmediate(r)); };
const rows = d => ({ saved_quotes: d.savedQuotes.map(quoteRow), customers: d.customers.map(c => ({ id: c.id, shop_id: SH, name: c.name, debt: c.debt })), payment_asks: [], decision_log: [], cash_txns: [] });

(async () => {
  /* ---------------- MGR-DATA-02 ---------------- */
  {
    const { X } = page(fakeDb({}));
    const ken = X.customerById('K1'), eddy = X.customerById('E1'), sadat = X.customerById('SA');
    t.check(X.custBalance(ken) === 1034000 && X.custAddsUp(ken) && X.custAddsUp(ken).gap === -349000, 'Ken owes 1,034,000 from his four bills; his stored 685,000 is 349,000 apart');
    t.check(X.custBalance(eddy) === 540000 && X.debtors().some(d => d.c.id === 'E1' && d.bal === 540000), 'Eddy (stored 0) is a debtor at 540,000 from #0390');
    t.check(X.custBalance(sadat) === 290000 && !X.custAddsUp(sadat) && X.custBillsWord(sadat) === 'Opening balance', 'Sadat’s 290,000 is his opening balance, and it adds up');
    const old = X.needsYou().rest.find(n => n.k === 'old'), ids = X.debtors().filter(d => ['K1', 'E1', 'SA'].includes(d.c.id));
    t.check(old && ids.length === 3 && old.v >= 280000 + 349000 + 540000 + 290000, 'the over-30 chase card counts Ken’s, Eddy’s and Sadat’s old money: ' + (old && old.v));
    X.S.ui.mside = 'out';
    const out = X.viewMoney();
    t.check(/Eddy \(Bonus HW\)/.test(out) && />540,000</.test(out) && />1,034,000</.test(out), 'To collect lists Eddy at 540,000 and Ken at 1,034,000 (from the bills)');
    t.check(/#0390 · <span style="color:var\(--amberInk\)">Doesn’t add up/.test(out) && /4 bills · <span style="color:var\(--amberInk\)">Doesn’t add up/.test(out), 'a stored balance that disagrees is marked on the row: "#0390 · Doesn’t add up", "4 bills · Doesn’t add up"');
    t.check(/>Opening balance( · |<)/.test(out) && />old books</.test(out), 'Sadat’s row reads "Opening balance · old books"');
    const total = X.debtors().reduce((s, d) => s + d.bal, 0);
    t.check(total === X.debtors().reduce((s, d) => s + X.custBalance(d.c), 0) && new RegExp('>' + total.toLocaleString('en-US') + '<').test(out), 'the To collect total is the sum of the books’ figures: ' + total.toLocaleString('en-US'));
    const b = X.debtBands(X.debtors());
    t.check(b.reduce((s, v) => s + v, 0) + b.unknown === total, 'the bands add up to the total');
    const kd = X.PAGE.debtor({ id: 'K1' });
    t.check(/>1,034,000</.test(kd) && /349,000<\/span> apart/.test(kd) && /Ken’s balance<\/span><span class="m">685,000/.test(kd) && /Open bills<\/span><span class="m">1,034,000/.test(kd), 'Ken’s sheet: the figure from the bills, and the two bars 349,000 apart');
    t.check(/Doesn’t add up · Esther checks it/.test(kd) && /data-act="mgaskbal" data-id="K1"[^>]*>Ask Esther to check</.test(kd), '"Doesn’t add up · Esther checks it" and "Ask Esther to check"');
    t.check(/<b class="m">#0321<\/b>/.test(kd) && /Open bills · <span class="m">4<\/span>/.test(kd), 'the bill list names each bill by its order number');
    const sd = X.PAGE.debtor({ id: 'SA' });
    t.check(/<i class="open"><\/i><span class="tx"><b>Opening balance<\/b><span>from before these books · not a bill/.test(sd) && /= the opening balance/.test(sd), 'Sadat’s sheet: the opening balance as its own striped line, and "= the opening balance"');
    const pay = X.PAGE.pay({ id: 'K1' });
    t.check(/owes <b class="m"[^>]*>1,034,000/.test(pay) && /All <span class="m">1,034,000/.test(pay), 'the pay screen takes the same figure: owes 1,034,000');
    const ep = X.PAGE.pay({ id: 'E1' });
    t.check(/owes <b class="m"[^>]*>540,000/.test(ep) && /INV-0390/.test(ep), 'Eddy can be paid: owes 540,000, #0390 first');
  }
  {
    // Ask Esther: sending, sent, corrected
    const d = data(), db = fakeDb(rows(d)), { X } = page(db, d);
    await X.ACT.mgaskbal({ dataset: { id: 'K1' } });
    const ins = db.writes.find(w => w[0] === 'insert' && w[1] === 'payment_asks');
    t.check(ins && ins[2].what === 'balance' && ins[2].amount === 349000 && ins[2].customer_id === 'K1' && ins[2].cash_txn_id === null && ins[2].status === 'sent' && ins[2].want.balance === 685000 && ins[2].want.bills === 1034000, 'the ask is the Sales one: payment_asks, what balance, 349,000, both figures');
    t.check(/Asked Esther ·/.test(X.PAGE.debtor({ id: 'K1' })) && !/data-act="mgaskbal"/.test(X.PAGE.debtor({ id: 'K1' })), 'sent: the card says who has it, no second ask');
    X.customerById('K1').debt = 1034000;
    const fixed = X.PAGE.debtor({ id: 'K1' });
    t.check(!/apart<\/b>/.test(fixed) && /= the 4 open bills/.test(fixed), 'corrected: one figure, "= the 4 open bills", no card');
    X.S.paAsking = true; X.customerById('K1').debt = 685000; X.D().payAsks = [];
    t.check(/>Sending…<\/button>/.test(X.PAGE.debtor({ id: 'K1' })), 'sending: the button says Sending…');
  }
  {
    // No signal: kept on this phone, sent on the next load
    const d = data(), db = fakeDb(rows(d), { insertError: { message: 'Failed to fetch' } }), { X, store, toasts } = page(db, d);
    await X.ACT.mgaskbal({ dataset: { id: 'K1' } });
    t.check(/No signal<\/b> · Not sent yet · Kept on this phone/.test(X.PAGE.debtor({ id: 'K1' })) && JSON.parse(store.ow_mgr_balask_q || '[]').length === 1 && toasts.some(m => /kept on this phone/i.test(m)), 'no signal: "Not sent yet · Kept on this phone", queued on the phone');
    const e = page(fakeDb(rows(data()), { insertError: { code: '42501', message: 'permission denied' } }), data());
    await e.X.ACT.mgaskbal({ dataset: { id: 'K1' } });
    t.check(/Not done · could not save/.test(e.X.PAGE.debtor({ id: 'K1' })) && /code M1-02/.test(e.X.PAGE.debtor({ id: 'K1' })) && /data-act="mgaskbal"[^>]*>Try again/.test(e.X.PAGE.debtor({ id: 'K1' })), 'error: "Not done · could not save · code M1-02" with Try again');
  }

  /* ---------------- MGR-DATA-07 ---------------- */
  {
    const d = data(), db = fakeDb(rows(d)), { X, timers } = page(db, d);
    const p0 = X.PAGE.void({ id: 'ask-148' });
    t.check(/Money on it/.test(p0) && /color:var\(--green\)">500,000</.test(p0) && /role="radio" class="vm-opt refund" aria-checked="false"/.test(p0) && /Keep as deposit/.test(p0), 'voiding #0148 with 500,000 paid asks: Refund or Keep as deposit');
    t.check(/data-act="vmvoid"[^>]*disabled>Choose what happens to <span class="m">500,000/.test(p0) && !/data-slide="void:/.test(p0), 'and the void is disabled until one is chosen (no slide)');
    await X.ACT['slide:void']({ dataset: { slide: 'void:ask-148' } });
    t.check(!db.rpcs.length && !db.writes.some(w => w[0] === 'update'), 'the plain void writes nothing on an order with money on it');
    X.ACT.vmpick({ dataset: { k: 'ask:ask-148', v: 'refund' } });
    const p1 = X.PAGE.void({ id: 'ask-148' });
    t.check(/REFUND BY/.test(p1) && /aria-pressed="true" data-act="vmacct"[^>]*>Cash</.test(p1) && /Mobile money/.test(p1) && /Amount<span class="v m"[^>]*>500,000/.test(p1) && /Void and refund <span class="m">500,000/.test(p1), 'Refund: how (cash, mobile money, bank) and the amount; "Void and refund 500,000"');
    X.ACT.vmacct({ dataset: { k: 'ask:ask-148', v: 'momo' } });
    X.ACT.vmpick({ dataset: { k: 'ask:ask-148', v: 'deposit' } });
    const p2 = X.PAGE.void({ id: 'ask-148' });
    t.check(/Deposit <span class="m">500,000<\/span>/.test(p2) && /Adinan’s next bill uses it first/.test(p2) && /Void and keep <span class="m">500,000/.test(p2), 'Keep as deposit: green, "Adinan’s next bill uses it first", "Void and keep 500,000"');
    X.ACT.vmvoid({ dataset: { k: 'ask:ask-148' } });
    const p3 = X.PAGE.void({ id: 'ask-148' });
    t.check(/#0148 is void/.test(p3) && /data-act="vmundo"/.test(p3) && /Voided #0148/.test(p3) && /kept as Adinan’s deposit/.test(p3) && !db.rpcs.length, 'done stamp with Undo for 10 s, and nothing sent yet');
    t.check(live(timers).some(x => x.ms === 10000), 'the hold is 10 seconds');
    X.ACT.vmundo();
    t.check(!live(timers).length && !db.rpcs.length && /Void and keep/.test(X.PAGE.void({ id: 'ask-148' })), 'Undo: nothing sent, the choice is kept');
    X.ACT.vmvoid({ dataset: { k: 'ask:ask-148' } });
    await fire(timers);
    const vw = db.rpcs.find(r => r[0] === 'void_with_money');
    t.check(vw && vw[1].p_order === 148 && vw[1].p_choice === 'deposit' && vw[1].p_shop_id === SH, 'when the window runs out: void_with_money(#0148, deposit)');
    t.check(!db.writes.some(w => w[0] === 'update' && w[1] === 'saved_quotes' && w[2].voided === true), 'the void is that one write, never a bare voided: true');
    const order = db.rpcs.map(r => r[0]).filter(f => ['void_with_money', 'void_sale_bills', 'decide_invoice_ask'].includes(f)).join(',');
    t.check(order === 'void_with_money,void_sale_bills,decide_invoice_ask', 'then the supplier bills and the ask close: ' + order);
  }
  {
    const d = data(), db = fakeDb(rows(d), { missing: ['void_with_money'] }), { X, timers, toasts } = page(db, d);
    X.ACT.vmpick({ dataset: { k: 'ask:ask-148', v: 'refund' } });
    X.ACT.vmvoid({ dataset: { k: 'ask:ask-148' } });
    await fire(timers);
    const p = X.PAGE.void({ id: 'ask-148' });
    t.check(toasts.some(m => /Manager’s database update \(0169\)/.test(m)) && /code M1-07/.test(p) && /Void and refund/.test(p), 'before 0169: the plain "needs the Manager’s database update (0169)", the error card, the choice kept');
    t.check(!db.rpcs.some(r => r[0] === 'ow_patch_order') && !db.writes.some(w => w[0] === 'update'), 'and nothing else was written (the order stays as it was)');
  }
  {
    // The round-3 duplicate void, with money on the one to void
    const d = data();
    const a = { id: 601, status: 'draft', invoiced: false, voided: false, client: { name: 'Adinan', phone: '0700111999' }, customerId: 'AD', items: [L(1, 'P1', 'Iron sheet', 2, 90000, 110000)], charges: [], payments: [{ id: 1, amount: 100000, date: iso(NOW), method: 'cash' }], amountPaid: 0, takenBy: 'u2', createdAt: new Date(NOW - 2 * H).toISOString(), stageEnteredAt: NOW - 2 * H, stageLog: [] };
    const b = { ...JSON.parse(JSON.stringify(a)), id: 602, amountPaid: 100000, createdAt: new Date(NOW - H).toISOString() };
    d.savedQuotes.push(a, b);
    const db = fakeDb(rows(d)), { X, timers } = page(db, d);
    X.S.ui.dup = { key: '601:602', pick: 602, outcome: '' };
    const p = X.PAGE.dup({ a: 601, b: 602 });
    t.check(/Money on it/.test(p) && /data-act="dupvoid"[^>]*disabled>Choose for <span class="m">100,000/.test(p), 'the duplicate void asks too, and waits for the answer');
    X.ACT.dupvoid({ dataset: { a: '601', b: '602' } });
    t.check(!live(timers).length, 'no choice, no void');
    X.ACT.vmpick({ dataset: { k: 'dup:602', v: 'refund' } });
    X.ACT.dupvoid({ dataset: { a: '601', b: '602' } });
    t.check(live(timers).some(x => x.ms === 10000) && !db.rpcs.some(r => r[0] === 'void_with_money'), 'with a choice: held 10 s first');
    await fire(timers);
    const vw = db.rpcs.find(r => r[0] === 'void_with_money');
    t.check(vw && vw[1].p_order === 602 && vw[1].p_choice === 'refund' && vw[1].p_account === 'cash', 'then void_with_money(#0602, refund, cash)');
  }

  /* ---------------- MGR-DATA-11 ---------------- */
  {
    const d = data(), db = fakeDb(rows(d)), { X } = page(db, d);
    const a = { id: 'AD', amt: 500000, mode: null, method: 'cash', receipt: false, date: iso(NOW - 16 * DAY) };
    X.S.stack = [{ type: 'pay', args: a }];
    const orderDay = X.quoteById(148).date, dd = s => new Date(s + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    const p = X.PAGE.pay(a);
    t.check(new RegExp('Before the order \\(' + dd(orderDay) + '\\)').test(p) && /class="pd-date warn"/.test(p) && new RegExp(dd(a.date) + ' · paid').test(p) && new RegExp(dd(orderDay) + ' · order').test(p), 'an earlier day than the order: amber, "Before the order (' + dd(orderDay) + ')", the two days on a line');
    t.check(/id="mx_paygo"[^>]*disabled>Pick one above/.test(p) && /data-act="payearly" data-v="deposit">Record as Deposit/.test(p) && /data-act="payearly" data-v="date">Change the date/.test(p), 'two ways on, and the record button waits: "Pick one above"');
    X.ACT.payearly({ dataset: { v: 'deposit' } });
    t.check(/Record <span class="m">500,000<\/span>&nbsp;as Deposit/.test(X.PAGE.pay(a)), 'chosen: "Record 500,000 as Deposit"');
    await X.ACT['slide:pay'](null, null, a);
    const rp = db.rpcs.find(r => r[0] === 'receive_payment');
    t.check(rp && rp[1].p_date === a.date && rp[1].p_label === 'Deposit' && rp[1].p_amount === 500000, 'recorded with its day and the label Deposit (receive_payment p_date, p_label)');
    const a2 = { id: 'AD', amt: 500000, mode: null, method: 'cash', receipt: false, date: iso(NOW - 16 * DAY) };
    X.S.stack = [{ type: 'pay', args: a2 }];
    X.ACT.payearly({ dataset: { v: 'date' } });
    t.check(a2.date === iso(NOW) && !/Before the order/.test(X.PAGE.pay(a2)), 'Change the date: back to today, no warning');
  }
  {
    const d = data(), db = fakeDb(rows(d)), { X } = page(db, d);
    const a = { id: 'K1', amt: 280000, mode: 'oldest', method: 'cash', receipt: false };
    X.S.stack = [{ type: 'pay', args: a }];
    const p = X.PAGE.pay(a);
    t.check(!/Before the order/.test(p) && /type="date" id="mx_paydate"[^>]*value="/.test(p) && a.date === iso(NOW), 'today by default: nothing to ask');
    await X.ACT['slide:pay'](null, null, a);
    const rp = db.rpcs.find(r => r[0] === 'receive_payment');
    t.check(rp && !('p_date' in rp[1]) && !('p_label' in rp[1]), 'a payment today sends no day and no label (an older database still takes it)');
    const e = page(fakeDb(rows(data()), { missing: ['receive_payment'] }), data()), b = { id: 'AD', amt: 500000, method: 'cash', date: iso(NOW - 16 * DAY), early: 'deposit' };
    e.X.S.stack = [{ type: 'pay', args: b }];
    await e.X.ACT['slide:pay'](null, null, b);
    t.check(e.toasts.some(m => /earlier day needs the Manager’s database update \(0169\)/.test(m)), 'before 0169 an earlier day says what to run');
    const o = X.PAGE.order({ id: 149 });
    const dd = s => new Date(s + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    t.check(new RegExp('class="r dep"[\\s\\S]*?Deposit · ' + dd(iso(NOW - 16 * DAY))).test(o) && /Owes <span class="m">925,000/.test(o), 'the order lists "Deposit · ' + dd(iso(NOW - 16 * DAY)) + '" and what it still owes');
    t.check(/class="w">Cash · /.test(X.PAGE.order({ id: 148 })), 'a payment on or after the order’s day reads by how it was paid');
  }

  /* ---------------- MGR-DATA-12 ---------------- */
  {
    const it = L(1, 'P1', 'Gutter bracket', 1, 6200, null);
    const z = page(fakeDb({}));
    z.X.D().presetDefaultMarkup = { wholesaleType: 'percent', wholesaleValue: 0 };
    const m0 = z.X.PAGE.margins();
    t.check(z.X.defaultMarkupPct() === null && z.X.defaultMarkupPrice(it) === null, 'saved 0%: no default markup, no price made from one');
    t.check(/>0%<\/span>/.test(m0) && /0% saved · pricing has no default until you set one/.test(m0) && !/>25%</.test(m0), 'Margins shows 0% and says pricing has no default — never 25%');
    z.X.D().presetDefaultMarkup = {};
    const m1 = z.X.PAGE.margins();
    t.check(/>—<\/span>/.test(m1) && /None saved · pricing has no default until you set one/.test(m1), 'none saved: a dash and the same line');
    z.X.D().presetDefaultMarkup = { wholesaleType: 'percent', wholesaleValue: 30 };
    const m2 = z.X.PAGE.margins();
    t.check(z.X.defaultMarkupPct() === 30 && z.X.defaultMarkupPrice(it) === 8050 && />30%<\/span>/.test(m2) && !/pricing has no default/.test(m2), 'saved 30%: Margins shows 30%, the shop’s price is cost + 30%');
    z.X.D().presetDefaultMarkup = { wholesaleType: 'percent', wholesaleValue: 0 };
    t.check(!z.X.shopSellPrice({ ...it, productId: 'NOPE' }) && !z.X.defaultMarkupPrice(it), 'with no rule there is no "Shop’s" quick price (shopSellPrice and defaultMarkupPrice are both empty)');
    t.check(/shop > cost \? \{ n: 'Shop’s', v: shop \} : null/.test(html), 'the "Shop’s" quick price is offered only when there is one');
  }

  /* ---------------- MGR-DATA-15 ---------------- */
  {
    const d = data(), db = fakeDb(rows(d)), { X, timers } = page(db, d);
    t.check(X.smallBill(X.quoteById(572)) === 567 && X.smallBill(X.quoteById(148)) === null, '#0572 is under 1,000 (567)');
    const inv = X.PAGE.invoices();
    t.check(/Only <span class="m">567<\/span> · check it/.test(inv) && /data-act="invoice" data-id="572">Check</.test(inv), 'the invoice list marks it: "Only 567 · check it", Check');
    X.S.stack = [{ type: 'invoices', args: {} }];
    await X.ACT.invoice({ dataset: { id: '572' } });
    t.check(!db.rpcs.some(r => r[0] === 'invoice_order') && X.S.stack[X.S.stack.length - 1].type === 'smallinv', 'Invoice on it opens the second look; nothing is billed');
    const p = X.PAGE.smallinv({ id: 572 });
    t.check(/Only <span class="m">567<\/span>&nbsp;· check it/.test(p) && /a usual order/.test(p) && /data-act="sibill" data-id="572">Bill it/.test(p) && /data-act="sifix" data-id="572">Fix the order/.test(p) && /INVOICE · <span class="m">#0572<\/span>/.test(p), 'the second look: "Only 567 · check it" against a usual order, Bill it / Fix the order');
    X.ACT.sibill({ dataset: { id: '572' } });
    const h = X.PAGE.smallinv({ id: 572 });
    t.check(/#0572 is invoiced/.test(h) && /data-act="siundo"/.test(h) && live(timers).some(x => x.ms === 10000) && !db.rpcs.some(r => r[0] === 'invoice_order'), 'Bill it: stamped, Undo for 10 s, nothing sent yet');
    X.ACT.siundo();
    t.check(!live(timers).length && /Bill it/.test(X.PAGE.smallinv({ id: 572 })), 'Undo: back to the second look');
    X.ACT.sibill({ dataset: { id: '572' } });
    await fire(timers);
    t.check(db.rpcs.some(r => r[0] === 'invoice_order' && r[1].p_quote_id === 572), 'when the window runs out: invoice_order(#0572)');
    const n0 = db.rpcs.filter(r => r[0] === 'invoice_order').length;
    await X.ACT.invoiceall();
    t.check(!db.rpcs.slice(n0).some(r => r[0] === 'invoice_order' && r[1].p_quote_id === 572), 'Invoice all leaves the small one to its second look');
    X.ACT.sifix({ dataset: { id: '572' } });
    t.check(X.S.stack[X.S.stack.length - 1].type === 'order', 'Fix the order opens the order');
  }

  /* ---------------- order numbers ---------------- */
  t.check(/function orderNo\(id\)\{ return '#' \+ String\(id\)\.padStart\(4, '0'\); \}/.test(html) && page(fakeDb({})).X.orderNo(572) === '#0572', 'one order number: orderNo(572) is #0572');

  process.exit(t.done() ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
