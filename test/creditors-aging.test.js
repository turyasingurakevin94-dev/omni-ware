#!/usr/bin/env node
'use strict';
/*
 * The creditors list, read as a payment order.
 *
 * The mirror of the debtors list, on the buy side -- with one structural
 * difference that is forced by the data and matters a great deal.
 *
 * A customer HAS a single blended balance, so the debtors list has to
 * age the whole of it from one date. A supplier does not: what is owed
 * to them is already split across dated invoices. So the bands here are
 * built from INVOICES, and each one is aged on its own.
 *
 * That is not a refinement, it is the difference between a true number
 * and a badly wrong one. A supplier with a 3,200,000 invoice raised four
 * days ago and a 180,000 invoice from 140 days ago is owed 3,380,000 and
 * has been kept waiting 140 days -- but only 180,000 of that money is
 * old. Banding per supplier would put the whole 3,380,000 in "over 90
 * days" and inflate that band nearly fivefold, which on this page is the
 * difference between "pay this today" and "this can wait".
 *
 * So the two objects are kept apart and each says which it is counting:
 *   the bands   count invoices, because that is where an age lives.
 *   the rows    are suppliers, because a supplier is who you pay.
 *
 * Run: node test/creditors-aging.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('creditors aging');
const src = read('index.html');
const code = src.split(/\r?\n/).map((l) => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');
const TODAY = '2026-08-04';
const data = { suppliers: [], purchaseInvoices: [], cashDays: {}, cashTxns: [] };

const ago = (days) => new Date(Date.parse(TODAY + 'T00:00:00Z') - days * 86400000)
  .toISOString().slice(0, 10);

const scope = compileScope([
  extractDeclaration(src, 'AGING_BANDS', 'index.html'),
  extractDeclaration(src, 'CRED_SORT_STATE', 'index.html'),
  extractDeclaration(src, 'CRED_SORT_FIRST_DIR', 'index.html'),
  extractDeclaration(src, 'credBandFilter', 'index.html'),
  extractFunction(src, 'daysSinceDate', 'index.html'),
  extractFunction(src, 'agingBandFor', 'index.html'),
  extractFunction(src, 'agingBandDef', 'index.html'),
  extractFunction(src, 'creditorTotalOwed', 'index.html'),
  extractFunction(src, 'creditorLastPaymentDate', 'index.html'),
  extractFunction(src, 'credOpenInvoices', 'index.html'),
  extractFunction(src, 'credAgingProfile', 'index.html'),
  extractFunction(src, 'credAllRows', 'index.html'),
  extractFunction(src, 'credRowAmount', 'index.html'),
  extractFunction(src, 'credCashOnHand', 'index.html'),
  'function sortState(){ return CRED_SORT_STATE; }',
  'function sortFirstDir(){ return CRED_SORT_FIRST_DIR; }',
  'function setBandFilter(v){ credBandFilter = v; }',
], {
  data,
  todayISO: () => TODAY,
  purchaseInvoiceBalanceDue: (pi) => Math.max(0, pi.total - (Number(pi.amountPaid) || 0)),
  supplierName: (id) => (data.suppliers.find((s) => s.id === id) || {}).name || '',
  cbDayPosition: (d) => ({ closing: data.__closing[d] }),
}, ['credOpenInvoices', 'credAgingProfile', 'credAllRows', 'credRowAmount', 'credCashOnHand',
  'creditorLastPaymentDate', 'agingBandFor', 'sortState', 'sortFirstDir', 'setBandFilter']);

let iid = 1;
// An invoice: [supplier, daysAgo, total, amountPaid, paymentDaysAgo]
const inv = (supplierId, days, total, paid, payDays) => ({
  id: iid++, supplierId, date: days === null ? '' : ago(days), total,
  amountPaid: paid || 0,
  payments: paid ? [{ date: ago(payDays), amount: paid }] : [],
  voided: false,
});
const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);
const band = (key) => scope.credAgingProfile().bands.find((b) => b.key === key);
const rowFor = (name) => scope.credAllRows().find((r) => r.name === name);
const reset = (suppliers, invoices) => {
  data.suppliers = suppliers;
  data.purchaseInvoices = invoices;
  data.__closing = {};
  data.cashDays = {};
  scope.setBandFilter('');
};

/* ---------- 1. the money is aged per invoice, not per supplier ------- *
 * The whole reason this file differs from its debtors twin.
 */
{
  reset(
    [{ id: 'S1', name: 'Roofings' }, { id: 'S2', name: 'Nile Paints' }],
    [
      inv('S1', 4, 3200000),     // big and fresh
      inv('S1', 140, 180000),    // small and ancient -- SAME supplier
      inv('S2', 110, 650000),
    ],
  );
  const p = scope.credAgingProfile();

  eq(p.total, 4030000, 'everything still owed');
  eq(band('b30').amount, 3200000, 'the fresh invoice sits in the newest band');
  eq(band('b90p').amount, 830000, 'and only the genuinely old money is over 90 days');

  /* Pinned as the number it must NOT be. Banding by supplier would drag
     Roofings' whole 3,380,000 into "over 90 days" and make that band
     4,010,000 -- nearly five times the truth. */
  t.check(band('b90p').amount !== 4010000,
    'a supplier\'s fresh invoice is NOT dragged old by their oldest one');

  eq(rowFor('Roofings').owed, 3380000, 'the supplier is still owed the whole of it');
  eq(rowFor('Roofings').ageDays, 140, 'and has still been kept waiting 140 days');
  eq(rowFor('Roofings').band, 'b90p', 'so they lead the payment order');
  eq(rowFor('Roofings').openCount, 2, 'across two unpaid bills');

  // The two objects are counted separately and neither is double-counted.
  eq(p.bands.reduce((s, b) => s + b.amount, 0), p.total,
    'the bands add up to the total — no shilling counted twice or dropped');
  eq(p.bands.reduce((s, b) => s + b.count, 0), p.invoices,
    'and every invoice is in exactly one of them');
  eq(p.invoices, 3, 'three invoices');
  eq(p.suppliers, 2, 'from two suppliers — counted apart, because one supplier can span bands');

  /* The bands count INVOICES and the profile counts SUPPLIERS, and the
     two only diverge once one supplier has two bills in one band. Above,
     each band happened to hold one bill per supplier, so a band counting
     suppliers by mistake added up to the same total and went unnoticed.
     This is the fixture that tells them apart. */
  reset([{ id: 'S1', name: 'Two bills, one band' }], [inv('S1', 5, 100000), inv('S1', 6, 200000)]);
  eq(band('b30').count, 2, 'two invoices in one band from one supplier count as two');
  eq(scope.credAgingProfile().suppliers, 1, 'while the supplier behind them is one');
  eq(scope.credAgingProfile().invoices, 2, 'and the invoice count follows the bands, not the suppliers');
}

