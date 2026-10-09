#!/usr/bin/env node
'use strict';
/*
 * An agent changing their mind about an order they already sent.
 *
 * Before they pay, the order is theirs: they edit it (a resubmission,
 * priced by agent-submit-order like any order) or cancel it. Once it is
 * paid or the shop has started, they can only ASK -- fewer of a line, or
 * none of anything -- and the shop answers each line from the order's
 * own drawer on the board. What an agreed line takes off a paid order is
 * the agent's credit, spent on their next order.
 *
 * Money moves on this path, so the rules are pinned at each of the three
 * places that hold them: the functions that refuse, the board that
 * decides, and the save that must not put back an order the agent has
 * already changed.
 *
 * Run: node test/agent-change-order.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('agent change order');
const eq = (got, want, msg) => t.check(JSON.stringify(got) === JSON.stringify(want),
  `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);

const fn = read('supabase/functions/agent-change-order/index.ts');
const submit = read('supabase/functions/agent-submit-order/index.ts');
const momo = read('supabase/functions/agent-initiate-momo-payment/index.ts');
const html = read('index.html');
const agent = read('agent.html');

/* ---------- 1. what the agent may do, decided by the server ---------- */
{
  const s = compileScope(['changeRefusal', 'orderIsOpen', 'buildAskLines', 'creditLeft', 'planCredit']
    .map((n) => extractFunction(fn, n, 'agent-change-order'))
    .concat([`const lineKey = (productId, variantIdx) => \`\${String(productId ?? "")}::\${variantIdx === null || variantIdx === undefined ? "" : String(variantIdx)}\`;`]),
  {}, ['changeRefusal', 'buildAskLines', 'creditLeft', 'planCredit'], { typescript: true });

  const draft = { status: 'draft', voided: false, amount_paid: 0, payload: { originAgentId: 'A1', agentPaymentStatus: 'unpaid' } };
  const paid = { status: 'preparing', voided: false, amount_paid: 500, payload: { originAgentId: 'A1', agentPaymentStatus: 'paid' } };
  eq(s.changeRefusal(draft, 'A1', 'cancel'), null, 'an unpaid draft can be cancelled by the agent');
  t.check(/ask them/.test(s.changeRefusal(paid, 'A1', 'cancel')), 'a paid order cannot -- they are told to ask');
  eq(s.changeRefusal(paid, 'A1', 'ask'), null, 'a paid order can be asked about');
  t.check(/change it yourself/.test(s.changeRefusal(draft, 'A1', 'ask')), 'an unpaid draft is not asked about -- it is changed directly');
  t.check(/does not belong/.test(s.changeRefusal(draft, 'A2', 'cancel')), "nobody changes another agent's order");
  t.check(/finished/.test(s.changeRefusal(Object.assign({}, paid, { status: 'completed' }), 'A1', 'ask')), 'a finished order is a return, not a change');
  t.check(/already cancelled/.test(s.changeRefusal(Object.assign({}, paid, { voided: true }), 'A1', 'ask')), 'a cancelled order cannot be asked about');
  t.check(/no request waiting/.test(s.changeRefusal(paid, 'A1', 'withdraw')), 'there is nothing to withdraw without an open ask');

  const items = [{ productId: 'p1', variantIdx: null, qty: 60, sellPrice: 38000, productName: 'Iron sheet' },
                 { productId: 'p2', variantIdx: 0, qty: 25, sellPrice: 7500, productName: 'Nails' }];
  const a = s.buildAskLines(items, [{ productId: 'p1', variantIdx: null, to: 40 }], false);
  eq(a.lines.map((l) => [l.from, l.to, l.sellPrice]), [[60, 40, 38000]], 'an ask carries the line as it stands and what is wanted');
  t.check(/fewer/.test(s.buildAskLines(items, [{ productId: 'p1', variantIdx: null, to: 80 }], false).error || ''),
    'asking for MORE is refused -- that is a new order');
  t.check(/not on this order/.test(s.buildAskLines(items, [{ productId: 'zz', to: 1 }], false).error || ''), 'a line not on the order is refused');
  t.check(/whole/.test(s.buildAskLines(items, [{ productId: 'p1', variantIdx: null, to: 2.5 }], false).error || ''), 'a fraction is refused');
  eq(s.buildAskLines(items, [], true).lines.map((l) => l.to), [0, 0], 'asking to cancel asks for none of every line');

  eq(s.creditLeft({ agentCredit: { amount: 760000, used: [{ amount: 200000 }] } }), 560000, 'credit left is what was given less what was used');
  eq(s.creditLeft({}), 0, 'an order with no credit has none');
  const plan = s.planCredit([
    { id: 2, payload: { agentCredit: { amount: 100, at: '2026-10-02', used: [] } } },
    { id: 1, payload: { agentCredit: { amount: 300, at: '2026-10-01', used: [{ amount: 100 }] } } },
  ], 250);
  eq(plan.map((p) => [p.from.id, p.amount]), [[1, 200], [2, 50]], 'credit is spent oldest first, and never more than is owed');
  t.check(fn.indexOf('agentCredit: { ...prev, used }') < fn.indexOf('amount_paid: newPaid'),
    'credit is marked spent on its source before it is paid onto the order, so a failure can never spend it twice');
}

