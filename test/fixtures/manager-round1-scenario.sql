-- 0169 asked of a real database (Manager round 1, data and money integrity):
-- the money and the stock hold together whoever writes — the Manager, Sales,
-- Accounts, the Store and the owner's console.
grant all on all tables in schema public to authenticated;
grant all on all sequences in schema public to authenticated;
insert into auth.users values
 ('00000000-0000-0000-0000-00000000000a','owner@x'),('00000000-0000-0000-0000-00000000000b','manager@x'),
 ('00000000-0000-0000-0000-00000000000d','sales@x'),('00000000-0000-0000-0000-00000000000f','accounts@x'),
 ('00000000-0000-0000-0000-00000000000e','store@x');
insert into shops(id, name, created_by) values ('11111111-1111-1111-1111-111111111111','Omni-ware (old records)','00000000-0000-0000-0000-00000000000a');
insert into shop_members(shop_id,user_id,role) values
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000a','owner'),
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000b','manager'),
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000d','sales'),
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000f','accounts'),
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000e','store');
insert into staff(shop_id,id,name,role,user_id) values
 ('11111111-1111-1111-1111-111111111111','W1','Ruth Nakato','manager','00000000-0000-0000-0000-00000000000b'),
 ('11111111-1111-1111-1111-111111111111','W2','Daphine','sales','00000000-0000-0000-0000-00000000000d'),
 ('11111111-1111-1111-1111-111111111111','W3','Esther','accounts','00000000-0000-0000-0000-00000000000f');
insert into app_settings(shop_id, presets) values ('11111111-1111-1111-1111-111111111111','{}')
 on conflict (shop_id) do update set presets = excluded.presets;
insert into products(shop_id,id,name) values ('11111111-1111-1111-1111-111111111111','P1','Cement'),('11111111-1111-1111-1111-111111111111','P2','Iron sheet'),('11111111-1111-1111-1111-111111111111','P3','Nails');
insert into products(shop_id,id,name,stock_retail_markup_type,stock_retail_markup_value,stock_wholesale_markup_type,stock_wholesale_markup_value,retail_markup_type,retail_markup_value,wholesale_markup_type,wholesale_markup_value)
 values ('11111111-1111-1111-1111-111111111111','P4','Nails box','percent',20,'percent',20,'percent',20,'percent',20);

-- The seed is written as it stands on live, old faults and all (the checks are off while it goes in).
set session_replication_role = replica;
insert into customers(shop_id,id,name,phone,debt) values
 ('11111111-1111-1111-1111-111111111111','C1','Ken','0772000001',500000),
 ('11111111-1111-1111-1111-111111111111','C2','Sadat','0772000002',290000),
 ('11111111-1111-1111-1111-111111111111','C3','Muyanja','0772000003',200000),
 ('11111111-1111-1111-1111-111111111111','C4','Esther','0772000004',0),
 ('11111111-1111-1111-1111-111111111111','C5','Esther',null,100000),
 ('11111111-1111-1111-1111-111111111111','C7','Adinan','0772000007',0),
 ('11111111-1111-1111-1111-111111111111','C8','Kampala Builders','0772000008',0);
insert into customer_debt_log(id, shop_id, customer_id, date, type, amount, note, quote_id) values
 (1,'11111111-1111-1111-1111-111111111111','C1','2026-10-01','charge',500000,'Auto-sync — INV-0200',200),
 (2,'11111111-1111-1111-1111-111111111111','C2','2026-01-01','charge',290000,'Opening balance',null),
 (3,'11111111-1111-1111-1111-111111111111','C3','2026-10-01','charge',200000,'Auto-sync — INV-0201',201),
 (4,'11111111-1111-1111-1111-111111111111','C5','2026-10-02','charge',100000,'Auto-sync — INV-0203',203);
insert into payment_promises(shop_id, id, customer_id, promised_on, made_on, amount) values
 ('11111111-1111-1111-1111-111111111111',1,'C5','2026-11-01','2026-10-20',100000);
