#!/usr/bin/env node
'use strict';
/*
 * The morning brief: yesterday's picture, derived — never stored.
 *
 * Every figure on it comes from the same functions the screens already
 * trust (sales from the statements' own invoice window, cash from the
 * cash book's day position, debts from the collectable list, stuck
 * orders from the board's own stage rule), so the brief can never
 * disagree with the books. What this file holds to account:
 *
 *   THE STAGE RULE IS SHARED. orderStageOverdue is read by the Order
 *   Tracking flag, the rail roll-up AND the brief — one rule, no drift.
 *
 *   RAN OUT MEANS THE CROSSING. A line that went from something to
 *   nothing yesterday and is STILL empty this morning. A restock since
 *   un-rings it; a line already empty before yesterday is not an event.
 *
 *   AN EMPTY DAY IS SAID PLAINLY. Zero sales is "none recorded", not a
 *   dressed-up dashboard; estimated profit carries the ≈.
 *
 * Run: node test/morning-brief.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('morning brief');
const src = read('index.html');
const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);

const Y = '2026-08-26';
const NOW = Date.parse('2026-08-27T06:30:00.000Z');

/* ---------- 1. the stage-timer rule, now shared ----------------------- */
{
  const scope = compileScope([extractFunction(src, 'orderStageOverdue', 'index.html')], {}, ['orderStageOverdue']);
  const limits = { preparing: 60 };
  eq(scope.orderStageOverdue({ status: 'preparing', stageEnteredAt: NOW - 61 * 60000 }, limits, NOW), true,
    'past its limit flags');
  eq(scope.orderStageOverdue({ status: 'preparing', stageEnteredAt: NOW - 59 * 60000 }, limits, NOW), false,
    'under it does not');
  eq(scope.orderStageOverdue({ status: 'draft', stageEnteredAt: NOW - 999 * 60000 }, limits, NOW), false,
    'a step with no limit never flags');
  eq(scope.orderStageOverdue({ status: 'preparing' }, limits, NOW), false,
    'and no stage timestamp cannot flag');
  const render = extractFunction(src, 'renderSavedQuotes', 'index.html');
  t.check(/const orderIsOverdue = \(q\)=> orderStageOverdue\(q, stageLimits, Date\.now\(\)\);/.test(render),
    'the board reads the SAME rule — its flag and the brief can never disagree');
}

