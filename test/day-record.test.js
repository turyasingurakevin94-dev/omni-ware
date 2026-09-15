#!/usr/bin/env node
'use strict';
/*
 * The day.
 *
 * Every record in this app carries a date and nothing ever read a day
 * ACROSS them, so a shop that wanted to look back at last Tuesday had
 * to piece it together from four screens — and the assistant, asked
 * something at four in the afternoon after a page reload, knew nothing
 * about the meeting held at eight.
 *
 * Both were the same gap: a day was nowhere on record. One derivation
 * closes both — the screen renders it, and the first question of a
 * thread carries today's.
 *
 * The laws this file guards:
 *
 *   AS AT THAT DAY      the one law that separates looking back from
 *                       being briefed. morningBriefData deliberately
 *                       mixes in debts and follow-ups as they stand NOW
 *                       and says so; under a heading that reads Tuesday
 *                       that would be this afternoon's debtors wearing
 *                       Tuesday's date.
 *   MONEY, NOT BOOKKEEPING  who paid comes through debtCollectionsOn,
 *                       where the cashTxnId law already lives. A second
 *                       reading of debtLog here would be a second
 *                       chance to count an invoice sync's echo as cash.
 *   LOOKING WRITES NOTHING  the cash line is derived from the txns.
 *                       cbDayPosition calls getDayRecord, which CREATES
 *                       a day row — rendering a date must never write
 *                       one into the cash book.
 *   A QUIET DAY SAYS SO padding an empty Tuesday is how a screen
 *                       teaches the eye to skip it on a busy one.
 *   OPEN MEANS OPEN     the thread line never reports a move the owner
 *                       has settled as still waiting on them.
 *   RUN IT, DON'T READ IT  these checks call the functions.
 *
 * Run: node test/day-record.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('the day');
const src = read('index.html');
const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);

const TODAY = '2026-08-28';
const TUE = '2026-08-25';
const shift = (iso, n) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

/* Three days that differ in every particular, so a reading that quietly
   answers about the wrong one cannot come out right by accident:
   Tuesday sold and collected, today sold something else, and Wednesday
   between them is empty. */
const books = () => ({
  savedQuotes: [
    { id: 'Q1', status: 'completed', invoiced: true, invoicedAt: TUE, stageEnteredAt: TUE + 'T09:00:00Z',
      client: { name: 'Milly' }, customerId: 7, total: 400000,
      payments: [{ date: TUE, amount: 150000, cashTxnId: 'T1' }] },
    { id: 'Q2', status: 'completed', invoiced: true, invoicedAt: TUE, stageEnteredAt: TUE + 'T15:00:00Z',
      client: { name: 'Milly' }, customerId: 7, total: 100000, payments: [] },
    { id: 'Q3', status: 'completed', invoiced: true, invoicedAt: TODAY, stageEnteredAt: TODAY + 'T10:00:00Z',
      client: { name: 'Dad' }, customerId: 8, total: 900000, payments: [] },
    { id: 'Q4', status: 'preparing', invoiced: false, stageEnteredAt: TUE + 'T11:00:00Z',
      client: { name: 'Kevin' }, total: 50000, payments: [] },
    /* Voided: a cancelled sale is not a day's work. */
    { id: 'Q5', status: 'completed', invoiced: true, invoicedAt: TUE, voided: true,
      client: { name: 'Ghost' }, total: 999000, payments: [] },
  ],
  customers: [
    { id: 7, name: 'Milly', debtLog: [
      { type: 'payment', amount: 200000, date: TUE, cashTxnId: 'T2' },
      /* THE ECHO. An invoice sync's own row: bookkeeping, not money. */
      { type: 'payment', amount: 777000, date: TUE, quoteId: 'Q1' },
    ] },
    { id: 8, name: 'Dad', debtLog: [] },
  ],
  /* Every cash total in the app filters on an exact account id, so a
     row carrying none is invisible to all of them. The closing check
     below reads per account, and a fixture without one would have it
     reconciling a drawer nothing was ever put into. */
  cashTxns: [
    { id: 'T1', date: TUE, account: 'cash', type: 'receipt', amount: 150000 },
    { id: 'T2', date: TUE, account: 'cash', type: 'receipt', amount: 200000 },
    { id: 'T3', date: TUE, account: 'cash', type: 'payment', amount: 60000 },
    { id: 'T4', date: TODAY, account: 'cash', type: 'receipt', amount: 5000 },
  ],
  stockLog: [
    { key: 'P1', label: 'Cement', type: 'restock', delta: 40, qtyAfter: 44, date: TUE, note: 'Roto' },
    { key: 'P2', label: 'Runners', type: 'sale', delta: -6, qtyAfter: 0, date: TUE },
    { key: 'P3', label: 'Hinges', type: 'count', delta: -2, qtyAfter: 18, date: TUE },
    { key: 'P4', label: 'Nails', type: 'sale', delta: -3, qtyAfter: 9, date: TUE },
    { key: 'P5', label: 'Pipes', type: 'restock', delta: 10, qtyAfter: 10, date: TODAY },
  ],
  paymentPromises: [
    { id: 1, customerId: 7, madeOn: TUE, promisedOn: '2026-09-10', amount: 300000 },
    { id: 2, customerId: 8, madeOn: TODAY, promisedOn: '2026-09-01', amount: null },
  ],
});