insert into saved_quotes(id, shop_id, client_name, date, status, invoiced, invoiced_at, amount_paid, qa, payload) overriding system value values
 (200,'11111111-1111-1111-1111-111111111111','Ken','2026-10-01','completed',true,'2026-10-01',0,false,'{"customerId":"C1","debtCharged":500000,"items":[{"lineId":1,"productName":"Iron sheet","qty":1,"price":400000,"sellPrice":500000,"supplierId":"__stock__"}],"payments":[]}'),
 (201,'11111111-1111-1111-1111-111111111111','Muyanja','2026-10-01','completed',true,'2026-10-01',100000,false,'{"customerId":"C3","debtCharged":200000,"items":[{"lineId":1,"productName":"Tiles","qty":1,"price":250000,"sellPrice":300000,"supplierId":"__stock__"}],"payments":[{"id":1,"date":"2026-10-01","amount":100000,"cashTxnId":9201,"method":"cash"}]}'),
 (202,'11111111-1111-1111-1111-111111111111','Adinan','2026-10-10','preparing',false,null,50000,false,'{"customerId":"C7","items":[{"lineId":1,"productName":"Paint","qty":1,"price":40000,"sellPrice":50000,"supplierId":"__stock__"}],"payments":[{"id":1,"date":"2026-10-10","amount":50000,"cashTxnId":9202,"method":"cash"}]}'),
 (203,'11111111-1111-1111-1111-111111111111','Esther','2026-10-02','completed',true,'2026-10-02',0,false,'{"customerId":"C5","debtCharged":100000,"items":[{"lineId":1,"productName":"Wire","qty":1,"price":80000,"sellPrice":100000,"supplierId":"__stock__"}],"payments":[]}'),
 (204,'11111111-1111-1111-1111-111111111111','Ken','2026-10-20','completed',false,null,0,false,'{"customerId":"C1","deliveredAt":"2026-10-20T08:00:00Z","items":[{"lineId":1,"productName":"Nails","qty":1,"price":400,"sellPrice":567,"supplierId":"__stock__"}],"payments":[]}'),
 (205,'11111111-1111-1111-1111-111111111111','Ken','2026-10-20','completed',false,null,0,false,'{"customerId":"C1","deliveredAt":"2026-10-20T08:00:00Z","items":[{"lineId":1,"productId":"P1","productName":"Cement","qty":1,"price":30000,"sellPrice":35000,"supplierId":"__stock__","unit":"bag"}],"payments":[]}'),
 (206,'11111111-1111-1111-1111-111111111111','Ken','2026-10-21','completed',false,null,0,false,'{"customerId":"C1","items":[{"lineId":1,"productId":"P4","productName":"Nails","qty":2,"price":3000,"sellPrice":0,"supplierId":"__stock__"},{"lineId":2,"productName":"Wire","qty":1,"price":8000,"sellPrice":10000,"supplierId":"__stock__"}],"payments":[]}'),
 (207,'11111111-1111-1111-1111-111111111111','Ken','2026-09-20','completed',true,'2026-09-20',50000,false,'{"customerId":"C1","debtCharged":0,"items":[{"lineId":1,"productName":"Paint","qty":1,"price":40000,"sellPrice":50000,"supplierId":"__stock__"}],"payments":[{"id":1,"date":"2026-09-20","amount":50000,"cashTxnId":9303,"method":"cash"}]}'),
 (208,'11111111-1111-1111-1111-111111111111','TEST Claude QA','2026-10-12','preparing',false,null,20000,true,'{"items":[{"lineId":1,"productName":"Paint","qty":1,"price":15000,"sellPrice":20000,"supplierId":"__stock__"}],"payments":[{"id":1,"date":"2026-10-12","amount":20000,"cashTxnId":9208,"method":"cash"}]}'),
 (209,'11111111-1111-1111-1111-111111111111','Walk-in','2026-10-12','preparing',false,null,20000,false,'{"items":[{"lineId":1,"productName":"Paint","qty":1,"price":15000,"sellPrice":20000,"supplierId":"__stock__"}],"payments":[{"id":1,"date":"2026-10-12","amount":20000,"cashTxnId":9209,"method":"cash"}]}'),
 (210,'11111111-1111-1111-1111-111111111111','Kampala Builders','2026-09-15','completed',true,'2026-09-15',1200000,false,'{"customerId":"C8","takenBy":"00000000-0000-0000-0000-00000000000d","debtCharged":0,"items":[{"lineId":1,"productName":"Iron sheet","qty":3,"price":350000,"sellPrice":400000,"supplierId":"__stock__"}],"payments":[{"id":1,"date":"2026-09-15","amount":1200000,"cashTxnId":9210,"method":"bank"}]}'),
 (211,'11111111-1111-1111-1111-111111111111','Kampala Builders','2026-10-05','preparing',false,null,0,false,'{"customerId":"C8","items":[{"lineId":1,"productName":"Paint","qty":10,"price":40000,"sellPrice":50000,"supplierId":"__stock__"}],"payments":[]}');
