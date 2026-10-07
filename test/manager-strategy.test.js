#!/usr/bin/env node
'use strict';
/*
 * The Manager manages: an objective, honest arithmetic, more than one
 * lever, the whole shop in view, and a way to ask for what the books
 * cannot hold.
 *
 * The owner put a real meeting under scrutiny. It was honest and
 * competent and could not have been strategic, for reasons that were in
 * the mechanism, not the model:
 *
 *   ONE METRIC, TWO QUANTITIES  moves were "ranked by shillings at
 *       stake", so a 3,330,000 debt BALANCE outranked a 340,000 month of
 *       PROFIT. The biggest numbers in a shop are always debts, so three
 *       of five moves were the same move.
 *   THE SAME MONEY TWICE  a buy and a standing rule on the SAME line both
 *       showed 340,000 — one line's earnings counted twice in a plan that
 *       claimed to be ranked by money.
 *   BLIND TO MARGIN  dashboardContext already derives per-item and
 *       per-customer profit, who is going quiet, whose prices are rising,
 *       what runs out next — and shop_pulse threw all of it away. A mind
 *       cannot argue margin it has never seen.
 *   NO WAY TO ASK  what a supplier charges at forty units is not in any
 *       table, and there was no way to say so.
 *
 * So: every worth carries its basis, every move names its lever, the
 * plan names the week's objective, the pulse carries the profit side,
 * and asks become questions the shop answers.
 *
 * Run: node test/manager-strategy.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('the manager’s strategy');
const src = read('index.html');
const api = read('api/assistant.js');
const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);

/* ---------- 1. the mind is taught to manage, not to list ------------- */
{
  const ext = api.slice(api.indexOf('const MANAGER_COMMON'), api.indexOf('function managerExtension'));
  t.check(/NAME THE WEEK\\u2019S OBJECTIVE FIRST/.test(ext) || /NAME THE WEEK’S OBJECTIVE FIRST/.test(ext),
    'the meeting opens by naming the week’s objective');
  t.check(/EVERY MOVE MUST SERVE THAT OBJECTIVE OR BE DROPPED/.test(ext),
    'and every move must serve it — an objective nothing is measured against is a slogan');
  t.check(/The owner can overrule it/.test(ext), 'the owner can overrule the objective');
  t.check(/Rank them by WHAT THE ACTION CHANGES THIS WEEK, never by the biggest number standing near it/.test(ext),
    'ranking is by what the action CHANGES, not by the biggest nearby number — the defect that made every plan a debt list');
  t.check(/TWO MOVES MAY NEVER CLAIM THE SAME SHILLINGS/.test(ext),
    'and the same shillings can never be claimed twice');
  t.check(/AT MOST TWO MOVES MAY SHARE ONE LEVER/.test(ext),
    'at most two moves from one lever — five collections is one move written five times');
  t.check(/If the figures truly support only one lever, say so plainly/.test(ext),
    'and a genuinely one-lever week is said, never padded');
  t.check(/ASK FOR WHAT THE BOOKS CANNOT HOLD/.test(ext), 'the mind may ask the shop for what it cannot see');
  t.check(/AT MOST THREE such questions/.test(ext) && /never a question the tools could have answered/.test(ext),
    'bounded, and never a question it could have looked up itself');
  t.check(/open_questions, which you must not ask again/.test(ext),
    'and it does not ask the same thing twice');
  ['cash_freed', 'profit_30d', 'loss_avoided', 'cost_saved'].forEach((b) =>
    t.check(ext.includes(b), `the ${b} basis is taught`));
  ['collect', 'sell', 'buy', 'price', 'cost', 'system'].forEach((l) =>
    t.check(new RegExp(`\\b${l}\\b`).test(ext), `the ${l} lever is taught`));
  t.check(/"objective":\{"name":"cash","why":/.test(ext) && /"worth_basis":"cash_freed"/.test(ext)
    && /"lever":"collect"/.test(ext) && /"asks":\[/.test(ext),
    'and the plan block carries objective, worth_basis, lever and asks in its stated shape');
}

/* ---------- 2. the pulse sees the whole shop ------------------------- */
{
  const many = (n, f) => Array.from({ length: n }, (_, i) => f(i));
  const data = { presetOrderStageLimits: {}, customers: [] };
  const dctx = {
    inv: { deadValue: 123456.7, deadQty: 40.2 },
    grossProfit: 2400000.4, netProfit: 900000, opex: 1500000, burn: 800000, runwayMonths: 3.44,
    totals: { sales: 8000000, estimatedQty: 2 },
    invoices: [{ id: 1 }],
    itemRows: [
      { name: 'Runners Masasi', variant: '12 inch', qty: 63, sales: 1200000, cost: 860000 },
      { name: 'Gold Screws', variant: '', qty: 400, sales: 900000, cost: 855000 },
      { name: 'Soft Close', variant: '14 inch', qty: 20, sales: 700000, cost: 300000 },
    ],
    goingQuiet: many(9, (i) => ({ name: 'Quiet' + i, avgGapDays: 12.4, sinceLastDays: 31.6, orderCount: 5 })),
    concentration: [{ name: 'Hinges', qty: 90, buyers: 2, topBuyerName: 'Mulongo', concentration: 78.4 }],
    inflation: [{ name: 'Cement', supplierName: 'Roto', first: 38000, last: 41500, growth: 9.21, since: '2026-06-01' }],
    stockOut: [{ key: 'P1', name: 'Runners Masasi 12 inch', qty: 1, daysLeft: 0.5, dailyRate: 2.13 }],
  };
  const env = {
    /* The shelf the clearance reading walks. Empty here: these files are
       about the meeting, and a dead line of their own would only make
       these fixtures argue with the ones in dead-stock.test.js. */
    waSalesByKey: () => new Map(),
    buyKeyParts: (k) => ({ productId: String(k).split('::')[0],
      variantIdx: String(k).indexOf('::') < 0 ? null : Number(String(k).split('::')[1]) }),
    ourCostFor: () => null,
    ourPriceFor: () => null,
    effectiveStockMarkupRule: () => null,
    allProductVariantEntries: () => [],
    getStockQty: () => 0,
    getFIFOUnitCost: () => null,
    rankedPriceRows: () => [],
    purchasePriceAtQty: () => null,
    productDisplayLabel: (p) => (p && p.name) || '',
    stockKey: (pid, vi) => (vi == null || vi === '') ? pid : `${pid}::${vi}`,
    contactPhones: (c) => [c && c.phone].filter(Boolean),
    daysSinceDate: () => 0,
    data,
    todayISO: () => '2026-08-29', anShiftDate: () => '2026-07-31',
    apRound: (n) => Math.round(Number(n) || 0),
    dashboardContext: () => dctx,
    dashAlerts: () => [],
    debtChaseRows: () => ({ due: [], resting: [], blocked: [], promised: [], graceDays: 7, restDays: 3 }),
    purchasePlan: () => ({ lines: [], didNotFit: [], sourceFirst: [], coming: [], onOrder: 0, budgetBefore: 500000, budget: 500000 }),
    buyOrdersOpenRows: () => [],
    collectToBuy: () => null,
    cashOnHandByAccount: () => ({ total: 500000, byAccount: [] }),
    CASH_AHEAD_DAYS: 30,
      cashAhead: () => ({ days: 30, commitments: [], committed: 0, unknown: 0, promised: [], promisedTotal: 0, safeToSpend: 500000, tightest: { date: '2026-08-29', balance: 500000 } }),
    /* The supplier side the pulse now reads. Stubbed empty here:
       these files are about the meeting's shape and its caps, and
       whether an emitted supplierId actually resolves is the one
       claim manager-subjects.test.js exists to make. */
    credDueRows: () => ({ undated: [], ahead: [], missed: [], total: 0, count: 0 }),
    supplierName: (id) => 'Supplier ' + id,
    consignmentRows: () => [],
    morningBriefData: () => ({ sales: { total: 0, count: 0, profit: 0, estimated: false },
      cash: { counted: true }, paid: { total: 0, count: 0 }, stuck: [], ranOutCount: 0 }),
    priceReviewCandidates: () => [],
    followUpClientsToContact: () => [],
    uncostedStockRows: () => [{ key: 'a' }, { key: 'b' }],
    anRowsByCustomer: () => many(8, (i) => ({ name: 'C' + i, count: 3, sales: 100000 * (i + 1),
      cost: 60000 * (i + 1), profit: 40000 * (i + 1), margin: 40 })),
    SQ_STATUS_ORDER: ['draft'],
    Date, JSON, Math, Number, String, Array, Object,
  };
  const scope = compileScope([
    extractDeclaration(src, 'ASSISTANT_TOOLS', 'index.html'),
    extractFunction(src, 'managerAdviceTally', 'index.html'), extractFunction(src, 'mgrLiveMoveRows', 'index.html'), extractFunction(src, 'mgrJrWords', 'index.html'), extractDeclaration(src, 'MGR_JR_STOP', 'index.html'),
      extractFunction(src, 'managerTrackRecord', 'index.html'),
      extractFunction(src, 'mgrLiveMoveRows', 'index.html'),
      extractFunction(src, 'managerChaseEvidence', 'index.html'),
      /* The unusual-days reading has its own test; here it is quiet. */
      "function unusualDays(){ return { today: '', judged: 0, thin: 0, floor: 0, items: [] }; } function unusualLine(){ return ''; } var mgrUnusualMemo = null;",
      extractFunction(src, 'chaseResponse', 'index.html'),
      extractFunction(src, 'chaseDayAdd', 'index.html'),
      extractFunction(src, 'chaseRate', 'index.html'),
      extractFunction(src, 'chaseResponseLine', 'index.html'),
      extractFunction(src, 'customerCollectionDays', 'index.html'),
      extractFunction(src, 'collectionInvoiceTxn', 'index.html'),
      extractFunction(src, 'collectionLedgerRow', 'index.html'),
      extractFunction(src, 'debtLogIsInvoiceOwned', 'index.html'),
      extractFunction(src, 'cashIsMoneyIn', 'index.html'),
      extractDeclaration(src, 'CHASE_WINDOW', 'index.html'),
      extractDeclaration(src, 'CHASE_LOOKBACK', 'index.html'),
      extractDeclaration(src, 'CHASE_QUIET', 'index.html'),
      extractDeclaration(src, 'CHASE_MIN_CHASED', 'index.html'),
      extractDeclaration(src, 'CHASE_MIN_QUIET', 'index.html'),
      extractDeclaration(src, 'CHASE_MERGE', 'index.html'),
      extractDeclaration(src, 'CHASE_VERDICT_WORDS', 'index.html'),
      extractDeclaration(src, 'mgrChaseMemo', 'index.html'),
      extractDeclaration(src, 'mgrChaseExtras', 'index.html'),
      extractFunction(src, 'trackRecordName', 'index.html'),
      extractFunction(src, 'trackRecordLine', 'index.html'),
      extractFunction(src, 'trackRecordDeadLevers', 'index.html'),
      extractDeclaration(src, 'TRACK_MOVES_READ', 'index.html'),
      extractDeclaration(src, 'TRACK_MIN_TIMES', 'index.html'),
      extractDeclaration(src, 'TRACK_WINDOWED', 'index.html'),
    extractFunction(src, 'buyHoldsStanding', 'index.html'),
    extractFunction(src, 'buyHoldFor', 'index.html'),
    extractFunction(src, 'buyKeyLabel', 'index.html'),
    extractFunction(src, 'managerPlaybook', 'index.html'),
      extractFunction(src, 'managerPlayClock', 'index.html'),
      extractFunction(src, 'managerPlaysPastSpan', 'index.html'),
    extractDeclaration(src, 'MANAGER_PROBLEMS', 'index.html'),
    /* The clearance reading the meeting now argues from. Whole, not
       stubbed: the Manager and the screen must not disagree about what
       is dead or what the owner has already marked. */
    /* The margin reading the meeting now argues from. Whole, not
       stubbed: the mind and the screen must not disagree about which
       lines are thin or what lifting them is worth. */
    extractFunction(src, 'marginRows', 'index.html'),
    extractFunction(src, 'marginRuleFor', 'index.html'),
    extractFunction(src, 'ruleYieldPct', 'index.html'),
    extractFunction(src, 'marginTargetPrice', 'index.html'),
    extractFunction(src, 'targetMarginPct', 'index.html'),
    extractDeclaration(src, 'THIN_MARGIN_PCT', 'index.html'),
    extractFunction(src, 'stockAgeRows', 'index.html'),
    extractFunction(src, 'deadStockRows', 'index.html'),
    extractFunction(src, 'deadStockBuyers', 'index.html'),
    extractFunction(src, 'deadStockQuietDays', 'index.html'),
    'function names(){ return { ASSISTANT_TOOLS }; }',
  ], env, ['names']);
  const pulse = scope.names().ASSISTANT_TOOLS.shop_pulse.run();

  eq(pulse.profit.gross_profit_30d, 2400000, 'the profit for the period travels');
  eq(pulse.profit.net_profit_30d, 900000, 'and what is left after running costs');
  eq(pulse.profit.opex_30d, 1500000, 'the running costs themselves');
  eq(pulse.profit.runway_months, 3.4, 'months of cover at the present burn — arithmetic on the past, rounded once');
  eq(pulse.profit.margin_pct, 30, 'and the margin as a percentage, so a trend can be argued at all');
  t.check(pulse.profit.profit_partly_estimated === true,
    'an estimated profit is flagged here too — the manager cannot state it as certain');

  eq(pulse.best_lines[0].item, 'Soft Close — 14 inch', 'the best line is the one earning most PROFIT, not selling most');
  eq(pulse.best_lines[0].profit, 400000, 'with its profit');
  eq(pulse.best_lines[0].margin_pct, 57.1, 'and its margin');
  eq(pulse.worst_margin_lines[0].item, 'Gold Screws',
    'the worst-margin line is named — 400 sold at 5% is the margin lever every plan was missing');
  eq(pulse.worst_margin_lines[0].margin_pct, 5, 'with the margin that makes the case');

  eq(pulse.best_customers.length, 5, 'the best customers are capped');
  eq(pulse.best_customers[0].name, 'C7', 'and ranked by profit, not by sales');
  eq(pulse.going_quiet.length, 5, 'customers going quiet are capped');
  eq(pulse.going_quiet[0].silent_days, 32, 'each with how long they have been silent');
  eq(pulse.dependency[0].share_pct, 78, 'a line depending on one buyer is named with the share');
  eq(pulse.cost_rises[0].up_pct, 9.2, 'a supplier raising prices is named with the rise');
  eq(pulse.running_out_soon[0].days_left, 1, 'what runs out next, in days');
  eq(pulse.uncosted_lines, 2, 'and stock the balance sheet cannot value');

  /* Parity, not a second copy: every figure above came from the one
     dashboardContext reading the dashboard itself draws. */
  const pulseAt = src.indexOf('shop_pulse: { confirm: false');
  const body = src.slice(pulseAt, src.indexOf('\n  }},', pulseAt));
  t.check(/dctx\.itemRows/.test(body) && /dctx\.goingQuiet/.test(body) && /dctx\.inflation/.test(body)
    && /dctx\.stockOut/.test(body) && /dctx\.concentration/.test(body),
    'all of it read from dashboardContext — a second hand-built copy is how a tool and a screen start disagreeing');
}

/* ---------- 3. a figure now says what it means ----------------------- */
{
  const bases = extractDeclaration(src, 'MANAGER_WORTH_BASES', 'index.html');
  ['cash_freed', 'profit_30d', 'loss_avoided', 'cost_saved'].forEach((b) =>
    t.check(bases.includes(b), `${b} has words for the screen`));
  t.check(/cash tied up/.test(bases) && /profit in 30 days/.test(bases),
    'in the owner’s language, so two unlike figures can never be read as the same money');
  const view = extractFunction(src, 'mgrMoveView', 'index.html');
  t.check(/MANAGER_WORTH_BASES\[b\.worthBasis\]/.test(view),
    'and the card prints the basis beside the figure');
  t.check(/b\.unlocks \?/.test(view), 'a move that makes another possible says so on its card');

  const save = extractFunction(src, 'managerSaveMeeting', 'index.html');
  t.check(/MANAGER_WORTH_BASES\[String\(m\.worth_basis\|\|''\)\] \? String\(m\.worth_basis\) : null/.test(save),
    'an unknown basis is stored as nothing — model output is data, never a label the screen prints unchallenged');
  t.check(/MANAGER_LEVERS\.includes\(String\(m\.lever\|\|''\)\) \? String\(m\.lever\) : null/.test(save),
    'and so is an unknown lever');
  t.check(/MANAGER_OBJECTIVES\[String\(obj\.name\|\|''\)\] \? String\(obj\.name\) : null/.test(save),
    'and an unknown objective');
  const render = extractFunction(src, 'renderManager', 'index.html');
  /* The objective moved from the plan's header into the band above it,
     which the render paints first -- still above the moves. */
  t.check(/MANAGER_OBJECTIVES\[plan\.objective\]/.test(extractFunction(src, 'mgrHeroHTML', 'index.html'))
    && /heroWrap\.innerHTML = mgrHeroHTML\(/.test(render),
    'the screen leads with the week’s objective, above the moves');
}

/* ---------- 4. the shop answers its manager -------------------------- */
(async () => {
  {
    const updates = [];
    const toasts = [];
    const mk = (extra) => compileScope([extractFunction(src, 'managerAnswerQuestion', 'index.html')], {
      managerNotesTable: true, currentShopId: 'shop-1', todayISO: () => '2026-08-29',
      toast: (m) => toasts.push(m), renderManager: () => {},
      sb: { from: () => ({
        select: () => ({ eq: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { body: { question: 'What does Roto charge for 40?' } } }) }) }) }),
        update: (patch) => { updates.push(patch); return { eq: () => ({ eq: () => Promise.resolve({ error: null }) }) }; },
      }) },
      String, Number, Math, Promise, JSON, Object,
      ...extra,
    }, ['managerAnswerQuestion']).managerAnswerQuestion;

    await mk({})(7, '  180,000 a carton at 40 units  ');
    eq(updates.length, 1, 'answering writes once');
    eq(updates[0].status, 'answered', 'and marks the question answered');
    eq(updates[0].body.answer, '180,000 a carton at 40 units', 'keeping the answer, trimmed');
    eq(updates[0].body.question, 'What does Roto charge for 40?',
      'and the question it answers — an answer with no question is not evidence');
    eq(updates[0].body.answeredOn, '2026-08-29', 'dated, so the next meeting knows how fresh it is');

    updates.length = 0;
    await mk({})(7, '   ');
    eq(updates.length, 0, 'an empty answer writes nothing');
    await mk({ managerNotesTable: false,
      sb: { from() { throw new Error('touched the database without the table'); } } })(7, 'x');
    t.check(true, 'and without the memory table it declines quietly, as every other write does');

    toasts.length = 0;
    const refused = mk({ sb: { from: () => ({
      select: () => ({ eq: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { body: {} } }) }) }) }),
      update: () => ({ eq: () => ({ eq: () => Promise.resolve({
        error: { message: 'violates check constraint "manager_notes_kind_check"' } }) }) }),
    }) } });
    await refused(7, 'an answer');
    t.check(toasts.some((m) => /0084_manager_questions\.sql/.test(m)),
      'a refusal from the old constraint names 0084 — the one paste that fixes it');
  }

  /* The asks themselves: stored as questions, capped, and read back. */
  {
    const inserted = [];
    const saveMeeting = compileScope([
      extractFunction(src, 'managerSaveMeeting', 'index.html'),
      /* the optional fields of the meeting contract, through their whitelists */
      ...['managerPips', 'managerPlanText', 'managerMeetingFields', 'managerMoveFields', 'managerPlanRefs', 'managerAskFields', 'managerPlayFields']
        .map((n) => extractFunction(src, n, 'index.html')),
      extractDeclaration(src, 'MANAGER_DEPTS', 'index.html'), extractDeclaration(src, 'MANAGER_ASK_PLACES', 'index.html'),
      extractDeclaration(src, 'MANAGER_DOORS', 'index.html'),
      extractDeclaration(src, 'MANAGER_MOVE_KINDS', 'index.html'),
      extractFunction(src, 'managerResolvedSubject', 'index.html'),
      extractDeclaration(src, 'MANAGER_WORTH_BASES', 'index.html'),
      extractDeclaration(src, 'MANAGER_LEVERS', 'index.html'),
      extractDeclaration(src, 'MANAGER_OBJECTIVES', 'index.html'),
      extractFunction(src, 'buyKeyParts', 'index.html'),
      extractFunction(src, 'stockKey', 'index.html'),
    ], {
      managerNotesTable: true, currentShopId: 'shop-1', todayISO: () => '2026-08-29',
      data: { products: [] },
      apRound: (n) => Math.round(Number(n) || 0),
      sb: { from: () => ({ insert: (row) => { inserted.push(row); return {
        select: () => ({ single: () => Promise.resolve({ data: { id: 11 }, error: null }) }) }; } }) },
      String, Number, Math, Array, Promise, JSON, Object, console,
    }, ['managerSaveMeeting']).managerSaveMeeting;

    await saveMeeting({
      objective: { name: 'margin', why: 'Sales hold but only 30% sticks' },
      keyline: 'k', rejected: 'r',
      moves: [{ title: 'Chase', why: 'w', worth: 840000, worth_basis: 'cash_freed', lever: 'collect',
        unlocks: 'the cement buy', door: 'chase', kind: 'chase', subject: { customerId: 7 } },
        { title: 'Bad', why: 'w', worth: 1, worth_basis: 'invented', lever: 'vibes', door: 'chase', kind: 'other' }],
      asks: ['What does Roto charge for 40 units?', 'Is Mulongo still trading?', 'x', '', 'What does the rival charge?', 'A fifth'],
    });
    const meeting = inserted[0];
    eq(meeting.body.objective, 'margin', 'the meeting keeps the objective it argued');
    eq(meeting.body.objectiveWhy, 'Sales hold but only 30% sticks', 'and why it chose it');
    const moves = inserted[1];
    eq(moves[0].body.worthBasis, 'cash_freed', 'a known basis is kept');
    eq(moves[0].body.lever, 'collect', 'a known lever is kept');
    eq(moves[0].body.unlocks, 'the cement buy', 'and what the move unlocks');
    eq(moves[1].body.worthBasis, null, 'an invented basis becomes nothing');
    eq(moves[1].body.lever, null, 'and so does an invented lever');
    const questions = inserted[2];
    eq(questions.length, 3, 'at most three questions are kept, blanks and stubs dropped');
    eq(questions[0].kind, 'question', 'each of its own kind');
    eq(questions[0].status, 'open', 'open until the shop answers');
    eq(questions[0].body.question, 'What does Roto charge for 40 units?', 'in the manager’s own words');
    eq(questions[0].meeting_id, 11, 'tied to the meeting that asked it');
  }

  /* ---------- 5. answers come back at the top of the next meeting ---- */
  {
    const rows = {
      meeting: [{ id: 1, date: '2026-08-28', body: { keyline: 'k' } }],
      move: [],
      question: [
        { id: 5, date: '2026-08-28', status: 'answered', body: { question: 'Roto at 40?', answer: '180,000 a carton', answeredOn: '2026-08-29' } },
        { id: 6, date: '2026-08-20', status: 'open', body: { question: 'Is Mulongo trading?' } },
      ],
    };
    const q = () => {
      const o = { _kind: null };
      o.select = () => o; o.order = () => o; o.limit = () => o; o.in = () => o;
      /* The date window managerAdviceTally reads over. */
      o.gte = () => o; o.lte = () => o;
      o.eq = (c, v) => { if (c === 'kind') o._kind = v; return o; };
      o.then = (res) => res({ data: rows[o._kind] || [], error: null });
      return o;
    };
    const tools = compileScope([
      extractDeclaration(src, 'ASSISTANT_TOOLS', 'index.html'),
      extractFunction(src, 'managerAdviceTally', 'index.html'), extractFunction(src, 'mgrLiveMoveRows', 'index.html'), extractFunction(src, 'mgrJrWords', 'index.html'), extractDeclaration(src, 'MGR_JR_STOP', 'index.html'),
      extractFunction(src, 'managerTrackRecord', 'index.html'),
      extractFunction(src, 'mgrLiveMoveRows', 'index.html'),
      extractFunction(src, 'managerChaseEvidence', 'index.html'),
      /* The unusual-days reading has its own test; here it is quiet. */
      "function unusualDays(){ return { today: '', judged: 0, thin: 0, floor: 0, items: [] }; } function unusualLine(){ return ''; } var mgrUnusualMemo = null;",
      extractFunction(src, 'chaseResponse', 'index.html'),
      extractFunction(src, 'chaseDayAdd', 'index.html'),
      extractFunction(src, 'chaseRate', 'index.html'),
      extractFunction(src, 'chaseResponseLine', 'index.html'),
      extractFunction(src, 'customerCollectionDays', 'index.html'),
      extractFunction(src, 'collectionInvoiceTxn', 'index.html'),
      extractFunction(src, 'collectionLedgerRow', 'index.html'),
      extractFunction(src, 'debtLogIsInvoiceOwned', 'index.html'),
      extractFunction(src, 'cashIsMoneyIn', 'index.html'),
      extractDeclaration(src, 'CHASE_WINDOW', 'index.html'),
      extractDeclaration(src, 'CHASE_LOOKBACK', 'index.html'),
      extractDeclaration(src, 'CHASE_QUIET', 'index.html'),
      extractDeclaration(src, 'CHASE_MIN_CHASED', 'index.html'),
      extractDeclaration(src, 'CHASE_MIN_QUIET', 'index.html'),
      extractDeclaration(src, 'CHASE_MERGE', 'index.html'),
      extractDeclaration(src, 'CHASE_VERDICT_WORDS', 'index.html'),
      extractDeclaration(src, 'mgrChaseMemo', 'index.html'),
      extractDeclaration(src, 'mgrChaseExtras', 'index.html'),
      extractFunction(src, 'trackRecordName', 'index.html'),
      extractFunction(src, 'trackRecordLine', 'index.html'),
      extractFunction(src, 'trackRecordDeadLevers', 'index.html'),
      extractDeclaration(src, 'TRACK_MOVES_READ', 'index.html'),
      extractDeclaration(src, 'TRACK_MIN_TIMES', 'index.html'),
      extractDeclaration(src, 'TRACK_WINDOWED', 'index.html'),
      extractFunction(src, 'buyHoldsStanding', 'index.html'),
      extractFunction(src, 'buyHoldFor', 'index.html'),
      extractFunction(src, 'buyKeyLabel', 'index.html'),
      extractFunction(src, 'managerPlaybook', 'index.html'),
      extractFunction(src, 'managerPlayClock', 'index.html'),
      extractFunction(src, 'managerPlaysPastSpan', 'index.html'),
      extractDeclaration(src, 'MANAGER_PROBLEMS', 'index.html'),
      extractFunction(src, 'deriveMoveOutcome', 'index.html'),
      extractFunction(src, 'managerScoreboard', 'index.html'),
      extractFunction(src, 'managerRecentReviews', 'index.html'),
      extractFunction(src, 'managerReviewBrief', 'index.html'),
      extractFunction(src, 'managerScoreProgress', 'index.html'),
      extractDeclaration(src, 'MANAGER_METRICS', 'index.html'),
      'function names(){ return { ASSISTANT_TOOLS }; }',
    ], {
      data: { customers: [], stockLog: [], savedQuotes: [], purchaseInvoices: [] },
      managerNotesTable: true, rivalPricesTable: false, currentShopId: 'shop-1', todayISO: () => '2026-08-29',
      anShiftDate: (iso, n) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); },
      daysSinceDate: () => 9, apRound: (n) => Math.round(Number(n) || 0),
      fmtUGX: (n) => String(n), sb: { from: q },
      Date, JSON, Math, Number, String, Array, Object, Promise,
    }, ['names']).names().ASSISTANT_TOOLS;

    const hist = await tools.manager_history.run({ limit: 3 });
    eq((hist.answered_questions || []).length, 1, 'what the shop found out reaches the next meeting');
    eq(hist.answered_questions[0].answer, '180,000 a carton', 'as evidence, in the owner’s words');
    eq(hist.answered_questions[0].asked, 'Roto at 40?', 'beside the question it answers');
    eq((hist.open_questions || []).length, 1, 'and what is still unanswered is named');
    eq(hist.open_questions[0].days_open, 9, 'with how long it has waited, so it is not asked again');
  }

  /* ---------- 6. the migration admits the new kind ------------------- */
  {
    const mig = read('supabase/migrations/0084_manager_questions.sql');
    t.check(/drop constraint if exists manager_notes_kind_check/.test(mig),
      '0084 drops the old kind check by name');
    t.check(/check \(kind in \('meeting', 'move', 'review', 'question'\)\)/.test(mig),
      'and re-adds it with question — without this every ask is refused');
  }
})().then(() => {
  process.exit(t.done() ? 1 : 0);
}).catch((e) => { console.error(e); process.exit(1); });