/* ---------- 2. what is not owed is not listed ------------------------ */
{
  reset(
    [{ id: 'S1', name: 'Open' }, { id: 'S2', name: 'Settled' }, { id: 'S3', name: 'Voided' }],
    [
      inv('S1', 10, 1000000),
      inv('S2', 10, 800000, 800000, 2),                     // paid in full
      Object.assign(inv('S3', 10, 5000000), { voided: true }), // voided
    ],
  );
  const p = scope.credAgingProfile();
  eq(p.total, 1000000, 'a settled invoice is not a debt and a voided one never was');
  eq(p.invoices, 1, 'only the open invoice is counted');
  eq(p.suppliers, 1, 'and only its supplier');

  // A part payment leaves only the remainder owing.
  reset([{ id: 'S1', name: 'Part' }], [inv('S1', 10, 1500000, 500000, 3)]);
  eq(scope.credAgingProfile().total, 1000000, 'a part payment leaves the remainder owing');
}

/* ---------- 3. an age nobody knows ----------------------------------- *
 * Same trap as the debtors side, in a different shape: an invoice with
 * no date. Unknown is not zero, and it must not join the newest band.
 */
{
  reset([{ id: 'S1', name: 'Undated' }], [inv('S1', null, 400000)]);
  eq(scope.credOpenInvoices()[0].band, 'unknown', 'an undated invoice has an unknown age');
  eq(band('b30').amount, 0, 'and none of its money lands in the newest band');
  eq(band('unknown').amount, 400000, 'it is reported in a band of its own');
  eq(scope.credAgingProfile().total, 400000, 'and still counts towards what you owe');

  /* A supplier with one dated and one undated invoice: the oldest KNOWN
     age is what the row reports, and the undated one is flagged rather
     than folded in. Math.max over a raw -1 would have quietly reported
     the second-oldest invoice as the oldest. */
  reset([{ id: 'S1', name: 'Mixed' }], [inv('S1', 50, 100000), inv('S1', null, 200000)]);
  eq(rowFor('Mixed').ageDays, 50, 'the oldest DATED invoice sets the wait');
  eq(rowFor('Mixed').undatedCount, 1, 'and the undated one is counted so it can be said out loud');
  eq(rowFor('Mixed').openCount, 2, 'both are still unpaid bills');

  // All undated: there is no known wait at all.
  reset([{ id: 'S1', name: 'AllUndated' }], [inv('S1', null, 100000)]);
  eq(rowFor('AllUndated').ageDays, -1, 'with nothing dated there is no wait to report');
  eq(rowFor('AllUndated').band, 'unknown', 'rather than a wait of zero days');
}

