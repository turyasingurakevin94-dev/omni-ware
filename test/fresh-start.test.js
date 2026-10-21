#!/usr/bin/env node
'use strict';
/*
 * A fresh start (0148), read where no database is at hand.
 * test/fresh-start-db.test.js runs it against a real one.
 *
 *   1. The two steps are the operator's: no app login may call them, and
 *      each is a dry run unless told otherwise.
 *   2. The running records kept in the settings stay behind.
 *   3. The runbook says what to paste, in order, and that the old shop is
 *      never deleted; the decision-rights table holds the number.
 *   4. Photos are shared with the old shop, so the console only ever
 *      removes a photo from its own shop's storage folder.
 *   5. The Manager app's checklist of the old books' debts, and an opening
 *      balance sent as one write, only for a customer yet to trade.
 *
 * Run: node test/fresh-start.test.js   (or: npm test)
 */
const vm = require('vm');
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('a fresh start');
const mig = read('supabase/migrations/0148_fresh_start.sql');
const doc = read('docs/fresh-start.md');
const rights = read('docs/decision-rights.md');
const src = read('index.html');

/* ---------------- 1. the operator's, and a dry run first ---------------- */
for (const sig of ['ow_fs_copy(text, uuid, uuid, text, jsonb, boolean)', 'ow_fresh_start(uuid, text, boolean)', 'ow_fresh_start_move(uuid, uuid, boolean)']) {
  t.check(mig.includes(`revoke all on function ${sig} from public, anon, authenticated;`), `${sig.split('(')[0]}: no app login may call it`);
}
t.check(/function ow_fresh_start\(p_from uuid, p_name text, p_for_real boolean default false\)/.test(mig)
  && /function ow_fresh_start_move\(p_from uuid, p_to uuid, p_for_real boolean default false\)/.test(mig), 'both steps are a dry run unless told otherwise');
t.check((mig.match(/raise exception using errcode = 'OWFSD'/g) || []).length === 2 && (mig.match(/exception when sqlstate 'OWFSD' then/g) || []).length === 2,
  'a dry run undoes its work by its own error, and only that error is caught');
{
  const body = (name) => { const i = mig.indexOf('create or replace function ' + name + '('); return mig.slice(i, mig.indexOf('$$;', mig.indexOf('as $$', i))); };
  t.check(['ow_fs_copy', 'ow_fresh_start', 'ow_fresh_start_move'].every((n) => body(n).length > 100 && !/security definer/i.test(body(n))),
    'the operator\'s steps run with no powers beyond the operator\'s own');
  const ob = mig.slice(mig.indexOf('create or replace function set_opening_balance('));
  t.check(/security definer/.test(ob.slice(0, 300)) && /has_task\(p_shop_id, 'debt\.open'\)/.test(ob) && /grant execute on function set_opening_balance\(uuid, text, numeric, date\) to authenticated;/.test(mig),
    'the Manager\'s opening balance is a login\'s call, gated by debt.open');
  t.check(/insert into role_tasks \(role, task\) values \('manager', 'debt\.open'\)/.test(mig), 'and the Manager holds debt.open');
}
t.check(/'customers', p_from, v_to, 'true', '\{"debt": 0\}'\)/.test(mig), 'every customer\'s debt starts at 0');
t.check(!/'(stock|stock_lots|stock_log|cash_txns|cash_days|saved_quotes|purchase_invoices|customer_debt_log|loans|dues)', p_from/.test(mig),
  'no stock, cash, order, bill, debt history, loan or wage row is ever copied');
t.check(/'agents', p_from, v_to, 'x\.retired_at is null', '\{"user_id": null\}'\)/.test(mig), 'an agent\'s login never opens two shops (agents_user_unique)');

/* ---------------- 2. the settings ---------------- */
{
  const keys = (/history_keys text\[\] := array\[([\s\S]*?)\];/.exec(mig) || [, ''])[1].match(/'([a-zA-Z]+)'/g).map((k) => k.slice(1, -1));
  const logs = ['dayLog', 'buyHolds', 'buyOrders', 'stockCounts', 'debtChases', 'chaseLog', 'msgUseLog', 'waPins', 'waSnooze', 'waNotes', 'analysisMarks'];
  t.check(logs.every((k) => keys.includes(k)), 'the running records kept in the settings stay behind');
  t.check(logs.every((k) => new RegExp(`${k}:d\\.preset`).test(src)), 'and each is still a key the console saves');
  t.check(!keys.some((k) => ['categories', 'units', 'defaultMarkup', 'creditHold', 'priceReview', 'shopLegalName'].includes(k)), 'while categories, units, markups, policies and the letterhead come across');
}

