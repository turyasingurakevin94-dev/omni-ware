#!/usr/bin/env node
'use strict';
/*
 * The debtors list, read as a chase order.
 *
 * Money owed is not one number. It is a number AND an age, and the age
 * is what says whether a balance is trade or a loss nobody has admitted
 * yet. The page sorted by size and printed the age as a bare figure in
 * the fifth column, so a 210-day-old balance sat below a 3-day-old one
 * purely for being smaller: the healthy debt at the top, the rotting
 * debt buried.
 *
 * Three things it could not answer:
 *
 *   how bad is it   what share of the money is old. There were no
 *                   bands and no totals by age, so thirty rows had to
 *                   be banded in the reader's head.
 *   who first       sorted by size, which is a rich list, not a
 *                   chase order.
 *   are they still  nothing showed when a customer last paid
 *   paying          anything, which is the clearest read there is on
 *                   whether one has gone quiet.
 *
 * THE TRAP THIS FILE EXISTS FOR: an age nobody knows is not an age of
 * zero. A balance with no dated charge behind it -- typed straight in,
 * or drifted away from its own history -- lands in a band of its own.
 * Let it fall into "under 30 days" and the whole profile flatters
 * itself, on the one screen whose job is to stop that happening.
 *
 * Run: node test/debtors-aging.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('debtors aging');
const src = read('index.html');
const code = src.split(/\r?\n/).map((l) => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');
const TODAY = '2026-08-04';
const data = { customers: [] };

// Days back from TODAY as a stored YYYY-MM-DD.
const ago = (days) => new Date(Date.parse(TODAY + 'T00:00:00Z') - days * 86400000)
  .toISOString().slice(0, 10);

const scope = compileScope([
  extractDeclaration(src, 'DEB_BANDS', 'index.html'),
  extractDeclaration(src, 'DEB_SORT_STATE', 'index.html'),
  extractDeclaration(src, 'DEB_SORT_FIRST_DIR', 'index.html'),
  extractFunction(src, 'daysSinceDate', 'index.html'),
  extractFunction(src, 'customerOldestOpenChargeDate', 'index.html'),
  extractFunction(src, 'customerLastPaymentDate', 'index.html'),
  extractFunction(src, 'debBandFor', 'index.html'),
  extractFunction(src, 'debBandDef', 'index.html'),
  extractFunction(src, 'debAllRows', 'index.html'),
  extractFunction(src, 'debAgingProfile', 'index.html'),
  // compileScope hands back functions only, so the two sort constants
  // come out through accessors. Test-side wrappers, not app code.
  'function sortState(){ return DEB_SORT_STATE; }',
  'function sortFirstDir(){ return DEB_SORT_FIRST_DIR; }',
], {
  data,
  todayISO: () => TODAY,
}, ['debBandFor', 'debBandDef', 'debAllRows', 'debAgingProfile', 'customerLastPaymentDate',
  'sortState', 'sortFirstDir']);

let nextId = 1;
// charges/payments are [daysAgo, amount] pairs.
const customer = (name, charges, payments) => {
  const log = [];
  (charges || []).forEach(([d, a]) => log.push({ id: nextId++, date: ago(d), type: 'charge', amount: a }));
  (payments || []).forEach(([d, a]) => log.push({ id: nextId++, date: ago(d), type: 'payment', amount: a }));
  return {
    id: 'C' + nextId, name, location: '',
    debt: log.reduce((s, l) => s + (l.type === 'charge' ? l.amount : -l.amount), 0),
    debtLog: log,
  };
};
const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);
const bandOf = (name) => scope.debAllRows().find((r) => r.name === name).band;
const amountIn = (key) => scope.debAgingProfile().bands.find((b) => b.key === key).amount;
const countIn = (key) => scope.debAgingProfile().bands.find((b) => b.key === key).count;

/* ---------- 1. every balance lands in exactly one band --------------- */
{
  data.customers = [
    customer('Fresh', [[0, 100]]),
    customer('Day 29', [[29, 100]]),
    customer('Day 30', [[30, 100]]),
    customer('Day 59', [[59, 100]]),
    customer('Day 60', [[60, 100]]),
    customer('Day 89', [[89, 100]]),
    customer('Day 90', [[90, 100]]),
    customer('Ancient', [[400, 100]]),
  ];

  eq(bandOf('Fresh'), 'b30', 'a charge raised today is under 30 days');
  eq(bandOf('Day 29'), 'b30', 'and so is one at 29 days');
  // The boundaries are where an off-by-one hides, and an off-by-one here
  // moves money between a band that is fine and a band that is not.
  eq(bandOf('Day 30'), 'b60', 'at exactly 30 days it moves up a band');
  eq(bandOf('Day 59'), 'b60', 'and stays there to 59');
  eq(bandOf('Day 60'), 'b90', 'at exactly 60 it moves again');
  eq(bandOf('Day 89'), 'b90', 'and stays there to 89');
  eq(bandOf('Day 90'), 'b90p', 'at exactly 90 it is over 90 days');
  eq(bandOf('Ancient'), 'b90p', 'and there is nothing past that band to fall out of');

  // No double-counting, and nothing lost between the bands.
  const p = scope.debAgingProfile();
  eq(p.bands.reduce((s, b) => s + b.amount, 0), p.total,
    'the bands add up to the total — no shilling counted twice or dropped');
  eq(p.bands.reduce((s, b) => s + b.count, 0), p.customers,
    'and every debtor is in exactly one of them');
  eq(p.total, 800, 'eight balances of 100');
}

