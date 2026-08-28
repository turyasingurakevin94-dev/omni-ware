#!/usr/bin/env node
'use strict';
/*
 * The Manager: a businessman's mind that plans, executes with approval,
 * and answers for results.
 *
 * The owner asked for "a mind of a great businessman that acts upon
 * this data". A great manager hired to run somebody else's shop reads
 * the whole position, picks the few moves that matter, executes what is
 * agreed, and ACCOUNTS for what his advice earned — he does not
 * secretly move the owner's money. So the laws this file guards are the
 * shop's own, applied to the new mind:
 *
 *   ONE READING     dashboardContext feeds the dashboard and shop_pulse
 *                   alike; a second hand-built copy is forbidden.
 *   NEVER LEAKS     the [plan:] block is machine plumbing and must never
 *                   reach the screen or the speaker — the [choices:]
 *                   lesson, paid for once already.
 *   NEVER UNTAPPED  a meeting spends the owner's AI money, so nothing
 *                   starts one but a tap.
 *   DERIVED VERDICT what happened to each move comes from the books at
 *                   render time, never from a stored opinion — and a
 *                   chase is answered only by ledger rows that carry a
 *                   cash link, the debtCollectionsOn lesson.
 *
 * Run: node test/manager.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('the manager');
const src = read('index.html');
const api = read('api/assistant.js');
const code = src.split(/\r?\n/).map((l) => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');
const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);

/* ---------- 1. one context, two readers ----------------------------- */
{
  const NAMES = ['dashboardContext'];
  const fns = compileScope(NAMES.map((n) => extractFunction(src, n, 'index.html')), {
    data: { customers: [{ id: 1, name: 'Dad', debt: 900000 }] },
    anInvoicesInRange: () => [], anOverallTotals: () => ({ sales: 0, profit: 0, cost: 0 }),
    cashOpexTotal: () => 0, dashCashTxnsInRange: () => [],
    dashCashBalanceAllTime: () => 500000, dashMonthlyBurn: () => 100000,
    dashInventoryHealth: () => ({ deadValue: 0, deadQty: 0, ratio: 100 }),
    daysSinceDate: () => 40, customerOldestOpenChargeDate: () => '2026-07-19',
    dashGoingQuietCustomers: () => [], dashDemandBreadth: () => [],
    anRowsByItem: () => [], dashStockOutExposure: () => [], dashSupplierPriceInflation: () => [],
  }, NAMES);
  const ctx = fns.dashboardContext('2026-07-30', '2026-08-28');
  /* Every key dashAlerts reads must be on the object, or the tool would
     feed it a hole where the dashboard feeds it a figure. */
  ['itemRows', 'totals', 'opex', 'grossProfit', 'netProfit', 'cashBalance', 'burn',
    'runwayMonths', 'inv', 'debtors', 'goingQuiet', 'concentration', 'stockOut', 'inflation']
    .forEach((k) => t.check(k in ctx, `dashboardContext carries ${k}, which dashAlerts reads`));
  eq(ctx.debtors.length, 1, 'and the debtor rows are derived inside it, not handed in');
  eq(ctx.runwayMonths, 5, 'runway is the same arithmetic the dashboard showed');
}

