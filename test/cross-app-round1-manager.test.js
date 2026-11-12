#!/usr/bin/env node
'use strict';
/*
 * Cross-app round 1 (docs/audit/cross-app/ROUND-1.md), the Manager (manager.html):
 *   X-1  Sales' ask to cancel (cancel_asks, 0181) reaches Decide now, counted in Returns; Cancel answers it through
 *        answer_cancel_ask (yes → cancel_order, 0177) — #0608's path; Keep the order answers no
 *   X-2  an order with a line that has no stock and no supplier is never "all found"
 *   X-3  a login with no staff card is named by the name they chose; the buyer is found by login role too
 *   X-4  orders placed today are "Taken today", never "Sold today"; a test order is in no figure
 *
 * The harness is test/manager-decide.test.js's (a fake database, the page run in a vm).
 * Run: node test/cross-app-round1-manager.test.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { createReporter } = require('./_extract');
const { fixture, ALL, NOW } = require('./_manager-decide-fixture');

const t = createReporter('cross-app round 1 manager');
const html = fs.readFileSync(path.join(__dirname, '..', 'manager.html'), 'utf8');
const app = [...html.matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]).filter(s => /const S = \{/.test(s)).join('\n');
const SH = 'shop1';
const TASKS = ALL.concat('order.cancel');   // 0177 grants the one Cancel to the Manager

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
      if (fn === 'next_row_id_blocks') { const k = args.p_kinds[0]; if (!/^row:[a-z_]+$/.test(k)) return { data: null, error: { code: 'P0001', message: 'unknown row id kind: ' + k } }; nextId = Math.max(nextId, Number(args.p_floors[k]) || 0) + 1; return { data: { [k]: nextId }, error: null }; }
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
  vm.runInContext(app + '\n;globalThis.__x = { S, ACT, PAGE, SHEET, D, render, viewToday, priceCases, counterCases, decideCounts, decideCardHTML, decidePrice, cancelAsks, memberName, whyStuck, obTakerWords, team, todayMoney, soldTodayHTML, lineWaitsPrice, shortPicks, invoiceQueue, tripDiffs, openAsks, agentAsks, quoteTotal, quoteById, customerById, linePriceNow, shopSellPrice };', sandbox);
  const X = sandbox.__x;
  Object.assign(X.S, { data: data || fixture(), shopId: SH, user: { id: 'u1', email: 'ruth@shop.ug' }, shopName: 'Mukasa Hardware', role: 'manager', started: true, tasks: tasks || ALL, stack: [{ type: 'decide', args: {} }] });
  return X;
}
const quoteRow = (q) => {
  const { id, status, invoiced, invoicedAt, amountPaid, voided, date, ...payload } = q;
  return { id, shop_id: SH, status, invoiced: !!invoiced, invoiced_at: invoicedAt || null, invoiced_ts: null, amount_paid: amountPaid || 0, voided: !!voided, date: date || null, client_name: q.client.name, client_phone: null, payload };
};
const tablesFor = data => ({ saved_quotes: data.savedQuotes.map(quoteRow), customers: data.customers.map(c => ({ id: c.id, shop_id: SH, name: c.name, debt: c.debt, credit_limit: c.creditLimit, terms_days: c.termsDays })), customer_debt_log: [], decision_log: [] });


const ago = ms => new Date(NOW - ms).toISOString();
function withAsk(){
  const data = fixture();
  // #0608: a Walk-in in Checking, 430,000, one line with nothing on the shelf and no supplier, taken by Daphine (a login, no staff card).
  data.savedQuotes.push({ id: 608, status: 'draft', invoiced: false, voided: false, amountPaid: 0, date: null, client: { name: 'Walk-in' }, customerId: null,
    items: [{ lineId: 'L608-0', productId: 'P9', productName: 'Soft Close Mulper', qty: 2, unit: 'prs', price: 150000, sellPrice: 215000, supplierId: '' }],
    charges: [], payments: [], takenBy: 'u-daph', createdAt: ago(3600e3) });
  data.cancelAsks = [{ id: 'ca-608', quoteId: 608, why: 'Customer changed their mind', note: '', amount: 430000, stage: 'draft', askedBy: 'u-daph', askedByName: 'daphine@x', status: 'sent', createdAt: ago(16 * 60e3) }];
  data.members = [{ userId: 'u-daph', role: 'sales', name: 'Daphine' }, { userId: 'u-kev', role: 'buyer', name: 'Kevin' }];
  return data;
}

(async () => {
  /* X-1 */
  {
    const base = page(fakeDb({}));
    const before = base.decideCounts().returns;
    const data = withAsk(), db = fakeDb({ cancel_asks: [{ id: 'ca-608', shop_id: SH, quote_id: 608, status: 'sent' }] }), X = page(db, data, TASKS);
    const c = X.decideCounts();
    t.check(c.returns === before + 1 && X.cancelAsks().length === 1, `X-1: the cancel ask is counted in Returns (${before} → ${c.returns})`);
    t.check(/Returns · cancels/.test(X.decideCardHTML()), 'X-1: the tile says it holds a cancel');
    const d = X.PAGE.decide({});
    t.check(/Cancel ask · Walk-in/.test(d) && /Daphine asks · Customer changed their mind/.test(d) && /data-p="cancelask" data-id="ca-608"/.test(d), 'X-1: one row in Decide now, named by the asker\'s own name, opening the ask');
    const pg = X.PAGE.cancelask({ id: 'ca-608' });
    t.check(/CANCEL ASK · FROM DAPHINE/.test(pg) && /Customer changed their mind/.test(pg) && /IF YOU CANCEL/.test(pg) && /data-act="cxyes"/.test(pg) && /Keep the order/.test(pg), 'X-1: the ask page: why, what a cancel does, Keep the order / Cancel');
    const locked = page(fakeDb({}), withAsk(), ALL.filter(x => x !== 'order.cancel')).PAGE.cancelask({ id: 'ca-608' });
    t.check(/order\.cancel/.test(locked) && !/data-act="cxyes"/.test(locked), 'X-1: without order.cancel the answer is locked');
    X.S.stack.push({ type: 'cancelask', args: { id: 'ca-608' } });
    await X.ACT.cxyes({ dataset: { id: 'ca-608' } });
    const call = db.rpcs.find(r => r[0] === 'answer_cancel_ask');
    t.check(call && call[1].p_id === 'ca-608' && call[1].p_yes === true && call[1].p_choice === null, 'X-1: Cancel calls answer_cancel_ask(yes) — cancel_order does the rest in one write (#0608)');
    t.check(X.cancelAsks().length === 0 && X.decideCounts().returns === before, 'X-1: answered, it leaves Decide now');
    const Y = page(fakeDb({}), withAsk(), TASKS);
    Y.S.stack.push({ type: 'cancelask', args: { id: 'ca-608' } });
    await Y.ACT.cxno({ dataset: { id: 'ca-608' } });
    t.check(Y.cancelAsks().length === 0, 'X-1: Keep the order answers no and leaves the queue');
  }
  /* X-2, X-3 */
  {
    const X = page(fakeDb({}), withAsk());
    const q = X.D().savedQuotes.find(x => x.id === 608);
    const w = X.whyStuck(q).w;
    t.check(/1 line needs a supplier/.test(w) && !/all found/.test(w), `X-2: "${w}", never "all found"`);
    t.check(X.obTakerWords(q) === 'by Daphine', 'X-3: a login with no staff card is named by the name they chose');
    t.check(X.team().buyers.some(b => b.name === 'Kevin'), 'X-3: the buyer is found by login role when there is no staff card');
  }
  /* X-4 */
  {
    const data = withAsk();
    data.savedQuotes.push({ ...data.savedQuotes.find(x => x.id === 608), id: 609, qa: true });
    const X = page(fakeDb({}), data);
    const m = X.todayMoney();
    t.check(!m.sold.some(q => q.id === 609) && m.sold.some(q => q.id === 608), 'X-4: a test order is in no figure');
    t.check(/Taken today/.test(X.soldTodayHTML(m)) && !/Sold today/.test(X.soldTodayHTML(m)), 'X-4: orders placed today are "Taken today"');
  }
  process.exit(t.done() ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
