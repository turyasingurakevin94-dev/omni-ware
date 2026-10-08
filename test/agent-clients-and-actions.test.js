#!/usr/bin/env node
'use strict';
/*
 * The Clients list, and the orders that are waiting on the agent.
 *
 * The client rows carried a name and "N orders · phone" -- and that N
 * counted voided orders, because clientRowHTML read straight off
 * clientOrderCounts(), which filters nothing. Every other screen in the app
 * already discounted a cancelled order, so the one list an agent uses to
 * judge a customer was the one place a cancellation still looked like
 * business. The phone sat there as plain text with no way to ring it.
 *
 * On Home, an order sitting at the shop with the agent's name on it said
 * nothing, so the one action with stock already waiting was the easiest
 * to miss. Today now names every order that waits on the agent -- to
 * collect, or to pay for once the shop has checked it -- straight under
 * the tiles, from the same orderStage() the track itself reads.
 *
 * Run: node test/agent-clients-and-actions.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('agent clients + next actions');
const src = read('agent.html');
const code = src.split(/\r?\n/).map(l => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');

/* ---------- 1. possessive names ------------------------------------- */
/*
 * Both new/changed messages name the client. "Moses's order" reads wrong
 * to anyone who writes the name often; "Moses' order" is what they would
 * write themselves.
 */
{
  let f = null;
  try { ({ possessive: f } = compileScope([extractFunction(src, 'possessive', 'agent.html')], {}, ['possessive'])); }
  catch (e) { /* reported below */ }
  t.check(typeof f === 'function', 'possessive() compiles');
  if (f) {
    t.check(f('Nakato') === "Nakato's", 'an ordinary name takes apostrophe-s');
    t.check(f('Moses') === "Moses'", 'a name already ending in s takes the bare apostrophe');
    t.check(f('MOSES') === "MOSES'", 'regardless of case');
    t.check(f('Mukasa & Sons') === "Mukasa & Sons'", 'including a business name ending in s');
    t.check(f('') === '' && f(null) === '', 'and a missing name produces nothing, not a stray apostrophe');
    t.check(f('  Nakato  ') === "Nakato's", 'padding is trimmed before the rule is applied');
  }

  // Ordering matters: esc() rewrites ' to &#39;, so escaping first would
  // leave every name ending in a semicolon and the rule would never fire.
  t.check(/esc\(possessive\(firstWord\(chosenClient\.name\)\)\)/.test(code),
    'possessive is applied to the raw name and escaped after -- never the other way round');
  t.check(!/possessive\(esc\(/.test(code), 'and never the other way round anywhere');
}

/* ---------- 2. what waits on the agent ----------------------------- */
{
  let st = null, err = null;
  const myAgent = { paymentTerm: 'prepay' };
  try {
    st = compileScope(['const orderStaffNames = new Map();',
      ...['agentOrderTerms', 'orderShopChecked', 'staffName', 'orderOwedAmount', 'orderStage'].map((n) => extractFunction(src, n, 'agent.html'))],
      { myAgent, fmtNum: (n) => String(n) }, ['orderStage', 'agentOrderTerms']);
  } catch (e) { err = e; }
  t.check(!!st, `orderStage compiles${err ? ` (${err.message})` : ''}`);
  if (st) {
    const o = (over) => Object.assign({ status: 'draft', voided: false, deliveryMode: 'agent_pickup', agentPaymentStatus: 'unpaid',
      items: [{ productId: 'P', variantIdx: null, qty: 2, sellPrice: 100 }] }, over);
    t.check(st.orderStage(o({ status: 'pending_delivery' })).needs === 'collect',
      'an order ready at the shop for the agent to pick up waits on them');
    t.check(!st.orderStage(o({ status: 'pending_delivery', deliveryMode: 'shop_delivery' })).needs,
      'a shop-delivered one does not -- there is nothing to collect, and telling them to come sends them across town for nothing');
    t.check(!st.orderStage(o({})).needs && st.orderStage(o({})).key === 'checking',
      'a prepay order the shop has not checked asks for nothing yet');
    const checked = o({ shopConfirmedAt: 1 });
    checked.shopConfirmedTerms = st.agentOrderTerms(checked);
    t.check(st.orderStage(checked).needs === 'pay', 'once the shop has confirmed its lines, it waits on the payment');
    t.check(!st.orderStage(Object.assign({}, checked, { agentPaymentStatus: 'paid' })).needs, 'and stops waiting once paid');
    t.check(st.orderStage(o({ status: 'pending_delivery', voided: true })).key === 'cancelled',
      'a voided order is cancelled, not something to collect');
  }
  const move = extractFunction(src, 'renderMove', 'agent.html');
  t.check(/filter\(x=> x\.st\.needs\)/.test(move), 'Today lists every order that waits on the agent');
  t.check(/Collect/.test(move) && /'Settle' : 'Pay'/.test(move) && /fmtCompactUGX\(orderOwedAmount\(o\)\)/.test(move),
    'saying what to do and, for a payment, how much');
  t.check(/data-track="\$\{esc\(o\.id\)\}"/.test(move), 'and each row opens that order\'s track');
}

/* ---------- 3. what a client row now says --------------------------- */
{
  let f = null, err = null;
  try { ({ clientStats: f } = compileScope(
    // orderDate too: the last-order date reads the order's own date now,
    // not payload.savedAt, which is rewritten on every save.
    [extractFunction(src, 'orderTotal', 'agent.html'),
      extractFunction(src, 'agentLinePriced', 'agent.html'),
      extractFunction(src, 'orderEarnings', 'agent.html'),
     extractFunction(src, 'orderDate', 'agent.html'), extractFunction(src, 'clientStats', 'agent.html')],
    {}, ['clientStats'],
  )); } catch (e) { err = e; }
  t.check(typeof f === 'function', `clientStats compiles${err ? ` (${err.message})` : ''}`);

  if (f) {
    const mk = (status, sell, agentSell, qty, bonus, voided, date) => ({
      status, voided: !!voided, date: date || null, savedAt: '2026-07-0' + qty + 'T09:00:00Z',
      items: [{ sellPrice: sell, agentSellPrice: agentSell, qty, bonusCommission: bonus }],
    });
    const orders = [
      mk('completed', 1000, 1200, 1, 300),        // 1200 bought, 200 margin + 300 bonus
      mk('pending_delivery', 1000, 1200, 2, 500), // 2400 bought, not yet earned
      mk('completed', 1000, 1200, 3, 0, true),    // VOIDED -- must not count at all
    ];
    const s = f(orders);
    t.check(s.count === 2, `a voided order is not an order this client placed (${s.count} of 3)`);
    t.check(s.spent === 3600, `spend counts the live orders only (${s.spent})`);
    t.check(s.earned === 500, `and earnings apply the completed-only rule the wallet uses (${s.earned})`);
    t.check(s.lastAt === '2026-07-02',
      'the last-order date is the latest LIVE order, not the voided one that came after');

    // And it is the order's own date, not when the record was last written.
    // An old order edited today used to make a dormant client look active.
    const edited = f([mk('completed', 1000, 1200, 1, 0, false, '2026-01-15')]);
    t.check(edited.lastAt === '2026-01-15',
      'an order placed in January but saved again in July still last ordered in January');
    const none = f([]);
    t.check(none.count === 0 && none.spent === 0 && none.earned === 0 && none.lastAt === null,
      'a client with no orders produces zeroes, not NaN');
    t.check(f(null).count === 0, 'and a missing list does not throw');
  }

  // Day granularity. An order carries a date and no time, so measuring in
  // hours from midnight reported "13 hours ago" for one placed today.
  {
    let g = null;
    try { ({ daysAgoLabel: g } = compileScope([extractFunction(src, 'daysAgoLabel', 'agent.html')], {}, ['daysAgoLabel'])); }
    catch (e) { /* reported below */ }
    t.check(typeof g === 'function', 'daysAgoLabel compiles');
    if (g) {
      const at = (days) => {
        const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - days);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      };
      t.check(g(at(0)) === 'Today', 'an order placed today says Today, not a count of hours since midnight');
      t.check(g(at(1)) === 'Yesterday', 'and yesterday says Yesterday');
      t.check(g(at(18)) === '18 days ago', 'within the month it counts days, which is what dormancy is judged on');
      t.check(g(at(75)) === '3 months ago', 'past that it rounds to months');
      t.check(g(at(500)) === 'Over a year ago', 'and stops pretending to be precise');
      t.check(g('') === '' && g(null) === '' && g('not a date') === '', 'a missing or unparseable date renders nothing');
    }
    t.check(/daysAgoLabel\(clientStats\(orders\)\.lastAt\)/.test(code), 'and the client row uses it');
  }

  t.check(/No orders yet/.test(code), 'a client with no orders says so rather than showing "0 orders"');
  t.check(/fmtCompactUGX\(stats\.earned\)/.test(code), 'what they have earned you is compacted so it fits the end of a row');
}

/* ---------- 4. you can actually ring them --------------------------- */
{
  const sheet = extractFunction(src, 'openClientSheet', 'agent.html');
  t.check(/href="tel:\$\{esc\(c\.phone\)\}"/.test(sheet), 'the client sheet carries a real tel: link');
  t.check(/aria-label="Call \$\{esc\(c\.name\)\}"/.test(sheet), 'named, since the button itself is only an icon');
  t.check(/\$\{c\.phone \? `<a class="ax-iconbtn/.test(sheet), 'and it appears only for a client who has a number');
  t.check(/\.ax-iconbtn\{[^}]*width:44px;height:44px/.test(src), 'sized 44px for a thumb');
  t.check(/\.ax-iconbtn\{[^}]*box-sizing:border-box/.test(src), 'restoring border-box after all:unset, so 44 means 44');
  t.check(/:focus-visible\{outline:/.test(src), 'with a visible focus ring');
  // The number stays readable as well: a tel: link hands it to the dialer,
  // which is no use to an agent saving a contact or sending a WhatsApp.
  t.check(/\[c\.location, c\.phone\]\.filter\(Boolean\)/.test(sheet),
    'and the number is still shown, not hidden behind the button');
}

process.exit(t.done() ? 1 : 0);
