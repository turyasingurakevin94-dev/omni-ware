-- 0184 asked of a real database: each ask lands on the Manager with its
-- evidence and its one safe answer, each answer is told to the people it
-- changes by the Manager's name, and answer_from_push answers from the push
-- (the recipient with the task only, once per key, never a stale ask, never an
-- answer the push does not offer).
grant all on all tables in schema public to authenticated;
grant all on all sequences in schema public to authenticated;
insert into auth.users values
 ('00000000-0000-0000-0000-00000000000a','owner@x'),('00000000-0000-0000-0000-00000000000b','ruth@x'),
 ('00000000-0000-0000-0000-00000000000c','denis@x'),('00000000-0000-0000-0000-00000000000d','grace@x'),
 ('00000000-0000-0000-0000-00000000000e','musa@x'),('00000000-0000-0000-0000-000000000011','moses@x'),
 ('00000000-0000-0000-0000-000000000012','esther@x');
insert into shops(id, name, created_by) values ('11111111-1111-1111-1111-111111111111','Omni-ware','00000000-0000-0000-0000-00000000000a');
insert into shop_members(shop_id,user_id,role,display_name) values
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000a','owner','Joseph'),
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000b','manager','Ruth Nakato'),
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000c','buyer','Denis Opio'),
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000d','sales','Grace Akello'),
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000e','store','Musa Kiggundu'),
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-000000000011','sourcing','Moses Lule'),
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-000000000012','accounts','Esther Auma');
insert into staff(shop_id,id,name,role,user_id) values
 ('11111111-1111-1111-1111-111111111111','W1','Ruth Nakato','manager','00000000-0000-0000-0000-00000000000b'),
 ('11111111-1111-1111-1111-111111111111','W2','Denis Opio','buyer','00000000-0000-0000-0000-00000000000c'),
 ('11111111-1111-1111-1111-111111111111','W3','Musa Kiggundu','store','00000000-0000-0000-0000-00000000000e');
insert into app_settings(shop_id, presets) values ('11111111-1111-1111-1111-111111111111','{}')
 on conflict (shop_id) do update set presets = excluded.presets;
insert into customers(shop_id,id,name,credit_limit,debt) values
 ('11111111-1111-1111-1111-111111111111','C1','Ggaba Stores',5000000,0),
 ('11111111-1111-1111-1111-111111111111','C2','Kato Construction',1000000,900000),
 ('11111111-1111-1111-1111-111111111111','C3','Nansana Hardware',null,0),
 ('11111111-1111-1111-1111-111111111111','C4','Lubowa Builders',5000000,210000);
insert into suppliers(shop_id,id,name) values ('11111111-1111-1111-1111-111111111111','S1','Kiseka Steel');
insert into products(shop_id,id,name) values ('11111111-1111-1111-1111-111111111111','P1','Cement 50 kg'),
 ('11111111-1111-1111-1111-111111111111','P2','Iron sheet G28'),('11111111-1111-1111-1111-111111111111','P3','PVC pipe 4 in');

set session_replication_role = replica;
insert into stock(shop_id,key,product_id,qty) values ('11111111-1111-1111-1111-111111111111','P1','P1',26);
insert into stock_lots(shop_id,key,qty,cost) values ('11111111-1111-1111-1111-111111111111','P1',26,34000);
insert into customer_debt_log(id, shop_id, customer_id, date, type, amount, note, quote_id) values
 (1,'11111111-1111-1111-1111-111111111111','C4',ow_today()-3,'charge',100000,'Auto-sync — INV-0801',801),
 (2,'11111111-1111-1111-1111-111111111111','C4',ow_today()-2,'charge',110000,'Auto-sync — INV-0803',803);
