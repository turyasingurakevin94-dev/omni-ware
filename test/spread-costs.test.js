#!/usr/bin/env node
'use strict';
/*
 * A running cost that covers a stretch of days.
 *
 * A year's insurance, a trading licence, a quarter's rent paid straight
 * into the cash book: one payment, many months of cover. Counted on the
 * day it was paid -- which every cash-book cost was -- the month of
 * paying looked terrible and the months it covered looked better than
 * they were, the same shape a van made before the asset register.
 *
 * The entry now carries the days it pays for (coversFrom, coversTo) and
 * the statements read them:
 *
 *   profit and loss   each period gets its share of the days, by the
 *                     day -- the rule rent and depreciation follow.
 *   balance sheet     days paid for and not yet reached are PAID IN
 *                     ADVANCE; days already gone on an entry dated after
 *                     them are RUNNING COSTS USED, NOT YET PAID.
 *   cash flow         untouched. The money left on the day it left.
 *
 * Run: node test/spread-costs.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('spread costs');
const src = read('index.html');
const code = src.split(/\r?\n/).map((l) => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');

const data = { cashTxns: [], dues: [] };
const NAMES = ['cashIsSpreadCost', 'spreadCostTxns', 'spreadDays', 'spreadCostBetween', 'spreadCostRows',
  'spreadPrepaidOf', 'spreadAccruedOf', 'spreadPrepaidAsAt', 'spreadAccruedAsAt', 'statementOpexRows', 'cashOpexRows'];
const scope = compileScope([
  extractDeclaration(src, 'CASH_NOT_OPEX', 'index.html'),
  extractDeclaration(src, 'CASH_SHORTAGE_CATEGORY', 'index.html'),
  extractDeclaration(src, 'CASH_OVERAGE_CATEGORY', 'index.html'),
  extractDeclaration(src, 'CASH_VARIANCE_LINE', 'index.html'),
  extractDeclaration(src, 'DUE_KINDS', 'index.html'),
  extractDeclaration(src, 'cashHas', 'index.html'),
  extractFunction(src, 'cashIsMoneyOut', 'index.html'),
  extractFunction(src, 'cashIsMoneyIn', 'index.html'),
  extractFunction(src, 'cashIsOperatingExpense', 'index.html'),
  extractFunction(src, 'cashIsCashShortage', 'index.html'),
  extractFunction(src, 'cashIsCashOverage', 'index.html'),
  extractFunction(src, 'monthChargeFraction', 'index.html'),
  extractFunction(src, 'dueCostBetween', 'index.html'),
  extractFunction(src, 'dueCostRows', 'index.html'),
  extractFunction(src, 'dueSettledCashIds', 'index.html'),
  ...NAMES.map((n) => extractFunction(src, n, 'index.html')),
], { data, todayISO: () => '2026-08-03' }, NAMES);

const r = (n) => Math.round(n);
const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);
const licence = (over) => Object.assign({
  id: 1, date: '2026-01-10', account: 'bank', type: 'expense', category: 'Licences', amount: 365000,
  description: 'Trading licence', coversFrom: '2026-01-01', coversTo: '2026-12-31',
}, over);

/* ---------- 1. which entries spread ----------------------------------- */
{
  t.check(scope.cashIsSpreadCost(licence()), 'a running cost with both days on it spreads');
  t.check(!scope.cashIsSpreadCost(licence({ coversFrom: null, coversTo: null })),
    'one with no days on it is what every entry was before: a cost of the day it was paid');
  t.check(!scope.cashIsSpreadCost(licence({ coversTo: null })), 'one date alone is not a stretch of anything');
  t.check(!scope.cashIsSpreadCost(licence({ coversFrom: '2026-12-31', coversTo: '2026-01-01' })),
    'nor is a range running backwards');
  t.check(!scope.cashIsSpreadCost(licence({ category: 'Stock Purchase' })),
    'and a stock purchase with days written on it is still stock -- only a running cost can be spread');
  t.check(!scope.cashIsSpreadCost(licence({ type: 'receipt' })), 'money in is never a spread cost');
}

