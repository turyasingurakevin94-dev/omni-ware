#!/usr/bin/env node
'use strict';
/*
 * Order tracking: the order flow board.
 *
 * The board was designed as a canvas and ported as drawn: its markup is one
 * template string with {{holes}}, <sc-if> and <sc-for>, drawn by a small
 * engine in index.html, and its drawing logic is the design's own class with
 * a live half that fills it from the books. Three things can break that
 * silently, and this file holds each of them:
 *
 *   1. the engine -- a hole that is an event must become a handler, a
 *      disabled="{{x}}" whose x is false must not disable anything, and text
 *      must be escaped;
 *   2. the template -- a hole that resolves to nothing renders as an empty
 *      string, so a renamed field is a blank on the screen, not an error.
 *      Every hole is walked, in every lane and every drawer, and must resolve;
 *   3. the live half -- the board shows each saved quote in the lane its
 *      status names, never a voided one, and AUTOPILOT ONLY MOVES: it never
 *      raises an invoice, records a payment or orders stock. Those stay taps.
 *
 * Run: node test/order-flow-board.test.js   (or: npm test)
 */
const vm = require('vm');
const { read, createReporter } = require('./_extract');

const t = createReporter('order flow board');
const src = read('index.html');
const a = src.indexOf('/* ORDER-FLOW-JS:BEGIN */'), b = src.indexOf('/* ORDER-FLOW-JS:END */');
t.check(a > 0 && b > a, 'the board is found in index.html');
const block = src.slice(a, b);