insert into saved_quotes(id, shop_id, client_name, date, status, invoiced, invoiced_at, amount_paid, payload) overriding system value values
 (706,'11111111-1111-1111-1111-111111111111','Kato Construction',ow_today(),'preparing',false,null,0,'{"customerId":"C1","takenBy":"00000000-0000-0000-0000-00000000000d","assignedWorkerId":"W3","pickingStatus":"in_progress","items":[{"lineId":1,"productId":"P2","productName":"Iron sheet G28","unit":"sht","qty":40,"price":38000,"sellPrice":47500,"supplierId":"__stock__"}]}'),
 (712,'11111111-1111-1111-1111-111111111111','Lubowa Builders',ow_today(),'draft',false,null,0,'{"customerId":"C4","takenBy":"00000000-0000-0000-0000-00000000000d","items":[{"lineId":1,"productId":"P1","productName":"Cement 50 kg","unit":"bag","qty":2,"price":34000,"sellPrice":42500,"supplierId":"__stock__"}]}'),
 (713,'11111111-1111-1111-1111-111111111111','Ggaba Stores',ow_today(),'awaiting_goods',false,null,0,'{"customerId":"C1","takenBy":"00000000-0000-0000-0000-00000000000d","items":[{"lineId":1,"productId":"P2","productName":"Iron sheet G28","unit":"sht","qty":10,"price":38000,"sellPrice":47500,"supplierId":"S1"}]}'),
 (714,'11111111-1111-1111-1111-111111111111','Peter''s client',ow_today(),'awaiting_goods',false,null,0,'{"originAgentName":"Peter Okot","takenBy":"00000000-0000-0000-0000-00000000000d","agentChange":{"state":"asked","at":"1","lines":[{"productId":"P1","variantIdx":null,"to":12}]},"items":[{"lineId":1,"productId":"P1","productName":"Cement 50 kg","unit":"bag","qty":20,"price":34000,"sellPrice":42500,"supplierId":"S1"}]}'),
 (715,'11111111-1111-1111-1111-111111111111','Walk-in',ow_today()-2,'completed',false,null,0,'{"deliveredAt":"2026-01-01T10:00:00Z","items":[{"lineId":1,"productId":"P1","productName":"Washer","unit":"pc","qty":1,"price":300,"sellPrice":567,"supplierId":"__stock__"}]}'),
 (801,'11111111-1111-1111-1111-111111111111','Lubowa Builders',ow_today()-3,'completed',true,ow_today()-3,0,'{"customerId":"C4","takenBy":"00000000-0000-0000-0000-00000000000d","debtCharged":100000,"payments":[],"items":[{"lineId":1,"productId":"P1","productName":"Cement 50 kg","qty":2,"price":34000,"sellPrice":50000,"supplierId":"__stock__","_stockTaken":2}]}'),
 (803,'11111111-1111-1111-1111-111111111111','Lubowa Builders',ow_today()-2,'completed',true,ow_today()-2,0,'{"customerId":"C4","takenBy":"00000000-0000-0000-0000-00000000000d","debtCharged":110000,"payments":[],"items":[{"lineId":1,"productId":"P3","productName":"Timber 2×4","qty":10,"price":8000,"sellPrice":11000,"supplierId":"__stock__"}]}');
insert into collection_trips(id, shop_id, supplier_id, status, assigned_worker_id, lines) values
 ('T7','11111111-1111-1111-1111-111111111111','S1','collected','W2',
  '[{"orderId":"restock","lineId":"r1","productId":"P3","productName":"PVC pipe 4 in","unit":"pc","qty":12,"gotQty":12,"gotPrice":28000}]');
insert into restock_buys(id, shop_id, product_id, qty, supplier_id, price, status, created_by) values
 ('bbbbbbbb-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','P1',10,'S1',34000,'planned','00000000-0000-0000-0000-00000000000c');
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
-- Who a push reaches, as push-send asks (the last two digits of each login).
create function _to(p_kind text, p_title text) returns text language sql security definer as $$
  select coalesce(string_agg(distinct right(r.user_id::text, 2), ',' order by right(r.user_id::text, 2)), '')
    from push_outbox o, lateral ow_push_recipients(o.id) r where o.kind = p_kind and o.title like p_title
$$;
create function _body(p_kind text, p_ref text) returns text language sql security definer as $$
  select string_agg(body, ' | ' order by id) from push_outbox where kind = p_kind and ref ->> 'id' = p_ref
$$;
create function _acts(p_kind text, p_ref text) returns text language sql security definer as $$
  select coalesce(string_agg(a ->> 'id' || '=' || (a ->> 'label'), ',' order by o.id), '')
    from push_outbox o, jsonb_array_elements(coalesce(o.actions, '[]'::jsonb)) a where o.kind = p_kind and o.ref ->> 'id' = p_ref
$$;
create function _ob(p_kind text, p_ref text) returns bigint language sql security definer as $$
  select min(id) from push_outbox where kind = p_kind and ref ->> 'id' = p_ref and actions is not null
$$;
create function _obk(p_kind text) returns bigint language sql security definer as $$
  select min(id) from push_outbox where kind = p_kind and actions is not null
$$;
create function _n(p_kind text, p_ref text) returns int language sql security definer as $$
  select count(*)::int from push_outbox where kind = p_kind and ref ->> 'id' = p_ref
$$;
create function _via(p_task text) returns int language sql security definer as $$
  select count(*)::int from decision_log where task = p_task and ref ->> 'via' = 'push'
$$;
grant execute on function _to, _body, _acts, _ob, _obk, _n, _via to authenticated;

