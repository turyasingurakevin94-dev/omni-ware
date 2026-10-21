-- 0155 asked of a real database: a packed order a cash customer has not
-- paid for stays on the bay for a Store login; the Store asks the Manager,
-- the Manager's yes lets it go, and each side gets a push.
grant all on all tables in schema public to authenticated;
grant all on all sequences in schema public to authenticated;
insert into auth.users values
 ('00000000-0000-0000-0000-00000000000a','owner@x'),('00000000-0000-0000-0000-00000000000b','manager@x'),
 ('00000000-0000-0000-0000-00000000000d','sales@x'),('00000000-0000-0000-0000-00000000000e','store@x');
insert into shops(id, name, created_by) values ('11111111-1111-1111-1111-111111111111','Mukasa Hardware','00000000-0000-0000-0000-00000000000a');
insert into shop_members(shop_id,user_id,role) values
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000a','owner'),
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000b','manager'),
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000d','sales'),
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000e','store');
insert into staff(shop_id,id,name,role,user_id) values
 ('11111111-1111-1111-1111-111111111111','W1','Ruth Nakato','manager','00000000-0000-0000-0000-00000000000b'),
 ('11111111-1111-1111-1111-111111111111','W3','Musa Kiggundu','store','00000000-0000-0000-0000-00000000000e');
insert into customers(shop_id,id,name) values ('11111111-1111-1111-1111-111111111111','C1','Ggaba Stores');
insert into customers(shop_id,id,name,credit_limit) values ('11111111-1111-1111-1111-111111111111','C2','Kato Construction',5000000);
insert into agents(shop_id,id,name) values ('11111111-1111-1111-1111-111111111111','A1','Peter Sserwadda');
insert into saved_quotes(id, shop_id, client_name, status, invoiced, amount_paid, payload) overriding system value values
 (9554,'11111111-1111-1111-1111-111111111111','Ggaba Stores','preparing',false,0,'{"customerId":"C1","items":[{"lineId":1,"productId":"P1","productName":"Nails","unit":"pack","qty":1,"supplierId":"__stock__","price":150000,"sellPrice":185000}]}'),
 (9555,'11111111-1111-1111-1111-111111111111','Kato Construction','preparing',false,0,'{"customerId":"C2","items":[{"lineId":1,"productId":"P1","productName":"Nails","unit":"pack","qty":1,"supplierId":"__stock__","price":150000,"sellPrice":185000}]}'),
 (9556,'11111111-1111-1111-1111-111111111111','Mukono Roofing','preparing',false,185000,'{"items":[{"lineId":1,"productId":"P1","productName":"Nails","unit":"pack","qty":1,"supplierId":"__stock__","price":150000,"sellPrice":185000}]}'),
 (9557,'11111111-1111-1111-1111-111111111111','Walk-in','preparing',false,0,'{"items":[{"lineId":1,"productId":"P1","productName":"Nails","unit":"pack","qty":1,"supplierId":"__stock__","price":150000,"sellPrice":40000}]}'),
 (9558,'11111111-1111-1111-1111-111111111111','Peter Sserwadda','preparing',false,0,'{"originAgentId":"A1","items":[{"lineId":1,"productId":"P1","productName":"Nails","unit":"pack","qty":1,"supplierId":"__stock__","price":150000,"sellPrice":185000}]}');

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
create function _to(p_kind text) returns text language sql security definer as $$
  select coalesce(string_agg(distinct right(r.user_id::text, 2), ','), '')
    from push_outbox o, lateral ow_push_recipients(o.id) r where o.kind = p_kind
$$;
grant execute on function _to to authenticated;

set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000d';
select _try('sales: may not read what waits on money', 'refused', $q$select * from store_money_holds('11111111-1111-1111-1111-111111111111')$q$);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000e';
select _try('check: the cash customer and the walk-in wait; the credit customer, the paid order and the agent''s do not', 'ok', $q$select _is($c$(select string_agg(id::text || ':' || owed::text, ',' order by id) from store_money_holds('11111111-1111-1111-1111-111111111111')) = '9554:185000,9557:40000'$c$)$q$);
select _try('store: loads the credit customer, the paid order and the agent''s', 'ok', $q$update saved_quotes set status='pending_delivery' where id in (9555,9556,9558)$q$);
select _try('store: may not load the unpaid cash customer', 'refused', $q$update saved_quotes set status='pending_delivery' where id=9554$q$);
select _try('store: may not hand the unpaid walk-in over at the gate', 'refused', $q$update saved_quotes set status='completed' where id=9557$q$);
select _try('store: asks the Manager to let it go on credit', 'ok', $q$update saved_quotes set payload = payload || '{"loadAsk":{"state":"sent","by":"00000000-0000-0000-0000-00000000000e","byName":"Musa Kiggundu","at":1}}' where id=9554$q$);
select _try('check: the Manager is pushed, with what is owed', 'ok', $q$select _is($c$_to('credit.ask') like '%0b%' and (select body from push_outbox where kind='credit.ask') like 'Musa has Ggaba Stores packed · owes 185,000 · cash customer%'$c$)$q$);
select _try('store: the same ask again pushes nobody twice', 'ok', $q$update saved_quotes set payload = payload || '{"note":"x"}' where id=9554$q$);
select _try('check: one push for one ask', 'ok', $q$select _is($c$(select count(*) from push_outbox where kind='credit.ask')=1$c$)$q$);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select _try('manager: cash first', 'ok', $q$update saved_quotes set payload = payload || '{"creditCheck":{"decision":"cash","byName":"Ruth Nakato","at":2}}' where id=9554$q$);
select _try('check: the Store person who asked hears it', 'ok', $q$select _is($c$_to('credit.ask.decided') = '0e' and (select title from push_outbox where kind='credit.ask.decided') = 'Cash first · keep it'$c$)$q$);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000e';
select _try('store: still may not load it after cash first', 'refused', $q$update saved_quotes set status='pending_delivery' where id=9554$q$);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select _try('manager: lets it go on credit', 'ok', $q$update saved_quotes set payload = payload || '{"creditCheck":{"decision":"release","byName":"Ruth Nakato","at":3}}' where id=9554$q$);
select _try('check: and the Store hears that too', 'ok', $q$select _is($c$(select count(*) from push_outbox where kind='credit.ask.decided')=2 and exists(select 1 from push_outbox where kind='credit.ask.decided' and title='On credit · load it')$c$)$q$);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000e';
select _try('check: it no longer waits', 'ok', $q$select _is($c$not exists(select 1 from store_money_holds('11111111-1111-1111-1111-111111111111') where id=9554)$c$)$q$);
select _try('store: loads it now', 'ok', $q$update saved_quotes set status='pending_delivery' where id=9554$q$);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select _try('manager: is not stopped by the gate', 'ok', $q$update saved_quotes set status='completed' where id=9557$q$);

reset role;
select case when (expect='ok' and got='ok') or (expect='refused' and got like 'refused%') then 'PASS' else 'FAIL' end, label, got from _r order by n;
