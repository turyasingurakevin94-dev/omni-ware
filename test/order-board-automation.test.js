#!/usr/bin/env node
'use strict';
/*
 * Three steps of the order board that no longer wait for a hand.
 *
 * The board was five stages and an arrow, and every arrow was the
 * owner's. Some of those taps were carrying real information — a
 * supplier's answer, a decision about a short pick — and some were the
 * owner telling the app something it already knew.
 *
 * This file guards the three that were the second kind, and the line
 * between them:
 *
 *   MOVES ITSELF   an order waiting only on goods, the moment its last
 *                  line is checked in. Nothing about that is a judgement:
 *                  the answer to "is this still waiting" became no, and
 *                  the app knew before anybody walked to the board.
 *
 *   MOVES ITSELF   on the last supplier confirming. Copying the order to
 *                  the sales group and opening WhatsApp for a paste is
 *                  a person's act, so it is a tap (announceOrderToGroup)
 *                  rather than a gate -- which is what lets the move be
 *                  the app's.
 *
 *   REACHES OUT    an order past its stage limit. The flag blinked at
 *                  whoever was already looking at the board, which is
 *                  nobody, at the one moment it mattered.
 *
 * Run: node test/order-board-automation.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('order board automation');
const src = read('index.html');
const code = src.split(/\r?\n/).map((l) => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');
const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);

/* ---------- 1. an order stops waiting when its last item is in ------ */
{
  const data = { savedQuotes: [] };
  const moved = [];
  const NAMES = ['ordersReadyToLeaveAwaitingGoods', 'autoAdvanceReceivedOrders', 'autoAdvanceNote'];
  const scope = compileScope(NAMES.map((n) => extractFunction(src, n, 'index.html')), {
    data,
    setSavedQuoteStatus: (id, status) => {
      moved.push([id, status]);
      const q = data.savedQuotes.find((x) => x.id === id);
      if (q) q.status = status;
    },
    // The real rule, from shared-worker.js, so this measures the app's
    // definition of "still waiting" and not a convenient stand-in.
    orderAwaitsGoods: (q) => ((q && q.items) || []).some((it) => it.boughtIn && !it.received),
    agentPaymentBlocksPreparing: (q) => !!q.agentUnpaid,
    quoteClientName: (q) => (q && q.client && q.client.name) || 'Walk-in',
  }, NAMES);
  const { ordersReadyToLeaveAwaitingGoods, autoAdvanceReceivedOrders, autoAdvanceNote } = scope;

  const order = (over) => Object.assign({
    id: 1, status: 'awaiting_goods', voided: false, client: { name: 'Dad' },
    items: [{ boughtIn: true, received: true }],
  }, over);

  data.savedQuotes = [order({})];
  eq(ordersReadyToLeaveAwaitingGoods().length, 1, 'an order whose last line is in is ready to leave Awaiting Goods');

  data.savedQuotes = [order({ items: [{ boughtIn: true, received: true }, { boughtIn: true, received: false }] })];
  eq(ordersReadyToLeaveAwaitingGoods().length, 0, 'one still to come in keeps the whole order waiting');

  /* The goods gate is the ONLY one this answers. An agent who has not
     paid still blocks the same move, and stepping past that would be
     handing over goods on a promise the shop never accepted. */
  data.savedQuotes = [order({ agentUnpaid: true })];
  eq(ordersReadyToLeaveAwaitingGoods().length, 0,
    'an unpaid agent order stays put — arriving goods answered the goods question, not the money one');

  data.savedQuotes = [order({ status: 'draft' })];
  eq(ordersReadyToLeaveAwaitingGoods().length, 0, 'a draft is not moved — it is waiting on suppliers, not on goods');
  data.savedQuotes = [order({ status: 'preparing' })];
  eq(ordersReadyToLeaveAwaitingGoods().length, 0, 'nor is one already being prepared');
  data.savedQuotes = [order({ voided: true })];
  eq(ordersReadyToLeaveAwaitingGoods().length, 0, 'nor a voided one');

  // The move itself, and where it lands.
  moved.length = 0;
  data.savedQuotes = [order({ id: 7 })];
  const done = autoAdvanceReceivedOrders();
  eq(moved.length, 1, 'the ready order is moved');
  eq(moved[0][1], 'preparing', 'to Being Prepared, which is the next thing that happens to it');
  eq(done.length, 1, 'and it is reported back, so the receiving toast can say so');

  /* NOBODY IS ASSIGNED, on purpose: a worker's own app takes the oldest
     unassigned order in exactly this state, so the pick starts without
     the owner choosing a picker. Assigning one here would be the app
     making a staffing decision it has no basis for. */
  t.check(!data.savedQuotes[0].assignedWorkerId,
    'with no picker chosen — a worker’s app takes the oldest unassigned order in this state');

  eq(autoAdvanceNote([]), '', 'nothing moved says nothing');
  t.check(/Dad/.test(autoAdvanceNote(done)), 'one moved names the customer, so the owner can see which board changed');
  t.check(/2 orders/.test(autoAdvanceNote([1, 2])), 'several are counted rather than listed');
}