/* ---------- 2. an age nobody knows -----------------------------------
 * The point of the whole file. A balance with no dated charge behind it
 * has an unknown age, and unknown is not zero.
 */
{
  data.customers = [
    customer('Dated', [[95, 1000]]),
    // A balance typed straight in: real money owed, no history to age it.
    { id: 'CX', name: 'Undated', location: '', debt: 500, debtLog: [] },
  ];

  eq(bandOf('Undated'), 'unknown', 'a balance with no dated charge has an unknown age');
  t.check(bandOf('Undated') !== 'b30',
    'and specifically does NOT join "under 30 days", which would flatter the profile');
  eq(scope.debAllRows().find((r) => r.name === 'Undated').ageDays, -1,
    'its age reads as absent rather than as a number');
  eq(amountIn('unknown'), 500, 'its money is reported, in a band of its own');
  eq(amountIn('b30'), 0, 'and none of it lands in the newest band');
  eq(scope.debAgingProfile().total, 1500, 'it still counts towards what you are owed');
}

/* ---------- 3. a balance that is settled is not a debtor ------------- */
{
  data.customers = [
    customer('Owing', [[10, 1000]]),
    customer('Settled', [[10, 1000]], [[2, 1000]]),
    customer('Never bought', [], []),
  ];
  const p = scope.debAgingProfile();
  eq(p.customers, 1, 'only the customer actually owing something is a debtor');
  eq(p.total, 1000, 'and only their money is counted');
  eq(p.biggest.name, 'Owing', 'the largest debt is picked from those who owe');
}

/* ---------- 4. how long the CURRENT balance has been owing ----------- *
 * Not when they last did something. Payments clear the oldest charge
 * first, so what is still open is what the age measures.
 */
{
  data.customers = [
    // Old charge fully cleared, recent charge left standing: the balance
    // is 12 days old, not 40, even though the account has been open 40.
    customer('Ssemwanga', [[40, 900], [12, 2800]], [[8, 1200]]),
  ];
  const r = scope.debAllRows()[0];
  eq(r.debt, 2500, 'what is left after the payment');
  eq(r.ageDays, 12, 'aged from the oldest charge still open, not the oldest charge');
  eq(r.band, 'b30', 'so it bands as recent debt, which is what it is');
}

