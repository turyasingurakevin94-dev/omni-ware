#!/usr/bin/env node
'use strict';
/*
 * WHAT COLLECTING WOULD PAY FOR.
 *
 * The owner's own screen, this morning:
 *
 *   Budget is 0 UGX, not the 2,608,644 UGX in hand: 3,471,156 UGX is
 *   already promised in the next 30 days, 1 of them already overdue.
 *   There is nothing safe to spend, so the plan is empty.
 *   OVER THIS BUDGET  ... and 8 more.
 *
 * Eleven lines the shop should buy, nothing to buy them with, and one
 * sentence of advice: "collecting is what makes it affordable, and
 * Chase debts has who to ring". True, and a shrug. It names nobody, no
 * amount, and nothing that collecting would actually buy — so the owner
 * is left to do arithmetic the books could do for them.
 *
 * This file holds that arithmetic to account.
 *
 *   THE SAME RULE THE PLAN SPENDS BY. The plan is greedy and it does
 *   not give up: a cheap line below an expensive one still gets bought.
 *   A different rule here would promise a set the buying screen would
 *   never actually buy.
 *
 *   THE CONDITION IS STATED. "Collected today" is an if-then on money
 *   the books already hold, never a claim that it will be. A debtor's
 *   word is REPORTED beside their name and never allowed to move a
 *   figure — the law cash-ahead.test.js keeps, kept here too.
 *
 *   BIGGEST, NOT OLDEST. collectableDebts ranks by age, because age is
 *   what decides who to chase. This answers a different question — what
 *   would buy the most — so it re-sorts. Reusing the chase order would
 *   put a nine-month 40,000 above the 1.4m that covers half the plan.
 *
 *   NOT ENOUGH IS AN ANSWER. A debtor whose whole balance would not
 *   reach the cheapest line is said so, not left blank beside a name.
 *
 * Run: node test/collect-to-buy.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('what collecting would pay for');
const src = read('index.html');
const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);

const TODAY = '2026-08-29';

/* A plan shaped like the owner's: nothing safe to spend, and a ranked
   tail of lines it cannot reach. Handed in rather than derived, because
   what this reading does with a plan is the whole claim — how the plan
   itself is built is purchase-plan.test.js's. */
const PLAN = () => ({
  budget: 0, budgetBefore: 0, onOrder: 0, spend: 0, lines: [], coming: [], sourceFirst: [],
  didNotFit: [
    { key: 'A', name: 'Runners', cost: 800000 },
    { key: 'B', name: 'Black Screws', cost: 2520000 },
    { key: 'C', name: 'Wall Angle', cost: 210000 },
    { key: 'D', name: 'Gypsum', cost: 90000 },
  ],
});

const makeData = () => ({
  customers: [
    { id: 1, name: 'Mulongo', debt: 1436000, debtLog: [] },
    { id: 2, name: 'David', debt: 900000, debtLog: [] },
    { id: 3, name: 'Dad', debt: 40000, debtLog: [] },
    { id: 4, name: 'Settled Sam', debt: 0, debtLog: [] },
  ],
  paymentPromises: [],
});

const NAMES = ['collectToBuy', 'collectToBuyHTML', 'collectableDebts',
  /* Whole, not stubbed: whether a promise is still "waiting" has to mean
     the same thing here as on the chase screen. */
  'promisesFor', 'promiseState', 'promiseLatest', 'promisesBroken'];

