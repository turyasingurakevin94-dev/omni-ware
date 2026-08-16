#!/usr/bin/env node
'use strict';
/*
 * Moving the shop's own money between its own tills.
 *
 * Withdrawing 500,000 from the bank to pay in cash spends nothing and
 * earns nothing — the shop has exactly what it had a moment before, in a
 * different drawer. Everything here follows from that one sentence.
 *
 *   two entries      a cash entry belongs to one account, so a movement
 *                    between two of them is a payment out of the first
 *                    and a receipt into the second. Which is also how it
 *                    should read: the drawer really did go down and the
 *                    bank really did go up.
 *   in BOTH lists    the pair must cancel. In CASH_NOT_OPEX only, the
 *                    receipt is still revenue; in CASH_NOT_REVENUE only,
 *                    the payment is still an expense. Half-cancelled is
 *                    worse than not cancelled, because it looks right in
 *                    one report and wrong in the other.
 *   linked           the Cash Book deletes a row by its own id. Nothing
 *                    else would stop one leg going on its own, and money
 *                    would then leave one till and arrive in none — the
 *                    day failing to reconcile by exactly the amount
 *                    moved, with nothing on screen to explain it.
 *
 * Run: node test/cash-transfers.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('cash transfers');
const src = read('index.html');
const code = src.split(/\r?\n/).map((l) => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');

const TODAY = '2026-08-16';
const data = { cashTxns: [], cashDays: {}, nextCashTxnId: 1 };

const NAMES = ['transferBetweenAccounts', 'addCashReceipt', 'addCashPayment',
  'cashOnHandFor', 'cashAnchorFor', 'cashIsMoneyIn', 'cashIsMoneyOut',
  'cashIsOperatingExpense', 'cashIsTradingIncome', 'accountLabel', 'cashAccountChoices'];
const scope = compileScope([
  extractDeclaration(src, 'ACCOUNTS', 'index.html'),
  extractDeclaration(src, 'CASH_TRANSFER_CATEGORY', 'index.html'),
  extractDeclaration(src, 'CASH_NOT_OPEX', 'index.html'),
  extractDeclaration(src, 'CASH_NOT_REVENUE', 'index.html'),
  extractDeclaration(src, 'cashHas', 'index.html'),
  ...NAMES.map((n) => extractFunction(src, n, 'index.html')),
], {
  data,
  todayISO: () => TODAY,
  allocRowId: () => data.nextCashTxnId++,
  saveData: () => {},
  document: { getElementById: () => null },
}, NAMES);
// compileScope only hands back functions, so the constant is asserted
// against its literal — which is also what section 3 is guarding.
const TRANSFER_CAT = 'Account Transfer';

const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);
const reset = () => { data.cashTxns = []; data.cashDays = {}; data.nextCashTxnId = 1; };

/* ---------- 1. the money moves and none is created or destroyed ------- */
{
  reset();
  data.cashDays[TODAY] = { opening: { cash: 100000, momo: 0, bank: 900000 },
    actual: { cash: null, momo: null, bank: null }, openingSet: true };

  const before = ['cash', 'momo', 'bank'].map((k) => scope.cashOnHandFor(k));
  const res = scope.transferBetweenAccounts('bank', 'cash', 500000, 'withdrawal for the day');
  const after = ['cash', 'momo', 'bank'].map((k) => scope.cashOnHandFor(k));

  eq(data.cashTxns.length, 2, 'a transfer is two entries, not one');
  eq(after[0] - before[0], 500000, 'cash goes up by what was moved');
  eq(after[2] - before[2], -500000, 'and the bank goes down by the same');
  eq(before.reduce((a, b) => a + b, 0), after.reduce((a, b) => a + b, 0),
    'so the shop has exactly what it had — a transfer creates and destroys nothing');
  t.check(res && res.amount === 500000, 'and it reports what moved');
}

/* ---------- 2. and it is neither earned nor spent --------------------- */
{
  const out = data.cashTxns.find((x) => x.type === 'payment');
  const inn = data.cashTxns.find((x) => x.type === 'receipt');
  t.check(!!out && !!inn, 'one payment and one receipt');
  eq(out.account, 'bank', 'the payment leaves the account it came from');
  eq(inn.account, 'cash', 'and the receipt lands in the one it went to');

  /* THE WHOLE POINT. In one list only it is half-cancelled, which looks
     right in one report and wrong in the other. */
  t.check(!scope.cashIsOperatingExpense(out),
    'the paying half is NOT an expense — the shop spent nothing');
  t.check(!scope.cashIsTradingIncome(inn),
    'and the receiving half is NOT revenue — the shop earned nothing');

  eq(out.category, TRANSFER_CAT, 'both carry the transfer category');
  eq(inn.category, TRANSFER_CAT, 'both of them');
}

