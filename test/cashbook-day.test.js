#!/usr/bin/env node
'use strict';
/*
 * The cash book, laid out in the order the day is worked.
 *
 * The page led with the date and a row of OPENING balances -- yesterday's
 * news -- and kept the one figure it is opened for, "how much have I got
 * right now", in the sixth column of a reconciliation table at the foot
 * of the page, labelled "Calculated Closing".
 *
 * Three things were missing outright:
 *
 *   the position    what is in each account, and in total, now.
 *   a running       the defining feature of a cash book. Without it
 *   balance         there is no way to trace how the day got from its
 *                   opening figure to its closing one -- it was a list
 *                   of transactions, not a book.
 *   the two verbs   Money in and Money out were floating buttons inside
 *                   the chart widget at the bottom.
 *
 * THE ARITHMETIC IS COMPUTED ONCE. The position at the top, the running
 * balance in the ledger and the reconciliation at the bottom all read
 * cbDayPosition and cbLedgerFor. Three places deriving the same closing
 * balance independently is how a shop ends up with two answers to "how
 * much is in the drawer".
 *
 * Run: node test/cashbook-day.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('cash book day');
const src = read('index.html');
const code = src.split(/\r?\n/).map((l) => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');
const TODAY = '2026-08-04';
const data = { cashDays: {}, cashTxns: [] };

const scope = compileScope([
  extractDeclaration(src, 'ACCOUNTS', 'index.html'),
  extractDeclaration(src, 'CASH_NOT_REVENUE', 'index.html'),
  extractDeclaration(src, 'cashHas', 'index.html'),
  extractFunction(src, 'cashIsMoneyIn', 'index.html'),
  extractFunction(src, 'cbAccountTotals', 'index.html'),
  extractFunction(src, 'cbDayPosition', 'index.html'),
  extractFunction(src, 'cbLedgerFor', 'index.html'),
  extractFunction(src, 'cbVarianceMeaning', 'index.html'),
], {
  data,
  todayISO: () => TODAY,
  getDayRecord: (d) => data.cashDays[d],
  fmtUGX: (n) => Number(n || 0).toLocaleString('en-US') + ' UGX',
}, ['cbDayPosition', 'cbLedgerFor', 'cbVarianceMeaning']);

const tx = (id, time, account, type, amount) => ({
  id, date: TODAY, time, account, type, category: 'X', amount, description: '',
});
const openDay = (opening, actual) => {
  data.cashDays[TODAY] = { opening, actual: actual || {}, openingSet: true };
};
const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);
const reset = () => { data.cashDays = {}; data.cashTxns = []; };

/* ---------- 1. the position, per account and in total ---------------- */
{
  reset();
  openDay({ cash: 500000, momo: 200000, bank: 1000000 });
  data.cashTxns = [
    tx(1, '08:15', 'cash', 'receipt', 450000),
    tx(2, '09:40', 'cash', 'expense', 50000),
    tx(3, '11:05', 'momo', 'receipt', 380000),
    tx(4, '12:30', 'cash', 'payment', 300000),
    tx(5, '15:20', 'bank', 'payment', 200000),
  ];
  const p = scope.cbDayPosition(TODAY);
  const acc = (k) => p.accounts.find((a) => a.key === k);

  eq(acc('cash').closing, 500000 + 450000 - 50000 - 300000, 'cash closes where its own movements leave it');
  eq(acc('momo').closing, 580000, 'and mobile money where its own do');
  eq(acc('bank').closing, 800000, 'and the bank the same');
  eq(acc('cash').closing, 600000, 'cash lands at 600,000');
  // Expressed against the accounts rather than a copied literal: the
  // first version of this line carried a total from a different fixture
  // and asserted a figure none of the three added up to.
  eq(p.closing, acc('cash').closing + acc('momo').closing + acc('bank').closing,
    'the total is the three added, which is the headline figure');
  eq(p.closing, 1980000, 'and comes to 1,980,000 for this day');
  eq(p.opening, 1700000, 'against what the day opened with');

  // Payments and expenses are both money out. Reporting them separately
  // is a category question; for "what have I got" they are one thing.
  eq(acc('cash').out, 350000, 'a payment and an expense both leave the account');
  eq(acc('cash').in, 450000, 'and a receipt arrives in it');
}

