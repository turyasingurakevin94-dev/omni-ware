#!/usr/bin/env node
'use strict';
/*
 * What the shop holds RIGHT NOW, asked at any hour.
 *
 * The balance sheet, the dashboard and the cash-to-buy screen all ask the
 * same question, and they ask it in the middle of a trading day. The
 * end-of-day count is a correction applied when the day is closed; none
 * of them can wait for it.
 *
 * The old answer went through carriedOpening, which looks back exactly
 * ONE day. That is right for the Cash Book screen, where the previous day
 * is always a real record. Everywhere else it was wrong, and quietly:
 *
 *   A shop opens its book on the 1st with 1,000,000, then just trades.
 *   By the 4th its "previous day" is the 3rd -- a date that exists only
 *   because a transaction fell on it, with no opening of its own.
 *   cbClosingFor read that missing opening as zero, so the 1,000,000 and
 *   two days of takings were discarded. The balance sheet reported MINUS
 *   50,000 against a truth of 1,450,000, and mobile money reported 0
 *   against 580,000.
 *
 * The figure was only ever right if every single day had been formally
 * opened -- which is to say it waited on the daily reconciliation, when
 * the reconciliation is the end-of-day correction.
 *
 * So: anchor to the last trustworthy figure, add every movement since. No
 * day in between has to have been opened or closed.
 *
 * The two anchor kinds, and why the boundary differs:
 *   a counted close  is the end of that day, so movements AFTER it apply
 *   a set opening    is the start of that day, so that day's own apply
 *
 * Run: node test/cash-running-balance.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('cash running balance');
const src = read('index.html');
const TODAY = '2026-08-04';
const data = { cashDays: {}, cashTxns: [] };

const scope = compileScope([
  extractDeclaration(src, 'ACCOUNTS', 'index.html'),
  extractDeclaration(src, 'CASH_NOT_REVENUE', 'index.html'),
  extractDeclaration(src, 'cashHas', 'index.html'),
  extractFunction(src, 'cashIsMoneyIn', 'index.html'),
  extractFunction(src, 'cashAnchorFor', 'index.html'),
  extractFunction(src, 'cashOnHandFor', 'index.html'),
  extractFunction(src, 'cashOnHandByAccount', 'index.html'),
], { data, todayISO: () => TODAY },
  ['cashOnHandFor', 'cashOnHandByAccount', 'cashAnchorFor']);

const tx = (date, type, amount, account) => ({ date, type, amount, account: account || 'cash' });
const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${got}, want ${want})`);

/* ---------- 1. the day never opened --------------------------------- */
{
  // The scenario that was reporting a negative balance.
  data.cashDays = { '2026-08-01': { opening: { cash: 1000000, momo: 500000, bank: 0 }, actual: {}, openingSet: true } };
  data.cashTxns = [
    tx('2026-08-01', 'receipt', 200000),
    tx('2026-08-02', 'receipt', 300000),
    tx('2026-08-03', 'payment', 100000),
    tx('2026-08-04', 'receipt', 50000),
    tx('2026-08-02', 'receipt', 80000, 'momo'),
  ];
  eq(scope.cashOnHandFor('cash'), 1450000,
    'a book opened once and traded through carries its whole history, not just yesterday');
  eq(scope.cashOnHandFor('momo'), 580000,
    'and each account is anchored separately -- mobile money was reading zero');
  eq(scope.cashOnHandByAccount().total, 1450000 + 580000, 'the total is the accounts added up');

  // The anchor day's OWN movements are included: an opening is the start
  // of a day, so the 200,000 taken on the 1st is still to come.
  const a = scope.cashAnchorFor('cash', TODAY);
  t.check(a.from === '2026-08-01' && a.inclusive === true,
    'an opening anchors inclusively, so the day it opened still counts its takings');
}

/* ---------- 2. a counted close is better than a calculation ---------- */
{
  data.cashDays['2026-08-02'] = { opening: {}, actual: { cash: 1400000, momo: 600000 }, openingSet: false };
  eq(scope.cashOnHandFor('cash'), 1400000 - 100000 + 50000,
    'a counted close replaces everything before it -- somebody physically looked');
  eq(scope.cashOnHandFor('momo'), 600000, 'on that account only, and nothing has moved in momo since');

  const a = scope.cashAnchorFor('cash', TODAY);
  t.check(a.from === '2026-08-02' && a.inclusive === false,
    'a count anchors exclusively: it is the END of that day, so that day\'s own movements are already in it');

  // Without the exclusive/inclusive distinction the 300,000 taken on the
  // 2nd would be added to a count that already contains it.
  t.check(scope.cashOnHandFor('cash') !== 1400000 + 300000 - 100000 + 50000,
    'the takings already inside the count are not added to it a second time');
}

/* ---------- 3. today's count is a correction, not an input ----------- */
{
  // Today's count must not move this figure. Two reasons, and the second
  // is the one that would go unnoticed: the statements' reconciliation
  // check compares the books against the count, and if the count fed the
  // books it would be comparing a number with itself and could never
  // fail -- a broken check that always reports "they agree".
  const before = scope.cashOnHandFor('cash');
  data.cashDays[TODAY] = { opening: {}, actual: { cash: 9999999, momo: 9999999 }, openingSet: false };
  eq(scope.cashOnHandFor('cash'), before,
    'counting the drawer at close does not overwrite where the book says it stands');
  eq(scope.cashOnHandFor('momo'), 600000, 'nor on any other account');
  t.check(scope.cashAnchorFor('cash', TODAY).from !== TODAY,
    'today is never its own anchor');
}

/* ---------- 4. today's opening, once it is set ----------------------- */
{
  data.cashDays[TODAY] = { opening: { cash: 1300000, momo: 590000, bank: 0 }, actual: {}, openingSet: true };
  eq(scope.cashOnHandFor('cash'), 1300000 + 50000,
    'opening the day sets the figure and the day\'s movements build on it');
  const a = scope.cashAnchorFor('cash', TODAY);
  t.check(a.from === TODAY && a.inclusive === true, 'today becomes the anchor as soon as it is opened');
}

/* ---------- 5. a shop with no cash book at all ----------------------- */
{
  data.cashDays = {};
  eq(scope.cashOnHandFor('cash'), 200000 + 300000 - 100000 + 50000,
    'a shop that never opened the book still sees what moved through it');
  eq(scope.cashOnHandFor('momo'), 80000, 'on every account');
  t.check(scope.cashAnchorFor('cash', TODAY) === null, 'with no anchor to be found');
}

/* ---------- 6. every kind of movement, and only those in range ------- */
{
  data.cashDays = {};
  data.cashTxns = [
    tx('2026-08-02', 'receipt', 100000),
    tx('2026-08-02', 'in', 10000),
    tx('2026-08-03', 'payment', 20000),
    tx('2026-08-03', 'out', 5000),
    tx('2026-08-03', 'expense', 30000),
    // Dated after today: a payment scheduled ahead, or a typo. Either way
    // it has not happened yet and cannot be in what the shop holds now.
    tx('2026-08-09', 'receipt', 777000),
  ];
  eq(scope.cashOnHandFor('cash'), 100000 + 10000 - 20000 - 5000 - 30000,
    'receipts and "in" add; payments, "out" and expenses all take away');

  // An account that has never been used is zero, not a crash.
  eq(scope.cashOnHandFor('bank'), 0, 'an account with nothing in it holds nothing');
}

process.exit(t.done() ? 1 : 0);