/* ---------------- 3. the runbook ---------------- */
{
  const at = (s) => doc.indexOf(s);
  const steps = ["npm run backup", "select * from ow_fresh_start('<old shop id>', 'Mukasa Hardware');",
    "select * from ow_fresh_start('<old shop id>', 'Mukasa Hardware', true);", "select * from ow_fresh_start_move('<old shop id>', '<new shop id>');",
    "select * from ow_fresh_start_move('<old shop id>', '<new shop id>', true);"];
  t.check(steps.every((s) => at(s) >= 0) && steps.every((s, i) => !i || at(s) > at(steps[i - 1])), 'the runbook gives every step to paste, in order: back up, look, do, look, move');
  t.check(/The old shop is never deleted/.test(doc) && /delete from shops where id = '<new shop id>';/.test(doc), 'and says the old shop is never deleted, and how to undo a copy before the move');
  t.check(/^\| 0148 \| A fresh start/m.test(rights) && /docs\/fresh-start\.md/.test(rights), 'the decision-rights table holds 0148 and points at the runbook');
}

/* ---------------- 5. the Manager confirms each old balance (manager.html) ---------------- */
let managerDone = Promise.resolve();
function managerPage(rpcs, tasks){
  const html = read('manager.html');
  const app = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]).find((x) => x.includes('function holderOf'));
  const el = () => ({ innerHTML: '', textContent: '', value: '', children: [], style: {}, dataset: {}, classList: { add() {}, remove() {}, toggle() {} }, setAttribute() {}, querySelector: () => null, querySelectorAll: () => [], appendChild() {}, remove() {}, focus() {} });
  const store = {};
  const db = { auth: { getUser: () => new Promise(() => {}), getSession: async () => ({ data: { session: null } }) },
    from: () => ({ select() { return this; }, eq() { return this; }, maybeSingle() { return this; }, then: (res) => res({ data: null, error: null }) }),
    rpc: async (fn, args) => { rpcs.push([fn, args]); return fn === 'set_opening_balance' ? { data: { id: args.p_customer_id, debt: args.p_amount, logId: 77 }, error: null } : { data: null, error: { message: 'no rpc ' + fn } }; } };
  const box = {
    console, setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, requestAnimationFrame: () => 0, Promise, Date, Math, JSON, URLSearchParams, encodeURIComponent, isFinite, isNaN,
    location: { hostname: 'localhost', hash: '', reload() {} },
    localStorage: { getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } },
    sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    navigator: {}, matchMedia: () => ({ matches: true }),
    document: { getElementById: el, querySelector: () => null, querySelectorAll: () => [], addEventListener() {}, createElement: el, body: { appendChild() {}, style: {} }, documentElement: { classList: { toggle() {} } }, visibilityState: 'visible', activeElement: null },
    supabase: { createClient: () => db },
  };
  box.window = box; box.window.open = () => {}; box.window.addEventListener = () => {};
  vm.createContext(box);
  vm.runInContext(app.replace(/\nboot\(\);\s*$/, '\n') + '\n;globalThis.__x = { S, ACT, PAGE, D, oldBooks, oldBooksCard };', box);
  box.render = () => {};
  const X = box.__x;
  const cust = (id, name, debt, log) => ({ id, name, phone: '', phone2: '', location: '', notes: '', debt, termsDays: null, creditLimit: null, debtLog: log || [] });
  Object.assign(X.S, { shopId: 'shop-new', user: { id: 'u1' }, role: 'manager', started: true, tasks, stack: [],
    data: { customers: [cust('C001', 'Kato Construction', 0), cust('C002', 'Sarah Namono', 0), cust('C003', 'Opio Traders', 50000, [{ id: 5, date: '2026-10-21', type: 'charge', amount: 50000, note: 'Auto-sync — INV-0001' }])],
      savedQuotes: [], staff: [], promises: [], statementsSent: [], products: [], prices: [], cashTxns: [], suppliers: [],
      freshStart: { oldDebts: { C001: 2410000, C002: 350000, C003: 90000, C999: 10 }, confirmed: {}, madeAt: '2026-10-21' } } });
  return X;
}
{
  const rpcs = [], X = managerPage(rpcs, ['debt.open']);
  const ob = X.oldBooks();
  t.check(ob.rows.length === 3 && ob.left.length === 3 && ob.leftOld === 2410000 + 350000 + 90000, 'the checklist is the old books\' debtors still in the shop (a customer since removed is left out)');
  t.check(/0\/3/.test(X.oldBooksCard()) && /data-p="oldbooks"/.test(X.oldBooksCard()), 'To collect shows how many are confirmed, and opens the checklist');
  const list = X.PAGE.oldbooks();
  t.check(list.indexOf('Kato Construction') < list.indexOf('Sarah Namono') && (list.match(/>to confirm<\/span><\/button>/g) || []).length === 3, 'the checklist puts the biggest old debts first, each marked to confirm');
  const args = { id: 'C001' };
  X.S.stack = [{ type: 'opening', args }];
  const one = X.PAGE.opening(args);
  t.check(args.amt === 2410000 && /Old books/.test(one) && /They agree/.test(one) && /Save · owes 2,410,000/.test(one), 'one customer: the old figure beside the one being entered, starting from the old figure');
  X.ACT['in:obamt']({ value: '2,100,000x', style: {} });
  X.ACT['in:obsince']({ value: '2026-09-01' });
  managerDone = (async () => {
    await X.ACT.obsave({ dataset: { id: 'C001' } });
    const call = rpcs.find((r) => r[0] === 'set_opening_balance');
    t.check(call && call[1].p_shop_id === 'shop-new' && call[1].p_customer_id === 'C001' && call[1].p_amount === 2100000 && call[1].p_since === '2026-09-01',
      'saving sends the agreed figure and its date to set_opening_balance, one write');
    const c = X.D().customers[0];
    t.check(c.debt === 2100000 && c.debtLog.length === 1 && c.debtLog[0].note === 'Opening balance' && X.D().freshStart.confirmed.C001.amount === 2100000 && X.oldBooks().done === 1,
      'and the phone shows them owing it, one opening line, and ticked off the checklist');
    const a2 = { id: 'C002' }; X.S.stack = [{ type: 'opening', args: a2 }]; X.PAGE.opening(a2); X.ACT.obnone();
    await X.ACT.obsave({ dataset: { id: 'C002' } });
    t.check(rpcs.filter((r) => r[0] === 'set_opening_balance').pop()[1].p_amount === 0 && rpcs.filter((r) => r[0] === 'set_opening_balance').pop()[1].p_since === null, '"owes nothing" saves 0, with no date');
    const traded = X.PAGE.opening({ id: 'C003' });
    t.check(/Already trading in these books/.test(traded) && !/data-act="obsave"/.test(traded), 'a customer who has traded here cannot be given one');
    const off = managerPage([], []);
    const offOne = off.PAGE.opening({ id: 'C001' });
    t.check(!/data-act="obsave"/.test(offOne) && /debt\.open/.test(offOne), 'a login without debt.open sees it, locked and named');
    t.check(managerPage([], ['debt.open']).PAGE.opening && !/oldbooks/.test((() => { const Y = managerPage([], ['debt.open']); Y.D().freshStart = null; return Y.oldBooksCard(); })()), 'a shop that never started afresh shows no checklist');
  })().catch((e) => { t.fail('the Manager\'s opening balance: ' + e.message); });
}

