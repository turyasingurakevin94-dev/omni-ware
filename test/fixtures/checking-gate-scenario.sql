-- 0174 asked of a real database (journey Q1, money Q8): an order leaves
-- Checking only when every supplier said yes, every line has a supplier (or
-- the client waits for it), an agent who pays first has paid, and the
-- customer has not owed past the hold days — whichever app moves it.
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
insert into agents(shop_id, id, name, payment_term) values
 ('11111111-1111-1111-1111-111111111111','A1','Moses','prepay'),('11111111-1111-1111-1111-111111111111','A2','Grace','pay_on_delivery');

-- Customers and their debt log (the checks are off while it goes in):
--   C1 Ken owes nothing.  C2 Sadat owes 300,000 from 40 days ago.  C3 Musa owes 100,000 from 10 days ago.
--   C4 Peter owes 50,000 on a charge with no date.  C5 Agnes: 100,000 from 50 days ago (#0701) paid by a
--   payment naming it, and 100,000 from 30 days ago (#0702) still owed.
set session_replication_role = replica;
insert into customers(shop_id,id,name,debt) values
 ('11111111-1111-1111-1111-111111111111','C1','Ken',0),('11111111-1111-1111-1111-111111111111','C2','Sadat',300000),
 ('11111111-1111-1111-1111-111111111111','C3','Musa',100000),('11111111-1111-1111-1111-111111111111','C4','Peter',50000),
 ('11111111-1111-1111-1111-111111111111','C5','Agnes',100000);
insert into customer_debt_log(id, shop_id, customer_id, date, type, amount, note, quote_id) values
 (1,'11111111-1111-1111-1111-111111111111','C2',ow_today()-40,'charge',300000,'INV-0690',690),
 (2,'11111111-1111-1111-1111-111111111111','C3',ow_today()-10,'charge',100000,'INV-0691',691),
 (3,'11111111-1111-1111-1111-111111111111','C4',null,'charge',50000,'Opening balance',null),
 (4,'11111111-1111-1111-1111-111111111111','C5',ow_today()-50,'charge',100000,'INV-0701',701),
 (5,'11111111-1111-1111-1111-111111111111','C5',ow_today()-30,'charge',100000,'INV-0702',702),
 (6,'11111111-1111-1111-1111-111111111111','C5',ow_today()-5,'payment',100000,'Payment — INV-0701',701);
-- Orders in Checking. One bag of cement at 35,000 (cost 30,000) unless said.
insert into saved_quotes(id, shop_id, client_name, date, status, payload) overriding system value values
 (601,'11111111-1111-1111-1111-111111111111','Ken',ow_today(),'draft','{"customerId":"C1","payments":[],"items":[{"lineId":1,"productId":"P1","productName":"Cement","qty":2,"price":30000,"sellPrice":35000,"supplierId":"S1"}]}'),
 (602,'11111111-1111-1111-1111-111111111111','Ken',ow_today(),'draft','{"customerId":"C1","payments":[],"items":[{"lineId":1,"productId":"P1","productName":"Cement","qty":3,"price":30000,"sellPrice":35000,"supplierId":"S1"}],"supplierConfirms":{"S1":{"state":"confirmed","terms":"P1::2:30000"}}}'),
 (603,'11111111-1111-1111-1111-111111111111','Ken',ow_today(),'draft','{"customerId":"C1","payments":[],"items":[{"lineId":1,"productId":"P1","productName":"Cement","qty":1,"price":30000,"sellPrice":35000,"supplierId":"__stock__"},{"lineId":2,"productName":"Hinges","qty":4,"sellPrice":500}]}'),
 (604,'11111111-1111-1111-1111-111111111111','Agent client',ow_today(),'draft','{"originAgentId":"A1","agentPaymentStatus":"unpaid","payments":[],"items":[{"lineId":1,"productId":"P1","productName":"Cement","qty":1,"price":30000,"sellPrice":35000,"supplierId":"__stock__"}]}'),
 (605,'11111111-1111-1111-1111-111111111111','Agent client',ow_today(),'draft','{"originAgentId":"A2","agentPaymentStatus":"unpaid","payments":[],"items":[{"lineId":1,"productId":"P1","productName":"Cement","qty":1,"price":30000,"sellPrice":35000,"supplierId":"__stock__"}]}'),
 (606,'11111111-1111-1111-1111-111111111111','Sadat',ow_today(),'draft','{"customerId":"C2","payments":[],"items":[{"lineId":1,"productId":"P1","productName":"Cement","qty":1,"price":30000,"sellPrice":35000,"supplierId":"__stock__"}]}'),
 (607,'11111111-1111-1111-1111-111111111111','Musa',ow_today(),'draft','{"customerId":"C3","payments":[],"items":[{"lineId":1,"productId":"P1","productName":"Cement","qty":1,"price":30000,"sellPrice":35000,"supplierId":"__stock__"}]}'),
 (608,'11111111-1111-1111-1111-111111111111','Sadat',ow_today(),'draft','{"customerId":"C2","payments":[],"items":[{"lineId":1,"productId":"P1","productName":"Cement","qty":1,"price":30000,"sellPrice":0,"supplierId":"__stock__","givenAway":{"why":"sample","by":"x","at":"2026-10-28"}}]}'),
 (609,'11111111-1111-1111-1111-111111111111','Ken',ow_today(),'draft','{"customerId":"C1","payments":[],"items":[{"lineId":1,"productId":"P1","productName":"Cement","qty":1,"price":30000,"sellPrice":25000,"priceBy":"00000000-0000-0000-0000-00000000000d","priceNote":"under","supplierId":"S1"},{"lineId":2,"productName":"Hinges","qty":1,"sellPrice":500}]}');
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
create function _held(p_id bigint) returns text language sql security definer as $$
  select case when status = 'draft' then coalesce(payload -> 'gateHeldMove' ->> 'why', 'draft, nothing held') else status end from saved_quotes where id = p_id $$;
grant execute on function _held to authenticated;

-- ---------------- how old a debt is
select _try('aged: Sadat 40 days, Musa 10, Ken 0', 'ok', $q$select _is($c$ow_oldest_debt_days('11111111-1111-1111-1111-111111111111','C2') = 40 and ow_oldest_debt_days('11111111-1111-1111-1111-111111111111','C3') = 10 and ow_oldest_debt_days('11111111-1111-1111-1111-111111111111','C1') = 0$c$)$q$);
select _try('aged: a charge with no date is never aged (Peter: 0)', 'ok', $q$select _is($c$ow_oldest_debt_days('11111111-1111-1111-1111-111111111111','C4') = 0$c$)$q$);
select _try('aged: a payment clears its own bill first (Agnes: 30, not 50)', 'ok', $q$select _is($c$ow_oldest_debt_days('11111111-1111-1111-1111-111111111111','C5') = 30$c$)$q$);
select _try('the hold line: 21 days unless the shop set another', 'ok', $q$select _is($c$ow_hold_days('{}') = 21 and ow_hold_days('{"creditHold":{"days":45}}') = 45 and ow_hold_days('{"creditHold":{"days":0}}') = 21$c$)$q$);
select _try('a supplier''s terms are written as the Buyer app writes them', 'ok', $q$select _is($c$ow_supplier_terms('[{"productId":"P1","qty":2,"price":30000.4,"supplierId":"S1"},{"productId":"P2","variantIdx":0,"qty":"1.50","price":99.5,"supplierId":"S1"},{"productId":"P3","qty":1,"price":5,"supplierId":"S2"}]', 'S1') = 'P1::2:30000|P2:0:1.5:100'$c$)$q$);
select _try('a price waiting still comes first (its push reads it)', 'ok', $q$select _is($c$ow_gate_reason('11111111-1111-1111-1111-111111111111', (select payload from saved_quotes where id=609), 0) = 'price'$c$)$q$);

-- ---------------- the Manager's "next" no longer skips the Buyer's checks
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select _try('manager: #0601 to Buying, S1 has not said yes', 'ok', $q$update saved_quotes set status = 'awaiting_goods' where id=601$q$);
select _try('check: #0601 is kept in Checking, for the suppliers', 'ok', $q$select _is($c$_held(601) = 'suppliers'$c$)$q$);
select _try('manager: #0602 to Buying, S1''s yes was for 2 bags, the order is 3', 'ok', $q$update saved_quotes set status = 'awaiting_goods' where id=602$q$);
select _try('check: #0602 is kept in Checking', 'ok', $q$select _is($c$_held(602) = 'suppliers'$c$)$q$);
select _try('manager: #0603 to Packing, the hinges have no supplier', 'ok', $q$update saved_quotes set status = 'preparing' where id=603$q$);
select _try('check: #0603 is kept in Checking, for the line with no supplier', 'ok', $q$select _is($c$_held(603) = 'unsourced'$c$)$q$);
select _try('manager: the client is told to wait for the hinges', 'ok', $q$update saved_quotes set payload = jsonb_set(payload, '{items,1,clientWaits}', 'true') where id=603$q$);
select _try('check: #0603 goes on to Packing by itself', 'ok', $q$select _is($c$_held(603) = 'preparing'$c$)$q$);
select _try('manager: #0604 (Moses pays first, has not paid) to Packing', 'ok', $q$update saved_quotes set status = 'preparing' where id=604$q$);
select _try('check: #0604 is kept in Checking, for the prepay', 'ok', $q$select _is($c$_held(604) = 'prepay'$c$)$q$);
select _try('manager: #0605 (Grace pays on delivery) to Packing', 'ok', $q$update saved_quotes set status = 'preparing' where id=605$q$);
select _try('check: #0605 is in Packing', 'ok', $q$select _is($c$_held(605) = 'preparing'$c$)$q$);
select _try('manager: #0606 (Sadat has owed 40 days) to Packing', 'ok', $q$update saved_quotes set status = 'preparing' where id=606$q$);
select _try('check: #0606 is kept in Checking, a credit hold', 'ok', $q$select _is($c$_held(606) = 'credit'$c$)$q$);
select _try('check: the Manager''s credit.hold push says how long', 'ok', $q$select _is($c$exists(select 1 from push_outbox where kind='credit.hold' and to_task='credit.release' and ref->>'id'='606' and body like 'Sadat would owe 335,000 · no limit set · owed 40 days')$c$)$q$);
select _try('manager: says Release', 'ok', $q$update saved_quotes set payload = payload || '{"creditCheck":{"decision":"release","by":"00000000-0000-0000-0000-00000000000b"}}' where id=606$q$);
select _try('check: #0606 goes on to Packing with the Release', 'ok', $q$select _is($c$_held(606) = 'preparing'$c$)$q$);
select _try('manager: #0607 (Musa, 10 days) to Packing', 'ok', $q$update saved_quotes set status = 'preparing' where id=607$q$);
select _try('check: #0607 is in Packing — not past the hold line', 'ok', $q$select _is($c$_held(607) = 'preparing'$c$)$q$);
select _try('manager: #0608 (Sadat, nothing owed on it: a sample) to Packing', 'ok', $q$update saved_quotes set status = 'preparing' where id=608$q$);
select _try('check: #0608 is in Packing — it adds nothing to the debt', 'ok', $q$select _is($c$_held(608) = 'preparing'$c$)$q$);

-- ---------------- the yes that clears it
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
select _try('buyer: S1 says yes to #0601, and the Buyer moves it to Buying', 'ok', $q$update saved_quotes set status = 'awaiting_goods', payload = payload || '{"supplierConfirms":{"S1":{"state":"confirmed","terms":"P1::2:30000"}}}' where id=601$q$);
select _try('check: #0601 is in Buying', 'ok', $q$select _is($c$_held(601) = 'awaiting_goods'$c$)$q$);
reset role;
set request.jwt.claim.sub = '';
select _try('server, no login: Moses pays for #0604', 'ok', $q$update saved_quotes set payload = payload || '{"agentPaymentStatus":"paid"}' where id=604$q$);
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select _try('manager: #0604 to Packing again', 'ok', $q$update saved_quotes set status = 'preparing' where id=604$q$);
select _try('check: #0604 is in Packing', 'ok', $q$select _is($c$_held(604) = 'preparing'$c$)$q$);
reset role;

select case when (expect = 'ok' and got = 'ok') or (expect = 'refused' and got like 'refused%')
              or (expect like 'refused:%' and got like 'refused: ' || substr(expect, 9) || '%') then 'PASS' else 'FAIL' end, label, got from _r order by n;