const build = (data, over) => compileScope(
  NAMES.map((n) => extractFunction(src, n, 'index.html')),
  Object.assign({
    data,
    todayISO: () => TODAY,
    daysSinceDate: (d) => (d ? Math.round((Date.parse(TODAY) - Date.parse(String(d))) / 86400000) : -1),
    customerOldestOpenChargeDate: (c) => ({ 1: '2026-07-01', 2: '2026-07-29', 3: '2026-01-01' })[c.id] || null,
    fmtUGX: (n) => Number(n || 0).toLocaleString('en-US') + ' UGX',
    fmtShortDate: (d) => String(d),
    agingDaysLabel: (n) => `${n} days`,
    esc: (x) => String(x == null ? '' : x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
    Date, Math, Number, String, Array, Object, Boolean, JSON,
  }, over || {}),
  NAMES);

/* ---------- 1. what is short, and what would cover it ---------------- */
{
  const s = build(makeData());
  const c = s.collectToBuy(PLAN(), TODAY);
  t.check(!!c, 'a plan with lines it cannot reach gets an answer');
  eq(c.leftOfBudget, 0, 'nothing left of the budget, which is the owner’s actual position');
  eq(c.over, 4, 'four lines out of reach');
  eq(c.overTotal, 3620000, 'coming to the whole of what they cost');

  eq(c.nextLine, 'Runners', 'the best earner left is named');
  eq(c.needForNext, 800000, 'with what IT needs');
  eq(c.needForCheapest, 90000,
    'AND WHAT THE CHEAPEST NEEDS — a screen that gives only the first tells a shop 800,000 short that it can do nothing, when 90,000 would buy something today');

  eq(c.owedToYou, 2376000, 'against everything owed to the shop');
  eq(c.debtors, 3, 'by the customers who actually owe — a settled account is not a debtor');
}

/* ---------- 2. biggest first, because the question is different ------ */
{
  const s = build(makeData());
  const c = s.collectToBuy(PLAN(), TODAY);
  eq(c.candidates.map((x) => x.name).join(','), 'Mulongo,David,Dad',
    'RANKED BY WHAT THEY WOULD BUY, not by how long they have owed it — chasing order is age, and reusing it would put a nine-month 40,000 above the 1.4m that covers half the plan');
  /* Dad is the oldest debt in the fixture by a wide margin, so the two
     orders genuinely disagree and this assertion can fail. */
  eq(s.collectableDebts()[0].name, 'Dad',
    'and the chase order really is the other one, so the two are not the same list wearing two names');
}

/* ---------- 3. the same greedy rule the plan spends by ---------------- */
{
  const s = build(makeData());
  const c = s.collectToBuy(PLAN(), TODAY);
  const mulongo = c.candidates.find((x) => x.name === 'Mulongo');
  /* 1,436,000: Runners (800,000) fits, Black Screws (2,520,000) does
     not — and the plan does NOT stop there. Wall Angle (210,000) and
     Gypsum (90,000) both still fit underneath it. */
  eq(mulongo.lines, 3, 'a collection buys every line that fits, skipping what does not — the plan is greedy and it does not give up');
  eq(mulongo.spend, 1100000, 'costed at what those lines actually come to');
  eq(mulongo.covers.join(','), 'Runners,Wall Angle,Gypsum', 'and it names them');

  const dad = c.candidates.find((x) => x.name === 'Dad');
  eq(dad.lines, 0, 'a balance that reaches nothing buys nothing');
  eq(dad.spend, 0, 'and is not credited with a line it cannot pay for');

  /* 2,376,000 owed against 3,620,000 over budget: collecting the LOT
     still does not buy the lot, and the reading says the smaller
     number rather than rounding up to a happy one. */
  eq(c.allCollected.lines, 3, 'everything collected covers what it covers, and no more');
  eq(c.allCollected.spend, 1100000, 'at what those lines come to');
  /* And the sharp fact underneath it: collecting EVERYBODY buys exactly
     what collecting Mulongo alone buys, because the 2,520,000 line is
     out of reach either way. A shop that could see that would chase one
     customer and stop. */
  eq(c.allCollected.spend, mulongo.spend,
    'which is what Mulongo alone already buys — the rest of the debt book adds nothing while one line stays out of reach');
  eq(c.allCollected.whole, false,
    'and does NOT claim the whole plan — a shop 1,244,000 short of its own debt book needs to be told that, not flattered');

  /* And the other way: a shop owed more than its plan is short. */
  const rich = build(Object.assign(makeData(), {
    customers: [{ id: 1, name: 'Mulongo', debt: 5000000, debtLog: [] }] }));
  const r = rich.collectToBuy(PLAN(), TODAY);
  eq(r.allCollected.whole, true, 'a debt book bigger than the shortfall buys the whole of it');
  eq(r.allCollected.lines, 4, 'every line over budget');
}

/* ---------- 4. a debtor's word is reported, never counted ------------- */
{
  const data = makeData();
  data.paymentPromises = [
    { id: 1, customerId: 1, promisedOn: '2026-09-10', madeOn: '2026-08-28', amount: 1436000 },
    { id: 2, customerId: 2, promisedOn: '2026-08-01', madeOn: '2026-07-20', amount: 900000 },
  ];
  const s = build(data);
  const c = s.collectToBuy(PLAN(), TODAY);
  const mulongo = c.candidates.find((x) => x.name === 'Mulongo');
  eq(mulongo.promisedOn, '2026-09-10', 'a day a customer named is REPORTED beside them');
  eq(mulongo.lines, 3,
    'and changes NOTHING about the figure — buying stock on the strength of a promise is the mistake the cash line exists to prevent, and this reading keeps that law');
  const david = c.candidates.find((x) => x.name === 'David');
  eq(david.promisedOn, null, 'a day that has come and gone is not a day they are still waiting on');
  eq(david.brokenBefore, 1, 'it is a broken word, counted against them where the owner will see it');
}

/* ---------- 5. nothing to answer ------------------------------------- */
{
  const s = build(makeData());
  eq(s.collectToBuy(Object.assign(PLAN(), { didNotFit: [] }), TODAY), null,
    'a plan that fits its budget has nothing to collect FOR');
  eq(s.collectToBuy(Object.assign(PLAN(), { budget: null }), TODAY), null,
    'and a plan with no budget at all has no shortfall to answer — everything fits by definition');

  const none = build({ customers: [], paymentPromises: [] });
  const c = none.collectToBuy(PLAN(), TODAY);
  eq(c.debtors, 0, 'a shop nobody owes has no candidates');
  const html = none.collectToBuyHTML(c);
  t.check(/Nobody owes you anything/.test(html),
    'AND IS TOLD SO — it means the money is not out with customers, so collecting is not the lever and the owner should stop looking for it there');
}

/* ---------- 6. and it reaches the screen ------------------------------ */
{
  const data = makeData();
  data.paymentPromises = [{ id: 1, customerId: 1, promisedOn: '2026-09-10', madeOn: '2026-08-28', amount: 1436000 }];
  const s = build(data);
  const html = s.collectToBuyHTML(s.collectToBuy(PLAN(), TODAY));
  t.check(/What collecting would pay for/.test(html), 'the section is headed');
  t.check(/Mulongo/.test(html) && /1,436,000/.test(html), 'the biggest debtor is named with what they owe');
  t.check(/covers <b>3<\/b> lines/.test(html), 'beside what their money would buy');
  t.check(/Runners, Wall Angle, Gypsum/.test(html), 'and which lines those are');
  t.check(/if it were in the drawer today/.test(html),
    'THE CONDITION IS ON THE SCREEN — without it the figure reads as a forecast, and this app does not forecast a debtor');
  t.check(/said 2026-09-10/.test(html), 'a promised day is shown');
  t.check(/not enough on its own/.test(html),
    'and a balance that reaches nothing says so — a blank beside a name reads as a screen that failed to work something out');
  /* Dad owes 40,000 against a cheapest line short by 90,000, so what is
     STILL short after his money is 50,000. Quoting the 90,000 there
     would read as if collecting from him did nothing at all. */
  t.check(/40,000 UGX would leave the cheapest line 50,000 UGX short/.test(html),
    'naming what is still short AFTER their money, not the gap as it stood before it');
  t.check(/ctb-go/.test(html) && /Chase them/.test(html),
    'with the door to the screen where the ringing is actually done');
  t.check(/Everything owed to you is <b>2,376,000 UGX<\/b> across 3 customers/.test(html),
    'and the whole of it, so the owner can see the ceiling on this lever');
  t.check(/it would cover <b>3<\/b> of the 4/.test(html),
    'saying plainly that even the whole debt book does not reach the whole plan');
}

/* ---------- 7. and the Manager is handed the same arithmetic --------- *
 *
 * RUN, not read off the source. A key can be spelled in the file and
 * never reach the tool's return; the only proof is calling it.
 */
{
  const scope = compileScope(
    NAMES.map((n) => extractFunction(src, n, 'index.html'))
      .concat([extractDeclaration(src, 'ASSISTANT_TOOLS', 'index.html'),
        'function tools(){ return ASSISTANT_TOOLS; }']),
    {
      data: makeData(),
      todayISO: () => TODAY,
      daysSinceDate: (d) => (d ? Math.round((Date.parse(TODAY) - Date.parse(String(d))) / 86400000) : -1),
      customerOldestOpenChargeDate: (c) => ({ 1: '2026-07-01', 2: '2026-07-29', 3: '2026-01-01' })[c.id] || null,
      fmtUGX: (n) => Number(n || 0).toLocaleString('en-US'),
      fmtShortDate: (d) => String(d),
      agingDaysLabel: (n) => `${n} days`,
      esc: (x) => String(x),
      apRound: (n) => Math.round(Number(n) || 0),
      /* The plan is handed in: how it is built is purchase-plan's claim,
         and what this file is proving is that the JOIN reaches the mind. */
      purchasePlan: () => PLAN(),
      cashAhead: () => ({ safeToSpend: 0 }),
      cashOnHandByAccount: () => ({ total: 0, byAccount: [] }),
      buyOrdersOpenRows: () => [],
      CASH_AHEAD_DAYS: 30,
      Date, Math, Number, String, Array, Object, Boolean, JSON,
    }, ['tools']);

  const out = scope.tools().purchase_plan.run({});
  const c = out.what_collecting_would_buy;
  t.check(!!c, 'the spoken buy plan carries what collecting would pay for');
  eq(c.the_next_line, 'Runners', 'naming the line that is next in reach');
  eq(c.it_needs, 800000, 'and what it is short by');
  eq(c.cheapest_line_needs, 90000, 'and what the cheapest one is short by');
  eq(c.if_collected_today[0].name, 'Mulongo', 'with the debtor whose money buys most');
  eq(c.if_collected_today[0].customerId, 1,
    'CARRYING THEIR ID — without it the Manager can name them in prose and never point at them, which is how a chase stops being measurable');
  eq(c.if_collected_today[0].would_buy_lines, 3, 'and what their money would buy');
  eq(c.if_collected_today[0].namely.join(','), 'Runners,Wall Angle,Gypsum', 'namely which');
  t.check(/IN THE DRAWER TODAY/.test(c.the_condition || ''),
    'and the condition travels WITH the figures, so a mind cannot quote them as a forecast');
  eq(c.everything_collected.covers_the_whole_plan, false,
    'while saying plainly that the whole debt book still does not reach the whole plan');
}

/* ---------- 8. and it is DRAWN, not merely computed ------------------ *
 *
 * A reading that never reaches the screen is a reading the owner does
 * not have. Every assertion above would pass with the section wired to
 * nothing, which is how a whole feature ships invisible — so the panel
 * itself is rendered here and asked whether the section is in it.
 */
{
  const el = { innerHTML: '', querySelector: () => null, querySelectorAll: () => [] };
  const scope = compileScope(
    NAMES.map((n) => extractFunction(src, n, 'index.html'))
      .concat(['let buyBudget = null; let buyPlanLast = null; let buyOrderBasket = new Set();',
        extractFunction(src, 'renderPurchasePlanPanel', 'index.html')]),
    {
      data: makeData(),
      todayISO: () => TODAY,
      daysSinceDate: (d) => (d ? Math.round((Date.parse(TODAY) - Date.parse(String(d))) / 86400000) : -1),
      customerOldestOpenChargeDate: (c) => ({ 1: '2026-07-01', 2: '2026-07-29', 3: '2026-01-01' })[c.id] || null,
      fmtUGX: (n) => Number(n || 0).toLocaleString('en-US') + ' UGX',
      fmtShortDate: (d) => String(d),
      agingDaysLabel: (n) => `${n} days`,
      esc: (x) => String(x == null ? '' : x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
      /* Handed in: how the plan is built belongs to purchase-plan.test.js,
         and what is under test here is the wiring between the two. */
      purchasePlan: () => PLAN(),
      buyHoldsSweep: () => {}, buyOrdersSweep: () => {}, buyOrdersOpenRows: () => [],
      buyLineFacts: () => [], buyLineWhy: () => '',
      cashOnHandByAccount: () => ({ total: 2608644, byAccount: [] }),
      cashAhead: () => ({ days: 30, commitments: [], committed: 3471156, unknown: 0,
        safeToSpend: 0, tightest: { date: TODAY, balance: 0 } }),
      CASH_AHEAD_DAYS: 30,
      listPageSlice: (_k, rows) => rows, listMoreButtonHTML: () => '',
      document: { getElementById: (id) => (id === 'buy_plan' ? el : null), activeElement: null },
      Date, Math, Number, String, Array, Object, Boolean, JSON, Set,
    }, ['renderPurchasePlanPanel']);

  scope.renderPurchasePlanPanel();
  const html = el.innerHTML;
  t.check(/What collecting would pay for/.test(html),
    'THE SECTION IS ON THE SCREEN — everything above this passes with it wired to nothing, which is how a whole feature ships invisible');
  t.check(/Mulongo/.test(html), 'naming the debtor whose money buys most');
  t.check(/covers <b>3<\/b> lines/.test(html), 'and what it would buy');
  /* The empty-plan paragraph must point AT it, or the owner reads
     "collecting is what makes it affordable" and never scrolls. */
  t.check(/There is nothing safe to spend/.test(html),
    'the shop\u2019s actual position — nothing safe to spend — is still said');
  t.check(html.indexOf('What collecting would pay for') > html.indexOf('There is nothing safe to spend'),
    'and the section that answers it comes after, where a reader who has just been told the plan is empty will meet it');
}

process.exit(t.done() ? 1 : 0);
