#!/usr/bin/env node
'use strict';
/*
 * Messages, the intelligence center: the readings drawn beside the work.
 *
 * The console used to say WHO was owed a word and nothing about what was
 * riding on it, whether that kind of word had ever worked, whether the
 * person could be reached for free, or when a held-back client comes
 * back. Every one of those is already in the books. These tests pin the
 * derivations -- the real functions, read out of index.html -- and above
 * all the places each one must say "not known" rather than print a
 * confident zero:
 *
 *   - the stake on a row is the ledger's money, a sized basket at today's
 *     price, or a usual month -- and null when none of those exists;
 *   - odds need MSG_ODDS_MIN tellings, and money never has a rate;
 *   - a phone the inbox has never seen is "closed", but no inbox at all
 *     is "not known" (null), which is a different statement;
 *   - a reply is READ, in order of what a mistake would cost -- a request
 *     to stop before anything else;
 *   - every hold says the day it lets go, or what it waits on;
 *   - a promise somebody has since replaced is not a day anyone is
 *     holding, ahead of today; behind today it keeps its verdict.
 *
 * Run: node test/messages-intelligence.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('messages intelligence');
const src = read('index.html');

const DAY = 86400000;
const NOW = Date.parse('2026-09-26T09:00:00.000Z');
const day = (n) => new Date(NOW + n * DAY).toISOString().slice(0, 10);
const eq = (a, b, m) => t.check(JSON.stringify(a) === JSON.stringify(b), `${m} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const data = {};
const env = {
  data,
  waInbox: { convs: [], msgs: [] },
  followUpPriceNow: (f) => (f.__price == null ? null : f.__price),
  followUpsAll: () => data.followUps || [],
  followUpsForCustomer: (cid) => (data.followUps || []).filter((f) => String(f.customerId) === String(cid)),
  customerOrdersFor: () => [],
  savedQuoteTotal: () => 0,
  custTermsDays: () => 30,
  cfNormalisedPhone: (p) => String(p || '').replace(/\D/g, '').slice(-9),
  contactPhones: (c) => [c.phone].filter(Boolean),
  waWindowInfo: (at, now) => {
    if(!at) return { open: false, hoursLeft: 0 };
    const left = Date.parse(at) + DAY - now;
    return { open: left > 0, hoursLeft: Math.max(0, Math.floor(left / 3600000)) };
  },
  msgInboxSource: () => ({ convs: env.waInbox.convs, msgs: env.waInbox.msgs }),
  briefLastTold: (cid) => (data.__told || {})[cid] || null,
};
const NAMES = ['msgRowStake', 'msgRowReasonKey', 'msgOdds', 'msgInboxLoaded', 'msgWindowFor',
  'msgStakeSplit', 'msgAgingPoints', 'msgPromiseRecord', 'msgPromiseRate', 'msgPromiseDays',
  'msgHeldLift', 'msgReadReply', 'msgAnswerMinutes', 'msgAnswerBuckets', 'msgReplyHeat',
  'promisesFor', 'promiseState', 'daysBetweenISO'];
let scope = null, err = null;
try {
  scope = compileScope([
    'function todayISO(){ return "' + day(0) + '"; }',
    extractDeclaration(src, 'fupDayISO', 'index.html'),
    extractDeclaration(src, 'CUST_WINDOW_DAYS', 'index.html'),
    extractDeclaration(src, 'TELL_EVERY_DAYS', 'index.html'),
    extractDeclaration(src, 'TELL_AFTER_CHASE_DAYS', 'index.html'),
    extractDeclaration(src, 'MSG_ODDS_MIN', 'index.html'),
    extractDeclaration(src, 'MSG_READS', 'index.html'),
    extractDeclaration(src, 'MSG_ANSWER_BUCKETS', 'index.html'),
    extractDeclaration(src, 'MSG_HEAT_HOURS', 'index.html'),
    ...NAMES.map((n) => extractFunction(src, n, 'index.html')),
  ], env, NAMES);
} catch (e) { err = e; }
t.check(!!scope, `the readings compile${err ? ` (${err.message})` : ''}`);
if(!scope) process.exit(1);
const S = scope;

/* ---------- 1. the stake: money, a sized basket, a usual month, or nothing ---------- */
{
  eq(S.msgRowStake({ chase: { debt: 1840000.4 }, items: [] }), { v: 1840000, b: 'owed', kind: 'owed' },
    'a debtor is worth what the ledger says they owe');
  const basket = S.msgRowStake({ items: [{ followUp: { qty: 20, __price: 66500 } }, { followUp: { qty: null, __price: 5000 } }] });
  eq([basket.v, basket.kind], [1330000, 'basket'], 'a basket is the quantity asked for at today’s price — an item nobody sized adds nothing');
  eq(S.msgRowStake({ items: [{ followUp: { qty: 5, __price: null } }] }), null,
    'no price on file means no value, not a zero');
  eq(S.msgRowStake({ items: [], quiet: { sub: 'quiet' }, book: { spend: 900000 } }).v, 300000,
    'a quiet customer is worth a usual month of their own ninety days');
  eq(S.msgRowStake({ items: [], book: { spend: 900000 } }), null,
    'and a row with none of those reasons is not valued at all');
  const split = S.msgStakeSplit([{ chase: { debt: 100 }, items: [] }, { items: [] }], [{ debt: 50 }]);
  eq([split.owed, split.promised, split.unvalued, split.total], [100, 50, 1, 150],
    'the band adds what can be valued and COUNTS what cannot');
}

