#!/usr/bin/env node
'use strict';
/*
 * The Owner app (owner.html): what only the owner decides, and the log of
 * everything decided for them (docs/decision-rights.md section 4).
 *
 * Runs the page's real script in a sandbox with a fake database: the books
 * read in, every screen drawn, and each owner write -- a step-in, a task
 * switch, a hire, the policy numbers -- sent where the database expects it.
 *
 * Run: node test/owner-app.test.js   (or: npm test)
 */
const vm = require('vm');
const { read, createReporter } = require('./_extract');

const t = createReporter('owner app');
const html = read('owner.html');
const app = html.slice(html.lastIndexOf('<script>') + 8, html.lastIndexOf('</script>')).replace(/\nboot\(\);\s*$/, '\n');

const SH = 'shop-1', OWNER = 'u-owner';
const pad = n => String(n).padStart(2, '0');
const iso = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const NOW = new Date(), TODAY = iso(NOW);
const M0 = iso(new Date(NOW.getFullYear(), NOW.getMonth(), 1)), MEND = iso(new Date(NOW.getFullYear(), NOW.getMonth() + 1, 0));
const NEXT = iso(new Date(NOW.getFullYear(), NOW.getMonth() + 1, 1));
const atToday = mins => new Date(new Date(TODAY + 'T00:00:00').getTime() + mins * 60000).toISOString();

