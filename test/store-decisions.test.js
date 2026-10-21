#!/usr/bin/env node
'use strict';
/*
 * The Store proposes, the Manager decides (0124, docs/decision-rights.md).
 *
 *   1. The migration: receive_trip asks has_task('stock.receive'), and no
 *      decision 0122 already owns is built a second time here.
 *   2. The shelf unit: the Store app's shelfPackFor agrees with the
 *      console's stockMoveOnRowUnit on what one of a line's units is on the
 *      shelf -- the figure receive_trip multiplies by.
 *   3. The Store app puts a trip on the shelf through receive_trip, never
 *      by writing stock itself; reports and returns go where 0122/0123
 *      decide them; riding a trip draws no price.
 *
 * Run: node test/store-decisions.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('store decisions');
const sql = read('supabase/migrations/0124_store_decisions.sql');
const store = read('store.html');
const admin = read('index.html');

/* ---------------- 1. the migration ---------------- */
const fnBody = name => { const i = sql.indexOf(`create or replace function ${name}(`); if (i < 0) return ''; return sql.slice(i, sql.indexOf('$$;', sql.indexOf('as $$', i)) + 3); };
const rcv = fnBody('receive_trip');
t.check(rcv.includes("has_task(p_shop, 'stock.receive')"), 'receive_trip asks has_task for stock.receive');
t.check(/security definer/.test(rcv) && /set search_path = public/.test(rcv), 'receive_trip runs as definer with a fixed search_path');
t.check(/revoke all on function receive_trip\(/.test(sql) && /grant execute on function receive_trip\(uuid, text, jsonb\) to authenticated/.test(sql), 'receive_trip is revoked from public and granted to authenticated');
t.check(/revoke all on function next_stock_log_id\(uuid\) from public, anon, authenticated/.test(sql), 'the stock log id helper is not callable from a phone');
t.check(/\('store', 'stock\.receive'\)/.test(sql) && /\('store', 'stock\.report'\)/.test(sql) && /\('store', 'trip\.collect'\)/.test(sql), 'the Store is granted receive, report and trip.collect');
t.check(!/\('(store|manager)', '(trip\.difference|stock\.writeoff|pick\.settle|credit_note\.raise)'\)/.test(sql), 'no decision is granted here: the Manager\'s are 0122\'s, and nobody decides their own exception');
t.check(!/create (table|or replace function) (if not exists )?(stock_reports|write_off_stock|accept_trip_difference|stock_returns)\b/.test(sql), 'no second copy of 0122\'s reports, write-off or trip difference');
t.check(/'restock'/.test(rcv) && /stock_lots/.test(rcv) && /'receipts'/.test(rcv) && /'receivedOnShelf'/.test(rcv), 'receive_trip writes what receiveQuoteLine writes: receipts, stock, a lot, a restock row');
t.check(/round\(n \* pk, 6\)/.test(rcv) && /price \/ pk/.test(rcv), 'onto the shelf in the shelf\'s unit, at the cost per shelf unit');
t.check(/'awaiting_goods'/.test(rcv) && /'preparing'/.test(rcv) && /prepay/.test(rcv), 'an order whose goods are all in moves Buying -> Packing, the prepay gate holding');
t.check(/'yardQty', n/.test(rcv) && /yard_checked_at = coalesce\(yard_checked_at, now\(\)\)/.test(rcv), 'the count rides on the lines and the trip is marked counted, so 0122\'s accept_trip_difference reads it');
t.check(/has_task\(shop_id, 'route\.lock'\)/.test(sql), 'naming a direction is route.lock');

/* ---------------- 2. the shelf unit ---------------- */
const units = [
  { productId: 'P1', variantIdx: 1, unit: 'pc', packUnit: 'bundle', packQty: 20 },
  { productId: 'P4', variantIdx: null, unit: 'doz', packUnit: 'ctn', packQty: 10 },
  { productId: 'P2', variantIdx: null, unit: 'bag', packUnit: '', packQty: 0 },
  { productId: 'P9', variantIdx: null, unit: 'ctn', packUnit: 'ctn', packQty: 12 },
];
const S = { data: { units } };
const scope = compileScope([extractFunction(store, 'cmpUnit'), extractFunction(store, 'shelfPackFor')], { D: () => S.data }, ['cmpUnit', 'shelfPackFor']);
const prices = units.map(u => ({ productId: u.productId, variantIdx: u.variantIdx, unit: u.unit, packUnit: u.packUnit, packQty: u.packQty }));
const adminScope = compileScope([extractFunction(admin, 'stockUnitFor'), extractFunction(admin, 'stockMoveOnRowUnit')], {
  cmpUnitKey: s => String(s || '').trim().toLowerCase(),
  productPriceRows: (pid, vi) => prices.filter(r => r.productId === pid && r.variantIdx === vi),
}, ['stockMoveOnRowUnit']);
[{ productId: 'P1', variantIdx: 1, unit: 'bundle' }, { productId: 'P1', variantIdx: 1, unit: 'pc' }, { productId: 'P4', variantIdx: null, unit: 'ctn' },
 { productId: 'P4', variantIdx: null, unit: 'doz' }, { productId: 'P2', variantIdx: null, unit: 'bag' }, { productId: 'P9', variantIdx: null, unit: 'ctn' },
 { productId: 'P1', variantIdx: 1, unit: 'bundle', packUnit: 'bundle', packQty: 25 }].forEach(l => {
  const mine = scope.shelfPackFor(l), theirs = adminScope.stockMoveOnRowUnit(l.productId, l.variantIdx, 1, l.unit, null, l).qty;
  t.check(mine === theirs, `one ${l.unit} of ${l.productId}${l.packQty ? ' (line pack ' + l.packQty + ')' : ''} goes on the shelf as ${theirs}, as the console says (store said ${mine})`);
});

/* ---------------- 3. the apps ---------------- */
t.check(/sb\.rpc\('receive_trip', \{ p_shop: S\.shopId, p_trip: tripId, p_lines: lines \}\)/.test(store), 'the Store app puts a trip on the shelf through receive_trip');
t.check(!/from\('(stock|stock_lots|stock_log)'\)\.(insert|update|upsert|delete)/.test(store), 'the Store app never writes stock, lots or the stock log itself');
t.check(!/console still puts it on the shelf/i.test(store), 'no "the console still puts it on the shelf"');
t.check(/from\('stock_reports'\)\.insert\(\{[^}]*why: reason, photo_path: photo/.test(store), 'the Store app reports into 0122\'s stock_reports, in its columns');
t.check(/from\('invoice_asks'\)\.insert\(\{[^}]*kind: 'credit'/.test(store), 'goods back at the gate are a credit ask (0123)');
t.check(/from\('road_names'\)\.upsert/.test(store), 'the Store app names directions');
t.check(!/\b(gotPrice|expectedPrice|receivedPrice|cash_given)\b/.test(store.slice(store.indexOf('PAGE.ride'), store.indexOf("ACT['slide:ride']"))), 'riding a trip shows no price and no cash');
/* ---------------- 4. returns count in the line's own unit ---------------- */
// A "1 Ctn" line of screws is 20 boxes: one carton back is qty 20 and reads "1 Ctn", never "20 Ctn";
// five boxes back is qty 5 and reads "5 box"; what is already on its way back is not offered twice.
const R = { data: { returns: [] } };
const rs = compileScope(['n0', 'quoteLinePack', 'quoteLineCountPer', 'backText', 'returnedQty'].map(f => extractFunction(store, f)), { D: () => R.data }, ['backText', 'returnedQty']);
const ctn = { productName: 'ABC Black Screws', unit: 'box', qty: 20, packUnit: 'Ctn', packQty: 20, qtyIn: 'pack' };
t.check(rs.backText(ctn, 20) === '1 Ctn', `one carton back reads "1 Ctn" (got "${rs.backText(ctn, 20)}")`);
t.check(rs.backText(ctn, 5) === '5 box', `five boxes back read "5 box" (got "${rs.backText(ctn, 5)}")`);
t.check(rs.backText(ctn, 25) === '1 Ctn + 5 box', `25 boxes read "1 Ctn + 5 box" (got "${rs.backText(ctn, 25)}")`);
t.check(rs.backText({ unit: 'bag', qty: 4 }, 3) === '3 bag', 'a line with no pack reads in its own unit');
const q494 = { id: 2494, items: [ctn], creditNotes: [] };
R.data.returns = [{ id: 'a1', orderId: 2494, status: 'sent', lines: [{ idx: 0, qty: 5 }] }, { id: 'a2', orderId: 2494, status: 'withdrawn', lines: [{ idx: 0, qty: 20 }] }];
t.check(rs.returnedQty(q494, 0) === 5, 'a pending return counts against the line; a withdrawn one does not');
R.data.returns.push({ id: 'a3', orderId: 2494, status: 'accepted', lines: [{ idx: 0, qty: 3 }] });
q494.creditNotes = [{ askId: 'a3', lines: [{ idx: 0, qty: 3 }] }];
t.check(rs.returnedQty(q494, 0) === 8, 'an accepted return and the credit note it became count once');
t.check(!/qty: ui\.back\[k\] \* /.test(store) && /shown: backText\(it, ui\.back\[k\]\)/.test(store), 'the return stores the count as entered and the receipt shows it in packs and units');
process.exit(t.done() ? 1 : 0);
