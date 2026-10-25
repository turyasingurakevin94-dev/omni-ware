#!/usr/bin/env node
'use strict';
/*
 * Manager round 1 (data and money integrity), the orders / margins / Today
 * half (docs/audit/manager/ROUND-1.md), in manager.html:
 *
 *   MGR-WORD-01  one order number, #0543, everywhere the Manager reads it.
 *   MGR-DATA-04  an invoiced line sold under its cost says so, with the loss;
 *                Margins groups them, all months, newest first.
 *   MGR-DATA-05  Sold today never puts a count beside a bare 0.
 *   MGR-DATA-06  the goal legend: chips, "No seller · amount", "no login".
 *   MGR-DATA-08  one sales figure (salesIn) on Today and Margins, split.
 *   MGR-DATA-09  a line at 0 is answered "Free · given away" or "To price".
 *   MGR-DATA-13  customers who look alike: merge, not the same, fix the phone.
 *   MGR-DATA-14  goals that ended say reached or missed, with the result.
 *
 * Run: node test/manager-round1-orders.test.js   (or: npm test)
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { createReporter } = require('./_extract');
const { fixture, ALL, NOW, H, DAY, iso, TODAY } = require('./_manager-decide-fixture');

const t = createReporter('manager round 1: orders');
const html = fs.readFileSync(path.join(__dirname, '..', 'manager.html'), 'utf8');
const app = [...html.matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]).filter(s => /const S = \{/.test(s)).join('\n');
const SH = 'shop1';
const M0 = TODAY.slice(0, 8) + '01';

function fakeDb(tables, missing){
  const writes = [], rpcs = [];
  function Q(table){ this.t = table; this.f = []; this.op = 'select'; this.one = false; }
  Q.prototype.select = function(){ return this; };
  Q.prototype.eq = function(k, v){ this.f.push(r => String(r[k]) === String(v)); return this; };
  Q.prototype.in = Q.prototype.gt = Q.prototype.gte = Q.prototype.neq = Q.prototype.order = Q.prototype.limit = Q.prototype.range = function(){ return this; };
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
  return { writes, rpcs, tables, auth: { getUser: () => new Promise(() => {}), getSession: async () => ({ data: { session: null } }), signOut: async () => ({}) }, from: tb => new Q(tb),
    rpc: async (fn, args) => {
      if (fn === 'ow_patch_order') { const qs = tables.saved_quotes || (tables.saved_quotes = []), r = qs.find(x => String(x.id) === String(args.p_id)); if (!r) return { data: null, error: { message: 'This order is no longer in the books.' } }; const pl = { ...(r.payload || {}), ...JSON.parse(JSON.stringify(args.p_patch || {})) }; (args.p_drop || []).forEach(k => { delete pl[k]; }); const row = { payload: pl }; if (args.p_status != null) row.status = args.p_status; writes.push(['update', 'saved_quotes', JSON.parse(JSON.stringify(row)), [r.id]]); Object.assign(r, row); return { data: JSON.parse(JSON.stringify(r)), error: null }; }
      rpcs.push([fn, JSON.parse(JSON.stringify(args))]);
      if ((missing || []).includes(fn)) return { data: null, error: { code: 'PGRST202', message: 'Could not find the function public.' + fn } };
      return { data: { ok: true }, error: null };
    } };
}
function page(db, data, opts){
  opts = opts || {};
  const el = () => ({ innerHTML: '', textContent: '', value: '', children: [], style: {}, dataset: {}, classList: { add() {}, remove() {}, toggle() {} }, setAttribute() {}, removeAttribute() {}, querySelector: () => null, querySelectorAll: () => [], appendChild() {}, remove() {}, focus() {} });
  const store = opts.store || {}, timers = [];
  const sandbox = {
    console: { log() {}, warn() {}, error() {} }, setTimeout: (f, ms) => { timers.push({ f, ms }); return timers.length; }, clearTimeout: id => { if (timers[id - 1]) timers[id - 1].f = null; }, setInterval: () => 0, requestAnimationFrame: () => 0, Promise, Date, Math, JSON, URLSearchParams, encodeURIComponent, isFinite, isNaN,
    location: { hostname: 'localhost', hash: '', reload() {} },
    localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
    navigator: {}, matchMedia: () => ({ matches: true }),
    document: { getElementById: el, querySelector: () => null, querySelectorAll: () => [], addEventListener() {}, createElement: el, body: { appendChild() {}, style: {} }, documentElement: { classList: { toggle() {} } }, visibilityState: 'visible', activeElement: null },
    supabase: { createClient: () => db },
  };
  sandbox.window = sandbox; sandbox.window.open = () => {}; sandbox.window.addEventListener = () => {};
  vm.createContext(sandbox);
  vm.runInContext(app + `\n;globalThis.__x = { S, ACT, PAGE, SHEET, D, render, viewToday, viewMoney, orderNo, obNo, todayMoney, soldTodayHTML, teamMonth, legendChipsHTML, salesIn, nmInvoicesIn, nmInvoiceSales,
    monthLines, marginsSplit, soldBelowCost, lineBelowCost, priceCases, invoiceQueue, invoiceBlock, lineWaitsPrice, lineFreeOpen, lineGivenAway, freeOpenLines, quoteById, lookAlike, phoneOk, laFlush, endTargets,
    salesTarget, shopGoals, goalResult, ceSaveBtn, ceStart, customerById, decideCounts };`, sandbox);
  const X = sandbox.__x;
  Object.assign(X.S, { data: data || fixture(), shopId: SH, user: { id: 'u1', email: 'ruth@shop.ug' }, shopName: 'Mukasa Hardware', role: 'manager', started: true, tasks: opts.tasks || ALL, stack: [{ type: 'today', args: {} }] });
  X.store = store; X.timers = timers;
  return X;
}
const quoteRow = (q) => {
  const { id, status, invoiced, invoicedAt, amountPaid, voided, date, ...payload } = q;
  return { id, shop_id: SH, status, invoiced: !!invoiced, invoiced_at: invoicedAt || null, invoiced_ts: null, amount_paid: amountPaid || 0, voided: !!voided, date: date || null, client_name: q.client.name, client_phone: null, payload };
};
const tablesFor = data => ({ saved_quotes: data.savedQuotes.map(quoteRow), customers: data.customers.map(c => ({ id: c.id, shop_id: SH, name: c.name, debt: c.debt, phone: c.phone })), customer_debt_log: [], decision_log: [] });
const L = (pid, name, qty, cost, sell, extra) => ({ productId: pid, variantIdx: null, productName: name, unit: 'pc', qty, supplierId: '__stock__', price: cost, sellPrice: sell, ...(extra || {}) });
const inv = (id, days, items, extra) => ({ id, status: 'completed', invoiced: true, invoicedAt: iso(NOW - days * DAY), date: iso(NOW - days * DAY), amountPaid: 0, voided: false, client: { name: 'Walk-in' }, customerId: null, items, charges: [], payments: [], takenBy: 'u2', createdAt: new Date(NOW - days * DAY - 2 * H).toISOString(), ...(extra || {}) });
const strip = s => String(s).replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');

(async () => {
  /* ---------------- MGR-WORD-01 · one order number ---------------- */
  {
    const X = page(fakeDb({}));
    t.check(X.orderNo(543) === '#0543' && X.orderNo(2415) === '#2415' && X.obNo({ id: 7 }) === '#0007', 'orderNo pads to four digits after a #');
    t.check(!/Q-\$\{|'Q-'|"Q-"|>Q-\d/.test(html), 'manager.html builds no "Q-" order number anywhere');
    t.check((html.match(/function orderNo\(/g) || []).length === 1, 'one orderNo helper');
    const pg = X.PAGE.order({ id: 2402 });
    t.check(/#2402 · /.test(pg) && !/Q-\d/.test(pg), 'the order page reads #2402');
    t.check(/#2415/.test(X.PAGE.price({ id: 2415 })) && /#2420/.test(X.PAGE.pricenew({ id: 2420 })), 'the price screens read #2415 / #2420');
    t.check(/\(#2415\)/.test(X.SHEET.nudge({ who: 'S2', order: 2415 })), 'the nudge message names the order as #2415');
    t.check(X.ACT.obsearch && X.PAGE.search, 'search still opens');
  }

  /* ---------------- MGR-DATA-04 · sold below cost ---------------- */
  {
    const data = fixture();
    data.savedQuotes.push(inv(193, 70, [L('P9', 'Black Screws 8*', 4, 11500, 11250)]), inv(321, 40, [L('P8', 'Masking Tape Green', 2, 32500, 30000)]), inv(554, 2, [L('P7', 'MEGA Mulper Normal', 1, 165000, 155000), L('P1', 'Iron sheet G28 · 3 m', 2, 98000, 112000)]));
    const X = page(fakeDb({}), data);
    const o = X.PAGE.order({ id: 193 });
    t.check(/below cost/.test(o) && /−250 each/.test(o) && /1<\/span> line below cost/.test(o) && /sold <span class="m"[^>]*>11,250<\/span> · cost <span class="m">11,500/.test(o), '#0193: the line says "below cost", the loss each, sold and cost');
    const o2 = X.PAGE.order({ id: 554 });
    t.check(o2.indexOf('MEGA Mulper') < o2.indexOf('Iron sheet'), 'the flagged line comes first on the slip');
    const list = X.soldBelowCost(), mine = list.filter(x => [193, 321, 554].includes(x.q.id));
    t.check(mine.map(x => x.q.id).join() === '554,321,193' && list.every((x, i) => !i || String(list[i - 1].at) >= String(x.at)), 'Margins lists every month, newest first: ' + list.map(x => x.q.id).join());
    const mg = X.PAGE.margins(), loss = list.reduce((s, x) => s + x.loss, 0);
    t.check(new RegExp(`Sold below cost · <span class="m">${list.length}</span> lines`).test(mg) && mg.includes('−' + n(loss)) && sumOf(mine) === 16000, `Margins: "Sold below cost · ${list.length} lines" and the loss −${n(loss)} (ours −16,000)`);
    t.check(/data-p="order" data-id="554"/.test(mg) && /data-p="order" data-id="193"/.test(mg), 'each line opens its order');
    t.check(!X.priceCases().some(x => [193, 321, 554].includes(Number(x.q.id))), 'Decide still queues only lines not yet invoiced');
    const dn = fixture(); dn.savedQuotes.forEach(q => (q.items || []).forEach(it => { if (Number(it.sellPrice) < Number(it.price)) it.sellPrice = Number(it.price) + 1000; }));
    const Y = page(fakeDb({}), dn);
    t.check(/Nothing sold below cost/.test(Y.PAGE.margins()), 'none: "Nothing sold below cost"');
  }

  /* ---------------- MGR-DATA-05 · sold today ---------------- */
  {
    const base = () => { const d = fixture(); d.savedQuotes = d.savedQuotes.filter(q => q.invoiced && q.status === 'completed').map(q => ({ ...q, createdAt: new Date(NOW - 9 * DAY).toISOString() })); return d; };
    const today = (id, items) => ({ id, status: 'draft', invoiced: false, voided: false, client: { name: 'Walk-in' }, customerId: null, items, charges: [], payments: [], takenBy: 'u2', createdAt: new Date(NOW - 60e3).toISOString(), stageEnteredAt: NOW - 60e3 });
    let X = page(fakeDb({}), base());
    t.check(/No orders yet/.test(X.soldTodayHTML(X.todayMoney())), 'nothing sold: words, not a 0');
    const d1 = base(); d1.savedQuotes.push(today(2578, [L('P3', 'PVC gutter · 4 m', 4, 0, null)]));
    X = page(fakeDb({}), d1); let m = X.todayMoney(), h = X.soldTodayHTML(m);
    t.check(m.toPrice === 1 && /<span class="m">1<\/span> order/.test(h) && /to price/.test(h) && !/class="v">0</.test(h), 'all to price: "1 order · to price", no bare 0');
    const d2 = base(); d2.savedQuotes.push(today(2578, [L('P3', 'PVC gutter · 4 m', 4, 0, null)]), today(2579, [L('P1', 'Iron sheet G28 · 3 m', 10, 98000, 142500)]));
    X = page(fakeDb({}), d2); m = X.todayMoney(); h = X.soldTodayHTML(m);
    t.check(/1,425,000/.test(h) && /<span class="m">1<\/span>&nbsp;to price/.test(h) && /<span class="m">2<\/span> orders/.test(h), 'mixed: the priced value and "1 to price"');
    const d3 = base(); d3.savedQuotes.push(today(2579, [L('P1', 'Iron sheet G28 · 3 m', 10, 98000, 142500)]));
    X = page(fakeDb({}), d3); h = X.soldTodayHTML(X.todayMoney());
    t.check(/1,425,000/.test(h) && !/to price/.test(h), 'all priced: the value, as before');
    t.check(/Sold today · <span class="m">1<\/span> order/.test(X.viewToday()), 'the day card draws it');
  }

  /* ---------------- MGR-DATA-06 · the goal legend ---------------- */
  {
    const data = fixture();
    data.staff.push({ id: 'S4', name: 'Daphine Kemigisha', phone: '0772000104', role: 'sales', unavailable: false, userId: null }, { id: 'K1', name: 'Kevin Turyasingura', phone: '0772999000', role: 'owner', unavailable: false, userId: 'u0' });
    data.savedQuotes.push(inv(150, 1, [L('P1', 'Iron sheet G28 · 3 m', 10, 98000, 112000)], { takenBy: '' }));
    const X = page(fakeDb({}), data);
    const today = X.viewToday();
    t.check(!/not linked/.test(today), 'no "not linked" left on Today');
    t.check(/class="mx-lchip"[^>]*data-p="person" data-id="S1"/.test(today), 'each seller is a chip that opens her page');
    t.check(/Daphine · no login/.test(strip(today)), 'a staff card with no login: "Daphine · no login"');
    t.check(/No seller · 1,120,000/.test(strip(today)) && /data-act="noseller"/.test(today), '"No seller · 1,120,000" is a chip of its own');
    const ns = X.SHEET.noseller();
    t.check(/#0150/.test(ns) && /the old-records import/.test(ns) && new RegExp(new Date().toLocaleDateString('en-GB', { month: 'long' })).test(ns), 'the sheet lists the invoices with no seller, by month');
    const nl = X.SHEET.nologin({ id: 'S4' });
    t.check(/Ask Kevin to link Daphine’s login/.test(nl) && /wa\.me/.test(nl) && /The owner links logins/.test(nl), 'her sheet: "Ask Kevin to link Daphine’s login", by WhatsApp');
    X.ACT.askloginsent({ dataset: { id: 'S4' } });
    t.check(/Sending…/.test(X.SHEET.nologin({ id: 'S4' })), 'sending: "Sending…"');
    X.timers.filter(x => x.f).forEach(x => x.f());
    t.check(/Asked Kevin · /.test(X.SHEET.nologin({ id: 'S4' })) && /Daphine · asked Kevin/.test(strip(X.viewToday())), 'asked: the sheet and the chip say so');
  }

  /* ---------------- MGR-DATA-08 · one sales figure ---------------- */
  {
    const data = fixture();
    data.targets = [];
    // A line with no cost recorded, and a delivery fee that is not sales.
    data.savedQuotes.push(inv(160, 0, [L('P3', 'PVC gutter · 4 m', 10, 0, 40000)], { charges: [{ name: 'Delivery', type: 'fixed', value: 30000 }] }));
    const X = page(fakeDb({}), data);
    const want = X.nmInvoicesIn(M0, TODAY).reduce((s, q) => s + X.nmInvoiceSales(q), 0);
    t.check(X.salesIn(M0, TODAY) === want && X.teamMonth().actual === want, 'Today reads salesIn: ' + want);
    t.check(!X.nmInvoicesIn(M0, TODAY).some(q => q.qa || q.voided), 'not voided, not test');
    t.check(X.nmInvoiceSales(X.quoteById(160)) === 400000, 'goods only: the 30,000 delivery fee is left out');
    const today = X.viewToday();
    t.check(/Sales invoiced · /.test(today) && /goods only, no delivery fees/.test(today) && today.includes(want.toLocaleString('en-US')), 'Today: "Sales invoiced · <month>", goods only');
    const sp = X.marginsSplit(X.monthLines().filter(r => !r.nocost)), mg = X.PAGE.margins();
    t.check(sp.total === Math.round(want) && sp.costed + sp.nocost === sp.total && sp.nocost >= 400000, `Margins: costed ${sp.costed} + no cost recorded ${sp.nocost} = ${sp.total}`);
    t.check(mg.includes(n(sp.total)) && /no cost recorded <b class="m"[^>]*>/.test(mg) && /= Sales invoiced on Today/.test(mg), 'Margins draws the same figure, split on a bar');
  }

  /* ---------------- MGR-DATA-09 · a line at 0 ---------------- */
  {
    const data = fixture();
    const q541 = { id: 2541, status: 'completed', invoiced: false, voided: false, client: { name: 'Walk-in' }, customerId: null, deliveredAt: NOW - 2 * H, stageEnteredAt: NOW - 2 * H,
      items: [L('P5', 'Cabinet handle 128mm', 10, 12000, 0), L('P3', 'Door closer, medium', 2, 0, 0), L('P1', 'Iron sheet G28 · 3 m', 5, 98000, 112000)], charges: [], payments: [], takenBy: 'u2', createdAt: new Date(NOW - 6 * H).toISOString() };
    const q542 = { ...JSON.parse(JSON.stringify(q541)), id: 2542, items: [L('P5', 'Cabinet handle 128mm', 4, 12000, 0), L('P1', 'Iron sheet G28 · 3 m', 5, 98000, 112000)] };
    data.savedQuotes.push(q541, q542, inv(2540, 3, [L('P6', 'Drawer runner 18”', 8, 12000, 0, { givenAway: { why: 'goodwill', by: 'u1', at: new Date().toISOString() } })]));
    data.savedQuotes.find(q => q.id === 2420).items.push(L('P3', 'PVC gutter · 4 m', 3, 18000, 0));
    const db = fakeDb(tablesFor(data)), X = page(db, data);
    const b = X.invoiceBlock(X.quoteById(2541));
    t.check(b && b.k === 'free' && /2 lines at 0/.test(b.w), 'billing waits while a 0 line is unanswered');
    t.check(/data-p="givenaway" data-id="2541">Settle/.test(X.PAGE.invoices()), 'Invoices: Settle opens the 0 lines');
    t.check(/<span class="m">1<\/span> line at 0/.test(X.PAGE.pricenew({ id: 2420 })) && /data-p="givenaway" data-id="2420"/.test(X.PAGE.pricenew({ id: 2420 })), 'a price screen shows the order’s 0 lines, one tap away');
    let pg = X.PAGE.givenaway({ id: 2541 });
    t.check(/<span class="m">2<\/span> of 3 lines at 0/.test(pg) && /0 of 2<\/span> answered/.test(pg) && /Free · given away/.test(pg) && /To price/.test(pg), 'each 0 line asks: Free · given away, or To price');
    await X.ACT.gasend({ dataset: { id: '2541' } });
    pg = X.PAGE.givenaway({ id: 2541 });
    t.check(/Answer the <span class="m">2<\/span> marked lines first/.test(pg) && !db.writes.length && !db.rpcs.length, 'refused: the lines are marked and nothing is sent');
    X.ACT.gaset({ dataset: { id: '2541', i: '0', k: 'free' } });
    pg = X.PAGE.givenaway({ id: 2541 });
    t.check(/sample/.test(pg) && /goodwill/.test(pg) && /replacement/.test(pg) && /data-v="other"/.test(pg) && /0 of 2<\/span> answered/.test(pg), 'free opens the reason chips; not answered until a reason');
    X.ACT.gawhy({ dataset: { id: '2541', i: '0', v: 'sample' } });
    X.ACT.gaset({ dataset: { id: '2541', i: '1', k: 'price' } });
    pg = X.PAGE.givenaway({ id: 2541 });
    t.check(/2 of 2<\/span> answered/.test(pg) && /Given away · sample/.test(pg) && /Save the answers/.test(pg), 'both answered; one to price, so it saves without billing');
    await X.ACT.gasend({ dataset: { id: '2541' } });
    const items = db.tables.saved_quotes.find(q => q.id === 2541).payload.items;
    t.check(items[0].givenAway && items[0].givenAway.why === 'sample' && items[0].givenAway.by === 'u1' && !!items[0].givenAway.at, 'items[0].givenAway = {why, by, at} through ow_patch_order');
    t.check(items[1].sellPrice === null && items[1].priceAsk === true && !items[1].givenAway, 'the "to price" line loses its 0 and goes to Decide');
    t.check(!db.rpcs.some(r => r[0] === 'invoice_order'), 'and nothing is billed while a line waits for a price');
    t.check(X.priceCases().some(x => x.q.id === 2541) && !X.lineWaitsPrice(X.quoteById(2541).items[0]), 'Decide has the line to price; the free one never waits');
    t.check(db.tables.decision_log.some(l => /given away \(sample\)/.test(l.what)), 'the answer goes in the owner’s log');
    X.ACT.gaset({ dataset: { id: '2542', i: '0', k: 'free' } }); X.ACT.gawhy({ dataset: { id: '2542', i: '0', v: 'other' } });
    t.check(/Invoice #2542/.test(X.PAGE.givenaway({ id: 2542 })) && /0 of 1<\/span> answered/.test(X.PAGE.givenaway({ id: 2542 })), '"other" needs its words');
    X.ACT['in:gatext']({ dataset: { id: '2542', i: '0' }, value: 'shop opening' });
    await X.ACT.gasend({ dataset: { id: '2542' } });
    t.check(db.tables.saved_quotes.find(q => q.id === 2542).payload.items[0].givenAway.why === 'shop opening' && db.rpcs.some(r => r[0] === 'invoice_order' && r[1].p_quote_id === 2542), 'every 0 free: the answers are written, then it is billed');
    t.check(/Given away · sample/.test(X.PAGE.order({ id: 2541 })) && /Given away · goodwill/.test(X.PAGE.order({ id: 2540 })), 'the order shows "Given away · reason"');
    const mg = X.PAGE.margins();
    t.check(/Given away · <span class="m">1<\/span> line/.test(mg) && /96,000/.test(mg) && /goodwill/.test(mg), 'Margins: a "Given away" group, valued at cost (8 × 12,000)');
  }

  /* ---------------- MGR-DATA-13 · look alike ---------------- */
  {
    const data = fixture();
    data.customers.push({ id: 'C7', name: 'Esther', phone: '0701000001', debt: 100000, debtLog: [] }, { id: 'C8', name: 'Esther ', phone: '0701000002', debt: 50000, debtLog: [] },
      { id: 'C9', name: 'Sarah - Dorcus', phone: '0705555000', debt: 0, debtLog: [] }, { id: 'C10', name: 'Dorcus’ Customer', phone: '0705 555 000', debt: 0, debtLog: [] },
      { id: 'C11', name: 'Henry Munene', phone: '078456342', debt: 0, debtLog: [] });
    let db = fakeDb(tablesFor(data)), X = page(db, data);
    t.check(X.phoneOk('0772123456') && X.phoneOk('') && !X.phoneOk('078456342') && !X.phoneOk('256772123456') && !X.phoneOk('0872123456'), 'a phone is 10 digits starting 07');
    const la = X.lookAlike();
    t.check(la.map(x => x.why).join() === 'name,phone,bad' && la[0].key === 'C7|C8' && la[1].key === 'C10|C9' && la[2].a.id === 'C11', 'same name, same phone, a short phone (query 10)');
    X.S.ui.mside = 'out';
    t.check(/Look alike · <span class="m">3<\/span> to check/.test(X.viewMoney()) && /data-p="lookalike"/.test(X.viewMoney()), 'Money › To collect: one way in');
    const pg = X.PAGE.lookalike();
    t.check(/SAME NAME/.test(pg) && /SAME PHONE/.test(pg) && /PHONE · <span class="m">9<\/span> DIGITS/.test(pg) && /data-p="custedit" data-id="C11">.*Fix the phone/.test(pg), 'the list: Merge, Not the same, Fix the phone');
    t.check(/Which stays\?/.test(X.PAGE.lamerge({ a: 'C7', b: 'C8' })), 'Merge: pick the name that stays');
    X.ACT.lakeep({ dataset: { k: 'C7|C8', v: 'C8' } });
    t.check(/data-keep="C8" data-drop="C7"/.test(X.PAGE.lamerge({ a: 'C7', b: 'C8' })), 'the pick changes who stays');
    X.ACT.laask({ dataset: { keep: 'C8', drop: 'C7' } });
    t.check(/Merge into Esther \?|Merge into Esther/.test(X.SHEET.laconfirm({ keep: 'C8', drop: 'C7' })) && /Undo for 10 s/.test(X.SHEET.laconfirm({ keep: 'C8', drop: 'C7' })), 'confirm: one more yes, Undo for 10 s');
    X.S.stack.push({ type: 'lamerge', args: { a: 'C7', b: 'C8' } });
    X.ACT.lamerge({ dataset: { keep: 'C8', drop: 'C7' } });
    t.check(X.S.laHold && X.S.laHold.kind === 'merge' && !db.rpcs.some(r => r[0] === 'merge_customers') && X.lookAlike().length === 2, 'held 10 s: nothing sent, the pair leaves the list');
    await X.S.obUndo();
    await X.laFlush();
    t.check(!X.S.laHold && !db.rpcs.some(r => r[0] === 'merge_customers') && X.lookAlike().length === 3, 'Undo inside the 10 s sends nothing');
    X.ACT.lamerge({ dataset: { keep: 'C8', drop: 'C7' } });
    t.check(X.timers.some(x => x.f && x.ms === 10000), 'the hold is 10 seconds');
    await X.laFlush();
    const mc = db.rpcs.find(r => r[0] === 'merge_customers');
    t.check(mc && mc[1].p_keep === 'C8' && mc[1].p_drop === 'C7' && mc[1].p_shop_id === SH, 'then merge_customers(keep C8, drop C7)');
    X.ACT.laapart({ dataset: { a: 'C9', b: 'C10' } });
    await X.laFlush();
    const ap = db.tables.decision_log.find(l => l.ref && l.ref.apart);
    t.check(ap && ap.task === 'customer.edit' && ap.ref.apart.join() === 'C9,C10' && !X.lookAlike().some(x => x.key === 'C10|C9'), 'Not the same: kept apart, remembered in the owner’s log (customer.edit, ref.apart)');
    // A missing database function: the error card with its code.
    const d2 = fixture(); d2.customers.push({ id: 'C7', name: 'Esther', phone: '', debt: 0, debtLog: [] }, { id: 'C8', name: 'Esther', phone: '', debt: 0, debtLog: [] });
    db = fakeDb(tablesFor(d2), ['merge_customers']); X = page(db, d2);
    X.ACT.lamerge({ dataset: { keep: 'C7', drop: 'C8' } }); await X.laFlush();
    const er = X.PAGE.lookalike();
    t.check(/Not done · could not save/.test(er) && /\(0169\)/.test(er) && /code <span class="m">M1-13/.test(er) && /Try again/.test(er), 'merge failed: both kept, "needs the Manager’s database update (0169)", code M1-13');
    // Customer edit: the phone
    X = page(fakeDb({}), data);
    const ce = X.PAGE.custedit({ id: 'C11' });
    t.check(/10 digits, starting 07 · this has <span class="m">9<\/span>/.test(ce) && /aria-invalid="true" id="ce_phone"/.test(ce), 'customer edit: a 9-digit phone is red, "10 digits, starting 07"');
    const c = X.customerById('C11'), st = X.ceStart(c);
    st.phone = '07845634'; t.check(/disabled/.test(X.ceSaveBtn(c, st)) && /Fix the phone first/.test(X.ceSaveBtn(c, st)), 'a changed phone that is still short is refused');
    st.phone = '0784563421'; t.check(!/disabled/.test(X.ceSaveBtn(c, st)) && /Save 1 change/.test(X.ceSaveBtn(c, st)), '10 digits starting 07 saves');
    const c1 = X.customerById('C1'), s1 = X.ceStart(c1); t.check(!/aria-invalid/.test(X.PAGE.custedit({ id: 'C1' })), 'a good phone draws plain');
  }

  /* ---------------- MGR-DATA-14 · goals that ended ---------------- */
  {
    const data = fixture(), past = d => iso(NOW - d * DAY);
    data.targetsEnded = []; data.targetsEnded.push({ id: 35, date: past(60), status: 'ended', body: { metric: 'dead_stock', title: 'Clear 35 dead stock', aim: 35, from: past(60), to: past(54), result: { actual: 20, aim: 35, reached: false } } },
      { id: 46, date: past(60), status: 'ended', body: { metric: 'gross_profit', title: 'Gross profit · 46', aim: 46, from: past(60), to: past(54), result: { actual: 51, aim: 46, reached: true } } },
      { id: 47, date: M0, status: 'ended', body: { metric: 'sales', aim: 999000000, from: M0, to: iso(NOW + 5 * DAY) } });
    const db = fakeDb({}), X = page(db, data);
    t.check(X.salesTarget().aim === 105000000, 'an ended goal is never the open one');
    const pg = X.PAGE.teamrules();
    t.check(/Ended · missed/.test(pg) && /Ended · reached/.test(pg) && /20<\/span> of <span class="m">35/.test(pg) && /51<\/span> of <span class="m">46/.test(pg), 'goal rows: "Ended · reached / missed" with the result');
    t.check(pg.indexOf('Shop sales') < pg.indexOf('ENDED') && pg.indexOf('ENDED') < pg.indexOf('Clear 35 dead stock'), 'open goals first, then the ended ones');
    await X.endTargets();
    t.check(db.rpcs.some(r => r[0] === 'ow_end_targets' && r[1].p_shop_id === SH), 'on load the app calls ow_end_targets');
    const Y = page(fakeDb({}, ['ow_end_targets']));
    let threw = false; try { await Y.endTargets(); } catch (_e) { threw = true; }
    t.check(!threw, 'a database without ow_end_targets is skipped quietly');
    t.check(/eq\('kind', 'target'\)\.in\('status', \['open', 'ended'\]\)/.test(html), 'targets load open and ended');
  }

  /* ---------------- nothing else moved ---------------- */
  {
    const X = page(fakeDb({}));
    const c = X.decideCounts();
    t.check(c.prices === 5 && c.invoices === 2, 'Decide counts as before (prices 5, invoices 2)');
  }

  process.exit(t.done() ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
function sumOf(l){ return l.reduce((s, x) => s + x.loss, 0); }
function n(v){ return Math.round(v).toLocaleString('en-US'); }
