#!/usr/bin/env node
'use strict';
/*
 * The day statement: every order and payment of a day, checked by the
 * owner against the sales group.
 *
 * The decisions pinned below:
 *
 *   what counts        an order is anything past a draft that has not
 *                      been voided; a payment is money through the same
 *                      two gates as the morning brief, so the two screens
 *                      can never count a day's money differently.
 *   one payment        a payment spread across invoices lands as several
 *                      receipts at the same minute. It is read back as the
 *                      ONE payment it was, carrying every invoice it paid.
 *   reading is free    looking at the screen must never write the
 *                      settings blob -- only a tick, a post or a close may.
 *   the spread         a received payment fills the ticked invoices in the
 *                      order they were ticked, until the money runs out.
 *   the snapshot       what the app posted is kept, so an order edited
 *                      after posting shows as a difference.
 *
 * Run: node test/day-statement.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('day statement');
const src = read('index.html');

const a = src.indexOf('/* ================= DAY STATEMENT =================');
const b = src.indexOf('\nfunction refreshNavBadges(){', a);
t.check(a > 0 && b > a, 'the day statement module is found');
const moduleSrc = src.slice(a, b);

const data = { customers: [], savedQuotes: [], cashTxns: [] };
const today = '2026-09-28';
const lineTotal = (q)=> (q.items || []).reduce((s, it)=> s + it.qty * it.sellPrice, 0);
const scope = compileScope([
  moduleSrc,
  extractFunction(src, 'collectionInvoiceTxn', 'index.html'),
  extractFunction(src, 'collectionLedgerRow', 'index.html'),
  extractFunction(src, 'debtLogIsInvoiceOwned', 'index.html'),
  extractFunction(src, 'cashIsMoneyIn', 'index.html'),
  extractFunction(src, 'invoiceNumberLabel', 'index.html'),
  extractFunction(src, 'invoiceBalanceDue', 'index.html'),
], {
  data,
  savedQuoteTotal: lineTotal,
  quoteItemSellPrice: (it)=> it.sellPrice,
  quoteClientName: (q)=> (q.client && q.client.name) || 'Unnamed client',
  accountLabel: (k)=> k,
  todayISO: ()=> today,
  salesGroupOrderMessage: ()=> 'msg',
  customerOutstandingInvoices: (cid)=> data.savedQuotes.filter(q=> q.customerId === cid && q.invoiced && !q.voided && lineTotal(q) - q.amountPaid > 0),
  esc: (s)=> String(s), toast: ()=>{}, saveData: ()=>{},
}, ['dsRecords', 'dsStatusOf', 'dsStateOf', 'dsLogR', 'dsLogW', 'dsCompare', 'dsNoteOrderPosted', 'dsReceivePlan', 'dsOrderDay']);

const cust = { id: 7, name: 'Kato Construction', debt: 0, debtLog: [] };
data.customers.push(cust);
const order = (id, extra)=> Object.assign({ id, status: 'completed', invoiced: true, voided: false, amountPaid: 0, customerId: 7,
  client: { name: 'Kato Construction' }, createdAt: today + 'T08:14:00.000Z', date: today,
  items: [{ productName: 'Cement 50kg', qty: 10, sellPrice: 35000 }], payments: [] }, extra || {});
const q1 = order(1), q2 = order(2, { items: [{ productName: 'Wire mesh', qty: 12, sellPrice: 45000 }] });
const draft = order(3, { status: 'draft', invoiced: false });
const voided = order(4, { voided: true });
const yesterday = order(5, { createdAt: '2026-09-27T09:00:00.000Z' });
data.savedQuotes.push(q1, q2, draft, voided, yesterday);

/* One payment of 700,000 spread across two invoices: two receipts, one minute. */
data.cashTxns.push({ id: 31, type: 'receipt', account: 'momo', category: 'Debt Payment', amount: 350000, time: '10:05' },
                   { id: 32, type: 'receipt', account: 'momo', category: 'Debt Payment', amount: 350000, time: '10:05' },
                   { id: 40, type: 'receipt', account: 'cash', category: 'Agent Payment', amount: 99000, time: '11:00' });
q1.payments.push({ date: today, amount: 350000, cashTxnId: 31 });
q2.payments.push({ date: today, amount: 350000, cashTxnId: 32 });
q2.payments.push({ date: today, amount: 99000, cashTxnId: 40 });
q1.amountPaid = 350000; q2.amountPaid = 449000;

const recs = scope.dsRecords(today, today);
const orders = recs.filter(r=> r.kind === 'order');
const pays = recs.filter(r=> r.kind === 'pay');
t.check(orders.length === 2 && orders.every(r=> r.qid === 1 || r.qid === 2),
  'orders are the day\'s non-draft, non-voided ones — the draft, the voided one and yesterday\'s stay out');
