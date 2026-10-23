#!/usr/bin/env node
'use strict';
/*
 * The console asks the Checking gate before it moves an order out of
 * Checking (0119_shared_foundation.sql holds the same gate in the
 * database). Asked first so the board never shows a move the server then
 * keeps back:
 *
 *   price    a salesperson's price under the shop's waits for the
 *            Manager's yes at the price and quantity the line stands at
 *   credit   an order that takes the customer over their limit waits
 *            until the Manager says Release (creditCheck)
 *
 * and the console keeps, on every save, the keys the phone apps and the
 * server write -- a key not named in buildSyncRows is stripped.
 *
 * Run: node test/console-checking-gate.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('the console\'s Checking gate');
const src = read('index.html');

const data = { customers: [{ id: 'C001', name: 'Kato Construction', debt: 500000, creditLimit: 1000000 }] };
const toasts = [];
const moved = [];
const env = {
  data,
  // 37,500 a bag: the shop's 25% on 30,000.
  quoteItemSellPrice: (it) => (Number(it.sellPrice) > 0 ? Number(it.sellPrice) : Number(it.price) * 1.25),
  savedQuoteTotal: (q) => (q.items || []).reduce((s, it) => s + Number(it.qty) * env.quoteItemSellPrice(it), 0),
  toast: (m) => toasts.push(m),
};
const { orderCheckingGate } = compileScope([extractFunction(src, 'orderCheckingGate', 'index.html')], env, ['orderCheckingGate']);

const under = { lineId: 'L1', productId: 'P1', qty: 2, price: 30000, sellPrice: 35000, priceBy: 'GA', priceNote: 'under', supplierId: 'S1' };
t.check(orderCheckingGate({ items: [{ ...under }] }) === 'price', 'a price under the shop\'s holds the order');
t.check(orderCheckingGate({ items: [{ ...under, priceReview: { price: 35000, qty: 2 } }] }) === null, 'the Manager\'s yes at that price and quantity opens it');
t.check(orderCheckingGate({ items: [{ ...under, qty: 5, priceReview: { price: 35000, qty: 2 } }] }) === 'price', 'a yes for 2 does not cover 5');
t.check(orderCheckingGate({ items: [{ ...under, sellPrice: 34000, priceReview: { price: 35000, qty: 2 } }] }) === 'price', 'nor a yes for another price');
t.check(orderCheckingGate({ items: [{ ...under, priceBy: null }] }) === null, 'a price nobody set by hand is the shop\'s own');
t.check(orderCheckingGate({ items: [{ ...under, priceNote: 'over' }] }) === null, 'a price over the shop\'s needs nobody');

const big = { customerId: 'C001', items: [{ productId: 'P1', qty: 20, price: 30000, supplierId: 'S1' }] };
t.check(orderCheckingGate(big) === 'credit', '750,000 more on 500,000 owed goes over a 1,000,000 limit');
t.check(orderCheckingGate({ ...big, creditCheck: { decision: 'hold' } }) === 'credit', 'Hold keeps it');
t.check(orderCheckingGate({ ...big, creditCheck: { decision: 'release' } }) === null, 'Release opens it');
t.check(orderCheckingGate({ ...big, amountPaid: 300000 }) === null, 'money paid up front counts');
t.check(orderCheckingGate({ ...big, items: [{ ...big.items[0], qty: 4 }] }) === null, 'inside the limit goes through');

/* setSavedQuoteStatus and orderLeaveDraft ask it */
{
  const set = extractFunction(src, 'setSavedQuoteStatus', 'index.html');
  t.check(/q\.status==='draft' && status!=='draft'[\s\S]{0,120}orderCheckingGate\(q\)/.test(set) && /toast\(held==='price'/.test(set),
    'setSavedQuoteStatus asks the gate before an order leaves Checking, and says why');
  const leave = extractFunction(src, 'orderLeaveDraft', 'index.html');
  t.check(/orderCheckingGate\(q\)\) return false;/.test(leave), 'the automatic move out of Checking asks it too');
}

/* the console invoices through the server (invoice_order, 0119) */
{
  const tog = extractFunction(src, 'toggleQuoteInvoiced', 'index.html');
  // 0165 (Sales round 1): the console no longer invoices for itself, even where 0119 is missing.
  t.check(/if\(!q\.invoiced\)\{[\s\S]{0,200}if\(\(await invoiceOnServer\(q\)\) === 'missing'\) toast\([\s\S]{0,160}return;\s*\}/.test(tog),
    'the console\'s Invoice goes to the server only, and never invoices for itself');
  t.check(tog.indexOf('invoiceOnServer(q)') < tog.indexOf('q.invoiced = !q.invoiced'), 'asked before anything changes here');
  const srv = extractFunction(src, 'invoiceOnServer', 'index.html');
  t.check(/navigator\.onLine === false[\s\S]{0,200}return 'refused'/.test(srv), 'offline it waits, rather than invoicing a copy the server may already have invoiced');
  t.check(srv.indexOf('await saveData()') < srv.indexOf("rpc('invoice_order'"), 'this copy goes up first, so the order is invoiced as it stands here');
  t.check(/rpc\('invoice_order', \{ p_shop_id: currentShopId, p_quote_id: q\.id \}\)/.test(srv), 'by the same function the Manager and the 24-hour run use');
  t.check(/error\.code === 'PGRST202' \|\| error\.code === '42883'\) return 'missing'/.test(srv), 'a database without 0119 is the only fall-back');
  t.check(/pollForUpdatesNow\(\{ force: true \}\)/.test(srv), 'then the shop is read back');
  t.check(!/q\.invoiced\s*=/.test(srv), 'without marking this copy first -- the read-back\'s save would send it up over the server\'s invoice');
  const batch = extractFunction(src, 'invoicePickedOrders', 'index.html');
  t.check(/const now = data\.savedQuotes\.find\(x=> x\.id === q\.id\);\s+if\(now && now\.invoiced\)/.test(batch), 'and the batch counts what is invoiced from the fresh copy, by id');
  const poll = extractFunction(src, 'pollForUpdatesNow', 'index.html');
  t.check(/const force = !!\(opts && opts\.force\);/.test(poll) && /if\(!force\)\{\s+if\(document\.querySelector\('\.modal-overlay\.show'\)\) return;/.test(poll),
    'that read-back is not held off by the hands-on-the-screen guards');
  t.check(/if\(pollInFlight\) return;\s+[\s\S]{0,600}if\(syncSavesInFlight\) return;/.test(poll), 'and still never runs over a refresh or a save');
}

/* the keys the console must not strip */
{
  const at = src.indexOf('savedQuotes: d.savedQuotes.map(q=>({');
  const block = src.slice(at, src.indexOf('purchaseInvoices: d.purchaseInvoices.map', at));
  for (const k of ['creditCheck', 'costAsked', 'pickSettle', 'takenBy', 'counter', 'gateHeldMove', 'invoicedBy']) {
    t.check(new RegExp(`\\.\\.\\.\\(q\\.${k} \\? \\{${k}:(q\\.${k}|true)\\} : \\{\\}\\)`).test(block), `a save keeps ${k}`);
  }
}

process.exit(t.done() ? 1 : 0);