set role authenticated;
-- ---------------- a price under the shop's: the evidence, and Approve on the push
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select _try('Grace''s #0701 sells Iron sheet G28 at 46,000 (under the shop''s), waits in Checking', 'ok', $q$insert into saved_quotes(id, shop_id, client_name, date, status, payload) overriding system value values (701,'11111111-1111-1111-1111-111111111111','Kato Construction',ow_today(),'draft','{"customerId":"C1","takenBy":"00000000-0000-0000-0000-00000000000d","items":[{"lineId":1,"productId":"P2","productName":"Iron sheet G28","unit":"sht","qty":30,"price":38000,"sellPrice":46000,"supplierId":"__stock__","priceBy":"00000000-0000-0000-0000-00000000000d","priceNote":"under"}]}')$q$);
select _try('check: "Grace · Under the shop''s price · #0701" to Ruth, the line, its price and cost as evidence', 'ok', $q$select _is($c$_to('price.waits', 'Grace · Under the shop''s price · #0701') = '0b' and _body('price.waits', '701') = 'Iron sheet G28 · 30 sht at 46,000 · cost 38,000'$c$)$q$);
select _try('check: its one action is Approve 46,000', 'ok', $q$select _is($c$_acts('price.waits', '701') = 'approve=Approve 46,000'$c$)$q$);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000d';
select _try('grace (Sales) answers it from the push', 'refused: 42501', $q$select answer_from_push(_ob('price.waits','701'), 'approve', 'cccccccc-0000-0000-0000-000000000001')$q$);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000e';
select _try('musa (Store) answers it from the push', 'refused: 42501', $q$select answer_from_push(_ob('price.waits','701'), 'approve', 'cccccccc-0000-0000-0000-000000000001')$q$);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select _try('ruth sends an answer the push does not offer (shop''s price)', 'refused: 22023', $q$select answer_from_push(_ob('price.waits','701'), 'shop', 'cccccccc-0000-0000-0000-000000000001')$q$);
select _try('ruth sends a money move by its name (write-off)', 'refused: 22023', $q$select answer_from_push(_ob('price.waits','701'), 'writeoff', 'cccccccc-0000-0000-0000-000000000001')$q$);
select _try('ruth: Approve 46,000, from the push', 'ok', $q$select answer_from_push(_ob('price.waits','701'), 'approve', 'cccccccc-0000-0000-0000-000000000001')$q$);
select _try('check: the line is approved at 46,000 by Ruth; the order no longer waits on a price; the owner''s log says via push', 'ok', $q$select _is($c$(select payload->'items'->0->'priceReview'->>'state' = 'approved' and (payload->'items'->0->'priceReview'->>'price')::numeric = 46000 and payload->'items'->0->'priceReview'->>'byName' = 'Ruth Nakato' and ow_gate_reason(shop_id, payload, amount_paid) is distinct from 'price' from saved_quotes where id = 701) and _via('price.approve') = 1$c$)$q$);
select _try('ruth: the same key again gives the same answer back, once', 'ok', $q$select _is($c$(answer_from_push(_ob('price.waits','701'), 'approve', 'cccccccc-0000-0000-0000-000000000001') ->> 'already') = 'true' and _via('price.approve') = 1$c$)$q$);
select _try('ruth: another key on an answered push', 'refused: 40001 Someone else just did this.', $q$select answer_from_push(_ob('price.waits','701'), 'approve', 'cccccccc-0000-0000-0000-000000000002')$q$);
select _try('check: Approve moved no price, so Grace has nothing to tell (no price.decided)', 'ok', $q$select _is($c$_n('price.decided', '701') = 0$c$)$q$);

set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select _try('Grace''s #0702 has a line with no price and no cost', 'ok', $q$insert into saved_quotes(id, shop_id, client_name, date, status, payload) overriding system value values (702,'11111111-1111-1111-1111-111111111111','Ggaba Stores',ow_today(),'draft','{"customerId":"C1","takenBy":"00000000-0000-0000-0000-00000000000d","items":[{"lineId":1,"productId":"P3","productName":"PVC pipe 4 in","unit":"pc","qty":6,"supplierId":"S1","priceBy":"00000000-0000-0000-0000-00000000000d","priceNote":"nocost","priceAsk":true}]}')$q$);
select _try('check: "Grace · Price coming · #0702" with no action (the price is typed)', 'ok', $q$select _is($c$_to('price.waits', 'Grace · Price coming · #0702') = '0b' and _body('price.waits', '702') = 'Ggaba Stores — PVC pipe 4 in · 6 pc · no cost yet' and _acts('price.waits', '702') = ''$c$)$q$);
select _try('Grace''s #0716 under the shop''s price', 'ok', $q$insert into saved_quotes(id, shop_id, client_name, date, status, payload) overriding system value values (716,'11111111-1111-1111-1111-111111111111','Ggaba Stores',ow_today(),'draft','{"customerId":"C1","takenBy":"00000000-0000-0000-0000-00000000000d","items":[{"lineId":1,"productId":"P2","productName":"Iron sheet G28","unit":"sht","qty":5,"price":38000,"sellPrice":45000,"supplierId":"__stock__","priceBy":"00000000-0000-0000-0000-00000000000d","priceNote":"under"}]}')$q$);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select _try('ruth sets her own price on #0716 in the app (47,500)', 'ok', $q$select ow_patch_order('11111111-1111-1111-1111-111111111111',716,jsonb_build_object('items',jsonb_build_array((select payload->'items'->0 from saved_quotes where id=716) || '{"sellPrice":47500,"priceReview":{"state":"changed","price":47500,"was":45000,"qty":5,"byName":"Ruth Nakato","at":"2026-11-12T09:00:00Z"}}')))$q$);
select _try('check: the price moved: "Ruth set a new price" to Grace, to tell them', 'ok', $q$select _is($c$_to('price.decided', 'Ruth set a new price') = '0d' and _body('price.decided', '716') = 'Ggaba Stores — Iron sheet G28 is now 47,500 each. Tell them.'$c$)$q$);

