#!/usr/bin/env node
'use strict';
/*
 * Goods in (src/core/store/checkin.ts, arrivals.ts, returns.ts, ride.ts): the rules the IN boards
 * draw, run on the demo's sample day (docs/canvas/store-agent/FACTS.md §3, §4, §8).
 *
 * Run: node test/store-in.test.js   (or: npm test)
 */
const path = require('path');
const { ROOT, createReporter } = require('./_extract');

const t = createReporter('store goods in');
const C = require(path.join(ROOT, 'src/core/store/checkin.ts'));
const A = require(path.join(ROOT, 'src/core/store/arrivals.ts'));
const R = require(path.join(ROOT, 'src/core/store/returns.ts'));
const D = require(path.join(ROOT, 'src/core/store/ride.ts'));
const { storeDemo } = require(path.join(ROOT, 'src/core/store/demo/index.ts'));
const T = require(path.join(ROOT, 'src/core/time.ts'));

const demo = (q = '?demo') => storeDemo(q, { instant: true });

(async () => {
  /* ---- IN01 Coming in at 10:41 ---- */
  let d = demo(), b = await d.snapshot();
  const all = A.arrivals(b, d.now());
  t.check(A.coming(all).length === 3, 'Coming in 3: Denis\'s trip, Hima Cement, the #0548 return');
  t.check(A.backNow(all).length === 0, 'nothing back yet');
  t.check(T.clock(A.nextDue(all)) === '11:00', 'next ~11:00 (the return)');
  const buying = all.find((a) => a.kind === 'buying');
  const st = A.stopsOf(buying.trip);
  t.check(st.length === 2 && st[0].state === 'done' && T.clock(st[0].at) === '9:50' && st[1].state === 'now', 'Owino 9:50 done, Kiseka now');
  t.check(buying.trip.lines.filter((l) => !l.notFound).length === 3 && buying.trip.stops.length === 2, 'one trip of 2 suppliers, 3 lines');
  const checked = all.filter((a) => a.kind === 'checked');
  t.check(checked.length === 1 && A.tripName('Denis', checked[0].trip, all) === "Denis's first trip", "Checked in today: Denis's first trip");
  t.check(A.tripName('Denis', buying.trip, all) === "Denis's trip", 'the trip on its way is just "Denis\'s trip"');
  const ret = all.find((a) => a.kind === 'return');
  t.check(ret && ret.ret.orderId === 548 && T.clock(ret.due) === '11:00', 'the return #0548 at ~11:00');
  t.check(A.coming(A.arrivals(await demo('?demo&state=empty').snapshot(), d.now())).length === 0, 'empty: nothing coming in (IN40)');

  /* ---- IN02–IN06 the check-in at 11:30 ---- */
  d = demo('?demo&at=1130'); b = await d.snapshot();
  const tr = C.tripOf(b, 'TRIP-1017B-2');
  t.check(tr && tr.id === 'TRIP-1017B-1' && tr.stops.length === 2 && tr.back, 'any stop opens the whole trip, back at the yard');
  t.check(C.toCount(tr).length === 3 && tr.lines.some((l) => l.notFound && l.asked === 6), '3 lines to count, the gutter bracket not found (6 pc)');
  const groups = C.groupsOf(tr, b.orders);
  t.check(groups.length === 2 && groups[0].orderId === 549 && groups[1].orderId === 546, 'grouped by where it goes: #0549, then #0546');
  t.check(C.shareOf({ orderId: 534 }, b.orders) === null, 'an order already delivered takes nothing: it goes on the shelf');
  t.check(JSON.stringify(C.quickTiles(1).values) === '[1,2,3,4]' && C.quickTiles(1).kind === 'few', '1 tin: tiles 1 2 3 4 and Other');
  t.check(C.quickTiles(100).step === 10 && C.quickTiles(100).values[11] === 120, '100 bag: stacks of 10 up to 120');
  t.check(C.quickTiles(20).values.includes(18), '20 pc: tiles of 2, so 18 is one tap');
  t.check(C.whyChips(18, 20)[0] === 'Never came' && C.whyChips(22, 20)[0] === 'Bought extra' && C.whyChips(20, 20).length === 0, 'why: under, over, none when it matches');

  const [nails, em, sheets] = C.toCount(tr);
  const draft = { counts: { [nails.id]: 4, [em.id]: 1 }, whys: {} };
  t.check(C.progress(tr, draft).done === 2 && !C.ready(tr, draft), '2 of 3 counted: not ready');
  draft.counts[sheets.id] = 18;
  t.check(!C.ready(tr, draft) && !C.lineDone(sheets, draft), '18 of 20 differs: not done until it says why');
  draft.whys[sheets.id] = C.MISCOUNTED;
  t.check(!C.lineDone(sheets, draft), '"I miscounted" keeps nothing');
  draft.whys[sheets.id] = 'Never came';
  t.check(C.ready(tr, draft), 'with a why: ready to slide');
  const out = C.outcome(tr, draft, b.orders);
  const o549 = out.orders.find((o) => o.orderId === 549), o546 = out.orders.find((o) => o.orderId === 546);
  t.check(o549.allIn && !o546.allIn && o546.got === 18 && o546.want === 20, '#0549 all in; #0546 18 of 20');
  t.check(out.differs.length === 1 && out.differs[0].diff === -2, '1 differs: 2 pc, for Ruth');
  const pay = C.payload(tr, draft);
  t.check(pay.length === 4 && pay.find((x) => x.idx === 1 && x.trip === 'TRIP-1017B-2').why === 'Never came' && pay.find((x) => x.idx === 2 && x.trip === 'TRIP-1017B-2').counted === 0, 'W14: every line, the difference with its why, the line not found as 0');
  t.check(C.countedWords(groups[0].lines, draft) === '4 box · 1 tin', '"4 box · 1 tin"');

  await d.checkIn(pay);
  b = await d.snapshot();
  const after = C.tripOf(b, 'TRIP-1017B-1');
  t.check(after.checkedAt != null && after.checkedBy === b.me.userId, 'checked in by this phone');
  t.check(b.orders.find((o) => o.id === 549).status === 'preparing' && b.orders.find((o) => o.id === 546).status === 'preparing', 'both orders move from Buying to Packing (IM-36)');
  t.check(C.draftOf(after).counts[sheets.id] === 18, 'the yard\'s count is kept on the trip (IN09 "18 pc · with Ruth")');

  /* ---- IN09 someone else checked it in first ---- */
  d = demo('?demo&at=1130&state=someone-checkin'); b = await d.snapshot();
  let clash = null;
  try { await d.checkIn(pay); } catch (e) { clash = e; }
  b = await d.snapshot();
  t.check(clash && clash.kind === 'clash' && b.trips.find((x) => x.id === 'TRIP-1017B-1').yardCheckedBy === 'u-op', 'someone-checkin: Okello checked it in, this phone\'s count is refused as a clash');

  /* ---- IN20–IN22 the return at the gate ---- */
  d = demo('?demo&at=1102'); b = await d.snapshot();
  const ra = R.returnAt(b, 548);
  t.check(ra.asked && ra.lines.length === 2 && ra.lines[0].asked === 2 && ra.lines[0].left === 3, 'Grace asked 2 of 3 bag; the glue not asked');
  const rd = R.startDraft(ra);
  t.check(rd.qty[0] === 2 && rd.condition[0] === 'damaged' && rd.qty[1] === 0, 'it starts at what was asked: 2 bag, Damaged');
  t.check(R.clampBack(ra.lines[0], 9) === 3 && R.clampBack(ra.lines[0], -1) === 0, 'never more than the line has left');
  t.check(!R.canSend(ra, rd, false) && R.canSend(ra, rd, true), 'it needs a photo');
  const ask = R.askOf(ra, rd, null);
  t.check(ask.lines.length === 1 && ask.lines[0].shown === '2 bag' && ask.reason === 'Damaged', 'W18 in the line\'s unit, damaged');
  await d.returnAsk(ask);
  b = await d.snapshot();
  t.check(R.returnAt(b, 548).mine && R.returnAt(b, 548).mine.status === 'sent', 'sent to Ruth: this phone\'s return');
  t.check(A.arrivals(b, d.now()).every((a) => a.kind !== 'return'), 'once checked at the gate it leaves Coming in');
  b = await demo('?demo&at=1130&state=return-decided').snapshot();
  t.check(R.returnAt(b, 548).mine.status === 'accepted' && T.clock(R.returnAt(b, 548).mine.decidedAt) === '11:20', 'return-decided: Ruth took it back 11:20 (IN22)');

  /* ---- IN30–IN32 ride a trip ---- */
  d = demo('?demo&at=1534'); b = await d.snapshot();
  const ride = D.rideOf(b, b.me.id);
  t.check(ride && ride.trip.stops[0].supplierName === 'Katwe Timber' && ride.driver && ride.driver.name === 'Hassan' && ride.phase === 'load', 'Musa rides to Katwe Timber, Hassan drives');
  t.check(A.arrivals(b, d.now()).every((a) => !a.trip || a.trip.id !== ride.trip.id), 'a ride is not in Coming in until it is handed in');
  const ticks = {};
  t.check(!D.allOn(ride.trip, ticks), 'nothing on the truck yet');
  ride.trip.lines.forEach((l) => { ticks[l.id] = l.expected; });
  t.check(D.allOn(ride.trip, ticks) && D.ticksFor(ride.trip, ride.trip.id, ticks)[0] === 10, 'All on: 10 pc');
  await d.rideTick(ride.trip.id, D.ticksFor(ride.trip, ride.trip.id, ticks));
  b = await d.snapshot();
  t.check(D.rideOf(b, b.me.id).phase === 'back', 'Done at Katwe: back to the yard, to hand in');
  await d.rideHandIn([ride.trip.id]);
  b = await d.snapshot();
  t.check(D.rideOf(b, b.me.id).phase === 'handed' && A.backNow(A.arrivals(b, d.now())).length === 1, 'handed in: back at the yard for someone else to check in');
  t.check(D.tripLineGot({ gotQty: 0 }) === 0 && D.tripLineGot({ gotQty: null }) === null, '0 is an answer; null is not');

  process.exit(t.done() ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
