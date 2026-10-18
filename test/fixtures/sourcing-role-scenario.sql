-- What a Sourcing login (0126) may and may not write, asked of a real database.
-- Each row: what is tried, as whom, and whether it must go through or be
-- refused. 'refused' also covers row-level security quietly matching no
-- rows on an update or delete -- the database's way of saying no there.
--
-- The 'sourcing' role itself comes from the shared foundation (0119). Until
-- that migration is here, the role check is widened below exactly as 0119
-- will widen it, so the tasks 0126 grants can be asked about.
alter table shop_members drop constraint if exists shop_members_role_check;
alter table shop_members add constraint shop_members_role_check
  check (role in ('owner', 'admin', 'staff', 'sales', 'manager', 'buyer', 'store', 'accounts', 'sourcing'));
grant all on all tables in schema public to authenticated;
grant all on all sequences in schema public to authenticated;
grant execute on all functions in schema public to authenticated;
insert into auth.users values ('00000000-0000-0000-0000-00000000000a','owner@x'),('00000000-0000-0000-0000-00000000000d','sourcing@x'),('00000000-0000-0000-0000-00000000000c','worker@x');
insert into shops(id, name, created_by) values ('11111111-1111-1111-1111-111111111111','Mukasa Hardware','00000000-0000-0000-0000-00000000000a');
insert into shop_members(shop_id,user_id,role) values
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000a','owner'),
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000d','sourcing'),
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000c','staff');
insert into customers(shop_id,id,name) values ('11111111-1111-1111-1111-111111111111','C001','Kato Construction');
insert into suppliers(shop_id,id,name) values ('11111111-1111-1111-1111-111111111111','S001','Namanve Sheets');
insert into products(shop_id,id,name,type,wholesale_markup_type,wholesale_markup_value,retail_markup_type,retail_markup_value,variants)
  values ('11111111-1111-1111-1111-111111111111','P001','Ridge cap G28','simple','percent',20,'percent',30,'[]');
insert into agents(shop_id,id,name) values ('11111111-1111-1111-1111-111111111111','A01','Aisha Namutebi');
insert into agent_requests(shop_id,agent_id,kind,words,qty,client_name) values ('11111111-1111-1111-1111-111111111111','A01','stock','Door closer medium',4,'Kato');
insert into agent_requests(shop_id,agent_id,kind,words,product_id) values ('11111111-1111-1111-1111-111111111111','A01','name','mabati','P001');
-- An order with one line dropped as nobody-has-it and one the client refused.
insert into saved_quotes(id, shop_id, client_name, client_phone, status, payload) overriding system value values
 (9101,'11111111-1111-1111-1111-111111111111','Nansana Hardware','0772000111','draft',
  '{"customerId":"C001","droppedLines":[{"productId":"P001","productName":"Valley flashing 3m","qty":6,"unit":"pc","sellPrice":17000,"at":2,"reason":"Nobody has it","droppedAt":1760000000000},{"productId":"P001","productName":"Gutter bracket","qty":3,"at":3,"reason":"Client said no","droppedAt":1760000000000}]}');
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

-- ---- what the database did by itself
select _try('dropped "Nobody has it" became a request', 'ok', $q$do $d$ begin if not exists (select 1 from sourcing_leads where id = 'DRP-9101-2-P001' and status = 'asked' and requests->0->>'source' = 'dropped' and requests->0->>'customerName' = 'Nansana Hardware' and (requests->0->>'orderId')::bigint = 9101) then raise exception 'no request'; end if; end $d$$q$);
select _try('"Client said no" did not', 'ok', $q$do $d$ begin if exists (select 1 from sourcing_leads where id = 'DRP-9101-3-P001') then raise exception 'made one'; end if; end $d$$q$);

