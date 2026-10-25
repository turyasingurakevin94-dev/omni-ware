-- Store round 10 (STO-REL-12): repair the TEST order if round-10-test-order.sql gave it no item
-- (item: null). On live, stock rows keep the item in `key` ("product id" or "product id::variant")
-- and leave product_id empty, so the first script picked a row with no id. This picks the named
-- item the shop holds most of (at least 5), from the key, and puts it on the TEST order's one line.
-- Run once in the SQL editor. It touches only the order named "TEST · two tabs".
with q as (
  select id, shop_id from saved_quotes where client_name = 'TEST · two tabs' and coalesce(voided, false) = false
), item as (
  select split_part(s.key, '::', 1) as pid, nullif(split_part(s.key, '::', 2), '') as vi, p.name,
         coalesce((select r.unit from prices r where r.shop_id = s.shop_id and r.product_id = split_part(s.key, '::', 1) and r.unit is not null limit 1), 'pc') as unit
    from stock s
    join q on q.shop_id = s.shop_id
    join products p on p.shop_id = s.shop_id and p.id = split_part(s.key, '::', 1)
   where s.qty >= 5 and nullif(trim(p.name), '') is not null
   order by s.qty desc
   limit 1
)
update saved_quotes sq
   set payload = jsonb_set(sq.payload, '{items}', jsonb_build_array(jsonb_build_object(
         'lineId', 1, 'productId', item.pid, 'productName', item.name,
         'variantIdx', case when item.vi ~ '^\d+$' then item.vi::int end, 'qty', 1, 'unit', item.unit)))
  from q, item
 where sq.id = q.id
returning sq.id as test_order, sq.payload -> 'items' -> 0 ->> 'productName' as item, sq.payload -> 'items' -> 0 ->> 'productId' as product_id;