-- ---------------- On credit?
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select _try('Grace''s #0703 would take Kato over the limit', 'ok', $q$insert into saved_quotes(id, shop_id, client_name, date, status, payload) overriding system value values (703,'11111111-1111-1111-1111-111111111111','Kato Construction',ow_today(),'draft','{"customerId":"C2","takenBy":"00000000-0000-0000-0000-00000000000d","credit":{"days":14},"items":[{"lineId":1,"productId":"P1","productName":"Cement 50 kg","unit":"bag","qty":4,"price":34000,"sellPrice":50000,"supplierId":"__stock__"}]}')$q$);
select _try('check: "Grace · On credit? · Kato Construction", the chip and what they would owe; action On credit', 'ok', $q$select _is($c$_to('credit.hold', 'Grace · On credit? · Kato Construction') = '0b' and _body('credit.hold', '703') = 'Over the limit · would owe 1,100,000 of 1,000,000' and _acts('credit.hold', '703') = 'credit=On credit'$c$)$q$);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select _try('ruth says Cash first in the app, on another phone', 'ok', $q$select ow_patch_order('11111111-1111-1111-1111-111111111111',703,'{"creditCheck":{"decision":"cash","byName":"Ruth Nakato","at":1}}')$q$);
select _try('ruth: On credit from the old push (the ask changed since)', 'refused: 40001 Someone else just did this.', $q$select answer_from_push(_ob('credit.hold','703'), 'credit', 'cccccccc-0000-0000-0000-000000000003')$q$);
select _try('check: the stale answer wrote nothing', 'ok', $q$select _is($c$(select payload->'creditCheck'->>'decision' from saved_quotes where id = 703) = 'cash'$c$)$q$);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select _try('Grace''s #0704 for Kato, over the limit again', 'ok', $q$insert into saved_quotes(id, shop_id, client_name, date, status, payload) overriding system value values (704,'11111111-1111-1111-1111-111111111111','Kato Construction',ow_today(),'draft','{"customerId":"C2","takenBy":"00000000-0000-0000-0000-00000000000d","items":[{"lineId":1,"productId":"P1","productName":"Cement 50 kg","unit":"bag","qty":3,"price":34000,"sellPrice":50000,"supplierId":"__stock__"}]}')$q$);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select _try('ruth: On credit, from the push', 'ok', $q$select answer_from_push(_ob('credit.hold','704'), 'credit', 'cccccccc-0000-0000-0000-000000000004')$q$);
select _try('check: released (no longer held on credit), and Grace is told', 'ok', $q$select _is($c$(select payload->'creditCheck'->>'decision' = 'release' and ow_gate_reason(shop_id, payload, amount_paid) is distinct from 'credit' from saved_quotes where id = 704) and _to('credit.decided', 'Credit released') = '0d' and _via('credit.release') = 1$c$)$q$);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select _try('Grace''s #0705 on credit for Nansana (no limit set)', 'ok', $q$insert into saved_quotes(id, shop_id, client_name, date, status, payload) overriding system value values (705,'11111111-1111-1111-1111-111111111111','Nansana Hardware',ow_today(),'draft','{"customerId":"C3","takenBy":"00000000-0000-0000-0000-00000000000d","credit":{"days":14,"pct":3},"items":[{"lineId":1,"productId":"P1","productName":"Cement 50 kg","unit":"bag","qty":2,"price":34000,"sellPrice":50000,"supplierId":"__stock__"}]}')$q$);
select _try('check: "No limit set" leads; no action (a limit is the Manager''s to type)', 'ok', $q$select _is($c$_body('credit.hold', '705') like 'No limit set · would owe 10%' and _acts('credit.hold', '705') = ''$c$)$q$);

