-- 0161 asked of a real database (test/store-round1.test.js), after store-round1-before.sql.
grant all on all tables in schema public to authenticated;
grant all on all sequences in schema public to authenticated;
-- DATA-01: the duplicate already there was resolved, the newest kept.
select 'dup', string_agg(status || ':' || coalesce(replaces::text, '-'), ',' order by created_at) from stock_counts where aisle = 'Aisle A · Aluminum';
select 'place', place from stock_counts where id = 'aaaaaaaa-0000-0000-0000-000000000002';
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000f';
do $$ begin insert into stock_counts(shop_id,aisle,counted_by,counted_by_name,lines) values ('11111111-1111-1111-1111-111111111111','Aisle A · Aluminum','00000000-0000-0000-0000-00000000000f','Joy','[]'); raise notice 'second|accepted';
exception when unique_violation then raise notice 'second|refused'; end $$;
select 'replace', r ->> 'replaced', r ->> 'counted_by_name', r ->> 'replaces', r ->> 'status'
  from store_count_replace('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000002', 'Aisle A · Aluminum', '[{"key":"P1","counted":1}]', '[]', 'Joy') r;
select 'after replace', string_agg(status, ',' order by created_at) from stock_counts where aisle = 'Aisle A · Aluminum';
select 'spot', ow_count_place('Spot count · Casters', '[{"key":"P103"}]'), ow_count_place('Aisle G · Furniture', '[]');
reset role;
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
do $$ begin perform accept_stock_count('aaaaaaaa-0000-0000-0000-000000000002'); raise notice 'accept old|accepted'; exception when others then raise notice 'accept old|%', sqlerrm; end $$;
select 'accept new', accept_stock_count(id) ->> 'ok' from stock_counts where aisle = 'Aisle A · Aluminum' and status = 'sent';
reset role;
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000e';
select 'replace after accept', r ->> 'replaced', r ->> 'status'
  from (select id from stock_counts where aisle = 'Aisle A · Aluminum' and status = 'accepted' order by created_at desc limit 1) a,
       store_count_replace('11111111-1111-1111-1111-111111111111', a.id, 'Aisle A · Aluminum', '[{"key":"P1","counted":1}]', '[]', 'Musa') r;
-- DATA-02: the unit is the order line's.
select 'new return', store_return_ask('11111111-1111-1111-1111-111111111111', 495, '[{"idx":0,"qty":20,"unit":"Ctn","condition":"good"}]', 'Came back', null) -> 'lines' -> 0 ->> 'unit';
reset role;
select 'old return', lines -> 0 ->> 'unit', lines -> 0 ->> 'qty', lines -> 0 ? 'shown', amount from invoice_asks where id = 'bbbbbbbb-0000-0000-0000-000000000001';
-- DATA-03: never past the shelf, one stock_log row naming the report.
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
do $$ begin perform write_off_stock('11111111-1111-1111-1111-111111111111', array['cccccccc-0000-0000-0000-000000000001']::uuid[], null, 'damaged'); raise notice 'empty shelf|written off';
exception when others then raise notice 'empty shelf|%', sqlerrm; end $$;
select 'write off', write_off_stock('11111111-1111-1111-1111-111111111111', array['cccccccc-0000-0000-0000-000000000002']::uuid[],
  '[{"key":"P103","productId":"P103","name":"Casters","delta":-2}]', 'damaged') ->> 'changed';
reset role;
select 'log', count(*), trim_scale(max(delta)), trim_scale(max(qty_after)), bool_and(note like '%report cccccccc-0000-0000-0000-000000000002%') from stock_log where key = 'P103' and type = 'writeoff';
select 'reports', string_agg(status, ',' order by id) from stock_reports;
-- DATA-05 / DATA-06: the moves, the names, the variants; another shop's P269 untouched.
select 'moved', string_agg(id || ':' || coalesce(category, '-'), ',' order by id) from products where shop_id = '11111111-1111-1111-1111-111111111111';
select 'other shop', name, category from products where shop_id = '22222222-2222-2222-2222-222222222222';
select 'renamed', string_agg(name, ',' order by id) from products where shop_id = '11111111-1111-1111-1111-111111111111' and id in ('P269', 'P271', 'P435');
select 'variants', string_agg(v -> 'combo' ->> 'Pipe Sizes', ',') from products, jsonb_array_elements(variants) v where id = 'P107';
select 'bend', variants -> 1 -> 'combo' ->> 'Mulper Type', variants -> 0 -> 'combo' ->> 'Mulper Type' from products where id = 'P271' and shop_id = '11111111-1111-1111-1111-111111111111';
