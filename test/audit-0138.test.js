#!/usr/bin/env node
'use strict';
/*
 * The audit of 19 October 2026, part three (0138): one order driven from
 * Sales through Buyer, Store, Manager and Accounts on a database with two
 * shops in it. The run itself is in docs/verification/2026-10-19/README.md
 * section 7. What it found, pinned here:
 *
 *   1. Row ids are one sequence per table: the allocators floor table-wide,
 *      keep every table's identity sequence ahead, and serialise per kind.
 *      (The Manager's invoice failed on customer_debt_log's primary key.)
 *   2. A trip's or a phone's price lands on the side of the list the
 *      quantity was bought on (ow_price_side), not always on wholesale.
 *   3. price.changed pushes the salesperson only when the line's own price
 *      moved (Grace was told of a change that was no change).
 *   4. A cash trip's money reaches the books: one write counts it, the
 *      stops' payments are Stock Purchase lines, the orders' bills are paid
 *      by the trip, and a bill raised later is born paid.
 *   5. An invoice tells Accounts (invoice.send) and the salesperson.
 *   6. Accounts can record a customer's payment: 0123's guard appended a
 *      bare literal to a text array ("malformed array literal").
 *
 * Run: node test/audit-0138.test.js
 */
const { read, createReporter } = require('./_extract');

const t = createReporter('the audit fixes of 0138');
const sql = read('supabase/migrations/0138_row_ids_one_sequence.sql');
const buyer = read('buyer.html'), accounts = read('accounts.html'), sales = read('sales.html');
const doc = read('docs/decision-rights.md');
const fn = name => { const at = sql.indexOf('create or replace function ' + name + '('); if (at < 0) throw new Error('0138 has no ' + name); const open = sql.indexOf('$$', at); const end = sql.indexOf('$$;', open + 2); return sql.slice(at, end); };

/* ---------------- 1. the allocators ---------------- */
{
  const map = fn('ow_row_id_table');
  for (const [k, tb] of [['row:cash_txn', 'cash_txns'], ['row:debt_log', 'customer_debt_log'], ['row:price', 'prices'], ['row:purchase_invoice', 'purchase_invoices'], ['row:saved_quote', 'saved_quotes'], ['row:stock_log', 'stock_log'], ['row:fixed_asset', 'fixed_assets'], ['row:loan', 'loans'], ['row:rent_agreement', 'rent_agreements'], ['row:due', 'dues'], ['row:media', 'media'], ['row:media_folder', 'media_folders'], ['row:wa_post', 'wa_posts']]) {
    t.check(map.includes(`when '${k}' then '${tb}'`), `every kind whose table keys on id alone is mapped: ${k} -> ${tb}`);
  }
  t.check(!/row:(follow_up|payment_promise|product_link|brief_sent|statement_sent|credit_note|supplier_credit)/.test(map), 'kinds whose tables key on (shop_id, id), and the document numbers, keep their per-shop numbering');
  const r = fn('ow_reserve_row_ids');
  t.check(/perform pg_advisory_xact_lock\(hashtext\('ow_row_id:' \|\| p_kind\)\);/.test(r), 'one allocation at a time per kind, every shop');
  t.check(/execute format\('select coalesce\(max\(id\), 0\) from %I', t\) into m;\s*f := greatest\(f, m\);/.test(r), 'the floor is the table\'s own max(id)');
  t.check(/select coalesce\(max\(last_issued\), 0\) into m from entity_id_counters where kind = p_kind;\s*f := greatest\(f, m\);/.test(r), 'and every shop\'s counter for the kind');
  t.check(/seq := pg_get_serial_sequence\(t, 'id'\);[\s\S]*case when is_called then last_value else last_value - 1 end/.test(r) && /perform setval\(seq, v, true\);/.test(r), 'and the identity sequence, which is kept past the run (apply_momo_payment inserts without an id)');
  t.check(/on conflict \(shop_id, kind\) do update\s*set last_issued = greatest\(entity_id_counters\.last_issued, f\) \+ n/.test(r), 'the shop\'s counter is reserved from as before');
  t.check(/return ow_reserve_row_ids\(p_shop_id, p_kind, p_floor, 1\);/.test(fn('ow_next_row_id')), 'ow_next_row_id (the server\'s writes) goes through it');
  t.check(/v := ow_reserve_row_ids\(p_shop_id, k, coalesce\(\(p_floors ->> k\)::bigint, 0\), n\);\s*out := out \|\| jsonb_build_object\(k, v - n \+ 1\);/.test(fn('next_row_id_blocks')), 'next_row_id_blocks (every app\'s issueRowId) goes through it and still returns the run\'s first id');
  t.check(/update entity_id_counters set last_issued = m where kind = k and last_issued < m;/.test(sql) && /perform setval\(seq, m, true\);/.test(sql), 'the counters and sequences are brought up to the tables once, on the way in');
}

