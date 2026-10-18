/* The sample shop every canvas draws (docs/canvas-cast.md): Mukasa
   Hardware, Kampala. Rows in the database's own shape, dated from now. */
(function () {
  const SHOP = '11111111-1111-1111-1111-111111111111', ME = '00000000-0000-0000-0000-00000000000d';
  const now = Date.now(), DAY = 86400000;
  const ago = (d, h) => new Date(now - d * DAY - (h || 0) * 3600000).toISOString();
  const day = (d) => new Date(now - d * DAY).toISOString().slice(0, 10);
  const ms = (d) => now - d * DAY;
  const s = (o) => ({ shop_id: SHOP, ...o });
  const ask = (o) => ({ at: ago(o.d || 0, o.h || 0), source: o.source || 'sales', customerId: o.cid || null, customerName: o.name || '', phone: o.phone || '', qty: o.qty == null ? null : o.qty, orderId: o.orderId || null, note: o.note || '', ...(o.extra || {}) });
  const cand = (o) => ({ id: o.id, at: ago(o.d || 1), role: o.role || 'supplier', supplierId: o.sid || null, supplierName: o.name || '', phone: o.phone || '', where: o.where || '', unit: o.unit || 'pc',
    tiers: o.tiers || [], packQty: o.packQty || 0, packUnit: o.packUnit || '', leadTimeDays: o.lead == null ? null : o.lead, transport: o.transport || 0, validDays: o.valid || 7, quotedAt: o.tiers && o.tiers.length ? ago(o.d || 1) : undefined });
  const leads = [
    { id: 'SRC-001', name: 'Gutter bracket · PVC', status: 'looking', stage_entered_at: ms(4), created_at: ago(9), assigned_staff_id: 'ST04',
      requests: [ask({ d: 9, cid: 'C006', name: 'Nansana Hardware', qty: 20 }), ask({ d: 6, cid: 'C001', name: 'Kato Construction', qty: 12, source: 'agent', extra: { agentId: 'A01' } }), ask({ d: 4, cid: 'C003', name: 'Mukono Roofing', qty: 16 }), ask({ d: 2, cid: 'C005', name: 'Ggaba Stores', qty: 8, source: 'whatsapp' }), ask({ d: 1, cid: 'C002', name: 'Kyaligonza & Sons', qty: 8 })], candidates: [] },
    { id: 'SRC-002', name: 'Valley flashing · 3m', status: 'sourced', stage_entered_at: ms(2), created_at: ago(12), assigned_staff_id: 'ST04', image: null,
      requests: [ask({ d: 12, cid: 'C006', name: 'Nansana Hardware', qty: 6, source: 'dropped', orderId: 2400, extra: { productId: null, sellPrice: 17000, reason: 'Nobody has it' } }), ask({ d: 8, cid: 'C004', name: 'Lubowa Builders', qty: 10 }), ask({ d: 5, cid: 'C001', name: 'Kato Construction', qty: 4 }), ask({ d: 3, cid: 'C003', name: 'Mukono Roofing', qty: 2 })],
      candidates: [cand({ id: 'K1', sid: 'S001', name: 'Namanve Sheets', tiers: [{ minQty: 1, price: 12500 }, { minQty: 10, price: 11500 }], packQty: 10, packUnit: 'bundle', lead: 2, transport: 15000, d: 2 }),
        cand({ id: 'K2', sid: 'S003', name: 'Kiseka Steel', tiers: [{ minQty: 1, price: 13200 }], lead: 1, d: 3 }), { kind: 'rival', name: 'Nakasero Hardware', price: 16500, stock: 'In stock', area: 'Nakasero', how: 'visit', seenAt: ago(4) }] },
    { id: 'SRC-003', name: 'PPR pipe 25mm · 4m', status: 'sourced', stage_entered_at: ms(6), created_at: ago(15), assigned_staff_id: 'ST04',
      requests: [ask({ d: 15, cid: 'C004', name: 'Lubowa Builders', qty: 40 }), ask({ d: 10, cid: 'C002', name: 'Kyaligonza & Sons', qty: 20 }), ask({ d: 7, cid: 'C005', name: 'Ggaba Stores', qty: 20 })],
      candidates: [cand({ id: 'K3', sid: 'S004', name: 'Owino Plumbing', tiers: [{ minQty: 1, price: 16000 }, { minQty: 20, price: 15000 }], lead: 3, d: 5 }), { kind: 'meta', sample: { at: ago(3), cost: 9000, checks: { size: true, finish: null, pack: null }, by: 'Moses Lubega' } }] },
    { id: 'SRC-004', name: 'Door closer · medium', status: 'asked', stage_entered_at: ms(1), created_at: ago(1), image: null,
      requests: [ask({ d: 1, cid: 'C001', name: 'Kato Construction', qty: 4, source: 'agent', note: 'with a photo', extra: { agentId: 'A01', agentRequestId: 7001 } })], candidates: [] },
    { id: 'SRC-005', name: 'Solar floodlight · 100W', status: 'asked', stage_entered_at: ms(3), created_at: ago(3),
      requests: [ask({ d: 3, cid: 'C005', name: 'Ggaba Stores', qty: 4, source: 'sales', extra: { by: 'u-grace', salesName: 'Grace Akello' } }), ask({ d: 2, name: 'Walk-in', qty: 2, source: 'sourcing' })], candidates: [] },
    { id: 'SRC-006', name: 'Ridge cap G30 · red', status: 'looking', stage_entered_at: ms(9), created_at: ago(10), assigned_staff_id: 'ST04',
      requests: [ask({ d: 10, cid: 'C001', name: 'Kato Construction', qty: 30, source: 'dropped', orderId: 2397, extra: { reason: 'Nobody has it', sellPrice: 21000 } })], candidates: [] },
    { id: 'SRC-007', name: 'Tile spacers · 3mm', status: 'priced', stage_entered_at: ms(1), created_at: ago(14), assigned_staff_id: 'ST04',
      requests: [ask({ d: 14, cid: 'C002', name: 'Kyaligonza & Sons', qty: 50 }), ask({ d: 9, cid: 'C004', name: 'Lubowa Builders', qty: 30 })],
      candidates: [cand({ id: 'K4', sid: 'S005', name: 'Katwe Fabricators', role: 'importer', tiers: [{ minQty: 1, price: 3500 }, { minQty: 100, price: 3000 }], packQty: 100, packUnit: 'bag', lead: 7, d: 2 }),
        cand({ id: 'K5', sid: 'S001', name: 'Namanve Sheets', tiers: [{ minQty: 1, price: 3800 }], d: 1 }), { kind: 'rival', name: 'Nakasero Hardware', price: 5000, stock: 'In stock', area: 'Nakasero', how: 'visit', seenAt: ago(2) }, { kind: 'rival', name: 'Kisenyi Hw', price: 4800, stock: 'Low stock', area: 'Kisenyi', how: 'tag', seenAt: ago(5) }] },
    { id: 'SRC-008', name: 'Roofing screws · with washer', status: 'listed', stage_entered_at: ms(5), created_at: ago(30), product_id: 'P010', graduated_at: ago(5),
      requests: [ask({ d: 30, cid: 'C003', name: 'Mukono Roofing', qty: 500 }), ask({ d: 25, cid: 'C001', name: 'Kato Construction', qty: 300 })], candidates: [cand({ id: 'K6', sid: 'S003', name: 'Kiseka Steel', tiers: [{ minQty: 1, price: 150 }], d: 20 })] },
    { id: 'SRC-009', name: 'Mortice lock · 3 lever', status: 'asked', stage_entered_at: ms(0, 3), created_at: ago(0, 3), voided: true, dropped_reason: 'No supplier found', dropped_at: ago(20),
      requests: [ask({ d: 40, cid: 'C002', name: 'Kyaligonza & Sons', qty: 6 })], candidates: [] },
    { id: 'DRP-2402-1-P003', name: 'Hinges · butt 4”', status: 'asked', stage_entered_at: ms(0, 5), created_at: ago(0, 5),
      requests: [ask({ h: 5, cid: 'C006', name: 'Nansana Hardware', phone: '0772000111', qty: 24, source: 'dropped', orderId: 2402, extra: { productId: 'P003', sellPrice: 2600, reason: 'Nobody has it', unit: 'pc' } })], candidates: [] },
  ].map(l => s({ voided: false, image: null, variant_attrs: [], notes: null, product_id: null, graduated_at: null, dropped_reason: null, dropped_at: null, assigned_staff_id: null, ...l }));
  const price = (id, pid, sid, tiers, date, src, extra) => s({ id, product_id: pid, variant_idx: null, supplier_id: sid, wholesale: null, retail: tiers[0].price, date, unit: 'pc', pack_unit: '', pack_qty: 0, pieces_per_unit: null, price_source: src || 'manual', out_of_stock: false, supplier_sku: null, out_of_stock_since: null, last_asked_at: null, tiers, ...(extra || {}) });
  window.SX_FIXTURE = {
    userId: ME,
    tables: {
      shop_members: [{ shop_id: SHOP, user_id: ME, role: 'sourcing', shops: { name: 'Mukasa Hardware' } }],
      role_tasks: ['sourcing.lead', 'product.edit', 'supplier.edit', 'price.list', 'price.confirm'].map(t => ({ role: 'sourcing', task: t })),
      app_settings: [s({ presets: { defaultMarkup: { wholesaleType: 'percent', wholesaleValue: 25, retailType: 'percent', retailValue: 35 }, priceReview: { perDay: 6, staleDays: 14 } } })],
      sourcing_leads: leads,
      suppliers: [
        s({ id: 'S001', name: 'Namanve Sheets', phone: '0772418903', location: 'Namanve', shop_no: 'B14' }),
        s({ id: 'S002', name: 'Nakawa Cement Depot', phone: '0701552908', location: 'Nakawa' }),
        s({ id: 'S003', name: 'Kiseka Steel', phone: '0772410220', location: 'Kiseka market', shop_no: '14' }),
        s({ id: 'S004', name: 'Owino Plumbing', phone: '0700000101', location: 'Owino' }),
        s({ id: 'S005', name: 'Katwe Fabricators', phone: '0700000202', location: 'Katwe' }),
        s({ id: 'S006', name: 'Ndeeba Timber Works', phone: '0700000303', location: 'Ndeeba' }),
      ],
      products: [
        s({ id: 'P001', name: 'Iron sheet G28 · 3m', type: 'simple', category: 'Roofing', wholesale_markup_type: 'percent', wholesale_markup_value: 0, retail_markup_type: 'percent', retail_markup_value: 0, variants: [] }),
        s({ id: 'P002', name: 'Ridge cap G28', type: 'simple', category: 'Roofing', wholesale_markup_type: 'percent', wholesale_markup_value: 0, retail_markup_type: 'percent', retail_markup_value: 0, variants: [] }),
        s({ id: 'P003', name: 'Hinges · butt 4”', type: 'simple', category: 'Doors', wholesale_markup_type: 'percent', wholesale_markup_value: 0, retail_markup_type: 'percent', retail_markup_value: 0, variants: [] }),
        s({ id: 'P004', name: 'Angle line · 40mm', type: 'simple', category: 'Steel', variants: [] }),
        s({ id: 'P005', name: 'Roofing nails 3”', type: 'simple', category: 'Fixings', variants: [] }),
        s({ id: 'P006', name: 'Binding wire · 20kg', type: 'simple', category: 'Steel', variants: [] }),
        s({ id: 'P007', name: 'Tororo cement 50kg', type: 'simple', category: 'Cement', variants: [] }),
        s({ id: 'P008', name: 'Hima cement 50kg', type: 'simple', category: 'Cement', variants: [] }),
        s({ id: 'P009', name: 'PPR pipe 20mm · 4m', type: 'simple', category: 'Plumbing', variants: [] }),
        s({ id: 'P010', name: 'Roofing screws · with washer', type: 'simple', category: 'Fixings', variants: [] }),
      ],
      prices: [
        price(1, 'P003', 'S001', [{ minQty: 1, price: 2100 }], day(58)),
        price(2, 'P004', 'S003', [{ minQty: 1, price: 22000 }], day(0), 'confirmed'),
        price(3, 'P005', 'S001', [{ minQty: 1, price: 7200 }], day(0), 'confirmed'),
        price(4, 'P006', 'S001', [{ minQty: 1, price: 98000 }], day(26)),
        price(5, 'P001', 'S003', [{ minQty: 1, price: 31400 }], day(21)),
        price(6, 'P002', 'S003', [{ minQty: 1, price: 14200 }], day(19)),
        price(7, 'P007', 'S002', [{ minQty: 1, price: 30800 }], day(18)),
        price(8, 'P008', 'S002', [{ minQty: 1, price: 31500 }], day(17)),
        price(9, 'P009', 'S004', [{ minQty: 1, price: 12000 }], day(16)),
        price(10, 'P010', 'S003', [{ minQty: 1, price: 150 }], day(5)),
      ],
      stock: ['P001', 'P002', 'P003', 'P004', 'P005', 'P006', 'P007', 'P008', 'P009'].map((k, i) => s({ key: k, product_id: k, qty: 10 + i })),
      saved_quotes: [
        s({ id: 2400, client_name: 'Nansana Hardware', client_phone: '0772000111', status: 'awaiting_goods', voided: false, date: day(12), payload: { customerId: 'C006', items: [{ productId: 'P001', qty: 10 }], droppedLines: [{ productName: 'Valley flashing · 3m', qty: 6, reason: 'Nobody has it', droppedAt: ms(12), at: 1 }] } }),
        s({ id: 2402, client_name: 'Nansana Hardware', client_phone: '0772000111', status: 'checking', voided: false, date: day(0), payload: { customerId: 'C006', items: [{ productId: 'P005', qty: 5 }], droppedLines: [{ productId: 'P003', productName: 'Hinges · butt 4”', qty: 24, unit: 'pc', sellPrice: 2600, reason: 'Nobody has it', droppedAt: now - 5 * 3600000, at: 1 }], supplierConfirms: { S001: { state: 'cant', note: 'out until next month' } } } }),
      ],
      follow_ups: [
        s({ id: 1, customer_id: 'C003', lead_id: 'SRC-008', qty: 500, created_at: ago(30), closed_at: null, payload: { contacts: [{ at: ago(4), reason: 'listed' }] } }),
        s({ id: 2, customer_id: 'C001', lead_id: 'SRC-008', qty: 300, created_at: ago(25), closed_at: null, payload: { contacts: [] } }),
      ],
      rival_prices: [s({ id: 1, product_id: 'P001', rival: 'Nakasero Hardware', price: 37500, seen_on: day(19), source: 'tag', in_stock: 'yes' })],
      customers: [
        s({ id: 'C001', name: 'Kato Construction', phone: '0772100100' }), s({ id: 'C002', name: 'Kyaligonza & Sons', phone: '0772200200' }), s({ id: 'C003', name: 'Mukono Roofing', phone: '0772300300' }),
        s({ id: 'C004', name: 'Lubowa Builders', phone: '0772400400' }), s({ id: 'C005', name: 'Ggaba Stores', phone: '0772500500' }), s({ id: 'C006', name: 'Nansana Hardware', phone: '0772000111' }),
      ],
      staff: [
        s({ id: 'ST01', name: 'Joseph Mukasa', role: 'owner' }), s({ id: 'ST02', name: 'Ruth Nakato', role: 'manager' }), s({ id: 'ST03', name: 'Denis Okello', role: 'buyer' }),
        s({ id: 'ST04', name: 'Moses Lubega', role: 'sourcing', user_id: ME }), s({ id: 'ST05', name: 'Grace Akello', role: 'sales', user_id: 'u-grace' }), s({ id: 'ST06', name: 'Brian Ouma', role: 'sales' }), s({ id: 'ST07', name: 'Faith Nambi', role: 'sales' }),
      ],
      agents: [s({ id: 'A01', name: 'Aisha Namutebi', phone: '0752000001' }), s({ id: 'A02', name: 'Peter Sserwadda', phone: '0752000002' })],
      agent_requests: [s({ id: 7002, agent_id: 'A02', kind: 'stock', words: 'Wall plug · 8mm', qty: 200, wanted: 'week', client_name: 'Lubowa Builders', status: 'open', created_at: ago(0, 2) })],
      product_links: [],
      decision_log: [
        s({ id: 'L1', at: new Date(now - 3 * 3600000).toISOString(), by: 'u-denis', by_name: 'Denis Okello', role: 'buyer', task: 'price.confirm', what: 'Angle line still 22,000', ref: { table: 'prices', id: 2 }, after: { how: 'phone' } }),
        s({ id: 'L2', at: new Date(now - 2 * 3600000).toISOString(), by: ME, by_name: 'Moses Lubega', role: 'sourcing', task: 'price.confirm', what: 'Roofing nails 6,900 → 7,200', ref: { table: 'prices', id: 3 }, after: { how: 'in person' } }),
      ],
      agent_feed_pins: [],
    },
  };
})();
