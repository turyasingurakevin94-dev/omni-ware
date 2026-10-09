'use strict';
// Re-runs the edge-handler findings against REAL Postgres (all migrations, triggers,
// constraints, READ COMMITTED) through real PostgREST, plus the BUG-4 edge-function reads.
const { RealDB, sql, sqlJSON, SHOP, resetShop } = require('./realdb');
const { loadHandler, call } = require('./loadfn');
const { barrier } = require('./fakedb');

const H = { Authorization: 'Bearer agent-jwt' };
const q = (s) => s.replace(/'/g, "''");
function seedAgent(id = 'AG9001') { sql(`insert into agents(shop_id, id, name) values ('${SHOP}', '${id}', 'Agent One');`); return id; }
function seedOrder(id, payload, extra = {}) {
  const cols = { id, shop_id: SHOP, status: 'draft', voided: false, amount_paid: 0, date: '2026-10-01', ...extra };
  const names = Object.keys(cols).concat('payload');
  const vals = Object.values(cols).map((v) => (typeof v === 'string' ? `'${q(v)}'` : v)).concat(`'${q(JSON.stringify(payload))}'::jsonb`);
  sql(`insert into saved_quotes(${names.join(',')}) values (${vals.join(',')});`);
}
const factory = (db) => (_u, key) => db.client(key === 'ANON' ? 'caller' : 'admin');

(async () => {
  // ---------------- BUG-1 on real Postgres ----------------
  {
    resetShop(); const A = seedAgent();
    const it = { productId: 'p1', variantIdx: null, qty: 1, sellPrice: 100 };
    seedOrder(9101, { originAgentId: A, items: [it], agentCredit: { amount: 100, at: '2026-10-01', used: [] } }, { status: 'completed' });
    seedOrder(9102, { originAgentId: A, items: [it] });
    seedOrder(9103, { originAgentId: A, items: [it] });
    const db = new RealDB({ rpcs: { current_agent_id: () => A } });
    const { handler } = loadHandler('agent-change-order', { createClient: factory(db) });
    const gate = barrier(2); let n = 0;
    db.hook(async (op) => { if (op.kind === 'update' && op.table === 'saved_quotes' && n < 2) { n++; await gate.arrive(); } });
    const [a, b] = await Promise.all([9102, 9103].map((orderId) => call(handler, { shopId: SHOP, orderId, action: 'useCredit' }, H)));
    const rows = sqlJSON(`select id, amount_paid, payload->'agentCredit'->'used' as used from saved_quotes where shop_id='${SHOP}' order by id`);
    console.log('REAL BUG-1:', a.status, a.body.credited, b.status, b.body.credited, '|', JSON.stringify(rows));
  }
  // ---------------- BUG-2 / BUG-9 on real Postgres ----------------
  {
    resetShop();
    sql(`insert into customers(shop_id, id, name, phone) values ('${SHOP}', 'C1', 'Cust', '0772000001');`);
    const db = new RealDB();
    const { handler, ctx } = loadHandler('client-portal', { createClient: factory(db) });
    const setPin = async () => sql(`delete from client_accounts where shop_id='${SHOP}';
      insert into client_accounts(shop_id, customer_id, phone, pin_hash, pin_expires_at, pin_attempts) values
      ('${SHOP}', 'C1', '772000001', '${await ctx.hashPin('4821', SHOP, 'C1')}', now() + interval '5 minutes', 0);`);
    const verify = (pin, dev = 'd1') => call(handler, { shopId: SHOP, action: 'verify', phone: '0772000001', pin, deviceId: dev });
    await setPin();
    let gate = barrier(8), n = 0;
    let off = db.hook(async (op) => { if (op.kind === 'update' && op.table === 'client_accounts' && n < 8) { n++; await gate.arrive(); } });
    const rs = await Promise.all(['0000', '0001', '0002', '0003', '0004', '0005', '0006', '4821'].map((p) => verify(p)));
    off();
    console.log('REAL BUG-2 8 concurrent (7 wrong + correct last):', rs.map((r) => r.status).join(','),
      '| attempts now', sql(`select pin_attempts from client_accounts where shop_id='${SHOP}'`), '| sessions', sql(`select count(*) from client_sessions where shop_id='${SHOP}'`));
    await setPin(); sql(`delete from client_sessions where shop_id='${SHOP}'`);
    gate = barrier(8); n = 0;
    off = db.hook(async (op) => { if (op.kind === 'update' && op.table === 'client_accounts' && n < 8) { n++; await gate.arrive(); } });
    const wr = await Promise.all(['0000', '0001', '0002', '0003', '0004', '0005', '0006', '0007'].map((p) => verify(p)));
    off();
    console.log('REAL BUG-2 8 wrong:', wr.map((r) => r.status).join(','), '| attempts now', sql(`select pin_attempts from client_accounts where shop_id='${SHOP}'`));
    await setPin(); sql(`delete from client_sessions where shop_id='${SHOP}'`);
    gate = barrier(2); n = 0;
    off = db.hook(async (op) => { if (op.kind === 'update' && op.table === 'client_accounts' && n < 2) { n++; await gate.arrive(); } });
    const dbl = await Promise.all([verify('4821', 'dA'), verify('4821', 'dB')]);
    off();
    console.log('REAL BUG-2 correct PIN twice:', dbl.map((r) => r.status).join(','), '| sessions', sql(`select count(*) from client_sessions where shop_id='${SHOP}'`));
    await setPin(); sql(`delete from client_sessions where shop_id='${SHOP}'`);
    off = db.hook(async (op) => { if (op.kind === 'insert' && op.table === 'client_sessions') return { error: { message: 'injected session insert failure' } }; });
    const r9 = await verify('4821'); off();
    const acc = await call(handler, { shopId: SHOP, action: 'account', token: r9.body.token });
    console.log('REAL BUG-9a:', r9.status, JSON.stringify({ ok: r9.body.ok, token: !!r9.body.token }), '| pin_hash null?', sql(`select pin_hash is null from client_accounts where shop_id='${SHOP}'`),
      '| sessions', sql(`select count(*) from client_sessions where shop_id='${SHOP}'`), '| token ->', acc.status, acc.body.error);
  }
  // ---------------- BUG-5 / BUG-6 / BUG-8 on real Postgres ----------------
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
    const check = loadHandler('check-momo-payment-status', { createClient: factory(db), fetch }).handler;
    return { db, pushes, initiate: () => call(init, { shopId: SHOP, orderId: 9201, provider: 'mtn', phone: '0772123456' }, H), recheck: (id) => call(check, { shopId: SHOP, paymentId: id }, H) };
  };
  {
    const w = momoWorld();
    const gate = barrier(2); let n = 0;
    w.db.hook(async (op) => { if (op.kind === 'insert' && op.table === 'agent_mobile_payments' && n < 2) { n++; await gate.arrive(); } });
    const rs = await Promise.all([w.initiate(), w.initiate()]);
    console.log('REAL BUG-6:', rs.map((r) => r.status + ':' + r.body.paymentId).join(','), '| pending rows', sql(`select count(*) from agent_mobile_payments where shop_id='${SHOP}' and status='pending'`), '| pushes', w.pushes.length);
  }
  {
    const w = momoWorld({ voided: true });
    const r = await w.initiate();
    console.log('REAL BUG-8 voided order:', r.status, JSON.stringify(r.body), '| rows', sql(`select count(*) from agent_mobile_payments where shop_id='${SHOP}'`), '| pushes', w.pushes.length);
  }
  {
    const w = momoWorld({ status: 'preparing' });
    const id = (await w.initiate()).body.paymentId;
    const off = w.db.hook(async (op) => { if (op.kind === 'update' && op.table === 'saved_quotes') return { error: { message: 'injected order update failure' } }; });
    const r1 = await w.recheck(id); off();
    const r2 = await w.recheck(id);
    console.log('REAL BUG-5:', JSON.stringify(r1.body), JSON.stringify(r2.body), '| txn', sql(`select status from agent_mobile_payments where id=${id}`),
      '| cash rows', sql(`select count(*) from cash_txns where shop_id='${SHOP}'`), '| order paid', sql(`select amount_paid from saved_quotes where id=9201`));
  }
  // ---------------- BUG-4 edge reads: claim + leaderboard ----------------
  {
    resetShop(); const A = seedAgent();
    sql(`insert into saved_quotes(id, shop_id, status, voided, amount_paid, date, payload)
           select 9300000 + g, '${SHOP}', 'completed', false, 0, '2026-07-15', jsonb_build_object('originAgentId', '${A}', 'items', jsonb_build_array(jsonb_build_object('bonusCommission', 1)))
           from generate_series(1, 1000) g;
         insert into saved_quotes(id, shop_id, status, voided, amount_paid, date, payload)
           select 9400000 + g, '${SHOP}', 'completed', false, 0, '2026-08-20', jsonb_build_object('originAgentId', '${A}', 'items', jsonb_build_array(jsonb_build_object('bonusCommission', 100)))
           from generate_series(1, 5) g;`);
    const db = new RealDB({ rpcs: { current_agent_id: () => A } });
    const { handler } = loadHandler('agent-claim-commission', { createClient: factory(db) });
    const r = await call(handler, { shopId: SHOP, month: '2026-08' }, H);
    console.log('REAL BUG-4 claim for 2026-08 (5 orders x 100 bonus exist):', r.status, JSON.stringify(r.body));
  }
  {
    resetShop(); const A = seedAgent(); sql(`insert into agents(shop_id, id, name) values ('${SHOP}', 'AG9002', 'Agent Two');`);
    const month = new Date().toISOString().slice(0, 7);
    sql(`insert into saved_quotes(id, shop_id, status, voided, amount_paid, date, payload)
           select 9500000 + g, '${SHOP}', 'completed', false, 0, '2025-01-01', '{"items":[]}'::jsonb from generate_series(1, 1000) g;
         insert into saved_quotes(id, shop_id, status, voided, amount_paid, date, payload) values
           (9600001, '${SHOP}', 'completed', false, 0, '${month}-02', jsonb_build_object('originAgentId', '${A}', 'items', jsonb_build_array(jsonb_build_object('qty', 1, 'sellPrice', 1000, 'agentSellPrice', 1500))));`);
    const db = new RealDB({ rpcs: { current_agent_id: () => A } });
    const { handler } = loadHandler('agent-leaderboard', { createClient: factory(db) });
    const r = await call(handler, { shopId: SHOP }, H);
    console.log('REAL BUG-4 leaderboard (agent has 1 completed order this month, 1000 older walk-in orders):', r.status, JSON.stringify(r.body.you));
  }
  resetShop();
})().catch((e) => { console.error(e); process.exit(1); });
