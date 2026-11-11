#!/usr/bin/env node
'use strict';
/*
 * The Today area's rules (src/core/store/jobs.ts, counts.ts, shift.ts, ruth.ts, outbox.ts, faces.ts):
 * the day's jobs and the red button's badge give TD01's figures back out of the demo (5 ready, 2 later,
 * 5 done), the Next job and its "then", Needs you, a count due (21 days, screens Q10), Pass the yard's
 * plan and Close the yard's checks, what waits on Ruth, and Waiting to send in the yard's words.
 *
 * Run: node test/store-today.test.js   (or: npm test)
 */
const path = require('path');
const { ROOT, createReporter } = require('./_extract');

const t = createReporter('store today');
const J = require(path.join(ROOT, 'src/core/store/jobs.ts'));
const C = require(path.join(ROOT, 'src/core/store/counts.ts'));
const S = require(path.join(ROOT, 'src/core/store/shift.ts'));
const R = require(path.join(ROOT, 'src/core/store/ruth.ts'));
const O = require(path.join(ROOT, 'src/core/store/outbox.ts'));
const F = require(path.join(ROOT, 'src/core/store/faces.ts'));
const T = require(path.join(ROOT, 'src/core/time.ts'));
const { storeDemo } = require(path.join(ROOT, 'src/core/store/demo/index.ts'));

const day = async (q) => { const d = storeDemo(q, { instant: true }); const b = await d.snapshot(); return { d, b, now: d.now(), me: b.me.id }; };