-- ---------------- packed short
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000e';
select _try('musa packs #0706 short: 36 of 40', 'ok', $q$select store_patch_order('11111111-1111-1111-1111-111111111111',706,'{"pickingStatus":"done","pickingDoneAt":1760000000013,"bay":"3"}',null,'[{"idx":0,"pickStatus":"short","pickedQty":36}]')$q$);
select _try('check: "Musa · Packed short · #0706" to Ruth: the line, what went, both bills; action Bill what went', 'ok', $q$select _is($c$_to('pick.short', 'Musa · Packed short · #0706') = '0b' and (select body from push_outbox where kind = 'pick.short' and to_task = 'pick.settle' and ref->>'id' = '706') = 'Iron sheet G28 36 of 40 sht · bill 1,710,000 (full 1,900,000)' and _acts('pick.short', '706') = 'went=Bill what went 1,710,000'$c$)$q$);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select _try('ruth: Bill what went, from the push', 'ok', $q$select answer_from_push(_ob('pick.short','706'), 'went', 'cccccccc-0000-0000-0000-000000000006')$q$);
select _try('check: the line bills 36, pickSettle went by Ruth; Musa and Grace told (0183)', 'ok', $q$select _is($c$(select (payload->'items'->0->>'qty')::numeric = 36 and payload->'pickSettle'->>'pick' = 'went' and payload->'pickSettle'->>'byName' = 'Ruth Nakato' and not ow_pick_shortfall(payload) from saved_quotes where id = 706) and _to('pick.settled', 'Ruth settled #0706''s short') = '0d,0e'$c$)$q$);

-- ---------------- a check-in that differs; the answer to the checker and the runner
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000e';
select _try('musa checks in Denis''s trip: 11 of 12 pipes', 'ok', $q$select receive_trip('11111111-1111-1111-1111-111111111111','T7','[{"shop":11,"why":"short"}]')$q$);
select _try('check: "Musa · Check-in differs · Denis''s trip" to Ruth, once, with the evidence; action Take the check-in', 'ok', $q$select _is($c$_to('trip.difference', 'Musa · Check-in differs · Denis''s trip') = '0b' and _n('trip.difference', 'T7') = 1 and _body('trip.difference', 'T7') = 'For the shelf · PVC pipe 4 in 11 of 12 · −28,000 at cost · from Kiseka Steel' and _acts('trip.difference', 'T7') = 'take=Take the check-in'$c$)$q$);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select _try('ruth: Take the check-in, from the push', 'ok', $q$select answer_from_push(_ob('trip.difference','T7'), 'take', 'cccccccc-0000-0000-0000-000000000007')$q$);
select _try('check: "Ruth took Musa''s check-in" to Musa and to Denis, who ran the trip; no push in the old words', 'ok', $q$select _is($c$(select difference_accepted_at is not null from collection_trips where id = 'T7') and _to('trip.difference.decided', 'Ruth took Musa''s check-in') = '0c,0e' and _n('trip.difference.decided', 'T7') = 2 and _body('trip.difference.decided', 'T7') like 'Denis''s trip · from Kiseka Steel — the shelf has the yard''s 11 of 12 PVC pipe 4 in.%' and _via('trip.difference') = 1$c$)$q$);

-- ---------------- a loss report: only "Kept on the shelf" on the push
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000e';
select _try('musa reports 3 Cement 50 kg damaged', 'ok', $q$insert into stock_reports(shop_id, key, product_id, name, qty, why, reported_by, reported_by_name) values ('11111111-1111-1111-1111-111111111111','P1','P1','Cement 50 kg',3,'damaged','00000000-0000-0000-0000-00000000000e','Musa Kiggundu')$q$);
select _try('check: "Musa · Damaged · 3 Cement 50 kg", the shelf before and after; action Kept on the shelf only', 'ok', $q$select _is($c$_to('stock.report', 'Musa · Damaged · 3 Cement 50 kg') = '0b' and (select body from push_outbox where kind = 'stock.report') = 'on the shelf 26 → 23 · Write it off?' and (select string_agg(a->>'id', ',') from push_outbox o, jsonb_array_elements(o.actions) a where o.kind = 'stock.report') = 'keep'$c$)$q$);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select _try('ruth: Kept on the shelf, from the push', 'ok', $q$select answer_from_push(_obk('stock.report'), 'keep', 'cccccccc-0000-0000-0000-000000000008')$q$);
select _try('check: the report is dismissed, nothing written off; Musa told', 'ok', $q$select _is($c$(select status from stock_reports limit 1) = 'dismissed' and (select qty from stock where key = 'P1') = 26 and _to('stock.report.decided', '%') = '0e'$c$)$q$);

