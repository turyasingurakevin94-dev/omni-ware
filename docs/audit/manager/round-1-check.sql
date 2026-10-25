-- Manager round 1 (data and money integrity): read-only checks. Nothing here writes.
-- Paste into the Supabase SQL editor, one query at a time. Each lists the rows
-- that break one rule; an empty result means the rule holds (the round's
-- acceptance checks). The shop is picked by name in the first line of each query.
-- Sales round 1's checks (docs/audit/sales/round-1-check.sql) still apply; these
-- add what the Manager brief found.

-- 1 · MGR-DATA-01: a payment whose cash row is missing, or differs in amount,
--     account (cash / momo / bank), or order.
with shop as (select id from shops where name = 'Omni-ware (old records)'),
p as (
  select q.id as order_id, q.client_name, (pay ->> 'id') as pay_id, pay ->> 'cashTxnId' as cash_id,
         ow_num(pay ->> 'amount') as paid, lower(coalesce(pay ->> 'method', '')) as method, pay ->> 'date' as paid_on
    from saved_quotes q, shop,
         jsonb_array_elements(case when jsonb_typeof(q.payload -> 'payments') = 'array' then q.payload -> 'payments' else '[]'::jsonb end) pay
   where q.shop_id = shop.id and coalesce(pay ->> 'cashTxnId', '') <> ''
)
select p.order_id, p.client_name, p.pay_id, p.paid, p.method, p.paid_on, p.cash_id,
       c.amount as cash_amount, c.account as cash_account, c.quote_id as cash_order, c.description,
       case when c.id is null then 'no cash row'
            when round(c.amount) <> round(p.paid) then 'amount differs'
            when p.method <> '' and lower(coalesce(c.account, '')) <> p.method then 'account differs'
            when c.quote_id is null then 'cash row names no order'
            else 'cash row is another order''s' end as problem
  from p cross join shop
  left join cash_txns c on c.shop_id = shop.id and c.id::text = p.cash_id
 where c.id is null or round(c.amount) <> round(p.paid)
    or (p.method <> '' and lower(coalesce(c.account, '')) <> p.method)
    or c.quote_id is distinct from p.order_id
 order by p.order_id;

-- 2 · MGR-DATA-01: one cash row named by more than one payment (shared between
--     orders or customers).
with shop as (select id from shops where name = 'Omni-ware (old records)')
select pay ->> 'cashTxnId' as cash_id, count(*) as payments, array_agg(q.id order by q.id) as orders,
       array_agg(distinct q.client_name) as customers
  from saved_quotes q, shop,
       jsonb_array_elements(case when jsonb_typeof(q.payload -> 'payments') = 'array' then q.payload -> 'payments' else '[]'::jsonb end) pay
 where q.shop_id = shop.id and coalesce(pay ->> 'cashTxnId', '') <> ''
 group by pay ->> 'cashTxnId'
having count(*) > 1
 order by 1;

-- 3 · MGR-DATA-01: #0415 in full — its payments, the cash rows they name, and
--     every receipt that names the order (the brief: 600,000 in the cash book
--     for a 500,000 invoice).
with shop as (select id from shops where name = 'Omni-ware (old records)')
select 'payment' as what, pay ->> 'id' as id, pay ->> 'date' as date, pay ->> 'method' as account, ow_num(pay ->> 'amount') as amount, pay ->> 'cashTxnId' as cash_id, null as description
  from saved_quotes q, shop,
       jsonb_array_elements(case when jsonb_typeof(q.payload -> 'payments') = 'array' then q.payload -> 'payments' else '[]'::jsonb end) pay
 where q.shop_id = shop.id and q.id = 415
union all
select 'cash row', c.id::text, c.date::text, c.account, c.amount, null, c.description
  from cash_txns c, shop
 where c.shop_id = shop.id and (c.quote_id = 415 or c.id in (18965, 19304));

