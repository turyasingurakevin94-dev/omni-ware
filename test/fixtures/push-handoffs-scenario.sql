-- The eleven pushes 0131 adds, asked of a real database: each handoff puts
-- one push in the outbox, for the task that decides it or the one person
-- who asked, never the owner and never the login that made the write.
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
insert into products(shop_id,id,name) values ('11111111-1111-1111-1111-111111111111','P1','Cement'),('11111111-1111-1111-1111-111111111111','P2','Iron bar');
insert into prices(id, shop_id, product_id, supplier_id, retail, unit, date) values
 (1,'11111111-1111-1111-1111-111111111111','P1','S1',30000,'bag','2026-08-01'),
 (2,'11111111-1111-1111-1111-111111111111','P2','S1',18000,'piece','2026-08-03'),
 (3,'11111111-1111-1111-1111-111111111111','P2','S2',17500,'piece',ow_today() - 29);
insert into app_settings(shop_id, presets) values ('11111111-1111-1111-1111-111111111111','{"priceReview":{"perDay":2}}')
 on conflict (shop_id) do update set presets = excluded.presets;
insert into customers(shop_id,id,name,debt,credit_limit) values ('11111111-1111-1111-1111-111111111111','C001','Kato Construction',500000,1000000);
insert into saved_quotes(id, shop_id, client_name, status, invoiced, payload) overriding system value values
 (9301,'11111111-1111-1111-1111-111111111111','Kyaligonza & Sons','completed',true,'{}'),
 (9302,'11111111-1111-1111-1111-111111111111','Kato Construction','draft',false,
  '{"takenBy":"00000000-0000-0000-0000-00000000000d","customerId":"C001","items":[{"productId":"P1","productName":"Cement","qty":20,"unit":"bags","price":30000,"supplierId":"S1"},{"productId":"P2","productName":"Iron bar","qty":4,"price":17500,"supplierId":"S2"}],"supplierConfirms":{"S1":{"state":"confirmed","terms":"P1::20:30000"},"S2":{"state":"confirmed","terms":"P2::4:17500"}}}');
insert into stock_reports(id, shop_id, key, product_id, name, qty, why, reported_by, reported_by_name, status) values
 ('cccccccc-0000-0000-0000-000000000009','11111111-1111-1111-1111-111111111111','P1','P1','Cement',2,'damaged','00000000-0000-0000-0000-00000000000e','Musa Kiggundu','sent');
insert into sourcing_leads(id, shop_id, name, status, requests) values
 ('L9','11111111-1111-1111-1111-111111111111','Roofing nails 3"','asked','[]');
insert into purchase_invoices(id, shop_id, quote_id, date, payload) values
 (7101,'11111111-1111-1111-1111-111111111111',null,current_date,
  json_build_object('supplierName','Namanve Sheets','dueDate',(ow_today() + 1)::text,'amountPaid',100000,
    'items',json_build_array(json_build_object('qty',10,'price',250000)))::jsonb),
 (7102,'11111111-1111-1111-1111-111111111111',null,current_date,
  json_build_object('supplierName','Paid Up Ltd','dueDate',(ow_today() + 1)::text,'amountPaid',50000,
    'items',json_build_array(json_build_object('qty',1,'price',50000)))::jsonb);

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

-- ---- a void ask, and its answer
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000d';
select _try('sales: asks to void INV-9301', 'ok', $q$insert into invoice_asks(id, shop_id, quote_id, kind, amount, reason, asked_by, asked_by_name, asked_role, status) values ('aaaaaaaa-0000-0000-0000-000000000009','11111111-1111-1111-1111-111111111111',9301,'void',640000,'wrong items','00000000-0000-0000-0000-00000000000d','Grace Akello','sales','sent')$q$);
select _try('check: the Manager is asked, nobody else', 'ok', $q$select _is($c$_to('invoice.ask')='0b' and _body('invoice.ask') = 'Grace asks to void INV-9301 · Kyaligonza & Sons · 640,000 — wrong items'$c$)$q$);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select _try('manager: voids it', 'ok', $q$select decide_invoice_ask('aaaaaaaa-0000-0000-0000-000000000009','accepted')$q$);
select _try('check: Grace is told who voided it', 'ok', $q$select _is($c$_to('invoice.ask.decided')='0d' and _body('invoice.ask.decided') = 'INV-9301 · Kyaligonza & Sons — voided by Ruth.'$c$)$q$);

