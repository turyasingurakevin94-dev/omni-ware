#!/usr/bin/env node
'use strict';
/*
 * The Sales app (sales.html): its prices must be the owner's prices, and
 * what it writes must be what the owner's app reads.
 *
 *   1. Parity. sales.html carries its own copy of the pricing chain
 *      (quoteItemSellPrice and what it leans on) and of the order totals,
 *      because it is a separate page. Both copies run here through one
 *      matrix of lines -- shelf and bought-in, loose and by the pack,
 *      variant, product and shop-default rules, percent and fixed, with
 *      and without credit -- and must agree to the shilling.
 *   2. Never at cost. A line with no markup rule is "price to confirm",
 *      left out of the total and counted, not quoted at the shop's cost.
 *   3. Placing an order writes one saved_quotes row with the exact columns
 *      and payload keys the admin's loadData maps -- at Checking, or straight
 *      at Packing when every line is on our shelf and nothing waits for the
 *      Manager (docs/decision-rights.md, "Orders that need nothing from a
 *      supplier").
 *   4. Taking a payment spreads it over open bills oldest first, as
 *      recordCustomerPayment does: a receipt per bill, the bill's payments
 *      and amount_paid, the debt brought down with an Auto-sync line, and
 *      whatever is left lowering the loose balance -- never raising one.
 *
 * Runs the page's real script in a sandbox with a fake database; nothing
 * is copied into this file.
 *
 * Run: node test/sales-app.test.js   (or: npm test)
 */
const vm = require('vm');
const { read, extractFunction, compileScope, createReporter } = require('./_extract');
const fakeReceivePayment = require('./_fake-receive-payment');

const t = createReporter('sales app');
const html = read('sales.html');
const adminSrc = read('index.html');

/* ---------------- the fixture: one small shop ---------------- */
const SH = 'shop1';
function fixture(){
  return {
    suppliers: [{ id: 'S1', name: 'Mulongo' }, { id: 'S2', name: 'Nsubuga' }],
    customers: [{ id: 'C001', name: 'Kato Construction', phone: '0772123456', phone2: '', location: 'Nansana', notes: '', debt: 500000, termsDays: null, creditLimit: null, debtLog: [{ id: 5 }] }],
    staff: [],
    products: [
      { id: 'P1', name: 'Cement', variants: [], retailMarkupType: 'percent', retailMarkupValue: 0, wholesaleMarkupType: 'percent', wholesaleMarkupValue: 0, stockRetailMarkupType: 'fixed', stockRetailMarkupValue: 2500, stockWholesaleMarkupType: 'percent', stockWholesaleMarkupValue: 0 },
      { id: 'P2', name: 'Iron sheets', variants: [{ combo: { g: 'G28' }, retailMarkupType: 'percent', retailMarkupValue: 12 }, { combo: { g: 'G30' } }], retailMarkupType: 'percent', retailMarkupValue: 0, wholesaleMarkupType: 'fixed', wholesaleMarkupValue: 20000, stockRetailMarkupValue: 0, stockWholesaleMarkupValue: 0 },
      { id: 'P3', name: 'Nails', variants: [], retailMarkupValue: 0, wholesaleMarkupValue: 0, stockRetailMarkupValue: 0, stockWholesaleMarkupValue: 0 },
    ],
    prices: [
      { id: 1, productId: 'P1', variantIdx: null, supplierId: 'S1', wholesale: null, retail: 32000, unit: 'bag', packUnit: '', packQty: 0, tiers: [] },
      { id: 2, productId: 'P2', variantIdx: 0, supplierId: 'S2', wholesale: 300000, retail: 33000, unit: 'sheet', packUnit: 'bundle', packQty: 10, tiers: [{ minQty: 30, price: 280000 }, { minQty: 5, price: 31000 }] },
      { id: 3, productId: 'P2', variantIdx: 1, supplierId: 'S2', wholesale: null, retail: 27000, unit: 'sheet', packUnit: 'bundle', packQty: 10, tiers: [] },
      { id: 4, productId: 'P3', variantIdx: null, supplierId: 'S1', wholesale: 90000, retail: null, unit: 'kg', packUnit: 'carton', packQty: 25, tiers: [] },
    ],
    stock: { P1: 40 }, stockLots: { P1: [{ qty: 40, cost: 31000 }] },
    savedQuotes: [], productLinks: [], cashTxns: [{ id: 11 }],
    presetCreditPct: 3, presetDefaultMarkup: { retailType: 'percent', retailValue: 15, wholesaleType: 'percent', wholesaleValue: 0 },
    presetChaseAfterDays: 30, presetCategories: [],
  };
}

