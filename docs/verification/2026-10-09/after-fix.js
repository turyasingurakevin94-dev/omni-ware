'use strict';
/*
 * The same scenarios as the probes, run against the FIXED code and 0109 on
 * real Postgres + PostgREST (setup-realdb.sh, then apply 0109 if the
 * database predates it). Unlike the probes, this ASSERTS the invariant of
 * each finding and exits 1 if any is broken.
 *
 *   bash docs/verification/2026-10-09/setup-realdb.sh
 *   node docs/verification/2026-10-09/after-fix.js
 */
const { RealDB, sql, sqlJSON, SHOP, resetShop } = require('./realdb');
const { loadHandler, call } = require('./loadfn');
const { barrier } = require('./fakedb');
const { closure, SRC } = require('./extract');
const { extractDeclaration } = require('../../../test/_extract');

let failures = 0;
const check = (ok, msg, detail) => {
  console.log(`${ok ? 'ok    ' : 'NOT OK'} - ${msg}${detail ? `  [${detail}]` : ''}`);
  if (!ok) failures++;
};
const H = { Authorization: 'Bearer agent-jwt' };
const q = (s) => s.replace(/'/g, "''");
const factory = (db) => (_u, key) => db.client(key === 'ANON' ? 'caller' : 'admin');
const count = (where) => Number(sql(`select count(*) from ${where}`));
function seedAgent(id = 'AG9001') { sql(`insert into agents(shop_id, id, name) values ('${SHOP}', '${id}', 'Agent One');`); return id; }
function seedOrder(id, payload, extra = {}) {
  const cols = { id, shop_id: SHOP, status: 'draft', voided: false, amount_paid: 0, date: '2026-10-01', ...extra };
  const names = Object.keys(cols).concat('payload');
  const vals = Object.values(cols).map((v) => (typeof v === 'string' ? `'${q(v)}'` : v)).concat(`'${q(JSON.stringify(payload))}'::jsonb`);
  sql(`insert into saved_quotes(${names.join(',')}) values (${vals.join(',')});`);
}
// A failure INSIDE a database transaction, switched on by the existence of a table.
function armFailure(table, cond) {
  sql(`create or replace function verify_fail() returns trigger language plpgsql as $$
         begin if to_regclass('public.verify_fail_now') is not null and (${cond}) then raise exception 'injected failure'; end if; return new; end $$;
       drop trigger if exists verify_fail on ${table};
       create trigger verify_fail before insert or update on ${table} for each row execute function verify_fail();
       create table if not exists verify_fail_now(x int);`);
}
function disarm(table) { sql(`drop table if exists verify_fail_now; drop trigger if exists verify_fail on ${table};`); }

(async () => {
  // ---------------- BUG-1 ----------------
  {
    resetShop(); const A = seedAgent();
    const it = { productId: 'p1', variantIdx: null, qty: 1, sellPrice: 100 };
    seedOrder(9101, { originAgentId: A, note: 'source', items: [it], agentCredit: { amount: 100, at: '2026-10-01', used: [] } }, { status: 'completed' });
    seedOrder(9102, { originAgentId: A, items: [it] });
    seedOrder(9103, { originAgentId: A, items: [it] });
    const db = new RealDB({ rpcs: { current_agent_id: () => A } });
    const { handler } = loadHandler('agent-change-order', { createClient: factory(db) });
    // Both requests have read the credit and planned before either reaches the database's write.
    const gate = barrier(2); let n = 0;
    db.hook(async (op) => { if (op.table === 'rpc/use_agent_credit' && n < 2) { n++; await gate.arrive(); } });
    const rs = await Promise.all([9102, 9103].map((orderId) => call(handler, { shopId: SHOP, orderId, action: 'useCredit' }, H)));
    const used = sqlJSON(`select coalesce(sum((u->>'amount')::numeric), 0) as s from saved_quotes, jsonb_array_elements(payload->'agentCredit'->'used') u where id = 9101`)[0].s;
    const paid = Number(sql(`select sum(amount_paid) from saved_quotes where id in (9102, 9103)`));
    check(paid <= 100 && Number(used) === paid, 'BUG-1 concurrent useCredit: credited never exceeds the credit, and every credit has its debit',
      `responses ${rs.map((r) => r.status + ':' + (r.body.credited || r.body.error)).join(' | ')}; paid ${paid}; debited ${used}`);
    check(sql(`select payload->>'note' from saved_quotes where id = 9101`) === 'source', 'BUG-1 the source order keeps its other fields');
  }
  // ---------------- BUG-2 / BUG-9 ----------------
  {
    resetShop();
    sql(`insert into customers(shop_id, id, name, phone) values ('${SHOP}', 'C1', 'Cust', '0772000001');`);
    const db = new RealDB();
    const { handler, ctx } = loadHandler('client-portal', { createClient: factory(db) });
    const setPin = async () => sql(`delete from client_sessions where shop_id='${SHOP}'; delete from client_accounts where shop_id='${SHOP}';
      insert into client_accounts(shop_id, customer_id, phone, pin_hash, pin_expires_at, pin_attempts) values
      ('${SHOP}', 'C1', '772000001', '${await ctx.hashPin('4821', SHOP, 'C1')}', now() + interval '5 minutes', 0);`);
    const verify = (pin, dev = 'd1') => call(handler, { shopId: SHOP, action: 'verify', phone: '0772000001', pin, deviceId: dev });
    const attempts = () => Number(sql(`select pin_attempts from client_accounts where shop_id='${SHOP}'`));
    const sessions = () => count(`client_sessions where shop_id='${SHOP}'`);
    const evaluated = (rs) => rs.filter((r) => r.status === 200 || (r.status === 401 && /not right/.test(r.body.error))).length;

    for (const [label, guesses] of [['8 wrong', ['0000', '0001', '0002', '0003', '0004', '0005', '0006', '0007']],
                                    ['7 wrong + the right one last', ['0000', '0001', '0002', '0003', '0004', '0005', '0006', '4821']]]) {
      await setPin();
      const gate = barrier(8); let n = 0;
      const off = db.hook(async (op) => { if (op.kind === 'update' && op.table === 'client_accounts' && n < 8) { n++; await gate.arrive(); } });
      const rs = await Promise.all(guesses.map((p) => verify(p)));
      off();
      check(evaluated(rs) <= 3, `BUG-2 ${label}, all reads before any write: at most three guesses are checked`,
        `statuses ${rs.map((r) => r.status).join(',')}; checked ${evaluated(rs)}; pin_attempts ${attempts()}; sessions ${sessions()}`);
    }
    {
      await setPin();
      const gate = barrier(2); let n = 0;
      const off = db.hook(async (op) => { if (op.kind === 'insert' && op.table === 'client_sessions' && n < 2) { n++; await gate.arrive(); } });
      const rs = await Promise.all([verify('4821', 'dA'), verify('4821', 'dB')]);
      off();
      check(rs.filter((r) => r.status === 200).length === 1 && sessions() === 1,
        'BUG-2 the right PIN sent twice at once: one sign-in, one session', `statuses ${rs.map((r) => r.status).join(',')}; sessions ${sessions()}`);
    }
    {
      await setPin();
      const off = db.hook(async (op) => { if (op.kind === 'insert' && op.table === 'client_sessions') return { error: { message: 'injected session insert failure' } }; });
      const r = await verify('4821'); off();
      const live = sql(`select pin_hash is not null from client_accounts where shop_id='${SHOP}'`) === 't';
      check(r.status !== 200 && !r.body.token && live && attempts() === 0,
        'BUG-9 session insert fails: no token, PIN still live, the try handed back', `${r.status} ${JSON.stringify(r.body)}; attempts ${attempts()}`);
      const again = await verify('4821');
      check(again.status === 200 && sessions() === 1, 'BUG-9 and the same PIN then signs in', `${again.status}`);
    }
    {
      await setPin();
      const off = db.hook(async (op) => { if (op.kind === 'update' && op.table === 'client_accounts' && op.body && op.body.pin_hash === null) return { error: { message: 'injected PIN clear failure' } }; });
      const r = await verify('4821'); off();
      check(r.status !== 200 && !r.body.token && sessions() === 0,
        'BUG-9 PIN clear fails: no token, and the session written for it is removed', `${r.status}; sessions ${sessions()}`);
    }
  }
  // ---------------- BUG-5 / BUG-6 / BUG-8 ----------------
  const momoWorld = (orderExtra = {}) => {
    resetShop(); const A = seedAgent();
    sql(`insert into shop_payment_providers(shop_id, provider, environment, enabled, credentials) values ('${SHOP}', 'mtn', 'sandbox', true, '{"subscriptionKey":"k","apiUser":"u","apiKey":"p"}');`);
    seedOrder(9201, { originAgentId: A, items: [{ productId: 'p1', variantIdx: null, qty: 1, sellPrice: 100, price: 80, supplierId: '__stock__' }] }, orderExtra);
    const db = new RealDB({ rpcs: { current_agent_id: () => A, is_shop_admin: () => false } });
    const pushes = [];
    const fetch = async (url, init = {}) => {
      const u = String(url);
      if (u.endsWith('/collection/token/')) return new Response(JSON.stringify({ access_token: 'T' }), { status: 200 });
      if (u.endsWith('/collection/v1_0/requesttopay') && init.method === 'POST') { pushes.push(1); return new Response('', { status: 202 }); }
      if (/requesttopay\/[\w-]+$/.test(u)) return new Response(JSON.stringify({ status: 'SUCCESSFUL' }), { status: 200 });
      throw new Error('unexpected ' + u);
    };
    const init = loadHandler('agent-initiate-momo-payment', { createClient: factory(db), fetch }).handler;
    const check_ = loadHandler('check-momo-payment-status', { createClient: factory(db), fetch }).handler;
    return { db, pushes, initiate: () => call(init, { shopId: SHOP, orderId: 9201, provider: 'mtn', phone: '0772123456' }, H), recheck: (id) => call(check_, { shopId: SHOP, paymentId: id }, H) };
  };
  {
    const w = momoWorld();
    const gate = barrier(2); let n = 0;
    w.db.hook(async (op) => { if (op.kind === 'insert' && op.table === 'agent_mobile_payments' && n < 2) { n++; await gate.arrive(); } });
    const rs = await Promise.all([w.initiate(), w.initiate()]);
    const pending = count(`agent_mobile_payments where shop_id='${SHOP}' and status='pending'`);
    check(pending === 1 && w.pushes.length === 1 && rs.every((r) => r.status === 200) && rs[0].body.paymentId === rs[1].body.paymentId,
      'BUG-6 two initiations at once: one request, one push, both callers handed it', `pending ${pending}; pushes ${w.pushes.length}; ${rs.map((r) => r.status + ':' + r.body.paymentId).join(',')}`);
  }
  {
    const w = momoWorld({ voided: true });
    const r = await w.initiate();
    check(r.status === 409 && count(`agent_mobile_payments where shop_id='${SHOP}'`) === 0 && w.pushes.length === 0,
      'BUG-8 an order the shop voided is refused before anything is written or sent', `${r.status} ${r.body.error}`);
  }
  {
    const w = momoWorld();
    // The shop cancels while the request is being reserved.
    w.db.hook(async (op) => { if (op.kind === 'insert' && op.table === 'agent_mobile_payments') sql(`update saved_quotes set voided = true where id = 9201`); });
    const r = await w.initiate();
    check(r.status === 409 && w.pushes.length === 0 && count(`agent_mobile_payments where shop_id='${SHOP}' and status='pending'`) === 0,
      'BUG-8 a cancellation landing during the reservation stops the push', `${r.status} ${r.body.error}; pushes ${w.pushes.length}`);
  }
  {
    const w = momoWorld({ status: 'preparing' });
    const id = (await w.initiate()).body.paymentId;
    armFailure('saved_quotes', 'new.id = 9201');
    const r1 = await w.recheck(id);
    disarm('saved_quotes');
    const half = count(`cash_txns where shop_id='${SHOP}'`);
    const r2 = await w.recheck(id);
    const r3 = await w.recheck(id);
    const paid = Number(sql(`select amount_paid from saved_quotes where id = 9201`));
    const cash = count(`cash_txns where shop_id='${SHOP}'`);
    check(half === 0, 'BUG-5 a failure inside the apply leaves no half-written receipt', `${JSON.stringify(r1.body)}`);
    check(paid === 100 && cash === 1 && sql(`select applied_at is not null from agent_mobile_payments where id = ${id}`) === 't',
      'BUG-5 the next check applies it -- once', `${JSON.stringify(r2.body)} ${JSON.stringify(r3.body)}; paid ${paid}; cash rows ${cash}`);
  }
  // ---------------- BUG-3 / BUG-4 (index.html) ----------------
  const DECLS = [];
  const compile = (roots, env) => {
    const c = closure(roots, { maxDepth: 6 });
    const keys = Object.keys(env);
    const body = keys.map((k, i) => `var ${k} = __env[${i}];`).join('\n') + '\n' + DECLS.join('\n') + '\n' + c.sources.join('\n') + `\nreturn { ${roots.join(', ')}, __get: (n) => eval(n) };`;
    return new Function('__env', body)(keys.map((k) => env[k]));
  };
  const withDecls = async (fn) => {
    for (let i = 0; i < 30; i++) {
      try { return await fn(); } catch (e) {
        const m = e instanceof ReferenceError && /^(\w+) is not defined/.exec(e.message);
        if (!m) throw e;
        DECLS.unshift(extractDeclaration(SRC['index.html'], m[1], 'index.html'));
      }
    }
  };
  const cloneJSON = (x) => JSON.parse(JSON.stringify(x));
  const load = (db) => withDecls(async () => {
    const s = compile(['loadData'], { sb: db.client('browser'), booksRead: { at: null }, document: { getElementById: () => null } });
    const d = await s.loadData(SHOP);
    return { d, booksRead: s.__get('booksRead') };
  });
  const lotsOp = (db, lastSynced) => compile(['addStockLotsDiffOps'], { sb: db.client('browser'), lastSynced, syncAbsentCollections: null, cloneJSON, stockLotConsignColumn: true, console });
  {
    resetShop();
    sql(`insert into cash_txns(id, shop_id, date, account, type, amount, description)
           select 9000000 + g, '${SHOP}', '2026-10-01', 'cash', 'receipt', 1, 'synthetic' from generate_series(1, 2345) g;
         insert into stock_lots(shop_id, key, qty, cost) select '${SHOP}', 'K' || g, 1, 10 from generate_series(1, 999) g;
         insert into stock_lots(shop_id, key, qty, cost) values ('${SHOP}', 'P', 10, 100), ('${SHOP}', 'P', 5, 120);
         insert into stock(shop_id, key, qty) values ('${SHOP}', 'P', 15);`);
    const db = new RealDB();
    const { d } = await load(db);
    check(d.cashTxns.length === 2345 && (d.stockLots.P || []).length === 2,
      'BUG-4 the loader reads every row past the server limit', `cash ${d.cashTxns.length}/2345; P lots ${(d.stockLots.P || []).length}/2`);
    const s = lotsOp(db, { stockLots: cloneJSON(d.stockLots) });
    const lots = cloneJSON(d.stockLots); lots.P[0].qty -= 1;
    const ops = []; s.addStockLotsDiffOps(ops, SHOP, lots);
    const r = await ops[0].run(); if (!r.error) ops[0].commit();
    const after = sqlJSON(`select qty, cost from stock_lots where shop_id='${SHOP}' and key='P' order by cost`);
    check(!r.error && JSON.stringify(after) === JSON.stringify([{ qty: 9, cost: 100 }, { qty: 5, cost: 120 }]),
      'BUG-4 a following sale keeps the lot the old loader never saw', JSON.stringify(after));
  }
  {
    resetShop();
    sql(`insert into stock_lots(shop_id, key, qty, cost, consign) values ('${SHOP}', 'P', 10, 100, 'SUP1');`);
    const db = new RealDB();
    const { d } = await load(db);
    const lastSynced = { stockLots: cloneJSON(d.stockLots) };
    const s = lotsOp(db, lastSynced);
    const lots = cloneJSON(d.stockLots); lots.P[0].qty = 9;
    armFailure('stock_lots', 'new.qty = 9');
    const ops = []; s.addStockLotsDiffOps(ops, SHOP, lots);
    const r = await ops[0].run(); if (!r.error) ops[0].commit();
    disarm('stock_lots');
    const other = (await load(new RealDB())).d;
    check(!!r.error && JSON.stringify(other.stockLots.P) === JSON.stringify([{ qty: 10, cost: 100, consign: 'SUP1' }]),
      'BUG-3 a failed insert leaves the old lot, as another device reads it', `error ${r.error && r.error.message}; other device ${JSON.stringify(other.stockLots.P)}`);
    const ops2 = []; s.addStockLotsDiffOps(ops2, SHOP, lots);
    const r2 = await ops2[0].run(); if (!r2.error) ops2[0].commit();
    check(!r2.error && JSON.stringify(sqlJSON(`select qty, cost, consign from stock_lots where shop_id='${SHOP}' and key='P'`)) === JSON.stringify([{ qty: 9, cost: 100, consign: 'SUP1' }]),
      'BUG-3 and the retry replaces it');
  }
  {
    resetShop(); const A = seedAgent();
    sql(`insert into saved_quotes(id, shop_id, status, voided, amount_paid, date, payload)
           select 9300000 + g, '${SHOP}', 'completed', false, 0, '2026-07-15', jsonb_build_object('originAgentId', '${A}', 'items', jsonb_build_array(jsonb_build_object('bonusCommission', 1)))
           from generate_series(1, 1000) g;
         insert into saved_quotes(id, shop_id, status, voided, amount_paid, date, payload)
           select 9400000 + g, '${SHOP}', 'completed', false, 0, '2026-08-20', jsonb_build_object('originAgentId', '${A}', 'items', jsonb_build_array(jsonb_build_object('bonusCommission', 100)))
           from generate_series(1, 5) g;`);
    const db = new RealDB({ rpcs: { current_agent_id: () => A } });
    const r = await call(loadHandler('agent-claim-commission', { createClient: factory(db) }).handler, { shopId: SHOP, month: '2026-08' }, H);
    check(r.status === 200 && Number(r.body.claim && r.body.claim.bonus_amount) === 500, 'BUG-4 the August claim counts August\'s orders behind 1,000 older ones', `${r.status} ${JSON.stringify(r.body.claim && r.body.claim.bonus_amount || r.body)}`);
    const month = new Date().toISOString().slice(0, 7);
    sql(`insert into saved_quotes(id, shop_id, status, voided, amount_paid, date, payload) values
           (9600001, '${SHOP}', 'completed', false, 0, '${month}-02', jsonb_build_object('originAgentId', '${A}', 'items', jsonb_build_array(jsonb_build_object('qty', 1, 'sellPrice', 1000, 'bonusCommission', 70))));`);
    const lb = await call(loadHandler('agent-leaderboard', { createClient: factory(db) }).handler, { shopId: SHOP }, H);
    check(lb.status === 200 && lb.body.you && lb.body.you.completedOrders === 1 && lb.body.you.amount === 70,
      'BUG-4 the leaderboard finds this month\'s order', JSON.stringify(lb.body.you));
  }
  // ---------------- BUG-7 / BUG-10 ----------------
  {
    resetShop();
    const db = new RealDB();
    const submit = loadHandler('client-submit-order', { createClient: factory(db) });
    const portal = loadHandler('client-portal', { createClient: factory(db) });
    const tokenHash = await submit.ctx.sha256Hex('TOK');
    sql(`insert into customers(shop_id, id, name, phone) values ('${SHOP}', 'C1', 'Cust', '0772000001');
         insert into client_accounts(shop_id, customer_id, phone) values ('${SHOP}', 'C1', '772000001');
         insert into client_sessions(shop_id, customer_id, token_hash, device_id, expires_at) values ('${SHOP}', 'C1', '${tokenHash}', 'd', now() + interval '1 hour');
         insert into app_settings(shop_id, presets) values ('${SHOP}', '{"defaultMarkup":{"retailType":"percent","retailValue":50,"wholesaleType":"percent","wholesaleValue":50}}');
         insert into suppliers(shop_id, id, name) values ('${SHOP}', 'SUP', 'Supplier');
         insert into products(shop_id, id, name, variants) values ('${SHOP}', 'P1', 'Widget', '[]');
         insert into prices(id, shop_id, product_id, supplier_id, retail, pack_qty, unit) values (9700001, '${SHOP}', 'P1', 'SUP', 100, 0, 'pc');
         insert into stock(shop_id, key, qty) values ('${SHOP}', 'P1', 5);`);
    const order = () => call(submit.handler, { shopId: SHOP, token: 'TOK', items: [{ productId: 'P1', qty: 1 }] });
    const price = () => call(portal.handler, { shopId: SHOP, action: 'price', token: 'TOK', productId: 'P1', qty: 1 });
    const portalOrders = () => count(`saved_quotes where shop_id='${SHOP}' and payload->>'originPortal' = 'true'`);
    const failGet = (table, pred = () => true) => db.hook(async (op) => { if (op.kind === 'select' && op.table === table && pred(op)) return { error: { message: `injected ${table} read failure` } }; });

    const ctl = await price();
    check(ctl.body.unitPrice === 150, 'BUG-7 control: the default markup prices at 150', `${ctl.body.unitPrice}`);
    let off = failGet('app_settings');
    const r = await order(); const p = await price(); off();
    check(r.status === 503 && portalOrders() === 0, 'BUG-7 settings unreadable: the order is refused, nothing stored', `${r.status} ${JSON.stringify(r.body)}`);
    check(p.status === 503 && p.body.unitPrice === undefined, 'BUG-7 and the portal shows no price rather than the cost', `${p.status}`);
    off = failGet('saved_quotes', (op) => /client_phone/.test(op.params.select || ''));
    const h = await order(); off();
    check(h.status === 503 && portalOrders() === 0, 'BUG-7 price history unreadable: refused, not charged above what was shown', `${h.status}`);

    sql(`insert into saved_quotes(id, shop_id, client_phone, date, status, voided, amount_paid, payload) values
           (9800006, '${SHOP}', '0772000001', '2026-10-08', 'completed', false, 0, '{"items":[{"productId":"P1","variantIdx":null,"qty":1,"sellPrice":100}]}'),
           (9800007, '${SHOP}', '0772000001', '2026-10-08', 'completed', false, 0, '{"items":[{"productId":"P1","variantIdx":null,"qty":1,"sellPrice":150}]}');`);
    const shown = await price();
    const ord = await order();
    check(shown.body.unitPrice === 150 && ord.status === 200 && ord.body.lines[0].unitPrice === 150,
      'BUG-10 the newest same-day price is the one shown and charged', `shown ${shown.body.unitPrice}; charged ${ord.body.lines && ord.body.lines[0].unitPrice}`);
  }
  resetShop();
  console.log(failures ? `\n${failures} invariant(s) broken.` : '\nEvery invariant held.');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
