-- 0182 asked of a real database: the new Store app's pushes go to the people
-- IB01 names, in its words, and a packed pickup waits at the gate as Ready
-- to collect until the hand-over (held there while not paid).
grant all on all tables in schema public to authenticated;
grant all on all sequences in schema public to authenticated;
insert into auth.users values
 ('00000000-0000-0000-0000-00000000000a','owner@x'),('00000000-0000-0000-0000-00000000000b','ruth@x'),
 ('00000000-0000-0000-0000-00000000000c','denis@x'),('00000000-0000-0000-0000-00000000000d','grace@x'),
 ('00000000-0000-0000-0000-00000000000e','musa@x'),('00000000-0000-0000-0000-00000000000f','okello@x'),
 ('00000000-0000-0000-0000-000000000010','ssali@x'),('00000000-0000-0000-0000-000000000011','moses@x'),
 ('00000000-0000-0000-0000-000000000012','esther@x');
insert into shops(id, name, created_by) values ('11111111-1111-1111-1111-111111111111','Omni-ware','00000000-0000-0000-0000-00000000000a');
insert into shop_members(shop_id,user_id,role,display_name) values
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000a','owner','Joseph'),
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000b','manager','Ruth Nakato'),
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000c','buyer','Denis Opio'),
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000d','sales','Grace Akello'),
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000e','store','Musa Kiggundu'),
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000f','store','Okello Peter'),
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-000000000010','staff','Ssali John'),
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-000000000011','sourcing','Moses Lule'),
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-000000000012','accounts','Esther Auma');
insert into staff(shop_id,id,name,role,user_id) values
 ('11111111-1111-1111-1111-111111111111','W1','Ruth Nakato','manager','00000000-0000-0000-0000-00000000000b'),
 ('11111111-1111-1111-1111-111111111111','W2','Denis Opio','buyer','00000000-0000-0000-0000-00000000000c'),
 ('11111111-1111-1111-1111-111111111111','W3','Musa Kiggundu','store','00000000-0000-0000-0000-00000000000e'),
 ('11111111-1111-1111-1111-111111111111','W4','Okello Peter','store','00000000-0000-0000-0000-00000000000f'),
 ('11111111-1111-1111-1111-111111111111','W5','Ssali John','staff','00000000-0000-0000-0000-000000000010');
insert into customers(shop_id,id,name,credit_limit) values
 ('11111111-1111-1111-1111-111111111111','C1','Ggaba Stores',5000000),
 ('11111111-1111-1111-1111-111111111111','C2','Kato Construction',5000000),
 ('11111111-1111-1111-1111-111111111111','C3','Nansana Hardware',5000000);
insert into suppliers(shop_id,id,name) values
 ('11111111-1111-1111-1111-111111111111','S1','Kiseka Market'),('11111111-1111-1111-1111-111111111111','S2','Hima Cement');

-- Orders as they stand (the checks are off while they go in), each taken by Grace.
set session_replication_role = replica;
insert into saved_quotes(id, shop_id, client_name, date, status, invoiced, amount_paid, payload) overriding system value
 select v.id, '11111111-1111-1111-1111-111111111111', v.client, ow_today(), v.status, v.inv, 0,
   jsonb_build_object('takenBy','00000000-0000-0000-0000-00000000000d','stageEnteredAt',1760000000000,
     'items', jsonb_build_array(jsonb_build_object('lineId',1,'productId','P1','productName','Cement','unit','bag','qty',2,'price',30000,'sellPrice',35000,'supplierId','__stock__')))
   || v.extra
 from (values
  (530, 'Brian Site', 'preparing', false, '{"customerId":"C2","pickingStatus":"done","bay":"2","assignedWorkerId":"W3","pickingDoneAt":1760000000000}'::jsonb),
  (534, 'Kato Construction', 'pending_delivery', false, '{"customerId":"C2","pickingStatus":"done","carrier":{"kind":"staff","name":"Ssali John","staffId":"W5","at":1},"assignedDeliveryId":"W5"}'::jsonb),
  (538, 'Nansana Hardware', 'pending_delivery', false, '{"customerId":"C3","pickingStatus":"done","carrier":{"kind":"staff","name":"Ssali John","at":2}}'::jsonb),
  (546, 'Lubowa Builders', 'completed', true, '{"customerId":"C2"}'::jsonb),
  (547, 'Ggaba Stores', 'pending_delivery', false, '{"customerId":"C1","pickingStatus":"done","carrier":{"kind":"staff","name":"Ssali John","at":3}}'::jsonb),
  (548, 'Ggaba Stores', 'completed', true, '{"customerId":"C1"}'::jsonb),
  (551, 'Kato Construction', 'preparing', false, '{"customerId":"C2","deliverTo":"Ntinda site","assignedWorkerId":"W3","pickingStatus":"in_progress"}'::jsonb),
  (552, 'Kato Construction', 'preparing', false, '{"customerId":"C2","deliverTo":"Ntinda site","deliverWhen":"today-pm","deliverPhone":"0772 418 220","assignedWorkerId":"W3","pickingStatus":"in_progress"}'::jsonb),
  (553, 'Kato Construction', 'preparing', false, '{"customerId":"C2","deliverTo":"Ntinda site","pickingStatus":"done","pickingDoneAt":1760000000000}'::jsonb),
  (555, 'Walk-in', 'preparing', false, '{"pickingStatus":"in_progress"}'::jsonb),
  (549, 'Ggaba Stores', 'awaiting_goods', false, '{"customerId":"C1","deliverTo":"Ggaba"}'::jsonb),
  (560, 'Counter', 'completed', false, '{"counter":true}'::jsonb)
 ) v(id, client, status, inv, extra);
