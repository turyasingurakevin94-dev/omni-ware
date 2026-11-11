-- 0182 asked of a real database (Sales+Buyer cross-app round 1, BUY-1):
-- an order with an open ask to cancel it never goes on a new trip line,
-- and the Buyer is pushed the hold and the Manager's no.
grant all on all tables in schema public to authenticated;
grant all on all sequences in schema public to authenticated;
insert into auth.users values
 ('00000000-0000-0000-0000-00000000000a','owner@x'),('00000000-0000-0000-0000-00000000000b','manager@x'),
 ('00000000-0000-0000-0000-00000000000c','buyer@x'),('00000000-0000-0000-0000-00000000000d','grace@x'),
 ('00000000-0000-0000-0000-00000000000e','store@x'),('00000000-0000-0000-0000-00000000000f','worker@x'),
 ('00000000-0000-0000-0000-000000000010','brian@x'),('00000000-0000-0000-0000-000000000011','accounts@x');
insert into shops(id, name, created_by) values ('11111111-1111-1111-1111-111111111111','Omni-ware','00000000-0000-0000-0000-00000000000a');
insert into shop_members(shop_id,user_id,role,display_name) values
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000a','owner','Kevin'),
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000b','manager','Ruth Nakato'),
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000c','buyer','Musa Okello'),
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000d','sales','Grace Akello'),
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000e','store','Peter Ssali'),
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000f','staff','Joseph'),
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-000000000010','sales','Brian Okot'),
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-000000000011','accounts','Esther');
insert into app_settings(shop_id, presets) values ('11111111-1111-1111-1111-111111111111','{}')
 on conflict (shop_id) do update set presets = excluded.presets;

-- Orders (the checks are off while they go in), Grace's:
--   #0901 Checking.  #0902 Buying.  #0903 Checking.  #0904 Packing.  #0905 Checking.
set session_replication_role = replica;
insert into customers(shop_id,id,name,debt) values ('11111111-1111-1111-1111-111111111111','C1','Ken',0);
insert into saved_quotes(id, shop_id, client_name, date, status, invoiced, voided, amount_paid, payload) overriding system value
 select g, '11111111-1111-1111-1111-111111111111', 'Ken', ow_today(), s, false, false, 0,
   jsonb_build_object('customerId','C1','takenBy','00000000-0000-0000-0000-00000000000d','payments','[]'::jsonb,
     'items', jsonb_build_array(jsonb_build_object('lineId',1,'productId','P2','productName','Iron sheet','qty',5,'price',40000,'sellPrice',45000,'supplierId','S1')))
   from (values (901,'draft'),(902,'awaiting_goods'),(903,'draft'),(904,'preparing'),(905,'draft')) v(g, s);
set session_replication_role = origin;

create table _r(n serial, label text, expect text, got text);
create table _out(k text, r jsonb);
create function _try(label text, expect text, q text) returns void language plpgsql as $$
declare got text := 'ok';
begin
  declare n int; begin execute q; get diagnostics n = row_count;
    if n = 0 and (q ilike 'update%' or q ilike 'delete%') then got := 'refused: 0 rows (row-level security hid them)'; end if;
  exception when others then got := 'refused: ' || sqlstate || ' ' || sqlerrm; end;
  insert into _r(label, expect, got) values (label, expect, got);
end $$;
grant all on _r, _r_n_seq, _out to authenticated; grant execute on function _try to authenticated;
create function _is(cond_sql text) returns void language plpgsql security definer as $$
declare ok boolean;
begin execute 'select (' || cond_sql || ')' into ok;
  if not coalesce(ok, false) then raise exception 'not so: %', cond_sql; end if; end $$;
grant execute on function _is to authenticated;
-- What the caller sees of cancel_asks, under their own row-level security.
create function _sees() returns bigint language sql as $$ select count(*) from cancel_asks $$;
grant execute on function _sees to authenticated;
create function _ask(k text) returns uuid language sql security definer as $$ select (r ->> 'id')::uuid from _out where _out.k = $1 $$;
grant execute on function _ask to authenticated;

set role authenticated;
-- ---------------- the ask holds the order, and tells the Buyer
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000d';
select _try('grace: asks Ruth to cancel #0901', 'ok', $q$insert into _out select 'a1', ask_cancel('11111111-1111-1111-1111-111111111111',901,'Changed their mind')$q$);
select _try('check: the Buyer (trip.plan) is pushed the hold, once', 'ok', $q$select _is($c$(select count(*) from push_outbox where kind = 'order.hold') = 1 and exists(select 1 from push_outbox where kind = 'order.hold' and to_task = 'trip.plan' and title = 'On hold · #0901' and body = 'Grace asked Ruth to cancel · Ken · don''t ask or buy it' and ref ->> 'orderId' = '901')$c$)$q$);
select _try('grace: asks again while it waits', 'ok', $q$select ask_cancel('11111111-1111-1111-1111-111111111111',901,'Entered twice')$q$);
select _try('check: still one hold push', 'ok', $q$select _is($c$(select count(*) from push_outbox where kind = 'order.hold') = 1$c$)$q$);