-- ---------------- a void asked: only "Kept as billed"; a void done, told to Accounts and Grace
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000d';
select _try('grace asks to void INV-0801', 'ok', $q$insert into invoice_asks(id, shop_id, quote_id, customer_id, kind, amount, reason, asked_by, asked_by_name, asked_role, status) values ('aaaaaaaa-0000-0000-0000-000000000801','11111111-1111-1111-1111-111111111111',801,'C4','void',100000,'Entered twice','00000000-0000-0000-0000-00000000000d','Grace Akello','sales','sent')$q$);
select _try('check: the push to Ruth offers Kept as billed only', 'ok', $q$select _is($c$_acts('invoice.ask', 'aaaaaaaa-0000-0000-0000-000000000801') = 'keep=Kept as billed'$c$)$q$);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select _try('ruth: Kept as billed, from the push', 'ok', $q$select answer_from_push(_ob('invoice.ask','aaaaaaaa-0000-0000-0000-000000000801'), 'keep', 'cccccccc-0000-0000-0000-000000000009')$q$);
select _try('check: the ask is declined; INV-0801 still billed; Grace told', 'ok', $q$select _is($c$(select status from invoice_asks where quote_id = 801) = 'declined' and (select not voided from saved_quotes where id = 801) and _to('invoice.ask.decided', '%') = '0d'$c$)$q$);
select _try('ruth voids INV-0803 herself (entered twice)', 'ok', $q$select void_invoice('11111111-1111-1111-1111-111111111111',803,'Entered twice')$q$);
select _try('check: "Voided · #0803" to Esther (Accounts) and Grace, with the why in Ruth''s name', 'ok', $q$select _is($c$_to('invoice.voided', 'Voided · #0803') = '0d,12' and _body('invoice.voided', '803') like 'Lubowa Builders · 110,000 — Ruth: entered twice.%'$c$)$q$);
select _try('ruth raises a credit note on INV-0801: 1 bag back', 'ok', $q$select raise_credit_note('11111111-1111-1111-1111-111111111111',801,'[{"idx":0,"qty":1,"restock":true}]','Damaged')$q$);
select _try('check: "Credit note raised · #0801" to Esther and Grace, what came back and how much', 'ok', $q$select _is($c$_to('credit_note.raised', 'Credit note raised · #0801') = '0d,12' and (select min(body) from push_outbox where kind = 'credit_note.raised') = 'Lubowa Builders — 1 Cement 50 kg back · 50,000 off what they owe.'$c$)$q$);

-- ---------------- a carton for the shelf; a restock line held
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
select _try('denis asks: 8 Cement 50 kg for the shelf, the rest of a carton', 'ok', $q$insert into restock_buys(id, shop_id, product_id, qty, supplier_id, price, status, for_line, created_by) values ('bbbbbbbb-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','P1',8,'S1',34000,'held','713:1','00000000-0000-0000-0000-00000000000c')$q$);
select _try('check: carton.ask to Ruth offers Shelf part OK', 'ok', $q$select _is($c$_acts('carton.ask', 'bbbbbbbb-0000-0000-0000-000000000002') = 'ok=Shelf part OK'$c$)$q$);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select _try('ruth: Shelf part OK, from the push', 'ok', $q$select answer_from_push(_ob('carton.ask','bbbbbbbb-0000-0000-0000-000000000002'), 'ok', 'cccccccc-0000-0000-0000-000000000010')$q$);
select _try('check: the carton goes ahead; Denis told "Shelf part OK · Cement 50 kg"', 'ok', $q$select _is($c$(select status from restock_buys where id = 'bbbbbbbb-0000-0000-0000-000000000002') = 'planned' and _to('restock.released', 'Shelf part OK · Cement 50 kg') = '0c'$c$)$q$);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
select _try('denis asks about a second carton', 'ok', $q$insert into restock_buys(id, shop_id, product_id, qty, supplier_id, price, status, for_line, created_by) values ('bbbbbbbb-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','P1',8,'S1',34000,'held','713:1','00000000-0000-0000-0000-00000000000c')$q$);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select _try('ruth: Order only (in the app)', 'ok', $q$select refuse_restock_buy('bbbbbbbb-0000-0000-0000-000000000003')$q$);
select _try('check: "Order only · Cement 50 kg" to Denis, once, in Ruth''s name', 'ok', $q$select _is($c$_to('carton.refused', 'Order only · Cement 50 kg') = '0c' and _n('carton.refused', 'bbbbbbbb-0000-0000-0000-000000000003') = 1 and (select body from push_outbox where kind = 'carton.refused') like 'Ruth: buy only what the order needs.%'$c$)$q$);
select _try('ruth holds a restock line (not yet)', 'ok', $q$select hold_restock_buy('bbbbbbbb-0000-0000-0000-000000000001', true)$q$);
select _try('check: "Ruth: not yet · Cement 50 kg" to Denis', 'ok', $q$select _is($c$_to('restock.held', 'Ruth: not yet · Cement 50 kg') = '0c'$c$)$q$);