const scope = (data) => compileScope([
  extractFunction(src, 'dayRecord', 'index.html'),
  /* THE STAMP IS A NUMBER. The board keeps stageEnteredAt as
     milliseconds, and the day used to read it as a string -- so no
     order ever moved on any day. The reader that gets both right is
     real code, and is compiled here so the fixtures' ISO stamps and the
     app's numeric ones are both exercised. */
  extractFunction(src, 'dayStampISO', 'index.html'),
  /* THE REAL ONES. Whether a day reads its own date rather than today's
     is decided inside these, so stubbing them would leave the claim
     this file exists to make untested. */
  extractFunction(src, 'anInvoicesInRange', 'index.html'),
  extractFunction(src, 'debtCollectionsOn', 'index.html'),
  extractFunction(src, 'debtLogIsInvoiceOwned', 'index.html'),
  extractFunction(src, 'cashIsMoneyIn', 'index.html'),
  extractDeclaration(src, 'DAY_ROWS', 'index.html'),
], {
  data,
  todayISO: () => TODAY, anShiftDate: shift,
  savedQuoteTotal: (q) => Number(q.total) || 0,
  anOverallTotals: (inv) => ({ count: inv.length,
    sales: inv.reduce((n, q) => n + (Number(q.total) || 0), 0),
    profit: inv.length * 1000, estimatedQty: 0 }),
  /* WHAT EACH BUYER WAS WORTH. The day now costs its buyers through the
     same reading the statements make, so the eight rows on screen add up
     to the gross profit in the strip above them instead of to a second
     opinion about it. Stubbed at a tenth of the sale, which is enough
     for the rows to be checked against each other. */
  anInvoiceTotals: (q) => ({ sales: Number(q.total) || 0, cost: 0,
    profit: Math.round((Number(q.total) || 0) / 10), estimatedQty: 0 }),
  invoiceNumberLabel: (q) => 'INV-' + String(q.id),
  /* HOW IT ARRIVED. debtCollectionsOn carries the account and the
     invoice on the row now, so the screen never reads either source a
     second time -- a second reading is a second chance to get the
     cashTxnId law wrong. */
  accountLabel: (k) => ({ cash: 'Cash', momo: 'Mobile Money', bank: 'Bank' })[k] || k || '',
  Date,
  SQ_STATUSES: { completed: { label: 'Completed' }, preparing: { label: 'Being Prepared' } },
  Math, Number, String, Array, Object, Map, Set,
}, ['dayRecord']).dayRecord;

/* ---------- 1. a day is that day ------------------------------------ */
{
  const d = scope(books())(TUE);

  eq(d.date, TUE, 'the record is stamped with the day it read');
  eq(d.sold.count, 2, 'Tuesday sold what Tuesday sold — the voided one is a cancelled sale, not a day’s work');
  eq(d.sold.total, 500000, 'and its total is Tuesday’s');
  eq(d.sold.clients.length, 1, 'one buyer that day');
  eq(d.sold.clients[0].name, 'Milly', 'named, not counted');
  eq(d.sold.clients[0].orders, 2, 'with how many times they came');
  eq(d.sold.clients[0].total, 500000, 'and what they spent');
  eq(d.sold.clients[0].profit, 50000, 'and what the shop kept of it, costed the way the statements cost it');

  /* AS AT THAT DAY. Today sold 900,000 to a different customer; a
     reading that reached for now instead of the date would say so. */
  const now = scope(books())(TODAY);
  eq(now.sold.total, 900000, 'today is a different day with different figures');
  eq(now.sold.clients[0].name, 'Dad', 'and a different buyer');
  t.check(d.sold.total !== now.sold.total,
    'the two days differ, so a reading that answered about the wrong one could not come out right by accident');
}

