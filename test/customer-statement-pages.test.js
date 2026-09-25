#!/usr/bin/env node
'use strict';
/*
 * The statement on a customer's account, read by invoice and a page at
 * a time.
 *
 * The ledger is still the document -- it is what gets printed and handed
 * across the counter -- but on screen it was one long column of lines,
 * every invoice and its payment on separate rows and the balance jumping
 * up and down between them. The question asked at the counter is which
 * bill is still open and how quickly this customer pays, and the ledger
 * answered it only to somebody who added up pairs of lines in their head.
 *
 * The decisions pinned below:
 *
 *   by invoice       each bill once, with what it came to, what was paid
 *                    and what is still due. WHEN it was settled is read
 *                    off the debt log's payments that name the invoice;
 *                    a settled bill with no linked payment says paid and
 *                    gives no day, rather than inventing one.
 *   the old bill     an invoice from before the period that is still owed
 *                    is listed. Dropping it for being old would hide the
 *                    only line that matters.
 *   pay speed        the middle of the last six settled bills, not the
 *                    average, and nothing at all from fewer than two.
 *   ledger pages     each page opens on the balance the lines before it
 *                    left, and an unturned ledger opens on its LAST page,
 *                    the one ending on the balance now due.
 *   one customer     the reading and the page belong to whoever is open;
 *                    opening somebody else starts again.
 *
 * Run: node test/customer-statement-pages.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('customer statement pages');
const src = read('index.html');
const eq = (got, want, msg) => t.check(JSON.stringify(got) === JSON.stringify(want),
  `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);

const data = { customers: [], savedQuotes: [] };
const TODAY = '2026-09-25';
const captured = {};
const env = {
  data,
  CUST_STMT_PAGE: { invoice: 10, ledger: 12 },
  custStmtView: 'invoice',
  custStmtPage: { invoice: 1, ledger: null },
  todayISO: () => TODAY,
  daysBetweenISO: (a, b) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 864e5),
  savedQuoteTotal: (q) => q.total,
  invoiceBalanceDue: (q) => Math.max(0, q.total - (q.amountPaid || 0)),
  invoiceNumberLabel: (q) => 'INV-' + String(q.id).padStart(4, '0'),
  customerOrdersFor: (id) => data.savedQuotes.filter((q) => q.customerId === id),
  customerStatementRange: () => ({ from: '2026-03-01', to: TODAY }),
  esc: (s) => String(s),
  statementLedgerHTML: (st, side, extra) => { captured.ledger = { st, side, extra }; return 'LEDGER'; },
  reportPagerHTML: (attr, page, pages, total, from, shown, noun) => {
    captured.pager = { attr, page, pages, total, from, shown, noun };
    return 'PAGER';
  },
  customerInvoiceStatementHTML: (id, st, tools) => { captured.invoice = { id, st, tools }; return 'BY-INVOICE'; },
};
const scope = compileScope([
  extractFunction(src, 'customerStatementRows', 'index.html'),
  extractFunction(src, 'customerInvoiceStatementRows', 'index.html'),
  extractFunction(src, 'customerPaySpeed', 'index.html'),
  extractFunction(src, 'customerStatementBlockHTML', 'index.html'),
  'function __set(view, page){ custStmtView = view; custStmtPage = page; }',
], env, ['customerStatementRows', 'customerInvoiceStatementRows', 'customerPaySpeed',
  'customerStatementBlockHTML', '__set']);

const inv = (id, date, total, amountPaid) => ({ id, customerId: 'C1', invoiced: true, invoicedAt: date, total, amountPaid });
const pay = (id, date, amount, quoteId, note) => ({ id, date, type: 'payment', amount, quoteId, note: note || '' });
const charge = (id, date, amount, quoteId) => ({ id, date, type: 'charge', amount, quoteId });

/* ---------- 1. each bill once, and what became of it ------------------ */
{
  data.savedQuotes = [
    inv(1, '2026-01-20', 300000, 100000),   // before the period, still owed
    inv(2, '2026-07-01', 500000, 500000),   // paid in two parts
    inv(3, '2026-08-01', 200000, 200000),   // paid, but no linked payment on the log
    inv(4, '2026-09-10', 400000, 150000),   // part-paid, open
    { ...inv(5, '2026-09-12', 90000, 0), voided: true },
    inv(6, '2026-02-01', 50000, 50000),     // before the period and settled
  ];
  data.customers = [{ id: 'C1', name: 'Kato', debt: 450000, debtLog: [
    charge(1, '2026-01-20', 300000, 1), pay(2, '2026-02-02', 100000, 1),
    charge(3, '2026-07-01', 500000, 2), pay(4, '2026-07-03', 200000, 2), pay(5, '2026-07-10', 300000, 2),
    charge(6, '2026-08-01', 200000, 3), pay(7, '2026-08-05', 200000, null, 'Cash'),
    charge(8, '2026-09-10', 400000, 4), pay(9, '2026-09-14', 150000, 4),
  ] }];
  const rows = scope.customerInvoiceStatementRows('C1', '2026-03-01', TODAY);
  eq(rows.map((r) => r.no), ['INV-0004', 'INV-0003', 'INV-0002', 'INV-0001'],
    'newest first; the voided bill and the settled one from before the period are gone, the old OPEN one stays');
  const by = Object.fromEntries(rows.map((r) => [r.no, r]));
  eq([by['INV-0002'].settledOn, by['INV-0002'].days], ['2026-07-10', 9],
    'settled on the day the linked payments first covered the bill, not on the first payment');
  eq([by['INV-0003'].due, by['INV-0003'].settledOn, by['INV-0003'].days], [0, null, null],
    'a settled bill with no linked payment is paid with no day given -- never an invented one');
  eq([by['INV-0004'].due, by['INV-0004'].paid, by['INV-0004'].lastPaidOn, by['INV-0004'].ageDays],
    [250000, 150000, '2026-09-14', 15], 'an open bill carries what is due, what was paid, when last, and its age');
  eq(by['INV-0001'].due, 200000, 'the old bill is there with what it still owes');
}

