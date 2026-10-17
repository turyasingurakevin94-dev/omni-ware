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
 *   3. Placing an order writes one saved_quotes row at Checking with the
 *      exact columns and payload keys the admin's loadData maps.
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
  vm.runInContext(app + '\n;globalThis.__x = { S, ACT, PAGE, quoteItemSellPrice, quoteTotal, pricedView, linePriceToConfirm, makeLine, payPlan, viewToday, viewOrders, viewCustomers, viewMe, priceTooLow, priceNoteFor, shopSellPrice };', sandbox);
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
      if (fn === 'next_entity_id') return { data: 'C' + String(++custN).padStart(3, '0'), error: null };
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
      t.check(row.status === 'draft' && row.invoiced === false && row.voided === false && row.amount_paid === 0, 'it lands at Checking, not invoiced, nothing paid');
      t.check(row.shop_id === SH && row.client_name === 'Kato Construction' && row.date, 'the row columns the admin reads are filled');
      const p = row.payload;
      t.check(p.customerId === 'C001' && Array.isArray(p.payments) && p.debtCharged === 0 && Array.isArray(p.charges), 'payload carries customer, payments, debtCharged and charges');
      t.check(p.credit && p.credit.pct === 3 && p.credit.days === 30 && p.credit.agreedAt, 'credit is frozen on the order with its rate and term, as setOrderCredit does');
      t.check(Array.isArray(p.stageLog) && p.stageLog[0].status === 'draft' && p.stageLog[0].at === p.stageEnteredAt, 'the stage log starts at Checking at stageEnteredAt');
      const keys = Object.keys(p.items[0]).sort().join(',');
      t.check(keys === 'lineId,packQty,packUnit,price,productId,productName,qty,qtyIn,sellPrice,supplierId,supplierName,unit,variantIdx', 'each line has the item picker\'s fields and no others: ' + keys);
    }
    t.check(X.S.draft === null && X.S.stack[0] && X.S.stack[0].type === 'placed', 'the draft is cleared and the celebration opens');
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
