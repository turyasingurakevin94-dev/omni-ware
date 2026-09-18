#!/usr/bin/env node
'use strict';
/*
 * The figure an agent is SHOWN is the figure their phone is CHARGED.
 *
 * `orderOwedAmount()` used to be the order's whole value -- it summed
 * sellPrice * qty and never subtracted `amountPaid`, while
 * `orderBalanceInfo()` fifteen lines away did subtract it. Both payment
 * modals rendered the first one: "Order #N -- 1,200,000 owed to the shop".
 * The agent approved that, and agent-initiate-momo-payment charged what was
 * really left -- 400,000. The right money, and a number they had never been
 * shown.
 *
 * The server had already been taught this; its own comment records that
 * pushing the full value re-charged the part the agent had already settled,
 * "since both webhooks add to amount_paid rather than replacing it". The
 * screen was never brought along. Two copies of one quantity, and only one
 * of them learned.
 *
 * So there is one reckoning now, and this holds the two ends of it to the
 * same arithmetic: the client function the modals read, and the expression
 * the edge function charges.
 *
 * Run: node test/agent-owed-figure.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('the owed figure the agent approves');

const { orderOwedAmount, orderBalanceInfo } = compileScope(
  ['orderOwedAmount', 'orderBalanceInfo'].map(
    (n) => extractFunction(read('agent.html'), n, 'agent.html')),
  { ICON_CHECK: '', fmtUGX: (n) => String(n) },
  ['orderOwedAmount', 'orderBalanceInfo'],
);

const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${got}, want ${want})`);

const order = (amountPaid, extra) => Object.assign({
  id: 411,
  items: [
    { sellPrice: 800000, qty: 1 },
    { sellPrice: 200000, qty: 2 },
  ],
  amountPaid,
}, extra || {});

/* ---------- 1. the part-paid order, which is the whole point ---------- */

eq(orderOwedAmount(order(0)), 1200000,
  'nothing paid yet: the whole order is owed');

eq(orderOwedAmount(order(800000)), 400000,
  'part-paid: what is LEFT, not what the order was worth -- the bug');

eq(orderOwedAmount(order(1200000)), 0,
  'paid in full by amount: nothing owed');

/* ---------- 2. either signal settles it ---------- */

eq(orderOwedAmount(order(0, { agentPaymentStatus: 'paid' })), 0,
  'the flag settles it even when amountPaid was never written');

eq(orderOwedAmount(order(400000, { agentPaymentStatus: 'paid' })), 0,
  'and it wins over a part-paid amount rather than arguing with it');

/* ---------- 3. it never goes negative ---------- */

// An overpayment is real: a short Airtel payment banked and then topped up,
// or an admin confirming cash that had already cleared. It must read as
// settled, never as the shop owing the agent -- this figure is an amount to
// CHARGE, and a negative one would be a refund nobody authorised.
eq(orderOwedAmount(order(2000000)), 0,
  'an overpaid order is settled, not a negative charge');

/* ---------- 4. missing and malformed input ---------- */

eq(orderOwedAmount(null), 0, 'no order is nothing owed, not a crash');
eq(orderOwedAmount({ items: [] }), 0, 'an order with no lines owes nothing');
eq(orderOwedAmount({ items: [{ sellPrice: null, qty: 3 }] }), 0,
  'an unpriced line counts as nothing rather than NaN');
eq(orderOwedAmount({ items: [{ sellPrice: 5000, qty: 2 }], amountPaid: null }),
  10000, 'a null amountPaid is zero paid, not NaN owed');

/* ---------- 5. the row and the modal cannot disagree ---------- */

// orderBalanceInfo is the order-history row; orderOwedAmount is what the
// two payment modals print. They were the two copies. Now one reads the
// other, and this is what says so.
t.check(orderBalanceInfo(order(800000)).text.includes('400000'),
  'the history row quotes the same balance the modal will');
t.check(orderBalanceInfo(order(1200000)).cls === 'settled',
  'and a settled order still reads as settled');
t.check(orderBalanceInfo(order(0, { agentPaymentStatus: 'paid' })).cls === 'settled',
  'including one settled by the flag alone');

/* ---------- 6. the server charges what the screen promised ---------- */

// The client cannot import the edge function, so this holds its arithmetic
// as text. If the server's rule moves, this fails and names it rather than
// letting the two drift apart again in silence.
{
  const src = read('supabase/functions/agent-initiate-momo-payment/index.ts');

  t.check(/const\s+alreadyPaid\s*=\s*Number\(\s*order\.amount_paid\s*\)\s*\|\|\s*0/.test(src),
    'the server still reads amount_paid');
  t.check(/Math\.round\(\s*orderTotal\s*-\s*alreadyPaid\s*\)/.test(src),
    'and still charges the total MINUS it -- the shape the screen now matches');
  t.check(/sellPrice/.test(src) && !/agentSellPrice/.test(src),
    'on sellPrice, what the shop is owed -- not the price the client paid the agent');
}

process.exit(t.done() ? 1 : 0);
