#!/usr/bin/env node
'use strict';
/*
 * The day a payment actually happened.
 *
 * Four forms take money — an invoice receipt, a purchase-invoice
 * payment, a lump-sum supplier payment, and a payment against a
 * customer's debt — and every one of them stamped today and never
 * asked. The plumbing underneath had carried a date all along:
 * addCashReceipt, addCashPayment, recordCustomerPayment and payDue all
 * take one, and the assistant could already backdate a customer
 * payment. Only the forms were silent.
 *
 * It is not a small silence. Money received on Saturday and entered on
 * Monday landed in Monday's takings: Saturday read short, Monday read
 * over, and a variance appeared on a day nothing happened. The morning
 * brief's "who paid" reads payment dates. And payablesAsAt re-sums
 * payments dated on or before the date it is asked about, so a payment
 * stamped today never appeared on last month's balance sheet at all.
 *
 * Two rules hold everywhere below:
 *   BLANK MEANS TODAY   — a cleared box is not a claim about another day.
 *   THE FUTURE IS REFUSED — money that has not arrived is not a payment,
 *   and dating one forward puts takings on a day the shop cannot count.
 *
 * Run: node test/payment-date.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('payment date');
const src = read('index.html');
const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);
const code = src.split(/\r?\n/).map(l => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');

const TODAY = '2026-08-28';
const BACK = '2026-08-25';

/* ---------- 1. the reader: blank, past, future ---------------------- */
{
  const box = { value: '' };
  const toasts = [];
  const NAMES = ['paymentDateFrom', 'paymentDatedSuffix', 'fmtShortDate'];
  const fns = compileScope(NAMES.map((n) => extractFunction(src, n, 'index.html')), {
    document: { getElementById: () => box },
    todayISO: () => TODAY,
    toast: (m) => toasts.push(m),
  }, NAMES);
  const { paymentDateFrom, paymentDatedSuffix } = fns;

  box.value = '';
  eq(paymentDateFrom('x'), TODAY, 'a blank box means today — a cleared field is not a claim about another day');
  box.value = BACK;
  eq(paymentDateFrom('x'), BACK, 'a past date is taken exactly as given');
  box.value = TODAY;
  eq(paymentDateFrom('x'), TODAY, 'and so is today');

  toasts.length = 0;
  box.value = '2026-09-01';
  eq(paymentDateFrom('x'), null, 'a future date is REFUSED, not warned about — it would put takings on a day the shop has not traded');
  t.check(/future/.test(toasts[0] || ''), `and the refusal says why (${JSON.stringify(toasts[0])})`);

  /* Said back only when it is not today: an ordinary payment gets an
     ordinary message, a backdated one names its date so a slip of the
     finger is caught at the counter rather than found in a month. */
  eq(paymentDatedSuffix(TODAY), '', 'a payment dated today says nothing extra');
  t.check(/25 Aug 2026/.test(paymentDatedSuffix(BACK)),
    `a backdated one names the date (${JSON.stringify(paymentDatedSuffix(BACK))})`);
}

/* ---------- 2. the date reaches the bill AND the cash entry --------- */
/* Both, or neither is any use: a payment row dated Friday behind a cash
   entry dated Monday is a cash book that disagrees with the invoice it
   came from, which is worse than the single wrong date it replaced. */
{
  const store = { purchaseInvoices: [], cashTxns: [], suppliers: [] };
  const NAMES = ['allocateCreditorPayment'];
  const fns = compileScope(NAMES.map((n) => extractFunction(src, n, 'index.html')), {
    data: store,
    todayISO: () => TODAY,
    addCashPayment: (account, amount, category, description, date) => {
      store.cashTxns.push({ account, amount, category, description, date });
      return store.cashTxns.length;
    },
    creditorOutstandingInvoices: () => store.purchaseInvoices,
    purchaseInvoiceBalanceDue: (pi) => (Number(pi.total) || 0) - (Number(pi.amountPaid) || 0),
    purchaseInvoiceNumberLabel: (pi) => `PINV-${pi.id}`,
  }, NAMES);
  const { allocateCreditorPayment } = fns;

  const reset = () => {
    store.purchaseInvoices = [
      { id: 1, total: 100000, amountPaid: 0, supplierName: 'Karddia' },
      { id: 2, total: 60000, amountPaid: 0, supplierName: 'Karddia' },
    ];
    store.cashTxns = [];
  };

  reset();
  /* ONE lump sum can close several bills. Three rows dated today behind
     a payment made last Friday put the money on the wrong day in the
     cash book and on the wrong side of any balance sheet asked about a
     date in between — so the date has to reach every row it settles. */
  const res = allocateCreditorPayment('S1', 140000, 'cash', 'part payment', BACK);
  eq(res.applied, 140000, 'the lump sum is spread across the outstanding bills');
  eq(store.purchaseInvoices[0].payments[0].date, BACK, 'the first bill it settles carries the date given');
  eq(store.purchaseInvoices[1].payments[0].date, BACK, 'and so does the second — one payment, one day');
  eq(store.cashTxns.length, 2, 'each portion writes its own cash entry');
  t.check(store.cashTxns.every((x) => x.date === BACK),
    'and every one of them is dated the same day as the bill row it belongs to');

  reset();
  allocateCreditorPayment('S1', 50000, 'cash', '', undefined);
  eq(store.purchaseInvoices[0].payments[0].date, TODAY,
    'called with no date at all it still means today, so every existing caller behaves exactly as before');
  eq(store.cashTxns[0].date, TODAY, 'including the cash entry');
}

