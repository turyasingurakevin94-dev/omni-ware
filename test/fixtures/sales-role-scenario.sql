-- What a Sales login may and may not write, asked of a real database.
-- Each row: what is tried, as whom, and whether it must go through or be
-- refused. 'refused' also covers row-level security quietly matching no
-- rows on an update or delete -- the database's way of saying no there.
grant all on all tables in schema public to authenticated;
grant all on all sequences in schema public to authenticated;
grant execute on all functions in schema public to authenticated;
insert into auth.users values ('00000000-0000-0000-0000-00000000000a','owner@x'),('00000000-0000-0000-0000-00000000000b','sales@x'),('00000000-0000-0000-0000-00000000000c','worker@x');
insert into shops(id, name, created_by) values ('11111111-1111-1111-1111-111111111111','Test shop','00000000-0000-0000-0000-00000000000a');
insert into shop_members(shop_id,user_id,role) values
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000a','owner'),
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000b','sales'),
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000c','staff');
insert into customers(shop_id,id,name,debt,credit_limit,terms_days) values ('11111111-1111-1111-1111-111111111111','C001','Kato',500000,1000000,30);
insert into saved_quotes(id, shop_id, client_name, status, invoiced, payload) overriding system value values (9001,'11111111-1111-1111-1111-111111111111','Kato','completed',true,'{}'),(9002,'11111111-1111-1111-1111-111111111111','Kato','draft',false,'{}');
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

-- ---- as SALES
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select _try('sales: new customer, no debt, no terms', 'ok', $q$insert into customers(shop_id,id,name) values ('11111111-1111-1111-1111-111111111111','C002','Mukasa')$q$);
select _try('sales: new customer WITH a debt', 'refused', $q$insert into customers(shop_id,id,name,debt) values ('11111111-1111-1111-1111-111111111111','C003','X',100)$q$);
select _try('sales: new customer WITH terms', 'refused', $q$insert into customers(shop_id,id,name,terms_days) values ('11111111-1111-1111-1111-111111111111','C004','Y',30)$q$);
select _try('sales: edit a customer''s phone (upsert, like the app)', 'ok', $q$insert into customers(shop_id,id,name,phone,debt,credit_limit,terms_days) values ('11111111-1111-1111-1111-111111111111','C001','Kato','0772',500000,1000000,30) on conflict (shop_id,id) do update set phone=excluded.phone, debt=excluded.debt, credit_limit=excluded.credit_limit, terms_days=excluded.terms_days$q$);
select _try('sales: lower a debt (payment, upsert)', 'ok', $q$insert into customers(shop_id,id,name,debt,credit_limit,terms_days) values ('11111111-1111-1111-1111-111111111111','C001','Kato',400000,1000000,30) on conflict (shop_id,id) do update set debt=excluded.debt$q$);
select _try('sales: RAISE a debt', 'refused', $q$update customers set debt = 900000 where id='C001'$q$);
select _try('sales: change a credit limit', 'refused', $q$update customers set credit_limit = 5000000 where id='C001'$q$);
select _try('sales: change terms', 'refused', $q$update customers set terms_days = 60 where id='C001'$q$);
select _try('sales: delete a customer', 'refused', $q$delete from customers where id='C002'$q$);
select _try('sales: payment line in debt log', 'ok', $q$insert into customer_debt_log(shop_id,customer_id,date,type,amount) values ('11111111-1111-1111-1111-111111111111','C001',current_date,'payment',100000)$q$);
select _try('sales: CHARGE line in debt log', 'refused', $q$insert into customer_debt_log(shop_id,customer_id,date,type,amount) values ('11111111-1111-1111-1111-111111111111','C001',current_date,'charge',100000)$q$);
select _try('sales: customer payment receipt', 'ok', $q$insert into cash_txns(shop_id,date,account,type,category,amount) values ('11111111-1111-1111-1111-111111111111',current_date,'cash','receipt','Debt Payment',100000)$q$);
select _try('sales: invoice payment receipt (mobile money)', 'ok', $q$insert into cash_txns(shop_id,date,account,type,category,amount) values ('11111111-1111-1111-1111-111111111111',current_date,'momo','receipt','Invoice Payment',50000)$q$);
select _try('sales: a cash-out', 'refused', $q$insert into cash_txns(shop_id,date,account,type,category,amount) values ('11111111-1111-1111-1111-111111111111',current_date,'cash','payment','Transport',20000)$q$);
select _try('sales: a sales-revenue receipt (till)', 'refused', $q$insert into cash_txns(shop_id,date,account,type,category,amount) values ('11111111-1111-1111-1111-111111111111',current_date,'cash','receipt','Sales Revenue',20000)$q$);
select _try('sales: a loan received', 'refused', $q$insert into cash_txns(shop_id,date,account,type,category,amount) values ('11111111-1111-1111-1111-111111111111',current_date,'cash','receipt','Loan Received',20000)$q$);
select _try('sales: edit an existing cash row', 'refused', $q$update cash_txns set amount = 1 where shop_id='11111111-1111-1111-1111-111111111111'$q$);
select _try('sales: new quote', 'ok', $q$insert into saved_quotes(shop_id,client_name,status,payload) values ('11111111-1111-1111-1111-111111111111','Mukasa','draft','{}')$q$);
select _try('sales: move an order along (upsert)', 'ok', $q$insert into saved_quotes(id,shop_id,client_name,status,invoiced,payload) overriding system value values (9002,'11111111-1111-1111-1111-111111111111','Kato','preparing',false,'{}') on conflict (id) do update set status=excluded.status, invoiced=excluded.invoiced$q$);
select _try('sales: record a payment on an INVOICED order (upsert)', 'ok', $q$insert into saved_quotes(id,shop_id,client_name,status,invoiced,amount_paid,payload) overriding system value values (9001,'11111111-1111-1111-1111-111111111111','Kato','completed',true,100000,'{}') on conflict (id) do update set amount_paid=excluded.amount_paid, invoiced=excluded.invoiced$q$);
select _try('sales: INVOICE an order', 'refused', $q$update saved_quotes set invoiced = true where id = 9002$q$);
select _try('sales: un-invoice an order', 'refused', $q$update saved_quotes set invoiced = false where id = 9001$q$);
select _try('sales: VOID an order', 'refused', $q$update saved_quotes set voided = true where id = 9001$q$);
select _try('sales: insert an already-invoiced order', 'refused', $q$insert into saved_quotes(shop_id,client_name,status,invoiced,payload) values ('11111111-1111-1111-1111-111111111111','Z','completed',true,'{}')$q$);
select _try('sales: new map pin (owner only)', 'refused', $q$insert into places(shop_id,name) values ('11111111-1111-1111-1111-111111111111','Kira')$q$);
select _try('sales: statement sent record', 'ok', $q$insert into statements_sent(shop_id, id, customer_id, sent_on) values ('11111111-1111-1111-1111-111111111111', 1, 'C001', current_date)$q$);
select _try('sales: change a price', 'refused', $q$insert into prices(shop_id,product_id,supplier_id) values ('11111111-1111-1111-1111-111111111111','P1','S1')$q$);
select _try('sales: touch stock', 'refused', $q$insert into stock(shop_id,key,product_id,qty) values ('11111111-1111-1111-1111-111111111111','k','P1',5)$q$);
select _try('sales: add a supplier', 'refused', $q$insert into suppliers(shop_id,id,name) values ('11111111-1111-1111-1111-111111111111','S1','Katwe')$q$);
select _try('sales: raise own role to owner', 'refused', $q$update shop_members set role='owner' where user_id='00000000-0000-0000-0000-00000000000b'$q$);
select _try('sales: add role_tasks rows', 'refused', $q$insert into role_tasks values ('sales','price.set')$q$);
select _try('sales: has_task(customer.edit)', 'ok', $q$do $d$ begin if not has_task('11111111-1111-1111-1111-111111111111','customer.edit') then raise exception 'no'; end if; end $d$$q$);
select _try('sales: has_task(price.set) is false', 'ok', $q$do $d$ begin if has_task('11111111-1111-1111-1111-111111111111','price.set') then raise exception 'yes'; end if; end $d$$q$);

