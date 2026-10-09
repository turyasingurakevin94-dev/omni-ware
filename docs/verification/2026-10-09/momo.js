'use strict';
// BUG-5, BUG-6, BUG-8 on the real agent-initiate-momo-payment and check-momo-payment-status handlers.
// Provider HTTP is mocked; nothing leaves the machine.
const { FakeDB, barrier } = require('./fakedb');
const { loadHandler, call } = require('./loadfn');

function world(orderOverrides = {}) {
  const db = new FakeDB({
    identity: { agent_mobile_payments: 'id', cash_txns: 'id', saved_quotes: 'id' },
    unique: { agent_mobile_payments: [['external_reference']] },
    rpcs: { current_agent_id: () => 'A1', is_shop_admin: () => false },
  });
  db.seed('shop_payment_providers', [{ shop_id: 'S', provider: 'mtn', enabled: true, environment: 'sandbox',
    credentials: { subscriptionKey: 'k', apiUser: 'u', apiKey: 'p', callbackHost: 'none' } }]);
  db.seed('agents', [{ shop_id: 'S', id: 'A1', name: 'Agent One' }]);
  db.seed('saved_quotes', [Object.assign({
    id: 10, shop_id: 'S', agent_id: 'A1', status: 'draft', voided: false, amount_paid: 0,
    payload: { originAgentId: 'A1', items: [{ productId: 'p1', variantIdx: null, qty: 1, sellPrice: 100, price: 80, supplierId: '__stock__' }] },
  }, orderOverrides)]);
  const pushes = [];
  let providerStatus = 'SUCCESSFUL';
  const fetch = async (url, init = {}) => {
    const u = String(url);
    if (u.endsWith('/collection/token/')) return new Response(JSON.stringify({ access_token: 'T' }), { status: 200 });
    if (u.endsWith('/collection/v1_0/requesttopay') && init.method === 'POST') { pushes.push(JSON.parse(init.body)); return new Response('', { status: 202 }); }
    if (/requesttopay\/[\w-]+$/.test(u)) return new Response(JSON.stringify({ status: providerStatus }), { status: 200 });
    throw new Error('unexpected fetch ' + u);
  };
  const createClient = (_u, key) => db.client(key === 'ANON' ? 'caller' : 'admin');
  const init = loadHandler('agent-initiate-momo-payment', { createClient, fetch }).handler;
  const check = loadHandler('check-momo-payment-status', { createClient, fetch }).handler;
  const H = { Authorization: 'Bearer agent-jwt' };
  return {
    db, pushes,
    initiate: () => call(init, { shopId: 'S', orderId: 10, provider: 'mtn', phone: '0772123456' }, H),
    recheck: (paymentId) => call(check, { shopId: 'S', paymentId }, H),
    order: () => db.rows('saved_quotes').find((q) => q.id === 10),
  };
}

(async () => {
  // ---------------- BUG-6 ----------------
  {
    const w = world();
    const a = await w.initiate(), b = await w.initiate();
    console.log('BUG-6 CONTROL sequential:', JSON.stringify(a.body), JSON.stringify(b.body), '| rows=', w.db.rows('agent_mobile_payments').length, 'pushes=', w.pushes.length);
  }
  {
    const w = world();
    const gate = barrier(2);
    let n = 0;
    w.db.hook(async (op) => { if (op.kind === 'insert' && op.table === 'agent_mobile_payments' && n < 2) { n++; await gate.arrive(); } });
    const [a, b] = await Promise.all([w.initiate(), w.initiate()]);
    const rows = w.db.rows('agent_mobile_payments');
    console.log('BUG-6 RACE:', a.status, JSON.stringify(a.body), '|', b.status, JSON.stringify(b.body));
    console.log('BUG-6 RACE state: pending rows=', rows.filter((r) => r.status === 'pending').length,
      'distinct ids=', new Set(rows.map((r) => r.id)).size, 'provider pushes=', w.pushes.length, 'amounts=', w.pushes.map((p) => p.amount).join(','));
  }
  // ---------------- BUG-8 ----------------
  {
    const w = world({ voided: true });
    const r = await w.initiate();
    console.log('BUG-8 voided=true, no agentCancel, shop-stock line:', r.status, JSON.stringify(r.body),
      '| rows=', w.db.rows('agent_mobile_payments').length, 'pushes=', w.pushes.length);
    const sel = w.db.log.find((op) => op.table === 'saved_quotes' && op.kind === 'select');
    console.log('BUG-8 order projection used by handler:', JSON.stringify(sel.cols));
  }
  {
    const w = world({ voided: true, payload: { originAgentId: 'A1', agentCancel: { at: 'x' }, items: [{ productId: 'p1', qty: 1, sellPrice: 100, supplierId: '__stock__' }] } });
    const r = await w.initiate();
    console.log('BUG-8 CONTROL agentCancel set:', r.status, JSON.stringify(r.body), 'pushes=', w.pushes.length);
  }
  // ---------------- BUG-5 ----------------
  for (const failAt of ['order_update', 'cash_insert']) {
    const w = world({ status: 'preparing' });
    const created = await w.initiate();
    const pid = created.body.paymentId;
    const off = w.db.hook(async (op) => {
      if (failAt === 'order_update' && op.kind === 'update' && op.table === 'saved_quotes') return { error: { message: 'injected order update failure' } };
      if (failAt === 'cash_insert' && op.kind === 'insert' && op.table === 'cash_txns') return { error: { message: 'injected cash insert failure' } };
    });
    const r1 = await w.recheck(pid);
    off();
    const r2 = await w.recheck(pid);
    const txn = w.db.rows('agent_mobile_payments').find((t) => t.id === pid);
    const o = w.order();
    console.log(`BUG-5 fail@${failAt}: first recheck`, JSON.stringify(r1.body), '| second recheck', JSON.stringify(r2.body));
    console.log(`BUG-5 fail@${failAt}: txn.status=${txn.status} cash_txns=${w.db.rows('cash_txns').length} order.amount_paid=${o.amount_paid} payments=${(o.payload.payments || []).length} agentPaymentStatus=${o.payload.agentPaymentStatus}`);
  }
  // control: happy path applies once
  {
    const w = world({ status: 'preparing' });
    const pid = (await w.initiate()).body.paymentId;
    const r1 = await w.recheck(pid), r2 = await w.recheck(pid);
    const o = w.order();
    console.log('BUG-5 CONTROL:', JSON.stringify(r1.body), JSON.stringify(r2.body), `cash=${w.db.rows('cash_txns').length} paid=${o.amount_paid}`);
  }
})().catch((e) => { console.error(e); process.exit(1); });
