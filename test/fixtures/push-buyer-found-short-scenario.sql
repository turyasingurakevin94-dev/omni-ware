-- The two pushes 0144 adds, asked of a real database: Sourcing finding a
-- supplier for a line the client waits for tells the Buyer who sent it;
-- a trip handed in short tells each short order's salesperson.
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

insert into sourcing_leads(id, shop_id, name, status, requests) values
 ('CW-9302-1-P9','11111111-1111-1111-1111-111111111111','Valley gutter 3m','asked','[{"source":"dropped","orderId":9302,"customerName":"Kato Construction","droppedBy":"00000000-0000-0000-0000-000000000010","reason":"Nobody has it"}]'),
 ('CW-9303-1-P9','11111111-1111-1111-1111-111111111111','Valley gutter 2m','asked','[{"source":"dropped","orderId":9303,"customerName":"Ggaba Stores","reason":"Nobody has it"}]'),
 ('ASK-1','11111111-1111-1111-1111-111111111111','Paint 4L','asked','[{"source":"sourcing.ask","by":"00000000-0000-0000-0000-00000000000d"}]');
set role authenticated;

-- ---- Sourcing finds a supplier for a line the client waits for
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000011';
select _try('sourcing: starts looking', 'ok', $q$update sourcing_leads set status='looking' where id='CW-9302-1-P9'$q$);
select _try('check: looking tells nobody yet', 'ok', $q$select _is($c$not exists(select 1 from push_outbox where kind='sourcing.found')$c$)$q$);
select _try('sourcing: finds a supplier', 'ok', $q$update sourcing_leads set status='sourced' where id='CW-9302-1-P9'$q$);
select _try('check: Denis, who sent it, is told, nobody else', 'ok', $q$select _is($c$_to('sourcing.found')='10' and _body('sourcing.found') = 'Valley gutter 3m for Kato Construction · ask them, the client waits'$c$)$q$);
select _try('check: the title names who found it', 'ok', $q$select _is($c$(select title from push_outbox where kind='sourcing.found') = 'Moses found a supplier'$c$)$q$);
select _try('check: the push carries the order for the tap', 'ok', $q$select _is($c$(select ref ->> 'orderId' from push_outbox where kind='sourcing.found') = '9302'$c$)$q$);
select _try('sourcing: prices it, then lists it', 'ok', $q$update sourcing_leads set status='priced' where id='CW-9302-1-P9'$q$);
select _try('check: still one push, not one per step', 'ok', $q$select _is($c$(select count(*) from push_outbox where kind='sourcing.found')=1$c$)$q$);
select _try('sourcing: finds one for a request with no sender on it', 'ok', $q$update sourcing_leads set status='sourced' where id='CW-9303-1-P9'$q$);
select _try('check: then the Buyer is told, by task', 'ok', $q$select _is($c$(select string_agg(distinct right(r.user_id::text, 2), ',') from push_outbox o, lateral ow_push_recipients(o.id) r where o.dedupe like 'found:CW-9303%')='10' and (select to_task from push_outbox where dedupe like 'found:CW-9303%') = 'supplier.confirm'$c$)$q$);
select _try('sourcing: finds one for a salesperson''s own ask', 'ok', $q$update sourcing_leads set status='sourced' where id='ASK-1'$q$);
select _try('check: that is not a line the client waits for, so no push here', 'ok', $q$select _is($c$(select count(*) from push_outbox where kind='sourcing.found')=2$c$)$q$);

-- ---- a trip handed in short
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000010';
select _try('buyer: a trip out to Kiseka', 'ok', $q$insert into collection_trips(id, shop_id, supplier_id, status, lines) values ('T44','11111111-1111-1111-1111-111111111111','S2','collecting','[{"orderId":"9302","lineId":"1","productId":"P1","productName":"Ridge caps G28","qty":8,"gotQty":4},{"orderId":"9302","lineId":"2","productId":"P2","productName":"Iron sheet G28","qty":10,"gotQty":10},{"orderId":"9303","lineId":"1","productId":"P2","productName":"Iron sheet G28","qty":5,"gotQty":3},{"orderId":"9304","lineId":"1","productId":"P2","productName":"Iron sheet G28","qty":2,"gotQty":2},{"orderId":"restock","lineId":"r1","productId":"P1","productName":"Ridge caps G28","qty":20,"gotQty":0}]')$q$);
select _try('check: loading tells nobody', 'ok', $q$select _is($c$not exists(select 1 from push_outbox where kind='trip.short')$c$)$q$);
select _try('buyer: hands it in', 'ok', $q$update collection_trips set status='collected', collected_at=now() where id='T44'$q$);
select _try('check: Grace hears what Kato is short', 'ok', $q$select _is($c$(select body from push_outbox where dedupe='tripshort:T44:9302') = 'Kato Construction — 4 Ridge caps G28 short · back on the buying list' and (select title from push_outbox where dedupe='tripshort:T44:9302') = 'Short from Kiseka Steel'$c$)$q$);
select _try('check: an order nobody took goes to Sales by task', 'ok', $q$select _is($c$(select to_task from push_outbox where dedupe='tripshort:T44:9303') = 'quote.make'$c$)$q$);
select _try('check: an order that came in full, and the shelf, tell nobody', 'ok', $q$select _is($c$(select count(*) from push_outbox where kind='trip.short')=2$c$)$q$);
select _try('buyer: saves the trip again', 'ok', $q$update collection_trips set lines = lines where id='T44'$q$);
select _try('check: nothing more is sent', 'ok', $q$select _is($c$(select count(*) from push_outbox where kind='trip.short')=2$c$)$q$);
select _try('check: the owner gets none of these', 'ok', $q$select _is($c$not exists(select 1 from push_outbox o, lateral ow_push_recipients(o.id) r where o.kind in ('sourcing.found','trip.short') and r.user_id='00000000-0000-0000-0000-00000000000a')$c$)$q$);

reset role;
select case when (expect='ok' and got='ok') or (expect='refused' and got like 'refused%') then 'PASS' else 'FAIL' end, label, got from _r order by n;
