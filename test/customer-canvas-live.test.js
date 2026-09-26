#!/usr/bin/env node
'use strict';
/*
 * The customer screens against the design board, as the LIVE books
 * actually are.
 *
 * Logged into the live shop, the account came out emptier than the board
 * in exactly the places that read an invoice off a debt-book line: no
 * "pays an invoice in", no payment method, no invoice links in the
 * ledger, no line from an order to its payment on the timeline. Every
 * one of the live shop's 247 debt-book payments names its invoice only
 * in its note ("Auto-sync — INV-0186"); none carries quoteId. And every
 * one of its 151 settled invoices keeps its own dated payments, each
 * with the way it was paid. So the board's figures were in the books all
 * along; the reading missed them.
 *
 * The decisions pinned below:
 *
 *   the note        a line with no quoteId belongs to the invoice its
 *                   note names -- one of THIS customer's, never another's.
 *   the invoice     how long a bill took to settle is read off the
 *                   invoice's own dated payments when it has them, the
 *                   debt book's lines for it otherwise. One or the other:
 *                   they are the same money.
 *   the method      a payment says how it came in from the invoice's own
 *                   payment of that day and sum; failing that, from the
 *                   one way every payment on that invoice went.
 *   the pager       the board's: arrows, the numbers, what is showing.
 *   the phone       its own account, the board's phone board, not the
 *                   desk stacked into a column.
 *   sent            "Statement sent on WhatsApp" is a row written when
 *                   the owner presses Send, and only once 0099 is in.
 *
 * Run: node test/customer-canvas-live.test.js   (or: npm test)
 */
