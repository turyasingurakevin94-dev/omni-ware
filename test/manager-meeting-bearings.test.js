#!/usr/bin/env node
'use strict';
/*
 * WHAT THE MEETING IS HANDED SO IT CAN FILL ITS FIELDS HONESTLY.
 *
 * The plan block asks the meeting for each move's department, its
 * confidence and its evidence, and the screen draws the department
 * board, the cash floor, the payday, the owner's offers, the taught
 * normals and the decisions signed in the Simulator. The meeting could
 * see none of them, so it could only guess the fields the screen then
 * drew. Now:
 *
 *   shop_pulse      hands each department's health score and its
 *                   failing checks, the cash floor with its source, and
 *                   the payday wages are dated by;
 *   manager_history hands the open offers with their expiry, the
 *                   normals the owner taught, and the signed decisions.
 *
 * Every list is compact and capped; a reading that fails is named and
 * the rest stand; an unknown reads "not known", never 0; a signed
 * decision is said to be the owner's record, never the Manager's advice,
 * and an offer is never money in hand.
 *
 * Every expectation is worked by hand from the small readings beside it.
 *
 * Run: node test/manager-meeting-bearings.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('manager meeting bearings');
const src = read('index.html');
const fn = (n) => extractFunction(src, n, 'index.html');
const decl = (n) => extractDeclaration(src, n, 'index.html');
const eq = (got, want, msg) => t.check(JSON.stringify(got) === JSON.stringify(want),
  `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);
const TODAY = '2026-10-07';
const shift = (iso, n) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

const FORMAT = [fn('mgrMeetingHealth'), fn('mgrMeetingSettings'), fn('mgrMeetingOffers'), fn('mgrMeetingNormals'),
  fn('mgrMeetingDecisions'), fn('mgrPaydayLabel'), fn('mgrPaydaySettlesLabel'), fn('mgrPaydaySettles'),
  fn('mgrPaydaySettlesDefault'), fn('mgrOrdinal'), decl('MGR_WEEKDAYS'), decl('MGR_DEPTS'), decl('MGR_MEETING_FAILING_MAX')];
const F = compileScope(FORMAT, { todayISO: () => TODAY, mgrPayday: () => null },
  ['mgrMeetingHealth', 'mgrMeetingSettings', 'mgrMeetingOffers', 'mgrMeetingNormals', 'mgrMeetingDecisions']);

/* ---------- 1. health: each department, its score and what fails ------ */
/* A hand-made mgrHealthChecks answer. Finance: 5 checks -- cash_floor,
   debt_60, bills_late and loans fail, debtor_days is not known. So 0 of
   4 judged pass, score 0 (a real 0: four judged, none passed); of the
   four failing, three are handed and one is counted as more_failing.
   Sales: 2 of 3 pass (67), margin failing. People: one check judged --
   thin, "not enough on the books", its one failing line still handed.
   The shop: 3 passed of 8 judged, 38. */
