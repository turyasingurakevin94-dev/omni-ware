#!/usr/bin/env node
'use strict';
/*
 * The Store core (src/core/store): the yard's rules give FACTS.md's figures back out of the
 * demo, the demo's writes move the yard as the server would, the later moments and what-ifs
 * hold, offline and &fail=… say what the bars say, Undo 10 s holds a write, and no money
 * reaches the yard.
 *
 * Run: node test/store-core.test.js   (or: npm test)
 */
const path = require('path');
const { ROOT, createReporter } = require('./_extract');

const t = createReporter('store core');
const Y = require(path.join(ROOT, 'src/core/store/yard.ts'));
const E = require(path.join(ROOT, 'src/core/store/errors.ts'));
const K = require(path.join(ROOT, 'src/core/store/keys.ts'));
const { Held } = require(path.join(ROOT, 'src/core/store/held.ts'));
const { storeDemo } = require(path.join(ROOT, 'src/core/store/demo/index.ts'));
const { readStoreFlags } = require(path.join(ROOT, 'src/core/store/demo/flags.ts'));
const { WRITES } = require(path.join(ROOT, 'src/core/store/source.ts'));
const T = require(path.join(ROOT, 'src/core/time.ts'));

const demo = (q = '?demo') => storeDemo(q, { instant: true });
const no = (id) => '#' + String(id).padStart(4, '0');