-- ---- credit released, then the order needs buying
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select _try('manager: releases Kato''s credit', 'ok', $q$update saved_quotes set payload = payload || '{"creditCheck":{"decision":"release","byName":"Ruth Nakato","at":1}}' where id=9302$q$);
select _try('check: Grace is told the credit is released', 'ok', $q$select _is($c$_to('credit.decided')='0d' and _body('credit.decided') = 'Kato Construction — Ruth said yes; the order moves on.'$c$)$q$);
select _try('manager: moves it to Buying', 'ok', $q$update saved_quotes set status='awaiting_goods', payload = payload || '{"stageEnteredAt":2}' where id=9302$q$);
select _try('check: the Buyer is told what to buy, nobody else', 'ok', $q$select _is($c$_to('order.buying')='10' and _body('order.buying') = 'Kato Construction — 20 bags Cement from Nakawa Cement Depot · 1 more'$c$)$q$);
select _try('manager: saves the order again in Buying', 'ok', $q$update saved_quotes set payload = payload || '{"note":"x"}' where id=9302$q$);
select _try('check: no second buying push', 'ok', $q$select _is($c$(select count(*) from push_outbox where kind='order.buying')=1$c$)$q$);

-- ---- cash for a trip
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000010';
select _try('buyer: asks Accounts for cash', 'ok', $q$insert into buyer_handoffs(id, shop_id, kind, for_role, ref, payload) values ('dddddddd-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','trip_cash','accounts','run:S2:2026-10-17','{"supplierId":"S2","supplier":"Kiseka Steel","amount":1200000}')$q$);
select _try('check: Accounts is asked, nobody else', 'ok', $q$select _is($c$_to('trip.cash.ask')='0f' and _body('trip.cash.ask') = 'Denis — 1,200,000 for Kiseka Steel'$c$)$q$);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000f';
select _try('accounts: hands the cash over', 'ok', $q$update buyer_handoffs set status='done', done_by='00000000-0000-0000-0000-00000000000f', done_at=now() where id='dddddddd-0000-0000-0000-000000000001'$q$);
select _try('check: the Buyer is told to collect it', 'ok', $q$select _is($c$_to('trip.cash.ready')='10' and _body('trip.cash.ready') = '1,200,000 for Kiseka Steel — collect it from Esther'$c$)$q$);
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000010';
select _try('buyer: a second ask, then marks it in hand themselves', 'ok', $q$insert into buyer_handoffs(id, shop_id, kind, for_role, ref, payload) values ('dddddddd-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','trip_cash','accounts','run:S1:2026-10-17','{"supplierId":"S1","amount":300000}')$q$);
select _try('buyer: closes it', 'ok', $q$update buyer_handoffs set status='done', done_by='00000000-0000-0000-0000-000000000010', done_at=now() where id='dddddddd-0000-0000-0000-000000000002'$q$);
select _try('check: nobody is told the Buyer''s own close', 'ok', $q$select _is($c$(select count(*) from push_outbox where kind='trip.cash.ready')=1$c$)$q$);

-- ---- a report decided
reset role;
set request.jwt.claim.sub = '';
select _try('the Manager writes the report off', 'ok', $q$update stock_reports set status='written_off', decided_by='00000000-0000-0000-0000-00000000000b', decided_at=now() where id='cccccccc-0000-0000-0000-000000000009'$q$);
select _try('check: the Store person who reported it is told', 'ok', $q$select _is($c$_to('stock.report.decided')='0e' and _body('stock.report.decided') = '2 Cement written off by Ruth'$c$)$q$);