const check = (id, dept, pass, line) => ({ id, dept, label: id, pass, line });
const H = {
  checks: [
    check('cash_floor', 'finance', false, 'Cash falls to 1.2m on 14 Oct 2026, under your 2m floor'),
    check('debt_60', 'finance', false, '38.05m owed for more than 60 days, by 4 customers'),
    check('bills_late', 'finance', false, '2 bills past the day you named'),
    check('loans', 'finance', false, 'A loan instalment is overdue'),
    check('debtor_days', 'finance', null, 'No credit sales on the books to judge'),
    check('margin', 'sales', false, 'Margin 9.1% over 30 days, under your 12%'),
    check('below_cost', 'sales', true, 'Nothing sold below cost'),
    check('going_quiet', 'sales', true, 'No regular has gone quiet'),
    check('wages_late', 'people', false, 'Wages for September are late'),
    check('pay_rates', 'people', null, 'Nobody on the payroll'),
  ],
  score: 38, known: 8, passed: 3,
  byDept: {
    finance: { score: 0, known: 4, passed: 0, thin: false },
    sales: { score: 67, known: 3, passed: 2, thin: false },
    procurement: { score: null, known: 0, passed: 0, thin: true },
    store: { score: null, known: 0, passed: 0, thin: true },
    people: { score: null, known: 1, passed: 0, thin: true },
    marketing: { score: null, known: 0, passed: 0, thin: true },
  },
  errors: ['till'],
};
{
  const m = F.mgrMeetingHealth(H);
  eq([m.score, m.passed, m.of], [38, 3, 8], 'the shop: 3 of 8 judged checks pass, 38');
  eq(m.could_not_read, ['till'], 'a figure that could not be read is named');
  eq(m.departments.map((d) => d.dept), ['finance', 'sales', 'procurement', 'store', 'people', 'marketing'],
    'the six departments, in the board\'s order');
  const fin = m.departments[0];
  eq([fin.score, fin.passed, fin.of], [0, 0, 4], 'finance: 0 of 4 -- a real 0, four judged and none passed');
  eq(fin.failing.map((c) => c.check), ['cash_floor', 'debt_60', 'bills_late'], 'its failing checks, the first three, by id');
  eq(fin.failing[0].reads, 'Cash falls to 1.2m on 14 Oct 2026, under your 2m floor', 'each with the sentence the tile shows');
  eq([fin.more_failing, fin.not_known], [1, 1], 'one more failing counted, one not known counted');
  const sales = m.departments[1];
  eq([sales.score, sales.passed, sales.of, sales.failing.length], [67, 2, 3, 1], 'sales: 2 of 3, 67, margin failing');
  t.check(!('not_known' in sales) && !('more_failing' in sales), 'nothing unknown or over the cap is not mentioned');
  const ppl = m.departments[4];
  eq([ppl.score, ppl.failing[0].check, ppl.not_known], ['not enough on the books', 'wages_late', 1],
    'people: thin, said in words not as 0, its one failing line still handed');
  eq(m.departments[2], { dept: 'procurement', score: 'not enough on the books', passed: 0, of: 0 },
    'a department with nothing judged says so and carries nothing else');
  eq(F.mgrMeetingHealth({ checks: [], score: null, known: 0, passed: 0, byDept: {}, errors: [] }).score, 'not known',
    'a shop with nothing judged has no score: "not known", never 0');
  eq(F.mgrMeetingHealth({ error: 'boom' }), { error: 'the health checks could not be read — boom' }, 'a failed reading names itself');
}

/* ---------- 2. the floor and the payday ------------------------------ */
{
  const set = F.mgrMeetingSettings({ amount: 3000000, source: 'set', note: 'the floor you set' }, { kind: 'monthly', day: 25 });
  eq(set.cash_floor, { amount: 3000000, source: 'set by the owner', note: 'the floor you set' }, 'a floor the owner set, said so');
  eq(set.payday, { kind: 'monthly', reads: 'the 25th of each month', settles: 'pays the month in progress' },
    'the 25th pays the month in progress (the 16th on)');
  const stand = F.mgrMeetingSettings({ amount: 2600000, source: 'stand-in', note: 'not set — a month of rent and salaries stands in',
    parts: { rent: 2000000, wages: 600000, dailyPaid: 1, noRate: 0 } }, { kind: 'weekly', day: 5 });
  eq(stand.cash_floor, { amount: 2600000, source: 'stand-in', note: 'not set — a month of rent and salaries stands in',
    stands_in_with: { rent: 2000000, salaries: 600000, daily_paid_staff_not_costed: 1 } },
    'a stand-in says it is one, and what stands in: 2,000,000 rent + 600,000 salaries, one daily-paid wage not costed');
  eq(stand.payday, { kind: 'weekly', reads: 'every Friday', settles: 'each pays an even share of its month' }, 'a weekly payday');
  eq(F.mgrMeetingSettings({ amount: 0, source: 'stand-in', note: 'n' }, null).payday,
    { reads: 'not set', wages_dated: 'at month end, the date the payroll gives every wage due' }, 'no payday: "not set", and how wages are dated');
  eq(F.mgrMeetingSettings(null, null).cash_floor, { error: 'the cash floor could not be read' }, 'a floor that cannot be read is named');
}

