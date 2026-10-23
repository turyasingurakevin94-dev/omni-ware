-- 0159 asked of a real database (test/store-no-money.test.js): a Store login reads no books,
-- the snapshot carries no money, and the yard's writes leave prices, payments and cash alone.
\set ON_ERROR_STOP 1
grant all on all tables in schema public to authenticated;
grant all on all sequences in schema public to authenticated;
insert into auth.users values ('00000000-0000-0000-0000-00000000000a','o@x'),('00000000-0000-0000-0000-00000000000b','m@x'),('00000000-0000-0000-0000-00000000000e','s@x');
insert into shops(id,name,created_by) values ('11111111-1111-1111-1111-111111111111','M','00000000-0000-0000-0000-00000000000a');
insert into shop_members(shop_id,user_id,role) values ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000a','owner'),('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000b','manager'),('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000e','store');
insert into staff(shop_id,id,name,role,user_id,pay_rate) values ('11111111-1111-1111-1111-111111111111','W3','Musa Kato','store','00000000-0000-0000-0000-00000000000e',300000);
insert into customers(shop_id,id,name,location,debt,credit_limit) values ('11111111-1111-1111-1111-111111111111','C1','Kato','Kira',500000,1000000);
insert into products(shop_id,id,name,variants) values ('11111111-1111-1111-1111-111111111111','P1','Cement','[{"label":"Hima","price":32000,"unit":"bag"}]');
insert into suppliers(shop_id,id,name) values ('11111111-1111-1111-1111-111111111111','S1','Nakawa');
insert into prices(shop_id,product_id,supplier_id,wholesale,retail,unit) values ('11111111-1111-1111-1111-111111111111','P1','S1',30000,32000,'bag');
insert into saved_quotes(id,shop_id,client_name,status,amount_paid,payload) overriding system value values (7001,'11111111-1111-1111-1111-111111111111','Kato','preparing',10000,
 '{"customerId":"C1","agentPaymentStatus":"paid","payments":[{"amount":10000}],"charges":[{"x":"transport","amt":5000}],"rate":1.18,"receipts":[{"qty":1,"price":30000}],"creditAsk":{"at":"2026-10-23T09:00:00Z","owed":64000,"answer":{"decision":"credit"}},"items":[{"lineId":1,"productId":"P1","productName":"Cement","qty":10,"unit":"bag","sellPrice":32000,"price":32000,"costPrice":30000},{"lineId":2,"productId":"P1","productName":"Cement B","qty":2,"unit":"bag","sellPrice":32000}],"creditNotes":[{"askId":"x","amount":5000}]}');
insert into saved_quotes(id,shop_id,client_name,status,payload) overriding system value values (7002,'11111111-1111-1111-1111-111111111111','Ggaba','completed','{"deliveredAt":"2026-10-22T10:00:00Z","items":[{"lineId":1,"productId":"P1","qty":5,"unit":"bag","sellPrice":32000}]}');
insert into collection_trips(id,shop_id,supplier_id,status,assigned_worker_id,lines,cash_given) values ('T1','11111111-1111-1111-1111-111111111111','S1','assigned','W3','[{"productId":"P1","qty":5,"gotPrice":29000,"expectedPrice":30000}]',150000);
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000e';
select 'store reads quotes', count(*) from saved_quotes;
select 'store reads prices', count(*) from prices;
select 'store reads customers', count(*) from customers;
select 'store reads staff', count(*) from staff;
select 'store reads trips', count(*) from collection_trips;
select 'store reads stock_log', count(*) from stock_log;
select 'store reads stock', count(*) from stock;
select 'money keys in snapshot', (select count(*) from regexp_matches(store_snapshot('11111111-1111-1111-1111-111111111111')::text, '(price|cost|amount|payment"|paid"|debt|credit_limit|pay_rate|cash)', 'gi'));
select 'snapshot keeps', store_snapshot('11111111-1111-1111-1111-111111111111') -> 'orders' -> 0 -> 'payload' ->> 'agentSettled', jsonb_array_length(store_snapshot('11111111-1111-1111-1111-111111111111') -> 'orders');
select 'patch', store_patch_order('11111111-1111-1111-1111-111111111111', 7001, '{"pickingStatus":"in_progress","assignedWorkerId":"W3","items":"x","amount_paid":0}', null, '[{"lineId":"1","pickStatus":"done","pickedQty":10,"sellPrice":1}]') -> 'payload' -> 'items' -> 0;
select 'trip', store_patch_trip('11111111-1111-1111-1111-111111111111', 'T1', '{"0":5}', 'collected');
select 'money keys 0160', (select count(*) from regexp_matches(store_snapshot('11111111-1111-1111-1111-111111111111')::text, '("amt"|"rate"|"receipts"|"charges"|"owed"|"sum"|"value"|"price")', 'gi'));
select 'allow list keeps', store_snapshot('11111111-1111-1111-1111-111111111111') -> 'orders' -> 0 -> 'payload' -> 'letGoAsk' -> 'answer' ->> 'decision', store_snapshot('11111111-1111-1111-1111-111111111111') -> 'orders' -> 0 -> 'payload' -> 'takenBack' -> 0 ->> 'askId', store_snapshot('11111111-1111-1111-1111-111111111111') -> 'orders' -> 0 -> 'payload' -> 'items' -> 0 ->> 'productName';
select 'return', store_return_ask('11111111-1111-1111-1111-111111111111', 7002, '[{"idx":0,"qty":2,"condition":"damaged","shown":"2 bags","price":1}]', 'Damaged after delivery', 'burst') ->> 'lines';
do $$ begin perform store_return_ask('11111111-1111-1111-1111-111111111111', 7002, '[{"idx":0,"qty":4,"condition":"good"}]', 'Too many sent', null); raise notice 'too big|accepted'; exception when others then raise notice 'too big|%', sqlerrm; end $$;
select 'deliver note', store_patch_order('11111111-1111-1111-1111-111111111111', 7001, '{"deliveredNote":"The camera will not open"}', null, null) -> 'payload' ->> 'deliveredNote';
reset role;
select 'prices kept after patch', payload -> 'items' -> 0 ->> 'sellPrice', payload -> 'items' -> 0 ->> 'pickStatus', payload ->> 'pickingStatus', payload -> 'payments' is not null, amount_paid from saved_quotes where id = 7001;
select 'trip row', status, lines -> 0 ->> 'gotQty', lines -> 0 ->> 'gotPrice', cash_given from collection_trips where id='T1';
select 'return row', amount, lines -> 0 ->> 'price', reason, note from invoice_asks;
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select 'manager reads quotes', count(*) from saved_quotes;
select 'manager reads prices', count(*) from prices;
