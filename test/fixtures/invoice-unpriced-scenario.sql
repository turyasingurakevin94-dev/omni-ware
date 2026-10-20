-- 0138, asked of a real database: a delivered order with a line still to
-- price is never invoiced (by the Manager's button or the hourly run), a
-- generic name is never made a debtor, and the hourly run tells the
-- Manager what it skipped. The shape is Q-0541's (19 Oct 2026).
grant all on all tables in schema public to authenticated;
grant all on all sequences in schema public to authenticated;
insert into auth.users values
 ('00000000-0000-0000-0000-00000000000a','owner@x'),('00000000-0000-0000-0000-00000000000b','manager@x'),
 ('00000000-0000-0000-0000-00000000000d','sales@x');
insert into shops(id, name, created_by) values ('11111111-1111-1111-1111-111111111111','Mukasa Hardware','00000000-0000-0000-0000-00000000000a');
insert into shop_members(shop_id,user_id,role) values
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000a','owner'),
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000b','manager'),
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000d','sales');
insert into staff(shop_id,id,name,role,user_id) values
 ('11111111-1111-1111-1111-111111111111','W1','Ruth Nakato','manager','00000000-0000-0000-0000-00000000000b'),
 ('11111111-1111-1111-1111-111111111111','W2','Grace Akello','sales','00000000-0000-0000-0000-00000000000d');
-- No default markup: a product with no markup of its own has no selling price.
insert into app_settings(shop_id, presets) values ('11111111-1111-1111-1111-111111111111','{}')
 on conflict (shop_id) do update set presets = excluded.presets;
insert into suppliers(shop_id, id, name) values ('11111111-1111-1111-1111-111111111111','S1','Maria Building Materials'),('11111111-1111-1111-1111-111111111111','S2','Karddia');
update suppliers set terms_days = 14 where id = 'S2';
insert into products(shop_id,id,name) values
 ('11111111-1111-1111-1111-111111111111','P1','BB Silicone'),('11111111-1111-1111-1111-111111111111','P2','MEGGO Handles');
insert into prices(id, shop_id, product_id, supplier_id, retail, unit) values
 (1,'11111111-1111-1111-1111-111111111111','P1','S1',40000,'piece'),
 (2,'11111111-1111-1111-1111-111111111111','P2','S1',10000,'piece');
insert into customers(shop_id,id,name,debt,credit_limit,terms_days) values
 ('11111111-1111-1111-1111-111111111111','C001','Kato Construction',0,5000000,30);

insert into saved_quotes(id, shop_id, client_name, status, invoiced, amount_paid, payload) overriding system value values
 -- Q-0541's shape: a priced line and a line to price, paid for the priced one only
 (9501,'11111111-1111-1111-1111-111111111111','Walk-in','completed',false,50000,
  json_build_object('client', json_build_object('name','Walk-in'), 'deliveredAt', (now() - interval '30 hours')::text, 'items', json_build_array(
    json_build_object('productId','P1','productName','BB Silicone','qty',1,'price',40000,'sellPrice',50000,'unit','piece','supplierId','S1'),
    json_build_object('productId','P2','productName','MEGGO Handles','qty',2,'price',10000,'unit','piece','supplierId','S1')))::jsonb),
 -- a walk-in, all priced, part paid
 (9502,'11111111-1111-1111-1111-111111111111','Walk-in','completed',false,20000,
  json_build_object('client', json_build_object('name','Walk-in'), 'deliveredAt', (now() - interval '30 hours')::text, 'items', json_build_array(
    json_build_object('productId','P1','productName','BB Silicone','qty',1,'price',40000,'sellPrice',50000,'unit','piece','supplierId','S1')))::jsonb),
 -- a walk-in, all priced, paid in full
 (9503,'11111111-1111-1111-1111-111111111111','Walk-in','completed',false,50000,
  json_build_object('client', json_build_object('name','Walk-in'), 'deliveredAt', (now() - interval '30 hours')::text, 'items', json_build_array(
    json_build_object('productId','P1','productName','BB Silicone','qty',1,'price',40000,'sellPrice',50000,'unit','piece','supplierId','S1')))::jsonb),
 -- a known customer on credit
 (9504,'11111111-1111-1111-1111-111111111111','Kato Construction','completed',false,0,
  json_build_object('client', json_build_object('name','Kato Construction'), 'customerId','C001', 'deliveredAt', (now() - interval '2 hours')::text, 'items', json_build_array(
    json_build_object('productId','P1','productName','BB Silicone','qty',1,'price',40000,'sellPrice',50000,'unit','piece','supplierId','S1')))::jsonb),
 -- fix 4: Maria's bill recorded on the console before invoicing, and a Karddia line too
 (9507,'11111111-1111-1111-1111-111111111111','Kato Construction','completed',false,0,
  json_build_object('client', json_build_object('name','Kato Construction'), 'customerId','C001', 'deliveredAt', (now() - interval '2 hours')::text, 'items', json_build_array(
    json_build_object('productId','P1','productName','BB Silicone','qty',1,'price',40000,'sellPrice',50000,'unit','piece','supplierId','S1'),
    json_build_object('productId','P2','productName','MEGGO Handles','qty',1,'price',10000,'sellPrice',13000,'unit','piece','supplierId','S2')))::jsonb),
 -- a short line settled to nothing, still with no price: not a line to bill
 (9506,'11111111-1111-1111-1111-111111111111','Walk-in','completed',false,50000,
  json_build_object('client', json_build_object('name','Walk-in'), 'deliveredAt', (now() - interval '30 hours')::text, 'items', json_build_array(
    json_build_object('productId','P1','productName','BB Silicone','qty',1,'price',40000,'sellPrice',50000,'unit','piece','supplierId','S1'),
    json_build_object('productId','P2','productName','Glass Door Locks','qty',0,'price',0,'unit','piece','supplierId','')))::jsonb);

insert into purchase_invoices(id, shop_id, quote_id, date, payload) values
 (7001,'11111111-1111-1111-1111-111111111111',9507,current_date,
  '{"supplierId":"S1","supplierName":"Maria Building Materials","customerName":"Kato Construction","items":[{"productId":"P1","productName":"BB Silicone","qty":1,"price":40000}],"amountPaid":0,"payments":[],"voided":false}');

create table _r(n serial, label text, expect text, got text);
create function _try(label text, expect text, q text) returns void language plpgsql as $$
declare got text := 'ok';
begin
  begin execute q;
  exception when others then got := 'refused: ' || sqlstate || ' ' || sqlerrm; end;
  insert into _r(label, expect, got) values (label, expect, got);
end $$;
grant all on _r, _r_n_seq to authenticated; grant execute on function _try to authenticated;
create function _is(cond_sql text) returns void language plpgsql security definer as $$
declare ok boolean;
begin execute 'select (' || cond_sql || ')' into ok;
  if not coalesce(ok, false) then raise exception 'not so: %', cond_sql; end if; end $$;
grant execute on function _is to authenticated;

-- ---- what counts as nobody, and as a line to price
select _try('check: generic names are nobody', 'ok', $q$select _is($c$ow_generic_client('Walk-in') and ow_generic_client(' walk in ') and ow_generic_client('WALKIN') and ow_generic_client('Cash sale') and ow_generic_client('') and ow_generic_client(null) and ow_generic_client('Counter')$c$)$q$);
select _try('check: a real name is somebody', 'ok', $q$select _is($c$not ow_generic_client('Kato Construction') and not ow_generic_client('Hajat @Faluk') and not ow_generic_client('Cashew Traders') and not ow_generic_client('Walker Hardware')$c$)$q$);
select _try('check: a line the client waits for (no supplier yet) is not a line to price', 'ok', $q$select _is($c$ow_order_unpriced('11111111-1111-1111-1111-111111111111', '[{"productId":"P2","qty":5,"price":0,"supplierId":"","clientWaits":{"at":1760900000000,"by":"x"}}]', '{}') = 0 and ow_order_unpriced('11111111-1111-1111-1111-111111111111', '[{"productId":"P2","qty":5,"price":0,"supplierId":""}]', '{}') = 1$c$)$q$);
select _try('check: Q-0541''s shape has one line to price; a settled zero line is none', 'ok', $q$select _is($c$ow_order_unpriced('11111111-1111-1111-1111-111111111111', (select payload->'items' from saved_quotes where id=9501), '{}') = 1 and ow_order_unpriced('11111111-1111-1111-1111-111111111111', (select payload->'items' from saved_quotes where id=9506), '{}') = 0$c$)$q$);

-- ---- the Manager's Invoice button
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select _try('manager: invoice an order with a line still to price', 'refused: OWTPC', $q$select invoice_order('11111111-1111-1111-1111-111111111111', 9501)$q$);
select _try('manager: invoice a walk-in that leaves money owed', 'refused: OWWLK', $q$select invoice_order('11111111-1111-1111-1111-111111111111', 9502)$q$);
select _try('manager: invoice Kato''s order on credit', 'ok', $q$select invoice_order('11111111-1111-1111-1111-111111111111', 9504)$q$);
select _try('manager: invoice an order with Maria''s bill already on file (fix 4)', 'ok', $q$select _is($c$(select r->'bills' @> '[7001]'::jsonb and jsonb_array_length(r->'bills') = 2 from (select invoice_order('11111111-1111-1111-1111-111111111111', 9507) r) x)$c$)$q$);
reset role;
select _try('check: Maria''s bill is kept, Karddia gets one, one bill per supplier', 'ok', $q$select _is($c$(select count(*) = 2 and count(distinct payload->>'supplierId') = 2 from purchase_invoices where quote_id = 9507) and exists(select 1 from purchase_invoices where id = 7001 and quote_id = 9507)$c$)$q$);
select _try('check: Karddia''s new bill is due on their 14 days'' terms (fix 10)', 'ok', $q$select _is($c$(select (payload->>'dueDate')::date = date + 14 from purchase_invoices where quote_id = 9507 and payload->>'supplierId' = 'S2')$c$)$q$);
select _try('check: nothing of 9501 or 9502 was written: not invoiced, no bills', 'ok', $q$select _is($c$not (select invoiced from saved_quotes where id=9501) and not (select invoiced from saved_quotes where id=9502) and not exists(select 1 from purchase_invoices where quote_id in (9501,9502))$c$)$q$);
select _try('check: Kato owes the 50,000 and the 63,000', 'ok', $q$select _is($c$(select debt from customers where id='C001') = 113000$c$)$q$);

-- ---- the hourly run (pg_cron: no login)
set request.jwt.claim.sub = '';
select _try('the 24-hour run', 'ok', $q$select _is($c$(select (r->>'invoiced')::int = 2 and jsonb_array_length(r->'skipped') = 2 and (select string_agg(e->>'id' || ':' || (e->>'code'), ',' order by e->>'id') from jsonb_array_elements(r->'skipped') e) = '9501:OWTPC,9502:OWWLK' from (select ow_invoice_due_orders() r) x)$c$)$q$);
select _try('check: the paid walk-in and the settled zero line are invoiced', 'ok', $q$select _is($c$(select invoiced from saved_quotes where id=9503) and (select invoiced from saved_quotes where id=9506)$c$)$q$);
select _try('check: no customer called Walk-in was made, and nobody owes for a walk-in', 'ok', $q$select _is($c$not exists(select 1 from customers where ow_generic_client(name)) and (select count(*) from customers) = 1$c$)$q$);
select _try('check: the Manager is told of each skipped order, by the task that clears it', 'ok', $q$select _is($c$(select string_agg((ref->>'id') || ':' || to_task, ',' order by ref->>'id') from push_outbox where kind='invoice.held') = '9501:price.approve,9502:invoice.make' and (select string_agg(distinct right(r.user_id::text, 2), ',') from push_outbox o, lateral ow_push_recipients(o.id) r where o.kind='invoice.held') = '0b'$c$)$q$);
select _try('check: the push says why', 'ok', $q$select _is($c$(select body from push_outbox where kind='invoice.held' and ref->>'id'='9501') like 'Walk-in — 1 line on INV-9501 still has no selling price%'$c$)$q$);
select _try('the 24-hour run again, the same day', 'ok', $q$select ow_invoice_due_orders()$q$);
select _try('check: told once a day, not every hour', 'ok', $q$select _is($c$(select count(*) from push_outbox where kind='invoice.held') = 2$c$)$q$);

-- ---- priced, it goes
-- The Manager prices MEGGO at 13,000; the customer pays the 26,000 for it.
update saved_quotes set payload = jsonb_set(payload, '{items,1,sellPrice}', '13000'), amount_paid = 76000 where id = 9501;
select _try('the next run, once the line is priced', 'ok', $q$select _is($c$(select (r->>'invoiced')::int = 1 from (select ow_invoice_due_orders() r) x)$c$)$q$);
select _try('check: Q-0541''s shape is invoiced at the Manager''s price, not at cost', 'ok', $q$select _is($c$(select invoiced and (payload->>'debtCharged')::numeric = 0 from saved_quotes where id=9501)$c$)$q$);

-- ---- fix 5: a line the client waits for becomes a Sourcing request, once
insert into saved_quotes(id, shop_id, client_name, status, invoiced, amount_paid, payload) overriding system value values
 (9510,'11111111-1111-1111-1111-111111111111','Lubowa Builders','draft',false,0,
  '{"client":{"name":"Lubowa Builders"},"items":[{"lineId":1,"productId":"P1","productName":"BB Silicone","qty":1,"price":40000,"sellPrice":50000,"supplierId":"S1"},{"lineId":2,"productId":"P2","productName":"Glass Door Locks","qty":5,"price":0,"supplierId":""}]}');
update saved_quotes set payload = jsonb_set(payload, '{items,1,clientWaits}', '{"at":1760900000000,"by":"00000000-0000-0000-0000-00000000000d"}') where id = 9510;
update saved_quotes set payload = payload || '{"note":"saved again"}' where id = 9510;
select _try('check: the waiting line is one Sourcing request, from the order, for that client', 'ok', $q$select _is($c$(select count(*) from sourcing_leads where id like 'CW-9510-%') = 1 and (select name = 'Glass Door Locks' and requests->0->>'source' = 'dropped' and requests->0->>'customerName' = 'Lubowa Builders' and (requests->0->>'orderId')::bigint = 9510 from sourcing_leads where id like 'CW-9510-%')$c$)$q$);
select _try('check: Sourcing is pushed about it', 'ok', $q$select _is($c$exists(select 1 from push_outbox where kind = 'sourcing.dropped' and body like '%Glass Door Locks%')$c$)$q$);

select case when (expect = 'ok' and got = 'ok') or (expect like 'refused%' and got like expect || '%') then 'PASS' else 'FAIL' end, label, got from _r order by n;
