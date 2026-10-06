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
  extractDeclaration(src, 'AGING_BANDS', 'index.html'),
  extractDeclaration(src, 'DEB_SORT_STATE', 'index.html'),
  extractDeclaration(src, 'DEB_SORT_FIRST_DIR', 'index.html'),
  extractFunction(src, 'daysSinceDate', 'index.html'),
  extractFunction(src, 'customerOpenCharges', 'index.html'),
  extractFunction(src, 'customerOldestOpenChargeDate', 'index.html'),
  extractFunction(src, 'customerLastPaymentDate', 'index.html'),
  extractFunction(src, 'customerLedgerTotal', 'index.html'),
  extractFunction(src, 'customerDebtDrift', 'index.html'),
  extractFunction(src, 'customerDebtProgress', 'index.html'),
  extractFunction(src, 'agingBandFor', 'index.html'),
  extractFunction(src, 'agingBandDef', 'index.html'),
  extractFunction(src, 'debAllRows', 'index.html'),
  extractFunction(src, 'debAgingProfile', 'index.html'),
  extractDeclaration(src, 'DEB_AGE_FILL', 'index.html'),
  extractDeclaration(src, 'DEB_AGE_INK', 'index.html'),
  extractDeclaration(src, 'DEB_AGE_WEEKS', 'index.html'),
  extractDeclaration(src, 'DEB_AGE_CLASSIC', 'index.html'),
  extractFunction(src, 'debAgeScale', 'index.html'),
  extractFunction(src, 'debAgeFilterDef', 'index.html'),
  // compileScope hands back functions only, so the two sort constants
  // come out through accessors. Test-side wrappers, not app code.
  'function sortState(){ return DEB_SORT_STATE; }',
  'function sortFirstDir(){ return DEB_SORT_FIRST_DIR; }',
], {
  data,
  todayISO: () => TODAY,
}, ['agingBandFor', 'agingBandDef', 'debAllRows', 'debAgingProfile', 'customerLastPaymentDate',
  'sortState', 'sortFirstDir', 'customerDebtProgress', 'customerOpenCharges', 'debAgeScale', 'debAgeFilterDef']);

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

