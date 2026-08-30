#!/usr/bin/env node
'use strict';
/*
 * A move must name what it is about.
 *
 * The weekly review's own rulebook calls collected_after_chases "the
 * headline". That figure was structurally guaranteed to be zero, and
 * the break ran through six honest steps:
 *
 *   1. the meeting is told to call shop_pulse for the whole position;
 *   2. shop_pulse returned NAMES and no ids — "Milly owes 840,000";
 *   3. the plan block rightly refuses an id no tool returned, and says
 *      "omit subject entirely when you have none";
 *   4. so a meeting obeying its own prompt saved every chase with
 *      subject: {};
 *   5. deriveMoveOutcome fell through every branch — money 0,
 *      derived null;
 *   6. the week added zeros together and called it the headline.
 *
 * Every step was correct. The reading was starved one line upstream of
 * all of them, and the figure that came out the far end was quoted to
 * the owner as evidence their manager's advice was not landing. It was
 * not evidence of anything. The shop had collected 24,431,660 that week.
 *
 * purchase_plan learned this lesson once already and wrote it down:
 * "Without it a mind reading this plan could name a line in prose and
 * never point at it." shop_pulse — the one tool a meeting is TOLD to
 * read — never did.
 *
 * The laws this file guards:
 *
 *   THE ID RESOLVES     every id shop_pulse emits is fed back through
 *                       deriveMoveOutcome here and must ANSWER. A key
 *                       spelled "P001::" where the stock log says
 *                       "P001" matches nothing, silently — the exact
 *                       failure dashAlerts already paid for once.
 *   NAMES ITSELF        a move whose kind the books CAN answer but
 *                       which named nobody says so, on the card and in
 *                       the review. It never again contributes a silent
 *                       zero indistinguishable from "earned nothing".
 *   LIKE WITH LIKE      one customer is credited once a week, however
 *                       many meetings chased them.
 *   NEVER A BARE ZERO   when nothing could be attributed, the tool says
 *                       so instead of reporting 0.
 *   RUN IT, DON'T READ IT  these checks call the tools.
 *
 * Run: node test/manager-subjects.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('a move must name what it is about');
const src = read('index.html');
const api = read('api/assistant.js');
const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);

const TODAY = '2026-08-28';
const shift = (iso, n) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

/* The books behind every id this file hands back. Each record exists so
   that one derivation has something true to find: Milly's payment
   carries a cashTxnId (an invoice sync's echo row does not, and is not
   money); the restock is logged under a stockKey; the order is on file
   and not invoiced; the supplier was paid. */
const books = () => ({
  customers: [
    { id: 7, name: 'Milly', debt: 840000, debtLog: [
      { type: 'payment', amount: 300000, date: '2026-08-26', cashTxnId: 'T1' },
      { type: 'payment', amount: 999000, date: '2026-08-26' },
    ] },
    /* A DIFFERENT SUM, deliberately. If both debtors had paid the same
       amount, an id that fetched the wrong ledger would answer
       correctly by accident and the join would look sound. */
    { id: 8, name: 'Dad', debt: 1436000, debtLog: [
      { type: 'payment', amount: 120000, date: '2026-08-26', cashTxnId: 'T2' },
    ] },
  ],
  stockLog: [{ key: 'D1', type: 'restock', date: '2026-08-27' }],
  /* Dad's two orders sit in 2024 on purpose: whatever day this suite is
     run, he is long overdue against his own ten-day rhythm, so the real
     dashGoingQuietCustomers has somebody to flag without the test ever
     having to freeze the clock. */
  savedQuotes: [{ id: 'Q9', invoiced: false },
    { id: 'Q1', client: { name: 'Dad' }, savedAt: '2024-01-01T08:00:00Z' },
    { id: 'Q2', client: { name: 'Dad' }, savedAt: '2024-01-11T08:00:00Z' }],
  /* Two open bills from S3 — one the owner has named a day for and one
     they have not — plus the payment that makes a settle move derivable.
     The dated one is what who_you_owe must hand back with its supplierId
     attached; the undated one is what must NOT reach the cash line. */
  purchaseInvoices: [
    { id: 'PINV-1', supplierId: 'S3', date: '2026-08-01', dueDate: '2026-09-05',
      items: [{ qty: 1, price: 400000 }], amountPaid: 0,
      payments: [{ date: '2026-08-27', amount: 5000 }] },
    { id: 'PINV-2', supplierId: 'S3', date: '2026-07-10',
      items: [{ qty: 1, price: 900000 }], amountPaid: 0, payments: [] },
  ],
  presetReorderRules: { D1: { min: 4 } },
  cashTxns: [], products: [], prices: [],
  presetOrderStageLimits: {},
});

