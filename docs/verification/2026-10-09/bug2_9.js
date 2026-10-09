'use strict';
// BUG-2 (concurrent PIN verification) and BUG-9 (session persistence) on the real client-portal handler.
const { FakeDB, barrier } = require('./fakedb');
const { loadHandler, call } = require('./loadfn');

async function setup(pin = '4821') {
  const db = new FakeDB({ identity: { client_sessions: 'id' }, unique: { client_sessions: [['token_hash']], client_accounts: [['shop_id', 'phone']] } });
  const createClient = () => db.client('admin');
  const { handler, ctx } = loadHandler('client-portal', { createClient });
  const exp = new Date(Date.now() + 5 * 60 * 1000).toISOString();
  db.seed('customers', [{ shop_id: 'S', id: 'C1', name: 'Test Customer', phone: '0772000001' }]);
  db.seed('client_accounts', [{ shop_id: 'S', customer_id: 'C1', phone: '772000001', status: 'active',
    pin_hash: await ctx.hashPin(pin, 'S', 'C1'), pin_expires_at: exp, pin_attempts: 0 }]);
  const verify = (p, dev = 'dev1') => call(handler, { shopId: 'S', action: 'verify', phone: '0772000001', pin: p, deviceId: dev });
  const acct = () => db.rows('client_accounts')[0];
  return { db, handler, verify, acct };
}

(async () => {
  // Control: sequential wrong guesses lock after three.
  {
    const { verify, acct } = await setup();
    const rs = [];
    for (const g of ['0000', '0001', '0002', '0003', '4821']) rs.push((await verify(g)).status);
    console.log('BUG-2 CONTROL sequential statuses:', rs.join(','), 'attempts=', acct().pin_attempts);
  }
  // Race: 8 wrong guesses, all reads complete before any attempt write.
  {
    const { db, verify, acct } = await setup();
    const gate = barrier(8);
    let n = 0;
    db.hook(async (op) => { if (op.kind === 'update' && op.table === 'client_accounts' && n < 8) { n++; await gate.arrive(); } });
    const guesses = ['0000', '0001', '0002', '0003', '0004', '0005', '0006', '0007'];
    const rs = await Promise.all(guesses.map((g) => verify(g)));
    console.log('BUG-2 RACE statuses:', rs.map((r) => r.status + ':' + r.body.triesLeft).join(','),
      '| evaluated(401)=', rs.filter((r) => r.status === 401).length, 'final pin_attempts=', acct().pin_attempts);
  }
  // Race: 8 guesses where one is correct -- does a correct guess beyond the 3rd still succeed?
  {
    const { db, verify, acct } = await setup();
    const gate = barrier(8);
    let n = 0;
    db.hook(async (op) => { if (op.kind === 'update' && op.table === 'client_accounts' && n < 8) { n++; await gate.arrive(); } });
    const guesses = ['0000', '0001', '0002', '0003', '0004', '0005', '0006', '4821'];
    const rs = await Promise.all(guesses.map((g) => verify(g)));
    console.log('BUG-2 RACE w/ correct 8th guess:', rs.map((r) => r.status).join(','), '| 8th ok=', rs[7].body.ok === true,
      '| sessions=', db.rows('client_sessions').length);
  }
  // Race: the correct PIN twice concurrently (both read the live PIN before either clears it).
  {
    const { db, verify, acct } = await setup();
    const gate = barrier(2);
    let n = 0;
    db.hook(async (op) => { if (op.kind === 'update' && op.table === 'client_accounts' && n < 2) { n++; await gate.arrive(); } });
    const rs = await Promise.all([verify('4821', 'devA'), verify('4821', 'devB')]);
    console.log('BUG-2 DOUBLE-USE:', rs.map((r) => r.status + ':' + !!r.body.token).join(','),
      '| sessions=', db.rows('client_sessions').length, '| pin_hash now=', acct().pin_hash);
  }
  // BUG-9a: session insert fails after the PIN is cleared.
  {
    const { db, handler, verify, acct } = await setup();
    db.hook(async (op) => { if (op.kind === 'insert' && op.table === 'client_sessions') return { error: { message: 'injected session insert failure' } }; });
    const r = await verify('4821');
    const tok = r.body.token;
    const after = tok ? await call(handler, { shopId: 'S', action: 'account', token: tok }) : null;
    db.hooks = [];
    const again = await verify('4821');
    console.log('BUG-9a:', r.status, JSON.stringify({ ok: r.body.ok, hasToken: !!tok }), '| sessions=', db.rows('client_sessions').length,
      '| pin_hash=', acct().pin_hash, '| token used ->', after && after.status, JSON.stringify(after && after.body), '| PIN retry ->', again.status, JSON.stringify(again.body));
  }
  // BUG-9b: PIN clearing fails; session insert succeeds.
  {
    const { db, verify, acct } = await setup();
    db.hook(async (op) => { if (op.kind === 'update' && op.table === 'client_accounts' && op.values.pin_hash === null) return { error: { message: 'injected pin clear failure' } }; });
    const r = await verify('4821', 'devA');
    const liveAfterFirst = !!acct().pin_hash;
    db.hooks = [];
    const replay = await verify('4821', 'devB');
    console.log('BUG-9b:', r.status, !!r.body.token, '| pin still live after first OK login=', liveAfterFirst, '| replay of same PIN ->', replay.status, !!replay.body.token,
      '| sessions=', db.rows('client_sessions').length);
  }
})().catch((e) => { console.error(e); process.exit(1); });