/* ---------------- the page, in a sandbox ---------------- */
function loadPage(db){
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  const app = scripts.find(s => s.includes('function quoteItemSellPrice'));
  if (!app) throw new Error('sales.html has no app script');
  const el = () => ({ innerHTML: '', children: [], style: {}, dataset: {}, classList: { add() {}, remove() {} }, setAttribute() {}, querySelector: () => null, querySelectorAll: () => [], appendChild() {} });
  const store = {};
  const sandbox = {
    console, setTimeout, clearTimeout, setInterval: () => 0, requestAnimationFrame: () => 0, Promise, Date, Math, JSON, URLSearchParams, encodeURIComponent,
    location: { hostname: 'localhost', hash: '', reload() {} },
    localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
    document: { getElementById: el, querySelector: () => null, querySelectorAll: () => [], addEventListener() {}, createElement: el, body: { appendChild() {}, style: {} }, visibilityState: 'visible' },
    supabase: { createClient: () => db },
  };
  sandbox.window = sandbox; sandbox.window.open = () => {};
  vm.createContext(sandbox);
  // boot() waits on getUser, which this fake never answers: the page stays
  // unbooted and the test drives it.
  vm.runInContext(app + '\n;globalThis.__x = { S, ACT, PAGE, ctRowFor, ctSell, ctKeepLocal, ctLand, counterDockHTML, draftQuote, n0, srcMatch, rowToLead, newDraft, mgrName, priceReviewState, priceToTell, priceTagHTML, quoteItemSellPrice, quoteTotal, pricedView, linePriceToConfirm, makeLine, payPlan, viewToday, viewOrders, viewCustomers, viewMe, priceTooLow, priceNoteFor, shopSellPrice, chatSaid, chatCanSend, chatKind, chatWhyNot, chatPriceLine, chatSender };', sandbox);
  return sandbox.__x;
}
function fakeDb(tables){
  const writes = [], ids = { 'row:saved_quote': 0, 'row:cash_txn': 0, 'row:debt_log': 0 }; let custN = 1;
  function Q(table){ this.t = table; this.f = []; this.op = 'select'; this.one = false; }
  Q.prototype.select = function(){ return this; };
  Q.prototype.eq = function(k, v){ this.f.push(r => String(r[k]) === String(v)); return this; };
  Q.prototype.gt = Q.prototype.gte = Q.prototype.order = Q.prototype.limit = function(){ return this; };
  Q.prototype.maybeSingle = function(){ this.one = true; return this; };
  Q.prototype.insert = function(row){ this.op = 'insert'; this.row = row; return this; };
  Q.prototype.update = function(row){ this.op = 'update'; this.row = row; return this; };
  Q.prototype.then = function(res, rej){
    const rows = tables[this.t] || (tables[this.t] = []);
    const clone = x => JSON.parse(JSON.stringify(x));
    if (this.op === 'insert') { writes.push(['insert', this.t, clone(this.row)]); rows.push(clone(this.row)); return Promise.resolve({ error: null }).then(res, rej); }
    const hit = rows.filter(r => this.f.every(f => f(r)));
    if (this.op === 'update') { writes.push(['update', this.t, clone(this.row), hit.map(r => r.id)]); hit.forEach(r => Object.assign(r, clone(this.row))); return Promise.resolve({ error: null }).then(res, rej); }
    return Promise.resolve({ data: clone(this.one ? (hit[0] || null) : hit), error: null }).then(res, rej);
  };
  return { writes, tables,
    auth: { getUser: () => new Promise(() => {}), getSession: async () => ({ data: { session: null } }), signOut: async () => ({}) },
    from: t => new Q(t),
    rpc: async (fn, a) => {
      if (fn === 'next_row_id_blocks') { const k = a.p_kinds[0]; ids[k] = Math.max(ids[k], Number(a.p_floors[k]) || 0) + 1; return { data: { [k]: ids[k] }, error: null }; }
      if (fn === 'invoice_order') { const q = (tables.saved_quotes || []).find(r => Number(r.id) === Number(a.p_quote_id)); writes.push(['rpc', fn, a]); if (!q || q.status !== 'completed') return { data: null, error: { message: 'Only a delivered order is invoiced.' } }; q.invoiced = true; return { data: { ok: true, invoice: 'INV-' + String(q.id).padStart(4, '0') }, error: null }; }
      if (fn === 'next_entity_id') return { data: 'C' + String(++custN).padStart(3, '0'), error: null };
      // 0139 receive_payment, as the database does it (test/_fake-receive-payment.js).
      if (fn === 'receive_payment') { writes.push(['rpc', fn, a]); return fakeReceivePayment(tables, writes, k => ++ids[k], a, 'u1'); }
      // 0136 counter_sale, as the database does it: one write places, pays and invoices; a short shelf or a price under the shop's refuses or waits.
      if (fn === 'counter_sale') {
        writes.push(['rpc', fn, a]);
        const row = a.p_row, items = (row && row.payload && row.payload.items) || [];
        if (a.p_quote_id == null && !row) return { data: null, error: { message: 'Nothing to sell.' } };
        if (items.some(it => it.supplierId !== '__stock__')) return { data: null, error: { message: 'A counter sale is only for goods on the shelf.' } };
        const id = ++ids['row:saved_quote'];
        if (items.some(it => it.priceBy && ['under', 'nomargin', 'nocost'].includes(it.priceNote))) { tables.saved_quotes.push({ id, shop_id: a.p_shop_id, status: 'draft', invoiced: false, amount_paid: 0, payload: { ...row.payload, counter: true } }); return { data: { ok: true, waiting: 'price', id }, error: null }; }
        const total = items.reduce((t, it) => t + (Number(it.qty) || 0) * (Number(it.sellPrice) || 0), 0), cashId = ++ids['row:cash_txn'];
        tables.cash_txns.push({ id: cashId, shop_id: a.p_shop_id, type: 'receipt', category: 'Sales Revenue', account: a.p_method, amount: total, quote_id: id });
        tables.saved_quotes.push({ id, shop_id: a.p_shop_id, status: 'completed', invoiced: true, amount_paid: total, payload: { ...row.payload, counter: true, payments: [{ id: 1, amount: total, cashTxnId: cashId, method: a.p_method }] } });
        return { data: { ok: true, id, invoice: 'INV-' + String(id).padStart(4, '0'), total, pay: total, cashTxnId: cashId, change: Math.max(0, (Number(a.p_given) || 0) - total), invoiced: true }, error: null };
      }
      return { data: null, error: { message: 'no such rpc' } };
    } };
}