insert into cash_txns(id, shop_id, date, account, type, category, amount, description, quote_id) values
 (9201,'11111111-1111-1111-1111-111111111111','2026-10-01','cash','receipt','Invoice Payment',100000,'Payment — INV-0201',201),
 (9202,'11111111-1111-1111-1111-111111111111','2026-10-10','cash','receipt','Invoice Payment',50000,'Payment — order #0202',202),
 (9208,'11111111-1111-1111-1111-111111111111','2026-10-12','cash','receipt','Invoice Payment',20000,'Payment — order #0208',208),
 (9209,'11111111-1111-1111-1111-111111111111','2026-10-12','cash','receipt','Invoice Payment',20000,'Payment — order #0209',209),
 (9210,'11111111-1111-1111-1111-111111111111','2026-09-15','bank','receipt','Invoice Payment',1200000,'Payment — INV-0210',210),
 (9300,'11111111-1111-1111-1111-111111111111','2026-09-22','momo','receipt','Debt Payment',500000,'Debt Payment',null),
 (9302,'11111111-1111-1111-1111-111111111111','2026-10-15','momo','receipt','Debt Payment',100000,'Payment — INV-0200',200),
 (9303,'11111111-1111-1111-1111-111111111111','2026-09-20','cash','receipt','Debt Payment',50000,'Payment — INV-0200',200),
 (9400,'11111111-1111-1111-1111-111111111111','2026-09-30','cash','payment','Salaries & Wages',386666.67,'Wages — September',null);
-- Stock: P1 in step (10 = 6 + 4); P2 apart, as on live (5 on the shelf, 11 in its lots); P3 short of lots (3, none).
insert into stock(shop_id,key,product_id,qty) values
 ('11111111-1111-1111-1111-111111111111','P1','P1',10),('11111111-1111-1111-1111-111111111111','P2','P2',5),('11111111-1111-1111-1111-111111111111','P3','P3',3);
insert into stock_lots(shop_id,key,qty,cost) values
 ('11111111-1111-1111-1111-111111111111','P1',6,30000),('11111111-1111-1111-1111-111111111111','P1',4,32000),
 ('11111111-1111-1111-1111-111111111111','P2',5,40000),('11111111-1111-1111-1111-111111111111','P2',4,41000),('11111111-1111-1111-1111-111111111111','P2',2,42000);
insert into stock_log(id, shop_id, key, product_id, label, type, delta, qty_after, note, date, at, cost) values
 (1,'11111111-1111-1111-1111-111111111111','P3','P3','Nails','restock',3,3,'','2026-09-01',now(),2500);
insert into manager_notes(shop_id, kind, date, status, body) values
 ('11111111-1111-1111-1111-111111111111','target','2026-09-01','open','{"who":"00000000-0000-0000-0000-00000000000d","metric":"sales","aim":1000000,"from":"2026-09-01","to":"2026-09-30"}'),
 ('11111111-1111-1111-1111-111111111111','target','2026-09-01','open','{"who":"00000000-0000-0000-0000-00000000000d","metric":"sales","aim":5000000,"from":"2026-09-01","to":"2026-09-30","note":"missed"}'),
 ('11111111-1111-1111-1111-111111111111','target','2026-10-01','open','{"who":"00000000-0000-0000-0000-00000000000d","metric":"sales","aim":1000000,"from":"2026-10-01","to":"2099-12-31"}');
insert into stock_counts(id, shop_id, counted_by, counted_by_name, lines) values
 ('cccccccc-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000e','Store',
  '[{"key":"P1","productId":"P1","name":"Cement","counted":7,"system":6,"held":0}]');
set session_replication_role = origin;

create table _r(n serial, label text, expect text, got text);
create function _try(label text, expect text, q text) returns void language plpgsql as $$
declare got text := 'ok';
begin
  declare n int; begin execute q; get diagnostics n = row_count;
    if n = 0 and (q ilike 'update%' or q ilike 'delete%') then got := 'refused: 0 rows (row-level security hid them)'; end if;
  exception when others then got := 'refused: ' || sqlstate || ' ' || sqlerrm; end;
  insert into _r(label, expect, got) values (label, expect, got);
