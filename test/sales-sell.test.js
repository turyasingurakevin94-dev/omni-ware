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
const F = require(path.join(ROOT, 'src/apps/sales/sell/find.ts'));

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
  const kato = cust(KATO), r = I.rhythm(b, kato, now);
  t.check(I.ordersOf(b, KATO).length === 14, 'Kato: 14 orders');
  t.check(I.whoLine(b, kato, now).text === 'Every 10 days · owes 420k', 'the who pill: Every 10 days · owes 420k');
  t.check(r.last.id === 553 && M.orderTotal(r.last) === 170000, 'last order #0553 · 170,000');
  const w = I.oftenWith(b, KATO, 'iron-g28-3m::', new Set(['iron-g28-3m::', 'cement-hima-50::', 'hinge-soft-flat::']), GRACE);
  t.check(w.mine && w.rows.map((x) => `${x.it.name} ${x.had}/${w.of}`).join(', ') === 'Ridge cap G28 7/14, Roofing nails 2.5" 5/14, Wire nails 4" · 25kg ctn 6/14', `Often with Iron sheet G28 in Kato's orders (got ${w.rows.map((x) => `${x.it.name} ${x.had}`).join(', ')})`);
  const marks = I.aisleMarks(b, kato);
  t.check([...marks].map(([a, n]) => `${a} ${n}`).sort().join(', ') === 'Cement 1, Fasteners 1, Roofing 2', 'Kato buys from 3: Roofing 2 · Cement 1 · Fasteners 1');

  /* ---- Lubowa (SL04) ---- */
  const lw = I.oftenWith(b, LUBOWA, 'iron-g28-3m::', new Set(['iron-g28-3m::']), GRACE);
  t.check(lw.mine && lw.rows.map((x) => `${x.it.name} ${x.had}/${lw.of}`).join(', ') === 'Ridge cap G28 4/5, Roofing nails 2.5" 3/5', 'Often with Iron sheet G28 in Lubowa’s orders: 4/5, 3/5');
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
  const after = demoSource('?demo&clock=14:10');
  const ab = await after.books();
  t.check(ab.orders.some((o) => o.id === 559) && Math.max(...ab.orders.filter((o) => o.id < 1000).map((o) => o.id)) === 559, 'after 13:50 Lubowa’s #0559 is in, so the next is #0560');

  process.exit(t.done() ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
