#!/usr/bin/env node
'use strict';
/*
 * The Store's Out rules (src/core/store/load.ts, gate.ts, door.ts) on the sample day: To load by
 * direction (OU01), who drives (OU02), hired drivers (OU03), the gate and the agent's code (OU10, OU09,
 * OU11), On the road and the door (OU20–OU28), and the demo's writes for load, hand over, deliver and
 * can't deliver (W8, W9, W10, W27).
 *
 * Run: node test/store-out.test.js   (or: npm test)
 */
const path = require('path');
const { ROOT, createReporter } = require('./_extract');

const t = createReporter('store out');
const L = require(path.join(ROOT, 'src/core/store/load.ts'));
const G = require(path.join(ROOT, 'src/core/store/gate.ts'));
const D = require(path.join(ROOT, 'src/core/store/door.ts'));
const Y = require(path.join(ROOT, 'src/core/store/yard.ts'));
const T = require(path.join(ROOT, 'src/core/time.ts'));
const { storeDemo } = require(path.join(ROOT, 'src/core/store/demo/index.ts'));

const demo = (q = '?demo') => storeDemo(q, { instant: true });
const o = (b, id) => b.orders.find((x) => x.id === id);

(async () => {
  /* ---- To load by direction, 10:52 (OU01) ---- */
  let d = demo('?demo&at=1052'), b = await d.snapshot(), side = await d.side(), me = b.me.id, now = d.now();
  let ds = L.directions(b, side, me, now);
  t.check(ds.length === 2, `two directions at 10:52 (got ${ds.length})`);
  t.check(ds[0].name === '→ Ntinda' && ds[0].named && ds[0].key === 'ntinda', 'the nearest first, named: → Ntinda');
  t.check(ds[1].name === '→ Bweyogerere way' && !ds[1].named && ds[1].compass === 'east', 'the other unnamed: → Bweyogerere way, east of the yard');
  t.check(ds[0].leavesAt != null && T.clock(ds[0].leavesAt) === '13:20', 'Ntinda leaves 13:20');
  t.check(L.runHeld(ds[0]) && L.runHeld(ds[1]), 'nothing can leave: both Not paid yet');
  t.check(L.driverOf(b, ds[0]) === 'st-ss', 'Ssali drives Ntinda: the run planned him, though he is out now');
  t.check(L.driversOf(b, ds[0]).map((p) => p.name).join() === 'Ssali,Hassan', 'the drivers offered: Ssali, Hassan');
  const tr = L.trucks(b);
  t.check(tr.length === 2 && tr[0].out && T.clock(tr[0].dueBack) === '12:10' && !tr[1].out, 'Trucks: Ssali out, back ~12:10; Hassan in the yard');
  t.check(L.roadsThatWay(side, b.shopName, ds[1]).join() === 'Bweyogerere,Kireka,Jinja Rd', 'the roads east: Bweyogerere, Kireka, Jinja Rd (OU31)');
  t.check(L.packWords(40, 'pc', 20, 'bundle') === 'pc · 2 bundles' && L.packWords(2, 'pc', 1, '') === 'pc', '"40 pc · 2 bundles", "2 pc"');

  /* ---- 13:15, the run (OU02) and the hired drivers (OU03) ---- */
  d = demo('?demo&at=1315'); b = await d.snapshot(); now = d.now();
  const run = L.runOf(b, side, me, now, 'ntinda');
  t.check(run && !L.runHeld(run) && run.drops.map((x) => x.o.id).join() === '552', 'the Ntinda run: #0552, paid');
  t.check(L.droveLast(b, 'Ntinda').name === 'Ssali', 'Ssali drove Ntinda last');
  t.check(L.etaMins(side, b.shopName, 'Ntinda') === 44, 'Ntinda is about 44 m away (arrives ~14:04 after 13:20)');
  const tt = L.trackTimes(o(b, 552));
  t.check(T.clock(tt.checking) === '9:14' && T.clock(tt.buying) === '9:31' && T.clock(tt.packing) === '10:05', '#0552 track: Checking 9:14 · Buying 9:31 · Packing 10:05');
  const h = L.pastHired(b, side);
  t.check(h.map((x) => x.name).join() === 'Abudu,Juma Ssekitto' && h[0].what === 'UAX 318K' && h[0].place === 'Ntinda', 'hired before: Abudu (UAX 318K, Ntinda), then Juma');
  t.check(L.hiredPhoneOk('0701 552 310') && L.hiredPhoneOk('+256 772 418 220') && !L.hiredPhoneOk('0412 345 678') && !L.hiredPhoneOk('0772 41'), 'a hired phone must be a Ugandan mobile');
  await d.load([552], { kind: 'staff', name: 'Ssali', what: '', phone: '', staffId: 'st-ss' });
  b = await d.snapshot();
  t.check(o(b, 552).status === 'pending_delivery' && o(b, 552).carrier.name === 'Ssali', 'W8 load: #0552 On the road with Ssali');
  t.check(L.directions(b, side, me, now).every((x) => x.key !== 'ntinda'), 'the run leaves To load');

  /* ---- the gate (OU10, OU13, OU09, OU11) ---- */
  d = demo(); b = await d.snapshot(); now = d.now();
  t.check(G.atTheGate(b, me, now).map((x) => x.id).join() === '555' && Y.moneyHeld(o(b, 555)), '10:41: #0555 at the gate, Not paid yet');
  let refused = false;
  try { await d.handOver(555, 'Walk-in', false); } catch (e) { refused = e.code === 'OWCSH'; }
  t.check(refused, 'a money hold refuses the hand over');
  d = demo('?demo&at=1047&state=agent'); b = await d.snapshot(); now = d.now();
  const g = G.atTheGate(b, me, now);
  t.check(g.map((x) => x.id).join() === '555,554', '10:47: #0555 then Peter\'s #0554 (agents by their code)');
  t.check(G.collector(o(b, 555)) === 'Walk-in · 0772 418 905', 'who collects, from the order');
  t.check(G.isAgent(o(b, 554)) && G.codeOf(o(b, 554)) === '0554', 'an agent\'s code is his order number');
  t.check(G.codeSays(o(b, 554), '055') === 'short' && G.codeSays(o(b, 554), '0554') === 'match' && G.codeSays(o(b, 554), '0553') === 'wrong', 'the code: short, match, wrong');
  t.check(G.collectedToday(b, now).map((x) => x.id).join() === '543', 'done today: #0543 collected');
  await d.handOver(555, 'Walk-in', false);
  b = await d.snapshot();
  t.check(o(b, 555).status === 'completed' && Y.stageWord(o(b, 555), 'delivered', me) === 'Delivered · collected', 'W9: Delivered · collected');

  /* ---- On the road, the door, can't deliver (OU20–OU28) ---- */
  d = demo(); b = await d.snapshot();
  const runs = D.onTheRoad(b);
  t.check(runs.length === 1 && runs[0].driver === 'Ssali' && runs[0].stops.map((x) => x.id).join() === '534,547' && T.clock(runs[0].dueBack) === '12:10', 'out now: Ssali, #0534 then #0547, back ~12:10');
  t.check(D.noPhotoWhy(o(b, 534))[0] === 'Kato said no photo' && D.noPhotoWhy(o(b, 534)).length === 4, 'four no-photo reasons, the first in the customer\'s name');
  t.check(D.aisleLetter(b, 'p-rn') === 'C' && D.aisleLetter(b, 'p-tg') === 'E', 'aisle letters: Roofing nails C, Tile glue E');
  t.check(D.receiver(o(b, 534)) === 'Kato’s site manager', 'at a site, the site manager receives it');
  await d.cantDeliver(547, 'Closed');
  b = await d.snapshot();
  t.check(o(b, 547).comingBack && o(b, 547).comingBack.why === 'Closed' && Y.stageOf(o(b, 547), b, me, d.now()) === 'coming-back', 'W27: #0547 Coming back, Closed (0182 comingBack)');
  d = demo('?demo&at=1405'); b = await d.snapshot();
  await d.deliver(552, { to: 'Kato’s site manager', photo: new Blob(['x']), kind: 'door' });
  b = await d.snapshot();
  const dl = o(b, 552);
  t.check(dl.status === 'completed' && dl.deliveredPhoto && T.clock(dl.deliveredAt) === '14:05', 'W10: Delivered 14:05 with the photo');
  t.check(T.weekday(D.billAt(dl)) === 'Sun' && T.clock(D.billAt(dl)) === '14:05', 'the bill goes by itself Sun 14:05');
  d = demo('?demo&state=cancel-0534'); b = await d.snapshot();
  t.check(D.onTheRoad(b)[0].stops.filter(D.bringBack).map((x) => x.id).join() === '534', 'cancelled on the truck: #0534 is brought back');

  process.exit(t.done() ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
