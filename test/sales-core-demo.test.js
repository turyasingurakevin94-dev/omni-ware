#!/usr/bin/env node
'use strict';
/*
 * The demo is the sample shop of docs/canvas/sales-agent/FACTS.md: every
 * figure a board draws must come out of its seed by the app's own rules,
 * and its writes must act like the server functions they stand in for.
 *
 * Run: node test/sales-core-demo.test.js   (or: npm test)
 */
const path = require('path');
const { ROOT, createReporter } = require('./_extract');

const t = createReporter('sales core demo');
const { demoSource } = require(path.join(ROOT, 'src/core/demo/index.ts'));
const M = require(path.join(ROOT, 'src/core/money.ts'));
const T = require(path.join(ROOT, 'src/core/time.ts'));

const GRACE = 'u-grace';
const sum = (xs, f) => xs.reduce((s, x) => s + f(x), 0);

(async () => {
  const demo = demoSource('?demo');
  const b = await demo.books();
  const now = demo.now(), today = T.dayOf(now);
  t.check(today === '2026-10-17' && T.clock(now) === '10:41', 'the clock is Sat 17 Oct 2026 10:41 (FACTS §1)');
  t.check(T.dayLabel(now) === 'Sat 17 Oct' && T.daysLeftInMonth(today) === 14, '"Sat 17 Oct", 14 days left');

  /* ---- orders (FACTS §4.1) ---- */
  const live = b.orders.filter((o) => o.stage !== 'delivered' && !o.voided && !o.cancelled);
  t.check(live.length === 12 && sum(live, M.orderTotal) === 3240000, `12 live · +3,240,000 on the move (got ${live.length} · ${sum(live, M.orderTotal)})`);
  const by = (st) => live.filter((o) => o.stage === st);
  [['checking', 3, 542000], ['buying', 2, 256000], ['packing', 4, 2221000], ['road', 3, 221000]].forEach(([st, n, total]) => {
    t.check(by(st).length === n && sum(by(st), M.orderTotal) === total, `${st}: ${n} · ${total.toLocaleString('en-US')} (got ${by(st).length} · ${sum(by(st), M.orderTotal)})`);
  });
  const o552 = b.orders.find((o) => o.id === 552);
  t.check(M.orderTotal(o552) === 1810000 && o552.toldTotal === 1750000 && o552.stage === 'packing', '#0552 is 1,810,000 in Packing; Kato was told 1,750,000');
  const monday = T.at('2026-10-12');
  const week = b.orders.filter((o) => o.stage === 'delivered' && !o.counter && !o.voided && o.deliveredAt >= monday && o.deliveredAt <= now);
  t.check(week.length === 8 && sum(week, M.orderTotal) === 6569000, `delivered this week: 8 · 6,569,000 (got ${week.length} · ${sum(week, M.orderTotal)})`);

  /* ---- Grace's own figures (FACTS §5 and the lead's rulings) ---- */
  const sold = b.orders.filter((o) => o.placedBy === GRACE && o.invoiced && !o.voided && T.dayOf(o.invoicedAt).startsWith('2026-10'));
  t.check(sum(sold, M.orderTotal) === 12480000, `Sold · October 12,480,000 (got ${sum(sold, M.orderTotal)})`);
  const best = (cid) => sum(sold.filter((o) => o.customerId === cid), M.orderTotal);
  t.check(best('C001') === 5280000 && best('C005') === 2545500 && best('C004') === 1990000, 'best customers: Kato 5,280,000 · Nansana 2,545,500 · Mukono 1,990,000');
  const placed = b.orders.filter((o) => o.placedBy === GRACE && T.dayOf(o.placedAt) === today && o.id !== 557);
  t.check(placed.length === 8 && sum(placed, M.orderTotal) === 2440500, `Placed today: 8 · 2,440,500, the copy #0557 left out (got ${placed.length} · ${sum(placed, M.orderTotal)})`);
  const inToday = b.payments.filter((p) => p.by === GRACE && p.day === today);
  t.check(inToday.length === 3 && sum(inToday, (p) => p.amount) === 1044000, 'Money in today: 1,044,000 · 3 payments');
  const counter = b.orders.filter((o) => o.counter && T.dayOf(o.placedAt) === today);
  t.check(counter.length === 6 && sum(counter, M.orderTotal) === 412000 && counter.every((o) => o.placedBy !== GRACE), 'at the counter today: 6 sales · 412,000, not Grace\'s');
  t.check(b.goal && b.goal.target === 35000000, 'the goal is 35,000,000');

  /* ---- customers (FACTS §3) ---- */
  t.check(b.customers.length === 38, '38 customers');
  const owe = b.customers.filter((c) => c.owes > 0);
  t.check(owe.length === 4 && sum(owe, (c) => c.owes) === 1910000, '4 owe · 1,910,000');
  const age = (id) => M.oldestAge(b.customers.find((c) => c.id === id), today);
  t.check(age('C001') === 15 && age('C002') === 54 && age('C003') === 67 && age('C004') === 9, 'oldest bills: Kato 15 d, Kyaligonza 54 d, Ggaba 67 d, Mukono 9 d');
  const past = owe.filter((c) => M.oldestAge(c, today) > M.HOLD_DAYS);
  const pastAmt = sum(past, (c) => M.openCharges(c).filter((x) => T.daysApart(x.day, today) > 21).reduce((s, x) => s + x.left, 0));
  t.check(past.length === 2 && pastAmt === 710000, 'past 21 days: 2 customers (Ggaba 290,000 with 125,000 being checked; Kyaligonza 420,000)');
  const last = (cid) => Math.max(...b.orders.filter((o) => o.customerId === cid && !o.voided).map((o) => o.placedAt));
  const due = b.customers.filter((c) => c.everyDays && T.addDays(T.dayOf(last(c.id)), c.everyDays) <= today);
  const quiet = b.customers.filter((c) => c.everyDays && T.daysApart(T.dayOf(last(c.id)), today) >= 2 * c.everyDays);
  const dueNotQuiet = due.filter((c) => !quiet.includes(c));
  t.check(dueNotQuiet.length === 3 && ['C002', 'C006', 'C004'].every((id) => dueNotQuiet.some((c) => c.id === id)), `Who's due: 3 — Kyaligonza, Lubowa, Mukono (got ${dueNotQuiet.map((c) => c.name).join(', ')})`);
  t.check(quiet.length === 8, `gone quiet: 8 (got ${quiet.length})`);

  /* ---- chats (FACTS §5) ---- */
  const cb = await demo.chats();
  const lastMsg = (id) => cb.recent.filter((m) => m.chatId === id).sort((x, y) => x.at - y.at).pop();
  const waiting = cb.chats.filter((c) => (c.ownerId === GRACE || c.ownerId === null) && lastMsg(c.id) && lastMsg(c.id).dir === 'in' && T.replyWindow(c.lastInAt, now).open);
  t.check(waiting.length === 3, `Chats waiting: 3 (got ${waiting.map((c) => c.profileName).join(', ')})`);
  t.check(T.howLong(Math.min(...waiting.map((c) => lastMsg(c.id).at)), now) === '12 m', 'oldest 12 m');
  t.check(cb.chats.filter((c) => c.ownerId === GRACE).length === 6, 'Grace has 6 chats');
  const nansana = cb.chats.find((c) => c.customerId === 'C005');
  t.check(!T.replyWindow(nansana.lastInAt, now).open && T.replyWindow(nansana.lastInAt, now).daysShut === 2, "Nansana's window: shut · 2 days");
  t.check(T.replyWindow(cb.chats.find((c) => c.customerId === 'C001').lastInAt, now).hoursLeft === 23, "Kato's: 23 h to reply");

  /* ---- writes act like the server ---- */
  const item = (id) => b.items.find((i) => i.id === id);
  const lineOf = (id, qty) => { const it = item(id); return { lineId: 0, itemId: it.id, variantIdx: null, name: it.name, unit: it.unit, packUnit: '', packQty: 0, qty, price: it.price, cost: it.cost, shopPrice: it.price, from: 'shelf', supplierId: '__stock__', priceBy: null, priceNote: null, priceReview: null, priceToldAt: null, state: null, stateAt: null }; };
  const draft = (lines, o = {}) => ({ customerId: null, client: { name: 'Walk-in', phone: '' }, lines, charges: [], credit: null, deliverTo: null, chatId: null, ...o });

  const sale = await demo.counterSale(draft([lineOf('cement-hima-50', 1), lineOf('wood-glue-1l', 1)]), { method: 'cash', given: 60000, ref: '' });
  t.check(sale.order.id === 558 && sale.invoice === 'INV-0558' && sale.paid === 52000 && sale.change === 8000, 'a counter sale at 10:41 is #0558, 52,000, change 8,000 (KC14)');
  const placedOrder = await demo.placeOrder(draft([lineOf('iron-g28-3m', 60)], { customerId: 'C006', client: { name: 'Lubowa Builders', phone: '0772 410 233' } }));
  t.check(placedOrder.id === 559 && placedOrder.stage === 'packing' && M.orderTotal(placedOrder) === 2280000, 'the next order takes the next number; all on the shelf, it starts at Packing');
  const held = await demo.placeOrder(draft([lineOf('ridge-g28', 5), lineOf('nails-4-25kg', 1)], { customerId: 'C002', client: { name: 'Kyaligonza & Sons', phone: '' }, credit: { pct: 3, days: 30 } }));
  t.check(held.stage === 'checking' && M.orderTotal(held) === 191580, "Kyaligonza's draft on credit: 191,580, waits in Checking (54 days, no limit)");
  let refused = null;
  try { await demo.placeOrder(draft([{ ...lineOf('cement-hima-50', 1), price: 1000, priceBy: GRACE }])); } catch (e) { refused = e; }
  t.check(refused && refused.code === 'OWCST', 'a price under cost is refused (0171 OWCST)');
  let over = null;
  try { await demo.receivePayment({ customerId: 'C002', orderId: null, amount: 500000, method: 'cash', ref: '', picks: null, over: null }); } catch (e) { over = e; }
  t.check(over && over.code === 'OWOVR', 'paying more than owed with no choice is refused (OWOVR)');
  const paid = await demo.receivePayment({ customerId: 'C002', orderId: null, amount: 420000, method: 'cash', ref: '', picks: null, over: null });
  const ks = (await demo.books()).customers.find((c) => c.id === 'C002');
  t.check(paid.before === 420000 && paid.after === 0 && ks.owes === 0 && paid.payments.length === 1 && paid.payments[0].orderId === 533, "taking Kyaligonza's 420,000 clears #0533 and their balance");

  /* ---- flags ---- */
  const off = demoSource('?demo&offline=1');
  let kept = null;
  try { await off.send(101, 'Yes'); } catch (e) { kept = e; }
  t.check(kept && kept.kind === 'offline' && off.kept().length === 2, '&offline=1: writes do not land, and 2 are kept on this phone (TD09)');
  t.check(T.clock((await off.books()).at) === '7:52', '&offline=1: the copy is from 7:52');
  t.check(T.clock(demoSource('?demo&clock=15:40').now()) === '15:40', '&clock=15:40 moves the time of day');
  const empty = await demoSource('?demo&state=empty').books();
  t.check(empty.orders.every((o) => o.stage === 'delivered') && empty.customers.every((c) => c.owes === 0), '&state=empty: nothing live, nobody owes');
  t.check((await demoSource('?demo&state=signed-elsewhere').session()).role === 'store', '&state=signed-elsewhere: the login under the screen is the Store\'s');
  const first = await demoSource('?demo&state=first-day').books();
  t.check(first.orders.every((o) => o.placedBy !== GRACE), '&state=first-day: nothing of Grace\'s yet');

  process.exit(t.done() ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
