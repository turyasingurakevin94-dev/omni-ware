-- The shared foundation (0119), asked of a real database: the Checking
-- gate, the one invoicing function, the 24-hour run, and a stale copy
-- that tries to take an invoice back. Each row: what is tried, as whom,
-- and whether it must go through or be refused. A 'check:' row is a
-- do-block that raises when the books are not as they should be.
grant all on all tables in schema public to authenticated;
grant all on all sequences in schema public to authenticated;
insert into auth.users values
 ('00000000-0000-0000-0000-00000000000a','owner@x'),('00000000-0000-0000-0000-00000000000b','manager@x'),
 ('00000000-0000-0000-0000-00000000000d','sales@x'),('00000000-0000-0000-0000-00000000000e','store@x'),
 ('00000000-0000-0000-0000-00000000000f','accounts@x');
insert into shops(id, name, created_by) values ('11111111-1111-1111-1111-111111111111','Mukasa Hardware','00000000-0000-0000-0000-00000000000a');
insert into shop_members(shop_id,user_id,role) values
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000a','owner'),
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000b','manager'),
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000d','sales'),
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000e','store'),
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000f','accounts');
insert into staff(shop_id,id,name,role,user_id) values
 ('11111111-1111-1111-1111-111111111111','W1','Ruth Nakato','manager','00000000-0000-0000-0000-00000000000b'),
 ('11111111-1111-1111-1111-111111111111','W2','Grace Akello','sales','00000000-0000-0000-0000-00000000000d');
insert into app_settings(shop_id, presets) values ('11111111-1111-1111-1111-111111111111',
 '{"defaultMarkup":{"wholesaleType":"percent","wholesaleValue":25,"retailType":"percent","retailValue":25}}')
 on conflict (shop_id) do update set presets = excluded.presets;
insert into suppliers(shop_id, id, name) values
 ('11111111-1111-1111-1111-111111111111','S1','Nakawa Cement Depot'),
 ('11111111-1111-1111-1111-111111111111','S2','Kiseka Steel');
insert into products(shop_id,id,name) values
 ('11111111-1111-1111-1111-111111111111','P1','Cement'),('11111111-1111-1111-1111-111111111111','P2','Nails');
-- Cement 30,000 a bag from Nakawa; nails 5,000 a kg from Kiseka, only by the 10 kg box.
insert into prices(id, shop_id, product_id, supplier_id, retail, wholesale, unit, pack_unit, pack_qty) values
 (1,'11111111-1111-1111-1111-111111111111','P1','S1',30000,null,'bag',null,null),
 (2,'11111111-1111-1111-1111-111111111111','P2','S2',null,5000,'kg','box',10);
insert into stock(shop_id,key,product_id,qty) values ('11111111-1111-1111-1111-111111111111','P1','P1',20);
insert into stock_lots(shop_id,key,qty,cost) values ('11111111-1111-1111-1111-111111111111','P1',10,28000),('11111111-1111-1111-1111-111111111111','P1',10,29000);
insert into customers(shop_id,id,name,debt,credit_limit,terms_days) values
 ('11111111-1111-1111-1111-111111111111','C001','Kato Construction',500000,1000000,30);