/* ---------- 3. offers, normals, decisions ---------------------------- */
{
  const offers = { rows: [
    { id: 1, status: 'open', from: 'bank', name: 'Stanbic', amount: 20000000, rate: 18, termMonths: 12, expiresOn: '2026-10-10', daysLeft: 3 },
    { id: 2, status: 'open', from: 'supplier', name: 'Roofings', amount: 5000000.4, rate: null, termMonths: null, expiresOn: null, daysLeft: null, supplierId: 'S1', note: '60 days' },
  ], error: null };
  const o = F.mgrMeetingOffers(offers);
  eq(o.offers[0], { from: 'bank', name: 'Stanbic', amount: 20000000, rate_pct_a_year: 18, term_months: 12, expires_on: '2026-10-10', days_left: 3 },
    'an open offer with its terms and days to expiry');
  eq(o.offers[1], { from: 'supplier', name: 'Roofings', amount: 5000000, rate_pct_a_year: 'not known', term_months: 'not known',
    expires_on: 'not known', supplierId: 'S1', note: '60 days' }, 'a term not written down reads "not known", never 0');
  t.check(/not money in hand/.test(o.note), 'and an offer is said never to be money in hand');
  eq([F.mgrMeetingOffers(offers, 1).offers.length, F.mgrMeetingOffers(offers, 1).more], [1, 1], 'capped, with the rest counted');
  eq(F.mgrMeetingOffers({ rows: [], error: null }), null, 'no offers: nothing handed');
  eq(F.mgrMeetingOffers({ rows: [], error: 'denied' }), { error: 'the offers could not be read — denied' }, 'a failed read names itself');

  const normals = { rows: [
    { id: 5, date: '2026-09-12', status: 'active', body: { metric: 'sales', weekday: 6, condition: 'every Saturday', effect: 'low', taughtOn: '2026-09-12' } },
    { id: 6, date: '2026-09-01', status: 'retired', body: { metric: 'fuel', weekday: null, condition: 'month turn' } },
    { id: 7, date: '2026-08-30', status: 'active', body: { metric: 'cash_in', weekday: null, condition: 'month\'s turn', effect: 'high', note: 'builders pay' } },
  ], error: null };
  const n = F.mgrMeetingNormals(normals);
  eq(n.count, 2, 'a retired normal is not handed');
  eq(n.normals, [{ metric: 'sales', weekday: 'Saturday', when: 'every Saturday', effect: 'low', taught_on: '2026-09-12' },
    { metric: 'cash_in', when: 'month\'s turn', effect: 'high', note: 'builders pay', taught_on: '2026-08-30' }],
    'each with its weekday by name and its condition');
  t.check(/Do not raise it as unusual/.test(n.note), 'and the meeting is told what a taught normal means');
  eq(F.mgrMeetingNormals({ rows: [], error: 'no 0107' }), { error: 'the taught normals could not be read — no 0107' }, 'a failed read names itself');

  const decisions = { rows: [
    { id: 9, date: '2026-10-05', status: 'signed', body: { title: 'Simulator: pay Roofings on the 20th; chase Kato today', why: 'This is the plan I\'d sign.',
      dept: null, signedOn: '2026-10-05',
      levers: [{ id: 'bill:4', label: 'Roofings bill', choice: 'the 20th', from: 'books' }, { id: 'vol', label: 'Volume', choice: '-5%', from: 'assumption' }],
      outcome: { v: 1, low: { balance: 2400000, date: '2026-10-20' }, profit: { base: 9000000, change: 150000, lo: 100000, hi: 200000 },
        holds: { held: 2, of: 3, untestable: 0 } } } },
    { id: 8, date: '2026-10-01', status: 'signed', body: { title: 'Simulator: loan', levers: [], outcome: null, outcomeDropped: true } },
  ], error: null };
  const d = F.mgrMeetingDecisions(decisions);
  eq(d.decisions[0].levers, [{ lever: 'Roofings bill', choice: 'the 20th', effect_from: 'the books' },
    { lever: 'Volume', choice: '-5%', effect_from: 'the owner’s assumption' }], 'each lever says whether its effect is from the books or an assumption');
  eq(d.decisions[0].as_signed, { lowest_committed_cash: 2400000, on: '2026-10-20', net_profit_change_a_month: 150000,
    change_range: [100000, 200000], shocks_held: '2 of 3' }, 'and the summary it was signed on');
  eq(d.decisions[1].as_signed, 'not kept', 'an outcome that was dropped says so');
  t.check(/never executed/.test(d.note) && /never the Manager’s advice/.test(d.note),
    'a signed decision is the owner\'s record: never executed, never counted as the Manager\'s advice');
  eq(F.mgrMeetingDecisions({ rows: [], error: null }), null, 'none signed: nothing handed');
}

