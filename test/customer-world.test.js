#!/usr/bin/env node
'use strict';
/*
 * One customer's world: the profile band, the health reading, the next
 * moves and the account's standing, drawn at the head of the account.
 *
 * Every one of these makes a claim about a real person the owner deals
 * with, so the decisions pinned below are all versions of one law --
 * DERIVED, NEVER INVENTED:
 *
 *   health       a reading the books cannot make is left OUT, not scored
 *                as zero; under two readings there is no score at all;
 *                the overall is the plain mean of the bars beside it.
 *   traits       a rank is only claimed where it distinguishes -- third
 *                of three is not a trait.
 *   collect      a bill is only put forward for chasing once it is past
 *                the shop's OWN terms.
 *   smaller      "orders are getting smaller" needs five orders and a
 *                real fall (a third), read off the orders themselves.
 *   standing     the account says it adds up only when the ledger, the
 *                debt book and the invoices all agree -- and says which
 *                figure disagrees when they do not.
 *   wiring       the account draws all of it, ranks against the same
 *                book the register uses, and keeps the balance chart.
 *
 * Run: node test/customer-world.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('customer world');
const src = read('index.html');
const eq = (got, want, msg) => t.check(JSON.stringify(got) === JSON.stringify(want),
  `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);

const TODAY = '2026-09-26';
const days = (a, b) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 864e5);
const state = { terms: 30, invRows: [], orders: [], st: null, open: [] };
const env = {
  data: { customers: [], savedQuotes: [] },
  CUST_DROP_PCT: 33,
  CUST_FIRST_SILENCE_DAYS: 21,
  todayISO: () => TODAY,
  daysBetweenISO: days,
  daysSinceDate: (d) => days(d, TODAY),
  fmtShortDate: (d) => String(d),
  esc: (s) => String(s),
  custTermsDays: () => state.terms,
  contactPhones: (c) => (c && c.phone ? [c.phone] : []),
  customerStatementRange: () => ({ from: '2026-03-01', to: TODAY }),
  customerInvoiceStatementRows: () => state.invRows,
  customerOrdersFor: () => state.orders,
  savedQuoteTotal: (q) => q.total,
  customerStatementRows: () => state.st,
  customerOpenCharges: () => state.open,
};
const scope = compileScope([
  extractFunction(src, 'customerPaySpeed', 'index.html'),
  extractFunction(src, 'customerOrderHistory', 'index.html'),
  extractFunction(src, 'custAddDaysISO', 'index.html'),
  extractFunction(src, 'customerTraits', 'index.html'),
  extractFunction(src, 'customerHealth', 'index.html'),
  extractFunction(src, 'customerNextMoves', 'index.html'),
  extractFunction(src, 'customerStandingHTML', 'index.html'),
], env, ['customerTraits', 'customerHealth', 'customerNextMoves', 'customerStandingHTML']);

const stats = (o) => Object.assign({ sales: 0, orderCount: 0, everyDays: null, daysSinceLast: null, first: null, last: null,
  average: 0, topProducts: [], outstanding: 0, debt: 0 }, o);
const row = (id, o) => Object.assign({ id, name: id, c: { id, phone: '0772 000 000', debtLog: [] }, debt: 0, ageDays: -1,
  spend: 0, spendPrev: 0, dropPct: null, quiet: false, both: null, stats: stats({}) }, o);

/* ---------- health: what cannot be read is not scored ----------------- */
{
  const lone = row('A', { stats: stats({ sales: 100, orderCount: 1, daysSinceLast: 5, first: '2026-09-21' }), spend: 100 });
  const book = [lone];
  /* One order: no rhythm; a book of one: no rank; nothing owed: Paying;
     90-day spend with nothing before: Momentum. Two readings -> a score. */
  const h = scope.customerHealth(lone, book);
  t.check(h && h.factors.every((x) => x.label !== 'Rhythm' && x.label !== 'Value'),
    'a customer with one order gets no rhythm reading, and a book of one gets no rank');
  eq(h && h.factors.map((x) => x.label), ['Paying', 'Momentum'], 'only the readings the books can make are listed');
  eq(h && h.score, Math.round(h.factors.reduce((n, x) => n + x.score, 0) / h.factors.length),
    'the overall is the plain mean of the bars beside it');

  const bare = row('B', { stats: stats({}) });
  t.check(scope.customerHealth(bare, [bare]) === null, 'no invoiced order and nothing owed: no score at all, not a zero');

  state.terms = 30;
  const late = row('C', { debt: 500, ageDays: 95, stats: stats({ sales: 900, orderCount: 3, everyDays: 30, daysSinceLast: 10 }), spend: 300, spendPrev: 600 });
  const hl = scope.customerHealth(late, [late, row('D', { stats: stats({ sales: 50 }) })]);
  const paying = hl.factors.find((x) => x.label === 'Paying');
  t.check(paying && paying.score <= 10 && paying.tone === 'ow-bad', 'money 65 days past the terms reads as bad paying');
  t.check(/95 days/.test(paying.basis) && /30 days/.test(paying.basis), 'and the reading says how it was worked out');
  const mom = hl.factors.find((x) => x.label === 'Momentum');
  eq(mom && mom.word, 'down 50%', 'momentum is these 90 days against the 90 before');
}

