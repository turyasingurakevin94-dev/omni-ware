#!/usr/bin/env node
'use strict';
/*
 * The Counter tab's rules and figures (boards KC01–KC19): what the shelf shows, the tender rule,
 * and the counter sale as the demo stands in for counter_sale (0136/0155), with a sale that waits
 * for the Manager's price, sold later by its number.
 *
 * Run: node test/sales-counter.test.js   (or: npm test)
 */
const path = require('path');
const { ROOT, createReporter } = require('./_extract');

const t = createReporter('sales counter');
const { demoSource } = require(path.join(ROOT, 'src/core/demo/index.ts'));
const M = require(path.join(ROOT, 'src/core/money.ts'));
const S = require(path.join(ROOT, 'src/apps/sales/counter/shop.ts'));
const I = require(path.join(ROOT, 'src/core/find.ts'));
const C = require(path.join(ROOT, 'src/core/customers.ts'));

const item = (b, id) => b.items.find((i) => i.id === id);
const line = (it, qty, n, price) => ({
  lineId: n, itemId: it.id, variantIdx: null, name: it.name, unit: it.unit, packUnit: it.packUnit, packQty: it.packQty, qty,
  price: price == null ? it.price : price, cost: it.cost, shopPrice: it.price, from: 'shelf', supplierId: '__stock__',
  priceBy: null, priceNote: null, priceReview: null, priceToldAt: null, state: null, stateAt: null,
});
const draft = (lines) => ({ customerId: null, client: { name: 'Walk-in', phone: '' }, lines, charges: [], credit: null, deliverTo: null, chatId: null });
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

