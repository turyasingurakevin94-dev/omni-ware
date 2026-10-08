#!/usr/bin/env node
'use strict';
/*
 * The shop checks an agent's order before a prepay agent pays for it.
 *
 * A prepay agent used to be asked for the money the moment they sent the
 * order. If the shop then dropped a line it could not supply, the agent had
 * paid for goods they would never get, and the only way back was a refund.
 * Now the order waits in Draft until the shop confirms the lines it can
 * supply. The agent is asked to pay only after that, and only for the lines
 * that were kept.
 *
 * The confirmation signs the lines as they stood (agentOrderTerms). If a line
 * changes afterwards -- dropped, re-quantified, re-priced -- the signature
 * stops matching and the order goes back to "Shop is checking". No new
 * status: the board and client portal pin the status list.
 *
 * Run: node test/agent-check-then-pay.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter, stripTypes } = require('./_extract');

const t = createReporter('agent check then pay');
const shared = read('shared-worker.js');
const index = read('index.html');
const momo = read('supabase/functions/agent-initiate-momo-payment/index.ts');
const agent = read('agent.html');

/* ---------- 1. the signature and the gate (shared-worker.js) --------- */
const data = { agents: [{ id: 'A1', name: 'Brian', paymentTerm: 'prepay' }, { id: 'A2', name: 'Sara', paymentTerm: 'pay_on_delivery' }] };
const NAMES = ['agentOrderTerms', 'agentOrderConfirmed', 'agentOrderNeedsShopCheck'];
const { agentOrderTerms, agentOrderConfirmed, agentOrderNeedsShopCheck } =
  compileScope(NAMES.map((n) => extractFunction(shared, n, 'shared-worker.js')), { data }, NAMES);

const order = (over) => Object.assign({
  id: 9, status: 'draft', originAgentId: 'A1', agentPaymentStatus: 'unpaid',
  items: [
    { productId: 'P1', variantIdx: null, qty: 40, sellPrice: 33500 },
    { productId: 'P2', variantIdx: 2, qty: 60, sellPrice: 38000 },
  ],
}, over);

{
  const q = order({});
  t.check(agentOrderNeedsShopCheck(q) === true, 'a fresh prepay order waits for the shop to check it');
  q.shopConfirmedAt = Date.now();
  q.shopConfirmedTerms = agentOrderTerms(q);
  t.check(agentOrderConfirmed(q) === true && agentOrderNeedsShopCheck(q) === false,
    'once the shop confirms the lines, the agent can pay');

  q.items.pop();
  t.check(agentOrderConfirmed(q) === false && agentOrderNeedsShopCheck(q) === true,
    'dropping a line after confirming puts it back to "checking" -- the agent must not pay the old total');

  const r = order({});
  r.shopConfirmedAt = 1; r.shopConfirmedTerms = agentOrderTerms(r);
  r.items[0].sellPrice = 34000;
  t.check(agentOrderConfirmed(r) === false, 'so does a price changed after confirming');
  const s = order({});
  s.shopConfirmedAt = 1; s.shopConfirmedTerms = agentOrderTerms(s);
  s.items[1].qty = 59;
  t.check(agentOrderConfirmed(s) === false, 'and a quantity changed after confirming');

  t.check(agentOrderTerms(order({ items: [{ productId: 'P1', variantIdx: 0, qty: 1, sellPrice: 1 }] }))
    !== agentOrderTerms(order({ items: [{ productId: 'P1', variantIdx: null, qty: 1, sellPrice: 1 }] })),
    'variant 0 and "no variant" sign differently');

  t.check(agentOrderNeedsShopCheck(order({ originAgentId: 'A2' })) === false,
    'a pay-on-delivery agent is not held -- the shop prepares and the agent pays later');
  t.check(agentOrderNeedsShopCheck(order({ originAgentId: null })) === false, 'nor a shop order with no agent');
  t.check(agentOrderNeedsShopCheck(order({ status: 'preparing' })) === false, 'nor an order already past Draft');
  t.check(agentOrderNeedsShopCheck(order({ agentPaymentStatus: 'paid' })) === false,
    'nor one already paid (an order paid under the old flow is not re-gated)');
}

