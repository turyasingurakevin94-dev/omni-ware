#!/usr/bin/env node
'use strict';
/*
 * Round 4, three asks that reach the Manager (manager.html):
 *
 *   1. PriceAtCost: a line sold under its cost opens on the cost, amber
 *      "at cost · no margin"; saving on the cost asks a second yes; above
 *      it the chip is green; the money strip and the cost was -> now.
 *   2. CreditAsk: the Store's "on credit?" (payload.creditAsk) waits in
 *      Decide now and on Today; "Let it go" writes the limit and terms to
 *      the customer and releases the order (creditCheck), "Cash first"
 *      keeps it held; Undo puts both back; the push opens it.
 *   3. A carton's shelf part (restock_buys for_line, 0151): told apart on
 *      the restock page; Approve waits out the Undo window, then
 *      hold_restock_buy(id, false); a row with no for_line stays ordinary.
 *
 * Run: node test/manager-round4-asks.test.js   (or: npm test)
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { createReporter } = require('./_extract');
const { fixture, ALL } = require('./_manager-round4-fixture');

const t = createReporter('manager round 4 asks');
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
    const rows = tables[this.t] || (tables[this.t] = []), clone = x => JSON.parse(JSON.stringify(x));
    if (this.op === 'insert') { writes.push(['insert', this.t, clone(this.row)]); rows.push(clone(this.row)); return Promise.resolve({ error: null }).then(res, rej); }
    const hit = rows.filter(r => this.f.every(f => f(r)));
    if (this.op === 'update') { writes.push(['update', this.t, clone(this.row)]); hit.forEach(r => Object.assign(r, clone(this.row))); return Promise.resolve({ error: null }).then(res, rej); }
    return Promise.resolve({ data: clone(this.one ? (hit[0] || null) : hit), error: null }).then(res, rej);
  };
  return { writes, rpcs, tables, auth: { getUser: () => new Promise(() => {}), getSession: async () => ({ data: { session: null } }), signOut: async () => ({}) }, from: tb => new Q(tb),
    rpc: async (fn, args) => { rpcs.push([fn, JSON.parse(JSON.stringify(args))]); return { data: { ok: true }, error: null }; } };
}
function page(db, data){
  const timers = [];
  const el = () => ({ innerHTML: '', textContent: '', value: '', children: [], style: {}, dataset: {}, classList: { add() {}, remove() {}, toggle() {} }, setAttribute() {}, querySelector: () => null, querySelectorAll: () => [], appendChild() {}, remove() {}, focus() {} });
  const sandbox = {
    console: { log() {}, warn() {}, error() {} }, setTimeout: (f, ms) => { timers.push({ f, ms, live: true }); return timers.length; }, clearTimeout: id => { if (timers[id - 1]) timers[id - 1].live = false; }, setInterval: () => 0, requestAnimationFrame: () => 0,
    Promise, Date, Math, JSON, URLSearchParams, encodeURIComponent, isFinite, isNaN,
    location: { hostname: 'localhost', hash: '', reload() {} }, localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    navigator: {}, matchMedia: () => ({ matches: true }), scrollTo() {},
    document: { getElementById: el, querySelector: () => null, querySelectorAll: () => [], addEventListener() {}, createElement: el, body: { appendChild() {}, style: {} }, documentElement: { classList: { toggle() {} } }, visibilityState: 'visible', activeElement: null },
    supabase: { createClient: () => db },
  };
  sandbox.window = sandbox; sandbox.window.open = () => {}; sandbox.window.addEventListener = () => {};
  vm.createContext(sandbox);
  vm.runInContext(app + '\n;globalThis.__x = { S, ACT, PAGE, SHEET, D, priceCases, decideCounts, creditAsks, cartonAsks, needsYou, pushOpen, priceInputHTML, customerById, quoteById, lineCostUp };', sandbox);
  const X = sandbox.__x;
  Object.assign(X.S, { data: data || fixture(), shopId: SH, user: { id: 'u1', email: 'ruth@shop.ug' }, shopName: 'Mukasa Hardware', role: 'manager', started: true, tasks: ALL, stack: [{ type: 'decide', args: {} }] });
  return { X, timers };
}
const quoteRow = q => { const { id, status, invoiced, invoicedAt, amountPaid, voided, date, ...payload } = q;
  return { id, shop_id: SH, status, invoiced: !!invoiced, invoiced_at: invoicedAt || null, invoiced_ts: null, amount_paid: amountPaid || 0, voided: !!voided, date: date || null, client_name: q.client.name, client_phone: null, payload }; };
const tablesFor = d => ({ saved_quotes: d.savedQuotes.map(quoteRow), customers: d.customers.map(c => ({ id: c.id, shop_id: SH, name: c.name, debt: c.debt, credit_limit: c.creditLimit, terms_days: c.termsDays })), decision_log: [] });

(async () => {
  /* 1. a price at cost */
  {
    const d = fixture(), db = fakeDb(tablesFor(d)), { X } = page(db, d);
    const hit = X.priceCases().find(x => x.q.id === 2426);
    t.check(hit && hit.lines[0].kind === 'nomargin' && X.lineCostUp(hit.lines[0].it).was === 120000, 'the wheelbarrows wait as a line sold under its cost, the cost up from 120,000');
    const pg = X.PAGE.pricenew({ id: 2426 });
    t.check(X.S.ui['pn:2426:0'] === 165000 && /at cost · no margin/.test(pg) && /SOLD UNDER COST/.test(pg) && /COST WAS/.test(pg) && /\+45,000/.test(pg), 'it opens on the cost, amber, with the cost was → now');
    t.check(/Before/.test(pg) && /At 155K/.test(pg) && /−60,000/.test(pg) && /Like before/.test(pg), 'the money strip: before, at the old price a loss of 60,000, and yours; three quick prices');
    t.check(/4\.1% margin/.test(X.priceInputHTML('k', 172000, 165000, null, 6, 1000)) && /line \+42,000/.test(X.priceInputHTML('k', 172000, 165000, null, 6, 1000)) && /var\(--greenSoft\)/.test(X.priceInputHTML('k', 172000, 165000, null, 6, 1000)), 'above cost the chip is green with the line’s margin');
    await X.ACT.pnset({ dataset: { id: '2426' } });
    t.check(X.S.ui.pnsure === 2426 && /Sell at cost\?/.test(X.PAGE.pricenew({ id: 2426 })) && !db.writes.some(w => w[1] === 'saved_quotes'), 'saving on the cost asks “Sell at cost?” first and writes nothing');
    X.ACT.pcostno();
    t.check(X.S.ui.pnsure == null, 'Change goes back to the stepper');
    await X.ACT.pnset({ dataset: { id: '2426', sure: '1' } });
    const it = db.tables.saved_quotes.find(q => q.id === 2426).payload.items[0];
    t.check(it.sellPrice === 165000 && it.priceReview.state === 'changed' && it.priceReview.was === 155000, 'Yes, no margin: the line is set at its cost');
    t.check(/AT COST/.test(X.PAGE.pricenew({ id: 2426 })) && X.S.obUndo, 'the stamp says AT COST and Undo is offered');
    await X.S.obUndo();
    const back = db.tables.saved_quotes.find(q => q.id === 2426).payload.items[0];
    t.check(back.sellPrice === 155000 && !back.priceReview, 'Undo puts the line back to waiting');
  }
  /* 2. the Store's "on credit?" */
  {
    const d = fixture(), db = fakeDb(tablesFor(d)), { X } = page(db, d);
    const a = X.creditAsks();
    t.check(a.length === 1 && a[0].q.id === 2431 && a[0].isNew && a[0].asker.name === 'Musa Kiggundu', 'Musa’s ask on a new cash-only customer waits');
    t.check(X.decideCounts().credit === 2 && /SOMEONE IS WAITING NOW/.test(X.PAGE.decide({})) && /LOADING NOW · MUSA ASKS/.test(X.PAGE.decide({})), 'Decide now counts it and shows it on top, with the clock');
    t.check(X.needsYou().rest[0].k === 'creditask', 'and it leads Needs you on Today');
    X.S.stack = []; X.pushOpen({ kind: 'credit.ask', id: '2431' });
    t.check(X.S.stack.map(s => s.type).join() === 'decide,creditask', 'its push opens the ask over Decide now');
    const pg = X.PAGE.creditask({ id: 2431 });
    t.check(/Let it go on credit\?/.test(pg) && /Ssali’s truck/.test(pg) && /no limit set/.test(pg) && /data-act="ckcash"/.test(pg) && /data-act="ckcredit"/.test(pg), 'the ask: the truck, no limit, Cash first and Let it go');
    X.ACT.ckcredit({ dataset: { id: '2431' } });
    t.check(/2\.5M/.test(X.PAGE.creditask({ id: 2431 })) && /Let it go · 3M · 7d/.test(X.PAGE.creditask({ id: 2431 })), 'limit choices from the order up, 3M and 7 days to start');
    await X.ACT.ckgo({ dataset: { id: '2431' } });
    const c = db.tables.customers.find(x => x.id === 'C7'), q = db.tables.saved_quotes.find(x => x.id === 2431).payload;
    t.check(c.credit_limit === 3000000 && c.terms_days === 7, 'the limit and terms land on the customer');
    t.check(q.creditCheck.decision === 'release' && q.creditCheck.ask === true && q.creditAsk.answer.decision === 'credit', 'the order is released and the ask answered');
    t.check(/ON CREDIT/.test(X.PAGE.creditask({ id: 2431 })) && /data-act="ckundo"/.test(X.PAGE.creditask({ id: 2431 })) && !X.creditAsks().length, 'stamped ON CREDIT with Undo; nothing waits now');
    await X.ACT.ckundo({ dataset: { id: '2431' } });
    const c2 = db.tables.customers.find(x => x.id === 'C7'), q2 = db.tables.saved_quotes.find(x => x.id === 2431).payload;
    t.check(c2.credit_limit === null && c2.terms_days === null && !q2.creditCheck && !q2.creditAsk.answer && X.creditAsks().length === 1, 'Undo puts the customer and the ask back');
    await X.ACT.ckcash({ dataset: { id: '2431' } });
    const q3 = db.tables.saved_quotes.find(x => x.id === 2431).payload;
    t.check(q3.creditCheck.decision === 'cash' && q3.creditAsk.answer.decision === 'cash' && db.tables.customers.find(x => x.id === 'C7').credit_limit === null, 'Cash first keeps it held and leaves the customer cash only');
  }
  /* 3. a carton's shelf part */
  {
    const d = fixture(), db = fakeDb(tablesFor(d)), { X, timers } = page(db, d);
    t.check(X.cartonAsks().length === 1 && X.decideCounts().stock === 5, 'the carton waits, counted with stock');
    const pg = X.PAGE.restock();
    t.check(/Asked by Denis · a carton for <span class="m">1<\/span> sold/.test(pg) && /The shelf · <span class="m">199<\/span>/.test(pg) && (pg.match(/width:6px;height:6px/g) || []).length === 200, 'told apart: asked by Denis, 1 sold, the 200-square carton');
    t.check(/Hima cement/.test(pg) && !/data-act="rshold" data-id="rs-3"/.test(pg), 'the ordinary list stays below, without the carton');
    X.ACT.ctnyes({ dataset: { id: 'rs-3' } });
    t.check(/SHELF OK/.test(X.PAGE.restock()) && !db.rpcs.length, 'Approve stamps at once and waits out the Undo window');
    X.ACT.ctnundo({ dataset: { id: 'rs-3' } });
    t.check(!/SHELF OK/.test(X.PAGE.restock()) && X.cartonAsks().length === 1, 'Undo takes it back before anything is written');
    X.ACT.ctnyes({ dataset: { id: 'rs-3' } });
    await timers.filter(x => x.live && x.ms === 6000).pop().f();
    t.check(db.rpcs.length === 1 && db.rpcs[0][0] === 'hold_restock_buy' && db.rpcs[0][1].p_hold === false, 'then hold_restock_buy(id, false) lets it go');
    X.S.stack = []; X.pushOpen({ kind: 'carton.ask', id: 'rs-3' });
    t.check(X.S.stack.map(s => s.type).join() === 'decide,restock', 'the carton push opens the restock page');
    const e = fixture(); delete e.restockLines[2].forLine;
    const { X: Y } = page(fakeDb(tablesFor(e)), e);
    t.check(!Y.cartonAsks().length && /data-act="rshold" data-id="rs-3"/.test(Y.PAGE.restock()), 'without for_line (main before 0151) it is an ordinary held line');
  }
  t.done();
})();