/* ---------- 2. money, not bookkeeping -------------------------------- */
{
  const d = scope(books())(TUE);
  /* 150,000 through the order's own payment and 200,000 on the ledger,
     both carrying a cash link. The 777,000 echo row carries a quoteId
     and no cash link, and is the invoice sync talking to itself. */
  eq(d.paid.total, 350000, 'only money that actually arrived is money collected');
  eq(d.paid.count, 1, 'from one person');
  eq(d.paid.rows[0].name, 'Milly', 'named');
  t.check(d.paid.total !== 1127000,
    'the invoice sync’s echo row is bookkeeping and is not counted — the debtCollectionsOn law, applied once');
}

/* ---------- 3. the shelf, in three kinds ----------------------------- */
{
  const d = scope(books())(TUE);
  eq(d.stock.inCount, 1, 'one delivery');
  eq(d.stock.in[0].line, 'Cement', 'named');
  eq(d.stock.in[0].note, 'Roto', 'with whatever the row said about it');
  eq(d.stock.outCount, 2, 'two movements out');
  /* A COUNT IS NEITHER. It is the shop correcting its own record, which
     is a different fact about the day, and folding it in with sales
     would make a stock-take look like trade. */
  eq(d.stock.countedCount, 1, 'and a count kept apart from both');
  eq(d.stock.counted[0].line, 'Hinges', 'named as a count');
  t.check(!d.stock.out.some((s) => s.line === 'Hinges'), 'a count is not a sale');
  t.check(!d.stock.in.some((s) => s.line === 'Hinges'), 'nor a delivery');

  /* Crossed to nothing on this day: the morning brief's own test, so
     the two readings can never disagree about what ran out. */
  eq(d.stock.ranOut.length, 1, 'one line crossed to nothing');
  eq(d.stock.ranOut[0].line, 'Runners', 'and it is named');
  t.check(!d.stock.ranOut.some((s) => s.line === 'Nails'),
    'a line that merely went down did not run out');
}

/* ---------- 4. orders, and the days customers named ------------------ */
{
  const d = scope(books())(TUE);
  eq(d.orders.movedCount, 1, 'one order moved and had not finished');
  eq(d.orders.moved[0].client, 'Kevin', 'named');
  eq(d.orders.moved[0].stage, 'Being Prepared', 'with where it got to');
  eq(d.orders.completedCount, 2, 'and two finished that day');
  eq(d.promises.length, 1, 'one customer named a day, that day');
  eq(d.promises[0].name, 'Milly', 'named');
  eq(d.promises[0].said, '2026-09-10', 'with the day they named');
  eq(d.cash.in, 350000, 'cash in is what the txns say');
  eq(d.cash.out, 60000, 'and cash out likewise');

  /* LOOKING WRITES NOTHING. cbDayPosition calls getDayRecord, which
     creates a day row when one is missing — so a screen somebody merely
     opened would write a day into the cash book. The day record must
     never reach for it. */
  /* Comments stripped first: the function EXPLAINS why it does not
     reach for cbDayPosition, and a check that read the explanation as
     the offence would fail on the very code that gets it right. */
  const fn = extractFunction(src, 'dayRecord', 'index.html')
    .replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(?<!:)\/\/.*$/gm, ' ');
  t.check(!/cbDayPosition|getDayRecord/.test(fn),
    'the day derives cash from the txns and never through the reader that creates a day row');
  t.check(/data\.cashTxns/.test(fn), 'it reads the txns themselves');
}