/* ---------- 1. the gap names itself, and only when it is a gap ------- */
{
  const data = books();
  const derive = compileScope([extractFunction(src, 'deriveMoveOutcome', 'index.html')],
    { data, fmtUGX: (n) => String(n), Math, Number, String, Object, Array },
    ['deriveMoveOutcome']).deriveMoveOutcome;

  const move = (mkind, subject) => derive({ date: '2026-08-25', status: 'open', body: { mkind, subject } });

  /* Named, and the books answer. */
  const named = move('chase', { customerId: 7 });
  eq(named.unmeasured, null, 'a chase that named its customer is measurable');
  eq(named.money, 300000,
    'and only the payment carrying a cash link is money — the echo row is bookkeeping, not collection');
  eq(named.derived, 'paid 300000 since', 'the books answer in words too');

  /* Unnamed, and the gap speaks — in the owner's language, naming the
     thing that is missing rather than showing a blank. */
  const KINDS = [['chase', 'customer'], ['buy', 'line'], ['invoice', 'order'],
    ['settle', 'supplier'], ['policy', 'line']];
  KINDS.forEach(([kind, thing]) => {
    const out = move(kind, {});
    eq(out.unmeasured, `nothing measures it — it named no ${thing}`,
      `a ${kind} move with no subject says what it failed to name`);
    eq(out.derived, null, `and derives nothing, honestly (${kind})`);
    eq(out.money, 0, `and contributes no money (${kind})`);
  });
  eq(move('chase', undefined).unmeasured, 'nothing measures it — it named no customer',
    'a move saved with no subject key at all is the same gap, not a crash');
  /* A BLANK IS UNNAMED. The buy and policy branches already refuse an
     empty key, so a guard that accepted one would call the move
     measurable and then measure nothing — the silent zero again, by a
     different door. */
  eq(move('buy', { key: '' }).unmeasured, 'nothing measures it — it named no line',
    'an empty key is not a name');
  eq(move('settle', { supplierId: '' }).unmeasured, 'nothing measures it — it named no supplier',
    'nor an empty supplier');

  /* A CUSTOMER WHO IS NO LONGER ON FILE DID NOT REFUSE TO PAY. The
     invoice branch has always said "order no longer on file"; the chase
     branch reported a deleted card as "no payment seen since", which
     reads as a debtor ignoring every chase. */
  eq(move('chase', { customerId: 999 }).derived, 'that customer is no longer on file',
    'a chase whose customer has gone from the books says so, rather than blaming them');
  eq(move('chase', { customerId: 999 }).unmeasured, null,
    'and it is not a naming gap — the move named somebody, the books lost them');

  /* A KIND NOTHING DERIVES IS NOT A GAP. price and other have no
     derivation anywhere in this app and never will from a subject id:
     saying "nothing measures it" on those cards every single day would
     train the eye to skip the line, and the line that matters is the
     repairable one. */
  ['price', 'other'].forEach((kind) => {
    eq(move(kind, {}).unmeasured, null,
      `a ${kind} move is a known limit, not a hole in the record — it stays silent`);
  });

  /* Every kind the plan block offers is accounted for here: one that
     grew a derivation without a needs entry would go on reporting a
     silent zero, which is the whole defect this file exists for. */
  const kinds = /kind is one of: ([a-z, ]+)\./.exec(api);
  t.check(!!kinds, 'the prompt names the kinds a move may be');
  const said = kinds[1].split(',').map((x) => x.trim());
  eq(said.filter((k) => KINDS.some(([n]) => n === k) || k === 'price' || k === 'other').length,
    said.length, `every kind the prompt offers is judged here (${said.join(', ')})`);
}

