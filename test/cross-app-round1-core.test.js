#!/usr/bin/env node
'use strict';
/*
 * Cross-app round 1 (docs/audit/cross-app/ROUND-1.md), the shared rules:
 *   BUY-4  a Buyer stop and the cash ask are the sum of the order's lines, also with packs (#0212)
 *   BUY-5  an invoiced order whose goods are still to come is never aged off (#0148); a test order is never bought
 *   X-1    an order Sales asked to cancel is held: off To ask, the asks and the trip
 *   X-2    a line with no stock and no supplier "Needs a supplier", never a tick; one rule for Sales and the Buyer
 *   BUY-3  a line placed with no selling price (priceAsk) is still asked of its supplier
 *
 * Run: node test/cross-app-round1-core.test.js
 */
const path = require('path');
const { ROOT, createReporter } = require('./_extract');

const t = createReporter('cross-app round 1 core');
const { runsToGo, priceRowOf } = require(path.join(ROOT, 'src/core/buyer/supabase/buy.ts'));
const O = require(path.join(ROOT, 'src/core/buyer/supabase/order.ts'));
const { booksOf } = require(path.join(ROOT, 'src/core/buyer/supabase/rows.ts'));
const R = require(path.join(ROOT, 'src/core/buyer/rules.ts'));
const { lineWord, LINE_WORD, sure } = require(path.join(ROOT, 'src/core/lineword.ts'));

const NOW = Date.parse('2026-11-11T09:00:00Z');
const DAY = 864e5;
const iso = (ms) => new Date(ms).toISOString();
const yes = (at) => ({ s9: { state: 'confirmed', askedAt: iso(at - 3600e3), at: iso(at), terms: {} } });

// #0212's two lines: 2 packs at 42,000 and 2 packs at 50,000, from a price-list row with a pack of 10 and no loose price.
const row = (id, pid, wholesale) => priceRowOf({ id, product_id: pid, variant_idx: null, supplier_id: 's9', wholesale, retail: null, pack_qty: 10, pack_unit: 'Pack', unit: 'pcs', date: '2026-11-01' });
const q212 = (items) => O.quoteOf({ id: 212, status: 'awaiting_goods', invoiced: false, voided: false, date: '2026-11-10', payload: { createdAt: iso(NOW - DAY), items, supplierConfirms: yes(NOW - DAY) } });
{
  const prices = [row(1, 'p-hinge', 42000), row(2, 'p-lock', 50000)];
  // In packs: qty 2 of the item's own unit "Pack".
  const packs = q212([
    { lineId: 'L212-0', productId: 'p-hinge', productName: 'Door hinge 4 in', qty: 2, unit: 'Pack', price: 42000, sellPrice: 52000, supplierId: 's9' },
    { lineId: 'L212-1', productId: 'p-lock', productName: 'Padlock 50 mm', qty: 2, unit: 'Pack', price: 50000, sellPrice: 60000, supplierId: 's9' },
  ]);
  const runs = runsToGo([packs], [], prices, [], NOW);
  const run = runs.find((r) => r.supplierId === 's9');
  t.check(run && run.total === 184000, `BUY-4: #0212's stop is the sum of its lines, 184,000 (was 920,000) — got ${run && run.total}`);
  t.check(run && run.lines.map((l) => l.qty).join() === '2,2', 'BUY-4: the trip asks for the order\'s 2 and 2, never a carton of 10');
  // In the loose unit: 20 pcs at 4,200 each (2 packs of 10).
  const loose = q212([
    { lineId: 'L212-0', productId: 'p-hinge', productName: 'Door hinge 4 in', qty: 20, unit: 'pcs', qtyIn: 'pack', packUnit: 'Pack', packQty: 10, price: 4200, sellPrice: 5200, supplierId: 's9' },
    { lineId: 'L212-1', productId: 'p-lock', productName: 'Padlock 50 mm', qty: 20, unit: 'pcs', qtyIn: 'pack', packUnit: 'Pack', packQty: 10, price: 5000, sellPrice: 6000, supplierId: 's9' },
  ]);
  const prices2 = [priceRowOf({ id: 3, product_id: 'p-hinge', variant_idx: null, supplier_id: 's9', wholesale: 4200, retail: null, pack_qty: 10, pack_unit: 'Pack', unit: 'pcs', date: '2026-11-01' }),
    priceRowOf({ id: 4, product_id: 'p-lock', variant_idx: null, supplier_id: 's9', wholesale: 5000, retail: null, pack_qty: 10, pack_unit: 'Pack', unit: 'pcs', date: '2026-11-01' })];
  const run2 = runsToGo([loose], [], prices2, [], NOW).find((r) => r.supplierId === 's9');
  t.check(run2 && run2.total === 184000, `BUY-4: the same two lines counted in pcs (qty 20, pack of 10) are 184,000 too — got ${run2 && run2.total}`);
  // A count that is not a whole pack: 3 pcs with a pack of 10 is 3 pcs, not 10.
  const odd = q212([{ lineId: 'L212-0', productId: 'p-hinge', productName: 'Door hinge 4 in', qty: 3, unit: 'pcs', price: 4200, sellPrice: 5200, supplierId: 's9' }]);
  const run3 = runsToGo([odd], [], prices2, [], NOW).find((r) => r.supplierId === 's9');
  t.check(run3 && run3.total === 12600, `BUY-4: 3 pcs from a pack of 10 is 3 × 4,200 = 12,600 — got ${run3 && run3.total}`);
}