-- ---- as SOURCING
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000d';
select _try('sourcing: has_task(sourcing.lead)', 'ok', $q$do $d$ begin if not has_task('11111111-1111-1111-1111-111111111111','sourcing.lead') then raise exception 'no'; end if; end $d$$q$);
select _try('sourcing: has_task(markup.set) is false', 'ok', $q$do $d$ begin if has_task('11111111-1111-1111-1111-111111111111','markup.set') then raise exception 'yes'; end if; end $d$$q$);
select _try('sourcing: a new request', 'ok', $q$insert into sourcing_leads(id,shop_id,name,requests) values ('SRC-T1','11111111-1111-1111-1111-111111111111','Door closer · medium','[{"source":"agent","customerName":"Kato"}]')$q$);
select _try('sourcing: move a request to looking', 'ok', $q$update sourcing_leads set status='looking' where id='SRC-T1'$q$);
select _try('sourcing: move the dropped line''s request', 'ok', $q$update sourcing_leads set status='looking' where id='DRP-9101-2-P001'$q$);
select _try('sourcing: put the asker on follow-ups', 'ok', $q$insert into follow_ups(shop_id,id,customer_id,lead_id) values ('11111111-1111-1111-1111-111111111111',1,'C001','SRC-T1')$q$);
select _try('sourcing: record that they were told', 'ok', $q$update follow_ups set payload = '{"contacts":[{"at":"2026-10-17"}]}' where id = 1$q$);
select _try('sourcing: add a supplier', 'ok', $q$insert into suppliers(shop_id,id,name,phone) values ('11111111-1111-1111-1111-111111111111','S002','Bwaise Colour Roofing','0772')$q$);
select _try('sourcing: edit a supplier', 'ok', $q$update suppliers set phone='0701' where id='S001'$q$);
select _try('sourcing: a supplier price row', 'ok', $q$insert into prices(shop_id,product_id,supplier_id,wholesale,date,price_source) values ('11111111-1111-1111-1111-111111111111','P001','S002',11500,current_date,'manual')$q$);
select _try('sourcing: confirm a price (still right)', 'ok', $q$update prices set date=current_date, price_source='confirmed' where supplier_id='S002'$q$);
select _try('sourcing: a rival''s price', 'ok', $q$insert into rival_prices(shop_id,product_id,rival,price,seen_on) values ('11111111-1111-1111-1111-111111111111','P001','Nakasero Hardware',17000,current_date)$q$);
select _try('sourcing: a new product at the shop default', 'ok', $q$insert into products(shop_id,id,name,type,wholesale_markup_type,wholesale_markup_value,retail_markup_type,retail_markup_value,variants) values ('11111111-1111-1111-1111-111111111111','P002','Valley flashing 3m','simple','percent',0,'percent',0,'[]')$q$);
select _try('sourcing: a new product WITH its own markup', 'refused', $q$insert into products(shop_id,id,name,type,wholesale_markup_type,wholesale_markup_value,retail_markup_type,retail_markup_value,variants) values ('11111111-1111-1111-1111-111111111111','P003','X','simple','percent',30,'percent',0,'[]')$q$);
select _try('sourcing: edit a product''s details', 'ok', $q$update products set name='Ridge cap G28 · red', notes='came in red' where id='P001'$q$);
select _try('sourcing: edit details with an upsert carrying the same markup', 'ok', $q$insert into products(shop_id,id,name,type,wholesale_markup_type,wholesale_markup_value,retail_markup_type,retail_markup_value,variants) values ('11111111-1111-1111-1111-111111111111','P001','Ridge cap G28','simple','percent',20,'percent',30,'[]') on conflict (shop_id,id) do update set name=excluded.name, wholesale_markup_value=excluded.wholesale_markup_value$q$);
select _try('sourcing: CHANGE a product''s markup', 'refused', $q$update products set wholesale_markup_value = 40 where id='P001'$q$);
select _try('sourcing: switch a markup from percent to fixed', 'refused', $q$update products set wholesale_markup_type = 'fixed' where id='P001'$q$);
select _try('sourcing: a variant''s markup inside variants', 'refused', $q$update products set variants='[{"combo":{"c":"red"},"wholesaleMarkupValue":15}]' where id='P002'$q$);
select _try('sourcing: "goes with" pairing', 'ok', $q$insert into product_links(shop_id,id,from_id,verb,to_id) values ('11111111-1111-1111-1111-111111111111',1,'P002','with','P001')$q$);
select _try('sourcing: pin a new item to every agent''s Feed', 'ok', $q$insert into agent_feed_pins(shop_id,product_id,note) values ('11111111-1111-1111-1111-111111111111','P002','New in')$q$);
select _try('sourcing: read an agent''s stock request', 'ok', $q$do $d$ begin if not exists (select 1 from agent_requests where kind='stock') then raise exception 'none'; end if; end $d$$q$);
select _try('sourcing: does not see a word-to-learn request', 'ok', $q$do $d$ begin if exists (select 1 from agent_requests where kind='name') then raise exception 'saw it'; end if; end $d$$q$);
select _try('sourcing: take a stock request', 'ok', $q$update agent_requests set status='done', resolved_at=now() where kind='stock'$q$);
select _try('sourcing: the owner''s log, through its own task', 'ok', $q$insert into decision_log(shop_id,role,task,what) values ('11111111-1111-1111-1111-111111111111','sourcing','price.confirm','Ridge cap G28 still 11,500')$q$);
select _try('sourcing: reads the day''s confirmations', 'ok', $q$do $d$ begin if not exists (select 1 from decision_log where task='price.confirm') then raise exception 'none'; end if; end $d$$q$);
select _try('sourcing: a log line under a task it lacks', 'refused', $q$insert into decision_log(shop_id,role,task,what) values ('11111111-1111-1111-1111-111111111111','sourcing','markup.set','x')$q$);
select _try('sourcing: delete a request', 'refused', $q$delete from sourcing_leads where id='SRC-T1'$q$);
select _try('sourcing: a cash-out', 'refused', $q$insert into cash_txns(shop_id,date,account,type,category,amount) values ('11111111-1111-1111-1111-111111111111',current_date,'cash','payment','Transport',20000)$q$);
select _try('sourcing: touch stock', 'refused', $q$insert into stock(shop_id,key,product_id,qty) values ('11111111-1111-1111-1111-111111111111','k','P001',5)$q$);
select _try('sourcing: a supplier bill', 'refused', $q$insert into purchase_invoices(shop_id,date,payload) values ('11111111-1111-1111-1111-111111111111',current_date,'{}')$q$);
select _try('sourcing: add role_tasks rows', 'refused', $q$insert into role_tasks values ('sourcing','markup.set')$q$);

