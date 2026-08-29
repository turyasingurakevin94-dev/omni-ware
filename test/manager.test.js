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
    /* The whole shape dashboardContext really returns. It was a stub of
       one key until the pulse learned to read the profit side; a fixture
       thinner than the contract only proves the tool never looked. */
    dashboardContext: () => ({ inv: { deadValue: 123456.7, deadQty: 40.2 },
      grossProfit: 0, netProfit: 0, opex: 0, burn: 0, runwayMonths: null,
      totals: { sales: 0, estimatedQty: 0 }, invoices: [], itemRows: [],
      goingQuiet: [], concentration: [], inflation: [], stockOut: [] }),
    anRowsByCustomer: () => [],
    uncostedStockRows: () => [],
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
  const handlerSrc = api;
  t.check(/type: 'crash', message: 'The server hit a bug — ' \+ String/.test(handlerSrc),
    'the server has an outer catch, so no throw anywhere in the handler dies as a bare platform page');
  t.check(/'The server hit a bug — ' \+ String\(\(err && err\.message\) \|\| err\)\.slice\(0, 300\)/.test(handlerSrc),
    'and both catch tails carry the real error message — the panel is the only log the shop can read');
  const call = extractFunction(src, 'apCallServer', 'index.html');
  t.check(/'Something went wrong \(HTTP ' \+ resp\.status \+ '\)\. Try again\.'/.test(call),
    'a bodyless failure names its HTTP status — the one fact that diagnoses it');
  t.check(/something unreadable \(HTTP ' \+ resp\.status/.test(call),
    'and an OK status with an unreadable body says so instead of ending the turn silent');
}