/* ---------- 2. index.html: the gate and the confirm action ------------ */
{
  const leave = extractFunction(index, 'orderLeaveDraft', 'index.html');
  const iCheck = leave.indexOf('agentOrderNeedsShopCheck(q)');
  const iPay = leave.indexOf('agentPaymentBlocksPreparing(q)');
  t.check(iCheck > 0 && iPay > iCheck, 'orderLeaveDraft refuses an unchecked prepay order before it looks at payment');

  const seen = { toasts: [], saved: 0, left: [] };
  const conf = compileScope([extractFunction(index, 'confirmAgentOrder', 'index.html')], {
    data,
    agentOrderTerms,
    agentPaymentBlocksPreparing: (q) => q.agentPaymentStatus !== 'paid' && q.originAgentId === 'A1',
    orderLeaveDraft: (q, o) => { seen.left.push([q.id, o]); q.status = 'preparing'; return true; },
    invoiceBalanceDue: (q) => q.items.reduce((s, it) => s + it.qty * it.sellPrice, 0),
    fmtUGX: (n) => 'UGX ' + Number(n).toLocaleString('en-US'),
    quoteClientName: () => 'Brian',
    ORDER_STATUS_SHORT_LABELS: { preparing: 'Preparing' },
    saveData: () => { seen.saved++; },
    renderSavedQuotes: () => {},
    toast: (m) => seen.toasts.push(String(m)),
  }, ['confirmAgentOrder']).confirmAgentOrder;

  const q = order({});
  t.check(conf(q) === true && q.shopConfirmedTerms === agentOrderTerms(q) && q.shopConfirmedAt > 0 && seen.saved === 1,
    'confirming signs the lines as they stand and saves');
  t.check(seen.left.length === 0 && seen.toasts.some((m) => /Brian is asked to pay UGX 3,620,000/.test(m)),
    `a prepay order stays put and says what the agent is now asked to pay (${JSON.stringify(seen.toasts)})`);

  const p = order({ originAgentId: 'A2' });
  conf(p);
  t.check(seen.left.length === 1 && seen.left[0][1].auto === true, 'a pay-on-delivery order moves on by itself once confirmed');

  seen.toasts.length = 0;
  t.check(conf(order({ items: [] })) === false && seen.toasts.some((m) => /cancel it instead/.test(m)),
    'an order with every line dropped cannot be confirmed -- there is nothing to pay for');
  t.check(conf(order({ status: 'preparing' })) === false, 'and a confirm on an order past Draft does nothing');

  t.check(/case 'agentconfirm': if\(q\) confirmAgentOrder\(q\); break;/.test(index), 'the board dispatches the Confirm lines action');
  t.check(/if\(agentOrderNeedsShopCheck\(q\)\) return \{ act:'agentconfirm', label:'Confirm lines' \};/.test(index),
    'and an unchecked agent order offers it as its one next step');
  t.check(/shopConfirmedAt:q\.shopConfirmedAt, shopConfirmedTerms:q\.shopConfirmedTerms, droppedLines:q\.droppedLines,/.test(index),
    'the confirmation and the dropped lines are synced to the server, where the agent app reads them');
}

/* ---------- 3. dropped lines are kept, so the agent sees them --------- */
{
  const rec = compileScope([extractFunction(index, 'ofDroppedRecord', 'index.html')], {}, ['ofDroppedRecord']).ofDroppedRecord;
  const r = rec({ productId: 'P1', variantIdx: undefined, productName: 'Nails', unit: 'ctn', qty: '4', sellPrice: 96000, agentSellPrice: 98500, price: 80000 }, 2);
  t.check(r.variantIdx === null && r.qty === 4 && r.at === 2 && r.productName === 'Nails',
    'a dropped line keeps what the agent needs to show it struck through');
  t.check(!('price' in r), 'and never the real supplier cost');
  t.check(/if \(q\.originAgentId\) \{\s*q\.droppedLines = \(q\.droppedLines \|\| \[\]\)\.concat\(\[ofDroppedRecord\(it, idx\)\]\);/.test(index),
    'the board records the drop on agent orders');
}

/* ---------- 4. the payment function refuses an unchecked order -------- */
{
  t.check(/order\.status === "draft" && !\(payload\.shopConfirmedAt && payload\.shopConfirmedTerms === agentOrderTerms\(payload\)\)/.test(momo),
    'mobile money is refused while the shop is still checking');
  const tsTerms = compileScope([stripTypes(extractFunction(momo, 'agentOrderTerms', 'agent-initiate-momo-payment'))], {}, ['agentOrderTerms']).agentOrderTerms;
  for (const q of [order({}), order({ items: [{ productId: 'X', variantIdx: 0, qty: '3', sellPrice: 1200.4 }] }), order({ items: [] })]) {
    t.check(tsTerms(q) === agentOrderTerms(q), `the server signs lines exactly as the shop does (${agentOrderTerms(q) || 'empty'})`);
  }
}

/* ---------- 5. the agent app is not asked for money on send ----------- */
{
  const handler = extractFunction(agent, 'submitOrder', 'agent.html');
  t.check(handler.length > 0 && !/openPaymentChoiceModal|openMomoPaymentModal/.test(handler),
    'sending an order never opens a payment prompt -- payment waits for the shop to check');
  t.check(/shopConfirmedAt: payload\.shopConfirmedAt \|\| null/.test(agent) && /droppedLines: Array\.isArray\(payload\.droppedLines\)/.test(agent),
    'the agent app reads the confirmation and the dropped lines');
  const ok = compileScope([
    extractFunction(agent, 'agentOrderTerms', 'agent.html'),
    extractFunction(agent, 'orderShopChecked', 'agent.html'),
  ], {}, ['orderShopChecked', 'agentOrderTerms']);
  const o = { status: 'draft', items: order({}).items };
  t.check(ok.orderShopChecked(o) === false, 'agent app: an unconfirmed draft is still being checked');
  o.shopConfirmedAt = 1; o.shopConfirmedTerms = ok.agentOrderTerms(o);
  t.check(ok.orderShopChecked(o) === true, 'agent app: a confirmed draft is ready to pay');
  t.check(ok.orderShopChecked({ status: 'preparing', items: [] }) === true, 'agent app: anything past Draft has been checked');
}

process.exit(t.done() ? 1 : 0);
