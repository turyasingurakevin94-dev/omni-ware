-- 0173 asked of a real database (docs/spec/01-order-journey.md §5 Q2): moving
-- an order's stage needs its task, and only to an allowed next stage —
-- Sales, the Buyer, the Store, Accounts, the Manager, the owner's console and
-- the server with no login.
grant all on all tables in schema public to authenticated;
grant all on all sequences in schema public to authenticated;
insert into auth.users values
 ('00000000-0000-0000-0000-00000000000a','owner@x'),('00000000-0000-0000-0000-00000000000b','manager@x'),
 ('00000000-0000-0000-0000-00000000000c','buyer@x'),('00000000-0000-0000-0000-00000000000d','sales@x'),
 ('00000000-0000-0000-0000-00000000000e','store@x'),('00000000-0000-0000-0000-00000000000f','accounts@x');
insert into shops(id, name, created_by) values ('11111111-1111-1111-1111-111111111111','Omni-ware','00000000-0000-0000-0000-00000000000a');
insert into shop_members(shop_id,user_id,role) values
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000a','owner'),
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000b','manager'),
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000c','buyer'),
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000d','sales'),
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000e','store'),
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000f','accounts');
insert into app_settings(shop_id, presets) values ('11111111-1111-1111-1111-111111111111','{}')
 on conflict (shop_id) do update set presets = excluded.presets;

-- Orders at each stage (the checks are off while they go in). Each sells
-- one bag of cement at 35,000 and is paid, so no price, credit or money hold
-- stands in the way of a move.
set session_replication_role = replica;
insert into cash_txns(id, shop_id, date, account, type, category, amount, description, quote_id)
 select 9500 + g, '11111111-1111-1111-1111-111111111111', ow_today(), 'cash', 'receipt', 'Invoice Payment', 35000, 'Payment', 500 + g from generate_series(1, 9) g;
insert into saved_quotes(id, shop_id, client_name, date, status, invoiced, voided, amount_paid, payload) overriding system value
 select 500 + g, '11111111-1111-1111-1111-111111111111', 'Ken', ow_today(), s, g = 8, g = 9, 35000,
        jsonb_build_object('payments', jsonb_build_array(jsonb_build_object('id',1,'date',ow_today(),'amount',35000,'cashTxnId',9500 + g,'method','cash')),
          'items', jsonb_build_array(jsonb_build_object('lineId',1,'productName','Cement','qty',1,'price',30000,'sellPrice',35000,'supplierId','S1')))
   from (values (1,'draft'),(2,'draft'),(3,'awaiting_goods'),(4,'preparing'),(5,'preparing'),(6,'pending_delivery'),(7,'draft'),(8,'completed'),(9,'preparing')) v(g, s);
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
create function _st(p_id bigint) returns text language sql security definer as $$ select status from saved_quotes where id = p_id $$;
grant execute on function _st to authenticated;

set role authenticated;
-- ---------------- a new order
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000d';
select _try('sales: a new order On the road (a skip out of Checking) is refused', 'refused:OWSTG', $q$insert into saved_quotes(id, shop_id, client_name, date, status, payload) overriding system value values (520,'11111111-1111-1111-1111-111111111111','Ken',ow_today(),'pending_delivery','{"payments":[],"items":[{"lineId":1,"productName":"Cement","qty":1,"price":30000,"sellPrice":35000,"supplierId":"S1"}]}')$q$);
select _try('sales: a new order in Checking is placed', 'ok', $q$insert into saved_quotes(id, shop_id, client_name, date, status, payload) overriding system value values (520,'11111111-1111-1111-1111-111111111111','Ken',ow_today(),'draft','{"payments":[],"items":[{"lineId":1,"productName":"Cement","qty":1,"price":30000,"sellPrice":35000,"supplierId":"S1"}]}')$q$);
select _try('sales: saving it again (an upsert) is judged as the update it is', 'ok', $q$insert into saved_quotes(id, shop_id, client_name, date, status, payload) overriding system value values (520,'11111111-1111-1111-1111-111111111111','Ken',ow_today(),'draft','{"payments":[],"note":"call first","items":[{"lineId":1,"productName":"Cement","qty":1,"price":30000,"sellPrice":35000,"supplierId":"S1"}]}') on conflict (id) do update set payload = excluded.payload$q$);