/* ---------- 2. the last confirmation moves the order, and says so ---- */
{
  const seen = { toasts: [], moves: [] };
  const data = { savedQuotes: [], suppliers: [] };
  const NAMES = ['setOrderSupplierConfirm'];
  const scope = compileScope(NAMES.map((n) => extractFunction(src, n, 'index.html')), {
    data,
    saveData: () => {},
    renderSavedQuotes: () => {},
    toast: (m) => seen.toasts.push(String(m)),
    quoteClientName: (q) => (q && q.client && q.client.name) || 'Walk-in',
    orderSupplierTerms: () => ({}),
    ORDER_STATUS_SHORT_LABELS: { awaiting_goods: 'Buying', preparing: 'Preparing' },
    /* Derived from what the function under test actually writes, so the
       order becomes ready BECAUSE of the confirmation rather than
       before it. */
    orderDraftReady: (q) => (q.suppliers || []).every((id) =>
      (q.supplierConfirms || {})[id] && q.supplierConfirms[id].state === 'confirmed'),
    /* The move is a collaborator here -- its own rules are exercised in
       2b -- so this records that it was asked, and moves the order the
       way the real one would. */
    orderLeaveDraft: (q, o) => { seen.moves.push([q.id, o]); q.status = 'awaiting_goods'; return true; },
  }, NAMES);
  const { setOrderSupplierConfirm } = scope;

  data.savedQuotes = [{ id: 3, status: 'draft', client: { name: 'Milly' }, suppliers: ['S1', 'S2'] }];
  setOrderSupplierConfirm(3, 'S1', 'confirmed');
  t.check(seen.moves.length === 0 && !seen.toasts.some((m) => /moved/.test(m)),
    'a confirmation that still leaves somebody outstanding moves nothing and says nothing');
  setOrderSupplierConfirm(3, 'S2', 'confirmed');
  eq(seen.moves.length, 1, 'the last one lands and the order is moved');
  t.check(!!(seen.moves[0][1] && seen.moves[0][1].auto === true), "marked as the app's own move, for the trail");
  t.check(seen.toasts.some((m) => /Milly/.test(m) && /moved to Buying/.test(m)),
    `the shop is told where it went (${JSON.stringify(seen.toasts)})`);
  t.check(seen.toasts.some((m) => /Announce it to the group when you like/.test(m)),
    'and that the group is a tap of theirs, not a gate');
  eq(data.savedQuotes[0].status, 'awaiting_goods', 'so it is no longer sitting in Draft afterwards');

  // Said once. Re-answering on an already-ready order is not news.
  seen.toasts.length = 0; seen.moves.length = 0;
  setOrderSupplierConfirm(3, 'S2', 'confirmed');
  t.check(seen.moves.length === 0 && seen.toasts.length === 0,
    'an order that was already ready is not moved or announced again on every later answer');
}