/* ---------- 3. the category and the two lists cannot drift apart ------
   The maps below are read by a dozen scopes with no reason to know the
   constant exists, so the constant is not used as a computed key. The
   cost of that is drift: a category that no longer matches the maps
   becomes an expense AND a revenue, inflating both sides of the income
   statement by the size of every transfer. This is the guard that buys
   back. */
{
  t.check(Object.prototype.hasOwnProperty.call(scope.CASH_NOT_OPEX || {}, TRANSFER_CAT)
    || /'Account Transfer':/.test((/const CASH_NOT_OPEX = \{[\s\S]*?\n\};/.exec(code) || [''])[0]),
    'the transfer category is excluded from operating expenses');
  t.check(/'Account Transfer':/.test((/const CASH_NOT_REVENUE = \{[\s\S]*?\n\};/.exec(code) || [''])[0]),
    'and from revenue');
  t.check(/const CASH_TRANSFER_CATEGORY = 'Account Transfer';/.test(code),
    'and the writer stamps that exact string, so the three agree');
}

/* ---------- 4. what it refuses to record ------------------------------ */
{
  reset();
  t.check(scope.transferBetweenAccounts('cash', 'cash', 50000) === null,
    'a transfer to the same account is not recorded — two entries netting to zero would read as activity that never happened');
  eq(data.cashTxns.length, 0, 'and writes nothing');

  t.check(scope.transferBetweenAccounts('cash', 'bank', 0) === null, 'nor a transfer of nothing');
  t.check(scope.transferBetweenAccounts('cash', 'bank', -5000) === null, 'nor a negative one');
  t.check(scope.transferBetweenAccounts('', 'bank', 5000) === null, 'nor one with no source');
  t.check(scope.transferBetweenAccounts('cash', '', 5000) === null, 'nor one with no destination');
  eq(data.cashTxns.length, 0, 'none of which leaves a stray entry behind');
}

/* ---------- 5. the two halves know about each other ------------------- */
{
  reset();
  scope.transferBetweenAccounts('cash', 'momo', 75000);
  const [a, b] = data.cashTxns;
  eq(a.transferId, b.id, 'each leg points at the other');
  eq(b.transferId, a.id, 'both ways');

  // An ordinary entry carries no link, so nothing else is dragged along
  // by a delete.
  scope.addCashPayment('cash', 1000, 'Rent', 'March');
  const plain = data.cashTxns[2];
  t.check(plain.transferId === undefined || plain.transferId === null,
    'an ordinary payment is linked to nothing');
}

/* ---------- 6. the Cash Book takes both or neither -------------------- */
{
  const del = extractFunction(src, 'deleteCashTxn', 'index.html');
  t.check(/t\.transferId != null/.test(del),
    'delete looks for the other half');
  t.check(/gone\.add\(twin\.id\)/.test(del),
    'and removes it too, rather than leaving money that left one till and arrived in none');
  t.check(/Both sides go/.test(del),
    'the question says so, so nobody deletes a pair thinking they deleted a line');
  t.check(/twin \? 'Transfer deleted — both sides'/.test(del),
    'and the toast afterwards says what actually happened');
}

/* ---------- 7. the column it needs, and surviving without it ---------- */
{
  t.check(/alter table cash_txns add column if not exists transfer_id bigint;/
    .test(read('supabase/migrations/0076_cash_txn_transfer.sql')),
    'the link has a migration');
  t.check(/sb\.from\('cash_txns'\)\.select\('transfer_id'\)\.limit\(1\)/.test(code),
    'probed rather than assumed');
  t.check(/cashTransferColumn = !\(transferColR && transferColR\.error\);/.test(code),
    'recording whether it is there yet');
  t.check(/\.\.\.\(cashTransferColumn \? \{transfer_id: t\.transferId==null \? null : t\.transferId\} : \{\}\)/.test(code),
    'and the write is guarded — every cash entry goes up on every save, so sending it early would stop the shop recording money at all');
  t.check(/transferId: t\.transfer_id==null \? null : Number\(t\.transfer_id\)/.test(code),
    'while the read needs no guard, a missing column simply reading as unlinked');
}

/* ---------- 8. choosing where it lands -------------------------------- */
{
  reset();
  const all = scope.cashAccountChoices({});
  eq(all.length, 3, 'ordinarily every account is offered');
  const some = scope.cashAccountChoices({ excludeKey: 'bank' });
  eq(some.length, 2, 'and the source is left out of the destination list');
  t.check(!some.some((r) => r.key === 'bank'),
    'so the obvious misclick cannot produce a transfer to nowhere');
}

process.exit(t.done() ? 1 : 0);
