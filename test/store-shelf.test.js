#!/usr/bin/env node
'use strict';
/*
 * The Shelf's rules (src/core/store/shelf.ts, counts.ts, report.ts, restock.ts, find.ts) give FACTS' figures and
 * the boards' words back out of the demo (docs/canvas/store-agent/boards SH*), and its what-ifs hold.
 *
 * Run: node test/store-shelf.test.js   (or: npm test)
 */
const path = require('path');
const { ROOT, createReporter } = require('./_extract');

const t = createReporter('store shelf');
const S = require(path.join(ROOT, 'src/core/store/shelf.ts'));
const C = require(path.join(ROOT, 'src/core/store/counts.ts'));
const R = require(path.join(ROOT, 'src/core/store/report.ts'));
const Q = require(path.join(ROOT, 'src/core/store/restock.ts'));
const F = require(path.join(ROOT, 'src/core/store/find.ts'));
const { storeDemo } = require(path.join(ROOT, 'src/core/store/demo/index.ts'));

const demo = (q = '?demo') => storeDemo(q, { instant: true });
const item = (b, k) => b.items.find((x) => x.key === k);

(async () => {
  let d = demo(), b = await d.snapshot(), now = d.now();

  /* ---- the shelf figure and what is packed apart (never "held") ---- */
  t.check(S.onShelf(b, 'p-is28') === 412 && S.onShelf(b, 'p-wn4') === 18 && S.onShelf(b, 'p-gp') === 2 && S.onShelf(b, 'p-rc28') === 34, 'on shelf: 412, 18, 2, 34 (the figure Sales shows)');
  const pk = S.packedFor(b, 'p-is28');
  t.check(pk.length === 1 && pk[0].order.id === 552 && pk[0].qty === 40 && pk[0].bay === 1, 'packed for #0552 · bay 1 · 40, apart from the shelf');
  t.check(S.packedFor(b, 'p-rc28').map((x) => x.order.id).join() === '530', 'Ridge cap: +10 packed for #0530 (the gate\'s #0555 is on the road, not on a bay)');
  const oi = S.orderIn(b, 'p-is30');
  t.check(oi.length === 1 && oi[0].order.id === 546 && oi[0].due != null, 'Iron sheet G30: Order in for #0546, due with Denis\'s trip');

  /* ---- aisles: 12, 1,153 items, how fresh ---- */
  const A = S.aislesOf(b, now);
  t.check(A.length === 12 && A.reduce((n, a) => n + a.items.length, 0) === 1153, '12 aisles, 1,153 items');
  t.check(A.map((a) => a.days).join() === '2,6,30,9,4,12,8,11,5,13,7,10', 'days since counted: A 2 … C 30 … L 10 (SH01)');
  t.check(A.filter((a) => a.due).map((a) => a.letter).join() === 'C', 'only aisle C is over 14 days');
  t.check(S.letterOf(b, 'Fasteners') === 'C' && S.letterOf(b, null) === null, 'an aisle\'s letter by its place; no category, no letter (DATA-05)');
  t.check(S.aisleItems(b, 'Roofing').slice(0, 4).map((x) => x.key).join() === 'p-is28,p-rc28,p-is26,p-is30', 'aisle A: the fullest first, what is only on order after (SH04)');

  /* ---- what needs a look ---- */
  t.check(S.lookOf(b, item(b, 'p-gp'), now) === 'low', 'Gloss paint · 2 tin is running low (under a week\'s sales)');
  t.check(S.lookOf(b, item(b, 'p-wn3'), now) === 'due' && S.lookOf(b, item(b, 'p-is28'), now) === null, 'Wire nails 3" is due for a count; Iron sheet G28 is fine');

  /* ---- blind counts ---- */
  t.check(C.countDue(item(b, 'p-wn3'), b, now) && !C.countDue(item(b, 'p-is28'), b, now), 'countDue: on the shelf and not counted for more than 21 days');
  t.check(C.daysSince(Date.parse('2026-10-15T16:10:00+03:00'), now) === 2, 'Thu 16:10 → Sat is 2 days, by the calendar');
  const w = C.waitingFor(b, C.spotPlace(item(b, 'p-wn4')));
  t.check(w && w.id === 'cnt-wn4' && C.spotPlace(item(b, 'p-wn4')) === 'item:p-wn4', 'one count waits for Wire nails 4" (place item:p-wn4)');
  const L4 = C.levelsOf(item(b, 'p-wn4')), L3 = C.levelsOf(item(b, 'p-wn3')), L28 = C.levelsOf(item(b, 'p-is28'));
  t.check(L4.map((l) => l.unit).join() === 'ctn,kg' && C.inLineUnit(L4, [17, 12]) === 17.48, 'Wire nails 4": cartons and loose kg; 17 ctn + 12 kg → 17.48 ctn');
  t.check(L3.map((l) => l.unit).join() === 'ctn,kg' && C.inLineUnit(L3, [3, 19]) === 94, 'Wire nails 3": 3 ctn + 19 kg → 94 kg (SH14)');
  t.check(L28.map((l) => l.unit).join() === 'bundle,pc' && C.inLineUnit(L28, [20, 12]) === 412, 'Iron sheet: 20 bundles + 12 pc → 412 pc');
  const line = C.countLine(item(b, 'p-wn4'), 17, S.onShelf(b, 'p-wn4'));
  t.check(line.counted === 17 && line.system === 18 && line.held === 2, 'a count line: counted 17, the shelf 18 Ruth sees, 2 left for orders');

  /* ---- report a loss ---- */
  t.check(!R.canReport(0) && R.canReport(412) && R.reportMax(412) === 412, 'no loss off an empty shelf; never past it (DATA-03)');
  t.check(R.asPieces(3, 1) === 3 && R.shownIn(3, 20) === 0 && R.shownIn(40, 20) === 2, 'a unit switch never multiplies a loss (Pre 3)');
  const loss = R.lossOf(item(b, 'p-is28'), 3, 'damaged', null, ' bent ');
  t.check(loss.qty === 3 && loss.why === 'damaged' && loss.note === 'bent', 'the W17 write: 3 pc, damaged, "bent"');

  /* ---- we need more ---- */
  t.check(Q.restockUnit(item(b, 'p-gp')) === 'tin' && Q.restockUnit(item(b, 'p-is28')) === 'bundle', 'asked in the unit the Buyer buys (the pack when there is one)');
  t.check(Q.restockWhen([], 2) === 'low' && Q.restockWhen([556], 2) === 'out' && Q.restockWhen([], 0) === 'out', 'how soon, prefilled: Running low; We\'re out when orders wait or the shelf is empty');
  t.check(Q.restockGuess(S.weekOut(b, 'p-gp', now), 2) === 10, 'about how many, prefilled: 10 tin (SH30)');

  /* ---- find ---- */
  const f = F.findShelf(b, 'nails');
  t.check(f.items.slice(0, 4).map((x) => x.key).sort().join() === 'p-cn2,p-rn,p-wn3,p-wn4' && f.items.length === 4, 'Find "nails": the four nails');
  t.check(f.narrower.join() === 'wire nails,roofing nails,concrete nails', 'Did you mean: wire nails, roofing nails, concrete nails');
  t.check(f.orders.some((o) => o.id === 530) && f.orders.some((o) => o.id === 549), 'Find "nails" lists the orders with nails (#0530, #0549 …)');
  t.check(F.nearWord(b, 'emalshon') === 'emulsion', '"emalshon": did you mean emulsion');
  t.check(F.closestTo(b, 'emulsion', () => 0)[0].key === 'p-em', 'the closest on our shelf starts with Emulsion · cream 20L');
  t.check(F.wordsOf('pipe 1 1/4"').includes('1 1/4"'), 'a size like 1 1/4" is one word');

  /* ---- what moved ---- */
  const mv = S.moved(b, 'p-is28', now);
  t.check(mv[0].note === 'Order #0552 · Kato' && mv[0].delta === -40 && mv[1].kind === 'count' && mv[1].delta === null, 'Iron sheet G28: Order #0552 · Kato −40, then aisle A counted (no change)');

  /* ---- the what-ifs ---- */
  b = await demo('?demo&state=count-accepted').snapshot();
  t.check(S.onShelf(b, 'p-wn4') === 17 && S.lastDecided(b, 'p-wn4').line.system === 18, 'count accepted: the shelf takes 17 (18 → 17, SH16)');
  b = await demo('?demo&state=written-off').snapshot();
  t.check(S.onShelf(b, 'p-is28') === 409, 'written off: the shelf moved 412 → 409 (SH22)');
  b = await demo('?demo&state=kept-on-shelf').snapshot();
  t.check(S.onShelf(b, 'p-is28') === 412 && b.reports[0].status === 'dismissed', 'kept on the shelf: it stays 412 (SH24)');
  b = await demo('?demo&state=recount').snapshot();
  t.check(!!C.recountOf(b, 'p-wn4') && C.countDue(item(b, 'p-wn4'), b, now), 'Ruth asked a recount: Wire nails 4" is due (SH13)');
  d = demo('?demo&at=921'); b = await d.snapshot();
  t.check(!C.waitingFor(b, 'item:p-wn4') && d.now() === Date.parse('2026-10-17T09:21:00+03:00'), '&at=921: no count waits yet, the clock is 9:21');
  d = demo('?demo&state=okello-counts'); b = await d.snapshot();
  let clash = '';
  try { await d.replaceCount('cnt-wn4', { aisle: 'Spot count · Wire nails 4" · 25kg ctn', lines: [{ key: 'p-wn4', productId: 'p-wn4', variantIdx: null, name: 'x', counted: 17, system: 18, held: 2 }], missing: [] }); } catch (e) { clash = e.kind; }
  b = await d.snapshot();
  t.check(clash === 'clash' && C.waitingFor(b, 'item:p-wn4').countedBy === 'u-op', 'okello-counts: Okello\'s count got there first; Musa\'s is refused as someone else\'s (SH25)');
  b = await demo('?demo&state=shelf-calm').snapshot();
  t.check(S.aislesOf(b, now).every((a) => !a.due) && b.items.every((it) => !['low', 'reported', 'due'].includes(S.lookOf(b, it, now))), 'shelf-calm: nothing needs a look (SH06)');

  process.exit(t.done() ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
