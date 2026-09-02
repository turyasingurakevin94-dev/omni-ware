#!/usr/bin/env node
'use strict';
/*
 * Chasing what is owed.
 *
 * The Debtors list answers "who owes me"; this queue answers the
 * question after it — who do I ask today, and what do I say. Three
 * rules take rows OUT of it, and they are the whole point:
 *
 *   GRACE. Nobody is chased before the shop's own terms have run.
 *   REST. Nobody is chased twice inside the resting period.
 *   A BALANCE THAT ADDS UP. A customer whose stored balance disagrees
 *   with its own ledger is never sent a demand — the app cannot
 *   explain that figure, so it must not ask for it.
 *
 * And the message is written from that customer's own invoices: it
 * names them, says plainly what they do not cover, and never prints a
 * breakdown that outruns the balance.
 *
 * Run: node test/debt-chase.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('debt chase');
const src = read('index.html');
const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);

const TODAY = '2026-08-27';
const ago = (days) => {
  const d = new Date(Date.parse(TODAY + 'T00:00:00Z') - days * 86400000);
  return d.toISOString().slice(0, 10);
};

/* Charges and payments, in the shape the debt ledger keeps them. */
const charge = (id, days, amount, quoteId) => ({ id, date: ago(days), type: 'charge', amount, quoteId, note: '' });
const paid = (id, days, amount) => ({ id, date: ago(days), type: 'payment', amount, note: '' });

const data = {
  presetChaseAfterDays: 7,
  presetChaseRestDays: 3,
  presetDebtChases: {},
  customers: [
    // Long overdue, two open invoices, has paid before.
    { id: 'C1', name: 'Mulongo', phone: '0772 111 222', location: 'Kireka', debt: 2450000,
      debtLog: [charge(1, 95, 1200000, 11), charge(2, 40, 1500000, 12), paid(3, 30, 250000)] },
    // Overdue, smaller, in the same band as C3 but bigger.
    { id: 'C2', name: 'Birimuye', phone: '0700 333 444', location: '', debt: 800000,
      debtLog: [charge(4, 35, 800000, 13)] },
    // Overdue, smaller still, never paid anything.
    { id: 'C3', name: 'David', phone: '', location: 'Ntinda', debt: 300000,
      debtLog: [charge(5, 33, 300000, 14)] },
    // Inside the grace period: late by nobody's reckoning.
    { id: 'C4', name: 'Fresh Buyer', phone: '0755 999 000', location: '', debt: 900000,
      debtLog: [charge(6, 3, 900000, 15)] },
    // Balance does not match its own ledger: never chased.
    { id: 'C5', name: 'Drifted', phone: '0788 555 666', location: '', debt: 500000,
      debtLog: [charge(7, 60, 200000, 16)] },
    // A balance with nothing dated behind it.
    { id: 'C6', name: 'Undated', phone: '0700 777 888', location: '', debt: 150000, debtLog: [] },
    // Owes nothing.
    { id: 'C7', name: 'Settled', phone: '0700 000 111', location: '', debt: 0, debtLog: [] },
  ],
  savedQuotes: [
    { id: 11, customerId: 'C1', invoiced: true, voided: false, invoicedAt: ago(95), amountPaid: 250000,
      items: [{ qty: 1, sellPrice: 1200000, price: 0 }] },
    { id: 12, customerId: 'C1', invoiced: true, voided: false, invoicedAt: ago(40), amountPaid: 0,
      items: [{ qty: 1, sellPrice: 1500000, price: 0 }] },
    { id: 13, customerId: 'C2', invoiced: true, voided: false, invoicedAt: ago(35), amountPaid: 0,
      items: [{ qty: 1, sellPrice: 800000, price: 0 }] },
    { id: 14, customerId: 'C3', invoiced: true, voided: false, invoicedAt: ago(33), amountPaid: 0,
      items: [{ qty: 1, sellPrice: 300000, price: 0 }] },
    // Voided and fully paid invoices are not money anybody owes.
    { id: 17, customerId: 'C1', invoiced: true, voided: true, invoicedAt: ago(20), amountPaid: 0,
      items: [{ qty: 1, sellPrice: 999000, price: 0 }] },
  ],
};