/* ---------- 5. a quiet day says so ----------------------------------- */
{
  const quiet = scope(books())('2026-08-26');
  eq(quiet.quiet, true, 'a day with nothing in it says so');
  eq(quiet.sold.count, 0, 'nothing sold');
  eq(quiet.paid.count, 0, 'nobody paid');
  eq(quiet.stock.inCount + quiet.stock.outCount + quiet.stock.countedCount, 0, 'nothing moved');
  eq(scope(books())(TUE).quiet, false, 'while a day that did something does not claim to be quiet');

  /* A day with ONLY a cash entry is not quiet — the till moved. */
  const cashOnly = scope({ ...books(), savedQuotes: [], customers: [], stockLog: [],
    paymentPromises: [], cashTxns: [{ id: 'X', date: TUE, type: 'payment', amount: 1000 }] })(TUE);
  eq(cashOnly.quiet, false, 'one cash entry is a day that did something');
}

/* ---------- 5b. one day, three ways of naming it ---------------------- */
{
  /* The screen called every day by one label and used it in three
     places, so it printed "Nothing was recorded on Today." and headed
     an ordinary Tuesday "25 Aug 2026 — 25 Aug 2026". A heading, a
     sentence and a date are three different jobs. */
  const view = extractFunction(src, 'renderDay', 'index.html');
  t.check(/Nothing was recorded \$\{esc\(phrase\)\}/.test(view),
    'the empty state says it in a sentence — "recorded today", never "recorded on Today"');
  t.check(/const phrase = named \? named\.toLowerCase\(\) : 'on ' \+ fmtShortDate\(day\)/.test(view),
    'so Today and Yesterday go in lower case with no "on", and a date keeps its "on"');
  /* THE THIRD JOB HAS GONE, and this is the assertion that changed.
     `tail` existed to bolt the date onto a heading that was sometimes
     the WORD "Today" and sometimes already the date — a conditional
     that could only ever be right by remembering to be, and the pair of
     assertions here pinned that conditional rather than the thing it
     was for.

     The heading is now ALWAYS the date in full, with its weekday, and
     it has to be: the comparison beside it is keyed on the weekday, and
     a heading reading "Today" hides the one fact a reader needs to
     check that claim. The word Today or Yesterday is still said — as a
     chip next to the date instead of in place of it — so nothing was
     lost, and the bug that printed "25 Aug 2026 — 25 Aug 2026" cannot
     be written again because there is no longer a string with two
     things in it to get wrong.

     `phrase` is untouched above: a sentence still needs "recorded
     today", never "recorded on Today". */
  t.check(/const heading = dayLongDate\(day\);/.test(view),
    'the heading is always the full date with its weekday, whatever day is being read');
  t.check(!/\btail\b/.test(view),
    'and there is no second half left to remember to append');
  t.check(/named \? `<span class="ow-cp ow-dy-hc">\$\{esc\(named\)\}<\/span>`/.test(view),
    'Today and Yesterday are said as a chip BESIDE the date, so naming a day never costs its weekday');
  t.check(!/mgr-sec-title/.test(view),
    'and the day no longer wears the Manager screen’s section title — it has a panel header of its own');
}

