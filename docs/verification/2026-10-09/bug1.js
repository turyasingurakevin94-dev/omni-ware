'use strict';
// BUG-1: concurrent useCredit on agent-change-order. Executes the real handler.
const { FakeDB, barrier } = require('./fakedb');
const { loadHandler, call } = require('./loadfn');

function setup() {
  const db = new FakeDB({ identity: { saved_quotes: 'id' }, rpcs: { current_agent_id: () => 'A1' } });
  const item = (p) => ({ productId: 'p1', variantIdx: null, qty: 1, sellPrice: p });
  db.seed('saved_quotes', [
    { id: 1, shop_id: 'S', agent_id: 'A1', status: 'completed', voided: false, amount_paid: 0,
      payload: { originAgentId: 'A1', note: 'source', items: [item(100)], agentCredit: { amount: 100, at: '2026-10-01', used: [] } } },
    { id: 2, shop_id: 'S', agent_id: 'A1', status: 'draft', voided: false, amount_paid: 0, payload: { originAgentId: 'A1', items: [item(100)] } },
    { id: 3, shop_id: 'S', agent_id: 'A1', status: 'draft', voided: false, amount_paid: 0, payload: { originAgentId: 'A1', items: [item(100)] } },
  ]);
  const createClient = (_u, key) => db.client(key === 'ANON' ? 'caller' : 'admin');
  const { handler } = loadHandler('agent-change-order', { createClient });
  const H = { Authorization: 'Bearer agent-jwt' };
  const use = (orderId) => call(handler, { shopId: 'S', orderId, action: 'useCredit' }, H);
  const summary = () => {
    const r = Object.fromEntries(db.rows('saved_quotes').map((q) => [q.id, q]));
    return {
      sourceUsed: r[1].payload.agentCredit.used.map((u) => `${u.to}:${u.amount}`),
      sourceNote: r[1].payload.note,
      dest2Paid: r[2].amount_paid, dest3Paid: r[3].amount_paid,
    };
  };
  return { db, use, summary };
}

(async () => {
  // Control: sequential calls. Second must find no credit.
  {
    const { use, summary } = setup();
    const a = await use(2), b = await use(3);
    console.log('CONTROL sequential:', a.status, a.body.credited, '|', b.status, b.body.error, '|', JSON.stringify(summary()));
  }
  // Race: both requests complete the credit read before either writes.
  {
    const { db, use, summary } = setup();
    const gate = barrier(2);
    let waited = 0;
    db.hook(async (op) => {
      if (op.kind === 'update' && op.table === 'saved_quotes' && waited < 2) { waited++; await gate.arrive(); }
    });
    const [a, b] = await Promise.all([use(2), use(3)]);
    const s = summary();
    const credited = (a.body.credited || 0) + (b.body.credited || 0);
    const debited = s.sourceUsed.reduce((t, u) => t + Number(u.split(':')[1]), 0);
    console.log('RACE results:', a.status, JSON.stringify(a.body), '|', b.status, JSON.stringify(b.body));
    console.log('RACE state:', JSON.stringify(s), `credited=${credited} durableDebit=${debited} sourceCredit=100`);
    console.log(credited > 100 || credited !== debited ? 'BUG-1 RACE: INVARIANT VIOLATED' : 'BUG-1 RACE: invariant held');
  }
  // Rollback: X reads; Y completes fully; X writes source, X's destination update fails, X rolls back.
  {
    const { db, use, summary } = setup();
    let xRead, yDone;
    const xHasRead = new Promise((r) => { xRead = r; });
    const yFinished = new Promise((r) => { yDone = r; });
    let srcUpdates = 0;
    db.hook(async (op) => {
      // X's credit read is the first select of saved_quotes without an id filter.
      if (op.kind === 'update' && op.table === 'saved_quotes') {
        const id = (op.filters.find((f) => f.c === 'id') || {}).v;
        if (id === 1 && op.values.payload.agentCredit.used.some((u) => u.to === 2) && srcUpdates++ === 0) { xRead(); await yFinished; }
        if (id === 2 && op.values.amount_paid != null) return { error: { message: 'injected destination update failure' } };
      }
    });
    const x = use(2);
    await xHasRead;
    const y = await use(3);
    yDone();
    const xr = await x;
    console.log('ROLLBACK results: X', xr.status, JSON.stringify(xr.body), '| Y', y.status, JSON.stringify(y.body));
    const s = summary();
    console.log('ROLLBACK state:', JSON.stringify(s));
    console.log(s.dest3Paid === 100 && !s.sourceUsed.some((u) => u.startsWith('3:'))
      ? 'BUG-1 ROLLBACK: Y credited 100 but its debit was erased by X\'s stale rollback' : 'BUG-1 ROLLBACK: debit preserved');
  }
  // Rollback clobbers an unrelated payload edit made to the source after X read it.
  {
    const { db, use, summary } = setup();
    db.hook(async (op) => {
      if (op.kind === 'update' && op.table === 'saved_quotes') {
        const id = (op.filters.find((f) => f.c === 'id') || {}).v;
        // The shop edits the source order's note between X's read and X's rollback.
        if (id === 2 && op.values.amount_paid != null) {
          const t = db.tables.saved_quotes.find((q) => q.id === 1);
          t.payload = { ...t.payload, note: 'shop edited' };
          return { error: { message: 'injected destination update failure' } };
        }
      }
    });
    const xr = await use(2);
    console.log('ROLLBACK-CLOBBER:', xr.status, JSON.stringify(summary()));
  }
})().catch((e) => { console.error(e); process.exit(1); });