/* ---------- 2. the derivation ----------------------------------------- */
{
  const data = {
    customers: [
      { id: 'C1', name: 'Mukasa', debtLog: [
        { type: 'payment', date: Y, amount: 200000, cashTxnId: 901 },
        { type: 'payment', date: '2026-08-20', amount: 50000 },
        { type: 'charge', date: Y, amount: 999999 }] },
      // A timestamped date must still count for its day.
      { id: 'C2', name: 'Auma', debtLog: [{ type: 'payment', date: Y + 'T09:12:00', amount: 80000, cashTxnId: 904 }] },
      { id: 'C3', name: 'Quiet', debtLog: [] },
      /* LIVE LIE #1: the invoice sync's echo row — written when a sale
         is paid at the counter, an invoice edited, or voided. David
         paid nothing; the first brief listed him at 2,500,000. */
      { id: 'C5', name: 'David', debtLog: [
        { type: 'payment', date: Y, amount: 2500000, quoteId: 77, note: 'Auto-sync — INV-0210' }] },
      /* LIVE LIE #2: the drift-repair row — payment-shaped, dated the
         day the owner clicked Repair, and its own wording says "no
         money moves". It carries no cashTxnId, because none exists. */
      { id: 'C6', name: 'Repaired', debtLog: [
        { type: 'payment', date: Y, amount: 700000, cashTxnId: null,
          note: 'Balance correction — history did not add up to the balance shown' }] },
      { id: 'C4', name: 'Ken' },
    ],
    cashTxns: [
      { id: 901, date: Y, type: 'receipt', category: 'Debt Payment', amount: 200000 },
      /* The invoice screen's own form stamps 'Invoice Payment' — the
         category that silently dropped the REAL payers at first. */
      { id: 902, date: Y, type: 'receipt', category: 'Invoice Payment', amount: 150000 },
      { id: 903, date: Y, type: 'receipt', category: 'Agent Payment', amount: 99999 },
    ],
    stockLog: [
      // crossed to zero yesterday, still out this morning -> news
      { key: 'P1', productId: 'P1', variantIdx: null, label: 'Simba Cement', date: Y, delta: -5, qtyAfter: 0 },
      // crossed yesterday but restocked since -> old news, not shown
      { key: 'P2', productId: 'P2', variantIdx: null, label: 'Sahara Filler', date: Y, delta: -3, qtyAfter: 0 },
      // was already at nothing (no crossing) -> not an event
      { key: 'P3', productId: 'P3', variantIdx: null, label: 'Half Bend', date: Y, delta: -2, qtyAfter: -2 },
      // right shape, wrong day
      { key: 'P4', productId: 'P4', variantIdx: null, label: 'Runner', date: '2026-08-20', delta: -1, qtyAfter: 0 },
    ],
    savedQuotes: [
      { id: 1, status: 'preparing', stageEnteredAt: NOW - 5 * 3600000, client: { name: 'Okello' }, voided: false },
      { id: 2, status: 'preparing', stageEnteredAt: NOW - 2 * 3600000, client: { name: 'Nsubuga' } },
      { id: 3, status: 'completed', stageEnteredAt: NOW - 99 * 3600000, client: { name: 'Done' } },
      { id: 4, status: 'preparing', stageEnteredAt: NOW - 9 * 3600000, client: { name: 'Voided' }, voided: true },
      // An invoice-allocated payment: real money, linked to its
      // debt-collection cash receipt.
      { id: 5, status: 'completed', customerId: 'C4', client: { name: 'Ken' },
        payments: [{ date: Y, amount: 150000, cashTxnId: 902 }] },
      // An agent settling their order: the agents' flow, not this one.
      { id: 6, status: 'completed', client: { name: 'Agent order' },
        payments: [{ date: Y, amount: 99999, cashTxnId: 903 }] },
    ],
    presetOrderStageLimits: { preparing: 60 },
  };
  const env = {
    data,
    anInvoicesInRange: (from, to) => { env._range = [from, to]; return ['inv']; },
    anOverallTotals: () => ({ sales: 560750, cost: 400000, qty: 9, estimatedQty: 2, count: 3, profit: 160750, margin: 28.7 }),
    cbDayPosition: (d) => ({ date: d, in: 700000, out: 120000, countedAccounts: 1, varianceTotal: -5000 }),
    collectableDebts: () => [
      { id: 'C9', name: 'Roto Debtor', debt: 900000, ageDays: 30 },
      { id: 'C8', name: 'Second', debt: 100000, ageDays: 3 },
    ],
    fmtShortDate: (d) => String(d),
    /* debtCollectionsOn carries the account the money arrived on and the
       invoice it was against, so The day never reads either source a
       second time. The brief reads the same rows and simply ignores the
       two extra fields. */
    accountLabel: (k) => ({ cash: 'Cash', momo: 'Mobile Money', bank: 'Bank' })[k] || k || '',
    invoiceNumberLabel: (q) => 'INV-' + String(q.id),
    Date,
    todayISO: () => '2026-08-29',
    followUpClientsToContact: () => [{ name: 'Mulongo' }, { name: 'Achen' }],
    getStockQty: (pid) => (pid === 'P2' ? 12 : 0),
    SQ_STATUSES: { preparing: { label: 'Preparing' }, completed: { label: 'Completed' } },
  };
  const scope = compileScope([
  /* Payables now include consignment that has sold and not been
     settled -- money owed with no bill yet. The chain comes along so
     the figure is the real one; a fixture holding nothing on
     consignment simply reads zero. */
  extractFunction(src, 'consignmentHeld', 'index.html'),
  extractFunction(src, 'consignmentAccrued', 'index.html'),
  extractFunction(src, 'consignmentSettlements', 'index.html'),
  extractFunction(src, 'consignmentSettled', 'index.html'),
  extractFunction(src, 'consignmentRows', 'index.html'),
  extractFunction(src, 'consignmentOwedTotal', 'index.html'),
    extractFunction(src, 'orderStageOverdue', 'index.html'),
    extractFunction(src, 'cashIsMoneyIn', 'index.html'),
    extractFunction(src, 'cashIsDebtCollection', 'index.html'),
    extractFunction(src, 'debtLogIsInvoiceOwned', 'index.html'),
    extractFunction(src, 'debtCollectionsOn', 'index.html'),
    extractFunction(src, 'collectionInvoiceTxn', 'index.html'),
    extractFunction(src, 'collectionLedgerRow', 'index.html'),
    /* The brief now says what a debtor promised, so the promise model
       comes in whole — a stub would let the brief and the chase queue
       disagree about who has named a day. */
    extractFunction(src, 'promisesFor', 'index.html'),
    extractFunction(src, 'promiseState', 'index.html'),
    extractFunction(src, 'promiseLatest', 'index.html'),
    extractFunction(src, 'morningBriefData', 'index.html'),
  ], env, ['morningBriefData']);
  const b = scope.morningBriefData(Y, NOW);

  eq(env._range.join(','), Y + ',' + Y,
    'sales are read for exactly yesterday, on the statements\' own definition of a sale');
  eq(b.sales.total, 560750, 'the sales total rides through untouched');
  t.check(b.sales.estimated === true,
    'an estimated cost marks the profit approximate — a good figure, never a certain one');
  eq(b.cash.moneyIn, 700000, 'cash in comes from the cash book\'s own day position');
  t.check(b.cash.counted === true && b.cash.variance === -5000, 'with the count and its shortfall');

  eq(b.paid.count, 3, 'three real collections yesterday');
  eq(b.paid.total, 430000, 'and only MONEY sums — never bookkeeping');
  eq(b.paid.rows.map((r) => r.name).join(','), 'Mukasa,Ken,Auma',
    'largest first — a general-balance receipt, an Invoice Payment receipt, both roads counted');
  t.check(!b.paid.rows.some((r) => r.name === 'David'),
    'the invoice sync\'s echo row is NOT a collection — live lie #1, pinned dead');
  t.check(!b.paid.rows.some((r) => r.name === 'Repaired'),
    'a drift-repair correction is NOT a collection — live lie #2, pinned dead: no cash receipt, no money');
  t.check(!b.paid.rows.some((r) => r.name === 'Agent order'),
    'an agent settling their order is not customer debt collected');
  t.check(!b.paid.rows.some((r) => r.name === 'Quiet'), 'nobody is invented, and a charge is not a payment');

  eq(b.ranOut.join(','), 'Simba Cement',
    'ran-out is the CROSSING dated yesterday, still empty now — a restock un-rings it, already-empty is no event');

  eq(b.stuck.length, 2, 'two orders sit past their stage limit');
  eq(b.stuck[0].name, 'Okello', 'longest-overdue first');
  eq(b.stuck[0].statusLabel, 'Preparing', 'named by the board\'s own stage label');
  t.check(!b.stuck.some((s) => s.name === 'Done' || s.name === 'Voided'),
    'completed and voided orders cannot be stuck');

  eq(b.debts.rows[0].name, 'Roto Debtor', 'the debt book\'s standing picture rides along');
  eq(b.debts.total, 1000000, 'with its total');

  /* WHAT THEY SAID, BESIDE WHAT THEY OWE.
   *
   * Chase debts keeps a customer who has named a day out of the queue
   * until it comes. This block had never heard of a promise, so it
   * handed them straight back at breakfast — and breakfast is where the
   * ringing gets decided. One screen learned the lesson and the first
   * screen of the day did not.
   */
  data.paymentPromises = [{ id: 1, customerId: 'C9', promisedOn: '2026-09-20', madeOn: Y, amount: null }];
  data.customers.push({ id: 'C9', name: 'Roto Debtor', debt: 900000, debtLog: [] });
  const withPromise = scope.morningBriefData(Y, NOW);
  t.check(!!withPromise.debts.rows[0].promise,
    'a debtor who has named a day carries what they said into the brief');
  eq(withPromise.debts.rows[0].promise.state, 'waiting', 'and the state is derived here too, not stamped');
  t.check(!withPromise.debts.rows[1].promise,
    'while a debtor who has said nothing carries nothing — no promise is invented for them');
  /* The balance is still real and the row stays: this block is the
     BIGGEST DEBTS, not a list of who to ring. Dropping them would be a
     different lie from the one being fixed. */
  eq(withPromise.debts.rows.length, 2, 'and nobody is dropped for having promised — they still owe it');
  eq(withPromise.debts.total, 1000000, 'so the total is unmoved');

  data.paymentPromises = [{ id: 1, customerId: 'C9', promisedOn: '2026-08-01', madeOn: '2026-07-25', amount: null }];
  eq(scope.morningBriefData(Y, NOW).debts.rows[0].promise.state, 'broken',
    'and a day that has gone reads as broken — the fact worth having before the first call of the day');
  data.paymentPromises = [];
  eq(b.followUps.count, 2, 'and today\'s follow-up count');
}