const fs = require('fs');
const path = require('path');
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('customer canvas, live books');
const src = read('index.html');
const eq = (got, want, msg) => t.check(JSON.stringify(got) === JSON.stringify(want),
  `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);

const TODAY = '2026-09-26';
const data = { customers: [], savedQuotes: [], cashTxns: [] };
const env = {
  data,
  todayISO: () => TODAY,
  daysBetweenISO: (a, b) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 864e5),
  savedQuoteTotal: (q) => q.total,
  invoiceBalanceDue: (q) => Math.max(0, q.total - (q.amountPaid || 0)),
  customerOrdersFor: (id) => data.savedQuotes.filter((q) => q.customerId === id),
  accountLabel: (k) => ({ cash: 'Cash', momo: 'Mobile Money', bank: 'Bank' })[k] || k,
};
const sc = compileScope([
  extractFunction(src, 'invoiceNumberLabel', 'index.html'),
  extractFunction(src, 'customerLogQuoteResolver', 'index.html'),
  extractFunction(src, 'customerStatementRows', 'index.html'),
  extractFunction(src, 'customerInvoiceStatementRows', 'index.html'),
  extractFunction(src, 'custPaymentMethod', 'index.html'),
], env, ['customerStatementRows', 'customerInvoiceStatementRows', 'custPaymentMethod', 'customerLogQuoteResolver']);

/* ---------- 1. the live shape: invoices named only in notes ---------- */
{
  data.savedQuotes.push(
    { id: 186, customerId: 'C1', invoiced: true, invoicedAt: '2026-08-10', total: 500, amountPaid: 500,
      payments: [{ date: '2026-08-10', amount: 200, method: 'cash' }, { date: '2026-08-22', amount: 300, method: 'cash' }] },
    { id: 190, customerId: 'C1', invoiced: true, invoicedAt: '2026-09-01', total: 400, amountPaid: 0, payments: [] },
    { id: 191, customerId: 'C2', invoiced: true, invoicedAt: '2026-09-01', total: 999, amountPaid: 0, payments: [] });
  data.customers.push({ id: 'C1', debt: 400, debtLog: [
    { id: 1, date: '2026-08-10', type: 'charge', amount: 500, note: 'Auto-sync — INV-0186' },
    { id: 2, date: '2026-08-10', type: 'payment', amount: 200, note: 'Auto-sync — INV-0186' },
    { id: 3, date: '2026-08-22', type: 'payment', amount: 300, note: 'Auto-sync — INV-0186' },
    { id: 4, date: '2026-09-01', type: 'charge', amount: 400, note: 'Auto-sync — INV-0190' },
    { id: 5, date: '2026-09-02', type: 'charge', amount: 50, note: 'Auto-sync — INV-0191' },
    { id: 6, date: '2026-09-03', type: 'payment', amount: 10, note: 'Cash at the counter' },
  ] });
  const st = sc.customerStatementRows('C1', '2026-08-01', TODAY);
  eq(st.rows.map((r) => r.quoteId), [186, 186, 186, 190, null, null],
    'a line names its invoice through its note, and only one of this customer\'s own (INV-0191 is somebody else\'s)');
  const inv = sc.customerInvoiceStatementRows('C1', '2026-08-01', TODAY);
  const paid = inv.find((r) => r.q.id === 186);
  eq([paid.settledOn, paid.days], ['2026-08-22', 12], 'the settle day is read off the invoice\'s own dated payments');
  eq(sc.custPaymentMethod(st.rows[2]), 'Cash', 'and a payment says how it came in, from the invoice\'s payment of that day');
}

/* ---------- 2. without the invoice's payments, the debt book --------- */
{
  data.savedQuotes.push({ id: 200, customerId: 'C3', invoiced: true, invoicedAt: '2026-07-01', total: 100, amountPaid: 100 });
  data.customers.push({ id: 'C3', debt: 0, debtLog: [
    { id: 1, date: '2026-07-01', type: 'charge', amount: 100, note: 'Auto-sync — INV-0200' },
    { id: 2, date: '2026-07-20', type: 'payment', amount: 100, note: 'Auto-sync — INV-0200' },
  ] });
  const r = sc.customerInvoiceStatementRows('C3', '2026-06-01', TODAY)[0];
  eq(r.days, 19, 'a bill whose invoice keeps no payments is settled by the debt-book lines its notes tie to it');
}

/* ---------- 3. the pager is the board's ------------------------------ */
{
  const pg = compileScope([extractFunction(src, 'custPagerHTML', 'index.html'), extractFunction(src, 'invPageWindow', 'index.html')],
    {}, ['custPagerHTML']).custPagerHTML;
  const html = pg((n) => `data-cstpg="${n}"`, 2, 3, 14, 7, 12, 'lines');
  t.check(/aria-label="Previous page">&lsaquo;/.test(html) && /aria-label="Next page">&rsaquo;/.test(html), 'an arrow either side');
  eq((html.match(/cu-pg-on/g) || []).length, 1, 'the page you are on is marked, once');
  t.check(/Showing <b class="ow-fig">7&ndash;12<\/b> of <b class="ow-fig">14<\/b> lines/.test(html), 'and it says which lines are showing');
  t.check(!/<nav/.test(html), 'not a <nav>, which this app styles as the rail');
  eq(pg((n) => '', 1, 1, 3, 1, 3, 'lines'), '', 'one page needs no pager');
}

/* ---------- 4. the phone has its own account ------------------------- */
{
  const acct = extractFunction(src, 'renderCustomerAccount', 'index.html');
  t.check(/customerPhoneHTML\(r, book, /.test(acct) && /<div class="cu-dk">/.test(acct),
    'the account draws the phone\'s own design beside the desk\'s');
  t.check(/\.cu-ph\{display:none;\}/.test(src) && /#custAccountWrap \.cu-dk\{display:none;\}/.test(src),
    'and 820px switches between them rather than reflowing one');
  const ph = extractFunction(src, 'customerPhoneHTML', 'index.html');
  ['Record a payment', 'Owed now', 'Pays in', 'Over time', 'Statement', 'Send PDF', 'What they buy', 'Next order', 'Notes']
    .forEach((w) => t.check(ph.includes(w), `the phone board's "${w}" is there`));
  t.check(/data-cphall/.test(ph) && /lines\.slice\(0, 7\)/.test(ph), 'the phone statement shows the latest seven and offers the rest');
}

/* ---------- 5. a statement sent is remembered ------------------------ */
{
  const mig = path.join(__dirname, '..', 'supabase', 'migrations', '0099_statements_sent.sql');
  t.check(fs.existsSync(mig) && /create table if not exists statements_sent/.test(fs.readFileSync(mig, 'utf8')),
    'the table has its migration');
  const rec = extractFunction(src, 'recordStatementSent', 'index.html');
  t.check(/if\(!statementsSentTable\) return \{ ok: false/.test(rec), 'nothing is written until the table exists');
  const send = extractFunction(src, 'sendCustomerStatementPdf', 'index.html');
  t.check(/how === 'shared' \|\| how === 'saved'/.test(send) && /recordStatementSent\(customerId, sheet\.st\)/.test(send),
    'written when the owner sent it, never when they backed out');
  const last = compileScope([extractFunction(src, 'lastStatementSent', 'index.html')],
    { data: { statementsSent: [{ id: 1, customerId: 'C1', sentOn: '2026-09-01', due: 5 }, { id: 2, customerId: 'C1', sentOn: '2026-09-14', due: 7 }, { id: 3, customerId: 'C2', sentOn: '2026-09-20', due: 9 }] } },
    ['lastStatementSent']).lastStatementSent;
  eq(last('C1').due, 7, 'the notes read the latest one for that customer');
  t.check(/Statement sent on WhatsApp/.test(extractFunction(src, 'customerRailHTML', 'index.html')), 'and the account\'s notes say so');
}

process.exit(t.done() ? 1 : 0);
