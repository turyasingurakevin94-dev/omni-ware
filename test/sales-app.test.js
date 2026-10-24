#!/usr/bin/env node
'use strict';
/*
 * The Sales app (sales.html): its prices must be the owner's prices, and
 * what it writes must be what the owner's app reads.
 *
 *   1. Parity. sales.html carries its own copy of the pricing chain
 *      (quoteItemSellPrice and what it leans on) and of the order totals,
 *      because it is a separate page. Both copies run here through one
 *      matrix of lines -- shelf and bought-in, loose and by the pack,
 *      variant, product and shop-default rules, percent and fixed, with
 *      and without credit -- and must agree to the shilling.
 *   2. Never at cost. A line with no markup rule is "price to confirm",
 *      left out of the total and counted, not quoted at the shop's cost.
 *   3. Placing an order writes one saved_quotes row with the exact columns
 *      and payload keys the admin's loadData maps -- at Checking, or straight
 *      at Packing when every line is on our shelf and nothing waits for the
 *      Manager (docs/decision-rights.md, "Orders that need nothing from a
 *      supplier").
 *   4. Taking a payment spreads it over open bills oldest first, as
 *      recordCustomerPayment does: a receipt per bill, the bill's payments
 *      and amount_paid, the debt brought down with an Auto-sync line, and
 *      whatever is left lowering the loose balance -- never raising one.
 *
 * Runs the page's real script in a sandbox with a fake database; nothing
 * is copied into this file.
 *
 * Run: node test/sales-app.test.js   (or: npm test)
 */
const vm = require('vm');
const { read, extractFunction, compileScope, createReporter } = require('./_extract');
const fakeReceivePayment = require('./_fake-receive-payment');

const t = createReporter('sales app');
const html = read('sales.html');
const adminSrc = read('index.html');

/* ---------------- the fixture: one small shop ---------------- */
const SH = 'shop1';
function fixture(){
  return {
    suppliers: [{ id: 'S1', name: 'Mulongo' }, { id: 'S2', name: 'Nsubuga' }],
    customers: [{ id: 'C001', name: 'Kato Construction', phone: '0772123456', phone2: '', location: 'Nansana', notes: '', debt: 500000, termsDays: null, creditLimit: null, debtLog: [{ id: 5 }] }],
    staff: [],
    products: [
      { id: 'P1', name: 'Cement', variants: [], retailMarkupType: 'percent', retailMarkupValue: 0, wholesaleMarkupType: 'percent', wholesaleMarkupValue: 0, stockRetailMarkupType: 'fixed', stockRetailMarkupValue: 2500, stockWholesaleMarkupType: 'percent', stockWholesaleMarkupValue: 0 },
      { id: 'P2', name: 'Iron sheets', variants: [{ combo: { g: 'G28' }, retailMarkupType: 'percent', retailMarkupValue: 12 }, { combo: { g: 'G30' } }], retailMarkupType: 'percent', retailMarkupValue: 0, wholesaleMarkupType: 'fixed', wholesaleMarkupValue: 20000, stockRetailMarkupValue: 0, stockWholesaleMarkupValue: 0 },
      { id: 'P3', name: 'Nails', variants: [], retailMarkupValue: 0, wholesaleMarkupValue: 0, stockRetailMarkupValue: 0, stockWholesaleMarkupValue: 0 },
    ],
    prices: [
      { id: 1, productId: 'P1', variantIdx: null, supplierId: 'S1', wholesale: null, retail: 32000, unit: 'bag', packUnit: '', packQty: 0, tiers: [] },
      { id: 2, productId: 'P2', variantIdx: 0, supplierId: 'S2', wholesale: 300000, retail: 33000, unit: 'sheet', packUnit: 'bundle', packQty: 10, tiers: [{ minQty: 30, price: 280000 }, { minQty: 5, price: 31000 }] },
      { id: 3, productId: 'P2', variantIdx: 1, supplierId: 'S2', wholesale: null, retail: 27000, unit: 'sheet', packUnit: 'bundle', packQty: 10, tiers: [] },
      { id: 4, productId: 'P3', variantIdx: null, supplierId: 'S1', wholesale: 90000, retail: null, unit: 'kg', packUnit: 'carton', packQty: 25, tiers: [] },
    ],
    stock: { P1: 40 }, stockLots: { P1: [{ qty: 40, cost: 31000 }] },
    savedQuotes: [], productLinks: [], cashTxns: [{ id: 11 }],
    presetCreditPct: 3, presetDefaultMarkup: { retailType: 'percent', retailValue: 15, wholesaleType: 'percent', wholesaleValue: 0 },
    presetChaseAfterDays: 30, presetCategories: [],
  };
}

/* ---------------- the page, in a sandbox ---------------- */
function loadPage(db){
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  const app = scripts.find(s => s.includes('function quoteItemSellPrice'));
  if (!app) throw new Error('sales.html has no app script');
  const el = () => ({ innerHTML: '', children: [], style: {}, dataset: {}, classList: { add() {}, remove() {} }, setAttribute() {}, querySelector: () => null, querySelectorAll: () => [], appendChild() {} });
  const store = {};
  const sandbox = {
    console, setTimeout, clearTimeout, setInterval: () => 0, requestAnimationFrame: () => 0, Promise, Date, Math, JSON, URLSearchParams, encodeURIComponent,
    location: { hostname: 'localhost', hash: '', reload() {} },
    localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
    document: { getElementById: el, querySelector: () => null, querySelectorAll: () => [], addEventListener() {}, createElement: el, body: { appendChild() {}, style: {} }, visibilityState: 'visible' },
    supabase: { createClient: () => db },
  };
  sandbox.window = sandbox; sandbox.window.open = () => {};
  vm.createContext(sandbox);
  // boot() waits on getUser, which this fake never answers: the page stays
  // unbooted and the test drives it.
  vm.runInContext(app + '\n;globalThis.__x = { S, ACT, PAGE, nwCatMark, nwAskPick, tdySrcRow, chatReads, tdyFoundHTML, myGivenName, payBarParts, payView, payNorm, payDockHTML, payPaperHTML, payChange, payOverHTML, nmIsSale, custInFilter, qaIn, lineById, lineQtyWords, nwCreditHeld, qtyBack, qtyBackHTML, creditHoldFor, custAddsUp, custAddsUpHTML, getFIFOUnitCost, stockKey, goodsTotal, lineSettledOut, moneyIn, tdyToPriceChip, ordPatch, sb, payDepositOk, payNeedsWho, phoneOk, phoneState, nwSubOf, nwFindHTML, nwMiniDock, ordWhoHas, ordViews, ctHeroHTML, rowToQuote, ctRowFor, ctSell, ctKeepLocal, ctLand, counterDockHTML, draftQuote, n0, srcMatch, rowToLead, newDraft, mgrName, priceReviewState, priceToTell, priceTagHTML, quoteItemSellPrice, quoteTotal, pricedView, linePriceToConfirm, makeLine, payPlan, viewToday, viewOrders, viewCustomers, viewMe, priceTooLow, priceNoteFor, shopSellPrice, chatSaid, chatCanSend, chatKind, chatWhyNot, chatPriceLine, chatSender, shelfAvailable, heldForOrders, custAging, custOpenCharges, custOldestAge, custOldestOrNull, custDebtBands, custState, orderDue, pricedLive, nmPaidWord, ordStampHTML, ordViews, ordPaperLine, ordPictureRows, linePackOnly, bandHTML, salesTarget, nwSearch, nwPlacedNote, ordGateHTML, ordPaperHead, orderRow, ordPriceUpHTML, linePriceUp, lineBelowCost, pricesWaiting, viewOrders, supplierTerms, qtyText, orderExtraRows, nwPriceState, custNearNames, startFor, addLine, lineQtyWords, customerById, WA_WAIT_MAX_MINS, nearMarked, custNcNameCheck, ordMadeOf, ordStampHTML, SHEET, openSheet, ordAnswersHTML, custInQuestion, custTakeable, custStageRing, custMovingPaper, custDidYouMean, nwMovingDue, nwOwesChip, nwApplyHabit, nwDockHTML, nwWholeUnit, setLineQty, paySum, paySumRows, payRefOf, payRpc, needsYou, NW, ctGivenChoices, lineById, saveDraft, payReceiptText, nwOutChip, nwFocus, custNcPreview, custNcReady, ordStage, ordChipsHTML, qtyJumps, parseQuery, ctChangeHTML, sliderHTML, orderRow, custNcNameHit, tdyAskCard, ordFindRows };', sandbox);
  return sandbox.__x;
}
function fakeDb(tables){
  const writes = [], ids = { 'row:saved_quote': 0, 'row:cash_txn': 0, 'row:debt_log': 0 }; let custN = 1;
  function Q(table){ this.t = table; this.f = []; this.op = 'select'; this.one = false; }
  Q.prototype.select = function(){ return this; };
  Q.prototype.eq = function(k, v){ this.f.push(r => String(r[k]) === String(v)); return this; };
  Q.prototype.gt = Q.prototype.gte = Q.prototype.order = Q.prototype.limit = function(){ return this; };
  Q.prototype.maybeSingle = function(){ this.one = true; return this; };
  Q.prototype.insert = function(row){ this.op = 'insert'; this.row = row; return this; };
  Q.prototype.update = function(row){ this.op = 'update'; this.row = row; return this; };
  Q.prototype.then = function(res, rej){
    const rows = tables[this.t] || (tables[this.t] = []);
    const clone = x => JSON.parse(JSON.stringify(x));
    if (this.op === 'insert') { writes.push(['insert', this.t, clone(this.row)]); rows.push(clone(this.row)); return Promise.resolve({ error: null }).then(res, rej); }
    const hit = rows.filter(r => this.f.every(f => f(r)));
    if (this.op === 'update') { writes.push(['update', this.t, clone(this.row), hit.map(r => r.id)]); hit.forEach(r => Object.assign(r, clone(this.row))); return Promise.resolve({ error: null }).then(res, rej); }
    return Promise.resolve({ data: clone(this.one ? (hit[0] || null) : hit), error: null }).then(res, rej);
  };
  return { writes, tables,
    auth: { getUser: () => new Promise(() => {}), getSession: async () => ({ data: { session: null } }), signOut: async () => ({}) },
    from: t => new Q(t),
    rpc: async (fn, a) => {
      if (fn === 'next_row_id_blocks') { const k = a.p_kinds[0]; ids[k] = Math.max(ids[k], Number(a.p_floors[k]) || 0) + 1; return { data: { [k]: ids[k] }, error: null }; }
      if (fn === 'invoice_order') { const q = (tables.saved_quotes || []).find(r => Number(r.id) === Number(a.p_quote_id)); writes.push(['rpc', fn, a]); if (!q || q.status !== 'completed') return { data: null, error: { message: 'Only a delivered order is invoiced.' } }; q.invoiced = true; return { data: { ok: true, invoice: 'INV-' + String(q.id).padStart(4, '0') }, error: null }; }
      if (fn === 'next_entity_id') return { data: 'C' + String(++custN).padStart(3, '0'), error: null };
      // 0140 receive_payment, as the database does it (test/_fake-receive-payment.js).
      if (fn === 'receive_payment') { writes.push(['rpc', fn, a]); return fakeReceivePayment(tables, writes, k => ++ids[k], a, 'u1'); }
      // 0136 counter_sale, as the database does it: one write places, pays and invoices; a short shelf or a price under the shop's refuses or waits.
      if (fn === 'counter_sale') {
        writes.push(['rpc', fn, a]);
        const row = a.p_row, items = (row && row.payload && row.payload.items) || [];
        if (a.p_quote_id == null && !row) return { data: null, error: { message: 'Nothing to sell.' } };
        if (items.some(it => it.supplierId !== '__stock__')) return { data: null, error: { message: 'A counter sale is only for goods on the shelf.' } };
        const id = ++ids['row:saved_quote'];
        if (items.some(it => it.priceBy && ['under', 'nomargin', 'nocost'].includes(it.priceNote))) { tables.saved_quotes.push({ id, shop_id: a.p_shop_id, status: 'draft', invoiced: false, amount_paid: 0, payload: { ...row.payload, counter: true } }); return { data: { ok: true, waiting: 'price', id }, error: null }; }
        const total = items.reduce((t, it) => t + (Number(it.qty) || 0) * (Number(it.sellPrice) || 0), 0), cashId = ++ids['row:cash_txn'];
        tables.cash_txns.push({ id: cashId, shop_id: a.p_shop_id, type: 'receipt', category: 'Sales Revenue', account: a.p_method, amount: total, quote_id: id });
        tables.saved_quotes.push({ id, shop_id: a.p_shop_id, status: 'completed', invoiced: true, amount_paid: total, payload: { ...row.payload, counter: true, payments: [{ id: 1, amount: total, cashTxnId: cashId, method: a.p_method }] } });
        return { data: { ok: true, id, invoice: 'INV-' + String(id).padStart(4, '0'), total, pay: total, cashTxnId: cashId, change: Math.max(0, (Number(a.p_given) || 0) - total), invoiced: true }, error: null };
      }
      return { data: null, error: { message: 'no such rpc' } };
    } };
}

/* ---------------- 1. parity with the owner's app ---------------- */
const adminNames = ['quoteItemSellPrice', 'productPriceRows', 'effectiveMarkupRule', 'effectiveStockMarkupRule', 'sellSideFor', 'purchaseSideAtQty',
  'tieredUnitPrice', 'tiersForKind', 'quoteSuggestedPrice', 'quoteSuggestedStockPrice', 'suggestedSellingPrice', 'suggestedStockSellingPrice',
  'savedQuoteGoodsTotal', 'savedQuoteCashTotal', 'orderCreditCharge', 'orderCreditTerms', 'savedQuoteTotal', 'orderChargesTotal', 'orderCharges', 'chargeAmount'];
const adminData = fixture();
const admin = compileScope(adminNames.map(n => extractFunction(adminSrc, n, 'index.html')),
  { data: adminData, supplierName: id => id }, ['quoteItemSellPrice', 'savedQuoteTotal']);