/* ---------- 5d. was it a good day ------------------------------------ */
{
  /* The question the screen could not answer. Four figures stood at the
     top of it with nothing behind them, and 11,540,000 is a strong
     Tuesday or a poor one depending on facts the owner was left to hold
     in their head. Every clause of the comparison is load-bearing and
     every one of them is checked here. */
  const day = (iso, total) => ({ id: 'X' + iso, status: 'completed', invoiced: true,
    invoicedAt: iso, client: { name: 'Someone' }, total, payments: [] });
  /* Five Tuesdays with data, one Tuesday with none in the middle of
     them, and a MONDAY carrying a figure large enough that a reading
     which ignored the weekday could not come out right by accident. */
  const weeks = () => ({
    savedQuotes: [
      day('2026-08-18', 300000), day('2026-08-04', 500000),
      day('2026-07-28', 2000000), day('2026-07-21', 400000), day('2026-07-14', 600000),
      day('2026-08-24', 9000000),
    ],
    customers: [], cashTxns: [], stockLog: [], paymentPromises: [],
  });

  const cmpScope = (data) => compileScope([
    extractFunction(src, 'dayTypical', 'index.html'),
    extractFunction(src, 'dayCompare', 'index.html'),
    extractFunction(src, 'dayDelta', 'index.html'),
    extractFunction(src, 'dayPulse', 'index.html'),
    extractFunction(src, 'dayMedian', 'index.html'),
    extractFunction(src, 'anInvoicesInRange', 'index.html'),
    extractFunction(src, 'debtCollectionsOn', 'index.html'),
    extractFunction(src, 'debtLogIsInvoiceOwned', 'index.html'),
    extractFunction(src, 'cashIsMoneyIn', 'index.html'),
    extractDeclaration(src, 'DAY_TYPICAL_N', 'index.html'),
    extractDeclaration(src, 'DAY_TYPICAL_MIN', 'index.html'),
  ], {
    data, todayISO: () => TODAY, anShiftDate: shift,
    anOverallTotals: (inv) => ({ count: inv.length,
      sales: inv.reduce((n, q) => n + (Number(q.total) || 0), 0), profit: 0, estimatedQty: 0 }),
    anInvoiceTotals: (q) => ({ sales: Number(q.total) || 0, cost: 0, profit: 0, estimatedQty: 0 }),
    invoiceNumberLabel: (q) => 'INV-' + String(q.id),
    accountLabel: (k) => k || '', Date,
    Math, Number, String, Array, Object, Map, Set,
  }, ['dayTypical', 'dayCompare', 'dayDelta']);

  const typ = cmpScope(weeks()).dayTypical(TUE);

  /* THE SAME WEEKDAY. A wholesaler's week is not flat, and the Monday
     before is a different trade from the Tuesday. */
  eq(typ.count, 5, 'five earlier days of the same weekday were found');
  t.check(typ.days.every((d) => shift(d, 7 * Math.round((Date.parse(TUE) - Date.parse(d)) / 604800000)) === TUE),
    'and every one of them is a Tuesday');
  t.check(!typ.days.includes('2026-08-24'), 'the Monday before is not one of them, whatever it sold');

  /* THE MIDDLE, NOT THE MEAN. 2,000,000 on one Tuesday is a lorry-load,
     and a mean would let it rewrite what typical means for a month. */
  eq(typ.sales, 500000, 'typical is the MIDDLE of them');
  t.check(typ.sales !== 780000, 'and not the average, which one lorry-load would have dragged up by half');

  /* A DATE WITH NOTHING ON IT is not a quiet Tuesday, it is a Tuesday
     before the books started — and counting it as a zero drags the
     middle down and calls every real day exceptional. */
  t.check(!typ.days.includes('2026-08-11'),
    'a Tuesday with nothing at all on record is skipped rather than counted as a zero');
  t.check(typ.days.includes('2026-07-14'),
    'and the sample reaches further back to make up its five');

  /* AT LEAST THREE. A middle drawn from two days is a coin toss wearing
     a percentage, and saying so is an answer. */
  const thin = cmpScope({ savedQuotes: [day('2026-08-18', 300000), day('2026-08-11', 500000)],
    customers: [], cashTxns: [], stockLog: [], paymentPromises: [] }).dayCompare(TUE);
  eq(thin.state, 'thin', 'two earlier Tuesdays are not enough to draw a middle from');
  eq(thin.count, 2, 'and the screen is told how many there were, so it can say so');

  /* A PART DAY IS NOT COMPARABLE WITH WHOLE ONES. A sale carries a date
     and no time, so there is no way to ask where a typical Tuesday
     stood at ten to five — and an unfinished day set beside five
     finished ones reads as a bad day every afternoon of its life. */
  eq(cmpScope(weeks()).dayCompare(TODAY).state, 'open',
    'today is compared with nothing, because a part day beside whole ones is not a comparison');
  eq(cmpScope(weeks()).dayCompare('2026-09-30').state, 'open', 'and neither is a day that has not happened');
  eq(cmpScope(weeks()).dayCompare(TUE).state, 'ok', 'while a finished day with enough behind it is compared');

  /* ONLY UPWARDS IS TONED. A day above its typical is genuinely good; a
     day below it is an ordinary day, and a screen that reaches for
     crimson every average Tuesday teaches the eye to stop reading the
     colour. */
  const delta = cmpScope(weeks()).dayDelta;
  eq(delta(600000, 500000).tone, 'good', 'a day above typical is said in the good colour');
  eq(delta(400000, 500000).tone, '', 'a day below it is ink, not a warning');
  eq(delta(500000, 500000).dir, 'flat', 'and a day on it is neither');
  eq(delta(400000, 500000).text, '20% below', 'the figure is how far off, said plainly');
  eq(delta(50000, 0).text, 'nothing typical to compare with',
    'and a typical of nothing cannot be divided into, so it says that rather than an infinite rise');
}