-- Orders already on the road to an invoice, made with no login (as an
-- import would), so the gate is not asked about them.
insert into saved_quotes(id, shop_id, client_name, status, invoiced, payload) overriding system value values
 -- delivered: 2 bags off the shelf, 4 kg of nails bought by the box
 (8001,'11111111-1111-1111-1111-111111111111','Ggaba Stores','completed',false,
  '{"client":{"name":"Ggaba Stores"},"items":[
    {"productId":"P1","productName":"Cement","qty":2,"price":28000,"unit":"bag","supplierId":"__stock__"},
    {"productId":"P2","productName":"Nails","qty":4,"price":5000,"unit":"kg","packUnit":"box","packQty":10,"supplierId":"S2"}]}'),
 -- delivered with a short pick nobody settled
 (8002,'11111111-1111-1111-1111-111111111111','Lubowa Builders','completed',false,
  json_build_object('client', json_build_object('name','Lubowa Builders'), 'deliveredAt', (now() - interval '30 hours')::text,
   'items', json_build_array(json_build_object('productId','P1','productName','Cement','qty',2,'pickedQty',1,'pickStatus','short','price',28000,'unit','bag','supplierId','__stock__')))::jsonb),
 -- a counter sale, and an ordinary delivered order
 (8003,'11111111-1111-1111-1111-111111111111','Walk-in','completed',false,
  '{"counter":true,"items":[{"productId":"P1","productName":"Cement","qty":1,"price":28000,"unit":"bag","supplierId":"__stock__"}]}'),
 (8007,'11111111-1111-1111-1111-111111111111','Walk-in','completed',false,
  '{"counter":true,"items":[{"productId":"P1","productName":"Cement","qty":1,"price":30000,"unit":"bag","supplierId":"S1"}]}'),
 (8004,'11111111-1111-1111-1111-111111111111','Nansana Hardware','completed',false,
  '{"items":[{"productId":"P1","productName":"Cement","qty":1,"price":28000,"unit":"bag","supplierId":"__stock__"}]}'),
 -- delivered 30 hours ago and 2 hours ago
 (8005,'11111111-1111-1111-1111-111111111111','Mukono Roofing','completed',false,
  json_build_object('deliveredAt', (now() - interval '30 hours')::text,
   'items', json_build_array(json_build_object('productId','P1','productName','Cement','qty',3,'price',28000,'unit','bag','supplierId','__stock__')))::jsonb),
 (8006,'11111111-1111-1111-1111-111111111111','Kyaligonza & Sons','completed',false,
  json_build_object('deliveredAt', (now() - interval '2 hours')::text,
   'items', json_build_array(json_build_object('productId','P1','productName','Cement','qty',1,'price',28000,'unit','bag','supplierId','__stock__')))::jsonb);

create table _r(n serial, label text, expect text, got text);
create function _try(label text, expect text, q text) returns void language plpgsql as $$
declare got text := 'ok';
begin
  declare n int; begin execute q; get diagnostics n = row_count;
    if n = 0 and (q ilike 'update%' or q ilike 'delete%') then got := 'refused: 0 rows (row-level security hid them)'; end if;
  exception when others then got := 'refused: ' || sqlerrm; end;
  insert into _r(label, expect, got) values (label, expect, got);
end $$;
grant all on _r, _r_n_seq to authenticated; grant execute on function _try to authenticated;
create function _is(cond_sql text) returns void language plpgsql security definer as $$
declare ok boolean;
begin execute 'select (' || cond_sql || ')' into ok;
  if not coalesce(ok, false) then raise exception 'not so: %', cond_sql; end if; end $$;
grant execute on function _is to authenticated;

set role authenticated;

-- ================= the Checking gate =================
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000d';

select _try('sales: an order all from our shelf', 'ok', $q$insert into saved_quotes(id,shop_id,client_name,status,payload) overriding system value values (9101,'11111111-1111-1111-1111-111111111111','Ggaba Stores','draft','{"items":[{"productId":"P1","qty":1,"price":28000,"supplierId":"__stock__"}]}')$q$);
select _try('check: it skipped Checking for Packing', 'ok', $q$select _is($c$(select status='preparing' and payload->'stageLog'->-1->>'shelf'='true' from saved_quotes where id=9101)$c$)$q$);
select _try('sales: a portal order from our shelf', 'ok', $q$insert into saved_quotes(id,shop_id,client_name,status,payload) overriding system value values (9102,'11111111-1111-1111-1111-111111111111','Agent client','draft','{"originPortal":true,"items":[{"productId":"P1","qty":1,"price":28000,"supplierId":"__stock__"}]}')$q$);
select _try('check: a portal order still waits in Checking', 'ok', $q$select _is($c$(select status='draft' from saved_quotes where id=9102)$c$)$q$);

