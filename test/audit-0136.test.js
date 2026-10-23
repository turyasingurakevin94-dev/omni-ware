#!/usr/bin/env node
'use strict';
/*
 * The audit of 19 October 2026, part one (0136_counter_sale_one_write.sql).
 *
 * Six things the apps did in several writes, or never, and the database
 * now does in one place. Each check below names the defect it pins:
 *
 *   1. A Sales login's counter sale was refused at the cash write (0123's
 *      cash_txns policy) after the order row was placed: a ghost order in
 *      Packing at every attempt. counter_sale() places, pays, delivers and
 *      invoices in ONE transaction, and sales.html calls nothing else.
 *   2. A trip line bought for the shelf (orderId 'restock') never reached
 *      stock: receive_trip() shelves it.
 *   3. The Manager's "cash first" let the order leave Checking at once:
 *      ow_gate_reason() holds 'cash' until paid, and the Buyer app agrees.
 *   4. A price the Buyer confirmed by phone, or paid on a trip, never
 *      counted in the day's share: both set price_source now.
 *   5. The Manager held restock_lines, a table nobody wrote; the Buyer
 *      writes restock_buys. The hold moves there; restock_lines is retired.
 *   6. A line the Buyer drops told nobody: the salesperson is pushed.
 *   7. The invoice label cut order ids past 9999 (INV-1000 for 10000).
 *   8. The Buyer's app said "moved" when the gate had held the order; the
 *      Manager's void gave back the line's quantity, not what the invoice
 *      took; the Manager counted pickStatus 'picked', a value the Store
 *      never writes.
 *
 * Run: node test/audit-0136.test.js
 */
const { read, createReporter } = require('./_extract');

const t = createReporter('the audit fixes of 0136');
const sql = read('supabase/migrations/0136_counter_sale_one_write.sql');
const sales = read('sales.html');
const buyer = read('buyer.html');
const manager = read('manager.html');
const doc = read('docs/decision-rights.md');
const fn = name => { const at = sql.indexOf('create or replace function ' + name + '('); if (at < 0) throw new Error('0136 has no ' + name); const open = sql.indexOf('$$', at); const end = sql.indexOf('$$;', open + 2); return sql.slice(at, end + 3); };