end $$;
grant all on _r, _r_n_seq to authenticated; grant execute on function _try to authenticated;
create function _is(cond_sql text) returns void language plpgsql security definer as $$
declare ok boolean;
begin execute 'select (' || cond_sql || ')' into ok;
  if not coalesce(ok, false) then raise exception 'not so: %', cond_sql; end if; end $$;
grant execute on function _is to authenticated;
-- A console-style save: the stock alone, judged at once (as it would be at commit).
create function _stock_alone(p_key text, p_qty numeric) returns void language plpgsql as $$
begin
  update stock set qty = p_qty where shop_id = '11111111-1111-1111-1111-111111111111' and key = p_key;
  set constraints all immediate;
end $$;
create function _lots_alone(p_key text) returns void language plpgsql as $$
begin
  delete from stock_lots where shop_id = '11111111-1111-1111-1111-111111111111' and key = p_key and id = (select min(id) from stock_lots where shop_id = '11111111-1111-1111-1111-111111111111' and key = p_key);
  set constraints all immediate;
end $$;
-- A server move on a key, judged at once.
create function _move(p_key text, p_delta numeric) returns void language plpgsql security definer as $$
begin
  perform ow_stock_move('11111111-1111-1111-1111-111111111111', p_key, null, p_key, p_delta, 'sale', 'test', null, null);
  set constraints all immediate;
end $$;
grant execute on function _stock_alone, _lots_alone, _move to authenticated;

-- ---------------- MGR-DATA-02: the balance from the books
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select _try('manager: Sadat''s balance is his 290,000 opening balance', 'ok', $q$select _is($c$ow_customer_balance('11111111-1111-1111-1111-111111111111','C2') = 290000$c$)$q$);
select _try('manager: Ken''s balance is his open bill, 500,000', 'ok', $q$select _is($c$ow_customer_balance('11111111-1111-1111-1111-111111111111','C1') = 500000$c$)$q$);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000d';
select _try('sales: reads the same 500,000 for Ken', 'ok', $q$select _is($c$ow_customer_balance('11111111-1111-1111-1111-111111111111','C1') = 500000$c$)$q$);

-- ---------------- MGR-DATA-01: a payment and its receipt
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select _try('manager: a cash payment naming a momo receipt is refused', 'refused:OWPAY', $q$update saved_quotes set amount_paid = 100000, payload = payload || '{"payments":[{"id":1,"date":"2026-10-15","amount":100000,"cashTxnId":9302,"method":"cash"}]}' where id=200$q$);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000f';
select _try('accounts: a payment naming a receipt that #0207 already names is refused', 'refused:OWPAY', $q$update saved_quotes set amount_paid = 50000, payload = payload || '{"payments":[{"id":1,"date":"2026-09-20","amount":50000,"cashTxnId":9303,"method":"cash"}]}' where id=200$q$);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select _try('owner: the same receipt named twice on one order is refused', 'refused:OWPAY', $q$update saved_quotes set amount_paid = 200000, payload = payload || '{"payments":[{"id":1,"date":"2026-10-15","amount":100000,"cashTxnId":9302,"method":"momo"},{"id":2,"date":"2026-10-15","amount":100000,"cashTxnId":9302,"method":"momo"}]}' where id=200$q$);
select _try('owner: the momo payment naming its own momo receipt is kept', 'ok', $q$update saved_quotes set amount_paid = 100000, payload = payload || '{"payments":[{"id":1,"date":"2026-10-15","amount":100000,"cashTxnId":9302,"method":"momo"}]}' where id=200$q$);
select _try('check: Ken now owes 400,000, in the books and from the bills', 'ok', $q$select _is($c$(select debt from customers where id='C1') = 400000 and ow_customer_balance('11111111-1111-1111-1111-111111111111','C1') = 400000$c$)$q$);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000d';
select _try('sales: a payment dated tomorrow is refused', 'refused:22023', $q$select receive_payment('11111111-1111-1111-1111-111111111111','C1',100000,'cash',null,null,null,null,ow_today() + 1)$q$);
select _try('sales: 100,000 from Ken, paid yesterday', 'ok', $q$select receive_payment('11111111-1111-1111-1111-111111111111','C1',100000,'cash',null,null,null,null,ow_today() - 1)$q$);
select _try('check: the receipt, the payment and the balance''s log line all say yesterday', 'ok', $q$select _is($c$exists(select 1 from cash_txns where quote_id=200 and amount=100000 and account='cash' and date=ow_today()-1) and exists(select 1 from saved_quotes, jsonb_array_elements(payload->'payments') p where id=200 and p->>'date' = (ow_today()-1)::text and p->>'method'='cash') and exists(select 1 from customer_debt_log where quote_id=200 and type='payment' and amount=100000 and date=ow_today()-1)$c$)$q$);
select _try('sales: a payment before the order, labelled Deposit', 'ok', $q$select receive_payment('11111111-1111-1111-1111-111111111111',null,20000,'momo',null,211,'TX991',null,null,'Deposit')$q$);
select _try('check: the payment is labelled Deposit (label and note)', 'ok', $q$select _is($c$exists(select 1 from saved_quotes, jsonb_array_elements(payload->'payments') p where id=211 and p->>'label'='Deposit' and p->>'note'='Deposit')$c$)$q$);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000e';
select _try('store: may not take a payment', 'refused:42501', $q$select receive_payment('11111111-1111-1111-1111-111111111111','C1',1000,'cash')$q$);
reset role;
select _try('check: one receive_payment, with p_date and p_label', 'ok', $q$select _is($c$(select count(*) from pg_proc where proname='receive_payment') = 1 and (select pg_get_function_identity_arguments(oid) from pg_proc where proname='receive_payment') like '%p_date date, p_label text'$c$)$q$);

