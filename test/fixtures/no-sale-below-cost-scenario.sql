-- 0171 asked of a real database (docs/spec/02-money.md §8 Q16): no sale below
-- cost, whoever writes — Sales, the Buyer, the Manager, the owner's console,
-- the server with no login, and the hourly run.
grant all on all tables in schema public to authenticated;
grant all on all sequences in schema public to authenticated;
insert into auth.users values
 ('00000000-0000-0000-0000-00000000000a','owner@x'),('00000000-0000-0000-0000-00000000000b','manager@x'),
 ('00000000-0000-0000-0000-00000000000c','buyer@x'),('00000000-0000-0000-0000-00000000000d','sales@x');
insert into shops(id, name, created_by) values ('11111111-1111-1111-1111-111111111111','Omni-ware','00000000-0000-0000-0000-00000000000a');
insert into shop_members(shop_id,user_id,role) values
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000a','owner'),
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000b','manager'),
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000c','buyer'),
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000d','sales');
insert into app_settings(shop_id, presets) values ('11111111-1111-1111-1111-111111111111','{}')
 on conflict (shop_id) do update set presets = excluded.presets;
insert into products(shop_id,id,name) values ('11111111-1111-1111-1111-111111111111','P1','Cement'),('11111111-1111-1111-1111-111111111111','P2','Nails');
insert into customers(shop_id,id,name,phone,debt) values ('11111111-1111-1111-1111-111111111111','C1','Ken','0772000001',0);

-- Old orders as they stand (the checks are off while they go in):
--   #0301 delivered two days ago; Cement's cost rose to 30,000 after it was sold at 28,000.
--   #0302 delivered two days ago; Nails given away (a sample), Cement priced.
--   #0303 an open order whose line has no lineId; Cement sold at 9,000 on a cost of 8,000.
set session_replication_role = replica;
insert into saved_quotes(id, shop_id, client_name, date, status, invoiced, amount_paid, payload) overriding system value values
 (301,'11111111-1111-1111-1111-111111111111','Ken',ow_today()-2,'completed',false,0,jsonb_build_object('customerId','C1','deliveredAt',(now() - interval '2 days')::text,'payments','[]'::jsonb,
   'items','[{"lineId":1,"productId":"P1","productName":"Cement","qty":1,"price":30000,"priceWas":26000,"sellPrice":28000,"supplierId":"S1"}]'::jsonb)),
 (302,'11111111-1111-1111-1111-111111111111','Ken',ow_today()-2,'completed',false,0,jsonb_build_object('customerId','C1','deliveredAt',(now() - interval '2 days')::text,'payments','[]'::jsonb,
   'items','[{"lineId":1,"productId":"P2","productName":"Nails","qty":2,"price":3000,"sellPrice":0,"supplierId":"__stock__","givenAway":{"why":"sample","by":"00000000-0000-0000-0000-00000000000b","at":"2026-10-27T09:00:00Z"}},{"lineId":2,"productId":"P1","productName":"Cement","qty":1,"price":30000,"sellPrice":35000,"supplierId":"S1"}]'::jsonb)),
 (303,'11111111-1111-1111-1111-111111111111','Ken',ow_today(),'draft',false,0,
   '{"customerId":"C1","payments":[],"items":[{"productId":"P1","productName":"Cement","qty":1,"price":8000,"sellPrice":9000,"supplierId":"S1"}]}');
set session_replication_role = origin;

create table _r(n serial, label text, expect text, got text);
create function _try(label text, expect text, q text) returns void language plpgsql as $$
declare got text := 'ok';
begin
  declare n int; begin execute q; get diagnostics n = row_count;
    if n = 0 and (q ilike 'update%' or q ilike 'delete%') then got := 'refused: 0 rows (row-level security hid them)'; end if;
  exception when others then got := 'refused: ' || sqlstate || ' ' || sqlerrm; end;
  insert into _r(label, expect, got) values (label, expect, got);
end $$;
grant all on _r, _r_n_seq to authenticated; grant execute on function _try to authenticated;
create function _is(cond_sql text) returns void language plpgsql security definer as $$
declare ok boolean;
begin execute 'select (' || cond_sql || ')' into ok;
  if not coalesce(ok, false) then raise exception 'not so: %', cond_sql; end if; end $$;
grant execute on function _is to authenticated;

