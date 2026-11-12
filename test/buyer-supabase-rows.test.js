#!/usr/bin/env node
'use strict';
/*
 * The Buyer's real books (src/core/buyer/supabase): sample saved_quotes and
 * collection_trips rows, shaped as buyer.html reads them, become BuyerBooks,
 * and the app's rules (lineState, askGroups, replyRows, tripPlan, handIn)
 * read them right. The order changes (order.ts) move an order as buyer.html does.
 *
 * Run: node test/buyer-supabase-rows.test.js
 */
const path = require('path');
const { ROOT, createReporter } = require('./_extract');

const t = createReporter('buyer supabase rows');
const R = require(path.join(ROOT, 'src/core/buyer/rules.ts'));
const { booksOf } = require(path.join(ROOT, 'src/core/buyer/supabase/rows.ts'));
const O = require(path.join(ROOT, 'src/core/buyer/supabase/order.ts'));

const NOW = Date.parse('2026-10-17T09:00:00Z');
const MIN = 60000;
const iso = (ms) => new Date(ms).toISOString();

const base = () => ({
  session: { userId: 'u-buyer', shopId: 'shop', shopName: 'Mukasa Hardware', role: 'buyer', name: 'Okello' },
  members: [{ user_id: 'u-buyer', role: 'buyer', display_name: 'Okello' }, { user_id: 'u-acc', role: 'accounts', display_name: 'Esther' }],
  staff: [{ id: 'ST001', name: 'Okello', user_id: 'u-buyer', role: 'buyer' }],
  agents: [],
  suppliers: [
    { id: 's1', name: 'Nakawa Steel', phone: '0772000001', location: 'Industrial Area, Nakawa' },
    { id: 's2', name: 'Owino Hardware', phone: '', phone2: '0772000002', location: 'Owino' },
    { id: 's3', name: 'Kiseka Cement', phone: '0772000003', location: 'Kiseka' },
  ],
  products: [
    { id: 'p1', name: 'Iron sheet', variants: [{ combo: { gauge: '28g' } }] },
    { id: 'p2', name: 'Nails 4 inch', variants: [] },
    { id: 'p3', name: 'Cement', variants: [] },
  ],
  prices: [
    { id: 1, product_id: 'p1', variant_idx: 0, supplier_id: 's1', wholesale: 30000, retail: 31000, pack_qty: 0, date: '2026-10-10', unit: 'pcs' },
    { id: 2, product_id: 'p2', variant_idx: null, supplier_id: 's2', wholesale: null, retail: 5000, pack_qty: 0, date: '2026-10-01', unit: 'kg' },
    { id: 3, product_id: 'p3', variant_idx: null, supplier_id: 's3', wholesale: 32000, retail: 33000, pack_qty: 10, date: '2026-10-16', unit: 'bag' },
  ],
  quotes: [
    { id: 550, status: 'draft', client_name: 'Mukasa Builders', voided: false, payload: {
      createdAt: iso(NOW - 120 * MIN), takenBy: 'u-sales',
      items: [
        { lineId: 'a', productId: 'p1', variantIdx: 0, productName: 'Iron sheet', qty: 10, unit: 'pcs', price: 30000, sellPrice: 35000, supplierId: 's1' },
        { productId: 'p2', variantIdx: null, productName: 'Nails 4 inch', qty: 5, unit: 'kg', price: 5000, sellPrice: 6000, supplierId: 's2' },
        { lineId: 'shelf', productId: 'p3', qty: 2, unit: 'bag', price: 30000, sellPrice: 36000, supplierId: '__stock__' },
      ],
      supplierConfirms: { s2: { state: 'pending', at: null, askedAt: NOW - 40 * MIN, askedHow: 'wa', terms: null, note: '' } },
    } },
    { id: 551, status: 'draft', client_name: 'Kato', voided: false, payload: {
      createdAt: iso(NOW - 60 * MIN),
      items: [{ lineId: 'b', productId: 'p1', variantIdx: 0, productName: 'Iron sheet', qty: 4, unit: 'pcs', price: 30000, sellPrice: 35000, supplierId: 's1' }],
    } },
    { id: 552, status: 'awaiting_goods', client_name: 'Nansubuga', voided: false, payload: {
      createdAt: iso(NOW - 300 * MIN),
      items: [{ lineId: 'c', productId: 'p3', variantIdx: null, productName: 'Cement', qty: 20, unit: 'bag', price: 32000, sellPrice: 36000, supplierId: 's3' }],
      supplierConfirms: { s3: { state: 'confirmed', at: NOW - 200 * MIN, askedAt: NOW - 250 * MIN, terms: 'p3::20:32000', note: '' } },
      droppedLines: [{ productId: 'p2', productName: 'Bolt', qty: 3, unit: 'pcs', reason: 'Too dear', droppedAt: NOW - 220 * MIN }],
    } },
    // A yes on old terms (the price changed since): reads To ask again.
    { id: 553, status: 'draft', client_name: 'Ssali', voided: false, payload: {
      createdAt: iso(NOW - 30 * MIN),
      items: [{ lineId: 'd', productId: 'p2', variantIdx: null, productName: 'Nails 4 inch', qty: 8, unit: 'kg', price: 5200, sellPrice: 6000, supplierId: 's2' }],
      supplierConfirms: { s2: { state: 'confirmed', at: NOW - 25 * MIN, askedAt: NOW - 28 * MIN, terms: 'p2::8:5000', note: '' } },
    } },
    { id: 554, status: 'draft', client_name: 'Gone', voided: true, payload: { items: [{ lineId: 'e', productId: 'p1', qty: 1, price: 1, supplierId: 's1' }] } },
  ],
  trips: [], handoffs: [], restock: [], phones: {}, keep: { pay: {}, off: [] }, now: NOW,
});