-- ---------------- MGR-DATA-07: a void never keeps the money
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select _try('manager: a plain void of #0201 (100,000 paid) is refused', 'refused:OWVMN', $q$update saved_quotes set voided = true where id=201$q$);
select _try('manager: void_sale_bills on #0201 is refused too', 'refused:OWVMN', $q$select void_sale_bills('11111111-1111-1111-1111-111111111111',201)$q$);
select _try('manager: void_with_money with no choice is refused', 'refused:OWVMN', $q$select void_with_money('11111111-1111-1111-1111-111111111111',201,null)$q$);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000d';
select _try('sales: may not void', 'refused:42501', $q$select void_with_money('11111111-1111-1111-1111-111111111111',201,'deposit')$q$);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000f';
select _try('accounts: may not void', 'refused:42501', $q$select void_with_money('11111111-1111-1111-1111-111111111111',201,'refund')$q$);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select _try('manager: voids #0201, the 100,000 kept as Muyanja''s deposit', 'ok', $q$select void_with_money('11111111-1111-1111-1111-111111111111',201,'deposit')$q$);
select _try('check: voided, voidMoney done, Muyanja''s balance -100,000 (a deposit), logged on no order', 'ok', $q$select _is($c$(select voided from saved_quotes where id=201) and (select payload->'voidMoney'->>'choice' from saved_quotes where id=201) = 'deposit' and (select debt from customers where id='C3') = -100000 and ow_customer_balance('11111111-1111-1111-1111-111111111111','C3') = -100000 and exists(select 1 from customer_debt_log where customer_id='C3' and quote_id is null and note='Deposit — void #0201' and amount=100000)$c$)$q$);
select _try('manager: voids #0202, the 50,000 refunded from momo', 'ok', $q$select void_with_money('11111111-1111-1111-1111-111111111111',202,'refund','momo')$q$);
select _try('check: a momo payment out of 50,000, category Refund, naming #0202', 'ok', $q$select _is($c$(select voided from saved_quotes where id=202) and exists(select 1 from cash_txns where quote_id=202 and type='payment' and category='Refund' and account='momo' and amount=50000)$c$)$q$);
select _try('check: the owner''s log has both', 'ok', $q$select _is($c$(select count(*) from decision_log where task='invoice.void' and amount in (50000,100000) and what like 'Voided #%') = 2$c$)$q$);
select _try('manager: a test order (#0208) is voided as it stands', 'ok', $q$update saved_quotes set voided = true where id=208$q$);
reset role;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
set role authenticated;
select _try('owner (console): a void is not held', 'ok', $q$update saved_quotes set voided = true where id=209$q$);

