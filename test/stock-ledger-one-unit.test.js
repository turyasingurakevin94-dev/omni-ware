#!/usr/bin/env node
'use strict';
/*
 * A shelf is counted in ONE unit.
 *
 * ELEPHANT King, Short / Single Lock, on a real shop's books. Two suppliers
 * price it per Ctn and a third per Dozen, at twenty dozen to the carton.
 * Twelve cartons went on the shelf through the purchase screen -- which
 * read its unit off the supplier's row, so they went on as 12. Eight were
 * sold, in the same unit. Then somebody counted the shelf, and the count
 * screen read ITS unit off the cheapest row: dozens. 76 dozen were added
 * on top of 4 cartons, 80 of nothing, and the FIFO value of the shelf
 * became (4 x 290,000 + 76 x 14,000) / 80 = 27,800 a unit. The next
 * customer picture built a carton price off that -- 566,000 for a carton
 * whose list price is 300,000 -- and would have sent it on WhatsApp.
 *
 * Same stock key, two units, no guard. Now there is one reader for what a
 * shelf is counted in (stockUnitFor) and one converter every movement
 * passes through on its way on or off (stockMoveOnRowUnit). A carton is
 * twenty dozen whichever door it comes through.
 *
 * And the habit the picture is built on: the average of 1, 4, 1 and 1
 * cartons is 35 dozen, which is whole in dozens and "1.8 Ctn" to the shop.
 * A packed habit is rounded on the pack, so it reads 2 Ctn.
 *
 * Run: node test/stock-ledger-one-unit.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('stock ledger, one unit');
const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);
const near = (got, want, msg) => t.check(Math.abs(Number(got) - want) < 1e-6, `${msg} (got ${JSON.stringify(got)}, want ${want})`);
const src = read('index.html');
const shared = read('shared-worker.js');
const SHARED = ['orderLineIsBoughtIn', 'quoteLineReceived', 'quoteLineComesOffShelf'];
const fnOf = (n) => (SHARED.includes(n) ? extractFunction(shared, n, 'shared-worker.js') : extractFunction(src, n, 'index.html'));

/* ---- the shelf as the shop has it on file --------------------------- */
const SHAFIK = { id: 1, productId: 'P073', variantIdx: 0, supplierId: 'S-SHAFIK', sname: 'Shafik Katwe',
  unit: 'Ctn', packQty: 0, packUnit: '', wholesale: 290000, retail: 300000, tiers: [], outOfStock: false };
const ROTO = { id: 2, productId: 'P073', variantIdx: 0, supplierId: 'S-ROTO', sname: 'Roto Industry',
  unit: 'ctn', packQty: 0, packUnit: '', wholesale: 290000, retail: 300000, tiers: [], outOfStock: false };
const DOZENS = { id: 3, productId: 'P073', variantIdx: 0, supplierId: 'S-LOCAL', sname: 'Local Trader',
  unit: 'Dozen', packQty: 20, packUnit: 'Ctn', wholesale: 14500, retail: 15000, tiers: [], outOfStock: false };
const LOOSE = { id: 4, productId: 'P-WIRE', variantIdx: null, supplierId: 'S-LOCAL', sname: 'Local Trader',
  unit: 'Kg', packQty: 0, packUnit: '', wholesale: 4000, retail: 4500, tiers: [], outOfStock: false };
const CTN_OF_CTN = { id: 5, productId: 'P-ODD', variantIdx: null, supplierId: 'S-LOCAL', sname: 'Local Trader',
  unit: 'Ctn', packQty: 12, packUnit: 'ctn', wholesale: 1000, retail: 1100, tiers: [], outOfStock: false };
const data = { prices: [SHAFIK, ROTO, DOZENS, LOOSE, CTN_OF_CTN], products: [
  { id: 'P073', name: 'ELEPHANT King', variants: [{ combo: { Type: 'Short / Single Lock' } }] },
  { id: 'P-WIRE', name: 'Wire' }, { id: 'P-ODD', name: 'Odd' }],
  stock: {}, stockLots: {}, stockLog: [], nextStockLogId: 1, savedQuotes: [] };