select _try('sales: an order at a price under the shop''s', 'ok', $q$insert into saved_quotes(id,shop_id,client_name,status,payload) overriding system value values (9103,'11111111-1111-1111-1111-111111111111','Kato Construction','draft','{"items":[{"lineId":"L1","productId":"P1","qty":2,"price":30000,"sellPrice":35000,"priceBy":"GA","priceNote":"under","supplierId":"S1"}]}')$q$);
select _try('check: a supplier line stays in Checking', 'ok', $q$select _is($c$(select status='draft' from saved_quotes where id=9103)$c$)$q$);
select _try('sales: move it on to Buying', 'ok', $q$update saved_quotes set status='awaiting_goods', payload = payload || '{"supplierConfirms":{"S1":{"state":"yes"}},"stageLog":[{"status":"awaiting_goods","at":1}]}' where id=9103$q$);
select _try('check: held in Checking, the supplier''s yes kept, the move kept back', 'ok', $q$select _is($c$(select status='draft' and payload->'supplierConfirms'->'S1'->>'state'='yes' and payload->'gateHeldMove'->>'to'='awaiting_goods' and payload->'gateHeldMove'->>'why'='price' and not exists(select 1 from jsonb_array_elements(payload->'stageLog') e where e->>'status'='awaiting_goods') from saved_quotes where id=9103)$c$)$q$);
select _try('sales: decide its own price', 'refused', $q$update saved_quotes set payload = jsonb_set(payload, '{items,0,priceReview}', '{"price":35000,"qty":2}') where id=9103$q$);
select _try('sales: a new order that brings its own price decision', 'refused', $q$insert into saved_quotes(id,shop_id,client_name,status,payload) overriding system value values (9104,'11111111-1111-1111-1111-111111111111','X','draft','{"items":[{"productId":"P1","qty":1,"price":30000,"supplierId":"S1","priceReview":{"price":1,"qty":1}}]}')$q$);
select _try('sales: re-save it by upsert, still held', 'ok', $q$insert into saved_quotes(id,shop_id,client_name,status,payload) overriding system value select id,shop_id,client_name,'awaiting_goods',payload from saved_quotes where id=9103 on conflict (id) do update set status=excluded.status, payload=excluded.payload$q$);
select _try('check: the upsert was held the same way', 'ok', $q$select _is($c$(select status='draft' and payload->'gateHeldMove'->>'to'='awaiting_goods' from saved_quotes where id=9103)$c$)$q$);

set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select _try('manager: says yes to 35,000', 'ok', $q$update saved_quotes set payload = jsonb_set(payload, '{items,0,priceReview}', '{"price":35000,"qty":2,"by":"RN"}') where id=9103$q$);
select _try('check: the yes moved the order on to Buying itself', 'ok', $q$select _is($c$(select status='awaiting_goods' and not payload ? 'gateHeldMove' and payload->'stageLog'->-1->>'gate'='true' from saved_quotes where id=9103)$c$)$q$);

set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000d';
select _try('sales: re-save the order with the Manager''s yes on it', 'ok', $q$insert into saved_quotes(id,shop_id,client_name,status,payload) overriding system value select id,shop_id,client_name,status,payload from saved_quotes where id=9103 on conflict (id) do update set status=excluded.status, payload=excluded.payload$q$);
select _try('sales: change the yes the Manager wrote', 'refused', $q$update saved_quotes set payload = jsonb_set(payload, '{items,0,priceReview,price}', '1') where id=9103$q$);

-- a held move goes stale when the lines move under it
select _try('sales: another under-priced order, moved', 'ok', $q$insert into saved_quotes(id,shop_id,client_name,status,payload) overriding system value values (9105,'11111111-1111-1111-1111-111111111111','Lubowa Builders','awaiting_goods','{"items":[{"productId":"P1","qty":2,"price":30000,"sellPrice":35000,"priceBy":"GA","priceNote":"under","supplierId":"S1"}]}')$q$);
select _try('check: held at insert too', 'ok', $q$select _is($c$(select status='draft' and payload->'gateHeldMove'->>'to'='awaiting_goods' from saved_quotes where id=9105)$c$)$q$);
select _try('sales: change the quantity', 'ok', $q$update saved_quotes set payload = jsonb_set(payload, '{items,0,qty}', '5') where id=9105$q$);
select _try('check: the held move is dropped (stale)', 'ok', $q$select _is($c$(select status='draft' and not payload ? 'gateHeldMove' from saved_quotes where id=9105)$c$)$q$);