/* ---------- 4. shop_pulse hands health, the floor and the payday ------- */
{
  const env = {
    data: { presetManager: { cashFloor: 3000000, payday: { kind: 'monthly', day: 5 } }, presetOrderStageLimits: {} },
    todayISO: () => TODAY, anShiftDate: shift, apRound: (n) => Math.round(Number(n) || 0), CASH_AHEAD_DAYS: 30,
    dashboardContext: () => ({ inv: { deadValue: 0, deadQty: 0 }, grossProfit: 0, netProfit: 0, opex: 0, burn: 0, runwayMonths: null,
      totals: { sales: 0, estimatedQty: 0 }, itemRows: [], concentration: [], inflation: [], goingQuiet: [], invoices: [], stockOut: [] }),
    debtChaseRows: () => ({ due: [], resting: [], blocked: [], promised: [] }),
    purchasePlan: () => ({ lines: [], didNotFit: [], sourceFirst: [], coming: [], onOrder: 0, budgetBefore: 0, budget: 0 }),
    cashAhead: () => ({ committed: 0, promised: [], promisedTotal: 0, safeToSpend: 0, tightest: { date: TODAY, balance: 0 } }),
    cashOnHandByAccount: () => ({ total: 0, byAccount: [] }),
    consignmentRows: () => [], morningBriefData: () => ({ sales: { total: 0, count: 0, profit: 0 }, cash: {}, paid: { total: 0 }, ranOutCount: 0, stuck: [] }),
    dashAlerts: () => [], priceReviewCandidates: () => [], marginRows: () => Object.assign([], { skipped: {} }), targetMarginPct: () => 12,
    SQ_STATUS_ORDER: [], followUpClientsToContact: () => [], credDueRows: () => ({ total: 0, count: 0, ahead: [], undated: [], missed: [] }),
    supplierName: () => '', deadStockRows: () => [], deadStockQuietDays: () => 60, deadStockBuyers: () => [], anRowsByCustomer: () => [],
    uncostedStockRows: () => [], buyOrdersOpenRows: () => [], collectToBuy: () => null,
    mgrHealthChecks: () => H,
    Date, JSON, Math, Number, String, Array, Object,
  };
  const build = (over) => compileScope([decl('ASSISTANT_TOOLS'), ...FORMAT, fn('mgrCashFloor'), fn('mgrPayday'),
    'function names(){ return { ASSISTANT_TOOLS }; }'],
  { ...env, ...(over || {}) }, ['names']).names();
  const pulse = build().ASSISTANT_TOOLS.shop_pulse.run();
  eq([pulse.health.score, pulse.health.departments[0].failing.length], [38, 3], 'shop_pulse hands the health reading, department by department');
  eq(pulse.cash_floor, { amount: 3000000, source: 'set by the owner', note: 'the floor you set' }, 'the floor the owner set, with its source');
  eq(pulse.payday, { kind: 'monthly', reads: 'the 5th of each month', settles: 'pays the month just ended' }, 'and the payday wages are dated by');
  const broken = build({ mgrHealthChecks: () => { throw new Error('stock log unreadable'); } }).ASSISTANT_TOOLS.shop_pulse.run();
  eq(broken.health, { error: 'the health checks could not be read — stock log unreadable' }, 'health that cannot be read is named');
  eq(broken.cash_floor.amount, 3000000, 'and the floor still stands beside it');
  t.check(Array.isArray(broken.alerts), 'and the rest of the pulse is untouched');
}

