-- 0180 asked of a real database (docs/spec/05-data.md §8 Q3, §9 Q6): Sales
-- places an order through place_order, in one write, and every guard on
-- saved_quotes still judges it as the caller.
grant all on all tables in schema public to authenticated;
grant all on all sequences in schema public to authenticated;
insert into auth.users values
 ('00000000-0000-0000-0000-00000000000a','owner@x'),('00000000-0000-0000-0000-00000000000b','manager@x'),
 ('00000000-0000-0000-0000-00000000000c','buyer@x'),('00000000-0000-0000-0000-00000000000d','grace@x'),
 ('00000000-0000-0000-0000-00000000000e','store@x'),('00000000-0000-0000-0000-00000000000f','worker@x'),
 ('00000000-0000-0000-0000-000000000010','stranger@x');
insert into shops(id, name, created_by) values ('11111111-1111-1111-1111-111111111111','Omni-ware','00000000-0000-0000-0000-00000000000a');
insert into shop_members(shop_id,user_id,role,display_name) values
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000a','owner','Kevin'),
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000b','manager','Ruth Nakato'),
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000c','buyer','Musa Okello'),
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000d','sales','Grace Akello'),
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000e','store','Peter Ssali'),
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000f','staff','Joseph');
insert into app_settings(shop_id, presets) values ('11111111-1111-1111-1111-111111111111','{"creditPct":3,"chaseAfterDays":30}')
 on conflict (shop_id) do update set presets = excluded.presets;
insert into customers(shop_id,id,name,phone,debt) values ('11111111-1111-1111-1111-111111111111','C1','Ken','0772000001',0);
-- The highest order so far is #0700, so the next is #0701.
set session_replication_role = replica;
insert into saved_quotes(id, shop_id, client_name, date, status, payload) overriding system value values
 (700,'11111111-1111-1111-1111-111111111111','Old',ow_today(),'completed','{"payments":[],"items":[]}');
set session_replication_role = origin;

create table _r(n serial, label text, expect text, got text);
create table _out(k text, r jsonb);
create function _try(label text, expect text, q text) returns void language plpgsql as $$
declare got text := 'ok';
begin
  begin execute q;
  exception when others then got := 'refused: ' || sqlstate || ' ' || sqlerrm; end;
  insert into _r(label, expect, got) values (label, expect, got);
end $$;
grant all on _r, _r_n_seq, _out to authenticated; grant execute on function _try to authenticated;
create function _is(cond_sql text) returns void language plpgsql security definer as $$
declare ok boolean;
begin execute 'select (' || cond_sql || ')' into ok;
  if not coalesce(ok, false) then raise exception 'not so: %', cond_sql; end if; end $$;
grant execute on function _is to authenticated;
-- The order a key in _out names.
create function _o(k text) returns saved_quotes language sql security definer as $$
  select q.* from saved_quotes q where q.id = (select (r ->> 'id')::bigint from _out where _out.k = $1) $$;
grant execute on function _o to authenticated;

-- An order: Cement from supplier S1 at the shop's price, for Ken.
create function _row(extra jsonb default '{}', status text default 'draft') returns jsonb language sql as $$
  select jsonb_build_object('client_name', 'Ken', 'client_phone', '0772000001', 'status', status, 'payload',
    jsonb_build_object('client', jsonb_build_object('name', 'Ken', 'phone', '0772000001'), 'customerId', 'C1', 'charges', '[]'::jsonb, 'credit', null,
      'items', '[{"lineId":1,"productId":"P1","productName":"Cement","qty":2,"price":30000,"sellPrice":35000,"supplierId":"S1","supplierName":"Hima"}]'::jsonb) || extra) $$;
grant execute on function _row to authenticated;
-- Shelf goods only.
create function _shelf() returns jsonb language sql as $$
  select '{"items":[{"lineId":1,"productId":"P2","productName":"Wood glue","qty":1,"price":15000,"sellPrice":18500,"supplierId":"__stock__","supplierName":"Our shelf"}]}'::jsonb $$;
grant execute on function _shelf to authenticated;

