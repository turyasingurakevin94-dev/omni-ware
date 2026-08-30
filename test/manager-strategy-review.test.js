#!/usr/bin/env node
'use strict';
/*
 * The review judges its own strategies — and never takes credit.
 *
 * Six builds went into teaching the Manager to advise: an objective, a
 * scoreboard, questions, lessons, a longer arc, a playbook of
 * strategies, holds on the buying screen. And the weekly review — the
 * one occasion whose whole job is judging whether the advice worked —
 * could not see a single play. The Manager could propose a strategy on
 * Monday, the owner switch it on, and Saturday would never hear of it.
 * Nothing anywhere asked whether a play did anything; "It worked" was a
 * button.
 *
 * So the books now answer, where they honestly can. Three laws, and the
 * third is the one that matters most:
 *
 *   WHAT THE BOOKS CAN WEIGH, THEY WEIGH  five of the eight problems
 *       have a real measure. Margin needs no baseline at all: gross
 *       profit and sales are both flows, so the share kept before a
 *       play started is derivable today, retroactively. The three level
 *       problems stamp where the shop stood when the play was switched
 *       on — an adopted target's own trick, for the same reason.
 *   WHAT THEY CANNOT, THEY SAY  depending on one buyer, supplier cost
 *       and "other" have no honest measure here. They are reported as
 *       having none, and the manager is told to ASK, never to reach for
 *       the nearest number that does not answer the question.
 *   NEVER TAKE CREDIT  margin going 4% to 11% across the weeks a shop
 *       charged for cutting does NOT mean the cutting charge did it.
 *       The tool reports what MOVED and names the other plays running
 *       in the same weeks; the causal claim is forbidden in words. A
 *       false lesson is worse than a wrong figure — the owner catches a
 *       wrong figure, and builds a year of strategy on a false lesson.
 *
 * RUN IT, DON'T READ IT: these checks call the functions and the tool.
 *
 * Run: node test/manager-strategy-review.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('the strategy review');
const src = read('index.html');
const api = read('api/assistant.js');
const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);

const TODAY = '2026-08-29';
const shift = (iso, n) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const days = (a, b) => Math.round((new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z')) / 86400000);

/* The shop's margin doubled across the weeks the cutting charge ran.
   Sales are flat. Both halves are computable from the same invoices. */
const totalsFor = (from, to) => {
  const start = '2026-06-01';
  if (to < start) return { sales: 0, profit: 0, count: 0 };
  /* Before 8 Aug the shop kept 4%; after it, 11%. */
  let sales = 0, profit = 0;
  for (let d = from < start ? start : from; d <= to; d = shift(d, 1)) {
    sales += 100000;
    profit += d >= '2026-08-08' ? 11000 : 4000;
  }
  return { sales, profit, count: 1 };
};

const baseEnv = (data) => ({
  data,
  todayISO: () => TODAY,
  anShiftDate: shift,
  daysSinceDate: (d) => days(d, TODAY),
  apRound: (n) => Math.round(Number(n) || 0),
  fmtUGX: (n) => Number(n || 0).toLocaleString('en-US'),
  anInvoicesInRange: (f, to) => [{ f, to }],
  anOverallTotals: (inv) => (inv[0] ? totalsFor(inv[0].f, inv[0].to) : { sales: 0, profit: 0, count: 0 }),
  debtCollectionsOn: () => ({ total: 0 }),
  dashInventoryHealth: () => ({ deadValue: data._dead == null ? 900000 : data._dead }),
  cashOnHandByAccount: () => ({ total: data._cash == null ? 2500000 : data._cash, byAccount: [] }),
  console, Date, JSON, Math, Number, String, Array, Object, Promise,
});

const PROG = [
  extractDeclaration(src, 'MANAGER_METRICS', 'index.html'),
  extractDeclaration(src, 'MANAGER_PROBLEMS', 'index.html'),
  extractDeclaration(src, 'MANAGER_PROBLEM_METRICS', 'index.html'),
  extractFunction(src, 'booksStartDate', 'index.html'),
  extractFunction(src, 'managerPlayProgress', 'index.html'),
];

/* Books that begin 1 June, so a July-back window is out of reach. */
const invoiced = { savedQuotes: [{ voided: false, invoiced: true, date: '2026-06-01' }], customers: [] };