/* ---------- 2. editing is a resubmission, priced here ---------------- */
{
  const s = compileScope(['replaceRefusal', 'keptLine', 'describeEdit'].map((n) => extractFunction(submit, n, 'agent-submit-order')),
    {}, ['replaceRefusal', 'keptLine', 'describeEdit'], { typescript: true });
  const order = { status: 'draft', voided: false, amount_paid: 0, payload: { originAgentId: 'A1', agentClientId: 'C1' } };
  eq(s.replaceRefusal(order, 'A1', 'C1'), null, 'an unpaid draft of their own can be edited');
  t.check(/paid/.test(s.replaceRefusal(Object.assign({}, order, { amount_paid: 10 }), 'A1', 'C1')), 'a paid one cannot');
  t.check(/started/.test(s.replaceRefusal(Object.assign({}, order, { status: 'awaiting_goods' }), 'A1', 'C1')), 'nor one the shop has started');
  t.check(/different client/.test(s.replaceRefusal(order, 'A1', 'C2')), 'nor moved to another client on the way');
  const was = [{ productId: 'p1', variantIdx: null, qty: 40, supplierId: 'S1', price: 31000, sellPrice: 32000, agentSellPrice: 33500 }];
  const kept = s.keptLine(was, { productId: 'p1', variantIdx: null, qty: 40, agentSellPrice: 34000 });
  t.check(kept && kept.supplierId === 'S1' && kept.price === 31000 && kept.agentSellPrice === 34000,
    "a line not touched keeps its supplier and cost -- so the supplier's yes still stands -- with the agent's own price updated");
  eq(s.keptLine(was, { productId: 'p1', variantIdx: null, qty: 50 }), null, 'a changed quantity is priced again');
  eq(s.describeEdit(was, [{ productId: 'p1', variantIdx: null, qty: 50, productName: 'Cement' }, { productId: 'p9', variantIdx: null, qty: 2, productName: 'Hammer' }])
    .map((l) => [l.productId, l.from, l.to]), [['p1', 40, 50], ['p9', 0, 2]], 'the edit says what changed, for the board');
  t.check(/if \(!replacing\) \{[\s\S]*?dedupe_lookup/.test(submit), 'an edit is never mistaken for a duplicate submission');
  t.check(/\.eq\("status", "draft"\)/.test(submit) && /agentEdit: \{ at: now, lines \}/.test(submit),
    'and is written only while the order is still a draft');
  t.check(/if \(payload\.agentCancel\) return json\(\{ error: "You cancelled this order" \}, 409\);/.test(momo),
    'a cancelled order cannot be paid');
}

/* ---------- 3. the shop decides, on the board ------------------------ */
{
  const s = compileScope(['agentChangeKey', 'agentChangeOpenLines', 'agentOrderOnHold', 'decideAgentChange']
    .map((n) => extractFunction(html, n, 'index.html')),
  { savedQuoteTotal: (q) => (q.items || []).reduce((t2, it) => t2 + it.qty * it.sellPrice, 0) },
  ['agentChangeKey', 'agentOrderOnHold', 'decideAgentChange']);
  const q = { items: [{ productId: 'p1', variantIdx: null, qty: 60, sellPrice: 38000 }, { productId: 'p2', variantIdx: null, qty: 25, sellPrice: 7500 }],
    amountPaid: 60 * 38000 + 25 * 7500,
    agentChange: { state: 'asked', lines: [{ productId: 'p1', variantIdx: null, from: 60, to: 40, sellPrice: 38000 }, { productId: 'p2', variantIdx: null, from: 25, to: 0, sellPrice: 7500 }] } };
  t.check(s.agentOrderOnHold(q), 'an open ask holds the order where it is');
  const r1 = s.decideAgentChange(q, 'p1::', true);
  eq([q.items[0].qty, r1.credit, q.agentCredit.amount], [40, 760000, 760000], 'agreeing a line changes it, and the difference is credit');
  t.check(s.agentOrderOnHold(q), 'one line answered of two still holds it');
  const r2 = s.decideAgentChange(q, 'p2::', false);
  eq([q.items.length, r2.credit, q.agentCredit.amount, q.agentChange.state], [2, 0, 760000, 'agreed'], 'keeping a line changes nothing and closes the ask');
  t.check(!s.agentOrderOnHold(q), 'and the order moves on again');
  eq(s.decideAgentChange(q, 'p2::', true), null, 'a closed ask cannot be answered twice');

  const c = { items: [{ productId: 'p1', variantIdx: null, qty: 2, sellPrice: 100 }], amountPaid: 200,
    agentCredit: { amount: 0, used: [{ to: 9, amount: 0 }] },
    agentChange: { state: 'asked', cancel: true, lines: [{ productId: 'p1', variantIdx: null, from: 2, to: 0, sellPrice: 100 }] } };
  s.decideAgentChange(c, 'p1::', true);
  t.check(c.agentCancel && c.agentCancel.agreed && c.agentCredit.amount === 200 && c.agentCredit.used.length === 1,
    'agreeing to cancel everything leaves a cancel for the shop to close, with all of it as credit, and keeps the record of credit used');

  t.check(/if\(agentOrderOnHold\(q\)\) return false;/.test(extractFunction(html, 'orderLeaveDraft', 'index.html')),
    'nothing leaves Quoted by itself while the agent has cancelled or asked');
  t.check(/agentOrderOnHold\(q\)\) return;/.test(html), "and the board's autopilot leaves it alone");
}