const db0 = fakeDb({});
const P = loadPage(db0);
P.S.data = fixture(); P.S.shopId = SH; P.S.user = { id: 'u1' };

const line = (pid, vi, qty, supplierId, price, extra) => ({ lineId: 1, productId: pid, variantIdx: vi, productName: pid, unit: '', packUnit: '', packQty: pid === 'P2' || pid === 'P3' ? (pid === 'P2' ? 10 : 25) : 0, qty, supplierId, price, sellPrice: null, ...(extra || {}) });
const matrix = [
  ['shelf line, stock fixed rule', line('P1', null, 10, '__stock__', 31000)],
  ['bought-in, shop default %', line('P1', null, 3, 'S1', 32000)],
  ['variant rule, loose', line('P2', 0, 4, 'S2', 33000)],
  ['variant, by the pack (product fixed wholesale)', line('P2', 0, 20, 'S2', 30000)],
  ['variant without its own rule, loose', line('P2', 1, 6, 'S2', 27000)],
  ['carton-only row under a carton', line('P3', null, 10, 'S1', 3600)],
  ['typed sell price wins', line('P1', null, 2, 'S1', 32000, { sellPrice: 41000 })],
  ['unknown product', line('PX', null, 2, 'S1', 5000)],
];
// Sales round 1 (SAL-007): a line nobody priced is priced at nothing, never at
// its cost, as 0165's ow_order_total does; every priced line still matches.
matrix.forEach(([what, it]) => {
  const a = P.linePriceToConfirm(it) ? 0 : admin.quoteItemSellPrice(it), s = P.quoteItemSellPrice(it);
  t.check(Math.abs(a - s) < 1e-9, `sell price matches the owner's app, or 0 when nobody priced it: ${what} (${a} vs ${s})`);
});
t.check(P.linePriceToConfirm(matrix[5][1]) && P.quoteItemSellPrice(matrix[5][1]) === 0 && P.quoteItemSellPrice(matrix[7][1]) === 0, 'a line with no rule, or no product, is never priced at its cost');
[[null, 'cash'], [{ pct: 3, days: 30 }, 'credit']].forEach(([credit, word]) => {
  const priced = matrix.slice(0, 7).map(m => m[1]).filter(it => !P.linePriceToConfirm(it));
  const a = admin.savedQuoteTotal({ items: priced, charges: [], credit }), s = P.quoteTotal({ items: matrix.slice(0, 7).map(m => m[1]), charges: [], credit });
  t.check(Math.abs(a - s) < 1, `order total matches the owner's app on ${word}, over the priced lines (${a} vs ${s})`);
});

/* ---------------- 2. never at cost ---------------- */
{
  const noRule = line('P3', null, 30, 'S1', 3600);
  P.S.data.presetDefaultMarkup = {};
  t.check(P.linePriceToConfirm(noRule), 'a line with no markup rule is "price to confirm"');
  const pv = P.pricedView({ items: [line('P1', null, 10, '__stock__', 31000), noRule], charges: [] });
  t.check(pv.toConfirm === 1 && pv.total === 10 * 33500, 'the total leaves the line out and counts it, rather than pricing it at cost');
  const made = P.makeLine('P3', null, 30, {});
  t.check(made && made.sellPrice == null, 'a new line with no rule carries no sell price to be read as cost');
  P.S.data.presetDefaultMarkup = fixture().presetDefaultMarkup;
}

/* ---------------- 2b: the Manager's answer on a price ---------------- */
{
  P.S.data.members = [{ user_id: 'm1', role: 'manager' }];
  P.S.data.staff = [{ id: 7, name: 'Ruth Nakato', userId: 'm1', role: 'manager' }];
  t.check(P.mgrName() === 'Ruth', 'the Manager is named by their staff record');
  const base = { productId: 'P1', qty: 2, sellPrice: 165000, priceBy: 'u1', priceNote: 'under', priceShop: 172000 };
  t.check(P.priceReviewState(base) === 'wait', 'a price under the shop\'s waits for the Manager');
  t.check(P.priceReviewState({ ...base, priceNote: 'nocost' }) === null, 'a price with no cost yet is not the Manager\'s to decide first');
  {
    // Once the Manager prices a no-cost line (manager.html ncgo writes sellPrice and the review), Sales reads it as decided.
    const nc = { ...base, priceNote: 'nocost', priceAsk: true, sellPrice: 51000, priceReview: { state: 'changed', price: 51000, was: 0, qty: 2, byName: 'Ruth Nakato', at: 1 } };
    t.check(P.priceReviewState(nc) === 'changed' && P.priceToTell(nc) && /Ruth set/.test(P.priceTagHTML(nc, true)) && !/to be confirmed/.test(P.priceTagHTML(nc)),
      'a no-cost line the Manager has priced shows the Manager\'s price, and is one to tell the customer');
    t.check(P.priceReviewState({ ...nc, sellPrice: 50000 }) === null, 'and goes back to "to be confirmed" if the price moves after');
  }
  t.check(P.priceReviewState({ ...base, priceReview: { state: 'approved', price: 165000, byName: 'Ruth Nakato', at: 1 } }) === 'approved', 'approved at the figure it names');
  const changed = { ...base, sellPrice: 172000, priceReview: { state: 'changed', price: 172000, was: 165000, byName: 'Ruth Nakato', at: '2026-10-17T12:31:00Z' } };
  t.check(P.priceReviewState(changed) === 'changed' && P.priceToTell(changed), 'the Manager\'s new price is one to tell the customer');
  t.check(!P.priceToTell({ ...changed, priceToldAt: '2026-10-17T12:33:00Z' }), 'once told, it is not asked again');
  t.check(P.priceReviewState({ ...changed, sellPrice: 170000 }) === 'wait', 'a decision goes stale when the price changes after it');
  t.check(/waiting for Ruth/.test(P.priceTagHTML(base, true)) && /Ruth set/.test(P.priceTagHTML(changed, true)) && !/owner/.test(P.priceTagHTML(base) + P.priceTagHTML(base, true)), 'the tag names the Manager, never the owner');
  P.S.data.members = []; P.S.data.staff = [];
  t.check(P.mgrName() === 'the Manager', 'with no manager on the shop, it says "the Manager"');
}