(async () => {
  /* ---- the tender and the change (FACTS "Tender rule", KC03, KC12, KC14) ---- */
  t.check(same(M.likelyNotes(52000), [55000, 60000]), '52,000 → they likely give 55,000 or 60,000');
  t.check(same(M.likelyNotes(203500), [205000, 210000]), '203,500 → 205,000 or 210,000');
  t.check(same(M.notesFor(8000), [5000, 2000, 1000]), 'change 8,000 is one 5,000, one 2,000, one 1,000');
  t.check(same(M.notesFor(57000), [50000, 5000, 2000]), '57,000 counted is 50,000 + 5,000 + 2,000 (KC06)');

  /* ---- the shelf (KC01, KC03, KC18, KC14) ---- */
  const demo = demoSource('?demo');
  let b = await demo.books();
  const now = demo.now();
  const day = S.counterToday(b, now);
  t.check(day.length === 6 && day.reduce((a, x) => a + x.amount, 0) === 412000, `the counter today: 6 sales · 412,000 (got ${day.length})`);
  t.check(same(day.map((x) => x.amount), [42000, 88000, 61000, 100000, 35000, 86000]) && same(day.map((x) => x.method), ['cash', 'cash', 'momo', 'cash', 'momo', 'cash']), 'KC14\'s bars: 42k 88k 61k(mobile) 100k 35k(mobile) 86k');
  const best = S.bestSellers(b, now).slice(0, 4).map((i) => i.name);
  t.check(same(best, ['Cement · Hima 50kg', 'Wire nails 4" · 1kg', 'Wood glue · 1L', 'PVC pipe ½" · 6m']), `KC01: sold most today (got ${best.join(', ')})`);
  const cem = item(b, 'cement-hima-50'), glue = item(b, 'wood-glue-1l'), gloss = item(b, 'gloss-white-4'), paint = item(b, 'roof-paint-maroon-20');
  t.check(S.soldWith(b, now, [line(cem, 1, 1), line(glue, 1, 2)])[0].name === 'Wire nails 4" · 1kg', 'KC03: under Cement and Wood glue, Wire nails first');
  t.check(same(S.soldWith(b, now, [line(gloss, 3, 1), line(cem, 1, 2)]).slice(0, 2).map((i) => i.id), ['nails-4-1kg', 'pvc-half-6m']), 'KC18: under Gloss paint and Cement, Wire nails then PVC pipe');
  const due = S.dueOf(b, now);
  t.check(same(due.map((d) => d.c.name), ['Mukono Roofing', 'Kyaligonza & Sons', 'Lubowa Builders']), `KC04: who's due 3 (got ${due.map((d) => d.c.name).join(', ')})`);
  t.check(same(due.map((d) => d.words), ['Due today · every 7 days', '4 days late · every 14 days', '1 day late · every 5 days']), 'KC04: their rhythm in words');
  const ask = I.readAsk('2 paint');
  t.check(ask.qty === 2 && same(ask.words, ['paint']) && same(I.findItems(b, ask).filter((i) => i.price != null).map((i) => i.id), ['roof-paint-maroon-20', 'gloss-white-4']), 'KC02: "2 paint" is 2 of paint: the items called paint (the lead\'s search ruling, 4 Nov: an aisle only when no name matches)');
  t.check(same(I.findItems(b, I.readAsk('plumbing')).filter((i) => i.price != null).length > 0 && I.findItems(b, I.readAsk('plumbing')).every((i) => i.aisle === 'Plumbing'), true), '"plumbing": no item is called that, so the aisle lists');

  const T = require(path.join(ROOT, 'src/core/time.ts'));
  const quiet = b.customers.filter((c) => C.rhythm(c, b.orders, T.dayOf(now)).quiet);
  t.check(quiet.length === 8, `gone quiet: 8, more than twice their gap (got ${quiet.length})`);

  /* ---- a cash sale (KC05 → KC14) ---- */
  const r = await demo.counterSale(draft([line(cem, 1, 1), line(glue, 1, 2)]), { method: 'cash', given: 60000, ref: '' });
  t.check(r.order.id === 558 && r.paid === 52000 && r.change === 8000 && !r.waiting && r.order.invoiced && r.order.stage === 'delivered', 'sold #0558: 52,000 paid, change 8,000, invoiced and delivered at once');
  b = await demo.books();
  const after = S.counterToday(b, now);
  t.check(after.length === 7 && after.reduce((a, x) => a + x.amount, 0) === 464000, 'after it: 7 sales · 464,000 (KC14)');

  /* ---- under the shop's price: Ruth decides (KC10 → KC12), or the shop's price (KC11) ---- */
  const d2 = demoSource('?demo');
  const b2 = await d2.books(), p2 = item(b2, 'roof-paint-maroon-20'), c2 = item(b2, 'cement-hima-50');
  const lines = [line(p2, 1, 1, 170000), line(c2, 1, 2)];
  const w = await d2.counterSale(draft(lines), { method: 'cash', given: 0, ref: '' });
  t.check(w.waiting === 'price' && w.order.id === 558 && !w.order.invoiced && w.paid === 0, 'Ask Ruth: #0558 placed and waiting, nothing taken');
  const again = await d2.counterSale(draft([]), { method: 'cash', given: 0, ref: '', quote: 558 });
  t.check(again.waiting === 'price' && again.order.id === 558, 'sold by its number before her answer: it still waits');
  const held = d2.state.books.orders.find((o) => o.id === 558);
  held.lines[0].priceReview = { state: 'approved', price: 170000, was: 185000, by: 'u-ruth', byName: 'Ruth Nakato', at: held.placedAt + 180000 };
  const yes = await d2.counterSale(draft([]), { method: 'cash', given: 205000, ref: '', quote: 558 });
  t.check(!yes.waiting && yes.order.id === 558 && yes.paid === 203500 && yes.change === 1500, 'after her yes: #0558 sold for 203,500, change 1,500');
  let refused = '';
  try { await d2.counterSale(draft([]), { method: 'cash', given: 0, ref: '', quote: 558 }); } catch (e) { refused = e.code; }
  t.check(refused === 'OWCTR', 'sold once: selling it again is refused (OWCTR)');

  const d3 = demoSource('?demo');
  const b3 = await d3.books(), p3 = item(b3, 'roof-paint-maroon-20'), c3 = item(b3, 'cement-hima-50');
  await d3.counterSale(draft([line(p3, 1, 1, 170000), line(c3, 1, 2)]), { method: 'cash', given: 0, ref: '' });
  await d3.counterLines(558, [line(p3, 1, 1), line(c3, 1, 2)]);
  const shop = await d3.counterSale(draft([]), { method: 'momo', given: 0, ref: '12045889301', quote: 558 });
  t.check(!shop.waiting && shop.paid === 218500 && d3.state.books.payments.some((p) => p.orderId === 558 && p.ref === '12045889301'), 'at the shop\'s price: 218,500 by mobile, the ID kept');

  /* ---- nothing called "tile cutter": the walk-in is added to Moses' open ask (KC21, KC25) ---- */
  const d5 = demoSource('?demo');
  const b5 = await d5.books();
  t.check(I.findItems(b5, I.readAsk('tile cutter')).length === 0, 'the shop sells no tile cutter (KC21)');
  const open5 = b5.asks.find((a) => a.name === 'Tile cutter 600mm');
  t.check(open5 && open5.status === 'found' && open5.requests.length === 1, 'Moses found it already: one ask (FACTS §6)');
  const added = await d5.askSourcing({ name: 'Tile cutter 600mm', qty: 1, customerId: null, chatId: null });
  t.check(added.id === open5.id && added.requests.length === 2, 'Add this walk-in: the same ask, 2 asked (KC25)');

  /* ---- a tile or chip opens the aisle itself (spec 04 §4.1 "An aisle open"; KC01, KC21, KC25, KC26, KC28) ---- */
  const A = require(path.join(ROOT, 'src/core/aisles.ts'));
  const ba = await demoSource('?demo').books();
  const fas = A.aisleItems(ba, 'Fasteners');
  t.check(fas.length === ba.items.filter((i) => i.aisle === 'Fasteners').length && fas.every((i) => i.aisle === 'Fasteners'), 'an aisle lists every item in it, not a word search');
  const sold = A.timesSold(ba);
  t.check(fas.every((it, k) => k === 0 || (sold.get(fas[k - 1].id) || 0) >= (sold.get(it.id) || 0)), 'the most sold first');
  const fs = require('fs');
  const ctr = fs.readFileSync(path.join(ROOT, 'src/apps/sales/counter/Counter.tsx'), 'utf8');
  t.check(/aisleItems\(b, aisle\.value\)/.test(ctr) && !/onAisle=\{\(a\) => \{ q\.value = a; \}\}/.test(ctr), 'the counter\'s tiles and chips open the aisle with core/aisles.ts aisleItems');

  /* ---- &fail=sale: the first sale is lost on its way, nothing taken (KC19) ---- */
  const d4 = demoSource('?demo&fail=sale');
  const b4 = await d4.books();
  let kind = '';
  try { await d4.counterSale(draft([line(item(b4, 'cement-hima-50'), 1, 1)]), { method: 'cash', given: 0, ref: '' }); } catch (e) { kind = e.kind; }
  t.check(kind === 'offline' && !d4.state.books.orders.some((o) => o.id === 558), '&fail=sale: the sale did not reach the books');
  const ok = await d4.counterSale(draft([line(item(b4, 'cement-hima-50'), 1, 1)]), { method: 'cash', given: 0, ref: '' });
  t.check(ok.order.id === 558 && ok.paid === 33500, 'slide again: it sells');

  process.exit(t.done() ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