function tables(){
  const staff = (id, name, role, user, rate, basis) => ({ shop_id: SH, id, name, phone: '0772000' + id.slice(-3), role, user_id: user, unavailable: false, pay_basis: basis || 'monthly', pay_rate: rate });
  return {
    shop_members: [{ shop_id: SH, user_id: OWNER, role: 'owner' }, { shop_id: SH, user_id: 'u-ruth', role: 'manager' }, { shop_id: SH, user_id: 'u-esther', role: 'accounts' }],
    staff: [staff('ST001', 'Ruth Nakato', 'manager', 'u-ruth', 1200000), staff('ST002', 'Esther Auma', 'accounts', 'u-esther', 900000),
      staff('ST003', 'Moses Lubega', 'sourcing', null, 600000), staff('ST004', 'Hassan', 'delivery', null, 15000, 'daily')],
    role_tasks: [['manager', 'markup.set'], ['manager', 'credit.set'], ['manager', 'price.approve'], ['accounts', 'bill.pay'], ['accounts', 'day.close'], ['sourcing', 'price.confirm']].map(([role, task]) => ({ role, task })),
    shop_task_off: [{ shop_id: SH, role: 'accounts', task: 'day.close' }],
    products: [{ shop_id: SH, id: 'P1', name: 'Iron sheet G28', category: 'Roofing', type: 'simple', wholesale_markup_type: 'percent', wholesale_markup_value: 25 }],
    prices: [{ shop_id: SH, id: 'PR1', product_id: 'P1', supplier_id: 'S1', wholesale: 55700 }],
    suppliers: [{ shop_id: SH, id: 'S1', name: 'Namanve Sheets' }],
    customers: [{ shop_id: SH, id: 'C1', name: 'Kato Construction', debt: 2410000, terms_days: 30 }],
    customer_debt_log: [{ shop_id: SH, id: 1, customer_id: 'C1', date: iso(new Date(NOW.getTime() - 64 * 864e5)), type: 'charge', amount: 2410000 }],
    saved_quotes: [
      { shop_id: SH, id: 1, status: 'draft', invoiced: false, voided: false, date: TODAY, client_name: 'Kato Construction', payload: { customerId: 'C1', stageEnteredAt: Date.now() - 10 * 60000, items: [] } },
      { shop_id: SH, id: 2, status: 'preparing', invoiced: false, voided: false, date: TODAY, client_name: 'Kato Construction', payload: { customerId: 'C1', stageEnteredAt: Date.now() - 6 * 3600000, items: [] } },
      { shop_id: SH, id: 3, status: 'completed', invoiced: true, invoiced_at: TODAY, voided: false, date: TODAY, client_name: 'Lubowa', payload: { items: [{ productId: 'P1', qty: 100, price: 55700, sellPrice: 69600, supplierId: 'S1' }] } },
    ],
    cash_txns: [], cash_days: [{ shop_id: SH, date: M0, opening: { cash: 1000000, momo: 0, bank: 0 }, opening_set: true, actual: { cash: null, momo: null, bank: null } }],
    purchase_invoices: [], dues: [], loans: [], fixed_assets: [], rent_agreements: [], stock: [], stock_lots: [],
    app_settings: [{ shop_id: SH, presets: { defaultMarkup: { wholesaleType: 'percent', wholesaleValue: 25, retailType: 'percent', retailValue: 30 }, creditHold: { days: 21, on: true }, priceReview: { perDay: 6 },
      shopLegalName: 'Mukasa Hardware', shopAddress: 'Kisekka St', shopPhone: '0772 000 100', categories: [{ name: 'Roofing', subcategories: [] }], units: ['bag'] } }],
    decision_log: [
      { id: 'L1', shop_id: SH, at: atToday(11 * 60 + 5), by: 'u-ruth', by_name: 'Ruth Nakato', role: 'manager', task: 'markup.set', what: 'Markup changed on Iron sheet G28', ref: { table: 'products', id: 'P1' }, before: { wholesaleMarkupValue: 20 }, after: { wholesaleMarkupValue: 25 } },
      { id: 'L2', shop_id: SH, at: atToday(9 * 60), by: 'u-esther', by_name: 'Esther Auma', role: 'accounts', task: 'bill.pay', what: 'Paid Kiseka Steel', amount: 2100000 },
      { id: 'L3', shop_id: SH, at: atToday(8 * 60), by: 'u-ruth', by_name: 'Ruth Nakato', role: 'manager', task: 'credit.set', what: 'Credit hold line set to 21 days', ref: { table: 'app_settings', id: SH, key: 'creditHold' }, before: { creditHold: { days: 30, on: true } }, after: { creditHold: { days: 21, on: true } } },
      { id: 'L4', shop_id: SH, at: atToday(7 * 60), by: 'u-ruth', by_name: 'Ruth Nakato', role: 'manager', task: 'invoice.void', what: 'Voided INV-0012' },
      { id: 'L5', shop_id: SH, at: atToday(6 * 60), by: OWNER, by_name: 'Joseph Mukasa', role: 'owner', task: 'staff.hire', what: 'Hired Moses Lubega as Sourcing' },
    ],
    manager_notes: [{ shop_id: SH, id: 1, kind: 'target', date: M0, status: 'open', body: { metric: 'sales', aim: 10000000, from: M0, to: MEND, source: 'owner' } }],
    shop_payment_providers: [{ shop_id: SH, provider: 'mtn', environment: 'production', enabled: true, credentials: { subscriptionKey: 'k', apiUser: 'u', apiKey: 'a' } }],
    agent_mobile_payments: [],
  };
}