(async () => {
  /* ---- 10:41: TD01 ---- */
  let { d, b, now, me } = await day('?demo');
  let j = J.yardJobs(b, me, now);
  const keys = (l) => l.map((x) => x.key).join(',');
  t.check(J.badge(j) === 5, `the red button's badge is 5 at 10:41 (got ${J.badge(j)})`);
  t.check(keys(J.readyJobs(j)) === 'pack:552,pack:556,return:ret-0548,report:p-is28,count:Fasteners', `ready: carry on #0552, #0556, #0548's return, the bent sheets, aisle C (got ${keys(J.readyJobs(j))})`);
  t.check(keys(J.laterJobs(j)) === 'trip:TRIP-1017B-1,trip:TRIP-HIMA-1', 'later: Denis\'s trip (~11:30) and Hima Cement (12:00)');
  t.check(J.jobsLeft(j) === 7, '7 jobs left');
  t.check(J.doneToday(b, now).length === 5, `5 done (got ${J.doneToday(b, now).length})`);
  const nx = J.nextJobs(j);
  t.check(nx.next.kind === 'carry-on' && nx.next.route === 'pack/order' && nx.next.params.id === 552 && nx.then.orderId === 556, 'Next job: carry on packing #0552 (pack/order), then #0556');
  t.check(keys(J.needsYou(j, now)) === 'return:ret-0548,trip:TRIP-1017B-1,report:p-is28,count:Fasteners', 'Needs you 4: the return, Denis\'s trip (within the hour), the bent sheets, aisle C; not Hima at 12:00');
  t.check(J.waitingOnOthers(b, me, now).map((o) => o.id).join() === '530', 'waiting on others: #0530, not paid yet, the yard taps nothing');
  t.check(!j.some((x) => x.orderId === 530), 'Not paid yet is never a job (IM-07)');

  /* ---- counts: countDue (screens Q10) ---- */
  t.check(C.COUNT_DUE_DAYS === 21 && C.FRESH_DAYS === 14, 'due after 21 days; the ring is fresh within 14 (open, Q10)');
  const it = (x) => b.items.find((i) => i.key === x);
  t.check(C.countAge(it('p-wn3').countedAt, now) === 30, 'aisle C was counted 30 days ago (by the calendar)');
  t.check(C.countDue(it('p-wn3'), b, now) && !C.countDue(it('p-is28'), b, now), 'Wire nails 3" is due; Iron sheet G28 (counted Thu) is not');
  t.check(!C.countDue(it('p-cn2'), b, now), 'nothing on the shelf: not due');
  t.check(C.countDue({ ...it('p-is28'), countedAt: now - 22 * 864e5 }, b, now) && !C.countDue({ ...it('p-is28'), countedAt: now - 20 * 864e5 }, b, now), '22 days: due; 20 days: not');
  t.check(C.countDue(it('p-is28'), { counts: [{ id: 'x', aisle: 'Spot count · Iron sheet', place: 'item:p-is28', lines: [], missing: [], status: 'recount', createdAt: now }] }, now), 'Ruth asked a recount: due whatever the date');
  t.check(C.aislesDue(b, now).map((a) => `${a.letter}:${a.days}`).join() === 'C:30', 'aisles due: C, 30 days');
  t.check(C.aislesDue({ ...b, counts: [...b.counts, { id: 'y', aisle: 'Aisle C · Fasteners', place: 'aisle:fasteners', lines: [], missing: [], status: 'sent', createdAt: now }] }, now).length === 0, 'an aisle count waiting on Ruth: not due again');

  /* ---- Ruth, the shift ---- */
  const r = R.withRuth(b, me, now);
  t.check(r.map((x) => `${x.kind}:${x.state}`).join() === 'return:yours,count:with-ruth,unpaid:with-ruth,cancel:with-ruth,count:answered', 'With Ruth: the return yours first, then the count, #0530 and the copy with her, aisle A answered');
  const plan = S.passPlan(b, me, now);
  t.check(plan.jobs === 7 && plan.asks === 4 && plan.orders.map((o) => o.id).join() === '552' && plan.bays.join() === '1', 'Pass the yard: 7 jobs · 4 asks; #0552 (bay 1) moves');
  t.check(keys(plan.moves) === 'pack:552,return:ret-0548,count:Fasteners', 'what moves: #0552, the return, aisle C (not the shared queue, not the phone\'s draft)');
  const m = S.mates(b, me);
  t.check(m[0].p.name === 'Okello Peter' && m[0].can && m.some((x) => x.p.name === 'Joy Namata' && !x.can) && m.some((x) => x.p.name === 'Hassan' && x.why === 'no-login'), 'mates: Okello on (prefilled), Joy away, Hassan no yard login');
  t.check(S.passPayload(plan, m[0].p).toStaffId === 'st-op' && S.passPayload(plan, m[0].p).orders.join() === '552', 'W22 payload to Okello');
  ({ b } = await day('?demo&state=nobody'));
  t.check(!S.mates(b, b.me.id).some((x) => x.can), 'nobody else on: no one to pick (TD24)');

  /* ---- 11:32: TD02; 15:10: TD03 ---- */
  ({ d, b, now, me } = await day('?demo&at=1132'));
  j = J.yardJobs(b, me, now);
  t.check(J.nextJobs(j).next.kind === 'checkin' && J.nextJobs(j).next.route === 'in/checkin' && J.badge(j) === 5 && J.laterJobs(j).length === 1, '11:32: Denis\'s trip back first (Check it in), 5 ready, 1 later');
  ({ d, b, now, me } = await day('?demo&at=1510'));
  t.check(J.nextJobs(J.yardJobs(b, me, now)).next.kind === 'ride', '15:10: the ride to Katwe Timber is the Next job');

  /* ---- 17:30: TD04, TD16, TD28 ---- */
  ({ d, b, now, me } = await day('?demo&at=1730'));
  j = J.yardJobs(b, me, now);
  t.check(J.badge(j) === 1 && j[0].kind === 'close' && J.jobsLeft(j) === 0, '17:30: 0 jobs left, Close the yard is the one job (badge 1)');
  let ck = S.closeChecks(b, me, now, []);
  t.check(!S.canClose(ck) && S.checksDone(ck) === 3 && ck.length === 4, '3 of 4: the return is not set aside, the slide is off (TD28)');
  const ret = ck.find((c) => c.kind === 'return').ret.id;
  ck = S.closeChecks(b, me, now, [ret]);
  t.check(S.canClose(ck) && S.checksDone(ck) === 4, 'set aside: 4 of 4 (TD16)');
  t.check(ck.find((c) => c.kind === 'bay').orders[0].id === 530 && ck.find((c) => c.kind === 'ruth').tone === 'carries', '#0530 stays on bay 2; the count with Ruth carries over');
  t.check(S.baysTonight(b, me, now).find((x) => x.bay === 2).order.id === 530, 'bays tonight: #0530 on bay 2');
  t.check(S.closePayload(b, me, now, [ret]).shelved.join() === ret && S.closePayload(b, me, now, [ret]).carries.join() === '530', 'W23 payload: the return shelved, #0530 carries');
  await d.closeYard(S.closePayload(b, me, now, [ret]));
  b = await d.snapshot();
  t.check(J.closedToday(b, now) && !J.yardJobs(b, me, now).some((x) => x.kind === 'close'), 'closed: no close job again today');

  /* ---- Okello's phone: TD15, TD32 ---- */
  ({ d, b, now } = await day('?demo&as=okello&at=1043'));
  const ask = S.handoverFor(b, b.me, now);
  t.check(ask && ask.status === 'sent' && J.badge(J.yardJobs(b, b.me.id, now)) === 5, 'Okello\'s Today: Musa passed you the yard; 5 ready');
  await d.gotYard(ask.id);
  b = await d.snapshot();
  t.check(S.handoverFor(b, b.me, now).status === 'accepted', 'I\'ve got it: the yard is his');

  /* ---- Waiting to send, faces ---- */
  ({ d, b } = await day('?demo&offline&kept=1'));
  t.check(d.kept.length === 2, '&kept seeds two kept writes');
  t.check(O.keptLine(d.kept[0], b).title === '#0552 · 40 pc packed' && O.keptLine(d.kept[0], b).who.name === 'Grace Akello', '"#0552 · 40 pc packed", Grace sees it');
  t.check(O.keptLine(d.kept[1], b).title === 'Report · 3 bent sheets' && O.keptLine(d.kept[1], b).who.name === 'Ruth Nakato', '"Report · 3 bent sheets", Ruth sees it');
  const o552 = b.orders.find((o) => o.id === 552), o555 = b.orders.find((o) => o.id === 555);
  t.check(F.orderFace(o552, b).initials === 'KC' && F.orderFace(o552, b).tint === 't0' && F.orderFace(o555, b).initials === 'WI', 'faces: Kato KC, a walk-in WI');
  t.check(T.clock(now) === '10:43', 'the clock');

  process.exit(t.done() ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