/* ---------- 1. only what can honestly be weighed ---------------------- */
{
  const M = compileScope(PROG.concat(['function names(){ return { MANAGER_PROBLEM_METRICS, MANAGER_PROBLEMS }; }']),
    baseEnv({ ...invoiced }), ['names']).names();
  const P = M.MANAGER_PROBLEM_METRICS;

  ['margin', 'growth', 'cash', 'debt', 'dead_stock'].forEach((k) =>
    t.check(!!P[k], `${k} has a measure the books can answer`));
  ['concentration', 'supplier_cost', 'other'].forEach((k) => {
    t.check(!P[k], `${k} has NONE — it is a real problem this app cannot weigh, and is said to have no measure rather than fitted to the nearest number`);
    t.check(!!M.MANAGER_PROBLEMS[k], `though ${k} is still a problem a play may treat`);
  });
  eq(P.margin.kind, 'flow',
    'margin is a FLOW — which is why the share kept before a play started is derivable today, for a play nobody thought to stamp');
  eq(P.debt.kind, 'level', 'where the shop stands is a level');
  eq(P.debt.direction, 'down', 'and debt coming down is the good direction');
  eq(P.margin.unit, 'pct', 'margin is a share, not shillings');
}

/* ---------- 2. what moved, over like-for-like spans ------------------- */
{
  const s = compileScope(PROG.concat(['function names(){ return { managerPlayProgress }; }']),
    baseEnv({ ...invoiced }), ['names']).names();

  /* Started 8 Aug: 21 days run, against the 21 days before it. */
  const started = shift(TODAY, -21);
  const g = s.managerPlayProgress({ id: 1, treats: 'margin', started_on: started }, TODAY, []);
  eq(g.measures, 'the share kept', 'named in the owner’s words');
  eq(g.days_running, 21, 'the span it has run');
  eq(g.before, 4, 'what the share was over the SAME number of days before it started');
  eq(g.since, 11, 'and what it has been since');
  eq(g.moved, 7, 'the movement, and nothing about who caused it');
  t.check(/^2026-07-\d\d to 2026-08-0[67]$/.test(g.before_span),
    'with the earlier span named, so the owner can check the comparison is fair');

  /* Under a week is noise wearing a verdict. */
  const young = s.managerPlayProgress({ id: 1, treats: 'margin', started_on: shift(TODAY, -6) }, TODAY, []);
  eq(young.too_early, true, 'six days in, it is too new to judge');
  eq(young.before, undefined, 'and no comparison is offered at all');
  eq(s.managerPlayProgress({ id: 1, treats: 'margin', started_on: shift(TODAY, -7) }, TODAY, []).too_early, undefined,
    'a week is the least that says anything');

  /* The books do not reach back far enough for a fair 'before'. */
  const old = s.managerPlayProgress({ id: 1, treats: 'margin', started_on: shift(TODAY, -70) }, TODAY, []);
  t.check(!!old.no_before,
    'a before-window that runs off the start of the books is REFUSED — a short span against a shorter one is not a comparison');
  eq(old.moved, undefined, 'so no movement is claimed');
  t.check(old.since != null, 'though what has happened since is still said');

  /* Nothing measures it: the honest empty answer. */
  eq(s.managerPlayProgress({ id: 1, treats: 'concentration', started_on: started }, TODAY, []), null,
    'a problem the books cannot weigh returns nothing rather than a number that does not answer it');
  eq(s.managerPlayProgress({ id: 1, treats: 'other', started_on: started }, TODAY, []), null,
    'and so does the owner’s own catch-all');
  eq(s.managerPlayProgress({ id: 1, treats: 'margin', started_on: null }, TODAY, []), null,
    'a play that never started has nothing to measure');
}

/* ---------- 3. a level needs the stamp, and says so without it -------- */
{
  const data = { ...invoiced, _dead: 600000 };
  const s = compileScope(PROG.concat(['function names(){ return { managerPlayProgress }; }']),
    baseEnv(data), ['names']).names();
  const started = shift(TODAY, -14);

  const stamped = s.managerPlayProgress({ id: 1, treats: 'dead_stock', started_on: started, baseline: 900000 }, TODAY, []);
  eq(stamped.before, 900000, 'where the shop stood when the play was switched on');
  eq(stamped.now, 600000, 'where it stands today');
  eq(stamped.moved, -300000, 'and the movement — down, which for dead stock is the good way');

  const unstamped = s.managerPlayProgress({ id: 1, treats: 'dead_stock', started_on: started, baseline: null }, TODAY, []);
  t.check(/nothing to compare with/.test(unstamped.no_before || ''),
    'a play switched on before the shop began stamping says so plainly — a level cannot be worked out backwards once the day has passed');
  eq(unstamped.moved, undefined, 'and claims no movement');
  eq(unstamped.now, 600000, 'while still saying where things stand');
}