/* ---------- 5. manager_history hands offers, normals, decisions -------- */
(async () => {
  const journal = (over) => ({ meeting: [{ id: 1, date: shift(TODAY, -1), body: { keyline: 'k' } }],
    move: [], review: [], target: [], play: [], question: [], offer: [], normal: [], decision: [], ...over });
  const run = (jr, over) => {
    const scope = compileScope([
      decl('ASSISTANT_TOOLS'), decl('MANAGER_METRICS'), decl('MANAGER_PROBLEMS'), decl('MANAGER_PROBLEM_METRICS'), decl('BUY_HOLD_MAX_DAYS'),
      fn('booksStartDate'), fn('managerPlayProgress'), fn('managerAdviceTally'), fn('mgrLiveMoveRows'), fn('mgrJrWords'), decl('MGR_JR_STOP'),
      fn('managerTrackRecord'), fn('managerChaseEvidence'),
      "function unusualDays(){ return { today: '', judged: 0, thin: 0, floor: 0, items: [] }; } function unusualLine(){ return ''; } var mgrUnusualMemo = null;",
      fn('chaseResponse'), fn('chaseDayAdd'), fn('chaseRate'), fn('chaseResponseLine'), fn('customerCollectionDays'),
      fn('collectionInvoiceTxn'), fn('collectionLedgerRow'), fn('debtLogIsInvoiceOwned'), fn('cashIsMoneyIn'),
      ...['CHASE_WINDOW', 'CHASE_LOOKBACK', 'CHASE_QUIET', 'CHASE_MIN_CHASED', 'CHASE_MIN_QUIET', 'CHASE_MERGE', 'CHASE_VERDICT_WORDS',
        'mgrChaseMemo', 'mgrChaseExtras', 'TRACK_MOVES_READ', 'TRACK_MIN_TIMES', 'TRACK_WINDOWED'].map(decl),
      fn('trackRecordName'), fn('trackRecordLine'), fn('trackRecordDeadLevers'),
      fn('managerPlaybook'), fn('managerPlayClock'), fn('managerPlaysPastSpan'), fn('managerScoreboard'), fn('managerScoreProgress'),
      fn('managerRecentReviews'), fn('managerReviewBrief'), fn('deriveMoveOutcome'),
      fn('buyHoldsStanding'), fn('buyHoldFor'), fn('buyKeyParts'), fn('buyKeyLabel'), fn('buyPriceStamp'), fn('buyPriceNow'),
      fn('mgrNotesOfKind'), fn('mgrOffers'), fn('daysBetweenISO'), ...FORMAT,
      'function names(){ return { ASSISTANT_TOOLS }; }',
    ], {
      data: { customers: [], savedQuotes: [], products: [], stockLog: [], purchaseInvoices: [], cashTxns: [], presetBuyHolds: {} },
      managerNotesTable: true, rivalPricesTable: false, currentShopId: 'shop-1',
      todayISO: () => TODAY, anShiftDate: shift,
      daysSinceDate: (d) => Math.round((new Date(TODAY + 'T00:00:00Z') - new Date(d + 'T00:00:00Z')) / 86400000),
      apRound: (n) => Math.round(Number(n) || 0), fmtUGX: (n) => String(n), fmtShortDate: (d) => String(d),
      anInvoicesInRange: () => [], anOverallTotals: () => ({ sales: 0, profit: 0, count: 0 }),
      debtCollectionsOn: () => ({ total: 0 }), dashInventoryHealth: () => ({ deadValue: 0 }),
      cashOnHandByAccount: () => ({ total: 0, byAccount: [] }), productDisplayLabel: (p) => p.name,
      effectiveStockMarkupRule: () => null, rankedPurchaseRowsAtQty: () => [], suggestedStockSellingPrice: () => null,
      supplierLeadTimes: () => [], mgrLineSupplier: () => null, mgrPayday: () => null,
      console, Date, JSON, Math, Number, String, Array, Object, Promise,
      sb: { from: () => { const q = { _kind: null };
        q.select = () => q; q.order = () => q; q.in = () => q; q.gte = () => q; q.lte = () => q;
        q.eq = (c, v) => { if (c === 'kind') q._kind = v; return q; };
        q.limit = () => Promise.resolve(jr[q._kind] && jr[q._kind].error ? { data: null, error: jr[q._kind].error } : { data: jr[q._kind] || [], error: null });
        q.then = (res) => res({ data: jr[q._kind] || [], error: null });
        return q; } },
      ...(over || {}),
    }, ['names']).names();
    return scope.ASSISTANT_TOOLS.manager_history.run({ limit: 3 });
  };

  /* Nothing kept: nothing handed, and nothing claimed. */
  {
    const out = await run(journal());
    t.check(!('open_offers' in out) && !('taught_normals' in out) && !('signed_decisions' in out),
      'a journal with no offers, normals or decisions hands none of them');
  }
  /* One open offer (expires in 3 days), one taken; a normal; a decision. */
  {
    const out = await run(journal({
      offer: [{ id: 21, date: '2026-10-01', status: 'open', body: { from: 'bank', name: 'Stanbic', amount: 20000000, rate: 18, termMonths: 12, expiresOn: '2026-10-10' } },
        { id: 20, date: '2026-09-01', status: 'taken', body: { from: 'bank', name: 'Centenary', amount: 5000000, rate: 20, termMonths: 6, expiresOn: '2026-09-30' } }],
      normal: [{ id: 30, date: '2026-09-12', status: 'active', body: { metric: 'sales', weekday: 6, condition: 'every Saturday', effect: 'low', taughtOn: '2026-09-12' } }],
      decision: [{ id: 40, date: '2026-10-05', status: 'signed', body: { title: 'Simulator: pay Roofings on the 20th', signedOn: '2026-10-05',
        levers: [{ id: 'bill:4', label: 'Roofings bill', choice: 'the 20th', from: 'books' }], outcome: null } }],
    }));
    eq(out.open_offers.offers.map((o) => [o.name, o.expires_on, o.days_left]), [['Stanbic', '2026-10-10', 3]],
      'the open offer, with its expiry and 3 days left (7 to 10 October); the one taken is not handed');
    eq(out.taught_normals.normals[0], { metric: 'sales', weekday: 'Saturday', when: 'every Saturday', effect: 'low', taught_on: '2026-09-12' },
      'the normal the owner taught');
    eq(out.signed_decisions.decisions[0].title, 'Simulator: pay Roofings on the 20th', 'and the decision the owner signed');
  }
  /* A read the journal refuses is named; the rest of the history stands. */
  {
    const out = await run(journal({ decision: { error: { message: 'permission denied' } } }));
    eq(out.signed_decisions, { error: 'the signed decisions could not be read — permission denied' }, 'a refused read is named');
    t.check(Array.isArray(out.meetings) && Array.isArray(out.worth_saying), 'and the rest of the history still answers');
  }
  /* THE TRACK RECORD'S GAP, NAMED. Restocks of P2 advised 20 and 25
     September and 3 October, nothing restocked, and the supplier lead
     times cannot be read, so each is given a week (CHASE_WINDOW):
       20 Sep -> 25th: 5 days < 7, nothing followed -> cut short
       25 Sep -> 3 Oct: 8 days -> a miss, weighed
       3 Oct -> today (7 Oct): 4 days < 7 -> still waiting
     The meeting is handed both counts beside `weighed`, the sentence says
     what they are, and the lead time that could not be read is named. */
  {
    const buy = (id, d) => ({ id, date: d, status: 'open', meeting_id: 1, body: { title: 'Restock P2', mkind: 'buy', subject: { key: 'P2' } } });
    const out = await run(journal({ move: [buy(53, '2026-10-03'), buy(52, '2026-09-25'), buy(51, '2026-09-20')] }),
      { supplierLeadTimes: () => { throw new Error('no deliveries read'); } });
    const row = out.track_record && out.track_record.rows.find((x) => x.kind === 'buy');
    eq(row && [row.advised, row.weighed, row.still_inside_answer_window, row.cut_short_by_the_next],
      [3, 1, 1, 1], 'advised 3: 1 weighed, 1 still inside its answer window, 1 cut short by the next');
    t.check(row && /not judged yet: 1 still in its answer window, 1 cut short by the next advice/.test(row.reads_as),
      'and the sentence names the two not judged (got ' + (row && row.reads_as) + ')');
    t.check(/^supplier lead times could not be read — no deliveries read; a restock was given a week$/.test(out.track_record.could_not_read || ''),
      'and a lead time that could not be read is named to the meeting (got ' + out.track_record.could_not_read + ')');
    const fine = await run(journal({ move: [buy(53, '2026-10-03'), buy(52, '2026-09-25'), buy(51, '2026-09-20')] }));
    t.check(!('could_not_read' in fine.track_record), 'and a record whose lead times were read carries no such notice');
  }
  /* The tools say where these come from, at the source. */
  {
    const tools = decl('ASSISTANT_TOOLS');
    t.check(/health: \(\(\)=>\{ try \{ return mgrMeetingHealth\(mgrHealthChecks\(\)\); \}/.test(tools)
      && /mgrMeetingSettings\(mgrCashFloor\(\), mgrPayday\(\)\)/.test(tools),
      'shop_pulse reads health, the floor and the payday through the shared models, each guarded');
    t.check(/mgrNotesOfKind\('normal', \{ status: 'active'/.test(tools) && /mgrNotesOfKind\('decision', \{ status: 'signed'/.test(tools)
      && /mgrOffers\(\)/.test(tools), 'manager_history reads offers, normals and decisions through the journal\'s own readers');
    t.check(!/apMode/.test(fn('mgrMeetingDecisions') + fn('mgrMeetingOffers')), 'nothing here sets anything going');
  }
  process.exit(t.done() ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