/* ---------------- 6. the staging rehearsal never touches the live shop ---------------- */
{
  const { spawnSync } = require('child_process');
  const path = require('path');
  const env = { ...process.env, STAGING_PROJECT_REF: 'hgywjaifdmgrcnwxstxg', SUPABASE_ACCESS_TOKEN: 'x', OW_PG: '' };
  const r = spawnSync(process.execPath, [path.join(__dirname, '..', 'tools', 'staging-rehearsal.js')], { env, encoding: 'utf8' });
  t.check(r.status === 1 && /LIVE project/.test(r.stderr), 'the staging rehearsal refuses the live project by name, before any request');
  const wf = read('.github/workflows/staging.yml');
  t.check(/options: \[both, schema, functions, rehearse\]/.test(wf) && /if: \$\{\{ inputs\.what == 'rehearse' \}\}\n\s+env:\n\s+OWNER_EMAIL: \$\{\{ inputs\.owner_email \}\}\n\s+run: node tools\/staging-rehearsal\.js/.test(wf)
    && wf.indexOf('Refuse to touch the live project') < wf.indexOf('Practise a fresh start'), 'the Set up staging button can practise it, after its own guard on the live project');
}

/* ---------------- 4. a shared photo is never removed from the other shop ---------------- */
{
  const removed = [];
  const env = {
    PRODUCT_IMAGE_URL_PREFIX: 'https://x.supabase.co/storage/v1/object/public/product-images/',
    PRODUCT_IMAGE_BUCKET: 'product-images', currentShopId: 'new-shop', console,
    sb: { storage: { from: () => ({ remove: async (paths) => { removed.push(...paths); return { error: null }; } }) } },
  };
  const api = compileScope([extractFunction(src, 'productImageStoragePath', 'index.html'), extractFunction(src, 'deleteProductImageIfStored', 'index.html')],
    env, ['deleteProductImageIfStored']);
  (async () => {
    await managerDone;
    await api.deleteProductImageIfStored(env.PRODUCT_IMAGE_URL_PREFIX + 'new-shop/a.jpg');
    await api.deleteProductImageIfStored(env.PRODUCT_IMAGE_URL_PREFIX + 'old-shop/b.jpg');
    await api.deleteProductImageIfStored('data:image/png;base64,xx');
    t.check(removed.join() === 'new-shop/a.jpg', 'a photo in this shop\'s folder is removed; one shared from the old shop\'s folder is not');
    process.exit(t.done() ? 1 : 0);
  })().catch((e) => { console.error(e); process.exit(1); });
}