t.check(pays.length === 1, 'two receipts at the same minute are ONE payment, and an agent settling their order is not a collection');
t.check(pays[0] && pays[0].amt === 700000 && pays[0].alloc.length === 2 && pays[0].key === 't:31',
  'carrying its whole amount, both invoices it paid, and the first receipt as its key');
t.check(pays[0] && /^split: INV-0001, INV-0002/.test(pays[0].what), 'and it says it was split, naming both invoices');

/* Reading must not write. */
t.check(scope.dsLogR() && data.presetDayLog === undefined, 'looking at the screen writes nothing to the settings');

/* Status: unposted-and-unchecked is its own state. */
const o1 = orders.find(r=> r.qid === 1);
t.check(scope.dsStatusOf(o1, {}) === 'missing', 'an order nobody posted and nobody checked reads as not posted');
q1.announcedAt = Date.parse(today + 'T08:16:00');
const o1b = scope.dsRecords(today, today).find(r=> r.key === 'q:1');
t.check(scope.dsStatusOf(o1b, {}) === 'todo', 'once posted it is waiting for the owner\'s tick');
t.check(scope.dsStatusOf(o1b, { 'q:1': { s: 'diff' } }) === 'diff' && scope.dsStateOf(o1b, { 'q:1': { s: 'ok' } }) === 'ok',
  'and the tick is what decides it');

/* The snapshot: posted as 10 bags, then the order changed to 12. */
scope.dsNoteOrderPosted(q1, 'Kato cement x 10');
t.check(data.presetDayLog && data.presetDayLog.posts['q:1'] && data.presetDayLog.posts['q:1'].text === 'Kato cement x 10',
  'posting keeps the words that went');
q1.items[0].qty = 12;
const cmp = scope.dsCompare(scope.dsRecords(today, today).find(r=> r.key === 'q:1'));
const tot = cmp.rows.find(r=> r.k === 'Total');
t.check(cmp.known && tot && tot.ours === (420000).toLocaleString('en-UG') && tot.theirs === (350000).toLocaleString('en-UG'),
  'and an order edited after posting shows the difference against what the group saw');
q1.items[0].qty = 10;

/* The spread: ticked order wins, not age. */
q1.amountPaid = 0; q2.amountPaid = 0;
globalThis.__ = null;
const plan = (sel, amt)=>{
  const vm = compileScope([moduleSrc, 'dsRv = __rv;'], Object.assign({}, {
    data, savedQuoteTotal: lineTotal, quoteItemSellPrice: (it)=> it.sellPrice, quoteClientName: (q)=> q.client.name,
    accountLabel: (k)=> k, todayISO: ()=> today, salesGroupOrderMessage: ()=> 'msg', esc: String, toast: ()=>{}, saveData: ()=>{},
    customerOutstandingInvoices: (cid)=> data.savedQuotes.filter(q=> q.customerId === cid && q.invoiced && !q.voided && lineTotal(q) - q.amountPaid > 0),
    invoiceBalanceDue: (q)=> Math.max(0, lineTotal(q) - q.amountPaid),
    __rv: { cid: 7, sel, amt },
  }), ['dsReceivePlan']);
  return vm.dsReceivePlan();
};
const p1 = plan([2, 1, 5], 700000);
t.check(p1.plan[2] === 540000 && p1.plan[1] === 160000 && p1.plan[5] === 0 && p1.rest === 0,
  'a payment fills the invoices in the order they were ticked, until it runs out');
const p2 = plan([1], 400000);
t.check(p2.plan[1] === 350000 && p2.rest === 50000, 'and what is left over is what goes onto their account');