/* ---------- 5. when they last paid anything -------------------------- *
 * The clearest read there is on whether a customer has gone quiet, and
 * the list never carried it.
 */
{
  data.customers = [
    customer('Pays sometimes', [[100, 5000]], [[90, 100], [30, 200]]),
    customer('Never has', [[100, 5000]], []),
  ];
  eq(scope.customerLastPaymentDate(data.customers[0]), ago(30),
    'the most recent payment, not the first and not the largest');
  t.check(scope.customerLastPaymentDate(data.customers[1]) === null,
    'a customer who has never paid has no last payment, rather than a zero date');

  /* Never-paid and paid-long-ago are different facts. Only one of them
     is a reason to stop selling to somebody on credit. */
  t.check(scope.debAllRows().find((r) => r.name === 'Never has').lastPaid === null,
    'and the row carries that absence rather than filling it in');
}

/* ---------- 6. the chase order --------------------------------------- */
{
  const state = scope.sortState(), firstDir = scope.sortFirstDir();
  t.check(state.key === 'ageDays' && state.dir === -1,
    'the list opens oldest first, because the page is a chase order and not a rich list');

  // Text reads A-Z on the first click, money and days read worst-first.
  // Every column used to open descending, so "Customer name" gave Z-A.
  eq(firstDir.name, 1, 'a name column opens A to Z');
  eq(firstDir.debt, -1, 'a money column opens with the biggest');
  eq(firstDir.lastPaid, 1,
    'and last payment opens with those who have not paid in longest');

  const sort = (/function debRowsForList[\s\S]*?\n\}/.exec(code) || [''])[0];
  /* An unknown age has no place on an age axis, so it sorts to the end
     whichever way the column points -- a raw -1 put it at the "newest"
     end, which reads as least urgent. */
  t.check(/if\(au !== bu\) return au \? 1 : -1;/.test(sort),
    'an undated balance sorts to the end of the age column in both directions');
  /* Never having paid IS a position on the payment axis and it is the
     far end of it -- unlike an unknown age, it is a thing we know. */
  t.check(/a\.lastPaid \|\| '0000-00-00'/.test(sort),
    'while never-paid sorts as the longest ago, because that is what it is');
}

