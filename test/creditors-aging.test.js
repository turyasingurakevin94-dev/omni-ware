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
  extractDeclaration(src, 'CRED_SORT_CHOICES', 'index.html'),
  extractDeclaration(src, 'CRED_SORT_STATE', 'index.html'),
  extractDeclaration(src, 'CRED_SORT_FIRST_DIR', 'index.html'),
  extractDeclaration(src, 'credBandFilter', 'index.html'),
  extractFunction(src, 'daysSinceDate', 'index.html'),
  extractFunction(src, 'agingBandFor', 'index.html'),
  extractFunction(src, 'agingBandDef', 'index.html'),
  extractFunction(src, 'creditorTotalOwed', 'index.html'),
  extractFunction(src, 'creditorLastPaymentDate', 'index.html'),
  extractFunction(src, 'credOpenInvoices', 'index.html'),
  extractFunction(src, 'billDueDate', 'index.html'),
  extractFunction(src, 'credAgingProfile', 'index.html'),
  extractFunction(src, 'credAllRows', 'index.html'),
  extractFunction(src, 'credRowAmount', 'index.html'),
  extractFunction(src, 'credRowProgress', 'index.html'),
  extractFunction(src, 'credCashOnHand', 'index.html'),
  extractFunction(src, 'credPayCompare', 'index.html'),
  extractFunction(src, 'credReach', 'index.html'),
  extractFunction(src, 'credRowTone', 'index.html'),
  'function sortState(){ return CRED_SORT_STATE; }',
  'function sortFirstDir(){ return CRED_SORT_FIRST_DIR; }',
  'function sortChoices(){ return CRED_SORT_CHOICES; }',
  'function setBandFilter(v){ credBandFilter = v; }',
], {
  data,
  todayISO: () => TODAY,
  // The fixture carries an invoice total directly; both helpers read it.
  purchaseInvoiceTotal: (pi) => Number(pi.total) || 0,
  purchaseInvoiceBalanceDue: (pi) => Math.max(0, pi.total - (Number(pi.amountPaid) || 0)),
  supplierName: (id) => (data.suppliers.find((s) => s.id === id) || {}).name || '',
  cbDayPosition: (d) => ({ closing: data.__closing[d] }),
}, ['credOpenInvoices', 'credAgingProfile', 'credAllRows', 'credRowAmount', 'credRowProgress', 'credCashOnHand',
  'credReach', 'credRowTone',
  'creditorLastPaymentDate', 'agingBandFor', 'sortState', 'sortFirstDir', 'sortChoices', 'setBandFilter']);

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
  /* IT STILL OPENS AS A PAYMENT ORDER; the order is just a better one.
     Oldest-first was this screen's answer to "who do I pay", borrowed
     from the debtors list, where age IS the whole question. It is not
     the whole question here: a supplier you promised to pay on the 22nd
     and did not is owed something age cannot see, and they are the one
     who stops delivering. So the default is the rule the screen states
     on itself and in its rail -- a day you named and let pass, then
     days you have given, then longest waiting -- with oldest-first
     still on the menu beside it. */
  t.check(state.key === 'pay',
    'the list opens in pay order — a payment order, not a league table of who you buy most from');
  t.check(Array.isArray(scope.sortChoices()) && scope.sortChoices()[0].key === 'pay'
    && scope.sortChoices().some((c) => c.key === 'ageDays'),
    'and it is the first of the orders offered, with oldest-first still among them');
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
  /* THE CONCENTRATION TILE IS GONE, because the bar draws it. "Largest
     single balance, 34% of everything you owe" was a sentence about one
     segment of a bar that now exists: every supplier is as wide as what
     they are owed, so the biggest is the widest and every other share
     sits beside it. The old check kept that tile from making a claim of
     a one-supplier book; no claim is made at all now. What has to hold
     instead is that the widths ARE the money, and that the gap between
     the drawer and the debt is not painted as bad news -- owing more
     than you hold on a given morning is how trade credit works, and
     crimson on it is the fault this screen was converted once to fix. */
  t.check(/class="ow-cr-rb-s \$\{credRowTone\(r\)\}" style="flex-grow:\$\{o\.owed\}"/.test(pos),
    'each supplier on the bar is exactly as wide as what is owed them');
  t.check(/tile\('Short today', `\$\{f\(reach\.short\)\}<span class="ow-u">UGX<\/span>`,\s*`cash covers <b>\$\{pct\(Math\.max\(0, cash\)\)\}%<\/b> of what you owe`\)/.test(pos),
    'and the gap between cash and debt is a figure in ink, not a warning');
  t.check(/const reach = credReach\(\);/.test(pos) && !/credRowsForList/.test(pos.replace(/function credOpenSupplier[\s\S]*/, '')),
    'the bar is measured on the whole book, never on the filtered list');
  t.check(/Nothing is owed by you yet/.test(pos) && /Every supplier invoice on file is settled/.test(pos),
    'an empty book and a settled book say different things');
  t.check(/const any = \(data\.suppliers\|\|\[\]\)\.length > 0;/.test(pos),
    'and which one is said turns on whether there are any suppliers at all');

  /* Bands count invoices, rows count suppliers. Each has to name its own
     object or the two counts on screen read as a contradiction.
     Pinned on the band CARD: the same phrasing sits in the bar segment's
     title attribute, and a looser check passed on that one while the
     card underneath said "suppliers". */
  t.check(/<span class="ow-db-ag-m">\$\{b\.count\} invoice\$\{b\.count===1\?'':'s'\}/.test(pos),
    'a band card says how many INVOICES are in it');
}

