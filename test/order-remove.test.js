#!/usr/bin/env node
'use strict';
/*
 * Taking an order off the board: cancel, delete, void.
 *
 * The order panel's "⋯" offers all three and greys out the ones that do not
 * fit, with the reason. Each is handed to the function that already owns
 * it, so the books stay right:
 *
 *   cancel -> cancelSavedQuote     the record stays, voided and marked
 *   delete -> deleteSavedQuote     only before anything is bought or paid
 *   void   -> toggleInvoiceVoided  only once it is invoiced
 *
 * The board's own sheet asks first and lists what will happen, so the
 * browser confirm those functions raise is answered for them -- once, and
 * put back straight after.
 *
 * Run: node test/order-remove.test.js   (or: npm test)
 */
const vm = require('vm');
const { read, createReporter } = require('./_extract');

const t = createReporter('order remove');
const src = read('index.html');
const a = src.indexOf('/* ORDER-FLOW-JS:BEGIN */'), b = src.indexOf('/* ORDER-FLOW-JS:END */');
const block = src.slice(a, b);
const now = Date.now();
const item = (id, sup, x) => Object.assign({ lineId: id, productId: 'P' + id, productName: 'Item ' + id, qty: 2, sellPrice: 10000, price: 8000, supplierId: sup || '__stock__' }, x || {});
const data = { staff: [], cashTxns: [], savedQuotes: [
  { id: 1, client: { name: 'Clean Draft' }, status: 'draft', stageEnteredAt: now, items: [item(1)] },
  { id: 2, client: { name: 'Bought In' }, status: 'awaiting_goods', stageEnteredAt: now, boughtAt: now, items: [item(2, 'S1', { receivedQty: 2, receivedPrice: 8000 })] },
  { id: 3, client: { name: 'Invoiced Ltd' }, status: 'completed', stageEnteredAt: now, invoiced: true, invoicedTs: now, amountPaid: 5000, items: [item(3)] },
] };
const calls = [];
let confirmSeen = null;
const ctx = {
  console, Date, Math, JSON, Object, Array, String, Number, Promise, Proxy, setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {},
  document: { getElementById: (id) => id === 'tab-quote-saved' ? { style: { display: '' } } : null, querySelector: () => null, hidden: false },
  SQ_STATUSES: { draft: {}, awaiting_goods: {}, preparing: {}, pending_delivery: {}, completed: {} },
  SQ_STATUS_ORDER: ['draft', 'awaiting_goods', 'preparing', 'pending_delivery', 'completed'],
  todayISO: () => '2026-09-29', lsGet: () => null, lsSet() {}, toast: (m) => calls.push(['toast', m]),
  orderCustomerLocation: () => '', orderLineIsBoughtIn: (it) => it.supplierId !== '__stock__', supplierName: (id) => 'Supplier ' + id,
  rankedPurchaseRowsAtQty: () => [], quoteItemSellPrice: (it) => it.sellPrice, consignedForLine: () => ({ qty: 0 }),
  itemPickAnswered: () => false, itemPickedQty: () => 0, orderIsRepeatClient: () => false,
  savedQuoteTotal: (q) => q.items.reduce((s, i) => s + i.qty * i.sellPrice, 0),
  invoiceBalanceDue: (q) => q.items.reduce((s, i) => s + i.qty * i.sellPrice, 0) - (q.amountPaid || 0),
  invoiceNumberLabel: (q) => 'INV-' + String(q.id).padStart(4, '0'),
  quoteAgedOffBoard: () => false, cashOnHandByAccount: () => ({ total: 0 }), cashCommitments: () => [], purchasePlan: () => ({ lines: [] }),
  saveData() {}, renderSavedQuotes() {},
  // The three owners. Each asks the browser, as the real ones do.
  cancelSavedQuote: (id) => { confirmSeen = ctx.window.confirm('Cancel?'); calls.push(['cancel', id]); const q = data.savedQuotes.find((x) => x.id === id); q.voided = true; q.cancelledAt = now; },
  deleteSavedQuote: (id) => { confirmSeen = ctx.window.confirm('Delete?'); calls.push(['delete', id]); data.savedQuotes = data.savedQuotes.filter((x) => x.id !== id); ctx.data.savedQuotes = data.savedQuotes; },
  toggleInvoiceVoided: (id) => { confirmSeen = ctx.window.confirm('Void?'); calls.push(['void', id]); data.savedQuotes.find((x) => x.id === id).voided = true; },
};
ctx.window = ctx; ctx.globalThis = ctx; ctx.data = data;
const realConfirm = () => { throw new Error('the browser was asked again'); };
ctx.confirm = realConfirm;
vm.createContext(ctx);
vm.runInContext(block, ctx, { filename: 'order-flow-block.js' });

const board = new ctx.OrderFlowBoard({});
const menu = (id) => { board.state.openId = id; board.state.menu = id; return board.renderVals().om.items.reduce((o, x) => { o[x.label] = x.offStr === 'false'; return o; }, {}); };
const m1 = menu('SO-0001'), m2 = menu('SO-0002'), m3 = menu('SO-0003');
t.check(m1['Cancel order'] && m1.Delete && !m1['Void invoice'], 'a clean draft can be cancelled or deleted');
t.check(m2['Cancel order'] && !m2.Delete && !m2['Void invoice'], 'an order with goods bought and in can only be cancelled');
t.check(!m3['Cancel order'] && !m3.Delete && m3['Void invoice'], 'an invoiced order can only be voided');

board.state.removing = { id: 'SO-0002', kind: 'cancel' };
const eff = board.renderVals().rm.effects.map((e) => e.text).join(' | ');
t.check(/Supplier billed for what already came in/.test(eff) && /record stays/.test(eff), `cancelling says what gets billed and that the record stays (${eff})`);
board.state.removing = { id: 'SO-0003', kind: 'void' };
const vf = board.renderVals().rm.effects.map((e) => e.text + ' ' + e.fig).join(' | ');
t.check(/goods stay off the shelf/.test(vf) && /Money received stays in the Cash Book/.test(vf) && /debt/.test(vf), `voiding says it cancels the bill, not the sale (${vf})`);

board.renderVals();
board.removeOrder('SO-0001', 'delete');
t.check(calls.some((c) => c[0] === 'delete' && c[1] === 1) && confirmSeen === true, 'Delete goes through deleteSavedQuote, its confirm answered by the board');
board.renderVals();
board.removeOrder('SO-0002', 'cancel');
t.check(calls.some((c) => c[0] === 'cancel' && c[1] === 2), 'Cancel goes through cancelSavedQuote');
board.renderVals();
board.removeOrder('SO-0003', 'delete');
t.check(!calls.some((c) => c[0] === 'delete' && c[1] === 3), 'an invoiced order is never deleted from the board');
board.removeOrder('SO-0003', 'void');
t.check(calls.some((c) => c[0] === 'void' && c[1] === 3), 'Void goes through toggleInvoiceVoided');
t.check(ctx.confirm === realConfirm, 'and the browser confirm is put back afterwards');
board.renderVals();
t.check(board.state.orders.length === 0, 'all three leave the board');

process.exit(t.done() ? 1 : 0);
