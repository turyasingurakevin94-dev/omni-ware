-- Sales round 2: read-only checks for the corrections Kevin approves.
-- Paste into the Supabase SQL editor, one query at a time. Nothing here writes.

-- 1 · SAL-011: the six customers, bill by bill.
--     balance   = customers.debt
--     old_book  = debt-log lines with no order (the old book, deposits)
--     per bill  = what it says is due, and the share of the balance it carries (debtCharged)
--     A bill whose share differs from what it says is due is where the balance went wrong.
with shop as (select id from shops where name = 'Omni-ware (old records)'),
six as (select unnest(array['C953','C1005','C979','C110','C114','C925']) as cid)
select c.id, c.name, c.debt as balance,
       (select coalesce(sum(case when l.type = 'charge' then l.amount else -l.amount end), 0)
          from customer_debt_log l where l.shop_id = shop.id and l.customer_id = c.id and l.quote_id is null) as old_book,
       q.id as bill, q.invoiced_at,
       round(ow_order_total(shop.id, q.payload, false)) as total, q.amount_paid as paid,
       greatest(0, round(ow_order_total(shop.id, q.payload, false)) - coalesce(q.amount_paid, 0)) as says_due,
       ow_num(q.payload ->> 'debtCharged') as share_of_balance
  from shop cross join six
  join customers c on c.shop_id = shop.id and c.id = six.cid
  left join saved_quotes q on q.shop_id = shop.id and q.payload ->> 'customerId' = c.id and q.invoiced and not coalesce(q.voided, false)
 order by c.id, q.invoiced_at;

-- 2 · SAL-011: the six customers' debt-log lines (newest first), to see each move of the balance.
with shop as (select id from shops where name = 'Omni-ware (old records)')
select l.customer_id, l.date, l.type, l.amount, l.quote_id, l.cash_txn_id, l.note
  from customer_debt_log l, shop
 where l.shop_id = shop.id and l.customer_id in ('C953','C1005','C979','C110','C114','C925')
 order by l.customer_id, l.date desc, l.id desc;

-- 3 · SAL-018: the test records, and what they add to October.
with shop as (select id from shops where name = 'Omni-ware (old records)'),
t as (
  select q.id from saved_quotes q, shop
   where q.shop_id = shop.id
     and (coalesce(q.client_name, q.payload -> 'client' ->> 'name', '') ilike 'TEST%'
          or exists (select 1 from customers c where c.shop_id = shop.id and c.id = q.payload ->> 'customerId' and c.name ilike 'TEST%')
          or exists (select 1 from cash_txns x where x.shop_id = shop.id and x.quote_id = q.id and x.description ilike '%TESTQA%'))
)
select 'order' as what, q.id::text as ref, q.date::text as day, q.status, q.invoiced, q.voided,
       round(ow_order_total((select id from shop), q.payload, false)) as amount, q.amount_paid as paid, q.client_name as who
  from saved_quotes q where q.id in (select id from t)
union all
select 'receipt', c.id::text, c.date::text, c.category, null, null, c.amount, null, c.description
  from cash_txns c, shop
 where c.shop_id = shop.id and c.type = 'receipt' and (c.quote_id in (select id from t) or c.description ilike '%TESTQA%')
order by 1, 2;