let saved = 0;
const env = {
  data,
  todayISO: () => TODAY,
  saveData: () => { saved++; },
  fmtUGX: (n) => Number(n || 0).toLocaleString('en-US') + ' UGX',
  fmtShortDate: (iso) => String(iso),
  savedQuoteTotal: (q) => (q.items || []).reduce((s, i) => s + (Number(i.qty) || 0) * (Number(i.sellPrice) || 0), 0),
  customerLastPaymentDate: (c) => {
    const pays = (c.debtLog || []).filter((l) => l.type === 'payment');
    return pays.length ? pays[pays.length - 1].date : null;
  },
};

let scope = null; let err = null;
try {
  scope = compileScope([
    'debtChaseRows', 'debtChaseInvoices', 'debtChaseMessage',
    'markDebtChased', 'unmarkDebtChased', 'pruneDebtChases',
    'promisesFor', 'promiseState', 'promiseLatest', 'promisesBroken',
    'debAllRows', 'customerOpenCharges', 'customerOldestOpenChargeDate',
    'customerDebtProgress', 'customerDebtDrift', 'customerLedgerTotal', 'customerOrdersFor',
    'invoiceBalanceDue', 'invoiceNumberLabel', 'agingBandFor', 'agingDaysLabel',
    'daysSinceDate',
  ].map((n) => extractFunction(src, n, 'index.html'))
    .concat([
      extractDeclaration(src, 'AGING_BANDS', 'index.html'),
      extractDeclaration(src, 'DEBT_CHASE_INVOICE_LINES', 'index.html'),
    ]),
  env, ['debtChaseRows', 'debtChaseMessage', 'markDebtChased', 'unmarkDebtChased', 'pruneDebtChases']);
} catch (e) { err = e; }
t.check(!!scope, `the chase chain compiles${err ? ` (${err.message})` : ''}`);

/* ---------- 1. who is in the queue, and who is deliberately not ------- */
if (scope) {
  const q = scope.debtChaseRows();
  eq(q.due.map((r) => r.name).join(','), 'Mulongo,Birimuye,David',
    'worst-aged band first, biggest inside it');
  t.check(!q.due.some((r) => r.name === 'Fresh Buyer'),
    'nobody inside the grace period is chased — they are not late yet');

  const blocked = q.blocked.map((r) => r.name + ':' + r.why).join(',');
  eq(blocked, 'Drifted:drift,Undated:undated',
    'a balance that disagrees with its own history, and one with no dated charge, are HELD BACK and named');
  t.check(!q.due.some((r) => r.name === 'Drifted'),
    'a demand is never written for a figure the app itself cannot explain');
  t.check(!q.due.concat(q.blocked).some((r) => r.name === 'Settled'),
    'and somebody who owes nothing is not on a debt screen at all');
}

/* ---------- 2. resting between chases --------------------------------- */
if (scope) {
  data.presetDebtChases = { C2: ago(1) };
  const q = scope.debtChaseRows();
  t.check(!q.due.some((r) => r.name === 'Birimuye'),
    'somebody chased yesterday is not chased again today');
  eq(q.resting.map((r) => r.name).join(','), 'Birimuye',
    'they are named as resting, so the queue\'s silence about them is visible');
  eq(q.resting[0].chasedDaysAgo, 1, 'with how long ago it was');

  data.presetDebtChases = { C2: ago(5) };
  t.check(scope.debtChaseRows().due.some((r) => r.name === 'Birimuye'),
    'and once the resting days have run they come back into the queue');
  data.presetDebtChases = {};
}

