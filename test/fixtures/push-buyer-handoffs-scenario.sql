-- The four hand-offs 0132 adds, asked of a real database: each one the
-- Buyer passes on puts one push in the outbox, for the task that takes it
-- or the salesperson on the order, never the owner and never the Buyer.
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
insert into suppliers(shop_id, id, name) values
 ('11111111-1111-1111-1111-111111111111','S1','Nakawa Cement Depot'),('11111111-1111-1111-1111-111111111111','S2','Kiseka Steel');
insert into saved_quotes(id, shop_id, client_name, status, invoiced, payload) overriding system value values
 (9302,'11111111-1111-1111-1111-111111111111','Kato Construction','awaiting_goods',false,'{"takenBy":"00000000-0000-0000-0000-00000000000d"}'),
 (9303,'11111111-1111-1111-1111-111111111111','Ggaba Stores','awaiting_goods',false,'{}');


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

-- ---- a paper bill, to Accounts
select _try('buyer: passes on Kiseka''s paper bill', 'ok', $q$insert into buyer_handoffs(id, shop_id, kind, for_role, ref, payload) values ('eeeeeeee-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','paper_bill','accounts','S2','{"supplierId":"S2","supplier":"Kiseka Steel","billNo":"0417","total":2400000}')$q$);
select _try('check: Accounts is told, nobody else', 'ok', $q$select _is($c$_to('bill.paper')='0f' and _body('bill.paper') = 'Kiseka Steel — bill 0417 · 2,400,000 · from Denis'$c$)$q$);
select _try('check: the push names the supplier for the tap', 'ok', $q$select _is($c$(select ref ->> 'supplierId' from push_outbox where kind='bill.paper') = 'S2'$c$)$q$);

-- ---- details to fix, to Sourcing
select _try('buyer: passes on two fixes for Nakawa', 'ok', $q$insert into buyer_handoffs(id, shop_id, kind, for_role, ref, payload) values ('eeeeeeee-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','sourcing_fix','sourcing','S1','{"supplierId":"S1","how":"phone","fixes":[{"k":"price"},{"k":"unit"}]}')$q$);
select _try('check: Sourcing is told, with the supplier''s name from the list', 'ok', $q$select _is($c$_to('sourcing.fix')='11' and _body('sourcing.fix') = 'Nakawa Cement Depot — 2 fixes from Denis. Check each one.'$c$)$q$);

-- ---- an item switched, to the salesperson on the order
select _try('buyer: switches a line on Kato''s order', 'ok', $q$insert into buyer_handoffs(id, shop_id, kind, for_role, ref, payload) values ('eeeeeeee-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','item_switch','sales','9302','{"orderId":9302,"client":"Kato Construction","from":"Cement 50kg","to":"Cement 25kg","why":"out of stock"}')$q$);
select _try('check: Grace, who took the order, is told', 'ok', $q$select _is($c$_to('item.switch')='0d' and _body('item.switch') = 'Kato Construction — Cement 50kg → Cement 25kg (out of stock). Tell them.'$c$)$q$);
select _try('check: the push carries the order for the tap', 'ok', $q$select _is($c$(select ref ->> 'orderId' from push_outbox where kind='item.switch') = '9302'$c$)$q$);
select _try('buyer: switches a line on an order nobody took', 'ok', $q$insert into buyer_handoffs(id, shop_id, kind, for_role, ref, payload) values ('eeeeeeee-0000-0000-0000-000000000004','11111111-1111-1111-1111-111111111111','item_switch','sales','9303','{"orderId":9303,"from":"Iron bar 12mm","to":"Iron bar 10mm"}')$q$);
select _try('check: then Sales is told, by task, with the client from the order', 'ok', $q$select _is($c$(select string_agg(distinct right(r.user_id::text, 2), ',') from push_outbox o, lateral ow_push_recipients(o.id) r where o.dedupe = 'switch:eeeeeeee-0000-0000-0000-000000000004')='0d' and _body('item.switch') like '%| Ggaba Stores — Iron bar 12mm → Iron bar 10mm. Tell them.'$c$)$q$);

-- ---- a note on the yard's count, to the Manager
select _try('buyer: says why the count differs', 'ok', $q$insert into buyer_handoffs(id, shop_id, kind, for_role, ref, payload) values ('eeeeeeee-0000-0000-0000-000000000005','11111111-1111-1111-1111-111111111111','yard_note','manager','T7','{"tripId":"T7","supplierId":"S2","why":"short","words":"the supplier gave fewer","lines":[{"lineId":"a"}]}')$q$);
select _try('check: the Manager is told, nobody else', 'ok', $q$select _is($c$_to('trip.yard_note')='0b' and _body('trip.yard_note') = 'From Kiseka Steel — Denis: the supplier gave fewer · 1 line'$c$)$q$);
select _try('check: the push carries the trip for the tap', 'ok', $q$select _is($c$(select ref ->> 'tripId' from push_outbox where kind='trip.yard_note') = 'T7'$c$)$q$);

-- ---- once each, and never back to the Buyer
select _try('buyer: withdraws the yard note', 'ok', $q$update buyer_handoffs set status='withdrawn' where id='eeeeeeee-0000-0000-0000-000000000005'$q$);
select _try('check: nothing more is sent', 'ok', $q$select _is($c$(select count(*) from push_outbox where kind='trip.yard_note')=1$c$)$q$);
select _try('buyer: asks for trip cash', 'ok', $q$insert into buyer_handoffs(id, shop_id, kind, for_role, ref, payload) values ('eeeeeeee-0000-0000-0000-000000000006','11111111-1111-1111-1111-111111111111','trip_cash','accounts','run:S2','{"supplierId":"S2","amount":100000}')$q$);
select _try('check: trip cash is still 0131''s alone, one push not two', 'ok', $q$select _is($c$(select count(*) from push_outbox where kind like 'trip.cash%')=1$c$)$q$);
select _try('check: the Buyer is never pushed about their own hand-offs', 'ok', $q$select _is($c$not exists(select 1 from push_outbox o, lateral ow_push_recipients(o.id) r where o.kind in ('bill.paper','sourcing.fix','item.switch','trip.yard_note') and r.user_id='00000000-0000-0000-0000-000000000010')$c$)$q$);
reset role;
insert into shop_task_off(shop_id, role, task) values ('11111111-1111-1111-1111-111111111111','accounts','bill.record');
set role authenticated;
select _try('buyer: another paper bill, with Accounts'' recording switched off', 'ok', $q$insert into buyer_handoffs(id, shop_id, kind, for_role, ref, payload) values ('eeeeeeee-0000-0000-0000-000000000007','11111111-1111-1111-1111-111111111111','paper_bill','accounts','S1','{"supplierId":"S1","total":10}')$q$);
select _try('check: it reaches nobody', 'ok', $q$select _is($c$exists(select 1 from push_outbox where dedupe='paperbill:eeeeeeee-0000-0000-0000-000000000007') and not exists(select 1 from push_outbox o, lateral ow_push_recipients(o.id) r where o.dedupe='paperbill:eeeeeeee-0000-0000-0000-000000000007')$c$)$q$);
select _try('check: the owner gets none of these', 'ok', $q$select _is($c$not exists(select 1 from push_outbox o, lateral ow_push_recipients(o.id) r where r.user_id='00000000-0000-0000-0000-00000000000a')$c$)$q$);

reset role;
select case when (expect='ok' and got='ok') or (expect='refused' and got like 'refused%') then 'PASS' else 'FAIL' end, label, got from _r order by n;