const base = {
  data,
  cmpUnitKey: (s) => String(s || '').trim().toLowerCase(),
  productPriceRows: (pid, vi = null) => data.prices.filter((p) => p.productId === pid
    && (p.variantIdx == null ? null : p.variantIdx) === vi),
  rankedPriceRows: (pid, vi = null) => base.productPriceRows(pid, vi).filter((r) => !r.outOfStock),
  todayISO: () => '2026-09-07',
  productVariantLabel: (p, vi) => (vi == null ? p.name : `${p.name} — ${Object.values(p.variants[vi].combo).join(' / ')}`),
  allocRowId: () => data.nextStockLogId++,
  supplierName: (id) => ({ 'S-SHAFIK': 'Shafik Katwe', 'S-ROTO': 'Roto Industry', 'S-LOCAL': 'Local Trader' }[id] || id),
  fmtUGX: (n) => `${Math.round(n).toLocaleString('en-US')} UGX`,
  toast: () => {},
};

/* ---------- 1. one reader for what the shelf is counted in ------------ */
{
  const u = compileScope(['stockUnitFor', 'stockMoveOnRowUnit', 'invPackContextFor'].map(fnOf), base,
    ['stockUnitFor', 'stockMoveOnRowUnit', 'invPackContextFor']);
  const shelf = u.stockUnitFor('P073', 0);
  eq(shelf.unit, 'Dozen', 'the shelf is counted in the unit of the row that carries a pack');
  eq(shelf.packUnit + shelf.packQty, 'Ctn20', 'and packed the way that row says');
  // Whichever order the rows are on file in.
  data.prices = [DOZENS, SHAFIK, ROTO, LOOSE, CTN_OF_CTN];
  eq(u.stockUnitFor('P073', 0).unit, 'Dozen', 'the same answer with the rows in another order');
  data.prices = [SHAFIK, ROTO, DOZENS, LOOSE, CTN_OF_CTN];
  eq(u.stockUnitFor('P-WIRE', null).unit, 'Kg', 'a shelf nothing packs is counted in the first unit on file');
  eq(u.stockUnitFor('P-WIRE', null).hasPack, false, 'with no pack');
  eq(u.stockUnitFor('P-ODD', null).hasPack, false, 'a row packed in its own unit -- cartons of cartons -- is not a pack');
  eq(u.stockUnitFor('P-NONE', null).unit, '', 'and a product with no rows has no unit to be counted in');

  /* The count screen and the purchase screen both read it from here.
     The supplier used to change the answer; it no longer can. */
  const asShafik = u.invPackContextFor('P073', 0, 'S-SHAFIK');
  eq(asShafik.unit, 'Dozen', 'the count screen counts in the shelf\'s unit even when asked about a supplier priced per Ctn');
  eq(asShafik.hasPack && asShafik.packQty, 20, 'and still offers the carton, as twenty dozen');

  /* ---- and one converter every movement passes through ---- */
  const two = u.stockMoveOnRowUnit('P073', 0, 2, 'Ctn', 290000);
  eq(two.qty, 40, 'two cartons go on the shelf as forty dozen');
  near(two.cost, 14500, 'at a twentieth of the carton price each');
  eq(two.converted, true, 'and say they were converted');
  eq(u.stockMoveOnRowUnit('P073', 0, 4, 'ctn', null).qty, 80, 'case does not matter, and no cost stays no cost');
  eq(u.stockMoveOnRowUnit('P073', 0, 3, 'Dozen', 14000).qty, 3, 'a movement already in dozens passes through');
  eq(u.stockMoveOnRowUnit('P073', 0, 3, '', 14000).qty, 3, 'as does one with no unit written beside it');
  const box = u.stockMoveOnRowUnit('P073', 0, 3, 'Box', 5000);
  eq(box.qty, 3, 'a unit nothing on file joins to the shelf\'s is left as written');
  eq(box.joined, false, 'and named as such, rather than guessed at');
  eq(u.stockMoveOnRowUnit('P073', 0, 1, 'Ctn', 300000, { packQty: 24, packUnit: 'Ctn' }).qty, 24,
    'a line that carries its own pack size is read by it, as the receipt reader always has been');
  eq(u.stockMoveOnRowUnit('P-WIRE', null, 5, 'Roll', 100).joined, false,
    'an unpacked shelf converts nothing');
}

