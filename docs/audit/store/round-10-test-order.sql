-- Store round 10 (STO-REL-12): one TEST order to pack and hand over from two tabs.
-- Run once in the SQL editor. It makes a walk-in order "TEST · two tabs" in the shop the
-- Store login works in: 1 of the in-stock item the shop holds most of, ready to pack, no price
-- (so nothing is owed and the money gate does not hold it). Sales round 2 keeps an order named
-- "TEST …" out of every figure. When the test is done, run round-10-test-order-cleanup.sql.
--
-- The test: open the order on two phones or tabs (Store login). Tab A packs it; tab B, still
-- showing it unpacked, packs too -> the blue "Someone else just did this · Refreshed". Then tab A
-- hands it over; tab B tries -> the same blue bar, and nothing changes.
with shop as (
  select m.shop_id from shop_members m where m.role = 'store' order by m.shop_id limit 1
), item as (
  select s.product_id, s.variant_idx, coalesce(p.name, s.product_id) as name,
         coalesce((select r.unit from prices r where r.shop_id = s.shop_id and r.product_id = s.product_id and r.unit is not null limit 1), 'pc') as unit
    from stock s join shop on shop.shop_id = s.shop_id
    left join products p on p.shop_id = s.shop_id and p.id = s.product_id
   where s.qty >= 5
   order by s.qty desc
   limit 1
)
insert into saved_quotes (shop_id, client_name, status, date, payload)
select shop.shop_id, 'TEST · two tabs', 'preparing', current_date,
       jsonb_build_object(
         'createdAt', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
         'savedAt', (extract(epoch from now()) * 1000)::bigint,
         'stageEnteredAt', (extract(epoch from now()) * 1000)::bigint,
         'deliveryMode', 'pickup',
         'items', jsonb_build_array(jsonb_build_object('lineId', 1, 'productId', item.product_id, 'productName', item.name,
                    'variantIdx', case when item.variant_idx ~ '^\d+$' then item.variant_idx::int end, 'qty', 1, 'unit', item.unit)))
  from shop, item
returning id as test_order, client_name, payload -> 'items' -> 0 ->> 'productName' as item;
