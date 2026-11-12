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
  {
    const d2 = buyerDemo('?demo&state=midday', { instant: true });
    await d2.answerNo('s-ndeeba');
    await d2.clientWaits(554, d2.shop.orders.find((o) => o.id === 554).lines[0].key);
    const t2 = R.tiles(await d2.books(), now);
    t.check(t2.suppliers === 5, `No → Client waits: still "of 5" suppliers (got ${t2.suppliers})`);
  }
  t.check(notFound.length === 1 && notFound[0].line.name === 'Y12 rebar 12 m', 'the Y12 rebar is Not found');

  // Take a stop off and back; ask the cash.
  await d.setStopOff('s-owino', true);
  t.check(d.shop.trip.cash.amount === 2960000, 'Owino off: the cash ask drops to 2,960,000');
  b = await d.books();
  t.check(R.toBuy(b) === 2960000 && R.tripPlan(b).stops.length === 2, `Owino off: Today's "To buy today" and the + read the Plan's 2,960,000 and 2 stops (got ${R.toBuy(b)})`);
  await d.setStopOff('s-owino', false);
  await d.askCash();
  t.check(d.shop.trip.state === 'on' && d.shop.trip.cash.amount === 3500000, 'cash asked and given: on the trip with 3,500,000');

  /* ---- the trip: Nakawa 30,000 less, Owino as planned, Namanve short ---- */
  await d.stopDone('s-nakawa', [{ orderId: 550, key: 'L1', got: 20 }], 650000);
  await d.stopDone('s-owino', [{ orderId: 553, key: 'L1', got: 12 }], 540000);
  await d.stopDone('s-namanve', [{ orderId: 550, key: 'L0', got: 36 }, { orderId: 552, key: 'L0', got: 20 }], 2128000);
  b = await d.books();
  const h = R.handIn(b.trip, b);
  t.check(h.paid === 3318000 && h.back === 182000, `paid 3,318,000 · 182,000 back (got ${h.paid} · ${h.back})`);
  t.check(h.shorts.length === 1 && R.shortWord(h.shorts[0].got, h.shorts[0].line.qty) === 'Short · got 36 of 40', 'Short · got 36 of 40');
  // Every figure on Hand in from one rule: #0550 carries Nakawa's 650,000 (30,000 under plan) + 36 × 38,000.
  const by = Object.fromEntries(h.byOrder.map((o) => [o.order.id, o]));
  t.check(by[550].came === 2018000 && by[550].planned === 2200000, `#0550 2,018,000 of 2,200,000 (got ${by[550].came} of ${by[550].planned})`);
  t.check(by[552].came === 760000 && by[553].came === 540000, '#0552 760,000 · #0553 540,000 as planned');
  t.check(h.byOrder.reduce((x, o) => x + o.came, 0) === h.paid, 'the orders add up to what was paid (3,318,000)');
  t.check(R.paidShares(100, [1, 1, 1]).join() === '34,33,33' && R.paidShares(0, [5, 5]).join() === '0,0', 'a payment shares out in whole shillings that add up');
  // The real books keep the same share as each line's price paid.
  const { pricedLines } = require(path.join(ROOT, 'src/core/buyer/supabase/trip.ts'));
  const pl = pricedLines([{ qty: 40, gotQty: 36, expectedPrice: 38000 }, { qty: 20, gotQty: 20, expectedPrice: 38000 }], 2100000);
  t.check(pl.reduce((x, l) => x + l.gotQty * l.gotPrice, 0) === 2100000, 'books: got × gotPrice adds up to what the stop paid');
  const nk = pricedLines([{ qty: 20, gotQty: 20, expectedPrice: 34000 }], 650000);
  t.check(nk[0].gotPrice === 32500, 'books: Nakawa paid 650,000 for 20 bags: 32,500 a bag');
  await d.handIn();
  t.check(d.shop.trip.state === 'in', 'handed in');

  /* ---- a price over the selling price goes to the Manager ---- */
  d = buyerDemo('?demo', { instant: true });
  await d.ask('s-namanve', 'whatsapp');
  await d.answerPrice('s-namanve', [{ orderId: 552, key: 'L1', cost: 27000 }]);
  const c2 = d.shop.orders.find((o) => o.id === 552).lines[1];
  t.check(c2.ruthDecides && c2.priceWas === 24000, 'a new price over the selling price: Ruth decides, was 24,000');

  /* ---- Buyer round 1 · BUY-03: one definition per number ---- */
  d = buyerDemo('?demo&state=midday', { instant: true });
  b = await d.books(); now = d.now();
  const P = require(path.join(ROOT, 'src/apps/buyer/trip/model.ts'));
  t.check(R.checking(b).map((o) => o.id).join() === '552,553,554', `Checking counts orders: #0552 #0553 #0554 (got ${R.checking(b).map((o) => o.id).join()})`);
  t.check(R.jobs(b, now) === 1, `Needs you counts jobs: Kiseka's Not found line, nothing to ask (got ${R.jobs(b, now)})`);
  const tn = R.tiles(b, now);
  t.check(tn.toask === 0 && tn.asked === 1 && tn.found === 3 && tn.ontrip === 0, 'tiles count suppliers: 0 to ask, 1 asked, 3 found, 0 on the trip');
  t.check(R.planStops(b).length === 3 && P.planNow(b).stops.filter((s) => !s.off).length === 3, 'the red + and the Plan: 3 stops');
  // A planned trip whose stop holds only a held line (the Ridge cap, Price up): that is no stop (before: + 3 vs plan 2).
  b.trip = { id: 'x', state: 'planned', handedInAt: null, cash: { amount: 0, askedAt: null, givenAt: null, by: null }, stops: [
    ...R.tripPlan(b).stops, { supplierId: 's-katwe', lines: [{ orderId: 552, key: 'L1' }], planned: 270000, paid: null, done: false, off: false }] };
  t.check(R.planStops(b).length === 3 && P.planNow(b).stops.length === 3, 'a stop of held lines only is not a stop, on the + and on the Plan');
  b.trip = null;
  t.check(R.record(b.suppliers.find((s) => s.id === 's-namanve')).yes === 9 && R.recordWord({ yes: 9, asks: 10 }) === 'said yes 9 of 10 asks', 'a supplier\'s record: said yes 9 of 10 asks');
  t.check(R.record({ found: 0, asked: 0 }) === null, 'a record of 0 of 0 is hidden');
  t.check(R.unitOr('', 'bag') === 'bag' && R.unitOr(null, '') === 'each' && R.unitOr('pcs', 'bag') === 'pcs', 'a missing unit: the line\'s, else each');
  t.check(R.UNIT.tile === 'supplier' && R.UNIT.checking === 'order' && R.UNIT.needs === 'job' && R.UNIT.stop === 'stop', 'each number has its unit word');

  /* ---- BUY-09: "was" is the line's own old cost, never the list's current price ---- */
  const SR = require(path.join(ROOT, 'src/apps/buyer/suppliers/rules.ts'));
  b = await d.books();
  b.prices.find((x) => x.item === 'Ridge cap 3 m').price = 25000;
  const capB = SR.boughtFrom(b, 's-namanve', now).find((x) => x.price.item === 'Ridge cap 3 m');
  t.check(capB.was === 24000 && capB.now === 27000, `Ridge cap: 27,000, was 24,000 (its own old cost), not the list's 25,000 (got was ${capB && capB.was})`);

  /* ---- BUY-11: a time not today carries its day ---- */
  const at = (day, hm) => T.at(day, hm);
  const noon = at('2026-11-12', '12:00');
  t.check(T.whenShort(at('2026-11-12', '9:31'), noon) === '09:31', 'today: 09:31');
  t.check(T.whenShort(at('2026-11-11', '15:41'), noon) === 'Yesterday 15:41', 'yesterday: Yesterday 15:41');
  t.check(T.whenShort(at('2026-11-10', '10:00'), noon) === 'Tue 10 Nov', 'older: Tue 10 Nov');
  t.check(T.clock(at('2026-11-12', '9:31')) === '9:31' && T.when(at('2026-11-11', '15:41'), noon) === 'Wed 15:41', 'Sales keeps clock and when as they were');

  /* ---- BUY-14: take back a cash ask Esther has not given ---- */
  d = buyerDemo('?demo&state=cash', { instant: true });
  t.check(d.shop.trip.state === 'cash' && d.shop.trip.cash.givenAt == null, 'the cash demo: the ask waits on Esther');
  await d.takeBackCash();
  t.check(d.shop.trip.state === 'planned' && d.shop.trip.cash.askedAt == null, 'taken back: the plan is open again');
  try { await d.takeBackCash(); t.check(false, 'a second take back should be refused'); }
  catch (e) { t.check(e.kind === 'refused' && e.message === 'Esther has given it', `nothing to take back: refused (${e.message})`); }
  d = buyerDemo('?demo&state=trip', { instant: true });
  try { await d.takeBackCash(); t.check(false, 'a given ask should be refused'); }
  catch (e) { t.check(e.kind === 'refused' && e.message === 'Esther has given it', 'a given ask is never taken back: Esther has given it'); }

  /* ---- offline writes are refused as offline (the outbox keeps them) ---- */
  d = buyerDemo('?demo&offline=1', { instant: true });
  try { await d.ask('s-namanve', 'whatsapp'); t.check(false, 'offline ask should fail'); }
  catch (e) { t.check(e.kind === 'offline', 'offline: the write fails as offline'); }

  process.exit(t.done() ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