/* ---------- 2. odds: a reason's own record, or no rate ---------- */
{
  const score = { byReason: { back_in_stock: { told: 10, worked: 4 }, price_moved: { told: 3, worked: 3 } } };
  eq(S.msgOdds('back_in_stock', score), { pct: 40, n: 10 }, 'ten tellings, four sales within the window: 40%');
  eq(S.msgOdds('price_moved', score), { pct: null, n: 3 },
    'three out of three is an anecdote, not 100% — below the floor there is no rate');
  eq(S.msgOdds('money', score), null, 'money has no rate at all: a cleared chase deletes its own record');
  eq(S.msgRowReasonKey({ chase: {}, items: [] }), 'money', 'a debtor is scored as money');
  eq(S.msgRowReasonKey({ items: [{ reasons: [{ kind: 'gone_quiet' }, { kind: 'back_in_stock' }] }] }), 'back_in_stock',
    'news outranks silence on the same item');
}

/* ---------- 3. reach: closed is not the same as not known ---------- */
{
  env.waInbox.convs = [];
  eq(S.msgWindowFor('0772 540 118', NOW), null, 'with no inbox on this device, nobody’s window is known');
  env.waInbox.convs = [{ id: 1, wa_id: '256772540118', last_inbound_at: new Date(NOW - 3 * 3600000).toISOString() }];
  const w = S.msgWindowFor('0772 540 118', NOW);
  eq([w.open, w.hoursLeft], [true, 21], 'a number that wrote three hours ago can be answered free for 21 more');
  eq(S.msgWindowFor('0701 000 000', NOW).open, false,
    'a number the inbox has never seen has never opened a window, so it is closed');
}

/* ---------- 4. reading a reply, by what a mistake would cost ---------- */
{
  eq(S.msgReadReply('Sorry boss, we pay on Friday when the site pays us.').key, 'day', 'a weekday is a day named');
  eq(S.msgReadReply('I sent 400k on MoMo yesterday').key, 'paid', 'money said to be sent is a claim to check');
  eq(S.msgReadReply('please stop sending me these, I paid').key, 'stop',
    'a request to stop is read before anything else in the same message');
  eq(S.msgReadReply('how much for 20 bags').key, 'buy', 'a price question is somebody who wants to buy');
  eq(S.msgReadReply('ok thanks').key, 'other', 'and plain words are not forced into a reading');
  eq(S.msgReadReply('we pay on Friday').word, 'Friday', 'the word it was read from rides along, so the screen can show it');
}

/* ---------- 5. answer times and when customers write ---------- */
{
  const at = (mins) => new Date(NOW + mins * 60000).toISOString();
  const msgs = [
    { conversation_id: 1, direction: 'in', sent_at: at(-120) }, { conversation_id: 1, direction: 'in', sent_at: at(-110) },
    { conversation_id: 1, direction: 'out', sent_at: at(-90) },
    { conversation_id: 2, direction: 'in', sent_at: at(-30) },
  ];
  eq(S.msgAnswerMinutes(msgs), [30], 'measured from the FIRST unanswered message to the reply, and an unanswered run is not an answer time');
  const b = S.msgAnswerBuckets([5, 25, 700]);
  eq(b.map((x) => x.n), [1, 1, 0, 0, 0, 0, 1], 'and bucketed so the tail is visible');
  const heat = S.msgReplyHeat([{ direction: 'in', sent_at: at(0) }, { direction: 'out', sent_at: at(0) }]);
  eq(heat.n <= 1, true, 'only what customers wrote is counted, never the shop’s own replies');
}

