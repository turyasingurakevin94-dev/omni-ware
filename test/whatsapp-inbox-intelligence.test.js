#!/usr/bin/env node
'use strict';
/*
 * WhatsApp: the inbox's intelligence.
 *
 * The matcher answers ONE question -- what did this message name? Three
 * further functions answer the questions the owner actually has about
 * it, and each one exists because a decision was made:
 *
 *   AUTONOMY WIDENS ON EVIDENCE OR NOT AT ALL. waWidenDryRun replays
 *   the last month's real questions under the looser rule and shows
 *   what WOULD have gone out. Nothing is sent, nothing is stored; the
 *   owner reads the shop's own messages and decides.
 *
 *   THE LEDGER MUST NOT LIE BY ARITHMETIC. waAnswerLedger counts asks,
 *   waits and orders for the system, the owner, and nobody. The
 *   comparison is NOT fair by construction -- the system only ever
 *   takes the easy questions -- so the honest reading is the third row,
 *   the questions nobody answered, and the ledger says nothing at all
 *   below WA_LEDGER_MIN.
 *
 *   THEIR WORDS ARE LEARNED FROM THE OWNER'S OWN REPLIES.
 *   waAliasProposals reads every chat as a labelled example: their word
 *   in, the product the owner quoted back out. Nothing is trusted until
 *   the owner says so, and a word the record disagrees about is offered
 *   as a question rather than a suggestion.
 *
 * Run: node test/whatsapp-inbox-intelligence.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('whatsapp inbox intelligence');
const src = read('index.html');
const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);

const sellFixture = new Map();
const env = {
  data: { products: [], presetWaAliases: [], presetWaAliasNo: [] },
  catalogueSellAtQty: (p, idx) => sellFixture.get(p.id + (idx == null ? '' : '::' + idx)) || null,
  catalogueBreaks: () => [],
  pairCompanionsFor: () => [],
  productVariantLabel: (p) => p.name,
};
const NAMES = ['waQuoteTokens', 'waQuoteCandidates', 'waQuoteMatch', 'waQuoteReply', 'waAskedQty',
  'waAliasProposals', 'waAnswerLedger', 'waWidenDryRun', 'waCustomerKeys'];
let scope = null; let err = null;
try {
  scope = compileScope([
    ...['waQuoteTokens', 'waQuoteCandidates', 'waQuoteMatch', 'waQuoteProductTokens', 'waQuoteHit',
      'waAskedQty', 'waQuoteReply', 'stockKey', 'waMedian',
      'waAliasProposals', 'waAnswerLedger', 'waWidenDryRun', 'waCustomerKeys',
    ].map((n) => extractFunction(src, n, 'index.html')),
    (src.match(/const WA_QUOTE_STOPWORDS = new Set\([\s\S]*?\);/) || [''])[0],
    (src.match(/^const WA_LEDGER_MIN = .*$/m) || [''])[0],
    (src.match(/^const WA_ALIAS_MIN_CHATS = .*$/m) || [''])[0],
    (src.match(/^const WA_ALIAS_CLEAR = .*$/m) || [''])[0],
    (src.match(/^const WA_ANSWER_HOURS = .*$/m) || [''])[0],
    (src.match(/^const WA_ORDER_DAYS = .*$/m) || [''])[0],
  ], env, NAMES);
} catch (e) { err = e; }
t.check(!!scope, `the inbox intelligence compiles${err ? ` (${err.message})` : ''}`);
if (!scope) process.exit(1);

env.data.products = [
  { id: 'C1', name: 'Cement Tororo', type: 'simple', image: null },
  { id: 'C2', name: 'Iron Sheets 28 Gauge Plain', type: 'simple', image: null },
];
sellFixture.set('C1', { price: 32000, unit: 'bag' });
sellFixture.set('C2', { price: 48000, unit: 'sheet' });
const CANDS = scope.waQuoteCandidates();

/* Message-building shorthand. Chats are read in time order, so every
   fixture below is written the way it happened. */