(async () => {
  /* ---- 10:41, FACTS §2 ---- */
  let d = demo(), b = await d.snapshot(), me = b.me.id, now = d.now();
  t.check(T.clock(now) === '10:41' && T.dayLabel(now) === 'Sat 17 Oct', 'the demo opens Sat 17 Oct 10:41');
  t.check(b.me.name === 'Musa Kiggundu' && b.me.initials === 'MK' && b.onSince === T.at('2026-10-17', '7:30'), 'Musa holds the phone, on since 7:30');
  const c = Y.counts(b, me, now);
  t.check(c.toPack === 1, `To pack 1 (got ${c.toPack})`);
  t.check(c.packingNow === 1, `Packing now 1 (got ${c.packingNow})`);
  t.check(c.packed === 1, `Packed 1 (got ${c.packed})`);
  t.check(c.onTheRoad === 3 && c.readyToCollect === 1, `On the road 3, 1 of them ready to collect (got ${c.onTheRoad}, ${c.readyToCollect})`);
  t.check(c.deliveredToday === 1 && c.collectedToday === 1, `Delivered today 1, collected (got ${c.deliveredToday})`);
  t.check(c.waitingOnGoods === 2, `Waiting on goods +2 (got ${c.waitingOnGoods})`);
  const at = (stage) => Y.ordersAt(b, stage, me, now).map((o) => o.id).join();
  t.check(at('to-pack') === '556' && at('packing') === '552' && at('packed') === '530' && at('ready') === '555' && at('road') === '534,547', 'each order on its stage: #0556 to pack, #0552 packing, #0530 packed, #0555 ready, #0534 #0547 on the road');
  t.check(at('waiting') === '546,549' || at('waiting') === '549,546', 'waiting on goods: #0549, #0546');
  const o = (id) => b.orders.find((x) => x.id === id);
  t.check(Y.stageOf(o(557), b, me, now) === 'look' && Y.stageWord(o(557), 'look', me) === 'Look only · a copy', '#0557, the copy, is Look only');
  t.check(Y.stageWord(o(552), 'packing', me) === 'Packing now · yours', '#0552: "Packing now · yours"');
  t.check(Y.stageWord(o(552), 'packing', 'st-op') === 'Packing now', 'on Okello\'s phone #0552 is "Packing now"');
  t.check(Y.stageWord(o(530), 'packed', me) === Y.NOT_PAID && Y.NOT_PAID === 'Not paid yet', '#0530 reads "Not paid yet", a label');
  t.check(Y.stageWord(o(555), 'ready', me) === 'Ready to collect · Not paid yet', '#0555: "Ready to collect · Not paid yet"');
  t.check(Y.stageWord(o(534), 'road', me) === 'On the road · Ssali', '#0534: "On the road · Ssali"');
  t.check(Y.stageWord(o(543), 'delivered', me) === 'Delivered · collected', '#0543: "Delivered · collected"');
  t.check(Y.destinationOf(o(552), b.customers) === 'Ntinda site, Plot 12, Ntinda Rd' && o(552).deliverWhen === 'today afternoon' && o(552).deliverPhone === '0772 418 220', '#0552 reads its own place, time and phone');
  t.check(Y.isPickup(o(556), b.customers) && !Y.isPickup(o(530), b.customers), '#0556 they collect; #0530 we deliver');
  t.check(Y.moneyHeld(o(552)) && Y.moneyHeld(o(530)) && Y.moneyHeld(o(555)) && !Y.moneyHeld(o(556)), 'held for the money: #0552, #0530, #0555 (ready to collect too, 0182)');
  t.check(o(552).lines[2].dropped && !Y.awaitsGoods(o(552)), '#0552\'s hinge is dropped and waits for nothing');
  t.check(b.bays === 4 && o(552).bay === 1 && o(530).bay === 2, 'bays: #0552 on 1, #0530 on 2, 4 bays');

  /* ---- the shelf: FACTS' figures are the books less what has left for orders not invoiced ---- */
  const shelf = (key) => {
    const it = b.items.find((x) => x.key === key);
    const gone = b.orders.filter((x) => !x.invoiced && !Y.isCancelled(x) && (x.pickingStatus === 'done' || x.status === 'pending_delivery' || x.status === 'completed' || x.status === 'preparing'))
      .reduce((n, x) => n + x.lines.filter((l) => l.key === key && (l.pickStatus === 'done' || l.pickStatus === 'short')).reduce((m, l) => m + (l.pickedQty || 0), 0), 0);
    return Math.max(0, it.books - gone);
  };
  t.check(shelf('p-is28') === 412 && shelf('p-cem') === 120 && shelf('p-wn4') === 18 && shelf('p-rc28') === 34 && shelf('p-gp') === 2, 'shelf: Iron sheet 412, Cement 120, Wire nails 18, Ridge cap 34, Gloss paint 2');
  t.check(b.aisles.length === 12 && b.aisles[0] === 'Roofing' && b.aisles[2] === 'Fasteners', '12 aisles, A Roofing … C Fasteners');

  /* ---- what comes in, the counts, the alerts ---- */
  const live = b.trips.filter((x) => !x.yardCheckedAt);
  t.check(K.roundsOf(live).length === 2, `coming in: Denis's trip (2 stops, one round) and Hima Cement (got ${K.roundsOf(live).length})`);
  t.check(b.trips.find((x) => x.id === 'TRIP-HIMA-1').runnerId === '__supplier__', 'Hima Cement is a supplier\'s delivery');
  t.check(b.counts.find((x) => x.status === 'sent').lines[0].counted === 17, 'the Wire nails spot count, 17, waits on Ruth');
  t.check(b.alerts.filter((a) => a.forYou).length === 2, 'two alerts today are for Musa (the bell)');
  t.check(b.returns[0].orderId === 548 && b.returns[0].lines[0].qty === 2, '#0548: 2 bag coming back');

  /* ---- no money on the yard's phone ---- */
  const json = JSON.stringify(await demo('?demo&at=1730').snapshot()) + JSON.stringify(b);
  t.check(!/"(price|cost|amount|paid|total|sellPrice|balance|owes)"/i.test(json) && !/UGX/.test(json), 'the demo yard holds no price, cost, amount, total or UGX');

  /* ---- the moments (FACTS §8) ---- */
  const countsAt = async (q) => { const x = demo(q), y = await x.snapshot(); return { d: x, b: y, c: Y.counts(y, y.me.id, x.now()) }; };
  let m = await countsAt('?demo&at=1047');
  t.check(T.clock(m.d.now()) === '10:47' && !Y.moneyHeld(m.b.orders.find((x) => x.id === 555)), '10:47: #0555 is paid, at the gate');
  m = await countsAt('?demo&at=11:30');
  t.check(T.clock(m.d.now()) === '11:30' && K.roundsOf(m.b.trips.filter((x) => x.status === 'collected' && !x.yardCheckedAt)).length === 1, '11:30: Denis\'s trip back at the yard (one check-in)');
  m = await countsAt('?demo&at=1200');
  t.check(m.c.waitingOnGoods === 0 && m.b.trips.find((x) => x.id === 'TRIP-HIMA-1').status === 'collected', '12:00: the trip checked in (nothing waits on goods), Hima at the gate');
  m = await countsAt('?demo&at=1405');
  t.check(m.b.orders.find((x) => x.id === 552).carrier.name === 'Ssali' && m.b.orders.find((x) => x.id === 552).status === 'pending_delivery', '14:05: #0552 on the road with Ssali');
  m = await countsAt('?demo&at=1510');
  t.check(m.b.trips.some((x) => x.supplierName === 'Katwe Timber' && x.runnerId === 'st-mk'), '15:10: Denis sent Musa to Katwe Timber');
  m = await countsAt('?demo&at=1730');
  t.check(m.c.toPack === 0 && m.c.onTheRoad === 0 && m.c.packed === 1, '17:30: the yard is clear but #0530, which stays the night on its bay');

  /* ---- the what-ifs ---- */
  m = await countsAt('?demo&state=cancel-0530');
  t.check(m.c.cancelled === 1 && Y.stageWord(m.b.orders.find((x) => x.id === 530), 'cancelled', null) === 'Cancelled · put it back', '#0530 cancelled on bay 2: "Cancelled · put it back"');
  m = await countsAt('?demo&state=cancel-0534');
  t.check(Y.stageWord(m.b.orders.find((x) => x.id === 534), 'cancelled', null) === 'Cancelled · bring it back', '#0534 cancelled on the truck: "Cancelled · bring it back"');
  m = await countsAt('?demo&state=ggaba-closed');
  t.check(m.c.comingBack === 1 && m.c.onTheRoad === 3, '#0547 coming back, still On the road');
  m = await countsAt('?demo&state=agent');
  t.check(m.c.readyToCollect === 2 && Y.isPickup(m.b.orders.find((x) => x.id === 554), m.b.customers), '#0554, the agent\'s pickup, ready at the gate');
  m = await countsAt('?demo&state=empty');
  t.check(m.b.orders.length === 0 && m.b.trips.length === 0, 'empty: nothing in the yard');
  m = await countsAt('?demo&as=okello');
  t.check(m.b.me.name === 'Okello Peter' && m.b.asks.some((a) => a.kind === 'handover' && a.status === 'sent'), 'as Okello: Musa passed him the yard');
  t.check((await demo('?demo&state=signed-out').session()) === null, 'signed out: no session (the sign-in)');
  const f = readStoreFlags('?demo&at=10:47&offline&fail=checkIn&big=1');
  t.check(f.at === 1047 && f.offline && f.fail === 'checkIn' && f.big && !f.update, 'flags read: at, offline, fail, big');

  /* ---- writes ---- */
  d = demo(); b = d.day;
  await d.claim(556);
  t.check(b.orders.find((x) => x.id === 556).pickingStatus === 'in_progress' && b.orders.find((x) => x.id === 556).assignedWorkerId === 'st-mk', 'W1: the first Packed claims #0556 for Musa');
  await d.pick(556, [{ idx: 0, status: 'done', qty: 2 }, { idx: 1, status: 'done', qty: 1 }], 2);
  await d.finishPack(556, 3);
  const o556 = b.orders.find((x) => x.id === 556);
  t.check(o556.status === 'pending_delivery' && !o556.carrier && Y.stageOf(o556, b, 'st-mk', d.now()) === 'ready', 'W3\': a packed pickup is Ready to collect (On the road, no carrier)');
  let err = null;
  try { await d.load([530], { kind: 'staff', name: 'Hassan', what: '', phone: '', staffId: 'st-hs' }); } catch (e) { err = e; }
  t.check(err && err.code === 'OWCSH' && E.notDone(err, 'load').text === 'Not paid yet · it leaves when paid', 'W8: an unpaid order cannot be loaded (the money gate), said "Not paid yet"');
  err = null;
  try { await d.handOver(555, 'Walk-in', false); } catch (e) { err = e; }
  t.check(err && err.code === 'OWCSH', 'W9: an unpaid pickup is not handed over');
  const d2 = demo('?demo&at=1047');
  await d2.handOver(555, 'Walk-in', false);
  t.check(d2.day.orders.find((x) => x.id === 555).status === 'completed' && d2.day.orders.find((x) => x.id === 555).carrier.kind === 'client', 'W9: #0555, paid, handed over at the gate: Delivered · collected');
  await d.cantDeliver(547, 'Closed');
  t.check(b.orders.find((x) => x.id === 547).comingBack.why === 'Closed', 'W27: can\'t deliver keeps #0547 On the road, coming back');
  const d3 = demo('?demo&at=1130');
  const round = d3.day.trips.filter((x) => x.id.startsWith('TRIP-1017B-'));
  await d3.checkIn(round.flatMap((x) => x.lines.map((l) => ({ trip: x.id, idx: l.idx, counted: l.gotQty }))));
  const c3 = Y.counts(d3.day, 'st-mk', d3.now());
  t.check(c3.waitingOnGoods === 0 && c3.toPack === 3, `W14: checking in Denis's trip moves #0549 and #0546 to To pack (got ${c3.toPack} to pack, ${c3.waitingOnGoods} waiting)`);
  await d.sendCount({ aisle: 'Spot count · Wire nails 4" · 25kg ctn', lines: [{ key: 'p-wn4', productId: 'p-wn4', variantIdx: null, name: 'Wire nails', counted: 18, system: 18, held: 2 }], missing: [] });
  t.check(b.counts.filter((x) => x.place === 'item:p-wn4' && x.status === 'sent').length === 1, 'W20: one waiting count per place (counting it again replaces it)');
  await d.putBack(530);
  const pb = b.orders.find((x) => x.id === 530);
  t.check(!pb.putBack, 'W7: a put-back on an order not called off writes nothing (0182)');

  /* ---- offline and &fail ---- */
  const off = demo('?demo&offline');
  err = null;
  try { await off.claim(556); } catch (e) { err = e; }
  t.check(err && err.kind === 'offline' && E.notDone(err, 'claim').tone === 'offline', 'offline: a write is refused as no signal (the outbox keeps it; the amber bar)');
  t.check(T.clock((await off.snapshot()).at) === '7:52' && !off.online(), 'offline: the copy saved 7:52');
  const fl = demo('?demo&at=1130&fail=checkIn');
  err = null;
  const line0 = fl.day.trips.find((x) => x.id === 'TRIP-1017B-1').lines[0];
  try { await fl.checkIn([{ trip: 'TRIP-1017B-1', idx: 0, counted: line0.gotQty }]); } catch (e) { err = e; }
  const nd = err && E.notDone(err, 'checkIn');
  t.check(nd && nd.tone === 'failed' && E.notDoneLine(nd) === 'That did not save · tell Kevin · code CI-502', `&fail=checkIn: "That did not save · tell Kevin · code CI-502" (got ${nd && E.notDoneLine(nd)})`);
  await fl.checkIn([{ trip: 'TRIP-1017B-1', idx: 0, counted: line0.gotQty }]);
  t.check(!!fl.day.trips.find((x) => x.id === 'TRIP-1017B-1').yardCheckedAt, '&fail: Try again goes');
  err = null;
  try { await demo('?demo&fail=snapshot').snapshot(); } catch (e) { err = e; }
  t.check(err && E.notDoneLine(E.notDone(err, 'snapshot')) === 'Could not load the yard · code ST-104', 'a failed load: "Could not load the yard · code ST-104" (TD07)');
  t.check(E.notDone(Object.assign(new Error('x'), { kind: 'clash', code: '' }), 'pick').text === 'Someone else just did this · Refreshed', 'a clash: "Someone else just did this · Refreshed"');
  t.check(WRITES.every((w) => typeof d[w] === 'function' && E.WRITE_CODE[w]), `every write (${WRITES.length}) is on the demo and has its code letters`);

  /* ---- Undo 10 s ---- */
  let fire = null, sent = 0, undone = 0;
  const timer = { set: (fn) => { fire = fn; return 1; }, clear: () => { fire = null; }, now: () => 0 };
  const h = new Held(10000, timer);
  h.hold({ label: 'Packed #0552', send: () => { sent++; }, undo: () => { undone++; } });
  t.check(h.current && h.current.label === 'Packed #0552' && h.current.until === 10000, 'a held write waits 10 s');
  h.undo();
  t.check(sent === 0 && undone === 1 && !h.current, 'Undo: nothing goes');
  h.hold({ label: 'a', send: () => { sent++; } });
  h.hold({ label: 'b', send: () => { sent++; } });
  await Promise.resolve();
  t.check(sent === 1 && h.current.label === 'b', 'one at a time: holding a second sends the first');
  fire(); await Promise.resolve();
  t.check(sent === 2 && !h.current, 'its 10 s run out: it goes');

  /* ---- keys ---- */
  t.check(K.countPlace('Aisle C · Fasteners') === 'aisle:fasteners' && K.countPlace('Spot count · X', ['p-wn4']) === 'item:p-wn4', 'countPlace as ow_count_place');
  t.check(K.tripRoundKey({ id: 'TRIP-ABC-2', runnerId: 'st-do' }) === 'TRIP-ABC|st-do', 'tripRoundKey as ow_trip_round');
  t.check(no(552) === '#0552', 'order numbers as #0552');

  process.exit(t.done() ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
