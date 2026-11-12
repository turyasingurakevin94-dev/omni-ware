#!/usr/bin/env node
'use strict';
/*
 * The Manager's real books (src/core/manager/supabase): sample rows, shaped as the tables hold them
 * (the columns of docs/spec/04-screens-manager-data.md §1), are read through a fake Supabase
 * (test/_fake-supabase.js) and become ManagerBooks with one Ask per open decision, built from where
 * its asker wrote it; each answer makes the call §2's "New app" column names, with its args; an
 * "already" is a clash, a function 0184 brings is refused MG-0184.
 *
 * Run: node test/manager-supabase.test.js
 */
const path = require('path');
const { ROOT, createReporter } = require('./_extract');
const { FakeDB } = require('./_fake-supabase');

const t = createReporter('manager supabase');
const { readSnapshot, readLive } = require(path.join(ROOT, 'src/core/manager/supabase/read.ts'));
const { booksOf, ctxOf } = require(path.join(ROOT, 'src/core/manager/supabase/rows.ts'));
const { managerWrites } = require(path.join(ROOT, 'src/core/manager/supabase/write.ts'));

const NOW = Date.parse('2026-10-17T06:40:00Z'); // 09:40 in Kampala
const MIN = 60000, H = 3600e3;
const iso = (ms) => new Date(ms).toISOString();
const SHOP = 'shop';
const S = { userId: 'u-ruth', shopId: SHOP, shopName: 'Mukasa Hardware', role: 'manager', name: 'Ruth Nakato', email: 'ruth@x', staffId: 'ruth' };

/* The fake has no .or(): the live filter's four ORs, as PostgREST reads them. */
function withOr(db) {
  const Q = Object.getPrototypeOf(db.client('x').from('x'));
  if (Q.or) return;
  const match = Q.match;
  Q.or = function or(expr) { this.ors = String(expr).split(',').map((p) => { const [c, op, ...v] = p.split('.'); return { c, op, v: v.join('.') }; }); return this; };
  Q.match = function m(r) {
    if (!match.call(this, r)) return false;
    if (!this.ors) return true;
    return this.ors.some((o) => {
      const v = r[o.c], w = o.v === 'true' ? true : o.v === 'false' ? false : o.v;
      return o.op === 'neq' ? v !== w : o.op === 'eq' ? !!v === w : o.op === 'gte' ? v != null && String(v) >= w : false;
    });
  };
}

const q = (id, status, payload, more = {}) => ({ shop_id: SHOP, id, status, invoiced: false, voided: false, amount_paid: 0, date: '2026-10-17', client_name: payload.client ? payload.client.name : 'Kato Construction', client_phone: null, qa: false, payload: { createdAt: iso(NOW - 3 * H), takenBy: 'u-grace', ...payload }, ...more });
const line = (productId, qty, price, sellPrice, more = {}) => ({ lineId: `${productId}-${qty}`, productId, variantIdx: null, productName: { p1: 'Cement 50 kg', p2: 'Iron sheet G28', p3: 'Wall plugs' }[productId], qty, unit: 'bag', price, sellPrice, supplierId: 's1', ...more });

