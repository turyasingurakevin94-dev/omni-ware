#!/usr/bin/env node
'use strict';
/*
 * The Store proposes, the Manager decides (0124, docs/decision-rights.md).
 *
 *   1. The migration: each decision is a function that asks has_task for
 *      the role the doc gives it, and the tables a Store login writes take
 *      only a proposal (a report 'reported', a return 'proposed').
 *   2. The shelf unit: the Store app's shelfPackFor agrees with the
 *      console's stockMoveOnRowUnit on what one of a line's units is on the
 *      shelf -- the figure receive_trip multiplies by.
 *   3. The apps: the Store app puts a trip on the shelf through
 *      receive_trip, never by writing stock itself; the Manager app decides
 *      through the three functions; neither draws a price.
 *
 * Run: node test/store-decisions.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('store decisions');
const sql = read('supabase/migrations/0124_store_decisions.sql');
const store = read('store.html');
const mgr = read('manager.html');
const admin = read('index.html');

/* ---------------- 1. the migration ---------------- */
const fnBody = name => { const i = sql.indexOf(`create or replace function ${name}(`); if (i < 0) return ''; return sql.slice(i, sql.indexOf('$$;', sql.indexOf('as $$', i)) + 3); };
[['receive_trip', 'stock.receive'], ['accept_trip_difference', 'trip.difference'], ['write_off_stock', 'stock.writeoff'],
 ['ask_about_report', 'stock.writeoff'], ['settle_short_pick', 'pick.settle']].forEach(([fn, task]) => {
  const b = fnBody(fn);
  t.check(b && b.includes(`has_task(`) && b.includes(`'${task}'`), `${fn} asks has_task for ${task}`);
  t.check(b && /security definer/.test(b) && /set search_path = public/.test(b), `${fn} runs as definer with a fixed search_path`);
  t.check(new RegExp(`revoke all on function ${fn}\\(`).test(sql) && new RegExp(`grant execute on function ${fn}\\([^)]*\\) to authenticated`).test(sql), `${fn} is revoked from public and granted to authenticated`);
});
t.check(/\('store', 'stock\.receive'\)/.test(sql) && /\('store', 'stock\.report'\)/.test(sql) && /\('store', 'trip\.collect'\)/.test(sql), 'the Store is granted receive, report and trip.collect');
t.check(/\('manager', 'trip\.difference'\)/.test(sql) && /\('manager', 'stock\.writeoff'\)/.test(sql) && /\('manager', 'pick\.settle'\)/.test(sql), 'the Manager is granted the three decisions');
t.check(!/\('store', '(trip\.difference|stock\.writeoff|pick\.settle|credit_note\.raise)'\)/.test(sql), 'nobody decides their own exception: the Store is granted no decision');
t.check(/for insert with check \(has_task\(shop_id, 'stock\.report'\) and reported_by = auth\.uid\(\) and status = 'reported'\)/.test(sql), 'a report goes in only as reported, by the one reporting it');
t.check(/status = 'proposed'\)/.test(sql) && !/on stock_returns\s+for update/.test(sql), 'a return goes in only as proposed and is never edited from a phone');
t.check(!/on stock_reports\s+for (update|delete)/.test(sql), 'no phone edits or deletes a report; the decision goes through the functions');
const rcv = fnBody('receive_trip');
t.check(/'restock'/.test(rcv) && /stock_lots/.test(rcv) && /'receipts'/.test(rcv) && /'receivedOnShelf'/.test(rcv), 'receive_trip writes what receiveQuoteLine writes: receipts, stock, a lot, a restock row');
t.check(/round\(n \* pk, 6\)/.test(rcv) && /price \/ pk/.test(rcv), 'onto the shelf in the shelf\'s unit, at the cost per shelf unit');
t.check(/'awaiting_goods'/.test(rcv) && /'preparing'/.test(rcv) && /prepay/.test(rcv), 'an order whose goods are all in moves Buying -> Packing, the prepay gate holding');
t.check(/difference_status = case when jsonb_array_length\(diffs\) > 0 then 'open'/.test(rcv), 'a count unlike the Buyer\'s is held open for the Manager');
t.check(/'damaged'/.test(fnBody('write_off_stock')) && /order by id/.test(fnBody('write_off_stock')), 'a write-off takes the oldest lots first and logs a damaged row');

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
t.check(/from\('stock_reports'\)\.insert/.test(store) && /from\('stock_returns'\)\.insert/.test(store) && /from\('road_names'\)\.upsert/.test(store), 'the Store app reports, proposes returns and names directions');
t.check(!/\b(gotPrice|expectedPrice|receivedPrice|cash_given)\b/.test(store.slice(store.indexOf('PAGE.ride'), store.indexOf("ACT['slide:ride']"))), 'riding a trip shows no price and no cash');
t.check(/sb\.rpc\('settle_short_pick'/.test(mgr) && /sb\.rpc\('accept_trip_difference'/.test(mgr) && /sb\.rpc\(v === 'off' \? 'write_off_stock' : 'ask_about_report'/.test(mgr), 'the Manager app decides through the 0124 functions');
t.check(/owner's log/.test(mgr.slice(mgr.indexOf('PAGE.storeasks'), mgr.indexOf('ACT.sadecide'))), 'each Manager decision says it goes to the owner\'s log');

process.exit(t.done() ? 1 : 0);