/* ---------- 2. the shelf, replayed both ways ------------------------- */
/*
 * The exact movements off the stock log, once as the app wrote them and
 * once through the converter. The first replay reproduces the 27,800;
 * the second values the shelf at what a dozen costs.
 */
{
  const N = ['stockKey', 'addStockLot', 'consumeStockLots', 'restoreStockLots', 'getFIFOUnitCost',
    'applyStockDelta', 'stockOnHand', 'getStockQty', 'shelfValueForKey', 'stockUnitFor', 'stockMoveOnRowUnit'];
  const s = compileScope(N.map(fnOf), base, N);
  const reset = () => { data.stock = {}; data.stockLots = {}; data.stockLog = []; };
  const moves = [
    ['restock', 2, 'Ctn', 290000], ['restock', 4, 'Ctn', 290000], ['restock', 6, 'Ctn', 290000],
    ['sale', -8, 'Ctn', null],
    ['correction', 56, 'Dozen', 14000], ['correction', 20, 'Dozen', 14000],
  ];

  reset();
  moves.forEach(([type, d, , cost]) => s.applyStockDelta('P073', 0, d, type, '', cost));
  const asWritten = s.shelfValueForKey('P073::0');
  eq(asWritten.qty, 80, 'as the app wrote it: 4 cartons and 76 dozen make "80"');
  near(asWritten.unitCost, 27800, 'valued at 27,800 each -- the figure the customer picture was built on');

  reset();
  moves.forEach(([type, d, unit, cost]) => {
    const m = s.stockMoveOnRowUnit('P073', 0, Math.abs(d), unit, cost);
    s.applyStockDelta('P073', 0, Math.sign(d) * m.qty, type, '', m.cost);
  });
  const converted = s.shelfValueForKey('P073::0');
  eq(converted.qty, 156, 'through the converter: 80 dozen left of 240, plus the 76 counted in');
  t.check(converted.unitCost >= 14000 && converted.unitCost <= 14500,
    `valued at what a dozen costs (${converted.unitCost})`);
  near(Math.round(converted.unitCost * 20), Math.round(((80 * 14500) + (76 * 14000)) / 156 * 20),
    'so a carton off this shelf is priced off dozens, not off a mixed count');
}

