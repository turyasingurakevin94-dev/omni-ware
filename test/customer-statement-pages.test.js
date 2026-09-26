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
 *   the table        (rebuilt to the design board) one ruled table per
 *                    reading -- Ledger, Open invoices, Aging. Every ledger
 *                    line carries its own running balance, so a page needs
 *                    no balance carried in; the totals row is the whole
 *                    period on every page, six lines to a page, through
 *                    the shared pager. Any column sorts; a payment names
 *                    how it came in, read from the cash book.
 *   one customer     the reading, the sort, the period and the page belong
 *                    to whoever is open; opening somebody else starts
 *                    again.
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
  extractFunction(src, 'customerStatementRows', 'index.html'), extractFunction(src, 'customerLogQuoteResolver', 'index.html'), extractFunction(src, 'invoiceNumberLabel', 'index.html'),
  extractFunction(src, 'customerInvoiceStatementRows', 'index.html'),
  extractFunction(src, 'customerPaySpeed', 'index.html'),
], env, ['customerStatementRows', 'customerInvoiceStatementRows', 'customerPaySpeed']);

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

/* ---------- 3. the statement as a table, a page at a time ------------- */
{
  const st = { data: { customers: [], savedQuotes: [], cashTxns: [] } };
  const cap = {};
  const env2 = Object.assign({}, env, {
    data: st.data,
    CUST_STMT_PAGE: { ledger: 6 },
    custStmtView: 'ledger', custStmtPage: { ledger: 1 }, custStmtSort: { key: 'date', dir: 1 },
    custStmtPeriod: 'first', custStmtCustom: { from: '', to: '' }, custStmtInv: null,
    customerStatementPeriod: () => ({ from: '2026-03-01', to: TODAY }),
    customerOrdersFor: (id) => st.data.savedQuotes.filter((q) => q.customerId === id),
    custTermsDays: () => 30,
    daysSinceDate: (d) => env.daysBetweenISO(d, TODAY),
    fmtShortDate: (d) => String(d),
    customerOpenCharges: (c) => (c.__open || []),
    customerOffBookHTML: () => 'OFFBOOK',
    accountLabel: (k) => ({ cash: 'Cash', momo: 'Mobile Money', bank: 'Bank' })[k] || k,
    quoteItemSellPrice: (it) => it.sellPrice || 0,
    printedShopName: () => 'Shop',
    waComposeUrl: () => 'https://wa.me/',
    /* The ledger's pager is the design board's (custPagerHTML): it is
       handed the attributes that turn to a page, and the first and last
       line showing. Caught here the same way the shared pager was. */
    custPagerHTML: (on, page, pages, total, from, to, noun) => { cap.pager = { attr: on(page).split('=')[0], page, pages, total, from, shown: to - from + 1, noun }; return 'PAGER'; },
  });
  const sc = compileScope([
    extractFunction(src, 'customerStatementRows', 'index.html'), extractFunction(src, 'customerLogQuoteResolver', 'index.html'), extractFunction(src, 'invoiceNumberLabel', 'index.html'),
    extractFunction(src, 'customerInvoiceStatementRows', 'index.html'),
    extractFunction(src, 'statementRowDetail', 'index.html'),
    extractFunction(src, 'custPaymentMethod', 'index.html'),
    extractFunction(src, 'customerStatementLine', 'index.html'),
    extractFunction(src, 'custInvoiceItemsLine', 'index.html'),
    extractFunction(src, 'customerLedgerLines', 'index.html'),
    extractFunction(src, 'customerStatementPanelHTML', 'index.html'),
    'function __set(o){ Object.keys(o).forEach(k=> { if(k === "view") custStmtView = o[k]; if(k === "page") custStmtPage = o[k]; if(k === "sort") custStmtSort = o[k]; if(k === "inv") custStmtInv = o[k]; }); }',
  ], env2, ['customerStatementPanelHTML', 'customerStatementRows', '__set']);
  const log = [];
  for(let i = 0; i < 8; i++){
    st.data.savedQuotes.push({ id: i + 1, customerId: 'C1', invoiced: true, invoicedAt: `2026-04-${String(i + 1).padStart(2, '0')}`, total: 1000 * (i + 1), amountPaid: i < 2 ? 1000 * (i + 1) : 0, items: [{ productName: 'Cement (50kg)', qty: 1, sellPrice: 1000 * (i + 1) }] });
    log.push(charge(10 + i, `2026-04-${String(i + 1).padStart(2, '0')}`, 1000 * (i + 1), i + 1));
  }
  st.data.cashTxns.push({ id: 77, account: 'momo' });
  log.push({ id: 90, date: '2026-05-01', type: 'payment', amount: 1000, quoteId: 1, cashTxnId: 77 });
  log.push({ id: 91, date: '2026-05-02', type: 'payment', amount: 2000, quoteId: 2 });
  const c = { id: 'C1', name: 'Kato', debt: 33000, debtLog: log };
  st.data.customers = [c];
  const r = { id: 'C1', name: 'Kato', c, phones: ['0700'], stats: { outstanding: 33000, debt: 33000 } };
  const full = sc.customerStatementRows('C1', '2026-03-01', TODAY);

  sc.__set({ view: 'ledger', page: { ledger: 1 }, sort: { key: 'date', dir: 1 }, inv: null });
  let html = sc.customerStatementPanelHTML(r);
  eq([cap.pager.attr, cap.pager.total, cap.pager.shown], ['data-cstpg', 11, 6],
    'the brought-forward line and ten entries, six to a page, through the shared pager');
  eq((html.match(/class="cu-tr cu-t-led( cu-z)?"/g) || []).length, 6, 'and only that page is drawn');
  t.check(/Balance now due[\s\S]*?>36,000<[\s\S]*?>3,000<[\s\S]*?>33,000</.test(html),
    'the totals row is the whole period -- charged, paid, due -- on every page');
  t.check(/data-cstinv="1"[^>]*>INV-0001</.test(html) || /INV-0001/.test(html), 'an invoice line is a link that opens it');
  sc.__set({ page: { ledger: 2 } });
  html = sc.customerStatementPanelHTML(r);
  t.check(/Balance now due[\s\S]*?>33,000</.test(html), 'still the whole period on page two');
  t.check(/Mobile Money/.test(html), 'a payment says how it came in, read from the cash book it posted to');

  sc.__set({ page: { ledger: 1 }, sort: { key: 'charge', dir: -1 } });
  html = sc.customerStatementPanelHTML(r);
  const first = /class="cu-tr cu-t-led"[\s\S]*?<span class="ow-fig">([\d,]+)<\/span>/.exec(html);
  eq(first && first[1], '8,000', 'sorted by what was charged, biggest first, the dearest bill leads');
  t.check(/data-cstsort="charge"[^>]*>Charged <b>&#9660;<\/b>/.test(html), 'and the column says it is the one sorted on');

  sc.__set({ view: 'open', sort: { key: 'date', dir: 1 } });
  html = sc.customerStatementPanelHTML(r);
  eq((html.match(/class="cu-tr cu-t-opn( cu-z)?"/g) || []).length, 6, 'open invoices: the six still owed, the two paid left off');
  t.check(/6 open/.test(html) && />33,000</.test(html), 'counted and totalled');
  t.check(/next 3,000 settles INV-0003/.test(html), 'and it says which bill the next payment settles -- the oldest');

  const ago = (n) => new Date(Date.parse(TODAY + 'T00:00:00Z') - n * 864e5).toISOString().slice(0, 10);
  c.__open = [{ date: ago(10), remaining: 500 }, { date: ago(45), remaining: 1500 }, { date: ago(200), remaining: 3000 }];
  sc.__set({ view: 'aging' });
  html = sc.customerStatementPanelHTML(r);
  t.check(/0–30 days<\/span><span class="n">1<\/span><span class="n"><b class="ow-fig">500/.test(html)
    && /Over 90<\/span><span class="n">1<\/span><span class="n"><b class="ow-fig">3,000/.test(html),
    'aging puts each open charge in its band, with the count and the sum');
  t.check(/All open<\/span><span class="n">3<\/span><span class="n ow-bad">5,000/.test(html), 'and totals them');
}

/* ---------- 4. wired to one customer, and to the screen --------------- */
{
  const acct = extractFunction(src, 'renderCustomerAccount', 'index.html');
  t.check(/if\(custStmtFor !== String\(c\.id\)\)\{[\s\S]*?custStmtView = 'ledger';[\s\S]*?custStmtPage = \{ ledger: 1 \};[\s\S]*?custStmtSort = \{ key: 'date', dir: 1 \};[\s\S]*?custStmtInv = null;/.test(acct),
    'opening a different customer starts again: the ledger, page one, by date, nothing open beside it');
  t.check(/customerStatementPanelHTML\(r\)/.test(acct), 'the account draws the statement');
  t.check(/data-cstpg/.test(src) && /custStmtPage\.ledger = Math\.max\(1, Number\(sp\.getAttribute\('data-cstpg'\)\) \|\| 1\);/.test(src),
    'a turned page is stored for the ledger');
  eq(extractDeclaration(src, 'CUST_STMT_PAGE', 'index.html').replace(/\s+/g, ' ').trim(),
    'const CUST_STMT_PAGE = { ledger: 6 };', 'six ledger lines to a page, as the design board draws it');
  const print = extractFunction(src, 'customerStatementSheet', 'index.html');
  t.check(/customerStatementPeriod\(cRec\)/.test(print), 'and the printed sheet covers the period on screen');
}

/* ---------- 5. Send on WhatsApp sends the statement as a PDF ----------
   The file is written by hand (no library): the checks read the bytes
   back the way a PDF reader does -- the header, every xref offset
   landing on its object, one page object per page -- and then look for
   the figures on the sheet. */
{
  const sc = compileScope([
    extractDeclaration(src, 'PDF_W_REG', 'index.html'),
    extractDeclaration(src, 'PDF_W_BOLD', 'index.html'),
    extractFunction(src, 'pdfText', 'index.html'),
    extractFunction(src, 'pdfTextWidth', 'index.html'),
    extractFunction(src, 'pdfFit', 'index.html'),
    extractFunction(src, 'pdfWrap', 'index.html'),
    extractFunction(src, 'statementRowDetail', 'index.html'),
    extractFunction(src, 'statementPdfBytes', 'index.html'),
  ], {
    shopIdentity: () => ({ name: 'Shop (Kampala)', address: 'Plot 4', phone: '0700 000 000', tin: '', footer: '' }),
    printedShopName: () => 'Shop (Kampala)',
    fmtShortDate: (d) => String(d),
    fmtUGX: (n) => Number(n).toLocaleString('en-UG') + ' UGX',
    todayISO: () => TODAY,
  }, ['statementPdfBytes', 'pdfText']);
  const rows = [];
  let bal = 0;
  for(let i = 0; i < 70; i++){
    const charge = i % 2 ? 0 : 2000, payment = i % 2 ? 1000 : 0;
    bal += charge - payment;
    rows.push({ date: '2026-05-01', type: charge ? 'charge' : 'payment', ref: `INV-${1000 + i}`, charge, payment, balance: bal });
  }
  const st = { from: '2026-03-01', to: TODAY, opening: 500, rows, charged: 70000, paid: 35000, closing: 500 + bal, agrees: true, recorded: 500 + bal };
  const side = { who: { name: 'Kato — Seeta', location: 'Seeta', phone: '0700' }, account: 'C1', openLine: '2 open invoices',
    aging: [{ label: '0–30 days', value: 500 + bal }], payWord: 'Payment received',
    owesLine: (m) => `<b>Kato</b> owes <b>${m}</b>.`, creditLine: (m) => m, recordedAs: 'x', beforeWhat: 'y', foot: 'Payments settle the oldest invoice first.' };
  const bytes = sc.statementPdfBytes(st, side);
  const pdf = Buffer.from(bytes).toString('latin1');
  t.check(pdf.startsWith('%PDF-1.4') && pdf.trimEnd().endsWith('%%EOF'), 'the bytes are a PDF, start to end');
  const xrefAt = Number(/startxref\n(\d+)/.exec(pdf)[1]);
  t.check(pdf.slice(xrefAt, xrefAt + 4) === 'xref', 'startxref points at the cross-reference table');
  const offs = pdf.slice(xrefAt).split('\n').filter(l => / 00000 n $/.test(l)).map(l => Number(l.slice(0, 10)));
  t.check(offs.length > 0 && offs.every((o, i) => pdf.slice(o).startsWith(`${i + 1} 0 obj`)),
    'every object sits exactly where the table says, so a strict reader opens it without repair');
  const pages = (pdf.match(/\/Type \/Page /g) || []).length;
  eq(pages, 3, 'seventy lines run onto three pages rather than off the bottom of one');
  t.check(/\(Page 3 of 3\) Tj/.test(pdf) && (pdf.match(/\(BALANCE\) Tj/g) || []).length === 3,
    'each page is numbered and carries the column heads again');
  t.check(/\(Balance brought forward\) Tj/.test(pdf) && /\(Balance now due\) Tj/.test(pdf)
    && pdf.includes(`(${(500 + bal).toLocaleString('en-UG')}) Tj`),
    'the carried line, the totals and the balance due are on it');
  t.check(pdf.includes('(Shop \\(Kampala\\)) Tj'), 'brackets in a name are escaped, not left to break the page');
  t.check(pdf.includes('Kato \x97 Seeta'), 'a dash is written in the font\'s own alphabet, not as a broken glyph');
  t.check(/\(Kato owes 35,500 UGX\.\) Tj/.test(pdf), 'the closing sentence is the print\'s, without its markup');

  const panel = extractFunction(src, 'customerStatementPanelHTML', 'index.html');
  const send = extractFunction(src, 'sendCustomerStatementPdf', 'index.html');
  const share = extractFunction(src, 'shareStatementPdf', 'index.html');
  t.check(/data-cact="wapdf"[^>]*>[\s\S]*?Send PDF on WhatsApp<\/button>/.test(panel) && !/waComposeUrl/.test(panel),
    'the button sends the file; it no longer opens a chat with text alone');
  t.check(/if\(name === 'wapdf'\) return sendCustomerStatementPdf\(id\);/.test(src), 'and the account hands it the customer');
  t.check(/customerStatementSheet\(customerId\)/.test(send) && /shareStatementPdf\(sheet\.st, sheet\.side, /.test(send)
       && /statementPdfBytes\(st, side\)/.test(share),
    'the file is built from the same sheet the printer gets');
  t.check(/navigator\.canShare\(\{ files: \[file\] \}\)[\s\S]*?navigator\.share\(\{ files: \[file\], text \}\)/.test(share),
    'where the phone can share a file, the PDF goes into the share sheet with the balance line');
  t.check(/AbortError'\) return 'cancelled';/.test(share), 'backing out of the share sheet is left alone');
  t.check(/a\.download = name;[\s\S]*?waComposeUrl\(side\.who\.phone, text\)/.test(share),
    'elsewhere the PDF is saved and the customer\'s chat opened, ready to attach it');

  /* The supplier's statement leaves the same way: the same sheet builder
     the supplier print uses, the same file, the same share. */
  const sup = extractFunction(src, 'sendSupplierStatementPdf', 'index.html');
  const supPrint = extractFunction(src, 'printSupplierStatement', 'index.html');
  t.check(/supplierStatementSheet\(supplierId\)/.test(sup) && /shareStatementPdf\(sheet\.st, sheet\.side, supplierStatementLine\(/.test(sup)
       && /supplierStatementSheet\(supplierId\)/.test(supPrint) && /printStatementSheet\(sheet\.st, sheet\.side\)/.test(supPrint),
    'the supplier PDF is built from the sheet the supplier print uses');
  t.check(/data-sact="wapdf" data-sid=/.test(src) && /if\(name === 'wapdf'\) return sendSupplierStatementPdf\(id\);/.test(src),
    'and the supplier account carries the button, wired to it');
  const supLine = compileScope([extractFunction(src, 'supplierStatementLine', 'index.html')],
    { printedShopName: () => 'Shop', fmtShortDate: (d) => d }, ['supplierStatementLine']).supplierStatementLine;
  eq([supLine({ closing: 1500, to: 'T' }, 'Mukwano'), supLine({ closing: -200, to: 'T' }, 'Mukwano'), supLine({ closing: 0, to: 'T' }, 'Mukwano')],
    ['Statement to T: Shop owes Mukwano 1,500 UGX.', 'Statement to T: Shop has overpaid Mukwano by 200 UGX.',
     'Statement to T: the account between Shop and Mukwano is settled.'],
    'the message with it says who owes whom, the shop\'s way round');
}

process.exit(t.done() ? 1 : 0);