/* ---------- 3. a customer payment carries it all the way down ------- */
{
  const store = { customers: [], savedQuotes: [], cashTxns: [] };
  const NAMES = ['recordCustomerPayment', 'applyCustomerPaymentAllocations'];
  const fns = compileScope(NAMES.map((n) => extractFunction(src, n, 'index.html')), {
    data: store,
    todayISO: () => TODAY,
    allocRowId: () => 1,
    addCashReceipt: (account, amount, category, description, date, quoteId) => {
      store.cashTxns.push({ account, amount, category, date, quoteId });
      return store.cashTxns.length;
    },
    invoiceNumberLabel: (q) => `INV-${q.id}`,
    syncInvoiceDebtCharge: () => {},
  }, NAMES);
  const { recordCustomerPayment } = fns;

  store.customers = [{ id: 7, name: 'Mulongo', debt: 300000, debtLog: [] }];
  store.savedQuotes = [];
  recordCustomerPayment(7, 120000, 'cash', 'part', [], null, BACK);
  const log = store.customers[0].debtLog[0];
  eq(log.date, BACK, "the customer's own history is dated the day the money arrived");
  eq(store.cashTxns[0].date, BACK, 'and so is the cash entry behind it');

  store.customers[0].debtLog = [];
  store.cashTxns = [];
  recordCustomerPayment(7, 10000, 'cash', '', [], null, undefined);
  eq(store.customers[0].debtLog[0].date, TODAY, 'and with no date given it is today, as it always was');
}

