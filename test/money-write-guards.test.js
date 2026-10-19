#!/usr/bin/env node
'use strict';
/*
 * The money and sign-in writes that used to be a read followed by a
 * write, run as REAL handlers against an in-memory database, with the
 * concurrent cases forced: every request finishes its reads before any
 * of them is allowed to write (a barrier, not a lucky interleaving).
 *
 * Each check here failed on b5513c2 and passes now. The full write-up,
 * with the same cases against real Postgres + PostgREST and migration
 * 0109, is docs/verification/2026-10-09 (after-fix.js asserts them all).
 * What only the database can hold -- a row lock, a transaction, a unique
 * index -- is that script's job; this file pins what the functions and
 * the app do around it.
 *
 * Run: node test/money-write-guards.test.js   (or: npm test)
 */
const fs = require('fs');
const path = require('path');
const { stripTypeScriptTypes } = require('module');
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');
const { FakeDB, barrier } = require('./_fake-supabase');

const t = createReporter('money write guards');
const ROOT = path.join(__dirname, '..');

function loadHandler(name, { createClient, fetch }) {
  let src = fs.readFileSync(path.join(ROOT, 'supabase/functions', name, 'index.ts'), 'utf8');
  src = src.replace(/^import[^\n]*\n/gm, '').replace(/^export /gm, '');
  const js = stripTypeScriptTypes(src, { mode: 'strip' });
  let handler = null;
  const scope = {};
  const Deno = { env: { get: (k) => ({ SUPABASE_URL: 'https://p.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'SERVICE', SUPABASE_ANON_KEY: 'ANON' }[k]) }, serve: (h) => { handler = h; } };
  const quiet = { log() {}, error() {}, warn() {} };
  new Function('Deno', 'createClient', 'crypto', 'console', 'fetch', '__scope',
    js + '\n;try { __scope.hashPin = hashPin; } catch (e) {} try { __scope.sha256Hex = sha256Hex; } catch (e) {}')(
    Deno, createClient, globalThis.crypto, quiet, fetch || (async () => { throw new Error('no network in tests'); }), scope);
  if (!handler) throw new Error(`Deno.serve was never called in ${name}`);
  return { handler, scope };
}
async function call(handler, body, headers = {}) {
  const res = await handler(new Request('http://x/', { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) }));
  return { status: res.status, body: await res.json() };
}
const clientFor = (db) => (_u, key) => db.client(key === 'ANON' ? 'caller' : 'admin');
const AUTH = { Authorization: 'Bearer agent' };

(async () => {
  /* ---------- BUG-2 / BUG-9: the PIN ---------------------------------- */
  {
    const world = async () => {
      const db = new FakeDB({ identity: { client_sessions: 'id' }, unique: { client_sessions: [['token_hash']] } });
      const { handler, scope } = loadHandler('client-portal', { createClient: () => db.client('admin') });
      db.seed('customers', [{ shop_id: 'S', id: 'C1', name: 'Cust', phone: '0772000001' }]);
      db.seed('client_accounts', [{ shop_id: 'S', customer_id: 'C1', phone: '772000001', status: 'active',
        pin_hash: await scope.hashPin('4821', 'S', 'C1'), pin_expires_at: new Date(Date.now() + 300e3).toISOString(), pin_attempts: 0 }]);
      return {
        db, verify: (pin, dev = 'd') => call(handler, { shopId: 'S', action: 'verify', phone: '0772000001', pin, deviceId: dev }),
        acct: () => db.rows('client_accounts')[0], sessions: () => db.rows('client_sessions').length,
      };
    };
    const checked = (rs) => rs.filter((r) => r.status === 200 || (r.status === 401 && /not right/.test(r.body.error))).length;
    const holdUpdates = (db, n) => { const g = barrier(n); let k = 0; return db.hook(async (op) => { if (op.kind === 'update' && op.table === 'client_accounts' && k < n) { k++; await g.arrive(); } }); };

    let w = await world();
    holdUpdates(w.db, 8);
    let rs = await Promise.all(['0000', '0001', '0002', '0003', '0004', '0005', '0006', '0007'].map((p) => w.verify(p)));
    t.check(checked(rs) === 3 && w.acct().pin_attempts === 3,
      `eight wrong guesses at once: three are checked and three are counted (checked ${checked(rs)}, counted ${w.acct().pin_attempts})`);

    w = await world();
    holdUpdates(w.db, 8);
    rs = await Promise.all(['0000', '0001', '0002', '0003', '0004', '0005', '0006', '4821'].map((p) => w.verify(p)));
    t.check(checked(rs) <= 3 && w.sessions() === 0,
      `the right PIN as the eighth guess at once gets no fourth try (checked ${checked(rs)}, sessions ${w.sessions()})`);

    w = await world();
    { const g = barrier(2); let k = 0; w.db.hook(async (op) => { if (op.kind === 'insert' && op.table === 'client_sessions' && k < 2) { k++; await g.arrive(); } }); }
    rs = await Promise.all([w.verify('4821', 'a'), w.verify('4821', 'b')]);
    t.check(rs.filter((r) => r.status === 200).length === 1 && w.sessions() === 1,
      `the right PIN sent twice at once signs in once (${rs.map((r) => r.status)}, sessions ${w.sessions()})`);

    w = await world();
    let off = w.db.hook(async (op) => { if (op.kind === 'insert' && op.table === 'client_sessions') return { error: { message: 'down' } }; });
    let r = await w.verify('4821'); off();
    t.check(r.status === 503 && !r.body.token && !!w.acct().pin_hash && w.acct().pin_attempts === 0,
      'a session that could not be saved is not a sign-in: no token, the PIN still live, the try handed back');
    r = await w.verify('4821');
    t.check(r.status === 200 && !!r.body.token && w.sessions() === 1, 'and the same PIN then works');

    w = await world();
    off = w.db.hook(async (op) => { if (op.kind === 'update' && op.table === 'client_accounts' && op.values && op.values.pin_hash === null) return { error: { message: 'down' } }; });
    r = await w.verify('4821'); off();
    t.check(r.status === 503 && !r.body.token && w.sessions() === 0,
      'a PIN that could not be spent signs nobody in, and the session written for it is removed');
  }

  /* ---------- BUG-1: credit refuses without its transaction ----------- */
  {
    const db = new FakeDB({ rpcs: { current_agent_id: () => 'A1' } });
    const it = { productId: 'p1', qty: 1, sellPrice: 100 };
    db.seed('saved_quotes', [
      { id: 1, shop_id: 'S', agent_id: 'A1', status: 'completed', voided: false, amount_paid: 0, payload: { originAgentId: 'A1', items: [it], agentCredit: { amount: 100, at: 'a', used: [] } } },
      { id: 2, shop_id: 'S', agent_id: 'A1', status: 'draft', voided: false, amount_paid: 0, payload: { originAgentId: 'A1', items: [it] } }]);
    const { handler } = loadHandler('agent-change-order', { createClient: clientFor(db) });
    let r = await call(handler, { shopId: 'S', orderId: 2, action: 'useCredit' }, AUTH);
    t.check(r.status === 503 && db.log.every((op) => op.kind !== 'update'),
      'without use_agent_credit (0109) credit is refused, never spent the old two-write way');
    // A plan the database finds stale is re-read and re-planned, then applied.
    let calls = 0;
    db.rpcs.use_agent_credit = (args) => (++calls === 1 ? { ok: false, reason: 'changed' } : { ok: true, credited: args.p_plan[0].amount, owed: 0, paid: true });
    r = await call(handler, { shopId: 'S', orderId: 2, action: 'useCredit' }, AUTH);
    t.check(r.status === 200 && r.body.credited === 100 && calls === 2, `a stale plan is made again from a fresh read (${calls} calls)`);
  }

  /* ---------- BUG-5 / BUG-6 / BUG-8: mobile money --------------------- */
  const momo = (orderExtra = {}, rpcs = {}) => {
    const db = new FakeDB({
      identity: { agent_mobile_payments: 'id', cash_txns: 'id' },
      unique: { agent_mobile_payments: [['external_reference'], { cols: ['order_id'], where: (row) => row.status === 'pending' }] },
      rpcs: Object.assign({ current_agent_id: () => 'A1', is_shop_admin: () => false }, rpcs),
    });
    db.seed('shop_payment_providers', [{ shop_id: 'S', provider: 'mtn', enabled: true, environment: 'sandbox', credentials: {} }]);
    db.seed('saved_quotes', [Object.assign({ id: 10, shop_id: 'S', agent_id: 'A1', status: 'draft', voided: false, amount_paid: 0,
      payload: { originAgentId: 'A1', items: [{ productId: 'p1', qty: 1, sellPrice: 100, supplierId: '__stock__' }] } }, orderExtra)]);
    const pushes = [];
    const fetch = async (url, init = {}) => {
      const u = String(url);
      if (u.endsWith('/collection/token/')) return new Response(JSON.stringify({ access_token: 'T' }));
      if (u.endsWith('/collection/v1_0/requesttopay')) { pushes.push(1); return new Response('', { status: 202 }); }
      return new Response(JSON.stringify({ status: 'SUCCESSFUL' }));
    };
    const init = loadHandler('agent-initiate-momo-payment', { createClient: clientFor(db), fetch }).handler;
    const check = loadHandler('check-momo-payment-status', { createClient: clientFor(db), fetch }).handler;
    return { db, pushes,
      initiate: () => call(init, { shopId: 'S', orderId: 10, provider: 'mtn', phone: '0772123456' }, AUTH),
      recheck: (id) => call(check, { shopId: 'S', paymentId: id }, AUTH) };
  };
  {
    const w = momo();
    const g = barrier(2); let k = 0;
    w.db.hook(async (op) => { if (op.kind === 'insert' && op.table === 'agent_mobile_payments' && k < 2) { k++; await g.arrive(); } });
    const rs = await Promise.all([w.initiate(), w.initiate()]);
    t.check(w.pushes.length === 1 && rs.every((r) => r.status === 200) && rs[0].body.paymentId === rs[1].body.paymentId,
      `two initiations at once push the phone once and both get that request (${rs.map((r) => r.status + ':' + r.body.paymentId)}, ${w.pushes.length} push)`);
  }
  {
    const w = momo();
    w.db.seed('agent_mobile_payments', [{ id: 50, shop_id: 'S', agent_id: 'A1', order_id: 10, provider: 'mtn', amount: 100, external_reference: 'old',
      status: 'pending', created_at: new Date(Date.now() - 10 * 60e3).toISOString() }]);
    const r = await w.initiate();
    const old = w.db.rows('agent_mobile_payments').find((p) => p.id === 50);
    t.check(r.status === 200 && r.body.paymentId !== 50 && old.status === 'timeout' && w.pushes.length === 1,
      'a request older than the reuse window is set aside as timeout (still resolvable) and a new one raised');
  }
  {
    const w = momo({ voided: true });
    const r = await w.initiate();
    t.check(r.status === 409 && w.pushes.length === 0 && w.db.rows('agent_mobile_payments').length === 0,
      'an order the shop voided is refused before anything is written or sent');
  }
  {
    const w = momo();
    w.db.hook(async (op) => { if (op.kind === 'insert' && op.table === 'agent_mobile_payments') w.db.tables.saved_quotes[0].voided = true; });
    const r = await w.initiate();
    t.check(r.status === 409 && w.pushes.length === 0 && w.db.rows('agent_mobile_payments')[0].status === 'cancelled',
      'a cancellation landing while the request is reserved stops the push');
  }
  {
    // The database (0109's apply_momo_payment) fails the first apply and
    // succeeds after; the function must come back for it.
    let fail = true, applied = 0, pid = null;
    const w = momo({ status: 'preparing' }, {
      apply_momo_payment: () => { applied++; w.db.tables.agent_mobile_payments.find((x) => x.id === pid).applied_at = 'now'; return { applied: true }; },
    });
    pid = (await w.initiate()).body.paymentId;
    w.db.tables.agent_mobile_payments.forEach((x) => { x.applied_at = null; });
    w.db.hook(async (op) => { if (op.kind === 'rpc' && op.name === 'apply_momo_payment' && fail) return { error: { code: 'P0001', message: 'injected' } }; });
    const r1 = await w.recheck(pid);
    fail = false;
    const r2 = await w.recheck(pid);
    const r3 = await w.recheck(pid);
    t.check(/tried again/.test(r1.body.warning || '') && r2.body.status === 'successful' && !r2.body.warning && applied === 1,
      `a confirmed payment whose apply failed is applied on the next check (${applied} apply)`);
    t.check(r3.body.status === 'successful' && !r3.body.warning && applied === 1, 'and one already applied is left alone');
  }

  /* ---------- BUG-7 / BUG-10: customer prices ------------------------- */
  {
    const world = async (history = []) => {
      const db = new FakeDB({ identity: { saved_quotes: 'id' } });
      const submit = loadHandler('client-submit-order', { createClient: () => db.client('admin') });
      const portal = loadHandler('client-portal', { createClient: () => db.client('admin') });
      db.seed('customers', [{ shop_id: 'S', id: 'C1', name: 'Cust', phone: '0772000001' }]);
      db.seed('client_accounts', [{ shop_id: 'S', customer_id: 'C1', phone: '772000001', status: 'active', pin_attempts: 0 }]);
      db.seed('client_sessions', [{ shop_id: 'S', customer_id: 'C1', token_hash: await submit.scope.sha256Hex('TOK'), expires_at: new Date(Date.now() + 3600e3).toISOString(), revoked_at: null }]);
      db.seed('app_settings', [{ shop_id: 'S', presets: { defaultMarkup: { retailType: 'percent', retailValue: 50 } } }]);
      db.seed('products', [{ shop_id: 'S', id: 'P1', name: 'Widget', variants: [] }]);
      db.seed('prices', [{ shop_id: 'S', product_id: 'P1', variant_idx: null, supplier_id: 'SUP', wholesale: null, retail: 100, pack_qty: 0, unit: 'pc', tiers: [], out_of_stock: false }]);
      db.seed('stock', [{ shop_id: 'S', key: 'P1', qty: 5 }]);
      db.seed('saved_quotes', history);
      const failRead = (table, cols) => db.hook(async (op) => { if (op.kind === 'select' && op.table === table && (!cols || op.cols === cols)) return { error: { message: 'down' } }; });
      return { db, failRead,
        order: () => call(submit.handler, { shopId: 'S', token: 'TOK', items: [{ productId: 'P1', qty: 1 }] }),
        price: () => call(portal.handler, { shopId: 'S', action: 'price', token: 'TOK', productId: 'P1', qty: 1 }),
        stored: () => db.rows('saved_quotes').filter((q) => q.payload && q.payload.originPortal).length };
    };
    let w = await world();
    w.failRead('app_settings');
    let r = await w.order(), p = await w.price();
    t.check(r.status === 503 && w.stored() === 0, 'an order whose markup could not be read is refused, not stored at cost');
    t.check(p.status === 503 && p.body.unitPrice === undefined, 'and the portal shows no price, rather than the supplier\'s cost');
    w = await world();
    w.failRead('saved_quotes', 'client_phone, date, voided, payload');
    r = await w.order();
    t.check(r.status === 503 && w.stored() === 0, 'an order whose price history could not be read is refused, not charged above the figure shown');

    w = await world([
      { id: 6, shop_id: 'S', client_phone: '0772000001', date: '2026-10-08', voided: false, payload: { items: [{ productId: 'P1', variantIdx: null, sellPrice: 100 }] } },
      { id: 7, shop_id: 'S', client_phone: '0772000001', date: '2026-10-08', voided: false, payload: { items: [{ productId: 'P1', variantIdx: null, sellPrice: 150 }] } },
    ]);
    p = await w.price(); r = await w.order();
    t.check(p.body.unitPrice === 150 && r.body.lines && r.body.lines[0].unitPrice === 150,
      `the newest of two same-day prices is shown and charged (shown ${p.body.unitPrice}, charged ${r.body.lines && r.body.lines[0].unitPrice})`);
  }

  /* ---------- BUG-3 / BUG-4: the app's own reads and writes ----------- */
  {
    const src = read('index.html');
    const env = (db, extra) => Object.assign({ sb: db.client('browser'), cloneJSON: (x) => JSON.parse(JSON.stringify(x)), console: { error() {} } }, extra);
    const lotsScope = (db, lastSynced) => compileScope(['addStockLotsDiffOps', 'dbFunctionMissing'].map((n) => extractFunction(src, n, 'index.html')),
      env(db, { lastSynced, syncAbsentCollections: null, stockLotConsignColumn: true }), ['addStockLotsDiffOps']);

    let db = new FakeDB({ rpcs: { replace_stock_lots: () => null } });
    db.hook(async (op) => { if (op.kind === 'rpc') return { error: { code: 'P0001', message: 'insert failed' } }; });
    db.seed('stock_lots', [{ shop_id: 'S', key: 'P', qty: 10, cost: 100 }]);
    let s = lotsScope(db, { stockLots: { P: [{ qty: 10, cost: 100 }] } });
    let ops = []; s.addStockLotsDiffOps(ops, 'S', { P: [{ qty: 9, cost: 100 }] });
    let r = await ops[0].run();
    t.check(!!r.error && db.log.every((op) => op.kind !== 'delete') && db.rows('stock_lots').length === 1,
      'a lot rewrite that fails deletes nothing: it is one call, not a delete then an insert');

    db = new FakeDB();
    db.seed('stock_lots', [{ shop_id: 'S', key: 'P', qty: 10, cost: 100 }]);
    s = lotsScope(db, { stockLots: { P: [{ qty: 10, cost: 100 }] } });
    ops = []; s.addStockLotsDiffOps(ops, 'S', { P: [{ qty: 9, cost: 100 }] });
    r = await ops[0].run();
    t.check(!r.error && JSON.stringify(db.rows('stock_lots').map((l) => l.qty)) === '[9]',
      'a shop without 0109 keeps the old path');

    const reader = (maxRows) => {
      const d = new FakeDB({ maxRows });
      d.seed('cash_txns', Array.from({ length: 2345 }, (_, i) => ({ id: 5000 - i, shop_id: 'S', amount: 1 })));
      d.seed('stock', Array.from({ length: 1500 }, (_, i) => ({ shop_id: 'S', key: 'K' + i, qty: 1 })));
      return compileScope([extractDeclaration(src, 'LOAD_PAGE_ROWS', 'index.html'), extractDeclaration(src, 'LOAD_KEY_COLUMN', 'index.html'),
        extractFunction(src, 'selectAllRows', 'index.html')], { sb: d.client('browser') }, ['selectAllRows']);
    };
    for (const cap of [1000, 300]) {
      const rd = reader(cap);
      const cash = await rd.selectAllRows('cash_txns', 'S');
      const stock = await rd.selectAllRows('stock', 'S');
      t.check(!cash.error && cash.data.length === 2345 && new Set(cash.data.map((x) => x.id)).size === 2345 && stock.data.length === 1500,
        `every row is read past a server limit of ${cap} (cash ${cash.data && cash.data.length}/2345, stock ${stock.data && stock.data.length}/1500)`);
    }
    t.check(/const sel = \(table\) => selectAllRows\(table, shopId\);/.test(extractFunction(src, 'loadData', 'index.html')),
      'and the loader reads every table through it');

    // The commission claim reads its month, all of it.
    const cdb = new FakeDB({ maxRows: 1000, identity: { agent_commission_claims: 'id' }, rpcs: { current_agent_id: () => 'A1' } });
    cdb.seed('saved_quotes', Array.from({ length: 1000 }, (_, i) => ({ id: i + 1, shop_id: 'S', agent_id: 'A1', status: 'completed', voided: false, date: '2026-07-15', payload: { items: [{ bonusCommission: 1 }] } }))
      .concat(Array.from({ length: 5 }, (_, i) => ({ id: 2000 + i, shop_id: 'S', agent_id: 'A1', status: 'completed', voided: false, date: '2026-08-20', payload: { items: [{ bonusCommission: 100 }] } }))));
    const claim = await call(loadHandler('agent-claim-commission', { createClient: clientFor(cdb) }).handler, { shopId: 'S', month: '2026-08' }, AUTH);
    t.check(claim.status === 200 && Number(claim.body.claim && claim.body.claim.bonus_amount) === 500,
      `a month's claim counts that month's orders however many older ones there are (${claim.status} ${claim.body.claim ? claim.body.claim.bonus_amount : claim.body.error})`);
  }

  process.exit(t.done() ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