/* ---------- 2. how quickly they pay ----------------------------------- */
{
  const r = (days) => ({ days });
  eq(scope.customerPaySpeed([r(2), r(2), r(30), r(2), r(2), r(9)]), { days: 2, of: 6 },
    'the middle of the last six, so one late bill does not make the customer late');
  eq(scope.customerPaySpeed([r(2), r(40), r(2)]), { days: 2, of: 3 }, 'odd counts take the middle one');
  eq(scope.customerPaySpeed([r(2), r(null), r(3), r(2), r(2), r(2), r(2), r(90)]).of, 6,
    'only the six most recent settled bills count, and open ones are not bills paid');
  eq(scope.customerPaySpeed([r(4)]), null, 'one settled bill is not a habit, so nothing is claimed');
}

/* ---------- 3. the ledger, a page at a time --------------------------- */
{
  const log = [charge(1, '2026-02-10', 100000)];
  for(let i = 0; i < 30; i++) log.push(charge(100 + i, `2026-04-${String(i + 1).padStart(2, '0')}`, 10000));
  data.customers = [{ id: 'C1', name: 'Kato', debt: 400000, debtLog: log }];

  scope.__set('ledger', { invoice: 1, ledger: null });
  t.check(scope.customerStatementBlockHTML('C1') === 'LEDGER', 'the ledger reading draws the ledger');
  const full = scope.customerStatementRows('C1', '2026-03-01', TODAY);
  eq([captured.pager.page, captured.pager.pages, captured.pager.total], [3, 3, 30],
    'an unturned ledger opens on its last page -- the one ending on the balance now due');
  eq(captured.ledger.st.rows.length, 6, 'and shows only that page');
  eq(captured.ledger.st.opening, full.rows[23].balance,
    'the page opens on the balance the lines before it left, not on the period opening');
  eq(captured.ledger.st.from, full.rows[24].date, 'dated at its own first line');
  eq([captured.ledger.st.closing, captured.ledger.st.charged], [full.closing, full.charged],
    'the closing line is the whole period on every page');
  eq(captured.ledger.side.payWord, 'Payment received', 'and it is still the customer statement, word for word');

  scope.__set('ledger', { invoice: 1, ledger: 1 });
  scope.customerStatementBlockHTML('C1');
  eq(captured.ledger.st.opening, full.opening, 'page one opens on the period opening');
  eq(captured.ledger.st.from, full.from, 'dated at the start of the period');

  scope.__set('ledger', { invoice: 1, ledger: 9 });
  scope.customerStatementBlockHTML('C1');
  eq(captured.pager.page, 3, 'a page past the end lands on the last one rather than on nothing');

  scope.__set('invoice', { invoice: 1, ledger: null });
  t.check(scope.customerStatementBlockHTML('C1') === 'BY-INVOICE', 'by invoice is its own drawing');
  t.check(/data-cstview="invoice"/.test(captured.invoice.tools) && /data-cstview="ledger"/.test(captured.invoice.tools),
    'and both readings are offered from either');
  t.check(scope.customerStatementBlockHTML(null) === '', 'no customer, nothing');
}

/* ---------- 4. wired to one customer, and to the screen --------------- */
{
  const acct = extractFunction(src, 'renderCustomerAccount', 'index.html');
  t.check(/if\(custStmtFor !== String\(c\.id\)\)\{[\s\S]*?custStmtView = 'invoice';[\s\S]*?custStmtPage = \{ invoice: 1, ledger: null \};/.test(acct),
    'opening a different customer starts again on their invoices, page one');
  t.check(/customerBalanceChartHTML\(r\.id\)/.test(acct), 'the account draws the balance chart');
  t.check(/data-cstpg/.test(src) && /custStmtPage\[custStmtView\] = /.test(src), 'a turned page is stored for the reading on screen');
  eq(extractDeclaration(src, 'CUST_STMT_PAGE', 'index.html').replace(/\s+/g, ' ').trim(),
    'const CUST_STMT_PAGE = { invoice: 10, ledger: 12 };', 'ten invoices or twelve ledger lines to a page');
  const inv2 = extractFunction(src, 'customerInvoiceStatementHTML', 'index.html');
  t.check(/reportPagerHTML\('data-cstpg'/.test(inv2), 'by invoice pages through the shared pager');
  t.check(!/cu-bar|width:\$\{/.test(inv2), 'and draws no bars: a statement is figures and words');
}

process.exit(t.done() ? 1 : 0);