/* ---------------- 2. the side of the list ---------------- */
{
  const side = fn('ow_price_side');
  t.check(/coalesce\(r\.pack_qty, 0\) > 0 and coalesce\(p_units, 0\) >= r\.pack_qty/.test(side) && /when r\.wholesale is null and r\.retail is not null then 'retail' else 'wholesale'/.test(side) && /when r\.retail is null and r\.wholesale is not null then 'wholesale' else 'retail'/.test(side), 'ow_price_side: wholesale from a pack up, retail under it, the other side when the natural one is empty (sales.html purchaseSideAtQty)');
  const tp = fn('trip_prices_to_list');
  t.check(/side := ow_price_side\(r, ow_units_bought\(p_shop_id, l \|\| jsonb_build_object\('supplierId', t\.supplier_id\)\)\);/.test(tp) && /set wholesale = case when side = 'retail' then wholesale else each_price end,\s*retail = case when side = 'retail' then each_price else retail end,/.test(tp) && /price_source = 'purchase'/.test(tp), 'a trip\'s price lands on the side its quantity was bought on, still as a purchase');
  const bc = fn('buyer_confirm_price');
  t.check(/p_qty numeric default null/.test(bc) && /if p_qty is not null then side := ow_price_side\(was, p_qty\); end if;/.test(bc) && /set wholesale = case when side = 'retail' then wholesale else coalesce\(p_wholesale, wholesale\) end,\s*retail = case when side = 'retail' then coalesce\(p_wholesale, retail\) else retail end,/.test(bc), 'a phone confirmation takes the quantity and lands on that side; without one it keeps writing wholesale');
  t.check(/drop function if exists buyer_confirm_price\(uuid, bigint, numeric\);/.test(sql) && /grant execute on function buyer_confirm_price\(uuid, bigint, numeric, numeric\) to authenticated;/.test(sql), 'the old signature is dropped and the new one granted');
  t.check(/function priceSideFor\(row, units\)\{ const pq = Number\(row\.packQty\) \|\| 0, nat = \(pq > 0 && Number\(units\) >= pq\) \? 'wholesale' : 'retail', oth = nat === 'wholesale' \? 'retail' : 'wholesale'; return row\[nat\] == null && row\[oth\] != null \? oth : nat; \}/.test(buyer), 'buyer: the same rule, for the copy on the phone');
  t.check(/sb\.rpc\('buyer_confirm_price', \{ p_shop_id: S\.shopId, p_price_id: row\.id, p_wholesale: each, p_qty: Number\(it0\.qty\) \|\| null \}\)\.then\(r => \{ if \(r\.error\) throw r\.error; row\[priceSideFor\(row, Number\(it0\.qty\) \|\| 0\)\] = each;/.test(buyer), 'buyer: the phone confirmation sends the quantity and mirrors the side');
  t.check(/if \(row\) \{ row\[priceSideFor\(row, Number\(l\.qty\) \|\| 0\)\] = Number\(l\.gotPrice\); row\.date = today; row\.confirmedVia = 'trip'; \}/.test(buyer), 'buyer: the trip\'s prices mirror the side too');
}

/* ---------------- 3. price.changed only when the line's price moved ---------------- */
{
  const p = fn('prices_ow_push');
  t.check(/cross join lateral jsonb_array_elements\([\s\S]*\) as e\(line\)/.test(p) && /units := ow_units_bought\(new\.shop_id, q\.line\);\s*side := ow_price_side\(new, units\);/.test(p), 'each matching line is priced at its quantity on its side');
  t.check(/if now_each is null or now_each is not distinct from ow_num\(q\.line ->> 'price'\) then continue; end if;/.test(p), 'and pushed only when that figure differs from the price on the line');
  t.check(/' is now ' \|\| ow_money\(now_each\) \|\| '\. Tell them\.'/.test(p), 'naming the line\'s new figure');
}

/* ---------------- 4. a cash trip's money reaches the books ---------------- */
{
  t.check(/ow_num\(l ->> 'gotQty'\) \* coalesce\(ow_num\(l ->> 'gotPrice'\), ow_num\(l ->> 'expectedPrice'\), 0\)/.test(fn('ow_trip_line_paid')), 'ow_trip_line_paid: what came, at the price paid (accounts.html tripLinePaid)');
  t.check(/t\.cash_given is not null[\s\S]*<> '__supplier__'[\s\S]*t\.status in \('collected', 'confirmed'\)/.test(fn('ow_trip_is_cash')), 'ow_trip_is_cash: back, with shop cash, not the supplier delivering');
  const c = fn('trip_cash_count');
  t.check(/has_task\(p_shop_id, 'trip\.cash'\)/.test(c) && /for update/.test(c) && /raise exception 'Trip % is counted already\.'/.test(c), 'trip.cash counts, the trips are locked, a counted trip is refused');
  t.check(/'cash', 'payment', 'Stock Purchase', paid_t,\s*'Paid at ' \|\| coalesce\(sup_name, 'the supplier'\) \|\| ' on ' \|\| buyer_name \|\| '''s trip ' \|\| t\.id/.test(c), 'one Stock Purchase line per stop, for what was paid there');
  t.check(/case when diff < 0 then 'Cash Shortage' else 'Cash Overage' end, abs\(diff\)/.test(c) && /diff := counted - \(given - paid\);/.test(c), 'the difference is booked the way a close difference is');
  t.check(/if pays -> i ->> 'tripId' = t\.id and \(pays -> i ->> 'cashTxnId'\) is null then\s*pays := jsonb_set\(pays, array\[i::text, 'cashTxnId'\], to_jsonb\(line_id\)\);/.test(c), 'a bill born paid by this trip is linked to the cash line, not paid twice');
  t.check(/'note', 'Paid on trip ' \|\| t\.id, 'via', 'trip', 'tripId', t\.id, 'cashTxnId', line_id\),\s*'amountPaid', coalesce\(ow_num\(b\.payload ->> 'amountPaid'\), 0\) \+ bill_paid\)/.test(c), 'a bill raised before the count is paid by the trip');
  t.check(/update collection_trips set cash_count = cnt where shop_id = p_shop_id and id = any\(p_trip_ids\);/.test(c) && /''accounts'', ''trip\.cash''/.test(c), 'the trips carry the count and the owner\'s log gets its line');
  t.check(/grant execute on function trip_cash_count\(uuid, text\[\], numeric\) to authenticated;/.test(sql), 'granted');
  const b = fn('purchase_invoices_born_paid');
  t.check(/if new\.quote_id is null or coalesce\(ow_num\(new\.payload ->> 'amountPaid'\), 0\) <> 0/.test(b) && /ct\.supplier_id = new\.payload ->> 'supplierId' and ow_trip_is_cash\(ct\)/.test(b) && /new\.payload := coalesce\(new\.payload, '\{\}'::jsonb\) \|\| jsonb_build_object\('payments', pays, 'amountPaid', total\);/.test(b), 'a bill for goods a cash trip paid for is born paid by that trip');
  t.check(/create trigger purchase_invoices_born_paid before insert on purchase_invoices/.test(sql), 'before insert, so the hourly auto-invoice is covered too');
  // accounts: the slide is the one write
  t.check(/const r = await sb\.rpc\('trip_cash_count', \{ p_shop_id: S\.shopId, p_trip_ids: g\.trips\.map\(t => t\.id\), p_counted: counted \}\);\s*if \(r\.error\) throw r\.error;/.test(accounts), 'accounts: the slide calls trip_cash_count');
  t.check(/\(res\.cashRows \|\| \[\]\)\.forEach\(row => \{ if \(!txnById\(row\.id\)\) D\(\)\.cashTxns\.push\(rowToTxn\(row\)\); \}\);/.test(accounts) && /g\.trips\.forEach\(t => \{ t\.cashCount = res\.count/.test(accounts), 'and takes the lines it wrote into the phone\'s copy');
  t.check(!/cid = await addCash\(\{ account: 'cash', type: diff < 0 \? 'payment' : 'receipt', category: diff < 0 \? CASH_SHORTAGE_CATEGORY : CASH_OVERAGE_CATEGORY, amount: Math\.abs\(diff\), description: `\$\{diff < 0 \? 'Short' : 'Over'\} on \$\{poss\(firstWord\(nm\)\)\} trip cash/.test(accounts), 'the old difference-only write is gone');
  t.check(/paid at the stops is in the book/.test(accounts) && /paid at the stops → the book/.test(accounts), 'the screen says the stops\' money is in the book');
}

/* ---------------- 5. an invoice tells Accounts and the salesperson ---------------- */
{
  const p = fn('saved_quotes_ow_push4');
  t.check(/if tg_op <> 'UPDATE' or not new\.invoiced or old\.invoiced or coalesce\(new\.voided, false\) then return null; end if;/.test(p), 'on the order becoming invoiced');
  t.check(/perform ow_push\(new\.shop_id, 'order\.invoiced', 'Invoiced — send it',[\s\S]*null, 'invoice\.send', null, ref, 'invoiced:acc:' \|\| new\.id\);/.test(p), 'Accounts (invoice.send) is told');
  t.check(/perform ow_push\(new\.shop_id, 'order\.invoiced', 'Your order is invoiced',[\s\S]*ow_uuid\(new\.payload ->> 'takenBy'\), null, null, ref, 'invoiced:sales:' \|\| new\.id\);/.test(p), 'and whoever took the order');
  t.check(/create trigger saved_quotes_ow_push4 after update on saved_quotes/.test(sql), 'wired');
  t.check(/\['price\.decided', 'price\.changed', 'credit\.decided', 'line\.dropped', 'order\.invoiced'\]\.includes\(k\)/.test(sales), 'sales: the push opens the order');
  t.check(/\} else if \(k === 'order\.invoiced'\) \{\s*\/\/[^\n]*\n\s*go\('today'\); push\('invoices', \{\}\);/.test(accounts), 'accounts: the push opens Invoices');
  t.check(/0138 adds the invoice itself/.test(doc), 'docs/decision-rights.md lists the push');
}

/* ---------------- 6. Accounts can record a payment ---------------- */
{
  const g = fn('saved_quotes_accounts_guard');
  t.check(/free_keys := free_keys \|\| array\['agentPaymentStatus'\];/.test(g) && !/free_keys \|\| 'agentPaymentStatus'/.test(g), 'the guard appends an array, not a bare literal');
  t.check(/free_keys text\[\] := array\['payments', 'debtCharged', 'customerId', 'invoiceSends'\];/.test(g) && /'An Accounts login records a payment/.test(g) || /is_shop_accounts\(new\.shop_id\)/.test(g), 'and is otherwise 0123\'s guard');
  // the same mistake nowhere else in the migrations
  const fs = require('fs'), path = require('path');
  const dir = path.join(__dirname, '..', 'supabase', 'migrations');
  const bad = fs.readdirSync(dir).filter(f => /^\d{4}_.*\.sql$/.test(f) && f !== '0123_accounts_treasurer.sql').filter(f => /:= [a-z_]+ \|\| '[A-Za-z_]+';/.test(fs.readFileSync(path.join(dir, f), 'utf8')));
  t.check(bad.length === 0, 'no other migration appends a bare literal to an array' + (bad.length ? ' -- ' + bad.join(', ') : ''));
}

t.check(/\| 0138 \| /.test(doc), 'docs/decision-rights.md reserves 0138 for it');

process.exit(t.done() ? 1 : 0);
