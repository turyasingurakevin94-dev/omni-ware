-- 0151 asked of a real database: own money on the trip, the pay-back to
-- Accounts, a handover tied once to its round, a carton asked of the Manager.
grant all on all tables in schema public to authenticated;
grant all on all sequences in schema public to authenticated;
insert into auth.users values
 ('00000000-0000-0000-0000-00000000000a','owner@x'),('00000000-0000-0000-0000-00000000000b','manager@x'),
 ('00000000-0000-0000-0000-00000000000d','sales@x'),('00000000-0000-0000-0000-00000000000e','store@x'),
 ('00000000-0000-0000-0000-00000000000f','accounts@x'),('00000000-0000-0000-0000-000000000010','buyer@x'),
 ('00000000-0000-0000-0000-000000000011','sourcing@x');
insert into shops(id, name, created_by) values ('11111111-1111-1111-1111-111111111111','Mukasa Hardware','00000000-0000-0000-0000-00000000000a');
insert into shop_members(shop_id,user_id,role) values
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000a','owner'),
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000b','manager'),
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000d','sales'),
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000e','store'),
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000f','accounts'),
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-000000000010','buyer'),
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-000000000011','sourcing');
insert into staff(shop_id,id,name,role,user_id) values
 ('11111111-1111-1111-1111-111111111111','W1','Ruth Nakato','manager','00000000-0000-0000-0000-00000000000b'),
 ('11111111-1111-1111-1111-111111111111','W2','Grace Akello','sales','00000000-0000-0000-0000-00000000000d'),
 ('11111111-1111-1111-1111-111111111111','W3','Musa Kiggundu','store','00000000-0000-0000-0000-00000000000e'),
 ('11111111-1111-1111-1111-111111111111','W4','Esther Auma','accounts','00000000-0000-0000-0000-00000000000f'),
 ('11111111-1111-1111-1111-111111111111','W5','Denis Okello','buyer','00000000-0000-0000-0000-000000000010'),
 ('11111111-1111-1111-1111-111111111111','W6','Moses Lubega','sourcing','00000000-0000-0000-0000-000000000011');
insert into products(shop_id,id,name) values ('11111111-1111-1111-1111-111111111111','P1','Ridge caps G28'),('11111111-1111-1111-1111-111111111111','P2','Iron sheet G28');
insert into suppliers(shop_id, id, name) values
 ('11111111-1111-1111-1111-111111111111','S1','Nakawa Cement Depot'),('11111111-1111-1111-1111-111111111111','S2','Kiseka Steel');
insert into saved_quotes(id, shop_id, client_name, status, invoiced, payload) overriding system value values
 (9302,'11111111-1111-1111-1111-111111111111','Kato Construction','awaiting_goods',false,'{"takenBy":"00000000-0000-0000-0000-00000000000d"}'),
 (9303,'11111111-1111-1111-1111-111111111111','Ggaba Stores','awaiting_goods',false,'{}'),
 (9304,'11111111-1111-1111-1111-111111111111','Lubowa Builders','awaiting_goods',false,'{"takenBy":"00000000-0000-0000-0000-000000000099"}');


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
-- Who one kind of push reaches: the test logins' last two hex digits.
create function _to(p_kind text) returns text language sql security definer as $$
  select coalesce(string_agg(distinct right(r.user_id::text, 2), ','), '')
    from push_outbox o, lateral ow_push_recipients(o.id) r where o.kind = p_kind
$$;
create function _body(p_kind text) returns text language sql security definer as $$
  select string_agg(body, ' | ' order by id) from push_outbox where kind = p_kind
$$;
grant execute on function _to, _body to authenticated;

set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000010';
select _try('buyer: a round on own money handed in, its pay on the trip', 'ok', $q$insert into collection_trips(id, shop_id, supplier_id, status, lines, pay) values ('TRIP-OM-1','11111111-1111-1111-1111-111111111111','S1','collected','[]','{"own":true,"amount":165000,"receipt":"none"}')$q$);
select _try('buyer: passes the pay-back to Accounts', 'ok', $q$insert into buyer_handoffs(shop_id, kind, for_role, ref, payload) values ('11111111-1111-1111-1111-111111111111','own_money','accounts','round:TRIP-OM','{"buyer":"Denis","round":"TRIP-OM","amount":165000,"stops":[{"tripId":"TRIP-OM-1","supplier":"Nakawa Cement Depot","amount":165000,"receipt":"none"}]}')$q$);
select _try('check: Accounts is told to pay the Buyer back', 'ok', $q$select _is($c$_to('trip.own_money')='0f' and (select title from push_outbox where kind='trip.own_money') = 'Pay Denis back'$c$)$q$);
select _try('buyer: asks Accounts for cash', 'ok', $q$insert into buyer_handoffs(id, shop_id, kind, for_role, ref, payload) values ('aaaaaaaa-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','trip_cash','accounts','round:x1','{"amount":300000,"supplierIds":["S1"],"v":2}')$q$);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000f';
select _try('accounts: hands it over', 'ok', $q$update buyer_handoffs set status='done' where id='aaaaaaaa-0000-0000-0000-000000000001'$q$);
select _try('accounts: closes the pay-back', 'ok', $q$update buyer_handoffs set status='done' where kind='own_money'$q$);
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000010';
select _try('buyer: the round that started on it is stamped on the cash', 'ok', $q$update buyer_handoffs set payload = payload || '{"round":"TRIP-ZZ","v":2}' where id='aaaaaaaa-0000-0000-0000-000000000001'$q$);
select _try('buyer: never a second round on the same cash', 'refused', $q$update buyer_handoffs set payload = payload || '{"round":"TRIP-YY"}' where id='aaaaaaaa-0000-0000-0000-000000000001'$q$);
select _try('buyer: never a new amount', 'refused', $q$update buyer_handoffs set payload = payload || '{"amount":1}' where id='aaaaaaaa-0000-0000-0000-000000000001'$q$);
select _try('check: the cash names its round', 'ok', $q$select _is($c$(select payload ->> 'round' from buyer_handoffs where id='aaaaaaaa-0000-0000-0000-000000000001') = 'TRIP-ZZ'$c$)$q$);
select _try('buyer: a carton of 200 for 1 sold, the shelf part asked of the Manager', 'ok', $q$insert into restock_buys(shop_id, product_id, qty, unit, supplier_id, price, status, for_line) values ('11111111-1111-1111-1111-111111111111','P1',199,'pack','S2',1500,'held','9302:1')$q$);
select _try('check: the Manager is asked', 'ok', $q$select _is($c$_to('carton.ask')='0b'$c$)$q$);
reset role;
select case when (expect='ok' and got='ok') or (expect='refused' and got like 'refused%') then 'PASS' else 'FAIL' end, label, got from _r order by n;
