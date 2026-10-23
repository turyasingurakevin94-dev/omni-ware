-- 0157 asked of a real database (test/store-asks.test.js): the yard asks,
-- the right person answers, the wrong one is refused, each side is pushed,
-- and a trip line with no order reaches the shelf with the yard's reason.
\set ON_ERROR_STOP 1
grant all on all tables in schema public to authenticated;
grant all on all sequences in schema public to authenticated;
insert into auth.users values ('00000000-0000-0000-0000-00000000000a','o@x'),('00000000-0000-0000-0000-00000000000b','m@x'),('00000000-0000-0000-0000-00000000000c','b@x'),('00000000-0000-0000-0000-00000000000e','s@x'),('00000000-0000-0000-0000-000000000010','s2@x');
insert into shops(id,name,created_by) values ('11111111-1111-1111-1111-111111111111','M','00000000-0000-0000-0000-00000000000a');
insert into shop_members(shop_id,user_id,role) values ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000a','owner'),('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000b','manager'),('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000c','buyer'),('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000e','store'),('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-000000000010','store');
insert into staff(shop_id,id,name,role,user_id) values ('11111111-1111-1111-1111-111111111111','W1','Ruth Nakato','manager','00000000-0000-0000-0000-00000000000b'),('11111111-1111-1111-1111-111111111111','W2','Denis Okello','buyer','00000000-0000-0000-0000-00000000000c'),('11111111-1111-1111-1111-111111111111','W3','Musa Kato','store','00000000-0000-0000-0000-00000000000e'),('11111111-1111-1111-1111-111111111111','W4','Joy Nabirye','store','00000000-0000-0000-0000-000000000010');
insert into suppliers(shop_id,id,name) values ('11111111-1111-1111-1111-111111111111','S1','Nakawa');
insert into products(shop_id,id,name) values ('11111111-1111-1111-1111-111111111111','P1','Cement');
insert into collection_trips(shop_id,id,supplier_id,status,lines) values ('11111111-1111-1111-1111-111111111111','T1','S1','collected','[{"lineId":1,"orderId":null,"productId":"P1","productName":"Cement","qty":5,"unit":"bag","gotQty":5},{"lineId":2,"orderId":"restock","productId":"P1","productName":"Cement","qty":2,"unit":"bag","gotQty":3}]');
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000e';
insert into store_asks(shop_id,kind,ref,asked_by,asked_by_name,payload) values ('11111111-1111-1111-1111-111111111111','restock','P1','00000000-0000-0000-0000-00000000000e','Musa Kato','{"name":"Cement","qty":20,"unit":"bags","when":"today","shortFor":[42]}');
insert into store_asks(shop_id,kind,ref,asked_by,asked_by_name,payload) values ('11111111-1111-1111-1111-111111111111','extra','T1','00000000-0000-0000-0000-00000000000e','Musa Kato','{"name":"Nails","qty":2,"unit":"kg"}');
insert into store_asks(shop_id,kind,ref,asked_by,asked_by_name,payload) values ('11111111-1111-1111-1111-111111111111','handover','x','00000000-0000-0000-0000-00000000000e','Musa Kato','{"toUserId":"00000000-0000-0000-0000-000000000010","orders":[45]}');
insert into store_asks(shop_id,kind,ref,asked_by,asked_by_name,payload) values ('11111111-1111-1111-1111-111111111111','close','2026-10-22','00000000-0000-0000-0000-00000000000e','Musa Kato','{"out":5,"carries":1}');
\set ON_ERROR_STOP 0
-- refused: asking as someone else; answering your own restock; Joy answering the extra
insert into store_asks(shop_id,kind,asked_by) values ('11111111-1111-1111-1111-111111111111','restock','00000000-0000-0000-0000-00000000000b');
select answer_store_ask((select id from store_asks where kind='restock'),'accepted',null);
update store_asks set status='accepted';
select count(*) as updated_directly from store_asks where status <> 'sent';
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000010';
select answer_store_ask((select id from store_asks where kind='extra'),'accepted',null);
select answer_store_ask((select id from store_asks where kind='close'),'accepted',null);
\set ON_ERROR_STOP 1
select answer_store_ask((select id from store_asks where kind='handover'),'accepted',null);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
select answer_store_ask((select id from store_asks where kind='restock'),'accepted','Monday round');
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select answer_store_ask((select id from store_asks where kind='extra'),'declined',null);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000e';
select receive_trip('11111111-1111-1111-1111-111111111111','T1','[{"shop":5,"pack":1},{"shop":2,"pack":1,"why":"short"}]');
reset role;
select kind, status, note from store_asks order by created_at;
select kind, to_user, to_task, to_role, title, body from push_outbox order by id;
select key, qty from stock;
select jsonb_path_query(lines, '$[*].yardWhy') from collection_trips where id='T1';
