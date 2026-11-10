#!/usr/bin/env node
'use strict';
/*
 * The Chats tab's rules (src/apps/sales/chats/model.ts, read.ts) on the demo shop: the figures
 * the CH boards draw come out of the seed by the tab's own rules, and the chat writes act as the
 * server functions they stand in for (take, give and the Manager's move, notes, the shut window).
 *
 * Run: node test/sales-chats.test.js   (or: npm test)
 */
const path = require('path');
const { ROOT, createReporter } = require('./_extract');

const t = createReporter('sales chats');
const { demoSource } = require(path.join(ROOT, 'src/core/demo/index.ts'));
const { waitingChats } = require(path.join(ROOT, 'src/core/chats.ts'));
const Mo = require(path.join(ROOT, 'src/apps/sales/chats/model.ts'));
const R = require(path.join(ROOT, 'src/apps/sales/chats/read.ts'));

(async () => {
  const demo = demoSource('?demo');
  const b = await demo.books(), cb = await demo.chats(), now = demo.now();

  /* ---- the list (CH01-CH04) ---- */
  const mine = Mo.mineList(b, cb, now, []);
  t.check(mine.map((v) => v.title).join(' | ') === '0701 552 904 | Kato Construction | Lubowa Builders | Kyaligonza & Sons | Mukono Roofing | Nansana Hardware',
    'Mine: the new number, Kato and Lubowa waiting, then Kyaligonza, Mukono, Nansana by who is due (CH01)');
  t.check(Mo.mineCount(b, cb, now) === 6 && mine.length === 6, 'Chats 6, Mine 6: the count is what Mine lists (Bukoto is older than a week; Kevin saw "Mine 2" over an empty list)');
  t.check(waitingChats(cb, b.me.id, now, 'mine').length === 3 && waitingChats(cb, b.me.id, now, 'team').length === 4, '3 waiting for Grace, 4 for the team');
  const wl = Mo.waitLine(b, cb, now, 'team');
  t.check(wl.oldest === 38 && wl.drawn.map((m) => `${m.mins}:${m.pct.toFixed(1)}:${m.offset}`).join(' ') === '4:6.7:0 12:20.0:-12 12:20.0:12 38:63.3:0', 'the wait line: 4 m, 12 m twice side by side, 38 m (CH04)');
  const many = Mo.placeMarks(Array.from({ length: 17 }, (_x, i) => ({ key: i + 1, face: { initials: 'AB', tint: 't0' }, title: 'x', mins: 3 + i, pct: ((3 + i) / 60) * 100, offset: 0 })));
  const at = many.map((m) => (m.pct / 100) * 320 + m.offset).sort((x, y) => x - y);
  t.check(at.every((x, i) => !i || x - at[i - 1] >= 22) && many.some((m) => m.more), '17 waiting a minute apart: no two faces touch, and a place with more than three says "+n"');
  const kato = mine[1];
  t.check(kato.waitMins === 12 && kato.unread === 1 && kato.typing && kato.typing.name === 'Brian Ouma', 'Kato: 12 m, 1 unread, Brian typing');
  const nansana = mine[5];
  t.check(nansana.asleep && !nansana.window.open && nansana.window.daysShut === 2 && Mo.listTime(nansana.chat.lastAt, now) === 'Thu', 'Nansana: shut 2 days, the lock, "Thu"');
  t.check(Mo.salesTeam(b).map((m) => m.initials).join(' ') === 'GA BO FN', 'the team pill: GA BO FN (the counter login is not a person)');
  t.check(Mo.firstSentence('Do you have 3m iron sheets? How much?') === 'Do you have 3m iron sheets?', 'a row quotes the first sentence');

  /* ---- reading a chat (CH10, CH14, CH15, CH30) ---- */
  const katoMsgs = cb.recent.filter((m) => m.chatId === 101);
  const cust = b.customers.find((c) => c.id === 'C001');
  t.check(R.readyAnswers(b, cust, katoMsgs, now).map((a) => a.text).join(' | ') === 'Yes, to the Ntinda site | It comes this afternoon', 'ready answers from #0552: to the Ntinda site, this afternoon');
  t.check(R.giveNote(b, cust, katoMsgs, now) === '#0552 packing · Ntinda site this afternoon · tell Kato the sheet price (1,810,000)', 'the give note from #0552 (CH30)');
  const want = R.wantsToBuy(b, 'Do you have 3m iron sheets? How much?');
  t.check(want.length === 1 && want[0].name === 'Iron sheet G28 · 3m' && want[0].onShelf === 412, 'Mama Shine wants Iron sheet G28 · 3m, 412 on shelf (CH14)');
  const paid = R.saysPaid(cb.recent.filter((m) => m.chatId === 106).pop());
  t.check(paid && paid.amount === 165000 && paid.method === 'momo' && paid.when === 'this morning', 'Ggaba says they paid 165,000 on Mobile this morning (CH15)');

  /* ---- the writes ---- */
  await demo.take(107);
  t.check((await demo.chats()).chats.find((c) => c.id === 107).ownerId === b.me.id, 'Take: the new number is Grace\'s');
  let refused = null;
  try { await demo.send(105, 'Hello'); } catch (e) { refused = e; }
  t.check(refused && refused.code === 'WSHUT', 'a shut window refuses a plain message');
  const tm = await demo.sendTemplate(105, 'Your cement and wood glue are being packed');
  t.check(tm.kind === 'template', '... and sends the shop\'s reply template');
  await demo.give(101, 'u-brian', '#0552 packing');
  const ev = (await demo.thread(101)).events.pop();
  t.check(ev.kind === 'handed' && ev.to === 'u-brian' && ev.note === '#0552 packing', 'Give: Kato is Brian\'s, the event keeps the note (CH31)');
  refused = null;
  try { await demo.give(106, 'u-brian', ''); } catch (e) { refused = e; }
  t.check(refused && refused.code === '42501', 'Grace cannot give Faith\'s chat');
  const ruth = demoSource('?demo&as=ruth');
  t.check((await ruth.session()).role === 'manager', '&as=ruth: the Manager is signed in');
  await ruth.give(106, 'u-brian', 'Ggaba says they sent 165,000 on Mobile.');
  t.check((await ruth.thread(106)).events.pop().kind === 'moved', 'the Manager moves any chat (CH32)');
  const off = demoSource('?demo&offline=1');
  t.check(off.kept().every((k) => k.kind === 'send' && k.args[0] === 104), '&offline=1: the two kept writes are Grace\'s answers to Mukono (CH12)');
  const served = await demo.served(101);
  t.check(served.find((s) => s.by === 'u-grace').messages === 86 && served.find((s) => s.by === 'u-brian').messages === 31, 'who served Kato: Grace 86 messages, Brian 31 (CH33)');
  const { servedThisYear } = require(path.join(ROOT, 'src/core/chats.ts'));
  const fresh = demoSource('?demo'), fb = await fresh.books();
  const who = servedThisYear(fb.orders, 'C001', await fresh.served(101), '2026', new Set(['u-grace', 'u-brian', 'u-faith']));
  t.check(who.map((x) => `${x.by}:${x.messages}:${x.orders}:${x.total}`).join(' ') === 'u-grace:86:9:10812000 u-brian:31:3:2180000 u-faith:7:1:500000',
    `who served Kato this year: messages, and the orders each took (Ruth's #0498 is not Sales') (got ${who.map((x) => `${x.by}:${x.messages}:${x.orders}:${x.total}`).join(' ')})`);
  const withRuth = servedThisYear(fb.orders, 'C001', [...await fresh.served(101), { by: 'u-ruth', messages: 4 }], '2026', new Set(['u-grace', 'u-brian', 'u-faith']));
  const ruthRow = withRuth.find((x) => x.by === 'u-ruth');
  t.check(!!ruthRow && ruthRow.orders === 0 && ruthRow.total === 0, 'a Manager who wrote in the chat: her messages count, her orders (#0498) never do (the lead\'s ruling)');
  const F = require(path.join(ROOT, 'src/core/demo/flags.ts'));
  t.check(F.readFlags('?demo&listen=1').listen && !F.readFlags('?demo').listen && F.HEARD === 'Yes, it can come to the Ntinda site', '&listen=1: the demo phone listens and hears Grace\'s answer to Kato (CH16)');
  const { oftenWith } = require(path.join(ROOT, 'src/core/often.ts'));
  const ow = oftenWith(fb.orders, { itemId: 'iron-g28-3m', variantIdx: null }, { customerId: 'C001', me: 'u-grace', skip: new Set(['cement-hima-50', 'iron-g28-3m', 'nails-4-25kg']), n: 99 });
  const owTxt = ow.rows.map((r) => `${r.itemId}:${r.n}`).join(' ');
  t.check(ow.theirs && ow.of === 7 && owTxt.startsWith('ridge-g28:3 wheelbarrow-hd:2 ') && owTxt.includes('hinge-soft-flat:1'),
    `often with Kato's sheets (CH21, CH34; SL05's lines): Ridge cap G28 in 3 of 7 and Wheelbarrow, heavy duty in 2 of 7 (Kato's usual counted from the orders), the hinge with no price in 1 (got ${ow.of}: ${owTxt})`);
  const once = oftenWith(fb.orders, { itemId: 'gloss-white-4', variantIdx: null }, { customerId: 'C001', me: 'u-grace' });
  t.check(!once.theirs, 'often with: an item they had once is counted over my orders, not theirs (agent.html oftenWith)');

  process.exit(t.done() ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