/* ---------- 8b. how far today's cash reaches ------------------------- *
 * One walk down the whole book in pay order, paying each supplier in
 * full before the next. The bar, the "cash covers" meter on each row and
 * the line across the list all read it, so none can say the money goes
 * further than another does.
 */
{
  reset(
    [{ id: 'S1', name: 'No day' }, { id: 'S2', name: 'Day coming' }, { id: 'S3', name: 'Word broken' }],
    [
      inv('S1', 80, 300000),
      Object.assign(inv('S2', 20, 700000), { dueDate: ago(-3) }),
      Object.assign(inv('S3', 40, 600000), { dueDate: ago(5) }),
    ],
  );
  const r0 = scope.credReach();
  t.check(r0.cash === null && r0.order.every((o) => o.covered === null) && r0.short === null,
    'with today not opened, nothing is measured -- covered is unknown, not zero');
  eq(r0.order.map((o) => o.row.name).join(' > '), 'Word broken > Day coming > No day',
    'the walk runs in pay order: a broken word, then a day given, then the rest');
  eq(r0.total, 1600000, 'and over the whole book');

  data.cashDays[TODAY] = { opening: {}, actual: {}, openingSet: true };
  data.__closing[TODAY] = 1000000;
  const r = scope.credReach();
  eq(r.order.map((o) => o.covered).join(','), '600000,400000,0',
    'each supplier gets what is left after everyone above them');
  eq(r.short, 600000, 'and what the drawer cannot reach is the gap');
  eq(r.order.reduce((n, o) => n + o.covered, 0), 1000000,
    'no shilling of cash is counted twice or left over while anything is owed');

  scope.setBandFilter('b30');
  eq(scope.credReach().order.length, 3, 'a band filter does not narrow the walk -- it is the whole book');
  scope.setBandFilter('');

  data.__closing[TODAY] = -50000;
  t.check(scope.credReach().order.every((o) => o.covered === 0),
    'an overdrawn day covers nothing, rather than a negative share of somebody');
  data.__closing[TODAY] = 5000000;
  const all = scope.credReach();
  t.check(all.order.every((o) => o.covered === o.owed) && all.short === 0,
    'and a drawer that holds more than the book covers every supplier in full');
  eq(scope.credRowTone(rowFor('Word broken')), 'ow-bad', 'a broken word is painted as one');
  eq(scope.credRowTone(rowFor('Day coming')), 'ow-warn', 'a day given as a commitment');
  eq(scope.credRowTone(rowFor('No day')), 'ow-none', 'and no day as nothing at all');

  const list = (/function credRowsForList[\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(/if\(key === 'pay'\) return credPayCompare\(a, b\);/.test(list),
    'the list ranks with the very comparator the walk uses');
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
  /* Both were wired at parse time to buttons up in the panel head, one
     heading above the search box that decided what they would contain.
     The toolbar is drawn with the list now -- directly above the rows it
     acts on -- so #cred_export_btn does not exist when the script runs
     and the same code is a function wired per render, exactly as
     debExportCSV is on the other side of the book. What each one does is
     unchanged, and that is what is pinned below. */
  const exp = (/function credExportCSV\(\)\{[\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(/r\.ageDays < 0 \? '' : r\.ageDays/.test(exp),
    'an unknown age exports blank, not 0 — a spreadsheet will average a zero in');
  t.check(/r\.lastPaid \|\| 'Never'/.test(exp),
    'and never-paid exports as a word rather than an empty cell');
  t.check(/credRowAmount\(r\)/.test(exp),
    'and the exported figure is the one that was on screen');

  const prt = (/function credPrintList\(\)\{[\s\S]*?\n\}/.exec(code) || [''])[0];
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
  /* There is no <tfoot> to count in: the table became a queue of rows
     that open in place. The promise it was making is kept in two places
     instead -- the panel head carries "3 of 9 · 2,180,000 shown", and
     the foot names what the filters removed and the figure it takes
     with it. Neither prints a bare Total, which was the point. */
  t.check(/rows\.length\}\$\{\s*\n?\s*rows\.length !== owingAll\.length \? ' of ' \+ owingAll\.length/.test(render),
    'the panel head counts what it is showing against the whole book');
  t.check(/supplier\$\{hiddenCount===1\?'':'s'\} owed <b>\$\{f\(hiddenSum\)\}<\/b>/.test(render),
    'and what the filters removed is named, with the money it takes with it');
}

/* ---------- how far through paying a supplier off -------------------- *
 * The same question as the customer side, on data that answers it more
 * directly: a supplier balance is not stored anywhere, it IS the sum of
 * what their own invoices still carry. So there is no drift case here
 * and no "typed straight in" case -- porting the customer side's two
 * reasons would imply hazards the buy side does not have.
 */
{
  scope.setBandFilter('');
  reset(
    [{ id: 'S1', name: 'Roofings' }, { id: 'S2', name: 'Nile Paints' }, { id: 'S3', name: 'Settled' }],
    [
      inv('S1', 10, 5000000, 2000000, 5),   // fresh, 40% paid
      inv('S1', 200, 1000000, 0),           // ancient, untouched
      inv('S2', 20, 1000000, 900000, 3),    // nearly clear
      inv('S3', 15, 1000000, 1000000, 2),   // fully settled
    ],
  );
  const prog = (name) => scope.credRowProgress(rowFor(name));
  const pct = (name) => Math.round(prog(name).pct * 100);

  eq(pct('Roofings'), 33, 'two million paid against six million still open is a third of the way');
  eq(prog('Roofings').owed, 4000000, 'with four million still to find');
  eq(pct('Nile Paints'), 90, 'and a nearly-cleared supplier reads nearly cleared');

  /* THE BAR MUST NEVER DISAGREE WITH THE FIGURE BESIDE IT. Whatever the
     scope, what it says is owed is what the row reports as owed. */
  ['Roofings', 'Nile Paints'].forEach((n) => {
    t.check(Math.abs(prog(n).owed - scope.credRowAmount(rowFor(n))) < 1,
      `${n}'s bar is measured against the very amount printed next to it`);
  });

  /* A supplier with nothing outstanding is not at 100% and not at 0% --
     there is nothing to be part way through. They only appear at all
     when Hide-no-balance is off, and a bar either way would be a claim
     about a debt that does not exist. */
  t.check(prog('Settled') === null,
    'a settled supplier has no progress to show rather than a full bar');
}

/* ---------- scoped exactly as the amount is -------------------------- *
 * Clicking a band makes each row report that band's share. A bar drawn
 * over ALL of a supplier's invoices would then sit beside a figure it
 * was not measuring -- the row would say one thing and the bar another.
 */
{
  scope.setBandFilter('b90p');
  const r = rowFor('Roofings');
  const p = scope.credRowProgress(r);
  eq(scope.credRowAmount(r), 1000000, 'the row reports only the over-90 invoice');
  eq(Math.round(p.pct * 100), 0,
    'and the bar is measured over that invoice alone — nothing has been paid on it');
  eq(p.charged, 1000000, 'against what that invoice was for');
  t.check(Math.abs(p.owed - scope.credRowAmount(r)) < 1,
    'so the two still agree, which is the point of scoping it');

  scope.setBandFilter('b30');
  const fresh = scope.credRowProgress(rowFor('Roofings'));
  eq(Math.round(fresh.pct * 100), 40,
    'and narrowed to the fresh band the same supplier reads 40%, not 33%');

  /* A supplier with nothing in the chosen band has nothing to show,
     rather than falling back to their whole balance. */
  eq(scope.credRowProgress(rowFor('Nile Paints')) === null
    || Math.round(scope.credRowProgress(rowFor('Nile Paints')).pct * 100) === 90, true,
    'a supplier wholly inside the band still reads their own figure');
  scope.setBandFilter('b90p');
  t.check(scope.credRowProgress(rowFor('Roofings')).charged === 1000000,
    'and one split across bands is measured only on the part being shown');
  scope.setBandFilter('');
}

/* ---------- what the cell says --------------------------------------- */
{
  const code = src.split(/\r?\n/).map((l) => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');
  const render = (/function renderCreditorsList[\s\S]*?\n\}\n/.exec(code) || [''])[0];
  /* IT IS NO LONGER A COLUMN, and that is the buy side differing from
     the sell side rather than a feature dropped. On the customer list a
     part-payer is a signal about THEM -- somebody paying it down is a
     different prospect from somebody who has stopped. Here the
     part-payer is you, and how far through your own bill you are does
     not decide who to pay next. The width goes to the column that does
     decide it: whether you gave this supplier a day and let it pass.

     So the figure moves into the open row, where there is room to say
     what it is measured from -- which is where the customer side put
     its own charged-and-paid figures for the same reason. */
  t.check(!/<th>Paid off<\/th>/.test(render),
    'the queue row does not spend a column on how far through your own bill you are');
  t.check(/of the way through paying them off/.test(render),
    'and an opened supplier says it in words, with the figures behind it');

  /* The dash means something DIFFERENT here from on the customer side.
     A supplier balance is the sum of their own invoices, so it cannot
     drift and cannot be typed in -- the only way to have no progress is
     to owe nothing. Carrying the customer side's wording across would
     tell somebody their supplier balance has no charges behind it, which
     on the buy side is never the reason. */
  t.check(/Nothing outstanding to this supplier/.test(render),
    'a supplier with nothing owing is told that, not the customer-side reason');
  t.check(/nothing to be part way through/.test(render),
    'and told what that means rather than shown a dash');
  t.check(!/No dated charges behind this balance/.test(render),
    'and the customer-side wording is not borrowed for a case it cannot describe');

  // Invoiced, not charged: it is the buy side and the document is an
  // invoice the shop received.
  t.check(/invoiced on what is still open/.test(render),
    'the figures behind the percentage are named in buy-side words');
  t.check((render.match(/credBandFilter\s*\?\s*', in this band'\s*:\s*''/g) || []).length >= 2,
    'and say so when a band has narrowed what is being measured — in both readings');
}

process.exit(t.done() ? 1 : 0);
