#!/usr/bin/env node
'use strict';
/*
 * The Today tab's rules (src/apps/sales/today/data.ts, src/core/owing.ts), on the demo's sample shop
 * (docs/canvas/sales-agent/FACTS.md) and on small changes to it: who owes and what a Take pays, Needs you,
 * Next move, what was placed today, the promise To collect shows, Sells most and an ask's aisle.
 *
 * Run: node test/sales-today.test.js   (or: npm test)
 */
const path = require('path');
const { ROOT, createReporter } = require('./_extract');

const t = createReporter('sales today');
const { demoSource } = require(path.join(ROOT, 'src/core/demo/index.ts'));
const D = require(path.join(ROOT, 'src/apps/sales/today/data.ts'));
const M = require(path.join(ROOT, 'src/core/money.ts'));
const T = require(path.join(ROOT, 'src/core/time.ts'));

const sum = (xs, f) => xs.reduce((s, x) => s + f(x), 0);
const by = (ws, id) => ws.find((w) => w.c.id === id);

(async () => {
  const demo = demoSource('?demo');
  const b = await demo.books(), cb = await demo.chats(), now = demo.now(), today = T.dayOf(now);

  /* ---- who owes (FACTS §3.1) ---- */
  const ow = D.owing(b, now);
  t.check(sum(ow, (w) => w.owes) === 1910000, `to collect: 1,910,000 (got ${sum(ow, (w) => w.owes)})`);
  t.check(sum(ow, (w) => w.take) === 585000, `to take now, past 21 days and not checked: 585,000 (got ${sum(ow, (w) => w.take)})`);
  const ggaba = by(ow, 'C003');
  t.check(ggaba.checked === 125000 && ggaba.take === 165000 && ggaba.past === 290000, 'Ggaba: 290,000 past the hold, 125,000 of it being checked, 165,000 to take');
  t.check(by(ow, 'C001').take === 0 && by(ow, 'C001').under === 420000, 'Kato: 420,000 under the hold, nothing to take');
  t.check(by(ow, 'C004').held && by(ow, 'C004').held.id === 551, 'Mukono: #0551 is held for the money');
  t.check(ow.every((w) => !w.c.qa), 'no test customer owes');

  /* ---- what a Take pays ---- */
  t.check(D.takeOf(ggaba, true).bills === '521', 'Ggaba\'s Take pays #0521 only: the bill being checked (#0528) is left out');
  t.check(D.takeOf(by(ow, 'C002'), true).bills === '533', 'Kyaligonza\'s Take pays #0533');
  t.check(D.takeOf(by(ow, 'C004'), false).bills === '532,541,551', 'Mukono\'s Take pays every bill and the order held for it');
  t.check(D.takeOf(ggaba, true).customer === 'C003', 'a Take names its customer');

  /* ---- Needs you ---- */
  const n = D.needs(b, cb, now, []);
  t.check(n.take.map((w) => w.c.id).join() === 'C003,C002', `take: Ggaba then Kyaligonza, the oldest first (got ${n.take.map((w) => w.c.id)})`);
  t.check(n.tellPrice.map((o) => o.id).join() === '552' && n.tellAsk.map((a) => a.id).join() === 'SRC-PAINT', 'tell: #0552\'s new price and the paint that came in');
  t.check(n.late.length === 0, 'one late order in Packing is not a Needs-you row');
  const told = D.needs(b, cb, now, ['price:552', 'ask:SRC-PAINT']);
  t.check(told.tellPrice.length === 0 && told.tellAsk.length === 0 && told.total === n.total - 2, 'what was told leaves Needs you');
  const two = JSON.parse(JSON.stringify(b));
  D.mine(two).filter((o) => o.stage === 'packing').slice(0, 2).forEach((o) => { o.stageAt = now - 3 * 864e5; });
  t.check(D.needs(two, cb, now, []).late.length === 2, 'two late in Packing: one batch row to ask the yard');

  /* ---- Next move ---- */
  const draft = { key: 'd1', customerId: 'C005', chatId: null, lines: [{ qty: 4, unit: 'pc', price: 50000 }] };
  const mv = D.moves(b, cb, now, [], [draft]);
  t.check(new Set(mv.map((m) => m.c.id)).size === mv.length, 'one move per customer');
  t.check(mv.every((m, i) => i === 0 || mv[i - 1].value >= m.value), 'the most valuable first');
  t.check(mv[0].kind === 'due' && mv[0].c.id === 'C002' && mv[0].value === 2672000, `first: Kyaligonza's usual, 2,672,000 (got ${mv[0].kind} ${mv[0].c.id} ${mv[0].value})`);
  const wait = cb.chats.find((c) => c.customerId && D.moves(b, cb, now, [], [{ key: 'w', customerId: c.customerId, chatId: c.id, lines: [{ qty: 1, unit: 'pc', price: 9e6 }] }]).some((m) => m.kind === 'chat'));
  if (wait) {
    const m = D.moves(b, cb, now, [], [{ key: 'w', customerId: wait.customerId, chatId: wait.id, lines: [{ qty: 1, unit: 'pc', price: 9e6 }] }]).find((x) => x.kind === 'chat');
    t.check(m.chat === wait.id, 'a chat move carries its chat (Reply opens that conversation)');
  } else t.check(false, 'a waiting chat with a draft makes a chat move');

  /* ---- placed today (FACTS §5) ---- */
  const placed = D.placedToday(b, now);
  t.check(placed.length === 8 && sum(placed, M.orderTotal) === 2440500, `placed today: 8 · 2,440,500 (got ${placed.length} · ${sum(placed, M.orderTotal)})`);
  t.check(placed.every((o, i) => i === 0 || placed[i - 1].placedAt <= o.placedAt), 'in the order they were placed');
  const twice = JSON.parse(JSON.stringify(b)), o553 = twice.orders.find((o) => o.id === 553);
  twice.orders.push({ ...JSON.parse(JSON.stringify(o553)), id: 9990, placedAt: o553.placedAt + 2 * 60000 });
  t.check(D.placedToday(twice, now).length === 8, 'an order entered twice within five minutes counts once');
  const later = JSON.parse(JSON.stringify(b));
  later.orders.push({ ...JSON.parse(JSON.stringify(o553)), id: 9991, placedAt: now + 60000 });
  t.check(D.placedToday(later, now).length === 8, 'nothing after now');

  /* ---- the promise To collect shows (spec 02 §5.6) ---- */
  const mukono = b.customers.find((c) => c.id === 'C004'), gg = b.customers.find((c) => c.id === 'C003');
  t.check(D.promiseToShow(b, mukono, today) && D.promiseToShow(b, mukono, today).amount === 310000, 'Mukono\'s promise due today shows');
  t.check(D.promiseToShow(b, gg, today) === null, 'Ggaba\'s promise for Tue 20 Oct does not show yet');
  const missed = JSON.parse(JSON.stringify(b));
  missed.promises.push({ id: 90, customerId: 'C003', on: '2026-10-15', madeOn: '2026-10-12', amount: 100000 });
  t.check(D.promiseToShow(missed, missed.customers.find((c) => c.id === 'C003'), today).id === 90, 'a promise whose day passed unpaid shows (missed)');
  const kept = JSON.parse(JSON.stringify(b)), kc = kept.customers.find((c) => c.id === 'C003');
  kept.promises.push({ id: 91, customerId: 'C003', on: '2026-10-15', madeOn: '2026-10-12', amount: 100000 });
  kc.debtLog.push({ id: 9e6, day: '2026-10-14', type: 'payment', amount: 100000, orderId: null, paymentId: null, note: 'Payment' });
  t.check(D.promiseToShow(kept, kc, today) === null, 'a kept promise does not show');

  /* ---- Sells most, an ask's aisle ---- */
  const most = D.sellsMost(b, now);
  t.check(most.aisles.join() === 'Roofing,Cement,Fasteners' && most.when === 'this month', `sells most this month: Roofing, Cement, Fasteners (got ${most.aisles} · ${most.when})`);
  const fd = demoSource('?demo&state=first-day'), fb = await fd.books(), fm = D.sellsMost(fb, fd.now());
  t.check(fm.when === 'last month' && fm.aisles.join() === 'Roofing,Cement,Fasteners', `the month's first day: last month's (got ${fm.aisles} · ${fm.when})`);
  t.check(D.askAisle(b, b.asks.find((a) => a.id === 'SRC-PAINT')) === 'Paint', 'a listed ask: its item\'s aisle');
  t.check(D.askAisle(b, { itemId: null, name: 'Ceiling fan, 56 inch' }) === '', 'no catalogue match: no aisle, never guessed');
  t.check(D.askAisle(b, { itemId: null, name: 'Cement · Hima 50kg' }) === 'Cement', 'named like one catalogue item: that item\'s aisle');

  process.exit(t.done() ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