/* ---------- 4b. a payment that names an invoice pays that invoice ---- *
 *
 * THE SAME MONEY, CREDITED TWO DIFFERENT WAYS, AND BOTH ADDING UP.
 *
 * The ledger records which invoice a payment was for. This walk threw
 * that away and poured every shilling into the oldest bucket instead —
 * so the invoice list and the age line disagreed about which debts were
 * still open, while their TOTALS matched exactly, which is the only
 * thing customerDebtDrift compares. Nothing complained.
 *
 * Live, on this shop: a customer paid 735,000 against INV-0223. The
 * invoice list held it there and went on showing INV-0197 of 21 August
 * as unpaid. This walk spent the same 735,000 on the oldest charges
 * instead, and reported the oldest outstanding as 24 August. The chase
 * message printed BOTH — the 21 August invoice in its list, and
 * "outstanding 5 days" underneath — and went to the customer arguing
 * with itself.
 *
 * And it made the debt look younger than it is. Age decides who is
 * chased at all.
 */
{
  const inv = (days, amount, quoteId) => ({ id: nextId++, date: ago(days), type: 'charge', amount, quoteId });
  const pay = (days, amount, quoteId) => ({ id: nextId++, date: ago(days), type: 'payment', amount, quoteId });
  const log = [
    inv(19, 450000),            // carried on the account from earlier — names no invoice
    inv(8, 285000, 197),
    inv(5, 715000, 208),
    inv(3, 1570000, 223),
    pay(1, 735000, 223),        // paid against INV-0223, and said so
  ];
  data.customers = [{ id: 'CX', name: 'Mulongo', location: '', debtLog: log,
    debt: log.reduce((s, l) => s + (l.type === 'charge' ? l.amount : -l.amount), 0) }];

  const r = scope.debAllRows()[0];
  eq(r.debt, 2285000, 'the balance is unmoved — the same money, in different buckets');
  eq(r.ageDays, 19,
    'the payment goes to the invoice it NAMES, so the 450,000 carried from earlier is still the oldest thing owed — 19 days, not the 5 the oldest-first walk reported');
  eq(r.band, 'b30', 'and it bands on the truth');

  /* The remainder of a named payment still goes oldest first: paying
     more against one invoice than it is worth is not a reason to leave
     the rest unallocated. */
  data.customers[0].debtLog = [
    inv(19, 450000),
    inv(8, 285000, 197),
    inv(3, 100000, 223),
    pay(1, 550000, 223),        // 100,000 clears INV-0223; 450,000 is loose
  ];
  data.customers[0].debt = 285000;
  eq(scope.debAllRows()[0].ageDays, 8,
    'what is left over after the named invoice is settled still runs oldest first — the 450,000 goes, and the charge behind it is what remains');

  /* AND THE ORDINARY CASE IS UNTOUCHED. Most payments name nothing —
     money handed across a counter for no stated reason — and oldest
     first is the right rule for those. */
  data.customers[0].debtLog = [
    inv(19, 450000),
    inv(8, 285000, 197),
    pay(1, 450000),             // names nothing
  ];
  data.customers[0].debt = 285000;
  eq(scope.debAllRows()[0].ageDays, 8,
    'a payment naming no invoice still clears the oldest charge first, exactly as before');

  /* A payment naming an invoice this customer has no charge for cannot
     vanish: it falls through to oldest-first rather than being lost. */
  data.customers[0].debtLog = [
    inv(19, 450000),
    inv(8, 285000, 197),
    pay(1, 450000, 999),        // no charge on file for 999
  ];
  data.customers[0].debt = 285000;
  eq(scope.debAllRows()[0].ageDays, 8,
    'and one naming an invoice with no charge behind it is not silently dropped — it pays the oldest, because the money did arrive');

  /* MONEY THAT ARRIVES BEFORE ITS CHARGE IS CREDIT, NOT LOST. Live, a
     counter sale is often written down payment first and charge second
     on the same day. The walk used to drop a payment that found nothing
     open, so the charge behind it stood as owed forever: 3.6m of settled
     customers looked unpaid in every history built on the walk, while
     their balances said zero. */
  data.customers[0].debtLog = [
    pay(5, 300000),             // handed over first
    inv(5, 300000),             // then the sale it paid for
    inv(2, 120000),
  ];
  data.customers[0].debt = 120000;
  const open = scope.customerOpenCharges(data.customers[0]);
  eq(open.reduce((s, ch) => s + ch.remaining, 0), 120000,
    'a payment logged before its charge pays that charge — what stays open is what the balance says');
  eq(open.length, 1, 'and only the later sale is still open');
  data.customers[0].debtLog = [pay(9, 500000), inv(6, 200000), inv(3, 200000)];
  data.customers[0].debt = 0;
  eq(scope.customerOpenCharges(data.customers[0]).length, 0,
    'a deposit larger than what was bought after it leaves nothing open');
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
     it is the total OF.
     ------------------------------------------------------------------
     WAS PINNED ON A <tfoot> CELL, and there is no longer a table to have
     one: the list is .ow-q rows that open in place, emitted with their
     own phone cards from one call. The requirement is unchanged and is
     now met in two places instead of one -- the panel head counts what
     is shown AGAINST the whole book ("3 of 14 · 2,180,000 shown"), and
     the note where the removed rows would have been says how many
     customers and how much money the filters took away. Both are
     checked, because the second is the one a reader who has scrolled
     actually sees. */
  const render = (/function renderDebtorsList[\s\S]*?\n\}\n/.exec(code) || [''])[0];
  const panHead = (/<div class="ow-pan-h">[\s\S]*?<\/div>/.exec(render) || [''])[0];
  t.check(/rows\.length !== owingAll\.length \? ' of ' \+ owingAll\.length/.test(panHead),
    'the panel head counts what it is showing against the whole book, not a bare total');
  t.check(/customer\$\{hiddenCount===1\?'':'s'\} owing/.test(render)
    && /hiddenSum/.test(render),
    'and the foot names how many customers, and how much money, the filters removed');
  t.check(/debBandFilter \?/.test(render) && /bandDef \? bandDef\.label/.test(render),
    'naming the band when one is narrowing it');
}