/* ---------- 2. the plan block never reaches the screen -------------- */
{
  const NAMES = ['apExtractPlan'];
  const fns = compileScope(NAMES.map((n) => extractFunction(src, n, 'index.html')), {}, NAMES);
  const { apExtractPlan } = fns;

  const good = 'Chase Milly first.\n\n[plan: {"moves":[{"title":"Chase Milly","why":"Owes 840,000","worth":840000,"door":"chase","kind":"chase","subject":{"customerId":7}}],"rejected":"Held off the cement buy","keyline":"Cash first."}]';
  const r1 = apExtractPlan(good);
  t.check(!!r1.plan && r1.plan.moves.length === 1, 'a well-formed block parses into moves');
  eq(r1.plan.moves[0].subject.customerId, 7, 'with its subject ids intact');
  eq(r1.clean, 'Chase Milly first.', 'and the prose comes back without a trace of it');

  /* JSON can carry "]" inside strings — the reason the end of the block
     is found by walking braces, not by a regex stopping at a bracket. */
  const tricky = 'Do it.\n[plan: {"moves":[{"title":"Fix [urgent] pricing","why":"a \\"quoted\\" reason","worth":0,"door":"prices","kind":"price"}],"keyline":"k"}]';
  const r2 = apExtractPlan(tricky);
  t.check(!!r2.plan, 'a bracket inside a string does not end the block early');
  t.check(!/\[plan/i.test(r2.clean), 'and the block still leaves the prose entirely');

  const broken = 'Some advice.\n[plan: {"moves": [{"title": "unclosed"';
  const r3 = apExtractPlan(broken);
  eq(r3.plan, null, 'a block that cannot be walked parses to nothing');
  t.check(!/\[plan/i.test(r3.clean), 'and is STILL stripped — half a JSON object on screen is the same failure as all of it');

  const movesWrong = 'Text.\n[plan: {"moves": "not an array"}]';
  eq(apExtractPlan(movesWrong).plan, null, 'a plan whose moves are not an array is refused, not rendered');

  const none = apExtractPlan('Plain answer, no block.');
  eq(none.plan, null, 'no block, no plan');
  eq(none.clean, 'Plain answer, no block.', 'and the prose is untouched');
}

/* ---------- 3. shop_pulse is a reading, not a dump ------------------ */
{
  const many = (n, f) => Array.from({ length: n }, (_, i) => f(i));
  const data = { presetOrderStageLimits: {}, customers: [] };
  const env = {
    data,
    todayISO: () => '2026-08-28', anShiftDate: (d, n) => '2026-07-30',
    apRound: (n) => Math.round(Number(n) || 0),
    dashboardContext: () => ({ inv: { deadValue: 123456.7, deadQty: 40.2 } }),
    dashAlerts: () => many(12, (i) => ({ band: 'now', title: 'Alert ' + i, money: 1000 * i, action: 'Act', detail: '<b>html</b>', extra: 'x' })),
    debtChaseRows: () => ({ due: many(9, (i) => ({ name: 'C' + i, debt: 5000 * i, ageDays: i })), resting: [1, 2], blocked: [{ why: 'drift' }], graceDays: 7, restDays: 3 }),
    purchasePlan: () => ({ lines: many(11, (i) => ({ name: 'P' + i, reason: 'why ' + i, cost: 100 * i, supplier: 'S' })), didNotFit: [1, 2, 3], sourceFirst: [1] }),
    cashOnHandByAccount: () => ({ total: 3545644, byAccount: [{ key: 'cash', amount: 1000 }, { key: 'momo', amount: 2000 }, { key: 'bank', amount: 3000 }] }),
    consignmentRows: () => [{ owed: 2295000 }, { owed: 0.2 }],
    morningBriefData: () => ({ sales: { total: 100, count: 2, profit: 50, estimated: true },
      cash: { counted: false }, paid: { total: 0, count: 0 },
      stuck: many(6, (i) => ({ name: 'Q' + i, statusLabel: 'Being Prepared', overMinutes: 60 + i })), ranOutCount: 3 }),
    priceReviewCandidates: () => many(9, (i) => ({ pname: 'Item' + i, sname: 'Sup' + i, moneyAtRisk: 999 })),
    followUpClientsToContact: () => many(8, (i) => ({ name: 'F' + i, hasNews: i % 2 === 0 })),
    SQ_STATUS_ORDER: ['draft', 'awaiting_goods', 'preparing', 'pending_delivery', 'completed'],
    Date, JSON, Math, Number, String, Array, Object,
  };
  // compileScope exports functions only; the registry is an object, so it
  // travels out inside one — the same trick assistant-tools.test.js uses.
  const scope = compileScope([
    extractDeclaration(src, 'ASSISTANT_TOOLS', 'index.html'),
    'function names(){ return { ASSISTANT_TOOLS }; }',
  ], env, ['names']);
  const pulse = scope.names().ASSISTANT_TOOLS.shop_pulse.run();

  eq(pulse.alerts.length, 8, 'alerts are capped — a reading, not the whole board');
  eq(Object.keys(pulse.alerts[0]).sort().join(','), 'action,band,money,title',
    'and each alert carries exactly the four fields, never the raw card with its HTML');
  eq(pulse.debts.chase_now.length, 6, 'the chase list is capped');
  eq(pulse.debts.chase_count, 9, 'while the true count still travels — capped is not concealed');
  eq(pulse.buying.top_lines.length, 6, 'the buy plan is capped');
  eq(pulse.prices_to_check.length, 5, 'prices to check are capped');
  eq(pulse.follow_ups_due.length, 5, 'follow-ups are capped');
  eq(pulse.consignment.owed_total, 2295000, 'consignment counts only real balances');
  eq(pulse.consignment.consignors, 1, 'and only consignors actually owed');
  eq(pulse.stage_limits_set, false,
    'an empty late-orders list says whether it means "nothing late" or "no limits set"');
  t.check(pulse.yesterday.profit_partly_estimated === true,
    'an estimated profit is flagged, so the manager cannot state it as certain');
}

/* ---------- 4. the verdict comes from the books --------------------- */
{
  const data = { customers: [], stockLog: [], savedQuotes: [], purchaseInvoices: [] };
  const NAMES = ['deriveMoveOutcome'];
  const fns = compileScope(NAMES.map((n) => extractFunction(src, n, 'index.html')), {
    data, fmtUGX: (n) => `${Math.round(n).toLocaleString('en-US')} UGX`,
  }, NAMES);
  const { deriveMoveOutcome } = fns;
  const move = (mkind, subject, date) => ({ date: date || '2026-08-25', status: 'open', body: { mkind, subject } });

  data.customers = [{ id: 7, debtLog: [
    /* The invoice sync's echo rows carry no cash link — counting them
       would credit the manager's advice with money that never moved,
       the exact lie debtCollectionsOn was built to stop. */
    { type: 'payment', amount: 500000, date: '2026-08-26', cashTxnId: null },
    { type: 'payment', amount: 400000, date: '2026-08-26', cashTxnId: 12 },
    { type: 'payment', amount: 999999, date: '2026-08-20', cashTxnId: 13 },
  ] }];
  const chase = deriveMoveOutcome(move('chase', { customerId: 7 }));
  t.check(/400,000/.test(chase.derived), `only the cash-linked payment since the advice counts (${chase.derived})`);
  t.check(!/999,999|500,000/.test(chase.derived), 'not the echo row, and not money from before the advice');

  data.stockLog = [{ key: 'P1::0', type: 'restock', date: '2026-08-27' }];
  eq(deriveMoveOutcome(move('buy', { key: 'P1::0' })).derived, 'restocked since', 'a buy move is answered by the stock log');
  eq(deriveMoveOutcome(move('buy', { key: 'P9' })).derived, 'not restocked yet', 'and honestly when nothing arrived');

  data.savedQuotes = [{ id: 44, invoiced: true }];
  eq(deriveMoveOutcome(move('invoice', { orderId: 44 })).derived, 'invoiced', 'an invoice move by the order itself');
  eq(deriveMoveOutcome(move('other', {})).derived, null,
    'and a kind nothing can derive says nothing — named, not guessed');
}

/* ---------- 5. nothing runs untapped -------------------------------- */
{
  t.check(!/runManagerMeeting/.test(extractFunction(src, 'boot', 'index.html')),
    'boot never holds a meeting — it is the owner\'s AI money');
  t.check(!/runManagerMeeting\(\)/.test(extractFunction(src, 'renderManager', 'index.html')
    .replace(/addEventListener\('click', runManagerMeeting\)/g, '')),
    'rendering the screen never holds one either — only its button does');
  const card = extractFunction(src, 'renderManagerCard', 'index.html');
  t.check(/addEventListener\('click', \(\)=>\{ goToTab\('manager'\); runManagerMeeting\(\); \}\)/.test(card),
    'the dashboard card runs it on a tap and on nothing else');
  t.check(!/setInterval[\s\S]{0,200}runManagerMeeting/.test(code),
    'and no timer anywhere starts a meeting');
}

/* ---------- 6. memory guarded, never silently dropped ---------------- */
{
  const save = extractFunction(src, 'managerSaveMeeting', 'index.html');
  t.check(/if\(!managerNotesTable\) return null;/.test(save),
    'a save without the table returns rather than throwing into the meeting');
  t.check(/Paste <b>supabase\/migrations\/0081_manager_notes\.sql<\/b>/.test(src),
    'and the screen names the exact migration, so the fix is one paste away');
  t.check(/The manager cannot remember yet\./.test(src),
    'in words that say what is missing, not that something failed');
  const hist = code.slice(code.indexOf('manager_history: {'), code.indexOf('\n\n', code.indexOf('manager_history: {')));
  t.check(/if\(!managerNotesTable\) return \{/.test(hist),
    'manager_history answers the missing table in words the model can act on, instead of erroring');
}

/* ---------- 7. the second mind, on the server ------------------------ */
{
  t.check(/const MANAGER_EXTENSION = \[/.test(api), 'the manager prompt lives on the server like the first one');
  t.check(/AT MOST FIVE moves/.test(api), 'at most five moves — a plan of twenty is a dashboard, not judgement');
  t.check(/Never forecast/.test(api), 'forecasting is forbidden in as many words');
  t.check(/manager_history FIRST/.test(api), 'the meeting opens with its own account');
  t.check(/never invent one, and omit subject entirely when you have none/.test(api),
    'subject ids come from tools or not at all');
  t.check(/ONE thing you considered and rejected/.test(api),
    'a plan with nothing rejected was not thought about');
  const doors = extractDeclaration(src, 'MANAGER_DOORS', 'index.html');
  ['chase', 'buy', 'prices', 'consignment', 'orders', 'followups', 'cashbook'].forEach((d) =>
    t.check(new RegExp(`\\b${d.replace('-', '\\-')}:`).test(doors) || doors.includes(`'${d}'`),
      `the ${d} door the prompt offers actually opens somewhere`));
  t.check(/apExtractPlan\(String\(text\)\)\.clean/.test(code),
    'and the speaker reads the stripped prose — a JSON block read aloud is the plumbing speaking');
}

/* ---------- 8. a failure is never anonymous, a panel never dead ------ */
/* Found live on the Manager's first outing: a tap that landed mid-deploy
   got a platform page back -- no JSON, no message -- and the owner read
   a bare "Something went wrong" with nothing to act on. And one branch
   over, an OK status wrapping an unreadable body returned null, which
   the loop reads as "error already rendered" and ends the turn showing
   NOTHING at all. */
{
  const call = extractFunction(src, 'apCallServer', 'index.html');
  t.check(/'Something went wrong \(HTTP ' \+ resp\.status \+ '\)\. Try again\.'/.test(call),
    'a bodyless failure names its HTTP status — the one fact that diagnoses it');
  t.check(/something unreadable \(HTTP ' \+ resp\.status/.test(call),
    'and an OK status with an unreadable body says so instead of ending the turn silent');
}

process.exit(t.done() ? 1 : 0);
