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
 *   4. What the review found, kept found: two counts typed fast both
 *      land, nothing is booked onto a closed day, a minus survives a
 *      count, suppliers without an id are never paid together.
 *   5. Every screen draws from the fixture without throwing.
 *   6. The treasurer (0123): the console's statements are carried into
 *      the page word for word; an expense, a transfer, a corrected
 *      payment, wages, a trip's cash, a loan and an asset each write the
 *      console's own rows, in categories the 0123 wall lets through.
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
const mig = read('supabase/migrations/0117_accounts_role.sql') + '\n' + read('supabase/migrations/0123_accounts_treasurer.sql');
const mig123 = read('supabase/migrations/0123_accounts_treasurer.sql');

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
    staff: [{ id: 'W1', shop_id: SH, name: 'Esther Auma', role: 'accounts', user_id: 'u1', pay_basis: 'monthly', pay_rate: 600000 }, { id: 'W2', shop_id: SH, name: 'Denis Okello', role: 'buyer', user_id: 'u2', pay_basis: 'monthly', pay_rate: 450000 }],
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
    dues: [], loans: [{ id: 1, shop_id: SH, lender: 'Centenary Bank', principal: 1200000, rate_pct: 20, method: 'reducing_balance', term_months: 12, fees: 0, round_to: 1000, frequency: 'monthly', fee_per_instalment: 0, started_on: iso(70), payload: { repayments: [] } }],
    fixed_assets: [{ id: 1, shop_id: SH, name: 'Platform scale', category: 'Machine', cost: 900000, acquired_on: iso(400), method: 'straight_line', life_months: 60, salvage: 0 }],
    rent_agreements: [{ id: 1, shop_id: SH, premises: 'Kikuubo', landlord: 'Mr Kasozi', amount: 1000000, due_day: 1, start_month: '2026-01' }],
    stock: [], stock_lots: [], agents: [], agent_commission_claims: [], invoice_asks: [], decision_log: [],
    collection_trips: [{ id: 'TRIP-1', shop_id: SH, supplier_id: 'S1', status: 'collected', assigned_worker_id: 'W2', created_at: new Date().toISOString(), collected_at: new Date().toISOString(), cash_given: 500000, voided: false,
      lines: [{ productName: 'Iron sheets', qty: 10, expectedPrice: 30000, gotQty: 10, gotPrice: 30000 }] }],
    app_settings: [{ shop_id: SH, presets: { ownerPhone: '0772555666' } }],
    role_tasks: [...mig.matchAll(/\('accounts',\s*'([a-z.]+)'\)/g)].map(m => ({ role: 'accounts', task: m[1] })),
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
  Q.prototype.in = function(k, v){ this.f.push(r => v.map(String).includes(String(r[k]))); return this; };
  Q.prototype.not = function(k){ this.f.push(r => r[k] != null); return this; };
  Q.prototype.order = Q.prototype.limit = function(){ return this; };
  Q.prototype.maybeSingle = function(){ this.one = true; return this; };
  Q.prototype.insert = function(row){ this.op = 'insert'; this.row = row; return this; };
  Q.prototype.update = function(row){ this.op = 'update'; this.row = row; return this; };
  Q.prototype.then = function(res, rej){
    const rows = tb[this.t] || (tb[this.t] = []);
    if (this.op === 'insert') { const list = Array.isArray(this.row) ? this.row : [this.row]; list.forEach(r => { writes.push(['insert', this.t, clone(r)]); rows.push(clone(r)); }); return Promise.resolve({ error: null }).then(res, rej); }
    const hit = rows.filter(r => this.f.every(f => f(r)));
    if (this.op === 'update') { writes.push(['update', this.t, clone(this.row)]); hit.forEach(r => Object.assign(r, clone(this.row))); return Promise.resolve({ error: null }).then(res, rej); }
    return Promise.resolve({ data: clone(this.one ? (hit[0] || null) : hit), count: hit.length, error: null }).then(res, rej);
  };
  return { writes, tb, auth: { getUser: () => new Promise(() => {}), getSession: async () => ({ data: { session: null } }), signOut: async () => ({}) }, from: x => new Q(x),
    rpc: async (name, a) => name === 'next_row_id_blocks' ? { data: { [a.p_kinds[0]]: Math.max(nextId++, Number(a.p_floors[a.p_kinds[0]]) + 1) }, error: null } : { data: null, error: { message: 'no rpc' } } };
}