-- 4 · MGR-DATA-02: a customer whose stored balance is not
--     opening balance + what their invoices still owe.
--     opening  = debt-log lines that name no order (the old book)
--     invoices = each invoiced, not voided order's total less what was paid
with shop as (select id from shops where name = 'Omni-ware (old records)'),
opening as (
  select l.customer_id as cid, sum(case when l.type = 'charge' then l.amount else -l.amount end) as amt
    from customer_debt_log l, shop
   where l.shop_id = shop.id and l.quote_id is null
   group by l.customer_id
),
inv as (
  select q.payload ->> 'customerId' as cid,
         sum(greatest(0, round(ow_order_total(shop.id, q.payload, false)) - coalesce(q.amount_paid, 0))) as due
    from saved_quotes q, shop
   where q.shop_id = shop.id and q.invoiced and not coalesce(q.voided, false) and coalesce(q.payload ->> 'customerId', '') <> ''
   group by q.payload ->> 'customerId'
)
select c.id, c.name, round(coalesce(c.debt, 0)) as stored, round(coalesce(o.amt, 0)) as opening, round(coalesce(i.due, 0)) as invoices,
       round(coalesce(c.debt, 0) - coalesce(o.amt, 0) - coalesce(i.due, 0)) as apart
  from customers c cross join shop
  left join opening o on o.cid = c.id
  left join inv i on i.cid = c.id
 where c.shop_id = shop.id
   and abs(coalesce(c.debt, 0) - coalesce(o.amt, 0) - coalesce(i.due, 0)) >= 1
 order by abs(coalesce(c.debt, 0) - coalesce(o.amt, 0) - coalesce(i.due, 0)) desc;
-- The same rule as Sales round 1 query 5 and the view ow_balance_check (0165).

-- 5 · MGR-DATA-03: a stock key whose FIFO lots do not add up to the stock.
with shop as (select id from shops where name = 'Omni-ware (old records)'),
l as (select key, sum(coalesce(qty, 0)) as lots, count(*) as layers from stock_lots, shop where stock_lots.shop_id = shop.id group by key)
select coalesce(s.key, l.key) as key, s.product_id, s.variant_idx, round(coalesce(s.qty, 0), 3) as stock, round(coalesce(l.lots, 0), 3) as lots, coalesce(l.layers, 0) as layers,
       round(coalesce(l.lots, 0) - coalesce(s.qty, 0), 3) as surplus
  from (select * from stock, shop where stock.shop_id = shop.id) s
  full join l on l.key = s.key
 where abs(coalesce(l.lots, 0) - coalesce(s.qty, 0)) > 0.0001
 order by abs(coalesce(l.lots, 0) - coalesce(s.qty, 0)) desc;

-- 6 · MGR-DATA-04 / -09: invoiced lines sold under their cost, or at 0.
with shop as (select id from shops where name = 'Omni-ware (old records)')
select q.id as order_id, q.client_name, it ->> 'productName' as item, ow_num(it ->> 'qty') as qty,
       ow_num(it ->> 'price') as cost, ow_num(it ->> 'sellPrice') as sold,
       case when ow_num(it ->> 'sellPrice') = 0 then 'at 0' else 'under cost' end as problem,
       round((ow_num(it ->> 'sellPrice') - ow_num(it ->> 'price')) * ow_num(it ->> 'qty')) as loss
  from saved_quotes q, shop, jsonb_array_elements(case when jsonb_typeof(q.payload -> 'items') = 'array' then q.payload -> 'items' else '[]'::jsonb end) it
 where q.shop_id = shop.id and q.invoiced and not coalesce(q.voided, false)
   and coalesce(it ->> 'sellPrice', '') <> '' and ow_num(it ->> 'qty') > 0
   and (ow_num(it ->> 'sellPrice') = 0 or (ow_num(it ->> 'price') > 0 and ow_num(it ->> 'sellPrice') < ow_num(it ->> 'price')))
   and coalesce(it ->> 'givenAway', '') = ''
 order by q.id;