/* ---------- traits: a rank only where it distinguishes ---------------- */
{
  const mk = (id, sales) => row(id, { stats: stats({ sales, orderCount: 1 }) });
  const book = [mk('A', 900), mk('B', 500), mk('C', 100)];
  const labels = (r) => scope.customerTraits(r, book).map((x) => x.label);
  t.check(labels(book[0]).includes('#1 by value'), 'first of three is a trait');
  t.check(!labels(book[2]).some((l) => /by value/.test(l)), 'third of three is not');
  t.check(labels(book[0]).includes('Pays on the day'), 'nothing ever charged to the debt book reads as paying on the day');
  const credit = row('E', { c: { id: 'E', debtLog: [{ type: 'charge', amount: 1 }] }, stats: stats({ orderCount: 1, sales: 1 }) });
  t.check(scope.customerTraits(credit, book).some((x) => x.label === 'Buys on credit'), 'a charge on the debt book reads as buying on credit');
}

/* ---------- next moves: the shop's own terms, and a real fall -------- */
{
  state.terms = 30;
  state.orders = [];
  state.invRows = [{ no: 'INV-0009', due: 800, ageDays: 20, days: null }];
  const r = row('A', { debt: 800, ageDays: 20, stats: stats({ orderCount: 1, sales: 800 }) });
  t.check(!scope.customerNextMoves(r).some((m) => m.kind === 'Collect'), 'a bill inside the terms is not put forward for chasing');
  state.invRows = [{ no: 'INV-0009', due: 800, ageDays: 45, days: null }];
  const col = scope.customerNextMoves(r).find((m) => m.kind === 'Collect');
  t.check(col && /INV-0009 is 45 days old/.test(col.title), 'past them, the oldest open bill is named with its age');
  eq(col && col.act.cact, 'chase', 'and the move is the chase page, not a message sent from here');
  const nophone = row('A', { c: { id: 'A', debtLog: [] }, debt: 800, ageDays: 45, stats: stats({ orderCount: 1 }) });
  eq(scope.customerNextMoves(nophone).find((m) => m.kind === 'Collect').act.cact, 'edit',
    'with no number on file, the move is to add one');

  state.invRows = [];
  const q = (date, total) => ({ q: {}, invoiced: true, invoicedAt: date, total });
  state.orders = [q('2026-03-10', 5000), q('2026-04-10', 5000), q('2026-05-10', 5000), q('2026-06-10', 1000), q('2026-07-10', 1000), q('2026-08-10', 1000)];
  const shrink = scope.customerNextMoves(row('A', { stats: stats({ orderCount: 6 }) })).find((m) => m.kind === 'Understand');
  t.check(shrink && /smaller/.test(shrink.title) && shrink.fig === '−80%', 'orders a fifth their earlier size are called out, with the fall');
  state.orders = [q('2026-05-10', 5000), q('2026-06-10', 5000), q('2026-07-10', 1000), q('2026-08-10', 1000)];
  t.check(!scope.customerNextMoves(row('A', { stats: stats({ orderCount: 4 }) })).some((m) => m.kind === 'Understand'),
    'four orders is not enough history to say baskets are shrinking');
  state.orders = [];
}