let clock = 0;
const at = (h) => new Date(Date.UTC(2026, 0, 10, h, 0, 0)).toISOString();
const ask = (conv, body, hour) => ({ conversation_id: conv, direction: 'in', msg_type: 'text', body, sent_at: at(hour == null ? (clock += 1) : hour) });
const said = (conv, body, hour, auto) => ({ conversation_id: conv, direction: 'out', msg_type: 'text', body, sent_at: at(hour == null ? (clock += 1) : hour), payload: auto ? { auto: true } : null });

/* ---------- 1. their words, learned from the owner's own replies ----- */
{
  /* Five different conversations, each one the same shape: a word the
     catalogue does not contain going in, and the owner quoting the same
     product back out. That is five labelled examples. */
  const msgs = [];
  for (let i = 1; i <= 5; i++) {
    msgs.push(ask('c' + i, 'mabati price?'), said('c' + i, 'Iron Sheets 28 Gauge Plain is 48000'));
  }
  const props = scope.waAliasProposals([], msgs, CANDS, [], []);
  eq(props.length, 1, 'one word is proposed');
  eq(props[0].word, 'mabati', 'the word the customers used');
  eq(props[0].name, 'Iron Sheets 28 Gauge Plain', 'and the product the owner kept quoting for it');
  eq(props[0].chats, 5, 'counted in CONVERSATIONS, not messages');
  eq(props[0].clear, true, 'the record agrees with itself, so it is offered as a suggestion');

  /* FOUR IS NOT FIVE. One person's habit is not a word this shop's
     customers use, and the threshold is the whole defence against
     teaching the matcher a typo. */
  eq(scope.waAliasProposals([], msgs.slice(0, 8), CANDS, [], []).length, 0,
    'four conversations propose nothing');

  /* THE SAME WORD SAID FIVE TIMES BY ONE PERSON is still one person. */
  const oneMouth = [];
  for (let i = 1; i <= 5; i++) oneMouth.push(ask('c1', 'mabati price?'), said('c1', 'Iron Sheets 28 Gauge Plain is 48000'));
  eq(scope.waAliasProposals([], oneMouth, CANDS, [], []).length, 0,
    'and five asks inside ONE conversation are one conversation');

  /* A WORD THE RECORD DISAGREES ABOUT is a question, not a suggestion.
     "simenti" may be the general word for cement rather than for the
     one cement the shop happened to quote most. */
  const split = [];
  for (let i = 1; i <= 4; i++) split.push(ask('s' + i, 'simenti?'), said('s' + i, 'Cement Tororo is 32000'));
  for (let i = 5; i <= 7; i++) split.push(ask('s' + i, 'simenti?'), said('s' + i, 'Iron Sheets 28 Gauge Plain is 48000'));
  const sp = scope.waAliasProposals([], split, CANDS, [], []);
  eq(sp.length, 1, 'a split word still surfaces');
  eq(sp[0].clear, false, 'but not as something to say yes to blind');
  eq(sp[0].others.length, 1, 'and the disagreement is named');
  eq(sp[0].others[0].chats, 3, 'with its own count, so the owner can weigh it');

  /* THE LOOP MUST NOT CONFIRM ITS OWN GUESSES. An automatic reply is
     the matcher repeating what it already knew; learning from it would
     be the system teaching itself. */
  const auto = [];
  for (let i = 1; i <= 5; i++) auto.push(ask('a' + i, 'mabati price?'), said('a' + i, 'Iron Sheets 28 Gauge Plain is 48000', null, true));
  eq(scope.waAliasProposals([], auto, CANDS, [], []).length, 0,
    'a word is learned only from replies the OWNER wrote');

  /* ALREADY ANSWERED, EITHER WAY. */
  eq(scope.waAliasProposals([], msgs, CANDS, [{ word: 'mabati', key: 'C2' }], []).length, 0,
    'a word already confirmed is not proposed again');
  eq(scope.waAliasProposals([], msgs, CANDS, [], ['mabati']).length, 0,
    'and "no" is remembered — it is not asked twice');

  /* WORDS THE CATALOGUE ALREADY OWNS are not aliases for anything. */
  const plain = [];
  for (let i = 1; i <= 5; i++) plain.push(ask('p' + i, 'cement price?'), said('p' + i, 'Cement Tororo is 32000'));
  t.check(!scope.waAliasProposals([], plain, CANDS, [], []).some((p) => p.word === 'cement'),
    'a word that is already part of a product name is not proposed as a nickname for it');
}