/* ---------- 2b. the move itself -------------------------------------- */
{
  const seen = { statuses: [] };
  const mk = (over) => Object.assign({ id: 5, status: 'draft' }, over);
  const leave = compileScope([extractFunction(src, 'orderLeaveDraft', 'index.html')], {
    orderDraftReady: (q) => !!q.ready,
    agentPaymentBlocksPreparing: (q) => !!q.unpaid,
    orderAwaitsGoods: (q) => !!q.incoming,
    setSavedQuoteStatus: (id, st, o) => seen.statuses.push([id, st, o]),
  }, ['orderLeaveDraft']).orderLeaveDraft;
  let m;
  t.check(leave(mk({ ready: true, incoming: true }), { auto: true }) === true && (m = seen.statuses.pop()) && m[1] === 'awaiting_goods' && m[2].auto === true,
    'a ready draft with goods to fetch goes to Buying, as the app\'s own move');
  t.check(leave(mk({ ready: true }), { auto: true }) === true && seen.statuses.pop()[1] === 'preparing',
    'and one with nothing to fetch steps over Buying to Preparing, as the arrow does');
  t.check(leave(mk({ ready: false }), { auto: true }) === false && seen.statuses.length === 0,
    'a draft still waiting on a supplier is not moved');
  t.check(leave(mk({ ready: true, unpaid: true }), { auto: true }) === false && seen.statuses.length === 0,
    "nor a prepay agent's order before the money is recorded -- the gate holds either way");
  t.check(leave(mk({ ready: true, status: 'preparing' }), { auto: true }) === false, 'and an order past Taken is left alone');
  leave(mk({ ready: true }), { auto: false });
  t.check(seen.statuses.pop()[2].auto === false, "the owner's own tap is recorded as theirs, not the app's");
}

/* ---------- 3. an order past its limit reaches out ------------------ */
{
  const data = { savedQuotes: [], presetOrderStageLimits: {}, presetStageAlerts: true };
  const NAMES = ['stageAlertsDue'];
  const scope = compileScope([
    extractDeclaration(src, 'SQ_STATUSES', 'index.html'),
    extractDeclaration(src, 'SQ_STATUS_ORDER', 'index.html'),
    extractFunction(src, 'orderStageOverdue', 'index.html'),
    ...NAMES.map((n) => extractFunction(src, n, 'index.html')),
  ], {
    data,
    quoteAgedOffBoard: () => false,
  }, NAMES);
  const { stageAlertsDue } = scope;

  const NOW = 1000000000;
  const MIN = 60000;
  data.presetOrderStageLimits = { preparing: 60 };
  const q = (over) => Object.assign({
    id: 1, status: 'preparing', voided: false, stageEnteredAt: NOW - 90 * MIN,
  }, over);

  data.savedQuotes = [q({})];
  eq(stageAlertsDue(NOW, {}).length, 1, 'an order 90 minutes into a 60-minute step is due a word');
  eq(stageAlertsDue(NOW, { ['1:' + (NOW - 90 * MIN)]: 1 }).length, 0,
    'and is not mentioned twice for the same wait');

  /* The key carries stageEnteredAt, so an order pushed back and pulled
     forward again is a NEW wait. Keyed on the id alone, a re-picked
     order would go quiet for ever. */
  data.savedQuotes = [q({ stageEnteredAt: NOW - 80 * MIN })];
  eq(stageAlertsDue(NOW, { ['1:' + (NOW - 90 * MIN)]: 1 }).length, 1,
    'but a fresh wait in the same step is news again');

  data.savedQuotes = [q({ stageEnteredAt: NOW - 30 * MIN })];
  eq(stageAlertsDue(NOW, {}).length, 0, 'inside the limit, nothing is said');
  data.savedQuotes = [q({ status: 'completed' })];
  eq(stageAlertsDue(NOW, {}).length, 0, 'a finished order has no step left to be late in');
  data.savedQuotes = [q({ voided: true })];
  eq(stageAlertsDue(NOW, {}).length, 0, 'nor a voided one');

  data.presetOrderStageLimits = {};
  data.savedQuotes = [q({})];
  eq(stageAlertsDue(NOW, {}).length, 0, 'and with no limit set there is nothing to be past — the flag was always opt-in');

  // Oldest first: if only one line fits in a message, it should be the worst.
  data.presetOrderStageLimits = { preparing: 60 };
  data.savedQuotes = [q({ id: 1, stageEnteredAt: NOW - 70 * MIN }), q({ id: 2, stageEnteredAt: NOW - 300 * MIN })];
  eq(stageAlertsDue(NOW, {})[0].id, 2, 'the longest-waiting order is named first');
}