/* ---------- 7b. the age columns follow the book ---------------------- *
 *
 * A shop whose customers rarely run past two months drew 60-90 and 90+
 * as two columns that were always empty, and all of its money in one
 * tall "under 30 days". Live, that was 95% of the book in one column.
 */
{
  const dxOf = (charges, unknown = 0) => ({
    xs: [{ id: 'A', dated: charges.map(([age, remaining]) => ({ age, remaining })) }],
    bands: [{ key: 'unknown', label: 'No date on record', amount: unknown, count: unknown ? 1 : 0, per: [] }],
  });
  const young = scope.debAgeScale(dxOf([[2, 500], [9, 300], [20, 400], [40, 100]]));
  t.check(young.young && young.cols.map((c) => c.key).join() === 'd0,d7,d14,d30,d60',
    'a book with almost nothing past 60 days is drawn in weeks, with one column for anything older');
  t.check(young.cols.map((c) => c.amount).join() === '500,300,400,100,0',
    'and each charge lands in the week its own age says');
  t.check(!young.cols.some((c) => c.key === 'unknown'),
    'no "no date" column when nothing is undated — an empty column says nothing about this book');
  const old = scope.debAgeScale(dxOf([[10, 500], [75, 200], [120, 300]], 50));
  t.check(!old.young && old.cols.map((c) => c.key).join() === 'b30,b60,b90,b90p,unknown',
    'a book with real old money keeps the classic 30 / 60 / 90, and its no-date column');
  const wk = scope.debAgeFilterDef('d7'), cl = scope.debAgeFilterDef('b60');
  t.check(wk && wk.test({ ageDays: 9 }) && !wk.test({ ageDays: 14 }) && cl && cl.test({ band: 'b60' }),
    'tapping a column lists the customers whose oldest money is in it, on either scale');
}