/* ---------- 2. THE JOIN: every id the reading emits resolves --------- */
{
  const data = books();
  /* Compiled over the same books, so the reading's customerId comes out
     of the real function rather than being handed in by a fixture. */
  const goingQuiet = compileScope([extractFunction(src, 'dashGoingQuietCustomers', 'index.html')],
    { data, Date, Math, Number, String, Array, Object }, ['dashGoingQuietCustomers']).dashGoingQuietCustomers;
  const env = {
    data,
    todayISO: () => TODAY, anShiftDate: shift,
    apRound: (n) => Math.round(Number(n) || 0),
    fmtUGX: (n) => String(n),
    /* The dead line runs through the REAL stockAgeRows/deadStockRows, so
       its key is spelled by stockKey and not by hand. That spelling is
       the whole point: anRowsByItem writes "D1::" for the same line and
       the stock log would match neither. */
    allProductVariantEntries: () => [{ p: { id: 'D1', name: 'Sitting Still' }, variantIdx: null }],
    stockKey: (pid, vi) => (vi == null || vi === '') ? pid : `${pid}::${vi}`,
    getStockQty: () => 7, getFIFOUnitCost: () => 30000,
    rankedPriceRows: () => [], purchasePriceAtQty: () => null,
    productDisplayLabel: (p) => (p && p.name) || '',
    buyKeyParts: (k) => ({ productId: String(k).split('::')[0],
      variantIdx: String(k).indexOf('::') < 0 ? null : Number(String(k).split('::')[1]) }),
    waSalesByKey: () => new Map([['D1', { units30: 5, sales30: 500000, profit30: 10000,
      wholesaleUnits30: 5, retailUnits30: 0, estQty30: 0 }]]),
    /* A 100,000 line sold at 105,000 on a +5,000 fixed rule: 4.8% kept
       against a 10% mark, so it is under target and the block has a row
       to judge. The same arithmetic the owner's own top line does. */
    ourCostFor: () => ({ product: { id: 'D1', name: 'Sitting Still' }, variantIdx: null,
      cost: 100000, packQty: 1, packUnit: '', unit: 'pc', supplier: 'Roto' }),
    ourPriceFor: () => 105000,
    marginRuleFor: () => ({ type: 'fixed', value: 5000, source: 'default' }),
    daysSinceDate: () => 0, contactPhones: () => [],
    dashboardContext: () => ({ inv: { deadValue: 1, deadQty: 1 },
      grossProfit: 0, netProfit: 0, opex: 0, burn: 0, runwayMonths: null,
      totals: { sales: 0, estimatedQty: 0 }, itemRows: [],
      concentration: [], inflation: [],
      /* THE REAL ONE, not a stub that hands the id in. Both of these
         throw their customer id away one line early if nobody is
         watching, and shop_pulse would then emit customerId: undefined
         in production while a stubbed fixture reported everything
         well. */
      goingQuiet: goingQuiet(),
      invoices: [{ client: { name: 'Milly' }, items: [] }],
      stockOut: [{ key: 'D1', name: 'Sitting Still', qty: 2, daysLeft: 3, dailyRate: 1 }] }),
    anInvoiceTotals: () => ({ sales: 900000, cost: 810000, qty: 3, estimatedQty: 0 }),
    supplierName: () => 'Roto',
    purchaseInvoiceTotal: (pi) => (pi.items || []).reduce((n, i) => n + i.qty * i.price, 0),
    purchaseInvoiceBalanceDue: (pi) => (pi.items || []).reduce((n, i) => n + i.qty * i.price, 0)
      - (Number(pi.amountPaid) || 0),
    agingBandFor: () => 'b30',
    agingDaysLabel: (n) => n + ' days',
    uncostedStockRows: () => [],
    dashAlerts: () => [],
    debtChaseRows: () => ({
      due: [{ id: 7, name: 'Milly', debt: 840000, ageDays: 62 },
        { id: 8, name: 'Dad', debt: 1436000, ageDays: 40, brokenPromises: 2,
          promise: { promisedOn: '2026-08-20', madeOn: '2026-08-12', amount: null, state: 'broken' } }],
      resting: [], blocked: [],
      promised: [{ id: 8, name: 'Dad', debt: 1436000, ageDays: 59, brokenPromises: 0,
        promise: { promisedOn: '2026-09-20', madeOn: '2026-08-27', amount: null, state: 'waiting' } }],
      graceDays: 7, restDays: 3 }),
    purchasePlan: () => ({ lines: [{ key: 'D1', supplierId: 'S3', name: 'Sitting Still',
      reason: 'out now', cost: 400000, supplier: 'Roto' }], didNotFit: [], sourceFirst: [] }),
    cashOnHandByAccount: () => ({ total: 100, byAccount: [] }),
    CASH_AHEAD_DAYS: 30,
    cashAhead: () => ({ days: 30, commitments: [], committed: 0, unknown: 0, promised: [],
      promisedTotal: 0, safeToSpend: 100, tightest: { date: TODAY, balance: 100 } }),
    consignmentRows: () => [],
    morningBriefData: () => ({ sales: { total: 0, count: 0, profit: 0, estimated: false },
      cash: { counted: false }, paid: { total: 0, count: 0 }, ranOutCount: 0,
      stuck: [{ id: 'Q9', name: 'Kevin', statusLabel: 'Being Prepared', overMinutes: 90 }] }),
    priceReviewCandidates: () => [],
    followUpClientsToContact: () => [{ customerId: 7, name: 'Milly', hasNews: true }],
    SQ_STATUS_ORDER: ['draft', 'completed'],
    Date, JSON, Math, Number, String, Array, Object,
  };
  const scope = compileScope([
    extractDeclaration(src, 'ASSISTANT_TOOLS', 'index.html'),
    extractFunction(src, 'deriveMoveOutcome', 'index.html'),
    extractFunction(src, 'anRowsByCustomer', 'index.html'),
    /* The supplier side, WHOLE rather than stubbed: whether the
       supplierId who_you_owe hands back is one deriveMoveOutcome can
       follow is exactly what this file is for. */
    extractFunction(src, 'credDueRows', 'index.html'),
    extractFunction(src, 'credOpenInvoices', 'index.html'),
    extractFunction(src, 'billDueDate', 'index.html'),
    extractFunction(src, 'marginRows', 'index.html'),
    extractFunction(src, 'ruleYieldPct', 'index.html'),
    extractFunction(src, 'marginTargetPrice', 'index.html'),
    extractFunction(src, 'targetMarginPct', 'index.html'),
    extractDeclaration(src, 'THIN_MARGIN_PCT', 'index.html'),
    extractFunction(src, 'stockAgeRows', 'index.html'),
    extractFunction(src, 'deadStockRows', 'index.html'),
    extractFunction(src, 'deadStockBuyers', 'index.html'),
    extractFunction(src, 'deadStockQuietDays', 'index.html'),
    'function names(){ return { ASSISTANT_TOOLS, deriveMoveOutcome }; }',
  ], env, ['names']);
  const N = scope.names();
  const pulse = N.ASSISTANT_TOOLS.shop_pulse.run();

  /* Where the reading names one thing, and which subject key that thing
     travels under. Grouped by the kind of move it would feed, because
     that — not the block's name — is what decides whether the books can
     ever answer it. */
  /* EVERY FIXTURE ABOVE IS ARRANGED SO THE ANSWER IS YES, and the yes
     is what gets asserted. "not restocked yet" is a perfectly
     well-formed sentence about a key that does not exist anywhere —
     checking merely that SOME answer came back let a key misspelled
     "D1::" sail straight through when this was first written. The
     books must actually FIND the thing the reading pointed at. */
  const FOUND = {
    /* Keyed by the id, so this asserts the reading led to THAT
       customer's ledger and not merely to a customer's ledger. */
    chase: (id) => (String(id) === '7' ? 'paid 300000 since' : 'paid 120000 since'),
    buy: () => 'restocked since',
    invoice: () => 'still not invoiced',
    settle: () => 'a payment went to them since',
    policy: () => 'a standing rule now covers it',
  };
  const CLAIMS = [
    ['chase', 'customerId', 'debts.chase_now', pulse.debts.chase_now],
    ['chase', 'customerId', 'debts.waiting_on_a_promise', pulse.debts.waiting_on_a_promise],
    ['chase', 'customerId', 'debts.broke_their_word', pulse.debts.broke_their_word],
    ['chase', 'customerId', 'going_quiet', pulse.going_quiet],
    ['chase', 'customerId', 'best_customers', pulse.best_customers],
    ['chase', 'customerId', 'follow_ups_due', pulse.follow_ups_due],
    ['buy', 'key', 'buying.top_lines', pulse.buying.top_lines],
    ['buy', 'key', 'running_out_soon', pulse.running_out_soon],
    ['buy', 'key', 'dead_stock.worst_lines', pulse.dead_stock.worst_lines],
    ['policy', 'key', 'margin.worst_lines', pulse.margin.worst_lines],
    ['invoice', 'orderId', 'orders_sitting_too_long', pulse.orders_sitting_too_long],
    ['settle', 'supplierId', 'buying.top_lines', pulse.buying.top_lines],
    /* THE FOURTH SUBJECT TYPE. A settle move has had a derivation since
       the Manager was built and the reading never named a supplier to
       point one at, so no advice about paying anybody could ever be
       weighed. */
    ['settle', 'supplierId', 'who_you_owe.due_in_the_window', pulse.who_you_owe.due_in_the_window],
    ['settle', 'supplierId', 'who_you_owe.biggest_with_no_day', pulse.who_you_owe.biggest_with_no_day],
  ];
  const answer = (kind, idKey, id) => N.deriveMoveOutcome({ date: '2026-08-25', status: 'open',
    body: { mkind: kind, subject: { [idKey]: id } } });
  CLAIMS.forEach(([kind, idKey, where, rows]) => {
    t.check(Array.isArray(rows) && rows.length > 0,
      `${where} has rows to judge — a claim checked over nothing passes for the wrong reason`);
    (rows || []).forEach((r) => {
      t.check(r[idKey] != null, `${where} names its ${idKey}, not only a name`);
      /* THE ASSERTION THIS FILE IS FOR. Not "an id is present" and not
         "an answer came back" — the id the reading handed out leads the
         books to the very record that was put there for it. */
      const out = answer(kind, idKey, r[idKey]);
      eq(out.unmeasured, null,
        `and a ${kind} move built from ${where}'s ${idKey} is measurable`);
      eq(out.derived, FOUND[kind](r[idKey]),
        `and the books FIND what ${where} pointed at (${where} → ${kind})`);
    });
  });

  /* And the check above is proved discriminating: nudge each id by one
     character — the "P001::" against "P001" mismatch, in miniature —
     and every one of these answers must change. A test that cannot fail
     is not a guard. */
  CLAIMS.forEach(([kind, idKey, where, rows]) => {
    const first = (rows || [])[0][idKey];
    const bent = answer(kind, idKey, String(first) + '::');
    t.check(bent.derived !== FOUND[kind](first),
      `a ${idKey} off by one character answers differently — so the check above can fail (${where})`);
  });

  /* The id is spelled the way the plan block spells it, so the model
     COPIES it. A reading that said customer_id would need translating,
     and a translation step is the defect being repaired. */
  t.check('customerId' in pulse.debts.chase_now[0] && !('id' in pulse.debts.chase_now[0]),
    'the reading uses the subject’s own word — customerId, not id');

  /* And the money still lands where it should when the chase is real. */
  const real = N.deriveMoveOutcome({ date: '2026-08-25', status: 'open',
    body: { mkind: 'chase', subject: { customerId: pulse.debts.chase_now[0].customerId } } });
  eq(real.money, 300000, 'chasing the first name on the list is worth what the ledger says it was');

  /* AND THE BLOCKS THAT NAME NO ONE THING STAY OUT OF IT. An alert is a
     situation — "cash is overdrawn", "62% of the shelf is dead" — and
     most carry no single subject at all. A partial set of ids there
     would teach the mind that an alert without one has none. */
  t.check(!/alerts: dashAlerts\(dctx\)[\s\S]{0,200}customerId/.test(src),
    'alerts carry no subject id — they name a situation, and the block beneath names the subject');
}