/* ---------- 3. the words ---------------------------------------------- */
{
  const scope = compileScope([
    extractFunction(src, 'morningBriefHTML', 'index.html'),
  ], {
    esc: (s) => String(s),
    fmtUGX: (n) => Number(n || 0).toLocaleString('en-US') + ' UGX',
  }, ['morningBriefHTML']);

  const empty = scope.morningBriefHTML({
    date: Y,
    sales: { count: 0, total: 0, profit: 0, margin: 0, estimated: false },
    cash: { moneyIn: 0, moneyOut: 0, counted: false, variance: 0 },
    paid: { count: 0, total: 0, rows: [] },
    debts: { total: 0, rows: [] },
    ranOut: [], ranOutCount: 0, stuck: [], stuckCount: 0,
    followUps: { count: 0, names: [] },
  });
  t.check(/none recorded/.test(empty) && /nobody paid/.test(empty) && /not counted/.test(empty),
    'an empty day is said plainly, never dressed up');
  t.check(/Nothing carried over — a clean start\./.test(empty),
    'and no leftover blocks means a clean start, said as one line');

  const busy = scope.morningBriefHTML({
    date: Y,
    sales: { count: 3, total: 560750, profit: 160750, margin: 28.7, estimated: true },
    cash: { moneyIn: 700000, moneyOut: 120000, counted: true, variance: -5000 },
    paid: { count: 2, total: 280000, rows: [{ name: 'Mukasa', amount: 200000 }] },
    debts: { total: 1000000, rows: [{ name: 'Roto Debtor', debt: 900000, ageDays: 30 }] },
    ranOut: ['Simba Cement'], ranOutCount: 1,
    stuck: [{ id: 1, name: 'Okello', statusLabel: 'Preparing', overMinutes: 240 }],
    stuckCount: 1,
    followUps: { count: 2, names: ['Mulongo', 'Achen'] },
  });
  t.check(/≈ 160,750 UGX/.test(busy), 'estimated profit carries the ≈, honestly');
  t.check(/short 5,000 UGX/.test(busy), 'a counted shortfall is named');
  t.check(/Ran out yesterday/.test(busy) && /Simba Cement/.test(busy), 'stock-outs are named');
  t.check(/4h over/.test(busy) && /Okello/.test(busy), 'a stuck order says how far over it is');
  t.check(/Mulongo, Achen/.test(busy), 'and who to call today');
}

