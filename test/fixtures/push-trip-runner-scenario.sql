-- 0150 asked of a real database: the runner a trip is sent or given to is
-- told once per round; the runner it is taken from is told; cancelling tells
-- the runner; a supplier bringing it pushes nobody.
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
select _try('buyer: a round of two sent to Musa', 'ok', $q$insert into collection_trips(id, shop_id, supplier_id, status, assigned_worker_id, lines) values
 ('TRIP-G1-1','11111111-1111-1111-1111-111111111111','S1','assigned','W3','[]'),
 ('TRIP-G1-2','11111111-1111-1111-1111-111111111111','S2','assigned','W3','[]')$q$);
select _try('check: Musa is told once for the round', 'ok', $q$select _is($c$(select count(*) from push_outbox where kind='trip.sent')=1 and _to('trip.sent')='0e'$c$)$q$);
select _try('check: the push names where it starts', 'ok', $q$select _is($c$_body('trip.sent') = 'A round, starting at Nakawa Cement Depot: open it to set off.'$c$)$q$);
select _try('buyer: the chase gives the first stop to Grace', 'ok', $q$update collection_trips set assigned_worker_id='W2' where id='TRIP-G1-1'$q$);
select _try('check: Grace is told it is hers now', 'ok', $q$select _is($c$(select count(*) from push_outbox where kind='trip.sent')=2 and _to('trip.sent')='0d,0e' and (select title from push_outbox where kind='trip.sent' order by id desc limit 1)='A trip is yours now'$c$)$q$);
select _try('check: Musa is told it went to Grace', 'ok', $q$select _is($c$_to('trip.taken')='0e' and _body('trip.taken') = 'The trip to Nakawa Cement Depot is Grace Akello''s now.'$c$)$q$);
select _try('buyer: the chase cancels the second stop', 'ok', $q$update collection_trips set voided=true, note='Cancelled: not taken' where id='TRIP-G1-2'$q$);
select _try('check: Musa is told it is cancelled', 'ok', $q$select _is($c$_to('trip.cancelled')='0e' and _body('trip.cancelled') = 'The trip to Kiseka Steel is off: its lines are back on To plan.'$c$)$q$);
select _try('buyer: a supplier brings one', 'ok', $q$insert into collection_trips(id, shop_id, supplier_id, status, assigned_worker_id, lines) values ('TRIP-D1','11111111-1111-1111-1111-111111111111','S2','assigned','__supplier__','[]')$q$);
select _try('check: a delivery pushes no runner', 'ok', $q$select _is($c$(select count(*) from push_outbox where kind='trip.sent')=2$c$)$q$);
reset role;
select case when expect = got then 'PASS' else 'FAIL' end, label, got from _r order by n;