-- ---- Sourcing's requests
select _try('Grace asks for roofing nails', 'ok', $q$update sourcing_leads set requests = requests || '[{"at":"2026-10-17T11:20:00Z","source":"sourcing.ask","by":"00000000-0000-0000-0000-00000000000d","salesName":"Grace Akello","qty":200,"customerName":"Kato Construction"}]' where id='L9'$q$);
select _try('check: Sourcing is told, nobody else', 'ok', $q$select _is($c$_to('sourcing.request')='11' and _body('sourcing.request') = 'Grace asks for Roofing nails 3" · 200 for Kato Construction'$c$)$q$);
select _try('the lead is saved again, nothing new on it', 'ok', $q$update sourcing_leads set status='looking' where id='L9'$q$);
select _try('check: no second request push', 'ok', $q$select _is($c$(select count(*) from push_outbox where kind='sourcing.request')=1$c$)$q$);
select _try('a line dropped at Checking becomes a request', 'ok', $q$insert into sourcing_leads(id, shop_id, name, status, requests) values ('DRP-1','11111111-1111-1111-1111-111111111111','Waterproof cement','asked','[{"at":"2026-10-17T09:35:00Z","source":"dropped","reason":"Nobody has it","customerName":"Lubowa Builders","orderId":9302}]')$q$);
select _try('check: Sourcing is told why it was dropped', 'ok', $q$select _is($c$_to('sourcing.dropped')='11' and _body('sourcing.dropped') = 'Nobody has it: Waterproof cement · Lubowa Builders'$c$)$q$);

-- ---- the mornings
select _try('07:00: bills due tomorrow', 'ok', $q$select _is($c$ow_push_bills_due() = 1$c$)$q$);
select _try('check: Accounts is told the balance left, and not of a paid bill', 'ok', $q$select _is($c$_to('bill.due')='0f' and _body('bill.due') = 'Namanve Sheets — 2,400,000'$c$)$q$);
select _try('07:00 runs twice', 'ok', $q$select _is($c$ow_push_bills_due() = 1 and (select count(*) from push_outbox where kind='bill.due') = 1$c$)$q$);
select _try('08:00: the day''s prices', 'ok', $q$select _is($c$ow_push_prices_to_confirm() = 1$c$)$q$);
select _try('check: Sourcing alone, the oldest two, and whose', 'ok', $q$select _is($c$_to('prices.confirm')='11' and (select title from push_outbox where kind='prices.confirm') = '2 prices to confirm today' and _body('prices.confirm') = 'Oldest first — Nakawa Cement Depot has 2'$c$)$q$);
select _try('check: a price confirmed 29 days ago is not stale yet, so Kiseka is not in it', 'ok', $q$select _is($c$_body('prices.confirm') not like '%Kiseka%'$c$)$q$);
delete from push_outbox where kind = 'prices.confirm';
insert into shop_task_off(shop_id, role, task) values ('11111111-1111-1111-1111-111111111111','sourcing','price.confirm');
select _try('08:00 with Sourcing''s confirming switched off', 'ok', $q$select _is($c$ow_push_prices_to_confirm() = 0 and not exists(select 1 from push_outbox where kind='prices.confirm')$c$)$q$);
delete from shop_task_off;

-- ---- none of it reaches the owner
select _try('check: the owner gets none of these', 'ok', $q$select _is($c$not exists(select 1 from push_outbox o, lateral ow_push_recipients(o.id) r where r.user_id='00000000-0000-0000-0000-00000000000a')$c$)$q$);

reset role;
select case when (expect='ok' and got='ok') or (expect='refused' and got like 'refused%') then 'PASS' else 'FAIL' end, label, got from _r order by n;
