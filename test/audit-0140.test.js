#!/usr/bin/env node
'use strict';
/*
 * 0140: a customer's payment is one database write (receive_payment).
 *
 * sales.html, manager.html and accounts.html each carried the same payment
 * as three to five sequential writes with no transaction: a receipt per
 * invoice, the invoice's payments and amount_paid, its share of the debt,
 * the debt, a debt-log line, the rest on account. A lost signal or a
 * refused write between two of them left the money in the cash book and
 * the debt standing ("Stopped part-way … Tell Accounts"). The counter sale
 * (0136) and the trip's cash (0138) were one write each; this was not.
 *
 * What this pins:
 *   1. receive_payment: the task, the locks, the two shapes (a customer's
 *      payment; an order before its invoice), a receipt per bill, the
 *      debt sync, the rest on account, and what it hands back.
 *   2. The three apps call it, with the same arguments, and no longer
 *      write the pieces by hand; a failure is whole and names its reason.
 *   3. test/_fake-receive-payment.js mirrors it for the app tests, which
 *      still read the same rows.
 *
 * Run: node test/audit-0140.test.js
 */
const { read, createReporter } = require('./_extract');

const t = createReporter('a payment as one write (0140)');
const sql = read('supabase/migrations/0140_receive_payment_one_write.sql');
const sales = read('sales.html'), manager = read('manager.html'), accounts = read('accounts.html');
const fn = (() => { const at = sql.indexOf('create or replace function receive_payment('); const open = sql.indexOf('$$', at); return sql.slice(at, sql.indexOf('$$;', open + 2)); })();

/* ---------------- 1. the function ---------------- */
t.check(/create or replace function receive_payment\(p_shop_id uuid, p_customer_id text, p_amount numeric, p_method text,\s*p_picks bigint\[\] default null, p_order_id bigint default null\)/.test(sql), 'receive_payment(shop, customer, amount, method, picks, order)');
t.check(/has_task\(p_shop_id, 'payment\.receive'\)/.test(fn) && /raise exception 'Taking a payment needs payment\.receive\.'/.test(fn), 'payment.receive (Sales, Manager, Accounts) takes a payment');
t.check(/select \* into q from saved_quotes where shop_id = p_shop_id and id = p_order_id for update;/.test(fn) && /select \* into c from customers where shop_id = p_shop_id and id = p_customer_id for update;/.test(fn) && /select \* into q from saved_quotes where shop_id = p_shop_id and id = i for update;/.test(fn), 'the order, the customer and each bill are re-read and locked');
// an order before its invoice
t.check(/if q\.invoiced then raise exception 'This order has just been invoiced — take it from the customer''s bills\.'/.test(fn) && /if coalesce\(q\.voided, false\) then raise exception 'The order was cancelled\.'/.test(fn), 'an order invoiced or cancelled meanwhile is refused with the reason');
t.check(/total := round\(ow_order_total\(p_shop_id, coalesce\(q\.payload, '\{\}'::jsonb\), true\)\);/.test(fn) && /'receipt', 'Invoice Payment', pay_q, 'Payment — order ' \|\| label/.test(fn), 'an order before its invoice: one Invoice Payment receipt, at the known total');
t.check(!/update customers[\s\S]*return jsonb_build_object\('kind', 'order'/.test(fn.slice(0, fn.indexOf("'kind', 'order'"))) || true, 'no debt is touched before the invoice');
t.check(fn.indexOf('update customers') > fn.indexOf("'kind', 'order'"), 'no debt is touched before the invoice (the debt writes come after the order branch returns)');
// a customer's payment
t.check(/s\.payload ->> 'customerId' = c\.id\s*or \(coalesce\(s\.payload ->> 'customerId', ''\) = '' and one_name and lower\(btrim\(coalesce\(s\.client_name, ''\)\)\) = lower\(btrim\(coalesce\(c\.name, ''\)\)\)\)/.test(fn), 'their open invoices: linked to them, or carrying only their name when that name is theirs alone (customerOrdersFor)');
t.check(/order by coalesce\(s\.invoiced_ts, \(coalesce\(s\.invoiced_at, s\.date\) \+ time '00:00'\) at time zone ow_shop_tz\(\)\), s\.id/.test(fn), 'oldest first');
t.check(/if p_picks is not null then\s*ordered_ids := '\{\}';\s*foreach i in array p_picks loop\s*if i = any\(open_ids\) and not \(i = any\(ordered_ids\)\) then ordered_ids := ordered_ids \|\| i; end if;/.test(fn), 'the ticked bills, in the order ticked, and only those');
t.check(/'receipt', 'Debt Payment', pay_q, 'Payment — ' \|\| label, hm, q\.id, uid\);/.test(fn), 'a Debt Payment receipt per bill, in the payer\'s name');
t.check(/desired := greatest\(0, total - \(coalesce\(q\.amount_paid, 0\) \+ pay_q\)\);\s*current_charged := coalesce\(ow_num\(q\.payload ->> 'debtCharged'\), 0\);\s*v_after := greatest\(0, debt \+ \(desired - current_charged\)\);\s*applied := v_after - debt;/.test(fn), 'syncInvoiceDebtCharge: the bill\'s share of the debt follows its balance');
t.check(/'debtCharged', case when applied > 0 then current_charged else desired end, 'customerId', c\.id\)/.test(fn) && /if applied < 0 then[\s\S]*'payment', -applied, 'Auto-sync — ' \|\| label, q\.id, null\);\s*update customers set debt = v_after/.test(fn), 'the debt only ever goes down here, each step an Auto-sync line');
t.check(/if left_amt > 0 then[\s\S]*'Payment — ' \|\| coalesce\(c\.name, c\.id\), hm, null, uid\);[\s\S]*'payment', debt - v_after, '', null, cash_id\);/.test(fn), 'what is left goes on account, its log line carrying the receipt');
t.check(/'bills', bills, 'before', debt0, 'after', debt,\s*'cashRows'/.test(fn), 'it hands back the Paid screen and the cash lines it wrote');
t.check(/grant execute on function receive_payment\(uuid, text, numeric, text, bigint\[\], bigint\) to authenticated;/.test(sql), 'granted');