/* ---------- 3. every door onto and off the shelf ---------------------- */
{
  const moved = [];
  const N = ['receiveQuoteLine', 'unreceiveQuoteLine', 'applyQuoteStockDeduction', 'applyQuoteSurplusToStock',
    'quoteLineUnitsBought', 'quoteLineSurplus', 'tiersForKind', 'tieredUnitPrice', 'ipLineOutlay',
    'orderLineIsBoughtIn', 'quoteLineReceived', 'quoteLineComesOffShelf', 'stockUnitFor', 'stockMoveOnRowUnit'];
  const env = Object.assign({}, base, {
    applyStockDelta: (pid, vi, delta, type, note, cost) => moved.push({ delta, type, note, cost }),
    getStockQty: () => 1000,
    syncPriceRegistryFromPurchase: () => {},
  });
  const s = compileScope(N.map(fnOf), env, N);

  // Bought in from Roto, who sells by the carton: the line says 2 Ctn.
  const line = { productId: 'P073', variantIdx: 0, unit: 'Ctn', qty: 2, supplierId: 'S-ROTO', price: 290000, sellPrice: 300000 };
  s.receiveQuoteLine(line, 2, 290000, { client: { name: 'Bright' } });
  eq(moved[0].delta, 40, 'a receipt of 2 Ctn puts 40 dozen on the shelf');
  near(moved[0].cost, 14500, 'at 14,500 a dozen');
  t.check(/2 Ctn/.test(moved[0].note), `and the log row says what came through the door (${moved[0].note})`);
  eq(line.receivedQty, 2, 'while the line keeps the supplier\'s words: 2');
  eq(line.receivedOnShelf, 40, 'and remembers what that put on the shelf');

  s.unreceiveQuoteLine(line);
  eq(moved[1].delta, -40, 'undoing the receipt takes back exactly what was put on');
  eq(line.receivedOnShelf, undefined, 'and forgets it with the rest of the receipt');
  // A receipt recorded before the shelf figure was written down.
  const old = { productId: 'P073', variantIdx: 0, unit: 'Ctn', qty: 1, supplierId: 'S-ROTO', receivedQty: 1, receivedAt: 'x' };
  s.unreceiveQuoteLine(old);
  eq(moved[2].delta, -20, 'an older receipt is taken back the way it would be put on today');

  // The customer's share leaves the same way.
  s.receiveQuoteLine(line, 2, 290000, { client: { name: 'Bright' } });
  const q = { client: { name: 'Bright' }, items: [line] };
  s.applyQuoteStockDeduction(q);
  eq(moved[4].delta, -40, 'invoicing 2 Ctn off a shelf counted in dozens takes forty dozen');
  eq(line._stockTaken, 40, 'and the line remembers the shelf figure, for the reversal');

  // A shelf-sourced line written in the shelf's unit is untouched.
  const loose = { productId: 'P073', variantIdx: 0, unit: 'Dozen', qty: 3, supplierId: '__stock__' };
  s.applyQuoteStockDeduction({ client: { name: 'X' }, items: [loose] });
  eq(moved[5].delta, -3, 'three dozen off the shelf is three');
}