/* ---------------- 1. parity with the owner's app ---------------- */
const adminNames = ['quoteItemSellPrice', 'productPriceRows', 'effectiveMarkupRule', 'effectiveStockMarkupRule', 'sellSideFor', 'purchaseSideAtQty',
  'tieredUnitPrice', 'tiersForKind', 'quoteSuggestedPrice', 'quoteSuggestedStockPrice', 'suggestedSellingPrice', 'suggestedStockSellingPrice',
  'savedQuoteGoodsTotal', 'savedQuoteCashTotal', 'orderCreditCharge', 'orderCreditTerms', 'savedQuoteTotal', 'orderChargesTotal', 'orderCharges', 'chargeAmount'];
const adminData = fixture();
const admin = compileScope(adminNames.map(n => extractFunction(adminSrc, n, 'index.html')),
  { data: adminData, supplierName: id => id }, ['quoteItemSellPrice', 'savedQuoteTotal']);

const db0 = fakeDb({});
const P = loadPage(db0);
P.S.data = fixture(); P.S.shopId = SH; P.S.user = { id: 'u1' };

const line = (pid, vi, qty, supplierId, price, extra) => ({ lineId: 1, productId: pid, variantIdx: vi, productName: pid, unit: '', packUnit: '', packQty: pid === 'P2' || pid === 'P3' ? (pid === 'P2' ? 10 : 25) : 0, qty, supplierId, price, sellPrice: null, ...(extra || {}) });
const matrix = [
  ['shelf line, stock fixed rule', line('P1', null, 10, '__stock__', 31000)],
  ['bought-in, shop default %', line('P1', null, 3, 'S1', 32000)],
  ['variant rule, loose', line('P2', 0, 4, 'S2', 33000)],
  ['variant, by the pack (product fixed wholesale)', line('P2', 0, 20, 'S2', 30000)],
  ['variant without its own rule, loose', line('P2', 1, 6, 'S2', 27000)],
  ['carton-only row under a carton', line('P3', null, 10, 'S1', 3600)],
  ['typed sell price wins', line('P1', null, 2, 'S1', 32000, { sellPrice: 41000 })],
  ['unknown product', line('PX', null, 2, 'S1', 5000)],
];
matrix.forEach(([what, it]) => {
  const a = admin.quoteItemSellPrice(it), s = P.quoteItemSellPrice(it);
  t.check(Math.abs(a - s) < 1e-9, `sell price matches the owner's app: ${what} (${a} vs ${s})`);
});
[[null, 'cash'], [{ pct: 3, days: 30 }, 'credit']].forEach(([credit, word]) => {
  const q = { items: matrix.slice(0, 7).map(m => m[1]), charges: [], credit };
  const a = admin.savedQuoteTotal(q), s = P.quoteTotal(q);
  t.check(Math.abs(a - s) < 1e-9, `order total matches the owner's app on ${word} (${a} vs ${s})`);
});

/* ---------------- 2. never at cost ---------------- */
{
  const noRule = line('P3', null, 30, 'S1', 3600);
  P.S.data.presetDefaultMarkup = {};
  t.check(P.linePriceToConfirm(noRule), 'a line with no markup rule is "price to confirm"');
  const pv = P.pricedView({ items: [line('P1', null, 10, '__stock__', 31000), noRule], charges: [] });
  t.check(pv.toConfirm === 1 && pv.total === 10 * 33500, 'the total leaves the line out and counts it, rather than pricing it at cost');
  const made = P.makeLine('P3', null, 30, {});
  t.check(made && made.sellPrice == null, 'a new line with no rule carries no sell price to be read as cost');
  P.S.data.presetDefaultMarkup = fixture().presetDefaultMarkup;
}

/* ---------------- 2b: the Manager's answer on a price ---------------- */
{
  P.S.data.members = [{ user_id: 'm1', role: 'manager' }];
  P.S.data.staff = [{ id: 7, name: 'Ruth Nakato', userId: 'm1', role: 'manager' }];
  t.check(P.mgrName() === 'Ruth', 'the Manager is named by their staff record');
  const base = { productId: 'P1', qty: 2, sellPrice: 165000, priceBy: 'u1', priceNote: 'under', priceShop: 172000 };
  t.check(P.priceReviewState(base) === 'wait', 'a price under the shop\'s waits for the Manager');
  t.check(P.priceReviewState({ ...base, priceNote: 'nocost' }) === null, 'a price with no cost yet is not the Manager\'s to decide first');
  t.check(P.priceReviewState({ ...base, priceReview: { state: 'approved', price: 165000, byName: 'Ruth Nakato', at: 1 } }) === 'approved', 'approved at the figure it names');
  const changed = { ...base, sellPrice: 172000, priceReview: { state: 'changed', price: 172000, was: 165000, byName: 'Ruth Nakato', at: '2026-10-17T12:31:00Z' } };
  t.check(P.priceReviewState(changed) === 'changed' && P.priceToTell(changed), 'the Manager\'s new price is one to tell the customer');
  t.check(!P.priceToTell({ ...changed, priceToldAt: '2026-10-17T12:33:00Z' }), 'once told, it is not asked again');
  t.check(P.priceReviewState({ ...changed, sellPrice: 170000 }) === 'wait', 'a decision goes stale when the price changes after it');
  t.check(/waiting for Ruth/.test(P.priceTagHTML(base, true)) && /Ruth set/.test(P.priceTagHTML(changed, true)) && !/owner/.test(P.priceTagHTML(base) + P.priceTagHTML(base, true)), 'the tag names the Manager, never the owner');
  P.S.data.members = []; P.S.data.staff = [];
  t.check(P.mgrName() === 'the Manager', 'with no manager on the shop, it says "the Manager"');
}

