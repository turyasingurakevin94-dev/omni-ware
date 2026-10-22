/* A fake Supabase for the live Sales app: Mukasa Hardware, Sat 17 Oct 2026 (docs/canvas-cast.md). */
(function(){
  const SH = 'shop1', now = Date.now(), H = 3600e3, D = 864e5;
  const iso = ms => new Date(ms).toISOString(), day = ms => iso(ms).slice(0, 10);
  const today = day(now);
  const line = (lineId, productId, vi, name, qty, supplierId, supplierName, price, sellPrice, extra) => Object.assign({ lineId, productId, variantIdx: vi, productName: name, unit: 'pc', packUnit: '', packQty: 0, qtyIn: 'unit', qty, supplierId, supplierName, price, sellPrice }, extra || {});
  const mk = (id, status, client, customerId, items, extra, row) => Object.assign({ id, shop_id: SH, status, invoiced: false, invoiced_at: null, amount_paid: 0, voided: false, date: today,
    payload: Object.assign({ client: { name: client, phone: '0772' + String(id).padStart(6, '0') }, customerId, items, charges: [], payments: [], debtCharged: 0, createdAt: iso(now - 2 * H), savedAt: iso(now - 2 * H), stageEnteredAt: now - 90 * 60e3, stageLog: [{ status: 'draft', at: now - 2 * H }], takenBy: 'u1' }, extra || {}) }, row || {});
  const ruth = { by: 'm1', byName: 'Ruth Nakato' };
  const tables = {
    shop_members: [{ shop_id: SH, user_id: 'u1', role: 'sales', shops: { name: 'Mukasa Hardware' } }, { shop_id: SH, user_id: 'm1', role: 'manager' }, { shop_id: SH, user_id: 'o1', role: 'owner' }, { shop_id: SH, user_id: 's1', role: 'sourcing' }, { shop_id: SH, user_id: 'a1', role: 'accounts', shops: { name: 'Mukasa Hardware' } }],
    staff: [{ id: 1, shop_id: SH, name: 'Grace Akello', user_id: 'u1', role: 'sales' }, { id: 2, shop_id: SH, name: 'Ruth Nakato', user_id: 'm1', role: 'manager' }, { id: 3, shop_id: SH, name: 'Joseph Mukasa', user_id: 'o1', role: 'owner' }, { id: 6, shop_id: SH, name: 'Esther Auma', user_id: 'a1', role: 'accounts' }, { id: 4, shop_id: SH, name: 'Denis Okello', user_id: 'b1', role: 'buyer' }, { id: 5, shop_id: SH, name: 'Moses Lubega', user_id: 's1', role: 'sourcing' }],
    suppliers: [{ id: 'S1', name: 'Namanve Sheets' }, { id: 'S2', name: 'Katwe Fabricators' }],
    customers: [
      { id: 'C001', name: 'Kato Construction', phone: '0772000001', location: 'Najjera', debt: 420000, terms_days: 30, credit_limit: 3000000 },
      { id: 'C002', name: 'Kyaligonza & Sons', phone: '0772000002', location: 'Kawempe', debt: 0 },
      { id: 'C003', name: 'Lubowa Builders', phone: '0772000003', location: 'Lubowa', debt: 646000, credit_limit: 2000000 },
      { id: 'C004', name: 'Nansana Hardware', phone: '0772000004', location: 'Nansana', debt: 4120000, credit_limit: 6000000 },
      { id: 'C005', name: 'Ggaba Stores', phone: '0772000005', location: 'Ggaba', debt: 0 },
    ],
    customer_debt_log: [],
    products: [
      { id: 'P1', name: 'Iron sheet G28 · 3m', type: 'simple', category: 'Roofing', retail_markup_type: 'percent', retail_markup_value: 0, wholesale_markup_type: 'fixed', wholesale_markup_value: 3200, stock_retail_markup_type: 'percent', stock_retail_markup_value: 20, stock_wholesale_markup_type: 'percent', stock_wholesale_markup_value: 20 },
      { id: 'P2', name: 'Wheelbarrow, heavy duty', type: 'simple', category: 'Tools', retail_markup_value: 0, wholesale_markup_value: 0, stock_retail_markup_value: 0, stock_wholesale_markup_value: 0 },
      { id: 'P3', name: 'Hima cement 50kg', type: 'simple', category: 'Cement', stock_retail_markup_type: 'fixed', stock_retail_markup_value: 2500, stock_wholesale_markup_type: 'fixed', stock_wholesale_markup_value: 2500 },
      { id: 'P4', name: 'Ridge caps', type: 'simple', category: 'Roofing', stock_retail_markup_type: 'fixed', stock_retail_markup_value: 3000, stock_wholesale_markup_type: 'fixed', stock_wholesale_markup_value: 3000 },
      { id: 'P6', name: 'Roof paint, maroon 20L', type: 'simple', category: 'Paint', retail_markup_type: 'percent', retail_markup_value: 25, wholesale_markup_type: 'percent', wholesale_markup_value: 25 },
      { id: 'P5', name: 'Roofing nails', type: 'simple', category: 'Nails', stock_retail_markup_type: 'percent', stock_retail_markup_value: 25, stock_wholesale_markup_type: 'percent', stock_wholesale_markup_value: 25 },
    ],
    prices: [
      { id: 1, product_id: 'P1', variant_idx: null, supplier_id: 'S1', wholesale: 35000, retail: 35000, unit: 'sheet', pack_unit: 'bundle', pack_qty: 10, tiers: [] },
      { id: 2, product_id: 'P2', variant_idx: null, supplier_id: 'S2', wholesale: 150000, retail: 150000, unit: 'pc', tiers: [] },
      { id: 4, product_id: 'P6', variant_idx: null, supplier_id: 'S1', wholesale: 148000, retail: 148000, unit: 'tin', tiers: [] },
      { id: 3, product_id: 'P5', variant_idx: null, supplier_id: 'S1', wholesale: 8000, retail: 8000, unit: 'kg', pack_unit: 'carton', pack_qty: 25, tiers: [] },
    ],
    stock: [{ key: 'P3', qty: 120 }, { key: 'P4', qty: 60 }, { key: 'P5', qty: 300 }],
    stock_lots: [{ key: 'P3', qty: 120, cost: 33000 }, { key: 'P4', qty: 60, cost: 15000 }, { key: 'P5', qty: 300, cost: 8000 }],
    saved_quotes: [
      // Q-2402: Kato, in Checking; the wheelbarrows wait for Ruth.
      mk(2402, 'draft', 'Kato Construction', 'C001', [
        line(1, 'P1', null, 'Iron sheet G28 · 3m', 40, 'S1', 'Namanve Sheets', 35000, 38200),
        line(2, 'P2', null, 'Wheelbarrow, heavy duty', 2, 'S2', 'Katwe Fabricators', 150000, 165000, { priceBy: 'u1', priceNote: 'nomargin', priceShop: null, priceAt: iso(now - 70 * 60e3) }),
      ], { supplierConfirms: { S1: { state: 'confirmed', at: iso(now - 60 * 60e3) }, S2: { state: 'confirmed', at: iso(now - 50 * 60e3) } } }),
      // Q-2398: Kyaligonza, Buying; Ruth set a new price, not told yet.
      mk(2398, 'awaiting_goods', 'Kyaligonza & Sons', 'C002', [
        line(1, 'P1', null, 'Iron sheet G28 · 3m', 20, 'S1', 'Namanve Sheets', 35000, 38200),
        line(2, 'P2', null, 'Wheelbarrow, heavy duty', 2, 'S2', 'Katwe Fabricators', 150000, 172000, { priceBy: 'u1', priceNote: 'nomargin', priceShop: null, priceAt: iso(now - 3 * H), priceReview: Object.assign({ state: 'changed', price: 172000, was: 165000, at: iso(now - 25 * 60e3) }, ruth) }),
      ], { stageLog: [{ status: 'draft', at: now - 4 * H }, { status: 'awaiting_goods', at: now - 25 * 60e3 }], stageEnteredAt: now - 25 * 60e3 }),
      // Q-2370: Kato's oldest bill, 18 days.
      mk(2370, 'completed', 'Kato Construction', 'C001', [line(1, 'P3', null, 'Hima cement 50kg', 6, '__stock__', 'Stock', 33000, 36333)], {}, { invoiced: true, invoiced_at: day(now - 18 * D), date: day(now - 18 * D) }),
      mk(2380, 'completed', 'Kato Construction', 'C001', [line(1, 'P4', null, 'Ridge caps', 11, '__stock__', 'Stock', 15000, 18000)], {}, { invoiced: true, invoiced_at: day(now - 6 * D), date: day(now - 6 * D) }),
      // Lubowa, delivered and invoiced today.
      mk(2405, 'completed', 'Lubowa Builders', 'C003', [line(1, 'P4', null, 'Ridge caps', 10, '__stock__', 'Stock', 15000, 18000), line(2, 'P5', null, 'Roofing nails', 46, '__stock__', 'Stock', 8000, 10000)], { deliveredAt: now - 3 * H }, { invoiced: true, invoiced_at: today }),
      // Nansana, raised twice.
      mk(2412, 'completed', 'Nansana Hardware', 'C004', [line(1, 'P3', null, 'Hima cement 50kg', 54, '__stock__', 'Stock', 33000, 36518.5)], {}, { invoiced: true, invoiced_at: today }),
      mk(2413, 'completed', 'Nansana Hardware', 'C004', [line(1, 'P3', null, 'Hima cement 50kg', 54, '__stock__', 'Stock', 33000, 36518.5)], {}, { invoiced: true, invoiced_at: today }),
    ],
    product_links: [], app_settings: [{ shop_id: SH, presets: { creditPct: 0, defaultMarkup: {}, creditHold: { days: 21 } } }], cash_txns: [{ id: 501, shop_id: SH, date: today, account: 'momo', type: 'receipt', category: 'Debt Payment', amount: 420000, description: 'Payment — Kato Construction', time: '12:14', quote_id: 2370, entered_by: 'u1' }], collection_trips: [], manager_notes: [], statements_sent: [],
    payment_promises: [], invoice_asks: [], decision_log: [], payment_asks: window.__UID === 'a1' ? [{ id: 'pa1', shop_id: SH, cash_txn_id: 501, customer_id: 'C001', quote_id: 2370, amount: 420000, what: 'method', want: { from: 'momo', account: 'bank' }, note: 'Stanbic slip 4471', asked_by: 'u1', asked_by_name: 'Grace Akello', status: 'sent', created_at: iso(now - 20 * 60e3) }] : [],
    sourcing_leads: [
      { id: 'SRC-A', shop_id: SH, name: 'Roof paint, maroon 20L', status: 'listed', voided: false, product_id: 'P6', assigned_staff_id: 5, created_at: iso(now - 5 * D), stage_entered_at: now - 3 * H, candidates: [{}, {}], requests: [{ at: iso(now - 5 * D), source: 'sourcing.ask', customerId: 'C005', customerName: 'Ggaba Stores', qty: 6, by: 'u1', salesName: 'Grace Akello' }] },
      { id: 'SRC-B', shop_id: SH, name: 'Tile cutter 600mm', status: 'sourced', voided: false, assigned_staff_id: 5, created_at: iso(now - 4 * D), stage_entered_at: now - D, candidates: [{}], requests: [{ at: iso(now - 4 * D), source: 'sourcing.ask', customerId: 'C004', customerName: 'Nansana Hardware', qty: 1, by: 'u1' }] },
      { id: 'SRC-C', shop_id: SH, name: 'Ceiling fan, 56 inch', status: 'looking', voided: false, assigned_staff_id: 5, created_at: iso(now - 3 * D), stage_entered_at: now - 2 * D, candidates: [{}, {}], requests: [{ at: iso(now - 3 * D), source: 'sourcing.ask', customerId: 'C003', customerName: 'Lubowa Builders', qty: 4, by: 'u1' }] },
    ],
    wa_conversations: [{ id: 7, shop_id: SH, wa_id: '256772000001', profile_name: 'Kato', last_inbound_at: iso(now - 12 * 60e3), last_message_at: iso(now - 12 * 60e3), last_read_at: null }],
    wa_messages: [{ id: 70, shop_id: SH, conversation_id: 7, direction: 'in', msg_type: 'text', body: 'Good morning. We are roofing in Najjera. Can you do 40 iron sheets G28 by Friday? Also 2 wheelbarrows.', sent_at: iso(now - 12 * 60e3) }],
  };
  window.__T = tables;
  function Q(t){ this.t = t; this.f = []; this.op = 'select'; this.one = false; }
  Q.prototype.select = function(){ if (this.op === 'insert') this.ret = true; return this; };
  Q.prototype.eq = function(k, v){ this.f.push(r => !(k in r) || String(r[k]) === String(v)); return this; };
  Q.prototype.neq = Q.prototype.gt = Q.prototype.gte = Q.prototype.lt = Q.prototype.lte = Q.prototype.order = Q.prototype.limit = Q.prototype.in = Q.prototype.not = Q.prototype.is = Q.prototype.or = Q.prototype.ilike = Q.prototype.range = Q.prototype.filter = Q.prototype.contains = function(){ return this; };
  Q.prototype.upsert = function(row){ this.op = 'insert'; this.row = row; return this; };
  Q.prototype.maybeSingle = Q.prototype.single = function(){ this.one = true; return this; };
  Q.prototype.insert = function(row){ this.op = 'insert'; this.row = row; return this; };
  Q.prototype.update = function(row){ this.op = 'update'; this.row = row; return this; };
  Q.prototype.then = function(res, rej){
    const rows = tables[this.t] || (tables[this.t] = []);
    const c = x => JSON.parse(JSON.stringify(x));
    if (this.op === 'insert') { const r = Object.assign({ id: 'x' + rows.length, created_at: new Date().toISOString() }, c(this.row)); rows.push(r); return Promise.resolve({ data: this.one ? c(r) : [c(r)], error: null }).then(res, rej); }
    const hit = rows.filter(r => this.f.every(f => f(r)));
    if (this.op === 'update') { hit.forEach(r => Object.assign(r, c(this.row))); return Promise.resolve({ error: null }).then(res, rej); }
    return Promise.resolve({ data: c(this.one ? (hit[0] || null) : hit), count: hit.length, error: null }).then(res, rej);
  };
  let ids = 3000;
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: window.__UID || 'u1', email: (window.__UID || 'u1') + '@mukasa.ug' } }, error: null }), getSession: async () => ({ data: { session: null } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe(){} } } }), signOut: async () => ({}) },
    from: t => new Q(t),
    rpc: async (fn, a) => { (window.__rpcLog ||= []).push({ fn, ref: a && a.p_ref }); if (fn === 'next_row_id_blocks') { const k = a.p_kinds[0]; return { data: { [k]: ++ids }, error: null }; } if (fn === 'invoice_order') { const q = tables.saved_quotes.find(r => r.id === a.p_quote_id); if (!q) return { data: null, error: { message: 'not in this shop' } }; if (q.status !== 'completed') return { data: null, error: { message: 'Only a delivered order is invoiced.' } }; q.invoiced = true; q.invoiced_at = new Date().toISOString().slice(0, 10); return { data: { ok: true, invoice: 'INV-' + String(q.id).padStart(4, '0') }, error: null }; }
    if (fn === 'counter_sale') { const id = ++ids, now = new Date().toISOString(); const row = { id, shop_id: a.p_shop_id, client_name: a.p_row.client_name, client_phone: a.p_row.client_phone, date: now.slice(0, 10), status: 'draft', invoiced: false, amount_paid: 0, voided: false, payload: { ...a.p_row.payload, counter: true, savedAt: now, createdAt: now } };
      const q = window.rowToQuote(row); if (window.pricesWaiting(q).length) { tables.saved_quotes.push(row); return { data: { ok: true, id, waiting: 'price' }, error: null }; }
      const total = Math.round(window.pricedLive(q).total); row.status = 'completed'; row.invoiced = true; row.amount_paid = total; tables.saved_quotes.push(row);
      return { data: { ok: true, id, pay: total, total, invoice: 'INV-' + String(id).padStart(4, '0'), invoiced: true, cashTxnId: ++ids }, error: null }; }
    if (fn === 'receive_payment') { const t = new Date().toTimeString().slice(0, 5);
      if (a.p_order_id != null) { const r = tables.saved_quotes.find(x => x.id === a.p_order_id); const q = window.rowToQuote(r), due = Math.max(0, Math.round(window.pricedLive(q).total - (Number(r.amount_paid) || 0))), pay = Math.min(a.p_amount, due);
        r.amount_paid = (Number(r.amount_paid) || 0) + pay; return { data: { kind: 'order', amount: pay, method: a.p_method, time: t, before: due, after: due - pay, bills: [{ quoteId: r.id, label: 'Order #' + r.id, pay, cleared: pay >= due, left: due - pay, total: Math.round(window.pricedLive(q).total) }], cashRows: [] }, error: null }; }
      const c = tables.customers.find(x => x.id === a.p_customer_id), before = Number(c.debt) || 0, after = Math.max(0, before - a.p_amount); c.debt = after;
      return { data: { kind: 'cust', amount: a.p_amount, method: a.p_method, time: t, before, after, bills: [{ label: 'On account', pay: a.p_amount, cleared: after === 0, left: after, onAccount: true }], cashRows: [] }, error: null }; }
    if (fn === 'withdraw_payment_ask') { const x = tables.payment_asks.find(r => r.id === a.p_id); if (x) x.status = 'withdrawn'; return { data: null, error: null }; }
    if (fn === 'withdraw_invoice_ask') { const x = tables.invoice_asks.find(r => r.id === a.p_id); if (x) x.status = 'withdrawn'; return { data: null, error: null }; } return { data: null, error: null }; },
    functions: { invoke: async (n, o) => ({ data: { configured: true, ok: true }, error: null }) },
    storage: { from: () => ({ upload: async () => ({ error: null }), getPublicUrl: () => ({ data: { publicUrl: '' } }), createSignedUrl: async () => ({ data: null }) }) },
    channel: () => ({ on(){ return this; }, subscribe(){ return this; } }), removeChannel(){},
  };
  window.supabase = { createClient: () => client };
})();
