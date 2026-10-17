#!/usr/bin/env node
'use strict';
/*
 * The Accounts app (accounts.html): every figure it shows and every row it
 * writes must be the owner's own, in the shape the owner's app reads.
 *
 *   1. Parity. The rules carried from sales.html are byte-for-byte the
 *      same text; the cash book (opening carried, book = opening + in −
 *      out, a count's variance) gives the same figures as index.html on
 *      the same day.
 *   2. The walls. Every task the app asks for is one 0117 grants the
 *      accounts role, and every cash_txns row it writes is one the 0117
 *      insert policy lets through.
 *   3. The writes: a supplier paid in full and in part, a count, a close
 *      that waits for all three accounts to agree, a variance booked, an
 *      invoice marked sent.
 *   4. Every screen draws from the fixture without throwing.
 *
 * Runs the page's real script in a sandbox with a fake database; nothing
 * is copied into this file.
 *
 * Run: node test/accounts-app.test.js   (or: npm test)
 */
const vm = require('vm');
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('accounts app');
const html = read('accounts.html');
const salesSrc = read('sales.html');
const adminSrc = read('index.html');
const mig = read('supabase/migrations/0117_accounts_role.sql');

/* ---------------- the fixture: one small shop ---------------- */
const SH = 'shop1';
const iso = d => { const x = new Date(Date.now() - d * 864e5); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
const T = iso(0), Y = iso(1), Y2 = iso(2);
function tables(){
  const q = (id, cust, name, d, total, paid) => ({ id, shop_id: SH, client_name: name, client_phone: '', date: iso(d), status: 'completed', invoiced: true, invoiced_at: iso(d), invoiced_ts: null, amount_paid: paid, voided: false,
    payload: { customerId: cust, client: { name, phone: '' }, items: [{ productName: 'Cement 50kg', qty: total / 1000, unit: 'bag', sellPrice: 1000 }], charges: [], payments: [], debtCharged: total } });
  return {
    customers: [{ id: 'C1', shop_id: SH, name: 'Mulongo Builders', phone: '0772410220', location: 'Ntinda', debt: 180000, terms_days: 30 }, { id: 'C2', shop_id: SH, name: 'Okello & Sons', phone: '', location: '', debt: 50000, terms_days: 14 }],
    customer_debt_log: [{ id: 1, shop_id: SH, customer_id: 'C1', date: iso(40), type: 'charge', amount: 200000, quote_id: 11 }, { id: 2, shop_id: SH, customer_id: 'C1', date: iso(5), type: 'charge', amount: 100000, quote_id: 12 }, { id: 3, shop_id: SH, customer_id: 'C2', date: iso(3), type: 'charge', amount: 50000, quote_id: 13 },
      { id: 4, shop_id: SH, customer_id: 'C1', date: T, type: 'payment', amount: 120000, quote_id: null, cash_txn_id: 5 }],
    products: [], prices: [],
    saved_quotes: [q(11, 'C1', 'Mulongo Builders', 40, 200000, 0), q(12, 'C1', 'Mulongo Builders', 5, 100000, 0), q(13, 'C2', 'Okello & Sons', 0, 50000, 0)],
    suppliers: [{ id: 'S1', shop_id: SH, name: 'Steel & Tube', phone: '0414222333', terms_days: 30 }],
    staff: [{ id: 'W1', shop_id: SH, name: 'Sarah Nakato', role: 'accounts', user_id: 'u1' }],
    cash_txns: [
      { id: 1, shop_id: SH, date: Y2, account: 'cash', type: 'receipt', category: 'Sales', amount: 500000 },
      { id: 2, shop_id: SH, date: Y, account: 'cash', type: 'receipt', category: 'Sales', amount: 300000 },
      { id: 3, shop_id: SH, date: Y, account: 'MTN MoMo', type: 'receipt', category: 'Debt Payment', amount: 40000 },
      { id: 4, shop_id: SH, date: Y, account: 'bank', type: 'expense', category: 'Rent', amount: 100000 },
      { id: 5, shop_id: SH, date: T, account: 'cash', type: 'receipt', category: 'Invoice Payment', amount: 120000 },
      { id: 6, shop_id: SH, date: T, account: 'momo', type: 'payment', category: 'Transport', amount: 15000 },
      { id: 7, shop_id: SH, date: T, account: 'Airtel Money', type: 'receipt', category: 'Customer Payment', amount: 60000 },
    ],
    cash_days: [
      { shop_id: SH, date: Y2, opening: { cash: 1000000, momo: 200000, bank: 3000000 }, actual: { cash: 1490000, momo: 200000, bank: 3000000 }, opening_set: true, closed_at: 'x', closed_by: 'u1' },
      { shop_id: SH, date: Y, opening: { cash: 1500000, momo: 200000, bank: 3000000 }, actual: { cash: null, momo: 240000, bank: '' }, opening_set: false },
    ],
    purchase_invoices: [
      { id: 21, shop_id: SH, date: iso(20), payload: { supplierId: 'S1', supplierName: 'Steel & Tube', supplierRef: 'ST/1', dueDate: iso(2), items: [{ productId: 'P1', productName: 'Iron sheets', qty: 10, price: 30000 }], amountPaid: 0 } },
      { id: 22, shop_id: SH, date: iso(4), payload: { supplierId: 'S1', supplierName: 'Steel & Tube', items: [{ productId: 'P2', productName: 'Tube', qty: 4, price: 25000 }], transport: 5000, amountPaid: 0 } },
    ],
    stock_log: [{ shop_id: SH, pi_id: 21, product_id: 'P1', variant_idx: null, delta: 10, date: iso(19) }],
    statements_sent: [], payment_promises: [],
    app_settings: [{ shop_id: SH, presets: { ownerPhone: '0772555666' } }],
    role_tasks: ['payment.receive', 'statement.send', 'invoice.send', 'day.count', 'day.close', 'variance.book', 'bill.pay'].map(task => ({ role: 'accounts', task })),
    shop_members: [{ shop_id: SH, user_id: 'u1', role: 'accounts' }],
  };
}
function fakeDb(tb){
  const writes = []; let nextId = 1000;
  const clone = x => JSON.parse(JSON.stringify(x));
  function Q(table){ this.t = table; this.f = []; this.op = 'select'; this.one = false; }
  Q.prototype.select = function(){ return this; };
  Q.prototype.eq = function(k, v){ this.f.push(r => String(r[k]) === String(v)); return this; };
  Q.prototype.gt = function(k, v){ this.f.push(r => r[k] > v); return this; };
  Q.prototype.gte = function(k, v){ this.f.push(r => r[k] >= v); return this; };
  Q.prototype.not = function(k){ this.f.push(r => r[k] != null); return this; };
  Q.prototype.order = Q.prototype.limit = function(){ return this; };
  Q.prototype.maybeSingle = function(){ this.one = true; return this; };
  Q.prototype.insert = function(row){ this.op = 'insert'; this.row = row; return this; };
  Q.prototype.update = function(row){ this.op = 'update'; this.row = row; return this; };
  Q.prototype.then = function(res, rej){
    const rows = tb[this.t] || (tb[this.t] = []);
    if (this.op === 'insert') { writes.push(['insert', this.t, clone(this.row)]); rows.push(clone(this.row)); return Promise.resolve({ error: null }).then(res, rej); }
    const hit = rows.filter(r => this.f.every(f => f(r)));
    if (this.op === 'update') { writes.push(['update', this.t, clone(this.row)]); hit.forEach(r => Object.assign(r, clone(this.row))); return Promise.resolve({ error: null }).then(res, rej); }
    return Promise.resolve({ data: clone(this.one ? (hit[0] || null) : hit), count: hit.length, error: null }).then(res, rej);
  };
  return { writes, tb, auth: { getUser: () => new Promise(() => {}), getSession: async () => ({ data: { session: null } }), signOut: async () => ({}) }, from: x => new Q(x),
    rpc: async (name, a) => name === 'next_row_id_blocks' ? { data: { [a.p_kinds[0]]: Math.max(nextId++, Number(a.p_floors[a.p_kinds[0]]) + 1) }, error: null } : { data: null, error: { message: 'no rpc' } } };
}

/* ---------------- the page, in a sandbox ---------------- */
const EXPORT = ['S', 'ACT', 'PAGE', 'D', 'loadAll', 'can', 'cbDayPosition', 'acctState', 'saveCount', 'closeDay', 'bookVariance', 'payBills', 'billDue', 'openBills', 'creditors', 'recordInvoiceSend', 'invoiceSent',
  'custAging', 'debtors', 'statementDue', 'summaryDebtors', 'summaryCreditors', 'TASK_WORDS', 'viewToday', 'viewOwed', 'viewBills', 'viewClose', 'billState', 'cameWord', 'inHandBy'];
function loadPage(db){
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  const app = scripts.find(s => s.includes('function cbDayPosition'));
  if (!app) throw new Error('accounts.html has no app script');
  const el = () => ({ innerHTML: '', textContent: '', children: [], style: {}, dataset: {}, classList: { add() {}, remove() {}, toggle() {} }, setAttribute() {}, querySelector: () => null, querySelectorAll: () => [], appendChild() {}, remove() {} });
  const store = {};
  const sandbox = {
    console, setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, requestAnimationFrame: () => 0, Promise, Date, Math, JSON, URLSearchParams, encodeURIComponent, isFinite, isNaN, Set, Map,
    location: { hostname: 'localhost', hash: '', reload() {} },
    localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
    navigator: {},
    document: { getElementById: el, querySelector: () => null, querySelectorAll: () => [], addEventListener() {}, createElement: el, body: { appendChild() {}, style: {} }, documentElement: { classList: { toggle() {} } }, visibilityState: 'visible', activeElement: null },
    supabase: { createClient: () => db },
  };
  sandbox.window = sandbox; sandbox.window.open = () => {}; sandbox.window.addEventListener = () => {};
  vm.createContext(sandbox);
  vm.runInContext(app + '\n;globalThis.__x = { ' + EXPORT.join(', ') + ' };', sandbox);
  return sandbox.__x;
}
async function page(){
  const db = fakeDb(tables()), X = loadPage(db);
  Object.assign(X.S, { shopId: SH, user: { id: 'u1', email: 'sarah@shop.ug' }, shopName: 'Mukwano', role: 'accounts' });
  await X.loadAll();
  return { X, db };
}

/* ---------------- 1. parity ---------------- */
// A one-line function is the line; anything longer is brace-matched.
function fnText(src, name){
  const m = new RegExp('^(?:async\\s+)?function\\s+' + name + '\\s*\\(', 'm').exec(src); if (!m) return null;
  const line = src.slice(m.index, src.indexOf('\n', m.index)); let d = 0;
  for (const c of line) { if (c === '{') d++; else if (c === '}') d--; }
  return d === 0 ? line : extractFunction(src, name, 'source');
}
const FROM_SALES = ['issueRowId', 'IX', 'memo', 'productById', 'nameParts', 'quoteItemSellPrice', 'goodsTotal', 'chargesTotal', 'quoteTotal', 'balanceDue', 'invoiceLabel', 'customerById', 'customerOrdersFor', 'outstandingInvoices',
  'custTerms', 'custISO', 'custBillAge', 'custOpen', 'custLimit', 'custStmtRange', 'custStmtRows', 'custOpenCharges', 'custStmtRowDetail', 'custShopIdentity', 'custStmtPdfBytes', 'custRecordStatement', 'payPlan', 'insertRow', 'payNextPaymentId', 'payCashRow'];
FROM_SALES.forEach(n => { const a = fnText(html, n), b = fnText(salesSrc, n); t.check(a && a === b, `${n}() is the sales desk's own, word for word`); });

(async () => {
  const { X } = await page();
  // The owner's cash book on the same rows: their loader maps a provider's
  // name onto momo, so the rows go in mapped.
  const data = { cashDays: {}, cashTxns: [] };
  const norm = compileScope([extractDeclaration(adminSrc, 'ACCOUNTS', 'index.html'), extractDeclaration(adminSrc, 'CASH_ACCOUNT_KEYS', 'index.html'), extractFunction(adminSrc, 'normaliseCashAccount', 'index.html')], {}, ['normaliseCashAccount']);
  tables().cash_txns.forEach(r => data.cashTxns.push({ ...r, account: norm.normaliseCashAccount(r.account) }));
  tables().cash_days.forEach(cd => { data.cashDays[cd.date] = { opening: cd.opening, actual: cd.actual, openingSet: cd.opening_set }; });
  const admin = compileScope(['ACCOUNTS', 'cbAccountTotals', 'previousCashDate', 'cbClosingFor', 'carriedOpening', 'getDayRecord', 'cbDayPosition']
    .map(n => n === 'ACCOUNTS' ? extractDeclaration(adminSrc, n, 'index.html') : extractFunction(adminSrc, n, 'index.html')), { data }, ['cbDayPosition']);
  [Y2, Y, T].forEach(d => {
    const a = admin.cbDayPosition(d), b = X.cbDayPosition(d);
    ['cash', 'momo', 'bank'].forEach(k => {
      const x = a.accounts.find(r => r.key === k), y = b.accounts.find(r => r.key === k);
      t.check(['opening', 'in', 'out', 'closing', 'counted', 'variance'].every(f => x[f] === y[f]), `${d} ${k}: opening ${y.opening}, in ${y.in}, out ${y.out}, book ${y.closing}, counted ${y.counted} — the owner's figures`);
    });
  });
  const y = X.cbDayPosition(Y).accounts;
  t.check(y.find(a => a.key === 'cash').opening === 1490000, 'an unconfirmed opening is carried from the count the day before, not the stored figure');
  t.check(y.find(a => a.key === 'momo').in === 40000, 'a row written as "MTN MoMo" lands in mobile money');
  t.check(y.find(a => a.key === 'bank').counted === null, 'a cleared count is not a count of zero');

  /* ---------------- 2. the walls ---------------- */
  const granted = [...mig.matchAll(/\('accounts',\s*'([a-z.]+)'\)/g)].map(m => m[1]);
  Object.keys(X.TASK_WORDS).forEach(k => t.check(granted.includes(k), `“${X.TASK_WORDS[k]}” (${k}) is a task 0117 gives the accounts role`));
  const used = [...new Set([...html.matchAll(/has_task|can\('([a-z.]+)'\)/g)].map(m => m[1]).filter(Boolean))];
  used.forEach(k => t.check(granted.includes(k), `the page only asks for tasks 0117 grants: ${k}`));
  const policy = /create policy "owner, sales or accounts writes" on cash_txns[\s\S]*?;\n/.exec(mig)[0];
  ['Stock Purchase', 'Cash Shortage', 'Cash Overage', 'Debt Payment', 'Invoice Payment'].forEach(c => t.check(policy.includes(`'${c}'`), `the insert wall lets a ${c} row through`));

  /* ---------------- 3. the writes ---------------- */
  {
    const { X, db } = await page();
    const b = X.openBills('S1');
    t.check(b.length === 2 && X.billDue(b[0]) === 300000 && X.billDue(b[1]) === 105000, 'two open bills, transport counted in: 300,000 and 105,000');
    t.check(X.cameWord(b[0]).ok === true && X.cameWord(b[1]).ok === null, 'what came in is read from stock_log.pi_id; no record says so');
    t.check(X.billState(b[0]).k === 'late', 'a bill past its due date is late');
    await X.payBills([b[0]], 'bank');
    const cash = db.writes.filter(w => w[1] === 'cash_txns').map(w => w[2]);
    t.check(cash.length === 1 && cash[0].type === 'payment' && cash[0].category === 'Stock Purchase' && cash[0].account === 'bank' && cash[0].amount === 300000, 'paying a bill writes one Stock Purchase payment from the account picked');
    const pi = db.tb.purchase_invoices.find(r => r.id === 21).payload;
    t.check(pi.amountPaid === 300000 && pi.payments.length === 1 && pi.payments[0].cashTxnId === cash[0].id, 'the bill keeps the payment, linked to its cash row');
    t.check(pi.items.length === 1 && pi.supplierRef === 'ST/1', 'and nothing else on the bill changes');
    await X.payBills([X.openBills('S1')[0]], 'cash', { 22: 40000 });
    const pi2 = db.tb.purchase_invoices.find(r => r.id === 22).payload;
    t.check(pi2.amountPaid === 40000 && X.billDue(X.openBills('S1')[0]) === 65000, 'a part payment pays only the part and leaves the rest owed');
  }
  {
    const { X, db } = await page();
    const pos = X.cbDayPosition(T);
    await X.saveCount(T, 'cash', pos.accounts.find(a => a.key === 'cash').closing);
    const days = db.writes.filter(w => w[1] === 'cash_days');
    t.check(days.length === 1 && days[0][0] === 'insert' && days[0][2].actual.cash === pos.accounts.find(a => a.key === 'cash').closing, 'a count is written to the day');
    const closed = (await X.closeDay(T)) !== false;
    t.check(!closed && !db.writes.some(w => w[1] === 'cash_days' && w[2].closed_at), 'the day will not close while two accounts are uncounted');
    for (const a of X.cbDayPosition(T).accounts) await X.saveCount(T, a.key, a.key === 'momo' ? a.closing - 5000 : a.closing);
    t.check(X.acctState(X.cbDayPosition(T).accounts.find(a => a.key === 'momo')) === 'short', 'mobile money counted 5,000 under the book is short');
    await X.bookVariance(T, 'momo');
    const v = db.writes.filter(w => w[1] === 'cash_txns').map(w => w[2]).pop();
    t.check(v && v.type === 'payment' && v.category === 'Cash Shortage' && v.amount === 5000 && v.account === 'momo', 'booking it writes a 5,000 Cash Shortage on mobile money');
    t.check(X.cbDayPosition(T).agree === 3, 'and then all three agree');
    await X.closeDay(T);
    const up = db.writes.filter(w => w[1] === 'cash_days').pop()[2];
    t.check(!!up.closed_at && !('opening' in up) && !('opening_set' in up), 'the close stamps closed_at and never touches the opening');
  }
  {
    const { X, db } = await page();
    const q = X.D().savedQuotes.find(x => x.id === 13);
    t.check(!X.invoiceSent(q), 'an invoice nobody sent reads as not sent');
    await X.recordInvoiceSend(q, 'picture');
    const p = db.tb.saved_quotes.find(r => r.id === 13).payload;
    t.check(p.invoiceSends.length === 1 && p.invoiceSends[0].by === 'u1' && p.invoiceSends[0].via === 'picture' && X.invoiceSent(q), 'sending it is kept on the order, with who and how');
    t.check(p.items.length === 1 && p.debtCharged === 50000, 'and the rest of the order is left as it was');
  }

  /* ---------------- 4. every screen draws ---------------- */
  {
    const { X } = await page();
    const a = X.custAging(X.D().customers[0]);
    t.check(a.parts.b60 === 80000 && a.parts.b30 === 100000 && a.oldest === 40, 'a debt is aged from its own log, a loose payment off the oldest first: 80,000 at 40 days, 100,000 at 5');
    const d = X.summaryDebtors(), c = X.summaryCreditors();
    t.check(d.total === 230000 && c.total === 405000, 'the end-of-day pictures add up to what is owed each way');
    const draw = (name, f) => { let out = '', err = null; try { out = f(); } catch (e) { err = e; } t.check(!err && typeof out === 'string' && out.length > 200, `${name} draws${err ? ': ' + err.message : ''}`); };
    draw('Today', X.viewToday); draw('Owed', X.viewOwed); draw('Bills', X.viewBills); draw('Cash book', X.viewClose);
    const args = { account: { id: 'C1' }, acct: { key: 'cash' }, short: { key: 'momo' }, closed: {}, payment: { id: 5 }, find: { id: 5 }, receive: { pick: true }, statements: {}, stmt: { id: 'C1' }, range: { id: 'C1' },
      invoices: {}, invoice: { id: 13 }, share: {}, supplier: { sid: 'S1' }, bill: { id: 21 }, me: {},
      billpaid: { sid: 'S1', name: 'Steel & Tube', from: 'bank', paid: 300000, hand: 3000000, after: 2700000, owedAfter: 105000, at: Date.now(), lines: [{ ref: 'ST/1', pay: 300000, cleared: true }] },
      paid: { name: 'Mulongo Builders', id: 'C1', phone: '', amount: 100000, method: 'cash', bills: [], before: 300000, after: 200000, time: '10:00' } };
    Object.keys(X.PAGE).forEach(k => draw('the ' + k + ' page', () => { X.S.stack = [{ type: k, args: args[k] || {} }]; return X.PAGE[k](args[k] || {}); }));
    t.check(Object.keys(X.PAGE).every(k => k in args), 'every page the app has is drawn here');
  }
  process.exit(t.done() ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