function seed() {
  const rpcLog = [];
  const db = new FakeDB({ rpcs: {} });
  withOr(db);
  const tables = {
    staff: [
      { id: 'ruth', name: 'Ruth Nakato', user_id: 'u-ruth', role: 'manager' }, { id: 'grace', name: 'Grace Akello', user_id: 'u-grace', role: 'sales' },
      { id: 'musa', name: 'Musa Kiggundu', user_id: 'u-musa', role: 'store' }, { id: 'denis', name: 'Denis Okello', user_id: 'u-denis', role: 'buyer' },
      { id: 'ssali', name: 'Ssali', user_id: null, role: 'driver' }, { id: 'hassan', name: 'Hassan', user_id: null, role: 'driver', unavailable: true },
    ],
    shop_members: [
      { user_id: 'u-ruth', role: 'manager', display_name: 'Ruth Nakato' }, { user_id: 'u-grace', role: 'sales', display_name: 'Grace Akello' },
      { user_id: 'u-musa', role: 'store', display_name: 'Musa Kiggundu' }, { user_id: 'u-denis', role: 'buyer', display_name: 'Denis Okello' },
      { user_id: 'u-esther', role: 'accounts', display_name: 'Esther Auma' },
    ],
    products: [
      { id: 'p1', name: 'Cement 50 kg', wholesale_markup_type: 'percent', wholesale_markup_value: 25, variants: [] },
      { id: 'p2', name: 'Iron sheet G28', variants: [] }, { id: 'p3', name: 'Wall plugs', variants: [] },
    ],
    prices: [
      { id: 1, product_id: 'p1', variant_idx: null, supplier_id: 's1', wholesale: 34000, retail: null, unit: 'bag' },
      { id: 2, product_id: 'p2', variant_idx: null, supplier_id: 's1', wholesale: 38000, retail: 39000, unit: 'sht' },
      { id: 3, product_id: 'p3', variant_idx: null, supplier_id: 's1', wholesale: 1500, retail: 1600, unit: 'pack' },
    ],
    stock: [{ key: 'p1', qty: 26 }, { key: 'p3', qty: 10 }],
    stock_lots: [{ id: 1, key: 'p1', qty: 26, cost: 34000 }, { id: 2, key: 'p3', qty: 10, cost: 1500 }],
    app_settings: [{ presets: { defaultMarkup: { wholesaleType: 'percent', wholesaleValue: 20 }, creditHold: { days: 21 }, orderStageLimits: { draft: 120, preparing: 90 } } }],
    suppliers: [{ id: 's1', name: 'Owino' }],
    customers: [
      { id: 'kato', name: 'Kato Construction', phone: '0772418220', location: 'Ntinda', debt: 438000, credit_limit: 3000000, terms_days: 14 },
      { id: 'lubowa', name: 'Lubowa Builders', phone: '0701225640', debt: 662000, credit_limit: 1500000, terms_days: 21 },
      { id: 'ggaba', name: 'Ggaba Stores', phone: '0772418330', debt: 0, credit_limit: null, terms_days: null },
      { id: 'gaba', name: 'Gaba Stores', phone: '+256 772 418 330', debt: 0, credit_limit: null, terms_days: null },
    ],
    customer_debt_log: [
      { id: 1, customer_id: 'lubowa', date: '2026-09-01', type: 'charge', amount: 662000, quote_id: null, cash_txn_id: null, note: 'Opening' },
    ],
    saved_quotes: [
      q(538, 'completed', { customerId: 'kato', items: [line('p1', 10, 34000, 43800)] }, { invoiced: true, invoiced_at: '2026-10-13', invoiced_ts: iso(NOW - 4 * 24 * H) }),
      // D-3: the cost went up under a typed price (now under cost).
      q(552, 'draft', { customerId: 'kato', items: [line('p1', 1, 34000, 42500), line('p2', 10, 38000, 30000, { priceWas: 24000 })] }),
      // D-1: Grace's price under the shop's, tagged.
      q(555, 'draft', { client: { name: 'Lubowa Builders' }, customerId: 'lubowa', items: [line('p1', 1, 34000, 40000, { priceBy: 'u-grace', priceNote: 'under', priceAt: iso(NOW - 65 * MIN) })] }),
      // D-2: no cost, no price, untagged: the app spots it.
      q(562, 'draft', { client: { name: 'Walk-in' }, items: [line('p3', 5, 0, null)] }),
      // D-4: a counter sale, the customer at the counter.
      q(570, 'draft', { client: { name: 'Walk-in' }, counter: true, items: [line('p1', 2, 34000, 40000, { priceBy: 'u-grace', priceNote: 'under', priceAt: iso(NOW - 3 * MIN) })] }),
      // D-5: Kato would owe more than the limit.
      q(553, 'draft', { customerId: 'kato', items: [line('p1', 100, 34000, 42500)] }),
      // A credit hold already answered: no ask.
      q(557, 'draft', { customerId: 'kato', items: [line('p1', 100, 34000, 42500)], creditCheck: { decision: 'release', by: 'u-ruth', at: NOW - H } }),
      // D-7: the Store asks, Ssali's truck waiting.
      q(554, 'preparing', { client: { name: 'Ggaba Stores' }, customerId: 'ggaba', items: [line('p1', 10, 34000, 43000)], creditAsk: { at: iso(NOW - 25 * MIN), by: 'u-musa', byName: 'Musa', carrier: { name: 'Ssali' } } }),
      // D-12: packed short.
      q(550, 'preparing', { items: [line('p2', 40, 38000, 47500, { pickStatus: 'short', pickedQty: 36 })], pickingStatus: 'done', pickingDoneAt: NOW - 40 * MIN, assignedWorkerId: 'musa' }),
      // D-9: billed itself? under 1,000: held.
      q(561, 'completed', { items: [line('p3', 1, 0, 567)], deliveredAt: iso(NOW - 30 * H) }),
      // D-10: a line at 0 with no why.
      q(563, 'completed', { items: [line('p3', 2, 1500, 0)], deliveredAt: iso(NOW - 2 * H) }),
      // D-22: Peter asks for fewer.
      q(560, 'awaiting_goods', { client: { name: 'Mukono Roofing' }, originAgentName: 'Peter Sserwadda', items: [line('p1', 20, 34000, 42500)], agentChange: { at: iso(NOW - 35 * MIN), state: 'asked', lines: [{ productId: 'p1', variantIdx: null, to: 12 }] } }, { agent_id: 'ag1', amount_paid: 300000 }),
      q(547, 'completed', { client: { name: 'Lubowa Builders' }, customerId: 'lubowa', items: [line('p1', 20, 34000, 42500)] }, { invoiced: true, invoiced_ts: iso(NOW - 25 * 24 * H) }),
      q(545, 'completed', { customerId: 'kato', items: [line('p1', 8, 34000, 40000)], dupOkWith: [544] }, { invoiced: true, invoiced_ts: iso(NOW - 20 * H), amount_paid: 50000 }),
      q(556, 'draft', { client: { name: 'Nansana Hardware' }, items: [line('p1', 3, 34000, 42500)] }),
      // A test order: in no figure.
      q(900, 'draft', { items: [line('p1', 1, 34000, 1000)] }, { qa: true }),
    ],
    collection_trips: [
      { id: 'trip-1009', supplier_id: 's1', status: 'confirmed', assigned_worker_id: 'denis', voided: false, yard_checked_at: iso(NOW - 30 * MIN), yard_checked_by: 'u-musa', difference_accepted_at: null,
        lines: [{ productId: 'p1', productName: 'Cement 50 kg', qty: 20, gotQty: 20, yardQty: 20, expectedPrice: 34000, unit: 'bag' }, { productId: 'p2', productName: 'PVC pipe 4 in', qty: 12, gotQty: 12, yardQty: 11, expectedPrice: 28000, unit: 'pcs' }] },
      { id: 'trip-1008', supplier_id: 's1', status: 'confirmed', voided: false, yard_checked_at: iso(NOW - 3 * H), difference_accepted_at: iso(NOW - 2 * H), lines: [{ productId: 'p1', qty: 5, gotQty: 5, yardQty: 4 }] },
    ],
    buyer_handoffs: [{ id: 'bh-12', kind: 'yard_note', for_role: 'manager', status: 'open', ref: 'trip-1009', payload: { tripId: 'trip-1009', words: '12 went on the truck at Owino.' }, created_by: 'u-denis', created_at: iso(NOW - 29 * MIN) }],
    store_asks: [{ id: 'sa-9', kind: 'extra', status: 'sent', ref: 'trip-1009', asked_by: 'u-musa', asked_by_name: 'Musa', created_at: iso(NOW - 20 * MIN), payload: { tripId: 'trip-1009', supplierId: 's1', key: 'p1', productId: 'p1', variantIdx: null, name: 'Cement 50 kg', qty: 2, unit: 'bags', why: 'Extra on the truck' } }],
    stock_reports: [
      { id: 'sr-31', key: 'p1', product_id: 'p1', variant_idx: null, name: 'Cement 50 kg', qty: 3, why: 'damaged', note: 'Broken', reported_by: 'u-musa', status: 'sent', created_at: '2026-10-17T05:10:12Z', photo_path: 'p/31.jpg' },
      { id: 'sr-32', key: 'p3', product_id: 'p3', variant_idx: null, name: 'Wall plugs', qty: 1, why: 'lost', note: '', reported_by: 'u-musa', status: 'sent', created_at: '2026-10-17T05:10:40Z' },
      { id: 'sr-33', key: 'p3', product_id: 'p3', variant_idx: null, name: 'Wall plugs', qty: 2, why: 'stolen', note: '', reported_by: 'u-musa', status: 'sent', created_at: '2026-10-17T06:00:00Z' },
    ],
    stock_counts: [
      { id: 'sc-14', aisle: 'Aisle B', counted_by: 'u-musa', counted_by_name: 'Musa', status: 'sent', created_at: iso(NOW - 10 * MIN), lines: [{ productId: 'p1', name: 'Cement 50 kg', system: 30, counted: 28 }] },
      { id: 'sc-13', aisle: 'Aisle A', counted_by: 'u-musa', status: 'accepted', created_at: iso(NOW - 24 * H), lines: [] },
    ],
    invoice_asks: [
      { id: 'ia-547', quote_id: 547, customer_id: 'lubowa', kind: 'credit', lines: [{ idx: 0, qty: 5 }], amount: 212500, reason: 'Something else', note: '5 too many', asked_by: 'u-grace', status: 'sent', created_at: iso(NOW - 3 * H) },
      { id: 'ia-545', quote_id: 545, customer_id: 'kato', kind: 'void', lines: [], amount: 320000, reason: 'Entered twice', note: '', asked_by: 'u-esther', status: 'sent', created_at: iso(NOW - 2 * H) },
      { id: 'ia-999', quote_id: 9999, kind: 'void', status: 'sent', created_at: iso(NOW) },
    ],
    cancel_asks: [{ id: 'ca-556', quote_id: 556, why: 'Changed their mind', note: 'changed their mind', amount: 127500, asked_by: 'u-grace', status: 'sent', created_at: iso(NOW - 50 * MIN) }],
    restock_buys: [
      { id: 'rb-77', product_id: 'p3', variant_idx: null, qty: 199, unit: 'pack', price: 1500, status: 'held', for_line: '563:p3-2', held_by: null, created_by: 'u-denis', created_at: iso(NOW - 15 * MIN) },
      { id: 'rb-80', product_id: 'p1', variant_idx: null, qty: 40, unit: 'bag', price: 34000, status: 'planned', created_by: 'u-denis', created_at: iso(NOW - H) },
      { id: 'rb-82', product_id: 'p2', variant_idx: null, qty: 30, unit: 'pcs', price: 27000, status: 'held', held_by: 'u-ruth', created_by: 'u-denis', created_at: iso(NOW - H) },
    ],
    payment_asks: [],
    payment_promises: [{ id: 4, customer_id: 'lubowa', promised_on: '2026-10-19', made_on: '2026-10-15', amount: 662000 }],
    manager_notes: [{ id: 'g-grace', kind: 'target', status: 'open', date: '2026-10-01', body: { who: 'u-grace', metric: 'sales', aim: 35000000, from: '2026-10-01', to: '2026-10-31' } }],
    fresh_starts: [{ old_debts: { ggaba: 290000 }, confirmed: {}, made_at: '2026-10-01T08:00:00Z' }],
    decision_log: [
      { id: 1, task: 'customer.edit', ref: { apart: ['lubowa', 'zzz'] }, created_at: iso(NOW - 40 * 24 * H) },
      { id: 2, task: 'invoice.make', what: 'Invoiced INV-0546 for Kato, 24 hours after delivery', amount: 24000, by: null, role: 'auto', ref: { table: 'saved_quotes', id: 546 }, created_at: iso(NOW - 70 * MIN) },
    ],
    cash_txns: [
      { id: 1, date: '2026-10-17', type: 'receipt', account: 'cash', amount: 100000 },
      { id: 2, date: '2026-10-17', type: 'receipt', account: 'momo', amount: 50000 },
      { id: 3, date: '2026-10-17', type: 'receipt', account: 'cash', amount: 999999, qa: true },
    ],
  };
  Object.entries(tables).forEach(([k, rows]) => db.seed(k, rows.map((r) => ('shop_id' in r ? r : { shop_id: SHOP, ...r }))));
  // ow_patch_order (0165:463): the keys merged, p_drop dropped, the status set; the row back.
  db.rpcs.ow_patch_order = (a) => {
    const r = db.tables.saved_quotes.find((x) => Number(x.id) === Number(a.p_id));
    r.payload = { ...r.payload, ...a.p_patch };
    (a.p_drop || []).forEach((k) => { delete r.payload[k]; });
    if (a.p_status) r.status = a.p_status;
    return JSON.parse(JSON.stringify(r));
  };
  const rec = (name, data = { ok: true }) => { db.rpcs[name] = (a) => { rpcLog.push({ name, args: a }); return typeof data === 'function' ? data(a) : data; }; };
  ['set_product_markup', 'invoice_order', 'accept_trip_difference', 'answer_store_ask', 'write_off_stock', 'dismiss_stock_report', 'accept_stock_count', 'ask_recount',
    'hold_restock_buy', 'refuse_restock_buy', 'raise_credit_note', 'decide_invoice_ask', 'void_invoice', 'answer_cancel_ask', 'cancel_order', 'merge_customers',
    'set_opening_balance', 'set_person_goal', 'set_shop_preset', 'tell_customer_change'].forEach((n) => rec(n));
  rec('next_row_id_blocks', (a) => ({ [a.p_kinds[0]]: 5 }));
  return { db, rpcLog, sb: db.client('ruth'), rec };
}

