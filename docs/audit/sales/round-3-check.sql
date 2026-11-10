-- Sales round 3: read-only checks. Paste into the Supabase SQL editor, one query at a time. Nothing here writes.

-- 1 · SAL-019: which shops Daphine's sign-in opens, oldest first (the new app opened the first; sales.html asks).
select m.shop_id, s.name, s.created_at, m.role, m.display_name
  from shop_members m join shops s on s.id = m.shop_id
  join auth.users u on u.id = m.user_id
 where u.email ilike 'daphine%' or m.display_name ilike 'daphine%'
 order by s.created_at;

-- 2 · SAL-019: every shop's orders: how many, the lowest and highest number, the newest.
--     Orders #494–#586 should show in exactly one row; if it is not the shop from query 1's first row, the
--     new app opened the wrong shop.
select s.id as shop_id, s.name, count(q.*) as orders, min(q.id) as lowest, max(q.id) as highest, max(q.date) as newest
  from shops s left join saved_quotes q on q.shop_id = s.id
 group by s.id, s.name order by s.name;

-- 3 · SAL-019: where #0494, #0570 and #0586 are, and the asks that name them.
select 'order' as what, q.shop_id, q.id, q.date::timestamptz as at from saved_quotes q where q.id in (494, 570, 586)
union all
select 'bill ask', a.shop_id, a.quote_id, a.created_at from invoice_asks a where a.quote_id in (494, 570, 586)
order by id, what;

-- 4 · SAL-019: what a sales sign-in may read (its policies), against what is there. Run as the database owner;
--     replace the shop id with query 1's. If "seen" is lower than "there", a policy hides orders from Sales.
--   begin;
--   set local role authenticated;
--   select set_config('request.jwt.claims', json_build_object('sub', '<daphine user id>', 'role', 'authenticated')::text, true);
--   select count(*) as seen from saved_quotes where shop_id = '<shop id>';
--   rollback;
--   select count(*) as there from saved_quotes where shop_id = '<shop id>';

-- 5 · SAL-020: each customer's stored balance against what the app showed (opening + open bills), the five
--     the brief names. "balance" is the truth (0165 ow_balance_check); the app's figure should equal it.
with inv as (
  select q.shop_id, q.payload ->> 'customerId' as cid,
         sum(greatest(0, round(ow_order_total(q.shop_id, q.payload, false)) - coalesce(q.amount_paid, 0))) as due
    from saved_quotes q
   where q.invoiced and not coalesce(q.voided, false) and coalesce(q.payload ->> 'customerId', '') <> ''
   group by 1, 2
)
select c.name, c.debt as balance, coalesce(i.due, 0) as open_bills,
       greatest(0, coalesce(c.debt, 0) - coalesce(i.due, 0)) as opening_by_the_rule,
       (select coalesce(sum(case when l.type = 'charge' then l.amount else -l.amount end), 0)
          from customer_debt_log l where l.shop_id = c.shop_id and l.customer_id = c.id and l.quote_id is null) as opening_the_app_used
  from customers c left join inv i on i.shop_id = c.shop_id and i.cid = c.id
 where c.name ilike any (array['Onora%', 'Mulongo%', 'Hajat%', 'Ken Bwaise%'])
 order by c.name;

-- 6 · SAL-021: the ask to cancel #0586 needs ask_cancel (0181). Kevin's 10 Nov check said 0181 is not applied:
select proname from pg_proc where proname in ('ask_cancel', 'withdraw_cancel_ask');   -- 2 rows once 0181 is in