/* ---------------- 1. the counter sale, one write ---------------- */
{
  const cs = fn('counter_sale');
  t.check(/has_task\(p_shop_id, 'counter\.sell'\)/.test(cs) && /has_task\(p_shop_id, 'invoice\.make'\)/.test(cs), 'counter.sell (Sales) or invoice.make sells over the counter');
  t.check(/insert into cash_txns \(id, shop_id, date, account, type, category, amount, description, time, quote_id, entered_by\)/.test(cs) && /'receipt', 'Sales Revenue'/.test(cs), 'it writes the Sales Revenue receipt itself, past 0123\'s policy');
  t.check(/saved := ow_system_begin\(\);[\s\S]*ow_invoice_core\(p_shop_id, q\.id, 'counter_sale'/.test(cs) && /perform ow_system_end\(saved\);/.test(cs), 'then invoices through ow_invoice_core as the system, in the same transaction');
  t.check(/if why = 'price' then[\s\S]*return jsonb_build_object\('ok', true, 'waiting', 'price', 'id', q\.id\);/.test(cs), 'a price under the shop\'s price places the sale and waits for the Manager');
  t.check(/coalesce\(\(res ->> 'shortOnShelf'\)::boolean, false\)[\s\S]*raise exception 'Not enough on the shelf: %'/.test(cs), 'a short shelf refuses the whole sale, so nothing is left behind');
  t.check(/coalesce\(e ->> 'supplierId', ''\) <> '__stock__'\) then\s*raise exception 'A counter sale is only for goods on the shelf\.'/.test(cs), 'only shelf goods');
  t.check(/select coalesce\(max\(id\), 0\) into floor_id from saved_quotes;/.test(cs) && /select coalesce\(max\(id\), 0\) into floor_id from cash_txns;/.test(cs), 'row ids are issued above the whole table, which is one sequence across shops');
  t.check(sql.includes('grant execute on function counter_sale(uuid, bigint, jsonb, text, numeric) to authenticated;'), 'every login may call it; the function checks the task');
  // sales.html: the one call, and nothing of the old two-phase path
  // Through payRpc: the same one call, with the transaction ID (0155) added only when one was typed.
  t.check(/payRpc\('counter_sale', \{ p_shop_id: S\.shopId, p_quote_id: qid == null \? null : Number\(qid\), p_row: row \|\| null, p_method: method \|\| 'cash', p_given: Number\(given\) \|\| 0 \}, /.test(sales), 'sales.html sells through counter_sale');
  t.check(!/async function ctPlace\(/.test(sales) && !/async function ctPay\(/.test(sales), 'the two-phase ctPlace/ctPay path is gone');
  t.check(!/payCashRow\(ctx, pay, 'Sales Revenue'/.test(sales), 'the phone no longer writes the Sales Revenue receipt itself');
  t.check(/if \(r\.waiting\) \{ S\.stack = S\.stack\.filter\(x => x\.type !== 'neworder' && x\.type !== 'counter'\); push\('counterwait', \{ id: r\.id, method \}\)/.test(sales), 'a waiting sale opens the wait screen');
  t.check(/ACT\['slide:counterask'\] = ACT\['slide:counter'\];/.test(sales), 'asking the Manager is the same write');
  t.check(/function ctFailWords\(e\)\{[\s\S]*return 'Not sold — ' \+ m/.test(sales) && /This login can’t sell over the counter \(counter\.sell\)/.test(sales), 'a refusal says why, with the database\'s own reason');
  t.check(/refreshOne\(top\.args\.id\); \}, 6000\);/.test(sales) && /async function refreshOne\(id\)\{/.test(sales), 'the wait screen polls one row, not the whole table');
}

/* ---------------- 2. restock goods reach the shelf ---------------- */
{
  const rt = fn('receive_trip');
  t.check(/if coalesce\(l ->> 'orderId', ''\) = 'restock' and coalesce\(l ->> 'productId', ''\) <> '' then/.test(rt), 'a restock line is recognised by its orderId');
  t.check(/insert into stock_lots \(shop_id, key, qty, cost\) values \(p_shop, k, shelf_qty, case when price > 0 then round\(price \/ pk, 6\) end\);[\s\S]*update restock_buys set status = 'collected'/.test(rt), 'it is stocked with its cost lot and the restock line closed');
  t.check(/'restocked', restocked/.test(rt), 'the count comes back to the Store');
}

/* ---------------- 3. cash first holds until paid ---------------- */
{
  const g = fn('ow_gate_reason');
  t.check(/or \(dec ->> 'decision' = 'cash' and amt > 0\)\) then/.test(g), 'the gate holds a cash-first order while anything is unpaid');
  t.check(/function creditHolds\(q\)\{ const d = q && q\.creditCheck && q\.creditCheck\.decision; return d === 'hold' \|\| \(d === 'cash' &&/.test(buyer), 'the Buyer app reads the hold the same way');
}

/* ---------------- 4. phone and trip prices count ---------------- */
{
  t.check(/price_source = 'confirmed',[\s\S]{0,80}confirmed_via = 'phone'/.test(fn('buyer_confirm_price')), 'a phone confirmation is a confirmed price');
  const tp = fn('trip_prices_to_list');
  t.check(/price_source = 'purchase'/.test(tp) && /''buyer'', ''price\.confirm''/.test(tp), 'a trip\'s price is a purchase, logged as a confirmation');
}

/* ---------------- 5. the restock hold on restock_buys ---------------- */
{
  t.check(/check \(status in \('planned', 'held', 'on_trip', 'collected', 'cancelled'\)\)/.test(sql), 'restock_buys gains the held status');
  const h = fn('hold_restock_buy');
  t.check(/from restock_buys where id = p_id for update/.test(h) && /has_task\(r\.shop_id, 'restock\.hold'\)/.test(h) && /manager_log_decision\(r\.shop_id, 'restock\.hold'/.test(h), 'hold_restock_buy holds the Buyer\'s line under restock.hold and logs it');
  t.check(/create trigger restock_buys_ow_push after update on restock_buys/.test(sql) && /'restock\.held'/.test(sql) && /'restock\.released'/.test(sql), 'the Buyer is pushed on a hold and on a release');
  t.check(/drop table if exists restock_lines;/.test(sql) && /drop function if exists hold_restock_line\(uuid, boolean\);/.test(sql), 'restock_lines and its function are retired');
  t.check(/sb\.from\('restock_buys'\)\.select\('\*'\)\.eq\('shop_id', S\.shopId\)\.in\('status', \['planned', 'held'\]\)/.test(manager) && !/restock_lines/.test(manager.replace(/\/\*[\s\S]*?\*\//g, '')), 'the Manager reads restock_buys');
  t.check(/callFn\('hold_restock_buy', \{ p_id: t\.dataset\.id, p_hold: hold \}\)/.test(manager) && !/hold_restock_line/.test(manager), 'and holds through hold_restock_buy');
  t.check(/const held = \(D\(\)\.restockBuys \|\| \[\]\)\.find\(r => r\.status === 'held' && stockKey\(r\.productId, r\.variantIdx\) === key\);/.test(buyer), 'the Buyer sees a held line as held');
  t.check(/d\.kind === 'restock\.held' \|\| d\.kind === 'restock\.released'/.test(buyer), 'and a tapped release opens the list');
  t.check(/if \(u\.error\) throw u\.error; if \(r\) \{ r\.status = 'on_trip'; r\.tripId = trip\.id; \}/.test(buyer) && !/restockOnTrip\(trip\)\.catch\(\(\) => \{\}\)/.test(buyer) && !/restockCollected\(t\)\.catch\(\(\) => \{\}\)/.test(buyer), 'a failed restock write is said, not swallowed');
}

/* ---------------- 6. a dropped line tells the salesperson ---------------- */
{
  const p3 = fn('saved_quotes_ow_push3');
  t.check(/perform ow_push\(new\.shop_id, 'line\.dropped', 'A line came off the bill'/.test(p3) && /taker, null, null, jsonb_build_object\('table', 'saved_quotes', 'id', new\.id\), 'dropped:' \|\| new\.id \|\| ':' \|\| i\)/.test(p3), 'line.dropped goes to takenBy, once per dropped line');
  t.check(/create trigger saved_quotes_ow_push3 after update on saved_quotes/.test(sql), 'as a trigger on the order');
  t.check(/\['price\.decided', 'price\.changed', 'credit\.decided', 'line\.dropped', 'order\.invoiced'\]\.includes\(k\)/.test(sales), 'a tapped line.dropped opens the order in sales.html');
}

/* ---------------- 7. the invoice label keeps every digit ---------------- */
{
  const core = fn('ow_invoice_core');
  t.check(/inv_label text := 'INV-' \|\| case when length\(p_quote_id::text\) < 4 then lpad\(p_quote_id::text, 4, '0'\) else p_quote_id::text end;/.test(core), 'INV-10000 is INV-10000');
  const old = read('supabase/migrations/0135_customer_id_overflow.sql');
  const o = old.slice(old.indexOf('create or replace function ow_invoice_core('), old.indexOf('$$;', old.indexOf('$$', old.indexOf('create or replace function ow_invoice_core('))) + 3);
  const strip = s => s.replace(/inv_label text := [^\n]*\n/, '').replace(/\s+/g, ' ');
  t.check(strip(o) === strip(core), 'ow_invoice_core is 0135\'s but for that one line (if 0135 changes it, change it here too)');
}

/* ---------------- 8. the three app corrections ---------------- */
{
  t.check(/const u = await sb\.rpc\('ow_patch_order', \{ p_shop_id: S\.shopId, p_id: Number\(id\), p_patch: patch,/.test(buyer) && /const fresh = rowToQuote\(u\.data \|\| \{ \.\.\.row,/.test(buyer), 'the Buyer reads the row back after a move (0165 ow_patch_order hands it back)');
  t.check(/const held = q\.status !== before && fresh\.status === before && fresh\.gateHeldMove \? fresh\.gateHeldMove : null;/.test(buyer) && /function heldToast\(q, held\)/.test(buyer), 'and says when the gate held it, and why');
  t.check(/\.filter\(it => it\.productId && Number\(it\._stockTaken\) > 0\)\.map\(it => \(\{ key: stockKey\(it\.productId, it\.variantIdx\)[^}]*delta: Number\(it\._stockTaken\)/.test(manager), 'a void gives back what the invoice took (_stockTaken)');
  t.check(/throw new Error\('Voided, but the supplier bills for it could not be voided — '/.test(manager) && !/void_sale_bills'[^\n]*\.catch\(e => console\.warn\(e\)\)/.test(manager), 'a failed bill reversal is said');
  t.check(/it\.pickStatus === 'done' \|\| it\.pickStatus === 'short'/.test(manager) && !/pickStatus === 'picked'/.test(manager), 'the Manager counts the Store\'s pickStatus value');
}

/* ---------------- the record ---------------- */
t.check(/\| 0136 \| /.test(doc), 'docs/decision-rights.md reserves 0136 for it');

process.exit(t.done() ? 1 : 0);
