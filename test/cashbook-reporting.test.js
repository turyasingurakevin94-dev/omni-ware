#!/usr/bin/env node
'use strict';
/*
 * Cash book reporting and reconciliation.
 *
 * A cash book is a continuous chain: a day opens holding exactly what the
 * previous one ended holding. Every opening balance here was typed by hand
 * into the wizard and defaulted to zero, and nothing ever compared a day's
 * opening to the day before it -- so money could leave the books overnight
 * with no entry anywhere, and the day would still reconcile perfectly.
 *
 * That is the trap worth pinning: the per-account variance measures a day
 * against its OWN opening figure. A day opened with the wrong number
 * reconciles against that wrong number, cleanly, forever.
 *
 * Run: node test/cashbook-reporting.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('cash book');
const src = read('index.html');

/* ---------- the scope under test -------------------------------------- */
const data = { cashDays: {}, cashTxns: [] };
const NAMES = ['previousCashDate', 'cbAccountTotals', 'cbClosingFor', 'carriedOpening', 'getDayRecord'];
const fn = compileScope([
  extractDeclaration(src, 'ACCOUNTS', 'index.html'),
  ...NAMES.map((n) => extractFunction(src, n, 'index.html')),
], { data }, NAMES);

const txn = (date, account, type, amount) => ({ date, account, type, amount });
const reset = (days, txns) => {
  data.cashDays = days || {};
  data.cashTxns = txns || [];
};
const day = (opening, actual) => ({
  opening: Object.assign({ cash: 0, momo: 0, bank: 0 }, opening),
  actual: Object.assign({ cash: null, momo: null, bank: null }, actual),
  openingSet: true,
});

/* ---------- 1. a day's closing --------------------------------------- */
{
  reset({ '2026-08-01': day({ cash: 200000 }) }, [
    txn('2026-08-01', 'cash', 'receipt', 500000),
    txn('2026-08-01', 'cash', 'payment', 120000),
    txn('2026-08-01', 'cash', 'expense', 30000),
    txn('2026-08-01', 'momo', 'receipt', 999999),      // another account
    txn('2026-07-31', 'cash', 'receipt', 888888),      // another day
  ]);
  t.check(fn.cbClosingFor('2026-08-01', 'cash') === 550000,
    `closing is opening plus receipts less payments and expenses (${fn.cbClosingFor('2026-08-01', 'cash')})`);
  const totals = fn.cbAccountTotals('2026-08-01', 'cash');
  t.check(totals.totalReceipts === 500000 && totals.totalPayments === 120000 && totals.totalExpenses === 30000,
    'each account and day is totalled on its own');
}
{
  // Legacy rows used in/out rather than receipt/payment.
  reset({}, [txn('2026-08-01', 'cash', 'in', 100), txn('2026-08-01', 'cash', 'out', 40)]);
  const totals = fn.cbAccountTotals('2026-08-01', 'cash');
  t.check(totals.totalReceipts === 100 && totals.totalPayments === 40,
    'older in/out rows still count as receipts and payments');
}

/* ---------- 2. which day a day follows -------------------------------- */
/*
 * Not literally yesterday. Shops don't trade every day, and a closed Sunday
 * must not reset the chain to zero.
 */
{
  reset({ '2026-08-01': day({}), '2026-07-28': day({}) }, [txn('2026-07-30', 'cash', 'receipt', 1)]);
  t.check(fn.previousCashDate('2026-08-03') === '2026-08-01',
    `the previous trading day is the latest one with a book behind it (${fn.previousCashDate('2026-08-03')})`);
  t.check(fn.previousCashDate('2026-07-29') === '2026-07-28',
    'a day with only transactions and no record still counts as a trading day');
  t.check(fn.previousCashDate('2026-07-28') === null,
    'the earliest day in the book has nothing before it');
  t.check(fn.previousCashDate('2026-08-01') === '2026-07-30',
    'a date is never its own predecessor');
}

/* ---------- 3. the balance carries forward ---------------------------- */
{
  reset({ '2026-08-01': day({ cash: 200000 }) }, [txn('2026-08-01', 'cash', 'receipt', 500000)]);
  const c = fn.carriedOpening('2026-08-02');
  t.check(c && c.from === '2026-08-01' && c.values.cash === 700000,
    `a day opens with what the previous one calculated out at (${c && c.values.cash})`);
  t.check(c && c.counted.cash === false, 'and says that figure was calculated, not counted');
}
{
  // A counted drawer beats a calculated one: that is the money actually
  // there to open with, and the gap is already this day's own variance.
  reset({ '2026-08-01': day({ cash: 200000 }, { cash: 650000 }) }, [txn('2026-08-01', 'cash', 'receipt', 500000)]);
  const c = fn.carriedOpening('2026-08-02');
  t.check(c.values.cash === 650000 && c.counted.cash === true,
    `a counted close carries the counted figure, not the calculated one (${c.values.cash})`);
}
{
  // Zero is a real count and must not be mistaken for "not counted".
  reset({ '2026-08-01': day({ cash: 200000 }, { cash: 0 }) }, []);
  const c = fn.carriedOpening('2026-08-02');
  t.check(c.values.cash === 0 && c.counted.cash === true,
    'a drawer counted at zero carries zero rather than falling back to the calculation');
}
{
  reset({}, []);
  t.check(fn.carriedOpening('2026-08-01') === null,
    'the first day of the book has nothing to carry, and says so rather than inventing a zero');
}
{
  // Across a gap: Friday's close carries to Monday untouched.
  reset({ '2026-08-01': day({ cash: 100000 }, { cash: 480000 }) }, [txn('2026-08-01', 'cash', 'receipt', 400000)]);
  const c = fn.carriedOpening('2026-08-04');
  t.check(c.from === '2026-08-01' && c.values.cash === 480000,
    `a closed weekend does not reset the chain (${c.from}, ${c.values.cash})`);
}