-- ---------------- no new trip line for an order on hold
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
select _try('buyer: a trip with #0901 on it', 'refused:OWHLD', $q$insert into collection_trips(id, shop_id, supplier_id, status, lines) values ('T1','11111111-1111-1111-1111-111111111111','S1','open','[{"orderId":901,"lineId":1,"qty":5}]')$q$);
select _try('buyer: a trip with #0903 and #0901 together', 'refused:OWHLD', $q$insert into collection_trips(id, shop_id, supplier_id, status, lines) values ('T2','11111111-1111-1111-1111-111111111111','S1','open','[{"orderId":903,"lineId":1,"qty":5},{"orderId":901,"lineId":1,"qty":5}]')$q$);
select _try('check: neither trip was written', 'ok', $q$select _is($c$(select count(*) from collection_trips) = 0$c$)$q$);
select _try('buyer: a trip with #0903 only', 'ok', $q$insert into collection_trips(id, shop_id, supplier_id, status, lines) values ('T3','11111111-1111-1111-1111-111111111111','S1','open','[{"orderId":903,"lineId":1,"qty":5}]')$q$);
select _try('buyer: adds #0901 to that trip', 'refused:OWHLD', $q$update collection_trips set lines = lines || '[{"orderId":901,"lineId":1,"qty":5}]'::jsonb where id = 'T3'$q$);
select _try('buyer: a restock line (no order) on a trip', 'ok', $q$insert into collection_trips(id, shop_id, supplier_id, status, lines) values ('T4','11111111-1111-1111-1111-111111111111','S1','open','[{"orderId":"restock","qty":2}]')$q$);

-- ---------------- an ask after the cash: the line stays on the running trip
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000d';
select _try('grace: asks to cancel #0903, already on trip T3', 'ok', $q$insert into _out select 'a3', ask_cancel('11111111-1111-1111-1111-111111111111',903,'Wrong items or how many')$q$);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
select _try('buyer: counts 0 for #0903 at the stop (its line stays on the row)', 'ok', $q$update collection_trips set status = 'collecting', lines = '[{"orderId":903,"lineId":1,"qty":5,"got":0}]' where id = 'T3'$q$);
select _try('check: T3 keeps its #0903 line', 'ok', $q$select _is($c$(select lines -> 0 ->> 'got' from collection_trips where id = 'T3') = '0'$c$)$q$);

-- ---------------- the Manager's no: the Buyer is told, and the order can go on a trip again
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select _try('ruth: keeps #0901', 'ok', $q$select answer_cancel_ask(_ask('a1'), false, 'They called back, still want it')$q$);
select _try('check: the Buyer is pushed "Ruth kept it · back to To ask"', 'ok', $q$select _is($c$exists(select 1 from push_outbox where kind = 'order.hold.kept' and to_task = 'trip.plan' and title = 'Not cancelled · #0901' and body = 'Ruth kept it · Ken · back to To ask')$c$)$q$);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
select _try('buyer: a trip with #0901, now it is kept', 'ok', $q$insert into collection_trips(id, shop_id, supplier_id, status, lines) values ('T5','11111111-1111-1111-1111-111111111111','S1','open','[{"orderId":901,"lineId":1,"qty":5}]')$q$);

-- ---------------- the Manager's yes: nothing new for the Buyer (0177 tells the yard and Sales)
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000d';
select _try('grace: asks to cancel #0905', 'ok', $q$insert into _out select 'a5', ask_cancel('11111111-1111-1111-1111-111111111111',905,'Entered twice')$q$);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select _try('ruth: cancels #0905', 'ok', $q$select answer_cancel_ask(_ask('a5'), true)$q$);
select _try('check: the hold push went for #0905, no "kept" push', 'ok', $q$select _is($c$exists(select 1 from push_outbox where kind = 'order.hold' and ref ->> 'orderId' = '905') and not exists(select 1 from push_outbox where kind = 'order.hold.kept' and ref ->> 'orderId' = '905')$c$)$q$);

-- ---------------- only while the Buyer works it: Checking or Buying
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000d';
select _try('grace: asks to cancel #0904 (Packing)', 'ok', $q$insert into _out select 'a4', ask_cancel('11111111-1111-1111-1111-111111111111',904,'Changed their mind')$q$);
select _try('grace: asks to cancel #0902 (Buying)', 'ok', $q$insert into _out select 'a2', ask_cancel('11111111-1111-1111-1111-111111111111',902,'Changed their mind')$q$);
select _try('check: the Buyer is told of #0902, not of #0904', 'ok', $q$select _is($c$exists(select 1 from push_outbox where kind = 'order.hold' and ref ->> 'orderId' = '902') and not exists(select 1 from push_outbox where kind = 'order.hold' and ref ->> 'orderId' = '904')$c$)$q$);

-- ---------------- a write with no login is not judged (the owner's console, the server)
reset role;
set request.jwt.claim.sub = '';
select _try('server: a trip with #0902 on hold', 'ok', $q$insert into collection_trips(id, shop_id, supplier_id, status, lines) values ('T6','11111111-1111-1111-1111-111111111111','S1','open','[{"orderId":902,"lineId":1,"qty":5}]')$q$);

select case when (expect = 'ok' and got = 'ok') or (expect like 'refused:%' and got like 'refused: ' || substr(expect, 9) || '%') then 'PASS' else 'FAIL' end, label, got from _r order by n;
