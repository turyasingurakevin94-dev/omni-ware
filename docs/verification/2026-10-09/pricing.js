'use strict';
// BUG-7 (discarded read errors -> pricing at cost) and BUG-10 (same-day remembered price)
// on the real client-submit-order and client-portal handlers.
const { FakeDB } = require('./fakedb');
const { loadHandler, call } = require('./loadfn');

async function world({ history = [], markupPct = 50 } = {}) {
  const db = new FakeDB({ identity: { saved_quotes: 'id', client_sessions: 'id' } });
  const createClient = () => db.client('admin');
  const submit = loadHandler('client-submit-order', { createClient });
  const portal = loadHandler('client-portal', { createClient });
  db.seed('customers', [{ shop_id: 'S', id: 'C1', name: 'Cust', phone: '0772000001' }]);
  db.seed('client_accounts', [{ shop_id: 'S', customer_id: 'C1', phone: '772000001', status: 'active', pin_attempts: 0 }]);
  db.seed('client_sessions', [{ id: 1, shop_id: 'S', customer_id: 'C1', token_hash: await submit.ctx.sha256Hex('TOK'),
    device_id: 'd', expires_at: new Date(Date.now() + 3600e3).toISOString(), revoked_at: null }]);
  db.seed('app_settings', [{ shop_id: 'S', presets: { defaultMarkup: { retailType: 'percent', retailValue: markupPct, wholesaleType: 'percent', wholesaleValue: markupPct } } }]);
  db.seed('products', [{ shop_id: 'S', id: 'P1', name: 'Widget', variants: [], wholesale_markup_type: null, wholesale_markup_value: 0, retail_markup_type: null, retail_markup_value: 0 }]);
  db.seed('prices', [{ shop_id: 'S', product_id: 'P1', variant_idx: null, supplier_id: 'SUP', wholesale: null, retail: 100, pack_qty: 0, unit: 'pc', pack_unit: '', tiers: [], out_of_stock: false }]);
  db.seed('stock', [{ shop_id: 'S', key: 'P1', qty: 5 }]);
  db.seed('saved_quotes', history);
  return {
    db,
    order: () => call(submit.handler, { shopId: 'S', token: 'TOK', items: [{ productId: 'P1', qty: 1 }] }),
    price: () => call(portal.handler, { shopId: 'S', action: 'price', token: 'TOK', productId: 'P1', qty: 1 }),
    stored: () => db.rows('saved_quotes').filter((q) => q.payload && q.payload.originPortal),
  };
}
const failTable = (db, table) => db.hook(async (op) => { if (op.kind === 'select' && op.table === table) return { error: { message: `injected ${table} read failure` } }; });
const failHistory = (db) => db.hook(async (op) => {
  if (op.kind === 'select' && op.table === 'saved_quotes' && op.cols === 'client_phone, date, voided, payload') return { error: { message: 'injected history read failure' } };
});

(async () => {
  // ---------- BUG-7 ----------
  {
    const w = await world();
    const r = await w.order();
    console.log('BUG-7 CONTROL submit:', r.status, JSON.stringify(r.body), '| stored sellPrice=', w.stored()[0].payload.items[0].sellPrice);
  }
  {
    const w = await world();
    failTable(w.db, 'app_settings');
    const r = await w.order();
    const s = w.stored();
    console.log('BUG-7 settings-read failure submit:', r.status, JSON.stringify(r.body), '| stored orders=', s.length, 'stored sellPrice=', s[0] && s[0].payload.items[0].sellPrice, 'cost=', s[0] && s[0].payload.items[0].price);
  }
  {
    const w = await world();
    const ok = await w.price();
    failTable(w.db, 'app_settings');
    const bad = await w.price();
    console.log('BUG-7 portal price: control unitPrice=', ok.body.unitPrice, '| settings-read failure ->', bad.status, 'unitPrice=', bad.body.unitPrice, '(supplier cost is 100)');
  }
  {
    const hist = [{ id: 5, shop_id: 'S', client_name: 'Cust', client_phone: '0772000001', date: '2026-10-01', voided: false, status: 'completed',
      payload: { items: [{ productId: 'P1', variantIdx: null, qty: 1, sellPrice: 120 }] } }];
    const w = await world({ history: hist });
    const shown = await w.price();
    failHistory(w.db);
    const r = await w.order();
    console.log('BUG-7 history-read failure: portal showed', shown.body.unitPrice, '(heldFrom', shown.body.heldFrom + ')',
      '| submit ->', r.status, 'charged unitPrice=', r.body.lines && r.body.lines[0].unitPrice);
  }
  // ---------- BUG-10 ----------
  {
    const hist = [
      // returned newest-first by .order("id", desc): id 7 (newer, 150) then id 6 (older, 100), same date
      { id: 6, shop_id: 'S', client_name: 'Cust', client_phone: '0772000001', date: '2026-10-08', voided: false, status: 'completed',
        payload: { items: [{ productId: 'P1', variantIdx: null, qty: 1, sellPrice: 100 }] } },
      { id: 7, shop_id: 'S', client_name: 'Cust', client_phone: '0772000001', date: '2026-10-08', voided: false, status: 'completed',
        payload: { items: [{ productId: 'P1', variantIdx: null, qty: 1, sellPrice: 150 }] } },
      // a different, earlier day and another customer, as controls
      { id: 3, shop_id: 'S', client_name: 'Cust', client_phone: '0772000001', date: '2026-09-01', voided: false, status: 'completed',
        payload: { items: [{ productId: 'P1', variantIdx: null, qty: 1, sellPrice: 140 }] } },
      { id: 8, shop_id: 'S', client_name: 'Other', client_phone: '0700999999', date: '2026-10-08', voided: false, status: 'completed',
        payload: { items: [{ productId: 'P1', variantIdx: null, qty: 1, sellPrice: 101 }] } },
    ];
    const w = await world({ history: hist });
    const shown = await w.price();
    const r = await w.order();
    console.log('BUG-10: newest same-day order (id 7) price 150, older (id 6) 100 ->',
      'portal shows', shown.body.unitPrice, 'heldFrom', shown.body.heldFrom, '| submit charges', r.body.lines[0].unitPrice,
      '| stored sellPrice', w.stored()[0].payload.items[0].sellPrice);
  }
  {
    // control: different days, newest wins
    const hist = [
      { id: 6, shop_id: 'S', client_phone: '0772000001', date: '2026-10-07', voided: false, payload: { items: [{ productId: 'P1', variantIdx: null, sellPrice: 100 }] } },
      { id: 7, shop_id: 'S', client_phone: '0772000001', date: '2026-10-08', voided: false, payload: { items: [{ productId: 'P1', variantIdx: null, sellPrice: 150 }] } },
    ];
    const w = await world({ history: hist });
    const shown = await w.price();
    console.log('BUG-10 CONTROL different days: portal shows', shown.body.unitPrice);
  }
})().catch((e) => { console.error(e); process.exit(1); });
