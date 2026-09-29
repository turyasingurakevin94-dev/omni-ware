#!/usr/bin/env node
'use strict';
/*
 * Receive payment: one popup for every payment against invoices.
 *
 * Built to the "Receive Payment Redesign" canvas: the payment date first,
 * the customer's debt before and after, the invoices as a table the money is
 * spread over (only the ticked ones, oldest first), the account as tiles,
 * and telling the sales group in the same tap. This file holds:
 *
 *   1. both doors open it -- an invoice's Receive payment and a customer's
 *      payment -- while a CHARGE on a customer keeps its own popup;
 *   2. what Record writes is what the old popups wrote, and nothing is
 *      invented: per invoice, one Cash Book receipt and one payment line
 *      carrying the account, THE DATE THE OWNER SET and its own receipt
 *      number; anything beyond the ticked invoices onto the customer's
 *      account, and never onto a walk-in invoice that has no account;
 *   3. the group is told inside the tap, and a blocked window is not
 *      stamped as posted.
 *
 * Run: node test/receive-payment.test.js   (or: npm test)
 */
const { read, extractFunction, createReporter } = require('./_extract');

const t = createReporter('receive payment');
const src = read('index.html');
const a = src.indexOf('/* RECEIVE-PAY-JS:BEGIN */'), b = src.indexOf('/* RECEIVE-PAY-JS:END */');
t.check(a > 0 && b > a, 'the popup is found in index.html');
const block = src.slice(a, b);

/* ---------- 1. the doors ---------------------------------------------- */
{
  const inv = extractFunction(src, 'openInvoicePaymentModal', 'index.html');
  const cust = extractFunction(src, 'openCustomerDebtModal', 'index.html');
  t.check(/^function openInvoicePaymentModal\(id\)\{\n  if\(typeof openReceivePayment === 'function' && openReceivePayment\(\{ quoteId: id \}\)\) return;/.test(inv),
    'an invoice’s Receive payment opens it, before anything of the old popup runs');
  t.check(/^function openCustomerDebtModal\(id, type\)\{\n  if\(type === 'payment' && typeof openReceivePayment === 'function' && openReceivePayment\(\{ customerId: id \}\)\) return;/.test(cust),
    'a customer’s payment opens it, and only a payment — a charge keeps its own popup');
  t.check(/<div class="modal-overlay" id="rpModal"><div id="rpRoot"><\/div><\/div>/.test(src), 'it has its overlay in the markup');
}

/* ---------- 2. what Record writes --------------------------------------- */
{
  const commit = (/RpSheet\.prototype\.commit = function \(p\) \{[\s\S]*?\n\};/.exec(block) || [''])[0];
  t.check(!!commit, 'the commit is found');
  t.check(/addCashReceipt\(account, l\.take, set\.category, note \|\| \('Payment — ' \+ invoiceNumberLabel\(q\)\), date, q\.id\)/.test(commit),
    'each invoice the money reaches gets its own Cash Book receipt, on the date the owner set');
  t.check(/var payment = \{ date: date, amount: l\.take, note: note, cashTxnId: cashTxnId, method: account, id: nextPaymentId\(q\) \};/.test(commit),
    'and a payment line with that date, the account it came into and its own receipt number');
  t.check(/syncInvoiceDebtCharge\(q\)/.test(commit), 'and the customer’s debt follows the invoice');
  t.check(/recordCustomerPayment\(set\.customerId, p\.onAccount, account, note, \[\], set\.category, date\)/.test(commit),
    'what is beyond the ticked invoices goes on the customer’s account, the way a customer payment always did');
  t.check(/if \(p\.onAccount > 0\.5 && !set\.customerId\) \{[\s\S]*?return;/.test(commit) && commit.indexOf('!set.customerId') < commit.indexOf('addCashReceipt'),
    'a walk-in invoice with no account refuses an overpayment before anything is written');
  t.check(/date > todayISO\(\)/.test(commit) && commit.indexOf('date > todayISO()') < commit.indexOf('addCashReceipt'),
    'a date in the future is refused before anything is written');
  /* The table spreads the money only over the ticked invoices, oldest first. */
  t.check(/take = isOn\(inv\) \? Math\.min\(owed, left\) : 0; left -= take;/.test(block),
    'the money goes only to ticked invoices, each taking what it owes until it runs out');
  t.check(/invoices = customerOutstandingInvoices\(c\.id\)\.map\(rpInvoice\)\.sort\(function \(a, b\) \{ return parseInt\(b\.age, 10\) - parseInt\(a\.age, 10\); \}\);/.test(block),
    'a customer’s invoices are listed oldest first');
}

/* ---------- 3. telling the group --------------------------------------- */
{
  const commit = (/RpSheet\.prototype\.commit = function \(p\) \{[\s\S]*?\n\};/.exec(block) || [''])[0];
  const tell = commit.slice(commit.indexOf('if (s.post)'), commit.indexOf('saveData()'));
  t.check(/copyTextInTap\(/.test(tell) && /window\.open\(SALES_GROUP_WA_LINK, '_blank'\)/.test(tell), 'with the switch on, the message is copied and the group opened in the same tap');
  t.check(/if \(win\) \{[\s\S]*?m\[1\]\.postedAt = at;[\s\S]*?\} else \{/.test(tell), 'and only a window that actually opened stamps the payments as posted');
}

process.exit(t.done() ? 1 : 0);