/* ---------- 4. the band filter reconciles ---------------------------- *
 * A supplier can have money in several bands, so a filtered list that
 * showed whole balances would total MORE than the band card that was
 * clicked. The row reports that band's share instead.
 */
{
  reset(
    [{ id: 'S1', name: 'Roofings' }, { id: 'S2', name: 'Nile Paints' }],
    [inv('S1', 4, 3200000), inv('S1', 140, 180000), inv('S2', 110, 650000)],
  );
  eq(scope.credRowAmount(rowFor('Roofings')), 3380000,
    'unfiltered, a row reports the whole balance');

  scope.setBandFilter('b90p');
  eq(scope.credRowAmount(rowFor('Roofings')), 180000,
    'filtered to a band, it reports only that band\'s share');
  eq(scope.credRowAmount(rowFor('Nile Paints')), 650000,
    'a supplier wholly inside the band reports all of it');

  const shown = scope.credAllRows()
    .filter((r) => (r.inBand.b90p || 0) > 0.5)
    .reduce((s, r) => s + scope.credRowAmount(r), 0);
  eq(shown, band('b90p').amount,
    'so the list adds up to exactly the band card that was clicked');
  scope.setBandFilter('');
}

/* ---------- 5. when they were last paid ------------------------------ */
{
  reset([{ id: 'S1', name: 'Sometimes' }, { id: 'S2', name: 'Never' }], [
    inv('S1', 100, 500000, 100000, 90),
    inv('S1', 60, 400000, 50000, 20),   // the more recent payment
    inv('S2', 100, 300000),
  ]);
  eq(scope.creditorLastPaymentDate('S1'), ago(20),
    'the most recent payment across all their invoices, not the first');
  t.check(scope.creditorLastPaymentDate('S2') === null,
    'a supplier never paid anything has no last payment, rather than a zero date');
  t.check(rowFor('Never').lastPaid === null,
    'and the row carries that absence rather than filling it in');
}

