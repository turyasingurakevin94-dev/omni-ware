#!/usr/bin/env node
'use strict';
/*
 * Out of the ordinary: the fortnight's pulse, its findings, the likely
 * reasons, and what the owner teaches it.
 *
 * The section reads eleven signals a day from the books -- sales, cash
 * in, quotes created, WhatsApp orders, purchases (by the day the goods
 * came), returns, the till, fuel, deliveries, margin and stock counted
 * short -- and sets each day against this shop's own usual for that
 * weekday (the unusual detector's median and robust spread). A day far
 * out is a finding, toned by a table (problem or good news), sized by its
 * gap from usual and ranked on a five-step rarity scale; each finding's
 * likely reasons are questions put to the books, answered "found",
 * "not found" or "not checked", never as a percentage and never as the
 * cause; an answer can teach a normal the pulse then applies.
 *
 * Every expectation below is worked out by hand on a small book built
 * here, with the arithmetic in the comment beside it.
 *
 * Run: node test/manager-unusual-pulse.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('manager unusual pulse');
const src = read('index.html');
const eq = (a, b, m) => t.check(JSON.stringify(a) === JSON.stringify(b),
  `${m}${JSON.stringify(a) === JSON.stringify(b) ? '' : ` — got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`}`);
const near = (a, b, m, tol) => t.check(typeof a === 'number' && Math.abs(a - b) <= (tol || 1e-6), `${m} — got ${a}, want ${b}`);

/* The whole Unusual block, compiled as the app runs it. Its two click
   listeners need a document; nothing here clicks. */
const B0 = src.indexOf('/* ═══ MGR BED: Unusual — begin ═══ */', src.indexOf('<script>\n', src.indexOf('sourcing-console.js')));
const B1 = src.indexOf('/* ═══ MGR BED: Unusual — end ═══ */', B0);
const block = src.slice(B0, B1);
const real = (n) => extractFunction(src, n, 'index.html');
const decl = (n) => extractDeclaration(src, n, 'index.html');