-- ---------------- the yard's asks: Keep it, Count it again
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000e';
select _try('musa: binding wire on the truck, not on the list', 'ok', $q$insert into store_asks(id, shop_id, kind, ref, payload, asked_by, asked_by_name) values ('dddddddd-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','extra','T7','{"name":"Binding wire","qty":1,"unit":"roll"}','00000000-0000-0000-0000-00000000000e','Musa Kiggundu')$q$);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select _try('ruth: Keep it, from the push', 'ok', $q$select answer_from_push(_ob('store.extra','dddddddd-0000-0000-0000-000000000001'), 'keep', 'cccccccc-0000-0000-0000-000000000011')$q$);
select _try('check: kept; Musa told', 'ok', $q$select _is($c$(select status from store_asks where id = 'dddddddd-0000-0000-0000-000000000001') = 'accepted' and _to('store.ask.decided', 'Ruth: keep it') like '%0e%'$c$)$q$);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000e';
select _try('musa sends a blind count', 'ok', $q$select store_count_replace('11111111-1111-1111-1111-111111111111',null,'Aisle C','[{"key":"P1","productId":"P1","name":"Cement 50 kg","counted":25,"system":26}]','[]','Musa')$q$);
select _try('check: the count offers Count it again only (Count taken is a slide)', 'ok', $q$select _is($c$(select string_agg(a->>'id', ',') from push_outbox o, jsonb_array_elements(o.actions) a where o.kind = 'stock.count.sent') = 'again'$c$)$q$);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select _try('ruth: Count it again, from the push', 'ok', $q$select answer_from_push(_obk('stock.count.sent'), 'again', 'cccccccc-0000-0000-0000-000000000012')$q$);
select _try('check: a recount, Musa told, the shelf unchanged (27: 26 and the credit note''s bag back)', 'ok', $q$select _is($c$(select status from stock_counts limit 1) = 'recount' and _to('stock.recount', '%') = '0e' and (select qty from stock where key = 'P1') = 27$c$)$q$);

-- ---------------- Sales' cancel ask: only "Kept" on the push; a cancel tells the Buyer
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000d';
select _try('grace asks to cancel #0712', 'ok', $q$select ask_cancel('11111111-1111-1111-1111-111111111111',712,'Changed their mind')$q$);
select _try('check: the push offers Kept only', 'ok', $q$select _is($c$(select string_agg(a->>'id' || '=' || (a->>'label'), ',') from push_outbox o, jsonb_array_elements(o.actions) a where o.kind = 'order.cancel.ask') = 'kept=Kept'$c$)$q$);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select _try('ruth: Kept, from the push', 'ok', $q$select answer_from_push(_obk('order.cancel.ask'), 'kept', 'cccccccc-0000-0000-0000-000000000013')$q$);
select _try('check: "Kept" to Grace, "#0712 · Lubowa Builders — Ruth kept it."; the order stands', 'ok', $q$select _is($c$_to('order.cancel.ask.decided', 'Kept') = '0d' and (select body from push_outbox where kind = 'order.cancel.ask.decided') = '#0712 · Lubowa Builders — Ruth kept it.' and (select status from saved_quotes where id = 712) = 'draft'$c$)$q$);
select _try('ruth cancels #0713, in Buying for Kiseka Steel', 'ok', $q$select cancel_order('11111111-1111-1111-1111-111111111111',713,'Changed their mind')$q$);
select _try('check: "Cancelled · stop buying" to Denis (trip.plan)', 'ok', $q$select _is($c$_to('order.cancelled', 'Cancelled · stop buying') = '0c' and (select body from push_outbox where dedupe = 'cancel:713:buyer') = '#0713 · Ggaba Stores — Ruth cancelled it. Off To ask and the trip.'$c$)$q$);

-- ---------------- an agent's change answered
select _try('ruth agrees to Peter''s fewer on #0714', 'ok', $q$select ow_patch_order('11111111-1111-1111-1111-111111111111',714,'{"agentChange":{"state":"agreed","at":"1","decidedAt":"2026-11-12T09:00:00Z","lines":[{"productId":"P1","variantIdx":null,"to":12,"decision":"agreed"}]}}')$q$);
select _try('check: "Ruth answered Peter" to Denis: buy only what is left', 'ok', $q$select _is($c$_to('agent.change.decided', 'Ruth answered Peter') = '0c' and _body('agent.change.decided', '714') = '#0714 · Peter''s client — 1 line changed. Buy only what is left.'$c$)$q$);

-- ---------------- a nudge is a push
select _try('ruth nudges Grace about #0712', 'ok', $q$select nudge_person('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000d',712,'The Lubowa Builders order (#0712) has waited 2 h in Checking. Can you sort it now?')$q$);
select _try('check: "Ruth nudged you" to Grace with the words; in the owner''s log', 'ok', $q$select _is($c$_to('team.nudge', 'Ruth nudged you') = '0d' and (select body from push_outbox where kind = 'team.nudge') like 'The Lubowa Builders order (#0712)%' and (select count(*) from decision_log where task = 'team.nudge') = 1$c$)$q$);
select _try('ruth nudges with no words', 'refused: 22023 Say what the nudge is about.', $q$select nudge_person('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000d',null,'   ')$q$);
select _try('ruth nudges someone not in the shop', 'refused: 22023 That person is not in this shop.', $q$select nudge_person('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-000000000099',null,'Hello')$q$);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000d';
select _try('grace nudges Musa', 'refused: 42501', $q$select nudge_person('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000e',null,'Hurry')$q$);

