#!/usr/bin/env node
'use strict';
/*
 * The Manager decides (docs/decision-rights.md section 2), in manager.html:
 *
 *   1. What waits is counted once: Today, Decide and each queue agree.
 *   2. A price: approve, set or the shop's price, written on the line as
 *      priceReview, never below cost, stale once the price or quantity moves.
 *   3. A short pick: bill what went (the order amended) or the full quantity.
 *   4. A credit note: on the invoice, the debt follows it down, the goods go
 *      back through the server's stock function, the ask is closed, logged.
 *   5. A void: voided, the debt to nothing, the goods back when they never went.
 *   6. An agent's change, line by line, as index.html decideAgentChange.
 *   7. Every screen draws, empty and full, and without the task it is locked.
 *
 * Run: node test/manager-decide.test.js   (or: npm test)
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { createReporter } = require('./_extract');
const { fixture, ALL } = require('./_manager-decide-fixture');

const t = createReporter('manager decides');
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
    rpc: async (fn, args) => {
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
  vm.runInContext(app + '\n;globalThis.__x = { S, ACT, PAGE, SHEET, D, render, viewToday, priceCases, counterCases, decideCounts, decideCardHTML, decidePrice, lineWaitsPrice, shortPicks, invoiceQueue, tripDiffs, openAsks, agentAsks, quoteTotal, quoteById, customerById, linePriceNow, shopSellPrice };', sandbox);
  const X = sandbox.__x;
  Object.assign(X.S, { data: data || fixture(), shopId: SH, user: { id: 'u1', email: 'ruth@shop.ug' }, shopName: 'Mukasa Hardware', role: 'manager', started: true, tasks: tasks || ALL, stack: [{ type: 'decide', args: {} }] });
  return X;
}
const quoteRow = (q) => {
  const { id, status, invoiced, invoicedAt, amountPaid, voided, date, ...payload } = q;
  return { id, shop_id: SH, status, invoiced: !!invoiced, invoiced_at: invoicedAt || null, invoiced_ts: null, amount_paid: amountPaid || 0, voided: !!voided, date: date || null, client_name: q.client.name, client_phone: null, payload };
};
const tablesFor = data => ({ saved_quotes: data.savedQuotes.map(quoteRow), customers: data.customers.map(c => ({ id: c.id, shop_id: SH, name: c.name, debt: c.debt, credit_limit: c.creditLimit, terms_days: c.termsDays })), customer_debt_log: [], decision_log: [] });

(async () => {
  /* ---------------- 1. one count ---------------- */
  {
    const X = page(fakeDb({}));
    const c = X.decideCounts();
    t.check(c.prices === 5 && c.credit === 1 && c.invoices === 2, `prices ${c.prices}, credit ${c.credit}, invoices ${c.invoices}: two Kyaligonza lines, Lubowa, the counter wheelbarrow and Kato's no-cost line, which also holds its invoice`);
    t.check(c.stock === 4 && c.returns === 3, `stock ${c.stock} (short pick, trip, report, count) and returns ${c.returns} (credit, void, agent)`);
    t.check(c.total === c.prices + c.credit + c.invoices + c.stock + c.returns, 'the total is the sum of its parts');
    t.check(new RegExp(`<span class="m">${c.total}</span>&nbsp;waiting`).test(X.decideCardHTML()), 'Today’s card says the same total');
    t.check(new RegExp(`<span class="m">${c.total}</span> waiting for you`).test(X.PAGE.decide({})), 'and so does Decide');
    t.check(X.counterCases().length === 1 && X.counterCases()[0].q.id === 2430 && /AT THE COUNTER NOW/.test(X.PAGE.decide({})), 'the counter sale is pinned at the top of Decide');
    const kinds = X.priceCases().flatMap(x => x.lines.map(l => x.q.id + ':' + l.kind)).sort().join();
    t.check(kinds === '2391:nocost,2415:under,2415:under,2420:nomargin,2430:under', 'each waiting line is read as under, no selling price, or no known cost: ' + kinds);
    const inv = X.invoiceQueue();
    t.check(inv.length === 2 && inv.find(x => x.q.id === 2391).block.k === 'price' && !inv.find(x => x.q.id === 2402).block, 'the night run would skip Kato (no known cost) and bill Mukono');
  }

  /* ---------------- 2. prices ---------------- */
  {
    const data = fixture(), db = fakeDb(tablesFor(data)), X = page(db, data);
    const r = await X.decidePrice(2415, 0, 'approve');
    const it = db.tables.saved_quotes.find(q => q.id === 2415).payload.items[0];
    t.check(r && it.priceReview && it.priceReview.state === 'approved' && it.priceReview.price === 102000 && it.priceReview.qty === 20 && it.priceReview.by === 'u1', 'approve: the review rides on the line with the price, quantity and who');
    t.check(it.sellPrice === 102000 && db.writes.filter(w => w[0] === 'update' && w[1] === 'saved_quotes').every(w => Object.keys(w[2]).join() === 'payload'), 'approving changes no price and writes the payload only');
    t.check(!X.lineWaitsPrice(X.quoteById(2415).items[0]) && X.lineWaitsPrice(X.quoteById(2415).items[1]), 'that line stops waiting; the other still waits');
    t.check(db.tables.decision_log.length === 1 && db.tables.decision_log[0].task === 'price.approve' && db.tables.decision_log[0].before.price === 102000, 'the owner’s log gets one line with what it was before');
    const low = await X.decidePrice(2415, 1, 'set', 30000);
    t.check(!low && db.tables.saved_quotes.find(q => q.id === 2415).payload.items[1].sellPrice === 36000, 'a price below cost is refused and nothing is written');
    await X.decidePrice(2415, 1, 'set', 37000);
    const it2 = db.tables.saved_quotes.find(q => q.id === 2415).payload.items[1];
    t.check(it2.sellPrice === 37000 && it2.priceReview.state === 'changed' && it2.priceReview.was === 36000, 'set: the Manager’s own price, with what the salesperson offered');
    const q = X.quoteById(2415); q.items[1].qty = 50;
    t.check(X.lineWaitsPrice(q.items[1]), 'a decision goes stale when the quantity moves afterwards');
    await X.decidePrice(2430, 0, 'shop');
    const w = db.tables.saved_quotes.find(x => x.id === 2430).payload.items[0];
    t.check(w.sellPrice === 150000 && w.priceReview.price === 150000, 'the counter sale’s no: back to the shop’s 150,000');
  }

  /* ---------------- 3. a short pick ---------------- */
  {
    const data = fixture(), db = fakeDb(tablesFor(data)), X = page(db, data);
    X.S.ui.spPick = 'went'; await X.ACT.spgo({ dataset: { id: '2400' } });
    const p = db.tables.saved_quotes.find(q => q.id === 2400).payload;
    t.check(p.items[0].qty === 34 && p.pickSettle.pick === 'went' && p.pickSettle.lines[0].ordered === 40 && !p.pickShortfallAckAt, 'bill what went: the line comes down to the 34 that left');
    t.check(X.shortPicks().length === 0 && db.tables.decision_log.some(l => l.task === 'pick.settle'), 'and it leaves the queue, logged');
    const data2 = fixture(), db2 = fakeDb(tablesFor(data2)), Y = page(db2, data2);
    Y.S.ui.spPick = 'full'; await Y.ACT.spgo({ dataset: { id: '2400' } });
    const p2 = db2.tables.saved_quotes.find(q => q.id === 2400).payload;
    t.check(p2.items[0].qty === 40 && typeof p2.pickShortfallAckAt === 'number', 'the full quantity: the order stands and the shortfall is settled');
  }

  /* ---------------- 4. a credit note ---------------- */
  {
    const data = fixture(), db = fakeDb(tablesFor(data)), X = page(db, data);
    X.PAGE.return({ id: 'ask-cr' });
    const st = X.S.ui['rt:ask-cr']; st.back[0] = true; st.way = 'debt';
    await X.ACT['slide:credit']({ dataset: { slide: 'credit:ask-cr' } });
    const p = db.tables.saved_quotes.find(q => q.id === 412).payload;
    t.check(p.creditNotes && p.creditNotes.length === 1 && p.creditNotes[0].amount === 448000 && p.creditNotes[0].lines[0].qty === 4, 'the credit note sits on the invoice: 4 × 112,000');
    t.check(db.tables.customers.find(c => c.id === 'C2').debt === 2310000 - 448000 && db.tables.customer_debt_log.length === 1 && db.tables.customer_debt_log[0].type === 'payment', 'what Mukono owes comes down by it, on their history');
    const mv = db.rpcs.find(r => r[0] === 'manager_stock_move');
    t.check(mv && mv[1].p_task === 'credit_note.raise' && mv[1].p_lines[0].delta === 4 && mv[1].p_type === 'reversal', 'the 4 sheets go back through the server’s one stock function');
    t.check(db.rpcs.some(r => r[0] === 'decide_invoice_ask' && r[1].p_status === 'accepted') && db.tables.decision_log.some(l => l.task === 'credit_note.raise'), 'the ask is closed and the decision logged');
    const data2 = fixture(), db2 = fakeDb(tablesFor(data2)), Y = page(db2, data2);
    Y.PAGE.return({ id: 'ask-cr' }); const st2 = Y.S.ui['rt:ask-cr']; st2.back[0] = false; st2.way = 'cash';
    await Y.ACT['slide:credit']({ dataset: { slide: 'credit:ask-cr' } });
    const cn = db2.tables.saved_quotes.find(q => q.id === 412).payload.creditNotes[0];
    t.check(cn.refund && cn.refund.due && !db2.rpcs.some(r => r[0] === 'manager_stock_move') && db2.tables.customers.find(c => c.id === 'C2').debt === 2310000, 'cash back: owed back by Accounts, damaged goods not resold, the debt left alone');
  }

  /* ---------------- 5. a void ---------------- */
  {
    const data = fixture(), db = fakeDb(tablesFor(data)), X = page(db, data);
    X.S.ui.vdWhy = 'twice';
    await X.ACT['slide:void']({ dataset: { slide: 'void:ask-vd' } });
    const row = db.tables.saved_quotes.find(q => q.id === 419);
    t.check(row.voided === true && row.payload.voidedBy.why === 'twice' && row.payload.debtCharged === 0, 'INV-0419 is void and charges nothing');
    t.check(db.tables.customers.find(c => c.id === 'C3').debt === 1224000, 'Ggaba owes the one bill, 1,224,000');
    t.check(db.rpcs.some(r => r[0] === 'manager_stock_move' && r[1].p_task === 'invoice.void') && db.rpcs.some(r => r[0] === 'void_sale_bills'), 'raised twice: the goods come back and its supplier bills are cancelled');
    t.check(db.tables.saved_quotes.find(q => q.id === 418).voided === false, 'the bill that keeps is untouched');
  }

  /* ---------------- 6. an agent's change ---------------- */
  {
    const data = fixture(), db = fakeDb(tablesFor(data)), X = page(db, data);
    await X.ACT.agdo({ dataset: { id: '2410' } });
    const p = db.tables.saved_quotes.find(q => q.id === 2410).payload;
    t.check(p.items[0].qty === 6 && p.agentChange.state === 'agreed' && p.agentChange.lines[0].decision === 'agreed', 'agreed: 10 sheets become 6, the ask closed');
    t.check(p.agentCredit && p.agentCredit.amount === 1120000 - 672000, 'what the paid order now holds beyond its worth is the agent’s credit: ' + (p.agentCredit && p.agentCredit.amount));
  }

  /* ---------------- 7. every screen draws ---------------- */
  {
    const X = page(fakeDb({}));
    const screens = [['decide', {}], ['price', { id: 2415 }], ['pricenew', { id: 2420 }], ['pricenew', { id: 2391 }], ['invoices', {}], ['shortpick', { id: 2400 }], ['tripcount', { id: 'TRIP-K1' }],
      ['writeoff', {}], ['stocktake', { id: 'cnt-1' }], ['return', { id: 'ask-cr' }], ['void', { id: 'ask-vd' }], ['agentask', { id: 2410 }], ['restock', {}], ['margins', {}], ['teamrules', {}],
      ['custedit', { id: 'C1' }], ['promise', { id: 'C2' }], ['me', {}]];
    screens.forEach(([p, a]) => { let out = ''; try { out = X.PAGE[p](a); } catch (e) { out = 'THROW ' + e.message; } t.check(typeof out === 'string' && out.length > 200 && !/THROW|undefined|NaN/.test(out.replace(/data-[a-z]+="[^"]*"/g, '')), `${p} draws with the shop full`); });
    let sh = ''; try { sh = X.SHEET.counter({ id: 2430 }); } catch (e) { sh = 'THROW ' + e.message; }
    t.check(/data-yesno="2430\|0"/.test(sh) && /140,000/.test(sh) && /150,000/.test(sh), 'the counter sale is one two-way slide: no at the shop’s 150,000, yes at 140,000');
    t.check(/Prices/.test(X.viewToday()) && /Start with the oldest/.test(X.viewToday()), 'Today leads with Decide now');
    const E = page(fakeDb({}), { ...fixture(), savedQuotes: [], collectionTrips: [], invoiceAsks: [], stockCounts: [], stockReports: [], restockLines: [] });
    ['decide', 'invoices', 'writeoff', 'restock', 'margins', 'teamrules'].forEach(p => { let out = ''; try { out = E.PAGE[p]({}); } catch (e) { out = 'THROW ' + e.message; } t.check(!/THROW/.test(out) && out.length > 100, `${p} draws with nothing waiting`); });
    t.check(!/decideCard|Decide now/.test(E.viewToday()), 'with nothing waiting, Today shows no Decide card');
    const L = page(fakeDb({}), fixture(), ['order.move']);
    t.check(/not on for this login/.test(L.PAGE.shortpick({ id: 2400 })) && !/data-act="spgo"/.test(L.PAGE.shortpick({ id: 2400 })), 'without pick.settle the short pick is shown, not offered');
    t.check(/not on for this login/.test(L.PAGE.void({ id: 'ask-vd' })) && !/data-slide="void:/.test(L.PAGE.void({ id: 'ask-vd' })), 'without invoice.void the void is shown, not offered');
    t.check(/Not open to this login/.test(L.PAGE.margins({})), 'without margin.see no cost or margin is drawn');
    t.check(!/the owner (sets|turns|records|reviews)|stay with the owner|OWNER SETS/i.test(html.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '')), 'no screen says a Manager’s decision is the owner’s');
  }

  t.done();
})().catch(e => { console.error(e); process.exit(1); });