set role authenticated;
-- ---------------- who may place an order: quote.make (Sales; the owner holds every task)
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000e';
select _try('store: places an order', 'refused:42501', $q$select place_order('11111111-1111-1111-1111-111111111111', _row())$q$);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000f';
select _try('yard worker: places an order', 'refused:42501', $q$select place_order('11111111-1111-1111-1111-111111111111', _row())$q$);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
select _try('buyer: places an order', 'refused:42501', $q$select place_order('11111111-1111-1111-1111-111111111111', _row())$q$);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select _try('manager (no quote.make): places an order', 'refused:42501', $q$select place_order('11111111-1111-1111-1111-111111111111', _row())$q$);
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000010';
select _try('not a member: places an order', 'refused:42501', $q$select place_order('11111111-1111-1111-1111-111111111111', _row())$q$);
set request.jwt.claim.sub = '';
select _try('no login: places an order', 'refused:42501', $q$select place_order('11111111-1111-1111-1111-111111111111', _row())$q$);
select _try('check: none of those placed anything', 'ok', $q$select _is($c$(select count(*) from saved_quotes) = 1$c$)$q$);

-- ---------------- the order, as sales.html inserts it
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000d';
select _try('grace: places Ken''s order in Checking', 'ok', $q$insert into _out select 'a', place_order('11111111-1111-1111-1111-111111111111', _row())$q$);
select _try('check: it is #0701, and says so', 'ok', $q$select _is($c$(select r ->> 'id' = '701' and r ->> 'number' = '#0701' and r ->> 'status' = 'draft' and r ->> 'again' = 'false' and r ->> 'ok' = 'true' from _out where k = 'a')$c$)$q$);
select _try('check: the row as sales.html writes it (client, date, Checking, nothing paid, not invoiced)', 'ok', $q$select _is($c$(select client_name = 'Ken' and client_phone = '0772000001' and date = ow_today() and status = 'draft' and not invoiced and not voided and amount_paid = 0 and invoiced_at is null and not qa from _o('a'))$c$)$q$);
select _try('check: the payload as sales.html writes it (lines, customer, taken by Grace, stage log, no payments)', 'ok', $q$select _is($c$(select payload -> 'items' -> 0 ->> 'productName' = 'Cement' and payload ->> 'customerId' = 'C1' and payload ->> 'takenBy' = '00000000-0000-0000-0000-00000000000d' and payload -> 'payments' = '[]' and (payload ->> 'debtCharged')::numeric = 0 and payload -> 'stageLog' -> 0 ->> 'status' = 'draft' and (payload ->> 'stageEnteredAt')::numeric > 0 and payload ->> 'createdAt' = payload ->> 'savedAt' and payload -> 'client' ->> 'name' = 'Ken' and payload -> 'credit' = 'null' and payload -> 'charges' = '[]' from _o('a'))$c$)$q$);
select _try('grace: the next order takes the next number', 'ok', $q$insert into _out select 'b', place_order('11111111-1111-1111-1111-111111111111', _row())$q$);
-- (0017's sync_saved_quotes_id_seq takes a nextval on every insert, so each order, however placed, uses up one number more.)
select _try('check: a higher number, from the same row:saved_quote counter', 'ok', $q$select _is($c$(select (r ->> 'id')::bigint > 701 and r ->> 'number' = '#' || lpad(r ->> 'id', 4, '0') from _out where k = 'b') and (select last_issued from entity_id_counters where kind = 'row:saved_quote') >= (select (r ->> 'id')::bigint from _out where k = 'b')$c$)$q$);
select _try('grace: a walk-in, no name, no customer', 'ok', $q$insert into _out select 'walkin', place_order('11111111-1111-1111-1111-111111111111', jsonb_build_object('payload', _shelf()))$q$);
select _try('check: named Walk-in, no customer, no phone', 'ok', $q$select _is($c$(select client_name = 'Walk-in' and client_phone is null and payload -> 'customerId' = 'null' and payload -> 'client' ->> 'name' = 'Walk-in' from _o('walkin'))$c$)$q$);
select _try('grace: a customer not in the books', 'refused:P0002', $q$select place_order('11111111-1111-1111-1111-111111111111', _row('{"customerId":"C404"}'))$q$);
select _try('grace: only what Sales decides is taken; paid, invoiced, a credit yes and suppliers'' yes are the server''s', 'ok', $q$insert into _out select 'sneaky', place_order('11111111-1111-1111-1111-111111111111', _row('{"invoiced":true,"creditCheck":{"decision":"release"},"supplierConfirms":{"S1":{"state":"confirmed"}},"payments":[{"id":1,"amount":5000}],"takenBy":"00000000-0000-0000-0000-00000000000b","originAgentId":"A1","deliverTo":"Ntinda site","waConvId":42}'))$q$);
select _try('check: none of those rode in; where it goes and the chat did', 'ok', $q$select _is($c$(select not invoiced and amount_paid = 0 and payload -> 'payments' = '[]' and not payload ? 'invoiced' and not payload ? 'creditCheck' and not payload ? 'supplierConfirms' and not payload ? 'originAgentId' and payload ->> 'takenBy' = '00000000-0000-0000-0000-00000000000d' and payload ->> 'deliverTo' = 'Ntinda site' and (payload ->> 'waConvId')::int = 42 from _o('sneaky'))$c$)$q$);

-- ---------------- where it starts (0119, 0173, 0174)
select _try('grace: shelf goods only, placed in Packing', 'ok', $q$insert into _out select 'pack', place_order('11111111-1111-1111-1111-111111111111', _row(_shelf(), 'preparing'))$q$);
select _try('check: it is in Packing', 'ok', $q$select _is($c$(select status = 'preparing' and r ->> 'status' = 'preparing' from _o('pack'), _out where k = 'pack')$c$)$q$);
select _try('grace: shelf goods only, placed in Checking: 0119 sends it on to Packing', 'ok', $q$insert into _out select 'shelf', place_order('11111111-1111-1111-1111-111111111111', _row(_shelf()))$q$);
select _try('check: in Packing, the stage log says the shelf moved it', 'ok', $q$select _is($c$(select status = 'preparing' and payload -> 'stageLog' -> -1 ->> 'shelf' = 'true' from _o('shelf'))$c$)$q$);
select _try('grace: a supplier''s goods placed in Packing', 'ok', $q$insert into _out select 'held', place_order('11111111-1111-1111-1111-111111111111', _row('{}', 'preparing'))$q$);
select _try('check: 0174 keeps it in Checking until the supplier says yes', 'ok', $q$select _is($c$(select status = 'draft' and payload -> 'gateHeldMove' ->> 'why' = 'suppliers' and payload -> 'gateHeldMove' ->> 'to' = 'preparing' and r ->> 'status' = 'draft' from _o('held'), _out where k = 'held')$c$)$q$);
select _try('grace: placed in Buying', 'refused:22023', $q$select place_order('11111111-1111-1111-1111-111111111111', _row('{}', 'awaiting_goods'))$q$);
select _try('grace: placed as Delivered', 'refused:22023', $q$select place_order('11111111-1111-1111-1111-111111111111', _row('{}', 'completed'))$q$);
select _try('grace: placed cancelled', 'refused:22023', $q$select place_order('11111111-1111-1111-1111-111111111111', _row('{}', 'cancelled'))$q$);
select _try('grace: nothing on it', 'refused:22023', $q$select place_order('11111111-1111-1111-1111-111111111111', _row('{"items":[]}'))$q$);
select _try('grace: no order at all', 'refused:22023', $q$select place_order('11111111-1111-1111-1111-111111111111', '{"status":"draft"}')$q$);

-- ---------------- on credit: the Credit charge is the shop's (0167 holds a customer with no limit)
select _try('grace: Ken on credit, the phone saying 0%', 'ok', $q$insert into _out select 'credit', place_order('11111111-1111-1111-1111-111111111111', _row('{"credit":{"pct":0,"days":14}}', 'preparing'))$q$);
select _try('check: the shop''s 3%, Ken''s 14 days, agreed today; held for the Manager (no limit set)', 'ok', $q$select _is($c$(select (payload -> 'credit' ->> 'pct')::numeric = 3 and (payload -> 'credit' ->> 'days')::numeric = 14 and payload -> 'credit' ->> 'agreedAt' = ow_today()::text and status = 'draft' and payload -> 'gateHeldMove' ->> 'why' = 'credit' from _o('credit'))$c$)$q$);
select _try('check: the Manager is pushed the credit hold', 'ok', $q$select _is($c$exists(select 1 from push_outbox where kind = 'credit.hold' and ref ->> 'id' = (select r ->> 'id' from _out where k = 'credit'))$c$)$q$);
select _try('grace: on credit with no days says the shop''s chase days', 'ok', $q$insert into _out select 'credit2', place_order('11111111-1111-1111-1111-111111111111', _row('{"credit":{}}'))$q$);
select _try('check: 30 days', 'ok', $q$select _is($c$(select (payload -> 'credit' ->> 'days')::numeric = 30 and (payload -> 'credit' ->> 'pct')::numeric = 3 from _o('credit2'))$c$)$q$);

-- ---------------- every guard on saved_quotes still fires
select _try('grace: a price under the shop''s waits for the Manager (price.waits pushed)', 'ok', $q$insert into _out select 'under', place_order('11111111-1111-1111-1111-111111111111', _row('{"items":[{"lineId":1,"productId":"P1","productName":"Cement","qty":2,"price":30000,"sellPrice":32000,"supplierId":"S1","priceBy":"00000000-0000-0000-0000-00000000000d","priceNote":"under","priceShop":35000}]}'))$q$);
select _try('check: the Manager is pushed the price', 'ok', $q$select _is($c$exists(select 1 from push_outbox where kind = 'price.waits' and to_task = 'price.approve' and ref ->> 'id' = (select r ->> 'id' from _out where k = 'under'))$c$)$q$);
select _try('grace: a price under the cost (0171)', 'refused:OWCST', $q$select place_order('11111111-1111-1111-1111-111111111111', _row('{"items":[{"lineId":1,"productId":"P1","productName":"Cement","qty":2,"price":30000,"sellPrice":29000,"supplierId":"S1"}]}'))$q$);
select _try('grace: a count below 0 (0165)', 'refused:OWQTY', $q$select place_order('11111111-1111-1111-1111-111111111111', _row('{"items":[{"lineId":1,"productId":"P1","productName":"Cement","qty":-2,"price":30000,"sellPrice":35000,"supplierId":"S1"}]}'))$q$);
select _try('grace: her own price decision on a line (0119, 0175)', 'refused:42501', $q$select place_order('11111111-1111-1111-1111-111111111111', _row('{"items":[{"lineId":1,"productId":"P1","productName":"Cement","qty":2,"price":30000,"sellPrice":32000,"supplierId":"S1","priceBy":"00000000-0000-0000-0000-00000000000d","priceNote":"under","priceReview":{"state":"approved","price":32000,"qty":2}}]}'))$q$);
select _try('grace: a TEST customer''s order is a test record (0167)', 'ok', $q$insert into _out select 'qa', place_order('11111111-1111-1111-1111-111111111111', _row('{"client":{"name":"TEST Ken"},"customerId":null}') - 'client_name')$q$);
select _try('check: marked qa', 'ok', $q$select _is($c$(select qa and client_name = 'TEST Ken' from _o('qa'))$c$)$q$);
select _try('check: a refused order leaves nothing behind', 'ok', $q$select _is($c$(select count(*) from saved_quotes) = 1 + (select count(*) from _out)$c$)$q$);

-- ---------------- placed once: the same key again is the same order
select _try('grace: places with the draft''s key', 'ok', $q$insert into _out select 'k1', place_order('11111111-1111-1111-1111-111111111111', _row(), 'draft-7f3a')$q$);
select _try('grace: the same again (signal lost before the answer)', 'ok', $q$insert into _out select 'k2', place_order('11111111-1111-1111-1111-111111111111', _row(), 'draft-7f3a')$q$);
select _try('check: one order, the second answer names it and says again', 'ok', $q$select _is($c$(select count(*) from saved_quotes where payload ->> 'placeKey' = 'draft-7f3a') = 1 and (select r ->> 'id' from _out where k = 'k1') = (select r ->> 'id' from _out where k = 'k2') and (select r ->> 'again' from _out where k = 'k2') = 'true'$c$)$q$);
select _try('grace: another draft''s key places another order', 'ok', $q$insert into _out select 'k3', place_order('11111111-1111-1111-1111-111111111111', _row(), 'draft-9c1b')$q$);
select _try('check: two keyed orders', 'ok', $q$select _is($c$(select count(*) from saved_quotes where payload ? 'placeKey') = 2$c$)$q$);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select _try('owner: places an order (holds every task)', 'ok', $q$insert into _out select 'owner', place_order('11111111-1111-1111-1111-111111111111', _row())$q$);
select _try('check: taken by the owner', 'ok', $q$select _is($c$(select payload ->> 'takenBy' = '00000000-0000-0000-0000-00000000000a' from _o('owner'))$c$)$q$);
reset role;

select case when (expect = 'ok' and got = 'ok') or (expect like 'refused:%' and got like 'refused: ' || substr(expect, 9) || '%') then 'PASS' else 'FAIL' end, label, got from _r order by n;
