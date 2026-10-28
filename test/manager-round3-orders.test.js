#!/usr/bin/env node
'use strict';
/*
 * Round 3, orders (manager.html): search, one order's controls, an order
 * taken twice, and what Today shows for them.
 *
 *   1. Search really filters: by name, order number and phone, old orders too.
 *   2. Needs you: an order nobody holds is an Assign row; every stuck order
 *      is counted and drawn; a pair taken twice shows until kept.
 *   3. OrderAct: moving a stage writes the status column and its log; giving
 *      it to a packer, then Undo, puts it back with nobody.
 *   4. Supplier asked rides on supplierConfirms[].askedAt (buyer.html's mark).
 *   5. Void a duplicate: voided and stamped cancelled; Keep both is remembered.
 *
 * Run: node test/manager-round3-orders.test.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { createReporter } = require('./_extract');
const { fixture, ALL } = require('./_manager-round3-orders-fixture');

const t = createReporter('manager round 3: orders');
const html = fs.readFileSync(path.join(__dirname, '..', 'manager.html'), 'utf8');
const app = [...html.matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]).filter(s => /const S = \{/.test(s)).join('\n');
const SH = 'shop1';
function fakeDb(tables){
  const writes = [], rpcs = [];
  function Q(table){ this.t = table; this.f = []; this.op = 'select'; this.one = false; }
  Q.prototype.select = function(){ return this; };
  Q.prototype.eq = function(k, v){ this.f.push(r => String(r[k]) === String(v)); return this; };
  Q.prototype.in = Q.prototype.gt = Q.prototype.gte = Q.prototype.neq = Q.prototype.order = Q.prototype.limit = function(){ return this; };
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
  let nextId = 5000;
  return { writes, rpcs, tables, auth: { getUser: () => new Promise(() => {}), getSession: async () => ({ data: { session: null } }), signOut: async () => ({}) }, from: tb => new Q(tb),
    rpc: async (fn, args) => { // 0165: the apps change an order through ow_patch_order
      if (fn === 'ow_patch_order') { const qs = tables.saved_quotes || (tables.saved_quotes = []), r = qs.find(x => String(x.id) === String(args.p_id)); if (!r) return { data: null, error: { message: 'This order is no longer in the books.' } }; const pl = { ...(r.payload || {}), ...JSON.parse(JSON.stringify(args.p_patch || {})) }; (args.p_drop || []).forEach(k => { delete pl[k]; }); const row = { payload: pl }; if (args.p_status != null) row.status = args.p_status; writes.push(['update', 'saved_quotes', JSON.parse(JSON.stringify(row)), [r.id]]); Object.assign(r, row); return { data: JSON.parse(JSON.stringify(r)), error: null }; } 
      if (fn === 'next_row_id_blocks') { const k = args.p_kinds[0]; nextId = Math.max(nextId, Number(args.p_floors[k]) || 0) + 1; return { data: { [k]: nextId }, error: null }; }
      rpcs.push([fn, JSON.parse(JSON.stringify(args))]);
      if (fn === 'invoice_order') return { data: null, error: { code: 'PGRST202', message: 'Could not find the function public.invoice_order' } };
      return { data: { ok: true }, error: null };
    } };
}
function page(db, data, tasks){
  const el = () => ({ innerHTML: '', textContent: '', value: '', children: [], style: {}, dataset: {}, classList: { add() {}, remove() {}, toggle() {} }, setAttribute() {}, querySelector: () => null, querySelectorAll: () => [], appendChild() {}, remove() {}, focus() {} });
  const store = {};
  const sandbox = {
    console: { log() {}, warn() {}, error() {} }, setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, requestAnimationFrame: () => 0, Promise, Date, Math, JSON, URLSearchParams, encodeURIComponent, isFinite, isNaN,
    location: { hostname: 'localhost', hash: '', reload() {} },
    localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
    navigator: {}, matchMedia: () => ({ matches: true }),
    document: { getElementById: el, querySelector: () => null, querySelectorAll: () => [], addEventListener() {}, createElement: el, body: { appendChild() {}, style: {} }, documentElement: { classList: { toggle() {} } }, visibilityState: 'visible', activeElement: null },
    supabase: { createClient: () => db },
  };
  sandbox.window = sandbox; sandbox.window.open = () => {}; sandbox.window.addEventListener = () => {};
  vm.createContext(sandbox);
  vm.runInContext(app + '\n;globalThis.__x = { S, ACT, PAGE, SHEET, D, render, viewToday, viewOrders, navHTML, needsYou, obSearch, obResultsHTML, obDupPairs, obUnheld, obVoidCommit, quoteById };', sandbox);
  const X = sandbox.__x;
  Object.assign(X.S, { data: data || fixture(), shopId: SH, user: { id: 'u1', email: 'ruth@shop.ug' }, shopName: 'Mukasa Hardware', role: 'manager', started: true, tasks: tasks || ALL, stack: [] });
  return X;
}
const quoteRow = (q) => {
  const { id, status, invoiced, invoicedAt, amountPaid, voided, date, ...payload } = q;
  return { id, shop_id: SH, status, invoiced: !!invoiced, invoiced_at: invoicedAt || null, invoiced_ts: null, amount_paid: amountPaid || 0, voided: !!voided, date: date || null, client_name: q.client.name, client_phone: null, payload };
};
const tablesFor = data => ({ saved_quotes: data.savedQuotes.map(quoteRow), customers: data.customers.map(c => ({ id: c.id, shop_id: SH, name: c.name, debt: c.debt, credit_limit: c.creditLimit, terms_days: c.termsDays })), customer_debt_log: [], decision_log: [] });

(async () => {
  /* 1. search */
  {
    const X = page(fakeDb({}));
    const kato = X.obSearch('kato');
    t.check(kato.custs.length === 1 && kato.orders.some(o => o.id === 1104) && kato.orders.some(o => o.id === 2427), 'a name finds the customer and every order of theirs, an old paid one too');
    t.check(kato.orders[kato.orders.length - 1].id === 1104 || kato.orders.findIndex(o => o.id === 1104) > kato.orders.findIndex(o => o.id === 2427), 'open orders come before old ones');
    t.check(X.obSearch('Q-2418').idHit && X.obSearch('Q-2418').orders[0].id === 2418 && X.obSearch('2418').orders[0].id === 2418 && X.obSearch('#2418').idHit.id === 2418, 'an order number goes straight to it');
    t.check(X.obSearch('0700333').custs.map(c => c.id).join() === 'C2', 'part of a phone number finds the customer');
    t.check(X.obSearch('zzz').orders.length === 0, 'nothing matches nothing');
    X.S.ui.srchQ = 'kato'; const r = X.obResultsHTML();
    t.check(/#1104/.test(r) && /Customers · /.test(r) && /<mark/.test(r), 'typing draws the matches, highlighted');
    X.S.ui.srchQ = ''; t.check(/Jump to/.test(X.obResultsHTML()), 'empty: recent and jump-to');
    t.check(/data-act="obsearch"/.test(X.viewToday()) && /data-act="obsearch"/.test(X.viewOrders()), 'search opens from Today and Orders');
    t.check(/PAGE|undefined|NaN/.test(X.PAGE.search({}).replace(/data-[a-z]+="[^"]*"/g, '')) === false, 'the search page draws');
  }
  /* 2. Today */
  {
    const X = page(fakeDb({}));
    const ny = X.needsYou();
    t.check(X.obUnheld(X.quoteById(2418)) && ny.rest.some(n => n.k === 'unheld' && n.q.id === 2418), 'Nansana’s packing job with nobody on it is an Assign row');
    t.check(ny.first && !X.obUnheld(ny.first), 'the featured card is a stuck order somebody holds');
    const tv = X.viewToday();
    t.check(/data-act="orderact" data-id="2418"/.test(tv) && />Assign</.test(tv), 'Today offers Assign for it');
    t.check(ny.rest.some(n => n.k === 'dup' && n.d.a.id === 2426 && n.d.b.id === 2427) && /Taken twice\?/.test(tv), 'Kato taken twice shows in Needs you');
    t.check(new RegExp(`<span class="m">${ny.total}</span>&nbsp;waiting`).test(tv), 'the waiting count is the rows drawn');
    t.check(/>Nudge<\/button>/.test(X.navHTML()), 'the centre button is labelled Nudge');
    t.check(/staff in/.test(tv) && /data-p="teamrules"/.test(tv), 'staff in today; the goal ring opens goals and limits');
    t.check(/#2418 · /.test(tv), 'rows carry the order number and amount');
  }
  /* 3. OrderAct */
  {
    const data = fixture(), db = fakeDb(tablesFor(data)), X = page(db, data);
    const pg = X.PAGE.orderact({ id: 2418 });
    t.check(/Nobody has it/.test(pg) && /Give it to/.test(pg) && /To On the road/.test(pg) && /Mark done/.test(pg), 'the page: nobody has it, the stage track, and who to give it to');
    t.check(/order is no longer|Assign it/.test(X.PAGE.order({ id: 2418 })) && !/Nobody holds it yet/.test(X.PAGE.order({ id: 2418 })), 'the order page offers Assign, not a dead bar');
    await X.ACT.oagive({ dataset: { id: '2418', to: 'W2' } });
    let row = db.tables.saved_quotes.find(q => q.id === 2418);
    t.check(row.payload.assignedWorkerId === 'W2' && row.payload.pickingStatus === 'awaiting_accept', 'given to Joy: hers to take');
    t.check(/ASSIGNED/.test(X.PAGE.orderact({ id: 2418 })), 'the stamp');
    await X.ACT.oaundo();
    row = db.tables.saved_quotes.find(q => q.id === 2418);
    t.check(row.payload.assignedWorkerId == null && !X.S.ui.oa, 'Undo: nobody has it again');
    await X.ACT.oanext({ dataset: { id: '2418' } });
    row = db.tables.saved_quotes.find(q => q.id === 2418);
    t.check(row.status === 'pending_delivery' && row.payload.stageLog.slice(-1)[0].status === 'pending_delivery', 'To On the road: the status column moves, logged');
    await X.ACT.oadone({ dataset: { id: '2418' } });
    row = db.tables.saved_quotes.find(q => q.id === 2418);
    t.check(row.status === 'completed' && row.payload.deliveredAt, 'Mark done: delivered, the invoice clock starts');
    await X.ACT.oaundo();
    t.check(db.tables.saved_quotes.find(q => q.id === 2418).status === 'pending_delivery', 'Undo puts it back on the road');
    const L = page(fakeDb({}), fixture(), ['team.nudge']);
    const lp = L.PAGE.orderact({ id: 2418 });
    t.check(/not on for this login/.test(lp) && !/data-act="oanext"/.test(lp) && !/data-act="oagive"/.test(lp), 'without order.move or order.assign it is shown, not offered');
  }
  /* 4. supplier asked */
  {
    const data = fixture(); const q = data.savedQuotes.find(x => x.id === 2427); q.items[0].supplierId = 'SUP1'; q.items[0].supplierName = 'Kiseka Steel';
    const db = fakeDb(tablesFor(data)), X = page(db, data);
    t.check(/Supplier asked/.test(X.PAGE.orderact({ id: 2427 })), 'a Checking order with a supplier line has the toggle');
    await X.ACT.oaasked({ dataset: { id: '2427' } });
    const rec = db.tables.saved_quotes.find(x => x.id === 2427).payload.supplierConfirms.SUP1;
    t.check(rec && typeof rec.askedAt === 'number' && rec.state === 'pending', 'asked: askedAt on the supplier, still waiting for their answer');
    t.check(/Kiseka asked/.test(X.PAGE.orderact({ id: 2427 })), 'and it names the supplier');
    await X.ACT.oaasked({ dataset: { id: '2427' } });
    t.check(!db.tables.saved_quotes.find(x => x.id === 2427).payload.supplierConfirms.SUP1.askedAt, 'off again');
  }
  /* 5. duplicates */
  {
    const data = fixture(), db = fakeDb(tablesFor(data)), X = page(db, data);
    const pg = X.PAGE.dup({ a: 2426, b: 2427 });
    t.check(/POSSIBLE DUPLICATE/.test(pg) && /Void <span class="m">#2427/.test(pg) && /Keep both/.test(pg) && /Both taken by Brian/.test(pg), 'side by side: the newer one picked, keep or void');
    X.ACT.dupvoid({ dataset: { a: '2426', b: '2427' } });
    t.check(/VOIDED/.test(X.PAGE.dup({ a: 2426, b: 2427 })) && /Undo/.test(X.PAGE.dup({ a: 2426, b: 2427 })) && !db.tables.saved_quotes.find(q => q.id === 2427).voided, 'void: stamped, nothing written while Undo stands');
    await X.ACT.dupundo();
    t.check(!X.S.obVoid && X.S.ui.dup.outcome === '', 'Undo: nothing happened');
    X.ACT.dupvoid({ dataset: { a: '2426', b: '2427' } });
    await X.obVoidCommit();
    const row = db.tables.saved_quotes.find(q => q.id === 2427);
    t.check(row.voided === true && row.payload.cancelledAt && row.payload.voidedBy.why === 'duplicate' && row.payload.voidedBy.keeps === 2426, 'then the void is written, stamped cancelled, the keeper named');
    t.check(!X.obDupPairs().length && db.tables.saved_quotes.find(q => q.id === 2426).voided === false, 'the pair leaves Needs you; the keeper stays');
    const d2 = fixture(), db2 = fakeDb(tablesFor(d2)), Y = page(db2, d2);
    Y.PAGE.dup({ a: 2426, b: 2427 });
    await Y.ACT.dupkeep({ dataset: { a: '2426', b: '2427' } });
    t.check(db2.tables.saved_quotes.find(q => q.id === 2427).payload.dupOkWith.join() === '2426' && !Y.obDupPairs().length, 'Keep both is remembered on the order, so the pair stops showing');
    const N = page(fakeDb({}), fixture(), ['order.move']);
    t.check(/not on for this login/.test(N.PAGE.dup({ a: 2426, b: 2427 })), 'without invoice.void the pair is shown, not offered');
  }
  process.exit(t.done() ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