/* ---------------- 3 & 4: the writes ---------------- */
(async () => {
  // 3. placing an order
  {
    const db = fakeDb({ saved_quotes: [] });
    const X = loadPage(db);
    Object.assign(X.S, { data: fixture(), shopId: SH, user: { id: 'u1' } });
    X.S.data.savedQuotes = [{ id: 41 }];
    const it = X.makeLine('P1', null, 10, { lineId: 1 });
    // SAL-016: credit within a set limit goes straight on (with no limit set it waits for the Manager; checked below).
    X.S.data.customers.find(c => c.id === 'C001').creditLimit = 3000000;
    X.S.draft = { client: { name: 'Kato Construction', phone: '0772123456' }, customerId: 'C001', items: [it], credit: true, q: '' };
    await X.ACT['slide:place']({ querySelector: () => ({ textContent: '' }) });
    const ins = db.writes.filter(w => w[0] === 'insert' && w[1] === 'saved_quotes');
    t.check(ins.length === 1, 'placing writes one saved_quotes row');
    const row = ins[0] && ins[0][2];
    if (row) {
      t.check(row.id === 42, 'the id is the server\'s, above every order on the phone');
      t.check(row.status === 'preparing' && row.invoiced === false && row.voided === false && row.amount_paid === 0, 'all from our shelf, it lands at Packing, not invoiced, nothing paid');
      t.check(row.shop_id === SH && row.client_name === 'Kato Construction' && row.date, 'the row columns the admin reads are filled');
      const p = row.payload;
      t.check(p.customerId === 'C001' && Array.isArray(p.payments) && p.debtCharged === 0 && Array.isArray(p.charges), 'payload carries customer, payments, debtCharged and charges');
      t.check(p.credit && p.credit.pct === 3 && p.credit.days === 30 && p.credit.agreedAt, 'credit is frozen on the order with its rate and term, as setOrderCredit does');
      t.check(Array.isArray(p.stageLog) && p.stageLog.length === 1 && p.stageLog[0].status === 'preparing' && p.stageLog[0].at === p.stageEnteredAt, 'the stage log starts at Packing at stageEnteredAt: Checking was never entered');
      const keys = Object.keys(p.items[0]).sort().join(',');
      t.check(keys === 'lineId,packQty,packUnit,price,productId,productName,qty,qtyIn,sellPrice,supplierId,supplierName,unit,variantIdx', 'each line has the item picker\'s fields and no others: ' + keys);
    }
    t.check(X.S.draft === null && X.S.stack[0] && X.S.stack[0].type === 'placed', 'the draft is cleared and the celebration opens');
  }

  // 3b. what still stops in Checking: a supplier to ask, a price for the Manager, a credit hold
  {
    const place = async (setup) => {
      const db = fakeDb({ saved_quotes: [] });
      const X = loadPage(db);
      Object.assign(X.S, { data: fixture(), shopId: SH, user: { id: 'u1' } });
      X.S.data.savedQuotes = [{ id: 41 }];
      X.S.draft = { client: { name: 'Kato Construction', phone: '0772123456' }, customerId: 'C001', items: [], credit: false, q: '' };
      setup(X);
      await X.ACT['slide:place']({ querySelector: () => ({ textContent: '' }) });
      const ins = db.writes.filter(w => w[0] === 'insert' && w[1] === 'saved_quotes');
      return ins[0] && ins[0][2];
    };
    const bought = await place(X => { X.S.draft.items = [X.makeLine('P2', 0, 5, { lineId: 1 })]; });
    t.check(bought && bought.status === 'draft' && bought.payload.stageLog[0].status === 'draft', 'a line bought in from a supplier: the order lands at Checking');
    const under = await place(X => { const it = X.makeLine('P1', null, 10, { lineId: 1 }); Object.assign(it, { sellPrice: it.sellPrice - 500, priceBy: 'u1', priceNote: 'under', priceShop: it.sellPrice }); X.S.draft.items = [it]; });
    t.check(under && under.status === 'draft', 'a shelf line under the shop\'s price waits in Checking for the Manager');
    const held = await place(X => { X.S.data.customers[0].creditLimit = 400000; X.S.draft.items = [X.makeLine('P1', null, 10, { lineId: 1 })]; });
    t.check(held && held.status === 'draft', 'a customer over their credit limit with the order waits in Checking (the credit hold)');
    // A line placed "price to confirm" is tagged for the Manager, so the gate, the Manager's Prices and the invoice run see it.
    const ask = await place(X => { X.S.data.presetDefaultMarkup = {}; X.S.draft.items = [X.makeLine('P1', null, 10, { lineId: 1 }), X.makeLine('P3', null, 30, { lineId: 2 })]; });
    const asked = ask && ask.payload.items[1], priced = ask && ask.payload.items[0];
    t.check(asked && asked.sellPrice == null && asked.priceBy === 'u1' && asked.priceAsk === true && ['nomargin', 'nocost'].includes(asked.priceNote), 'a line with no selling price is placed tagged for the Manager: ' + JSON.stringify(asked && { priceBy: asked.priceBy, priceNote: asked.priceNote }));
    t.check(priced && !('priceBy' in priced) && !('priceAsk' in priced), 'a line the shop already prices carries no tag');
    t.check(ask && ask.status === 'draft', 'an order with a line still to price waits in Checking');
    t.check(asked.priceNote === 'nomargin' && P.priceReviewState(asked) === 'wait', 'the Manager has to decide it before it can leave Checking');
    t.check(/to price/.test(P.priceTagHTML({ ...asked, priceNote: 'nomargin' })) && !/your price/.test(P.priceTagHTML({ ...asked, priceNote: 'nomargin' })), 'its tag says "to price", not "your price"');
  }

  // 3c. "We don't sell it": a request to Sourcing, in the shape the Sourcing app reads
  {
    const lead = { id: 'SRC-A', shop_id: SH, name: 'Ceiling fan, 56 inch', status: 'looking', voided: false, requests: [{ at: '2026-10-14T09:00:00Z', source: 'sourcing', qty: 2 }], candidates: [] };
    const db = fakeDb({ saved_quotes: [], sourcing_leads: [lead] });
    const X = loadPage(db);
    Object.assign(X.S, { data: fixture(), shopId: SH, user: { id: 'u1' } });
    X.S.data.leads = [X.rowToLead(lead)];
    X.S.draft = X.newDraft(X.S.data.customers[0]);
    t.check(X.srcMatch('ceiling fan') && X.srcMatch('ceiling fan').id === 'SRC-A' && !X.srcMatch('solar pump'), 'the same item asked twice is one lead; a new item is not matched to it');
    X.S.sheet = { type: 'srcask', args: { name: 'ceiling fan', qty: 3 } };
    await X.ACT.srcsend();
    const up = db.writes.find(w => w[0] === 'update' && w[1] === 'sourcing_leads');
    const added = up && up[2].requests[up[2].requests.length - 1];
    t.check(up && up[2].requests.length === 2 && up[2].requests[0].source === 'sourcing', 'a second ask is added to the lead\'s requests, nobody else\'s lost');
    t.check(added && added.source === 'sourcing.ask' && added.by === 'u1' && added.customerId === 'C001' && added.customerName === 'Kato Construction' && added.qty === 3, 'it carries who asked, how many and which salesperson, as the Sourcing app reads it');
    X.S.sheet = { type: 'srcask', args: { name: 'Solar water pump 1hp', qty: 2 } };
    await X.ACT.srcsend();
    const ins = db.writes.find(w => w[0] === 'insert' && w[1] === 'sourcing_leads');
    t.check(ins && ins[2].status === 'asked' && ins[2].name === 'Solar water pump 1hp' && /^SRC-/.test(ins[2].id) && ins[2].requests.length === 1 && ins[2].requests[0].source === 'sourcing.ask', 'an item nobody has asked for starts a new lead at Asked');
  }

  // 3d. a counter sale: placed, paid in full, at Delivered, and invoiced by the one function
  {
    const db = fakeDb({ saved_quotes: [], cash_txns: [] });
    const X = loadPage(db);
    Object.assign(X.S, { data: fixture(), shopId: SH, user: { id: 'u1' } });
    X.S.data.savedQuotes = [{ id: 41 }];
    X.S.draft = { ...X.newDraft(null), counter: true, items: [X.makeLine('P1', null, 10, { lineId: 1 })] };
    t.check(/Slide · paid/.test(X.counterDockHTML()), 'all from the shelf at the shop’s price: one slide, paid');
    const dk = X.counterDockHTML(), tot = X.pricedView(X.draftQuote()).total;
    t.check(/THEY GAVE/.test(dk) && /data-act="ctgiven"/.test(dk) && /CHANGE/.test(dk), 'cash: what they gave, as one tap each, and the change');
    X.S.draft.given = Math.ceil(tot / 5000) * 5000 + 5000;
    t.check(X.counterDockHTML().includes(X.n0(X.S.draft.given - tot)), 'the change is what they gave less the total');
    X.S.draft.payMethod = 'momo';
    t.check(!/THEY GAVE/.test(X.counterDockHTML()), 'no change to give on MoMo');
    X.S.draft.payMethod = 'cash'; X.S.draft.given = null;
    t.check(/ON THE COUNTER/.test(X.PAGE.counter()) && /all at the shop’s price/.test(X.PAGE.counter()), 'the counter screen lists the lines, at the shop’s price');
    const keep = X.S.draft; X.S.draft = { ...X.newDraft(null), counter: true };
    const empty = X.PAGE.counter();
    t.check(/Sells most at the counter/.test(empty) && /data-act="ctadd"/.test(empty) && /Nothing on the counter yet/.test(empty), 'an empty counter offers the shelf, one tap each');
    t.check(!/data-pid="P2"/.test(empty), 'only what is on our own shelf');
    X.S.draft = keep;
    // 0136: the whole sale is ONE write, counter_sale. The phone never inserts the order or the receipt itself.
    const rowIn = X.ctRowFor(X.S.draft);
    t.check(rowIn.payload.counter === undefined && rowIn.payload.items.length === 1 && rowIn.payload.items[0].supplierId === '__stock__' && rowIn.client_name === 'Walk-in', 'the sale goes to the database as the counter holds it: lines from the shelf, a walk-in');
    const r = await X.ctSell(null, rowIn, 'cash', 0), id = r.id;
    const row = db.tables.saved_quotes.find(x => x.id === id), rc = db.tables.cash_txns[0];
    t.check(db.writes.filter(w => w[0] === 'insert' && (w[1] === 'saved_quotes' || w[1] === 'cash_txns')).length === 0, 'the phone writes neither the order nor the receipt: the database does, together');
    t.check(db.writes.some(w => w[0] === 'rpc' && w[1] === 'counter_sale' && w[2].p_row === rowIn && w[2].p_method === 'cash'), 'through counter_sale');
    t.check(rc && rc.type === 'receipt' && rc.account === 'cash' && rc.quote_id === id && rc.amount === r.total && r.total > 0, 'one cash receipt on the sale, for the whole of it');
    t.check(row.status === 'completed' && row.amount_paid === r.total && row.payload.payments.length === 1 && row.payload.payments[0].cashTxnId === rc.id && row.invoiced === true && r.invoice === 'INV-' + String(id).padStart(4, '0'), 'the sale is at Delivered, paid in full, invoiced');
    X.ctKeepLocal(r, rowIn, 'cash');
    t.check(X.S.data.savedQuotes.some(q => Number(q.id) === id && q.status === 'completed' && q.invoiced), 'and this phone holds it at once, until the next refresh');
    X.S.stack = [];
    X.ctLand(id, r, 'cash', r.total + 1000);
    const done = X.PAGE.counterdone(X.S.stack[X.S.stack.length - 1].args);
    t.check(/INVOICED/.test(done) && /GIVE BACK/.test(done) && done.includes(X.n0(1000)) && done.includes(r.invoice), 'sold, paid, invoiced: the change to give back and the invoice');
    X.S.draft = { ...X.newDraft(null), counter: true, items: [X.makeLine('P2', 0, 5, { lineId: 1 })] };
    t.check(/isn’t all on the shelf/.test(X.counterDockHTML()) && !/data-slide="counter"/.test(X.counterDockHTML()), 'a line bought in from a supplier is no counter sale: it becomes an order');
    const it = X.makeLine('P1', null, 10, { lineId: 1 });
    X.S.draft = { ...X.newDraft(null), counter: true, items: [Object.assign(it, { sellPrice: it.sellPrice - 500, priceBy: 'u1', priceNote: 'under', priceShop: it.sellPrice })] };
    t.check(/data-slide="counterask"/.test(X.counterDockHTML()) && !/data-slide="counter"/.test(X.counterDockHTML()), 'under the shop’s price, the slide asks the Manager first');
  }

  // 3e. the browser review of 21 Oct: what a payment, a number, a size and a counter now say
  {
    const db = fakeDb({ saved_quotes: [], cash_txns: [] });
    const X = loadPage(db);
    Object.assign(X.S, { data: fixture(), shopId: SH, user: { id: 'u1' } });
    const wq = X.rowToQuote({ id: 77, status: 'draft', invoiced: false, amount_paid: 0, voided: false, date: '2026-10-21', payload: { client: { name: 'Walk-in', phone: '' }, items: [X.makeLine('P1', null, 2, { lineId: 1 })], payments: [] } });
    X.S.data.savedQuotes = [wq];
    const a = X.payNorm({ orderId: 77 }), v = X.payView(a), owed = v.owed;
    t.check(owed > 0 && !v.c, 'a walk-in order has no customer to owe a balance');
    a.amt = owed - 1000;
    t.check(X.payNeedsWho(a, X.payView(a)) && /Name who owes/.test(X.payDockHTML(a, X.payView(a))) && /who owes it\?/.test(X.payPaperHTML(a, X.payView(a))), 'a walk-in paying part names who owes the rest before the slide unlocks');
    a.whoId = 'C001';
    t.check(/Kato Construction owes the rest/.test(X.payPaperHTML(a, X.payView(a))) && /Slide to record/.test(X.payDockHTML(a, X.payView(a))), 'once named, the rest is theirs and the slide records');
    a.whoId = null; a.amt = owed + 8500; a.method = 'cash';
    // Sales round 1 (SAL-005): money over the bill is asked about every time -- change by default, a deposit only for someone named.
    t.check(X.payChange(a, X.payView(a)) === 8500 && /8,500 back/.test(X.payDockHTML(a, X.payView(a))) && /Give <span class="m">8,500<\/span> change/.test(X.payOverHTML(a, X.payView(a))), 'cash over the bill is change by default, and the slide says how much goes back');
    a.method = 'momo';
    t.check(X.payChange(a, X.payView(a)) === 8500 && /Name them first/.test(X.payOverHTML(a, X.payView(a))) && !X.payDepositOk(a, X.payView(a)), 'mobile money over the bill is change too; a walk-in can’t keep a deposit until named');
    a.whoId = 'C001'; a.over = 'deposit';
    t.check(X.payChange(a, X.payView(a)) === 0 && /8,500 deposit/.test(X.payDockHTML(a, X.payView(a))), 'once named, the extra can be kept as their deposit, and the slide says so');
    a.whoId = null; a.over = null;
    a.method = 'cash'; a.amt = owed;
    t.check(/WILL CLEAR/.test(X.payPaperHTML(a, X.payView(a))) && !/CLEARED/.test(X.payPaperHTML(a, X.payView(a))), 'nothing reads cleared before the slide records it');
    t.check(X.phoneOk('0772123456') && X.phoneOk('+256 772 123 456') && !X.phoneOk('07123') && X.phoneState('07123').typing && X.phoneState('12345').bad, 'a Ugandan number: 07 and 10 digits, or +256 and 9 more');
    X.S.data.customers[0].debt = 500000;
    t.check(!/· cash/.test(X.nwSubOf(X.S.data.customers[0], { habit: true })), 'someone who owes is never called cash');
    X.S.data.leads = [];
    X.S.draft = { ...X.newDraft(null), q: 'iron sheets' };
    const f = X.nwFindHTML();
    t.check(/class="m nw-os"/.test(f) && /nw-opt[^"]*none/.test(f), 'each size shows its shelf count; an empty one is marked');
    t.check(/Ask Sourcing/.test(f), 'under any results, a way to ask Sourcing');
    X.S.draft = X.newDraft(null);
    t.check(/disabled/.test(X.nwMiniDock()), 'Review waits for a first item');
    const cq = X.rowToQuote({ id: 78, status: 'draft', invoiced: false, amount_paid: 0, voided: false, payload: { client: { name: 'Kato' }, items: [X.makeLine('P2', 0, 5, { lineId: 1 })] } });
    t.check(/With the Buyer/.test(X.ordWhoHas(cq, X.ordViews(cq))), 'an order in Checking says who holds it');
    t.check(/AT THE COUNTER TODAY/.test(X.ctHeroHTML()) && /No counter sales yet today/.test(X.ctHeroHTML()), 'the empty counter opens on the day, even a quiet one');
  }

  // 3f. the retest of 21 Oct: what a chat says, what a search finds, what a bar fills
  {
    const db = fakeDb({ saved_quotes: [], cash_txns: [] });
    const X = loadPage(db);
    Object.assign(X.S, { data: fixture(), shopId: SH, user: { id: 'u1', email: 'turyasingurakevin94@example.com' } });
    const keys = s => X.chatReads(s).map(r => r.key);
    t.check(!keys('i want 2ctns Normal Mulpers').includes('paid') && !keys('i want 2ctns Normal Mulpers').includes('day'), 'an ask for cartons neither says they paid nor names a day');
    t.check(!keys('I sent you the list').includes('paid') && keys('I have sent the money').includes('paid') && keys('paid on momo').includes('paid'), '"sent" alone is not a payment; money sent is');
    t.check(!keys('PVC pipe 1/2 inch').includes('day') && keys('pay you on 25th').includes('day') && keys('by friday').includes('day'), 'a size is not a date; a day still is');
    X.S.data.staff = [{ userId: 'u1', name: 'turyasingurakevin94' }];
    t.check(X.myGivenName() === '', 'a name made from an email address is no name to greet');
    X.S.data.staff = [{ userId: 'u1', name: 'Grace Nalubega' }];
    t.check(X.myGivenName() === 'Grace Nalubega', 'a given name is used');
    X.S.wa = { convs: [], msgs: [], threads: {}, loadedAt: 1 };
    t.check(/Items/.test(X.tdyFoundHTML('cement')) && /Cement/.test(X.tdyFoundHTML('cement')), 'the search finds items, with their price');
    const bar = X.payBarParts({ amt: 2000 }, { kind: 'order', owed: 5000, after: 3000 });
    t.check(Number(bar.pct) === 40 && /pays/.test(bar.owedHTML) && /still to pay/.test(bar.afterHTML), 'the bar fills by what is paid: 2,000 of 5,000 is 40%');
  }

  // 3g. the third retest: chats never hold the debts back; a login handle is no name
  {
    const db = fakeDb({ saved_quotes: [], cash_txns: [] });
    const X = loadPage(db);
    Object.assign(X.S, { data: fixture(), shopId: SH, user: { id: 'u1', email: 'someone@example.com' } });
    X.S.data.customers[0].debt = 500000;
    X.S.wa = { convs: [], msgs: [], threads: {}, media: {}, loadedAt: 0, error: null, configured: null };
    const v = X.viewToday();
    t.check(/data-key="hold"/.test(v) && /Chats still loading/.test(v) && !/tdy-hold" data-key="tdy-needs"/.test(v), 'while the chats load, one row keeps their place; the rest is not held');
    X.S.wa.loadedAt = Date.now();
    t.check(!/data-key="hold"/.test(X.viewToday()), 'once they are in, the placeholder goes');
    X.S.data.staff = [{ userId: 'u1', name: 'turyasingurakevin94' }];
    t.check(X.myGivenName() === '', 'a login handle (lowercase, digits, no space) is no name to greet');
  }

  // 3h. a supplier's price up past the sale waits on the Manager, in Sales as in the Buyer's app (order #0554)
  {
    const X = loadPage(fakeDb({ saved_quotes: [], cash_txns: [] }));
    Object.assign(X.S, { data: fixture(), shopId: SH, user: { id: 'u1', email: 'grace@example.com' } });
    X.S.data.members = [{ user_id: 'm1', role: 'manager' }];
    X.S.data.staff = [{ id: 7, name: 'Ruth Nakato', userId: 'm1', role: 'manager' }];
    const line = { lineId: 'a', productId: 'P3', productName: 'Nails', qty: 1, price: 165000, priceWas: 120000, repricedAt: Date.now(), sellPrice: 155000, supplierId: 'S1' };
    const q = { id: 554, status: 'draft', invoiced: false, client: { name: 'Henry' }, items: [line], takenBy: 'u1', createdAt: new Date().toISOString() };
    q.supplierConfirms = { S1: { state: 'confirmed', at: Date.now(), terms: X.supplierTerms(q, 'S1') } };
    X.S.data.savedQuotes = [q];
    t.check(X.lineBelowCost(line) && X.priceReviewState(line) === 'wait' && X.pricesWaiting(q).length === 1, 'an untagged line under its cost waits for the Manager');
    t.check(/With Ruth · Manager · price up/.test(X.ordWhoHas(q, X.ordViews(q))), 'the order says it is with Ruth for a price up, not going to Buying');
    t.check(/Price up · Ruth/.test(X.ordGateHTML(q, X.ordViews(q))) && /1 price up · Ruth/.test(X.ordPaperHead(q, X.ordViews(q))[0]), 'the Prices chip and the slip head carry the hold');
    // MUnder (round 2): under cost, one row -- what it sells for and how far under; only a new price will do.
    t.check(/sells<\/span><b class="ink">155,000/.test(X.ordPriceUpHTML(line)) && /10,000<\/span> under cost/.test(X.ordPriceUpHTML(line)) && !/COST/.test(X.ordPriceUpHTML(line)), 'under cost, the line says what it sells for and how far under');
    t.check(/Ruth sets a new price/.test(X.priceTagHTML(line, true)), 'the line tag says Ruth sets a new price');
    t.check(/RUTH ANSWERS · THEN ON TO BUYING/.test(X.ordAnswersHTML(q)) && /165,000<\/span> or more · you tell Henry/.test(X.ordAnswersHTML(q)) && !/keeps/.test(X.ordAnswersHTML(q)), 'Ruth\'s only answer is a new price at the cost or more');
    t.check(/with Ruth · price up/.test(X.orderRow(q)), 'the Orders row says who has it');
    t.check(/With Ruth/.test(X.viewOrders()) && !/going to Buying/.test(X.viewOrders()), 'Checking lists it with Ruth, not as all found going to Buying');
    t.check(/waiting on Ruth · price up/.test(X.nwPlacedNote(q)), 'the placed screen follows: all found, waiting on Ruth');
    q.status = 'awaiting_goods';
    t.check(/With Ruth · Manager/.test(X.ordWhoHas(q, X.ordViews(q))), 'a price up still waits on the Manager once buying has started');
    // Ruth sets 170,000: the hold lifts and Grace tells Henry.
    line.sellPrice = 170000; line.priceReview = { state: 'changed', price: 170000, was: 155000, qty: 1, byName: 'Ruth Nakato', at: new Date().toISOString() };
    t.check(X.priceReviewState(line) === 'changed' && X.priceToTell(line) && !X.pricesWaiting(q).length, 'the Manager\'s new price is one to tell the customer');
    t.check(/Tell Henry the new price/.test(X.viewToday()), 'Today asks the salesperson to tell them');
    t.check(/Ruth set <span class="m">170,000<\/span> · was/.test(X.priceTagHTML(line, true)), 'the line says what Ruth set, and what it was');
    // A price up that still sells above its cost is not the Manager's to decide.
    const fine = { ...line, price: 130000, sellPrice: 155000, priceReview: null };
    t.check(X.priceReviewState(fine) === null && !!X.linePriceUp(fine), 'a cost up that still sells above it holds nothing');
    // MPriceUp (round 2): the cost before and after, and what is left on each against what was.
    t.check(/120,000/.test(X.ordPriceUpHTML(fine)) && /130,000/.test(X.ordPriceUpHTML(fine)) && /\+25,000 a /.test(X.ordPriceUpHTML(fine)) && /was \+35,000/.test(X.ordPriceUpHTML(fine)), 'a price up shows the cost before and after, and the margin left against what it was');
  }
  // 3i. the placed screen follows the order; search puts what sells first
  {
    const X = loadPage(fakeDb({ saved_quotes: [], cash_txns: [] }));
    Object.assign(X.S, { data: fixture(), shopId: SH, user: { id: 'u1' } });
    const q = { id: 600, status: 'draft', invoiced: false, client: { name: 'Kato' }, items: [{ lineId: 'x', productId: 'P2', variantIdx: 0, productName: 'Iron sheets', qty: 10, price: 31000, supplierId: 'S2' }], createdAt: new Date().toISOString() };
    X.S.data.savedQuotes = [q];
    t.check(/checks .* with a supplier/.test(X.nwPlacedNote(q)), 'at placing: the shop checks with a supplier');
    q.supplierConfirms = { S2: { state: 'confirmed', at: Date.now(), terms: X.supplierTerms(q, 'S2') } };
    t.check(/All found — going to Buying/.test(X.nwPlacedNote(q)), 'once found, it says so');
    q.status = 'awaiting_goods';
    t.check(/Being bought in/.test(X.nwPlacedNote(q)), 'once buying, it says so');
    X.S.data.products.push({ id: 'PF', name: 'Mulper Frog', variants: [] }, { id: 'PN', name: 'Normal Mulper', variants: [] });
    X.S.data.savedQuotes.push({ id: 601, status: 'completed', invoiced: true, items: [{ productId: 'PN', qty: 2 }] }, { id: 602, status: 'completed', invoiced: true, items: [{ productId: 'PN', qty: 1 }] });
    const g = X.nwSearch('mulper').groups.map(x => x.p.name);
    t.check(g[0] === 'Normal Mulper' && g.includes('Mulper Frog'), 'search: what the shop sells comes before a name that only starts with the word');
  }
  // 3j. the QA audit, round 1 (SAL-xx)
  {
    const X = loadPage(fakeDb({ saved_quotes: [], cash_txns: [] }));
    Object.assign(X.S, { data: fixture(), shopId: SH, user: { id: 'u1' } });
    t.check(X.qtyText(2.5) === '2.5' && X.qtyText(1.5) === '1.5' && X.qtyText(1200) === '1,200' && X.qtyText(0.125) === '0.13', 'SAL-02: a quantity is never rounded like money');
    const q = { id: 9, status: 'draft', items: [{ productId: 'P1', productName: 'Cement', qty: 2.5, price: 30000, sellPrice: 34200, supplierId: '__stock__' }], charges: [{ id: 1, label: 'Delivery', type: 'fixed', value: 5000 }], credit: { pct: 3, days: 30 } };
    const ex = X.orderExtraRows(q), lines = 2.5 * 34200 + ex.reduce((a, x) => a + x.amt, 0);
    t.check(ex.length === 2 && ex[0].name === 'Delivery' && ex[1].name === 'Credit charge' && Math.round(lines) === Math.round(X.quoteTotal(q)), 'SAL-07: the items, the delivery and the credit charge add up to the total');
    const it = { productId: 'P1', qty: 1, price: 30000, supplierId: '__stock__' };
    const hi = X.nwPriceState(it, 1012000000);
    t.check(hi.ok && hi.high && !!hi.times && /a zero too many/.test(hi.hint), 'SAL-01: a price many times the shop\'s asks to be checked');
    t.check(!X.nwPriceState(it, 36000).high, 'SAL-01: a price a little over the shop\'s goes straight through');
    X.S.data.customers.push({ id: 'C009', name: 'Sadat', phone: '', debt: 290000, debtLog: [] });
    t.check(X.custNearNames('sadaat').some(c => c.name === 'Sadat') && !X.custNearNames('zzzz').length, 'SAL-25: a typo finds the customer before a second one is made');
    X.startFor(X.customerById('C001'), false, false); X.addLine('P2', 0, 2, 'unit');
    const ln = X.S.draft.items[0];
    if (Number(ln.packQty) > 1) {
      X.ACT.lunit({ dataset: { lid: ln.lineId, u: 'pack' } }); const a = X.lineQtyWords(X.S.draft.items[0]);
      X.ACT.lunit({ dataset: { lid: ln.lineId, u: 'unit' } }); const b = X.lineQtyWords(X.S.draft.items[0]);
      t.check(a.n === 2 && b.n === 2 && b.u === ln.unit, 'SAL-06: 2 sheets to bundles and back is still 2 sheets');
    }
    t.check(X.WA_WAIT_MAX_MINS >= 7 * 24 * 60, 'SAL-08: an order asked on Sunday still waits on Wednesday');
  }
  // 3k. the canvas v96 states, built
  {
    const X = loadPage(fakeDb({ saved_quotes: [], cash_txns: [] }));
    Object.assign(X.S, { data: fixture(), shopId: SH, user: { id: 'u1' } });
    t.check(/Constr<mark>u<\/mark>ction/.test(X.nearMarked('kato constrction', 'Kato Construction')), 'ClientNear: the letter the typing missed is marked');
    t.check(!/<mark>/.test(X.nearMarked('sadat', 'Sadat Hardware')), 'ClientNear: a whole word not typed is not a slip');
    t.check(/no customer with a name like it/.test(X.custNcNameCheck({ name: 'Kireka Building Supplies' })) && /looks like <b>Kato Construction<\/b>/.test(X.custNcNameCheck({ name: 'Kato Constrction' })), 'AddCustomer: a look-alike name is caught before saving');
    const q = { id: 77, status: 'preparing', items: [{ productId: 'P1', productName: 'Cement', qty: 2, price: 30000, sellPrice: 34000, supplierId: '__stock__' }], charges: [{ id: 1, label: 'Delivery · Kira', type: 'fixed', value: 25000 }], credit: { pct: 3, days: 30, agreedAt: '2026-10-21' } };
    const made = X.ordMadeOf(q, X.orderExtraRows(q), X.quoteTotal(q));
    t.check(/goods <span class="m">68,000/.test(made) && /delivery/.test(made) && /credit/.test(made), 'OCredit: the total says what it is made of');
    t.check(/ON CREDIT/.test(X.ordStampHTML(q)) && /DUE 20 NOV/.test(X.ordStampHTML(q)), 'OCredit: an unpaid credit order is stamped with when it is due');
  }
  // 3l. the QA audit, round 2: built as the canvas drew it (row 14)
  {
    const X = loadPage(fakeDb({ saved_quotes: [], cash_txns: [] }));
    const data = fixture();
    Object.assign(X.S, { data, shopId: SH, user: { id: 'u1' }, shopName: 'Mukasa Hardware' });
    const d54 = new Date(Date.now() - 54 * 864e5).toISOString().slice(0, 10), d60 = new Date(Date.now() - 60 * 864e5).toISOString().slice(0, 10);
    // SAL-04: a bill matching an order already paid is in question, never in the Take
    const g = { id: 'C009', name: 'Ggaba Stores', phone: '', phone2: '', location: 'Ggaba', notes: '', debt: 290000, termsDays: null, creditLimit: 500000,
      debtLog: [{ id: 91, type: 'charge', amount: 165000, date: d60, note: 'Opening balance', quoteId: null }, { id: 92, type: 'charge', amount: 125000, date: d54, quoteId: null }] };
    data.customers.push(g);
    data.savedQuotes = [{ id: 264, status: 'completed', invoiced: true, invoicedAt: d54, date: d54, amountPaid: 125000, customerId: 'C009', client: { name: 'Ggaba Stores' }, items: [{ productId: 'P1', productName: 'Cement', qty: 1, price: 100000, sellPrice: 125000, supplierId: '__stock__' }], charges: [] }];
    X.S.loadedAt = 21;
    t.check(X.custInQuestion(g) === 125000 && X.custTakeable(g) === 165000, 'SAL-04: 125,000 is in question, 165,000 can be taken');
    const sheet = X.PAGE.customer({ id: 'C009' });
    t.check(/Take <span class="m">165,000<\/span>/.test(sheet) && /data-amt="165000"/.test(sheet) && !/Take <span class="m">290,000/.test(sheet), 'SAL-04: the Take leaves the disputed bill out');
    t.check(/165,000<\/b> to take/.test(sheet) && /125,000<\/b> in question/.test(sheet) && /Opening balance/.test(sheet), 'SAL-04: the head splits to take and in question; the loose bill names its note');
    const ask = X.needsYou().find(n => n.title === 'Ggaba Stores');
    t.check(!!ask && /165,000/.test(ask.sub) && /125,000<\/span> in question/.test(ask.sub) && !/290,000/.test(ask.sub), 'SAL-04: Today asks to collect only what is clear');
    // SAL-05: nothing billed, orders on the move: the ring counts them, the body lists them with what is paid
    const k = { id: 'C010', name: 'Mukono Roofing', phone: '0772000010', phone2: '', location: 'Nakawa', notes: '', debt: 0, termsDays: null, creditLimit: null, debtLog: [] };
    data.customers.push(k);
    data.savedQuotes.push({ id: 2413, status: 'draft', invoiced: false, amountPaid: 50000, customerId: 'C010', client: { name: 'Mukono Roofing' }, items: [{ productId: 'P1', productName: 'Cement', qty: 4, price: 30000, sellPrice: 45000, supplierId: '__stock__' }], charges: [] },
      { id: 2415, status: 'pending_delivery', invoiced: false, amountPaid: 0, customerId: 'C010', client: { name: 'Mukono Roofing' }, items: [{ productId: 'P1', productName: 'Cement', qty: 2, price: 30000, sellPrice: 45000, supplierId: '__stock__' }], charges: [] });
    X.S.loadedAt = 22;
    const open = X.PAGE.customer({ id: 'C010' });
    t.check(/<span class="m">2<\/span> open<\/span>/.test(open) && !/0 orders?</i.test(open), 'SAL-05: the chip counts the open orders, never "0 orders"');
    t.check(/ON THE MOVE/.test(open) && /50,000<\/b> paid/.test(open) && /still to pay <b class="m">220,000/.test(open), 'SAL-05: what is already paid on them shows');
    t.check(/>Owes</.test(open) && /nothing billed yet/.test(open) && /Open bills <span class="m">0/.test(open) && /data-act="custpayorders"/.test(open), 'SAL-05: billed nothing yet, and a payment can still be taken');
    t.check(/k<\/span> on the move/.test(X.nwOwesChip(k)) && X.nwMovingDue(k) === 220000, 'SAL-05: New sale says what is on the move, never a blank');
    t.check(/To collect/.test(X.viewCustomers()) && /125,000<\/b> in question/.test(X.viewCustomers()), 'SAL-05 / R3-02: the owe list says what is to collect, and what is in question');
    t.check(/165,000<\/span><small>TO COLLECT/.test(X.viewCustomers()) && /125,000<\/span> in question/.test(X.viewCustomers()), 'R3-02: a row splits the same way as the sheet and Today');
    // R3-01: a bill near a paid order is in question only at the same sum; a different sum stays owed
    const n = { id: 'C011', name: 'Nansana Two', phone: '', phone2: '', location: 'Nakawa', notes: '', debt: 20000, termsDays: null, creditLimit: 500000,
      debtLog: [{ id: 95, type: 'charge', amount: 235000, date: d54, quoteId: null }, { id: 96, type: 'payment', amount: 215000, date: d54, quoteId: null }] };
    data.customers.push(n);
    data.savedQuotes.push({ id: 360, status: 'completed', invoiced: true, invoicedAt: d54, date: d54, amountPaid: 235000, customerId: 'C011', client: { name: 'Nansana Two' }, items: [{ productId: 'P1', productName: 'Cement', qty: 1, price: 200000, sellPrice: 235000, supplierId: '__stock__' }], charges: [] });
    X.S.loadedAt = 25;
    t.check(X.custInQuestion(n) === 0 && X.custTakeable(n) === 20000, 'R3-01: 20,000 beside a paid 235,000 is not in question');
    t.check(/Not the same sum · it stays owed/.test(X.PAGE.customer({ id: 'C011' })) && /data-act="pay" data-id="C011">/.test(X.PAGE.customer({ id: 'C011' })) && /Take payment/.test(X.PAGE.customer({ id: 'C011' })), 'R3-01: the sheet shows ≠ and takes the whole 20,000');
    t.check(!!X.needsYou().find(x => x.title === 'Nansana Two'), 'R3-01: and Today still asks to collect it');
    t.check(X.custInQuestion(g) === 125000, 'R3-01: the same sum is still in question');
    // SAL-25: a typo in Customers finds who they meant
    X.S.custQuery = 'ggaba stors'; X.S.loadedAt = 23;
    t.check(/did you mean/.test(X.viewCustomers()) && /Ggaba Stores/.test(X.viewCustomers()) && /Someone new/.test(X.viewCustomers()), 'SAL-25: Customers offers the one they meant, then someone new');
    X.S.custQuery = '';
    // SAL-11: no credit limit -> the order opens on Cash, and Credit says why
    data.savedQuotes.push({ id: 2390, status: 'completed', invoiced: true, invoicedAt: d60, date: d60, customerId: 'C010', credit: { pct: 3, days: 30 }, createdAt: new Date(Date.now() - 1e9).toISOString(), client: { name: 'Mukono Roofing' }, items: [], charges: [] });
    X.S.loadedAt = 24;
    const dr = X.newDraft(k); X.nwApplyHabit(dr, k);
    t.check(dr.credit === false, 'SAL-11: no limit set: the order opens on Cash, whatever they did last time');
    X.S.draft = { ...dr, items: [X.makeLine('P1', null, 1, { lineId: 1 })] };
    // SAL-016 (R2CreditNoLimit): Credit says who decides, on its own row; chosen, it says it waits.
    t.check(/No limit set · [^<]+ decides<\/small>/.test(X.nwDockHTML()) && /class="nw-paywide"/.test(X.nwDockHTML()) && !/nw-nolimw/.test(X.nwDockHTML()), 'SAL-016: no limit set: Credit says who decides, before it is chosen');
    X.S.draft.credit = true;
    t.check(/It waits in Checking until [^<]+ says yes/.test(X.nwDockHTML()) && X.nwCreditHeld(X.S.draft), 'SAL-016: credit chosen with no limit set waits for the Manager');
    X.S.draft.credit = false;
    t.check(!X.nwCreditHeld(X.S.draft), 'SAL-016: the same order for cash does not wait');
    // SAL-12 / SAL-13: a box comes whole; past the shelf the line asks
    t.check(X.nwWholeUnit({ unit: 'box' }) && X.nwWholeUnit({ unit: 'bag' }) && !X.nwWholeUnit({ unit: 'kg' }) && !X.nwWholeUnit({ unit: 'm' }), 'SAL-12: boxes and bags come whole; kilos and metres do not');
    // NEW-01: a part payment shows the whole sum
    const sum = X.paySum({ bills: [{ quoteId: 2413, label: 'Order #2413', pay: 30000, left: 100000, total: 180000 }] });
    t.check(sum && sum.total === 180000 && sum.before === 50000 && sum.now === 30000 && sum.left === 100000, 'NEW-01: total − paid before − paid now = still to pay');
    t.check(/Order total/.test(X.paySumRows(sum, 'momo')) && /Paid before/.test(X.paySumRows(sum, 'momo')) && /Paid now · mobile money/.test(X.paySumRows(sum, 'momo')) && /Still to pay/.test(X.paySumRows(sum, 'momo')), 'NEW-01: the receipt lists all four');
    t.check(X.paySum({ bills: [{ quoteId: 2413, pay: 180000, left: 0, total: 180000 }] }) === null, 'NEW-01: a bill paid in one go needs none of it');
    // SAL-19: the transaction ID goes only with mobile money or bank
    t.check(X.payRefOf({ method: 'momo', ref: ' 3829 ' }) === '3829' && X.payRefOf({ method: 'cash', ref: '3829' }) === '', 'SAL-19: a reference rides on mobile money and bank only');
    t.check(/ref <span class="m">38291045712/.test(X.paySumRows(sum, 'momo', '38291045712')) && /Ref 38291045712\./.test(X.payReceiptText({ name: 'Kato', amount: 1000, method: 'momo', ref: '38291045712', bills: [] })), 'SAL-19: the reference is on the receipt and in the words sent');
    // NEW-03: one Enter arms the slide; it never places
    t.check(/SLIDE_ARM\[key\] = \{ at: now, key: true \}/.test(html) && /if \(a && a\.key && now - a\.at < SLIDE_KEY_MS\)/.test(html) && !/if \(e\.key === 'Enter' \|\| e\.key === ' '\) \{ e\.preventDefault\(\); done\(\); \}/.test(html), 'NEW-03: a first Enter only arms the slide; the second within 5 s does it');
    // SAL-20: they gave -- two round notes and Other
    t.check(X.ctGivenChoices(564000).slice(0, 2).length === 2 && X.counterDockHTML !== undefined, 'SAL-20: two round notes beside Exact, then Other');
  }
  // 4. a payment over two bills and a loose balance
  {
    const iso = d => d;
    const q1 = { id: 1, shop_id: SH, invoiced: true, invoiced_at: iso('2026-08-01'), amount_paid: 0, status: 'completed', voided: false, date: '2026-08-01',
      payload: { client: { name: 'Kato Construction' }, customerId: 'C001', debtCharged: 100000, items: [line('P1', null, 2, 'S1', 32000, { sellPrice: 50000 })], payments: [] } };
    const q2 = { id: 2, shop_id: SH, invoiced: true, invoiced_at: iso('2026-09-01'), amount_paid: 0, status: 'completed', voided: false, date: '2026-09-01',
      payload: { client: { name: 'Kato Construction' }, customerId: 'C001', debtCharged: 300000, items: [line('P1', null, 6, 'S1', 32000, { sellPrice: 50000 })], payments: [] } };
    const db = fakeDb({ saved_quotes: [q1, q2], customers: [{ id: 'C001', shop_id: SH, debt: 500000 }], cash_txns: [], customer_debt_log: [] });
    const X = loadPage(db);
    Object.assign(X.S, { data: fixture(), shopId: SH, user: { id: 'u1' } });
    const toQ = r => ({ id: r.id, status: r.status, invoiced: true, invoicedAt: r.invoiced_at, amountPaid: 0, voided: false, date: r.date, ...JSON.parse(JSON.stringify(r.payload)) });
    X.S.data.savedQuotes = [toQ(q1), toQ(q2)];
    const plan = X.payPlan(X.S.data.customers[0], 450000);
    t.check(plan.bills[0].pay === 100000 && plan.bills[1].pay === 300000 && plan.rest === 50000 && plan.loose === 100000, 'the plan pays the oldest bill first, then the next, then the loose balance');
    X.S.stack = [{ type: 'pay', args: { id: 'C001', amt: 450000, method: 'momo' } }];
    await X.ACT['slide:pay']();
    const w = db.writes;
    const cash = w.filter(x => x[0] === 'insert' && x[1] === 'cash_txns').map(x => x[2]);
    t.check(cash.length === 3 && cash.map(c => c.amount).join() === '100000,300000,50000', 'one receipt per bill and one for the rest: ' + cash.map(c => c.amount).join());
    t.check(cash.every(c => c.type === 'receipt' && c.category === 'Debt Payment' && c.account === 'momo' && c.entered_by === 'u1'), 'each is a Debt Payment receipt on the chosen account, entered by this login');
    t.check(cash[0].quote_id === 1 && cash[1].quote_id === 2 && cash[2].quote_id === null, 'the bill receipts name their invoice; the rest names none');
    t.check(new Set(cash.map(c => c.id)).size === 3, 'every receipt has its own id');
    t.check(db.tables.saved_quotes[0].amount_paid === 100000 && db.tables.saved_quotes[0].payload.payments[0].cashTxnId === cash[0].id, 'the first bill is paid off, its payment linked to its receipt');
    t.check(db.tables.saved_quotes[1].payload.debtCharged === 0 && db.tables.saved_quotes[0].payload.debtCharged === 0, 'each bill\'s share of the debt follows its balance down');
    const logs = db.tables.customer_debt_log;
    t.check(logs.length === 3 && logs.every(l => l.type === 'payment'), 'three payment lines in the debt log, nothing else');
    t.check(logs[0].note === 'Auto-sync — INV-0001' && logs[0].quote_id === 1 && logs[0].cash_txn_id === null, 'a bill\'s line is the invoice\'s own Auto-sync line');
    t.check(logs[2].cash_txn_id === cash[2].id && logs[2].amount === 50000, 'the loose payment line carries the receipt its money came on');
    t.check(db.tables.customers[0].debt === 50000, 'they owe 50,000 after paying 450,000 of 500,000');
    const debts = w.filter(x => x[0] === 'update' && x[1] === 'customers').map(x => x[2].debt);
    t.check(debts.every((d, i) => d <= (i ? debts[i - 1] : 500000)), 'the debt only ever goes down');
    t.check(X.S.stack[0].type === 'paid' && X.S.stack[0].args.before === 500000 && X.S.stack[0].args.after === 50000, 'the paid screen shows 500,000 → 50,000');
  }

  // 4b. choosing the bills: only the picked bill is paid; what is over lowers the loose balance
  {
    const bill = (id, at, total) => ({ id, shop_id: SH, invoiced: true, invoiced_at: at, amount_paid: 0, status: 'completed', voided: false, date: at,
      payload: { client: { name: 'Kato Construction' }, customerId: 'C001', debtCharged: total, items: [line('P1', null, total / 50000, 'S1', 32000, { sellPrice: 50000 })], payments: [] } });
    const q1 = bill(1, '2026-08-01', 100000), q2 = bill(2, '2026-09-01', 300000);
    const db = fakeDb({ saved_quotes: [q1, q2], customers: [{ id: 'C001', shop_id: SH, debt: 500000 }], cash_txns: [], customer_debt_log: [] });
    const X = loadPage(db);
    Object.assign(X.S, { data: fixture(), shopId: SH, user: { id: 'u1' } });
    const toQ = r => ({ id: r.id, status: r.status, invoiced: true, invoicedAt: r.invoiced_at, amountPaid: 0, voided: false, date: r.date, ...JSON.parse(JSON.stringify(r.payload)) });
    X.S.data.savedQuotes = [toQ(q1), toQ(q2)];
    const plan = X.payPlan(X.S.data.customers[0], 350000, [2]);
    t.check(plan.bills[0].q.id === 2 && plan.bills[0].pay === 300000 && plan.bills[1].pay === 0 && plan.rest === 50000 && plan.after === 150000, 'a picked bill is paid first, an unpicked one not at all, and the plan says what they owe after');
    X.S.stack = [{ type: 'pay', args: { id: 'C001', amt: 350000, method: 'cash', mode: 'pick', picks: [2] } }];
    await X.ACT['slide:pay']();
    const cash = db.writes.filter(x => x[0] === 'insert' && x[1] === 'cash_txns').map(x => x[2]);
    t.check(cash.length === 2 && cash[0].quote_id === 2 && cash[0].amount === 300000 && cash[1].quote_id === null && cash[1].amount === 50000, 'one receipt on the picked bill, one for the rest: ' + cash.map(c => c.amount + '/' + c.quote_id).join());
    t.check(db.tables.saved_quotes[0].amount_paid === 0 && db.tables.saved_quotes[1].amount_paid === 300000, 'the bill not picked is left alone');
    const pm = db.tables.saved_quotes[1].payload.payments[0];
    t.check(pm.cashTxnId === cash[0].id && pm.method === 'cash' && pm.id === 1, 'the payment carries its receipt, its account and its own number');
    t.check(db.tables.customers[0].debt === 150000, 'they owe 150,000 after paying 350,000 of 500,000');
    t.check(X.S.stack[0].type === 'paid' && X.S.stack[0].args.after === 150000, 'the paid screen shows what is left');
  }

  // 4c. an order paid before its invoice: a receipt and a payment on the order, no debt
  {
    const q7 = { id: 7, shop_id: SH, invoiced: false, amount_paid: 0, status: 'draft', voided: false, date: '2026-10-01',
      payload: { client: { name: 'Kato Construction' }, customerId: 'C001', debtCharged: 0, items: [line('P1', null, 2, 'S1', 32000, { sellPrice: 50000 })], payments: [] } };
    const db = fakeDb({ saved_quotes: [q7], customers: [{ id: 'C001', shop_id: SH, debt: 500000 }], cash_txns: [], customer_debt_log: [] });
    const X = loadPage(db);
    Object.assign(X.S, { data: fixture(), shopId: SH, user: { id: 'u1' } });
    X.S.data.savedQuotes = [{ id: 7, status: 'draft', invoiced: false, amountPaid: 0, voided: false, date: q7.date, ...JSON.parse(JSON.stringify(q7.payload)) }];
    const q7was = JSON.parse(JSON.stringify(q7));
    X.S.stack = [{ type: 'pay', args: { orderId: 7, amt: 150000, method: 'momo' } }];
    await X.ACT['slide:pay']();
    const call = db.writes.find(x => x[0] === 'rpc' && x[1] === 'receive_payment');
    t.check(call && call[2].p_amount === 100000 && call[2].p_over === 'change' && X.S.stack[0].type === 'paid' && X.S.stack[0].args.change === 50000, 'more than the order takes records only what it takes, and 50,000 goes back as change');
    db.writes.length = 0; db.tables.saved_quotes[0] = q7was; db.tables.cash_txns.length = 0;
    X.S.data.savedQuotes = [{ id: 7, status: 'draft', invoiced: false, amountPaid: 0, voided: false, date: q7.date, ...JSON.parse(JSON.stringify(q7.payload)) }];
    X.S.paying = false;
    X.S.stack = [{ type: 'pay', args: { orderId: 7, amt: 60000, method: 'momo' } }];
    await X.ACT['slide:pay']();
    const cash = db.writes.filter(x => x[0] === 'insert' && x[1] === 'cash_txns').map(x => x[2]);
    t.check(cash.length === 1 && cash[0].category === 'Invoice Payment' && cash[0].quote_id === 7 && cash[0].amount === 60000 && cash[0].account === 'momo', 'one Invoice Payment receipt on the order');
    const row = db.tables.saved_quotes[0];
    t.check(row.amount_paid === 60000 && row.invoiced === false && row.payload.payments[0].cashTxnId === cash[0].id, 'the order carries the payment and stays uninvoiced');
    t.check(!db.writes.some(x => x[1] === 'customers' || x[1] === 'customer_debt_log'), 'no debt is touched before the invoice');
    t.check(X.S.stack[0].type === 'paid' && X.S.stack[0].args.after === 40000, 'the paid screen says 40,000 is left to pay');
  }

  // 5. the salesperson's price (canvas: Setting the price): never under cost, and flagged for the owner
  {
    const X = loadPage(fakeDb({}));
    Object.assign(X.S, { data: fixture(), shopId: SH, user: { id: 'u1' } });
    const ruled = line('P1', null, 3, 'S1', 32000), shop = X.shopSellPrice(ruled);
    t.check(shop === 36800, 'the shop\'s price is the markup rule\'s price (' + shop + ')');
    t.check(X.priceTooLow(ruled, 31999) && !X.priceTooLow(ruled, 32000), 'a price under the cost is refused, the cost itself is allowed');
    t.check(X.priceNoteFor(ruled, 35000) === 'under' && X.priceNoteFor(ruled, 36800) === null, 'under the shop\'s price is marked for the owner; the shop\'s price is not');
    X.S.data.presetDefaultMarkup = {};
    const bare = line('P3', null, 30, 'S1', 3600);
    t.check(X.shopSellPrice(bare) === null && X.priceNoteFor(bare, 5000) === 'nomargin', 'no margin set: the salesperson sets it and the owner reviews it');
    const nocost = line('P3', null, 2, '', 0);
    t.check(!X.priceTooLow(nocost, 1) && X.priceNoteFor(nocost, 25000) === 'nocost', 'no cost known: any price, marked to be confirmed');
    t.check(!X.linePriceToConfirm({ ...nocost, sellPrice: 25000, priceBy: 'u1', priceNote: 'nocost' }), 'a quoted price counts in the total');
    const pv = X.pricedView({ items: [{ ...nocost, sellPrice: 25000, priceBy: 'u1', priceNote: 'nocost' }], charges: [] });
    t.check(pv.total === 50000 && pv.pending === 1, 'and the order says one price is still to be confirmed');
  }

  // 6. chats: a reply always has a road, and what fails says why
  {
    const X = loadPage(fakeDb({}));
    Object.assign(X.S, { data: fixture(), shopId: SH });
    const now = Date.now(), open = { id: 1, wa_id: '256772123456', last_inbound_at: new Date(now - 3600e3).toISOString() };
    const shut = { id: 2, wa_id: '256772000000', last_inbound_at: new Date(now - 30 * 3600e3).toISOString() };
    t.check(X.chatKind(open, null) === 'text' && X.chatKind(open, { url: 'x' }) === 'image', 'an open chat takes words and pictures as they are');
    t.check(X.chatKind(shut, null) === 'template' && X.chatCanSend(shut, 'We can replace it', null), 'a shut chat still takes a reply — inside the shop\'s reply message');
    t.check(!X.chatCanSend(shut, '', { url: 'x' }) && X.chatCanSend(open, '', { url: 'x' }), 'a picture goes only while the chat is open');
    t.check(!X.chatCanSend({ ...open, opt_out: true }, 'hello', null), 'nobody who said STOP is written to');
    t.check(!X.chatCanSend(open, '   ', null), 'nothing to send is not sent');
    t.check(/No connection/.test(X.chatWhyNot(new TypeError('Failed to fetch'), 'text')), 'a dropped connection says so');
    t.check(/server update/.test(X.chatWhyNot(new Error('Unknown action "send-reply-template"'), 'template')), 'an old server says it needs the update, not a riddle');
    t.check(/reply message/.test(X.chatWhyNot(new Error('The 24-hour reply window is closed — the customer has to message first.'), 'text')), 'a window that shut mid-send points at the reply message');
    const m = (msg_type, body, payload) => ({ msg_type, body, payload });
    t.check(X.chatSaid(m('audio', '[audio]')) === 'Voice note' && X.chatSaid(m('image', '[image] torn')) === 'torn' && X.chatSaid(m('image', '[image]')) === 'Picture', 'voice notes and pictures read as what they are, not "[audio]"');
    t.check(X.chatSaid(m('document', '[document]', { document: { filename: 'BOQ.pdf' } })) === 'BOQ.pdf' && X.chatSaid(m('location', '[location]', { location: { name: 'Najjera site' } })) === 'Najjera site', 'a document by its name, a location by its place');
    t.check(X.chatSaid(m('interactive', '[catalog] Browse')) === 'Catalogue' && X.chatSaid(m('template', 'We can replace it')) === 'We can replace it', 'the catalogue card and a reply message read plainly');
    X.S.user = { id: 'u1' };
    const out = (o) => ({ direction: 'out', msg_type: 'text', body: 'ok', ...o });
    t.check(X.chatSender(out({ sent_by: 'u1', sent_by_name: 'Amina' })).name === 'You' && X.chatSender(out({ sent_by: 'u9', sent_by_name: 'Grace Namubiru' })).name === 'Grace Namubiru', 'every reply names who on the team sent it — you, or them by name');
    t.check(X.chatSender(out({ payload: { from: '2567', timestamp: '1' } })).name === 'Shop phone' && X.chatSender(out({ payload: { auto: true } })).name === 'Automatic', 'typed on the shop phone, or sent by itself, it says so');
    t.check(X.chatSender(out({})) === null && X.chatSender({ direction: 'in', sent_by_name: 'x' }) === null, 'a reply from before the stamp names nobody rather than a guess; a customer\'s message is theirs');
    const one = X.chatPriceLine('P2', 0, 1), bulk = X.chatPriceLine('P2', 0, 40), none = X.chatPriceLine('P3', null, 1);
    t.check(one && one.price === Math.round(X.quoteItemSellPrice(X.makeLine('P2', 0, 1))) && bulk.price === Math.round(X.quoteItemSellPrice(X.makeLine('P2', 0, 40))) && /^40 Iron sheets G28: /.test(bulk.text), 'a price is the selling price at the quantity they asked for');
    t.check(none && none.price === null && /price to confirm/.test(none.text) && !/90,000|3,600/.test(none.text), 'no selling rule: "price to confirm", never the cost');
  }

  // 7. the 19 Oct 2026 end-to-end test (docs/decision-rights.md rules A and B)
  {
    const X = loadPage(fakeDb({}));
    const data = fixture(); Object.assign(X.S, { data, shopId: SH, user: { id: 'u1', email: 'a@b.c' }, shopName: 'Shop', loadedAt: 1 });
    const dayISO = n => { const d = new Date(); d.setDate(d.getDate() - n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
    const sq = (id, status, items, extra) => ({ id, status, invoiced: false, voided: false, amountPaid: 0, client: { name: 'Walk-in' }, items, charges: [], createdAt: new Date().toISOString(), ...(extra || {}) });

    // fix 3: what the invoices of live orders will take is not on the shelf to sell
    data.savedQuotes = [
      sq(50, 'completed', [line('P1', null, 23, '__stock__', 31000)]),                                   // handed over, not invoiced: held
      sq(51, 'preparing', [line('P3', null, 2, 'S1', 90000, { unit: 'carton', receivedAt: '2026-10-19T10:00:00Z', receivedQty: 2 })]),   // came in, by the carton
      sq(52, 'draft', [line('P1', null, 5, '__stock__', 31000)]),                                        // still at Checking: not held
      sq(53, 'completed', [line('P1', null, 7, '__stock__', 31000)], { invoiced: true }),               // invoiced: already off the shelf
      sq(54, 'preparing', [line('P1', null, 4, '__stock__', 31000)], { voided: true }),
      sq(55, 'awaiting_goods', [line('P1', null, 9, 'S1', 32000)]),                                     // bought in, not yet in: not held
    ];
    data.stock = { P1: 40, P3: 60 };
    X.S.loadedAt = 2;
    t.check(X.heldForOrders('P1', null) === 23 && X.shelfAvailable('P1', null) === 17, 'a delivered, uninvoiced order holds its shelf lines: 40 on the shelf, 23 held, 17 to sell');
    t.check(X.heldForOrders('P3', null) === 50 && X.shelfAvailable('P3', null) === 10, 'a received line counted in cartons holds 2 × 25 kg of the shelf');
    t.check(X.shelfAvailable('P1', null, 50) === 40, 'an order is never held against itself');
    t.check(X.makeLine('P1', null, 17).supplierId === '__stock__' && X.makeLine('P1', null, 18).supplierId === 'S1', 'a new line comes off the shelf only while what is free covers it, else it is bought in');
    data.stock = { P1: 10 }; X.S.loadedAt = 3;
    t.check(X.shelfAvailable('P1', null) === 0, 'never below nothing');

    // fix 7: a line the supplier sells only by the carton says so
    data.stock = {}; data.savedQuotes = []; X.S.loadedAt = 4;
    const nails = X.makeLine('P3', null, 30), pk = X.linePackOnly(nails);
    t.check(pk && pk.pack === 25 && pk.units === 50 && pk.extra === 20, 'nails come only by the carton of 25: 30 makes the shop buy 50');
    t.check(X.linePackOnly(X.makeLine('P2', 0, 3)) === null && X.linePackOnly(X.makeLine('P3', null, 50)).extra === 0, 'a loose price, or a full carton, has nothing to offer');
    X.S.draft = X.newDraft(null); X.S.draft.items = [nails];
    t.check(/comes by the carton of 25/.test(X.bandHTML(nails)), 'the line on the order shows the carton size so the full carton can be offered');
    X.S.draft = null;

    // fix 9: one rule for how old a debt is, Accounts' (custOpenCharges + custAging)
    const acc = read('accounts.html'), normF = s2 => s2.replace(/^\s*\/\/.*$/gm, '').replace(/\s+/g, ' ').trim();
    // a one-line function is taken as its own line (the shared extractor reads past it)
    const fnOf = (src, n, where) => { const m = new RegExp('^function\\s+' + n + '\\s*\\(.*\\}\\s*$', 'm').exec(src); return m ? m[0] : extractFunction(src, n, where); };
    ['custOpenCharges', 'custAging', 'bandOf', 'agingNoDate'].forEach(n => t.check(normF(fnOf(html, n, 'sales.html')) === normF(fnOf(acc, n, 'accounts.html')), `${n}() is accounts.html's, word for word`));
    data.customers = [
      { id: 'C1', name: 'Ken Bwaise', debt: 600000, termsDays: 7, creditLimit: null, phone: '', phone2: '', location: 'Bwaise', notes: '', debtLog: [
        { id: 1, date: dayISO(42), type: 'charge', amount: 300000, quoteId: 1 },
        { id: 2, date: null, type: 'charge', amount: 100000, quoteId: null },
        { id: 3, date: dayISO(10), type: 'charge', amount: 200000, quoteId: 2 },
        { id: 4, date: dayISO(5), type: 'payment', amount: 100000, quoteId: null }] },
      { id: 'C2', name: 'Sadat', debt: 150000, termsDays: null, creditLimit: null, phone: '', phone2: '', location: '', notes: '', debtLog: [{ id: 9, date: '', type: 'charge', amount: 150000 }] },
    ];
    // An old invoice date on file must not age the debt: the log does.
    data.savedQuotes = [sq(1, 'completed', [line('P1', null, 10, '__stock__', 31000)], { invoiced: true, customerId: 'C1', invoicedAt: dayISO(90) })];
    X.S.loadedAt = 5;
    const ken = X.custAging(data.customers[0]);
    // FIFO: the undated charge sorts first, so the payment clears it; 100,000 of the debt the log does not cover is "no date".
    t.check(X.custOldestAge(data.customers[0]) === 42 && ken.unknown === 100000 && ken.parts.b60 === 300000 && ken.parts.b30 === 200000, 'Ken: the oldest open charge is 42 days old (not the invoice\'s 90), and what the log does not cover is "no date" (' + ken.oldest + ', ' + ken.unknown + ')');
    t.check(X.custOldestOrNull(data.customers[1]) === null && X.custAging(data.customers[1]).unknown === 150000, 'Sadat: a charge with no date is "no date", never age 0');
    const b = X.custDebtBands(data.customers);
    t.check(b.a === 200000 && b.b === 300000 && b.c === 0 && b.nd === 250000, 'the customers bar: under 30, 30–60, over 60 from the open charges, and a "no date" part: ' + JSON.stringify(b));
    t.check(b.b + b.c === ken.parts.b60 + ken.parts.b90 + ken.parts.b90p, 'owing over 30 days is Accounts\' figure');
    t.check(/no date/.test(X.custState(data.customers[1]).why) && /oldest bill 42 days/.test(X.custState(data.customers[0]).why), 'debtor rows: "oldest bill 42 days", and "no date" where nothing is dated');
    t.check(!/Sadat/.test(X.viewToday()), 'an undated debt is not chased as overdue');
    { const pg = X.PAGE.customer({ id: 'C1' }); t.check(/42<\/span> days/.test(pg) && /no date/.test(pg) && /INV-0001/.test(pg), 'the customer\'s bill bar is their open charges, the oldest 42 days, with a "no date" part'); }

    // fix 12: one known-only total; a line still to price is never billed at cost
    const open = sq(60, 'completed', [line('P1', null, 10, '__stock__', 31000), line('P3', null, 2, 'S1', 90000)]);
    open.amountPaid = X.pricedLive(open).total;
    data.savedQuotes = [open]; X.S.loadedAt = 6;
    t.check(X.pricedLive(open).toConfirm === 1 && X.orderDue(open) === 0, 'paid what is priced: nothing more is due until the rest is priced (not the cost of the unpriced line)');
    t.check(X.nmPaidWord(open)[0] === 'PART PAID', 'and it is not called PAID while a line waits for a price');
    t.check(/1 TO PRICE/.test(X.ordStampHTML(open)) && !/<b>PAID<\/b>/.test(X.ordStampHTML(open)), 'the order\'s stamp says what is still to price');

    // fix 13: a line "Bill what went" settled to nothing is struck through, not "to price"
    const settled = sq(61, 'completed', [line('P1', null, 10, '__stock__', 31000, { pickStatus: 'done', pickedQty: 10 }), line('P3', null, 0, '', 0, { productName: 'Glass Door Locks', pickStatus: 'short', pickedQty: 0 })],
      { pickSettle: { pick: 'went', lines: [{ idx: 1, ordered: 5, picked: 0 }] } });
    data.savedQuotes = [settled]; X.S.loadedAt = 7;
    const v = X.ordViews(settled), paper = X.ordPaperLine(settled, settled.items[1], v[1]);
    t.check(v[1].k === 'out' && X.pricedLive(settled).toConfirm === 0, 'the settled line is off the order: not counted "to price"');
    t.check(/ord-pl struck/.test(paper) && /NOT SENT/.test(paper) && !/to price/.test(paper) && !/GOT 0 OF 0/.test(paper) && /<span class="q m">5 /.test(paper), 'it is struck through at the 5 ordered, never "GOT 0 OF 0"');
    t.check(X.ordPictureRows(settled).length === 1, 'and left off the picture the customer is sent');

    // fix 18: the month's goal counts invoiced sales only, and says so
    const ms = (() => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-01'; })();
    const me = (() => { const d = new Date(); const e = new Date(d.getFullYear(), d.getMonth() + 1, 0); return e.getFullYear() + '-' + String(e.getMonth() + 1).padStart(2, '0') + '-' + String(e.getDate()).padStart(2, '0'); })();
    data.targets = [{ id: 1, date: ms, body: { metric: 'sales', aim: 5000000, from: ms, to: me } }]; X.S.loadedAt = 8;
    t.check(X.salesTarget() && /Invoiced · /.test(X.viewToday()), 'Today\'s month strip says its figure is invoiced sales');
    t.check(/invoiced · of/.test(X.PAGE.goal()), 'and so does the goal page');
  }

  // the screens draw from the fixture without throwing
  {
    const X = loadPage(fakeDb({}));
    Object.assign(X.S, { data: fixture(), shopId: SH, user: { id: 'u1', email: 'a@b.c' }, shopName: 'Shop' });
    ['viewToday', 'viewOrders', 'viewCustomers', 'viewMe'].forEach(v => { let ok = true; try { X[v](); } catch (e) { ok = false; t.fail(v + ' threw: ' + e.message); } if (ok) t.pass(v + ' draws'); });
    ['customer', 'neworder', 'pay'].forEach(pg => { try { X.PAGE[pg]({ id: 'C001', amt: 1000, method: 'cash' }); t.pass('page ' + pg + ' draws'); } catch (e) { t.fail('page ' + pg + ' threw: ' + e.message); } });
    X.S.data.cashTxns = [{ id: 11, date: '2026-10-01', time: '09:00', account: 'cash', type: 'receipt', category: 'Debt Payment', amount: 50000, quoteId: null }];
    try { const h = X.PAGE.paid({ fromTxn: 11 }); t.check(h.includes('50,000'), 'page paid draws from a receipt in the books'); } catch (e) { t.fail('page paid (fromTxn) threw: ' + e.message); }
  }

  // a new customer (v105): their card fills as it goes, and the areas are plain chips
  {
    const X = loadPage(fakeDb({}));
    Object.assign(X.S, { data: fixture(), shopId: SH, user: { id: 'u1', email: 'a@b.c' }, shopName: 'Shop' });
    const none = { phone: '', name: '', area: '' }, all = { phone: '0772 664 019', name: 'Kireka Building Supplies', area: 'Kira' };
    t.check(/0\/3/.test(X.custNcReady(none)) && !/Ready/.test(X.custNcReady(none)) && /Ready/.test(X.custNcReady(all)) && /3\/3/.test(X.custNcReady(all)), 'the header counts what is in: 0/3, then Ready 3/3');
    const c0 = X.custNcPreview(none), c1 = X.custNcPreview(all);
    t.check(/Their name/.test(c0) && /Their number/.test(c0) && /Their area/.test(c0) && /Still to fill: number, name, area/.test(c0), 'an empty card says what goes where, and what is still to fill');
    t.check(c1.includes('Kireka Building Supplies') && c1.includes('0772 664 019') && c1.includes('Kira') && (c1.match(/#6FDCB0/g) || []).length === 3 && (c0.match(/#6FDCB0/g) || []).length === 0, 'a full card shows them as saved, the ring closed in three');
    X.S.sheet = { type: 'addcust', args: { for: '', phone: '', name: '', area: '' } };
    const sh = X.SHEET.addcust(X.S.sheet.args);
    t.check(/class="cu-ncareas"/.test(sh) ? /data-act="ncarea"/.test(sh) && /Other…/.test(sh) && !/--w:|\+1|customers there/.test(sh) : /id="sx_nc_area"/.test(sh) && !/Other…/.test(sh), 'areas are plain chips with Other… (no bars, counts or +1); with none on the books, a box to type it');
    t.check(/Just save/.test(sh) && /Save and sell/.test(sh) && /cu-ncdock/.test(sh), 'the two saves sit in the dock');
  }

  // the smaller navy tops (v109/v110/v113): Today is one strip; an order is who, a stage n/6 bar, and chips
  {
    const X = loadPage(fakeDb({}));
    Object.assign(X.S, { data: fixture(), shopId: SH, user: { id: 'u1', email: 'a@b.c' }, shopName: 'Shop' });
    const td = X.viewToday();
    t.check(/class="tdy-strip"/.test(td) && /data-act="day" data-mode="sold"/.test(td) && !/paid in full<\/span>/.test(td) && !/Money in today/.test(td), 'Today is one strip: the month and today, no flow row, no separate tiles');
    X.S.data.savedQuotes.push({ id: 2490, status: 'draft', invoiced: false, amountPaid: 0, customerId: 'C001', client: { name: 'Kato Construction' }, items: [{ productId: 'P1', productName: 'Cement', qty: 4, price: 32000, sellPrice: 36000, supplierId: '__stock__' }], charges: [] });
    X.S.loadedAt = 31;
    const q = X.S.data.savedQuotes.find(x => x.id === 2490);
    if (q) {
      const st = X.ordStage(q), ch = X.ordChipsHTML(q, X.ordViews(q));
      t.check(/Checking<\/b><span class="m n">2\/6/.test(st) && (st.match(/<i/g) || []).length === 6, 'an order\'s stage is its name, 2/6 and a bar cut in six');
      t.check(/class="ord-chips"/.test(ch) && /aria-label="Leaves Checking when all three say yes"/.test(ch) && !/ord-trk|ord-gate /.test(X.PAGE.order({ id: q.id })), 'Checking carries its three gates as chips, and the labelled stage dots are gone');
    } else t.fail('the fixture has an order in Checking');
  }

  // review 5: a full phone gives up the cached copies before a draft; a sign out takes every copy with it
  {
    const mk = cap => { const m = new Map(); const used = () => [...m].reduce((n, [k, v]) => n + k.length + v.length, 0);
      return { m, get length(){ return m.size; }, key: i => [...m.keys()][i] ?? null, getItem: k => (m.has(k) ? m.get(k) : null),
        setItem(k, v){ const was = m.get(k); m.set(k, String(v)); if (used() > cap) { if (was == null) m.delete(k); else m.set(k, was); throw new Error('QuotaExceededError'); } }, removeItem: k => { m.delete(k); } }; };
    const ls = mk(4000), st = {};
    const F = compileScope(['owSnapKeys', 'owForgetCopies', 'owSave'].map(n => extractFunction(html, n, 'sales.html')), { localStorage: ls, S: st }, ['owSnapKeys', 'owForgetCopies', 'owSave']);
    ls.setItem('ow-owner-snap:u1', 'o'.repeat(1500)); ls.setItem('ow-manager-snap:u1', 'm'.repeat(1500)); ls.setItem('ow-sales-snap:u1', 's'.repeat(600)); ls.setItem('ow-shop:u1', 'shop1');
    const ok = F.owSave('ow-sales-draft:u1', 'd'.repeat(2000));
    t.check(ok && ls.getItem('ow-sales-draft:u1') && ls.getItem('ow-sales-snap:u1') && !ls.getItem('ow-owner-snap:u1'), 'storage full: other apps\' cached copies give way and the draft is kept');
    t.check(F.owSave('ow-sales-draft:u1', 'd'.repeat(5000)) === false, 'a draft that still cannot fit says so (false), never a silent success');
    ls.setItem('ow-owner-snap:u1', 'o'); F.owForgetCopies();
    t.check(F.owSnapKeys().length === 0 && ls.getItem('ow-shop:u1') === 'shop1', 'a sign out forgets every app\'s cached copy and keeps the rest');
    t.check(/function saveDraft\(\)\{[^\n]*owSave\(draftKey\(\)[^\n]*owDraftNotKept\(\)/.test(html) && /function nwSaveDrafts\(a\)\{[^\n]*owSave\([^\n]*owDraftNotKept\(\)/.test(html), 'both draft saves warn when the phone could not keep them');
    t.check((html.match(/owForgetCopies\(\); await sb\.auth\.signOut\(\)/g) || []).length === 2 && /localStorage\.removeItem\(k\)\); \} catch \(_e\) \{\} await sb\.auth\.signOut\(\)/.test(html), 'every Sign out in the app forgets the cached copies (the shop picker\'s, the same in every app)');
    t.check(/\.ct-search input::-webkit-search-cancel-button\{-webkit-appearance:none;display:none\}/.test(html), 'the counter search shows one clear button, not the phone\'s as well');
  }

  // round 4 and review 5 (rows 16-17)
  {
    const X = loadPage(fakeDb({}));
    Object.assign(X.S, { data: fixture(), shopId: SH, user: { id: 'u1', email: 'a@b.c' }, shopName: 'Shop' });
    t.check(X.qtyJumps(12, 120) && X.qtyJumps(12, 125) && !X.qtyJumps(12, 13) && !X.qtyJumps(1, 10) && !X.qtyJumps(12, 24), 'R4-01: a digit too many (12 → 120) asks; an ordinary change does not');
    const pq = X.parseQuery('-5 padlock');
    t.check(pq.qty === 5 && pq.neg === true && pq.words.join(' ') === 'padlock' && X.parseQuery('5 padlock').neg === false, 'a count typed with a minus is read as the count, and marked to say so');
    t.check(/SHORT/.test(X.ctChangeHTML(null, 30300)) && /30,300/.test(X.ctChangeHTML(null, 30300)) && /CHANGE/.test(X.ctChangeHTML(700, 0)), 'short cash: the change slot says how short');
    X.S.offline = true;
    const sl = X.sliderHTML('counter', 'Slide · paid 480,300 cash', { money: 'cash' });
    t.check(/Back online to sell/.test(sl) && /aria-disabled="true"/.test(sl) && !/Back online/.test(X.sliderHTML('tell', 'Slide to send')), 'no connection: the slides that write wait, and say so');
    X.S.offline = false;
    X.S.data.savedQuotes.push({ id: 2601, status: 'completed', invoiced: true, amountPaid: 409000, client: { name: 'Walk-in' }, items: [{ productId: 'P1', productName: 'Cement', qty: 10, price: 30000, sellPrice: 40900, supplierId: '__stock__' }], charges: [] });
    X.S.data.asks = [{ id: 'k1', quoteId: 2601, kind: 'void', amount: 409000, status: 'sent', createdAt: new Date().toISOString() }];
    X.S.loadedAt = 41;
    t.check(/Void asked/.test(X.orderRow(X.S.data.savedQuotes.find(q => q.id === 2601))), 'Done today: a row carries the void asked of the Manager');
    t.check(X.custNcNameHit({ name: 'Kato Construction' }) && !X.custNcNameHit({ name: 'Zz' }), 'a name already on the books is found before a second one is saved');
  }

  // the UX audit (docs/reviews/sales-ux-audit.md on claude/sales-ux-audit)
  {
    const X = loadPage(fakeDb({}));
    Object.assign(X.S, { data: fixture(), shopId: SH, user: { id: 'u1', email: 'a@b.c' }, shopName: 'Shop' });
    X.S.draft = X.newDraft(null); X.S.draft.q = '12 tile adhesive';
    try { X.ACT.srcask(); } catch (e) { /* the sheet draws in a DOM the sandbox lacks; the args are set first */ }
    const a = X.S.sheet && X.S.sheet.args;
    t.check(!!a && a.name === 'tile adhesive' && a.qty === 12, 'fix 1: Ask Sourcing keeps the count the search read, not "12 tile adhesive" × 1');
    X.S.data.savedQuotes.push({ id: 2402, status: 'draft', invoiced: false, amountPaid: 0, customerId: 'C001', client: { name: 'Kato Construction' }, items: [{ productId: 'P1', productName: 'Cement', qty: 4, price: 30000, sellPrice: 36000, supplierId: '__stock__' }], charges: [], createdAt: new Date().toISOString() });
    X.S.loadedAt = 51;
    let card = ''; try { card = X.tdyAskCard({ conv: { id: 'c1', profile_name: 'Kato Construction', wa_id: '256772123456' }, customer: X.customerById('C001'), mins: 12, text: 'Can you do 40 sheets?' }); } catch (e) { t.fail('tdyAskCard threw: ' + e.message); }
    t.check(/Open <span class="m">#?2402/.test(card) && /data-act="order" data-id="2402"/.test(card) && !/>Take the order</.test(card), 'fix 2: a WhatsApp ask from a customer with an order on the move opens that order first');
    t.check(/RECENT/.test(X.ordFindRows('')) && /data-act="ordopen" data-id="2402"/.test(X.ordFindRows('')), 'Find an order shows the newest orders before anything is typed');
    t.check(!/Client name or order number|client’s name/.test(html) && !/'On road'/.test(html) && /--ink3:#656E80/.test(html) && !/#767F91/i.test(html), 'wording and contrast: customer (not client), On the road, and the small-print grey at 4.7:1');
    const quiet = { id: 'C9', name: 'Zed Hardware', phone: '', location: 'Kira', debt: 0, termsDays: null, creditLimit: null, debtLog: [] };
    X.S.data.customers.push(quiet); X.S.loadedAt = 52;
    t.check(!/data-act="custstmt"/.test(X.PAGE.customer({ id: 'C9' })) && /Statement<\/button>/.test(X.PAGE.customer({ id: 'C001' })), 'a statement button only when there is something to put on it, and it says Statement, not PDF');
  }

  // rows 18-19: one customer page, the tidy Add customer, the message read into lines, aisle marks, Asked of Sourcing
  {
    const X = loadPage(fakeDb({}));
    Object.assign(X.S, { data: fixture(), shopId: SH, user: { id: 'u1', email: 'a@b.c' }, shopName: 'Shop' });
    X.S.loadedAt = 61;
    const kc = X.PAGE.customer({ id: 'C001' });
    t.check(/data-act="sellto"/.test(kc) && /Sell to Kato/.test(kc) && !/>Usual</.test(kc), 'CustOne: one red Sell to <name> in the dock, whatever they owe');
    t.check(/Old balance/.test(kc) && /from the old book · no date/.test(kc) && /class="cu-bacts"/.test(kc), 'CustOne: the undated balance leads the bills, and Promise / Take sit at the card foot');
    X.S.sheet = { type: 'addcust', args: { for: '', phone: '', name: '', area: '' } };
    let add = ''; try { add = X.SHEET.addcust(X.S.sheet.args); } catch (e) { add = String(e); }
    t.check(!/id="cu_ncready"/.test(add) && !/cu-nctiles/.test(add) && /sets credit<\/b>/.test(add) && /cu-ncline/.test(add), 'AddCustTidy: no Ready pill, no tiles, one quiet line');
    t.check(/<path/.test(X.nwCatMark('Roofing')) && /<path/.test(X.nwCatMark('Plumbing pipes')) && X.nwCatMark('Garden') === '', 'AisleIcons: the common aisles draw a mark, any other keeps its initials');
    const picked = X.nwAskPick([{ productId: 'P4', qty: 1, qtySaid: false }, { productId: 'P3', qty: 2, qtySaid: true }]);
    t.check(picked.length === 1 && picked[0].productId === 'P3' && X.nwAskPick([{ productId: 'P4', qty: 1, qtySaid: false }]).length === 1, 'ChatToLines: a bare word is not an item when the message gives counts; alone, it still is');
    let sr = ''; try { sr = X.tdySrcRow(); } catch (e) { sr = ''; }
    t.check(typeof sr === 'string', 'TodaySrc: the Asked of Sourcing row draws (or hides) without throwing');
    t.check(/data-act="srcopen"/.test(html) && /Ask for something/.test(html) && /Send to /.test(html) && /SUPPLIERS ASKED/.test(html), 'SReqList / SReqLook / SReqAsk: rows open a request, an ask needs no order');
    t.check(/Sell at the counter/.test(html) && /data-act="tdyaddto"/.test(html) && /Take payment · /.test(html), 'FindItem and OrderPay: a found item sells or joins the order; an unpaid order takes payment');
  }

  // Sales round 1: data integrity (SAL-002..014)
  {
    const db = fakeDb({});
    const X = loadPage(db);
    Object.assign(X.S, { data: fixture(), shopId: SH, user: { id: 'u1', email: 'grace@shop.ug' }, shopName: 'Shop' });
    // SAL-002: Sales keeps its own sign-in; another login under the screen writes nothing.
    t.check(/storageKey: OW_AUTH_KEY/.test(html) && /const OW_AUTH_KEY = 'ow-sales-auth'/.test(html) && /'-auth-token'/.test(html), 'SAL-002: Sales keeps its own saved sign-in, carrying the old shared one over once');
    t.check(/onAuthStateChange/.test(html) && /addEventListener\('visibilitychange', \(\) => \{ if \(document\.visibilityState === 'visible'\) check\(\)/.test(html) && /addEventListener\('focus', \(\) => check\(\)\)/.test(html) && /Signed in as someone else/.test(html), 'SAL-002: the login is checked on sign-in events, on return to the tab and on focus, and a swap says so');
    X.S.loginLost = { email: 'x@other.ug', at: 1 };
    const w = await X.sb.from('cash_txns').insert({ amount: 1 }).select().maybeSingle(), rp = await X.sb.rpc('receive_payment', {});
    t.check(w.error && rp.error && db.writes.length === 0, 'SAL-002: while someone else is signed in, no write or call reaches the database');
    X.S.loginLost = null;
    // SAL-013: no whole-payload rewrite of an order; the four edits send only what they change.
    t.check(!/from\('saved_quotes'\)\.(update|upsert)/.test(html) && (html.match(/ordPatch\(/g) || []).length >= 5 && /sb\.rpc\('ow_patch_order'/.test(html), 'SAL-013: orders are changed through ow_patch_order with only the keys that change, never a stale payload');
    // SAL-014: a transfer between accounts is not money in.
    X.S.data.cashTxns = [{ id: 1, date: '2026-10-05', type: 'receipt', category: 'Sales Revenue', amount: 5000 }, { id: 2, date: '2026-10-05', type: 'receipt', category: 'Account Transfer', amount: 1000, transferId: 9 }, { id: 3, date: '2026-10-05', type: 'receipt', category: 'Other', amount: 700, transferId: 4 }];
    t.check(X.moneyIn('2026-10-01', '2026-10-31').length === 1, 'SAL-014: transfers between accounts are never money in');
    // SAL-003 / SAL-006: whole UGX per line; a line at 0 or below is off the bill.
    const ln = (qty, sellPrice) => ({ lineId: qty, productId: 'P1', variantIdx: null, qty, supplierId: 'S1', price: 32000, sellPrice });
    t.check(X.goodsTotal({ items: [ln(1.5, 333), ln(1, 1001), ln(2.5, 999.6)] }) === 500 + 1001 + 2499, 'SAL-003: each line is rounded to whole UGX before it is added, as the server does');
    t.check(X.goodsTotal({ items: [ln(-3, 1000), ln(2, -500), ln(1, 1000)] }) === 1000 && X.quoteTotal({ items: [ln(-3, 1000)], charges: [] }) === 0 && X.lineSettledOut({ items: [] }, ln(0, 1000)), 'SAL-006: a negative count or price never reaches a total, and a 0 line is off the bill');
    // SAL-004 / SAL-008 / SAL-009: a credit note never makes a bill negative; the cost floor weights the lots used; never "-0".
    t.check(X.quoteTotal({ items: [ln(1, 1000)], charges: [], creditNotes: [{ amount: 6000 }] }) === 0, 'SAL-004: a credit note larger than the bill leaves 0, never a negative bill');
    X.S.data.stockLots = { [X.stockKey('P1', null)]: [{ qty: 3, cost: 1000 }, { qty: 10, cost: 1200 }] };
    t.check(X.getFIFOUnitCost('P1', null, 5) === 1080, 'SAL-008: 5 from 3 at 1,000 and 10 at 1,200 cost 1,080 each, not the first lot\'s 1,000');
    t.check(X.n0(-0.4) === '0' && X.n0(-1) === '-1', 'SAL-009: never "-0"');
    // SAL-011: a balance that is not its bills says so, how far apart, and who checks it.
    const kato = X.S.data.customers.find(c => c.id === 'C001'), x = X.custAddsUp(kato);
    if (x) t.check(Math.abs(x.gap) >= 1 && /apart<\/b>/.test(X.custAddsUpHTML(kato)) && /data-act="custaskbal"/.test(X.custAddsUpHTML(kato)), 'SAL-011: a balance that is not its bills shows both, the gap, and the ask');
    const even = { ...kato, id: 'CZ', debt: 0, debtLog: [] };
    X.S.data.customers.push(even);
    t.check(X.custAddsUp(even) === null && X.custAddsUpHTML(even) === '', 'SAL-011: a balance that is its bills shows one figure, no card');
    const dep = { ...kato, id: 'CD', name: 'Deposit Co', debt: -50000, debtLog: [{ id: 1, type: 'payment', amount: 50000, quoteId: null, date: '2026-10-01' }] };
    X.S.data.customers.push(dep); X.S.loadedAt = 71;
    const dp = X.PAGE.customer({ id: 'CD' });
    t.check(/Deposit<\/span>/.test(dp) && /50,000/.test(dp) && !/-50,000/.test(dp) && X.custAddsUp(dep) === null, 'SAL-005: a balance below 0 reads as a deposit, never as 0 or a minus');
    // SAL-007: Today names an invoiced order with lines nobody priced.
    X.S.data.savedQuotes = [{ id: 541, status: 'completed', invoiced: true, voided: false, invoicedAt: X.todayISO ? X.todayISO() : new Date().toISOString().slice(0, 10), date: new Date().toISOString().slice(0, 10), amountPaid: 0, items: [ln(2, 5000), { lineId: 9, productId: 'PX', variantIdx: null, qty: 3, supplierId: 'S1', price: 0, sellPrice: null }], charges: [], payments: [] }];
    t.check(/#0541 · 1 line to price, not counted yet/.test(X.tdyToPriceChip()), 'SAL-007: Today names the invoiced order whose lines are still to price');
  }

  // Sales round 2: core workflows (SAL-015, SAL-016, SAL-018)
  {
    const X = loadPage(fakeDb({}));
    Object.assign(X.S, { data: fixture(), shopId: SH, user: { id: 'u1', email: 'g@shop.ug' }, shopName: 'Shop' });
    // SAL-015: a count under 1 goes back to the line, in the box and the line alike, and says why.
    X.S.draft = { client: { name: 'Kato Construction', phone: '' }, customerId: 'C001', items: [X.makeLine('P1', null, 3, { lineId: 7 })], q: '', openLine: 7 };
    for (const typed of ['-2', '0', '', 'abc']) {
      const box = { value: typed, dataset: { lid: '7' } };
      X.ACT['ch:lq'](box);
      const it = X.lineById(7);
      t.check(Number(it.qty) === 3 && box.value === '3' && /At least 1 — use the bin to remove it/.test(X.qtyBackHTML(7)), `SAL-015: "${typed}" puts the box back to 3, the line stays 3, and the note says why`);
    }
    const ok = { value: '5', dataset: { lid: '7' } }; X.ACT['ch:lq'](ok);
    t.check(Number(X.lineById(7).qty) === 5 && X.qtyBackHTML(7) === '', 'SAL-015: a real count is taken, and the note goes');
    const ctBox = { value: '0', dataset: { lid: '7' } }; X.ACT['ch:ctq'](ctBox);
    t.check(Number(X.lineById(7).qty) === 5 && ctBox.value === '5' && /At least 1/.test(X.qtyBackHTML(7)), 'SAL-015: the counter sale\'s count does the same');
    // SAL-016: the order's Credit gate says no limit is set, and who decides.
    const kato = X.S.data.customers.find(c => c.id === 'C001'); kato.creditLimit = null;
    const h = X.creditHoldFor(kato, 100000, { credit: { pct: 3, days: 30 } }), h2 = X.creditHoldFor({ ...kato, creditLimit: 9000000, debt: 0 }, 100000, { credit: { pct: 3, days: 30 } });
    t.check(h && h.noLimit && !h2 && !X.creditHoldFor({ ...kato, debt: 0 }, 100000, { credit: null }), 'SAL-016: credit with no limit set waits; within a limit, or for cash, it does not');
    // SAL-018: a test order or payment is listed and in no figure.
    const today = new Date().toISOString().slice(0, 10);
    X.S.data.cashTxns = [{ id: 1, date: today, type: 'receipt', category: 'Sales Revenue', amount: 5000 }, { id: 2, date: today, type: 'receipt', category: 'Invoice Payment', amount: 11500, description: 'ref TESTQA456', qa: true }];
    t.check(X.moneyIn(today, today).length === 1 && X.qaIn(today, today).length === 1, 'SAL-018: a test payment is not money in, and is still listed');
    t.check(!X.nmIsSale({ status: 'completed', invoiced: true, voided: false, qa: true }) && X.nmIsSale({ status: 'completed', invoiced: true, voided: false }), 'SAL-018: a test invoice is not in the goal');
    t.check(!X.custInFilter({ debt: 5000, qa: true }, 'owe') && X.custInFilter({ debt: 5000 }, 'owe'), 'SAL-018: a test customer is not among those who owe');
    t.check(/rowToQuote\(q\)\{[\s\S]*?qa: !!q\.qa/.test(html) && /qa: !!t\.qa/.test(html) && /qa: !!c\.qa/.test(html), 'SAL-018: the test mark is read from orders, receipts and customers');
  }

  process.exit(t.done() ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