/* ---------- 4. the wiring --------------------------------------------- */
{
  t.check(/id="dash_morningBrief"/.test(src) && /id="dash_brief_date"/.test(src),
    'the panel exists at the top of the dashboard');
  const dash = extractFunction(src, 'renderDashboard', 'index.html');
  t.check(/renderMorningBrief\(\);/.test(dash), 'and renders with the dashboard');
  const rmb = extractFunction(src, 'renderMorningBrief', 'index.html');
  t.check(/anShiftDate\(todayISO\(\), -1\)/.test(rmb), 'the brief is always about yesterday');
  const show = extractFunction(src, 'maybeShowMorningBrief', 'index.html');
  t.check(/String\(seen\) >= todayISO\(\)/.test(show) && /goToTab\('dashboard'\)/.test(show),
    'first open of the day NAVIGATES to the dashboard, suppressed by the snooze convention (>=)');
  t.check(/const MORNING_BRIEF_KEY = 'owMorningBriefShownOn';/.test(src),
    'under the ow* local-preference key convention — per-device courtesy, not shop data');
  const rem = extractFunction(src, 'runStartupReminders', 'index.html');
  t.check(/maybeShowMorningBrief\(\);/.test(rem)
    && rem.indexOf('maybeShowMorningBrief') < rem.indexOf('maybeRemindLoanDue'),
    'the brief runs FIRST at boot and does not eat the reminder queue — it navigates, not modals');
}

process.exit(t.done() ? 1 : 0);