-- ---------------- the Buyer: out of Checking when the last supplier says yes, nothing more
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
select _try('buyer: a new order placed straight in Buying is refused (no order.move, no quote.make)', 'refused:42501', $q$insert into saved_quotes(id, shop_id, client_name, date, status, payload) overriding system value values (521,'11111111-1111-1111-1111-111111111111','Ken',ow_today(),'awaiting_goods','{"payments":[],"items":[{"lineId":1,"productName":"Cement","qty":1,"price":30000,"sellPrice":35000,"supplierId":"S1"}]}')$q$);
select _try('buyer: #0501 from Checking to Buying (supplier.confirm)', 'ok', $q$update saved_quotes set status = 'awaiting_goods' where id=501$q$);
select _try('check: #0501 is in Buying', 'ok', $q$select _is($c$_st(501) = 'awaiting_goods'$c$)$q$);
select _try('buyer: #0503 from Buying to Packing is refused', 'refused:42501', $q$update saved_quotes set status = 'preparing' where id=503$q$);
select _try('buyer: #0504 from Packing to On the road is refused', 'refused:42501', $q$update saved_quotes set status = 'pending_delivery' where id=504$q$);
select _try('buyer: #0507 to Delivered through ow_patch_order is refused', 'refused:42501', $q$select ow_patch_order('11111111-1111-1111-1111-111111111111',507,'{}'::jsonb,null,null,null,'completed')$q$);
select _try('buyer: #0501 back to Checking is refused', 'refused:42501', $q$update saved_quotes set status = 'draft' where id=501$q$);
select _try('check: the refused moves left each order where it was', 'ok', $q$select _is($c$_st(501) = 'awaiting_goods' and _st(503) = 'awaiting_goods' and _st(504) = 'preparing' and _st(507) = 'draft'$c$)$q$);

-- ---------------- Accounts never moves an order
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000f';
select _try('accounts: #0502 from Checking to Packing is refused', 'refused', $q$update saved_quotes set status = 'preparing' where id=502$q$);

-- ---------------- the Store: loads and delivers, through its function
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000e';
select _try('store: loads #0504 (order.load)', 'ok', $q$select store_patch_order('11111111-1111-1111-1111-111111111111',504,'{"pickingStatus":"done"}'::jsonb,'pending_delivery',null)$q$);
select _try('store: delivers #0506 (order.deliver)', 'ok', $q$select store_patch_order('11111111-1111-1111-1111-111111111111',506,'{"deliveredNote":"At the gate"}'::jsonb,'completed',null)$q$);
select _try('check: #0504 is On the road, #0506 Delivered', 'ok', $q$select _is($c$_st(504) = 'pending_delivery' and _st(506) = 'completed'$c$)$q$);

-- ---------------- Sales (order.move, decision-rights)
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000d';
select _try('sales: #0505 from Packing to On the road (order.move)', 'ok', $q$select ow_patch_order('11111111-1111-1111-1111-111111111111',505,'{}'::jsonb,null,null,null,'pending_delivery')$q$);

-- ---------------- the Manager
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select _try('manager: #0503 from Buying to Packing', 'ok', $q$select ow_patch_order('11111111-1111-1111-1111-111111111111',503,'{}'::jsonb,null,null,null,'preparing')$q$);
select _try('manager: #0502 from Checking straight to On the road is refused', 'refused:OWSTG', $q$select ow_patch_order('11111111-1111-1111-1111-111111111111',502,'{}'::jsonb,null,null,null,'pending_delivery')$q$);
select _try('manager: #0502 to a stage that is not one of the five is refused', 'refused:OWSTG', $q$update saved_quotes set status = 'sent' where id=502$q$);
select _try('manager: #0502 marked done from Checking', 'ok', $q$update saved_quotes set status = 'completed' where id=502$q$);
select _try('manager: and undone, back to Checking', 'ok', $q$update saved_quotes set status = 'draft' where id=502$q$);
select _try('manager: #0504 back from On the road to Packing', 'ok', $q$update saved_quotes set status = 'preparing' where id=504$q$);
select _try('manager: voided #0509 back to Buying is refused', 'refused:OWSTG', $q$update saved_quotes set status = 'awaiting_goods' where id=509$q$);
select _try('manager: invoiced #0508 back to Packing is refused', 'refused:OWSTG', $q$update saved_quotes set status = 'preparing' where id=508$q$);
select _try('check: the Manager''s moves stand', 'ok', $q$select _is($c$_st(503) = 'preparing' and _st(502) = 'draft' and _st(504) = 'preparing' and _st(509) = 'preparing' and _st(508) = 'completed'$c$)$q$);

-- ---------------- the owner's console, and the server
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select _try('owner (console): #0507 from Checking to On the road is not judged', 'ok', $q$update saved_quotes set status = 'pending_delivery' where id=507$q$);
reset role;
set request.jwt.claim.sub = '';
select _try('server, no login: #0507 back to Checking is not judged', 'ok', $q$update saved_quotes set status = 'draft' where id=507$q$);
select _try('check: #0507 is in Checking', 'ok', $q$select _is($c$_st(507) = 'draft'$c$)$q$);

select case when (expect = 'ok' and got = 'ok') or (expect = 'refused' and got like 'refused%')
              or (expect like 'refused:%' and got like 'refused: ' || substr(expect, 9) || '%') then 'PASS' else 'FAIL' end, label, got from _r order by n;