/* ---- Checking: the board ---- */
let raw = base(), b = booksOf(raw);
t.check(b.me.name === 'Okello' && b.me.id === 'u-buyer', 'me: the display name, never the email');
t.check(b.orders.map((o) => o.id).join() === '550,551,552,553', `voided order left out (got ${b.orders.map((o) => o.id)})`);
const o550 = b.orders.find((o) => o.id === 550);
t.check(o550.lines.length === 2 && o550.lines[1].key === 'L550-1', 'a line with no lineId is named L<order>-<index>; the shelf line is not the Buyer\'s');
t.check(R.lineState(o550, o550.lines[0]) === 'toask', 'line a: To ask');
t.check(R.lineState(o550, o550.lines[1]) === 'asked', 'line L550-1: Asked');
t.check(o550.lines[0].name === 'Iron sheet — 28g', 'a variant is named as buyer.html names it');
const o553 = b.orders.find((o) => o.id === 553);
t.check(R.lineState(o553, o553.lines[0]) === 'toask', 'a yes on old terms reads To ask again');
const asks = R.askGroups(b, NOW);
t.check(asks.map((g) => g.supplier.id).join() === 's1,s2', `ask Nakawa (oldest order) then Owino (got ${asks.map((g) => g.supplier.id)})`);
t.check(asks[0].orders.length === 2 && asks[0].lines.length === 2, 'Nakawa: 2 lines on 2 orders in one ask');
const reps = R.replyRows(b, NOW);
t.check(reps.length === 1 && reps[0].supplier.id === 's2' && reps[0].late, 'Owino asked 40 min ago: one reply due, late');
t.check(b.suppliers.find((s) => s.id === 's2').phone === '0772000002', 'a supplier with only a second phone has it');
const o552 = b.orders.find((o) => o.id === 552);
t.check(R.lineState(o552, o552.lines[0]) === 'found', 'the cement is Found');
const dropped = o552.lines.find((l) => l.key === 'dropped:0');
t.check(dropped && R.lineState(o552, dropped) === 'removed' && dropped.removed.reason === 'Too dear', 'a dropped line reads Removed, with its reason');

/* ---- the plan ---- */
const plan = R.tripPlan(b);
t.check(plan.stops.length === 1 && plan.stops[0].supplierId === 's3' && plan.cash === 640000, `rules plan: Kiseka 640,000 (got ${plan.cash})`);
t.check(b.trip && b.trip.state === 'planned' && b.trip.stops.length === 1 && b.trip.stops[0].planned === 640000, 'the books\' planned trip: the same stop and figure');
raw.keep.off = ['s3'];
t.check(booksOf(raw).trip.cash.amount === 0 && booksOf(raw).trip.stops[0].off, 'a stop off on the phone: no cash on it');