/* ---------- 2. the days ---------------------------------------------- */
{
  eq(scope.spreadDays('2026-01-01', '2026-12-31'), 365, 'a year is 365 days');
  eq(scope.spreadDays('2028-01-01', '2028-12-31'), 366, 'and a leap year 366');
  eq(scope.spreadDays('2026-03-05', '2026-03-05'), 1, 'one day is one day, inclusive of both ends');
  eq(scope.spreadDays('2026-03-06', '2026-03-05'), 0, 'backwards is nothing');
  eq(scope.spreadDays('', '2026-03-05'), 0, 'and so is a blank');
}

/* ---------- 3. each period gets its share ---------------------------- */
{
  const l = licence();
  eq(r(scope.spreadCostBetween(l, '2026-01-01', '2026-01-31')), r(365000 * 31 / 365),
    'January carries thirty-one days of the year');
  eq(r(scope.spreadCostBetween(l, '2026-07-01', '2026-07-31')), r(365000 * 31 / 365),
    'and so does July, six months after the money left');
  eq(r(scope.spreadCostBetween(l, '2026-02-01', '2026-02-28')), r(365000 * 28 / 365), 'February its twenty-eight');
  eq(scope.spreadCostBetween(l, '2025-12-01', '2025-12-31'), 0, 'a month before the cover began carries nothing');
  eq(scope.spreadCostBetween(l, '2027-01-01', '2027-01-31'), 0, 'nor one after it ended');
  eq(r(scope.spreadCostBetween(l, '2026-01-01', '2026-12-31')), 365000, 'and the whole year is the whole amount');
  // A window wider than the cover takes all of it and no more.
  eq(r(scope.spreadCostBetween(l, '2025-01-01', '2027-12-31')), 365000, 'a window wider than the cover takes exactly the cover');
  // The months add up to the year, to the shilling.
  const months = [];
  for (let m = 1; m <= 12; m++) {
    const mm = String(m).padStart(2, '0');
    const last = new Date(Date.UTC(2026, m, 0)).getUTCDate();
    months.push(scope.spreadCostBetween(l, `2026-${mm}-01`, `2026-${mm}-${last}`));
  }
  t.check(Math.abs(months.reduce((a, b) => a + b, 0) - 365000) < 0.01, 'the twelve months add up to the year');
}

/* ---------- 4. it reaches the statement, once --------------------------- */
{
  data.cashTxns = [
    licence(),
    { id: 2, date: '2026-01-10', account: 'cash', type: 'expense', category: 'Transport', amount: 40000 },
  ];
  const jan = scope.statementOpexRows(data.cashTxns.filter((x) => x.date >= '2026-01-01' && x.date <= '2026-01-31'), '2026-01-01', '2026-01-31');
  eq(r(jan['Licences']), r(365000 * 31 / 365), 'January shows its share of the licence, not the whole payment');
  eq(jan['Transport'], 40000, 'and an ordinary entry beside it is counted whole on the day it was paid');
  const jul = scope.statementOpexRows([], '2026-07-01', '2026-07-31');
  eq(r(jul['Licences']), r(365000 * 31 / 365),
    'July shows its share although no licence cash moved in July');
  const rows = scope.spreadCostRows('2026-01-01', '2026-12-31');
  eq(r(rows['Licences']), 365000, 'the year shows the licence once');
  // The cash book's own reading is untouched: the cash flow still sees
  // the payment whole, on its day.
  eq(scope.cashOpexRows(data.cashTxns)['Licences'], 365000, 'the cash-book reading still carries the whole payment on the day it left');
  data.cashTxns = [];
}