function fakeDb(rows){
  const calls = [];
  function Q(table){ this.t = table; this.f = []; this.op = 'select'; this.one = false; this.lim = null; }
  const P = Q.prototype;
  P.select = function(){ return this; };
  P.eq = function(k, v){ this.f.push(r => String(r[k]) === String(v)); return this; };
  P.gte = function(k, v){ this.f.push(r => r[k] != null && String(r[k]) >= String(v)); return this; };
  P.gt = function(k, v){ this.f.push(r => r[k] != null && (typeof v === 'number' ? Number(r[k]) > v : String(r[k]) > String(v))); return this; };
  P.in = function(k, v){ this.f.push(r => v.map(String).includes(String(r[k]))); return this; };
  P.not = P.is = P.neq = P.lt = P.lte = P.order = function(){ return this; };
  P.limit = function(n){ this.lim = n; return this; };
  P.maybeSingle = P.single = function(){ this.one = true; return this; };
  P.insert = function(row){ this.op = 'insert'; this.row = row; return this; };
  P.update = function(row){ this.op = 'update'; this.row = row; return this; };
  P.upsert = function(row){ this.op = 'upsert'; this.row = row; return this; };
  P.then = function(res, rej){
    const list = rows[this.t] || (rows[this.t] = []), clone = x => JSON.parse(JSON.stringify(x));
    calls.push({ t: this.t, op: this.op, row: this.row && clone(this.row) });
    if (this.op === 'insert') { const r = { id: 100 + list.length, ...clone(this.row) }; list.push(r); return Promise.resolve({ data: this.one ? r : [r], error: null }).then(res, rej); }
    const hit = list.filter(r => this.f.every(f => f(r)));
    if (this.op === 'update') { hit.forEach(r => Object.assign(r, clone(this.row))); return Promise.resolve({ error: null }).then(res, rej); }
    if (this.op === 'upsert') { list.push(clone(this.row)); return Promise.resolve({ error: null }).then(res, rej); }
    const out = this.lim != null ? hit.slice(0, this.lim) : hit;
    return Promise.resolve({ data: clone(this.one ? (out[0] || null) : out), count: hit.length, error: null }).then(res, rej);
  };
  const rpc = async (fn, args) => {
    calls.push({ rpc: fn, args: JSON.parse(JSON.stringify(args)) });
    if (fn === 'next_entity_id') return { data: 'ST005', error: null };
    if (['owner_set_task', 'owner_step_in', 'set_shop_preset', 'owner_set_preset'].includes(fn)) return { data: { ok: true, presets: rows.app_settings[0].presets }, error: null };
    return { data: null, error: { message: 'Could not find the function ' + fn, code: 'PGRST202' } };
  };
  return { calls, rows, from: tb => new Q(tb), rpc, functions: { invoke: async (name, o) => { calls.push({ fn: name, body: o && o.body }); return { data: { ok: true }, error: null }; } },
    auth: { getUser: () => new Promise(() => {}), getSession: async () => ({ data: { session: null } }), signOut: async () => ({}) } };
}

function page(db){
  const el = () => ({ innerHTML: '', textContent: '', value: '', children: [], style: {}, dataset: {}, classList: { add() {}, remove() {}, toggle() {} }, setAttribute() {}, querySelector: () => null, querySelectorAll: () => [], appendChild() {}, remove() {}, focus() {} });
  const store = {};
  const sandbox = {
    console: { log() {}, warn() {}, error: console.error }, setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, requestAnimationFrame: () => 0, Promise, Date, Math, JSON, URLSearchParams, encodeURIComponent, isFinite, isNaN, Blob: function(){}, URL: { createObjectURL: () => '', revokeObjectURL() {} },
    location: { hostname: 'localhost', hash: '', reload() {} },
    localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
    navigator: {}, matchMedia: () => ({ matches: true }), confirm: () => true,
    document: { getElementById: el, querySelector: () => null, querySelectorAll: () => [], addEventListener() {}, createElement: el, body: { appendChild() {}, style: {} }, documentElement: { classList: { toggle() {} } }, visibilityState: 'visible', activeElement: null },
    supabase: { createClient: () => db },
  };
  sandbox.window = sandbox; sandbox.window.addEventListener = () => {};
  vm.createContext(sandbox);
  vm.runInContext(app + '\n;globalThis.__x = { S, ACT, PAGE, D, VIEWS, loadAll, madeForYou, byPerson, canStepIn, diffRows, showVal, glance, salesTarget, stageCounts, roleGroups, tasksOn, setupSteps, worstDebtor, priceReviewPerDay };', sandbox);
  const X = sandbox.__x;
  Object.assign(X.S, { shopId: SH, user: { id: OWNER, email: 'joseph.mukasa@shop.ug' }, shopName: 'Mukasa Hardware', role: 'owner', started: true });
  return X;
}
const drawn = s => typeof s === 'string' && s.length > 200 && !/could not be drawn/.test(s);

