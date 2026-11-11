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

  {
/* ---- cross-app round 1 (docs/audit/cross-app/ROUND-1.md): the handoff cases ---- */
  d = buyerDemo('?demo&state=handoff', { instant: true });
  b = await d.books(); now = d.now();
  const o560 = b.orders.find((o) => o.id === 560), o561 = b.orders.find((o) => o.id === 561), o562 = b.orders.find((o) => o.id === 562);
  // BUY-1: a cancel asked holds the order out of every count, ask and trip.
  t.check(o560.hold && o560.hold.by === 'Grace' && !R.liveOrders(b).includes(o560) && R.heldOrders(b)[0] === o560, 'BUY-1: #0560 is on hold, not live');
  t.check(!R.lineRefs(b).some((r) => r.order.id === 560), 'BUY-1: none of its lines is to ask, asked or found');
  t.check(!R.tripPlan(b).stops.some((st) => st.lines.some((x) => x.orderId === 560)) && R.toBuy(b) === 3500000, `BUY-1: off the trip; To buy today stays 3,500,000 (got ${R.toBuy(b)})`);
  t.check(!R.readyForBuying(o560), 'BUY-1: a held order never moves to Buying by itself');
  // BUY-2: a line with no supplier is No supplier, never To ask; Today counts suppliers only.
  t.check(R.lineState(o562, o562.lines[0]) === 'nosupplier' && R.WORD.nosupplier === 'No supplier' && R.TONE.nosupplier === 'bad', 'BUY-2: #0562\'s hinge reads No supplier (red)');
  const tl1 = R.tiles(b, now), ag1 = R.askGroups(b, now);
  t.check(tl1.toask === ag1.length, `BUY-2: the To ask tile counts the Ask rows (tile ${tl1.toask}, rows ${ag1.length})`);
  t.check(tl1.suppliers === 7 && tl1.foundSuppliers === 3, `BUY-2: 3 of 7 suppliers found (5 + Katwe + the hinge's one to find; got ${tl1.foundSuppliers} of ${tl1.suppliers})`);
  // BUY-3: a line sold with no price is asked like any other, tagged; Found waits off the trip.
  const lip = o561.lines[0];
  t.check(lip.priceTag === 'coming' && !lip.ruthDecides && R.lineState(o561, lip) === 'toask', 'BUY-3: #0561\'s edging lipping is To ask, tagged Price coming');
  t.check(ag1.some((g) => g.supplier.id === 's-katwe' && g.orders.includes(o561)), 'BUY-3: Katwe is in Needs you for it');
  t.check(R.priceTagWord('coming', 'Ruth') === 'Price coming · Ruth' && R.priceTagWord('decides', 'Ruth') === 'Ruth decides the price', 'BUY-3 + Q2: the tags\' words');
  await d.ask('s-katwe', 'whatsapp');
  await d.answerYes('s-katwe');
  b = await d.books();
  const lip2 = b.orders.find((o) => o.id === 561).lines[0], plan1 = R.tripPlan(b);
  t.check(R.lineState(b.orders.find((o) => o.id === 561), lip2) === 'found' && plan1.held.some((r) => r.line === lip2) && !plan1.stops.some((st) => st.supplierId === 's-katwe'), 'BUY-3: Found, held off the trip until Ruth prices it');
  t.check(R.heldWord(plan1.held.find((r) => r.line === lip2), 'Ruth') === 'Price coming · Ruth' && !R.readyForBuying(b.orders.find((o) => o.id === 561)), 'BUY-3: held as "Price coming · Ruth"; the order stays in Checking');
  }

  /* ---- offline writes are refused as offline (the outbox keeps them) ---- */
  d = buyerDemo('?demo&offline=1', { instant: true });
  try { await d.ask('s-namanve', 'whatsapp'); t.check(false, 'offline ask should fail'); }
  catch (e) { t.check(e.kind === 'offline', 'offline: the write fails as offline'); }

  process.exit(t.done() ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