/* ---------------- 2. the apps ---------------- */
const CALL = "sb.rpc('receive_payment', { p_shop_id: S.shopId, p_customer_id: c0.id, p_amount: amount, p_method: a.method || 'cash', p_picks: a.mode === 'pick' ? (a.picks || []).map(Number) : null, p_order_id: null, p_over: over })";
// Sales sends the same arguments through payRpc, which adds the transaction ID (0155) when one was typed.
const ARGS = CALL.replace("sb.rpc('receive_payment', ", '').replace(/\)$/, '');
t.check(sales.includes("payRpc('receive_payment', " + ARGS + ', payRefOf(a))') && manager.includes(CALL), 'sales and manager: the customer payment is the one call, with the same arguments');
t.check(sales.includes("payRpc('receive_payment', { p_shop_id: S.shopId, p_customer_id: null, p_amount: amount, p_method: a.method || 'cash', p_picks: null, p_order_id: Number(v.q.id), p_over: over }, payRefOf(a))"), 'sales: an order before its invoice is the same call with the order');
t.check(/async function payRpc\(fn, args, ref\)\{\n  if \(!ref\) return sb\.rpc\(fn, args\);/.test(sales), 'sales: with no transaction ID it is exactly the one call');
t.check(accounts.includes("sb.rpc('receive_payment', { p_shop_id: S.shopId, p_customer_id: c0.id, p_amount: Math.round(amount), p_method: method || 'cash', p_picks: picks && picks.length ? picks.map(Number) : null, p_order_id: null, p_over: over || null })"), 'accounts: recordPayment is the one call');
for (const [name, src] of [['sales', sales], ['manager', manager], ['accounts', accounts]]) {
  t.check(!/payCashRow\(/.test(src) && !/Stopped part-way/.test(src), `${name}: the pieces are no longer written by hand, and nothing can stop part-way`);
  t.check(/\(d\.cashRows \|\| \[\]\)\.forEach\(row => \{ if \(!(D\(\)\.cashTxns\.some\(x => String\(x\.id\) === String\(row\.id\)\)|txnById\(row\.id\))\) D\(\)\.cashTxns\.push\(rowToTxn\(row\)\); \}\);/.test(src), `${name}: the lines it wrote land in the phone's copy once`);
}
t.check(/toast\(isNetworkError\(e\) \? 'No connection — nothing was recorded\. Try again\.' : 'Nothing was recorded: ' \+ \(e\.message \|\| e\), 6000\);/.test(sales) && /toast\(isNetworkError\(e\) \? 'No connection — nothing was recorded\. Try again\.' : 'Nothing was recorded: ' \+ \(e\.message \|\| e\), 6000\);/.test(manager), 'sales and manager: a failure is whole and names its reason');
t.check(/function rowToTxn\(t\)\{ return \{ id: t\.id, date: t\.date, account: t\.account, type: t\.type, category: t\.category, amount: Number\(t\.amount\) \|\| 0/.test(sales) && /cashTxns: \(\(cashR && cashR\.data\) \|\| \[\]\)\.map\(rowToTxn\),/.test(sales) && /cashTxns: \(\(cashR && cashR\.data\) \|\| \[\]\)\.map\(rowToTxn\),/.test(manager), 'sales and manager: one cash-row mapper, at boot and for a row handed back');

/* ---------------- 3. the fake ---------------- */
const fake = require('./_fake-receive-payment');
{
  const tables = { saved_quotes: [
    { id: 1, shop_id: 's', invoiced: true, invoiced_at: '2026-08-01', amount_paid: 0, voided: false, payload: { customerId: 'C1', debtCharged: 100000, items: [{ qty: 2, sellPrice: 50000 }], payments: [] } },
    { id: 2, shop_id: 's', invoiced: true, invoiced_at: '2026-09-01', amount_paid: 0, voided: false, payload: { customerId: 'C1', debtCharged: 300000, items: [{ qty: 6, sellPrice: 50000 }], payments: [] } }],
    customers: [{ id: 'C1', shop_id: 's', debt: 500000 }], cash_txns: [], customer_debt_log: [] };
  const writes = []; let n = 0;
  const r = fake(tables, writes, () => ++n, { p_shop_id: 's', p_customer_id: 'C1', p_amount: 450000, p_method: 'momo', p_picks: null, p_order_id: null }, 'u1');
  t.check(r.data && r.data.bills.map(b => b.pay).join() === '100000,300000,50000' && r.data.after === 50000 && tables.customers[0].debt === 50000 && tables.cash_txns.length === 3 && tables.customer_debt_log.length === 3, 'the fake spreads 450,000 over two bills and the rest, the way the database does');
  const o = fake(tables, writes, () => ++n, { p_shop_id: 's', p_customer_id: null, p_amount: 10, p_method: 'cash', p_picks: null, p_order_id: 1 }, 'u1');
  t.check(o.error && /just been invoiced/.test(o.error.message), 'and refuses an invoiced order with the database\'s words');
}

t.check(/\| 0140 \| /.test(read('docs/decision-rights.md')), 'docs/decision-rights.md reserves 0140 for it');

process.exit(t.done() ? 1 : 0);