-- ---- as WORKER (staff): the same walls as before
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
select _try('worker: add a supplier', 'refused', $q$insert into suppliers(shop_id,id,name) values ('11111111-1111-1111-1111-111111111111','S009','W')$q$);
select _try('worker: a request', 'refused', $q$insert into sourcing_leads(id,shop_id,name) values ('SRC-W','11111111-1111-1111-1111-111111111111','W')$q$);
select _try('worker: a price row', 'refused', $q$insert into prices(shop_id,product_id,supplier_id) values ('11111111-1111-1111-1111-111111111111','P001','S001')$q$);
select _try('worker: a stock request', 'refused', $q$update agent_requests set status='declined' where kind='stock'$q$);

-- ---- as OWNER: everything as before
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select _try('owner: change a markup', 'ok', $q$update products set wholesale_markup_value = 35 where id='P001'$q$);
select _try('owner: a product with its own markup', 'ok', $q$insert into products(shop_id,id,name,type,wholesale_markup_type,wholesale_markup_value,retail_markup_type,retail_markup_value,variants) values ('11111111-1111-1111-1111-111111111111','P004','Y','simple','percent',30,'percent',0,'[]')$q$);
select _try('owner: delete a request', 'ok', $q$delete from sourcing_leads where id='SRC-T1'$q$);
-- the dropped line again: saved a second time, nothing new
select _try('owner: the order saved again', 'ok', $q$update saved_quotes set status='preparing' where id=9101$q$);

reset role;
select _try('a second save made no second request', 'ok', $q$do $d$ begin if (select count(*) from sourcing_leads where id like 'DRP-9101-%') <> 1 then raise exception 'count changed'; end if; end $d$$q$);
select case when (expect='ok' and got='ok') or (expect='refused' and got like 'refused%') then 'PASS' else 'FAIL' end, label, got from _r order by n;
