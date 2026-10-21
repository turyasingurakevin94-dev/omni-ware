-- 0147 asked of a real database: a round of three stops handed in at once
-- tells the Store and Accounts once, naming the round; a single trip reads
-- as before.
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

insert into suppliers(shop_id, id, name) values ('11111111-1111-1111-1111-111111111111','S3','Owino Plumbing'),('11111111-1111-1111-1111-111111111111','S4','Namanve Sheets');
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000010';
select _try('check: the round of a stop is its id without the stop number', 'ok', $q$select _is($c$ow_trip_round('TRIP-MG3K2A-3') = 'TRIP-MG3K2A' and ow_trip_round('TRIP-MG3K2A') = 'TRIP-MG3K2A' and ow_trip_round('T9') = 'T9'$c$)$q$);
select _try('buyer: a round of four out', 'ok', $q$insert into collection_trips(id, shop_id, supplier_id, status, lines) values
 ('TRIP-R1-1','11111111-1111-1111-1111-111111111111','S3','collecting','[{"orderId":"9302","lineId":"1","productId":"P1","qty":2,"gotQty":2}]'),
 ('TRIP-R1-2','11111111-1111-1111-1111-111111111111','S2','collecting','[{"orderId":"9302","lineId":"2","productId":"P2","qty":4,"gotQty":4}]'),
 ('TRIP-R1-3','11111111-1111-1111-1111-111111111111','S4','collecting','[{"orderId":"9303","lineId":"1","productId":"P2","qty":5,"gotQty":5}]'),
 ('TRIP-R1-4','11111111-1111-1111-1111-111111111111','S1','collecting','[{"orderId":"9304","lineId":"1","productId":"P2","qty":1}]')$q$);
select _try('check: being out tells nobody', 'ok', $q$select _is($c$not exists(select 1 from push_outbox where kind in ('trip.back','trip.cash'))$c$)$q$);
select _try('buyer: the stop not reached is off the round', 'ok', $q$update collection_trips set voided=true where id='TRIP-R1-4'$q$);
select _try('buyer: hands the round in, three stops at once', 'ok', $q$update collection_trips set status='collected', collected_at=now() where id in ('TRIP-R1-1','TRIP-R1-2','TRIP-R1-3')$q$);
select _try('check: the Store is told once for the round', 'ok', $q$select _is($c$(select count(*) from push_outbox where kind='trip.back')=1 and _to('trip.back')='0e'$c$)$q$);
select _try('check: Accounts is told once for the round', 'ok', $q$select _is($c$(select count(*) from push_outbox where kind='trip.cash')=1 and _to('trip.cash')='0f'$c$)$q$);
select _try('check: the push names the round and its three stops', 'ok', $q$select _is($c$(select title from push_outbox where kind='trip.back') = 'A round is back — count it in' and _body('trip.back') like '% +2 · one round of 3 stops: onto the shelf after the yard count.'$c$)$q$);
select _try('check: the push carries the round for the tap', 'ok', $q$select _is($c$(select ref ->> 'round' from push_outbox where kind='trip.back') = 'TRIP-R1'$c$)$q$);
select _try('buyer: a single trip handed in', 'ok', $q$insert into collection_trips(id, shop_id, supplier_id, status, lines) values ('TRIP-S1','11111111-1111-1111-1111-111111111111','S2','collecting','[]')$q$);
select _try('buyer: hands it in', 'ok', $q$update collection_trips set status='collected', collected_at=now() where id='TRIP-S1'$q$);
select _try('check: it reads as before', 'ok', $q$select _is($c$(select title from push_outbox where dedupe='tripback:TRIP-S1:store') = 'A trip is back — count it in' and (select body from push_outbox where dedupe='tripback:TRIP-S1:store') = 'From Kiseka Steel: onto the shelf after the yard count.'$c$)$q$);
select _try('check: two hand-ins, two pushes each way', 'ok', $q$select _is($c$(select count(*) from push_outbox where kind='trip.back')=2 and (select count(*) from push_outbox where kind='trip.cash')=2$c$)$q$);

reset role;
select case when (expect='ok' and got='ok') or (expect='refused' and got like 'refused%') then 'PASS' else 'FAIL' end, label, got from _r order by n;
