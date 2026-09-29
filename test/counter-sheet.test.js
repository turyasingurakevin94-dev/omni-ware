#!/usr/bin/env node
'use strict';
/*
 * The counter sale, on the order board.
 *
 * A walk-in picks from the shelf and pays there and then. The sheet was
 * designed on the Order Flow canvas and ported as drawn; its live half
 * writes the SAME records the Cash Book till always wrote for a counter
 * sale, so nothing downstream (revenue, cost of sales, the shelf, the
 * drawer, the statements) has to learn a second shape:
 *
 *   1. every hole in the sheet resolves -- picking, naming a regular, and
 *      the sold screen -- so a renamed field is a failure here, not a blank;
 *   2. a counter sale never stands in a lane: it has nothing left to do;
 *   3. Sell writes a completed, invoiced quote marked counterSale whose
 *      lines come off our shelf, takes the stock down through
 *      applyQuoteStockDeduction, and links one Sales Revenue receipt in the
 *      account it was paid into;
 *   4. On account writes no receipt and charges the regular's debt instead,
 *      and only a regular with credit terms who is not overdue can do it;
 *   5. every price says how it was reached: cost plus the markup rule.
 *
 * Run: node test/counter-sheet.test.js   (or: npm test)
 */
const vm = require('vm');
const { read, createReporter } = require('./_extract');

const t = createReporter('counter sheet');
const src = read('index.html');
const a = src.indexOf('/* ORDER-FLOW-JS:BEGIN */'), b = src.indexOf('/* ORDER-FLOW-JS:END */');
t.check(a > 0 && b > a, 'the board is found in index.html');
const block = src.slice(a, b);