// BUY-5: invoiced 94 days ago, still in Buying with lines to come.
{
  const q148 = O.quoteOf({ id: 148, status: 'awaiting_goods', invoiced: true, invoiced_ts: iso(NOW - 94 * DAY), voided: false, payload: { items: [{ lineId: 'L148-0', productId: 'p', qty: 1, price: 1000, supplierId: 's9' }] } });
  t.check(!O.agedOff(q148, NOW), 'BUY-5: an invoiced order still in Buying is not aged off (#0148)');
  const done = O.quoteOf({ id: 149, status: 'completed', invoiced: true, invoiced_ts: iso(NOW - 2 * DAY), voided: false, payload: { items: [{ lineId: 'L149-0', productId: 'p', qty: 1, price: 1000, supplierId: 's9', receivedAt: iso(NOW - 3 * DAY), receivedQty: 1 }] } });
  t.check(O.agedOff(done, NOW), 'an invoiced, delivered order with every line in still leaves the board after 24 h');
  const test = O.quoteOf({ id: 150, qa: true, status: 'awaiting_goods', payload: {} });
  t.check(!O.buyable([])(test), 'BUY-5: a test order is never bought (not on a trip, not in the cash)');
  t.check(!O.buyable([608])(O.quoteOf({ id: 608, status: 'draft', payload: {} })) && O.buyable([608])(O.quoteOf({ id: 607, status: 'draft', payload: {} })), 'X-1: an order with an open cancel ask is not bought; others are');
}

// X-1 + X-2 through the Buyer's books: #0608 (a cancel asked, a line with no supplier) and #0609 (the same line, no ask).
{
  const line = { lineId: 'L-0', productId: 'p-sc', productName: 'Soft Close Mulper', qty: 2, unit: 'prs', price: 6500, sellPrice: 9000, supplierId: '' };
  const raw = {
    session: { userId: 'u-buyer', shopId: 'shop', shopName: 'Shop', role: 'buyer', name: 'Kevin' },
    members: [{ user_id: 'u-buyer', role: 'buyer', display_name: 'Kevin' }], staff: [], agents: [],
    suppliers: [{ id: 's9', name: 'Owino Plumbing', phone: '0772000009', location: 'Owino' }], products: [{ id: 'p-sc', name: 'Soft Close Mulper', variants: [] }],
    prices: [{ id: 9, product_id: 'p-sc', variant_idx: null, supplier_id: 's9', wholesale: 6500, retail: 6500, pack_qty: 0, date: '2026-11-10', unit: 'prs' }],
    quotes: [608, 609].map((id) => ({ id, status: 'draft', invoiced: false, voided: false, client_name: 'Walk-in', payload: { client: { name: 'Walk-in' }, createdAt: iso(NOW - DAY), items: [{ ...line, lineId: 'L' + id + '-0' }] } })),
    trips: [], handoffs: [], restock: [], phones: {}, keep: { off: [] }, now: NOW, cancelAsked: [608],
  };
  const b = booksOf(raw);
  const o608 = b.orders.find((o) => o.id === 608), o609 = b.orders.find((o) => o.id === 609);
  t.check(o608 && o608.hold === 'cancel' && o609 && !o609.hold, 'X-1: #0608 (cancel asked) is held; #0609 is not');
  t.check(!R.liveOrders(b).some((o) => o.id === 608), 'X-1: a held order is out of To ask, Asked and Found (liveOrders)');
  const st = R.lineState(o609, o609.lines[0], null);
  t.check(st === 'nosupplier' && R.WORD[st] === 'Needs a supplier', `X-2: a line with no stock and no supplier reads "Needs a supplier" (${st})`);
  const tl = R.tiles(b, NOW);
  t.check(tl.toask === 0, `X-2 / BUY-2: a line with no supplier is not counted in To ask (${tl.toask})`);
}

// The one rule.
{
  const f = { removed: false, got: null, qty: 2, supplierId: 's9', clientWaits: false, onTrip: false, priceWaits: false, priceComing: false, asked: false, answer: null };
  t.check(lineWord({ ...f, supplierId: '' }) === 'nosupplier' && lineWord({ ...f, supplierId: '', clientWaits: true }) === 'clientwaits', 'no supplier: Needs a supplier, or Client waits while Sourcing looks');
  t.check(lineWord({ ...f, priceWaits: true }) === 'priceup' && lineWord({ ...f, priceWaits: true, priceComing: true }) === 'toask', 'BUY-3: a Price coming line is still asked of its supplier; a price up waits first');
  t.check(lineWord({ ...f, asked: true }) === 'asked' && lineWord({ ...f, asked: true, answer: 'found' }) === 'found' && lineWord({ ...f, asked: true, answer: 'notfound' }) === 'notfound', 'asked → found / not found');
  t.check(!sure('nosupplier') && !sure('toask') && !sure('asked') && sure('found'), 'a tick only for what is sure to come');
  t.check(Object.keys(LINE_WORD).length === 11 && LINE_WORD.nosupplier === 'Needs a supplier', 'eleven words, one list');
}

process.exit(t.done() ? 1 : 0);