/* ---------- 4. the purchase screen reads the shelf, not the supplier -- */
{
  const stage = extractFunction(src, 'renderInvPurchaseStage', 'index.html');
  t.check(/const shelf = stockUnitFor\(invProductId, variantIdx\);/.test(stage),
    'the purchase form takes its unit and pack from the shelf');
  t.check(!/contextRow\.packQty/.test(stage) && !/contextRow \? Number\(contextRow\.packQty\)/.test(stage),
    'and no longer from whichever supplier is ticked');
  t.check(/const rowInPack = \(r\)=>/.test(stage) && /rowPerUnit\(selectedRow, selectedRow\.purchasePrice\)/.test(stage),
    'a supplier priced by the shelf\'s pack is read as a pack price');
  t.check(/invPurchaseQtyUnitMode = 'pack'; invPurchasePriceUnitMode = 'pack';/.test(stage),
    'and the form opens in that supplier\'s own words -- cartons');
  t.check(/nothing on file says how many \$\{esc\(unit\)\} make a \$\{esc\(selectedRow\.unit\)\}/.test(stage),
    'a supplier whose unit nothing joins to the shelf\'s is named, not converted by guesswork');
  const saveAt = src.indexOf('__btn_inv_purchase_save_btn');
  const save = src.slice(saveAt, src.indexOf('\nfunction ', saveAt));
  t.check(save.length > 0 && save.length < 20000, 'the save handler is where it was');
  t.check(/syncPriceRegistryFromPurchase\(invProductId, variantIdx, invPurchaseSupplierId, said\.price, said\.qty, \{confirms: true, unit: said\.unit\}\)/.test(save),
    'the registry is told the price in the supplier\'s row\'s own unit');
  t.check(/const billRow = selectedRow \? Object\.assign\(\{\}, selectedRow, \{ unit, packUnit, packQty \}\) : null;/.test(save),
    'and the bill carries the shelf\'s unit, which is the unit the ledger row it is read against is in');
  const count = src.slice(src.indexOf('function renderInvStage'), src.indexOf('function renderInvPurchaseStage'));
  t.check(/const packCtx = invPackContextFor\(invProductId, variantIdx\);/.test(count),
    'the count screen reads the same reader');
  const ctx = extractFunction(src, 'invPackContextFor', 'index.html');
  t.check(/return stockUnitFor\(productId, variantIdx\);/.test(ctx) && !/supplierId \?/.test(ctx),
    'which no longer looks at the supplier at all');
  const buy = extractFunction(src, 'receiveBuyOrder', 'index.html');
  t.check(/const put = stockMoveOnRowUnit\(l\.productId, vi, l\.qty, l\.unit, l\.unitCost, l\);/.test(buy)
    && /applyStockDelta\(l\.productId, vi, put\.qty, 'restock'/.test(buy),
    'a delivery against the shop\'s own buy order goes on in the shelf\'s unit too');
}

/* ---------- 5. the habit reads in whole cartons ----------------------- */
{
  const N = ['stockUnitFor', 'stockMoveOnRowUnit', 'habitLineOnRowUnit', 'customerProductHabits', 'quoteLinePack'];
  const env = Object.assign({}, base, {
    customerOrdersFor: () => data.savedQuotes,
    daysBetweenISO: (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000),
    pairLastsDays: () => 0,
    quoteItemSellPrice: (it) => Number(it.sellPrice) || 0,
  });
  const h = compileScope([extractDeclaration(src, 'TELL_MIN_ORDERS', 'index.html'), ...N.map(fnOf)], env, N);
  const ctn = (id, when, qty) => ({ id, invoiced: true, invoicedAt: when, items: [
    { productId: 'P073', variantIdx: 0, unit: 'Ctn', qty, supplierId: 'S-ROTO', price: 290000, sellPrice: 300000 }] });
  // Bright: 1, 4, 1 and 1 cartons, every five days or so.
  data.savedQuotes = [ctn(1, '2026-08-20', 1), ctn(2, '2026-08-25', 4), ctn(3, '2026-08-30', 1), ctn(4, '2026-09-04', 1)];
  const bright = h.customerProductHabits('C-BRIGHT')[0];
  eq(bright.unit, 'Dozen', 'the habit is kept in the shelf\'s unit');
  eq(bright.asPack && bright.asPack.packQty, 20, 'and knows it was bought by the carton');
  eq(bright.typicalQty, 40, 'the average of 35 dozen is rounded on the carton: 40, which reads as 2 Ctn -- not 1.8');
  near(bright.lastPrice, 15000, 'the receipt figure is still a dozen\'s');

  // A packed habit is never less than one pack.
  data.savedQuotes = [ctn(1, '2026-08-20', 1), ctn(2, '2026-08-25', 1), ctn(3, '2026-08-30', 1)];
  eq(h.customerProductHabits('C-ONE')[0].typicalQty, 20, 'one carton a time is one carton');
  const half = (id, when) => ({ id, invoiced: true, invoicedAt: when, items: [
    { productId: 'P073', variantIdx: 0, unit: 'Dozen', packUnit: 'Ctn', packQty: 20, qtyIn: 'pack', qty: 10, supplierId: 'S-LOCAL', sellPrice: 15000 }] });
  data.savedQuotes = [half(1, '2026-08-20'), half(2, '2026-08-25')];
  eq(h.customerProductHabits('C-HALF')[0].typicalQty, 20, 'half a carton at a time is rounded up to the carton it is chosen in');

  // A loose habit is rounded as it always was.
  const kg = (id, when, qty) => ({ id, invoiced: true, invoicedAt: when, items: [
    { productId: 'P-WIRE', variantIdx: null, unit: 'Kg', qty, supplierId: '__stock__', sellPrice: 4500 }] });
  data.savedQuotes = [kg(1, '2026-08-20', 3), kg(2, '2026-08-25', 4)];
  const wire = h.customerProductHabits('C-WIRE')[0];
  eq(wire.asPack, null, 'wire is bought loose');
  eq(wire.typicalQty, 4, 'and its average of 3.5 kg rounds to 4, as before');
}

process.exit(t.done() ? 1 : 0);