const now = Date.now(), today = new Date().toISOString().slice(0, 10);
const calls = [];
const log = (name) => (...args) => { calls.push([name, args]); };
const data = {
  staff: [], cashTxns: [], nextQuoteLineId: 500,
  products: [
    { id: 'P1', name: 'Cement', retailMarkupType: 'percent', retailMarkupValue: 15 },
    { id: 'P2', name: 'Nails', retailMarkupType: 'fixed', retailMarkupValue: 1000 },
  ],
  customers: [
    { id: 'C1', name: 'Okello Works', phone: '0701', debt: 0, termsDays: 14 },
    { id: 'C2', name: 'Kasozi Hardware', phone: '0756', debt: 500000, termsDays: 7 },
    { id: 'C3', name: 'Ssali Mason', phone: '0703', debt: 0 },
  ],
  savedQuotes: [
    { id: 1, client: { name: 'Kato' }, status: 'draft', stageEnteredAt: now, items: [] },
    // yesterday's counter sale from the Cash Book till, and an overdue invoice
    { id: 2, client: { name: 'Counter sale' }, status: 'completed', invoiced: true, invoicedAt: today, invoicedTs: now - 3600e3, counterSale: true, amountPaid: 40000,
      items: [{ lineId: 1, productId: 'P1', variantIdx: null, name: 'Cement', qty: 1, sellPrice: 40000, supplierId: '__stock__' }] },
    { id: 3, client: { name: 'Kasozi Hardware' }, customerId: 'C2', status: 'completed', invoiced: true, invoicedAt: '2026-01-01', invoicedTs: now - 40 * 864e5, amountPaid: 0,
      items: [{ lineId: 2, productId: 'P2', qty: 10, sellPrice: 50000, supplierId: '__stock__' }] },
  ],
};
data.cashTxns.push({ id: 'T1', date: today, account: 'cash', type: 'receipt', category: 'Sales Revenue', amount: 40000, time: '09:12', quoteId: 2 });
const STOCK = { P1: 40, P2: 0 }, COST = { P1: 30000, P2: 4000 };
let nextId = 900;
const ctx = {
  console, Date, Math, JSON, Object, Array, String, Number, Promise, Proxy, setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {},
  document: { getElementById: (id) => id === 'tab-quote-saved' ? { style: { display: '' } } : null, querySelector: () => null, hidden: false },
  SQ_STATUSES: { draft: {}, awaiting_goods: {}, preparing: {}, pending_delivery: {}, completed: {} },
  SQ_STATUS_ORDER: ['draft', 'awaiting_goods', 'preparing', 'pending_delivery', 'completed'],
  todayISO: () => today, lsGet: () => null, lsSet() {}, toast: log('toast'),
  orderCustomerLocation: () => '', orderLineIsBoughtIn: (it) => it.supplierId && it.supplierId !== '__stock__', supplierName: (id) => id === '__stock__' ? 'Our stock' : 'Supplier ' + id,
  rankedPurchaseRowsAtQty: () => [], quoteItemSellPrice: (it) => it.sellPrice, consignedForLine: () => ({ qty: 0 }),
  itemPickAnswered: () => false, itemPickedQty: () => 0, orderIsRepeatClient: () => false,
  savedQuoteTotal: (q) => q.items.reduce((s, i) => s + i.qty * i.sellPrice, 0),
  invoiceBalanceDue: (q) => Math.max(0, q.items.reduce((s, i) => s + i.qty * i.sellPrice, 0) - (q.amountPaid || 0)),
  invoiceNumberLabel: (q) => 'INV-' + String(q.id).padStart(4, '0'),
  quoteAgedOffBoard: () => false, cashOnHandByAccount: () => ({ total: 0 }), cashCommitments: () => [], purchasePlan: () => ({ lines: [] }),
  saveData: log('saveData'), renderSavedQuotes() {},
  variantLabel: () => '', productUnitLabel: (id) => id === 'P1' ? 'Bag' : 'Kg',
  getStockQty: (id) => STOCK[id] || 0, getFIFOUnitCost: (id) => COST[id] || 0,
  rankedPriceRows: (id) => id === 'P2' ? [{ supplierId: 'S7', retail: 4200, wholesale: 4000, packUnit: 'Box', packQty: 25 }] : [],
  customerOrdersFor: (cid) => data.savedQuotes.filter((q) => q.customerId === cid),
  effectiveMarkupRule: (p) => p.retailMarkupValue ? { type: p.retailMarkupType, value: p.retailMarkupValue, source: 'product' } : null,
  effectiveStockMarkupRule: (p) => p.retailMarkupValue ? { type: p.retailMarkupType, value: p.retailMarkupValue, source: 'product' } : null,
  tillSuggestedPrice: () => null, searchTokens: (q) => String(q).split(/\s+/),
  buildProductSuggestionEntries: () => data.products.map((p) => ({ p, variantIdx: null })),
  customerOutstandingInvoices: (cid) => data.savedQuotes.filter((q) => q.customerId === cid && q.invoiced && ctx.invoiceBalanceDue(q) > 0),
  issueRowId: () => Promise.resolve(nextId++), allocRowId: () => 'T' + (nextId++),
  applyQuoteStockDeduction: (q) => { calls.push(['stock', q.id]); q.items.forEach((i) => { STOCK[i.productId] -= i.qty; }); return 0; },
  syncInvoiceDebtCharge: (q) => { calls.push(['debt', q.id]); const c = data.customers.find((x) => x.id === q.customerId); if (c) c.debt += ctx.invoiceBalanceDue(q); },
  buildQuoteRecord: (o) => ({ id: o.quoteId, client: o.client, date: o.date, items: o.items, status: 'draft', stageEnteredAt: Date.now(), invoiced: false, amountPaid: 0 }),
  printReceipt: log('printReceipt'), copyTextInTap: () => true, SALES_GROUP_WA_LINK: 'https://chat.whatsapp.com/x', open: () => ({}),
};
ctx.window = ctx; ctx.globalThis = ctx; ctx.data = data;
vm.createContext(ctx);
vm.runInContext(block + '\n;globalThis.__of = { OF_TEMPLATE };', ctx, { filename: 'order-flow-block.js' });
const { OF_TEMPLATE } = ctx.__of;
const flush = () => new Promise((r) => setImmediate(r));

/* ---------- the hole walker (as in the board's own test) ---------------- */
const toks = OF_TEMPLATE.match(/<\/?sc-(?:if|for)\b[^>]*>|\{\{[^}]+\}\}/g);
const res = (path, scope) => { path = path.trim(); if (/^(true|false|-?\d+(\.\d+)?)$/.test(path)) return 1; const ps = path.split('.'); let v; for (let i = scope.length - 1; i >= 0; i--) if (scope[i] && ps[0] in scope[i]) { v = scope[i][ps[0]]; break; } for (let k = 1; k < ps.length; k++) v = v == null ? undefined : v[ps[k]]; return v; };
const missing = new Set();
function walk(i, scope, live, label) {
  while (i < toks.length) {
    const tk = toks[i];
    if (tk.startsWith('</sc-')) return i + 1;
    if (tk.startsWith('{{')) { if (live && res(tk.slice(2, -2), scope) === undefined) missing.add(tk + ' @' + label); i++; continue; }
    const m = tk.match(/value="\{\{([^}]+)\}\}"|list="\{\{([^}]+)\}\}"/); const as = (tk.match(/as="(\w+)"/) || [])[1];
    if (tk.startsWith('<sc-if')) { const v = live ? res(m[1], scope) : undefined; if (live && v === undefined) missing.add('sc-if ' + m[1] + ' @' + label); i = walk(i + 1, scope, live && !!v, label); }
    else { const L = live ? res(m[2], scope) : undefined; if (live && !Array.isArray(L)) missing.add('sc-for ' + m[2] + ' @' + label);
      if (live && Array.isArray(L) && L.length) { let end; L.forEach((it) => { const o = {}; o[as] = it; end = walk(i + 1, scope.concat([o]), true, label); }); i = end; } else i = walk(i + 1, scope, false, label); }
  }
  return i;
}

