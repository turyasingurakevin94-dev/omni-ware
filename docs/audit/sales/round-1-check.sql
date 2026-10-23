-- Sales round 1 (data integrity): read-only checks. Nothing here writes.
-- Paste into the Supabase SQL editor, one query at a time. Each lists the rows
-- that break one rule; an empty result means the rule holds.
-- The shop is picked by name in the first line of each query.

-- 1 · SAL-010: a payment whose cash row is missing, or has another amount,
--     no order, another order, or another date.
with shop as (select id from shops where name = 'Omni-ware (old records)'),
p as (
  select q.id as order_id, q.client_name, pay ->> 'cashTxnId' as cash_id, ow_num(pay ->> 'amount') as paid, pay ->> 'date' as paid_on
    from saved_quotes q, shop,
         jsonb_array_elements(case when jsonb_typeof(q.payload -> 'payments') = 'array' then q.payload -> 'payments' else '[]'::jsonb end) pay
   where q.shop_id = shop.id and coalesce(pay ->> 'cashTxnId', '') <> ''
)
select p.order_id, p.client_name, p.paid, p.paid_on, p.cash_id, c.amount as cash_amount, c.quote_id as cash_order, c.date as cash_date, c.description,
       case when c.id is null then 'no cash row'
            when c.amount <> p.paid then 'amount differs'
            when c.quote_id is null then 'cash row names no order'
            when c.quote_id <> p.order_id then 'cash row is another order''s'
            else 'date differs' end as problem
  from p cross join shop
  left join cash_txns c on c.shop_id = shop.id and c.id::text = p.cash_id
 where c.id is null or c.amount <> p.paid or c.quote_id is distinct from p.order_id or c.date::text <> p.paid_on
 order by p.order_id;

-- 2 · SAL-012: amount_paid is not the sum of the order's payments.
with shop as (select id from shops where name = 'Omni-ware (old records)')
select q.id as order_id, q.client_name, q.amount_paid,
       coalesce((select sum(ow_num(x ->> 'amount')) from jsonb_array_elements(case when jsonb_typeof(q.payload -> 'payments') = 'array' then q.payload -> 'payments' else '[]'::jsonb end) x), 0) as payments_sum
  from saved_quotes q, shop
 where q.shop_id = shop.id and not coalesce(q.voided, false)
   and coalesce(q.amount_paid, 0) <> coalesce((select sum(ow_num(x ->> 'amount')) from jsonb_array_elements(case when jsonb_typeof(q.payload -> 'payments') = 'array' then q.payload -> 'payments' else '[]'::jsonb end) x), 0)
 order by q.id;

-- 3 · SAL-013: a receipt that names an order but is not in that order's payments.
with shop as (select id from shops where name = 'Omni-ware (old records)')
select c.id as cash_id, c.date, c.amount, c.quote_id, c.description
  from cash_txns c join saved_quotes q on q.shop_id = c.shop_id and q.id = c.quote_id, shop
 where c.shop_id = shop.id and c.type = 'receipt' and coalesce(c.category, '') <> 'Account Transfer'
   and not exists (select 1 from jsonb_array_elements(case when jsonb_typeof(q.payload -> 'payments') = 'array' then q.payload -> 'payments' else '[]'::jsonb end) x
                    where x ->> 'cashTxnId' = c.id::text)
 order by c.id;

-- 4 · SAL-005: paid more than the order's total (the overpayments that went nowhere).
with shop as (select id from shops where name = 'Omni-ware (old records)')
select q.id as order_id, q.client_name, round(ow_order_total(shop.id, q.payload, false)) as total, q.amount_paid,
       q.amount_paid - round(ow_order_total(shop.id, q.payload, false)) as over
  from saved_quotes q, shop
 where q.shop_id = shop.id and not coalesce(q.voided, false)
   and q.amount_paid > round(ow_order_total(shop.id, q.payload, false))
 order by q.id;