/* ---------- 2. the ledger, and the comparison it refuses to make ----- */
{
  const msgs = [
    ask('c1', 'mabati price?', 8), said('c1', 'Iron Sheets 28 Gauge Plain is 48000', 9),
    ask('c2', 'cement?', 8), said('c2', 'Cement Tororo is 32000', 8, true),
    ask('c3', 'do you open sunday?', 8),
  ];
  const led = scope.waAnswerLedger([], msgs, [], Date.parse(at(20)));
  eq(led.total, 3, 'every inbound question is counted once');
  eq(led.owner.asks, 1, 'the one the owner answered');
  eq(led.system.asks, 1, 'the one the system answered');
  eq(led.nobody.asks, 1, 'and the one nobody did');
  eq(led.owner.medianWaitMins, 60, 'the owner took an hour');
  eq(led.system.medianWaitMins, 0, 'the system was immediate');
  eq(led.nobody.medianWaitMins, null,
    'and an unanswered question has no wait — there is nothing to measure to');

  /* A REPLY A DAY LATE IS NOT AN ANSWER. Whoever eventually wrote back,
     the customer had already gone; counting it as "answered" would let
     the ledger claim a service it did not give. */
  const late = [ask('c9', 'mabati?', 1), said('c9', 'still have them', 1 + 25 - 24)];
  const lateMsgs = [{ ...late[0], sent_at: new Date(Date.UTC(2026, 0, 10, 8)).toISOString() },
    { ...late[1], sent_at: new Date(Date.UTC(2026, 0, 11, 9)).toISOString() }];
  eq(scope.waAnswerLedger([], lateMsgs, [], Date.now()).nobody.asks, 1,
    'a reply past the day mark counts as nobody answering');

  /* THE ORDER COLUMN. An order born in that chat, within days of the
     question, is credited to whoever answered it — and to nobody when
     nobody did. */
  const quotes = [{ originWa: true, waConversationId: 'c1', date: '2026-01-11', voided: false }];
  const withOrders = scope.waAnswerLedger([], msgs, quotes, Date.parse(at(20)));
  eq(withOrders.owner.ordered, 1, 'the order that followed the owner\'s answer is credited to it');
  eq(withOrders.system.ordered, 0, 'and not to the other rows');
  const stale = [{ originWa: true, waConversationId: 'c1', date: '2026-02-20', voided: false }];
  eq(scope.waAnswerLedger([], msgs, stale, Date.parse(at(20))).owner.ordered, 0,
    'an order six weeks later is not this answer\'s doing');
  const dead = [{ originWa: true, waConversationId: 'c1', date: '2026-01-11', voided: true }];
  eq(scope.waAnswerLedger([], msgs, dead, Date.parse(at(20))).owner.ordered, 0,
    'and a voided order is not an order');

  /* THE SCREEN IS HELD TO THE HONEST READING. The two answer rows are
     not comparable — the system only ever takes questions where a
     product was named outright — so the panel says so in words, and
     withholds the widening offer entirely until there is enough. */
  t.check(/it only ever takes the questions where a customer named a product outright/.test(src),
    'the panel says out loud why its own two rows cannot be raced against each other');
  t.check(/led\.total >= WA_LEDGER_MIN \? `<div class="wa-ra"[\s\S]{0,200}?id="wa_dry"/.test(src),
    'and the offer to widen autonomy does not appear before there is evidence to read');
  t.check(/led\.total < WA_LEDGER_MIN[\s\S]{0,220}?narrowest setting until there are about \$\{WA_LEDGER_MIN\}/.test(src),
    'a shop with too few questions is told that, rather than shown a figure that means nothing');
}

/* ---------- 3. widening it: a dry run, and nothing sent -------------- */
{
  const now = Date.parse(at(20));
  const msgs = [
    /* Four of five words: precise, unambiguous, and today it gets
       silence because the naming is not whole. This is the case the
       widening is for. */
    ask('c1', 'how much for 30 iron sheets 28 gauge', 8),
    /* Already answerable — it names the whole product, so it is not
       something widening would change. */
    ask('c2', 'cement tororo price', 8),
    /* Two products in one message: a conversation, and a conversation
       is the owner's. */
    ask('c3', 'do you have cement tororo and iron sheets 28 gauge plain', 8),
    /* Nothing the shop sells. */
    ask('c4', 'do you open on sunday', 8),
  ];
  const runs = scope.waWidenDryRun([], msgs, CANDS, now);
  eq(runs.length, 1, 'exactly one of these four would have been answered differently');
  eq(runs[0].times, 1, 'asked once');
  eq(runs[0].ask, 'how much for 30 iron sheets 28 gauge',
    'the precise question that gets silence today');
  eq(runs[0].name, 'Iron Sheets 28 Gauge Plain', 'matched to the product it plainly means');
  t.check(/1,440,000/.test(runs[0].reply),
    'and the owner reads the actual words, with the actual arithmetic, before deciding');

  /* GROUPED, NOT LISTED. Twelve people asking the same thing is one
     fact about the shop; four identical rows would spend the panel
     repeating it while the owner learned nothing new. */
  const many = [msgs[0], { ...msgs[0], conversation_id: 'c5' }, { ...msgs[0], conversation_id: 'c6' },
    { ...msgs[0], conversation_id: 'c7', body: 'how much for 30 IRON SHEETS 28 gauge?' }];
  const grouped = scope.waWidenDryRun([], many, CANDS, now);
  eq(grouped.length, 1, 'the same question asked four ways is one row');
  eq(grouped[0].times, 4, 'and the row carries how often it came up');

  /* THE WINDOW. A dry run is about what is happening now; a question
     from last quarter is not evidence about today's customers. */
  const old = [{ ...msgs[0], sent_at: new Date(Date.UTC(2025, 9, 1)).toISOString() }];
  eq(scope.waWidenDryRun([], old, CANDS, now).length, 0, 'and only the last month is replayed');

  /* NOTHING SENDS ITSELF, and a dry run least of all: it is a pure
     function of messages the shop already has. */
  const fn = extractFunction(src, 'waWidenDryRun', 'index.html');
  t.check(!/waSendReply|fetch\(|saveData/.test(fn),
    'the dry run sends nothing, saves nothing, and writes nothing down');
  t.check(/Turning this on changes what goes out unattended, in the shop&rsquo;s name/.test(src),
    'and the button that would widen it says exactly what it is changing');
}

/* ---------- 4. who is asking ----------------------------------------- */
{
  /* The tie-breaker the matcher is handed: what this customer has
     actually bought and paid for. */
  const quotes = [
    { invoiced: true, voided: false, client: { customerId: 7 }, items: [{ productId: 'C1', variantIdx: null }] },
    { invoiced: true, voided: false, client: { customerId: 9 }, items: [{ productId: 'C2', variantIdx: null }] },
    { invoiced: false, voided: false, client: { customerId: 7 }, items: [{ productId: 'C2', variantIdx: null }] },
  ];
  const keys = scope.waCustomerKeys(7, quotes);
  eq(keys.size, 1, 'only what this customer bought');
  eq(keys.has('C1'), true, 'and that is the cement');
  eq(scope.waCustomerKeys(null, quotes).size, 0,
    'a chat with nobody attached to it settles nothing');
  eq(scope.waCustomerKeys(7, [{ invoiced: true, voided: true, client: { customerId: 7 }, items: [{ productId: 'C2' }] }]).size, 0,
    'and a voided order is not a purchase');
}

t.done();