-- ---------------- MGR-DATA-09: a line at 0 is given away, with a reason
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select _try('manager: invoicing #0206 with a line at 0 and no reason is refused', 'refused:OWGIV', $q$select invoice_order('11111111-1111-1111-1111-111111111111',206)$q$);
select _try('manager: gives the nails away, with an empty reason', 'ok', $q$select ow_patch_order('11111111-1111-1111-1111-111111111111',206,'{"items":[{"lineId":1,"productId":"P4","productName":"Nails","qty":2,"price":3000,"sellPrice":0,"supplierId":"__stock__","givenAway":{"why":"","by":"00000000-0000-0000-0000-00000000000b","at":"2026-10-25T09:00:00Z"}},{"lineId":2,"productName":"Wire","qty":1,"price":8000,"sellPrice":10000,"supplierId":"__stock__"}]}')$q$);
select _try('manager: still refused with no reason', 'refused:OWGIV', $q$select invoice_order('11111111-1111-1111-1111-111111111111',206)$q$);
select _try('manager: the reason given', 'ok', $q$select ow_patch_order('11111111-1111-1111-1111-111111111111',206,'{"items":[{"lineId":1,"productId":"P4","productName":"Nails","qty":2,"price":3000,"sellPrice":0,"supplierId":"__stock__","givenAway":{"why":"Sample for the site","by":"00000000-0000-0000-0000-00000000000b","at":"2026-10-25T09:00:00Z"}},{"lineId":2,"productName":"Wire","qty":1,"price":8000,"sellPrice":10000,"supplierId":"__stock__"}]}')$q$);
select _try('manager: and now it is invoiced (10,000)', 'ok', $q$select invoice_order('11111111-1111-1111-1111-111111111111',206)$q$);
select _try('check: #0206 is invoiced for 10,000', 'ok', $q$select _is($c$(select invoiced from saved_quotes where id=206) and ow_order_total('11111111-1111-1111-1111-111111111111',(select payload from saved_quotes where id=206)) = 10000$c$)$q$);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select _try('owner: a line on an invoice changed to 0 with no reason is refused', 'refused:OWGIV', $q$update saved_quotes set payload = jsonb_set(payload, '{items,1,sellPrice}', '0') where id=206$q$);

-- ---------------- MGR-DATA-10: whole shillings
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000f';
select _try('accounts: wages of 386,666.67 written', 'ok', $q$insert into cash_txns(id,shop_id,date,account,type,category,amount,description) values (99401,'11111111-1111-1111-1111-111111111111',ow_today(),'cash','payment','Salaries & Wages',386666.67,'Wages — Grace, 29 of 30 days')$q$);
select _try('check: stored as 386,667', 'ok', $q$select _is($c$(select amount from cash_txns where id=99401) = 386667$c$)$q$);

-- ---------------- MGR-DATA-03: stock and its lots, strict
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select _try('owner (console): the stock alone, without its lots, is refused', 'refused:OWLOT', $q$select _stock_alone('P1', 8)$q$);
select _try('owner (console): the lots alone, without the stock, are refused', 'refused:OWLOT', $q$select _lots_alone('P1')$q$);
select _try('owner (console): stock 8 and lots 10 in one call is refused', 'refused:OWLOT', $q$select replace_stock_and_lots('11111111-1111-1111-1111-111111111111', array['P1'], '[{"key":"P1","qty":8}]', '[{"key":"P1","qty":6,"cost":30000},{"key":"P1","qty":4,"cost":32000}]')$q$);
select _try('owner (console): stock 8 and its lots, together', 'ok', $q$select replace_stock_and_lots('11111111-1111-1111-1111-111111111111', array['P1'], '[{"key":"P1","qty":8}]', '[{"key":"P1","qty":4,"cost":30000},{"key":"P1","qty":4,"cost":32000}]')$q$);
select _try('check: P1 is 8 with lots of 8, its product kept', 'ok', $q$select _is($c$(select qty from stock where key='P1') = 8 and (select sum(qty) from stock_lots where key='P1') = 8 and (select product_id from stock where key='P1') = 'P1'$c$)$q$);
select _try('owner (console): a key gone, with its lots', 'ok', $q$select replace_stock_and_lots('11111111-1111-1111-1111-111111111111', array['P9'], '[]', '[]')$q$);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000d';
select _try('sales: may not write stock (0083)', 'refused', $q$select replace_stock_and_lots('11111111-1111-1111-1111-111111111111', array['P1'], '[{"key":"P1","qty":80}]', '[{"key":"P1","qty":80,"cost":1}]')$q$);
reset role;
select _try('server: ow_stock_move takes 2 of P1 and its lots with it', 'ok', $q$select _move('P1', -2)$q$);
select _try('server: ow_stock_move on P2, whose lots were already apart, is refused', 'refused:OWLOT', $q$select _move('P2', -1)$q$);
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select _try('manager: accepts the Store''s count of P1 (7)', 'ok', $q$select accept_stock_count('cccccccc-0000-0000-0000-000000000001')$q$);
select _try('manager: writes off 1 of P1', 'ok', $q$select manager_stock_move('11111111-1111-1111-1111-111111111111','[{"key":"P1","productId":"P1","name":"Cement","delta":-1}]','writeoff','broken','stock.writeoff')$q$);
reset role;
select _try('check: P1 is 6 and its lots add up', 'ok', $q$select _is($c$(select qty from stock where key='P1') = 6 and (select sum(qty) from stock_lots where key='P1') = 6$c$)$q$);