const TODAY = '2026-10-07'; // a Wednesday
const T = (n) => new Date(Date.parse(TODAY + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);
const wdOf = (d) => new Date(d + 'T12:00:00Z').getUTCDay();

function scope(data, extra) {
  const env = Object.assign({
    data, todayISO: () => TODAY, console, Math, Date, Number, String, Map, Set, Array, Object, JSON, isFinite, isNaN, RegExp,
    anInvoiceTotals: (q) => ({ sales: q.total, profit: q.profit }),
    savedQuoteTotal: (q) => q.total,
    invoiceLineCost: (it) => ({ cost: (Number(it.cost) || 0) * (Number(it.qty) || 0), estimatedQty: it.est ? Number(it.qty) : 0 }),
    quoteItemSellPrice: (it) => Number(it.price) || 0,
    buyKeyParts: (k) => (k === 'P1' ? { product: { name: 'Iron sheets' }, productId: 'P1', variantIdx: null } : null), getFIFOUnitCost: () => null,
    /* The day's count against the book, as the Day screen reads it: here
       only the variance matters, and the book below says which days have
       one. */
    dayCashPosition: (d) => ({ varianceTotal: (data.__variance || {})[d] || 0, countedAccounts: 1 }),
    promiseState: () => 'waiting', buyOrderFor: () => null, supplierName: (id) => 'Supplier ' + id,
    mgrMemo: (name, fn) => fn(), mgrShortUGX: null, managerNotesTable: true, mgrRenderGen: 1, mgrPaintSwitch: () => {},
    mgrNotesOfKind: async () => ({ rows: [], error: null }), mgrSaveNormal: async () => ({ ok: true }), mgrMigrationNote: () => null,
    sb: null, currentShopId: 'S1', toast: () => {}, saveData: () => {}, goToTab: (tab) => { (data.__went = data.__went || []).push(tab); }, dayShown: null,
    /* For each finding's own action: who is signed in (the owner), what
       each customer owes (data.__debts, debAllRows' rows), the shop's
       name, and the Messages hub's selection a chase sets. */
    cbWhoAmI: () => 'OWNER', debAllRows: () => data.__debts || [], shopIdentity: () => ({ name: 'Nakawa Hardware' }), apRound: (v) => Math.round(v),
    fupTab: 'all', fupWhy: 'money', fupQueueQuery: 'x', fupSelectedCustomerId: null,
    document: { addEventListener: () => {}, getElementById: () => null, querySelector: () => null }, window: {},
    esc: (v) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'),
  }, extra || {});
  delete env.mgrShortUGX;
  return compileScope([
    real('anShiftDate'), real('liveCreditNotes'), real('cashIsMoneyIn'), real('cashIsMoneyOut'), real('cashIsCashOverage'),
    real('cashIsCashShortage'), real('cbIsTransfer'), real('cashIsDebtCollection'), real('cashIsTradingIncome'),
    real('stockLogIsCount'), real('stockCountIndex'), real('invCountRecords'), real('invCountMoment'),
    real('unusualSpread'), real('mgrShortUGX'), real('mgrDept'), real('fmtUGX'), real('waComposeUrl'), real('stockKey'), real('isStockPurchaseRow'), decl('STOCK_PURCHASE_NOTE_RE'),
    decl('CASH_SHORTAGE_CATEGORY'), decl('CASH_OVERAGE_CATEGORY'), decl('CASH_TRANSFER_CATEGORY'), decl('CASH_NOT_REVENUE'), decl('cashHas'),
    decl('INV_NOT_A_COUNT'), decl('ACCOUNTS'), decl('UNUSUAL_WEEKS'), decl('UNUSUAL_MIN'), decl('UNUSUAL_Z'), decl('MGR_DEPTS'),
    block,
    'function setNormals(rows){ mgrPulseNormals = { rows, error: null, day: todayISO(), loaded: true, writeError: null }; }',
    'function setOpen(k){ mgrUnusualOpen = k; }',
    'function setRuleOpen(k){ mgrPulseRuleOpen = k; }',
    'function _fup(){ return { fupTab, fupWhy, fupQueueQuery, fupSelectedCustomerId }; }',
    'function _answers(){ return MGR_PULSE_ANSWERS; }',
    'function _state(){ return { answers: mgrUnusualAnswers, rows: mgrPulseAnswerRows, normals: mgrPulseNormals, answersErr: mgrPulseAnswersErr }; }',
  ], env, ['mgrPulseWhat', 'mgrAnswerUnusual', 'mgrPulseRetire', 'mgrPulseNormalsLoad', 'mgrUnusualAnswersLoad', 'mgrPulseAction',
    'mgrPulseTillPast', 'mgrPulseTaughtHTML', '_answers', '_state', 'mgrPulseBooks', 'mgrPulseJudge', 'mgrPulseBand', 'mgrPulseQuartiles', 'mgrPulseNormalRule', 'mgrPulseNormalApplies',
    'mgrPulseNormalOf', 'mgrPulseAnswerSet', 'mgrPulseTitle', 'mgrPulseImpact', 'mgrPulseRarity', 'mgrPulseWhen', 'mgrPulseReasons',
    'mgrPulseLearnt', 'mgrPulseVerdict', 'mgrPulseReading', 'mgrUnusualHTML', 'mgrNavCountUnusual', 'mgrPulseMinGap', 'setNormals',
    'mgrUnusualKey', 'mgrPulseFig', 'setOpen', 'setRuleOpen', '_fup', 'mgrPulseDeed', 'mgrPulseDeedNote', 'mgrPulseActionHTML',
    'mgrPulseKeepRule', 'mgrPulseChaseOpen', 'mgrPulseMeetingItem', 'mgrUnusualForMeeting', 'mgrPulseDate']);
}

/* ---------- the book ---------------------------------------------------
   200 days, every day trading. Sales wobble by week so each weekday has a
   real spread: the k-th week back adds OFF[k mod 8]. A day's invoice is a
   counter sale (so it is not a quote); quotes are drafts made at the desk,
   8 a day, one of them from WhatsApp. Cash in is a steady 800,000 of sales
   receipts. Planted: */
const OFF = [0, 100000, -100000, 50000, -50000, 100000, -100000, 0];
function book(opts) {
  const o = opts || {};
  const savedQuotes = [], cashTxns = [], stockLog = [], cashDays = {};
  let qid = 1, sid = 1;
  for (let i = 199; i >= 0; i--) {
    const d = T(-i), k = Math.floor(i / 7);
    let sales = 1000000 + OFF[k % 8];
    if (d === T(-1)) sales = 400000;                                  // Tue 6 Oct: sales low
    const inv = { id: qid++, status: 'completed', invoiced: true, invoicedAt: d, date: d, total: sales, profit: Math.round(sales * 0.2),
      counterSale: true, client: { name: 'Walk-in' }, payments: [],
      /* Iron sheets off the shelf every day -- none on the planted Tuesday,
         the shelf having been counted down to nothing on the Saturday. */
      items: d === T(-1) ? [] : [{ productId: 'P1', supplierId: '__stock__', qty: 1, price: 1, cost: 0 }] };
    /* Kato buys every Tuesday -- but not on the planted Tuesday. */
    if (wdOf(d) === 2 && d !== T(-1)) { inv.customerId = 'C1'; inv.client = { name: 'Kato' }; }
    savedQuotes.push(inv);
    const quotes = d === T(-7) ? 0 : 8;                                 // Wed 30 Sept: no quotes
    for (let j = 0; j < quotes; j++) savedQuotes.push({ id: qid++, status: 'draft', createdAt: d + 'T09:00:00Z', date: d, originWa: j === 0, items: [] });
    if (i > 0) cashTxns.push({ id: sid++, date: d, type: 'receipt', account: 'cash', category: 'Sales Revenue', amount: 800000 });
    if (i > 0 && d !== T(-4) && i <= 199) cashDays[d] = { actual: { cash: 1000, momo: null, bank: null } };   // Sat 3 Oct uncounted
    if (wdOf(d) === 1) stockLog.push({ id: 1000 + i, key: 'P2', type: 'restock', delta: d === T(-2) ? 40 : 10, cost: 50000, supplierId: 'S1', date: d, note: 'Bill' });
  }
  /* Mon 5 Oct: 40 bags booked in, corrected to 20 the same evening. */
  stockLog.push({ id: 5000, key: 'P2', type: 'correction', delta: -20, cost: 50000, supplierId: 'S1', date: T(-2), corrects: 1002, purchaseQty: 20, note: 'Purchase of P2 corrected' });
  /* Fri 2 Oct: 30 booked in from S1 and said never to have happened. */
  stockLog.push({ id: 5001, key: 'P2', type: 'restock', delta: 30, cost: 50000, supplierId: 'S1', date: T(-5), note: 'Bill' });
  stockLog.push({ id: 5002, key: 'P2', type: 'reversal', delta: -30, date: T(-5), reverses: 5001, note: 'Never happened' });
  /* Opening stock on the first day: no supplier, not a purchase. */
  stockLog.push({ id: 5003, key: 'P3', type: 'restock', delta: 500, cost: 1000, date: T(-199), note: 'Opening stock — counted in' });
  /* Sat 3 Oct: a count found 4 of P1 short, at 45,000 each. */
  stockLog.push({ id: 5004, key: 'P1', type: 'count', delta: -4, qtyAfter: 0, cost: 45000, date: T(-4), label: 'Iron sheets' });
  /* Mon 5 Oct: a debt of 3,000,000 paid. Tue 6 Oct: 5,000,000 moved from
     the drawer to the bank (a transfer -- not cash in). */
  cashTxns.push({ id: sid++, date: T(-2), type: 'receipt', account: 'cash', category: 'Debt Payment', amount: 3000000, description: 'Payment — Okello & Sons' });
  cashTxns.push({ id: sid++, date: T(-1), type: 'receipt', account: 'bank', category: 'Account Transfer', amount: 5000000 });
  /* Tue 29 Sept: the count came up 85,000 short and was booked. Thu 1 Oct:
     10,000 over, booked. */
  cashTxns.push({ id: sid++, date: T(-8), type: 'payment', account: 'cash', category: 'Cash Shortage', amount: 85000 });
  cashTxns.push({ id: sid++, date: T(-6), type: 'receipt', account: 'cash', category: 'Cash Overage', amount: 10000 });
  /* Four credit notes of 300,000 in the month: Sat 12, Thu 17, Sat 26
     Sept and Fri 2 Oct. None before. */
  if (!o.dailyReturns) [T(-25), T(-20), T(-11), T(-5)].forEach((d, n) => {
    const q = savedQuotes.find((x) => x.invoicedAt === d && x.invoiced);
    q.creditNotes = [{ id: n + 1, no: n + 1, date: d, reason: n < 3 ? 'Lid does not seal' : 'Wrong colour', amount: 300000,
      lines: [{ idx: 0, qty: 1, price: 300000, name: 'Gloss 4L' }] }];
  });
  /* Deliveries: the stage log starts on Thu 17 Sept; two orders a day
     reach Completed from then on. One more is collected by the customer
     (not a delivery) and one logs Completed twice (one delivery). */
  for (let i = 20; i >= 0; i--) {
    const at = Date.parse(T(-i) + 'T12:00:00Z');
    for (let j = 0; j < 2; j++) savedQuotes.push({ id: qid++, status: 'completed', invoiced: false, date: T(-i), counterSale: true, items: [],
      stageLog: [{ status: 'preparing', at: at - 7200000 }, { status: 'pending_delivery', at: at - 3600000 }, { status: 'completed', at }].concat(j === 1 && i === 3 ? [{ status: 'completed', at: at + 60000 }] : []) });
  }
  savedQuotes.push({ id: qid++, status: 'completed', invoiced: false, date: T(-3), counterSale: true, items: [], assignedDeliveryId: '__client__',
    stageLog: [{ status: 'pending_delivery', at: Date.parse(T(-3) + 'T10:00:00Z') }, { status: 'completed', at: Date.parse(T(-3) + 'T11:00:00Z') }] });
  const data = { savedQuotes, cashTxns, stockLog, cashDays, customers: [{ id: 'C1', name: 'Kato' }], products: [],
    presetStockCounts: {}, presetExpenseCategories: o.fuelCat ? ['Rent', 'Fuel'] : ['Rent', 'Transport'], waPosts: [], paymentPromises: [],
    __variance: { [T(-1)]: 600000 } };                                // Tue 6 Oct: the drawer counted 600,000 over the book
  if (o.fuel) for (let i = o.fuelDays || 30; i >= 1; i--) data.cashTxns.push({ id: 90000 + i, date: T(-i), type: 'payment', account: 'cash', category: 'Fuel',
    amount: (o.fuelSpikes || {})[T(-i)] || 40000 });
  /* A shop with credit notes on most days: one on every invoice, 40k,
     50k or 60k by i mod 3, and Mon 5 Oct's 2,000,000. */
  if (o.dailyReturns) savedQuotes.filter((q) => q.invoiced && q.invoicedAt > T(-200) && q.invoicedAt < TODAY).forEach((q) => {
    const i = Math.round((Date.parse(TODAY) - Date.parse(q.invoicedAt)) / 864e5);
    const amount = q.invoicedAt === T(-2) ? 2000000 : 40000 + 10000 * (i % 3);
    q.creditNotes = [{ id: 7000 + i, no: 7000 + i, date: q.invoicedAt, reason: 'Wrong size', amount, lines: [{ idx: 0, qty: 1, price: amount, name: 'Nails 3in' }] }];
  });
  /* A shop that applied 0106 three weeks ago: rows older than 21 days came
     back from the database without cost, supplier, bill, source and the
     correction pointers. */
  if (o.pre0106) stockLog.forEach((l) => { if (l.date < T(-21)) ['cost', 'supplierId', 'piId', 'source', 'corrects', 'purchaseQty', 'reverses'].forEach((k) => { delete l[k]; }); });
  /* Thu 1 Oct: a delivery from S1 of a line with no cost anywhere. */
  if (o.uncosted) stockLog.push({ id: 6000, key: 'PX', type: 'restock', delta: 12, supplierId: 'S1', date: T(-6), note: 'Received from S1' });
  /* Mon 5 Oct: one more lorry, bill 77 from S2 -- two lines, 10 x 100,000
     and 5 x 20,000 = 1,100,000. */
  if (o.bills) {
    stockLog.push({ id: 6001, key: 'P4', type: 'restock', delta: 10, cost: 100000, supplierId: 'S2', piId: 77, date: T(-2), note: 'Bill B-77 from S2' });
    stockLog.push({ id: 6002, key: 'P5', type: 'restock', delta: 5, cost: 20000, supplierId: 'S2', piId: 77, date: T(-2), note: 'Bill B-77 from S2' });
  }
  return data;
}

/* ---------- 1. the books, read a day at a time ---------------------- */
const D = book();
const S = scope(D);
const B = S.mgrPulseBooks(TODAY);
{
  /* The floor: 5% of the median day's sales over the 28 days before
     today. Those 28 are, by week back k = floor(i/7): k0 (i 1..6) at
     1.0m but i=1 is the planted 400k, k1 (7 days) 1.1m, k2 (7) 0.9m,
     k3 (7) 1.05m, k4 (i=28) 0.95m. Sorted: 400k, 0.9m x7, 0.95m, 1.0m x5,
     1.05m x7, 1.1m x7 -- the 14th and 15th are 1.0m and 1.05m, so the
     median is 1,025,000 and the floor 51,250. */
  eq(B.floor, 51250, 'the floor is the unusual detector\'s: 5% of the median day, 51,250');
  const mon = B.read(T(-2)), tue = B.read(T(-1)), fri = B.read(T(-5)), sat = B.read(T(-4));
  eq(mon.v.cash_in, 3800000, 'cash in: 800,000 of sales receipts + a 3,000,000 debt paid = 3,800,000');
  eq(tue.v.cash_in, 800000, 'a transfer between the shop\'s own tills is not cash in: Tue 6 Oct takes its 800,000, and the 5m moved to the bank is left out');
  eq(B.read(T(-6)).v.cash_in, 800000, 'nor is money found on a count: Thu 1 Oct takes 800,000 and its 10,000 overage is left out');
  eq(mon.v.purchases, 1000000, 'purchases at the figure the delivery stands at: 40 corrected to 20, x 50,000 = 1,000,000');
  eq(fri.v.purchases, 0, 'a delivery said never to have happened counts nothing');
  eq(B.read(T(-199)).v.purchases, 0, 'and opening stock, bought from nobody, is not a purchase');
  eq(sat.v.stock_short, 180000, 'stock counted short at cost: 4 x 45,000 = 180,000');
  eq(B.read(T(-8)).v.till, -85000, 'the till: a booked shortage of 85,000 is the day\'s count against the book');
  eq(B.read(T(-6)).v.till, 10000, 'and a booked overage of 10,000 is +10,000');
  eq(tue.v.till, 600000, 'a counted day with its variance still unbooked: +600,000');
  eq(sat.v.till, null, 'a day nobody counted is not known, never a balanced zero');
  eq(B.read(T(-7)).v.quotes, 0, 'quotes created: the desk\'s drafts by the day they were made, none on Wed 30 Sept');
  eq(B.read(T(-6)).v.quotes, 8, 'and 8 on an ordinary day -- the counter sales are not quotes');
  eq(B.read(T(-6)).v.wa_orders, 1, 'WhatsApp orders: the one from a chat');
  eq(B.read(T(-5)).v.returns, 300000, 'returns: the credit note dated that day, 300,000');
  eq(B.stageFrom, T(-20), 'the stage log starts on the day its first move was written');
  eq(B.read(T(-21)).v.deliveries, null, 'so the day before it is not recorded');
  eq(B.read(T(-3)).v.deliveries, 2, 'deliveries: two orders reached Completed; the one collected by its customer is not a delivery, and Completed logged twice is one');
  eq(B.read(T(-1)).v.margin, 0.2, 'margin: 80,000 kept of 400,000 sold');
  eq(B.read(T(-1)).v.fuel, null, 'fuel: no Fuel category and no fuel entered -- not recorded');
  eq(B.fuelCat, false, 'and the books say why: the cash book has no Fuel category');
}

/* ---------- 2. the fortnight, judged -------------------------------- */
const R = S.mgrPulseJudge(B, [], () => false);
const cell = (sig, d) => R.rows.find((r) => r.sig.id === sig).cells.find((c) => c.date === d);
{
  eq(R.days.length, 14, 'fourteen days');
  eq(R.days[0] + '..' + R.days[13], T(-13) + '..' + TODAY, 'ending today');
  eq(R.rows.map((r) => r.sig.id), ['sales', 'cash_in', 'quotes', 'wa_orders', 'purchases', 'returns', 'till', 'fuel', 'deliveries', 'margin', 'stock_short'],
    'eleven rows: the canvas\'s nine in its order, then margin and stock counted short (Q21)');
  /* Tue 6 Oct against the 8 Tuesdays before it: by week back k = 1..8 they
     are 1.1, 0.9, 1.05, 0.95, 1.1, 0.9, 1.0, 1.0 (m). Median 1.0m. The
     distances 0.1,0.1,0.05,0,0,0.05,0.1,0.1 have the median 0.075m, so
     the spread is 1.4826 x 75,000 = 111,195. z = (400,000 - 1,000,000) /
     111,195 = -5.396. */
  const s = cell('sales', T(-1));
  near(s.usual, 1000000, 'the usual Tuesday: the median of the last eight, 1,000,000');
  near(s.z, -600000 / (1.4826 * 75000), 'z = -600,000 / 111,195', 1e-9);
  eq(s.s, 'x', 'three spreads out, past the floor, in a direction sales are watched -- out of the ordinary, a problem');
  eq([s.k, s.n, s.band], [0, 28, 4], 'and never before: none of the 28 Tuesdays on the books was this far out');
  eq(cell('sales', T(-6)).s, 'n', 'Thu 1 Oct: a Thursday like the others is normal');
  eq(cell('till', T(-6)).s, 'h', 'the till 10,000 over against Thursdays that balance: z = 10,000 / 5,000 = 2, higher than usual but not out of the ordinary');
  eq(cell('till', T(-4)).s, 'u', 'the uncounted Saturday is not recorded');
  eq(cell('margin', T(-1)).s, 'n', 'margin held at 20% on the low day -- normal');
  eq(R.rows.find((r) => r.sig.id === 'fuel').state, 'nocat', 'the fuel row says it is not recorded, for want of a Fuel category');
  eq(cell('deliveries', T(-6)).s, 'q', 'deliveries on Thu 1 Oct: only two Thursdays logged before it, too few to judge');
  t.check(R.rows.every((r) => { const c = r.cells[13]; return c.s === 't'; }), 'today, still trading, is "today so far" on every row');

  /* The findings, ranked: rarity first (all eight are "never before"),
     problems before good news, then the furthest out.
       till over Tue 6 Oct    z = 600,000 / 5,000 = 120   (the spread is nothing; the floor carries it)
       returns, the month     z = 1,200,000 / 51,250 = 23.4
       till short Tue 29 Sept z = -85,000 / 5,000 = -17
       sales low Tue 6 Oct    z = -5.40
       purchases Mon 5 Oct    z = (1,000,000 - 500,000) / max(25% of 500,000, 51,250) = 4  (Mon 5 Oct, later)
       quotes Wed 30 Sept     z = (0 - 8) / max(25% of 8, 2) = -4                          (Wed 30 Sept, earlier)
       stock short Sat 3 Oct  z = 180,000 / 51,250 = 3.51
       cash in Mon 5 Oct      z = 3,000,000 / max(25% of 800,000, 51,250) = 15, good news */
  eq(R.findings.map((f) => f.metric + '.' + f.dir), ['till.high', 'returns.high', 'till.low', 'sales.low', 'purchases.high', 'quotes.low', 'stock_short.high', 'cash_in.high'],
    'eight findings, the rarest and the problems first');
  eq(R.findings.map((f) => f.id), [1, 2, 3, 4, 5, 6, 7, 8], 'numbered in that order');
  eq(R.findings.map((f) => f.tone), ['bad', 'bad', 'bad', 'bad', 'bad', 'bad', 'bad', 'good'], 'toned by the table: only more cash in is good news here');
  near(R.findings[1].z, 1200000 / 51250, 'returns read as a month: 1,200,000 in the 30 days to Fri 2 Oct against five months of nothing', 1e-9);
  eq(R.findings[1].days, [T(-11), T(-5)], 'one finding for the month, on the two days of the fortnight that carried returns');
  eq([R.findings[1].monthly.sum, R.findings[1].monthly.count, R.findings[1].monthly.usual, R.findings[1].monthly.months], [1200000, 4, 0, 5],
    'four notes, 1.2m, a usual month of none, measured against five months');
  eq(cell('sales', T(-1)).num, 4, 'each out-of-the-ordinary cell carries its finding\'s number');
  eq(cell('returns', T(-11)).num, 2, 'both of the month\'s return days carry the one finding');
  eq(cell('purchases', T(-2)).s, 'x', 'buying more than a usual Monday is a problem (money out)');
  eq(cell('cash_in', T(-2)).s, 'g', 'and more cash in is good news');
}

/* ---------- 3. the words on each finding ------------------------------ */
{
  const f = (m) => R.findings.find((x) => x.metric + '.' + x.dir === m);
  /* Usual range: the middle half of the eight Tuesdays. Sorted 0.9, 0.9,
     0.95, 1.0, 1.0, 1.05, 1.1, 1.1: the 25th percentile sits 1.75 along,
     0.9 + 0.75 x 0.05 = 0.9375m (938k); the 75th 5.25 along, 1.05 +
     0.25 x 0.05 = 1.0625m (1.06m). */
  eq(S.mgrPulseTitle(f('sales.low')), 'Tuesday’s sales were 400k — a Tuesday is usually 938k–1.06m', 'a sales finding, in the owner\'s words');
  eq(S.mgrPulseImpact(f('sales.low')), '−600k', 'its impact: |400k - 1.0m| = 600k, a problem so a minus');
  eq(S.mgrPulseImpact(f('cash_in.high')), '+3m', 'good news brings: +3m');
  eq(S.mgrPulseImpact(f('quotes.low')), '−8 quotes', 'a count is impact in its own unit');
  eq(S.mgrPulseRarity(f('sales.low')), 'never before', 'never before is beyond every same weekday on the books');
  eq(S.mgrPulseTitle(f('till.low')), 'Tuesday’s till came up 85k short — it usually balances', 'the till, per day, never per person');
  eq(S.mgrPulseTitle(f('returns.high')), '4 returns worth 1.2m in 30 days — a usual month has none', 'returns as a month');
  eq(S.mgrPulseWhen(f('returns.high')), 'last on Fri 2 Oct', 'and when');
  eq(S.mgrPulseTitle(f('stock_short.high')), 'A count on Saturday came up 180k short — a Saturday’s counts usually find nothing', 'a count short');
  eq(S.mgrPulseVerdict(R), 'Eight things left this shop’s normal in the last fortnight. One is good news. Three look like a control problem, and I won’t guess why — I’ll show you.',
    'the Manager\'s sentence is counted: 8 findings, 1 good, 3 on the control rows (the till twice, a count)');
}

/* ---------- 4. likely reasons: what the books show, never a cause ------ */
{
  const low = R.findings.find((x) => x.metric === 'sales');
  const rs = S.mgrPulseReasons(low, B);
  eq(rs.map((x) => x.state + ':' + x.label), ['found:Sales taken but not entered yet', 'found:A regular buyer did not come',
    'found:Lines that sell ran out', 'open:Mobile-money payments were down', 'open:It was genuinely quiet'], 'ranked by what the books found: found, then not checked');
  eq(rs[2].detail, 'Iron sheets was at nothing on the shelf — it sells on 8 of the last 8 Tuesdays.',
    'a line sold every Tuesday, counted down to nothing on the Saturday before');
  eq(rs[0].detail, 'The till counted 600k more than the book that evening.', 'the till over the book is what points to sales not entered');
  eq(rs[1].detail, 'Kato buys on 8 of the last 8 Tuesdays — nothing this one.', 'a regular who buys every Tuesday did not');
  const cash = R.findings.find((x) => x.metric === 'cash_in');
  const rc = S.mgrPulseReasons(cash, B);
  eq(rc[0].state + ':' + rc[0].label, 'found:Debts were paid', 'cash in up: a debt paid, found');
  eq(rc[0].detail, '1 debt payment, 3m — a usual Monday collects 0; the largest Okello & Sons, 3m.',
    'with what was paid against a usual Monday, and who paid -- the payment screen\'s "Payment — " is not a name');
  const all = R.findings.flatMap((x) => S.mgrPulseReasons(x, B));
  t.check(all.length > 0 && all.every((x) => ['found', 'open', 'none'].includes(x.state)), 'every reason is found, not checked or not found');
  t.check(!all.some((x) => /\d%$|probab|likel(y|ihood) \d|chance/i.test(x.label)), 'no reason carries a percentage or a likelihood');
  t.check(!all.some((x) => /\bbecause\b|caused|root cause|thanks to/i.test(x.label + ' ' + x.detail)), 'and none is said as the cause');
  t.check(/MGR_PULSE_EVIDENCE = \{ found: 'found in the books', open: 'not checked', none: 'not found' \}/.test(block),
    'on screen: "found in the books", "not checked", "not found"');
}

/* ---------- 5. teach me: answers, normals, and the cells they explain -- */
{
  /* A rule the books can test. */
  eq(S.mgrPulseNormalRule({ metric: 'quotes', weekday: 3, condition: 'every', effect: 'low up to 100%' }),
    { metric: 'quotes', weekday: 3, condition: 'every', dir: 'low', upTo: 100 }, 'a weekday rule reads back');
  eq(S.mgrPulseNormalRule({ metric: 'sales', weekday: 4, condition: 'rain', effect: 'low up to 80%' }), null, 'rain is a note, never a rule');
  const w = { id: 7, metric: 'quotes', weekday: 3, condition: 'every', effect: 'low up to 100%' };
  const R2 = S.mgrPulseJudge(B, [w], () => false);
  const q2 = R2.rows.find((r) => r.sig.id === 'quotes').cells.find((c) => c.date === T(-7));
  eq(q2.s, 'tn', 'taught "Wednesdays run lower, up to 100%": no quotes on a Wednesday is normal now');
  eq(R2.findings.length, 7, 'and is no longer a finding');
  eq(R2.used.get(7), 1, 'the normal is credited with the day it explained');
  const R3 = S.mgrPulseJudge(B, [{ ...w, effect: 'low up to 75%' }], () => false);
  eq(R3.rows.find((r) => r.sig.id === 'quotes').cells.find((c) => c.date === T(-7)).s, 'x',
    'taught "up to 75%": 8 short of 8 is 100% under -- past what was taught, still flagged');
  const R4 = S.mgrPulseJudge(B, [w], (d, m) => d === T(-7) && m === 'quotes');
  eq(R4.findings.length, 8, 'a day the owner has already answered stays what it was, explained -- a normal never re-labels it');
  t.check(S.mgrPulseNormalApplies({ metric: 'cash_in', condition: 'month_end', effect: 'high up to 50%' }, 'cash_in', '2026-09-29', 140, 100)
    && !S.mgrPulseNormalApplies({ metric: 'cash_in', condition: 'month_end', effect: 'high up to 50%' }, 'cash_in', '2026-09-20', 140, 100),
    'a month\'s turn is the last three days and the first two: 29 Sept is one, 20 Sept is not');

  const low = R.findings.find((x) => x.metric === 'sales');
  const set = S.mgrPulseAnswerSet(low);
  eq(set.map((a) => a.label + '/' + a.learn), ['Not entered yet/job', 'It rained/note', 'Tuesdays run lower now/rule', 'Something else/once'],
    'the answers to a low-sales day, each saying what it teaches');
  /* 400k against 1.0m is 60% under: rounded up to the next 5%, 60. */
  eq(S.mgrPulseNormalOf(low, set[2]), { metric: 'sales', weekday: 2, condition: 'every', effect: 'low up to 60%',
    note: 'Tuesdays run lower now — Tuesday’s sales were 400k — a Tuesday is usually 938k–1.06m' }, 'a rule is no wider than the day explained');
  eq(S.mgrPulseNormalOf(low, set[1]).condition, 'rain', 'a note keeps what it was about');
  eq(S.mgrPulseNormalOf(low, set[0]), null, 'a job teaches no normal');
  t.check(/books can’t see rain, so I’ve kept this as a note, not a rule/.test(S.mgrPulseLearnt(low, set[1])), 'and the screen says a note is not a rule');
  t.check(/On Tuesdays, sales running up to 60% under usual is normal now/.test(S.mgrPulseLearnt(low, set[2])), 'a rule says exactly what is normal now');
  const till = R.findings.find((x) => x.metric === 'till' && x.dir === 'low');
  t.check(!S.mgrPulseAnswerSet(till).some((a) => a.learn === 'rule'), 'nothing about a till short becomes a rule');
}

/* ---------- 6. fuel, once it is recorded ------------------------------ */
{
  const SF = scope(book({ fuelCat: true }));
  eq(SF.mgrPulseJudge(SF.mgrPulseBooks(TODAY), [], () => false).rows.find((r) => r.sig.id === 'fuel').state, 'none',
    'with a Fuel category and nothing entered under it yet: not recorded yet');
  const S2 = scope(book({ fuelCat: true, fuel: true }));
  const b2 = S2.mgrPulseBooks(TODAY);
  eq([b2.fuelFrom, b2.read(T(-31)).v.fuel, b2.read(T(-3)).v.fuel], [T(-30), null, 40000],
    'fuel is read from the first day it was entered: before it not recorded, after it 40,000 a day');
}

/* ---------- 7. the bands of the rarity scale -------------------------- */
{
  eq(S.mgrPulseBand(9, 0, 30), 4, 'beyond every same weekday on the books: never before');
  eq(S.mgrPulseBand(3.2, 1, 30), 2, '|z| 3.2 is rare; 1 in 30 (3%) is very rare; the more modest wins: rare');
  eq(S.mgrPulseBand(6, 9, 30), 0, '|z| 6 but 9 in 30 (30%) were as far out: common');
  eq(S.mgrPulseBand(5, 4, 30), 1, '4 in 30 is 13%: uncommon');
  eq(S.mgrPulseBand(5, 2, 30), 2, '|z| 5 is very rare, but 2 in 30 (6.7%, over 4%) is rare -- the more modest wins');
  near(S.mgrPulseQuartiles([1, 2, 3, 4, 5])[0], 2, 'the 25th percentile of 1..5 is 2');
}

/* ---------- 8. the section, drawn ------------------------------------- */
{
  /* The reading the painter draws: the same book, through the memo. */
  S.setNormals([]);
  const r = S.mgrPulseReading();
  const html0 = S.mgrUnusualHTML(r);
  t.check(/aria-label="Tuesday’s till came up 600k over/.test(html0), 'with nothing picked, the first finding is open');
  S.setOpen(S.mgrUnusualKey(r.findings.find((x) => x.metric === 'sales')));
  const html = S.mgrUnusualHTML(r);
  eq((html.match(/class="mgr-u-l[ "]/g) || []).length, 11, 'eleven signal rows, each a button that filters the list');
  eq((html.match(/class="mgr-u-c mgr-u-c-/g) || []).length, 10 * 14 + 8, 'fourteen cells a row -- the fuel row is one "not recorded" strip -- and eight legend swatches');
  t.check(/not recorded — the cash book has no Fuel category <button type="button" class="btn btn-ghost ow-sm mgr-u-nr-b" data-pulse-fuelcat="1">Add a Fuel category<\/button>/.test(html),
    'no Fuel category: the row says so, and one tap adds it');
  eq([...html.matchAll(/data-pulse-filter="([a-z]+)"/g)].map((m) => m[1]), ['all', 'bad', 'good', 'open'], 'the canvas\'s filters: all, problems, good news, unanswered');
  t.check(/>All 8</.test(html), 'and "All" says how many');
  eq((html.match(/class="btn btn-accent/g) || []).length, 1, 'one primary action on the section');
  t.check(/class="mgr-u-rar"[^>]*>(?:<span[^>]*><i><\/i>[a-z ]+<\/span>){5}<\/div>/.test(html), 'the rarity scale has its five steps');
  t.check(/found in the books/.test(html) && !/\d+%<\/span>/.test(html.slice(html.indexOf('Likely reasons'))), 'reasons with what the books found, and no percentage');
  t.check(/data-unusual-answer="Not entered yet" data-unusual-key="2026-10-06\|sales"/.test(html), 'the open finding is answered with a tap');
  /* WAS: 'Open Tue 6 Oct' -- one action per signal, the same for every
     low-sales day. NOW: each finding's own action (Q39), derived from what
     the books found: the till over the book points to sales not entered,
     and with nobody on the staff list recorded for the day the owner
     enters them on the day's own page. Section 18 runs every kind. */
  t.check(/data-unusual-day="2026-10-06">Enter Tuesday’s missing sales</.test(html), 'and its one action opens the day to enter the sales the till says are missing');
  t.check(/Out of the ordinary<\/span><b class="mgr-u-hd-v">8<\/b>/.test(html) && /Good news<\/span><b class="mgr-u-hd-v mgr-u-hd-good">1<\/b>/.test(html)
    && /Need your answer<\/span><b class="mgr-u-hd-v mgr-u-hd-warn">7<\/b>/.test(html), 'the band counts: 8 found, 1 good news, 7 problems still waiting');
  t.check(/Nothing taught yet/.test(html), 'and an empty Taught list says how to fill it');
  /* WAS: '<b>8 unusual things</b> need your answer' beside the band's
     "Need your answer 7" -- two figures under one label. NOW: the band
     counts problems waiting (7: eight findings less the one good news);
     the nav counts every finding not yet explained (8), in its own words. */
  eq(S.mgrNavCountUnusual({}), { n: 8, note: '<b>8 unusual things</b> not yet explained' }, 'the nav: eight in the fortnight, eight not yet explained');
  t.check(!/need/.test(S.mgrNavCountUnusual({}).note), 'and never under the band\'s label "need your answer", which counts only problems');
}

/* ---------- 9. the gap of a month's returns is counted once ----------- */
{
  /* The month's finding carries two flagged days, Sat 26 Sept and Fri 2
     Oct; their 30-day windows overlap (Sat 26 Sept's holds the notes of
     12, 17 and 26 Sept, 900,000; Fri 2 Oct's holds all four, 1,200,000).
     Adding the two days' gaps would say 2.1m. The month's gap is the
     latest 30 days against a usual month: 1,200,000 - 0 = 1,200,000. */
  const ret = R.findings.find((x) => x.metric === 'returns');
  eq(ret.per.map((p) => p.gap), [900000, 1200000], 'each flagged day\'s own 30 days, above a usual month of none');
  eq(ret.gap, 1200000, 'the finding\'s gap is the latest 30 days less a usual month, once: 1.2m, never 2.1m');
  eq(S.mgrPulseImpact(ret), '−1.2m', 'so its impact is −1.2m');
}

/* ---------- 10. returns on most days are judged day by day ----------- */
{
  /* Every invoice carries a credit note of 40k/50k/60k (by days back mod
     3), so a weekday's spread is real and returns are judged as a day.
     The 8 Mondays before Mon 5 Oct are 9,16,..,58 days back: mod 3 gives
     0,1,2,0,1,2,0,1 -> 40,50,60,40,50,60,40,50k. Sorted 40,40,40,50,50,
     50,60,60: the median is 50k; the 25th percentile (1.75 along) 40k
     and the 75th (5.25 along) 50 + 0.25 x 10 = 52.5k. Mon 5 Oct's note
     is 2,000,000: 1,950,000 over. */
  const SR = scope(book({ dailyReturns: true }));
  const BR = SR.mgrPulseBooks(TODAY);
  const RR = SR.mgrPulseJudge(BR, [], () => false);
  const fr = RR.findings.filter((x) => x.metric === 'returns');
  eq(fr.length, 1, 'one returns finding');
  eq([fr[0].monthly, fr[0].days, fr[0].value, fr[0].usual], [null, [T(-2)], 2000000, 50000], 'judged as Mon 5 Oct against a usual Monday of 50k, not as a month');
  eq(fr[0].gap, 1950000, 'its gap: 2,000,000 - 50,000');
  const title = SR.mgrPulseTitle(fr[0]);
  eq(title, 'Monday’s returns were 2m — a Monday is usually 40k–53k', 'a day\'s title, never a month\'s with nothing in it');
  const what = SR.mgrPulseWhat(fr[0], BR);
  t.check(!/undefined|NaN/.test(title + what) && /^1 credit note on Mon 5 Oct, 2m credited/.test(what), 'and the day\'s own sentence: ' + what);
  const rs = SR.mgrPulseReasons(fr[0], BR, RR);
  eq(rs.find((x) => x.label === 'One line keeps coming back').detail, 'Nails 3in: on 1 of 1 credit notes.', 'its reasons read the day\'s notes, not a month\'s');
}

/* ---------- 11. purchases before the 0106 columns: not recorded -------- */
{
  /* Rows older than 21 days lost their supplier and cost. The first
     restock that kept one is Mon 21 Sept (16 days back -- Mondays are 2,
     9, 16, 23 days back). So purchases are read from Mon 21 Sept: every
     day of the fortnight has at most two same weekdays on record (8 and
     15 days back for a Tuesday), too few to judge -- never a usual of
     nothing against which every delivery is "never before". */
  const SP = scope(book({ pre0106: true }));
  const BP = SP.mgrPulseBooks(TODAY);
  eq(BP.purchasesFrom, T(-16), 'purchases are read from the first delivery that kept its supplier and cost');
  eq(BP.read(T(-23)).v.purchases, null, 'a Monday before it is not recorded, never 0');
  eq(BP.read(T(-16)).v.purchases, 500000, 'and the first one after it reads its 10 x 50,000');
  const RP = SP.mgrPulseJudge(BP, [], () => false);
  const row = RP.rows.find((r) => r.sig.id === 'purchases');
  t.check(row.cells.every((c) => ['q', 't', 'c'].includes(c.s)), 'no purchases cell is judged: ' + row.cells.map((c) => c.s).join(''));
  eq(RP.findings.filter((f) => f.metric === 'purchases').length, 0, 'so there is no purchases finding at all');
  /* With the stage-log-like start in place, a shop that never kept one
     reads the whole row as not recorded. */
  const SN = scope(Object.assign(book(), { stockLog: book().stockLog.map((l) => { const x = { ...l }; ['cost', 'supplierId', 'piId', 'source', 'corrects', 'purchaseQty', 'reverses'].forEach((k) => delete x[k]); return x; }) }));
  const RN = SN.mgrPulseJudge(SN.mgrPulseBooks(TODAY), [], () => false);
  eq(RN.rows.find((r) => r.sig.id === 'purchases').state, 'none', 'no delivery ever kept its supplier and cost: the row is not recorded');
  SN.setNormals([]);
  t.check(/not recorded — deliveries are not kept with their supplier and cost yet/.test(SN.mgrUnusualHTML(SN.mgrPulseReading())), 'and says so across the fortnight');
}

/* ---------- 12. a delivery with no cost is a floor, never a low day ---- */
{
  /* Thu 1 Oct: 12 of a line with no cost anywhere. The figure is 0 plus
     something not known -- not a Thursday with nothing bought. */
  const SU = scope(book({ uncosted: true }));
  const BU = SU.mgrPulseBooks(TODAY);
  eq([BU.read(T(-6)).v.purchases, BU.read(T(-6)).uncosted.purchases], [0, 1], 'the day reads 0 known, 1 line uncosted');
  const RU = SU.mgrPulseJudge(BU, [], () => false);
  const c = RU.rows.find((r) => r.sig.id === 'purchases').cells.find((x) => x.date === T(-6));
  eq(c.s, 'u', 'so the cell is not judged');
  eq(c.why, '1 delivery line has no cost on file — at least 0, not known how much more', 'and says why');
}

/* ---------- 13. deliveries are lorries, not lines ---------------------- */
{
  /* Mon 5 Oct: S1's 20 bags (1,000,000) and bill 77 from S2 -- 10 x
     100,000 + 5 x 20,000 = 1,100,000. Two deliveries, three lines,
     2,100,000. A usual Monday is 500,000, so the gap is 1,600,000 and
     half of it 800,000: bill 77 alone is past that. */
  const SB = scope(book({ bills: true }));
  const BB = SB.mgrPulseBooks(TODAY);
  const dl = BB.deliveriesOn(T(-2));
  eq(dl.map((g) => [g.key, g.total, g.lines.length]), [['pi:77', 1100000, 2], ['sup:S1', 1000000, 1]], 'two deliveries: the bill\'s two lines together, then S1');
  const RB = SB.mgrPulseJudge(BB, [], () => false);
  const fp = RB.findings.find((x) => x.metric === 'purchases');
  eq([fp.value, fp.gap], [2100000, 1600000], '2,100,000 arrived, 1,600,000 over a usual Monday');
  t.check(/^2 deliveries \(3 lines\) arrived, 2\.1m at cost/.test(SB.mgrPulseWhat(fp, BB)), 'the sentence counts deliveries and lines');
  const big = SB.mgrPulseReasons(fp, BB, RB).find((x) => x.label === 'One big delivery');
  eq([big.state, big.detail], ['found', 'Supplier S2, 1.1m — 2 lines, the largest P4 × 10; 1 other delivery that day.'],
    'one big delivery is the bill as a whole, its largest line named only as a detail');
}

/* ---------- 14. the till's past, counted ------------------------------ */
{
  /* Tue 6 Oct over: the 8 Tuesdays before (8..57 days back) were all
     counted; 29 Sept was 85,000 short, the other seven 0. */
  const over = R.findings.find((x) => x.metric === 'till' && x.dir === 'high');
  eq(S.mgrPulseTillPast(over), '7 of the last 8 counted Tuesdays balanced', 'seven of eight, not "balanced to the shilling"');
  t.check(/Counted days only — 7 of the last 8 counted Tuesdays balanced\./.test(S.mgrPulseWhat(over, B)), 'and the sentence says so');
  const short = R.findings.find((x) => x.metric === 'till' && x.dir === 'low');
  eq(S.mgrPulseTillPast(short), 'the last 8 counted Tuesdays balanced to the shilling', 'the 8 Tuesdays before 29 Sept all balanced: then, and only then, to the shilling');
}

/* ---------- 15. fuel: the reasons read the grid and the days after ----- */
{
  /* Fuel at 40,000 every day for 60 days; 300,000 on Thu 1 Oct and on
     Tue 6 Oct. A same-weekday usual of 40,000, spread nothing: each is
     260,000 over, one finding over the two days. */
  const SF = scope(book({ fuelCat: true, fuel: true, fuelDays: 60, fuelSpikes: { [T(-6)]: 300000, [T(-1)]: 300000 } }));
  const BF = SF.mgrPulseBooks(TODAY);
  const RF = SF.mgrPulseJudge(BF, [], () => false);
  const ff = RF.findings.find((x) => x.metric === 'fuel');
  eq([ff.days, ff.gap], [[T(-6), T(-1)], 520000], 'one fuel finding, two days, 260,000 + 260,000 over');
  const rs = SF.mgrPulseReasons(ff, BF, RF);
  const several = rs.find((x) => x.label === 'Fuel bought for several days');
  /* Thu 1 Oct: Fri 2 and Sat 3 Oct had fuel. Tue 6 Oct: the day after is
     today, not over. Nothing found, one not over: not checked. */
  eq([several.state, several.detail], ['open', 'The days after Tue 6 Oct are not over yet.'], 'a day after that is not over cannot say no');
  const thu = SF.mgrPulseReasons({ ...ff, days: [T(-6)], date: T(-6), per: [ff.per[0]] }, BF, RF).find((x) => x.label === 'Fuel bought for several days');
  eq([thu.state, thu.detail], ['none', 'Fuel was entered again on Fri 2 Oct.'], 'one with fuel says no, and names the day');
  /* Deliveries on those days: the stage log starts 20 days back, so a
     Thursday or Tuesday has two weeks behind it -- the grid does not
     judge them, and nor does the reason. */
  const more = rs.find((x) => x.label === 'More deliveries than usual');
  eq([more.state, more.detail], ['open', 'Too few weeks of deliveries to say what is usual.'], 'more deliveries than usual is the grid\'s judgement, never half of all days');
}

/* ---------- 16. every reason set, every title: no cause, no percentage -- */
{
  const ANS = S._answers();
  const bad = /\bbecause\b|thanks to|\bcaused\b|root cause|it worked|\d+%\s*(likely|chance)|probab/i;
  const base = R.findings.find((x) => x.metric === 'sales');
  let ran = 0, fails = [];
  Object.keys(ANS).forEach((k) => {
    const [metric, dir] = k.split('.');
    const sig = R.rows.find((r) => r.sig.id === metric).sig;
    const f = { ...base, metric, dir, sig, tone: 'bad', monthly: metric === 'returns' ? { sum: 300000, count: 1, usual: 0, usualCount: 0, months: 5, k: 0 } : null };
    try {
      const rs = S.mgrPulseReasons(f, B, R);
      const words = [S.mgrPulseTitle(f), S.mgrPulseWhat(f, B)].concat(rs.flatMap((x) => [x.label, x.detail]))
        .concat(S.mgrPulseAnswerSet(f).flatMap((a) => [a.label, S.mgrPulseLearnt(f, a)]));
      if (!rs.length || rs.some((x) => !['found', 'open', 'none'].includes(x.state))) fails.push(k + ': states');
      words.forEach((w) => { if (bad.test(w) || /undefined|NaN/.test(w)) fails.push(k + ': ' + w); });
      ran++;
    } catch (e) { fails.push(k + ': threw ' + e.message); }
  });
  eq([ran, fails], [Object.keys(ANS).length, []], 'every finding kind has reasons, titles and answers with no cause, no percentage, nothing undefined');
  const code = block.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
  t.check(!bad.test(code), 'and no string anywhere in the section names a cause or a likelihood');
  t.check(!bad.test(S.mgrPulseVerdict(R)), 'nor the Manager\'s sentence');
}

/* ---------- 17. the owner's word: kept per day, changed in place ------- */
function fakeSb(answer) {
  const log = []; let next = 100;
  const from = (table) => {
    const q = { table, op: 'select', filters: [] };
    const b = {
      select(c) { q.cols = c; return b; }, eq(k, v) { q.filters.push([k, v]); return b; }, gte(k, v) { q.filters.push([k, '>=', v]); return b; },
      order() { return b; }, limit() { return b; }, single() { q.single = true; return b; },
      insert(rows) { q.op = 'insert'; q.payload = rows; return b; }, update(p) { q.op = 'update'; q.payload = p; return b; },
      then(res, rej) { log.push(q); return Promise.resolve(answer(q, () => next++)).then(res, rej); },
    };
    return b;
  };
  return { from, log };
}
const okAnswer = (q, id) => q.op === 'insert' ? { data: q.payload.map((r) => ({ id: id(), body: r.body })), error: null }
  : q.op === 'update' ? { data: null, error: null } : { data: [], error: null };
(async () => {
  {
    const toasts = [], saved = [];
    const sb = fakeSb(okAnswer);
    const SA = scope(book(), { sb, toast: (m) => toasts.push(m),
      mgrSaveNormal: async (b) => { saved.push(b); return { ok: true, row: { id: 900 + saved.length, status: 'active', date: TODAY, body: { ...b, taughtOn: TODAY } } }; } });
    SA.setNormals([]);
    const RA = SA.mgrPulseReading();
    const ret = RA.findings.find((x) => x.metric === 'returns');
    const key = SA.mgrUnusualKey(ret);
    await SA.mgrAnswerUnusual(key, 'A bad batch');
    const ins = sb.log.filter((q) => q.op === 'insert');
    eq(ins.length, 1, 'one write for the answer');
    eq(ins[0].payload.map((r) => [r.kind, r.status, r.body.unusualDay, r.body.metric, r.body.answer]),
      [['question', 'answered', T(-11), 'returns', 'A bad batch'], ['question', 'answered', T(-5), 'returns', 'A bad batch']],
      'one answered question per day the finding covers, each under its own day and metric -- the fields the meeting matches on');
    eq([SA._state().answers.get(T(-11) + '|returns'), SA._state().rows.get(T(-11) + '|returns'), SA._state().rows.get(key)], ['A bad batch', 100, 101],
      'each day is answered, by its own row');
    let html = SA.mgrUnusualHTML(SA.mgrPulseReading());
    SA.setOpen(key); html = SA.mgrUnusualHTML(SA.mgrPulseReading());
    t.check(/aria-pressed="true">A bad batch</.test(html) && /data-unusual-answer="Our storage"/.test(html) && /mgr-u-st-done">Explained</.test(html),
      'answered: the chosen answer pressed, "Explained", and the other answers still a tap away');
    t.check(!/data-unusual-answer="A bad batch"/.test(html), 'the chosen one is not tapped again');

    /* A changed answer rewrites the two rows -- no second answer beside
       the first, which the meeting could read instead. */
    await SA.mgrAnswerUnusual(key, 'Our storage');
    const ups = sb.log.filter((q) => q.op === 'update' && q.table === 'manager_notes');
    eq(sb.log.filter((q) => q.op === 'insert').length, 1, 'changing the answer writes no new row');
    eq(ups.map((q) => [q.filters.find((f) => f[0] === 'id')[1], q.payload.body.answer, q.payload.body.previousAnswer, q.payload.body.unusualDay]),
      [[100, 'Our storage', 'A bad batch', T(-11)], [101, 'Our storage', 'A bad batch', T(-5)]], 'it updates each day\'s row in place, keeping what it said before');

    /* A rule, then a change of mind: the normal it taught is retired. */
    const low = RA.findings.find((x) => x.metric === 'sales');
    await SA.mgrAnswerUnusual(SA.mgrUnusualKey(low), 'Tuesdays run lower now');
    eq(saved.map((b) => [b.metric, b.weekday, b.condition, b.effect, b.sourceAnswerId]), [['sales', 2, 'every', 'low up to 60%', '102']],
      'a weekday answer teaches a normal that points back to its answer');
    await SA.mgrAnswerUnusual(SA.mgrUnusualKey(low), 'Something else');
    const retire = sb.log.filter((q) => q.op === 'update' && q.payload.status === 'retired');
    eq(retire.map((q) => q.filters.find((f) => f[0] === 'id')[1]), [901], 'changed to a one-off: the normal the old answer taught is retired');
    eq(saved.length, 1, 'and no new normal is kept for a one-off');
    eq(toasts, [], 'nothing went wrong, so nothing was said');
  }
  {
    /* A write refused: the day is taken back to unanswered, and said. */
    const toasts = [];
    const sb = fakeSb((q) => q.op === 'insert' ? { data: null, error: { message: 'offline' } } : { data: [], error: null });
    const SE = scope(book(), { sb, toast: (m) => toasts.push(m) });
    SE.setNormals([]);
    const low = SE.mgrPulseReading().findings.find((x) => x.metric === 'sales');
    await SE.mgrAnswerUnusual(SE.mgrUnusualKey(low), 'Not entered yet');
    eq([SE._state().answers.has(SE.mgrUnusualKey(low)), toasts], [false, ['Could not keep that answer — offline']], 'an answer the journal refused is taken back and said so');
  }
  {
    /* The 0107 update missing: the answer is kept, the normal is not, and
       the open finding names the update. */
    const sb = fakeSb(okAnswer);
    const SM = scope(book(), { sb, mgrSaveNormal: async () => ({ ok: false, error: 'check', migration: '0107' }),
      mgrMigrationNote: () => 'The Manager\'s memory needs one update — paste 0107_manager_intelligence.sql into the Supabase SQL editor and reload.' });
    SM.setNormals([]);
    const low = SM.mgrPulseReading().findings.find((x) => x.metric === 'sales');
    await SM.mgrAnswerUnusual(SM.mgrUnusualKey(low), 'Tuesdays run lower now');
    SM.setOpen(SM.mgrUnusualKey(low));
    const html = SM.mgrUnusualHTML(SM.mgrPulseReading());
    t.check(/mgr-u-unkept">Your answer is kept, but not as a normal — The Manager&#39;s memory needs one update — paste 0107|mgr-u-unkept">Your answer is kept, but not as a normal — The Manager's memory needs one update — paste 0107/.test(html),
      'a normal the journal refused for want of 0107 names the update on the finding');
    t.check(!/I’ll remember:/.test(html), 'and never claims to remember it');
  }
  {
    /* Retiring refused: the normal stands again, and it is said. */
    const toasts = [];
    const sb = fakeSb((q) => q.op === 'update' ? { data: null, error: { message: 'denied' } } : { data: [], error: null });
    const SR2 = scope(book(), { sb, toast: (m) => toasts.push(m) });
    SR2.setNormals([{ id: 5, status: 'active', date: T(-3), body: { metric: 'quotes', weekday: 3, condition: 'every', effect: 'low up to 100%', note: 'x — y' } }]);
    await SR2.mgrPulseRetire(5);
    eq([SR2._state().normals.rows[0].status, toasts], ['active', ['Could not retire that normal — denied']], 'a retire the journal refused is rolled back and said so');
  }
  {
    /* The normals unreadable: named, and nothing taught is applied. */
    const SR3 = scope(book(), { mgrNotesOfKind: async () => ({ rows: [], error: 'timeout' }) });
    await SR3.mgrPulseNormalsLoad(1);
    const st = SR3._state().normals;
    eq([st.loaded, st.error, st.day], [true, 'timeout', null], 'a failed read is kept as failed, and tried again on the next visit');
    t.check(/could not be read — timeout\. Nothing taught is being applied until it can\./.test(SR3.mgrPulseTaughtHTML(SR3.mgrPulseReading())), 'the Taught panel names it');
  }
  {
    /* Two loads overlapping, the first started by a render that is no
       longer current: the rows that arrive are the shop's and are kept. */
    let release;
    const gate = new Promise((r) => { release = r; });
    let calls = 0;
    const SR4 = scope(book(), { mgrRenderGen: 2, mgrNotesOfKind: () => { calls++; return gate; } });
    const p1 = SR4.mgrPulseNormalsLoad(1), p2 = SR4.mgrPulseNormalsLoad(2);
    release({ rows: [{ id: 8, status: 'active', date: T(-3), body: { metric: 'quotes', weekday: 3, condition: 'every', effect: 'low up to 100%' } }], error: null });
    await Promise.all([p1, p2]);
    const st = SR4._state().normals;
    eq([calls, st.loaded, st.rows.length, st.day], [1, true, 1, TODAY], 'one read, and its rows kept -- never a panel stuck on "Reading…"');
    eq(SR4.mgrPulseReading().rows.find((r) => r.sig.id === 'quotes').cells.find((c) => c.date === T(-7)).s, 'tn', 'and the normal applied');
  }
  {
    /* The answers unreadable: the band says so and counts nothing. */
    const sb = fakeSb(() => ({ data: null, error: { message: 'timeout' } }));
    const SR5 = scope(book(), { sb });
    SR5.setNormals([]);
    await SR5.mgrUnusualAnswersLoad();
    const html = SR5.mgrUnusualHTML(SR5.mgrPulseReading());
    t.check(/Your answers could not be read — timeout\./.test(html) && /Need your answer<\/span><b class="mgr-u-hd-v" aria-label="Need your answer not known">—</.test(html),
      'answers not read: the band names it, and "Need your answer" is not known, never a count of everything');
    eq(SR5.mgrNavCountUnusual({}), { n: 8, note: null }, 'and the nav says nothing is waiting rather than guess');
    t.check(/mgr-u-st-done">Answer not read</.test(html), 'each finding says its answer was not read');
  }
  {
    /* The action on each finding opens where its follow-up is done. */
    const f = (m, d) => ({ metric: m, dir: d, date: T(-1) });
    eq([S.mgrPulseAction(f('sales', 'low')), S.mgrPulseAction(f('cash_in', 'low')), S.mgrPulseAction(f('purchases', 'high'))].map((a) => a.tab + ':' + a.label),
      ['day:Open Tue 6 Oct', 'analytics-debtors:Open the debtors', 'invoices:Open the bills'], 'per signal: the day, the debtors, the bills');
  }
  /* ---------- 18. each finding's own action (Q39) --------------------- */
  {
    const long = (d) => new Date(d + 'T12:00:00Z').toLocaleDateString('en-GB', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'short' }).replace(',', '');
    const deedOf = (SX, m, dir) => { const r = SX.mgrPulseReading(); const f = r.findings.find((x) => x.metric === m && (!dir || x.dir === dir));
      return f ? SX.mgrPulseDeed(f, SX.mgrPulseBooks(TODAY), r) : null; };
    const pick = (d) => d && [d.kind, d.label].concat(d.kind === 'day' ? [d.day] : d.kind === 'go' ? [d.tab] : []);

    /* The base book: nobody on the staff list, no supplier or payer on file
       with a number. Each finding still gets its own action, from what the
       books found behind it -- and where they name nobody, the screen the
       follow-up is done on. */
    S.setNormals([]);
    eq(pick(deedOf(S, 'sales', 'low')), ['day', 'Enter Tuesday’s missing sales', T(-1)],
      'sales low with the till 600k over the book: enter the missing sales -- nobody on the staff list recorded the day, so it is the owner\'s own job');
    eq(pick(deedOf(S, 'till', 'high')), ['rule', 'Count the till at every close'],
      'the till: a rule about the till, never about a person -- and Sat 3 Oct was not counted, so the rule is to count every close');
    eq(deedOf(S, 'till', 'high').basis, '1 of the last 13 trading days was not counted.', 'with what it rests on: Sat 3 Oct, one of thirteen trading days');
    eq(deedOf(S, 'till', 'high').text, 'The till is counted at every close until Tue 6 Oct is explained.', 'the rule, written out for the owner to change');
    eq(pick(deedOf(S, 'stock_short')), ['go', 'Recount Iron sheets', 'inventory'], 'a count short with no delivery behind it: recount the line, by name');
    eq(pick(deedOf(S, 'purchases')), ['go', 'Open the bills', 'invoices'], 'purchases up with no price rise found: the bills, where the screen-level follow-up is');
    eq(pick(deedOf(S, 'quotes')), ['go', 'Open order tracking', 'quote-saved'], 'quotes down: order tracking');
    eq(pick(deedOf(S, 'returns')), ['day', 'Open Fri 2 Oct', T(-5)], 'returns whose line was never bought from a named supplier: nobody to ask, the day');
    eq(pick(deedOf(S, 'cash_in')), ['go', 'Open the cash book', 'cashbook'], 'a debt paid by "Okello & Sons", who is no customer on file: no thank-you to a name the books cannot place');

    /* A member of staff recorded the day: Joan entered Tue 6 Oct's
       receipts. The message is written from what the books found. */
    const DJ = book();
    DJ.staff = [{ id: 'ST1', userId: 'U9', name: 'Joan Nakato', phone: '0772 123456' }];
    DJ.cashTxns.find((x) => x.date === T(-1) && x.category === 'Sales Revenue').enteredBy = 'U9';
    const SJ = scope(DJ); SJ.setNormals([]);
    const dj = deedOf(SJ, 'sales', 'low');
    eq([dj.kind, dj.label, dj.to.first, dj.to.phone], ['wa', 'Ask Joan to enter Tuesday', 'Joan', '0772 123456'], 'Joan recorded the day: ask Joan, by her first name, at her number');
    eq(dj.msg, 'Hello Joan, Tuesday 6 Oct’s sales are not all entered yet. The till counted 600k more than the book that evening. Please enter the rest of Tuesday’s invoices today. Thank you.',
      'the message says what the books found, and asks for the entries');
    const hj = SJ.mgrPulseActionHTML(null, dj);
    t.check(hj.startsWith('<a class="btn btn-accent" href="https://wa.me/256772123456?text=Hello%20Joan%2C%20Tuesday%206%20Oct') && /target="_blank" rel="noopener"/.test(hj),
      'and the button opens WhatsApp to 256 772 123456 with it written -- a link the owner taps, nothing sent by the app');
    eq(SJ.mgrPulseDeedNote(dj), 'Opens WhatsApp to Joan with the message written — you send it.', 'said beside the button');
    DJ.staff[0].phone = '';
    const dn = SJ.mgrPulseDeed(SJ.mgrPulseReading().findings.find((x) => x.metric === 'sales'), SJ.mgrPulseBooks(TODAY), SJ.mgrPulseReading());
    t.check(/disabled/.test(SJ.mgrPulseActionHTML(null, dn)) && />No number for Joan<\/button>$/.test(SJ.mgrPulseActionHTML(null, dn)),
      'no number on file: the button says it cannot -- "No number for Joan"');
    eq(SJ.mgrPulseDeedNote(dn), 'Joan Nakato has no phone number on the staff list — add one and this opens WhatsApp with the message written.', 'and why');
    DJ.cashTxns.find((x) => x.date === T(-1) && x.category === 'Sales Revenue').enteredBy = 'OWNER';
    eq(pick(SJ.mgrPulseDeed(SJ.mgrPulseReading().findings.find((x) => x.metric === 'sales'), SJ.mgrPulseBooks(TODAY), SJ.mgrPulseReading())),
      ['day', 'Enter Tuesday’s missing sales', T(-1)], 'the owner recorded the day themself: nobody to message');

    /* A payer on file: a thank-you, written from the payment. */
    const DT = book();
    DT.customers.push({ id: 'C2', name: 'Okello & Sons', phone: '0700 111222' });
    const ST = scope(DT); ST.setNormals([]);
    const dt = deedOf(ST, 'cash_in', 'high');
    eq([dt.kind, dt.label, dt.to.id], ['wa', 'Draft a thank-you to Okello & Sons', 'C2'], '"Payment — Okello & Sons" is the customer on file of that name: a thank-you to them');
    eq(dt.msg, `Hello Okello & Sons, thank you for your payment of ${(3000000).toLocaleString('en-UG')} UGX on Monday 5 Oct. — Nakawa Hardware`, 'for the 3,000,000 they paid on Monday');

    /* A price rise from a supplier on file: bill 77 from S2 brought P4 at
       100,000 each; S2's last P4, on Mon 7 Sept, was 80,000. 10 x 20,000 =
       200,000 more. */
    const DP = book({ bills: true });
    DP.stockLog.push({ id: 6003, key: 'P4', type: 'restock', delta: 5, cost: 80000, supplierId: 'S2', date: T(-30), note: 'Bill B-60 from S2' });
    DP.suppliers = [{ id: 'S2', name: 'Steel & Tube', phone: '0752 200002' }];
    const SP2 = scope(DP); SP2.setNormals([]);
    const dp = deedOf(SP2, 'purchases', 'high');
    eq([dp.kind, dp.label], ['wa', 'Ask Steel & Tube about the 200k rise'], 'ask the supplier about the 200k: 10 at 20,000 over their last price');
    eq(dp.msg, `Hello Steel & Tube, on Monday 5 Oct we were charged ${(100000).toLocaleString('en-UG')} UGX each for P4, against ${(80000).toLocaleString('en-UG')} UGX on ${long(T(-30))} — 10 at ${(20000).toLocaleString('en-UG')} UGX more, ${(200000).toLocaleString('en-UG')} UGX in all. Can you confirm the price, or credit the difference? — Nakawa Hardware`,
      'the message carries both prices, both days and the sum -- a question, never a claim it was owed');
    /* Another supplier's P4 came in between, on Sun 27 Sept at 90,000:
       the shop's last price was theirs, but Steel & Tube is asked about
       its OWN last price, 80,000 -- never someone else's. */
    DP.stockLog.push({ id: 6013, key: 'P4', type: 'restock', delta: 2, cost: 90000, supplierId: 'S3', date: T(-10), note: 'Bill B-61 from S3' });
    const dp3 = deedOf(SP2, 'purchases', 'high');
    eq([dp3.label, dp3.msg], [dp.label, dp.msg], 'with S3 at 90,000 in between, S2 is still asked against its own 80,000 on ' + T(-30));
    /* Only another supplier ever sold P4 before: the rise is found (11%
       over S3's 90,000), but no supplier is asked about a price it never
       charged -- the bills instead. */
    const DP2 = book({ bills: true });
    DP2.stockLog.push({ id: 6014, key: 'P4', type: 'restock', delta: 2, cost: 90000, supplierId: 'S3', date: T(-10), note: 'Bill B-61 from S3' });
    DP2.suppliers = [{ id: 'S2', name: 'Steel & Tube', phone: '0752 200002' }, { id: 'S3', name: 'Mukwano Steel', phone: '0752 300003' }];
    const SP3 = scope(DP2); SP3.setNormals([]);
    const fp3 = SP3.mgrPulseReading().findings.find((x) => x.metric === 'purchases' && x.dir === 'high');
    const rp3 = SP3.mgrPulseReasons(fp3, SP3.mgrPulseBooks(TODAY), SP3.mgrPulseReading()).find((x) => x.label === 'Prices paid went up');
    eq([rp3.state, rp3.ref], ['found', null], 'the rise over S3\'s price is still a reason on screen, with nobody to ask');
    eq(pick(deedOf(SP3, 'purchases', 'high')), ['go', 'Open the bills', 'invoices'], 'and the action is the bills');
    /* A delivery whose own cost is not recorded is never read as a rise
       off today's FIFO cost. */
    const DP4 = book({ bills: true });
    DP4.stockLog.push({ id: 6003, key: 'P4', type: 'restock', delta: 5, cost: 80000, supplierId: 'S2', date: T(-30), note: 'Bill B-60 from S2' });
    DP4.suppliers = [{ id: 'S2', name: 'Steel & Tube', phone: '0752 200002' }];
    DP4.stockLog.filter((l) => l.piId === 77).forEach((l) => { delete l.cost; });
    const SP4 = scope(DP4); SP4.setNormals([]);
    const fp4 = SP4.mgrPulseReading().findings.find((x) => x.metric === 'purchases' && x.dir === 'high');
    t.check(!fp4 || SP4.mgrPulseReasons(fp4, SP4.mgrPulseBooks(TODAY), SP4.mgrPulseReading()).find((x) => x.label === 'Prices paid went up').state === 'none',
      'bill 77 with no cost recorded: no rise is read off a cost the books do not hold');

    /* Returns of one line, last bought from one supplier on file: P1 came
       from S4 on 28 Aug. Four notes of 300,000, three with a lid that does
       not seal. */
    const DR = book();
    DR.stockLog.push({ id: 6004, key: 'P1', type: 'restock', delta: 4, cost: 45000, supplierId: 'S4', date: T(-40), note: 'Bill B-40 from S4' });
    DR.suppliers = [{ id: 'S4', name: 'Bwaise Paints', phone: '0782 400004' }];
    const SR2 = scope(DR); SR2.setNormals([]);
    const dr = deedOf(SR2, 'returns');
    /* WAS: 'Ask Bwaise Paints to credit 1.2m' -- the 4 x 300,000 the shop
       refunded its customers at its own selling price, and the message
       said "1,200,000 UGX credited back to them". NOW: the supplier is
       asked for what the shop paid THEM: 4 units from the 28 Aug delivery
       at 45,000 = 180,000. The refund is not sent to the supplier. */
    const fr = SR2.mgrPulseReading().findings.find((x) => x.metric === 'returns');
    eq([dr.kind, dr.label], ['wa', 'Ask Bwaise Paints to credit 180k'], 'ask the supplier the line came from to credit what was paid them: 4 x 45,000');
    eq(dr.msg, `Hello Bwaise Paints, 4 Gloss 4L we bought from you came back from customers in the 30 days to ${long(fr.date)}, 3 of 4 returns with a fault. We paid you ${(180000).toLocaleString('en-UG')} UGX for them. Can we return them to you for a credit note? — Nakawa Hardware`,
      'counted from the notes and the delivery: 4 units, 3 of the 4 notes giving a fault, 180,000 paid -- over the 30 days the screen counts');
    const lr = SR2.mgrPulseReasons(fr, SR2.mgrPulseBooks(TODAY), SR2.mgrPulseReading()).find((x) => x.label === 'One line keeps coming back').ref;
    eq([lr.refunded, lr.paid, lr.units, lr.supplierId], [1200000, 180000, 4, 'S4'], 'two sums kept apart: 1.2m refunded at the shop\'s price, 180k paid at the delivery\'s cost');
    /* A unit is traced to the delivery before its SALE: each note now
       written two days after its sale, and S5 delivering P1 four days ago
       -- after the last sale (five days ago) and before its note (three
       days ago). Read by the return's day, that note would trace to S5,
       two suppliers would share the line and nobody would be asked. */
    const DR2 = book();
    DR2.stockLog.push({ id: 6004, key: 'P1', type: 'restock', delta: 4, cost: 45000, supplierId: 'S4', date: T(-40), note: 'Bill B-40 from S4' });
    DR2.stockLog.push({ id: 6005, key: 'P1', type: 'restock', delta: 6, cost: 52000, supplierId: 'S5', date: T(-4), note: 'Bill B-41 from S5' });
    DR2.savedQuotes.forEach((q) => (q.creditNotes || []).forEach((n) => { n.date = new Date(Date.parse(n.date + 'T00:00:00Z') + 2 * 86400000).toISOString().slice(0, 10); }));
    DR2.suppliers = [{ id: 'S4', name: 'Bwaise Paints', phone: '0782 400004' }, { id: 'S5', name: 'Kampala Paints Centre', phone: '0782 500005' }];
    const SR3 = scope(DR2); SR3.setNormals([]);
    eq(deedOf(SR3, 'returns').label, 'Ask Bwaise Paints to credit 180k', 'S5\'s delivery after the sales is not where the returned units came from');
    /* The delivery's cost not recorded: the supplier is still asked, but
       no sum is named -- never the refund in its place. */
    const DR3 = book();
    DR3.stockLog.push({ id: 6004, key: 'P1', type: 'restock', delta: 4, supplierId: 'S4', date: T(-40), note: 'Bill B-40 from S4' });
    DR3.suppliers = [{ id: 'S4', name: 'Bwaise Paints', phone: '0782 400004' }];
    const SR4 = scope(DR3); SR4.setNormals([]);
    const dr4 = deedOf(SR4, 'returns');
    eq(dr4.label, 'Ask Bwaise Paints for a credit on Gloss 4L', 'no cost on the delivery: no sum named');
    t.check(!/UGX/.test(dr4.msg) && /Can we return them to you for a credit note\?/.test(dr4.msg), 'and the message names none either: ' + dr4.msg);

    /* A chase: a promise broken, the customer still owing. */
    const base = R.findings.find((x) => x.metric === 'sales');
    const fc = { ...base, metric: 'cash_in', dir: 'low', sig: R.rows.find((r) => r.sig.id === 'cash_in').sig };
    const promise = [{ label: 'A promised payment did not come', state: 'found', detail: '1 of 1 promise for that day not kept.', ref: { customerId: 'C1', amount: 500000 } }];
    D.__debts = [{ id: 'C1', debt: 750000 }];
    const dc = S.mgrPulseDeed(fc, B, R, promise);
    eq([dc.kind, dc.label, dc.customerId], ['chase', 'Chase Kato’s 750k', 'C1'], 'a promise not kept by Kato, who owes 750,000 now: chase Kato\'s 750k');
    t.check(/data-pulse-chase="C1">Chase Kato’s 750k<\/button>/.test(S.mgrPulseActionHTML(null, dc)), 'a button, not a link: it opens Kato in Messages');
    S.mgrPulseChaseOpen('C1');
    eq([S._fup(), D.__went[D.__went.length - 1]], [{ fupTab: 'contact', fupWhy: 'all', fupQueueQuery: '', fupSelectedCustomerId: 'C1' }, 'followups'],
      'Kato\'s own row in Messages, where the hub writes the chase for the owner to send');
    D.__debts = [];
    eq(pick(S.mgrPulseDeed(fc, B, R, promise)), ['go', 'Open the debtors', 'analytics-debtors'], 'paid since: nobody to chase, the debtors');

    /* The till, put on one person ONLY where the books record who closed
       every counted day: Joan closed the nine that balanced, another the
       two flagged. */
    const DC = book();
    DC.staff = [{ id: 'ST1', userId: 'U9', name: 'Joan Nakato', phone: '0772 123456' }];
    Object.keys(DC.cashDays).forEach((d) => { DC.cashDays[d].closedBy = d === T(-1) || d === T(-8) ? 'U7' : 'U9'; });
    const SC = scope(DC); SC.setNormals([]);
    const dj2 = deedOf(SC, 'till', 'high');
    eq([dj2.kind, dj2.label, dj2.basis], ['rule', 'Joan closes until this is explained', 'The books record who closed each counted day; Joan closed 9 that balanced.'],
      'recorded closers: Joan closed the nine balanced days of the fortnight and neither flagged one');
    SC.setRuleOpen(SC.mgrUnusualKey(SC.mgrPulseReading().findings.find((x) => x.metric === 'till' && x.dir === 'high')));
    SC.setOpen(SC.mgrUnusualKey(SC.mgrPulseReading().findings.find((x) => x.metric === 'till' && x.dir === 'high')));
    const hc = SC.mgrUnusualHTML(SC.mgrPulseReading());
    t.check(/<textarea class="mgr-u-rule-in"[^>]*>Joan closes the till every evening until Tue 6 Oct is explained\.<\/textarea>/.test(hc)
      && /data-pulse-rule-keep="2026-10-06\|till">Keep this rule</.test(hc) && /href="https:\/\/wa\.me\/256772123456\?text=[^"]*" target="_blank" rel="noopener">Tell Joan</.test(hc),
      'the rule opens written out, to keep -- and to tell Joan, by a link the owner taps');
    eq((hc.match(/class="btn btn-accent/g) || []).length, 1, 'still one primary action: Keep this rule replaces the rule button');
    DC.cashDays[T(-2)].closedBy = null;
    eq(deedOf(SC, 'till', 'high').label, 'Count the till at every close', 'one counted day with no closer on record: the rule is said of the till, of nobody');
    DC.cashDays[T(-2)].closedBy = 'U9'; DC.cashDays[T(-1)].closedBy = 'U9';
    eq(deedOf(SC, 'till', 'high').label, 'Count the till at every close', 'and Joan closing a flagged day too: nobody is named');
    Object.keys(DC.cashDays).forEach((d) => { DC.cashDays[d].closedBy = d === T(-1) || d === T(-8) ? 'U7' : 'OWNER'; });
    eq(deedOf(SC, 'till', 'high').label, 'You close until this is explained', 'the owner closed the balanced days: "You close"');
    const DN = book(); DN.cashDays[T(-4)] = { actual: { cash: 1000, momo: null, bank: null } };
    const SN2 = scope(DN); SN2.setNormals([]);
    eq([deedOf(SN2, 'till', 'high').label, deedOf(SN2, 'till', 'high').basis], ['Two people count the till until this is explained', 'Said of the till, never of one person: nothing records who counted.'],
      'every day counted and no closers on record: two people count');

    /* Keeping the rule: a normal of its own kind, never applied. */
    const saved = [];
    const SK = scope(book(), { mgrSaveNormal: async (b) => { saved.push(b); return { ok: true, row: { id: 77, status: 'active', date: TODAY, body: { ...b, taughtOn: TODAY } } }; } });
    SK.setNormals([]);
    const tk = SK.mgrUnusualKey(SK.mgrPulseReading().findings.find((x) => x.metric === 'till' && x.dir === 'high'));
    await SK.mgrPulseKeepRule(tk, '  The till is counted at every close.  ');
    eq(saved, [{ metric: 'till', weekday: null, condition: 'house_rule', effect: 'high', note: 'The till is counted at every close.', sourceAnswerId: 'rule:' + tk }],
      'kept as the owner wrote it, against the finding it came from');
    SK.setOpen(tk);
    const hk = SK.mgrUnusualHTML(SK.mgrPulseReading());
    t.check(/<b>Your rule:<\/b> The till is counted at every close\. It is on the Taught list below\./.test(hk) && !/data-pulse-rule=/.test(hk),
      'the finding says the rule is kept, and offers it no more');
    t.check(/Your rule: The till is counted at every close\./.test(hk) && /the books can’t check it, so days like it are still flagged\. The next meeting reads it\./.test(hk),
      'the Taught list carries it as the owner\'s rule, not a normal');
    eq(SK.mgrPulseReading().findings.length, 8, 'and it is never applied: the till is still out of the ordinary');
    const SK2 = scope(book(), { mgrSaveNormal: async () => ({ ok: false, migration: true }), mgrMigrationNote: () => 'Apply 0107_manager_intelligence.sql' });
    SK2.setNormals([]);
    await SK2.mgrPulseKeepRule(tk, 'Two people count.');
    t.check(/Apply 0107_manager_intelligence\.sql/.test(SK2.mgrUnusualHTML(SK2.mgrPulseReading())), 'a rule the journal refuses names the missing update');
    SK2.setOpen(tk); SK2.setRuleOpen(tk);
    t.check(/<textarea class="mgr-u-rule-in"[^>]*>Two people count\.<\/textarea>/.test(SK2.mgrUnusualHTML(SK2.mgrPulseReading())),
      'and the form keeps the owner\'s own words after the refusal, not the drafted rule');
    const gone = [];
    const SK4 = scope(book(), { toast: (m) => gone.push(m), mgrSaveNormal: async (b) => { gone.push(b); return { ok: true }; } });
    SK4.setNormals([]);
    await SK4.mgrPulseKeepRule('2020-01-01|till', 'Two people count.');
    eq(gone, ['That finding is no longer on the list — nothing was kept.'], 'a finding gone from the list keeps nothing, and says so');
    const toasts = [], none = [];
    const SK3 = scope(book(), { toast: (m) => toasts.push(m), mgrSaveNormal: async (b) => { none.push(b); return { ok: true }; } });
    SK3.setNormals([]);
    await SK3.mgrPulseKeepRule(tk, '   ');
    eq([none.length, toasts], [0, ['Write the rule first — it is kept in your words.']], 'an empty rule is not kept, and says so');

    /* No cause, no likelihood, nothing undefined in any action. */
    const bad = /\bbecause\b|thanks to|\bcaused\b|root cause|it worked|probab/i;
    const all = [S, SJ, ST, SP2, SP3, SR2, SR3, SR4, SC, SN2].flatMap((SX) => { const r = SX.mgrPulseReading(); const bk = SX.mgrPulseBooks(TODAY);
      return r.findings.map((f) => SX.mgrPulseDeed(f, bk, r)); });
    const words = all.flatMap((d) => [d.label, d.msg || '', d.text || '', d.basis || '', S.mgrPulseDeedNote(d)]);
    eq(words.filter((w) => bad.test(w) || /undefined|NaN|null/.test(w)), [], 'every action, message and rule: no cause, no likelihood, nothing undefined');
    t.check(all.every((d) => ['wa', 'chase', 'rule', 'day', 'go'].includes(d.kind)), 'and each is one of the five kinds -- none of them sends anything');
  }

  /* ---------- 19. what the meeting reads: the same findings ------------ */
  {
    S.setNormals([]);
    const r = S.mgrPulseReading();
    const low = r.findings.find((x) => x.metric === 'sales');
    const it = S.mgrPulseMeetingItem(low, B, r);
    eq([it.id, it.key, it.date, it.days, it.metric, it.dir, it.tone, it.z, it.figure, it.usual, it.weeks, it.months, it.how_unusual],
      [4, T(-1) + '|sales', T(-1), [T(-1)], 'sales', 'low', 'bad', -5.4, 400000, 1000000, 8, null, 'never before'],
      'the low Tuesday as the meeting reads it: finding 4 on screen, 400,000 against a usual 1,000,000 over 8 Tuesdays, never before');
    eq(it.reads_as, 'Tuesday’s sales were 400k — a Tuesday is usually 938k–1.06m', 'in the screen\'s own words');
    /* WAS: drove_it = the day's own rows, then what the books found (the
       screen's candidate reasons) -- and the meeting names "what drove it"
       from drove_it, so a candidate read as the cause. NOW: drove_it is
       the day's rows only; what the books found is found_in_books. */
    eq(it.drove_it, [S.mgrPulseWhat(low, B)], 'drove_it: the day\'s own rows only');
    eq(it.found_in_books, ['The till counted 600k more than the book that evening.', 'Kato buys on 8 of the last 8 Tuesdays — nothing this one.',
      'Iron sheets was at nothing on the shelf — it sells on 8 of the last 8 Tuesdays.'],
      'found_in_books: what the books found alongside the day -- details only, never the reason they point to');
    const ret = S.mgrPulseMeetingItem(r.findings.find((x) => x.metric === 'returns'), B, r);
    eq([ret.figure, ret.usual, ret.weeks, ret.months, ret.days], [1200000, 0, null, 5, [T(-11), T(-5)]], 'a month of returns: 1.2m against a usual month of none, over five months, on its two days');
    const q = S.mgrPulseMeetingItem(r.findings.find((x) => x.metric === 'quotes'), B, r);
    eq([q.figure, q.usual], [0, 8], 'a count is said in things');

    /* The meeting's reader: normals and answers read first. */
    const sb = fakeSb((qq) => qq.op === 'select' ? { data: [{ id: 5, body: { unusualDay: T(-1), metric: 'sales', answer: 'Not entered yet', learn: 'job' } }], error: null } : { data: null, error: null });
    const SM = scope(book(), { sb, mgrNotesOfKind: async () => ({ rows: [{ id: 7, status: 'active', date: T(-2), body: { metric: 'till', condition: 'house_rule', effect: 'high', note: 'Two people count the till.', sourceAnswerId: 'rule:x', taughtOn: T(-2) } }], error: null }) });
    const m = await SM.mgrUnusualForMeeting();
    eq([m.judged, m.items.map((x) => x.id), m.items.map((x) => x.metric + '.' + x.dir)],
      [true, [1, 2, 3, 4, 5, 6, 7, 8], ['till.high', 'returns.high', 'till.low', 'sales.low', 'purchases.high', 'quotes.low', 'stock_short.high', 'cash_in.high']],
      'the meeting reads the eight findings the screen shows, in its order');
    eq([m.answered(T(-1) + '|sales'), m.answered(T(-2) + '|purchases'), m.answersError], ['Not entered yet', null, null], 'with the owner\'s answers known');
    eq(m.taught, [{ what: 'till', kind: 'your_rule', words: 'Two people count the till.', taught_on: T(-2) }], 'and what the owner taught, the rule marked as theirs');
    const SF = scope(book(), { sb: fakeSb(() => ({ data: null, error: { message: 'timeout' } })) });
    eq((await SF.mgrUnusualForMeeting()).answersError, 'timeout', 'a failed read of the answers is carried, to be named');
    const SG = scope(book(), { mgrNotesOfKind: async () => ({ rows: [], error: 'journal offline' }) });
    const mg = await SG.mgrUnusualForMeeting();
    eq([mg.normalsError, mg.taught], ['journal offline', []], 'and so is a failed read of what the owner taught -- never "taught nothing"');
  }
  process.exit(t.done() ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