/* ---------- 8. the bar is honest and reachable ----------------------- */
{
  const pos = (/function renderDebtorsPosition[\s\S]*?\n\}\n/.exec(code) || [''])[0];
  t.check(/flex-grow:\$\{b\.amount\}/.test(pos),
    'segment widths come from the money in each band, not from how many rows it fills');
  /* WAS live = p.bands -- the bands of debAgingProfile, which put a
     customer's WHOLE balance in the band of their oldest charge. The bar
     is now drawn from the money's own age, charge by charge off the same
     ledger walk (debDx().bands), so a customer with one old invoice and
     one new one is split across two bands rather than painted old all
     through. The rule pinned is unchanged: an empty band is left off.
     THEN dx.bands, NOW debAgeScale(dx).cols: the same charge-by-charge
     ages, on a scale that follows the book -- weeks for a shop whose money
     rarely passes two months, the classic 30/60/90 otherwise. */
  t.check(/live = mb\.filter\(b=> b\.amount > 0\)/.test(pos) && /const mb = sc\.cols;/.test(pos) && /const sc = debAgeScale\(dx\);/.test(pos),
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
  /* The toolbar is RENDERED with the list now rather than standing in
     the markup, so the two things that leave the screen are named
     functions the rendered buttons call, not listeners bound to
     elements at parse time -- which would have thrown on load, since
     #deb_export_btn no longer exists when the script runs. The
     behaviour they are held to is unchanged. */
  const exp = (/function debExportCSV\(\)\{[\s\S]*?\n\}/.exec(code) || [''])[0];
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
  const prt = (/function debPrintList\(\)\{[\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(/const p = debAgingProfile\(\);/.test(prt),
    'the print carries the aging profile, not just the rows');
  t.check(/<h2>What you are owed, by age — whole book<\/h2>/.test(prt),
    'and says on its face that the profile is the whole book');
  /* Which is the whole shape of what the printed sheet promises: the
     PROFILE is always the book, the LIST is what is on screen, and the
     sheet says which. A printed page that under-reports what is owed,
     or that cannot say what it is a list of, is worse than none. */
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

/* ---------- 11. how far through their debt they are ------------------ *
 * A bar next to a balance needs a denominator, and trade debt REVOLVES.
 * "Paid divided by everything ever charged" would put a customer who has
 * bought from the shop for years and settled every bill but the last at
 * ninety-odd per cent for ever -- looking nearly clear while their
 * balance climbed. The denominator is the charges STILL OPEN.
 */
{
  const prog = (name) => scope.customerDebtProgress(data.customers.find((c) => c.name === name));
  const pct = (name) => Math.round(prog(name).pct * 100);

  data.customers = [
    customer('Never Paid', [[40, 1000000]]),
    customer('Part Payer', [[40, 5000000]], [[10, 2000000]]),
    // Settled 9,000,000 over years, then took 1,000,000 they have not
    // touched. Naively that is 90% paid. They have paid NOTHING towards
    // what they owe now.
    customer('Long Trader', [[400, 9000000], [5, 1000000]], [[380, 9000000]]),
    // Part-paid, then took on more: the bar must go DOWN, because that
    // is what happened.
    customer('Piling Up', [[60, 5000000], [3, 5000000]], [[30, 2000000]]),
  ];

  eq(pct('Never Paid'), 0, 'somebody who has paid nothing is at nothing');
  eq(pct('Part Payer'), 40, 'two million against an open five million is 40%');
  eq(prog('Part Payer').owed, 3000000, 'with the rest still owing');

  eq(pct('Long Trader'), 0,
    'years of settled trade count for nothing against a fresh unpaid charge');
  const naive = (() => {
    const c = data.customers.find((x) => x.name === 'Long Trader');
    const ch = c.debtLog.filter((l) => l.type === 'charge').reduce((s, l) => s + l.amount, 0);
    const pd = c.debtLog.filter((l) => l.type === 'payment').reduce((s, l) => s + l.amount, 0);
    return Math.round(pd / ch * 100);
  })();
  eq(naive, 90,
    'where paid-over-everything-ever-charged would have claimed 90% — which is the whole reason for the denominator');

  eq(pct('Piling Up'), 20, 'taking on new debt pushes the bar down rather than leaving it');
  t.check(pct('Piling Up') < 40, 'below where it stood before the new charge');

  /* Null, never 0, when there is nothing to measure. A bar at zero says
     "they have paid nothing" -- a claim about somebody's conduct that
     the records do not support. */
  data.customers = [{ id: 'CX', name: 'Typed In', location: '', debt: 800000, debtLog: [] }];
  eq(prog('Typed In').pct, null, 'a balance with no ledger behind it has no progress to show');
  eq(prog('Typed In').reason, 'no-history', 'and says which of the two reasons it is');

  /* Two reasons, and they are NOT the same thing to say. A balance with
     no history IS drift by definition -- nothing explains it -- so
     testing drift first told the customer with no history that their
     balance "does not match its own history". */
  const drifted = customer('Drifted', [[40, 5000000]], [[10, 2000000]]);
  drifted.debt += 500000;
  data.customers = [drifted];
  eq(prog('Drifted').pct, null, 'a balance its own ledger cannot explain is not measured');
  eq(prog('Drifted').reason, 'drift', 'and is told apart from having no history at all');

  // Carried onto the row the list draws from.
  data.customers = [customer('Rowed', [[40, 1000000]], [[5, 250000]])];
  eq(Math.round(scope.debAllRows()[0].progress.pct * 100), 25,
    'the row the list draws carries it, so the bar and the age come from one walk');
}

/* ---------- 12. what the cell says ----------------------------------- */
{
  /* MOVED FROM THE ROW TO THE OPEN CUSTOMER. The register's columns are
     now the money by age, twelve weeks of balance and the last payment;
     how far through their current debt a customer is reads beside the
     balance and the credit limit it is a fact about, in the rail
     (renderDebtorsRail). Every property below is the same property,
     pinned where it is drawn now -- including that it is NAMED: the bar
     says "paid off" beside its percentage rather than standing bare. */
  const render = (/function renderDebtorsRail[\s\S]*?\n\}\n/.exec(code) || [''])[0];
  t.check(/<span class="deb-prog-pct">\$\{pct\}% paid off<\/span>/.test(render),
    'the bar says what it measures');
  t.check(/deb-prog-fill" style="width:\$\{pct\}%"/.test(render),
    'drawn as a bar whose width is the share paid');
  /* A dash, not an empty bar: an empty bar reads as "has paid nothing",
     which is the one thing it must not say when the answer is unknown. */
  t.check(/p\.pct === null/.test(render) && /deb-prog-none/.test(render),
    'and a dash rather than an empty bar when there is nothing to measure');
  t.check(/does not match its own history/.test(render)
    && /No dated charges behind this balance/.test(render),
    'with the two reasons worded differently, since they are different problems');
  t.check(/paid of \$\{esc\(fmtUGX\(Math\.round\(p\.charged\)\)\)\} charged on what is still open/.test(render),
    'and the figures behind the percentage available on the cell');
}

process.exit(t.done() ? 1 : 0);