(async () => {
  const { db, rpcLog, sb, rec } = seed();
  const raw = await readSnapshot(sb, S, NOW);
  const b = booksOf(raw, S, NOW);
  const ask = (key) => b.asks.find((a) => a.key === key);
  const keys = b.asks.map((a) => a.key).sort();

  /* ---- reads ---- */
  t.check(raw.quotes.length === 16 && raw.storeAsks.length === 1 && raw.invoiceAsks.length === 3, 'one snapshot reads the orders, the queues and R30 store_asks');
  t.check(raw.cash.length === 3 && b.inToday.cash === 100000 && b.inToday.momo === 50000 && b.inToday.bank === 0, 'money in today, by account, the test row left out');
  t.check(raw.counts.length === 2 && raw.reports.length === 3 && raw.restock.length === 3, 'counts (newest 40), reports sent, restock planned or held');

  /* ---- each ask, from where its asker wrote it ---- */
  const up = ask('price:552:1');
  t.check(up && up.mode === 'up' && up.costWas === 24000 && up.asked === 30000 && up.askerId === null, 'D-3: a cost gone up under a typed price → price up, the cost it had');
  t.check(!ask('price:552:0'), 'a line at its typed price above cost waits on nobody');
  const under = ask('price:555:0');
  t.check(under && under.mode === 'under' && under.asked === 40000 && under.askerId === 'grace' && under.at === NOW - 65 * MIN, 'D-1: Grace\'s tagged price under the shop\'s → under, asked by Grace');
  const coming = ask('price:562:0');
  t.check(coming && coming.mode === 'coming' && coming.askerId === null, 'D-2: no cost, no price, untagged → coming, the app spotted it');
  const counter = ask('counter:570:0');
  t.check(counter && counter.kind === 'counter' && counter.standing && counter.asked === 40000 && !ask('price:570:0'), 'D-4: a counter sale is a counter ask, standing');
  const cr = ask('credit:553');
  t.check(cr && cr.why === 'limit' && cr.askerId === 'grace', 'D-5: over the limit → credit, why limit, asked by the seller');
  t.check(!ask('credit:557'), 'a hold Ruth already released waits no more');
  const sc = ask('storecredit:554');
  t.check(sc && sc.standing && sc.carrier === 'Ssali' && sc.askerId === 'musa' && !ask('credit:554'), 'D-7: the Store\'s creditAsk → storecredit, standing, Ssali\'s truck, Musa');
  const sh = ask('short:550');
  t.check(sh && sh.askerId === 'musa' && sh.orderId === 550, 'D-12: packed short, not settled → short, Musa');
  const bill = ask('bill:561');
  t.check(bill && bill.code === 'OWSML' && b.orders.find((o) => o.id === 561).heldCode === 'OWSML', 'D-9: delivered 30 h ago under 1,000 → the bill held OWSML (worked out: the row does not say)');
  const given = ask('given:563');
  t.check(given && given.idxs.join() === '0' && b.orders.find((o) => o.id === 563).lines[0].price === 0, 'D-10: a line at 0 with no why → given; its price is 0, not the shop\'s');
  const ag = ask('agent:560');
  t.check(ag && !ag.cancel && ag.lines.length === 1 && ag.lines[0].from === 20 && ag.lines[0].to === 12 && ag.askerId === 'agent:ag1', 'D-22: the agent\'s fewer → agent, 20 → 12, asked by the agent');
  const ci = ask('checkin:trip-1009');
  t.check(ci && ci.runnerId === 'denis' && ci.askerId === 'musa' && ci.lines.length === 2 && ci.lines[1].brought === 12 && ci.lines[1].counted === 11 && ci.lines[1].place === 'Owino', 'D-13: the yard counted 11 of 12 → checkin, Musa checked, Denis ran it');
  t.check(ci && ci.note && ci.note.handoffId === 'bh-12' && /12 went/.test(ci.note.text), 'D-14: the Buyer\'s open yard note rides on the check-in');
  t.check(!ask('checkin:trip-1008'), 'a difference accepted already waits no more');
  const ex = ask('extra:sa-9');
  t.check(ex && ex.tripId === 'trip-1009' && ex.qty === 2 && ex.onList === 20 && ex.cost === 34000 && ex.from === 'Owino' && ex.askerId === 'musa', 'D-15: store_asks extra → extra, 2 on 20 listed, at the trip\'s cost');
  const losses = b.asks.filter((a) => a.kind === 'loss');
  t.check(losses.length === 2 && losses.find((a) => a.key === 'loss:sr-31').reports.length === 2, 'D-16: reports grouped per reporter and minute (sr-31 + sr-32; sr-33 apart)');
  const r31 = losses.find((a) => a.key === 'loss:sr-31').reports[0];
  t.check(r31.cost === 34000 && r31.shelf === 26 && r31.unit === 'bag' && r31.photo === 'p/31.jpg' && r31.why === 'damaged', 'a loss line: shelf cost (FIFO), on the shelf, its unit and photo');
  const cnt = ask('count:sc-14');
  t.check(cnt && cnt.aisle === 'Aisle B' && cnt.lines[0].system === 30 && cnt.lines[0].counted === 28 && cnt.lines[0].cost === 34000 && !ask('count:sc-13'), 'D-17: a count sent → count; an accepted one is not');
  const ret = ask('return:ia-547'), vd = ask('void:ia-545');
  t.check(ret && ret.lines[0].qty === 5 && ret.amount === 212500 && ret.askerId === 'grace' && vd && vd.amount === 320000 && vd.reason === 'Entered twice', 'D-18, D-19: invoice_asks → return and void');
  t.check(!b.asks.some((a) => a.key === 'void:ia-999'), 'an ask on an order not in the books is left out');
  const cx = ask('cancel:ca-556');
  t.check(cx && cx.why === 'Changed their mind' && cx.askerId === 'grace' && cx.orderId === 556, 'D-20: cancel_asks → cancel');
  const ct = ask('carton:rb-77');
  t.check(ct && ct.forOrder === 2 && ct.forShelf === 199 && ct.cost === 1500 && ct.orderId === 563 && ct.askerId === 'denis', 'D-24: a held restock line for an order line → carton');
  t.check(b.restock.length === 2 && b.restock.find((r) => r.id === 'rb-82').held && !b.restock.some((r) => r.id === 'rb-77'), 'D-23: the restock list, less the carton that waits');
  t.check(!keys.some((k) => /:900/.test(k)) && !b.orders.some((o) => o.id === 900), 'a test order is in no ask and no list');
  t.check(b.asks.every((a) => /^[a-z]+:/.test(a.key) && typeof a.at === 'number'), 'every key is <kind>:<id>, every ask has its moment');

  /* ---- the orders, the customers, the team, the shop ---- */
  const o552 = b.orders.find((o) => o.id === 552);
  t.check(o552.sellerId === 'grace' && o552.lines[1].buying === 'up' && o552.lines[0].markup === 0.25 && o552.lines[0].shopPrice === 42500 && o552.total === 342500, 'an order: the seller\'s staff id, the line\'s markup and shop price, the total');
  t.check(b.orders.find((o) => o.id === 550).holderId === 'musa' && b.orders.find((o) => o.id === 550).lines[0].packed === 36, 'the packer holds it; packed 36');
  t.check(b.orders.find((o) => o.id === 545).twinOk.join() === '544' && b.orders.find((o) => o.id === 545).invoiceNo === 'INV-0545', 'Both are real (dupOkWith), the invoice number');
  const kato = b.customers.find((c) => c.id === 'kato'), ggaba = b.customers.find((c) => c.id === 'ggaba'), lub = b.customers.find((c) => c.id === 'lubowa');
  t.check(kato.limit === 3000000 && kato.owes === 438000 && kato.bills.some((x) => x.orderId === 538) && kato.sellers[0] === 'grace', 'a customer: limit, owes, bills from the invoices, who sells to them');
  t.check(lub.bills.some((x) => x.orderId === 0 && x.left === 662000) && lub.promises[0].state === 'open', 'the opening balance is bill 0; a promise and its state');
  t.check(ggaba.limit === null && ggaba.lookAlike && ggaba.lookAlike.id === 'gaba' && ggaba.lookAlike.why === 'phone' && ggaba.oldBooks.amount === 290000, 'no limit = null; a look-alike by phone; the old books after a fresh start');
  const grace = b.team.find((p) => p.id === 'grace'), me = b.me, ssali = b.team.find((p) => p.id === 'ssali'), hassan = b.team.find((p) => p.id === 'hassan');
  t.check(me.id === 'ruth' && me.tint === 'me' && grace.goal === 35000000 && grace.goalNoteId === 'g-grace' && grace.role === 'sales', 'me, and Grace with her goal');
  t.check(ssali.role === 'driver' && ssali.userId === null && hassan.off && hassan.holds === 'Off', 'a driver with no login; one off today');
  t.check(b.team.some((p) => p.id === 'user:u-esther' && p.role === 'accounts') && b.team.some((p) => p.id === 'agent:ag1' && p.role === 'agent'), 'a member with no staff card; the agent who asks');
  t.check(b.shop.holdDays === 21 && b.shop.stageLimits.draft === 120 && b.shop.stageLimits.preparing === 90 && b.shop.defaultMarkup === 0.2 && b.shop.goal === 35000000, 'the shop: hold days, stage limits, default markup, goal');
  t.check(b.done.length === 1 && b.done[0].auto && b.done[0].sub === '#0546 · 24,000', 'today\'s answers from the log; the run\'s is auto');

  /* ---- live: the orders that can change and every queue, over the last ---- */
  db.tables.stock_reports.push({ shop_id: SHOP, id: 'sr-50', key: 'p1', product_id: 'p1', name: 'Cement 50 kg', qty: 1, why: 'damaged', reported_by: 'u-musa', status: 'sent', created_at: iso(NOW) });
  db.tables.invoice_asks.find((a) => a.id === 'ia-545').status = 'accepted';
  db.tables.saved_quotes.find((r) => r.id === 555).payload.items[0].priceReview = { state: 'approved', price: 40000, qty: 1 };
  const live = await readLive(sb, S, raw, NOW + MIN);
  const lb = booksOf(live, S, NOW + MIN);
  t.check(lb.asks.some((a) => a.key === 'loss:sr-50') && !lb.asks.some((a) => a.key === 'void:ia-545') && !lb.asks.some((a) => a.key === 'price:555:0'), 'live re-reads every queue and the orders that change (§1d\'s gap closed)');
  t.check(live.quotes.length === raw.quotes.length && live.quotes.some((r) => r.id === 538), 'an invoiced order out of the live filter is kept from the last read');

  /* ---- writes ---- */
  const ctx = ctxOf(raw, S, NOW);
  const W = managerWrites({ sb, s: S, ctx: () => ctx });
  const last = () => rpcLog[rpcLog.length - 1];
  const patches = () => db.log.filter((x) => x.kind === 'rpc' && x.name === 'ow_patch_order');
  const lastPatch = () => patches()[patches().length - 1].args;
  const kind = async (p) => { try { await p; return 'ok'; } catch (e) { return e.kind + (e.code ? ':' + e.code : ''); } };

  await W.price(552, 1, 39000, 'set');
  let p = lastPatch(), it = p.p_patch.items[1];
  t.check(Object.keys(p.p_patch).join() === 'items' && it.sellPrice === 39000 && it.priceReview.state === 'changed' && it.priceReview.was === 30000 && it.priceReview.by === 'u-ruth', 'W1 price: only items, sellPrice and priceReview, by the login');
  t.check(db.tables.decision_log.some((l) => l.task === 'price.approve' && l.by === 'u-ruth'), 'W44: the price is logged from the phone (no function logs it)');
  t.check(await kind(W.price(552, 1, 39000, 'set')) === 'clash', 'the same price answered again → clash "Someone else just did this"');
  t.check(await kind(W.price(570, 0, 30000, 'set')) === 'refused:OWCST', 'under cost → refused OWCST');
  t.check(await kind(W.price(555, 0, 41000, 'set')) === 'clash', 'a price another phone answered (live above) → clash');
  await W.price(570, 0, 0, 'approved');
  it = lastPatch().p_patch.items[0];
  t.check(it.sellPrice === 40000 && it.priceReview.state === 'approved' && it.priceReview.price === 40000, 'W6 the counter yes approves the asked price');
  await W.costAndPrice(562, 0, 1500, 2000);
  it = lastPatch().p_patch.items[0];
  t.check(it.price === 1500 && it.costBy.source === 'manager' && it.sellPrice === 2000 && it.priceReview.price === 2000, 'W4 the cost first, then the price');
  await W.markup('p1', 0.3);
  t.check(last().name === 'set_product_markup' && last().args.p_fields.wholesaleMarkupValue === 30 && last().args.p_fields.wholesaleMarkupType === 'percent', 'W40 set_product_markup, 30%');

  await W.credit(553, true, { limit: 5000000, days: 14 });
  const cust = db.tables.customers.find((c) => c.id === 'kato');
  p = lastPatch();
  t.check(cust.credit_limit === 5000000 && cust.terms_days === 14 && p.p_patch.creditCheck.decision === 'release' && !('creditAsk' in p.p_patch), 'W8 the limit, then creditCheck release (no creditAsk sent for a hold)');
  t.check(await kind(W.credit(557, false, null)) === 'clash', 'a hold answered already → clash');
  await W.storeCredit(554, false, null);
  p = lastPatch();
  t.check(p.p_patch.creditAsk.answer.decision === 'cash' && p.p_patch.creditCheck.ask === true && p.p_patch.creditCheck.decision === 'cash', 'W9 the Store\'s ask: Cash first on creditAsk.answer and creditCheck');
  db.rpcs.answer_customer_ask = undefined;
  t.check(await kind(W.limitAsk('cq-4', true, null)) === 'refused:MG-0184', 'D-32 limitAsk: no function before 0184 → refused MG-0184');
  t.check(await kind(W.nudge('grace', 552, 'Call Kato')) === 'refused:MG-0184', 'nudge: no nudge_person before 0184 → refused MG-0184');
  rec('nudge_person');
  await W.nudge('grace', 552, 'Call Kato');
  t.check(last().name === 'nudge_person' && last().args.p_to === 'u-grace' && last().args.p_order === 552, 'nudge_person, to Grace\'s login, once it exists');

  await W.invoiceNow(561);
  t.check(last().name === 'invoice_order' && last().args.p_quote_id === 561 && last().args.p_shop_id === SHOP, 'W11 invoice_order');
  await W.givenAway(563, [0], 'Sample');
  t.check(lastPatch().p_patch.items[0].givenAway.why === 'Sample' && last().name === 'invoice_order' && last().args.p_quote_id === 563, 'W13 given away, then invoiced');
  await W.settlePick(550, false);
  p = lastPatch();
  t.check(p.p_patch.items[0].qty === 36 && p.p_patch.pickSettle.pick === 'went' && !('pickShortfallAckAt' in p.p_patch), 'W14 bill what went: the qty to 36, pickSettle');
  t.check(await kind(W.settlePick(550, true)) === 'clash', 'settled already → clash');

  await W.takeCheckin('trip-1009', 'bh-12');
  t.check(rpcLog.some((x) => x.name === 'accept_trip_difference' && x.args.p_trip_id === 'trip-1009') && db.tables.buyer_handoffs[0].status === 'done', 'W15 + W16: the difference taken, the note seen');
  rec('accept_trip_difference', { ok: true, already: true });
  t.check(await kind(W.takeCheckin('trip-1009', null)) === 'clash', '{already: true} → clash');
  await W.extra('sa-9', true);
  t.check(last().name === 'answer_store_ask' && last().args.p_status === 'accepted' && last().args.p_note === null, 'W17 answer_store_ask accepted');
  await W.writeOff(['sr-31'], ['sr-32']);
  const wo = rpcLog.find((x) => x.name === 'write_off_stock');
  t.check(wo && wo.args.p_report_ids.join() === 'sr-31' && wo.args.p_lines[0].delta === -3 && wo.args.p_lines[0].cost === 34000 && wo.args.p_lines[0].report === 'sr-31' && last().name === 'dismiss_stock_report' && last().args.p_id === 'sr-32', 'W18 write_off_stock the ticked, W19 dismiss_stock_report the kept');
  await W.countTaken('sc-14');
  t.check(last().name === 'accept_stock_count' && last().args.p_id === 'sc-14', 'W20 accept_stock_count');
  t.check(await kind(W.countAgain('sc-13')) === 'clash', 'W21 a count decided already: re-read, clash (ask_recount says nothing)');
  await W.countAgain('sc-14');
  t.check(last().name === 'ask_recount', 'W21 ask_recount');
  await W.carton('rb-77', false);
  t.check(last().name === 'refuse_restock_buy' && last().args.p_id === 'rb-77', 'W30 Order only: refuse_restock_buy');
  await W.carton('rb-77', true);
  t.check(last().name === 'hold_restock_buy' && last().args.p_hold === false, 'W30 Shelf part OK: hold_restock_buy(false)');
  db.rpcs.hold_restock_buy = () => { throw new Error('x'); };
  db.hook((op) => (op.kind === 'rpc' && op.name === 'hold_restock_buy' ? { error: { code: 'OWRST', message: 'OWRST: That line is cancelled already' } } : undefined));
  t.check(await kind(W.restock('rb-80', true)) === 'clash', 'OWRST (the line moved on) → clash');

  await W.creditNote('ia-547', 547, [{ idx: 0, qty: 5, back: true }], false);
  t.check(last().name === 'raise_credit_note' && last().args.p_lines[0].restock === true && last().args.p_ask === 'ia-547' && last().args.p_reason === 'Something else' && last().args.p_cash_back === false, 'W22 raise_credit_note, one write (0176)');
  await W.voidBill('ia-545', 545, 'Entered twice', { how: 'refund', account: 'momo' });
  t.check(last().name === 'void_invoice' && last().args.p_restock === true && last().args.p_choice === 'refund' && last().args.p_account === 'momo' && last().args.p_ask === 'ia-545', 'W24 void_invoice, one write, the money refunded');
  await W.voidBill('ia-545', 545, 'Wrong customer', { how: 'deposit' });
  t.check(last().args.p_restock === false && last().args.p_choice === 'deposit', 'a wrong customer keeps the goods out; money kept as a deposit');
  await W.keepBilled('ia-545');
  t.check(last().name === 'decide_invoice_ask' && last().args.p_status === 'declined', 'W23 decide_invoice_ask declined');
  await W.cancel('ca-556', 556, null);
  t.check(last().name === 'answer_cancel_ask' && last().args.p_yes === true && last().args.p_choice === null, 'W25 answer_cancel_ask yes');
  await W.keepOrder('ca-556', 'They still want it');
  t.check(last().args.p_yes === false && last().args.p_note === 'They still want it', 'W25 no, with her words (§5 Q9)');
  db.hook((op) => (op.kind === 'rpc' && op.name === 'answer_cancel_ask' ? { error: { code: '22023', message: 'That ask is accepted already.' } } : undefined));
  t.check(await kind(W.cancel('ca-556', 556, null)) === 'clash', '"That ask is accepted already." → clash');
  await W.cancelTwin(545, 544);
  t.check(last().name === 'cancel_order' && last().args.p_order === 545 && last().args.p_why === 'Entered twice', 'W27 Taken twice: cancel_order (0177), not the phone\'s void');
  await W.bothReal(556, 553);
  t.check(lastPatch().p_id === 556 && lastPatch().p_patch.dupOkWith.join() === '553', 'W26 Both are real: dupOkWith on the newer');
  await W.agent(560, [0], false);
  p = lastPatch();
  t.check(p.p_patch.items[0].qty === 12 && p.p_patch.agentChange.state === 'agreed' && p.p_patch.agentChange.lines[0].decision === 'agreed', 'W28 the agent\'s fewer agreed: the qty to 12');
  t.check(await kind(W.agent(560, [0], false)) === 'clash', 'answered already → clash');

  await W.merge('ggaba', 'gaba');
  t.check(last().name === 'merge_customers' && last().args.p_keep === 'ggaba', 'W32 merge_customers');
  await W.notSame('ggaba', 'gaba');
  t.check(db.tables.decision_log.some((l) => l.task === 'customer.edit' && l.ref && l.ref.apart && l.ref.apart.join() === 'gaba,ggaba'), 'W32 Not the same: a customer.edit line, ref.apart');
  await W.opening('ggaba', 290000, '2026-10-01');
  t.check(last().name === 'set_opening_balance' && last().args.p_amount === 290000, 'W34 set_opening_balance');
  await W.promise('kato', '2026-10-20', 400000);
  t.check(db.tables.payment_promises.some((r) => r.customer_id === 'kato' && r.promised_on === '2026-10-20' && r.amount === 400000), 'W35 a promise, through Sales\' recordPromise');
  await W.goals('this', [{ staffId: 'grace', amount: 40000000 }]);
  t.check(last().name === 'set_person_goal' && last().args.p_who === 'u-grace' && last().args.p_from === '2026-10-01' && last().args.p_to === '2026-10-31', 'W38 set_person_goal, Grace\'s login, this month');
  await W.goals('next', [{ staffId: 'grace', amount: 40000000 }]);
  t.check(last().args.p_from === '2026-11-01' && last().args.p_to === '2026-11-30', 'next month');
  await W.stageLimits({ awaiting_goods: 1440 });
  t.check(last().name === 'set_shop_preset' && last().args.p_key === 'orderStageLimits' && last().args.p_value.draft === 120 && last().args.p_value.awaiting_goods === 1440, 'W39 stage limits, over the ones set');
  await W.holdDays(30);
  t.check(last().args.p_key === 'creditHold' && last().args.p_value.days === 30, 'W39 hold days');
  t.check(await kind(W.giveTo(554, 'joy-missing')) === 'refused:MG-NOSTAFF', 'give to someone not on the staff list → refused');
  db.tables.saved_quotes.find((r) => r.id === 554).payload.pickingStatus = 'in_progress';
  await W.giveTo(554, 'musa');
  p = lastPatch();
  t.check(p.p_patch.assignedWorkerId === 'musa' && p.p_patch.pickingStatus === 'awaiting_accept' && !('carrier' in p.p_patch), 'W41 give to a packer: the pick starts again; no driver keys sent');
  db.tables.saved_quotes.find((r) => r.id === 550).status = 'pending_delivery';
  await W.giveTo(550, 'ssali');
  p = lastPatch();
  t.check(Object.keys(p.p_patch).sort().join() === 'assignedDeliveryId,carrier' && p.p_patch.carrier.name === 'Ssali', 'W41 give to a driver: only the driver\'s keys');

  process.exit(t.done() ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