/* ---------- 5e. is the day properly on the record -------------------- */
{
  /* THE CLOSING JOB, and the one the old screen could not do at all: a
     Tuesday where nobody opened the cash book looked exactly like a
     Tuesday that reconciled to the shilling. */
  const closScope = (data) => compileScope([
    extractFunction(src, 'dayClosing', 'index.html'),
    extractFunction(src, 'dayCashPosition', 'index.html'),
    extractFunction(src, 'dayRecord', 'index.html'),
  /* THE STAMP IS A NUMBER. The board keeps stageEnteredAt as
     milliseconds, and the day used to read it as a string -- so no
     order ever moved on any day. The reader that gets both right is
     real code, and is compiled here so the fixtures' ISO stamps and the
     app's numeric ones are both exercised. */
  extractFunction(src, 'dayStampISO', 'index.html'),
    extractFunction(src, 'cbAccountTotals', 'index.html'),
    extractFunction(src, 'carriedOpening', 'index.html'),
    extractFunction(src, 'previousCashDate', 'index.html'),
    extractFunction(src, 'cbClosingFor', 'index.html'),
    extractFunction(src, 'anInvoicesInRange', 'index.html'),
    extractFunction(src, 'debtCollectionsOn', 'index.html'),
    extractFunction(src, 'debtLogIsInvoiceOwned', 'index.html'),
    extractFunction(src, 'cashIsMoneyIn', 'index.html'),
    extractDeclaration(src, 'ACCOUNTS', 'index.html'),
    extractDeclaration(src, 'DAY_ROWS', 'index.html'),
  ], {
    data, todayISO: () => TODAY, anShiftDate: shift,
    fmtUGX: (n) => String(n),
    savedQuoteTotal: (q) => Number(q.total) || 0,
    anOverallTotals: (inv) => ({ count: inv.length,
      sales: inv.reduce((n, q) => n + (Number(q.total) || 0), 0), profit: 0, estimatedQty: 0 }),
    anInvoiceTotals: (q) => ({ sales: Number(q.total) || 0, cost: 0, profit: 0, estimatedQty: 0 }),
    invoiceNumberLabel: (q) => 'INV-' + String(q.id),
    accountLabel: (k) => k || '', Date,
    SQ_STATUSES: { completed: { label: 'Completed' } },
    Math, Number, String, Array, Object, Map, Set,
  }, ['dayClosing', 'dayCashPosition']);

  const withBook = (cashDays) => ({ ...books(), cashDays });

  /* Nobody opened it. */
  const never = closScope(withBook({})).dayClosing(TUE);
  eq(never.checks[0].mark, 'warn', 'a day whose cash book was never opened says so');
  eq(never.act.label, 'Open the cash book', 'and the one thing to do is to open it');
  eq(never.closed, false, 'such a day is not closed');

  /* Opened, but the drawer was never counted. Counting is what closes
     a day: until then the till figure is what the book says rather than
     what is in the drawer. */
  const open = closScope(withBook({ [TUE]: { openingSet: true,
    opening: { cash: 100000, momo: 0, bank: 0 }, actual: { cash: null, momo: null, bank: null } } }))
    .dayClosing(TUE);
  eq(open.checks[0].mark, 'good', 'an opened book is a good mark');
  eq(open.act.label, 'Count the till', 'and the one thing left to do is to count');

  /* Counted, and short. This is the state the old screen had no way of
     showing, because it never read the count at all. */
  const short = closScope(withBook({ [TUE]: { openingSet: true,
    opening: { cash: 0, momo: 0, bank: 0 },
    actual: { cash: 200000, momo: 0, bank: 0 } } })).dayClosing(TUE);
  /* 350,000 came in and 60,000 went out on the cash account in the
     books above, so the book says 290,000 and the drawer held 200,000. */
  eq(short.pos.accounts[0].variance, -90000, 'the shortfall is the count against the book');
  eq(short.checks[1].mark, 'bad', 'and a drawer that disagrees with the book is the one bad mark on this screen');
  eq(short.closed, false, 'a day that does not add up is not a closed day');

  /* Counted, and agreed, with nothing waiting on an invoice. There is
     then nothing to do here, and the accent leaves this panel. */
  const done = closScope({ ...books(), savedQuotes: books().savedQuotes.filter((q) => q.id !== 'Q4'),
    cashDays: { [TUE]: { openingSet: true, opening: { cash: 0, momo: 0, bank: 0 },
      actual: { cash: 290000, momo: 0, bank: 0 } } } }).dayClosing(TUE);
  eq(done.act, null, 'a day already opened, counted and agreed has nothing left to do');
  eq(done.closed, true, 'and says it is closed');

  /* LOOKING WRITES NOTHING. cbDayPosition calls getDayRecord, which
     CREATES a day row when one is missing — so merely looking at last
     Tuesday would write last Tuesday into the cash book, and the shop
     would find a day it never opened sitting in its own books. */
  const live = withBook({});
  closScope(live).dayClosing(TUE);
  eq(Object.keys(live.cashDays).length, 0,
    'reading a day that was never opened does not create it in the cash book');
  const fn = extractFunction(src, 'dayCashPosition', 'index.html')
    .replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(?<!:)\/\/.*$/gm, ' ');
  t.check(!/cbDayPosition|getDayRecord/.test(fn),
    'and the reading is its own, never through the reader that creates a day row');
}