/* ---------- 4. a new day is seeded, not zeroed ------------------------ */
{
  reset({ '2026-08-01': day({ cash: 200000, momo: 50000 }) }, [
    txn('2026-08-01', 'cash', 'receipt', 500000),
    txn('2026-08-01', 'momo', 'payment', 20000),
  ]);
  const rec = fn.getDayRecord('2026-08-02');
  t.check(rec.opening.cash === 700000 && rec.opening.momo === 30000,
    `opening a fresh day starts it where the last one ended (cash ${rec.opening.cash}, momo ${rec.opening.momo})`);
  t.check(rec.openingSet === false,
    'but it is still unconfirmed, so the wizard asks rather than assuming');
  t.check(rec.actual.cash === null,
    'nothing is counted yet on a day nobody has been through');
}
{
  // An existing record must never be re-seeded -- that would silently
  // overwrite a figure somebody deliberately entered.
  reset({ '2026-08-01': day({ cash: 999999 }), '2026-08-02': day({ cash: 1 }) }, []);
  t.check(fn.getDayRecord('2026-08-02').opening.cash === 1,
    'a day already on file keeps the opening it was given');
}
{
  reset({}, []);
  const rec = fn.getDayRecord('2026-08-01');
  t.check(rec.opening.cash === 0 && rec.opening.momo === 0 && rec.opening.bank === 0,
    'the very first day still starts from zero, since there is nothing behind it');
}
{
  // Reading a day must not create records for the days it looks back at --
  // that is what would recurse the whole book into existence.
  reset({ '2026-08-01': day({ cash: 5 }) }, []);
  fn.getDayRecord('2026-08-05');
  t.check(Object.keys(data.cashDays).sort().join(',') === '2026-08-01,2026-08-05',
    `looking back does not conjure records for the days in between (${Object.keys(data.cashDays).sort().join(',')})`);
}

/* ---------- 5. a broken chain is reported ----------------------------- */
/*
 * The whole point. Day-level variance compares a day to its own opening, so
 * a day opened with the wrong figure reconciles perfectly. Only comparing
 * consecutive days catches money that left between them.
 */
{
  const html = extractFunction(src, 'cbChainBreakHTML', 'index.html');
  t.check(/carriedOpening\(date\)/.test(html) && /rec\.opening\[a\.key\]/.test(html),
    'the check compares the stored opening against what the previous day left');
  t.check(/Math\.round\(g\.expected\) !== Math\.round\(g\.actual\)/.test(html),
    'the comparison is rounded, so a fractional shilling is not reported as a break');
  t.check(/if\(!carried\) return ''/.test(html),
    'the first day of the book is not accused of breaking a chain it starts');

  const summary = extractFunction(src, 'renderCbSummary', 'index.html');
  t.check(/cbChainBreakHTML\(date, rec\)/.test(summary),
    'the summary screen actually renders it');
}
{
  // The one-tap correction has to write the carried figures and mark the
  // day confirmed, or the warning returns on the next render.
  const summary = extractFunction(src, 'renderCbSummary', 'index.html');
  const fix = /cb_chain_fix[\s\S]*?toast\(/.exec(summary);
  t.check(fix && /rec2\.opening\[a\.key\] = carried\.values\[a\.key\]/.test(fix[0]) && /rec2\.openingSet = true/.test(fix[0]),
    'accepting the correction writes the carried figures and marks the day opened');
}

/* ---------- 6. the wizard shows where its numbers came from ----------- */
{
  const fill = extractFunction(src, 'fillCbWizardFromRecord', 'index.html');
  t.check(/const useCarried = carried && !rec\.openingSet/.test(fill),
    'an unconfirmed day is pre-filled from the carried figure, not from the placeholder zero it was created with');
  t.check(/carried\.counted\[a\.key\] \? 'was counted at' : 'calculated out at'/.test(fill),
    'the note says whether the previous day was counted or calculated');
  t.check(/Nothing on file before this date/.test(fill),
    'the first day of the book says so instead of showing a carried figure it does not have');

  // Every account needs its own note element, or two of the three silently
  // explain nothing.
  const missing = ['cash', 'momo', 'bank'].filter((k) => !src.includes(`id="cb_wiz_${k}_carried"`));
  t.check(missing.length === 0,
    missing.length ? `no carried-forward note for: ${missing.join(', ')}` : 'all three accounts have a note element');
}

process.exit(t.done() ? 1 : 0);
