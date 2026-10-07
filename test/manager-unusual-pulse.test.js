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
    sb: null, currentShopId: 'S1', toast: () => {}, saveData: () => {}, goToTab: () => {}, dayShown: null,
    document: { addEventListener: () => {}, getElementById: () => null, querySelector: () => null }, window: {},
    esc: (v) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'),
  }, extra || {});
  delete env.mgrShortUGX;
  return compileScope([
    real('anShiftDate'), real('liveCreditNotes'), real('cashIsMoneyIn'), real('cashIsMoneyOut'), real('cashIsCashOverage'),
    real('cashIsCashShortage'), real('cbIsTransfer'), real('cashIsDebtCollection'), real('cashIsTradingIncome'),
    real('stockLogIsCount'), real('stockCountIndex'), real('invCountRecords'), real('invCountMoment'),
    real('unusualSpread'), real('mgrShortUGX'), real('mgrDept'), real('stockKey'),
    decl('CASH_SHORTAGE_CATEGORY'), decl('CASH_OVERAGE_CATEGORY'), decl('CASH_TRANSFER_CATEGORY'), decl('CASH_NOT_REVENUE'), decl('cashHas'),
    decl('INV_NOT_A_COUNT'), decl('ACCOUNTS'), decl('UNUSUAL_WEEKS'), decl('UNUSUAL_MIN'), decl('UNUSUAL_Z'), decl('MGR_DEPTS'),
    block,
    'function setNormals(rows){ mgrPulseNormals = { rows, error: null, day: todayISO(), loaded: true, writeError: null }; }',
    'function setOpen(k){ mgrUnusualOpen = k; }',
  ], env, ['mgrPulseBooks', 'mgrPulseJudge', 'mgrPulseBand', 'mgrPulseQuartiles', 'mgrPulseNormalRule', 'mgrPulseNormalApplies',
    'mgrPulseNormalOf', 'mgrPulseAnswerSet', 'mgrPulseTitle', 'mgrPulseImpact', 'mgrPulseRarity', 'mgrPulseWhen', 'mgrPulseReasons',
    'mgrPulseLearnt', 'mgrPulseVerdict', 'mgrPulseReading', 'mgrUnusualHTML', 'mgrNavCountUnusual', 'mgrPulseMinGap', 'setNormals',
    'mgrUnusualKey', 'mgrPulseFig', 'setOpen']);
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
  [T(-25), T(-20), T(-11), T(-5)].forEach((d, n) => {
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
  if (o.fuel) for (let i = 30; i >= 1; i--) data.cashTxns.push({ id: 90000 + i, date: T(-i), type: 'payment', account: 'cash', category: 'Fuel', amount: 40000 });
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
  eq(rc[0].detail, '1 debt payment, 3m — a usual Monday collects 0; the largest Payment — Okello & Sons, 3m.', 'with what was paid against a usual Monday');
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
  t.check(/data-unusual-day="2026-10-06">Open Tue 6 Oct</.test(html), 'and its one action opens the day');
  t.check(/Out of the ordinary<\/span><b class="mgr-u-hd-v">8<\/b>/.test(html) && /Good news<\/span><b class="mgr-u-hd-v mgr-u-hd-good">1<\/b>/.test(html)
    && /Need your answer<\/span><b class="mgr-u-hd-v mgr-u-hd-warn">7<\/b>/.test(html), 'the band counts: 8 found, 1 good news, 7 problems still waiting');
  t.check(/Nothing taught yet/.test(html), 'and an empty Taught list says how to fill it');
  eq(S.mgrNavCountUnusual({}), { n: 8, note: '<b>8 unusual things</b> need your answer' }, 'the nav: eight in the fortnight, eight without an answer');
}

process.exit(t.done() ? 1 : 0);
