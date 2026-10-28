-- 0179 asked of a real database (docs/spec/05-data.md §8 Q1, Q2): a yard
-- worker's staff login keeps out of the money and customer tables, still
-- reads what the worker app reads, and still packs, loads and delivers.
grant all on all tables in schema public to authenticated;
grant all on all sequences in schema public to authenticated;
insert into auth.users values
 ('00000000-0000-0000-0000-00000000000a','owner@x'),('00000000-0000-0000-0000-00000000000b','manager@x'),
 ('00000000-0000-0000-0000-00000000000e','store@x'),('00000000-0000-0000-0000-00000000000f','accounts@x'),
 ('00000000-0000-0000-0000-000000000012','worker@x');
insert into shops(id, name, created_by) values ('11111111-1111-1111-1111-111111111111','Mukasa Hardware','00000000-0000-0000-0000-00000000000a');
insert into shop_members(shop_id,user_id,role) values
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000a','owner'),
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000b','manager'),
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000e','store'),
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000f','accounts'),
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-000000000012','staff');

-- The books as they stand (the checks are off while they go in).
set session_replication_role = replica;
insert into customers(shop_id,id,name,credit_limit) values ('11111111-1111-1111-1111-111111111111','C1','Kato Construction',5000000);
insert into products(shop_id,id,name) values ('11111111-1111-1111-1111-111111111111','P1','Nails');
insert into collection_trips(shop_id,id,supplier_id,status) values ('11111111-1111-1111-1111-111111111111','T1','S1','open');
insert into cash_txns(id, shop_id, date, account, type, category, amount, description) overriding system value
 values (9601,'11111111-1111-1111-1111-111111111111',ow_today(),'cash','receipt','Invoice Payment',185000,'Payment');
insert into saved_quotes(id, shop_id, client_name, date, status, amount_paid, payload) overriding system value values
 (9556,'11111111-1111-1111-1111-111111111111','Mukono Roofing',ow_today(),'preparing',185000,
  '{"payments":[{"id":1,"date":"2026-10-28","amount":185000,"cashTxnId":9601,"method":"cash"}],"items":[{"lineId":1,"productId":"P1","productName":"Nails","unit":"pack","qty":1,"supplierId":"__stock__","price":150000,"sellPrice":185000}]}');
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
-- How many rows the caller sees.
create function _sees(label text, expect int, q text) returns void language plpgsql as $$
declare c int;
begin execute 'select count(*) from (' || q || ') x' into c;
  insert into _r(label, expect, got) values (label, case when c = expect then 'ok' else 'saw ' || expect end, case when c = expect then 'ok' else 'saw ' || c end);
end $$;
grant all on _r, _r_n_seq to authenticated; grant execute on function _try, _sees to authenticated;
create function _st(p_id bigint) returns text language sql security definer as $$ select status from saved_quotes where id = p_id $$;
grant execute on function _st to authenticated;

set role authenticated;
-- ---------------- a yard worker (staff)
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000012';
select _sees('worker: reads the order', 1, 'select 1 from saved_quotes');
select _sees('worker: reads the products', 1, 'select 1 from products');
select _sees('worker: reads the trips', 1, 'select 1 from collection_trips');
select _sees('worker: reads no cash book', 0, 'select 1 from cash_txns');
select _sees('worker: reads no customers', 0, 'select 1 from customers');
select _try('worker: may not write the cash book', 'refused:42501', $q$insert into cash_txns(shop_id, date, account, type, category, amount, description) values ('11111111-1111-1111-1111-111111111111',ow_today(),'cash','expense','Fuel',5000,'x')$q$);
select _try('worker: may not change a customer''s credit', 'refused', $q$update customers set credit_limit = 99000000 where id = 'C1'$q$);
select _try('worker: may not add a customer', 'refused:42501', $q$insert into customers(shop_id,id,name) values ('11111111-1111-1111-1111-111111111111','C9','Mine')$q$);
select _sees('worker: holds order.pick, order.load and order.deliver', 3,
  $q$select 1 from unnest(array['order.pick','order.load','order.deliver']) k where has_task('11111111-1111-1111-1111-111111111111', k)$q$);
select _sees('worker: holds no money task', 0,
  $q$select 1 from unnest(array['order.move','cash.record','credit.release','order.cancel']) k where has_task('11111111-1111-1111-1111-111111111111', k)$q$);
select _try('worker: loads the paid order', 'ok', $q$select store_patch_order('11111111-1111-1111-1111-111111111111',9556,'{}'::jsonb,'pending_delivery',null)$q$);
select _try('worker: delivers it', 'ok', $q$select store_patch_order('11111111-1111-1111-1111-111111111111',9556,'{}'::jsonb,'completed',null)$q$);
select _sees('check: the order is Delivered', 1, $q$select 1 where _st(9556) = 'completed'$q$);

-- ---------------- the others keep what they had
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select _sees('manager: reads the cash book', 1, 'select 1 from cash_txns');
select _sees('manager: reads the customers', 1, 'select 1 from customers');
select _try('manager: changes a customer''s credit', 'ok', $q$update customers set credit_limit = 6000000 where id = 'C1'$q$);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000f';
select _sees('accounts: reads the cash book', 1, 'select 1 from cash_txns');
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select _sees('owner: reads the cash book', 1, 'select 1 from cash_txns');
reset role;

select case when (expect = 'ok' and got = 'ok') or (expect = 'refused' and got like 'refused%')
              or (expect like 'refused:%' and got like 'refused: ' || substr(expect, 9) || '%') then 'PASS' else 'FAIL' end, label, got from _r order by n;