/* ---------- 6. every hold says when it lets go, or what it waits on ---------- */
{
  data.__told = { C1: { sentOn: day(-5) } };
  data.presetDebtChases = { C3: day(-2) };
  eq(S.msgHeldLift({ kind: 'told', customerId: 'C1' }).on, day(9), 'a picture sent five days ago lets go after the fortnight');
  eq(S.msgHeldLift({ kind: 'chased', customerId: 'C2', lastChased: day(0), restDays: 7 }).on, day(7),
    'a debtor asked today rests for the shop’s own rest period');
  eq(S.msgHeldLift({ kind: 'chased', customerId: 'C3' }).on, day(5),
    'a picture held inside a chase waits out the chase rule');
  const p = S.msgHeldLift({ kind: 'promised', promisedOn: day(2) });
  eq([p.on, p.ifUnpaid], [day(3), true], 'a named day lets go the day after — and only if nothing landed');
  eq(S.msgHeldLift({ kind: 'nophone' }), { on: null, waits: 'a number' }, 'no number has no date: it waits on a person');
  eq(S.msgHeldLift({ kind: 'terms' }), { on: null, instead: true },
    'past terms is not a hold anybody releases — they get the statement instead of news');
}

/* ---------- 7. the promise book: verdicts, the rate, the calendar ---------- */
{
  data.customers = [
    { id: 'C4', name: 'Ssekitoleko', debt: 1840000, debtLog: [{ type: 'payment', date: day(-61), amount: 900000 }] },
    { id: 'C6', name: 'Ochieng', debt: 960000, debtLog: [] },
  ];
  data.paymentPromises = [
    { id: 1, customerId: 'C4', promisedOn: day(-60), madeOn: day(-64), amount: 900000 },
    { id: 2, customerId: 'C4', promisedOn: day(-6), madeOn: day(-10), amount: null },
    { id: 3, customerId: 'C6', promisedOn: day(4), madeOn: day(-3), amount: null },
    { id: 4, customerId: 'C6', promisedOn: day(2), madeOn: day(-1), amount: null },
  ];
  eq(S.msgPromiseRecord('C4', NOW), ['kept', 'broken'], 'their word, oldest first: kept, then broken');
  eq(S.msgPromiseRate(NOW), { kept: 1, broken: 1, open: 1, decided: 2 },
    'the book’s rate is over days that have passed; only the latest word ahead is still coming');
  const days = S.msgPromiseDays(NOW, 7, 7);
  const on = (d) => days.find((x) => x.d === d).items;
  eq(on(day(2)).map((x) => x.state), ['waiting'], 'the latest word ahead of today is on the calendar');
  eq(on(day(4)).length, 0, 'the day they replaced with a later word is not a day anyone is holding');
  eq(on(day(-6)).map((x) => [x.state, x.amount]), [['broken', 1840000]],
    'a broken day behind today keeps its verdict, sized at what is still owed');
}

/* ---------- 8. the screen wires them, and nothing here sends ---------- */
{
  const contact = extractFunction(src, 'renderFollowUpsContact', 'index.html');
  t.check(/msgBandHTML\(/.test(contact) && /msgRowStake\(row\)/.test(contact) && /msgOddsHTML\(/.test(contact)
    && /msgWindowFor\(row\.phone/.test(contact) && /msgDossierHTML\(row, now\)/.test(contact),
    'the queue draws the band, the stake, the odds, the window and the dossier from these readings');
  ['msgBandHTML', 'msgDossierHTML', 'msgSignalHTML', 'renderMessagesIntel', 'fupHeldPanelHTML', 'msgPromiseCalendarHTML']
    .forEach((n) => t.check(!/\.send\(|wa-send|window\.open/.test(extractFunction(src, n, 'index.html')),
      `${n} only draws — nothing sends itself`));
  t.check(!/btn-accent/.test(extractFunction(src, 'msgBandHTML', 'index.html'))
    && !/btn-accent/.test(extractFunction(src, 'fupHeldPanelHTML', 'index.html')),
    'and neither the band nor the held-back lane competes with the one primary action');
}

process.exit(t.done() ? 1 : 0);