/* ---------- 9. the review block: second tag, same never-leaks law ---- */
/* The weekly review ends with [review: {...}] instead of a plan. It is
   the same machine plumbing, so the same law: parsed for the journal,
   stripped for the screen and the speaker — and a text carrying BOTH
   blocks must shed both. */
{
  const NAMES = ['apExtractPlan'];
  const fns = compileScope(NAMES.map((n) => extractFunction(src, n, 'index.html')), {}, NAMES);
  const { apExtractPlan } = fns;

  const both = 'The week held.\n[plan: {"moves":[],"keyline":"k"}]\n[review: {"verdict":"Held, thanks to collections.","lessons":["Chase before Friday"]}]';
  const pass1 = apExtractPlan(both);
  t.check(/\[review/.test(pass1.clean) && !/\[plan/.test(pass1.clean),
    'the plan pass takes only the plan block — tags do not bleed into each other');
  const pass2 = apExtractPlan(pass1.clean, 'review');
  eq(pass2.plan && pass2.plan.verdict, 'Held, thanks to collections.', 'the review parses out of the second pass');
  eq((pass2.plan.lessons || [])[0], 'Chase before Friday', 'with its lessons intact');
  t.check(!/\[review|\[plan/i.test(pass2.clean), 'and after both passes neither block survives to the screen');

  const noVerdict = apExtractPlan('Text.\n[review: {"lessons":["x"]}]', 'review');
  eq(noVerdict.plan, null, 'a review without a verdict string is refused, not journalled');
  t.check(!/\[review/i.test(noVerdict.clean), 'but STILL stripped — refused plumbing on screen is the same failure');

  t.check(/apExtractPlan\(noPlan, 'review'\)/.test(extractFunction(src, 'apRenderAssistant', 'index.html')),
    'the renderer strips both tags unconditionally, whatever mode the chat is in');
  t.check(/apExtractPlan\(apExtractPlan\(String\(text\)\)\.clean, 'review'\)\.clean/.test(code),
    'and so does the speaker — a JSON verdict read aloud is the plumbing speaking');
}

/* ---------- 10. the review on the server, the screen, and 0082 ------- */
{
  t.check(/THE WEEKLY REVIEW\./.test(api) && /"Hold the weekly review"/.test(api),
    'the review lives inside the same manager mind, selected by its trigger sentence — no second mode');
  t.check(/Call week_review_data first/.test(api), 'and it opens by reading the week, not by remembering it');
  t.check(/DO NOT emit a \[plan:\] block in a review/.test(api),
    'a review judges; the next meeting plans — the plan block is banned in as many words');
  t.check(/\[review: \{"verdict":"one sentence","lessons":/.test(api),
    'and it ends with exactly one review block in the stated shape');
  t.check(/collected_after_chases is the headline/.test(api),
    'what the chases actually collected is named the headline figure');
  t.check(/say so plainly and stop short/.test(api),
    'a thin week is said plainly, never padded into a long review');
  t.check(/name: 'week_review_data'/.test(api), 'the week tool is offered to the model');

  const mig = read('supabase/migrations/0082_manager_reviews.sql');
  t.check(/drop constraint if exists manager_notes_kind_check/.test(mig),
    '0082 drops the old kind check by its conventional name, tolerating a rename');
  t.check(/check \(kind in \('meeting', 'move', 'review'\)\)/.test(mig),
    'and re-adds it with the review kind — without this every review save is refused');

  const render = extractFunction(src, 'renderManager', 'index.html');
  t.check(/Weekly review — /.test(render) && /st\.reviews/.test(render),
    'the screen reads journalled reviews and names them in the history');
  t.check(/wk\.sales/.test(render) && /wk\.collected_after_chases/.test(render),
    'the review card’s week table is built from the stored derivation, never from model text');
  t.check(/on record this week — the review will be as thin as that/.test(render),
    'and the offer says how thin the evidence is BEFORE the owner spends credit on it');

  /* Same tap law as the meeting: a review spends the owner's AI money. */
  t.check(!/runManagerReview/.test(extractFunction(src, 'boot', 'index.html')),
    'boot never holds a review');
  t.check(!/runManagerReview\(\)/.test(render.replace(/addEventListener\('click', runManagerReview\)/g, '')),
    'rendering the screen never holds one either — only its button does');
  t.check(!/setInterval[\s\S]{0,200}runManagerReview/.test(code),
    'and no timer anywhere starts one');
}

/* ---------- 11 & 12 run the executors, so they await ------------------ */
(async () => {
  /* ---------- 11. week_review_data: the week as the books derived it -- */
  {
    const shift = (iso, n) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
    const data = {
      customers: [{ id: 7, debtLog: [
        /* The 500,000 echo row (no cash link) and the 999,999 paid before
           the advice must count for NOTHING — the whole point of routing
           the aggregation through deriveMoveOutcome. */
        { type: 'payment', amount: 500000, date: '2026-08-26', cashTxnId: null },
        { type: 'payment', amount: 400000, date: '2026-08-26', cashTxnId: 12 },
        { type: 'payment', amount: 999999, date: '2026-08-20', cashTxnId: 13 },
      ] }],
      stockLog: [], savedQuotes: [], purchaseInvoices: [],
      cashTxns: [
        { date: '2026-08-25', amount: 50000, type: 'in' },
        { date: '2026-08-25', amount: 20000, type: 'out' },
        { date: '2026-08-18', amount: 7000, type: 'in' },
      ],
    };
    const journal = [
      { kind: 'meeting', id: 1, date: '2026-08-27' },
      { kind: 'meeting', id: 2, date: '2026-08-28' },
      { kind: 'move', id: 3, date: '2026-08-25', status: 'done',
        body: { mkind: 'chase', title: 'Chase Milly', subject: { customerId: 7 } } },
      { kind: 'move', id: 4, date: '2026-08-26', status: 'skipped',
        body: { mkind: 'buy', title: 'Buy cement', subject: { key: 'P9' }, skipReason: 'No transport this week' } },
      { kind: 'move', id: 5, date: '2026-08-26', status: 'open', body: { mkind: 'other', title: 'Call the landlord' } },
    ];
    const fakeSb = { from: () => {
      const q = { _f: {} };
      q.select = () => q;
      q.eq = (c, v) => { if (c === 'kind') q._f.kind = v; return q; };
      q.gte = (c, v) => { q._f.gte = v; return q; };
      q.lte = (c, v) => { q._f.lte = v; return q; };
      // The week tool now also reads the scoreboard, which orders and limits.
      q.order = () => q;
      const rows = () => journal.filter((r) => r.kind === q._f.kind
        && (!q._f.gte || String(r.date) >= q._f.gte) && (!q._f.lte || String(r.date) <= q._f.lte));
      q.limit = () => Promise.resolve({ data: rows(), error: null });
      q.then = (resolve) => resolve({ data: rows(), error: null });
      return q;
    } };
    const env = {
      data, sb: fakeSb, managerNotesTable: true, currentShopId: 'shop-1',
      todayISO: () => '2026-08-28', anShiftDate: shift,
      apRound: (n) => Math.round(Number(n) || 0),
      fmtUGX: (n) => `${Math.round(n).toLocaleString('en-US')} UGX`,
      anInvoicesInRange: (f, to) => [{ to }],
      anOverallTotals: (inv) => inv[0].to === '2026-08-28'
        ? { sales: 900000.4, profit: 200000, count: 4, estimatedQty: 1 }
        : { sales: 500000, profit: 100000, count: 2, estimatedQty: 0 },
      debtCollectionsOn: (d) => ({ total: d >= '2026-08-22' ? 10000 : 3000 }),
      cashIsMoneyIn: (tx) => tx.type === 'in',
      Date, JSON, Math, Number, String, Array, Object, Promise,
    };
    const scope = compileScope([
      extractDeclaration(src, 'ASSISTANT_TOOLS', 'index.html'),
      extractFunction(src, 'deriveMoveOutcome', 'index.html'),
      extractFunction(src, 'managerScoreboard', 'index.html'),
      extractFunction(src, 'managerScoreProgress', 'index.html'),
      extractDeclaration(src, 'MANAGER_METRICS', 'index.html'),
      'function names(){ return { ASSISTANT_TOOLS }; }',
    ], env, ['names']);
    const tool = scope.names().ASSISTANT_TOOLS.week_review_data;
    t.check(tool && tool.confirm === false, 'week_review_data reads and nothing more');
    const out = await tool.run();

    t.check(out.this_week.from === '2026-08-22' && out.prior_week.to === '2026-08-21' && out.prior_week.from === '2026-08-15',
      'the two 7-day windows tile exactly — no overlap, no gap');
    eq(out.this_week.sales, 900000, 'this week’s sales come from the same accrual totals the statements use');
    eq(out.prior_week.sales, 500000, 'and the prior week is a genuinely different reading');
    t.check(out.this_week.profit_partly_estimated === true && out.prior_week.profit_partly_estimated === false,
      'an estimated profit is flagged per week, so the review cannot state it as certain');
    eq(out.this_week.collected, 70000, 'collected is the 7 daily collection readings summed');
    eq(out.prior_week.collected, 21000, 'for each week from its own days');
    t.check(out.this_week.cash_in === 50000 && out.this_week.cash_out === 20000,
      'cash in and out split by the cash book’s own direction rule');
    eq(out.advice.meetings_held, 2, 'the week counts its meetings');
    t.check(out.advice.thin === true, 'and under three of them says THIN in the data itself');
    t.check(out.advice.advised === 3 && out.advice.done === 1 && out.advice.skipped === 1 && out.advice.not_acted_on === 1,
      'advised, done, skipped and untouched are counted from the journal rows');
    eq(out.advice.collected_after_chases, 400000,
      'chase money flows through deriveMoveOutcome — the echo row and the money from before the advice count for nothing');
    const chased = out.advice.moves.find((m) => m.title === 'Chase Milly');
    t.check(chased && /400,000/.test(chased.what_the_books_say), 'each chase move carries what the books say');
    const skippedMove = out.advice.moves.find((m) => m.title === 'Buy cement');
    eq(skippedMove && skippedMove.skip_reason, 'No transport this week',
      'the owner’s own skip reason travels into the review');

    for (let i = 0; i < 17; i++) journal.push({ kind: 'move', id: 10 + i, date: '2026-08-24', status: 'open', body: { mkind: 'other', title: 'M' + i } });
    const out2 = await tool.run();
    t.check(out2.advice.moves.length === 15 && out2.advice.advised === 20,
      'the move list is capped at fifteen while the true counts still travel — capped is not concealed');

    /* Without the table: figures still answer, memory says so honestly,
       and the database is never touched. */
    const scope2 = compileScope([
      extractDeclaration(src, 'ASSISTANT_TOOLS', 'index.html'),
      extractFunction(src, 'deriveMoveOutcome', 'index.html'),
      extractFunction(src, 'managerScoreboard', 'index.html'),
      extractFunction(src, 'managerScoreProgress', 'index.html'),
      extractDeclaration(src, 'MANAGER_METRICS', 'index.html'),
      'function names(){ return { ASSISTANT_TOOLS }; }',
    ], { ...env, managerNotesTable: false,
      sb: { from() { throw new Error('touched the database without the table'); } } }, ['names']);
    const bare = await scope2.names().ASSISTANT_TOOLS.week_review_data.run();
    eq(bare.advice.memory, 'not set up', 'without the table the advice section says so instead of erroring');
    t.check(/memory migration/.test(bare.advice.note), 'in words that name the fix');
    eq(bare.this_week.sales, 900000, 'while the week’s figures still answer — the books need no journal');
  }

  /* ---------- 12. the review’s journal row --------------------------- */
  {
    const inserted = [];
    const toasts = [];
    const mk = (envExtra) => compileScope([extractFunction(src, 'managerSaveReview', 'index.html')], {
      managerNotesTable: true, currentShopId: 'shop-1',
      todayISO: () => '2026-08-28', apRound: (n) => Math.round(Number(n) || 0),
      toast: (m) => toasts.push(m),
      sb: { from: () => ({ insert: (row) => { inserted.push(row); return Promise.resolve({ error: null }); } }) },
      Array, String, Number, Math, Promise, JSON, Object,
      ...envExtra,
    }, ['managerSaveReview']).managerSaveReview;

    const review = { verdict: 'A hard week saved by collections.',
      lessons: ['One', 'Two', 'Three', 'Four', 'Five'],
      week: { sales: 999999999 } };
    const weekData = {
      this_week: { sales: 900000, gross_profit: 200000, collected: 70000 },
      prior_week: { sales: 500000, gross_profit: 100000 },
      advice: { meetings_held: 2, advised: 3, done: 1, skipped: 1, not_acted_on: 1, collected_after_chases: 400000 },
    };
    await mk({})(review, weekData);
    const row = inserted[0];
    t.check(row && row.kind === 'review' && row.status === 'held', 'a review row of its own kind, held');
    eq(row.body.verdict, 'A hard week saved by collections.', 'the verdict is the model’s judgement');
    eq(row.body.lessons.length, 3, 'lessons are capped at three — more is a lecture, not a lesson');
    eq(row.body.week.sales, 900000,
      'but the week’s figures come from week_review_data’s derivation — the model’s own week object is ignored');
    eq(row.body.week.collected_after_chases, 400000, 'including the headline chase figure');
    eq(row.body.week.prior_sales, 500000, 'and the prior week for the comparison');

    const trap = mk({ managerNotesTable: false,
      sb: { from() { throw new Error('touched the database without the table'); } } });
    eq(await trap(review, weekData), null,
      'without the table the save declines quietly — the probe guards it, the screen already explains');

    inserted.length = 0;
    const refused = mk({ sb: { from: () => ({ insert: () => Promise.resolve({
      error: { message: 'new row for relation "manager_notes" violates check constraint "manager_notes_kind_check"' } }) }) } });
    eq(await refused(review, weekData), null, 'a refused insert returns null');
    t.check(toasts.some((m) => /0082_manager_reviews\.sql/.test(m)),
      'and a check-constraint refusal names 0082 — the one paste that fixes it, not a raw error');
  }
})().then(() => {
  process.exit(t.done() ? 1 : 0);
}).catch((e) => {
  console.error(e);
  process.exit(1);
});