/* ---------- 4. a save never puts back what the agent changed --------- */
{
  const sync = extractFunction(html, 'buildSyncRows', 'index.html');
  ['agentCancel', 'agentChange', 'agentEdit', 'agentCredit'].forEach((k) => {
    t.check(new RegExp(`\\.\\.\\.\\(q\\.${k} \\? \\{${k}:q\\.${k}\\} : \\{\\}\\)`).test(sync), `${k} is named in the save, so it is not stripped`);
  });
  const s = compileScope([extractFunction(html, 'mergeAgentOwnedKeys', 'index.html')], {}, ['mergeAgentOwnedKeys']);
  const row = { amount_paid: 1000, payload: { items: [{ qty: 1 }], agentChange: { at: '1', state: 'asked', lines: [] },
    agentCredit: { amount: 500, used: [{ to: 7, at: 'a', amount: 100 }] }, payments: [] } };
  const mem = {};
  s.mergeAgentOwnedKeys({
    items: [{ qty: 9 }], agentEdit: { at: '5' }, agentCancel: { at: '6' },
    agentChange: { at: '1', state: 'withdrawn', lines: [] },
    agentCredit: { amount: 500, used: [{ to: 7, at: 'a', amount: 100 }, { to: 8, at: 'b', amount: 300 }] },
    payments: [{ creditFrom: 3, date: 'd', amount: 250 }], agentPaymentStatus: 'paid',
  }, row, mem);
  t.check(row.payload.agentCancel && mem.agentCancel, 'a cancel the copy never saw is kept, in the row and in memory');
  eq(row.payload.agentChange.state, 'withdrawn', 'withdrawing an ask nobody answered is the agent\'s word');
  eq(row.payload.items, [{ qty: 9 }], 'an edit made after the copy was read brings its lines');
  eq(row.payload.agentCredit.used.length, 2, 'credit spent elsewhere stays spent');
  eq([row.payload.payments.length, row.amount_paid, row.payload.agentPaymentStatus], [1, 1250, 'paid'], 'and credit paid onto this order is added');
  const tie = extractFunction(html, 'mergeServerStageLogs', 'index.html');
  t.check(/mergeAgentOwnedKeys\(/.test(tie) && /agentChange:payload->agentChange/.test(tie), 'the merge rides the save that already reads the order back');
}

/* ---------- 5. the agent app ---------------------------------------- */
{
  const s = compileScope([extractFunction(agent, 'changeZone', 'agent.html')], {}, ['changeZone']);
  eq(s.changeZone({ status: 'draft', amountPaid: 0, agentPaymentStatus: 'unpaid' }), 'free', 'before paying: change freely');
  eq(s.changeZone({ status: 'draft', amountPaid: 0, agentPaymentStatus: 'paid' }), 'ask', 'paid: ask the shop');
  eq(s.changeZone({ status: 'preparing', amountPaid: 0 }), 'ask', 'started: ask the shop');
  eq(s.changeZone({ status: 'completed' }), 'none', 'done: nothing');
  eq(s.changeZone({ status: 'draft', agentCancel: { at: 1 } }), 'none', 'cancelled: nothing');
  t.check(/data-change aria-label="Change or cancel this order"/.test(agent) && /openChangeSheet\(o\.id\)/.test(agent),
    'the order has a Change button, and it opens the change sheet');
  t.check(/agentCancel: payload\.agentCancel \|\| null/.test(agent) && /agentCredit: payload\.agentCredit \|\| null/.test(agent),
    "the agent's orders carry what the server wrote");
  t.check(/!o\.voided && !o\.agentCancel && o\.status !== 'completed'/.test(agent), 'a cancelled order is no longer live');
  t.check(/replaceOrderId: o\.id/.test(agent) && /'agent-change-order', \{ orderId: o\.id, action: 'ask'/.test(agent),
    'an edit goes as a resubmission and an ask to agent-change-order');
  t.check(/if\(agentCreditLeft\(order\.id\) > 0\)/.test(agent), 'credit is used by itself before the phone is asked to pay');
}

process.exit(t.done() ? 1 : 0);