-- 5 · SAL-011: each customer's balance against their open invoices.
--     books    = customers.debt (equal to the debt log, per the brief)
--     opening  = debt-log lines that name no order (the old book, on account)
--     invoices = what is still due on their invoices (total less amount_paid)
--     gap      = books - (opening + invoices); 0 means it adds up
with shop as (select id from shops where name = 'Omni-ware (old records)'),
inv as (
  select q.payload ->> 'customerId' as cid, sum(greatest(0, round(ow_order_total(shop.id, q.payload, false)) - coalesce(q.amount_paid, 0))) as due
    from saved_quotes q, shop
   where q.shop_id = shop.id and q.invoiced and not coalesce(q.voided, false) and coalesce(q.payload ->> 'customerId', '') <> ''
   group by 1
),
opening as (
  select l.customer_id as cid, sum(case when l.type = 'charge' then l.amount else -l.amount end) as amt
    from customer_debt_log l, shop
   where l.shop_id = shop.id and l.quote_id is null
   group by 1
)
select c.id, c.name, coalesce(c.debt, 0) as books, coalesce(o.amt, 0) as opening, coalesce(i.due, 0) as invoices,
       coalesce(c.debt, 0) - (coalesce(o.amt, 0) + coalesce(i.due, 0)) as gap
  from customers c cross join shop
  left join inv i on i.cid = c.id
  left join opening o on o.cid = c.id
 where c.shop_id = shop.id
   and coalesce(c.debt, 0) <> coalesce(o.amt, 0) + coalesce(i.due, 0)
 order by abs(coalesce(c.debt, 0) - (coalesce(o.amt, 0) + coalesce(i.due, 0))) desc;

-- 6 · SAL-007: invoiced orders billed for lines nobody priced
--     (billed = with those lines at their rule or cost; priced = without them).
with shop as (select id from shops where name = 'Omni-ware (old records)')
select q.id as order_id, q.client_name, q.invoiced_at,
       (select count(*) from jsonb_array_elements(q.payload -> 'items') it where coalesce(ow_num(it ->> 'sellPrice'), 0) <= 0) as unpriced_lines,
       round(ow_order_total(shop.id, q.payload, false)) as billed, round(ow_order_total(shop.id, q.payload, true)) as priced, q.amount_paid
  from saved_quotes q, shop
 where q.shop_id = shop.id and q.invoiced and not coalesce(q.voided, false) and jsonb_typeof(q.payload -> 'items') = 'array'
   and exists (select 1 from jsonb_array_elements(q.payload -> 'items') it where coalesce(ow_num(it ->> 'sellPrice'), 0) <= 0 and ow_num(it ->> 'qty') > 0)
 order by q.id;

-- 7 · SAL-006: lines with a count of 0 or less, or a price below 0.
with shop as (select id from shops where name = 'Omni-ware (old records)')
select q.id as order_id, it ->> 'productName' as line, ow_num(it ->> 'qty') as qty, ow_num(it ->> 'sellPrice') as sell_price, q.payload -> 'pickSettle' ->> 'pick' as short_pick
  from saved_quotes q, shop, jsonb_array_elements(case when jsonb_typeof(q.payload -> 'items') = 'array' then q.payload -> 'items' else '[]'::jsonb end) it
 where q.shop_id = shop.id and (ow_num(it ->> 'qty') <= 0 or ow_num(it ->> 'sellPrice') < 0)
 order by q.id;

-- 8 · SAL-014: October receipts that are moves between the shop's own accounts.
with shop as (select id from shops where name = 'Omni-ware (old records)')
select c.id, c.date, c.account, c.amount, c.category, c.transfer_id, c.description
  from cash_txns c, shop
 where c.shop_id = shop.id and c.type = 'receipt' and c.date >= date '2026-10-01'
   and (c.category = 'Account Transfer' or c.transfer_id is not null or c.description like '%→%')
 order by c.date, c.id;

-- 9 · The question for Kevin: payments dated before their order.
with shop as (select id from shops where name = 'Omni-ware (old records)')
select q.id as order_id, q.client_name, q.date as order_date, x ->> 'date' as paid_on, ow_num(x ->> 'amount') as amount,
       q.date - (x ->> 'date')::date as days_early
  from saved_quotes q, shop, jsonb_array_elements(case when jsonb_typeof(q.payload -> 'payments') = 'array' then q.payload -> 'payments' else '[]'::jsonb end) x
 where q.shop_id = shop.id and (x ->> 'date') ~ '^\d{4}-\d{2}-\d{2}$' and (x ->> 'date')::date < q.date
 order by days_early desc;