-- ---- as WORKER (staff): unchanged from before
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
select _try('worker: add a customer (was refused before 0113 too)', 'refused', $q$insert into customers(shop_id,id,name) values ('11111111-1111-1111-1111-111111111111','C010','W')$q$);
select _try('worker: payment receipt (was refused before too)', 'refused', $q$insert into cash_txns(shop_id,date,account,type,category,amount) values ('11111111-1111-1111-1111-111111111111',current_date,'cash','receipt','Debt Payment',100)$q$);
select _try('worker: move an order (worker app)', 'ok', $q$update saved_quotes set status='preparing' where id = 9002$q$);

-- ---- as OWNER: everything as before
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select _try('owner: invoice an order', 'ok', $q$update saved_quotes set invoiced = true where id = 9002$q$);
select _try('owner: raise a debt, set terms', 'ok', $q$update customers set debt = 900000, terms_days = 60, credit_limit = 2000000 where id='C001'$q$);
select _try('owner: a cash-out', 'ok', $q$insert into cash_txns(shop_id,date,account,type,category,amount) values ('11111111-1111-1111-1111-111111111111',current_date,'cash','payment','Transport',20000)$q$);
select _try('owner: charge line', 'ok', $q$insert into customer_debt_log(shop_id,customer_id,date,type,amount) values ('11111111-1111-1111-1111-111111111111','C001',current_date,'charge',100000)$q$);
select _try('owner: delete a customer', 'ok', $q$delete from customers where id='C002'$q$);

reset role;
select case when (expect='ok' and got='ok') or (expect='refused' and got like 'refused%') then 'PASS' else 'FAIL' end, label, got from _r order by n;
