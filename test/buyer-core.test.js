#!/usr/bin/env node
'use strict';
/*
 * The Buyer core (src/core/buyer): the canvas's figures come out of the demo
 * by the app's own rules, and the demo's writes move the shop as the books do.
 *
 * Run: node test/buyer-core.test.js   (or: npm test)
 */
const path = require('path');
const { ROOT, createReporter } = require('./_extract');

const t = createReporter('buyer core');
const R = require(path.join(ROOT, 'src/core/buyer/rules.ts'));
const { buyerDemo } = require(path.join(ROOT, 'src/core/buyer/demo/index.ts'));
const T = require(path.join(ROOT, 'src/core/time.ts'));

(async () => {
  /* ---- morning: everything to ask ---- */
  let d = buyerDemo('?demo', { instant: true });
  let b = await d.books(), now = d.now();
  t.check(T.clock(now) === '9:00', 'the morning demo is 9:00');
  let asks = R.askGroups(b, now);
  t.check(asks.length === 5, `5 suppliers to ask (got ${asks.length})`);
  const nam = asks.find((g) => g.supplier.name === 'Namanve Sheets');
  t.check(nam && nam.lines.length === 3 && nam.orders.length === 2, 'Namanve: 3 lines on 2 orders in one ask');
  t.check(R.tiles(b, now).toask === 5 && R.tiles(b, now).asked === 0, 'tiles: 5 to ask, 0 asked');

  // One tap per supplier, then one tap per answer.
  for (const g of asks) await d.ask(g.supplier.id, 'whatsapp');
  b = await d.books();
  t.check(R.tiles(b, now).toask === 0 && R.tiles(b, now).asked === 5, 'after asking all five: 0 to ask, 5 asked');
  await d.answerYes('s-nakawa');
  await d.answerYes('s-namanve');
  b = await d.books();
  const o550 = b.orders.find((o) => o.id === 550);
  t.check(o550.status === 'awaiting_goods', '#0550 moves to Buying when its last supplier says yes');
  t.check(R.lineState(o550, o550.lines[0]) === 'found', 'its iron sheets are Found');

  /* ---- midday: the canvas's Replies and Plan ---- */
  d = buyerDemo('?demo&state=midday', { instant: true });
  b = await d.books(); now = d.now();
  t.check(T.clock(now) === '11:15', 'midday is 11:15');
  t.check(R.toBuy(b) === 3500000, `To buy today 3,500,000 (got ${R.toBuy(b)})`);
  const tl = R.tiles(b, now);
  t.check(tl.foundSuppliers === 3 && tl.suppliers === 5, `3 of 5 suppliers found (got ${tl.foundSuppliers} of ${tl.suppliers})`);
  const reps = R.replyRows(b, now);
  t.check(reps.length === 1 && reps[0].supplier.name === 'Ndeeba Timber Works' && reps[0].late, 'Ndeeba is the one reply due, and late');
  const cap = b.orders.find((o) => o.id === 552).lines[1];
  t.check(R.lineState(b.orders.find((o) => o.id === 552), cap) === 'priceup' && cap.cost === 27000, 'the ridge cap is Price up at 27,000');
  const plan = R.tripPlan(b);
  t.check(plan.stops.map((s) => s.supplierId).join() === 's-nakawa,s-owino,s-namanve', 'the trip runs Nakawa, Owino, Namanve');
  t.check(plan.stops.map((s) => s.planned).join() === '680000,540000,2280000' && plan.cash === 3500000, 'stops 680,000 · 540,000 · 2,280,000 = 3,500,000');
  t.check(plan.held.length === 2, 'two lines held: the ridge cap (Ruth) and the timber (asked)');
  const notFound = R.lineRefs(b).filter((r) => r.state === 'notfound');
  t.check(notFound.length === 1 && notFound[0].line.name === 'Y12 rebar 12 m', 'the Y12 rebar is Not found');

  // Take a stop off and back; ask the cash.
  await d.setStopOff('s-owino', true);
  t.check(d.shop.trip.cash.amount === 2960000, 'Owino off: the cash ask drops to 2,960,000');
  await d.setStopOff('s-owino', false);
  await d.askCash();
  t.check(d.shop.trip.state === 'on' && d.shop.trip.cash.amount === 3500000, 'cash asked and given: on the trip with 3,500,000');

  /* ---- the trip: Nakawa 30,000 less, Owino as planned, Namanve short ---- */
  await d.stopDone('s-nakawa', [{ orderId: 550, idx: 1, got: 20 }], 650000);
  await d.stopDone('s-owino', [{ orderId: 553, idx: 1, got: 12 }], 540000);
  await d.stopDone('s-namanve', [{ orderId: 550, idx: 0, got: 36 }, { orderId: 552, idx: 0, got: 20 }], 2128000);
  b = await d.books();
  const h = R.handIn(b.trip, b);
  t.check(h.paid === 3318000 && h.back === 182000, `paid 3,318,000 · 182,000 back (got ${h.paid} · ${h.back})`);
  t.check(h.shorts.length === 1 && R.shortWord(h.shorts[0].got, h.shorts[0].line.qty) === 'Short · got 36 of 40', 'Short · got 36 of 40');
  await d.handIn();
  t.check(d.shop.trip.state === 'in', 'handed in');

  /* ---- a price over the selling price goes to the Manager ---- */
  d = buyerDemo('?demo', { instant: true });
  await d.ask('s-namanve', 'whatsapp');
  await d.answerPrice('s-namanve', [{ orderId: 552, idx: 1, cost: 27000 }]);
  const c2 = d.shop.orders.find((o) => o.id === 552).lines[1];
  t.check(c2.ruthDecides && c2.priceWas === 24000, 'a new price over the selling price: Ruth decides, was 24,000');

  /* ---- offline writes are refused as offline (the outbox keeps them) ---- */
  d = buyerDemo('?demo&offline=1', { instant: true });
  try { await d.ask('s-namanve', 'whatsapp'); t.check(false, 'offline ask should fail'); }
  catch (e) { t.check(e.kind === 'offline', 'offline: the write fails as offline'); }

  process.exit(t.done() ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