/* ---------- 4. the wiring, and the honesty around it ---------------- */
{
  t.check(/if\(!document\.hidden\) runStageAlerts\(\);/.test(code),
    'the check rides a timer that does not care which screen is open — an alert that only fires while you watch the board is the flag again');
  t.check(/const advanced = autoAdvanceReceivedOrders\(\);/.test(code),
    'receiving goods advances what it made ready');
  /* Counted as the call form, because the function's own definition
     carries the bare name too — measured loosely, deleting one of the
     two call sites still left a count of two. */
  eq((code.match(/const advanced = autoAdvanceReceivedOrders\(\);/g) || []).length, 2,
    'from BOTH doors goods come in through — the buying list and a checked-in trip');
  t.check(/autoAdvanceNote\(advanced\)/.test(code),
    'and the toast says what moved, so a card never changes column in silence');

  /* Off by default. An alert nobody asked for is an interruption, and
     the limits themselves ship unset. */
  t.check(/presetStageAlerts: !!presets\.stageAlerts,/.test(code), 'the setting is off until it is switched on');
  t.check(/stageAlerts:!!d\.presetStageAlerts/.test(code), 'and it is saved, or it would forget every reload');
  t.check(/if\(!data\.presetStageAlerts\) return \[\];/.test(code), 'and nothing fires while it is off');

  /* Asked at the tick, not at boot: a permission prompt at somebody who
     never asked for notifications earns Block, which is hard to undo. */
  /* The listener, not the first mention of the id — renderStageAlertToggle
     reads the same element a few lines earlier, and slicing from there
     measured the wrong function entirely. */
  const handler = code.slice(code.indexOf("getElementById('preset_stage_alerts').addEventListener"));
  t.check(/Notification\.requestPermission\(\)/.test(handler.slice(0, 900)),
    'permission is asked for when the setting is switched on, not at boot');
  t.check(/Notification\.permission === 'default'/.test(handler.slice(0, 900)),
    'and only when it has never been answered, so a Block is not re-asked every time');

  // The limit is stated where the promise is made, not only in a commit.
  t.check(/Only while the app is open/.test(src),
    'the setting says plainly that a closed browser cannot be reached');
  t.check(/Nothing to go past yet/.test(code),
    'and switching it on with no limits set says so rather than going quietly nowhere');
}

/* ---------- 5. what is still the owner's ---------------------------- */
/* Guarded because these are the ones worth NOT automating, and a later
   change that quietly opened one should have to argue with a test. */
{
  t.check(!/autoAdvance[A-Za-z]*\(\)/.test(code.slice(code.indexOf('function toggleQuoteInvoiced'),
    code.indexOf('function toggleQuoteInvoiced') + 3000)),
    'invoicing is not automated — it moves stock and money in one act');
  const draftGate = code.slice(code.indexOf("if(dir>0 && q.status==='draft'"));
  t.check(/orderDraftReady\(q\)/.test(draftGate.slice(0, 400)),
    'leaving Draft still requires every supplier to have confirmed');
  t.check(!/setSavedQuoteStatus\([^)]*'completed'\)/.test(code),
    'and nothing moves an order to Completed on its own — "probably delivered by now" is a guess written as a fact');
  /* The hand-off to the sales group is an owner's tap, never a move's
     side effect: nothing in the status setter opens a window. */
  const setter = extractFunction(src, 'setSavedQuoteStatus', 'index.html');
  t.check(!/shareOrderToSalesGroup|window\.open|SALES_GROUP_WA_LINK/.test(setter),
    'moving an order never tells the group by itself');
  t.check(/shareOrderToSalesGroup\(q\);\s*q\.announcedAt = Date\.now\(\);/.test(extractFunction(src, 'announceOrderToGroup', 'index.html')),
    'the group is told by announceOrderToGroup, which stamps when');
  eq((code.match(/shareOrderToSalesGroup\(/g) || []).length, 2, 'and that is its only caller besides its own definition');
}

process.exit(t.done() ? 1 : 0);
