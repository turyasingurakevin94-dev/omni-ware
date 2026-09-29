#!/usr/bin/env node
'use strict';
/*
 * Telling the sales group a payment came in.
 *
 * Every screen that takes money in offers, the moment the payment is saved,
 * to post it to the WhatsApp sales group: one sheet (#payPostModal), one
 * message builder (paymentPostText). This file holds two things:
 *
 *   1. the message says what the group needs and nothing it should not:
 *      the amount, who, how and when, each invoice and what is left on it,
 *      what went on account, and -- only while "Show what they still owe"
 *      is ticked -- the balances;
 *   2. EVERY receiving path offers it. A sixth way of taking money added
 *      later, or a refactor of one of these five, that forgets the offer
 *      is a payment the group never hears about -- so each is named here.
 *
 * Nothing posts itself: the send is inside the owner's tap, and a blocked
 * WhatsApp window is not stamped as posted.
 *
 * Run: node test/payment-post.test.js   (or: npm test)
 */
const { read, extractFunction, createReporter } = require('./_extract');

const t = createReporter('payment post');
const src = read('index.html');

/* ---------- 1. the message ------------------------------------------------ */
{
  const fns = ['paymentPostDate', 'paymentPostText'].map((n) => extractFunction(src, n, 'index.html')).join('\n');
  const today = '2026-09-28';
  const make = new Function('todayISO', 'accountLabel', fns + '\nreturn paymentPostText;');
  const text = make(() => today, (k) => ({ cash: 'Cash', momo: 'Mobile money' })[k] || k);
  const p = { who: 'Kato Construction', amount: 900000, account: 'momo', date: today,
    lines: [{ label: 'INV-0148', paid: 500000, left: 930000 }, { label: 'INV-0150', paid: 300000, left: 0 }],
    onAccount: 100000, owes: 930000 };
  const full = text(p, true), bare = text(p, false);
  t.check(/^\*Payment in · UGX 900,000\*\nKato Construction · Mobile money · today\n/.test(full), 'it leads with the amount, then who, how and when');
  t.check(/• INV-0148 — 500,000 · 930,000 left/.test(full) && /• INV-0150 — 300,000 · paid in full/.test(full), 'each invoice says what was paid and what is left, or that it is paid in full');
  t.check(/• On account — 100,000/.test(full) && /Still owes UGX 930,000$/.test(full), 'what went on account, and what they still owe');
  t.check(!/left|paid in full|owes|settled/i.test(bare) && /INV-0148 — 500,000/.test(bare), 'unticked, the balances stay out of the group');
  t.check(/All settled$/.test(text(Object.assign({}, p, { owes: 0 }), true)), 'a customer who owes nothing reads "All settled", not "owes 0"');
}

/* ---------- 2. every receiving path offers it ----------------------------- */
{
  const offers = (label, re) => t.check(re.test(src), label);
  offers('an invoice’s Receive payment', /toast\('Payment recorded' \+ paymentDatedSuffix\(paidOn\)\);\n\s*offerPaymentPost\(paymentPostFromInvoices\(\[\{ q, payment \}\]/);
  offers('a customer’s payment (Customers, Debtors, promises, follow-ups)', /const told = paymentPostWatch\(c\.id, selections\);\n\s*recordCustomerPayment\(c\.id[\s\S]{0,200}?customerDebtPost = told\(/);
  offers('Cash in with a customer named', /recordCustomerPayment\(customer\.id[^\n]*\n\s*const cashInPost = told\([\s\S]{0,400}?offerPaymentPost\(cashInPost\)/);
  offers('an agent’s prepayment', /prepayPost = paymentPostFromInvoices\([\s\S]{0,600}?offerPaymentPost\(prepayPost\)/);
  offers('an agent’s payment on the Sales agents screen', /recorded in the Cash Book`\);\n\s*\{[\s\S]{0,400}?offerPaymentPost\(post\)/);
  const send = (/getElementById\('payPostSend'\)\.addEventListener\('click', \(\)=>\{[\s\S]*?\n\}\);/.exec(src) || [''])[0];
  t.check(/copyTextInTap\(text\)[\s\S]*window\.open\(SALES_GROUP_WA_LINK/.test(send) && /if\(!win\)\{[^}]*return; \}/.test(send) && send.indexOf('if(!win)') < send.indexOf('postedAt'),
    'the send copies and opens the group inside the tap, and a blocked window is not stamped as posted');
}

process.exit(t.done() ? 1 : 0);