-- ---------------- 1. A price someone types is never under the cost
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000d';
select _try('sales: a new order with Cement at 9,000 on a cost of 10,000 is refused', 'refused:OWCST', $q$insert into saved_quotes(id, shop_id, client_name, date, status, payload) overriding system value values (310,'11111111-1111-1111-1111-111111111111','Ken',ow_today(),'draft','{"customerId":"C1","payments":[],"items":[{"lineId":1,"productId":"P1","productName":"Cement","qty":2,"price":10000,"sellPrice":9000,"supplierId":"S1"}]}')$q$);
select _try('sales: the same order at cost (10,000) is kept', 'ok', $q$insert into saved_quotes(id, shop_id, client_name, date, status, payload) overriding system value values (310,'11111111-1111-1111-1111-111111111111','Ken',ow_today(),'draft','{"customerId":"C1","payments":[],"items":[{"lineId":1,"productId":"P1","productName":"Cement","qty":2,"price":10000,"sellPrice":10000,"supplierId":"S1"}]}')$q$);
select _try('sales: lowering it to 9,500 is refused', 'refused:OWCST', $q$update saved_quotes set payload = jsonb_set(payload, '{items,0,sellPrice}', '9500') where id=310$q$);
select _try('sales: raising it to 12,000 is kept', 'ok', $q$update saved_quotes set payload = jsonb_set(payload, '{items,0,sellPrice}', '12000') where id=310$q$);
select _try('sales: a price on a line with no known cost is never judged', 'ok', $q$update saved_quotes set payload = jsonb_set(payload, '{items,1}', '{"lineId":2,"productName":"Hinges","qty":4,"price":0,"sellPrice":500}') where id=310$q$);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
select _try('buyer: takes the supplier''s dearer price (13,000), over the 12,000 it sells at', 'ok', $q$update saved_quotes set payload = jsonb_set(jsonb_set(payload, '{items,0,price}', '13000'), '{items,0,priceWas}', '10000') where id=310$q$);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000d';
select _try('sales: another line changed, the under-cost line left as it is', 'ok', $q$update saved_quotes set payload = jsonb_set(payload, '{items,1,qty}', '6') where id=310$q$);
select _try('sales: the under-cost line''s count changed, its price not', 'ok', $q$update saved_quotes set payload = jsonb_set(payload, '{items,0,qty}', '3') where id=310$q$);
select _try('sales: a new price still under the new cost (12,500) is refused', 'refused:OWCST', $q$update saved_quotes set payload = jsonb_set(payload, '{items,0,sellPrice}', '12500') where id=310$q$);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select _try('owner (console): the same, from the console, is refused', 'refused:OWCST', $q$update saved_quotes set payload = jsonb_set(payload, '{items,0,sellPrice}', '12500') where id=310$q$);
select _try('owner (console): a line with no lineId keeps its price when its cost rises', 'ok', $q$update saved_quotes set payload = jsonb_set(payload, '{items,0,price}', '9500') where id=303$q$);
select _try('owner (console): and a new price on it under the cost is refused', 'refused:OWCST', $q$update saved_quotes set payload = jsonb_set(payload, '{items,0,sellPrice}', '9200') where id=303$q$);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select _try('manager: a price at or above the new cost (13,000) is kept', 'ok', $q$update saved_quotes set payload = jsonb_set(payload, '{items,0,sellPrice}', '13000') where id=310$q$);
select _try('manager: a line given away at 0 is not under its cost', 'ok', $q$update saved_quotes set payload = jsonb_set(payload, '{items,1}', '{"lineId":2,"productId":"P2","productName":"Nails","qty":1,"price":3000,"sellPrice":0,"givenAway":{"why":"goodwill","by":"00000000-0000-0000-0000-00000000000b","at":"2026-10-28T09:00:00Z"}}') where id=310$q$);
reset role;
set request.jwt.claim.sub = '';
select _try('server, no login (an agent order off the shelf, a dearer lot): kept, judged at the bill', 'ok', $q$insert into saved_quotes(id, shop_id, client_name, date, status, payload) overriding system value values (311,'11111111-1111-1111-1111-111111111111','Agent client',ow_today(),'draft','{"payments":[],"items":[{"lineId":1,"productId":"P1","productName":"Cement","qty":1,"price":9500,"sellPrice":9000,"supplierId":"__stock__","shelfAuto":true}]}')$q$);
select _try('check: #0311 is kept with its line', 'ok', $q$select _is($c$(select (payload->'items'->0->>'sellPrice')::numeric from saved_quotes where id=311) = 9000$c$)$q$);

-- ---------------- 2. Never billed under the cost
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select _try('manager: invoicing #0301 (Cement at 28,000 on a cost of 30,000) is refused', 'refused:OWPRC', $q$select invoice_order('11111111-1111-1111-1111-111111111111',301)$q$);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select _try('owner (console): marking #0301 invoiced is refused too', 'refused:OWPRC', $q$update saved_quotes set invoiced = true, invoiced_at = now() where id=301$q$);
reset role;
set request.jwt.claim.sub = '';
select _try('the hourly run', 'ok', $q$select ow_invoice_due_orders()$q$);
select _try('check: #0301 is not invoiced; #0302 (given away + priced) is', 'ok', $q$select _is($c$not (select invoiced from saved_quotes where id=301) and (select invoiced from saved_quotes where id=302)$c$)$q$);
select _try('check: the Manager''s prices (price.approve) are told why #0301 waits', 'ok', $q$select _is($c$exists(select 1 from push_outbox where kind='invoice.held' and to_task='price.approve' and ref->>'id'='301' and ref->>'code'='OWPRC' and body like '%Cement sells under its cost%')$c$)$q$);
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select _try('manager: prices Cement at 32,000', 'ok', $q$update saved_quotes set payload = jsonb_set(payload, '{items,0,sellPrice}', '32000') where id=301$q$);
select _try('manager: now #0301 is invoiced', 'ok', $q$select invoice_order('11111111-1111-1111-1111-111111111111',301)$q$);
select _try('check: #0301 is invoiced for 32,000', 'ok', $q$select _is($c$(select invoiced from saved_quotes where id=301) and ow_order_total('11111111-1111-1111-1111-111111111111',(select payload from saved_quotes where id=301)) = 32000$c$)$q$);
reset role;

select case when (expect = 'ok' and got = 'ok') or (expect = 'refused' and got like 'refused%')
              or (expect like 'refused:%' and got like 'refused: ' || substr(expect, 9) || '%') then 'PASS' else 'FAIL' end, label, got from _r order by n;