/* ---- the cash ask, then the round on the road ---- */
raw = base();
raw.handoffs = [{ id: 'h1', kind: 'trip_cash', for_role: 'accounts', ref: 'round:ab12cd34', status: 'open', created_at: iso(NOW - 10 * MIN), payload: { supplierIds: ['s3'], amount: 640000, v: 2 } }];
b = booksOf(raw);
t.check(b.trip.state === 'cash' && b.trip.cash.amount === 640000 && b.trip.cash.givenAt == null, 'cash asked: the trip waits on Accounts');
raw.handoffs[0].status = 'done'; raw.handoffs[0].done_at = iso(NOW - 5 * MIN);
t.check(booksOf(raw).trip.state === 'on', 'cash handed over: the trip can go');

raw = base();
const line = (o, l, qty, price, got) => ({ orderId: o, lineId: l, productId: 'p3', productName: 'Cement', unit: 'bag', qty, expectedPrice: price, gotQty: got, gotPrice: got == null ? null : price });
raw.trips = [
  { id: 'TRIP-MX1-1', supplier_id: 's3', status: 'collecting', assigned_worker_id: 'ST001', created_at: iso(NOW - 60 * MIN), voided: false, cash_given: 640000, lines: [line(552, 'c', 20, 32000, 18)] },
  { id: 'TRIP-MX1-2', supplier_id: 's1', status: 'collecting', assigned_worker_id: 'ST001', created_at: iso(NOW - 60 * MIN + 1), voided: false, cash_given: 360000, lines: [line(551, 'b', 4, 30000, null)] },
];
raw.handoffs = [{ id: 'h1', kind: 'trip_cash', ref: 'round:ab12cd34', status: 'done', created_at: iso(NOW - 70 * MIN), done_at: iso(NOW - 65 * MIN), payload: { supplierIds: ['s3', 's1'], amount: 1000000, round: 'TRIP-MX1', v: 2 } }];
raw.keep.pay = { 'TRIP-MX1-1': { amount: 576000, noReceipt: true, done: iso(NOW - 20 * MIN) } };
b = booksOf(raw);
t.check(b.trip.id === 'TRIP-MX1' && b.trip.state === 'on' && b.trip.stops.length === 2, 'a round = the trips sharing a stem: 2 stops, on the road');
t.check(b.trip.cash.amount === 1000000 && b.trip.cash.givenAt != null, 'the round\'s cash: Accounts handed over 1,000,000');
const k = b.trip.stops.find((s) => s.supplierId === 's3');
t.check(k.done && k.paid === 576000 && k.planned === 640000, 'Kiseka done here (kept on the phone), 576,000 paid of 640,000 planned');
const c552 = b.orders.find((o) => o.id === 552);
t.check(R.lineState(c552, c552.lines[0], b.trip) === 'short' && c552.lines[0].got === 18, 'the cement came 18 of 20: Short');
const o551 = b.orders.find((o) => o.id === 551);
t.check(R.lineState(o551, o551.lines[0], b.trip) === 'ontrip', 'a line on a stop not done yet reads On the trip');
t.check(!b.trip.stops.some((s) => s.lines.length === 0), 'every stop names its lines');
const hi = R.handIn(b.trip, b);
t.check(hi.paid === 576000 && hi.back === 424000 && hi.shorts.length === 1, `hand-in: paid 576,000, back 424,000, 1 short (got ${hi.paid}/${hi.back}/${hi.shorts.length})`);

/* ---- handed in today ---- */
raw.trips.forEach((x) => { x.status = 'collected'; x.collected_at = iso(NOW - 2 * MIN); x.pay = { amount: x.supplier_id === 's3' ? 576000 : 120000, receipt: 'none' }; });
raw.keep.pay = {};
raw.quotes = raw.quotes.filter((q) => q.status !== 'awaiting_goods');
b = booksOf(raw);
t.check(b.trip && b.trip.state === 'in' && b.trip.handedInAt === NOW - 2 * MIN, 'nothing to plan: today\'s round reads handed in');