(async () => {
  const board = new ctx.OrderFlowBoard({});
  const set = (c) => { board.state.counter = Object.assign({ cart: [], acct: 'cash', q: '', done: null }, c); return board.renderVals(); };

  /* ---------- 2. never in a lane --------------------------------------- */
  let v = board.renderVals();
  t.check(!board.state.orders.some((o) => o.qid === 2), 'a counter sale never stands in a lane');
  t.check(v.cs.badge === '1 · 0.04M', `the header counts today's counter sales, the till's too (${v.cs.badge})`);

  /* ---------- 1. every hole resolves ----------------------------------- */
  walk(0, [set({ cart: [{ item: 'Cement', qty: 2 }, { item: 'Nails', qty: 3, price: 5000 }], q: 'ce' })], true, 'selling');
  walk(0, [set({ cart: [{ item: 'Cement', qty: 1 }], naming: true, who: 'o' })], true, 'naming');
  walk(0, [set({ cart: [{ item: 'Cement', qty: 1 }], who: 'Okello Works', reg: 'Okello Works', acct: 'credit' })], true, 'regular');
  walk(0, [set({ done: { no: 'INV-0002', time: '09:12', acct: 'cash', lines: [{ item: 'Cement', qty: 1, price: 40000, unit: 'Bag' }], who: '' } })], true, 'sold');
  t.check(missing.size === 0, `every hole in the counter sheet resolves${missing.size ? ' — ' + [...missing].slice(0, 8).join(' | ') : ''}`);

  /* ---------- 5. how the price was reached ------------------------------ */
  v = set({ cart: [{ item: 'Cement', qty: 2 }, { item: 'Nails', qty: 1 }] });
  const [cem, nai] = v.cs.lines;
  t.check(cem.priceText === '34,500' && /^Cost 30,000 \+15% item rule = 34,500/.test(cem.ruleTip), `cost + the item's % rule makes the price (${cem.priceText} · ${cem.ruleTip})`);
  t.check(nai.priceText === '5,000' && /^Cost 4,000 \+1,000 item rule = 5,000/.test(nai.ruleTip), `a fixed rule adds its amount (${nai.ruleTip})`);
  t.check(nai.short && /None on shelf/.test(nai.shortText), 'a line the shelf cannot cover says so');
  t.check(v.cs.rulesUsed.length === 2 && !v.cs.hasRound, 'the sale lists the rules it used, and no rounding the app does not do');
  t.check(v.cs.marginText === 'keeps 10,000 · 16%', `and what the shop keeps (${v.cs.marginText})`);

  /* ---------- 3. Sell --------------------------------------------------- */
  calls.length = 0;
  set({ cart: [{ item: 'Cement', qty: 2 }], acct: 'momo' });
  board.csSell(board.state.counter, board.state.counter.cart, 69000);
  await flush(); await flush();
  const q = data.savedQuotes.find((x) => x.id === 900);
  const tx = data.cashTxns.find((x) => x.quoteId === 900);
  t.check(q && q.counterSale && q.invoiced && q.status === 'completed' && q.amountPaid === 69000, 'Sell writes a completed, invoiced counter sale, paid');
  t.check(q && q.items[0].supplierId === '__stock__' && q.items[0].productId === 'P1' && q.items[0].sellPrice === 34500 && q.items[0].productName === 'Cement', 'its lines come off our shelf at the price shown');
  t.check(calls.some((c) => c[0] === 'stock' && c[1] === 900) && STOCK.P1 === 38, 'the stock comes down');
  t.check(tx && tx.account === 'momo' && tx.amount === 69000 && tx.category === 'Sales Revenue' && tx.type === 'receipt', 'one Sales Revenue receipt in the account it was paid into, linked to the sale');
  t.check(board.state.counter.done && board.state.counter.done.no === 'INV-0900', 'the sold screen shows the invoice number');
  t.check(!board.state.orders.some((o) => o.qid === 900), 'and it stays off the lanes');

  /* ---------- 4. On account --------------------------------------------- */
  const txBefore = data.cashTxns.length;
  set({ cart: [{ item: 'Cement', qty: 1 }], who: 'Kasozi Hardware', reg: 'Kasozi Hardware', acct: 'credit' });
  const tiles = board.renderVals().cs.accounts.map((x) => x.name);
  t.check(tiles.includes('On account'), 'a regular with terms is offered On account');
  board.csSell(board.state.counter, board.state.counter.cart, 34500); await flush(); await flush();
  t.check(!data.savedQuotes.some((x) => x.id === 901) && calls.some((c) => c[0] === 'toast' && /overdue/.test(c[1][0])), 'but not while they are overdue');
  set({ cart: [{ item: 'Cement', qty: 1 }], who: 'Ssali Mason', reg: 'Ssali Mason', acct: 'cash' });
  t.check(!board.renderVals().cs.accounts.some((x) => x.name === 'On account'), 'a regular without terms is not');
  set({ cart: [{ item: 'Cement', qty: 1 }], who: 'Okello Works', reg: 'Okello Works', acct: 'credit' });
  board.csSell(board.state.counter, board.state.counter.cart, 34500); await flush(); await flush();
  const cq = data.savedQuotes.find((x) => x.customerId === 'C1');
  t.check(cq && cq.amountPaid === 0 && data.cashTxns.length === txBefore && data.customers[0].debt === 34500, 'On account writes no receipt and the regular owes it');

  /* ---------- a regular's usual, and counting by the pack --------------- */
  data.savedQuotes.push(
    { id: 50, customerId: 'C3', client: { name: 'Ssali Mason' }, status: 'completed', invoiced: true, invoicedTs: now - 9e8, items: [{ productId: 'P1', qty: 4, sellPrice: 34500 }] },
    { id: 51, customerId: 'C3', client: { name: 'Ssali Mason' }, status: 'completed', invoiced: true, invoicedTs: now - 8e8, items: [{ productId: 'P1', qty: 6, sellPrice: 34500 }, { productId: 'P2', qty: 1, sellPrice: 5000 }] });
  board._csUsual = null;
  v = set({ who: 'Ssali Mason', reg: 'Ssali Mason' });
  t.check(/usually buys/.test(v.cs.tilesHead) && v.cs.tiles.length === 1 && v.cs.tiles[0].item === 'Cement' && v.cs.tiles[0].usual === '×6',
    `a regular's tiles are what they buy on two visits or more, at their usual quantity (${v.cs.tilesHead}: ${v.cs.tiles.map((x) => x.item + ' ' + x.usual)})`);
  v.cs.addUsual(); await flush(); t.check(board.state.counter.cart.length === 1 && board.state.counter.cart[0].qty === 6, 'Add their usual puts it in at that quantity');
  STOCK.P2 = 100; board.csShelf();
  v = set({ cart: [{ item: 'Nails', qty: 30 }] });
  t.check(v.cs.lines[0].canSwitch && /Count in Boxes of 25/.test(v.cs.lines[0].switchTip), `an item sold by the pack can be counted in it (${v.cs.lines[0].switchTip})`);
  v.cs.lines[0].switchUnit(); await flush(); v = board.renderVals();
  t.check(v.cs.lines[0].qty === 2 && v.cs.lines[0].unit === 'Boxes' && v.cs.lines[0].priceText === '125,000', `30 kg becomes 2 boxes at 25 × the unit price (${v.cs.lines[0].qty} ${v.cs.lines[0].unit} @ ${v.cs.lines[0].priceText})`);
  board.csSell(board.state.counter, board.state.counter.cart, 250000); await flush(); await flush();
  const pl = data.savedQuotes[data.savedQuotes.length - 1].items[0];
  t.check(pl.qty === 50 && pl.sellPrice === 5000 && pl.qtyIn === 'pack' && pl.packQty === 25 && pl.packUnit === 'Box', 'sold by the box, it is recorded in kg and marked as counted by the pack, as a quote records it');

  /* ---------- Make it an order ------------------------------------------ */
  STOCK.P2 = 0; board.state.counter = null; board.csShelf();
  const n = data.savedQuotes.length;
  set({ cart: [{ item: 'Nails', qty: 3 }], who: '' });
  board.csToOrder(board.state.counter, board.state.counter.cart); await flush(); await flush();
  const oq = data.savedQuotes[data.savedQuotes.length - 1];
  t.check(data.savedQuotes.length === n + 1 && oq.status === 'draft' && !oq.counterSale && oq.client.name === 'Walk-in', 'Make it an order saves a normal order in Quoted');
  t.check(oq.items[0].supplierId === 'S7' && oq.items[0].price === 4200, 'what the shelf cannot cover is bought in from its cheapest supplier');
  board.renderVals();
  t.check(board.state.counter === null && board.state.orders.some((o) => o.qid === oq.id), 'the sheet closes and the order is on the board');

  process.exit(t.done() ? 1 : 0);
})();