-- ---------------- MGR-DATA-13: one customer, not two
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000d';
select _try('sales: may not merge customers', 'refused:42501', $q$select merge_customers('11111111-1111-1111-1111-111111111111','C4','C5')$q$);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select _try('manager: a customer into itself is refused', 'refused:22023', $q$select merge_customers('11111111-1111-1111-1111-111111111111','C4','C4')$q$);
select _try('manager: merges the second Esther into the first', 'ok', $q$select merge_customers('11111111-1111-1111-1111-111111111111','C4','C5')$q$);
reset role;
select _try('check: her bill, debt log, promise and 100,000 moved; the second is gone', 'ok', $q$select _is($c$(select payload->>'customerId' from saved_quotes where id=203) = 'C4' and (select debt from customers where id='C4') = 100000 and not exists(select 1 from customers where id='C5') and exists(select 1 from customer_debt_log where customer_id='C4' and quote_id=203) and exists(select 1 from payment_promises where customer_id='C4') and ow_customer_balance('11111111-1111-1111-1111-111111111111','C4') = 100000$c$)$q$);
select _try('check: the merge is in the owner''s log with both as they were', 'ok', $q$select _is($c$exists(select 1 from decision_log where task='customer.merge' and what like 'Merged Esther (C5) into Esther (C4)%' and before ? 'drop')$c$)$q$);

-- ---------------- MGR-DATA-14: targets end on their day
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select _try('manager: ends the targets past their day', 'ok', $q$select ow_end_targets('11111111-1111-1111-1111-111111111111')$q$);
reset role;
select _try('check: September''s 1,000,000 target ended, reached at 1,200,000', 'ok', $q$select _is($c$exists(select 1 from manager_notes where kind='target' and status='ended' and (body->>'aim')::numeric = 1000000 and (body->'result'->>'actual')::numeric = 1200000 and body->'result'->>'reached' = 'true')$c$)$q$);
select _try('check: the 5,000,000 one ended, missed; the open one stays open', 'ok', $q$select _is($c$exists(select 1 from manager_notes where kind='target' and status='ended' and (body->>'aim')::numeric = 5000000 and body->'result'->>'reached' = 'false') and exists(select 1 from manager_notes where kind='target' and status='open' and body->>'to' = '2099-12-31')$c$)$q$);
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000e';
select _try('store: may call it on load too (nothing left to end)', 'ok', $q$select _is($c$jsonb_array_length(ow_end_targets('11111111-1111-1111-1111-111111111111')->'ended') = 0$c$)$q$);

-- ---------------- MGR-DATA-15: the hourly run leaves a 567 bill to the Manager
reset role;
set request.jwt.claim.sub = '';
select _try('the hourly run', 'ok', $q$select ow_invoice_due_orders()$q$);
select _try('check: #0204 (567) is not invoiced, #0205 (35,000) is', 'ok', $q$select _is($c$not (select invoiced from saved_quotes where id=204) and (select invoiced from saved_quotes where id=205)$c$)$q$);
select _try('check: the Manager is told why #0204 waits', 'ok', $q$select _is($c$exists(select 1 from push_outbox where kind='invoice.held' and body like '%Only 567%')$c$)$q$);
select _try('check: the invoice took P1 off the shelf with its lots (5 = 5)', 'ok', $q$select _is($c$(select qty from stock where key='P1') = 5 and (select sum(qty) from stock_lots where key='P1') = 5$c$)$q$);

select case when (expect = 'ok' and got = 'ok') or (expect = 'refused' and got like 'refused%')
              or (expect like 'refused:%' and got like 'refused: ' || substr(expect, 9) || '%') then 'PASS' else 'FAIL' end, label, got from _r order by n;