-- ---------------- a goal, a new item, a promise
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select _try('ruth sets Grace''s goal for November', 'ok', $q$select set_person_goal('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000d',35000000,'2026-11-01','2026-11-30')$q$);
select _try('check: "Your goal for November" to Grace, "35,000,000 · Ruth set it"', 'ok', $q$select _is($c$_to('goal.set', 'Your goal for November') = '0d' and (select body from push_outbox where kind = 'goal.set') = '35,000,000 · Ruth set it'$c$)$q$);
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000011';
select _try('moses (Sourcing) lists PVC elbow 4 in', 'ok', $q$insert into products(shop_id, id, name, variants) values ('11111111-1111-1111-1111-111111111111','P9','PVC elbow 4 in','[]')$q$);
select _try('check: "A new item to price" to Ruth, "Moses listed PVC elbow 4 in · set its markup"', 'ok', $q$select _is($c$_to('markup.wanted', 'A new item to price') = '0b' and (select body from push_outbox where kind = 'markup.wanted') = 'Moses listed PVC elbow 4 in · set its markup'$c$)$q$);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000d';
select _try('grace takes Kato''s promise: 500,000', 'ok', $q$insert into payment_promises(shop_id, id, customer_id, promised_on, made_on, amount) values ('11111111-1111-1111-1111-111111111111',1,'C2','2026-11-14',ow_today(),500000)$q$);
select _try('check: "Kato promised 500,000 · Sat 14 Nov" to Ruth, Grace took it, what they owe', 'ok', $q$select _is($c$_to('promise.made', 'Kato promised 500,000 · Sat 14 Nov') = '0b' and (select body from push_outbox where kind = 'promise.made') = 'Grace took the promise · they owe 900,000.'$c$)$q$);

-- ---------------- the 24-hour run; delivered pushes nobody
reset role;
select ow_invoice_due_orders();
set role authenticated;
select _try('check: "Can''t bill itself · #0715" to Ruth, "Only 567 · check it", no database words', 'ok', $q$select _is($c$_to('invoice.held', 'Can''t bill itself · #0715') = '0b' and _body('invoice.held', '715') = 'Walk-in — Only 567 · check it'$c$)$q$);
select _try('check: no push anywhere is order.delivered to invoice.make', 'ok', $q$select _is($c$not exists (select 1 from push_outbox where kind = 'order.delivered' and to_task = 'invoice.make')$c$)$q$);
select _try('check: no push reached the owner', 'ok', $q$select _is($c$not exists (select 1 from push_outbox o, lateral ow_push_recipients(o.id) r where r.user_id = '00000000-0000-0000-0000-00000000000a')$c$)$q$);
select _try('check: no Manager push says "The Manager" or a database error', 'ok', $q$select _is($c$not exists (select 1 from push_outbox where (title || body) ~ '(The Manager|OW[A-Z]{3}|sqlerrm|ERROR)')$c$)$q$);
select _try('check: the Store''s "on credit?" reads "Not paid yet · on credit?"', 'ok', $q$select _is($c$position('Not paid yet · on credit?' in pg_get_functiondef('saved_quotes_ow_push_money()'::regprocedure)) > 0 and position('Cash first · it stays' in pg_get_functiondef('saved_quotes_ow_push_money()'::regprocedure)) > 0 and position('Not paid yet · on credit?' in pg_get_functiondef('saved_quotes_ow_a_yard_push()'::regprocedure)) > 0$c$)$q$);
select _try('check: every action on every push is a safe answer', 'ok', $q$select _is($c$not exists (select 1 from push_outbox o, jsonb_array_elements(coalesce(o.actions, '[]'::jsonb)) a where (o.kind || ':' || (a->>'id')) not in ('price.waits:approve','price.waits:shop','credit.hold:credit','pick.short:went','trip.difference:take','stock.report:keep','invoice.ask:keep','carton.ask:ok','store.extra:keep','stock.count.sent:again','order.cancel.ask:kept'))$c$)$q$);
select _try('check: a push to anyone but the decision''s task carries no action', 'ok', $q$select _is($c$not exists (select 1 from push_outbox where actions is not null and to_task is null)$c$)$q$);

reset role;
select case when coalesce(r.got = r.expect or (r.expect like 'refused%' and r.got like r.expect || '%'), false) then 'PASS' else 'FAIL' end, r.label, r.got
  from _r r order by r.n;