/* ---------------- 3 & 4: the writes ---------------- */
(async () => {
  // 3. placing an order
  {
    const db = fakeDb({ saved_quotes: [] });
    const X = loadPage(db);
    Object.assign(X.S, { data: fixture(), shopId: SH, user: { id: 'u1' } });
    X.S.data.savedQuotes = [{ id: 41 }];
    const it = X.makeLine('P1', null, 10, { lineId: 1 });
    X.S.draft = { client: { name: 'Kato Construction', phone: '0772123456' }, customerId: 'C001', items: [it], credit: true, q: '' };
    await X.ACT['slide:place']({ querySelector: () => ({ textContent: '' }) });
    const ins = db.writes.filter(w => w[0] === 'insert' && w[1] === 'saved_quotes');
    t.check(ins.length === 1, 'placing writes one saved_quotes row');
    const row = ins[0] && ins[0][2];
    if (row) {
      t.check(row.id === 42, 'the id is the server\'s, above every order on the phone');
      t.check(row.status === 'preparing' && row.invoiced === false && row.voided === false && row.amount_paid === 0, 'all from our shelf, it lands at Packing, not invoiced, nothing paid');
      t.check(row.shop_id === SH && row.client_name === 'Kato Construction' && row.date, 'the row columns the admin reads are filled');
      const p = row.payload;
      t.check(p.customerId === 'C001' && Array.isArray(p.payments) && p.debtCharged === 0 && Array.isArray(p.charges), 'payload carries customer, payments, debtCharged and charges');
      t.check(p.credit && p.credit.pct === 3 && p.credit.days === 30 && p.credit.agreedAt, 'credit is frozen on the order with its rate and term, as setOrderCredit does');
      t.check(Array.isArray(p.stageLog) && p.stageLog.length === 1 && p.stageLog[0].status === 'preparing' && p.stageLog[0].at === p.stageEnteredAt, 'the stage log starts at Packing at stageEnteredAt: Checking was never entered');
      const keys = Object.keys(p.items[0]).sort().join(',');
      t.check(keys === 'lineId,packQty,packUnit,price,productId,productName,qty,qtyIn,sellPrice,supplierId,supplierName,unit,variantIdx', 'each line has the item picker\'s fields and no others: ' + keys);
    }
    t.check(X.S.draft === null && X.S.stack[0] && X.S.stack[0].type === 'placed', 'the draft is cleared and the celebration opens');
  }

  // 3b. what still stops in Checking: a supplier to ask, a price for the Manager, a credit hold
  {
    const place = async (setup) => {
      const db = fakeDb({ saved_quotes: [] });
      const X = loadPage(db);
      Object.assign(X.S, { data: fixture(), shopId: SH, user: { id: 'u1' } });
      X.S.data.savedQuotes = [{ id: 41 }];
      X.S.draft = { client: { name: 'Kato Construction', phone: '0772123456' }, customerId: 'C001', items: [], credit: false, q: '' };
      setup(X);
      await X.ACT['slide:place']({ querySelector: () => ({ textContent: '' }) });
      const ins = db.writes.filter(w => w[0] === 'insert' && w[1] === 'saved_quotes');
      return ins[0] && ins[0][2];
    };
    const bought = await place(X => { X.S.draft.items = [X.makeLine('P2', 0, 5, { lineId: 1 })]; });
    t.check(bought && bought.status === 'draft' && bought.payload.stageLog[0].status === 'draft', 'a line bought in from a supplier: the order lands at Checking');
    const under = await place(X => { const it = X.makeLine('P1', null, 10, { lineId: 1 }); Object.assign(it, { sellPrice: it.sellPrice - 500, priceBy: 'u1', priceNote: 'under', priceShop: it.sellPrice }); X.S.draft.items = [it]; });
    t.check(under && under.status === 'draft', 'a shelf line under the shop\'s price waits in Checking for the Manager');
    const held = await place(X => { X.S.data.customers[0].creditLimit = 400000; X.S.draft.items = [X.makeLine('P1', null, 10, { lineId: 1 })]; });
    t.check(held && held.status === 'draft', 'a customer over their credit limit with the order waits in Checking (the credit hold)');
  }

  // 3c. "We don't sell it": a request to Sourcing, in the shape the Sourcing app reads
  {
    const lead = { id: 'SRC-A', shop_id: SH, name: 'Ceiling fan, 56 inch', status: 'looking', voided: false, requests: [{ at: '2026-10-14T09:00:00Z', source: 'sourcing', qty: 2 }], candidates: [] };
    const db = fakeDb({ saved_quotes: [], sourcing_leads: [lead] });
    const X = loadPage(db);
    Object.assign(X.S, { data: fixture(), shopId: SH, user: { id: 'u1' } });
    X.S.data.leads = [X.rowToLead(lead)];
    X.S.draft = X.newDraft(X.S.data.customers[0]);
    t.check(X.srcMatch('ceiling fan') && X.srcMatch('ceiling fan').id === 'SRC-A' && !X.srcMatch('solar pump'), 'the same item asked twice is one lead; a new item is not matched to it');
    X.S.sheet = { type: 'srcask', args: { name: 'ceiling fan', qty: 3 } };
    await X.ACT.srcsend();
    const up = db.writes.find(w => w[0] === 'update' && w[1] === 'sourcing_leads');
    const added = up && up[2].requests[up[2].requests.length - 1];
    t.check(up && up[2].requests.length === 2 && up[2].requests[0].source === 'sourcing', 'a second ask is added to the lead\'s requests, nobody else\'s lost');
    t.check(added && added.source === 'sourcing.ask' && added.by === 'u1' && added.customerId === 'C001' && added.customerName === 'Kato Construction' && added.qty === 3, 'it carries who asked, how many and which salesperson, as the Sourcing app reads it');
    X.S.sheet = { type: 'srcask', args: { name: 'Solar water pump 1hp', qty: 2 } };
    await X.ACT.srcsend();
    const ins = db.writes.find(w => w[0] === 'insert' && w[1] === 'sourcing_leads');
    t.check(ins && ins[2].status === 'asked' && ins[2].name === 'Solar water pump 1hp' && /^SRC-/.test(ins[2].id) && ins[2].requests.length === 1 && ins[2].requests[0].source === 'sourcing.ask', 'an item nobody has asked for starts a new lead at Asked');
  }

  // 3d. a counter sale: placed, paid in full, at Delivered, and invoiced by the one function
  {
    const db = fakeDb({ saved_quotes: [], cash_txns: [] });
    const X = loadPage(db);
    Object.assign(X.S, { data: fixture(), shopId: SH, user: { id: 'u1' } });
    X.S.data.savedQuotes = [{ id: 41 }];
    X.S.draft = { ...X.newDraft(null), counter: true, items: [X.makeLine('P1', null, 10, { lineId: 1 })] };
    t.check(/Slide · paid/.test(X.counterDockHTML()), 'all from the shelf at the shop’s price: one slide, paid');
    const dk = X.counterDockHTML(), tot = X.pricedView(X.draftQuote()).total;
    t.check(/THEY GAVE/.test(dk) && /data-act="ctgiven"/.test(dk) && /CHANGE/.test(dk), 'cash: what they gave, as one tap each, and the change');
    X.S.draft.given = Math.ceil(tot / 5000) * 5000 + 5000;
    t.check(X.counterDockHTML().includes(X.n0(X.S.draft.given - tot)), 'the change is what they gave less the total');
    X.S.draft.payMethod = 'momo';
    t.check(!/THEY GAVE/.test(X.counterDockHTML()), 'no change to give on MoMo');
    X.S.draft.payMethod = 'cash'; X.S.draft.given = null;
    t.check(/ON THE COUNTER/.test(X.PAGE.counter()) && /all at the shop’s price/.test(X.PAGE.counter()), 'the counter screen lists the lines, at the shop’s price');
    const keep = X.S.draft; X.S.draft = { ...X.newDraft(null), counter: true };
    const empty = X.PAGE.counter();
    t.check(/Sells most at the counter/.test(empty) && /data-act="ctadd"/.test(empty) && /Nothing on the counter yet/.test(empty), 'an empty counter offers the shelf, one tap each');
    t.check(!/data-pid="P2"/.test(empty), 'only what is on our own shelf');
    X.S.draft = keep;
    // 0136: the whole sale is ONE write, counter_sale. The phone never inserts the order or the receipt itself.
    const rowIn = X.ctRowFor(X.S.draft);
    t.check(rowIn.payload.counter === undefined && rowIn.payload.items.length === 1 && rowIn.payload.items[0].supplierId === '__stock__' && rowIn.client_name === 'Walk-in', 'the sale goes to the database as the counter holds it: lines from the shelf, a walk-in');
    const r = await X.ctSell(null, rowIn, 'cash', 0), id = r.id;
    const row = db.tables.saved_quotes.find(x => x.id === id), rc = db.tables.cash_txns[0];
    t.check(db.writes.filter(w => w[0] === 'insert' && (w[1] === 'saved_quotes' || w[1] === 'cash_txns')).length === 0, 'the phone writes neither the order nor the receipt: the database does, together');
    t.check(db.writes.some(w => w[0] === 'rpc' && w[1] === 'counter_sale' && w[2].p_row === rowIn && w[2].p_method === 'cash'), 'through counter_sale');
    t.check(rc && rc.type === 'receipt' && rc.account === 'cash' && rc.quote_id === id && rc.amount === r.total && r.total > 0, 'one cash receipt on the sale, for the whole of it');
    t.check(row.status === 'completed' && row.amount_paid === r.total && row.payload.payments.length === 1 && row.payload.payments[0].cashTxnId === rc.id && row.invoiced === true && r.invoice === 'INV-' + String(id).padStart(4, '0'), 'the sale is at Delivered, paid in full, invoiced');
    X.ctKeepLocal(r, rowIn, 'cash');
    t.check(X.S.data.savedQuotes.some(q => Number(q.id) === id && q.status === 'completed' && q.invoiced), 'and this phone holds it at once, until the next refresh');
    X.S.stack = [];
    X.ctLand(id, r, 'cash', r.total + 1000);
    const done = X.PAGE.counterdone(X.S.stack[X.S.stack.length - 1].args);
    t.check(/INVOICED/.test(done) && /GIVE BACK/.test(done) && done.includes(X.n0(1000)) && done.includes(r.invoice), 'sold, paid, invoiced: the change to give back and the invoice');
    X.S.draft = { ...X.newDraft(null), counter: true, items: [X.makeLine('P2', 0, 5, { lineId: 1 })] };
    t.check(/isn’t all on the shelf/.test(X.counterDockHTML()) && !/data-slide="counter"/.test(X.counterDockHTML()), 'a line bought in from a supplier is no counter sale: it becomes an order');
    const it = X.makeLine('P1', null, 10, { lineId: 1 });
    X.S.draft = { ...X.newDraft(null), counter: true, items: [Object.assign(it, { sellPrice: it.sellPrice - 500, priceBy: 'u1', priceNote: 'under', priceShop: it.sellPrice })] };
    t.check(/data-slide="counterask"/.test(X.counterDockHTML()) && !/data-slide="counter"/.test(X.counterDockHTML()), 'under the shop’s price, the slide asks the Manager first');
  }

  // 4. a payment over two bills and a loose balance
  {
    const iso = d => d;
    const q1 = { id: 1, shop_id: SH, invoiced: true, invoiced_at: iso('2026-08-01'), amount_paid: 0, status: 'completed', voided: false, date: '2026-08-01',
      payload: { client: { name: 'Kato Construction' }, customerId: 'C001', debtCharged: 100000, items: [line('P1', null, 2, 'S1', 32000, { sellPrice: 50000 })], payments: [] } };
    const q2 = { id: 2, shop_id: SH, invoiced: true, invoiced_at: iso('2026-09-01'), amount_paid: 0, status: 'completed', voided: false, date: '2026-09-01',
      payload: { client: { name: 'Kato Construction' }, customerId: 'C001', debtCharged: 300000, items: [line('P1', null, 6, 'S1', 32000, { sellPrice: 50000 })], payments: [] } };
    const db = fakeDb({ saved_quotes: [q1, q2], customers: [{ id: 'C001', shop_id: SH, debt: 500000 }], cash_txns: [], customer_debt_log: [] });
    const X = loadPage(db);
    Object.assign(X.S, { data: fixture(), shopId: SH, user: { id: 'u1' } });
    const toQ = r => ({ id: r.id, status: r.status, invoiced: true, invoicedAt: r.invoiced_at, amountPaid: 0, voided: false, date: r.date, ...JSON.parse(JSON.stringify(r.payload)) });
    X.S.data.savedQuotes = [toQ(q1), toQ(q2)];
    const plan = X.payPlan(X.S.data.customers[0], 450000);
    t.check(plan.bills[0].pay === 100000 && plan.bills[1].pay === 300000 && plan.rest === 50000 && plan.loose === 100000, 'the plan pays the oldest bill first, then the next, then the loose balance');
    X.S.stack = [{ type: 'pay', args: { id: 'C001', amt: 450000, method: 'momo' } }];
    await X.ACT['slide:pay']();
    const w = db.writes;
    const cash = w.filter(x => x[0] === 'insert' && x[1] === 'cash_txns').map(x => x[2]);
    t.check(cash.length === 3 && cash.map(c => c.amount).join() === '100000,300000,50000', 'one receipt per bill and one for the rest: ' + cash.map(c => c.amount).join());
    t.check(cash.every(c => c.type === 'receipt' && c.category === 'Debt Payment' && c.account === 'momo' && c.entered_by === 'u1'), 'each is a Debt Payment receipt on the chosen account, entered by this login');
    t.check(cash[0].quote_id === 1 && cash[1].quote_id === 2 && cash[2].quote_id === null, 'the bill receipts name their invoice; the rest names none');
    t.check(new Set(cash.map(c => c.id)).size === 3, 'every receipt has its own id');
    t.check(db.tables.saved_quotes[0].amount_paid === 100000 && db.tables.saved_quotes[0].payload.payments[0].cashTxnId === cash[0].id, 'the first bill is paid off, its payment linked to its receipt');
    t.check(db.tables.saved_quotes[1].payload.debtCharged === 0 && db.tables.saved_quotes[0].payload.debtCharged === 0, 'each bill\'s share of the debt follows its balance down');
    const logs = db.tables.customer_debt_log;
    t.check(logs.length === 3 && logs.every(l => l.type === 'payment'), 'three payment lines in the debt log, nothing else');
    t.check(logs[0].note === 'Auto-sync — INV-0001' && logs[0].quote_id === 1 && logs[0].cash_txn_id === null, 'a bill\'s line is the invoice\'s own Auto-sync line');
    t.check(logs[2].cash_txn_id === cash[2].id && logs[2].amount === 50000, 'the loose payment line carries the receipt its money came on');
    t.check(db.tables.customers[0].debt === 50000, 'they owe 50,000 after paying 450,000 of 500,000');
    const debts = w.filter(x => x[0] === 'update' && x[1] === 'customers').map(x => x[2].debt);
    t.check(debts.every((d, i) => d <= (i ? debts[i - 1] : 500000)), 'the debt only ever goes down');
    t.check(X.S.stack[0].type === 'paid' && X.S.stack[0].args.before === 500000 && X.S.stack[0].args.after === 50000, 'the paid screen shows 500,000 → 50,000');
  }

  // 4b. choosing the bills: only the picked bill is paid; what is over lowers the loose balance
  {
    const bill = (id, at, total) => ({ id, shop_id: SH, invoiced: true, invoiced_at: at, amount_paid: 0, status: 'completed', voided: false, date: at,
      payload: { client: { name: 'Kato Construction' }, customerId: 'C001', debtCharged: total, items: [line('P1', null, total / 50000, 'S1', 32000, { sellPrice: 50000 })], payments: [] } });
    const q1 = bill(1, '2026-08-01', 100000), q2 = bill(2, '2026-09-01', 300000);
    const db = fakeDb({ saved_quotes: [q1, q2], customers: [{ id: 'C001', shop_id: SH, debt: 500000 }], cash_txns: [], customer_debt_log: [] });
    const X = loadPage(db);
    Object.assign(X.S, { data: fixture(), shopId: SH, user: { id: 'u1' } });
    const toQ = r => ({ id: r.id, status: r.status, invoiced: true, invoicedAt: r.invoiced_at, amountPaid: 0, voided: false, date: r.date, ...JSON.parse(JSON.stringify(r.payload)) });
    X.S.data.savedQuotes = [toQ(q1), toQ(q2)];
    const plan = X.payPlan(X.S.data.customers[0], 350000, [2]);
    t.check(plan.bills[0].q.id === 2 && plan.bills[0].pay === 300000 && plan.bills[1].pay === 0 && plan.rest === 50000 && plan.after === 150000, 'a picked bill is paid first, an unpicked one not at all, and the plan says what they owe after');
    X.S.stack = [{ type: 'pay', args: { id: 'C001', amt: 350000, method: 'cash', mode: 'pick', picks: [2] } }];
    await X.ACT['slide:pay']();
    const cash = db.writes.filter(x => x[0] === 'insert' && x[1] === 'cash_txns').map(x => x[2]);
    t.check(cash.length === 2 && cash[0].quote_id === 2 && cash[0].amount === 300000 && cash[1].quote_id === null && cash[1].amount === 50000, 'one receipt on the picked bill, one for the rest: ' + cash.map(c => c.amount + '/' + c.quote_id).join());
    t.check(db.tables.saved_quotes[0].amount_paid === 0 && db.tables.saved_quotes[1].amount_paid === 300000, 'the bill not picked is left alone');
    const pm = db.tables.saved_quotes[1].payload.payments[0];
    t.check(pm.cashTxnId === cash[0].id && pm.method === 'cash' && pm.id === 1, 'the payment carries its receipt, its account and its own number');
    t.check(db.tables.customers[0].debt === 150000, 'they owe 150,000 after paying 350,000 of 500,000');
    t.check(X.S.stack[0].type === 'paid' && X.S.stack[0].args.after === 150000, 'the paid screen shows what is left');
  }

  // 4c. an order paid before its invoice: a receipt and a payment on the order, no debt
  {
    const q7 = { id: 7, shop_id: SH, invoiced: false, amount_paid: 0, status: 'draft', voided: false, date: '2026-10-01',
      payload: { client: { name: 'Kato Construction' }, customerId: 'C001', debtCharged: 0, items: [line('P1', null, 2, 'S1', 32000, { sellPrice: 50000 })], payments: [] } };
    const db = fakeDb({ saved_quotes: [q7], customers: [{ id: 'C001', shop_id: SH, debt: 500000 }], cash_txns: [], customer_debt_log: [] });
    const X = loadPage(db);
    Object.assign(X.S, { data: fixture(), shopId: SH, user: { id: 'u1' } });
    X.S.data.savedQuotes = [{ id: 7, status: 'draft', invoiced: false, amountPaid: 0, voided: false, date: q7.date, ...JSON.parse(JSON.stringify(q7.payload)) }];
    X.S.stack = [{ type: 'pay', args: { orderId: 7, amt: 150000, method: 'momo' } }];
    await X.ACT['slide:pay']();
    t.check(db.writes.length === 0, 'more than the order takes writes nothing');
    X.S.paying = false;
    X.S.stack = [{ type: 'pay', args: { orderId: 7, amt: 60000, method: 'momo' } }];
    await X.ACT['slide:pay']();
    const cash = db.writes.filter(x => x[0] === 'insert' && x[1] === 'cash_txns').map(x => x[2]);
    t.check(cash.length === 1 && cash[0].category === 'Invoice Payment' && cash[0].quote_id === 7 && cash[0].amount === 60000 && cash[0].account === 'momo', 'one Invoice Payment receipt on the order');
    const row = db.tables.saved_quotes[0];
    t.check(row.amount_paid === 60000 && row.invoiced === false && row.payload.payments[0].cashTxnId === cash[0].id, 'the order carries the payment and stays uninvoiced');
    t.check(!db.writes.some(x => x[1] === 'customers' || x[1] === 'customer_debt_log'), 'no debt is touched before the invoice');
    t.check(X.S.stack[0].type === 'paid' && X.S.stack[0].args.after === 40000, 'the paid screen says 40,000 is left to pay');
  }

  // 5. the salesperson's price (canvas: Setting the price): never under cost, and flagged for the owner
  {
    const X = loadPage(fakeDb({}));
    Object.assign(X.S, { data: fixture(), shopId: SH, user: { id: 'u1' } });
    const ruled = line('P1', null, 3, 'S1', 32000), shop = X.shopSellPrice(ruled);
    t.check(shop === 36800, 'the shop\'s price is the markup rule\'s price (' + shop + ')');
    t.check(X.priceTooLow(ruled, 31999) && !X.priceTooLow(ruled, 32000), 'a price under the cost is refused, the cost itself is allowed');
    t.check(X.priceNoteFor(ruled, 35000) === 'under' && X.priceNoteFor(ruled, 36800) === null, 'under the shop\'s price is marked for the owner; the shop\'s price is not');
    X.S.data.presetDefaultMarkup = {};
    const bare = line('P3', null, 30, 'S1', 3600);
    t.check(X.shopSellPrice(bare) === null && X.priceNoteFor(bare, 5000) === 'nomargin', 'no margin set: the salesperson sets it and the owner reviews it');
    const nocost = line('P3', null, 2, '', 0);
    t.check(!X.priceTooLow(nocost, 1) && X.priceNoteFor(nocost, 25000) === 'nocost', 'no cost known: any price, marked to be confirmed');
    t.check(!X.linePriceToConfirm({ ...nocost, sellPrice: 25000, priceBy: 'u1', priceNote: 'nocost' }), 'a quoted price counts in the total');
    const pv = X.pricedView({ items: [{ ...nocost, sellPrice: 25000, priceBy: 'u1', priceNote: 'nocost' }], charges: [] });
    t.check(pv.total === 50000 && pv.pending === 1, 'and the order says one price is still to be confirmed');
  }

  // 6. chats: a reply always has a road, and what fails says why
  {
    const X = loadPage(fakeDb({}));
    Object.assign(X.S, { data: fixture(), shopId: SH });
    const now = Date.now(), open = { id: 1, wa_id: '256772123456', last_inbound_at: new Date(now - 3600e3).toISOString() };
    const shut = { id: 2, wa_id: '256772000000', last_inbound_at: new Date(now - 30 * 3600e3).toISOString() };
    t.check(X.chatKind(open, null) === 'text' && X.chatKind(open, { url: 'x' }) === 'image', 'an open chat takes words and pictures as they are');
    t.check(X.chatKind(shut, null) === 'template' && X.chatCanSend(shut, 'We can replace it', null), 'a shut chat still takes a reply — inside the shop\'s reply message');
    t.check(!X.chatCanSend(shut, '', { url: 'x' }) && X.chatCanSend(open, '', { url: 'x' }), 'a picture goes only while the chat is open');
    t.check(!X.chatCanSend({ ...open, opt_out: true }, 'hello', null), 'nobody who said STOP is written to');
    t.check(!X.chatCanSend(open, '   ', null), 'nothing to send is not sent');
    t.check(/No connection/.test(X.chatWhyNot(new TypeError('Failed to fetch'), 'text')), 'a dropped connection says so');
    t.check(/server update/.test(X.chatWhyNot(new Error('Unknown action "send-reply-template"'), 'template')), 'an old server says it needs the update, not a riddle');
    t.check(/reply message/.test(X.chatWhyNot(new Error('The 24-hour reply window is closed — the customer has to message first.'), 'text')), 'a window that shut mid-send points at the reply message');
    const m = (msg_type, body, payload) => ({ msg_type, body, payload });
    t.check(X.chatSaid(m('audio', '[audio]')) === 'Voice note' && X.chatSaid(m('image', '[image] torn')) === 'torn' && X.chatSaid(m('image', '[image]')) === 'Picture', 'voice notes and pictures read as what they are, not "[audio]"');
    t.check(X.chatSaid(m('document', '[document]', { document: { filename: 'BOQ.pdf' } })) === 'BOQ.pdf' && X.chatSaid(m('location', '[location]', { location: { name: 'Najjera site' } })) === 'Najjera site', 'a document by its name, a location by its place');
    t.check(X.chatSaid(m('interactive', '[catalog] Browse')) === 'Catalogue' && X.chatSaid(m('template', 'We can replace it')) === 'We can replace it', 'the catalogue card and a reply message read plainly');
    X.S.user = { id: 'u1' };
    const out = (o) => ({ direction: 'out', msg_type: 'text', body: 'ok', ...o });
    t.check(X.chatSender(out({ sent_by: 'u1', sent_by_name: 'Amina' })).name === 'You' && X.chatSender(out({ sent_by: 'u9', sent_by_name: 'Grace Namubiru' })).name === 'Grace Namubiru', 'every reply names who on the team sent it — you, or them by name');
    t.check(X.chatSender(out({ payload: { from: '2567', timestamp: '1' } })).name === 'Shop phone' && X.chatSender(out({ payload: { auto: true } })).name === 'Automatic', 'typed on the shop phone, or sent by itself, it says so');
    t.check(X.chatSender(out({})) === null && X.chatSender({ direction: 'in', sent_by_name: 'x' }) === null, 'a reply from before the stamp names nobody rather than a guess; a customer\'s message is theirs');
    const one = X.chatPriceLine('P2', 0, 1), bulk = X.chatPriceLine('P2', 0, 40), none = X.chatPriceLine('P3', null, 1);
    t.check(one && one.price === Math.round(X.quoteItemSellPrice(X.makeLine('P2', 0, 1))) && bulk.price === Math.round(X.quoteItemSellPrice(X.makeLine('P2', 0, 40))) && /^40 Iron sheets G28: /.test(bulk.text), 'a price is the selling price at the quantity they asked for');
    t.check(none && none.price === null && /price to confirm/.test(none.text) && !/90,000|3,600/.test(none.text), 'no selling rule: "price to confirm", never the cost');
  }

  // the screens draw from the fixture without throwing
  {
    const X = loadPage(fakeDb({}));
    Object.assign(X.S, { data: fixture(), shopId: SH, user: { id: 'u1', email: 'a@b.c' }, shopName: 'Shop' });
    ['viewToday', 'viewOrders', 'viewCustomers', 'viewMe'].forEach(v => { let ok = true; try { X[v](); } catch (e) { ok = false; t.fail(v + ' threw: ' + e.message); } if (ok) t.pass(v + ' draws'); });
    ['customer', 'neworder', 'pay'].forEach(pg => { try { X.PAGE[pg]({ id: 'C001', amt: 1000, method: 'cash' }); t.pass('page ' + pg + ' draws'); } catch (e) { t.fail('page ' + pg + ' threw: ' + e.message); } });
    X.S.data.cashTxns = [{ id: 11, date: '2026-10-01', time: '09:00', account: 'cash', type: 'receipt', category: 'Debt Payment', amount: 50000, quoteId: null }];
    try { const h = X.PAGE.paid({ fromTxn: 11 }); t.check(h.includes('50,000'), 'page paid draws from a receipt in the books'); } catch (e) { t.fail('page paid (fromTxn) threw: ' + e.message); }
  }

  process.exit(t.done() ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
