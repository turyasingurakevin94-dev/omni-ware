#!/usr/bin/env node
'use strict';
/*
 * The Sell tab's figures come out of the demo seed by the tab's own rules
 * (src/apps/sales/sell/insights.ts, find.ts) as the SL boards draw them,
 * and the seed additions (src/core/demo/seed/extra/sell.ts) leave every
 * total FACTS.md states where it was.
 *
 * Run: node test/sales-sell.test.js   (or: npm test)
 */
const path = require('path');
const { ROOT, createReporter } = require('./_extract');

const t = createReporter('sales sell');
const { demoSource } = require(path.join(ROOT, 'src/core/demo/index.ts'));
const M = require(path.join(ROOT, 'src/core/money.ts'));
const I = require(path.join(ROOT, 'src/apps/sales/sell/insights.ts'));
const F = require(path.join(ROOT, 'src/core/find.ts'));

const GRACE = 'u-grace', KATO = 'C001', LUBOWA = 'C006';

(async () => {
  const demo = demoSource('?demo');
  const b = await demo.books(), now = demo.now();
  const cust = (id) => b.customers.find((c) => c.id === id);
  const order = (id) => b.orders.find((o) => o.id === id);

  /* ---- the catalogue (FACTS §6; SL03, SL11, SL12) ---- */
  const aisles = I.aisles(b);
  t.check(b.items.length === 1153 && aisles.length === 12, `1,153 items in 12 aisles (got ${b.items.length} · ${aisles.length})`);
  t.check(aisles.map((a) => `${a.name} ${a.count}`).join(', ') === 'Roofing 86, Cement 14, Fasteners 132, Plumbing 210, Paint 95, Electrical 178, Tools 143, Timber 40, Steel 62, Doors & locks 74, Sanitary 88, Adhesives 31', 'each aisle as FACTS counts it, in the shop’s order');
  t.check(b.items.filter((i) => i.listedAt && now - i.listedAt <= 30 * 864e5).length === 18, 'New 18 (SL11)');

  /* ---- Kato (SL03, SL05) ---- */
  const kato = cust(KATO), r = I.rhythmOf(b, kato, now), last = I.ordersOf(b, KATO)[0];
  t.check(I.ordersOf(b, KATO).length === 14, 'Kato: 14 orders');
  t.check(I.whoLine(b, kato, now).text === 'Every 10 days · owes 420k', 'the who pill: Every 10 days · owes 420k');
  t.check(last.id === 553 && M.orderTotal(last) === 170000 && r.every === 10, 'last order #0553 · 170,000, every 10 days');
  const w = I.oftenWith(b, KATO, { itemId: 'iron-g28-3m', variantIdx: null }, new Set(['iron-g28-3m::', 'cement-hima-50::', 'hinge-soft-flat::']), GRACE);
  t.check(w.mine && w.rows.map((x) => `${x.it.name} ${x.had}/${w.of}`).join(', ') === 'Ridge cap G28 3/7, Wire nails 4" · 25kg ctn 2/7, Wheelbarrow, heavy duty 2/7', `Often with Iron sheet G28 in Kato's orders (got ${w.rows.map((x) => `${x.it.name} ${x.had}/${w.of}`).join(', ')})`);
  const marks = I.aisleMarks(b, kato);
  t.check([...marks].map(([a, n]) => `${a} ${n}`).sort().join(', ') === 'Cement 1, Fasteners 1, Roofing 1', `Kato buys from 3: Roofing 1 · Cement 1 · Fasteners 1, his usual (got ${[...marks].map(([a, n]) => `${a} ${n}`).join(', ')})`);

  // FACTS §3.2 (CH33): Kato's year by seller holds after the re-lines (Brian 2,180,000 · 3, Faith 500,000 · 1); #0490 is the usual.
  const year = (by) => b.orders.filter((o) => o.customerId === KATO && o.placedBy === by && !o.voided && !o.cancelled);
  const sum = (os) => os.reduce((n, o) => n + M.orderTotal(o), 0);
  t.check(year('u-brian').length === 3 && sum(year('u-brian')) === 2180000, `Brian sold Kato 3 orders, 2,180,000 (got ${year('u-brian').length} · ${sum(year('u-brian'))})`);
  t.check(year('u-faith').length === 1 && sum(year('u-faith')) === 500000, `Faith sold Kato 1 order, 500,000 (got ${year('u-faith').length} · ${sum(year('u-faith'))})`);
  t.check(M.orderTotal(order(490)) === 2672000, '#0490 is the usual, 2,672,000');
  t.check([[545, 1240000], [437, 560000], [540, 380000], [539, 180000], [542, 169000]].every(([id, n]) => M.orderTotal(order(id)) === n), 'every re-lined order keeps its total');

  /* ---- the search rule (core/find.ts; the lead's ruling, 4 Nov) ---- */
  const FI = require(path.join(ROOT, 'src/core/find.ts'));
  const finds = (q) => FI.findItems(b, FI.readAsk(q)).filter((i) => i.price != null);
  t.check(finds('paint').map((i) => i.id).join() === 'roof-paint-maroon-20,gloss-white-4,emulsion-cream-20', `"paint": the names first, then what sold in the Paint aisle in 90 days, no fillers (got ${finds('paint').map((i) => i.id).join()})`);
  t.check(finds('plumbing').length > 0 && finds('plumbing').every((i) => i.aisle === 'Plumbing' && !i.id.startsWith('g-')), '"plumbing": what sold in Plumbing lists, no fillers');
  const filler = b.items.find((i) => i.aisle === 'Paint' && i.id.startsWith('g-'));
  t.check(filler.price != null && FI.findItems(b, FI.readAsk(filler.name)).some((i) => i.id === filler.id), 'a filler that never sells is priced and still found by its own name');
  t.check(b.items.filter((i) => i.aisle === 'Paint').every((i) => i.price != null), 'every item in the Paint aisle has a price');

  /* ---- Lubowa (SL04) ---- */
  const lw = I.oftenWith(b, LUBOWA, { itemId: 'iron-g28-3m', variantIdx: null }, new Set(['iron-g28-3m::']), GRACE);
  t.check(lw.mine && lw.rows.map((x) => `${x.it.name} ${x.had}/${lw.of}`).join(', ') === 'Ridge cap G28 2/2, Roofing nails 2.5" 2/2', `Often with Iron sheet G28 in Lubowa’s orders (core/often.ts): 2/2, 2/2 (got ${lw.rows.map((x) => `${x.it.name} ${x.had}/${lw.of}`).join(', ')})`);
  t.check(I.whoLine(b, cust(LUBOWA), now).text === '1 day late · every 5 days', 'Lubowa: 1 day late · every 5 days');

  /* ---- who is it for (SL01) ---- */
  t.check(I.whosDue(b, now).map((x) => x.c.name).join(', ') === 'Mukono Roofing, Kyaligonza & Sons, Lubowa Builders', 'Who’s due 3: Mukono (today), Kyaligonza (4 days late), Lubowa');
  const typo = F.findCustomer(b, 'Kato Constrution');
  t.check(typo && typo.c.id === KATO && typo.off === 1 && 'Kato Construction'[typo.mark] === 'u', 'a typo: Kato Construction, 1 letter off');

  /* ---- what Grace sells most (SL31) ---- */
  t.check(I.sellMost(b, GRACE, now).map((x) => x.it.name).join(', ') === 'Cement · Hima 50kg, Iron sheet G28 · 3m, Wire nails 4" · 1kg', 'You sell most: Cement, Iron sheet G28, Wire nails 4" · 1kg');

  /* ---- finding (SL08, SL09, SL15, SL10, SL21) ---- */
  const rank = I.rankFor(b, kato, now);
  const sheets = F.findItems(b, F.readAsk('40 sheets'), rank);
  t.check(sheets.map((i) => i.name).join(' | ') === 'Iron sheet G28 · 3m | Iron sheet G30 · 3m | Iron sheet G26 · 3m | Iron sheet G28 · 2.5m', '“40 sheets”: the one Kato buys, then G30, G26, the one that is out');
  t.check(F.readAsk('40 sheets').qty === 40, 'read as ×40');
  t.check(F.findItems(b, F.readAsk('hinge'), rank)[0].id === 'hinge-soft-flat', '“hinge”: the one Kato had this week');
  t.check(F.findItems(b, F.readAsk('20 kg wire nails 4"'), rank)[0].id === 'nails-4-25kg', '“20 kg wire nails 4"”: Kato’s carton');
  t.check(F.findItems(b, F.readAsk('tile cuter'), rank).length === 0 && F.closest(b, F.readAsk('tile cuter')).map((i) => i.name).join(', ') === 'Tile glue · 20kg, Tile grout · 2kg', 'nothing called “tile cuter”: tile glue and grout are closest');
  t.check((F.sameAsk(b.asks, F.readAsk('tile cuter')) || {}).name === 'Tile cutter 600mm', 'the ask Sourcing holds: Tile cutter 600mm');
  const said = F.readSaid('forty sheets of G28 and two cartons of four inch nails').map((a) => [a.qty, F.findItems(b, a, rank)[0].id]);
  t.check(JSON.stringify(said) === JSON.stringify([[40, 'iron-g28-3m'], [2, 'nails-4-25kg']]), 'said: ×40 sheets G28 and ×2 cartons of 4" nails');

  /* ---- FACTS totals the seed additions keep ---- */
  t.check([[545, 1240000], [498, 1505000], [540, 380000], [539, 180000], [542, 169000], [553, 170000], [552, 1810000]].every(([id, v]) => M.orderTotal(order(id)) === v), 'Kato’s and Lubowa’s bills keep their totals');
  t.check(cust(KATO).owes === 420000 && cust(LUBOWA).owes === 0, 'Kato owes 420,000; Lubowa 0');
  const after = demoSource('?demo&clock=14:05');
  const ab = await after.books();
  t.check(ab.orders.filter((o) => o.id === 559).length === 1 && Math.max(...ab.orders.filter((o) => o.id < 1000).map((o) => o.id)) === 559, 'at 14:05 Lubowa’s #0559 (the Orders tab’s seed) is in, once, so the next is #0560');

  process.exit(t.done() ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
