#!/usr/bin/env node
'use strict';
/*
 * The Manager core (src/core/manager): the queue gives BRIEF.md's order back out of the
 * demo, the rules give its figures (on the move, age bands, stuck, limit chips, the
 * shop's price, same gain), every answer moves the books as its server function would
 * and takes the ask off the queue, &offline keeps writes, &fail and &clash say so.
 *
 * Run: node test/manager-core.test.js   (or: npm test)
 */
const path = require('path');
const { ROOT, createReporter } = require('./_extract');

const t = createReporter('manager core');
const Q = require(path.join(ROOT, 'src/core/manager/queue.ts'));
const W = require(path.join(ROOT, 'src/core/manager/watch.ts'));
const C = require(path.join(ROOT, 'src/core/manager/credit.ts'));
const P = require(path.join(ROOT, 'src/core/manager/price.ts'));
const WD = require(path.join(ROOT, 'src/core/manager/words.ts'));
const E = require(path.join(ROOT, 'src/core/manager/errors.ts'));
const { WRITES } = require(path.join(ROOT, 'src/core/manager/source.ts'));
const { managerDemo } = require(path.join(ROOT, 'src/core/manager/demo/index.ts'));

const demo = (q = '?demo') => managerDemo(q, { instant: true });

(async () => {
  /* ---- 09:40: the eight, in BRIEF's order ---- */
  let d = demo(), b = await d.snapshot();
  const q = Q.queue(b);
  t.check(q.map((a) => a.key).join() === 'storecredit:551,return:ia-547,price:552:1,loss:sr-31,price:555:0,cancel:ca-556,short:550,carton:rb-77',
    'the queue: the truck first, then oldest (D-7, D-18, D-3, D-16, D-1, D-20, D-12, D-24)');
  t.check(q.map((a) => Q.dOf(a)).join() === '7,18,3,16,1,20,12,24', 'each ask maps to its D number');
  t.check(q.map((a) => WD.waited(a.at, b.at)).join() === '25 m,3 h,2 h 10,1 h 30,1 h 05,50 m,40 m,15 m', 'the ages as the boards write them');
  t.check(Q.askerOf(b, q[0]).name === 'Musa Kiggundu' && Q.askerOf(b, q[2]).name === 'Denis Okello', 'who asked, by display name');
  t.check(Q.isSlide(q[1]) && Q.isSlide(q[3]) && !Q.isSlide(q[0]) && !Q.isSlide(q[5], b), 'return and write-off are slides; credit and a cancel with nothing paid are taps');
  t.check(Q.byAsker(b, q).map((g) => `${g.group}${g.count}`).join() === 'sales3,store3,buyer2', 'the queue bar: Sales 3 · Store 3 · Buyer 2');

  /* ---- the watch ---- */
  const move = W.onTheMove(b).reduce((s, o) => s + o.total, 0);
  t.check(move === 8_810_000 && W.onTheMove(b).length === 8, `on the move: 8 orders, 8,810,000 (got ${move})`);
  const bd = W.bands(b, '2026-10-17');
  t.check(bd.u7 === 878_000 && bd.u21 === 2_829_000 && bd.u30 === 662_000 && bd.o30 === 2_310_000, 'age bands 878,000 · 2,829,000 · 662,000 · 2,310,000');
  const st = W.stuck(b, b.at);
  t.check(st.length === 1 && st[0].o.id === 554 && Math.round(st[0].over) === 40, '#0554 is stuck, 40 m over its 2 h');
  t.check(W.toBillThemselves(b).map((o) => o.id).join() === '548,557', '#0548 and #0557 bill themselves');
  t.check(WD.hm(b.at) === '09:40', 'times with two digits');
  t.check(W.twins(b).some((x) => x.keep.id === 544 && x.drop.id === 545), '#0544 and #0545 look taken twice');

  /* ---- prices and credit ---- */
  t.check(P.shopPriceOf(27_000, 0.25) === 33_750 && P.sameGain(24_000, 26_000, 27_000) === 29_000, "Ridge cap: shop's 33,750, same gain 29,000");
  const o = P.priceOutcome(46_000, 38_000, 47_500, 30);
  t.check(o.total === 1_380_000 && o.gainTotal === 240_000 && o.underShopTotal === -45_000, 'Iron sheet at 46,000: 1,380,000, gain 240,000, −45,000 under the shop');
  t.check(P.underCost(36_000, 38_000) && !P.underCost(38_000, 38_000), 'never under cost; at cost is allowed');
  t.check(C.limitChoices(1_240_000, null).map((x) => C.limitChip(x.limit, x.days)).join() === '1.5M · 14 d,2M · 14 d,3M · 30 d', 'D-7 chips: 1.5M · 14 d, 2M · 14 d, 3M · 30 d');
  const kyal = b.customers.find((c) => c.id === 'kyaligonza');
  t.check(C.wouldOwe(kyal, b.orders.find((x) => x.id === 555)) === 3_690_000 && C.oldestDays(kyal, '2026-10-17') === 38, 'Kyaligonza would owe 3,690,000; oldest bill 38 days');
  t.check(C.creditWhy(kyal, b.orders.find((x) => x.id === 555), '2026-10-17', 21) === 'age', 'held for an old bill');

  /* ---- every answer moves the books and leaves the queue ---- */
  t.check(WRITES.every((w) => typeof d[w] === 'function'), 'the demo answers every write');
  await d.settlePick(550, false);
  b = await d.snapshot();
  t.check(!b.asks.some((a) => a.key === 'short:550') && b.orders.find((x) => x.id === 550).total === 1_710_000, 'Bill what went: #0550 bills 1,710,000, the ask leaves');
  t.check(b.done[0].word === 'Bill what went' && b.done[0].told.includes('musa') && b.done[0].told.includes('grace'), 'the answers log names Musa and Grace as told');
  await d.price(555, 0, 46_000, 'approved');
  await d.storeCredit(551, true, { limit: 1_500_000, days: 14 });
  b = await d.snapshot();
  t.check(b.customers.find((c) => c.id === 'nansana').limit === 1_500_000 && Q.queue(b).length === 5, 'On credit · load it sets Nansana 1.5M · 14 d; five left');
  await d.cancel('ca-556', 556, null);
  await d.writeOff(['sr-31'], []);
  await d.creditNote('ia-547', 547, [{ idx: 0, qty: 5, back: true }], false);
  b = await d.snapshot();
  t.check(b.customers.find((c) => c.id === 'lubowa').owes === 605_750, 'the credit note: Lubowa owes 605,750');
  let refused = null;
  try { await d.price(552, 1, 20_000, 'set'); } catch (e) { refused = e; }
  t.check(refused && refused.kind === 'refused', 'a price under cost is refused');

  /* ---- offline, fail, clash ---- */
  const off = demo('?demo&offline');
  let e1 = null; try { await off.settlePick(550, false); } catch (e) { e1 = e; }
  t.check(e1 && e1.kind === 'offline' && E.notDone(e1, 'settlePick').tone === 'offline', 'no signal: the write is kept (offline)');
  const f = demo('?demo&fail=settlePick');
  let e2 = null; try { await f.settlePick(550, false); } catch (e) { e2 = e; }
  t.check(e2 && E.notDoneLine(E.notDone(e2, 'settlePick')) === 'Not sent · code MG-502', 'a failed write: "Not sent" (its code kept apart, never on the face)');
  await f.settlePick(550, false);
  t.check(!(await f.snapshot()).asks.some((a) => a.key === 'short:550'), 'Try again sends it');
  const c2 = demo('?demo&clash=carton');
  let e3 = null; try { await c2.carton('rb-77', true); } catch (e) { e3 = e; }
  t.check(e3 && E.notDone(e3, 'carton').text === 'Someone else just did this · Refreshed', 'someone else answered first');

  /* ---- later moments ---- */
  const m = await demo('?demo&at=1005').snapshot();
  t.check(Q.queue(m).map((a) => a.key).join() === 'bill:561,price:562:0' && m.done.length === 10, '10:05: two can\'t bill themselves; the eight are in Today\'s answers');
  t.check((await demo('?demo&state=empty').snapshot()).asks.length === 0, 'empty: nothing waits');

  t.done();
})().catch((e) => { console.error(e); process.exit(1); });