/* ---------- 3. the message ------------------------------------------- */
if (scope) {
  const q = scope.debtChaseRows();
  const ident = { name: 'OMNI-WARE', phone: '0754 333419' };
  const msg = scope.debtChaseMessage(q.due.find((r) => r.name === 'Mulongo'), ident);

  t.check(/Hello Mulongo,/.test(msg), 'it greets them by name');
  t.check(/OMNI-WARE here/.test(msg) && /2,450,000 UGX/.test(msg),
    'says who is asking and for how much');
  t.check(/INV-0011/.test(msg) && /INV-0012/.test(msg),
    'and NAMES the invoices, so nobody has to go and work out what the total is made of');
  t.check(/950,000 UGX/.test(msg),
    'each invoice carries what is still due on it, not what it was worth new');
  t.check(/outstanding/.test(msg) && /last payment reached us on/.test(msg),
    'with how long it has run and when they last paid');
  t.check(/does not match your own records, tell us/.test(msg),
    'and it invites a correction rather than assuming the shop is never wrong');

  const never = scope.debtChaseMessage(q.due.find((r) => r.name === 'David'), ident);
  t.check(/have not received a payment on this account yet/.test(never),
    'somebody who has never paid is not told about a payment that never happened');

  /* A balance bigger than the invoices behind it: the remainder is
     named as carried, never folded in silently. */
  const carried = scope.debtChaseMessage({ name: 'Carried', debt: 500000, ageDays: 40, lastPaid: null,
    invoices: [{ no: 'INV-0031', date: '2026-08-01', due: 300000 }] }, ident);
  t.check(/200,000 UGX carried on the account from earlier/.test(carried),
    'what the invoices do not cover is said plainly');

  /* And a breakdown that outruns the balance is not printed at all. */
  const over = scope.debtChaseMessage({ name: 'Over', debt: 100000, ageDays: 40, lastPaid: null,
    invoices: [{ no: 'INV-0041', date: '2026-08-01', due: 400000 }] }, ident);
  t.check(!/INV-0041/.test(over),
    'a breakdown bigger than the balance is withheld — the shop must not ask for a figure it cannot stand behind');

  const many = scope.debtChaseMessage({ name: 'Many', debt: 900000, ageDays: 40, lastPaid: null,
    invoices: Array.from({ length: 9 }, (_, i) => ({ no: 'INV-00' + (50 + i), date: '2026-08-01', due: 100000 })) }, ident);
  t.check(/and 3 more invoices\./.test(many),
    'a long list is cut with the count said out loud, never silently');
}

/* ---------- 4. marking, undoing, pruning ------------------------------ */
if (scope) {
  const before = saved;
  scope.markDebtChased('C1');
  eq(data.presetDebtChases.C1, TODAY, 'taking the message away stamps the chase');
  t.check(saved > before, 'and saves it, so another device sees it too');
  t.check(!scope.debtChaseRows().due.some((r) => r.name === 'Mulongo'),
    'which takes them out of today\'s queue');
  scope.unmarkDebtChased('C1');
  t.check(!data.presetDebtChases.C1 && scope.debtChaseRows().due.some((r) => r.name === 'Mulongo'),
    'and "not sent" puts them straight back — the app cannot see WhatsApp, so the owner has the last word');

  data.presetDebtChases = { C7: ago(2), C1: ago(1) };
  scope.pruneDebtChases();
  t.check(!data.presetDebtChases.C7 && !!data.presetDebtChases.C1,
    'stamps for customers who have paid up are dropped — that conversation is over');
  data.presetDebtChases = {};
}

/* ---------- 5. the wiring --------------------------------------------- */
{
  t.check(/id="tab-chase"/.test(src) && /data-tab="chase"/.test(src),
    'Chase debts is its own screen on the rail');
  const go = extractFunction(src, 'goToTab', 'index.html');
  t.check(/if\(tab==='chase'\) renderChaseScreen\(\);/.test(go), 'and redraws on entry');
  const panel = extractFunction(src, 'renderChaseScreen', 'index.html');
  t.check(/waComposeUrl\(r\.phone, msgFor\(r\.id\)\)/.test(panel),
    'sending opens WhatsApp with the message written — the same door the quote sender uses');
  t.check(/markDebtChased\(r\.id\)/.test(panel), 'and taking it away records the chase');
  t.check(/openCustomerDebtModal\(btn\.dataset\.id, 'payment'\)/.test(panel),
    'a customer who pays is received through the same door as the Debtors list');
  t.check(/chase-msg/.test(panel) && /msgFor\(r\.id\)/.test(panel),
    'the message is editable, and what SENDS is what the owner sees — not a copy of it');
  const badge = extractFunction(src, 'renderChaseBadge', 'index.html');
  t.check(/debtChaseRows\(\)\.due\.length/.test(badge),
    'the rail count comes off the same derivation, so it cannot disagree with the list');
  t.check(/renderChaseBadge\(\);/.test(extractFunction(src, 'refreshNavBadges', 'index.html')),
    'and refreshes with every other badge');
  t.check(/chaseAfterDays:d\.presetChaseAfterDays/.test(src) && /debtChases:d\.presetDebtChases\|\|\{\}/.test(src)
    && /presetChaseAfterDays: presets\.chaseAfterDays != null/.test(src),
    'the terms and the chase stamps load and persist with the shop settings');
}