/* ---------- 5. paid in advance, and used but not yet paid ------------- */
{
  const l = licence();
  eq(r(scope.spreadPrepaidOf(l, '2026-03-31')), r(365000 * (365 - 90) / 365),
    'at the end of March, 275 days of the year are paid for and not yet reached');
  eq(scope.spreadAccruedOf(l, '2026-03-31'), 0, 'and nothing is owed on it -- it was paid in January');
  eq(scope.spreadPrepaidOf(l, '2026-12-31'), 0, 'by the end of the year nothing is in advance');
  eq(scope.spreadPrepaidOf(l, '2025-12-31'), 0, 'and before it was paid nothing is in advance either');
  /* Read on the 5th of January, five days into the cover and five days
     before the money left: those five days are used and owed. */
  eq(r(scope.spreadAccruedOf(l, '2026-01-05')), r(365000 * 5 / 365),
    'days already gone on an entry not yet paid are owed');
  eq(scope.spreadPrepaidOf(l, '2026-01-05'), 0, 'and nothing is in advance until it is paid');
  // A bill entirely for days already gone, paid later.
  const power = licence({ id: 3, date: '2026-08-10', category: 'Power', amount: 310000, coversFrom: '2026-07-04', coversTo: '2026-08-03' });
  eq(scope.spreadAccruedOf(power, '2026-08-03'), 310000, 'a bill covering only days already gone, paid next week, is owed in full');
  eq(scope.spreadAccruedOf(power, '2026-08-10'), 0, 'and owed no longer once paid');
  eq(scope.spreadPrepaidOf(power, '2026-08-10'), 0, 'nor in advance -- the days it bought are all behind');
  /* The identity that keeps the sheet on the statement's footing. */
  ['2026-01-05', '2026-01-10', '2026-03-31', '2026-08-03', '2027-01-01'].forEach((asOf) => {
    const paid = l.date <= asOf ? 365000 : 0;
    const used = scope.spreadCostBetween(l, l.coversFrom, asOf);
    t.check(Math.abs((scope.spreadPrepaidOf(l, asOf) - scope.spreadAccruedOf(l, asOf)) - (paid - used)) < 0.01,
      `prepaid less accrued is paid less used, as at ${asOf}`);
  });
  data.cashTxns = [l, power];
  eq(r(scope.spreadPrepaidAsAt('2026-08-03').total), r(365000 * (365 - 215) / 365), 'the sheet’s prepaid total is the sum');
  eq(scope.spreadAccruedAsAt('2026-08-03').total, 310000, 'and its accrued total likewise');
  eq(scope.spreadAccruedAsAt('2026-08-03').count, 1, 'counting the entries behind it');
  data.cashTxns = [];
}

/* ---------- 6. the cash book carries it, and the sync guards it ------- */
{
  const save = (/async function saveCashTxn[\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(/coversFrom = document\.getElementById\('cb_out_covers_from'\)\.value \|\| null;/.test(save),
    'the cash-out form reads the first day it pays for');
  t.check(/Give both the first and the last day it pays for, or neither/.test(save),
    'and refuses one date without the other');
  t.check(/The last day it pays for comes before the first/.test(save), 'and a range running backwards');
  t.check(/coversFrom, coversTo,\n  \};/.test(save), 'and writes both onto the entry');
  t.check(/\{\.\.\.data\.cashTxns\[idx\], \.\.\.record, id: editingCashTxnId\}/.test(save),
    'an edit is spread over the stored entry, so a link the form does not carry survives it');
  const edit = (/function editCashTxn[\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(/cb_out_covers_from'\)\.value = t\.coversFrom \|\| ''/.test(edit), 'editing an entry shows the days it covers');
  const reset = (/function resetCashTxnForms[\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(/cb_out_covers_from'\)\.value = '';/.test(reset) && /cb_out_covers_to'\)\.value = '';/.test(reset),
    'and the next entry does not inherit them');
  /* Guarded on the write, as transfer_id is: every cash entry goes up on
     every save, and a column the migration has not landed would fail
     the whole upsert. */
  t.check(/cashCoversColumns = !\(coversColR && coversColR\.error\);/.test(code), 'the app probes for the columns');
  t.check(/\.\.\.\(cashCoversColumns \? \{covers_from: dateOrNull\(t\.coversFrom\), covers_to: dateOrNull\(t\.coversTo\)\} : \{\}\)/.test(code),
    'and sends them only once they exist');
  t.check(/coversFrom: t\.covers_from \|\| null, coversTo: t\.covers_to \|\| null/.test(code), 'and reads them back');
  const mig = read('supabase/migrations/0095_cash_txn_covers.sql');
  t.check(/add column if not exists covers_from date/.test(mig) && /add column if not exists covers_to date/.test(mig),
    'with a migration that adds both, nullable');
  /* And the statement says which entries it spread: the ledger names
     the stretch on the line, and the drill-down shows the share. */
  t.check(/pays for \$\{esc\(t\.coversFrom\)\} to \$\{esc\(t\.coversTo\)\}/.test(code), 'the ledger names the stretch on the entry');
}

process.exit(t.done() ? 1 : 0);
