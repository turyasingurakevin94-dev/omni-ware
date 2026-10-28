-- 0177 asked of a real database (journey Q7, Q8): one Cancel, by the
-- Manager, before the bill — the stage the Store reads, the money settled,
-- the yard and the salesperson pushed.
grant all on all tables in schema public to authenticated;
grant all on all sequences in schema public to authenticated;
insert into auth.users values
 ('00000000-0000-0000-0000-00000000000a','owner@x'),('00000000-0000-0000-0000-00000000000b','manager@x'),
 ('00000000-0000-0000-0000-00000000000c','buyer@x'),('00000000-0000-0000-0000-00000000000d','sales@x'),
 ('00000000-0000-0000-0000-00000000000e','store@x');
insert into shops(id, name, created_by) values ('11111111-1111-1111-1111-111111111111','Omni-ware','00000000-0000-0000-0000-00000000000a');
insert into shop_members(shop_id,user_id,role,display_name) values
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000a','owner','Kevin'),
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000b','manager','Ruth Nakato'),
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000c','buyer','Musa Okello'),
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000d','sales','Grace Akello'),
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000e','store','Peter Ssali');
insert into app_settings(shop_id, presets) values ('11111111-1111-1111-1111-111111111111','{}')
 on conflict (shop_id) do update set presets = excluded.presets;

-- Orders (the checks are off while they go in), each taken by Grace:
--   #0901 Checking, a price waiting.   #0902 Packing, 35,000 paid in cash.   #0903 On the road, 35,000 paid by momo.
--   #0904 invoiced.   #0905 delivered, not invoiced.   #0906 Buying, its iron sheets came in.   #0907 Buying, on a live trip.
--   #0908 Packing, nothing paid.
set session_replication_role = replica;
insert into customers(shop_id,id,name,debt) values ('11111111-1111-1111-1111-111111111111','C1','Ken',0);
insert into cash_txns(id, shop_id, date, account, type, category, amount, description, quote_id) values
 (9902,'11111111-1111-1111-1111-111111111111',ow_today(),'cash','receipt','Invoice Payment',35000,'Payment — #0902',902),
 (9903,'11111111-1111-1111-1111-111111111111',ow_today(),'momo','receipt','Invoice Payment',35000,'Payment — #0903',903);
insert into saved_quotes(id, shop_id, client_name, date, status, invoiced, amount_paid, payload) overriding system value
 select g, '11111111-1111-1111-1111-111111111111', 'Ken', ow_today(), s, g = 904, p,
   jsonb_build_object('customerId','C1','takenBy','00000000-0000-0000-0000-00000000000d',
     'payments', case when p > 0 then jsonb_build_array(jsonb_build_object('id',1,'date',ow_today(),'amount',p,'cashTxnId',9000 + g,'method',case when g = 903 then 'momo' else 'cash' end)) else '[]'::jsonb end,
     'items', jsonb_build_array(jsonb_build_object('lineId',1,'productId','P1','productName','Cement','qty',1,'price',30000,'sellPrice',35000,'supplierId','__stock__')))
   from (values (901,'draft',0),(902,'preparing',35000),(903,'pending_delivery',35000),(904,'completed',0),(905,'completed',0),(906,'awaiting_goods',0),(907,'awaiting_goods',0),(908,'preparing',0)) v(g, s, p);
update saved_quotes set payload = jsonb_set(payload, '{items,0}', '{"lineId":1,"productId":"P1","productName":"Cement","qty":1,"price":30000,"sellPrice":25000,"priceBy":"00000000-0000-0000-0000-00000000000d","priceNote":"under","supplierId":"__stock__"}') where id = 901;
update saved_quotes set payload = jsonb_set(payload, '{items,0}', '{"lineId":1,"productId":"P2","productName":"Iron sheet","qty":5,"price":40000,"sellPrice":45000,"supplierId":"S1","receivedAt":1730000000000,"receivedQty":5}') where id = 906;
update saved_quotes set payload = jsonb_set(payload, '{items,0}', '{"lineId":1,"productId":"P2","productName":"Iron sheet","qty":5,"price":40000,"sellPrice":45000,"supplierId":"S1"}') where id = 907;
insert into collection_trips(id, shop_id, supplier_id, status, lines) values ('T1','11111111-1111-1111-1111-111111111111','S1','open','[{"orderId":907,"productId":"P2","qty":5}]');
set session_replication_role = origin;

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