/* ---------- a stubbed shop the live half can read ---------------------- */
const calls = [];
const log = (name) => (...args) => { calls.push(name); return undefined; };
const day = 864e5, now = Date.now();
function item(lineId, name, qty, sell, buy, sup, x) {
  return Object.assign({ lineId, productId: 'P' + lineId, variantIdx: null, productName: name, qty, sellPrice: sell, price: buy,
    supplierId: sup || '__stock__', supplierName: sup ? 'Supplier ' + sup : '' }, x || {});
}
function shop() {
  return {
    staff: [{ id: 'W1', name: 'Musa Kato', role: 'worker' }, { id: 'W2', name: 'Joy Akello', role: 'worker', unavailable: true },
      { id: 'D1', name: 'Ssali Paul', role: 'delivery' }],
    savedQuotes: [
      { id: 1, client: { name: 'Kato Construction' }, status: 'draft', stageEnteredAt: now - day, items: [item(1, 'Cement', 10, 42000, 37000)] },
      { id: 2, client: { name: 'Nansubuga Homes' }, status: 'draft', stageEnteredAt: now, items: [item(2, 'Pipe', 5, 18500, 15500, 'S3')],
        supplierConfirms: { S3: { state: 'problem' } } },
      { id: 3, client: { name: 'Okello Works' }, status: 'awaiting_goods', stageEnteredAt: now - 2 * day, items: [item(3, 'Sheets', 40, 68000, 60500, 'S4')] },
      { id: 4, client: { name: 'Achieng' }, status: 'awaiting_goods', stageEnteredAt: now, boughtAt: now, items: [item(4, 'Cement', 6, 42000, 37000, 'S2', { receivedQty: 4, receivedPrice: 37000 })] },
      { id: 5, client: { name: 'Lubega Flats' }, status: 'preparing', stageEnteredAt: now, assignedWorkerId: 'W1', pickingStatus: 'in_progress',
        items: [item(5, 'Tiles', 5, 42000, 37000, null, { pickStatus: 'short', pickedQty: 3 })] },
      { id: 6, client: { name: 'Wasswa' }, status: 'preparing', stageEnteredAt: now - day, items: [item(6, 'Paint', 2, 12500, 11000, null, { pickStatus: 'done', pickedQty: 2 })],
        assignedWorkerId: 'W1', pickingStatus: 'done' },
      { id: 7, client: { name: 'Namuli Clinic' }, status: 'pending_delivery', stageEnteredAt: now, assignedDeliveryId: 'D1', items: [item(7, 'Wire', 2, 25000, 21000)] },
      { id: 8, client: { name: 'Sarah' }, status: 'completed', stageEnteredAt: now, invoiced: true, invoicedTs: now, items: [item(8, 'Sheets', 2, 68000, 60500)] },
      { id: 9, client: { name: 'Cancelled Ltd' }, status: 'draft', voided: true, stageEnteredAt: now, items: [item(9, 'Cement', 1, 42000, 37000)] },
    ],
  };
}
const ctx = {
  console, Date, Math, JSON, Object, Array, String, Number, Promise, setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {},
  /* Autopilot runs only while Order tracking is on screen, so the stub page shows it. */
  document: { getElementById: (id) => id === 'tab-quote-saved' ? { style: { display: '' } } : null, querySelector: () => null, hidden: false, activeElement: null },
  SQ_STATUSES: { draft: {}, awaiting_goods: {}, preparing: {}, pending_delivery: {}, completed: {} },
  SQ_STATUS_ORDER: ['draft', 'awaiting_goods', 'preparing', 'pending_delivery', 'completed'],
  todayISO: () => new Date().toISOString().slice(0, 10), lsGet: () => null, lsSet() {}, toast() {},
  orderCustomerLocation: (q) => ({ 'Okello Works': 'Entebbe, Wakiso' })[q.client.name] || 'Ntinda',
  orderLineIsBoughtIn: (it) => it.supplierId && it.supplierId !== '__stock__',
  supplierName: (id) => 'Supplier ' + id,
  rankedPurchaseRowsAtQty: () => [{ supplierId: 'S9', sname: 'Backup Traders', purchasePrice: 16000 }],
  quoteItemSellPrice: (it) => it.sellPrice, consignedForLine: () => ({ qty: 0 }),
  itemPickAnswered: (it) => !!it.pickStatus, itemPickedQty: (it) => it.pickStatus === 'done' ? it.qty : it.pickedQty,
  invoiceBalanceDue: (q) => q.items.reduce((s, i) => s + i.qty * i.sellPrice, 0) - (q.amountPaid || 0),
  orderIsRepeatClient: () => false, savedQuoteTotal: (q) => q.items.reduce((s, i) => s + i.qty * i.sellPrice, 0),
  quoteAgedOffBoard: () => false, cashOnHandByAccount: () => ({ total: 5000000 }),
  cashCommitments: () => [{ date: new Date(now + 9 * day).toISOString().slice(0, 10), kind: 'rent', label: 'Rent', amount: 800000 }],
  purchasePlan: () => ({ lines: [] }),
  orderDraftReady: (q) => !(q.items || []).some((i) => i.supplierId !== '__stock__'),
  orderLeaveDraft: (q) => { calls.push('orderLeaveDraft'); q.status = 'preparing'; return true; },
  orderAwaitsGoods: (q) => (q.items || []).some((i) => i.supplierId !== '__stock__' && !(Number(i.receivedQty) >= i.qty)),
  agentPaymentBlocksPreparing: () => false,
  setSavedQuoteStatus: (id, st) => { calls.push('setSavedQuoteStatus'); const q = ctx.data.savedQuotes.find((x) => x.id === id); q.status = st; },
  autoAssignNextOrder: log('autoAssignNextOrder'), saveData: log('saveData'), renderSavedQuotes() {},
  toggleQuoteInvoiced: log('toggleQuoteInvoiced'), openInvoicePaymentModal: log('openInvoicePaymentModal'),
  placeBuyOrder: log('placeBuyOrder'), orderHasPickShortfall: () => false,
};
ctx.window = ctx; ctx.globalThis = ctx;
ctx.data = shop();
vm.createContext(ctx);
vm.runInContext(block + '\n;globalThis.__of = { ofCompile, ofRenderNodes, OF_TEMPLATE };', ctx, { filename: 'order-flow-block.js' });
const { ofCompile, ofRenderNodes, OF_TEMPLATE } = ctx.__of;