/* ---------- 4. the forms actually ask ------------------------------- */
{
  const FIELDS = [
    ['ip_date', 'Date received', 'the invoice receipt'],
    ['pip_date', 'Date paid', 'the purchase-invoice payment'],
    ['crp_date', 'Date paid', 'the supplier payment'],
    ['cd_date', 'Date received', "the customer's debt payment"],
  ];
  FIELDS.forEach(([id, label, what]) => {
    t.check(new RegExp(`id="${id}" type="date"`).test(src), `${what} has a date field`);
    t.check(new RegExp(`for="${id}"[^>]*>${label}`).test(src) || new RegExp(`for="${id}"`).test(src),
      `${what}'s field is labelled`);
  });

  /* Defaulted in the OPEN handler, which is the one thing that always
     runs before the form is seen. A date left over from the last
     payment is how a whole afternoon's takings land on one wrong day.

     Scoped to each open handler's own body, not searched across the
     whole file: measured file-wide, deleting the default from
     openCreditorPaymentModal still passed, because resetCreditorPaymentForm
     sets one too and the regex found that instead. A check that any
     line exists somewhere is not a check that the right line exists in
     the right place. */
  [
    ['openInvoicePaymentModal', 'ip_date'],
    ['openPiPaymentModal', 'pip_date'],
    ['openCreditorPaymentModal', 'crp_date'],
    ['openCustomerDebtModal', 'cd_date'],
  ].forEach(([fn, id]) => {
    const body = extractFunction(src, fn, 'index.html');
    t.check(new RegExp(`getElementById\\('${id}'\\)\\.value = todayISO\\(\\);`).test(body),
      `${id} is defaulted to today by ${fn} itself, so a stale date can never be inherited`);
  });

  // Every save reads it through the one reader, and stops if it refuses.
  ['ip_date', 'pip_date', 'crp_date', 'cd_date'].forEach((id) => {
    t.check(new RegExp(`paymentDateFrom\\('${id}'\\)`).test(code),
      `${id} is read through the shared reader, so all four obey the same rules`);
  });
  eq((code.match(/if\(!paidOn\) return;/g) || []).length, 3,
    'and each money save stops dead when the date is refused');
  t.check(/if\(!happenedOn\) return;/.test(code),
    'as does the customer one, which names its date differently because a charge is not a payment');

  // The old hard-coded stamps are gone from all four paths.
  t.check(!/const payment = \{date: todayISO\(\), amount, note, cashTxnId, method: account/.test(code),
    'the invoice receipt no longer stamps today regardless');
  t.check(!/pi\.payments\.push\(\{date: todayISO\(\), amount, note, cashTxnId\}\)/.test(code),
    'nor does the purchase-invoice payment');
  t.check(!/pi\.payments\.push\(\{date: todayISO\(\), amount: pay, note, cashTxnId\}\)/.test(code),
    'nor the lump-sum allocation');

  /* The invoice receipt used to hand addCashReceipt a literal null for
     the date, which is what put a Saturday payment into Monday's cash
     book while the invoice row said Saturday. */
  t.check(/addCashReceipt\(account, amount, 'Invoice Payment'[^\n]*paidOn, q\.id\)/.test(code),
    'and the cash entry behind an invoice receipt is dated with it, not left to default');
}

/* ---------- 5. two date questions are never asked at once ----------- */
/* "Settled on" dates a bill paid off before this system and moves no
   cash; "Date paid" dates money leaving the till. Two date boxes side by
   side is a form nobody can answer confidently. */
{
  const toggle = code.slice(code.indexOf('function pipRefreshSettledBefore'));
  const body = toggle.slice(0, toggle.indexOf('\n}'));
  t.check(/pip_settled_date_field'\)\.style\.display = on \? '' : 'none';/.test(body),
    'the settled-before date shows only for a settled-before payment');
  t.check(/pip_date_field'\)\.style\.display = on \? 'none' : '';/.test(body),
    'and the ordinary date hides exactly when it does — never both at once');
}

/* ---------- 6. a charge is a dated event too ------------------------ */
{
  t.check(/date: happenedOn, type:'charge'/.test(code),
    'a charge added by hand carries the day it happened, not the day it was typed');
  t.check(/cd_date_label'\)\.textContent = \(type==='charge'\)/.test(code),
    'and the field asks the right question for it, because a charge is not money received');
}

/* ---------- 7. backdating does not corrupt the cash book -------------

   The load-bearing safety claim behind this whole change, so it is
   simulated rather than reasoned about. A receipt dropped into a past
   day changes that day's closing; the question is what happens to the
   days after it.

   cbDayPosition trusts a STORED opening only when openingSet is true --
   somebody physically counted the drawer and stood behind the figure.
   Otherwise it recomputes through carriedOpening, which prefers the
   previous day's counted `actual` over the computed closing. So the
   money flows forward through uncounted days, and a day that WAS
   counted stays anchored on the count rather than being pushed off it. */
{
  const data = { cashDays: {}, cashTxns: [] };
  const NAMES = ['ACCOUNTS', 'CASH_NOT_REVENUE', 'cashHas'];
  const FNS = ['cashIsMoneyIn', 'cbAccountTotals', 'cbClosingFor', 'previousCashDate',
    'carriedOpening', 'getDayRecord', 'cbDayPosition'];
  const scope = compileScope(
    NAMES.map((n) => extractDeclaration(src, n, 'index.html'))
      .concat(FNS.map((n) => extractFunction(src, n, 'index.html'))),
    { data, todayISO: () => TODAY, fmtUGX: (n) => `${n} UGX` },
    FNS);
  const { cbDayPosition } = scope;

  const D1 = '2026-08-25', D2 = '2026-08-26', D3 = '2026-08-27';
  const receipt = (id, date, amount) => ({
    id, date, time: '10:00', account: 'cash', type: 'receipt', category: 'Debt Payment', amount, description: '',
  });

  // Monday's opening was counted and confirmed; nothing since.
  data.cashDays = { [D1]: { opening: { cash: 100000, momo: 0, bank: 0 }, actual: { cash: null, momo: null, bank: null }, openingSet: true } };
  data.cashTxns = [receipt(1, D1, 40000)];

  eq(Math.round(cbDayPosition(D1).in), 40000, 'a receipt dated three days back lands on that day, not today');
  eq(Math.round(cbDayPosition(D1).closing), 140000, "and moves that day's closing");

  /* The days after it were never counted, so they recompute — the money
     carries forward instead of stopping where it was entered. */
  eq(Math.round(cbDayPosition(D2).opening), 140000, 'the next uncounted day opens with it');
  eq(Math.round(cbDayPosition(D3).opening), 140000, 'and so does the one after that — it flows through, it does not strand');

  /* Now somebody counts Wednesday's drawer and stands behind 200,000.
     From there the count is the anchor: a payment discovered later and
     dated BEFORE it restates that earlier day honestly without pushing
     the counted day off the figure a human physically verified. */
  data.cashDays[D3] = { opening: { cash: 200000, momo: 0, bank: 0 }, actual: { cash: null, momo: null, bank: null }, openingSet: true };
  eq(Math.round(cbDayPosition(D3).opening), 200000, 'a confirmed opening is not overwritten by a backdated receipt before it');
  eq(Math.round(cbDayPosition(D1).in), 40000, 'while the earlier day still reports the money on the day it arrived');

  /* Which is why backdating is the REPAIR for a historic overage, not a
     hazard: the Cash Book already tells the shop that money found is
     usually a sale nobody wrote down. Dating it right is how it gets
     written down. */
  data.cashDays[D1].actual = { cash: 140000, momo: null, bank: null };
  eq(cbDayPosition(D1).varianceTotal, 0,
    'and a day counted at 140,000 that looked 40,000 over now reconciles exactly');
}

process.exit(t.done() ? 1 : 0);