set role authenticated;
-- ---------------- who may
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000d';
select _try('sales: cancels #0908', 'refused:42501', $q$select cancel_order('11111111-1111-1111-1111-111111111111',908,'customer changed their mind')$q$);
select _try('sales: sets #0908 to cancelled by hand', 'refused:42501', $q$update saved_quotes set status = 'cancelled' where id=908$q$);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
-- ---------------- what may not be cancelled
select _try('manager: invoiced #0904 (a void, not a cancel)', 'refused:22023', $q$select cancel_order('11111111-1111-1111-1111-111111111111',904,'wrong')$q$);
select _try('manager: delivered #0905', 'refused:22023', $q$select cancel_order('11111111-1111-1111-1111-111111111111',905,'wrong')$q$);
select _try('manager: #0906, its iron sheets came in', 'refused:22023', $q$select cancel_order('11111111-1111-1111-1111-111111111111',906,'wrong')$q$);
select _try('manager: #0907, on a live buying trip', 'refused:22023', $q$select cancel_order('11111111-1111-1111-1111-111111111111',907,'wrong')$q$);
select _try('manager: #0902, 35,000 paid, no choice made', 'refused:OWVMN', $q$select cancel_order('11111111-1111-1111-1111-111111111111',902,'changed their mind')$q$);
select _try('manager: #0908 with no reason', 'refused:22023', $q$select cancel_order('11111111-1111-1111-1111-111111111111',908,' ')$q$);
select _try('check: nothing of those stuck', 'ok', $q$select _is($c$not exists(select 1 from saved_quotes where status = 'cancelled' or (voided and id <> 0))$c$)$q$);

-- ---------------- the Cancel
select _try('manager: cancels #0901 in Checking, a price still waiting', 'ok', $q$select cancel_order('11111111-1111-1111-1111-111111111111',901,'customer changed their mind')$q$);
select _try('check: #0901 is cancelled and voided, by Ruth, with why, stage log and docLog', 'ok', $q$select _is($c$(select status = 'cancelled' and voided and payload->>'cancelledByName' = 'Ruth Nakato' and payload->>'cancelWhy' = 'customer changed their mind' and (payload->>'cancelledAt')::numeric > 0 and payload->'stageLog'->-1->>'status' = 'cancelled' and payload->'docLog'->-1->>'what' = 'Cancelled · customer changed their mind' and payload->'voidMoney'->>'choice' = 'none' from saved_quotes where id=901)$c$)$q$);
select _try('check: the yard is not pushed (it never had it); Grace is, once; no "price decided" push', 'ok', $q$select _is($c$(select count(*) from push_outbox where kind='order.cancelled' and ref->>'id'='901') = 1 and exists(select 1 from push_outbox where kind='order.cancelled' and ref->>'id'='901' and to_user='00000000-0000-0000-0000-00000000000d' and body = 'Ken #0901 — Ruth cancelled it: customer changed their mind') and not exists(select 1 from push_outbox where kind='price.decided')$c$)$q$);
select _try('check: the owner''s log says Cancelled, by order.cancel', 'ok', $q$select _is($c$exists(select 1 from decision_log where task='order.cancel' and what like 'Cancelled order #901%')$c$)$q$);
select _try('manager: cancels #0902 in Packing, the 35,000 kept as Ken''s deposit', 'ok', $q$select cancel_order('11111111-1111-1111-1111-111111111111',902,'changed their mind','deposit')$q$);
select _try('check: the yard is told to stop and put back; Ken has a 35,000 deposit', 'ok', $q$select _is($c$exists(select 1 from push_outbox where kind='order.cancelled' and ref->>'id'='902' and to_task='order.pick' and title='Called off · stop packing' and body = '#0902 · Ken — Ruth cancelled it. Put back what is out.') and (select debt from customers where id='C1') = -35000 and (select payload->'voidMoney'->>'choice' from saved_quotes where id=902) = 'deposit'$c$)$q$);
select _try('manager: cancels #0903 On the road, the 35,000 refunded by momo', 'ok', $q$select cancel_order('11111111-1111-1111-1111-111111111111',903,'wrong address','refund','momo')$q$);
select _try('check: a momo Refund of 35,000, and the yard told', 'ok', $q$select _is($c$exists(select 1 from cash_txns where quote_id=903 and type='payment' and category='Refund' and account='momo' and amount=35000) and exists(select 1 from push_outbox where kind='order.cancelled' and ref->>'id'='903' and to_task='order.pick')$c$)$q$);
select _try('manager: cancels #0901 again', 'refused:22023', $q$select cancel_order('11111111-1111-1111-1111-111111111111',901,'again')$q$);
select _try('manager: moves cancelled #0901 back to Checking', 'refused:OWSTG', $q$update saved_quotes set status = 'draft' where id=901$q$);
reset role;

select case when (expect = 'ok' and got = 'ok') or (expect like 'refused:%' and got like 'refused: ' || substr(expect, 9) || '%') then 'PASS' else 'FAIL' end, label, got from _r order by n;
