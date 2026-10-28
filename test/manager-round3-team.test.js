#!/usr/bin/env node
'use strict';
/*
 * Round 3, the team and settings screens of manager.html:
 *
 *   1. Team: "on staff · <name> marked off today", buying as plain counts,
 *      "Give a job" for someone with room (order.assign), everyone listed.
 *   2. Edit a customer: "Save N changes", a before→after check, one write,
 *      and Undo writes the old values back the same way.
 *   3. You: each door's waiting count agrees with Decide and needs-you, and
 *      a door opens its own screen in one tap.
 *
 * Run: node test/manager-round3-team.test.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { createReporter } = require('./_extract');
const { fixture, ALL } = require('./_manager-decide-fixture');

const t = createReporter('manager round 3 · team and settings');
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
    if (this.op === 'update') { writes.push(['update', this.t, clone(this.row)]); hit.forEach(r => Object.assign(r, clone(this.row))); return Promise.resolve({ error: null }).then(res, rej); }
    return Promise.resolve({ data: clone(this.one ? (hit[0] || null) : hit), error: null }).then(res, rej);
  };
  return { writes, rpcs, tables, auth: { getUser: () => new Promise(() => {}), getSession: async () => ({ data: { session: null } }), signOut: async () => ({}) }, from: tb => new Q(tb),
    rpc: async (fn, args) => { rpcs.push([fn, JSON.parse(JSON.stringify(args))]); return { data: { ok: true }, error: null }; } };
}
function page(db, data, tasks){
  const el = () => ({ innerHTML: '', textContent: '', value: '', children: [], style: {}, dataset: {}, classList: { add() {}, remove() {}, toggle() {} }, setAttribute() {}, querySelector: () => null, querySelectorAll: () => [], appendChild() {}, remove() {}, focus() {} });
  const store = {};
  const sandbox = {
    console: { log() {}, warn() {}, error() {} }, setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, requestAnimationFrame: () => 0, Promise, Date, Math, JSON, URLSearchParams, encodeURIComponent, isFinite, isNaN,
    location: { hostname: 'localhost', hash: '', reload() {} },
    localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
    navigator: {}, matchMedia: () => ({ matches: true }), scrollTo() {},
    document: { getElementById: el, querySelector: () => null, querySelectorAll: () => [], addEventListener() {}, createElement: el, body: { appendChild() {}, style: {} }, documentElement: { classList: { toggle() {} } }, visibilityState: 'visible', activeElement: null },
    supabase: { createClient: () => db },
  };
  sandbox.window = sandbox; sandbox.window.open = () => {}; sandbox.window.addEventListener = () => {};
  vm.createContext(sandbox);
  vm.runInContext(app + '\n;globalThis.__x = { S, ACT, PAGE, SHEET, D, viewTeam, jobToGive, buyingCounts, doorWaiting, decideCounts, needsYou, customerById, ceDiffs };', sandbox);
  const X = sandbox.__x;
  Object.assign(X.S, { data: data || fixture(), shopId: SH, user: { id: 'u1', email: 'ruth@shop.ug' }, shopName: 'Mukasa Hardware', role: 'manager', started: true, tasks: tasks || ALL, stack: [] });
  return X;
}
function shop(){
  const d = fixture(), NOW = Date.now(), H = 3600e3;
  d.staff.push({ id: 'D2', name: 'Hassan Lule', phone: '', role: 'delivery', unavailable: true, userId: null });
  d.savedQuotes.push({ id: 2440, status: 'preparing', invoiced: false, voided: false, client: { name: 'Lubowa Builders' }, customerId: 'C4', items: [], charges: [], payments: [], takenBy: 'u2', createdAt: new Date(NOW - 4 * H).toISOString(), stageEnteredAt: NOW - 3 * H, assignedWorkerId: 'W1', pickingStatus: 'awaiting_accept' });
  d.savedQuotes.push({ id: 2442, status: 'draft', invoiced: false, voided: false, client: { name: 'Nansana Hardware' }, customerId: 'C6', items: [
    { lineId: 1, productId: 'P3', qty: 10, supplierId: 'SUP1', price: 18000, sellPrice: 22500 }, { lineId: 2, productId: 'P4', qty: 3, supplierId: 'SUP1', price: 40000, sellPrice: 51000 }, { lineId: 3, productId: 'P2', qty: 30, supplierId: 'SUP2', price: 34500, sellPrice: 38640 }],
    supplierConfirms: { SUP1: { state: 'pending', askedAt: new Date(NOW - H).toISOString() }, SUP2: { state: 'problem', askedAt: new Date(NOW - H).toISOString() } }, charges: [], payments: [], takenBy: 'u2', createdAt: new Date(NOW - 2 * H).toISOString(), stageEnteredAt: NOW - 2 * H });
  return d;
}

(async () => {
  /* ---------------- 1. the Team tab ---------------- */
  {
    const X = page(fakeDb({}), shop()), v = X.viewTeam();
    t.check(/on staff · Hassan marked off today/.test(v) && !/in today/.test(v), 'the header says who is marked off, and counts nobody "in"');
    const k = X.buyingCounts(X.D().staff.find(s => s.id === 'B1'));
    t.check(k.asked === 3 && k.answered === 1, `buying in plain counts: 3 lines asked, 1 answered (got ${k.asked}/${k.answered})`);
    t.check(/ASKED/.test(v) && /ANSWERED/.test(v), 'the buyer row shows the counts');
    const j = X.jobToGive(X.D().staff.find(s => s.id === 'W2'));
    t.check(j && j.id === 2440, 'Joy has room: the packing job Musa has not taken is the one to give her');
    t.check(/data-act="givejob" data-who="W2" data-id="2440"/.test(v), 'and her row offers "Give a job"');
    X.ACT.givejob({ dataset: { who: 'W2', id: '2440' } });
    t.check(X.S.sheet && X.S.sheet.type === 'reassign' && X.S.sheet.args.sel === 'W2' && X.S.sheet.args.id === 2440, 'it opens the hand-over sheet with her already picked');
    t.check(!X.jobToGive(X.D().staff.find(s => s.id === 'D2')), 'nobody off today is offered a job');
    const shown = (v.match(/data-act="push" data-p="person" data-id="([^"]+)"/g) || []).map(x => x.match(/data-id="([^"]+)"/)[1]);
    const missing = X.D().staff.filter(s => s.id !== 'M1' && !shown.includes(s.id)).map(s => s.name);
    t.check(!missing.length && /Other jobs/.test(v), 'everyone on staff is listed somewhere (accounts under Other jobs): ' + (missing.join(', ') || 'none missing'));
    t.check(!/SHELF|Room for|they bring it|nothing asked yet/.test(v), 'the plain words replace SHELF, Room for, they bring it');
    const L = page(fakeDb({}), shop(), ['order.move']);
    t.check(!/data-act="givejob"/.test(L.viewTeam()), 'without order.assign no job is offered');
  }

  /* ---------------- 2. editing a customer ---------------- */
  {
    const data = shop(), db = fakeDb({ customers: data.customers.map(c => ({ id: c.id, shop_id: SH, name: c.name, phone: c.phone, location: c.location, credit_limit: c.creditLimit, terms_days: c.termsDays })), decision_log: [] }), X = page(db, data);
    X.S.stack = [{ type: 'custedit', args: { id: 'C2' } }];
    t.check(/Nothing changed/.test(X.PAGE.custedit({ id: 'C2' })), 'untouched, the Save button says nothing changed');
    const st = X.S.ui['ce:C2']; st.limit = 2500000; st.terms = 14; st.phone = '0772 118 460';
    t.check(/Save 3 changes/.test(X.PAGE.custedit({ id: 'C2' })), 'three edits: "Save 3 changes"');
    t.check(!/data-act="cestep"[^>]*data-f="terms"/.test(X.PAGE.custedit({ id: 'C2' })), 'terms are the four chips, no stepper');
    X.ACT.ceask({ dataset: { id: 'C2' } });
    const sh = X.SHEET.cecheck({ id: 'C2' });
    t.check(X.S.sheet.type === 'cecheck' && /3,000,000/.test(sh) && /2,500,000/.test(sh) && /7 days/.test(sh) && /14 days/.test(sh), 'the check shows each change before and after');
    await X.ACT.cesave({ dataset: { id: 'C2' } });
    const row = db.tables.customers.find(c => c.id === 'C2');
    t.check(row.credit_limit === 2500000 && row.terms_days === 14 && row.phone === '0772 118 460' && db.writes.filter(w => w[1] === 'customers').length === 1, 'one write carries all three');
    t.check(db.tables.decision_log.some(l => l.task === 'customer.edit' && l.before.phone === '0700333444'), 'the phone change is logged with what it was (limit and terms by the server guard)');
    t.check(db.rpcs.some(r => r[0] === 'tell_customer_change' && r[1].p_to === 'u2'), 'Grace, who last sold to them, is told');
    await X.ACT.ceundo();
    t.check(row.credit_limit === 3000000 && row.terms_days === 7 && row.phone === '0700333444', 'Undo writes the old values back');
    t.check(db.tables.decision_log.filter(l => l.task === 'customer.edit').length === 2 && /^Undid/.test(db.tables.decision_log.filter(l => l.task === 'customer.edit')[1].what), 'and the undo is logged too');
  }

  /* ---------------- 3. You: the doors ---------------- */
  {
    const X = page(fakeDb({}), shop()), w = X.doorWaiting(), c = X.decideCounts(), ny = X.needsYou();
    t.check(w.total === c.total + ny.total, `the doors add up to Decide plus needs-you: ${w.total} = ${c.total} + ${ny.total}`);
    const me = X.PAGE.me({});
    t.check(new RegExp(`>${w.total}</b> waiting on you`).test(me) && /You decide these\. The owner gets the/.test(me), 'the header says how many wait, and the owner gets the log');
    t.check(new RegExp(`aria-label="${w.prices} waiting"`).test(me) && /aria-label="nothing waiting"/.test(me), 'a red count where something waits, a mint dot where nothing does');
    X.S.stack = [{ type: 'me', args: {} }];
    X.ACT.door({ dataset: { v: 'prices' } });
    t.check(X.S.stack[X.S.stack.length - 1].type === 'price', 'one tap on Prices opens the oldest price to decide');
    X.ACT.door({ dataset: { v: 'see' } });
    t.check(X.S.view === 'team' && !X.S.stack.length, 'See the team opens the Team tab');
    X.ACT.door({ dataset: { v: 'goals' } });
    t.check(X.S.stack[X.S.stack.length - 1].type === 'teamrules', 'Goals opens the team’s rules');
  }

  process.exit(t.done() ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