update saved_quotes set payload = jsonb_set(payload, '{items,0}', '{"lineId":1,"productId":"P1","productName":"Cement","unit":"bag","qty":20,"price":30000,"sellPrice":35000,"supplierId":"S1"}') where id = 549;
update saved_quotes set payload = payload || '{"creditNotes":[{"askId":"x","restocked":true,"lines":[{"idx":0,"qty":1,"price":35000,"restock":true}]}]}' where id = 548;
insert into collection_trips(id, shop_id, supplier_id, status, assigned_worker_id, lines) values
 ('T1','11111111-1111-1111-1111-111111111111','S1','collecting','W2',
  '[{"orderId":"549","lineId":1,"productId":"P1","productName":"Cement","unit":"bag","qty":20,"gotQty":20},
    {"orderId":"restock","lineId":"r1","productId":"P2","productName":"Iron sheet","unit":"pc","qty":5,"gotQty":5}]'),
 ('T2','11111111-1111-1111-1111-111111111111','S2','collected','__supplier__',
  '[{"orderId":"restock","lineId":"r2","productId":"P1","productName":"Cement","unit":"bag","qty":100,"gotQty":100}]');
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
-- Who a push reaches, as push-send asks (the last two digits of each login), for the
-- row of that kind whose title is like the words given.
create function _to(p_kind text, p_title text) returns text language sql security definer as $$
  select coalesce(string_agg(distinct right(r.user_id::text, 2), ',' order by right(r.user_id::text, 2)), '')
    from push_outbox o, lateral ow_push_recipients(o.id) r where o.kind = p_kind and o.title like p_title
$$;
grant execute on function _to to authenticated;
create function _n(p_kind text, p_ref text) returns int language sql security definer as $$
  select count(*)::int from push_outbox where kind = p_kind and ref ->> 'id' = p_ref
$$;
grant execute on function _n to authenticated;

set role authenticated;
-- ---------------- the order reaches the yard
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select _try('owner: places #0556 straight into Packing (they collect)', 'ok', $q$insert into saved_quotes(id, shop_id, client_name, date, status, payload) overriding system value values (556,'11111111-1111-1111-1111-111111111111','Nansana Hardware',ow_today(),'preparing','{"customerId":"C3","takenBy":"00000000-0000-0000-0000-00000000000d","stageEnteredAt":1760000000001,"items":[{"lineId":1,"productId":"P1","productName":"Cement","unit":"bag","qty":2,"price":30000,"sellPrice":35000,"supplierId":"__stock__"}]}')$q$);
select _try('check: "New to pack · #0556 Nansana · they collect" to every yard phone, on insert', 'ok', $q$select _is($c$_to('order.pick', 'New to pack') = '0e,0f,10' and (select body from push_outbox where kind='order.pick' and ref->>'id'='556') = '#0556 Nansana · they collect'$c$)$q$);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select _try('ruth: gives #0556 to Ssali', 'ok', $q$update saved_quotes set payload = payload || '{"assignedWorkerId":"W5","pickingStatus":"awaiting_accept","pickingAssignedAt":1760000000002}' where id = 556$q$);
select _try('check: "Ruth gave you #0556 to pack", to Ssali only', 'ok', $q$select _is($c$_to('order.pick', 'Ruth gave you #0556 to pack') = '10'$c$)$q$);