/* ---------- 5c. the review never prints a bare zero to the owner ------ */
{
  const line = compileScope([extractFunction(src, 'reviewChaseLine', 'index.html')],
    { fmtUGX: (n) => String(n), Math, Number }, ['reviewChaseLine']).reviewChaseLine;

  /* THE REPAIR REACHED THE MANAGER AND NOT THE SCREEN. week_review_data
     learned to say when its headline cannot be read; the review card
     went on printing "after chases 0 UGX" to the one person who would
     act on it. */
  eq(line({ collected_after_chases: 300000, chases_advised: 2, customers_chased: 1 }),
    'after chases 300000', 'a figure that can be traced is a figure');
  eq(line({ collected_after_chases: 0, chases_advised: 2, customers_chased: 0 }),
    'no chase said who it was about',
    'and a zero that means nobody was named says THAT, not nothing collected');
  eq(line({ collected_after_chases: 0, chases_advised: 0, customers_chased: 0 }),
    'no chases were advised',
    'a week that advised no chase at all is a third answer again');
  /* Reviews written before the accounting existed carry no such record,
     and asserting 0 for them would be claiming something this app has
     no way to know. */
  eq(line({ collected_after_chases: 0 }), 'after chases — not measured',
    'and a review from before the record was kept says so rather than asserting a zero');
  eq(line({}), 'after chases — not measured', 'an empty week is the same admission');

  /* The journal has to keep the difference or the screen cannot draw it. */
  const save = extractFunction(src, 'managerSaveReview', 'index.html');
  t.check(/chases_advised: Number\(adv\.chases_advised\)\|\|0/.test(save),
    'the review stores how many chases were advised');
  t.check(/customers_chased: Number\(adv\.customers_chased\)\|\|0/.test(save),
    'and how many of them named somebody');
  t.check(/\$\{esc\(reviewChaseLine\(wk\)\)\}/.test(src),
    'and the card draws the sentence rather than the number');
}