/* ---------- 4. the rival explanations, named ------------------------- */
{
  const s = compileScope(PROG.concat(['function names(){ return { managerPlayProgress }; }']),
    baseEnv({ ...invoiced }), ['names']).names();
  const started = shift(TODAY, -21);
  const others = [
    { id: 1, name: 'Charge for cutting', treats: 'margin', started_on: started },
    { id: 2, name: 'Reprice the compared lines', treats: 'margin', started_on: shift(TODAY, -10) },
    { id: 3, name: 'Bulk-lot the dead stock', treats: 'dead_stock', started_on: shift(TODAY, -60) },
  ];
  const g = s.managerPlayProgress(others[0], TODAY, others);
  t.check(Array.isArray(g.also_running) && g.also_running.includes('Reprice the compared lines'),
    'a play running in the same weeks is NAMED — it is a real, derivable rival explanation for the same movement');
  t.check(!g.also_running.includes('Charge for cutting'), 'a play is not its own rival');
  t.check(!g.also_running.includes('Bulk-lot the dead stock'),
    'and one that started long before the window is not in it');
  eq(s.managerPlayProgress(others[0], TODAY, [others[0]]).also_running, undefined,
    'with nothing else running, nothing is named');
}

/* ---------- 5. the review is handed all of it ------------------------ */
(async () => {
  {
    const data = { ...invoiced, presetBuyHolds: {},
      products: [{ id: 'P1', name: 'Runners Masasi', variants: [{ combo: { Size: '12' } }] }],
      stockLog: [], purchaseInvoices: [], cashTxns: [] };
    const started = shift(TODAY, -21);
    const journal = {
      meeting: [{ id: 1, date: shift(TODAY, -2), body: { keyline: 'k' } }],
      move: [], question: [], target: [], review: [],
      play: [
        { id: 5, date: started, status: 'running', body: { name: 'Charge for cutting', treats: 'margin',
          how: 'Charge 2,000 a cut', source: 'manager', startedOn: started } },
        { id: 6, date: started, status: 'running', body: { name: 'Find the second buyer', treats: 'concentration',
          source: 'owner', startedOn: started } },
        { id: 7, date: started, status: 'dropped', body: { name: 'A dropped one', treats: 'margin', source: 'manager' } },
      ],
    };
    const scope = compileScope([
      extractDeclaration(src, 'ASSISTANT_TOOLS', 'index.html'),
      extractDeclaration(src, 'MANAGER_METRICS', 'index.html'),
      extractDeclaration(src, 'MANAGER_PROBLEMS', 'index.html'),
      extractDeclaration(src, 'MANAGER_PROBLEM_METRICS', 'index.html'),
      extractFunction(src, 'booksStartDate', 'index.html'),
      extractFunction(src, 'managerPlayProgress', 'index.html'),
      extractFunction(src, 'managerPlaybook', 'index.html'),
      extractFunction(src, 'managerPlayClock', 'index.html'),
      extractFunction(src, 'managerPlaysPastSpan', 'index.html'),
      extractFunction(src, 'managerScoreboard', 'index.html'),
      extractFunction(src, 'managerScoreProgress', 'index.html'),
      extractFunction(src, 'managerRecentReviews', 'index.html'),
      extractFunction(src, 'managerReviewBrief', 'index.html'),
      extractFunction(src, 'deriveMoveOutcome', 'index.html'),
      extractFunction(src, 'buyHoldsStanding', 'index.html'),
      extractFunction(src, 'buyHoldFor', 'index.html'),
      extractFunction(src, 'buyKeyParts', 'index.html'),
      extractFunction(src, 'buyKeyLabel', 'index.html'),
      extractFunction(src, 'buyPriceStamp', 'index.html'),
      extractFunction(src, 'buyPriceNow', 'index.html'),
      extractDeclaration(src, 'BUY_HOLD_MAX_DAYS', 'index.html'),
      'function names(){ return { ASSISTANT_TOOLS }; }',
    ], { ...baseEnv(data), managerNotesTable: true, currentShopId: 'shop-1',
      productDisplayLabel: (p, vi) => (vi == null ? p.name : `${p.name} 12"`),
      dashCashTxnsInRange: () => [], cashOpexTotal: () => 0, cashIsMoneyIn: () => true,
      uncostedStockRows: () => [], anRowsByItem: () => [], anRowsByCustomer: () => [],
      effectiveStockMarkupRule: () => null, rankedPurchaseRowsAtQty: () => [],
      suggestedStockSellingPrice: () => null,
      sb: { from: () => { const q = { _kind: null };
        q.select = () => q; q.order = () => q; q.in = () => q; q.gte = () => q; q.lte = () => q;
        q.eq = (c, v) => { if (c === 'kind') q._kind = v; return q; };
        q.limit = () => Promise.resolve({ data: journal[q._kind] || [], error: null });
        q.then = (res) => res({ data: journal[q._kind] || [], error: null });
        return q; } },
    }, ['names']).names();

    const wk = await scope.ASSISTANT_TOOLS.week_review_data.run();
    t.check(Array.isArray(wk.strategies),
      'THE REVIEW IS HANDED THE STRATEGIES — before this it could not see one, and its whole job is judging whether the advice worked');
    eq(wk.strategies.length, 2, 'every play the shop is working, and only those');
    t.check(!wk.strategies.some((x) => x.name === 'A dropped one'), 'a dropped play is not a strategy in flight');

    const cutting = wk.strategies.find((x) => x.name === 'Charge for cutting');
    eq(cutting.since, started, 'with the day it started');
    eq(cutting.whose, 'manager', 'and whose it was');
    t.check(!!cutting.alongside_it, 'and what moved alongside it');
    eq(cutting.alongside_it.before, 4, 'the share kept before');
    eq(cutting.alongside_it.since, 11, 'and since');
    t.check(!!cutting.alongside_it.also_running,
      'with the other play running in the same weeks named beside it');

    const buyer = wk.strategies.find((x) => x.name === 'Find the second buyer');
    eq(buyer.alongside_it, undefined, 'a play nothing measures carries no figures at all');
    t.check(/ask the owner/i.test(buyer.nothing_measures_it || ''),
      'and says so, telling the manager to ASK rather than reach for the nearest number');

    /* The field is named for what it is. */
    t.check(!('effect' in cutting) && !('caused' in cutting) && !('worked' in cutting),
      'nothing in the answer is called an effect, a cause or a result — the name itself refuses the claim');
  }

  /* ---------- 6. and the holds it placed --------------------------- */
  {
    const data = { ...invoiced, products: [{ id: 'P1', name: 'Runners Masasi', variants: [{ combo: { Size: '12' } }] }],
      presetBuyHolds: { 'P1::0': { reason: 'Reprice before you refill', placedOn: shift(TODAY, -19),
        by: 'manager', rule: { wholesale: 'percent:5', retail: 'percent:5' }, price: 105000 } },
      stockLog: [], purchaseInvoices: [], cashTxns: [] };
    const journal = { meeting: [], move: [], question: [], target: [], review: [], play: [] };
    const scope = compileScope([
      extractDeclaration(src, 'ASSISTANT_TOOLS', 'index.html'),
      extractDeclaration(src, 'MANAGER_METRICS', 'index.html'),
      extractDeclaration(src, 'MANAGER_PROBLEMS', 'index.html'),
      extractDeclaration(src, 'MANAGER_PROBLEM_METRICS', 'index.html'),
      extractFunction(src, 'booksStartDate', 'index.html'),
      extractFunction(src, 'managerPlayProgress', 'index.html'),
      extractFunction(src, 'managerPlaybook', 'index.html'),
      extractFunction(src, 'managerPlayClock', 'index.html'),
      extractFunction(src, 'managerPlaysPastSpan', 'index.html'),
      extractFunction(src, 'managerScoreboard', 'index.html'),
      extractFunction(src, 'managerScoreProgress', 'index.html'),
      extractFunction(src, 'managerRecentReviews', 'index.html'),
      extractFunction(src, 'managerReviewBrief', 'index.html'),
      extractFunction(src, 'deriveMoveOutcome', 'index.html'),
      extractFunction(src, 'buyHoldsStanding', 'index.html'),
      extractFunction(src, 'buyHoldFor', 'index.html'),
      extractFunction(src, 'buyKeyParts', 'index.html'),
      extractFunction(src, 'buyKeyLabel', 'index.html'),
      extractFunction(src, 'buyPriceStamp', 'index.html'),
      extractFunction(src, 'buyPriceNow', 'index.html'),
      extractDeclaration(src, 'BUY_HOLD_MAX_DAYS', 'index.html'),
      'function names(){ return { ASSISTANT_TOOLS }; }',
    ], { ...baseEnv(data), managerNotesTable: true, currentShopId: 'shop-1',
      productDisplayLabel: (p, vi) => (vi == null ? p.name : `${p.name} 12"`),
      dashCashTxnsInRange: () => [], cashOpexTotal: () => 0, cashIsMoneyIn: () => true,
      uncostedStockRows: () => [], anRowsByItem: () => [], anRowsByCustomer: () => [],
      effectiveStockMarkupRule: () => ({ type: 'percent', value: 5 }),
      rankedPurchaseRowsAtQty: () => [], suggestedStockSellingPrice: () => null,
      sb: { from: () => { const q = { _kind: null };
        q.select = () => q; q.order = () => q; q.in = () => q; q.gte = () => q; q.lte = () => q;
        q.eq = (c, v) => { if (c === 'kind') q._kind = v; return q; };
        q.limit = () => Promise.resolve({ data: journal[q._kind] || [], error: null });
        q.then = (res) => res({ data: journal[q._kind] || [], error: null });
        return q; } },
    }, ['names']).names();

    const wk = await scope.ASSISTANT_TOOLS.week_review_data.run();
    t.check(Array.isArray(wk.holds) && wk.holds.length === 1,
      'the review is handed the lines it told the shop not to refill');
    eq(wk.holds[0].line, 'Runners Masasi 12"', 'by name');
    eq(wk.holds[0].held_for_days, 19,
      'and how long each has stood — a hold three weeks old with nothing repriced is advice that went nowhere');
    eq(wk.strategies, undefined, 'a shop working no strategies is handed none rather than an empty list');
  }

  /* ---------- 7. one reading, screen and review alike --------------- */
  {
    const book = extractFunction(src, 'managerPlaybook', 'index.html');
    t.check(/managerPlayProgress\(p, todayISO\(\), running\)/.test(book),
      'the movement is worked out ONCE, so the owner’s screen and the weekly review can never show different arithmetic');
    const render = extractFunction(src, 'renderManager', 'index.html');
    t.check(/alongside it/.test(render),
      'and the card says "alongside it" in the owner’s own view — the wording refuses the causal claim on the screen too');
    t.check(!/because of it|thanks to|it worked/i.test(render.slice(render.indexOf('mgr-play-moved'), render.indexOf('mgr-play-moved') + 1200)),
      'and never claims the play did it');
    const status = extractFunction(src, 'managerPlayStatus', 'index.html');
    t.check(/m && m\.kind === 'level'/.test(status) && /body\.baseline = Math\.round\(m\.measure\(\)\)/.test(status),
      'switching a play on stamps where the shop stood, but only where the measure is a level a flow cannot recover');

    /* One reading of how far the books reach. */
    const rest = src.replace(extractFunction(src, 'booksStartDate', 'index.html'), '');
    eq((rest.match(/map\(q=> String\(q\.invoicedAt \|\| q\.date \|\| ''\)\)/g) || []).length, 0,
      'and the longer arc takes the start of the books from that same one function');
  }

  /* ---------- 8. the discipline the mind is held to ---------------- */
  {
    const ext = api.slice(api.indexOf('const MANAGER_COMMON'), api.indexOf('function managerExtension'));
    t.check(/JUDGE THE STRATEGIES AGAINST THEIR OWN HORIZON, AND NEVER TAKE CREDIT FOR THEM/.test(ext),
      'the law, said first: the review accounts for every strategy against the span it was given, and claims none of them');
    t.check(/is WHAT MOVED, never what the play DID/.test(ext),
      'movement is not causation, in those words');
    t.check(/two below-cost lines may have been repriced in the same fortnight, or one fat order may have carried the month/.test(ext),
      'with the concrete reason a shopkeeper would recognise, not an abstraction about correlation');
    t.check(/A false lesson is worse than a wrong figure/.test(ext),
      'and WHY it matters more than an ordinary error — the owner catches a wrong figure and builds a year on a false lesson');
    t.check(/also_running names the other plays live in the same weeks for exactly this reason; when it is there, say so/.test(ext),
      'the rival explanations must be said out loud');
    t.check(/give your judgement AS a judgement in your own voice, and leave the verdict to the owner/.test(ext),
      'judgement is allowed, and marked as judgement');
    t.check(/say it is too new to judge and stop/.test(ext), 'a young play is not judged');
    t.check(/do not reach for the nearest number: ASK the owner/.test(ext),
      'and where nothing measures it, the manager asks instead of inventing');
    t.check(/A play running a long time with nothing moving is worth saying out loud and worth proposing to stop/.test(ext),
      'a failing strategy is called, not carried');
    t.check(/a hold standing three weeks with nothing repriced is advice that went nowhere/.test(ext),
      'and the holds are accounted for too');
    t.check(/And strategies: every play the shop is working/.test(api) && /And holds: the buy-plan lines/.test(api),
      'week_review_data says in its own description that both travel with it');
    t.check(/that is WHAT MOVED alongside it, never what the play did/.test(api),
      'including the warning, in the description the mind reads before it ever calls the tool');
  }
})().then(() => { process.exit(t.done() ? 1 : 0); })
  .catch((e) => { console.error(e); process.exit(1); });