-- 7 · MGR-DATA-07: a voided order still holding money (payments not refunded
--     and not moved to a deposit).
with shop as (select id from shops where name = 'Omni-ware (old records)')
select q.id as order_id, q.client_name, q.status, q.amount_paid, q.payload ->> 'cancelledAt' as cancelled_at,
       q.payload -> 'voidMoney' as what_was_done
  from saved_quotes q, shop
 where q.shop_id = shop.id and coalesce(q.voided, false) and coalesce(q.amount_paid, 0) > 0
   and coalesce(q.payload -> 'voidMoney' ->> 'done', '') = ''
 order by q.id;

-- 8 · MGR-DATA-10: money with fractions of a shilling.
with shop as (select id from shops where name = 'Omni-ware (old records)')
select c.id, c.date, c.account, c.type, c.category, c.amount, c.description, round(c.amount) - c.amount as adjustment
  from cash_txns c, shop
 where c.shop_id = shop.id and c.amount <> round(c.amount)
 order by c.id;

-- 9 · MGR-DATA-11: a payment dated before its order and not labelled a deposit.
with shop as (select id from shops where name = 'Omni-ware (old records)')
select q.id as order_id, q.client_name, q.date as order_date, pay ->> 'date' as paid_on, ow_num(pay ->> 'amount') as amount, pay ->> 'label' as label
  from saved_quotes q, shop,
       jsonb_array_elements(case when jsonb_typeof(q.payload -> 'payments') = 'array' then q.payload -> 'payments' else '[]'::jsonb end) pay
 where q.shop_id = shop.id and q.date is not null and (pay ->> 'date') ~ '^\d{4}-\d{2}-\d{2}$'
   and (pay ->> 'date')::date < q.date
   and coalesce(pay ->> 'label', '') <> 'Deposit' and coalesce((pay ->> 'deposit')::text, '') <> 'true'
 order by q.id;

-- 10 · MGR-DATA-13: customers who look alike — the same name, the same phone,
--      or a phone that is not 10 digits starting 07.
with shop as (select id from shops where name = 'Omni-ware (old records)'),
c as (select cu.id, cu.name, regexp_replace(coalesce(cu.phone, ''), '\D', '', 'g') as digits from customers cu, shop where cu.shop_id = shop.id)
select 'same name' as why, lower(btrim(name)) as key, array_agg(id || ' ' || name order by id) as customers from c group by lower(btrim(name)) having count(*) > 1
union all
select 'same phone', digits, array_agg(id || ' ' || name order by id) from c where digits <> '' group by digits having count(*) > 1
union all
select 'bad phone', digits, array_agg(id || ' ' || name) from c where digits <> '' and digits !~ '^07\d{8}$' group by digits;

-- 11 · MGR-DATA-14: targets whose period has ended but are still open.
with shop as (select id from shops where name = 'Omni-ware (old records)')
select n.id, n.body ->> 'metric' as metric, n.body ->> 'from' as from_day, n.body ->> 'to' as to_day, n.status
  from manager_notes n, shop
 where n.shop_id = shop.id and n.kind = 'target' and n.status = 'open'
   and (n.body ->> 'to') ~ '^\d{4}-\d{2}-\d{2}$' and (n.body ->> 'to')::date < current_date
 order by n.id;

-- 12 · MGR-DATA-15: invoices under 1,000.
with shop as (select id from shops where name = 'Omni-ware (old records)')
select q.id as order_id, q.client_name, q.invoiced_at, round(ow_order_total(shop.id, q.payload)) as total
  from saved_quotes q, shop
 where q.shop_id = shop.id and q.invoiced and not coalesce(q.voided, false)
   and ow_order_total(shop.id, q.payload) > 0 and ow_order_total(shop.id, q.payload) < 1000
 order by q.id;