/* ---- BUY-14: take back the cash ask (buyer_handoffs → withdrawn, only while open, only my own) ---- */
const TR = require(path.join(ROOT, 'src/core/buyer/supabase/trip.ts'));
const fakeSb = (rows) => {
  const calls = [];
  const q = { filters: [], patch: null };
  const chain = {
    update(p2) { q.patch = p2; return chain; },
    eq(k, v) { q.filters.push([k, v]); return chain; },
    select() { calls.push({ ...q }); return Promise.resolve({ data: rows, error: null }); },
  };
  return { calls, from(tbl) { q.table = tbl; return chain; } };
};
(async () => {
  const sess = base().session;
  const rawAsk = (status, by) => ({ ...base(), handoffs: [{ id: 'h9', kind: 'trip_cash', for_role: 'accounts', ref: 'round:ab12cd34', status, created_by: by, created_at: iso(NOW - 10 * MIN), payload: { supplierIds: ['s3'], amount: 640000, v: 2 } }] });
  let sb = fakeSb([{ id: 'h9' }]);
  await TR.takeBackCash(sb, sess, rawAsk('open', 'u-buyer'));
  const c = sb.calls[0], f = Object.fromEntries(c.filters);
  t.check(c.table === 'buyer_handoffs' && c.patch.status === 'withdrawn' && f.id === 'h9' && f.status === 'open' && f.kind === 'trip_cash' && f.created_by === 'u-buyer' && f.shop_id === 'shop',
    'take back: my open trip_cash ask goes to withdrawn, filtered on status open');
  sb = fakeSb([]);
  try { await TR.takeBackCash(sb, sess, rawAsk('open', 'u-buyer')); t.check(false, 'no row changed should refuse'); }
  catch (e) { t.check(e.kind === 'refused' && e.message === 'Esther has given it', 'no row changed (given meanwhile): refused, Esther has given it'); }
  sb = fakeSb([{ id: 'h9' }]);
  try { await TR.takeBackCash(sb, sess, rawAsk('done', 'u-buyer')); t.check(false, 'a given ask should refuse'); }
  catch (e) { t.check(e.message === 'Esther has given it' && sb.calls.length === 0, 'a given ask: refused, nothing written'); }
  try { await TR.takeBackCash(sb, sess, rawAsk('open', 'u-other')); t.check(false, "another's ask should refuse"); }
  catch (e) { t.check(e.kind === 'refused' && sb.calls.length === 0, "another runner's ask: refused, nothing written"); }
  process.exit(t.done() ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

/* ---- the order changes, as buyer.html makes them ---- */
const ctx = { uid: 'u-buyer', now: NOW, agents: [] };
const q = O.quoteOf(base().quotes[1]);
O.markAsked(q, 's1', 'wa', NOW - MIN);
t.check(q.supplierConfirms.s1.askedAt === NOW - MIN && q.supplierConfirms.s1.askedHow === 'wa', 'markAsked stamps askedAt and how');
const r = O.setConfirm(q, 's1', 'confirmed', '', {}, ctx);
t.check(r.moved && q.status === 'awaiting_goods' && q.supplierConfirms.s1.terms === 'p1:0:4:30000', 'the last yes moves the order to Buying, on its terms');
t.check(q.stageLog.length === 1 && q.stageLog[0].auto === true && q.stageEnteredAt === NOW, 'the move is logged, auto');
const p = O.patchOf(q, base().quotes[1].payload, 'draft');
t.check(p.status === 'awaiting_goods' && Object.keys(p.patch).every((x) => O.ORDER_KEYS.includes(x)) && p.patch.supplierConfirms, 'the patch carries only ORDER_KEYS, and the new status');
const q2 = O.quoteOf(base().quotes[0]);
q2.supplierConfirms.s1 = { state: 'confirmed', askedAt: NOW - 5 * MIN };
q2.items[0].priceNote = 'nomargin';
O.setConfirm(q2, 's2', 'confirmed', '', {}, ctx);
t.check(q2.status === 'draft', 'a price waiting on the Manager holds the order in Checking');
const q3 = O.quoteOf(base().quotes[0]);
O.dropLine(q3, 0, 'Nobody has it', 'u-buyer', NOW);
t.check(q3.items.length === 2 && q3.droppedLines[0].reason === 'Nobody has it' && q3.droppedLines[0].at === 0, 'a dropped line leaves items and is kept in droppedLines');
O.setConfirm(q3, 's2', 'pending', '', {}, ctx);
t.check(q3.supplierConfirms.s2.state === 'pending' && q3.supplierConfirms.s2.askedAt === NOW - 40 * MIN, 'undo to pending keeps askedAt');
// The run ends when the take-back checks above (async) are done.