/* The wiring the screen depends on. */
t.check(/dayLog:d\.presetDayLog\|\|\{\}/.test(src) && /presetDayLog: \(presets\.dayLog/.test(src),
  'the ticks save and load with the shop\'s settings');
t.check(/q\.announcedAt = Date\.now\(\);[\s\S]{0,300}dsNoteOrderPosted\(q, text\)/.test(extractFunction(src, 'announceOrderToGroup', 'index.html')),
  'an order announced from the board keeps its words and figures for the day statement');
t.check(/if\(fcLens === 'today'\) renderDayStatement\(\);/.test(src) && /data-fclens="today">Day statement</.test(src)
  && /<div class="ow-fc-pane" id="fc_pane_today" hidden>[\s\S]{0,400}<div id="ds_root"><\/div>/.test(src),
  'it is the Today lens of Forecasts, not a page of its own');
t.check(!/data-tab="daystatement"/.test(src) && !/id="tab-daystatement"/.test(src)
  && /if\(tab === 'daystatement'\)\{ fcLens = 'today'; return 'forecasts'; \}/.test(src),
  'and the page it briefly was is gone, its old door landing on the lens');

/* One template for an order in the group, whichever screen posts it. */
t.check(/window\.ofPostMessage = function \(qid\) \{[\s\S]{0,200}postMsg\(ofOrder\(q\), false, true\)/.test(src),
  'the order board shares its post, as its Post sheet opens it');
t.check(/const msg = text == null \|\| text === '' \? salesGroupOrderMessage\(q\)/.test(extractFunction(src, 'shareOrderToSalesGroup', 'index.html'))
  && /salesGroupOrderMessage\(q\)/.test(extractFunction(src, 'dsNoteOrderPosted', 'index.html')),
  'and posting an order from the day statement (or any announce) sends those words, not the old quote table');

/* THE RELOAD. debt_log keeps no cashTxnId, so after a reload a payment
   on the ledger has lost its receipt. It must still count, find its
   receipt again for the clock and the method, and the drift repair's
   correction rows must stay out. (Milly, 60,000 on 26 Aug, was missing.) */
{
  const milly = { id: 9, name: 'Milly', debt: 100000, debtLog: [
    { id: 1, date: today, type: 'payment', amount: 60000, note: '' },
    { id: 2, date: today, type: 'payment', amount: 5000, note: 'Balance correction — history did not add up to the balance shown' },
    { id: 3, date: today, type: 'payment', amount: 20000, note: '' },
  ] };
  data.customers.push(milly);
  data.cashTxns.push({ id: 77, date: today, type: 'receipt', account: 'momo', category: 'Debt Payment', amount: 60000, time: '14:20', description: 'Payment — Milly', quoteId: null });
  const mine = scope.dsRecords(today, today).filter(r=> r.who === 'Milly');
  const found = mine.find(r=> r.amt === 60000);
  t.check(found && found.key === 't:77' && found.t === '14:20' && found.account === 'momo',
    'a ledger payment whose receipt link was lost on reload still counts, and finds its receipt again for the time and the method');
  t.check(!mine.some(r=> r.amt === 5000), 'a balance correction is not money and stays out');
  const bare = mine.find(r=> r.amt === 20000);
  t.check(bare && bare.key === 'l:3' && bare.ref === 'Paid' && bare.t === '',
    'and a payment with no receipt to be found still shows, its time and method unknown rather than invented');
  data.customers.pop(); data.cashTxns.pop();
}

/* THE HOUR LANES stay readable on a busy day. */
{
  const body = src.slice(src.indexOf('THE CLOCK FITS THE DAY'), src.indexOf('const chartPanel', src.indexOf('THE CLOCK FITS THE DAY')));
  t.check(/const h1 = Math\.max\(18, ms\.length \? Math\.ceil\(\(Math\.max\(\.\.\.ms\) \+ 1\) \/ 60\)/.test(body),
    'the clock runs to the hour after the last record, so nothing after six is pinned to the edge');
  t.check(/for\(let k = 0; k < 3; k\+\+\)/.test(body), 'dots that would overlap take another of three rows');
  t.check(/if\(dsOpenKey !== p\.key && dsOpenKey !== o\.key\) return;/.test(body), 'and lines are drawn only for the record that is open');
  t.check(/data-ds-zoom=/.test(src) && /overflow-x:auto/.test(src.slice(src.indexOf('.ow-ds-scr{'), src.indexOf('.ow-ds-scr{') + 80)),
    'a zoom of three hours or one scrolls sideways through the day');
}

/* A LATE ENTRY sits on the day it went out, with no invented clock. */
{
  const late = compileScope([moduleSrc, 'function orderIsBackdated(q){ return String(q.date) < String(q.createdAt).slice(0, 10); }'], {
    data: { customers: [], cashTxns: [], savedQuotes: [{ id: 50, status: 'completed', invoiced: true, voided: false, amountPaid: 0, date: '2026-09-08',
      createdAt: '2026-09-28T10:00:00.000Z', client: { name: 'B110 Original' }, items: [{ productName: 'Runners', qty: 2, sellPrice: 1000 }], payments: [] }] },
    savedQuoteTotal: lineTotal, quoteItemSellPrice: (it)=> it.sellPrice, quoteClientName: (q)=> q.client.name, accountLabel: (k)=> k,
    todayISO: ()=> today, salesGroupOrderMessage: ()=> 'msg', esc: String, toast: ()=>{}, saveData: ()=>{},
    invoiceBalanceDue: (q)=> lineTotal(q) - q.amountPaid, invoiceNumberLabel: (q)=> 'INV-' + q.id,
    collectionInvoiceTxn: ()=> null, collectionLedgerRow: ()=> false, debtLogIsInvoiceOwned: ()=> false, cashIsMoneyIn: ()=> true,
  }, ['dsRecords']);
  t.check(late.dsRecords('2026-09-08', '2026-09-08').some(r=> r.key === 'q:50' && r.t === '' && /^late entry/.test(r.what))
    && !late.dsRecords(today, today).some(r=> r.key === 'q:50'),
    'a late entry sits on the day it went out, not the day it was typed in, and carries no invented time');
}

t.done();