/* ---------- 1. the engine ------------------------------------------------ */
{
  const render = (tpl, vals) => { const out = [], fns = []; ofRenderNodes(ofCompile(tpl).kids, [vals], out, fns); return { html: out.join(''), fns }; };
  const r1 = render('<button onClick="{{go}}" disabled="{{off}}">{{label}}</button>', { go() {}, off: false, label: '<b>&' });
  t.check(/data-of-click="0"/.test(r1.html) && r1.fns.length === 1, 'an event hole becomes a handler the delegated listener can find');
  t.check(!/disabled/.test(r1.html), 'disabled="{{x}}" with x false leaves the button enabled — the "Buy today" button was dead until this held');
  t.check(/&lt;b&gt;&amp;/.test(r1.html), 'text is escaped');
  t.check(/ disabled/.test(render('<button disabled="{{on}}"></button>', { on: true }).html), 'and with x true it disables');
  const r2 = render('<sc-for list="{{xs}}" as="x"><sc-if value="{{x.show}}"><i>{{x.n}}</i></sc-if></sc-for>', { xs: [{ show: true, n: 1 }, { show: false, n: 2 }, { show: true, n: 3 }] });
  t.check(r2.html === '<i>1</i><i>3</i>', 'sc-for binds its item and sc-if skips its body when false');
}

/* ---------- 2. every hole resolves --------------------------------------- */
{
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
  const board = new ctx.OrderFlowBoard({});
  let states = 0;
  [null, 'SO-0001', 'SO-0002', 'SO-0003', 'SO-0004', 'SO-0005', 'SO-0006', 'SO-0007', 'SO-0008'].forEach((id) => {
    board.state.openId = id;
    if (id === 'SO-0004') board.state.recv = { id, idx: 0, qty: '4', cost: '148000' }; else board.state.recv = null;
    walk(0, [board.renderVals()], true, id || 'board'); states++;
  });
  t.check(states === 9, `the board and eight drawers are walked (${states})`);
  t.check(missing.size === 0, `every hole in the template resolves${missing.size ? ' — ' + [...missing].slice(0, 8).join(' | ') : ''}`);

  /* ---------- 3. the live half ------------------------------------------- */
  const v = board.renderVals();
  const counts = v.lanes.map((l) => l.cards.length);
  t.check(JSON.stringify(counts) === JSON.stringify([2, 2, 2, 1, 1]), `each order stands in the lane its status names, and the voided one in none (${counts})`);
  t.check(v.lanes[1].cards.find((c) => c.customer === 'Okello Works').area === 'Entebbe', 'a card names the place, not the whole address');
  const short = board.state.orders.find((o) => o.id === 'SO-0005');
  t.check(short.lines[0].pk === 3 && short.pickSt === 'picking', 'a short pick reads as picked 3 of 5, still picking');
  const out = board.state.orders.find((o) => o.id === 'SO-0002');
  t.check(out.lines[0].conf === 'no' && out.lines[0].alts[0].from === 'Backup Traders', 'a supplier marked out offers the next best from the price registry');
  t.check(v.cashM === '5.00M', 'cash now is what the books hold');
  t.check(v.lanes[2].packers.length === 2 && v.lanes[2].packers[1].onStr === 'false', 'packers are the shop’s workers, and one off today is shown off');

  calls.length = 0;
  board.tick();
  const moved = ctx.data.savedQuotes.find((q) => q.id === 1).status;
  t.check(moved === 'preparing', 'autopilot moves a quote with nothing to confirm on by itself');
  t.check(ctx.data.savedQuotes.find((q) => q.id === 6).status === 'pending_delivery', 'and a packed order onto the road');
  t.check(ctx.data.savedQuotes.find((q) => q.id === 6).assignedDeliveryId === 'D1', 'with the driver who has room');
  const forbidden = calls.filter((c) => ['toggleQuoteInvoiced', 'openInvoicePaymentModal', 'placeBuyOrder'].includes(c));
  t.check(forbidden.length === 0, `autopilot never invoices, takes a payment or orders stock on its own${forbidden.length ? ' — called ' + forbidden.join(', ') : ''}`);
}

process.exit(t.done() ? 1 : 0);
