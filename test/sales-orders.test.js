#!/usr/bin/env node
'use strict';
/*
 * The Orders tab's figures come out of the demo by the tab's own rules (boards OR01–OR26), the
 * moments FACTS §1 allows play #0552's and #0559's day (src/core/demo/seed/extra/orders.ts), and
 * the asks the tab sends act like the server functions they stand in for.
 *
 * Run: node test/sales-orders.test.js   (or: npm test)
 */
const path = require('path');
const { ROOT, createReporter } = require('./_extract');

const t = createReporter('sales orders');
const { demoSource } = require(path.join(ROOT, 'src/core/demo/index.ts'));
const M = require(path.join(ROOT, 'src/core/money.ts'));
const D = require(path.join(ROOT, 'src/apps/sales/orders/data.ts'));
const O = require(path.join(ROOT, 'src/core/orders.ts'));
const V = require(path.join(ROOT, 'src/apps/sales/orders/view.ts'));
const Msg = require(path.join(ROOT, 'src/apps/sales/orders/msg.ts'));

const at = async (q) => { const s = demoSource(q); return { s, b: await s.books(), now: s.now() }; };

(async () => {
  /* OR01, OR02: the head and the groups. */
  {
    const { b, now } = await at('?demo');
    const c = D.stageCounts(b, now);
    t.check(c.checking === 3 && c.buying === 2 && c.packing === 4 && c.road === 3 && c.delivered === 8, `Orders 20: 3 · 2 · 4 · 3 · 8 done (got ${JSON.stringify(c)})`);
    t.check(M.orderTotal(D.orderOf(b, 552)) === 1810000, '#0552 is 1,810,000');
    const st = (id) => D.rowStatus(b, D.orderOf(b, id), now);
    t.check(st(553).text === 'Ruth decides' && st(551).act === 'take' && st(550).text === 'Cancel asked', 'Checking: Ruth decides · Not paid yet (Take) · Cancel asked');
    t.check(D.takeAmount(b, D.orderOf(b, 551)) === 1100000, 'Take 1.1M = 780,000 owed + 320,000');
    t.check(st(549).text === '1 of 2 came' && st(546).text === '1 not found' && st(546).chip.text === '6 days', 'Buying: 1 of 2 came · 6 days, 1 not found');
    t.check(st(530).chip.text === '2+ days' && st(552).text === 'Musa packing', 'Packing: 2+ days (#0530) · Musa packing (#0552)');
    const done = D.sortRows(D.doneThisWeek(b, now), 'delivered', false).map((o) => o.id);
    t.check(done.slice(0, 6).join() === '543,538,548,540,545,535', `Delivered newest bill first (got ${done})`);
    t.check(st(548).text === 'Return asked', '#0548: Return asked');
    const f = D.findOrders(b, 'kato');
    t.check(f.customer && f.customer.id === 'C001' && f.orders.length === 14, `Find "kato": Kato Construction, 14 orders (got ${f.orders.length})`);
    const tw = O.twinOf(b.orders, D.orderOf(b, 556));
    t.check(tw && tw.orig.id === 556 && tw.copy.id === 557, '#0557 is the copy of #0556 (OR19)');
    const p = b.payments.find((x) => x.id === 9002);
    t.check(M.paidOver(b, p).over === 90000 && M.paidOver(b, p).cleared === 470000, "Nansana's 560,000: 470,000 cleared, 90,000 over (OR15)");
    t.check(!D.overPaymentOf(b, D.orderOf(b, 552)), '#0552 is not paid over');
  }
  /* OR05–OR09: #0552's day. */
  for (const [q, stage, sub] of [['&clock=9:30', 'checking', 'Ruth decides 1 price'], ['&clock=9:50', 'buying', 'Denis · since 9:31'], ['', 'packing', 'Musa · since 10:05'], ['&clock=13:30', 'road', 'Ssali · left 13:20'], ['&clock=14:05', 'delivered', 'At the door 14:05']]) {
    const { b, now } = await at('?demo' + q);
    const o = D.orderOf(b, 552), v = V.orderView(b, o, now);
    t.check(o.stage === stage && v.sub === sub, `#0552 ${q || 'at 10:41'}: ${stage}, "${sub}" (got ${o.stage}, "${v.sub}")`);
  }
  {
    const { b, now } = await at('?demo&clock=9:50');
    const v = V.orderView(b, D.orderOf(b, 552), now);
    t.check(v.tiles[0].note === 'hinges not in it' && v.tellSub === 'what was found', 'OR06: hinges not in it · Tell what was found');
  }
  /* OR12, OR13: #0559. */
  {
    const a = await at('?demo&clock=13:50'), o = D.orderOf(a.b, 559);
    t.check(o && o.stage === 'checking' && M.orderTotal(o) === 850000 && V.orderView(a.b, o, a.now).tellSub === 'Ruth is deciding', '#0559 at 13:50: Checking, 850,000, Ruth is deciding');
    const c = await at('?demo&clock=15:05'), o2 = D.orderOf(c.b, 559), v2 = V.orderView(c.b, o2, c.now);
    t.check(M.orderTotal(o2) === 880000 && v2.tiles[0].old === 850000 && v2.sub === 'Ruth set 35,000 · 15:05', '#0559 at 15:05: 880,000 (was 850,000), Ruth set 35,000');
  }
  /* OR23: before the void. */
  {
    const { b } = await at('?demo&clock=9:15');
    const tw = O.twinOf(b.orders, D.orderOf(b, 537));
    t.check(tw && tw.copy.id === 537 && tw.orig.id === 536, '#0537 stands at 9:15, the copy of #0536');
    const later = await at('?demo');
    t.check(D.orderOf(later.b, 537).voided, '#0537 is voided at 10:41 (Sold · October stays 12,480,000)');
    /* OR29, OR30: after the void. */
    const v = V.orderView(later.b, D.orderOf(later.b, 537), later.now);
    t.check(v.tiles[0].struck && v.tiles[0].pill === 'Void' && v.tiles[1].k === 'Owes' && v.tiles[1].v === 0 && v.tiles[1].note === 'Ruth voided it today 9:20',
      `OR29: Bill struck with Void · Owes 0 · Ruth voided it today 9:20 (got ${JSON.stringify(v.tiles[1])})`);
    t.check(v.tellSub === 'the copy is struck out', 'OR29: Tell is about the copy');
    const msg = Msg.tellText(later.b, D.orderOf(later.b, 537));
    t.check(/entered twice, the same as #0536/.test(msg) && /Ruth struck it out, so nothing is owed on it/.test(msg) && /#0536 of 85,500 is paid/.test(msg), `OR29: the copy's message (got "${msg}")`);
    const f = D.findOrders(later.b, '0537');
    t.check(f.orders.map((o) => o.id).join() === '537,536', 'OR30: Find "0537" lists the copy and #0536');
  }
  /* OR22: which line comes back is read from the ask, not from the amount. */
  {
    const { b, now } = await at('?demo');
    const o = D.orderOf(b, 548), ask = D.openAsk(b, o, 'credit');
    const back = D.backLines(o, ask);
    t.check(back.length === 1 && back[0].line.itemId === 'cement-hima-50' && back[0].n === 2, '#0548: 2 bags of cement come back (the ask\'s lines)');
    t.check(D.backLines(o, { ...ask, lines: [] }).map((x) => x.n).join() === '2', 'an ask with no lines: read from its note');
    t.check(D.backLines(o, { ...ask, lines: [], note: '' }).length === 0, 'an ask with neither: nothing guessed from the amount');
    t.check(/2 bags of cement are coming back, damaged/.test(Msg.tellText(b, o)), 'OR22: the return message names the line');
    t.check(V.orderView(b, o, now).lines[0].mark.k === 'back', 'OR22: the cement line is marked coming back');
  }
  /* The asks. */
  {
    const { s } = await at('?demo');
    const ask = await s.askCancel(552, 'Kato changed their mind');
    t.check(ask.kind === 'cancel' && ask.amount === 1810000, 'ask_cancel: #0552, 1,810,000');
    await s.withdrawBillAsk(ask.id);
    const b2 = await s.books();
    t.check(!D.openAsk(b2, D.orderOf(b2, 552), 'cancel'), 'withdraw_cancel_ask: the ask is taken back');
    const cr = await s.askBill({ orderId: 548, kind: 'credit', amount: 67000, reason: 'Damaged', note: 'Cement · Hima 50kg ×2', lines: [{ idx: 0, qty: 2 }] });
    t.check(cr.kind === 'credit' && cr.amount === 67000 && cr.lines.length === 1 && cr.lines[0].idx === 0 && cr.lines[0].amount === 67000, 'a credit note asked: 67,000, its line kept as invoice_asks keeps it');
    const pf = await s.askPaymentFix({ paymentId: 9002, what: 'over', want: { over: 90000, how: 'change' }, note: '' });
    const b3 = await s.books();
    t.check(pf.what === 'over' && D.overAsk(b3, b3.payments.find((x) => x.id === 9002)), 'the paid-over is sent to Esther (payment_asks what over, 0165)');
  }
  {
    const { b, now } = await at('?demo&state=empty');
    t.check(D.stageCounts(b, now).delivered === 0 && D.liveOrders(b).length === 0, '&state=empty: Orders 0 (OR04)');
  }
  process.exit(t.done() ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