/* ---------- 7. the position is the whole book ------------------------ *
 * The bar and the total above it are what the shop is owed. The search
 * box and the band filter act on the list below. A headline that shrinks
 * because somebody left a filter on is a headline nobody can trust --
 * the stock log made exactly this mistake with its totals.
 */
{
  const profile = (/function debAgingProfile[\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(/debAllRows\(\)\.filter\(r=> r\.debt > 0\.5\)/.test(profile),
    'the profile totals every debtor on file');
  t.check(!/debBandFilter/.test(profile) && !/deb_search/.test(profile),
    'and reads neither the band filter nor the search box');

  // One row set, read by both panels, so they cannot disagree.
  const list = (/function debRowsForList[\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(/debAllRows\(\)/.test(list),
    'the list reads the same rows the profile totals — one arithmetic, two panels');

  /* The two totals sit on one screen, so the smaller one has to say what
     it is the total OF. Pinned on the tfoot cell specifically: the same
     "N customers" phrasing appears in the mobile card summary, and a
     looser check passed on that while the tfoot said "Total". */
  const render = (/function renderDebtorsList[\s\S]*?\n\}\n/.exec(code) || [''])[0];
  const tfoot = (/<tfoot>[\s\S]*?<\/tfoot>/.exec(render) || [''])[0];
  t.check(/rows\.length\} customer\$\{rows\.length===1\?'':'s'\}/.test(tfoot),
    'the table foot counts what it is showing rather than printing a bare Total');
  t.check(/debBandFilter \?/.test(tfoot),
    'and names the band when one is narrowing it');
}

/* ---------- 8. the bar is honest and reachable ----------------------- */
{
  const pos = (/function renderDebtorsPosition[\s\S]*?\n\}\n/.exec(code) || [''])[0];
  t.check(/flex-grow:\$\{b\.amount\}/.test(pos),
    'segment widths come from the money in each band, not from how many rows it fills');
  t.check(/live = p\.bands\.filter\(b=> b\.amount > 0\)/.test(pos),
    'a band holding nothing is left off the bar rather than drawn as a sliver of zero');
  t.check(/min-width:14px/.test(src),
    'and a band too small to see still has something to click');

  /* Clicking the band you are already in clears it: the way out is the
     same control as the way in. */
  t.check(/debBandFilter = \(debBandFilter === el\.dataset\.band\) \? '' : el\.dataset\.band/.test(pos),
    'clicking the active band turns the filter off again');

  // A filter set in one panel and felt in another has to be visible in
  // the second, or it is a filter somebody forgets they set.
  t.check(/function renderDebFilterNote/.test(code) && /Show everyone/.test(code),
    'the list says when a band filter is narrowing it, with the way out beside it');

  /* "Largest single debt, 100% of the total" is not a finding when it is
     also the only debt -- it is the same number printed twice. */
  t.check(/const big = p\.customers > 1 \? p\.biggest : null;/.test(pos),
    'the concentration figure is withheld when there is only one debtor');

  /* A shop with no customers yet has not settled up, it has not started,
     and being told the first on day one reads as the app misreading
     what it is looking at. Both the two wordings AND the thing that
     picks between them: with only the wordings pinned, hard-coding the
     condition to one branch left every check green. */
  t.check(/Nothing is owed to you yet/.test(pos) && /Every customer on file is settled up/.test(pos),
    'an empty book and a settled book say different things');
  t.check(/const any = \(data\.customers\|\|\[\]\)\.length > 0;/.test(pos),
    'and which one is said turns on whether there are any customers at all');
}

/* ---------- 9. what leaves the screen -------------------------------- */
{
  const exp = (/deb_export_btn'\)\.addEventListener[\s\S]*?\n\}\);/.exec(code) || [''])[0];
  t.check(/r\.ageDays < 0 \? '' : r\.ageDays/.test(exp),
    'an unknown age exports blank, not 0 — a spreadsheet will average a zero in');
  t.check(/r\.lastPaid \|\| 'Never'/.test(exp),
    'and never-paid exports as a word rather than an empty cell');

  /* The printed sheet is what somebody carries out to chase people, so
     the shape of the problem has to be on it -- and always the whole
     book, even when the screen is filtered to one band, or a printed
     page could quietly under-report what is owed. */
  /* Block comments are NOT stripped from `code`, and the note above this
     very block uses the words "whole book" -- checking the extracted
     handler for that phrase passed while the heading said something
     else entirely. The markup itself is what has to be pinned. */
  const prt = (/deb_print_btn'\)\.addEventListener[\s\S]*?\n\}\);/.exec(code) || [''])[0];
  t.check(/const p = debAgingProfile\(\);/.test(prt),
    'the print carries the aging profile, not just the rows');
  t.check(/<h2>What you are owed, by age — whole book<\/h2>/.test(prt),
    'and says on its face that the profile is the whole book');
  t.check(/\$\{scope\}/.test(prt),
    'while the list says which customers it is actually listing');
}

/* ---------- 10. the column headings say what they hold --------------- */
{
  const section = (/<section id="tab-analytics-debtors"[\s\S]*?\n    <\/section>/.exec(src) || [''])[0];
  const render = (/function renderDebtorsList[\s\S]*?\n\}\n/.exec(code) || [''])[0];

  /* It was headed "Category" while showing c.location, and the search
     placeholder promised a category to search by that never existed. */
  t.check(/r\.location/.test(render) && !/r\.category/.test(render),
    'the customer\'s place is called a place');
  // Both the heading and the field it reads: renaming only the variable
  // left a column still headed "Category" over a list of towns.
  t.check(!/category/i.test(render),
    'and no column is headed Category either');
  t.check(!/category/i.test(section),
    'nor does the search box offer a category that was never there');

  /* Nothing in this app has payment terms, so nothing in it can be
     "overdue" -- only outstanding. The old heading claimed a due date
     the shop never agreed. */
  t.check(!/Overdue/i.test(render), 'nothing claims to be overdue, since no terms are ever agreed');
  t.check(/>Owing for/.test(render), 'it says how long the money has been owing');
  t.check(/>Last payment/.test(render), 'and when they last paid anything');
}

process.exit(t.done() ? 1 : 0);
