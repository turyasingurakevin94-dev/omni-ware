-- Store round 9 (STO-SPD-03): how big each part of the Store snapshot is. Read-only: it runs
-- store_snapshot as the shop's Store login, for this transaction only, and rolls back.
begin;
select set_config('request.jwt.claim.sub', m.user_id::text, true),
       set_config('request.jwt.claims', json_build_object('sub', m.user_id, 'role', 'authenticated')::text, true)
  from shop_members m where m.role = 'store' limit 1;

-- 1. Each part, biggest first.
with s as (select store_snapshot((select shop_id from shop_members where role = 'store' limit 1)) as j)
select k as part,
       case when jsonb_typeof(v) = 'array' then jsonb_array_length(v) end as items,
       length(v::text) as bytes,
       pg_size_pretty(length(v::text)::bigint) as size
  from s, jsonb_each(s.j)
 order by bytes desc;

-- 2. Inside the orders: which payload keys weigh most.
with s as (select store_snapshot((select shop_id from shop_members where role = 'store' limit 1)) as j),
     o as (select jsonb_array_elements(s.j -> 'orders') as e from s)
select key, count(*) as orders, sum(length(value::text)) as bytes
  from o, jsonb_each(o.e -> 'payload')
 group by key
 order by bytes desc
 limit 15;
rollback;