-- ---------------- Ready to collect, and the hand-over
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000010';
select _try('ssali (a yard worker): packs #0556, a pickup: On the road with no carrier', 'ok', $q$select store_patch_order('11111111-1111-1111-1111-111111111111',556,'{"pickingStatus":"done","pickingDoneAt":1760000000003,"bay":"Gate"}','pending_delivery',null)$q$);
select _try('check: #0556 is Ready to collect (pending_delivery, packed, no carrier)', 'ok', $q$select _is($c$(select status = 'pending_delivery' and ow_ready_to_collect(status, payload) from saved_quotes where id = 556)$c$)$q$);
select _try('check: "#0556 ready to collect · at the gate · code 0556" to Grace', 'ok', $q$select _is($c$_to('order.ready', '#0556 ready to collect · at the gate · code 0556') = '0d'$c$)$q$);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000e';
select _try('musa: hands #0556 over at the gate', 'ok', $q$select store_patch_order('11111111-1111-1111-1111-111111111111',556,'{"carrier":{"kind":"client","name":"Nansana","at":5},"handoverCheckedAt":1760000000004,"deliveredTo":"Nansana","deliveredAt":"1760000000004"}','completed',null)$q$);
select _try('check: "#0556 collected <time>" to Grace; Ruth has 0120''s to invoice', 'ok', $q$select _is($c$_to('order.delivered', '#0556 collected %') = '0d' and _to('order.delivered', 'Delivered — ready to invoice') = '0b' and (select status from saved_quotes where id = 556) = 'completed'$c$)$q$);