-- credit: Kato owes 500,000 of a 1,000,000 limit; 20 bags at 37,500 is 750,000
select _try('sales: an order that takes Kato over the limit, moved', 'ok', $q$insert into saved_quotes(id,shop_id,client_name,status,payload) overriding system value values (9106,'11111111-1111-1111-1111-111111111111','Kato Construction','awaiting_goods','{"customerId":"C001","items":[{"productId":"P1","qty":20,"price":30000,"supplierId":"S1"}]}')$q$);
select _try('check: held for credit', 'ok', $q$select _is($c$(select status='draft' and payload->'gateHeldMove'->>'why'='credit' from saved_quotes where id=9106)$c$)$q$);
select _try('sales: an order inside the limit, moved', 'ok', $q$insert into saved_quotes(id,shop_id,client_name,status,payload) overriding system value values (9107,'11111111-1111-1111-1111-111111111111','Kato Construction','awaiting_goods','{"customerId":"C001","items":[{"productId":"P1","qty":4,"price":30000,"supplierId":"S1"}]}')$q$);
select _try('check: inside the limit goes through', 'ok', $q$select _is($c$(select status='awaiting_goods' from saved_quotes where id=9107)$c$)$q$);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select _try('manager: says Hold', 'ok', $q$update saved_quotes set payload = payload || '{"creditCheck":{"decision":"hold"}}' where id=9106$q$);
select _try('check: Hold keeps it in Checking', 'ok', $q$select _is($c$(select status='draft' from saved_quotes where id=9106)$c$)$q$);
select _try('manager: says Release', 'ok', $q$update saved_quotes set payload = payload || '{"creditCheck":{"decision":"release"}}' where id=9106$q$);
select _try('check: Release moves it on', 'ok', $q$select _is($c$(select status='awaiting_goods' from saved_quotes where id=9106)$c$)$q$);

set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select _try('owner: move a price that waits', 'ok', $q$insert into saved_quotes(id,shop_id,client_name,status,payload) overriding system value values (9108,'11111111-1111-1111-1111-111111111111','Kato Construction','awaiting_goods','{"items":[{"productId":"P1","qty":1,"price":30000,"sellPrice":31000,"priceBy":"GA","priceNote":"under","supplierId":"S1"}]}')$q$);
select _try('check: the gate binds the owner too', 'ok', $q$select _is($c$(select status='draft' from saved_quotes where id=9108)$c$)$q$);
select _try('owner: decides the price', 'ok', $q$update saved_quotes set payload = jsonb_set(payload, '{items,0,priceReview}', '{"price":31000,"qty":1}') where id=9108$q$);
select _try('check: and the order moves', 'ok', $q$select _is($c$(select status='awaiting_goods' from saved_quotes where id=9108)$c$)$q$);

-- ================= invoicing =================
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000d';
select _try('sales: invoice a delivered order', 'refused', $q$select invoice_order('11111111-1111-1111-1111-111111111111', 8001)$q$);
select _try('sales: invoice its counter sale', 'ok', $q$select invoice_order('11111111-1111-1111-1111-111111111111', 8003)$q$);
select _try('sales: a "counter sale" with a supplier line', 'refused', $q$select invoice_order('11111111-1111-1111-1111-111111111111', 8007)$q$);
select _try('check: the counter sale is invoiced, 1 bag off', 'ok', $q$select _is($c$(select invoiced from saved_quotes where id=8003) and (select qty from stock where key='P1')=19$c$)$q$);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000e';
select _try('store: invoice an order', 'refused', $q$select invoice_order('11111111-1111-1111-1111-111111111111', 8001)$q$);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000f';
select _try('accounts: invoice an order', 'refused', $q$select invoice_order('11111111-1111-1111-1111-111111111111', 8001)$q$);
select _try('accounts: call the core directly', 'refused', $q$select ow_invoice_core('11111111-1111-1111-1111-111111111111', 8001, 'x', null, null)$q$);
select _try('accounts: run the 24-hour run', 'refused', $q$select ow_invoice_due_orders()$q$);

