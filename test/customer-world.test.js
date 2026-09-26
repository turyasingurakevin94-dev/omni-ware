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
], env, ['customerTraits', 'customerHealth', 'customerNextMoves']);

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

/* ---------- standing: it adds up, or it says what does not -----------
   The account's standing is the statement's own header now: one check
   that the ledger, the debt book and the invoices agree, named with the
   figures when they do not. */
{
  const panel = extractFunction(src, 'customerStatementPanelHTML', 'index.html');
  t.check(/const ok = st\.agrees && !\(offBook > 0\);/.test(panel), 'it adds up only when the ledger lands on the card AND the invoices are not ahead');
  t.check(/Invoices agree with the debt book/.test(panel) && /ow-good/.test(panel), 'and says so when it does');
  t.check(/the ledger adds to \$\{f\(st\.closing\)\}, the card carries \$\{f\(st\.recorded\)\}/.test(panel)
    && /invoices show \$\{f\(offBook\)\} more than the debt book/.test(panel), 'and names the figures when it does not');
}

/* ---------- wired into the account ------------------------------------ */
{
  const acct = extractFunction(src, 'renderCustomerAccount', 'index.html');
  t.check(/const book = customerBookRows\(\);/.test(acct), 'the account ranks against the same book the register draws');
  ['customerHeroHTML(r, book)', 'customerKpiHTML(r, book)', 'customerNextMovesHTML(r)', 'customerTimelineHTML(r)',
    'customerRailHTML(r, book)'].forEach((call) =>
    t.check(acct.includes(call), `the account draws ${call.replace(/\(.*/, '')}`));
  const moves = extractFunction(src, 'customerNextMovesHTML', 'index.html');
  t.check(!/wa\.me|waComposeUrl|fetch\(/.test(moves), 'no next move sends anything: each opens a page or a form, or rings');
}

/* ---------- the book: placed by rhythm, the rest counted -------------- */
{
  const map = compileScope([
    'const CUST_MAP_LABELS = 10;',
    extractFunction(src, 'customerMapHTML', 'index.html'),
    extractFunction(src, 'custHealthRingHTML', 'index.html'),
  ], { esc: (s) => String(s) }, ['customerMapHTML', 'custHealthRingHTML']);
  const b = (id, gap, since, spend) => ({ id, name: id, everyDays: gap, daysSinceLast: since, spend, spendPrev: 0 });
  const none = { id: 'N', name: 'N', everyDays: null, daysSinceLast: null, spend: 0, spendPrev: 0 };
  eq(map.customerMapHTML([b('A', 10, 5, 100), b('B', 10, 25, 50), none], new Map()), '',
    'two customers with a rhythm is not a picture of the book');
  const html = map.customerMapHTML([b('A', 10, 5, 100), b('B', 10, 25, 50), b('C', 20, 70, 900), none], new Map());
  eq((html.match(/<circle class="cu-mp-d/g) || []).length, 3, 'only customers with a rhythm are placed');
  t.check(/1 customer has one order or none/.test(html), 'and the one who cannot be placed is counted, not dropped');
  t.check(/data-cact="statement" data-cid="C"/.test(html), 'a dot opens that customer\'s account');
  eq(map.custHealthRingHTML(null), '', 'no reading, no ring -- not a ring at zero');
  const render = extractFunction(src, 'renderCustomers', 'index.html');
  t.check(/const health = new Map\(all\.map\(r=> \[r\.id, customerHealth\(r, all\)\]\)\);/.test(render),
    'the rows and the map read health over the same whole book the account ranks against');
  t.check(/customerRegisterRowHTML\(r, health\.get\(r\.id\)\)/.test(render), 'every row carries it');
}

/* ---------- the timeline fits the history it draws -------------------
   Seen live: a customer whose ten orders all fell in the last five
   weeks, drawn across the statement's six months -- every bubble and
   every figure on top of the next in the last sixth of the chart. */
{
  const iso = (n) => { const d = new Date(TODAY + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };
  const rows = [36, 35, 33, 31, 29, 28, 27, 25, 20, 12].map((a, i) => ({ no: 'INV-' + i, date: iso(a), total: 400000 + i * 150000,
    due: a === 12 ? 450000 : 0, ageDays: a === 12 ? 12 : null, settledOn: a === 12 ? null : iso(a - 1), days: a === 12 ? null : 1 }));
  const tl = compileScope([
    'const CUST_TL_DAY_PX = 24;',
    extractFunction(src, 'custAddDaysISO', 'index.html'),
    extractFunction(src, 'customerTimelineHTML', 'index.html'),
  ], Object.assign({}, env, { customerInvoiceStatementRows: () => rows.slice().reverse() }), ['customerTimelineHTML']);
  const r = row('A', { c: { id: 'A', debtLog: [] }, stats: stats({ everyDays: null, last: iso(12) }) });
  const html = tl.customerTimelineHTML(r);
  t.check(!/2026-03-01 &rarr;/.test(html), 'a five-week customer is not drawn across six months');
  const xs = [...html.matchAll(/<text class="cu-tl-v" x="([\d.]+)" y="([\d.]+)">([^<]+)</g)]
    .map((m) => ({ x: +m[1], y: +m[2], w: m[3].length * 6.8 + 6 }));
  const clash = xs.some((a, i) => xs.some((b, j) => j > i && a.y === b.y && Math.abs(a.x - b.x) < (a.w + b.w) / 2));
  t.check(xs.length > 0 && !clash, `no two order figures overlap (${xs.length} drawn)`);
  t.check((html.match(/<circle class="cu-tl-o/g) || []).length === rows.length, 'and every order is still drawn, labelled or not');
  /* Day by day, and it slides: one dated tick per day across the whole
     window, a width set by the days rather than squeezed to the panel,
     and arrows that step a week. */
  const ticks = (html.match(/class="cu-tl-dn/g) || []).length;
  const w = Number((/class="cu-tl-svg cu-tl-days" width="(\d+)"/.exec(html) || [])[1]);
  t.check(ticks >= 42, `every day carries its own date on the axis (${ticks})`);
  t.check(w >= ticks * 20, `the chart is as wide as its days, not squeezed into the panel (${w}px for ${ticks} days)`);
  t.check(/data-tlnav="-1"/.test(html) && /data-tlnav="1"/.test(html), 'and there are arrows to step a week back and forward');
  const acct = extractFunction(src, 'renderCustomerAccount', 'index.html');
  t.check(/tl\.scrollLeft = tl\.scrollWidth;/.test(acct) && /pointermove/.test(acct),
    'it opens on today and slides by drag as well as by touch');
}

/* ---------- the printed statement: the sheet that leaves the shop -----
   Built from the design board: who from and to, the balance due as the
   biggest figure on the page, the sum that makes it, how old it is, and
   then every line. Black ink only, and the ageing is the same reading
   Debtors and the account screen use. */
{
  const sheet = extractFunction(src, 'printStatementSheet', 'index.html');
  const cust = extractFunction(src, 'printCustomerStatement', 'index.html');
  t.check(/shopIdentity\(\)/.test(sheet), 'the sheet is headed with the shop\'s own printed identity');
  t.check(/cst-due-v/.test(sheet) && /Balance due/.test(sheet), 'the balance due is the one big figure');
  t.check(/Brought forward[\s\S]*Charged[\s\S]*Paid[\s\S]*Closing/.test(sheet), 'and the sum that makes it is written out');
  t.check(/customerOpenCharges\(c\)/.test(cust) && /aging: st\.closing > 0\.5 \? buckets : null/.test(cust),
    'the customer sheet ages what is due on the open charges, and only when something is due');
  t.check(/account: c\.id/.test(cust) && /Quote account/.test(sheet), 'and tells them which account to quote');
  t.check(!/<td class="r num">\$\{money\(/.test(sheet), 'the ledger prints bare figures, with UGX stated once in the head');
}

/* ---------- "Pre-fill a quote": their usual lines, wired to New quote --- */
{
  const orders = (list) => list.map((items, i) => ({ q: { items }, date: '2026-0' + (i + 1) + '-01', total: 1 }));
  const it = (productId, qty, sellPrice) => ({ productId, productName: productId, qty, sellPrice });
  let hist = [];
  const u = compileScope([extractFunction(src, 'customerUsualLines', 'index.html')],
    { customerOrderHistory: () => hist, quoteItemSellPrice: () => 0 }, ['customerUsualLines']);
  hist = orders([[it('CEM', 80, 40000), it('NAIL', 5, 7000)], [it('CEM', 60, 41000)], [it('CEM', 20, 41500), it('WIRE', 1, 9)], [it('CEM', 50, 42000)]]);
  const lines = u.customerUsualLines('C');
  eq(lines.map((l) => l.productId), ['CEM'], 'only what is on at least half their orders is a usual line');
  eq(lines[0].qty, 60, 'at the middle quantity they take');
  eq(lines[0].sellPrice, 42000, 'and at the price they last paid');
  hist = orders([[it('A', 3, 100), it('B', 2, 50)]]);
  eq(u.customerUsualLines('C').map((l) => l.productId), ['A', 'B'], 'one order: its lines, a repeat of it');
  hist = [];
  eq(u.customerUsualLines('C'), [], 'no invoiced order, no lines -- nothing is guessed');

  const start = extractFunction(src, 'startQuoteForCustomer', 'index.html');
  t.check(/confirm\(/.test(start) && /cur\.items\.length && !sameClient/.test(start),
    'a quote open for somebody else is never replaced without asking');
  t.check(/goToTab\('quote'\)/.test(start) && !/saveQuote|buildQuoteRecord|savedQuotes\.push/.test(start),
    'it opens New quote as a draft -- it saves no order and sends nothing');
  t.check(/if\(name === 'quote'\) return startQuoteForCustomer\(id\);/.test(src), 'and the account\'s buttons reach it');
  t.check(/cact: 'quote', label: 'Pre-fill a quote'/.test(extractFunction(src, 'customerNextMoves', 'index.html')),
    'the reorder card offers it when they have usual lines');
}

/* ---------- an invoice on the statement opens that invoice ----------
   Every invoice named in the statement -- a ledger line, an open bill --
   opens that invoice in a drawer beside the table; the drawer's own
   "Open in Invoices" goes to the Invoices screen through the reveal
   every other screen uses, and its Print is the invoice's own A5. */
{
  const panel = extractFunction(src, 'customerStatementPanelHTML', 'index.html');
  t.check(/data-cstinv="\$\{esc\(String\(qid\)\)\}"/.test(panel) && /invLink\(l\.qid, l\.detail\)/.test(panel) && /invLink\(x\.q\.id, x\.no\)/.test(panel),
    'each invoice in the ledger and among the open bills is a link');
  t.check(/quoteId: e\.quoteId != null \? e\.quoteId : null/.test(extractFunction(src, 'customerStatementRows', 'index.html')),
    'the ledger line carries the invoice it belongs to');
  t.check(/closest\('\[data-cstinv\]'\)/.test(src) && /custStmtInv = /.test(src), 'following one opens it beside the table');
  t.check(/data-cinv="\$\{esc\(String\(q\.id\)\)\}">Open in Invoices/.test(panel)
    && /closest\('\[data-cinv\]'\)[\s\S]{0,200}revealInvoice\(q\.id\)/.test(src),
    'and the drawer goes on to the Invoices screen the way every other screen does');
  t.check(/data-cstprint/.test(panel) && /printQuotesA5\(\[q\]\)/.test(src), 'or prints that invoice on its own sheet');
}

process.exit(t.done() ? 1 : 0);