/* ---------- standing: it adds up, or it says what does not ----------- */
{
  state.terms = 30;
  state.open = [{ date: '2026-09-10', remaining: 400 }, { date: '2026-06-01', remaining: 600 }];
  state.st = { opening: 0, charged: 3000, paid: 2000, closing: 1000, recorded: 1000, agrees: true };
  const r = row('A', { c: { id: 'A', debtLog: [{ type: 'charge' }] }, debt: 1000, stats: stats({ outstanding: 1000, debt: 1000 }) });
  const ok = scope.customerStandingHTML(r);
  t.check(/Adds up/.test(ok) && /ow-good/.test(ok), 'when the ledger, the debt book and the invoices agree, it says so');
  t.check(/0–30 days <b class="ow-fig">400<\/b>/.test(ok) && /Over 90 <b class="ow-fig">600<\/b>/.test(ok),
    'what is due is aged on the open charges, the reading Debtors uses');
  state.st = Object.assign({}, state.st, { recorded: 1200, agrees: false });
  t.check(/Out of step/.test(scope.customerStandingHTML(r)) && /1,200/.test(scope.customerStandingHTML(r)),
    'a ledger that no longer lands on the card is named with both figures');
  state.st = Object.assign({}, state.st, { recorded: 1000, agrees: true });
  const ahead = row('A', { c: r.c, debt: 1000, stats: stats({ outstanding: 1500, debt: 1000 }) });
  t.check(/invoices show 500 more/.test(scope.customerStandingHTML(ahead)), 'invoices ahead of the debt book are named with the gap');
  const none = row('Z', { c: { id: 'Z', debtLog: [] }, debt: 0 });
  eq(scope.customerStandingHTML(none), '', 'a customer with no ledger and nothing owed has no standing to draw');
}

/* ---------- wired into the account ------------------------------------ */
{
  const acct = extractFunction(src, 'renderCustomerAccount', 'index.html');
  t.check(/const book = customerBookRows\(\);/.test(acct), 'the account ranks against the same book the register draws');
  ['customerProfileHTML(r, book)', 'customerNextMovesHTML(r)', 'customerTimelineHTML(r)', 'customerStandingHTML(r)',
    'customerBalanceChartHTML(r.id)', 'customerStatsHTML(s)'].forEach((call) =>
    t.check(acct.includes('${' + call + '}'), `the account draws ${call.replace(/\(.*/, '')}`));
  const moves = extractFunction(src, 'customerNextMovesHTML', 'index.html');
  t.check(!/wa\.me|waComposeUrl|fetch\(/.test(moves), 'no next move sends anything: each opens a page or a form, or rings');
}

/* ---------- the book: placed by rhythm, the rest counted -------------- */
{
  const map = compileScope([
    'const CUST_MAP_LABELS = 10;',
    extractFunction(src, 'customerMapHTML', 'index.html'),
    extractFunction(src, 'custHealthRingHTML', 'index.html'),
    extractFunction(src, 'custWeeksHTML', 'index.html'),
  ], { esc: (s) => String(s) }, ['customerMapHTML', 'custHealthRingHTML', 'custWeeksHTML']);
  const b = (id, gap, since, spend) => ({ id, name: id, everyDays: gap, daysSinceLast: since, spend, spendPrev: 0 });
  const none = { id: 'N', name: 'N', everyDays: null, daysSinceLast: null, spend: 0, spendPrev: 0 };
  eq(map.customerMapHTML([b('A', 10, 5, 100), b('B', 10, 25, 50), none], new Map()), '',
    'two customers with a rhythm is not a picture of the book');
  const html = map.customerMapHTML([b('A', 10, 5, 100), b('B', 10, 25, 50), b('C', 20, 70, 900), none], new Map());
  eq((html.match(/<circle class="cu-mp-d/g) || []).length, 3, 'only customers with a rhythm are placed');
  t.check(/1 customer has one order or none/.test(html), 'and the one who cannot be placed is counted, not dropped');
  t.check(/data-cact="statement" data-cid="C"/.test(html), 'a dot opens that customer\'s account');
  eq(map.custHealthRingHTML(null), '', 'no reading, no ring -- not a ring at zero');
  eq(map.custWeeksHTML({ everInvoiced: true, spend: 0, weeks: [0] }), '', 'no spend in the window, no weekly bars');
  const render = extractFunction(src, 'renderCustomers', 'index.html');
  t.check(/const health = new Map\(all\.map\(r=> \[r\.id, customerHealth\(r, all\)\]\)\);/.test(render),
    'the rows and the map read health over the same whole book the account ranks against');
  t.check(/customerRegisterRowHTML\(r, health\.get\(r\.id\)\)/.test(render), 'every row carries it');
}

process.exit(t.done() ? 1 : 0);