/* ---------- 6. a queue, and one debtor being worked ------------------ */
/*
 * Two shapes before this one. First the spare parts: .buy-controls with
 * the queue's state in a hint, .buy-tail/.buy-row as shopping rows, a
 * dashed line between debtors. Then a card per debtor -- which put five
 * editable messages on one screen, four of which nobody was about to
 * send. Now the console shows the queue on the left and ONE debtor's
 * work on the right: their invoices, their message, their buttons; the
 * phone shows that debtor open and the rest as rows. The queue's state
 * is the layer's strip, and the ones deliberately not asked are named
 * in one panel rather than dropped.
 */
{
  const panel = extractFunction(src, 'renderChaseScreen', 'index.html');

  t.check(/class="ow-pan ch-work" data-id=/.test(panel) && /class="ow-lr ch-row/.test(panel) && !/class="chase-row"/.test(panel),
    'the debtor being worked is one panel with everything needed to send; the rest are rows in a queue');
  t.check(/let chaseSelectedId = null;/.test(src) && /chaseSelectedId = btn\.dataset\.id;/.test(panel),
    'and clicking a row makes it the one being worked');
  t.check(/class="ow-strip ch-strip/.test(panel) && /'To chase'/.test(panel) && /'Between them'/.test(panel),
    'what the queue holds is in the layer’s strip, like every converted screen');
  t.check(!/chase_summary/.test(src),
    'and not in a hint beside the settings — that element is gone');
  t.check(/Deliberately not asked/.test(panel) && /Said when they would pay/.test(panel)
    && /Chased in the last/.test(panel) && /Held back until the balance is checked/.test(panel)
    && !/class="buy-tail"/.test(panel) && !/class="buy-row"/.test(panel),
    'the promised, resting and held-back accounts are named in one panel, in three groups, rather than dropped');
  /* The message is the layer's .ow-msg and still the textarea the
     handlers read through data-msg; nothing about how it is sent moved. */
  t.check(/<textarea class="ow-msg chase-msg" data-msg=/.test(panel) && /Nothing has been sent\./.test(panel),
    'the message is the layer’s message box, and it says nothing has been sent');
  t.check(/class="form-panel chase-controls"/.test(src) && /<label for="chase_after">/.test(src),
    'the two rules the queue obeys are labelled fields in a form');
  t.check(/id="chase_after"/.test(src) && /id="chase_rest"/.test(src),
    'keeping the ids — the listeners bind to them at parse time with no null guard');

  /* Send last. It was first, so the three quieter buttons trailed off
     after the loud one and the eye had to come back for them. */
  const iSend = panel.indexOf('chase-send');
  const iCopy = panel.indexOf('chase-copy');
  const iReceive = panel.indexOf('chase-receive');
  t.check(iReceive > 0 && iReceive < iCopy && iCopy < iSend,
    'and the strongest action is last in the row, where the thumb lands');

  /* THE SPARE PARTS ARE GONE. Four screens wore them because they were
     there. A dead rule in the stylesheet is how a fifth ends up in one. */
  t.check(!/\.buy-row\{/.test(src) && !/\.buy-controls\{/.test(src) && !/\.buy-tail h4\{/.test(src)
    && !/\.chase-row\{/.test(src) && !/\.chase-head\{/.test(src)
    && !/\.chase-card\{/.test(src) && !/\.chase-list\{/.test(src) && !/\.chase-acts\{/.test(src),
    'the borrowed classes are deleted, not left in the drawer — the card-per-debtor rules with them');
  /* .chase-mini and .chase-tail are NOT chase's own any more: "Who you
     owe" wears them for its undated and missed bills. They stay. */
  t.check(/\.chase-mini\{/.test(src) && /\.chase-tail h4\{/.test(src),
    'while the two families another screen still wears are kept');
}

process.exit(t.done() ? 1 : 0);