/* ---------- 2. the running balance, per account ---------------------- */
{
  /* Per account, not one running total. A single balance across cash,
     mobile money and bank would be a figure matching nothing anybody
     could ever count -- the three are separate ledgers kept on one page. */
  const rows = scope.cbLedgerFor(TODAY, null);
  eq(rows.length, 5, 'every movement of the day is in the ledger');
  eq(rows.map((r) => r.balanceAfter).join(','), '950000,900000,580000,600000,800000',
    'each row carries ITS OWN account\'s balance after that movement');

  // Read down one account and it is a proper running balance.
  const cash = scope.cbLedgerFor(TODAY, 'cash');
  eq(cash.map((r) => r.balanceAfter).join(','), '950000,900000,600000',
    'filtered to one account it runs cleanly from the opening figure');
  eq(cash.length, 3, 'and only that account\'s movements are listed');
  eq(cash[cash.length - 1].balanceAfter, scope.cbDayPosition(TODAY).accounts.find((a) => a.key === 'cash').closing,
    'ending exactly where the position says that account closes — one arithmetic, two screens');
}

/* ---------- 3. ordering ---------------------------------------------- */
{
  reset();
  openDay({ cash: 0, momo: 0, bank: 0 });
  // Supplied out of order, and two share a minute.
  data.cashTxns = [
    tx(3, '10:00', 'cash', 'receipt', 30),
    tx(1, '09:00', 'cash', 'receipt', 10),
    tx(2, '10:00', 'cash', 'receipt', 20),
  ];
  const rows = scope.cbLedgerFor(TODAY, 'cash');
  eq(rows.map((r) => r.txn.id).join(','), '1,2,3', 'by time, then by the order they were entered');
  eq(rows.map((r) => r.balanceAfter).join(','), '10,30,60',
    'so the running balance follows a sequence that actually happened');
}

/* ---------- 4. counted, and what a difference means ------------------ */
{
  reset();
  openDay({ cash: 100000, momo: 0, bank: 0 }, {});
  data.cashTxns = [tx(1, '09:00', 'cash', 'receipt', 50000)];
  const p = () => scope.cbDayPosition(TODAY);

  eq(p().accounts[0].counted, null, 'an uncounted account has no count');
  t.check(p().accounts[0].variance === null, 'and therefore no variance');
  eq(scope.cbVarianceMeaning(p().accounts[0]).state, 'pending', 'which reads as not counted yet');
  eq(p().countedAccounts, 0, 'and nothing is counted');

  /* '' is a cleared box, not a count of zero. Treating the first as the
     second invents a shortfall the size of the whole account. */
  data.cashDays[TODAY].actual = { cash: '' };
  t.check(p().accounts[0].counted === null, 'a cleared box is not a count of nothing');

  data.cashDays[TODAY].actual = { cash: 150000 };
  eq(p().accounts[0].variance, 0, 'a count matching the book has no variance');
  eq(scope.cbVarianceMeaning(p().accounts[0]).state, 'ok', 'and says so');
  eq(p().countedAccounts, 1, 'one account counted');

  data.cashDays[TODAY].actual = { cash: 130000 };
  eq(p().accounts[0].variance, -20000, 'twenty thousand missing');
  const short = scope.cbVarianceMeaning(p().accounts[0]);
  eq(short.state, 'short', 'reads as short');
  t.check(/money paid out that was never logged/.test(short.text),
    'and says what that usually means — a bare "-20,000" is a figure, not a prompt');

  data.cashDays[TODAY].actual = { cash: 175000 };
  const over = scope.cbVarianceMeaning(p().accounts[0]);
  eq(over.state, 'over', 'and the other way reads as over');
  t.check(/money taken in that was never logged/.test(over.text),
    'with its own meaning — money missing and money spare are different problems');

  // A count of exactly zero IS a count: an emptied drawer.
  data.cashDays[TODAY].actual = { cash: 0 };
  eq(p().accounts[0].counted, 0, 'zero is a count');
  eq(p().accounts[0].variance, -150000, 'and an empty drawer against a book of 150,000 is a real shortfall');
}

