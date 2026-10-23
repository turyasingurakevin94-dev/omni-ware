-- Store round 9 (STO-SPD-03): how big each part of the Store snapshot is. Read-only, one statement:
-- it runs store_snapshot as the shop's Store login (for this statement only) and lists
--   1. each part of the snapshot, biggest first, then
--   2. the heaviest keys inside the orders' payloads.
with who as materialized (
  select m.shop_id,
         set_config('request.jwt.claim.sub', m.user_id::text, true) as a,
         set_config('request.jwt.claims', json_build_object('sub', m.user_id, 'role', 'authenticated')::text, true) as b
    from shop_members m where m.role = 'store' limit 1),
s as materialized (select store_snapshot(who.shop_id) as j from who),
parts as (
  select '1 · part' as what, e.key as name,
         case when jsonb_typeof(e.value) = 'array' then jsonb_array_length(e.value) end as items,
         length(e.value::text) as bytes
    from s, jsonb_each(s.j) e),
payload as (
  select '2 · order payload key' as what, p.key as name, count(*)::int as items, sum(length(p.value::text))::int as bytes
    from s, jsonb_array_elements(s.j -> 'orders') o, jsonb_each(o -> 'payload') p
   group by p.key order by 4 desc limit 15)
select what, name, items, bytes, pg_size_pretty(bytes::bigint) as size,
       (select pg_size_pretty(length(j::text)::bigint) from s) as whole_snapshot
  from (select * from parts union all select * from payload) x
 order by what, bytes desc;