set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select _try('manager: invoice an order still in Buying', 'refused', $q$select invoice_order('11111111-1111-1111-1111-111111111111', 9103)$q$);
select _try('manager: invoice a short pick not settled', 'refused', $q$select invoice_order('11111111-1111-1111-1111-111111111111', 8002)$q$);
select _try('manager: invoice Ggaba''s delivered order', 'ok', $q$select _is($c$(select r->>'invoice'='INV-8001' and (r->>'total')::numeric=95000 and jsonb_array_length(r->'bills')=1 and (r->>'surplusStocked')::numeric=6 from (select invoice_order('11111111-1111-1111-1111-111111111111', 8001) r) x)$c$)$q$);
select _try('check: 2 bags off the shelf, oldest lot first', 'ok', $q$select _is($c$(select qty from stock where key='P1')=17 and (select qty from stock_lots where key='P1' and cost=28000)=7 and (select count(*) from stock_log where key='P1' and type='sale')=2$c$)$q$);
select _try('check: the 6 kg the box left over went on the shelf at cost', 'ok', $q$select _is($c$(select qty from stock where key='P2')=6 and exists(select 1 from stock_lots where key='P2' and qty=6 and cost=5000) and exists(select 1 from stock_log where key='P2' and type='restock' and supplier_id='S2')$c$)$q$);
select _try('check: one bill to Kiseka for the whole box', 'ok', $q$select _is($c$(select count(*)=1 and min(payload->>'supplierName')='Kiseka Steel' and min((payload->'items'->0->>'qty')::numeric)=10 and min(payload->>'customerName')='Ggaba Stores' from purchase_invoices where quote_id=8001)$c$)$q$);
select _try('check: Ggaba is made a customer and owes 95,000', 'ok', $q$select _is($c$(select c.debt=95000 and c.name='Ggaba Stores' from customers c where c.id=(select payload->>'customerId' from saved_quotes where id=8001)) and exists(select 1 from customer_debt_log where quote_id=8001 and type='charge' and amount=95000 and note='Auto-sync — INV-8001')$c$)$q$);
select _try('check: the order carries what the console needs to take it back', 'ok', $q$select _is($c$(select invoiced and invoiced_at is not null and (payload->>'debtCharged')::numeric=95000 and payload->'invoicedBy'->>'via'='invoice_order' and payload->'items'->0->>'_stockTaken'='2' and jsonb_array_length(payload->'items'->0->'_stockLots')=1 and payload->'items'->1->>'_surplusStocked'='6' from saved_quotes where id=8001)$c$)$q$);
select _try('check: the owner''s log has it, by the Manager', 'ok', $q$select _is($c$exists(select 1 from decision_log where task='invoice.make' and by='00000000-0000-0000-0000-00000000000b' and by_name='Ruth Nakato' and role='manager' and amount=95000)$c$)$q$);
select _try('manager: invoice it twice', 'refused', $q$select invoice_order('11111111-1111-1111-1111-111111111111', 8001)$q$);
select _try('manager: invoice an order of another shop', 'refused', $q$select invoice_order('22222222-2222-2222-2222-222222222222', 8004)$q$);

-- ================= the 24-hour run =================
reset role;
set request.jwt.claim.sub = '';
select _try('the 24-hour run', 'ok', $q$select _is($c$(select (r->>'invoiced')::int=1 and jsonb_array_length(r->'skipped')=1 and r->'skipped'->0->>'code'='OWSHP' from (select ow_invoice_due_orders() r) x)$c$)$q$);
select _try('check: delivered 30 hours ago is invoiced, 2 hours ago is not', 'ok', $q$select _is($c$(select invoiced and payload->'invoicedBy'->>'via'='auto' from saved_quotes where id=8005) and not (select invoiced from saved_quotes where id=8006) and not (select invoiced from saved_quotes where id=8002)$c$)$q$);
select _try('check: the run is in the owner''s log, by nobody''s login', 'ok', $q$select _is($c$exists(select 1 from decision_log where role='auto' and by is null and what like 'Invoiced INV-8005%')$c$)$q$);

-- ================= a stale copy cannot take an invoice back =================
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select _try('owner: save a copy from before the run (not invoiced)', 'ok', $q$update saved_quotes set invoiced=false, invoiced_at=null, payload = payload - 'invoicedBy' - 'debtCharged' where id=8005$q$);
select _try('check: the invoice stands', 'ok', $q$select _is($c$(select invoiced and invoiced_at is not null and payload ? 'invoicedBy' and payload ? 'debtCharged' from saved_quotes where id=8005)$c$)$q$);
select _try('owner: take it back knowingly (the copy saw the invoice)', 'ok', $q$update saved_quotes set invoiced=false, invoiced_at=null where id=8005$q$);
select _try('check: taken back', 'ok', $q$select _is($c$not (select invoiced from saved_quotes where id=8005)$c$)$q$);

reset role;
select case when (expect='ok' and got='ok') or (expect='refused' and got like 'refused%') then 'PASS' else 'FAIL' end, label, got from _r order by n;