/* ---------- 5. an untouched day -------------------------------------- */
{
  reset();
  openDay({ cash: 500000, momo: 0, bank: 0 });
  const p = scope.cbDayPosition(TODAY);
  eq(p.closing, 500000, 'a day with no movements closes where it opened');
  eq(p.in, 0, 'nothing in');
  eq(p.out, 0, 'nothing out');
  eq(scope.cbLedgerFor(TODAY, null).length, 0, 'and the ledger is empty rather than broken');
}

/* ---------- 6. the screen puts them in the working order ------------- */
{
  const section = (/<section id="tab-cashbook"[\s\S]*?\n    <\/section>/.exec(src) || [''])[0];
  const at = (s) => section.indexOf(s);

  t.check(at('id="cbTiles"') > -1, 'the position is on the page at all, which it was not before');
  t.check(at('id="cbTiles"') < at('id="cbTxnTableWrap"'),
    'and it comes before the ledger — what you have, then what moved');
  t.check(at('id="cbTxnTableWrap"') < at('id="cbSummaryWrap"'),
    'with closing the day last, because it happens last');

  // The two verbs of a cash book, out of the chart widget.
  t.check(at('id="cb_money_in"') > -1 && at('id="cb_money_out"') > -1,
    'money in and money out are controls on the page');
  t.check(at('id="cb_money_in"') < at('id="cbTiles"') || at('id="cb_money_in"') < at('id="cbTxnTableWrap"'),
    'in the header, not buried at the foot of the page');

  t.check(/id="cb_day_prev"/.test(section) && /id="cb_day_next"/.test(section),
    'and a day can be stepped through without the wizard');
  t.check(/cb_day_next'\)\.disabled = date >= todayISO\(\)/.test(code),
    'forward stops at today, because a cash book has no tomorrow');
  t.check(/if\(next <= todayISO\(\)\) cbGoToDay\(next\)/.test(code),
    'guarded as well as disabled, so a keyboard cannot get past it either');

  // A day never opened has no opening figure, so it still needs the
  // wizard -- stepping onto it must not show a book built on nothing.
  const go = (/function cbGoToDay[\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(/if\(rec\.openingSet\)\{ showCbMain\(\); \}/.test(go) && /showCbWizard\(true\)/.test(go),
    'a day that was never opened still gets the wizard');
}

/* ---------- 7. one arithmetic, and no invented zeroes ---------------- */
{
  // Every screen on this page reads the same two functions.
  t.check((code.match(/cbDayPosition\(/g) || []).length >= 4,
    'the position is read rather than recomputed per panel');
  const summary = (/function renderCbSummary[\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(/cbDayPosition\(date\)/.test(summary),
    'the reconciliation reads it too, so it cannot disagree with the tiles above it');

  /* A side that did not move is omitted, not printed as "+0 in". A zero
     dressed as a movement reads as a figure somebody worked out, and on
     a day where only money went out it puts a green "+0" beside the
     loss. The statements and the stock log were fixed for the same
     thing. */
  const header = (/function renderCbDayHeader[\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(/if\(a\.in\) bits\.push/.test(header) && /if\(a\.out\) bits\.push/.test(header),
    'a side that did not move is left out rather than shown as zero');
  t.check(/nothing moved today/.test(header),
    'and an account that did nothing says so in words');
}

/* ---------- the book and the rest of the shop agree ------------------
 * "The arithmetic is computed once" is this file's own principle, and
 * there was one place it did not hold. The Cash Book derives a day's
 * closing balance from that day's stored opening; EVERY OTHER figure in
 * the shop -- the till picker, the cash-to-buy hint, the day report --
 * goes through cashOnHandFor, which anchors on the last confirmed
 * opening or count and adds the transactions since.
 *
 * They agreed on the ordinary cases and parted on one: a day whose
 * opening was never confirmed. getDayRecord writes an opening the first
 * time a day is opened, carried from the day before -- and the day
 * before may not have been counted yet. Count it afterwards and find it
 * short, and the stored figure is stale while openingSet stays false to
 * say nobody stood behind it.
 *
 * Read unconditionally, the Cash Book reported the shortfall as money
 * still in the drawer.
 */
{
  const both = compileScope([
    extractDeclaration(src, 'ACCOUNTS', 'index.html'),
    extractFunction(src, 'cashIsMoneyIn', 'index.html'),
    extractFunction(src, 'cashIsMoneyOut', 'index.html'),
    extractFunction(src, 'cashOnHandFor', 'index.html'),
    extractFunction(src, 'cashAnchorFor', 'index.html'),
    extractFunction(src, 'cbAccountTotals', 'index.html'),
    extractFunction(src, 'cbDayPosition', 'index.html'),
    extractFunction(src, 'getDayRecord', 'index.html'),
    extractFunction(src, 'carriedOpening', 'index.html'),
    extractFunction(src, 'cbClosingFor', 'index.html'),
    extractFunction(src, 'previousCashDate', 'index.html'),
  ], { data, todayISO: () => TODAY }, ['cbDayPosition', 'cashOnHandFor']);

  const agree = (label) => {
    const pos = both.cbDayPosition(TODAY);
    pos.accounts.forEach((a) => {
      const viaBook = Math.round(a.closing);
      const viaShop = Math.round(both.cashOnHandFor(a.key));
      t.check(viaBook === viaShop,
        `${label} — ${a.key}: the book says ${viaBook}, the rest of the shop says ${viaShop}`);
    });
  };

  reset();
  openDay({ cash: 500000, momo: 0, bank: 0 });
  data.cashTxns = [tx(1, '09:00', 'cash', 'receipt', 200000), tx(2, '10:00', 'cash', 'payment', 50000)];
  agree('an ordinary day');

  /* THE CASE THAT PARTED THEM. Yesterday's book said 600,000 and the
     count found 430,000; today was opened before that count, so it
     still holds 500,000 and nobody has confirmed it. Only the count is
     evidence of what is actually there. */
  reset();
  data.cashDays = {
    '2026-08-03': { opening: { cash: 500000, momo: 0, bank: 0 },
      actual: { cash: 430000, momo: null, bank: null }, openingSet: true },
    [TODAY]: { opening: { cash: 500000, momo: 0, bank: 0 },
      actual: { cash: null, momo: null, bank: null }, openingSet: false },
  };
  data.cashTxns = [
    { id: 1, date: '2026-08-03', time: '09:00', account: 'cash', type: 'receipt', category: 'X', amount: 100000, description: '' },
    tx(2, '09:00', 'cash', 'receipt', 20000),
  ];
  agree('a day opened before the day before it was counted');
  eq(Math.round(both.cbDayPosition(TODAY).accounts[0].closing), 450000,
    'and it takes the COUNT as the starting point, not the figure that predates it');

  // A confirmed opening is the shop's own word and is left alone, even
  // where it disagrees with what came before.
  reset();
  data.cashDays = {
    '2026-08-03': { opening: { cash: 500000, momo: 0, bank: 0 },
      actual: { cash: 430000, momo: null, bank: null }, openingSet: true },
    [TODAY]: { opening: { cash: 500000, momo: 0, bank: 0 },
      actual: { cash: null, momo: null, bank: null }, openingSet: true },
  };
  data.cashTxns = [tx(2, '09:00', 'cash', 'receipt', 20000)];
  eq(Math.round(both.cbDayPosition(TODAY).accounts[0].closing), 520000,
    'a CONFIRMED opening stands, because somebody said that is what was there');
  agree('a confirmed opening');

  // Nothing on file at all is zero everywhere, not a crash.
  reset();
  data.cashTxns = [tx(1, '09:00', 'bank', 'receipt', 780000)];
  agree('transactions with no day record at all');
}

process.exit(t.done() ? 1 : 0);