(async () => {
  /* ---------- 1. reading the books and the log ---------- */
  const db = fakeDb(tables()), X = page(db);
  await X.loadAll();
  const made = X.madeForYou(TODAY);
  t.check(made.length === 4 && !made.some(l => l.role === 'owner'), 'the log made for the owner leaves out the owner\'s own lines');
  const ppl = X.byPerson(made);
  t.check(ppl[0].name === 'Ruth' && ppl[0].n === 3 && ppl[1].name === 'Esther', 'who decided today, biggest share first, by the person\'s name');
  const L = id => X.D().log.find(l => l.id === id);
  t.check(X.canStepIn(L('L1')) && X.canStepIn(L('L3')), 'a markup and a setting can be stepped in on (0127 owner_step_in)');
  t.check(!X.canStepIn(L('L4')) && !X.canStepIn(L('L5')), 'a void cannot yet, and the owner\'s own line is not theirs to step in on');
  const d = X.diffRows(L('L1'))[0];
  t.check(d && X.showVal(d.key, d.was, L('L1')) === '20%' && X.showVal(d.key, d.now, L('L1')) === '25%', 'before and after read as the markup was and is');
  t.check(X.diffRows(L('L3')).some(r => r.key === 'days' && X.showVal('days', r.was, L('L3')) === '30 days'), 'a setting\'s change reads in its own unit');

  /* ---------- 2. the figures on Today ---------- */
  const g = X.glance();
  t.check(g.ok && g.owedUs === 2410000, 'owed to you is the console\'s receivables (CONSOLE_BOOKS)');
  const goal = X.salesTarget();
  t.check(goal && goal.aim === 10000000 && goal.actual === 6960000, 'the shop\'s goal is the owner\'s open target, measured from invoiced sales');
  const st = X.stageCounts();
  t.check(st.draft === 1 && st.preparing === 1 && st.stuck.length === 1, 'orders now: each stage counted, the one past its limit named');
  const wd = X.worstDebtor();
  t.check(wd && wd.c.name === 'Kato Construction' && wd.age >= 63 && wd.line === 21, 'worth a look: the oldest bill past the Manager\'s hold line');

  /* ---------- 3. every screen draws ---------- */
  Object.keys(X.VIEWS).forEach(v => t.check(drawn(X.VIEWS[v]()), `the ${v} tab draws`));
  t.check(/Nothing waits for you/.test(X.VIEWS.today()) && /0 waiting on you/.test(X.VIEWS.log()), 'and says, before anything, that nothing waits for the owner');
  t.check(!/joseph/i.test(X.VIEWS.today()), 'an owner with no staff row is greeted without their email address standing in for a name');
  t.check(/data-navy-top/.test(X.VIEWS.today()), 'the navy header is marked for the phone\'s status-bar strip');
  const pages = [['entry', { id: 'L1' }], ['entry', { id: 'L4' }], ['stepin', { id: 'L1' }], ['stepin', { id: 'L3' }], ['digest', {}], ['team', {}], ['role', { role: 'manager' }], ['role', { role: 'delivery' }],
    ['hire', {}], ['hire', { id: 'ST003' }], ['policy', {}], ['setup', {}], ['receipt', {}], ['momo', { prov: 'mtn' }], ['momo', { prov: 'airtel' }], ['words', {}], ['backup', {}]];
  pages.forEach(([p, a]) => { let out = ''; try { out = X.PAGE[p](a); } catch (e) { out = 'THREW ' + e.message; } t.check(drawn(out), `the ${p} page draws${a.id || a.role || a.prov ? ' (' + (a.id || a.role || a.prov) + ')' : ''}`); });
  t.check(/not built yet/.test(X.PAGE.entry({ id: 'L4' })), 'a decision with no step-in says so and offers the call instead');
  t.check(/PENDING/.test(X.PAGE.team({})) && /no login yet/.test(X.PAGE.team({})), 'someone hired without a login yet shows as pending');
  t.check(X.tasksOn('accounts').length === 1 && /bx-switch[^>]*aria-checked="false"[^>]*data-task="day\.close"/.test(X.PAGE.role({ role: 'accounts' })), 'a task the shop switched off shows off (0127 shop_task_off)');
  t.check(X.setupSteps().filter(s => s.done).length === 3 && !X.setupSteps().find(s => s.key === 'airtel').done, 'set-up: receipt, MTN and the words done; Airtel not set up');
  t.check(/1,200,000/.test(X.PAGE.team({})) && /paid by the day/.test(X.PAGE.team({})), 'pay a month adds the monthly pay, and says who is paid by the day');

  /* ---------- 4. the owner's writes ---------- */
  const rpcs = () => db.calls.filter(c => c.rpc);
  X.S.ui.step = { id: 'L1', pick: 'other', val: 22 };
  X.S.stack = [{ type: 'stepin', args: { id: 'L1' } }];
  await X.ACT.stepgo({ dataset: { id: 'L1' } });
  t.check(rpcs().some(c => c.rpc === 'owner_step_in' && c.args.p_log_id === 'L1' && c.args.p_value.wholesaleMarkupValue === 22), 'set another markup goes through owner_step_in with the new value');
  X.S.ui.step = { id: 'L3', pick: 'back', val: null };
  await X.ACT.stepgo({ dataset: { id: 'L3' } });
  t.check(rpcs().some(c => c.rpc === 'owner_step_in' && c.args.p_log_id === 'L3' && c.args.p_value === null), 'put it back sends no value: the database puts back what the log says was there');

  await X.ACT.task({ dataset: { role: 'accounts', task: 'bill.pay' } });
  await X.ACT.task({ dataset: { role: 'accounts', task: 'day.close' } });
  const sw = rpcs().filter(c => c.rpc === 'owner_set_task');
  t.check(sw.length === 2 && sw[0].args.p_on === false && sw[1].args.p_on === true, 'a switch turns a task off, and back on, through owner_set_task');

  X.S.ui.form = { _for: 'new', id: null, name: 'Rose Atuhaire', phone: '0772 111 222', role: 'store', payBasis: 'monthly', payRate: 350000, unavailable: false, email: 'rose@example.com' };
  X.S.stack = [{ type: 'hire', args: {} }];
  await X.ACT.hiresave();
  const ins = db.calls.find(c => c.t === 'staff' && c.op === 'insert');
  t.check(ins && ins.row.id === 'ST005' && ins.row.role === 'store' && ins.row.pay_rate === 350000 && ins.row.pay_basis === 'monthly', 'a hire is a staff row with its id from the server and its pay');
  t.check(db.calls.some(c => c.fn === 'invite-worker' && c.body.staffId === 'ST005' && c.body.email === 'rose@example.com'), 'and the login invite goes through invite-worker');
  t.check(db.calls.some(c => c.t === 'decision_log' && c.op === 'insert' && c.row.task === 'staff.hire' && c.row.role === 'owner'), 'and the hire is in the owner\'s log');

  X.S.stack = [{ type: 'policy', args: {} }];
  Object.assign(X.S.ui, { goalDraft: 12000000, perDay: 8, markup: 24 });
  await X.ACT.policysave();
  t.check(rpcs().some(c => c.rpc === 'owner_set_preset' && c.args.p_key === 'priceReview' && c.args.p_value.perDay === 8), 'prices a day goes through owner_set_preset');
  t.check(rpcs().some(c => c.rpc === 'set_shop_preset' && c.args.p_key === 'defaultMarkup' && c.args.p_value.wholesaleValue === 24 && c.args.p_value.retailValue === 30), 'the shop\'s markup through set_shop_preset, the retail side kept as it was');
  const goalRow = db.calls.find(c => c.t === 'manager_notes' && c.op === 'insert');
  t.check(goalRow && goalRow.row.kind === 'target' && goalRow.row.body.metric === 'sales' && goalRow.row.body.aim === 12000000 && goalRow.row.body.from === NEXT && !goalRow.row.body.who,
    'next month\'s goal is a shop target the Manager\'s app and the console read');

  await X.ACT.digesthour({ dataset: { v: '21' } });
  t.check(rpcs().some(c => c.rpc === 'owner_set_preset' && c.args.p_key === 'digestHour' && c.args.p_value === 21), 'the digest\'s hour is the owner\'s');

  /* ---------- 5. who may open it ---------- */
  t.check(/const pick = rows\.find\(m => m\.role === 'owner'\) \|\| rows\.find\(m => m\.role === 'admin'\);/.test(app), 'only an owner or an admin opens the owner\'s app');
  t.check(!/viewOwed|viewBills|viewClose/.test(app), 'none of the Accounts app\'s screens came along');

  process.exit(t.done() ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