/* ---------- 3. the week: one customer once, and never a bare zero ---- */
{
  const move = (id, date, subject) => ({ id, date, status: 'done',
    body: { title: 'Chase Milly', mkind: 'chase', subject } });
  const run = async (moves, tool) => {
    const journal = { meeting: [{ id: 1, date: '2026-08-24', body: { keyline: 'k' } }],
      move: moves.map((m) => ({ ...m, meeting_id: 1 })),
      question: [], target: [], review: [], play: [] };
    const sb = { from: () => { const q = { _kind: null };
      q.select = () => q; q.order = () => q; q.in = () => q; q.gte = () => q; q.lte = () => q;
      q.eq = (c, v) => { if (c === 'kind') q._kind = v; return q; };
      q.limit = () => Promise.resolve({ data: journal[q._kind] || [], error: null });
      q.then = (res) => res({ data: journal[q._kind] || [], error: null });
      return q; } };
    const s = compileScope([
      extractDeclaration(src, 'ASSISTANT_TOOLS', 'index.html'),
      extractFunction(src, 'deriveMoveOutcome', 'index.html'),
      extractFunction(src, 'managerScoreboard', 'index.html'),
      extractFunction(src, 'managerScoreProgress', 'index.html'),
      extractFunction(src, 'managerRecentReviews', 'index.html'),
      extractFunction(src, 'managerReviewBrief', 'index.html'),
      extractFunction(src, 'managerAdviceTally', 'index.html'),
      extractFunction(src, 'managerPlaybook', 'index.html'),
      extractFunction(src, 'managerPlayProgress', 'index.html'),
      extractFunction(src, 'buyHoldsStanding', 'index.html'),
      extractFunction(src, 'buyHoldFor', 'index.html'),
      extractFunction(src, 'buyKeyLabel', 'index.html'),
      extractDeclaration(src, 'MANAGER_PROBLEMS', 'index.html'),
      extractDeclaration(src, 'MANAGER_METRICS', 'index.html'),
      extractDeclaration(src, 'MANAGER_PROBLEM_METRICS', 'index.html'),
      'function names(){ return { ASSISTANT_TOOLS }; }',
    ], {
      data: books(), managerNotesTable: true, rivalPricesTable: false,
      currentShopId: 'shop-1', sb,
      todayISO: () => TODAY, anShiftDate: shift, apRound: (n) => Math.round(Number(n) || 0),
      fmtUGX: (n) => String(n),
      daysSinceDate: () => 1,
      anInvoicesInRange: () => [], anOverallTotals: () => ({ sales: 0, profit: 0, count: 0, estimatedQty: 0 }),
      debtCollectionsOn: () => ({ total: 0 }), cashIsMoneyIn: () => true,
      dashInventoryHealth: () => ({ deadValue: 0, deadQty: 0 }),
      cashOnHandByAccount: () => ({ total: 0, byAccount: [] }),
      booksStartDate: () => '2026-01-01',
      console, Date, JSON, Math, Number, String, Array, Object, Promise,
    }, ['names']);
    return s.names().ASSISTANT_TOOLS[tool || 'week_review_data'].run({});
  };

  (async () => {
    /* ONE CUSTOMER, ONE COUNT. Two meetings, both chasing Milly. Her
       ledger holds one 300,000 payment. Counting it twice would report
       600,000 of collections the shop never made — and would do it
       precisely because the repair started working. */
    const twice = await run([move(1, '2026-08-24', { customerId: 7 }),
      move(2, '2026-08-26', { customerId: 7 })]);
    eq(twice.advice.collected_after_chases, 300000,
      'one customer is credited once a week, however many meetings chased them');
    eq(twice.advice.chases_advised, 2, 'while both chases are still counted as advice given');
    eq(twice.advice.customers_chased, 1, 'and the week says how many people that was');
    eq(twice.advice.chases_not_measurable, 0, 'with none of them unattributable');
    t.check(!('collected_after_chases_cannot_be_read' in twice.advice),
      'a week that could be read carries no warning that it could not');

    /* THE ZERO THAT WAS NOT A FACT. Every chase saved with an empty
       subject: the honest answer is not 0, it is "this cannot be read",
       and the tool must say which. */
    const blind = await run([move(1, '2026-08-24', {}), move(2, '2026-08-26', {})]);
    eq(blind.advice.collected_after_chases, 0, 'nothing can be attributed');
    eq(blind.advice.chases_not_measurable, 2, 'and the week says both chases named nobody');
    eq(blind.advice.customers_chased, 0, 'so no customer was credited');
    t.check(/gap in the record, not a week with nothing collected/.test(
      blind.advice.collected_after_chases_cannot_be_read || ''),
      'and the zero comes with a sentence forbidding it from being quoted as a fact');
    t.check(/this_week\.collected/.test(blind.advice.collected_after_chases_cannot_be_read || ''),
      'pointing at the figure that IS true — what the shop actually took in');
    eq(blind.advice.moves_nothing_can_measure, 2, 'and the unmeasurable moves are counted');
    eq(blind.advice.moves[0].cannot_be_measured, 'nothing measures it — it named no customer',
      'each one saying, by name, what it failed to name');

    /* AND THE MEETING READS IT BACK. manager_history is what the next
       morning opens with; a move that went unweighed because it named
       nobody has to reach the mind that will otherwise repeat the
       omission tomorrow. */
    const past = await run([move(1, '2026-08-24', {})], 'manager_history');
    eq(past.meetings[0].moves[0].cannot_be_measured, 'nothing measures it — it named no customer',
      'the next meeting is told which of its own past moves nothing could weigh');
    const weighed = await run([move(1, '2026-08-24', { customerId: 7 })], 'manager_history');
    t.check(!('cannot_be_measured' in weighed.meetings[0].moves[0]),
      'and a move that named its customer is not flagged');
    eq(weighed.meetings[0].moves[0].what_the_books_say, 'paid 300000 since',
      'it carries what the books say instead');

    /* And a week with no chases at all is neither: nothing to warn about. */
    const quiet = await run([]);
    t.check(!('collected_after_chases_cannot_be_read' in quiet.advice),
      'a week that advised no chases is not warned about unreadable ones');
    eq(quiet.advice.chases_advised, 0, 'it simply advised none');

    /* ---------- 4. the owner sees it, not just the model ------------- */
    /* RENDERED, not regexed. The first draft of this check read the
       source for the push and passed happily when the condition around
       it was mutated to if(false) — the card would have gone silent and
       the suite would have said nothing. */
    {
      const view = compileScope([
        extractFunction(src, 'mgrMoveView', 'index.html'),
        extractFunction(src, 'deriveMoveOutcome', 'index.html'),
        extractDeclaration(src, 'MANAGER_DOORS', 'index.html'),
        extractDeclaration(src, 'MANAGER_WORTH_BASES', 'index.html'),
      ], { data: books(), esc: (x) => String(x == null ? '' : x)
          .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
        fmtUGX: (n) => String(n), Math, Number, String, Object, Array },
        ['mgrMoveView']).mgrMoveView;
      const card = (subject) => view({ id: 5, date: '2026-08-25', status: 'open',
        body: { title: 'Chase Milly today', why: 'Owes 840,000', mkind: 'chase',
          door: 'chase', subject } }, 0);

      t.check(/nothing measures it — it named no customer/.test(card({})),
        'the move card says it too — the owner is the only one who can see the move plainly WAS about Milly');
      const named = card({ customerId: 7 });
      t.check(!/nothing measures it/.test(named),
        'and a move that named its customer carries no such warning');
      t.check(/paid 300000 since/.test(named),
        'it carries what the books say instead');
    }

    /* ---------- 5. the rulebook asks for it -------------------------- */
    {
      t.check(/omit subject ONLY when the reading gave you none/.test(api),
        'omitting the subject is the last resort, not the default it read as');
      t.check(/an unnamed move can never be measured/.test(api),
        'and the rule carries its reason');
      t.check(/EVERY ROW THAT NAMES ONE THING CARRIES ITS ID/.test(api),
        'shop_pulse says in its own description that it hands the ids back');
      t.check(/Copy that id straight into a move’s subject/.test(api),
        'and tells the mind exactly what to do with one');
      t.check(/counted ONCE per customer from the earliest move that named them/.test(api),
        'week_review_data says how its headline is counted, so the review cannot misread it');
      t.check(/collected_after_chases_cannot_be_read/.test(api),
        'and the review is told never to quote a zero it cannot read');
      t.check(/that is a gap in the record, never a move that earned nothing/.test(api),
        'the difference between "nothing came of it" and "nothing could weigh it" is stated in as many words');
    }
  })().then(() => {
    process.exit(t.done() ? 1 : 0);
  }).catch((e) => { console.error(e); process.exit(1); });
}