/* ---------------- the page, in a sandbox ---------------- */
const EXPORT = ['S', 'ACT', 'PAGE', 'D', 'loadAll', 'parseMoney', 'supplierKey', 'can', 'cbDayPosition', 'acctState', 'saveCount', 'closeDay', 'bookVariance', 'payBills', 'billDue', 'openBills', 'creditors', 'recordInvoiceSend', 'invoiceSent',
  'custAging', 'debtors', 'statementDue', 'summaryDebtors', 'summaryCreditors', 'TASK_WORDS', 'viewToday', 'viewOwed', 'viewBills', 'viewClose', 'billState', 'cameWord', 'inHandBy',
  'CB', 'moneyPosition', 'payrollMonth', 'tripsToCount', 'topArgs', 'push', 'txnById'];
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
  Object.keys(X.TASK_WORDS).forEach(k => t.check(granted.includes(k), `“${X.TASK_WORDS[k]}” (${k}) is a task 0117 or 0123 gives the accounts role`));
  const used = [...new Set([...html.matchAll(/has_task|can\('([a-z.]+)'\)/g)].map(m => m[1]).filter(Boolean))];
  used.forEach(k => t.check(granted.includes(k), `the page only asks for tasks 0117 or 0123 grant: ${k}`));
  const policy = /create policy "owner, sales or accounts writes" on cash_txns[\s\S]*?;\n/.exec(mig123)[0];
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

  /* ---------------- 4. what the review found ---------------- */
  {
    const { X, db } = await page();
    // Two counts saved at once: each reads the row before writing it back.
    await Promise.all([X.saveCount(T, 'cash', 111), X.saveCount(T, 'momo', 222)]);
    const row = db.tb.cash_days.find(r => r.date === T);
    t.check(row && row.actual.cash === 111 && row.actual.momo === 222 && db.tb.cash_days.filter(r => r.date === T).length === 1, 'two counts typed one after the other both land, in one row');
    t.check(X.parseMoney('-25,000') === -25000 && X.parseMoney('25,000') === 25000 && X.parseMoney('') === null, 'a count keeps its minus sign (an overdrawn bank)');
    for (const a of X.cbDayPosition(T).accounts) await X.saveCount(T, a.key, a.closing);
    await X.closeDay(T);
    t.check(X.cbDayPosition(T).closed, 'the day closes once all three agree');
    await X.saveCount(T, 'cash', 1);
    const before = db.writes.filter(w => w[1] === 'cash_txns').length;
    X.D().cashTxns.push({ id: 999, date: T, account: 'cash', type: 'receipt', category: 'Sales', amount: 7000 });
    t.check((await X.bookVariance(T, 'cash')) === false && db.writes.filter(w => w[1] === 'cash_txns').length === before, 'nothing is booked onto a closed day, even when a late receipt makes it look over');
    t.check(!/is over|is short/.test(X.viewToday()), 'and Today stops asking to book it');
  }
  {
    const { X } = await page();
    X.D().bills.push({ id: 91, supplierId: null, supplierName: 'Walk-in timber', items: [{ qty: 1, price: 10000 }], amountPaid: 0, payments: [], credits: [] },
      { id: 92, supplierId: null, supplierName: 'Roadside sand', items: [{ qty: 1, price: 20000 }], amountPaid: 0, payments: [], credits: [] });
    X.S.loadedAt++;
    const keys = X.creditors().map(r => r.sid);
    t.check(keys.includes('name:Walk-in timber') && keys.includes('name:Roadside sand') && X.openBills('name:Walk-in timber').length === 1, 'two suppliers with no id stay two, each with its own bills');
  }

  /* ---------------- 5. every screen draws ---------------- */
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
      paid: { name: 'Mulongo Builders', id: 'C1', phone: '', amount: 100000, method: 'cash', bills: [], before: 300000, after: 200000, time: '10:00' },
      position: {}, reports: {}, days: {}, expense: {}, income: {}, transfer: {}, payedit: { id: 5 }, propose: { cid: 'C1' }, billrec: { sid: 'S1' }, consign: {}, agents: {}, tripcash: {}, payroll: {}, absence: { sid: 'W1' }, loans: {}, assets: {}, assetbuy: {} };
    Object.keys(X.PAGE).forEach(k => draw('the ' + k + ' page', () => { X.S.stack = [{ type: k, args: args[k] || {} }]; return X.PAGE[k](args[k] || {}); }));
    t.check(Object.keys(X.PAGE).every(k => k in args), 'every page the app has is drawn here');
  }

  /* ---------------- 6. the treasurer ---------------- */
  {
    // The console's statements, carried word for word: comments and spacing aside, each is index.html's own.
    const block = /const CONSOLE_BOOKS = function\(data\)\{\n([\s\S]*?)\n  \/\* end of what is carried from index.html \*\//.exec(html)[1];
    const plain = x => x.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1').replace(/\s+/g, '');
    const fns = [...block.matchAll(/^(?:async\s+)?function\s+([\w$]+)\s*\(/gm)].map(m => m[1]);
    const differ = fns.filter(n => plain(fnText(block, n) || '') !== plain(fnText(adminSrc, n) || '-'));
    t.check(fns.length > 120 && !differ.length, `${fns.length} of the console's statement functions are carried word for word` + (differ.length ? ` -- these differ: ${differ.join(', ')}` : ''));
    t.check(['incomeStatement', 'balanceSheetAsAt', 'cashFlowStatement', 'consignmentRows', 'loanSchedule', 'dueCostOf'].every(n => fns.includes(n)), 'among them the profit and loss, the balance sheet, the cash flow, consignment, loans and wages');
  }
  {
    const { X, db } = await page();
    const allowed = new Set([...policy.matchAll(/'([A-Z][A-Za-z &]+)'/g)].map(m => m[1]));
    // cash.expense lets any payment through but the categories it names; everything else is named.
    const notExpense = new Set([.../category not in \(([^)]*)\)/.exec(policy)[1].matchAll(/'([^']+)'/g)].map(m => m[1]));
    const cashOk = () => db.writes.filter(w => w[1] === 'cash_txns' && w[0] === 'insert').every(w => w[2].amount > 0 && (allowed.has(w[2].category) || (w[2].type === 'payment' && !notExpense.has(w[2].category))));
    const s = X.CB().balanceSheetAsAt(T), p = X.moneyPosition();
    t.check(p.owedUs === s.receivables && p.inHand === s.cash && p.net === s.cash + s.receivables - s.payables - s.loans, 'where the money stands is the balance sheet’s own figures');
    t.check(typeof X.CB().incomeStatement(T.slice(0, 8) + '01', T).netProfit === 'number' && typeof X.CB().cashFlowStatement(Y2, T).netMovement === 'number', 'the profit and the cash flow come from the console’s statements');
    // An expense.
    X.S.stack = [{ type: 'expense', args: { amt: 50000, cat: 'Fuel', acct: 'cash', note: 'Shell Ntinda' } }];
    await X.ACT['slide:expense']();
    const ex = db.writes.filter(w => w[1] === 'cash_txns').pop()[2];
    t.check(ex.type === 'payment' && ex.category === 'Fuel' && ex.amount === 50000 && ex.account === 'cash' && ex.description === 'Shell Ntinda', 'an expense is one Fuel payment, as the console writes it');
    t.check(db.writes.some(w => w[1] === 'decision_log' && w[2].task === 'cash.expense'), 'and the owner gets it in the log');
    // A transfer: two legs, each pointing at the other.
    X.S.stack = [{ type: 'transfer', args: { amt: 100000, from: 'cash', to: 'bank' } }];
    await X.ACT['slide:transfer']();
    const legs = db.writes.filter(w => w[1] === 'cash_txns' && w[2].category === 'Account Transfer').map(w => w[2]);
    t.check(legs.length === 2 && legs[0].type === 'payment' && legs[1].type === 'receipt' && legs[0].transfer_id === legs[1].id && legs[1].transfer_id === legs[0].id && legs[1].account === 'bank', 'a transfer is two Account Transfer lines that point at each other');
    // A payment on account moved onto its invoice: the debt does not move.
    const debt0 = db.tb.customers.find(c => c.id === 'C1').debt;
    X.S.stack = [{ type: 'payedit', args: { id: 5, to: '12', amt: 100000 } }];
    await X.ACT.payeditsave();
    const q12 = db.tb.saved_quotes.find(r => r.id === 12), line = db.tb.customer_debt_log.find(l => l.id === 4), c5 = db.tb.cash_txns.find(r => r.id === 5);
    t.check(q12.amount_paid === 100000 && q12.payload.payments.some(x => x.cashTxnId === 5) && q12.payload.debtCharged === 0, 'a payment moved to its invoice pays that invoice');
    t.check(Number(line.quote_id) === 12 && line.amount === 100000 && Number(c5.quote_id) === 12 && c5.amount === 100000, 'the same cash line and debt line follow it, at the corrected amount');
    t.check(db.tb.customers.find(c => c.id === 'C1').debt === debt0 + 20000, 'and the debt rises only by what the correction took off the payment');
    // Wages: the month's due is raised, then paid as Salaries & Wages.
    X.S.stack = [{ type: 'payroll', args: { sel: { 'wage:W1': true }, acct: 'bank' } }];
    await X.ACT['slide:payroll']();
    const due = db.tb.dues.find(d => d.ref_id === 'W1'), wage = db.writes.filter(w => w[1] === 'cash_txns').pop()[2];
    t.check(due && due.paid === 600000 && due.payload.payments[0].cashTxnId === wage.id && wage.category === 'Salaries & Wages', 'wages raise the month’s due and pay it as Salaries & Wages');
    // A trip's cash, short.
    X.S.stack = [{ type: 'tripcash', args: { key: X.tripsToCount()[0].key, counted: 150000 } }];
    await X.ACT['slide:tripcash']();
    const trip = db.tb.collection_trips[0], sh = db.writes.filter(w => w[1] === 'cash_txns').pop()[2];
    t.check(trip.cash_count && trip.cash_count.expected === 200000 && trip.cash_count.diff === -50000 && sh.category === 'Cash Shortage' && sh.amount === 50000, 'a trip’s cash 50,000 short is counted on the trip and booked as a Cash Shortage');
    // A loan repaid, an asset bought.
    X.S.stack = [{ type: 'loans', args: { lid: 1, amt: 111000, acct: 'bank' } }];
    await X.ACT['slide:loanrepay']();
    t.check(db.tb.loans[0].payload.repayments.length === 1 && db.writes.filter(w => w[1] === 'cash_txns').pop()[2].category === 'Loan Repayment', 'a repayment is kept on the loan and booked as Loan Repayment');
    X.S.stack = [{ type: 'assetbuy', args: { amt: 1850000, name: 'Generator', cat: 'Machine', years: 5, acct: 'bank' } }];
    await X.ACT['slide:assetbuy']();
    const fa = db.tb.fixed_assets.find(a => a.name === 'Generator');
    t.check(fa && fa.life_months === 60 && fa.method === 'straight_line' && db.writes.filter(w => w[1] === 'cash_txns').pop()[2].category === 'Equipment purchase', 'an asset bought joins the assets and is booked as Equipment purchase');
    t.check(cashOk(), 'every cash line the treasurer writes is in a category the 0123 wall lets through');
  }
  process.exit(t.done() ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