select _try('musa: packs the walk-in''s #0555, a pickup, not paid: it may wait at the gate', 'ok', $q$select store_patch_order('11111111-1111-1111-1111-111111111111',555,'{"pickingStatus":"done","pickingDoneAt":1760000000005,"bay":"Gate"}','pending_delivery',null)$q$);
select _try('check: "Walk-in''s #0555 is packed · take the money" to Grace, "Not paid yet · let it go on credit?" to Ruth; no "ready"', 'ok', $q$select _is($c$_to('order.unpaid_at_gate', 'Walk-in''s #0555 is packed · take the money') = '0d' and _to('credit.ask', 'Not paid yet · let it go on credit?') = '0b' and _n('order.ready', '555') = 0 and position('cash customer' in (select string_agg(body, ' ') from push_outbox where kind = 'credit.ask')) = 0$c$)$q$);
select _try('check: the yard''s money holds list #0555 at the gate', 'ok', $q$select _is($c$exists(select 1 from store_money_holds('11111111-1111-1111-1111-111111111111') where id = 555) and (store_live('11111111-1111-1111-1111-111111111111') -> 'holds') ? '555'$c$)$q$);
select _try('musa: hands #0555 over unpaid', 'refused: 42501', $q$select store_patch_order('11111111-1111-1111-1111-111111111111',555,'{"carrier":{"kind":"client","name":"Walk-in","at":6},"handoverCheckedAt":1760000000006}','completed',null)$q$);
select _try('musa: gives #0555 a carrier unpaid (it would leave)', 'refused: 42501', $q$select store_patch_order('11111111-1111-1111-1111-111111111111',555,'{"carrier":{"kind":"staff","name":"Ssali","at":6}}',null,null)$q$);
select _try('check: #0555 still waits at the gate', 'ok', $q$select _is($c$(select ow_ready_to_collect(status, payload) from saved_quotes where id = 555)$c$)$q$);
reset role;
set session_replication_role = replica;  -- Grace takes the money (how is not the yard's)
update saved_quotes set amount_paid = 70000 where id = 555;
set session_replication_role = origin;
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000e';
select _try('musa: hands #0555 over once paid', 'ok', $q$select store_patch_order('11111111-1111-1111-1111-111111111111',555,'{"carrier":{"kind":"client","name":"Walk-in","at":7},"handoverCheckedAt":1760000000007}','completed',null)$q$);

-- ---------------- packed, loaded, delivered
select _try('musa: packs Kato''s #0552 for delivery, bay 1', 'ok', $q$select store_patch_order('11111111-1111-1111-1111-111111111111',552,'{"pickingStatus":"done","pickingDoneAt":1760000000008,"bay":"1"}',null,null)$q$);
select _try('check: "Kato''s #0552 is packed · bay 1" to Grace', 'ok', $q$select _is($c$_to('order.packed', 'Kato''s #0552 is packed · bay 1') = '0d'$c$)$q$);
select _try('check: the yard''s allow-list passes deliverTo, deliverWhen, deliverPhone', 'ok', $q$select _is($c$(select payload->>'deliverTo' = 'Ntinda site' and payload->>'deliverWhen' = 'today-pm' and payload->>'deliverPhone' = '0772 418 220' from jsonb_to_record(store_order('11111111-1111-1111-1111-111111111111',552)) as x(payload jsonb))$c$)$q$);
select _try('musa: loads #0552 on Ssali', 'ok', $q$select store_patch_order('11111111-1111-1111-1111-111111111111',552,'{"carrier":{"kind":"staff","name":"Ssali John","staffId":"W5","at":9},"assignedDeliveryId":"W5"}','pending_delivery',null)$q$);
select _try('check: "#0552 on the road · Ssali" to Grace', 'ok', $q$select _is($c$_to('order.out', '#0552 on the road · Ssali') = '0d'$c$)$q$);
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000010';
select _try('ssali: delivers #0552 with a photo', 'ok', $q$select store_patch_order('11111111-1111-1111-1111-111111111111',552,'{"deliveredAt":"1760000000010","deliveredPhoto":"p/552.jpg","deliveredTo":"Kato"}','completed',null)$q$);
select _try('check: "#0552 delivered <time>" to Grace', 'ok', $q$select _is($c$_to('order.delivered', '#0552 delivered %') = '0d' and _to('order.delivered', '#0552 delivered · no photo') = ''$c$)$q$);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000e';
select _try('musa: loads #0553 on a hired lorry', 'ok', $q$select store_patch_order('11111111-1111-1111-1111-111111111111',553,'{"carrier":{"kind":"hired","name":"Abudu","at":11},"assignedDeliveryId":"__carrier__"}','pending_delivery',null)$q$);
select _try('check: "#0553 on the road · Abudu (hired)" to Grace', 'ok', $q$select _is($c$_to('order.out', '#0553 on the road · Abudu (hired)') = '0d'$c$)$q$);
select _try('musa: #0553 delivered, no photo (Kato said no)', 'ok', $q$select store_patch_order('11111111-1111-1111-1111-111111111111',553,'{"deliveredAt":"1760000000012","deliveredPhotoKind":"none","deliveredNote":"Kato said no photo"}','completed',null)$q$);
select _try('check: "#0553 delivered · no photo", the reason riding on it, to Grace', 'ok', $q$select _is($c$_to('order.delivered', '#0553 delivered · no photo') = '0d' and (select body from push_outbox where dedupe = 'delivered:553:sales') like 'Kato said no photo%'$c$)$q$);

-- ---------------- a short pick, settled
select _try('musa: packs #0551 one line short', 'ok', $q$select store_patch_order('11111111-1111-1111-1111-111111111111',551,'{"pickingStatus":"done","pickingDoneAt":1760000000013,"bay":"3"}',null,'[{"idx":0,"pickStatus":"short","pickedQty":1}]')$q$);
select _try('check: "#0551 · 1 short · Ruth settles" to Grace; 0120''s to Ruth; not "packed" while it waits on her', 'ok', $q$select _is($c$_to('pick.short', '#0551 · 1 short · Ruth settles') = '0d' and _to('pick.short', 'A short pick to settle') = '0b' and _n('order.packed', '551') = 0$c$)$q$);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select _try('ruth: settles #0551''s short (bill what went)', 'ok', $q$update saved_quotes set payload = payload || '{"pickSettle":{"pick":"went","byName":"Ruth Nakato","at":"2026-11-11T10:00:00Z","lines":[{"idx":0,"ordered":2,"picked":1}]},"pickShortfallAckAt":1760000000014}' where id = 551$q$);
select _try('check: "Ruth settled #0551''s short" to the packer Musa and to Grace', 'ok', $q$select _is($c$_to('pick.settled', 'Ruth settled #0551''s short') = '0d,0e'$c$)$q$);

-- ---------------- cancelled, wherever it is
select _try('ruth: cancels #0530, packed on bay 2', 'ok', $q$select cancel_order('11111111-1111-1111-1111-111111111111',530,'customer changed their mind')$q$);
select _try('check: "Cancelled · put it back · #0530" to the yard, "Cancelled · #0530" to Grace; no push in 0177''s old words', 'ok', $q$select _is($c$_to('order.cancelled', 'Cancelled · put it back · #0530') = '0e,0f,10' and _to('order.cancelled', 'Cancelled · #0530') = '0d' and _n('order.cancelled', '530') = 2 and (select body from push_outbox where dedupe = 'cancel:530:yard') like 'Brian — Ruth cancelled it · bay 2%'$c$)$q$);
select _try('ruth: cancels #0534, on Ssali''s truck', 'ok', $q$select cancel_order('11111111-1111-1111-1111-111111111111',534,'wrong order')$q$);
select _try('check: "#0534 cancelled · bring it back" to the yard (Ssali among it) and Grace', 'ok', $q$select _is($c$_to('order.cancelled', '#0534 cancelled · bring it back') = '0e,0f,10' and _to('order.cancelled', 'Cancelled · #0534') = '0d'$c$)$q$);

-- ---------------- put back (W7): recorded on the order, once, no stock, no push
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000e';
select _try('musa: a plain write to cancelled #0530 does nothing (as before)', 'ok', $q$select _is($c$store_patch_order('11111111-1111-1111-1111-111111111111',530,'{"bay":"4"}',null,null) is null and (select payload->>'bay' from saved_quotes where id = 530) = '2'$c$)$q$);
select _try('musa: puts back #0530 (PK10''s red slide)', 'ok', $q$select store_patch_order('11111111-1111-1111-1111-111111111111',530,'{"putBack":{"lines":[{"idx":0,"qty":2},{"idx":"x","qty":1},{"idx":1,"qty":0}],"at":1,"by":"someone"}}',null,null)$q$);
select _try('check: #0530 carries putBack: the server''s time and Musa, the good line only; no stock line; no push; still cancelled', 'ok', $q$select _is($c$(select payload->'putBack'->>'byName' = 'Musa' and payload->'putBack'->>'by' = '00000000-0000-0000-0000-00000000000e' and (payload->'putBack'->>'at')::bigint > 1760000000000 and payload->'putBack'->'lines' = '[{"idx":0,"qty":2}]' and status = 'cancelled' from saved_quotes where id = 530) and not exists(select 1 from stock_log where note like '%0530%') and (select count(*) from push_outbox where ref->>'id' = '530') = 2$c$)$q$);
select _try('check: every phone reads it put back (store_snapshot, store_live, store_order)', 'ok', $q$select _is($c$(select o->'payload'->'putBack'->>'byName' from jsonb_array_elements(store_snapshot('11111111-1111-1111-1111-111111111111')->'orders') o where (o->>'id')::int = 530) = 'Musa' and (select o->'payload' ? 'putBack' from jsonb_array_elements(store_live('11111111-1111-1111-1111-111111111111')->'orders') o where (o->>'id')::int = 530) and (store_order('11111111-1111-1111-1111-111111111111',530)->'payload'->'putBack'->'lines'->0->>'qty') = '2'$c$)$q$);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000f';
select _try('okello: puts back #0530 again (another phone): the first stamp stays', 'ok', $q$select _is($c$(store_patch_order('11111111-1111-1111-1111-111111111111',530,'{"putBack":{"lines":[]}}',null,null)->'payload'->'putBack'->>'byName') = 'Musa'$c$)$q$);
select _try('okello: brings #0534 back off Ssali''s truck (OU27)', 'ok', $q$select store_patch_order('11111111-1111-1111-1111-111111111111',534,'{"putBack":{"lines":[{"idx":0,"qty":2}]}}',null,null)$q$);
select _try('check: #0534 put back by Okello, still on its stage', 'ok', $q$select _is($c$(select payload->'putBack'->>'byName' = 'Okello' and status = 'cancelled' from saved_quotes where id = 534)$c$)$q$);
select _try('okello: a put-back on a live order is not a key the yard has', 'ok', $q$select _is($c$(store_patch_order('11111111-1111-1111-1111-111111111111',553,'{"putBack":{"lines":[]}}',null,null)->'payload') ? 'putBack' = false and not ((select payload from saved_quotes where id = 553) ? 'putBack')$c$)$q$);

-- ---------------- a dropped line reaches the yard, without its price
reset role;
set session_replication_role = replica;
update saved_quotes set payload = payload || '{"droppedLines":[{"productId":"P9","productName":"Soft close hinge","variantIdx":null,"unit":"pc","qty":10,"sellPrice":9000,"agentSellPrice":8500,"at":1,"reason":"Nobody has it","droppedAt":1760000000020,"by":"00000000-0000-0000-0000-00000000000b"}]}' where id = 549;
set session_replication_role = origin;
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000e';
select _try('check: the yard reads #0549''s dropped hinge (name, qty, unit, reason, when), never its price', 'ok', $q$select _is($c$(store_order('11111111-1111-1111-1111-111111111111',549)->'payload'->'droppedLines') = '[{"qty":10,"unit":"pc","reason":"Nobody has it","droppedAt":1760000000020,"productId":"P9","productName":"Soft close hinge"}]' and (select (o->'payload'->'droppedLines'->0->>'productName') = 'Soft close hinge' from jsonb_array_elements(store_snapshot('11111111-1111-1111-1111-111111111111')->'orders') o where (o->>'id')::int = 549)$c$)$q$);
select _try('musa: the yard cannot write droppedLines', 'ok', $q$select _is($c$(select jsonb_array_length(payload->'droppedLines') from (select store_patch_order('11111111-1111-1111-1111-111111111111',552,'{"droppedLines":[{"productName":"x"}]}',null,null)) z, saved_quotes where id = 552) is null$c$)$q$);

-- ---------------- can't deliver; the Manager marks a stage
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000010';
select _try('ssali: can''t deliver #0547, Ggaba closed', 'ok', $q$select store_patch_order('11111111-1111-1111-1111-111111111111',547,'{"comingBack":{"at":1760000000015,"why":"closed","byName":"Ssali John"}}',null,null)$q$);
select _try('check: "#0547 coming back · Ggaba closed" to Ruth and Grace; the yard reads comingBack', 'ok', $q$select _is($c$_to('order.back', '#0547 coming back · Ggaba closed') = '0b,0d' and (store_order('11111111-1111-1111-1111-111111111111',547) -> 'payload' -> 'comingBack' ->> 'why') = 'closed'$c$)$q$);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select _try('ruth: marks #0538 delivered herself', 'ok', $q$update saved_quotes set status = 'completed', payload = payload || '{"stageEnteredAt":1760000000016}' where id = 538$q$);
select _try('check: "Ruth marked #0538 delivered" to the yard and to Grace', 'ok', $q$select _is($c$_to('order.moved', 'Ruth marked #0538 delivered') = '0e,0f,10' and _to('order.delivered', 'Ruth marked #0538 delivered') = '0d'$c$)$q$);
select _try('check: the yard''s own moves are not "moved"', 'ok', $q$select _is($c$(select count(*) from push_outbox where kind = 'order.moved') = 1$c$)$q$);

-- ---------------- goods come in
reset role;
update collection_trips set status = 'collected', collected_at = now() where id = 'T1';
set role authenticated;
select _try('check: "Denis''s trip is back at the yard · 2 lines" to the Store', 'ok', $q$select _is($c$_to('trip.back', 'Denis''s trip is back at the yard · 2 lines') = '0e,0f'$c$)$q$);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000e';
select _try('musa: checks in Denis''s trip, 2 pc of the iron sheets short', 'ok', $q$select receive_trip('11111111-1111-1111-1111-111111111111','T1','[{"shop":20},{"shop":3,"why":"short"}]')$q$);
select _try('check: "Musa''s check-in of Denis''s trip · 2 pc differ" to Ruth; "Checked in · Denis''s trip · 2 lines" to Denis', 'ok', $q$select _is($c$_to('trip.difference', 'Musa''s check-in of Denis''s trip · 2 pc differ') = '0b' and _to('trip.checked', 'Checked in · Denis''s trip · 2 lines') = '0c'$c$)$q$);
select _try('check: #0549 all in: "New to pack" ("we deliver") to the yard, "Ggaba''s #0549 is all in" to Grace', 'ok', $q$select _is($c$(select status from saved_quotes where id = 549) = 'preparing' and (select body from push_outbox where kind='order.pick' and ref->>'id'='549') = '#0549 Ggaba · we deliver' and _to('order.all_in', 'Ggaba''s #0549 is all in') = '0d'$c$)$q$);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select _try('ruth: decides the difference', 'ok', $q$update collection_trips set difference_accepted_at = now(), difference_accepted_by = '00000000-0000-0000-0000-00000000000b' where id = 'T1'$q$);
select _try('check: "Ruth decided the 2 pc" to Musa, who checked it in', 'ok', $q$select _is($c$_to('trip.difference.decided', 'Ruth decided the 2 pc') = '0e'$c$)$q$);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000e';
select _try('musa: checks in Hima Cement''s own delivery', 'ok', $q$select receive_trip('11111111-1111-1111-1111-111111111111','T2','[{"shop":100}]')$q$);
select _try('check: "Hima Cement · 100 bag came in" to Moses (Sourcing) and Esther (the delivery note); no trip.checked', 'ok', $q$select _is($c$_to('delivery.checked', 'Hima Cement · 100 bag came in') = '11,12' and not exists(select 1 from push_outbox where kind = 'trip.checked' and ref->>'id' = 'T2')$c$)$q$);

-- ---------------- the shelf and the shift
select _try('musa: sends a blind count of Wire nails 4"', 'ok', $q$select store_count_replace('11111111-1111-1111-1111-111111111111',null,'Aisle C','[{"key":"P3","productId":"P3","name":"Wire nails 4\"","counted":17,"system":18}]','[]','Musa')$q$);
select _try('check: "Musa''s count of Wire nails 4" · 17" to Ruth only, never the owner', 'ok', $q$select _is($c$_to('stock.count.sent', 'Musa''s count of Wire nails 4" · 17') = '0b'$c$)$q$);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select _try('ruth: asks for it again', 'ok', $q$select ask_recount((select id from stock_counts where status = 'sent' limit 1))$q$);
select _try('check: "Ruth asked: count it again" to Musa', 'ok', $q$select _is($c$_to('stock.recount', 'Ruth asked: count it again') = '0e'$c$)$q$);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000e';
select _try('musa: counts it again', 'ok', $q$select store_count_replace('11111111-1111-1111-1111-111111111111',null,'Aisle C','[{"key":"P3","productId":"P3","name":"Wire nails 4\"","counted":18,"system":18}]','[]','Musa')$q$);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select _try('ruth: accepts the count', 'ok', $q$select accept_stock_count((select id from stock_counts where status = 'sent' limit 1))$q$);
select _try('check: "Ruth accepted your count" to Musa', 'ok', $q$select _is($c$_to('stock.count.decided', 'Ruth accepted your count') = '0e'$c$)$q$);

set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000e';
select _try('musa: we need more gloss paint', 'ok', $q$insert into store_asks(shop_id, kind, payload, asked_by, asked_by_name) values ('11111111-1111-1111-1111-111111111111','restock','{"name":"Gloss paint","qty":10,"unit":"tin"}','00000000-0000-0000-0000-00000000000e','Musa Kiggundu')$q$);
select _try('check: "We need more · Gloss paint · about 10 tin" to Denis', 'ok', $q$select _is($c$_to('store.restock', 'We need more · Gloss paint · about 10 tin') = '0c'$c$)$q$);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
select _try('denis: puts it on the restock list', 'ok', $q$select answer_store_ask((select id from store_asks where kind = 'restock'),'accepted',null)$q$);
select _try('check: "On the restock list · next trip" to Musa', 'ok', $q$select _is($c$_to('store.ask.decided', 'On the restock list · next trip') = '0e'$c$)$q$);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000e';
select _try('musa: binding wire on the truck, not on the list', 'ok', $q$insert into store_asks(shop_id, kind, ref, payload, asked_by, asked_by_name) values ('11111111-1111-1111-1111-111111111111','extra','T1','{"name":"Binding wire 20kg","qty":1,"unit":"roll"}','00000000-0000-0000-0000-00000000000e','Musa Kiggundu')$q$);
select _try('check: "Not on the list · Binding wire 20kg · keep it?" to Ruth', 'ok', $q$select _is($c$_to('store.extra', 'Not on the list · Binding wire 20kg · keep it?') = '0b'$c$)$q$);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select _try('ruth: keep it', 'ok', $q$select answer_store_ask((select id from store_asks where kind = 'extra'),'accepted',null)$q$);
select _try('check: "Ruth: keep it" to Musa, Denis and Esther', 'ok', $q$select _is($c$_to('store.ask.decided', 'Ruth: keep it') = '0c,0e,12'$c$)$q$);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000e';
select _try('musa: passes the yard to Okello', 'ok', $q$insert into store_asks(shop_id, kind, payload, asked_by, asked_by_name) values ('11111111-1111-1111-1111-111111111111','handover','{"toUserId":"00000000-0000-0000-0000-00000000000f","orders":[]}','00000000-0000-0000-0000-00000000000e','Musa Kiggundu')$q$);
select _try('check: "Musa passed you the yard" to Okello', 'ok', $q$select _is($c$_to('store.handover', 'Musa passed you the yard') = '0f'$c$)$q$);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000f';
select _try('okello: I''ve got it', 'ok', $q$select answer_store_ask((select id from store_asks where kind = 'handover'),'accepted',null)$q$);
select _try('check: "Okello has it" to Musa', 'ok', $q$select _is($c$_to('store.ask.decided', 'Okello has it') = '0e'$c$)$q$);

-- ---------------- goods coming back
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000d';
select _try('grace: asks a return on #0548, 2 bag', 'ok', $q$insert into invoice_asks(shop_id, quote_id, customer_id, kind, lines, amount, reason, asked_by, asked_by_name, asked_role, status) values ('11111111-1111-1111-1111-111111111111',548,'C1','credit','[{"idx":0,"qty":2,"unit":"bag","name":"Cement"}]',70000,'too many','00000000-0000-0000-0000-00000000000d','Grace Akello','sales','sent')$q$);
select _try('check: "#0548 coming back · 2 bag" to the yard', 'ok', $q$select _is($c$_to('return.coming', '#0548 coming back · 2 bag') = '0e,0f,10'$c$)$q$);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000e';
select _try('musa: the return of #0546 at the gate, 2 bag damaged', 'ok', $q$select store_return_ask('11111111-1111-1111-1111-111111111111',546,'[{"idx":0,"qty":2,"condition":"damaged"}]','Came back · damaged',null)$q$);
select _try('check: "#0546 · 2 bag damaged" to Ruth, once (the yard''s words, not 0131''s)', 'ok', $q$select _is($c$_to('invoice.ask', '#0546 · 2 bag damaged') = '0b' and (select count(*) from push_outbox where kind = 'invoice.ask' and ref->>'quote' = '546') = 1$c$)$q$);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select _try('ruth: takes it back', 'ok', $q$select decide_invoice_ask((select id from invoice_asks where quote_id = 546),'accepted')$q$);
select _try('check: "Ruth took it back · 2 bag" to Musa and Grace', 'ok', $q$select _is($c$_to('invoice.ask.decided', 'Ruth took it back · 2 bag') = '0d,0e'$c$)$q$);
select _try('check: takenBack carries restocked', 'ok', $q$select _is($c$(store_order('11111111-1111-1111-1111-111111111111',548) -> 'payload' -> 'takenBack' -> 0 ->> 'restocked') = 'true' and (store_order('11111111-1111-1111-1111-111111111111',548) -> 'payload' -> 'takenBack' -> 0 -> 'lines' -> 0 ->> 'restocked') = 'true' and not (store_order('11111111-1111-1111-1111-111111111111',548)::text like '%35000%')$c$)$q$);
select _try('check: the counter sale''s flag reaches the yard, and it pushes nobody', 'ok', $q$select _is($c$(store_order('11111111-1111-1111-1111-111111111111',560) -> 'payload' ->> 'counter') = 'true' and not exists(select 1 from push_outbox where ref->>'id' = '560')$c$)$q$);

-- ---------------- nobody day-to-day waits on the owner
select _try('check: no push reached the owner', 'ok', $q$select _is($c$not exists(select 1 from push_outbox o, lateral ow_push_recipients(o.id) r where r.user_id = '00000000-0000-0000-0000-00000000000a')$c$)$q$);

reset role;
select case when coalesce(r.got = r.expect or (r.expect like 'refused%' and r.got like r.expect || '%'), false) then 'PASS' else 'FAIL' end, r.label, r.got
  from _r r order by r.n;