/* ---------- 6. the payment order ------------------------------------- */
{
  const state = scope.sortState(), firstDir = scope.sortFirstDir();
  t.check(state.key === 'ageDays' && state.dir === -1,
    'the list opens oldest first — a payment order, not a league table of who you buy most from');
  eq(firstDir.name, 1, 'a name column opens A to Z');
  eq(firstDir.owed, -1, 'a money column opens with the biggest');
  eq(firstDir.lastPaid, 1, 'and last paid opens with those left waiting longest');

  const sort = (/function credRowsForList[\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(/if\(au !== bu\) return au \? 1 : -1;/.test(sort),
    'an undated balance sorts to the end of the age column in both directions');
  t.check(/a\.lastPaid \|\| '0000-00-00'/.test(sort),
    'while never-paid sorts as the longest ago, because that is what it is');
  /* Sorting on a figure you are not showing is how a list looks shuffled.
     Under a band filter the money column shows the band's share, so that
     is what the money column sorts on. */
  t.check(/if\(key === 'owed'\) return \(credRowAmount\(a\) - credRowAmount\(b\)\)/.test(sort),
    'and the money column sorts on the figure actually displayed');
}

/* ---------- 7. what is in hand to pay it with ------------------------ *
 * The one thing the buy side needs that the sell side does not: "you owe
 * 8,760,000" is half a sentence without it.
 */
{
  reset([{ id: 'S1', name: 'S' }], [inv('S1', 10, 1000000)]);

  /* READ-ONLY. cbDayPosition -> getDayRecord CREATES a day record when
     one is missing, and a page merely being LOOKED at must not write a
     day into the cash book as a side effect of rendering. */
  t.check(scope.credCashOnHand() === null,
    'with today not opened in the cash book, what is in hand is unknown');
  eq(Object.keys(data.cashDays).length, 0,
    'and asking did not create a cash day — reading a page must not write to the book');

  data.cashDays[TODAY] = { opening: {}, actual: {}, openingSet: true };
  data.__closing[TODAY] = 1900000;
  eq(scope.credCashOnHand(), 1900000, 'once the day is open it reads the cash book');

  const fn = (/function credCashOnHand[\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(/cbDayPosition\(date\)\.closing/.test(fn),
    'and reads the cash book\'s own arithmetic rather than adding cash up a second way');
  t.check(/if\(!data\.cashDays \|\| !data\.cashDays\[date\]\) return null;/.test(fn),
    'guarded on the record already existing, which is what keeps it read-only');

  // Zero in the drawer is a real figure and is not "unknown".
  data.__closing[TODAY] = 0;
  eq(scope.credCashOnHand(), 0, 'an empty drawer on an opened day reads as zero, not as unknown');
}

/* ---------- 8. the position is the whole book ------------------------ */
{
  const profile = (/function credAgingProfile[\s\S]*?\n\}\n/.exec(code) || [''])[0];
  t.check(!/credBandFilter/.test(profile) && !/cred_search/.test(profile),
    'the profile reads neither the band filter nor the search box');

  const list = (/function credRowsForList[\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(/credAllRows\(\)/.test(list),
    'the list and the bands read one row set — two panels, one arithmetic');

  const pos = (/function renderCreditorsPosition[\s\S]*?\n\}\n/.exec(code) || [''])[0];
  t.check(/flex-grow:\$\{b\.amount\}/.test(pos),
    'segment widths come from the money in each band');
  t.check(/live = p\.bands\.filter\(b=> b\.amount > 0\)/.test(pos),
    'a band holding nothing is left off the bar rather than drawn as a sliver of zero');
  t.check(/credBandFilter = \(credBandFilter === el\.dataset\.band\) \? '' : el\.dataset\.band/.test(pos),
    'clicking the active band turns the filter off again');
  t.check(/const big = p\.suppliers > 1 \? p\.biggest : null;/.test(pos),
    'the concentration figure is withheld when there is only one supplier');
  t.check(/Nothing is owed by you yet/.test(pos) && /Every supplier invoice on file is settled/.test(pos),
    'an empty book and a settled book say different things');
  t.check(/const any = \(data\.suppliers\|\|\[\]\)\.length > 0;/.test(pos),
    'and which one is said turns on whether there are any suppliers at all');

  /* Bands count invoices, rows count suppliers. Each has to name its own
     object or the two counts on screen read as a contradiction.
     Pinned on the band CARD: the same phrasing sits in the bar segment's
     title attribute, and a looser check passed on that one while the
     card underneath said "suppliers". */
  t.check(/<span class="age-band-meta">\$\{b\.count\} invoice\$\{b\.count===1\?'':'s'\}/.test(pos),
    'a band card says how many INVOICES are in it');
}

/* ---------- 9. one scale for both sides ------------------------------ */
{
  /* The debtors list and this one grade on the same ruler. Two lists that
     each decided what "over 90 days" meant would drift apart, and the two
     halves of one shop would be measured differently. */
  t.check((code.match(/const AGING_BANDS = \[/g) || []).length === 1,
    'the age bands are defined exactly once for the whole app');
  const debProfile = (/function debAgingProfile[\s\S]*?\n\}\n/.exec(code) || [''])[0];
  const credProfile = (/function credAgingProfile[\s\S]*?\n\}\n/.exec(code) || [''])[0];
  t.check(/AGING_BANDS\.map/.test(debProfile) && /AGING_BANDS\.map/.test(credProfile),
    'and both aging reports build their bands from it');
}

/* ---------- 10. what leaves the screen ------------------------------- */
{
  const exp = (/cred_export_btn'\)\.addEventListener[\s\S]*?\n\}\);/.exec(code) || [''])[0];
  t.check(/r\.ageDays < 0 \? '' : r\.ageDays/.test(exp),
    'an unknown age exports blank, not 0 — a spreadsheet will average a zero in');
  t.check(/r\.lastPaid \|\| 'Never'/.test(exp),
    'and never-paid exports as a word rather than an empty cell');
  t.check(/credRowAmount\(r\)/.test(exp),
    'and the exported figure is the one that was on screen');

  const prt = (/cred_print_btn'\)\.addEventListener[\s\S]*?\n\}\);/.exec(code) || [''])[0];
  t.check(/const p = credAgingProfile\(\);/.test(prt),
    'the print carries the aging profile, not just the rows');
  t.check(/<h2>What you owe, by age — whole book<\/h2>/.test(prt),
    'and says on its face that the profile is the whole book');
  t.check(/const cash = credCashOnHand\(\);/.test(prt),
    'with what is in hand on it too, since that is the decision it is printed for');

  const render = (/function renderCreditorsList[\s\S]*?\n\}\n/.exec(code) || [''])[0];
  /* Nothing in this app has payment terms, so nothing in it can be
     "overdue" -- the old heading claimed a due date nobody ever agreed. */
  t.check(!/Overdue/i.test(render), 'nothing claims to be overdue, since no terms are ever agreed');
  t.check(/>Waiting/.test(render), 'it says how long the supplier has been waiting');
  t.check(/>Last paid/.test(render), 'and when they were last paid');
  const tfoot = (/<tfoot>[\s\S]*?<\/tfoot>/.exec(render) || [''])[0];
  t.check(/rows\.length\} supplier\$\{rows\.length===1\?'':'s'\}/.test(tfoot),
    'the table foot counts what it is showing rather than printing a bare Total');
}

process.exit(t.done() ? 1 : 0);
