#!/usr/bin/env node
'use strict';
/*
 * Round 3, the Manager's money (manager.html):
 *
 *   1. The owner's debt bands: under 7 · 8–21 · 22–30 · over 30 days, the
 *      hold line between 8–21 and 22–30.
 *   2. Money, option B: In today (today's receipts) and To collect (the
 *      bands, a band chip filters the list and the total follows it).
 *   3. Take a payment: what it clears is the debtor sheet's own bills; the
 *      red Record button asks, and the write waits out the Undo window.
 *   4. Delivered: each day is its own orders, paid and owed apart.
 *
 * Run: node test/manager-round3-money.test.js   (or: npm test)
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { createReporter } = require('./_extract');
const { fixture, ALL, NOW, DAY, iso } = require('./_manager-decide-fixture');

const t = createReporter('manager round 3 money');
const html = fs.readFileSync(path.join(__dirname, '..', 'manager.html'), 'utf8');
const app = [...html.matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]).filter(s => /const S = \{/.test(s)).join('\n');

function page(){
  const rpcs = [], timers = [];
  const db = { auth: { getUser: () => new Promise(() => {}), getSession: async () => ({ data: { session: null } }), signOut: async () => ({}) },
    from: () => { const q = { select: () => q, eq: () => q, in: () => q, gt: () => q, gte: () => q, neq: () => q, or: () => q, order: () => q, limit: () => q, maybeSingle: () => q, then: (res) => Promise.resolve({ data: [], error: null }).then(res) }; return q; },
    rpc: async (fn, args) => { rpcs.push([fn, args]); return { data: { amount: args.p_amount, method: args.p_method, bills: [], before: 2310000, after: 2310000 - args.p_amount, cashRows: [] }, error: null }; } };
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
  vm.runInContext(app + '\n;globalThis.__x = { S, ACT, PAGE, SHEET, D, ageBand, debtBands, debtors, viewMoney, payClears, payOldest, customerById, deliveredOn, holdDays, viewOrders };', sandbox);
  const X = sandbox.__x;
  Object.assign(X.S, { data: fixture(), shopId: 'shop1', user: { id: 'u1', email: 'ruth@shop.ug' }, shopName: 'Mukasa Hardware', role: 'manager', started: true, tasks: ALL });
  X.render = () => {};
  return { X, rpcs, timers };
}

(async () => {
  /* 1. bands */
  {
    const { X } = page();
    t.check([0, 7, 8, 21, 22, 30, 31, 90].map(X.ageBand).join() === '0,0,1,1,2,2,3,3', 'ages fall into under 7 · 8–21 · 22–30 · over 30');
    const b = X.debtBands(X.debtors());
    // Manager round 1 (MGR-DATA-02): what is owed comes from the bills, so the delivered bills still due (#2383 1,701,980,
    // #2382 300,000, #2385 1,076,000) count too: Kyaligonza, Ggaba and Nansana's stored balances don't hold them.
    t.check(b[0] === 1432000 + 2448000 + 1701980 + 300000 + 1076000 && b[1] === 746000 + 560000 && b[2] === 615000 && b[3] === 878000, 'each bill counted by its own age: ' + b.join(', '));
    t.check(X.ageBand(X.holdDays()) === 1, 'the 21-day hold line closes the 8–21 band');
  }
  /* 2. Money, option B */
  {
    const { X } = page();
    const inn = X.viewMoney();
    t.check(/IN TODAY/.test(inn) && /2,836,000/.test(inn) && /\+2,180,000/.test(inn) && /data-act="takepay"/.test(inn), 'In today: today’s receipts, their total, and Take a payment');
    X.S.view = 'today'; X.ACT.chase();
    t.check(X.S.ui.money === 'over30' && X.S.ui.mside === 'out', 'Chase opens To collect on the over-30 band');
    const out = X.viewMoney();
    t.check(/>878,000<\/span>/.test(out) && /<span class="m" style="color:var\(--ink\)">1<\/span> of <span class="m">6<\/span> customers/.test(out), 'the total follows the filter: 878,000 · 1 of 6 customers (Nansana owes #2385 from the bills)');
    t.check(/Mukono Roofing/.test(out) && !/Ggaba Stores/.test(out) && /over 30 days/.test(out) && /credit holds at <span class="m">21<\/span> days/.test(out), 'only the over-30 debtor is listed; bands say days and the hold line is drawn');
    t.check((out.match(/class="mx-track"/g) || []).length === 1 && /class="tick" style="left:52.5%"/.test(out), 'each debtor row has its own age track with the hold tick at 21 of 40 days');
  }
  /* 3. take a payment */
  {
    const { X, rpcs, timers } = page();
    const c2 = X.customerById('C2');
    t.check(X.payOldest(c2) === 878000 && X.payClears(c2, 878000).bills[0].label === 'INV-0380' && X.payClears(c2, 878000).bills[0].pay === 878000, 'the oldest bill comes from the debtor sheet’s bills (INV-0380, 878,000)');
    X.S.stack = [{ type: 'pay', args: { id: 'C2' } }];
    const pg = X.PAGE.pay(X.S.stack[0].args);
    t.check(/Record <span class="m">878,000<\/span>/.test(pg) && /data-act="payask"/.test(pg) && !/data-slide="pay"/.test(pg), 'the main action is a red Record 878,000 button, not a slide');
    X.ACT.paymode({ dataset: { v: 'all' } });
    t.check(X.S.stack[0].args.amt === 2310000, 'All owed sets the whole debt');
    X.ACT.paymode({ dataset: { v: 'oldest' } });
    X.ACT.payask();
    t.check(X.S.sheet && X.S.sheet.type === 'payok' && /Yes, record it/.test(X.SHEET.payok()) && /Change/.test(X.SHEET.payok()), 'Record opens the short check: Change / Yes, record it');
    X.ACT.payyes();
    t.check(X.S.stack[0].args.step === 'held' && /RECORDED/.test(X.PAGE.pay(X.S.stack[0].args)) && /data-act="payundo"/.test(X.PAGE.pay(X.S.stack[0].args)) && rpcs.length === 0, 'Yes: the RECORDED stamp and Undo, nothing written yet');
    X.ACT.payundo();
    const live = timers.filter(x => x.live && x.ms === 6000);
    t.check(!live.length && !X.S.stack[0].args.step && rpcs.length === 0, 'Undo: the write never happens');
    X.ACT.payask(); X.ACT.payyes();
    const tm = timers.filter(x => x.live && x.ms === 6000);
    t.check(tm.length === 1, 'a second Yes starts one Undo window');
    tm[0].live = false; tm[0].f(); await new Promise(r => setImmediate(r));
    t.check(rpcs.length === 1 && rpcs[0][0] === 'receive_payment' && rpcs[0][1].p_amount === 878000 && rpcs[0][1].p_customer_id === 'C2', 'when the window runs out, the one write: receive_payment 878,000');
    t.check(X.S.stack[0].type === 'paid', 'and the paid screen follows');
  }
  /* 4. delivered */
  {
    const { X } = page();
    const y = iso(NOW - DAY), ids = X.deliveredOn(y).map(q => q.id);
    t.check(ids.includes(2383) && ids.includes(2384) && !ids.includes(2380), 'a day holds its own deliveries');
    const d = X.PAGE.delivered({ range: 'day', day: y });
    t.check(/#2383/.test(d) && !/#2380/.test(d) && /OWES/.test(d) && /PAID/.test(d), 'Pick a day lists that day’s orders, paid or owed');
    const w = X.PAGE.delivered({ range: 'week' });
    t.check(/#2389/.test(w) && /#2380/.test(w) && w.indexOf('#2380') < w.indexOf('#2389'), 'This week runs newest first');
    t.check(/data-act="delday" data-v="/.test(w) && /aria-label="Paid /.test(w), 'tappable day bars and the paid/owed split');
    t.check(/data-act="push" data-p="delivered"/.test(X.viewOrders()), 'the Orders tab opens it');
  }
  t.done();
})().catch(e => { console.error(e); process.exit(1); });
