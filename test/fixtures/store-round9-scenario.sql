-- Round 9 asked of a real database (test/store-round9.test.js): store_live is the part of the
-- snapshot that changes all day, with the stock folded in; store_snapshot is it plus the rest;
-- the windows are trimmed; no money; someone outside the shop is refused.
\set ON_ERROR_STOP 1
grant all on all tables in schema public to authenticated;
grant all on all sequences in schema public to authenticated;
insert into auth.users values ('00000000-0000-0000-0000-00000000000a','owner@x'),('00000000-0000-0000-0000-00000000000e','musa@x'),('00000000-0000-0000-0000-000000000099','stranger@x');
insert into shops(id,name,created_by) values ('11111111-1111-1111-1111-111111111111','Mukasa Hardware','00000000-0000-0000-0000-00000000000a');
insert into shop_members(shop_id,user_id,role) values
  ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000a','owner'),
  ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000e','store');
insert into staff(shop_id,id,name,role,user_id) values ('11111111-1111-1111-1111-111111111111','W3','Musa Kiggundu','store','00000000-0000-0000-0000-00000000000e');
insert into suppliers(shop_id,id,name) values ('11111111-1111-1111-1111-111111111111','S1','Katwe Fabricators');
insert into products(shop_id,id,name,category) values ('11111111-1111-1111-1111-111111111111','P1','ABC Black Screws Coarse','Nails');
insert into prices(shop_id,product_id,supplier_id,unit,pack_unit,pack_qty,wholesale,retail) values ('11111111-1111-1111-1111-111111111111','P1','S1','Box','Ctn',20,5000,6000);
begin;  -- 0169: a key's stock and its lots go in together (checked at commit)
insert into stock(shop_id,key,product_id,qty) values ('11111111-1111-1111-1111-111111111111','P1','P1',14),('11111111-1111-1111-1111-111111111111','P2','P2',3);
insert into stock_lots(shop_id,key,qty,cost) values ('11111111-1111-1111-1111-111111111111','P1',14,5000),('11111111-1111-1111-1111-111111111111','P2',3,5000);
commit;
insert into saved_quotes(id,shop_id,client_name,status,amount_paid,payload) overriding system value values
 (601,'11111111-1111-1111-1111-111111111111','Kato Construction','preparing',0,'{"items":[{"lineId":1,"productId":"P1","qty":2,"unit":"Box","price":6000}]}'),
 (602,'11111111-1111-1111-1111-111111111111','Ssali','completed',0,jsonb_build_object('deliveredAt', to_char(now() - interval '29 days', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), 'items', '[]'::jsonb)),
 (603,'11111111-1111-1111-1111-111111111111','Nakato','completed',0,jsonb_build_object('deliveredAt', to_char(now() - interval '32 days', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), 'items', '[]'::jsonb));
insert into collection_trips(id,shop_id,supplier_id,status,created_at,voided,lines) values
 ('T1','11111111-1111-1111-1111-111111111111','S1','collected',now() - interval '1 day',false,'[]'),
 ('T2','11111111-1111-1111-1111-111111111111','S1','open',now() - interval '3 days',true,'[]'),
 ('T3','11111111-1111-1111-1111-111111111111','S1','open',now() - interval '15 days',true,'[]');
insert into stock_log(shop_id,key,type,delta,qty_after,date,note) values
 ('11111111-1111-1111-1111-111111111111','P1','in',10,10,current_date - 27,'in'),
 ('11111111-1111-1111-1111-111111111111','P1','in',4,14,current_date - 30,'in');
\unset ON_ERROR_STOP

set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000e';
select 'live keys', string_agg(k, ',' order by k) from jsonb_object_keys(store_live('11111111-1111-1111-1111-111111111111')) k;
select 'snap keys', string_agg(k, ',' order by k) from jsonb_object_keys(store_snapshot('11111111-1111-1111-1111-111111111111')) k;
select 'live part of snap', (select store_snapshot('11111111-1111-1111-1111-111111111111')) @> store_live('11111111-1111-1111-1111-111111111111');
select 'stock', store_live('11111111-1111-1111-1111-111111111111') ->> 'stock';
select 'orders', string_agg(e ->> 'id', ',' order by (e ->> 'id')::int) from jsonb_array_elements(store_live('11111111-1111-1111-1111-111111111111') -> 'orders') e;
select 'trips', string_agg(e ->> 'id', ',' order by e ->> 'id') from jsonb_array_elements(store_live('11111111-1111-1111-1111-111111111111') -> 'trips') e;
select 'log', jsonb_array_length(store_snapshot('11111111-1111-1111-1111-111111111111') -> 'log');
select 'unit', store_snapshot('11111111-1111-1111-1111-111111111111') -> 'units' -> 0;
select 'money', coalesce((regexp_match(store_snapshot('11111111-1111-1111-1111-111111111111')::text, '[^"]{0,20}(price|cost|amount|paid|payment|credit|UGX)[^"]{0,20}', 'i'))[1], 'none');
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000099';
do $$ begin perform store_live('11111111-1111-1111-1111-111111111111'); raise notice 'stranger|live|loaded';
  exception when others then raise notice 'stranger|live|refused|%', sqlstate; end $$;
reset role;