/* ---------- 6. the thread picks the day up --------------------------- */
{
  const journal = (meeting, moves) => ({ from: () => { const q = { _kind: null };
    q.select = () => q; q.order = () => q; q.limit = () => Promise.resolve({ data: q._kind === 'meeting' ? meeting : moves, error: null });
    q.eq = (c, v) => { if (c === 'kind') q._kind = v; return q; };
    q.then = (res) => res({ data: q._kind === 'meeting' ? meeting : moves, error: null });
    return q; } });

  const line = async (data, sb, hasTable) => compileScope([
    extractFunction(src, 'dayThreadLine', 'index.html'),
    extractFunction(src, 'dayRecord', 'index.html'),
  /* THE STAMP IS A NUMBER. The board keeps stageEnteredAt as
     milliseconds, and the day used to read it as a string -- so no
     order ever moved on any day. The reader that gets both right is
     real code, and is compiled here so the fixtures' ISO stamps and the
     app's numeric ones are both exercised. */
  extractFunction(src, 'dayStampISO', 'index.html'),
    extractFunction(src, 'anInvoicesInRange', 'index.html'),
    extractFunction(src, 'debtCollectionsOn', 'index.html'),
    extractFunction(src, 'debtLogIsInvoiceOwned', 'index.html'),
    extractFunction(src, 'cashIsMoneyIn', 'index.html'),
    extractDeclaration(src, 'DAY_ROWS', 'index.html'),
    extractDeclaration(src, 'DAY_THREAD_MAX', 'index.html'),
  ], {
    data, sb, managerNotesTable: hasTable, currentShopId: 'shop-1',
    todayISO: () => TODAY, anShiftDate: shift,
    fmtUGX: (n) => String(n),
    savedQuoteTotal: (q) => Number(q.total) || 0,
    anOverallTotals: (inv) => ({ count: inv.length,
      sales: inv.reduce((n, q) => n + (Number(q.total) || 0), 0), profit: 0, estimatedQty: 0 }),
    anInvoiceTotals: (q) => ({ sales: Number(q.total) || 0, cost: 0, profit: 0, estimatedQty: 0 }),
    invoiceNumberLabel: (q) => 'INV-' + String(q.id),
    accountLabel: (k) => k || '',
    Date,
    SQ_STATUSES: {},
    Math, Number, String, Array, Object, Map, Set, Promise,
  }, ['dayThreadLine']).dayThreadLine();

  const meeting = [{ id: 21, body: { keyline: 'Collect before you buy.' } }];
  const moves = [
    { id: 1, status: 'open', body: { title: 'Chase Milly' } },
    { id: 2, status: 'done', body: { title: 'Invoice Dad' } },
    { id: 3, status: 'skipped', body: { title: 'Clear the dead stock' } },
  ];

  (async () => {
    const out = await line(books(), journal(meeting, moves), true);
    t.check(/This morning you agreed: Collect before you buy\./.test(out),
      'the first question of a thread is told what the morning agreed');
    /* OPEN MEANS OPEN. A move the owner marked done or skipped is not
       still waiting on them, and saying it is would be the one thing
       this line must never do. */
    t.check(/Still not done: Chase Milly\./.test(out), 'and which moves are still waiting on them');
    t.check(!/Invoice Dad/.test(out), 'a move already done is not still waiting');
    t.check(!/Clear the dead stock/.test(out), 'nor one the owner skipped');
    t.check(/So far today: 1 sale worth 900000/.test(out), 'with what the books have done since');
    t.check(out.length <= 600, `and it stays short (${out.length})`);

    /* Every move settled is worth saying too — it is a different fact
       from a morning with no meeting at all. */
    const settled = await line(books(), journal(meeting, moves.filter((m) => m.status !== 'open')), true);
    t.check(/Every move from it is settled\./.test(settled), 'a plan fully worked through says so');

    /* Without the journal there is nothing to remember, and the line
       falls back to the books rather than failing. */
    const noTable = await line(books(), journal([], []), false);
    t.check(!/This morning/.test(noTable), 'no journal, no morning to report');
    t.check(/So far today/.test(noTable), 'but the books still speak');

    /* A quiet day costs nothing at all. */
    const nothing = await line({ savedQuotes: [], customers: [], cashTxns: [], stockLog: [], paymentPromises: [] },
      journal([], []), false);
    eq(nothing, '', 'and a morning with nothing in it says nothing rather than padding the turn');

    /* ---------- 7. seeded once, and never over a meeting -------------- */
    {
      const loop = extractFunction(src, 'apRunLoop', 'index.html');
      t.check(/apMode !== 'manager'/.test(loop),
        'a meeting is not told the day twice — it reads all of it through its own tools');
      t.check(/assistantThread\.length === 1/.test(loop),
        'and the day rides the FIRST turn of a thread, not every turn');
      t.check(/apDaySeeded = true;/.test(loop), 'once per thread');
      const resets = (src.match(/assistantThread = \[\];\n\s*apDaySeeded = false;/g) || []).length;
      eq(resets, 3, 'and every place the thread is emptied clears the flag, so a fresh conversation is told afresh');
    }
  })().then(() => {
    process.exit(t.done() ? 1 : 0);
  }).catch((e) => { console.error(e); process.exit(1); });
}
